/**
 * L9-W3 · mock 后端可插拔适配器 parity（IDB-style vs invoke-style）
 * ----------------------------------------------------------------------------
 * 设计依据：`reports/t9-design-2026-10-14.md` §五 5.2（通道层「直连 IDB 适配器」）
 *          + §3.4 C-1（本仓无 Rust/Tauri → 后端语义以 mock 等价验收）
 *          + §3.4 C-2（`invoke` 形态以 mock 等价，不依赖 `window.__TAURI__`）
 *
 * 契约（S-1 同源）：两适配器暴露**同一行为契约**——read/write/delete/query 与
 *   transact/saveState 语义逐项一致，**错误形状逐字一致**（同 name / 同 message）。
 *   差异只在「传输层形态」：IDB-style = 异步请求（微任务事务）；
 *   invoke-style = 命令信封（参数经 JSON 线上往返）。
 *
 * 用例编号：T-87 ~ T-89（接续 T-86，单调递增；design §9.3 编号纪律）。
 * 运行：`node --test l9/t9-backend-parity.test.mjs`（Node ≥ 22）
 * 红证先行：`backend-adapters.mjs` 未实现时本文件必须失败（ERR_MODULE_NOT_FOUND）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PersistStore } from './persist-store.mjs';
import {
  IdbStyleAdapter, InvokeStyleAdapter, createAdapter, ADAPTER_KINDS,
} from './backend-adapters.mjs';

/* ── 工具 ── */
const norm = (v) => JSON.stringify(v);
const errShape = async (fn) => {
  try { await fn(); return null; } catch (e) { return { name: e.name, message: e.message }; }
};
const freshPair = () => [new IdbStyleAdapter(), new InvokeStyleAdapter()];

/** 同一操作序列（读/写/删/查）→ 归一化结果数组 */
async function runCrudSequence(ad) {
  const out = [];
  out.push(await ad.write([{ id: 'a', data: '{"id":"a"}' }, { id: 'b', data: '{"id":"b"}' }]));
  out.push(await ad.read(['a', 'b', 'zz']));
  out.push(await ad.query({ prefix: 'a' }));
  out.push(await ad.del(['a']));
  out.push(await ad.read(['a', 'b']));
  out.push(await ad.query({}));
  return out;
}

/** 同一 PersistStore 驱动序列 → 归一化结果 */
async function driveStore(ad) {
  const st = new PersistStore({ backend: ad });
  const r1 = await st.applyBatch({ changed: [{ id: 'x', data: '{"v":1}' }], deleted: [], seq: 1, baseRev: 0 });
  const r2 = await st.applyBatch({ changed: [{ id: 'x', data: '{"v":1}' }], deleted: [], seq: 1, baseRev: 0 });
  const r3 = await st.applyBatch({ changed: [{ id: 'y', data: '{"v":2}' }], deleted: ['x'], seq: 2, baseRev: 1 });
  const r4 = await st.flushNow({ rootId: 'root', nodes: { z: { id: 'z' } } });
  /* L9-W4：stats() 新增 wall-clock 指标 p95（跨 run 不可字面比对）→ parity 合同比对剔除该易变字段；
   * 采样计数 latencySamples 为确定性值（r1 transact + r3 transact + r4 saveState = 3），保留参与比对。 */
  const stats = st.stats();
  assert.equal(typeof stats.p95, 'number', 'stats() 必须暴露 p95 数值字段（L9-W4）');
  assert.equal(stats.latencySamples, 3, '确定性采样计数：3 次持久化往返');
  delete stats.p95;
  return { r1, r2, r3, r4, snap: st.snapshot(), stats };
}

