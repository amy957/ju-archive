import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:5173';
test('fix40 · 置顶/设置顺序对调 + 关闭无确认 + 关闭时写备份文件', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  /* ① 桌面桥接：close() 只登记，核心 invoke 全量记录，供断言读取 */
  await ctx.addInitScript(() => {
    const calls: any[] = [];
    const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, setAlwaysOnTop: async () => {}, close: async () => { (window as any).__winClosed = true; }, onCloseRequested: async (cb: any) => { (window as any).__closeCb = cb; } };
    (window as any).__ioCalls = calls;
    (window as any).__TAURI__ = { window: { getCurrent: () => api, getCurrentWindow: () => api }, core: { invoke: async (cmd: string, args: any) => { calls.push({ cmd, args }); return 'ok'; } } };
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.actions && (window as any).__closeCb); }, null, { timeout: 60_000 });
  /* ② 置顶按钮在设置按钮右侧（本轮对调结果） */
  const idx = await page.evaluate(() => ['btnSettings', 'btnPin'].map((id) => Array.prototype.indexOf.call(document.querySelectorAll('.tb-right .tb-wbtn'), document.getElementById(id))));
  expect(idx[0], '设置按钮序号应小于置顶按钮').toBeLessThan(idx[1]);
  /* ③ 点关闭：无自定义确认弹窗，close 直达；备份只由 close-requested 通道写盘 */
  await page.locator('#btnClose').click();
  await expect(page.locator('.modal-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__winClosed), '#btnClose 应直达 close()').toBe(true);
  expect(await page.evaluate(() => ((window as any).__ioCalls || []).some((c: any) => c.cmd === 'write_backup_file')), '按钮不得再旁路写备份').toBe(false);
  await page.evaluate(async () => { await (window as any).__closeCb({ preventDefault: () => {} }); });
  const backup = await page.waitForFunction(() => ((window as any).__ioCalls || []).find((c: any) => c.cmd === 'save_backup') || null, null, { timeout: 5000 });
  const call: any = await backup.jsonValue();
  expect(String(call.args.content)).toContain('"type":"full-backup"');
  await ctx.close();
});
test('fix40-enc · 加密态关闭备份只落密文且后缀 .enc.json', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  await ctx.addInitScript(() => {
    const calls: any[] = [];
    const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, setAlwaysOnTop: async () => {}, close: async () => {}, onCloseRequested: async (cb: any) => { (window as any).__closeCb = cb; } };
    (window as any).__ioCalls = calls;
    (window as any).__TAURI__ = { window: { getCurrent: () => api, getCurrentWindow: () => api }, core: { invoke: async (cmd: string, args: any) => { calls.push({ cmd, args }); return 'ok'; } } };
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.actions && (window as any).__closeCb); }, null, { timeout: 60_000 });
  await page.evaluate(() => { const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui; u.encrypted = true; u.encKey = 'test123'; });
  await page.evaluate(async () => { await (window as any).__closeCb({ preventDefault: () => {} }); });
  const backup = await page.waitForFunction(() => ((window as any).__ioCalls || []).find((c: any) => c.cmd === 'save_backup') || null, null, { timeout: 20_000 });
  const call: any = await backup.jsonValue();
  expect(String(call.args.content), '加密态关闭备份必须含密文字段').toContain('"cipher"');
  expect(String(call.args.content), '加密态关闭备份不得含明文节点').not.toContain('"nodes"');
  expect(String(call.args.name), '后缀应为 .enc.json').toContain('.enc.json');
  await ctx.close();
});
