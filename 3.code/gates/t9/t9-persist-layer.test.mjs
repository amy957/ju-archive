/**
 * L9-W1 · 持久层四支柱验收（N 层 · Node 原生 test runner）
 * ----------------------------------------------------------------------------
 * 设计依据：`reports/t9-design-2026-10-14.md`（P1a 落盘 / Worker 化 / 加解密 / 索引层）
 * 授权：L9-W1 子任务 · LO-0=MINIMAL（只做持久层四支柱）· LO-1 保留 syncFallback ·
 *       LO-2 不接线导出/导入。
 *
 * 性质：**N 层纯 Node 单测**（无浏览器、无真实后端、无 WebCrypto 真机依赖之外的外部服务）。
 *       红证先行：模块未实现时本文件必须失败（ERR_MODULE_NOT_FOUND / 断言失败）。
 *       本波（W1）**不接线** `scripts/verify.js`（design §11.2：verify.js 接线属 W2）。
 *
 * 用例编号：自 **T-69** 起单调递增（design §9.3 编号纪律）。W1 为影子层harness，
 *           未进入 R 层门禁；M-A/M-D 哨兵 T-76 等「预留区」编号由 W2 裁决后另行启用。
 * 运行：`node --test l9/t9-persist-layer.test.mjs`（Node ≥ 22）
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPersistBatch, PersistStore, InMemoryBackend, equalProjection, percentile95,
  L9_MAX_PER_BATCH, L9_PATCH_MAX, L9_FAIL_CAP, L9_METRIC_CAP,
} from './persist-store.mjs';
import {
  encryptState, decryptState, encryptBatch, decryptBatch,
  containsPlaintext, KeyStore, ENC_ITER,
} from './crypto-store.mjs';
import { IndexLayer } from './index-layer.mjs';
import {
  REQ, RES, makeRequest, isRequest, makeAck, makeError,
  makeResult, isResponse, isDispose, makeDispose,
} from './worker-protocol.mjs';
import {
  syncFallback, createSyncFallback, createWorkerSkeleton, createInProcessWorker, PersistWorkerBridge,
} from './persist-worker.mjs';

/* ── 夹具 ── */
const node = (id, extra) => Object.assign({ id, text: '', children: [], _rev: 0 }, extra || {});
const stateOf = (nodes, rootId) => ({ rootId: rootId || 'root', nodes: nodes || {}, updatedAt: 1, _rev: 0 });
const patchMsg = (id, payload) => makeRequest(id, REQ.PATCH, payload);
const sortIds = (set) => Array.from(set).sort();

/* ============================================================
 * P1a 落盘（主模块：磁盘写路径 / 原子性 / flush / 错误处理）
 * ============================================================ */
