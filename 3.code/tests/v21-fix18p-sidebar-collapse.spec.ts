import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix18-patch1 · 侧边栏收起后各主视图无截断 / 不贴边
 *
 * 缺陷（P0 取证：90过程材料/tmp/fix18-patch1/sidebar_before.log，对真实 dist/index.html
 * sha256 33d12a30…424a，Edge 真窗口 file://，视口 1200×800）：
 *   桌面折叠态 `#sidebarLeft.collapsed` 使用 `margin-left:calc(var(--sidebar-left-w) * -1)`。
 *   flex 行里负 margin 会把后续 flex 项整体左移，真实点 #btnToggleLeft 后实测：
 *     #sidebarLeft rect = {x:-210,width:0}；#main rect = {x:-210,width:1180}；
 *     #content rect = {x:-210,width:1180}，首个文本节点 x=-153 ⇒ 视图左侧 210px 被视口裁掉
 *   （大纲 / 导图 / 演示 / 日历 / 多维表格五视图同源），即「内容被截断 + 贴边」。
 *
 * 修复：
 *   · src/style.css 追加 fix18-patch1 覆盖段：桌面折叠态 margin-left:0（真 0 宽 + overflow:hidden），
 *     主内容区从视口 x=0 起铺满；大纲/演示折叠态 24px 安全内距；mm-wrap / cal-page / db-table-wrap
 *     宽度 100% + 对应滚动语义。
 *   · src/ui/layout.ts 折叠回调补 window resize + 日历/表格横向滚动复位 + 导图 `_recenter`
 *     + 图谱按新宽度重渲染（只调用产品端口，不改写 window.JU.ui() 返回值）。
 *   · src/views/mindmap.ts 提供 `_recenter`（等效 resize 钩子）。
 *
 * 承载方式与 fix13~fix18 spec 一致：`vite build` 产物 + `context.route` 映射到
 * http://localhost:5173；全部断言基于真实浏览器里的 getBoundingClientRect() / scrollWidth 实测值。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:5173';

/** 几何容差（px） */
const TOL = 1;
/** 取证口径视口（与 90过程材料/tmp/fix18-patch1/sidebar_probe.cjs 完全一致） */
const VIEW = { width: 1200, height: 800 };

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

async function ensureDist(): Promise<string> {
  if (DIST) return DIST;
  await build({ root: ROOT, logLevel: 'silent' });
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  DIST = dist;
  return DIST;
}

async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE) return route.continue();
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    const file = path.join(dist, pathname);
    try {
      const stat = await fsp.stat(file);
      if (stat.isDirectory()) throw new Error('directory');
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

async function openApp(page: Page): Promise<void> {
  await page.setViewportSize(VIEW);
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => {
    const J = (window as any).JU;
    return !!(J && typeof J.getState === 'function' && typeof J.renderMain === 'function' && J.actions);
  }, null, { timeout: 60_000, polling: 25 });
  await page.waitForTimeout(500);
}

/** 主框几何：左/右栏宽度、#main / #content 的 x / width / 滚动宽度、文档级横向滚动 */
async function measureShell(page: Page) {
  return page.evaluate(() => {
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left, width: b.width, right: b.right };
    };
    const sbL = document.getElementById('sidebarLeft');
    const sbR = document.getElementById('sidebarRight');
    const main = document.getElementById('main');
    const content = document.getElementById('content');
    const cs = content ? getComputedStyle(content) : null;
    const padL = cs ? parseFloat(cs.paddingLeft) : 0;
    const padR = cs ? parseFloat(cs.paddingRight) : 0;
    return {
      innerWidth: window.innerWidth,
      leftWidth: sbL ? sbL.getBoundingClientRect().width : NaN,
      rightWidth: sbR ? sbR.getBoundingClientRect().width : NaN,
      rightX: sbR ? sbR.getBoundingClientRect().left : NaN,
      main: r(main),
      content: r(content),
      contentScrollWidth: content ? content.scrollWidth : NaN,
      contentClientWidth: content ? content.clientWidth : NaN,
      contentBoxWidth: content ? content.clientWidth - padL - padR : NaN,
      docScrollWidth: document.documentElement.scrollWidth,
      docHScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
}

/** 当前视图根容器 / 首个内容元素的几何 */
async function measureView(page: Page, rootSel: string, firstSel: string) {
  return page.evaluate(({ rootSel, firstSel }) => {
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left, width: b.width, right: b.right };
    };
    const content = document.getElementById('content');
    const root = content ? content.querySelector(rootSel) : null;
    const first = content ? content.querySelector(firstSel) : null;
    const cs = content ? getComputedStyle(content) : null;
    const padL = cs ? parseFloat(cs.paddingLeft) : 0;
    const padR = cs ? parseFloat(cs.paddingRight) : 0;
    return {
      content: r(content),
      contentScrollWidth: content ? content.scrollWidth : NaN,
      contentClientWidth: content ? content.clientWidth : NaN,
      contentBoxWidth: content ? content.clientWidth - padL - padR : NaN,
      root: r(root),
      rootScrollWidth: root ? root.scrollWidth : NaN,
      rootClientWidth: root ? root.clientWidth : NaN,
      first: r(first),
      docHScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  }, { rootSel, firstSel });
}

