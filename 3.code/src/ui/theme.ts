/**
 * M1-1 · 批次 K · 主题模块（应用 / 跟随系统 / 切换 / 主题选择面板）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - applyTheme .......... 6160-6170
 *   - applySystemTheme .... 6171-6181
 *   - toggleTheme ......... 6182-6187
 *   - openThemeSelector ... 6189-6282
 *
 * 约束：函数体表达式、SVG 字符串、内联样式字面量与 FIX/批次注释逐字保留；仅追加 export 与类型注解。
 *   - `ui.theme` / `ui.themePreview` 与 `saveUI()` / `forceRender()` 均属尚未拆分的业务入口，
 *     按批次 L 同款「依赖注入」约定收敛到本模块 `deps` 容器（原代码直接调用改为 deps.xxx）。
 *   - `_modalStack` / `_syncAppInert` 自 ./common 引入；`toast` 自 ./common 引入；`$` 自 ../core/utils 引入。
 */
import { $ } from '../core/utils';
import { _modalStack, _syncAppInert, toast } from './common';

/**
 * 依赖注入容器（占位实现在 src/main.ts 初始化时注入，防止运行时报错）。
 * 对应未拆分业务符号：ui（ui.theme / ui.themePreview）、saveUI()、forceRender()。
 */
export const deps: {
  ui: any;
  saveUI: () => void;
  forceRender: () => void;
} = {
  ui: {},
  saveUI: () => {},
  forceRender: () => {},
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function bindThemeDeps(next: Partial<typeof deps>): void {
  Object.assign(deps, next);
}

export function applyTheme(theme: string): void {
  document.documentElement.dataset.theme=theme;
  deps.ui.theme=theme; /* 【批次3】主题选择面板以 ui.theme 作为「已应用主题」唯一记录点 */
  const btn=$('#btnTheme');
  if(btn){
    const svg=btn.querySelector('svg');
    if(svg){
      const tee='<path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>';
      svg.innerHTML=theme==='night'?tee+'<circle cx="12" cy="18" r="1"/>':tee;
    }
  }
}
export function applySystemTheme(): void {
  try{
    if(localStorage.getItem('juju.theme.manual')==='1')return;
    var mq=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)');
    if(!mq)return;
    var sys=mq.matches?'night':'day';
    if(document.documentElement.dataset.theme!==sys){
      document.documentElement.dataset.theme=sys;
    }
  }catch(e){console.warn('[JU] caught error',e);}
}
export function toggleTheme(): void {
  const cur=document.documentElement.dataset.theme||'day';
  const next=cur==='day'?'night':'day';
  applyTheme(next);try{localStorage.setItem('juju.theme.manual','1');}catch(e){console.warn('[JU] theme persist skipped',e);}deps.saveUI();deps.forceRender();
  toast('主题：'+(next==='day'?'日间护眼':'夜间护眼'));
}
/* 【批次3】主题选择面板：日间 / 夜间缩略图卡片，点击实时预览，确认后 applyTheme + saveUI 落盘 */
export function openThemeSelector(): void {
  const cur=(document.documentElement.dataset.theme==='night')?'night':'day';
  deps.ui.theme=cur;
  deps.ui.themePreview=cur;
  const modal=document.createElement('div');
  modal.className='modal-overlay';
  const wrap=document.createElement('div');
  wrap.className='modal';
  wrap.setAttribute('role','dialog');
  wrap.setAttribute('aria-modal','true');
  wrap.style.maxWidth='520px';
  wrap.innerHTML='<div class="modal-head"><span>主题切换</span><button class="modal-close">✕</button></div><div class="modal-body"></div>';
  modal.appendChild(wrap);
  const body=wrap.querySelector('.modal-body') as HTMLElement;
  const grid=document.createElement('div');
  grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px';
  const cards: Record<string,HTMLElement>={};
  ([['day','日间'],['night','夜间']] as [string,string][]).forEach(([k,t])=>{
    const card=document.createElement('button');
    card.type='button';
    card.dataset.themeCard=k;
    card.style.cssText='display:flex;flex-direction:column;gap:8px;padding:8px;border:2px solid var(--line-soft);border-radius:var(--radius-lg);background:var(--bg-panel);cursor:pointer;text-align:left;font:inherit;color:var(--fg)';
    const isNight=k==='night';
    const thumb=document.createElement('div');
    thumb.style.cssText='height:86px;border-radius:var(--radius-sm);border:1px solid '+(isNight?'#3a3128':'#e3d9c8')+';background:'+(isNight?'#1f1a16':'#faf6ee')+';display:flex;flex-direction:column;gap:5px;padding:8px;box-sizing:border-box;overflow:hidden';
    const b1=document.createElement('div');
    b1.style.cssText='height:8px;border-radius:4px;width:70%;background:'+(isNight?'#8f7a5f':'#d8c8a8');
    const b2=document.createElement('div');
    b2.style.cssText='height:6px;border-radius:3px;width:92%;background:'+(isNight?'#4b4038':'#e7ddcc');
    const b3=document.createElement('div');
    b3.style.cssText='height:6px;border-radius:3px;width:80%;background:'+(isNight?'#4b4038':'#e7ddcc');
    const b4=document.createElement('div');
    b4.style.cssText='margin-top:auto;height:10px;width:34px;border-radius:5px;background:'+(isNight?'#c9a86a':'#b98a4a');
    thumb.appendChild(b1);thumb.appendChild(b2);thumb.appendChild(b3);thumb.appendChild(b4);
    const label=document.createElement('div');
    label.textContent=t;
    label.style.cssText='font-size:.86em;font-weight:600';
    card.appendChild(thumb);
    card.appendChild(label);
    card.onclick=()=>{
      deps.ui.themePreview=k;
      document.documentElement.dataset.theme=k; /* 实时预览：仅改 dataset，不落盘 */
      syncThemeCards();
    };
    cards[k]=card;
    grid.appendChild(card);
  });
  function syncThemeCards(){
    Object.keys(cards).forEach(k=>{
      const on=deps.ui.themePreview===k;
      cards[k].style.borderColor=on?'var(--accent)':'var(--line-soft)';
      cards[k].setAttribute('aria-pressed',on?'true':'false');
    });
  }
  syncThemeCards();
  body.appendChild(grid);
  const foot=document.createElement('div');
  foot.style.cssText='display:flex;justify-content:flex-end;gap:8px;margin-top:14px';
  const btnCancel=document.createElement('button');
  btnCancel.className='btn';
  btnCancel.textContent='取消';
  const btnOk=document.createElement('button');
  btnOk.className='btn primary';
  btnOk.textContent='确认应用';
  foot.appendChild(btnCancel);foot.appendChild(btnOk);
  body.appendChild(foot);
  document.body.appendChild(modal);
  _modalStack.push(modal);
  _syncAppInert();
  const _isTopTheme=()=>_modalStack[_modalStack.length-1]===modal;
  const _popTheme=()=>{const i=_modalStack.indexOf(modal);if(i>=0)_modalStack.splice(i,1);};
  const close=()=>{document.removeEventListener('keydown',onThemeKey);modal.remove();_popTheme();};
  const cancel=()=>{
    const prev=(deps.ui.theme==='night')?'night':'day';
    deps.ui.themePreview=null;
    applyTheme(prev); /* 取消：回滚到打开前的已应用主题 */
    close();
  };
  const onThemeKey=(e: KeyboardEvent)=>{if(!_isTopTheme())return;if(e.key==='Escape')cancel();};
  document.addEventListener('keydown',onThemeKey);
  (wrap.querySelector('.modal-close') as HTMLElement).onclick=cancel;
  btnCancel.onclick=cancel;
  btnOk.onclick=()=>{
    const t=(deps.ui.themePreview==='night')?'night':'day';
    deps.ui.themePreview=null;
    applyTheme(t);
    try{localStorage.setItem('juju.theme.manual','1');}catch(e){console.warn('[JU] theme persist skipped',e);}
    deps.saveUI();
    deps.forceRender();
    close();
    toast('主题：'+(t==='day'?'日间护眼':'夜间护眼'));
  };
  modal.onclick=e=>{if(e.target===modal&&_isTopTheme())cancel();};
}
