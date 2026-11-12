/**
 * M1-1 · 批次 AB · 幻灯片视图（JU_SLIDES）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - 模块头 / 常量区（VERSION / THUMB_H / OVERSCAN / STORE_KEY / MIN_FRAC）.... 20800-20810
 *   - 【fix23】_styleOnce 已删除：r9 / r23 / L22-final-r4 / 不变量 #77 的 CSS 全量外提至
 *     src/style.css（选择器统一 .ju-sl-wrap 前缀），严格 CSP 下不再运行期注入 <style> .... 20811-20896
 *   - _throttle / _esc / _plain / _node / _toast / _clamp .......................... 20897-20910
 *   - _load / _persist / _docImgs / _list / _pages / _sig / _lines ................ 20911-20952
 *   - _mountRail / _thumbEl / _select / _updateCount / _paint ..................... 20953-21028
 *   - _selImg / _bindDrag / _startMove / _startResize / _imgEl / _renderImgs ....... 21029-21103
 *   - _align / _setBg / _delImg / _addFile ........................................ 21104-21149
 *   - _open / _close / _presStep / _presPaint ..................................... 21150-21221
 *   - _patch（增量补丁）........................................................... 21222-21253
 *   - render（左缩略图栏 + 右舞台 + 工具栏 + 拖拽 / 粘贴 + 卸载钩子）.............. 21254-21393
 *   - _pagehide / init / 导出对象 ................................................. 21394-21413
 *   - renderSlidesView / initJuSlides ............................................. 21414-21421
 *
 * 约束：DOM 结构、类名、交互顺序、提示文案与 FIX/批次注释逐字保留。
 *   【fix23】例外：内联 style 属性改 class；运行期动态几何改写入 CSS 变量 --ju-sl-*（el.style.setProperty）。
 *   未拆分业务符号统一走 `deps` 依赖注入容器（原直接引用改为 `deps.xxx`），由 src/main.ts
 *   以 `JU_SLIDES.init(deps)` 装配：
 *     state / ui / commit / N / saveUI / renderDocHeaderInline / isBlankNode。
 *   已拆分模块直接 import：stripHtml / esc（core/utils）；toast（ui/common）。
 *   非业务结构调整：`init()` 幂等哨兵（注入 deps 与产品 boot 各自调用一次时 pagehide 监听不重复登记；
 *   fix23 起页内 <style> 注入已移除，幻灯片样式全部来自 src/style.css）。
 */
import { stripHtml, esc } from '../core/utils';
import { toast } from '../ui/common';

/** 幻灯片依赖注入容器（承接原同作用域内、尚未拆分到模块的既有业务实现）。 */
export interface SlidesDeps {
  /** 全局数据状态（对应产品的 `state`） */
  state: any;
  /** 全局 UI 状态对象（对应产品的 `ui`） */
  ui: any;
  /** 不可变提交（对应产品的 `commit`，标题输入框 blur 落盘） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** UI 状态持久化（对应产品的 `saveUI`） */
  saveUI: () => void;
  /** 文档内联标题（对应产品的 `renderDocHeaderInline(doc)`） */
  renderDocHeaderInline: (doc: any) => HTMLElement;
  /** 空节点判定（对应产品的 `isBlankNode(n)`，分页时过滤空顶级节点） */
  isBlankNode: (n: any) => boolean;
}

