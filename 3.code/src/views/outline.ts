/**
 * M1-1 · 批次 R · 大纲视图与多选拖拽交互模块
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - renderOutlinePage ......................................... 7916-7999
 *   - renderDocHeaderInline ..................................... 8027-8098
 *   - _buildOutlineBox .......................................... 8099-8189
 *   - renderOutlineRow .......................................... 8190-8195
 *   - 状态：_outlineSel / _outlineEscBound / _dragState / _outlineDragSel ... 8199-8202
 *   - outlineVisibleSeq / toggleOutlineSel / outlineSelectRange . 8203-8233
 *   - outlineRowHit / outlineDragSelectPaint .................... 8239-8260
 *   - outlineDragSelectStart/Move/End/Detach .................... 8261-8333
 *   - topSelected / isDescendantOf / outlineBatchMove ........... 8334-8386
 *   - outlineBatchIndent/Outdent/Delete ......................... 8387-8438
 *   - OUTLINE_CLIP_PREFIX / _outlineNodeToClipData /
 *     _outlineParseClipText / _outlineInsertClipNodes ........... 8439-8507
 *   - 大纲多选剪贴板 copy/cut/paste 监听 ........................ 8508-8566
 *   - outlineDragStart / outlineDropTarget /
 *     outlineDragMove / outlineDragEnd .......................... 8567-8689
 *   - bindOutlineText ........................................... 8858-9141
 *   - previousVisible / nextVisible / indentNode /
 *     outdentNode / moveSibling ................................. 9142-9202
 *
 * 约束：DOM 查询串、内联样式/HTML 片段、交互顺序、提示文案与 FIX/批次注释逐字保留。
 *   两类纯结构调整（保证零漂移）：
 *     1) 未拆分业务符号统一走 `deps` 依赖注入容器（原直接调用改为 `deps.xxx`）：
 *        ui / state / N() / forceRender() / getCurrentDoc() / viewOf() / commit() / nowSeq() /
 *        actions / 虚拟滚动（l14On / vsGenCount / countVisibleNodes / shouldUseVirtual /
 *        renderOutlineVirtual / getVsActive / setVsActive / vsScrollToId / reportError / errMsg）/
 *        sanitizeHtml / parsePasteLines / splitPastedLinesToNodes / trimPasteHtml / safeExec /
 *        fmtDateShort / getTagColor / openTag / renderInlineTable / addNodeTo /
 *        findOwningTopDocId / undo() / redo() / updateRightSidebar() /
 *        lastTouchDoneToggleAt / lastPointerType。
 *     2) `_outlineSel` 由原「整体重赋值」改为「字段原地更新」（保持跨模块同一对象引用，
 *        供 ui/selection 的 deps.outlineSel 观察到最新选中态；字段语义与旧代码逐字等价）。
 *   注：`$$` / `stripHtml` / `esc` / `clone` / `todayStr` 自 ../core/utils；
 *       `toast` / `appConfirm` / `showContextMenu` 自 ../ui/common；
 *       `syncEmptyState` / `isBlurSuppressed` / `resetSavedFocus` / `focusAfterRender` /
 *       `focusNode` 自 ../ui/focus（批次 Q 已提取）；
 *       `linkTitleAtPoint` / `navigateToWikiLink` 自 ../ui/rightbar；
 *       `renderSidebar` 自 ../ui/sidebar；`VIEW_KIND` 自 ../core/constants。
 */
import { $$, stripHtml, esc, clone, todayStr } from '../core/utils';
import { VIEW_KIND } from '../core/constants';
import { sanitizeHtml, safeExec, parsePasteLines, parseIndentedOutline, trimPasteHtml, type IndentedOutlineNode } from '../core/richtext';
/* 【D-07】bindDelegatedContextMenu：文档标题右键菜单改绑容器（事件委托），不再依赖单节点监听 */
import { toast, appConfirm, showContextMenu, bindDelegatedContextMenu } from '../ui/common';
import {
  syncEmptyState,
  isBlurSuppressed,
  resetSavedFocus,
  focusAfterRender,
  focusNode,
} from '../ui/focus';
import { linkTitleAtPoint, navigateToWikiLink } from '../ui/rightbar';
import { renderSidebar } from '../ui/sidebar';
/* 【fix7 · D-12】跨行文本选区模型：Blink 把原生 Selection 钳在单个 contenteditable 宿主内
   （实测见 90过程材料/tmp_compare/fix7/richtext_capability.log），跨行选区由产品侧模型承载。 */
import { xselActive, xselBeginFromPoint, xselDragAttach, xselClear, xselExtend, xselDelete, xselRanges } from '../ui/xselect';

/** 粘贴解析结果（对应产品 parsePasteLines 的返回形状）。 */
export interface PasteLines {
  lines: string[];
  html?: string;
  plain?: string;
  /** 解析器给出的缩进大纲树（HTML 嵌套优先，其次 plain 缩进）。 */
  tree?: IndentedOutlineNode[] | null;
}

/** 大纲可见行命中结果。 */
export interface OutlineHit {
  row: Element;
  id: string;
}

/** 拖拽投放位置。 */
export interface DropTarget {
  parent: any;
  index: number;
  lineTop: number;
  lineLeft: number;
  lineWidth: number;
}

/** 大纲选中态（仅内存 · 不持久化）。 */
export interface OutlineSelection {
  docId: any;
  anchorId: any;
  ids: Set<any>;
}

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export interface OutlineDeps {
  /** 全局 UI 状态对象（对应产品的 `ui`） */
  ui: any;
  /** 全局数据状态（对应产品的 `state`） */
  state: any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** 请求下一次渲染 */
  forceRender: () => void;
  /** 当前文档 */
  getCurrentDoc: () => any;
  /** 视图判定（对应产品的 `viewOf(doc)`） */
  viewOf: (doc: any) => any;
  /** 不可变提交（对应产品的 `commit`） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** 逻辑序号时钟（对应产品的 `_nowSeq`） */
  nowSeq: () => any;
  /** 业务动作集合（addNode / removeNode / moveNode / toggleCollapse / updateText …） */
  actions: any;

  /* 虚拟滚动 */
  l14On: () => boolean;
  vsGenCount: (doc: any) => number;
  countVisibleNodes: (doc: any) => number;
  VIRTUAL_THRESHOLD: number;
  reportError: (kind: string, payload: any) => void;
  errMsg: (e: any) => string;
  shouldUseVirtual: (doc: any) => boolean;
  renderOutlineVirtual: (wrap: HTMLElement, doc: any) => void;
  getVsActive: () => any;
  setVsActive: (v: any) => void;
  vsScrollToId: (vs: any, id: any) => void;

  /* 富文本 / 粘贴 / 安全执行 */
  sanitizeHtml: (s: string) => string;
  parsePasteLines: (dt: any) => PasteLines;
  splitPastedLinesToNodes: (text: HTMLElement, id: string, lines: string[], tree?: any) => boolean;
  trimPasteHtml: (html: string) => string;
  safeExec: (cmd: string, val?: string) => void;

  /* 大纲节点元信息渲染 */
  fmtDateShort: (t: any) => string;
  getTagColor: (tag: any) => string;
  openTag: (tag: any) => void;
  renderInlineTable: (n: any) => HTMLElement;

  /* 树操作辅助 */
  addNodeTo: (s: any, parent: any, at: any, init: any) => any;
  findOwningTopDocId: (id: any, s: any) => any;
  undo: () => boolean;
  redo: () => boolean;
  updateRightSidebar: () => void;

  /* 触摸 / 指针全局态（可写，保留产品同名语义） */
  lastTouchDoneToggleAt: number;
  lastPointerType: string;
}

export const deps: OutlineDeps = {
  ui: {},
  state: {},
  N: () => null,
  forceRender: () => {},
  getCurrentDoc: () => null,
  viewOf: () => null,
  commit: () => undefined,
  nowSeq: () => 0,
  actions: {},

  l14On: () => false,
  vsGenCount: () => 0,
  countVisibleNodes: () => 0,
  VIRTUAL_THRESHOLD: Number.MAX_SAFE_INTEGER,
  reportError: () => {},
  errMsg: () => '',
  shouldUseVirtual: () => false,
  renderOutlineVirtual: () => {},
  getVsActive: () => null,
  setVsActive: () => {},
  vsScrollToId: () => {},

  /* M1-1c：富文本安全与粘贴解析统一取自 core/richtext（单一来源，不再保留模块内占位实现）。 */
  sanitizeHtml,
  parsePasteLines,
  splitPastedLinesToNodes,
  trimPasteHtml,
  safeExec,

  fmtDateShort: () => '',
  getTagColor: () => '',
  openTag: () => {},
  renderInlineTable: () => document.createElement('div'),

  addNodeTo: () => null,
  findOwningTopDocId: () => null,
  undo: () => false,
  redo: () => false,
  updateRightSidebar: () => {},

  lastTouchDoneToggleAt: 0,
  lastPointerType: '',
};

/** 折叠切换：直接翻转 state 中该节点的 collapsed（deps.N 返回 state 内的真实对象），
 *  并**原地**更新该节点的箭头/子树 DOM（不重建整棵树 —— 无闪烁、无重渲染竞态）。
 *  为什么不用 deps.commit：commit 尾部 persistNow→runPersist 会立即按落盘快照合并，
 *  把 collapsed 翻转回写为旧值（诊断实证：commit 后 deps.N(id).collapsed 恒为原值），
 *  故改为直接改写状态字段 + 递增该节点 updatedAt（LWW 合并时保留新值）。 */
