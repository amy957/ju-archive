/**
 * M1-1 · 批次 N · 全局多选状态与渲染（选择模型 · 仅内存 · 不持久化）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html:15511-15593 原文逐行对应
 *   - _mSel / _mSelRaf / _mSelSetOrder / _mSelHas / _sbVisibleIds ....... 15517-15529
 *   - _mSelClear / _mSelSelectAll / _mSelClick .......................... 15530-15553
 *   - _mSelPaint ....................................................... 15554-15568
 *   - _mSelSelectAllCurrent ............................................ 15569-15584
 *   - Ctrl/Cmd+A 全选 / Esc 清除 全局 keydown 监听 ...................... 15585-15593
 *
 * 约束：函数体表达式、注释、正则、DOM 选择器逐字保留；仅追加 export 与 TS 类型注解。
 *   - `ui` 状态与 DOM 选择器按任务书保持原样直用（原代码 `ui.view` 等写法不变）；
 *     `ui` 在本模块导出为跨模块共享单例，由 src/main.ts 以同一引用注入 layout / theme / sidebar。
 *   - 尚未拆分的业务符号（viewOf / getCurrentDoc / outlineVisibleSeq / _outlineSel / forceRender）
 *     收敛到本模块 `deps` 容器 + bindSelectionDeps() 注入口（与批次 K/L 同款约定）。
 */
import { $ } from '../core/utils';
import { VIEW_KIND } from '../core/constants';

