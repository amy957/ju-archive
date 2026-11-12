/**
 * M1-1 · 批次 Z · 图谱视图（Barnes-Hut Worker + GraphRenderer）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - Worker 源码：GRAPH_WORKER_SRC ..................................... 14557-14820
 *   - Worker URL / 客户端类：getGraphWorkerUrl / GraphLayoutWorker ....... 14821-14940
 *   - 单例：getGraphWorker .............................................. 14941-14945
 *   - 渲染器：GraphRenderer ............................................. 14946-15002
 *   - 渲染主函数：renderGraph（含 gEdges / gFlush / gMarkNode 等局部闭包） 15003-15280
 *   - 同步回退：runSyncGraphLayout ...................................... 15281-15348
 *   - 位置持久化（图谱专用子集）：_graphPositions / saveGraphPositions ... 2769-2788
 *
 * 约束：Worker 源码、DOM 结构、类名、内联样式、交互顺序与 FIX/批次注释逐字保留。
 *   未拆分业务符号统一走 `deps` 依赖注入容器（原直接引用改为 `deps.xxx`），由 src/main.ts 装配：
 *     state / ui / N / commit / isFolder / isBlankNode / renderViewTitle / saveUI / forceRender /
 *     errMsg / _graphPositions / saveGraphPositions / getGraphWorker。
 *   已拆分模块直接 import：stripHtml（core/utils）；juBorderAnchor（./mindmap，导图与图谱共用锚点算法）。
 */
import { stripHtml } from '../core/utils';
import { juBorderAnchor } from './mindmap';

/** 图谱节点位置（世界坐标 · localStorage `juju.graphpos` 口径）。 */
export interface GraphPosition {
  x: number;
  y: number;
}

/** 图谱节点 DOM（附加拖拽抑制标记，与产品件 `el._dragging` 同名）。 */
type GraphNodeEl = HTMLDivElement & { _dragging?: boolean };

/** 同步回退布局入参（与 Worker initLayout 消息体同构）。 */
export interface SyncGraphLayoutArgs {
  n: number;
  positions: Float32Array;
  edgeArr: Uint32Array;
  pinned: Uint8Array;
  pinnedPos: Float32Array;
  W: number;
  H: number;
  radii?: Float32Array;
}

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export interface GraphDeps {
  /** 全局数据状态（对应产品的 `state`，读 nodes / rootId） */
  state: any;
  /** 全局 UI 状态对象（对应产品的 `ui`，点击节点写入 currentDocId / view / focusId / activeKey） */
  ui: any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** 不可变提交（对应产品的 `commit`，本视图暂未写入，保留端口对齐） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** 文件夹判定（对应产品的 `isFolder(id)`） */
  isFolder: (id: any) => boolean;
  /** 空节点判定（对应产品的 `isBlankNode(n)`） */
  isBlankNode: (n: any) => boolean;
  /** 视图标题（对应产品的 `renderViewTitle(title)`） */
  renderViewTitle: (title: string) => HTMLElement;
  /** UI 状态持久化（对应产品的 `saveUI`） */
  saveUI: () => void;
  /** 请求下一次渲染（对应产品的 `forceRender`） */
  forceRender: () => void;
  /** 错误消息归一（对应产品的 `errMsg(e)`，Worker onerror 记录用） */
  errMsg: (e: any) => string;

  /* 图谱位置持久化（对应产品的 `_graphPositions` / `saveGraphPositions`，尚未拆分到 store 模块） */
  _graphPositions: Record<string, GraphPosition>;
  saveGraphPositions: () => void;

  /* Worker 单例（对应产品的 `getGraphWorker()`；默认指向本模块实现） */
  getGraphWorker: () => GraphLayoutWorker;
}

/* 源：v2.0-t3.html:2769-2788（图谱位置持久化 · 300ms 防抖 + pagehide flush；
   桌面端 scheduleDesktopSave 分支随持久化批次回填，本批次保留 localStorage 口径） */
const _localGraphPositions: Record<string, GraphPosition> = (() => {
  try { return JSON.parse(localStorage.getItem('juju.graphpos') || '{}') || {}; } catch (e) { return {}; }
})();
/* L16-W14 · 指令 5（Defect-G）：图拖拽结束时的同步 localStorage 写入属高频小卡顿来源
   （每次指针抬起 → JSON.stringify 全量位置表 + setItem 同步落盘）。改为 300ms 防抖：
   连续拖拽只落盘最后一次；关页（pagehide / beforeunload）由 flushGraphPositions() 强制 flush，
   保证「拖拽后 300ms 内落盘 + 关页不丢」两条验收口径同时成立。 */
let _graphPosTimer: any = null;
function saveGraphPositions(): void {
  if (_graphPosTimer) clearTimeout(_graphPosTimer);
  _graphPosTimer = setTimeout(flushGraphPositions, 300);
}
function flushGraphPositions(): void {
  if (_graphPosTimer) { clearTimeout(_graphPosTimer); _graphPosTimer = null; }
  try { localStorage.setItem('juju.graphpos', JSON.stringify(_localGraphPositions)); } catch(e){console.warn('[JU] caught error',e);}
}
if (typeof window !== 'undefined') {
  try { window.addEventListener('pagehide', flushGraphPositions); } catch(e){console.warn('[JU] caught error',e);}
}

