import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
const N = (id: string, parent: any, children: string[], text: string) => ({ id, text, parent, children, collapsed: false, done: false, date: null, tags: [], priority: 0, createdAt: 1, updatedAt: 1 });
test('review9-08 · 旧备份归一化补齐缺省字段并按 parent 重建 children', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { return r.fulfill({ status: 404, body: '' }); } });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.handleImportFiles && J.getState); }, null, { timeout: 60_000 });
  const legacy = { rootId: 'r', nodes: { r: N('r', null, ['a', 'a', 'x'], '根'), a: N('a', 'r', [], '子'), x: N('x', 'a', [], '错挂'), o: N('o', 'missing', [], '孤儿') } };
  await page.evaluate((raw) => { const J = (window as any).JU; const f = new File([raw], 'legacy.json', { type: 'application/json' }); (window as any).__imp = false; void J.handleImportFiles([f]).then(() => { (window as any).__imp = true; }); }, JSON.stringify(legacy));
  const ok = page.locator('.modal-overlay .modal [data-ok]').last(); await expect(ok).toBeVisible({ timeout: 30_000 }); await ok.click();
  await expect.poll(async () => page.evaluate(() => !!(window as any).__imp), { timeout: 60_000 }).toBe(true);
  const got = await page.evaluate(() => { const st = (window as any).JU.getState(); const m = st.nodes; return { tc: typeof st.tagColors, db: Array.isArray(st.dbFields), act: typeof st.activity, ver: typeof st._ver, root: m[st.rootId].children.slice(), ac: (m.a.children || []).slice(), op: m.o && m.o.parent, bad: Object.keys(m).some((id) => (m[id].children || []).some((c: string) => !m[c])) }; });
  expect(got.tc, 'tagColors 缺省').toBe('object'); expect(got.db, 'dbFields 缺省').toBe(true); expect(got.act, 'activity 缺省').toBe('object'); expect(got.ver, '_ver 缺省').toBe('number');
  expect(got.root.filter((x: string) => x === 'a').length, '重复引用必须去重').toBe(1); expect(got.root, '孤儿挂根').toContain('o'); expect(got.root, '错挂引用不得留在原父').not.toContain('x');
  expect(got.ac, '错挂节点按 parent 归位').toContain('x'); expect(got.op, '孤儿节点 parent 指向根').toBe('r'); expect(got.bad, '不得残留悬空 children').toBe(false);
  await ctx.close();
});
