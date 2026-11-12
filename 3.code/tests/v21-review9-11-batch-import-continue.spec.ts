import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
test('review9-11 · JSON 备份恢复后同批 markdown 继续导入', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { return r.fulfill({ status: 404, body: '' }); } });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.handleImportFiles && J.getState); }, null, { timeout: 60_000 });
  const backup = { tagColors: {}, rootId: 'r9', nodes: { r9: { id: 'r9', text: '恢复根', parent: null, children: [], collapsed: false, done: false, date: null, tags: [], priority: 0, createdAt: 1, updatedAt: 1 } } };
  await page.evaluate((raw) => { const J = (window as any).JU; const a = new File([raw], 'a.json', { type: 'application/json' }); const b = new File(['REVIEW911-MD 节点'], 'b.md', { type: 'text/markdown' }); (window as any).__imp = false; void J.handleImportFiles([a, b]).then(() => { (window as any).__imp = true; }); }, JSON.stringify(backup));
  const ok = page.locator('.modal-overlay .modal [data-ok]').last(); await expect(ok).toBeVisible({ timeout: 30_000 }); await ok.click();
  await expect.poll(async () => page.evaluate(() => !!(window as any).__imp), { timeout: 60_000 }).toBe(true);
  const n = await page.evaluate(() => { const st = (window as any).JU.getState(); return Object.values(st.nodes || {}).filter((x: any) => String(x.text || '').includes('REVIEW911-MD')).length; });
  expect(n, 'JSON 恢复后不得中断整批：b.md 必须生成节点').toBeGreaterThanOrEqual(1);
  await expect(page.locator('#toast')).toContainText('已恢复备份');
  await ctx.close();
});