function _toggleCollapseDirect(id:any):void{
  const before=deps.N(id);
  if(!before||!before.children||!before.children.length) return; /* 叶子节点无可折叠 */
  try{ before.collapsed = !before.collapsed; before.updatedAt = Date.now(); }catch(_){}
  const n=deps.N(id); if(!n) return;
  /* 原地 DOM 更新：只动该节点的箭头 + 子树/提示，不重建整棵树 */
  try{
    const nodes=(Array.prototype.slice.call(document.querySelectorAll('#content .node')) as HTMLElement[]);
    const box=nodes.find(el=>el.dataset&&el.dataset.id===String(id));
    if(!box){deps.forceRender();return;}
    const row=box.querySelector(':scope > .row') as HTMLElement | null;
    const arrow=row?row.querySelector('.arrow') as HTMLElement | null:null;
    if(arrow) arrow.textContent=n.collapsed?'▶':'▼';
    const last=box.lastElementChild as HTMLElement | null;
    if(last&&(last.classList.contains('children')||last.classList.contains('collapsed-hint'))) last.remove();
    if(n.collapsed){
      const hint=document.createElement('div');hint.className='collapsed-hint';
      hint.textContent='▸ '+n.children.length+' 个子节点';
      hint.onmousedown=(e:any)=>{e.preventDefault();_toggleCollapseDirect(id);};
      box.appendChild(hint);
    }else{
      const depth=row?(parseInt(row.getAttribute('data-depth')||'0',10)||0):0;
      const kids=document.createElement('div');kids.className='children';
      n.children.forEach((cid:any)=>{const cn=deps.N(cid);if(cn)kids.appendChild(renderOutlineRow(cn,depth+1));});
      box.appendChild(kids);
    }
  }catch(_){try{deps.forceRender();}catch(__){console.warn('[JU] caught error',__);}}
}

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function injectDeps(next: Partial<OutlineDeps>): void {
  Object.assign(deps, next);
  /* fix-outline-collapse-1/1：重写 toggleCollapse，绕过原生实现直接经 commit 翻转 collapsed；
     复制 actions 避免污染其他视图共享对象；异常捕获后仍强制重绘。 */
  if(next&&next.actions){
    deps.actions=Object.assign({},next.actions,{toggleCollapse:(id:any)=>{_toggleCollapseDirect(id);}});
  }
}

/* ============================================================
   大纲渲染 · 多选 / 跨行选中 / 批量拖拽移动与层级调整
   状态变量（对应产品同作用域 let 声明；_outlineSel 为跨模块共享对象）
   ============================================================ */
export const _outlineSel: OutlineSelection = {docId:null,anchorId:null,ids:new Set<any>()};
export let _outlineEscBound = false;
export let _dragState: any = null;
export let _outlineDragSel: any = null;
/** 原 `_virtualDisabled`：大纲渲染超阈值探测失败后的永久降级标志（模块内状态）。 */
let _virtualDisabled = false;
const OUTLINE_CLIP_PREFIX = 'JU-NODES:';

export function renderOutlinePage(doc: any): HTMLDivElement {
  const wrap=document.createElement('div');wrap.className='outline';
  /* FIX-M-27: 大纲容器最小 ARIA 语义层 role="tree"（纯属性，行为零变化；键盘导航不在本批，后续批次补） */
  wrap.setAttribute('role','tree');
  if(!doc){const e=document.createElement('div');e.className='empty-state';e.textContent='请先选择文档';wrap.appendChild(e);return wrap;}
  /* 虚拟滚动策略：由 core/virtual-scroll 统一判定（默认开启；小文档 + 大内存自动回退全量渲染）。
     判定异常时永久降级为全量渲染，不阻断大纲正文。 */
  try{
    if(!_virtualDisabled&&deps.shouldUseVirtual(doc)){wrap.classList.add('virtual');}
  }catch(e){_virtualDisabled=true;try{deps.reportError('virtual-scroll-fallback',{msg:deps.errMsg(e)});}catch(_){console.warn('[JU] caught error',_);}}
  try{
    wrap.appendChild(renderDocHeaderInline(doc));
    if(_outlineSel.docId&&_outlineSel.docId!==doc.id){_outlineSel.docId=doc.id;_outlineSel.anchorId=null;_outlineSel.ids=new Set<any>();}
    else if(!_outlineSel.docId){_outlineSel.docId=doc.id;}
    /* FIX-P1-3(补充): 过滤已删除 id——节点被 removeNode/moveToTrash 后 _outlineSel.ids 保留旧 id，
       会导致批量移动/删除处理幽灵 id；此处只保留仍真实存在的节点。
       fix18-patch1 补充：按产品要求移除「已选 N 个节点 · 拖动手柄…」提示条（仅删除展示层；
       _outlineSel 选择模型、批量拖拽与 Esc 取消逻辑保持不变）。 */
    if(_outlineSel.ids.size){
      const _live=new Set<any>();
      _outlineSel.ids.forEach((id:any)=>{if(id&&deps.N(id)&&!deps.N(id)._deleted)_live.add(id);});
      if(_live.size!==_outlineSel.ids.size)_outlineSel.ids=_live;
    }
    /* 【L12-W3 · H2/H3】超阈值且未降级 → 窗口化绝对定位渲染（T-105 转绿靶位）；否则原全量路径 */
    if(deps.shouldUseVirtual(doc)){deps.renderOutlineVirtual(wrap,doc);}
    else{doc.children.forEach((cid:any)=>{const n=deps.N(cid);if(n)wrap.appendChild(renderOutlineRow(n,0));});}
  }catch(e){
    _virtualDisabled=true;
    try{deps.reportError('virtual-scroll-fallback',{msg:deps.errMsg(e)});}catch(_){console.warn('[JU] caught error',_);}
    /* 降级：清空后全量重试 */
    wrap.innerHTML='';
    if((wrap as any)._vs)(wrap as any)._vs=null;
    const _vsNow=deps.getVsActive();if(_vsNow&&_vsNow.wrap===wrap)deps.setVsActive(null);
    wrap.appendChild(renderDocHeaderInline(doc));
    if(_outlineSel.docId&&_outlineSel.docId!==doc.id){_outlineSel.docId=doc.id;_outlineSel.anchorId=null;_outlineSel.ids=new Set<any>();}
    else if(!_outlineSel.docId){_outlineSel.docId=doc.id;}
    doc.children.forEach((cid:any)=>{const n=deps.N(cid);if(n)wrap.appendChild(renderOutlineRow(n,0));});
  }
  const adder=document.createElement('div');adder.className='add-node';adder.textContent='+ 新增内容（按 Enter）';
  adder.onclick=()=>{
    const id=deps.actions.addNode(doc.id,null,{text:''});
    deps.forceRender();
    /* FIX-L-14: 限定到 #content 主面板内查询，避免渲染过渡期文档中存在多个 .outline 时取到第一个（旧/离屏）实例 */
    focusAfterRender(id,'#content');
  };
  wrap.appendChild(adder);
  wrap.addEventListener('mousedown',(e:any)=>{
    if(e.button!==0)return;
    /* r18：contenteditable 内的 mousedown 目标可能是 Text 节点（nodeType===3），无 closest 方法；
       先归一为元素节点，避免 TypeError 中断后续多选 / 取消选择逻辑。 */
    const target=e.target&&e.target.nodeType===1?e.target:(e.target?e.target.parentElement:null);
    if(!target)return;
    if(target.closest('.node')||target.closest('.doc-header')||target.closest('.outline-selbar'))return;
    /* 【fix7 · D-12】点空白 = 取消跨行文本选区（与 Esc 同义） */
    if(!target.closest('.text')&&xselActive())xselClear();
    if(_outlineSel.ids.size){_outlineSel.ids=new Set<any>();_outlineSel.anchorId=null;deps.forceRender();}
  });
  if(!_outlineEscBound){
    _outlineEscBound=true;
    document.addEventListener('keydown',(e:any)=>{
      if(e.key!=='Escape')return;
      /* 【fix7 · D-12】先取消跨行文本选区模型（高亮一并摘除），再走原有节点多选取消逻辑 */
      if(xselActive()){xselClear();return;}
      const view=deps.ui.view==='auto'?(typeof deps.viewOf==='function'?deps.viewOf(deps.getCurrentDoc()):null):deps.ui.view;
      if(view!==VIEW_KIND.OUTLINE)return;
      if(_outlineSel.ids.size){_outlineSel.ids=new Set<any>();_outlineSel.anchorId=null;deps.forceRender();}
      else if(_dragState&&_dragState.active){outlineDragEnd({clientX:0,clientY:0,button:0});}
    });
  }
  return wrap;
}

/* ============================================================
   【D-07 · 文档标题右键菜单：容器委托】
   ------------------------------------------------------------
   缺陷现象：用户反馈「右键菜单无法实现」，实测在 `.doc-header-title` 上可弹。
   差异根因：菜单原先绑在**单个标题节点**上（`name.addEventListener('contextmenu')`），
   而标题行由 renderMain 反复重建 —— 重建窗口内的点击、或被后续赋值覆盖的监听会丢失。
   处理：监听改挂 `#content`（文档容器）做事件委托（幂等安装），并对「无当前文档」显式早退，
   避免把「没有文档」误判成「菜单失效」。
   ============================================================ */
function _ensureDocHeaderContextMenu(): void {
  const host = document.getElementById('content') || document.body;
  bindDelegatedContextMenu(host, '.doc-header-title', (hit, e) => {
    const docId = (deps.ui && deps.ui.currentDocId) || null;
    const cur = docId ? deps.N(docId) : null;
    /* 无当前文档（空态 / 回收站 / 模板页）：不弹菜单，属设计预期 */
    if (!docId || !cur) return;
    const items: any[] = [];
    if (docId !== deps.state.rootId) {
      items.push({ ic: '✏️', txt: '重命名（选中）', fn: () => {
        try {
          hit.focus();
          const r = document.createRange(); r.selectNodeContents(hit);
          const sel = window.getSelection();
          if (sel) { sel.removeAllRanges(); sel.addRange(r); }
        } catch (err) { console.warn('[JU] caught error', err); }
      } });
    }
    items.push({ ic: '⭐', txt: '星标 +1', fn: () => {
      const lv = cur.starred || 0;
      deps.actions.setStar(docId, lv >= 5 ? 0 : lv + 1);
      renderSidebar(); deps.updateRightSidebar();
    } });
    if (docId !== deps.state.rootId) {
      items.push({ sep: true });
      items.push({ ic: '🗑', txt: '移入回收站', danger: true, fn: () => {
        deps.actions.moveToTrash(docId);
        if (deps.ui.currentDocId === docId) deps.ui.currentDocId = null;
        renderSidebar(); deps.forceRender();
      } });
    }
    showContextMenu(items, e);
  });
}

