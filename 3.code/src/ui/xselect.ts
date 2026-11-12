/**
 * 【fix7 · D-12】跨行文本选区模型（跨 contenteditable 宿主的富文本选区）
 *
 * 实测根因（见 90过程材料/tmp_compare/fix7/richtext_capability.log）：
 *   Blink（Edge 155 / WebView2 同源）不允许 `Selection` 跨「编辑宿主（editing host）」：
 *     · 编程式把 Range 从第 1 个 `.text` 建到第 3 个 `.text`，读回 `toString().length` 只覆盖首块，
 *       `containsNode` 命中数恒为 1；
 *     · 把 `#content` **克隆**到 body（不复制任何监听器）后做同样的鼠标拖选，仍然 covered=1；
 *     · 两个**裸** contenteditable（无产品 CSS / 无监听）拖选，仍然 covered=1。
 *   ⇒ 「跨行选区被拦截」不是某个监听器的问题，而是引擎把原生选区钳在单个编辑宿主内。
 *   因此产品侧自建选区模型：记录 (锚点块, 偏移) → (焦点块, 偏移)，逐块换算出块内 Range。
 *
 * 模型口径：
 *   · 偏移一律是**宿主纯文本偏移**（`host.textContent` 的下标），与 DOM 结构（span 嵌套）无关；
 *   · 跨行判定：锚点块与焦点块不是同一块（同一块交给原生选区，不抢）；
 *   · 高亮【fix13 · D-14】：
 *       fix12 之前靠给整个宿主加 `ju-xsel` 底色 ⇒「整块泛绿，绿色区域 ≠ 选中文字」；
 *       fix12 把该底色清零后 ⇒ 跨行部分**完全没有**可见高亮（原生 Selection 被引擎钳在单宿主内）。
 *       本批改为 **逐字符矩形 Overlay**：对模型每块换算 Range → `getClientRects()` → 在
 *       `#ju-xsel-overlay`（position:fixed / pointer-events:none）里逐个矩形贴一层 `.ju-xsel-block`。
 *       原生选区的 `getClientRects()` 也在同一处使用：两端取并集但**扣掉原生已绘制的区间**，
 *       避免「原生绿 + overlay 绿」双层叠加变深。`ju-xsel` 类保留为**零绘制的模型标记**
 *       （fix7/fix11/fix12 三份 spec 的模型断言依赖它），不参与任何绘制。
 *   · 消费方：工具栏（rightbar 逐块套样式）、Backspace（逐块 deleteContents）、Shift+↑/↓（扩展焦点块）。
 *
 * 该模块不依赖任何产品 deps，可直接被 views / ui 双方引用，避免循环依赖。
 */

export interface XSelRange { id: string; from: number; to: number; }
export interface XSelPoint { id: string; off: number; }

interface XSelState { anchor: XSelPoint; focus: XSelPoint; }

const HOST_SEL = '#content .text[contenteditable="true"]';
const HOST_CLS = 'ju-xsel';
const OVERLAY_ID = 'ju-xsel-overlay';
const OVERLAY_BLOCK_CLS = 'ju-xsel-block';

let _state: XSelState | null = null;
let _savedNative: Range | null = null;
let _painted: HTMLElement[] = [];
let _dragBound = false;
let _viewportBound = false;

/* 【fix13-patch1】overlay 渲染层：rAF 节流 + 节点池（池只增不减，多余的块 display:none 复用） */
let _overlay: HTMLElement | null = null;
let _blockPool: HTMLElement[] = [];
let _rafId: number | null = null;
const _ovStats = { created: 0, painted: 0, paints: 0, reused: 0, visible: 0, pools: 0 };

function hosts(): HTMLElement[] {
  if (typeof document === 'undefined') return [];
  try {
    return Array.from(document.querySelectorAll(HOST_SEL)) as HTMLElement[];
  } catch (e) {
    console.warn('[JU] caught error', e);
    return [];
  }
}

