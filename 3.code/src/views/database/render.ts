/**
 * M1-1 · 批次 V-2 · 多维表格渲染核心（筛选 / 排序 / 表格 / 看板 / 画廊 / 时间线 / 图表）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - DB_VIEWS（视图入口表）................................................. 11631-11634
 *   - _dbCellTimers / _dbCellSchedule / _dbCellCancel ....................... 11618-11630
 *   - dbFilterRuleActive / dbRowMatches / dbFilterItemActive /
 *     dbRowMatchesItem / dbCompareRows / dbRowsApply ....................... 12053-12178
 *   - renderDatabasePage ................................................... 12878-12979
 *   - renderDbTable ........................................................ 12980-13574
 *   - mkStarsHtml / isStarField / dbBoardCardHtml / dbInferSelectField /
 *     dbBoardGroupDef / renderDbBoard ..................................... 13801-13981
 *   - renderDbGallery ...................................................... 13982-14020
 *   - renderDbTimelineList / dbUserSortActive / renderDbTimeline ........... 14021-14087
 *   - renderDbChart ........................................................ 14088-14148
 *
 * 约束：DOM 结构、类名、内联样式、交互顺序、提示文案与 FIX/批次注释逐字保留。
 *   未拆分业务符号统一走 deps 依赖注入容器（原直接调用改为 deps.xxx）：
 *     getState() / ui / N() / commit() / nowSeq() / forceRender() / saveUI() / getCurrentDoc() /
 *     actions / getDbRows / openNode / sanitizeHtml / parsePasteLines / trimPasteHtml / safeExec /
 *     extractTags / findOwningTopDocId / openTimePicker / openRegionPicker / showDbRowContext /
 *     attachPanScroll / formatTimeValue / dbTableList / dbSummaryMode / dbSummaryOf / dbFmtSummary /
 *     dbFieldSummable / dbLinkTitle / 面板入口（openDbFilterPanel / openDbSortPanel /
 *     openDbSummaryPanel / openDbHiddenFieldsPanel / openFieldTypeMenu / openFieldConfigPop /
 *     openDbFieldConfigDialog / openLinkPicker / openMultiSelectPicker）/
 *     __l14On() / VIRTUAL_THRESHOLD / __renderDbGalleryVirtual()。
 *   已拆分模块直接 import：stripHtml / esc（../../core/utils）；toast / appPrompt / appConfirm /
 *     showContextMenu（../../ui/common）；syncEmptyState / isBlurSuppressed（../../ui/focus）；
 *     _mSel / _mSelSetOrder / _mSelHas / _mSelClick / _mSelSelectAll（../../ui/selection）；
 *     renderSidebar（../../ui/sidebar）；formula 侧纯函数（./formula）。
 */
import { stripHtml, esc } from '../../core/utils';
import { N as nodeById } from '../../core/persist';
import { toast, appPrompt, appConfirm, showContextMenu } from '../../ui/common';
import { syncEmptyState, isBlurSuppressed } from '../../ui/focus';
import { _mSel, _mSelSetOrder, _mSelHas, _mSelClick, _mSelSelectAll } from '../../ui/selection';
import { renderSidebar } from '../../ui/sidebar';
import {
  dbFieldName,
  dbFieldType,
  dbFieldDef,
  dbFieldVisible,
  dbPrimaryField,
  dbResolveField,
  dbRawValue,
  dbNumValue,
  dbTextValue,
  dbFormulaDisplay,
  type DbField,
  type DbRow,
} from './formula';

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现，以及批次 W 面板层入口。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export interface DatabaseDeps {
  /** 全局数据状态（对应产品的 `state`，取值时刻读取，保持引用活性） */
  getState: () => any;
  /** 全局 UI 状态对象（对应产品的 `ui`） */
  ui: any;
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
  /** 当前文档（对应产品的 `getCurrentDoc`） */
  getCurrentDoc: () => any;
  /** 业务动作集合（addDbRow / addDbField / updateText / moveNode / setDbCell …） */
  actions: any;
  /** 表格行取数（对应产品的 `getDbRows(docId)`） */
  getDbRows: (docId: any) => DbRow[];
  /** 打开节点（对应产品的 `openNode(id)`） */
  openNode: (id: any) => void;
  /** 富文本净化（对应产品的 `sanitizeHtml`） */
  sanitizeHtml: (h: string) => string;
  /** 粘贴解析（对应产品的 `parsePasteLines(dt)`） */
  parsePasteLines: (dt: any) => { lines: string[]; html?: string; plain?: string };
  /** 粘贴 HTML 修剪（对应产品的 `trimPasteHtml`） */
  trimPasteHtml: (h: string) => string;
  /** execCommand 包装（对应产品的 `safeExec`） */
  safeExec: (cmd: string, val?: string) => void;
  /** 标签提取（对应产品的 `extractTags`） */
  extractTags: (t: string) => string[];
  /** 所属顶层文档（对应产品的 `findOwningTopDocId(id,state)`） */
  findOwningTopDocId: (id: any, st: any) => any;
  /** 日期浮窗（对应产品的 `openTimePicker`，实现见 ./panels） */
  openTimePicker: (anchorEl: any, callback: (val: any) => void, current: any) => void;
  /** 地区浮窗（对应产品的 `openRegionPicker`，实现见 ./panels） */
  openRegionPicker: (anchorEl: any, callback: (val: any) => void, current: any) => void;
  /** 行右键菜单（对应产品的 `showDbRowContext`，实现见 ./panels） */
  showDbRowContext: (e: MouseEvent, id: any) => void;
  /** 表格平移（对应产品的 `attachPanScroll`，实现见 ./panels） */
  attachPanScroll: (wrap: any) => void;
  /** 时间值展示（对应产品的 `formatTimeValue`，实现见 ./formula） */
  formatTimeValue: (v: any) => string;
  /** 表列表（对应产品的 `dbTableList`，实现见 ./panels） */
  dbTableList: () => any[];
  /** 汇总模式（对应产品的 `dbSummaryMode`，实现见 ./panels） */
  dbSummaryMode: () => string;
  /** 汇总取值（对应产品的 `dbSummaryOf`，实现见 ./panels） */
  dbSummaryOf: (rows: DbRow[], field: DbField) => any;
  /** 汇总格式化（对应产品的 `dbFmtSummary`，实现见 ./panels） */
  dbFmtSummary: (v: any) => string;
  /** 可汇总字段判定（对应产品的 `dbFieldSummable`，实现见 ./panels） */
  dbFieldSummable: (f: DbField) => boolean;
  /** 关联标题（对应产品的 `dbLinkTitle`，实现见 ./panels） */
  dbLinkTitle: (id: any) => string;
  /** 筛选面板（实现见 ./panels） */
  openDbFilterPanel: (anchor: any) => void;
  /** 排序面板（实现见 ./panels） */
  openDbSortPanel: (anchor: any) => void;
  /** 汇总面板（实现见 ./panels） */
  openDbSummaryPanel: (anchor: any) => void;
  /** 显隐面板（实现见 ./panels） */
  openDbHiddenFieldsPanel: (anchor: any) => void;
  /** 字段类型浮窗（实现见 ./panels） */
  openFieldTypeMenu: (anchor: any, cb: (k: string, rect: any) => void, anchorRect?: any) => void;
  /** 字段配置浮窗（实现见 ./panels） */
  openFieldConfigPop: (type: string, docId: any, onAdd: (def: any) => void, anchor: any) => void;
  /** 列配置对话框（实现见 ./panels） */
  openDbFieldConfigDialog: (docId: any, fieldName: string, mode: string) => void;
  /** 关联记录选择器（实现见 ./panels） */
  openLinkPicker: (anchorEl: any, rowId: any, fieldName: string, targetId: any) => void;
  /** 多选选择器（实现见 ./panels） */
  openMultiSelectPicker: (anchorEl: any, rowId: any, fieldName: string, opts: string[]) => void;
  /** L14 虚拟滚动开关（对应产品的 `__l14On()`） */
  __l14On: () => boolean;
  /** 画廊虚拟化阈值（对应产品的 `VIRTUAL_THRESHOLD`） */
  VIRTUAL_THRESHOLD: number;
  /** 画廊虚拟化渲染（对应产品的 `__renderDbGalleryVirtual(rows)`） */
  __renderDbGalleryVirtual: (rows: DbRow[]) => any;
}

export const deps: DatabaseDeps = {
  getState: () => null,
  ui: {},
  N: () => null,
  commit: () => undefined,
  nowSeq: () => 0,
  forceRender: () => {},
  saveUI: () => {},
  getCurrentDoc: () => null,
  actions: {},
  getDbRows: () => [],
  openNode: () => {},
  sanitizeHtml: (h: string) => h,
  parsePasteLines: () => ({ lines: [] }),
  trimPasteHtml: (h: string) => h,
  safeExec: () => {},
  extractTags: () => [],
  findOwningTopDocId: () => null,
  openTimePicker: () => {},
  openRegionPicker: () => {},
  showDbRowContext: () => {},
  attachPanScroll: () => {},
  formatTimeValue: () => '',
  dbTableList: () => [],
  dbSummaryMode: () => 'sum',
  dbSummaryOf: () => null,
  dbFmtSummary: () => '—',
  dbFieldSummable: () => false,
  dbLinkTitle: () => '',
  openDbFilterPanel: () => {},
  openDbSortPanel: () => {},
  openDbSummaryPanel: () => {},
  openDbHiddenFieldsPanel: () => {},
  openFieldTypeMenu: () => {},
  openFieldConfigPop: () => {},
  openDbFieldConfigDialog: () => {},
  openLinkPicker: () => {},
  openMultiSelectPicker: () => {},
  __l14On: () => false,
  VIRTUAL_THRESHOLD: 200,
  __renderDbGalleryVirtual: () => null,
};

