import { test, expect } from '@playwright/test'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
/* fix43-1 · ISSUE-001：__TAURI__ 仅有 window 命名空间（无 core.invoke / tauri.invoke）时不算桌面通道，
   加密保存必须写 localStorage[juju.enc.v1]，不得走桌面分支写后端后再删掉浏览器副本。 */
test('fix43-1 · 仅注入 window 的 __TAURI__ 时加密保存落 localStorage', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  await ctx.addInitScript(() => { const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} }; (window as any).__TAURI__ = { window: { getCurrent: () => api, getCurrentWindow: () => api } }; });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && typeof J.getState === 'function' && J.actions); }, null, { timeout: 60_000 });
  await page.click('#btnSettings'); await expect(page.locator('#setEncrypt'), '设置面板必须提供全库加密开关').toBeVisible({ timeout: 15_000 });
  await page.locator('#setEncrypt').dispatchEvent('click'); await page.locator('#setPwd1').fill('test123'); await page.locator('#setPwd2').fill('test123');
  await page.locator('.modal-overlay [data-ok]').last().click(); await expect(page.locator('.modal-overlay'), '设密码面板写入完成后必须关闭').toHaveCount(0, { timeout: 60_000 });
  const encStore = await page.evaluate(() => localStorage.getItem('juju.enc.v1'));
  expect(encStore).not.toBeNull();
  await ctx.close();
});
/* review15-10/13 · ISSUE-010：关闭加密时 __TAURI__ 退化为仅 window 命名空间（无 core.invoke），
   必须拒绝关闭并提示桥接不可用，不得提示「已关闭加密」，磁盘 load_state 仍保留 encStore。 */
test('review15-10 · 关闭加密遇命名空间-only 桥接必须失败且保留 encStore', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  await ctx.addInitScript(() => {
    const w = window as any;
    w.__r15 = { enc: '', invoke: null };
    w.__r15.invoke = async (cmd: string, args?: any) => {
      if (cmd === 'load_state') return w.__r15.enc ? JSON.stringify({ encStore: w.__r15.enc }) : '{}';
      if (cmd === 'save_state') { const p = String((args && args.payload) || ''); try { const o = JSON.parse(p); if (o && o.encStore) w.__r15.enc = o.encStore; } catch { /* 明文载荷 */ } return 'ok'; }
      if (cmd === 'save_plain_and_clear') { w.__r15.enc = ''; return 'ok'; }
      return 'ok';
    };
    const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} };
    w.__TAURI__ = { core: { invoke: w.__r15.invoke }, window: { getCurrent: () => api, getCurrentWindow: () => api }, event: { listen: async () => () => {} } };
  });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && typeof J.getState === 'function' && J.actions); }, null, { timeout: 60_000 });
  await page.click('#btnSettings'); await expect(page.locator('#setEncrypt')).toBeVisible({ timeout: 15_000 });
  await page.locator('#setEncrypt').dispatchEvent('click'); await page.locator('#setPwd1').fill('test123'); await page.locator('#setPwd2').fill('test123');
  await page.locator('.modal-overlay [data-ok]').last().click(); await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => String((window as any).__r15.enc || '')), { timeout: 30_000 }).not.toBe('');
  /* 关闭加密前撤掉 core.invoke：__TAURI__ 只剩 window 命名空间（ISSUE-010 缺陷态） */
  await page.evaluate(() => { const w = window as any; w.__r15.invoke = w.__TAURI__.core.invoke; w.__TAURI__ = { window: w.__TAURI__.window }; });
  await page.locator('#setEncrypt').dispatchEvent('click'); await page.locator('.modal-overlay [data-ok]').last().click({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => { const t = document.querySelector('#toast'); return t ? t.textContent || '' : ''; }), { timeout: 30_000 }).toContain('桥接不可用');
  const state = await page.evaluate(() => { const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui; return { toast: (document.querySelector('#toast') as any).textContent || '', encrypted: !!u.encrypted }; });
  expect(state.toast, '命名空间-only 桥接不得提示已关闭加密').not.toContain('已关闭加密');
  expect(state.encrypted, '关闭失败必须回滚加密态').toBe(true);
  const disk = await page.evaluate(async () => JSON.parse(await (window as any).__r15.invoke('load_state')));
  expect(String(disk.encStore || '').length, '关闭失败后 load_state 仍须带 encStore').toBeGreaterThan(0);
  await ctx.close();
});
