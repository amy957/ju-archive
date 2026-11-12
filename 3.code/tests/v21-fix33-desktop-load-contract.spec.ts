import { test, expect } from '@playwright/test'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
/* fix33-1 · ISSUE-001：main.rs 的 load_state 返回裸 state（无 hasData/state 外壳），boot 必须先归一再装载 */
test('fix33 · load_state 裸 state 归一后 sentinel 装载且首条 save_state 含 sentinel', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  await ctx.addInitScript(() => {
    const w = window as any; w.__juCalls = [];
    const st = { nodes: { sentinel: { id: 'sentinel', text: 'fix33 sentinel', children: [], parent: null } }, rootId: 'sentinel', updatedAt: 1, ui: { theme: 'light' } };
    const invoke = async (cmd: string, args?: any) => { (w.__juCalls as any[]).push({ cmd, args }); return cmd === 'load_state' ? JSON.stringify(st) : null; };
    const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} };
    w.__TAURI__ = { core: { invoke }, window: { getCurrent: () => api, getCurrentWindow: () => api }, event: { listen: async () => () => {} } };
  });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && typeof J.getState === 'function' && J.actions); }, null, { timeout: 60_000 });
  const r = await page.evaluate(() => { const w = window as any; const c = (w.__juCalls || []).find((x: any) => x.cmd === 'save_state'); return { sentinel: !!w.JU.getState().nodes.sentinel, payload: c ? String((c.args || {}).payload || '') : '' }; });
  expect(r.sentinel).toBe(true); expect(r.payload).toContain('sentinel');
  await ctx.close();
});
