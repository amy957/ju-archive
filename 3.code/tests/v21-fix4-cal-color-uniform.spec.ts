import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix4 · 日历「淡色效果」四处一致 + 去掉事件块行首白点
 *
 * 缺陷（P0 取证：90过程材料/tmp/fix4/cal_color_audit_before.log，末行
 * CAL_COLOR_AUDIT_VERDICT: PASS）：
 *   · 有标签月视图事件块 `.cal-item.has-tag::before` 为 5×5 圆形 + currentColor（行内 color:#fff）
 *     ⇒ 事件标题前多一个**白点**（用户反馈的「• 前缀」），5/5 复现；
 *   · 四处标签色口径不一致：侧栏 .sb-tag-dot = 标签色 32% 淡底（探针反算等效 alpha 0.320），
 *     而日历事件块 / 当日待办勾选框 / 取色浮窗色块都是**实色**标签色（alpha=1），
 *     有标签事件块还用白色文字，视觉与左侧侧边栏不是同一套语言。
 *
 * 修复（src/style.css + src/views/calendar.ts + src/app/session.ts）：
 *   · `.cal-item::before{content:none!important}`，`.cal-item.has-tag::before` 整条删除（无白点）；
 *   · 新增 token `--tag-tint-pct:32%`（= P0 实测等效 alpha 0.320），四处统一由
 *     `color-mix(in srgb, <标签色> var(--tag-tint-pct), transparent)` 的**背景 alpha** 承载淡色：
 *     侧栏色点 / 月视图 .cal-item.has-tag / 当日待办 .cal-checkbox[data-tagged] / .tag-palette .sw；
 *   · 事件块文字回落到 `--fg`（日间黑、夜间白），描边用实色标签色；勾选框对勾改为标签色加深；
 *   · 取色浮窗选中态 `.sw.cur` 用 outline 标识（背景仍淡色）；JS 只注入 `--tag-color` / `--cb-color`，
 *     不再内联写 background/color。
 *
 * 断言口径全部来自产品自身的 computed style（不硬编码调色板色，也不直改 DOM/state）。
 * 承载方式与 fix1/fix2/fix9/fix10 spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
 */

const BASE = 'http://localhost:5173';

/* P0 探针实测：左侧 .sb-tag-dot 的淡色效果 = 标签色 32% ⇒ 反算等效 alpha 0.3200 */
const TINT_ALPHA = 0.32;
const TINT_ALPHA_TOL = 0.02;

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

/* ---------------- 颜色工具（与 src/style.css 的 color-mix 序列化口径一致） ---------------- */

/**
 * #RGB / #RRGGBB / rgb() / rgba() / color(srgb …) → {r,g,b,a}
 * （产品标签色出口 --tag-color 是 #RRGGBB；Chromium 把 color-mix 的 computed 值序列化为 color(srgb …)）
 */
function parseColor(s: string): { r: number; g: number; b: number; a: number } {
  const str = String(s || '').trim();
  let m = /^#([0-9a-f]{3})$/i.exec(str);
  if (m) {
    const h = m[1];
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: 1 };
  }
  m = /^#([0-9a-f]{6})$/i.exec(str);
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

async function bgOf(locator: ReturnType<Page['locator']>): Promise<{ raw: string; c: { r: number; g: number; b: number; a: number } }> {
  const raw = await locator.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);
  return { raw, c: parseColor(raw) };
}

/** 断言：背景 alpha == P0 实测淡色 alpha，且 RGB 仍是该标签色（不混白/黑） */
function expectTint(bg: { raw: string; c: { r: number; g: number; b: number; a: number } }, tagColor: string, stage: string): void {
  expect(Math.abs(bg.c.a - TINT_ALPHA),
    stage + '：背景 alpha 必须等于 P0 实测淡色 alpha ' + TINT_ALPHA + '（实测 ' + bg.raw + '）').toBeLessThanOrEqual(TINT_ALPHA_TOL);
  const t = parseColor(tagColor);
  expect(Math.max(Math.abs(bg.c.r - t.r), Math.abs(bg.c.g - t.g), Math.abs(bg.c.b - t.b)),
    stage + '：背景色相必须仍是标签色 ' + tagColor + '（实测 ' + bg.raw + '）').toBeLessThanOrEqual(2);
}

/* ---------------- 页面操作 ---------------- */

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
  return id as string;
}

/** 整页 reload → 重进日历（标签索引在新会话真实重建，左侧标签行才会出现） */
async function reloadAndBack(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'load' });
  await waitApp(page);
  await gotoCalendar(page);
  await page.waitForTimeout(800);
}

/** 左侧「标签」分组展开，并等到该标签行出现（标签索引分块后台构建，最长 60s） */
async function ensureTagRow(page: Page, tag: string): Promise<ReturnType<Page['locator']>> {
  const nav = page.locator('.sb-nav-item[data-nav="tags"]').first();
  await expect(nav, '左侧导航必须有「标签」项').toHaveCount(1, { timeout: 10_000 });
  const open = await nav.evaluate((el) => el.classList.contains('open'));
  if (!open) await nav.click();
  const row = page.locator('.sb-row[data-tag="' + tag + '"]');
  await expect.poll(async () => row.count(), { message: '左侧标签行 #' + tag + ' 必须出现', timeout: 60_000 }).toBeGreaterThan(0);
  return row.first();
}

