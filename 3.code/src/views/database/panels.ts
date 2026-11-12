/**
 * M1-1 · 批次 W · 多维表格配置面板与浮层交互
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - DB_SF_OPS（筛选/排序操作符表）....................................... 11644-11652
 *   - dbSfAutoClose / dbSfCloseAll ......................................... 12179-12198
 *   - openDbFilterPanel / openDbSortPanel .................................. 12199-12391
 *   - dbTableList / dbFieldSummable / dbSummaryMode / dbSummaryOf /
 *     dbFmtSummary / openDbSummaryPanel ................................... 12395-12461
 *   - openDbHiddenFieldsPanel ............................................. 12463-12497
 *   - getOptColors / ntAutoClose / openFieldTypeMenu / openFieldConfigPop /
 *     openDbFieldConfigDialog / dbLinkTitle / openLinkPicker /
 *     openMultiSelectPicker ............................................... 12504-12877
 *   - _panCleanups / attachPanScroll ...................................... 13578-13619
 *   - closePicker / bindPickerAutoClose / openTimePicker /
 *     openRegionPicker / showDbRowContext ................................. 13637-13800
 *   - formatTimeValue（自 ./formula 转出，表格单元格时间展示同源）......... 13620-13636
 *
 * 约束：DOM 结构、类名、内联样式、交互顺序、提示文案与 FIX/批次注释逐字保留。
 *   未拆分业务符号统一走 deps 依赖注入容器（原直接调用改为 deps.xxx）：
 *     getState() / ui / N() / commit() / forceRender() / saveUI() / getCurrentDoc() /
 *     actions / getDbRows / isFolder / placePop / themeList。
 *   已拆分模块直接 import：toast / appConfirm / appPrompt / showContextMenu / initDragClose（../ui/common）；
 *     esc / stripHtml（../../core/utils）；formula 侧纯函数（./formula）。
 */
import { toast, appConfirm, appPrompt, showContextMenu, initDragClose } from '../../ui/common';
import { esc, stripHtml, todayStr } from '../../core/utils';
import {
  dbFieldName,
  dbFieldType,
  dbFieldDef,
  dbRawValue,
  dbNumValue,
  dbFormulaDisplay,
  type DbField,
  type DbRow,
} from './formula';
import { CN_PROVINCES, DEFAULT_COUNTRY, getCities, getProvinces, isKnownProvince, joinLocation, LOCATION_SEP, parseLocation } from '../../utils/regions';

export { formatTimeValue } from './formula';

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export interface PanelDeps {
  /** 全局数据状态（对应产品的 `state`，取值时刻读取，保持引用活性） */
  getState: () => any;
  /** 全局 UI 状态对象（对应产品的 `ui`） */
  ui: any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** 不可变提交（对应产品的 `commit`） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** 请求下一次渲染 */
  forceRender: () => void;
  /** UI 状态持久化（对应产品的 `saveUI`） */
  saveUI: () => void;
  /** 逻辑序号时钟（对应产品的 `_nowSeq`） */
  nowSeq: () => any;
  /** 当前文档（对应产品的 `getCurrentDoc`） */
  getCurrentDoc: () => any;
  /** 业务动作集合（addDbField / renameDbField / removeDbField / setDbCell / setDbColumnWidth …） */
  actions: any;
  /** 表格行取数（对应产品的 `getDbRows(docId)`） */
  getDbRows: (docId: any) => DbRow[];
  /** 文件夹判定（对应产品的 `isFolder(id)`） */
  isFolder: (id: any) => boolean;
  /** 统一浮窗定位（对应产品的 `placePop(el,W,H,anchor)`） */
  placePop: (el: any, W: number, H: number, anchor: any) => void;
  /** 主题色板读取（对应产品的 `_themeList(name,fallback)`） */
  themeList: (name: string, fallback?: string[]) => string[];
}

export const deps: PanelDeps = {
  getState: () => null,
  ui: {},
  N: () => null,
  commit: () => undefined,
  forceRender: () => {},
  saveUI: () => {},
  nowSeq: () => 0,
  getCurrentDoc: () => null,
  actions: {},
  getDbRows: () => [],
  isFolder: () => false,
  placePop: () => {},
  themeList: (_name: string, fallback?: string[]) => fallback || [],
};

export function injectPanelDeps(patch: Partial<PanelDeps>): void {
  Object.assign(deps, patch);
}

/* 状态取用：等价于产品件同作用域 `state` */
function st(): any {
  return deps.getState() || {};
}

/* ============================================================
   多维表格：排序 / 筛选
   ============================================================ */
