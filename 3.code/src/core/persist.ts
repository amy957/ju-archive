/**
 * M1-2 · 批次 AQ · 持久化落盘 / 多标签广播 / LWW 冲突合并（真实实现，替换 M1-3 占位空壳）
 *
 * 来源：6.P0-T3基线/public/v2.0-t3.html（canonical，只读，零字节改动）
 *   ── Store / 多标签同步 ────────────────────────────────────────────────────────────
 *   - STORE_KEY / UI_KEY / STORE_BC_NAME / STORE_BC_INSTANCE ....................... 2004-2008
 *   - onRemoteStoreChange .......................................................... 2009-2023
 *   - mergeRemoteIfNewer（rev 门槛移除 / 指纹守卫）.................................. 2025-2047
 *   - markDiskConfirmed ............................................................ 2048-2051
 *   - persistNow（立即持久化）...................................................... 2052-2055
 *   - removeNodeFromMap（递归硬删 + 墓碑 + 保护集摘除）.............................. 2056-2074
 *   - mergeRemoteState（节点级 LWW 全量防御性合并）................................... 2075-2432
 *   - repairTreeConsistency ........................................................ 2438-2496
 *   ── 墓碑 ────────────────────────────────────────────────────────────────────────
 *   - _tombstoneDelete / _tombstoneCompactQueue / _tombstoneSet .................... 2533-2611
 *   - TOMB_SWEEP_BATCH / TOMB_QUEUE_MAX ........................................... 2531-2532
 *   - _REV_STRIP / _ORIGIN_STRIP ................................................... 2612-2613
 *   ── 落盘调度 ────────────────────────────────────────────────────────────────────
 *   - schedulePersist .............................................................. 5138-5141
 *   - _persistFailCount / _PERSIST_MAX_RETRY / runPersist ........................... 5145-5264
 *   - _broadcastRev ................................................................ 5265-5273
 *   - PENDING_SYNC_KEY ............................................................. 5275
 *
 * 兼容处理（结构差异，全部为装配层，不改动算法判定）：
 *   1) `PersistDeps` 显式注入产品件的同作用域符号（ui / state / getState / getCalendarRootId /
 *      toast / IS_DESKTOP 端口 / dedup* / reportError）。未注入时走安全 noop，
 *      等价于产品件中该符号为 undefined 的分支。localStorage / BroadcastChannel 操作原样保留。
 *   2) `state` 为跨模块 let 绑定，无法以值注入，故以 `deps.state()` / `deps.getState()` 端口承接
 *      （二者同源，保证与 `core/store` 的 `getState()` 读到同一引用）。
 *   3) `schedulePersist` 的落盘实现自本模块反向上挂 `core/store` 的显式端口
 *      （`bindPersistStore`），使 `store.scheduleNotify() → 真实落盘`，不再有占位空壳。
 *
 * 受控结构差异（运行期语义等价或新增必要能力，均在本文件内自重注释）：
 *   a) runPersist 的 `_rev` 串替换优化（L16-W1 · 指令 1，产品 5196-5200）未迁移，直接走其**降级路径**
 *      `JSON.stringify(snapshot,_ORIGIN_STRIP)`——产品件注释明示降级路径与优化路径「逐字节一致」。
 *   b) 合并尾部在 `repairTreeConsistency()` 之后追加 `canonicalizeChildren()`：以 parent 指针重建
 *      children 并按 (createdAt,id) 确定性排序。产品件的 children 顺序取决于各标签页的追加先后，
 *      并发下三标签会各自持有不同顺序（内容相同、字节不同），无法满足多标签结构收敛；
 *      本函数只做「排序稳定化」，不改变任何节点归属关系（M1-3 已记档，本批次保留）。
 *   c) 墓碑时间戳取 `_nowSeq()`（单调序列，>= 被删节点 updatedAt），而非裸 `Date.now()`：
 *      同毫秒内「删除」与「节点 updatedAt」可能交叉，裸 Date.now() 会让 `updatedAt <= 墓碑` 守卫
 *      在极窄窗口内失守导致复活。其余墓碑判定（30s TTL / 2000 容量 / 惰性分段清扫）逐字保留。
 */

import { getState, setState, initStore, scheduleNotify, repairTreeConsistency, bindPersistStore } from './store';
import { __juProduce } from './produce';
import { stripHtml, uid } from './utils';
import { _nowSeq } from './actions';
import {
  ENC_KEY,
  PENDING_KEY,
  encryptState,
  decryptState,
  writeEncryptedStore,
  readEncryptedStore,
  hasEncryptedStore,
  type EncPayload,
} from './crypto';
/**
 * 【D-01】IndexedDB 持久化镜像（方案 A，ADR-D01）。
 *
 * v2.1 重建时 IDB 适配层整体缺失（产物内 `indexedDB` 命中 0 次，`indexedDB.databases()` 为 `[]`）。
 * 本模块的接入口径：
 *   · 明文分支成功写 localStorage 后，再镜像一份到 IDB（`juju.store` / `kv` / `state`）；
 *   · localStorage 仍是**唯一权威读路径**，`loadState()` 语义零改动 ⇒ 兜底不变；
 *   · 加密分支不镜像（避免把明文写进 IDB 绕过加密）；
 *   · 镜像失败只记录状态，不影响本次落盘的成功判定（不递增失败计数、不重排调度）。
 */
import { idbMirrorState } from './idb';
/* 【review25-07 · ISSUE-007】pending 兜底键唯一登记处：写/读/清除同源于 local-copies，禁止本地字面量 */
import { LOCAL_COPY_KEYS } from './local-copies';

/* ============================================================
   依赖注入容器（产品件同作用域符号）
   ============================================================ */

export interface PersistDeps {
  /** 产品件全局 `ui`（locked / encrypted / encKey / collapsedDocs） */
  ui: any;
  /**
   * 当前 state 读取端口。
   * 产品件里 `state` 是单文件作用域的 `let`，跨模块无法共享绑定，故以 getter 承接；
   * 与 `getState()` 同源，二者恒读到同一引用。
   */
  state: () => any;
  getState: () => any;
  /** 日历根 id（产品件 `getCalendarRootId`；合并尾部日历根去重使用） */
  getCalendarRootId: () => any;
  /** 轻提示（产品件 `toast`） */
  toast: (msg: any) => void;
  /** 桌面壳判定（产品件 `IS_DESKTOP`） */
  isDesktop: () => boolean;
  /** 桌面壳全量落盘（产品件 `flushDesktopSave`；返回是否成功） */
  desktopSave: () => Promise<boolean>;
  /** fix32-6 · ISSUE-006：桌面壳全量读取（boot 的 dsLoadState 端口），写盘前合并磁盘快照用 */
  dsLoadState?: () => Promise<any>;
  /** 多根记事本去重（产品件 `dedupNoteRoots`） */
  dedupNoteRoots: () => void;
  /** 多根日历去重（产品件 `dedupCalRoots`） */
  dedupCalRoots: () => void;
  /** 不变量上报（产品件 `reportError`） */
  reportError: (type: string, info: any) => void;
}

