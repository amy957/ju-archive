import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix15 · 日历周视图「当前时间指示线越界」
 *
 * 缺陷（P0 取证：90过程材料/tmp/fix15/calendar_now_line_before.log，对 fix14 发布产物
 * sha256 94d7e039…cc2d，Edge 真窗口 file://）：
 *   · 23:30 时侧栏切到「文件」再切回「日历」→ .cal-tg-scroll 的 scrollTop = 0，
 *     红线位于滚动容器可视区（164~508）下方 1055.6px ⇒ 越界不可见（D1）；
 *   · 周视图内点「今天」等「同键重绘」同样把 scrollTop 掉回 0（E）。
 *
 * 根因（src/views/calendar.ts · buildTimeGrid）：
 *   renderMain 只有在**上一份 DOM 里存在 .cal-tg-scroll** 时才记录 prevScroll，
 *   跨模块往返（日历→文件→日历）必然取不到 ⇒ prevScroll = null；而 _calTgLastView 仍是 'week'、
 *   autoKey 未变 ⇒ 原「必滚」与「恢复」两条分支都不执行 ⇒ scrollTop 停在 0。
 *
 * 修复（src/views/calendar.ts）：
 *   · 新增 calTgCenterTarget() / centerCalTgOnNowLine()：按「扣除 sticky 表头后的可见区」求居中
 *     scrollTop 并钳制到 [0, scrollHeight-clientHeight]；
 *   · 分支条件补上「prevScroll == null ⇒ 必滚」，并在未布局就绪时用双 rAF 重试；
 *   · 只有确有用户滚动位置（周视图内同键重绘）才恢复原位，不抢用户滚动；
 *   · 空闲 45s 兜底纠偏改用同一算子（判据含表头高度）。
 *
 * 承载方式与 fix1/fix5~fix8 spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
 * 全部断言均为真实交互（真实导航、真实点「周 / 月 / 今天」），无夹具直改 state、无内联 style 注入。
 */

const BASE = 'http://localhost:5173';
/** 居中判定容差：|红线中心 − 滚动容器中心| ≤ 容器高度的 25% */
const CENTER_TOL_RATIO = 0.25;
/** 固定到东八区 20:00（UTC 12:00）：此时居中在物理上可达（滚动上限有余量） */
const ISO_2000 = '2026-10-29T12:00:00Z';
/** 固定到东八区 23:30（UTC 15:30）：一天末尾，滚到顶必然让红线离开视口 */
const ISO_2330 = '2026-10-29T15:30:00Z';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

let DIST: string | null = null;

function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

async function ensureDist(): Promise<string> {
  if (DIST) return DIST;
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  const htmls = fs.readdirSync(dist).filter((n) => /\.html?$/i.test(n));
  if (htmls.length !== 1 || htmls[0] !== 'index.html') throw new Error('dist 下 HTML 不是恰好一份 index.html：' + htmls.join(', '));
  DIST = dist;
  return DIST;
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

/* ---------------- 页面操作（真实交互，与 P0/P2 探针同一口径） ---------------- */

async function waitApp(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).JU && typeof (window as any).JU.getState === 'function',
    null,
    { timeout: 60_000 },
  );
}

async function openApp(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await waitApp(page);
  await page.waitForTimeout(800);
  return page;
}

/** 侧栏 → 日历 → 点今天格子（渲染出模块） */
async function gotoCalendar(page: Page): Promise<void> {
  await page.locator('.sb-nav-item[data-nav="calendar"]').first().click();
  await expect(page.locator('.cal-cell.today'), '日历必须渲染出今天格子').toHaveCount(1, { timeout: 25_000 });
  await page.locator('.cal-cell.today').first().click();
  await page.waitForTimeout(300);
}

async function clickWeek(page: Page): Promise<void> {
  await page.locator('.cal-view-btn').filter({ hasText: /^周$/ }).first().click({ timeout: 20_000 });
  await expect(page.locator('.cal-view-btn.active'), '周视图按钮必须置为 active').toHaveText('周', { timeout: 15_000 });
  await expect(page.locator('.cal-tg-body'), '周视图必须渲染 24 小时时间网格').toHaveCount(1, { timeout: 25_000 });
  await expect(page.locator('.cal-tg-nowline'), '周视图必须渲染当前时间指示线').toHaveCount(1, { timeout: 25_000 });
  await page.waitForTimeout(700);
}

