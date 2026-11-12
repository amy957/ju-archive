/**
 * M1-1 · 批次 T · 日历主视图（索引 / 月·年·周视图 / 时间网格 / 模块化面板 / 待办行）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - 日历容器 + 农历：ensureCalendarRoot / getCalendarRootId / dedupCalRoots ..... 9203-9255
 *   - expandRecurring .................................................. 9256-9311
 *   - lunarToSolarDate（迁入 ../utils/lunar）............................ 9312-9322
 *   - _calSubtreeStep / _calSweepStep / buildCalIndex ................... 9323-9371
 *   - buildRecurList / calendarTodosOnDate / buildYearCounts ........... 9372-9497
 *   - 日历索引缓存与失效：_calIndexCache/_calRecurCache/_yearCountsCache/
 *     _calDayCache/_calDataRev/_calSelKey/invalidateCalIndex/
 *     invalidateCalIndexOnly ........................................... 2731-2768
 *   - l7CalIndexWhenReady / _calIndexFallbackAttempted ................. 4852-4861
 *   - 时间网格：tgHourH/tgTotalH/_calTgTimer/clearCalTgTimer/cnNow/
 *     cnYmd/tgTimeY/tgNowY/tgDayNodes/buildTimeGrid/startCalTgTimer ..... 10008-10304
 *   - 事件块拖拽时段：bindCalEventDrag ................................. 11000-11118
 *   - 日历模块化：CAL_MODULE_KEYS/_calDayNodesForModules/calModuleState/
 *     calModuleTitle/calModuleDayNodes/calModuleBadge/calModuleNoteBody/
 *     calModuleTodayBody/calModuleLogBody/calModuleStatsBody/
 *     calModuleCharsDates/calModuleCharsBody/calModuleBindDrag/
 *     calModuleBindResize/renderCalModules ............................. 10305-10764
 *   - renderCalendarPage ............................................... 10765-10989
 *   - 日历待办右键折叠菜单：_calCtxEl/closeCalNodeMenu/openCalNodeMenu ... 11125-11422
 *   - renderCalNode .................................................... 11423-11603
 *
 * 约束：DOM 结构、类名、内联样式、交互顺序、提示文案与 FIX/批次注释逐字保留。
 *   未拆分业务符号统一走 `deps` 依赖注入容器（原直接调用改为 `deps.xxx`），由 src/main.ts 装配：
 *     ui / state / N() / commit() / nowSeq() / forceRender() / saveUI() / actions /
 *     makeLRU / isBlankNode / nodeHasTag / tagStripText / getTagColor / extractTags /
 *     findOwningTopDocId / calendarTagIndex / buildCalLogBlock / buildStatsBlock /
 *     getCalScopeText / l7Skeleton / isCalendarView / ensureCalIndexAsync / l7Now /
 *     currentBaseFontPx / renderNoteRow / ensureNoteDoc / persistNow / sanitizeHtml /
 *     parsePasteLines / splitPastedLinesToNodes / trimPasteHtml / safeExec / undo / redo /
 *     getTagIndexCache / setTagIndexCache / lastPointerType。
 *   已拆分模块直接 import：pad / ymd / stripHtml / esc / parseYmd / todayStr / uid（core/utils）；
 *     toast / showContextMenu（ui/common）；dayLabel / parseNaturalDate / isRestDay /
 *     solarToLunar / lunarToSolarDate（utils/lunar）；fmtHm / snapHalfMins / calMinToHm /
 *     clampM / mkCalSel / openCalTimeModal（ui/timepicker）；syncEmptyState /
 *     isBlurSuppressed / focusAfterRender / resetSavedFocus（ui/focus）；
 *     linkTitleAtPoint / navigateToWikiLink（ui/rightbar）。
 */
import { pad, ymd, stripHtml, esc, parseYmd, todayStr, uid } from '../core/utils';
import { sanitizeHtml, safeExec, parsePasteLines, parseIndentedOutline, trimPasteHtml, type IndentedOutlineNode } from '../core/richtext';
import { toast, showContextMenu } from '../ui/common';
import { dayLabel, parseNaturalDate, isRestDay, solarToLunar, lunarToSolarDate } from '../utils/lunar';
import { fmtHm, snapHalfMins, calMinToHm, clampM, mkCalSel, openCalTimeModal } from '../ui/timepicker';
import { syncEmptyState, isBlurSuppressed, focusAfterRender, resetSavedFocus } from '../ui/focus';
import { linkTitleAtPoint, navigateToWikiLink } from '../ui/rightbar';

/** 日历待办列表（附 rawTotal：标签过滤前总数，FIX-L-15 口径）。 */
export type CalTodos = any[] & { rawTotal?: number };

/** 粘贴解析结果（对应产品 parsePasteLines 的返回形状）。 */
export interface PasteLines {
  lines: string[];
  html?: string;
  plain?: string;
  /** 解析器给出的缩进大纲树（HTML 嵌套优先，其次 plain 缩进）。 */
  tree?: IndentedOutlineNode[] | null;
}

/** 缩进树最大深度（parsed.tree 与 plain 缩进树择优用；空树记 0）。 */
function pasteTreeDepth(tree:any): number {
  let d=0;
  (tree||[]).forEach((n:any)=>{const c=1+pasteTreeDepth(n&&n.children);if(c>d)d=c;});
  return d;
}

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export interface CalendarDeps {
  /** 全局 UI 状态对象（对应产品的 `ui`） */
  ui: any;
  /** 全局数据状态（对应产品的 `state`） */
  state: any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** 不可变提交（对应产品的 `commit`） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** 逻辑序号时钟（对应产品的 `_nowSeq`） */
  nowSeq: () => any;
  /** 请求下一次渲染 */
  forceRender: () => void;
  /** UI 状态持久化（对应产品的 `saveUI`） */
  saveUI: () => void;
  /** 业务动作集合（addNode / removeNode / updateText / toggleDone / clearNodeSchedule / logActivity …） */
  actions: any;
  /** 有界 LRU（对应产品的 `makeLRU(max)`） */
  makeLRU: (max: number) => any;

  /* 节点语义判定 */
  isBlankNode: (n: any) => boolean;
  nodeHasTag: (n: any, tag: string) => boolean;
  tagStripText: (n: any) => string;
  getTagColor: (t: string) => any;
  extractTags: (s: string) => string[];
  findOwningTopDocId: (id: any, s: any) => any;

  /* 日历侧边模块取数 / 渲染 */
  calendarTagIndex: () => Map<string, number>;
  buildCalLogBlock: () => HTMLElement;
  buildStatsBlock: () => HTMLElement;
  getCalScopeText: () => string;
  renderNoteRow: (n: any, depth: number) => HTMLElement;
  ensureNoteDoc: () => any;

  /* 两阶段渲染 / 索引流水线 */
  l7Skeleton: (kind: string, opts: any) => HTMLElement;
  isCalendarView: () => boolean;
  ensureCalIndexAsync: (mode: any) => Promise<any>;
  tagIndexWhenReady: (cb: () => void) => void;
  l7Now: () => number;

  /* 字号 / 持久化 / 富文本 */
  currentBaseFontPx: () => number;
  persistNow: () => void;
  sanitizeHtml: (s: string) => string;
  parsePasteLines: (dt: any) => PasteLines;
  splitPastedLinesToNodes: (text: HTMLElement, id: any, lines: string[], extra?: any, tree?: any) => boolean;
  trimPasteHtml: (h: string) => string;
  safeExec: (cmd: string, val?: string) => void;
  undo: () => any;
  redo: () => any;

  /* 标签索引缓存（invalidateCalIndex 与右键菜单共用同一份） */
  getTagIndexCache: () => Map<string, number> | null;
  setTagIndexCache: (v: any) => void;

  /* 全局最近指针类型（触屏长按放行系统菜单，对应产品的 `_lastPointerType`） */
  lastPointerType: () => string;
}

/**
 * 依赖注入容器（装配入口；占位实现保证模块被加载/调用时不抛 ReferenceError）。
 * 真实实现在对应批次迁移时以 injectCalendarDeps 覆盖回填。
 */
export const deps: CalendarDeps = {
  ui: {},
  state: { nodes: {}, rootId: null },
  N: () => null,
  commit: () => undefined,
  nowSeq: () => 0,
  forceRender: () => undefined,
  saveUI: () => undefined,
  actions: {},
  makeLRU: () => new Map(),
  isBlankNode: () => false,
  nodeHasTag: () => false,
  tagStripText: () => '',
  getTagColor: () => 'transparent',
  extractTags: () => [],
  findOwningTopDocId: () => null,
  calendarTagIndex: () => new Map(),
  buildCalLogBlock: () => document.createElement('div'),
  buildStatsBlock: () => document.createElement('div'),
  getCalScopeText: () => '',
  renderNoteRow: () => document.createElement('div'),
  ensureNoteDoc: () => null,
  l7Skeleton: () => document.createElement('div'),
  isCalendarView: () => false,
  ensureCalIndexAsync: () => Promise.resolve(null),
  tagIndexWhenReady: () => undefined,
  l7Now: () => Date.now(),
  currentBaseFontPx: () => 14,
  persistNow: () => undefined,
  /* M1-1c：富文本安全与粘贴解析统一取自 core/richtext（单一来源，不再保留模块内占位实现）。 */
  sanitizeHtml,
  parsePasteLines,
  splitPastedLinesToNodes: () => false,
  trimPasteHtml,
  safeExec,
  undo: () => false,
  redo: () => false,
  getTagIndexCache: () => null,
  setTagIndexCache: () => undefined,
  lastPointerType: () => 'mouse',
};

/** 覆写依赖（main.ts 装配时调用）。 */
export function injectCalendarDeps(patch: Partial<CalendarDeps>): void {
  Object.assign(deps, patch);
}

/* ── 日历索引缓存（原产品全局作用域 2731-2741） ── */
let _calIndexCache: Map<string, Set<any>> | null = null;
let _calRecurCache: any[] | null = null;
let _yearCountsCache: { year: number; map: Map<string, number> } | null = null;
let _calDayCache: any = null;
/* L16-W2（指令2）: 日历数据代次 _calDataRev + 选择态签名 _calSelKey。_renderDayCache 的失效粒度由
   state.updatedAt（每次 commit 单调递增，含大纲正文编辑 / 折叠态切换）改为独立代次 _calDataRev：
   仅在「日历数据失效」（invalidateCalIndex / _calIndexCache 被置空）或「选择态变化」（ui.selectedDate /
   ui.calTagFilter）时递增；日历待办不变时不再整表重建 2000 条 LRU。 */
let _calDataRev = 0;
let _calSelKey = '';

/** 日历索引缓存只读视图（装配 / 诊断用）。 */
export function getCalIndexCache(): Map<string, Set<any>> | null { return _calIndexCache; }
/** 日历索引缓存写入（异步索引构建完成后回填）。 */
export function setCalIndexCache(v: Map<string, Set<any>> | null): void { _calIndexCache = v; }
/** 日历数据代次只读视图。 */
export function getCalDataRev(): number { return _calDataRev; }

export function invalidateCalIndex(): void {
  _calIndexCache = null;
  _calDataRev++; /* L16-W2: 日历索引失效与日历数据代次同步推进（_renderDayCache 的 _gen 来源） */
  _calRecurCache = null;
  _yearCountsCache = null;
  deps.setTagIndexCache(null);
  _calDayCache = null;
  _renderDayCache = null; /* FIX-S-1: 日历渲染日缓存同代失效，防双层缓存不一致 */
}
/* L16-W20（指令 11 · Defect-L）：索引层失败时的统一日历失效入口。
   仅当 _calIndexCache 实有缓存（已构建且待失效）才置空并推进 _calDataRev；已为 null 时直接返回。
   非日历索引（tag / searchInverted / backlinkMap / injection）失败不再推进日历数据代次，
   从而不触发 _renderDayCache 整表重建（2000 条 LRU），避免回退 L16-W2 的失效粒度优化。
   返回 true = 本次确实失效了日历索引；false = 本就为 null（未构建或已失效，置空无意义）。 */
export function invalidateCalIndexOnly(): boolean {
  if(_calIndexCache === null)return false;
  _calIndexCache = null;
  _calDataRev++; /* L16-W2: _calIndexCache 实际置空 → 推进日历数据代次 */
  return true;
}
let _calIndexFallbackAttempted = false;
export function l7CalIndexWhenReady(cb: () => void): void {
  Promise.resolve(deps.ensureCalIndexAsync(null)).then(function(){ if(cb)cb(); }, function(){
    if(!_calIndexFallbackAttempted){
      _calIndexFallbackAttempted = true;
      try{ _calIndexCache = _calIndexCache || buildCalIndex(); }catch(_e){console.warn('[JU] caught error',_e);}
    }
    if(cb)cb();
  });
}
/** 索引回退一次性标志只读视图（诊断用）。 */
export function getCalIndexFallbackAttempted(): boolean { return _calIndexFallbackAttempted; }

/* ============================================================
   日历容器
   ============================================================ */
/* 批次 CA · 建根重入守卫：`getCalendarRootId()` 找不到根时回调本函数，本函数末尾又回调
   `getCalendarRootId()` 复核——当 `deps.commit` 未装配（占位）/ 提交失败 / state 空表时，
   根永远建不出来，二者会形成无限互递归（Chrome: RangeError: Maximum call stack size exceeded），
   并在 `boot()` 的 `deps.ensureCalendarRoot()` 处中断整个启动链。
   守卫语义：仅在「解析链内重入」时返回 null（调用方按「暂无日历根」处理），
   正常装配（commit 真实、根可建）路径的行为与返回值完全不变。 */
let _calRootResolveDepth = 0;
export function ensureCalendarRoot(): any {
  let id: any = null;
  for(const nid in deps.state.nodes){ if(deps.state.nodes[nid]._isCalRoot){id = nid;break;} }
  if(id)return id;
  if(_calRootResolveDepth > 0)return null; /* 重入：本次建根未生效（无根），不再递归复核 */
  _calRootResolveDepth++;
  try{
    id = uid();
    deps.commit((s: any) => {
      const root = s.nodes[s.rootId];
      if(!root)return;
      s.nodes[id] = { id, text: '日历待办', parent: root.id, children: [], collapsed: false,
        done: false, date: null, tags: [], priority: 0, recur: null, habit: null, time: null,
        note: null, color: null, showInCal: false, _isCalRoot: true, _isFolder: true,
        createdAt: Date.now(), updatedAt: Date.now() };
      root.children.push(id);
    }, { silent: true, persistOnly: true });
    /* FIX-P0-2: 多根去重——多标签并发首开各建一个 _isCalRoot，合并后可能并存两个日历根；
       去重后重新解析保留根（本函数刚建的根若更晚创建会被并入保留根，返回其 id 供调用方使用） */
    dedupCalRoots();
    /* 复核必须在守卫内完成：根已建成 → 返回其 id；仍无根（占位 commit）→ 重入分支返回 null */
    return getCalendarRootId();
  }finally{
    _calRootResolveDepth--;
  }
}
export function getCalendarRootId(): any {
  for(const nid in deps.state.nodes){ if(deps.state.nodes[nid]._isCalRoot)return nid; }
  return ensureCalendarRoot();
}
/* FIX-P0-2: 日历根多根去重——参照 dedupNoteRoots；多标签并发首开各自 commit 一个 _isCalRoot，
   合并后 state.nodes 可能同时存在两个日历根，getCalendarRootId 只取首个 → 第二根的待办在日历页不可见。
   只保留 createdAt 最早的根，其余根 children 挂入保留根并从旧父摘除；commit 带 noHistory 防撤销复活。 */