export function injectDatabaseDeps(patch: Partial<DatabaseDeps>): void {
  Object.assign(deps, patch);
}

/* 状态取用：等价于产品件同作用域 `state` */
function st(): any {
  return deps.getState() || {};
}

const _dbCellTimers = new Map<string, ReturnType<typeof setTimeout>>();
export function _dbCellSchedule(key: string, fn: () => void, ms: number): void {
  const prev = _dbCellTimers.get(key);
  if (prev) clearTimeout(prev);
  _dbCellTimers.set(key, setTimeout(() => {
    _dbCellTimers.delete(key);
    try { fn(); } catch (e) { console.error(e); }
  }, ms));
}
export function _dbCellCancel(key: string): void {
  const t = _dbCellTimers.get(key);
  if (t) { clearTimeout(t); _dbCellTimers.delete(key); }
}
export const DB_VIEWS = [
  { k: 'table', n: '表格' }, { k: 'board', n: '看板' }, { k: 'gallery', n: '画廊' },
  { k: 'timeline', n: '时间线' }, { k: 'chart', n: '图表' }
]; /* FIX-DB-01: 删除「地图」视图入口；「动态」已合并进「时间线」，时间线标题统一为「时间线」 */
export function dbFilterRuleActive(f: any): boolean {
  if (!f || !f.field) return false;
  if (f.op === 'empty' || f.op === 'not_empty') return true;
  return String(f.value == null ? '' : f.value) !== '';
}
export function dbRowMatches(n: DbRow, f: any): boolean {
  const t = dbFieldType(f.field);
  const raw = dbRawValue(n, f.field);
  const s = dbTextValue(n, f.field);
  const empty = (raw == null || raw === '' || s === '' || (Array.isArray(raw) && !raw.length));
  const op = f.op;
  if (op === 'empty') return empty;
  if (op === 'not_empty') return !empty;
  if (empty) return false;
  if (t === 'number' || t === 'formula') {
    const nv = dbNumValue(n, f.field);
    const fv = Number(f.value);
    if (op === 'contains' || op === 'not_contains') {
      const hit = s.includes(String(f.value));
      return op === 'contains' ? hit : !hit;
    }
    if (nv == null || isNaN(fv)) return false;
    switch (op) {
      case 'is': return nv === fv;
      case 'is_not': return nv !== fv;
      case 'gt': return nv > fv;
      case 'gte': return nv >= fv;
      case 'lt': return nv < fv;
      case 'lte': return nv <= fv;
    }
  } else if (t === 'date') {
    const d1 = s.split(' ')[0], d2 = String(f.value).split(' ')[0];
    switch (op) {
      case 'is': return d1 === d2;
      case 'is_not': return d1 !== d2;
      case 'before': return d1 < d2;
      case 'after': return d1 > d2;
    }
  } else if (t === 'multi_select') {
    const arr = Array.isArray(raw) ? raw : [];
    switch (op) {
      case 'is': return arr.includes(String(f.value));
      case 'is_not': return !arr.includes(String(f.value));
      case 'contains': return arr.some((v: any) => String(v).includes(String(f.value)));
      case 'not_contains': return !arr.some((v: any) => String(v).includes(String(f.value)));
    }
  } else {
    switch (op) {
      case 'is': return s === String(f.value);
      case 'is_not': return s !== String(f.value);
      case 'contains': return s.includes(String(f.value));
      case 'not_contains': return !s.includes(String(f.value));
    }
  }
  return true;
}
export function dbFilterItemActive(item: any): boolean {
  if (!item) return false;
  if (item.or) return (item.rules || []).some((r: any) => dbFilterItemActive(r));
  return dbFilterRuleActive(item);
}
export function dbRowMatchesItem(n: DbRow, item: any): boolean {
  if (!item) return true;
  if (item.or) {
    const rules = item.rules || [];
    if (!rules.some((r: any) => dbFilterItemActive(r))) return true; /* 空 OR 组不限制 */
    return rules.some((r: any) => dbFilterItemActive(r) && dbRowMatches(n, r));
  }
  return dbRowMatches(n, item);
}
export function dbCompareRows(a: DbRow, b: DbRow, field: any): number {
  const t = dbFieldType(field);
  let va: any, vb: any;
  if (t === 'number' || t === 'formula') {
    va = dbNumValue(a, field); vb = dbNumValue(b, field);
    const ea = va == null, eb = vb == null;
    if (ea && eb) return 0;
    if (ea) return 1;
    if (eb) return -1;
    return va - vb;
  }
  if (t === 'date') {
    va = dbTextValue(a, field).split(' ')[0]; vb = dbTextValue(b, field).split(' ')[0];
    const ea = !va, eb = !vb;
    if (ea && eb) return 0;
    if (ea) return 1;
    if (eb) return -1;
    return va < vb ? -1 : va > vb ? 1 : 0;
  }
  if (field === '优先级') {
    const rank: Record<string, number> = { '高': 0, '中': 1, '低': 2 };
    va = rank[dbTextValue(a, field)]; vb = rank[dbTextValue(b, field)];
    const ea = va == null, eb = vb == null;
    if (ea && eb) return 0;
    if (ea) return 1;
    if (eb) return -1;
    return va - vb;
  }
  va = dbTextValue(a, field); vb = dbTextValue(b, field);
  const ea = !va, eb = !vb;
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  return String(va).localeCompare(String(vb), 'zh-Hans-CN');
}
export function dbRowsApply(docId: any, rows: DbRow[]): DbRow[] {
  /* FIX-H-08 显式 docId 参数化：tableId 改由调用方传入，不再内部 getCurrentDoc()，与渲染目标 doc 保持一致 */
  const tableId = docId || null;
  const filters = (tableId && deps.ui.dbFiltersMap && deps.ui.dbFiltersMap[tableId]) || [];
  const sorts = (tableId && deps.ui.dbSortsMap && deps.ui.dbSortsMap[tableId]) || [];
  let out = rows;
  /* 支持 OR 分组：顶层项之间为 AND；OR 分组内任一条件满足即命中 */
  if (filters.length) out = out.filter((n) => filters.every((it: any) => !dbFilterItemActive(it) || dbRowMatchesItem(n, it)));
  if (sorts.length) {
    out = out.slice().sort((a, b) => {
      for (const s of sorts) {
        const c = dbCompareRows(a, b, s.field);
        if (c !== 0) return s.dir === 'desc' ? -c : c;
      }
      /* FIX-SORT-1: 多字段全等时按 id 确定性 tie-break（Array.sort 稳定性依赖引擎实现，旧 Safari 不稳定，
         补显式比较器使排序结果跨引擎确定） */
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
  }
  return out;
}
/**
 * 数据表行集合（对应产品件 `getDbRows`，canonical 11180-11185）。
 *
 * FIX-H-08 口径保留：显式 `docId` 参数化（不再内部取 currentDoc），docId 缺省 / 无效返回空表；
 * 行集合 = 该表的直接子节点，排除文件夹节点与已删节点。
 * 此前 `inject{Formula,Panel,Database}Deps` 注入的是 `() => []` 空壳 ⇒ 多维表格恒为空表，
 * 本函数为真实实现，由 `src/main.ts` 注入三方 deps 的 `getDbRows` 端口。
 */
export function getDbRows(docId: any): DbRow[] {
  const doc = docId ? nodeById(docId) : null;
  if (!doc) return [];
  return (doc.children || [])
    .map((id: any) => nodeById(id))
    .filter((n: any) => n && !(n._isFolder && !n._isDbRoot) && !n._deleted) as DbRow[];
}

export function renderDatabasePage(doc: any): HTMLElement {
  const container = document.createElement('div');
  if (!doc) { container.innerHTML = '<div class="empty-state">请先选择数据库</div>'; return container; }
  const page = document.createElement('div'); page.className = 'db-page';
  const toolbar = document.createElement('div'); toolbar.className = 'db-toolbar';
  /* 批次 2 · 问题 5：数据库页顶部显示表名（可点击改名），与文件夹标题同口径提交 + 侧栏同步 */
  const titleEl = document.createElement('div');
  titleEl.className = 'db-title';
  titleEl.contentEditable = 'true';
  titleEl.spellcheck = false;
  titleEl.dataset.id = doc.id;
  titleEl.textContent = stripHtml(doc.text) || '未命名';
  titleEl.dataset.ph = '未命名';
  syncEmptyState(titleEl, '未命名'); /* 【P0-2】标题清空时显示灰色占位 */
  titleEl.addEventListener('input', () => { syncEmptyState(titleEl, '未命名'); });
  titleEl.addEventListener('blur', () => { if (isBlurSuppressed()) return; if (!titleEl.isConnected) return; const cur = deps.N(doc.id); if (!cur) return; const t = (titleEl.textContent || '').trim(); if (t && t !== stripHtml(cur.text || '')) { deps.commit((s: any) => { s.nodes[doc.id].text = t; s.nodes[doc.id].updatedAt = deps.nowSeq(); }, { snapshot: true, op: 'updateText', opArgs: { id: doc.id } }); deps.actions.logActivity('mod', doc.id); renderSidebar(); } });
  toolbar.appendChild(titleEl);
  const views = document.createElement('div'); views.className = 'db-views';
  DB_VIEWS.forEach((v) => {
    const b = document.createElement('button');
    b.className = 'db-view-btn' + (deps.ui.dbView === v.k ? ' active' : '');
    b.textContent = v.n;
    b.onclick = () => { deps.ui.dbView = v.k; deps.saveUI(); deps.forceRender(); };
    views.appendChild(b);
  });
  toolbar.appendChild(views);
  const sfGroup = document.createElement('div'); sfGroup.className = 'db-sf-group';
  const filters = deps.ui.dbFiltersMap && deps.ui.dbFiltersMap[doc.id] || [];
  const sorts = deps.ui.dbSortsMap && deps.ui.dbSortsMap[doc.id] || [];
  const btnFilter = document.createElement('button');
  btnFilter.className = 'db-sf-btn' + (filters.length ? ' active' : '');
  btnFilter.id = 'btnDbFilter';
  btnFilter.title = '按条件筛选行';
  btnFilter.innerHTML = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round"><path d="M4 5h16M7 12h10M10 19h4"/></svg>筛选' + (filters.length ? '<span class="cnt">' + filters.length + '</span>' : '');
  btnFilter.onclick = (e) => { e.stopPropagation(); deps.openDbFilterPanel(btnFilter); };
  sfGroup.appendChild(btnFilter);
  const btnSort = document.createElement('button');
  btnSort.className = 'db-sf-btn' + (sorts.length ? ' active' : '');
  btnSort.id = 'btnDbSort';
  btnSort.title = '设置排序规则';
  btnSort.innerHTML = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round"><path d="M8 6h10M8 12h7M8 18h4"/><path d="M4 6l2-2 2 2M6 4v16"/></svg>排序' + (sorts.length ? '<span class="cnt">' + sorts.length + '</span>' : '');
  btnSort.onclick = (e) => { e.stopPropagation(); deps.openDbSortPanel(btnSort); };
  sfGroup.appendChild(btnSort);
  toolbar.appendChild(sfGroup);
  const sumBtn = document.createElement('button');
  sumBtn.className = 'db-sf-btn' + (deps.ui.dbSummary && deps.ui.dbSummary.on ? ' active' : '');
  sumBtn.id = 'btnDbSummary';
  sumBtn.title = '汇总：求和 / 求平均';
  sumBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>汇总';
  sumBtn.onclick = (e) => { e.stopPropagation(); deps.openDbSummaryPanel(sumBtn); };
  sfGroup.appendChild(sumBtn);
  const showHideColBtn = document.createElement('button'); /* FIX-DB-02: 显隐入口——在汇总按钮右侧 */
  showHideColBtn.className = 'db-sf-btn';
  showHideColBtn.id = 'btnDbHiddenFields';
  showHideColBtn.title = '按表头列标题显示/隐藏整列内容（联动所有视图）';
  showHideColBtn.textContent = '显隐';
  showHideColBtn.onclick = (e) => { e.stopPropagation(); deps.openDbHiddenFieldsPanel(showHideColBtn); };
  sfGroup.appendChild(showHideColBtn);
  const selAllRowsBtn = document.createElement('button');
  selAllRowsBtn.className = 'db-sf-btn';
  selAllRowsBtn.id = 'btnDbSelectAll';
  selAllRowsBtn.title = '全选当前视图行（Ctrl/Cmd+A）';
  selAllRowsBtn.textContent = '全选';
  selAllRowsBtn.onclick = (e) => { e.stopPropagation(); const _r = dbRowsApply(doc.id, deps.getDbRows(doc.id)); _mSelSelectAll('db', _r.map((x) => x.id)); };
  sfGroup.appendChild(selAllRowsBtn);
  const addWrap = document.createElement('div'); addWrap.className = 'db-add';
  const addRow = document.createElement('button'); addRow.className = 'btn'; addRow.textContent = '+ 行';
  addRow.onclick = () => { deps.actions.addDbRow(doc.id); deps.forceRender(); toast('已添加行'); };
  const addCol = document.createElement('button'); addCol.className = 'btn'; addCol.textContent = '+ 列';
  addCol.onclick = () => {
    deps.openFieldTypeMenu(addCol, (type: string, anchorRect: any) => { /* FIX-P3-22: 接收触发按钮的锚点 rect */
      deps.openFieldConfigPop(type, doc.id, (def: any) => {
        deps.actions.addDbField(doc.id, def);
        deps.forceRender();
        toast('已添加列「' + def.name + '」');
      }, anchorRect);
    }, addCol.getBoundingClientRect());
  };
  addWrap.appendChild(addRow); addWrap.appendChild(addCol);
  toolbar.appendChild(addWrap);
  page.appendChild(toolbar);
  const rows = dbRowsApply(doc.id, deps.getDbRows(doc.id)); /* FIX-H-08 显式传渲染目标 doc.id，不再依赖 currentDoc */
  let view = deps.ui.dbView || 'table';
  /* FIX-DB-01: 旧持久化回落——「地图」回落到表格，「动态」回落到时间线（入口已删除） */
  if (view === 'map') { view = 'table'; deps.ui.dbView = 'table'; deps.saveUI(); }
  else if (view === 'activity') { view = 'timeline'; deps.ui.dbView = 'timeline'; deps.saveUI(); }
  const shownCount = rows.length;
  if (filters.length || sorts.length) {
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:.76em;color:var(--fg-dim);opacity:.8;margin:-6px 0 10px';
    const parts = [];
    if (filters.length) parts.push('筛选 ' + filters.length + ' 项');
    if (sorts.length) parts.push('排序 ' + sorts.length + ' 项');
    hint.textContent = parts.join(' · ') + ' · 当前显示 ' + shownCount + ' 行';
    page.appendChild(hint);
  }
  if (view === 'table') page.appendChild(renderDbTable(rows, doc));
  else if (view === 'board') page.appendChild(renderDbBoard(rows));
  else if (view === 'gallery') page.appendChild(renderDbGallery(rows));
  else if (view === 'timeline') page.appendChild(renderDbTimeline(rows));
  else if (view === 'chart') page.appendChild(renderDbChart(rows)); /* FIX-DB-01: 移除 activity/map 渲染分支 */
  container.appendChild(page);
  return container;
}
export function renderDbTable(rows: DbRow[], doc: any): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'db-table-wrap';
  if (!rows.length) { wrap.innerHTML = '<div class="db-empty">暂无数据，点击「+ 行」添加</div>'; return wrap; }
  _mSelSetOrder('db', rows.map((n) => n.id));
  const allFields: DbField[] = st().dbFields || ['标题'];
  const hidden = deps.ui.dbHiddenFields || {};
  const fields = allFields.filter((f) => !hidden[dbFieldName(f)]); /* FIX-DB-02: 显隐联动表头/数据行/汇总行 */
  if (!fields.length) { wrap.innerHTML = '<div class="db-empty">所有列已隐藏，点击「显隐」重新显示</div>'; return wrap; }
  const table = document.createElement('table');
  table.className = 'db-table';
  const fieldName = (f: DbField): string => typeof f === 'string' ? f : (f as any).name;
  /* FIX-DB-12: 标题列 = 字段表首位（dbPrimaryField），与数据源 dbRawValue 同源；
     主列被隐藏时该列不在 fields 中，无列顶替其 contenteditable 编辑语义（避免误写 n.text） */
  const titleFieldName = dbPrimaryField();
  /* FIX-P2-1: dbFieldDef(f) 每格重复调用（rows×cols 全表 O(n²) 解析）→ 函数开头按字段缓存一次，正文循环取缓存 */
  const _fieldDefCache = new Map<DbField, any>();
  fields.forEach((_f) => _fieldDefCache.set(_f, dbFieldDef(_f)));
  const allStatuses = new Set(['进行', '待办', '完成', '放弃']);
  /* FIX-L-07 状态下拉选项改为从完整(未过滤)行集 getDbRows() 聚合，而非已过滤入参 rows；否则仅出现在被筛掉行上的自定义状态不会进入筛选下拉 */
  deps.getDbRows(doc.id).forEach((n) => { const sv = n.db && n.db['状态']; if (sv) allStatuses.add(sv); }); /* FIX-H-08 */
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  /* 批次-终极：列头排序改用 Pointer Events（放弃原生 HTML5 拖拽）。
     _colOver 记录本次拖拽的落点列；水平位移 >10px 才判定为拖拽，pointerup 时 commit 重排 dbFields 并 forceRender。 */
  let _colOver: any = null;
  const _clearColOver = (): void => {
    table.querySelectorAll('th.pointer-drag-over').forEach((el) => el.classList.remove('pointer-drag-over'));
  };
  fields.forEach((f) => {
    const fn = fieldName(f);
    const th = document.createElement('th');
    th.draggable = false;
    th.dataset.field = fn;
    th.textContent = fn;
    const _ft = dbFieldType(f);
    if (_ft === 'formula') {
      const tag = document.createElement('span'); tag.className = 'db-field-tag formula'; tag.textContent = 'ƒ';
      tag.title = '公式列：' + ((f as any) && (f as any).expr || '');
      th.appendChild(tag);
    } else if (_ft === 'link') {
      const tag = document.createElement('span'); tag.className = 'db-field-tag link'; tag.textContent = '⇄';
      tag.title = '关联列';
      th.appendChild(tag);
    } else if (_ft === 'multi_select') {
      const tag = document.createElement('span'); tag.className = 'db-field-tag'; tag.textContent = '▦';
      tag.title = '多选列';
      th.appendChild(tag);
    }
    const _ck = doc.id + '::' + fn;
    if (st().dbColumnWidths && st().dbColumnWidths[_ck]) {
      th.style.width = st().dbColumnWidths[_ck] + 'px';
      th.style.minWidth = st().dbColumnWidths[_ck] + 'px';
    }
    const resize = document.createElement('div');
    resize.className = 'db-col-resize';
    resize.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      /* 防冲突：列宽拖拽期间禁用 th 的 HTML5 拖拽，避免 resize 句柄连带触发 dragstart */
      th.draggable = false;
      try { resize.setPointerCapture(e.pointerId); } catch(err){console.warn('[JU] caught error',err);}
      deps.ui._resizingCol = true;
      deps.ui._resizingColStart = Date.now();
      const startX = e.clientX; const startW = th.offsetWidth;
      const move = (ev: PointerEvent): void => {
        /* 【UI-P1-6】列宽下限与 CSS 同步收紧到 30px（.db-table th/td min-width:30px）；
           表头/单元格文字统一居中，列宽拖拽与行拖拽逻辑不变。 */
        const minW = 30;
        const w = Math.max(minW, startW + (ev.clientX - startX));
        th.style.width = w + 'px'; th.style.minWidth = w + 'px';
      };
      const up = (): void => {
        try {
          resize.removeEventListener('pointermove', move);
          resize.removeEventListener('pointerup', up);
          resize.removeEventListener('pointercancel', up);
        } finally {
          /* 【P0-L3 Step4 P1-1】视觉态清理（_resizingCol 复位 + releasePointerCapture）全部置 finally：
             即使移除监听/提交抛错也不残留拖拽态；commit 本身防御性捕获，不向上传播。 */
          deps.ui._resizingCol = false;
          deps.ui._resizingColStart = 0;
          th.draggable = false;
          try { resize.releasePointerCapture(e.pointerId); } catch(err){console.warn('[JU] caught error',err);}
          try { deps.actions.setDbColumnWidth(doc.id, fn, th.offsetWidth); }
          catch (err) { console.error('[JU] col resize commit failed', err); }
        }
      };
      resize.addEventListener('pointermove', move);
      resize.addEventListener('pointerup', up);
      resize.addEventListener('pointercancel', up);
    });
    th.appendChild(resize);
    /* 批次-终极：列头指针拖拽（Pointer Events）。.db-col-resize 已在自身 pointerdown 内 stopPropagation，二者互不干扰。 */
    th.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if ((e.target as Element).closest('.db-col-resize')) return;
      if (deps.ui._resizingCol) return;
      const pid = e.pointerId, sx = e.clientX;
      let started = false;
      e.preventDefault();
      try { th.setPointerCapture(pid); } catch(err){console.warn('[JU] caught error',err);}
      const move = (ev: PointerEvent): void => {
        if (!started) {
          if (Math.abs(ev.clientX - sx) < 10) return;
          started = true;
          th.classList.add('pointer-dragging'); document.body.classList.add('ju-dnd-dragging');
        }
        const ths = Array.prototype.slice.call(tr.children);
        let over = null;
        for (let i = 0; i < ths.length; i++) {
          const rc = ths[i].getBoundingClientRect();
          if (ev.clientX >= rc.left && ev.clientX <= rc.right) { over = ths[i]; break; }
        }
        _clearColOver();
        _colOver = (over && over !== th && over.dataset && over.dataset.field) ? over : null;
        if (_colOver) _colOver.classList.add('pointer-drag-over');
      };
      const cleanup = (): void => {
        th.removeEventListener('pointermove', move); th.removeEventListener('pointerup', up); th.removeEventListener('pointercancel', cancel);
        try { th.releasePointerCapture(pid); } catch(err){console.warn('[JU] caught error',err);}
        th.classList.remove('pointer-dragging'); _clearColOver(); document.body.classList.remove('ju-dnd-dragging');
        _colOver = null;
      };
      const up = function (): void {
        const over = _colOver;
        cleanup();
        if (!started || !over) return;
        const _to = over.dataset.field;
        if (!_to || _to === fn) return;
        deps.commit((s: any) => {
          const arr = s.dbFields;
          if (!Array.isArray(arr)) return;
          const fromIdx = arr.findIndex((x: any) => (typeof x === 'string' ? x : x.name) === fn);
          const toIdx = arr.findIndex((x: any) => (typeof x === 'string' ? x : x.name) === _to);
          if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
          const [moved] = arr.splice(fromIdx, 1);
          const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
          arr.splice(insertIdx, 0, moved);
        }, { snapshot: true });
        deps.forceRender();
      };
      const cancel = function (): void { cleanup(); }; /* pointercancel：仅复位拖拽态，不提交列顺序 */
      th.addEventListener('pointermove', move); th.addEventListener('pointerup', up); th.addEventListener('pointercancel', cancel);
    });
    th.oncontextmenu = (e) => {
      e.preventDefault();
      const items: any[] = [];
      items.push({ ic: 'ƒ', txt: '设为公式列…', fn: () => deps.openDbFieldConfigDialog(doc.id, fn, 'formula') });
      if (dbFieldType(f) === 'formula') items.push({ ic: 'ƒ', txt: '编辑公式…', fn: () => deps.openDbFieldConfigDialog(doc.id, fn, 'formula') });
      if (dbFieldType(f) === 'formula') items.push({ ic: 'ƒ', txt: '转为文本列', fn: () => deps.openDbFieldConfigDialog(doc.id, fn, 'text') });
      if (dbFieldType(f) === 'link') items.push({ ic: '⇄', txt: '选择关联表…', fn: () => deps.openDbFieldConfigDialog(doc.id, fn, 'link') });
      items.push({ sep: true });
      items.push({ ic: '✏️', txt: '重命名列', fn: () => { appPrompt('列名称：', fn, (nf: string | null) => {
          if (!nf || !nf.trim() || nf.trim() === fn) return;
          deps.actions.renameDbField(doc.id, fn, nf.trim());
          deps.forceRender();
        }); } });
      items.push({ ic: '↤', txt: '在左侧插入列', fn: () => { appPrompt('新列名称：', '', (nf: string | null) => {
          if (!nf || !nf.trim()) return;
          deps.commit((s: any) => {
            const idx = (s.dbFields || []).findIndex((f: any) => (typeof f === 'string' ? f : f.name) === fn);
            if (idx < 0) return;
            s.dbFields.splice(idx, 0, nf.trim());
          }, { snapshot: true });
          deps.forceRender();
        }); } });
      items.push({ ic: '🗑', txt: '删除列', danger: true, fn: () => {
          if (st().dbFields.length <= 1) { toast('至少保留一列'); return; }
          appConfirm('删除列「' + fn + '」？该列所有数据将一并删除。', () => {
            deps.actions.removeDbField(doc.id, fn);
            deps.forceRender(); toast('已删除列');
          });
        } });
      showContextMenu(items, e);
    };
    tr.appendChild(th);
  });
  thead.appendChild(tr); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  let _rowOver: any = null; /* 批次-终极：行拖拽落点（{row,after}），pointerup 时提交顺序 */
  rows.forEach((n) => {
    const r = document.createElement('tr');
    r.setAttribute('data-msid', n.id);
    if (_mSel.type === 'db' && _mSelHas(n.id)) r.classList.add('ju-msel');
    r.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if ((e.target as Element).closest('input,select,textarea,button,[contenteditable],.db-col-resize,.db-row-resize,.db-cell-date,.link-add,.link-chip')) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey) e.preventDefault();
      _mSelClick('db', n.id, e, _mSel.order);
    });
    /* 批次-终极：数据行指针拖拽（Pointer Events）——垂直位移 >10px 触发，
       水平位移大于垂直时不触发（避免误伤横向操作）；pointerup 用 actions.moveNode 提交同一 db 文档内的顺序并 forceRender。 */
    r.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if ((e.target as Element).closest('input,select,textarea,button,[contenteditable],.db-col-resize,.db-row-resize,.db-cell-date,.link-add,.link-chip,a')) return;
      const pid = e.pointerId, sx = e.clientX, sy = e.clientY;
      let started = false;
      const move = (ev: PointerEvent): void => {
        if (!started) {
          const dy = ev.clientY - sy, dx = ev.clientX - sx;
          if (Math.abs(dy) < 10 || Math.abs(dy) <= Math.abs(dx)) return;
          started = true;
          r.classList.add('db-row-dragging'); document.body.classList.add('ju-dnd-dragging');
          try { r.setPointerCapture(pid); } catch(err){console.warn('[JU] caught error',err);}
        }
        const y = ev.clientY;
        const trs = Array.prototype.slice.call(tbody.children);
        let target = null, after = false;
        for (let i = 0; i < trs.length; i++) {
          const rowEl = trs[i];
          if (rowEl === r) continue;
          const rc = rowEl.getBoundingClientRect();
          if (y >= rc.top && y <= rc.bottom) { target = rowEl; after = (y - rc.top) > rc.height / 2; break; }
        }
        trs.forEach(function (rowEl) { rowEl.classList.remove('db-row-drop-before', 'db-row-drop-after'); });
        _rowOver = (target && target !== r) ? { row: target, after: after } : null;
        if (_rowOver) _rowOver.row.classList.add(_rowOver.after ? 'db-row-drop-after' : 'db-row-drop-before');
      };
      const cleanup = (): void => {
        r.removeEventListener('pointermove', move); r.removeEventListener('pointerup', up); r.removeEventListener('pointercancel', cancel);
        try { r.releasePointerCapture(pid); } catch(err){console.warn('[JU] caught error',err);}
        r.classList.remove('db-row-dragging'); document.body.classList.remove('ju-dnd-dragging');
        Array.prototype.slice.call(tbody.children).forEach(function (rowEl) { rowEl.classList.remove('db-row-drop-before', 'db-row-drop-after'); });
        _rowOver = null;
      };
      const up = function (): void {
        const ov = _rowOver;
        cleanup();
        if (!started || !ov) return;
        const targetId = ov.row.getAttribute('data-msid');
        if (!targetId || targetId === n.id) return;
        const tn = deps.N(targetId);
        if (!tn || tn.parent !== doc.id) return;
        let idx = (doc.children || []).indexOf(targetId);
        if (idx < 0) return;
        if (ov.after) idx++;
        deps.actions.moveNode(n.id, doc.id, idx);
        deps.forceRender();
      };
      const cancel = function (): void { cleanup(); }; /* pointercancel：仅复位拖拽态，不提交行顺序 */
      r.addEventListener('pointermove', move); r.addEventListener('pointerup', up); r.addEventListener('pointercancel', cancel);
    });
    if (st().dbRowHeights && st().dbRowHeights[n.id]) {
      r.style.height = st().dbRowHeights[n.id] + 'px';
    }
    fields.forEach((f, i) => {
      const fn = fieldName(f);
      const td = document.createElement('td');
      if (st().dbRowHeights && st().dbRowHeights[n.id]) td.style.height = st().dbRowHeights[n.id] + 'px';
      const rowResize = document.createElement('div');
      rowResize.className = 'db-row-resize';
      rowResize.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { rowResize.setPointerCapture(e.pointerId); } catch(err){console.warn('[JU] caught error',err);}
        const startY = e.clientY; const startH = r.offsetHeight;
        const move = (ev: PointerEvent): void => {
          const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
          const minH = fontSize * 1.5;
          const h = Math.max(minH, startH + (ev.clientY - startY));
          r.style.height = h + 'px';
          Array.from(r.children).forEach((c) => (c as HTMLElement).style.height = h + 'px');
        };
        const up = (): void => {
          try {
            rowResize.removeEventListener('pointermove', move);
            rowResize.removeEventListener('pointerup', up);
            rowResize.removeEventListener('pointercancel', up);
          } finally {
            /* 【P0-L3 Step4 P1-2】同列宽：视觉态清理置 finally，提交防御性捕获，不残留拖拽态。 */
            try { rowResize.releasePointerCapture(e.pointerId); } catch(err){console.warn('[JU] caught error',err);}
            try { deps.actions.setDbRowHeight(n.id, r.offsetHeight); }
            catch (err) { console.error('[JU] row resize commit failed', err); }
          }
        };
        rowResize.addEventListener('pointermove', move);
        rowResize.addEventListener('pointerup', up);
        rowResize.addEventListener('pointercancel', up);
      });
      if (i === 0) td.appendChild(rowResize);
      const _fdef = _fieldDefCache.get(f); /* FIX-P2-1: 取开头按字段缓存的 def，不再每格重复 dbFieldDef(f) */
      const _hasType = typeof f === 'object' && !!(f as any).type;
      if (fn === titleFieldName && !(_hasType && (_fdef.type === 'formula' || _fdef.type === 'link' || _fdef.type === 'multi_select'))) {
        /* 【修复 2026-09-27】标题列改为 contenteditable 并走 sanitizeHtml，
           编辑时保留既有富文本格式，不再静默剥离 */
        const inp = document.createElement('div');
        inp.className = 'row-title';
        inp.contentEditable = 'true';
        inp.spellcheck = false;
        inp.dataset.ph = '输入标题'; /* 【修复 F-20】配合 .row-title[data-empty="1"]::before 显示空占位 */
        inp.innerHTML = deps.sanitizeHtml(n.text || '');
        syncEmptyState(inp, '输入标题'); /* 【修复 F-20】配合 .row-title[data-empty="1"]::before 显示空占位 */
        /* 【粘贴修复 P0 · 批次 3/4】数据库行标题 = 单行语义：富文本保留行内结构但 <br>/<div>/<p> 折叠为空格，
           纯文本多行合并为单行；两条路径均复算占位符状态（execCommand 派发 input 后再同步一次） */
        inp.addEventListener('paste', (e) => {
          try {
            const dt = e.clipboardData || (window as any).clipboardData;
            if (!dt) return;
            e.preventDefault();
            const parsed = deps.parsePasteLines(dt);
            if (parsed.html) {
              /* 块级标签折叠为空格后，再折叠连续空白并 trim——避免 <div><div> 相邻产生双空格、
                 以及尾部空格被浏览器落成 &nbsp; 写进 n.text */
              const clean = deps.sanitizeHtml(deps.trimPasteHtml(parsed.html))
                .replace(/<br\s*\/?>|<\/?div>|<\/?p>/gi, ' ')
                .replace(/[ \t]{2,}/g, ' ')
                .trim();
              if (clean) { deps.safeExec('insertHTML', clean); syncEmptyState(inp, '输入标题'); return; }
            }
            const single = parsed.lines.length ? parsed.lines.join(' ').replace(/\s+/g, ' ').trim() : '';
            if (single) deps.safeExec('insertText', single);
            syncEmptyState(inp, '输入标题');
          } catch(err){console.warn('[JU] caught error',err);}
        });
        const _k = n.id + '::__title__';
        inp.oninput = () => {
          syncEmptyState(inp, '输入标题');
          const v = deps.sanitizeHtml(inp.innerHTML);
          _dbCellSchedule(_k, () => {
            const cur = deps.N(n.id);
            if (cur && cur.text !== v) {
              /* FIX-TAG-1: 与 updateText 同口径重算 tags（_manualTags ∪ 正文 #标签），
                 原实现直接写 nn.text 不重算——标题列输入 #重要 后 400ms 落盘但标签未同步，
                 用户不 blur 直接刷新则标签丢失/幽灵标签（P2 不变量违反） */
              const newTags = [...new Set([...(cur._manualTags || []), ...deps.extractTags(stripHtml(v || ''))])];
              const tagsChanged = JSON.stringify(cur.tags || []) !== JSON.stringify(newTags);
              deps.commit((s: any) => {
                const nn = s.nodes[n.id];
                if (!nn) return;
                nn.text = v;
                nn.tags = newTags;
                nn.updatedAt = deps.nowSeq();
              }, { snapshot: false, silent: true, persistOnly: true, dirtyText: true, dirtyDocs: deps.findOwningTopDocId(n.id, deps.getState()) || undefined });
              /* 批次 4-A：只刷新侧栏标签计数，不 forceRender —— 重渲染会移除当前 contenteditable，
                 连续输入 "abc #tag def" 时光标丢失 / 字符丢失 */
              if (tagsChanged) { try { renderSidebar(); } catch(e){console.warn('[JU] caught error',e);} }
            }
          }, 400);
        };
        inp.onblur = () => {
          _dbCellCancel(_k);
          const cur = deps.N(n.id);
          const v = deps.sanitizeHtml(inp.innerHTML);
          if (cur && cur.text !== v) {
            deps.actions.updateText(n.id, v);
          }
        };
        td.appendChild(inp);
      }
      if (_hasType && _fdef.type === 'formula') {
        const span = document.createElement('span'); span.className = 'db-cell-formula';
        const v = dbFormulaDisplay(dbRawValue(n, f));
        span.textContent = v || '—';
        span.title = '公式：' + (_fdef.expr || '');
        span.onclick = (e) => { e.stopPropagation(); deps.openDbFieldConfigDialog(doc.id, fn, 'formula'); };
        td.appendChild(span);
      } else if (_hasType && _fdef.type === 'link') {
        const box = document.createElement('div'); box.className = 'link-chips';
        const ids = Array.isArray(n.db && n.db[fn]) ? (n.db as any)[fn] : [];
        ids.forEach((id: any) => {
          const chip = document.createElement('span'); chip.className = 'link-chip';
          chip.textContent = deps.dbLinkTitle(id);
          chip.title = '打开关联记录';
          chip.onclick = (e) => {
            e.stopPropagation();
            const m = deps.N(id); if (m) deps.openNode(id);
          };
          const x = document.createElement('span'); x.className = 'link-chip-x'; x.textContent = '✕';
          x.title = '解除关联';
          x.onclick = (e) => {
            e.stopPropagation();
            deps.actions.setDbCell(n.id, fn, ids.filter((v: any) => v !== id));
            deps.forceRender();
          };
          chip.appendChild(x);
          box.appendChild(chip);
        });
        const add = document.createElement('span'); add.className = 'link-add'; add.textContent = '+';
        add.title = '选择关联记录';
        add.onclick = (e) => {
          e.stopPropagation();
          const targetId = _fdef.target || ((deps.dbTableList().find((t) => t.id !== doc.id)) || {}).id || '';
          deps.openLinkPicker(e.currentTarget, n.id, fn, targetId);
        };
        box.appendChild(add);
        td.appendChild(box);
      } else if (_hasType && _fdef.type === 'number') {
        const inp = document.createElement('input'); inp.type = 'number';
        inp.value = (n.db && n.db[fn]) != null ? (n.db as any)[fn] : '';
        inp.placeholder = '—';
        const _k2 = n.id + '::' + fn;
        inp.oninput = () => { _dbCellSchedule(_k2, () => deps.actions.setDbCell(n.id, fn, inp.value === '' ? '' : Number(inp.value)), 400); };
        inp.onblur = () => { _dbCellCancel(_k2); deps.actions.setDbCell(n.id, fn, inp.value === '' ? '' : Number(inp.value)); };
        td.appendChild(inp);
      } else if (_hasType && _fdef.type === 'date') {
        const btn = document.createElement('span'); btn.className = 'db-cell-date';
        btn.textContent = deps.formatTimeValue(n.db && n.db[fn]);
        btn.onclick = (e) => {
          e.stopPropagation();
          deps.openTimePicker(btn, (val: any) => { deps.actions.setDbCell(n.id, fn, val); deps.forceRender(); }, n.db && n.db[fn]);
        };
        td.appendChild(btn);
      } else if (_hasType && _fdef.type === 'location') {
        /* FIX16-P2：地点字段（type='location'，字段类型列表中紧跟「日期」之后）
           · 有值：直接显示文本（如 `中国 / 北京市 / 东城区`），点击可再次修改；
           · 无值：显示 `.db-cell-btn`「选择...」按钮，点击弹出地点级联选择浮窗；
           · 确定后经既有提交通道 setDbCell 持久化并重绘（存储契约见 src/core/constants.ts）。
           保留 `db-cell-date` 类是为了沿用既有「单元格交互不触发行框选」的守卫口径。 */
        const locVal = String((n.db && n.db[fn]) || '').trim();
        if (locVal) {
          const span = document.createElement('span');
          span.className = 'db-cell-date db-cell-loc';
          span.textContent = locVal;
          span.title = '点击修改地点';
          span.onclick = (e) => {
            e.stopPropagation();
            deps.openRegionPicker(span, (val: any) => { deps.actions.setDbCell(n.id, fn, val); deps.forceRender(); }, locVal);
          };
          td.appendChild(span);
        } else {
          const btn = document.createElement('div');
          btn.className = 'db-cell-btn';
          btn.textContent = '选择...';
          btn.title = '选择国家 / 省 / 市';
          btn.onclick = (e) => {
            e.stopPropagation();
            deps.openRegionPicker(btn, (val: any) => { deps.actions.setDbCell(n.id, fn, val); deps.forceRender(); }, '');
          };
          td.appendChild(btn);
        }
      } else if (_hasType && _fdef.type === 'multi_select') {
        const box = document.createElement('div'); box.className = 'link-chips';
        const vals = Array.isArray(n.db && n.db[fn]) ? (n.db as any)[fn] : [];
        vals.forEach((v: any) => {
          const chip = document.createElement('span'); chip.className = 'link-chip';
          chip.style.cssText = 'background:var(--bg-mid);color:var(--fg)';
          chip.textContent = v;
          const x = document.createElement('span'); x.className = 'link-chip-x'; x.textContent = '✕';
          x.title = '移除';
          x.onclick = (e) => {
            e.stopPropagation();
            deps.actions.setDbCell(n.id, fn, vals.filter((x: any) => x !== v));
            deps.forceRender();
          };
          chip.appendChild(x);
          box.appendChild(chip);
        });
        const add = document.createElement('span'); add.className = 'link-add'; add.textContent = '+';
        add.title = '选择选项';
        add.onclick = (e) => {
          e.stopPropagation();
          deps.openMultiSelectPicker(e.currentTarget, n.id, fn, (_fdef.options || []).slice());
        };
        box.appendChild(add);
        td.appendChild(box);
      } else if (_hasType && _fdef.type === 'select') {
        const sel = document.createElement('select');
        const val = (n.db && n.db[fn]) || '__unset__';
        const opts = (_fdef.options && _fdef.options.length) ? _fdef.options : ['是', '否'];
        [['__unset__', '—'], ...opts.map((o: any) => [o, o])].forEach(([v, t]) => {
          const opt = document.createElement('option'); opt.value = v; opt.textContent = t;
          if (val === v) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.onchange = () => { deps.actions.setDbCell(n.id, fn, (sel.value === '__unset__') ? '' : sel.value); };
        td.appendChild(sel);
      } else if (fn === '优先级') {
        const sel = document.createElement('select');
        const val = (n.db && n.db[fn]) || '__unset__';
        [['__unset__', '—'], ['高', '高'], ['中', '中'], ['低', '低']].forEach(([v, t]) => {
          const opt = document.createElement('option');
          opt.value = v; opt.textContent = t;
          if (val === v) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.onchange = () => { deps.actions.setDbCell(n.id, fn, (sel.value === '__unset__') ? '' : sel.value); };
        td.appendChild(sel);
      } else if (fn === '状态') {
        const sel = document.createElement('select');
        const val = (n.db && n.db[fn]) || '__unset__';
        const opts: any[] = [['__unset__', '—'], ...[...allStatuses].map((s) => [s, s])];
        opts.forEach(([v, t]) => {
          const opt = document.createElement('option');
          opt.value = v; opt.textContent = t;
          if (val === v) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.onchange = () => { deps.actions.setDbCell(n.id, fn, (sel.value === '__unset__') ? '' : sel.value); };
        td.appendChild(sel);
      } else if (fn === '星级') {
        const stars = document.createElement('div');
        stars.style.cssText = 'display:flex;gap:2px;cursor:pointer';
        const cur = parseInt((n.db && n.db[fn]) || 0) || 0;
        for (let s = 1; s <= 5; s++) {
          const sp = document.createElement('span');
          sp.textContent = '★';
          sp.style.cssText = 'font-size:1.05em;color:' + (s <= cur ? 'var(--icon)' : 'transparent') + ';-webkit-text-stroke:1px var(--star-edge)';
          sp.onclick = () => { deps.actions.setDbCell(n.id, fn, String(s)); deps.forceRender(); };
          stars.appendChild(sp);
        }
        td.appendChild(stars);
      } else if (fn === '时间') {
        const btn = document.createElement('span');
        btn.className = 'db-cell-date';
        btn.textContent = deps.formatTimeValue(n.db && n.db[fn]);
        btn.onclick = (e) => {
          e.stopPropagation();
          deps.openTimePicker(e.currentTarget, (val: any) => {
            deps.actions.setDbCell(n.id, fn, val);
            deps.forceRender();
          }, n.db && n.db[fn]);
        };
        td.appendChild(btn);
      } else if (fn === '地点') {
        const btn = document.createElement('span');
        btn.className = 'db-cell-date';
        btn.textContent = (n.db && n.db[fn]) || '选择…';
        btn.onclick = (e) => {
          e.stopPropagation();
          deps.openRegionPicker(e.currentTarget, (val: any) => {
            deps.actions.setDbCell(n.id, fn, val);
            deps.forceRender();
          }, n.db && n.db[fn]);
        };
        td.appendChild(btn);
      } else if (fn === '人物') {
        const sel = document.createElement('select');
        const val = (n.db && n.db[fn]) || '';
        const contacts = (st().contacts || []).map((c: any) => c.name);
        const all = ['', ...new Set([...contacts])];
        all.forEach((o) => {
          const opt = document.createElement('option');
          opt.value = o; opt.textContent = o || '—';
          if (val === o) opt.selected = true;
          sel.appendChild(opt);
        });
        const custom = document.createElement('option');
        custom.value = '__custom__'; custom.textContent = '+ 自定义…';
        sel.appendChild(custom);
        sel.value = val || '';
        sel.onchange = () => {
          if (sel.value === '__custom__') {
            appPrompt('输入人物名称：', '', (name: string | null) => {
              if (name && name.trim()) {
                deps.commit((s: any) => {
                  if (!s.contacts) s.contacts = [];
                  if (!s.contacts.some((c: any) => c.name === name.trim())) s.contacts.push({ name: name.trim() });
                  const nn = s.nodes[n.id];
                  if (!nn) return;
                  if (!nn.db) nn.db = {};
                  nn.db[fn] = name.trim();
                  nn.updatedAt = deps.nowSeq();
                }, { snapshot: true, op: 'setDbCell', opArgs: { id: n.id, field: fn } });
                deps.forceRender();
              } else { sel.value = val || ''; }
            });
            return;
          }
          deps.actions.setDbCell(n.id, fn, sel.value);
        };
        td.appendChild(sel);
      } else if (fn !== titleFieldName) {
        /* v2.1 fix10 · P1：标题列**不得**再落通用文本 input。
           此前本分支是裸 else：标题列已在上面落了 .row-title（contenteditable，空值时
           ::before 显示「输入标题」），随后又掉进这里追加一个 placeholder='—' 的 input
           ⇒ 单元格里同时存在「输入标题」与「—」两个占位源，上下各占一行（真实取证：
           90过程材料/tmp/fix10/db_ui_after.log 前身 db_ui_fix10_before.log 的 A 段，
           td.innerHTML 含 .row-title + input[placeholder="—"]，折算行数 = 2）。
           排除标题列后，标题列只保留 .row-title 单一占位源（只有「输入标题」）。
           说明：带 type 的标题列（formula/link/multi_select）在上面已走各自分支，走不到这里；
           带其它 type 的标题列同样由 .row-title 承担编辑，故统一按字段名排除。 */
        const inp = document.createElement('input');
        inp.value = (n.db && n.db[fn]) || '';
        inp.placeholder = '—';
        const _k2 = n.id + '::' + fn;
        inp.oninput = () => {
          const v = inp.value;
          _dbCellSchedule(_k2, () => deps.actions.setDbCell(n.id, fn, v), 400);
        };
        inp.onblur = () => {
          _dbCellCancel(_k2);
          deps.actions.setDbCell(n.id, fn, inp.value);
        };
        td.appendChild(inp);
      }
      td.oncontextmenu = (e) => {
        /* FIX-L-43 排除可编辑标题单元格(contenteditable)：放行浏览器原生右键菜单以支持粘贴；非编辑单元格行菜单保留 */
        if ((e.target as Element).closest('input,select,textarea,[contenteditable]')) return;
        e.preventDefault();
        deps.showDbRowContext(e, n.id);
      };
      r.appendChild(td);
    });
    tbody.appendChild(r);
  });
  table.appendChild(tbody);
  if (deps.ui.dbSummary && deps.ui.dbSummary.on) {
    const tfoot = document.createElement('tfoot');
    const fr = document.createElement('tr'); fr.className = 'db-summary-row';
    fields.forEach((f, i) => {
      const td = document.createElement('td');
      if (i === 0) {
        td.className = 'db-summary-label';
        td.textContent = '汇总 · ' + rows.length + ' 行';
      } else {
        const mode = deps.dbSummaryMode();
        if (mode === 'count') {
          const cnt = rows.filter((n) => {
            const v = dbRawValue(n, f);
            return !(v == null || v === '' || (Array.isArray(v) && !v.length));
          }).length;
          td.textContent = String(cnt);
          td.className = 'db-summary-num';
        } else if (deps.dbFieldSummable(f)) {
          td.textContent = deps.dbFmtSummary(deps.dbSummaryOf(rows, f));
          td.className = 'db-summary-num';
          td.title = mode === 'sum' ? '求和' : '求平均';
        } else {
          td.textContent = '';
        }
      }
      fr.appendChild(td);
    });
    tfoot.appendChild(fr);
    table.appendChild(tfoot);
  }
  wrap.appendChild(table);
  deps.attachPanScroll(wrap);
  return wrap;
}
/* FIX-DB-14: 星级图案渲染 + 星级字段判定，供看板/画廊/时间线共用（避免同一字段各视图格式不一致） */
export function mkStarsHtml(level: number): string {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const on = i <= level;
    html += '<span style="color:' + (on ? 'var(--icon)' : 'transparent') + ';-webkit-text-stroke:1px var(--star-edge);font-size:.95em">★</span>';
  }
  return html;
}
export function isStarField(name: string, def: any): boolean {
  return def.type === 'number' && /星|star/i.test(name);
}
export function dbBoardCardHtml(n: DbRow): string {
  /* FIX-DB-10: 看板卡片按显隐面板可见列渲染——标题单独渲染节点文本（n.text），
     其余可见的 text/select/number/date 字段按 dbTextValue 展示；formula/link/multi_select 复杂字段不进入卡片 */
  const parts: string[] = [];
  const titleName = dbPrimaryField(); /* FIX-DB-12: 卡片标题槽严格绑定主列 n.text，与显隐面板一一对应；主列隐藏时不显示标题槽 */
  if (dbFieldVisible(titleName)) {
    parts.push(`<div>${esc(stripHtml(n.text) || '(空)')}</div>`);
  }
  (st().dbFields || []).forEach((f: DbField) => {
    const def = dbFieldDef(f);
    const name = def.name;
    if (name === titleName) return;
    if (!dbFieldVisible(name)) return;
    if (def.type === 'formula' || def.type === 'link' || def.type === 'multi_select') return;
    /* FIX-DB-14: 星级字段用星形渲染（与画廊一致），不再输出数字 "4" */
    if (isStarField(name, def)) {
      const stv = Math.max(0, Math.min(5, parseInt((n.db && n.db[name]) || 0) || 0));
      parts.push(`<div class="meta"><span style="display:inline-flex;gap:1px">${mkStarsHtml(stv)}</span></div>`);
      return;
    }
    const v = dbTextValue(n, f);
    if (v) parts.push(`<div class="meta">${esc(name)}：${esc(v)}</div>`);
  });
  return parts.join('') || '<div>(无显示内容)</div>';
}
/* FIX-DB-10: 推断 select 风格分组字段——对象字段（含 type）直接命中；字符串字段（种子数据重命名后类型推断失效）
   按行数据值集合推断（去重 2~12 个非空字符串值视为候选），排除传入的字段名集合 */