/** 按 data-id 取正文编辑宿主（重渲染后仍有效）。 */
export function xselHostById(id: string): HTMLElement | null {
  if (!id) return null;
  const list = hosts();
  for (let i = 0; i < list.length; i++) if (list[i].dataset.id === id) return list[i];
  return null;
}

function textLen(el: HTMLElement): number {
  return String(el.textContent || '').length;
}

/** 宿主内「文本节点 + 偏移」→ 宿主纯文本偏移。 */
function offsetIn(host: HTMLElement, node: any, offset: number): number {
  try {
    const r = document.createRange();
    r.setStart(host, 0);
    r.setEnd(node, offset);
    return String(r.toString()).length;
  } catch (e) {
    console.warn('[JU] caught error', e);
    return 0;
  }
}

/** 宿主纯文本偏移 → 宿主内「文本节点 + 偏移」（越界时收到末个文本节点末尾）。 */
function pointAtOffset(host: HTMLElement, off: number): [any, number] {
  const want = Math.max(0, off);
  let remain = want;
  let last: any = null;
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
  let node: any = walker.nextNode();
  while (node) {
    const len = String(node.nodeValue || '').length;
    if (remain <= len) return [node, remain];
    remain -= len;
    last = node;
    node = walker.nextNode();
  }
  if (last) return [last, String(last.nodeValue || '').length];
  return [host, 0];
}

function closestHost(node: any): HTMLElement | null {
  if (!node) return null;
  const el: any = node.nodeType === 1 ? node : node.parentElement;
  if (!el || !el.closest) return null;
  return el.closest(HOST_SEL) as HTMLElement | null;
}

/** 坐标 → 正文宿主 + 文本偏移（落点不在文本上时按最近一行折算）。 */
export function xselPointAt(x: number, y: number): XSelPoint | null {
  try {
    const d: any = document;
    let range: Range | null = null;
    if (typeof d.caretRangeFromPoint === 'function') range = d.caretRangeFromPoint(x, y);
    else if (typeof d.caretPositionFromPoint === 'function') {
      const p = d.caretPositionFromPoint(x, y);
      if (p) {
        const r = document.createRange();
        r.setStart(p.offsetNode, p.offset);
        r.collapse(true);
        range = r;
      }
    }
    if (range && range.startContainer) {
      const host = closestHost(range.startContainer);
      if (host) return { id: String(host.dataset.id || ''), off: offsetIn(host, range.startContainer, range.startOffset) };
    }
    /* 落点在行的空白区 / 行尾：折算到该行文本的末尾 */
    const el: any = document.elementFromPoint(x, y);
    const row = el && el.closest ? el.closest('#content .row') : null;
    if (row) {
      const t = row.querySelector('.text[contenteditable="true"]') as HTMLElement | null;
      if (t) return { id: String(t.dataset.id || ''), off: textLen(t) };
    }
  } catch (e) {
    console.warn('[JU] caught error', e);
  }
  return null;
}

/** 当前模型覆盖的块内区间（已按文档顺序排列，空区间自动剔除）。 */
export function xselRanges(): XSelRange[] {
  if (!_state) return [];
  const list = hosts();
  let ai = -1, fi = -1;
  for (let i = 0; i < list.length; i++) {
    if (list[i].dataset.id === _state.anchor.id) ai = i;
    if (list[i].dataset.id === _state.focus.id) fi = i;
  }
  if (ai < 0 || fi < 0) return [];
  const a = _state.anchor.off, f = _state.focus.off;
  if (ai === fi) {
    const from = Math.min(a, f), to = Math.max(a, f);
    return to > from ? [{ id: _state.anchor.id, from, to }] : [];
  }
  const lo = Math.min(ai, fi), hi = Math.max(ai, fi);
  const out: XSelRange[] = [];
  for (let i = lo; i <= hi; i++) {
    const h = list[i];
    const len = textLen(h);
    let from = 0, to = len;
    if (i === ai) {
      if (ai < fi) { from = a; to = len; } else { from = 0; to = a; }
    }
    if (i === fi) {
      if (ai < fi) { from = 0; to = f; } else { from = f; to = len; }
    }
    if (to > from) out.push({ id: String(h.dataset.id || ''), from, to });
  }
  return out;
}

