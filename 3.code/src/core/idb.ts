/**
 * D-01 · IndexedDB 持久化镜像（方案 A：恢复 IDB 写入 + 保留 localStorage 兜底）
 * ------------------------------------------------------------
 * 缺陷背景（90过程材料/_报告与元数据/v2.1-缺陷对比报告-2026-10-26.md）：
 *   v2.1 运行期 `indexedDB.databases()` 返回 `[]`，脚本内 `indexedDB` 命中 0 次；
 *   仅 `localStorage["juju.store.v31"]`（约 2.5 KB）落盘。v2.0-t3 有 9 处 IDB 引用。
 *   结论：Vite 重建（TS 多模块拆分）时未迁移 L9/IDB 持久化适配层。
 *
 * 本方案（ADR 见 docs/M1-1-ARCH-DECISION.md「ADR-D01」）：
 *   · **写入**：`runPersist()` 明文分支成功写 localStorage 之后，追加一次 IDB 镜像写入
 *     （`juju.store` 库 / `kv` 对象仓 / `state` 键，值为 `{ json, updatedAt }`）。
 *   · **兜底**：localStorage 仍是**唯一权威读路径**（`loadState()` 未改动），
 *     IDB 只是第二副本 —— 任一后端不可用都不影响启动与落盘主链路。
 *   · **不镜像加密模式**：加密分支（`ui.encrypted`）只写密文到既有密文后端，
 *     绝不把明文镜像到 IDB（避免绕过加密）。
 *   · **可观测**：`getIdbMirrorStatus()` / `idbListDatabases()` / `idbReadState()`
 *     供验收断言与人工恢复使用（`window.JU.persistence` 暴露，见 src/main.ts）。
 *
 * 安全/稳定性约束：
 *   1) 所有 API 失败一律「返回判空值 + 记录 lastError」，不抛异常给调用方；
 *   2) 每次操作带超时（IDB_TIMEOUT_MS）：隐私模式 / 宿主禁用 IDB 时不会拖住 300ms 落盘链；
 *   3) 连接用完即关（`db.close()`），不做长连接持有，避免升级阻塞（onblocked）。
 */

/** IDB 数据库名（验收断言以此为准） */
export const IDB_NAME = 'juju.store';
/** IDB schema 版本 */
export const IDB_VERSION = 1;
/** 对象仓名 */
export const IDB_STORE_NAME = 'kv';
/** 状态快照键 */
export const IDB_STATE_KEY = 'state';
/** 单次 IDB 操作超时（ms） */
export const IDB_TIMEOUT_MS = 3000;

/** IDB 镜像写入状态（诊断 / 验收断言用） */
export interface IdbMirrorStatus {
  /** 宿主是否提供 indexedDB */
  supported: boolean;
  /** 最近一次写入尝试时刻（0 = 从未） */
  lastAttemptAt: number;
  /** 最近一次成功写入时刻（0 = 从未） */
  lastOkAt: number;
  /** 最近一次写入是否成功 */
  lastOk: boolean;
  /** 成功写入次数 */
  writes: number;
  /** 失败次数 */
  failures: number;
  /** 最近一次错误文本（空串 = 无错误） */
  lastError: string;
}

const _status: IdbMirrorStatus = {
  supported: false,
  lastAttemptAt: 0,
  lastOkAt: 0,
  lastOk: false,
  writes: 0,
  failures: 0,
  lastError: '',
};

/** 当前 IDB 镜像状态快照（浅拷贝，外部改动不影响内部）。 */
export function getIdbMirrorStatus(): IdbMirrorStatus {
  return { ..._status, supported: isIdbSupported() };
}

/** 宿主是否支持 indexedDB（隐私模式 / 禁用存储时返回 false）。 */
export function isIdbSupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && !!indexedDB && typeof indexedDB.open === 'function';
  } catch (e) {
    return false;
  }
}

/** Promise 超时包装：超时返回 fallback，绝不挂起调用方。 */
function _withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      _status.lastError = _status.lastError || 'idb timeout';
      resolve(fallback);
    }, ms);
    p.then((v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    }).catch((e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      _status.lastError = String((e && (e as any).message) || e);
      resolve(fallback);
    });
  });
}