async function clickMonth(page: Page): Promise<void> {
  await page.locator('.cal-view-btn').filter({ hasText: /^月$/ }).first().click({ timeout: 20_000 });
  await expect(page.locator('.cal-grid'), '月视图必须渲染月网格').toHaveCount(1, { timeout: 25_000 });
  await page.waitForTimeout(400);
}

/** 页面内读取：红线与滚动容器的几何（与 P0/P2 探针 READ_FN 同口径裁剪） */
async function readNowLine(page: Page) {
  return page.evaluate(() => {
    const sc = document.querySelector('.cal-tg-scroll') as HTMLElement | null;
    const ln = document.querySelector('.cal-tg-nowline') as HTMLElement | null;
    const head = document.querySelector('.cal-tg-head') as HTMLElement | null;
    if (!sc || !ln) return { hasScroller: !!sc, hasLine: !!ln } as any;
    const r = sc.getBoundingClientRect();
    const lr = ln.getBoundingClientRect();
    const headH = head ? head.getBoundingClientRect().height : 0;
    return {
      hasScroller: true,
      hasLine: true,
      scrollTop: Math.round(sc.scrollTop),
      clientHeight: Math.round(sc.clientHeight),
      maxScrollTop: Math.round(sc.scrollHeight - sc.clientHeight),
      scTop: r.top,
      scBottom: r.bottom,
      scH: r.height,
      headH,
      lineTop: lr.top,
      lineBottom: lr.bottom,
      lineCenterOffset: (lr.top + lr.height / 2) - (r.top + r.height / 2),
      visible: lr.top >= r.top && lr.bottom <= r.bottom,
      visibleBelowHead: lr.top >= r.top + headH && lr.bottom <= r.bottom,
      label: (document.querySelector('.cal-tg-nowlabel') as HTMLElement | null)?.textContent || '',
      viewportH: window.innerHeight,
    } as any;
  });
}

/* ---------------- 测试 ---------------- */