export const DB_SF_OPS: Record<string, string[][]> = {
  text:  [['contains', '包含'], ['not_contains', '不包含'], ['is', '等于'], ['is_not', '不等于'], ['empty', '为空'], ['not_empty', '不为空']],
  select: [['is', '等于'], ['is_not', '不等于'], ['empty', '为空'], ['not_empty', '不为空']],
  number: [['is', '等于'], ['is_not', '不等于'], ['gt', '大于'], ['gte', '大于等于'], ['lt', '小于'], ['lte', '小于等于'], ['empty', '为空'], ['not_empty', '不为空']],
  date:  [['is', '是'], ['is_not', '不是'], ['before', '早于'], ['after', '晚于'], ['empty', '为空'], ['not_empty', '不为空']],
  formula: [['is', '等于'], ['is_not', '不等于'], ['gt', '大于'], ['gte', '大于等于'], ['lt', '小于'], ['lte', '小于等于'], ['contains', '包含'], ['not_contains', '不包含'], ['empty', '为空'], ['not_empty', '不为空']],
  link:  [['contains', '包含'], ['not_contains', '不包含'], ['is', '等于'], ['is_not', '不等于'], ['empty', '为空'], ['not_empty', '不为空']],
  multi_select: [['contains', '包含'], ['not_contains', '不包含'], ['is', '等于'], ['is_not', '不等于'], ['empty', '为空'], ['not_empty', '不为空']],
};
export function dbSfAutoClose(panel: any, ids?: string[]): void {
  /* FIX-CLEANUP-4（B-5）: 同一 panel 防重复挂载——多次调用只挂一次 mousedown、只 push 一次 cleanup，
     避免清理函数与监听器重复累积 */
  if (panel._dbSfAutoClosed) return;
  panel._dbSfAutoClosed = true;
  setTimeout(() => {
    /* FIX-CLEANUP-1: 挂载前检查仍连接——同一任务内面板已被 closePicker 移除时跳过挂监听，防泄漏 */
    if (!panel.isConnected) return;
    const onDoc = (e: MouseEvent): void => {
      const t = e.target as Element;
      if (t.closest('.db-sf-panel') || (ids && ids.some((id) => t.closest('#' + id)))) return;
      closePicker(panel);
    };
    document.addEventListener('mousedown', onDoc);
    if (!panel._cleanups) panel._cleanups = [];
    panel._cleanups.push(() => document.removeEventListener('mousedown', onDoc));
  }, 0);
}
export function dbSfCloseAll(): void {
  document.querySelectorAll('.db-sf-panel').forEach((p) => closePicker(p));
}
export function openDbFilterPanel(anchor: any): void {
  dbSfCloseAll();
  const doc = deps.getCurrentDoc();
  if (!doc) return;
  if (!deps.ui.dbFiltersMap) deps.ui.dbFiltersMap = {};
  const filters = deps.ui.dbFiltersMap[doc.id] || (deps.ui.dbFiltersMap[doc.id] = []);
  const panel = document.createElement('div');
  panel.className = 'db-sf-panel';
  panel.style.width = '372px';
  panel.innerHTML = '<h4>筛选</h4><div class="db-sf-rules"></div>';
  const rulesBox = panel.querySelector('.db-sf-rules') as HTMLElement;
  const mkDbFilterValueWidget = (f: any): HTMLInputElement | HTMLSelectElement | null => {
    const t = dbFieldType(f.field);
    if (f.op === 'empty' || f.op === 'not_empty') return null;
    let w: HTMLInputElement | HTMLSelectElement;
    if (t === 'number' || t === 'formula') {
      w = document.createElement('input'); w.type = 'number';
    } else if (t === 'date') {
      w = document.createElement('input'); w.type = 'date';
    } else if (t === 'select' || t === 'multi_select') {
      w = document.createElement('select');
      const def = dbFieldDef(f.field);
      let opts = (def.options && def.options.slice()) || [];
      if (f.field === '优先级') opts = ['高', '中', '低'];
      else if (f.field === '状态') {
        const set = new Set(['进行', '待办', '完成', '放弃']);
        deps.getDbRows(doc.id).forEach((n) => { const sv = n.db && n.db['状态']; if (sv) set.add(sv); }); /* FIX-H-08 */
        opts = [...set];
      }
      opts.forEach((o: string) => { const oo = document.createElement('option'); oo.value = o; oo.textContent = o; w.appendChild(oo); });
    } else {
      w = document.createElement('input'); w.type = 'text';
    }
    const setVal = (): void => {
      if (w.type === 'select-one') w.value = f.value || '';
      else if (w.type === 'number' || w.type === 'date') w.value = f.value || '';
      else w.value = f.value || '';
    };
    setVal();
    w.addEventListener('change', () => { f.value = w.value; deps.saveUI(); deps.forceRender(); });
    if (w.tagName === 'INPUT') w.addEventListener('input', () => { f.value = w.value; deps.saveUI(); });
    return w;
  };
  const mkRuleRow = (f: any, onRemove: () => void, onChange: () => void): HTMLElement => {
    const row = document.createElement('div'); row.className = 'db-sf-row db-sf-row-inline';
    const fSel = document.createElement('select'); fSel.className = 'fld-sel';
    (st().dbFields || []).forEach((ff: DbField, i: number) => {
      const o = document.createElement('option'); o.value = String(i); o.textContent = dbFieldName(ff);
      if (dbFieldName(ff) === f.field) o.selected = true;
      fSel.appendChild(o);
    });
    fSel.onchange = () => {
      const nf = dbFieldName(st().dbFields[Number(fSel.value)]);
      f.field = nf;
      const nt = dbFieldType(nf);
      if (!DB_SF_OPS[nt].some(([k]) => k === f.op)) f.op = DB_SF_OPS[nt][0][0];
      f.value = '';
      deps.saveUI(); onChange();
    };
    const opSel = document.createElement('select'); opSel.className = 'op-sel';
    DB_SF_OPS[dbFieldType(f.field)].forEach(([k, txt]) => {
      const o = document.createElement('option'); o.value = k; o.textContent = txt;
      if (k === f.op) o.selected = true;
      opSel.appendChild(o);
    });
    opSel.onchange = () => {
      f.op = opSel.value;
      if (f.op === 'empty' || f.op === 'not_empty') f.value = '';
      deps.saveUI(); onChange();
    };
    const valWidget = mkDbFilterValueWidget(f);
    const del = document.createElement('button'); del.className = 'db-sf-del'; del.title = '删除条件'; del.textContent = '✕';
    del.onclick = () => { onRemove(); };
    row.appendChild(fSel); row.appendChild(opSel);
    if (valWidget) row.appendChild(valWidget);
    row.appendChild(del);
    return row;
  };
  const renderItems = (items: any[], box: HTMLElement): void => {
    box.innerHTML = '';
    if (!items.length) {
      const e = document.createElement('div'); e.className = 'db-sf-empty';
      e.textContent = '暂无筛选条件';
      box.appendChild(e);
    }
    items.forEach((it, idx) => {
      if (it.or) {
        const gbox = document.createElement('div'); gbox.className = 'db-sf-group-box';
        const head = document.createElement('div'); head.className = 'db-sf-group-head';
        const badge = document.createElement('span'); badge.className = 'db-sf-group-badge'; badge.textContent = 'OR 组';
        const hint = document.createElement('span'); hint.className = 'db-sf-group-hint'; hint.textContent = '组内任一条件满足即命中';
        const addR = document.createElement('button'); addR.className = 'db-sf-group-add'; addR.textContent = '＋ 筛选';
        addR.onclick = () => {
          const firstField = st().dbFields && st().dbFields.length ? dbFieldName(st().dbFields[0]) : '标题';
          if (!it.rules) it.rules = [];
          it.rules.push({ field: firstField, op: DB_SF_OPS[dbFieldType(firstField)][0][0], value: '' });
          deps.saveUI(); renderRules(); deps.forceRender();
        };
        const delG = document.createElement('button'); delG.className = 'db-sf-group-del'; delG.title = '删除分组'; delG.textContent = '✕';
        delG.onclick = () => { items.splice(idx, 1); deps.saveUI(); renderRules(); deps.forceRender(); };
        head.appendChild(badge); head.appendChild(hint); head.appendChild(addR); head.appendChild(delG);
        gbox.appendChild(head);
        const nest = document.createElement('div'); nest.className = 'db-sf-nest';
        (it.rules || []).forEach((r: any) => {
          nest.appendChild(mkRuleRow(r, () => { it.rules.splice(it.rules.indexOf(r), 1); deps.saveUI(); renderRules(); deps.forceRender(); }, () => { renderRules(); deps.forceRender(); }));
        });
        if (!(it.rules || []).length) {
          const e = document.createElement('div'); e.className = 'db-sf-empty'; e.textContent = '（空 OR 组，不限制）';
          nest.appendChild(e);
        }
        gbox.appendChild(nest);
        box.appendChild(gbox);
      } else {
        box.appendChild(mkRuleRow(it, () => { items.splice(idx, 1); deps.saveUI(); renderRules(); deps.forceRender(); }, () => { renderRules(); deps.forceRender(); }));
      }
    });
  };
  const renderRules = (): void => { renderItems(filters, rulesBox); };
  const addBtn = document.createElement('div'); addBtn.className = 'db-sf-add';
  addBtn.textContent = '+ 添加筛选';
  addBtn.onclick = () => {
    const firstField = st().dbFields && st().dbFields.length ? dbFieldName(st().dbFields[0]) : '标题';
    filters.push({ field: firstField, op: DB_SF_OPS[dbFieldType(firstField)][0][0], value: '' });
    deps.saveUI(); renderRules(); deps.forceRender();
  };
  const addGroupBtn = document.createElement('div'); addGroupBtn.className = 'db-sf-add';
  addGroupBtn.textContent = '+ 添加 OR 分组';
  addGroupBtn.onclick = () => {
    const firstField = st().dbFields && st().dbFields.length ? dbFieldName(st().dbFields[0]) : '标题';
    filters.push({ or: true, rules: [{ field: firstField, op: DB_SF_OPS[dbFieldType(firstField)][0][0], value: '' }] });
    deps.saveUI(); renderRules(); deps.forceRender();
  };
  const topBtns = document.createElement('div'); topBtns.style.cssText = 'display:flex;gap:6px';
  topBtns.appendChild(addBtn); topBtns.appendChild(addGroupBtn);
  panel.appendChild(topBtns);
  renderRules();
  document.body.appendChild(panel);
  deps.placePop(panel, 400, 480, anchor);

  initDragClose(panel, () => closePicker(panel));
  dbSfAutoClose(panel, ['btnDbFilter']);
}
export function openDbSortPanel(anchor: any): void {
  dbSfCloseAll();
  const doc = deps.getCurrentDoc();
  if (!doc) return;
  if (!deps.ui.dbSortsMap) deps.ui.dbSortsMap = {};
  const sorts = deps.ui.dbSortsMap[doc.id] || (deps.ui.dbSortsMap[doc.id] = []);
  const panel = document.createElement('div');
  panel.className = 'db-sf-panel';
  panel.innerHTML = '<h4>排序</h4><div class="db-sf-rules"></div>';
  const rulesBox = panel.querySelector('.db-sf-rules') as HTMLElement;
  const addBtn = document.createElement('div'); addBtn.className = 'db-sf-add';
  addBtn.textContent = '+ 添加排序';
  addBtn.onclick = () => {
    const firstField = st().dbFields && st().dbFields.length ? dbFieldName(st().dbFields[0]) : '标题';
    sorts.push({ field: firstField, dir: 'asc' });
    deps.saveUI(); renderRules(); deps.forceRender();
  };
  panel.appendChild(addBtn);
  const renderRules = (): void => {
    rulesBox.innerHTML = '';
    if (!sorts.length) {
      const e = document.createElement('div'); e.className = 'db-sf-empty';
      e.textContent = '暂无排序规则';
      rulesBox.appendChild(e);
    }
    sorts.forEach((s: any, idx: number) => {
      const row = document.createElement('div'); row.className = 'db-sf-row';
      const fSel = document.createElement('select'); fSel.className = 'fld-sel';
      (st().dbFields || []).forEach((ff: DbField, i: number) => {
        const o = document.createElement('option'); o.value = String(i); o.textContent = dbFieldName(ff);
        if (dbFieldName(ff) === s.field) o.selected = true;
        fSel.appendChild(o);
      });
      fSel.onchange = () => { s.field = dbFieldName(st().dbFields[Number(fSel.value)]); deps.saveUI(); renderRules(); deps.forceRender(); };
      const dirBtn = document.createElement('button');
      dirBtn.className = 'db-sf-btn'; dirBtn.style.cssText = 'flex:none;height:30px';
      dirBtn.textContent = s.dir === 'desc' ? '↓ 降序' : '↑ 升序';
      dirBtn.onclick = () => { s.dir = s.dir === 'desc' ? 'asc' : 'desc'; deps.saveUI(); renderRules(); deps.forceRender(); };
      const del = document.createElement('button'); del.className = 'db-sf-del'; del.title = '删除排序'; del.textContent = '✕';
      del.onclick = () => { sorts.splice(idx, 1); deps.saveUI(); renderRules(); deps.forceRender(); };
      row.appendChild(fSel); row.appendChild(dirBtn); row.appendChild(del);
      rulesBox.appendChild(row);
    });
  };
  renderRules();
  document.body.appendChild(panel);
  deps.placePop(panel, 380, 300, anchor);

  initDragClose(panel, () => closePicker(panel));
  dbSfAutoClose(panel, ['btnDbSort']);
}
/* ============================================================
   多维表格：汇总（求和 / 求平均）
   ============================================================ */
