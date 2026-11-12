import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix13-patch1 · 拖选高亮 Overlay 的「滚动同步 / 节点池复用 / 选区清理」
 *
 * 前置取证（90过程材料/tmp/fix13-patch1/overlay_scroll_before.log，fix13 发布产物
 * JU-v2.1-Web.html sha256 c3ba27bd…ce7a，Edge 真窗口 file:// 真拖选 + 真滚轮）：
 *   · S 滚动同步：fix13 已 OK（window capture 的 scroll 监听会重算一次），本批改成 rAF 合并后
 *     仍需保证「滚动后每个 .ju-xsel-block 与文字的实时 client rect 对齐」不退化；
 *   · N 节点池：fix13 每帧 `box.textContent=''` + 新建 div，**无复用端口**，DOM 数量恒定但每帧重建
 *     ⇒ before 记为 NO-POOL-PORT，无法证明复用；
 *   · G 幽灵高亮：拖选后直接键盘输入字符，fix13 的 3 个可见块**仍在**（模型 covered=3 未被清）
 *     ⇒ 高亮残留在已失效的偏移上（幽灵高亮）。本批 before 实测 PRESENT、after 实测 NONE。
 *
 * fix13-patch1 契约（src/ui/xselect.ts + src/style.css）：
 *   ① 重绘走 requestAnimationFrame 合并（cancel 旧帧 → 挂新帧），滚动 / resize / 拖拽 mousemove
 *      不再逐事件同步重排；
 *   ② 节点池：块只创建一次并复用，只写 left/top/width/height，本轮用不到的块 display:none
 *      （**不重建、不 innerHTML=''**）；
 *   ③ 滚动 / resize / selectionchange 一律 scheduleRepaint()，下一帧重新 getClientRects()；
 *   ④ beforeinput / input / 可打印字符 keydown ⇒ 立刻 xselClear()（清模型 + 可见块归零）；
 *   ⑤ overlay z-index 9999 → 5（仍是 pointer-events:none 的独立图层，不挡事件、不盖浮层）。
 *
 * 本 spec 口径：真实鼠标拖选、真实滚轮、真实键盘，读真实 DOM computed 样式与几何，
 * 不注入内联样式、不改夹具（承载方式与 fix7 / fix11 / fix12 / fix13 spec 一致：vite build + context.route）。
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

let distDir = '';

test.beforeAll(async () => {
  distDir = await ensureDist();
});