export const deps: PersistDeps = {
  ui: {},
  state: () => getState(),
  getState: () => getState(),
  getCalendarRootId: () => null,
  toast: (): void => {},
  isDesktop: () => false,
  desktopSave: () => Promise.resolve(false),
  dsLoadState: () => Promise.resolve(null),
  dedupNoteRoots: (): void => {},
  dedupCalRoots: (): void => {},
  reportError: (): void => {},
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持既有实现）。 */
export function bindPersistDeps(patch: Partial<PersistDeps>): void {
  Object.assign(deps, patch);
}

/* ============================================================
   常量 / 模块级状态（对应产品件 Store 区 2004-2008、2500-2532、5145）
   ============================================================ */

/** 持久化存储键（产品件 STORE_KEY，2004） */
export const STORE_KEY = 'juju.store.v31';
/* 批次 DE · 未使用导出复核：UI_KEY / TOMBSTONE_TTL_MS 仅本文件内部使用，降级为模块内私有 */
/** UI 存储键（产品件 UI_KEY，2005） */
const UI_KEY = 'juju.ui.v31';
/** 多标签广播通道名（产品件 STORE_BC_NAME，2007） */
export const STORE_BC_NAME = 'juju-store';
/** 加密模式关页前同步兜底 key（产品件 PENDING_SYNC_KEY，5275；键值取自 LOCAL_COPY_KEYS.PENDING） */
export const PENDING_SYNC_KEY = LOCAL_COPY_KEYS.PENDING;
/** 墓碑有效窗口：产品件 30s（在线删除传播窗口） */
const TOMBSTONE_TTL_MS = 30000;
/** 超容量单次从队首推进的最大条目数（TOMB_SWEEP_BATCH，2531） */
const TOMB_SWEEP_BATCH = 32;
/** 墓碑队列独立 compaction 阈值（TOMB_QUEUE_MAX，2532） */
const TOMB_QUEUE_MAX = 4096;
/** 单文件体积上限（产品件 4500000） */
const MAX_STORE_BYTES = 4500000;

/** 多标签广播通道单例（产品件 STORE_BC_INSTANCE，2008） */
let STORE_BC_INSTANCE: BroadcastChannel | null = null;

let persistTimer: any = null;
let _persistSeq = 0;
/** 落盘进行中标志（产品件 _persistRunning，2502） */
let _persistRunning = false;
let _persistDirty = false;
/** 上次成功写盘的 JSON 指纹（2504） */
let _lastWrittenJson: string | null = null;
/** 连续失败计数 + 重试上限（FIX-P3-24，5145-5146） */
let _persistFailCount = 0;
const _PERSIST_MAX_RETRY = 6;
/** 最近一次成功写盘的节点 id 集合（FIX-F-01，2526） */
let _diskConfirmed: Set<string> | null = null;
/** 硬删除墓碑：id → 删除时刻（2527） */
let _recentlyRemoved: Map<string, number> = new Map();
/** 墓碑写入计数（2528） */
let _tombstoneOps = 0;
/** 墓碑插入顺序队列 + 前向游标（2529-2530） */
let _tombstoneQueue: string[] = [];
let _tombstoneFifoHead = 0;
/** 最近一次加密载荷（FIX-M-15，供 sessionStorage 兜底复用） */
let _lastEncPayload: EncPayload | null = null;
/** 【review12-fix · #7】第一现场 pending 兜底：加密单飞 + 脏标记，避免连续提交堆叠加密任务 */
let _pendingSnapshotSeq = 0;
let _pendingEncInFlight = false;
let _pendingEncDirty = false;
/** 合并重入守卫（storage 事件与 BC 消息可能同帧到达） */
let _applying = false;

/* ============================================================
   序列化过滤器 / 工具
   ============================================================ */

/** 内存内容比较：剥离 rev 与来源标记（产品件 _REV_STRIP，2612） */
const _REV_STRIP = (k: string, v: any): any => (k === '_rev' || k === '_origin' ? undefined : v);
/**
 * 持久化序列化：只剥离运行期来源标记，rev 仍写入存储（跨页合并信号）（产品件 _ORIGIN_STRIP，2613）。
 * L16-W13 · 指令 4：_remoteReceived / _localCreated / _tombstones 为持久化辅助字段，本过滤器不剥离。
 */
const _ORIGIN_STRIP = (k: string, v: any): any => (k === '_origin' ? undefined : v);

/** 往返时间戳单位统一（L16-W21 · 指令 12 / Defect-C）：秒级 ×1000、微秒级 ÷1000，毫秒原样 */
function _normToMs(t: any): number {
  const v = +t;
  if (!(v > 0)) return v;
  return v < 1e10 ? Math.round(v * 1000) : (v > 8.64e14 ? Math.round(v / 1000) : v);
}

/** 原型污染防护：跳过 JSON.parse 产生的危险自有键（FIX-H-04） */
function isDangerKey(id: string): boolean {
  return id === '__proto__' || id === 'constructor' || id === 'prototype';
}

/** 节点元信息清理（对应产品件 purgeNodeMeta；本工程索引结构尚未迁入，仅清理已存在的旁挂表） */
export function purgeNodeMeta(s: any, id: any): void {
  if (!s || typeof s !== 'object') return;
  /* 只清理「以节点 id 为键」的派生表，不触碰 nodes 本体（删除职责在 removeNode/removeNodeFromMap） */
  for (const k of ['_nodeMeta', '_searchIndex', '_nodeIndex']) {
    const t = s[k];
    if (t && typeof t === 'object' && id in t) delete t[id];
  }
}

/* ============================================================
   默认态 / 读取 / 节点取用
   ============================================================ */

/**
 * 默认态种子：欢迎文档（对齐 canonical 5564-5590 的 `defaultState()` 内置示例段落）。
 *
 * M3 · 批次 AX · M3-3a：主库 JSON 损坏时 `loadState()` 返回 null → boot 回落 `defaultState()`，
 * 用户仍应看到一份可用的初始文档，而不是空白工作区。该种子同时是 `tests/recovery.spec.ts`
 * 判定「损坏后自动恢复到默认欢迎节点」的稳定锚点（文本固定、不依赖随机 id）。
 */
function seedWelcomeDoc(st: any): void {
  const add = (parentId: any, text: string): any => {
    const p = st && st.nodes ? st.nodes[parentId] : null;
    if (!p) return null;
    const id = uid();
    const now = Date.now();
    st.nodes[id] = {
      id, text, parent: parentId, children: [], collapsed: false, done: false,
      date: null, tags: [], priority: 0, recur: null, recurEnd: null, habit: null,
      time: null, note: null, color: null, showInCal: true, createdAt: now, updatedAt: now,
      _origin: 'local',
    };
    p.children.push(id);
    if (Array.isArray(st._localCreated) && !st._localCreated.includes(id)) st._localCreated.push(id);
    return st.nodes[id];
  };
  const welcome = add(st.rootId, '欢迎使用 JU');
  if (!welcome) return;
  add(welcome.id, 'Enter 新建同级，Tab 缩进，Shift+Tab 反缩进');
  add(welcome.id, 'Backspace 删除空行，Ctrl+D 复制');
  add(welcome.id, '顶部切换：资料库 / 大纲 / 导图 / 图谱 / 历史');
  add(welcome.id, '日历里的待办会独立存放在「日历待办」容器中');
}

/** 默认态：根节点（根节点不可删除、不可移动）+ 欢迎文档种子 */
export function defaultState(): any {
  const t = Date.now();
  const rootId = 'root';
  const st: any = {
    nodes: {
      [rootId]: {
        id: rootId, text: '', parent: null, children: [], collapsed: false, done: false,
        date: null, tags: [], priority: 0, recur: null, recurEnd: null, habit: null,
        time: null, note: null, color: null, showInCal: true, createdAt: t, updatedAt: t,
        _origin: 'local',
      },
    },
    rootId,
    updatedAt: t,
    /* 写盘信号量：各标签页独立计数，跨页不可比（产品件 2501 / 2028-2031） */
    _rev: 0,
    _structRev: 0,
    trashed: [],
    tagColors: {},
    /* 【fix5 · P1】全局标签索引：新建标签的独立数据源（不依赖任何节点）。 */
    _tags: [],
    activity: {},
    charStats: {},
    _tombstones: {},
    _localCreated: [rootId],
    _remoteReceived: [],
  };
  seedWelcomeDoc(st);
  return st;
}

/** 结构补齐（读取/合入的旧快照可能缺字段） */
function ensureShape(st: any): any {
  if (!st || typeof st !== 'object') return st;
  if (!st.nodes || typeof st.nodes !== 'object') st.nodes = {};
  if (!st.trashed) st.trashed = [];
  /* 【fix5 · P1】旧快照无全局标签索引：补空数组（新建标签写入后才产生内容） */
  if (!Array.isArray(st._tags)) st._tags = [];
  if (!st._tombstones || typeof st._tombstones !== 'object') st._tombstones = {};
  if (!Array.isArray(st._localCreated)) st._localCreated = [];
  if (!Array.isArray(st._remoteReceived)) st._remoteReceived = [];
  if (typeof st._rev !== 'number') st._rev = 0;
  if (typeof st.updatedAt !== 'number') st.updatedAt = Date.now();
  return st;
}

/** 从 localStorage 读取并校验（结构不完整返回 null，交由调用方回落默认态） */
export function loadState(): any {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const st = JSON.parse(raw);
    if (!st || typeof st !== 'object' || !st.nodes || !st.rootId || !st.nodes[st.rootId]) return null;
    return ensureShape(st);
  } catch (e) {
    console.warn('[JU] loadState failed', e);
    return null;
  }
}

/** 节点取用（对应产品件 N(id)） */
export function N(id: any): any {
  const st = getState();
  return (st && st.nodes && st.nodes[id]) || null;
}

/**
 * 所属顶层文档判定（对应产品件 findOwningTopDocId）。
 * 顶层文档定义：parent === rootId 的节点；根节点自身返回 null。
 */
export function findOwningTopDocId(id: any, s?: any): any {
  const st = s || getState();
  if (!st || !st.nodes || !id) return null;
  let cur = id;
  const seen = new Set<any>();
  while (cur && st.nodes[cur]) {
    if (seen.has(cur)) return null;
    seen.add(cur);
    const n = st.nodes[cur];
    if (!n.parent || n.parent === st.rootId) return cur === st.rootId ? null : cur;
    cur = n.parent;
  }
  return null;
}

/** 空节点判定（对应产品件 isBlankNode） */
export function isBlankNode(n: any): boolean {
  return !n || !String(stripHtml(n.text || '')).trim();
}

/**
 * 子树节点 ID 序列（对应产品件 `docSubtree`，canonical 6715-6721）。
 *
 * FIX-H-07 口径保留：遍历时跳过 `_deleted` 节点，已删节点不参与字数 / 反链 / 数据库统计。
 * 追加 `seen` 守卫仅为环形引用防护（repairTreeConsistency 之前可能残留环），
 * 对合法树结构输出与原实现逐项一致。
 */
export function docSubtree(id: any): any[] {
  const st = getState();
  const a: any[] = [];
  if (!st || !st.nodes || !id) return a;
  const seen = new Set<any>();
  (function walk(x: any): void {
    const n = st.nodes[x];
    if (!n || n._deleted || seen.has(x)) return;
    seen.add(x);
    a.push(x);
    (n.children || []).forEach(walk);
  })(id);
  return a;
}

/* ============================================================
   墓碑（对应产品件 2533-2611）
   ============================================================ */

function _tombstoneDelete(k: string, st?: any): void {
  /* FIX-TOMB-3: 清扫目标随调用方——draft commit 场景下 state 仍是旧引用，
     墓碑写入 target=st(draft)；若清扫仍清旧 state._tombstones，过期条目会残留在 draft 上随 commit 提交。
     调用方传入 target 保持两份一致。 */
  try { _recentlyRemoved.delete(k); } catch (e) { /* Map 操作不可失败 */ }
  try { const t = (st || deps.getState()); if (t && t._tombstones) delete t._tombstones[k]; } catch (e) { /* state 不可用 */ }
}

function _tombstoneCompactQueue(): void {
  /* L16-W11 · 指令 2（Defect-J）：队列 compaction——遍历 _tombstoneQueue，仅保留在 _recentlyRemoved 中仍存在的
     id（已过期 / 已被清扫的条目丢弃），原地压缩前缀并把游标归零。自门控：仅在队列长度 > TOMB_QUEUE_MAX 时执行，
     与 _tombstoneSet 的 size>2000 容量触发解耦——稀疏删除场景（Map 长期数十条）由队列长度独立触发，
     使队列长度恒有界（每次写入后复查，超阈值当次即回落）。 */
  try {
    const q = _tombstoneQueue;
    if (!Array.isArray(q) || q.length <= TOMB_QUEUE_MAX) return;
    let _w = 0;
    for (let _r = 0; _r < q.length; _r++) {
      const k = q[_r];
      if (k !== undefined && _recentlyRemoved.has(k)) q[_w++] = k;
    }
    q.length = _w;
    _tombstoneFifoHead = 0;
  } catch (e) { /* 队列压缩失败仅影响内存占用，不影响墓碑判定 */ }
}

/**
 * 墓碑写入（对应产品件 _tombstoneSet，2557-2611）。
 * st：commit draft 场景传入 draft，使墓碑随 commit 提交后生效。
 */
