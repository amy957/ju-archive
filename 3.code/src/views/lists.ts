/**
 * M1-1 · 批次 AC · 列表类视图（标签 / 模板 / 回收站 / 历史 / 星标）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - renderTitleWithBack（四视图统一标题行）........................... 17726-17739
 *   - renderStarredView ................................................ 17740-17753
 *   - renderTemplatesView .............................................. 17754-17805
 *   - _trashBatchRestore / _trashBatchPurge（批次2·回收站多选）......... 17806-17827
 *   - renderTrashView .................................................. 17828-17878
 *   - renderTagsView ................................................... 18153-18191
 *   - renderTagNodes ................................................... 18196-18225
 *   - renderHistoryView ................................................ 18226-18308
 *
 * 约束：DOM 结构、类名（files-wrap / files-grid / file-card / files-toolbar / tag-chip /
 *   history-item）、内联样式、工具栏按钮文案、contextmenu 菜单项与顺序、提示文案、
 *   两阶段渲染（L7-W4）与 FIX/批次注释逐字保留。
 *   未拆分业务符号统一走 `deps` 依赖注入容器（原直接引用改为 `deps.xxx`），由 src/main.ts 装配：
 *     state / ui / commit / N / actions / getCurrentDoc / isFolder / addNodeTo / forceRender /
 *     saveUI / safeNavigate / setActiveKey / renderFileCard / getNodeSvg / fmtRelative /
 *     getTagIndexCache（产品 `_tagIndexCache` 的 `let` 绑定，跨模块以访问器暴露）/
 *     buildTagIndex / l7Skeleton / l7TagIndexWhenReady / _l7IsTagsView /
 *     _mSel / _mSelSetOrder / _mSelHas / _mSelClick / _mSelSelectAll /
 *     loadVersionList / _searchHayCache / docSubtree / purgeNodeMeta / migrateWordToOutline。
 *   已拆分模块直接 import：$ / esc / stripHtml / clone / pad（core/utils）；
 *     toast / appConfirm / showContextMenu（ui/common）；renderSidebar（ui/sidebar）。
 */
import { $, esc, stripHtml, clone, pad } from '../core/utils';
import { toast, appConfirm, showContextMenu } from '../ui/common';
import { renderSidebar } from '../ui/sidebar';
/* v2.1 fix10 · P2：内置多维表格模板的列定义与行数（fix9 已落 canonical 10 列 / 3 行空白） */
import { DEFAULT_DB_FIELDS, DEFAULT_DB_ROW_COUNT } from '../core/constants';

/** 列表类视图依赖注入容器（承接原同作用域内、尚未拆分到模块的既有业务实现）。 */
export interface ListsDeps {
  /** 全局数据状态（对应产品的 `state`：nodes / rootId / templates / trashed / tagColors） */
  state: any;
  /** 全局 UI 状态对象（对应产品的 `ui`） */
  ui: any;
  /** 不可变提交（对应产品的 `commit`） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** 业务动作集合（removeTemplate / restoreFromTrash / purgeTrash） */
  actions: any;
  /** 当前文档（对应产品的 `getCurrentDoc()`） */
  getCurrentDoc: () => any;
  /** 文件夹判定（对应产品的 `isFolder(id)`） */
  isFolder: (id: any) => boolean;
  /** 追加节点（对应产品的 `addNodeTo(st,parentId,index,init)`） */
  addNodeTo: (st: any, parentId: any, index: number, init?: any) => any;

  /* 渲染调度 */
  forceRender: () => void;
  saveUI: () => void;
  safeNavigate: (fn: () => void) => void;
  setActiveKey: (k: any) => void;

  /* 卡片 / 图标 / 时间格式化 */
  renderFileCard: (id: any, n: any, isFolderFlag?: boolean) => HTMLElement;
  getNodeSvg: (id: any) => string;
  fmtRelative: (ts: any, short?: boolean) => string;

  /* 标签索引（两阶段渲染） */
  getTagIndexCache: () => any;
  buildTagIndex: () => Map<string, any>;
  l7Skeleton: (kind: string, opts: any) => HTMLElement;
  l7TagIndexWhenReady: (cb: () => void) => void;
  _l7IsTagsView: () => boolean;

