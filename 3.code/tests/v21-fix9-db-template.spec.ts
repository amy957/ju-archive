import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix9 · 多维表格「内置默认模板 + 汇总浮窗冗余文案/尺寸」
 *
 * 缺陷与根因（fix9 P0 取证：90过程材料/tmp/fix9/db_ui_before.log，对 fix8 发布产物
 * sha256 f91766d5…8376，Edge 真窗口 file://）：
 *   · D1 新建表格只有 1 列：`state.dbFields` 默认缺失 ⇒ renderDbTable 回落 `['标题']`；
 *   · D2 新建表格只有 1 行：会话层只 `actions.addDbRow(id,{text:'新条目'})`；
 *   · D3 汇总浮窗残留三段冗余文案：标题「汇总行」、「启用（计数/求和/求平均）」、底部
 *     「对数字列与公式列显示统计值，计数对任意列生效。」；
 *   · D4 浮窗臃肿：实测 315×119、padding 12px（T+B=24）。
 *
 * 修复：
 *   · P1 `core/constants.ts` 增 `DEFAULT_DB_FIELDS`（10 列，逐字取自 v2.0-t3.html:5566）与
 *     `DEFAULT_DB_ROW_COUNT=3`；`core/actions.ts` 增 `applyDbTemplate()`（同一次 commit 内落表头 + 3 行空白）；
 *     `app/session.ts` 的 `#btnNewDb` 改调该 action。
 *   · P2 `views/database/panels.ts` 删除三段文案、去掉内联 width/flex-wrap；
 *     `style.css` 新增 `.db-sum-panel` 紧凑样式（纯 CSS 类，无内联 style）。
 *
 * 验收口径（P3 探针 after：90过程材料/tmp/fix9/db_ui_after.log）：
 *   表头 10 列与模板逐字一致、3 行空白、浮窗无三段文案、浮窗 195×54、底部多余空白 1px。
 *
 * 承载方式与 fix1 / fix5 / fix6 / fix7 / fix8 spec 一致：`vite build` 产物 + `context.route`
 * 映射到 http://localhost:5173。全部断言均为真实交互（真实点 #btnNewDb → 真实 appPrompt 输名 →
 * 真实点 #btnDbSummary），无夹具直改 state、无内联 style 注入。
 */

const BASE = 'http://localhost:5173';

/**
 * 期望表头 = v2.0-t3.html:5566 的 `dbFields` 原文（10 列）。
 * 注：任务书正文把列名写作「序号/名称/状态/…」，而 canonical 实际为「标题/优先级/状态/…」；
 * 按「确保模板与 v2.0-t3.html 默认状态完全一致」的硬约束以 canonical 为准（差异见 fix9 回执）。
 */
const EXPECT_FIELDS = ['标题', '优先级', '状态', '时间', '地点', '人物', '内容', '星级', '评价', '备注'];
const EXPECT_ROWS = 3;
/** 浮窗紧凑阈值（与 P3 探针同一口径） */
const PANEL_MAX_W = 240;
const PANEL_MAX_H = 100;
/** P2 要求删除的三段文案（原文逐字） */
const KILL_TEXTS = ['汇总行', '（计数/求和/求平均）', '对数字列与公式列显示统计值，计数对任意列生效。'];

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

/* ---------------- 页面操作（真实交互，与 fix9 P0/P3 探针同一口径） ---------------- */

async function waitApp(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).JU && typeof (window as any).JU.getState === 'function',
    null,
    { timeout: 60_000 },
  );
}

/** 真实新建表格：侧栏 #btnNewDb → 产品 appPrompt 输名 → [data-ok] → 等 db 表渲染 */
async function createDbTable(page: Page, name: string): Promise<void> {
  await page.locator('#btnNewDb').first().click({ timeout: 20_000 });
  const inp = page.locator('.modal-overlay .modal input[type="text"]').first();
  await inp.waitFor({ state: 'visible', timeout: 15_000 });
  await inp.fill(name);
  await page.locator('.modal-overlay .modal [data-ok]').first().click({ timeout: 10_000 });
  await expect(page.locator('#btnDbSummary'), '新建表格后应进入多维表格页（工具栏含汇总按钮）').toHaveCount(1, { timeout: 20_000 });
  await page.waitForTimeout(600);
}

