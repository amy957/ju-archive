import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:5173';
test('fix33-8 · setAlwaysOnTop 拒绝时 #btnPin 不高亮', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  /* fixr6-5 · ISSUE-005：假桥补 core.invoke（真 Tauri 形态）；仅 __TAURI__ 命名空间不再算桌面 */
  await ctx.addInitScript(() => { const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => { throw new Error('denied'); } }; (window as any).__TAURI__ = { core: { invoke: async (c: string) => (c === 'load_state' ? '{}' : null) }, window: { getCurrent: () => api, getCurrentWindow: () => api } }; });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.actions); }, null, { timeout: 60_000 });
  await page.locator('#btnPin').click();
  await expect(page.locator('#btnPin')).not.toHaveClass(/\bon\b/);
  await expect(page.locator('#toast')).toContainText('窗口置顶 在当前桌面环境不可用');
  await ctx.close();
});
