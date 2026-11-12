import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
test('fixr6-13 · .db 导入失败只跳过本文件，后续 b.md 仍生成节点且提示含 a.db', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.actions && typeof J.getState === 'function'); }, null, { timeout: 60_000 });
  const count = () => page.evaluate(() => { const st = (window as any).JU.getState(); return Object.values(st.nodes || {}).filter((n: any) => String(n.text || '').includes('db-skip-md')).length; });
  await page.locator('#btnImport').click();
  await page.locator('#impFile').setInputFiles([
    { name: 'a.db', mimeType: 'application/octet-stream', buffer: Buffer.from('SQLite format 3\u0000') },
    { name: 'b.md', mimeType: 'text/markdown', buffer: Buffer.from('db-skip-md 节点') },
  ]);
  await expect.poll(count, { message: 'a.db 不得中断整批：b.md 必须生成节点', timeout: 20_000 }).toBe(1);
  await expect(page.locator('#toast')).toContainText('a.db');
  await ctx.close();
});
