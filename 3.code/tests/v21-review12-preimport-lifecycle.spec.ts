import { test, expect } from '@playwright/test';
import { prepare, skeleton, ready } from './review8-helpers';

const PW = 'review12-pw';
const PRE = 'juju.backup.preimport';
const STORE = 'juju.store.v31';
const node = (id: string, text: string) => ({ id, text, parent: null, children: [], collapsed: false, done: false, date: null, tags: [], priority: 0, createdAt: 1, updatedAt: 1 });
const snap = (id: string) => JSON.stringify({ ts: Date.now(), state: { rootId: id, nodes: { [id]: node(id, 'SNAPSHOT-' + id) }, tagColors: {} } });
const IMP = JSON.stringify({ tagColors: {}, rootId: 'imp', nodes: { imp: node('imp', 'IMPORTED') } });
const pre = (p: any) => p.evaluate(() => localStorage.getItem('juju.backup.preimport'));
const store = (p: any) => p.evaluate(() => localStorage.getItem('juju.store.v31'));
const root = (p: any) => p.evaluate(() => { const J = (window as any).JU; const s = J && J.getState(); return s ? String(s.rootId || '') : ''; });

test('review12 · A 主库可读 + 残留快照 → 不复活且快照被清除', async ({ context, page }) => {
  test.setTimeout(180_000); await prepare(context); await skeleton(context);
  await context.addInitScript((raw: string) => {
    localStorage.setItem('juju.backup.preimport', raw);
    const st = { nodes: { sentinel: { id: 'sentinel', text: 'MAIN-SENTINEL', parent: null, children: [] } }, rootId: 'sentinel', updatedAt: 1 };
    const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} };
    (window as any).__TAURI__ = { core: { invoke: async (c: string) => (c === 'load_state' ? JSON.stringify(st) : null) }, window: { getCurrent: () => api, getCurrentWindow: () => api }, event: { listen: async () => () => {} } };
  }, snap('old'));
  await page.goto('/'); await ready(page);
  await page.reload(); await ready(page);
  expect(await root(page)).toBe('sentinel');
  await expect.poll(() => pre(page), { timeout: 60_000 }).toBeNull();
});

test('review12 · B 忘记密码清空后 preimport 与主库均不复活', async ({ context, page }) => {
  test.setTimeout(180_000); await prepare(context); await skeleton(context);
  await context.addInitScript(() => {
    const w = window as any; w.__enc = sessionStorage.getItem('r12.encstore') || '';
    const invoke = async (cmd: string, args?: any) => {
      if (cmd === 'load_state') return w.__enc ? JSON.stringify({ encStore: w.__enc }) : '{}';
      if (cmd === 'save_state') { const p = String((args && args.payload) || ''); try { const o = JSON.parse(p); if (o && o.encStore) { w.__enc = o.encStore; sessionStorage.setItem('r12.encstore', w.__enc); } } catch { /* 非加密载荷 */ } return 'ok'; }
      if (cmd === 'clear_encrypted') { w.__enc = ''; sessionStorage.removeItem('r12.encstore'); return 'ok'; }
      return 'ok';
    };
    const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} };
    w.__TAURI__ = { core: { invoke }, window: { getCurrent: () => api, getCurrentWindow: () => api }, event: { listen: async () => () => {} } };
  });
  await page.goto('/'); await ready(page);
  await page.evaluate((json: string) => { const f = new File([json], 'r12.json', { type: 'application/json' }); void (window as any).JU.handleImportFiles([f]); }, IMP);
  await page.locator('.modal-overlay .modal [data-cancel]').last().click({ timeout: 30_000 });
  await expect.poll(() => pre(page), { timeout: 60_000 }).toContain('"state"');
  await page.evaluate((pw: string) => { const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui; u.encrypted = true; u.encKey = pw; J.actions.addNode(J.getState().rootId, null, { text: 'REVIEW12-ENC' }); J.flushPersistNow(); }, PW);
  await expect.poll(() => page.evaluate(() => (window as any).__enc || ''), { timeout: 60_000 }).not.toBe('');
  await page.reload(); await page.waitForSelector('#unlockPwd', { timeout: 60_000 });
  await page.click('#unlockReset');
  await page.locator('.modal-overlay .modal [data-ok]').last().click({ timeout: 30_000 });
  await expect.poll(() => page.locator('#unlockPwd').count(), { timeout: 60_000 }).toBe(0);
  const defRoot = await root(page);
  await expect.poll(() => pre(page), { timeout: 60_000 }).toBeNull();
  await page.reload(); await ready(page);
  expect(await root(page)).toBe(defRoot);
  expect(await pre(page)).toBeNull();
  expect(await store(page)).toBeNull();
});

