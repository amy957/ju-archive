// @ts-nocheck
/**
 * L9-W3 · P 层（Playwright / 真实浏览器）验收 — 持久层四支柱 + Worker 协议生命周期
 * ----------------------------------------------------------------------------
 * 覆盖 W1/W2 已实现、W3 补齐的 L9 契约（真实 Chromium 内核执行，非 Node 单测复跑）：
 *   - 影子层注入：产品全局零影响（L9 命名空间封装于 IIFE，不进产品词法域）
 *   - P1a 落盘：applyBatch round-trip / 同 seq 重放幂等 / 超限退全量
 *   - 加解密：浏览器 **真实 WebCrypto** 全量 roundtrip + 逐条批无明文 + 错密码拒绝
 *   - 索引层：build + 四索引查询 + 增量 update == 全量 rebuild
 *   - 可插拔 mock 适配器：IDB-style vs invoke-style parity（同序列同结果 / 同错误形状）
 *   - Worker 生命周期（W2 真实 `file://` classic Blob Worker + W3 DISPOSE/RESULT）：
 *     ready 握手 → PATCH ack → PING → DISPOSE ack → DISPOSE 幂等 → post-dispose 拒绝 → RESULT 关联
 *
 * 载入方式：L9 为**影子层**（LO-2 未接线产品 HTML），故以 `addInitScript` 注入
 *   「classic 打包」后的 L9 模块（ESM → IIFE，CDP 注入不受页面 CSP 限制），
 *   暴露为 `window.__L9`；**不改产品字节、不改 ESM 源文件**。
 *
 * 运行：
 *   JU_CHROMIUM_PATH=<chrome> node node_modules/@playwright/test/cli.js test tests/t9-persist-layer.spec.ts
 * （本仓部署无 Playwright 自带浏览器缓存，须经 `JU_CHROMIUM_PATH` 指向系统 Chrome，见 playwright.config.ts）
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_URL =
  process.env.JU_APP_URL ||
  'file://' + path.resolve(__dirname, '..', '..', 'canonical', 'v2.0-t3.html');

/* ── ESM → classic：剥离 import/export，按依赖序拼接（不改源文件） ── */
function classicBundle(src: string): string {
  return src
    .replace(/^\s*import\s+[^;\n]*;?\s*$/gm, '')                 /* 去 import */
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')            /* 去 export {...} */
    .replace(/^\s*export\s+default\s+/gm, '')                    /* 去 export default */
    .replace(/^\s*export\s+(async\s+function|function|const|let|var|class)\s+/gm, '$1 ');
}
/* L22-Rename 收尾（2026-10-18）：运行态支柱目录由 `l9/` 更名为 `t9/`，
   本 spec 的模块基址同步修正（原值会导致 PW 用例启动前 ENOENT）。 */
const L9_DIR = path.resolve(__dirname, '..', 't9');
const L9_MODULES = [
  'worker-protocol.mjs', 'persist-store.mjs', 'crypto-store.mjs',
  'index-layer.mjs', 'persist-worker.mjs', 'backend-adapters.mjs',
];
const BUNDLE = L9_MODULES
  .map((m) => classicBundle(fs.readFileSync(path.join(L9_DIR, m), 'utf8')))
  .join('\n');

