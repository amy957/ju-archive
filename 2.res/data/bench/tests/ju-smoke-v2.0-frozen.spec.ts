// JU Playwright 冒烟测试（10 条）
// 对应启动清单 #4：Playwright 冒烟 10 条。目标：CI 可跑。
// 运行：
//   npm i -D @playwright/test && npx playwright install chromium
//   python3 -m http.server 8080   # 在 v2.0-frozen.html 所在目录
//   JU_URL=http://localhost:8080/v2.0-frozen.html npx playwright test tests/ju-smoke.spec.ts
import { test, expect, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
const APP_URL = process.env.JU_URL || 'http://localhost:8080/v2.0-frozen.html';
/** 等待 JU 启动完成：顶栏 + 内容区首屏出现 */
async function waitForAppReady(page: Page) {
  await page.waitForSelector('#topbar', { timeout: 15000 });
  await page.waitForSelector(
    '#content .outline, #content .files-wrap, #content .cal-page, #content .db-page',
    { timeout: 15000 }
  );
}
/** 新建文档：点击侧栏 + 文档按钮，输入名称，确认 */
async function createDoc(page: Page, name: string) {
  await page.click('#btnNewDoc');
  await page.waitForSelector('.modal-overlay .modal input[type="text"]', { timeout: 5000 });
  await page.fill('.modal-overlay .modal input[type="text"]', name);
  await page.click('.modal-overlay .modal [data-ok]');
  await page.waitForSelector(`.sb-row:has-text("${name}")`, { timeout: 8000 });
}
/** 新建数据库表格：点击侧栏 + 数据库按钮，输入名称，确认 */
async function createDbTable(page: Page, name: string) {
  await page.click('#btnNewDb');
  await page.waitForSelector('.modal-overlay .modal input[type="text"]', { timeout: 5000 });
  await page.fill('.modal-overlay .modal input[type="text"]', name);
  await page.click('.modal-overlay .modal [data-ok]');
  await page.waitForSelector('.db-page', { timeout: 8000 });
}
// ────────────────────────────────────────────────────────────
// 1. 启动
// ────────────────────────────────────────────────────────────
test('启动：应用加载、默认数据可用、无致命错误', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(APP_URL);
  await waitForAppReady(page);
  // 顶栏、侧栏、内容区可见
  await expect(page.locator('#topbar')).toBeVisible();
  await expect(page.locator('#sidebarLeft')).toBeVisible();
  await expect(page.locator('#content')).toBeVisible();
  // 默认文档大纲已渲染
  await expect(page.locator('#content .outline .doc-header-title')).toBeVisible();
  // 侧栏文档数 > 0
  const docCount = await page.locator('.sb-nav-item[data-nav="files"] .count').textContent();
  expect(Number(docCount)).toBeGreaterThan(0);
  // 无未捕获错误
  expect(errors).toEqual([]);
});
// ────────────────────────────────────────────────────────────
// 2. 新建
// ────────────────────────────────────────────────────────────
test('新建：创建文档并出现在侧栏', async ({ page }) => {
  await page.goto(APP_URL);
  await waitForAppReady(page);
  const name = `冒烟-新建-${Date.now()}`;
  await createDoc(page, name);
  // 侧栏出现该文档
  await expect(page.locator(`.sb-row:has-text("${name}")`)).toBeVisible();
  // 内容区标题切换为新文档
  await expect(page.locator('#content .doc-header-title')).toHaveText(name);
});
// ────────────────────────────────────────────────────────────
// 3. 编辑
// ────────────────────────────────────────────────────────────
test('编辑：在大纲输入文本并落库', async ({ page }) => {
  await page.goto(APP_URL);
  await waitForAppReady(page);
  // 聚焦第一个可编辑节点
  const firstText = page.locator('#content .outline .text').first();
  await firstText.click();
  await page.keyboard.type(' Playwright-编辑-测试');
  // 失焦提交
  await page.keyboard.press('Tab');
  // DOM 中应包含新文本
  await expect(firstText).toContainText('Playwright-编辑-测试');
  // 刷新后仍存在（落库校验）
  await page.reload();
  await waitForAppReady(page);
  await expect(page.locator('#content .outline .text').first()).toContainText('Playwright-编辑-测试');
});
// ────────────────────────────────────────────────────────────
// 4. 撤销
// ────────────────────────────────────────────────────────────
test('撤销：Ctrl/Cmd+Z 回退编辑', async ({ page }) => {
  await page.goto(APP_URL);
  await waitForAppReady(page);
  const firstText = page.locator('#content .outline .text').first();
  const original = (await firstText.textContent()) || '';
  await firstText.click();
  await page.keyboard.type(' 撤销测试');
  await page.keyboard.press('Tab');
  await expect(firstText).toContainText('撤销测试');
  // 撤销
  await firstText.click();
  await page.keyboard.press('ControlOrMeta+Z');
  await page.waitForTimeout(300);
  // 文本应回退到原始内容
  await expect(firstText).toHaveText(original);
});
// ────────────────────────────────────────────────────────────
// 5. 切视图
// ────────────────────────────────────────────────────────────
test('切视图：大纲 → 思维导图 → 大纲', async ({ page }) => {
  await page.goto(APP_URL);
  await waitForAppReady(page);
  // 切到思维导图
  await page.click('.tb-nav-btn[data-view="mindmap"]');
  await page.waitForSelector('.mm-wrap', { timeout: 8000 });
  await expect(page.locator('.mm-wrap')).toBeVisible();
  // 切回大纲
  await page.click('.tb-nav-btn[data-view="outline"]');
  await page.waitForSelector('#content .outline', { timeout: 8000 });
  await expect(page.locator('#content .outline')).toBeVisible();
});
// ────────────────────────────────────────────────────────────
// 6. 搜索
// ────────────────────────────────────────────────────────────
test('搜索：输入关键词返回结果', async ({ page }) => {
  await page.goto(APP_URL);
  await waitForAppReady(page);
  await page.fill('#searchInput', '欢迎');
  // 搜索有 150ms 防抖
  await page.waitForTimeout(400);
  // 内容区出现搜索结果标题
  await expect(page.locator('#content')).toContainText('搜索结果：欢迎');
  // 至少命中一条
  const rows = page.locator('#content .cal-row');
  expect(await rows.count()).toBeGreaterThan(0);
});
// ────────────────────────────────────────────────────────────
// 7. 日历
// ────────────────────────────────────────────────────────────
test('日历：进入日历并添加今日待办', async ({ page }) => {
  await page.goto(APP_URL);
  await waitForAppReady(page);
  // 左侧导航进入日历
  await page.click('.sb-nav-item[data-nav="calendar"]');
  await page.waitForSelector('.cal-page', { timeout: 8000 });
  // 添加今日待办
  await page.click('.cal-adder');
  await page.waitForTimeout(200);
  await page.keyboard.type('冒烟-日历待办');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  // 今日待办列表出现该条目
  await expect(page.locator('.cal-panel .cal-node')).toContainText('冒烟-日历待办');
});
// ────────────────────────────────────────────────────────────
// 8. 数据库
// ────────────────────────────────────────────────────────────
test('数据库：新建表格并添加一行', async ({ page }) => {
  await page.goto(APP_URL);
  await waitForAppReady(page);
  const tableName = `冒烟-表-${Date.now()}`;
  await createDbTable(page, tableName);
  // 表格初始至少一行（新建时自动加一行）
  const rowsBefore = await page.locator('.db-table tbody tr').count();
  // 点击 + 行
  await page.click('.db-add .btn:has-text("+ 行")');
  await page.waitForTimeout(300);
  const rowsAfter = await page.locator('.db-table tbody tr').count();
  expect(rowsAfter).toBe(rowsBefore + 1);
});
// ────────────────────────────────────────────────────────────
// 9. 导入
// ────────────────────────────────────────────────────────────
test('导入：Markdown 文件导入成功', async ({ page }) => {
  await page.goto(APP_URL);
  await waitForAppReady(page);
  // 准备临时 Markdown 文件
  const tmpFile = path.join(os.tmpdir(), `ju-import-${Date.now()}.md`);
  fs.writeFileSync(tmpFile, '- 导入节点 A\n- 导入节点 B\n', 'utf-8');
  await page.click('#btnImport');
  await page.waitForSelector('#impFile', { state: 'attached', timeout: 5000 });
  await page.setInputFiles('#impFile', tmpFile);
  // 等待导入完成 toast
  await expect(page.locator('#toast')).toContainText('已导入', { timeout: 8000 });
  // 清理
  fs.unlinkSync(tmpFile);
});
// ────────────────────────────────────────────────────────────
// 10. 多标签
// ────────────────────────────────────────────────────────────
test('多标签：标签 A 编辑，标签 B 同步', async ({ context }) => {
  // 页面 A
  const pageA = await context.newPage();
  await pageA.goto(APP_URL);
  await waitForAppReady(pageA);
  // 页面 B
  const pageB = await context.newPage();
  await pageB.goto(APP_URL);
  await waitForAppReady(pageB);
  // 确保两页在同一文档（默认打开第一个文档）
  const docTitleA = await pageA.locator('#content .doc-header-title').textContent();
  const docTitleB = await pageB.locator('#content .doc-header-title').textContent();
  expect(docTitleA).toBe(docTitleB);
  // A 编辑第一个节点
  const textA = pageA.locator('#content .outline .text').first();
  await textA.click();
  await pageA.keyboard.type(' 多标签同步测试');
  await pageA.keyboard.press('Tab');
  // B 应在数秒内同步到相同文本
  const textB = pageB.locator('#content .outline .text').first();
  await expect(textB).toContainText('多标签同步测试', { timeout: 10000 });
  await pageA.close();
  await pageB.close();
});