export function dedupCalRoots(): void {
  try{
    const all = Object.values(deps.state.nodes).filter((n: any) => n && n._isCalRoot && !n._deleted) as any[];
    if(all.length <= 1)return;
    all.sort((a, b) => ((a.createdAt || 0) - (b.createdAt || 0)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const keep = all[0];
    all.slice(1).forEach(d => {
      deps.commit((s: any) => {
        const k = s.nodes[keep.id], dd = s.nodes[d.id];
        if(!k || !dd)return;
        (dd.children || []).forEach((c: any) => {
          if(s.nodes[c]){
            s.nodes[c].parent = keep.id;
            if(!k.children.includes(c))k.children.push(c);
          }
        });
        const p = s.nodes[dd.parent];
        if(p && Array.isArray(p.children)){const i = p.children.indexOf(d.id);if(i >= 0)p.children.splice(i, 1);}
        delete s.nodes[d.id];
      }, { snapshot: true, noHistory: true });
    });
    deps.forceRender();
  }catch(e){console.warn('[JU] caught error',e);}
}
export function expandRecurring(n: any, targetDs: string): boolean {
  if(!n.recur || !n.date)return false;
  if(n.recurEnd && targetDs > n.recurEnd)return false; /* 重复结束日期：超出后不再展开 */
  const base = parseYmd(n.date);
  const target = parseYmd(targetDs);
  if(isNaN(base.getTime()) || isNaN(target.getTime()))return false;
  if(target < base)return false;
  const freq = n.recur.freq;
  const interval = Math.max(1, Math.floor(Number(n.recur.interval) || 1));
  const weekday = n.recur.weekday;
  if(freq === 'daily'){const diff = Math.round((target.getTime() - base.getTime()) / 86400000);return diff % interval === 0;}
  if(freq === 'weekly'){
    if(weekday != null){
      if(target.getDay() !== weekday)return false;
      const bs = new Date(base);bs.setDate(bs.getDate() - bs.getDay());
      const ts = new Date(target);ts.setDate(ts.getDate() - ts.getDay());
      const weeks = Math.round((ts.getTime() - bs.getTime()) / 86400000 / 7);
      return weeks >= 0 && weeks % interval === 0;
    }
    const diff = Math.round((target.getTime() - base.getTime()) / 86400000);
    return diff % (7 * interval) === 0;
  }
  if(freq === 'monthly'){
    return target.getDate() === base.getDate() &&
      ((target.getFullYear() - base.getFullYear()) * 12 + (target.getMonth() - base.getMonth())) % interval === 0;
  }
  if(freq === 'yearly'){
    return target.getMonth() === base.getMonth() && target.getDate() === base.getDate() &&
      (target.getFullYear() - base.getFullYear()) % interval === 0;
  }
  if(freq === 'workday'){
    /* 每法定工作日：周一~周五且非法定休假日（isRestDay 表）；从 base 起按工作日计数取 interval */
    const dow = target.getDay();
    if(dow === 0 || dow === 6)return false;
    if(isRestDay(target.getFullYear(), target.getMonth() + 1, target.getDate()))return false;
    let wc = 0;const cur = new Date(base);
    while(cur < target){
      const d = cur.getDay();
      if(d !== 0 && d !== 6 && !isRestDay(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()))wc++;
      cur.setDate(cur.getDate() + 1);
    }
    return wc % interval === 0;
  }
  if(freq === 'lunar'){
    /* 每年（农历日）重复：目标年农历同月同日的公历日期与目标日一致 */
    if(target.getFullYear() === base.getFullYear())return false; /* 同年仅 base 自身（索引直接显示） */
    if(target.getFullYear() - base.getFullYear() < 0)return false;
    if((target.getFullYear() - base.getFullYear()) % interval !== 0)return false;
    const lu = solarToLunar(base.getFullYear(), base.getMonth() + 1, base.getDate());
    if(!lu)return false;
    const hit = lunarToSolarDate(target.getFullYear(), lu.month, lu.day);
    if(!hit)return false;
    return ymd(target) === ymd(new Date(hit.y, hit.m - 1, hit.d));
  }
  return false;
}
/* L7-W4：calIndex 的两个「可让出」构建步骤。
   - 同步 buildCalIndex 传 deadline=Infinity（逐节点 _l7Now()>=Infinity 恒 false，语义与改造前逐字一致）
   - 异步 l7BuildCalIndexAsync 传真实 deadline 并在块间 _l7Yield() → 主线程无 >50ms 长任务
   同步/异步共用同一对步骤 → 口径 1:1 由结构保证（非两套实现） */
function _calSubtreeStep(stack: any[], visited: Set<any>, idx: Map<string, Set<any>>, deadline: number): boolean {
  while(stack.length){
    const pid = stack.pop();
    if(visited.has(pid))continue;
    visited.add(pid);
    const parent = deps.N(pid);if(!parent)continue;
    (parent.children || []).forEach((cid: any) => {
      const n = deps.N(cid);
      if(!n || n._deleted)return;
      if(n.date){if(!idx.has(n.date))idx.set(n.date, new Set());(idx.get(n.date) as Set<any>).add(cid);}
      stack.push(cid);
    });
    if(deps.l7Now() >= deadline)return true;
  }
  return false;
}
/* FIX-H-09: 与 nodesOnDate（script_0.js 全表扫）口径统一——除 calRoot 子树外，
   补扫全树其他带 date 属性但不在 calRoot 子树的节点（"添加到日历"菜单 setNodeDate 打的日期）。
   用 visited 去重防双计；calRoot 子树待办语义不变，日历视图不出现重复条目。 */
function _calSweepStep(ids: string[], i: number, deadline: number, visited: Set<any>, idx: Map<string, Set<any>>): number {
  while(i < ids.length){
    const id = ids[i];i++;
    const n = deps.state.nodes[id];
    if(n && !n._deleted && n.date && !visited.has(id)){ /* 已在 calRoot 子树，跳过 */
      visited.add(id);
      if(!idx.has(n.date))idx.set(n.date, new Set());
      (idx.get(n.date) as Set<any>).add(id);
    }
    if(deps.l7Now() >= deadline)break;
  }
  return i;
}
export function buildCalIndex(): Map<string, Set<any>> {
  if(_calIndexCache)return _calIndexCache;
  const idx = new Map<string, Set<any>>();
  const calRootId = getCalendarRootId();
  const stack = [calRootId];
  const visited = new Set<any>();
  _calSubtreeStep(stack, visited, idx, Infinity);
  const ids = Object.keys(deps.state.nodes);
  let i = 0;
  while(i < ids.length)i = _calSweepStep(ids, i, Infinity, visited, idx);
  _calIndexCache = idx;
  return idx;
}
export function buildRecurList(): any[] {
  if(_calRecurCache)return _calRecurCache;
  const list: any[] = [];
  const calRootId = getCalendarRootId();
  const stack = [calRootId];const visited = new Set<any>();
  while(stack.length){
    const pid = stack.pop();
    if(visited.has(pid))continue;
    visited.add(pid);
    const parent = deps.N(pid);if(!parent)continue;
    (parent.children || []).forEach((cid: any) => {
      const n = deps.N(cid);
      if(!n || n._deleted)return;
      if(n.recur && n.date)list.push(n);
      stack.push(cid);
    });
  }
  _calRecurCache = list;
  return list;
}
/* 【本轮修复 · 日缓存陈旧引用（当日待办「新建不显示 / 删不掉」的最里层根因）】
   _calDayCache 与 _renderDayCache 缓存的是**取数当时的节点对象快照数组**（不是 id）。
   而 commit 走结构化共享：每次写操作都会换掉 state.nodes[id] 的对象引用；
   removeNode 则直接把 id 从 state.nodes 删除。旧实现命中缓存即原样返回该快照 ⇒
     · 新建后若缓存键/代次未变，拿到的是「不含新节点」的旧数组；
     · 删除后新数组里仍留着已删除的**旧对象**，renderCalNode 照旧渲染出那一行
       （界面上「按退格删了但行还在」/「再点又回来」）。
   统一出口：每次取数都按 id 回读 live 节点——已删（不存在 / _deleted）即剔除，
   对象已换代则替换为 live 对象（顺序沿用缓存顺序）。取数口径一次收敛，网格 /
   周视图时间网格 / 当日待办 / 字数统计四处的陈旧引用同时消除。 */
function _liveDayList(list: any[]): any[] {
  const out: any[] = [];
  for(let i = 0;i < list.length;i++){
    const cached = list[i];
    if(!cached)continue;
    const live = deps.N(cached.id);
    if(!live || live._deleted)continue;
    out.push(live === cached ? cached : live);
  }
  return out;
}
export function calendarTodosOnDate(ds: string): any[] {
  if(_calDayCache){
    const hit = _calDayCache.get(ds); /* FIX-P2-2: makeLRU 命中即重排到队尾 */
    if(hit !== undefined)return _liveDayList(hit);
  }
  if(!_calDayCache)_calDayCache = deps.makeLRU(2000);
  const idx = buildCalIndex();
  /* L6 阶段 2 改造：idx 现在是 Map<date, Set<id>>，将 id 映射为 node（N(id)）*/
  const result: any[] = [];
  const idSet = idx.get(ds);
  if(idSet){
    for(const id of idSet){
      const n = deps.N(id);
      if(n)result.push(n);
    }
  }
  const recurs = buildRecurList();
  for(let i = 0;i < recurs.length;i++){
    const n = recurs[i];
    if(n.date !== ds && expandRecurring(n, ds))result.push(n);
  }
  result.sort((a, b) => (a.createdAt - b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out = _liveDayList(result);
  _calDayCache.set(ds, out); /* FIX-P2-2: 溢出淘汰由 makeLRU 内部逐条处理 */
  return out;
}
export function buildYearCounts(year: number): Map<string, number> {
  if(_yearCountsCache && _yearCountsCache.year === year)return _yearCountsCache.map;
  const counts = new Map<string, number>();
  const calRootId = getCalendarRootId();
  const stack = [calRootId];const visited = new Set<any>();
  while(stack.length){
    const pid = stack.pop();
    if(visited.has(pid))continue;
    visited.add(pid);
    const parent = deps.N(pid);if(!parent)continue;
    (parent.children || []).forEach((cid: any) => {
      const n = deps.N(cid);
      if(!n || n._deleted)return;
      if(n.showInCal !== false && !deps.isBlankNode(n)){
        if(n.date && n.date.startsWith(year + '-'))counts.set(n.date, (counts.get(n.date) || 0) + 1);
        if(n.recur && n.date){
          const base = parseYmd(n.date);
          if(!isNaN(base.getTime())){
            const freq = n.recur.freq;
            const interval = Math.max(1, Math.floor(Number(n.recur.interval) || 1));
            const weekday = n.recur.weekday;
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31);
            const step = (d: Date) => { const ds2 = ymd(d);if(n.recurEnd && ds2 > n.recurEnd)return;if(ds2 !== n.date)counts.set(ds2, (counts.get(ds2) || 0) + 1); };
            if(freq === 'daily'){
              const cur = new Date(base);
              while(cur < yearStart)cur.setDate(cur.getDate() + interval);
              while(cur <= yearEnd){step(cur);cur.setDate(cur.getDate() + interval);}
            }else if(freq === 'weekly'){
              const wd = weekday != null ? weekday : base.getDay();
              const first = new Date(year, 0, 1);
              while(first.getDay() !== wd)first.setDate(first.getDate() + 1);
              const bs = new Date(base);bs.setDate(bs.getDate() - bs.getDay());
              const d = new Date(first);
              while(d <= yearEnd){
                if(d >= base){
                  const ts = new Date(d);ts.setDate(ts.getDate() - ts.getDay());
                  const weeks = Math.round((ts.getTime() - bs.getTime()) / 86400000 / 7);
                  if(weeks >= 0 && weeks % interval === 0)step(d);
                }
                d.setDate(d.getDate() + 7);
              }
            }else if(freq === 'monthly'){
              for(let mm = 0;mm < 12;mm++){
                const d = new Date(year, mm, base.getDate());
                if(d.getMonth() !== mm)continue;
                if(d < base || d > yearEnd)continue;
                const mdiff = (year - base.getFullYear()) * 12 + (mm - base.getMonth());
                if(mdiff >= 0 && mdiff % interval === 0)step(d);
              }
            }else if(freq === 'yearly'){
              const d = new Date(year, base.getMonth(), base.getDate());
              if(d.getFullYear() === year && d >= base && d <= yearEnd && (year - base.getFullYear()) % interval === 0)step(d);
            }else if(freq === 'workday'){
              const cur = new Date(base);
              while(cur < yearStart)cur.setDate(cur.getDate() + 1);
              let wc = 0;
              while(cur <= yearEnd){
                const d = cur.getDay();
                if(d !== 0 && d !== 6 && !isRestDay(cur.getFullYear(), cur.getMonth() + 1, cur.getDate())){wc++;if(wc % interval === 0)step(cur);}
                cur.setDate(cur.getDate() + 1);
              }
            }else if(freq === 'lunar'){
              const lu = solarToLunar(base.getFullYear(), base.getMonth() + 1, base.getDate());
              if(lu){
                const hit = lunarToSolarDate(year, lu.month, lu.day);
                if(hit){
                  const d = new Date(hit.y, hit.m - 1, hit.d);
                  if(d >= base && d <= yearEnd && (year - base.getFullYear()) % interval === 0)step(d);
                }
              }
            }
          }
        }
      }
      stack.push(cid);
    });
  }
  _yearCountsCache = { year, map: counts };
  return counts;
}

/* ── 渲染日缓存（原产品全局作用域 7171-7172） ── */
/* FIX-L-03: 日历日过滤结果模块级缓存（跨渲染共享）；以 state._rev 为数据代次失效信号，键含 ds+过滤状态 */
let _renderDayCache: { _gen: number; map: any } | null = null;

/* ============================================================
   日历时间网格（周/日视图 · 24 小时纵轴 + 今日列高亮）：红色当前时间线
   - 时区：东八区 UTC+8（显示与时间线均按该时区）
   - 每分钟更新一次，用 transform 更新位置（避免布局抖动）
   - 打开视图自动滚动到当前时间附近；空闲时线始终保持在可视区域内
   - 00:00 跨天：线回到顶部、日期更新
   - 多列布局：线只画在今天那一列
   - 定时器在重渲染/卸载/页面关闭时统一清理，防内存泄漏
   ============================================================ */
export function tgHourH(): number { return Math.round(40 * deps.currentBaseFontPx() / 14); } /* FIX-R2-1: 用 currentBaseFontPx() 实时读级联字号（getBaseFontSize 有永久缓存，字号缩放后不更新） */
export function tgTotalH(): number { return 24 * tgHourH(); } /* 时间网格总高 = 24 小时 × 行高，供拖拽 clamp 与格线使用（随字号缩放） */
let _calTgTimer: any = null, _calTgAutoKey = '', _calTgPrevScroll: number | null = null, _calTgLastView = '';
let _calTgVisHandler: (() => void) | null = null; /* L16-W5: 时间网格 visibilitychange 自停自启监听句柄（与 _calTgTimer 同生命周期，随 clearCalTgTimer 一并注销） */
/** 时间网格定时器 / 滚动锚点状态只读视图（装配 / 诊断用）。 */
export function getCalTgState(): { timer: any; autoKey: string; prevScroll: number | null; lastView: string; visHandler: (() => void) | null } {
  return { timer: _calTgTimer, autoKey: _calTgAutoKey, prevScroll: _calTgPrevScroll, lastView: _calTgLastView, visHandler: _calTgVisHandler };
}
export function clearCalTgTimer(): void {
  if(_calTgTimer){clearInterval(_calTgTimer);_calTgTimer = null;}
  if(_calTgVisHandler){document.removeEventListener('visibilitychange', _calTgVisHandler);_calTgVisHandler = null;} /* L16-W5: 注销可见性监听，避免重渲染重复挂载 */
}
export function cnNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000); /* UTC+8 */
}
export function cnYmd(d: Date): string { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function tgTimeY(t: any): number | null {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(t || ''));
  if(!m)return null;
  const h = +m[1], mi = +m[2];
  if(h > 23 || mi > 59)return null;
  return (h + mi / 60) * tgHourH();
}
export function tgNowY(): number { const d = cnNow();return (d.getHours() + d.getMinutes() / 60) * tgHourH(); }
/* ── v2.1 fix15：当前时间红线「居中滚动」计算与落地 ──
   P0 取证（90过程材料/tmp/fix15/calendar_now_line_before.log，fix14 发布产物 sha256 94d7e039…cc2d）：
   23:30 时侧栏切到「文件」再切回「日历」，或周视图内点「今天」，.cal-tg-scroll 的 scrollTop 恒为 0，
   红线落在滚动容器顶部下方 1055.6px（视口 164~508）⇒ 越界不可见。
   根因：renderMain 捕获 prevScroll 的前提是「上一份 DOM 里存在 .cal-tg-scroll」，跨模块往返必然为 null，
   而 _calTgLastView 仍是 'week'、autoKey 未变 ⇒ 原「必滚」与「恢复」两条分支都不执行。
   修复口径：红线居中按「扣除 sticky 表头后的可见区」计算，并钳制到 [0, scrollHeight-clientHeight]；
   同一份算子在「进入周视图」「无保存滚动位置的重绘」「空闲兜底」三处共用，避免三套近似系数漂移。 */

/** 把红线居中到可见区所需的 scrollTop（纯计算，不写 DOM）；布局未就绪返回 null 供调用方下一帧重试。 */
function calTgCenterTarget(scroll: HTMLElement | null, line: HTMLElement | null): number | null {
  if(!scroll || !line || !scroll.isConnected || !line.isConnected)return null;
  const sRect = scroll.getBoundingClientRect();
  if(!scroll.clientHeight || !sRect.height)return null; /* 元素未挂载 / 布局未就绪：令调用方重试 */
  const head = scroll.querySelector('.cal-tg-head') as HTMLElement | null;
  const headH = head ? head.getBoundingClientRect().height : 0; /* .cal-tg-head 为 sticky，仍占流内高度 */
  const viewH = Math.max(1, scroll.clientHeight - headH);
  /* 线自身的 transform 已含在 rect 里：用「rect + 当前 scrollTop」还原到滚动内容坐标系 */
  const lineOffset = line.getBoundingClientRect().top - sRect.top + scroll.scrollTop;
  const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
  return Math.max(0, Math.min(maxTop, lineOffset - headH - viewH / 2));
}

/** 立即把红线居中（返回落地的 scrollTop；未就绪返回 null）。 */
function centerCalTgOnNowLine(scroll: HTMLElement | null, line: HTMLElement | null): number | null {
  const t = calTgCenterTarget(scroll, line);
  if(t == null)return null;
  const sc = scroll as HTMLElement;
  if(Math.abs(sc.scrollTop - t) >= 1)sc.scrollTop = t;
  return sc.scrollTop;
}

export function tgDayNodes(ds: string): CalTodos {
  let list = calendarTodosOnDate(ds).filter((n: any) => n.showInCal !== false && (!deps.isBlankNode(n) || deps.ui.focusId === n.id)) as CalTodos;
  if(deps.ui.calTagFilter)list = list.filter((n: any) => deps.nodeHasTag(n, deps.ui.calTagFilter)) as CalTodos;
  return list;
}
export function buildTimeGrid(days: Date[]): HTMLElement {
  /* FIX-P0-1: 原名 N 遮蔽全局函数 N(id)=state.nodes[id]（L2738）；改为 nDays，所有引用同步替换，消除函数体内潜在取节点误读 */
  const nDays = days.length;
  const cnToday = todayStr();
  const headCols = document.createElement('div');
  headCols.className = 'cal-tg-cols';
  headCols.style.gridTemplateColumns = 'repeat(' + nDays + ',1fr)';
  const bodyCols = document.createElement('div');
  bodyCols.className = 'cal-tg-cols';
  bodyCols.style.gridTemplateColumns = 'repeat(' + nDays + ',1fr)';
  const todayIdx = days.findIndex(d => ymd(d) === cnToday);
  const openNodeFromMap = (id: any, ds: string) => {
    const ae = document.activeElement as HTMLElement | null;if(ae && ae.blur)ae.blur();
    deps.ui.selectedDate = ds;deps.ui.focusId = id;deps.saveUI();deps.forceRender();
    setTimeout(() => { const t = document.querySelector<HTMLElement>('.cal-node .text[data-id="' + CSS.escape(id) + '"]');if(t)t.focus(); }, 30);
  };
  days.forEach((d, di) => {
    const ds = ymd(d);
    const isToday = ds === cnToday;
    const head = document.createElement('div');
    head.className = 'cal-tg-colhead' + (isToday ? ' today' : '');
    const dow = document.createElement('span');dow.className = 'dow';dow.textContent = '周' + '日一二三四五六'[d.getDay()];
    const dnum = document.createElement('span');dnum.className = 'dnum';dnum.textContent = (d.getMonth() + 1) + '/' + d.getDate();
    head.appendChild(dow);
    /* 阳历与农历显示在同一行 */
    const drow = document.createElement('span');drow.className = 'drow';
    drow.appendChild(dnum);
    const lab = dayLabel(d);
    if(lab.text){const lu = document.createElement('span');lu.className = 'dlunar';lu.textContent = lab.text;drow.appendChild(lu);}
    head.appendChild(drow);
    const list = tgDayNodes(ds);
    const allDay = list.filter((n: any) => !tgTimeY(n.time));
    allDay.slice(0, 3).forEach((n: any) => {
      const c = document.createElement('span');c.className = 'cal-tg-adj' + (n.done ? ' done' : '');
      c.textContent = deps.tagStripText(n);c.title = '#' + (n.tags || []).join(' #') + ' · ' + stripHtml(n.text);
      c.onclick = e => { e.stopPropagation();openNodeFromMap(n.id, ds); };
      head.appendChild(c);
    });
    if(allDay.length > 3){const m = document.createElement('span');m.className = 'cal-tg-more';m.textContent = '+' + (allDay.length - 3);m.title = '还有 ' + (allDay.length - 3) + ' 条全天事项';m.onclick = e => { e.stopPropagation();deps.ui.selectedDate = ds;deps.saveUI();deps.forceRender(); };head.appendChild(m);}
    headCols.appendChild(head);
    const col = document.createElement('div');
    col.className = 'cal-tg-col' + (isToday ? ' today' : '');
    col.dataset.ds = ds;
    col.onclick = (e) => {
      const ae = document.activeElement as HTMLElement | null;if(ae && ae.blur)ae.blur();
      /* 点击日历空白区域 → 添加今日待办（按 30 分钟吸附、默认 1 小时时长、可拖拽调整；与下方今日待办同源同步） */
      const sc = col.closest('.cal-tg-scroll');
      const rect = col.getBoundingClientRect();
      /* colTop 已含滚动位移（col 随容器滚动），clientY-rect.top 即网格内 yPx，勿再叠加 scrollTop */
      const yPx = e.clientY - rect.top;
      let hh = Math.floor(yPx / tgHourH()), mi = Math.round((yPx % tgHourH()) / tgHourH() * 60);
      if(mi >= 60){mi -= 60;hh++;}
      if(hh < 0 || hh > 23)return;
      /* 新建待办起止时间吸附整点/半点（30 分钟网格） */
      const m0 = snapHalfMins(hh * 60 + mi);
      hh = Math.floor(m0 / 60);mi = m0 % 60;
      const t = pad(hh) + ':' + pad(mi);
      const endMin = m0 + 60; /* 默认时长 1 小时，吸附后仍在整点/半点 */
      const te = (endMin <= 23 * 60 + 59) ? pad(Math.floor(endMin / 60)) + ':' + pad(endMin % 60) : null;
      /* L17-W4 · P2-4：23:00 之后新建待办无可用结束时间，给出提示（不阻断创建）。 */
      if(!te){try{toast('已到当日末尾，默认无结束时间');}catch(e){console.warn('[JU] caught error',e);}}
      deps.ui.selectedDate = ds;deps.saveUI();
      const c = document.getElementById('content');
      const st = c ? c.scrollTop : 0;
      const calRootId = getCalendarRootId();
      const id = deps.actions.addNode(calRootId, null, { date: ds, time: t, timeEnd: te, showInCal: true, text: '' });
      /* 【本轮修复 · 新建不显示】addNode 已失效日历索引，但「日缓存」还有两层（_calDayCache 2000 条 LRU /
         _renderDayCache 按代次）。此处显式再失效一次：即使上层装配的 actions 未接 invalidateCalIndex
         （占位 / 旧包），新建待办也必定在本次渲染中出现在时间网格与下方当日待办。 */
      invalidateCalIndex();
      deps.ui.focusId = id;deps.forceRender();
      if(c)c.scrollTop = st;
      focusAfterRender(id, '.cal-page');
      requestAnimationFrame(() => { if(c)c.scrollTop = st; });
    };
    list.filter((n: any) => tgTimeY(n.time)).forEach((n: any) => {
      const ev: any = document.createElement('div');
      ev.className = 'cal-tg-ev' + (n.done ? ' done' : '');
      const y0 = tgTimeY(n.time) as number;
      ev.style.top = y0 + 'px';
      const y1 = tgTimeY(n.timeEnd);
      if(y1 != null && y1 > y0)ev.style.height = (y1 - y0) + 'px'; /* 时间区间：8:00-9:00 渲染为对应高度块 */
      const _ts = fmtHm(n.time), _te = fmtHm(n.timeEnd);
      ev.title = ((_ts && _te && _te > _ts) ? _ts + '-' + _te + ' ' : (_ts ? _ts + ' ' : '') + '#' + (n.tags || []).join(' #') + ' · ' + stripHtml(n.text));
      /* 事件块只显示事项、不显示时间（时间见悬停提示与设置时间弹窗）；可直接点击输入并同步今日待办 */
      const txt = document.createElement('span');txt.className = 'evtx';txt.textContent = deps.tagStripText(n);
      txt.contentEditable = 'true';txt.spellcheck = false;
      ev.appendChild(txt);
      /* 批次5 P0 / v2.1 fix1 · P2: 时间网格事件块渲染四象限优先级徽章。
         徽章放在 contentEditable 之外：txt 的失焦/粘贴逻辑以 txt.textContent 与 _display 比对并回写节点正文，
         若把徽章塞进 txt 会把「重要紧急」等文案当作正文写回，造成数据污染，故前插为 ev 的兄弟节点。
         v2.1 fix1：徽章改为调用唯一渲染器 priorityBadges（与当日待办 renderCalNode、月视图 .cal-item 同一 DOM 契约
         —— data-prio / aria-label / 图标组合完全一致），布局全部落 CSS class，不再写内联 style。 */
      const _tgPk = prioKeyOf(n.priority);
      if(_tgPk){
        const pb = priorityBadges(_tgPk);
        ev.insertBefore(pb, txt);
        ev.classList.add('has-prio');
      }
      /* 有标签：事件块背景为对应标签的浅色；无标签：实色面板底（批次5 P0 起不再使用透明玻璃） */
      if(n.tags && n.tags.length){
        ev.classList.add('tagged');
        ev.style.setProperty('--evtag', deps.getTagColor(n.tags[0]));
      }
      const _display = deps.tagStripText(n);
      let _editing = false;
      txt.addEventListener('focus', () => { _editing = true; });
      txt.addEventListener('blur', () => {
        if(!_editing)return;_editing = false;
        const v = (txt.textContent || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        if(v === _display)return; /* 未变更 */
        /* 保留原 #标签 后缀（tags 字段不变，仅文本同步），确保今日待办列表格式一致 */
        let suffix = '';
        if(n.tags && n.tags.length)suffix = ' ' + n.tags.filter(Boolean).map((t: string) => '#' + t).join(' ');
        deps.actions.updateText(n.id, v + suffix, { noHistory: true });
        invalidateCalIndex();deps.forceRender();
      });
      /* 【粘贴修复 P0】日历事件块为单行语义：多行粘贴合并为单行（空白折叠），不写入换行破坏时间网格布局 */
      txt.addEventListener('paste', e => {
        try{
          const dt = e.clipboardData || (window as any).clipboardData;
          if(!dt)return;
          e.preventDefault();
          const parsed = deps.parsePasteLines(dt);
          const single = parsed.lines.length ? parsed.lines.join(' ').replace(/\s+/g, ' ').trim() : '';
          if(single) deps.safeExec('insertText', single);
        }catch(err){console.warn('[JU] caught error',err);}
      });
      txt.addEventListener('keydown', e => {
        if(e.isComposing || e.keyCode === 229)return; /* 中文输入法组合中：Enter/Esc 为上屏/取消候选，不触发保存或退出 */
        if(e.key === 'Enter'){e.preventDefault();txt.blur();}
        else if(e.key === 'Escape'){txt.textContent = _display;txt.blur();}
      });
      ev.onclick = (e: MouseEvent) => {
        if(ev._calDragged){ev._calDragged = false;return;} /* 拖拽结束紧随的 click 吞掉，避免误入编辑 */
        e.stopPropagation();
        if(document.activeElement !== txt){ /* 首次进入编辑：聚焦并全选文本（日历事件就地编辑） */
          txt.focus();
          const sel = window.getSelection();if(sel){const r = document.createRange();r.selectNodeContents(txt);sel.removeAllRanges();sel.addRange(r);}
        } /* 已在编辑：mousedown 已定位光标，不重新全选，保持用户点击位置 */
      };
      /* 右键事件块 → 菜单：设置时间 / 清除日期 / 清除时间 / 清除全部日程 / 删除待办（与今日待办面板逻辑一致） */
      ev.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();e.stopPropagation();
        const cur = deps.state.nodes[n.id];
        const items = [
          /* 设置时间：参考「新增/编辑倒数日」弹窗样式（时间 + 重复方式 + 重复结束日期） */
          { ic: '⏰', txt: '设置时间', fn: () => openCalTimeModal(n.id) },
          { sep: true },
          { ic: '📅', txt: '清除日期', fn: () => { deps.actions.clearNodeSchedule(n.id, { date: true, time: false, recur: false });deps.forceRender();toast('已清除日期'); } },
          { ic: '⏰', txt: '清除时间', fn: () => { deps.actions.clearNodeSchedule(n.id, { date: false, time: true, recur: false });deps.forceRender();toast('已清除时间'); } },
          { ic: '🗑', txt: '清除全部日程', danger: true, fn: () => { deps.actions.clearNodeSchedule(n.id, { date: true, time: true, recur: true });deps.forceRender();toast('已清除全部日程'); } }
        ];
        showContextMenu(items, e);
      });
      bindCalEventDrag(ev, n); /* 拖拽主体改开始时间、拖底部改结束时间（日历事件拖拽） */
      col.appendChild(ev);
    });
    bodyCols.appendChild(col);
  });
  const wrap: any = document.createElement('div');wrap.className = 'cal-tg';
  const scroll = document.createElement('div');scroll.className = 'cal-tg-scroll';
  scroll.setAttribute('role', 'region');scroll.setAttribute('aria-label', '日历时间网格（东八区）');
  const head = document.createElement('div');head.className = 'cal-tg-head';
  const corner = document.createElement('div');corner.className = 'cal-tg-corner';
  head.appendChild(corner);head.appendChild(headCols);
  const body = document.createElement('div');body.className = 'cal-tg-body';
  const gutter = document.createElement('div');gutter.className = 'cal-tg-gutter';
  for(let h = 0;h <= 24;h++){ /* 时标 00:00~24:00（24:00 为当日最后一根边界线，其后无单元行） */
    const hl = document.createElement('div');hl.className = 'cal-tg-hour';
    hl.textContent = pad(h) + ':00';hl.style.top = (h * tgHourH()) + 'px';
    gutter.appendChild(hl);
  }
  body.appendChild(gutter);body.appendChild(bodyCols);
  scroll.appendChild(head);scroll.appendChild(body);
  const sr = document.createElement('div');sr.className = 'cal-tg-sr';
  sr.setAttribute('aria-live', 'polite');sr.textContent = '当前时间 ' + pad(cnNow().getHours()) + ':' + pad(cnNow().getMinutes());
  scroll.appendChild(sr);
  if(todayIdx >= 0){
    const y = tgNowY();
    const nowline = document.createElement('div');nowline.className = 'cal-tg-nowline';
    nowline.style.left = (todayIdx / nDays * 100) + '%';nowline.style.right = ((nDays - 1 - todayIdx) / nDays * 100) + '%';
    nowline.style.transform = 'translateY(' + y + 'px)';
    nowline.setAttribute('role', 'img');nowline.setAttribute('aria-label', '当前时间 ' + pad(cnNow().getHours()) + ':' + pad(cnNow().getMinutes()));
    const dot = document.createElement('div');dot.className = 'cal-tg-nowdot';dot.setAttribute('aria-hidden', 'true');
    nowline.appendChild(dot);
    const label = document.createElement('div');label.className = 'cal-tg-nowlabel';label.setAttribute('aria-hidden', 'true'); /* FIX-R6-16: 标签固定在今天列内右缘，无需 edge-right 翻转 */
    label.textContent = pad(cnNow().getHours()) + ':' + pad(cnNow().getMinutes());
    nowline.appendChild(label);
    bodyCols.appendChild(nowline);
    wrap._tgScroll = scroll;wrap._tgLine = nowline;wrap._tgLabel = label;
    wrap._tgTodayIdx = todayIdx;wrap._tgDays = days.map(ymd);
    /* 打开视图时自动滚动到当前时间附近（v2.1 fix15 重写分支条件）：
       (1) 视图/日期变化（key 变化）→ 必滚；
       (2) 从非周视图（月/年/启动）进入周视图（_calTgLastView!=='week'）→ 必滚；
       (3) **没有可恢复的用户滚动位置（_calTgPrevScroll == null）→ 必滚**：跨模块往返（日历→文件/大纲→日历）
           时 renderMain 取不到旧 .cal-tg-scroll，prevScroll 必为 null，key 与 lastView 又都没变，
           原实现两条分支都不走 ⇒ scrollTop 停在 0，23:30 的红线落在视口下方 1000+px（P0 实测越界）；
       (4) 仅在周视图内部的同键重建且确有用户滚动位置（点「今天」、编辑待办等）→ 恢复原位置，不抢焦点。 */
    const key = deps.ui.calView + ':' + ymd(days[0]);
    const enteringWeek = (_calTgLastView !== 'week');
    _calTgLastView = 'week';
    const noSavedScroll = (_calTgPrevScroll == null);
    if(_calTgAutoKey !== key || enteringWeek || noSavedScroll){
      _calTgAutoKey = key;
      _calTgPrevScroll = null; /* FIX-P0-2: 必滚分支不再消费旧的恢复值，防跨视图污染 */
      /* 双 rAF：首帧保证已挂载，次帧保证布局完成（跨模块往返时首帧可能仍读到 clientHeight=0）；
         仅写入 scrollTop 一次，不接管后续用户滚动（定时器更新红线只用 transform）。 */
      requestAnimationFrame(() => {
        if(centerCalTgOnNowLine(scroll, nowline) == null){
          requestAnimationFrame(() => { centerCalTgOnNowLine(scroll, nowline); });
        }
      });
    }else{
      /* 视图/日期未变且存在用户滚动位置：恢复原位，避免复位到顶部（用户主动滚到 00:00 时也不抢回）。
         rAF 延迟到挂载+布局完成后执行，否则新元素 scrollHeight/clientHeight 为 0 会被钳制为 0 */
      const ps = _calTgPrevScroll as number;
      requestAnimationFrame(() => {
        if(!scroll.isConnected)return;
        scroll.scrollTop = Math.max(0, Math.min(ps, scroll.scrollHeight - scroll.clientHeight));
        _calTgPrevScroll = null; /* FIX-P0-2: 恢复完成立即清空，防跨视图污染（下一次必滚分支读到旧值） */
      });
    }
    startCalTgTimer(wrap);
  }
  wrap.appendChild(scroll);
  return wrap;
}
export function startCalTgTimer(wrap: any): void {
  clearCalTgTimer();
  const scroll = wrap._tgScroll, line = wrap._tgLine, label = wrap._tgLabel, days = wrap._tgDays;
  if(!scroll || !line)return;
  let lastDate = cnYmd(cnNow()), lastUserScroll = 0;
  const onUserScroll = () => { lastUserScroll = Date.now(); };
  scroll.addEventListener('wheel', onUserScroll, { passive: true });
  scroll.addEventListener('touchstart', onUserScroll, { passive: true });
  scroll.addEventListener('pointerdown', onUserScroll);
  const tick = () => {
    if(!line.isConnected){clearCalTgTimer();return;} /* 视图已卸载：立即清理定时器 */
    const now = cnNow(), ds = cnYmd(now);
    const y = (now.getHours() + now.getMinutes() / 60) * tgHourH();
    const t = pad(now.getHours()) + ':' + pad(now.getMinutes());
    line.style.transform = 'translateY(' + y + 'px)'; /* transform 更新，避免布局抖动 */
    line.setAttribute('aria-label', '当前时间 ' + t);
    if(label.isConnected)label.textContent = t;
    const sr = document.querySelector('.cal-tg-sr');if(sr)sr.textContent = '当前时间 ' + t;
    if(ds !== lastDate){ /* 00:00 跨天：线回到顶部、日期更新 */
      lastDate = ds;
      deps.ui.selectedDate = ds;deps.ui.calMonth = { y: now.getFullYear(), m: now.getMonth() };deps.saveUI();
      _calTgAutoKey = ''; /* 新渲染强制自动滚动到当前时间（顶部） */
      deps.forceRender();
      return;
    }
    /* 空闲（45s 无用户滚动）且线移出可视区时平滑滚回，保证线始终在可视区域内。
       v2.1 fix15：判据与目标统一到 calTgCenterTarget()（扣除 sticky 表头 + 真实居中 + 边界钳制），
       不再用「当前 scrollTop + y − 高×0.33」这套近似（23:30 时会被上限钳死、且把表头高度算进可见区）。
       注意：本分支是唯一的「定时器自动纠偏」入口，只在用户 45s 无滚动时生效，绝不与用户抢滚动。 */
    if(Date.now() - lastUserScroll > 45000){
      const headEl = scroll.querySelector('.cal-tg-head') as HTMLElement | null;
      const headH = headEl ? headEl.getBoundingClientRect().height : 0;
      const r = scroll.getBoundingClientRect(), ly = line.getBoundingClientRect().top;
      if(ly < r.top + headH + 10 || ly > r.bottom - 10){
        const target = calTgCenterTarget(scroll, line);
        if(target != null)scroll.scrollTo({ top: target, behavior: 'smooth' });
      }
    }
  };
  /* L16-W5：时间网格 60s 轮询纳入 visibilitychange 统一管理（与 boot 尾部时钟 FIX-M-25 同口径）——
     切后台即停表，避免隐藏标签页仍每 60s 触发一次更新链；回前台仅当周视图时间线仍在挂
     （line.isConnected 等价「当前 view===week 且时间线已挂载」）时重启轮询，
     并立即执行一次 tick 重定位红线（覆盖休眠期跨天）。监听句柄挂 _calTgVisHandler，
     随 clearCalTgTimer 一并注销，避免重渲染重复挂载。 */
  _calTgVisHandler = () => {
    if(document.hidden){
      if(_calTgTimer){clearInterval(_calTgTimer);_calTgTimer = null;}
    }else if(!_calTgTimer && line.isConnected){
      tick();
      _calTgTimer = setInterval(tick, 60000);
    }
  };
  document.addEventListener('visibilitychange', _calTgVisHandler);
  if(!document.hidden)_calTgTimer = setInterval(tick, 60000);
}
if(typeof window !== 'undefined'){
  window.addEventListener('pagehide', clearCalTgTimer);
  window.addEventListener('beforeunload', clearCalTgTimer);
}
/* 日历事件拖拽：拖动主体平移时间段（时长不变），拖动底部把手调整结束时间。
   起止时间吸附整点/半点（30 分钟网格）。仅 pointerup 时提交（视觉跟随用 top/height 直改），
   提交后经 invalidateCalIndex 同步今日待办胶囊与网格。 */