describe('L9-W1 §P1a 落盘逻辑', () => {
  test('T-69 buildPersistBatch：删除优先（D-2）+ 单批上限 + 超限退全量（D-6）', () => {
    /* 删除优先：n1 既在 dirty 又在 removed → changed 剔除、deleted 保留 */
    const dirty = new Map([['n0', node('n0', { text: 'x0' })], ['n1', node('n1', { text: 'x1' })]]);
    const removed = new Set(['n1']);
    const r = buildPersistBatch(dirty, removed);
    assert.equal(r.reason, null);
    assert.equal(r.batches.length, 1);
    assert.deepEqual(r.batches[0].changed.map((c) => c.id), ['n0']);
    assert.deepEqual(r.batches[0].deleted, ['n1']);
    assert.equal(typeof r.batches[0].changed[0].data, 'string');
    assert.equal(JSON.parse(r.batches[0].changed[0].data).id, 'n0');

    /* 单批上限：L9_MAX_PER_BATCH*2+1 → 3 批；deleted 仅随首批 */
    const big = new Map();
    for (let i = 0; i < L9_MAX_PER_BATCH * 2 + 1; i++) big.set('b' + i, node('b' + i));
    const r2 = buildPersistBatch(big, new Set(['dead']));
    assert.equal(r2.reason, null);
    assert.equal(r2.batches.length, 3);
    assert.equal(r2.batches[0].changed.length, L9_MAX_PER_BATCH);
    assert.deepEqual(r2.batches[0].deleted, ['dead']);
    assert.deepEqual(r2.batches[1].deleted, []);
    assert.equal(r2.batches[1].changed.length, L9_MAX_PER_BATCH);
    assert.equal(r2.batches[2].changed.length, 1);

    /* 超限：dirty+removed > L9_PATCH_MAX → 不组批，退全量 */
    const over = new Map();
    for (let i = 0; i < L9_PATCH_MAX + 1; i++) over.set('o' + i, node('o' + i));
    const r3 = buildPersistBatch(over, new Set());
    assert.equal(r3.reason, 'over-threshold');
    assert.deepEqual(r3.batches, []);

    /* 空脏集 */
    assert.equal(buildPersistBatch(new Map(), new Set()).reason, 'empty');
  });

  test('T-70 崩溃原子性：事务中途崩溃 → 盘面无半批（BEGIN→apply→COMMIT 三段式）', async () => {
    const be = new InMemoryBackend();
    const st = new PersistStore({ backend: be });
    await st.applyBatch({ changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 });

    /* 注入「apply 阶段崩溃」：本批缓冲必须被丢弃，已提交行不受影响 */
    be.crashBeforeCommit((phase) => { if (phase === 'apply') throw new Error('boom@apply'); });
    const res = await st.applyBatch({
      changed: [{ id: 'b', data: '{"id":"b"}' }, { id: 'c', data: '{"id":"c"}' }],
      deleted: [], seq: 2, baseRev: 1,
    });
    assert.equal(res.ok, false);
    const proj = be.rows();
    assert.equal(proj.has('b'), false, '半批未落盘：b 不得出现');
    assert.equal(proj.has('c'), false, '半批未落盘：c 不得出现');
    assert.equal(proj.get('a'), '{"id":"a"}', '批前态逐字节保留');
    assert.equal(st.failures.length, 1, '失败进入 FIFO 缓冲');
    assert.equal(st.mode, 'full', '失败 → 置 full 安全网（宁慢不错）');
  });

  test('T-71 幂等投递（K-2）：同 seq 重放不重复应用', async () => {
    const be = new InMemoryBackend();
    const st = new PersistStore({ backend: be });
    const b = { changed: [{ id: 'a', data: '{"v":1}' }], deleted: [], seq: 1, baseRev: 0 };
    const r1 = await st.applyBatch(b);
    assert.equal(r1.ok, true);
    assert.equal(st.seq, 1);
    const r2 = await st.applyBatch(b); /* 同 seq 重放 */
    assert.equal(r2.ok, true);
    assert.equal(r2.replay, true);
    assert.equal(st.seq, 1, '重放不递增批序号');
    assert.equal(be.rows().get('a'), '{"v":1}');
  });

  test('T-72 flushNow 全量 checkpoint：原子替换 + 清孤儿行 + 收敛计数归零', async () => {
    const be = new InMemoryBackend();
    const st = new PersistStore({ backend: be });
    await st.applyBatch({ changed: [{ id: 'ghost', data: '{"id":"ghost"}' }], deleted: [], seq: 1, baseRev: 0 });
    st.sinceFull = 5;
    st.checkpointPending = true;
    const snap = stateOf({ a: node('a'), b: node('b') });
    const r = await st.flushNow(snap);
    assert.equal(r.ok, true);
    const proj = be.rows();
    assert.equal(proj.has('a'), true);
    assert.equal(proj.has('b'), true);
    assert.equal(proj.has('ghost'), false, '全量替换清除孤儿行');
    assert.equal(st.sinceFull, 0);
    assert.equal(st.checkpointPending, false);
    assert.equal(st.mode, 'patch', '成功 checkpoint 后恢复 patch 模式');
  });

  test('T-73 错误处理：FIFO 失败缓冲上限 + 安全网置 full', async () => {
    const be = new InMemoryBackend();
    const st = new PersistStore({ backend: be, failCap: L9_FAIL_CAP });
    be.failNext = L9_FAIL_CAP + 10;
    for (let i = 0; i < L9_FAIL_CAP + 5; i++) {
      await st.applyBatch({ changed: [{ id: 'x', data: '{}' }], deleted: [], seq: 100 + i, baseRev: 0 });
    }
    assert.equal(st.failures.length, L9_FAIL_CAP, '失败缓冲 FIFO 上限 = failCap');
    assert.equal(st.mode, 'full');
    /* 缓冲为 FIFO：保留的是最后 failCap 条 */
    assert.equal(st.failures[st.failures.length - 1].op, 'patch_nodes');
  });

  test('T-74 投影等价：equalProjection 逐 id JSON 比对', async () => {
    const be = new InMemoryBackend();
    const st = new PersistStore({ backend: be });
    await st.applyBatch({ changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 });
    const want = new Map([['a', '{"id":"a"}']]);
    assert.equal(equalProjection(be.rows(), want), true);
    assert.equal(equalProjection(be.rows(), new Map([['a', '{"id":"a","x":1}']])), false);
    assert.equal(equalProjection(be.rows(), new Map()), false);
  });
});