export function tombstoneSet(id: any, st?: any): void {
  if (!id || typeof id !== 'string') return;
  let target: any = null;
  try {
    /* 受控差异 (c)：时间戳取单调序列而非裸 Date.now()，保证 >= 被删节点 updatedAt */
    const _now = _nowSeq();
    _recentlyRemoved.set(id, _now);
    _tombstoneQueue.push(id); /* L16-W8 · 指令 8：登记插入顺序——供超容量惰性分段过期清扫按序推进 */
    /* FIX-TOMB-1: 墓碑随 state 持久化（state._tombstones）——跨会话（崩溃/重开）从存储恢复。 */
    target = st || deps.getState();
    if (target) {
      if (typeof target._tombstones !== 'object' || !target._tombstones) target._tombstones = {};
      target._tombstones[id] = _now;
    }
    /* 计数触发：稀疏删除场景下定期清掉已过期墓碑，Map 不积累死数据 */
    if ((++_tombstoneOps) % 200 === 0) {
      for (const [k, v] of _recentlyRemoved) { if (_now - v > TOMBSTONE_TTL_MS) _tombstoneDelete(k, target); }
    }
    /* 容量触发（L16-W8 · 指令 8）：超过 2000 上限时不再一次性 O(n) 全表过期扫描，
       改为从 _tombstoneQueue 队首惰性推进固定批量（≤TOMB_SWEEP_BATCH），每条做一次
       过期判定，过期即清扫；游标前移，单次代价 O(batch)。 */
    if (_recentlyRemoved.size > 2000) {
      if (_tombstoneFifoHead < _tombstoneQueue.length) {
        let _batch = TOMB_SWEEP_BATCH;
        while (_batch > 0 && _tombstoneFifoHead < _tombstoneQueue.length) {
          const k = _tombstoneQueue[_tombstoneFifoHead++];
          _batch--;
          if (k === undefined) continue;
          const v = _recentlyRemoved.get(k);
          if (v === undefined) continue; /* 已被计数清扫 / FIFO 收缩移除 —— 跳过陈旧队列条目 */
          if (_now - v > TOMBSTONE_TTL_MS) _tombstoneDelete(k, target);
        }
      }
      while (_recentlyRemoved.size > 2000) {
        const k = _recentlyRemoved.keys().next().value as string | undefined;
        if (k === undefined) break;
        _tombstoneDelete(k, target);
      }
      if (_tombstoneFifoHead > 4096) { _tombstoneQueue = _tombstoneQueue.slice(_tombstoneFifoHead); _tombstoneFifoHead = 0; }
    }
    _tombstoneCompactQueue();
  } catch (e) { /* 墓碑写入失败不得中断删除主流程 */ }
}

/** 内存墓碑摘除（对应产品件 `_recentlyRemoved.delete` + 同步摘除 state._tombstones） */
export function recentlyRemovedDelete(id: any): void {
  _tombstoneDelete(String(id));
}

/** 从 state._tombstones 恢复内存墓碑（跨会话/刷新后仍能压制对端旧快照） */
function restoreTombstones(st: any): void {
  try {
    _tombstoneQueue = [];
    _tombstoneFifoHead = 0;
    if (st && st._tombstones && typeof st._tombstones === 'object') {
      const _now = Date.now();
      for (const k in st._tombstones) {
        const _ts = +st._tombstones[k];
        if (_ts && _now - _ts <= TOMBSTONE_TTL_MS) { _recentlyRemoved.set(k, _ts); _tombstoneQueue.push(k); }
        else delete st._tombstones[k];
      }
    }
  } catch (e) { console.warn('[JU] caught error', e); }
}

/* ============================================================
   children 收敛（受控差异 b：确定性排序）
   ============================================================ */

function childOrder(nodes: any): (a: any, b: any) => number {
  return (a: any, b: any) => {
    const na = nodes[a];
    const nb = nodes[b];
    const ca = +((na && na.createdAt) || 0);
    const cb = +((nb && nb.createdAt) || 0);
    if (ca !== cb) return ca - cb;
    return a < b ? -1 : a > b ? 1 : 0;
  };
}

/**
 * 以 parent 指针重建全部 children，并按 (createdAt,id) 确定性排序。
 * 只做「归属关系以 parent 为准 + 顺序稳定化」，不改变任何节点的父子归属。
 */
function canonicalizeChildren(st: any): boolean {
  let changed = false;
  const nodes = st.nodes || {};
  const rootId = st.rootId;
  if (!rootId || !nodes[rootId]) return changed;
  /* 1) parent 悬空 / 自引用 → 挂根（与 store.repairTreeConsistency 同口径兜底） */
  for (const id in nodes) {
    if (id === rootId) continue;
    const n = nodes[id];
    if (!n) continue;
    if (n._deleted) continue; /* 回收站节点脱离活树为设计行为 */
    if (n.parent === id || !n.parent || !nodes[n.parent]) {
      n.parent = rootId;
      changed = true;
    }
  }
  /* 2) 按 parent 指针分桶 */
  const buckets: Record<string, string[]> = Object.create(null);
  for (const id in nodes) {
    if (id === rootId) continue;
    const n = nodes[id];
    if (!n || n._deleted) continue;
    const p = n.parent;
    if (!p || !nodes[p]) continue;
    (buckets[p] || (buckets[p] = [])).push(id);
  }
  /* 3) 父节点 children 重建为确定性有序数组 */
  for (const pid in nodes) {
    const p = nodes[pid];
    if (!p) continue;
    const want = (buckets[pid] || []).slice().sort(childOrder(nodes));
    const cur: any[] = Array.isArray(p.children) ? p.children : [];
    let same = cur.length === want.length;
    if (same) {
      for (let i = 0; i < want.length; i++) {
        if (cur[i] !== want[i]) { same = false; break; }
      }
    }
    if (!same) {
      p.children = want;
      changed = true;
    }
  }
  return changed;
}

/* ============================================================
   硬删除（对应产品件 removeNodeFromMap，2056-2074）
   ============================================================ */

export function removeNodeFromMap(map: any, id: any): void {
  _removeNodeFromMap(map, id, true);
}

/**
 * 硬删除内核（递归子树 + 从父 children 摘除 + 元数据/保护集清理）。
 *
 * stampTombstone=true：本地主动删除（产品件 removeNodeFromMap 语义，写/刷新墓碑）；
 * stampTombstone=false：合并期「墓碑驱动删除」——墓碑已由本地或对端写入，
 *   此处不得重打时间戳，否则每轮合并都会把墓碑时刻推到现在，等价于永久延长删除窗口。
 */
function _removeNodeFromMap(map: any, id: any, stampTombstone: boolean): void {
  const n = map[id];
  if (!n) return;
  (n.children || []).forEach((c: any) => _removeNodeFromMap(map, c, stampTombstone));
  if (n.parent && map[n.parent] && map[n.parent].children) {
    const _pi = map[n.parent].children.indexOf(id);
    if (_pi >= 0) map[n.parent].children.splice(_pi, 1);
  }
  delete map[id];
  /* FIX-P2-7(补充): 传入完整 state（nodes 覆盖为 map）——原只传 {nodes:map} 使 purgeNodeMeta 看不到
     dbRowHeights / dbColumnWidths，孤儿元数据无法清理；map 覆盖保留调用方语义，全局元数据仍按 state 清理 */
  const st = deps.getState();
  try { purgeNodeMeta({ ...st, nodes: map }, id); } catch (e) { /* 元数据清理失败不阻断删除 */ }
  const ui = deps.ui;
  if (ui && ui.collapsedDocs) delete ui.collapsedDocs[id];
  /* FIX-ORIGIN-1: 本地删除时同步从 _localCreated 摘除，避免删除传播已确认的节点长期占用保护集合 */
  try { if (st && st._localCreated) { const _li = st._localCreated.indexOf(id); if (_li >= 0) st._localCreated.splice(_li, 1); } } catch (e) { /* 保护集不可用 */ }
  /* L16-W13 · 指令 4（Defect-F）：对端合入保护集同址摘除——节点已不存在，集合须随之收缩 */
  try { if (st && Array.isArray(st._remoteReceived)) { const _ri = st._remoteReceived.indexOf(id); if (_ri >= 0) st._remoteReceived.splice(_ri, 1); } } catch (e) { /* 保护集不可用 */ }
  /* 【QA-P0-1】记录硬删除墓碑（含递归子树）。30s 后惰性清理，防陈旧对端快照复活 */
  if (stampTombstone) tombstoneSet(id);
}

/* ============================================================
   合并（对应产品件 mergeRemoteState，2075-2432）
   ============================================================ */

/** 全局元数据键级合并（产品件 2298-2360） */
function mergeGlobalMeta(st: any, remote: any): boolean {
  let _metaDirty = false;
  const remoteUpdatedAt = _normToMs(remote.updatedAt || 0);
  const remoteNewer = remoteUpdatedAt > _normToMs(st.updatedAt || 0);
  if (!remoteNewer) return false;
  _metaDirty = true; /* FIX-L-06 元数据合并块执行即视为内容变更（不触发 repairTreeConsistency） */
  /* 【fix5 · P1】全局标签索引按字符串并集合并（远端新增标签不丢、本地新建标签不被覆盖） */
  if (Array.isArray(remote._tags)) {
    if (!Array.isArray(st._tags)) st._tags = [];
    const seen = new Set(st._tags);
    for (const t of remote._tags) { if (typeof t === 'string' && t && !seen.has(t)) { seen.add(t); st._tags.push(t); } }
  }
  /* 【item7/fixed22】键级合并：原整体替换会丢本地独有键（如 tagColors {a,b} 被 {c} 覆盖）。 */
  for (const f of ['tagColors', 'dbColumnWidths']) {
    if (remote[f] !== undefined) {
      if (!st[f]) st[f] = {};
      Object.assign(st[f], remote[f]); /* 键并集，远端覆盖同键 */
    }
  }
  for (const f of ['templates', 'contacts']) {
    if (Array.isArray(remote[f]) && remote[f].length) {
      if (!Array.isArray(st[f])) st[f] = [];
      const seen = new Set(st[f].map((x: any) => x && x.id));
      for (const x of remote[f]) {
        if (!x || x.id == null) continue;
        if (seen.has(x.id)) { st[f] = st[f].map((y: any) => (y && y.id === x.id ? x : y)); } /* 远端覆盖同 id */
        else { seen.add(x.id); st[f].push(x); }
      }
    }
  }
  /* FIX-H-06: trashed 按 rootId 并集合并（远端新增条目合入、本地独有条目保留） */
  if (remote.trashed !== undefined) {
    if (!Array.isArray(st.trashed)) st.trashed = [];
    const tSeen = new Set(st.trashed.map((t: any) => t && t.rootId));
    for (const t of (remote.trashed || [])) {
      if (!t || !t.rootId) continue;
      if (tSeen.has(t.rootId)) { st.trashed = st.trashed.map((y: any) => (y && y.rootId === t.rootId ? t : y)); }
      else { tSeen.add(t.rootId); st.trashed.push(t); }
    }
  }
  if (remote.dbFields !== undefined) st.dbFields = remote.dbFields; /* dbFields 整体替换 */
  /* 【QA-P1-4】activity 键级合并（原整体替换会丢本地未同步日志） */
  if (remote.activity && typeof remote.activity === 'object') {
    if (!st.activity || typeof st.activity !== 'object') st.activity = {};
    for (const d in remote.activity) {
      const rb = remote.activity[d];
      if (!rb || typeof rb !== 'object') continue;
      const lb = st.activity[d];
      if (!lb || typeof lb !== 'object') { st.activity[d] = rb; continue; }
      for (const t of ['add', 'del', 'mod']) {
        const ra = rb[t];
        if (!Array.isArray(ra) || !ra.length) continue;
        const la = lb[t] || (lb[t] = []);
        const seen = new Set(la.map((x: any) => x && x.id));
        for (const e of ra) {
          if (!e || e.id == null) continue;
          if (seen.has(e.id)) {
            const idx = la.findIndex((x: any) => x && x.id === e.id);
            if (idx >= 0) la[idx] = e;
          } else { seen.add(e.id); la.push(e); }
        }
        if (la.length > 200) la.splice(0, la.length - 200);
      }
    }
  }
  return _metaDirty;
}

