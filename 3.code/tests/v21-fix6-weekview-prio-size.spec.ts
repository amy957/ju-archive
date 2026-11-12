import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix6 · 周视图（时间网格）事件块内优先级图标尺寸适配行高
 *
 * 缺陷与根因（fix6 P0 取证：90过程材料/tmp/fix6/cal_weekview_prio_before.log，
 * 对 fix5 发布产物 sha256 8c31003b…41d8，Edge 真窗口 file://）：
 *   · 行高 --tg-hour-h = 43px（今日列 1050px / 24 ≈ 43.75px 交叉校验）；
 *   · 事件块高度：09:00-10:00 → 43px、03:00-05:00 → 86px、13:00-13:30 → 21.5px；
 *   · src/style.css:858 `.cal-tg-ev.has-prio>.prio-badge{font-size:.72em}`，
 *     .cal-tg-ev 的 font-size = max(12px,.8em) = 12px ⇒ 徽章 **8.64px**（占块高 0.20），
 *     两图标间距仅 2px，且 .prio-ok 被全局 `font-size:11px` 钉死 ⇒ 周视图里图标几乎不可见。
 *
 * 修复（src/style.css，纯 CSS 类，无内联 style）：
 *   `.cal-tg-ev.has-prio>.prio-badge{font-size:max(16px,1.34em);line-height:1;gap:5px;padding:0;…}`
 *   `.cal-tg-ev.has-prio>.prio-badge>.prio-ok{font-size:.88em}`
 *   `.cal-tg-ev.has-prio{align-items:center}`
 *   P2 探针 after（dist/index.html sha256 f27b29e5…01fb）实测：徽章 16.08px（占块高 0.37）、
 *   图标间距 5px、OK 图标 14.15px、三块（43 / 86 / 21.5px）均无越界、正文均单行不挤压。
 *
 * 承载方式与 fix1 / fix5 spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
 * 全部断言均为真实交互（真实导航 / 真实右键菜单设时间与优先级 / 真实点「周」视图按钮），
 * 无夹具直改 state、无内联 style 注入。
 */

const BASE = 'http://localhost:5173';

/** P1 目标下限：周视图事件块内徽章字号 ≥ 16px（任务书「如 16px 或 18px」取下限） */
const MIN_BADGE_FONT_PX = 16;
/** 两图标（! 与 ⚡）最小间距：修改前实测 2px（拥挤），修改后 5px */
const MIN_ICON_GAP_PX = 4;

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

/* ---------------- 页面操作（真实交互，与 fix6 P0 探针同一口径） ---------------- */

async function waitApp(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).JU && typeof (window as any).JU.getState === 'function',
    null,
    { timeout: 60_000 },
  );
}

async function gotoCalendar(page: Page): Promise<void> {
  await page.locator('.sb-nav-item[data-nav="calendar"]').first().click();
  await expect(page.locator('.cal-cell.today'), '日历必须渲染出今天格子').toHaveCount(1, { timeout: 20_000 });
  await page.locator('.cal-cell.today').first().click();
  await expect(page.locator('.cal-adder'), '当日待办模块的「+ 添加今日待办」必须存在').toHaveCount(1, { timeout: 10_000 });
}

async function openCalendar(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const dist = await ensureDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await waitApp(page);
  await gotoCalendar(page);
  return { context, page };
}

async function createTodo(page: Page, text: string): Promise<string> {
  await page.locator('.cal-adder').first().click();
  await page.waitForTimeout(250);
  const focused = await page.evaluate(() => {
    const ae = document.activeElement as HTMLElement | null;
    return !!(ae && (ae as any).isContentEditable);
  });
  if (!focused) await page.locator('.cal-node .text[contenteditable="true"]').last().click();
  await page.keyboard.type(text, { delay: 12 });
  await page.evaluate(() => {
    const ae = document.activeElement as HTMLElement | null;
    if (ae && ae.blur) ae.blur();
  });
  await page.waitForTimeout(600);
  const id = await page.evaluate((t) => {
    const s = (window as any).JU.getState();
    const hit: string[] = [];
    for (const k of Object.keys(s.nodes || {})) {
      const n = s.nodes[k];
      if (String((n && n.text) || '').replace(/<[^>]*>/g, '').indexOf(t) >= 0) hit.push(k);
    }
    return hit.length ? hit[hit.length - 1] : null;
  }, text);
  expect(id, '新建待办必须落库（state 命中「' + text + '」）').toBeTruthy();
  return id as unknown as string;
}

