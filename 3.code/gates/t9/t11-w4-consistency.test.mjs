/**
 * L11-W4 · E-1「遗留收口与默认启用治理」N 层 — 崩溃/一致性 + 四路径隔离 + 哨兵 + 指标
 * ============================================================================
 * 设计依据：`reports/t11-design-2026-10-15.md` §十三 W4 行（**崩溃/一致性 + 四路径隔离 +
 *          哨兵 + 指标**；`stats().p95` 度量）+ §八（桌面 / 加密 / 浏览器 / 影子层
 *          **四路径**逐字保持）+ §9.1 S-1~S-5（mock 真语义）+ §十 10.1（指标门槛）。
 * 冻结契约：`tests/t11-anchor-governance.spec.ts`（W2）T-100 ~ T-103（E-1 面 · 默认关闭态）。
 *
 * 编号纪律：L11 自 **T-100** 起单调接续（L10 末号 T-99）。T-104（`M-I` 默认启用）本轮
 *          **deferred**（`N-I` 项 → W5），故本波哨兵取 **T-105**（四路径确定性哨兵），
 *          以 **N 侧** 记名 `T-105(N)`；崩溃/一致性复用 L10 冻结区间 T-96 语义，**不新增编号**。
 *
 * 诚实声明（不得当作「真实产品路径已验证」）：
 *  · 本节为 **N 层**（Node，无浏览器）。「四路径隔离」以 **模型级**（路径分类互斥 + 各路径
 *    独立后端无串味 + 加密态密文纯净）等价表达；真实产品 HTML 的四路径锚点存在性由
 *    `_临时脚本/_l11w4_entropy.mjs paths`（产物级结构性扫描）独立承担，二者互补。
 *  · 崩溃注入复用 `InMemoryBackend.crashBeforeCommit`（S-2 崩溃钩子）与 `failNext`；断言口径
 *    为「无半批 + 既有行保持 + 降级 full」，**不含任何 wall-clock**（负载鲁棒，承接 T-68 范式）。
 *
 * 运行：`node --test l9/t11-w4-consistency.test.mjs`（Node >= 22）
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

/** 四路径分类（§八：桌面 / 加密 / 浏览器 / 影子层）—— 互斥；加密优先，其次影子层。 */
function classifyPath4({ isDesktop, encrypted, hasKey, shadow }) {
  if (encrypted) return hasKey ? 'encrypted' : 'encrypted-locked';
  if (shadow) return 'shadow';
  if (isDesktop) return 'desktop';
  return 'browser';
}

/** 指标序列（bounded ring；L11-W4 commit / 切视图 / longtask 三序列口径）。 */
class LatencySeries {
  constructor(cap = L9_METRIC_CAP) { this.cap = cap; this._s = []; this._n = 0; }
  record(ms) {
    const v = Number(ms);
    if (!Number.isFinite(v) || v < 0) return this; /* 非法样本忽略 */
    this._s.push(v);
    if (this._s.length > this.cap) this._s.splice(0, this._s.length - this.cap);
    this._n++;
    return this;
  }
  p95() { return percentile95(this._s); }
  stats() { return { p95: this.p95(), samples: this._n, window: this._s.length }; }
}