export function bindCalEventDrag(ev: any, n: any): void {
  ev.style.touchAction = 'none';
  let mode: string | null = null, startY = 0, origTop = 0, origH = 0, dragged = false;
  ev.addEventListener('pointerdown', (e: PointerEvent) => {
    if(e.button !== 0)return;
    /* 点击可编辑文本（.evtx）：不阻止默认行为，让 contentEditable 正常聚焦/定位光标；仍保留拖拽（位移>8px 才提交时间，FIX-P1-4: 原 4px 阈值划选文字时轻微位移即误提交时间变更） */
    if((e.target as HTMLElement).closest('.evtx')){
      startY = e.clientY;
      dragged = false;
      /* L23 · 指针捕获：文字区拖拽同样接管指针，移出元素边界后 move / up 仍送达 ev */
      try{ev.setPointerCapture(e.pointerId);}catch(_){console.warn('[JU] caught error',_);}
      const move = (ev2: PointerEvent) => {
        const dy = ev2.clientY - startY;
        if(!dragged && Math.abs(dy) > 8)dragged = true;
        ev.classList.add('cal-tg-dragging');
      };
      /* 批次 4-E：触屏长按 / 系统手势打断时只发 pointercancel（无 pointerup）⇒ 原实现残留 cal-tg-dragging
         且监听不摘除；补 cancel 监听，仅复位拖拽态、不提交时间 */
      const cancel = () => {
        try{ev.releasePointerCapture(e.pointerId);}catch(_){console.warn('[JU] caught error',_);}
        ev.classList.remove('cal-tg-dragging');
        ev.removeEventListener('pointermove', move);
        ev.removeEventListener('pointerup', up);
        ev.removeEventListener('pointercancel', cancel);
      };
      const up = () => {
        try{ev.releasePointerCapture(e.pointerId);}catch(_){console.warn('[JU] caught error',_);}
        ev.classList.remove('cal-tg-dragging');
        ev.removeEventListener('pointermove', move);
        ev.removeEventListener('pointerup', up);
        ev.removeEventListener('pointercancel', cancel);
        if(!dragged)return;
        ev._calDragged = true;
        setTimeout(() => { ev._calDragged = false; }, 100); /* FIX-P1-3: 标志超时复位——原置 true 后长期有效，拖拽后稍晚的真实点击会被误吞 */
        const top = clampM(parseFloat(ev.style.top) || 0, 0, tgTotalH() - 15); /* FIX-R3-2: clamp 上限随总高缩放 */
        const h = clampM(parseFloat(ev.style.height) || tgHourH(), 15, tgTotalH() - top);
        const snap30 = (m: number) => Math.round(m / 30) * 30;
        const m0 = clampM(snap30(top / tgHourH() * 60), 0, 1439);
        const m1 = clampM(snap30((top + h) / tgHourH() * 60), m0 + 30, 1439);
        const t0 = calMinToHm(m0);
        const t1 = calMinToHm(m1);
        deps.commit((s: any) => { const nn = s.nodes[n.id];if(!nn)return;nn.time = t0;nn.timeEnd = (t1 > t0) ? t1 : null;nn.updatedAt = deps.nowSeq(); }, { snapshot: true, dirtyDocs: getCalendarRootId() });
        invalidateCalIndex();
        deps.forceRender();
      };
      ev.addEventListener('pointermove', move);
      ev.addEventListener('pointerup', up);
      ev.addEventListener('pointercancel', cancel);
      return;
    }
    const r = ev.getBoundingClientRect();
    mode = (e.clientY - r.bottom) > -6 ? 'end' : 'move'; /* FIX-P1-2: 判定区与把手视觉高度一致——把手固定 6px，原 -9 会让正文底部 3px 点选文字误触发「拖 end」 */
    startY = e.clientY;
    origTop = parseFloat(ev.style.top) || 0;
    origH = parseFloat(ev.style.height) || tgHourH();
    dragged = false;
    e.preventDefault();
    /* L22 · 清理 2：显式指针捕获——事件块在时间网格内拖动时，指针移出元素/网格边界后
       pointermove 仍定向送达 ev，边界处松手也能正常收尾（原仅挂在 ev 上，越界即丢事件）。 */
    try{ev.setPointerCapture(e.pointerId);}catch(err){console.warn('[JU] caught error',err);}
    const move = (ev2: PointerEvent) => {
      const dy = ev2.clientY - startY;
      if(!dragged && Math.abs(dy) > 4)dragged = true;
      if(mode === 'move'){
        ev.style.top = clampM(origTop + dy, 0, tgTotalH() - origH) + 'px'; /* FIX-R3-2: clamp 上限随总高缩放 */
      }else{
        ev.style.height = clampM(origH + dy, 15, tgTotalH() - origTop) + 'px';
      }
      ev.classList.add('cal-tg-dragging');
    };
    const up = () => {
      ev.classList.remove('cal-tg-dragging');
      ev.removeEventListener('pointermove', move);
      ev.removeEventListener('pointerup', up);
      ev.removeEventListener('pointercancel', cancel);
      try{ev.releasePointerCapture(e.pointerId);}catch(err){console.warn('[JU] caught error',err);}
      if(!dragged)return; /* 位移不足 → 视为点击，交给 onclick */
      ev._calDragged = true;
      setTimeout(() => { ev._calDragged = false; }, 100); /* FIX-P1-3: 超时复位，仅保护拖拽紧随的那一次 click */
      const top = clampM(parseFloat(ev.style.top) || 0, 0, tgTotalH() - 15); /* FIX-R3-2 */
      const h = clampM(parseFloat(ev.style.height) || tgHourH(), 15, tgTotalH() - top);
      /* 拖拽改时间：起止时间吸附整点/半点（30 分钟），结束必须晚于开始（至少 30 分钟） */
      const snap30 = (m: number) => Math.round(m / 30) * 30;
      const m0 = clampM(snap30(top / tgHourH() * 60), 0, 1439);
      const m1 = clampM(snap30((top + h) / tgHourH() * 60), m0 + 30, 1439);
      const t0 = calMinToHm(m0);
      const t1 = calMinToHm(m1);
      deps.commit((s: any) => { const nn = s.nodes[n.id];if(!nn)return;nn.time = t0;nn.timeEnd = (t1 > t0) ? t1 : null;nn.updatedAt = deps.nowSeq(); }, { snapshot: true, dirtyDocs: getCalendarRootId() });
      invalidateCalIndex();
      deps.forceRender();
    };
    ev.addEventListener('pointermove', move);
    ev.addEventListener('pointerup', up);
    /* L23 · pointercancel 兜底：触屏长按 / 系统手势打断只发 cancel（无 up）⇒ 仅复位拖拽态、摘监听、
       释放指针捕获，不提交时间（禁止把中断的拖拽误落盘成时间变更） */
    const cancel = () => {
      try{ev.releasePointerCapture(e.pointerId);}catch(_){console.warn('[JU] caught error',_);}
      ev.classList.remove('cal-tg-dragging');
      ev.removeEventListener('pointermove', move);
      ev.removeEventListener('pointerup', up);
      ev.removeEventListener('pointercancel', cancel);
    };
    ev.addEventListener('pointercancel', cancel);
  });
}
/* ============================================================
   日历模块化（日历网格 / 记事本 / 当日待办 / 系统日志 / 统计）
   - 状态：ui.calModules = {order, hidden, sizes}，仅经 saveUI() 持久化，不进 historyPast
   - 排序：拖拽 .cal-module-head（位移 > 5px 生效），document pointermove 以 rAF 节流，
           elementFromPoint 命中目标模块并按左右 / 上下半区实时 insertBefore；
           pointerup 依容器实际子节点顺序回写 order，400ms 内吞掉紧随的 click
   - 尺寸：右下角 .cal-module-resize（setPointerCapture + rAF 节流），最小宽 150px / 最小高 160px，
           pointerup 落盘并以 flex:1 1 <w>px 恢复等比伸缩（R37）
   - 数据：模块 body 复用既有渲染逻辑（renderCalNode / renderNoteRow / buildCalLogBlock / buildStatsBlock）
   - R36：'calendar' 为首个模块，body 内挂载由 renderCalendarPage 构建的日历顶部区域 .cal-top
          （切换年 / 月 / 周、前后翻页、月视图 .cal-grid、周视图时间网格 .cal-tg 及其拖拽绑定
          均为原节点原事件，迁移只换父容器，不重建 DOM ⇒ 绑定零丢失）
   ============================================================ */
