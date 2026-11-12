/**
 * M1-1 · 批次 AE · 核心数据操作（Actions）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - _lastNowSeq / _nowSeq ................................. 5536-5544
 *   - addNodeTo ............................................ 5545-5563
 *   - extractTags（TAG_RE 消费，源「常量 / 工具」区）......... 5602-5611
 *   - actions 对象（addNode … logActivity）.................. 5612-5954
 *
 * 约束：节点字段清单、commit 选项对象、时间戳单调语义、墓碑写入、搜索缓存按粒度失效、
 *       activity 防抖阈值（1500ms / LOG_TIMER_MAX=500 / 上限 5000 条 / 保留 90 天）逐字保留。
 *   两类纯结构调整（运行期零行为差异）：
 *     1) 未拆分业务符号统一走 `deps` 依赖注入容器（原直接调用改为 `deps.xxx`）：
 *        commit / state / ui / N / persistNow / renderSidebar / forceRender / docSubtree /
 *        findOwningTopDocId / isBlankNode / purgeNodeMeta / _tombstoneSet（端口名 tombstoneSet）/
 *        _searchHayCache（端口名 searchHayCache）/ saveUI / scheduleNotify / schedulePersist。
 *     2) `_nowSeq` 由本模块承接（模块内唯一实现，含其水位 `_lastNowSeq`），故模块内调用保持
 *        `_nowSeq()`；其他模块经各自 `deps.nowSeq` 注入同一引用（等价于原同作用域单例）。
 *        产品件 initStore 的 `_lastNowSeq=0` 复位线由 `_resetNowSeq()` 承接（见 core/store.ts 接线说明）。
 *   已拆分模块直接 import：TAG_RE（core/constants）；uid / stripHtml / todayStr（core/utils）。
 */
import { TAG_RE, DEFAULT_DB_FIELDS, DEFAULT_DB_ROW_COUNT } from './constants';
import { uid, stripHtml, todayStr } from './utils';

/**
 * 业务动作集合（与产品件 `actions` 同名同签）。
 * 说明：产品件以对象字面量声明并自引用（`actions.logActivity`），此处显式声明接口以固定类型，
 *       避免 `const actions` 自引用推断失败；方法体与顺序与源文件逐行一致。
 */
/* 批次 DE · 未使用导出复核：`ActionsApi` / `ActionsDeps` 仅在本文件内部使用，降级为模块内私有 */
interface ActionsApi {
  addNode(parentId: any, index?: any, init?: any): any;
  updateText(id: any, text: any, opts?: { snapshot?: boolean; noHistory?: boolean; noNotify?: boolean }): void;
  toggleDone(id: any): void;
  toggleCollapse(id: any): void;
  moveNode(id: any, toParentId: any, toIndex: any): void;
  removeNode(id: any): void;
  createDoc(name: any, opts?: any): any;
  setCurrentDoc(id: any): void;
  setNodeDate(id: any, date: any): void;
  clearNodeSchedule(id: any, opts?: { date?: boolean; time?: boolean; recur?: boolean }): void;
  setStar(id: any, level: any): void;
  addDbField(docId: any, field: any): void;
  removeDbField(docId: any, name: any): void;
  renameDbField(docId: any, oldName: any, newName: any): void;
  setDbCell(rowId: any, fieldName: any, value: any): void;
  addDbRow(docId: any, init?: any): any;
  /** v2.1 fix9 · P1：新建表格套用内置默认模板（10 列表头 + 3 行空白），返回新建行 id 列表 */
  applyDbTemplate(docId: any, fields?: any[], rowCount?: number): any[];
  setDbColumnWidth(docId: any, name: any, w: any): void;
  setDbRowHeight(rowId: any, h: any): void;
  importTree(parentId: any, tree: any[]): void;
  addTemplate(name: any, tree: any): void;
  removeTemplate(id: any): void;
  moveToTrash(id: any): void;
  restoreFromTrash(idx: number): void;
  purgeTrash(idx: number): void;
  logActivity(type: string, id?: any, detail?: any, diff?: any): void;
}

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
interface ActionsDeps {
  /** 不可变提交（对应产品的 `commit(fn,opts)`） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** 全局数据状态（对应产品的 `state`） */
  state: any;
  /** 全局 UI 状态对象（对应产品的 `ui`，含 collapsedDocs / dbHiddenFields / currentDocId） */
  ui: any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** 立即落盘并广播（对应产品的 `persistNow()`，F-01 / FIX-BUG02 即时落盘） */
  persistNow: () => void;
  /** 侧栏重绘（对应产品的 `renderSidebar()`） */
  renderSidebar: () => void;
  /** 请求下一次渲染（对应产品的 `forceRender()`） */
  forceRender: () => void;
  /** 子树 id 收集（对应产品的 `docSubtree(id)`） */
  docSubtree: (id: any) => any[];
  /** 所属顶层文档判定（对应产品的 `findOwningTopDocId(id,state)`） */
  findOwningTopDocId: (id: any, s: any) => any;
  /** 空节点判定（对应产品的 `isBlankNode(n)`） */
  isBlankNode: (n: any) => boolean;
  /** 节点元信息清理（对应产品的 `purgeNodeMeta(s,id)`） */
  purgeNodeMeta: (s: any, id: any) => void;
  /** 墓碑写入（对应产品的 `_tombstoneSet(id,s)`，FIX-P0-4） */
  tombstoneSet: (id: any, s: any) => void;
  /** 内存态墓碑摘除（对应产品的 `_recentlyRemoved.delete(x)`，FIX-S-2c 恢复时清墓碑） */
  recentlyRemovedDelete: (id: any) => void;
  /** 搜索 haystack LRU 缓存（对应产品的 `_searchHayCache`，仅用 delete） */
  searchHayCache: { delete: (id: any) => any };
  /** UI 状态持久化（对应产品的 `saveUI()`） */
  saveUI: () => void;
  /** 渲染通知调度（对应产品的 `scheduleNotify()`） */
  scheduleNotify: () => void;
  /** 持久化调度（对应产品的 `schedulePersist()`） */
  schedulePersist: () => void;
  /**
   * 日历索引失效（对应产品的 `invalidateCalIndex()`；批次 CA 接线）。
   * 创建待办 / 改期 / 清空日程 / 批量导入后必须调用，否则日历日缓存（_calDayCache /
   * _renderDayCache）保留旧结果，UI 不刷新。装配层注入 `views/calendar` 的真实实现。
   */
  invalidateCalIndex: () => void;
  /**
   * 标签索引失效（对应产品的 `_tagIndexCache=null`；v2.1 fix5 · P2 接线，可选）。
   * 节点标签集合因**正文变化**而改变（updateText 的 tagsChanged，含新建文档正文带 #tag、
   * 批量导入）后必须调用；否则 `buildTagIndex()` 命中旧 Map，侧栏「标签」列表与排序结果、
   * `#cntTags` 计数都停在旧快照。装配层注入 `app/session.invalidateTagIndex`。
   */
  invalidateTagIndex?: () => void;
  /** 轻提示（对应产品的 `toast(msg)`；Track B 免费版节点限额提示使用） */
  toast: (msg: any) => void;
  /**
   * fix7 · 字数统计（token 增量）——正文编辑回调。
   *
   * 语义：把「本次编辑前后的正文 HTML」交给 core/charstats 做 token 级差分
   * （I 插入 / D 删除 → A/R/M/N），由引擎按 500ms 批次累加进 `state.charStats[今日]`。
   * 未注入时（单测 / 早期装配）为 no-op，不影响 updateText 的既有行为。
   */
  charStatsEdit?: (id: any, oldHtml: string, newHtml: string) => void;
  /** fix7 · 字数统计——新增节点（整段文本 token 计入「新增 A」） */
  charStatsNodeAdd?: (id: any, text: string) => void;
  /** fix7 · 字数统计——删除节点（整段文本 token 计入「删除 R」） */
  charStatsNodeRemove?: (id: any, text: string) => void;
}

