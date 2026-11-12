import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
const N = (id: string, text: string) => ({ id, text, parent: null, children: [], collapsed: false, done: false, date: null, tags: [], priority: 0, createdAt: 1, updatedAt: 1 });
test('review9-12 · 导入快照携带 ui 偏好白名单且不含敏感键', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { return r.fulfill({ status: 404, body: '' }); } });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.handleImportFiles && J.ui); }, null, { timeout: 60_000 });
  await page.evaluate(() => { const u = (window as any).JU.ui(); u.theme = 'night'; document.documentElement.dataset.theme = 'night'; });
  const backup = { tagColors: {}, rootId: 'r12', nodes: { r12: { ...N('r12', '快照根'), parent: null } } };
  await page.evaluate((raw) => { const J = (window as any).JU; const f = new File([raw], 'snap.json', { type: 'application/json' }); void J.handleImportFiles([f]); }, JSON.stringify(backup));
  const cancel = page.locator('.modal-overlay .modal [data-cancel]').last(); await expect(cancel).toBeVisible({ timeout: 30_000 }); await cancel.click();
  await expect.poll(async () => page.evaluate(() => !!localStorage.getItem('juju.backup.preimport')), { timeout: 20_000 }).toBe(true);
  const snap = await page.evaluate(() => JSON.parse(localStorage.getItem('juju.backup.preimport') || '{}'));
  expect(snap.ui, '快照必须携带 ui 偏好').toBeTruthy(); expect(snap.ui.theme, 'ui.theme 应回填').toBe('night');
  expect(Object.keys(snap.ui), '运行期键不得入快照').not.toContain('encKey'); expect(Object.keys(snap.ui)).not.toContain('encrypted');
  await page.evaluate(() => localStorage.removeItem('juju.backup.preimport')); await ctx.close();
});