export const CAL_MODULE_KEYS = ['calendar', 'chars', 'note', 'today', 'log', 'stats'];
let _calDayNodesForModules: ((ds: string) => CalTodos) | null = null; /* renderCalendarPage 注入其 getDayNodes：同 LRU 日缓存 / 同标签过滤口径 */
export function calModuleState(): any {
  if(!deps.ui.calModules || typeof deps.ui.calModules !== 'object')deps.ui.calModules = { order: CAL_MODULE_KEYS.slice(), hidden: {}, sizes: {} };
  const st = deps.ui.calModules;
  if(!Array.isArray(st.order))st.order = CAL_MODULE_KEYS.slice();
  if(!st.hidden || typeof st.hidden !== 'object')st.hidden = {};
  if(!st.sizes || typeof st.sizes !== 'object')st.sizes = {};
  const seen: Record<string, number> = {}, order: string[] = [];
  st.order.forEach((k: string) => { if(CAL_MODULE_KEYS.indexOf(k) >= 0 && !seen[k]){seen[k] = 1;order.push(k);} });
  const hadCalendar = !!seen.calendar; /* R36：旧存档 order 无 'calendar' 键 ⇒ 本函数补全并置于首位 */
  CAL_MODULE_KEYS.forEach(k => { if(!seen[k])order.push(k); });
  if(!hadCalendar){const ci = order.indexOf('calendar');if(ci > 0){order.splice(ci, 1);order.unshift('calendar');}}
  /* R54：'chars' 为新增模块——旧档 order 无此键时补在日历之后；仅在首次补位时介入，不干预用户拖拽结果 */
  if(!seen.chars){const ci2 = order.indexOf('chars'), cc2 = order.indexOf('calendar');if(ci2 >= 0 && cc2 >= 0 && ci2 > cc2 + 1){order.splice(ci2, 1);order.splice(cc2 + 1, 0, 'chars');}}
  st.order = order;
  return st;
}
export function calModuleTitle(k: string): string { return ({ calendar: '日历', chars: '字数统计', note: '记事本', today: '当日待办', log: '系统日志', stats: '统计' } as Record<string, string>)[k] || k; }
/* 当日待办取数：优先复用 renderCalendarPage 注入的 getDayNodes（同缓存 / 同过滤），缺省按同一语义现算 */
export function calModuleDayNodes(ds: string): CalTodos {
  if(typeof _calDayNodesForModules === 'function')return _calDayNodesForModules(ds);
  let list = calendarTodosOnDate(ds).filter((n: any) => n.showInCal !== false && (!deps.isBlankNode(n) || deps.ui.focusId === n.id)) as CalTodos;
  list.rawTotal = list.length;
  if(deps.ui.calTagFilter)list = list.filter((n: any) => deps.nodeHasTag(n, deps.ui.calTagFilter)) as CalTodos;
  return list;
}
export function calModuleBadge(head: HTMLElement, text: any): HTMLElement {
  const b = document.createElement('span');b.className = 'badge';
  const t = String(text);
  b.textContent = t.startsWith('(') ? (' ' + t) : (' (' + t + ')');
  const title = head.querySelector('.cal-module-title');
  if(title){
    const old = title.querySelector('.badge');
    if(old)old.remove();
    title.appendChild(b);
  }else{
    const old = head.querySelector('.badge');
    if(old)old.remove();
    head.appendChild(b);
  }
  return b;
}
export function calModuleNoteBody(): HTMLElement {
  const wrap = document.createElement('div');
  const noteId = deps.ensureNoteDoc();
  const _nd = noteId ? deps.N(noteId) : null;
  if(_nd && (_nd.children || []).length){(_nd.children || []).forEach((cid: any) => { const cn = deps.N(cid);if(cn)wrap.appendChild(deps.renderNoteRow(cn, 0)); });}
  else{
    const hint = document.createElement('div');hint.className = 'cal-empty-hint';hint.textContent = '+ 写点什么…';
    hint.onclick = () => { if(!_nd)return;deps.actions.addNode(noteId, null, { text: '', _isNote: true });deps.forceRender(); };
    wrap.appendChild(hint);
  }
  return wrap;
}
export function calModuleTodayBody(head: HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  const todos = calModuleDayNodes(deps.ui.selectedDate);
  const done = todos.filter((n: any) => n.done).length;
  const rate = todos.length > 0 ? Math.round(done / todos.length * 100) : 0;
  const badge = calModuleBadge(head, done + '/' + todos.length + ' · ' + rate + '%');
  const _filterN = deps.ui.calTagFilter ? (todos.rawTotal || todos.length) : null;
  if(_filterN != null && _filterN > todos.length)badge.title = '筛选自 ' + _filterN + ' 条';
  todos.forEach((n: any) => wrap.appendChild(renderCalNode(n)));
  const adder = document.createElement('div');adder.className = 'cal-adder';adder.textContent = '+ 添加今日待办';
  adder.onclick = () => {
    const c = document.getElementById('content');
    const st = c ? c.scrollTop : 0;
    const calRootId = getCalendarRootId();
    const id = deps.actions.addNode(calRootId, null, { date: deps.ui.selectedDate || todayStr(), showInCal: true, text: '' });
    /* 【本轮修复 · 新建不显示】显式失效日历索引 + 日缓存（口径同时间网格新建），
       保证「+ 添加今日待办」后该行立刻出现在当日待办列表里。 */
    invalidateCalIndex();
    deps.ui.focusId = id;
    deps.forceRender();
    if(c)c.scrollTop = st;
    focusAfterRender(id, '.cal-page');
    requestAnimationFrame(() => { if(c)c.scrollTop = st; });
  };
  wrap.appendChild(adder);
  return wrap;
}
/* ────────────────────────────────────────────────────────────────────────────
 * 系统日志 / 任务统计面板
 *   来源：canonical v2.0-t3.html:9923 `buildCalLogBlock`、:17912 `buildStatsBlock`
 *   （逐行等价移植，仅把全局 ui / state / N / isBlankNode / saveUI / forceRender
 *    换成本模块的 deps 端口）。
 *
 * 【P0-T3 缺陷根因 · 无限递归】
 *   迁移期 main.ts 把两个端口注入成了：
 *     buildCalLogBlock: () => calModuleLogBody(document.createElement('div'))
 *     buildStatsBlock : () => calModuleStatsBody(document.createElement('div'))
 *   而 calModuleLogBody / calModuleStatsBody 内部又回调 deps.buildCalLogBlock() /
 *   deps.buildStatsBlock() ⇒ 两者互为实现，调用即无限递归：
 *     RangeError: Maximum call stack size exceeded
 *       at buildCalLogBlock … at calModuleLogBody …（循环）
 *   renderMain 的顺序是 `#content.innerHTML=''` → `renderCalendarPage()`，
 *   爆栈使后者中断，主内容区因此永久空白（「点日历没反应 / 一片空白」）。
 *   buildStatsBlock 的同类递归此前被 calModuleStatsBody 的 try/catch 吞掉，
 *   表现为「任务统计」永远显示 `暂无统计数据`，同样属本缺陷。
 *   修复：把产品件原实现搬回本模块，main.ts 注入改为直接指向这两个函数，
 *   递归环彻底断开（不再有「函数 A 指向 B、B 又回调 A」的自引用）。
 * ──────────────────────────────────────────────────────────────────────────── */

/** 文件夹判定（canonical :7114 `isFolder`：`_isFolder` 且非多维表格根）。 */
function isFolderId(id: any): boolean {
  const n = deps.N(id);
  return !!(n && n._isFolder && !n._isDbRoot);
}

/**
 * 系统日志面板（canonical :9923）。
 * 返回 `.cal-panel` 节点；三组（新增 / 修改 / 删除）互斥，删除 > 修改 > 新增。
 */
export function buildCalLogBlock(): HTMLElement {
  const panel2 = document.createElement('div');
  const cp = deps.ui.collapsedPanels || (deps.ui.collapsedPanels = { today: false, added: false, stats: false, note: false });
  panel2.className = 'cal-panel' + (cp.added ? ' collapsed' : '');
  const p2head = document.createElement('div');
  p2head.className = 'cal-panel-head';
  const act = (deps.state.activity && deps.state.activity[deps.ui.selectedDate]) || { add: [], del: [], mod: [] };
  /* 【UI修复11·方案A】空行过滤 + 按节点归组：
     今日创建且未再编辑 → 新增；今日被编辑过（含今日创建）→ 修改；今日删除 → 删除。
     三组互斥（优先级 删除>修改>新增），组数之和 = 当日涉及的唯一节点数 */
  const validFilter = (list: any): any[] => (list || []).filter((it: any) => {
    if (!it || !it.id) return false;
    const n = deps.N(it.id);
    if (n && deps.isBlankNode(n)) return false;
    if (!n && (!it.text || !String(it.text).trim())) return false;
    return true;
  });
  const latestByNode = (list: any): any[] => {
    const m = new Map();
    (list || []).forEach((it: any) => { const prev = m.get(it.id); if (!prev || (it.t || 0) > (prev.t || 0)) m.set(it.id, it); });
    return Array.from(m.values());
  };
  const vAdd = validFilter(act.add), vMod = validFilter(act.mod), vDel = validFilter(act.del);
  const delList = latestByNode(vDel);
  const delIds = new Set(delList.map((it: any) => it.id));
  const modList = latestByNode(vMod.filter((it: any) => !delIds.has(it.id)));
  const modIds = new Set(modList.map((it: any) => it.id));
  const addList = latestByNode(vAdd.filter((it: any) => !delIds.has(it.id) && !modIds.has(it.id)));
  const total = delList.length + modList.length + addList.length;
  p2head.innerHTML = `<span class="chev">▼</span>系统日志 <span class="badge">${total}</span>`;
  p2head.onclick = () => { cp.added = !cp.added; deps.saveUI(); deps.forceRender(); };
  panel2.appendChild(p2head);
  const p2body = document.createElement('div');
  p2body.className = 'cal-panel-body';
  const lc = deps.ui.logCollapsed || (deps.ui.logCollapsed = { add: false, mod: false, del: false });
  const mkLogGroup = (label: string, list: any, strike: boolean, key: string) => {
    /* 【UI修复10】新增/修改/删除三组始终显示（0 条也显示“新增 · 0”）；空行不渲染、不计入数字 */
    const arr = validFilter(list);
    const group = document.createElement('div');
    group.className = 'cal-node cal-log-group';
    const head = document.createElement('div');
    head.className = 'cal-row';
    head.style.cursor = arr.length ? 'pointer' : 'default';
    const chev = document.createElement('span');
    chev.className = 'arrow' + (arr.length ? '' : ' leaf');
    const collapsed = !!lc[key];
    chev.textContent = arr.length ? (collapsed ? '▶' : '▼') : '';
    head.appendChild(chev);
    const t = document.createElement('div');
    t.className = 'text';
    t.style.fontWeight = '700';
    t.textContent = label + ' ';
    /* 【UI修复11】分组角标与“系统日志”总角标同款（纯文字 accent 色，无框不加粗） */
    const gb = document.createElement('span');
    gb.className = 'badge';
    gb.textContent = String(arr.length);
    t.appendChild(gb);
    head.appendChild(t);
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'cal-children';
    bodyWrap.style.display = (!arr.length || collapsed) ? 'none' : '';
    arr.slice(-50).reverse().forEach((it: any) => {
      const r = document.createElement('div');
      r.className = 'cal-row cal-log-row';
      const b = document.createElement('span');
      b.className = 'bullet';
      const txt = document.createElement('div');
      txt.className = 'text';
      txt.style.cursor = 'default';
      txt.style.opacity = '.75';
      if (strike) txt.style.textDecoration = 'line-through';
      /* 【UI修复11】节点仍在 → 显示节点实时文本（方案A下新增/修改组文本始终最新） */
      const nn = it.id ? deps.N(it.id) : null;
      txt.textContent = (nn ? stripHtml(nn.text) : it.text) || '(空)';
      r.appendChild(b); r.appendChild(txt);
      bodyWrap.appendChild(r);
    });
    /* FIX-L-39: 角标显示全量 arr.length，但列表仅渲染最近 50 条，补提示使数字与可见条数一致 */
    if (arr.length > 50) {
      const tip = document.createElement('div');
      tip.className = 'cal-log-row';
      tip.style.cssText = 'opacity:.6;font-size:.85em;padding:2px 0';
      tip.textContent = '仅显示最近 50 条（共 ' + arr.length + ' 条）';
      bodyWrap.appendChild(tip);
    }
    if (arr.length) head.onclick = () => {
      const nowCollapsed = bodyWrap.style.display !== 'none';
      bodyWrap.style.display = nowCollapsed ? 'none' : '';
      chev.textContent = nowCollapsed ? '▶' : '▼';
      lc[key] = nowCollapsed; deps.saveUI();
    };
    group.appendChild(head); group.appendChild(bodyWrap);
    p2body.appendChild(group);
  };
  mkLogGroup('新增', addList, false, 'add');
  mkLogGroup('修改', modList, false, 'mod');
  mkLogGroup('删除', delList, true, 'del');
  if (!total) {
    const e = document.createElement('div');
    e.className = 'cal-no-activity';
    e.textContent = '今日暂无系统日志';
    p2body.appendChild(e);
  }
  panel2.appendChild(p2body);
  return panel2;
}

/* ────────────────────────────────────────────────────────────────────────────
 * fix22 / fix22-patch1 · 日历柱状图统一渲染（「字数统计」net / 「任务统计」done）
 *   缺陷链：① 旧实现把柱高写进内联 style，列宽 flex:1 在窄模块内被压到 1px 以下；
 *          ② 改用 SVG 后根元素仍挂 `.cal-chart` 类，而 style.css 的 `.cal-chart{width:auto}`
 *             优先级高于 width 呈现属性 ⇒ 图表退回默认 300px 视口、31 列日期被裁在左缘
 *             （现象：X 轴文字全挤在最左侧、柱体看不见）。
 *   patch2 口径：视觉外壳（上边框 / 外距）由外层 .cal-chart 容器承担，SVG 根只挂业务类；
 *        图表宽恒等于容器实宽（patch1 的「最小列宽 + 横向滚动」在 214px 模块内使
 *        496px 图幅只有左侧 1/3 可见 ⇒ 日期文字全挤在左缘），改为列宽随容器压缩 +
 *        X 轴标签抽稀（首 / 末位必显），既有柱体一律 ≥2px 兜底高度。
 *        宽度由 ResizeObserver 跟随容器；不写内联 style（严格 CSP：style-src 不含 unsafe-inline 亦成立）。
 *   patch4 口径：桌面端（Tauri + WebView2）窗口首帧尚未完成布局，requestAnimationFrame 拿到的
 *        clientWidth 恒为 0 ⇒ 单次重绘只会画出 n*8 窄幅（柱体与 X 轴标签全挤在左缘）。
 *        改为「立即 + 100/300/800ms」多次重绘，取到非零实宽即止；同时把 viewBox 钉在本次实宽，
 *        CSS 宽度与绘制坐标一旦不同步（等比缩放而非裁切）也不会出现左缘堆叠。
 * ──────────────────────────────────────────────────────────────────────────── */