/* ── 注入脚本：Buffer shim（crypto-store 以 Buffer 做 base64；浏览器用 btoa/atob 等价） ── */
const BOOTSTRAP = `
(function () {
  'use strict';
  var Buffer = globalThis.Buffer || (function () {
    /* ArrayBuffer 与 Uint8Array 都要能编码（WebCrypto encrypt 返回 ArrayBuffer） */
    var toU8 = function (x) { return (x instanceof Uint8Array) ? x : new Uint8Array(x); };
    var e = function (x) { var u8 = toU8(x); var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
    var d = function (str) { var bin = atob(str); var u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };
    return {
      from: function (a, enc) {
        if (typeof a === 'string') return (enc === 'base64') ? d(a) : new TextEncoder().encode(a);
        return { toString: function (x) { return x === 'base64' ? e(a) : String(a); } };
      }
    };
  })();
  var _nodeWebCrypto = globalThis.crypto;
${BUNDLE}
  window.__L9 = {
    REQ: REQ, RES: RES, RESPONSE_TYPES: RESPONSE_TYPES,
    makeRequest: makeRequest, isRequest: isRequest, makeAck: makeAck, makeError: makeError,
    makeResult: makeResult, isResponse: isResponse, makeDispose: makeDispose, isDispose: isDispose,
    L9_MAX_PER_BATCH: L9_MAX_PER_BATCH, L9_PATCH_MAX: L9_PATCH_MAX, isBatch: isBatch,
    buildPersistBatch: buildPersistBatch, equalProjection: equalProjection,
    InMemoryBackend: InMemoryBackend, PersistStore: PersistStore,
    ENC_ITER: ENC_ITER, encryptState: encryptState, decryptState: decryptState,
    encryptBatch: encryptBatch, decryptBatch: decryptBatch, containsPlaintext: containsPlaintext,
    KeyStore: KeyStore,
    IndexLayer: IndexLayer, nodeAllTags: nodeAllTags, tokenize: tokenize,
    createSyncFallback: createSyncFallback, createInProcessWorker: createInProcessWorker,
    isBrowserWorkerAvailable: isBrowserWorkerAvailable, createRealWorker: createRealWorker,
    createWorkerSkeleton: createWorkerSkeleton, PersistWorkerBridge: PersistWorkerBridge,
    ADAPTER_KINDS: ADAPTER_KINDS, IdbStyleAdapter: IdbStyleAdapter,
    InvokeStyleAdapter: InvokeStyleAdapter, createAdapter: createAdapter
  };
})();
`;

async function bootL9(page: import('@playwright/test').Page) {
  await page.addInitScript({ content: BOOTSTRAP });
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window as any).__L9, null, { timeout: 10000 });
  await page.waitForFunction(
    () => typeof (window as any).__juProduce === 'function' && typeof (window as any).commit === 'function',
    null,
    { timeout: 10000 },
  );
}