describe('L11-W4 §崩溃/一致性（崩溃注入套件 · 复用 T-96 语义）', () => {
  test('一致性 · 崩溃@BEGIN → 无半批 + 既有行保持 + 降级 full', async () => {
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

  test('一致性 · 崩溃@APPLY（缓冲就绪后 / COMMIT 前）→ 无半批', async () => {
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

  test('一致性 · checkpoint 失败原子性 → 投影不变 + 降级 full', async () => {
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

describe('L11-W4 §四路径隔离（模型级 · §八 四路径逐字）', () => {
  test('四路径互斥分类（desktop / encrypted / browser / shadow）+ 各路径独立后端无串味', async () => {
    /* 分类互斥：任一组合恰得一个标签；加密优先，其次影子层 */
    assert.equal(classifyPath4({ isDesktop: true, encrypted: false, hasKey: false, shadow: false }), 'desktop');
    assert.equal(classifyPath4({ isDesktop: false, encrypted: false, hasKey: false, shadow: false }), 'browser');
    assert.equal(classifyPath4({ isDesktop: false, encrypted: false, hasKey: false, shadow: true }), 'shadow');
    assert.equal(classifyPath4({ isDesktop: true, encrypted: false, hasKey: false, shadow: true }), 'shadow', '影子层优先于桌面');
    assert.equal(classifyPath4({ isDesktop: false, encrypted: true, hasKey: true, shadow: false }), 'encrypted');
    assert.equal(classifyPath4({ isDesktop: true, encrypted: true, hasKey: true, shadow: true }), 'encrypted', '加密优先');
    assert.equal(classifyPath4({ isDesktop: false, encrypted: true, hasKey: false, shadow: false }), 'encrypted-locked');

    /* 四路径各自独立后端：桌面(idb) / 加密(idb) / 浏览器(invoke) / 影子层(idb)，互不串味 */
    const desktop = createSeam({ kind: 'idb' });
    const encrypted = createSeam({ kind: 'idb' });
    const browser = createSeam({ kind: 'invoke' });
    const shadow = createSeam({ kind: 'idb' });

    await desktop.applyBatch({ changed: [{ id: 'd1', data: '{"id":"d1"}' }], deleted: [], seq: 1, baseRev: 0 });
    await encrypted.applyBatch({ changed: [{ id: 'e1', data: '{"id":"e1"}' }], deleted: [], seq: 1, baseRev: 0 });
    await browser.flushNow({ nodes: { b1: { id: 'b1' } } });
    await shadow.applyBatch({ changed: [{ id: 's1', data: '{"id":"s1"}' }], deleted: [], seq: 1, baseRev: 0 });

    assert.deepEqual(Array.from(desktop.projection().keys()), ['d1']);
    assert.deepEqual(Array.from(encrypted.projection().keys()), ['e1']);
    assert.deepEqual(Array.from(browser.projection().keys()), ['b1']);
    assert.deepEqual(Array.from(shadow.projection().keys()), ['s1']);
    /* 路径间无串味：任一路径不含他方 id */
    for (const [name, seam, foreign] of [
      ['desktop', desktop, 'e1'], ['encrypted', encrypted, 'd1'],
      ['browser', browser, 'd1'], ['shadow', shadow, 'd1'],
    ]) {
      assert.equal(seam.projection().has(foreign), false, `${name} 路径无串味（不含 ${foreign}）`);
    }
    /* 浏览器（非桌面）路径 = 全量 checkpoint（flushNow），无增量 patch 语义 */
    assert.equal(browser.projection().has('d1'), false, '浏览器路径无增量语义');
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

describe('L11-W4 §哨兵 + §指标', () => {
  test('T-105(N) 哨兵 · 200 步确定性随机序列（四路径）→ 投影一致性（结构性）', async () => {
    const rand = mulberry32(0xC0FFEE);
    /* 四路径：独立后端 + 独立权威内存模型（id 前缀区分，验证无串味） */
    const paths = [
      { name: 'desktop', seam: createSeam({ kind: 'idb' }), pre: 'd' },
      { name: 'encrypted', seam: createSeam({ kind: 'idb' }), pre: 'e' },
      { name: 'browser', seam: createSeam({ kind: 'invoke' }), pre: 'b' },
      { name: 'shadow', seam: createSeam({ kind: 'idb' }), pre: 's' },
    ];
    for (const p of paths) { p.model = new Map(); p.seq = 0; }

    for (let step = 0; step < 200; step++) {
      const p = paths[step % paths.length];      /* 轮转：四路径等频 */
      const r = rand();
      const id = p.pre + Math.floor(rand() * 20);
      const dirty = new Map();
      const removed = new Set();
      if (r < 0.55) {                            /* 新增 / 覆盖 */
        const node = { id, v: Math.floor(rand() * 1000) };
        p.model.set(id, node); dirty.set(id, node);
      } else if (r < 0.8) {                      /* 更新（仅当存在） */
        if (p.model.has(id)) { const node = { id, v: Math.floor(rand() * 1000) }; p.model.set(id, node); dirty.set(id, node); }
      } else {                                   /* 硬删（仅当存在） */
        if (p.model.has(id)) { p.model.delete(id); removed.add(id); }
      }
      const built = buildPersistBatch(dirty, removed);
      if (built.reason === null) {
        for (const b of built.batches) { p.seq++; await p.seam.applyBatch({ ...b, seq: p.seq, baseRev: p.seq - 1 }); }
      } else {
        assert.equal(built.reason, 'empty', '单步脏集 + 删除集不可能 over-threshold');
      }
    }

    /* 逐路径投影等价：无缺行、无孤儿行（#27 语义延伸）+ 无跨路径串味 */
    const seen = new Map();
    for (const p of paths) {
      const snap = p.seam.snapshot();
      assert.equal(Object.keys(snap).length, p.model.size, `${p.name} 投影行数 == 模型行数`);
      for (const [id, node] of p.model) {
        assert.deepEqual(snap[id], node, `${p.name} 逐 id 逐字段等价: ${id}`);
        assert.equal(seen.has(id), false, `id 唯一（无跨路径串味）: ${id}`);
        seen.set(id, p.name);
      }
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

  test('指标 · commit / 切视图 / longtask 三序列 p95（L11-W4 度量口径）', () => {
    const commit = new LatencySeries();
    const viewSwitch = new LatencySeries();
    const longtask = new LatencySeries();

    /* 合成确定性样本（N 层，无 wall-clock）：三序列独立，p95 各自最近秩 */
    for (let i = 1; i <= 20; i++) commit.record(i);          /* 1..20 → p95 = 19 */
    for (let i = 1; i <= 20; i++) viewSwitch.record(i * 2);  /* 2..40 → p95 = 38 */
    for (let i = 1; i <= 20; i++) longtask.record(i * 3);    /* 3..60 → p95 = 57 */

    assert.equal(commit.p95(), 19);
    assert.equal(viewSwitch.p95(), 38);
    assert.equal(longtask.p95(), 57);
    assert.deepEqual(commit.stats(), { p95: 19, samples: 20, window: 20 });
    assert.equal(viewSwitch.stats().samples, 20);
    assert.equal(longtask.stats().samples, 20);

    /* 非法样本被忽略；ring 上限与 L9_METRIC_CAP 同口径 */
    commit.record(NaN); commit.record(-1);
    assert.equal(commit.stats().samples, 20, '非法样本忽略');
    const tiny = new LatencySeries(3);
    for (const v of [10, 20, 30, 40]) tiny.record(v);
    assert.equal(tiny.stats().window, 3, 'ring 上限 3 → 窗口最多 3');
    assert.equal(tiny.stats().samples, 4, '累计计数单调');
  });
});