const _CAL_SVG_NS = 'http://www.w3.org/2000/svg';
const CAL_CHART_H = 64, CAL_PLOT_TOP = 12, CAL_PLOT_BOTTOM = 46; /* 12→46 为柱区，上方一行数值、下方一行 X 轴标签 */
const CAL_CHART_RETRY_MS = [100, 300, 800]; /* patch4：WebView2 首帧 0 宽的多次重绘兜底时点 */
const CAL_LABEL_CH_W = 5.8; /* 8px 字号下每字符近似宽（含字距），用于判定 X 轴标签是否需要抽稀 */
function buildCalBarChart(labels: string[], values: number[], extraClass: string, hideZeroValue?: boolean): HTMLElement {
  const box = document.createElement('div');
  box.className = 'cal-chart';
  const n = Math.max(1, labels.length);
  const labelChars = Math.max(1, ...labels.map(l => l.length));
  const labelW = labelChars * CAL_LABEL_CH_W + 2; /* 单个标签所需最小横向占位 */
  const svg = document.createElementNS(_CAL_SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('class', 'cal-chart-svg ' + extraClass);
  svg.setAttribute('height', String(CAL_CHART_H));
  svg.setAttribute('role', 'img');
  const maxAbs = Math.max(1, ...values.map(v => Math.abs(v)));
  const bars: SVGRectElement[] = [];
  const valTexts: Array<SVGTextElement | null> = [];
  const xTexts: SVGTextElement[] = [];
  const mkText = (cls: string, y: number) => {
    const t = document.createElementNS(_CAL_SVG_NS, 'text') as SVGTextElement;
    t.setAttribute('class', cls);t.setAttribute('y', String(y));
    t.setAttribute('text-anchor', 'middle');svg.appendChild(t);return t;
  };
  labels.forEach((label, i) => {
    const v = values[i] || 0;
    const bar = document.createElementNS(_CAL_SVG_NS, 'rect') as SVGRectElement;
    bar.setAttribute('class', 'cal-chart-bar' + (v === 0 ? ' is-zero' : v < 0 ? ' is-neg' : ''));
    bar.setAttribute('rx', '2');
    svg.appendChild(bar);bars.push(bar);
    valTexts.push(hideZeroValue && v === 0 ? null : mkText('cal-chart-val', 9));
    const xt = mkText('cal-chart-x', 60);xt.textContent = label;xTexts.push(xt);
  });
  const draw = (width: number) => {
    const w = Math.max(24, Math.round(width));
    /* 左右各留半个标签宽：首 / 末位文字中心内缩，文字永不越出容器左右缘 */
    const pad = Math.min(Math.round(w / 4), Math.ceil(labelW / 2));
    const colW = Math.max(1, w - pad * 2) / n;
    const barW = Math.min(14, Math.max(2, colW * 0.55));
    /* X 轴标签抽稀：从末位回溯等距显示（末位必显）+ 首位必显 ⇒ 相邻可见文字间距恒 ≥ 文字宽 */
    const step = Math.max(1, Math.ceil(labelW / colW));
    svg.setAttribute('width', String(w));
    /* patch4：坐标系统钉死本次实宽（content 与视口 1:1）；万一 CSS 宽与绘制宽不同步，
       等比缩放而不是把 31 列裁在左缘。 */
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + CAL_CHART_H);
    labels.forEach((_label, i) => {
      const v = values[i] || 0;
      const cx = pad + i * colW + colW / 2;
      const h = v !== 0 ? Math.max(3, Math.round(Math.abs(v) / maxAbs * (CAL_PLOT_BOTTOM - CAL_PLOT_TOP))) : 0;
      const bar = bars[i];
      bar.setAttribute('x', (cx - barW / 2).toFixed(2));
      bar.setAttribute('width', barW.toFixed(2));
      bar.setAttribute('y', String(CAL_PLOT_BOTTOM - h));
      bar.setAttribute('height', String(h || 2));
      const vt = valTexts[i];
      if (vt) { vt.setAttribute('x', cx.toFixed(2));vt.textContent = String(v); }
      const xt = xTexts[i];
      xt.setAttribute('x', cx.toFixed(2));
      xt.setAttribute('display', i === 0 || i === n - 1 || (n - 1 - i) % step === 0 ? 'inline' : 'none');
    });
  };
  draw(n * 8);
  /* 图表宽恒等于容器实宽（不横向溢出、不横向滚动）：挂载前先按最小值兜底。
     patch4：WebView2 首帧 clientWidth 为 0 时不得把 0 宽当成实宽画死，
     改为「立即 + 100/300/800ms」多次重绘，取到非零实宽即止；
     ResizeObserver 仍作常态跟随（模块拖宽 / 折叠展开 / 隐藏后复显均会触发）。 */
  const relayout = () => {
    if (!box.isConnected) return false;
    const w = box.clientWidth || (box.parentElement ? box.parentElement.clientWidth : 0);
    if (!(w > 0)) return false;
    draw(w);
    return true;
  };
  relayout();
  let _retryIdx = 0;
  const retryLater = () => {
    if (_retryIdx >= CAL_CHART_RETRY_MS.length) return;
    setTimeout(() => {
      if (!box.isConnected) return;
      if (relayout()) return;
      _retryIdx += 1;
      retryLater();
    }, CAL_CHART_RETRY_MS[_retryIdx]);
  };
  retryLater();
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => { if (box.isConnected) relayout(); else ro.disconnect(); });
    ro.observe(box);
  }
  box.appendChild(svg);
  return box;
}

/**
 * 任务统计面板（canonical :17912）。
 * 单次 O(n) 建「日期→节点」索引，替代按天全表扫描。
 */
export function buildStatsBlock(): HTMLElement {
  const now = new Date();
  const calView = deps.ui.calView || 'month';
  const cm = deps.ui.calMonth || { y: now.getFullYear(), m: now.getMonth() };
  const y = cm.y, m = cm.m;
  const _dayIdx = new Map<string, any[]>();
  const nodes = (deps.state && deps.state.nodes) || {};
  for (const id in nodes) {
    const n = nodes[id];
    if (!n) continue;
    if (n.id === deps.state.rootId || n._deleted) continue;
    if (isFolderId(n.id)) continue;
    if (n.date) {
      const bucket = _dayIdx.get(n.date) || [];
      bucket.push(n);
      _dayIdx.set(n.date, bucket);
    }
  }
  const _dayStats = (ds: string) => {
    const list = (_dayIdx.get(ds) || []).filter((n: any) => !deps.isBlankNode(n));
    return { done: list.filter((n: any) => n.done).length, total: list.length };
  };
  const days: Array<{ done: number; total: number; label: string }> = [];
  if (calView === 'year') {
    for (let mm = 0; mm < 12; mm++) {
      const daysInMonth = new Date(y, mm + 1, 0).getDate();
      let total = 0, done = 0;
      for (let dd = 1; dd <= daysInMonth; dd++) {
        const s = _dayStats(ymd(new Date(y, mm, dd)));
        total += s.total; done += s.done;
      }
      days.push({ done, total, label: (mm + 1) + '月' });
    }
  } else if (calView === 'week') {
    const selD = parseYmd(deps.ui.selectedDate || todayStr());
    const dow = selD.getDay();
    const sun = new Date(selD.getFullYear(), selD.getMonth(), selD.getDate() - dow);
    for (let i = 0; i < 7; i++) {
      const d = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + i);
      const s = _dayStats(ymd(d));
      days.push({ done: s.done, total: s.total, label: (d.getMonth() + 1) + '/' + d.getDate() });
    }
  } else {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let dd = 1; dd <= daysInMonth; dd++) {
      const d = new Date(y, m, dd);
      const s = _dayStats(ymd(d));
      days.push({ done: s.done, total: s.total, label: String(dd) });
    }
  }
  const block = document.createElement('div');
  const totalDone = days.reduce((s, d) => s + d.done, 0);
  const totalAll = days.reduce((s, d) => s + d.total, 0);
  const rate = totalAll > 0 ? Math.round(totalDone / totalAll * 100) : 0;
  const activeDays = days.filter(d => d.total > 0).length;
  const summary = document.createElement('div');
  summary.className = 'cal-stat-grid';
  [{ label: '总完成', val: String(totalDone), cls: 'is-pos' },
   { label: '总任务', val: String(totalAll), cls: '' },
   { label: '完成率', val: rate + '%', cls: 'is-pos' },
   { label: '活跃天数', val: String(activeDays), cls: '' }].forEach(c => {
    const card = document.createElement('div');
    card.className = 'cal-stat-card';
    const v = document.createElement('div');
    v.className = 'cal-stat-val' + (c.cls ? ' ' + c.cls : '');
    v.textContent = c.val;
    const lb = document.createElement('div');
    lb.className = 'cal-stat-label';
    lb.textContent = c.label;
    card.appendChild(v);card.appendChild(lb);
    summary.appendChild(card);
  });
  block.appendChild(summary);
  /* fix1-1 · 与「字数统计」同口径：0 值不渲染数值标签（原实现把 31 个 0 逐个画在柱体上方） */
  block.appendChild(buildCalBarChart(days.map(d => d.label), days.map(d => d.done), 'stats-chart', true));
  return block;
}

export function calModuleLogBody(head: HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  const panel = deps.buildCalLogBlock();
  const badge = panel.querySelector('.cal-panel-head .badge');
  if(badge)calModuleBadge(head, badge.textContent || '');
  const body = panel.querySelector('.cal-panel-body');
  if(body)wrap.appendChild(body);
  return wrap;
}
export function calModuleStatsBody(head: HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  const t = head.querySelector('.cal-module-title');
  if(t)t.textContent = '任务统计';
  try{ wrap.appendChild(deps.buildStatsBlock()); }catch(e){ const fb = document.createElement('div');fb.className = 'cal-no-activity';fb.textContent = '暂无统计数据';wrap.appendChild(fb); }
  return wrap;
}
/* R54 · 字数统计（零遍历）：只按当前视图的日期列表读取 state.charStats[ds] 增量缓存，
   年视图 365 次 / 月视图 28–31 次 / 周视图 7 次 O(1) 取值，不做任何节点遍历。 */
export function calModuleCharsDates(): string[] {
  const now = new Date();
  const cm = deps.ui.calMonth || { y: now.getFullYear(), m: now.getMonth() };
  const y = cm.y, m = cm.m;
  const calView = deps.ui.calView || 'month';
  const out: string[] = [];
  if(calView === 'week'){
    const selD = parseYmd(deps.ui.selectedDate || todayStr());
    const dow = selD.getDay();
    const sun = new Date(selD.getFullYear(), selD.getMonth(), selD.getDate() - dow);
    for(let i = 0;i < 7;i++)out.push(ymd(new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + i)));
    return out;
  }
  if(calView === 'year'){
    for(let mm = 0;mm < 12;mm++){
      const dimY = new Date(y, mm + 1, 0).getDate();
      for(let dd = 1;dd <= dimY;dd++)out.push(ymd(new Date(y, mm, dd)));
    }
    return out;
  }
  const dimM = new Date(y, m + 1, 0).getDate();
  for(let dd = 1;dd <= dimM;dd++)out.push(ymd(new Date(y, m, dd)));
  return out;
}
export function calModuleCharsBody(head?: HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  const now = new Date();
  const cm = deps.ui.calMonth || { y: now.getFullYear(), m: now.getMonth() };
  const y = cm.y, m = cm.m;
  if(head){const _t = head.querySelector('.cal-module-title');if(_t)_t.textContent = '字数统计';}
  const calView = deps.ui.calView || 'month';
  const dates = calModuleCharsDates();
  const stats = (deps.state && deps.state.charStats && typeof deps.state.charStats === 'object') ? deps.state.charStats : {};
  /* fix7 · token 口径：add=A（纯新增）、del=R（纯删除）、mod=M（纯修改）、net=N（净变化 = I-D = A-R）。
     旧实现把「净变化」写成 add - del + mod，修改被重复计一次（实测 20-0+18=38，真实净增仅 20）；
     此处优先读引擎写入的 net，缺失（历史数据）时回落 add - del，绝不回落 add - del + mod。 */
  const netOfBucket = (b: any): number => {
    if(!b)return 0;
    if(typeof b.net === 'number' && isFinite(b.net))return b.net | 0;
    return (b.add | 0) - (b.del | 0);
  };
  let totalAdd = 0, totalDel = 0, totalMod = 0, totalNet = 0;
  for(let i = 0;i < dates.length;i++){
    const ds = dates[i];
    const b = stats[ds];
    const a = b ? (b.add | 0) : 0, d = b ? (b.del | 0) : 0, md = b ? (b.mod | 0) : 0;
    totalAdd += a;totalDel += d;totalMod += md;totalNet += netOfBucket(b);
  }
  const net = totalNet;
  const sg = (v: number) => v > 0 ? '+' + v : String(v);
  const grid = document.createElement('div');
  grid.className = 'cal-stat-grid';
  [{ label: '新增', val: String(totalAdd), cls: 'is-pos' },
   { label: '删除', val: String(totalDel), cls: 'is-neg' },
   { label: '修改', val: sg(totalMod), cls: '' },
   { label: '净变化', val: sg(net), cls: net < 0 ? 'is-neg' : 'is-pos' }].forEach(c => {
    const card = document.createElement('div');
    card.className = 'cal-stat-card';
    const v = document.createElement('div');
    v.className = 'cal-stat-val' + (c.cls ? ' ' + c.cls : '');
    v.textContent = c.val;
    const lb = document.createElement('div');
    lb.className = 'cal-stat-label';
    lb.textContent = c.label;
    card.appendChild(v);card.appendChild(lb);
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  let daysData: Array<{ label: string; net: number }> = [];
  if(calView === 'year'){
    for(let mm = 0;mm < 12;mm++){
      let monthNet = 0;
      const daysInMonth = new Date(y, mm + 1, 0).getDate();
      for(let dd = 1;dd <= daysInMonth;dd++){
        const ds = ymd(new Date(y, mm, dd));
        const st = stats[ds];
        if(st)monthNet += netOfBucket(st);
      }
      daysData.push({ label: (mm + 1) + '月', net: monthNet });
    }
  }else if(calView === 'week'){
    const selD = parseYmd(deps.ui.selectedDate || todayStr());
    const dow = selD.getDay();
    const sun = new Date(selD.getFullYear(), selD.getMonth(), selD.getDate() - dow);
    for(let i = 0;i < 7;i++){
      const d = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + i);
      const ds = ymd(d);
      const st = stats[ds];
      const dayNet = netOfBucket(st);
      daysData.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), net: dayNet });
    }
  }else{
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for(let dd = 1;dd <= daysInMonth;dd++){
      const ds = ymd(new Date(y, m, dd));
      const st = stats[ds];
      const dayNet = netOfBucket(st);
      daysData.push({ label: String(dd), net: dayNet });
    }
  }
  wrap.appendChild(buildCalBarChart(daysData.map(d => d.label), daysData.map(d => d.net), 'chars-chart', true));
  return wrap;
}
/* 标题行拖拽排序：实时 insertBefore，pointerup 回写 ui.calModules.order。
   R39：pointercancel 必须还原 DOM 顺序（按 pointerdown 快照 appendChild 回填），防止触屏手势打断后
   DOM 已乱而 order 未更新、下次 forceRender 按旧 order 重建导致模块跳回原位；取消分支不写
   st.order、不调 saveUI。 */
export function calModuleBindDrag(mod: HTMLElement, grid: HTMLElement): void {
  const head = mod.querySelector<HTMLElement>('.cal-module-head');
  if(!head)return;
  head.addEventListener('pointerdown', (e: PointerEvent) => {
    if(e.button !== 0)return;
    if((e.target as HTMLElement).closest && (e.target as HTMLElement).closest('.cal-module-del'))return;
    const sx = e.clientX, sy = e.clientY;
    const snapshotOrder = Array.from(grid.querySelectorAll<HTMLElement>('.cal-module')).map(m => m.dataset.key);
    let started = false, raf = 0, lastEv: PointerEvent | null = null, overEl: Element | null = null, after = false;
    const clearMarks = () => { grid.querySelectorAll('.cal-module').forEach(m => m.classList.remove('drop-before', 'drop-after')); };
    const onMove = (ev: PointerEvent) => {
      lastEv = ev;
      if(!started){
        if(Math.abs(ev.clientX - sx) <= 5 && Math.abs(ev.clientY - sy) <= 5)return;
        started = true;
        mod.classList.add('dragging');
        document.body.style.cursor = 'grabbing';
        try{head.setPointerCapture(ev.pointerId);}catch(err){console.warn('[JU] caught error',err);}
      }
      if(raf)return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = lastEv;if(!p)return;
        const el = document.elementFromPoint(p.clientX, p.clientY);
        const over = el && el.closest ? el.closest('.cal-module') : null;
        if(!over || over === mod || !grid.contains(over)){clearMarks();overEl = null;return;}
        const r = over.getBoundingClientRect();
        const dx = (p.clientX - (r.left + r.width / 2)) / (r.width || 1);
        const dy = (p.clientY - (r.top + r.height / 2)) / (r.height || 1);
        const nowAfter = Math.abs(dy) > Math.abs(dx) ? dy > 0 : dx > 0; /* 按左右 / 上下半区判定插入侧 */
        if(over !== overEl || nowAfter !== after){overEl = over;after = nowAfter;clearMarks();over.classList.add(nowAfter ? 'drop-after' : 'drop-before');}
        const ref = nowAfter ? over.nextSibling : over;
        if(ref !== mod)grid.insertBefore(mod, ref);
      });
    };
    /* 统一收尾：移除三类监听 + 取消 rAF + 清 drop 标记 + 复位 dragging / body.cursor + 释放捕获 */
    const stopAll = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      if(raf){cancelAnimationFrame(raf);raf = 0;}
      clearMarks();
      mod.classList.remove('dragging');
      document.body.style.cursor = '';
      try{head.releasePointerCapture(ev.pointerId);}catch(err){console.warn('[JU] caught error',err);}
    };
    const onUp = (ev: PointerEvent) => {
      stopAll(ev);
      if(!started)return;
      /* 顺序回写：以容器实际子节点顺序为准，隐藏模块保留在 order 尾部 */
      const st = calModuleState();
      const now: string[] = [];
      grid.querySelectorAll<HTMLElement>('.cal-module').forEach(m => { if(m.dataset.key)now.push(m.dataset.key); });
      st.order.forEach((k: string) => { if(now.indexOf(k) < 0)now.push(k); });
      st.order = now;
      deps.saveUI();
      /* 拖拽结束后 400ms 内捕获并阻止紧随的 click，避免误触标题 / 删除 */
      const swallow = (ce: Event) => { ce.stopPropagation();ce.preventDefault(); };
      document.addEventListener('click', swallow, true);
      setTimeout(() => document.removeEventListener('click', swallow, true), 400);
    };
    /* R39：触屏 / 系统手势打断 ⇒ 按快照还原 DOM 顺序，且不写 st.order、不调 saveUI */
    const onCancel = (ev: PointerEvent) => {
      stopAll(ev);
      const tail: Element[] = [];
      Array.from(grid.children).forEach(c => { if(!c.classList.contains('cal-module'))tail.push(c); });
      const byKey: Record<string, HTMLElement> = {};
      grid.querySelectorAll<HTMLElement>('.cal-module').forEach(m => { byKey[m.dataset.key as string] = m; });
      snapshotOrder.forEach(k => { const m = k ? byKey[k] : null;if(m)grid.appendChild(m); });
      tail.forEach(c => grid.appendChild(c));
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  });
}
/* 右下角缩放：setPointerCapture + rAF 节流改宽高（最小宽 150px / 最小高 160px），pointerup 写入 sizes。
   R38：拖拽中以 flex:0 0 <w>px + minWidth 实时固定占位，松手后改回 flex:1 1 <w>px 等比伸缩。
   R39：落盘用拖拽期维护的目标值 w / h，禁止回读 offsetWidth / offsetHeight（该值含 flex-grow 与
   align-items:stretch 的二次分配，回读再落盘会单向膨胀并击穿换行阈值）；点击不拖动不落盘；
   calendar 只落高度（恒 flex:1 1 100% 独占整行），sizes.calendar 只存 {h}。 */
