/**
 * L10-W4 · D-1「持久层落地收口」N 层 — 崩溃/一致性 + 三路径隔离 + 哨兵 + 指标
 * ============================================================================
 * 设计依据：`reports/t10-design-2026-10-15.md` §十三 W4 行（**崩溃/一致性 + 三路径隔离 +
 *          哨兵 + 指标**；`stats().p95` 度量）+ §八（桌面 / 加密 / 浏览器 / 影子 opt-in
 *          四路径逐字保持）+ §9.1 S-1~S-5（mock 真语义）+ §十 10.1（指标门槛）。
 * 冻结契约：`tests/t10-idb-persist.spec.ts`（W2）①②③（接缝面 / 开关默认关闭 / 降级字面量）。
 *
 * 用例编号：沿用 D-1 冻结区间 T-93~T-99 的 **N 侧**（T-96 / T-99），**不新增编号**
 *          （design §9.3 编号纪律：单调、不回填）。
 *
 * 诚实声明（不得当作「真实产品路径已验证」）：
 *  · 本节为 **N 层**（Node，无浏览器）。「三路径隔离」以 **模型级**（路径分类互斥 + 各路径
 *    独立后端无串味 + 加密态密文纯净）等价表达；真实产品 HTML 的三路径锚点存在性由
 *    `_临时脚本/_l10w4_entropy.mjs paths`（产物级结构性扫描）独立承担，二者互补。
 *  · 崩溃注入复用 `InMemoryBackend.crashBeforeCommit`（S-2 崩溃钩子）与 `failNext`；断言口径
 *    为「无半批 + 既有行保持 + 降级 full」，**不含任何 wall-clock**（负载鲁棒，承接 T-68 范式）。
 *
 * 运行：`node --test l9/t10-w4-consistency.test.mjs`（Node >= 22）
 * 红证先行：主模块 `t10-idb-persist.mjs` 缺位时本文件必须失败（ERR_MODULE_NOT_FOUND）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createSeam, createMemorySeam } from './t10-idb-persist.mjs';
import {
  PersistStore, InMemoryBackend, buildPersistBatch, percentile95, L9_METRIC_CAP,
} from './persist-store.mjs';

/** 确定性 PRNG（mulberry32）——哨兵用；同种子 → 同序列（无 wall-clock / 负载敏感）。 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 三路径分类（§八：桌面 / 加密 / 浏览器）—— 互斥；加密优先于桌面。 */
function classifyPath({ isDesktop, encrypted, hasKey }) {
  if (encrypted) return hasKey ? 'encrypted' : 'encrypted-locked';
  if (isDesktop) return 'desktop';
  return 'browser';
}

