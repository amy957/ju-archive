import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix13 · 大纲视图「拖选高亮必须精确到字符」
 *
 * 缺陷与取证（90过程材料/tmp/fix13/exact_selection_before.log，fix12 发布版 sha256 ca8e1502…eceec，
 * Edge 真窗口 file:// 真实竖向拖选「第 1 行中间几个字 → 第 3 行中间几个字」）：
 *   · window.getSelection().getRangeAt(0).getClientRects() = 1 个、width=0（collapsed）
 *     ⇒ Blink 把原生 Selection 钳在单个 contenteditable 宿主内，跨行选区**没有任何原生绘制**；
 *   · 产品模型 covered=3，逐块字符矩形为 356..532 / 273..495 / 273..416；
 *   · fix12 已把 .text.ju-xsel 与 .row.sel 全部清零（单层化），于是「拖选 3 行后屏幕上一个绿色像素都没有」
 *     —— 绿色区域 = 空集，仍然 ≠ 选区区域。
 *
 * fix13 契约（src/ui/xselect.ts + src/style.css 末尾 fix13 段）：
 *   ① 新增 fixed 覆盖层 #ju-xsel-overlay（pointer-events:none）；
 *   ② 模型每块 Range → getClientRects() → 每个字符矩形一个 .ju-xsel-block（原值 left/top/width/height）；
 *   ③ 渲染前扣掉「原生选区已绘制区间」，避免原生绿 + overlay 绿双层叠深；
 *   ④ 行容器 / 文本块继续零绘制 ⇒ 行首手柄与行尾日期不可能被染色；
 *   ⑤ 取消选中 / 删除文字 / 模型清空 ⇒ overlay 必须清空。
 *
 * 本 spec 口径：真实鼠标拖选、真实键盘，读真实 DOM computed 样式与几何，不注入内联 style、不改夹具
 * （承载方式与 fix7 / fix11 / fix12 spec 一致：vite build + context.route 提供 dist）。
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

async function gotoOutline(page: Page): Promise<void> {
  const btn = page.locator('#tbNav .tb-nav-btn[data-view="outline"]').first();
  await expect(btn, '顶栏必须有大纲入口').toHaveCount(1, { timeout: 20_000 });
  await btn.click();
  await expect(page.locator('#content .outline')).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(400);
}

/** 真实键盘建多行（与 fix12 spec 同口径） */
async function buildRows(page: Page): Promise<number> {
  const first = page.locator(ROWS).first();
  await first.click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('第1行 FIX13 精确选区 ABCDEFGHIJ', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第2行 FIX13 精确选区 KLMNOPQRST', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第3行 FIX13 精确选区 UVWXYZ0123', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第4行 FIX13 精确选区 456789abcd', { delay: 6 });
  await page.waitForTimeout(400);
  let n = await page.locator(ROWS).count();
  if (n < 3) {
    await page.evaluate(() => {
      const JU: any = (window as any).JU;
      const st = JU.getState();
      const docId = (st.ui && st.ui.currentDocId) || st.rootId;
      ['第5行 FIX13 追加 A', '第6行 FIX13 追加 B'].forEach((t: string) => JU.actions.addNode(docId, null, { text: t }));
      if (typeof JU.forceRender === 'function') JU.forceRender();
    });
    await page.waitForTimeout(500);
    n = await page.locator(ROWS).count();
  }
  return n;
}

/**
 * 竖向拖选：第 1 行**中间几个字** → 第 3 行**中间几个字**。
 * 端点按「文字内容盒」换算（.text 是块盒、被拉伸到整行，用块宽会掉进行尾空白）。
 */
async function dragVerticalMiddle(page: Page): Promise<{ start: { x: number; y: number }; end: { x: number; y: number } }> {
  const ext = await page.evaluate((sel) => {
    const rows = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    const ext1 = (el: HTMLElement) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const b = r.getBoundingClientRect();
      return { l: b.left, t: b.top, w: b.width, h: b.height };
    };
    return { a: ext1(rows[0]), b: ext1(rows[Math.min(2, rows.length - 1)]) };
  }, ROWS);
  const start = { x: ext.a.l + ext.a.w * 0.35, y: ext.a.t + ext.a.h / 2 };
  const end = { x: ext.b.l + ext.b.w * 0.60, y: ext.b.t + ext.b.h / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 24 });
  await page.mouse.up();
  await page.waitForTimeout(350);
  return { start, end };
}

/** 点空白取消选区（真实鼠标点 #content 底部空白） */
async function clickBlank(page: Page): Promise<void> {
  const pt = await page.evaluate(() => {
    const el = document.querySelector('#content') as HTMLElement;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.bottom - 6) };
  });
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(300);
}