export function calModuleBindResize(mod: HTMLElement, handle: HTMLElement): void {
  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    if(e.button !== 0)return;
    e.preventDefault();e.stopPropagation();
    const r = mod.getBoundingClientRect();
    const w0 = r.width, h0 = r.height, x0 = e.clientX, y0 = e.clientY;
    const initFlex = mod.style.flex, initMinWidth = mod.style.minWidth, initMinHeight = mod.style.minHeight;
    const initHeight = mod.style.height, initMaxHeight = mod.style.maxHeight;
    let w = Math.max(150, Math.round(w0)), h = Math.max(160, Math.round(h0));
    let moved = false;
    /* 缩放开始即固定该模块的伸缩基准（flex:0 0 <w>px + minWidth）：否则同行模块的 flex-shrink 会把
       显式宽度抵回原值，表现为「只增高不增宽」的假缩放。
       R39：拖拽期以 height 承载高度（minHeight 归零 / maxHeight 放开），否则上一轮落盘的固定
       height 会把本次拖高抵住，表现为「拖不动高度」。 */
    mod.style.flex = '0 0 ' + w + 'px';
    mod.style.minWidth = w + 'px';
    mod.style.minHeight = '0px';
    mod.style.height = h + 'px';
    mod.style.maxHeight = 'none';
    let raf = 0, last: PointerEvent | null = null;
    try{handle.setPointerCapture(e.pointerId);}catch(err){console.warn('[JU] caught error',err);}
    const onMove = (ev: PointerEvent) => {
      moved = true;
      last = ev;
      if(raf)return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if(!last)return;
        w = Math.max(150, Math.round(w0 + (last.clientX - x0)));
        h = Math.max(160, Math.round(h0 + (last.clientY - y0)));
        mod.style.flex = '0 0 ' + w + 'px';
        mod.style.minWidth = w + 'px';
        mod.style.height = h + 'px';
      });
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onCancel);
      if(raf){cancelAnimationFrame(raf);raf = 0;}
      try{handle.releasePointerCapture(e.pointerId);}catch(err){console.warn('[JU] caught error',err);}
      /* R39：未产生任何位移（纯点击）⇒ 原样还原进入时的样式，不落盘 */
      if(!moved){
        mod.style.flex = initFlex;
        mod.style.minWidth = initMinWidth;
        mod.style.minHeight = initMinHeight;
        mod.style.height = initHeight;
        mod.style.maxHeight = initMaxHeight;
        return;
      }
      const st = calModuleState();
      const el = mod;
      const key = el.dataset.key;
      const hpx = h + 'px';
      /* R39：一律用拖拽期目标值 w / h 落盘（不回读 offsetWidth / offsetHeight），
         并同时写 height / minHeight / maxHeight 三件套锁定行高 —— 内容增删不再推高整行 */
      if(key === 'calendar'){
        el.style.flex = '1 1 100%';
        el.style.minWidth = '100%';
        el.style.height = hpx;el.style.minHeight = hpx;el.style.maxHeight = hpx;
        st.sizes[key] = { h: h };
      }else{
        el.style.flex = '1 1 ' + w + 'px';
        el.style.minWidth = '150px';
        el.style.height = hpx;el.style.minHeight = hpx;el.style.maxHeight = hpx;
        st.sizes[key as string] = { w: w, h: h };
      }
      deps.saveUI();
    };
    /* L23 · 缩放中断（触屏长按 / 系统手势打断只发 pointercancel，无 pointerup）：
       摘监听 + 取消 rAF + 释放指针捕获，并原样还原进入时的 5 项内联样式；不写 st.sizes、不调 saveUI */
    const onCancel = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onCancel);
      if(raf){cancelAnimationFrame(raf);raf = 0;}
      try{handle.releasePointerCapture(e.pointerId);}catch(err){console.warn('[JU] caught error',err);}
      mod.style.flex = initFlex;
      mod.style.minWidth = initMinWidth;
      mod.style.minHeight = initMinHeight;
      mod.style.height = initHeight;
      mod.style.maxHeight = initMaxHeight;
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onCancel);
  });
}
export function renderCalModules(calTop?: HTMLElement | null): HTMLElement {
  const st = calModuleState();
  const grid = document.createElement('div');grid.className = 'cal-modules';
  const visible = st.order.filter((k: string) => !st.hidden[k]);
  visible.forEach((k: string) => {
    const mod = document.createElement('div');
    mod.className = 'cal-module';
    mod.dataset.key = k;
    const sz = st.sizes[k];
    /* R38：已落盘尺寸改为可伸缩基准（1 1 <w>px）——大空间下按占比放大、小空间下按 min-width:150px
       安全收缩。无尺寸时其余模块按 24% 平分一行 —— 宽屏下稳定保持一行 4 个，防止因微小宽度变化
       突然从两行并成一行而整体上移。
       R39：calendar 永远独占整行，宽度不可拖拽落盘（尺寸分支优先判 calendar，禁止 sz.w 覆盖 100% 独占）；
       有尺寸时同时写 height / minHeight / maxHeight 三件套以锁定行高，内容增删不再推高整行。 */
    if(k === 'calendar'){
      mod.style.flex = '1 1 100%';
      mod.style.minWidth = '100%';
      if(sz && sz.h > 0){const _h = Math.round(sz.h) + 'px';mod.style.height = _h;mod.style.minHeight = _h;mod.style.maxHeight = _h;}
    }else if(sz && sz.w > 0){
      mod.style.flex = '1 1 ' + Math.round(sz.w) + 'px';
      mod.style.minWidth = '150px';
      if(sz.h > 0){const _h = Math.round(sz.h) + 'px';mod.style.height = _h;mod.style.minHeight = _h;mod.style.maxHeight = _h;}
    }else{
      mod.style.flex = '1 1 24%';
      mod.style.minWidth = '150px';
    }
    const head = document.createElement('div');head.className = 'cal-module-head';
    const title = document.createElement('span');title.className = 'cal-module-title';title.textContent = calModuleTitle(k);
    head.appendChild(title);
    const body = document.createElement('div');body.className = 'cal-module-body';
    /* R36：日历网格模块 —— body 直接挂载 renderCalendarPage 构建的 .cal-top 原节点（含年 / 月 / 周切换、
       前后翻页、月视图 .cal-grid、周视图时间网格 .cal-tg 及其拖拽 / 缩放绑定），迁移父容器不重建 DOM。 */
    if(k === 'calendar'){if(calTop)body.appendChild(calTop);}
    else if(k === 'chars')body.appendChild(calModuleCharsBody(head));
    else if(k === 'note')body.appendChild(calModuleNoteBody());
    else if(k === 'today')body.appendChild(calModuleTodayBody(head));
    else if(k === 'log')body.appendChild(calModuleLogBody(head));
    else if(k === 'stats')body.appendChild(calModuleStatsBody(head));
    const del = document.createElement('span');del.className = 'cal-module-del';del.title = '移除模块';del.textContent = '✕';
    del.onclick = e => { e.stopPropagation();const s = calModuleState();s.hidden[k] = true;deps.saveUI();deps.forceRender(); };
    head.appendChild(del);
    mod.appendChild(head);
    mod.appendChild(body);
    const rz = document.createElement('div');rz.className = 'cal-module-resize';rz.title = '拖动调整大小';
    mod.appendChild(rz);
    calModuleBindDrag(mod, grid);
    calModuleBindResize(mod, rz);
    grid.appendChild(mod);
  });
  if(!visible.length){
    const e = document.createElement('div');e.className = 'cal-empty-hint';
    e.style.cssText = 'padding:10px;text-align:center;width:100%;box-sizing:border-box';
    e.textContent = '全部模块已移除，可从下方恢复';
    grid.appendChild(e);
  }
  const add = document.createElement('div');add.className = 'cal-module-add';add.textContent = '+ 添加模块';
  add.style.flex = '1 1 100%';
  add.onclick = e => {
    const s = calModuleState();
    const hiddenList = CAL_MODULE_KEYS.filter(k => s.hidden[k]);
    if(!hiddenList.length){try{toast('全部模块均已显示');}catch(err){console.warn('[JU] caught error',err);}return;}
    const items = hiddenList.map(k => ({ txt: '+ ' + calModuleTitle(k), fn: () => { const s2 = calModuleState();s2.hidden[k] = false;deps.saveUI();deps.forceRender(); } }));
    try{showContextMenu(items, { clientX: e.clientX, clientY: e.clientY } as any);}
    catch(err){const s3 = calModuleState();s3.hidden[hiddenList[0]] = false;deps.saveUI();deps.forceRender();}
  };
  grid.appendChild(add);
  return grid;
}
export function renderCalendarPage(): HTMLElement {
  deps.ui._focusTick = _calDataRev; /* FIX-P2-11: 本次渲染周期的焦点代次锚点——焦点变化不再推进 _calDataRev */
  /* L7-W4 两阶段渲染（阶段 1）：calIndex 未就绪 → **同步**返回骨架页（本函数内不做任何全库扫描），
     后台分块构建完成后 forceRender（阶段 2）→ 走既有完整渲染路径，口径不变 */
  if(!_calIndexCache){
    const _pageSk = document.createElement('div');_pageSk.className = 'cal-page';
    _pageSk.appendChild(deps.l7Skeleton('calendar', { mode: 'rows', count: 10, hint: '正在构建日历索引…', label: '日历索引' }));
    l7CalIndexWhenReady(function(){ if(deps.isCalendarView())deps.forceRender(); });
    return _pageSk;
  }
  clearCalTgTimer(); /* 日历重渲染即清理上一轮时间线定时器 */
  document.documentElement.style.setProperty('--tg-hour-h', tgHourH() + 'px'); /* FIX-9: 时间网格行高随字号缩放同步到 CSS 变量 */
  const page = document.createElement('div');page.className = 'cal-page';
  const now = new Date();
  if(!deps.ui.calMonth)deps.ui.calMonth = { y: now.getFullYear(), m: now.getMonth() };
  if(!deps.ui.calView)deps.ui.calView = 'month';
  if(deps.ui.calView === 'day'){deps.ui.calView = 'week';deps.saveUI();} /* 日视图已移除：旧会话持久化的 day 归一到 week；FIX-P1-12: 归一后同步持久化，否则下次刷新仍读回 day 再修正 */
  const calView = deps.ui.calView;
  /* 供 buildTimeGrid 判定「进入周视图」触发必滚：仅非周视图刷新标记，
     周视图自身保持 buildTimeGrid 内置的 _calTgLastView='week'（否则进入判定恒为 false） */
  if(calView !== 'week')_calTgLastView = calView;
  const { y, m } = deps.ui.calMonth;
  const top = document.createElement('div');top.className = 'cal-top';
  const header = document.createElement('div');header.className = 'cal-header';
  const title = document.createElement('div');title.className = 'cal-date-title';
  if(calView === 'year')title.textContent = y + ' 年';
  else if(calView === 'week'){
    const selD = parseYmd(deps.ui.selectedDate || todayStr());
    const dow = selD.getDay();
    const sun = new Date(selD.getFullYear(), selD.getMonth(), selD.getDate() - dow);
    const sat = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 6);
    title.textContent = (sun.getMonth() + 1) + '/' + sun.getDate() + ' - ' + (sat.getMonth() + 1) + '/' + sat.getDate();
  }else title.textContent = y + ' 年 ' + (m + 1) + ' 月';
  header.appendChild(title);
  const actions2 = document.createElement('div');actions2.className = 'cal-actions';
  const mkBtn = (txt: string, fn: () => void, cls?: string) => { const b = document.createElement('button');b.className = 'cal-tool' + (cls ? ' ' + cls : '');b.textContent = txt;b.onclick = fn;return b; };
  const viewSwitch = document.createElement('div');viewSwitch.className = 'cal-view-switch';
  ['year', 'month', 'week'].forEach(v => {
    const b = document.createElement('button');
    b.className = 'cal-view-btn' + (calView === v ? ' active' : '');
    b.textContent = ({ year: '年', month: '月', week: '周' } as Record<string, string>)[v];
    b.onclick = () => { deps.ui.calView = v;deps.saveUI();deps.forceRender(); };
    viewSwitch.appendChild(b);
  });
  actions2.appendChild(viewSwitch);
  const tagSel = document.createElement('select');
  tagSel.className = 'cal-tool cal-tag-filter';
  tagSel.title = '按标签筛选待办';
  const allOpt = document.createElement('option');allOpt.value = '';allOpt.textContent = '标签：全部';
  tagSel.appendChild(allOpt);
  const ctagMap = deps.calendarTagIndex();
  Array.from(ctagMap.entries()).sort((a, b) => b[1] - a[1]).forEach(([t, cnt]) => {
    const o = document.createElement('option');o.value = t;o.textContent = '● #' + t + ' (' + cnt + ')';
    tagSel.appendChild(o);
  });
  if(deps.ui.calTagFilter && ctagMap.has(deps.ui.calTagFilter)){tagSel.value = deps.ui.calTagFilter;tagSel.classList.add('active');}
  else if(deps.ui.calTagFilter){deps.ui.calTagFilter = '';deps.saveUI();}
  tagSel.onchange = () => { deps.ui.calTagFilter = tagSel.value;deps.saveUI();deps.forceRender(); };
  if(calView === 'month'){
    actions2.appendChild(mkBtn('‹', () => { deps.ui.calMonth.m--;if(deps.ui.calMonth.m < 0){deps.ui.calMonth.m = 11;deps.ui.calMonth.y--;}deps.saveUI();deps.forceRender(); }));
    actions2.appendChild(mkBtn('今天', () => { deps.ui.calMonth = { y: now.getFullYear(), m: now.getMonth() };deps.ui.selectedDate = todayStr();deps.saveUI();deps.forceRender(); }, 'primary'));
    actions2.appendChild(mkBtn('›', () => { deps.ui.calMonth.m++;if(deps.ui.calMonth.m > 11){deps.ui.calMonth.m = 0;deps.ui.calMonth.y++;}deps.saveUI();deps.forceRender(); }));
  }else if(calView === 'week'){
    actions2.appendChild(mkBtn('‹', () => { const selD = parseYmd(deps.ui.selectedDate || todayStr());selD.setDate(selD.getDate() - 7);deps.ui.selectedDate = ymd(selD);deps.ui.calMonth = { y: selD.getFullYear(), m: selD.getMonth() };deps.saveUI();deps.forceRender(); }));
    actions2.appendChild(mkBtn('今天', () => { deps.ui.selectedDate = todayStr();deps.ui.calMonth = { y: now.getFullYear(), m: now.getMonth() };deps.saveUI();deps.forceRender(); }, 'primary'));
    actions2.appendChild(mkBtn('›', () => { const selD = parseYmd(deps.ui.selectedDate || todayStr());selD.setDate(selD.getDate() + 7);deps.ui.selectedDate = ymd(selD);deps.ui.calMonth = { y: selD.getFullYear(), m: selD.getMonth() };deps.saveUI();deps.forceRender(); }));
  }else{
    actions2.appendChild(mkBtn('‹', () => { deps.ui.calMonth.y--;deps.saveUI();deps.forceRender(); }));
    actions2.appendChild(mkBtn('今年', () => { deps.ui.calMonth = { y: now.getFullYear(), m: now.getMonth() };deps.ui.selectedDate = todayStr();deps.saveUI();deps.forceRender(); }, 'primary'));
    actions2.appendChild(mkBtn('›', () => { deps.ui.calMonth.y++;deps.saveUI();deps.forceRender(); }));
  }
  actions2.appendChild(tagSel);
  header.appendChild(actions2);
  top.appendChild(header);
  const todayS = todayStr();
  const MAX_NODES = deps.ui.maxCalNodes || 3;
  /* FIX-L-03: 由渲染内局部 Map 提升为模块级 _renderDayCache，跨渲染共享。
     FIX-S-1: 代次信号由 state._rev 改为 state.updatedAt —— _rev 仅在 runPersist 成功写盘时递增，
     300ms 防抖窗口内连续 commit 共享同一 _rev 会读到过期日列表；updatedAt 每次 commit 单调递增（见 FIX-S-4）即整表重建。
     L16-W2（指令2）: 代次信号再由 state.updatedAt 改为独立日历数据代次 _calDataRev —— updatedAt 在每次 commit
     （含大纲正文编辑、折叠态切换）均单调递增，日历待办实际不变时也整表重建 2000 条 LRU；
     _calDataRev 仅在日历数据失效（invalidateCalIndex / _calIndexCache 置空）或选择态（selectedDate / calTagFilter）
     变化时递增，编辑大纲正文不再触发日缓存整表重建。 */
  const _calSelKeyNow = (deps.ui.selectedDate || '') + '|' + (deps.ui.calTagFilter || ''); /* FIX-P2-11: focusId 移出选择态签名，点击/聚焦日历条目不再推进代次与整表重建 */
  if(_calSelKeyNow !== _calSelKey){_calSelKey = _calSelKeyNow;_calDataRev++;} /* L16-W2: 选择态变化 → 日缓存整表重建 */
  if(!_renderDayCache || _renderDayCache._gen !== _calDataRev)_renderDayCache = { _gen: _calDataRev, map: deps.makeLRU(2000) }; /* FIX-P3-8(补充): 复用 makeLRU——原手写 while 淘汰（对齐 _calDayCache 2000），风格统一且命中自动重排 */
  const _dayCache = (_renderDayCache as { _gen: number; map: any }).map;
  const getDayNodes = (ds: string): CalTodos => {
    const key = ds + '|f=' + (deps.ui.calTagFilter || '') + '|fo=' + (deps.ui.focusId || ''); /* FIX-R65-P2-2: focusId 并入日缓存键——焦点空文本节点自成一键，切换焦点不再复用不含该节点的旧列表 */
    if(!_dayCache.has(key)){
      let list = calendarTodosOnDate(ds).filter((n: any) => n.showInCal !== false && (!deps.isBlankNode(n) || (deps.ui.focusId === n.id && deps.ui._focusTick === _calDataRev))) as CalTodos;
      list.rawTotal = list.length; /* FIX-L-15: 标签过滤前总数，用于 p1head "筛选自 N 条" */
      if(deps.ui.calTagFilter)list = list.filter((n: any) => deps.nodeHasTag(n, deps.ui.calTagFilter)) as CalTodos;
      /* FIX-LEAK-2: 同代内 LRU 上限（对齐 _calDayCache 的 2000）——翻年/翻月在同一 updatedAt 代内
         不重建缓存，年视图 365 天 × 多过滤态可累积上万条目；溢出淘汰由 makeLRU.set 内部处理 */
      _dayCache.set(key, list);
    }
    return _dayCache.get(key);
  };
  /* 日历底部模块复用同一次渲染的 getDayNodes（日缓存 / 标签过滤 / focusId 口径完全一致） */
  _calDayNodesForModules = getDayNodes;
  function makeCell(cellDate: Date, ds: string): HTMLElement {
    const cell = document.createElement('div');cell.className = 'cal-cell';
    if(ds === todayS)cell.classList.add('today');
    if(ds === deps.ui.selectedDate)cell.classList.add('selected');
    const numRow = document.createElement('div');numRow.className = 'cal-daynum';
    const numSpan = document.createElement('span');numSpan.textContent = String(cellDate.getDate());numRow.appendChild(numSpan);
    const lab = dayLabel(cellDate);
    if(lab.text){const ls = document.createElement('span');ls.className = 'cal-lunar' + (lab.fest ? ' cal-fest' : '');ls.textContent = lab.text;numRow.appendChild(ls);}
    if(lab.rest){const rs = document.createElement('span');rs.className = 'cal-rest';rs.textContent = '休';rs.title = '法定节假日';numRow.appendChild(rs);}
    cell.appendChild(numRow);
    const items = document.createElement('div');items.className = 'cal-items';
    const dayNodes = getDayNodes(ds);
    dayNodes.slice(0, MAX_NODES).forEach((n: any) => {
      const el = document.createElement('div');
      el.className = 'cal-item' + (n.done ? ' done' : '');
      if(n.tags && n.tags.length){
        /* v2.1 fix4 · P2：有标签事件块改为「左侧侧边栏同款淡色」——只注入 --tag-color 这一个 CSS 变量，
           淡底（标签色 alpha 32%）/深色文字/描边全部由 .cal-item.has-tag 类承载（style.css），
           不再写内联 background/color（任务书禁令：不使用内联 style 修改颜色，必须改 CSS 类）。 */
        el.classList.add('has-tag');
        el.style.setProperty('--tag-color', deps.getTagColor(n.tags[0]));
        el.title = '#' + n.tags.join(' #') + ' · ' + stripHtml(n.text);
      }
      /* v2.1 fix1 · P2: 月视图单元格同样调用唯一优先级渲染器（此前只渲染文本，单元格无优先级视觉；P2 要求两处同源） */
      const _cellPk = prioKeyOf(n.priority);
      if(_cellPk)el.appendChild(priorityBadges(_cellPk));
      el.appendChild(document.createTextNode(deps.tagStripText(n)));
      el.title = el.title || deps.tagStripText(n);
      el.dataset.nid = n.id;
      el.onclick = (e) => {
        e.stopPropagation();
        const ae = document.activeElement as HTMLElement | null;
        if(ae && ae.blur)ae.blur();
        deps.ui.selectedDate = ds;deps.ui.focusId = n.id;
        deps.saveUI();
        deps.forceRender();
        setTimeout(() => {
          const cellEl = document.querySelector('.cal-cell[data-ds="' + CSS.escape(ds) + '"]');
          const t = ((cellEl || document) as any).querySelector('.cal-node .text[data-id="' + CSS.escape(n.id) + '"]');
          if(t)t.focus();
        }, 30);
      };
      items.appendChild(el);
    });
    if(dayNodes.length > MAX_NODES){const more = document.createElement('div');more.className = 'cal-more';more.textContent = '+' + (dayNodes.length - MAX_NODES);items.appendChild(more);}
    cell.appendChild(items);
    cell.dataset.ds = ds;
    cell.onclick = () => {
      const ae = document.activeElement as HTMLElement | null;
      if(ae && ae.blur)ae.blur();
      deps.ui.selectedDate = ds;deps.saveUI();deps.forceRender();
    };
    return cell;
  }
  if(calView === 'month'){
    const grid = document.createElement('div');grid.className = 'cal-grid';
    ['日', '一', '二', '三', '四', '五', '六'].forEach((d, i) => { const el = document.createElement('div');el.className = 'cal-dow' + (i === 0 || i === 6 ? ' wk' : '');el.textContent = d;grid.appendChild(el); });
    const first = new Date(y, m, 1);const startDow = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();const prevDays = new Date(y, m, 0).getDate();
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
    for(let i = 0;i < totalCells;i++){
      const dayOffset = i - startDow + 1;
      let cellDate: Date, out = false;
      if(dayOffset < 1){cellDate = new Date(y, m - 1, prevDays + dayOffset);out = true;}
      else if(dayOffset > daysInMonth){cellDate = new Date(y, m + 1, dayOffset - daysInMonth);out = true;}
      else cellDate = new Date(y, m, dayOffset);
      const ds = ymd(cellDate);
      const cell = makeCell(cellDate, ds);
      if(out)cell.classList.add('out');
      grid.appendChild(cell);
    }
    top.appendChild(grid);
  }else if(calView === 'week'){
    const sel = parseYmd(deps.ui.selectedDate || todayStr());
    /* L17-W2 · 指令 2（Defect-P0-2）：原以 getUTCFullYear/getUTCMonth/getUTCDate + Date.UTC 求星期，
       而 parseYmd()（FIX-TZ-1）/ ymd() / buildTimeGrid() 一律为本地日历语义；东八区本地零点 = 前一日 16:00Z
       ⇒ UTC 日期恒早一天、UTC 星期 = 本地星期 − 1（模 7）：周一至周六两项恰好抵消，周日（本地 dow=0、
       UTC dow=6）起始日 = 选中日 − 7，整周回退一周。改为本地取值器 + 本地基准日，周序列口径不变。 */
    const selY = sel.getFullYear(), selM = sel.getMonth(), selD = sel.getDate();
    const dow = new Date(selY, selM, selD).getDay();
    const days: Date[] = [];
    for(let i = 0;i < 7;i++)days.push(new Date(selY, selM, selD - dow + i));
    top.appendChild(buildTimeGrid(days));
  }else if(calView === 'year'){
    const counts = buildYearCounts(y);
    const yearGrid = document.createElement('div');
    yearGrid.className = 'year-grid'; /* FIX-6: 列数由 CSS 媒体查询控制，窗口 resize 自动响应 */
    yearGrid.style.cssText = 'display:grid;gap:12px;padding:10px';
    for(let mm = 0;mm < 12;mm++){
      const miniCal = document.createElement('div');
      miniCal.style.cssText = 'border:1px solid var(--line-soft);border-radius:var(--radius);padding:8px;background:var(--bg-panel)';
      const mTitle = document.createElement('div');
      mTitle.style.cssText = 'font-size:.88em;font-weight:700;margin-bottom:6px;color:var(--title);cursor:pointer';
      mTitle.textContent = (mm + 1) + '月';
      mTitle.onclick = () => { deps.ui.calMonth = { y: y, m: mm };deps.ui.calView = 'month';deps.saveUI();deps.forceRender(); };
      miniCal.appendChild(mTitle);
      const miniGrid = document.createElement('div');
      miniGrid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center';
      ['日', '一', '二', '三', '四', '五', '六'].forEach(d => { const el = document.createElement('div');el.style.cssText = 'font-size:.68em;color:var(--fg-dim);padding:1px';el.textContent = d;miniGrid.appendChild(el); });
      const first = new Date(y, mm, 1);const startDow = first.getDay();
      const daysInMonth = new Date(y, mm + 1, 0).getDate();
      for(let i = 0;i < startDow;i++)miniGrid.appendChild(document.createElement('div'));
      for(let d = 1;d <= daysInMonth;d++){
        const cellDate = new Date(y, mm, d);const ds = ymd(cellDate);
        const el = document.createElement('div');
        el.style.cssText = 'font-size:.75em;padding:2px;cursor:pointer;border-radius:var(--radius-sm)';
        el.textContent = String(d);
        const hasNodes = counts.get(ds) || 0;
        if(hasNodes > 0){el.style.fontWeight = '700';el.style.color = 'var(--accent)';}
        if(ds === todayS){el.style.background = 'var(--accent)';el.style.color = '#fff';}
        if(ds === deps.ui.selectedDate && ds !== todayS)el.style.outline = '2px solid var(--accent)';
        el.onclick = () => { deps.ui.selectedDate = ds;deps.saveUI();deps.forceRender(); }; /* 年视图点击日期仅选中，不跳转月视图 */
        miniGrid.appendChild(el);
      }
      miniCal.appendChild(miniGrid);
      yearGrid.appendChild(miniCal);
    }
    top.appendChild(yearGrid);
  }
  const bottom = document.createElement('div');bottom.className = 'cal-bottom';
  /* 日历模块化（R36）：日历网格（top）与记事本 / 当日待办 / 系统日志 / 统计统一由 renderCalModules() 构建，
     全部同处 .cal-modules 容器并按 ui.calModules.order 排序（日历网格默认首位）；原 topRow + 分割线 +
     统计面板的直接构建已移除，模块内数据仍走各自既有渲染逻辑（renderNoteRow / renderCalNode /
     buildCalLogBlock / buildStatsBlock），口径不变。 */
  bottom.appendChild(renderCalModules(top));
  page.appendChild(bottom);
  return page;
}
/* 日历待办右键折叠菜单（R47）：时间 / 标签 / 优先级三块在浮层内部就地展开收起，不再派生二级弹窗。
   数据写入仍走原 commit / actions 通道（time+timeEnd / _manualTags+tags / priority），语义与旧菜单一致。 */
