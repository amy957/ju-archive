import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix1 · 日历「当日待办」右键设置时间 / 标签 / 优先级 + 四象限图标一致性
 *
 * 缺陷与根因（fix1 P0 取证：90过程材料/tmp/fix1/cal_todo_ctx_after-H3PRE.log）：
 *   右键菜单写库走 deps.commit + persistNow，字段确实落库并被 IDB 镜像，但没有推进日历数据代次
 *   （JU.getCalDataRev() 7 → 7）。renderCalendarPage 的日缓存 getDayNodes 以 _calDataRev 为代次，
 *   commit 的结构化共享只换掉 state.nodes[id] 的对象引用，缓存里仍是写库前的旧对象快照 ⇒
 *   随后的 forceRender 把旧行原样画回来：**右键设了时间 / 标签 / 优先级，当日待办不显示**（H3）。
 *
 * 修复（src/views/calendar.ts）：
 *   · applyCalCtxPatch(id, mutator, opts)：commit → saveUI → persistNow → invalidateCalIndex()（bump calRev）
 *     → forceRender()，六个右键写库点（时间保存/清除、标签勾选/全清、优先级设置/清除）全部收敛到此；
 *   · renderCalNode 增加 .cal-node-tags 可见化（此前 tags 只落在勾选框底色与 title 上）；
 *   · priorityBadges(p) 唯一渲染器：月视图单元格 / 周视图事件块 / 当日待办共用，
 *     DOM 契约固定 data-prio + aria-label + 图标组合（重要不紧急=! / 紧急不重要=⚡ / 重要紧急=!⚡ / 不重要不紧急=OK）。
 *
 * 承载方式与 fix9 / fix10 spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
 * 全部断言均为真实交互（真实右键 → 真实点菜单 / 真实点下拉 / 真实点保存），无夹具直改 state。
 */

const BASE = 'http://localhost:5173';

/* v2.1 fix4 · P2：有标签勾选框背景＝标签色淡色（alpha 32%，P0 探针实测等效 alpha 0.320）。
   本 spec 原先断言「实色标签色 rgb(128, 100, 200)」，随产品口径变更改为「alpha==0.32 且 RGB 仍是标签色」。 */
const TINT_ALPHA = 0.32;
const TINT_ALPHA_TOL = 0.02;

/** rgb()/rgba()/color(srgb …) → {r,g,b,a}（Chromium 把 color-mix 的 computed 值序列化为 color(srgb …)） */
function parseComputedColor(s: string): { r: number; g: number; b: number; a: number } {
  const str = String(s || '').trim();
  let m = /^rgba?\(([^)]+)\)$/i.exec(str);
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

