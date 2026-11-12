/**
 * L9-W1 · 持久层 P1a — 落盘逻辑（schema / 写路径 / 原子性 / flush / 错误处理）
 * ----------------------------------------------------------------------------
 * 设计依据：`reports/t9-design-2026-10-14.md` §五（P1a/M-A）· §9.1（S-1/S-2 mock 契约等价）
 *          + L8 冻结契约 `t8-persist-patch.spec.ts`（批形状 §六 6.4：{changed,deleted,seq,baseRev}）
 *          + §十三 L9-W4「指标」：`stats().p95` —— 持久化往返 wall-clock P95（OP-2 口径）
 *
 * 契约同源（S-1：mock 不得为「好测」而改 JSON 契约形状）：
 *   changed: Array<{ id:string, data:string }>   // data = 单节点 JSON 串（D-3）
 *   deleted: Array<string>                        // 硬删 id（含子树全集，LO-3=A）
 *   seq:     number                               // 批序号（单调；幂等投递基准 K-2）
 *   baseRev: number                               // 权威持久化版本（轻量指纹 D-8）
 *
 * 原子性（S-2）：单批 = 一次事务，三段式 BEGIN → apply（写缓冲）→ COMMIT（换入提交面）；
 *               中途抛错 → 丢弃缓冲（等价 WAL / IDB abort 回滚），盘面无半批。
 *
 * 性质：**影子层（shadow / 默认关闭）**。本模块为纯函数 + 可注入后端，不触碰产品 HTML、
 *       不接线导出/导入（LO-2）。默认行为对既有产品路径零影响。
 */

/** 单批上限（承接 L8_MAX_PER_BATCH=500） */
export const L9_MAX_PER_BATCH = 500;
/** 脏集总量阈值：超过则退全量 checkpoint（承接 L8_PATCH_MAX=2000，D-6） */
export const L9_PATCH_MAX = 2000;
/** 失败缓冲 FIFO 上限（承接 L8_FAIL_CAP=50） */
export const L9_FAIL_CAP = 50;
/** 每 N 批收敛一次全量 checkpoint（拟定值，LO-5 bench 标定前；D-10） */
export const L9_CHECKPOINT_EVERY = 32;
/** 指标采样缓冲上限（bounded ring；L9-W4 `stats().p95`，design §十三 L9-W4「指标」/ OP-2） */
export const L9_METRIC_CAP = 256;

/**
 * wall-clock 毫秒（优先 `performance.now()`；退化 `process.hrtime.bigint()`；再退化 `Date.now()`）。
 * 与模块既有约定一致：无第三方依赖、可在 Node 与浏览器（影子层）同源运行。
 */
function nowMs() {
  const perf = typeof globalThis !== 'undefined' ? globalThis.performance : undefined;
  if (perf && typeof perf.now === 'function') return perf.now();
  if (typeof process !== 'undefined' && process.hrtime && typeof process.hrtime.bigint === 'function') {
    return Number(process.hrtime.bigint()) / 1e6;
  }
  return Date.now();
}

/**
 * 95th percentile（**nearest-rank 最近秩法**；design §十 10.1 / OP-2「组批 + 序列化 + invoke 往返」P95）：
 *   ① 样本升序排序；② rank = ceil(0.95 × n)（1-based）；③ 取第 rank 个（索引 clamp 到 [0, n-1]）。
 *   n = 0 → NaN（无样本，未定义）；纯函数，**不改动入参**（供 N 层以已知样本集断言）。
 * @param {number[]} samples wall-clock 毫秒样本
 * @returns {number} P95 毫秒（无样本 → NaN）
 */
export function percentile95(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return NaN;
  const sorted = samples.slice().sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length); /* 1-based 最近秩 */
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx];
}

/** 批形状校验（真契约，S-1） */
export function isBatch(b) {
  return !!b
    && Array.isArray(b.changed) && Array.isArray(b.deleted)
    && b.changed.every((it) => it && typeof it.id === 'string' && typeof it.data === 'string')
    && b.deleted.every((id) => typeof id === 'string')
    && typeof b.seq === 'number'
    && typeof b.baseRev === 'number';
}

/**
 * 脏集 → 批（对齐 L8 buildPersistBatch）。
 * @param {Map<string,object>} dirtyNodes  脏集（id → 节点引用）
 * @param {Set<string>}        removedIds  硬删集
 * @returns {{reason:(null|'empty'|'over-threshold'), batches:Array}}
 *   - 超限（dirty+removed > L9_PATCH_MAX）→ { reason:'over-threshold', batches:[] }（D-6）
 *   - 删除优先（D-2）：removed 中的 id 从 changed 剔除；deleted 仅随首批投递（LO-4）
 */
