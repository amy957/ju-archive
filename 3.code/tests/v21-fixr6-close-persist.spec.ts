import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
test('fixr6-4 · 关窗等主库 save_state 落盘后再 close', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  await ctx.addInitScript(() => { const w = window as any; const ev: string[] = []; const hold: Array<() => void> = []; let cb: any = null;
    /* 【review12-fix · #3/#4】程序化 close() 不再派发 close-requested（真实 Tauri 语义）；
       自定义 X 直接调用 session 暴露的处理函数，close() 仅记录退出。 */
    const api: any = { hide: async () => { ev.push('hide'); }, close: async () => { ev.push('close'); }, onCloseRequested: async (f: any) => { cb = f; w.__closeCb = f; }, minimize: async () => {}, toggleMaximize: async () => {}, setAlwaysOnTop: async () => {} };
    w.__ev = ev; w.__hold = false; w.__release = () => { hold.splice(0).forEach((f) => f()); };
    w.__TAURI__ = { window: { getCurrent: () => api, getCurrentWindow: () => api }, core: { invoke: (c: string, a: any) => { if (c === 'save_state') { ev.push('save_state:req'); (w.__pl = w.__pl || []).push(String((a && a.payload) || '')); return new Promise((res) => { const ok = () => { ev.push('save_state:ok'); res('ok'); }; if (w.__hold) hold.push(ok); else ok(); }); } return Promise.resolve(c === 'load_state' ? '{}' : 'ok'); } } }; });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const w = window as any; const J = w.JU; if (!(J && J.actions && w.__closeCb)) return false; const s = JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])); const ok = w.__lsSp === s; w.__lsSp = s; return ok; }, null, { timeout: 60_000, polling: 100 });
  await page.evaluate(() => { const w = window as any; const J = w.JU; w.__ev.length = 0; w.__pl = []; w.__hold = true; J.actions.addNode(J.getState().rootId, null, { text: 'fixr6-4' }); });
  await page.waitForFunction(() => ((window as any).__ev as string[]).includes('save_state:req'), null, { timeout: 20_000 });
  await page.evaluate(() => { const w = window as any; const J = w.JU; J.actions.addNode(J.getState().rootId, null, { text: 'fixr6-19-late' }); document.getElementById('btnClose')!.click(); });
  await page.waitForFunction(() => { const ev = (window as any).__ev as string[]; return ev.includes('hide') && ev.includes('save_state:req'); }, null, { timeout: 20_000 }); await page.evaluate(() => (window as any).__release());
  await page.waitForFunction(() => ((window as any).__ev as string[]).filter((x) => x === 'save_state:req').length >= 2, null, { timeout: 20_000 }); await page.evaluate(() => (window as any).__release());
  await page.waitForFunction(() => ((window as any).__ev as string[]).includes('close'), null, { timeout: 20_000 }); const ev: string[] = await page.evaluate(() => (window as any).__ev);
  const pl: string[] = await page.evaluate(() => (window as any).__pl); const second = ev.indexOf('save_state:req', ev.indexOf('save_state:req') + 1);
  expect(second > -1 && second < ev.indexOf('close') && (pl[1] || '').includes('fixr6-19-late'), '末次编辑未落盘').toBe(true);
  expect(ev.lastIndexOf('save_state:ok'), 'save_state 先于 close 完成').toBeLessThan(ev.indexOf('close'));
  await ctx.close(); });
test('fixr6-10 · 连点关闭只触发一次隐藏与备份', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  await ctx.addInitScript(() => { const w = window as any; const ev: string[] = []; const hold: Array<() => void> = []; let cb: any = null; let released = false; w.__terminated = false;
    /* 【review12-fix · #3/#4】自定义 X 直连 close-requested 处理函数；程序化 close() 只记录退出，
       不再回调 handler（真实 Tauri 语义），连点抑制由 session 的 _closeInFlight 保证。 */
    const api: any = { hide: async () => { ev.push('hide'); }, close: async () => { ev.push('close'); }, onCloseRequested: async (f: any) => { cb = f; w.__closeCb = f; }, minimize: async () => {}, toggleMaximize: async () => {}, setAlwaysOnTop: async () => {} };
    w.__ev = ev; w.__release = () => { released = true; hold.splice(0).forEach((f) => f()); }; setInterval(() => { if (released) hold.splice(0).forEach((f) => f()); }, 100);
    w.__TAURI__ = { window: { getCurrent: () => api, getCurrentWindow: () => api }, core: { invoke: (c: string) => { if (c === 'save_state') { ev.push('save_state:req'); const ok = () => { ev.push('save_state:ok'); }; return w.__hold ? new Promise((res) => { hold.push(() => { ok(); res('ok'); }); }) : Promise.resolve(ok() as any); } return Promise.resolve(c === 'load_state' ? '{}' : 'ok'); } } }; });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const w = window as any; const J = w.JU; if (!(J && J.actions && w.__closeCb)) return false; const s = JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])); const ok = w.__lsSp === s; w.__lsSp = s; return ok; }, null, { timeout: 60_000, polling: 100 });
  await page.evaluate(() => { const w = window as any; const J = w.JU; w.__ev.length = 0; w.__hold = true; w.__terminated = false; J.actions.setStar(Object.keys(J.getState().nodes)[0], 1); const b = document.getElementById('btnClose')!; b.click(); b.click(); });
  await expect.poll(async () => page.evaluate(() => { const w = window as any; const ev = w.__ev as string[]; return [ev.filter((x) => x === 'save_state:req').length, ev.filter((x) => x === 'hide').length]; }), { timeout: 20_000 }).toEqual([1, 1]);
  const mid: string[] = await page.evaluate(() => (window as any).__ev);
  expect([mid.filter((x) => x === 'save_state:req').length, mid.filter((x) => x === 'hide').length], '连点只触发一次隐藏与备份').toEqual([1, 1]);
  await page.evaluate(() => (window as any).__release());
  await expect.poll(async () => page.evaluate(() => { const ev = (window as any).__ev as string[]; return ev.includes('close') && ev.includes('save_state:ok'); }), { timeout: 20_000 }).toBe(true); const ev: string[] = await page.evaluate(() => (window as any).__ev);
  expect([ev.filter((x) => x === 'save_state:req').length, ev.filter((x) => x === 'hide').length], '连点全程只备份/隐藏一次').toEqual([1, 1]);
  await ctx.close(); });
