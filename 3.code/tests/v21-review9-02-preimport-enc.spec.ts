import { test, expect } from '@playwright/test';
import { prepare, skeleton, ready } from './review8-helpers';
const PW = 'pw-review9-02'; const MARK = 'REVIEW902-PREIMPORT'; const nodes = { 'imp-root': { id: 'imp-root', text: '导入根', parent: null, children: ['imp-doc'], collapsed: false, done: false, date: null, tags: [], priority: 0, createdAt: 1, updatedAt: 1 }, 'imp-doc': { id: 'imp-doc', text: '导入文档', parent: 'imp-root', children: ['imp-child'], collapsed: false, done: false, date: null, tags: [], priority: 0, createdAt: 2, updatedAt: 2 }, 'imp-child': { id: 'imp-child', text: '导入节点A', parent: 'imp-doc', children: [], collapsed: false, done: false, date: null, tags: [], priority: 0, createdAt: 3, updatedAt: 3 } };
const importJson = async (page: any, json: string, flag: string) => { await page.evaluate(([raw, key]: any) => { const J = (window as any).JU; const file = new File([raw], 'r9-preimport.json', { type: 'application/json' }); (window as any)[key] = false; void J.handleImportFiles([file]).then(() => { (window as any)[key] = true; }); }, [json, flag]); const ok = page.locator('.modal-overlay .modal [data-ok]').last(); await expect(ok).toBeVisible({ timeout: 30_000 }); await ok.click(); await expect.poll(async () => page.evaluate((key: string) => !!(window as any)[key], flag), { timeout: 60_000 }).toBe(true); };
test('review9-02 · 加密态导入成功后消费 preimport，重载保留导入结果', async ({ context, page }) => {
  test.setTimeout(180_000); await prepare(context); await skeleton(context); await page.goto('/'); await ready(page); await page.waitForFunction(() => !!(window as any).JU && !!document.querySelector('#content')?.children.length, null, { timeout: 4000 });
  await page.evaluate(([pw, mark]: any) => { const J = (window as any).JU; const u = J.ui(); u.encrypted = true; u.encKey = pw; const s = J.getState(); s.nodes[s.rootId].text = mark; J.flushPersistNow(); }, [PW, MARK]);
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('juju.enc.v1') || ''), { timeout: 60_000 }).not.toBe('');
  const before = await page.evaluate(() => localStorage.getItem('juju.enc.v1') || '');
  await importJson(page, JSON.stringify({ tagColors: {}, rootId: 'imp-root', nodes }), '__r9done');
  expect(await page.evaluate(() => localStorage.getItem('juju.backup.preimport')), '成功恢复即消费快照').toBeNull();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('juju.enc.v1') || ''), { timeout: 60_000 }).not.toBe(before);
  await page.reload(); await page.waitForSelector('#unlockPwd', { timeout: 60_000 }); await page.fill('#unlockPwd', PW); await page.click('#unlockOk');
  await expect.poll(async () => page.evaluate(() => { const J = (window as any).JU; const st = J && J.getState(); return st && st.nodes[st.rootId] ? String(st.nodes[st.rootId].text || '') : ''; }), { timeout: 90_000 }).toBe('导入根');
});
test('review9-02 · 明文态导入成功后清理 preimport', async ({ context, page }) => {
  test.setTimeout(180_000); await prepare(context); await skeleton(context); await page.goto('/'); await ready(page); await page.waitForFunction(() => !!(window as any).JU && !!document.querySelector('#content')?.children.length, null, { timeout: 4000 });
  await importJson(page, JSON.stringify({ tagColors: {}, rootId: 'p-root', nodes: { 'p-root': { id: 'p-root', text: '明文根', parent: null, children: [], collapsed: false, done: false, date: null, tags: [], priority: 0, createdAt: 1, updatedAt: 1 } } }), '__r9done2');
  expect(await page.evaluate(() => localStorage.getItem('juju.backup.preimport'))).toBeNull();
});