test.describe('L9-W3 · 持久层 / 加解密 / 索引 / Worker 协议（P 层 · 真实浏览器）', () => {
  test.beforeEach(async ({ page }) => {
    await bootL9(page);
  });

  test('L9-1 影子层注入：产品全局零影响 + P1a 落盘 round-trip（含同 seq 重放幂等 / 超限退全量）', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const L9 = (window as any).__L9;
      const st0 = (window as any).state;
      const before = st0 ? JSON.stringify(Object.keys(st0.nodes).sort()) : 'no-state';

      const be = new L9.InMemoryBackend();
      const st = new L9.PersistStore({ backend: be });
      const batch = { changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 };
      const r1 = await st.applyBatch(batch);
      const r2 = await st.applyBatch(batch);            /* 同 seq 重放 */
      const big = new Map();
      for (let i = 0; i < L9.L9_PATCH_MAX + 1; i++) big.set('o' + i, { id: 'o' + i });
      const over = L9.buildPersistBatch(big, new Set());

      const st1 = (window as any).state;
      const after = st1 ? JSON.stringify(Object.keys(st1.nodes).sort()) : 'no-state';
      return {
        nsKeys: Object.keys(L9).length,
        produceFn: typeof (window as any).__juProduce === 'function',
        commitFn: typeof (window as any).commit === 'function',
        zeroImpact: before === after,
        r1ok: r1.ok === true,
        r2replay: r2.replay === true,
        seq: st.seq,
        rowA: be.rows().get('a'),
        snapA: st.snapshot().a && st.snapshot().a.id,
        over: over.reason,
        overBatches: over.batches.length,
      };
    });
    expect(r.nsKeys).toBeGreaterThan(20);
    expect(r.produceFn).toBe(true);
    expect(r.commitFn).toBe(true);
    expect(r.zeroImpact).toBe(true);          /* L9 操作不得改动产品 state */
    expect(r.r1ok).toBe(true);
    expect(r.r2replay).toBe(true);
    expect(r.seq).toBe(1);
    expect(r.rowA).toBe('{"id":"a"}');
    expect(r.snapA).toBe('a');
    expect(r.over).toBe('over-threshold');
    expect(r.overBatches).toBe(0);
  });

  test('L9-2 加解密（浏览器真实 WebCrypto）：全量 roundtrip + 逐条批无明文 + 错密码拒绝', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const L9 = (window as any).__L9;
      const realSubtle = !!(window.crypto && window.crypto.subtle);
      const stateObj = { rootId: 'root', nodes: { a: { id: 'a', text: '秘密 secret 明文' } }, updatedAt: 1 };

      const payload = await L9.encryptState(stateObj, 'pw-123');
      const back = await L9.decryptState(payload, 'pw-123');
      let wrongRejected = false;
      try { await L9.decryptState(payload, 'wrong-pw'); } catch (e) { wrongRejected = true; }

      const batch = {
        changed: [{ id: 'a', data: JSON.stringify({ secret: 'topsecret', n: 1 }) }],
        deleted: ['d1'], seq: 5, baseRev: 4,
      };
      const eb = await L9.encryptBatch(batch, 'pw-123');
      const leak = L9.containsPlaintext(eb, 'topsecret') || L9.containsPlaintext(eb, 'secret');
      const db = await L9.decryptBatch(eb, 'pw-123');

      const ks = new L9.KeyStore();
      const locked0 = ks.locked;
      await ks.unlock('pw');
      const locked1 = ks.locked;
      ks.lock();

      return {
        realSubtle,
        v: payload.v, iter: payload.iter, iterConst: L9.ENC_ITER,
        cipherLeak: String(payload.cipher).includes('secret') || String(payload.cipher).includes('秘密'),
        roundTrip: JSON.stringify(back) === JSON.stringify(stateObj),
        wrongRejected,
        ebEnc: eb.enc === true, leak,
        restored: db.changed[0].data === batch.changed[0].data,
        keepDeleted: JSON.stringify(db.deleted) === JSON.stringify(['d1']),
        locked0, locked1, locked2: ks.locked,
      };
    });
    expect(r.realSubtle).toBe(true);
    expect(r.v).toBe(1);
    expect(r.iter).toBe(r.iterConst);
    expect(r.cipherLeak).toBe(false);          /* 密文纯净 */
    expect(r.roundTrip).toBe(true);
    expect(r.wrongRejected).toBe(true);
    expect(r.ebEnc).toBe(true);
    expect(r.leak).toBe(false);                /* encrypt-on-write 批内无明文 */
    expect(r.restored).toBe(true);
    expect(r.keepDeleted).toBe(true);
    expect(r.locked0).toBe(true);
    expect(r.locked1).toBe(false);
    expect(r.locked2).toBe(true);
  });

  test('L9-3 索引层：build + 四索引查询 + 增量 update 与全量 rebuild 逐键等价', async ({ page }) => {
    const r = await page.evaluate(() => {
      const L9 = (window as any).__L9;
      const node = (id, extra) => Object.assign({ id, text: '', children: [], _rev: 0 }, extra || {});
      const stateOf = (nodes) => ({ rootId: 'root', nodes });
      const from = stateOf({
        a: node('a', { text: 'hello #work [[Doc]]', date: '2026-10-14' }),
        b: node('b', { text: 'world', tags: ['work'], _manualTags: ['work'] }),
        c: node('c', { text: 'revive-me', date: '2026-01-01', _deleted: true }),
      });
      const to = stateOf({
        a: node('a', { text: 'hello #home [[Doc]]', date: '2026-11-11' }), /* 日期迁移 + tag 变化 */
        b: node('b', { text: 'world', tags: ['work'], _manualTags: ['work'] }),
        c: node('c', { text: 'revive-me', date: '2026-01-01' }),           /* 复活 */
        d: node('d', { text: 'brand new', date: '2026-11-11' }),           /* 新增 */
      });
      const ix = new L9.IndexLayer().build(from);
      const dateFrom = Array.from(ix.byDate('2026-10-14')).sort();
      const workFrom = Array.from(ix.byTag('work')).sort();
      const deletedExcluded = ix.byDate('2026-01-01').size === 0;
      ix.update(['a', 'b', 'c', 'd'], from, to);
      const full = new L9.IndexLayer().build(to);
      return {
        dateFrom, workFrom, deletedExcluded,
        eqFull: JSON.stringify(ix.snapshot()) === JSON.stringify(full.snapshot()),
        dateNew: Array.from(ix.byDate('2026-11-11')).sort(),
        tagHome: Array.from(ix.byTag('home')),
        tagWork: Array.from(ix.byTag('work')),
        revived: Array.from(ix.byDate('2026-01-01')),
        termBrand: Array.from(ix.lookupTerm('brand')),
        backDoc: Array.from(ix.backlinksOf('Doc')),
      };
    });
    expect(r.dateFrom).toEqual(['a']);
    expect(r.workFrom).toEqual(['a', 'b']);
    expect(r.deletedExcluded).toBe(true);      /* 软删节点不入索引 */
    expect(r.eqFull).toBe(true);               /* 增量 == 全量 */
    expect(r.dateNew).toEqual(['a', 'd']);
    expect(r.tagHome).toEqual(['a']);
    expect(r.tagWork).toEqual(['b']);          /* a 迁出 work */
    expect(r.revived).toEqual(['c']);          /* 复活回到日期索引 */
    expect(r.termBrand).toEqual(['d']);
    expect(r.backDoc).toEqual(['a']);
  });

  test('L9-4 可插拔 mock 适配器 parity（IDB-style vs invoke-style）：同序列同结果 + 同错误形状', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const L9 = (window as any).__L9;
      const runSeq = async (ad) => {
        const out = [];
        out.push(await ad.write([{ id: 'a', data: '{"id":"a"}' }, { id: 'b', data: '{"id":"b"}' }]));
        out.push(await ad.read(['a', 'b', 'zz']));
        out.push(await ad.query({ prefix: 'a' }));
        out.push(await ad.del(['a']));
        out.push(await ad.read(['a', 'b']));
        return out;
      };
      const a = await runSeq(new L9.IdbStyleAdapter());
      const b = await runSeq(new L9.InvokeStyleAdapter());
      const errOf = async (fn) => { try { await fn(); return null; } catch (e) { return { name: e.name, message: e.message }; } };
      const ea = await errOf(() => new L9.IdbStyleAdapter().transact(null));
      const eb = await errOf(() => new L9.InvokeStyleAdapter().transact(null));
      /* PersistStore 直连两适配器（可插拔接缝） */
      const viaStore = async (ad) => {
        const st = new L9.PersistStore({ backend: ad });
        const r1 = await st.applyBatch({ changed: [{ id: 'x', data: '{"v":1}' }], deleted: [], seq: 1, baseRev: 0 });
        const r2 = await st.applyBatch({ changed: [{ id: 'x', data: '{"v":1}' }], deleted: [], seq: 1, baseRev: 0 });
        const r3 = await st.flushNow({ rootId: 'root', nodes: { z: { id: 'z' } } });
        return { r1: r1.ok, r2: r2.replay === true, r3: r3.ok, snap: st.snapshot() };
      };
      const sa = await viaStore(new L9.createAdapter('idb'));
      const sb = await viaStore(new L9.createAdapter('invoke'));
      return {
        kinds: L9.ADAPTER_KINDS,
        same: JSON.stringify(a) === JSON.stringify(b),
        a1: a[1], a3: a[3], a4: a[4],
        errSame: JSON.stringify(ea) === JSON.stringify(eb),
        err: ea,
        storeSame: JSON.stringify(sa) === JSON.stringify(sb),
        sa,
      };
    });
    expect(r.kinds).toEqual(['idb', 'invoke']);
    expect(r.same).toBe(true);                 /* 同序列 → 同结果 */
    expect(r.a1).toEqual({ ok: true, rows: { a: '{"id":"a"}', b: '{"id":"b"}' }, missing: ['zz'] });
    expect(r.a3).toEqual({ ok: true, deleted: 1 });
    expect(r.a4).toEqual({ ok: true, rows: { b: '{"id":"b"}' }, missing: ['a'] });
    expect(r.errSame).toBe(true);
    expect(r.err).toEqual({ name: 'Error', message: 'invalid batch shape' });
    expect(r.storeSame).toBe(true);
    expect(r.sa.r2).toBe(true);
    expect(r.sa.snap).toEqual({ z: { id: 'z' } });
  });

  test('L9-5 Worker 生命周期（真实 file:// classic Blob Worker）：ready → PATCH ack → DISPOSE 幂等 → post-dispose 拒绝', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const L9 = (window as any).__L9;
      const available = L9.isBrowserWorkerAvailable();
      const real = available ? L9.createRealWorker() : null;
      const realKind = real && real.constructor ? real.constructor.name : null;
      if (real && typeof real.terminate === 'function') real.terminate();

      const st = new L9.PersistStore({ backend: new L9.InMemoryBackend() });
      const worker = L9.createWorkerSkeleton(st);
      const br = new L9.PersistWorkerBridge({ store: st, worker, mode: 'worker', timeoutMs: 2000 });
      await br.ensure();
      await new Promise((res) => setTimeout(res, 80));      /* 等 ready 握手 */

      const ready = br.ready;
      const ack = await br.request(L9.REQ.PATCH, {
        changed: [{ id: 'w', data: '{"id":"w"}' }], deleted: [], seq: 1, baseRev: 0,
      });
      const ping = await br.request(L9.REQ.PING, {});
      const d1 = await br.dispose();
      const d2 = await br.dispose();                        /* 幂等 */
      let postRejected = false;
      try { await br.request(L9.REQ.PING, {}); } catch (e) { postRejected = /disposed/.test(String(e.message)); }
      return {
        available, realKind, ready,
        ackType: ack && ack.type, ackOk: ack && ack.ok === true, ackChanged: ack && ack.changed,
        pong: ping && ping.pong === true,
        d1Disposed: d1 && d1.disposed === true,
        d2Already: d2 && d2.already === true,
        disposed: br.disposed, pending: br._pending.size, postRejected,
      };
    });
    expect(r.available).toBe(true);            /* file:// 主线程具备 Worker/Blob/URL */
    expect(r.realKind).toBe('Worker');         /* W2 真实 classic Blob Worker 可构造 */
    expect(r.ready).toBe(true);                /* ready 握手到达 */
    expect(r.ackType).toBe('ack');
    expect(r.ackOk).toBe(true);
    expect(r.ackChanged).toBe(1);
    expect(r.pong).toBe(true);
    expect(r.d1Disposed).toBe(true);
    expect(r.d2Already).toBe(true);            /* 幂等 */
    expect(r.disposed).toBe(true);
    expect(r.pending).toBe(0);                 /* 无悬挂在途 */
    expect(r.postRejected).toBe(true);         /* post-dispose 拒绝 */
  });

  test('L9-6 RESULT 关联 + 协议形状 + unknown-id 安全忽略（无未处理拒绝 / 无悬挂 timer）', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const L9 = (window as any).__L9;
      const st = new L9.PersistStore({ backend: new L9.InMemoryBackend() });
      /* 合成 worker：以 RESULT 型回包（验证 result 与 ack 同关联路径） */
      const fake = {
        onmessage: null,
        sent: [],
        postMessage(msg) {
          this.sent.push(msg);
          setTimeout(() => {
            if (typeof this.onmessage === 'function') {
              this.onmessage({ data: L9.makeResult(msg.id, { ok: true, via: 'result' }) });
            }
          }, 0);
        },
        terminate() {},
      };
      const br = new L9.PersistWorkerBridge({ store: st, worker: fake, mode: 'worker', timeoutMs: 500 });
      await br.ensure();
      const res = await br.request(L9.REQ.PING, {});
      const before = br.unknownResponses;
      fake.onmessage({ data: { id: 999999, type: L9.RES.ACK } });      /* 未知 id */
      fake.onmessage({ data: { type: L9.RES.ACK } });                  /* 无 id */

      const shapes = [
        L9.isResponse(L9.makeResult(1, {})),
        L9.isResponse(L9.makeAck(1, {})),
        L9.isResponse(L9.makeError(1, new Error('x'))),
        L9.isResponse({ type: L9.RES.READY }),
        L9.isResponse({ id: 1 }),
        L9.isDispose(L9.makeDispose(2)),
        L9.isDispose(L9.makeRequest(2, L9.REQ.PING, null)),
      ];
      return {
        resType: res && res.type, via: res && res.via, sameId: fake.sent[0].id === res.id,
        unknownDelta: br.unknownResponses - before, pending: br._pending.size, shapes,
        disposeType: L9.makeDispose(2).type, disposeAgainstReq: L9.REQ.DISPOSE,
      };
    });
    expect(r.resType).toBe('result');          /* RESULT 按 msg.id 关联并 resolve */
    expect(r.via).toBe('result');
    expect(r.sameId).toBe(true);
    expect(r.unknownDelta).toBe(2);            /* 未知 id / 无 id 安全忽略并计数 */
    expect(r.pending).toBe(0);
    expect(r.shapes).toEqual([true, true, true, false, false, true, false]);
    expect(r.disposeType).toBe(r.disposeAgainstReq);
    expect(r.disposeAgainstReq).toBe('dispose');
  });
});
