import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 第八轮（fix7）· 富文本「跨行」机制回归
 *
 * 缺陷背景（本轮实测取证）：
 *   Blink（Edge 155 / WebView2 同源）不允许 `Selection` 跨「编辑宿主」——
 *     ① 编程式把 Range 从第 1 个 `.text` 建到第 3 个 `.text`，读回只覆盖首块；
 *     ② 把 `#content` 克隆到 body（零监听）后同样鼠标拖选，仍只覆盖首块；
 *     ③ 两个裸 contenteditable 拖选，仍只覆盖首块。
 *   证据：90过程材料/tmp_compare/fix7/richtext_capability.log
 *         （RT_MULTILINE_CAPABILITY_VERDICT: SINGLE_HOST_CLAMPED）
 *   修复前四项用户行为全失：纵向拖过正文 ⇒ 文本选区消失并刷选整行；Shift+↓ ⇒ 整块跳转；
 *   跨行上色 / 跨行 Backspace 无从谈起。
 *   证据：90过程材料/tmp_compare/fix7/richtext_multiline_before.log
 *         （RT_MULTILINE_BEFORE_VERDICT: REPRODUCED）
 *
 * 本轮修复（产品侧跨行选区模型 src/ui/xselect.ts）：
 *   · `.text` 内 mousedown ⇒ 不再进节点多选刷选，改为「锚点块+偏移 → 焦点块+偏移」模型；
 *   · 覆盖块加 `.ju-xsel` 高亮（background-image，避免被格式引擎写进正文内联样式）；
 *   · 工具栏（颜色 / 背景 / 字号 / 加粗…）按模型**逐块**套样式；
 *   · Backspace 按模型逐块删除；Shift+↑/↓ 扩展焦点块；Esc / 点空白取消。
 *   同源证据：90过程材料/tmp_compare/fix7/richtext_multiline_after.log
 *            （RT_MULTILINE_AFTER_VERDICT: FIXED）
 *
 * 本 spec 的口径：真实鼠标 / 真实键盘 / 真实工具栏点击，断言读 DOM + 产品选区模型 + state。
 */
const BASE = 'http://localhost:5173';

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

const ROWS = '#content .text[contenteditable="true"]';
const LINE_TEXT = (i: number) => '第' + (i + 1) + '行 FIX7 跨行文本 ABCDEFGHIJ';

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
    return !!(w.JU && typeof w.JU.applyInlineStyle === 'function' && w.JU.actions && typeof w.JU.actions.addNode === 'function');
  });
  return { context, page, pageErrors };
}

/** 夹具：用**产品自身**的 actions.addNode 建 6 个正文节点（同源数据，forceRender 后即为真实 DOM）。 */
async function mountRows(page: Page): Promise<string[]> {
  await page.evaluate(() => {
    const sb = document.getElementById('sidebarRight');
    if (sb) sb.classList.remove('collapsed');
    const lb = document.getElementById('sidebarLeft');
    if (lb) lb.classList.remove('collapsed');
  });
  const ids = await page.evaluate((texts: string[]) => {
    const JU: any = (window as any).JU;
    const st = JU.getState();
    const docId = (st.ui && st.ui.currentDocId) || st.rootId;
    const out: string[] = [];
    texts.forEach((t) => {
      const id = JU.actions.addNode(docId, null, { text: t });
      if (id) out.push(id);
    });
    if (typeof JU.forceRender === 'function') JU.forceRender();
    return out;
  }, [0, 1, 2, 3, 4, 5].map(LINE_TEXT));
  await page.waitForTimeout(400);
  return ids;
}

/** 记录选区内每块的文本偏移信息（重置光标用：点首行文本中部，避开 .drag-handle）。 */
async function resetCaret(page: Page, rowIndex = 0): Promise<void> {
  await page.keyboard.press('Escape').catch(() => { });
  await page.evaluate(() => { const s = window.getSelection(); if (s) s.removeAllRanges(); });
  const pt = await page.evaluate(({ sel, i }) => {
    const rows = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    const r = rows[i].getBoundingClientRect();
    return { x: r.left + Math.min(50, r.width / 2), y: r.top + r.height / 2 };
  }, { sel: ROWS, i: rowIndex });
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(120);
}

