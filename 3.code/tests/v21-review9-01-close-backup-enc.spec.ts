import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
test('review9-01 · 加密态关闭备份只落密文且不含明文节点', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { return r.fulfill({ status: 404, body: '' }); } });
  await ctx.addInitScript(() => { const calls: any[] = []; const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, setAlwaysOnTop: async () => {}, close: async () => {}, onCloseRequested: async (cb: any) => { (window as any).__closeCb = cb; } }; (window as any).__ioCalls = calls; (window as any).__TAURI__ = { window: { getCurrent: () => api, getCurrentWindow: () => api }, core: { invoke: async (cmd: string, args: any) => { calls.push({ cmd, args }); return 'ok'; } } }; });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.actions && (window as any).__closeCb); }, null, { timeout: 60_000 });
  await page.evaluate(() => { const u = (window as any).JU.ui(); u.encrypted = true; u.encKey = 'test123'; });
  await page.evaluate(async () => { await (window as any).__closeCb({ preventDefault: () => {} }); });
  const call: any = await (await page.waitForFunction(() => ((window as any).__ioCalls || []).find((c: any) => c.cmd === 'save_backup') || null, null, { timeout: 20_000 })).jsonValue();
  expect(String(call.args.content), '加密态关闭备份必须含密文字段').toContain('"cipher"');
  expect(String(call.args.content), '加密态关闭备份不得含明文节点').not.toContain('"nodes"');
  expect(String(call.args.name), '后缀应为 .enc.json').toContain('.enc.json');
  await ctx.close();
});