/** 模型是否处于「跨行」状态（覆盖 ≥2 个宿主且区间非空）。 */
export function xselActive(): boolean {
  return xselRanges().length >= 2;
}

function clearPaint(): void {
  for (const h of _painted) {
    try { h.classList.remove(HOST_CLS); } catch (e) { console.warn('[JU] caught error', e); }
  }
  _painted = [];
}

/* ---------------- fix13 · 逐字符矩形 Overlay ---------------- */

/** 取（或懒创建）绝对定位的 overlay 容器；pointer-events:none，不挡事件。 */
function ensureOverlay(): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  if (_overlay && _overlay.isConnected) return _overlay;
  let el = document.getElementById(OVERLAY_ID) as HTMLElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.setAttribute('aria-hidden', 'true');
    /* 内联兜底（样式主源仍是 style.css 的 #ju-xsel-overlay 段） */
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.width = '100vw';
    el.style.height = '100vh';
    el.style.pointerEvents = 'none';
    /* 【fix13-patch1】z-index 9999 → 5：overlay 只需压在正文之上（正文 / 行在 #content 内
       不参与 z-index 竞争），5 已足够；同时严格低于右键菜单（--z-menu 10050）、模态（1500）
       与各类浮层，不会再盖住这些面板。插入符可见性不靠 z-index —— overlay 是
       pointer-events:none 的独立图层，插入符由正文层绘制，取证见 overlay_scroll_after.log。 */
    el.style.zIndex = '5';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  _overlay = el;
  /* 幂等接管既有子节点（热重载 / 重复初始化时不让池与实际 DOM 脱节） */
  if (!_blockPool.length) {
    const kids = Array.from(el.querySelectorAll('.' + OVERLAY_BLOCK_CLS)) as HTMLElement[];
    _blockPool = kids;
    if (kids.length > _ovStats.created) _ovStats.created = kids.length;
  }
  _ovStats.pools = _blockPool.length;
  return _overlay;
}

function hideBlock(el: HTMLElement): void {
  if (!el) return;
  try { if (el.style.display !== 'none') el.style.display = 'none'; } catch (e) { console.warn('[JU] caught error', e); }
}

/**
 * 清空 overlay（fix13-patch1）：
 *   · 块节点**不销毁**——引用留在 _blockPool 里，下一次绘制直接重新挂回（复用）；
 *   · 但一律**从 DOM 摘下**（display:none + removeChild）。理由（零漂移）：
 *     fix13 历史用例（tests/v21-fix13-exact-selection.spec.ts「点空白」「跨行 Backspace」）
 *     断言「取消/删除后 .ju-xsel-block 数量 === 0」，若只做 display:none，DOM 里仍残留隐藏块，
 *     历史契约就被打破。摘出 DOM 同时满足：数量归零（历史断言）+ 节点复用（无重建）。
 */
function clearOverlay(): void {
  cancelPaint();
  for (const b of _blockPool) {
    hideBlock(b);
    try { if (b.parentNode) b.parentNode.removeChild(b); } catch (e) { console.warn('[JU] caught error', e); }
  }
  _ovStats.visible = 0;
  if (_overlay) {
    try { _overlay.style.display = 'none'; } catch (e) { console.warn('[JU] caught error', e); }
    return;
  }
  if (typeof document === 'undefined') return;
  const el = document.getElementById(OVERLAY_ID);
  if (!el) return;
  try { el.style.display = 'none'; } catch (e) { console.warn('[JU] caught error', e); }
}

