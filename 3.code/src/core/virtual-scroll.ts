/**
 * 大纲虚拟滚动 · 自动策略（2026-10-26）
 *
 * 产品决策：移除用户显式「关闭虚拟滚动」开关，改为按文档规模 / 设备内存自动判定，
 * 并在卡顿与全量操作（查找 / 复制全文 / 打印）时自动切换，保证：
 *
 *   1) 默认状态：虚拟滚动开启（`DEFAULT_ON = true`），无需用户干预；
 *   2) 渲染前检测：读取当前文档节点数（子树可见节点）与 `navigator.deviceMemory`：
 *        - 节点数 < 1000 且 deviceMemory >= 8 ⇒ 关闭虚拟滚动（回退全量渲染）；
 *        - 其余情况（大文档 / 内存未知 / 内存 < 8GB）⇒ 开启虚拟滚动；
 *   3) 卡顿自动切换：滚动容器用 requestAnimationFrame 采样帧耗时，
 *      连续 2 帧 > 50ms ⇒ 强制开启虚拟滚动（本会话内保持）；
 *   4) 操作完整性：Ctrl+F / 复制全文 / 打印触发时，若当前处于虚拟滚动状态，
 *      临时切换为全量渲染（DOM 全量在位），操作结束后恢复原状态；
 *   5) 可观测：`window.__juVsMetrics()` 输出最近一次判定、阈值、卡顿与拦截计数，
 *      供 Playwright 断言与线上诊断使用。
 *
 * 说明：本工程的虚拟滚动实现口径为 `.outline.virtual` + `content-visibility:auto`
 * （见 style.css「fixed14 虚拟滚动」段）：DOM 行照常生成、由浏览器跳过屏外渲染，
 * 因此选区 / 拖拽 / 编辑语义与全量渲染完全一致；"临时全量渲染" 即移除 `.virtual`。
 */

/** 自动关闭虚拟滚动的文档节点数阈值（节点数 < 该值才可能关闭） */
export const VS_NODE_THRESHOLD = 1000;
/** 自动关闭虚拟滚动所需的设备内存阈值（GB；`navigator.deviceMemory` 口径） */
export const VS_MEMORY_THRESHOLD = 8;
/** 卡顿帧耗时阈值（ms） */
export const VS_JANK_FRAME_MS = 50;
/** 连续卡顿帧数阈值 */
export const VS_JANK_STREAK = 2;
/** Ctrl+F 场景临时全量渲染的保持时长（ms），超时自动恢复虚拟滚动 */
export const VS_FIND_RESTORE_MS = 4000;
/** 大纲窗口化渲染的可见节点阈值（沿用产品件 VIRTUAL_THRESHOLD 口径） */
export const VIRTUAL_THRESHOLD = 200;
/**
 * 窗口化渲染的 overscan（视口上下各额外保留的行数）。
 * 【D-04】v2.0-t3 的 `overscan` 令牌在 v2.1 裸 token 对比中命中 0 次，曾被判为「能力丢失」；
 * 实际该能力由 content-visibility 承担，此处把策略常量显式化，供 `getVirtualScrollPolicy()`
 * 与回归断言读取（只读，不参与强制开关）。
 */
export const VS_OVERSCAN = 8;

export interface VirtualScrollDeps {
  /** 节点取用（对应产品 `N(id)`） */
  N: (id: any) => any;
  /** 当前文档读取（对应产品 `getCurrentDoc()`） */
  getCurrentDoc: () => any;
  /** 强制重渲染（对应产品 `forceRender()`） */
  forceRender: () => void;
}