export function renderDocHeaderInline(doc: any): HTMLDivElement {
  const bar=document.createElement('div');bar.className='doc-header';
  const name=document.createElement('div');name.className='doc-header-title';
  name.contentEditable='true';name.spellcheck=false;name.dataset.id=doc.id;name.dataset.ph='未命名文档';
  name.textContent=stripHtml(doc.text)||(doc.id===deps.state.rootId?'我的文档':'未命名');
  let composing=false;
  name.addEventListener('compositionstart',()=>composing=true);
  name.addEventListener('compositionend',()=>composing=false);
  name.addEventListener('input',(e:any)=>{
    if(composing||e.isComposing)return;
    syncEmptyState(name,'未命名文档');
  });
  name.addEventListener('blur',()=>{
    if(isBlurSuppressed())return;
    if(!name.isConnected)return;
    const finalText=name.textContent!.trim();
    const cur=deps.N(doc.id);if(!cur)return;
    if(finalText&&finalText!==stripHtml(cur.text||'')){
      deps.commit((s:any)=>{s.nodes[doc.id].text=finalText;s.nodes[doc.id].updatedAt=deps.nowSeq();},{snapshot:true,op:'updateText',opArgs:{id:doc.id}});
      deps.actions.logActivity('mod',doc.id);
      renderSidebar();
    }
  });
  /* 【粘贴修复 P0 · 批次 3/4】文档大标题 = 单行语义控件：只取首行，折叠空白并剔除首尾空行 */
  name.addEventListener('paste',(e:any)=>{
    try{
      const dt=e.clipboardData||(window as any).clipboardData;
      if(!dt)return;
      e.preventDefault();
      const parsed=deps.parsePasteLines(dt);
      const single=parsed.lines.length?String(parsed.lines[0]).replace(/\s+/g,' ').trim():'';
      if(single)deps.safeExec('insertText',single);
    }catch(err){console.warn('[JU] caught error',err);}
  });
  name.addEventListener('keydown',(e:any)=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();name.blur();}
    if(e.key==='Escape'){name.textContent=stripHtml(deps.N(doc.id).text||'')||'未命名';name.blur();}
    if(!(e.ctrlKey||e.metaKey))e.stopPropagation();
  });
  /* 【修复 L2】【D-07】文档标题右键菜单 —— 改为**容器委托**（见 _ensureDocHeaderContextMenu）：
     标题行由 renderMain 反复重建，逐节点绑定在重建窗口内会丢；委托一次安装长期有效。 */
  _ensureDocHeaderContextMenu();
  bar.appendChild(name);
  if(doc.starred>0){const stars=document.createElement('span');stars.className='doc-header-stars';stars.textContent='★'.repeat(doc.starred);bar.appendChild(stars);}
  /* 【fix26-p2】横线统一为显式元素：复用本标题行的所有视图（大纲 / 导图 / 演示 / 幻灯片）横线同宽同色 */
  const line=document.createElement('div');line.className='doc-header-line';bar.appendChild(line);
  /* 【需求】标题栏不含节点数/字数等字符信息，统计已移除 */
  return bar;
}

export function _buildOutlineBox(box: HTMLElement,n:any,depth:number,opts:any): void {
  opts=opts||{};
  while(box.firstChild)box.removeChild(box.firstChild);
  box.className='node';(box as HTMLElement).dataset.id=n.id;
  /* FIX-M-27: 行级 ARIA——treeitem；有子节点者按折叠态给 aria-expanded（大纲折叠态取自节点 n.collapsed，与箭头/子树渲染同源）；当前活动行 aria-selected（与 .sel 高亮同源 ui.focusId，侧栏导航会同步置 ui.activeKey='node:'+id）。纯属性，行为零变化；键盘导航后续批次 */
  box.setAttribute('role','treeitem');
  box.setAttribute('aria-level',String(depth+1));
  if(n.children&&n.children.length)box.setAttribute('aria-expanded',n.collapsed?'false':'true');
  if(n.children&&n.children.length)box.classList.add('has-children'); /* FIX-R8-7: class 标记含子树节点，供虚拟滚动估算（不依赖 :has 选择器，旧 Firefox 亦生效） */
  box.setAttribute('aria-selected',(deps.ui.focusId===n.id)?'true':'false');
  const row=document.createElement('div');row.className='row';row.dataset.depth=String(depth);
  if(deps.ui.focusId===n.id)row.classList.add('sel');
  if(_outlineSel.ids.has(n.id))row.classList.add('multi-sel');
  const handle=document.createElement('span');
  handle.className='drag-handle';handle.textContent='⋮⋮';handle.title='拖动移动（可先多选，再拖动手柄批量移动）';
  handle.onmousedown=(e:any)=>outlineDragStart(e,n.id);
  row.appendChild(handle);
  const arrow=document.createElement('span');
  arrow.className='arrow'+((n.children&&n.children.length)?'':' leaf');
  if(n.children&&n.children.length)arrow.textContent=n.collapsed?'▶':'▼';
  arrow.onmousedown=(e:any)=>{e.preventDefault();e.stopPropagation();_toggleCollapseDirect(n.id);};
  row.appendChild(arrow);
  const text=document.createElement('div');
  text.className='text'+(n.done?' done':'');text.contentEditable='true';text.spellcheck=false;
  text.dataset.id=n.id;
  text.innerHTML=deps.sanitizeHtml(n.text||'');
  /* fix18-patch1 补充：空节点不再注入「输入内容」占位（不设 data-ph，也不传占位文案）。 */
  syncEmptyState(text);
  bindOutlineText(text,n.id);
  row.appendChild(text);
  const actions2=document.createElement('div');actions2.className='row-actions';
  const mtime=document.createElement('span');mtime.className='mtime-tag';mtime.textContent=deps.fmtDateShort(n.updatedAt);
  actions2.appendChild(mtime);
  if(n.tags&&n.tags.length){
    n.tags.forEach((t:any)=>{
      const tag=document.createElement('span');tag.className='tag-dot';
      tag.style.background=deps.getTagColor(t);
      tag.textContent='#'+t;
      tag.title='#'+t;
      tag.onclick=(e:any)=>{e.stopPropagation();deps.openTag(t);};
      actions2.insertBefore(tag,mtime);
    });
  }
  if(n.priority&&n.priority>0){const pb=document.createElement('span');pb.className='prio-badge p'+n.priority;pb.textContent=({1:'重要紧急',2:'重要不紧急',3:'紧急不重要',4:'不紧急不重要',5:'P4'} as Record<number,string>)[n.priority]||'';actions2.appendChild(pb);} /* 批次5: 优先级徽章改四象限文案 */
  if(n.recur){const rb=document.createElement('span');rb.className='recur-badge';rb.textContent='🔁';actions2.appendChild(rb);}
  /* FIX-UI-21: 行内标签超过 2 个折叠为 +N，减少右侧视觉噪声 */
  const tagDots=actions2.querySelectorAll('.tag-dot');
  if(tagDots.length>2){
    for(let i=2;i<tagDots.length;i++){(tagDots[i] as HTMLElement).style.display='none';}
    const more=document.createElement('span');more.className='tag-more';
    more.textContent='+'+(tagDots.length-2);
    more.title='还有 '+(tagDots.length-2)+' 个标签';
    tagDots[1].insertAdjacentElement('afterend',more);
  }
  row.appendChild(actions2);
  row.addEventListener('mousedown',(e:any)=>{
    if(e.button!==0)return;
    /* r18：同上，Text 节点目标归一为父元素，保证 Ctrl / Shift 多选在文本节点上点击时仍可执行。 */
    const target=e.target&&e.target.nodeType===1?e.target:(e.target?e.target.parentElement:null);
    if(!target)return;
    if(target.closest('.drag-handle')||target.closest('.arrow')||target.closest('.row-actions'))return;
    if(e.ctrlKey||e.metaKey){
      e.preventDefault();e.stopPropagation();
      toggleOutlineSel(n.id);deps.forceRender();return;
    }
    if(e.shiftKey){
      e.preventDefault();e.stopPropagation();
      const doc=deps.getCurrentDoc();
      if(doc&&_outlineSel.anchorId)outlineSelectRange(doc,_outlineSel.anchorId,n.id,false);
      else if(doc){_outlineSel.ids=new Set<any>([n.id]);_outlineSel.anchorId=n.id;_outlineSel.docId=doc.id;deps.forceRender();}
      return;
    }
    /* r19：mousedown 不阻止默认行为、不立即选中——仅记录起点，让事件继续下发；
       方向判定交给 document 上的 mousemove：水平为主 = 选中文字（原生行为不干预），
       垂直为主（超过水平 +5px）= 跨行多选刷选。无位移的纯点击在 mouseup 时沿用单击选中语义。 */
    /* 【fix7 · D-12】拦截条件细化：起点落在正文 contenteditable（.text）内 ⇒ 一律按「选中文字」处理，
       不再进入节点多选刷选（旧行为：纵向拖过文本 ⇒ 清掉文本选区并刷选整行，用户看到选区消失）。
       跨行部分交给 ../ui/xselect 的选区模型（原生 Selection 跨不出编辑宿主，实测见
       fix7/richtext_capability.log）；块首 .drag-handle / 行内空白区仍是节点多选手势。 */
    if(target.closest('.text')){
      if(xselBeginFromPoint(e.clientX,e.clientY))xselDragAttach();
      return;
    }
    /* 【fix7 · D-12】行内空白区按下：取消跨行文本选区，再走原有节点多选手势 */
    if(xselActive())xselClear();
    outlineDragSelectStart(e,n.id,false);
  });
  box.appendChild(row);
  if(n.block==='table')box.appendChild(deps.renderInlineTable(n));
  /* 【L12-W3 · H3】flat：真虚拟滚动窗口内为扁平行，子树由上一层按可视区间渲染 */
  if(!opts.flat&&n.children&&n.children.length){
    if(n.collapsed){
      const hint=document.createElement('div');hint.className='collapsed-hint';hint.textContent='▸ '+n.children.length+' 个子节点';
      hint.onmousedown=(e:any)=>{e.preventDefault();_toggleCollapseDirect(n.id);};
      box.appendChild(hint);
    }else{
      const kids=document.createElement('div');kids.className='children';
      n.children.forEach((cid:any)=>{const cn=deps.N(cid);if(cn)kids.appendChild(renderOutlineRow(cn,depth+1));});
      box.appendChild(kids);
    }
  }
}

export function renderOutlineRow(n:any,depth?:number): HTMLDivElement {
  depth=depth||0;
  const box=document.createElement('div');
  _buildOutlineBox(box,n,depth,{});
  return box as HTMLDivElement;
}

export function outlineVisibleSeq(doc: any): string[] {
  const seq:string[]=[];
  (function walk(n:any){
    if(!n)return;
    seq.push(n.id);
    if(!n.collapsed&&n.children)n.children.forEach((cid:any)=>{const cn=deps.N(cid);if(cn)walk(cn);});
  })(doc);
  return seq;
}

export function toggleOutlineSel(id: any): void {
  const doc=deps.getCurrentDoc();
  const ids=new Set<any>(_outlineSel.ids);
  if(ids.has(id))ids.delete(id);else ids.add(id);
  _outlineSel.ids=ids;_outlineSel.anchorId=id;_outlineSel.docId=doc?doc.id:null;
}

