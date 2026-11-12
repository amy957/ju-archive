/**
 * M1-1 · 批次 Q · 焦点 / 选区管理模块
 *
 * 来源：6.P0-T3基线\v2.0-t3.html「焦点 / 选区管理」区（6458-6645）
 *   - savedFocus / _blurSuppressCount ............................ 6461-6462
 *   - withSuppressedBlur / isBlurSuppressed ..................... 6463-6467
 *   - getTextOffset ............................................. 6468-6477
 *   - nodePath / rangeFromPath / rangeFromTextOffset ............ 6481-6537
 *   - editorRole / editorSelector / isEditable .................. 6538-6560
 *   - saveFocus / restoreFocus .................................. 6561-6598
 *   - focusNode / focusAfterRender / focusTextAfterRender ....... 6599-6645
 * 另从「大纲」与「富文本」区提取以下纯 DOM 工具（无业务依赖）：
 *   - syncEmptyState ............................................ 8852-8857
 *   - cleanupEmptyInline / collectRangeIntersectElements /
 *     unwrapStylelessSpans ...................................... 17292-17329
 *
 * 约束：函数体表达式、DOM 选择器、FIX-* 注释逐字保留；仅作两类纯类型层调整：
 *   1) 追加 `export` 与 TS 输入输出类型注解（Node / Range / Element 显式化）。
 *   2) 未拆分到本模块的跨模块符号（`ui` / 虚拟滚动 `_vsActive`、`_vsScrollToId`）
 *      统一走 `deps` 依赖注入容器（原 `ui.focusId` → `deps.ui.focusId`）。
 *   注：`$` / `$$` 自 ../core/utils 引入；`CSS.escape` 保留原生调用。
 */
import { $$ } from '../core/utils';

/** 可编辑角色：文档大标题 / 正文节点 */
export type FocusRole = 'header' | 'node';

