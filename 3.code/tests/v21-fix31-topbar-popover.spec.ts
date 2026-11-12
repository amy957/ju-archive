import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:5173';
test('fix31 · 顶栏设置/提醒浮窗可开且落在视口内 · 置顶有反馈', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  /* fixr6-5 · ISSUE-005：假桥补 core.invoke（真 Tauri 形态）；仅 __TAURI__ 命名空间不再算桌面 */
  await ctx.addInitScript(() => { localStorage.setItem('juju.settingspos', JSON.stringify({ x: 1500, y: 700 })); const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} }; (window as any).__TAURI__ = { core: { invoke: async (c: string) => (c === 'load_state' ? '{}' : null) }, window: { getCurrent: () => api, getCurrentWindow: () => api } }; });
  const page = await ctx.newPage(); const logs: string[] = []; page.on('console', (m) => logs.push(m.text()));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.actions); }, null, { timeout: 60_000 });
  const inView = async (s: string) => page.locator(s).first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
  await page.locator('#btnSettings').click(); await expect(page.locator('#settingsPanel')).toBeVisible();
  expect(await inView('#settingsPanel')).toBe(true);
  await page.locator('#btnBell').click(); await expect(page.locator('#remindPanel')).toBeVisible();
  await expect(page.locator('#remindPanel')).toHaveClass(/\bon\b/);
  expect(await page.locator('#tbNav[data-tauri-drag-region]').count()).toBe(0);
  expect(await page.locator('#tbNav .tb-nav-btn[data-tauri-drag-region]').count()).toBe(0);
  expect(await page.locator('#topbar[data-tauri-drag-region]').count()).toBe(1);
  expect(await page.locator('#tbClock[data-tauri-drag-region]').count()).toBe(1);
  await page.locator('#btnPin').click(); await expect(page.locator('#btnPin')).toHaveClass(/\bon\b/);
  expect(logs).toContain('[btnSet] clicked'); expect(logs).toContain('[btnBell] clicked'); expect(logs.some((l) => l.startsWith('[popover] toggle'))).toBe(true);
  await ctx.close();
});