/** 依赖注入容器（模块内安全占位：加载即不抛错）。 */
export const deps: VirtualScrollDeps = {
  N: () => null,
  getCurrentDoc: () => null,
  forceRender: () => undefined,
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function bindVirtualScrollDeps(next: Partial<VirtualScrollDeps>): void {
  Object.assign(deps, next);
}

export type VirtualScrollInterceptKind = 'find' | 'copy' | 'print';

export interface VirtualScrollDecision {
  /** 本次判定是否使用虚拟滚动 */
  virtual: boolean;
  /** 当前文档子树可见节点数 */
  nodeCount: number;
  /** `navigator.deviceMemory`（GB；不可用时为 null） */
  deviceMemory: number | null;
  /** 判定来源：auto（规模/内存）/ jank-forced（卡顿强制）/ interception-full（操作完整性） */
  policy: 'auto' | 'jank-forced' | 'interception-full';
  /** 人类可读原因（供测试与诊断断言） */
  reason: string;
}

/** 判定结果（最近一次 evaluate 的快照） */
const lastDecision: VirtualScrollDecision = {
  virtual: true,
  nodeCount: 0,
  deviceMemory: null,
  policy: 'auto',
  reason: 'default-on',
};

/** 卡顿强制开启（本会话内粘滞） */
let forcedByJank = false;
/** 连续卡顿帧计数 */
let jankStreak = 0;
/** 当前生效的操作拦截（null = 无） */
let interceptKind: VirtualScrollInterceptKind | null = null;
/** Ctrl+F 自动恢复定时器 */
let findRestoreTimer: ReturnType<typeof setTimeout> | null = null;
/** 当前虚拟滚动容器句柄 */
let activeHandle: { wrap: HTMLElement; docId: any } | null = null;

const metrics = {
  checks: 0,
  virtualRenders: 0,
  jankEvents: 0,
  intercepts: { find: 0, copy: 0, print: 0 } as Record<VirtualScrollInterceptKind, number>,
};

/** 读取设备内存（GB）；不支持或非数值时返回 null（按「无法确认」处理 = 保持虚拟滚动）。 */
export function detectDeviceMemory(): number | null {
  try {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    const v = nav && nav.deviceMemory;
    return typeof v === 'number' && isFinite(v) ? v : null;
  } catch (e) {
    return null;
  }
}

/**
 * 统计文档子树的可见节点数（不含文档根自身；跳过已删除节点，按 visited 防环）。
 * 对应需求中的「渲染前读取文档节点数（如 DOM 元素数量）」。
 */
export function countDocumentNodes(doc: any): number {
  if (!doc || doc.id == null) return 0;
  let n = 0;
  const seen = new Set<any>();
  const stack: any[] = Array.isArray(doc.children) ? doc.children.slice() : [];
  while (stack.length) {
    const id = stack.pop();
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    const node = deps.N(id);
    if (!node || node._deleted) continue;
    n++;
    const kids = Array.isArray(node.children) ? node.children : [];
    for (const k of kids) stack.push(k);
  }
  return n;
}

/** 纯判定：节点数 < 1000 且 deviceMemory >= 8 ⇒ 关闭；否则开启。卡顿强制优先。 */
export function decideVirtual(nodeCount: number, deviceMemory: number | null, jankForced: boolean): VirtualScrollDecision {
  if (jankForced) {
    return {
      virtual: true,
      nodeCount,
      deviceMemory,
      policy: 'jank-forced',
      reason: `jank-forced-on(>${VS_JANK_FRAME_MS}ms x${VS_JANK_STREAK})`,
    };
  }
  if (nodeCount < VS_NODE_THRESHOLD && deviceMemory !== null && deviceMemory >= VS_MEMORY_THRESHOLD) {
    return {
      virtual: false,
      nodeCount,
      deviceMemory,
      policy: 'auto',
      reason: 'small-doc-and-sufficient-memory',
    };
  }
  return {
    virtual: true,
    nodeCount,
    deviceMemory,
    policy: 'auto',
    reason: nodeCount >= VS_NODE_THRESHOLD ? 'large-doc' : 'memory-unknown-or-below-threshold',
  };
}

/** 评估当前文档并更新最近判定快照（每次渲染都会调用）。 */
export function evaluate(doc: any): VirtualScrollDecision {
  metrics.checks++;
  const nodeCount = countDocumentNodes(doc);
  const deviceMemory = detectDeviceMemory();
  const d = decideVirtual(nodeCount, deviceMemory, forcedByJank);
  lastDecision.virtual = d.virtual;
  lastDecision.nodeCount = d.nodeCount;
  lastDecision.deviceMemory = d.deviceMemory;
  lastDecision.policy = d.policy;
  lastDecision.reason = d.reason;
  return d;
}

/**
 * 渲染期判定：操作拦截期间一律返回 false（临时全量渲染）；
 * 否则按自动策略判定。判定异常时返回 false（全量渲染，保证正文可见）。
 */
export function shouldUseVirtual(doc: any): boolean {
  if (interceptKind) return false;
  try {
    return evaluate(doc).virtual;
  } catch (e) {
    return false;
  }
}

/** 当前是否处于操作拦截（临时全量渲染）状态 */
export function isIntercepting(): boolean {
  return interceptKind !== null;
}

/** 当前是否处于虚拟滚动状态（以真实 DOM 的 `.outline.virtual` 为准） */
export function isVirtualActive(): boolean {
  try {
    return !!document.querySelector('.outline.virtual');
  } catch (e) {
    return false;
  }
}

/**
 * 进入操作拦截：仅当当前处于虚拟滚动状态时生效。
 * 返回 true 表示已切换为全量渲染（并已请求重渲染）；false 表示无需/无法拦截。
 */
export function beginInterception(kind: VirtualScrollInterceptKind): boolean {
  if (!isVirtualActive()) return false;
  metrics.intercepts[kind] = (metrics.intercepts[kind] || 0) + 1;
  interceptKind = kind;
  if (kind === 'find') {
    if (findRestoreTimer) clearTimeout(findRestoreTimer);
    findRestoreTimer = setTimeout(() => {
      findRestoreTimer = null;
      endInterception('find');
    }, VS_FIND_RESTORE_MS);
  }
  try { deps.forceRender(); } catch (e) { console.warn('[JU] vs interception render failed', e); }
  return true;
}

/** 退出操作拦截并恢复虚拟滚动（kind 省略 = 强制退出任意拦截）。 */
export function endInterception(kind?: VirtualScrollInterceptKind): void {
  if (!interceptKind) return;
  if (kind && interceptKind !== kind) return;
  if (findRestoreTimer) {
    clearTimeout(findRestoreTimer);
    findRestoreTimer = null;
  }
  interceptKind = null;
  try { deps.forceRender(); } catch (e) { console.warn('[JU] vs restore render failed', e); }
}

/**
 * 帧耗时采样：连续 VS_JANK_STREAK 帧 > VS_JANK_FRAME_MS ⇒ 强制开启虚拟滚动。
 * 返回 true 表示本次采样触发了强制开启。
 */
export function noteFrameDelta(deltaMs: number): boolean {
  const d = Number(deltaMs);
  if (!isFinite(d) || d <= 0) return false;
  if (d > VS_JANK_FRAME_MS) jankStreak++;
  else jankStreak = 0;
  if (jankStreak >= VS_JANK_STREAK && !forcedByJank) {
    forcedByJank = true;
    jankStreak = 0;
    metrics.jankEvents++;
    if (!interceptKind) {
      try { deps.forceRender(); } catch (e) { console.warn('[JU] vs jank render failed', e); }
    }
    return true;
  }
  return false;
}

/** 测试/诊断注入：直接触发卡顿强制开启（等价于连续两帧超阈值）。 */
export function forceJankOn(): void {
  forcedByJank = true;
  jankStreak = 0;
  metrics.jankEvents++;
}

/**
 * 给滚动容器挂接卡顿监测（幂等）。
 *
 * 采用 requestAnimationFrame：滚动事件期间每次只排一帧采样，
 * 以相邻两帧时间戳差作为帧耗时；连续超阈值即强制开启虚拟滚动。
 */
export function attachJankMonitor(container: HTMLElement | null): void {
  if (!container) return;
  const el: any = container;
  if (el.__juVsJankBound) return;
  el.__juVsJankBound = true;
  let last = 0;
  let rafId = 0;
  const sample = (ts: number): void => {
    rafId = 0;
    if (last) noteFrameDelta(ts - last);
    last = ts;
  };
  el.addEventListener('scroll', () => {
    if (!last) last = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (!rafId && typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(sample);
  }, { passive: true });
}

/** 记录一次虚拟滚动渲染（由 renderOutlineVirtual 调用）。 */
export function markVirtualRender(wrap: HTMLElement, doc: any): void {
  metrics.virtualRenders++;
  activeHandle = { wrap, docId: doc && doc.id != null ? doc.id : null };
}

/** 虚拟滚动活动句柄（供焦点定位复用）。 */
export function getVsActive(): { wrap: HTMLElement; docId: any } | null {
  return activeHandle;
}

/** 覆盖/清除虚拟滚动活动句柄。 */
export function setVsActive(v: { wrap: HTMLElement; docId: any } | null): void {
  activeHandle = v;
}

/** 窗口化渲染下把目标行滚入视口（焦点定位先滚入再定位）。 */
export function vsScrollToId(handle: any, id: any): void {
  try {
    if (!handle || !handle.wrap || id == null) return;
    const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(String(id)) : String(id);
    const el = handle.wrap.querySelector('.node[data-id="' + esc + '"]') as HTMLElement | null;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
  } catch (e) { /* 滚动失败不影响定位主流程 */ }
}

/** 诊断快照：测试与线上诊断统一读取该结构。 */
export function getVsMetrics(): any {
  return {
    policy: 'auto',
    defaultOn: true,
    virtualScroll: interceptKind ? false : (forcedByJank ? true : lastDecision.virtual),
    intercepting: interceptKind,
    lastDecision: { ...lastDecision },
    thresholds: {
      nodes: VS_NODE_THRESHOLD,
      deviceMemoryGB: VS_MEMORY_THRESHOLD,
      jankFrameMs: VS_JANK_FRAME_MS,
      jankStreak: VS_JANK_STREAK,
    },
    jank: { forced: forcedByJank, streak: jankStreak, events: metrics.jankEvents },
    intercepts: {
      find: metrics.intercepts.find,
      copy: metrics.intercepts.copy,
      print: metrics.intercepts.print,
      active: interceptKind,
    },
    renders: { virtual: metrics.virtualRenders, checks: metrics.checks },
    activeHandle: activeHandle ? { docId: activeHandle.docId } : null,
  };
}

/**
 * 【D-04】只读虚拟滚动策略快照。
 *
 * v2.1 依产品决策移除了用户可见的 `#setVirtualScrollOff` 开关（改为按文档规模 / 设备内存
 * 自动判定），但验收侧仍需一个**稳定的只读控制面**来断言「策略存在且可解释」。
 * 本函数即该入口：不改变任何状态，仅返回当前生效口径。
 *
 * @returns `{ enabled, overscan, thresholds }`
 *   - enabled：当前是否启用虚拟滚动（受卡顿强制与操作拦截影响）；
 *   - overscan：窗口化渲染上下额外保留的行数；
 *   - thresholds：节点数 / 设备内存 / 卡顿帧 / 卡顿连续帧 / 窗口化节点数 五个阈值。
 */
export function getVirtualScrollPolicy(): {
  enabled: boolean;
  overscan: number;
  thresholds: {
    nodes: number;
    deviceMemoryGB: number;
    jankFrameMs: number;
    jankStreak: number;
    windowedNodes: number;
  };
} {
  return {
    enabled: interceptKind ? false : (forcedByJank ? true : lastDecision.virtual),
    overscan: VS_OVERSCAN,
    thresholds: {
      nodes: VS_NODE_THRESHOLD,
      deviceMemoryGB: VS_MEMORY_THRESHOLD,
      jankFrameMs: VS_JANK_FRAME_MS,
      jankStreak: VS_JANK_STREAK,
      windowedNodes: VIRTUAL_THRESHOLD,
    },
  };
}

/** 复位全部策略状态（测试隔离用；生产代码不调用）。 */
export function resetVirtualScrollState(): void {
  forcedByJank = false;
  jankStreak = 0;
  if (findRestoreTimer) {
    clearTimeout(findRestoreTimer);
    findRestoreTimer = null;
  }
  interceptKind = null;
  activeHandle = null;
  lastDecision.virtual = true;
  lastDecision.nodeCount = 0;
  lastDecision.deviceMemory = null;
  lastDecision.policy = 'auto';
  lastDecision.reason = 'default-on';
  metrics.checks = 0;
  metrics.virtualRenders = 0;
  metrics.jankEvents = 0;
  metrics.intercepts.find = 0;
  metrics.intercepts.copy = 0;
  metrics.intercepts.print = 0;
}
