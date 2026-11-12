import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix2 · 日历「当日待办」勾选框＝标签色圆点（不再显示标签文本）
 *
 * 缺陷与根因（fix2 P0 取证：90过程材料/tmp/fix2/cal_todo_tagchip_before.log，末行 VERDICT=H3）：
 *   · H1：fix1 的标签可见化把 `.cal-node-tags/.cal-node-tag` 文本画进了行内（实测 display:block、
 *     可见文本 "#FIX1TAG"），用户要的是「只有勾选框颜色，不要文本」；
 *   · H3：点勾选框后 state.done 翻转（true）但界面勾选框不翻转（checked=false），calRev 9→9 ——
 *     actions.toggleDone 只 commit，没有推进 _calDataRev，_calDayCache/_renderDayCache 里仍是写库前的
 *     旧节点对象，紧随其后的重绘把旧行原样画回来，用户视角就是「点了没反应」。
 *
 * 修复（src/views/calendar.ts + src/style.css）：
 *   · renderCalNode：不再输出 .cal-node-tags 文本节点；tags 非空 → checkbox.dataset.tagged='1'、
 *     title='#a #b'、--cb-color=首个标签色；tags 空 → 移除 data-tagged / 清 title / 移除 --cb-color；
 *   · .cal-checkbox 改为圆点：无标签空心（描边 #9aa0a6）、有标签带标签色、完成态对勾；
 *   · checkbox change：toggleDone → saveUI → invalidateCalIndex（bump calRev）→ forceRender。
 *
 * v2.1 fix4 · P2 口径变更（本 spec 的「有标签背景」断言已随之更新，非夹具修改）：
 *   · 有标签勾选框不再填「实色标签色」，改为与左侧侧边栏 .sb-tag-dot 同款的「淡色效果」——
 *     标签色 alpha 32%（P0 取证 90过程材料/tmp/fix4/cal_color_audit_before.log，末行
 *     CAL_COLOR_AUDIT_VERDICT: PASS，其中 REF_ALPHA_EQUIV=0.3200 由 .sb-tag-dot 的 color-mix 反算）；
 *   · 描边仍是实色标签色；完成态对勾改为标签色加深（不再是纯白，淡底上才可读）。
 *   ⇒ 断言改为「背景 alpha == P0 实测值 且 RGB 仍等于该标签色」，不再断言实色。
 *
 * 全部断言均为真实交互（真实点勾选框 / 真实右键菜单 / 真实 reload），无夹具直改 state、无夹具改 DOM。
 * 承载方式与 fix1 / fix9 / fix10 spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
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
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

/* 标签颜色不是固定值：session.getTagColor 按标签名哈希落调色板（实测 #FIX2TAG → rgb(59,154,217)），
   所以「期望色」一律从产品自身的标签渲染点读取（右键菜单标签行的 .sb-tag-dot 的 --tag-color），
   绝不在这份 spec 里硬编码某个标签色。 */
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

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

/* ---------------- 页面操作 ---------------- */

async function waitApp(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).JU && typeof (window as any).JU.getState === 'function' && typeof (window as any).JU.getCalDataRev === 'function',
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
  return id as string;
}

async function calRev(page: Page): Promise<number> {
  return page.evaluate(() => Number((window as any).JU.getCalDataRev()));
}

async function readNode(page: Page, id: string): Promise<{ done: boolean; tags: string[]; manual: string[] }> {
  return page.evaluate((nid) => {
    const s = (window as any).JU.getState();
    const n = (s.nodes || {})[nid] || {};
    return {
      done: !!n.done,
      tags: (n.tags || []).slice(),
      manual: (n._manualTags || []).slice(),
    };
  }, id);
}

/** #RRGGBB / rgb() → "rgb(r, g, b)"（与 getComputedStyle 同口径，用于 toHaveCSS 断言） */
function rgbOf(c: string): string {
  const s = String(c || '').trim();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
  if (rgb) return 'rgb(' + rgb[1] + ', ' + rgb[2] + ', ' + rgb[3] + ')';
  const hex = /^#([0-9a-f]{6})$/i.exec(s);
  if (!hex) throw new Error('无法解析颜色（期望 #RRGGBB 或 rgb()）：' + s);
  const v = parseInt(hex[1], 16);
  return 'rgb(' + ((v >> 16) & 255) + ', ' + ((v >> 8) & 255) + ', ' + (v & 255) + ')';
}