let _calCtxEl: any = null;
export function closeCalNodeMenu(): void {
  const m = _calCtxEl;if(!m)return;
  if(m._close)m._close();else m.remove();
}
/* ============================================================
   v2.1 fix1 · P1：右键菜单统一写库通道 applyCalCtxPatch
   ------------------------------------------------------------
   H3 根因（fix1 探针实测，90过程材料/tmp/fix1/cal_todo_ctx_after.log）：
     右键写库走 deps.commit + persistNow，字段确实落库并被 IDB 镜像（time=18:00 / priority=1 均可读回），
     但**没有推进日历数据代次**（JU.getCalDataRev() 7 → 7）。renderCalendarPage 的日缓存 getDayNodes 以
     「ds|标签筛选|focusId」为键、以 _calDataRev 为代次；commit 的结构化共享只换掉 state.nodes[id] 的对象引用，
     缓存里仍是写库前的**旧对象快照** ⇒ 紧随其后的 forceRender 把旧行原样画回来，用户视角就是
     「右键设了时间 / 标签 / 优先级，当日待办不显示」，而重开（重新装配、缓存重建）后才正常。
   修法（最小、不加第二套写库路径）：
     commit（产品现有 updateNode 等价物）→ persistNow → invalidateCalIndex()（= bump calRev：
     _calDataRev++ 并清 _calIndexCache / _calDayCache / _renderDayCache）→ deps.forceRender()
     （重绘当日待办 renderCalNode 与日历单元格 .cal-item / .cal-tg-ev）。
   patch 仍由调用方以 mutator 表达，保留原 dirtyDocs / dirtyText 提交语义；不触碰 JU.ui() 快照。
   ============================================================ */
function applyCalCtxPatch(id: any, mutator: (nn: any) => void, opts?: any): void {
  deps.commit((s: any) => {
    const nn = s.nodes[id];
    if(!nn)return;
    mutator(nn);
    nn.updatedAt = deps.nowSeq();
  }, Object.assign({ snapshot: true }, opts || {}));
  deps.saveUI();
  deps.persistNow();
  invalidateCalIndex(); /* bumpCalRev 等价：推进 _calDataRev 并清三层日缓存，避免旧对象快照回显 */
  deps.forceRender();   /* 重绘当日待办（renderCalNode）与日历单元格 */
}
export function openCalNodeMenu(nid: any, e: MouseEvent): void {
  closeCalNodeMenu();
  const cur = deps.N(nid);if(!cur)return;
  const menu = document.createElement('div');
  menu.className = 'cal-ctx';
  menu.setAttribute('role', 'menu');
  const sels: any[] = [];
  const cleanups: Array<() => void> = [];
  const close = () => {
    if(_calCtxEl !== menu)return;
    _calCtxEl = null;
    while(cleanups.length){try{cleanups.pop()!();}catch(_e){console.warn('[JU] caught error',_e);}}
    sels.forEach(x => { try{
      if(x && x._cleanups && x._cleanups.length){x._cleanups.forEach((f: () => void) => { try{f();}catch(_e){console.warn('[JU] caught error',_e);} });x._cleanups.length = 0;}
      else if(x && x._dispose){x._dispose();}
    }catch(_e){console.warn('[JU] caught error',_e);} });
    menu.remove();
  };
  (menu as any)._close = close;
  const place = () => {
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    menu.style.left = Math.max(4, Math.min(e.clientX, vw - mw - 4)) + 'px';
    menu.style.top = Math.max(4, Math.min(e.clientY, vh - mh - 4)) + 'px';
  };
  const sep = () => { const s = document.createElement('div');s.className = 'cal-ctx-sep';menu.appendChild(s); };
  /* 首列（16px 等宽）：折叠项放三角，普通项放图标，均为固定宽度 ⇒ 两类条目的文字起点对齐 */
  const lead = (glyph: string, cls?: string) => {
    const s = document.createElement('span');
    s.className = 'cal-ctx-lead' + (cls ? ' ' + cls : '');
    s.textContent = glyph;
    return s;
  };
  /* 普通项：与折叠项头部共用 .ctx-item 基础类，仅首列多一个图标占位 */
  const item = (ic: string, txt: string, fn: () => void, danger?: boolean) => {
    const d = document.createElement('div');
    d.className = 'ctx-item cal-ctx-item' + (danger ? ' danger' : '');
    d.setAttribute('role', 'menuitem');
    d.appendChild(lead(ic));
    const t = document.createElement('span');t.textContent = txt;d.appendChild(t);
    d.addEventListener('mousedown', ev => {
      if(ev.button !== 0)return;
      ev.preventDefault();ev.stopPropagation();
      fn();
    });
    menu.appendChild(d);
  };
  /* 折叠项：标题行点击就地展开 / 收起对应区域；首次展开时才构建内容（标签列表随索引异步补全）。
     头部与内容区包在 .cal-ctx-fold 内，浅底 + 圆角落在整块上，与普通项形成区隔。 */
  const fold = (txt: string, build: (body: HTMLElement) => void) => {
    const grp = document.createElement('div');
    grp.className = 'cal-ctx-fold';
    const head = document.createElement('div');
    head.className = 'ctx-item cal-ctx-item';
    head.setAttribute('role', 'menuitem');
    head.setAttribute('aria-expanded', 'false');
    const caret = lead('▶', 'cal-ctx-caret');
    const t = document.createElement('span');t.textContent = txt;
    head.appendChild(caret);head.appendChild(t);
    const body = document.createElement('div');
    body.className = 'cal-ctx-body';
    head.addEventListener('mousedown', ev => {
      if(ev.button !== 0)return;
      ev.preventDefault();ev.stopPropagation();
      const on = !body.classList.contains('on');
      body.classList.toggle('on', on);
      head.classList.toggle('expanded', on);
      head.setAttribute('aria-expanded', on ? 'true' : 'false');
      caret.textContent = on ? '▼' : '▶';
      if(on && !body.dataset.built){body.dataset.built = '1';build(body);}
      place();
    });
    grp.appendChild(head);
    grp.appendChild(body);
    menu.appendChild(grp);
  };
  const parseHm = (s: any) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));return m ? { h: +m[1], m: +m[2] } : null; };
  const hEntries: Array<[any, string]> = Array.from({ length: 24 }, (_, i) => [i, pad(i)] as [any, string]);
  const mEntries: Array<[any, string]> = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(v => [v, pad(v)] as [any, string]);
  const hEntriesNone: Array<[any, string]> = [['', '无'], ...hEntries];
  /* ① 设置时间：开始 / 结束小时分钟就地选择（mkCalSel 面板挂在本菜单内部，层级随之抬升） */
  const buildTime = (body: HTMLElement) => {
    const c0 = deps.N(nid) || {};
    const t0 = parseHm(c0.time), t1 = parseHm(c0.timeEnd);
    const mkRow = (label: string) => {
      const r = document.createElement('div');r.className = 'cal-ctx-row';
      const lb = document.createElement('span');lb.className = 'cal-ctx-label';lb.textContent = label;
      r.appendChild(lb);body.appendChild(r);return r;
    };
    const colon = () => { const c = document.createElement('span');c.style.color = 'var(--fg-dim)';c.textContent = ':';return c; };
    const r1 = mkRow('开始');
    const sH = mkCalSel(hEntriesNone, t0 ? t0.h : '', r1);r1.appendChild(sH);
    r1.appendChild(colon());
    const sM = mkCalSel(mEntries, t0 ? Math.min(Math.round(t0.m / 5) * 5, 55) : 0, r1);r1.appendChild(sM);
    const r2 = mkRow('结束');
    const eH = mkCalSel(hEntriesNone, t1 ? t1.h : '', r2);r2.appendChild(eH);
    r2.appendChild(colon());
    const eM = mkCalSel(mEntries, t1 ? Math.min(Math.round(t1.m / 5) * 5, 55) : 0, r2);r2.appendChild(eM);
    sels.push(sH, sM, eH, eM);
    const btns = document.createElement('div');btns.className = 'cal-ctx-row';
    const okBtn = document.createElement('button');okBtn.type = 'button';okBtn.className = 'cal-ctx-btn primary';okBtn.textContent = '保存';
    const clrBtn = document.createElement('button');clrBtn.type = 'button';clrBtn.className = 'cal-ctx-btn';clrBtn.textContent = '清除时间';
    btns.appendChild(okBtn);btns.appendChild(clrBtn);body.appendChild(btns);
    [okBtn, clrBtn].forEach(b => b.addEventListener('mousedown', ev => { ev.preventDefault();ev.stopPropagation(); }));
    okBtn.addEventListener('click', ev => {
      ev.preventDefault();ev.stopPropagation();
      const sHv = sH._val(), sMv = +sM._val(), eHv = eH._val(), eMv = +eM._val();
      let nt0: string | null = null, nt1: string | null = null;
      if(sHv !== ''){
        const sMin = +sHv * 60 + sMv;
        if(sMin >= 1440){toast('开始时间超出当日（分钟 60 时请选择前一个小时）');return;}
        nt0 = calMinToHm(sMin);
        if(eHv !== ''){
          const eMin = +eHv * 60 + eMv;
          if(eMin >= 1440 || eMin <= sMin){toast('结束时间需晚于开始时间且不超出当日');return;}
          nt1 = calMinToHm(eMin);
        }
      }
      /* v2.1 fix1 · H3：改走统一写库通道（commit → persistNow → bump calRev → 重绘当日待办 / 日历） */
      applyCalCtxPatch(nid, (nn: any) => { nn.time = nt0;nn.timeEnd = nt1; }, { dirtyDocs: getCalendarRootId() });
      close();
      toast(nt0 ? (nt1 ? ('时间 ' + nt0 + '-' + nt1) : ('时间 ' + nt0)) : '已清除时间');
    });
    clrBtn.addEventListener('click', ev => {
      ev.preventDefault();ev.stopPropagation();
      applyCalCtxPatch(nid, (nn: any) => { nn.time = null;nn.timeEnd = null; }, { dirtyDocs: getCalendarRootId() });
      close();toast('已清除时间');
    });
  };
  /* ② 选择标签：复用标签索引 _tagIndexCache 与 nodeHasTag 判定，行点击切换 _manualTags 并重算 tags */
  const buildTags = (body: HTMLElement) => {
    const list = document.createElement('div');list.className = 'cal-ctx-tags';
    const hint = document.createElement('div');hint.className = 'cal-ctx-hint';
    body.appendChild(hint);body.appendChild(list);
    const manOf = () => new Set<any>(((deps.N(nid) || {})._manualTags) || []);
    const _tic0 = deps.getTagIndexCache();
    let keys: string[] = (_tic0 ? Array.from(_tic0.keys()).sort() : []);
    /* v2.1 fix1 · 标签列表冷启动兜底（P1 派生修复）：
       日历自有标签计数缓存（_tagIndexCache）在本次会话可能为空 Map（或未就绪），原实现直接给**空列表**，
       右键「选择标签」实际不可用（fix1 探针实测 tags=[]，见 cal_todo_ctx_after.log）。两级兜底，仅在
       keys 仍为空时触发，不覆盖已就绪索引、不新建第二套索引：
         ① deps.calendarTagIndex()：日历页「标签筛选」下拉同源的真实标签计数（主流路）；
         ② 兜底扫描 state.nodes[].tags（有界：凑满 200 个即停），保证刚建的标签也能立刻出现。 */
    if(!keys.length){
      try{ deps.calendarTagIndex().forEach((_cnt, _k) => { if(!keys.includes(_k))keys.push(_k); }); }
      catch(_e){ console.warn('[JU] caught error', _e); }
    }
    /* 【fix5 · P1】合并全局标签索引 state._tags：新建标签只登记在注册表、不挂任何节点（count=0），
       若这里不合并，用户新建的标签在「选择标签」里根本不可勾选 ⇒ P1 的「只能显式勾选关联」
       就没有入口。空标签同样列出（勾选后即写入 _manualTags / tags）。 */
    try{
      const _reg = ((deps.state || {}) as any)._tags;
      if(Array.isArray(_reg))_reg.forEach((_t: any) => { const _s = String(_t || ''); if(_s && !keys.includes(_s))keys.push(_s); });
    }catch(_e){ console.warn('[JU] caught error', _e); }
    if(!keys.length){
      try{
        const _nodes = (deps.state && deps.state.nodes) || {};
        const _ids = Object.keys(_nodes);
        for(let _i = 0;_i < _ids.length && keys.length <= 200;_i++){
          const _tg = _nodes[_ids[_i]] && _nodes[_ids[_i]].tags;
          if(!_tg || !_tg.length)continue;
          for(let _j = 0;_j < _tg.length;_j++){ const _t = String(_tg[_j]);if(_t && !keys.includes(_t))keys.push(_t); }
        }
      }catch(_e){ console.warn('[JU] caught error', _e); }
    }
    manOf().forEach(t => { if(!keys.includes(t))keys.push(t); });
    keys.sort();
    const renderRows = () => {
      const nn = deps.N(nid) || {};
      const man = new Set<any>(nn._manualTags || []);
      list.textContent = '';
      /* 已有可选项就不再提示「正在整理」（v2.1 fix1：冷启动兜底拿到 keys 时提示会自相矛盾） */
      hint.textContent = keys.length ? '' : (deps.getTagIndexCache() ? '' : '（标签索引正在后台整理…');
      if(!keys.length){
        const w = document.createElement('div');w.className = 'cal-ctx-hint';
        w.textContent = '（暂无标签：在正文输入 #标签即可）';
        list.appendChild(w);
      }
      keys.forEach(t => {
        const on = man.has(t);
        const ro = !on && deps.nodeHasTag(nn, t);
        const it = document.createElement('div');
        it.className = 'cal-ctx-tag' + (on ? ' sel' : '') + (ro ? ' ro' : '');
        const dot = document.createElement('span');dot.className = 'sb-tag-dot';dot.style.setProperty('--tag-color', deps.getTagColor(t));
        const lb = document.createElement('span');lb.textContent = '#' + t;
        const chk = document.createElement('span');chk.className = 'cal-ctx-chk';chk.textContent = '✓';
        it.appendChild(dot);it.appendChild(lb);it.appendChild(chk);
        if(ro)it.title = '来自正文 #标签：删除正文中的该标签即可取消';
        it.addEventListener('mousedown', ev => {
          if(ev.button !== 0)return;
          ev.preventDefault();ev.stopPropagation();
          pickTag(t);
        });
        list.appendChild(it);
      });
    };
    const pickTag = (t: string) => {
      if(!t || !deps.N(nid))return;
      const want = !manOf().has(t);
      const owner = deps.findOwningTopDocId(nid, deps.state);
      applyCalCtxPatch(nid, (nn: any) => {
        const set = new Set<any>(nn._manualTags || []);
        if(want)set.add(t);else set.delete(t);
        nn._manualTags = [...set];
        nn.tags = [...new Set([...nn._manualTags, ...deps.extractTags(stripHtml(nn.text || ''))])];
      }, { dirtyText: true, dirtyDocs: owner || undefined });
      deps.actions.logActivity('mod', nid);
      deps.setTagIndexCache(null);
      renderRows();
      toast(want ? ('已标记 #' + t) : ('已取消 #' + t));
    };
    const clearAll = () => {
      if(!deps.N(nid))return;
      const owner = deps.findOwningTopDocId(nid, deps.state);
      applyCalCtxPatch(nid, (nn: any) => {
        nn._manualTags = [];
        nn.tags = [...new Set(deps.extractTags(stripHtml(nn.text || '')))];
      }, { dirtyText: true, dirtyDocs: owner || undefined });
      deps.actions.logActivity('mod', nid);
      deps.setTagIndexCache(null);
      renderRows();
      toast('已清除本节点标签');
    };
    renderRows();
    if(!deps.getTagIndexCache())deps.tagIndexWhenReady(function(){
      if(_calCtxEl !== menu || !deps.getTagIndexCache())return;
      let added = false;
      (deps.getTagIndexCache() as Map<string, number>).forEach(function(_v, k){ if(!keys.includes(k)){keys.push(k);added = true;} });
      if(added){keys.sort();renderRows();place();}
    });
    const clearRow = document.createElement('div');
    clearRow.className = 'ctx-item cal-ctx-item';
    const clearTxt = document.createElement('span');clearTxt.textContent = '清除全部标签';
    clearRow.appendChild(lead('✕'));clearRow.appendChild(clearTxt);
    clearRow.addEventListener('mousedown', ev => {
      if(ev.button !== 0)return;
      ev.preventDefault();ev.stopPropagation();
      clearAll();
    });
    body.appendChild(clearRow);
  };
  /* ③ 优先级：四象限就地切换，当前值高亮；v:0 为清除 */
  const buildPrio = (body: HTMLElement) => {
    const grid = document.createElement('div');grid.className = 'cal-ctx-prio';body.appendChild(grid);
    const opts = [{ v: 1, t: '重要紧急' }, { v: 2, t: '重要不紧急' }, { v: 3, t: '紧急不重要' }, { v: 4, t: '不紧急不重要' }];
    const render = () => {
      grid.textContent = '';
      const cp = ((deps.N(nid) || {}).priority) || 0;
      opts.forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cal-ctx-btn' + (cp === o.v ? ' on' : '');
        b.textContent = o.t;
        b.addEventListener('click', ev => {
          ev.preventDefault();ev.stopPropagation();
          applyCalCtxPatch(nid, (nn: any) => { nn.priority = o.v; });
          render();
          toast('优先级：' + o.t);
        });
        grid.appendChild(b);
      });
    };
    render();
    const clr = document.createElement('div');
    clr.className = 'ctx-item cal-ctx-item';
    const clrTxt = document.createElement('span');clrTxt.textContent = '清除优先级';
    clr.appendChild(lead('○'));clr.appendChild(clrTxt);
    clr.addEventListener('mousedown', ev => {
      if(ev.button !== 0)return;
      ev.preventDefault();ev.stopPropagation();
      applyCalCtxPatch(nid, (nn: any) => { nn.priority = 0; });
      render();
      toast('已清除优先级');
    });
    body.appendChild(clr);
  };
  fold('设置时间', buildTime);
  fold('选择标签', buildTags);
  fold('优先级', buildPrio);
  sep();
  item('📄', '复制到今日', () => {
    const calRootId = getCalendarRootId();
    const c = deps.N(nid);
    const id = deps.actions.addNode(calRootId, null, { text: stripHtml((c && c.text) || ''), date: todayStr(), showInCal: true, time: (c && c.time) || null });
    close();
    /* 【本轮修复 · 新建不显示】复制出的新待办同样必须失效日历索引，否则今日列沿用旧日缓存看不见它 */
    if(id)invalidateCalIndex();
    if(id){toast('已复制到今日');deps.forceRender();}
  });
  sep();
  item('🗑', '删除待办', () => {
    close();
    deps.actions.removeNode(nid);
    deps.forceRender();
    toast('已删除待办');
  }, true);
  menu.style.left = '-9999px';menu.style.top = '0px';
  document.body.appendChild(menu);
  place();
  _calCtxEl = menu;
  /* 点击外部 / ESC 关闭；窗口尺寸变化直接收起，避免浮层脱离锚点 */
  const onDocDown = (ev: MouseEvent) => { if(!menu.contains(ev.target as Node))close(); };
  const onDocKey = (ev: KeyboardEvent) => {
    if(ev.key !== 'Escape')return;
    ev.preventDefault();ev.stopPropagation();close();
  };
  const onResize = () => close();
  document.addEventListener('mousedown', onDocDown, true);
  document.addEventListener('keydown', onDocKey, true);
  window.addEventListener('resize', onResize);
  cleanups.push(() => {
    document.removeEventListener('mousedown', onDocDown, true);
    document.removeEventListener('keydown', onDocKey, true);
    window.removeEventListener('resize', onResize);
  });
}
/* ============================================================
   v2.1 fix1 · P2：四象限优先级徽章唯一渲染出口 priorityBadges(p)
   ------------------------------------------------------------
   历史问题：日历单元格（.cal-item / .cal-tg-ev）与当日待办（.cal-node）各自内联拼一套
   「重要紧急 / 重要不紧急 …」中文徽章，文案、配色、aria 三处口径互不一致，也无法被测试稳定断言。
   现统一为本函数，DOM 以 createElement 逐个构造（不拼 innerHTML，杜绝注入面），映射固定：
     重要不紧急   = 红色 !            → important
     紧急不重要   = ⚡                → urgent
     重要紧急     = 红色 ! + ⚡（顺序 !⚡） → important_urgent
     不重要不紧急 = OK                → none
   aria-label / title 一律取 PRIO_LABEL[p]；样式只走 CSS class（见 style.css .prio-badge / .prio-important /
   .prio-urgent / .prio-ok），禁止内联 style。
   ============================================================ */