export function dbTableList(): any[] {
  const root = deps.N(st().rootId);
  if (!root) return [];
  const dbRoot = root.children.map((id: any) => deps.N(id)).find((n: any) => n && n._isDbRoot);
  if (!dbRoot) return [];
  return dbRoot.children.map((id: any) => deps.N(id)).filter((n: any) => n && !n._deleted && n.dbRoot);
}
export function dbFieldSummable(f: DbField): boolean {
  const t = dbFieldType(f);
  return t === 'number' || t === 'formula';
}
export function dbSummaryMode(): string {
  return (deps.ui.dbSummary && deps.ui.dbSummary.mode) || 'sum';
}
export function dbSummaryOf(rows: DbRow[], field: DbField): number | null {
  const mode = dbSummaryMode();
  const vals: number[] = [];
  rows.forEach((n) => {
    const v = dbNumValue(n, field);
    if (v != null && !isNaN(v)) vals.push(v);
  });
  if (mode === 'count') return vals.length;
  if (!vals.length) return null;
  const sum = vals.reduce((s, x) => s + x, 0);
  return mode === 'avg' ? sum / vals.length : sum;
}
export function dbFmtSummary(v: any): string {
  if (v == null) return '—';
  if (typeof v !== 'number') return String(v);
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}
export function openDbSummaryPanel(anchor: any): void {
  dbSfCloseAll();
  if (!deps.ui.dbSummary) deps.ui.dbSummary = { on: false, mode: 'sum' };
  const panel = document.createElement('div');
  /* v2.1 fix9 · P2：汇总浮窗收紧为「复选框 + 下拉框」的紧凑浮层。
     删除三段冗余说明文案（标题「汇总行」/「（计数/求和/求平均）」/底部统计口径说明），
     保留「启用」复选框与右侧模式下拉框；尺寸收紧由 style.css 的 .db-sum-panel 承担（纯 CSS 类，无内联 style）。 */
  panel.className = 'db-sf-panel db-sum-panel';
  panel.innerHTML = '<div class="db-sf-rules"></div>';
  const box = panel.querySelector('.db-sf-rules') as HTMLElement;
  /* v2.1 fix9 · P2：去掉内联 width（尺寸一律由 .db-sum-panel .op-sel 的 CSS 类决定） */
  const modeSel = document.createElement('select'); modeSel.className = 'op-sel';
  [['sum', '求和'], ['avg', '求平均'], ['count', '计数']].forEach(([k, txt]) => {
    const o = document.createElement('option'); o.value = k; o.textContent = txt;
    if (dbSummaryMode() === k) o.selected = true;
    modeSel.appendChild(o);
  });
  modeSel.onchange = () => { deps.ui.dbSummary.mode = modeSel.value; deps.saveUI(); deps.forceRender(); };
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!deps.ui.dbSummary.on;
  cb.onchange = () => { deps.ui.dbSummary.on = cb.checked; deps.saveUI(); deps.forceRender(); };
  const onToggle = document.createElement('label');
  onToggle.className = 'db-sum-toggle';
  onToggle.appendChild(cb);
  /* 只保留「启用」二字：原「启用（计数/求和/求平均）」的括号注解即 P2 要求删除的第二段文案，
     模式语义已由右侧下拉框自身选项（求和 / 求平均 / 计数）表达 */
  const span = document.createElement('span'); span.textContent = '启用'; onToggle.appendChild(span);
  const row = document.createElement('div'); row.className = 'db-sf-row';
  row.appendChild(onToggle); row.appendChild(modeSel);
  box.appendChild(row);
  document.body.appendChild(panel);
  /* 紧凑浮层的真实尺寸由 CSS 决定；此处透传「预期宽高」仅用于 placePop 的视口内避让计算 */
  deps.placePop(panel, 190, 46, anchor);

  initDragClose(panel, () => closePicker(panel));
  dbSfAutoClose(panel, ['btnDbSummary']);
}
/* FIX-DB-02: 显隐面板——以表头列标题为准逐列控制该列在所有视图中的显示 */
export function openDbHiddenFieldsPanel(anchor: any): void {
  dbSfCloseAll();
  if (!deps.ui.dbHiddenFields) deps.ui.dbHiddenFields = {};
  const panel = document.createElement('div');
  panel.className = 'db-sf-panel';
  panel.style.width = '260px';
  panel.innerHTML = '<h4>显隐</h4><div class="db-sf-rules"></div>';
  const box = panel.querySelector('.db-sf-rules') as HTMLElement;
  (st().dbFields || []).forEach((f: DbField) => {
    const name = dbFieldName(f);
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 6px;cursor:pointer';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !deps.ui.dbHiddenFields[name];
    cb.onchange = () => {
      deps.ui.dbHiddenFields[name] = !cb.checked;
      deps.saveUI();
      deps.forceRender();
    };
    const span = document.createElement('span');
    span.textContent = name;
    row.appendChild(cb);
    row.appendChild(span);
    box.appendChild(row);
  });
  const hint = document.createElement('div');
  hint.className = 'db-sf-summary';
  hint.textContent = '勾选 = 显示该列；取消勾选后，该列在表格/看板/画廊/时间线/图表中均隐藏（含汇总行）。';
  box.appendChild(hint);
  document.body.appendChild(panel);
  deps.placePop(panel, 300, 320, anchor);
  initDragClose(panel, () => closePicker(panel));
  dbSfAutoClose(panel, ['btnDbHiddenFields']);
}
/* ============================================================
   多维表格：添加列（文本 / 数字 / 日期 / 单选 / 公式 / 关联）
   ============================================================ */