/** 焦点快照（FIX-CURSOR-1：childIndex 路径 + nodeOffset，兼容旧 text-offset 回退） */
export interface SavedFocus {
  id: string;
  role: FocusRole;
  start: number;
  end: number;
  collapsed: boolean;
  sp: number[];
  eo: number;
  ep: number[] | null;
  ee: number;
}

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export const deps: {
  /** 全局 UI 状态对象（对应产品的 `ui`） */
  ui: any;
  /** 读取当前虚拟滚动活动句柄（对应产品的 `_vsActive`） */
  getVsActive: () => any;
  /** 虚拟滚动命中项先滚入视口（对应产品的 `_vsScrollToId`） */
  vsScrollToId: (vs: any, id: any) => void;
} = {
  ui: {},
  getVsActive: () => null,
  vsScrollToId: () => {},
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function bindFocusDeps(next: Partial<typeof deps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   焦点 / 选区管理
   ============================================================ */
let savedFocus: SavedFocus | null = null;
let _blurSuppressCount = 0;

/** 读取当前焦点快照（只读观测口；写入口为 saveFocus / restoreFocus / resetSavedFocus）。 */
export function getSavedFocus(): SavedFocus | null {
  return savedFocus;
}

/** 清空焦点快照（对应产品 bindOutlineText 内的 `savedFocus=null`）。 */
export function resetSavedFocus(): void {
  savedFocus = null;
}

export function withSuppressedBlur(fn: () => void): void {
  _blurSuppressCount++;
  try{fn();}finally{_blurSuppressCount--;}
}

export function isBlurSuppressed(): boolean {
  return _blurSuppressCount > 0;
}

export function getTextOffset(root: Node, container: Node, offset: number): number {
  if(!root.contains(container))return 0;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let count=0,cur:Node|null;
  while((cur=walker.nextNode())){
    if(cur===container)return count+Math.min(offset,cur.nodeValue!.length);
    count+=cur.nodeValue!.length;
  }
  return count;
}

/* FIX-CURSOR-1: <br> 感知的光标锚点——getTextOffset/rangeFromTextOffset 只用 SHOW_TEXT walker，
   <br> 不产生 text 节点，多行内容 blur 保存/restore 时光标跳到错误行。
   改用「childIndex[] 路径 + nodeOffset」精确记录 DOM 位置（<br> 是元素，路径天然包含它）。 */
export function nodePath(root: Node, node: Node): number[] {
  const path: number[]=[];
  let cur: Node|null=node;
  while(cur&&cur!==root&&cur.parentNode){
    const parent: Node=cur.parentNode;
    let idx=-1;
    for(let i=0;i<parent.childNodes.length;i++){if(parent.childNodes[i]===cur){idx=i;break;}}
    if(idx<0)break;
    path.unshift(idx);
    cur=parent;
  }
  return path;
}

export function rangeFromPath(root: Node, path: number[], offset: number): Range | null {
  if(!Array.isArray(path)||!path.length)return null;
  let node: Node=root;
  for(const idx of path){
    if(!node.childNodes||idx<0||idx>=node.childNodes.length)return null;
    node=node.childNodes[idx];
  }
  const r=document.createRange();
  if(node.nodeType===Node.TEXT_NODE){
    r.setStart(node,Math.max(0,Math.min(offset,node.nodeValue!.length)));
  }else{
    /* 元素节点（如 <br> 之后的位置）：nodeOffset 即 childNodes 索引 */
    const ci=Math.max(0,Math.min(offset,node.childNodes.length));
    /* FIX-PATH-1: 若该子索引处是文本节点，直接落进文本开头——DOM 内容结构变化
       （同层 <span>→<b>、包裹层级调整）后光标仍贴近原视觉行/位置；
       <br> 等无文本子节点保持元素定位（P1-1 锚点语义不变）。 */
    if(ci<node.childNodes.length&&node.childNodes[ci].nodeType===Node.TEXT_NODE){
      r.setStart(node.childNodes[ci],0);
    }else{
      r.setStart(node,ci);
    }
  }
  r.collapse(true);
  return r;
}

export function rangeFromTextOffset(root: Node, offset: number): Range {
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let remaining=Math.max(0,offset),cur:Node|null,last:Node|null=null;
  while((cur=walker.nextNode())){
    if(remaining<=cur.nodeValue!.length){
      const r=document.createRange();
      r.setStart(cur,remaining);
      r.collapse(true);
      return r;
    }
    remaining-=cur.nodeValue!.length;
    last=cur;
  }
  const r=document.createRange();
  if(last)r.setStart(last,(last as Text).nodeValue!.length);
  else r.selectNodeContents(root);
  r.collapse(true);
  return r;
}

export function editorRole(el: Element | null): FocusRole | null {
  if(!el||!el.classList)return null;
  if(el.classList.contains('doc-header-title'))return 'header';
  if(el.classList.contains('text'))return 'node';
  return null;
}

export function editorSelector(id: string, role: FocusRole | null): string {
  const safe=CSS.escape(id);
  switch(role){
    case 'header':return `.doc-header-title[data-id="${safe}"]`;
    default:return `#content .text[data-id="${safe}"]`;
  }
}

export function isEditable(el: any): boolean {
  if(!el)return false;
  if(el.isContentEditable)return true;
  const tag=el.tagName;
  if(tag==='TEXTAREA')return true;
  if(tag==='INPUT'){
    return !['checkbox','radio','button','submit','range','file','color','image','date','time'].includes(el.type);
  }
  return false;
}

export function saveFocus(): void {
  const el=document.activeElement as HTMLElement|null;
  if(!el||!isEditable(el)||!el.dataset||!el.dataset.id){savedFocus=null;return;}
  const role=editorRole(el);
  if(!role){savedFocus=null;return;}
  const sel=window.getSelection();
  if(!sel||!sel.rangeCount){savedFocus=null;return;}
  const r=sel.getRangeAt(0);
  if(!el.contains(r.startContainer)){savedFocus=null;return;}
  /* FIX-CURSOR-1: 保存 DOM 路径锚点（start/end 各自的 childIndex 路径 + nodeOffset）。
     保留旧 text-offset 字段做兼容回退。 */
  const start=getTextOffset(el,r.startContainer,r.startOffset);
  const end=r.collapsed?start:getTextOffset(el,r.endContainer,r.endOffset);
  savedFocus={id:el.dataset.id!,role,start,end,collapsed:r.collapsed,
    sp:nodePath(el,r.startContainer),eo:r.startOffset,
    ep:r.collapsed?null:nodePath(el,r.endContainer),ee:r.endOffset};
}

export function restoreFocus(): void {
  if(!savedFocus)return;
  const{id,role,start,end,collapsed,sp,eo,ep,ee}=savedFocus;
  savedFocus=null;
  const el=document.querySelector(editorSelector(id,role)) as HTMLElement|null;
  if(!el)return;
  el.focus({preventScroll:true});
  try{
    const sel=window.getSelection();
    /* FIX-CURSOR-1: 优先 DOM 路径恢复（<br> 感知）；无路径（旧保存数据）回退 text-offset */
    let r=sp?rangeFromPath(el,sp,eo):null;
    if(!r)r=rangeFromTextOffset(el,start);
    if(!collapsed&&end>start){
      let rEnd=ep?rangeFromPath(el,ep,ee):null;
      if(!rEnd)rEnd=rangeFromTextOffset(el,end);
      r.setEnd(rEnd.startContainer,rEnd.startOffset);
    }
    sel!.removeAllRanges();
    sel!.addRange(r);
  }catch(e){console.warn('[JU] caught error',e);}
}

export function focusNode(id: string, offset?: number | null, toEnd?: boolean): void {
  const _vs=deps.getVsActive();if(_vs)deps.vsScrollToId(_vs,id); /* D-4/D-6：窗口化下先滚入目标再定位 */
  const el=(document.querySelector('#content .text[data-id="'+CSS.escape(id)+'"]')||
           document.querySelector('[data-id="'+CSS.escape(id)+'"][contenteditable]')) as HTMLElement|null;
  if(!el){deps.ui.focusId=id;return;}
  el.focus({preventScroll:true});
  try{
    const sel=window.getSelection();
    let r:Range;
    if(offset!=null)r=rangeFromTextOffset(el,offset);
    else{
      r=document.createRange();
      r.selectNodeContents(el);
      r.collapse(!toEnd);
    }
    sel!.removeAllRanges();
    sel!.addRange(r);
  }catch(e){console.warn('[JU] caught error',e);}
  deps.ui.focusId=id;
  $$('.row.sel,.cal-row.sel').forEach(r=>r.classList.remove('sel'));
  const row=el.closest('.row,.cal-row');if(row)row.classList.add('sel');
  const box=el.closest('.node,.cal-node');if(box)box.scrollIntoView({block:'nearest',behavior:'smooth'});
}

export function focusAfterRender(
  id: string,
  containerSel?: string | null,
  {toEnd=true,offset=null}: {toEnd?: boolean; offset?: number | null} = {},
): void {
  requestAnimationFrame(()=>{
    const _vs=deps.getVsActive();if(_vs)deps.vsScrollToId(_vs,id); /* D-4/D-6：窗口化下先滚入目标再定位 */
    const root=containerSel?document.querySelector(containerSel):document.querySelector('#content');
    if(!root)return;
    const el=(root.querySelector('.text[data-id="'+CSS.escape(id)+'"]')||
             root.querySelector('[data-id="'+CSS.escape(id)+'"][contenteditable]')) as HTMLElement|null;
    if(!el)return;
    el.focus({preventScroll:true});
    try{
      const sel=window.getSelection();
      let r:Range;
      if(offset!=null)r=rangeFromTextOffset(el,offset);
      else{
        r=document.createRange();
        r.selectNodeContents(el);
        r.collapse(!toEnd);
      }
      sel!.removeAllRanges();
      sel!.addRange(r);
    }catch(e){console.warn('[JU] caught error',e);}
  });
}

export function focusTextAfterRender(id: string): void {
  focusAfterRender(id);
}

/* FIX-P2-4: data-empty 占位符状态统一维护——bindOutlineText/renderCalNode/renderDocHeaderInline/bindNoteText
   原四处分散判定收敛于此：空内容置 data-empty="1"（配合 [data-empty="1"]::before 显示 data-ph 占位），非空删除。 */
export function syncEmptyState(el: HTMLElement, ph?: string): void {
  if(ph!==undefined&&el.dataset.ph===undefined)el.dataset.ph=ph;
  /* R27 图片导入：内联 <img> 的行 textContent 为空但并非空行，不得显示空占位（否则占位文字压在图片上） */
  if(!el.textContent&&!el.querySelector('img'))el.dataset.empty='1';
  else delete el.dataset.empty;
}

/* 清理操作残留的空内联元素（如 extractContents 拆分边界留下的 <span style=...></span>） */
/* 批次 AH：`EMPTY_INLINE_TAGS` 追加 export —— ui/editors 的批量格式化管线复用同一集合引用（单一来源） */
export const EMPTY_INLINE_TAGS=new Set(['SPAN','FONT','B','I','U','S','EM','STRONG','MARK','DEL','INS','SMALL','SUB','SUP']);
export function cleanupEmptyInline(root: any): void {
  if(!root)return;
  const dead: any[]=[];
  (function walk(n: any){
    Array.from(n.children||[]).forEach((ch: any)=>{
      if(EMPTY_INLINE_TAGS.has(ch.tagName)&&ch.children.length===0&&!ch.textContent)dead.push(ch);
      else walk(ch);
    });
  })(root);
  dead.forEach(n=>{try{n.remove();}catch(e){console.warn('[JU] caught error',e);}});
}

/* 从 contenteditable 根向下遍历，收集所有与选区相交的元素（含选区祖先 span）；
   解决“字号加在选区祖先层级、commonAncestorContainer 子树遍历不到”的问题 */
export function collectRangeIntersectElements(host: any, range: Range): Element[] {
  const out: Element[]=[];
  (function walk(n: any){
    if(n.nodeType!==1)return;
    if(range.intersectsNode(n))out.push(n);
    Array.from(n.children||[]).forEach(walk);
  })(host);
  return out;
}

/* 展开“样式属性为空”的 span（含带子节点的）；与 cleanupEmptyInline（只清理完全空的内联元素）互补 */
export function unwrapStylelessSpans(host: any): void {
  const spans: any[]=[];
  (function walk(n: any){
    Array.from(n.children||[]).forEach((ch: any)=>{
      if(ch.tagName==='SPAN'&&!(ch.getAttribute('style')||'').trim())spans.push(ch);
      walk(ch);
    });
  })(host);
  spans.forEach(el=>{
    const p=el.parentNode;if(!p)return;
    while(el.firstChild)p.insertBefore(el.firstChild,el);
    p.removeChild(el);
  });
}