async function openApp(browser: Browser): Promise<{ context: BrowserContext; page: Page; pageErrors: string[] }> {
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await installDistRoute(context, distDir);
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

/** 真实键盘建 4 行 + 追加 40 行（真实 Enter 建行，撑出 #content 的滚动条） */
async function buildRows(page: Page): Promise<number> {
  const first = page.locator(ROWS).first();
  await first.click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('第1行 FIX13P 同步 ABCDEFGHIJKLMN', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第2行 FIX13P 同步 OPQRSTUVWXYZ', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第3行 FIX13P 同步 abcdefghijkl', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第4行 FIX13P 同步 mnopqrstuvwx', { delay: 6 });
  for (let i = 1; i <= 40; i++) {
    await page.keyboard.press('Enter');
    await page.keyboard.type('SCROLL ' + i + ' 滚动同步验收 ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789', { delay: 0 });
  }
  await page.waitForTimeout(700);
  return page.locator(ROWS).count();
}

/** 正文滚动容器（#content 是 overflow-y:auto；用真实滚轮滚回顶部） */
async function scrollToTop(page: Page): Promise<number> {
  const c = await page.evaluate(() => {
    const el = document.querySelector('#content') as HTMLElement;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  await page.mouse.move(c.x, c.y);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -1200);
  await page.waitForTimeout(260);
  return page.evaluate(() => (document.querySelector('#content') as HTMLElement).scrollTop);
}

/** 竖向拖选：第 1 行中间几个字 → 第 3 行中间几个字（真实鼠标） */
async function dragVerticalMiddle(page: Page): Promise<{ start: { x: number; y: number }; end: { x: number; y: number } }> {
  /* 先清原生选区：否则在已有选区上按下并拖动会被浏览器当成拖放（drag & drop），改动正文 */
  await page.evaluate(() => { try { const s = window.getSelection(); if (s) s.removeAllRanges(); } catch { /* ignore */ } });
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
  const end = { x: ext.b.l + ext.b.w * 0.6, y: ext.b.t + ext.b.h / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 24 });
  await page.mouse.up();
  await page.waitForTimeout(320);
  return { start, end };
}

/**
 * 统一读取（滚动同步 / 节点池 / 幽灵高亮共用一份口径）：
 *   · 每个 .ju-xsel-block 与其 dataset(id/from/to) 反算出的**实时** Range 矩形求最近距离，
 *     ≤ 2px 记为对齐；
 *   · visibleBlocks = display 不为 none 的块（池里隐藏的块不算高亮）；
 *   · overlayStats 来自 window.__juXsel.overlayStats()（fix13-patch1 只读诊断端口）。
 */
const READ = () => {
  const hosts = Array.from(document.querySelectorAll('#content .text[contenteditable="true"]')) as HTMLElement[];
  const ov = document.getElementById('ju-xsel-overlay');
  const blocks = ov ? (Array.from(ov.querySelectorAll('.ju-xsel-block')) as HTMLElement[]) : [];
  const model = (window as any).__juXsel && typeof (window as any).__juXsel.describe === 'function'
    ? (window as any).__juXsel.describe() : null;
  const stats = (window as any).__juXsel && typeof (window as any).__juXsel.overlayStats === 'function'
    ? (window as any).__juXsel.overlayStats() : null;

  const atIn = (host: HTMLElement, off: number): [any, number] => {
    const w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
    const nodes: any[] = [];
    let n: any = w.nextNode();
    while (n) { nodes.push(n); n = w.nextNode(); }
    let remain = Math.max(0, off);
    let last: any = null;
    for (const nd of nodes) {
      const len = String(nd.nodeValue || '').length;
      if (remain <= len) return [nd, remain];
      remain -= len; last = nd;
    }
    return last ? [last, String(last.nodeValue || '').length] : [host, 0];
  };
  const rectsOf = (id: string, from: number, to: number) => {
    const host = hosts.find((b) => String(b.dataset.id || '') === id);
    if (!host) return [] as { l: number; t: number }[];
    try {
      const a = atIn(host, from), b = atIn(host, to);
      const r = document.createRange();
      r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]);
      return Array.from(r.getClientRects()).map((x) => ({ l: x.left, t: x.top }));
    } catch { return [] as { l: number; t: number }[]; }
  };

  const details = blocks.map((el) => {
    const br = el.getBoundingClientRect();
    const live = rectsOf(String(el.dataset.id || ''), Number(el.dataset.from || 0), Number(el.dataset.to || 0));
    let nearest: number | null = null;
    for (const r of live) {
      const d = Math.hypot(r.l - br.left, r.t - br.top);
      if (nearest === null || d < nearest) nearest = d;
    }
    return {
      top: br.top, left: br.left, w: br.width, h: br.height,
      styleTop: el.style.top, display: getComputedStyle(el).display,
      nearestDelta: nearest,
    };
  });
  const visible = details.filter((d) => d.display !== 'none');
  const maxDelta = visible.reduce((m, d) => (d.nearestDelta !== null && d.nearestDelta > m ? d.nearestDelta : m), 0);
  return {
    overlayExists: !!ov,
    overlayPointerEvents: ov ? getComputedStyle(ov).pointerEvents : null,
    overlayZIndex: ov ? parseInt(getComputedStyle(ov).zIndex || '0', 10) : null,
    overlayDisplay: ov ? getComputedStyle(ov).display : null,
    domBlocks: blocks.length,
    visibleBlocks: visible.length,
    maxDelta,
    firstTop: visible.length ? visible[0].top : null,
    firstStyleTop: visible.length ? visible[0].styleTop : null,
    firstRect: visible.length ? { l: visible[0].left, t: visible[0].top, w: visible[0].w, h: visible[0].h } : null,
    model,
    stats,
    scrollTop: (() => {
      const el = document.querySelector('#content') as HTMLElement | null;
      return el ? el.scrollTop : -1;
    })(),
  };
};

