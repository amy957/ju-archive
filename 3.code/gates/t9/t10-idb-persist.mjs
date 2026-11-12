/**
 * L10-W3 · D-1「持久层落地收口」主模块（N 层可导入 · mock 后端 + 失败/降级 + 旧库迁移）
 * ============================================================================
 * 设计依据：`reports/t10-design-2026-10-15.md` §十三 W3 行（主线**实现 + mock 后端 + 失败/降级**；
 *          适配器 parity 复跑）；接缝契约见 `tests/t10-idb-persist.spec.ts`（W2 冻结 ①②③）。
 *
 * 接缝面（与 W2 接缝契约同源 · drop-in · 不改支柱语义）：
 *   version        'l10-d1/v1'
 *   kind           后端种类（idb / invoke）
 *   backend        通道层（复用 backend-adapters：transact/saveState/rows/setFailNext/close）
 *   store          L9 PersistStore 实例（注入 backend）
 *   buildPersistBatch(dirtyNodes, removedIds) → {reason, batches}    组批层（复用 L9 形状）
 *   applyBatch(batch)   → Promise<{ok, ack?, replay?}>               注入缝方法 1
 *   flushNow(snapshot)  → Promise<{ok}>                              注入缝方法 2
 *   projection()        → Map<id, json>                              注入缝方法 3
 *   probeTransact(batch)→ Promise<{ok, ack?} | {ok:false, error}>    失败/降级面（透传后端错误形状）
 *   migrateLegacy(raw)  → Promise<{ok, migrated, already?, ids}>     旧库迁移（幂等）
 *
 * 失败/降级：`setFailNext(1)` 与 `close()` 均使事务失败；两者错误经 `errShape` 统一为
 *   `{name, message}` 形状（W3 退出判据：降级路径可测）。
 *
 * 性质：N 层可导入的「主模块实现 + mock 后端」；不改产品 HTML；仅只读依赖既有 L9 支柱。
 */
import {
  PersistStore, InMemoryBackend, buildPersistBatch, isBatch, equalProjection, L9_PATCH_MAX,
} from './persist-store.mjs';
import { createAdapter, IdbStyleAdapter, InvokeStyleAdapter } from './backend-adapters.mjs';

export const L10_SEAM_VERSION = 'l10-d1/v1';
export { buildPersistBatch, isBatch, equalProjection, L9_PATCH_MAX };

/** 统一错误形状（失败 / 降级路径 → 同 {name, message}） */
export function errShape(e) {
  return { name: (e && e.name) || 'Error', message: String((e && e.message) != null ? e.message : e) };
}

/**
 * 旧库迁移（localStorage 整包 → 逐 id 分行）。
 * 幂等：全部 id 已在投影中 → { already:true, migrated:false }，不改写投影。
 */
export async function migrateLegacy(store, rawJsonOrObject) {
  const obj = typeof rawJsonOrObject === 'string' ? JSON.parse(rawJsonOrObject) : (rawJsonOrObject || {});
  const nodes = (obj && obj.nodes) ? obj.nodes : obj;
  const ids = Object.keys(nodes || {});
  const existing = store.projection();
  if (ids.length > 0 && ids.every((id) => existing.has(id))) {
    return { ok: true, migrated: false, already: true, ids };
  }
  const res = await store.flushNow({ nodes });
  return { ok: !!res.ok, migrated: !!res.ok, already: false, ids };
}

/** 组装 D-1 接缝面（默认 mock idb 后端） */
export function createSeam({ kind = 'idb', backend = null } = {}) {
  const be = backend || createAdapter(kind);
  const store = new PersistStore({ backend: be });
  return {
    version: L10_SEAM_VERSION,
    kind: be.kind || kind,
    backend: be,
    store,
    buildPersistBatch,
    applyBatch: (batch) => store.applyBatch(batch),
    flushNow: (snapshot) => store.flushNow(snapshot),
    projection: () => store.projection(),
    snapshot: () => store.snapshot(),
    stats: () => store.stats(),
    /** 失败 / 降级面：直接透传后端错误（不吞），统一为 {name,message} */
    async probeTransact(batch) {
      try { const ack = await be.transact(batch); return { ok: true, ack }; }
      catch (e) { return { ok: false, error: errShape(e) }; }
    },
    migrateLegacy: (raw) => migrateLegacy(store, raw),
  };
}

/** 便捷：内存后端接缝（N 层单测常用；InMemoryBackend 支持 crashBeforeCommit 崩溃注入） */
export function createMemorySeam() {
  return createSeam({ backend: new InMemoryBackend() });
}

export { IdbStyleAdapter, InvokeStyleAdapter, InMemoryBackend, PersistStore };