/** 依赖注入容器（模块内安全占位：加载即不抛 ReferenceError）。 */
export const deps: SlidesDeps = {
  state: { nodes: {}, rootId: null },
  ui: {},
  commit: () => undefined,
  N: () => null,
  saveUI: () => undefined,
  renderDocHeaderInline: () => document.createElement('div'),
  isBlankNode: () => false,
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function injectJuSlidesDeps(next: Partial<SlidesDeps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   【L15-W5 · 指令9】幻灯片视图（JU_SLIDES）
   顶部工具栏入口（data-view="slides"）+ 左右分栏导航（左缩略图 / 右编辑预览区）；
   图片管理（上传 / 拖拽 / 粘贴添加 · 调整大小 / 拖动 / 对齐 / 设为背景 · 边界内钳制）；
   演示模式（基于大纲顶级节点自动分页 · 全屏 · 隐藏工具栏 · 方向键/点击切换 · 页码指示器 · ESC 退出）。
   G-1：文本框高度自适应（字数多自动撑开 · 绝不截断重叠）+ 窗口调整实时重排。
   G-2 / G-5：缩略图列表虚拟化（仅渲染可见区 + overscan）；大图懒加载（loading=lazy）；
   演示模式切换仅按 changedIds 增量补丁，不触发全局 O(n) 重算。
   ============================================================ */
const VERSION = 'l15w5';
const THUMB_H = 88;
const OVERSCAN = 4;
const STORE_KEY = 'juju.slides.v1';
const MIN_FRAC = 0.05;
const _imgs: Record<string, Record<string, any[]>> = Object.create(null);
const _cleanups: Array<() => void> = [];
let _ctx: SlidesCtx | null = null;
let _loadDone = false;
let _inited = false;

/** 单页正文行（层级缩进）。 */
export interface SlidesLine {
  depth: number;
  txt: string;
}

/** 演示模式状态（全屏覆盖层）。 */
interface PresState {
  ov: HTMLElement;
  bg: HTMLElement;
  title: HTMLElement;
  body: HTMLElement;
  foot: HTMLElement;
  i: number;
  cleanup: (() => void) | null;
}

/** 渲染上下文（与产品件 render() 内 ctx 对象同形）。 */
export interface SlidesCtx {
  doc: any;
  docId: any;
  pages: any[];
  page: number;
  items: any;
  sig: string;
  sel: any;
  pres: any;
  rail: any;
  inner: any;
  updateRail: any;
  stage: any;
  bg: any;
  box: any;
  outline: any;
  info: any;
}

/* 【fix23】原 _styleOnce()（运行期 createElement('style') 注入 #juSlidesStyle）已删除：
   上面这批规则（r9 / r23 / L22-final-r4 / 不变量 #77 全量）原样外提至 src/style.css，
   选择器统一加 .ju-sl-wrap 前缀；严格 CSP 下不再产生运行期样式注入违规。 */
/* 单 rAF 节流（G-2）：同帧多次调用合并为一次，末值优先。 */
function _throttle(fn: (...args: any[]) => void): (...args: any[]) => void {
  let raf = 0, last: any[] | null = null;
  return function (this: any) {
    last = Array.prototype.slice.call(arguments);
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; const a = last as any[]; last = null; try { fn.apply(null, a); } catch(e){console.warn('[JU] caught error',e);} });
  };
}
function _esc(s: any): string { try { return esc(s); } catch (e) { return String(s == null ? '' : s); } }
function _plain(h: any): string { try { return stripHtml(h || ''); } catch (e) { return String(h || ''); } }
function _node(id: any): any { try { return deps.N(id); } catch (e) { return null; } }
function _toast(m: any): void { try { toast(m); } catch(e){console.warn('[JU] caught error',e);} }
function _clamp(v: number, a: number, b: number): number { return v < a ? a : (v > b ? b : v); }
function _load(): void {
  if (_loadDone) return; _loadDone = true;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return;
    for (const docId in obj) { if (obj[docId] && typeof obj[docId] === 'object') _imgs[docId] = obj[docId]; }
  } catch(e){console.warn('[JU] caught error',e);}
}
function _persist(): void { try { localStorage.setItem(STORE_KEY, JSON.stringify(_imgs)); } catch(e){console.warn('[JU] caught error',e);} }
function _docImgs(docId: any): any {
  _load(); if (!_imgs[docId]) _imgs[docId] = Object.create(null); return _imgs[docId];
}
function _list(docId: any, pageId: any): any[] { const d = _docImgs(docId); if (!d[pageId]) d[pageId] = []; return d[pageId]; }
/* 幻灯片分页 = 大纲顶级节点（自动分页）。 */
function _pages(doc: any): any[] {
  /* 批次-终极：过滤空节点（无正文且无子节点的顶级节点不生成幻灯片页）。 */
  if (!doc || !doc.children) return [];
  return doc.children.map(function (id: any) { return _node(id); }).filter(function (n: any) {
    return n && !n._deleted && !deps.isBlankNode(n);
  });
}
function _sig(doc: any): string { return _pages(doc).map(function (n: any) { return n.id; }).join(','); }
/* 单页正文 = 顶级节点子树的可见行（层级缩进）。 */
function _lines(node: any): SlidesLine[] {
  const out: SlidesLine[] = [];
  if (!node) return out;
  const walk = function (id: any, depth: number) {
    if (out.length > 60) return;
    const n = _node(id);
    if (!n || n._deleted) return;
    if (id !== node.id && n.collapsed) return;
    if (id !== node.id) {
      const t = _plain(n.text).trim();
      if (t) out.push({ depth: depth, txt: t });
    }
    const kids = n.children || [];
    for (let i = 0; i < kids.length; i++) walk(kids[i], depth + 1);
  };
  const cs = node.children || [];
  for (let i = 0; i < cs.length; i++) walk(cs[i], 0);
  return out;
}
function _mountRail(rail: HTMLElement, ctx: SlidesCtx): void {
  const inner = document.createElement('div'); inner.className = 'ju-sl-rail-inner';
  rail.appendChild(inner);
  ctx.inner = inner; ctx.items = new Map();
  const update = function () {
    const total = ctx.pages.length;
    /* 【fix23】虚拟列表总高改走 CSS 变量（.ju-sl-rail-inner{height:var(--ju-sl-rail-h)}） */
    inner.style.setProperty('--ju-sl-rail-h', (total * THUMB_H) + 'px');
    /* 【r23】虚拟滚动锚点改为 inner（滚动容器已从 rail 下移到 .ju-sl-rail-inner，
       底部固定的「第 n / N 页」信息不参与滚动，滚动缩略图时页码不被带走）。 */
    const top = inner.scrollTop || 0, h = inner.clientHeight || 1;
    const first = Math.max(0, Math.floor(top / THUMB_H) - OVERSCAN);
    const last = Math.min(total - 1, Math.ceil((top + h) / THUMB_H) + OVERSCAN);
    ctx.items.forEach(function (el: HTMLElement, idx: number) {
      if (idx < first || idx > last) { if (el.parentNode) el.parentNode.removeChild(el); ctx.items.delete(idx); }
    });
    for (let i = first; i <= last; i++) {
      if (ctx.items.has(i)) continue;
      const el = _thumbEl(ctx, i);
      el.style.setProperty('--ju-sl-top', (i * THUMB_H) + 'px');
      inner.appendChild(el);
      ctx.items.set(i, el);
    }
  };
  ctx.updateRail = update;
  const onScroll = _throttle(update);
  inner.addEventListener('scroll', onScroll, { passive: true });
  _cleanups.push(function () { try { inner.removeEventListener('scroll', onScroll); } catch(e){console.warn('[JU] caught error',e);} });
  update();
  /* 【r23】视图切换当帧 inner.clientHeight 可能尚未定稿（首帧布局未完成 ⇒ 只铺满 1 屏甚至 0 屏），
     下一帧再按真实可视高度补测一次，保证缩略图虚拟列表铺满并产生可滚动溢出。 */
  requestAnimationFrame(function () { try { update(); } catch(e){console.warn('[JU] caught error',e);} });
}
function _thumbEl(ctx: SlidesCtx, i: number): HTMLElement {
  const n = ctx.pages[i];
  const el = document.createElement('div');
  el.className = 'ju-sl-thumb';
  el.dataset.idx = String(i);
  el.dataset.id = n.id;
  const no = document.createElement('span'); no.className = 'ju-sl-thumb-no'; no.textContent = String(i + 1);
  const tx = document.createElement('div'); tx.className = 'ju-sl-thumb-tx';
  const b = document.createElement('b'); b.textContent = (_plain(n.text).trim() || ('幻灯片 ' + (i + 1)));
  tx.appendChild(b);
  const sub = _lines(n).slice(0, 2).map(function (x) { return x.txt; }).join(' · ');
  if (sub) { const sp = document.createElement('span'); sp.textContent = sub; tx.appendChild(sp); }
  el.appendChild(no); el.appendChild(tx);
  el.onclick = function () { _select(ctx, i); };
  return el;
}
function _select(ctx: SlidesCtx, i: number): void {
  if (i < 0 || i >= ctx.pages.length) return;
  ctx.page = i;
  ctx.items.forEach(function (el: HTMLElement, idx: number) { el.classList.toggle('on', idx === i); });
  _paint(ctx);
}
function _updateCount(ctx: SlidesCtx): void {
  const pid = ctx.pages[ctx.page] ? ctx.pages[ctx.page].id : null;
  const k = pid ? _list(ctx.docId, pid).length : 0;
  /* 【r24】页码栏仅保留页码与图片张数，删除末尾冗余说明文案。 */
  ctx.info.textContent = '第 ' + ((ctx.page || 0) + 1) + ' / ' + ctx.pages.length + ' 页 · 图片 ' + k + ' 张';
}
/* 【fix23】把层级缩进写进 CSS 变量 --ju-sl-indent（原内联 style="margin-left:Npx" 已删除）。 */
function _indent(host: HTMLElement | null): void {
  if (!host) return;
  const lis = host.querySelectorAll('li[data-d]');
  for (let i = 0; i < lis.length; i++) {
    const d = Number((lis[i] as HTMLElement).dataset.d || 0);
    try { (lis[i] as HTMLElement).style.setProperty('--ju-sl-indent', (d * 16) + 'px'); } catch(e){console.warn('[JU] caught error',e);}
  }
}
function _paint(ctx: SlidesCtx): void {
  const n = ctx.pages[ctx.page];
  if (!n) { ctx.box.innerHTML = ''; if (ctx.outline) ctx.outline.innerHTML = ''; ctx.info.textContent = '暂无幻灯片'; return; }
  ctx.box.innerHTML = _esc(_plain(n.text).trim() || ('幻灯片 ' + (ctx.page + 1)));
  /* 【P0】主舞台同步渲染大纲子节点：_lines(n) → <ul class="ju-sl-outline"><li>…</li></ul> */
  if (ctx.outline) {
    const lines = _lines(n);
    let html = '';
    for (let i = 0; i < lines.length && i < 60; i++) {
      /* 【fix23】缩进改由 class + CSS 变量承载（原内联 style="margin-left:Npx"） */
      html += '<li class="ju-sl-li" data-d="' + lines[i].depth + '">' + _esc(lines[i].txt) + '</li>';
    }
    ctx.outline.innerHTML = html;
    _indent(ctx.outline);
  }
  _renderImgs(ctx);
  _updateCount(ctx);
}
function _selImg(ctx: SlidesCtx, el: HTMLElement, im: any): void {
  ctx.sel = im;
  const all = ctx.stage.querySelectorAll('.ju-sl-img');
  for (let i = 0; i < all.length; i++) all[i].classList.toggle('on', all[i] === el);
}
function _bindDrag(el: HTMLElement, onMove: (...args: any[]) => void): void {
  const up = function (ev: PointerEvent) {
    try { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); } catch(e){console.warn('[JU] caught error',e);}
    try { if (el.hasPointerCapture && el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId); } catch(e){console.warn('[JU] caught error',e);}
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
function _startMove(ctx: SlidesCtx, e: PointerEvent, el: HTMLElement, im: any): void {
  const r = ctx.stage.getBoundingClientRect();
  const sx = e.clientX, sy = e.clientY, ox = im.x, oy = im.y;
  const move = _throttle(function (ev: PointerEvent) {
    im.x = _clamp(ox + (ev.clientX - sx) / Math.max(1, r.width), 0, 1 - im.w);
    im.y = _clamp(oy + (ev.clientY - sy) / Math.max(1, r.height), 0, 1 - im.h);
    el.style.setProperty('--ju-sl-x', (im.x * 100) + '%'); el.style.setProperty('--ju-sl-y', (im.y * 100) + '%');
  });
  _bindDrag(el, move);
  move(e);
  _persist();
}
function _startResize(ctx: SlidesCtx, e: PointerEvent, el: HTMLElement, im: any): void {
  const r = ctx.stage.getBoundingClientRect();
  const sx = e.clientX, sy = e.clientY, ow = im.w, oh = im.h;
  const move = _throttle(function (ev: PointerEvent) {
    im.w = _clamp(ow + (ev.clientX - sx) / Math.max(1, r.width), MIN_FRAC, 1 - im.x);
    im.h = _clamp(oh + (ev.clientY - sy) / Math.max(1, r.height), MIN_FRAC, 1 - im.y);
    el.style.setProperty('--ju-sl-w', (im.w * 100) + '%'); el.style.setProperty('--ju-sl-h', (im.h * 100) + '%');
  });
  _bindDrag(el, move);
  move(e);
  _persist();
}
function _imgEl(ctx: SlidesCtx, im: any, idx: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ju-sl-img';
  el.dataset.idx = String(idx);
  el.style.setProperty('--ju-sl-x', (im.x * 100) + '%'); el.style.setProperty('--ju-sl-y', (im.y * 100) + '%');
  el.style.setProperty('--ju-sl-w', (im.w * 100) + '%'); el.style.setProperty('--ju-sl-h', (im.h * 100) + '%');
  const img = document.createElement('img');
  img.loading = 'lazy'; img.decoding = 'async'; img.src = im.src; img.alt = '';
  el.appendChild(img);
  const grip = document.createElement('div'); grip.className = 'ju-sl-rsz'; el.appendChild(grip);
  el.addEventListener('pointerdown', function (ev: PointerEvent) {
    if (ev.target === grip) return;
    ev.preventDefault(); ev.stopPropagation();
    try { if (el.setPointerCapture) el.setPointerCapture(ev.pointerId); } catch(e){console.warn('[JU] caught error',e);}
    _selImg(ctx, el, im); _startMove(ctx, ev, el, im);
  });
  grip.addEventListener('pointerdown', function (ev: PointerEvent) {
    ev.preventDefault(); ev.stopPropagation();
    try { if (el.setPointerCapture) el.setPointerCapture(ev.pointerId); } catch(e){console.warn('[JU] caught error',e);}
    _selImg(ctx, el, im); _startResize(ctx, ev, el, im);
  });
  return el;
}
function _renderImgs(ctx: SlidesCtx): void {
  const nodes = ctx.stage.querySelectorAll('.ju-sl-img');
  for (let i = nodes.length - 1; i >= 0; i--) { if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]); }
  ctx.sel = null;
  ctx.bg.style.backgroundImage = '';
  const pageId = ctx.pages[ctx.page] ? ctx.pages[ctx.page].id : null;
  if (!pageId) return;
  const list = _list(ctx.docId, pageId);
  for (let i = 0; i < list.length; i++) {
    const im = list[i];
    if (im.bg) { ctx.bg.style.backgroundImage = 'url("' + im.src + '")'; continue; }
    ctx.stage.appendChild(_imgEl(ctx, im, i));
  }
}
function _align(ctx: SlidesCtx, mode: string): void {
  const im = ctx.sel;
  if (!im) return;
  if (mode === 'left') im.x = 0;
  else if (mode === 'center') im.x = (1 - im.w) / 2;
  else if (mode === 'right') im.x = 1 - im.w;
  else if (mode === 'top') im.y = 0;
  else if (mode === 'middle') im.y = (1 - im.h) / 2;
  else if (mode === 'bottom') im.y = 1 - im.h;
  _persist(); _renderImgs(ctx);
}
function _setBg(ctx: SlidesCtx): void {
  const im = ctx.sel;
  if (!im) return;
  im.bg = !im.bg;
  if (im.bg) { im.x = 0; im.y = 0; im.w = 1; im.h = 1; }
  _persist(); _renderImgs(ctx);
}
function _delImg(ctx: SlidesCtx): void {
  const im = ctx.sel;
  if (!im) return;
  const pageId = ctx.pages[ctx.page] ? ctx.pages[ctx.page].id : null;
  if (!pageId) return;
  const list = _list(ctx.docId, pageId);
  const i = list.indexOf(im);
  if (i >= 0) list.splice(i, 1);
  _persist(); _renderImgs(ctx);
}
function _addFile(ctx: SlidesCtx, file: File | null): void {
  if (!file) return;
  const isImg = (/^image\//.test(file.type || '')) || /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(file.name || '');
  if (!isImg) return;
  const pageId = ctx.pages[ctx.page] ? ctx.pages[ctx.page].id : null;
  if (!pageId) { _toast('请先选择幻灯片'); return; }
  let fr: FileReader;
  try { fr = new FileReader(); } catch (e) { return; }
  fr.onload = function () {
    const src = String(fr.result || '');
    if (!src) return;
    const list = _list(ctx.docId, pageId);
    list.push({ src: src, x: 0.28, y: 0.28, w: 0.44, h: 0.3 });
    _persist(); _renderImgs(ctx); _updateCount(ctx);
    _toast('已添加图片');
  };
  try { fr.readAsDataURL(file); } catch(e){console.warn('[JU] caught error',e);}
}
function _open(ctx: SlidesCtx): void {
  if (document.getElementById('juSlPres')) return;
  if (!ctx.pages.length) { _toast('该文档暂无大纲顶级节点，无法演示'); return; }
  const ov = document.createElement('div'); ov.id = 'juSlPres';
  const stageEl = document.createElement('div'); stageEl.className = 'ju-pres-stage';
  const bg = document.createElement('div'); bg.className = 'ju-pres-bg';
  const content = document.createElement('div'); content.className = 'ju-pres-content';
  const title = document.createElement('div'); title.className = 'ju-pres-title';
  const body = document.createElement('ul'); body.className = 'ju-pres-body';
  content.appendChild(title); content.appendChild(body);
  const foot = document.createElement('div'); foot.className = 'ju-pres-foot';
  const hint = document.createElement('div'); hint.className = 'ju-pres-hint';
  hint.textContent = '← → / 点击 切换 · ESC 退出';
  stageEl.appendChild(bg); stageEl.appendChild(content);
  ov.appendChild(stageEl); ov.appendChild(foot); ov.appendChild(hint);
  document.body.appendChild(ov);
  document.body.classList.add('ju-pres-on');
  const p: PresState = { ov: ov, bg: bg, title: title, body: body, foot: foot, i: (ctx.page || 0), cleanup: null };
  ctx.pres = p;
  _presPaint(p, ctx);
  const onKey = function (e: KeyboardEvent) {
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); _close(ctx); }
    else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); _presStep(ctx, 1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); _presStep(ctx, -1); }
  };
  const onClick = function (e: MouseEvent) {
    const r = stageEl.getBoundingClientRect();
    const rel = (e.clientX - r.left) / Math.max(1, r.width);
    _presStep(ctx, rel > 0.5 ? 1 : -1);
  };
  document.addEventListener('keydown', onKey);
  stageEl.addEventListener('click', onClick);
  p.cleanup = function () {
    try { document.removeEventListener('keydown', onKey); } catch(e){console.warn('[JU] caught error',e);}
    try { stageEl.removeEventListener('click', onClick); } catch(e){console.warn('[JU] caught error',e);}
  };
  try { if (document.documentElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function (e) { console.warn('[JU] fullscreen failed', e); }); } catch(e){console.warn('[JU] caught error',e);}
}
function _close(ctx: SlidesCtx): void {
  const p = ctx.pres;
  if (!p) return;
  try { if (p.cleanup) p.cleanup(); } catch(e){console.warn('[JU] caught error',e);}
  try { if (p.ov && p.ov.parentNode) p.ov.parentNode.removeChild(p.ov); } catch(e){console.warn('[JU] caught error',e);}
  document.body.classList.remove('ju-pres-on');
  try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function (e) { console.warn('[JU] fullscreen failed', e); }); } catch(e){console.warn('[JU] caught error',e);}
  ctx.pres = null;
}
function _presStep(ctx: SlidesCtx, d: number): void {
  const p = ctx.pres;
  if (!p) return;
  const total = ctx.pages.length;
  if (!total) return;
  p.i = _clamp(p.i + d, 0, total - 1);
  _presPaint(p, ctx);
}
function _presPaint(p: PresState, ctx: SlidesCtx): void {
  const n = ctx.pages[p.i];
  if (!n) { p.title.textContent = ''; p.body.innerHTML = ''; p.foot.textContent = '0 / 0'; return; }
  p.title.textContent = (_plain(n.text).trim() || ('幻灯片 ' + (p.i + 1)));
  const lines = _lines(n);
  let html = '';
  for (let i = 0; i < lines.length && i < 60; i++) {
    html += '<li data-d="' + lines[i].depth + '">' + _esc(lines[i].txt) + '</li>';
  }
  p.body.innerHTML = html;
  _indent(p.body);
  p.bg.style.backgroundImage = '';
  const list = _list(ctx.docId, n.id);
  for (let j = 0; j < list.length; j++) { if (list[j].bg) { p.bg.style.backgroundImage = 'url("' + list[j].src + '")'; break; } }
  p.foot.textContent = (p.i + 1) + ' / ' + ctx.pages.length;
}
/* 增量补丁出口（G-2 / G-5）：仅计入受影响元素，不触发全局重算。 */
function _patch(changedIds: any[]): number {
  const ctx = _ctx;
  if (!ctx || !changedIds || !changedIds.length) return 0;
  const set = Object.create(null);
  for (let i = 0; i < changedIds.length; i++) set[changedIds[i]] = 1;
  let n = 0;
  const sig = _sig(ctx.doc);
  if (sig !== ctx.sig) {
    ctx.sig = sig; ctx.pages = _pages(ctx.doc);
    if (ctx.updateRail) ctx.updateRail();
    _select(ctx, Math.min(ctx.page, Math.max(0, ctx.pages.length - 1)));
    return n;
  }
  const cur = ctx.pages[ctx.page];
  if (cur && set[cur.id]) { _paint(ctx); n++; }
  if (ctx.items) {
    ctx.items.forEach(function (el: HTMLElement, idx: number) {
      const pg = ctx.pages[idx];
      if (pg && set[pg.id]) {
        const b = el.querySelector('b');
        if (b) b.textContent = (_plain(pg.text).trim() || ('幻灯片 ' + (idx + 1)));
        n++;
      }
    });
  }
  if (ctx.pres) {
    const pn = ctx.pages[ctx.pres.i];
    if (pn && set[pn.id]) { _presPaint(ctx.pres, ctx); n++; }
  }
  return n;
}
function render(doc: any): HTMLElement {
  if (!doc) { const w = document.createElement('div'); w.className = 'empty-state'; w.textContent = '请先选择文档'; return w; }
  const wrap = document.createElement('div'); wrap.className = 'files-wrap';
  /* 【UI-P0-4】幻灯片视图补文档标题行：复用大纲同结构 .doc-header，居中显示在舞台上方 */
  wrap.appendChild(deps.renderDocHeaderInline(doc));
  const pages = _pages(doc);
  const ctx: SlidesCtx = {
    doc: doc, docId: doc.id, pages: pages, page: 0, items: null, sig: _sig(doc), sel: null, pres: null,
    rail: null, inner: null, updateRail: null, stage: null, bg: null, box: null, outline: null, info: null
  };
  const outer = document.createElement('div'); outer.className = 'ju-sl-wrap';
  const rail = document.createElement('div'); rail.className = 'ju-sl-rail';
  const main = document.createElement('div'); main.className = 'ju-sl-main';
  const tb = document.createElement('div'); tb.className = 'ju-sl-toolbar';
  /* 【r7】幻灯片按钮直接复用编辑区 .sr-edit-row / .sr-edit-btn 容器与样式，不输出分类文字标题。 */
  const mkRow = function () {
    const r = document.createElement('div'); r.className = 'sr-edit-row';
    tb.appendChild(r); return r;
  };
  const mk = function (row: HTMLElement, label: string, icon: string, fn: () => void, tip?: string) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sr-edit-btn';
    b.title = tip || label; b.setAttribute('aria-label', label); b.innerHTML = icon;
    b.onclick = fn; row.appendChild(b); return b;
  };
  const fileIn = document.createElement('input');
  fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.multiple = true; fileIn.className = 'ju-sl-file';
  fileIn.onchange = function () {
    const fs = Array.prototype.slice.call(fileIn.files || []);
    for (let i = 0; i < fs.length; i++) _addFile(ctx, fs[i]);
    fileIn.value = '';
  };
  const _imgRow = mkRow();
  mk(_imgRow, '上传图片', '<svg viewBox="0 0 24 24"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/></svg>', function () { fileIn.click(); }, '上传图片（可多选）');
  mk(_imgRow, '设为背景', '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="8" cy="8" r="1.5"/></svg>', function () { _setBg(ctx); }, '切换当前页背景');
  mk(_imgRow, '删除图片', '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg>', function () { _delImg(ctx); }, '删除当前选中的图片');
  const _alignRow = mkRow();
  mk(_alignRow, '左对齐', '<svg viewBox="0 0 24 24"><path d="M4 6h16"/><path d="M4 10h10"/><path d="M4 14h16"/><path d="M4 18h8"/></svg>', function () { _align(ctx, 'left'); }, '左对齐');
  mk(_alignRow, '居中', '<svg viewBox="0 0 24 24"><path d="M4 6h16"/><path d="M7 10h10"/><path d="M4 14h16"/><path d="M8 18h8"/></svg>', function () { _align(ctx, 'center'); }, '居中');
  mk(_alignRow, '右对齐', '<svg viewBox="0 0 24 24"><path d="M4 6h16"/><path d="M10 10h10"/><path d="M4 14h16"/><path d="M12 18h8"/></svg>', function () { _align(ctx, 'right'); }, '右对齐');
  mk(_alignRow, '顶部', '<svg viewBox="0 0 24 24"><path d="M4 4h16"/><path d="M12 8v12"/><path d="M8 12l4-4 4 4"/></svg>', function () { _align(ctx, 'top'); }, '顶部');
  mk(_alignRow, '垂直居中', '<svg viewBox="0 0 24 24"><path d="M4 12h16"/><path d="M12 4v5M12 20v-5"/><path d="M9 7l3-3 3 3M9 17l3 3 3-3"/></svg>', function () { _align(ctx, 'middle'); }, '垂直居中');
  mk(_alignRow, '底部', '<svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M12 4v12"/><path d="M8 12l4 4 4-4"/></svg>', function () { _align(ctx, 'bottom'); }, '底部');
  const _presRow = mkRow();
  mk(_presRow, '演示模式', '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v3"/><path d="M8 21l4-2 4 2"/></svg>', function () { _open(ctx); }, '全屏演示（ESC 退出）');
  tb.appendChild(fileIn);
  const stage = document.createElement('div');
  stage.className = 'ju-sl-stage'; stage.tabIndex = 0;
  const bg = document.createElement('div'); bg.className = 'ju-sl-bg';
  const content = document.createElement('div'); content.className = 'ju-sl-content';
  const box = document.createElement('div');
  box.className = 'ju-sl-box'; box.contentEditable = 'true'; box.spellcheck = false;
  const outline = document.createElement('ul');
  outline.className = 'ju-sl-outline'; outline.setAttribute('contenteditable', 'false');
  box.addEventListener('blur', function () {
    const cur = ctx.pages[ctx.page];
    if (!cur) return;
    const nd = _node(cur.id);
    if (!nd) return;
    const txt = (box.textContent || '').trim();
    if (txt === _plain(nd.text).trim()) return;
    try {
      deps.commit(function (s: any) {
        const nn = s.nodes[cur.id];
        if (nn) { nn.text = txt; nn.updatedAt = Date.now(); }
      }, { snapshot: true, persistOnly: true });
    } catch(e){console.warn('[JU] caught error',e);}
  });
  content.appendChild(box); content.appendChild(outline);
  stage.appendChild(bg); stage.appendChild(content);
  /* 【r23/fix23】页码信息改用 .ju-sl-info 语义类（样式见 src/style.css 的 .ju-sl-wrap 段），并改挂到 rail 底部。 */
  const info = document.createElement('div');
  info.className = 'ju-sl-info';
  /* 【UI-P0-5】工具栏移入右侧栏「编辑」分区（data-section="edit"）：随视图切换显隐，DOM 不挂在舞台上；
     无右侧栏时回退挂到 wrap（保持功能可用）。 */
  // 维护提示：依赖右侧栏「编辑」分区始终存在于 DOM（当前折叠时仅隐藏、不销毁）。
  // 若未来改为条件渲染，需同步调整此处选择器，或依赖下方的 else 分支兜底挂到 wrap。
  const _tbHost = document.querySelector('#sidebarRight .sr-section[data-section="edit"] .sr-body') as HTMLElement | null;
  if (_tbHost) {
    Array.prototype.slice.call(_tbHost.querySelectorAll('.ju-sl-toolbar')).forEach(function (old: HTMLElement) { if (old !== tb && old.parentNode) old.parentNode.removeChild(old); });
    _tbHost.appendChild(tb);
  } else {
    wrap.appendChild(tb);
  }
  main.appendChild(stage);
  outer.appendChild(rail); outer.appendChild(main);
  wrap.appendChild(outer);
  ctx.rail = rail; ctx.stage = stage; ctx.bg = bg; ctx.box = box; ctx.outline = outline; ctx.info = info;
  _ctx = ctx;
  _mountRail(rail, ctx);
  /* 【r23】_mountRail 先建 inner（flex:1 滚动区），再把页码信息追加为 rail 的末项 ⇒ flex 纵向布局下
     恒贴栏位底部；挂载顺序保证 inner 在前、info 在后。 */
  rail.appendChild(info);
  _select(ctx, 0);
  /* 拖拽添加图片 */
  stage.addEventListener('dragover', function (e: DragEvent) { e.preventDefault(); });
  stage.addEventListener('drop', function (e: DragEvent) {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (!dt) return;
    const fs = Array.prototype.slice.call(dt.files || []);
    for (let i = 0; i < fs.length; i++) _addFile(ctx, fs[i]);
  });
  /* 粘贴添加图片（含剪贴板 items 回退） */
  stage.addEventListener('paste', function (e: ClipboardEvent) {
    const cd = e.clipboardData;
    if (!cd) return;
    const found: File[] = [];
    if (cd.files && cd.files.length) {
      for (let i = 0; i < cd.files.length; i++) { if (/^image\//.test(cd.files[i].type || '')) found.push(cd.files[i]); }
    }
    if (!found.length && cd.items) {
      for (let j = 0; j < cd.items.length; j++) {
        const it = cd.items[j];
        if (it && it.kind === 'file' && /^image\//.test(it.type || '')) {
          const f = it.getAsFile();
          if (f) found.push(f);
        }
      }
    }
    if (!found.length) return;
    e.preventDefault();
    for (let k = 0; k < found.length; k++) _addFile(ctx, found[k]);
  });
  /* 窗口调整实时重排（G-1） */
  const onResize = _throttle(function () { if (ctx.updateRail) ctx.updateRail(); });
  window.addEventListener('resize', onResize);
  /* L17-W3 · 指令 3：视图卸载钩子——renderMain() 每次重建 #content 都会丢弃旧 wrap，resize 监听若不随
     视图卸载移除，反复切换「幻灯片 ↔ 大纲」将线性累积监听器。与模块级 _cleanups 并存：
     _cleanups 负责 pagehide 全局兜底，wrap._cleanup 负责单次视图卸载（幂等，并从 _cleanups 摘除登记项）。 */
  const _slideCleanup = function () {
    try { window.removeEventListener('resize', onResize); } catch(e){console.warn('[JU] caught error',e);}
    /* 【r6】视图卸载时移除右侧栏内追加的幻灯片工具栏，避免离开幻灯片视图后残留隐藏节点 */
    try { if (tb.parentNode) tb.parentNode.removeChild(tb); } catch(e){console.warn('[JU] caught error',e);}
    const i = _cleanups.indexOf(_slideCleanup);
    if (i >= 0) _cleanups.splice(i, 1);
  };
  _cleanups.push(_slideCleanup);
  (wrap as any)._cleanup = _slideCleanup;
  (outer as any)._cleanup = _slideCleanup;
  return wrap;
}
function _pagehide(): void { if (_ctx && _ctx.pres) _close(_ctx); }
/**
 * 初始化（同时作为依赖注入口：`JU_SLIDES.init(deps)`）。
 * `next` 存在时先合并依赖；`_inited` 哨兵保证 pagehide 监听只登记一次
 * （fix23 起不再登记页内 <style>，样式全部来自 src/style.css）。
 */
function init(next?: Partial<SlidesDeps>): void {
  if (next) Object.assign(deps, next);
  if (_inited) return;
  _inited = true;
  try { _load(); } catch(e){console.warn('[JU] caught error',e);}
  try { window.addEventListener('pagehide', _pagehide, true); } catch(e){console.warn('[JU] caught error',e);}
  _cleanups.push(function () { try { window.removeEventListener('pagehide', _pagehide, true); } catch(e){console.warn('[JU] caught error',e);} });
}

/** 幻灯片视图单例（与产品件 `JU_SLIDES` 同名同形）。 */
export const JU_SLIDES = {
  version: VERSION,
  THUMB_H: THUMB_H,
  init: init,
  render: render,
  pagesOf: _pages,
  /* 增量补丁（G-5）：仅更新受影响单元素。 */
  patch: _patch,
  openPresentation: function () { if (_ctx) _open(_ctx); },
  closePresentation: function () { if (_ctx) _close(_ctx); },
  reset: function () { try { for (const k in _imgs) delete _imgs[k]; _persist(); } catch(e){console.warn('[JU] caught error',e);} }
};

/** 幻灯片视图入口（产品件 `renderSlidesView(doc)`）。 */
export function renderSlidesView(doc: any): HTMLElement {
  try { return JU_SLIDES.render(doc); }
  catch (e) {
    try { console.error('[JU] JU_SLIDES render failed', e); } catch(_e){console.warn('[JU] caught error',_e);}
    const w = document.createElement('div'); w.className = 'empty-state'; w.textContent = '幻灯片视图不可用'; return w;
  }
}

/** 幻灯片视图初始化（产品件 `initJuSlides()`）。 */
export function initJuSlides(): void { try { JU_SLIDES.init(); } catch(e){console.warn('[JU] caught error',e);} }