test('review7-12 · 关页前 flushPendingLogs 补齐待落盘 activity 日志', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const w = window as any; const J = w.JU; if (!(J && J.actions)) return false; const s = JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])); const ok = w.__lsSp === s; w.__lsSp = s; return ok; }, null, { timeout: 60_000, polling: 100 });
  const r = await page.evaluate(() => {
    const J = (window as any).JU; const id = J.actions.addNode(J.getState().rootId, null, { text: '__r7_12_flush__' });
    const n = () => Object.values(J.getState().activity || {}).reduce((c: number, b: any) => c + ((b && b.mod) ? b.mod.filter((e: any) => e.id === id).length : 0), 0);
    const before = n(); J.actions.logActivity('mod', id); const pending = n() === before;
    window.dispatchEvent(new Event('beforeunload'));
    return { pending, flushed: n() - before };
  });
  expect(r.pending, 'beforeunload 前应处于防抖待落盘').toBe(true);
  expect(r.flushed, '关页前 getLogTimers/flushPendingLogs 未接线').toBe(1);
  await ctx.close(); });
test('review9-03 · 自动备份关闭时关闭仍先等主库 save_state 落盘', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  await ctx.addInitScript(() => { localStorage.setItem('juju.ui.v31', JSON.stringify({ autoBackupOnClose: false })); const w = window as any; const ev: string[] = []; const hold: Array<() => void> = []; let cb: any = null;
    /* 【review12-fix · #3/#4】程序化 close() 不再派发 close-requested（真实 Tauri 语义） */
    const api: any = { hide: async () => { ev.push('hide'); }, close: async () => { ev.push('close'); }, onCloseRequested: async (f: any) => { cb = f; w.__closeCb = f; }, minimize: async () => {}, toggleMaximize: async () => {}, setAlwaysOnTop: async () => {} };
    w.__ev = ev; w.__hold = false; w.__release = () => { hold.splice(0).forEach((f) => f()); };
    w.__TAURI__ = { window: { getCurrent: () => api, getCurrentWindow: () => api }, core: { invoke: (c: string) => { if (c === 'save_backup') { ev.push('save_backup'); return Promise.resolve('ok'); } if (c === 'save_state') { ev.push('save_state:req'); return new Promise((res) => { const ok = () => { ev.push('save_state:ok'); res('ok'); }; if (w.__hold) hold.push(ok); else ok(); }); } return Promise.resolve(c === 'load_state' ? '{}' : 'ok'); } } }; });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const w = window as any; const J = w.JU; if (!(J && J.actions && w.__closeCb)) return false; const s = JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])); const ok = w.__lsSp === s; w.__lsSp = s; return ok; }, null, { timeout: 60_000, polling: 100 });
  await page.evaluate(() => { const w = window as any; const J = w.JU; w.__ev.length = 0; w.__hold = true; J.actions.addNode(J.getState().rootId, null, { text: 'review9-03' }); document.getElementById('btnClose')!.click(); });
  await page.waitForFunction(() => { const ev = (window as any).__ev as string[]; return ev.includes('hide') && ev.includes('save_state:req'); }, null, { timeout: 20_000 });
  expect(((await page.evaluate(() => (window as any).__ev as string[])).includes('close')), '备份开关关闭时 close 不得早于主库落盘').toBe(false);
  await page.evaluate(() => (window as any).__release());
  await page.waitForFunction(() => ((window as any).__ev as string[]).includes('close'), null, { timeout: 20_000 });
  const ev2: string[] = await page.evaluate(() => (window as any).__ev);
  expect(ev2.indexOf('save_state:ok'), 'save_state 未在 close 前完成').toBeGreaterThan(-1);
  expect(ev2.indexOf('save_state:ok'), 'save_state 先于 close 完成').toBeLessThan(ev2.indexOf('close'));
  expect(ev2.includes('save_backup'), '自动备份已关闭仍调用了 save_backup').toBe(false);
  await ctx.close(); });
