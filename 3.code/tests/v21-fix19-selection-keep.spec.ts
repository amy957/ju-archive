import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix19 · 大纲「多选跨行富文本编辑后选区保持不变」
 *
 * 缺陷（fix19 取证，90过程材料/tmp/fix19/selection_edit_probe_before.log）：
 *   大纲里跨行拖选第 2~4 行 → 点右侧工具栏「加粗」：
 *     · before：产品跨行模型 covered=3、overlay 高亮 3 块、原生可见子选区 11 字；
 *     · after ：模型被 xselClear() 销毁、overlay=0，只剩首行的原生选区
 *               ⇒ 用户看到「选区错误收缩至第一行」（MULTILINE_KEPT=false）。
 *
 * 修复（src/ui/xselect.ts + src/ui/rightbar.ts）：
 *   · 格式命令执行前用 xselCaptureNative() 记录原生可见子选区（单宿主 id + 纯文本偏移）；
 *   · 逐块写样式后调用 xselKeepAfterFormat(snap)：**保留跨行模型**（不清空 overlay），
 *     按偏移还原原生选区并重绘 —— 纯文本长度不变 ⇒ 选区逐字保持不变。
 *   注意：全程只走产品端口，未修改 window.JU.ui() 返回值。
 *
 * 本 spec 口径：真实鼠标拖选、真实点击工具栏按钮，读真实 DOM computed 样式 + 产品选区模型。
 * 承载方式与 fix7 / fix13 spec 一致：vite build + context.route 提供 dist。
 */

const BASE = 'http://localhost:5173';
const ROWS = '#content .text[contenteditable="true"]';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const LINE = (i: number) => '第' + (i + 1) + '行 FIX19 跨行富文本 ABCDEFGHIJ';

function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

/** 重新构建（保证被测代码即当前源码），返回 dist 绝对路径。 */
async function prepareDist(): Promise<string> {
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  return dist;
}

/** 把 baseURL 请求映射到 dist 产物（本机回环入站被系统策略阻断，故走路由拦截）。 */
async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route(BASE + '/**', async (route: Route) => {
    const url = new URL(route.request().url());
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';
    const file = path.join(dist, pathname);
    try {
      const st = await fsp.stat(file);
      if (st.isDirectory()) throw new Error('directory');
      await route.fulfill({
        status: 200,
        contentType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        body: await fsp.readFile(file),
      });
    } catch {
      await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'not found: ' + pathname });
    }
  });
}

async function openApp(browser: Browser): Promise<{ context: BrowserContext; page: Page; pageErrors: string[] }> {
  const dist = await prepareDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') pageErrors.push(String(m.text())); });
  page.on('pageerror', (e: any) => pageErrors.push('pageerror: ' + String(e && e.message)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const w = window as any;
    return !!(w.JU && typeof w.JU.getState === 'function' && w.JU.actions && typeof w.JU.actions.addNode === 'function');
  }, null, { timeout: 60_000 });
  await page.waitForTimeout(500);
  return { context, page, pageErrors };
}

async function gotoOutline(page: Page): Promise<void> {
  await page.evaluate(() => {
    const r = document.getElementById('sidebarRight'); if (r) r.classList.remove('collapsed');
    const l = document.getElementById('sidebarLeft'); if (l) l.classList.remove('collapsed');
  });
  const btn = page.locator('#tbNav .tb-nav-btn[data-view="outline"]').first();
  if (await btn.count() > 0) await btn.click();
  await page.waitForSelector('#content .outline', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(400);
}

/**
 * 夹具：用产品端口 actions.createDoc / setCurrentDoc / addNode 建一篇普通文档 + 5 行，
 * 返回新增节点 id（确定性定位第 2 / 第 4 行）。不直接改写 JU.ui 本身。
 */
async function mountDoc(page: Page): Promise<string[]> {
  const ids = await page.evaluate((texts: string[]) => {
    const JU: any = (window as any).JU;
    let docId = (typeof JU.actions.createDoc === 'function') ? JU.actions.createDoc('fix19 探针文档') : null;
    if (!docId) {
      const st = JU.getState();
      docId = (st.ui && st.ui.currentDocId) || st.rootId;
    }
    if (docId && typeof JU.actions.setCurrentDoc === 'function') JU.actions.setCurrentDoc(docId);
    const out: string[] = [];
    texts.forEach((t) => {
      const id = JU.actions.addNode(docId, null, { text: t });
      if (id) out.push(id);
    });
    if (typeof JU.forceRender === 'function') JU.forceRender();
    return out;
  }, [0, 1, 2, 3, 4].map(LINE));
  await page.waitForTimeout(600);
  return ids;
}

/** 真实鼠标从第 2 行中部拖到第 4 行中右部。 */
async function dragRow2To4(page: Page, startId: string, endId: string): Promise<void> {
  const geo = await page.evaluate(({ sel, a, b }) => {
    const pick = (id: string) => {
      const el = document.querySelector(sel + '[data-id="' + CSS.escape(id) + '"]') as HTMLElement | null;
      if (!el) return null;
      const r = document.createRange();
      r.selectNodeContents(el);
      const x = r.getBoundingClientRect();
      return { l: x.left, t: x.top, w: x.width, h: x.height };
    };
    return { a: pick(a), b: pick(b) };
  }, { sel: ROWS, a: startId, b: endId });
  expect(geo.a, '第 2 行 .text 必须存在').not.toBeNull();
  expect(geo.b, '第 4 行 .text 必须存在').not.toBeNull();
  const start = { x: geo.a!.l + Math.max(8, geo.a!.w * 0.18), y: geo.a!.t + geo.a!.h / 2 };
  const end = { x: geo.b!.l + Math.max(8, geo.b!.w * 0.62), y: geo.b!.t + geo.b!.h / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 26 });
  await page.mouse.up();
  await page.waitForTimeout(350);
}

