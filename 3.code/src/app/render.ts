/**
 * M1-1 · 批次 AI · 主渲染器（视图分发核心）
 *
 * 来源：6.P0-T3基线/public/v2.0-t3.html（canonical，只读）
 *   - _computeViewKey .............................................................. 15646-15653
 *   - renderMain .................................................................... 15654-15798
 *
 * 约束（零漂移）：分支顺序、早退条件（编辑态不重建 #content）、视图 key 计算口径、
 *   滚动位置保存/恢复、虚拟滚动解绑、视图卸载钩子（graph / mindmap / slides `_cleanup`）、
 *   容器视图 graph/history 回落 auto、`#content` padding 收敛值、DOM 类名逐字保留。
 *   仅作两类纯类型层处理：
 *     1) 未拆分符号（ui / state / N / viewOf / forceRender 置位 / 各视图渲染函数 /
 *        外部派生面板刷新 / 滚动与虚拟滚动模块级状态）统一走 `RenderMainDeps` 注入。
 *     2) 节点级 DOM 扩展（`_cleanup` / `_vs`）以 `as any` 访问（纯类型层，运行期零差异）。
 */

import { $ } from '../core/utils';
import { VIEW_KIND } from '../core/constants';
/**
 * 【P0 · 实机选区丢失】格式写入期间的重绘拦截标记。
 * core/richtext 不依赖 app/ 与 views/（已核验），此处静态导入无循环风险。
 */
/**
 * P0-T3 · 视图渲染入口直连真实模块（消除 `() => document.createElement('div')` 占位）
 *
 * 原 `deps` 内 7 个主视图渲染函数默认值为空 div 占位：一旦装配层漏注入（或注入顺序错位），
 * `renderMain` 的 switch 仍会「成功」返回一个空节点，缺陷表现为静默空白而非显式报错。
 * 现改为直接引用各视图模块的真实导出，占位实现整体下线。
 * 依赖方向：views/* → core/* + ui/*，不回链 app/（已核验），故此处静态导入无循环风险。
 */
import { renderOutlinePage } from '../views/outline';
import { renderCalendarPage } from '../views/calendar';
import { renderDatabasePage } from '../views/database/render';
import { renderMindmap } from '../views/mindmap';
import { renderPresentation } from '../views/presentation';
import { renderGraph } from '../views/graph';
import { renderSlidesView } from '../views/slides';
import {
  renderStarredView,
  renderTemplatesView,
  renderTrashView,
  renderTagsView,
  renderTagNodes,
  renderHistoryView,
} from '../views/lists';

/** 视图渲染函数签名（返回宿主节点，可空）；批次 DE 复核后无外部引用，降级为模块内私有 */
type ViewRenderer = (doc?: any) => HTMLElement | null;

export interface RenderMainDeps {
  /* ── 核心运行时 ── */
  ui: any;
  state: any;
  N: (id: any) => any;
  viewOf: (doc: any) => any;
  getCurrentDoc: () => any;
  isForceRender: () => boolean;
  setForceRender: (v: boolean) => void;

  /* ── 外部派生面板与侧栏 / 右栏 / 焦点 ── */
  syncTopbar: () => void;
  updateRightSidebar: () => void;
  renderIntro: () => void;
  updateRemindBadge: () => void;
  renderFloatCal: () => void;
  floatCalVisible: () => boolean;
  ensureElInViewport: (el: any) => void;
  renderSidebar: () => void;
  restoreFocus: () => void;

  /* ── 日历编辑态早退的局部面板刷新 ── */
  buildStatsBlock: () => HTMLElement;
  buildCalLogBlock: () => HTMLElement;
  calModuleCharsBody: (head: any) => HTMLElement;

  /* ── 大纲标题尺寸观察 / 虚拟滚动 ── */
  disconnectOutlineHeaderRO: () => void;
  observeOutlineHeader: (el: any) => void;
  vsUpdate: (vs: any) => void;
  vsScrollToId: (vs: any, id: any) => void;
  getVsActive: () => any;
  setVsActive: (v: any) => void;