/* ============================================================
 * Worker 化骨架 + syncFallback 桥（LO-1）
 * ============================================================ */
describe('L9-W1 §Worker 骨架 / 协议 / syncFallback 桥', () => {
  test('T-75 消息协议形状（请求/响应/错误）', () => {
    const req = patchMsg(7, { changed: [], deleted: [], seq: 1, baseRev: 0 });
    assert.equal(isRequest(req), true);
    assert.equal(req.id, 7);
    assert.equal(req.type, REQ.PATCH);
    assert.equal(isRequest({}), false);
    assert.equal(isRequest({ id: 1 }), false);

    const ack = makeAck(7, { ok: true });
    assert.equal(ack.id, 7);
    assert.equal(ack.type, RES.ACK);
    assert.equal(ack.ok, true);

    const err = makeError(7, new Error('x'));
    assert.equal(err.type, RES.ERROR);
    assert.match(err.error, /x/);
  });

  test('T-76 syncFallback 保留且可用（LO-1：主线程 L6 同步路径不得删除）', async () => {
    const be = new InMemoryBackend();
    const st = new PersistStore({ backend: be });
    const fb = createSyncFallback(st);
    assert.equal(typeof fb, 'function');
    const r = await fb({ type: REQ.PATCH, payload: { changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 } });
    assert.equal(r.ok, true);
    assert.equal(be.rows().get('a'), '{"id":"a"}');
    /* 直接（非工厂）导出亦保留 */
    assert.equal(typeof syncFallback, 'function');

    /* 桥：mode='sync' 时经 syncFallback 直通 */
    const br = new PersistWorkerBridge({ store: st, mode: 'sync' });
    const r2 = await br.request(REQ.PATCH, { changed: [{ id: 'b', data: '{"id":"b"}' }], deleted: [], seq: 2, baseRev: 1 });
    assert.equal(r2.ok, true);
    assert.equal(be.rows().has('b'), true);
  });

  test('T-77 Worker 骨架：ready 握手 + worker 模式委派 + 超时降级 syncFallback', async () => {
    const be = new InMemoryBackend();
    const st = new PersistStore({ backend: be });
    const worker = createWorkerSkeleton(st);
    const br = new PersistWorkerBridge({ store: st, worker, mode: 'worker', timeoutMs: 200 });
    await br.ensure();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(br.ready, true, 'ready 握手应到达');

    const ack = await br.request(REQ.PATCH, { changed: [{ id: 'w', data: '{"id":"w"}' }], deleted: [], seq: 1, baseRev: 0 });
    assert.equal(ack.type, RES.ACK);
    assert.equal(be.rows().has('w'), true);

    /* 超时降级：死 worker（永不回包）→ 回落 syncFallback */
    const dead = { onmessage: null, postMessage() {}, terminate() {} };
    const br2 = new PersistWorkerBridge({ store: st, worker: dead, mode: 'worker', timeoutMs: 30 });
    const fb = await br2.request(REQ.PATCH, { changed: [{ id: 'z', data: '{"id":"z"}' }], deleted: [], seq: 2, baseRev: 1 });
    assert.equal(fb.ok, true, '超时后应回落 syncFallback 并成功');
    assert.equal(be.rows().has('z'), true);
  });
});