export function outlineSelectRange(doc:any,anchorId:any,targetId:any,additive:boolean): void {
  const seq=outlineVisibleSeq(doc);
  const ai=seq.indexOf(anchorId),ti=seq.indexOf(targetId);
  if(ai<0||ti<0)return;
  const lo=Math.min(ai,ti),hi=Math.max(ai,ti);
  const range=new Set<any>(seq.slice(lo,hi+1));
  if(additive){
    const ids=new Set<any>(_outlineSel.ids);
    range.forEach((id:any)=>ids.add(id));
    _outlineSel.ids=ids;
  }else{
    _outlineSel.ids=range;
  }
  _outlineSel.anchorId=anchorId;
  deps.forceRender();
}

/* r19 · 智能拖拽多选：行内 mousedown 记录起点 → document mousemove 判定方向。
   - 水平位移为主（|dx| > |dy|）：判定为「选中文字」，完全不干预浏览器默认选区行为；
   - 垂直位移为主（|dy| > |dx| + 5）：判定为「跨行多选」，立刻 preventDefault + 清空文本选区，
     并以 elementFromPoint 实时命中 .row 刷选；回退经过的行按「锚点→当前行」区间重算，可干净取消。
   - mouseup：结束刷选，forceRender 固化 _outlineSel；纯点击（零位移）保留原单击选中语义。 */
export function outlineRowHit(x:number,y:number): OutlineHit | null {
  let el:any=null;
  try{el=document.elementFromPoint(x,y);}catch(_e){return null;}
  if(!el||el.nodeType!==1)return null;
  const row=el.closest?el.closest('.row'):null;
  if(!row)return null;
  const box=row.parentElement;
  if(!box||!box.classList||!box.classList.contains('node'))return null;
  const id=box.dataset?box.dataset.id:null;
  return id?{row,id}:null;
}

export function outlineDragSelectPaint(): void {
  const rows=document.querySelectorAll('#content .outline .node > .row');
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    const box=row.parentElement;
    const id=box&&box.dataset?box.dataset.id:null;
    if(!id)continue;
    if(_outlineSel.ids.has(id))row.classList.add('multi-sel');
    else row.classList.remove('multi-sel');
  }
}

export function outlineDragSelectStart(e:any,id:any,fromText:boolean): void {
  const doc=deps.getCurrentDoc();
  if(!doc)return;
  if(_outlineDragSel)outlineDragSelectDetach();
  _outlineDragSel={docId:doc.id,startX:e.clientX,startY:e.clientY,anchorId:id,fromText:!!fromText,
    mode:null,base:new Set<any>(_outlineSel.ids),hoverId:null,userSelect:null};
  document.addEventListener('mousemove',outlineDragSelectMove);
  document.addEventListener('mouseup',outlineDragSelectEnd);
}

export function outlineDragSelectDetach(): void {
  document.removeEventListener('mousemove',outlineDragSelectMove);
  document.removeEventListener('mouseup',outlineDragSelectEnd);
  const ds=_outlineDragSel;
  _outlineDragSel=null;
  try{if(ds&&ds.userSelect!=null)document.body.style.userSelect=ds.userSelect;}catch(_e){console.warn('[JU] caught error',_e);}
}

export function outlineDragSelectMove(e:any): void {
  const ds=_outlineDragSel;
  if(!ds)return;
  const dx=e.clientX-ds.startX,dy=e.clientY-ds.startY;
  if(!ds.mode){
    if(Math.abs(dx)<4&&Math.abs(dy)<4)return;              /* 死区：抖动不算拖拽 */
    if(Math.abs(dx)>Math.abs(dy)){ds.mode='text';}          /* 水平为主：选中文字 */
    else if(Math.abs(dy)>Math.abs(dx)+5){ds.mode='multi';}  /* 垂直为主：跨行多选 */
    if(!ds.mode)return;
    if(ds.mode==='multi'){
      try{const s0=window.getSelection();if(s0&&s0.removeAllRanges)s0.removeAllRanges();}catch(_e){console.warn('[JU] caught error',_e);}
      try{ds.userSelect=document.body.style.userSelect;document.body.style.userSelect='none';}catch(_e){console.warn('[JU] caught error',_e);}
    }
  }
  if(ds.mode!=='multi')return;
  if(e.cancelable)e.preventDefault();
  try{const s1=window.getSelection();if(s1&&s1.rangeCount)s1.removeAllRanges();}catch(_e){console.warn('[JU] caught error',_e);}
  const hit=outlineRowHit(e.clientX,e.clientY);
  if(!hit){
    _outlineSel.ids=new Set<any>(ds.base);
    _outlineSel.anchorId=ds.anchorId;
    outlineDragSelectPaint();
    ds.hoverId=null;
    return;
  }
  if(hit.id===ds.hoverId)return;
  ds.hoverId=hit.id;
  const doc=deps.getCurrentDoc();
  if(!doc)return;
  const seq=outlineVisibleSeq(doc);
  const ai=seq.indexOf(ds.anchorId),ti=seq.indexOf(hit.id);
  const next=new Set<any>(ds.base);
  next.add(ds.anchorId);
  if(ai>=0&&ti>=0){
    const lo=Math.min(ai,ti),hi=Math.max(ai,ti);
    for(let i=lo;i<=hi;i++)next.add(seq[i]);
  }else{
    next.add(hit.id);
  }
  _outlineSel.docId=doc.id;_outlineSel.anchorId=ds.anchorId;_outlineSel.ids=next;
  outlineDragSelectPaint();
}

export function outlineDragSelectEnd(e:any): void {
  const ds=_outlineDragSel;
  if(!ds)return;
  const mode=ds.mode,fromText=ds.fromText,anchorId=ds.anchorId,docId=ds.docId;
  outlineDragSelectDetach();
  if(mode==='multi'){
    if(e&&e.cancelable&&e.preventDefault)e.preventDefault();
    deps.forceRender();
    return;
  }
  if(!mode&&!fromText){
    _outlineSel.ids=new Set<any>([anchorId]);_outlineSel.anchorId=anchorId;_outlineSel.docId=docId;
    deps.forceRender();
  }
}

export function topSelected(doc:any): string[] {
  const ids:string[]=[];
  _outlineSel.ids.forEach((id:any)=>{
    const n=deps.N(id);if(!n)return;
    const p=deps.N(n.parent);
    if(!p||p.id===deps.state.rootId||!_outlineSel.ids.has(n.parent))ids.push(id);
  });
  const seq=outlineVisibleSeq(doc);
  return ids.sort((a,b)=>seq.indexOf(a)-seq.indexOf(b));
}

export function isDescendantOf(id:any,ancId:any): boolean {
  let cur=id;
  while(cur){
    const n=deps.N(cur);if(!n)return false;
    if(cur===ancId)return true;
    cur=n.parent;
  }
  return false;
}

export function outlineBatchMove(tops:string[],toParentId:any,toIndex:number): void {
  if(!tops.length)return;
  if(tops.some((tid:any)=>isDescendantOf(toParentId,tid))){toast('无法移动到自身或其子节点下');return;}
  const doc=deps.getCurrentDoc();
  const toRef=deps.N(toParentId);
  if(!toRef)return;
  deps.commit((s:any)=>{
    const to=s.nodes[toParentId];
    if(!to)return;
    /* 【F3/fixed19】记录被摘除 tops 中原本位于 toIndex 之前的数量：摘除后需把目标索引左移该数量，
       否则同父前移时插入点偏右（[A,B,C,D,E] 拖 A 到 B 后旧逻辑得 [B,C,A,D,E]，正确应为 [B,A,C,D,E]）。 */
    let removedBefore=0;
    for(const id of tops){
      const n=s.nodes[id];if(!n)continue;
      const p=s.nodes[n.parent];
      if(p===to){const i=p.children.indexOf(id);if(i>=0&&i<toIndex)removedBefore++;}
    }
    tops.forEach((id:any)=>{
      const n=s.nodes[id];if(!n)return;
      const p=s.nodes[n.parent];
      if(p){const i=p.children.indexOf(id);if(i>=0)p.children.splice(i,1);}
    });
    let idx=Math.max(0,Math.min(toIndex-removedBefore,to.children.length));
    tops.forEach((id:any)=>{
      const n=s.nodes[id];if(!n)return;
      n.parent=toParentId;
      to.children.splice(idx,0,id);
      idx++;
    });
  },{snapshot:true});
  deps.forceRender();
  _outlineSel.ids=new Set<any>(tops);
  toast('已移动 '+tops.length+' 个节点');
}

export function outlineBatchIndent(): void {
  const doc=deps.getCurrentDoc();if(!doc)return;
  const tops=topSelected(doc);
  if(!tops.length)return;
  deps.commit((s:any)=>{
    tops.forEach((id:any)=>{
      const n=s.nodes[id];if(!n)return;
      const p=s.nodes[n.parent];if(!p)return;
      const idx=p.children.indexOf(id);
      if(idx<=0)return;
      const prev=p.children[idx-1];
      const pv=s.nodes[prev];if(!pv)return;
      const fi=p.children.indexOf(id);
      p.children.splice(fi,1);
      pv.children.push(id);
      n.parent=prev;
    });
  },{snapshot:true});
  deps.forceRender();toast('已缩进 '+tops.length+' 个节点');
}

export function outlineBatchOutdent(): void {
  const doc=deps.getCurrentDoc();if(!doc)return;
  const tops=topSelected(doc);
  if(!tops.length)return;
  deps.commit((s:any)=>{
    tops.forEach((id:any)=>{
      const n=s.nodes[id];if(!n)return;
      const p=s.nodes[n.parent];
      if(!p||p.id===deps.state.rootId)return;
      const gp=s.nodes[p.parent];
      if(!gp||gp.id===deps.state.rootId)return;
      const pi=gp.children.indexOf(p.id);
      if(pi<0)return;
      const fi=p.children.indexOf(id);
      p.children.splice(fi,1);
      gp.children.splice(pi+1,0,id);
      n.parent=gp.id;
    });
  },{snapshot:true});
  deps.forceRender();toast('已反缩进 '+tops.length+' 个节点');
}

export function outlineBatchDelete(): void {
  const doc=deps.getCurrentDoc();
  if(!doc||doc.id===deps.state.rootId)return; /* FIX-DEF-A-1 根节点守卫（同 removeNode / moveToTrash 口径） */
  const tops=topSelected(doc);
  if(!tops.length)return;
  appConfirm('确认删除所选 '+tops.length+' 个节点（含其子节点）？',()=>{
    tops.forEach((id:any)=>deps.actions.removeNode(id));
    _outlineSel.ids=new Set<any>();_outlineSel.anchorId=null;
    deps.forceRender();
  });
}