/* ============================================================
   多维表格：字段类型浮窗（图标 + 类型名 + 说明的列表式选择弹层）
   ============================================================ */
let _optColorsCache: string[] | null = null;
export function getOptColors(): string[] { if (_optColorsCache) return _optColorsCache; _optColorsCache = deps.themeList('--opt-palette', []); return _optColorsCache; }
export function ntAutoClose(pop: any): void {
  setTimeout(() => {
    /* FIX-CLEANUP-1: 挂载前检查仍连接，防 detached 元素泄漏 document 监听 */
    if (!pop.isConnected) return;
    const onDoc = (e: MouseEvent): void => {
      const t = e.target as Element;
      if (t.closest('.nt-pop,.db-sf-panel,.date-picker,.region-picker,.link-picker')) return;
      closePicker(pop);
    };
    document.addEventListener('mousedown', onDoc);
    if (!pop._cleanups) pop._cleanups = [];
    pop._cleanups.push(() => document.removeEventListener('mousedown', onDoc));
  }, 0);
}
export function openFieldTypeMenu(anchor: any, cb: (k: string, rect: any) => void, anchorRect?: any): void {
  dbSfCloseAll();
  const TYPES = [
    { k: 'text', ic: 'T', n: '文本', d: '单行文本' },
    { k: 'number', ic: '#', n: '数字', d: '数值，可参与汇总' },
    { k: 'date', ic: '◷', n: '日期', d: '日期 / 时间 / 范围' },
    /* FIX16-P2：新增「地点」字段类型，列表位置严格紧跟「日期」之后（验收项：地点排在日期下面） */
    { k: 'location', ic: '◎', n: '地点', d: '国家 / 省 / 市' },
    { k: 'select', ic: '◉', n: '单选', d: '从选项中选择一项' },
    { k: 'multi_select', ic: '▦', n: '多选', d: '从选项中选择多项' },
    { k: 'formula', ic: 'ƒ', n: '公式', d: '由其他字段自动计算' },
    { k: 'link', ic: '⇄', n: '关联', d: '关联另一张表的记录' }
  ];
  const pop = document.createElement('div'); pop.className = 'nt-pop'; pop.dataset.pop = 'ftype';
  pop.style.width = '276px';
  const title = document.createElement('div'); title.className = 'nt-pop-title'; title.textContent = '字段类型';
  pop.appendChild(title);
  TYPES.forEach((t) => {
    const item = document.createElement('div'); item.className = 'nt-item';
    item.innerHTML = `<span class="ic">${t.ic}</span><span style="flex:1"><span style="display:block">${t.n}</span><span class="desc">${t.d}</span></span>`;
    item.onclick = () => {
      const rect = anchorRect || pop.getBoundingClientRect();
      /* FIX-P3-22: 锚点 rect 随回调透传（cb(t.k,rect)）——优先触发按钮 rect，避免以菜单自身为锚导致错位；多浮窗并发各自携带自己的锚点 */
      closePicker(pop);
      cb(t.k, { left: rect.left, top: rect.top, bottom: rect.bottom });
    };
    pop.appendChild(item);
  });
  document.body.appendChild(pop);
  deps.placePop(pop, 300, 400, anchor);

  initDragClose(pop, () => closePicker(pop));
  ntAutoClose(pop);
}
export function openFieldConfigPop(type: string, docId: any, onAdd: (def: any) => void, anchor: any): void {
  const pop = document.createElement('div'); pop.className = 'nt-pop'; pop.dataset.pop = 'fcfg';
  pop.style.width = '304px';
  const title = document.createElement('div'); title.className = 'nt-pop-title';
  title.textContent = ({ text: '文本列', number: '数字列', date: '日期列', location: '地点列', select: '单选列', multi_select: '多选列', formula: '公式列', link: '关联列' } as Record<string, string>)[type] || '新列';
  pop.appendChild(title);
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:8px';
  const nameLbl = document.createElement('label'); nameLbl.className = 'nt-field-label'; nameLbl.textContent = '列名称';
  const nameInp = document.createElement('input'); nameInp.className = 'nt-input'; nameInp.placeholder = '例如：金额';
  body.appendChild(nameLbl); body.appendChild(nameInp);
  let extra: any = null;
  const getExtra = (): any => extra ? extra.get() : '';
  if (type === 'date') {
    const lbl = document.createElement('label'); lbl.className = 'nt-field-label';
    lbl.textContent = '日期粒度（同时间列浮窗）';
    const sel = document.createElement('select'); sel.className = 'nt-input';
    [['date', '单日期'], ['datetime', '日期时间'], ['range', '日期范围'], ['datetimerange', '日期时间范围']].forEach(([k, txt]) => { const o = document.createElement('option'); o.value = k; o.textContent = txt; sel.appendChild(o); });
    const wrap = document.createElement('div');
    wrap.appendChild(lbl); wrap.appendChild(sel);
    body.appendChild(wrap);
    extra = { get: () => sel.value };
  } else if (type === 'select' || type === 'multi_select') {
    const lbl = document.createElement('label'); lbl.className = 'nt-field-label'; lbl.textContent = '选项（输入后回车快速新增）';
    const list = document.createElement('div'); list.className = 'nt-opt-list';
    const opts: string[] = [];
    const renderOpts = (): void => {
      list.innerHTML = '';
      opts.forEach((o, i) => {
        const row = document.createElement('div'); row.className = 'nt-opt-row';
        const oc = getOptColors(); const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = oc[i % oc.length];
        const inp = document.createElement('input'); inp.className = 'nt-input'; inp.value = o;
        inp.oninput = () => { opts[i] = inp.value; };
        const del = document.createElement('button'); del.className = 'db-sf-del'; del.textContent = '✕'; del.title = '删除选项';
        del.onclick = () => { opts.splice(i, 1); renderOpts(); };
        row.appendChild(dot); row.appendChild(inp); row.appendChild(del);
        list.appendChild(row);
      });
    };
    const addBtn = document.createElement('div'); addBtn.className = 'nt-opt-add';
    const addInp = document.createElement('input'); addInp.className = 'nt-input'; addInp.placeholder = '输入选项，回车添加';
    addBtn.appendChild(addInp);
    const doAdd = (): void => {
      const v = addInp.value.trim();
      if (!v) return;
      opts.push(v); addInp.value = ''; renderOpts(); addInp.focus();
    };
    addInp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } };
    renderOpts();
    const wrap = document.createElement('div');
    wrap.appendChild(lbl); wrap.appendChild(list); wrap.appendChild(addBtn);
    body.appendChild(wrap);
    extra = { get: () => opts.map((s) => String(s).trim()).filter(Boolean) };
  } else if (type === 'formula') {
    const lbl = document.createElement('label'); lbl.className = 'nt-field-label'; lbl.textContent = '公式表达式';
    const ta = document.createElement('textarea'); ta.className = 'nt-input'; ta.rows = 3; ta.placeholder = '例如：星级 * 2';
    const help = document.createElement('div'); help.className = 'db-formula-box';
    help.innerHTML = '数字：ABS ROUND INT MAX MIN SUM AVG COUNT · 文本：LEN LEFT UPPER TRIM CONCAT IF · 日期：<code>TODAY()</code> <code>YEAR(字段)</code> <code>MONTH()</code> <code>DAY()</code> <code>DATEDIF(开始,结束,"Y/M/D")</code> <code>DATE(年,月,日)</code>。字段名直接引用，含空格的用 <code>[方括号]</code>。';
    const wrap = document.createElement('div');
    wrap.appendChild(lbl); wrap.appendChild(ta); wrap.appendChild(help);
    body.appendChild(wrap);
    extra = { get: () => ta.value };
  } else if (type === 'link') {
    const lbl = document.createElement('label'); lbl.className = 'nt-field-label'; lbl.textContent = '关联目标表';
    const sel = document.createElement('select'); sel.className = 'nt-input';
    const tables = dbTableList().filter((t) => t.id !== docId);
    if (tables.length) {
      tables.forEach((t) => { const o = document.createElement('option'); o.value = t.id; o.textContent = stripHtml(t.text) || '未命名'; sel.appendChild(o); });
    } else {
      const o = document.createElement('option'); o.value = ''; o.textContent = '（暂无可关联的表）'; sel.appendChild(o);
    }
    const wrap = document.createElement('div');
    wrap.appendChild(lbl); wrap.appendChild(sel);
    body.appendChild(wrap);
    extra = { get: () => sel.value };
  }
  const actionsRow = document.createElement('div'); actionsRow.className = 'nt-actions';
  const cancel = document.createElement('button'); cancel.className = 'nt-btn'; cancel.textContent = '取消';
  cancel.onclick = () => closePicker(pop);
  const ok = document.createElement('button'); ok.className = 'nt-btn primary'; ok.textContent = '确定';
  ok.onclick = () => {
    const name = nameInp.value.trim();
    if (!name) { toast('请输入列名称'); return; }
    if ((st().dbFields || []).some((f: DbField) => dbFieldName(f) === name)) { toast('已存在同名列'); return; }
    const def: any = { name, type };
    if (type === 'date') def.dateType = getExtra() || 'date';
    else if (type === 'select' || type === 'multi_select') {
      const os = getExtra();
      if (!os.length) { toast('请输入至少一个选项'); return; }
      def.options = os;
    } else if (type === 'formula') {
      const expr = String(getExtra() || '').trim();
      if (!expr) { toast('请输入公式表达式'); return; }
      def.expr = expr;
    } else if (type === 'link') {
      const t = getExtra();
      if (!t) { toast('请选择关联目标表'); return; }
      def.target = t;
    }
    closePicker(pop);
    onAdd(def);
  };
  actionsRow.appendChild(cancel); actionsRow.appendChild(ok);
  body.appendChild(actionsRow);
  pop.appendChild(body);
  document.body.appendChild(pop);
  deps.placePop(pop, 320, 440, anchor || null); /* FIX-P3-22: 用调用方透传的锚点 rect，不再读模块级 _fieldTypeMenuRect */
  initDragClose(pop, () => closePicker(pop));
  ntAutoClose(pop);
  nameInp.focus();
}
/* ============================================================
   多维表格：列配置（公式 / 关联 / 转文本）
   ============================================================ */