/** 鼠标从第 1 行拖到第 3 行（真实 mouse.down/move/up）。 */
async function dragRows13(page: Page): Promise<void> {
  const geo = await page.evaluate((sel) => {
    const rows = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    const r0 = rows[0].getBoundingClientRect();
    const r2 = rows[2].getBoundingClientRect();
    return {
      startX: r0.left + 4, startY: r0.top + r0.height / 2,
      endX: r2.left + Math.min(200, r2.width - 4), endY: r2.top + r2.height / 2,
    };
  }, ROWS);
  await page.mouse.move(geo.startX, geo.startY);
  await page.mouse.down();
  await page.mouse.move(geo.endX, geo.endY, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

interface XSelInfo { active: boolean; covered: number; ids: string[]; anchor: any; focus: any; }

async function readModel(page: Page): Promise<XSelInfo | null> {
  return page.evaluate(() => {
    const x = (window as any).__juXsel;
    if (!x || typeof x.describe !== 'function') return null;
    return x.describe();
  });
}

async function rowHtml(page: Page): Promise<string[]> {
  return page.evaluate((sel) => (Array.from(document.querySelectorAll(sel)) as HTMLElement[]).map((e) => e.innerHTML), ROWS);
}

test.describe('v2.1 fix7 · 富文本跨行机制', () => {
  test('跨行机制 · 鼠标拖选第 1 行到第 3 行得到跨块选区（高亮 ≥2 块，且不进节点多选）', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await mountRows(page);
      await resetCaret(page);
      await dragRows13(page);

      const model = await readModel(page);
      expect(model, '跨行选区模型必须存在（window.__juXsel）').not.toBeNull();
      expect(model!.covered, '拖选应覆盖 ≥2 个正文块').toBeGreaterThanOrEqual(2);

      const hl = await page.evaluate((sel) => (document.querySelectorAll(sel + '.ju-xsel') as NodeListOf<HTMLElement>).length, '#content .text');
      expect(hl, '覆盖块应带 .ju-xsel 高亮').toBeGreaterThanOrEqual(2);

      /* 反向断言：跨行文本拖选不得再被「节点多选」抢走 */
      expect(await page.locator('#content .row.multi-sel').count(), '不得出现节点多选行').toBe(0);
      expect(await page.locator('.outline-selbar').count(), '不得出现「已选 N 个节点」工具条').toBe(0);

      /* 选区文本仍非空（首块内原生选区保留，跨块部分由模型承载） */
      const selLen = await page.evaluate(() => String(window.getSelection() ? window.getSelection()!.toString() : '').length);
      expect(selLen).toBeGreaterThan(0);
      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('跨行机制 · Shift+↓ 连按 2 次跨块扩选（不再整块跳转）', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await mountRows(page);
      await resetCaret(page);
      await page.keyboard.press('Shift+ArrowDown');
      await page.waitForTimeout(120);
      await page.keyboard.press('Shift+ArrowDown');
      await page.waitForTimeout(200);

      const model = await readModel(page);
      expect(model, 'Shift+↓ 必须建立跨行选区模型').not.toBeNull();
      expect(model!.covered, 'Shift+↓×2 应覆盖 ≥2 块').toBeGreaterThanOrEqual(2);

      /* 旧缺陷表现 = 焦点被整块搬走（activeElement 变成另一块且模型为空）；这里断言模型在、且没被搬走 */
      const activeIsText = await page.evaluate(() => {
        const ae = document.activeElement as HTMLElement | null;
        return !!(ae && ae.classList && ae.classList.contains('text'));
      });
      expect(activeIsText, '焦点应仍在正文块内').toBe(true);
      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('跨行机制 · 跨行点颜色：覆盖的每一块都写入 color 内联样式', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await mountRows(page);
      await resetCaret(page);
      await dragRows13(page);
      const model = await readModel(page);
      expect(model!.covered).toBeGreaterThanOrEqual(2);

      const btn = page.locator('[data-cmd="color"]').first();
      const box = await btn.boundingBox();
      expect(box, '工具栏颜色按钮必须可点').not.toBeNull();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await expect(page.locator('.color-picker')).toHaveCount(1);

      const sw = page.locator('.color-picker .cp-swatch:not(.cp-transparent)').first();
      const sbox = await sw.boundingBox();
      expect(sbox, '色板必须含非透明色块').not.toBeNull();
      await page.mouse.click(sbox!.x + sbox!.width / 2, sbox!.y + sbox!.height / 2);
      await page.waitForTimeout(400);

      await expect
        .poll(async () => (await rowHtml(page)).filter((h) => /style="[^"]*color:/.test(h)).length, { timeout: 8000 })
        .toBeGreaterThanOrEqual(model!.covered);

      /* 高亮色不得被写进正文（曾经用 background-color 做高亮，会被格式引擎读取并写进 span） */
      const html = await rowHtml(page);
      expect(html.join('\n')).not.toContain('rgba(64, 132, 255');
      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('跨行机制 · 跨行 Backspace 删除选中范围（逐块生效）', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      const ids = await mountRows(page);
      await resetCaret(page);
      await dragRows13(page);
      const model = await readModel(page);
      expect(model!.covered).toBeGreaterThanOrEqual(2);
      const coveredIds = model!.ids.slice();

      await page.keyboard.press('Backspace');
      await page.waitForTimeout(500);

      const texts = await page.evaluate((list: string[]) => {
        const JU: any = (window as any).JU;
        const st = JU.getState();
        return list.map((id) => String((st.nodes[id] || {}).text || ''));
      }, coveredIds);
      coveredIds.forEach((id, i) => {
        expect(texts[i], '被选中的块必须发生删除（' + id + '）').not.toBe(LINE_TEXT(ids.indexOf(id)));
      });
      const untouched = ids[coveredIds.length];
      if (untouched) {
        const kept = await page.evaluate((id: string) => String(((window as any).JU.getState().nodes[id] || {}).text || ''), untouched);
        expect(kept, '未被选中的块保持不变').toBe(LINE_TEXT(ids.indexOf(untouched)));
      }
      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('跨行机制 · 跨行选过一次后单行操作不受影响（只改该行，其他行不变）', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await mountRows(page);
      /* ① 先做一次跨行拖选 */
      await resetCaret(page);
      await dragRows13(page);
      expect((await readModel(page))!.covered).toBeGreaterThanOrEqual(2);

      /* ② 点空白取消（Esc 同义），断言模型已清除 */
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      const afterEsc = await readModel(page);
      expect(afterEsc && afterEsc.active ? afterEsc.covered : 0, 'Esc 后不应仍有跨行选区').toBeLessThan(2);

      /* ③ 单行内横向选中（原生选区） */
      const geo = await page.evaluate((sel) => {
        const rows = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
        const r = rows[1].getBoundingClientRect();
        return { y: r.top + r.height / 2, x1: r.left + 4, x2: r.left + Math.min(120, r.width - 4) };
      }, ROWS);
      await page.mouse.move(geo.x1, geo.y);
      await page.mouse.down();
      await page.mouse.move(geo.x2, geo.y, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      const model2 = await readModel(page);
      expect(model2 && model2.active, '单行内选择不应激活跨行模型').toBe(false);

      /* ④ 点颜色 → 只有第 2 行被改 */
      const btn = page.locator('[data-cmd="color"]').first();
      const box = await btn.boundingBox();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await expect(page.locator('.color-picker')).toHaveCount(1);
      const sw = page.locator('.color-picker .cp-swatch:not(.cp-transparent)').first();
      const sbox = await sw.boundingBox();
      await page.mouse.click(sbox!.x + sbox!.width / 2, sbox!.y + sbox!.height / 2);
      await page.waitForTimeout(400);

      const html = await rowHtml(page);
      expect(html[1], '第 2 行应写入 color 内联样式').toMatch(/style="[^"]*color:/);
      expect(html[0], '第 1 行不得被改').not.toMatch(/style="[^"]*color:/);
      expect(html[2], '第 3 行不得被改').not.toMatch(/style="[^"]*color:/);
      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