async function collapseLeft(page: Page): Promise<void> {
  await page.locator('#btnToggleLeft').first().click({ timeout: 20_000 });
  /* 等 width/margin 过渡（--t-base .2s）+ 产品折叠回调的 240ms resize 重算 */
  await page.waitForTimeout(700);
}

async function collapseRight(page: Page): Promise<void> {
  await page.locator('#btnToggleRight').first().click({ timeout: 20_000 });
  await page.waitForTimeout(700);
}

/** 真实点顶栏导航切视图（走产品 bindTopbar 处理器） */
async function switchTopbar(page: Page, view: string, waitFor: string): Promise<void> {
  const btn = page.locator(`#tbNav .tb-nav-btn[data-view="${view}"]`).first();
  await expect(btn, `顶栏必须有「${view}」入口`).toHaveCount(1, { timeout: 20_000 });
  await btn.click();
  await expect(page.locator(waitFor), `视图 ${view} 必须渲染 ${waitFor}`).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(500);
}

/**
 * 日历：左栏收起后侧栏 nav 元素 width:0/visibility:hidden，真实 mouse click 不可达，
 * 因此对产品 bindClick(addEventListener) 绑定的 `[data-nav="calendar"]` 执行 DOM click
 * —— 触发的是与鼠标点击完全相同的产品处理器（不是测试侧造模）。随后真实点「周」视图。
 */
async function openCalendar(page: Page): Promise<void> {
  const ok = await page.evaluate(() => {
    const b = document.querySelector('.sb-nav-item[data-nav="calendar"]') as HTMLElement | null;
    if (!b) return false;
    b.click();
    return true;
  });
  expect(ok, '侧栏必须有日历入口').toBe(true);
  await expect(page.locator('#content .cal-page')).toHaveCount(1, { timeout: 30_000 });
  const week = page.locator('#content .cal-view-switch .cal-view-btn').filter({ hasText: '周' }).first();
  await expect(week, '日历必须有「周」视图切换钮').toHaveCount(1, { timeout: 20_000 });
  await week.click();
  await expect(page.locator('#content .cal-tg-gutter'), '周视图必须渲染左侧时间轴').toHaveCount(1, { timeout: 20_000 });
  await page.waitForTimeout(600);
}

/**
 * 多维表格：进入「数据库」根是 folder 视图，表格视图须选中具体表格文档。
 * 全过程走产品端口 actions.createDoc / addNode / addDbField / addDbRow / setCurrentDoc + renderMain
 * （与 tests/db-module.spec.ts 同口径），不改写 window.JU.ui() 返回值。
 */