test('review12 · C 主库不可读时快照被消费且一次性清除', async ({ context, page }) => {
  test.setTimeout(180_000); await prepare(context); await skeleton(context);
  await context.addInitScript((raw: string) => {
    localStorage.setItem('juju.backup.preimport', raw);
    localStorage.removeItem('juju.store.v31'); localStorage.removeItem('juju.pending.v1');
    const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} };
    (window as any).__TAURI__ = { core: { invoke: async (c: string) => (c === 'load_state' ? '{}' : 'ok') }, window: { getCurrent: () => api, getCurrentWindow: () => api }, event: { listen: async () => () => {} } };
  }, snap('snapC'));
  await page.goto('/'); await ready(page);
  await page.reload(); await ready(page);
  expect(await root(page)).toBe('snapC');
  await expect.poll(() => pre(page), { timeout: 60_000 }).toBeNull();
});

test('review13 · D clear_encrypted 失败必须保持锁定并提示（ISSUE-005）', async ({ context, page }) => {
  test.setTimeout(180_000); await prepare(context); await skeleton(context);
  await context.addInitScript(() => {
    const w = window as any; w.__enc = sessionStorage.getItem('r12.encstore') || '';
    const invoke = async (cmd: string, args?: any) => {
      if (cmd === 'load_state') return w.__enc ? JSON.stringify({ encStore: w.__enc }) : '{}';
      if (cmd === 'save_state') { const p = String((args && args.payload) || ''); try { const o = JSON.parse(p); if (o && o.encStore) { w.__enc = o.encStore; sessionStorage.setItem('r12.encstore', w.__enc); } } catch { /* 非加密载荷 */ } return 'ok'; }
      if (cmd === 'clear_encrypted') throw new Error('clear_encrypted failed (mock)');
      return 'ok';
    };
    const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} };
    w.__TAURI__ = { core: { invoke }, window: { getCurrent: () => api, getCurrentWindow: () => api }, event: { listen: async () => () => {} } };
  });
  await page.goto('/'); await ready(page);
  await page.evaluate((pw: string) => { const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui; u.encrypted = true; u.encKey = pw; J.actions.addNode(J.getState().rootId, null, { text: 'R13-ENC' }); J.flushPersistNow(); }, 'review13-pw');
  await expect.poll(() => page.evaluate(() => (window as any).__enc || ''), { timeout: 60_000 }).not.toBe('');
  await page.reload(); await page.waitForSelector('#unlockPwd', { timeout: 60_000 });
  await page.click('#unlockReset');
  await page.locator('.modal-overlay .modal [data-ok]').last().click({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => { const t = document.querySelector('#toast'); return t ? t.textContent || '' : ''; }), { timeout: 60_000 }).toContain('清空加密库失败');
  /* 锁定态的可观测口径：解锁模态仍在（失败未 resolve defaultState），且加密标记未翻转。 */
  await expect(page.locator('#unlockPwd'), '清空失败必须停留在解锁锁定界面').toBeVisible();
  const afterFail = await page.evaluate(() => {
    const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui;
    return { encrypted: !!u.encrypted, encKey: u.encKey, enc: String((window as any).__enc || '') };
  });
  expect(afterFail.encrypted, '清空失败不得翻转 ui.encrypted=false').toBe(true);
  expect(afterFail.encKey, '清空失败不得写入新的 encKey 假解锁').toBeFalsy();
  expect(afterFail.enc.length, '清空失败不得移除桌面密文库').toBeGreaterThan(0);
});

/* review15-01 · ISSUE-001：关闭加密 = 一次 save_plain_and_clear（明文快照落盘并删 encStore）
   → load_state 复核无 encStore；不得先 clear 后写。
   review14-02 · ISSUE-002：仅首次 save_state 延迟 800ms，制造「在途加密写盘」窗口；
   明文载荷回填磁盘既有 encStore（与 Rust save_state 同构）。 */
