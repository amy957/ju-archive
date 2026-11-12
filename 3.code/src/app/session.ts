/**
 * M1-1 · 批次 P1/P2/P3 · 会话编排层（Session Orchestration）
 *
 * 缺陷背景（本文件的存在理由）：
 *   模块化迁移把产品件（public/v2.0-t3.html，canonical）拆成 core / ui / views / io 各模块，
 *   但产品件里与「唯一 script 作用域」同生的一批**会话级函数**从未迁移：
 *     viewOf / getCurrentDoc / saveUI / loadUI / applyUIFields / applyScale / forceRender /
 *     scheduleRender / openNode / safeNavigate / setActiveKey / updateSidebarActiveState /
 *     renderIntro / sortDocs / sideCountsGet / getNodeSvg / renderFileCard / renderFolderGrid /
 *     showTreeContext / buildTagIndex / getTagColor / openTagPalette / l7TagCountText /
 *     syncTopbar / tickClock / updateRemindBadge / floatCalVisible / setFloatCalVisible / bindSidebar / bindTools
 *   迁移期这些位置全部注入 `const ne = () => {}`（等价空壳），运行期表现为：
 *     - bindRenderMainDeps 收到 `viewOf:()=>null` / `getCurrentDoc:()=>null` / `N:()=>null`
 *       ⇒ renderMain 的 view 恒为 null ⇒ default 分支 renderOutlinePage(null)
 *       ⇒ #content 只剩 `<div class="empty-state">请先选择文档</div>`（本缺陷的主因之一）；
 *     - bindSidebarDeps 只注入 `{ui}` ⇒ deps.N/deps.state/deps.sortDocs 全为空壳
 *       ⇒ 侧栏四棵子树与计数恒为空（第二个主因）。
 *   本文件把这些函数按 canonical 语义逐条回填为**真实实现**（注释标注来源行号），
 *   并由 main.ts 的装配点注入各模块 deps 容器。运行期口径与产品件一致。
 */

import { $, $$, esc, pad, parseYmd, stripHtml, todayStr, compareZh } from '../core/utils';
import { TAG_RE, VIEW_KIND } from '../core/constants';
import { getState, docWordCount } from '../core/store';
import { N as nodeById, commit as persistCommit, persistNow, persistNowAwait, isBlankNode } from '../core/persist';
import { actions, _nowSeq } from '../core/actions';
import { parsePasteLines, safeExec } from '../core/richtext';
import { encryptState, decryptState } from '../core/crypto';
/* 【fixr7-03 · ISSUE-003】关闭前未收敛留痕：写入本地环形错误日志（window.__juLog） */
import { reportError } from '../core/errors';
/* 【D-07】bindClick：按钮统一 addEventListener 绑定（替代 el.onclick 属性赋值） */
import { toast, appPrompt, appConfirm, showContextMenu, initDragClose, bindClick } from '../ui/common';
import { ui, _mSel, _mSelSetOrder, _mSelHas, _mSelClick, _mSelSelectAll } from '../ui/selection';
import { saveFocus, withSuppressedBlur, isBlurSuppressed, syncEmptyState } from '../ui/focus';
import { deps as sidebarDeps, renderSidebar, renderSubTags, navTo } from '../ui/sidebar';
import { calendarTodosOnDate, tgHourH } from '../views/calendar';
import { renderMain } from './render';
/* 【review7-07 · ISSUE-007】关闭备份落点复核：系统关键目录不得写盘 */
import { _juBlockedDir, _juWritableDir } from './boot';

const _win: any = window as any;

/* ────────────────────────────────────────────────────────────────────────────
 * 0 · 运行时访问器（state 经 getState() 读活引用；N/commit 取 core/persist）
 * ──────────────────────────────────────────────────────────────────────────── */

/** 活状态视图（initStore / 导入整体替换 state 后仍读到最新引用） */
const state: any = {};
Object.defineProperty(state, 'nodes', { get: () => { const s: any = getState(); return (s && s.nodes) || {}; } });
Object.defineProperty(state, 'rootId', { get: () => { const s: any = getState(); return s ? s.rootId : null; } });
Object.defineProperty(state, 'tagColors', { get: () => { const s: any = getState(); return (s && s.tagColors) || {}; } });
/* 【fix5 · P1】全局标签索引：新建标签登记于此（不依赖任何节点），buildTagIndex 合并后侧栏可见 */
Object.defineProperty(state, '_tags', { get: () => { const s: any = getState(); return (s && Array.isArray(s._tags)) ? s._tags : []; } });
Object.defineProperty(state, '_structRev', { get: () => { const s: any = getState(); return (s && s._structRev) || 0; } });

const N = (id: any): any => nodeById(id);
const commit = (fn: (s: any) => void, opts?: any): any => persistCommit(fn as any, opts);
const nowSeq = (): any => _nowSeq();

/** UI 存储键（与 core/persist 的私有 UI_KEY 同值：'juju.ui.v31'；ENC 侧沿用 crypto 的 'juju.ui.enc'） */
const UI_KEY = 'juju.ui.v31';
const UI_ENC_KEY = 'juju.ui.enc';
/** 顶层视图白名单（canonical 5984 `TOP_LEVEL_VIEWS`） */
const TOP_LEVEL_VIEWS = ['auto', 'mindmap', 'presentation', 'slides', 'graph', 'stats', 'tags', 'history', 'starred', 'templates', 'trash'];

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · UI 默认态（产品件 ui 单例缺省字段；缺省会令 renderSidebar 的
 *     `deps.ui.navExpanded.database` 直接抛 TypeError ⇒ 侧栏空白）
 * ──────────────────────────────────────────────────────────────────────────── */