describe('L9-W3 §mock 后端适配器 parity', () => {
  test('T-87 适配器清单 + 读写删除查询 parity（同序列 → 同结果）', async () => {
    assert.deepEqual(ADAPTER_KINDS, ['idb', 'invoke']);
    assert.equal(createAdapter('idb').kind, 'idb');
    assert.equal(createAdapter('invoke').kind, 'invoke');
    assert.throws(() => createAdapter('nope'), /unknown adapter kind/);

    const [idb, inv] = freshPair();
    const a = await runCrudSequence(idb);
    const b = await runCrudSequence(inv);

    /* ① 两适配器逐项等价（传输层不同，语义必须一致） */
    assert.equal(norm(a), norm(b), 'IDB-style 与 invoke-style 同序列结果必须逐字一致');
    /* ② 具体语义断言（防「两者同错」） */
    assert.deepEqual(a[0], { ok: true, written: 2 });
    assert.deepEqual(a[1], { ok: true, rows: { a: '{"id":"a"}', b: '{"id":"b"}' }, missing: ['zz'] });
    assert.deepEqual(a[2], { ok: true, ids: ['a'], rows: { a: '{"id":"a"}' } });
    assert.deepEqual(a[3], { ok: true, deleted: 1 });
    assert.deepEqual(a[4], { ok: true, rows: { b: '{"id":"b"}' }, missing: ['a'] });
    assert.deepEqual(a[5], { ok: true, ids: ['b'], rows: { b: '{"id":"b"}' } });
    /* ③ 投影读取（PersistStore.projection 依赖的同步面）亦一致 */
    assert.equal(norm(Array.from(idb.rows())), norm(Array.from(inv.rows())));
  });

  test('T-88 事务 / 全量 checkpoint parity：两适配器驱动 PersistStore 行为一致', async () => {
    const [idb, inv] = freshPair();
    const A = await driveStore(idb);
    const B = await driveStore(inv);
    assert.equal(norm(A), norm(B), '同序列驱动 PersistStore 必须逐字一致');

    /* 具体语义断言 */
    assert.equal(A.r1.ok, true);
    assert.equal(A.r2.replay, true, 'K-2 同 seq 重放幂等');
    assert.equal(A.r3.ok, true);
    assert.deepEqual(A.snap, { z: { id: 'z' } }, 'flushNow 原子替换 + 清孤儿行');
    assert.equal(A.r4.ok, true);

    /* 原子性 parity：注入失败 → 两适配器同样无半批、同样置 full 安全网 */
    const [idb2, inv2] = freshPair();
    const atomic = async (ad) => {
      const st = new PersistStore({ backend: ad });
      await st.applyBatch({ changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 });
      ad.setFailNext(1);
      const res = await st.applyBatch({
        changed: [{ id: 'b', data: '{"id":"b"}' }, { id: 'c', data: '{"id":"c"}' }], deleted: [], seq: 2, baseRev: 1,
      });
      return { res, proj: Array.from(ad.rows()), mode: st.mode, failures: st.failures.length };
    };
    const X = await atomic(idb2);
    const Y = await atomic(inv2);
    assert.equal(norm(X), norm(Y), '崩溃原子性 parity：无半批 + 安全网一致');
    assert.equal(X.res.ok, false);
    assert.equal(X.proj.some((e) => e[0] === 'b'), false, '半批未落盘');
    assert.equal(X.mode, 'full');
  });

  test('T-89 错误传播 parity：非法批 / 后端失败 / 已关闭 → 同 name + 同 message', async () => {
    const [idb, inv] = freshPair();
    const cases = [
      /* 非法批形状（与 persist-store `isBatch` 同源校验） */
      [(ad) => ad.transact(null), { name: 'Error', message: 'invalid batch shape' }],
      [(ad) => ad.transact({ changed: [], deleted: [] }), { name: 'Error', message: 'invalid batch shape' }],
      /* 后端不可用（failNext 注入，等价 InMemoryBackend 语义） */
      [(ad) => { ad.setFailNext(1); return ad.write([{ id: 'q', data: '{}' }]); }, { name: 'Error', message: 'backend unavailable' }],
      /* 非法条目 */
      [(ad) => ad.write([{ id: 'q' }]), { name: 'Error', message: 'invalid entry' }],
    ];
    for (const [fn, want] of cases) {
      const x = await errShape(() => fn(idb));
      const y = await errShape(() => fn(inv));
      assert.equal(norm(x), norm(y), '错误形状必须逐字一致');
      assert.deepEqual(x, want);
    }

    /* 已关闭：两适配器同形拒绝 */
    const [idbC, invC] = freshPair();
    idbC.close(); invC.close();
    const cx = await errShape(() => idbC.read(['x']));
    const cy = await errShape(() => invC.read(['x']));
    assert.equal(norm(cx), norm(cy));
    assert.deepEqual(cx, { name: 'Error', message: 'adapter closed' });
  });
});
