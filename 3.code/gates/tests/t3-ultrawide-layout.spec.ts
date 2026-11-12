// @ts-nocheck
/**
 * 不变量 #76 · 极宽屏幕自适应（带鱼屏 / 4K+）实测
 *
 * 断言（真实浏览器 + computed style + 物理截图）：
 *   ① 大纲容器宽度 == 内容区可用宽度（clientWidth - 左右 padding），不再受固定像素上限约束；
 *   ② 大纲正文纯文本行宽 <= 1400px（阅读限宽），且 .outline .text 计算后 max-width = 1400px；
 *   ③ 页面无横向滚动条（documentElement.scrollWidth <= clientWidth）；
 *   ④ 日历 / 数据库多列视图宽度 == 内容区可用宽度（不受阅读限宽影响）；
 *   ⑤ 折叠三钮 .main-toggle 仍为 position:fixed，中心相对 50vw 定位（left=-40 / right=+40 / both=0）；
 *   ⑥ .sb-nav-item.active 与 .sb-row.active 仍无左侧色条（border-left 0 / ::before none）。
 *
 * 运行：node node_modules/@playwright/test/cli.js test tests/t3-ultrawide-layout.spec.ts
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_URL = process.env.JU_APP_URL || 'file://' + path.resolve(__dirname, '..', 'v2.0-t3.html');
const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
/* ISSUE-018：物理截图与宽度度量一律落子目录，禁止在归档根目录新建目录。
   截图 -> 4.回归与验收/uw-screenshots；度量 JSON -> 90过程材料/_哈希与行尾校验。 */
const SHOT_DIR = path.join(ROOT_DIR, '4.回归与验收', 'uw-screenshots');
const METRIC_DIR = path.join(ROOT_DIR, '90过程材料', '_哈希与行尾校验');

async function bootApp(page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof forceRender === 'function' && typeof state === 'object' && state !== null,
    null,
    { timeout: 10000 }
  );
  await page.evaluate(() => {
    ui.view = 'outline';
    ui.currentDocId = state.rootId;
    for (let i = 0; i < 6; i++) actions.addNode(state.rootId, 0, { text: '极宽屏阅读行 ' + i + ' 用于测量正文行宽与容器宽度' });
    ui.activeKey = 'nav:files';
    updateSidebarActiveState();
    forceRender();
  });
  await page.waitForSelector('#content .outline .row .text', { timeout: 10000 });
}

function measureOutline() {
  const c = document.getElementById('content');
  const ccs = getComputedStyle(c);
  const padL = parseFloat(ccs.paddingLeft) || 0;
  const padR = parseFloat(ccs.paddingRight) || 0;
  const avail = c.clientWidth - padL - padR;
  const outline = document.querySelector('#content .outline');
  const row = document.querySelector('#content .outline .row');
  const text = document.querySelector('#content .outline .row .text');
  const tcs = text ? getComputedStyle(text) : null;
  return {
    contentClientWidth: c.clientWidth,
    paddingLeft: padL,
    paddingRight: padR,
    available: avail,
    outlineWidth: outline ? outline.getBoundingClientRect().width : -1,
    outlineMaxWidth: outline ? getComputedStyle(outline).maxWidth : 'none',
    rowWidth: row ? row.getBoundingClientRect().width : -1,
    textWidth: text ? text.getBoundingClientRect().width : -1,
    textLeft: text ? text.getBoundingClientRect().left : -1,
    textMaxWidth: tcs ? tcs.maxWidth : 'none',
    tokenContentMax: getComputedStyle(document.documentElement).getPropertyValue('--content-max').trim(),
    tokenContentMaxDoc: getComputedStyle(document.documentElement).getPropertyValue('--content-max-doc').trim(),
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

async function measureToggles(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('.main-toggle')).map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        cls: el.className,
        position: cs.position,
        centerX: r.left + r.width / 2,
        viewportCenter: window.innerWidth / 2,
        offsetFromCenter: (r.left + r.width / 2) - window.innerWidth / 2,
      };
    });
  });
}

