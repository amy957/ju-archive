import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix10 · 多维表格「标题列单元格两行」+「模板库内置多维表格」
 *
 * 缺陷与根因（fix10 P0 取证：90过程材料/tmp/fix10/db_ui_fix10_before.log，对 fix9 发布产物
 * sha256 8002ca27…1ab8，Edge 真窗口 file:// 真实点击）：
 *   · D1 标题列空单元格两行叠加：`renderDbTable` 的字段渲染链里，标题列先落了
 *     `.row-title`（contenteditable，空值时 `::before` 显示「输入标题」），随后又掉进
 *     末尾「裸 else」分支追加了一个 `input[placeholder="—"]`
 *     ⇒ `td.innerHTML` 同时含 `.row-title` 与 `input[placeholder="—"]`，两个占位源上下各一行
 *     （实测 折算行数 = 2）。
 *   · D2 模板库无内置表格：`renderTemplatesView` 只渲染 `state.templates`，全新库为空
 *     ⇒ 整页只有「暂无模板」空态，用户没有任何「一键建 10 列多维表格」入口。
 *
 * 修复：
 *   · P1 `views/database/render.ts` 通用文本分支加 `fn !== titleFieldName` 守卫
 *     （标题列只保留 `.row-title` 单一占位源）；`style.css` 补
 *     `.db-table td .row-title[data-empty="1"] br{display:none}`（空态单行保证）。
 *   · P2 `views/lists.ts` 模板视图恒定渲染第一张内置卡片 `[data-tpl="builtin-db10"]`
 *     「内置多维表格（10列）」，点击走与 `actions.applyDbTemplate` 完全相同的落库路径
 *     （10 列表头 + 3 行空白）。
 *
 * 承载方式与 fix1/fix5~fix9 spec 一致：`vite build` 产物 + `context.route` 映射到
 * http://localhost:5173。全部断言均为真实交互（真实点 #btnNewDb / #btnTemplates / 内置卡片），
 * 无夹具直改 state、无内联 style 注入。
 */

const BASE = 'http://localhost:5173';
/** 内置模板卡片名（与 views/lists.ts BUILTIN_DB_TEMPLATE_NAME 逐字一致） */
const BUILTIN_NAME = '内置多维表格（10列）';
/** 期望表头 = v2.0-t3.html:5566 的 dbFields 原文（10 列，fix9 已固化进 constants） */
const EXPECT_FIELDS = ['标题', '优先级', '状态', '时间', '地点', '人物', '内容', '星级', '评价', '备注'];
const EXPECT_ROWS = 3;

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

/* ---------------- 页面操作（真实交互，与 fix10 探针同一口径） ---------------- */

async function waitApp(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).JU && typeof (window as any).JU.getState === 'function',
    null,
    { timeout: 60_000 },
  );
}

async function openApp(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const dist = await ensureDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await waitApp(page);
  return { context, page };
}

/** 真实新建表格：侧栏 #btnNewDb → 产品 appPrompt 输名 → [data-ok] → 等 db 表渲染 */
async function createDbTable(page: Page, name: string): Promise<void> {
  await page.locator('#btnNewDb').first().click({ timeout: 20_000 });
  const inp = page.locator('.modal-overlay .modal input[type="text"]').first();
  await inp.waitFor({ state: 'visible', timeout: 15_000 });
  await inp.fill(name);
  await page.locator('.modal-overlay .modal [data-ok]').first().click({ timeout: 10_000 });
  await expect(page.locator('#btnDbSummary'), '新建表格后应进入多维表格页').toHaveCount(1, { timeout: 20_000 });
  await page.waitForTimeout(600);
}