  /* ── 跨视图滚动位置（模块级状态承接） ── */
  getCalTgPrevScroll: () => number | null;
  setCalTgPrevScroll: (v: number | null) => void;
  getSavedOutlineScroll: () => number;
  setSavedOutlineScroll: (v: number) => void;
  savedMindmapScroll: { x: number; y: number };
  setCalDayNodesForModules: (v: any) => void;
  getTagIndexCache: () => Map<string, any> | null;

  /* ── 各视图渲染函数 ── */
  renderFolderGrid: (doc: any) => HTMLElement;
  renderCalendarPage: () => HTMLElement;
  renderDatabasePage: (doc: any) => HTMLElement;
  renderOutlinePage: (doc: any) => HTMLElement;
  renderMindmap: (doc: any) => HTMLElement;
  renderPresentation: (doc: any) => HTMLElement;
  renderGraph: () => HTMLElement;
  renderStarredView?: ViewRenderer;
  renderTemplatesView?: ViewRenderer;
  renderTrashView?: ViewRenderer;
  renderSlidesView?: ViewRenderer;
  renderStatsView?: ViewRenderer;
  renderTagsView?: ViewRenderer;
  renderTagNodes?: ViewRenderer;
  renderHistoryView?: ViewRenderer;
}

/** 模块内安全占位（加载即不抛错；真实实现在 src/main.ts 装配时注入）。 */
export const deps: RenderMainDeps = {
  ui: {},
  state: { nodes: {}, rootId: null },
  N: () => null,
  viewOf: () => null,
  getCurrentDoc: () => null,
  isForceRender: () => false,
  setForceRender: () => {},
  syncTopbar: () => {},
  updateRightSidebar: () => {},
  renderIntro: () => {},
  updateRemindBadge: () => {},
  renderFloatCal: () => {},
  floatCalVisible: () => false,
  ensureElInViewport: () => {},
  renderSidebar: () => {},
  restoreFocus: () => {},
  buildStatsBlock: () => document.createElement('div'),
  buildCalLogBlock: () => document.createElement('div'),
  calModuleCharsBody: () => document.createElement('div'),
  disconnectOutlineHeaderRO: () => {},
  observeOutlineHeader: () => {},
  vsUpdate: () => {},
  vsScrollToId: () => {},
  getVsActive: () => null,
  setVsActive: () => {},
  getCalTgPrevScroll: () => null,
  setCalTgPrevScroll: () => {},
  getSavedOutlineScroll: () => 0,
  setSavedOutlineScroll: () => {},
  savedMindmapScroll: { x: 0, y: 0 },
  setCalDayNodesForModules: () => {},
  getTagIndexCache: () => null,
  /* P0-T3 · `renderFolderGrid` 的真实实现在 app/session（本模块被 session 反向引用，
     静态导入会成环），因此仍由装配层 `bindRenderMainDeps` 注入，此处保留最小健全默认值。 */
  renderFolderGrid: () => document.createElement('div'),
  /* 以下全部为真实视图模块导出（不再有空 div 占位） */
  renderCalendarPage,
  renderDatabasePage,
  renderOutlinePage,
  renderMindmap,
  renderPresentation,
  renderGraph,
  renderStarredView,
  renderTemplatesView,
  renderTrashView,
  renderSlidesView,
  renderTagsView,
  renderTagNodes,
  renderHistoryView,
  /* `renderStatsView`（统计视图）尚未迁入本工程：switch 内已用
     `typeof deps.renderStatsView === 'function'` 守卫，未注入时该分支返回 null（不渲染），
     故此处不设占位实现。 */
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function bindRenderMainDeps(next: Partial<RenderMainDeps>): void {
  Object.assign(deps, next);
}

/* P1-4：当前视图 key 统一计算口径（ui.view==='auto' → viewOf(当前文档)，容器视图回落 nav） */
export function _computeViewKey(): string {
  const { ui, state, N, viewOf } = deps;
  const curId=ui.currentDocId&&state.nodes[ui.currentDocId]?ui.currentDocId:state.rootId;
  const doc=N(curId);
  let view=ui.view==='auto'?viewOf(doc):ui.view;
  const nav=viewOf(doc);
  if((view==='graph'||view==='history')&&(nav===VIEW_KIND.CALENDAR||nav===VIEW_KIND.FOLDER||nav===VIEW_KIND.LIBRARY_ROOT))view=nav;
  return view+':'+(curId||'');
}

export function renderMain(): void {
  const { ui, state, N, viewOf, getCurrentDoc } = deps;
  const content=$('#content');
  /* FIX: 在 renderMain 清空 #content（下方 c.innerHTML=''）之前记录日历时间网格滚动位置，
     供 week/day 网格重建时恢复原位（视图/日期未变的重建）；视图/日期变化时仍走自动滚动 */
  const _oldTg=content&&content.querySelector('.cal-tg-scroll');
  deps.setCalTgPrevScroll(_oldTg?(_oldTg as HTMLElement).scrollTop:null);
  const oldGraph: any=content&&content.querySelector('.graph-canvas');
  if(oldGraph&&oldGraph._cleanup)oldGraph._cleanup();
  const oldMM: any=content&&content.querySelector('.mm-wrap');
  if(oldMM&&oldMM._cleanup)oldMM._cleanup(); /* 指令10 · 导图视图回收（断开 ResizeObserver / rAF） */
  const oldSlides: any=content&&content.querySelector('.ju-sl-wrap');
  if(oldSlides&&oldSlides._cleanup)oldSlides._cleanup(); /* L17-W3 · 指令 3：幻灯片视图卸载回收（resize 监听 + _cleanups 登记项） */
  deps.disconnectOutlineHeaderRO(); /* L16-W4 · 指令4：重渲染前断开旧标题 ResizeObserver（与视图 _cleanup 同址） */
  if(ui._resizingCol){
    if(ui._resizingColStart && Date.now()-ui._resizingColStart<3000) return;
    ui._resizingCol=false;
    ui._resizingColStart=0;
  }
  const c=$('#content');
  if(!c)return;
  /* 【批次3 · 撤销重绘拦截】此处曾按 editor.isFormatting 在写入期间跳过主面板重建。
     该拦截是「掩盖症状」：真正失效原因是点工具栏把焦点抢走 + 写入引擎在两段命令
     之间让节点引用失效。批次1（mousedown 防失焦）与批次2（纯文本重建引擎）已从
     根上修掉这两条，拦截留在渲染侧只会与「焦点归还后的正常同步」冲突 ——
     现已移除，renderMain 不再读取格式写入标记。 */
  const ae=document.activeElement as any;
  const isTextEditing=ae&&ae.closest&&ae.closest('#content')&&(
    ae.isContentEditable||
    ae.tagName==='TEXTAREA'||
    (ae.tagName==='INPUT'&&!['checkbox','radio','button','submit','range'].includes(ae.type))
  );
  if(isTextEditing&&!deps.isForceRender()){
    deps.syncTopbar();
    deps.updateRightSidebar();
    deps.renderIntro(); /* 【UI修复6】编辑内容（字数/编辑时间变化）时同步刷新左侧文档信息 */
    /* FIX-P0-4: 编辑态早退也同步 _lastViewKey——与主渲染路径同口径计算当前 viewKey。
       原早退不更新，若早退期间视图/文档已切换（未走 forceRender 的轻量路径），
       下次真渲染的 viewChanged 会拿旧 key 比较而误判为 false，错误恢复旧滚动位置 */
    {
      ui._lastViewKey=_computeViewKey();
    }
    /* FIX-L-02 编辑态早退不重建 #content 主面板（保持打字焦点不丢失），但日历/数据库视图的派生统计面板需局部同步：
       仅刷新这两个视图相关的轻量外部面板（到点提醒角标、可见的悬浮迷你日历），不触碰正在编辑的主面板 DOM */
    const _earlyView=ui.view==='auto'?viewOf(getCurrentDoc()):ui.view;
    if(_earlyView===VIEW_KIND.CALENDAR||_earlyView===VIEW_KIND.DATABASE){
      deps.updateRemindBadge();
      const _fc=$('#floatCal');
      if(_fc&&!_fc.hidden)deps.renderFloatCal();
      /* FIX-M-14 日历视图编辑态早退时局部刷新两个派生面板（统计/系统日志）：只重填面板 body 容器，
         不重建 #content、不触碰正在编辑的焦点 DOM；buildStatsBlock 为 script_4 模块级函数（返回 DOM 节点），
         buildCalLogBlock 定义于 script_1.js 顶部；typeof 守卫仅作极端降级兜底 */
      if(_earlyView===VIEW_KIND.CALENDAR){
        /* 底部模块化后：统计 / 系统日志均为 .cal-module[data-key=...] 的 body，按模块定位重填 */
        const _sb=c&&c.querySelector('.cal-module[data-key="stats"] .cal-module-body');
        if(_sb){try{_sb.innerHTML='';_sb.appendChild(deps.buildStatsBlock());}catch(e){/* 与 script_1 既有调用同款 try/catch 兜底 */}}
        const _lb=c&&c.querySelector('.cal-module[data-key="log"] .cal-module-body');
        if(_lb&&typeof deps.buildCalLogBlock==='function'){try{const _p=deps.buildCalLogBlock();const _pb=_p.querySelector('.cal-panel-body');_lb.innerHTML='';if(_pb)_lb.appendChild(_pb);}catch(e){console.warn('[JU] caught error',e);}}
        const _cb=c&&c.querySelector('.cal-module[data-key="chars"] .cal-module-body');
        if(_cb){try{_cb.innerHTML='';_cb.appendChild(deps.calModuleCharsBody((_cb.closest('.cal-module') as any).querySelector('.cal-module-head')));}catch(e){console.warn('[JU] caught error',e);}}
      }
    }
    return;
  }
  deps.setForceRender(false);
  const curId=ui.currentDocId&&state.nodes[ui.currentDocId]?ui.currentDocId:state.rootId;
  ui.currentDocId=curId;
  const curDoc=N(curId);
  let view=ui.view==='auto'?viewOf(curDoc):ui.view;
  /* 容器（日历/文件夹/资料库）不生成图谱/历史视图：持久化残留的 graph/history 强制回落 auto 渲染 */
  {
    const _cvNav=viewOf(curDoc);
    if((view==='graph'||view==='history')&&(_cvNav===VIEW_KIND.CALENDAR||_cvNav===VIEW_KIND.FOLDER||_cvNav===VIEW_KIND.LIBRARY_ROOT)){
      view=_cvNav;ui.view='auto';
    }
  }
  /* R37：日历视图内容区内距收敛为 5px（与模块间距同口径）；其余视图置空恢复默认样式 */
  c.style.padding=(view===VIEW_KIND.CALENDAR)?'5px':'';
  const viewKey=_computeViewKey();
  const viewChanged=(ui._lastViewKey||'')!==viewKey;
  const _oldViewKey=ui._lastViewKey||''; /* 【fixed15 B5】覆盖前捕获旧视图 key */
  ui._lastViewKey=viewKey;
  const scroll=viewChanged?0:(c.scrollTop??ui._lastScroll??0);
  /* 【fixed14 修复1】离开 outline 视图前保存滚动位置，跨视图切换后恢复 */
  const _wasOutline=_oldViewKey.startsWith('outline');
  if(_wasOutline)deps.setSavedOutlineScroll(c.scrollTop||0);
  const _wasMindmap=_oldViewKey.startsWith('mindmap');
  if(_wasMindmap){const _mm=document.querySelector('.mm-wrap');if(_mm){deps.savedMindmapScroll.x=_mm.scrollLeft||0;deps.savedMindmapScroll.y=_mm.scrollTop||0;}}
  c.innerHTML='';
  deps.setVsActive(null); /* 【L12-W3】重建 #content：解除上一虚拟滚动容器绑定 */
  c.classList.toggle('graph-mode',view==='graph'); /* FIX-R7-3: 图谱视图关闭 #content 顶部 padding */
  document.body.classList.toggle('graph-mode',view==='graph'); /* FIX-DB-09: body 级标记（#content padding 等样式仍依赖）；折叠按钮不再依赖该标记下移 */
  document.body.classList.toggle('mm-mode',view==='mindmap'); /* FIX-R10: 导图视图同理 */
  document.body.classList.toggle('slides-mode',view==='slides'); /* 【UI-P0-5】幻灯片视图标记：内容区留白收敛 + 右栏编辑区切换为幻灯片工具栏 */
  if(view!==VIEW_KIND.CALENDAR)deps.setCalDayNodesForModules(null);
  let el: any;
  switch(view){
    case VIEW_KIND.LIBRARY_ROOT: el=deps.renderFolderGrid(N(state.rootId)); break;
    case VIEW_KIND.FOLDER:       el=deps.renderFolderGrid(curDoc); break;
    case VIEW_KIND.CALENDAR:     el=deps.renderCalendarPage(); break;
    case VIEW_KIND.DATABASE:     el=deps.renderDatabasePage(curDoc); break;
    case VIEW_KIND.OUTLINE:      el=deps.renderOutlinePage(curDoc); break;
    case 'starred':              el=(typeof deps.renderStarredView==='function')?deps.renderStarredView():null; break;
    case 'templates':            el=(typeof deps.renderTemplatesView==='function')?deps.renderTemplatesView():null; break;
    case 'trash':                el=(typeof deps.renderTrashView==='function')?deps.renderTrashView():null; break;
    case 'mindmap':              el=deps.renderMindmap(curDoc); break;
    case 'presentation':         el=deps.renderPresentation(curDoc); break;
    case 'slides':               el=(typeof deps.renderSlidesView==='function')?deps.renderSlidesView(curDoc):null; break;
    case 'graph':                el=deps.renderGraph(); break;
    case 'stats':                el=(typeof deps.renderStatsView==='function')?deps.renderStatsView():null; break;
    case 'tags': {
      const _tagIndexCache=deps.getTagIndexCache();
      el=(ui.tagActive&&_tagIndexCache&&_tagIndexCache.has(ui.tagActive))
        ?((typeof deps.renderTagNodes==='function')?deps.renderTagNodes(ui.tagActive):null)
        :((typeof deps.renderTagsView==='function')?deps.renderTagsView():null);
      break;
    }
    case 'history':              el=(typeof deps.renderHistoryView==='function')?deps.renderHistoryView():null; break;
    default:                     el=deps.renderOutlinePage(curDoc);
  }
  if(el)c.appendChild(el);
  /* FIX-R8-1 / L16-W4 · 指令4: selbar 的 --doc-header-h 改为「挂载后挂 ResizeObserver」订阅标题尺寸，
     变化才刷新（不再每次渲染在 rAF 内读 offsetHeight 触发强制布局；快速切换视图时 rAF 前元素可能已被下一次渲染移除）。 */
  if(view===VIEW_KIND.OUTLINE){deps.observeOutlineHeader(el);requestAnimationFrame(()=>{if(el&&el._vs)deps.vsUpdate(el._vs);});}
  deps.renderSidebar();
  deps.syncTopbar();
  deps.updateRightSidebar();
  deps.updateRemindBadge();
  deps.restoreFocus();
  const fc=$('#floatCal');
  if(fc){
    const _fcv=deps.floatCalVisible();
    fc.hidden=!_fcv;
    if(_fcv){deps.ensureElInViewport(fc);deps.renderFloatCal();}
  }
  requestAnimationFrame(()=>{
    if(!viewChanged)c.scrollTop=scroll;
    /* 【fixed14 修复1】进入 outline 视图时恢复跨视图保存的滚动位置 */
    if(view===VIEW_KIND.OUTLINE&&deps.getSavedOutlineScroll()>0){
      const _sos=deps.getSavedOutlineScroll();
      c.scrollTop=_sos;
      requestAnimationFrame(()=>{c.scrollTop=_sos;});
    }
    if(view==='mindmap'){
      const _mm=document.querySelector('.mm-wrap');
      if(_mm){_mm.scrollLeft=deps.savedMindmapScroll.x;_mm.scrollTop=deps.savedMindmapScroll.y;
        requestAnimationFrame(()=>{_mm.scrollLeft=deps.savedMindmapScroll.x;_mm.scrollTop=deps.savedMindmapScroll.y;});
      }
    }
    if(ui.focusId){
      const _vsActive=deps.getVsActive();
      if(_vsActive)deps.vsScrollToId(_vsActive,ui.focusId); /* D-4/D-6：窗口化下先滚入目标再定位 */
      const focusEl=c.querySelector('.text[data-id="'+CSS.escape(ui.focusId)+'"]')||
                    c.querySelector('[data-id="'+CSS.escape(ui.focusId)+'"][contenteditable]');
      if(focusEl)focusEl.scrollIntoView({block:'nearest',behavior:'auto'});
    }
    ui.focusId=null;
  });
}
