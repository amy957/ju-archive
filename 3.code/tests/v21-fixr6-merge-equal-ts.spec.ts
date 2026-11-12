import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173'; const KEY = 'juju.store.v31';
test('fixr6-8 · 两标签各落盘 10 节点后磁盘必须为 20（写盘前合并门槛）', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  /* 遮蔽跨标签广播与 storage 事件：只留「写盘前从磁盘合并」一条收敛路径，才复现广播未到达即保存的丢更新窗口 */
  await ctx.addInitScript(() => { const w = window as any; const add = w.addEventListener.bind(window); w.addEventListener = (t: string, f: any, o: any) => { if (t !== 'storage') add(t, f, o); }; w.BroadcastChannel = class { onmessage: any = null; postMessage(): void {} addEventListener(): void {} removeEventListener(): void {} close(): void {} }; });
  const a = await ctx.newPage(); const b = await ctx.newPage();
  for (const p of [a, b]) { await p.goto(BASE, { waitUntil: 'load' }); await p.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.actions && typeof J.getState === 'function'); }, null, { timeout: 60_000 }); }
  const quiet = (p: any) => p.waitForFunction((k: string) => { const w = window as any; let r = -1; try { r = (JSON.parse(localStorage.getItem(k) || 'null') || {})._rev ?? -1; } catch { r = -1; } const now = Date.now(); const s = w.__revQuiet; if (r < 0) return false; if (!s || s.rev !== r) { w.__revQuiet = { rev: r, t: now }; return false; } return now - s.t >= 600; }, KEY, { timeout: 20_000, polling: 100 }); /* 条件等待：_rev 连续采样相等且静默超过防抖窗口才开写 */
  for (const p of [a, b]) await quiet(p); /* 两标签各自启动落盘静默，避免 boot 期写盘干扰计数 */
  const add = (p: any, tag: string) => p.evaluate((t: string) => { const J = (window as any).JU; const root = J.getState().rootId; for (let i = 0; i < 10; i++) J.actions.addNode(root, null, { text: 'fixr6-8-' + t + '-' + i }); J.flushPersistNow(); }, tag);
  const count = (p: any) => p.evaluate((k: string) => { const st = JSON.parse(localStorage.getItem(k) || '{}'); return Object.values(st.nodes || {}).filter((x: any) => String(x.text || '').includes('fixr6-8-')).length; }, KEY);
  await add(a, 'A'); await expect.poll(() => a.evaluate((k: string) => (localStorage.getItem(k) || '').includes('fixr6-8-A-9'), KEY), { message: 'A 批次未落盘', timeout: 20_000 }).toBe(true);
  await a.close(); /* A 落盘后退出：此后只有 B 的写盘能拿到两边的并集，丢更新不再被后续广播写回掩盖 */
  await add(b, 'B');
  await expect.poll(() => count(b), { message: '两标签各 10 节点必须都落盘（得 10 即整快照覆盖丢更新）', timeout: 20_000 }).toBe(20);
  await ctx.close(); });