export function initSessionDefaults(): void {
  if (!ui.navExpanded || typeof ui.navExpanded !== 'object') ui.navExpanded = { starred: false, files: false, database: false, tags: false };
  else ui.navExpanded = Object.assign({ starred: false, files: false, database: false, tags: false }, ui.navExpanded);
  if (!ui.collapsedDocs || typeof ui.collapsedDocs !== 'object') ui.collapsedDocs = {};
  if (typeof ui.view !== 'string') ui.view = 'auto';
  if (typeof ui.scale !== 'number') ui.scale = 1;
  if (typeof ui.mmScale !== 'number') ui.mmScale = 1;
  if (typeof ui.filesSort !== 'string') ui.filesSort = 'name';
  if (!('activeKey' in ui)) ui.activeKey = null;
  if (!ui.collapsedPanels || typeof ui.collapsedPanels !== 'object') ui.collapsedPanels = { today: false, added: false, stats: false, note: false };
  if (!ui.logCollapsed || typeof ui.logCollapsed !== 'object') ui.logCollapsed = { add: false, mod: false, del: false };
  if (!ui.calModules || typeof ui.calModules !== 'object') ui.calModules = { order: ['calendar', 'chars', 'note', 'today', 'log', 'stats'], hidden: {}, sizes: {} };
  if (!Array.isArray(ui.calModules.order)) ui.calModules.order = ['calendar', 'chars', 'note', 'today', 'log', 'stats'];
  if (!ui.calModules.order.includes('calendar')) ui.calModules.order.unshift('calendar');
  if (!ui.calModules.hidden || typeof ui.calModules.hidden !== 'object') ui.calModules.hidden = {};
  if (!ui.calModules.sizes || typeof ui.calModules.sizes !== 'object') ui.calModules.sizes = {};
  if (typeof ui.selectedDate !== 'string' || !ui.selectedDate) ui.selectedDate = todayStr();
  if (typeof ui.calView !== 'string') ui.calView = 'month';
  if (ui.currentDocId === undefined) ui.currentDocId = null;
  if (ui.floatCal === undefined) ui.floatCal = false;
  if (ui._lastScroll === undefined) ui._lastScroll = 0;
  if (typeof ui.locked !== 'boolean') ui.locked = false;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · 视图判定 / 当前文档（canonical: viewOf 1725、getCurrentDoc 7068）
 * ──────────────────────────────────────────────────────────────────────────── */

export function viewOf(node: any): string {
  if (!node || node.id === state.rootId) return VIEW_KIND.LIBRARY_ROOT;
  if (node._isCalRoot) return VIEW_KIND.CALENDAR;
  if (node._isDbRoot) return VIEW_KIND.FOLDER;
  if (node.dbRoot) return VIEW_KIND.DATABASE;
  if (node._isFolder) return VIEW_KIND.FOLDER;
  return VIEW_KIND.OUTLINE;
}

/**
 * 当前文档（canonical 7068）：
 *   ui.currentDocId 失效（缺失 / 已删）时，取根节点下第一个非日历根 / 非数据库根 / 非记事本根 / 未删除子节点；
 *   若仍无可用文档则返回 null（不落到容器节点，避免渲染空大纲）。
 */
export function getCurrentDoc(): any {
  const S: any = getState();
  if (!S || !S.nodes) return null;
  let id = ui.currentDocId;
  if (!id || !S.nodes[id] || S.nodes[id]._deleted) {
    const root = S.nodes[S.rootId];
    if (!root) return null; /* 整树被清空：直接 null，防 root.children 抛 TypeError */
    const kids: any[] = Array.isArray(root.children) ? root.children : [];
    const first = kids.map((cid: any) => S.nodes[cid]).find((n: any) => n && !n._isCalRoot && !n._isDbRoot && !n._isNoteRoot && !n._deleted);
    id = first ? first.id : null;
    if (id) ui.currentDocId = id;
  }
  return id ? S.nodes[id] : null;
}

/** 文件夹判定（canonical 7114）：_isFolder 且非数据库根 */
export function isFolder(id: any): boolean {
  const n = N(id);
  return !!(n && n._isFolder && !n._isDbRoot);
}

/**
 * 中文排序比较器（canonical 15401 `_getZhCollator`）。
 * 【fix5 · P2】比较器实体已提取到 core/utils.compareZh —— 侧栏「标签」列表复用同一实例，
 * 保证两个列表的名称升序规则完全一致（'zh-Hans' + numeric + sensitivity:base）。
 */

/** 文档排序（canonical 15408） */
export function sortDocs(ids: any[], sorter: string): any[] {
  return [...(ids || [])].sort((aid: any, bid: any) => {
    const a = N(aid), b = N(bid);
    if (!a || !b) return 0;
    const aF = isFolder(aid), bF = isFolder(bid);
    if (sorter === 'type' && aF !== bF) return aF ? -1 : 1;
    if (sorter === 'created') return (b.createdAt || 0) - (a.createdAt || 0);
    if (sorter === 'updated') return (b.updatedAt || 0) - (a.updatedAt || 0);
    if (sorter === 'star') return (b.starred || 0) - (a.starred || 0);
    if (aF !== bF) return aF ? -1 : 1;
    return compareZh(stripHtml(a.text || ''), stripHtml(b.text || ''));
  });
}

/** 相对时间（canonical 7130） */
export function fmtRelative(ts: any, short?: boolean): string {
  if (!ts) return '';
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + (short ? '分前' : '分钟前');
  if (diff < 86400000) return short ? (pad(d.getHours()) + ':' + pad(d.getMinutes())) : (Math.floor(diff / 3600000) + '小时前');
  if (diff < 604800000) return Math.floor(diff / 86400000) + (short ? '天' : '天前');
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 节点图标（canonical 7139） */
export function getNodeSvg(id: any): string {
  if (id === state.rootId) return `<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`;
  const n = N(id);
  if (n && n._isNoteRoot) return `<svg viewBox="0 0 24 24"><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M8 12h8M8 16h5"/></svg>`;
  if (isFolder(id)) return `<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`;
  return `<svg viewBox="0 0 24 24"><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/></svg>`;
}

/** 词数（大库异步时 docWordCount 返回 null，此处回落到 0 显示） */
function wordsOf(id: any): number {
  const w = docWordCount(id);
  return typeof w === 'number' ? w : 0;
}

/** 文件卡片（canonical 15490） */
export function renderFileCard(id: any, n: any, isFolderFlag?: boolean): HTMLElement {
  const card = document.createElement('div'); card.className = 'file-card';
  card.setAttribute('data-msid', id);
  if (_mSel.type === 'files' && _mSelHas(id)) card.classList.add('ju-msel');
  if (ui.currentDocId === id) card.classList.add('sel');
  const icon = document.createElement('div'); icon.className = 'file-icon'; icon.innerHTML = getNodeSvg(id); card.appendChild(icon);
  const info = document.createElement('div'); info.className = 'file-info';
  const nameEl = document.createElement('div'); nameEl.className = 'file-name'; nameEl.textContent = stripHtml(n && n.text) || '未命名'; info.appendChild(nameEl);
  const meta = document.createElement('div'); meta.className = 'file-meta';
  if (isFolderFlag) meta.textContent = ((n && n.children && n.children.length) || 0) + ' 项';
  else meta.textContent = wordsOf(id) + ' 字 · ' + fmtRelative(n && n.updatedAt, false);
  info.appendChild(meta);
  if (n && n.starred > 0) { const stars = document.createElement('div'); stars.className = 'file-stars'; stars.textContent = '★'.repeat(n.starred); info.appendChild(stars); }
  card.appendChild(info);
  card.onclick = (e: any) => {
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) { e.preventDefault(); _mSelClick('files', id, e, _mSel.order); return; }
    openNode(id);
  };
  card.oncontextmenu = (e: MouseEvent) => { e.preventDefault(); showTreeContext(e, id); };
  return card;
}

/** 文件夹标题栏（canonical 15447；粘贴/改名交互逐条保留） */
export function renderFolderHeader(folder: any): HTMLElement {
  const bar = document.createElement('div'); bar.className = 'doc-header';
  const name = document.createElement('div'); name.className = 'doc-header-title';
  if (folder.id === state.rootId) {
    name.textContent = '我的文档';
    name.contentEditable = 'false';
  } else {
    name.contentEditable = 'true'; name.spellcheck = false;
    name.dataset.id = folder.id; name.dataset.ph = '未命名文件夹';
    name.textContent = stripHtml(folder.text) || '未命名';
    syncEmptyState(name, '未命名文件夹');
    name.addEventListener('input', () => { syncEmptyState(name, '未命名文件夹'); });
    name.addEventListener('blur', () => {
      if (isBlurSuppressed()) return;
      if (!name.isConnected) return;
      const finalText = (name.textContent || '').trim();
      const cur = N(folder.id); if (!cur) return;
      if (finalText && finalText !== stripHtml(cur.text || '')) {
        commit((s: any) => { s.nodes[folder.id].text = finalText; s.nodes[folder.id].updatedAt = nowSeq(); }, { snapshot: true });
        actions.logActivity('mod', folder.id);
        renderSidebar();
        if (folder.id !== state.rootId) forceRender();
      }
    });
    name.addEventListener('paste', (e: ClipboardEvent) => {
      try {
        const dt: any = (e as any).clipboardData || (_win as any).clipboardData;
        if (!dt) return;
        e.preventDefault();
        const parsed: any = parsePasteLines(dt);
        const single = parsed.lines.length ? String(parsed.lines[0]).replace(/\s+/g, ' ').trim() : '';
        if (single) safeExec('insertText', single);
      } catch (err) { /* 粘贴解析失败：保持浏览器默认行为（canonical 同款空 catch） */ }
    });
    name.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (name as HTMLElement).blur(); }
      if (e.key === 'Escape') { const c = N(folder.id); name.textContent = stripHtml((c && c.text) || '') || '未命名'; (name as HTMLElement).blur(); }
    });
  }
  bar.appendChild(name);
  return bar;
}

/** 文件夹网格（canonical 15420）——资料库 / 文件夹视图的落地渲染 */
export function renderFolderGrid(folder: any): HTMLElement {
  const wrap = document.createElement('div'); wrap.className = 'files-wrap';
  if (!folder) { wrap.innerHTML = '<div class="empty-state">文件夹不存在</div>'; return wrap; }
  wrap.appendChild(renderFolderHeader(folder));
  const toolbar = document.createElement('div'); toolbar.className = 'files-toolbar';
  const sortSel = document.createElement('select'); sortSel.className = 'files-sort';
  sortSel.innerHTML = `<option value="name">按名称</option><option value="type">按类型</option><option value="created">按创建时间</option><option value="updated">按修改时间</option><option value="star">按星标等级</option>`;
  sortSel.value = ui.filesSort || 'name';
  sortSel.onchange = () => { ui.filesSort = sortSel.value; saveUI(); forceRender(); };
  toolbar.appendChild(sortSel);
  const kids: any[] = Array.isArray(folder.children) ? folder.children : [];
  const ids = sortDocs(kids.filter((id: any) => {
    const n = N(id);
    if (!n || n._deleted) return false;
    return !n._isCalRoot && !n._isDbRoot && !n._isNoteRoot;
  }), ui.filesSort || 'name');
  const selAllBtn = document.createElement('button'); selAllBtn.className = 'btn'; selAllBtn.textContent = '全选'; selAllBtn.title = '全选当前文件夹（Ctrl/Cmd+A）';
  selAllBtn.onclick = () => { _mSelSelectAll('files', ids); };
  toolbar.appendChild(selAllBtn);
  wrap.appendChild(toolbar);
  _mSelSetOrder('files', ids);
  if (!ids.length) { const e = document.createElement('div'); e.className = 'empty-state'; e.textContent = '这个文件夹是空的'; wrap.appendChild(e); return wrap; }
  const grid = document.createElement('div'); grid.className = 'files-grid';
  ids.forEach((id: any) => grid.appendChild(renderFileCard(id, N(id), isFolder(id))));
  wrap.appendChild(grid);
  return wrap;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · 渲染调度（canonical: scheduleRender 6661、forceRender 6700、_forceRender 标志）
 * ──────────────────────────────────────────────────────────────────────────── */

let _forceRenderFlag = false;
let _renderPending = false;
let _renderRaf: number | null = null;

/** 渲染期强制重建标志（renderMain 在非编辑态读取后复位） */
export function isForceRender(): boolean { return _forceRenderFlag === true; }
export function setForceRender(v: boolean): void { _forceRenderFlag = v === true; }

/** rAF 合并渲染（canonical 6661） */
export function scheduleRender(): void {
  if (_renderPending) return;
  _renderPending = true;
  _renderRaf = requestAnimationFrame(() => {
    _renderPending = false; _renderRaf = null;
    renderMain();
    /* canonical 22677：主渲染后同步刷新悬浮日历（此前未迁入 ⇒ 数据变化时浮层不更新） */
    try { if (floatCalVisible()) renderFloatCal(); } catch (e) { console.warn('[JU] caught error', e); }
  });
}

/**
 * 强制重建（canonical 6700）
 * 顺序契约：先保存焦点（saveFocus），再置 _forceRender=true，最后同步 renderMain()。
 * 产品件的 `commitPendingEditBeforeRender()` 属未迁移的大纲编辑态子系统，
 * 此处以「先 saveFocus 且不改 DOM」保持同一契约（前者本身不改 DOM）。
 */
export function forceRender(): void {
  try { saveFocus(); } catch (e) { console.warn('[JU] caught error', e); }
  _forceRenderFlag = true;
  const ae: any = document.activeElement;
  if (ae && ae.blur) {
    const tag = ae.tagName;
    if (ae.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      withSuppressedBlur(() => ae.blur());
    }
  }
  if (_renderRaf) { cancelAnimationFrame(_renderRaf); _renderRaf = null; }
  _renderPending = false;
  renderMain();
  /* canonical 22677：主渲染后同步刷新悬浮日历（勾选待办 / 新增待办后浮层即时反映） */
  try { if (floatCalVisible()) renderFloatCal(); } catch (e) { console.warn('[JU] caught error', e); }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · UI 落盘 / 回填（canonical: saveUI 6100、_saveUINow 6104、loadUI 6010、
 *     applyUIFields 6032、applyScale 5992）
 * ──────────────────────────────────────────────────────────────────────────── */

let _saveUITimer: any = null;
let _baseFontSize: number | null = null;

/** 延迟 150ms 合并落盘（canonical 6100） */
export function saveUI(): void {
  clearTimeout(_saveUITimer);
  _saveUITimer = setTimeout(_saveUINow, 150);
}

/** UI 快照字段（canonical 6104 逐项保留，uiVersion 固定 3） */
function _saveUINow(): void {
  if (ui.locked) return;
  const data: any = {
    theme: document.documentElement.dataset.theme, themePreview: ui.themePreview, scale: ui.scale,
    mmScale: ui.mmScale,
    view: ui.view,
    sidebarLeftCollapsed: ui.sidebarLeftCollapsed, sidebarRightCollapsed: ui.sidebarRightCollapsed,
    sidebarLeftWidth: ui.sidebarLeftWidth, sidebarRightWidth: ui.sidebarRightWidth,
    collapsedDocs: ui.collapsedDocs, navExpanded: ui.navExpanded,
    floatCal: ui.floatCal, pomoVisible: ui.pomoVisible, filesSort: ui.filesSort,
    collapsedPanels: ui.collapsedPanels, logCollapsed: ui.logCollapsed,
    dbView: ui.dbView,
    dbHiddenFields: ui.dbHiddenFields,
    dbSortsMap: ui.dbSortsMap, dbFiltersMap: ui.dbFiltersMap, dbSummary: ui.dbSummary,
    maxCalNodes: ui.maxCalNodes, calView: ui.calView, calTagFilter: ui.calTagFilter,
    tagActive: ui.tagActive || null,
    reminderEnabled: ui.reminderEnabled,
    autoBackupOnClose: ui.autoBackupOnClose, backupDir: ui.backupDir, backupDirWritable: !!ui.backupDirWritable,
    dnd: ui.dnd,
    modules: ui.modules,
    calModules: ui.calModules,
    selectedDate: ui.selectedDate,
    currentDocId: ui.currentDocId,
    uiVersion: 3,
  };
  if (ui.encrypted && ui.encKey) {
    const k = ui.encKey;
    try { localStorage.removeItem(UI_KEY); } catch (e) { /* 存储不可用：忽略（canonical 同款） */ }
    encryptState(data, k).then((payload: any) => {
      if (!(ui.encrypted && ui.encKey === k)) return;
      try { localStorage.setItem(UI_ENC_KEY, JSON.stringify(payload)); } catch (e) { /* 同上 */ }
    }).catch(() => { /* 加密失败：不落明文，保持静默（canonical 同款） */ });
    return;
  }
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(data));
    try { localStorage.removeItem(UI_ENC_KEY); } catch (e) { /* 同上 */ }
  } catch (e) { /* 配额/隐私模式：忽略 */ }
}

