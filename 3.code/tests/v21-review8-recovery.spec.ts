import { test, expect } from '@playwright/test';
import { prepare, skeleton, ready } from './review8-helpers';

test('review8 · preimport 自动备份可恢复', async ({ context, page }) => {
  test.setTimeout(180_000);
  await prepare(context);
  await skeleton(context);
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));
  await page.goto('/');
  await ready(page);
  await page.waitForFunction(() => !!(window as any).JU && !!document.querySelector('#content')?.children.length);
  await page.evaluate(() => { const J = (window as any).JU; const s = JSON.parse(JSON.stringify(J.getState())); delete s.dbFields; s.nodes[s.rootId].text = 'REVIEW8-PREIMPORT'; localStorage.setItem('juju.backup.preimport', JSON.stringify({ ts: Date.now(), state: s })); });
  await context.addInitScript(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (this: Storage, k: string) { return k === 'juju.store.v31' ? '{invalid_json}' : g.call(this, k); }; });
  await page.reload();
  await ready(page);
  const r = await page.evaluate(() => { const st = (window as any).JU.getState(); return { text: String(st.nodes[st.rootId].text || ''), dbFields: st.dbFields }; });
  expect(r.text).toBe('REVIEW8-PREIMPORT');
  expect(r.dbFields).toEqual(['标题', '优先级', '状态', '时间']);
  expect(pageErrors).toEqual([]);
});

test('review8 · 旧主库缺 dbFields 装载后补齐', async ({ context, page }) => {
  test.setTimeout(180_000);
  await prepare(context);
  await skeleton(context);
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));
  await page.goto('/');
  await ready(page);
  await page.waitForFunction(() => !!(window as any).JU && !!document.querySelector('#content')?.children.length);
  await page.evaluate(() => { const J = (window as any).JU; const s = JSON.parse(JSON.stringify(J.getState())); delete s.dbFields; s.nodes[s.rootId].text = 'REVIEW8-OLDLIB'; localStorage.setItem('juju.store.v31', JSON.stringify(s)); });
  await page.reload();
  await ready(page);
  const r = await page.evaluate(() => { const st = (window as any).JU.getState(); return { text: String(st.nodes[st.rootId].text || ''), dbFields: st.dbFields }; });
  expect(r.text).toBe('REVIEW8-OLDLIB');
  expect(r.dbFields).toEqual(['标题', '优先级', '状态', '时间']);
  expect(pageErrors).toEqual([]);
});
