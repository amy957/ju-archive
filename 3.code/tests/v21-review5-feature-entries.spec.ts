import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
/* 主题 / 导入入口点击后弹 .modal-overlay 遮挡右栏，故每次点击后按 Esc 关闭，再断言下一入口 */
test('review5 · 主题/导入/完整备份/打印入口可达且点击不抛错', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  const page = await ctx.newPage(); const errs: string[] = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { (window as any).print = () => { (window as any).__printed = ((window as any).__printed || 0) + 1; }; });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.applyInlineStyle); }, null, { timeout: 60_000 });
  const dl = page.waitForEvent('download', { timeout: 5_000 });
  await page.locator('#btnBackupSide').click();
  expect((await dl).suggestedFilename()).toMatch(/^JU-备份-\d{4}-\d{2}-\d{2}\.json$/);
  const th = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.locator('#btnTheme').click();
  const card = page.locator('[data-theme-card="' + (th === 'night' ? 'day' : 'night') + '"]'); if (await card.count()) await card.click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(th);
  await page.keyboard.press('Escape'); await expect(page.locator('.modal-overlay')).toHaveCount(0);
  await page.locator('#btnImport').click();
  await expect(page.locator('.modal-head')).toContainText('导入内容');
  await expect(page.locator('#impFile')).toHaveAttribute('accept', /(^|,)\.md,.*\.html,.*\.docx,.*\.json(,|$)/);
  const impMd = () => page.evaluate(() => { const st = (window as any).JU.getState(); return Object.values(st.nodes || {}).filter((n: any) => String(n.text || '').includes('imp-md')).length; });
  await page.locator('#impFile').setInputFiles([
    { name: 'a.db', mimeType: 'application/octet-stream', buffer: Buffer.from('SQLite format 3\u0000') },
    { name: 'b.md', mimeType: 'text/markdown', buffer: Buffer.from('imp-md 节点') },
  ]);
  await expect.poll(impMd, { message: 'a.db 不得中断整批：b.md 必须生成节点', timeout: 20_000 }).toBe(1);
  await expect(page.locator('#toast')).toContainText('a.db');
  await page.keyboard.press('Escape'); await expect(page.locator('.modal-overlay')).toHaveCount(0);
  await page.locator('.sr-title', { hasText: '打印' }).first().click();
  for (const s of ['#srPrintPanel', '#btnPrintDo']) await expect(page.locator(s)).toBeVisible();
  await page.locator('#btnPrintDo').click();
  await expect(page.locator('.print-preview')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__printed || 0)).toBeGreaterThanOrEqual(1);
  expect(errs).toHaveLength(0);
  await ctx.close();
});
/* review10-09：加密态导出仍是明文 JSON，必须明示 + 二次确认；取消后不得产生下载 */
test('review10-09 · 加密态导出备份先确认且取消不下载', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.applyInlineStyle); }, null, { timeout: 60_000 });
  await page.evaluate(() => { const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui; u.encrypted = true; u.encKey = 'review10-09'; });
  const pending = page.waitForEvent('download', { timeout: 1_000 }).then(() => true).catch(() => false);
  await page.locator('#btnBackupSide').click();
  const dialog = page.locator('.modal-overlay .modal-body');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('明文');
  await page.locator('.modal-overlay .modal [data-cancel]').click();
  await expect(page.locator('.modal-overlay')).toHaveCount(0);
  expect(await pending, '取消后不得下载').toBe(false);
  await ctx.close();
});