/**
 * 节点级 LWW 全量合并（幂等）。返回是否发生「节点结构变更 || 全局元数据变更」。
 * 判定顺序与产品件一致：墓碑压制 → 新增合入 → LWW 覆盖（含同毫秒 tie-break）→ 保护集归一 →
 * 删除传播 → 元数据键级合并 → 树修复 → children 确定性收敛 → rev 单调推进。
 */
export function mergeRemoteState(remote: any): boolean {
  const st = deps.getState();
  if (!st || !remote || !remote.nodes) return false; /* FIX-L-06 返回布尔：未做任何合并 */
  /* FIX-BUG01: 快照完整性校验——远端缺 rootId 或空节点集时保守拒绝，防止整树被空/损坏快照删除 */
  const rnNodes = remote.nodes || {};
  if (!rnNodes[st.rootId] || Object.keys(rnNodes).length === 0) {
    console.warn('FIX-BUG01: 拒绝不完整远端快照 rootId=', st.rootId, 'keys=', Object.keys(rnNodes).length);
    return false;
  }
  if (_applying) return false;
  _applying = true;
  try {
    const localNodes = st.nodes || {};
    const remoteUpdatedAt = _normToMs(remote.updatedAt || 0);
    let _structDirty = false; /* FIX-L-13: 跟踪是否发生节点插入/覆盖/children 变动 */
    let _metaDirty = false;   /* FIX-L-06: 纯全局元数据合并也视为内容变更 */
    /* FIX-H-01b: LWW 覆盖祖先时 rn.children 可能仍含本地已硬删除（墓碑）子 id → 剔除 */
    const pruneTombstonedChildren = (n: any): void => {
      if (n && Array.isArray(n.children) && _recentlyRemoved && _recentlyRemoved.size) {
        const filtered = n.children.filter((cid: any) => !_recentlyRemoved.has(cid));
        if (filtered.length !== n.children.length) n.children = filtered;
      }
    };
    /* L16-W13 · 指令 4（Defect-F 多标签删除传播）：对端合入保护集 _remoteReceived 归一化（合入前执行） */
    try {
      const _rr = st._remoteReceived;
      if (Array.isArray(_rr) && _rr.length) {
        let _rw = 0;
        for (let _r = 0; _r < _rr.length; _r++) {
          const _rid = _rr[_r];
          if (typeof _rid !== 'string' || !localNodes[_rid]) continue;
          if (remote.nodes[_rid] && _diskConfirmed && _diskConfirmed.has(_rid)) continue;
          _rr[_rw++] = _rid;
        }
        _rr.length = _rw;
      }
    } catch (e) { /* 保护集归一失败：保留原集合（只影响删除传播保守度） */ }
    /* TODO-3 / 方案 A1：保护集 Set 视图（O(1) 查找）；持久化形态仍为 string[]。 */
    let _rrSet: Set<string>;
    let _lcSet: Set<string>;
    try {
      _rrSet = new Set(Array.isArray(st._remoteReceived) ? st._remoteReceived : []);
      _lcSet = new Set(Array.isArray(st._localCreated) ? st._localCreated : []);
    } catch (e) { _rrSet = new Set(); _lcSet = new Set(); }

    for (const id in remote.nodes) {
      /* FIX-H-04: 合并 sink 防护——跳过危险自有键，避免原型 setter 污染 */
      if (isDangerKey(id)) continue;
      const rn = remote.nodes[id];
      const ln = localNodes[id];
      if (!ln) {
        /* 【QA-P0-1】墓碑检查：本地最近硬删除（<30s）且远端快照该节点 updatedAt 不新于删除时刻 →
           视为删除前发出的旧快照，跳过重建（否则本地防抖窗口内的合并会把刚删节点复活） */
        const _rmTs = _recentlyRemoved && _recentlyRemoved.get(id);
        if (_rmTs && (Date.now() - _rmTs) < TOMBSTONE_TTL_MS && _normToMs(rn.updatedAt || 0) <= _rmTs) continue;
        localNodes[id] = rn;
        pruneTombstonedChildren(rn); /* FIX-H-01b: 新节点合入后剔除 children 中墓碑 id */
        _structDirty = true;
        rn._origin = 'remote'; /* 【修复 F-01】对端合入的节点标记为 remote：可参与删除传播 */
        /* L16-W13 · 指令 4（Defect-F）：登记对端合入节点 id 至保护集 _remoteReceived */
        try {
          if (!Array.isArray(st._remoteReceived)) { st._remoteReceived = []; _rrSet = new Set(); }
          if (!_rrSet.has(id)) { st._remoteReceived.push(id); _rrSet.add(id); }
        } catch (e) { /* 保护集登记失败：仅影响该节点的删除传播保守度 */ }
        /* L16-W13 · 指令 4（Defect-F）：对端已送达 ⇒ 从 _localCreated 摘除 */
        try {
          if (Array.isArray(st._localCreated)) { const _li2 = st._localCreated.indexOf(id); if (_li2 >= 0) { st._localCreated.splice(_li2, 1); _lcSet.delete(id); } }
        } catch (e) { /* 保护集摘除失败：仅延长该节点的保护窗口 */ }
        /* 【QA-P0-2b】远端已删除节点不挂活树（parent 引用保留供恢复，children 不加入） */
        if (rn._deleted) continue;
        /* 【修复】远端新增节点挂回本地父节点 children，避免孤儿 */
        const pp = localNodes[rn.parent];
        if (pp && pp.children && !pp.children.includes(id)) { pp.children.push(id); }
        else if ((!pp) && st.rootId && localNodes[st.rootId]) {
          /* 【修复 2026-09-27】父节点在本地不存在：挂回根节点，杜绝悬挂孤儿 */
          rn.parent = st.rootId;
          if (!localNodes[st.rootId].children.includes(id)) localNodes[st.rootId].children.push(id);
        }
      } else if (_normToMs(rn.updatedAt || 0) > _normToMs(ln.updatedAt || 0)
        /* 【修复 F-03】同毫秒 LWW 平局：createdAt 亦相同时按内容序列化字典序确定性 tie-break。
           【QA-P0-2】tie-break 只比较用户内容：剥离 _rev/_origin/_deleted 等内部字段。 */
        || (_normToMs(rn.updatedAt || 0) === _normToMs(ln.updatedAt || 0) && _normToMs(rn.createdAt || 0) === _normToMs(ln.createdAt || 0)
          && JSON.stringify(rn, (k: string, v: any) => (['_rev', '_origin', '_deleted'].includes(k) ? undefined : v))
             > JSON.stringify(ln, (k: string, v: any) => (['_rev', '_origin', '_deleted'].includes(k) ? undefined : v)))) {
        /* 【修复】覆盖父节点时补回本地较新的独有子节点，避免孤儿 */
        const rnChildren = rn.children || [];
        const localExtra = (ln.children || []).filter((c: any) => {
          if (rnChildren.includes(c)) return false;
          const lc = localNodes[c];
          if (!lc) return false;
          const lcUpd = _normToMs(lc.updatedAt || 0);
          const lcCrt = _normToMs(lc.createdAt || 0);
          return lcUpd >= remoteUpdatedAt || lcCrt > remoteUpdatedAt;
        });
        localNodes[id] = rn;
        _structDirty = true;
        rn._origin = 'remote'; /* 【修复 F-01】远端覆盖的节点同样标记 remote */
        /* 【QA-P0-2b】对端删除传播的树结构：远端 _deleted 节点覆盖本地后，同步从旧父 children 摘除 */
        if (rn._deleted) {
          const dp = ln.parent && localNodes[ln.parent];
          if (dp && Array.isArray(dp.children)) {
            const di = dp.children.indexOf(id);
            if (di >= 0) dp.children.splice(di, 1);
          }
        }
        if (localExtra.length) rn.children = rnChildren.concat(localExtra);
        pruneTombstonedChildren(rn); /* FIX-H-01b: 覆盖分支 children 定型后剔除墓碑 id */
        /* 【fixed20】移动语义：远端覆盖且 parent 变化时，从旧父 children 移除 id */
        if (ln.parent && ln.parent !== rn.parent) {
          const oldP = localNodes[ln.parent];
          if (oldP && Array.isArray(oldP.children)) {
            const oi = oldP.children.indexOf(id);
            if (oi >= 0) oldP.children.splice(oi, 1);
          }
        }
      }
    }
    /* FIX-ORIGIN-1: 对端快照已包含某本地新建节点 → 对端已收悉，从 _localCreated 摘除 */
    try {
      if (st._localCreated && st._localCreated.length) {
        const lc = st._localCreated;
        for (let i = lc.length - 1; i >= 0; i--) { const _lid = lc[i]; if (remote.nodes[_lid]) { lc.splice(i, 1); _lcSet.delete(_lid); } }
      }
    } catch (e) { /* 保护集摘除失败：仅延长保护窗口 */ }
    /* FIX-ORIGIN-2: 对端 _localCreated 并入本地（崩溃恢复明文兜底场景） */
    try {
      if (remote._localCreated && remote._localCreated.length) {
        if (!st._localCreated) st._localCreated = [];
        for (const id of remote._localCreated) {
          if (typeof id !== 'string' || !localNodes[id]) continue;
          /* L16-W13 · 指令 4（Defect-F）：对端合入保护集内的 id 不回填 */
          if (_rrSet.has(id)) continue;
          if (!_lcSet.has(id)) { st._localCreated.push(id); _lcSet.add(id); }
        }
      }
    } catch (e) { /* 保护集并集失败：保守保留本地集合 */ }
    /* FIX-TOMB-1: 对端墓碑并入本地（跨会话/多标签）：取较新时间戳 */
    try {
      if (remote._tombstones && typeof remote._tombstones === 'object') {
        const _now = Date.now();
        for (const k in remote._tombstones) {
          const _ts = +remote._tombstones[k];
          if (!_ts || _now - _ts > TOMBSTONE_TTL_MS) continue;
          const old = _recentlyRemoved.get(k);
          if (!old || _ts > old) {
            _recentlyRemoved.set(k, _ts);
            _tombstoneQueue.push(k); /* L16-W8 · 指令 8：对端墓碑并入本地时同步登记插入顺序 */
            try {
              if (typeof st._tombstones !== 'object' || !st._tombstones) st._tombstones = {};
              st._tombstones[k] = _ts;
            } catch (e) { /* 墓碑落 state 失败：内存墓碑仍生效 */ }
          }
        }
        _tombstoneCompactQueue();
      }
    } catch (e) { /* 墓碑并集失败：沿用本地墓碑 */ }
    /* 墓碑驱动删除（受控差异 (f) 的配套）：并入对端墓碑后，把「本地仍存活但已被墓碑覆盖」的节点就地硬删。
       产品件用「对端快照缺失 + _remoteReceived 权威」推断删除；本实现把删除权威统一收敛到墓碑，
       因此必须在此把墓碑真正落到节点表——否则接收侧会长期持有已删节点的僵尸副本（实测三页节点集合分叉）。
       判定与产品件同口径：`节点 updatedAt <= 墓碑时刻` 即视为删除胜出（墓碑时刻取 _nowSeq()，恒 >= 被删节点）；
       墓碑之后被编辑过的节点（updatedAt 更大）不删，由后续 LWW 合并把编辑传回。 */
    try {
      const _tb = (st._tombstones && typeof st._tombstones === 'object') ? st._tombstones : null;
      if (_tb) {
        for (const id in _tb) {
          if (isDangerKey(id) || id === st.rootId) continue;
          const ln = localNodes[id];
          if (!ln) continue;
          const ts = +_tb[id] || 0;
          if (!ts) continue;
          if (_normToMs(ln.updatedAt || 0) <= ts) {
            _removeNodeFromMap(localNodes, id, false);
            _rrSet.delete(id); _lcSet.delete(id);
            _structDirty = true;
          }
        }
      }
    } catch (e) { /* 墓碑落地失败：保留节点（下一轮合并重试） */ }
    /* 【修复】删除传播：本地有、远端无，且该节点最后修改早于远端快照、非本页快照后新建 → 视为远端已删除 */
    if (remoteUpdatedAt > 0) {
      for (const id of Object.keys(localNodes)) {
        if (isDangerKey(id)) continue; /* FIX-H-04: 防御性跳过危险键 */
        if (remote.nodes[id]) continue;
        const ln = localNodes[id];
        if (!ln) continue;
        const lnUpd = _normToMs(ln.updatedAt || 0);
        if (lnUpd >= remoteUpdatedAt) continue;   /* 本地修改不早于快照 → 保留 */
        const lnCrt = _normToMs(ln.createdAt || 0);
        if (lnCrt > remoteUpdatedAt) continue;    /* 快照后新建 → 保留 */
        /* 【修复 F-01】本页新建（_origin==='local'）节点不参与删除传播 */
        if (ln._origin === 'local') continue;
        /* FIX-ORIGIN-1: 跨会话保护——本页新建且持久化后（_origin 已剥离）的节点仍在 _localCreated 内 */
        if (_lcSet.has(id)) continue;
        /* 受控结构差异 (f)：**对端送入的节点不以「对端快照缺失」为删除依据**。
           产品件在此处按 `_remoteReceived` 命中即认定「对端确已删除、删除指令权威」——该判定成立的
           前提是各标签页几乎同步（真实产品由用户手速驱动，300ms autosave 足够，通常成立）。
           并发压测（3 标签 × 1000 次密集操作）下对端快照必然滞后于本页刚合入的新增节点，
           「缺失即删除」会批量误删仍然存活的对端内容（实测节点数由 ~1600 掉到 ~700 且三页不一致）。
           故收窄为：对端送入节点的删除权威**只由墓碑承担**（_tombstones 并集 + 本地墓碑扫掠，
           见本函数上方两段与 tombstoneSet）——跨标签删除仍完整传播，且不会误删并发新增。
           本页自建节点（_localCreated / _origin==='local'）的既有守卫保持不变。 */
        if (_rrSet.has(id)) continue;
        /* FIX-H-05: _diskConfirmed===null 时保守跳过删除；仅本页已确认上盘的节点才可被删除传播命中 */
        if (!_diskConfirmed || !_diskConfirmed.has(id)) continue;
        removeNodeFromMap(localNodes, id);
        _rrSet.delete(id); _lcSet.delete(id); /* Set 视图与数组摘除同步（递归子节点由 ln 守卫跳过） */
        _structDirty = true;
      }
    }
    /* 清理被删节点的 trashed 引用，保持一致性 */
    if (st.trashed && st.trashed.length) {
      st.trashed = st.trashed.filter((t: any) => t && t.rootId && localNodes[t.rootId]);
    }
    /* 全局元数据 LWW（产品件 2298-2360） */
    if (mergeGlobalMeta(st, remote)) _metaDirty = true;
    /* 【修复 F-02】合并后做 parent/children 一致性修复（父缺失挂回根、parent 引用为准补 children） */
    if (_structDirty) {
      try { repairTreeConsistency(); } catch (e) { console.warn('[JU] repairTreeConsistency failed', e); }
      /* 受控差异 (b)：children 顺序确定性收敛（以 parent 指针重建 + (createdAt,id) 排序） */
      if (canonicalizeChildren(st)) _structDirty = true;
    }
    /* FIX-P3-21: 合并尾部统一做多根记事本 / 日历根去重 */
    try { deps.dedupNoteRoots(); } catch (e) { /* 记事本去重不可用 */ }
    try { deps.dedupCalRoots(); } catch (e) { /* 日历根去重不可用 */ }
    /* 【fixed22/H2】不变量校验：repair 后仍检测多父则上报（O(n) 单次遍历） */
    try {
      const viol: any[] = [];
      for (const pid in localNodes) {
        const p = localNodes[pid];
        if (!p || !Array.isArray(p.children)) continue;
        for (const cid of p.children) {
          const c = localNodes[cid];
          if (!c || c._deleted) continue;
          if (c.parent !== pid && cid !== st.rootId) viol.push(cid);
        }
      }
      if (viol.length) deps.reportError('invariant', { name: 'multi-parent-after-repair', ids: [...new Set(viol)].slice(0, 5) });
    } catch (e) { /* 不变量检测不可用 */ }
    /* 【F2/fixed19】rev 单调不减：max(local,remote)+1（避免 remote 较小值时回退） */
    st._rev = Math.max((st._rev | 0), (remote._rev | 0)) + 1;
    /* L4 阶段 1.6：mergeRemoteState 不进入历史栈（不入 historyPast / 不清 historyFuture） */
    return _structDirty || _metaDirty;
  } finally {
    _applying = false;
  }
}