export function buildPersistBatch(dirtyNodes, removedIds) {
  const dirty = dirtyNodes instanceof Map ? dirtyNodes : new Map(Object.entries(dirtyNodes || {}));
  const removed = removedIds instanceof Set ? removedIds : new Set(removedIds || []);
  if (dirty.size + removed.size > L9_PATCH_MAX) return { reason: 'over-threshold', batches: [] };

  const deleted = Array.from(removed).filter(Boolean);
  const delSet = new Set(deleted);
  const changedIds = Array.from(dirty.keys()).filter((id) => id && !delSet.has(id));
  if (!changedIds.length && !deleted.length) return { reason: 'empty', batches: [] };

  const batches = [];
  const n = Math.max(1, Math.ceil(changedIds.length / L9_MAX_PER_BATCH));
  for (let i = 0; i < n; i++) {
    const slice = changedIds.slice(i * L9_MAX_PER_BATCH, (i + 1) * L9_MAX_PER_BATCH);
    const changed = slice.map((id) => ({ id, data: JSON.stringify(dirty.get(id)) }));
    batches.push({ changed, deleted: i === 0 ? deleted.slice() : [] });
  }
  return { reason: null, batches };
}

/** 投影逐 id JSON 等价（#27 语义延伸；无孤儿行 / 无缺行） */
export function equalProjection(a, b) {
  const ma = a instanceof Map ? a : new Map(Object.entries(a || {}));
  const mb = b instanceof Map ? b : new Map(Object.entries(b || {}));
  if (ma.size !== mb.size) return false;
  for (const [k, v] of ma) { if (!mb.has(k) || mb.get(k) !== v) return false; }
  return true;
}

/**
 * InMemoryBackend：mock 真语义后端（S-2：事务缓冲三段式；崩溃 = 丢弃缓冲）。
 * 仅用于 N 层单测 / 影子试跑；不新增真实后端依赖（S-5）。
 */
export class InMemoryBackend {
  constructor() {
    this._committed = new Map();
    this.failNext = 0;          /* >0：接下来 N 次 transact 抛错（模拟后端不可用） */
    this._crash = null;          /* 崩溃注入钩子：fn(phase,batch) 抛错 = 崩溃 */
    this._lastSeq = 0;
  }
  /** 崩溃注入（测试用）：phase='begin'|'apply' */
  crashBeforeCommit(fn) { this._crash = typeof fn === 'function' ? fn : null; }
  /** 单批事务（BEGIN → apply → COMMIT；抛错 → 丢弃缓冲，无半批） */
  async transact(batch) {
    if (typeof this._crash === 'function') this._crash('begin', batch); /* BEGIN */
    const buf = new Map();
    for (const it of batch.changed || []) buf.set(it.id, it.data);
    const dels = (batch.deleted || []).slice();
    if (typeof this._crash === 'function') this._crash('apply', batch); /* 缓冲就绪 */
    if (this.failNext > 0) { this.failNext--; throw new Error('backend unavailable'); }
    /* COMMIT：原子换入 */
    for (const [k, v] of buf) this._committed.set(k, v);
    for (const id of dels) this._committed.delete(id);
    this._lastSeq = Math.max(this._lastSeq, batch.seq | 0);
    return { ok: true, seq: batch.seq | 0, changed: (batch.changed || []).length, deleted: dels.length };
  }
  /** 全量 checkpoint（原子替换：含清孤儿行） */
  async saveState(snapshot) {
    const next = new Map();
    const nodes = (snapshot && snapshot.nodes) || {};
    for (const id of Object.keys(nodes)) next.set(id, JSON.stringify(nodes[id]));
    if (this.failNext > 0) { this.failNext--; throw new Error('backend unavailable'); }
    this._committed = next; /* 原子换入 */
    return { ok: true, rows: next.size };
  }
  rows() { return new Map(this._committed); }
}

/**
 * PersistStore：落盘调度（写路径 / 幂等 / flush / 错误处理 / 安全网）。
 * schema 与后端解耦（S-1）；默认后端 = InMemoryBackend。
 */