/* ============================================================
 * 加解密（derived/load key · encrypt-on-write / decrypt-on-read）
 * ============================================================ */
describe('L9-W1 §加解密', () => {
  test('T-78 全量 roundtrip：encryptState → decryptState 逐字段还原；错密码拒绝', async () => {
    const stt = stateOf({ a: node('a', { text: '秘密 secret 明文' }) });
    const payload = await encryptState(stt, 'pw-123');
    assert.equal(payload.v, 1);
    assert.equal(payload.iter, ENC_ITER);
    assert.equal(typeof payload.cipher, 'string');
    assert.equal(payload.cipher.includes('secret'), false, '密文不得含明文片段');
    assert.equal(payload.cipher.includes('秘密'), false);

    const back = await decryptState(payload, 'pw-123');
    assert.deepEqual(back, stt, '解密后逐字段等价');
    await assert.rejects(() => decryptState(payload, 'wrong-pw'), '错误密码必须拒绝');
  });

  test('T-79 加密写批（逐条加密 · 设计 §7.1 选项 1）：无明文泄漏 + 可解密还原', async () => {
    const batch = {
      changed: [{ id: 'a', data: JSON.stringify({ secret: 'topsecret', n: 1 }) }],
      deleted: ['d1'], seq: 5, baseRev: 4,
    };
    const eb = await encryptBatch(batch, 'pw-123');
    assert.equal(eb.enc, true);
    assert.equal(containsPlaintext(eb, 'topsecret'), false, 'sent 内无明文（结构性断言）');
    assert.equal(containsPlaintext(eb, 'secret'), false);
    assert.deepEqual(eb.deleted, ['d1']);
    assert.equal(eb.seq, 5);

    const db = await decryptBatch(eb, 'pw-123');
    assert.equal(db.changed[0].data, batch.changed[0].data, '解密还原逐字节等价');
    assert.deepEqual(db.deleted, ['d1']);
  });

  test('T-80 密钥加载：KeyStore unlock/lock 生命周期', async () => {
    const ks = new KeyStore();
    assert.equal(ks.locked, true);
    await ks.unlock('pw');
    assert.equal(ks.locked, false);
    assert.ok(ks.salt instanceof Uint8Array);
    ks.lock();
    assert.equal(ks.locked, true);
  });
});

/* ============================================================
 * 索引层（build + lookup + 增量 update 等价）
 * ============================================================ */
