/**
 * fix7 · 字数统计（charStats）token 化引擎
 *
 * 背景（P0 取证：90过程材料/tmp/fix7/wordcount_before.log，末行 WORDCOUNT_VERDICT: H3(统计不准)）：
 *   旧实现把 `stripHtml(new).length - stripHtml(old).length`（**字符长度差**）直接塞进
 *   `charStats[ds].mod`，于是
 *     ① 新输入全部记成「修改」，新增恒为 0；
 *     ② 删字得到负的「修改」；
 *     ③ 面板「净变化」按 add - del + mod 求和，把修改重复计一次（实测 20 - 0 + 18 = 38，
 *        而真实新增只有 18 个字符）。
 *   本模块用 token 级差分替换字符长度差，并把四象限口径（A/R/M/N）落到 charStats。
 *
 * 口径（《精简完整方案》）：
 *   tokenize：中文/日文/韩文按字素簇 1 token；英文连续字母数字串按词 1 token；
 *             空白 / 标点 / emoji 每个字素簇 1 token（见 core/wordcount.worker）。
 *   单次编辑：I = 插入 token 数，D = 删除 token 数；
 *             M = min(I, D)，A = I - M，R = D - M，N = I - D；
 *             `charStats[ds]` 的 add/del/mod 分别累加 A/R/M，并累加 `net`（净变化 = N）。
 *   运行中增量：编辑 → 500ms 批次合并（同一节点多次编辑只留首尾）→ tokenDiff → 累加。
 *   退出校准：以「当日基线快照」（charBaseline[ds][nodeId] = 首次触碰前的 token 数）为准，
 *             退出 / 进后台时对全部基线节点重算 I/D 并**覆盖**当日桶（绝不累加）；
 *             来不及则置 `pendingCalibration`，下次启动优先校准。
 *   持久化：统计改动走 `commit({ silent, light })` → scheduleNotify → schedulePersist（300ms 写合并），
 *           绝不逐键写盘；面板重绘由渲染调度合并，另有 1s 节流门限（`uiTick`）。
 *
 * 约束：本模块不直接读 window / localStorage，全部经注入端口，保证可单测、可装配。
 */

import { stripHtml, todayStr } from './utils';
import { tokenDiff, countTokens, type TokenDiffResult } from './wordcount.worker';
/* 内联 Worker 构造器（与 core/store 同款）：单 HTML 产物约束下 Worker 以 blob 内联进 bundle */
import TokenDiffWorkerFactory from './wordcount.worker?worker&inline';

/** 写入 charStats 的端口集合 */
export interface CharStatsDeps {
  /** 活状态读取（core/store.getState） */
  getState: () => any;
  /** 不可变提交（core/persist.commit） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** 渲染通知调度（core/store.scheduleNotify） */
  scheduleNotify: () => void;
  /** 落盘调度（core/persist.schedulePersist） */
  schedulePersist: () => void;
  /** 超过该纯文本长度改走 Worker（默认 20,000 字符） */
  threshold?: number;
  /** 批次合并窗口（默认 500ms） */
  debounceMs?: number;
  /** 面板刷新节流（默认 1000ms） */
  uiThrottleMs?: number;
}

/** 依赖容器（未注入时全 noop：模块可被安全 import） */
export const deps: CharStatsDeps = {
  getState: () => null,
  commit: () => undefined,
  scheduleNotify: () => undefined,
  schedulePersist: () => undefined,
  threshold: 20000,
  debounceMs: 500,
  uiThrottleMs: 1000,
};

/** 注入/覆盖依赖（局部覆盖） */
export function injectCharStatsDeps(next: Partial<CharStatsDeps>): void {
  Object.assign(deps, next);
}

/** 提交选项：不拍撤销步、不触发文本索引重建（与 actions.logActivity 同口径） */
const COMMIT_OPTS = { silent: true, light: true, dirtyText: false, dirtyDocs: null };

