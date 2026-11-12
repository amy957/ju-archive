/**
 * M1-1 · 全局 Store 基础模块（state / listeners / notify 调度）
 *
 * 来源（逐行对应 canonical v2.0-t3.html）：
 *   - 2436-2496  _childSetCache / _childSetDrop / repairTreeConsistency（树一致性结构修复）
 *   - 2497-2499  const listeners / let state / let notifyPending
 *   - 2659-2730  initStore / getState
 *   - 5128-5137  subscribe / scheduleNotify
 *
 * 约束：时间戳归一、墓碑恢复、_localCreated / _remoteReceived 归一与结构修复逻辑逐字保留；
 *       仅追加 export 与 TS 类型注解（any 为纯类型层，运行期无行为差异）。
 *       M1-2（批次 AQ）：`schedulePersist` 的占位空壳已下线——真实落盘实现由 `core/persist`
 *       在模块装载时经 `bindPersistStore({ schedulePersist })` 反向挂载（见本文件 PersistStore 端口说明），
 *       故 `scheduleNotify() → schedulePersist() → core/persist.runPersist()` 为真实链路。
 */

import { resetNowSeq } from './actions';
import { countSubtreeChars, type WordCountResult } from './wordcount.worker';
/* 内联 Worker 构造器：`?worker&inline` 把 Worker 代码以 blob 内联进入口 bundle，
   保证「单 HTML 产物」约束（dist/ 只允许 index.html）不被 Worker chunk 破坏。 */
import WordCountWorkerFactory from './wordcount.worker?worker&inline';

export const listeners = new Set<(s: any) => void>();
export let state: any = null;
let notifyPending = false;

/* ====================================================================
 * M1-2+ 待接线依赖（本批次仅承接 initStore 的调用序列，保持可编译且顺序不变）
 * 说明：以下符号在产品件中分别属于 B1 的模块级缓存 / B2 日历索引 / B6 持久化与侧栏计数，
 *       尚未拆分到本工程，故以最小占位承接调用点。真实实现随对应模块迁移时替换，
 *       替换时不改变 initStore 内的调用顺序与 try/catch 边界。
 * ==================================================================== */
/* ====================================================================
 * M5-2 · 按需字数统计（超过阈值改由 Worker 计算，避免主线程长任务）
 * --------------------------------------------------------------------
 * 口径：
 *   - 节点总数 <= WORDCOUNT_WORKER_THRESHOLD（5,000）：主线程同步计算（与迁移前行为一致，零延迟）；
 *   - 节点总数 >  5,000：`docWordCount()` 返回缓存值（无缓存时为 null），同时投递一次 Worker 计算；
 *     Worker 完成后写入缓存并经 `scheduleNotify()` → `subscribe()` 监听者派发更新。
 * ==================================================================== */
export const WORDCOUNT_WORKER_THRESHOLD = 5000;
/** docId → 字数（Worker / 同步路径共用缓存） */
const _wordCountByDoc = new Map<string, number>();
const _wordCountCache = { clear: (): void => { _wordCountByDoc.clear(); } };
/** 懒创建的 Worker 实例（首次超过阈值时才创建，正常小文档零开销） */
let _wordCountWorker: Worker | null = null;
/** 最近入队 / 回传的请求（诊断与幂等用） */
let _wordCountPendingDocId: string | null = null;
let _wordCountLastResult: WordCountResult | null = null;
let _wordCountWorkerError: string | null = null;
let _wordCountTaskCount = 0;
const _docNodeCountCache = { clear: (): void => {} }; /* TODO: M1-2+ 节点计数缓存模块接线 */
const _searchHayCache = { clear: (): void => {} }; /* TODO: M1-2+ 搜索 haystack 缓存模块接线 */
let _recentlyRemoved = new Map<string, number>(); /* TODO: M1-2+ 墓碑模块接线 */
let _tombstoneQueue: string[] = []; /* TODO: M1-2+ 墓碑扫掠队列接线 */
let _tombstoneFifoHead = 0; /* TODO: M1-2+ 墓碑扫掠游标接线 */
/* 批次 AE：`_nowSeq` 及其水位 `_lastNowSeq` 已迁入 core/actions（模块内唯一实现），
   原此处同名水位占位下线；initStore 的水位复位改调 actions.resetNowSeq()（语义与原 `_lastNowSeq=0` 逐字等价）。 */
