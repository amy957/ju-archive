/**
 * M1-1 · 批次 S · 日历时间选择器模块（自定义下拉 + 设置时间浮窗 + 时间换算工具）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - mkCalSel .................................................. 6877-6948
 *   - openCalTimeModal ......................................... 6949-7064
 *   - fmtHm .................................................... 10990-10998
 *   - snapHalfMins / calMinToHm / clampM ....................... 11003-11013
 *   - fmtCalTime ............................................... 11119-11124
 *
 * 约束：DOM 结构串、类名、键盘 / 焦点交互顺序、提示文案与 FIX 注释逐字保留。
 *   未拆分业务符号统一走 `deps` 依赖注入容器（state / commit / nowSeq / forceRender /
 *   getCalendarRootId），由 src/main.ts 装配；`toast` / `_modalStack` / `_syncAppInert`
 *   直接自 ../ui/common 引入（批次 K 已提取）。
 */
import { pad, esc } from '../core/utils';
import { toast, _modalStack, _syncAppInert } from './common';

/** 时间选择器依赖容器。 */
export interface TimepickerDeps {
  /** 全局数据状态（对应产品的 `state`） */
  state: any;
  /** 不可变提交（对应产品的 `commit`） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** 逻辑序号时钟（对应产品的 `_nowSeq`） */
  nowSeq: () => any;
  /** 请求下一次渲染 */
  forceRender: () => void;
  /** 日历根 id 解析（对应产品的 `getCalendarRootId`，批次 S 起由 views/calendar 提供） */
  getCalendarRootId: () => any;
}

/** 依赖注入容器（装配入口；占位实现见 src/main.ts）。 */
export const deps: TimepickerDeps = {
  state: { nodes: {}, rootId: null },
  commit: () => undefined,
  nowSeq: () => 0,
  forceRender: () => undefined,
  getCalendarRootId: () => null,
};

/** 覆写依赖（main.ts 装配时调用）。 */
export function bindTimepickerDeps(patch: Partial<TimepickerDeps>): void {
  Object.assign(deps, patch);
}

/** 自定义下拉条目：[value,label]。 */
export type CalSelEntry = [any, string];

/** mkCalSel 返回的可编程下拉元素（root._val()/_set(v)/_disable(bool)）。 */
export interface CalSelEl extends HTMLDivElement {
  _val: () => any;
  _set: (v: any) => void;
  _disable: (d: any) => void;
  _cleanups?: Array<() => void>;
  _dispose?: () => void;
}

/* 设置时间浮窗（参考「新增/编辑倒数日」弹窗样式）：时间 + 重复方式 + 重复结束日期（留空=无限制）。
   重复字段与既有 recur 结构一致 {freq,interval,weekday?}；重复结束日期存 n.recurEnd（YYYY-MM-DD）。 */
/* 自定义时间选择下拉：选项行距可控制（原生 select 下拉高度不可控，24 小时项会被截断）。
   entries=[[value,label],...]；root._val()/_set(v)/_disable(bool)；键盘 ↑↓ 选择、Enter/Space 确认、Esc 关闭；失焦或点击外部自动收起。 */