/** 统一读取：overlay 块 / 行容器 / 文本块 / 模型 */
const READ = () => {
  const parseC = (s: string) => {
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
  const colorsOf = (s: string) => {
    const out: any[] = [];
    const re = /rgba?\([^)]*\)|color\(srgb[^)]*\)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(String(s || '')))) { const c = parseC(m[0]); if (c) out.push(c); }
    return out;
  };
  const vis = (c: any) => !!c && c.a > 0.02;
  const R = (el: Element) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; };
  const overlap = (a: any, b: any) => {
    const w = Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l);
    const h = Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t);
    return w > 0 && h > 0;
  };

  const ov = document.getElementById('ju-xsel-overlay');
  const blocks = ov ? Array.from(ov.querySelectorAll('.ju-xsel-block')) as HTMLElement[] : [];
  const rowsEls = Array.from(document.querySelectorAll('#content .row')) as HTMLElement[];
  const textsEls = Array.from(document.querySelectorAll('#content .text[contenteditable="true"]')) as HTMLElement[];

  return {
    overlayExists: !!ov,
    overlayDisplay: ov ? getComputedStyle(ov).display : null,
    overlayPointerEvents: ov ? getComputedStyle(ov).pointerEvents : null,
    blockCount: blocks.length,
    blocks: blocks.map((el) => {
      const cs = getComputedStyle(el);
      return {
        id: String(el.dataset.id || ''), rect: R(el), bg: cs.backgroundColor, parsed: parseC(cs.backgroundColor),
        paints: vis(parseC(cs.backgroundColor)),
      };
    }),
    rows: rowsEls.map((el) => {
      const cs = getComputedStyle(el);
      const h = el.querySelector('.drag-handle');
      const d = el.querySelector('.row-actions .mtime-tag');
      return {
        cls: String(el.className || ''), bg: cs.backgroundColor, bgImage: cs.backgroundImage,
        paints: vis(parseC(cs.backgroundColor)) || colorsOf(cs.backgroundImage).some(vis),
        rect: R(el), handle: h ? R(h) : null, date: d ? R(d) : null,
      };
    }),
    texts: textsEls.map((el) => {
      const cs = getComputedStyle(el);
      return {
        id: String(el.dataset.id || ''), cls: String(el.className || ''),
        bg: cs.backgroundColor, bgImage: cs.backgroundImage, boxShadow: cs.boxShadow,
        paints: vis(parseC(cs.backgroundColor)) || colorsOf(cs.backgroundImage).some(vis),
        rect: R(el),
      };
    }),
    model: (window as any).__juXsel && typeof (window as any).__juXsel.describe === 'function'
      ? (window as any).__juXsel.describe() : null,
    selLen: (() => { const s = window.getSelection(); return s ? String(s.toString()).length : 0; })(),
    overlapsHandle: blocks.filter((b) => rowsEls.some((r) => { const h = r.querySelector('.drag-handle'); return !!h && overlap(R(b), R(h)); })).length,
    overlapsDate: blocks.filter((b) => rowsEls.some((r) => { const d = r.querySelector('.row-actions .mtime-tag'); return !!d && overlap(R(b), R(d)); })).length,
  };
};

const isTransparent = (s: string) => /rgba\(0,\s*0,\s*0,\s*0\)|transparent/i.test(String(s || '').trim());
const isGreen = (c: any) => !!c && c.a > 0.02 && c.g > c.b + 8 && c.g >= c.r - 24;

