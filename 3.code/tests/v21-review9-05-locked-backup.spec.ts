import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
async function boot(browser: any, enc: boolean) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { return r.fulfill({ status: 404, body: '' }); } });
  await ctx.addInitScript((useEnc: boolean) => { const w = window as any; w.__ev = []; const snap = useEnc ? JSON.stringify({ encStore: JSON.stringify({ v: 1, salt: 's', iv: 'i', ct: 'c' }) }) : '{}'; const api: any = { hide: async () => { w.__ev.push('hide'); }, close: async () => { w.__ev.push('close'); }, onCloseRequested: async (f: any) => { w.__closeCb = f; }, minimize: async () => {}, toggleMaximize: async () => {}, setAlwaysOnTop: async () => {} }; w.__TAURI__ = { window: { getCurrent: () => api, getCurrentWindow: () => api }, core: { invoke: (c: string, a: any) => { if (c === 'save_backup') { w.__ev.push('save_backup'); return Promise.resolve('ok'); } return Promise.resolve(c === 'load_state' ? snap : 'ok'); } } }; }, enc);
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' }); return { ctx, page };
}
async function closeCalls(page: any) { await page.evaluate(() => (window as any).__closeCb({ preventDefault() {} })); await page.waitForFunction(() => ((window as any).__ev as string[]).includes('close'), null, { timeout: 30_000 }); return page.evaluate(() => ((window as any).__ev as string[]).filter((x) => x === 'save_backup').length); }
test('review9-05 · 加密取消解锁与锁定无密钥关窗均不得产生空备份', async ({ browser }) => {
  const a = await boot(browser, true); await expect(a.page.locator('#unlockPwd')).toBeVisible({ timeout: 30_000 }); await a.page.keyboard.press('Escape');
  expect(await closeCalls(a.page), '锁定态不得调用 save_backup').toBe(0); await a.ctx.close();
  const b = await boot(browser, false); await b.page.evaluate(() => { const u = (window as any).JU.ui(); u.locked = true; u.encrypted = false; u.encKey = null; });
  expect(await closeCalls(b.page), '锁定无密钥不得调用 save_backup').toBe(0); await b.ctx.close();
});
test('review9-05 · 解锁态关窗仍写 1 次备份', async ({ browser }) => {
  const { ctx, page } = await boot(browser, false); expect(await closeCalls(page), '解锁态关窗应写 1 次备份').toBe(1); await ctx.close();
});