/** 原生选区在指定宿主内覆盖的字符区间；collapsed / 不在该宿主 → null。 */
function nativeIntervalIn(host: HTMLElement): [number, number] | null {
  try {
    const s = window.getSelection();
    if (!s || !s.rangeCount || s.isCollapsed) return null;
    const r = s.getRangeAt(0);
    const hasStart = host.contains(r.startContainer);
    const hasEnd = host.contains(r.endContainer);
    if (!hasStart && !hasEnd) return null;
    const a = hasStart ? offsetIn(host, r.startContainer, r.startOffset) : 0;
    const b = hasEnd ? offsetIn(host, r.endContainer, r.endOffset) : textLen(host);
    return a <= b ? [a, b] : [b, a];
  } catch (e) {
    console.warn('[JU] caught error', e);
    return null;
  }
}

/** 模型区间减去「原生已绘制的区间」，返回仍需 overlay 绘制的子区间（避免双层叠深）。 */
function subtractRange(range: [number, number], cut: [number, number] | null): [number, number][] {
  const from = range[0], to = range[1];
  if (!cut) return to > from ? [[from, to]] : [];
  const out: [number, number][] = [];
  if (from < cut[0]) out.push([from, Math.min(to, cut[0])]);
  if (to > cut[1]) out.push([Math.max(from, cut[1]), to]);
  return out.filter((p) => p[1] > p[0]);
}

/* ---------------- fix13-patch1 · rAF 节流 + 节点池 ---------------- */

/** 取消排队中的下一帧绘制（清空 / 取消选中时必须掐掉，避免「清空后又被旧帧画回来」）。 */
function cancelPaint(): void {
  if (_rafId === null) return;
  try {
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(_rafId);
  } catch (e) { console.warn('[JU] caught error', e); }
  _rafId = null;
}

/**
 * 合并同一帧内的多次重绘请求（滚动 / resize / 拖拽 mousemove / selectionchange 都走这里）。
 * 口径与任务书一致：已排队 ⇒ 先 cancelAnimationFrame，再挂新的 rAF。
 */
function scheduleRepaint(): void {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') { doPaint(); return; }
  cancelPaint();
  try {
    _rafId = window.requestAnimationFrame(() => { _rafId = null; doPaint(); });
  } catch (e) {
    console.warn('[JU] caught error', e);
    _rafId = null;
    doPaint();
  }
}

/**
 * 池化取块：索引命中 ⇒ 复用既有节点（只改几何；上次清空时被摘出 DOM 的会重新挂回），
 * 不足才新建（池只增不减）。
 */
function ensureBlock(i: number): HTMLElement | null {
  const box = _overlay;
  if (!box) return null;
  if (i < _blockPool.length) {
    const b = _blockPool[i];
    _ovStats.reused++;
    if (!b.isConnected) {
      try { box.appendChild(b); } catch (e) { console.warn('[JU] caught error', e); }
    }
    return b;
  }
  const d = document.createElement('div');
  d.className = OVERLAY_BLOCK_CLS;
  d.style.position = 'absolute';
  d.style.pointerEvents = 'none';
  d.style.display = 'none';
  box.appendChild(d);
  _blockPool.push(d);
  _ovStats.created++;
  _ovStats.pools = _blockPool.length;
  return d;
}

/**
 * 真正的绘制（**只在 rAF 里跑**）：模型每块 Range → getClientRects() → 复用池里的块。
 * 三条硬约束：
 *   ① 只写 left/top/width/height，绝不 innerHTML = '' / textContent = ''（节点复用）；
 *   ② 本轮用不到的块一律 display:none（不删除，留给下一次复用）；
 *   ③ 每帧都重新 getClientRects()，因此滚动 / resize / 虚拟滚动卸载后坐标天然同步。
 */