/** 勾选框内联 --cb-color（renderCalNode 由 getTagColor(首个标签) 写入） */
async function cbColorVar(cb: ReturnType<Page['locator']>): Promise<string> {
  return cb.evaluate((el) => String((el as HTMLElement).style.getPropertyValue('--cb-color') || '').trim());
}

/* v2.1 fix4 · P2：有标签勾选框的淡色效果口径 = 标签色 alpha 32%（P0 探针实测等效 alpha 0.320）。 */
const TINT_ALPHA = 0.32;
const TINT_ALPHA_TOL = 0.02;

/** #RRGGBB / rgb() / rgba() / color(srgb …) → {r,g,b,a}（标签色出口是 #RRGGBB；color-mix 的 computed 值序列化为 color(srgb …)） */
function parseColor(s: string): { r: number; g: number; b: number; a: number } {
  const str = String(s || '').trim();
  let m = /^#([0-9a-f]{6})$/i.exec(str);
  if (m) {
    const v = parseInt(m[1], 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255, a: 1 };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(str);
  if (m) {
    const p = m[1].split(/[,/]/).map((x) => x.trim()).filter(Boolean);
    const num = (i: number) => (/%$/.test(p[i]) ? (parseFloat(p[i]) * 255) / 100 : parseFloat(p[i]));
    return { r: num(0), g: num(1), b: num(2), a: p[3] === undefined ? 1 : parseFloat(p[3]) };
  }
  m = /^color\(\s*srgb\s+([^)]+)\)$/i.exec(str);
  if (m) {
    const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number);
    return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p[3] === undefined ? 1 : p[3] };
  }
  if (/^transparent$/i.test(str)) return { r: 0, g: 0, b: 0, a: 0 };
  throw new Error('无法解析 computed 颜色：' + str);
}

/** 断言「背景 = 标签色淡色」：alpha 必须等于 P0 实测值，RGB 必须仍等于该标签色（不混白/黑） */
async function expectTintOf(cb: ReturnType<Page['locator']>, tagColor: string, stage: string): Promise<void> {
  const bg = await cb.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);
  const c = parseColor(bg);
  expect(Math.abs(c.a - TINT_ALPHA),
    stage + '：勾选框背景 alpha 必须等于 P0 实测淡色 alpha ' + TINT_ALPHA + '（实测 ' + bg + '）')
    .toBeLessThanOrEqual(TINT_ALPHA_TOL);
  const t = parseColor(tagColor);
  expect(Math.max(Math.abs(c.r - t.r), Math.abs(c.g - t.g), Math.abs(c.b - t.b)),
    stage + '：勾选框背景色相必须仍是标签色 ' + tagColor + '（实测 ' + bg + '）').toBeLessThanOrEqual(2);
}

/** 真实右键当日待办行正文；菜单没起来时重试（写库后一次重渲染会让旧坐标失效） */
async function rightClickRow(page: Page, id: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const box = await page.evaluate((nid) => {
      const el = document.querySelector('.cal-node .text[data-id="' + CSS.escape(nid) + '"]') as HTMLElement | null;
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + Math.min(40, Math.max(8, r.width / 2)), y: r.top + r.height / 2 };
    }, id);
    expect(box, '当日待办行必须可定位（.cal-node .text[data-id]）').not.toBeNull();
    await page.mouse.click(box!.x, box!.y, { button: 'right' });
    await page.waitForTimeout(400);
    if (await page.locator('.cal-ctx').count()) return;
    await page.keyboard.press('Escape').catch(() => { });
    await page.waitForTimeout(200);
  }
  throw new Error('右键菜单三次均未打开（.cal-ctx）');
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

/** 造一个标签源（正文带 #tag 的第二条待办），使「选择标签」列表里有该标签 */
async function ensureTagExists(page: Page, tag: string): Promise<void> {
  const already = await page.evaluate((t) => {
    const s = (window as any).JU.getState();
    let hit = false;
    Object.keys(s.nodes || {}).forEach((k) => {
      if (((s.nodes[k] || {}).tags || []).map(String).includes(t)) hit = true;
    });
    return hit;
  }, tag);
  if (already) return;
  await createTodo(page, '#' + tag + ' 标签源');
  await expect
    .poll(async () => page.evaluate((t) => {
      const s = (window as any).JU.getState();
      let hit = false;
      Object.keys(s.nodes || {}).forEach((k) => {
        if (((s.nodes[k] || {}).tags || []).map(String).includes(t)) hit = true;
      });
      return hit;
    }, tag), { message: '标签 ' + tag + ' 必须在 state 中出现', timeout: 15_000 })
    .toBe(true);
}