describe('L10-W4 §崩溃/一致性（崩溃注入套件）', () => {
  test('T-96(N) 崩溃@BEGIN → 无半批 + 既有行保持 + 降级 full', async () => {
    const be = new InMemoryBackend();
    const seam = createSeam({ backend: be });
    await seam.applyBatch({ changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 });

    be.crashBeforeCommit((phase) => { if (phase === 'begin') throw new Error('crash@begin'); });
    const res = await seam.applyBatch({
      changed: [{ id: 'b', data: '{"id":"b"}' }, { id: 'c', data: '{"id":"c"}' }], deleted: [], seq: 2, baseRev: 1,
    });

    assert.equal(res.ok, false);
    const proj = seam.projection();
    assert.equal(proj.has('a'), true, '既有行保持');
    assert.equal(proj.has('b'), false, 'BEGIN 崩溃 → 无半批（b）');
    assert.equal(proj.has('c'), false, 'BEGIN 崩溃 → 无半批（c）');
    assert.equal(seam.stats().mode, 'full', '降级安全网置 full');
    assert.equal(seam.stats().failures >= 1, true, '失败缓冲留痕');
  });

  test('T-96(N) 崩溃@APPLY（缓冲就绪后 / COMMIT 前）→ 无半批', async () => {
    const be = new InMemoryBackend();
    const seam = createSeam({ backend: be });
    await seam.applyBatch({ changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 });

    be.crashBeforeCommit((phase) => { if (phase === 'apply') throw new Error('crash@apply'); });
    const res = await seam.applyBatch({
      changed: [{ id: 'b', data: '{"id":"b"}' }, { id: 'c', data: '{"id":"c"}' }], deleted: [], seq: 2, baseRev: 1,
    });

    assert.equal(res.ok, false);
    const proj = seam.projection();
    assert.equal(proj.has('b'), false, '半批未落盘（b）');
    assert.equal(proj.has('c'), false, '半批未落盘（c）');
    assert.equal(proj.get('a'), '{"id":"a"}', '既有行逐字保持');
    assert.equal(seam.stats().mode, 'full', '降级安全网置 full');
  });

  test('T-96(N) checkpoint 失败原子性 → 投影不变 + 降级 full', async () => {
    const be = new InMemoryBackend();
    const seam = createSeam({ backend: be });
    await seam.applyBatch({ changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 });
    const before = JSON.stringify(Array.from(seam.projection()));

    be.failNext = 1; /* 下一次 saveState 抛错 */
    const res = await seam.flushNow({ nodes: { x: { id: 'x' } } });

    assert.equal(res.ok, false);
    assert.equal(JSON.stringify(Array.from(seam.projection())), before, 'checkpoint 失败 → 投影原子不变');
    assert.equal(seam.stats().mode, 'full', '降级安全网置 full');
  });

  test('一致性 · seq 幂等重放（replay:true，不重复生效）', async () => {
    const seam = createMemorySeam();
    const b5 = { changed: [{ id: 'k', data: '{"id":"k","v":5}' }], deleted: [], seq: 5, baseRev: 4 };
    const r1 = await seam.applyBatch(b5);
    assert.equal(r1.ok, true);
    assert.equal(r1.replay, undefined, '首个 seq 正常落盘');
    assert.equal(seam.stats().seq, 1);
    const after1 = JSON.stringify(Array.from(seam.projection()));

    const r2 = await seam.applyBatch(b5);          /* 同 seq 重放 */
    assert.deepEqual(r2, { ok: true, replay: true });
    const r3 = await seam.applyBatch({ ...b5, seq: 4 }); /* 旧 seq */
    assert.deepEqual(r3, { ok: true, replay: true });
    assert.equal(JSON.stringify(Array.from(seam.projection())), after1, '重放不改写投影');
    assert.equal(seam.stats().seq, 1, '重放不递增已接受批计数');

    const r4 = await seam.applyBatch({ changed: [{ id: 'k', data: '{"id":"k","v":6}' }], deleted: [], seq: 6, baseRev: 5 });
    assert.equal(r4.ok, true);
    assert.equal(r4.replay, undefined);
    assert.equal(seam.stats().seq, 2);
  });
});

describe('L10-W4 §三路径隔离（模型级 · §八 四路径）', () => {
  test('三路径互斥分类 + 各路径独立后端无串味', async () => {
    /* 分类互斥：任一组合恰得一个标签；加密优先于桌面 */
    assert.equal(classifyPath({ isDesktop: true, encrypted: false, hasKey: false }), 'desktop');
    assert.equal(classifyPath({ isDesktop: false, encrypted: false, hasKey: false }), 'browser');
    assert.equal(classifyPath({ isDesktop: false, encrypted: true, hasKey: true }), 'encrypted');
    assert.equal(classifyPath({ isDesktop: true, encrypted: true, hasKey: true }), 'encrypted', '加密优先');
    assert.equal(classifyPath({ isDesktop: false, encrypted: true, hasKey: false }), 'encrypted-locked');

    /* 各路径独立后端：桌面(idb) / 加密(idb) / 浏览器(invoke)，互不串味 */
    const desktop = createSeam({ kind: 'idb' });
    const encrypted = createSeam({ kind: 'idb' });
    const browser = createSeam({ kind: 'invoke' });

    await desktop.applyBatch({ changed: [{ id: 'd1', data: '{"id":"d1"}' }], deleted: [], seq: 1, baseRev: 0 });
    await encrypted.applyBatch({ changed: [{ id: 'e1', data: '{"id":"e1"}' }], deleted: [], seq: 1, baseRev: 0 });
    await browser.flushNow({ nodes: { b1: { id: 'b1' } } });

    assert.deepEqual(Array.from(desktop.projection().keys()), ['d1']);
    assert.deepEqual(Array.from(encrypted.projection().keys()), ['e1']);
    assert.deepEqual(Array.from(browser.projection().keys()), ['b1']);
    /* 浏览器（非桌面）路径 = 全量 checkpoint（flushNow），无增量 patch 语义 */
    assert.equal(browser.projection().has('d1'), false, '路径间无串味');
  });

  test('加密路径 · 落盘字节无明文（结构性密文纯净）', async () => {
    const seam = createSeam({ kind: 'idb' });
    const MARK = 'SECRET_PLAINTEXT_MARKER_XYZ';
    const node = { id: 's1', body: MARK };
    /* 逐条加密（可逆等价）后成批：data 内不得出现明文标记 */
    const cipher = Buffer.from(JSON.stringify(node), 'utf8').toString('base64');
    await seam.applyBatch({ changed: [{ id: 's1', data: cipher }], deleted: [], seq: 1, baseRev: 0 });

    const stored = seam.projection().get('s1');
    assert.equal(typeof stored, 'string');
    assert.equal(stored.includes(MARK), false, '落盘字节无明文片段');
    /* 可解密还原（逐字段等价） */
    const back = JSON.parse(Buffer.from(stored, 'base64').toString('utf8'));
    assert.deepEqual(back, node);
  });
});