interface Snap {
  selLen: number;
  /* 原生选区端点宿主（被引擎钳在单宿主内，仅用于记录可见子选区） */
  anchorId: string;
  focusId: string;
  /* 产品跨行模型端点宿主（真正的多行范围判据） */
  modelAnchorId: string;
  modelFocusId: string;
  covered: number;
  modelIds: string[];
  overlayBlocks: number;
}

async function snapshot(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    const hostId = (n: any): string => {
      if (!n) return '';
      const el = n.nodeType === 1 ? n : n.parentElement;
      const host = el && el.closest ? el.closest('#content .text[contenteditable="true"]') : null;
      return host ? String(host.dataset.id || '') : '';
    };
    const s = window.getSelection();
    const m = (window as any).__juXsel && typeof (window as any).__juXsel.describe === 'function'
      ? (window as any).__juXsel.describe() : null;
    const ov = document.getElementById('ju-xsel-overlay');
    return {
      selLen: s ? String(s.toString()).length : 0,
      anchorId: s ? hostId(s.anchorNode) : '',
      focusId: s ? hostId(s.focusNode) : '',
      modelAnchorId: m && m.anchor ? String(m.anchor.id || '') : '',
      modelFocusId: m && m.focus ? String(m.focus.id || '') : '',
      covered: m ? m.covered : 0,
      modelIds: m && Array.isArray(m.ids) ? m.ids : [],
      overlayBlocks: ov ? ov.querySelectorAll('.ju-xsel-block').length : 0,
    };
  });
}

/** 每块 .text 的 innerHTML（按 id 取）。 */
async function htmlById(page: Page, ids: string[]): Promise<Record<string, string>> {
  return page.evaluate((list: string[]) => {
    const out: Record<string, string> = {};
    list.forEach((id) => {
      const el = document.querySelector('#content .text[contenteditable="true"][data-id="' + CSS.escape(id) + '"]') as HTMLElement | null;
      out[id] = el ? String(el.innerHTML || '') : '';
    });
    return out;
  }, ids);
}

test.describe('v2.1 fix19 · 大纲跨行富文本编辑后选区保持不变', () => {
  test('多选富文本编辑后选区保持不变', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      const ids = await mountDoc(page);
      expect(ids.length, '必须建立 5 行正文').toBeGreaterThanOrEqual(4);
      const startId = ids[1]; // 第 2 行
      const endId = ids[3];   // 第 4 行

      await dragRow2To4(page, startId, endId);

      const before = await snapshot(page);
      /* 前置条件：跨行选区模型确实覆盖多行 */
      expect(before.covered, '拖选第 2~4 行后模型必须覆盖 ≥2 块').toBeGreaterThanOrEqual(2);
      expect(before.overlayBlocks, '跨行选区必须有 overlay 高亮').toBeGreaterThan(0);
      expect(before.modelAnchorId, '模型锚点应落在第 2 行').toBe(startId);
      expect(before.modelFocusId, '模型焦点应落在第 4 行').toBe(endId);

      /* 真实点击右侧工具栏「加粗」 */
      const bold = page.locator('#sidebarRight [data-cmd="bold"], [data-cmd="bold"]').first();
      expect(await bold.count(), '工具栏必须有加粗按钮').toBeGreaterThan(0);
      await bold.click();
      await page.waitForTimeout(600);

      const after = await snapshot(page);

      /* 断言 1：对应节点正确应用了加粗。
         【实现口径】产品纯 DOM 引擎以 `font-weight:bold` 内联样式落盘（不强制 <b>/<strong> 语义标签），
         因此同时接受 `<b>/<strong>` 标签或 `font-weight:bold` 样式 —— 二者都是「加粗已生效」的真实 DOM 事实。 */
      const html = await htmlById(page, before.modelIds);
      for (const id of before.modelIds) {
        const h = html[id] || '';
        const hasBoldTag = /<(b|strong)\b/i.test(h);
        const hasBoldStyle = /font-weight\s*:\s*(bold|bolder|[6-9]\d\d)/i.test(h);
        expect(hasBoldTag || hasBoldStyle, '第 ' + id + ' 块必须应用加粗（<b>/<strong> 或 font-weight:bold）').toBe(true);
      }

      /* 断言 2：操作完成后原生选区文本长度与操作前一致 */
      expect(after.selLen, '操作后选区文本长度必须与操作前一致（不得收缩）').toBe(before.selLen);

      /* 断言 3：锚点 / 焦点仍在正确的多行范围内，未坍缩到单行 */
      expect(after.covered, '操作后跨行模型仍必须覆盖 ≥2 块（不得坍缩到单行）').toBe(before.covered);
      expect(after.overlayBlocks, '操作后 overlay 多行高亮仍必须存在').toBeGreaterThan(0);
      expect(after.modelAnchorId, '操作后模型锚点仍在第 2 行').toBe(startId);
      expect(after.modelFocusId, '操作后模型焦点仍在第 4 行').toBe(endId);

      expect(pageErrors, '整个交互过程不得有页面错误').toEqual([]);
    } finally {
      await context.close();
    }
  });
});