/** 真实右键当日待办行正文（鼠标右键；命中失败即 FAIL，不用夹具替代） */
async function rightClickRow(page: Page, id: string): Promise<void> {
  const box = await page.evaluate((nid) => {
    const el = document.querySelector('.cal-node .text[data-id="' + CSS.escape(nid) + '"]') as HTMLElement | null;
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.min(40, Math.max(8, r.width / 2)), y: r.top + r.height / 2 };
  }, id);
  expect(box, '当日待办行必须可定位（.cal-node .text[data-id]）').not.toBeNull();
  await page.mouse.click(box!.x, box!.y, { button: 'right' });
  await expect(page.locator('.cal-ctx'), '右键必须打开日历待办菜单').toHaveCount(1, { timeout: 5000 });
}

async function closeMenu(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('.cal-ctx'), 'Esc 必须关闭菜单').toHaveCount(0, { timeout: 5000 });
}

async function expandFold(page: Page, title: string): Promise<void> {
  await page.locator('.cal-ctx .cal-ctx-fold > .ctx-item').filter({ hasText: title }).first().click();
  const fold = page.locator('.cal-ctx .cal-ctx-fold').filter({ hasText: title }).first();
  await expect(fold.locator('.cal-ctx-body'), '折叠内容必须展开（.on）').toHaveClass(/on/, { timeout: 5000 });
}

async function pickSel(page: Page, selIndex: number, label: string): Promise<void> {
  await page.locator('.cal-ctx .cal-sel').nth(selIndex).click();
  const opt = page.locator('.cal-sel-panel .cal-sel-opt').filter({ hasText: new RegExp('^' + label + '$') }).first();
  await expect(opt, '时间下拉必须含选项 ' + label).toHaveCount(1, { timeout: 5000 });
  await opt.click();
  await page.waitForTimeout(150);
}

/** 右键「设置时间」→ 开始 H/M + 结束 H/M → 保存（4 个下拉，索引 0..3） */
async function setTimeViaMenu(page: Page, id: string, h0: string, m0: string, h1: string, m1: string): Promise<void> {
  await rightClickRow(page, id);
  await expandFold(page, '设置时间');
  await pickSel(page, 0, h0);
  await pickSel(page, 1, m0);
  await pickSel(page, 2, h1);
  await pickSel(page, 3, m1);
  await page.locator('.cal-ctx .cal-ctx-btn.primary').filter({ hasText: '保存' }).first().click();
  await expect(page.locator('.cal-ctx'), '保存后菜单必须收起').toHaveCount(0, { timeout: 5000 });
  await page.waitForTimeout(400);
}