describe('L9-W1 §索引层', () => {
  test('T-81 build + 四索引查询（cal/tag/search/backlink；_deleted 排除）', () => {
    const stt = stateOf({
      a: node('a', { text: 'hello #work [[Doc]]', date: '2026-10-14' }),
      b: node('b', { text: 'world', tags: ['work'], _manualTags: ['work'] }),
      c: node('c', { text: 'gone', date: '2026-10-14', _deleted: true }),
    });
    const ix = new IndexLayer().build(stt);
    assert.deepEqual(sortIds(ix.byDate('2026-10-14')), ['a'], '软删节点不入日期索引');
    assert.deepEqual(sortIds(ix.byTag('work')), ['a', 'b']);
    assert.deepEqual(sortIds(ix.lookupTerm('hello')), ['a']);
    assert.deepEqual(sortIds(ix.backlinksOf('Doc')), ['a']);
  });

  test('T-82 增量 update 等价全量 rebuild（含日期迁移 / 软删 / 复活）', () => {
    const from = stateOf({
      a: node('a', { text: 'hello #work [[Doc]]', date: '2026-10-14' }),
      b: node('b', { text: 'world', tags: ['work'], _manualTags: ['work'] }),
      c: node('c', { text: 'revive-me', date: '2026-01-01', _deleted: true }),
    });
    const to = stateOf({
      a: node('a', { text: 'hello #home [[Doc]]', date: '2026-11-11' }), /* 日期迁移 + tag 变化 */
      b: node('b', { text: 'world', tags: ['work'], _manualTags: ['work'] }), /* 不变 */
      c: node('c', { text: 'revive-me', date: '2026-01-01' }), /* 复活（去 _deleted）*/
      d: node('d', { text: 'brand new', date: '2026-11-11' }), /* 新增 */
    });
    const ix = new IndexLayer().build(from);
    ix.update(['a', 'b', 'c', 'd'], from, to);
    const full = new IndexLayer().build(to);
    assert.deepEqual(ix.snapshot(), full.snapshot(), '增量索引 == 全量重建');
    assert.deepEqual(sortIds(ix.byDate('2026-01-01')), ['c'], '软删→复活回到日期索引');
    assert.deepEqual(sortIds(ix.lookupTerm('brand')), ['d']);
    assert.deepEqual(sortIds(ix.byTag('home')), ['a']);
    assert.deepEqual(sortIds(ix.byTag('work')), ['b'], 'a 迁出 work');
  });
});

/* ============================================================
 * L9-W3 §DISPOSE / RESULT 协议（协议形状 + bridge 生命周期 + worker 侧 teardown）
 * ============================================================ */