let _diskConfirmed: Set<string> | null = null; /* TODO: M1-2+ 落盘确认集接线 */
const _sideCountsSet = (_st: any, _counts: any): void => {}; /* TODO: M1-2+ 侧栏计数模块接线 */
const _sideCountsRebuild = (_st: any): any => ({}); /* TODO: M1-2+ 侧栏计数模块接线 */

/**
 * M1-1d / M1-2 · 持久化落盘显式端口
 *
 * 产品件中 `schedulePersist` 属落盘调度（明文全量落盘 / 加密落盘 / 桌面 SQLite 三通道）。
 * 本模块只保留「调度信号」这一职责：
 *   - **真实实现**：`core/persist` 模块装载时即调用 `bindPersistStore({ schedulePersist })`
 *     完成自挂载（批次 AQ），因此本端口的默认 noop 仅作为「persist 模块未装载」时的兜底存在，
 *     运行期不会再走到空壳分支；
 *   - 装配层（`src/main.ts`）亦可再经 `bindPersistStore()`（或 `initStore(initial, persist)` 的
 *     第二个参数）显式覆盖，用于注入诊断/测试实现。
 */
export interface PersistStore {
  /** 落盘调度（对应产品 `schedulePersist()`） */
  schedulePersist: () => void;
}

/** 未装载 core/persist 时的兜底端口（真实实现由 core/persist 自挂载覆盖） */
const PERSIST_NOOP: PersistStore = { schedulePersist: (): void => {} };

let _persistStore: PersistStore = { ...PERSIST_NOOP };

/** 注入 / 覆盖持久化影子层端口（局部覆盖，未提供的键保持既有实现）。 */
export function bindPersistStore(patch: Partial<PersistStore>): void {
  _persistStore = { ..._persistStore, ...patch };
}

/** 读取当前持久化影子层端口（只读视图，供装配期与诊断使用）。 */
export function getPersistStore(): PersistStore {
  return _persistStore;
}

/** 调度一次落盘（对应产品 `schedulePersist()`；经显式端口转发）。 */
export function schedulePersist(): void {
  _persistStore.schedulePersist();
}

/**
 * 批次 CA · 日历索引失效显式端口（M1-1 遗留空壳 `invalidateCalIndex` 修复）
 *
 * 背景：日历索引缓存的真实归属是 `views/calendar`（`_calIndexCache` / `_calRecurCache` /
 *   `_yearCountsCache` / `_calDayCache` / `_renderDayCache` + 代次 `_calDataRev`），
 *   而 `initStore()`（state 整体替换 / 导入 / 加密装载）必须把这份缓存一并作废，
 *   否则下一次日历渲染命中旧日缓存，表现为「新增待办不出现 / 改期不移动」。
 * 契约：
 *   - 未装配时端口为安全 noop（本模块保持可独立加载，不产生对 views 层的静态依赖）；
 *   - 装配层（`src/main.ts`）以 `bindCalIndexPort({ invalidateCalIndex })` 注入
 *     `views/calendar` 导出的**真实实现**（置空 5 项缓存 + 推进 `_calDataRev`）；
 *   - 装配后 `initStore()` 与 `actions.addNode / setNodeDate` 均经本端口走真实失效链路。
 */
export interface CalIndexPort {
  /** 日历索引失效（对应产品件 `invalidateCalIndex()`） */
  invalidateCalIndex: () => void;
}

/** 未装配真实实现时的兜底端口（装配层注入后运行期不再走空壳分支） */
const CALINDEX_NOOP: CalIndexPort = { invalidateCalIndex: (): void => {} };

let _calIndexPort: CalIndexPort = { ...CALINDEX_NOOP };

/** 注入 / 覆盖日历索引失效端口（局部覆盖，未提供的键保持既有实现）。 */
export function bindCalIndexPort(patch: Partial<CalIndexPort>): void {
  _calIndexPort = { ..._calIndexPort, ...patch };
}

/** 读取当前日历索引失效端口（只读视图，供装配期与诊断使用）。 */
export function getCalIndexPort(): CalIndexPort {
  return _calIndexPort;
}

