import { test, expect } from '@playwright/test'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
/* fix33-3 · ISSUE-003：__TAURI__ 存在不等于 invoke 可用；无 core/tauri.invoke 时 desktopSave 必须失败 */
const start = async (browser: any, withInvoke: boolean) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  await ctx.addInitScript((inv: boolean) => { const w = window as any; w.__juCalls = []; w.__juToasts = [];
    const note = (rs: any[]) => { for (const r of rs) { const n: any = r.type === 'characterData' ? r.target : (r.addedNodes && r.addedNodes[0]); if (!n) continue; const s = n.data !== undefined ? String(n.data) : (n.textContent || ''); if (s && w.__juToasts[w.__juToasts.length - 1] !== s) w.__juToasts.push(s); } };
    const attach = () => { const box = document.getElementById('toast'); if (!box) return setTimeout(attach, 10); new MutationObserver(note).observe(box, { childList: true, characterData: true, subtree: true }); }; attach();
    const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} };
    const base: any = { window: { getCurrent: () => api, getCurrentWindow: () => api }, event: { listen: async () => () => {} } };
    if (inv) base.core = { invoke: async (cmd: string, args?: any) => { w.__juCalls.push({ cmd, args }); return cmd === 'load_state' ? '{}' : null; } };
    w.__TAURI__ = base; }, withInvoke);
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && typeof J.getState === 'function' && J.actions); }, null, { timeout: 60_000 }); return { ctx, page }; };
const edit = async (page: any) => { await page.evaluate(() => { const J = (window as any).JU; J.actions.addNode(J.getState().rootId, null, { text: 'fix33-3 guard' }); J.flushPersistNow(); }); await page.waitForFunction(() => { const w = window as any; return !!(w.__juCalls || []).some((c: any) => c.cmd === 'save_state') || localStorage.getItem('juju.store.v31') !== null; }, null, { timeout: 4000 }); return page.evaluate(() => { const w = window as any; return { toasts: (w.__juToasts || []).join('|'), store: localStorage.getItem('juju.store.v31'), calls: (w.__juCalls || []).map((c: any) => String(c.cmd)).join(',') }; }); };
test('fix33-3 · 负向：__TAURI__ 无 invoke 时判定非桌面并回落到 localStorage 分支', async ({ browser }) => {
  const { ctx, page } = await start(browser, false); const r = await edit(page); expect(r.store, '无 invoke 时须回落 localStorage 分支落盘').not.toBeNull(); expect(r.toasts).not.toContain('桌面存储保存失败'); expect(r.calls).not.toContain('save_state'); await ctx.close(); });
test('fix33-3 · 正向：invoke resolve(null) 时不得出现「桌面存储保存失败」toast', async ({ browser }) => {
  const { ctx, page } = await start(browser, true); const r = await edit(page); expect(r.calls).toContain('save_state'); expect(r.toasts).not.toContain('桌面存储保存失败'); await ctx.close(); });