/* ====================================================================
 * 内部状态（模块级，进程内单例；不持久化，持久化的是 state.charStats / charBaseline）
 * ==================================================================== */
/** 待合并批次：nodeId → { 本轮第一次编辑前的 HTML, 本轮最后一次编辑后的 HTML } */
const _pending = new Map<string, { oldHtml: string; newHtml: string }>();
let _timer: any = null;
/** 大文本异步差分：独立 Worker（懒创建） */
let _worker: Worker | null = null;
let _rid = 0;
const _inflight = new Map<number, { id: string; ds: string; before: number }>();
/** 面板刷新节流门限 */
let _uiLast = 0;

function now(): number {
  return Date.now();
}

/** 取当日桶（不存在则建） */
function bucketOf(s: any, ds: string): any {
  if (!s.charStats || typeof s.charStats !== 'object') s.charStats = {};
  let b = s.charStats[ds];
  if (!b || typeof b !== 'object') { b = { add: 0, del: 0, mod: 0, net: 0 }; s.charStats[ds] = b; }
  return b;
}

/** 记录当日基线（首次触碰该节点前的 token 数；只写一次） */
function recordBaseline(s: any, ds: string, id: string, tokensBefore: number): void {
  if (!id) return;
  if (!s.charBaseline || typeof s.charBaseline !== 'object') s.charBaseline = {};
  let day = s.charBaseline[ds];
  if (!day || typeof day !== 'object') { day = {}; s.charBaseline[ds] = day; }
  if (!Object.prototype.hasOwnProperty.call(day, id)) day[id] = Math.max(0, tokensBefore | 0);
}

/** 把一次差分累加进当日桶（A/R/M/N 四象限；net 独立累计，供面板「净变化」直读） */
function applyDiff(s: any, ds: string, I: number, D: number): void {
  if (!(I > 0) && !(D > 0)) return;
  const M = Math.min(I, D);
  const A = I - M;
  const R = D - M;
  const N = I - D;
  const b = bucketOf(s, ds);
  const prevNet = (typeof b.net === 'number' && isFinite(b.net)) ? (b.net | 0) : ((b.add | 0) - (b.del | 0));
  b.add = (b.add | 0) + A;
  b.del = (b.del | 0) + R;
  b.mod = (b.mod | 0) + M;
  b.net = prevNet + N;
  s.charStatsRev = (s.charStatsRev | 0) + 1;
}

/** 用一次差分**覆盖**当日桶（退出校准专用：绝不累加） */
function setBucket(s: any, ds: string, I: number, D: number): void {
  const M = Math.min(I, D);
  const b = bucketOf(s, ds);
  b.add = I - M;
  b.del = D - M;
  b.mod = M;
  b.net = I - D;
  s.charStatsRev = (s.charStatsRev | 0) + 1;
}

/** 面板刷新节流：1s 内只放行一次（渲染调度本身还有 rAF 合并） */
function uiTick(): void {
  const t = now();
  const gate = typeof deps.uiThrottleMs === 'number' ? deps.uiThrottleMs : 1000;
  if (t - _uiLast < gate) return;
  _uiLast = t;
  try { deps.scheduleNotify(); } catch (e) { /* 渲染调度不可用时不阻断统计 */ }
}

/** 大文本差分 Worker（懒创建；创建失败回落到主线程同步） */
function ensureWorker(): Worker | null {
  if (_worker) return _worker;
  if (typeof Worker === 'undefined') return null;
  try {
    /* vite `?worker&inline` 导出的是 Worker 构造类（与 core/store 同款用法） */
    const w = new TokenDiffWorkerFactory();
    _worker = w;
    w.onmessage = (ev: MessageEvent<any>) => {
      const res = (ev && ev.data) || {};
      if (!res || res.type !== 'tokenDiff') return;
      const task = _inflight.get(Number(res.rid));
      if (!task) return;
      _inflight.delete(Number(res.rid));
      try {
        deps.commit((s: any) => {
          recordBaseline(s, task.ds, task.id, task.before);
          applyDiff(s, task.ds, Number(res.I) || 0, Number(res.D) || 0);
        }, COMMIT_OPTS);
      } catch (e) {
        console.warn('[JU] charStats worker apply failed', e);
      }
      uiTick();
    };
    w.onerror = () => { _worker = null; };
  } catch (e) {
    _worker = null;
  }
  return _worker;
}