/**
 * 日历索引失效（对应产品件 `invalidateCalIndex()`；经显式端口转发）。
 * 真实实现 = `views/calendar.invalidateCalIndex()`：置空上述 5 项缓存 + 标签索引缓存，
 * 并推进 `_calDataRev`（`_renderDayCache` 的代次来源）。
 */
export function invalidateCalIndex(): void {
  _calIndexPort.invalidateCalIndex();
}

let _childSetCache = new WeakMap<any, Set<string>>();
function _childSetDrop(n: any): void {try{if(n)_childSetCache.delete(n);}catch(e){console.warn('[JU] caught error',e);}}
/* 【修复 F-02】树一致性修复：以 parent 引用为准，父缺失挂回根，父存在则补回 children 缺项 */
export function repairTreeConsistency(): void {
  if(!state||!state.nodes||!state.rootId)return;
  const ns=state.nodes;
  const root=ns[state.rootId];
  if(!root)return;
  /* FIX-M-11: 第一遍用 Set 缓存各父节点 children 集合，避免每个节点 root.children.includes()/p.children.includes() 的 O(n²) 扫描
     L16-W6 · 指令 6：缓存提升为模块级 WeakMap（node→Set）——未变节点命中缓存零分配，仅新增/替换节点重建 */
  const _getChildSet=(pid: string): Set<string>=>{
    const node=ns[pid];
    if(!node)return new Set();
    let s=_childSetCache.get(node);
    if(!s){s=new Set(node.children||[]);_childSetCache.set(node,s);}
    return s;
  };
  /* 第一遍：修自引用、孤儿挂根、补 children 缺项（以 node.parent 为准） */
  for(const id in ns){
    if(id===state.rootId)continue;
    const n=ns[id];
    if(!n||typeof n!=='object')continue;
    if(n._deleted)continue; /* 【F1/fixed19】回收站节点脱离活树为设计行为，不修复其 parent/children */
    if(n.parent===id)delete n.parent;
    const p=(n.parent&&ns[n.parent])?ns[n.parent]:null;
    /* BUG-02 配套自愈：父存在但已进回收站（_deleted）时，活节点同样视为孤儿——
       先把自己从该父的 children 摘除，再挂回 root，避免活节点挂在 _deleted 父下形成不可达子树 */
    if(!p||p._deleted){
      if(p&&Array.isArray(p.children)){
        const _pi=p.children.indexOf(id);
        if(_pi>=0){p.children.splice(_pi,1);_childSetDrop(p);}
      }
      n.parent=state.rootId;
      if(!_getChildSet(state.rootId).has(id)){root.children.push(id);_getChildSet(state.rootId).add(id);}
    }else if(!_getChildSet(p.id).has(id)){
      p.children.push(id);_getChildSet(p.id).add(id);
    }
  }
  /* 【fixed20】第二遍：清除 stray/多父引用——node 出现在 p.children 中但 p≠node.parent。
     【fixed22/H2】O(n) 改写：遍历每个节点的 children 数组一次，child.parent!==当前节点即 stray。
     语义等价于原 O(n²) 双循环，但只扫描 children 总长一次。_deleted 跳过。
     【QA-P1-2】同遍做保序去重：并发移动+LWW 平局可能产生 p.children=[A,A]（L1178-1203 移动语义已尽力避免，
     此处兜底），去重保证不变量「children 无重复 ID」。 */
  for(const pid in ns){
    const p=ns[pid];
    if(!p||!Array.isArray(p.children))continue;
    /* L16-W6 · 指令 6：复用缓存 Set 作 seen——clear 后就地重填为存活 children 集，免每父分配且保持缓存与 p.children 一致 */
    let seen=_childSetCache.get(p);
    if(!seen){seen=new Set();_childSetCache.set(p,seen);}
    seen.clear();
    /* FIX-M-01: 正向遍历保留首次出现位置，删除后续重复（原反向遍历留尾删头，首位置被尾位置顶替） */
    for(let i=0;i<p.children.length;i++){
      const cid=p.children[i];
      if(seen.has(cid)){p.children.splice(i,1);i--;continue;} /* 重复 ID：保留首次，删后续重复 */
      seen.add(cid);
      const c=ns[cid];
      if(!c||c._deleted)continue; /* _deleted 节点不修复 */
      if(c.parent!==pid){p.children.splice(i,1);i--;seen.delete(cid);} /* stray：child.parent 指向别处，从本 children 删除（缓存同步剔除，保持恒等） */
    }
  }
}