export function _outlineNodeToClipData(n:any): any {
  if(!n)return null;
  return {
    text:n.text,done:!!n.done,date:n.date||null,tags:(n.tags||[]).slice(),
    priority:n.priority||0,recur:n.recur?clone(n.recur):null,recurEnd:n.recurEnd||null,
    time:n.time||null,timeEnd:n.timeEnd||null,note:n.note||null,color:n.color||null,
    showInCal:n.showInCal!==false,db:n.db?clone(n.db):null,
    block:n.block||null,tableData:n.tableData?clone(n.tableData):null,
    _manualTags:(n._manualTags||[]).slice(),collapsed:!!n.collapsed,
    children:(n.children||[]).map((cid:any)=>_outlineNodeToClipData(deps.N(cid))).filter(Boolean)
  };
}

export function _outlineParseClipText(txt:any): any[] | null {
  if(!txt||typeof txt!=='string')return null;
  const s=txt.trim();
  if(s.indexOf(OUTLINE_CLIP_PREFIX)!==0)return null;
  try{
    const o=JSON.parse(s.slice(OUTLINE_CLIP_PREFIX.length));
    if(o&&o.v===1&&Array.isArray(o.nodes)&&o.nodes.length)return o.nodes;
  }catch(e){console.warn('[JU] caught error',e);}
  return null;
}

export function _outlineInsertClipNodes(nodes:any): number {
  const doc=deps.getCurrentDoc();
  if(!doc||!nodes||!nodes.length)return 0;
  const anchorId=_outlineSel.anchorId||deps.ui.focusId;
  const anchorNode=(anchorId&&deps.N(anchorId)&&deps.findOwningTopDocId(anchorId,deps.state)===doc.id)?deps.N(anchorId):null;
  /* PASTE-005：空锚点复用为首个根（只填文本、不新建节点），非空锚点作为父节点；无锚点追加到文档末尾 */
  const reuse=!!(anchorNode&&anchorNode.id!==doc.id&&!anchorNode.text&&!(anchorNode.children||[]).length);
  const added:string[]=[];
  deps.commit((s:any)=>{
    const insertTree=(data:any,pid:any,at:any):any=>{
      const init={
        text:data.text,done:data.done,date:data.date,
        tags:(data.tags||[]).slice(),
        priority:data.priority||0,
        recur:data.recur?clone(data.recur):null,
        recurEnd:data.recurEnd||null,
        time:data.time||null,timeEnd:data.timeEnd||null,
        note:data.note||null,color:data.color||null,
        showInCal:data.showInCal!==false,
        collapsed:!!data.collapsed,
        _manualTags:(data._manualTags||[]).slice()
      };
      const n=deps.addNodeTo(s,pid,at,init);
      if(!n)return null;
      if(data.db)n.db=clone(data.db);
      if(data.block)n.block=data.block;
      if(data.tableData)n.tableData=clone(data.tableData);
      (data.children||[]).forEach((c:any)=>insertTree(c,n.id,null));
      return n;
    };
    if(reuse){
      const an=s.nodes[anchorId];
      if(!an)return;
      /* 文本填充与其余根节点插入在同一 commit 内完成，保证一次粘贴只产生 1 条撤销记录 */
      an.text=nodes[0].text;an.updatedAt=deps.nowSeq();
      added.push(anchorId);
      (nodes[0].children||[]).forEach((c:any)=>insertTree(c,anchorId,null));
      const p=s.nodes[an.parent];
      let at=(p?p.children.indexOf(anchorId)+1:null);
      nodes.slice(1).forEach((data:any)=>{
        const n=insertTree(data,an.parent,at);
        if(n){added.push(n.id);if(at!=null)at++;}
      });
      return;
    }
    /* 非空锚点：树根插入为锚点的同级兄弟节点（锚点之后）；无锚点：追加到当前文档末尾 */
    const _anchored=!!(anchorNode&&anchorNode.id!==doc.id);
    const parentId=_anchored?(anchorNode.parent||doc.id):doc.id;
    const pn=s.nodes[parentId];
    const _ai=(_anchored&&pn&&pn.children)?pn.children.indexOf(anchorNode.id):-1;
    let at=(pn&&pn.children)?(_ai>=0?_ai+1:pn.children.length):null;
    nodes.forEach((data:any)=>{
      const n=insertTree(data,parentId,at);
      if(n){added.push(n.id);if(at!=null)at++;}
    });
  },{snapshot:true});
  if(!added.length)return 0;
  _outlineSel.ids=new Set<any>(added);
  _outlineSel.anchorId=added[0];
  deps.forceRender();
  /* PASTE-006：渲染后先滚到粘贴起点（首个新增节点），焦点落到末个新增节点末尾；窗口化下用 vsScrollToId */
  const _vs=deps.getVsActive();
  if(_vs)deps.vsScrollToId(_vs,added[0]);
  else{
    const _first=document.querySelector('.outline .node[data-id="'+CSS.escape(added[0])+'"] > .row') as HTMLElement|null;
    if(_first)_first.scrollIntoView({block:'nearest'});
  }
  focusAfterRender(added[added.length-1],'.outline');
  return added.length;
}

/** 缩进树最大深度（HTML 树与 plain 缩进树择优用；空树记 0）。 */
function depthOf(tree:any): number {
  let d=0;
  (tree||[]).forEach((n:any)=>{const c=1+depthOf(n&&n.children);if(c>d)d=c;});
  return d;
}

/** 外部大纲纯文本粘贴：按行首缩进构造多级节点，插入当前节点之后；无缩进返回 false。 */
function splitPastedLinesToNodes(_text:HTMLElement,id:any,lines:string[],tree?:any): boolean {
  const t=(tree&&tree.length)?tree:parseIndentedOutline((lines||[]).join('\n'));
  if(!t||!t.length)return false; if(t.length===1 && (!t[0].children || t[0].children.length===0)) return false;
  const prev=_outlineSel.anchorId;
  _outlineSel.anchorId=id;
  const n=_outlineInsertClipNodes(t);
  if(!n){_outlineSel.anchorId=prev;return false;}
  toast('已粘贴 '+n+' 个节点');
  return true;
}

/* ============================================================
   大纲多选剪贴板：copy / cut / paste
   ------------------------------------------------------------
   缺陷背景：多行（多选）复制/剪切在迁移期只有「键盘事件」一条入口，且要求
   `_outlineSel.ids.size > 1`；右栏 [data-cmd="copy"|"cut"|"paste"] 按钮走的是
   浏览器原生 copy/cut（无文本选区时静默无动作），于是「选中多行点复制/剪切」全无反应。
   现把「序列化 + 写剪贴板 + 删除节点」提成模块级函数：
     - 键盘路径（document capture 监听）沿用同一实现；
     - 按钮路径经 outlineCopySelected / outlineCutSelected 直接调用；
     - 无 clipboardData 事件可用的按钮路径用隐藏 textarea + execCommand('copy') 兜底，
       再叠加 navigator.clipboard.writeText（两者任一成功即可）。
   ============================================================ */
const _ocHasTextSel=(): boolean=>{
  const sel=window.getSelection();
  return !!(sel&&!sel.isCollapsed&&String(sel.toString()).trim());
};
const _ocSelectedTopIds=(): string[]=>{
  const doc=deps.getCurrentDoc();
  if(!doc)return [];
  if(_outlineSel.docId&&_outlineSel.docId!==doc.id)return [];
  return topSelected(doc);
};
/** 序列化当前大纲多选（以顶层选中项为单位，含整棵子树） */
function _ocBuildClip(): {ids:string[];nodes:any[];txt:string} | null {
  const ids=_ocSelectedTopIds();
  if(!ids.length)return null;
  const nodes=ids.map((id:any)=>_outlineNodeToClipData(deps.N(id))).filter(Boolean);
  if(!nodes.length)return null;
  return {ids,nodes,txt:OUTLINE_CLIP_PREFIX+JSON.stringify({v:1,nodes})};
}
/**
 * 纯文本写入系统剪贴板（按钮路径 / 事件外路径）。
 * 优先隐藏 textarea + execCommand('copy')（同步、无需权限、在 WebView2 与浏览器均可用），
 * 失败再尝试异步 navigator.clipboard.writeText。
 */
function writeClipboardText(txt:string): boolean {
  if(!txt)return false;
  let ok=false;
  try{
    const ta=document.createElement('textarea');
    ta.value=txt;
    ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try{ok=document.execCommand('copy');}catch(err){ok=false;}
    ta.remove();
  }catch(err){console.warn('[JU] caught error',err);}
  if(!ok){
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).catch(()=>{});
    }catch(err){console.warn('[JU] caught error',err);}
  }
  return ok;
}
/** 复制当前大纲多选节点（返回写入的节点数；0 = 无选中） */
export function outlineCopySelected(): number {
  const clip=_ocBuildClip();
  if(!clip)return 0;
  writeClipboardText(clip.txt);
  return clip.nodes.length;
}
/** 剪切当前大纲多选节点（写剪贴板 + 逐项删除 + 清空多选） */
export function outlineCutSelected(): number {
  const clip=_ocBuildClip();
  if(!clip)return 0;
  writeClipboardText(clip.txt);
  clip.ids.forEach((id:any)=>deps.actions.removeNode(id));
  _outlineSel.ids=new Set<any>();_outlineSel.anchorId=null;
  deps.forceRender();
  renderSidebarSafe();
  return clip.nodes.length;
}
/** 从剪贴板文本粘贴节点（JU-NODES 载荷 → 多节点）；返回插入的根节点数，0 = 非本应用载荷 */
export function outlinePasteFromText(txt: any): number {
  const nodes = _outlineParseClipText(txt);
  if (!nodes || !nodes.length) return 0;
  return _outlineInsertClipNodes(nodes);
}
/* 删除节点后侧栏同步：outline 的 deps 未含 renderSidebar，经 app/session 的全局入口兜底 */
function renderSidebarSafe(): void {
  try{
    const j:any=(window as any).JU;
    if(j&&typeof j.renderSidebar==='function')j.renderSidebar();
  }catch(err){console.warn('[JU] caught error',err);}
}