/** 依赖注入容器（模块内安全占位：加载即不抛 ReferenceError）。 */
export const deps: ActionsDeps = {
  commit: () => undefined,
  state: { nodes: {}, rootId: null },
  ui: {},
  N: () => null,
  persistNow: () => undefined,
  renderSidebar: () => undefined,
  forceRender: () => undefined,
  docSubtree: () => [],
  findOwningTopDocId: () => null,
  isBlankNode: () => false,
  purgeNodeMeta: () => undefined,
  tombstoneSet: () => undefined,
  recentlyRemovedDelete: () => undefined,
  searchHayCache: { delete: () => false },
  saveUI: () => undefined,
  scheduleNotify: () => undefined,
  schedulePersist: () => undefined,
  invalidateCalIndex: () => undefined,
  toast: () => undefined,
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function injectActionsDeps(next: Partial<ActionsDeps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   基础工厂：单调时间戳 / 节点构造
   ============================================================ */
let _lastNowSeq = 0;
export function _nowSeq(): number {
  /* 【修复 2026-09-27】新建节点时间戳从微秒改回毫秒（保持单调），
     消除与编辑路径(ms) 单位混用导致的 LWW 合并覆盖（多标签并发数据丢失根因） */
  const t = Date.now();
  const r = t > _lastNowSeq ? t : (_lastNowSeq + 1);
  _lastNowSeq = r;
  return r;
}
/* 对应产品件 initStore 内的 `_lastNowSeq=0`（FIX-num-1 恢复状态后复位水位）。 */
export function resetNowSeq(): void { _lastNowSeq = 0; }

/* 侧栏结构版本自增 —— 即 FIX-M-12 指纹 memo 的失效源。
   历史实现只在 store 初始化时写 `_structRev=0`，全库无任何自增点，于是
   `sidebarFingerprint()` 恒定不变、`renderSidebar()` 跳过后四棵子树的重建，
   表现为「新建文档成功后侧栏不出现新条目 / 删除与移动后列表不动」。
   凡影响侧栏行内容的写操作，都在同一 commit 草稿上调用本函数。 */
export function bumpStructRev(st: any): void { st._structRev = ((st._structRev | 0) + 1); }

export function addNodeTo(st: any, parentId: any, index: any, init: any = {}): any {
  const p = st.nodes[parentId];
  if (!p) return null;
  const _t = _nowSeq();
  const n = {
    id: uid(), text: '', parent: parentId, children: [], collapsed: false, done: false,
    date: null, tags: [], priority: 0, recur: null, recurEnd: null, habit: null, time: null, note: null, color: null,
    showInCal: true, createdAt: _t, updatedAt: _t, _origin: 'local', ...init,
  };
  st.nodes[n.id] = n;
  /* FIX-ORIGIN-1: 新建节点同时登记进 _localCreated（持久化标记），
     _origin 持久化被剥离后仍可识别「本页新建、对端可能尚未收悉」的节点，防删除传播误删。
     FIX-ORIGIN-2: 不做硬上限——批量导入单次 commit 可创建上千节点，截断会使后部节点失去保护 */
  try {
    if (!st._localCreated) st._localCreated = [];
    if (!st._localCreated.includes(n.id)) st._localCreated.push(n.id);
  } catch(e){console.warn('[JU] caught error',e);}
  if (index == null || index < 0 || index > p.children.length) p.children.push(n.id);
  else p.children.splice(index, 0, n.id);
  bumpStructRev(st);
  return n;
}

/* 从纯文本中提取 #标签（对应产品件 5602-5611，消费 core/constants 的 TAG_RE） */
export function extractTags(text: string): string[] {
  const out: string[] = []; const seen: any = {};
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text))) {
    const t = m[1].slice(1);
    if (t && !seen[t]) { seen[t] = 1; out.push(t); }
  }
  return out;
}

/* activity 日志防抖登记表与上限（源 5375-5376，属 actions.logActivity 私有状态） */
const _logTimers = new Map<string, { timer: any; commit: () => void; diff: number }>();
const LOG_TIMER_MAX = 500; /* L17-W4 · P1-4：activity 日志防抖计时器表上限，超限淘汰最早登记项并立即落盘 */
/* 【review7-01 · ISSUE-001】防抖表对外只读句柄与关页前强制落盘（源 5375-5387） */
export function getLogTimers(): Map<string, any> { return _logTimers; }
export function flushPendingLogs(): void {
  const keys = Array.from(_logTimers.keys());
  keys.forEach((key) => {
    const entry: any = _logTimers.get(key);
    clearTimeout(entry.timer);
    _logTimers.delete(key);
    try { entry.commit(); } catch (e) { console.warn('[JU] caught error', e); }
  });
}