/** 全局 UI 状态对象（对应产品的 `ui` 单例）——与 layout / theme / sidebar 共用同一引用 */
export const ui: any = {};

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export const deps: {
  getCurrentDoc: () => any;
  viewOf: (doc: any) => any;
  outlineVisibleSeq: (doc: any) => any[];
  outlineSel: any;
  forceRender: () => void;
} = {
  getCurrentDoc: () => null,
  viewOf: () => null,
  outlineVisibleSeq: () => [],
  outlineSel: {},
  forceRender: () => {},
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function bindSelectionDeps(next: Partial<typeof deps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   【L15-W2】文件 / 输入行：多选与全选（选择模型 · 仅内存 · 不持久化）
   - 状态以 Set（ids）维护，与 DOM 解耦：虚拟滚动 / 重渲染后选择保持
   - 单击单选 · Ctrl/Cmd 切换 · Shift 范围 · Ctrl/Cmd+A 全选 · Esc 清除
   - 全选 / 清除经 rAF 合批刷新可见行标记（不逐行同步渲染）
   ============================================================ */
export type MSelection = { type: string|null; ids: Set<any>; anchorId: string|null; mode: string; order: any[] };
export let _mSel: MSelection = {type:null,ids:new Set(),anchorId:null,mode:'single',order:[]};
export let _mSelRaf: number|null = null;
export function _mSelSetOrder(type: string|null, ids?: any[] | null): void {
  if(_mSel.type!==type){_mSel.type=type;_mSel.ids=new Set();_mSel.anchorId=null;_mSel.mode='single';}
  _mSel.order=(ids||[]).slice();
}
export function _mSelHas(id: any): boolean {return _mSel.ids.has(id);}
/* 【批次1·侧栏多选】侧栏可见行（.sb-row[data-msid]）的 id 顺序数组：Ctrl / Shift 范围选择与全选的基准序列 */
export function _sbVisibleIds(): string[] {
  const box=$('#sidebarLeft');
  if(!box)return [];
  return Array.from(box.querySelectorAll('.sb-row[data-msid]')).map(el=>el.getAttribute('data-msid')).filter(Boolean) as string[];
}
export function _mSelClear(): void {_mSel.ids=new Set();_mSel.anchorId=null;_mSel.mode='single';_mSelPaint();}
export function _mSelSelectAll(type: any, ids?: any[] | null): void {
  _mSel.type=type;_mSel.order=(ids||[]).slice();
  _mSel.ids=new Set(_mSel.order);_mSel.anchorId=_mSel.order[0]||null;_mSel.mode='all';
  _mSelPaint();
}
export function _mSelClick(type: any, id: any, ev?: any, order?: any): void {
  if(_mSel.type!==type){_mSel.type=type;_mSel.ids=new Set();_mSel.anchorId=null;_mSel.mode='single';_mSel.order=[];}
  if(order)_mSel.order=order.slice();
  const ctrl=!!(ev&&(ev.ctrlKey||ev.metaKey)),shift=!!(ev&&ev.shiftKey);
  if(ctrl){
    const s=new Set(_mSel.ids);
    if(s.has(id))s.delete(id);else s.add(id);
    _mSel.ids=s;_mSel.anchorId=id;_mSel.mode='additive';
  }else if(shift&&_mSel.anchorId){
    const seq=_mSel.order.length?_mSel.order:Array.from(_mSel.ids);
    const ai=seq.indexOf(_mSel.anchorId),ti=seq.indexOf(id);
    if(ai>=0&&ti>=0){_mSel.ids=new Set(seq.slice(Math.min(ai,ti),Math.max(ai,ti)+1));_mSel.mode='range';}
    else{_mSel.ids=new Set([id]);_mSel.anchorId=id;_mSel.mode='single';}
  }else{
    _mSel.ids=new Set([id]);_mSel.anchorId=id;_mSel.mode='single';
  }
  _mSelPaint();
}
export function _mSelPaint(): void {
  if(_mSelRaf)return;
  _mSelRaf=requestAnimationFrame(()=>{
    _mSelRaf=null;
    try{
      document.querySelectorAll('[data-msid]').forEach(el=>{
        const msid=el.getAttribute('data-msid');
        /* 【批次1·侧栏多选】侧栏行仅在 sidebar 模式点亮，避免文件 / 数据库多选串色到左栏 */
        const on=el.classList.contains('sb-row')?(_mSel.type==='sidebar'&&_mSel.ids.has(msid)):_mSel.ids.has(msid);
        el.classList.toggle('ju-msel',on);
        if(on)el.setAttribute('aria-selected','true');else el.removeAttribute('aria-selected');
      });
    }catch(e){console.warn('[JU] caught error',e);}
  });
}
export function _mSelSelectAllCurrent(): boolean {
  const view=ui.view==='auto'?(typeof deps.viewOf==='function'?deps.viewOf(deps.getCurrentDoc()):null):ui.view;
  if(view===VIEW_KIND.OUTLINE){
    const doc=deps.getCurrentDoc();if(!doc)return false;
    const seq=deps.outlineVisibleSeq(doc);
    deps.outlineSel.ids=new Set(seq);deps.outlineSel.anchorId=seq[0]||null;deps.outlineSel.docId=doc.id;
    deps.forceRender();return true;
  }
  /* 【批次1·侧栏多选】sidebar 分支：全选当前侧栏可见行（Esc 清除沿用全局 _mSelClear） */
  if(_mSel.type==='sidebar'){const _sb=_sbVisibleIds();if(!_sb.length)return false;_mSelSelectAll('sidebar',_sb);return true;}
  /* 【批次2·回收站多选】trash 分支：全选当前回收站卡片（顺序基准 = renderTrashView 写入的 rootId 序列） */
  if(_mSel.type==='trash'&&_mSel.order.length){_mSelSelectAll('trash',_mSel.order);return true;}
  if(_mSel.type==='files'&&_mSel.order.length){_mSelSelectAll('files',_mSel.order);return true;}
  if(_mSel.type==='db'&&_mSel.order.length){_mSelSelectAll('db',_mSel.order);return true;}
  return false;
}
if(typeof window!=='undefined'&&!window._juMSelKeyBound){
  window._juMSelKeyBound=true;
  document.addEventListener('keydown',function(e){
    const ae=document.activeElement as HTMLElement|null;
    if(ae&&(ae.isContentEditable||ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'||ae.tagName==='SELECT'))return;
    if((e.ctrlKey||e.metaKey)&&(e.key==='a'||e.key==='A')){if(_mSelSelectAllCurrent())e.preventDefault();return;}
    if(e.key==='Escape'&&_mSel.ids.size)_mSelClear();
  });
}
