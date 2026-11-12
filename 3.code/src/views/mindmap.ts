/**
 * M1-1 · 批次 Z · 思维导图视图（布局 / 渲染 / 拖拽 / SVG 导出）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - 常量与布局：MM_NW / MM_NH / MM_GX / MM_GY、mmLayoutConsts / mmNodeText /
 *     mmNodeHeight / layoutMindmap ....................................... 14152-14205
 *   - 连线锚点核心算法（导图与图谱共用）：juBorderAnchor ................. 14206-14221
 *   - 渲染主函数：renderMindmap（含 _mmDrag / _mmHit / _mmSchedule / _mmMark /
 *     _mmFlush / _mmChangedIds / _mmCollectDesc 等局部闭包）............. 14222-14534
 *   - SVG 导出：downloadMindmapSvg ....................................... 19215-19261
 *
 * 约束：DOM 结构、类名、内联样式、交互顺序、提示文案与 FIX/批次注释逐字保留。
 *   未拆分业务符号统一走 `deps` 依赖注入容器（原直接调用改为 `deps.xxx`），由 src/main.ts 装配：
 *     state / ui / commit / N / renderDocHeaderInline / currentBaseFontPx / saveUI /
 *     forceRender / nowSeq / isBlankNode / l14On / countVisibleNodes / VIRTUAL_THRESHOLD /
 *     renderMindmapVirtual / themeColor。
 *   已拆分模块直接 import：stripHtml / esc（core/utils）；linkTitleAtPoint / navigateToWikiLink
 *     （ui/rightbar）。
 */
import { stripHtml, esc } from '../core/utils';
import { linkTitleAtPoint, navigateToWikiLink } from '../ui/rightbar';

/** 布局节点（layoutMindmap 输出：世界坐标 + 动态高度 + 子树）。 */
export interface MindmapLayoutNode {
  id: any;
  x: number;
  y: number;
  h: number;
  kids: MindmapLayoutNode[];
}

/** 布局结果（offsetX / offsetY / rootNode 仅在 doc 存在时产出，与产品件早退对象形状一致）。 */
export interface MindmapLayout {
  nodes: MindmapLayoutNode[];
  width: number;
  height: number;
  NW: number;
  NH: number;
  offsetX?: number;
  offsetY?: number;
  rootNode?: MindmapLayoutNode;
}

/** 导图布局常量（字号缩放前基准值）。 */
export interface MindmapConsts {
  NW: number;
  NH: number;
  GX: number;
  GY: number;
}

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export interface MindmapDeps {
  /** 全局数据状态（对应产品的 `state`） */
  state: any;
  /** 全局 UI 状态对象（对应产品的 `ui`，含 mmScale 缩放比） */
  ui: any;
  /** 不可变提交（对应产品的 `commit`） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** 文档内联标题（对应产品的 `renderDocHeaderInline(doc)`） */
  renderDocHeaderInline: (doc: any) => HTMLElement;
  /** 当前基准字号（对应产品的 `currentBaseFontPx()`，布局常量按 /14 等比缩放） */
  currentBaseFontPx: () => number;
  /** UI 状态持久化（对应产品的 `saveUI`，mmScale 变化时写入） */
  saveUI: () => void;
  /** 请求下一次渲染（对应产品的 `forceRender`） */
  forceRender: () => void;
  /** 逻辑序号时钟（对应产品的 `_nowSeq`） */
  nowSeq: () => any;
  /** 空节点判定（对应产品的 `isBlankNode(n)`，布局时过滤空叶子） */
  isBlankNode: (n: any) => boolean;

  /* L14 导图窗口化（默认关闭态） */
  l14On: () => boolean;
  countVisibleNodes: (doc: any) => number;
  VIRTUAL_THRESHOLD: number;
  renderMindmapVirtual: (doc: any) => any;

  /** 主题令牌取色（对应产品的 `_themeColor(name,fallback)`，SVG 导出用） */
  themeColor: (name: string, fallback: string) => string;
}