async function readNode(page: Page, id: string): Promise<{ time: string | null; tags: string[]; manual: string[]; priority: number }> {
  return page.evaluate((nid) => {
    const n = ((window as any).JU.getState().nodes || {})[nid] || {};
    return {
      time: n.time || null,
      tags: (n.tags || []).slice(),
      manual: (n._manualTags || []).slice(),
      priority: Number(n.priority) || 0,
    };
  }, id);
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

async function pickTimeOption(page: Page, selIndex: number, label: string): Promise<void> {
  await page.locator('.cal-ctx .cal-sel').nth(selIndex).click();
  const opt = page.locator('.cal-sel-panel .cal-sel-opt').filter({ hasText: new RegExp('^' + label + '$') }).first();
  await expect(opt, '时间下拉必须含选项 ' + label).toHaveCount(1, { timeout: 5000 });
  await opt.click();
  await page.waitForTimeout(150);
}

/** 右键设置时间（真实点 小时 / 分钟 下拉 + 保存） */
async function setTimeViaMenu(page: Page, id: string, hh: string, mm: string): Promise<void> {
  await rightClickRow(page, id);
  await expandFold(page, '设置时间');
  await pickTimeOption(page, 0, hh);
  await pickTimeOption(page, 1, mm);
  await page.locator('.cal-ctx .cal-ctx-btn.primary').filter({ hasText: '保存' }).first().click();
  await expect(page.locator('.cal-ctx'), '保存后菜单必须收起').toHaveCount(0, { timeout: 5000 });
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

async function setTagViaMenu(page: Page, id: string, tag: string): Promise<void> {
  await rightClickRow(page, id);
  await expandFold(page, '选择标签');
  /* v2.1 fix2 · P2：标签行改为**等值**匹配（行文本形如 "#FIX1TAG✓"）。
     原 hasText 子串匹配会把 #FIX1TAG 命中 #FIX1TAG2 —— fix2 首轮探针实测踩到（选错行）。 */
  const row = page
    .locator('.cal-ctx .cal-ctx-tag')
    .filter({ hasText: new RegExp('^#' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '✓?$') })
    .first();
  await expect(row, '「选择标签」必须列出 #' + tag).toHaveCount(1, { timeout: 15_000 });
  await row.click();
  await page.waitForTimeout(500);
  await closeMenu(page);
}

/**
 * 四象限固定映射（任务书 P2）：
 *   important        = 重要不紧急   → 红色 !
 *   urgent           = 紧急不重要   → ⚡
 *   important_urgent = 重要紧急     → 红色 ! + ⚡（顺序 !⚡）
 *   none             = 不重要不紧急 → OK
 * 注意：右键菜单按钮文案是产品既有口径「不紧急不重要」（第 4 项），而 PRIO_LABEL 的 aria-label 是
 * 「不重要不紧急」；两者同为 priority=4，这里如实区分 menu（点击文案）与 label（aria-label 契约）。
 */
const PRIO_CASES = [
  { menu: '重要紧急', label: '重要紧急', key: 'important_urgent', icon: '!⚡' },
  { menu: '重要不紧急', label: '重要不紧急', key: 'important', icon: '!' },
  { menu: '紧急不重要', label: '紧急不重要', key: 'urgent', icon: '⚡' },
  { menu: '不紧急不重要', label: '不重要不紧急', key: 'none', icon: 'OK' },
];

async function setPrioViaMenu(page: Page, id: string, label: string): Promise<void> {
  await rightClickRow(page, id);
  await expandFold(page, '优先级');
  const btn = page.locator('.cal-ctx .cal-ctx-prio .cal-ctx-btn').filter({ hasText: new RegExp('^' + label + '$') }).first();
  await expect(btn, '优先级按钮「' + label + '」必须存在').toHaveCount(1, { timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(400);
  await closeMenu(page);
}

/* ---------------- 用例 ---------------- */

test.describe('v2.1 fix1 · 日历当日待办右键设置 + 四象限图标', () => {
  test('右键「设置时间」→ 当日待办立刻显示 18:00（calRev 推进）', async ({ browser }) => {
    const { context, page } = await openCalendar(browser);
    try {
      const id = await createTodo(page, 'FIX1时间待办');
      const rev0 = await calRev(page);
      await setTimeViaMenu(page, id, '18', '00');

      const row = page.locator('.cal-node[data-id="' + id + '"]');
      await expect(row.locator('.cal-node-time'), '右键设置时间后当日待办必须立刻显示 18:00').toHaveText('18:00', { timeout: 10_000 });
      expect((await readNode(page, id)).time, 'state.time 必须为 18:00').toBe('18:00');
      expect(await calRev(page), '写库必须推进日历数据代次（bump calRev），否则日缓存回显旧对象').toBeGreaterThan(rev0);
    } finally {
      await context.close();
    }
  });

  test('右键「选择标签」→ 当日待办勾选框立刻变标签色（不再显示标签文本）', async ({ browser }) => {
    const { context, page } = await openCalendar(browser);
    try {
      const id = await createTodo(page, 'FIX1标签待办');
      await ensureTagExists(page, 'FIX1TAG');
      const rev0 = await calRev(page);
      await setTagViaMenu(page, id, 'FIX1TAG');

      const row = page.locator('.cal-node[data-id="' + id + '"]');
      const cb = row.locator('input.cal-checkbox');
      /* v2.1 fix2 · P1 口径变更：标签不进正文，只进勾选框（颜色 + title + data-tagged）。
         fix1 的行内 .cal-node-tag 可见化已回退 —— 文本节点不再渲染（toHaveCount 0）。 */
      await expect(row.locator('.cal-node-tag'), 'fix2：当日待办不得再行内显示标签文本').toHaveCount(0, { timeout: 10_000 });
      await expect(cb, '有标签：勾选框必须带 data-tagged="1"').toHaveAttribute('data-tagged', '1', { timeout: 10_000 });
      await expect(cb, '有标签：勾选框 title 必须列出该标签').toHaveAttribute('title', /#FIX1TAG/, { timeout: 10_000 });
      /* v2.1 fix4 · P2：背景由「实色标签色」改为「标签色淡色」（alpha 32%，P0 实测 0.320）；
         色相仍必须是首个标签色（getTagColor 默认 #8064C8 = rgb(128, 100, 200)）。 */
      const cbBgRaw2 = await cb.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);
      const cbBg2 = parseComputedColor(cbBgRaw2);
      expect(Math.abs(cbBg2.a - TINT_ALPHA),
        '有标签：勾选框背景 alpha 必须等于 P0 实测淡色 alpha ' + TINT_ALPHA + '（实测 ' + cbBgRaw2 + '）').toBeLessThanOrEqual(TINT_ALPHA_TOL);
      expect(Math.max(Math.abs(cbBg2.r - 128), Math.abs(cbBg2.g - 100), Math.abs(cbBg2.b - 200)),
        '有标签：勾选框背景色相必须是首个标签色 rgb(128, 100, 200)（实测 ' + cbBgRaw2 + '）').toBeLessThanOrEqual(2);
      const n = await readNode(page, id);
      expect(n.tags, 'state.tags 必须包含 FIX1TAG').toContain('FIX1TAG');
      expect(n.manual, '_manualTags 必须包含 FIX1TAG（右键写的是手动标签）').toContain('FIX1TAG');
      expect(await calRev(page), '写库必须推进日历数据代次（bump calRev）').toBeGreaterThan(rev0);
    } finally {
      await context.close();
    }
  });

  test('四类优先级：当日待办与日历单元格 data-prio / aria-label / 图标组合一致', async ({ browser }) => {
    test.setTimeout(180_000);
    const { context, page } = await openCalendar(browser);
    try {
      const id = await createTodo(page, 'FIX1优先级待办');
      for (const c of PRIO_CASES) {
        await setPrioViaMenu(page, id, c.menu);

        const rowBadge = page.locator('.cal-node[data-id="' + id + '"] .prio-badge').first();
        await expect(rowBadge, '当日待办必须出现优先级徽章（' + c.menu + '）').toHaveCount(1, { timeout: 10_000 });
        await expect(rowBadge, '当日待办徽章 data-prio').toHaveAttribute('data-prio', c.key);
        await expect(rowBadge, '当日待办徽章 aria-label').toHaveAttribute('aria-label', c.label);
        await expect(rowBadge, '当日待办徽章图标组合').toHaveText(c.icon);

        const cellBadge = page.locator('.cal-cell.today .cal-item[data-nid="' + id + '"] .prio-badge').first();
        await expect(cellBadge, '日历单元格必须出现同一枚优先级徽章（' + c.menu + '）').toHaveCount(1, { timeout: 10_000 });
        await expect(cellBadge, '日历单元格徽章 data-prio 必须与当日待办一致').toHaveAttribute('data-prio', c.key);
        await expect(cellBadge, '日历单元格徽章 aria-label 必须与当日待办一致').toHaveAttribute('aria-label', c.label);
        await expect(cellBadge, '日历单元格徽章图标组合必须与当日待办一致').toHaveText(c.icon);
      }
      expect((await readNode(page, id)).priority, '最后一次设置「不紧急不重要」= priority 4').toBe(4);
    } finally {
      await context.close();
    }
  });

  test('重渲染（切周/切月）与重开（reload）后时间 / 标签 / 优先级三项仍显示', async ({ browser }) => {
    test.setTimeout(180_000);
    const { context, page } = await openCalendar(browser);
    try {
      const id = await createTodo(page, 'FIX1持久化待办');
      await ensureTagExists(page, 'FIX1TAG');
      await setTimeViaMenu(page, id, '18', '00');
      await setTagViaMenu(page, id, 'FIX1TAG');
      await setPrioViaMenu(page, id, '重要紧急');

      const checkAll = async (stage: string) => {
        const row = page.locator('.cal-node[data-id="' + id + '"]');
        await expect(row.locator('.cal-node-time'), stage + '：时间必须显示').toHaveText('18:00', { timeout: 10_000 });
        /* fix2 + fix4：标签不再以文本显示，改断言勾选框（data-tagged + title + 标签色淡底） */
        await expect(row.locator('.cal-node-tag'), stage + '：标签文本必须不显示（fix2 口径）').toHaveCount(0, { timeout: 10_000 });
        await expect(row.locator('input.cal-checkbox'), stage + '：勾选框必须带 data-tagged').toHaveAttribute('data-tagged', '1', { timeout: 10_000 });
        await expect(row.locator('input.cal-checkbox'), stage + '：勾选框 title 必须含标签').toHaveAttribute('title', /#FIX1TAG/, { timeout: 10_000 });
        /* v2.1 fix4 · P2：背景由实色改为标签色淡色（alpha 32%），色相仍必须是标签色 rgb(128, 100, 200) */
        const cbBgRaw = await row.locator('input.cal-checkbox').evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);
        const cbBg = parseComputedColor(cbBgRaw);
        expect(Math.abs(cbBg.a - TINT_ALPHA),
          stage + '：勾选框背景 alpha 必须等于 P0 实测淡色 alpha ' + TINT_ALPHA + '（实测 ' + cbBgRaw + '）').toBeLessThanOrEqual(TINT_ALPHA_TOL);
        expect(Math.max(Math.abs(cbBg.r - 128), Math.abs(cbBg.g - 100), Math.abs(cbBg.b - 200)),
          stage + '：勾选框背景色相必须仍是标签色 rgb(128, 100, 200)（实测 ' + cbBgRaw + '）').toBeLessThanOrEqual(2);
        const badge = row.locator('.prio-badge').first();
        await expect(badge, stage + '：优先级徽章必须显示').toHaveCount(1, { timeout: 10_000 });
        await expect(badge, stage + '：徽章 data-prio').toHaveAttribute('data-prio', 'important_urgent');
        await expect(badge, stage + '：徽章 aria-label').toHaveAttribute('aria-label', '重要紧急');
        await expect(badge, stage + '：徽章图标组合').toHaveText('!⚡');
      };

      await checkAll('设置后');

      /* 真实重渲染：切到周视图再切回月视图（走 cal-view-btn，产品内部 forceRender） */
      await page.locator('.cal-view-btn').filter({ hasText: /^周$/ }).first().click();
      await page.waitForTimeout(600);
      await page.locator('.cal-view-btn').filter({ hasText: /^月$/ }).first().click();
      await page.locator('.cal-cell.today').first().click();
      await page.waitForTimeout(600);
      await checkAll('切周再切月后');

      /* 真实重开：整页 reload → 重新进日历 → 三项仍在 */
      await page.reload({ waitUntil: 'load' });
      await waitApp(page);
      await gotoCalendar(page);
      await page.waitForTimeout(800);
      await checkAll('重开后');

      const persisted = await readNode(page, id);
      expect(persisted.time, '重开后 state.time 必须仍为 18:00').toBe('18:00');
      expect(persisted.tags, '重开后 state.tags 必须仍含 FIX1TAG').toContain('FIX1TAG');
      expect(persisted.priority, '重开后 state.priority 必须仍为 1').toBe(1);
    } finally {
      await context.close();
    }
  });
});