function doPaint(): void {
  _rafId = null;
  const box = ensureOverlay();
  if (!box) return;
  bindViewportRefresh();
  const need: { id: string; from: number; to: number; rc: any }[] = [];
  if (_state) {
    const rs = xselRanges();
    for (const r of rs) {
      const host = xselHostById(r.id);
      if (!host) continue;
      const cut = nativeIntervalIn(host);
      for (const piece of subtractRange([r.from, r.to], cut)) {
        const rg = xselRangeInHost(r.id, piece[0], piece[1]);
        if (!rg) continue;
        let rects: any;
        try { rects = rg.getClientRects(); } catch (e) { console.warn('[JU] caught error', e); continue; }
        for (let i = 0; i < rects.length; i++) {
          const rc = rects[i];
          if (!(rc.width > 0) || !(rc.height > 0)) continue;
          need.push({ id: r.id, from: piece[0], to: piece[1], rc: rc });
        }
      }
    }
  }
  for (let i = 0; i < need.length; i++) {
    const b = ensureBlock(i);
    if (!b) continue;
    const it = need[i];
    try {
      b.dataset.id = it.id;
      b.dataset.from = String(it.from);
      b.dataset.to = String(it.to);
      b.style.left = it.rc.left.toFixed(2) + 'px';
      b.style.top = it.rc.top.toFixed(2) + 'px';
      b.style.width = it.rc.width.toFixed(2) + 'px';
      b.style.height = it.rc.height.toFixed(2) + 'px';
      if (b.style.display !== 'block') b.style.display = 'block';
      _ovStats.painted++;
    } catch (e) { console.warn('[JU] caught error', e); }
  }
  /* 多出来的块只隐藏、不删除 —— 这就是「池」的复用来源 */
  for (let i = need.length; i < _blockPool.length; i++) hideBlock(_blockPool[i]);
  _ovStats.visible = need.length;
  _ovStats.paints++;
  try { box.style.display = need.length ? 'block' : 'none'; } catch (e) { console.warn('[JU] caught error', e); }
}

/**
 * 【fix13】「点正文面板空白 = 取消选中」的兜底。
 * 取证（tests/v21-fix13-exact-selection.spec.ts「取消选中（点空白）」）：`#content` 里
 * .outline 之外/行之外的空白区（大纲下方留白）按下时，views/outline.ts 的 wrap / row
 * 两级 mousedown 都收不到，模型残留 ⇒ overlay 高亮不消失。
 * 作用域刻意收紧：
 *   · 正文块 `.text` 内 → 不处理（交给拖选 / 原生选区）；
 *   · 行 `.row` 内 → 不处理（views/outline.ts:475 自己会 xselClear，再走节点多选）；
 *   · `#content` 之外（右侧工具栏 / 侧栏）→ **不处理**：工具栏要先把模型逐块套完样式再自己 xselClear，
 *     提前清空会让「颜色 / 背景 / 字号」对跨行选区失效。
 */
function onDocMouseDown(e: MouseEvent): void {
  if (!_state || e.button !== 0) return;
  try {
    const t: any = e.target;
    if (!t) return;
    const el: any = t.nodeType === 1 ? t : t.parentElement;
    if (!el || typeof el.closest !== 'function') return;
    if (el.closest('.text')) return;
    if (el.closest('.row')) return;
    if (!el.closest('#content')) return;
    xselClear();
  } catch (err) {
    console.warn('[JU] caught error', err);
  }
}

/**
 * 【fix13-patch1】会真正改写文字的按键 → 立刻清模型（防幽灵高亮）。
 * 刻意放行的键（保持 fix7 / fix11 / fix13 既有语义，零漂移）：
 *   · Escape            —— views/outline.ts:1216 自己 xselClear；
 *   · Backspace/Delete  —— 跨行删除由 views/outline.ts:1219 → xselDelete 逐块处理；
 *   · 方向键 / Home/End / PageUp/PageDown / Tab / 修饰键 —— 选区导航与 Shift+↑↓ 扩选；
 *   · 任何 ctrl / meta / alt 组合 —— 复制 / 剪切 / 撤销等快捷键不动模型。
 */
function onDocKeyDown(e: KeyboardEvent): void {
  if (!_state) return;
  if (e.isComposing) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = String(e.key || '');
  if (!k) return;
  if (k === 'Escape' || k === 'Backspace' || k === 'Delete' || k === 'Tab') return;
  if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta' || k === 'CapsLock') return;
  if (k.indexOf('Arrow') === 0 || k === 'Home' || k === 'End' || k === 'PageUp' || k === 'PageDown') return;
  /* 其余（可打印字符 / Enter）落地即改文字 ⇒ 模型偏移立刻失效，必须清干净 */
  xselClear();
}