/** 基础字号（canonical 5986） */
function getBaseFontSize(): number {
  if (_baseFontSize) return _baseFontSize;
  const rootStyle = getComputedStyle(document.documentElement);
  _baseFontSize = parseFloat(rootStyle.getPropertyValue('--font-size')) || 14;
  return _baseFontSize;
}

/** 字号缩放（canonical 5992） */
export function applyScale(): void {
  const s = Math.max(0.7, Math.min(2, ui.scale || 1));
  ui.scale = s;
  const base = getBaseFontSize();
  document.documentElement.style.setProperty('--font-size', (base * s).toFixed(2) + 'px');
  document.documentElement.style.setProperty('--tg-hour-h', tgHourH() + 'px');
  const tb = document.getElementById('topbar');
  if (tb) document.documentElement.style.setProperty('--topbar-h', tb.offsetHeight + 'px');
  document.documentElement.style.setProperty('--ui-scale', s as any);
}

/** UI 字段回填（canonical 6032，字段与顺序逐项保留） */
export function applyUIFields(u: any): void {
  if (!u || typeof u !== 'object') return;
  if (u.theme) document.documentElement.dataset.theme = u.theme;
  if (u.theme === 'day' || u.theme === 'night') ui.theme = u.theme;
  ui.themePreview = (u.themePreview === 'day' || u.themePreview === 'night') ? u.themePreview : null;
  if (typeof u.scale === 'number') ui.scale = u.scale;
  if (typeof u.mmScale === 'number') ui.mmScale = u.mmScale;
  const S: any = getState();
  if (u.currentDocId && S && S.nodes && S.nodes[u.currentDocId]) ui.currentDocId = u.currentDocId;
  if (u.view === 'stats') ui.view = 'auto';
  else if (u.view && TOP_LEVEL_VIEWS.includes(u.view)) ui.view = u.view;
  else ui.view = 'auto';
  if (typeof u.sidebarLeftCollapsed === 'boolean') ui.sidebarLeftCollapsed = u.sidebarLeftCollapsed;
  if (typeof u.sidebarRightCollapsed === 'boolean') ui.sidebarRightCollapsed = u.sidebarRightCollapsed;
  if (typeof u.sidebarLeftWidth === 'number' && u.sidebarLeftWidth >= 140 && u.sidebarLeftWidth <= 480) ui.sidebarLeftWidth = u.sidebarLeftWidth;
  if (typeof u.sidebarRightWidth === 'number' && u.sidebarRightWidth >= 180 && u.sidebarRightWidth <= 340) ui.sidebarRightWidth = u.sidebarRightWidth;
  if (u.collapsedDocs) ui.collapsedDocs = u.collapsedDocs;
  const UI_VER = 3;
  if ((u.uiVersion || 1) < UI_VER) ui.navExpanded = { starred: false, files: false, database: false, tags: false };
  else if (u.navExpanded) ui.navExpanded = Object.assign({ starred: false, files: false, database: false, tags: false }, u.navExpanded);
  if (typeof u.floatCal === 'boolean') ui.floatCal = u.floatCal;
  if (typeof u.pomoVisible === 'boolean') ui.pomoVisible = u.pomoVisible;
  if (u.filesSort) ui.filesSort = u.filesSort;
  ui.collapsedPanels = Object.assign({ today: false, added: false, stats: false, note: false }, u.collapsedPanels || {});
  ui.logCollapsed = Object.assign({ add: false, mod: false, del: false }, u.logCollapsed || {});
  if (u.calModules && typeof u.calModules === 'object') {
    const _cm = u.calModules;
    ui.calModules = {
      order: Array.isArray(_cm.order) ? _cm.order.slice() : ['calendar', 'chars', 'note', 'today', 'log', 'stats'],
      hidden: (_cm.hidden && typeof _cm.hidden === 'object') ? _cm.hidden : {},
      sizes: (_cm.sizes && typeof _cm.sizes === 'object') ? _cm.sizes : {},
    };
    if (ui.calModules.order.indexOf('calendar') < 0) ui.calModules.order.unshift('calendar');
    if (ui.calModules.hidden.calendar) delete ui.calModules.hidden.calendar;
  }
  if (u.dbView) ui.dbView = u.dbView;
  if (u.dbHiddenFields) ui.dbHiddenFields = Object.assign({}, u.dbHiddenFields);
  if (u.dbSortsMap) ui.dbSortsMap = u.dbSortsMap;
  if (u.dbFiltersMap) ui.dbFiltersMap = u.dbFiltersMap;
  if (u.dbSummary) ui.dbSummary = u.dbSummary;
  if (u.maxCalNodes) ui.maxCalNodes = u.maxCalNodes;
  if (u.calView) ui.calView = u.calView;
  if (typeof u.calTagFilter === 'string') ui.calTagFilter = u.calTagFilter;
  if (typeof u.tagActive === 'string' || u.tagActive === null) ui.tagActive = u.tagActive;
  if (typeof u.reminderEnabled === 'boolean') ui.reminderEnabled = u.reminderEnabled;
  if (typeof u.autoBackupOnClose === 'boolean') ui.autoBackupOnClose = u.autoBackupOnClose;
  if (typeof u.backupDir === 'string') ui.backupDir = u.backupDir;
  if (typeof u.backupDirWritable === 'boolean') ui.backupDirWritable = u.backupDirWritable;
  if (u.dnd) ui.dnd = u.dnd;
  if (u.modules) ui.modules = u.modules;
  if (u.selectedDate) ui.selectedDate = u.selectedDate;
  if (typeof u.currentDocId === 'string') ui.currentDocId = u.currentDocId;
}

/** UI 恢复（canonical 6010） */
export function loadUI(): void {
  if (ui.desktopUiApplied) return;
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) { const u = JSON.parse(raw); applyUIFields(u); }
  } catch (e) { /* 损坏的 UI 快照：忽略并走默认态（canonical 同款） */ }
  applyScale();
}

/**
 * 【fix43-3 · ISSUE-003】加密态 UI 恢复：_saveUINow 在 ui.encrypted && ui.encKey 时只把 UI 快照
 * 写进 UI_ENC_KEY（juju.ui.enc），此前无任何读取方 ⇒ 刷新后主题 / 侧栏宽度 / 折叠态全部丢失。
 * 解密失败静默（不抛错打断 boot）；ui.encKey 未就绪（未解锁）保持原状，待 visible 重试。
 */