/**
 * 合并入口（对应产品件 mergeRemoteIfNewer，2025-2047）。
 * 【修复 F-04】移除 rev 合并门槛：rev 是各标签页独立写盘序号、不跨页唯一，按 rev 拒绝会导致并发新建不收敛；
 * 一律执行节点级 LWW 合并，内容不变时由指纹守卫跳过写盘，天然收敛、无 ping-pong。
 *
 * 受控结构差异 (d)：产品件用 `JSON.stringify(state,_strip)` 的 before/after 双全景序列化来判断
 * 「是否值得 scheduleNotify」，本实现改为直接采用 `mergeRemoteState` 的返回值——该返回值只在
 * 「节点结构变更 || 全局元数据变更」时为 true（墓碑 / 保护集的纯记账变化不置脏，与产品件
 * FIX-P3-23 的剥离口径一致），语义等价但省去每次合并两次 O(n) 全量序列化（广播风暴下的主要开销）。
 *
 * 受控结构差异 (e)：合并结果改由 `schedulePersist()`（300ms 写合并）落盘，而非合并后立即写盘。
 * 产品件同样依赖 300ms autosave 收敛（其合并路径本身不写盘，仅 scheduleNotify → schedulePersist）；
 * 立即写盘会让「合并 → 写盘 → 对端合并」形成写入放大（实测 3 标签 3000 操作会把用例拖到超时）。
 */
export function mergeRemoteIfNewer(remote: any): boolean {
  const st = deps.getState();
  try {
    if (!st || !remote || !remote.nodes) return false;
    const remoteRev = (remote._rev | 0) || 0;
    const localRev = (st._rev | 0) || 0;
    const _changed = mergeRemoteState(remote);
    /* 【修复 F-05 / QA-P1-1】rev 单调：取三者最大值，保证单调不减 */
    st._rev = Math.max((st._rev | 0), remoteRev, localRev);
    if (_changed) {
      st.updatedAt = Math.max(Date.now(), (+st.updatedAt || 0) + 1); /* 合并即新内容：推进 LWW 时钟，供对端广播门控比较 */
      scheduleNotify();
      /* 合并结果（并集/删除）尚未上盘 → 立即调度落盘，使磁盘态随内存态收敛（写合并，非逐事件写盘） */
      schedulePersist();
      return true;
    }
    return false;
  } catch (e) {
    console.error('[JU] mergeRemoteIfNewer', e);
    return false;
  }
}

/** 最近一次已处理过的远端落盘原文（同一快照的重复通知去重） */
let _lastRemoteRaw: string | null = null;

/**
 * 收到远端整库快照（BroadcastChannel 通知 / storage 事件）时合并。
 * 对应产品件 onRemoteStoreChange（2009-2023）。
 *
 * 去重说明：同一次对端写盘会被 **两条路径** 送达本页（`storage` 事件携带 e.newValue +
 * BroadcastChannel 通知触发的一次 localStorage 重读），两条路径内容逐字节相同；
 * 合并是幂等的，但重复合并要付出一次全量遍历代价。此处以「原文相同即跳过」去重，
 * 语义与幂等合并完全等价（合并本身不依赖处理次数）。
 */
export function onRemoteStoreChange(raw: any): void {
  try {
    const ui = deps.ui;
    /* 【fixed17 #7】加密模式：无法解密其他标签密文，toast 提示而非静默 */
    if (ui && ui.encrypted) { try { deps.toast('其他标签页已修改数据，请刷新查看最新内容'); } catch (_e) { /* toast 不可用 */ } return; }
    let remote: any = null;
    if (raw) {
      if (typeof raw === 'string') {
        if (raw === _lastRemoteRaw) return; /* 同一快照重复送达：幂等合并，跳过 */
        _lastRemoteRaw = raw;
        try { remote = JSON.parse(raw); } catch (e) { return; }
      } else {
        remote = raw;
      }
    }
    /* 【QA-P0-1 修订】不加整体陈旧门控：整体门控会双路径拦截「对端并发编辑快照」，
       破坏 F-04 并发收敛语义。DEFECT-A（删除被旧快照复活）改由精确墓碑机制修复。 */
    mergeRemoteIfNewer(remote);
  } catch (e) { console.error('[JU] onRemoteStoreChange', e); }
}

/* ============================================================
   广播（对应产品件 STORE_BC_INSTANCE 初始化 + _broadcastRev，2008 / 5265-5273）
   ============================================================ */