/** 滚动 / 缩放 / 原生选区变化 / 文字即将改动时重算或清空 overlay。 */
function bindViewportRefresh(): void {
  if (_viewportBound || typeof window === 'undefined') return;
  _viewportBound = true;
  /* 捕获阶段监听所有滚动（含 #content 这类内部滚动容器）—— 滚动事件不冒泡，但走捕获路径 */
  document.addEventListener('scroll', () => { if (_state) scheduleRepaint(); else clearOverlay(); }, true);
  window.addEventListener('resize', () => { if (_state) scheduleRepaint(); });
  document.addEventListener('selectionchange', () => {
    /* 模型为空 ⇒ overlay 必须清零（Esc / 删除 / 取消后原生选区清空也走这里） */
    if (!_state) { clearOverlay(); return; }
    /* 模型在 ⇒ 原生选区可能扩大/收缩，重算「需补充绘制」的部分 */
    scheduleRepaint();
  });
  document.addEventListener('mousedown', onDocMouseDown, true);
  /* 选区清理三件套：文字一旦真的要变，模型偏移就失效 ⇒ 立刻 xselClear（块全部 display:none）。
     beforeinput 只在「即将真正落笔」时触发；产品侧 preventDefault 的按键（Esc / 跨行 Backspace /
     Enter 自建行）不会产生 beforeinput ⇒ 不会抢在既有语义之前清模型。 */
  document.addEventListener('beforeinput', () => { if (_state) xselClear(); }, true);
  document.addEventListener('input', () => { if (_state) xselClear(); }, true);
  document.addEventListener('keydown', onDocKeyDown, true);
}

function paint(): void {
  clearPaint();
  const rs = xselRanges();
  for (const r of rs) {
    const h = xselHostById(r.id);
    if (!h) continue;
    /* 零绘制标记：保留 .ju-xsel 让既有模型断言（fix7/fix11/fix12）继续成立；
       视觉高亮一律由 overlay 承担（fix13）。 */
    try { h.classList.add(HOST_CLS); _painted.push(h); } catch (e) { console.warn('[JU] caught error', e); }
  }
  /* fix13-patch1：绘制合并到下一帧（拖拽 mousemove 高频触发时不再逐事件同步重排） */
  scheduleRepaint();
}

/** 清空模型（同时摘除标记与 overlay）。 */
export function xselClear(): void {
  cancelPaint();
  detachDrag();
  clearPaint();
  clearOverlay();
  _state = null;
  _savedNative = null;
}

/** 用坐标建立新的锚点（mousedown 时调用）；返回 false = 落点不在正文块上。 */
export function xselBeginFromPoint(x: number, y: number): boolean {
  xselClear();
  const p = xselPointAt(x, y);
  if (!p || !p.id) return false;
  _state = { anchor: { id: p.id, off: p.off }, focus: { id: p.id, off: p.off } };
  try {
    const s = window.getSelection();
    _savedNative = s && s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
  } catch (e) { console.warn('[JU] caught error', e); }
  return true;
}

function onDragMove(e: MouseEvent): void {
  if (!_state) return;
  const p = xselPointAt(e.clientX, e.clientY);
  if (!p || !p.id) return;
  if (p.id === _state.focus.id && p.off === _state.focus.off) return;
  _state.focus = { id: p.id, off: p.off };
  paint();
}

function onDragUp(): void {
  detachDrag();
  /* 没跨块（同一块内拖选）：交回原生选区语义，不保留模型 */
  if (!xselActive()) xselClear();
}

function detachDrag(): void {
  if (!_dragBound) return;
  _dragBound = false;
  document.removeEventListener('mousemove', onDragMove, true);
  document.removeEventListener('mouseup', onDragUp, true);
}