export function initStore(initial: any, persist?: Partial<PersistStore>): void {
  /* M1-1d：持久化影子层随 state 装载显式注入（不再依赖模块级隐式挂载）。 */
  if(persist)bindPersistStore(persist);
  state=initial;
  /* 批次 3-B：侧栏结构版本归一化（旧快照 / 本地存储无此字段 → 补 0；仅服务侧栏指纹，不参与写盘与 LWW） */
  if(typeof state._structRev!=='number')state._structRev=0;
  for (const id in state.nodes) {
    const n = state.nodes[id];
    if (!n) continue;
    if (n.createdAt > 8.64e14) n.createdAt = Math.round(n.createdAt / 1000);
    if (n.updatedAt > 8.64e14) n.updatedAt = Math.round(n.updatedAt / 1000);
    /* L17-W3 · 指令 1：补充秒级时间戳归一（旧数据以秒存储时 0<v<1e10 统一 ×1000 转毫秒），
       与 mergeRemoteState 的 _normToMs（L16-W21 · 指令 12）同口径；否则秒级旧值参与 LWW 比较
       会被当作远古时间，或与毫秒值混比失真。微秒 / 正常毫秒分支不受影响。 */
    if (n.createdAt > 0 && n.createdAt < 1e10) n.createdAt = Math.round(n.createdAt * 1000);
    if (n.updatedAt > 0 && n.updatedAt < 1e10) n.updatedAt = Math.round(n.updatedAt * 1000);
  }
  /* L17-W4 · OP-L17W3-2：根级元数据 state.updatedAt 同口径秒级归一（此前仅节点级归一，
     全局 LWW 比较仍依赖 mergeRemoteState 的就地归一）。 */
  if (state.updatedAt > 0 && state.updatedAt < 1e10) state.updatedAt = Math.round(state.updatedAt * 1000);
  if(state.trashed&&state.trashed.length){
    state.trashed=state.trashed.filter((t: any)=>t&&t.rootId&&state.nodes[t.rootId]);
  }
  _wordCountCache.clear();
  try{_docNodeCountCache.clear();}catch(_e){console.warn('[JU] caught error',_e);} /* 批次 4-C：state 整体替换（initStore / 导入）⇒ 节点计数缓存清空 */
  _childSetCache=new WeakMap(); /* L16-W6 · 指令 6：state.nodes 整体替换 ⇒ 旧节点引用的 children 缓存失效，重置 WeakMap */
  invalidateCalIndex();
  /* FIX-M-21: initStore 统一清全部模块级缓存——_searchHayCache 按 id+updatedAt 缓存，state 整体替换后旧条目陈旧 */
  try{_searchHayCache.clear();}catch(e){console.warn('[JU] caught error',e);}
  /* FIX-TOMB-1: 墓碑跨会话恢复（不再无条件清空）：30s 内删除的节点，即使本页崩溃/重开，
     也要防离线对端重连后发旧快照复活。未过期墓碑导入 _recentlyRemoved；state._tombstones
     保留未过期条目（不整体摘除——刷新后首次持久化仍携带，30s 内二次刷新保护不丢），
     过期条目就地清理。 */
  try{
    _tombstoneQueue=[];_tombstoneFifoHead=0; /* L16-W8 · 指令 8：新会话重建墓碑扫掠队列（游标归零） */
    if(state._tombstones&&typeof state._tombstones==='object'){
      const _now=Date.now();
      for(const k in state._tombstones){
        const _ts=+state._tombstones[k];
        if(_ts&&_now-_ts<=30000){_recentlyRemoved.set(k,_ts);_tombstoneQueue.push(k);}
        else delete state._tombstones[k];
      }
    }
  }catch(e){console.warn('[JU] caught error',e);}
  /* FIX-ORIGIN-1: 归一化 _localCreated（本页/本会话新建节点 id 的持久化标记）：
     用于持久化后 _origin 被剥离的跨会话删除传播保护（对端快照未含该节点时不视为「对端已删」）。
     保留仍存在且未重复的 id；不做硬数量上限（FIX-ORIGIN-2：批量导入一次创建上千节点时，
     硬截断会使后部节点失去保护而被对端旧快照误删；去重+存在过滤已足够防脏数据）。 */
  try{
    const lc=Array.isArray(state._localCreated)?state._localCreated.filter((id: any,i: number,a: any[])=>typeof id==='string'&&state.nodes[id]&&a.indexOf(id)===i):[];
    state._localCreated=lc;
  }catch(e){try{state._localCreated=[];}catch(e2){console.warn('[JU] caught error',e2);}}
  /* L16-W13 · 指令 4（Defect-F）：归一化对端合入保护集 _remoteReceived（去重 + 只保留存在的节点）。
     与 _localCreated 同口径：无硬上限（批量广播一次可合入上千节点），去重 + 存在过滤已足够防脏数据。 */
  try{
    const rr=Array.isArray(state._remoteReceived)?state._remoteReceived.filter((id: any,i: number,a: any[])=>typeof id==='string'&&state.nodes[id]&&a.indexOf(id)===i):[];
    state._remoteReceived=rr;
  }catch(e){try{state._remoteReceived=[];}catch(e2){console.warn('[JU] caught error',e2);}}
  /* FIX-num-1 恢复状态后重置新建时间戳序号水位：state 整体替换为旧/导入数据后，_lastNowSeq 仍残留本会话此前的高水位，
     会使 _nowSeq() 返回旧高水位+1（可能偏离真实 Date.now()），与恢复数据内的时间戳发生序号交叉。
     重置为 0 后，下一次 _nowSeq() 取真实 Date.now()（>0），新节点时间戳回到当前墙钟，最小语义、不引入对导入数据的假设。
     批次 AE：水位实体已迁入 core/actions，此处经 resetNowSeq() 复位同一变量（跨模块单一水位）。 */
  resetNowSeq();
  /* 【F1/fixed19】启动期结构修复：migrateStateObject 不修复可达节点的悬空 parent/互反 children，
     仅运行期 mergeRemoteState 尾部调用 repairTreeConsistency。此处补一次启动期修复，
     覆盖自引用/悬空 parent→挂根/孤儿→挂根/children 互反，使 05-crash S4 翻 pass。 */
  try{repairTreeConsistency();}catch(e){console.warn('[JU] caught error',e);}
  /* 【H1/fixed22】防御性 _diskConfirmed 初始化：明文 boot 已在 11642 同步 markDiskConfirmed，
     加密路径 markDiskConfirmed 异步（1608 路径）有窄竞态。此处兜底确保删除传播守卫
     不会因 _diskConfirmed===null 而放行所有删除（null 时守卫跳过=删除照常）。 */
  try{_diskConfirmed=new Set(Object.keys(state.nodes||{}));}catch(e){console.warn('[JU] caught error',e);}
  /* L16-W3 · 指令 3：侧栏计数整体重建（state 整体替换后调用；counts 以 Symbol 键挂载，序列化不可见） */
  try{_sideCountsSet(state,_sideCountsRebuild(state));}catch(e){console.warn('[JU] caught error',e);}
}
export function getState(): any {return state;}
/**
 * M1-3 · 状态整体替换出口。
 *
 * 远端 LWW 合并 / 本地 immutable 提交均经本函数回写 `state` 绑定，保证
 * `getState()` 与各模块注入的 `deps.state` 始终读到同一份最新引用。
 * 仅持久化层（core/persist）与本模块 commit 使用，其余模块不得直接赋值。
 */
