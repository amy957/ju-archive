import { test, expect } from '@playwright/test'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
/* fix43-3 · ISSUE-003：加密态 UI 快照只写不读 —— 主题等偏好落在 juju.ui.enc，刷新解锁后必须回填。 */
test('fix43-3 · 加密态 UI 主题刷新后恢复', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && typeof J.getState === 'function' && J.actions); }, null, { timeout: 60_000 });
  await page.click('#btnSettings'); await expect(page.locator('#setEncrypt')).toBeVisible({ timeout: 15_000 });
  await page.locator('#setEncrypt').dispatchEvent('click'); await page.locator('#setPwd1').fill('test123'); await page.locator('#setPwd2').fill('test123');
  await page.locator('.modal-overlay [data-ok]').last().click(); await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 60_000 });
  await page.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('juju.ui.enc') || 'null').cipher; } catch { return false; } }, null, { timeout: 30_000 });
  await page.evaluate(() => { const w = window as any; try { w.__encBefore = (JSON.parse(localStorage.getItem('juju.ui.enc') || 'null') || {}).cipher || ''; } catch { w.__encBefore = ''; } w.JU.toggleTheme(); });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('night');
  await page.waitForFunction(() => { try { const c = (JSON.parse(localStorage.getItem('juju.ui.enc') || 'null') || {}).cipher; return !!c && c !== (window as any).__encBefore; } catch { return false; } }, null, { timeout: 15_000 });
  await page.reload({ waitUntil: 'load', timeout: 60_000 });
  await expect(page.locator('#unlockPwd')).toBeVisible({ timeout: 60_000 }); await page.locator('#unlockPwd').fill('test123'); await page.click('#unlockOk');
  await expect(page.locator('#unlockPwd')).toHaveCount(0, { timeout: 90_000 }); await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme), { timeout: 30_000 }).toBe('night');
  await ctx.close();
});
