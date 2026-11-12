import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix8 · 日历周视图「边框嵌套 / 面板拉高底部空白」
 *
 * 缺陷与根因（fix8 P0 取证：90过程材料/tmp/fix8/cal_week_layout_before.log，
 * 对 fix7 发布产物 sha256 e4563557…1603，Edge 真窗口 file://）：
 *   · D1 边框双重：.cal-module(1px) + .cal-tg(1px) 双层外框；
 *     且 .cal-tg-corner.border-right 与首列 .cal-tg-colhead.border-left 相邻 ⇒ 表头 2px 双线；
 *     .cal-tg-gutter.border-right 与首列 .cal-tg-col.border-left 相邻 ⇒ 主体 2px 双线。
 *   · D2 底部空白：.cal-tg-scroll 的 max-height=min-height=min(8h,60vh) 双向钉死（344px），
 *     拖拽模块缩放把手把面板从 458px 拉高到 778px（实测 +320px）后，滚动区仍 344px（+0px），
 *     模块底部留下 321px 死白，网格不跟随。
 *
 * 修复（src/style.css，纯 CSS 类，无内联 style）：
 *   · .cal-tg{border:none;flex:1 1 auto;height:100%;min-height:0}（外框只留最外层 .cal-module 一条）
 *   · .cal-tg-colhead / .cal-tg-col 改 border-right:1px（:last-child 无右边框）——border-collapse 等效，
 *     与 .cal-tg-corner / .cal-tg-gutter 的 border-right 不再叠加成 2px
 *   · .cal-tg-scroll{flex:1 1 0;max-height:none;min-height:min(8h,60vh)}（取消固定上限，随高度伸缩）
 *   · .cal-top / .cal-module[data-key="calendar"]>.cal-module-body 组成竖向 flex 链
 *
 * P3 探针 after（dist/index.html sha256 见 fix8 回执）：嵌套层数 1、表头/主体双线 false、
 * 拉高 +320px 后滚动区 +320px、模块底部死白 0px。
 *
 * 承载方式与 fix1 / fix5 / fix6 / fix7 spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
 * 全部断言均为真实交互（真实导航 / 真实点「周」/ 真实拖拽缩放把手），无夹具直改 state、无内联 style 注入。
 */

const BASE = 'http://localhost:5173';

/** 非正常留白阈值（px）：面板底部空白超过即视为死白 */
const BLANK_TOL = 40;
/** 拖拽目标增长量（px）与「滚动区至少跟随比例」 */
const RESIZE_TARGET = 320;
const FOLLOW_RATIO = 0.6;

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

/* ---------------- 页面操作（真实交互，与 fix8 P0/P3 探针同一口径） ---------------- */

async function waitApp(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).JU && typeof (window as any).JU.getState === 'function',
    null,
    { timeout: 60_000 },
  );
}

/** 侧栏导航 → 日历 → 点今天格子（渲染出模块） → 点「周」按钮 → 等时间网格挂载 */
async function gotoWeekView(page: Page): Promise<void> {
  await page.locator('.sb-nav-item[data-nav="calendar"]').first().click();
  await expect(page.locator('.cal-cell.today'), '日历必须渲染出今天格子').toHaveCount(1, { timeout: 20_000 });
  await page.locator('.cal-cell.today').first().click();
  await page.locator('.cal-view-btn').filter({ hasText: /^周$/ }).first().click({ timeout: 20_000 });
  await expect(page.locator('.cal-view-btn.active'), '周视图按钮必须置为 active').toHaveText('周', { timeout: 10_000 });
  await expect(page.locator('.cal-tg-body'), '周视图必须渲染 24 小时时间网格').toHaveCount(1, { timeout: 25_000 });
  await page.waitForTimeout(700);
}

async function openCalendar(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const dist = await ensureDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await waitApp(page);
  await gotoWeekView(page);
  return { context, page };
}