/**
 * 右键「选择标签」→ 点某一行（等值匹配，禁止 #FIX1TAG 命中 #FIX1TAG2 的子串误点）。
 * 返回该标签在产品里的真实颜色：取自菜单标签行 `.sb-tag-dot` 的 --tag-color（同一 getTagColor 出口），
 * 这样「勾选框是否等于标签色」的期望值来自产品自身，而不是 spec 里硬编码一个调色板色。
 */
async function setTagViaMenu(page: Page, id: string, tag: string): Promise<string> {
  await rightClickRow(page, id);
  await expandFold(page, '选择标签');
  const row = page
    .locator('.cal-ctx .cal-ctx-tag')
    .filter({ hasText: new RegExp('^#' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '✓?$') })
    .first();
  await expect(row, '「选择标签」必须列出 #' + tag).toHaveCount(1, { timeout: 15_000 });
  const color = await row.evaluate((el) => {
    const dot = el.querySelector('.sb-tag-dot') as HTMLElement | null;
    if (!dot) return '';
    return String(getComputedStyle(dot).getPropertyValue('--tag-color') || '').trim();
  });
  expect(color, '菜单标签行必须暴露 --tag-color（产品标签色唯一出口）').toBeTruthy();
  await row.click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape').catch(() => { });
  await page.waitForTimeout(300);
  await expect(page.locator('.cal-ctx'), '写库后菜单必须可关闭').toHaveCount(0, { timeout: 5000 });
  return color;
}

/** 右键「选择标签」→ 点「清除全部标签」 */
async function clearTagsViaMenu(page: Page, id: string): Promise<void> {
  await rightClickRow(page, id);
  await expandFold(page, '选择标签');
  const clr = page.locator('.cal-ctx .cal-ctx-item').filter({ hasText: '清除全部标签' }).first();
  await expect(clr, '「选择标签」必须提供「清除全部标签」').toHaveCount(1, { timeout: 5000 });
  await clr.click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape').catch(() => { });
  await page.waitForTimeout(300);
  await expect(page.locator('.cal-ctx'), '清除后菜单必须可关闭').toHaveCount(0, { timeout: 5000 });
}

async function reloadAndBack(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'load' });
  await waitApp(page);
  await gotoCalendar(page);
  await page.waitForTimeout(800);
}

function rowOf(page: Page, id: string) {
  return page.locator('.cal-node[data-id="' + id + '"]');
}

/* ---------------- 用例 ---------------- */

