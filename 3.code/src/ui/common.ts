/**
 * M1-1 · 批次 K · 通用 UI 模块（toast / 模态栈 / 右键菜单 / 浮窗拖拽关闭）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html「通用 UI」区原文逐行对应
 *   - toast / toastTimer ............ 6648-6656
 *   - initDragClose ................. 6720-6747
 *   - showContextMenu ............... 6774-6792
 *   - 外部点击关闭 #ctxMenu 监听 .... 6795
 *   - _modalStack / _syncAppInert ... 6797-6810
 *   - appConfirm .................... 6811-6846
 *   - appPrompt ..................... 6847-6873
 *
 * 约束：函数体表达式、字符串字面量、FIX-* 标记注释逐字保留；仅追加 export 与 TS 类型注解。
 *       原代码使用的 `$` / `esc` 自 ../core/utils 引入；`_win` 按 HTML:1377 原文
 *       `const _win = (window)` 的语义，在本模块内以同值别名承接（运行期指向 window，零行为差异）。
 */
import { $, esc } from '../core/utils';

/* HTML:1377 原文 const _win = (window)（JSDoc @type {JuWindow} 断言）—— 同语义别名 */
const _win: any = window;

/* ============================================================
   通用 UI
   ============================================================ */
let toastTimer: any = null;
export function toast(msg: any): void {
  const t=$('#toast');if(!t)return;
  t.textContent=msg;t.classList.add('on');
  clearTimeout(toastTimer);
  /* 批次4: 停留时长随文本长度自适应（长文本读不完），下限 1800ms */
  const _len=String(msg==null?'':msg).length;
  toastTimer=setTimeout(()=>t.classList.remove('on'),Math.max(1800,800+_len*80));
}
export function initDragClose(el: HTMLElement,onClose?: (() => void) | null): void {
  if(el.dataset.dragInit)return;el.dataset.dragInit='1';
  const cl=document.createElement('button');
  cl.className='pop-close';cl.textContent='✕';cl.title='关闭';
  cl.addEventListener('pointerdown',e=>e.stopPropagation());
  cl.addEventListener('click',e=>{e.stopPropagation();_win._popAnchor=null;if(onClose)onClose();else el.remove();}); /* FIX-L-33: 关闭时清残留锚点 */
  el.appendChild(cl);
  let drag=false,sx=0,sy=0,ox=0,oy=0;
  el.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const t=e.target as HTMLElement;
    if(t.closest('button,input,select,a,.sw,.cp-swatch,.sp-btn,.tp-item,.ctx-item,.pop-close'))return;
    drag=true;sx=e.clientX;sy=e.clientY;
    const r=el.getBoundingClientRect();ox=r.left;oy=r.top;
    el.style.position='fixed';
    el.style.left=ox+'px';el.style.top=oy+'px';
    _win._popAnchor={x:e.clientX,y:e.clientY};
    const move=(ev: PointerEvent)=>{
      if(!drag)return;
      el.style.left=Math.max(0,Math.min(window.innerWidth-90,ox+ev.clientX-sx))+'px';
      el.style.top=Math.max(0,Math.min(window.innerHeight-36,oy+ev.clientY-sy))+'px';
    };
    /* FIX-L-33: 拖动结束清除 _popAnchor 残留，防下一个未传 anchor 的浮窗锚定到上次拖动坐标 */
    const up=()=>{drag=false;_win._popAnchor=null;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);};
    document.addEventListener('pointermove',move);
    document.addEventListener('pointerup',up);
  });
}
export function showContextMenu(items: any[],e: MouseEvent): void {
  const menu=$('#ctxMenu');if(!menu)return;
  menu.innerHTML='';
  items.forEach(it=>{
    if(it.sep){const s=document.createElement('div');s.className='ctx-sep';menu.appendChild(s);return;}
    const d=document.createElement('div');
    d.className='ctx-item'+(it.danger?' danger':'');
    d.innerHTML=`<span class="ic">${it.ic||''}</span><span>${esc(it.txt)}</span>`;
    d.onclick=()=>{menu.classList.remove('on');_win._popAnchor=null;it.fn();}; /* FIX-P1-1: 菜单项执行前清残留锚点 */
    menu.appendChild(d);
  });
  menu.style.left='-9999px';menu.style.top='0px';
  _win._popAnchor={x:e.clientX,y:e.clientY};
  menu.classList.add('on');
  const mw=(menu as HTMLElement).offsetWidth,mh=(menu as HTMLElement).offsetHeight;
  const x=Math.max(4,Math.min(e.clientX,window.innerWidth-mw-4));
  const y=Math.max(4,Math.min(e.clientY,window.innerHeight-mh-4));
  menu.style.left=x+'px';menu.style.top=y+'px';
}
/* 【r89】e.target 可能是 Text 节点（nodeType=3）而无 closest；节点多选不再拦截 .text 内 mousedown 后，
   该事件会冒泡到此处的 document 监听，故先做能力判定再取 closest，避免 Uncaught TypeError 中断后续处理。 */