export function setState(next: any): void {state=next;}
export function subscribe(fn: (s: any) => void): () => void {listeners.add(fn);return()=>listeners.delete(fn);}
export function scheduleNotify(): void {
  if(notifyPending)return;
  notifyPending=true;
  queueMicrotask(()=>{
    notifyPending=false;
    listeners.forEach(fn=>{try{fn(state);}catch(e){console.error(e);}});
    _persistStore.schedulePersist();
  });
}

/* ====================================================================
 * M5-2 · 按需字数统计（Worker 化）
 * ==================================================================== */

/** 懒创建字数 Worker（module worker；构建期由 vite `worker.format='es'` 支撑）。 */
function ensureWordCountWorker(): Worker | null {
  if (_wordCountWorker) return _wordCountWorker;
  if (typeof Worker === 'undefined') return null;
  try {
    _wordCountWorker = new WordCountWorkerFactory();
    _wordCountWorker.onmessage = (ev: MessageEvent<WordCountResult>): void => {
      const res = (ev && ev.data) || null;
      if (!res || typeof res.docId !== 'string') return;
      _wordCountByDoc.set(res.docId, Number(res.wordCount) || 0);
      _wordCountLastResult = { docId: res.docId, wordCount: Number(res.wordCount) || 0 };
      _wordCountPendingDocId = null;
      _wordCountTaskCount += 1;
      /* 计算完成 → 经 store 的既有通知通道（scheduleNotify → subscribe 监听者）派发更新 */
      scheduleNotify();
    };
    _wordCountWorker.onerror = (ev: ErrorEvent): void => {
      _wordCountWorkerError = String((ev && (ev.message || ev.type)) || 'worker error');
      _wordCountPendingDocId = null;
    };
  } catch (e) {
    _wordCountWorkerError = String((e && (e as Error).message) || e);
    _wordCountWorker = null;
  }
  return _wordCountWorker;
}