describe('L9-W3 §DISPOSE / RESULT 协议', () => {
  test('T-83 协议构造与形状校验：makeResult / isResponse / isDispose', () => {
    const r = makeResult(11, { ok: true, via: 'result' });
    assert.equal(r.id, 11);
    assert.equal(r.type, RES.RESULT);
    assert.equal(r.via, 'result');
    assert.equal(isResponse(r), true);
    assert.equal(isResponse(makeAck(11, { ok: true })), true);
    assert.equal(isResponse(makeError(11, new Error('x'))), true);
    assert.equal(isResponse({ type: RES.READY }), false, 'READY 为生命周期握手，非可关联响应');
    assert.equal(isResponse({ id: 1 }), false, '缺 type 不得判为响应');

    const d = makeDispose(3);
    assert.equal(d.id, 3);
    assert.equal(d.type, REQ.DISPOSE, 'DISPOSE 复用既有 REQ.DISPOSE（不得改名）');
    assert.equal(isDispose(d), true);
    assert.equal(isDispose(patchMsg(3, {})), false);
  });

  test('T-84 bridge.dispose 幂等：teardown + 在途清空 + post-dispose 拒绝', async () => {
    const be = new InMemoryBackend();
    const st = new PersistStore({ backend: be });
    const worker = createWorkerSkeleton(st);
    const br = new PersistWorkerBridge({ store: st, worker, mode: 'worker', timeoutMs: 200 });
    await br.ensure();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(br.ready, true, 'ready 握手应到达');

    const first = await br.dispose();
    assert.equal(first.disposed, true, 'DISPOSE 必须返回 disposed ack');
    assert.equal(br.disposed, true);
    assert.equal(br._pending.size, 0, '在途请求必须清空（无悬挂 timer）');
    assert.equal(br.ready, false);

    const second = await br.dispose();
    assert.equal(second.already, true, '第二次 DISPOSE 必须幂等（不重复 teardown）');
    assert.equal(br.disposed, true);

    await assert.rejects(() => br.request(REQ.PING, {}), /disposed/, 'post-dispose 请求必须拒绝');
  });

  test('T-85 RESULT 关联（合成响应）+ unknown-id 安全忽略（无未处理拒绝）', async () => {
    const be = new InMemoryBackend();
    const st = new PersistStore({ backend: be });
    /* 合成 worker：以 RESULT 型回包 → 验证 result 与 ack 走同一关联路径 */
    const fake = {
      onmessage: null,
      sent: [],
      postMessage(msg) {
        this.sent.push(msg);
        setTimeout(() => {
          if (typeof this.onmessage === 'function') {
            this.onmessage({ data: makeResult(msg.id, { ok: true, via: 'result' }) });
          }
        }, 0);
      },
      terminate() {},
    };
    const br = new PersistWorkerBridge({ store: st, worker: fake, mode: 'worker', timeoutMs: 500 });
    await br.ensure();
    const res = await br.request(REQ.PING, {});
    assert.equal(res.type, RES.RESULT, 'RESULT 必须按 msg.id 关联并 resolve 待决 promise');
    assert.equal(res.via, 'result');
    assert.equal(fake.sent[0].id, res.id, 'request → response 必须同 id');

    const before = br.unknownResponses;
    fake.onmessage({ data: { id: 999999, type: RES.ACK } });     /* 未知 id（ack） */
    fake.onmessage({ data: { id: 999998, type: RES.RESULT } });  /* 未知 id（result） */
    fake.onmessage({ data: { type: RES.ACK } });                 /* 无 id 形态 */
    assert.equal(br.unknownResponses, before + 3, '未知 id / 非关联响应必须安全忽略并计数');
    assert.equal(br._pending.size, 0, '未知 id 不得污染在途表');
  });

  test('T-86 进程内 worker DISPOSE：ack 后 teardown；terminate 后 postMessage 无回调', async () => {
    const be = new InMemoryBackend();
    const st = new PersistStore({ backend: be });
    const w = createInProcessWorker(st);
    let ready = 0; let disposedAck = 0; let lateCallbacks = 0;
    w.onmessage = (ev) => {
      const d = ev && ev.data;
      if (!d) return;
      if (d.type === RES.READY) ready++;
      else if (d.type === RES.ACK && d.disposed) disposedAck++;
      else lateCallbacks++;
    };
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(ready, 1, 'ready 握手恰好一次');

    w.postMessage(makeDispose(1));
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(disposedAck, 1, 'DISPOSE 必须 ack { disposed:true }');

    /* teardown 后投递：DISPOSE 再来 / 正常批 → 一律丢弃（不得再回调） */
    w.postMessage(makeDispose(2));
    w.postMessage(patchMsg(3, { changed: [], deleted: [], seq: 9, baseRev: 0 }));
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(disposedAck, 1, '第二次 DISPOSE 幂等：无额外回包');
    assert.equal(lateCallbacks, 0, 'teardown 后不得再回调（无 post-dispose teardown）');

    /* terminate 幂等 + 之后 postMessage 无回调 */
    w.terminate();
    w.terminate();
    const w2 = createInProcessWorker(st);
    let after = 0;
    w2.onmessage = () => { after++; };
    w2.terminate();
    w2.postMessage(makeRequest(1, REQ.PING, null));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(after, 0, 'terminate 后 postMessage 不得回调');
  });
});

/* ============================================================
 * L9-W4 §指标（`stats()` 的 p95 wall-clock · design §十三 L9-W4「指标」/ OP-2）
 * ============================================================ */