/** mousedown 命中 `.text` 后调用：接管后续拖拽，把焦点端点落到指针所在块。 */
export function xselDragAttach(): void {
  ensureOverlay();
  bindViewportRefresh();
  if (_dragBound) return;
  _dragBound = true;
  document.addEventListener('mousemove', onDragMove, true);
  document.addEventListener('mouseup', onDragUp, true);
}

/** Shift+↑/↓：把焦点端点移到相邻块（模型未建立时以当前光标为锚点）。 */
export function xselExtend(dir: 1 | -1): boolean {
  const list = hosts();
  if (!list.length) return false;
  if (!_state) {
    const s = window.getSelection();
    if (!s || !s.rangeCount) return false;
    const r = s.getRangeAt(0);
    const host = closestHost(r.startContainer);
    if (!host) return false;
    const off = offsetIn(host, r.startContainer, r.startOffset);
    _state = { anchor: { id: String(host.dataset.id || ''), off }, focus: { id: String(host.dataset.id || ''), off } };
  }
  let fi = -1;
  for (let i = 0; i < list.length; i++) if (list[i].dataset.id === _state.focus.id) fi = i;
  if (fi < 0) return false;
  const ni = fi + dir;
  if (ni < 0 || ni >= list.length) return false;
  const nh = list[ni];
  _state.focus = { id: String(nh.dataset.id || ''), off: dir === 1 ? 0 : textLen(nh) };
  paint();
  try { nh.focus(); } catch (e) { console.warn('[JU] caught error', e); }
  return xselActive();
}

/** 宿主纯文本偏移 → 块内 Range（写样式 / 删除的唯一入口）。 */
export function xselRangeInHost(id: string, from: number, to: number): Range | null {
  const host = xselHostById(id);
  if (!host) return null;
  const a = pointAtOffset(host, from), b = pointAtOffset(host, to);
  try {
    const r = document.createRange();
    r.setStart(a[0], a[1]);
    r.setEnd(b[0], b[1]);
    return r;
  } catch (e) {
    console.warn('[JU] caught error', e);
    return null;
  }
}

/**
 * 逐块删除模型覆盖的文字（跨行 Backspace）。
 * 返回每个受影响块删除后的 innerHTML，由调用方写回 state（走产品自身的 commit / updateText）。
 */
export function xselDelete(): { id: string; html: string }[] {
  const out: { id: string; html: string }[] = [];
  const rs = xselRanges();
  for (const r of rs) {
    const host = xselHostById(r.id);
    if (!host) continue;
    const rg = xselRangeInHost(r.id, r.from, r.to);
    if (!rg) continue;
    try {
      rg.deleteContents();
      out.push({ id: r.id, html: host.innerHTML });
    } catch (e) { console.warn('[JU] caught error', e); }
  }
  xselClear();
  try {
    const s = window.getSelection();
    if (s) s.removeAllRanges();
  } catch (e) { console.warn('[JU] caught error', e); }
  return out;
}

/** 把原生选区恢复到模型的第一段（工具栏写完后保持可见的选区）。 */
export function xselRestoreNativeStart(): void {
  const rs = xselRanges();
  const s = window.getSelection();
  if (!s) return;
  if (rs.length) {
    const rg = xselRangeInHost(rs[0].id, rs[0].from, rs[0].to);
    if (rg) { s.removeAllRanges(); s.addRange(rg); return; }
  }
  if (_savedNative && _savedNative.startContainer && _savedNative.startContainer.isConnected) {
    try { s.removeAllRanges(); s.addRange(_savedNative); } catch (e) { console.warn('[JU] caught error', e); }
  }
}

/**
 * 【fix19】原生选区在**单宿主**内的快照（宿主 id + 纯文本偏移 from/to）。
 *
 * 为什么需要它：跨行模型承载多行高亮，但原生 `Selection` 仍被引擎钳在单个编辑宿主内。
 * 格式命令执行前把这段「原生可见子选区」记成 (id, from, to)，写样式（DOM 拆分/包裹文本节点）
 * 之后按偏移重建 Range —— 文本长度不变 ⇒ 偏移仍有效，`sel.toString().length` 与操作前逐字一致。
 * 返回 null = 原生选区折叠 / 跨宿主 / 不在正文宿主（此时调用方回退到 xselRestoreNativeStart）。
 */
