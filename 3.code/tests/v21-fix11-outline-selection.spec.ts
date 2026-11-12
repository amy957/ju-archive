import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix11 · 大纲视图「拖选多行文本出现蓝色系统选区」
 *
 * 缺陷与根因（fix11 P0 取证：90过程材料/tmp/fix11/outline_selection_before.log，
 * 对 fix10 发布产物 sha256 6442259f…2701，Edge 真窗口 file:// 真实拖选）：
 *   · 跨行拖选 3 行 ⇒ 3 个正文块带 `.ju-xsel`，其 backgroundImage =
 *     `linear-gradient(rgba(64, 132, 255, 0.2), …)`、boxShadow = `rgba(64,132,255,0.28) 0 0 0 1px inset`
 *     ⇒ 整块泛**蓝**（fix7 引入的跨行高亮层写死了蓝系色，与产品绿主题不符）。
 *   · 浏览器默认 `::selection` 实测 computed = `rgba(0, 0, 0, 0)`（无作者规则），
 *     即蓝色**不是**浏览器默认行为，而是产品 `.ju-xsel` 样式类导致（任务书 P1 第二分支）。
 *   · 行容器 `.row.sel` 底色 = `rgb(201, 220, 196)`（= `--accent-soft` 产品绿），本来就正常。
 *
 * 修复（仅动 src/style.css 的选区样式段，不改 boot.ts / 富文本核心 / xselect.ts）：
 *   ① `.text.ju-xsel` 渐变与内描边改用主题 token `--accent`（日间 = 产品绿 #33654C）；
 *   ② `.outline .text::selection` 改为产品绿（消除行内选中那一段的系统默认蓝，同时保留可见性）；
 *   ③ `.outline .text.ju-xsel::selection` 置透明（该块已有绿色高亮层，避免双层深浅叠加）。
 *
 * 本 spec 的口径：真实鼠标拖选 / 真实键盘输入，断言读 DOM computed 样式 + 产品选区模型，
 * 不注入内联 style、不改夹具。承载方式与 fix7/fix10 spec 一致（vite build 产物 + context.route）。
 *
 * 【fix12 · 2026-10-28 口径变更】fix12 把选区改为「单层」：块级 .ju-xsel 与行级 .row.sel 一律零绘制，
 *   绿色只来自原生 ::selection。本文件原 fix11 口径中「.ju-xsel 必须有绿色块底」「.row.sel 必须等于
 *   --accent-soft」两项断言已按新契约改写为「必须透明 / 必须不是块级绘制」，其余（选区模型覆盖 ≥2 块、
 *   行内光标与 caret-color、行内 ::selection 产品绿）保持不变。
 *   依据：90过程材料/tmp/fix12/selection_visual_before.log（叠加层 37.6× / 19.7× 于选区面积）、
 *        90过程材料/tmp/fix12/selection_visual_after.log（叠加层零绘制）。
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

function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

async function ensureDist(): Promise<string> {
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  return dist;
}

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
  const dist = await ensureDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') pageErrors.push(String(m.text())); });
  page.on('pageerror', (e: any) => pageErrors.push('pageerror: ' + String(e && e.message)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window as any).JU && typeof (window as any).JU.getState === 'function', null, { timeout: 60_000 });
  await page.waitForTimeout(600);
  return { context, page, pageErrors };
}

/** 进大纲视图（真实点顶栏 data-view="outline"，走产品 bindTopbar 处理器） */
async function gotoOutline(page: Page): Promise<void> {
  const btn = page.locator('#tbNav .tb-nav-btn[data-view="outline"]').first();
  await expect(btn, '顶栏必须有大纲入口').toHaveCount(1, { timeout: 20_000 });
  await btn.click();
  await expect(page.locator('#content .outline')).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(400);
}

