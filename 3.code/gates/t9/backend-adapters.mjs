/**
 * L9-W3 · 可插拔 mock 后端适配器（IDB-style / invoke-style · 行为契约等价）
 * ----------------------------------------------------------------------------
 * 设计依据：`reports/t9-design-2026-10-14.md` §五 5.2（通道层：新增 IDB 适配器 / `invoke` 族）
 *          + §3.4 C-1（本仓无 Rust/Tauri → 后端语义以 mock 等价验收，S-5 不新增依赖）
 *          + §3.4 C-2（`invoke` 形态以 mock 等价，不依赖 `window.__TAURI__`）
 *
 * 契约（S-1 同源 · 两适配器**行为等价**）：
 *   - `write(entries)`  entries:Array<{id:string,data:string}> → {ok,written}
 *   - `read(ids?)`      → {ok,rows:{id:data},missing:string[]}（ids 省略 = 全表）
 *   - `del(ids)`        → {ok,deleted:number}
 *   - `query({prefix})` → {ok,ids:string[],rows}
 *   - `transact(batch)` → {ok,seq,changed,deleted}（批形状校验复用 `persist-store.isBatch`）
 *   - `saveState(snapshot)` → {ok,rows}（原子替换，清孤儿行）
 *   - `rows()`          → Map<id,json>（同步投影面，供 `PersistStore.projection()`）
 *   - `setFailNext(n)` / `close()`（失败注入 / 关闭）
 *
 * 等价性保证：唯一语义实现（`_CoreBackend`）+ 两套传输层（IDB 异步请求 / invoke 命令信封）。
 *   错误**不包裹、不改写**（同一 Error 的 name 与 message 逐字一致）。
 *
 * 性质：影子层（shadow / 默认关闭）；零新依赖；不接线产品路径。
 */
import { isBatch } from './persist-store.mjs';

/** 适配器种类清单（顺序稳定，供 parity 用例断言） */
export const ADAPTER_KINDS = ['idb', 'invoke'];

/**
 * 唯一语义核心（两适配器共享）：read/write/delete/query + transact/saveState。
 * 单批 = 一次「事务」：先建缓冲、再原子换入（中途抛错 → 盘面无半批）。
 */
class _CoreBackend {
  constructor() {
    this._rows = new Map();   /* id → 单节点 JSON 串（与 InMemoryBackend 同构） */
    this.failNext = 0;        /* >0：接下来 N 次操作抛错（模拟后端不可用） */
    this.closed = false;      /* 关闭后一律拒绝 */
  }
  /* ── 契约面 ── */
  setFailNext(n) { this.failNext = Math.max(0, n | 0); return this; }
  close() { this.closed = true; return this; }
  _gate() {
    if (this.closed) throw new Error('adapter closed');
    if (this.failNext > 0) { this.failNext--; throw new Error('backend unavailable'); }
  }
  async write(entries) {
    this._gate();
    const buf = new Map();
    for (const e of entries || []) {
      if (!e || typeof e.id !== 'string' || typeof e.data !== 'string') throw new Error('invalid entry');
      buf.set(e.id, e.data);
    }
    for (const [k, v] of buf) this._rows.set(k, v);
    return { ok: true, written: buf.size };
  }
  async read(ids) {
    this._gate();
    const want = ids ? Array.from(ids) : Array.from(this._rows.keys());
    const rows = {}; const missing = [];
    for (const id of want) {
      if (this._rows.has(id)) rows[id] = this._rows.get(id);
      else missing.push(id);
    }
    return { ok: true, rows, missing };
  }
  async del(ids) {
    this._gate();
    let n = 0;
    for (const id of ids || []) { if (this._rows.delete(id)) n++; }
    return { ok: true, deleted: n };
  }
  async query(opts) {
    this._gate();
    const o = opts || {};
    const prefix = typeof o.prefix === 'string' ? o.prefix : null;
    const ids = Array.from(this._rows.keys()).filter((id) => !prefix || id.indexOf(prefix) === 0).sort();
    const rows = {};
    for (const id of ids) rows[id] = this._rows.get(id);
    return { ok: true, ids, rows };
  }
  /** 单批事务（缓冲 → 原子换入）；批形状校验与 `persist-store.isBatch` 同源 */
  async transact(batch) {
    this._gate();
    if (!isBatch(batch)) throw new Error('invalid batch shape');
    const buf = new Map();
    for (const it of batch.changed || []) buf.set(it.id, it.data);
    const dels = (batch.deleted || []).slice();
    for (const [k, v] of buf) this._rows.set(k, v);
    for (const id of dels) this._rows.delete(id);
    return { ok: true, seq: batch.seq | 0, changed: (batch.changed || []).length, deleted: dels.length };
  }
  /** 全量 checkpoint（原子替换：含清孤儿行） */
  async saveState(snapshot) {
    this._gate();
    const nodes = (snapshot && snapshot.nodes) || {};
    const next = new Map();
    for (const id of Object.keys(nodes)) next.set(id, JSON.stringify(nodes[id]));
    this._rows = next;
    return { ok: true, rows: next.size };
  }
  rows() { return new Map(this._rows); }
}