async function openDatabase(page: Page): Promise<void> {
  const info = await page.evaluate(() => {
    const J: any = (window as any).JU;
    const st = J.getState();
    let tableId: any = null;
    for (const id in st.nodes) {
      const n = st.nodes[id];
      if (n && !n._deleted && n.dbRoot && !n._isDbRoot) { tableId = id; break; }
    }
    if (!tableId) {
      let dbRootId: any = null;
      for (const id in st.nodes) { if (st.nodes[id] && st.nodes[id]._isDbRoot) { dbRootId = id; break; } }
      if (!dbRootId) dbRootId = J.actions.createDoc('数据库', { _isDbRoot: true, _isFolder: true, dbRoot: true });
      tableId = J.actions.addNode(dbRootId, null, { text: 'fix18p 数据库表', dbRoot: true });
      /* 36 列：保证 1200 视口下表格宽于容器，可横向滚动（首列 min-width 120，其余列下限 30+16px） */
      for (let i = 1; i <= 36; i++) J.actions.addDbField(tableId, '字段' + i);
      J.actions.addDbRow(tableId, { text: '行A', db: { 字段1: 'A1' } });
      J.actions.addDbRow(tableId, { text: '行B', db: { 字段1: 'B1' } });
    }
    J.actions.setCurrentDoc(tableId);
    J.renderMain();
    return { tableId };
  });
  expect(info.tableId, '表格节点必须由真实 actions 创建/定位').toBeTruthy();
  await expect(page.locator('#content .db-page'), '切到该表后必须渲染数据库页').toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(600);
}