/** 标签色（产品唯一出口：标签行色点上的 --tag-color） */
async function tagColorOf(row: ReturnType<Page['locator']>): Promise<string> {
  const c = await row.locator('.sb-tag-dot').evaluate((el) => getComputedStyle(el as HTMLElement).getPropertyValue('--tag-color').trim());
  expect(c, '标签行色点必须暴露 --tag-color').toBeTruthy();
  return c;
}

/** 打开取色浮窗（真实点色点），返回浮窗色块 locator；失败时关闭浮窗并抛错 */
async function openPaletteSwatch(page: Page, row: ReturnType<Page['locator']>, tagColor: string): Promise<ReturnType<Page['locator']>> {
  await row.locator('.sb-tag-dot').first().click();
  const palette = page.locator('.tag-palette');
  await expect(palette, '点侧栏色点必须打开取色浮窗').toHaveCount(1, { timeout: 10_000 });
  const sw = page.locator('.tag-palette .sw[data-c="' + tagColor + '"]');
  await expect(sw, '浮窗必须包含当前标签色色块 ' + tagColor).toHaveCount(1, { timeout: 10_000 });
  return sw.first();
}

async function closePalette(page: Page): Promise<void> {
  await page.keyboard.press('Escape').catch(() => { });
  await page.waitForTimeout(200);
  if (await page.locator('.tag-palette').count()) {
    await page.mouse.click(5, 5).catch(() => { });
    await page.waitForTimeout(200);
  }
  await expect(page.locator('.tag-palette'), '浮窗必须可关闭').toHaveCount(0, { timeout: 5000 });
}

function rowOf(page: Page, id: string) {
  return page.locator('.cal-node[data-id="' + id + '"]');
}

function monthItemOf(page: Page, id: string) {
  return page.locator('.cal-cell.today .cal-item[data-nid="' + id + '"]');
}

/** 选中今天格子，保证「当日待办」渲染出该行 */
async function focusToday(page: Page): Promise<void> {
  await page.locator('.cal-cell.today').first().click();
  await page.waitForTimeout(500);
}

/* ---------------- 用例 ---------------- */