document.addEventListener('mousedown',e=>{const _t=e.target as HTMLElement;if(!(_t&&_t.closest&&_t.closest('#ctxMenu'))){$('#ctxMenu')?.classList.remove('on');_win._popAnchor=null;} /* FIX-P1-1: 外部点击关闭菜单时同步清锚点 */});
/* FIX-M-23: 模块级模态栈——多模态叠加时一次 ESC/遮罩点击只关闭栈顶一个模态，避免 document 级 keydown 冒泡触发多个 close */
export const _modalStack: HTMLElement[]=[];
/* 批次4: 模态栈 ↔ #app inert 同步——有模态挂载时背景内容退出可聚焦 / 可点树，全部关闭后复位。
   以 isConnected 判定实际挂载态，栈内残留的死引用不会导致 inert 永久粘滞。 */
export function _syncAppInert(): void {
  const app=$('#app');if(!app)return;
  if(_modalStack.some(m=>m&&m.isConnected))app.setAttribute('inert','');else app.removeAttribute('inert');
}
/* 批次4: 任意模态（appConfirm / appPrompt / 设置 / 解锁 / 导入 / 主题…）挂载或卸载后自动同步（微任务级，幂等） */
/* M0-7：观察者持柄提升到模块级，供 pagehide 统一 disconnect（拆分后不再成为跨模块悬挂资源） */
export let _syncAppInertObserver: MutationObserver|null=null;
if(!_syncAppInertObserver){
  _syncAppInertObserver=new MutationObserver(()=>_syncAppInert());
  _syncAppInertObserver.observe(document.body,{childList:true});
}
export function appConfirm(msg: any,onOk?: (() => void) | null,onCancel?: (() => void) | null): void {
  const modal=document.createElement('div');modal.className='modal-overlay';
  modal.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><span>确认</span><button class="modal-close">✕</button></div><div class="modal-body"><div style="padding:8px 0">${esc(msg)}</div></div><div class="modal-footer"><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>确定</button></div></div>`;
  document.body.appendChild(modal);
  _modalStack.push(modal); /* FIX-M-23: 打开即入栈 */
  _syncAppInert(); /* 批次4: 打开即令背景 #app 退出交互树 */
  const isTop=()=>_modalStack[_modalStack.length-1]===modal; /* FIX-M-23: 仅栈顶响应 */
  const popStack=()=>{const i=_modalStack.indexOf(modal);if(i>=0)_modalStack.splice(i,1);_syncAppInert();}; /* FIX-M-23: 关闭即出栈；批次4: 同步解除 inert */
  /* FIX-M-28: 模态内可聚焦元素列表（a[href]/button/input/select/textarea/[tabindex]） */
  const focusables=()=>Array.from(modal.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(el=>!(el as any).disabled);
  const onKey=(e: KeyboardEvent)=>{
    if(!isTop())return; /* FIX-M-23: 非栈顶模态忽略 document 级按键 */
    if(e.key==='Escape')close();
    else if(e.key==='Enter'){
      /* FIX-P0-1: preventDefault 阻止 Enter 的默认激活行为——否则浏览器会在 keydown 后向
         当前聚焦元素（初始聚焦的 .modal-close）派发 click，触发 close()→onCancel()，
         造成「确定+取消」双触发（如恢复版本/删除文件同时执行两分支） */
      e.preventDefault();
      cleanup();modal.remove();popStack();onOk&&onOk();
    }
    else if(e.key==='Tab'){ /* FIX-M-28: Tab/Shift+Tab 在栈顶模态内可聚焦元素间循环 */
      const f=focusables();if(!f.length)return;
      const first=f[0],last=f[f.length-1];
      if(e.shiftKey){if(document.activeElement===first||!modal.contains(document.activeElement)){e.preventDefault();last.focus();}}
      else{if(document.activeElement===last||!modal.contains(document.activeElement)){e.preventDefault();first.focus();}}
    }
  };
  const cleanup=()=>document.removeEventListener('keydown',onKey);
  const close=()=>{cleanup();modal.remove();popStack();if(onCancel)onCancel();};
  (modal.querySelector('.modal-close') as HTMLElement).onclick=close;
  (modal.querySelector('[data-cancel]') as HTMLElement).onclick=close;
  (modal.querySelector('[data-ok]') as HTMLElement).onclick=()=>{cleanup();modal.remove();popStack();onOk&&onOk();};
  modal.onclick=e=>{if(e.target===modal&&isTop())close();}; /* FIX-M-23: 遮罩点击仅作用于栈顶 */
  document.addEventListener('keydown',onKey);
  focusables()[0]?.focus(); /* FIX-M-28: 打开时初始聚焦首个可聚焦元素 */
}
export function appPrompt(msg: any,defaultVal: any,onOk?: ((v: string|null) => void) | null): void {
  const modal=document.createElement('div');modal.className='modal-overlay';
  modal.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><span>输入</span><button class="modal-close">✕</button></div><div class="modal-body"><div style="margin-bottom:6px">${esc(msg)}</div><input type="text" style="width:100%;padding:7px 10px;border:1px solid var(--line-soft);border-radius:6px;background:var(--bg-mid);outline:none"></div><div class="modal-footer"><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>确定</button></div></div>`;
  document.body.appendChild(modal);
  _modalStack.push(modal); /* FIX-M-23: 打开即入栈 */
  _syncAppInert();
  const isTop=()=>_modalStack[_modalStack.length-1]===modal; /* FIX-M-23: 仅栈顶响应 */
  const inp=modal.querySelector('input') as HTMLInputElement;
  inp.value=defaultVal||'';inp.focus();inp.select();
  /* FIX-M-28: 模态内可聚焦元素列表 + Tab 循环 trap（初始聚焦沿用 input，保持单模态行为不变） */
  const focusables=()=>Array.from(modal.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(el=>!(el as any).disabled);
  const onKey=(e: KeyboardEvent)=>{
    if(!isTop())return;
    if(e.key!=='Tab')return;
    const f=focusables();if(!f.length)return;
    const first=f[0],last=f[f.length-1];
    if(e.shiftKey){if(document.activeElement===first||!modal.contains(document.activeElement)){e.preventDefault();last.focus();}}
    else{if(document.activeElement===last||!modal.contains(document.activeElement)){e.preventDefault();first.focus();}}
  };
  document.addEventListener('keydown',onKey);
  const close=(v: string|null)=>{document.removeEventListener('keydown',onKey);modal.remove();const i=_modalStack.indexOf(modal);if(i>=0)_modalStack.splice(i,1);onOk&&onOk(v);}; /* FIX-M-23: 关闭即出栈；FIX-M-28: 关闭移除 Tab trap 监听 */
  (modal.querySelector('.modal-close') as HTMLElement).onclick=()=>close(null);
  (modal.querySelector('[data-cancel]') as HTMLElement).onclick=()=>close(null);
  (modal.querySelector('[data-ok]') as HTMLElement).onclick=()=>close(inp.value);
  modal.onclick=e=>{if(e.target===modal&&isTop())close(null);}; /* FIX-M-23: 遮罩点击仅作用于栈顶 */
  inp.onkeydown=e=>{if(!isTop())return;/* FIX-M-23: 非栈顶忽略 input 级 ESC/Enter */if(e.key==='Enter')close(inp.value);else if(e.key==='Escape')close(null);};
}

/* ============================================================
   【D-07 / D-09 · 按钮与右键菜单健壮性】统一绑定工具
   ------------------------------------------------------------
   背景（v2.1-缺陷对比报告 D-07 / D-09）：用户反馈「浮窗按钮 / 右键菜单 / 操作按钮点了没反应」，
   本机自动化实测均不复现 ⇒ 判定为**环境差异**（旧内核无 PointerEvent / 125% 缩放 /
   属性赋值被后续 DOM 重渲染覆盖）。本组工具把「怎么绑」收敛成三种：
     1) `bindClick`               —— `addEventListener('click')`，重复绑定=替换上一次（不再被
        `el.onclick = fn` 的属性覆盖语义影响）；
     2) `bindPressFallback`       —— 浮窗类按钮的按压兜底：宿主有 PointerEvent 时监听 pointerdown，
        否则降级 mousedown；**只有 350ms 内没有收到 click 才补执行**（现代内核零双触发）；
     3) `bindDelegatedContextMenu` —— 右键菜单绑在**容器**上做事件委托，
        目标元素被重渲染替换后依然生效（不再只绑单个节点）。
   ============================================================ */

/** 单元素当前登记的 click 处理器（重复 bindClick 时用于精确摘除，避免重复执行）。 */
const _clickBindings = new WeakMap<Element, EventListener>();

/**
 * 统一 click 绑定（addEventListener 语义 + 可重复调用）。
 * @param el 目标元素（null/undefined 直接返回 false，调用点无需判空）
 * @param fn click 处理器
 * @param opts.pressFallback 是否同时挂按压兜底（浮窗类按钮用）
 * @returns 是否绑定成功
 */
export function bindClick(
  el: Element | null | undefined,
  fn: (e: Event) => void,
  opts?: { pressFallback?: boolean },
): boolean {
  if (!el) return false;
  const prev = _clickBindings.get(el);
  if (prev) el.removeEventListener('click', prev);
  const handler: EventListener = (e: Event) => { fn(e); };
  el.addEventListener('click', handler);
  _clickBindings.set(el, handler);
  if (opts && opts.pressFallback) bindPressFallback(el, fn);
  return true;
}

/**
 * 按压兜底（仅补「click 没派发」的环境，绝不会与正常 click 双触发）。
 *
 * 实现：记录最近一次 click 时刻；按下后延迟 350ms 判定 ——
 *   · 350ms 内已有 click ⇒ 说明宿主链路正常，直接放弃兜底；
 *   · 仍无 click ⇒ 判定宿主未派发 click（旧内核 / 事件被拦截 / 元素被遮挡后重渲染），补一次执行。
 * 监听类型：宿主支持 PointerEvent 时用 `pointerdown`，否则降级 `mousedown`（老 WebView 兼容）。
 */
export function bindPressFallback(el: Element | null | undefined, fn: (e: Event) => void): boolean {
  if (!el) return false;
  const flagged = el as any;
  if (flagged.__juPressFallback) return true;
  flagged.__juPressFallback = true;
  const hasPointer = typeof window !== 'undefined' && typeof (window as any).PointerEvent === 'function';
  let lastClick = 0;
  /* 捕获阶段记录 click：即使业务处理器 stopPropagation 也不影响兜底判定 */
  el.addEventListener('click', () => { lastClick = Date.now(); }, true);
  el.addEventListener(hasPointer ? 'pointerdown' : 'mousedown', () => {
    setTimeout(() => {
      if (Date.now() - lastClick <= 400) return;
      lastClick = Date.now();
      try { fn(new Event('ju-press-fallback')); } catch (e) { console.warn('[JU] press fallback failed', e); }
    }, 350);
  }, true);
  return true;
}

/**
 * 容器级右键菜单委托（幂等：同一容器只装一次监听）。
 *
 * @param root     委托根（通常是文档容器 / 侧栏容器）
 * @param selector 命中选择器（如 `'.doc-header-title'`、`'.sb-row[data-id]'`）
 * @param handler  命中后的业务处理（已 preventDefault，可直接 showContextMenu）
 */
export function bindDelegatedContextMenu(
  root: Element | Document | null | undefined,
  selector: string,
  handler: (target: HTMLElement, e: MouseEvent) => void,
): boolean {
  if (!root) return false;
  const flagged = root as any;
  if (flagged.__juCtxDelegated) return true;
  flagged.__juCtxDelegated = true;
  (root as any).addEventListener('contextmenu', (e: MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t || typeof t.closest !== 'function') return;
    const hit = t.closest(selector) as HTMLElement | null;
    if (!hit) return;
    e.preventDefault();
    try { handler(hit, e); } catch (err) { console.warn('[JU] delegated contextmenu failed', err); }
  });
  return true;
}