export function dbInferSelectField(rows: DbRow[], excludeSet?: Set<string>): DbField | undefined {
  const rowArr = rows || [];
  return (st().dbFields || []).find((f: DbField) => {
    const def = dbFieldDef(f);
    const nm = def.name;
    if (excludeSet && excludeSet.has(nm)) return false;
    if (!dbFieldVisible(nm)) return false;
    if (def.type === 'select' || def.type === 'multi_select') return true;
    if (def.type !== 'text') return false;
    const vals = new Set();
    rowArr.forEach((n) => { const v = n.db && n.db[nm]; if (v != null && v !== '') vals.add(String(v)); });
    return vals.size >= 2 && vals.size <= 12;
  });
}
/* FIX-DB-10: 看板分组字段解析——优先「状态」（内置列名向后兼容）；
   名称未命中时回退 dbInferSelectField，排除标题列与「优先级」（优先级是卡片 meta 字段，不作分组），
   重命名「状态」→「Stage」等场景仍能正确选中重命名后的分组列 */
export function dbBoardGroupDef(rows: DbRow[]): DbField | null {
  const byName = dbResolveField('状态', null);
  if (byName && dbFieldVisible(dbFieldName(byName))) return byName;
  const t = dbPrimaryField(); /* FIX-DB-12: 排除主列（n.text 字段），避免把主列值集合当分组候选 */
  return dbInferSelectField(rows, new Set([t, '优先级'])) || null;
}
export function renderDbBoard(rows: DbRow[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'db-board';
  /* FIX-DB-10: 分组字段动态解析（dbBoardGroupDef(rows)，值推断支持重命名后的字符串字段）——重命名/重排列后分组列与显隐面板仍对应 */
  const groupDef = dbBoardGroupDef(rows);
  const groupName = groupDef ? dbFieldName(groupDef) : null;
  const groupVisible = groupName ? dbFieldVisible(groupName) : false;
  /* 分组字段被隐藏或不存在 → 退化为单列「全部」，不启用拖拽改状态；卡片字段按显隐渲染 */
  if (!groupVisible) {
    const c = document.createElement('div');
    c.className = 'db-board-col';
    c.dataset.status = '';
    c.innerHTML = '<h4>● 全部</h4>';
    rows.forEach((n) => {
      const card = document.createElement('div');
      card.className = 'db-board-card';
      card.dataset.id = n.id;
      card.innerHTML = dbBoardCardHtml(n);
      card.onclick = () => deps.openNode(n.id);
      c.appendChild(card);
    });
    wrap.appendChild(c);
    return wrap;
  }
  const statuses = new Set(['进行', '待办', '完成', '放弃']);
  rows.forEach((n) => { const s = n.db && n.db[groupName as string]; if (s) statuses.add(s); });
  const cols = [...statuses];
  const hasUnset = rows.some((n) => !(n.db && n.db[groupName as string]));
  if (hasUnset) cols.unshift('未设置');
  cols.forEach((col) => {
    const c = document.createElement('div');
    c.className = 'db-board-col';
    c.dataset.status = col;
    c.dataset.field = groupName as string; /* FIX-DB-10: 记录实际分组字段，拖拽回写不再硬编码 */
    c.innerHTML = `<h4>● ${esc(col)}</h4>`;
    c.ondragover = (e) => { e.preventDefault(); c.style.background = 'var(--accent-soft)'; };
    c.ondragleave = () => { c.style.background = ''; };
    c.ondrop = (e) => {
      e.preventDefault(); c.style.background = '';
      const id = (e.dataTransfer as DataTransfer).getData('text/plain');
      if (id) {
        deps.actions.setDbCell(id, groupName, col === '未设置' ? '' : col);
        deps.forceRender();
      }
    };
    rows.filter((n) => {
      const s = n.db && n.db[groupName as string];
      if (col === '未设置') return !s;
      return s === col;
    }).forEach((n) => {
      const card = document.createElement('div');
      card.className = 'db-board-card';
      card.draggable = true;
      card.dataset.id = n.id;
      card.ondragstart = (e) => { (e.dataTransfer as DataTransfer).setData('text/plain', n.id); };
      card.ondragend = () => {
        (card as any)._suppressClick = true;
        setTimeout(() => { (card as any)._suppressClick = false; }, 50);
      };
      card.innerHTML = dbBoardCardHtml(n);
      card.onclick = () => {
        if ((card as any)._suppressClick) return;
        deps.openNode(n.id);
      };
      /* 触屏拖拽逻辑保留原样 */
      (function () {
        let touchTimer: ReturnType<typeof setTimeout> | null = null, touchDragging = false, activePointerId: any = null, touchStartX = 0, touchStartY = 0;
        card.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'mouse') return;
          (card as any)._suppressClick = false;
          activePointerId = e.pointerId;
          touchStartX = e.clientX; touchStartY = e.clientY;
          try { card.setPointerCapture(activePointerId); } catch(err){console.warn('[JU] caught error',err);}
          touchTimer = setTimeout(() => {
            touchDragging = true;
            card.style.opacity = '.5';
          }, 250);
        });
        card.addEventListener('pointermove', (e) => {
          if (!touchDragging) {
            if (touchTimer && Math.hypot(e.clientX - touchStartX, e.clientY - touchStartY) > 8) {
              clearTimeout(touchTimer); touchTimer = null;
              touchDragging = true;
              card.style.opacity = '.5';
            }
            if (!touchDragging) return;
          }
          e.preventDefault();
          document.querySelectorAll('.db-board-col').forEach((cc) => (cc as HTMLElement).style.background = '');
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const colEl = el && el.closest('.db-board-col') as HTMLElement | null;
          if (colEl) colEl.style.background = 'var(--accent-soft)';
        });
        const end = (e: PointerEvent): void => {
          if (touchTimer) clearTimeout(touchTimer);
          try { card.releasePointerCapture(activePointerId); } catch(err){console.warn('[JU] caught error',err);}
          activePointerId = null;
          if (!touchDragging) return;
          touchDragging = false;
          (card as any)._suppressClick = true;
          card.style.opacity = '';
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const colEl = el && el.closest('.db-board-col') as HTMLElement | null;
          document.querySelectorAll('.db-board-col').forEach((cc) => (cc as HTMLElement).style.background = '');
          if (colEl) {
            const ns = (colEl.dataset as any).status === '未设置' ? '' : (colEl.dataset as any).status;
            deps.actions.setDbCell(n.id, groupName, ns);
            deps.forceRender();
          }
        };
        card.addEventListener('pointerup', end);
        card.addEventListener('pointercancel', end);
      })();
      c.appendChild(card);
    });
    wrap.appendChild(c);
  });
  return wrap;
}
export function renderDbGallery(rows: DbRow[]): HTMLElement {
  if (deps.__l14On() && rows && rows.length > deps.VIRTUAL_THRESHOLD) { try { return deps.__renderDbGalleryVirtual(rows); } catch(e){console.warn('[JU] caught error',e);} } /* L14 G3：画廊窗口化（默认关闭态） */
  const wrap = document.createElement('div');
  wrap.className = 'db-gallery';
  /* FIX-DB-10: 画廊卡片按显隐面板可见列渲染——标题单独渲染节点文本，
     星级（number 且名称含 星/star）以共享 mkStarsHtml 星形展示，select/text/date 显示值，其余 number 显示「名：值」；
     不再硬编码「状态/星级」字面量，重命名/重排列后与显隐面板完全对应 */
  const titleName = dbPrimaryField(); /* FIX-DB-12: 画廊标题槽严格绑定主列 n.text，与显隐面板一一对应；主列隐藏时不显示标题槽 */
  rows.forEach((n) => {
    const card = document.createElement('div');
    card.className = 'db-gallery-card';
    const html: string[] = [];
    if (dbFieldVisible(titleName)) {
      html.push('<div class="title">' + esc(stripHtml(n.text) || '(空)') + '</div>');
    }
    (st().dbFields || []).forEach((f: DbField) => {
      const def = dbFieldDef(f);
      const name = def.name;
      if (name === titleName || !dbFieldVisible(name)) return;
      if (def.type === 'formula' || def.type === 'link' || def.type === 'multi_select') return;
      /* FIX-DB-14: 星级字段用共享 mkStarsHtml 星形渲染（与看板一致）；number 显示「名：值」；
         text/date/select 一律显示值——补齐原 if-else 链无 else 导致的时间/地点/人物/内容/评价/备注静默丢弃 */
      if (isStarField(name, def)) {
        const stv = Math.max(0, Math.min(5, parseInt((n.db && n.db[name]) || 0) || 0));
        html.push('<div class="meta"><span style="display:inline-flex;gap:1px">' + mkStarsHtml(stv) + '</span></div>');
      } else if (def.type === 'number') {
        const v = dbTextValue(n, f);
        if (v) html.push('<div class="meta">' + esc(name + '：' + v) + '</div>');
      } else {
        const v = dbTextValue(n, f);
        if (v) html.push('<div class="meta"><span>' + esc(v) + '</span></div>');
      }
    });
    card.innerHTML = html.join('') || '<div class="title">(无显示内容)</div>';
    card.onclick = () => deps.openNode(n.id);
    wrap.appendChild(card);
  });
  return wrap;
}
export function renderDbTimelineList(rows: DbRow[], mapRow: (n: DbRow) => string, emptyMsg: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'db-timeline';
  if (!rows.length) { wrap.innerHTML = `<div class="db-empty">${emptyMsg}</div>`; return wrap; }
  rows.forEach((n) => {
    const item = document.createElement('div');
    item.className = 'db-tl-item';
    item.innerHTML = mapRow(n);
    item.onclick = () => deps.openNode(n.id);
    wrap.appendChild(item);
  });
  return wrap;
}
export function dbUserSortActive(): boolean {
  const doc = deps.getCurrentDoc();
  return !!(doc && deps.ui.dbSortsMap && deps.ui.dbSortsMap[doc.id] && deps.ui.dbSortsMap[doc.id].length);
}
export function renderDbTimeline(rows: DbRow[]): HTMLElement {
  /* FIX-DB-10: 「动态」合并进「时间线」——日期字段动态解析（优先「时间」，失败按类型回退第一个 date 字段），
     重命名/重排列后与显隐面板完全对应；有时间字段的按时间升序，无时间字段的按 updatedAt 降序排在其后 */
  const dateDef = dbResolveField('时间', ['date']);
  const dateName = dateDef ? dbFieldName(dateDef) : null;
  const dateVisible = dateName ? dbFieldVisible(dateName) : false;
  const sorted = dbUserSortActive()
    ? rows
    : rows.slice().sort((a, b) => {
      const ta = (dateVisible && a.db && a.db[dateName as string]) ? String(deps.formatTimeValue(a.db[dateName as string])) : '';
      const tb = (dateVisible && b.db && b.db[dateName as string]) ? String(deps.formatTimeValue(b.db[dateName as string])) : '';
      if (ta && tb) return ta.localeCompare(tb);
      if (ta) return -1;
      if (tb) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  return renderDbTimelineList(sorted, (n) => {
    const hasTime = dateVisible && !!(n.db && n.db[dateName as string]);
    const _rawDate = hasTime ? String(deps.formatTimeValue(n.db![dateName as string])) : '';
    const dateLabel = (_rawDate && _rawDate !== '选择…') ? _rawDate.split(' ')[0] : '';
    const parts: string[] = [];
    const titleName = dbPrimaryField(); /* FIX-DB-12: 时间线条目标题严格绑定主列 n.text；主列隐藏时无列顶替 */
    if (dbFieldVisible(titleName)) {
      parts.push(`<div class="t">${esc(stripHtml(n.text) || '(空)')}</div>`);
    }
    const subParts: string[] = [];
    if (hasTime) {
      /* FIX-DB-14: 副信息 = 所有可见非主列/日期字段（含 number/date/text），星级用星形；
         原只支持 text/select（number 被排除导致星级显隐无效果） */
      (st().dbFields || []).forEach((f: DbField) => {
        const def = dbFieldDef(f);
        const name = def.name;
        if (name === titleName || name === dateName) return;
        if (!dbFieldVisible(name)) return;
        if (def.type === 'formula' || def.type === 'link' || def.type === 'multi_select') return;
        if (isStarField(name, def)) {
          const stv = Math.max(0, Math.min(5, parseInt((n.db && n.db[name]) || 0) || 0));
          subParts.push('<span style="display:inline-flex;gap:1px">' + mkStarsHtml(stv) + '</span>');
          return;
        }
        const v = dbTextValue(n, f);
        if (v) subParts.push(esc(v));
      });
    } else {
      subParts.push('动态更新');
    }
    const subHtml = subParts.length ? `<div class="d">${subParts.join(' ')}</div>` : '';
    return `<div class="db-tl-date">${dateLabel}</div><div class="db-tl-content">${parts.join('')}${subHtml}</div>`;
  }, '暂无时间线/动态数据');
}
export function renderDbChart(rows: DbRow[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'db-chart';
  /* FIX-DB-14: 图表的「显隐对应」策略——为每个可见的 select/multi_select 字段各画一张柱状图；
     显隐面板勾选/取消即影响图表输出。若无 select 类字段，则回退 dbInferSelectField 值推断找一个；
     全无则给出提示。主列（n.text）值域太散，不作分组 */
  const groupFields = (st().dbFields || []).filter((f: DbField) => {
    const name = dbFieldName(f);
    if (!dbFieldVisible(name)) return false;
    if (name === dbPrimaryField()) return false;
    const def = dbFieldDef(f);
    return def.type === 'select' || def.type === 'multi_select';
  });
  if (!groupFields.length) {
    const inferred = dbInferSelectField(rows, new Set([dbPrimaryField()]));
    if (inferred) groupFields.push(inferred);
  }
  if (!groupFields.length) {
    wrap.innerHTML = '<div class="db-empty">请先在「显隐」中至少显示一个「单选/多选」字段作为图表分组依据</div>';
    return wrap;
  }
  /* FIX-L-21 柱高基准改为绘图容器高度常量 CHART_AREA_H（柱高=(c/max)*CHART_AREA_H，最大柱=容器满高），集中一处便于随容器调整 */
  const CHART_AREA_H = 180;
  (groupFields as DbField[]).forEach((groupDef) => {
    const groupName = dbFieldName(groupDef);
    const block = document.createElement('div');
    block.style.marginBottom = '24px';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:.88em;font-weight:700;color:var(--title);margin-bottom:8px';
    title.textContent = '分组：' + groupName;
    block.appendChild(title);
    const counts: Record<string, number> = {};
    rows.forEach((n) => { const s = (n.db && n.db[groupName]) || '未设置'; counts[s] = (counts[s] || 0) + 1; });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const MAX_BARS = 6;
    let display: [string, number][] = entries;
    if (entries.length > MAX_BARS) {
      const top = entries.slice(0, MAX_BARS - 1);
      const rest = entries.slice(MAX_BARS - 1).reduce((s, [, c]) => s + c, 0);
      display = [...top, ['其他', rest] as [string, number]];
    }
    const max = Math.max(1, ...display.map((e) => e[1]));
    const bars = document.createElement('div');
    bars.className = 'db-chart-bars';
    bars.style.height = CHART_AREA_H + 'px';
    display.forEach(([k, c]) => {
      const bar = document.createElement('div');
      bar.className = 'db-chart-bar';
      bar.style.height = Math.max((8 / CHART_AREA_H) * 100, (c / max) * 100) + '%';
      bar.innerHTML = `<span class="val">${esc(String(c))}</span><span class="lbl">${esc(k)}</span>`;
      bars.appendChild(bar);
    });
    block.appendChild(bars);
    const total = document.createElement('div');
    total.style.cssText = 'text-align:center;margin-top:28px;color:var(--fg-dim);font-size:.8em';
    total.textContent = '共 ' + rows.length + ' 条数据 · 分组：' + groupName;
    block.appendChild(total);
    wrap.appendChild(block);
  });
  return wrap;
}