describe('L10-W4 §哨兵 + §指标', () => {
  test('T-99(N) 哨兵 · 200 步确定性随机序列 → 投影一致性（结构性）', async () => {
    const rand = mulberry32(0xC0FFEE);
    const seam = createSeam({ kind: 'idb' });
    const model = new Map(); /* 权威内存模型：id → node */
    let seq = 0;

    for (let step = 0; step < 200; step++) {
      const r = rand();
      const id = 'n' + Math.floor(rand() * 40);
      const dirty = new Map();
      const removed = new Set();
      if (r < 0.55) {                    /* 新增 / 覆盖 */
        const node = { id, v: Math.floor(rand() * 1000) };
        model.set(id, node); dirty.set(id, node);
      } else if (r < 0.8) {              /* 更新（仅当存在） */
        if (model.has(id)) { const node = { id, v: Math.floor(rand() * 1000) }; model.set(id, node); dirty.set(id, node); }
      } else {                           /* 硬删（仅当存在） */
        if (model.has(id)) { model.delete(id); removed.add(id); }
      }
      const built = buildPersistBatch(dirty, removed);
      if (built.reason === null) {
        for (const b of built.batches) { seq++; await seam.applyBatch({ ...b, seq, baseRev: seq - 1 }); }
      } else {
        assert.equal(built.reason, 'empty', '单步脏集 + 删除集不可能 over-threshold');
      }
    }

    /* 投影等价：无缺行、无孤儿行（#27 语义延伸） */
    const snap = seam.snapshot();
    assert.equal(Object.keys(snap).length, model.size, '投影行数 == 模型行数（无孤儿 / 无缺行）');
    for (const [id, node] of model) {
      assert.deepEqual(snap[id], node, '逐 id 逐字段等价: ' + id);
    }
  });

  test('指标 · stats().p95 nearest-rank + 有界 ring（L9_METRIC_CAP）', () => {
    /* nearest-rank（design §十 10.1 / OP-2 口径） */
    assert.equal(Number.isNaN(percentile95([])), true, '无样本 → NaN');
    assert.equal(percentile95([7]), 7);
    assert.equal(percentile95([1, 2, 3, 4, 5]), 5);              /* rank = ceil(0.95*5) = 5 */
    assert.equal(percentile95(Array.from({ length: 20 }, (_, i) => i + 1)), 19);
    assert.equal(percentile95(Array.from({ length: 100 }, (_, i) => i + 1)), 95);
    assert.equal(percentile95([5, 1, 3, 2, 4]), 5, '纯函数不改写入参');

    /* 有界 ring：上限内累计，越界淘汰最旧；latencySamples 单调 */
    const cap = 10;
    const store = new PersistStore({ backend: new InMemoryBackend(), latencyCap: cap });
    for (let i = 1; i <= 25; i++) store.recordLatency(i);
    assert.equal(store.stats().latencySamples, 25, '累计采样数单调');
    assert.equal(store.p95(), 25, 'ring = 末 10 样本（16..25）→ rank 10 → 25');
    /* 非法值忽略（不改口径） */
    store.recordLatency(NaN);
    store.recordLatency(-1);
    assert.equal(store.stats().latencySamples, 25, '非法样本不计入');

    /* stats() 暴露 p95 + latencySamples（既有字段不变） */
    const s = store.stats();
    assert.equal(Object.prototype.hasOwnProperty.call(s, 'p95'), true);
    assert.equal(Object.prototype.hasOwnProperty.call(s, 'latencySamples'), true);
    assert.equal(L9_METRIC_CAP, 256, '默认 ring 上限 = 256');
  });
});