test.describe('v2.1 fix13-patch1 · Overlay 滚动同步 / 节点池 / 选区清理', () => {
  test('拖选后滚动页面：高亮块 top 随文字同步移动且仍与选中文字对齐', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      const rows = await buildRows(page);
      expect(rows, '必须建立 ≥4 行正文').toBeGreaterThanOrEqual(4);
      expect(await scrollToTop(page), '前置：正文滚动容器需能滚回顶部').toBe(0);

      const drag = await dragVerticalMiddle(page);
      expect(drag.end.y, '拖选必须真的跨行（终点在第 3 行）').toBeGreaterThan(drag.start.y + 20);

      const before = await page.evaluate(READ);
      expect(before.overlayExists, '#ju-xsel-overlay 必须存在').toBe(true);
      expect(before.overlayPointerEvents, 'overlay 必须 pointer-events:none（不挡事件/光标）').toBe('none');
      expect(before.overlayZIndex, 'overlay 层级必须低于浮层（< 1000），不得遮挡菜单/模态').toBeLessThan(1000);
      expect(before.visibleBlocks, '拖选后必须有可见高亮块').toBeGreaterThan(0);
      expect(before.model && before.model.covered, '跨行模型必须覆盖 ≥2 块').toBeGreaterThanOrEqual(2);
      expect(before.maxDelta, `拖选后每个高亮块必须与文字对齐（实测 maxDelta=${before.maxDelta}px）`).toBeLessThanOrEqual(2);

      /* 真实滚轮滚动 320px（指针停在正文区中央） */
      const c = await page.evaluate(() => {
        const el = document.querySelector('#content') as HTMLElement;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      });
      await page.mouse.move(c.x, c.y);
      await page.mouse.wheel(0, 320);
      await page.waitForTimeout(320);

      const after = await page.evaluate(READ);
      const moved = Math.abs((after.firstRect?.t ?? 0) - (before.firstRect?.t ?? 0));
      expect(moved, '滚动后选中文字必须真的位移（>20px）').toBeGreaterThan(20);
      expect(after.firstStyleTop, '高亮块 top 必须随滚动更新（不能停在旧坐标）').not.toBe(before.firstStyleTop);
      expect(
        Math.abs((after.firstRect?.t ?? 0) - parseInt(after.firstStyleTop || '0', 10)),
        `高亮块 top（${after.firstStyleTop}）必须与文字实时 top（${after.firstRect?.t}）一致`,
      ).toBeLessThanOrEqual(2);
      expect(after.maxDelta, `滚动后每个高亮块都必须与文字对齐（实测 maxDelta=${after.maxDelta}px）`).toBeLessThanOrEqual(2);
      expect(after.visibleBlocks, '滚动后高亮块不得消失').toBe(before.visibleBlocks);

      expect(pageErrors, '滚动同步过程不得有页面错误').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('重复 10 次拖选：.ju-xsel-block 的 DOM 总数不超过第一次的稳定值（节点池复用）', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      await buildRows(page);

      await scrollToTop(page);
      await dragVerticalMiddle(page);
      const first = await page.evaluate(READ);
      expect(first.visibleBlocks, '第一次拖选必须有可见高亮块').toBeGreaterThan(0);
      expect(first.stats, 'fix13-patch1 必须暴露只读端口 __juXsel.overlayStats()').not.toBeNull();
      const domFirst = first.domBlocks;
      const createdFirst = first.stats.created;

      for (let i = 0; i < 9; i++) {
        await scrollToTop(page);
        await dragVerticalMiddle(page);
      }
      const last = await page.evaluate(READ);

      expect(last.visibleBlocks, '第 10 次拖选后仍必须有可见高亮块').toBeGreaterThan(0);
      expect(last.maxDelta, '第 10 次拖选后仍必须与文字对齐').toBeLessThanOrEqual(2);
      expect(
        last.domBlocks,
        `.ju-xsel-block DOM 总数不得增长（第 1 次 ${domFirst} → 第 10 次 ${last.domBlocks}）：节点池复用未生效`,
      ).toBeLessThanOrEqual(domFirst);
      expect(
        last.stats.created,
        `池内「曾创建」节点数不得增长（第 1 次 ${createdFirst} → 第 10 次 ${last.stats.created}）：说明每帧都在重建`,
      ).toBeLessThanOrEqual(createdFirst);
      expect(last.stats.created, '池大小必须等于 DOM 中的块数（不得有游离节点）').toBe(last.domBlocks);
      expect(
        last.stats.painted,
        `复用证据：写入矩形次数（${last.stats.painted}）必须远大于创建节点数（${last.stats.created}）`,
      ).toBeGreaterThan(last.stats.created * 3);
      expect(last.stats.reused, '必须有真实的复用命中（reused > 0）').toBeGreaterThan(0);

      expect(pageErrors, '10 次拖选不得有页面错误').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('拖选后键盘输入字符：高亮层必须自动清空（不得残留幽灵高亮）', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      await buildRows(page);
      await scrollToTop(page);
      await dragVerticalMiddle(page);

      const before = await page.evaluate(READ);
      expect(before.visibleBlocks, '前置：拖选后必须有可见高亮块').toBeGreaterThan(0);
      expect(before.model && before.model.covered, '前置：模型必须跨行').toBeGreaterThanOrEqual(2);

      /* 真实键盘输入一个字符（正文即将被改写 ⇒ 模型偏移失效 ⇒ 必须立刻清空） */
      await page.keyboard.type('X', { delay: 30 });
      await page.waitForTimeout(420);

      const after = await page.evaluate(READ);
      expect(after.visibleBlocks, `输入后不得残留可见高亮块（实测 ${after.visibleBlocks} 个）`).toBe(0);
      expect(after.overlayDisplay, '输入后 overlay 容器必须 display:none').toBe('none');
      expect(after.model && after.model.covered, '输入后跨行模型必须被清空').toBe(0);
      expect(after.domBlocks, '池里隐藏的块可以保留（复用），但不得有可见块').toBeGreaterThanOrEqual(0);

      expect(pageErrors, '输入清理过程不得有页面错误').toEqual([]);
    } finally {
      await context.close();
    }
  });
});