export interface XSelNativeSnap { id: string; from: number; to: number; }

export function xselCaptureNative(): XSelNativeSnap | null {
  try {
    const s = window.getSelection();
    if (!s || !s.rangeCount || s.isCollapsed) return null;
    const r = s.getRangeAt(0);
    const hs = closestHost(r.startContainer);
    const he = closestHost(r.endContainer);
    if (!hs || !he || hs !== he) return null;
    const id = String(hs.dataset.id || '');
    if (!id) return null;
    const a = offsetIn(hs, r.startContainer, r.startOffset);
    const b = offsetIn(he, r.endContainer, r.endOffset);
    return a <= b ? { id, from: a, to: b } : { id, from: b, to: a };
  } catch (e) { console.warn('[JU] caught error', e); return null; }
}

/**
 * 【fix19】格式命令写完后：**保留跨行选区模型**（不清空 _state / overlay），
 * 按 snap 还原原生选区（失败则回退到模型首段），并重绘 overlay。
 *
 * 与 xselClear 的区别：xselClear 会销毁模型 ⇒ 多行高亮消失、只剩首行原生选区，
 * 即「富文本编辑后选区错误收缩至第一行」。本函数让操作完成后选区**保持不变**。
 */
export function xselKeepAfterFormat(snap?: XSelNativeSnap | null): void {
  if (!_state) return;
  const s = window.getSelection();
  let restored = false;
  if (snap && s) {
    const rg = xselRangeInHost(snap.id, snap.from, snap.to);
    if (rg) {
      try { s.removeAllRanges(); s.addRange(rg); restored = true; } catch (e) { console.warn('[JU] caught error', e); }
    }
  }
  if (!restored) xselRestoreNativeStart();
  /* 模型仍在 ⇒ 重绘 overlay（DOM 刚被包 span，几何需重算） */
  paint();
}

/**
 * 【fix13-patch1】overlay 池统计（**只读诊断端口**，不参与任何业务逻辑）。
 * 用于「节点复用」回归断言：`created` 只在池扩容时 +1，`painted` 每写一个矩形 +1；
 * 复用生效 ⇒ painted ≫ created，且 created 不会随拖选轮次线性增长。
 */
export function xselOverlayStats(): any {
  const box = typeof document !== 'undefined' ? (document.getElementById(OVERLAY_ID) as HTMLElement | null) : null;
  const cs = box && typeof window !== 'undefined' ? window.getComputedStyle(box) : null;
  return {
    overlayExists: !!box,
    pool: _blockPool.length,
    domBlocks: box ? box.querySelectorAll('.' + OVERLAY_BLOCK_CLS).length : 0,
    visible: _ovStats.visible,
    created: _ovStats.created,
    painted: _ovStats.painted,
    paints: _ovStats.paints,
    reused: _ovStats.reused,
    rafPending: _rafId !== null,
    zIndex: cs ? cs.zIndex : null,
    pointerEvents: cs ? cs.pointerEvents : null,
    display: cs ? cs.display : null,
  };
}

/** 模型自述（回归断言 / 诊断用）。 */
export function xselDescribe(): any {
  const rs = xselRanges();
  return {
    active: xselActive(),
    anchor: _state ? { id: _state.anchor.id, off: _state.anchor.off } : null,
    focus: _state ? { id: _state.focus.id, off: _state.focus.off } : null,
    covered: rs.length,
    ids: rs.map((r) => r.id),
    ranges: rs,
  };
}

/* 回归探针端口（fix7/richtext_multiline_probe.cjs 读它；只读，不参与业务逻辑） */
try {
  if (typeof window !== 'undefined') (window as any).__juXsel = {
    describe: xselDescribe,
    active: xselActive,
    ranges: xselRanges,
    clear: xselClear,
    overlayStats: xselOverlayStats,
  };
} catch (e) { console.warn('[JU] caught error', e); }