test.describe('v2.1 fix13 · 大纲拖选 · 高亮精确到字符（Overlay）', () => {
  test('竖向拖选第 1 行中间 → 第 3 行中间：.ju-xsel-block 存在且为产品绿，行容器/文本块仍透明', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      const rows = await buildRows(page);
      expect(rows, '必须建立 ≥3 行正文').toBeGreaterThanOrEqual(3);

      const drag = await dragVerticalMiddle(page);
      expect(drag.end.y, '拖选必须真的跨行（终点在第 3 行）').toBeGreaterThan(drag.start.y + 20);

      const r = await page.evaluate(READ);

      /* ① overlay 存在且透明穿透（不吃事件、不挡拖拽） */
      expect(r.overlayExists, '#ju-xsel-overlay 必须由 xselect 挂载').toBe(true);
      expect(r.overlayPointerEvents, 'overlay 必须 pointer-events:none').toBe('none');

      /* ② 多个 .ju-xsel-block（跨 3 行拖选至少 2 段被 overlay 补充绘制；原生覆盖的那段可能被扣掉） */
      expect(r.blockCount, '.ju-xsel-block 数量必须 > 0').toBeGreaterThan(0);
      for (const b of r.blocks) {
        expect(b.id, '.ju-xsel-block 必须带模型块 id').not.toBe('');
        expect(isGreen(b.parsed), `.ju-xsel-block 必须是产品绿（实测 ${b.bg}）`).toBe(true);
        expect(b.rect.w, '.ju-xsel-block 宽度必须 > 0').toBeGreaterThan(0);
        expect(b.rect.h, '.ju-xsel-block 高度必须 > 0').toBeGreaterThan(0);
      }

      /* ③ 行容器背景必须透明（.row.sel 是焦点行标记，不是选区高亮） */
      for (const row of r.rows) {
        expect(isTransparent(row.bg), `行容器 ${row.cls} 底色必须透明（实测 ${row.bg}）`).toBe(true);
        expect(row.bgImage, `行容器 ${row.cls} 不得有 background-image`).toBe('none');
      }
      /* ④ 文本块背景必须透明（块级高亮已彻底移除，仍保留 .ju-xsel 作为零绘制模型标记） */
      for (const t of r.texts) {
        expect(isTransparent(t.bg), `文本块 ${t.id} 底色必须透明（实测 ${t.bg}）`).toBe(true);
        expect(t.bgImage, `文本块 ${t.id} background-image 必须为 none`).toBe('none');
        expect(t.boxShadow, `文本块 ${t.id} box-shadow 必须为 none`).toBe('none');
      }

      /* ⑤ 行首手柄 / 行尾日期不得被 overlay 覆盖（绿色只能出现在文字上） */
      expect(r.overlapsHandle, 'overlay 不得覆盖行首手柄 .drag-handle').toBe(0);
      expect(r.overlapsDate, 'overlay 不得覆盖行尾日期 .mtime-tag').toBe(0);

      /* ⑥ 模型仍覆盖 ≥2 块（跨行模型未被破坏） */
      expect(r.model && r.model.covered, '跨行选区模型应覆盖 ≥2 块').toBeGreaterThanOrEqual(2);
      expect(await page.locator('#content .row.multi-sel').count(), '不得退化为节点多选').toBe(0);

      expect(pageErrors, '拖选过程不得有页面错误').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('取消选中（点空白）：.ju-xsel-block 数量归零，模型清空', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      await buildRows(page);
      await dragVerticalMiddle(page);
      const before = await page.evaluate(READ);
      expect(before.blockCount, '前置条件：拖选后必须有 overlay 块').toBeGreaterThan(0);

      await clickBlank(page);
      const after = await page.evaluate(READ);

      expect(after.blockCount, '点空白后 .ju-xsel-block 数量必须为 0').toBe(0);
      expect(after.overlayDisplay === 'none' || after.blockCount === 0, 'overlay 必须隐藏').toBe(true);
      expect(after.model && after.model.covered, '点空白后模型必须清空').toBe(0);
      for (const row of after.rows) {
        expect(isTransparent(row.bg), `取消选中后行容器 ${row.cls} 仍须透明`).toBe(true);
      }
      expect(pageErrors, '取消选中过程不得有页面错误').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('跨行删除（Backspace）后 overlay 必须清空', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      await buildRows(page);
      await dragVerticalMiddle(page);
      const before = await page.evaluate(READ);
      expect(before.blockCount, '前置条件：拖选后必须有 overlay 块').toBeGreaterThan(0);

      await page.keyboard.press('Backspace');
      await page.waitForTimeout(400);
      const after = await page.evaluate(READ);

      expect(after.blockCount, '删除文字后 overlay 必须清空').toBe(0);
      expect(after.model && after.model.covered, '删除文字后模型必须清空').toBe(0);
      expect(pageErrors, '删除过程不得有页面错误').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('精确性：overlay 只覆盖被选中的字符（宽度 < 行内容宽，且首段不覆盖行首手柄）', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      await buildRows(page);
      await dragVerticalMiddle(page);
      const r = await page.evaluate(READ);
      expect(r.blockCount, '前置条件：必须有 overlay 块').toBeGreaterThan(0);

      /* 行内容宽 = .row 宽度减去行首手柄与行尾 actions；
         overlay 块宽度必须明显小于整行（证明不是整行染色） */
      for (const b of r.blocks) {
        const row = r.rows.find((x) => b.rect.t >= x.rect.t - 1 && b.rect.t <= x.rect.t + x.rect.h);
        expect(row, '每个 overlay 块必须落在某一行内').toBeTruthy();
        if (!row) continue;
        expect(b.rect.w, `overlay 块宽 ${Math.round(b.rect.w)} 不得接近整行宽 ${Math.round(row.rect.w)}`)
          .toBeLessThan(row.rect.w - 40);
        if (row.handle) {
          expect(b.rect.l, 'overlay 块左边界必须在行首手柄右侧').toBeGreaterThanOrEqual(row.handle.l + row.handle.w - 1);
        }
      }
      /* 首段左边界必须落在文字内部（拖选起点在行内中部，不是行首） */
      const first = r.blocks[0];
      const firstRow = r.rows.find((x) => first.rect.t >= x.rect.t - 1 && first.rect.t <= x.rect.t + first.rect.h);
      if (firstRow && firstRow.handle) {
        expect(first.rect.l - (firstRow.handle.l + firstRow.handle.w), '首段必须从行内中部开始（不得从行首起）').toBeGreaterThan(20);
      }
      expect(pageErrors, '精确性校验过程不得有页面错误').toEqual([]);
    } finally {
      await context.close();
    }
  });
});