if(typeof window!=='undefined'&&!(window as any)._juOutlineClipBound){
  (window as any)._juOutlineClipBound=true;
  document.addEventListener('copy',(e:any)=>{
    var _info:any={hTS:_ocHasTextSel(),selSize:_outlineSel.ids.size,topIds:_ocSelectedTopIds().length,xsel:xselActive(),hasClip:!!(e&&e.clipboardData)};
    var clip:any=null;
    /* 1) 节点多选（_outlineSel）：≥2 个节点 → 复制节点结构；单节点且无文本选区 → 也复制该节点 */
    if(_ocSelectedTopIds().length>1 || (_ocSelectedTopIds().length===1 && !_ocHasTextSel())){
      clip=_ocBuildClip();
    }
    /* 2) 跨行文本选区（xsel，拖选多行）：_outlineSel 为空、原生选区只在首块内 ——
          旧逻辑直接放行原生复制 ⇒ 只拿到 1 块文字（「粘贴只有 1 个节点」的根因）。
          这里按 xsel 命中节点复制其结构。 */
    if(!clip && _info.xsel){
      let xids:any[]=xselRanges().map((r:any)=>r&&r.id).filter(Boolean);
      xids=xids.filter((id:any,i:number)=>xids.indexOf(id)===i);   /* 去重 */
      const xset=new Set<any>(xids);
      /* 关键：不同层级选中时，去掉「祖先也在选中集」的节点 —— 否则子树随祖先复制一次、自己又当根复制一次 ⇒ 粘贴出重复/错层 */
      const tops:any[]=xids.filter((id:any)=>{
        let cur:any=deps.N(id);let guard=0;
        while(cur&&cur.parent&&guard++<10000){ if(xset.has(cur.parent))return false; cur=deps.N(cur.parent); }
        return true;
      });
      _info.xselIds=xids.length;_info.xselTops=tops.length;
      if(tops.length){
        const nodes=tops.map((id:any)=>{try{return _outlineNodeToClipData(deps.N(id));}catch(_){return null;}}).filter(Boolean);
        if(nodes.length)clip={ids:tops,nodes:nodes,txt:OUTLINE_CLIP_PREFIX+JSON.stringify({v:1,nodes:nodes})};
      }
    }
    try{deps.reportError('diag-copy',Object.assign(_info,{clipNodes:clip?clip.nodes.length:-1}));}catch(_){}
    if(!clip)return; /* 无节点结构 → 交还原生复制（纯文字） */
    try{
      if(e&&e.clipboardData)e.clipboardData.setData('text/plain',clip.txt);
      else writeClipboardText(clip.txt);
    }catch(err){console.warn('[JU] caught error',err);}
    e.preventDefault();
    e.stopPropagation();
    toast('已复制 '+clip.nodes.length+' 个节点');
  },true);
  document.addEventListener('cut',(e:any)=>{
    if(_ocHasTextSel() && _ocSelectedTopIds().length<=1)return; /* 多选节点优先：选中≥2个节点时即使存在文本选区也复制节点结构（否则原生复制只拿到 1 行文字） */
    const clip=_ocBuildClip();
    if(!clip)return;
    try{
      if(e&&e.clipboardData)e.clipboardData.setData('text/plain',clip.txt);
      else writeClipboardText(clip.txt);
    }catch(err){console.warn('[JU] caught error',err);}
    e.preventDefault();
    e.stopPropagation();
    const n=outlineCutSelected();
    if(n)toast('已剪切 '+n+' 个节点');
  },true);
  document.addEventListener('paste',(e:any)=>{
    let txt='';
    try{txt=(e.clipboardData||(window as any).clipboardData).getData('text/plain')||'';}catch(err){txt='';}
    const nodes=_outlineParseClipText(txt);
    try{deps.reportError('diag-paste',{txtLen:txt.length,prefix:txt.slice(0,9),parsed:nodes?nodes.length:null,hasClip:!!(e&&e.clipboardData)});}catch(_){}
    if(!nodes||!nodes.length)return;
    e.preventDefault();
    e.stopPropagation();
    const n=_outlineInsertClipNodes(nodes);
    if(n)toast('已粘贴 '+n+' 个节点');
  },true);
}

