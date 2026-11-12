/**
 * L10-W3 · D-1「持久层落地收口」N 层用例（主模块 + mock 后端 + 失败/降级 + 旧库迁移）
 * ============================================================================
 * 设计依据：`reports/t10-design-2026-10-15.md` §十三 W3 行；退出判据：主模块 N+P 层用例绿 +
 *          降级路径可测（`setFailNext` / `closed` → 同 `{name,message}`）。
 * 冻结契约：`tests/t10-idb-persist.spec.ts`（W2）①②③（接缝面 / 开关 / 降级原因字面量）。
 *
 * 用例编号：T-94(N) / T-95(N) / T-96(N) ×2 / T-97(N)（D-1 冻结区间 T-93~T-99 的 **N 侧**；
 *          沿用既有编号，**不新增编号**，符合 design §9.3 编号纪律）。
 * 运行：`node --test l9/t10-idb-persist.test.mjs`（Node >= 22）
 * 红证先行：`t10-idb-persist.mjs` 未实现时本文件必须失败（ERR_MODULE_NOT_FOUND）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSeam, createMemorySeam, migrateLegacy, buildPersistBatch,
  InMemoryBackend, L10_SEAM_VERSION,
} from './t10-idb-persist.mjs';
import { L9_MAX_PER_BATCH, L9_PATCH_MAX } from './persist-store.mjs';

const norm = (v) => JSON.stringify(v);

describe('L10-W3 §D-1 持久层主模块（N 层）', () => {
  test('T-94(N) buildPersistBatch 形状 / 删除优先 / 上限', () => {
    const seam = createSeam({ kind: 'idb' });
    assert.equal(seam.version, L10_SEAM_VERSION);

    /* 基本形状 */
    const dirty = new Map([['a', { id: 'a', v: 1 }], ['b', { id: 'b', v: 2 }]]);
    const r = buildPersistBatch(dirty, new Set());
    assert.equal(r.reason, null);
    assert.equal(Array.isArray(r.batches), true);
    assert.equal(r.batches.length, 1);
    assert.deepEqual(r.batches[0].changed.map((c) => c.id), ['a', 'b']);
    assert.deepEqual(r.batches[0].deleted, []);

    /* 删除优先（D-2）：removed 中的 id 从 changed 剔除；deleted 仅随首批 */
    const r2 = buildPersistBatch(new Map([['a', { id: 'a' }], ['b', { id: 'b' }]]), new Set(['a']));
    assert.deepEqual(r2.batches[0].changed.map((c) => c.id), ['b']);
    assert.deepEqual(r2.batches[0].deleted, ['a']);

    /* 空 */
    assert.equal(buildPersistBatch(new Map(), new Set()).reason, 'empty');

    /* 上限（D-6）：dirty+removed > L9_PATCH_MAX → over-threshold */
    const big = new Map();
    for (let i = 0; i <= L9_PATCH_MAX; i++) big.set('n' + i, { id: 'n' + i });
    assert.equal(buildPersistBatch(big, new Set()).reason, 'over-threshold');

    /* 分批：> L9_MAX_PER_BATCH → 多批；deleted 仅首批 */
    const many = new Map();
    for (let i = 0; i < L9_MAX_PER_BATCH + 3; i++) many.set('m' + i, { id: 'm' + i });
    const r4 = buildPersistBatch(many, new Set(['z']));
    assert.equal(r4.batches.length, 2);
    assert.equal(r4.batches[0].changed.length, L9_MAX_PER_BATCH);
    assert.equal(r4.batches[1].changed.length, 3);
    assert.deepEqual(r4.batches[0].deleted, ['z']);
    assert.deepEqual(r4.batches[1].deleted, []);
  });

  test('T-95(N) mock 后端等价（idb vs invoke）· 事务落盘 + 投影等价', async () => {
    const run = async (seam) => {
      const a = await seam.applyBatch({ changed: [{ id: 'a', data: '{"id":"a","v":1}' }], deleted: [], seq: 1, baseRev: 0 });
      const b = await seam.applyBatch({ changed: [{ id: 'b', data: '{"id":"b","v":2}' }], deleted: ['a'], seq: 2, baseRev: 1 });
      const c = await seam.flushNow({ nodes: { c: { id: 'c' } } });
      return { a, b, c, proj: Array.from(seam.projection()) };
    };
    const A = await run(createSeam({ kind: 'idb' }));
    const B = await run(createSeam({ kind: 'invoke' }));
    assert.equal(norm(A), norm(B), 'idb 与 invoke 接缝同序列必须逐字一致');
    assert.equal(A.a.ok, true);
    assert.equal(A.b.ok, true);
    assert.equal(A.c.ok, true);
    assert.deepEqual(A.proj, [['c', '{"id":"c"}']], 'flushNow 原子替换 + 清孤儿行');
  });

  test('T-96(N) 单批事务原子性（中途 throw → 无半批）', async () => {
    const be = new InMemoryBackend();
    const seam = createSeam({ backend: be });
    await seam.applyBatch({ changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 });
    /* 崩溃注入：apply 阶段抛错（缓冲就绪后、COMMIT 前） */
    be.crashBeforeCommit((phase) => { if (phase === 'apply') throw new Error('crash@apply'); });
    const res = await seam.applyBatch({
      changed: [{ id: 'b', data: '{"id":"b"}' }, { id: 'c', data: '{"id":"c"}' }], deleted: [], seq: 2, baseRev: 1,
    });
    assert.equal(res.ok, false);
    const proj = seam.projection();
    assert.equal(proj.has('b'), false, '半批未落盘（b）');
    assert.equal(proj.has('c'), false, '半批未落盘（c）');
    assert.equal(proj.has('a'), true, '既有行保持');
    assert.equal(seam.stats().mode, 'full', '降级安全网置 full');
  });

  test('T-96(N) 降级路径可测：setFailNext / closed → 同 {name,message}', async () => {
    const batch = { changed: [{ id: 'x', data: '{"id":"x"}' }], deleted: [], seq: 1, baseRev: 0 };

    /* setFailNext(1) → backend unavailable */
    const idb = createSeam({ kind: 'idb' });
    idb.backend.setFailNext(1);
    const f1 = await idb.probeTransact(batch);
    assert.equal(f1.ok, false);
    assert.deepEqual(Object.keys(f1.error).sort(), ['message', 'name']);
    assert.equal(f1.error.name, 'Error');
    assert.equal(f1.error.message, 'backend unavailable');

    /* close() → adapter closed */
    const idb2 = createSeam({ kind: 'idb' });
    idb2.backend.close();
    const f2 = await idb2.probeTransact(batch);
    assert.equal(f2.ok, false);
    assert.deepEqual(Object.keys(f2.error).sort(), ['message', 'name']);
    assert.equal(f2.error.name, 'Error');
    assert.equal(f2.error.message, 'adapter closed');

    /* 两降级路径 → 同形状 {name,message} */
    assert.deepEqual(Object.keys(f1.error).sort(), Object.keys(f2.error).sort());
  });

  test('T-97(N) 旧库迁移幂等（逐 id 值等价）', async () => {
    const seam = createMemorySeam();
    const raw = JSON.stringify({ nodes: { n1: { id: 'n1', v: 1 }, n2: { id: 'n2', v: 2 } } });
    const m1 = await migrateLegacy(seam.store, raw);
    assert.equal(m1.ok, true);
    assert.equal(m1.migrated, true);
    assert.equal(m1.already, false);
    assert.deepEqual(m1.ids.slice().sort(), ['n1', 'n2']);
    const proj1 = Array.from(seam.projection());

    /* 二次调用：幂等（already=true，不改写投影） */
    const m2 = await migrateLegacy(seam.store, raw);
    assert.equal(m2.already, true);
    assert.equal(m2.migrated, false);
    assert.deepEqual(Array.from(seam.projection()), proj1, '二次迁移不改写投影');

    /* 逐 id 值等价 */
    const snap = seam.snapshot();
    assert.deepEqual(snap.n1, { id: 'n1', v: 1 });
    assert.deepEqual(snap.n2, { id: 'n2', v: 2 });
  });
});