/** 依赖注入容器（模块内安全占位：加载即不抛 ReferenceError）。 */
export const deps: GraphDeps = {
  state: { nodes: {}, rootId: null },
  ui: {},
  N: () => null,
  commit: () => undefined,
  isFolder: () => false,
  isBlankNode: () => false,
  renderViewTitle: (title: string) => { const el = document.createElement('div'); el.textContent = title; return el; },
  saveUI: () => undefined,
  forceRender: () => undefined,
  errMsg: (e: any) => String((e && e.message) || e || ''),

  _graphPositions: _localGraphPositions,
  saveGraphPositions,

  getGraphWorker: () => getGraphWorker(),
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function injectGraphDeps(next: Partial<GraphDeps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   图谱（Barnes-Hut Worker + GraphRenderer）
   ============================================================ */
export const GRAPH_WORKER_SRC = `
'use strict';
let S = null;
let _running = false;
let _paused = false;
let _resumeResolver = null;
let _yieldChannel = null;
let _yieldQueue = [];
function setupYieldChannel() {
  if (_yieldChannel) return;
  _yieldChannel = new MessageChannel();
  _yieldChannel.port1.onmessage = () => {
    const cb = _yieldQueue.shift();
    if (cb) cb();
  };
  try { _yieldChannel.port1.start(); } catch (e) { console.warn('[JU] yield channel start failed', e); }
}
function yieldNow() {
  setupYieldChannel();
  return new Promise((resolve) => {
    _yieldQueue.push(resolve);
    _yieldChannel.port2.postMessage(null);
  });
}
function waitForResume() {
  return new Promise((resolve) => { _resumeResolver = resolve; });
}
function doResume() {
  _paused = false;
  if (_resumeResolver) { const r = _resumeResolver; _resumeResolver = null; r(); }
}
self.onmessage = (e) => {
  const msg = e.data || {};
  switch (msg.type) {
    case 'init':         return handleInit(msg);
    case 'updatePinned': return handleUpdatePinned(msg);
    case 'cancel':       return handleCancel();
    case 'pause':        return (_paused = true);
    case 'resume':       doResume(); startIfNeeded(); return;
    case 'dispose':      S = null; _running = false; return;
  }
};
function startIfNeeded() {
  if (!S || _running) return;
  _running = true;
  const gen = S.currentClientGen;
  run(gen).then((positions) => {
    _running = false;
    if (!S) return;
    const changed = S.currentClientGen !== gen;
    self.postMessage({ type: 'done', clientGen: gen, positions }, [positions.buffer]);
    if (changed) startIfNeeded();
  }).catch((err) => {
    _running = false;
    console.warn('[worker] run failed', err);
  });
}
async function run(myGen) {
  const maxIter = S.maxIter;
  let lastYield = performance.now();
  for (let iter = 0; iter < maxIter; iter++) {
    if (_paused) await waitForResume();
    if (myGen !== S.currentClientGen) return S.positions.slice();
    computeForces();
    integrate();
    resolveCollisions(); /* FIX-DB-08: 每轮迭代后按节点半径做碰撞分离，保证最小间距 */
    const now = performance.now();
    if (now - lastYield > 8) { await yieldNow(); lastYield = performance.now(); }
    if (iter > 10 && totalKinetic() < 1e-3) break;
  }
  return S.positions.slice();
}
function computeForces() {
  const n = S.n, pos = S.positions, vel = S.velocities;
  for (let i = 0; i < vel.length; i++) vel[i] = 0;
  const tree = buildQuadTree();
  for (let i = 0; i < n; i++) {
    const x = pos[i * 2], y = pos[i * 2 + 1];
    const f = bhForce(tree, x, y, S.theta, S.eps2, i);
    vel[i * 2] += f.fx; vel[i * 2 + 1] += f.fy;
  }
  const edges = S.edges;
  for (let e = 0; e < edges.length; e += 2) {
    const a = edges[e], b = edges[e + 1];
    const ax = pos[a * 2], ay = pos[a * 2 + 1];
    const bx = pos[b * 2], by = pos[b * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - S.springLen) * S.springK;
    const fx = (dx / d) * f, fy = (dy / d) * f;
    vel[a * 2] += fx; vel[a * 2 + 1] += fy;
    vel[b * 2] -= fx; vel[b * 2 + 1] -= fy;
  }
  const cx = S.W / 2, cy = S.H / 2;
  for (let i = 0; i < n; i++) {
    if (S.pinned[i]) continue;
    vel[i * 2] += (cx - pos[i * 2]) * S.centerK;
    vel[i * 2 + 1] += (cy - pos[i * 2 + 1]) * S.centerK;
  }
}
function integrate() {
  const n = S.n, pos = S.positions, vel = S.velocities;
  for (let i = 0; i < n; i++) {
    if (S.pinned[i]) {
      pos[i * 2] = S.pinnedPos[i * 2];
      pos[i * 2 + 1] = S.pinnedPos[i * 2 + 1];
      vel[i * 2] = 0; vel[i * 2 + 1] = 0;
      continue;
    }
    vel[i * 2] *= 0.85; vel[i * 2 + 1] *= 0.85;
    pos[i * 2] += vel[i * 2];
    pos[i * 2 + 1] += vel[i * 2 + 1];
    if (pos[i * 2] < 40) pos[i * 2] = 40;
    if (pos[i * 2] > S.W - 40) pos[i * 2] = S.W - 40;
    if (pos[i * 2 + 1] < 40) pos[i * 2 + 1] = 40;
    if (pos[i * 2 + 1] > S.H - 40) pos[i * 2 + 1] = S.H - 40;
  }
}
/* FIX-DB-08: 碰撞分离——按节点半径推挤重叠对，pinned 节点不动，每轮 3 次迭代收敛 */
function resolveCollisions() {
  const pos = S.positions, n = S.n, radii = S.radii;
  if (!radii || !radii.length) return;
  const pad = 18;
  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[j * 2] - pos[i * 2];
        let dy = pos[j * 2 + 1] - pos[i * 2 + 1];
        let d = Math.sqrt(dx * dx + dy * dy) || 1;
        const min = radii[i] + radii[j] + pad;
        if (d < min) {
          const push = (min - d) / 2;
          const ux = dx / d, uy = dy / d;
          if (!S.pinned[i]) { pos[i * 2] -= ux * push; pos[i * 2 + 1] -= uy * push; }
          if (!S.pinned[j]) { pos[j * 2] += ux * push; pos[j * 2 + 1] += uy * push; }
        }
      }
    }
  }
}
function totalKinetic() {
  let sum = 0;
  for (let i = 0; i < S.velocities.length; i++) sum += S.velocities[i] * S.velocities[i];
  return sum;
}
function buildQuadTree() {
  const n = S.n, pos = S.positions;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 2], y = pos[i * 2 + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const size = Math.max(maxX - minX, maxY - minY, 1) * 1.1;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const nodes = [];
  function createNode(cx, cy, size) {
    nodes.push({ cx, cy, size, mass: 0, gx: 0, gy: 0, body: -1, children: null });
    return nodes.length - 1;
  }
  const root = createNode(cx, cy, size);
  const MAX_DEPTH = 20;
  function insert(nodeIdx, bodyIdx, depth) {
    if (depth > MAX_DEPTH) {
      const node = nodes[nodeIdx];
      if (node.body === -1) { node.body = bodyIdx; }
      return;
    }
    const node = nodes[nodeIdx];
    const m = node.mass;
    node.mass += 1;
    node.gx = (node.gx * m + pos[bodyIdx * 2]) / node.mass;
    node.gy = (node.gy * m + pos[bodyIdx * 2 + 1]) / node.mass;
    if (node.body === -1 && node.children === null) { node.body = bodyIdx; return; }
    if (node.children === null) {
      const half = node.size / 2;
      const q = node.size / 4;
      node.children = [
        createNode(node.cx - q, node.cy - q, half),
        createNode(node.cx + q, node.cy - q, half),
        createNode(node.cx - q, node.cy + q, half),
        createNode(node.cx + q, node.cy + q, half),
      ];
      const old = node.body;
      node.body = -1;
      insert(quadOf(node, old), old, depth + 1);
    }
    insert(quadOf(node, bodyIdx), bodyIdx, depth + 1);
  }
  function quadOf(node, bodyIdx) {
    const x = pos[bodyIdx * 2], y = pos[bodyIdx * 2 + 1];
    const right = x >= node.cx ? 1 : 0;
    const bottom = y >= node.cy ? 2 : 0;
    return node.children[right + bottom];
  }
  for (let i = 0; i < n; i++) insert(root, i, 0);
  return { nodes, root };
}
function bhForce(tree, x, y, theta, eps2, selfIdx) {
  let fx = 0, fy = 0;
  const stack = [tree.root];
  const nodes = tree.nodes;
  while (stack.length) {
    const node = nodes[stack.pop()];
    if (node.mass === 0) continue;
    const dx = x - node.gx, dy = y - node.gy;
    const d2 = dx * dx + dy * dy;
    if (d2 < eps2) {
      fx += (Math.random() - 0.5) * 0.5;
      fy += (Math.random() - 0.5) * 0.5;
      continue;
    }
    if (node.body !== -1) {
      if (node.body === selfIdx) continue;
      const f = S.repulsion / d2;
      const d = Math.sqrt(d2);
      fx += f * dx / d; fy += f * dy / d;
      continue;
    }
    if (node.size / Math.sqrt(d2) < theta) {
      const f = S.repulsion * node.mass / d2;
      const d = Math.sqrt(d2);
      fx += f * dx / d; fy += f * dy / d;
      continue;
    }
    for (let i = 0; i < node.children.length; i++) stack.push(node.children[i]);
  }
  return { fx, fy };
}
function handleInit(msg) {
  S = {
    n: msg.n, W: msg.W, H: msg.H,
    positions: new Float32Array(msg.positions),
    velocities: new Float32Array(msg.n * 2),
    edges: new Uint32Array(msg.edges),
    pinned: new Uint8Array(msg.pinned),
    pinnedPos: new Float32Array(msg.pinnedPos),
    theta: 0.7, repulsion: 20000, eps2: 100, /* FIX-DB-08: 增大斥力/软化奇异点，布局更疏朗 */
    springLen: 180, springK: 0.015, centerK: 0.008, /* FIX-DB-08: 弹簧更长、中心引力更弱 */
    maxIter: msg.iters || 80,
    radii: new Float32Array(msg.radii || []), /* FIX-DB-08: 主线程按文本长度估算的节点半径，供碰撞分离 */
    currentClientGen: msg.clientGen,
  };
  startIfNeeded();
}
function handleUpdatePinned(msg) {
  if (!S) return;
  if (msg.clientGen >= S.currentClientGen) S.currentClientGen = msg.clientGen;
  const n = S.n;
  for (let i = 0; i < n; i++) {
    S.pinned[i] = msg.pinned[i];
    if (msg.pinned[i]) {
      const x = msg.pinnedPos[i * 2];
      const y = msg.pinnedPos[i * 2 + 1];
      S.pinnedPos[i * 2] = x; S.pinnedPos[i * 2 + 1] = y;
      S.positions[i * 2] = x; S.positions[i * 2 + 1] = y;
      S.velocities[i * 2] = 0; S.velocities[i * 2 + 1] = 0;
    }
  }
  if (msg.iters) S.maxIter = msg.iters;
  startIfNeeded();
}
function handleCancel() { if (S) S.currentClientGen = -1; }
`;
let _graphWorkerUrl: string | null = null;
function getGraphWorkerUrl(): string {
  if (_graphWorkerUrl) return _graphWorkerUrl;
  const blob = new Blob([GRAPH_WORKER_SRC], { type: 'application/javascript' });
  _graphWorkerUrl = URL.createObjectURL(blob);
  return _graphWorkerUrl;
}
export class GraphLayoutWorker {
  worker: Worker | null;
  url: string | null;
  ready: boolean;
  clientGen: number;
  pending: any;
  constructor() {
    this.worker = null;
    this.url = null;
    this.ready = false;
    this.clientGen = 0;
    this.pending = null;
    this._init();
  }
  _init() {
    try {
      if (!window.Worker) throw new Error('no Worker');
      this.url = getGraphWorkerUrl();
      this.worker = new Worker(this.url);
      this.worker.onmessage = (e) => this._onMessage(e.data);
      this.worker.onerror = (e) => {
        console.warn('[graph-worker] error', deps.errMsg(e));
        this.ready = false;
        this._rejectPending(new Error('worker error'));
      };
      this.ready = true;
    } catch (e) {
      console.warn('[graph-worker] init failed', e);
      this.ready = false;
    }
  }
  _onMessage(msg: any) {
    if (!msg || msg.type !== 'done') return;
    if (msg.clientGen !== this.clientGen) return;
    if (!this.pending) return;
    const p = this.pending;
    this.pending = null;
    clearTimeout(p.timer);
    p.resolve(msg.positions);
  }
  _rejectPending(err: any) {
    if (!this.pending) return;
    const p = this.pending;
    this.pending = null;
    clearTimeout(p.timer);
    p.reject(err);
  }
  /* L17-W4 · P1-5：超时处理——gen 匹配（仍是当前请求）即判定 worker 卡死并 terminate 重建，
     不再等待连续 >=2 次（慢任务悬挂期间后续布局请求会被长期阻塞）。保留 URL revoke；
     下次 initLayout 经 getGraphWorker 重建。
     L18 · P3-2：单次超时即重建后连续超时计数已无判据作用，timeoutStrikes 声明 / 递增 / 清零一并退役。 */
  _timeoutHit(gen: number) {
    if (!this.pending || this.pending.gen !== gen) return;
    console.warn('[graph-worker] 超时，terminate 重建');
    this._rejectPending(new Error('timeout'));
    if (this.worker) { try { this.worker.terminate(); } catch(e){console.warn('[JU] caught error',e);} this.worker = null; }
    if (this.url) { try { URL.revokeObjectURL(this.url); } catch(e){console.warn('[JU] caught error',e);} this.url = null; }
    this.ready = false;
  }
  _send(payload: any, transfer?: any) {
    try { this.worker!.postMessage(payload, transfer || []); } catch (e) { console.warn('[JU] graph worker postMessage failed', e); } /* 【低3/fixed19】空 catch 补 warn，便于定位 */
  }
  initLayout({ n, positions, edges, pinned, pinnedPos, W, H, radii, iters }: { n: number; positions: Float32Array; edges: Uint32Array; pinned: Uint8Array; pinnedPos: Float32Array; W: number; H: number; radii?: Float32Array; iters?: number }) {
    if (!this.ready) return Promise.reject(new Error('not ready'));
    if (this.pending) this._rejectPending(new Error('superseded'));
    this.clientGen++;
    const gen = this.clientGen;
    const posCopy = new Float32Array(positions);
    const edgesCopy = new Uint32Array(edges);
    const pinnedCopy = new Uint8Array(pinned);
    const pinnedPosCopy = new Float32Array(pinnedPos);
    const radiiCopy = radii ? new Float32Array(radii) : new Float32Array(0); /* FIX-DB-08: 节点半径随布局传入 Worker */
    this._send({
      type: 'init', clientGen: gen, n, W, H, iters,
      positions: posCopy.buffer, edges: edgesCopy.buffer,
      pinned: pinnedCopy.buffer, pinnedPos: pinnedPosCopy.buffer,
      radii: radiiCopy.buffer,
    }, [posCopy.buffer, edgesCopy.buffer, pinnedCopy.buffer, pinnedPosCopy.buffer, radiiCopy.buffer]);
    return new Promise((resolve, reject) => {
      const timer: any = setTimeout(() => this._timeoutHit(gen), 8000); /* FIX-P2-2: 统一走 _timeoutHit（连续超时 terminate 重建） */
      this.pending = { resolve, reject, gen, timer };
    });
  }
  updatePinned({ pinned, pinnedPos, iters = 20 }: { pinned: Uint8Array; pinnedPos: Float32Array; iters?: number }) {
    if (!this.ready) return null;
    if (this.pending) this._rejectPending(new Error('superseded'));
    this.clientGen++;
    const gen = this.clientGen;
    const pinnedCopy = new Uint8Array(pinned);
    const pinnedPosCopy = new Float32Array(pinnedPos);
    this._send({
      type: 'updatePinned', clientGen: gen, iters,
      pinned: pinnedCopy.buffer, pinnedPos: pinnedPosCopy.buffer,
    }, [pinnedCopy.buffer, pinnedPosCopy.buffer]);
    return new Promise((resolve, reject) => {
      const timer: any = setTimeout(() => this._timeoutHit(gen), 4000); /* FIX-P2-2: 统一走 _timeoutHit（连续超时 terminate 重建） */
      this.pending = { resolve, reject, gen, timer };
    });
  }
  cancel() {
    if (this.ready) { this.clientGen++; this._send({ type: 'cancel' }); }
    this._rejectPending(new Error('cancelled'));
  }
  pause() { if (this.ready) this._send({ type: 'pause' }); }
  resume() { if (this.ready) this._send({ type: 'resume' }); }
  dispose() {
    if (this.worker) {
      try { this._send({ type: 'dispose' }); } catch(e){console.warn('[JU] caught error',e);}
      setTimeout(() => {
        try { this.worker!.terminate(); } catch(e){console.warn('[JU] caught error',e);}
        this.worker = null;
      }, 0);
    }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
    this.ready = false;
    this._rejectPending(new Error('disposed'));
  }
}
let _graphWorker: GraphLayoutWorker | null = null;
export function getGraphWorker(): GraphLayoutWorker {
  if (!_graphWorker) _graphWorker = new GraphLayoutWorker();
  return _graphWorker;
}
export class GraphRenderer {
  wrap: HTMLElement;
  docs: any[];
  nodeEls: Map<any, GraphNodeEl>;
  n: number;
  lastX: Float32Array;
  lastY: Float32Array;
  current: Float32Array | null;
  dirty: boolean;
  rafId: number | null;
  draggingIds: Set<any>;
  visible: { minX: number; maxX: number; minY: number; maxY: number };
  _visibleValid: boolean;
  constructor(wrap: HTMLElement, docs: any[], nodeEls: Map<any, GraphNodeEl>) {
    this.wrap = wrap; this.docs = docs; this.nodeEls = nodeEls; this.n = docs.length;
    this.lastX = new Float32Array(this.n).fill(NaN);
    this.lastY = new Float32Array(this.n).fill(NaN);
    this.current = null; this.dirty = false; this.rafId = null;
    this.draggingIds = new Set();
    this.visible = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    this._visibleValid = false;
  }
  setPositions(buf: any) {
    this.current = new Float32Array(buf);
    this.dirty = true;
    if (!this.rafId) this.rafId = requestAnimationFrame(() => this.flush());
  }
  setDraggingPosition(index: number, x: number, y: number) {
    this.lastX[index] = x; this.lastY[index] = y;
    const el = this.nodeEls.get(this.docs[index].id);
    if (el) el.style.transform = 'translate3d(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px, 0) translate(-50%, -50%)';
  }
  invalidateVisible() { this._visibleValid = false; }
  computeVisible() {
    if (this._visibleValid) return this.visible;
    const wrap = this.wrap;
    const sl = wrap.scrollLeft, st = wrap.scrollTop;
    const M = 60;
    this.visible = { minX: sl - M, maxX: sl + wrap.clientWidth + M, minY: st - M, maxY: st + wrap.clientHeight + M };
    this._visibleValid = true;
    return this.visible;
  }
  flush() {
    this.rafId = null;
    if (!this.dirty || !this.current) return;
    this.dirty = false;
    const n = this.n, cur = this.current, lastX = this.lastX, lastY = this.lastY;
    const vis = this.computeVisible();
    const dragging = this.draggingIds;
    for (let i = 0; i < n; i++) {
      const x = cur[i * 2], y = cur[i * 2 + 1];
      const id = this.docs[i].id;
      const isDragging = dragging.has(id);
      if (!isDragging && (x < vis.minX || x > vis.maxX || y < vis.minY || y > vis.maxY)) continue;
      const lx = lastX[i], ly = lastY[i];
      if (!isDragging && Math.abs(x - lx) < 0.5 && Math.abs(y - ly) < 0.5) continue;
      lastX[i] = x; lastY[i] = y;
      const el = this.nodeEls.get(id);
      if (!el) continue;
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px, 0) translate(-50%, -50%)';
    }
  }
  beginDrag(id: any) { this.draggingIds.add(id); const el = this.nodeEls.get(id); if (el) el.classList.add('dragging'); }
  endDrag(id: any) { this.draggingIds.delete(id); const el = this.nodeEls.get(id); if (el) el.classList.remove('dragging'); }
  dispose() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.dirty = false; this.current = null; this.draggingIds.clear();
  }
}
export function renderGraph(): HTMLElement {
  const wrap = document.createElement('div') as HTMLDivElement & { _renderer?: GraphRenderer; _cleanup?: () => void };
  wrap.className = 'graph-canvas';
  const gTitle = deps.renderViewTitle('知识图谱');
  /* 【fix26-p2】删除内联 padding / max-width 覆盖：标题行与横线宽度改由 .doc-header / .doc-header-line 全局口径决定（与大纲一致）；sticky 由全局规则承担 */
  wrap.appendChild(gTitle);
  const docs: any[] = [];
  for (const id in deps.state.nodes) {
    const n = deps.state.nodes[id];
    if (id === deps.state.rootId || deps.isFolder(id) || deps.isBlankNode(n) || n._deleted) continue;
    let p = n.parent, inCal = false, inNote = false; /* FIX-R63-P1：记事本（_isNoteRoot）子树与日历子树同口径，不计入知识图谱 */
    while (p && p !== deps.state.rootId) {
      const pn = deps.N(p); if (!pn) break;
      if (pn._isCalRoot) { inCal = true; break; }
      if (pn._isNoteRoot) { inNote = true; break; }
      p = pn.parent;
    }
    if (inCal || inNote) continue;
    docs.push(n);
  }
  if (!docs.length) {
    wrap.innerHTML = '<div class="empty-state">暂无可视化节点</div>';
    return wrap;
  }
  const MAX_NODES = 300;
  if (docs.length > MAX_NODES) {
    docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); /* FIX-L-23 截断前按 updatedAt 降序排序，保留最新文档，使截断确定性而非按 for-in 插入序任意取舍 */
    docs.length = MAX_NODES;
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;top:10px;left:10px;z-index:10;padding:4px 10px;border-radius:6px;background:var(--bg-panel);border:1px solid var(--line-soft);font-size:.78em;color:var(--fg-dim)';
    tip.textContent = '仅显示最近更新的 ' + MAX_NODES + ' 个节点';
    wrap.appendChild(tip);
  }
  /* 【fix18 · 图谱画布自适应容器】原口径 `W=max(800, innerWidth-400)` / `H=max(500, innerHeight-200)`
     与真实容器无关：1200×800 视口下画布 800px 宽，而容器 .graph-canvas 实测仅 720px
     （= #content 内容盒 760 - padding 20×2）⇒ 图谱内部产生 80px 横向滚动，右侧节点/连线被裁。
     改为按 #content 内容盒实测取值；读不到（未挂载 / 0 宽）时回退旧口径，保证无回归。 */
  const _host = document.getElementById('content');
  let _availW = 0, _availH = 0;
  if (_host) {
    const _hs = getComputedStyle(_host);
    _availW = _host.clientWidth - (parseFloat(_hs.paddingLeft) || 0) - (parseFloat(_hs.paddingRight) || 0);
    _availH = _host.clientHeight - (parseFloat(_hs.paddingTop) || 0) - (parseFloat(_hs.paddingBottom) || 0);
  }
  const W = Math.max(320, Math.round(_availW > 0 ? _availW : Math.max(800, window.innerWidth - 400)));
  const H = Math.max(320, Math.round(_availH > 0 ? _availH : Math.max(500, window.innerHeight - 200)));
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.35;
  const n = docs.length;
  const positions = new Float32Array(n * 2);
  docs.forEach((doc, i) => {
    const a = (i / n) * Math.PI * 2;
    positions[i * 2] = cx + Math.cos(a) * R;
    positions[i * 2 + 1] = cy + Math.sin(a) * R;
  });
  const idIndex = new Map<any, number>(docs.map((d, i) => [d.id, i] as [any, number]));
  const byTitle: Record<string, { id: any; up: number }> = {};
  docs.forEach(d => { const t = stripHtml(d.text || '').trim(); if (!t) return; const up = d.updatedAt || 0; const cur = byTitle[t]; if (!cur || up > cur.up) byTitle[t] = { id: d.id, up: up }; }); /* FIX-L-10 同标题记录 updatedAt 更大(最近更新)的节点 id，使 wiki 链接指向最新内容，而非首个插入者 */
  const edges: { from: any; to: any }[] = [];
  docs.forEach(d => {
    const raw = stripHtml(d.text || '');
    const re = /\[\[([^\]]+)\]\]/g; let m;
    while ((m = re.exec(raw)) !== null) {
      const hit = byTitle[m[1].trim()]; const tid = hit ? hit.id : null;
      if (tid && tid !== d.id) edges.push({ from: d.id, to: tid });
    }
  });
  const edgeArr = new Uint32Array(edges.length * 2);
  edges.forEach((e, i) => {
    edgeArr[i * 2] = idIndex.get(e.from)!;
    edgeArr[i * 2 + 1] = idIndex.get(e.to)!;
  });
  const pinned = new Uint8Array(n);
  const pinnedPos = new Float32Array(n * 2);
  docs.forEach((doc, i) => {
    const p = deps._graphPositions[doc.id];
    if (p) { pinned[i] = 1; pinnedPos[i * 2] = p.x; pinnedPos[i * 2 + 1] = p.y; }
  });
  /* FIX-DB-08: 按文本长度估算节点半径（宽 70~180px），传给 Worker 做碰撞分离 */
  const radii = new Float32Array(n);
  docs.forEach((doc, i) => {
    const text = stripHtml(doc.text) || '未命名';
    const w = Math.min(180, Math.max(70, text.length * 8 + 24));
    radii[i] = w / 2 + 8;
  });
  const nodeEls = new Map<any, GraphNodeEl>();
  docs.forEach((doc, i) => {
    const el = document.createElement('div') as GraphNodeEl;
    el.className = 'graph-node';
    el.dataset.id = String(doc.id);
    el.textContent = stripHtml(doc.text) || '未命名'; /* FIX-DB-08: 不再硬截断 14 字，文本按 max-width 自动换行 */
    el.title = stripHtml(doc.text);
    const x = positions[i * 2], y = positions[i * 2 + 1];
    el.style.transform = 'translate3d(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px, 0) translate(-50%, -50%)';
    el.style.zIndex = '1'; /* 指令10 · 节点层高于连线层（svg z-index=0），连线不压文字 */
    wrap.appendChild(el);
    nodeEls.set(doc.id, el);
  });
  const renderer = new GraphRenderer(wrap, docs, nodeEls);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'graph-svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none';
  svg.style.zIndex = '0'; /* 指令10 · 连线层置底：节点 z-index=1（见节点创建），连线不压文字 */
  const lineColor = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  const G_PAD = 3;
  /* 指令10 · 图谱连线锚点（核心）--------------------------------------------------
     连线端点取「节点最外层容器外边框盒（Border Box）」上、朝向对端中心的最近交点；
     节点自带 padding，锚点落在边框 + 外扩 G_PAD → 绝不连到文字或节点中心。
     中心：位置数组（renderer.lastX/lastY 优先，否则初始 positions）；
     半宽高：ResizeObserver 供出 / 缺失时于 rAF 内以 getBoundingClientRect 节流测量（G-2）。
     重绘走 changedIds 增量补丁（仅 dirty 节点关联连线）；节点极多时走视口裁剪（G-5）。 */
  const gEdges: { line: SVGLineElement; ia: number; ib: number; aId: any; bId: any }[] = [];
  edges.forEach(e => {
    const ia = idIndex.get(e.from)!, ib = idIndex.get(e.to)!;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(positions[ia * 2])); line.setAttribute('y1', String(positions[ia * 2 + 1])); /* 骨架：中心线兜底，不空白 */
    line.setAttribute('x2', String(positions[ib * 2])); line.setAttribute('y2', String(positions[ib * 2 + 1]));
    line.setAttribute('stroke', lineColor); line.setAttribute('stroke-width', '1.5');
    line.setAttribute('opacity', '0.6');
    line.dataset.a = String(ia); line.dataset.b = String(ib);
    svg.appendChild(line);
    gEdges.push({ line, ia, ib, aId: docs[ia].id, bId: docs[ib].id });
  });
  wrap.appendChild(svg);
  const gSize = new Map<any, { hw: number; hh: number }>();       /* id -> {hw,hh} 外边框盒半宽/半高 */
  const gDirtyEdges = new Set<any>(); /* 待重绘连线（changedIds 增量补丁） */
  const gDirtyNodes = new Set<any>(); /* 尺寸变化节点（ResizeObserver） */
  const gCulled = new Set<any>();     /* 被视口裁剪的连线（滚动时重估） */
  let gRaf = 0, gRO: ResizeObserver | null = null, gInit = false;
  const gCenter = (i: number) => {
    const lx = renderer.lastX[i], ly = renderer.lastY[i];
    return { x: isNaN(lx) ? positions[i * 2] : lx, y: isNaN(ly) ? positions[i * 2 + 1] : ly };
  };
  const gMeasure = (id: any) => { /* 仅在 rAF 内对 dirty 节点调用 getBoundingClientRect（避免布局抖动） */
    const el = nodeEls.get(id); if (!el) return null;
    const r = (el.getBoundingClientRect && el.getBoundingClientRect());
    const w = r && r.width ? r.width : (el.offsetWidth || 0), h = r && r.height ? r.height : (el.offsetHeight || 0);
    if (!w || !h) return null;
    const b = { hw: w / 2, hh: h / 2 }; gSize.set(id, b); return b;
  };
  const gInView = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const vis = renderer.computeVisible(), M = 40;
    if ((p1.x < vis.minX - M && p2.x < vis.minX - M) || (p1.x > vis.maxX + M && p2.x > vis.maxX + M)) return false;
    if ((p1.y < vis.minY - M && p2.y < vis.minY - M) || (p1.y > vis.maxY + M && p2.y > vis.maxY + M)) return false;
    return true;
  };
  const gDrawEdge = (ge: any, cull: boolean) => {
    const c1 = gCenter(ge.ia), c2 = gCenter(ge.ib);
    const s1 = gSize.get(ge.aId) || gMeasure(ge.aId), s2 = gSize.get(ge.bId) || gMeasure(ge.bId);
    if (!s1 || !s2) return;
    const p1 = juBorderAnchor(c1.x, c1.y, s1.hw, s1.hh, c2.x, c2.y, G_PAD);
    const p2 = juBorderAnchor(c2.x, c2.y, s2.hw, s2.hh, c1.x, c1.y, G_PAD);
    if (cull && !gInView(p1, p2)) { gCulled.add(ge); return; }
    gCulled.delete(ge);
    ge.line.setAttribute('x1', String(p1.x)); ge.line.setAttribute('y1', String(p1.y));
    ge.line.setAttribute('x2', String(p2.x)); ge.line.setAttribute('y2', String(p2.y));
  };
  const gFlush = () => {
    gRaf = 0;
    if (!gInit) { gInit = true; for (const ge of gEdges) gDrawEdge(ge, false); gDirtyEdges.clear(); gDirtyNodes.clear(); return; }
    if (gDirtyNodes.size) {
      for (const id of gDirtyNodes) gSize.delete(id); /* 失效尺寸缓存 → 节流重测 */
      for (const ge of gEdges) { if (gDirtyNodes.has(ge.aId) || gDirtyNodes.has(ge.bId)) gDirtyEdges.add(ge); }
      gDirtyNodes.clear();
    }
    if (!gDirtyEdges.size) return;
    for (const ge of gDirtyEdges) gDrawEdge(ge, true);
    gDirtyEdges.clear();
  };
  const gSchedule = () => { if (!gRaf) gRaf = requestAnimationFrame(gFlush); };
  const gMarkNode = (id: any) => { if (!id) return; for (const ge of gEdges) { if (ge.aId === id || ge.bId === id) gDirtyEdges.add(ge); } gSchedule(); };
  /* 兼容既有位置驱动入口：布局收敛 / Worker 回填 → 全部连线入脏并单 rAF 重绘（一次性） */
  const updateLines = () => { for (const ge of gEdges) gDirtyEdges.add(ge); gSchedule(); };
  /* ResizeObserver：文字换行撑高容器 → 关联连线实时重绘（G-1 / G-2），单 rAF 节流 */
  try {
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(es => { for (const e of es) { const id = (e.target as HTMLElement).dataset.id; if (id) gDirtyNodes.add(id); } if (gDirtyNodes.size) gSchedule(); });
      gRO = ro;
      nodeEls.forEach((elm, id) => { try { ro.observe(elm); } catch(_e){console.warn('[JU] caught error',_e);} });
    }
  } catch(_e){console.warn('[JU] caught error',_e);}
  gSchedule(); /* 首帧建立外边框锚点 */
  const onScroll = () => {
    renderer.invalidateVisible();
    if (gCulled.size) { for (const ge of gCulled) gDirtyEdges.add(ge); gSchedule(); } /* 视口变化：仅重估被裁剪连线 */
    if (renderer.current) {
      renderer.dirty = true;
      if (!renderer.rafId) renderer.rafId = requestAnimationFrame(() => renderer.flush());
    }
  };
  wrap.addEventListener('scroll', onScroll, { passive: true });
  const onResize = () => renderer.invalidateVisible();
  window.addEventListener('resize', onResize);
  docs.forEach((doc, i) => {
    const el = nodeEls.get(doc.id)!;
    el.addEventListener('click', () => {
      if (el._dragging) return;
      deps.ui.currentDocId = doc.id;
      deps.ui.view = 'auto';
      deps.ui.focusId = doc.id;
      deps.ui.activeKey = 'node:' + doc.id;
      deps.saveUI(); deps.forceRender();
    });
  });
  let dragId: any = null, dragIdx: any = -1;
  wrap.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element).closest('.graph-node') as GraphNodeEl | null;
    if (!el || e.button !== 0) return;
    dragId = el.dataset.id;
    dragIdx = idIndex.get(dragId);
    if (dragIdx == null) return;
    renderer.beginDrag(dragId);
    try { el.setPointerCapture(e.pointerId); } catch(err){console.warn('[JU] caught error',err);}
    e.preventDefault();
  });
  const onMove = (e: PointerEvent) => {
    if (!dragId) return;
    const wrapR = wrap.getBoundingClientRect();
    const x = e.clientX - wrapR.left + wrap.scrollLeft;
    const y = e.clientY - wrapR.top + wrap.scrollTop;
    renderer.setDraggingPosition(dragIdx, x, y);
    const el = nodeEls.get(dragId);
    if (el) el._dragging = true;
    gMarkNode(dragId); /* 指令10 · 拖拽节流：仅重算该节点关联连线，单 rAF 合并多次 pointermove */
  };
  const onUp = () => {
    if (!dragId) return;
    const el = nodeEls.get(dragId);
    renderer.endDrag(dragId);
    const x = renderer.lastX[dragIdx], y = renderer.lastY[dragIdx];
    renderer.lastX[dragIdx] = NaN;
    renderer.lastY[dragIdx] = NaN;
    const curDoc = (dragIdx >= 0 && dragIdx < docs.length) ? docs[dragIdx] : null;
    dragId = null; dragIdx = -1;
    if (el) setTimeout(() => { el._dragging = false; }, 50);
    if (!curDoc || isNaN(x) || isNaN(y)) return;
    deps._graphPositions[curDoc.id] = { x, y };
    deps.saveGraphPositions();
    const worker = deps.getGraphWorker();
    if (worker.ready) {
      const np = new Uint8Array(n);
      const npp = new Float32Array(n * 2);
      docs.forEach((doc, i) => {
        const p = deps._graphPositions[doc.id];
        if (p) { np[i] = 1; npp[i * 2] = p.x; npp[i * 2 + 1] = p.y; }
      });
      const pr = worker.updatePinned({ pinned: np, pinnedPos: npp, iters: 20 });
      if (pr) pr.then((buf: any) => { if (buf) { renderer.setPositions(buf); setTimeout(updateLines, 20); } }).catch(() => { });
    }
  };
  wrap.addEventListener('pointermove', onMove);
  wrap.addEventListener('pointerup', onUp);
  wrap.addEventListener('pointercancel', onUp);
  const worker = deps.getGraphWorker();
  if (worker.ready) {
    worker.initLayout({
      n, positions, edges: edgeArr, pinned, pinnedPos, W, H, radii, /* FIX-DB-08: 传入节点半径供碰撞分离 */
      iters: n <= 80 ? 150 : n <= 300 ? 80 : 40,
    }).then((buf: any) => {
      renderer.setPositions(buf);
      setTimeout(updateLines, 20);
    }).catch((err: any) => {
      if (err && err.message === 'superseded') return;
      runSyncGraphLayout({ n, positions, edgeArr, pinned, pinnedPos, W, H, radii });
      renderer.setPositions(positions.buffer);
      updateLines();
    });
  } else {
    runSyncGraphLayout({ n, positions, edgeArr, pinned, pinnedPos, W, H, radii });
    renderer.setPositions(positions.buffer);
    updateLines();
  }
  wrap._renderer = renderer;
  wrap._cleanup = () => {
    wrap.removeEventListener('scroll', onScroll);
    wrap.removeEventListener('pointermove', onMove);
    wrap.removeEventListener('pointerup', onUp);
    wrap.removeEventListener('pointercancel', onUp);
    window.removeEventListener('resize', onResize);
    if (gRaf) { cancelAnimationFrame(gRaf); gRaf = 0; }
    try { if (gRO) gRO.disconnect(); } catch(_e){console.warn('[JU] caught error',_e);}
    gRO = null; gCulled.clear(); gDirtyEdges.clear(); gDirtyNodes.clear();
    renderer.dispose();
    const w = deps.getGraphWorker();
    if (w.ready) w.cancel();
  };
  return wrap;
}
export function runSyncGraphLayout({ n, positions, edgeArr, pinned, pinnedPos, W, H, radii }: SyncGraphLayoutArgs): void {
  const MAX_ITER = n > 300 ? 40 : (n > 80 ? 80 : 150);
  const vel = new Float32Array(n * 2);
  const REP = 20000, EPS2 = 100, SPR = 0.015, SPRLEN = 180, CEN = 0.008; /* FIX-DB-08: 与 Worker 参数对齐（更疏朗） */
  const PAD = 18;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    for (let i = 0; i < vel.length; i++) vel[i] = 0;
    /* FIX-M-26 斥力环阈值由 n<400 收紧为 n<=150：n=399 时内层 j 从 i+1 起约 7.96 万对 × MAX_ITER=40 ≈ 318 万次迭代阻塞主线程；
       n>150 时跳过 O(n²) 斥力，仅保留弹簧/中心力/边界约束与 MAX_ITER 自适应（n>300→40, n>80→80, else 150），消除百万级同步迭代 */
    if (n <= 150) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = positions[i * 2] - positions[j * 2];
          let dy = positions[i * 2 + 1] - positions[j * 2 + 1];
          let d2 = dx * dx + dy * dy;
          if (d2 < EPS2) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = EPS2; }
          const d = Math.sqrt(d2);
          const f = REP / d2;
          vel[i * 2] += (dx / d) * f; vel[i * 2 + 1] += (dy / d) * f;
          vel[j * 2] -= (dx / d) * f; vel[j * 2 + 1] -= (dy / d) * f;
        }
      }
    }
    for (let e = 0; e < edgeArr.length; e += 2) {
      const a = edgeArr[e], b = edgeArr[e + 1];
      const dx = positions[b * 2] - positions[a * 2];
      const dy = positions[b * 2 + 1] - positions[a * 2 + 1];
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - SPRLEN) * SPR;
      vel[a * 2] += (dx / d) * f; vel[a * 2 + 1] += (dy / d) * f;
      vel[b * 2] -= (dx / d) * f; vel[b * 2 + 1] -= (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      if (pinned[i]) {
        positions[i * 2] = pinnedPos[i * 2];
        positions[i * 2 + 1] = pinnedPos[i * 2 + 1];
        vel[i * 2] = 0; vel[i * 2 + 1] = 0;
        continue;
      }
      vel[i * 2] += (W / 2 - positions[i * 2]) * CEN;
      vel[i * 2 + 1] += (H / 2 - positions[i * 2 + 1]) * CEN;
      vel[i * 2] *= 0.85; vel[i * 2 + 1] *= 0.85;
      positions[i * 2] += vel[i * 2];
      positions[i * 2 + 1] += vel[i * 2 + 1];
      if (positions[i * 2] < 40) positions[i * 2] = 40;
      if (positions[i * 2] > W - 40) positions[i * 2] = W - 40;
      if (positions[i * 2 + 1] < 40) positions[i * 2 + 1] = 40;
      if (positions[i * 2 + 1] > H - 40) positions[i * 2 + 1] = H - 40;
    }
    /* FIX-DB-08: 同步回退路径同样做碰撞分离（与 Worker 一致），保证最小间距 */
    if (radii && radii.length) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = positions[j * 2] - positions[i * 2];
          let dy = positions[j * 2 + 1] - positions[i * 2 + 1];
          let d = Math.sqrt(dx * dx + dy * dy) || 1;
          const min = radii[i] + radii[j] + PAD;
          if (d < min) {
            const push = (min - d) / 2;
            const ux = dx / d, uy = dy / d;
            if (!pinned[i]) { positions[i * 2] -= ux * push; positions[i * 2 + 1] -= uy * push; }
            if (!pinned[j]) { positions[j * 2] += ux * push; positions[j * 2 + 1] += uy * push; }
          }
        }
      }
    }
  }
}