export type Prio = 'important' | 'urgent' | 'important_urgent' | 'none';
export const PRIO_LABEL: Record<Prio, string> = {
  important: '重要不紧急',
  urgent: '紧急不重要',
  important_urgent: '重要紧急',
  none: '不重要不紧急',
};
/** 节点数值 priority → 四象限键；0 / 未知返回 null（不渲染徽章）。 */
export function prioKeyOf(priority: any): Prio | null {
  const p = Number(priority) || 0;
  if(p === 1)return 'important_urgent';
  if(p === 2)return 'important';
  if(p === 3)return 'urgent';
  if(p === 4)return 'none';
  return null;
}
/** 唯一优先级徽章渲染器：月视图单元格 / 周视图事件块 / 当日待办统一调用（禁止各处另写一套）。 */
export function priorityBadges(p: Prio): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'prio-badge';
  wrap.setAttribute('data-prio', p);
  wrap.setAttribute('aria-label', PRIO_LABEL[p]);
  wrap.title = PRIO_LABEL[p];
  const add = (cls: string, txt: string) => {
    const s = document.createElement('span');
    s.className = cls;s.textContent = txt;
    wrap.appendChild(s);
  };
  if(p === 'important')add('prio-important', '!');
  if(p === 'urgent')add('prio-urgent', '⚡');
  if(p === 'important_urgent'){add('prio-important', '!');add('prio-urgent', '⚡');}
  if(p === 'none')add('prio-ok', 'OK');
  return wrap;
}
export function renderCalNode(n: any): HTMLElement {
  const box = document.createElement('div');
  box.className = 'cal-node';
  box.dataset.id = n.id;
  /* 今日待办只显示事项、不显示时间：时间胶囊不再渲染；设时间走文字区右键「设置时间」弹窗 */
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'cal-checkbox';
  cb.checked = !!n.done;
  /* v2.1 fix2 · P1：标签信息只落到勾选框 —— 实心圆点＝首个标签色，title 列出全部标签，
     data-tagged="1" 作为「有标签」的 DOM 契约（CSS 用它区分实心/空心，fix2 spec 据此断言）。
     无标签：移除 data-tagged、清空 title、移除 --cb-color（回到空心圆，不吃上一帧的残余变量）。 */
  const _nodeTags: string[] = Array.isArray(n.tags) ? n.tags.filter(Boolean) : [];
  if(_nodeTags.length){
    cb.dataset.tagged = '1';
    cb.title = _nodeTags.map((t: string) => '#' + t).join(' ');
    cb.style.setProperty('--cb-color', deps.getTagColor(_nodeTags[0]));
  }else{
    delete cb.dataset.tagged;
    cb.title = '';
    cb.style.removeProperty('--cb-color');
  }
  box.appendChild(cb);
  /* 时间胶囊：与事件块同源（同一节点 time/timeEnd），事件块改时间后经 invalidateCalIndex 同步至此 */
  if(n.time){
    const t = document.createElement('span');
    t.className = 'cal-node-time';
    const _ts = fmtHm(n.time), _te = fmtHm(n.timeEnd);
    t.textContent = (_ts && _te && _te > _ts) ? _ts + '-' + _te : (_ts || '');
    t.title = '点击设置时间（与日历事件块同步）';
    t.onclick = e => { e.stopPropagation();openCalTimeModal(n.id); };
    box.appendChild(t);
  }
  /* v2.1 fix2 · P1：当日待办不再输出 .cal-node-tags / .cal-node-tag 文本节点（fix1 的可见化回退）。
     标签数据（_manualTags / tags）一字不动，仅从「行内文本」改由勾选框颜色 + title 承载，
     DOM 也随之少一层（style.css 侧另有 .cal-node .cal-node-tags{display:none!important} 兜底）。 */
  const text = document.createElement('div');
  text.className = 'text' + (n.done ? ' done' : '');
  text.contentEditable = 'true';
  text.spellcheck = false;
  text.dataset.id = n.id;
  text.dataset.ph = '输入待办…';
  text.innerHTML = deps.sanitizeHtml(n.text || ''); /* FIX-R3-3: 与 renderOutlineRow/renderNoteRow 一致，保留富文本（原 textContent 会拍平加粗/斜体/颜色） */
  syncEmptyState(text, '输入待办…');
  cb.addEventListener('pointerdown', () => {
    if(document.activeElement === text)(text as HTMLElement).blur();
  });
  cb.addEventListener('change', () => {
    const cur = deps.N(n.id);
    if(!cur)return;
    if(!!cur.done === cb.checked)return;
    deps.actions.toggleDone(n.id);
    /* v2.1 fix2 · P1：勾选＝日历数据的可见状态变化，必须同帧三件事（fix2 P0 探针实测的 H3：
       toggleDone 只 commit、不推进 _calDataRev，日缓存里还是写库前的旧对象 ⇒ 紧随其后的重绘
       把旧行画回来，state.done=true 而勾选框仍是未选中，用户视角「点了没反应」）：
       ① saveUI 持久化界面态 ② invalidateCalIndex（bump calRev + 清 _calDayCache/_renderDayCache）
       ③ forceRender 用新代次重画当日待办。重开后完成态由 state 落库保证。 */
    deps.saveUI();
    invalidateCalIndex();
    deps.forceRender();
  });
  let composing = false;
  text.addEventListener('compositionstart', () => composing = true);
  text.addEventListener('compositionend', () => { composing = false;syncEmptyState(text, '输入待办…'); });
  text.addEventListener('input', e => {
    if(composing || (e as InputEvent).isComposing)return;
    syncEmptyState(text, '输入待办…');
  });
  text.addEventListener('focus', () => { resetSavedFocus();deps.ui.focusId = n.id; });
  /* Wiki 链接跳转：Ctrl / Cmd + 点击 [[链接]] */
  text.addEventListener('click', e => {
    if(!(e.ctrlKey || e.metaKey))return;
    const lt = linkTitleAtPoint(text, e);
    if(!lt)return;
    e.preventDefault();e.stopPropagation();
    navigateToWikiLink(lt, text);
  });
  /* 【粘贴修复 P0】日历待办：多行拆分（语义同大纲，兄弟节点同属当前 parent）
     集成适配：额外传入 date/showInCal 继承项——日历按日期索引待办，不继承则新兄弟节点不可见。 */
  text.addEventListener('paste', e => {
    try{
      const dt = e.clipboardData || (window as any).clipboardData;
      if(!dt)return;
      e.preventDefault();
      const parsed = deps.parsePasteLines(dt);
      const plainSrc = parsed.plain ? String(parsed.plain).replace(/\r\n?/g, '\n').split('\n') : [];
      const plainLines = parsed.lines.length ? parsed.lines : plainSrc;
      const plainTree = plainSrc.filter(l => l.trim()).length > 1 ? parseIndentedOutline(plainSrc.join('\n')) : null;
      /* parsed.tree 深度不低于 plain 缩进树才采用，避免扁平 HTML 覆盖 plain 层级；最后才回退行数组。 */
      const tree = (parsed.tree && parsed.tree.length && pasteTreeDepth(parsed.tree) >= pasteTreeDepth(plainTree)) ? parsed.tree : (plainTree || null);
      const extra = { date: n.date || deps.ui.selectedDate || todayStr(), showInCal: true };
      if(tree && tree.length > 1){
        if(deps.splitPastedLinesToNodes(text, n.id, plainLines, extra, tree)) return;
      }else if(parsed.lines.length > 1){
        if(deps.splitPastedLinesToNodes(text, n.id, plainLines, extra)) return;
      }
      if(parsed.html){
        const clean = deps.sanitizeHtml(deps.trimPasteHtml(parsed.html));
        if(clean){ deps.safeExec('insertHTML', clean);syncEmptyState(text, '输入待办…');return; }
      }
      if(plainLines.length > 1){
        deps.safeExec('insertHTML', plainLines.map(function(l){ return esc(l); }).join('<br>'));
      }else if(plainLines.length === 1){
        deps.safeExec('insertText', plainLines[0]);
      }
      syncEmptyState(text, '输入待办…');
    }catch(err){console.warn('[JU] caught error',err);}
  });
  text.addEventListener('blur', () => {
    const liveText = text.textContent;
    if(isBlurSuppressed())return;
    if(!text.isConnected)return;
    /* FIX-M-18: 与 renderNoteRow blur 对齐——用 finalHtml 并走 actions.updateText，使正文中的 #tag 并入 n.tags */
    const finalHtml = deps.sanitizeHtml(text.innerHTML);
    const cur = deps.N(n.id);
    if(!cur)return;
    /* 批次 3 · P2-5：仅当文本真的变化时才解析自然语言日期。
       原实现每次失焦都 parseNaturalDate(text.textContent) 并可能改写 date/time，
       导致「只点一下输入框再点空白处」也会把待办跳到其他日期。 */
    const textChanged = finalHtml !== (cur.text || '');
    /* FIX-M-18: 文本（含 #tag）统一走 actions.updateText 做 tags 并集，不再直接写 nn.text */
    if(textChanged)deps.actions.updateText(n.id, finalHtml, { noHistory: true }); /* FIX-P1-3: 日历卡片 blur 提交不单独拍撤销步 */
    const parsed = textChanged ? parseNaturalDate(liveText || '') : null;
    let newDate = cur.date, newTime = cur.time, newRecur = cur.recur;
    if(parsed){
      if(parsed.date)  newDate  = parsed.date;
      if(parsed.time)  newTime  = parsed.time;
      if(parsed.recur) newRecur = parsed.recur;
    }
    const recurChanged = JSON.stringify(newRecur) !== JSON.stringify(cur.recur);
    const dateChanged = newDate !== cur.date || newTime !== cur.time || recurChanged;
    if(dateChanged){
      deps.commit((s: any) => {
        const nn = s.nodes[n.id];
        if(!nn)return;
        nn.date = newDate;
        nn.time = newTime;
        nn.recur = newRecur;
        nn.updatedAt = deps.nowSeq();
      }, { snapshot: true, dirtyDocs: getCalendarRootId() });
      /* 【本轮修复 · 日历状态同步】改期 / 改时间 / 改重复都改变了日历索引口径：
         必须失效日缓存并重渲染，否则该待办仍留在旧日期的列表里（新旧两天同时可见）。
         blur 已发生，此处重渲染不会打断任何选区。 */
      invalidateCalIndex();
      deps.forceRender();
      if(parsed && parsed.date)toast('日期：' + parsed.date + (parsed.time ? ' ' + parsed.time : ''));
      else if(parsed && parsed.recur)toast('重复已设置');
    }
  });
  text.addEventListener('contextmenu', e => {
    /* FIX-mobile-2: 触屏长按放行系统复制/粘贴菜单；鼠标右键保留日历待办自建菜单（R47：折叠浮层，不派生二级弹窗） */
    if(deps.lastPointerType() === 'touch')return;
    e.preventDefault();
    const cur = deps.N(n.id);
    if(!cur)return;
    openCalNodeMenu(n.id, e);
  });
  text.addEventListener('keydown', e => {
    /* FIX-IME: 中文输入法组字中按 Enter/Tab 选词不得触发新建/删除/缩进（bindOutlineText/bindNoteText 已有全局守卫，此处补齐） */
    if(e.isComposing || e.keyCode === 229)return;
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey){e.preventDefault();if(deps.undo()){deps.forceRender();toast('已撤销');}return;}
    if((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))){e.preventDefault();if(deps.redo()){deps.forceRender();toast('已重做');}return;}
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      const cur = deps.N(n.id);
      const calRootId = getCalendarRootId();
      const finalText = text.textContent;
      if(cur && finalText !== stripHtml(cur.text || ''))deps.actions.updateText(n.id, finalText);
      const p = cur ? deps.N(cur.parent) : null;
      const idx = p ? p.children.indexOf(n.id) : -1;
      const newId = (p && idx >= 0)
        ? deps.actions.addNode(p.id, idx + 1, { date: deps.ui.selectedDate || todayStr(), showInCal: true, text: '' })
        : deps.actions.addNode(calRootId, null, { date: deps.ui.selectedDate || todayStr(), showInCal: true, text: '' });
      const c = document.getElementById('content');
      const st = c ? c.scrollTop : 0;
      /* 【本轮修复 · 新建不显示】回车新建的兄弟待办 → 先失效日历索引 / 日缓存，再渲染 */
      invalidateCalIndex();
      deps.ui.focusId = newId;
      deps.forceRender();
      if(c)c.scrollTop = st;
      focusAfterRender(newId, '.cal-page');
      requestAnimationFrame(() => { if(c)c.scrollTop = st; });
      return;
    }
    const curN = deps.N(n.id);
    /* 空判定（本次修复：桌面版 WebView2 口径）
       原实现用 `textContent.trim()==='' && stripHtml(innerHTML).trim()===''` 双重与判定：
       stripHtml 只剥标签、**不解实体**，而 WebView2 在删空正文 / 输入法上屏后常残留
       `&nbsp;`（innerHTML 字面量 `&nbsp;`）或零宽占位（U+200B / U+FEFF）；
       此时 textContent.trim() 已为空，但 stripHtml(innerHTML).trim() 仍是 `&nbsp;`
       ⇒ 与判定失败 ⇒ 退格落到浏览器默认（空行无动作）⇒「待办按退格删不掉」。
       现改为「可见字符」口径：剥标签 → 解常见空白实体 → 去所有空白与零宽字符，
       两种来源（innerHTML / textContent）任一判定为空即视为空（|| 而非 &&）。 */
    const _visText = (s: any): string => String(s || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;?|&#160;|&#x0*a0;|&#8203;|&#x200b;|&zwnj;|&zwj;/gi, '')
      .replace(/[\s\u00a0\u1680\u2000-\u200d\u2028\u2029\u202f\u205f\u3000\ufeff]/g, '');
    const _nowEmpty = _visText(text.innerHTML) === '' || _visText(text.textContent) === '';
    if(e.key === 'Backspace' && _nowEmpty && curN){
      e.preventDefault();
      if((curN.children || []).length > 0){toast('该节点有子项，请先移走或折叠');return;}
      const list = calendarTodosOnDate(deps.ui.selectedDate).filter((x: any) => !deps.isBlankNode(x) || x.id === n.id);
      const i = list.findIndex((x: any) => x.id === n.id);
      let nextId = i >= 0 && i < list.length - 1 ? list[i + 1].id : (i > 0 ? list[i - 1].id : null);
      if(!nextId && curN.parent){
        const sib = (deps.N(curN.parent)?.children) || [];
        const si = sib.indexOf(n.id);
        if(si > 0)nextId = sib[si - 1];
        else if(si >= 0 && si < sib.length - 1)nextId = sib[si + 1];
      }
      /* 【本轮修复 · 待办删不掉】removeNode 只删 state 节点，日历索引与日缓存里仍留着该节点的
         （旧对象）引用 ⇒ 紧接着的 forceRender 会把这一行原样画回来，用户视角就是「删不掉」。
         三步必须同帧完成：① 清焦点（否则空节点仍在 focusId 白名单里被渲染）
         ② 失效日历索引 / 日缓存（含 _renderDayCache）③ 再 forceRender。 */
      deps.ui.focusId = null;
      deps.actions.removeNode(n.id);
      invalidateCalIndex();
      deps.forceRender();
      if(nextId)requestAnimationFrame(() => focusAfterRender(nextId, '.cal-page'));
      return;
    }
    if(!(e.ctrlKey || e.metaKey))e.stopPropagation();
  });
  /* v2.1 fix1 · P2：当日待办优先级徽章统一走 priorityBadges
     （与月视图单元格 / 周视图事件块同一 DOM 契约：data-prio + aria-label + 图标组合，测试可稳定断言） */
  const _rowPk = prioKeyOf(n.priority);
  if(_rowPk)box.appendChild(priorityBadges(_rowPk));
  box.appendChild(text);
  return box;
}