test.describe('v2.1 fix4 · 日历标签色四处淡色一致 + 无行首白点', () => {
  test('月视图事件块无行首白点：有标签 / 无标签 .cal-item 的 ::before content 均为 none，且标题无 • 前缀', async ({ browser }) => {
    const { context, page } = await openCalendar(browser);
    try {
      const tagged = await createTodo(page, 'FIX4白点有标签 #FIX4TAG');
      const plain = await createTodo(page, 'FIX4白点无标签');
      await focusToday(page);

      for (const [label, id] of [['有标签', tagged], ['无标签', plain]] as const) {
        const item = monthItemOf(page, id);
        await expect(item, label + '：月视图必须出现事件块').toHaveCount(1, { timeout: 10_000 });
        const before = await item.evaluate((el) => {
          const s = getComputedStyle(el as HTMLElement, '::before');
          return { content: s.content, w: s.width, h: s.height, bg: s.backgroundColor };
        });
        expect(String(before.content).replace(/["']/g, ''), label + '：::before 必须无内容（content:none）').toBe('none');
        /* content:none ⇒ 伪元素不生成盒子，宽度 computed 为 auto（删除前为 5px） */
        const noBox = before.w === 'auto' || parseFloat(before.w) === 0;
        expect(noBox, label + '：::before 不得再占宽度（实测 ' + before.w + '，无白点）').toBe(true);
        const txt = (await item.textContent()) || '';
        expect(/[•·]/.test(txt), label + '：事件标题不得含 • / · 前缀（实测「' + txt.trim() + '」）').toBe(false);
        expect(txt.trim().length, label + '：事件标题必须有文本').toBeGreaterThan(0);
      }
    } finally {
      await context.close();
    }
  });

  test('四路淡色一致：侧栏色点 / 日历事件块 / 当日待办勾选框 / 取色浮窗色块 的 background alpha 均 = P0 实测值', async ({ browser }) => {
    test.setTimeout(180_000);
    const { context, page } = await openCalendar(browser);
    try {
      const id = await createTodo(page, 'FIX4四路淡色 #FIX4UNI');
      await reloadAndBack(page);
      await focusToday(page);

      const row = await ensureTagRow(page, 'FIX4UNI');
      const tagColor = await tagColorOf(row);

      /* A 左侧标签圆点 */
      const dotBg = await bgOf(row.locator('.sb-tag-dot'));
      expectTint(dotBg, tagColor, 'A 左侧色点');

      /* B 月视图事件块 */
      const item = monthItemOf(page, id);
      await expect(item, '月视图必须出现该事件块').toHaveCount(1, { timeout: 10_000 });
      const itemBg = await bgOf(item);
      expectTint(itemBg, tagColor, 'B 日历事件块');
      /* 事件块文字必须是深色 --fg（日间黑），不得是白色 */
      const itemColorRaw = await item.evaluate((el) => getComputedStyle(el as HTMLElement).color);
      const itemColor = parseColor(itemColorRaw);
      expect(Math.max(itemColor.r, itemColor.g, itemColor.b),
        'B 事件块文字必须是深色（--fg，实测 ' + itemColorRaw + '；淡底上白字即回归缺陷）').toBeLessThanOrEqual(60);
      /* 禁令：不得用内联 style 写颜色 */
      const inline = await item.evaluate((el) => {
        const s = (el as HTMLElement).style;
        return { bg: s.background || '', bgc: s.backgroundColor || '', color: s.color || '' };
      });
      expect(inline.bg + inline.bgc + inline.color, 'B 事件块不得用内联 style 写颜色（色值必须落 CSS 类）').toBe('');

      /* C 当日待办勾选框 */
      const cb = rowOf(page, id).locator('input.cal-checkbox');
      await expect(cb, '当日待办必须渲染勾选框').toHaveCount(1, { timeout: 10_000 });
      await expect(cb, '有标签：必须带 data-tagged="1"').toHaveAttribute('data-tagged', '1');
      const cbBg = await bgOf(cb);
      expectTint(cbBg, tagColor, 'C 当日待办勾选框');
      const cbBorder = await cb.evaluate((el) => getComputedStyle(el as HTMLElement).borderTopColor);
      const t = parseColor(tagColor);
      const b = parseColor(cbBorder);
      expect(Math.max(Math.abs(b.r - t.r), Math.abs(b.g - t.g), Math.abs(b.b - t.b)),
        'C 勾选框描边必须是实色标签色（实测 ' + cbBorder + '）').toBeLessThanOrEqual(2);

      /* D 取色浮窗色块（选中态） */
      const sw = await openPaletteSwatch(page, row, tagColor);
      const swBg = await bgOf(sw);
      expectTint(swBg, tagColor, 'D 取色浮窗色块');
      const swStyle = await sw.evaluate((el) => {
        const s = getComputedStyle(el as HTMLElement);
        return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, bg: s.backgroundColor };
      });
      expect(swStyle.outlineStyle, 'D 选中态必须有 outline 标识').not.toBe('none');
      expect(parseFloat(swStyle.outlineWidth), 'D 选中态 outline 必须有宽度').toBeGreaterThan(0);
      await closePalette(page);

      /* 四路 alpha 彼此一致（同一次渲染内横向比对） */
      const alphas = [dotBg.c.a, itemBg.c.a, cbBg.c.a, swBg.c.a];
      const spread = Math.max(...alphas) - Math.min(...alphas);
      expect(spread, '四路 background alpha 必须彼此一致（实测 ' + JSON.stringify(alphas) + '）').toBeLessThanOrEqual(TINT_ALPHA_TOL);
    } finally {
      await context.close();
    }
  });

  test('重开（reload）后四处淡色与标签色保持，白点不回来', async ({ browser }) => {
    test.setTimeout(180_000);
    const { context, page } = await openCalendar(browser);
    try {
      const id = await createTodo(page, 'FIX4重开保持 #FIX4KEEP');
      await reloadAndBack(page);
      await focusToday(page);

      const row = await ensureTagRow(page, 'FIX4KEEP');
      const tagColor = await tagColorOf(row);
      const before = await bgOf(row.locator('.sb-tag-dot'));

      await reloadAndBack(page);
      await focusToday(page);

      /* A 侧栏色点 */
      const row2 = await ensureTagRow(page, 'FIX4KEEP');
      const after = await bgOf(row2.locator('.sb-tag-dot'));
      expect((await tagColorOf(row2)).toLowerCase(), '重开后标签色不得变化').toBe(tagColor.toLowerCase());
      expectTint(after, tagColor, '重开后 A 左侧色点');
      expect(Math.abs(after.c.a - before.c.a), '重开后 alpha 不得漂移').toBeLessThanOrEqual(TINT_ALPHA_TOL);

      /* B 事件块（无白点 + 淡色） */
      const item = monthItemOf(page, id);
      await expect(item, '重开后月视图必须仍有该事件块').toHaveCount(1, { timeout: 10_000 });
      expectTint(await bgOf(item), tagColor, '重开后 B 日历事件块');
      const content = await item.evaluate((el) => String(getComputedStyle(el as HTMLElement, '::before').content).replace(/["']/g, ''));
      expect(content, '重开后事件块仍不得有 ::before 圆点').toBe('none');

      /* C 勾选框 */
      const cb = rowOf(page, id).locator('input.cal-checkbox');
      await expect(cb, '重开后勾选框必须仍在').toHaveCount(1, { timeout: 10_000 });
      await expect(cb, '重开后 data-tagged 必须保持').toHaveAttribute('data-tagged', '1');
      expectTint(await bgOf(cb), tagColor, '重开后 C 当日待办勾选框');

      /* D 浮窗色块 */
      const sw = await openPaletteSwatch(page, row2, tagColor);
      expectTint(await bgOf(sw), tagColor, '重开后 D 取色浮窗色块');
      await closePalette(page);
    } finally {
      await context.close();
    }
  });
});