export function outlineDragStart(e:any,id:any): void {
  if(e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  const doc=deps.getCurrentDoc();
  if(!doc)return;
  if(!_outlineSel.ids.has(id)){
    _outlineSel.ids=new Set<any>([id]);_outlineSel.anchorId=id;_outlineSel.docId=doc.id;
    deps.forceRender();
  }
  const tops=topSelected(doc);
  if(!tops.length)return;
  _dragState={docId:doc.id,startX:e.clientX,startY:e.clientY,active:false,tops,ghost:null,line:null,cur:null};
  document.addEventListener('mousemove',outlineDragMove);
  document.addEventListener('mouseup',outlineDragEnd);
}

export function outlineDropTarget(x:number,y:number): DropTarget | null {
  const doc=deps.getCurrentDoc();if(!doc)return null;
  const rows=[...document.querySelectorAll('.outline .node > .row')];
  let row:any=null;
  for(const r of rows){
    const rc=r.getBoundingClientRect();
    if(y>=rc.top&&y<=rc.bottom){row=r;break;}
  }
  if(!row)return null;
  const id=(row.parentElement as HTMLElement).dataset.id;
  if(!id||_outlineSel.ids.has(id))return null;
  const n=deps.N(id);if(!n)return null;
  const rc=row.getBoundingClientRect();
  const after=y>rc.top+rc.height/2;
  const depth=Number(row.dataset.depth||0);
  const oc=(document.querySelector('.outline') as HTMLElement).getBoundingClientRect();
  const baseX=oc.left+24;
  const L=Math.max(0,depth+Math.round((x-baseX)/22));
  let parent:any=null,index=0,lineTop=0,lineLeft=baseX+L*22;
  if(L>=depth+1){
    parent=id;index=after?n.children.length:0;
    lineTop=after?rc.bottom:rc.top;
    lineLeft=baseX+(depth+1)*22;
  }else if(L<=depth-1){
    let anc:any=n,ancLevel=depth;
    while(ancLevel>L&&anc.parent&&anc.parent!==deps.state.rootId){
      const ancNode=deps.N(anc.parent);if(!ancNode)return null;
      anc=ancNode;ancLevel--;
      if(_outlineSel.ids.has(anc.id))return null;
    }
    if(anc.id===n.id)return null;
    let branch=n;
    let curN:any=n,curP=deps.N(curN.parent);
    while(curP&&curP.id!==anc.id){
      branch=curN;curN=curP;curP=deps.N(curN.parent);
    }
    parent=anc.id;
    index=anc.children.indexOf(branch.id)+(after?1:0);
    lineTop=after?rc.bottom:rc.top;
  }else{
    const par=deps.N(n.parent);
    if(!par)return null;
    parent=par.id;
    index=par.children.indexOf(id)+(after?1:0);
    lineTop=after?rc.bottom:rc.top;
    lineLeft=baseX+depth*22;
  }
  if(parent==null)return null;
  if(_dragState&&_dragState.tops.some((tid:any)=>isDescendantOf(parent,tid)))return null;
  return {parent,index,lineTop,lineLeft,lineWidth:Math.max(140,rc.right-x)};
}

export function outlineDragMove(e:any): void {
  if(!_dragState)return;
  const dx=e.clientX-_dragState.startX,dy=e.clientY-_dragState.startY;
  if(!_dragState.active){
    if(Math.abs(dx)<5&&Math.abs(dy)<5)return;
    _dragState.active=true;
    const ghost=document.createElement('div');ghost.className='outline-ghost';
    ghost.textContent='移动 '+_dragState.tops.length+' 个节点';
    document.body.appendChild(ghost);
    const line=document.createElement('div');line.className='outline-drop-line';
    document.body.appendChild(line);
    _dragState.ghost=ghost;_dragState.line=line;
    document.body.classList.add('drag-outline');
    _dragState.tops.forEach((id:any)=>{
      const el=document.querySelector('.outline .node[data-id="'+CSS.escape(id)+'"] > .row');
      if(el)el.classList.add('dragging');
    });
  }
  if(_dragState.ghost){
    _dragState.ghost.style.left=(e.clientX+12)+'px';
    _dragState.ghost.style.top=(e.clientY+12)+'px';
  }
  const t=outlineDropTarget(e.clientX,e.clientY);
  _dragState.cur=t;
  if(t&&_dragState.line){
    _dragState.line.style.display='block';
    _dragState.line.style.left=(t.lineLeft)+'px';
    _dragState.line.style.top=(t.lineTop-1)+'px';
    _dragState.line.style.width=(t.lineWidth)+'px';
  }else if(_dragState.line){
    _dragState.line.style.display='none';
  }
  const sc=document.getElementById('content');
  if(sc){
    const r=sc.getBoundingClientRect();
    if(e.clientY<r.top+46)sc.scrollTop-=14;
    else if(e.clientY>r.bottom-46)sc.scrollTop+=14;
  }
}

export function outlineDragEnd(e:any): void {
  const ds=_dragState;
  if(!ds)return;
  _dragState=null;
  document.removeEventListener('mousemove',outlineDragMove);
  document.removeEventListener('mouseup',outlineDragEnd);
  if(ds.ghost)ds.ghost.remove();
  if(ds.line)ds.line.remove();
  document.body.classList.remove('drag-outline');
  ds.tops.forEach((id:any)=>{
    const el=document.querySelector('.outline .node[data-id="'+CSS.escape(id)+'"] > .row');
    if(el)el.classList.remove('dragging');
  });
  if(ds.active&&ds.cur){
    const t=ds.cur;
    outlineBatchMove(ds.tops,t.parent,t.index);
  }
}

export function bindOutlineText(text:HTMLElement,id:any): void {
  let composing=false;
  let _lastDoneTapAt=0;/* FIX-mobile-1: 同一元素实例内两次 tap 的时间窗计时 */
  text.addEventListener('compositionstart',()=>composing=true);
  text.addEventListener('compositionend',()=>{composing=false;syncEmptyState(text);});
  text.addEventListener('input',(e:any)=>{
    if(composing||e.isComposing)return;
    syncEmptyState(text);
  });
  text.addEventListener('focus',()=>{
    resetSavedFocus();
    deps.ui.focusId=id;
    $$('.row.sel').forEach(r=>r.classList.remove('sel'));
    text.closest('.row')?.classList.add('sel');
  });
  text.addEventListener('blur',()=>{
    if(isBlurSuppressed())return;
    if(!text.isConnected)return;
    const finalHtml=deps.sanitizeHtml(text.innerHTML);
    const cur=deps.N(id);
    if(cur&&finalHtml!==(cur.text||''))deps.actions.updateText(id,finalHtml,{noHistory:true}); /* FIX-P1-3: blur 提交并入上一次用户操作，不单独拍撤销步（与 commitPendingEditBeforeRender 语义一致） */
  });
  /* 【粘贴修复 P0】多行纯文本/块级 HTML 按行拆分为多个兄弟节点；首尾空行清理；单行富文本保留格式。 */
  text.addEventListener('paste',(e:any)=>{
    try{
      const dt=e.clipboardData||(window as any).clipboardData;
      if(!dt)return;
      e.preventDefault();
      const parsed=deps.parsePasteLines(dt);
      const plainSrc=parsed.plain?String(parsed.plain).replace(/\r\n?/g,'\n').split('\n'):[];
      const srcLines=plainSrc.filter((l:string)=>l.trim()).length>1?plainSrc:parsed.lines;
      const plainTree=parseIndentedOutline(plainSrc.join('\n'));
      /* HTML 树严格深于 plain 缩进树才采用，避免扁平 HTML 覆盖 plain 层级；否则回退行数组。 */
      const htmlTree=parsed.tree;
      const useHtml=!!htmlTree&&(!plainTree||depthOf(htmlTree)>depthOf(plainTree));
      const srcTree:any=useHtml?htmlTree:plainTree;
      const isMultiNodeTree=!!srcTree&&(srcTree.length>1||!!(srcTree[0].children&&srcTree[0].children.length>0));
      if(isMultiNodeTree){
        if(deps.splitPastedLinesToNodes(text,id,srcLines,srcTree))return;
      }else if(srcLines.length>1){
        if(deps.splitPastedLinesToNodes(text,id,srcLines))return;
      }
      /* fix-paste-1：外部大纲应用多块级标签 HTML 按块拆为兄弟节点，阻止整段塞入单节点 */
      const pasteHtml=String(dt.getData('text/html')||'');
      if(pasteHtml){
        const _pdoc=new DOMParser().parseFromString(pasteHtml,'text/html');
        const _sel='div,p,li,h1,h2,h3,h4,h5,h6';
        const _blocks=(_pdoc.body?Array.from(_pdoc.body.querySelectorAll(_sel)):[]).filter((el:any)=>!(el.parentElement&&el.parentElement.closest(_sel)));
        const _blines=_blocks.map((el:any)=>String(el.textContent||'').replace(/\s+/g,' ').trim()).filter((l:string)=>l);
        if(_blines.length>1&&deps.splitPastedLinesToNodes(text,id,_blines))return;
      }
      if(parsed.html){
        const clean=deps.sanitizeHtml(deps.trimPasteHtml(parsed.html));
        if(clean){
          deps.safeExec('insertHTML',clean);
          syncEmptyState(text);
          return;
        }
      }
      const plainLines=parsed.lines.length?parsed.lines:(parsed.plain?parsed.plain.split(/\r\n?|\n/):[]);
      if(plainLines.length>1){
        deps.safeExec('insertHTML',plainLines.map(function(l){return esc(l);}).join('<br>'));
      }else if(plainLines.length===1){
        deps.safeExec('insertText',plainLines[0]);
      }
      syncEmptyState(text);
    }catch(err){console.warn('[JU] caught error',err);}
  });
  text.addEventListener('dblclick',(e:any)=>{
    if(e.target!==text)return;
    if(e.altKey)return;
    if(Date.now()-deps.lastTouchDoneToggleAt<600)return;/* FIX-mobile-1: 触摸双击已切换，吞掉随后的原生 dblclick 防二次切换 */
    const sel=window.getSelection();
    if(sel&&!sel.isCollapsed)return;
    e.preventDefault();
    deps.actions.toggleDone(id);
    deps.forceRender();
  });
  text.addEventListener('click',(e:any)=>{
    if(e.target!==text)return;
    /* FIX-mobile-1: 移动端不触发 dblclick，触摸双击（两次 tap <300ms）走同一 toggleDone；桌面鼠标双击/altClick 路径完全不变 */
    if(deps.lastPointerType==='touch'&&!e.altKey&&!e.ctrlKey&&!e.metaKey){
      const tsel=window.getSelection();
      if(tsel&&tsel.isCollapsed){
        const now=Date.now();
        if(now-_lastDoneTapAt<300){
          _lastDoneTapAt=0;
          deps.lastTouchDoneToggleAt=Date.now();
          e.preventDefault();
          deps.actions.toggleDone(id);deps.forceRender();
          return;
        }
        _lastDoneTapAt=now;
      }
    }
    if(e.altKey){e.preventDefault();deps.actions.toggleDone(id);deps.forceRender();return;}
    /* Wiki 链接跳转：Ctrl / Cmd + 点击 [[链接]]（与 altKey 判定合并为单一监听） */
    if(e.ctrlKey||e.metaKey){
      const lt=linkTitleAtPoint(text,e);
      if(!lt)return;
      e.preventDefault();
      navigateToWikiLink(lt,text);
    }
  });
  /* 【修复 L2】大纲文本节点右键菜单，与日历节点交互一致 */
  text.addEventListener('contextmenu',(e:any)=>{
    /* FIX-mobile-2: 触屏长按放行系统复制/粘贴浮动菜单（不 preventDefault、不弹应用菜单）；鼠标右键保留自建菜单。
       .row-title 行菜单（script_2.js，L-43 需决策项）不受影响。 */
    if(deps.lastPointerType==='touch')return;
    e.preventDefault();
    const cur=deps.N(id);
    if(!cur)return;
    const items:any[]=[];
    if(_outlineSel.ids.size>1&&_outlineSel.ids.has(id)){
      const tops=topSelected(deps.getCurrentDoc());
      items.push({sep:true});
      items.push({ic:'🗑',txt:'删除所选 ('+tops.length+' 个)',danger:true,fn:()=>outlineBatchDelete()});
      items.push({ic:'⤵',txt:'缩进所选',fn:()=>outlineBatchIndent()});
      items.push({ic:'⤴',txt:'反缩进所选',fn:()=>outlineBatchOutdent()});
      items.push({sep:true});
    }
    items.push(
      {ic:cur.done?'○':'●',txt:cur.done?'标记未完成':'标记完成',fn:()=>{deps.actions.toggleDone(id);deps.forceRender();}},
      {ic:'⤵',txt:'缩进',fn:()=>indentNode(id)},
      {ic:'⤴',txt:'反缩进',fn:()=>outdentNode(id)},
      {sep:true},
      {ic:'📋',txt:'复制节点',fn:()=>{
        const p=deps.N(cur.parent);if(!p)return;
        const idx=p.children.indexOf(id);
        const newId=deps.actions.addNode(cur.parent,idx+1,
          clone({text:cur.text,done:cur.done,date:cur.date,time:cur.time,timeEnd:cur.timeEnd,tags:cur.tags,priority:cur.priority}));
        deps.forceRender();
        if(newId)focusAfterRender(newId,'.outline');
      }},
      {ic:'📅',txt:'添加到日历',fn:()=>{deps.actions.setNodeDate(id,todayStr());toast('已添加到日历');}},
      cur.block==='table'
        ?{ic:'📝',txt:'转为文本节点',fn:()=>{
          deps.commit((s:any)=>{const nn=s.nodes[id];if(!nn)return;delete nn.block;delete nn.tableData;nn.updatedAt=deps.nowSeq();},{snapshot:true,op:'updateText',opArgs:{id}});
          deps.forceRender();
        }}
        :{ic:'📊',txt:'插入内联表格',fn:()=>{
          deps.commit((s:any)=>{
            const nn=s.nodes[id];
            if(!nn)return;
            nn.block='table';
            nn.tableData={cols:['项目','数量','金额'],rows:[['','','']]};
            nn.updatedAt=deps.nowSeq();
          },{snapshot:true});
          deps.forceRender();
        }},
      {sep:true},
      {ic:'🗑',txt:'删除节点',danger:true,fn:()=>{
        const prevId=previousVisible(id);
        deps.actions.removeNode(id);
        deps.forceRender();
        if(prevId)focusAfterRender(prevId,'.outline');
      }}
    );
    showContextMenu(items,e);
  });
  text.addEventListener('keydown',(e:any)=>{
    /* 【修复 2026-09-27】IME 组字中按 Enter（选词/确认）不得触发新建节点 */
    if(e.isComposing||e.keyCode===229)return;
    /* 【fix7 · D-12】跨行选区的取消与删除必须挂在**本块** keydown 上：
       正文 keydown 末尾 `e.stopPropagation()` 会把 Esc 拦在这里，document 级 Esc 收不到。 */
    if(e.key==='Escape'&&xselActive()){e.preventDefault();xselClear();return;}
    /* 【fix7 · D-12】跨行选区 + Backspace：逐块删除模型覆盖的文字。
       放在原生「非折叠选区直接放行」判定之前 —— 跨行时原生选区只在首块内，直接放行会只删首块。 */
    if((e.key==='Backspace'||e.key==='Delete')&&!e.altKey&&xselActive()){
      e.preventDefault();e.stopPropagation();
      xselBackspaceCommit();
      return;
    }
    const n=deps.N(id);if(!n)return;
    const sel=window.getSelection();
    if(sel&&!sel.isCollapsed&&e.key==='Backspace'&&!e.altKey)return;
    let atStart=false;
    if(sel&&sel.isCollapsed&&sel.anchorNode&&text.contains(sel.anchorNode)){
      try{
        const r=document.createRange();
        r.selectNodeContents(text);
        r.setEnd(sel.anchorNode,sel.anchorOffset);
        atStart=r.toString().length===0;
        /* 【修复 2026-09-27】空节点仅含 <br> 时 textContent 为换行符，
           范围文本判定失效；以纯空白内容 + 光标在开头兜底判定 */
        if(!atStart&&sel.anchorOffset===0&&(!text.textContent||text.textContent.replace(/\s/g,'')===''))atStart=true;
      }catch(err){atStart=false;}
    }
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();if(deps.undo()){deps.forceRender();toast('已撤销');}return;}
    if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){e.preventDefault();if(deps.redo()){deps.forceRender();toast('已重做');}return;}
    if(e.key==='Enter'&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey){
      e.preventDefault();
      const s2=window.getSelection();
      if(!s2||!s2.rangeCount)return;
      const range=s2.getRangeAt(0);
      const afterRange=range.cloneRange();
      afterRange.selectNodeContents(text);
      afterRange.setStart(range.endContainer,range.endOffset);
      const afterFrag=afterRange.extractContents();
      const tmp=document.createElement('div');
      tmp.appendChild(afterFrag);
      const afterHtml=deps.sanitizeHtml(tmp.innerHTML).trim();
      const beforeHtml=deps.sanitizeHtml(text.innerHTML).trim();
      const p=deps.N(n.parent);const idx=p?p.children.indexOf(id):0;
      let newId:any=null;
      deps.commit((s:any)=>{
        const nn=s.nodes[id];
        if(nn&&beforeHtml!==(nn.text||'')){nn.text=beforeHtml;nn.updatedAt=deps.nowSeq();}
        const added=deps.addNodeTo(s,n.parent,idx+1,{text:afterHtml});
        if(added)newId=added.id;
      },{snapshot:true});
      if(!newId)return;
      deps.actions.logActivity('add',newId);
      deps.forceRender();
      focusAfterRender(newId,'.outline');
      return;
    }
    if(e.key==='Tab'){e.preventDefault();if(e.shiftKey)outdentNode(id);else indentNode(id);return;}
    if(e.key==='Backspace'&&atStart&&!e.altKey){
      e.preventDefault();
      /* 【修复 缺陷1】判定/合并一律以 DOM 实时内容为准（state 可能在 blur 前滞后，
         否则未提交文本会被误删） */
      const liveHtml=deps.sanitizeHtml(text.innerHTML);
      const livePlain=stripHtml(liveHtml).trim();
      if(livePlain.length>0){
        const prevId=previousVisible(id);
        if(prevId){
          const prevNode=deps.N(prevId);
          /* 【修复 BUG-A】prevId 为文档标题节点时不合并，避免标题被正文污染 */
          if(prevNode&&prevNode.parent===deps.state.rootId)return;
          /* 【修复 缺陷2】拼接点 = prevId 既有文本长度，光标落点用 offset 定位 */
          const caretOffset=stripHtml((prevNode&&prevNode.text)||'').length;
          deps.commit((s:any)=>{
            const pn=s.nodes[prevId],cn=s.nodes[id];
            if(!pn||!cn)return;
            cn.text=liveHtml;                 /* 先落盘实时内容 */
            /* 【P2-13 H5】用 DOMParser 合并两侧 DOM，避免标签错配 */
            try{
              const docP=new DOMParser().parseFromString('<div>'+(pn.text||'')+'</div>','text/html');
              const docC=new DOMParser().parseFromString('<div>'+cn.text+'</div>','text/html');
              const bodyP=docP.body.firstChild as any;
              Array.from((docC.body.firstChild as any).childNodes).forEach((child:any)=>{
                bodyP.appendChild(docP.importNode(child,true));
              });
              pn.text=bodyP.innerHTML;
            }catch(e){
              pn.text=(pn.text||'')+cn.text; /* 降级：字符串拼接 */
            }
            pn.updatedAt=deps.nowSeq();          /* 【修复 缺陷5】刷新时间戳 */
            const movedKids=(cn.children||[]).slice();
            movedKids.forEach((cid:any)=>{
              const cc=s.nodes[cid];
              if(cc){cc.parent=prevId;pn.children.push(cid);}
            });
            const p=s.nodes[cn.parent];
            if(p){const i=p.children.indexOf(id);if(i>=0)p.children.splice(i,1);}
            delete s.nodes[id];
            pn.collapsed=false;
          },{snapshot:true});
          deps.actions.logActivity('mod',prevId);  /* 【修复 缺陷5】补系统日志 */
          deps.forceRender();focusAfterRender(prevId,'.outline',{offset:caretOffset});
        }
        return;
      }
      /* 空节点 + 有子：禁止反缩进越出当前文档（缺陷3） */
      if((n.children||[]).length){
        const p=deps.N(n.parent);
        const gp=p?deps.N(p.parent):null;
        if(!gp||gp.id===deps.state.rootId){toast('该节点已处于顶层，无法再反缩进');return;}
        outdentNode(id);
        return;
      }
      /* 空节点 + 无子：删除（缺陷4：prevId 为 null 时也删除，不静默跳过） */
      const prevId=previousVisible(id);
      if(prevId){
        deps.actions.removeNode(id);
        deps.forceRender();focusAfterRender(prevId,'.outline');
      }else{
        deps.actions.removeNode(id);
        deps.forceRender();
      }
      return;
    }
    if((e.ctrlKey||e.metaKey)&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();moveSibling(id,e.key==='ArrowUp'?-1:1);return;}
    /* 【fix7 · D-12】Shift+↑/↓ = 跨行扩选：焦点端点按「相邻块」推进，由选区模型承载
       （旧行为：Shift+↓ 被下方「折叠光标 → 跳到下一节点」抢走，表现为整块跳转、选区塌陷）。 */
    if(e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){
      if(xselExtend(e.key==='ArrowDown'?1:-1)){e.preventDefault();e.stopPropagation();return;}
    }
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&e.key==='ArrowUp'&&sel&&sel.isCollapsed){
      let atFirstLine=false;
      try{
        const r=document.createRange();
        r.selectNodeContents(text);
        r.setEnd(sel.anchorNode!,sel.anchorOffset);
        atFirstLine=!r.toString().includes('\n');
      }catch(err){console.warn('[JU] caught error',err);}
      if(atFirstLine){
        const prevId=previousVisible(id);
        if(prevId){e.preventDefault();focusNode(prevId,null,true);}
      }
      return;
    }
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&e.key==='ArrowDown'&&sel&&sel.isCollapsed){
      const nextId=nextVisible(id);
      if(nextId){e.preventDefault();focusNode(nextId,null,true);}
      return;
    }
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){
      e.preventDefault();
      const p=deps.N(n.parent);if(!p)return;
      const idx=p.children.indexOf(id);
      const newId=deps.actions.addNode(n.parent,idx+1,clone({text:n.text,done:n.done,date:n.date,time:n.time,timeEnd:n.timeEnd,tags:n.tags,priority:n.priority}));
      deps.forceRender();focusAfterRender(newId,'.outline');toast('已复制');return;
    }
    if(!(e.ctrlKey||e.metaKey))e.stopPropagation();
  });
}