export async function loadUIEncrypted(): Promise<void> {
  let payload: any = null;
  try { const raw = localStorage.getItem(UI_ENC_KEY); if (raw) payload = JSON.parse(raw); } catch (e) { return; }
  if (!payload) return;
  const k = ui.encKey;
  if (!k) return; /* 未解锁：保持原状，待 visible 重试 */
  try { applyUIFields(await decryptState(payload, k)); } catch (e) { /* 解密失败：静默，不打断 boot */ }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · 导航（canonical: openNode 15601、safeNavigate 15594、setActiveKey 16197、
 *     updateSidebarActiveState 16201、renderIntro 16182）
 * ──────────────────────────────────────────────────────────────────────────── */

export function openNode(id: any): void {
  if (!id || !N(id)) return;
  safeNavigate(() => {
    ui.currentDocId = id;
    /* 【fix36-1】点具体节点即为「打开该节点」：视图态一律回落到 auto，由 viewOf(节点) 重新派生。
       否则 ui.view 会残留在列表态（'starred' / 'templates' / 'trash' / 'tags' …），
       点击星标 / 回收站等列表下的文档时，主区域仍被该列表占住、不显示正文。 */
    ui.view = 'auto';
    const n2: any = N(id);
    if (n2._isCalRoot) {
      ui.activeKey = 'nav:calendar';
      ui.selectedDate = todayStr();
      const _d = new Date();
      ui.calMonth = { y: _d.getFullYear(), m: _d.getMonth() };
    } else if (n2._isDbRoot) ui.activeKey = 'nav:database';
    else if (n2.dbRoot) { ui.activeKey = 'node:' + id; ui.navExpanded.database = true; }
    else ui.activeKey = 'node:' + id;
    saveUI();
  });
}

export function safeNavigate(fn: () => void): void {
  const ae: any = document.activeElement;
  if (ae && ae.blur) ae.blur();
  _forceRenderFlag = true;
  fn();
  forceRender();
}

export function setActiveKey(k: any): void {
  ui.activeKey = k || null;
  updateSidebarActiveState();
}

export function updateSidebarActiveState(): void {
  $$('.sb-nav-item, .sb-row').forEach((el) => el.classList.remove('active'));
  const k = ui.activeKey;
  $$('.sb-row[role="treeitem"]').forEach((el: any) => {
    const on = !!(k && k.startsWith('node:') && el.dataset.id === k.slice(5));
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  if (!k) return;
  if (k.startsWith('nav:')) {
    const btn = $(`.sb-nav-item[data-nav="${k.slice(4)}"]`);
    if (btn) btn.classList.add('active');
  } else if (k.startsWith('node:')) {
    const id = k.slice(5);
    $$(`.sb-row[data-id="${id}"]`).forEach((el) => el.classList.add('active'));
  } else if (k.startsWith('tag:')) {
    const t = k.slice(4);
    $$(`.sb-row[data-tag="${CSS.escape(t)}"]`).forEach((el) => el.classList.add('active'));
  }
  const _btnTpl = document.getElementById('btnTemplates'); if (_btnTpl) _btnTpl.classList.toggle('active', k === 'nav:templates');
  const _btnTrash = document.getElementById('btnTrash'); if (_btnTrash) _btnTrash.classList.toggle('active', k === 'nav:trash');
}

/** 节点计数（产品 `docNodeCount` 的等价实现：子树节点数，含自身） */
function docNodeCount(docId: any): number {
  const root = N(docId);
  if (!root) return 0;
  let n = 0;
  const stack: any[] = [root.id];
  const seen = new Set<any>();
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = N(id);
    if (!node) continue;
    n += 1;
    const kids: any[] = Array.isArray(node.children) ? node.children : [];
    for (const c of kids) stack.push(c);
  }
  return n;
}

/** 左侧栏文档信息（canonical 16182） */
export function renderIntro(): void {
  const doc = getCurrentDoc();
  const intro = $('#sbIntro'); if (!intro) return;
  if (!doc) { intro.innerHTML = `<div class="sb-intro-row"><span>标题</span><span class="v">未选择</span></div>`; return; }
  const fmtTs = (ts: any) => { const d = new Date(ts || Date.now()); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const isRoot = doc.id === state.rootId;
  intro.innerHTML = `
    <div class="sb-intro-row"><span>标题</span><span class="v">${esc(isRoot ? '我的文档' : (stripHtml(doc.text) || '未命名'))}</span></div>
    <div class="sb-intro-row"><span>创建</span><span class="v">${fmtTs(doc.createdAt)}</span></div>
    <div class="sb-intro-row"><span>编辑</span><span class="v">${fmtTs(doc.updatedAt)}</span></div>
    <div class="sb-intro-row"><span>字数</span><span class="v">${wordsOf(doc.id)}</span></div>
    <div class="sb-intro-row"><span>节点</span><span class="v">${docNodeCount(doc.id)}</span></div>`;
}

/** 侧栏 / 文件卡片右键菜单（canonical 16224） */
export function showTreeContext(e: MouseEvent, id: any): void {
  const n = N(id); if (!n) return;
  const items: any[] = [
    {
      ic: '✏️', txt: '重命名', fn: () => {
        appPrompt('重命名：', stripHtml(n.text), (t: any) => {
          if (t === null) return;
          commit((s: any) => { const nn = s.nodes[id]; if (!nn) return; nn.text = String(t).trim(); nn.updatedAt = nowSeq(); }, { snapshot: true, op: 'updateText', opArgs: { id } });
          renderSidebar(); if (ui.currentDocId === id) forceRender();
        });
      },
    },
    {
      ic: '⭐', txt: '星标', fn: () => {
        const cur = n.starred || 0;
        const level = cur >= 5 ? 0 : cur + 1;
        actions.setStar(id, level);
        renderSidebar(); forceRender();
      },
    },
  ];
  if (_mSel.type === 'sidebar' && _mSel.ids.size > 1 && _mSel.ids.has(id)) {
    items.unshift({ sep: true });
    items.unshift({
      ic: '🗑', txt: '移入回收站（所选 ' + _mSel.ids.size + ' 个）', danger: true, fn: () => {
        const targets = Array.from(_mSel.ids).filter((x: any) => { const t = N(x); return !!(t && !t._deleted && x !== state.rootId && !t._isCalRoot && !t._isDbRoot); });
        if (!targets.length) return;
        appConfirm('将所选 ' + targets.length + ' 项移入回收站？', () => {
          targets.forEach((x: any) => { const t = N(x); if (!t || t._deleted) return; actions.moveToTrash(x); });
          _mSel.ids = new Set(); _mSel.anchorId = null; _mSel.mode = 'single';
          renderSidebar(); forceRender(); toast('已移入回收站');
        });
      },
    });
  }
  items.push({ sep: true });
  items.push({ ic: '🗑', txt: '移入回收站', danger: true, fn: () => { actions.moveToTrash(id); if (ui.currentDocId === id) ui.currentDocId = null; renderSidebar(); forceRender(); toast('已移入回收站'); } });
  showContextMenu(items, e);
}


/* ────────────────────────────────────────────────────────────────────────────
 * 6 · 侧栏计数 / 标签索引（canonical: _sideCountsGet 3159、_sidebarFingerprint 15832、
 *     _l7TagCountText 4865、l7TagIndexWhenReady 4846、buildTagIndex 18098、
 *     _tagScanStep 18065、getTagColor 17990、openTagPalette 18033）
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 增量计数端口（产品以 Symbol 键把计数缓存在 state 上；本工程未迁移 produce 侧计数器，
 * 故此处返回 `undefined`，令 renderSidebar 走 canonical 的**全量扫描分支**——语义与产品件
 * 在计数缺失时的降级路径一致，且不引入可能过期的缓存。
 */
export function sideCountsGet(_s: any): any {
  return undefined;
}

/** L14 分片协同扫描开关（canonical `__l14On`：默认关闭） */
export function l14On(): boolean { return false; }

/** L14 侧栏分片扫描结果容器 + 一次性扫描（仅当 l14On() 为 true 时被 renderSidebar 使用） */
export const l14SideScan: any = { starred: 0, docCount: 0, dbRoot: null };
export function l14SideScanEnsure(): void {
  const S: any = getState();
  if (!S || !S.nodes) return;
  const root = S.nodes[S.rootId];
  const rootChildSet = new Set(root ? root.children : []);
  let starred = 0, docCount = 0; let dbRoot: any = null;
  for (const id in S.nodes) {
    const n = S.nodes[id];
    if (!n || n._deleted || n.id === S.rootId) continue;
    if (n.starred > 0 && !n._isFolder && !n._isDbRoot && !n._isCalRoot) starred++;
    if (rootChildSet.has(id)) { if (n._isDbRoot) dbRoot = n; else if (!n._isCalRoot) docCount++; }
  }
  l14SideScan.starred = starred; l14SideScan.docCount = docCount; l14SideScan.dbRoot = dbRoot;
}

/** 标签索引缓存（产品模块级 `let _tagIndexCache`，跨模块以可写容器承接） */
export const tagIndexCache: { value: Map<string, Set<any>> | null } = { value: null };
export function getTagIndexCache(): Map<string, Set<any>> | null { return tagIndexCache.value; }
/**
 * 写入索引缓存并同步给侧栏依赖容器。
 * 侧栏 `renderSubTags` / `promptNewTag` 读的是 `deps.tagIndexCache`（bindSidebarDeps 为值拷贝），
 * 缓存每次变更都必须同步到该端口，否则侧栏标签树永远停留在骨架占位。
 */
export function setTagIndexCache(v: Map<string, Set<any>> | null): void {
  tagIndexCache.value = v;
  sidebarDeps.tagIndexCache = v;
}

/**
 * 【P0 · 新建/重命名/删除标签后界面不实时显示】标签索引失效的唯一正确入口。
 *
 * 侧栏 `promptNewTag` / `renameTag` / `removeTag` 原先直接写 `deps.tagIndexCache=null`，
 * 那只是 `bindSidebarDeps` 值拷贝出来的**副本**：真实缓存 `tagIndexCache.value` 仍是旧的，
 * 于是随后的 `buildTagIndex()` 命中旧 Map（新标签不在其中），标签树行与 `#cntTags` 计数都不变，
 * 表现为「新建标签后侧栏没反应」。此处同时清真实缓存与侧栏副本（经 setTagIndexCache 单一出口同步）。
 */
export function invalidateTagIndex(): void {
  setTagIndexCache(null);
}

/** 标签扫描分片（canonical 18065） */
function _tagScanStep(ids: string[], i: number, deadline: number, map: Map<string, Set<any>>): number {
  while (i < ids.length) {
    const id = ids[i]; i++;
    const n = state.nodes[id];
    if (n && !n._deleted && !n._isFolder) {
      const raw = stripHtml(n.text || '');
      const seen = new Set<string>();
      let m: RegExpExecArray | null;
      TAG_RE.lastIndex = 0;
      while ((m = TAG_RE.exec(raw)) !== null) {
        const t = m[1].slice(1);
        if (!t) continue;
        seen.add(t);
        if (!map.has(t)) map.set(t, new Set());
        (map.get(t) as Set<any>).add(id);
      }
      if (Array.isArray(n.tags) && n.tags.length) {
        for (const t of n.tags) {
          if (!t || seen.has(t)) continue;
          if (!(Array.isArray(n._manualTags) && n._manualTags.includes(t))) continue;
          seen.add(t);
          if (!map.has(t)) map.set(t, new Set());
          (map.get(t) as Set<any>).add(id);
        }
      }
    }
    if (Date.now() >= deadline) break;
  }
  return i;
}

/** 标签索引构建（canonical 18098） */
export function buildTagIndex(): Map<string, Set<any>> {
  if (tagIndexCache.value) return tagIndexCache.value;
  const map = new Map<string, Set<any>>();
  const ids = Object.keys(state.nodes);
  let i = 0;
  while (i < ids.length) i = _tagScanStep(ids, i, Infinity, map);
  /* 【fix5 · P1】合并全局标签索引 state._tags：
     新建标签只登记在注册表、不写任何节点，索引必须把「空标签」(Set 为空) 也纳入，
     侧栏标签列表才显示得出来（计数为 0）。去重：已在节点扫描中出现的标签保持其 Set。 */
  for (const t of (Array.isArray(state._tags) ? state._tags : [])) {
    if (!t || map.has(t)) continue;
    map.set(t, new Set());
  }
  setTagIndexCache(map);
  return map;
}

/** 标签索引就绪回调（canonical 4846：异步构建 → 完成后回调，失败回落同步构建） */
export function l7TagIndexWhenReady(cb?: () => void): void {
  Promise.resolve().then(() => { buildTagIndex(); }).then(
    () => { if (cb) cb(); },
    () => { try { if (!tagIndexCache.value) buildTagIndex(); } catch (_e) { /* 构建失败：保持空索引 */ } if (cb) cb(); },
  );
}

/** L7 标签骨架样式（canonical `_l7SkeletonEnsureCss`：规则已外提至 src/style.css，函数与调用点保留为空壳） */
export function l7SkeletonEnsureCss(): void {
  /* 【fix32-8】`.ju-skel-hint` 规则已迁入 src/style.css，运行期不再创建 <style>（严格 CSP）。 */
}

/** 标签计数文案（canonical 4865：冷缓存返回 '…' 并后台构建） */
export function l7TagCountText(): string {
  if (tagIndexCache.value) return String(tagIndexCache.value.size);
  if ((l7TagCountText as any)._pending) return '…';
  (l7TagCountText as any)._pending = true;
  const elP = $('#cntTags');
  if (elP) elP.title = '标签索引构建中';
  l7TagIndexWhenReady(() => {
    (l7TagCountText as any)._pending = false;
    const el = $('#cntTags');
    if (el && tagIndexCache.value) el.textContent = String(tagIndexCache.value.size);
    else if (el) el.textContent = '?';
    if (el) el.removeAttribute('title');
    try { renderSubTags(); } catch (_e) { /* 侧栏已被卸载：忽略 */ }
  });
  return '…';
}

/** 侧栏指纹（canonical 15832） */
export function sidebarFingerprint(): string {
  return [
    (state._structRev | 0),
    ui.navExpanded ? JSON.stringify(ui.navExpanded) : '{}',
    ui.filesSort || '',
    state.tagColors ? JSON.stringify(state.tagColors) : '{}',
    Object.keys(ui.collapsedDocs || {}).filter((k) => ui.collapsedDocs[k]).sort().join(','),
  ].join('|');
}

/* 主题色读取（canonical 1382/1383 `_themeColor` / `_themeList`） */
export function _themeColor(name: string, fallback?: string): string {
  try {
    const s = String(getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim();
    return s || (fallback == null ? '' : fallback);
  } catch (e) { return fallback == null ? '' : fallback; }
}
export function _themeList(name: string, fallback?: string[]): string[] {
  try {
    const s = _themeColor(name, '');
    if (!s) return fallback || [];
    const a = s.split(/\s+/).filter(Boolean);
    return a.length ? a : (fallback || []);
  } catch (e) { return fallback || []; }
}
/**
 * P0-T3 · 主题端口对外别名（供 `inject*Deps` 的 `themeColor` / `themeList` 注入）。
 * 与编辑器的 `deps.themeColor('--cp-custom-alt','')` / `deps.themeList('--color-palette',[])`
 * 一一对应：真实读取 `<html>` 上的 CSS 自定义属性，不再使用「返回 fallback」的空壳。
 */
export const themeColor = _themeColor;
export const themeList = _themeList;

/** 短日期（canonical 6758 `fmtDateShort`）：大纲行右侧 `mtime-tag` 的时间口径 */
export function fmtDateShort(ts: any): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
}

let _tagColorsCache: string[] | null = null;
function getTagColors(): string[] { if (_tagColorsCache) return _tagColorsCache; _tagColorsCache = _themeList('--tag-palette', []); return _tagColorsCache; }

/** 标签颜色（canonical 17990：显式配色优先，否则按名称哈希落调色板） */
export function getTagColor(t: any): string {
  const key = String(t || '');
  const c = state.tagColors && state.tagColors[key];
  if (c) return c;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const tc = getTagColors();
  return tc.length ? tc[h % tc.length] : _themeColor('--tag-fallback', '');
}

/** 浮层定位（canonical 6750 `placePop`） */
export function placePop(el: HTMLElement, W: number, H: number, anchor: any): void {
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = el.offsetWidth || W, h = el.offsetHeight || H;
  let ax: number | null = null, ay: number | null = null, ah = 0;
  if (anchor && anchor.getBoundingClientRect) { const r = anchor.getBoundingClientRect(); ax = r.left; ay = r.top; ah = r.height || 0; }
  else if (anchor && typeof anchor === 'object' && ('left' in anchor)) { ax = anchor.left; ay = anchor.top || 0; ah = (anchor.bottom != null && anchor.top != null) ? (anchor.bottom - anchor.top) : 0; }
  else if (_win._popAnchor) { ax = _win._popAnchor.x; ay = _win._popAnchor.y; }
  let left: number, top: number;
  if (ax == null || ay == null) { left = Math.max(8, (vw - w) / 2); top = Math.max(8, vh * 0.2); }
  else {
    left = Math.max(8, Math.min(ax, vw - w - 8));
    top = ay + ah + 4;
    if (top + h > vh - 8 && ay - h - 4 > 8) top = ay - h - 4;
    top = Math.max(8, Math.min(top, vh - 8));
  }
  el.style.left = left + 'px'; el.style.top = top + 'px';
}

let _tagPaletteEl: HTMLElement | null = null;
let _tagPaletteDocMousedown: ((e: any) => void) | null = null;

function closeTagPalette(): void {
  if (_tagPaletteEl) { _tagPaletteEl.remove(); _tagPaletteEl = null; }
  if (_tagPaletteDocMousedown) { document.removeEventListener('mousedown', _tagPaletteDocMousedown); _tagPaletteDocMousedown = null; }
}

function setTagColor(t: string, color: string): void {
  if (ui.locked) { toast('请先解锁'); return; }
  try {
    commit((s: any) => { if (!s.tagColors) s.tagColors = {}; s.tagColors[t] = color; }, { snapshot: true });
  } catch (e) {
    console.error('[JU] setTagColor commit', e);
    toast('颜色设置失败');
    return;
  }
  /* 【P0 同口径】先渲染后落盘：标签颜色属侧栏可见变更，落盘异常不得阻断 UI 更新 */
  try { renderSidebar(); } catch (e) { console.error('[JU] setTagColor sidebar', e); }
  try { forceRender(); } catch (e) { console.error('[JU] setTagColor render', e); }
  try { persistNow(); } catch (e) { console.error('[JU] setTagColor persist', e); }
  toast('已设置 #' + t + ' 颜色');
}

/** 标签调色板（canonical 18033 `openTagPalette`；产品 `openTag` 同址别名） */
export function openTagPalette(anchor: any, t: string): void {
  closeTagPalette();
  const p = document.createElement('div'); p.className = 'tag-palette';
  p.addEventListener('mousedown', (e) => e.stopPropagation());
  getTagColors().forEach((c) => {
    const s = document.createElement('div'); s.className = 'sw';
    /* v2.1 fix4 · P2：色块底色/描边改由 .tag-palette .sw 类按 --tag-color 计算（淡色 alpha 32% + 实色描边），
       这里只注入 --tag-color（与侧栏 .sb-tag-dot 同一注入方式），不再内联写 background 实色。 */
    s.style.setProperty('--tag-color', c);
    s.dataset.c = c;
    s.title = c;
    if (getTagColor(t) === c) s.classList.add('cur');
    s.addEventListener('mousedown', (e) => { e.stopPropagation(); closeTagPalette(); setTagColor(t, c); });
    p.appendChild(s);
  });
  const auto = document.createElement('div'); auto.className = 'sw'; auto.title = '恢复自动颜色';
  auto.style.background = _themeColor('--tag-auto-gradient', '');
  auto.addEventListener('mousedown', (e) => {
    e.stopPropagation(); closeTagPalette();
    commit((s: any) => { if (s.tagColors) delete s.tagColors[t]; }, { snapshot: true });
    renderSidebar(); forceRender();
  });
  p.appendChild(auto);
  document.body.appendChild(p);
  placePop(p, 172, 64, anchor);
  initDragClose(p, () => closeTagPalette());
  _tagPaletteEl = p;
  setTimeout(() => {
    if (!p.isConnected) return;
    const close = (e: any) => { if (!p.contains(e.target) && !anchor.contains(e.target)) closeTagPalette(); };
    _tagPaletteDocMousedown = close;
    document.addEventListener('mousedown', close);
  }, 0);
}

/** 打开标签筛选视图（canonical `openTag(t)`：切换 tags 视图并定位到该标签） */
export function openTag(t: any): void {
  ui.view = 'tags';
  ui.tagActive = String(t || '') || null;
  ui.activeKey = 'tag:' + String(t || '');
  saveUI();
  forceRender();
}

/* ────────────────────────────────────────────────────────────────────────────
 * 7 · 顶栏 / 时钟 / 提醒角标 / 悬浮日历（canonical: syncTopbar 15622、
 *     tickClock 21441、updateRemindBadge 16873、floatCalVisible 20756、
 *     setFloatCalVisible 20760、ensureElInViewport 18478）
 * ──────────────────────────────────────────────────────────────────────────── */

export function syncTopbar(): void {
  const curDoc = getCurrentDoc();
  const curView = ui.view === 'auto' ? viewOf(curDoc) : ui.view;
  $$('.tb-nav-btn').forEach((b: any) => {
    const v = b.dataset.view;
    let active = false;
    if (v === 'document') active = ui.view === 'auto' && [VIEW_KIND.LIBRARY_ROOT, VIEW_KIND.FOLDER, VIEW_KIND.DATABASE].includes(curView as any);
    else if (v === 'outline') active = ui.view === 'outline' || (ui.view === 'auto' && curView === VIEW_KIND.OUTLINE);
    else active = ui.view === v;
    b.classList.toggle('active', active);
    const _cv0 = curDoc ? viewOf(curDoc) : null;
    const _isContainer = _cv0 === VIEW_KIND.LIBRARY_ROOT || _cv0 === VIEW_KIND.FOLDER || _cv0 === VIEW_KIND.CALENDAR;
    /* 【fix25·fix26-p1】「资料库」只切渲染模式、从不跳转文档：选中文档时，ui.view=auto 与 ui.view=outline
       渲染的是同一个大纲页（viewOf(doc)=OUTLINE），两种态下点击都恒为 no-op
       ⇒ 与日历视图下「大纲」完全同一 disabled 口径置灰（仅视觉，onclick 行为与视图状态零变更） */
    const _isLibView = _cv0 === VIEW_KIND.LIBRARY_ROOT || _cv0 === VIEW_KIND.FOLDER || _cv0 === VIEW_KIND.DATABASE;
    /* 【fix26-p2】非资料库视图（大纲 / 导图 / 演示 / 幻灯片 / 图谱 / 历史）下「资料库」点击恒为 no-op：
       统一复用日历视图「大纲」的 disabled 灰（pointer-events:none 物理不可点），视图状态零变更 */
    const _docNoop = !!curDoc && !_isLibView && (ui.view === 'auto' || ui.view === 'outline' || ui.view === 'mindmap' || ui.view === 'presentation' || ui.view === 'slides' || ui.view === 'graph' || ui.view === 'history');
    const _lock = v === 'document'
      ? _docNoop
      : ((v === 'outline' || v === 'mindmap' || v === 'presentation' || v === 'slides' || v === 'graph' || v === 'history') && _isContainer);
    b.classList.toggle('disabled', !!_lock);
  });
}

export function tickClock(): void {
  const d = new Date();
  const el = $('#tbClock');
  if (el) el.textContent = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function updateRemindBadge(): void {
  const badge = $('#remindBadge'); if (!badge) return;
  let count = 0;
  try { count = calendarTodosOnDate(todayStr()).filter((n: any) => !n.done && !isBlankNode(n)).length; } catch (e) { count = 0; }
  badge.hidden = count === 0;
  badge.textContent = count > 99 ? '99+' : String(count);
}

export function floatCalVisible(): boolean {
  try { const m = ui.modules && ui.modules.floats && ui.modules.floats.floatCal; if (m) return !!m.visible; } catch (e) { /* 模块浮动配置缺失：回落 ui.floatCal */ }
  return !!ui.floatCal;
}

/**
 * 悬浮迷你日历渲染（canonical 18583 `renderFloatCal`）
 *
 * 缺陷背景：`setFloatCalVisible()` 只切换 `#floatCal` 的 hidden 属性，
 * 却从未调用本函数（canonical 20781 在显示后立即 `renderFloatCal()`），
 * 且本文件迁入时完全没有该函数 ⇒ 点「悬浮日历」浮层出现但 `#fcDays` 恒为空、
 * 标题停留在骨架静态文案「2026年1月」，用户观感即「点了没反应」。
 *
 * 逐行对齐 canonical：月视图 42 格、今日高亮、有待办的日期加 `has`、点击选日期、
 * 底部列出当日待办（前 10 条，可勾选完成）。
 */
export function renderFloatCal(): void {
  const fc = $('#floatCal'); if (!fc || (fc as any).hidden) return;
  const now = new Date();
  if (!ui.fcMonth) ui.fcMonth = { y: now.getFullYear(), m: now.getMonth() };
  const { y, m } = ui.fcMonth;
  const ts = todayStr();
  const title = $('#fcTitle'); if (title) title.textContent = `${y}年${m + 1}月`;
  const days = $('#fcDays'); if (!days) return;
  days.innerHTML = '';
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const pdim = new Date(y, m, 0).getDate();
  const total = Math.ceil((startDow + dim) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const off = i - startDow + 1;
    let d: Date; let out = false;
    if (off < 1) { d = new Date(y, m - 1, pdim + off); out = true; }
    else if (off > dim) { d = new Date(y, m + 1, off - dim); out = true; }
    else d = new Date(y, m, off);
    const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const el = document.createElement('div'); el.className = 'fc-day';
    if (out) el.classList.add('out');
    if (ds === ts) el.classList.add('today');
    /* 【fix26】圆点按数据收口：当日待办为空（含仅有空白节点）时不置 has、不产出 .fc-dot DOM */
    const dayTodos = calendarTodosOnDate(ds);
    const hasTodo = dayTodos.some((n: any) => !isBlankNode(n));
    if (hasTodo) el.classList.add('has');
    el.textContent = String(d.getDate()); el.title = ds;
    if (hasTodo) { const dot = document.createElement('i'); dot.className = 'fc-dot'; el.appendChild(dot); }
    el.onclick = () => {
      ui.selectedDate = ds;
      const dObj = parseYmd(ds);
      ui.fcMonth = { y: dObj.getFullYear(), m: dObj.getMonth() };
      saveUI();
      renderFloatCal();
      const cur = getCurrentDoc();
      if (cur && viewOf(cur) === VIEW_KIND.CALENDAR) forceRender();
    };
    days.appendChild(el);
  }
  const list = $('#fcList'); if (!list) return;
  list.innerHTML = '';
  const showDate = ui.selectedDate || ts;
  const items = calendarTodosOnDate(showDate).filter((n: any) => !isBlankNode(n) || ui.focusId === n.id);
  if (!items.length) { list.innerHTML = '<div class="fc-empty">当日暂无待办</div>'; }
  else {
    items.slice(0, 10).forEach((n: any) => {
      const row = document.createElement('div'); row.className = 'fc-todo' + (n.done ? ' done' : '');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!n.done;
      cb.onchange = () => { actions.toggleDone(n.id); renderFloatCal(); forceRender(); };
      const sp = document.createElement('span'); sp.textContent = stripHtml(n.text) || '(空)';
      row.appendChild(cb); row.appendChild(sp);
      list.appendChild(row);
    });
  }
}

export function setFloatCalVisible(v: boolean, silent?: boolean): void {
  v = !!v; ui.floatCal = v;
  try { const m = ui.modules && ui.modules.floats && ui.modules.floats.floatCal; if (m) { m.visible = v; if (!v) m.pinned = false; } } catch (e) { /* 同上 */ }
  saveUI();
  try { if (_win.JU_MODULES && _win.JU_MODULES.apply) _win.JU_MODULES.apply(); } catch (e) { /* 遗留模块未加载：忽略（canonical 同款） */ }
  const fc = $('#floatCal'); if (fc) fc.hidden = !v;
  const b = $('#btnFloatCal'); if (b) b.classList.toggle('on', v);
  /* canonical 20781：显示后立即 ensureElInViewport + renderFloatCal（此前缺失 ⇒ 浮层空壳） */
  if (v && fc) {
    try { ensureElInViewport(fc); } catch (e) { /* 定位失败：保持默认位置 */ }
    try { renderFloatCal(); } catch (e) { console.warn('[JU] renderFloatCal failed', e); }
  }
  if (!silent) { try { toast(v ? '悬浮日历已开启' : '悬浮日历已关闭'); } catch (e) { /* 无 toast 容器：忽略 */ } }
}

export function ensureElInViewport(el: any): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const vw = window.innerWidth, vh = window.innerHeight;
  if (cx < 0 || cx > vw || cy < 0 || cy > vh) {
    el.style.left = 'auto'; el.style.top = 'auto'; el.style.bottom = 'auto';
    if (el.id === 'floatCal') { el.style.right = '24px'; el.style.top = 'calc(var(--topbar-h,48px) + 24px)'; }
    else if (el.id === 'pomoTimer') { el.style.left = 'calc(var(--sidebar-left-w) + 20px)'; el.style.right = 'auto'; el.style.bottom = '20px'; }
    else if (el.id === 'settingsPanel') { el.style.left = 'calc(var(--sidebar-left-w) + 20px)'; el.style.right = 'auto'; el.style.bottom = '20px'; el.style.top = 'auto'; }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 8 · 侧栏绑定（canonical 16301 `bindSidebar`）与工具栏绑定（canonical 21422 `bindTools`）
 * ──────────────────────────────────────────────────────────────────────────── */

export function bindSidebar(): void {
  try { if (_win.JU_MODULES && _win.JU_MODULES.ensureDom) _win.JU_MODULES.ensureDom(); } catch (e) { console.warn('[JU] caught error', e); }
  try { if (_win.JU_MODULES && _win.JU_MODULES.bindContextMenus) _win.JU_MODULES.bindContextMenus(); } catch (e) { console.warn('[JU] caught error', e); }
  $$('.sb-nav-item').forEach((b: any) => {
    const nav = b.dataset.nav;
    bindClick(b, () => navTo(nav));
    const chev = b.querySelector('.chev');
    if (chev) {
      bindClick(chev, (e: Event) => {
        e.stopPropagation();
        if (nav === 'starred' || nav === 'files' || nav === 'database' || nav === 'tags') {
          ui.navExpanded[nav] = !ui.navExpanded[nav]; saveUI(); renderSidebar();
        } else navTo(nav);
      });
    }
  });
  /* 【D-07 按钮事件健壮性】下列按钮统一改 bindClick（addEventListener）：
     · 旧写法 `el.onclick = fn` 是**属性赋值**，任何后续赋值 / 重渲染都会把它冲掉，
       用户侧表现即「点了没反应」；
     · 浮窗类（btnFloatCal / btnMusic）另加按压兜底（旧内核无 PointerEvent 时降级 mousedown）。 */
  bindClick($('#btnNewDoc'), (e: Event) => {
    e.stopPropagation();
    appPrompt('新文档名称：', '新建文档', (name: any) => {
      if (name === null) return;
      const id = actions.createDoc((String(name || '新建文档')).trim() || '新建文档');
      ui.currentDocId = id; ui.view = 'auto'; saveUI();
      renderSidebar(); forceRender();
      toast('已创建文档');
    });
  });
  bindClick($('#btnNewFolder'), (e: Event) => {
    e.stopPropagation();
    appPrompt('新文件夹名称：', '新建文件夹', (name: any) => {
      if (name === null) return;
      actions.createDoc((String(name || '新建文件夹')).trim() || '新建文件夹', { _isFolder: true } as any);
      renderSidebar(); forceRender();
      toast('已创建文件夹');
    });
  });
  bindClick($('#btnNewDb'), (e: Event) => {
    e.stopPropagation();
    appPrompt('新多维表格名称：', '新建表格', (name: any) => {
      if (name === null) return;
      let dbRootId: any = null;
      for (const id in state.nodes) { if (state.nodes[id]._isDbRoot) { dbRootId = id; break; } }
      if (!dbRootId) dbRootId = actions.createDoc('数据库', { _isDbRoot: true, _isFolder: true, dbRoot: true } as any);
      if (!dbRootId) { toast('创建失败'); return; }
      const id = actions.addNode(dbRootId, null, { text: (String(name || '新建表格')).trim() || '新建表格', dbRoot: true } as any);
      if (!id) { toast('创建失败'); return; }
      /* v2.1 fix9 · P1：新建表格直接套用 v2.0-t3 内置默认模板（10 列表头 + 3 行空白）。
         此前只 addDbRow 一行「新条目」且 state.dbFields 缺失 ⇒ 建出来是「单列标题 + 1 行」半成品表。 */
      actions.applyDbTemplate(id);
      ui.currentDocId = id; ui.view = 'auto'; saveUI();
      ui.navExpanded.database = true; saveUI();
      renderSidebar(); forceRender();
      toast('已创建多维表格');
    });
  });
  bindClick($('#btnTemplates'), (e: Event) => { e.stopPropagation(); ui.view = 'templates'; ui.activeKey = 'nav:templates'; saveUI(); renderMain(); });
  bindClick($('#btnTrash'), (e: Event) => { e.stopPropagation(); ui.view = 'trash'; ui.activeKey = 'nav:trash'; saveUI(); renderMain(); });
  bindClick($('#sortBtn'), (e: Event) => {
    e.stopPropagation();
    const order = ['name', 'type', 'created', 'updated', 'star'];
    const cur = ui.filesSort || 'name';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    ui.filesSort = next; saveUI(); renderSidebar(); forceRender();
    const names: any = { name: '按名称', type: '按类型', created: '按创建时间', updated: '按修改时间', star: '按星标等级' };
    toast('排序：' + names[next]);
  });
  const searchInput = $('#searchInput') as HTMLInputElement | null;
  if (searchInput) {
    let searchTimer: any = null;
    searchInput.oninput = (e: any) => {
      clearTimeout(searchTimer);
      const q = String(e.target.value || '').trim().toLowerCase();
      searchTimer = setTimeout(() => doSearch(q), 150);
    };
  }
}

/** 全库搜索（canonical 16372 `doSearch`） */
export function doSearch(q: string): void {
  const content = $('#content'); if (!content) return;
  if (!q) { forceRender(); return; }
  const terms = q.split(/\s+/).filter(Boolean).map((t) => t.toLowerCase());
  content.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'files-wrap';
  wrap.innerHTML = `<div style="font-size:1.05em;font-weight:700;margin-bottom:14px">搜索结果：${esc(q)}</div>`;
  const list = document.createElement('div'); list.style.cssText = 'display:flex;flex-direction:column;gap:4px';
  let found = 0;
  const LIMIT = 200;
  for (const id in state.nodes) {
    if (found >= LIMIT) break;
    const n = state.nodes[id];
    if (n._deleted || id === state.rootId) continue;
    if (n._isDbRoot) continue;
    if (n._isCalRoot || n._isNoteRoot || n._isFolder) continue;
    {
      let anc = n.parent, inNote = false;
      while (anc && anc !== state.rootId) { const an = N(anc); if (!an) break; if (an._isNoteRoot) { inNote = true; break; } anc = an.parent; }
      if (inNote) continue;
    }
    const hay = (stripHtml(n.text || '') + ' ' + (n.note || '') + ' ' + (Array.isArray(n.tags) ? n.tags.join(' ') : '')).toLowerCase();
    if (terms.every((t) => hay.includes(t))) {
      found++;
      const row = document.createElement('div'); row.className = 'cal-row';
      row.innerHTML = `<span class="bullet"></span><span class="text">${esc(stripHtml(n.text || ''))}</span>`;
      row.onclick = () => openNode(n.id);
      list.appendChild(row);
    }
  }
  wrap.appendChild(list);
  if (!found) { const e2 = document.createElement('div'); e2.className = 'empty-state'; e2.textContent = '未找到结果'; wrap.appendChild(e2); }
  else if (found >= LIMIT) { const m = document.createElement('div'); m.style.cssText = 'text-align:center;color:var(--fg-dim);font-size:.78em;padding:6px'; m.textContent = '仅显示前 ' + LIMIT + ' 条'; wrap.appendChild(m); }
  content.appendChild(wrap);
}

/**
 * 工具栏绑定（canonical 21422 `bindTools`）
 * 说明：`#btnSettings` 的开启逻辑已由 ui/layout 的 `bindSettingsPanel()` 承担（模块化拆分后
 * 的设置面板单一入口），此处不再重复绑定，避免与 bindSettings 段的处理器互相覆盖。
 */
export function bindTools(): void {
  /* 【D-07】统一 bindClick；btnImport / btnTheme / btnMusic / btnFloatCal 属「浮窗类入口」，
     额外挂按压兜底（见 ui/common.bindPressFallback：仅在 click 未派发时才补执行）。 */
  bindClick($('#btnImport'), () => { try { _win.JU && _win.JU.openImportDialog && _win.JU.openImportDialog(); } catch (e) { console.warn('[JU] caught error', e); } }, { pressFallback: true });
  bindFileDropImport();
  bindTauriFileDropFallback();
  bindClick($('#btnTheme'), () => { try { _win.JU && _win.JU.openThemeSelector && _win.JU.openThemeSelector(); } catch (e) { console.warn('[JU] caught error', e); } }, { pressFallback: true });
  bindClick($('#btnMusic'), () => {
    const pt = $('#pomoTimer'); if (!pt) return;
    const show = pt.hidden;
    ui.pomoVisible = show;
    if (ui.modules && ui.modules.floats && ui.modules.floats.pomoTimer) { ui.modules.floats.pomoTimer.visible = show; if (!show) ui.modules.floats.pomoTimer.pinned = false; }
    saveUI();
    try { if (_win.JU_MODULES && _win.JU_MODULES.apply) _win.JU_MODULES.apply(); } catch (e) { /* 遗留模块未加载：忽略 */ }
    /* 【修复】canonical 21431 依赖 `JU_MODULES.apply()` 落地显隐；本工程未加载该遗留模块，
       apply 恒不进 ⇒ `#pomoTimer` 的 display 永不改写，点番茄钟「毫无反应」。
       此处补直接落显隐（JU_MODULES 存在时写入同值，幂等无副作用）。 */
    pt.hidden = !show;
    if (show) { ensureElInViewport(pt); }
  }, { pressFallback: true });
  const bfc = $('#btnFloatCal');
  if (bfc) {
    bfc.classList.toggle('on', floatCalVisible());
    bindClick(bfc, () => { setFloatCalVisible(!floatCalVisible()); }, { pressFallback: true });
  }
}

/**
 * 拖拽导入（窗口级）。
 *
 * 缺陷背景：canonical 只在导入弹窗内的 `#impDrop` 上绑 drop，迁移后同样如此 ⇒
 * 把文件直接拖到窗口任意位置（侧栏 / 正文 / 空白处）浏览器默认行为是「导航到该文件」，
 * 页面被文件内容替换，表现为「拖拽导入没反应（甚至整页被顶掉）」。
 *
 * 口径：
 *   - 仅接管 `dataTransfer.types` 含 `Files` 的拖放；文本 / 节点拖拽完全不受影响；
 *   - `#impDrop` 自身处理器优先（命中即放行，避免二次导入）；
 *   - contenteditable 内拖入文件不接管（交给编辑器的粘贴/拖放语义）；
 *   - 命中后调用已发布的 `JU.handleImportFiles(files)`（与弹窗路径同一实现）。
 */
export function bindFileDropImport(): void {
  if (typeof window === 'undefined') return;
  if ((window as any)._juFileDropBound) return;
  (window as any)._juFileDropBound = true;
  const hasFiles = (e: any): boolean => {
    const dt = e && e.dataTransfer;
    if (!dt || !dt.types) return false;
    return Array.prototype.indexOf.call(dt.types, 'Files') !== -1;
  };
  window.addEventListener('dragover', (e: any) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'copy'; } catch (err) { /* 只读 dt：忽略 */ }
  }, false);
  window.addEventListener('drop', (e: any) => {
    if (!hasFiles(e)) return;
    const t = e.target as HTMLElement | null;
    if (t && t.closest && (t.closest('#impDrop') || t.closest('[contenteditable]'))) return;
    e.preventDefault();
    const files: any[] = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (!files.length) return;
    const j: any = _win.JU;
    if (!j || typeof j.handleImportFiles !== 'function') return;
    try {
      Promise.resolve(j.handleImportFiles(files)).catch((err: any) => console.warn('[JU] drop import failed', err));
    } catch (err) { console.warn('[JU] drop import failed', err); }
  }, false);
}

/**
 * 桌面版（Tauri / WebView2）文件拖入兜底通道。
 *
 * 为什么还需要这一条：
 *   Tauri v1 的窗口配置 `fileDropEnabled` 默认为 true —— wry 会在原生窗口上
 *   `RevokeDragDrop` 掉 WebView2 自己的 IDropTarget，改由 Tauri 接管；
 *   后果是网页侧 **收不到 HTML5 `drop` 事件**（拿到的是只有路径字符串的
 *   `tauri://file-drop` 事件），于是 `#impDrop` / 窗口级 drop 全部不触发 ——
 *   浏览器里拖拽导入正常、桌面版「拖了没反应」的根因就在这里。
 *
 * 仅启用主通道：`tauri.conf.json` 的窗口置 `fileDropEnabled: false`，把拖放交还
 * WebView2，走上面的 HTML5 通道（首选，与浏览器行为一致）。
 * `tauri://file-drop` 兜底依赖 `__TAURI__.fs` 读二进制接口，但 allowlist 无 `fs`；
 * 安全边界只收不放，本兜底显式标注「无 allowlist 不启用」，不注册监听、不扩大 allowlist。
 */
export function bindTauriFileDropFallback(): void {
  /* 无 allowlist 不启用（保留导出以免调用侧漂移）。 */
}

/** 拖拽子系统入口（canonical 20501/20753：全局 JU_DND / JU_MODULES 存在时才 init，缺失时静默） */
export function initJuDnd(): void { try { if (_win.JU_DND && typeof _win.JU_DND.init === 'function') _win.JU_DND.init(); } catch (e) { console.warn('[JU] caught error', e); } }
export function initJuModules(): void { try { if (_win.JU_MODULES && typeof _win.JU_MODULES.init === 'function') _win.JU_MODULES.init(); } catch (e) { console.warn('[JU] caught error', e); } }

/* ────────────────────────────────────────────────────────────────────────────
 * 9 · 启动后防呆（P3）：侧栏 / 内容区空态自检
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 启动完成后自检：
 *   - `#sidebarLeft` 内既无 `.sb-nav-item` 也无生成行 ⇒ 强制 renderSidebar() 一次并告警；
 *   - `#content` 仅有「请先选择文档」空态且当前文档可用 ⇒ 强制 forceRender() 一次并告警。
 * 仅开发构建输出 console.warn（生产构建静默，避免噪声）。
 */
export function assertUiRendered(): void {
  const dev = (import.meta as any).env && (import.meta as any).env.DEV;
  const side = $('#sidebarLeft');
  const content = $('#content');
  const sideEmpty = !side || (!side.querySelector('.sb-nav-item') && !side.querySelector('.sb-row'));
  if (sideEmpty) {
    try { renderSidebar(); } catch (e) { console.warn('[JU] renderSidebar retry failed', e); }
    if (dev) console.warn('[JU][diag] #sidebarLeft 为空，已强制 renderSidebar() 重试一次');
  }
  const onlyEmptyState = !!content && content.children.length <= 1 && /请先选择文档/.test(content.textContent || '');
  if (onlyEmptyState) {
    const doc = getCurrentDoc();
    if (doc) {
      try { forceRender(); } catch (e) { console.warn('[JU] forceRender retry failed', e); }
      if (dev) console.warn('[JU][diag] #content 仅剩「请先选择文档」空态（当前文档存在），已强制 forceRender() 重试一次');
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 10 · 关闭拦截（fix41）：先隐藏窗口，再后台静默落盘，最后退出
 * ──────────────────────────────────────────────────────────────────────────── */

/** 关闭流程状态：true = 备份已结束、允许真正退出（第二次 close-requested 直接放行） */
let _isQuitting = false;
/** 【fixr6-10 · ISSUE-010】首次关闭已进入备份：连点产生的重复 close-requested 直接丢弃 */
let _closeInFlight = false;
/** 关闭备份熔断（毫秒）：防止极端异常令后台进程卡死残留 */
const CLOSE_BACKUP_TIMEOUT_MS = 10000;

/** 关闭备份载荷：整份 state 快照；`ui.backupDir` 为空时 path 留空，由 Rust 侧写 app_data_dir/backups */
async function _closeBackupPayload(): Promise<{ path: string; name: string; content: string } | null> {
  /* 【review9-05 · ISSUE-005】双保险：锁定态不生成关闭备份载荷（未解锁时 state 为默认空库） */
  if (ui.locked) return null;
  const S: any = getState();
  if (!S) return null;
  const enc = !!(ui.encrypted && ui.encKey);
  let content = '';
  try {
    if (ui.encrypted && ui.encKey) {
      /* 【review9-01 · ISSUE-001】加密态关闭备份只落密文，禁止明文落盘 */
      content = JSON.stringify(await encryptState(S, ui.encKey));
    } else if (ui.encrypted) {
      /* 已开启加密但密钥缺失：不得落明文，跳过本次关闭备份并提示 */
      try { toast('已开启加密但密钥缺失：本次关闭备份已跳过'); } catch (e) { /* 无 toast 容器：忽略 */ }
      return null;
    } else {
      content = JSON.stringify({ app: 'juju', type: 'full-backup', exportedAt: new Date().toISOString(), state: S });
    }
  } catch (e) { return null; }
  let dir = String(ui.backupDir == null ? '' : ui.backupDir).replace(/\\/g, '/').replace(/\/+$/, '');
  /* 【review7-07 · ISSUE-007】系统关键目录不得作为关闭备份落点：置空回落 Rust 默认 backups */
  if (dir && _juBlockedDir(dir)) {
    try { toast('该位置为系统关键目录，已改用默认备份位置'); } catch (e) { /* 无 toast 容器：忽略 */ }
    dir = '';
  }
  /* 【修复·关闭备份落错位置】review25-04 原为「相对名直接跳过」，用户侧表现为
     「选了备份位置，关闭时却什么都没写」。备份是数据安全兜底，不得因路径问题整体丢失：
     路径不可用时回落 Rust 默认 backups/，并把真实落点告知用户。 */
  if (dir && !_juWritableDir(dir)) {
    try {
      toast('备份位置不可用（' + dir + '）：本次已写入默认位置 backups/，请到设置里改用绝对路径（如 D:/JU备份）');
    } catch (e) { /* 无 toast 容器：忽略 */ }
    dir = '';
  }
  const name = 'JU-备份-' + new Date().toISOString().slice(0, 10) + (enc ? '.enc.json' : '.json');
  return { path: dir ? dir + '/' + name : '', name, content };
}

/** 关闭落盘：直接 invoke Rust `save_backup`（std::fs::write，绕开 WebView2 沙盒与权限弹窗） */
async function _saveBackupOnClose(): Promise<void> {
  /* 【review9-03 · ISSUE-003】落盘与备份开关解耦：主库落盘无条件先完成（无 invoke 亦执行），仅备份段受开关控制 */
  /* 【fixr6-4 · ISSUE-004】先落盘再等主库可判定已写盘，避免 close() 早于 save_state 落地 */
  /* 【fixr7-03 · ISSUE-003】未收敛（3 轮仍有内容未写盘，含加密写盘失败）必须在关闭前可感知 */
  let converged = true;
  try { converged = await persistNowAwait(); } catch (e) { console.warn('[JU] close persist failed', e); }
  if (!converged) {
    try { toast(ui.encrypted ? '关闭前保存未完成：已尝试写入加密备份，请核对' : '关闭前保存未完成：已保留明文备份，请尽快导出数据'); } catch (e) { /* 无 toast 容器：忽略 */ }
    try { reportError('close-persist-unconverged', { msg: 'encrypted save failed before close' }); } catch (e) { /* 日志不可用 */ }
  }
  /* 仅备份段受「关闭应用时自动备份」开关控制（UI 文案语义不变） */
  if (ui.autoBackupOnClose === false) return;
  /* 【review9-05 · ISSUE-005】锁定态不产生空备份：未解锁时 state 为默认空库，不得写任何备份 */
  if (ui.locked) { try { toast('已锁定，未写入关闭备份'); } catch (e) { /* 无 toast 容器：忽略 */ } return; }
  const t: any = _win.__TAURI__;
  const invoke: any = t && t.core && typeof t.core.invoke === 'function'
    ? t.core.invoke
    : (t && t.tauri && typeof t.tauri.invoke === 'function' ? t.tauri.invoke : null);
  if (!invoke) return;
  const payload = await _closeBackupPayload();
  if (!payload) return;
  /* 【review7-13 · ISSUE-013】备份失败不得静默：留痕 + toast，交由外层 10s 熔断继续退出 */
  try {
    await invoke('save_backup', payload);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.warn('[JU] close backup failed', e);
    try { reportError('close-backup', { error: String(e) }); } catch (e2) { /* 日志不可用 */ }
    try { toast('关闭备份失败：' + errMsg); } catch (e2) { /* 无 toast 容器：忽略 */ }
  }
}

/**
 * 关闭请求拦截：首次触发立即 preventDefault + hide（窗口瞬间消失），
 * 后台完成备份后置 `_isQuitting` 再 close；第二次 close-requested 直接放行。
 * 备份整体 10s 熔断，无论成败都继续退出。
 */
function bindCloseRequested(): void {
  const t: any = _win.__TAURI__;
  const w: any = t && t.window;
  if (!w) return;
  const appWindow: any = typeof w.getCurrentWindow === 'function'
    ? w.getCurrentWindow()
    : (typeof w.getCurrent === 'function' ? w.getCurrent() : null);
  if (!appWindow || typeof appWindow.onCloseRequested !== 'function') return;
  /* 【review12-fix · #3/#4】关闭处理只保留一份：原生 close-requested（Alt+F4/系统菜单）
     与自定义 X 均调用本函数，保证 preventDefault → hide → _saveBackupOnClose
     → persistNowAwait → close 完全同链路。 */
  const onCloseRequested = async (event: any): Promise<void> => {
    if (_closeInFlight || _isQuitting) { try { event.preventDefault(); } catch (e) { /* 重复请求同样不得绕过落盘 */ } return; }
    _closeInFlight = true;
    try { event.preventDefault(); } catch (e) { /* 事件对象不可用：仍按退出流程继续 */ }
    try { if (typeof appWindow.hide === 'function') await appWindow.hide(); } catch (e) { /* 隐藏失败不阻断备份 */ }
    try {
      await Promise.race([
        _saveBackupOnClose(),
        new Promise((r) => setTimeout(r, CLOSE_BACKUP_TIMEOUT_MS)),
      ]);
    } catch (e) { /* 备份失败不阻断退出 */ }
    _isQuitting = true;
    try { if (typeof appWindow.close === 'function') await appWindow.close(); }
    catch (e) { _closeInFlight = false; try { toast('关闭失败：窗口未能退出'); } catch (e2) { /* 无 toast 容器：忽略 */ } }
  };
  /* 【review12-fix · #3/#4】暴露主动触发入口（window 级，避免 ui → app 的循环依赖）：
     合成事件仅满足 preventDefault 调用点，不参与原生事件派发。 */
  try {
    _win.__JU_REQUEST_CLOSE__ = (): Promise<void> => onCloseRequested({
      preventDefault(): void { /* 合成事件：无需再阻止已不存在的原生默认行为 */ },
    });
  } catch (e) { /* 挂载失败：自定义 X 拒绝直关并提示二次点击 */ }
  if (_win._juCloseBound) return;
  _win._juCloseBound = true;
  Promise.resolve(appWindow.onCloseRequested(onCloseRequested)).catch((e) => { /* 注册失败：退回原生关闭且不等待落盘 */ try { reportError('close-bind-failed', { error: String(e) }); } catch (e2) {} try { toast('关闭拦截不可用：本次退出可能不保存'); } catch (e2) {} });
}

/* 模块载入即挂载（仅桌面壳存在 onCloseRequested 时生效） */
try { bindCloseRequested(); } catch (e) { console.warn('[JU] bind close-requested failed', e); }