/* ============================================================
   Actions（核心数据操作）
   ============================================================ */
/** Track B · 免费版节点上限（Pro 版无限制） */
export const FREE_NODE_LIMIT = 500;

export const actions: ActionsApi = {
  addNode(parentId: any, index?: any, init: any = {}): any {
    /* Track B · 商业闭环：免费版最多 500 个节点（含根 / 系统容器），超限直接拦截并提示激活 Pro。 */
    if (!deps.ui.isPro && Object.keys((deps.state && deps.state.nodes) || {}).length >= FREE_NODE_LIMIT) {
      deps.toast('免费版最多支持 500 个节点，请前往设置激活 Pro 版');
      return null;
    }
    let id: any = null;
    const owner = parentId ? deps.findOwningTopDocId(parentId, deps.state) : null;
    deps.commit((s: any) => {
      const n = addNodeTo(s, parentId, index, init);
      if (n) id = n.id;
    }, { snapshot: true, dirtyText: true, dirtyDocs: owner || undefined });
    /* 批次 CA：本工程尚未接入 L6 增量索引补丁（updateIncrementalIndexes），commit 本身不维护
       日历索引；新增待办（init 可携带 date/time）后必须显式失效，否则「当日待办」模块
       命中旧 _calDayCache / _renderDayCache 不刷新。 */
    if (!id) return null;
    deps.invalidateCalIndex();
    /* 【fix5 · P2】新节点正文可携带 #tag（addNode/模板/导入共用入口）⇒ 标签索引缓存失效，
       下次渲染重扫即得最新标签集合，避免侧栏「标签」列表与排序停在旧 Map。 */
    try { if (typeof deps.invalidateTagIndex === 'function') deps.invalidateTagIndex(); }
    catch (e) { console.warn('[JU] invalidateTagIndex failed', e); }
    actions.logActivity('add', id);
    deps.persistNow(); /* 【修复 F-01】新节点立即落盘并广播，使对端快照尽早包含它，消除 300ms 防抖窗口内的误删竞态 */
    return id;
  },
  /**
   * 更新节点正文。
   *
   * `noNotify`（本次新增，默认 false）：静默提交 —— state / 撤销栈 / 落盘照常，
   * 但不广播 notify、不调度渲染。供富文本格式命令（execCommand 已改完 DOM）同步 state 用：
   * 若此处触发 notify，`app/boot` 的 subscribe 会 scheduleRender → renderMain 重建 #content，
   * 编辑区节点被替换、选区丢失，连续格式操作第二下失效。
   */
  updateText(id: any, text: any, { snapshot = true, noHistory = false, noNotify = false }: { snapshot?: boolean; noHistory?: boolean; noNotify?: boolean } = {}): void {
    const cur = deps.state.nodes[id];
    if (!cur) return;
    /* FIX-GHOST-TAG newTags = 手动标签(_manualTags) ∪ 正文当前 #标签：
       不再与 cur.tags 做并集——否则正文删 #tag 后旧 tags 残留成幽灵标签，侧栏 #cntTags / 标签视图计数错误。
       手动指派路径（promptNewTag 等）均写入 n._manualTags，故手动附加标签不受影响。 */
    const newTags = [...new Set([...(cur._manualTags || []), ...extractTags(stripHtml(text || ''))])];
    const tagsChanged = JSON.stringify(cur.tags || []) !== JSON.stringify(newTags);
    if ((cur.text || '') === (text || '') && !tagsChanged) return;
    const owner = deps.findOwningTopDocId(id, deps.state);
    const _oldHtml = String(cur.text || '');
    const _newHtml = String(text || '');
    deps.commit((s: any) => { const n = s.nodes[id]; if (!n) return; n.text = text; n.tags = newTags; n.updatedAt = _nowSeq(); bumpStructRev(s); },
      { snapshot, noHistory, noNotify, dirtyText: true, dirtyDocs: owner || undefined, op: 'updateText', opArgs: { id } });
    /* fix7 · 字数统计口径改造：不再传「字符长度差」给 logActivity（旧口径把新输入算成“修改”、
       删字变负数，面板净变化还会把修改重复计一次）。改由 core/charstats 做 token 级差分：
       I=插入 token、D=删除 token → M=min(I,D)、A=I-M、R=D-M、N=I-D。 */
    actions.logActivity('mod', id, null, null);
    if (typeof deps.charStatsEdit === 'function') {
      try { deps.charStatsEdit(id, _oldHtml, _newHtml); }
      catch (e) { console.warn('[JU] charStatsEdit failed', e); }
    }
    /* 标签集合变化只需刷新侧栏（不触碰 #content）；静默提交时连侧栏重绘也推迟到下一次 notify，
       由 blur / input 通道收敛，绝不在格式命令执行中重建编辑区。 */
    if (tagsChanged) {
      /* 【fix5 · P2】标签集合变化 ⇒ 标签索引缓存失效，禁止 renderSubTags 命中旧 Map
         （否则正文新增/删除 #tag 后侧栏标签列表与排序结果、#cntTags 计数都不刷新）。 */
      try { if (typeof deps.invalidateTagIndex === 'function') deps.invalidateTagIndex(); }
      catch (e) { console.warn('[JU] invalidateTagIndex failed', e); }
      deps.renderSidebar(); if (!noNotify) deps.forceRender();
    }
  },
  toggleDone(id: any): void {
    const owner = deps.findOwningTopDocId(id, deps.state);
    deps.commit((s: any) => { const n = s.nodes[id]; if (!n) return; n.done = !n.done; n.updatedAt = _nowSeq(); },
      { snapshot: true, dirtyText: true, dirtyDocs: owner || undefined });
    /* L22 · 清理 11：同 addNode —— commit 增量补丁已维护索引（done 变更经 changedIds 投影），不再全量失效。 */
    actions.logActivity('mod', id);
  },
  toggleCollapse(id: any): void { const n = (deps as any).N ? (deps as any).N(id) : null; if (n) { n.collapsed = !n.collapsed; n.updatedAt = _nowSeq(); } },
  moveNode(id: any, toParentId: any, toIndex: any): void {
    if (toParentId === id) return;
    if (!deps.state.nodes[id] || !deps.state.nodes[toParentId]) return;
    if (deps.state.nodes[id]._isCalRoot || deps.state.nodes[id]._isDbRoot) return; /* 【修复】系统容器不可移动 */
    if (deps.state.nodes[toParentId]._isCalRoot || deps.state.nodes[toParentId]._isDbRoot) return; /* 【修复】不可移动到系统容器下 */
    /* 【修复 F-06】不可移入回收站中的节点：其子树将因父不可达而成为孤儿 */
    {
      const trashedIds = new Set<any>();
      (deps.state.trashed || []).forEach((t: any) => { if (t && t.rootId) { trashedIds.add(t.rootId); (t.ids || []).forEach((i: any) => trashedIds.add(i)); } });
      if (trashedIds.has(toParentId)) return;
    }
    let cur = toParentId;
    const _vis = new Set<any>(); /* FIX-P1-8: 父链检测加 visited 兜底——toParentId 父链本身有环（数据损坏）时原 while 死循环 */
    while (cur) { if (cur === id) return; if (_vis.has(cur)) return; _vis.add(cur); const cn = deps.state.nodes[cur]; cur = cn ? cn.parent : null; }
    deps.commit((s: any) => {
      const n = s.nodes[id]; if (!n) return;
      const to = s.nodes[toParentId];
      if (!to) return;
      const from = s.nodes[n.parent];
      const fromIdx = from ? from.children.indexOf(id) : -1;
      if (from && fromIdx >= 0) from.children.splice(fromIdx, 1);
      let insertIdx = toIndex;
      if (from === to && fromIdx >= 0 && fromIdx < toIndex) insertIdx--;
      to.children.splice(Math.max(0, Math.min(insertIdx, to.children.length)), 0, id);
      n.parent = toParentId; n.updatedAt = _nowSeq();
      bumpStructRev(s);
    }, { snapshot: true });
  },
  removeNode(id: any): void {
    const n = deps.N(id);
    if (!n || id === deps.state.rootId || n._isCalRoot || n._isDbRoot) return; /* 【修复】系统容器不可删除；FIX-DEF-A-1 根节点（state.rootId）同样不可删除 */
    const oldText = n ? stripHtml(n.text) : '';
    const parent = n ? n.parent : null;
    const owner = parent ? deps.findOwningTopDocId(parent, deps.state) : null;
    deps.commit((s: any) => {
      const nn = s.nodes[id]; if (!nn) return;
      const p = s.nodes[nn.parent];
      if (p) { const i = p.children.indexOf(id); if (i >= 0) p.children.splice(i, 1); }
      const rm = (x: any) => {
        const node = s.nodes[x]; if (!node) return;
        (node.children || []).forEach(rm);
        delete s.nodes[x];
        deps.purgeNodeMeta(s, x);
        delete deps.ui.collapsedDocs[x];
        deps.searchHayCache.delete(x);
        /* FIX-H-01: 本地硬删除递归写 _recentlyRemoved 墓碑（复用 removeNodeFromMap 的墓碑逻辑与 2000 上限清理），
           使重建守卫 L302 生效，防旧远端快照在 30s 窗口内复活本地刚删的节点 */
        deps.tombstoneSet(x, s); /* FIX-P0-4: 统一墓碑写入（计数/容量双触发清扫）——传 draft s，墓碑随 commit 落盘 */
      };
      rm(id);
      bumpStructRev(s);
    }, { snapshot: true, dirtyText: true, dirtyDocs: owner || undefined });
    /* 【本轮修复 · 日历待办删不掉】删除是「日历索引」的失效事件：_calIndexCache 里仍有该 id，
       _calDayCache / _renderDayCache 里更是留着该节点的旧对象引用。不同步失效时，紧随其后的
       forceRender 会从日缓存里把已删除的行原样画回来（界面表现：按退格删了、行还在、
       刷新后才消失）。与 addNode / setNodeDate / createDoc 同口径：写操作后显式失效。 */
    deps.invalidateCalIndex();
    /* 【侧栏秒变】commit 只推进 _structRev 并广播 notify；renderSidebar 由渲染调度链上的
       renderMain 间接调用，若指纹（_structRev / navExpanded / tagColors …）在本帧未变，
       四棵子树会被 FIX-M-12 的 memo 跳过。硬删除必须显式重绘侧栏 + 立即重渲染，
       否则「标题目录里删一行，左栏文档树仍是旧行」——本缺陷的实测现象。 */
    deps.renderSidebar();
    deps.forceRender();
    actions.logActivity('del', id, oldText);
  },
  createDoc(name: any, opts: any = {}): any {
    let id: any = null;
    /* dirtyText=true：新文档文本进入搜索缓存口径（原提交缺此项，新建文档名在搜索索引里不可见） */
    deps.commit((s: any) => { const n = addNodeTo(s, s.rootId, 0, { text: name, ...opts }); id = n ? n.id : null; }, { snapshot: true, dirtyText: true });
    if (!id) return null;
    deps.invalidateCalIndex(); /* 批次 CA：新节点可带 date/time ⇒ 日历索引失效 */
    /* 【fix5 · P2】新建文档的正文（名称）可内嵌 #tag ⇒ 标签索引缓存失效，侧栏标签列表立刻包含它 */
    try { if (typeof deps.invalidateTagIndex === 'function') deps.invalidateTagIndex(); }
    catch (e) { console.warn('[JU] invalidateTagIndex failed', e); }
    actions.logActivity('add', id);
    /* 【P0 · 新建后界面不实时显示】渲染与持久化解耦，且渲染一定先于落盘：
       ① 侧栏 + 主面板立即同步刷新（createDoc 的调用点分散在侧栏按钮 / 模板 / 数据库 / 日历容器，
          不能依赖每个调用点自觉刷新；removeNode 已是同口径显式刷新）；
       ② 落盘放在渲染之后，并单独兜底 —— 桌面端 SQLite / 配额异常不得阻断已完成的 UI 更新。
       两条刷新各自 try/catch：任一环节失败都不得影响 id 返回与后续落盘。 */
    try { deps.renderSidebar(); } catch (e) { console.warn('[JU] createDoc renderSidebar failed', e); }
    try { deps.forceRender(); } catch (e) { console.warn('[JU] createDoc forceRender failed', e); }
    /* FIX-BUG02: 对齐 addNode 的 F-01——文档创建后立即落盘并广播，消除防抖窗口（置于渲染之后） */
    try { deps.persistNow(); } catch (e) { console.warn('[JU] createDoc persist failed', e); }
    return id;
  },
  setCurrentDoc(id: any): void { deps.ui.currentDocId = id; deps.saveUI(); deps.scheduleNotify(); },
  setNodeDate(id: any, date: any): void {
    const owner = deps.findOwningTopDocId(id, deps.state);
    deps.commit((s: any) => { const n = s.nodes[id]; if (!n) return; n.date = date; n.updatedAt = _nowSeq(); }, { snapshot: true, dirtyText: true, dirtyDocs: owner || undefined, op: 'updateText', opArgs: { id } });
    /* 批次 CA：日历日缓存按 date 分桶，改期后必须全量失效，否则待办停留在旧日期的最里层缓存 */
    deps.invalidateCalIndex();
  },
  clearNodeSchedule(id: any, { date = true, time = true, recur = true }: { date?: boolean; time?: boolean; recur?: boolean } = {}): void {
    const owner = deps.findOwningTopDocId(id, deps.state);
    deps.commit((s: any) => {
      const n = s.nodes[id]; if (!n) return;
      if (date) n.date = null;
      if (time) { n.time = null; n.timeEnd = null; } /* 清除时间同时清除时间段结束端，避免残留区间 */
      if (recur) { n.recur = null; n.recurEnd = null; } /* 清除重复同时清除重复结束日期 */
      n.updatedAt = _nowSeq();
    }, { snapshot: true, dirtyText: true, dirtyDocs: owner || undefined, op: 'updateText', opArgs: { id } });
    /* 批次 CA 同口径补漏：清除日期 / 时间 / 重复同样改变日历索引口径，而各调用点只 forceRender、
       不会自行失效 ⇒ 这里显式失效，避免「清了日期仍挂在当天列表里」。 */
    deps.invalidateCalIndex();
  },
  setStar(id: any, level: any): void { deps.commit((s: any) => { const n = s.nodes[id]; if (!n) return; n.starred = level; n.updatedAt = _nowSeq(); bumpStructRev(s); }, { snapshot: true }); },
  addDbField(docId: any, field: any): void {
    deps.commit((s: any) => {
      if (!s.dbFields) s.dbFields = [];
      if (typeof field === 'string') { if (!s.dbFields.includes(field)) s.dbFields.push(field); }
      else { if (s.dbFields.some((f: any) => (typeof f === 'string' ? f : f.name) === field.name)) return; s.dbFields.push(field); }
    }, { snapshot: true });
  },
  removeDbField(docId: any, name: any): void {
    deps.commit((s: any) => {
      s.dbFields = (s.dbFields || []).filter((f: any) => (typeof f === 'string' ? f : f.name) !== name);
      const sub: any[] = [];
      (function walk(x: any) { const n = s.nodes[x]; if (!n) return; sub.push(x); (n.children || []).forEach(walk); })(docId);
      const now = Date.now(); /* 【fixed17 #6】统一时间戳 + 搜索缓存失效 */
      sub.forEach(id => { const n = s.nodes[id]; if (n && n.db && name in n.db) { delete n.db[name]; n.updatedAt = now; } });
      /* FIX-L-12: 按受影响文档粒度删缓存项，替代全量 clear() 尖峰 */
      try { sub.forEach(id => deps.searchHayCache.delete(id)); } catch(e){console.warn('[JU] caught error',e);}
    }, { snapshot: true });
    /* FIX-DB-13: 清理 ui.dbHiddenFields 残留键——否则删除列后新建/导入同名列会继承旧隐藏状态。
       ui 独立于 state（UI 状态），在 commit 之后直接操作并 saveUI() 持久化 */
    if (deps.ui.dbHiddenFields && Object.prototype.hasOwnProperty.call(deps.ui.dbHiddenFields, name)) {
      delete deps.ui.dbHiddenFields[name];
      deps.saveUI();
    }
  },
  renameDbField(docId: any, oldName: any, newName: any): void {
    deps.commit((s: any) => {
      const idx = (s.dbFields || []).findIndex((f: any) => (typeof f === 'string' ? f : f.name) === oldName);
      if (idx < 0) return;
      const f = s.dbFields[idx];
      if (typeof f === 'string') s.dbFields[idx] = newName; else f.name = newName;
      const now = Date.now(); /* 【fixed17 #6】统一时间戳 + 搜索缓存失效 */
      const _renAffected: any[] = []; /* FIX-L-12: 收集受影响节点 id，按粒度删缓存，替代全量 clear() */
      for (const id in s.nodes) { const n = s.nodes[id]; if (n.db && oldName in n.db) { n.db[newName] = n.db[oldName]; delete n.db[oldName]; n.updatedAt = now; _renAffected.push(id); } }
      /* 【F4/fixed19】同步迁移 dbColumnWidths（key=docId::字段名）旧 key，避免重命名后死键残留 */
      if (s.dbColumnWidths) {
        const oldKey = docId + '::' + oldName, newKey = docId + '::' + newName;
        if (Object.prototype.hasOwnProperty.call(s.dbColumnWidths, oldKey)) {
          s.dbColumnWidths[newKey] = s.dbColumnWidths[oldKey]; delete s.dbColumnWidths[oldKey];
        }
      }
      /* FIX-L-12: 按受影响节点粒度删搜索缓存，替代全量 clear() 尖峰 */
      try { _renAffected.forEach(id => deps.searchHayCache.delete(id)); } catch(e){console.warn('[JU] caught error',e);}
    }, { snapshot: true });
    /* FIX-DB-13: 迁移 ui.dbHiddenFields 键——原列名的隐藏状态跟随字段重命名。
       ui 独立于 state（UI 状态），在 commit 之后同步更新并 saveUI() 持久化；
       用 hasOwnProperty 判断原键存在才迁移，避免无意义地写入新键为 false */
    if (deps.ui.dbHiddenFields && Object.prototype.hasOwnProperty.call(deps.ui.dbHiddenFields, oldName)) {
      deps.ui.dbHiddenFields[newName] = deps.ui.dbHiddenFields[oldName];
      delete deps.ui.dbHiddenFields[oldName];
      deps.saveUI();
    }
  },
  setDbCell(rowId: any, fieldName: any, value: any): void {
    const cur = deps.state.nodes[rowId];
    if (!cur) return;
    const old = cur.db ? cur.db[fieldName] : undefined;
    const isObj = (v: any) => v && typeof v === 'object';
    const same = (isObj(old) || isObj(value)) ? JSON.stringify(old) === JSON.stringify(value) : old === value;
    if (same) return;
    deps.commit((s: any) => {
      const n = s.nodes[rowId]; if (!n) return;
      if (!n.db) n.db = {};
      n.db[fieldName] = value;
      n.updatedAt = _nowSeq();
    }, { snapshot: true, op: 'setDbCell', opArgs: { id: rowId, field: fieldName } });
  },
  addDbRow(docId: any, init: any = {}): any {
    let id: any;
    deps.commit((s: any) => {
      const doc = s.nodes[docId]; if (!doc) return;
      const n = addNodeTo(s, docId, null, { text: '新条目', db: {}, ...init });
      id = n ? n.id : null;
    }, { snapshot: true });
    return id;
  },
  /**
   * v2.1 fix9 · P1：把「v2.0-t3 内置默认表格模板」一次性套到新建表上。
   *
   * 修复的缺陷：新建表格此前只落 1 行「新条目」，且 `state.dbFields` 缺失
   * （renderDbTable 回落 `['标题']`）⇒ 新建出来是「单列 + 1 行」的半成品表。
   *
   * 语义（与 canonical defaultState 对齐，见 core/constants.ts 的取证注释）：
   *   · 表头 = DEFAULT_DB_FIELDS（10 列：标题/优先级/状态/时间/地点/人物/内容/星级/评价/备注，**全局字段表**）
   *   · 数据行 = DEFAULT_DB_ROW_COUNT（3 行空白）
   *   两者在同一次 commit 内完成：避免「先建表再补列」产生两条历史/两次落盘，也不会留下中途的单列态。
   *
   * 幂等：字段表已与模板逐字相同则不重写；已存在行则不再追加（重复调用不会堆行）。
   */
  applyDbTemplate(docId: any, fields: any[] = DEFAULT_DB_FIELDS as unknown as any[], rowCount: number = DEFAULT_DB_ROW_COUNT): any[] {
    const want = (Array.isArray(fields) ? fields : []).map((f: any) => (typeof f === 'string' ? f : (f && f.name)));
    let ids: any[] = [];
    deps.commit((s: any) => {
      const doc = s.nodes[docId]; if (!doc) return;
      /* ① 表头：仅在缺失/不一致时整体替换（保持 dbFields 为全局字段表的既有语义） */
      const cur = Array.isArray(s.dbFields) ? s.dbFields.map((f: any) => (typeof f === 'string' ? f : (f && f.name))) : [];
      const same = cur.length === want.length && want.every((n: any, i: number) => cur[i] === n);
      if (!same) s.dbFields = want.slice();
      /* ② 数据行：仅在表内无数据行时补足（幂等，不堆积） */
      const existing = (doc.children || []).filter((cid: any) => { const c = s.nodes[cid]; return c && !c._deleted && !(c._isFolder && !c._isDbRoot); });
      if (!existing.length) {
        const total = Math.max(0, Math.floor(Number(rowCount) || 0));
        for (let i = 0; i < total; i++) {
          /* 行文本留空（任务书要求「3 行空白」；canonical 的 3 行带示例值，差异见回执偏差说明） */
          const n = addNodeTo(s, docId, null, { text: '', db: {} });
          if (n) ids.push(n.id);
        }
      }
    }, { snapshot: true });
    return ids;
  },
  setDbColumnWidth(docId: any, name: any, w: any): void { deps.commit((s: any) => { if (!s.dbColumnWidths) s.dbColumnWidths = {}; s.dbColumnWidths[docId + '::' + name] = w; }, { silent: true, persistOnly: true, light: true, dirtyText: false, dirtyDocs: null, noRollback: true }); },
  setDbRowHeight(rowId: any, h: any): void { deps.commit((s: any) => { if (!s.dbRowHeights) s.dbRowHeights = {}; s.dbRowHeights[rowId] = h; }, { silent: true, persistOnly: true, light: true, dirtyText: false, dirtyDocs: null, noRollback: true }); },
  importTree(parentId: any, tree: any[]): void {
    deps.commit((s: any) => {
      const p = s.nodes[parentId]; if (!p) return;
      const insertAt = p.children.length;
      function addOne(data: any, pid: any, at: any): any {
        const n = addNodeTo(s, pid, at, {
          text: data.text || '', done: !!data.done, date: data.date || null,
          time: data.time || null, tags: data.tags || [], note: data.note || null, recur: data.recur || null, showInCal: true,
        });
        if (!n) return;
        (data.children || []).forEach((c: any, i: number) => addOne(c, n.id, i));
        return n;
      }
      tree.forEach((node, i) => addOne(node, parentId, insertAt + i));
    }, { snapshot: true });
    /* 批次 CA：批量导入可能带入大量 date/time ⇒ 日历索引整体失效（单次调用，不做逐节点失效） */
    deps.invalidateCalIndex();
  },
  addTemplate(name: any, tree: any): void { deps.commit((s: any) => { if (!s.templates) s.templates = []; s.templates.push({ id: uid(), name, createdAt: Date.now(), tree }); }, { snapshot: true }); },
  removeTemplate(id: any): void { deps.commit((s: any) => { s.templates = (s.templates || []).filter((t: any) => t.id !== id); }, { snapshot: true }); },
  moveToTrash(id: any): void {
    const _src = deps.state.nodes[id];
    if (!_src || id === deps.state.rootId || _src._isCalRoot || _src._isDbRoot || _src._isNoteRoot) return; /* 【修复】系统容器不可回收；FIX-DEF-A-1 根节点同样不可回收；FIX-R62-P0 记事本根不可回收（回收会产生僵尸编辑） */
    const sub = deps.docSubtree(id);
    deps.commit((s: any) => {
      const n = s.nodes[id]; if (!n) return;
      const ids: any[] = [];
      (function walk(x: any) { const nd = s.nodes[x]; if (!nd) return; ids.push(x); (nd.children || []).forEach(walk); })(id);
      if (!s.trashed) s.trashed = [];
      const p = s.nodes[n.parent];
      const origIndex = p ? p.children.indexOf(id) : -1;
      s.trashed.unshift({ rootId: id, ids, deletedAt: Date.now(), parentId: n.parent, origIndex });
      if (p) { const i = p.children.indexOf(id); if (i >= 0) p.children.splice(i, 1); }
      /* 【QA-P0-2】回收同时 bump 子树全部节点 updatedAt：使删除副本在 LWW 中必然胜出，回收站跨标签传播
         （原实现不 bump，时间戳平局下 _deleted 会被非删除副本覆盖，DEFECT-B） */
      const _trashNow = Date.now();
      ids.forEach(x => { const nd = s.nodes[x]; if (nd) { nd._deleted = true; nd.updatedAt = _trashNow; } });
      /* FIX-S-2: 软删同样写 _recentlyRemoved 墓碑（与 removeNodeFromMap 硬删一致 + 2000 上限惰性清理）。
         回收后 30s 内对端旧快照（节点 updatedAt 不新于回收时刻）不得重建/覆盖复活；否则回收→远端旧副本
         LWW 覆盖（DEFECT-B 同源）会把刚回收的节点复活回活树 */
      ids.forEach(x => deps.tombstoneSet(x, s)); /* FIX-P0-4: 统一墓碑写入（计数/容量双触发清扫）——传 draft s，墓碑随 commit 落盘 */
      /* 【侧栏秒变】软删同样改变了侧栏行集合（文档树少一行 / 回收站多一条）与计数；
         原实现未推进 _structRev，侧栏指纹不变 ⇒ FIX-M-12 memo 跳过四棵子树重建，
         表现为「移入回收站后左栏还在」。此处与 addNodeTo / removeNode 同口径自增。 */
      bumpStructRev(s);
    }, { snapshot: true });
    if (sub.includes(deps.ui.currentDocId)) { deps.ui.currentDocId = null; deps.ui.activeKey = null; }
    /* 【侧栏秒变】提交完成后立即重绘侧栏 + 强制重渲染（不等 notify 的 rAF 合并帧，
       也不依赖 renderMain 内的间接调用），保证右键「移入回收站」后左栏即时消失。 */
    deps.renderSidebar();
    deps.forceRender();
  },
  restoreFromTrash(idx: number): void {
    deps.commit((s: any) => {
      const t = s.trashed[idx]; if (!t) return;
      /* BUG-02: 原父可能仍在回收站（_deleted）——沿父链上溯到最近的非 _deleted 祖先，找不到则回退 root，
         避免恢复后的子树挂在回收站节点下形成不可达孤儿（悬空 parent 持久化） */
      let targetParentId = s.rootId;
      if (t.parentId && s.nodes[t.parentId]) {
        let p = s.nodes[t.parentId];
        const _seen = new Set<any>();
        while (p && p._deleted && !_seen.has(p.id)) {
          _seen.add(p.id);
          p = p.parent ? s.nodes[p.parent] : null;
        }
        if (p && !p._deleted) targetParentId = p.id;
      }
      (function fix(id: any, pid: any) { const n = s.nodes[id]; if (!n) return; n.parent = pid; n._deleted = false; (n.children || []).forEach((c: any) => fix(c, id)); })(t.rootId, targetParentId);
      const target = s.nodes[targetParentId];
      if (target && !target.children.includes(t.rootId)) {
        const pos = (typeof t.origIndex === 'number' && t.origIndex >= 0 && t.origIndex <= target.children.length)
          ? t.origIndex
          : target.children.length;
        target.children.splice(pos, 0, t.rootId);
      }
      /* FIX-S-2c: 恢复时清除对应墓碑——回收写的 _recentlyRemoved 在 30s TTL 内仍有效，
         若不清理，恢复后的节点会受 pruneTombstonedChildren 误剪（远端祖先 children 合入时被剔除）
         FIX-P0-2: 同步 delete s._tombstones[x]——原仅清内存态 _recentlyRemoved，刷新后 initStore
         会从 state._tombstones 重建 _recentlyRemoved，恢复的节点在 30s 内仍被 pruneTombstonedChildren 误剪 */
      try { (t.ids || []).forEach((x: any) => { deps.recentlyRemovedDelete(x); if (s._tombstones) delete s._tombstones[x]; }); } catch(e){console.warn('[JU] caught error',e);}
      s.trashed.splice(idx, 1);
      /* 【侧栏秒变】恢复同时改变活树行集合与回收站条目 ⇒ 与 moveToTrash 同口径推进 _structRev */
      bumpStructRev(s);
    }, { snapshot: true });
    deps.renderSidebar();
    deps.forceRender();
  },
  purgeTrash(idx: number): void {
    deps.commit((s: any) => {
      const t = s.trashed[idx]; if (!t) return;
      /* FIX-P0-5: 旧数据/导入数据 t.ids 可能为 undefined——原直接 t.ids.forEach 抛 TypeError，整条 commit 回滚 */
      (t.ids || []).forEach((x: any) => {
        delete s.nodes[x]; deps.purgeNodeMeta(s, x);
        /* 【F7/fixed19】永久删除时同步清理 ui.collapsedDocs 残留，避免指向已删节点的折叠标记 */
        try { if (deps.ui && deps.ui.collapsedDocs) delete deps.ui.collapsedDocs[x]; } catch(e){console.warn('[JU] caught error',e);}
        /* FIX-ORIGIN-1: 同步清理搜索 hay 缓存与 _localCreated，与 removeNodeFromMap/removeNode 路径一致，防陈旧命中/残留占用 */
        try { deps.searchHayCache.delete(x); } catch(e){console.warn('[JU] caught error',e);}
        try { if (s._localCreated) { const _li = s._localCreated.indexOf(x); if (_li >= 0) s._localCreated.splice(_li, 1); } } catch(e){console.warn('[JU] caught error',e);}
        /* L16-W13 · 指令 4（Defect-F）：永久删除同址摘除对端合入保护集，避免集合残留 */
        try { if (Array.isArray(s._remoteReceived)) { const _ri = s._remoteReceived.indexOf(x); if (_ri >= 0) s._remoteReceived.splice(_ri, 1); } } catch(e){console.warn('[JU] caught error',e);}
      });
      /* FIX-S-2: 永久删除写墓碑（同 removeNodeFromMap 模式 + 2000 上限惰性清理）——purge 原实现不写
         _recentlyRemoved，30s 内对端旧快照会在 merge !ln 重建分支把已清空节点复活（I4 违反点） */
      (t.ids || []).forEach((x: any) => deps.tombstoneSet(x, s)); /* FIX-P0-4: 统一墓碑写入（计数/容量双触发清扫）——传 draft s，墓碑随 commit 落盘 */
      s.trashed.splice(idx, 1);
      /* 【侧栏秒变】回收站条目减少同样属于「侧栏行集合变更」 ⇒ 推进 _structRev 并重绘 */
      bumpStructRev(s);
    }, { snapshot: true });
    deps.renderSidebar();
    deps.forceRender();
  },
  logActivity(type: string, id?: any, detail?: any, diff?: any): void {
    const n = (!detail && id) ? deps.state.nodes[id] : null;
    if (n && deps.isBlankNode(n)) return;
    const key = type + ':' + id;
    /* R54 / fix7：第 4 参数 diff 与 accDiff 属**旧字符长度差口径**，fix7 起不再参与 charStats
       （新口径见 core/charstats：token 级 I/D → A/R/M/N）。两个参数保留只为不改变既有调用点签名。 */
    const doCommit = (accDiff?: number) => {
      /* FIX-P1-10: ds 改在落盘时取——原在调用时捕获进闭包，23:59:59 的 mod 防抖 1.5s 后跨零点落盘会写进昨天桶 */
      const ds = todayStr();
      const nn = id && deps.state.nodes[id];
      const entry = { id, text: detail || (nn ? stripHtml(nn.text) : '') || '', t: Date.now() };
      deps.commit((s: any) => {
        if (!s.activity) s.activity = {};
        if (!s.activity[ds]) s.activity[ds] = { add: [], del: [], mod: [] };
        s.activity[ds][type].push(entry);
        if (s.activity[ds][type].length > 200) s.activity[ds][type] = s.activity[ds][type].slice(-200);
        /* fix7 · charStats 不再在此处累加：
           旧实现按「字符长度差」写 mod（新输入算修改、删字为负、面板净变化重复计修改）。
           现口径见 core/charstats —— 正文编辑按 token 差分累加 A/R/M/N，
           节点新增 / 删除作为「整节点事件」在下方 commit 之后整段计入。 */
        const keys = Object.keys(s.activity).sort();
        const MAX_DAYS = 90;
        if (keys.length > MAX_DAYS) { keys.slice(0, keys.length - MAX_DAYS).forEach(k => delete s.activity[k]); }
        /* 【F17/fixed19】总量上限 5000 条：超限时从最旧日期桶裁剪，保证近期日志(含 autobackup)保留 */
        let total = 0; for (const k in s.activity) { const b = s.activity[k]; if (b) { total += (b.add ? b.add.length : 0) + (b.mod ? b.mod.length : 0) + (b.del ? b.del.length : 0); } }
        if (total > 5000) {
          const kk = Object.keys(s.activity).sort();
          for (const k of kk) { if (total <= 5000) break; const b = s.activity[k]; if (b) { total -= (b.add ? b.add.length : 0) + (b.mod ? b.mod.length : 0) + (b.del ? b.del.length : 0); delete s.activity[k]; } }
        }
      }, { silent: true, light: true, dirtyText: false, dirtyDocs: null });
      /* fix7 · 整节点事件按 token 整段计入：add → 新增 A，del → 删除 R。
         正文编辑（mod）**不在此处**计入，避免与 updateText 的 token 增量双重计账。 */
      if (type === 'add' || type === 'del') {
        const statFn = type === 'add' ? deps.charStatsNodeAdd : deps.charStatsNodeRemove;
        if (typeof statFn === 'function') {
          try { statFn(id, entry.text); } catch (e) { console.warn('[JU] charStats node event failed', e); }
        }
      }
      deps.schedulePersist();
      deps.scheduleNotify();
    };
    if (type === 'mod') {
      const prev = _logTimers.get(key);
      if (prev) clearTimeout(prev.timer);
      /* L17-W4 · P1-4：_logTimers 加上限——仅在新增 key 且已达上限时淘汰最早登记项，
         先 clearTimeout 再立即 doCommit 落盘，避免防抖计时器永久悬挂导致条目无界增长。 */
      if (!prev && _logTimers.size >= LOG_TIMER_MAX) {
        const oldestKey = _logTimers.keys().next().value;
        if (oldestKey !== undefined) {
          const old = _logTimers.get(oldestKey);
          _logTimers.delete(oldestKey);
          if (old) { clearTimeout(old.timer); try { old.commit(); } catch(e){console.warn('[JU] caught error',e);} }
        }
      }
      const accumulatedDiff = (prev ? (prev.diff || 0) : 0) + ((typeof diff === 'number') ? diff : 0);
      const timer = setTimeout(() => {
        _logTimers.delete(key);
        doCommit(accumulatedDiff);
      }, 1500);
      _logTimers.set(key, { timer, commit: () => doCommit(accumulatedDiff), diff: accumulatedDiff });
    } else doCommit();
  }
};