const r14Mock = (opts: any) => {
  const failClear = opts === true;
  const plainDelay = (opts && opts.plainDelay) || 0;
  const seed = (opts && opts.seed) || '';
  /* 【review17 · ISSUE-001】复核异常：save_plain_and_clear 成功后 load_state 首抛一次 */
  const rereadThrow = !!(opts && opts.rereadThrow);
  let throwNext = false;
  const w = window as any;
  if (seed) sessionStorage.setItem('r14.store', seed);
  w.__r14 = { saves: 0, saveEnd: 0, writeAt: 0, plainClears: 0 };
  const read = (): any => { try { return JSON.parse(sessionStorage.getItem('r14.store') || '{}'); } catch { return {}; } };
  const invoke = async (cmd: string, args?: any) => {
    if (cmd === 'load_state') {
      if (throwNext) { throwNext = false; throw new Error('load_state failed once (mock)'); }
      return JSON.stringify(read());
    }
    if (cmd === 'save_state') {
      const mine = ++w.__r14.saves;
      if (mine === 1) { sessionStorage.setItem('r14.saving', '1'); await new Promise((r) => setTimeout(r, 800)); }
      let o: any = {};
      try { o = JSON.parse(String((args && args.payload) || '')); } catch { o = {}; }
      const cur = read();
      const next: any = o && o.encStore ? { encStore: o.encStore } : { ...o, ...(cur.encStore ? { encStore: cur.encStore } : {}) };
      sessionStorage.setItem('r14.store', JSON.stringify(next));
      if (mine === 1) { w.__r14.saveEnd = Date.now(); sessionStorage.removeItem('r14.saving'); }
      return 'ok';
    }
    if (cmd === 'save_plain_and_clear') {
      w.__r14.writeAt = Date.now(); w.__r14.plainClears++;
      if (failClear) throw new Error('save_plain_and_clear failed (mock)');
      if (rereadThrow) throwNext = true;
      let o: any = {}; try { o = JSON.parse(String((args && args.payload) || '')); } catch { o = {}; }
      delete o.encStore; sessionStorage.setItem('r14.store', JSON.stringify(o));
      /* 【review15-02 · ISSUE-002】写已落盘、响应未返回：此处即强杀窗口 */
      if (plainDelay) await new Promise((r) => setTimeout(r, plainDelay));
      return 'ok';
    }
    return 'ok';
  };
  const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, setAlwaysOnTop: async () => {} };
  w.__TAURI__ = { core: { invoke }, window: { getCurrent: () => api, getCurrentWindow: () => api }, event: { listen: async () => () => {} } };
  const mount = (): void => { if (!document.getElementById('setEncrypt')) { const s = document.createElement('span'); s.id = 'setEncrypt'; (document.body || document.documentElement).appendChild(s); } };
  mount(); document.addEventListener('readystatechange', mount);
};
const r14Load = async (p: any): Promise<any> => p.evaluate(async () => JSON.parse(await (window as any).__TAURI__.core.invoke('load_state')));
const r14Toast = (p: any) => p.evaluate(() => { const t = document.querySelector('#toast'); return t ? t.textContent || '' : ''; });