describe('L9-W4 §指标 p95 wall-clock', () => {
  test('T-90 stats() 暴露 p95 数值字段，既有契约字段逐项不变（无破坏）', async () => {
    const st = new PersistStore({ backend: new InMemoryBackend() });
    const s0 = st.stats();
    assert.equal(typeof s0.p95, 'number', 'p95 为数值字段（L9-W4 新增）');
    assert.equal(Number.isNaN(s0.p95), true, '无样本 → p95 = NaN（最近秩未定义）');
    assert.equal(s0.latencySamples, 0, '无样本 → 采样计数 0');

    /* 既有 stats() 契约（L9-W1 起）逐项保持 */
    assert.equal(s0.mode, 'patch');
    assert.equal(s0.seq, 0);
    assert.equal(s0.sinceFull, 0);
    assert.equal(s0.rev, 0);
    assert.equal(s0.pending, false);
    assert.equal(s0.failures, 0);

    /* 一次真实 persist 往返 → 采样 +1；p95 变为有限非负数 */
    const r = await st.applyBatch({ changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 });
    assert.equal(r.ok, true);
    const s1 = st.stats();
    assert.equal(s1.latencySamples, 1);
    assert.equal(Number.isFinite(s1.p95), true);
    assert.equal(s1.p95 >= 0, true);
    /* 既有字段语义不变 */
    assert.equal(s1.seq, 1);
    assert.equal(s1.rev, 1);
    assert.equal(s1.sinceFull, 1);
    assert.equal(s1.pending, false);
    assert.equal(s1.failures, 0);
    assert.equal(s1.mode, 'patch');
  });

  test('T-91 p95 百分位数学（nearest-rank 最近秩）：已知样本集 → 期望值 + 有界缓冲', () => {
    /* n=100 → ceil(0.95*100)=95 → 升序第 95 个（1-based）= 95 */
    const asc = []; for (let i = 1; i <= 100; i++) asc.push(i);
    assert.equal(percentile95(asc), 95);
    /* 乱序输入必须等价（内部升序） */
    assert.equal(percentile95(asc.slice().reverse()), 95);
    /* n=20 → ceil(19)=19 → 第 19 个 = 19 */
    assert.equal(percentile95(Array.from({ length: 20 }, (_, i) => i + 1)), 19);
    /* 单样本 → 其自身；空集 → NaN */
    assert.equal(percentile95([7]), 7);
    assert.equal(Number.isNaN(percentile95([])), true);
    /* 纯函数：不得改动入参 */
    const src = [3, 1, 2];
    percentile95(src);
    assert.deepEqual(src, [3, 1, 2]);

    /* 采样注入 + 有界 ring：cap=5 → 仅保留最后 5 个样本 */
    const st = new PersistStore({ backend: new InMemoryBackend(), latencyCap: 5 });
    for (const v of [10, 20, 30, 40, 50, 60, 70]) st.recordLatency(v);
    assert.equal(st.stats().latencySamples, 7, '累计采样计数含被淘汰者');
    assert.equal(st.p95(), 70, 'ring 保留 [30,40,50,60,70] → ceil(4.75)=5 → 第 5 个 = 70');
    assert.equal(L9_METRIC_CAP > 0, true, '默认缓冲上限为正整数常量');
  });

  test('T-92 wall-clock 采样为真实耗时（成功 + 失败路径均采样；度量不破坏失败缓冲契约）', async () => {
    const be = new InMemoryBackend();
    const st = new PersistStore({ backend: be });
    await st.applyBatch({ changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 });
    const r2 = await st.flushNow(stateOf({ a: node('a') }));
    assert.equal(r2.ok, true);
    be.failNext = 1; /* 后端不可用 → 失败路径亦须被采样 */
    const r3 = await st.applyBatch({ changed: [{ id: 'b', data: '{"id":"b"}' }], deleted: [], seq: 2, baseRev: 1 });
    assert.equal(r3.ok, false);
    const s = st.stats();
    assert.equal(s.latencySamples, 3, '成功 2（transact + saveState）+ 失败 1 = 3');
    assert.equal(Number.isFinite(s.p95), true);
    assert.equal(s.p95 >= 0, true);
    assert.equal(s.p95 <= 60000, true, '毫秒量级 sanity 上界');
    /* 既有失败契约不变 */
    assert.equal(s.failures, 1);
    assert.equal(s.mode, 'full');
  });
});