/** 真实键盘建多行正文（点首行 → Ctrl+A 清空 → 打字 → Enter 建下一行） */
async function buildRows(page: Page): Promise<number> {
  const first = page.locator(ROWS).first();
  await first.click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('第1行 FIX11 选区 ABCDEFGHIJ', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第2行 FIX11 选区 KLMNOPQRST', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第3行 FIX11 选区 UVWXYZ0123', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第4行 FIX11 选区 456789abcd', { delay: 6 });
  await page.waitForTimeout(400);
  let n = await page.locator(ROWS).count();
  if (n < 2) {
    /* 回落：Enter 未建行时用产品自身 actions.addNode（真实 state；仍不直改 DOM） */
    await page.evaluate(() => {
      const JU: any = (window as any).JU;
      const st = JU.getState();
      const docId = (st.ui && st.ui.currentDocId) || st.rootId;
      ['第5行 FIX11 追加 A', '第6行 FIX11 追加 B'].forEach((t: string) => JU.actions.addNode(docId, null, { text: t }));
      if (typeof JU.forceRender === 'function') JU.forceRender();
    });
    await page.waitForTimeout(500);
    n = await page.locator(ROWS).count();
  }
  return n;
}

/** 点回第 2 行正文（重置光标，避开 .drag-handle） */
async function clickRow(page: Page, index = 1): Promise<void> {
  await page.keyboard.press('Escape').catch(() => { });
  const pt = await page.evaluate(({ sel, i }) => {
    const rows = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    const r = rows[Math.min(i, rows.length - 1)].getBoundingClientRect();
    return { x: r.left + 30, y: r.top + r.height / 2 };
  }, { sel: ROWS, i: index });
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(200);
}

/** 真实鼠标跨行拖选：第 1 行文本起点 → 第 3 行文本中部 */
async function dragMultiRow(page: Page): Promise<void> {
  const geo = await page.evaluate((sel) => {
    const rows = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    const r0 = rows[0].getBoundingClientRect();
    const r2 = rows[Math.min(2, rows.length - 1)].getBoundingClientRect();
    return {
      startX: r0.left + 6, startY: r0.top + r0.height / 2,
      endX: r2.left + Math.min(200, r2.width - 8), endY: r2.top + r2.height / 2,
    };
  }, ROWS);
  await page.mouse.move(geo.startX, geo.startY);
  await page.mouse.down();
  await page.mouse.move(geo.endX, geo.endY, { steps: 24 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** 真实鼠标行内拖选（对照：行内原生选区配色） */
async function dragInRow(page: Page): Promise<void> {
  const geo = await page.evaluate((sel) => {
    const t = document.querySelector(sel) as HTMLElement;
    const r = t.getBoundingClientRect();
    return { startX: r.left + 4, startY: r.top + r.height / 2, endX: r.left + Math.min(120, r.width - 6), endY: r.top + r.height / 2 };
  }, ROWS);
  await page.mouse.move(geo.startX, geo.startY);
  await page.mouse.down();
  await page.mouse.move(geo.endX, geo.endY, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

interface ColorHit { raw: string; r: number; g: number; b: number; a: number; blue: boolean; green: boolean; }

test.describe('v2.1 fix11 · 大纲拖选多行 · 选区配色（去蓝保绿保光标）', () => {
  test('拖选多行：覆盖块为产品绿、无系统蓝，行容器保持绿色选中态', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      const n = await buildRows(page);
      expect(n, '必须能建立 ≥2 行正文用于拖选').toBeGreaterThanOrEqual(2);

      await clickRow(page, 1);
      await dragMultiRow(page);

      /* ① 产品跨行选区模型：覆盖 ≥2 块（拖选没有被节点多选抢走） */
      const model = await page.evaluate(() => {
        const x = (window as any).__juXsel;
        return x && typeof x.describe === 'function' ? x.describe() : null;
      });
      expect(model, '跨行选区模型必须存在（window.__juXsel）').not.toBeNull();
      expect(model.covered, '拖选应覆盖 ≥2 个正文块').toBeGreaterThanOrEqual(2);
      expect(await page.locator('#content .row.multi-sel').count(), '不得退化为节点多选').toBe(0);
      expect(await page.locator('.outline-selbar').count(), '不得出现「已选 N 个节点」工具条').toBe(0);

      /* ② 覆盖块（.ju-xsel）底色必须是产品绿、且不含任何蓝色分量 */
      const hits: ColorHit[] = await page.evaluate(() => {
        const parse = (s: string) => {
          const t = String(s || '').trim();
          let m = t.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.%]+))?\s*\)$/i);
          if (m) {
            const a = m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
            return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a };
          }
          m = t.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i);
          if (m) return { r: parseFloat(m[1]) * 255, g: parseFloat(m[2]) * 255, b: parseFloat(m[3]) * 255, a: m[4] == null ? 1 : parseFloat(m[4]) };
          return null;
        };
        const colorsIn = (s: string) => {
          const out: any[] = [];
          const re = /rgba?\([^)]*\)|color\(srgb[^)]*\)/gi;
          let m: RegExpExecArray | null;
          while ((m = re.exec(String(s || '')))) { const c = parse(m[0]); if (c) out.push({ raw: m[0], ...c }); }
          return out;
        };
        const out: any[] = [];
        const els = Array.from(document.querySelectorAll('#content .text.ju-xsel')) as HTMLElement[];
        for (const el of els) {
          const cs = getComputedStyle(el);
          for (const cssVal of [cs.backgroundImage, cs.backgroundColor, cs.boxShadow]) {
            for (const c of colorsIn(cssVal)) {
              out.push({
                raw: c.raw, r: c.r, g: c.g, b: c.b, a: c.a,
                blue: c.a > 0.02 && c.b > 150 && (c.b - Math.max(c.r, c.g)) > 40,
                green: c.a > 0.02 && c.g > c.b + 10 && c.g >= c.r - 20,
              });
            }
          }
        }
        return out;
      });
      /* 【fix12 起口径变更】.ju-xsel 不再绘制：块级底 / 渐变 / 内描边必须全部为零（单层化）。
         旧口径（fix11：块级层必须是产品绿）已被 fix12 取代，
         证据：90过程材料/tmp/fix12/selection_visual_before.log / selection_visual_after.log。 */
      expect(hits.filter((h) => h.a > 0.02).map((h) => h.raw),
        '.ju-xsel 不得再有任何可见底色/渐变/描边（fix12 单层化）').toEqual([]);
      const xselPaints = await page.evaluate(() => Array.from(document.querySelectorAll('#content .text.ju-xsel')).map((el) => {
        const cs = getComputedStyle(el);
        return { bgImage: cs.backgroundImage, bgColor: cs.backgroundColor, boxShadow: cs.boxShadow };
      }));
      expect(xselPaints.length, '跨行选区模型仍应覆盖 ≥2 块（.ju-xsel 仍打标）').toBeGreaterThanOrEqual(2);
      for (const x of xselPaints) {
        expect(x.bgImage, '.ju-xsel background-image 必须为 none').toBe('none');
        expect(x.boxShadow, '.ju-xsel box-shadow 必须为 none').toBe('none');
        expect(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/i.test(x.bgColor),
          `.ju-xsel 背景必须透明（实测 ${x.bgColor}）`).toBe(true);
      }

      /* ③ 【fix12 起口径变更】行容器不再承担选区高亮：.row.sel 是焦点行标记
         （src/views/outline.ts:403/:1083、src/ui/focus.ts:247-248），底色必须透明。
         旧口径（fix11：行底 == --accent-soft）会让整行 960×32 变绿而选区只有几个字，
         取证见 90过程材料/tmp/fix12/selection_visual_before.log（横向 37.6×、竖向 19.7×）。 */
      const rowState = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#content .row.sel, #content .row.multi-sel')) as HTMLElement[];
        return {
          count: rows.length,
          rows: rows.map((r) => ({
            cls: String(r.className || ''),
            bg: getComputedStyle(r).backgroundColor,
            bgImage: getComputedStyle(r).backgroundImage,
          })),
        };
      });
      expect(rowState.count, '焦点/选中行容器仍应存在（.row.sel 类本身不清除）').toBeGreaterThan(0);
      for (const r of rowState.rows) {
        expect(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/i.test(r.bg),
          `行容器 ${r.cls} 底色必须透明（实测 ${r.bg}）`).toBe(true);
        expect(r.bgImage, `行容器 ${r.cls} 不得有背景图/渐变（实测 ${r.bgImage}）`).toBe('none');
      }

      /* ④ 原生选区被约束在产品块内、不引入蓝色（跨行块内已置透明，避免双层深浅叠加） */
      const pseudo = await page.evaluate(() => {
        const parse = (s: string) => {
          const t = String(s || '').trim();
          let m = t.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.%]+))?\s*\)$/i);
          if (m) return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a: m[4] == null ? 1 : parseFloat(m[4]) };
          m = t.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i);
          if (m) return { r: parseFloat(m[1]) * 255, g: parseFloat(m[2]) * 255, b: parseFloat(m[3]) * 255, a: m[4] == null ? 1 : parseFloat(m[4]) };
          return null;
        };
        const bgOf = (el: Element | null) => {
          if (!el) return null;
          try { return getComputedStyle(el, '::selection').backgroundColor; } catch { return null; }
        };
        const sel = window.getSelection();
        const an = sel && sel.anchorNode ? sel.anchorNode : null;
        const ael = an ? (an.nodeType === 1 ? (an as Element) : an.parentElement) : null;
        const txt = document.querySelector('#content .text[contenteditable="true"]');
        return {
          selTextLen: sel ? String(sel.toString()).length : 0,
          anchorBg: bgOf(ael),
          anchorParsed: ael ? parse(getComputedStyle(ael, '::selection').backgroundColor) : null,
          textBg: bgOf(txt),
          textParsed: txt ? parse(getComputedStyle(txt, '::selection').backgroundColor) : null,
        };
      });
      expect(pseudo.selTextLen, '原生选区文本长度应 > 0（首块内保留）').toBeGreaterThan(0);
      for (const p of [pseudo.anchorParsed, pseudo.textParsed]) {
        if (!p) continue;
        const isBlue = p.a > 0.02 && p.b > 150 && (p.b - Math.max(p.r, p.g)) > 40;
        expect(isBlue, `::selection 不得为蓝色（实测 ${JSON.stringify(p)}）`).toBe(false);
        /* 【fix12】原生 ::selection 是唯一绿色来源 ⇒ 必须可见且为产品绿 */
        expect(p.a, `::selection 必须可见（不得透明，实测 ${JSON.stringify(p)}）`).toBeGreaterThan(0.02);
        expect(p.g > p.b + 10 && p.g >= p.r - 20,
          `::selection 必须是产品绿（实测 ${JSON.stringify(p)}）`).toBe(true);
      }
      if (pseudo.anchorBg && pseudo.textBg) {
        expect(pseudo.anchorBg,
          '.text.ju-xsel::selection 必须与 .text::selection 同色（fix12：消除双层深浅叠加）').toBe(pseudo.textBg);
      }

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('行内正常编辑：光标可见（caret-color 非透明、activeElement=正文块），且行内选中为产品绿', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      await buildRows(page);

      /* ① 点进正文块真实输入：光标必须在正文块内，且 caret-color 未被隐藏 */
      const target = page.locator(ROWS).first();
      await target.click();
      await page.keyboard.press('End');
      await page.keyboard.type(' 光标可见 FIX11', { delay: 8 });
      await page.waitForTimeout(250);

      /* 输入先是真实落在正文 DOM（产品在 blur 时才提交 state，见 views/outline.ts 的 .text blur 处理器） */
      const domText = await page.evaluate((sel) => {
        const t = document.querySelector(sel) as HTMLElement | null;
        return String((t && t.textContent) || '');
      }, ROWS);
      expect(domText, '键盘输入必须真实落到正文 DOM').toContain('光标可见 FIX11');

      const caret = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        const cs = active ? getComputedStyle(active) : null;
        return {
          tag: active ? active.tagName.toLowerCase() : null,
          cls: active ? String(active.className || '') : null,
          isText: !!(active && active.classList && active.classList.contains('text')),
          editable: active ? active.getAttribute('contenteditable') : null,
          caretColor: cs ? cs.caretColor : null,
          caretHidden: !!(cs && (/transparent/i.test(cs.caretColor) || /rgba\(0,\s*0,\s*0,\s*0\)/.test(cs.caretColor))),
        };
      });
      expect(caret.isText, 'activeElement 必须是正文块 .text').toBe(true);
      expect(caret.editable, '正文块必须处于可编辑态').toBe('true');
      expect(caret.caretColor, 'caret-color 必须有具体值').toBeTruthy();
      expect(caret.caretHidden, 'caret-color 不得为透明（光标必须可见）').toBe(false);

      /* 输入的 state 提交发生在 blur（views/outline.ts 的 .text blur 处理器）→ 在 ③ 段落失焦后断言 */

      /* ② 行内拖选：原生 ::selection 必须是产品绿、不得是系统蓝 */
      await dragInRow(page);
      const inRow = await page.evaluate(() => {
        const parse = (s: string) => {
          const t = String(s || '').trim();
          let m = t.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.%]+))?\s*\)$/i);
          if (m) return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a: m[4] == null ? 1 : parseFloat(m[4]) };
          m = t.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i);
          if (m) return { r: parseFloat(m[1]) * 255, g: parseFloat(m[2]) * 255, b: parseFloat(m[3]) * 255, a: m[4] == null ? 1 : parseFloat(m[4]) };
          return null;
        };
        const sel = window.getSelection();
        const an = sel && sel.anchorNode ? sel.anchorNode : null;
        const ael = an ? (an.nodeType === 1 ? (an as Element) : an.parentElement) : null;
        const raw = ael ? getComputedStyle(ael, '::selection').backgroundColor : null;
        return { selTextLen: sel ? String(sel.toString()).length : 0, raw, parsed: raw ? parse(raw) : null };
      });
      expect(inRow.selTextLen, '行内拖选必须选中文本').toBeGreaterThan(0);
      expect(inRow.raw, '行内 ::selection 背景必须能读到 computed 值').toBeTruthy();
      const p = inRow.parsed!;
      expect(p.a, '行内 ::selection 不得透明（否则看不到选区）').toBeGreaterThan(0.02);
      expect(p.b > 150 && (p.b - Math.max(p.r, p.g)) > 40, `行内 ::selection 不得为蓝色（实测 ${inRow.raw}）`).toBe(false);
      expect(p.g > p.b + 10 && p.g >= p.r - 20, `行内 ::selection 必须是产品绿（实测 ${inRow.raw}）`).toBe(true);

      /* ③ 失焦提交 + 拖选后光标仍可回到正文块（不清空可见性） */
      await clickRow(page, 1);
      await page.waitForTimeout(400);
      const stateText = await page.evaluate(() => {
        const JU: any = (window as any).JU;
        const st = JU.getState();
        const nodes = st && st.nodes ? Object.keys(st.nodes).map((k) => st.nodes[k]) : [];
        return nodes.map((n: any) => String((n && n.text) || '')).join('\n');
      });
      expect(stateText, '失焦后键盘输入必须写入产品 state（不是只改 DOM）').toContain('光标可见 FIX11');

      const back = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        return {
          isText: !!(active && active.classList && active.classList.contains('text')),
          caretColor: active ? getComputedStyle(active).caretColor : null,
        };
      });
      expect(back.isText, '拖选后点回正文块，activeElement 仍须是 .text').toBe(true);
      expect(/transparent|rgba\(0,\s*0,\s*0,\s*0\)/i.test(String(back.caretColor)), 'caret-color 不得变为透明').toBe(false);

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
