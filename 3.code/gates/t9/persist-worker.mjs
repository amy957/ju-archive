/**
 * L9-W1 · Worker 化骨架 + syncFallback 桥
 * L9-W2 · 真实 file:// classic Blob Worker（协议不变；Node 侧降级保留）
 * ----------------------------------------------------------------------------
 * 设计依据：`reports/t9-design-2026-10-14.md` §五（Worker 骨架）+ §9.1（S-2/S-3 崩溃=重载）
 *          + L7 `setIndexWorkerMode` 范式（sync / shadow / worker 三态 + 降级）。
 *
 * 授权约束（LO-1）：**主线程 L6 同步路径永久保留**，在本层抽象为 `syncFallback`。
 *   - `mode='sync'`：不经 Worker，直接走 syncFallback（与既有主线程路径等价）。
 *   - `mode='worker'|'shadow'`：经 Worker 投递；构造失败 / 超时 → 回落 syncFallback。
 *   - syncFallback **不得删除**，且必须保持可用（W2–W5 依赖）。
 *
 * W2 真实 Worker（C-2）：`file://` 单文件形态只能使用 **classic Blob Worker**
 *   （`new Worker(url)`，**禁用** `{type:'module'}`；L7 实测 module worker 在 file:// 不可用）。
 *   - 浏览器（`typeof window !== 'undefined'` 且 Worker/Blob/URL 齐备）→ 真实 classic Blob Worker。
 *   - Node / 无 Browser Worker API → 回落**进程内等价骨架**（`node:test` 无 Worker/Blob 依赖）。
 *   协议契约逐字段不变（`worker-protocol.mjs` 字节冻结）。
 *
 * 生命周期：Worker 创建后异步发 `ready` 握手；bridge.terminate 释放。
 *   L9-W3：`DISPOSE`（幂等 teardown）与 `RESULT`（请求→响应按既有 msg.id 关联）落地；
 *           `bridge.dispose()` = 投递 DISPOSE（等 ack / 超时兜底）→ 释放 worker + 清在途 +
 *           摘监听 + 置 `disposed`（幂等；post-dispose 请求一律 reject，无未处理拒绝）。
 * 可测性：LO-2 不接线导出/导入。
 */
import { REQ, RES, makeAck, makeError } from './worker-protocol.mjs';

/**
 * 主线程同步落盘路径（LO-1 永久保留）。
 * @returns {Promise<{ok:boolean,...}>} 直接返回 store 结果（同步语义，异步仅为接口统一）
 */