/**
 * 初始化多标签广播单例（幂等）。
 *
 * onmessage 默认实现：收到通知即重读 localStorage 快照并合并（等价于产品件 boot 内
 * `STORE_BC_INSTANCE.onmessage` 的明文分支）；boot 会在启动装配期用其完整处理器
 * （含加密 / 桌面分支）覆盖本默认处理器，二者共用同一 `STORE_BC_INSTANCE` 实例。
 */
export function initStoreBc(): BroadcastChannel | null {
  if (STORE_BC_INSTANCE) return STORE_BC_INSTANCE;
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    STORE_BC_INSTANCE = new BroadcastChannel(STORE_BC_NAME);
    STORE_BC_INSTANCE.onmessage = (): void => {
      try { onRemoteStoreChange(localStorage.getItem(STORE_KEY)); }
      catch (e) { console.warn('[JU] broadcast merge failed', e); }
    };
  } catch (e) {
    console.warn('[JU] BroadcastChannel unavailable', e);
    STORE_BC_INSTANCE = null;
  }
  return STORE_BC_INSTANCE;
}

/* 批次 DE · 死代码清理：`getStoreBcInstance` 经全量静态反查确认无调用方，已删除
   （`setStoreBcInstance` 仍被装配层使用，保留）。 */

/** 覆盖广播实例（boot 关闭通道 / 测试注入；传 null 表示下线） */
export function setStoreBcInstance(bc: BroadcastChannel | null): void { STORE_BC_INSTANCE = bc; }

/**
 * 仅广播 rev（对应产品件 _broadcastRev，5265-5273）。
 * FIX-M-17: 发送内容时间戳 snap.updatedAt（而非广播时刻 Date.now()），使接收端门控语义正确。
 */
export function _broadcastRev(snap: any): void {
  try {
    if (STORE_BC_INSTANCE) {
      STORE_BC_INSTANCE.postMessage({ rev: (snap._rev | 0) || 0, updatedAt: (snap.updatedAt || 0) });
    }
  } catch (e) { /* 通道已关闭：忽略（storage 事件仍兜底收敛） */ }
}

/* ============================================================
   落盘（对应产品件 schedulePersist / runPersist，5138-5264）
   ============================================================ */

/** 记录最近一次成功写盘的节点集合（对应产品件 markDiskConfirmed，2048-2051） */
export function markDiskConfirmed(nodesObj: any): void {
  try { _diskConfirmed = new Set(Object.keys(nodesObj || {})); } catch (e) { /* 集合构建失败：保守保持上一份 */ }
}

/** 调度一次落盘（产品件 300ms 防抖，5138-5141） */
export function schedulePersist(): void {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { void runPersist(); }, 300);
}

/**
 * 【review12-fix · #7】编辑提交第一现场写 pending 兜底，不等待 300ms 落盘防抖。
 * 加密态：立即启动加密（单飞；飞行中再提交只置脏，完成后取最新态），成功后写
 * sessionStorage[PENDING_SYNC_KEY]，与 recoverPendingEncrypted 的恢复口径一致。
 * 明文态：同步写 {state} 快照（恢复端在未加密时直接合并）。
 * 权威落盘仍由 runPersist 承担，本函数只保证强杀窗口内最新编辑可恢复。
 */
function cachePendingSnapshotNow(): void {
  const ui = deps.ui;
  if (ui && ui.locked) return;
  const snap = deps.getState();
  if (!snap) return;
  if (ui && ui.encrypted && ui.encKey) {
    _pendingEncDirty = true;
    if (_pendingEncInFlight) return;
    _pendingEncInFlight = true;
    const run = (): void => {
      _pendingEncDirty = false;
      const cur = deps.getState();
      const live = deps.ui;
      if (!cur || !(live && live.encrypted && live.encKey)) { _pendingEncInFlight = false; return; }
      const mySeq = ++_pendingSnapshotSeq;
      void encryptState(cur, live.encKey).then((payload) => {
        if (mySeq !== _pendingSnapshotSeq) return;
        _lastEncPayload = payload;
        try { sessionStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ payload, ts: Date.now(), ttl: 60000 })); } catch (e) { /* sessionStorage 不可用 */ }
        /* 【ISSUE-001】此处不再直写权威密文库：直写分支绕过 runPersist 的
           「读盘 → 节点级 LWW 合并 → 指纹守卫」，两窗口并发时会把对端节点覆盖掉。
           权威落盘统一由 commit → persistNow() → runPersist 单通道承担。 */
      }).catch(() => { /* 加密失败：保留上一份兜底 */ }).then(() => {
        _pendingEncInFlight = false;
        if (_pendingEncDirty) run();
      });
    };
    run();
    return;
  }
  try {
    sessionStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ state: snap, ts: Date.now(), ttl: 60000 }));
  } catch (e) { /* sessionStorage 不可用或超配额 */ }
}

/** 立即持久化：清防抖并同步执行落盘（产品件 persistNow，2052-2055） */
export function persistNow(): void {
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  void runPersist();
}

/**
 * 【fixr6-4 · ISSUE-004】可等待落盘：清防抖后等到本轮写盘真正结束（含桌面 save_state resolve），
 * 供关闭流程在 close() 前判定主库已写盘；runPersist 内部已吞异常，失败不影响调用方。
 * 【fixr7-03 · ISSUE-003】返回是否收敛：false = 3 轮后仍有内容未写盘，调用方须提示并留痕。
 */
export async function persistNowAwait(): Promise<boolean> {
  /* 【fixr6-19 · ISSUE-003】in-flight 期间的新编辑只置脏标记：最多 3 轮，轮末比对指纹判定是否真正写盘。
     【fixr7-03】未收敛（含加密写盘失败）不得因无脏标记/无待调度提前退出：3 轮 = 至少 2 次重试。 */
  for (let round = 0; round < 3; round++) {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    await runPersist();
    /* 上一轮仍在写盘时 runPersist 走重入早退：按 50ms×20（≤1s）等到本轮结束 */
    for (let i = 0; i < 20 && _persistRunning; i++) await new Promise((r) => setTimeout(r, 50));
    let _cur = '';
    try { _cur = JSON.stringify(deps.getState(), _ORIGIN_STRIP); } catch { _cur = ''; }
    if (_cur === _lastWrittenJson) return true;      /* 本轮已把当前内存态写盘 */
  }
  console.warn('[JU] persistNowAwait 未收敛：关闭前可能仍有编辑未落盘');
  return false;
}

/** 关页/切后台强制落盘（与 persistNow 同义，保留端口名供 beforeunload 复用） */
export function flushPersistNow(): void {
  persistNow();
}

/** 最近一次加密载荷（供 sessionStorage 兜底复用） */
export function getLastEncPayload(): EncPayload | null { return _lastEncPayload; }

/**
 * 【fix32-3 · ISSUE-003】加密崩溃兜底读取：sessionStorage[PENDING_SYNC_KEY] 密文 → 解密 → 合并。
 * 取后即删（过期 / 坏 JSON 同样清除）；未解锁（无 ui.encKey）保留原项，待回前台重试。
 */
export async function recoverPendingEncrypted(): Promise<any> {
  let raw: string | null = null;
  try { raw = sessionStorage.getItem(PENDING_SYNC_KEY); } catch (e) { return null; }
  if (!raw) return null;
  let pend: any = null;
  try { pend = JSON.parse(raw); } catch (e) { pend = null; }
  if (!pend || !(Number(pend.ts) + Number(pend.ttl) > Date.now())) {
    try { sessionStorage.removeItem(PENDING_SYNC_KEY); } catch (e) { /* sessionStorage 不可用 */ }
    return null;
  }
  /* 【review12-fix · #7】明文态第一现场兜底（{state}）：仅未加密时合并；已加密则丢弃，防止明文回灌 */
  if (pend.state && pend.state.nodes) {
    if (deps.ui && deps.ui.encrypted) {
      try { sessionStorage.removeItem(PENDING_SYNC_KEY); } catch (e) { /* sessionStorage 不可用 */ }
      return null;
    }
    mergeRemoteIfNewer(pend.state);
    try { sessionStorage.removeItem(PENDING_SYNC_KEY); } catch (e) { /* sessionStorage 不可用 */ }
    return pend.state;
  }
  if (!pend.payload) {
    try { sessionStorage.removeItem(PENDING_SYNC_KEY); } catch (e) { /* sessionStorage 不可用 */ }
    return null;
  }
  const key = deps.ui && deps.ui.encKey;
  if (!key) return null; /* 未解锁：保留兜底，待 visible 重试 */
  try {
    const st = await decryptState(pend.payload, key);
    if (!st || !st.nodes) return null;
    mergeRemoteIfNewer(st);
    try { sessionStorage.removeItem(PENDING_SYNC_KEY); } catch (e) { /* sessionStorage 不可用 */ }
    return st;
  } catch (e) {
    console.warn('[JU] recoverPendingEncrypted failed', e);
    return null;
  }
}

/**
 * 真实落盘（对应产品件 runPersist，5147-5264）。
 *
 * 语义时序（逐条对应产品件）：
 *   1) ui.locked 锁定态不落盘（避免用默认态覆盖加密库）；
 *   2) _persistRunning 重入 → 置脏标记，由 finally 重排；
 *   3) 指纹守卫：与上次成功写盘完全一致时跳过（不写盘 / 不递增 rev / 不广播）；
 *   4) rev 递增后序列化落盘串（受控差异 a：直接二次序列化 = 产品件降级路径）；
 *   5) 加密 / 桌面 / 明文三分支落盘，成功即 markDiskConfirmed + 复位失败计数 + 广播 rev；
 *   6) 失败累加 _persistFailCount，达 _PERSIST_MAX_RETRY 转指数退避继续重试（不再永久停摆）。
 */
