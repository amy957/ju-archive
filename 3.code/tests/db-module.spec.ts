import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

/**
 * M07 · 数据库模块依赖注入门禁（P0-T3 · 空桩修复）
 *
 * 覆盖 6 项真实交互（全部走产品自身 DOM 与事件处理器，不使用任何测试侧 deps 回填）：
 *   1) 新增行（`+ 行` → `deps.actions.addDbRow` + `deps.forceRender`）
 *   2) 改单元格（`.row-title` contenteditable → `deps.N` / `deps.actions.updateText`）
 *   3) 切看板（`.db-view-btn` → `deps.ui.dbView` + `deps.saveUI` + `deps.forceRender`）
 *   4) 切画廊（同上，画廊分支 `.db-gallery`）
 *   5) 打开筛选面板（`#btnDbFilter` → `deps.openDbFilterPanel` + `deps.placePop`）
 *   6) 打开显隐面板（`#btnDbHiddenFields` → `deps.openDbHiddenFieldsPanel` + 勾选联动 `deps.ui` + `deps.forceRender`）
 *
 * 环境适配：本机浏览器进程到 localhost 的入站连接被系统策略阻断，故与其余 spec 一致，
 * 用 `context.route` 把 `http://localhost:5173/**` 映射到 dist 目录（页面仍在真实 HTTP 源上）。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
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
  '.woff2': 'font/woff2',
};

async function prepareDist(): Promise<string> {
  await build({ root: ROOT, logLevel: 'warn' });
  return path.join(ROOT, 'dist');
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
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => {
    const J = (window as any).JU;
    return !!(J && typeof J.getState === 'function' && typeof J.renderMain === 'function' && J.actions);
  }, null, { timeout: 60_000, polling: 25 });
  await page.waitForTimeout(400);
}

/**
 * 建立「数据库根 → 表格 → 2 行 2 列」最小数据集，并经真实会话动作打开该表：
 * `actions.setCurrentDoc`（写入共享 ui + saveUI + 通知）→ `renderMain` → `renderDatabasePage`。
 * 说明：本构建的侧栏骨架不含 `#subDb` 容器（`renderSubDb` 首行 `$('#subDb')` 为 null 即返回），
 * 侧栏「数据库」子树行不可达，故打开路径改用产品对外暴露的真实会话端口。
 */
async function seedAndOpenDb(page: Page): Promise<{ tableId: string }> {
  const ids = await page.evaluate(() => {
    const J: any = (window as any).JU;
    /* boot 的 juPatch 以 getter 形式发布 `JU.ui`（`ui: function(){return ui;}`），
       故共享 ui 对象须经 `JU.ui()` 取得；兼容直接以对象发布的构建。 */
    const uiObj: any = typeof J.ui === 'function' ? J.ui() : J.ui;
    const dbRootId: any = J.actions.createDoc('数据库', { _isDbRoot: true, _isFolder: true, dbRoot: true });
    const tableId: any = J.actions.addNode(dbRootId, null, { text: 'M07 数据库验收表', dbRoot: true });
    /* 本套用例固定 2 列（标题 / 状态）：显式套用模板，避免 boot 期默认字段表
       （标题 / 优先级 / 状态 / 时间，见 main.ts 迁移规则）变化导致列数漂移。
       rowCount=0 只落表头，数据行由下方 addDbRow 真实建立。 */
    J.actions.applyDbTemplate(tableId, ['标题', '状态'], 0);
    J.actions.addDbRow(tableId, { text: '行A', db: { 状态: '待办' } });
    J.actions.addDbRow(tableId, { text: '行B', db: { 状态: '进行' } });
    uiObj.dbView = 'table';
    J.actions.setCurrentDoc(tableId);
    J.renderMain();
    return { dbRootId, tableId };
  });
  expect(ids.tableId, '表格节点必须由真实 actions.addNode 创建').toBeTruthy();
  await expect(page.locator('.db-page'), '切到该表后必须渲染数据库页').toBeVisible();
  await expect(page.locator('.db-table tr[data-msid]'), '表格行必须由真实 getDbRows 渲染').toHaveCount(2);
  return { tableId: ids.tableId as string };
}