/** 依赖注入容器（模块内安全占位：加载即不抛 ReferenceError）。 */
export const deps: MindmapDeps = {
  state: { nodes: {}, rootId: null },
  ui: {},
  commit: () => undefined,
  N: () => null,
  renderDocHeaderInline: () => document.createElement('div'),
  currentBaseFontPx: () => 14,
  saveUI: () => undefined,
  forceRender: () => undefined,
  nowSeq: () => 0,
  isBlankNode: () => false,

  l14On: () => false,
  countVisibleNodes: () => 0,
  VIRTUAL_THRESHOLD: Number.MAX_SAFE_INTEGER,
  renderMindmapVirtual: () => null,

  themeColor: (_name: string, fallback: string) => fallback || '',
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function injectMindmapDeps(next: Partial<MindmapDeps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   思维导图
   ============================================================ */
export const MM_NW = 170, MM_NH = 30, MM_GX = 220, MM_GY = 38;
/* FIX-R9-3: 导图布局常量随字号缩放（currentBaseFontPx/14），字号放大后节点框/间距/连线等比放大，与 .mm-node 的 em 文字匹配；屏幕渲染与 SVG 导出共用 */
export function mmLayoutConsts(): MindmapConsts {
  const k = Math.max(0.5, Math.min(2.5, deps.currentBaseFontPx() / 14));
  return { NW: Math.round(MM_NW * k), NH: Math.round(MM_NH * k), GX: Math.round(MM_GX * k), GY: Math.round(MM_GY * k) };
}
/* FIX-DB-07: 节点显示文本（根节点空文本回退「文档」） */
export function mmNodeText(n: any): string {
  return stripHtml((n && n.text) || '').trim() || (n && n.id === deps.state.rootId ? '文档' : '');
}
/* FIX-DB-07: 节点高度按文本行数估算——每行约 16 字，行高随字号缩放，最小不低于 NH，节点不重叠 */
export function mmNodeHeight(n: any): number {
  const { NH } = mmLayoutConsts();
  const text = mmNodeText(n);
  const charsPerLine = 16;
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  const lineH = Math.round(18 * Math.max(0.8, deps.currentBaseFontPx() / 14));
  const padV = 10;
  return Math.max(NH, lines * lineH + padV);
}
export function layoutMindmap(docId: any): MindmapLayout {
  const { NW, NH, GX, GY } = mmLayoutConsts();
  const doc = deps.N(docId);
  if (!doc) return { nodes: [], width: 0, height: 0, NW, NH };
  let cursorY = 0;
  function layout(id: any, depth: number): MindmapLayoutNode | null {
    const n = deps.N(id); if (!n) return null;
    const x = depth * GX;
    const h = mmNodeHeight(n);
    const kidsRaw = n.collapsed ? [] : n.children;
    const kids = (kidsRaw as any[]).map((k: any) => deps.N(k)).filter((cn: any) => cn && !deps.isBlankNode(cn));
    if (!kids.length) {
      const y = cursorY + h / 2;
      cursorY += h + GY;
      return { id, x, y, h, kids: [] };
    }
    const sub = kids.map((k: any) => layout(k.id, depth + 1)).filter((v: MindmapLayoutNode | null): v is MindmapLayoutNode => !!v);
    if (!sub.length) {
      const y = cursorY + h / 2;
      cursorY += h + GY;
      return { id, x, y, h, kids: [] };
    }
    const y = (sub[0].y + sub[sub.length - 1].y) / 2;
    return { id, x, y, h, kids: sub };
  }
  const trees = doc.children.map((cid: any) => layout(cid, 1)).filter((v: MindmapLayoutNode | null): v is MindmapLayoutNode => !!v);
  const rootNode: MindmapLayoutNode = { id: doc.id, x: 0, y: trees.length ? (trees[0].y + trees[trees.length - 1].y) / 2 : 0, h: mmNodeHeight(doc), kids: trees };
  const all: MindmapLayoutNode[] = [];
  (function c(nd: MindmapLayoutNode) { all.push(nd); nd.kids.forEach(c); })(rootNode);
  const minX = all.reduce((a, n) => Math.min(a, n.x), 0);
  const maxX = all.reduce((a, n) => Math.max(a, n.x), 0) + NW;
  const maxY = all.reduce((a, n) => Math.max(a, n.y + n.h / 2), 0);
  return { nodes: all, width: maxX - minX + 80, height: maxY + 80, NW, NH, offsetX: 40 - minX, offsetY: 40, rootNode };
}
/* 指令10 · 连线锚点核心算法（图谱 / 思维导图共用）-------------------------------
   以节点「最外层容器外边框盒（Border Box）」为边界：自节点中心向对端中心 (tx,ty) 引射线，
   取与边框（外扩 pad 后）最近边的交点 —— 锚点落在边框上，节点自带 padding 使锚点绝不侵入文字。
   cx,cy = 节点中心；hw,hh = 外边框盒半宽 / 半高；pad = 外扩量（>=0）。返回世界坐标 {x,y}。 */
export function juBorderAnchor(cx: number, cy: number, hw: number, hh: number, tx: number, ty: number, pad: number): { x: number; y: number } {
  const px = (pad > 0 ? pad : 0);
  const ex = hw + px, ey = hh + px;
  const dx = tx - cx, dy = ty - cy;
  const adx = dx < 0 ? -dx : dx, ady = dy < 0 ? -dy : dy;
  if (adx < 1e-6 && ady < 1e-6) return { x: cx, y: cy - ey };
  let t = Infinity;
  if (adx > 1e-6) { const tt = ex / adx; if (tt < t) t = tt; }
  if (ady > 1e-6) { const tt = ey / ady; if (tt < t) t = tt; }
  if (!isFinite(t)) t = 0;
  return { x: cx + dx * t, y: cy + dy * t };
}
export function renderMindmap(doc: any): HTMLElement {
  if (deps.l14On() && doc && deps.countVisibleNodes(doc) > deps.VIRTUAL_THRESHOLD) { try { return deps.renderMindmapVirtual(doc); } catch(e){console.warn('[JU] caught error',e);} } /* L14 G3：导图窗口化（默认关闭态） */
  const wrap = document.createElement('div') as HTMLDivElement & { _mmChangedIds?: Set<any>; _cleanup?: () => void; _recenter?: () => void };
  wrap.className = 'mm-wrap';
  if (doc) wrap.appendChild(deps.renderDocHeaderInline(doc));
  const spacer = document.createElement('div'); spacer.className = 'mm-spacer';
  const canvas = document.createElement('div'); canvas.className = 'mm-canvas';
  spacer.appendChild(canvas);
  wrap.appendChild(spacer);
  if (!doc) { wrap.innerHTML = '<div class="empty-state">请先选择文档</div>'; return wrap; }
  const layout = layoutMindmap(doc.id);
  const { nodes, width, height, NW, NH, offsetX, offsetY, rootNode } = layout as { nodes: MindmapLayoutNode[]; width: number; height: number; NW: number; NH: number; offsetX: number; offsetY: number; rootNode: MindmapLayoutNode };
  /* L22 · 清理 4：一级节点判定改为「布局深度」口径——原 nd.x===MM_GX 依赖未缩放的原始常量，
     而 layoutMindmap 的 nd.x = depth*GX（GX 由 mmLayoutConsts 按字号等比缩放）⇒ 字号非 100% 时恒不相等，
     .lv1 样式永不生效。改用根节点直接子节点集合判定（等价 depth===1，与缩放无关）。 */
  const _mmLv1Ids = new Set((rootNode && rootNode.kids ? rootNode.kids : []).map(k => k.id));
  canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
  canvas.style.transformOrigin = '0 0';
  let _mmScale = Math.max(0.4, Math.min(2.5, deps.ui.mmScale || 1));
  canvas.dataset.scale = String(_mmScale);
  canvas.style.transform = 'scale(' + _mmScale + ')';
  spacer.style.cssText = 'position:relative;width:' + (width * _mmScale) + 'px;height:' + (height * _mmScale) + 'px;';
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
  svg.style.zIndex = '0'; /* 指令10 · 连线层置底；节点 DOM 在其后 + z-index 抬升，连线不压文字 */
  const line = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  /* 【fixed17 #4】mmX/mmY 优先（用户拖动位置），fallback 自动布局 */
  function _pos(nd: any) {
    const n = deps.N(nd.id);
    /* FIX-M-10 mmX/mmY 改为 canvas 绝对坐标：已拖动节点直接使用其绝对值，渲染时不再叠加随 minX 变化的 offsetX/offsetY，消除树结构变化导致的位置漂移；未拖动节点仍回退自动布局(nd.x+offsetX) */
    const x = (n && typeof n.mmX === 'number') ? n.mmX : (nd.x + offsetX);
    const y = (n && typeof n.mmY === 'number') ? n.mmY : (nd.y + offsetY);
    return [x, y];
  }
  /* 指令10 · 导图连线：先建路径骨架（记录 from/to id），待节点挂载测量后按「外边框锚点」重算 d。
     骨架阶段以布局近似值起步，首帧 rAF 即被测量值覆盖（避免空白闪烁）。
     【批次1-1】连线与节点同源：仅当两端节点都已渲染出 DOM 时才建线——被过滤的空文本节点不再产生
     悬空贝塞尔；_mmEls 提前声明以供存在性校验，edges() 改在节点 DOM 建立之后调用（svg 仍为 canvas 首个子节点）。 */
  const _mmEdgeList: { from: any; to: any; path: SVGPathElement }[] = [];
  const _mmEls = new Map<any, HTMLElement>(); /* id -> 节点最外层容器 */
  function edges(nd: any) {
    nd.kids.forEach((k: any) => {
      const okFrom = _mmEls.has(nd.id) || nd.id === doc.id; /* 父节点已渲染（文档根节点恒渲染） */
      const okTo = _mmEls.has(k.id) || k.id === doc.id;     /* 子节点已渲染（无 DOM ⇒ 空文本被跳过） */
      if (okFrom && okTo) {
        const [a1x, a1y] = _pos(nd), [a2x, a2y] = _pos(k), mx = (a1x + a2x) / 2;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M${a1x},${a1y} C${mx},${a1y} ${mx},${a2y} ${a2x},${a2y}`);
        path.setAttribute('fill', 'none'); path.setAttribute('stroke', line); path.setAttribute('stroke-width', '1.5');
        path.dataset.from = String(nd.id); path.dataset.to = String(k.id);
        svg.appendChild(path); _mmEdgeList.push({ from: nd.id, to: k.id, path });
      }
      edges(k); /* 始终下钻：跳过无 DOM 节点的连线，但不遗漏其后代之间已渲染的连线 */
    });
  }
  canvas.appendChild(svg);
  nodes.forEach(nd => {
    const n = deps.N(nd.id);
    /* 批次 4-B：空文本但有子节点的节点不再跳过渲染——原实现（fixed15 B）一律 return，
       layoutMindmap 却为其保留布局占位 ⇒ 布局存在、DOM 不存在（子树与父连线断链）。
       改为渲染半透明「(空)」占位框，后续 cursor / 点击编辑逻辑照常生效。 */
    let _mmBlank = false;
    if (nd.id !== doc.id) {
      const txt = n ? stripHtml(n.text || '').trim() : '';
      if (!txt) _mmBlank = true;
    }
    const d = document.createElement('div') as HTMLDivElement & { _mmDragged?: boolean };
    let cls = 'mm-node';
    if (nd.id === doc.id) cls += ' root';
    else if (_mmLv1Ids.has(nd.id)) cls += ' lv1';
    if (n && n.done) cls += ' done';
    d.className = cls;
    /* FIX-M-10 mmX/mmY 为用户拖动后的 canvas 绝对位置：存在则直接定位，不再叠加 offset；无则回退自动布局(nd.x+offsetX)，与 _pos 保持一致 */
    const _px = (n && typeof n.mmX === 'number') ? n.mmX : (nd.x + offsetX);
    const _py = (n && typeof n.mmY === 'number') ? n.mmY : (nd.y + offsetY);
    d.style.left = _px + 'px'; d.style.top = _py + 'px';
    /* FIX-DB-07: 节点高度随内容自适应（minHeight=布局估算高度），垂直以 y 为中心定位，文本自动换行 */
    const _h = nd.h || NH;
    d.style.minHeight = _h + 'px';
    d.style.height = 'auto';
    d.style.marginTop = (-_h / 2) + 'px';
    d.style.whiteSpace = 'normal';
    d.style.wordBreak = 'break-word';
    d.dataset.autoX = String(nd.x + offsetX); d.dataset.autoY = String(nd.y + offsetY);
    if (nd.id === doc.id) d.textContent = stripHtml(doc.text) || '文档';
    else if (_mmBlank) { d.textContent = '(空)'; d.style.opacity = '.6'; }
    else d.textContent = n ? stripHtml(n.text || '') : '';
    if (nd.id !== doc.id) {
      d.style.cursor = 'text';
      d.onclick = e => {
        e.stopPropagation();
        if (d._mmDragged) { d._mmDragged = false; e.preventDefault(); return; } /* 指令11 · 拖动结束后抑制误触发的 click 进入编辑 */
        /* Wiki 链接跳转：Ctrl / Cmd + 点击 [[链接]] */
        if ((e.ctrlKey || e.metaKey) && !d.classList.contains('editing')) {
          const lt = linkTitleAtPoint(d, e);
          if (lt) { e.preventDefault(); navigateToWikiLink(lt, d); return; }
        }
        if (d.classList.contains('editing')) return;
        d.classList.add('editing'); d.contentEditable = 'true'; d.focus();
        const range = document.createRange(); range.selectNodeContents(d);
        const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
      };
      d.addEventListener('blur', () => {
        d.classList.remove('editing'); d.contentEditable = 'false';
        d.style.cursor = 'text';
        const target = deps.N(nd.id);
        if (target) { const newText = d.textContent; if (newText !== stripHtml(target.text || '')) { deps.commit(s => { const nn = s.nodes[nd.id]; if (!nn) return; nn.text = newText; nn.updatedAt = deps.nowSeq(); }, { snapshot: true }); } }
      });
      d.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); d.blur(); }
        if (e.key === 'Escape') { d.textContent = stripHtml(deps.N(nd.id).text || ''); d.blur(); }
        e.stopPropagation();
      });
      /* 【fixed16 B / 指令11】节点拖动：自由拖拽改位置；拖到另一节点上改层级（变子节点）。
         拖动期间仅用局部状态（_mmDrag，useRef 等价）+ 单 rAF 局部重绘，绝不提交 / 全局重渲染；
         仅在拖动结束时提交一次并生成 changedIds 增量补丁（G-2 / G-5）。 */
      d.addEventListener('mousedown', e => {
        if (d.classList.contains('editing')) { e.stopPropagation(); return; }
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const origLeft = parseFloat(d.style.left), origTop = parseFloat(d.style.top);
        const oldParent = (deps.N(nd.id) || {}).parent || null;
        const exclude = _mmCollectDesc(nd.id); /* 排除自身 + 子树，杜绝成环 */
        _mmDrag = { id: nd.id, startX, startY, origLeft, origTop, dragging: false, drop: null, exclude };
        const onMM = (ev: MouseEvent) => {
          if (!_mmDrag || _mmDrag.id !== nd.id) return;
          if (!_mmDrag.dragging) {
            if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
            _mmDrag.dragging = true; d.classList.add('dragging'); d.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
          }
          ev.preventDefault();
          const dx = (ev.clientX - startX) / _mmScale, dy = (ev.clientY - startY) / _mmScale;
          d.style.left = (origLeft + dx) + 'px';
          d.style.top = (origTop + dy) + 'px';
          _mmMark(nd.id); /* 指令10/11 · 仅重绘该节点关联连线（单 rAF 节流） */
          const cr = canvas.getBoundingClientRect();
          _mmQueueHit((ev.clientX - cr.left) / _mmScale, (ev.clientY - cr.top) / _mmScale); /* 落点检测并入 rAF，避免每 move O(N) */
        };
        const onMU = () => {
          document.removeEventListener('mousemove', onMM);
          document.removeEventListener('mouseup', onMU);
          const dg = _mmDrag; _mmDrag = null;
          if (!dg || !dg.dragging) return;
          d.classList.remove('dragging'); d.style.cursor = 'text';
          document.body.style.userSelect = '';
          if (dg.drop) { const pe = _mmEls.get(dg.drop); if (pe) pe.classList.remove('drop-target'); }
          d._mmDragged = true; /* 抑制拖动后误触发的 click 进入编辑 */
          const toNode = dg.drop ? deps.N(dg.drop) : null;
          const canNest = dg.drop && dg.drop !== oldParent && toNode && !toNode._isCalRoot && !toNode._isDbRoot;
          if (canNest) {
            /* 拖到另一节点 → 改变层级：单次提交；changedIds = {被移动节点, 原父, 新父}（G-5） */
            deps.commit(s => {
              const n = s.nodes[nd.id], to = s.nodes[dg.drop];
              if (!n || !to) return;
              const from = s.nodes[n.parent];
              if (from) { const i = from.children.indexOf(nd.id); if (i >= 0) from.children.splice(i, 1); }
              to.children.push(nd.id);
              n.parent = dg.drop; n.updatedAt = deps.nowSeq();
              /* 清除被移动节点及其子树手动坐标 → 自动并入新父布局（G-1 自动重排） */
              const clear = (x: any) => { const m = s.nodes[x]; if (!m) return; delete m.mmX; delete m.mmY; (m.children || []).forEach(clear); };
              clear(nd.id);
            }, { snapshot: true });
            wrap._mmChangedIds = _mmChangedIds(nd.id, oldParent, dg.drop);
            deps.forceRender();
            return;
          }
          /* 自由拖动：仅持久化 canvas 绝对坐标（视图态，不入撤销历史） */
          const nx = parseFloat(d.style.left), ny = parseFloat(d.style.top);
          deps.commit(s => { const nn = s.nodes[nd.id]; if (nn) { nn.mmX = Math.round(nx); nn.mmY = Math.round(ny); nn.updatedAt = deps.nowSeq(); } }, { snapshot: false, persistOnly: true });
          wrap._mmChangedIds = _mmChangedIds(nd.id, null, null);
        };
        document.addEventListener('mousemove', onMM);
        document.addEventListener('mouseup', onMU);
      });
    } else d.style.cursor = 'default';
    canvas.appendChild(d);
    _mmEls.set(nd.id, d);
  });
  edges(rootNode); /* 批次1-1：节点 DOM 就绪之后再建线，连线数量与可见节点严格对应 */
  /* 指令10 · 锚点测量 + 增量重绘（G-1 / G-2 / G-5）------------------------------------
     · 尺寸取节点最外层容器的「未缩放外框盒」（offsetLeft/Top/Width/Height）：canvas 施加了
       scale 变换，getBoundingClientRect 会返回被缩放坐标，故导图侧以 offset* 取世界坐标；
     · ResizeObserver 监听文字换行撑高容器（G-1）→ 标记 dirty → 单 rAF 重绘，绝不穿透文字；
     · 仅重算 dirty 节点关联连线（changedIds 增量补丁），初始化后不做全局 O(E) 重算；
     · 视口裁剪：两端点均在可视区外（含余量）的连线跳过重绘。 */
  const MM_EDGE_PAD = 3;
  const _mmBoxes = new Map<any, { cx: number; cy: number; hw: number; hh: number }>(); /* id -> {cx,cy,hw,hh} */
  const _mmDirty = new Set<any>();
  let _mmRaf = 0, _mmRO: ResizeObserver | null = null, _mmInit = false;
  function _mmMeasure(id: any) {
    const el = _mmEls.get(id); if (!el) return null;
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return null;
    const b = { cx: el.offsetLeft + w / 2, cy: el.offsetTop + h / 2, hw: w / 2, hh: h / 2 };
    _mmBoxes.set(id, b); return b;
  }
  function _mmBox(id: any) { return _mmBoxes.get(id) || _mmMeasure(id); }
  /* 指令11 · 拖动局部状态（useRef 等价物）+ 落点检测 + changedIds 增量补丁（G-2 / G-5）------
     · _mmDrag：拖拽期间的局部可变状态（被拖节点 / 起始点 / 落点目标 / 排除集），
       全程只在闭包内更新，不写 state、不触发全局重渲染；
     · _mmHit / _mmQueueHit：落点检测并入单 rAF（_mmFlush），避免每个 mousemove 做 O(N) 命中；
       节点数超 MM_CULL_N 时按视口裁剪，仅测屏内节点；
     · _mmChangedIds：生成 {被移动节点, 原父, 新父} 增量补丁集，供持久化 / 索引层增量更新。 */
  let _mmDrag: any = null, _mmHitPos: { x: number; y: number } | null = null;
  const MM_CULL_N = 200;
  if (nodes.length > MM_CULL_N) wrap.classList.add('mm-many'); /* 节点极多 → 视口懒渲染 */
  function _mmChangedIds(id: any, oldP: any, newP: any) { const s = new Set(); if (id) s.add(id); if (oldP) s.add(oldP); if (newP) s.add(newP); return s; }
  function _mmCollectDesc(id: any) {
    const set = new Set([id]);
    (function walk(x: any) { const nn = deps.N(x); if (!nn) return; (nn.children || []).forEach((c: any) => { if (!set.has(c)) { set.add(c); walk(c); } }); })(id);
    return set;
  }
  function _mmHitInView(b: { cx: number; cy: number; hw: number; hh: number }) {
    const sc = _mmScale || 1, M = 40;
    const vl = (wrap.scrollLeft - M) / sc, vt = (wrap.scrollTop - M) / sc;
    const vr = (wrap.scrollLeft + wrap.clientWidth + M) / sc, vb = (wrap.scrollTop + wrap.clientHeight + M) / sc;
    return !(b.cx + b.hw < vl || b.cx - b.hw > vr || b.cy + b.hh < vt || b.cy - b.hh > vb);
  }
  function _mmHit(px: number, py: number) {
    const ex = _mmDrag && _mmDrag.exclude;
    const many = nodes.length > MM_CULL_N;
    for (const [id] of _mmEls) {
      if (ex && ex.has(id)) continue;
      const b = _mmBox(id); if (!b) continue;
      if (many && !_mmHitInView(b)) continue;
      if (px >= b.cx - b.hw && px <= b.cx + b.hw && py >= b.cy - b.hh && py <= b.cy + b.hh) return id;
    }
    return null;
  }
  function _mmSetDropTarget(id: any) {
    if (!_mmDrag) return;
    if (_mmDrag.drop === id) return;
    if (_mmDrag.drop) { const pe = _mmEls.get(_mmDrag.drop); if (pe) pe.classList.remove('drop-target'); }
    _mmDrag.drop = id || null;
    if (_mmDrag.drop) { const de = _mmEls.get(_mmDrag.drop); if (de) de.classList.add('drop-target'); }
  }
  function _mmQueueHit(x: number, y: number) { _mmHitPos = { x, y }; _mmSchedule(); }
  function _mmInView(pa: { x: number; y: number }, ca: { x: number; y: number }) {
    const sc = _mmScale || 1, M = 40;
    const vl = (wrap.scrollLeft - M) / sc, vt = (wrap.scrollTop - M) / sc;
    const vr = (wrap.scrollLeft + wrap.clientWidth + M) / sc, vb = (wrap.scrollTop + wrap.clientHeight + M) / sc;
    if ((pa.x < vl && ca.x < vl) || (pa.x > vr && ca.x > vr)) return false;
    if ((pa.y < vt && ca.y < vt) || (pa.y > vb && ca.y > vb)) return false;
    return true;
  }
  function _mmDrawEdge(it: { from: any; to: any; path: SVGPathElement }, cull: boolean) {
    const pb = _mmBox(it.from), cb = _mmBox(it.to);
    if (!pb || !cb) return;
    /* L22 · 清理 7：导图连线固定为「源节点右侧中点 → 目标节点左侧中点」的横向曲线。
       原 juBorderAnchor 求任意边界交点：父子节点垂直错位较大时锚点会落到上/下边框，连线出现折角与
       贴边穿行；固定左右中点后，连线恒从父节点右缘出发、汇入子节点左缘，形态稳定且与层级缩进一致。 */
    const pa = { x: pb.cx + pb.hw, y: pb.cy };
    const ca = { x: cb.cx - cb.hw, y: cb.cy };
    if (cull && !_mmInView(pa, ca)) return;
    const dx = Math.max(24, (ca.x - pa.x) / 2);
    it.path.setAttribute('d', `M${pa.x},${pa.y} C${pa.x + dx},${pa.y} ${ca.x - dx},${ca.y} ${ca.x},${ca.y}`);
  }
  function _mmFlush() {
    _mmRaf = 0;
    if (!_mmInit) { _mmInit = true; for (const it of _mmEdgeList) _mmDrawEdge(it, false); _mmDirty.clear(); }
    else if (_mmDirty.size) {
      const dirty = _mmDirty;
      for (const it of _mmEdgeList) { if (dirty.has(it.from) || dirty.has(it.to)) _mmDrawEdge(it, true); }
      dirty.clear();
    }
    if (_mmHitPos) { const p = _mmHitPos; _mmHitPos = null; if (_mmDrag && _mmDrag.dragging) _mmSetDropTarget(_mmHit(p.x, p.y)); }
  }
  function _mmSchedule() { if (!_mmRaf) _mmRaf = requestAnimationFrame(_mmFlush); }
  function _mmMark(id: any) { if (id) _mmDirty.add(id); _mmSchedule(); }
  try {
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(es => { for (const e of es) _mmMark((e.target as HTMLElement).dataset.mmId); });
      _mmRO = ro;
      _mmEls.forEach((elm, id) => { try { elm.dataset.mmId = String(id); ro.observe(elm); } catch(_e){console.warn('[JU] caught error',_e);} });
    }
  } catch(_e){console.warn('[JU] caught error',_e);}
  _mmSchedule(); /* 首帧建立外边框锚点 */
  let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
  const onMove = (e: MouseEvent) => { if (!dragging) return; wrap.scrollLeft = sl - (e.clientX - sx); wrap.scrollTop = st - (e.clientY - sy); };
  const onUp = () => { if (!dragging) return; dragging = false; wrap.style.cursor = 'grab'; document.body.style.userSelect = ''; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  wrap.addEventListener('mousedown', e => { if ((e.target as Element).closest('.mm-node') || (e.target as Element).closest('.doc-header')) return; dragging = true; sx = e.clientX; sy = e.clientY; sl = wrap.scrollLeft; st = wrap.scrollTop; wrap.style.cursor = 'grabbing'; document.body.style.userSelect = 'none'; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); }); /* FIX-R6-4: 标题上按下不再触发画布平移，不抢 contenteditable 编辑事件 */
  wrap.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const scale = _mmScale;
    const ns = Math.max(0.4, Math.min(2.5, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cx = (wrap.scrollLeft + mx) / scale;
    const cy = (wrap.scrollTop + my) / scale;
    _mmScale = ns;
    deps.ui.mmScale = ns;
    canvas.dataset.scale = String(ns);
    canvas.style.transform = 'scale(' + ns + ')';
    spacer.style.width = (width * ns) + 'px';
    spacer.style.height = (height * ns) + 'px';
    wrap.scrollLeft = cx * ns - mx;
    wrap.scrollTop = cy * ns - my;
    deps.saveUI();
  }, { passive: false });
  /* 【fix26-p1】移除「重置布局」按钮：该按钮仅在存在手动 mmX/mmY 时才有可见效果，
     常态下点击无任何重绘，且其绝对定位与标题行/星标争同一右上区 ⇒ 按缺陷单删除 DOM 与事件绑定。 */
  /* 【fix18-patch1】等效 resize 钩子：侧栏折叠/展开后 .mm-wrap 可用宽度变化，按新 clientWidth/Height
     重新把导图画布居中（布局世界坐标不变，只重置滚动位置；越界值钳 0，不产生负滚动 / 贴边）。 */
  const _mmCenter = () => { requestAnimationFrame(() => { wrap.scrollLeft = Math.max(0, (width * _mmScale - wrap.clientWidth) / 2); wrap.scrollTop = Math.max(0, (height * _mmScale - wrap.clientHeight) / 2); }); };
  wrap._recenter = _mmCenter;
  /* 指令10 · 视图回收：断开 ResizeObserver + 取消在途 rAF（防悬挂监听 / 内存泄漏） */
  wrap._cleanup = () => { try { if (_mmRO) _mmRO.disconnect(); } catch(_e){console.warn('[JU] caught error',_e);} _mmRO = null; if (_mmRaf) { cancelAnimationFrame(_mmRaf); _mmRaf = 0; } _mmDirty.clear(); _mmDrag = null; _mmHitPos = null; wrap._recenter = undefined; };
  _mmCenter();
  return wrap;
}
/* 源：v2.0-t3.html:19215-19261（思维导图 SVG 导出，与屏幕布局同源：字号缩放 + 动态节点高度） */
export function downloadMindmapSvg(doc: any): string {
  const { NW, NH, GX, GY } = mmLayoutConsts(); /* FIX-R9-3: 导出与屏幕布局同源（随字号缩放），导出与所见一致 */
  const layout = layoutMindmap(doc.id); /* FIX-DB-07: 与屏幕渲染共用同源布局（含动态节点高度） */
  const all = layout.nodes;
  if (!all.length) return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"></svg>';
  const rootNode = layout.rootNode as MindmapLayoutNode;
  const W = all.reduce((a, n) => Math.max(a, n.x), 0) + NW + 80;
  const H = all.reduce((a, n) => Math.max(a, n.y + n.h / 2), 0) + 80;
  const isNight = document.documentElement.dataset.theme === 'night';
  const bg = deps.themeColor('--mm-bg', '');
  const fg = deps.themeColor('--mm-fg', '');
  const nodeBg = deps.themeColor('--mm-node-bg', '');
  const nodeStroke = deps.themeColor('--mm-node-stroke', '');
  const rootBg = deps.themeColor('--mm-root-bg', '');
  const lineColor = deps.themeColor('--mm-line', '');
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="${bg}"/><style>text{font-family:"Noto Sans SC",sans-serif;font-size:12px;fill:${fg}}</style>`;
  (function edges(nd: MindmapLayoutNode) {
    nd.kids.forEach(k => {
      const p1x = nd.x + NW, p1y = nd.y, p2x = k.x, p2y = k.y, mx = (p1x + p2x) / 2;
      svg += `<path d="M${p1x},${p1y} C${mx},${p1y} ${mx},${p2y} ${p2x},${p2y}" fill="none" stroke="${lineColor}" stroke-width="1.5"/>`;
      edges(k);
    });
  })(rootNode);
  all.forEach(nd => {
    const n = deps.N(nd.id);
    const isRoot = nd.id === doc.id;
    const fill = isRoot ? rootBg : nodeBg;
    const stroke = isRoot ? rootBg : nodeStroke;
    const txt = String((isRoot ? stripHtml(doc.text) : (n ? stripHtml(n.text) : '')) || '');
    const h = nd.h || NH;
    /* FIX-DB-07: 导出同样不截断文本——按 16 字/行拆成多行，节点矩形高度随行数自适应 */
    const charsPerLine = 16;
    const lines: string[] = [];
    let cur = '';
    for (const ch of txt) { cur += ch; if (cur.length >= charsPerLine) { lines.push(cur); cur = ''; } }
    if (cur) lines.push(cur);
    if (!lines.length) lines.push('');
    svg += `<rect x="${nd.x}" y="${nd.y - h / 2}" width="${NW}" height="${h}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    const lineH = Math.round(18 * Math.max(0.8, deps.currentBaseFontPx() / 14));
    const startY = nd.y - (lines.length - 1) * lineH / 2 + 4;
    lines.forEach((ln, i) => {
      svg += `<text x="${nd.x + 11}" y="${startY + i * lineH}" fill="${isRoot ? '#fff' : fg}">${esc(ln)}</text>`;
    });
  });
  svg += '</svg>';
  return svg;
}