  /* 多选（共享单例 + 入口函数） */
  _mSel: any;
  _mSelSetOrder: (type: any, ids?: any) => void;
  _mSelHas: (id: any) => boolean;
  _mSelClick: (type: any, id: any, ev?: any, order?: any) => void;
  _mSelSelectAll: (type: any, ids?: any) => void;

  /* 版本历史 */
  loadVersionList: (docId: any) => Promise<any[]>;
  /** 搜索 hay 缓存（产品 `_searchHayCache`，LRU · 仅需 clear） */
  _searchHayCache: { clear: () => void };
  docSubtree: (id: any) => any[];
  purgeNodeMeta: (s: any, id: any) => void;
  migrateWordToOutline: (s: any) => any;
}

/** 依赖注入容器（模块内安全占位：加载即不抛 ReferenceError）。 */
export const deps: ListsDeps = {
  state: { nodes: {}, rootId: null, templates: [], trashed: [] },
  ui: {},
  commit: () => undefined,
  N: () => null,
  actions: {},
  getCurrentDoc: () => null,
  isFolder: () => false,
  addNodeTo: () => null,

  forceRender: () => undefined,
  saveUI: () => undefined,
  safeNavigate: () => undefined,
  setActiveKey: () => undefined,

  renderFileCard: () => document.createElement('div'),
  getNodeSvg: () => '',
  fmtRelative: () => '',

  getTagIndexCache: () => null,
  buildTagIndex: () => new Map<string, any>(),
  l7Skeleton: () => document.createElement('div'),
  l7TagIndexWhenReady: () => undefined,
  _l7IsTagsView: () => false,

  _mSel: { type: null, ids: new Set(), anchorId: null, mode: 'single', order: [] },
  _mSelSetOrder: () => undefined,
  _mSelHas: () => false,
  _mSelClick: () => undefined,
  _mSelSelectAll: () => undefined,

  loadVersionList: () => Promise.resolve([]),
  _searchHayCache: { clear: () => undefined },
  docSubtree: () => [],
  purgeNodeMeta: () => undefined,
  migrateWordToOutline: (s: any) => s,
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function injectListsDeps(next: Partial<ListsDeps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   星标 / 模板 / 回收站
   ============================================================ */
/* 【P2-2】星标 / 模板 / 回收站 / 历史四视图统一标题行：
   返回按钮固定在标题左侧、与标题同一水平线、标题左对齐（原先四处位置各异）。 */
/**
 * 视图标题条（对应产品件 `renderViewTitle`，canonical 6414-6421）。
 *
 * 独立于 `renderTitleWithBack`（后者含返回按钮）：图谱 / 视图类页面只输出
 * `.doc-header > .doc-header-title` 结构，文字由调用方给定。
 * 此前 `injectGraphDeps({ renderViewTitle: () => document.createElement('div') })` 注入空壳，
 * 图谱页顶部标题恒为空，本函数为真实实现。
 */
export function renderViewTitle(title: string): HTMLElement {
  const bar = document.createElement('div'); bar.className = 'doc-header';
  const name = document.createElement('div'); name.className = 'doc-header-title';
  name.textContent = title;
  bar.appendChild(name);
  /* 【fix26-p3】星标列占位：无星级时同样保留 .doc-header-stars，右侧网格列恒被占位撑开（与大纲同构） */
  const stars = document.createElement('span'); stars.className = 'doc-header-stars';
  bar.appendChild(stars);
  /* 【fix26-p2】补 .doc-header-line：标题行结构与大纲完全一致（标题居中 + 同宽横线） */
  const line = document.createElement('div'); line.className = 'doc-header-line';
  bar.appendChild(line);
  return bar;
}

export function renderTitleWithBack(title: string, onBack: () => void): HTMLElement {
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px';
  const back = document.createElement('button');
  back.className = 'btn'; back.style.fontSize = '.82em'; back.textContent = '← 返回';
  back.onclick = onBack;
  const t = document.createElement('div');
  t.style.cssText = 'font-size:1.05em;font-weight:700;color:var(--title)';
  t.textContent = title;
  bar.appendChild(back); bar.appendChild(t);
  return bar;
}
export function renderStarredView(): HTMLElement {
  const wrap = document.createElement('div'); wrap.className = 'files-wrap';
  /* 批次 3 · P2-2：与模板 / 回收站 / 历史同口径——返回一律回到「资料库根」，
     否则从某文档进入星标再返回会落回原文档（四按钮行为不一致）。 */
  wrap.appendChild(renderTitleWithBack('星标文件', () => { deps.ui.view = 'auto'; deps.ui.currentDocId = deps.state.rootId; deps.saveUI(); deps.safeNavigate(() => { deps.setActiveKey('nav:files'); }); }));
  const items: any[] = [];
  for (const id in deps.state.nodes) { const n = deps.state.nodes[id]; if (n.starred > 0 && !deps.isFolder(id) && !n._deleted) items.push(n); }
  items.sort((a, b) => (b.starred || 0) - (a.starred || 0));
  if (!items.length) { const e = document.createElement('div'); e.className = 'empty-state'; e.textContent = '暂无星标文件'; wrap.appendChild(e); return wrap; }
  deps._mSelSetOrder('files', items.map(n => n.id));
  const grid = document.createElement('div'); grid.className = 'files-grid';
  items.forEach(n => grid.appendChild(deps.renderFileCard(n.id, n, false)));
  wrap.appendChild(grid); return wrap;
}
/* ============================================================
   v2.1 fix10 · P2：模板库内置「多维表格」模板
   ------------------------------------------------------------
   缺陷（P0 取证：90过程材料/tmp/fix10/db_ui_fix10_before.log B 段）：
     模板视图只渲染 state.templates，全新库 state.templates 为空 ⇒ 页面只有
     「暂无模板」空态，用户没有任何「一键建 10 列多维表格」的入口
     （侧栏 #btnNewDb 建出来的表也没有对应模板条目）。
   处置：内置模板不写入 state.templates（不污染用户模板数据、不被「删除模板」误删），
     而是作为恒定第一张卡片渲染；点击时走与 actions.applyDbTemplate 完全相同的落库路径。
   ============================================================ */
/** 内置多维表格模板名（逐字；P3 探针与 spec 用它做文案断言） */
export const BUILTIN_DB_TEMPLATE_NAME = '内置多维表格（10列）';
/**
 * 用内置表格模板新建一个多维表格：新建/复用数据库根 → 建表文档 → applyDbTemplate
 * （10 列表头 + 3 行空白，幂等）→ 跳转到新表。与 session.ts #btnNewDb 同一落库逻辑。
 */
function _createBuiltinDbTable(name: string): void {
  const nodes = deps.state.nodes || {};
  let dbRootId: any = null;
  for (const id in nodes) { if (nodes[id] && nodes[id]._isDbRoot) { dbRootId = id; break; } }
  if (!dbRootId) dbRootId = deps.actions.createDoc('数据库', { _isDbRoot: true, _isFolder: true, dbRoot: true });
  if (!dbRootId) { toast('创建失败'); return; }
  const id = deps.actions.addNode(dbRootId, null, { text: (String(name || BUILTIN_DB_TEMPLATE_NAME)).trim() || BUILTIN_DB_TEMPLATE_NAME, dbRoot: true });
  if (!id) { toast('创建失败'); return; }
  deps.actions.applyDbTemplate(id);
  deps.ui.currentDocId = id; deps.ui.view = 'auto';
  if (deps.ui.navExpanded) deps.ui.navExpanded.database = true;
  deps.saveUI();
  renderSidebar(); deps.forceRender();
  toast('已创建多维表格');
}

export function renderTemplatesView(): HTMLElement {
  const wrap = document.createElement('div'); wrap.className = 'files-wrap';
  /* 批次 3 · P2-2：标题行与返回按钮合并为统一结构（原 innerHTML 标题 + insertBefore 返回按钮两处合一）。
     【L22-final-r2 · 不变量 #57】标题行补挂 .files-toolbar 类（与回收站 head 同口径），
     使 document.querySelector('.files-toolbar .btn') 在模板视图能抓到「← 返回」；
     .files-toolbar 自带 justify-content:flex-end，故显式回写 flex-start 保持标题左对齐。 */
  const _tplBar = renderTitleWithBack('模板', () => { deps.ui.view = 'auto'; deps.ui.currentDocId = deps.state.rootId; deps.saveUI(); deps.safeNavigate(() => { deps.setActiveKey('nav:files'); }); });
  _tplBar.classList.add('files-toolbar'); _tplBar.style.justifyContent = 'flex-start';
  wrap.appendChild(_tplBar);
  const grid = document.createElement('div'); grid.className = 'files-grid';
  /* v2.1 fix10 · P2：内置模板恒定位列第一（与用户自存模板同网格、同卡片样式）
     锚点 data-tpl="builtin-db10" 供 P3 探针 / spec 稳定定位（不依赖文案匹配） */
  const builtin = document.createElement('div');
  builtin.className = 'file-card tpl-builtin';
  builtin.setAttribute('data-tpl', 'builtin-db10');
  builtin.innerHTML = `<div class="file-icon">${deps.getNodeSvg(deps.state.rootId)}</div><div class="file-info"><div class="file-name">${esc(BUILTIN_DB_TEMPLATE_NAME)}</div><div class="file-meta">内置 · ${DEFAULT_DB_FIELDS.length} 列 · ${DEFAULT_DB_ROW_COUNT} 行空白</div></div>`;
  builtin.onclick = () => { _createBuiltinDbTable(BUILTIN_DB_TEMPLATE_NAME); };
  builtin.oncontextmenu = (e: MouseEvent) => {
    e.preventDefault();
    showContextMenu([{ ic: '📄', txt: '使用此模板新建', fn: () => { _createBuiltinDbTable(BUILTIN_DB_TEMPLATE_NAME); } }], e);
  };
  grid.appendChild(builtin);
  const templates = deps.state.templates || [];
  templates.forEach((t: any, ti: number) => {
    const card = document.createElement('div'); card.className = 'file-card';
    card.innerHTML = `<div class="file-icon">${deps.getNodeSvg(deps.state.rootId)}</div><div class="file-info"><div class="file-name">${esc(t.name || '模板')}</div><div class="file-meta">创建于 ${deps.fmtRelative(t.createdAt, false)}</div></div>`;
    card.onclick = () => {
      appConfirm('使用该模板新建文档？', () => {
        let newId: any = null;
        deps.commit((s: any) => {
          const n = deps.addNodeTo(s, s.rootId, 0, { text: t.name + ' 副本' });
          if (!n) return;
          newId = n.id;
          function addOne(data: any, pid: any, at: number): void {
            const init: any = {
              text: data.text || '', done: !!data.done, date: data.date || null,
              time: data.time || null, tags: data.tags || [], note: data.note || null,
              recur: data.recur || null, priority: data.priority || 0,
              starred: data.starred || 0, color: data.color || null,
              showInCal: data.showInCal !== false
            };
            if (data.db) init.db = clone(data.db);
            const nn = deps.addNodeTo(s, pid, at, init);
            if (!nn) return;
            (data.children || []).forEach((c: any, i: number) => addOne(c, nn.id, i));
          }
          const arr = Array.isArray(t.tree) ? t.tree : [];
          arr.forEach((node: any, i: number) => addOne(node, newId, i));
        }, { snapshot: true });
        if (newId) { deps.ui.currentDocId = newId; deps.ui.view = 'auto'; deps.saveUI(); }
        renderSidebar(); deps.forceRender();
        toast('已创建');
      });
    };
    card.oncontextmenu = (e: MouseEvent) => {
      e.preventDefault();
      showContextMenu([
        { ic: '📄', txt: '使用此模板新建', fn: () => card.click() },
        { ic: '🗑', txt: '删除模板', danger: true, fn: () => { appConfirm('删除模板「' + (t.name || '模板') + '」？', () => { deps.actions.removeTemplate(t.id); deps.forceRender(); toast('模板已删除'); }); } }
      ], e);
    };
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  /* v2.1 fix10 · P2：空态只在「无自存模板」时作为提示追加在内置模板卡片下方，
     不再整页空态、不再把内置模板一起吞掉（原实现在 templates 为空时提前 return）。 */
  if (!templates.length) { const e = document.createElement('div'); e.className = 'empty-state'; e.innerHTML = '暂无自存模板<br>在右侧「保存/下载 → 保存为模板」可将当前文档保存为模板'; wrap.appendChild(e); }
  return wrap;
}
/* 【批次2·回收站多选】批量恢复 / 批量彻底删除：逐个按当前 state.trashed 现算索引再调用，
   避免前一项 splice 后索引整体前移导致的错恢复 / 错删除（索引漂移） */
export function _trashBatchRestore(ids: any): number {
  let done = 0;
  Array.from(ids || []).forEach((rid: any) => {
    const i = (deps.state.trashed || []).findIndex((t: any) => t && t.rootId === rid);
    if (i >= 0) { deps.actions.restoreFromTrash(i); done++; }
  });
  deps._mSel.ids = new Set(); deps._mSel.anchorId = null; deps._mSel.mode = 'single';
  renderSidebar(); deps.forceRender();
  return done;
}
export function _trashBatchPurge(ids: any): number {
  let done = 0;
  Array.from(ids || []).forEach((rid: any) => {
    const i = (deps.state.trashed || []).findIndex((t: any) => t && t.rootId === rid);
    if (i >= 0) { deps.actions.purgeTrash(i); done++; }
  });
  deps._mSel.ids = new Set(); deps._mSel.anchorId = null; deps._mSel.mode = 'single';
  deps.forceRender();
  return done;
}
export function renderTrashView(): HTMLElement {
  const wrap = document.createElement('div'); wrap.className = 'files-wrap';
  const trashed = (deps.state.trashed || []).filter((t: any) => t && t.rootId && deps.state.nodes[t.rootId]);
  /* 【批次2·回收站多选】回收站卡片 rootId 顺序数组 = Ctrl / Shift 范围选择与全选的基准序列 */
  const trashRootIds = trashed.map((t: any) => t.rootId);
  const head = document.createElement('div'); head.className = 'files-toolbar';
  /* 批次 3 · P2-2：返回按钮与标题合并为统一标题行；head 仍保留以放置右侧「全选」按钮。
     标题行 margin-right:auto 顶住「全选」，维持原「左标题 / 右全选」布局。 */
  const _titleBar = renderTitleWithBack('回收站', () => { deps.ui.view = 'auto'; deps.ui.currentDocId = deps.state.rootId; deps.saveUI(); deps.safeNavigate(() => { deps.setActiveKey('nav:files'); }); });
  _titleBar.style.marginBottom = '0'; _titleBar.style.marginRight = 'auto';
  head.appendChild(_titleBar);
  const selAllBtn = document.createElement('button'); selAllBtn.className = 'btn'; selAllBtn.textContent = '全选'; selAllBtn.title = '全选回收站（Ctrl/Cmd+A）';
  selAllBtn.onclick = () => { deps._mSelSelectAll('trash', trashRootIds); };
  head.appendChild(selAllBtn);
  wrap.appendChild(head);
  deps._mSelSetOrder('trash', trashRootIds);
  if (!trashed.length) { const e = document.createElement('div'); e.className = 'empty-state'; e.textContent = '回收站是空的'; wrap.appendChild(e); return wrap; }
  const grid = document.createElement('div'); grid.className = 'files-grid';
  trashed.forEach((t: any) => {
    const idx = deps.state.trashed.indexOf(t);
    const root = deps.N(t.rootId); if (!root) return;
    const card = document.createElement('div'); card.className = 'file-card';
    /* 【批次2·回收站多选】data-msid = rootId 供 _mSelPaint 统一点亮；渲染时按当前选择回填 ju-msel */
    card.setAttribute('data-msid', t.rootId);
    if (deps._mSel.type === 'trash' && deps._mSelHas(t.rootId)) card.classList.add('ju-msel');
    card.innerHTML = `<div class="file-icon"><svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg></div><div class="file-info"><div class="file-name">${esc(stripHtml(root.text) || '未命名')}</div><div class="file-meta">删除于 ${deps.fmtRelative(t.deletedAt, false)}</div></div>`;
    /* 【批次2·回收站多选】Ctrl/Cmd 切换 · Shift 按回收站卡片顺序范围选择；普通点击不导航 */
    card.onclick = (e: MouseEvent) => {
      if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) { e.preventDefault(); deps._mSelClick('trash', t.rootId, e, trashRootIds); }
    };
    card.oncontextmenu = (e: MouseEvent) => {
      e.preventDefault();
      const selN = deps._mSel.ids.size;
      /* 多选 >1 且命中右键项：菜单改为批量项（N 个） */
      if (deps._mSel.type === 'trash' && selN > 1 && deps._mSel.ids.has(t.rootId)) {
        const ids = Array.from(deps._mSel.ids);
        showContextMenu([
          { ic: '↺', txt: '恢复所选（' + selN + ' 个）', fn: () => { const n = _trashBatchRestore(ids); toast('已恢复 ' + n + ' 项'); } },
          { ic: '🗑', txt: '彻底删除所选（' + selN + ' 个）', danger: true, fn: () => { appConfirm('彻底删除所选 ' + selN + ' 个？删除后不可恢复', () => { const n = _trashBatchPurge(ids); toast('已彻底删除 ' + n + ' 项'); }); } }
        ], e);
        return;
      }
      showContextMenu([
        { ic: '↺', txt: '恢复', fn: () => { deps.actions.restoreFromTrash(idx); renderSidebar(); deps.forceRender(); toast('已恢复'); } },
        { ic: '🗑', txt: '彻底删除', danger: true, fn: () => { appConfirm('彻底删除后不可恢复？', () => { deps.actions.purgeTrash(idx); deps.forceRender(); toast('已彻底删除'); }); } }
      ], e);
    };
    grid.appendChild(card);
  });
  wrap.appendChild(grid); return wrap;
}
/* ============================================================
   统计 / 标签 / 历史
   ============================================================ */
export function renderTagsView(): HTMLElement {
  const wrap = document.createElement('div'); wrap.className = 'files-wrap'; wrap.style.padding = '20px 24px';
  wrap.innerHTML = '<div style="font-size:1.05em;font-weight:700;margin-bottom:14px;color:var(--title)">标签过滤</div>';
  /* L7-W4 两阶段渲染：冷缓存 → 骨架 chips（阶段 1）→ 分块构建完成后 forceRender（阶段 2） */
  if (!deps.getTagIndexCache()) {
    wrap.appendChild(deps.l7Skeleton('tags', { mode: 'chips', count: 14, hint: '正在构建标签索引…', label: '标签索引' }));
    deps.l7TagIndexWhenReady(function () { if (deps._l7IsTagsView()) deps.forceRender(); });
    return wrap;
  }
  const tagIndex = deps.buildTagIndex();
  const tags = Array.from(tagIndex.entries()).map(([t, ids]: [string, any]) => [t, ids.size] as [string, number]).sort((a, b) => b[1] - a[1]); /* L17-W4 · OP-L17W1-1：tagIndex 值为 Set，计数取 size（原 length ⇒ undefined） */
  if (!tags.length) { const e = document.createElement('div'); e.className = 'empty-state'; e.textContent = '暂无标签，在节点中输入 #标签 即可添加'; wrap.appendChild(e); return wrap; }
  const cloud = document.createElement('div'); cloud.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
  tags.forEach(([t, count]) => {
    const chip = document.createElement('span'); chip.className = 'tag-chip';
    chip.style.cssText = 'display:inline-block;padding:6px 14px;background:var(--accent-soft);color:var(--accent-fg);border-radius:16px;font-size:.88em;cursor:pointer';
    chip.textContent = `#${t} (${count})`;
    chip.onclick = () => {
      const ids = Array.from(tagIndex.get(t) || []); /* L18 · P0-1：Set 无 map()，先转数组（原写法在标签 chip 点击时抛 TypeError） */
      deps._mSelSetOrder('tags', ids); /* r56：chip 点击同步多选视图归属，避免 _mSel.type 残留 'files' */
      const items = ids.map((id: any) => deps.N(id)).filter(Boolean);
      const c = $('#content')!; c.innerHTML = '';
      const w2 = document.createElement('div'); w2.className = 'files-wrap'; w2.style.padding = '20px 24px';
      const backBtn = document.createElement('button'); backBtn.className = 'btn'; backBtn.style.cssText = 'margin-bottom:14px;font-size:.85em';
      backBtn.textContent = '← 返回标签列表'; backBtn.onclick = () => deps.forceRender();
      w2.appendChild(backBtn);
      const h = document.createElement('div'); h.style.cssText = 'font-size:1.05em;font-weight:700;margin-bottom:14px;color:var(--title)';
      h.textContent = '#' + t + ' — ' + items.length + ' 个节点';
      w2.appendChild(h);
      const grid = document.createElement('div'); grid.className = 'files-grid';
      items.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
      items.forEach((n: any) => grid.appendChild(deps.renderFileCard(n.id, n, false)));
      w2.appendChild(grid); c.appendChild(w2);
    };
    cloud.appendChild(chip);
  });
  wrap.appendChild(cloud);
  return wrap;
}
export function renderTagNodes(t: any): HTMLElement {
  /* L7-W4 两阶段渲染：冷缓存 → 骨架（保留返回按钮，导航不因索引未就绪而卡死）→ 完成后 forceRender */
  if (!deps.getTagIndexCache()) {
    const w2s = document.createElement('div'); w2s.className = 'files-wrap'; w2s.style.padding = '20px 24px';
    const backSk = document.createElement('button'); backSk.className = 'btn'; backSk.style.cssText = 'margin-bottom:14px;font-size:.85em';
    backSk.textContent = '← 返回'; backSk.onclick = () => { deps.ui.tagActive = null; deps.ui.view = 'auto'; deps.ui.currentDocId = deps.state.rootId; deps.ui.activeKey = 'nav:tags'; deps.saveUI(); deps.forceRender(); };
    w2s.appendChild(backSk);
    w2s.appendChild(deps.l7Skeleton('tagNodes', { mode: 'rows', count: 8, hint: '正在构建标签索引…', label: '标签索引' }));
    deps.l7TagIndexWhenReady(function () { if (deps._l7IsTagsView()) deps.forceRender(); });
    return w2s;
  }
  const tagIndex = deps.buildTagIndex();
  /* L18 · P0-1：tagIndex 值为 Set（无 map），先转数组再映射（原写法直接 .map 抛 TypeError） */
  const ids = Array.from(tagIndex.get(t) || []);
  deps._mSelSetOrder('tags', ids); /* r56：标签视图归属同步，Ctrl 点击卡片记到 tags 视图 */
  const items = ids.map((id: any) => deps.N(id)).filter(Boolean);
  const w2 = document.createElement('div'); w2.className = 'files-wrap'; w2.style.padding = '20px 24px';
  const backBtn = document.createElement('button'); backBtn.className = 'btn'; backBtn.style.cssText = 'margin-bottom:14px;font-size:.85em';
  backBtn.textContent = '← 返回'; backBtn.onclick = () => { deps.ui.tagActive = null; deps.ui.view = 'auto'; deps.ui.currentDocId = deps.state.rootId; deps.ui.activeKey = 'nav:tags'; deps.saveUI(); deps.forceRender(); };
  w2.appendChild(backBtn);
  const h = document.createElement('div'); h.style.cssText = 'font-size:1.05em;font-weight:700;margin-bottom:14px;color:var(--title)';
  h.textContent = '#' + t + ' — ' + items.length + ' 个节点';
  w2.appendChild(h);
  if (!items.length) { const e = document.createElement('div'); e.className = 'empty-state'; e.textContent = '暂无匹配节点'; w2.appendChild(e); return w2; }
  const grid = document.createElement('div'); grid.className = 'files-grid';
  items.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
  items.forEach((n: any) => grid.appendChild(deps.renderFileCard(n.id, n, false)));
  w2.appendChild(grid);
  return w2;
}
export function renderHistoryView(): HTMLElement {
  const wrap = document.createElement('div'); wrap.className = 'files-wrap';
  /* 批次 3 · P2-2：标题行与返回按钮合并为统一结构（原 renderViewTitle + 追加返回按钮两处合一）。
     【L22-final-r2 · 不变量 #57】同模板视图口径补挂 .files-toolbar 类，
     保证三视图（模板 / 回收站 / 历史）返回按钮选择器一致；显式 flex-start 保持标题左对齐。 */
  /* 【fix26-p2】历史视图改用与大纲同一 DOM 结构：.doc-header > .doc-header-title / .doc-header-line，
     返回钮落第 1 网格列（不参与标题居中），标题居中且横线与大纲同宽 */
  const _hisBar = document.createElement('div'); _hisBar.className = 'doc-header';
  const _hisBack = document.createElement('button'); _hisBack.className = 'btn'; _hisBack.textContent = '← 返回';
  _hisBack.onclick = () => { deps.ui.view = 'auto'; deps.ui.currentDocId = deps.state.rootId; deps.saveUI(); deps.safeNavigate(() => { deps.setActiveKey('nav:files'); }); };
  const _hisTitle = document.createElement('div'); _hisTitle.className = 'doc-header-title'; _hisTitle.textContent = '版本历史';
  /* 【fix26-p3】星标列占位：历史视图无星级，保留 .doc-header-stars 使右侧网格列与大纲一致 */
  const _hisStars = document.createElement('span'); _hisStars.className = 'doc-header-stars';
  const _hisLine = document.createElement('div'); _hisLine.className = 'doc-header-line';
  _hisBar.appendChild(_hisBack); _hisBar.appendChild(_hisTitle); _hisBar.appendChild(_hisStars); _hisBar.appendChild(_hisLine);
  wrap.appendChild(_hisBar);
  const doc = deps.getCurrentDoc();
  const isRoot = !doc || doc.id === deps.state.rootId;
  if (isRoot) {
    const e = document.createElement('div'); e.className = 'empty-state';
    e.textContent = '请先选择一个文档（根目录不支持版本历史）';
    wrap.appendChild(e); return wrap;
  }
  const loading = document.createElement('div'); loading.className = 'empty-state';
  loading.textContent = '加载中…';
  wrap.appendChild(loading);
  deps.loadVersionList(doc.id).then((list: any[]) => {
    if (!wrap.isConnected) return;
    loading.remove();
    if (!list.length) {
      const e = document.createElement('div'); e.className = 'empty-state';
      e.textContent = '暂无版本快照';
      wrap.appendChild(e); return;
    }
    [...list].reverse().forEach((v: any) => {
      const item = document.createElement('div'); item.className = 'history-item';
      const d = new Date(v.ts);
      const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const metaText = v._locked
        ? '🔒 需解锁查看'
        : (v._corrupt ? '⚠ 快照损坏' : Object.keys(v.nodes || {}).length + ' 个节点');
      item.innerHTML = `<div class="h-time">${esc(v.title || '未命名')} · ${ts}</div><div class="h-actions">${metaText}</div>`;
      item.onclick = () => {
        if (v._locked) { toast('请先解锁加密库'); return; }
        if (v._corrupt) { toast('该快照已损坏，无法恢复'); return; }
        appConfirm(`恢复到 ${ts} 的版本？当前修改将被覆盖。`, () => {
          deps.commit((s: any) => {
            const before = s.nodes[doc.id];
            const keep = {
              starred: before ? before.starred : 0,
              private: before ? before.private : false,
              createdAt: before ? before.createdAt : Date.now()
            };
            const sub = deps.docSubtree(doc.id);
            sub.forEach((id: any) => {
              if (id !== doc.id) {
                delete s.nodes[id];
                deps.purgeNodeMeta(s, id);
              }
            });
            const snapNodes = v.nodes || {};
            for (const sid in snapNodes) {
              const cloned = clone(snapNodes[sid]);
              if (cloned._deleted) delete cloned._deleted;
              s.nodes[sid] = cloned;
            }
            deps.migrateWordToOutline(s); /* 旧快照中的富文本节点就地降级为大纲子节点 */
            /* FIX-L-29：恢复只 purgeNodeMeta（不含 collapsedDocs），清理折叠标记中已不存在的节点 id，防残留累积 */
            const liveIds = new Set(Object.keys(s.nodes));
            for (const cid in deps.ui.collapsedDocs) { if (!liveIds.has(cid)) delete deps.ui.collapsedDocs[cid]; }
            /* FIX-L-30：恢复整体替换子树（快照节点带快照旧 updatedAt），清空搜索 hay 缓存防陈旧命中 */
            try { deps._searchHayCache.clear(); } catch(e){console.warn('[JU] caught error',e);}
            const nd = s.nodes[doc.id];
            if (nd) {
              nd.starred = keep.starred;
              nd.private = keep.private;
              nd.createdAt = keep.createdAt;
            }
          }, { snapshot: true });
          deps.forceRender(); renderSidebar();
          toast('已恢复');
        });
      };
      wrap.appendChild(item);
    });
  }).catch((err: any) => {
    if (!wrap.isConnected) return;
    loading.textContent = '加载失败：' + (err.message || '未知错误');
  });
  return wrap;
}