export class PersistStore {
  constructor({ backend, failCap = L9_FAIL_CAP, checkpointEvery = L9_CHECKPOINT_EVERY, latencyCap = L9_METRIC_CAP } = {}) {
    this.backend = backend || new InMemoryBackend();
    this.failCap = failCap;
    this.checkpointEvery = checkpointEvery;
    this.latencyCap = latencyCap; /* 指标采样 ring 上限（L9-W4） */
    this.failures = [];          /* FIFO 失败缓冲（上限 failCap） */
    this.mode = 'patch';         /* 'patch' | 'full'（安全网） */
    this.seq = 0;                /* 已接受批计数 */
    this.sinceFull = 0;          /* 自上次全量起批数（D-10） */
    this.rev = 0;                /* 权威持久化版本 */
    this.checkpointPending = false;
    this._lastAcceptedSeq = 0;   /* K-2 幂等基准 */
    this._latency = [];          /* wall-clock 样本（bounded ring，上限 latencyCap） */
    this._latencyTotal = 0;      /* 累计采样数（含被 ring 淘汰者，单调） */
  }
  /**
   * 采样一次持久化往返的 wall-clock 延迟（毫秒）。
   * bounded ring：超上限淘汰最旧样本；非法值（非有限 / 负数）忽略。
   */
  recordLatency(ms) {
    const v = Number(ms);
    if (!Number.isFinite(v) || v < 0) return this;
    this._latency.push(v);
    if (this._latency.length > this.latencyCap) {
      this._latency.splice(0, this._latency.length - this.latencyCap);
    }
    this._latencyTotal++;
    return this;
  }
  /** P95 wall-clock（nearest-rank；无样本 → NaN） */
  p95() { return percentile95(this._latency); }
  stats() {
    return {
      mode: this.mode, seq: this.seq, sinceFull: this.sinceFull, rev: this.rev,
      pending: this.checkpointPending, failures: this.failures.length,
      /* L9-W4 指标：持久化操作 wall-clock P95（ms）+ 累计采样数（既有字段保持不变） */
      p95: this.p95(), latencySamples: this._latencyTotal,
    };
  }
  /** 降级范式（对齐 l8PersistFailure）：FIFO 缓冲 + 置 full 安全网（宁慢不错） */
  failure(phase, op, err) {
    this.failures.push({
      phase: String(phase || ''), op: String(op == null ? '' : op),
      error: String((err && err.message) || err), ts: Date.now(),
    });
    if (this.failures.length > this.failCap) this.failures.splice(0, this.failures.length - this.failCap);
    this.mode = 'full';
  }
  setMode(m) { this.mode = m === 'full' ? 'full' : 'patch'; return this.mode; }
  /**
   * 应用单批：校验 → 幂等（K-2 同 seq 重放）→ 事务落盘 → 计数/收敛。
   * @returns {Promise<{ok:boolean, replay?:boolean, ack?:object}>}
   */
  async applyBatch(batch) {
    if (!isBatch(batch)) { this.failure('validate', 'patch_nodes', new Error('invalid batch shape')); return { ok: false }; }
    if (this._lastAcceptedSeq > 0 && (batch.seq | 0) <= this._lastAcceptedSeq) {
      return { ok: true, replay: true }; /* K-2：同 seq 重放幂等 no-op */
    }
    const t0 = nowMs(); /* L9-W4：persist 往返 wall-clock 起点 */
    try {
      const ack = await this.backend.transact(batch);
      this._lastAcceptedSeq = batch.seq | 0;
      this.seq++;
      this.sinceFull++;
      this.rev++;
      if (this.sinceFull >= this.checkpointEvery) this.checkpointPending = true;
      return { ok: true, ack };
    } catch (e) {
      this.failure('patch', 'patch_nodes', e);
      return { ok: false };
    } finally {
      this.recordLatency(nowMs() - t0); /* 成功 / 失败路径均采样（真实耗时） */
    }
  }
  /** 全量 checkpoint（save_state）：原子替换 + 收敛计数归零 + 解除安全网 */
  async flushNow(snapshot) {
    const t0 = nowMs(); /* L9-W4：checkpoint 往返 wall-clock 起点 */
    try {
      await this.backend.saveState(snapshot);
      this.rev++;
      this.sinceFull = 0;
      this.checkpointPending = false;
      this.mode = 'patch';
      return { ok: true };
    } catch (e) {
      this.failure('checkpoint', 'save_state', e);
      return { ok: false };
    } finally {
      this.recordLatency(nowMs() - t0); /* 成功 / 失败路径均采样 */
    }
  }
  /** 投影视图（id → 单节点 JSON 串） */
  projection() { return this.backend.rows(); }
  /** 载入快照（load_state 等价；id → 已解析节点） */
  snapshot() {
    const out = {};
    for (const [id, json] of this.backend.rows()) {
      try { out[id] = JSON.parse(json); } catch (e) { /* 跳过坏行 */ }
    }
    return out;
  }
}