test.describe('v2.1 fix2 · 当日待办勾选框（标签色圆点）与标签文本隐藏', () => {
  test('无标签：勾选框无 data-tagged 且背景透明；点击后 checked 与 state.done 同步翻转，重开仍保持', async ({ browser }) => {
    const { context, page } = await openCalendar(browser);
    try {
      const id = await createTodo(page, 'FIX2无标签待办');
      const row = rowOf(page, id);
      const cb = row.locator('input.cal-checkbox');

      await expect(cb, '无标签必须渲染勾选框').toHaveCount(1, { timeout: 10_000 });
      expect(await cb.getAttribute('data-tagged'), '无标签：不得带 data-tagged').toBeNull();
      await expect(cb, '无标签：勾选框背景必须透明（空心圆）').toHaveCSS('background-color', TRANSPARENT);
      await expect(cb, '无标签：title 必须为空').toHaveAttribute('title', '');
      await expect(row.locator('.cal-node-tag'), 'fix2：当日待办不得显示标签文本').toHaveCount(0);
      expect((await readNode(page, id)).done, '初始未完成').toBe(false);

      const rev0 = await calRev(page);
      await cb.click();
      await expect(cb, '点击后勾选框必须变为已选中（DOM 回显，fix2 H3 回归点）').toBeChecked({ timeout: 10_000 });
      await expect.poll(async () => (await readNode(page, id)).done, { message: 'state.done 必须翻转为 true', timeout: 10_000 }).toBe(true);
      expect(await calRev(page), '勾选完成态必须推进日历数据代次（bump calRev），否则日缓存回显旧行').toBeGreaterThan(rev0);
      await expect(cb, '无标签已勾选：勾选框用主题蓝底').toHaveCSS('background-color', 'rgb(26, 115, 232)');

      await reloadAndBack(page);
      const cb2 = rowOf(page, id).locator('input.cal-checkbox');
      await expect(cb2, '重开后勾选框仍必须是已选中').toBeChecked({ timeout: 10_000 });
      expect((await readNode(page, id)).done, '重开后 state.done 必须仍为 true').toBe(true);
      expect(await cb2.getAttribute('data-tagged'), '重开后仍不得带 data-tagged').toBeNull();
    } finally {
      await context.close();
    }
  });

  test('有标签：标签文本不显示，勾选框带 data-tagged=1、标签色背景、title 含 #标签', async ({ browser }) => {
    const { context, page } = await openCalendar(browser);
    try {
      const id = await createTodo(page, 'FIX2有标签待办');
      await ensureTagExists(page, 'FIX2TAG');
      const tagColor = await setTagViaMenu(page, id, 'FIX2TAG');

      const row = rowOf(page, id);
      const cb = row.locator('input.cal-checkbox');
      const n = await readNode(page, id);
      expect(n.tags, 'state.tags 必须包含 FIX2TAG').toContain('FIX2TAG');
      expect(n.manual, '_manualTags 必须包含 FIX2TAG').toContain('FIX2TAG');
      const color = rgbOf(tagColor);
      expect((await cbColorVar(cb)).toLowerCase(), '勾选框 --cb-color 必须等于该标签的产品标签色 ' + tagColor)
        .toBe(tagColor.toLowerCase());
      expect(color, '标签色不得是透明（否则「实心圆点」无意义）').not.toBe(TRANSPARENT);

      await expect(row.locator('.cal-node-tag'), 'fix2：标签文本节点必须不存在').toHaveCount(0, { timeout: 10_000 });
      await expect(row.locator('.cal-node-tags'), 'fix2：标签容器不得出现').toHaveCount(0);
      await expect(cb, '有标签：必须带 data-tagged="1"').toHaveAttribute('data-tagged', '1', { timeout: 10_000 });
      await expect(cb, '有标签：title 必须含 #FIX2TAG').toHaveAttribute('title', /#FIX2TAG/, { timeout: 10_000 });
      await expectTintOf(cb, tagColor, '有标签');
      await expect(cb, '有标签：描边必须仍是实色标签色 ' + color).toHaveCSS('border-top-color', color);
    } finally {
      await context.close();
    }
  });

  test('点击有标签的勾选框：checked 翻转、标签色不变，重开后完成态与标签色都保持', async ({ browser }) => {
    const { context, page } = await openCalendar(browser);
    try {
      const id = await createTodo(page, 'FIX2标签勾选待办');
      await ensureTagExists(page, 'FIX2TAG');
      const tagColor = await setTagViaMenu(page, id, 'FIX2TAG');

      const color = rgbOf(tagColor);
      const cb = rowOf(page, id).locator('input.cal-checkbox');
      await expect(cb).not.toBeChecked();
      await expectTintOf(cb, tagColor, '勾选前');

      await cb.click();
      await expect(cb, '点击后必须变为已选中').toBeChecked({ timeout: 10_000 });
      await expectTintOf(cb, tagColor, '已选中（不得回退成主题蓝）');
      await expect(cb, '已选中：data-tagged 必须仍在').toHaveAttribute('data-tagged', '1');
      await expect.poll(async () => (await readNode(page, id)).done, { message: 'state.done 必须为 true', timeout: 10_000 }).toBe(true);
      await expect(rowOf(page, id).locator('.cal-node-tag'), 'fix2：勾选后仍不得显示标签文本').toHaveCount(0);

      await reloadAndBack(page);
      const cb2 = rowOf(page, id).locator('input.cal-checkbox');
      await expect(cb2, '重开后完成态必须保持').toBeChecked({ timeout: 10_000 });
      await expectTintOf(cb2, tagColor, '重开后');
      await expect(cb2, '重开后 title 必须仍含标签').toHaveAttribute('title', /#FIX2TAG/);
      await expect(rowOf(page, id).locator('.cal-node-tag'), '重开后仍不得显示标签文本').toHaveCount(0);
      expect((await readNode(page, id)).done, '重开后 state.done 必须仍为 true').toBe(true);
    } finally {
      await context.close();
    }
  });

  test('多标签：勾选框取第一个标签色，title 同时含两个标签名，标签文本不显示', async ({ browser }) => {
    test.setTimeout(120_000);
    const { context, page } = await openCalendar(browser);
    try {
      const id = await createTodo(page, 'FIX2多标签待办');
      await ensureTagExists(page, 'FIX2TAGA');
      await ensureTagExists(page, 'FIX2TAGB');
      const colorA = await setTagViaMenu(page, id, 'FIX2TAGA');
      const colorB = await setTagViaMenu(page, id, 'FIX2TAGB');

      const n = await readNode(page, id);
      expect(n.tags, '#FIX2TAGA 必须写入').toContain('FIX2TAGA');
      expect(n.tags, '#FIX2TAGB 必须写入').toContain('FIX2TAGB');
      expect(n.tags.length, '必须恰好两个标签（等值匹配不得重复写）').toBe(2);
      const first = n.tags[0];
      const color = rgbOf(colorA);
      expect((await cbColorVar(rowOf(page, id).locator('input.cal-checkbox'))).toLowerCase(),
        '多标签：--cb-color 必须取第一个标签（' + first + '）的颜色 ' + colorA).toBe(colorA.toLowerCase());

      const row = rowOf(page, id);
      const cb = row.locator('input.cal-checkbox');
      await expect(cb, '多标签：必须带 data-tagged="1"').toHaveAttribute('data-tagged', '1', { timeout: 10_000 });
      await expectTintOf(cb, colorA, '多标签首个标签色（' + first + '）');
      if (rgbOf(colorB) !== color) {
        const bgNow = parseColor(await cb.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor));
        const b2 = parseColor(colorB);
        expect(Math.max(Math.abs(bgNow.r - b2.r), Math.abs(bgNow.g - b2.g), Math.abs(bgNow.b - b2.b)),
          '多标签：背景不得取第二个标签色（' + n.tags[1] + '）').toBeGreaterThan(2);
      }
      /* fix3 · P0：title 的标签顺序由插入顺序决定，不应强求正序/反序 —— 只断言两个标签名都在 */
      const title = await cb.getAttribute('title');
      expect(title, '多标签：title 必须包含第一个标签名').toContain('#' + first);
      expect(title, '多标签：title 必须包含第二个标签名').toContain('#' + n.tags[1]);
      await expect(row.locator('.cal-node-tag'), '多标签：标签文本必须不可见').toHaveCount(0);
      await expect(row.locator('.cal-node-tags'), '多标签：标签容器不得出现').toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('右键清除标签：移除 data-tagged、背景恢复透明、title 清空；再选标签：颜色恢复且文本仍不显示', async ({ browser }) => {
    test.setTimeout(120_000);
    const { context, page } = await openCalendar(browser);
    try {
      const id = await createTodo(page, 'FIX2清除标签待办');
      await ensureTagExists(page, 'FIX2TAG');
      const tagColor = await setTagViaMenu(page, id, 'FIX2TAG');

      const cb = rowOf(page, id).locator('input.cal-checkbox');
      const color = rgbOf(tagColor);
      await expectTintOf(cb, tagColor, '清除前');

      await clearTagsViaMenu(page, id);
      const nClear = await readNode(page, id);
      expect(nClear.tags, '清除后 state.tags 必须为空').toHaveLength(0);
      expect(nClear.manual, '清除后 _manualTags 必须为空').toHaveLength(0);
      await expect(cb, '清除后：必须移除 data-tagged').not.toHaveAttribute('data-tagged', '1');
      await expect(cb, '清除后：背景必须恢复透明').toHaveCSS('background-color', TRANSPARENT);
      await expect(cb, '清除后：title 必须清空').toHaveAttribute('title', '');
      await expect(rowOf(page, id).locator('.cal-node-tag'), '清除后仍不得显示标签文本').toHaveCount(0);

      /* 再右键选同一个标签：颜色恢复，标签文本仍不显示（只隐藏文本，不删标签数据） */
      await setTagViaMenu(page, id, 'FIX2TAG');
      const nBack = await readNode(page, id);
      expect(nBack.tags, '重新选标签后 state.tags 必须再含 FIX2TAG').toContain('FIX2TAG');
      const cb2 = rowOf(page, id).locator('input.cal-checkbox');
      await expect(cb2, '重新选标签后：必须恢复 data-tagged').toHaveAttribute('data-tagged', '1', { timeout: 10_000 });
      await expectTintOf(cb2, tagColor, '重新选标签后');
      await expect(cb2, '重新选标签后：title 必须含标签').toHaveAttribute('title', /#FIX2TAG/);
      await expect(rowOf(page, id).locator('.cal-node-tag'), '重新选标签后：标签文本仍不得显示').toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