test('review14 · E 关闭加密：在途密文写盘后先明文落盘再清 encStore', async ({ context, page }) => {
  test.setTimeout(180_000); await prepare(context); await skeleton(context);
  await context.addInitScript(r14Mock, false);
  await page.goto('/'); await ready(page);
  await page.evaluate((pw: string) => {
    const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui;
    u.encrypted = true; u.encKey = pw;
    const s = J.getState(); s.nodes[s.rootId].text = 'OLD-ENC'; J.flushPersistNow();
  }, PW);
  /* 首次加密写盘 800ms 未完成即关闭加密：close 必须排在在途 save_state 之后 */
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('r14.saving')), { timeout: 30_000 }).toBe('1');
  const clickAt = await page.evaluate(() => { (document.getElementById('setEncrypt') as any).click(); return Date.now(); });
  await page.locator('.modal-overlay .modal [data-ok]').last().click({ timeout: 30_000 });
  await expect.poll(() => r14Toast(page), { timeout: 60_000 }).toContain('已关闭加密');
  const order = await page.evaluate(() => ({ saves: (window as any).__r14.saves, saveEnd: (window as any).__r14.saveEnd, writeAt: (window as any).__r14.writeAt, plainClears: (window as any).__r14.plainClears }));
  expect(clickAt, '关闭动作必须发生在在途写盘窗口内').toBeLessThan(order.saveEnd);
  expect(order.writeAt, '原子写必须等在途 save_state 完成之后').toBeGreaterThanOrEqual(order.saveEnd);
  expect(order.plainClears, '关闭加密必须且只能一次原子写').toBe(1);
  const st1: any = await r14Load(page);
  expect(String(st1.encStore || ''), '关闭后主库不得残留 encStore').toBe('');
  /* 关闭后编辑值必须落盘且不得被旧密文复活（无 await 时此处为 PLAIN-AFTER|true 或重启出现 #unlockPwd） */
  await page.evaluate(() => { const J = (window as any).JU; const s = J.getState(); s.nodes[s.rootId].text = 'PLAIN-AFTER'; J.flushPersistNow(); });
  await expect.poll(async () => { const st: any = await r14Load(page); const n = st.nodes && st.nodes[st.rootId]; return String(n ? n.text : '') + '|' + String(!!st.encStore); }, { timeout: 60_000 }).toBe('PLAIN-AFTER|false');
  await page.reload(); await ready(page);
  await expect(page.locator('#unlockPwd')).toHaveCount(0);
  expect(String((await r14Load(page)).encStore || ''), '重启后 load_state 不得含 encStore').toBe('');
  expect(await page.evaluate(() => { const J = (window as any).JU; const s = J.getState(); return String(s.nodes[s.rootId].text || ''); })).toBe('PLAIN-AFTER');
  /* 关闭后磁盘快照必须同时满足：明文在、encStore 不在（同一次写盘的完整性） */
  expect(String(st1.nodes && st1.nodes[st1.rootId] ? st1.nodes[st1.rootId].text : '') + '|' + String(!!st1.encStore), '关闭后必须同时明文在且无 encStore').toBe('OLD-ENC|false');
});

test('review14 · F 关闭加密 clear 失败必须回滚加密态且保留 encStore', async ({ context, page }) => {
  test.setTimeout(180_000); await prepare(context); await skeleton(context);
  await context.addInitScript(r14Mock, true);
  await page.goto('/'); await ready(page);
  await page.evaluate((pw: string) => {
    const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui;
    u.encrypted = true; u.encKey = pw;
    const s = J.getState(); s.nodes[s.rootId].text = 'R14-NEG'; J.flushPersistNow();
  }, PW);
  await expect.poll(async () => String((await r14Load(page)).encStore || ''), { timeout: 60_000 }).not.toBe('');
  await page.evaluate(() => (document.getElementById('setEncrypt') as any).click());
  await page.locator('.modal-overlay .modal [data-ok]').last().click({ timeout: 30_000 });
  await expect.poll(() => r14Toast(page), { timeout: 60_000 }).toContain('关闭加密失败');
  const ui = await page.evaluate(() => { const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui; return { encrypted: !!u.encrypted, encKey: u.encKey }; });
  expect(ui.encrypted, 'clear 失败必须回滚 ui.encrypted=true').toBe(true);
  expect(ui.encKey, 'clear 失败必须恢复原 encKey').toBe(PW);
  expect(String((await r14Load(page)).encStore || '').length, 'clear 失败不得移除 encStore').toBeGreaterThan(0);
  const st: any = await r14Load(page);
  expect(Object.keys(st.nodes || {}).length, 'clear 失败不得留明文节点').toBe(0);
  expect(String(st.encStore || '').length, 'clear 失败不得清空 encStore').toBeGreaterThan(0);
  expect(JSON.stringify(await r14Load(page)), '原子写失败后磁盘不得留明文').not.toContain('R14-NEG');
  expect(await r14Toast(page)).not.toContain('已关闭加密');
});

/* 【review15-02 · ISSUE-002】原子写 800ms 响应窗口内强杀：明文已落盘且 encStore 已删，
   前端从未收到成功回调；重启必须 load_state 无 encStore 且标题为新值（不留「明文+旧密文」双态）。 */