/**
 * IDB-style 适配器：每次操作 = 一个异步「请求」（微任务调度），语义对齐 IDB 异步事务。
 */
export class IdbStyleAdapter {
  constructor() { this.kind = 'idb'; this._core = new _CoreBackend(); }
  /** 异步请求包装（模拟 IDB request → onsuccess/onerror） */
  _request(fn) { return Promise.resolve().then(() => fn()); }
  write(entries) { return this._request(() => this._core.write(entries)); }
  read(ids) { return this._request(() => this._core.read(ids)); }
  del(ids) { return this._request(() => this._core.del(ids)); }
  query(opts) { return this._request(() => this._core.query(opts)); }
  transact(batch) { return this._request(() => this._core.transact(batch)); }
  saveState(snapshot) { return this._request(() => this._core.saveState(snapshot)); }
  rows() { return this._core.rows(); }
  setFailNext(n) { this._core.setFailNext(n); return this; }
  close() { this._core.close(); return this; }
}

/**
 * invoke-style 适配器：每次操作 = 一条命令（`l9_*`），参数经 JSON 线上往返后派发。
 * 与 IDB-style 共享同一语义核心 → 结果与错误形状逐字一致。
 */
export class InvokeStyleAdapter {
  constructor() { this.kind = 'invoke'; this._core = new _CoreBackend(); this.calls = []; }
  /** 命令信封（参数序列化往返：防引用共享，模拟跨边界调用） */
  _invoke(cmd, args) {
    this.calls.push({ cmd });
    const wire = args === undefined ? {} : JSON.parse(JSON.stringify(args));
    return Promise.resolve().then(() => this._dispatch(cmd, wire));
  }
  _dispatch(cmd, wire) {
    const c = this._core;
    switch (cmd) {
      case 'l9_write': return c.write(wire.entries);
      case 'l9_read': return c.read(wire.ids);
      case 'l9_delete': return c.del(wire.ids);
      case 'l9_query': return c.query(wire.opts);
      case 'l9_transact': return c.transact(wire.batch);
      case 'l9_save_state': return c.saveState(wire.snapshot);
      default: throw new Error('unknown command: ' + String(cmd));
    }
  }
  write(entries) { return this._invoke('l9_write', { entries }); }
  read(ids) { return this._invoke('l9_read', { ids }); }
  del(ids) { return this._invoke('l9_delete', { ids }); }
  query(opts) { return this._invoke('l9_query', { opts }); }
  transact(batch) { return this._invoke('l9_transact', { batch }); }
  saveState(snapshot) { return this._invoke('l9_save_state', { snapshot }); }
  rows() { return this._core.rows(); }
  setFailNext(n) { this._core.setFailNext(n); return this; }
  close() { this._core.close(); return this; }
}

/** 工厂（可插拔接缝）：kind='idb' | 'invoke' */
export function createAdapter(kind, opts) {
  if (kind === 'idb') return new IdbStyleAdapter(opts);
  if (kind === 'invoke') return new InvokeStyleAdapter(opts);
  throw new Error('unknown adapter kind: ' + String(kind));
}