export function openDbFieldConfigDialog(docId: any, fieldName: string, mode: string): void {
  const pop = document.createElement('div'); pop.className = 'nt-pop'; pop.dataset.pop = 'fcfg';
  pop.style.width = '304px';
  const title = document.createElement('div'); title.className = 'nt-pop-title';
  title.textContent = mode === 'formula' ? '公式列配置' : mode === 'link' ? '关联列配置' : '列类型';
  pop.appendChild(title);
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:8px';
  if (mode === 'formula') {
    const def: any = (st().dbFields || []).find((f: DbField) => dbFieldName(f) === fieldName);
    const cur = dbFieldType(def) === 'formula' ? (def.expr || '') : '';
    const lbl = document.createElement('label'); lbl.className = 'nt-field-label';
    lbl.textContent = '公式表达式（列：' + fieldName + '）';
    const ta = document.createElement('textarea'); ta.className = 'nt-input'; ta.rows = 4; ta.value = cur;
    const help = document.createElement('div'); help.className = 'db-formula-box';
    help.innerHTML = '数字：ABS ROUND INT MAX MIN SUM AVG COUNT · 文本：LEN LEFT UPPER TRIM CONCAT IF · 日期：<code>TODAY()</code> <code>YEAR(字段)</code> <code>MONTH()</code> <code>DAY()</code> <code>DATEDIF(开始,结束,"Y/M/D")</code> <code>DATE(年,月,日)</code>。字段名直接引用，含空格的用 <code>[方括号]</code>。';
    body.appendChild(lbl); body.appendChild(ta); body.appendChild(help);
    const actionsRow = document.createElement('div'); actionsRow.className = 'nt-actions';
    const cancel = document.createElement('button'); cancel.className = 'nt-btn'; cancel.textContent = '取消';
    cancel.onclick = () => closePicker(pop);
    const ok = document.createElement('button'); ok.className = 'nt-btn primary'; ok.textContent = '保存';
    ok.onclick = () => {
      const expr = ta.value.trim();
      if (!expr) { toast('请输入公式表达式'); return; }
      deps.commit((s: any) => {
        const idx = (s.dbFields || []).findIndex((f: DbField) => dbFieldName(f) === fieldName);
        if (idx < 0) return;
        s.dbFields[idx] = { name: fieldName, type: 'formula', expr };
      }, { snapshot: true });
      closePicker(pop);
      deps.forceRender(); toast('公式已保存：' + expr);
    };
    actionsRow.appendChild(cancel); actionsRow.appendChild(ok);
    body.appendChild(actionsRow);
  } else if (mode === 'link') {
    const def: any = (st().dbFields || []).find((f: DbField) => dbFieldName(f) === fieldName);
    const curTarget = def && def.target || '';
    const tables = dbTableList().filter((t) => t.id !== docId);
    const lbl = document.createElement('label'); lbl.className = 'nt-field-label';
    lbl.textContent = '关联目标表（列：' + fieldName + '）';
    const sel = document.createElement('select'); sel.className = 'nt-input';
    if (tables.length) {
      tables.forEach((t) => {
        const o = document.createElement('option'); o.value = t.id; o.textContent = stripHtml(t.text) || '未命名';
        if (t.id === curTarget) o.selected = true;
        sel.appendChild(o);
      });
    } else {
      const o = document.createElement('option'); o.value = ''; o.textContent = '（暂无可关联的表）'; sel.appendChild(o);
    }
    body.appendChild(lbl); body.appendChild(sel);
    const actionsRow = document.createElement('div'); actionsRow.className = 'nt-actions';
    const cancel = document.createElement('button'); cancel.className = 'nt-btn'; cancel.textContent = '取消';
    cancel.onclick = () => closePicker(pop);
    const ok = document.createElement('button'); ok.className = 'nt-btn primary'; ok.textContent = '保存';
    ok.onclick = () => {
      const target = sel.value;
      if (!target) { toast('请选择关联目标表'); return; }
      deps.commit((s: any) => {
        const idx = (s.dbFields || []).findIndex((f: DbField) => dbFieldName(f) === fieldName);
        if (idx < 0) return;
        s.dbFields[idx] = { name: fieldName, type: 'link', target };
      }, { snapshot: true });
      closePicker(pop);
      deps.forceRender(); toast('关联表已更新');
    };
    actionsRow.appendChild(cancel); actionsRow.appendChild(ok);
    body.appendChild(actionsRow);
  } else {
    const cap = document.createElement('div'); cap.className = 'nt-caption';
    cap.textContent = '将该列转为普通文本列？原数据保留；若原为公式列，将把当前计算结果固化为文本。';
    body.appendChild(cap);
    const actionsRow = document.createElement('div'); actionsRow.className = 'nt-actions';
    const cancel = document.createElement('button'); cancel.className = 'nt-btn'; cancel.textContent = '取消';
    cancel.onclick = () => closePicker(pop);
    const ok = document.createElement('button'); ok.className = 'nt-btn primary'; ok.textContent = '转换';
    ok.onclick = () => {
      deps.commit((s: any) => {
        const idx = (s.dbFields || []).findIndex((f: DbField) => dbFieldName(f) === fieldName);
        if (idx < 0) return;
        const def = s.dbFields[idx];
        if (dbFieldType(def) === 'formula') {
          deps.getDbRows(docId).forEach((n) => { /* FIX-H-08 */
            if (!n.db) n.db = {};
            n.db[fieldName] = dbFormulaDisplay(dbRawValue(n, def));
          });
        }
        s.dbFields[idx] = fieldName;
      }, { snapshot: true });
      closePicker(pop);
      deps.forceRender(); toast('已转为文本列');
    };
    actionsRow.appendChild(cancel); actionsRow.appendChild(ok);
    body.appendChild(actionsRow);
  }
  pop.appendChild(body);
  document.body.appendChild(pop);
  deps.placePop(pop, 320, 420, null);
  initDragClose(pop, () => closePicker(pop));
  ntAutoClose(pop);
}
export function dbLinkTitle(id: any): string {
  const m = deps.N(id);
  return m ? stripHtml(m.text || '未命名') : '已删除记录';
}
export function openLinkPicker(anchorEl: any, rowId: any, fieldName: string, targetId: any): void {
  const existing = document.querySelector('.link-picker');
  if (existing) closePicker(existing);
  if (!targetId || !deps.N(targetId)) { toast('请先在列菜单中设置关联目标表'); return; }
  const target = deps.N(targetId);
  const rows = target.children.map((id: any) => deps.N(id)).filter((n: any) => n && !deps.isFolder(n.id) && !n._deleted);
  if (!rows.length) { toast('目标表暂无记录'); return; }
  const curRow = deps.N(rowId);
  const cur: any[] = Array.isArray(curRow && curRow.db && curRow.db[fieldName]) ? (curRow.db[fieldName]) : [];
  const picker = document.createElement('div'); picker.className = 'link-picker';
  picker.innerHTML = `<h4>关联：${esc(stripHtml(target.text) || '未命名')}</h4><div class="link-picker-list"></div><div class="link-picker-actions"><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>确定</button></div>`;
  const list = picker.querySelector('.link-picker-list') as HTMLElement;
  const cbMap: Record<string, HTMLInputElement> = {};
  rows.forEach((r: any) => {
    const item = document.createElement('label'); item.className = 'link-picker-item';
    const cb = document.createElement('input'); cb.type = 'checkbox';
    cb.checked = cur.includes(r.id);
    item.appendChild(cb);
    const span = document.createElement('span'); span.textContent = stripHtml(r.text) || '(空)';
    item.appendChild(span);
    /* 【修复 F-14】删除手动 onclick 取反：label 默认会将点击转发给内部 checkbox，配合手动取反导致一次点击切换两次、净零（关联字段无法勾选） */
    list.appendChild(item);
    cbMap[r.id] = cb;
  });
  document.body.appendChild(picker);
  deps.placePop(picker, 340, 440, anchorEl);

  initDragClose(picker, () => closePicker(picker));
  (picker.querySelector('[data-cancel]') as HTMLElement).onclick = () => closePicker(picker);
  (picker.querySelector('[data-ok]') as HTMLElement).onclick = () => {
    const ids = Object.keys(cbMap).filter((id) => cbMap[id].checked);
    deps.actions.setDbCell(rowId, fieldName, ids);
    closePicker(picker);
    deps.forceRender();
  };
  bindPickerAutoClose(picker);
}
export function openMultiSelectPicker(anchorEl: any, rowId: any, fieldName: string, opts: string[]): void {
  const existing = document.querySelector('.nt-pop[data-pop="msel"]');
  if (existing) closePicker(existing);
  const rw = deps.N(rowId);
  const pop = document.createElement('div'); pop.className = 'nt-pop'; pop.dataset.pop = 'msel';
  pop.style.width = '272px';
  const title = document.createElement('div'); title.className = 'nt-pop-title';
  title.textContent = '多选：' + fieldName;
  pop.appendChild(title);
  const list = document.createElement('div'); list.className = 'nt-opt-list';
  const render = (): void => {
    const r2 = deps.N(rowId);
    const cur: any[] = Array.isArray(r2 && r2.db && r2.db[fieldName]) ? (r2.db[fieldName]) : [];
    list.innerHTML = '';
    if (!opts.length) {
      const empty = document.createElement('div'); empty.className = 'nt-caption'; empty.style.padding = '4px 8px';
      empty.textContent = '暂无选项，在下方输入并回车新增。';
      list.appendChild(empty);
    }
    opts.forEach((o) => {
      const checked = cur.includes(o);
      const row = document.createElement('div'); row.className = 'nt-item';
      const box = document.createElement('span'); box.className = 'nt-opt-check' + (checked ? ' on' : '');
      box.textContent = checked ? '✓' : '';
      const name = document.createElement('span'); name.textContent = o; name.style.flex = '1';
      row.appendChild(box); row.appendChild(name);
      row.onclick = () => {
        const r3 = deps.N(rowId);
        const c: any[] = Array.isArray(r3 && r3.db && r3.db[fieldName]) ? (r3.db[fieldName]) : [];
        const next = c.includes(o) ? c.filter((x) => x !== o) : [...c, o];
        deps.actions.setDbCell(rowId, fieldName, next);
        deps.forceRender();
        render();
      };
      list.appendChild(row);
    });
  };
  render();
  pop.appendChild(list);
  const addWrap = document.createElement('div'); addWrap.className = 'nt-opt-add';
  const addInp = document.createElement('input'); addInp.className = 'nt-input'; addInp.placeholder = '输入后回车添加选项…';
  addWrap.appendChild(addInp);
  addInp.onkeydown = (e) => {
    if (e.key === 'Enter' && addInp.value.trim()) {
      const v = addInp.value.trim();
      if (!opts.includes(v)) {
        opts.push(v);
        deps.commit((s: any) => {
          const idx = (s.dbFields || []).findIndex((f: DbField) => dbFieldName(f) === fieldName);
          if (idx >= 0 && s.dbFields[idx] && typeof s.dbFields[idx] === 'object') {
            if (!Array.isArray(s.dbFields[idx].options)) s.dbFields[idx].options = [];
            if (!s.dbFields[idx].options.includes(v)) s.dbFields[idx].options.push(v);
          }
        }, { snapshot: true });
      }
      const r2 = deps.N(rowId);
      const c: any[] = Array.isArray(r2 && r2.db && r2.db[fieldName]) ? (r2.db[fieldName]) : [];
      deps.actions.setDbCell(rowId, fieldName, c.includes(v) ? c : [...c, v]);
      addInp.value = '';
      deps.forceRender();
      render();
    }
  };
  pop.appendChild(addWrap);
  document.body.appendChild(pop);
  deps.placePop(pop, 300, 380, anchorEl);

  initDragClose(pop, () => closePicker(pop));
  ntAutoClose(pop);
  addInp.focus();
}
/* FIX-P3-25: 清理函数改为集合跟踪（多表并排未来兼容）——原模块级单变量 _lastPanCleanup 在多 wrap 并排渲染时
   会被后者覆盖，先绑 wrap 的 document 监听连带被清；Set 各自跟踪：新绑前只清扫已脱离 DOM 的旧 wrap（拖动中重建/
   mouseup 丢失场景下其 document 监听不再需要），未脱离的并排 wrap 保留各自清理互不影响。当前单表渲染行为不变。 */