async function measureActiveColorBars(page) {
  const nav = await page.evaluate(() => {
    ui.activeKey = 'nav:files';
    updateSidebarActiveState();
    const el = document.querySelector('.sb-nav-item.active');
    return el ? {
      exists: true,
      borderLeftWidth: getComputedStyle(el).borderLeftWidth,
      beforeContent: getComputedStyle(el, '::before').content,
      backgroundColor: getComputedStyle(el).backgroundColor,
    } : { exists: false };
  });
  const row = await page.evaluate(() => {
    ui.navExpanded.files = true;
    renderSidebar();
    let anyRow = document.querySelector('#sidebarLeft .sb-row[data-id]');
    if (!anyRow) {
      ui.navExpanded.database = true;
      renderSidebar();
      anyRow = document.querySelector('#sidebarLeft .sb-row[data-id]');
    }
    if (!anyRow) return { exists: false };
    ui.activeKey = 'node:' + anyRow.dataset.id;
    updateSidebarActiveState();
    const el = document.querySelector('.sb-row.active');
    return el ? {
      exists: true,
      borderLeftWidth: getComputedStyle(el).borderLeftWidth,
      beforeContent: getComputedStyle(el, '::before').content,
      backgroundColor: getComputedStyle(el).backgroundColor,
    } : { exists: false };
  });
  return { nav, row };
}

async function measureCalendar(page) {
  await page.evaluate(() => { navTo('calendar'); forceRender(); });
  await page.waitForSelector('#content .cal-page', { timeout: 10000 });
  return page.evaluate(() => {
    const c = document.getElementById('content');
    const ccs = getComputedStyle(c);
    const avail = c.clientWidth - (parseFloat(ccs.paddingLeft) || 0) - (parseFloat(ccs.paddingRight) || 0);
    const cal = document.querySelector('#content .cal-page');
    const top = document.querySelector('#content .cal-top');
    return {
      available: avail,
      calPageWidth: cal.getBoundingClientRect().width,
      calPageMaxWidth: getComputedStyle(cal).maxWidth,
      calTopWidth: top ? top.getBoundingClientRect().width : -1,
    };
  });
}

async function measureDatabase(page) {
  const tableId = await page.evaluate(() => {
    let dbRootId = null;
    for (const id in state.nodes) { if (state.nodes[id]._isDbRoot) { dbRootId = id; break; } }
    if (!dbRootId) dbRootId = actions.createDoc('数据库', { _isDbRoot: true, _isFolder: true, dbRoot: true });
    const id = actions.addNode(dbRootId, null, { text: '超宽屏表格', dbRoot: true });
    ui.view = 'auto';
    ui.currentDocId = id;
    ui.activeKey = 'nav:database';
    forceRender();
    return id;
  });
  await page.waitForSelector('#content .db-page', { timeout: 10000 });
  const m = await page.evaluate(() => {
    const c = document.getElementById('content');
    const ccs = getComputedStyle(c);
    const avail = c.clientWidth - (parseFloat(ccs.paddingLeft) || 0) - (parseFloat(ccs.paddingRight) || 0);
    const dbPage = document.querySelector('#content .db-page');
    const wrap = document.querySelector('#content .db-table-wrap');
    return {
      available: avail,
      dbPageWidth: dbPage.getBoundingClientRect().width,
      dbPageMaxWidth: getComputedStyle(dbPage).maxWidth,
      dbTableWrapWidth: wrap ? wrap.getBoundingClientRect().width : -1,
    };
  });
  return { tableId, ...m };
}

function saveMetrics(name, payload) {
  fs.mkdirSync(METRIC_DIR, { recursive: true });
  const file = path.join(METRIC_DIR, name);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log('[ultrawide] metrics -> ' + file);
}