async function setPrioViaMenu(page: Page, id: string, label: string): Promise<void> {
  await rightClickRow(page, id);
  await expandFold(page, '优先级');
  const btn = page.locator('.cal-ctx .cal-ctx-prio .cal-ctx-btn').filter({ hasText: new RegExp('^' + label + '$') }).first();
  await expect(btn, '优先级按钮「' + label + '」必须存在').toHaveCount(1, { timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(400);
  await closeMenu(page);
}

async function switchWeek(page: Page): Promise<void> {
  await page.locator('.cal-view-btn').filter({ hasText: /^周$/ }).first().click();
  await expect(page.locator('.cal-view-btn.active'), '周视图按钮必须置为 active').toHaveText('周', { timeout: 10_000 });
  await expect(page.locator('.cal-tg-ev').first(), '周视图必须渲染时间网格事件块').toHaveCount(1, { timeout: 25_000 });
  await page.waitForTimeout(600);
}

/* 用例数据：文本刻意取短（周视图列宽约 113px），使「图标 + 正文同一行」成为可判定事实 */
const WEEK_CASES = [
  { text: 'F6-S', h0: '09', m0: '00', h1: '10', m1: '00', menu: '重要紧急', key: 'important_urgent' },
  { text: 'F6-D', h0: '03', m0: '00', h1: '05', m1: '00', menu: '紧急不重要', key: 'urgent' },
  { text: 'F6-H', h0: '13', m0: '00', h1: '13', m1: '30', menu: '不紧急不重要', key: 'none' },
];

type BlockMeasure = {
  text: string;
  prio: string | null;
  evH: number;
  evFontSize: number;
  evLineHeight: number;
  evAlign: string;
  txtH: number;
  txtFontSize: number;
  txtLineHeight: number;
  txtScrollH: number;
  txtClientH: number;
  badgeFontSize: number;
  badgeHeight: number;
  badgeWidth: number;
  badgeLineHeight: number;
  badgeGap: number;
  badgeTopOffset: number;
  badgeBottomOffset: number;
  spanGap: number | null;
  spanFontSizes: number[];
  spanLineHeights: number[];
};

/** 测量周视图全部事件块（与 P0 探针同一口径：getBoundingClientRect + computed style） */
async function measureWeekBlocks(page: Page): Promise<{ hourH: number; blocks: BlockMeasure[] }> {
  return page.evaluate(() => {
    const px = (v: string) => {
      const n = parseFloat(String(v || '').replace('px', ''));
      return isFinite(n) ? n : 0;
    };
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const hourH = px(getComputedStyle(document.documentElement).getPropertyValue('--tg-hour-h'));
    const blocks = Array.from(document.querySelectorAll('.cal-tg-ev'))
      .filter((ev) => !!ev.querySelector('.prio-badge'))
      .map((ev) => {
        const badge = ev.querySelector('.prio-badge') as HTMLElement;
        const txt = ev.querySelector('.evtx') as HTMLElement | null;
        const er = ev.getBoundingClientRect();
        const br = badge.getBoundingClientRect();
        const ecs = getComputedStyle(ev);
        const bcs = getComputedStyle(badge);
        const tcs = txt ? getComputedStyle(txt) : null;
        const tr = txt ? txt.getBoundingClientRect() : null;
        const spans = Array.from(badge.children) as HTMLElement[];
        let spanGap: number | null = null;
        if (spans.length >= 2) spanGap = r2(spans[1].getBoundingClientRect().left - spans[0].getBoundingClientRect().right);
        return {
          text: txt ? String(txt.textContent || '').replace(/\s+/g, ' ').trim() : '',
          prio: badge.getAttribute('data-prio'),
          evH: r2(er.height),
          evFontSize: px(ecs.fontSize),
          evLineHeight: px(ecs.lineHeight),
          evAlign: ecs.alignItems,
          txtH: tr ? r2(tr.height) : 0,
          txtFontSize: tcs ? px(tcs.fontSize) : 0,
          txtLineHeight: tcs ? px(tcs.lineHeight) : 0,
          txtScrollH: txt ? txt.scrollHeight : 0,
          txtClientH: txt ? txt.clientHeight : 0,
          badgeFontSize: px(bcs.fontSize),
          badgeHeight: r2(br.height),
          badgeWidth: r2(br.width),
          badgeLineHeight: px(bcs.lineHeight),
          badgeGap: px(bcs.gap),
          badgeTopOffset: r2(br.top - er.top),
          badgeBottomOffset: r2(er.bottom - br.bottom),
          spanGap: spanGap,
          spanFontSizes: spans.map((s) => px(getComputedStyle(s).fontSize)),
          spanLineHeights: spans.map((s) => px(getComputedStyle(s).lineHeight)),
        };
      });
    return { hourH: hourH, blocks: blocks };
  });
}

/** 造 3 条带时间 + 优先级的今日待办，再切到周视图 */
async function seedWeekView(page: Page): Promise<string[]> {
  const ids: string[] = [];
  for (const c of WEEK_CASES) {
    const id = await createTodo(page, c.text);
    ids.push(id);
    await setTimeViaMenu(page, id, c.h0, c.m0, c.h1, c.m1);
    await setPrioViaMenu(page, id, c.menu);
  }
  /* 落库校验：三条都必须是「有时间 + 有优先级」，否则周视图事件块不会出现 */
  for (let i = 0; i < WEEK_CASES.length; i++) {
    const c = WEEK_CASES[i];
    const st = await page.evaluate((nid) => {
      const n = ((window as any).JU.getState().nodes || {})[nid] || {};
      return { time: n.time || null, timeEnd: n.timeEnd || null, priority: Number(n.priority) || 0 };
    }, ids[i]);
    expect(st.time, c.text + '：开始时间必须落库').toBe(c.h0 + ':' + c.m0);
    expect(st.timeEnd, c.text + '：结束时间必须落库').toBe(c.h1 + ':' + c.m1);
    expect(st.priority, c.text + '：优先级必须落库').toBeGreaterThan(0);
  }
  await switchWeek(page);
  return ids;
}

/* ---------------- 用例 ---------------- */

test.describe('v2.1 fix6 · 周视图优先级图标尺寸适配行高', () => {
  test('周视图事件块内 .prio-badge 的 font-size ≥ 16px（三档优先级）', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openCalendar(browser);
    try {
      await seedWeekView(page);
      const { hourH, blocks } = await measureWeekBlocks(page);
      expect(hourH, '行高 --tg-hour-h 必须可读（P0 实测 43px）').toBeGreaterThan(0);
      expect(blocks.length, '周视图必须出现 3 个带优先级的事件块').toBe(WEEK_CASES.length);

      for (const c of WEEK_CASES) {
        const b = blocks.find((x) => x.text === c.text);
        expect(b, '必须找到事件块「' + c.text + '」（prio=' + c.key + '）').toBeTruthy();
        const blk = b as BlockMeasure;
        expect(blk.prio, '事件块「' + c.text + '」徽章 data-prio 必须为 ' + c.key).toBe(c.key);
        expect(blk.badgeFontSize,
          '事件块「' + c.text + '」（块高 ' + blk.evH + 'px / 行高 ' + hourH + 'px）：徽章 font-size 必须 ≥ ' + MIN_BADGE_FONT_PX + 'px（实测 ' + blk.badgeFontSize + 'px；fix5 发布版为 8.64px）')
          .toBeGreaterThanOrEqual(MIN_BADGE_FONT_PX);
        /* 图标自身的字号同样必须达标（.prio-ok 曾被全局 11px 钉死） */
        for (const fs1 of blk.spanFontSizes) {
          expect(fs1, '事件块「' + c.text + '」图标 span 字号必须 ≥ ' + (MIN_BADGE_FONT_PX - 2) + 'px（实测 ' + fs1 + 'px）')
            .toBeGreaterThanOrEqual(MIN_BADGE_FONT_PX - 2);
        }
      }
    } finally {
      await context.close();
    }
  });

  test('.prio-badge 的 height 不超过 .cal-tg-ev 的高度（不越界、不遮挡正文）', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openCalendar(browser);
    try {
      await seedWeekView(page);
      const { hourH, blocks } = await measureWeekBlocks(page);
      expect(blocks.length, '周视图必须出现 3 个带优先级的事件块').toBe(WEEK_CASES.length);
      expect(hourH, '行高 --tg-hour-h 必须可读').toBeGreaterThan(0);

      for (const blk of blocks) {
        expect(blk.badgeHeight,
          '事件块「' + blk.text + '」：徽章高度必须不超过事件块高度（徽章 ' + blk.badgeHeight + 'px / 块高 ' + blk.evH + 'px）')
          .toBeLessThanOrEqual(blk.evH);
        expect(blk.badgeTopOffset, '事件块「' + blk.text + '」：徽章上沿不得溢出块顶（实测 topOffset=' + blk.badgeTopOffset + 'px）')
          .toBeGreaterThanOrEqual(-0.5);
        expect(blk.badgeBottomOffset, '事件块「' + blk.text + '」：徽章下沿不得溢出块底（实测 bottomOffset=' + blk.badgeBottomOffset + 'px）')
          .toBeGreaterThanOrEqual(-0.5);
        /* 正文不被挤压：滚动高不得超过可视高，整行高度不得超过块高 */
        expect(blk.txtScrollH, '事件块「' + blk.text + '」：正文不得被裁切（scrollH ' + blk.txtScrollH + ' > clientH ' + blk.txtClientH + '）')
          .toBeLessThanOrEqual(blk.txtClientH + 1);
        expect(blk.txtH, '事件块「' + blk.text + '」：正文高度不得超过块高（正文 ' + blk.txtH + 'px / 块高 ' + blk.evH + 'px）')
          .toBeLessThanOrEqual(blk.evH);
        /* 图标与正文同一行：两者的垂直中心必须落在同一行盒内（align-items:center 生效） */
        expect(blk.evAlign, '事件块「' + blk.text + '」必须为 flex + align-items:center（实测 ' + blk.evAlign + '）').toBe('center');
        expect(Math.abs((blk.badgeTopOffset + blk.badgeHeight / 2) - (blk.evH / 2)),
          '事件块「' + blk.text + '」：徽章必须垂直居中（不压住正文）').toBeLessThanOrEqual(1);
      }
    } finally {
      await context.close();
    }
  });

  test('两图标间距 ≥ 4px、line-height 为 1、事件块未被撑高（不改内联 style）', async ({ browser }) => {
    test.setTimeout(180_000);
    const { context, page } = await openCalendar(browser);
    try {
      await seedWeekView(page);
      const { blocks } = await measureWeekBlocks(page);
      const dual = blocks.find((b) => b.prio === 'important_urgent');
      expect(dual, '必须找到「重要紧急」双图标块（! + ⚡）').toBeTruthy();
      const b = dual as BlockMeasure;

      expect(b.spanGap, '两图标间距必须 ≥ ' + MIN_ICON_GAP_PX + 'px（fix5 发布版实测 2px，拥挤）').not.toBeNull();
      expect(b.spanGap as number, '两图标间距必须 ≥ ' + MIN_ICON_GAP_PX + 'px（实测 ' + b.spanGap + 'px）')
        .toBeGreaterThanOrEqual(MIN_ICON_GAP_PX);
      expect(b.badgeGap, '徽章 gap 必须 ≥ ' + MIN_ICON_GAP_PX + 'px（实测 ' + b.badgeGap + 'px）').toBeGreaterThanOrEqual(MIN_ICON_GAP_PX);
      for (const lh of b.spanLineHeights) {
        expect(Math.abs(lh - b.badgeFontSize), '图标 line-height 必须等于 1（行高 ' + lh + 'px / 字号 ' + b.badgeFontSize + 'px）').toBeLessThanOrEqual(0.5);
      }
      expect(Math.abs(b.badgeLineHeight - b.badgeFontSize), '徽章 line-height 必须为 1').toBeLessThanOrEqual(0.5);

      /* 尺寸全部来自 CSS 类：事件块与徽章都不得带内联 font-size / height / gap 样式 */
      const inline = await page.evaluate(() => {
        const ev = document.querySelector('.cal-tg-ev.has-prio') as HTMLElement | null;
        const badge = ev ? (ev.querySelector('.prio-badge') as HTMLElement | null) : null;
        return {
          evStyle: ev ? ev.getAttribute('style') || '' : '',
          badgeStyle: badge ? badge.getAttribute('style') || '' : '',
        };
      });
      expect(inline.evStyle, '事件块内联 style 只允许 top/height/--evtag（不得写死字号）').not.toMatch(/font-size|gap/);
      expect(inline.badgeStyle, '徽章不得带内联 style（尺寸必须由 CSS 类控制）').toBe('');
    } finally {
      await context.close();
    }
  });
});