test.describe('M07 · 数据库模块（真实产物，无测试侧依赖回填）', () => {
  let dist = '';

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    dist = await prepareDist();
  });

  test('1) 新增行：+ 行 按钮写入 state 并重渲染表格', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    const { tableId } = await seedAndOpenDb(page);

    const before = await page.evaluate((id) => (window as any).JU.N(id).children.length, tableId);
    const rowsBefore = await page.locator('.db-table tr[data-msid]').count();
    expect(rowsBefore, '初始 2 行必须由 getDbRows 渲染出来（空桩时为 0 行）').toBe(2);

    await page.locator('.db-add button', { hasText: '+ 行' }).click();
    await expect(page.locator('.db-table tr[data-msid]')).toHaveCount(rowsBefore + 1);

    const after = await page.evaluate((id) => (window as any).JU.N(id).children.length, tableId);
    console.log('[DB-1] children:', before, '->', after);
    expect(after, '新增行必须真实落 state').toBe(before + 1);
  });

  test('2) 改单元格：contenteditable 标题列编辑后提交进 state', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    const { tableId } = await seedAndOpenDb(page);

    const firstRowId = await page.evaluate(() => {
      const tr = document.querySelector('.db-table tr[data-msid]') as HTMLElement | null;
      return tr ? tr.getAttribute('data-msid') : null;
    });
    expect(firstRowId, '第一行必须带 data-msid').toBeTruthy();

    const cell = page.locator('.db-table tr[data-msid] .row-title').first();
    await expect(cell).toBeVisible();
    await cell.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('单元格已改');
    await page.locator('.db-title').click(); /* 失焦 → 走 deps.actions.updateText 提交 */
    await page.waitForTimeout(250);

    const text = await page.evaluate((id) => String((window as any).JU.N(id).text || ''), firstRowId as string);
    console.log('[DB-2] row text =', JSON.stringify(text));
    expect(text, '单元格编辑必须真实提交进 state.nodes[id].text').toContain('单元格已改');
    await expect(page.locator('.db-table tr[data-msid] .row-title').first()).toContainText('单元格已改');
    expect(tableId).toBeTruthy();
  });

  test('3) 切看板：dbView 写入共享 ui 并渲染 .db-board', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    await seedAndOpenDb(page);

    await page.locator('.db-view-btn', { hasText: '看板' }).click();
    await expect(page.locator('.db-board')).toBeVisible();
    await expect(page.locator('.db-board-col').first()).toBeVisible();

    const uiView = await page.evaluate(() => {
      const J: any = (window as any).JU;
      return (typeof J.ui === 'function' ? J.ui() : J.ui).dbView;
    });
    console.log('[DB-3] ui().dbView =', uiView);
    expect(uiView, '看板切换必须写入共享 ui 对象（ui 空桩时不会变化）').toBe('board');
    await expect(page.locator('.db-view-btn', { hasText: '看板' })).toHaveClass(/active/);
  });

  test('4) 切画廊：dbView 写入共享 ui 并渲染 .db-gallery 卡片', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    await seedAndOpenDb(page);

    await page.locator('.db-view-btn', { hasText: '画廊' }).click();
    await expect(page.locator('.db-gallery')).toBeVisible();
    await expect(page.locator('.db-gallery-card')).toHaveCount(2);

    const uiView = await page.evaluate(() => {
      const J: any = (window as any).JU;
      return (typeof J.ui === 'function' ? J.ui() : J.ui).dbView;
    });
    console.log('[DB-4] ui().dbView =', uiView);
    expect(uiView, '画廊切换必须写入共享 ui 对象').toBe('gallery');
  });

  test('5) 打开筛选面板：placePop 定位到触发按钮附近', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    await seedAndOpenDb(page);

    const btn = page.locator('#btnDbFilter');
    await btn.click();
    const panel = page.locator('.db-sf-panel', { hasText: '筛选' });
    await expect(panel).toBeVisible();

    const box = await panel.boundingBox();
    console.log('[DB-5] filter panel box =', JSON.stringify(box));
    expect(box, '筛选面板必须有真实布局盒（placePop 空桩时会落在 0,0 或不可见）').not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.x).toBeGreaterThan(0);
  });

  test('6) 打开显隐面板：勾选联动 ui.dbHiddenFields 并重渲染表格列', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    await seedAndOpenDb(page);

    const thBefore = await page.locator('.db-table th').count();
    expect(thBefore, '初始应有 2 列（标题 / 状态）').toBe(2);

    await page.locator('#btnDbHiddenFields').click();
    const panel = page.locator('.db-sf-panel', { hasText: '显隐' });
    await expect(panel).toBeVisible();
    await expect(panel.locator('input[type="checkbox"]')).toHaveCount(2);

    /* 取消勾选「状态」→ ui.dbHiddenFields.状态 = true → forceRender 后表格少一列 */
    const statusRow = panel.locator('label', { hasText: '状态' }).locator('input[type="checkbox"]');
    await statusRow.uncheck();
    await page.waitForTimeout(250);

    const hidden = await page.evaluate(() => {
      const J: any = (window as any).JU;
      return (typeof J.ui === 'function' ? J.ui() : J.ui).dbHiddenFields;
    });
    const thAfter = await page.locator('.db-table th').count();
    console.log('[DB-6] ui().dbHiddenFields =', JSON.stringify(hidden), ' th:', thBefore, '->', thAfter);
    expect(hidden && hidden['状态'], '显隐面板必须写入共享 ui.dbHiddenFields').toBe(true);
    expect(thAfter, '隐藏后表格列数必须减少').toBe(thBefore - 1);
  });
});