async function openDbPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const dist = await ensureDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await waitApp(page);
  await createDbTable(page, 'fix9模板表');
  return { context, page };
}

/** 读取表头 / 行 / 浮窗（与 P3 探针 READ_FN 同口径，只裁剪到测试需要的字段） */
async function readDbUi(page: Page) {
  return page.evaluate((killTexts: string[]) => {
    const txt = (el: Element | null): string =>
      String((el && el.textContent) || '').replace(/\s+/g, ' ').trim();

    const ths = Array.from(document.querySelectorAll('table.db-table thead th')) as HTMLElement[];
    const headers = ths.map((th) => {
      const tag = th.querySelector('.db-field-tag');
      const t = txt(th);
      const tagTxt = tag ? tag.textContent || '' : '';
      return (tagTxt && t.endsWith(tagTxt)) ? t.slice(0, t.length - tagTxt.length).trim() : t;
    });
    const rows = Array.from(document.querySelectorAll('table.db-table tbody tr')) as HTMLElement[];
    const rowTexts = rows.map((tr) => Array.from(tr.children).map((td) => txt(td)));

    const st = (window as any).JU && typeof (window as any).JU.getState === 'function' ? (window as any).JU.getState() : null;
    const dbFields = (st && Array.isArray(st.dbFields))
      ? st.dbFields.map((f: any) => (typeof f === 'string' ? f : (f && f.name)))
      : null;

    /* 汇总浮窗：.db-sum-panel（fix9 起专属类）优先，回落「文字含汇总」（旧版行为） */
    const panels = Array.from(document.querySelectorAll('.db-sf-panel')) as HTMLElement[];
    const panel = (document.querySelector('.db-sf-panel.db-sum-panel') as HTMLElement | null)
      || panels.find((p) => txt(p).indexOf('汇总') >= 0) || null;
    let panelInfo: any = null;
    if (panel) {
      const r = panel.getBoundingClientRect();
      const cs = getComputedStyle(panel);
      const padT = parseFloat(cs.paddingTop) || 0;
      const padB = parseFloat(cs.paddingBottom) || 0;
      const flow = Array.from(panel.children).filter((el) => {
        const p = getComputedStyle(el).position;
        return p !== 'absolute' && p !== 'fixed';
      }) as HTMLElement[];
      const last = flow.length ? flow[flow.length - 1] : null;
      panelInfo = {
        w: Math.round(r.width),
        h: Math.round(r.height),
        padT,
        padB,
        bottomGap: last ? Math.round(r.bottom - last.getBoundingClientRect().bottom - padB) : -1,
        hasCheckbox: !!panel.querySelector('input[type="checkbox"]'),
        hasSelect: !!panel.querySelector('select'),
        options: Array.from(panel.querySelectorAll('select option')).map((o) => txt(o)),
        text: txt(panel),
      };
    }
    const pageText = document.body.innerText;
    const present = killTexts.map((k) => ({ key: k, inPage: pageText.indexOf(k) >= 0, inPanel: !!(panel && txt(panel).indexOf(k) >= 0) }));

    return { headers, headerCount: headers.length, rowCount: rows.length, rowTexts, dbFields, panel: panelInfo, present };
  }, KILL_TEXTS);
}