/** 页面内读取：边框口径 + 高度口径（与 P0 探针 READ_FN 同口径，只裁剪到测试需要的字段） */
async function readLayout(page: Page) {
  return page.evaluate(() => {
    const one = (s: string) => document.querySelector(s) as HTMLElement | null;
    const bw = (el: HTMLElement | null, side: 'Top' | 'Right' | 'Bottom' | 'Left') => {
      if (!el) return -1;
      const cs = getComputedStyle(el) as any;
      return parseFloat(cs['border' + side + 'Width']) || 0;
    };
    const tg = one('.cal-tg');
    const mod = one('.cal-module[data-key="calendar"]');
    const modBody = mod ? (mod.querySelector('.cal-module-body') as HTMLElement | null) : null;
    const calTop = one('.cal-top');
    const scroll = one('.cal-tg-scroll');
    const tgBody = one('.cal-tg-body');
    const corner = one('.cal-tg-corner');
    const colhead0 = one('.cal-tg-colhead');
    const gutter = one('.cal-tg-gutter');
    const cols = Array.from(document.querySelectorAll('.cal-tg-body .cal-tg-col')) as HTMLElement[];
    const colheads = Array.from(document.querySelectorAll('.cal-tg-colhead')) as HTMLElement[];
    const hourH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tg-hour-h')) || 0;

    /* 从 .cal-tg 沿祖先链统计「有可见边框的层」＝外框嵌套层数 */
    const frames: string[] = [];
    for (let el: HTMLElement | null = tg; el && el !== document.body; el = el.parentElement) {
      const w = [bw(el, 'Top'), bw(el, 'Right'), bw(el, 'Bottom'), bw(el, 'Left')];
      if (w.some((v) => v > 0)) frames.push(el.className || el.tagName);
    }

    return {
      hourH,
      frames,
      tgBorder: tg ? [bw(tg, 'Top'), bw(tg, 'Right'), bw(tg, 'Bottom'), bw(tg, 'Left')] : null,
      modBorder: mod ? [bw(mod, 'Top'), bw(mod, 'Right'), bw(mod, 'Bottom'), bw(mod, 'Left')] : null,
      /* 相邻边界合计宽度：必须是 1px（两条 1px 叠加 = 2px 即缺陷） */
      headBoundary: bw(corner, 'Right') + bw(colhead0, 'Left'),
      bodyBoundary: bw(gutter, 'Right') + bw(cols[0] || null, 'Left'),
      colLeft: cols.map((c) => bw(c, 'Left')),
      colRight: cols.map((c) => bw(c, 'Right')),
      colheadLeft: colheads.map((c) => bw(c, 'Left')),
      colheadRight: colheads.map((c) => bw(c, 'Right')),
      colToday: colheads.map((c) => c.classList.contains('today')),
      /* 列左缘 x 坐标：表头列与内容列必须逐列对齐（±1px） */
      colX: cols.map((c) => Math.round(c.getBoundingClientRect().left)),
      colheadX: colheads.map((c) => Math.round(c.getBoundingClientRect().left)),
      /* 每一道内部竖线两侧边框合计（>1px 即双线） */
      boundarySums: cols.slice(0, -1).map((c, i) => bw(c, 'Right') + bw(cols[i + 1], 'Left')),
      /* 高度口径 */
      modH: mod ? mod.offsetHeight : -1,
      bodyAvail: modBody ? modBody.clientHeight : -1,
      calTopH: calTop ? calTop.offsetHeight : -1,
      moduleBlank: (modBody && calTop) ? Math.round(modBody.clientHeight - calTop.offsetHeight) : -1,
      scrollClientH: scroll ? scroll.clientHeight : -1,
      scrollH: scroll ? scroll.scrollHeight : -1,
      gridH: tgBody ? tgBody.offsetHeight : -1,
      tailBlank: tgBody ? Math.round(tgBody.clientHeight - 24 * hourH) : -1,
      cols: cols.length,
    };
  });
}

/**
 * 真实拖拽 .cal-module-resize 缩放把手拉高日历模块（产品 setPointerCapture + pointermove）。
 * 视口放不下一次性目标位移时按可见余量分段拖，每段先 scrollIntoView；返回实测增长量。
 */
async function stretchCalendarModule(page: Page, target: number): Promise<{ growth: number; start: number; end: number }> {
  const modH = () =>
    page.evaluate(() => {
      const m = document.querySelector('.cal-module[data-key="calendar"]') as HTMLElement | null;
      return m ? m.offsetHeight : -1;
    });
  const start = await modH();
  let total = 0;
  for (let round = 0; round < 6 && total < target; round++) {
    const handle = page.locator('.cal-module[data-key="calendar"] .cal-module-resize').first();
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    if (!box) break;
    const vh = await page.evaluate(() => window.innerHeight);
    const room = Math.floor(vh - (box.y + box.height) - 8);
    if (room < 40) break;
    const step = Math.min(160, room, target - total);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(x, y + Math.round((step * i) / 6));
      await page.waitForTimeout(35);
    }
    await page.mouse.up();
    await page.waitForTimeout(450);
    const now = await modH();
    const gained = now - start;
    if (gained <= total) break;
    total = gained;
  }
  return { growth: total, start, end: await modH() };
}

/* ---------------- 用例 ---------------- */