test.describe('不变量 #76 · 极宽屏幕自适应', () => {
  test('3440x1440 带鱼屏：容器 100% / 正文限宽 1400px / 无横向滚动 / 三钮 50vw / 无左侧色条', async ({ page }) => {
    await page.setViewportSize({ width: 3440, height: 1440 });
    await bootApp(page);

    const outline = await page.evaluate(measureOutline);
    const toggles = await measureToggles(page);
    const active = await measureActiveColorBars(page);
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SHOT_DIR, 'uw-3440x1440-outline-2026-10-20.png') });

    const calendar = await measureCalendar(page);
    await page.screenshot({ path: path.join(SHOT_DIR, 'uw-3440x1440-calendar-2026-10-20.png') });

    const db = await measureDatabase(page);
    await page.screenshot({ path: path.join(SHOT_DIR, 'uw-3440x1440-db-2026-10-20.png') });

    saveMetrics('uw-layout-metrics-3440x1440-2026-10-20.json', { viewport: '3440x1440', outline, toggles, active, calendar, db });

    /* ① 容器 100%（差值 <= 1px 浮点容差） */
    expect(Math.abs(outline.outlineWidth - outline.available)).toBeLessThanOrEqual(1);
    expect(outline.outlineWidth).toBeGreaterThan(2900);
    expect(outline.tokenContentMax).toBe('100%');
    expect(outline.tokenContentMaxDoc).toBe('100%');
    /* ② 正文阅读限宽 1400px（文本左对齐，行仍满宽） */
    expect(outline.textMaxWidth).toMatch(/1400px/);
    expect(outline.textWidth).toBeLessThanOrEqual(1400.5);
    expect(Math.abs(outline.rowWidth - outline.available)).toBeLessThanOrEqual(1);
    /* ③ 无横向滚动条 */
    expect(outline.docScrollWidth).toBeLessThanOrEqual(outline.docClientWidth);
    /* ④ 多列视图满宽 */
    expect(Math.abs(calendar.calPageWidth - calendar.available)).toBeLessThanOrEqual(1);
    expect(calendar.calPageMaxWidth).toBe('100%');
    expect(Math.abs(db.dbPageWidth - db.available)).toBeLessThanOrEqual(1);
    expect(db.dbPageMaxWidth).toBe('100%');
    /* ⑤ 折叠三钮 fixed + 50vw 定位 */
    expect(toggles.length).toBe(3);
    for (const t of toggles) {
      expect(t.position).toBe('fixed');
      const expectOffset = t.cls.includes('left') ? -40 : (t.cls.includes('right') ? 40 : 0);
      expect(Math.abs(t.offsetFromCenter - expectOffset)).toBeLessThanOrEqual(1);
      expect(Math.abs(t.centerX - t.viewportCenter - expectOffset)).toBeLessThanOrEqual(1);
    }
    /* ⑥ 激活态无左侧色条 */
    expect(active.nav.exists).toBe(true);
    expect(active.nav.borderLeftWidth).toBe('0px');
    expect(['none', 'normal']).toContain(active.nav.beforeContent);
    expect(active.row.exists).toBe(true);
    expect(active.row.borderLeftWidth).toBe('0px');
    expect(['none', 'normal']).toContain(active.row.beforeContent);
  });

  test('3840x1080 超宽屏：同一口径（容器满宽 / 正文 1400px / 无横向滚动）', async ({ page }) => {
    await page.setViewportSize({ width: 3840, height: 1080 });
    await bootApp(page);

    const outline = await page.evaluate(measureOutline);
    const toggles = await measureToggles(page);
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SHOT_DIR, 'uw-3840x1080-outline-2026-10-20.png') });

    const calendar = await measureCalendar(page);
    saveMetrics('uw-layout-metrics-3840x1080-2026-10-20.json', { viewport: '3840x1080', outline, toggles, calendar });

    expect(Math.abs(outline.outlineWidth - outline.available)).toBeLessThanOrEqual(1);
    expect(outline.outlineWidth).toBeGreaterThan(3300);
    expect(outline.textMaxWidth).toMatch(/1400px/);
    expect(outline.textWidth).toBeLessThanOrEqual(1400.5);
    expect(outline.docScrollWidth).toBeLessThanOrEqual(outline.docClientWidth);
    expect(Math.abs(calendar.calPageWidth - calendar.available)).toBeLessThanOrEqual(1);
    for (const t of toggles) expect(t.position).toBe('fixed');
  });
});