test.describe('v2.1 fix9 · 多维表格默认模板 / 汇总浮窗', () => {
  test('1) 新建表格即含 10 列表头（与 v2.0-t3 默认模板逐字一致）', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openDbPage(browser);
    try {
      const ui = await readDbUi(page);

      /* ① 表头数量：fix9 前实测 1 列（state.dbFields 缺失 ⇒ 回落 ['标题']） */
      expect(ui.headerCount, '新建表格必须有 10 列表头（fix9 前实测 1 列）').toBe(EXPECT_FIELDS.length);

      /* ② 列名与顺序逐字等于 v2.0-t3.html:5566 的 dbFields */
      expect(ui.headers, '表头必须与 v2.0-t3 默认模板逐字同序').toEqual(EXPECT_FIELDS);

      /* ③ 产品数据层同源：state.dbFields 也必须是这 10 列（不是仅渲染层凑出来的） */
      expect(ui.dbFields, 'state.dbFields 必须是模板的 10 列').toEqual(EXPECT_FIELDS);

      /* ④ 关键列单独点名，便于失败时快速定位（状态/时间/星级 是原任务书点名列） */
      ['状态', '时间', '星级'].forEach((name) => {
        expect(ui.headers, '表头必须包含「' + name + '」列').toContain(name);
      });
    } finally {
      await context.close();
    }
  });

  test('2) 新建表格默认 3 行空白（不写「新条目」占位、不堆历史行）', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openDbPage(browser);
    try {
      const ui = await readDbUi(page);

      /* ① 行数 = 3（fix9 前实测 1 行「新条目」） */
      expect(ui.rowCount, '新建表格必须默认 3 行（fix9 前实测 1 行）').toBe(EXPECT_ROWS);

      /* ② 每行「主列（标题）」文本必须为空 —— 3 行空白，而不是 3 行占位文案 */
      const titles = ui.rowTexts.map((cells) => (cells[0] || '').trim());
      expect(titles, '3 行主列文本必须全为空：' + JSON.stringify(titles)).toEqual(['', '', '']);

      /* ③ 不得再出现旧的「新条目」占位 */
      const flat = JSON.stringify(ui.rowTexts);
      expect(flat, '不得再用「新条目」占位行').not.toContain('新条目');
    } finally {
      await context.close();
    }
  });

  test('3) 汇总浮窗无 P2 三段冗余文案，且尺寸紧凑（高 ≤ ' + PANEL_MAX_H + 'px）', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openDbPage(browser);
    try {
      /* 真实点开汇总浮窗 */
      await page.locator('#btnDbSummary').first().click({ timeout: 20_000 });
      await page.waitForTimeout(700);

      const ui = await readDbUi(page);
      expect(ui.panel, '点击汇总后必须出现汇总浮窗').not.toBeNull();
      const panel = ui.panel!;

      /* ① 三段文案在浮窗内必须全部不存在（fix9 前实测 3/3 命中） */
      KILL_TEXTS.forEach((k, i) => {
        expect(ui.present[i].inPanel, '汇总浮窗内不得再出现文案「' + k + '」').toBe(false);
      });
      expect(panel.text, '浮窗全文不得含三段文案：' + panel.text).not.toContain('计数/求和/求平均');
      expect(panel.text, '浮窗全文不得含底部统计口径说明').not.toContain('对数字列与公式列显示统计值');
      expect(panel.text, '浮窗不应再有「汇总行」标题').not.toContain('汇总行');

      /* ② 保留「启用」复选框 + 右侧模式下拉框（计数/求和等） */
      expect(panel.hasCheckbox, '浮窗必须保留「启用」复选框').toBe(true);
      expect(panel.hasSelect, '浮窗必须保留下拉框').toBe(true);
      expect(panel.options, '下拉框必须仍是 求和/求平均/计数').toEqual(['求和', '求平均', '计数']);

      /* ③ 尺寸明显收紧（fix9 前实测 315×119、padding T+B=24） */
      expect(panel.w, '浮窗宽度必须收紧到 ≤ ' + PANEL_MAX_W + 'px（实测 ' + panel.w + 'px）').toBeLessThanOrEqual(PANEL_MAX_W);
      expect(panel.h, '浮窗高度必须收紧到 ≤ ' + PANEL_MAX_H + 'px（实测 ' + panel.h + 'px）').toBeLessThanOrEqual(PANEL_MAX_H);
      expect(panel.padT + panel.padB, 'padding 上下合计必须 ≤ 16px（实测 ' + (panel.padT + panel.padB) + 'px）').toBeLessThanOrEqual(16);

      /* ④ 底部无多余空白（只包裹内部控件） */
      expect(panel.bottomGap, '浮窗底部不得有多余空白（实测 ' + panel.bottomGap + 'px）').toBeLessThanOrEqual(2);
    } finally {
      await context.close();
    }
  });
});