/** 读表头 / 行数（与 P3 探针 READ_TITLE_CELL 同口径裁剪） */
async function readTable(page: Page) {
  return page.evaluate(() => {
    const txt = (el: Element | null): string =>
      String((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
    const ths = Array.from(document.querySelectorAll('table.db-table thead th'));
    const headers = ths.map((th) => {
      const tag = th.querySelector('.db-field-tag');
      const t = txt(th);
      const tagTxt = tag ? tag.textContent || '' : '';
      return (tagTxt && t.endsWith(tagTxt)) ? t.slice(0, t.length - tagTxt.length).trim() : t;
    });
    const rows = Array.from(document.querySelectorAll('table.db-table tbody tr'));
    const rowTexts = rows.map((tr) => Array.from(tr.children).map((td) => txt(td)));
    const st = (window as any).JU && typeof (window as any).JU.getState === 'function' ? (window as any).JU.getState() : null;
    const dbFields = (st && Array.isArray(st.dbFields))
      ? st.dbFields.map((f: any) => (typeof f === 'string' ? f : (f && f.name)))
      : null;
    return { headers, headerCount: headers.length, rowCount: rows.length, rowTexts, dbFields };
  });
}

/**
 * 读「标题列第一行单元格」的双行证据（与 fix10 探针 A 段同口径）：
 *   · 单元格内占位源个数：.row-title 与 input 各自算一个；
 *   · 折算行数 = 单元格内容高 / .row-title 行高；
 *   · <br> 计数（data-empty 时应被 CSS 隐藏）。
 */
async function readTitleCell(page: Page) {
  return page.evaluate(() => {
    const round = (n: number) => Math.round(n * 100) / 100;
    const rows = Array.from(document.querySelectorAll('table.db-table tbody tr'));
    const first = rows[0] || null;
    const td = (first ? (first.children[0] as HTMLElement | undefined) : undefined) || null;
    if (!td) return null;
    const rt = td.querySelector('.row-title') as HTMLElement | null;
    const cs = rt ? getComputedStyle(rt) : null;
    const bs = rt ? getComputedStyle(rt, '::before') : null;
    const r = td.getBoundingClientRect();
    /**
     * 行数必须按 .row-title **自身**的行盒量：
     * td 是表格单元格，高度被子（下拉框 / 星标）撑满，用 td 折行数会恒得 ≥2 行（假阳性）。
     * 该口径与 P3 探针 db_ui_fix10_probe.cjs 的 READ_TITLE_CELL 完全一致。
     */
    const rtRect = rt ? rt.getBoundingClientRect() : null;
    const rtPadT = cs ? parseFloat(cs.paddingTop) || 0 : 0;
    const rtPadB = cs ? parseFloat(cs.paddingBottom) || 0 : 0;
    const contentH = rtRect ? rtRect.height - rtPadT - rtPadB : 0;
    const lineH = cs ? (parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.4)) : 0;
    const others = Array.from(first!.children).slice(1).map((c) => round(c.getBoundingClientRect().height));
    return {
      innerHTML: td.innerHTML,
      innerText: td.innerText,
      textContent: String(td.textContent || '').replace(/\s+/g, ' ').trim(),
      rowTitleCount: td.querySelectorAll('.row-title').length,
      inputCount: td.querySelectorAll('input').length,
      contentEditableCount: td.querySelectorAll('[contenteditable]').length,
      rowTitleHtml: rt ? rt.innerHTML : null,
      dataEmpty: rt ? rt.getAttribute('data-empty') : null,
      beforeContent: bs ? bs.content : null,
      brCount: rt ? rt.querySelectorAll('br').length : 0,
      lineHeight: lineH ? round(lineH) : null,
      contentH: round(contentH),
      inputDashCount: Array.from(td.querySelectorAll('input')).filter((i) => i.placeholder === '—').length,
      lineCount: lineH ? Math.round(contentH / lineH) : null,
      tdHeight: round(r.height),
      otherHeights: others,
      otherMaxH: others.length ? Math.max.apply(null, others) : null,
    };
  });
}

test.describe('v2.1 fix10 · 标题列单行 / 模板库内置多维表格', () => {
  test('1) 新建表格：标题列空单元格只保留单一占位源，单行显示（不再两行叠加）', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openApp(browser);
    try {
      await createDbTable(page, 'fix10标题列');
      const cell = await readTitleCell(page);
      expect(cell, '必须能取到标题列第一行单元格').not.toBeNull();
      const c = cell!;

      /* ① 根因直断：标题列单元格内只允许 .row-title 一个可编辑占位源
            （fix10 前实测 .row-title + input[placeholder="—"] 并存 ⇒ 两行） */
      expect(c.rowTitleCount, '标题列单元格内必须恰好 1 个 .row-title（实测 ' + c.rowTitleCount + '）').toBe(1);
      expect(c.inputCount, '标题列单元格内不得再有通用文本 input（实测 ' + c.inputCount + ' 个）\n' + c.innerHTML).toBe(0);
      expect(c.contentEditableCount, '标题列单元格内 contenteditable 数必须为 1').toBe(1);

      /* ② 单元格文本层面：不含「输入标题」与被 input 带进来的「—」 */
      expect(c.innerText, '标题单元格 innerText 不得含「输入标题」').not.toContain('输入标题');
      expect(c.innerText, '标题单元格 innerText 不得含「—」（fix10 前由 input placeholder 引入第二行）').not.toContain('—');
      expect(c.innerHTML, '单元格 DOM 不得含 placeholder="—" 的 input').not.toMatch(/<input[^>]*placeholder="—"/);

      /* ③ 几何层面：只有一行（内容高 ≤ 1.6 倍行高），不再被撑成两行 */
      expect(c.inputDashCount, '标题单元格内不得再有 placeholder="—" 的 input（实测 ' + c.inputDashCount + ' 个）').toBe(0);
      expect(c.lineCount, '标题单元格折算行数必须为 1（实测 ' + c.lineCount + '，.row-title 内容高 ' + c.contentH + ' / 行高 ' + c.lineHeight + '）').toBe(1);
      expect(c.contentH, '标题单元格内容高不得超过 1.6 倍行高').toBeLessThanOrEqual((c.lineHeight || 0) * 1.6);

      /* ④ 单元格高度与同行其它单元格一致（不被额外占位行拉高） */
      expect(c.otherMaxH, '必须能取到同行其它单元格高度').not.toBeNull();
      expect(Math.abs(c.tdHeight - (c.otherMaxH as number)), '标题单元格高度必须与同行一致（实测 ' + c.tdHeight + ' vs ' + c.otherMaxH + '）').toBeLessThanOrEqual(2);

      /* ⑤ 占位符仍在（空态可发现性未被「修复」掉）：data-empty + data-ph 由一个 ::before 提供 */
      expect(c.dataEmpty, '空标题单元格应保留 data-empty="1"').toBe('1');
      expect(c.beforeContent, '空标题单元格的 ::before 占位内容应为「输入标题」').toContain('输入标题');
      expect(c.brCount, '空标题单元格不得残留 <br>（会与 ::before 各占一行）').toBe(0);
    } finally {
      await context.close();
    }
  });

  test('2) 模板视图：「' + BUILTIN_NAME + '」点击后生成 10 列表头 + 3 行空白', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openApp(browser);
    try {
      /* ① 侧栏真实点「模板」 */
      await page.locator('#btnTemplates').first().click({ timeout: 20_000 });
      const card = page.locator('.files-wrap [data-tpl="builtin-db10"]');
      await expect(card, '模板视图必须出现内置多维表格卡片').toHaveCount(1, { timeout: 15_000 });
      await expect(card, '内置卡片文案必须是「' + BUILTIN_NAME + '」').toContainText('内置多维表格');

      /* ② 真实点内置卡片 → 自动建表并跳转 */
      await card.first().click({ timeout: 20_000 });
      await expect(page.locator('#btnDbSummary'), '点击内置模板后必须进入多维表格页').toHaveCount(1, { timeout: 20_000 });
      await page.waitForTimeout(800);

      /* ③ 表头 10 列且与 fix9 固化的模板逐字同序 */
      const t = await readTable(page);
      expect(t.headerCount, '内置模板生成的表头必须是 10 列（实测 ' + t.headerCount + '）').toBe(EXPECT_FIELDS.length);
      expect(t.headers, '表头必须与 v2.0-t3 默认模板逐字同序').toEqual(EXPECT_FIELDS);
      expect(t.dbFields, 'state.dbFields 必须同源为 10 列（不是仅渲染层凑数）').toEqual(EXPECT_FIELDS);

      /* ④ 3 行空白 */
      expect(t.rowCount, '内置模板必须预置 3 行（实测 ' + t.rowCount + '）').toBe(EXPECT_ROWS);
      const titles = t.rowTexts.map((cells) => (cells[0] || '').trim());
      expect(titles, '3 行主列文本必须全为空：' + JSON.stringify(titles)).toEqual(['', '', '']);
    } finally {
      await context.close();
    }
  });

  test('3) 模板视图在「无自存模板」时仍显示内置模板（空态只作提示，不吞掉卡片）', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openApp(browser);
    try {
      await page.locator('#btnTemplates').first().click({ timeout: 20_000 });
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.files-wrap .file-card'));
        const names = cards.map((c) => {
          const n = c.querySelector('.file-name');
          return String((n ? n.textContent : c.textContent) || '').replace(/\s+/g, ' ').trim();
        });
        const st = (window as any).JU && typeof (window as any).JU.getState === 'function' ? (window as any).JU.getState() : null;
        return {
          cardCount: cards.length,
          names,
          stateTemplates: (st && Array.isArray(st.templates)) ? st.templates.length : 0,
          wrapText: String((document.querySelector('.files-wrap') || document.body).textContent || '').replace(/\s+/g, ' ').trim(),
        };
      });

      /* 全新库没有自存模板；此时内置模板卡片必须仍在（fix10 前整页空态、0 张卡片） */
      expect(info.stateTemplates, '本用例前提：全新库 state.templates 应为空').toBe(0);
      expect(info.cardCount, '无自存模板时也必须至少有 1 张内置模板卡片（实测 ' + info.cardCount + '）').toBeGreaterThanOrEqual(1);
      expect(info.names.join('|'), '卡片清单必须含「内置多维表格」').toContain('内置多维表格');

      /* 空态提示仍保留（不再宣称「暂无模板」而与卡片自相矛盾） */
      expect(info.wrapText, '空态提示应改为「暂无自存模板」').toContain('暂无自存模板');
      expect(info.wrapText, '不得再整页显示「暂无模板」').not.toMatch(/暂无模板(?!.*自存)/);
    } finally {
      await context.close();
    }
  });
});