export const _panCleanups = new Set<any>();
export function attachPanScroll(wrap: any): void {
  /* FIX-M-13 幂等：同 wrap 重复绑定时先拆旧监听，避免叠加 */
  if (wrap._panCleanup) { try { wrap._panCleanup(); } catch(err){console.warn('[JU] caught error',err);} wrap._panCleanup = null; }
  /* FIX-P3-25: 清扫已脱离 DOM 的旧 wrap 的残留 document 监听 */
  _panCleanups.forEach((c) => { try { const w = c._wrap; if (w && !w.isConnected) c(); } catch(e){console.warn('[JU] caught error',e);} });
  let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
  const onMove = (e: MouseEvent): void => {
    if (!dragging) return;
    wrap.scrollLeft = sl - (e.clientX - sx);
    wrap.scrollTop = st - (e.clientY - sy);
  };
  const onUp = (): void => {
    if (!dragging) return;
    dragging = false;
    wrap.style.cursor = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  const onDown = (e: MouseEvent): void => {
    if (e.shiftKey) return;
    if ((e.target as Element).closest('input,select,button,textarea,[contenteditable],.db-col-resize,.db-row-resize,.db-cell-date,tbody tr[data-msid]')) return; /* 批次-终极：数据行按下不再触发表格平移，避免与行拖拽排序冲突 */
    dragging = true; sx = e.clientX; sy = e.clientY; sl = wrap.scrollLeft; st = wrap.scrollTop;
    wrap.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  };
  wrap.addEventListener('mousedown', onDown);
  /* FIX-M-13 集中清理：解绑 wrap 的 mousedown，并兜底移除可能仍挂在 document 上的 mousemove/mouseup（拖动中重建/mouseup 丢失场景），同时复位 grabbing 光标。
     FIX-P3-25: 清理函数登记入 _panCleanups 集合（带 _wrap 引用供脱离 DOM 清扫），不再覆盖模块级单变量 */
  wrap._panCleanup = () => {
    wrap.removeEventListener('mousedown', onDown);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (wrap.style.cursor === 'grabbing') wrap.style.cursor = '';
    _panCleanups.delete(wrap._panCleanup);
    wrap._panCleanup = null;
  };
  wrap._panCleanup._wrap = wrap;
  _panCleanups.add(wrap._panCleanup);
}
export function closePicker(el: any): void {
  if (!el) return;
  /* FIX-CLEANUP-1: 支持 cleanup 数组——dbSfAutoClose/ntAutoClose/bindPickerAutoClose 可能叠加挂 document 监听，
     原单槽 _cleanup 互相覆盖导致其中一个监听永不移除；数组逐个回收。 */
  if (el._cleanups && el._cleanups.length) {
    el._cleanups.forEach((fn: () => void) => { try { fn(); } catch(e){console.warn('[JU] caught error',e);} });
    el._cleanups.length = 0;
  }
  /* FIX-CLEANUP-3（B-4）: _cleanups 与旧 _cleanup 可能并存（罕见）——数组清完后再兜底清单槽，
     不留监听残余；移除 else 分支避免「空数组存在但 _cleanup 也有值」时只清一个 */
  if (el._cleanup) { try { el._cleanup(); } catch(e){console.warn('[JU] caught error',e);} el._cleanup = null; }
  if (el.parentNode) el.remove();
  window._popAnchor = null; /* FIX-P1-1: 统一清残留锚点——closePicker 覆盖 tag-palette/date-picker 等全部浮窗关闭路径 */
}
export function bindPickerAutoClose(el: any): void {
  const _shouldClose = (e: MouseEvent): void => { if (!(e.target as Element).closest('.date-picker, .region-picker')) closePicker(el); };
  const onDocDown = (e: MouseEvent): void => _shouldClose(e);
  const onDocTouch = (e: Event): void => _shouldClose(e as MouseEvent);
  if (!el._cleanups) el._cleanups = [];
  el._cleanups.push(() => {
    document.removeEventListener('mousedown', onDocDown);
    document.removeEventListener('touchstart', onDocTouch);
  });
  setTimeout(() => {
    /* FIX-CLEANUP-1: 同一任务内已被关闭（isConnected=false）则不再挂监听，防 detached 元素泄漏 document 监听 */
    if (!el.isConnected) return;
    document.addEventListener('mousedown', onDocDown);
    /* FIX-S-8: 触屏场景同样自动关闭——原仅 mousedown，移动端 touchstart 不触发 mousedown，浮窗不自动关闭 */
    document.addEventListener('touchstart', onDocTouch, { passive: true });
  }, 0);
}
export function openTimePicker(anchorEl: any, callback: (val: any) => void, current: any): void {
  const existing = document.querySelector('.date-picker');
  if (existing) closePicker(existing);
  const picker = document.createElement('div');
  picker.className = 'date-picker';
  picker.innerHTML = `
    <div class="dp-row">
      <select id="dpType">
        <option value="date">单日期</option>
        <option value="datetime">日期时间</option>
        <option value="range">日期范围</option>
        <option value="datetimerange">日期时间范围</option>
      </select>
    </div>
    <div class="dp-row">
      <input type="date" id="dpStart">
      <input type="time" id="dpStartTime" style="display:none">
    </div>
    <div class="dp-row" id="dpEndRow" style="display:none">
      <input type="date" id="dpEnd">
      <input type="time" id="dpEndTime" style="display:none">
    </div>
    <div class="dp-actions">
      <button class="btn" id="dpCancel">取消</button>
      <button class="btn primary" id="dpOk">确定</button>
    </div>`;
  const typeSel = picker.querySelector('#dpType') as HTMLSelectElement;
  const dpStart = picker.querySelector('#dpStart') as HTMLInputElement;
  const dpStartTime = picker.querySelector('#dpStartTime') as HTMLInputElement;
  const dpEndRow = picker.querySelector('#dpEndRow') as HTMLElement;
  const dpEnd = picker.querySelector('#dpEnd') as HTMLInputElement;
  const dpEndTime = picker.querySelector('#dpEndTime') as HTMLInputElement;
  document.body.appendChild(picker);
  deps.placePop(picker, 280, 300, anchorEl);

  initDragClose(picker, () => closePicker(picker));
  if (current && typeof current === 'object') {
    typeSel.value = current.type || 'date';
    if (current.start) { const parts = current.start.split(/[ T]/); dpStart.value = parts[0] || ''; if (parts[1]) dpStartTime.value = parts[1]; }
    if (current.end) { const parts = current.end.split(/[ T]/); dpEnd.value = parts[0] || ''; if (parts[1]) dpEndTime.value = parts[1]; }
  } else {
    let sd = '', st = '';
    if (typeof current === 'string' && current) {
      const parts = current.split(/[ T]/);
      sd = parts[0] || '';
      if (parts[1]) st = parts[1];
    }
    dpStart.value = sd || todayStr();
    if (st) dpStartTime.value = st;
  }
  const updateVis = (): void => {
    const t = typeSel.value;
    dpStartTime.style.display = (t === 'datetime' || t === 'datetimerange') ? 'block' : 'none';
    dpEndTime.style.display = (t === 'datetimerange') ? 'block' : 'none';
    dpEndRow.style.display = (t === 'range' || t === 'datetimerange') ? 'flex' : 'none';
    if (!dpStart.value) dpStart.value = todayStr();
    if ((t === 'range' || t === 'datetimerange') && !dpEnd.value) dpEnd.value = dpStart.value;
  };
  typeSel.onchange = updateVis; updateVis();
  (picker.querySelector('#dpCancel') as HTMLElement).onclick = () => closePicker(picker);
  (picker.querySelector('#dpOk') as HTMLElement).onclick = () => {
    const t = typeSel.value;
    let val: any;
    const sd = dpStart.value, st = dpStartTime.value, ed = dpEnd.value, et = dpEndTime.value;
    if (t === 'date') val = { type: 'date', start: sd };
    else if (t === 'datetime') val = { type: 'datetime', start: sd + (st ? ' ' + st : '') };
    else if (t === 'range') val = { type: 'range', start: sd, end: ed };
    else val = { type: 'datetimerange', start: sd + (st ? ' ' + st : ''), end: ed + (et ? ' ' + et : '') };
    callback(val); closePicker(picker);
  };
  bindPickerAutoClose(picker);
}
export function openRegionPicker(anchorEl: any, callback: (val: any) => void, current: any): void {
  const existing = document.querySelector('.region-picker');
  if (existing) closePicker(existing);
  const picker = document.createElement('div');
  picker.className = 'region-picker';
  /* FIX16-P1：省级 / 市级数据统一取自 src/utils/regions.ts —— 34 个省级行政区
     （含台湾省 / 香港特别行政区 / 澳门特别行政区）+ 完整地级列表，
     不再使用原内联的 9 省 × 8 市简表（取证：90过程材料/tmp/fix16/location_before.log） */
  const provinces = getProvinces();
  picker.innerHTML = `
    <div class="field"><label>国家</label><select id="rpCountry"><option>${DEFAULT_COUNTRY}</option></select></div>
    <div class="field"><label>省份</label><select id="rpProvince">${provinces.map((p) => `<option>${p}</option>`).join('')}</select></div>
    <div class="field"><label>城市</label><select id="rpCity"></select></div>
    <div class="dp-actions"><button class="btn" id="rpCancel">取消</button><button class="btn primary" id="rpOk">确定</button></div>`;
  document.body.appendChild(picker);
  deps.placePop(picker, 340, 260, anchorEl);

  initDragClose(picker, () => closePicker(picker));
  const provSel = picker.querySelector('#rpProvince') as HTMLSelectElement;
  const citySel = picker.querySelector('#rpCity') as HTMLSelectElement;
  /* FIX16-P2：省级变更即级联刷新城市（选「香港特别行政区」→ 香港岛 / 九龙 / 新界；
     选「台湾省」→ 台北市 / 新北市 …） */
  const updateCities = (): void => { citySel.innerHTML = getCities(provSel.value).map((c) => `<option>${c}</option>`).join(''); };
  updateCities();
  provSel.onchange = updateCities;
  if (current) {
    /* FIX16-P1：解析兼容旧版 "中国-省-市" 与新版 "中国 / 省 / 市"（历史数据可无损回填下拉框） */
    const cur = parseLocation(current);
    if (cur.province && isKnownProvince(cur.province)) provSel.value = cur.province;
    updateCities();
    if (cur.city && getCities(provSel.value).includes(cur.city)) citySel.value = cur.city;
  }
  (picker.querySelector('#rpCancel') as HTMLElement).onclick = () => closePicker(picker);
  (picker.querySelector('#rpOk') as HTMLElement).onclick = () => {
    /* FIX16-P1：统一存储格式 "国家 / 省 / 市"（契约见 src/core/constants.ts） */
    const v = joinLocation(DEFAULT_COUNTRY, provSel.value, citySel.value);
    callback(v); closePicker(picker);
  };
  bindPickerAutoClose(picker);
}
export function showDbRowContext(e: MouseEvent, id: any): void {
  const n = deps.N(id);
  if (!n) return;
  showContextMenu([
    { ic: '↑', txt: '上移一行', fn: () => { const p = deps.N(n.parent); if (!p) return; const i = p.children.indexOf(id); if (i <= 0) return; deps.commit((s: any) => { const pp = s.nodes[p.id]; if (!pp) return;[pp.children[i - 1], pp.children[i]] = [pp.children[i], pp.children[i - 1]]; }, { snapshot: true }); deps.forceRender(); } },
    { ic: '↓', txt: '下移一行', fn: () => { const p = deps.N(n.parent); if (!p) return; const i = p.children.indexOf(id); if (i >= p.children.length - 1) return; deps.commit((s: any) => { const pp = s.nodes[p.id]; if (!pp) return;[pp.children[i + 1], pp.children[i]] = [pp.children[i], pp.children[i + 1]]; }, { snapshot: true }); deps.forceRender(); } },
    { sep: true },
    { ic: '📅', txt: '添加到日历', fn: () => { deps.actions.setNodeDate(id, todayStr()); toast('已添加到日历'); } },
    { ic: '✏️', txt: '重命名', fn: () => { appPrompt('重命名：', stripHtml(n.text), (t: string | null) => { if (t === null) return; deps.commit((s: any) => { const nn = s.nodes[id]; if (!nn) return; nn.text = t.trim(); nn.updatedAt = deps.nowSeq(); }, { snapshot: true, op: 'updateText', opArgs: { id } }); deps.forceRender(); }); } },
    { sep: true },
    { ic: '🗑', txt: '移入回收站', danger: true, fn: () => { deps.actions.moveToTrash(id); deps.forceRender(); toast('已移入回收站'); } }
  ], e);
}