test.describe('v2.1 fix8 · 日历周视图边框与高度自洽', () => {
  test('1) 周视图时间网格无双重边框：外框只一层，相邻边界合计 ≤ 1px', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openCalendar(browser);
    try {
      const L = await readLayout(page);

      /* ① .cal-tg 自身不再画外框：边界由最外层 .cal-module 承担 */
      expect(L.tgBorder, '.cal-tg 必须 border:none（外框只保留最外层一条）').toEqual([0, 0, 0, 0]);
      expect(L.modBorder, '.cal-module 必须自持 1px 外框（唯一一层）').toEqual([1, 1, 1, 1]);

      /* ② 外框嵌套层数 = 1（fix8 前实测 2：cal-tg + cal-module） */
      expect(L.frames, '外框不得多重嵌套，实测边框层：' + JSON.stringify(L.frames)).toHaveLength(1);
      expect(L.frames[0]).toContain('cal-module');

      /* ③ 时间轴与首列、表头与主体的相邻边界合计必须 1px（2px = 两条 1px 叠加） */
      expect(L.headBoundary, '表头 gutter/首列 相邻边框合计必须 1px（不得 2px 双线）').toBe(1);
      expect(L.bodyBoundary, '主体 gutter/首列 相邻边框合计必须 1px（不得 2px 双线）').toBe(1);

      /* ④ 任意一道内部竖线两侧边框合计都不得超过 1px（全局无 2px 双线） */
      expect(L.cols, '周视图必须有 7 个日期列').toBe(7);
      const worst = Math.max(0, ...L.boundarySums);
      expect(
        worst,
        '列间竖线最大合计宽度必须 ≤ 1px，实测每道为 ' + JSON.stringify(L.boundarySums),
      ).toBeLessThanOrEqual(1);

      /* ⑤ 最右列 / 首列：不重复画线（border-collapse 等效） */
      expect(L.colLeft[0], '首列不得再画左边框（该边界由 .cal-tg-gutter 的 border-right 承担）').toBe(0);
      expect(L.colRight[L.colRight.length - 1], '最右列不得画右边框（由 .cal-module 外框收边）').toBe(0);
      expect(L.colheadLeft[0], '首个列头不得再画左边框（该边界由 .cal-tg-corner 的 border-right 承担）').toBe(0);
      expect(L.colheadRight[L.colheadRight.length - 1], '最右列头不得画右边框').toBe(0);

      /* ⑥ 日期行边框与下方时间网格逐列对齐（±1px），不错位 */
      expect(L.colheadX).toHaveLength(L.colX.length);
      L.colX.forEach((x, i) => {
        expect(
          Math.abs(L.colheadX[i] - x),
          '第 ' + (i + 1) + ' 列列头 x=' + L.colheadX[i] + ' 与内容列 x=' + x + ' 未对齐',
        ).toBeLessThanOrEqual(1);
      });
    } finally {
      await context.close();
    }
  });

  test('2) 日历模块无底部异常留白：网格高与滚动容器自洽', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openCalendar(browser);
    try {
      const L = await readLayout(page);

      /* ① 24 小时网格实际高度 = 24 × 行高 + 18px（24:00 时标预留），不得被压扁或留空 */
      expect(L.hourH, '--tg-hour-h 必须为正数（行高随字号缩放）').toBeGreaterThan(0);
      expect(L.gridH, '网格高必须等于 24×行高+18（fix8 前实测 1050 = 24×43+18）').toBe(24 * L.hourH + 18);
      expect(L.tailBlank, '网格尾部死白不得超过 18px（24:00 时标预留区）').toBeLessThanOrEqual(18);

      /* ② 滚动容器与网格：要么网格正好填满（无滚动），要么确实产生滚动条——不允许「既装不下又没有滚动条」 */
      const fits = Math.abs(L.gridH - L.scrollClientH) <= 2;
      const scrollable = L.scrollH > L.scrollClientH + 1;
      expect(
        fits || scrollable,
        '网格 ' + L.gridH + 'px / 滚动容器 ' + L.scrollClientH + 'px / 内容 ' + L.scrollH + 'px：既不相等也未产生滚动条',
      ).toBe(true);

      /* ③ 模块底部不得出现大面积死白（fix8 前实测 321px） */
      expect(
        L.moduleBlank,
        '日历模块底部空白必须 ≤ ' + BLANK_TOL + 'px（实测 ' + L.moduleBlank + 'px）',
      ).toBeLessThanOrEqual(BLANK_TOL);

      /* ④ 滚动内容不得被裁：内容高 ≥ 容器高（24h 全量可滚达） */
      expect(L.scrollH, '时间网格内容高必须 ≥ 滚动容器高（24 小时全量可滚达）').toBeGreaterThanOrEqual(L.scrollClientH);
    } finally {
      await context.close();
    }
  });

  test('3) 真实拉高面板后滚动区跟随伸长（网格伸缩，不留死白）', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openCalendar(browser);
    try {
      const before = await readLayout(page);
      const stretch = await stretchCalendarModule(page, RESIZE_TARGET);
      expect(
        stretch.growth,
        '缩放把手必须真的把日历模块拉高（start=' + stretch.start + ' end=' + stretch.end + '）',
      ).toBeGreaterThanOrEqual(150);

      const after = await readLayout(page);
      const growScroll = after.scrollClientH - before.scrollClientH;
      expect(
        growScroll,
        '滚动区必须跟随模块拉高（模块 +' + stretch.growth + 'px，滚动区 +' + growScroll + 'px）',
      ).toBeGreaterThanOrEqual(Math.round(stretch.growth * FOLLOW_RATIO));

      expect(
        after.moduleBlank,
        '拉高后模块底部空白必须 ≤ ' + BLANK_TOL + 'px（实测 ' + after.moduleBlank + 'px）',
      ).toBeLessThanOrEqual(BLANK_TOL);
      expect(after.gridH, '拉高不得改变 24 小时网格自身高度（行高固定，靠滚动承载）').toBe(before.gridH);
      expect(after.frames, '拉高后外框仍只有一层').toHaveLength(1);
    } finally {
      await context.close();
    }
  });
});