/* ====================================================================
 * 对外 API
 * ==================================================================== */

/**
 * 记录一次正文编辑（运行中增量路径）。
 * 同一节点在 500ms 窗口内的连续编辑会合并为「首→尾」一次差分。
 */
export function queueEdit(id: string, oldHtml: string, newHtml: string): void {
  if (!id) return;
  const cur = _pending.get(id);
  if (cur) cur.newHtml = String(newHtml == null ? '' : newHtml);
  else _pending.set(id, { oldHtml: String(oldHtml == null ? '' : oldHtml), newHtml: String(newHtml == null ? '' : newHtml) });
  scheduleFlush();
}

/** 记录一个新增节点（logActivity('add') 路径）：整段文本计入 I（即新增 A） */
export function queueNodeAdd(id: string, text: string): void {
  const tokens = countTokens(stripHtml(text));
  if (!(tokens > 0)) return;
  const ds = todayStr();
  try {
    deps.commit((s: any) => { recordBaseline(s, ds, id, 0); applyDiff(s, ds, tokens, 0); }, COMMIT_OPTS);
    uiTick();
  } catch (e) { console.warn('[JU] charStats add failed', e); }
}

/** 记录一个已删除节点（logActivity('del') 路径）：整段文本计入 D（即删除 R） */
export function queueNodeRemove(id: string, text: string): void {
  const tokens = countTokens(stripHtml(text));
  if (!(tokens > 0)) return;
  const ds = todayStr();
  try {
    deps.commit((s: any) => { recordBaseline(s, ds, id, tokens); applyDiff(s, ds, 0, tokens); }, COMMIT_OPTS);
    uiTick();
  } catch (e) { console.warn('[JU] charStats del failed', e); }
}

/** 排一次批次 flush */
function scheduleFlush(): void {
  const ms = typeof deps.debounceMs === 'number' ? deps.debounceMs : 500;
  if (_timer) return;
  _timer = setTimeout(() => { _timer = null; flushPending(); }, ms);
}

/**
 * 立即结算全部待合并编辑。
 *
 * @returns 已结算的批次数（0 = 无待处理）
 */
export function flushPending(): number {
  if (!_pending.size) return 0;
  const batch = Array.from(_pending.entries());
  _pending.clear();
  const ds = todayStr();
  let n = 0;
  for (const [id, e] of batch) {
    const oldText = stripHtml(e.oldHtml);
    const newText = stripHtml(e.newHtml);
    if (oldText === newText) continue;
    const before = countTokens(oldText);
    const threshold = typeof deps.threshold === 'number' ? deps.threshold : 20000;
    if ((oldText.length > threshold || newText.length > threshold) && ensureWorker()) {
      const rid = ++_rid;
      _inflight.set(rid, { id, ds, before });
      try {
        (_worker as Worker).postMessage({ type: 'tokenDiff', rid, oldText, newText });
      } catch (err) {
        _inflight.delete(rid);
        const d: TokenDiffResult = tokenDiff(oldText, newText);
        deps.commit((s: any) => { recordBaseline(s, ds, id, before); applyDiff(s, ds, d.I, d.D); }, COMMIT_OPTS);
      }
      n += 1;
      continue;
    }
    const d: TokenDiffResult = tokenDiff(oldText, newText);
    try {
      deps.commit((s: any) => { recordBaseline(s, ds, id, before); applyDiff(s, ds, d.I, d.D); }, COMMIT_OPTS);
    } catch (err) { console.warn('[JU] charStats flush failed', err); }
    n += 1;
  }
  if (n) uiTick();
  return n;
}