/** 【fix7 · D-12】跨行 Backspace/Delete 的落地：DOM 逐块删字 → 写回 state。
 *  【fix-del-sync/2】不同层级删空：先删空叶子，再级联删「已删空且已无子」的父节点；
 *  删除一律走 deps.actions.removeNode（写 _recentlyRemoved 墓碑），否则
 *  runPersist→mergeRemoteState 会把刚删节点从磁盘快照复活（旧实现只 delete，节点必回）。 */
function xselBackspaceCommit(): void {
  const dels=xselDelete();
  if(!dels.length)return;
  const emptied:any[]=[];
  deps.commit((s:any)=>{
    dels.forEach((d:any)=>{
      const nn=s.nodes[d.id];
      if(!nn)return;
      const newHtml=deps.sanitizeHtml(d.html);
      const plain=stripHtml(newHtml).trim();
      if(!plain)emptied.push(d.id);
      nn.text=newHtml;
      nn.updatedAt=deps.nowSeq();
    });
  },{snapshot:true});
  /* 级联删除：删空且无子 → removeNode；父节点因子节点被删而变空变无子 → 下一轮一并删 */
  let removed=0,changed=true,guard=0;
  while(changed&&guard++<64){
    changed=false;
    for(const id of emptied){
      const n=deps.N(id);
      if(!n)continue;
      if((n.children||[]).length===0){
        try{deps.actions.removeNode(id);removed++;changed=true;}catch(_){}
      }
    }
  }
  _outlineSel.ids=new Set<any>(Array.from(_outlineSel.ids).filter((x:any)=>!!deps.N(x)));
  deps.forceRender();
  toast('已删除跨行选区（'+dels.length+' 段'+(removed?('，同步删除 '+removed+' 个空节点'):'')+'）');
}

export function previousVisible(id:any): any {
  const n=deps.N(id);if(!n)return null;
  const p=deps.N(n.parent);if(!p)return null;
  const i=p.children.indexOf(id);
  if(i>0){
    let prev=p.children[i-1];
    /* FIX-P1-7: 下降遍历加 visited 兜底——父链/children 数据损坏成环时防死循环 */
    const _vis=new Set<any>();
    while(deps.N(prev)&&deps.N(prev).children.length&&!deps.N(prev).collapsed&&!_vis.has(prev)){_vis.add(prev);const c=deps.N(prev).children;prev=c[c.length-1];}
    return deps.N(prev)?prev:null;
  }
  return p.id===deps.state.rootId?null:p.id;
}

export function nextVisible(id:any): any {
  const n=deps.N(id);
  if(!n)return null;
  if(n.children.length&&!n.collapsed)return n.children[0];
  let cur=id;
  const _vis=new Set<any>(); /* FIX-P1-7: 上溯加 visited 兜底——父链成环（数据损坏）时原 while(cur) 死循环 */
  while(cur&&!_vis.has(cur)){
    _vis.add(cur);
    const parentId=deps.N(cur)?.parent;
    if(!parentId)return null;
    const p=deps.N(parentId);
    if(!p)return null;
    const i=p.children.indexOf(cur);
    if(i<p.children.length-1)return p.children[i+1];
    cur=p.id;
    if(cur===deps.state.rootId)return null;
  }
  return null;
}

export function indentNode(id:any): void {
  const n=deps.N(id);if(!n)return;
  const p=deps.N(n.parent);if(!p)return;
  const idx=p.children.indexOf(id);
  if(idx<=0)return;
  const prevId=p.children[idx-1];
  const prev=deps.N(prevId);if(!prev)return;
  deps.actions.moveNode(id,prevId,prev.children.length);
  deps.forceRender();focusAfterRender(id,'.outline');
}

export function outdentNode(id:any): void {
  const n=deps.N(id);if(!n)return;
  const p=deps.N(n.parent);if(!p||p.id===deps.state.rootId)return;
  const gp=deps.N(p.parent);
  if(!gp||gp.id===deps.state.rootId)return;   /* 【修复 缺陷3】禁止越出当前文档 */
  const pi=gp.children.indexOf(p.id);
  deps.actions.moveNode(id,gp.id,pi+1);
  deps.forceRender();focusAfterRender(id,'.outline');
}

export function moveSibling(id:any,dir:number): void {
  const n=deps.N(id);if(!n)return;
  const p=deps.N(n.parent);if(!p)return;
  const i=p.children.indexOf(id);
  if(i<0)return;/* FIX-M-20: indexOf 为 -1（数据损坏）时 j=i+dir 可能 >=0 穿过越界守卫，提前返回防止重复引用 */
  const j=i+dir;
  if(j<0||j>=p.children.length)return;
  deps.actions.moveNode(id,p.id,j);
  deps.forceRender();focusAfterRender(id,'.outline');
}