/**
 * 投递一次异步字数计算（超过阈值路径）。
 * 返回 true = 已投递给 Worker；false = Worker 不可用（调用方应回落同步路径）。
 */
export function requestDocWordCountAsync(docId: string): boolean {
  if (!state || !state.nodes || !docId) return false;
  const worker = ensureWordCountWorker();
  if (!worker) return false;
  _wordCountPendingDocId = docId;
  try {
    /* 结构快照按结构化克隆交给 Worker：只发节点表，不动线上 state 引用 */
    worker.postMessage({ nodes: state.nodes, docId });
    return true;
  } catch (e) {
    _wordCountWorkerError = String((e && (e as Error).message) || e);
    _wordCountPendingDocId = null;
    return false;
  }
}

/**
 * 文档字数（M5-2）。
 *
 * - 节点总数 <= 5000：主线程同步计算并写入缓存后返回实际值；
 * - 节点总数 >  5000：命中缓存直接返回；未命中则先触发一次 Worker 计算并返回 null，
 *   计算完成后经 `subscribe(fn)` 收到一次通知（state 引用不变，监听者用 `docWordCount` 取新值）。
 * - Worker 不可用（无 Worker 环境 / 创建失败）：回落同步计算，保证功能不降级。
 */
export function docWordCount(docId: string): number | null {
  if (!state || !state.nodes || !docId) return 0;
  const total = Object.keys(state.nodes).length;
  if (total <= WORDCOUNT_WORKER_THRESHOLD) {
    const v = countSubtreeChars(state.nodes, docId);
    _wordCountByDoc.set(docId, v);
    return v;
  }
  if (_wordCountByDoc.has(docId)) {
    /* 大文档：缓存命中即返回；同时确保不重复投递同一文档的并发请求 */
    if (_wordCountPendingDocId !== docId && _wordCountLastResult && _wordCountLastResult.docId !== docId) {
      requestDocWordCountAsync(docId);
    }
    return _wordCountByDoc.get(docId) as number;
  }
  if (_wordCountPendingDocId !== docId) {
    if (!requestDocWordCountAsync(docId)) {
      const v = countSubtreeChars(state.nodes, docId);
      _wordCountByDoc.set(docId, v);
      return v;
    }
  }
  return null;
}

/** 清空字数缓存（state 整体替换 / 导入后调用）。 */
export function clearDocWordCountCache(): void { _wordCountCache.clear(); }

/** Worker 路径诊断视图（只读；供探针与报告取证）。 */
export function getWordCountDiagnostics(): {
  threshold: number;
  workerCreated: boolean;
  pendingDocId: string | null;
  lastResult: WordCountResult | null;
  error: string | null;
  completedTasks: number;
  cachedDocs: number;
} {
  return {
    threshold: WORDCOUNT_WORKER_THRESHOLD,
    workerCreated: !!_wordCountWorker,
    pendingDocId: _wordCountPendingDocId,
    lastResult: _wordCountLastResult,
    error: _wordCountWorkerError,
    completedTasks: _wordCountTaskCount,
    cachedDocs: _wordCountByDoc.size,
  };
}

/** 释放 Worker（测试 / 桌面端退出前清理）。 */
export function disposeWordCountWorker(): void {
  try { if (_wordCountWorker) _wordCountWorker.terminate(); } catch (e) { /* 已终止或无 Worker */ }
  _wordCountWorker = null;
  _wordCountPendingDocId = null;
}