test.describe('v2.1 fix15 · 日历周视图当前时间指示线', () => {
  test('切到周视图：时间指示线在滚动容器可视区内（top > 0 且 < 视口高度）', async ({ browser }) => {
    test.setTimeout(240_000);
    const dist = await ensureDist();
    const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
    await installDistRoute(context, dist);
    const page = await openApp(context);

    await gotoCalendar(page);
    await clickWeek(page);

    const L = await readNowLine(page);
    expect(L.hasScroller && L.hasLine, '周视图必须同时存在滚动容器与红线').toBe(true);
    /* P2 判据 ①：视口内（相对窗口，不与滚动条位置耦合） */
    expect(L.lineTop, '红线 top 必须 > 0（不在视口上方之外）').toBeGreaterThan(0);
    expect(L.lineTop, '红线 top 必须 < 视口高度（不在视口下方之外）').toBeLessThan(L.viewportH);
    /* P2 判据 ②：在滚动容器（.cal-tg-scroll）的可见区域内 */
    expect(L.visible, '红线必须完整落在 .cal-tg-scroll 的可见区域内：lineTop=' + L.lineTop + ' scroller=' + L.scTop + '~' + L.scBottom).toBe(true);
    expect(L.visibleBelowHead, '红线不得被 sticky 表头遮住').toBe(true);
    /* 红线文案应与当前东八区时间一致（渲染链路真实生效） */
    expect(L.label).toMatch(/^\d{2}:\d{2}$/);

    await context.close();
  });

  test('手动把红线滚出视口 → 切月再切周 → 红线自动回到可视区并居中', async ({ browser }) => {
    test.setTimeout(240_000);
    const dist = await ensureDist();
    const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
    await installDistRoute(context, dist);
    const page = await openApp(context);
    /* 固定 20:00：滚到顶部时红线必然离开视口（任何真实时钟下都能稳定复现「越界」前置条件） */
    await page.clock.setFixedTime(new Date(ISO_2000));

    await gotoCalendar(page);
    await clickWeek(page);

    /* 手动把滚动条拉回 00:00 —— 红线移出视口 */
    await page.evaluate(() => {
      const sc = document.querySelector('.cal-tg-scroll') as HTMLElement | null;
      if (sc) sc.scrollTop = 0;
    });
    await page.waitForTimeout(400);
    const moved = await readNowLine(page);
    expect(moved.visible, '前置条件：手动滚到顶部后红线应已离开可视区（scrollTop=' + moved.scrollTop + '）').toBe(false);

    /* 切走再切回：月 → 周 */
    await clickMonth(page);
    await clickWeek(page);

    const back = await readNowLine(page);
    expect(back.visible, '切回周视图后红线必须回到可视区：lineTop=' + back.lineTop + ' scroller=' + back.scTop + '~' + back.scBottom).toBe(true);
    expect(back.scrollTop, '切回周视图后滚动位置必须被重算（不得停在 0）').toBeGreaterThan(0);
    const tol = Math.max(1, back.scH * CENTER_TOL_RATIO);
    expect(
      Math.abs(back.lineCenterOffset),
      '红线应居中（|中心偏差|=' + Math.abs(back.lineCenterOffset).toFixed(1) + 'px，容差=' + tol.toFixed(1) + 'px）',
    ).toBeLessThanOrEqual(tol);

    await context.close();
  });

  test('从「文件」模块切回日历（顶部导航往返）→ 红线仍在可视区内', async ({ browser }) => {
    test.setTimeout(240_000);
    const dist = await ensureDist();
    const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
    await installDistRoute(context, dist);
    const page = await openApp(context);
    /* 固定 23:30：一天末尾，scrollTop=0 时红线落在可视区下方 1000+px（fix14 实测越界场景） */
    await page.clock.setFixedTime(new Date(ISO_2330));

    await gotoCalendar(page);
    await clickWeek(page);
    const before = await readNowLine(page);
    expect(before.visible, '前置条件：进入周视图时红线应可见').toBe(true);

    /* 侧栏切到「文件」再切回「日历」（= 顶部导航往返，renderMain 会取不到旧 .cal-tg-scroll） */
    await page.locator('.sb-nav-item[data-nav="files"]').first().click({ timeout: 20_000 });
    await page.waitForSelector('.cal-tg-scroll', { state: 'detached', timeout: 30_000 });
    await page.waitForTimeout(400);
    await page.locator('.sb-nav-item[data-nav="calendar"]').first().click({ timeout: 20_000 });
    await expect(page.locator('.cal-tg-body'), '切回日历必须重建时间网格').toHaveCount(1, { timeout: 25_000 });
    await page.waitForTimeout(800);

    const after = await readNowLine(page);
    expect(
      after.visible,
      '导航往返后红线必须仍在可视区（修复前 scrollTop=0、红线在视口下方）：scrollTop=' + after.scrollTop + ' lineTop=' + after.lineTop,
    ).toBe(true);
    expect(after.scrollTop, '导航往返后滚动位置不得掉回 0').toBeGreaterThan(0);

    await context.close();
  });

  test('固定 20:00 进入周视图：红线垂直居中（容差 25% 容器高）', async ({ browser }) => {
    test.setTimeout(240_000);
    const dist = await ensureDist();
    const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
    await installDistRoute(context, dist);
    const page = await openApp(context);
    await page.clock.setFixedTime(new Date(ISO_2000));

    await gotoCalendar(page);
    await clickMonth(page);
    await clickWeek(page);

    const L = await readNowLine(page);
    expect(L.visible, '20:00 进入周视图红线必须可见').toBe(true);
    expect(L.label, '红线文案必须反映固定后的时间').toBe('20:00');
    const tol = Math.max(1, L.scH * CENTER_TOL_RATIO);
    expect(
      Math.abs(L.lineCenterOffset),
      '20:00 时居中在物理上可达，|中心偏差| 必须 ≤ 25% 容器高（实测 ' + Math.abs(L.lineCenterOffset).toFixed(1) + 'px）',
    ).toBeLessThanOrEqual(tol);

    await context.close();
  });
});