/**
 * 退出校准（快照 Diff）：以当日基线为「期初快照」、当前正文为「当前快照」，
 * 汇总全局 I/D 后**覆盖**当日桶（不累加）。
 *
 * @returns 是否执行了校准
 */
export function calibrate(): boolean {
  let st: any = null;
  try { st = deps.getState(); } catch (e) { st = null; }
  if (!st || !st.nodes) return false;
  const ds = todayStr();
  const day = (st.charBaseline && st.charBaseline[ds]) || null;
  if (!day) {
    /* 当日没有任何基线：无可校准内容，仅清掉 pending 标记 */
    try { deps.commit((s: any) => { if (s.pendingCalibration) delete s.pendingCalibration; }, COMMIT_OPTS); } catch (e) { /* ignore */ }
    return false;
  }
  let I = 0;
  let D = 0;
  for (const id of Object.keys(day)) {
    const n = st.nodes[id];
    const base = Number(day[id]) || 0;
    const cur = (n && !n._deleted) ? countTokens(stripHtml(n.text)) : 0;
    if (cur > base) I += cur - base;
    else if (cur < base) D += base - cur;
  }
  try {
    deps.commit((s: any) => { setBucket(s, ds, I, D); if (s.pendingCalibration) delete s.pendingCalibration; }, COMMIT_OPTS);
    deps.schedulePersist();
  } catch (e) { console.warn('[JU] charStats calibrate failed', e); return false; }
  _uiLast = 0;
  uiTick();
  return true;
}

/**
 * 启动时优先执行校准（`pendingCalibration` 残留 ⇒ 上一轮退出没来得及校准）。
 *
 * @returns 是否执行了校准
 */
export function runStartupCalibrationIfPending(): boolean {
  let st: any = null;
  try { st = deps.getState(); } catch (e) { st = null; }
  if (!st) return false;
  if (st.pendingCalibration) return calibrate();
  return false;
}

/**
 * 页面卸载 / 切后台：先把待结算批次结算掉；确实来不及则置 `pendingCalibration`
 * 供下次启动优先校准。任何路径都不抛异常（卸载期抛错会阻断其它清理链）。
 */
export function flushOnExit(): void {
  try {
    const hadPending = _pending.size > 0 || _inflight.size > 0;
    if (hadPending) {
      try { deps.commit((s: any) => { s.pendingCalibration = true; }, COMMIT_OPTS); } catch (e) { /* ignore */ }
      flushPending();
      if (!_pending.size && !_inflight.size) {
        try { deps.commit((s: any) => { if (s.pendingCalibration) delete s.pendingCalibration; }, COMMIT_OPTS); } catch (e) { /* ignore */ }
      }
    }
    deps.schedulePersist();
  } catch (e) { /* 卸载期静默 */ }
}

/** 诊断快照（探针 / 回执取证用，只读） */
export function getCharStatsDiagnostics(): any {
  let st: any = null;
  try { st = deps.getState(); } catch (e) { st = null; }
  const ds = todayStr();
  return {
    today: ds,
    bucket: (st && st.charStats && st.charStats[ds]) || null,
    rev: (st && st.charStatsRev) | 0,
    pendingEdits: _pending.size,
    inflight: _inflight.size,
    pendingCalibration: !!(st && st.pendingCalibration),
    baselineNodes: (st && st.charBaseline && st.charBaseline[ds]) ? Object.keys(st.charBaseline[ds]).length : 0,
    workerCreated: !!_worker,
  };
}

/** 清空引擎内部批次状态（导入 / 全量替换 state 后调用；不动 state.charStats） */
export function resetCharStatsEngine(): void {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  _pending.clear();
  _inflight.clear();
  _uiLast = 0;
}