export function mkCalSel(entries: CalSelEntry[], val: any, host?: HTMLElement | null): CalSelEl {
  const root = document.createElement('div') as CalSelEl;
  root.className = 'cal-sel';root.tabIndex = 0;root.setAttribute('role', 'listbox');root.setAttribute('aria-label', '时间选择');
  const cur = document.createElement('span');cur.className = 'cal-sel-val';
  const arrow = document.createElement('span');arrow.className = 'cal-sel-arrow';arrow.textContent = '▾';
  root.appendChild(cur);root.appendChild(arrow);
  let panel: HTMLUListElement | null = null;
  function renderVal(){
    const it = entries.find(e => e[0] === val);
    cur.textContent = it ? it[1] : '';
  }
  function close(){ if(panel){panel.remove();panel = null;root.classList.remove('open');} }
  /* FIX-LEAK-1: document focusin 监听器随实例登记并回收——原实现每次 mkCalSel 都永久挂一个
     document 级监听，openCalTimeModal 每次开弹窗创建 4 个实例 = 每次泄漏 4 个监听器。
     FIX-CLEANUP-2（P2-1）：与 closePicker 的 _cleanups 数组风格统一——不再单独用 _dispose，
     所有回收函数（focusin 移除 + blur 定时器清理）统一 push 进 root._cleanups，
     由所属弹窗关闭时统一 drain（兼容 closePicker 的既有回收协议）。 */
  const onFocusin = (e: FocusEvent) => { if(panel && !root.contains(e.target as Node) && !panel.contains(e.target as Node))close(); };
  document.addEventListener('focusin', onFocusin);
  let _blurTimer: any = null; /* FIX-CLEANUP-2（P2-5）：blur 150ms 定时器句柄——页面切换/弹窗关闭时 clearTimeout，
     防 root 已 detached 后回调执行（幽灵 close，无副作用但浪费） */
  if(!root._cleanups)root._cleanups = [];
  root._cleanups.push(() => {
    document.removeEventListener('focusin', onFocusin);
    clearTimeout(_blurTimer);
    if(panel){panel.remove();panel = null;root.classList.remove('open');} /* FIX-R3-4: 模态关闭等场景下回收可能仍挂着的下拉面板 */
  });
  function open(){
    if(root.classList.contains('disabled'))return;
    if(panel){close();return;}
    const p = document.createElement('ul');p.className = 'cal-sel-panel';
    entries.forEach(([v, label]) => {
      const li = document.createElement('li');li.className = 'cal-sel-opt' + (v === val ? ' cur' : '');li.textContent = label;
      li.onmousedown = e => e.preventDefault(); /* 阻止选择前失焦收起 */
      li.onclick = () => { val = v;renderVal();close();root.focus(); };
      p.appendChild(li);
    });
    /* host 可指定下拉面板的挂载宿主（日历待办右键折叠菜单传入浮层本体），缺省仍挂 document.body */
    (host || document.body).appendChild(p);
    const r = root.getBoundingClientRect();
    const ph = p.offsetHeight, vh = window.innerHeight;
    const downSpace = vh - r.bottom - 4, upSpace = r.top - 4;
    const vw = window.innerWidth;
    p.style.left = Math.max(4, Math.min(r.left, vw - 4 - p.offsetWidth)) + 'px'; /* FIX-20: 水平钳制用 vw（视口宽），原误用 vh */
    p.style.width = Math.max(r.width, 64) + 'px';
    if(ph <= downSpace || downSpace >= upSpace){p.style.top = (r.bottom + 2) + 'px';p.style.bottom = '';}
    else{p.style.top = '';p.style.bottom = (vh - r.bottom + 2) + 'px';}
    panel = p;root.classList.add('open');
  }
  root.addEventListener('click', () => { if(!root.classList.contains('disabled'))open(); });
  root.addEventListener('keydown', e => {
    if(root.classList.contains('disabled'))return;
    if(!panel){
      if(e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown'){e.preventDefault();open();}
      return;
    }
    if(e.key === 'Escape'){e.preventDefault();close();root.focus();}
    else if(e.key === 'ArrowDown'){e.preventDefault();const i = entries.findIndex(x => x[0] === val);const nv = entries[Math.min(i + 1, entries.length - 1)][0];val = nv;renderVal();}
    else if(e.key === 'ArrowUp'){e.preventDefault();const i = entries.findIndex(x => x[0] === val);const nv = entries[Math.max(i - 1, 0)][0];val = nv;renderVal();}
    else if(e.key === 'Enter' || e.key === ' '){e.preventDefault();close();root.focus();}
  });
  /* FIX-LEAK-1（合并）：原匿名 focusin 监听（close 行为与上方 onFocusin 完全相同）与修复版重复且永不移除，
     已删除——统一由上方 onFocusin + _cleanups 负责登记/回收，避免每实例双监听 */
  root.addEventListener('blur', () => { clearTimeout(_blurTimer);_blurTimer = setTimeout(() => { if(!root.contains(document.activeElement))close(); }, 150); });
  root._val = () => val;
  root._set = (v: any) => { val = v;renderVal(); };
  root._disable = (d: any) => { root.classList.toggle('disabled', !!d);if(d)close(); };
  renderVal();
  return root;
}
export function openCalTimeModal(id: any): void {
  const n = deps.state.nodes[id];if(!n)return;
  const modal = document.createElement('div');modal.className = 'modal-overlay';
  const freq = (n.recur && n.recur.freq) || '';
  /* 重复方式：不重复 / 每天 / 每法定工作日 / 每周 / 每月 / 每年 / 每年（农历日） */
  const recurOpts: CalSelEntry[] = [['', '不重复'], ['daily', '每天'], ['workday', '每法定工作日'], ['weekly', '每周'], ['monthly', '每月'], ['yearly', '每年'], ['lunar', '每年（农历日）']];
  const optHtml = recurOpts.map(o => `<option value="${o[0]}"${o[0] === freq ? ' selected' : ''}>${o[1]}</option>`).join('');
  /* 时间为选择框：小时 0-23 + 分钟 5 的倍数（00、05…60，60 表示进位到下一整点）；自定义下拉 24 项完整显示 */
  const _pt = (s: any) => { if(!s)return null;const m = /^(\d{1,2}):(\d{2})$/.exec(s);return m ? { h: +m[1], m: +m[2] } : null; };
  const t0 = _pt(n.time), t1 = _pt(n.timeEnd);
  const hEntries: CalSelEntry[] = Array.from({ length: 24 }, (_, i) => [i, pad(i)] as CalSelEntry);
  const mEntries: CalSelEntry[] = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(v => [v, pad(v)] as CalSelEntry);
  const hEntriesWithNone: CalSelEntry[] = [['', '无'], ...hEntries];
  modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true" style="width:380px;max-width:92vw">
    <div class="modal-head"><span>设置时间</span><button class="modal-close">✕</button></div>
    <div class="modal-body">
      <div style="margin-bottom:6px">开始时间</div>
      <div style="display:flex;gap:8px;align-items:center">
        <div class="m-sh-wrap" style="flex:1;min-width:0"></div>
        <span style="color:var(--fg-dim);flex:none">:</span>
        <div class="m-sm-wrap" style="flex:1;min-width:0"></div>
      </div>
      <div style="margin:12px 0 6px"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="m-end" ${t1 ? 'checked' : ''}> 结束时间</label></div>
      <div class="m-endrow" style="display:flex;gap:8px;align-items:center;${t1 ? '' : 'opacity:.5'}">
        <div class="m-eh-wrap" style="flex:1;min-width:0"></div>
        <span style="color:var(--fg-dim);flex:none">:</span>
        <div class="m-em-wrap" style="flex:1;min-width:0"></div>
      </div>
      <div style="margin:12px 0 6px">重复方式</div>
      <select class="m-sel">${optHtml}</select>
      <div style="margin:12px 0 6px">重复结束日期（留空为无限制）</div>
      <div style="display:flex;gap:8px">
        <input type="date" class="m-date" value="${esc(n.recurEnd || '')}" style="flex:1;min-width:0">
        <button type="button" class="btn" data-none>无限制</button>
      </div>
    </div>
    <div class="modal-footer"><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>保存</button></div>
  </div>`;
  document.body.appendChild(modal);
  _modalStack.push(modal); /* FIX-M-23: 打开即入栈 */
  _syncAppInert();
  const isTop = () => _modalStack[_modalStack.length - 1] === modal;
  const sH = mkCalSel(hEntriesWithNone, t0 ? t0.h : '');
  const sM = mkCalSel(mEntries, t0 ? Math.min(Math.round(t0.m / 5) * 5, 55) : 0);
  const eH = mkCalSel(hEntries, t1 ? t1.h : 0);
  const eM = mkCalSel(mEntries, t1 ? Math.min(Math.round(t1.m / 5) * 5, 55) : 0);
  modal.querySelector('.m-sh-wrap')!.replaceWith(sH);
  modal.querySelector('.m-sm-wrap')!.replaceWith(sM);
  modal.querySelector('.m-eh-wrap')!.replaceWith(eH);
  modal.querySelector('.m-em-wrap')!.replaceWith(eM);
  const endCb = modal.querySelector('.m-end') as HTMLInputElement;
  const endRow = modal.querySelector('.m-endrow') as HTMLElement;
  const sel = modal.querySelector('.m-sel') as HTMLSelectElement;
  const dateInp = modal.querySelector('.m-date') as HTMLInputElement;
  sH.focus();
  endCb.onchange = () => {
    endRow.style.opacity = endCb.checked ? '1' : '.5';
    eH._disable(!endCb.checked);eM._disable(!endCb.checked);
    if(endCb.checked && !t1){
      const hv = sH._val();if(hv !== '' && !isNaN(+hv)){eH._set(Math.min(+hv + 1, 23));eM._set(0);}
    }
  };
  const focusables = () => Array.from(modal.querySelectorAll('a[href],button,input,select,textarea,.cal-sel,[tabindex]:not([tabindex="-1"])')).filter((el: any) => !el.disabled);
  const onKey = (e: KeyboardEvent) => {
    if(!isTop())return;
    if(e.key === 'Escape'){e.preventDefault();e.stopPropagation();close();return;}
    if(e.key !== 'Tab')return;
    const f = focusables();if(!f.length)return;
    const first = f[0], last = f[f.length - 1];
    if(e.shiftKey){ if(document.activeElement === first || !modal.contains(document.activeElement)){e.preventDefault();(last as HTMLElement).focus();} }
    else{ if(document.activeElement === last || !modal.contains(document.activeElement)){e.preventDefault();(first as HTMLElement).focus();} }
  };
  document.addEventListener('keydown', onKey);
  const close = () => { document.removeEventListener('keydown', onKey);modal.remove();const i = _modalStack.indexOf(modal);if(i >= 0)_modalStack.splice(i, 1);
    /* FIX-LEAK-1 + FIX-CLEANUP-2: 弹窗关闭时无条件 drain 4 个 mkCalSel 实例的 _cleanups
       （focusin 监听移除 + blur 定时器清理）；兼容旧 _dispose 字段。 */
    [sH, sM, eH, eM].forEach(x => { try{
      if(x && x._cleanups && x._cleanups.length){x._cleanups.forEach(f => { try{f();}catch(e){console.warn('[JU] caught error',e);} });x._cleanups.length = 0;}
      else if(x && x._dispose){x._dispose();}
    }catch(e){console.warn('[JU] caught error',e);} });
  };
  function save(){
    const sHv = sH._val(), sMv = +sM._val();
    const fr = sel.value;
    const end = dateInp.value || null;
    if(end && !/^\d{4}-\d{2}-\d{2}$/.test(end)){toast('结束日期格式无效');return;}
    const cur = deps.state.nodes[id];
    let wd: any = null;
    if(fr === 'weekly' && cur && cur.recur && cur.recur.weekday != null)wd = cur.recur.weekday;
    let t0v: string | null = null, t1v: string | null = null;
    if(sHv !== ''){
      let sMin = +sHv * 60 + sMv; /* 分钟可为 60 → 进位到下一整点 */
      if(sMin >= 1440){toast('开始时间超出当日（分钟 60 时请选择前一个小时）');return;}
      t0v = calMinToHm(sMin);
      if(endCb.checked){
        let eMin = +eH._val() * 60 + (+eM._val());
        if(eMin >= 1440 || eMin <= sMin){toast('结束时间需晚于开始时间且不超出当日');return;}
        t1v = calMinToHm(eMin);
      }
    }
    deps.commit((s: any) => {
      const nn = s.nodes[id];if(!nn)return;
      nn.time = t0v;nn.timeEnd = t1v;
      nn.recur = fr === '' ? null : (fr === 'weekly' && wd != null ? { freq: fr, interval: 1, weekday: wd } : { freq: fr, interval: 1 });
      nn.recurEnd = end;nn.updatedAt = deps.nowSeq();
    }, { snapshot: true, dirtyDocs: deps.getCalendarRootId() });
    /* 批次 4-F：commit 内部 L6 增量维护（calIndexUpdate）已按 patch 更新日历索引，
       此处再 invalidateCalIndex() 会让下一次日历渲染多做一次全量索引重建（>500 待办库尤为明显）→ 删除 */
    deps.forceRender();close();
  }
  (modal.querySelector('.modal-close') as HTMLElement).onclick = close;
  (modal.querySelector('[data-cancel]') as HTMLElement).onclick = close;
  (modal.querySelector('[data-none]') as HTMLElement).onclick = () => { dateInp.value = ''; };
  (modal.querySelector('[data-ok]') as HTMLElement).onclick = save;
  modal.onclick = e => { if(e.target === modal && isTop())close(); }; /* FIX-M-23: 遮罩点击仅作用于栈顶 */
}
/* 待办时间显示与编辑（今日待办列表 · 与时间网格同源同步） */
export function fmtHm(s: any): string | null {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(s || ''));
  if(!m)return null;
  if(+m[1] > 23 || +m[2] > 59)return null; /* 显示层兜底：非法时分不出胶囊 */
  /* FIX-P0-1: pad 补齐前导零——原 (+m[1])+':'+m[2] 把 '00' 变 0 输出 '8:0'，且 '9:30'>'9:5' 字符串比较为 false，
     导致 09:05–09:30 时间段被 fmtCalTime/_te>_ts 误判为单点时间 */
  return pad(+m[1]) + ':' + pad(+m[2]);
}
/* L17-W4 · P3-1：删除死代码（全文件零调用点的时间输入解析函数）；时间输入一律经 fmtHm / snapHalfMins 校验。 */
/* 日历事件拖拽：拖动主体平移时间段（时长不变），拖动底部把手调整结束时间。
   起止时间吸附整点/半点（30 分钟网格）。仅 pointerup 时提交（视觉跟随用 top/height 直改），
   提交后经 invalidateCalIndex 同步今日待办胶囊与网格。 */
export function snapHalfMins(mins: number): number {
  let m = Math.round(mins / 30) * 30;
  if(m >= 1440)m = 1439;
  if(m < 0)m = 0;
  return m;
}
export function calMinToHm(m: number): string {
  const mm = clampM(Math.round(m), 0, 1439);
  return pad(Math.floor(mm / 60)) + ':' + pad(mm % 60);
}
export function clampM(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
export function fmtCalTime(n: any): string {
  const t = fmtHm(n && n.time);
  const t2 = fmtHm(n && n.timeEnd);
  if(t && t2 && t2 > t)return t + '-' + t2;
  return t || '';
}