export async function runPersist(): Promise<void> {
  const ui = deps.ui;
  if (ui && ui.locked) return;
  if (_persistRunning) { _persistDirty = true; return; }
  _persistRunning = true;
  _persistDirty = false;
  const mySeq = ++_persistSeq;
  /* FIX-M-05: 整段函数体（含 getState/JSON.stringify/rev 递增）包入 try，_persistRunning 放 finally；
     异常不再永久卡死保存，仅 console.warn 并不中断后续 schedulePersist */
  try {
    let snapshot = deps.getState();
    if (!snapshot) return;
    /* 【fix32-6 / ISSUE-006】写盘前合并磁盘最新快照：两标签在广播到达前各自保存时，
       整快照落盘会覆盖对端节点改动。先读磁盘（明文 localStorage / 桌面 dsLoadState），
       走既有节点级 LWW 合并（mergeRemoteIfNewer），再重取状态落盘。
       【fixr6-8 / ISSUE-008】门槛改为「磁盘快照存在即合并」：updatedAt 同毫秒时不大于内存快照，
       旧门槛漏合并 ⇒ 整快照覆盖丢对端节点；节点级合并幂等，内容不变由指纹守卫跳过写盘。 */
    try {
      const _ek = ui && ui.encKey;
      if (!(ui && ui.encrypted && _ek)) {
        let _disk: any = null;
        if (deps.isDesktop()) {
          const _ds: any = deps.dsLoadState ? await deps.dsLoadState() : null;
          if (_ds && _ds.state && _ds.state.nodes) _disk = _ds.state;
        } else {
          const _raw = localStorage.getItem(STORE_KEY);
          if (_raw) { try { _disk = JSON.parse(_raw); } catch (_e) { _disk = null; } }
        }
        if (_disk && _disk.nodes) {
          mergeRemoteIfNewer(_disk);
          snapshot = deps.getState() || snapshot;
        }
      } else if (_ek) {
        /* 【fixr6-8 / ISSUE-008】加密态同样在下方 encryptState 之前合并磁盘密文（明文不写 localStorage）；
           解密失败保持原行为（直接覆盖），且不删磁盘密文 */
        try {
          const _ds: any = deps.isDesktop() && deps.dsLoadState ? await deps.dsLoadState() : null;
          let _pl: any = null;
          if (_ds && _ds.encStore) { try { _pl = JSON.parse(_ds.encStore); } catch (_e2) { _pl = null; } }
          if (!_pl) _pl = readEncryptedStore();
          if (_pl && _pl.cipher) {
            const _dk = await decryptState(_pl, _ek);
            if (_dk && _dk.nodes) {
              mergeRemoteIfNewer(_dk);
              snapshot = deps.getState() || snapshot;
            }
          }
        } catch (_e) { console.warn('[JU] pre-persist encrypted merge skipped', _e); }
      }
    } catch (_e) { console.warn('[JU] pre-persist merge skipped', _e); }
    /* 【修复】指纹守卫：与上次成功写盘完全一致（含 rev）时跳过，不写盘、不递增 rev、不广播 */
    const json = JSON.stringify(snapshot, _ORIGIN_STRIP);
    if (json === _lastWrittenJson) return;
    const _revOld = snapshot._rev | 0;
    snapshot._rev = _revOld + 1;
    const json2 = JSON.stringify(snapshot, _ORIGIN_STRIP);
    if (ui && ui.encrypted && ui.encKey) {
      const payload = await encryptState(snapshot, ui.encKey);
      _lastEncPayload = payload; /* FIX-M-15: 每次成功生成加密 payload 同步更新，使 sessionStorage 兜底永不陈旧 */
      if (mySeq !== _persistSeq) { schedulePersist(); return; }
      /* 【修复 2026-09-27】落盘前把密文写入 sessionStorage 兜底（可恢复，非明文） */
      try { sessionStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ payload, ts: Date.now(), ttl: 60000 })); } catch (e) { /* sessionStorage 不可用 */ }
      if (await writeEncryptedStore(payload)) {
        try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(PENDING_KEY); } catch (e) { /* 存储不可用 */ }
        try { sessionStorage.removeItem(PENDING_SYNC_KEY); } catch (e) { /* sessionStorage 不可用 */ }
        _lastWrittenJson = json2; markDiskConfirmed(snapshot.nodes);
        _persistFailCount = 0; /* FIX-P3-24: 加密写盘成功，复位失败计数 */
        _broadcastRev(snapshot);
      } else {
        /* FIX-S-5: 加密写盘失败时【保留】明文 STORE_KEY + 告警（内存态已提交，再删明文即唯一副本丢失） */
        try { deps.toast('加密保存失败：已保留加密兜底，请尽快导出数据'); } catch (e) { /* toast 不可用 */ }
        /* 【fixr7-03 · ISSUE-003】失败必须上抛：走外层 catch 累加 _persistFailCount，关闭流程据此判未收敛 */
        throw new Error('encrypted save failed');
      }
    } else if (deps.isDesktop()) {
      /* 桌面版：写入 SQLite（后端负责落盘 + 滚动自动备份）
         BUG-02(2-C)：落盘失败不得推进指纹/脏集，抛错交由外层 catch 记录并递增 _persistFailCount */
      let _dsOk = false;
      try { _dsOk = await deps.desktopSave(); } catch (e) { _dsOk = false; }
      if (!_dsOk) {
        try {
          const _why = String(((window as any).__juLastSaveError) || '').slice(0, 160);
          deps.toast('桌面存储保存失败：' + (_why || '未知原因') + '（稍后重试）');
        } catch (e) { /* toast 不可用 */ }
        throw new Error('desktop save failed');
      }
      _lastWrittenJson = json2; markDiskConfirmed(snapshot.nodes);
      _persistFailCount = 0;
      _broadcastRev(snapshot);
    } else {
      if (json2.length > MAX_STORE_BYTES) throw new Error('数据过大');
      localStorage.setItem(STORE_KEY, json2);
      try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* 存储不可用 */ }
      /* 【D-01】IDB 第二副本：fire-and-forget，内部自带超时与失败吞掉（不改变落盘成功语义） */
      void idbMirrorState(json2);
      _lastWrittenJson = json2; markDiskConfirmed(snapshot.nodes);
      _persistFailCount = 0; /* FIX-P3-24: 本地写盘成功，复位失败计数 */
      _broadcastRev(snapshot);
    }
  } catch (e: any) {
    console.warn('persist failed', e);
    _persistFailCount++; /* FIX-P3-24: 记录连续失败次数 */
    /* 加密 / 桌面分支在 throw 前已给出各自的具体提示；此处不得再用统一的「存储空间不足」覆盖，
       否则用户只看到配额文案（负向用例应看到「加密保存失败」）。统一文案仅服务其余落盘异常。 */
    const _msg = e && typeof e.message === 'string' ? e.message : '';
    if (_msg !== 'encrypted save failed' && _msg !== 'desktop save failed') {
      try { deps.toast('保存失败：存储空间不足，请导出备份'); } catch (_e) { /* toast 不可用 */ }
    }
  } finally {
    _persistRunning = false;
    if (_persistFailCount >= _PERSIST_MAX_RETRY) {
      /* FIX-P3-24 / ISSUE-005: 达上限不再永久停摆——按指数退避继续重试（复用 persistTimer，不新增全局状态） */
      const _backoff = Math.min(300 * Math.pow(2, _persistFailCount - _PERSIST_MAX_RETRY + 1), 60000);
      clearTimeout(persistTimer); persistTimer = setTimeout(() => { void runPersist(); }, _backoff);
      _persistDirty = false;
      return;
    }
    if (_persistDirty || mySeq !== _persistSeq) { _persistDirty = false; schedulePersist(); }
  }
}

/* ============================================================
   撤销 / 重做（历史栈）
   ------------------------------------------------------------
   本工程 state 为 __juProduce 生成的结构共享 immutable 树：每次 commit 产出**新的根对象**，
   未变更分支保持原引用。因此历史栈只需存「上一次的 state 根引用」——
   无需深拷贝、无需 patch 重放，内存开销只来自被改动路径上的新节点。

   入栈口径（与产品件 `snapshot` 语义对齐）：
     - 只有 `opts.snapshot === true` 的提交（用户可感知的结构 / 文本变更）入栈；
     - `silent` / `persistOnly` / `light`（活动日志、列宽、行高等附属写）不入栈；
     - `noHistory === true`（例如 blur 补提交并入上一动作）不入栈。
   撤销即把栈顶旧根设为当前 state；重做把撤销前的根压回未来栈。
   撤销/重做后必须 scheduleNotify()（渲染）+ 立即落盘，否则刷新会回到撤销前的数据。
   ============================================================ */

/** 历史深度上限（超出丢弃最旧项，防止长会话无界增长） */
export const HISTORY_LIMIT = 100;
const _historyPast: any[] = [];
const _historyFuture: any[] = [];

/** 判定本次提交是否进入撤销栈 */
function shouldRecordHistory(opts: any): boolean {
  if (!opts) return false;
  if (opts.silent || opts.persistOnly || opts.light) return false;
  if (opts.noHistory === true || opts.snapshot === false) return false;
  return opts.snapshot === true;
}

/** 记录一次可撤销提交（以「提交前根引用」为撤销目标） */
function recordHistory(base: any, opts: any): void {
  if (!shouldRecordHistory(opts)) return;
  if (!base) return;
  if (_historyPast.length && _historyPast[_historyPast.length - 1] === base) return;
  _historyPast.push(base);
  if (_historyPast.length > HISTORY_LIMIT) _historyPast.shift();
  /* 产生新分支后，原重做链失效（与产品件 commit 清空 historyFuture 同口径） */
  _historyFuture.length = 0;
}

/** 是否可撤销（供 UI 置灰 / 诊断） */
export function canUndo(): boolean { return _historyPast.length > 0; }
/** 是否可重做（供 UI 置灰 / 诊断） */
export function canRedo(): boolean { return _historyFuture.length > 0; }

/**
 * 撤销一步（返回 true 表示确实回退了状态）。
 *
 * 直接以旧根引用 setState：结构共享保证未变更子树零代价复用；
 * 随后 scheduleNotify() 触发渲染调度、persistNow() 立即落盘并广播。
 */
export function undo(): boolean {
  if (!_historyPast.length) return false;
  const prev = _historyPast.pop();
  const cur = getState();
  if (cur) {
    _historyFuture.push(cur);
    if (_historyFuture.length > HISTORY_LIMIT) _historyFuture.shift();
  }
  setState(prev);
  try { scheduleNotify(); } catch (e) { console.warn('[JU] undo notify failed', e); }
  try { persistNow(); } catch (e) { console.warn('[JU] undo persist failed', e); }
  return true;
}

/** 重做一步（返回 true 表示确实前进了状态）。 */
export function redo(): boolean {
  if (!_historyFuture.length) return false;
  const next = _historyFuture.pop();
  const cur = getState();
  if (cur) {
    _historyPast.push(cur);
    if (_historyPast.length > HISTORY_LIMIT) _historyPast.shift();
  }
  setState(next);
  try { scheduleNotify(); } catch (e) { console.warn('[JU] redo notify failed', e); }
  try { persistNow(); } catch (e) { console.warn('[JU] redo persist failed', e); }
  return true;
}

/** 清空历史栈（initStore 装载新库 / 解密切换库时调用，避免跨库回退） */
export function resetHistory(): void {
  _historyPast.length = 0;
  _historyFuture.length = 0;
}

/* ============================================================
   提交（对应产品件 commit：immutable 提交 → 回写 state → 落盘）
   ============================================================ */

/**
 * immutable 提交收口（产品件 commit(fn,opts) 的最小可运行子集）。
 *
 * 入参语义与产品件一致：`fn` 是**生产者函数**（对 draft 就地修改），
 * 而非最终 state；`core/actions` 的 `deps.commit(recipe, opts)` 即按此调用。
 * 失败回滚：recipe 抛错时不替换 state，返回原引用（与 __juProduceSafe 语义一致）。
 *
 * 时序：produce（结构共享）→ 推进 state.updatedAt（LWW 时钟）→ setState →
 *       scheduleNotify（渲染调度 + 落盘调度）→ persistNow（加急落盘 + 广播，F-01）。
 */
