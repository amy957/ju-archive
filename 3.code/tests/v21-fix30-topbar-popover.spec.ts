import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:5173';
test('fix30 · 浮窗初始关闭 · 提醒浮窗落在视口内', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  await ctx.addInitScript(() => { const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} }; (window as any).__TAURI__ = { window: { getCurrent: () => api, getCurrentWindow: () => api }, invoke: async () => {} }; });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.actions); }, null, { timeout: 60_000 });
  const disp = (s: string) => page.locator(s).first().evaluate((el) => getComputedStyle(el).display);
  expect(await disp('#settingsPanel')).toBe('none'); expect(await disp('#remindPanel')).toBe('none');
  await page.locator('#btnBell').click();
  const r = (await page.locator('#remindPanel').boundingBox())!; expect(r.x >= 0 && r.y >= 0 && r.x + r.width <= 1200 && r.y + r.height <= 900).toBe(true);
  await ctx.close();
});
