import { test, expect } from '@playwright/test'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
/* fix43-2 · ISSUE-002：load_state 归一只产出 {hasData,state}（无 ui 字段），boot 不得就地置 desktopUiApplied，
   否则尾段 loadUI() 早退，juju.ui.v31 里的桌面端 UI 偏好（主题）永不恢复。 */
const BARE = JSON.stringify({ rootId: 'r1', nodes: { r1: { id: 'r1', title: '根', type: 'folder', children: ['d1'] }, d1: { id: 'd1', title: '文档一', type: 'doc', children: [] } } });
test('fix43-2 · 裸 state 快照下仍恢复 juju.ui.v31 主题', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  await ctx.addInitScript((bare: string) => {
    localStorage.setItem('juju.ui.v31', JSON.stringify({ theme: 'night' })); localStorage.setItem('juju.theme.manual', '1');
    const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} };
    (window as any).__TAURI__ = { core: { invoke: async (cmd: string) => (cmd === 'load_state' ? bare : null) }, window: { getCurrent: () => api, getCurrentWindow: () => api } };
  }, BARE);
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && typeof J.getState === 'function' && J.actions); }, null, { timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme), { timeout: 30_000 }).toBe('night');
  await ctx.close();
});