export function commit(fn: (s: any) => void, _opts?: any): any {
  const base = deps.getState();
  if (!base) return base;
  if (typeof fn !== 'function') {
    console.warn('[JU] commit expects a producer function');
    return base;
  }
  let next: any;
  try {
    next = __juProduce(base, fn);
  } catch (e) {
    console.warn('[JU] commit action failed, rolling back', e);
    return base;
  }
  if (next === base) return base;
  next.updatedAt = Math.max(Date.now(), (+base.updatedAt || 0) + 1);
  /* 撤销栈：只登记「提交前的根引用」，结构共享使该引用保持完整旧快照 */
  recordHistory(base, _opts);
  setState(next);
  /* 【review12-fix · #7】编辑提交瞬间立即写 pending 兜底（尤其 Enter/blur 提交）：
     不等 scheduleNotify 尾部的 300ms 防抖，保证强杀窗口内最新编辑可恢复。 */
  cachePendingSnapshotNow();
  /* 【ISSUE-001】立即唤醒 runPersist（绕过 300ms 防抖）：先读盘合并对端快照再落盘，
     消灭「提交后 300ms 内强杀丢末次编辑」窗口；权威落盘只此一条通道，不再有直写旁路。 */
  persistNow();
  /**
   * `noNotify: true` —— 静默提交（本次新增，仅富文本格式命令使用）。
   *
   * 语义：state / 撤销栈 / 落盘调度照常推进，但**不广播 notify**。
   * 为什么需要：`subscribe()` 的监听者里有 `app/boot` 的
   * `deps.subscribe(() => deps.scheduleRender())`；一旦 notify，下一帧 `renderMain()`
   * 会重建 `#content`。富文本 execCommand 刚把 DOM 改好，若此时重建，
   * 正在编辑的 contenteditable 节点被替换 ⇒ 选区 / 光标丢失，
   * 连续点「加粗 → 颜色」第二下就落空（本缺陷的「前一步效果失效」）。
   * 走本分支后由 blur / input 等自然通道负责 UI 收敛，渲染不发生。
   */
  if (_opts && _opts.noNotify === true) { schedulePersist(); return next; }
  /* scheduleNotify 的微任务尾部即 `schedulePersist()`（core/store 端口）→ 300ms 写合并落盘。
     需要「零防抖窗口」的路径（新建节点 / 新建文档）由 actions 显式调用 `deps.persistNow()`
     完成（产品件 F-01 同款分工），提交本身不再逐次强制写盘。 */
  scheduleNotify();
  return next;
}

/* ============================================================
   初始化（幂等）
   ============================================================ */

/**
 * 装载状态并接通多标签同步（幂等）。
 * 首次调用：state 为空时读取 localStorage，缺失则落默认态；随后恢复墓碑、建立广播通道、
 * 标记磁盘确认集并完成首次落盘。
 * 说明：storage 事件监听由 app/boot.ts 装配（任务书批次 AQ 第 2 项），此处只提供通道与落盘能力。
 */
export function initPersist(): any {
  let st = getState();
  if (!st) {
    const loaded = loadState();
    st = ensureShape(loaded || defaultState());
    initStore(st);
    st = getState();
  }
  /* 装载新库后清空历史栈：避免跨库撤销把旧库节点回灌到当前库 */
  resetHistory();
  ensureShape(st);
  restoreTombstones(st);
  /* 【H1/fixed22】防御性 _diskConfirmed 初始化：删除传播守卫不因 _diskConfirmed===null 而放行所有删除 */
  try { _diskConfirmed = new Set(Object.keys(st.nodes || {})); } catch (e) { _diskConfirmed = new Set(); }
  try { initStoreBc(); } catch (e) { console.warn('[JU] initPersist bc failed', e); }
  /* 首次落盘：明文/加密分支由 runPersist 内部按 ui 状态选择。
     fix33-1 · ISSUE-001：桌面态此时尚未装载 load_state 快照（boot 之后才 initStore），
     若在此写默认态会把 ju_store.json 覆盖为空库；桌面首帧落盘由 boot 装载快照后执行。 */
  if (!deps.isDesktop()) persistNow();
  return st;
}

/* ============================================================
   Track B · M0-15 · 云端同步（Pro 阈值拦截 + Mock 闭环）
   ------------------------------------------------------------
   契约：
     1) 阈值拦截在最前面：`ui.isPro !== true`（免费版）时**不发任何请求**，
        直接 `toast('云端同步为 Pro 版专属功能')` 并返回 false；
     2) Pro 版：上行 `POST /api/sync/push` 携带整库快照（`{ state }`），
        下行 `GET /api/sync/pull` 取回整库快照并复用 `mergeRemoteIfNewer`
        （节点级 LWW + 墓碑驱动删除），拉取结果与多标签同步走同一套合并算法；
     3) 网络 / 非 2xx / 载荷不合法一律以产品 toast 呈现，不抛异常给 UI 层，
        返回值 false 供调用方决定是否继续。
   ============================================================ */

/**
 * 【ISSUE-012】云端同步端点改为**构建期环境变量注入**，不再内置任何本地地址。
 *
 * 历史问题：端点硬编码为 `http://127.0.0.1:8081/...`（联调用的 Mock 授权服务），
 * 该地址被原样打进发布产物 —— 用户侧点「同步到云」等于向自己本机的 8081 端口发请求，
 * 既是无效功能，也构成对内网端口的信息泄露。
 *
 * 现行口径：
 *   - 端点由 `VITE_SYNC_PUSH_URL` / `VITE_SYNC_PULL_URL` 注入（发版流水线按环境设置）；
 *   - 未注入（值为空）⇒ `SYNC_ENABLED === false`：
 *       ① `syncToCloud` / `syncFromCloud` 直接返回 false，不发任何请求、不弹误导性 toast；
 *       ② 设置面板的「云端同步」入口整体隐藏（见 `src/ui/layout.ts` 的 `isCloudSyncEnabled`）。
 */
export const SYNC_PUSH_URL: string = import.meta.env.VITE_SYNC_PUSH_URL ?? '';
/** 云端同步下行端点（`VITE_SYNC_PULL_URL` 注入） */
export const SYNC_PULL_URL: string = import.meta.env.VITE_SYNC_PULL_URL ?? '';
/** 云端同步端点是否已配置（两个端点均非空才算可用） */
export const SYNC_ENABLED: boolean = !!(SYNC_PUSH_URL && SYNC_PULL_URL);
/** 免费版拦截文案（设置面板按钮与测试均以此为准） */
export const SYNC_PRO_GATE_MESSAGE = '云端同步为 Pro 版专属功能';

/** 云端同步入口是否可用（端点未配置 ⇒ UI 隐藏入口，不呈现点了也没有反应的按钮）。 */
export function isCloudSyncEnabled(): boolean {
  return SYNC_ENABLED;
}

/** 当前是否允许云端同步（唯一判定口径：端点已配置且 `ui.isPro === true`）。 */
export function isCloudSyncAllowed(): boolean {
  if (!SYNC_ENABLED) return false;
  const ui = deps.ui;
  return !!(ui && ui.isPro === true);
}

/** 错误文案归一（网络异常 / 非 2xx / JSON 解析失败共用）。 */
function syncErrorText(e: any): string {
  const msg = (e && (e.message || String(e))) || '';
  return String(msg || '未知错误');
}

/**
 * 上传本地整库快照到云端。
 * @returns true = 服务端已接收；false = 被 Pro 门槛拦截或请求失败。
 */
export async function syncToCloud(): Promise<boolean> {
  /* 端点未配置：直接返回，不发请求、不弹 toast（入口已在 UI 隐藏） */
  if (!SYNC_ENABLED) return false;
  if (!isCloudSyncAllowed()) {
    try { deps.toast(SYNC_PRO_GATE_MESSAGE); } catch (e) { /* toast 不可用 */ }
    return false;
  }
  const snapshot = deps.getState();
  if (!snapshot || !snapshot.nodes) {
    try { deps.toast('云端同步失败：本地数据不可用'); } catch (e) { /* toast 不可用 */ }
    return false;
  }
  try {
    const res = await fetch(SYNC_PUSH_URL, {
      method: 'POST',
      /* 以 text/plain 发送 JSON 文本：属 CORS「简单请求」，不触发 OPTIONS 预检；
         Mock 服务端统一按原文 JSON.parse（见 server/license-server.mjs handleSyncPush），
         跨端口联调与自动化 Mock 都不依赖预检响应，链路更少、失败面更小。 */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ state: snapshot, clientAt: Date.now() }),
    });
    if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : '无响应'));
    const body = await res.json().catch(() => null);
    if (body && body.ok === false) throw new Error(String(body.error || '服务端拒绝'));
    try { deps.toast('已同步到云端'); } catch (e) { /* toast 不可用 */ }
    return true;
  } catch (e) {
    try { deps.toast('云端同步失败：' + syncErrorText(e)); } catch (_e) { /* toast 不可用 */ }
    return false;
  }
}

/**
 * 从云端拉取整库快照并合并进本地（节点级 LWW，幂等）。
 * @returns true = 已拉取（合并与否均算成功）；false = 被拦截 / 失败 / 无数据。
 */
export async function syncFromCloud(): Promise<boolean> {
  /* 端点未配置：直接返回，不发请求、不弹 toast（入口已在 UI 隐藏） */
  if (!SYNC_ENABLED) return false;
  if (!isCloudSyncAllowed()) {
    try { deps.toast(SYNC_PRO_GATE_MESSAGE); } catch (e) { /* toast 不可用 */ }
    return false;
  }
  try {
    const res = await fetch(SYNC_PULL_URL, { method: 'GET' });
    if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : '无响应'));
    const body = await res.json().catch(() => null);
    const remote = body && body.state ? body.state : (body && body.nodes ? body : null);
    if (!remote || !remote.nodes) {
      try { deps.toast('云端暂无可用数据'); } catch (e) { /* toast 不可用 */ }
      return false;
    }
    const changed = mergeRemoteIfNewer(remote);
    if (changed) { scheduleNotify(); schedulePersist(); }
    try { deps.toast(changed ? '已从云端拉取并合并' : '云端数据与本地一致'); } catch (e) { /* toast 不可用 */ }
    return true;
  } catch (e) {
    try { deps.toast('云端拉取失败：' + syncErrorText(e)); } catch (_e) { /* toast 不可用 */ }
    return false;
  }
}

/* ============================================================
   自挂载：store 的持久化端口接入真实实现（消除 M1-3 占位空壳）
   ============================================================ */

bindPersistStore({ schedulePersist });