export function createSyncFallback(store) {
  return async function syncFallback(msg) {
    const type = msg && msg.type;
    try {
      if (type === REQ.PATCH) return await store.applyBatch(msg.payload);
      if (type === REQ.SAVE) return await store.flushNow(msg.payload && msg.payload.snapshot);
      if (type === REQ.LOAD) return { ok: true, snapshot: store.snapshot() };
      if (type === REQ.PING) return { ok: true, pong: true };
      if (type === REQ.DISPOSE) return { ok: true, disposed: true }; /* W3：生命周期（无副作用 ack） */
      return { ok: false, error: 'unknown-type:' + String(type) };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  };
}

/** 直接形态（既有调用点保留；等价于 createSyncFallback(store)(msg)） */
export async function syncFallback(store, msg) { return createSyncFallback(store)(msg); }

/** Worker 侧消息处理（进程内等价实现；走 store 真契约） */
async function _handleInWorker(store, msg) {
  try {
    if (msg.type === REQ.PATCH) return makeAck(msg.id, await store.applyBatch(msg.payload));
    if (msg.type === REQ.SAVE) return makeAck(msg.id, await store.flushNow(msg.payload && msg.payload.snapshot));
    if (msg.type === REQ.LOAD) return makeAck(msg.id, { snapshot: store.snapshot() });
    if (msg.type === REQ.PING) return makeAck(msg.id, { pong: true });
    if (msg.type === REQ.DISPOSE) return makeAck(msg.id, { ok: true, disposed: true });
    return makeError(msg.id, new Error('unknown-type:' + String(msg.type)));
  } catch (e) {
    return makeError(msg.id, e);
  }
}
/* L9-W3：`DISPOSE` 已由进程内实现与真实 Blob Worker 逐一对齐（ack + teardown）；
   `RESULT` 为响应形状，由 `PersistWorkerBridge._onMessage` 按 msg.id 关联（与 `ack` 同路径，
   未知 id / post-dispose 尾包一律安全忽略）。 */

/**
 * Node / 无 Browser Worker API 的**进程内等价骨架**（无真实线程；
 * 模拟 postMessage/onmessage/terminate + ready 握手）。降级路径必须保持可测。
 */
export function createInProcessWorker(store) {
  let alive = true;
  const worker = {
    onmessage: null,
    /** 幂等：重复 terminate 无副作用（teardown 后 postMessage 一律丢弃） */
    terminate() { alive = false; },
    postMessage(msg) {
      if (!alive) return;
      setTimeout(() => {
        if (!alive) return;
        /* W3 · DISPOSE：先回 ack，随即 teardown（后续投递丢弃，幂等） */
        if (msg && msg.type === REQ.DISPOSE) {
          if (typeof worker.onmessage === 'function') {
            worker.onmessage({ data: makeAck(msg.id, { ok: true, disposed: true }) });
          }
          alive = false;
          return;
        }
        _handleInWorker(store, msg).then((res) => {
          if (alive && typeof worker.onmessage === 'function') worker.onmessage({ data: res });
        });
      }, 0);
    },
  };
  /* ready 握手（宏任务，确保调用方已挂 onmessage） */
  setTimeout(() => {
    if (alive && typeof worker.onmessage === 'function') worker.onmessage({ data: { type: RES.READY } });
  }, 0);
  return worker;
}

/* ════════════════════════════════════════════════════════════════════════
 * W2 · 真实 file:// classic Blob Worker
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * Worker 源码：**自包含 classic script**（无 import/export；仅用 Worker 全局）。
 * 协议形状与 `worker-protocol.mjs` 逐字段一致：
 *   - 请求  { id:number|string, type, payload? }
 *   - 响应  { id, type:'ack'|'error', … } / 生命周期 { type:'ready' }
 * 通过 `new Blob([src],{type:'text/javascript'})` + `URL.createObjectURL` 注入（经典 Worker，非 module）。
 */
export const L9_WORKER_SRC = `'use strict';
/* L9-W2 · file:// classic Blob worker（自包含；协议形状与 worker-protocol.mjs 逐字段一致） */
const REQ = { PATCH: 'patch_nodes', SAVE: 'save_state', LOAD: 'load_state', PING: 'ping', DISPOSE: 'dispose' };
const RES = { ACK: 'ack', RESULT: 'result', ERROR: 'error', READY: 'ready' };
const rows = new Map();
let lastSeq = 0;
function ack(id, extra) {
  const o = { id: id, type: RES.ACK };
  if (extra) { for (const k in extra) o[k] = extra[k]; }
  return o;
}
function fail(id, e) { return { id: id, type: RES.ERROR, error: String((e && e.message) || e) }; }
function applyPatch(id, payload) {
  const p = payload || {};
  const seq = (p.seq | 0);
  if (lastSeq > 0 && seq <= lastSeq) return ack(id, { ok: true, replay: true, seq: seq });
  const changed = p.changed || [];
  const deleted = p.deleted || [];
  for (const it of changed) rows.set(it.id, it.data);
  for (const de of deleted) rows.delete(de);
  lastSeq = Math.max(lastSeq, seq);
  return ack(id, { ok: true, seq: seq, changed: changed.length, deleted: deleted.length });
}
function saveState(id, snapshot) {
  const nodes = (snapshot && snapshot.nodes) || {};
  const next = new Map();
  for (const de of Object.keys(nodes)) next.set(de, JSON.stringify(nodes[de]));
  rows.clear();
  for (const entry of next) rows.set(entry[0], entry[1]);
  return ack(id, { ok: true, rows: next.size });
}
function loadState(id) {
  const snap = {};
  for (const entry of rows) { try { snap[entry[0]] = JSON.parse(entry[1]); } catch (e) {} }
  return ack(id, { ok: true, snapshot: snap });
}
let closed = false;
function handle(msg) {
  const id = msg && msg.id;
  const type = msg && msg.type;
  try {
    if (closed) return fail(id, new Error('disposed'));
    if (type === REQ.PATCH) return applyPatch(id, msg.payload);
    if (type === REQ.SAVE) return saveState(id, msg.payload && msg.payload.snapshot);
    if (type === REQ.LOAD) return loadState(id);
    if (type === REQ.PING) return ack(id, { ok: true, pong: true });
    if (type === REQ.DISPOSE) return ack(id, { ok: true, disposed: true });
    return fail(id, new Error('unknown-type:' + String(type)));
  } catch (e) { return fail(id, e); }
}
self.onmessage = function (ev) {
  const msg = ev && ev.data;
  const res = handle(msg);
  self.postMessage(res);
  /* W3 · teardown：DISPOSE ack 已回包，随即关闭自身（幂等；后续消息不再接收） */
  if (msg && msg.type === REQ.DISPOSE) { closed = true; self.close(); }
};
self.postMessage({ type: RES.READY });
`;

/**
 * 浏览器 Worker/Blob/URL.createObjectURL 是否齐备？
 * 以 `typeof window !== 'undefined'` 作为「浏览器主线程」判据，确保 Node（`node:test`）
 * 一律走进程内降级路径（确定性，无 Worker 线程依赖）。
 */
export function isBrowserWorkerAvailable() {
  const hasApi = typeof Worker === 'function'
    && typeof Blob === 'function'
    && typeof URL !== 'undefined'
    && typeof URL.createObjectURL === 'function';
  const inBrowser = typeof window !== 'undefined';
  return hasApi && inBrowser;
}

/** 构造 file:// 可用的 classic Blob Worker URL（不可用 → null）。 */
export function createBlobWorkerUrl() {
  if (!isBrowserWorkerAvailable()) return null;
  const blob = new Blob([L9_WORKER_SRC], { type: 'text/javascript' });
  return URL.createObjectURL(blob);
}

/** 创建真实 Worker（classic Blob，**非 module**）；不可用 / 构造失败 → null（调用方降级）。 */
export function createRealWorker() {
  if (!isBrowserWorkerAvailable()) return null;
  let url = null;
  try {
    url = createBlobWorkerUrl();
    /* classic Blob worker：file:// 单文件形态下可加载（L7 实测；module worker 不可用） */
    return new Worker(url);
  } catch (e) {
    if (url && typeof URL.revokeObjectURL === 'function') { try { URL.revokeObjectURL(url); } catch (_e) { /* noop */ } }
    return null;
  }
}

/**
 * Worker 工厂（W2）：浏览器 → 真实 classic Blob Worker；否则 → 进程内等价骨架。
 * 名称保留（W1 调用点 / T-77 兼容）；协议与公共 API 不变。
 */
export function createWorkerSkeleton(store) {
  const real = createRealWorker();
  if (real) return real;
  return createInProcessWorker(store);
}

/**
 * PersistWorkerBridge：主线程 ↔ Worker 桥（模式切换 + 请求关联 + 超时降级）。
 * 降级红线：Worker 不可用 / 构造失败 / 超时 → 一律回落 syncFallback（功能不降级）。
 */
export class PersistWorkerBridge {
  constructor({ store, worker = null, mode = 'sync', timeoutMs = 5000 } = {}) {
    this.store = store;
    this.worker = worker || null;
    this.mode = (mode === 'worker' || mode === 'shadow') ? mode : 'sync';
    this.timeoutMs = timeoutMs;
    this.ready = false;
    this._id = 0;
    this._pending = new Map();
    /* W3 · 生命周期与观测位 */
    this.disposed = false;       /* dispose() 后置位（幂等基准） */
    this._terminated = false;    /* worker.terminate 幂等基准 */
    this.unknownResponses = 0;   /* 未知 id / 非关联响应计数（安全忽略） */
  }
  /** 挂接 Worker 消息入口（幂等） */
  async ensure() {
    if (this.worker) this.worker.onmessage = (ev) => this._onMessage(ev);
    return !!this.worker;
  }
  /** 三态切换（返回**有效**模式，对齐 L7 setIndexWorkerMode） */
  setMode(m) {
    this.mode = (m === 'worker' || m === 'shadow') ? m : 'sync';
    if (this.mode === 'sync') this.ready = false;
    return this.mode;
  }
  /** 请求：worker 态经 Worker；否则 / 超时 → syncFallback（post-dispose 一律 reject） */
  async request(type, payload) {
    if (this.disposed) throw new Error('bridge disposed');
    if (this.mode === 'sync' || !this.worker || typeof this.worker.postMessage !== 'function') {
      return createSyncFallback(this.store)({ type, payload });
    }
    const id = ++this._id;
    return new Promise((resolve) => {
      const fallback = () => { createSyncFallback(this.store)({ type, payload }).then(resolve); };
      const timer = setTimeout(() => { this._pending.delete(id); fallback(); }, this.timeoutMs);
      this._pending.set(id, { resolve, timer });
      try {
        this.worker.postMessage({ id, type, payload });
      } catch (e) {
        clearTimeout(timer);
        this._pending.delete(id);
        fallback();
      }
    });
  }
  /**
   * 响应关联（W3）：READY = 生命周期握手；其余按既有 `msg.id` 关联 `ack`/`result`/`error`
   * （三者同路径）；未知 id 或 post-dispose 尾包一律**安全忽略**并计数（不抛错、无未处理拒绝）。
   */
  _onMessage(ev) {
    const d = ev && ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === RES.READY) { this.ready = true; return; }
    const p = this._pending.get(d.id);
    if (!p) { this.unknownResponses++; return; }
    clearTimeout(p.timer);
    this._pending.delete(d.id);
    p.resolve(d);
  }
  /** 释放（终止 Worker + 摘监听 + 清理在途）；幂等 */
  terminate() {
    if (this._terminated) return this;
    this._terminated = true;
    if (this.worker && typeof this.worker.terminate === 'function') {
      try { this.worker.terminate(); } catch (e) { /* noop */ }
    }
    if (this.worker) this.worker.onmessage = null;   /* 摘监听器：无悬挂回调 */
    for (const p of this._pending.values()) clearTimeout(p.timer);
    this._pending.clear();
    this.ready = false;
    return this;
  }
  /**
   * W3 · DISPOSE：向 worker 投递 DISPOSE（等 ack / 超时兜底）→ release worker + 清在途 + 置 disposed。
   * **幂等**：第二次调用直接返回 `{ already:true }`（不重复投递、不重复 teardown）。
   */
  async dispose() {
    if (this.disposed) return { ok: true, disposed: true, already: true };
    this.disposed = true;
    let ack = null;
    if (this.worker && !this._terminated && typeof this.worker.postMessage === 'function') {
      const id = ++this._id;
      ack = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          this._pending.delete(id);
          resolve({ ok: false, error: 'dispose-timeout' });
        }, this.timeoutMs);
        this._pending.set(id, { resolve, timer });
        try {
          this.worker.postMessage({ id, type: REQ.DISPOSE, payload: null });
        } catch (e) {
          clearTimeout(timer);
          this._pending.delete(id);
          resolve({ ok: false, error: String((e && e.message) || e) });
        }
      });
    }
    this.terminate();   /* 释放 worker + 清在途定时器 + 摘监听 */
    return ack || { ok: true, disposed: true };
  }
}