/** 打开数据库（首次自动建库建仓）；失败返回 null。 */
export function idbOpen(): Promise<IDBDatabase | null> {
  if (!isIdbSupported()) return Promise.resolve(null);
  const opening = new Promise<IDBDatabase | null>((resolve) => {
    let req: IDBOpenDBRequest | null = null;
    try {
      req = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch (e) {
      _status.lastError = String((e && (e as any).message) || e);
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      try {
        const db = req!.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) db.createObjectStore(IDB_STORE_NAME);
      } catch (e) {
        _status.lastError = String((e && (e as any).message) || e);
      }
    };
    req.onsuccess = () => resolve(req!.result);
    req.onerror = () => {
      _status.lastError = String((req!.error && req!.error.message) || req!.error || 'open failed');
      resolve(null);
    };
    req.onblocked = () => {
      _status.lastError = 'idb blocked（其它标签页持有旧版本连接）';
      resolve(null);
    };
  });
  return _withTimeout(opening, IDB_TIMEOUT_MS, null);
}

/** 写入一个键（value 可为任意可结构化克隆的值）。 */
export async function idbPut(key: string, value: any): Promise<boolean> {
  _status.lastAttemptAt = Date.now();
  const db = await idbOpen();
  if (!db) {
    _status.lastOk = false;
    _status.failures += 1;
    return false;
  }
  const writing = new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      tx.objectStore(IDB_STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        _status.lastError = String((tx.error && tx.error.message) || tx.error || 'tx error');
        resolve(false);
      };
      tx.onabort = () => {
        _status.lastError = _status.lastError || 'tx abort';
        resolve(false);
      };
    } catch (e) {
      _status.lastError = String((e && (e as any).message) || e);
      resolve(false);
    }
  });
  const ok = await _withTimeout(writing, IDB_TIMEOUT_MS, false);
  try { db.close(); } catch (e) { /* 已关闭：忽略 */ }
  if (ok) {
    _status.lastOk = true;
    _status.lastOkAt = Date.now();
    _status.writes += 1;
  } else {
    _status.lastOk = false;
    _status.failures += 1;
  }
  return ok;
}

/** 读取一个键；缺失或失败返回 null。 */
export async function idbGet(key: string): Promise<any> {
  const db = await idbOpen();
  if (!db) return null;
  const reading = new Promise<any>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const req = tx.objectStore(IDB_STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result == null ? null : req.result);
      req.onerror = () => {
        _status.lastError = String((req.error && req.error.message) || req.error || 'get error');
        resolve(null);
      };
    } catch (e) {
      _status.lastError = String((e && (e as any).message) || e);
      resolve(null);
    }
  });
  const value = await _withTimeout<any>(reading, IDB_TIMEOUT_MS, null);
  try { db.close(); } catch (e) { /* 已关闭：忽略 */ }
  return value;
}

/**
 * 把一次成功落盘的 **明文快照串** 镜像进 IDB（`runPersist` 明文分支调用）。
 * 返回 true 仅表示镜像成功；镜像失败不影响 localStorage 主链路的成功判定。
 */
export function idbMirrorState(json: string): Promise<boolean> {
  return idbPut(IDB_STATE_KEY, { json: String(json || ''), updatedAt: Date.now() });
}

/** 从 IDB 读回最近一次镜像的状态对象（缺失 / 解析失败返回 null，人工恢复与验收用）。 */
export async function idbReadState(): Promise<any> {
  const rec = await idbGet(IDB_STATE_KEY);
  if (!rec || typeof rec.json !== 'string') return null;
  try {
    return JSON.parse(rec.json);
  } catch (e) {
    _status.lastError = 'idb state json parse failed';
    return null;
  }
}

/** 列出当前源下全部 IDB 库名（`indexedDB.databases()` 不可用时返回空数组）。 */
export async function idbListDatabases(): Promise<string[]> {
  try {
    const anyIdb: any = indexedDB as any;
    if (!anyIdb || typeof anyIdb.databases !== 'function') return [];
    const list = await anyIdb.databases();
    return Array.isArray(list) ? list.map((d: any) => String(d && d.name)) : [];
  } catch (e) {
    _status.lastError = String((e && (e as any).message) || e);
    return [];
  }
}