test.describe('v2.1 fix18-patch1 · 侧栏收起后各视图无截断且不贴边', () => {
  let dist = '';

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    dist = await ensureDist();
  });

  test('侧边栏收起后各视图无截断且不贴边', async ({ context, page }) => {
    test.setTimeout(240_000);
    await installDistRoute(context, dist);
    await openApp(page);

    /* ---------- 断言 1（左栏）：收起后主内容区从视口 x=0 起，吃满「视口 − 右栏」剩余宽度 ---------- */
    const before = await measureShell(page);
    expect(before.leftWidth, '展开态左栏必须 > 0').toBeGreaterThan(1);
    await collapseLeft(page);
    const afterLeft = await measureShell(page);
    expect(afterLeft.leftWidth, '收起后左栏宽度必须归零').toBeLessThanOrEqual(TOL);
    expect(Math.abs(afterLeft.content!.x), '#content 左缘必须回到视口 x=0（不得为 -210 的负偏移）').toBeLessThanOrEqual(TOL);
    expect(
      Math.abs(afterLeft.content!.width - (afterLeft.innerWidth - afterLeft.rightWidth)),
      '#content 必须吃满「视口 − 右栏」剩余宽度',
    ).toBeLessThanOrEqual(2);
    expect(afterLeft.docHScroll, '收起后文档级不得出现横向滚动').toBe(false);

    /* 只收起左侧栏时右栏仍占 230px；再收起右栏，主内容区必须等于整视口宽度（断言 1 的「近似视口宽度」口径） */
    await collapseRight(page);
    const full = await measureShell(page);
    /* 右栏折叠口径是负 margin-right 移出视口（rect.width 仍为 230，但 rect.x ≥ 视口宽度），
       因此判定「不再占用主视图横向空间」而非 width 归零。 */
    expect(full.rightX, '右栏收起后必须移出视口（不再占用主视图宽度）').toBeGreaterThanOrEqual(full.innerWidth - TOL);
    expect(Math.abs(full.content!.x), '#content 左缘必须为 0').toBeLessThanOrEqual(TOL);
    expect(Math.abs(full.content!.width - full.innerWidth), '#content 宽度必须近似视口宽度').toBeLessThanOrEqual(2);
    expect(full.contentScrollWidth, '#content 不得横向溢出').toBeLessThanOrEqual(full.contentClientWidth + TOL);

    /* ---------- 断言 1 + 2：大纲视图 ---------- */
    await switchTopbar(page, 'outline', '#content .outline');
    const outline = await measureView(page, '.outline', '.outline .node .row .text');
    expect(Math.abs(outline.content!.x), '大纲：#content 左缘必须为 0').toBeLessThanOrEqual(TOL);
    expect(Math.abs(outline.content!.width - VIEW.width), '大纲：#content 宽度必须近似视口宽度').toBeLessThanOrEqual(2);
    expect(outline.root, '大纲根容器必须存在').not.toBeNull();
    expect(outline.root!.x, '大纲根容器左缘不得为负').toBeGreaterThanOrEqual(-TOL);
    expect(Math.abs(outline.root!.width - outline.contentBoxWidth), '大纲宽度必须等于内容盒宽').toBeLessThanOrEqual(TOL);
    expect(outline.rootScrollWidth, '大纲自身不得横向溢出').toBeLessThanOrEqual(outline.rootClientWidth + TOL);
    expect(outline.first, '大纲首个文本容器必须存在').not.toBeNull();
    expect(outline.first!.x, '大纲文本容器必须有 padding（x > 0，不贴视口左缘）').toBeGreaterThan(0);
    expect(outline.contentScrollWidth, '大纲 #content 不得出现横向滚动条').toBeLessThanOrEqual(outline.contentClientWidth + TOL);
    expect(outline.docHScroll, '大纲不得出现文档级横向滚动').toBe(false);

    /* ---------- 断言 1 + 2：演示视图 ---------- */
    await switchTopbar(page, 'presentation', '#content .pres-page');
    const pres = await measureView(page, '.pres-page', '.pres-list');
    expect(Math.abs(pres.content!.x), '演示：#content 左缘必须为 0').toBeLessThanOrEqual(TOL);
    expect(Math.abs(pres.content!.width - VIEW.width), '演示：#content 宽度必须近似视口宽度').toBeLessThanOrEqual(2);
    expect(pres.root, '演示根容器必须存在').not.toBeNull();
    expect(pres.root!.x, '演示根容器左缘不得为负').toBeGreaterThanOrEqual(-TOL);
    expect(Math.abs(pres.root!.width - pres.contentBoxWidth), '演示宽度必须等于内容盒宽').toBeLessThanOrEqual(TOL);
    expect(pres.rootScrollWidth, '演示自身不得横向溢出').toBeLessThanOrEqual(pres.rootClientWidth + TOL);
    expect(pres.first, '演示文本容器 .pres-list 必须存在').not.toBeNull();
    expect(pres.first!.x, '演示文本容器必须有 padding（x > 0，不贴视口左缘）').toBeGreaterThan(0);
    expect(pres.contentScrollWidth, '演示 #content 不得出现横向滚动条').toBeLessThanOrEqual(pres.contentClientWidth + TOL);
    expect(pres.docHScroll, '演示不得出现文档级横向滚动').toBe(false);

    /* ---------- 断言 5：思维导图 ---------- */
    await switchTopbar(page, 'mindmap', '#content .mm-wrap');
    const mm = await measureView(page, '.mm-wrap', '.mm-node');
    expect(Math.abs(mm.content!.x), '导图：#content 左缘必须为 0').toBeLessThanOrEqual(TOL);
    expect(Math.abs(mm.content!.width - VIEW.width), '导图：#content 宽度必须近似视口宽度').toBeLessThanOrEqual(2);
    expect(mm.root, '导图 .mm-wrap 必须存在').not.toBeNull();
    expect(Math.abs(mm.root!.width - mm.contentBoxWidth), '导图画布容器必须吃满内容盒宽').toBeLessThanOrEqual(TOL);
    expect(mm.root!.x, '导图画布容器左缘不得为负').toBeGreaterThanOrEqual(-TOL);
    expect(mm.root!.right, '导图画布容器右缘不得越出 #content').toBeLessThanOrEqual(mm.content!.right + TOL);
    expect(mm.rootScrollWidth, '导图画布容器不得横向溢出（溢出只允许内部滚动）').toBeLessThanOrEqual(mm.rootClientWidth + TOL);
    expect(mm.docHScroll, '导图不得出现文档级横向滚动').toBe(false);

    /* ---------- 断言 3：日历（周视图左侧时间轴完整可见，无负偏移、横向滚动复位最左） ---------- */
    await openCalendar(page);
    const cal = await measureView(page, '.cal-page', '.cal-tg-gutter');
    expect(Math.abs(cal.content!.x), '日历：#content 左缘必须为 0').toBeLessThanOrEqual(TOL);
    expect(Math.abs(cal.content!.width - VIEW.width), '日历：#content 宽度必须近似视口宽度').toBeLessThanOrEqual(2);
    expect(cal.root, '日历 .cal-page 必须存在').not.toBeNull();
    expect(Math.abs(cal.root!.width - cal.contentBoxWidth), '日历容器宽度必须等于内容盒宽').toBeLessThanOrEqual(TOL);
    expect(cal.root!.x, '日历容器左缘不得为负').toBeGreaterThanOrEqual(-TOL);
    expect(cal.rootScrollWidth, '日历容器不得横向溢出').toBeLessThanOrEqual(cal.rootClientWidth + TOL);
    expect(cal.first, '日历左侧时间轴列 .cal-tg-gutter 必须存在').not.toBeNull();
    expect(cal.first!.x, '日历左侧时间轴列不得出现负偏移').toBeGreaterThanOrEqual(-TOL);
    expect(cal.first!.width, '日历左侧时间轴列必须完整可见（宽度 > 0）').toBeGreaterThan(0);
    expect(cal.first!.right, '日历左侧时间轴列右缘不得越出 #content').toBeLessThanOrEqual(cal.content!.right + TOL);
    const calScroll = await page.evaluate(() => {
      const tg = document.querySelector('#content .cal-tg-scroll') as HTMLElement | null;
      const c = document.getElementById('content') as HTMLElement | null;
      return { tgLeft: tg ? tg.scrollLeft : null, contentLeft: c ? c.scrollLeft : null };
    });
    expect(calScroll.contentLeft ?? 0, '日历 #content 横向滚动必须复位到最左').toBeLessThanOrEqual(TOL);
    if (calScroll.tgLeft !== null) expect(calScroll.tgLeft, '日历时间网格横向滚动必须复位到最左').toBeLessThanOrEqual(TOL);
    expect(cal.docHScroll, '日历不得出现文档级横向滚动').toBe(false);

    /* ---------- 断言 4：多维表格（外层可横向滚动，首列完整可见） ---------- */
    await openDatabase(page);
    const db = await measureView(page, '.db-page', '.db-table th');
    expect(Math.abs(db.content!.x), '多维表格：#content 左缘必须为 0').toBeLessThanOrEqual(TOL);
    expect(Math.abs(db.content!.width - VIEW.width), '多维表格：#content 宽度必须近似视口宽度').toBeLessThanOrEqual(2);
    expect(db.root, '多维表格 .db-page 必须存在').not.toBeNull();
    expect(Math.abs(db.root!.width - db.contentBoxWidth), '多维表格根容器宽度必须等于内容盒宽').toBeLessThanOrEqual(TOL);
    expect(db.rootScrollWidth, '多维表格根容器不得横向溢出').toBeLessThanOrEqual(db.rootClientWidth + TOL);
    expect(db.first, '多维表格首列表头必须存在').not.toBeNull();
    expect(db.first!.x, '多维表格首列不得出现负偏移（表头仅 sticky top，left:auto）').toBeGreaterThanOrEqual(0);
    expect(db.first!.right, '多维表格首列必须完整可见（右缘不越出视口）').toBeLessThanOrEqual(VIEW.width + TOL);

    const dbWrap = await page.evaluate(() => {
      const w = document.querySelector('#content .db-table-wrap') as HTMLElement | null;
      if (!w) return null;
      const before = w.scrollLeft;
      w.scrollLeft = 120; /* 真实触发横向滚动，验证可滚动而非被截断 */
      const moved = w.scrollLeft;
      w.scrollLeft = 0; /* 复位，保证首列可见 */
      const cs = getComputedStyle(w);
      return {
        overflowX: cs.overflowX,
        scrollWidth: w.scrollWidth,
        clientWidth: w.clientWidth,
        before,
        moved,
        reset: w.scrollLeft,
        firstThLeft: (w.querySelector('th') as HTMLElement | null)?.getBoundingClientRect().left ?? null,
        wrapLeft: w.getBoundingClientRect().left,
      };
    });
    expect(dbWrap, '多维表格外层容器 .db-table-wrap 必须存在').not.toBeNull();
    expect(dbWrap!.overflowX, '多维表格外层容器必须启用横向滚动（overflow-x:auto）').toMatch(/auto|scroll/);
    expect(dbWrap!.scrollWidth, '多维表格内容宽度必须大于容器（存在可滚动范围）').toBeGreaterThan(dbWrap!.clientWidth + TOL);
    expect(dbWrap!.moved, '多维表格外层容器必须可横向滚动（scrollLeft 可位移）').toBeGreaterThan(0);
    expect(dbWrap!.reset, '复位后滚动位置必须为 0').toBeLessThanOrEqual(TOL);
    expect(dbWrap!.firstThLeft, '复位后首列表头必须完整可见').toBeGreaterThanOrEqual(dbWrap!.wrapLeft - TOL);
    expect(db.docHScroll, '多维表格不得出现文档级横向滚动').toBe(false);
  });
});
