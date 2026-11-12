import { test, expect } from '@playwright/test';
import { prepare, ready } from './review8-helpers';
const BASE = 'http://localhost:5173';
test('review25-04 · 相对名备份目录仅记录不可写且关窗不落盘', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await prepare(ctx);
  await ctx.addInitScript(() => { localStorage.setItem('juju.ui.v31', JSON.stringify({ autoBackupOnClose: true })); const w = window as any; const ev: string[] = []; w.__ev = ev; Object.defineProperty(w, 'showDirectoryPicker', { configurable: true, value: async () => ({ name: '相对备份目录' }) }); const app: any = { hide: async () => { ev.push('hide'); }, close: async () => { ev.push('close'); }, onCloseRequested: async (cb: any) => { w.__closeCb = cb; }, minimize: async () => {}, toggleMaximize: async () => {}, setAlwaysOnTop: async () => {} }; w.__TAURI__ = { window: { getCurrentWindow: () => app, getCurrent: () => app }, core: { invoke: async (c: string) => { ev.push(c); return c === 'load_state' ? '{}' : 'ok'; } } }; });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' }); await ready(page);
  await page.evaluate(() => (window as any).JU.openSettings());
  await page.locator('#btnBackupDirPick').click();
  await expect.poll(() => page.evaluate(() => (window as any).JU.ui().backupDir), { message: '浏览选择应写入相对名', timeout: 10_000 }).toBe('相对备份目录');
  expect(await page.evaluate(() => (window as any).JU.ui().backupDirWritable), '相对名不得标记可写').toBe(false);
  await expect.poll(() => page.evaluate(() => { const el = document.getElementById('toast'); return el ? String(el.textContent || '') : ''; }), { message: '必须提示仅记录路径', timeout: 10_000 }).toContain('仅记录路径');
  await expect.poll(() => page.evaluate(() => !!(window as any).__closeCb), { message: '关闭事件应已注册', timeout: 30_000 }).toBe(true);
  await page.evaluate(() => (window as any).__closeCb({ preventDefault: () => {} }));
  await expect.poll(() => page.evaluate(() => ((window as any).__ev as string[]).includes('close')), { message: '关闭流程应结束', timeout: 30_000 }).toBe(true);
  expect(await page.evaluate(() => ((window as any).__ev as string[]).filter((x) => x === 'save_backup').length), '相对名不得触发 save_backup').toBe(0);
  await ctx.close();
});