test('review15 · G 原子写窗口内强杀：重启无 encStore 且标题为新值', async ({ context, page, browser }) => {
  test.setTimeout(180_000); await prepare(context); await skeleton(context);
  await context.addInitScript(r14Mock, { plainDelay: 800 });
  await page.goto('/'); await ready(page);
  await page.evaluate((pw: string) => {
    const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui;
    u.encrypted = true; u.encKey = pw;
    const s = J.getState(); s.nodes[s.rootId].text = 'OLD-ENC'; J.flushPersistNow();
  }, PW);
  await expect.poll(async () => String((await r14Load(page)).encStore || ''), { timeout: 60_000 }).not.toBe('');
  /* 走真实编辑提交（bump updatedAt），直接改 text 会被 LWW 合并回旧值 */
  await page.evaluate(() => { const J = (window as any).JU; J.actions.updateText(J.getState().rootId, 'G-PLAIN', { noNotify: true }); });
  await page.evaluate(() => (document.getElementById('setEncrypt') as any).click());
  await page.locator('.modal-overlay .modal [data-ok]').last().click({ timeout: 30_000 });
  /* 明文快照一出现在磁盘即强杀：不等 invoke 响应（响应被 mock 延迟 800ms） */
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('r14.store') || ''), { timeout: 30_000 }).toContain('G-PLAIN');
  const killed = await page.evaluate(() => ({ store: sessionStorage.getItem('r14.store') || '', toast: (document.querySelector('#toast') as any).textContent || '' }));
  await context.close();
  expect(killed.toast, '强杀必须发生在成功提示之前').not.toContain('已关闭加密');
  const c2 = await browser.newContext(); await prepare(c2); await skeleton(c2);
  await c2.addInitScript(r14Mock, { seed: killed.store });
  const p2 = await c2.newPage(); await p2.goto('/'); await ready(p2);
  const st: any = await r14Load(p2);
  expect(String(st.encStore || ''), '强杀后重启不得含 encStore').toBe('');
  expect(String(st.nodes && st.nodes[st.rootId] ? st.nodes[st.rootId].text : ''), '强杀后重启标题必须为新值').toBe('G-PLAIN');
  await expect(p2.locator('#unlockPwd')).toHaveCount(0);
});

/* 【review17 · ISSUE-001】写盘已成功的明文不得因复核失败回滚：load_state 首抛一次仍保持明文态。 */
test('review17 · H 复核失败保持明文态：load_state 首抛一次不回滚', async ({ context, page }) => {
  test.setTimeout(180_000); await prepare(context); await skeleton(context);
  await context.addInitScript(r14Mock, { rereadThrow: true });
  await page.goto('/'); await ready(page);
  await page.evaluate((pw: string) => {
    const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui;
    u.encrypted = true; u.encKey = pw;
    J.actions.updateText(J.getState().rootId, 'R17-PLAIN', { noNotify: true });
    J.flushPersistNow();
  }, PW);
  await expect.poll(async () => String((await r14Load(page)).encStore || ''), { timeout: 60_000 }).not.toBe('');
  await page.evaluate(() => (document.getElementById('setEncrypt') as any).click());
  await page.locator('.modal-overlay .modal [data-ok]').last().click({ timeout: 30_000 });
  await expect.poll(async () => { const t = await r14Toast(page); return /已关闭加密|关闭加密失败/.test(t) ? 'done' : t; }, { timeout: 60_000 }).toBe('done');
  const ui = await page.evaluate(() => { const J = (window as any).JU; const u = typeof J.ui === 'function' ? J.ui() : J.ui; return { encrypted: !!u.encrypted, encKey: u.encKey }; });
  expect(ui.encrypted, '复核失败不得回滚 ui.encrypted=true').toBe(false);
  expect(ui.encKey, '复核失败不得恢复 encKey').toBeFalsy();
  const st: any = await r14Load(page);
  expect(String(st.encStore || ''), '复核失败后盘上不得有 encStore').toBe('');
  expect(String(st.nodes && st.nodes[st.rootId] ? st.nodes[st.rootId].text : ''), '复核失败后盘上 nodes 必须为新值').toBe('R17-PLAIN');
});
