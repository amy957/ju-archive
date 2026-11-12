/**
 * M3 · 批次 AW · 全局错误采集（本地环形日志 + 桌面崩溃转储）
 *
 * 来源：6.P0-T3基线/public/v2.0-t3.html（canonical，只读，零字节改动）
 *   - __juLog / _errSeen / _inReportError / 限流与清扫常量 ........................ 18318-18325
 *   - _redactErrText（PII 脱敏：引号文本 / 手机号 / 邮箱 / IPv4）................... 18326-18334
 *   - reportError（重入守卫 → 脱敏 → 去重 → 限流 → ctx → 环形日志）............... 18335-18425
 *   - __juFlushErrors（兼容键；纯本地版不发起网络请求）............................ 18427-18436
 *   - __juLogDownload（本地日志导出）.............................................. 18437-18447
 *
 * 模块化受控差异（运行期语义等价，仅装配层）：
 *   1) 同作用域符号改为依赖注入：`ui` / `state`（getState）/ `IS_DESKTOP`（isDesktop）/
 *      `desktopInvoke` / `JU_VER`。未注入时走安全默认（与产品件符号为 undefined 的分支等价）。
 *   2) 环形日志仍落在 `window.__juLog`（产品契约：window 级只读视图，ju.d.ts 已声明）。
 *   3) 匿名错误上报（`ui.errorReporting` 开关 + 远端 HTTP 通道）已按产品决策整体移除
 *      （2026-10-26）：本模块只保留本地环形日志与桌面崩溃转储，任何路径都不外发。
 *   4) M2-7 合规加固（保留）：
 *      - 上报 payload 结构白名单：只保留 msg / reason / stack / filename / lineno / name /
 *        ids / count / nodeCount / view / enc / ver / code，剔除 docId / currentDocId /
 *        nodes / text / content 等可能携带正文或文档标识的字段。
 *      - ctx 不再携带 docId（仅 view / nodeCount / enc / ver，均为结构性指标）。
 *      - stack 与非加密 msg / reason 同口径脱敏（引号文本 / 手机号 / 邮箱 / IPv4 → 占位符）。
 */

/** 去重窗口（同一 key 1 分钟内只记一次） */
const DEDUP_TTL_MS = 60_000;
/** 60s 窗口内最多记录/上报条数（错误风暴限流） */
const ERR_RATE_MAX = 40;
/** 每 N 次 reportError 强制全量清扫一次过期去重键 */
const ERR_SWEEP_INTERVAL = 64;
/** 环形缓冲容量 */
const LOG_MAX = 200;
/** stack 截断上限（keepalive 请求体限制） */
const STACK_MAX = 4096;

export interface ErrorDeps {
  /** 产品件全局 `ui`（读 encrypted / view / currentDocId） */
  ui: any;
  /** 当前 state 读取端口（ctx.nodeCount 使用） */
  getState: () => any;
  /** 桌面壳判定（产品件 `IS_DESKTOP`） */
  isDesktop: () => boolean;
  /** 桌面壳调用通道（产品件 `desktopInvoke`） */
  desktopInvoke: (cmd: string, args: any) => any;
  /** 版本号（产品件 `JU_VER`） */
  JU_VER: string;
}

export const deps: ErrorDeps = {
  ui: null,
  getState: () => null,
  isDesktop: () => false,
  desktopInvoke: () => Promise.resolve(null),
  JU_VER: '',
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持原值）。 */
export function bindErrorDeps(next: Partial<ErrorDeps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   内部状态
   ============================================================ */
const _errSeen = new Map<string, number>();
let _inReportError = false;
let _errRateWin = 0;
let _errRateCount = 0;
let _errSweepCount = 0;

/** 环形日志（window.__juLog 契约；首次访问时初始化） */
export function getErrorLog(): any[] {
  const w = window as any;
  if (!Array.isArray(w.__juLog)) w.__juLog = [];
  return w.__juLog;
}

/**
 * 消息级脱敏：引号包裹文本（可能含节点标题/用户输入）→ <redacted>；
 * 另补裸手机号 / 邮箱 / IPv4（Defect-H）。顺序：引号 → 手机号 → 邮箱 → IPv4。
 */
const _redactErrText = (s: any): string =>
  String(s == null ? '' : s)
    .replace(/["'`]([^"'`\n]{4,})["'`]/g, '"<redacted>"')
    .replace(/\b1[3-9]\d{9}\b/g, '<phone>')
    .replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, '<email>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>');

/** M2-7：payload 结构白名单——只保留结构性指标，禁止正文 / 文档标识进入日志。 */
const PAYLOAD_KEYS = new Set([
  'msg',
  'reason',
  'stack',
  'filename',
  'lineno',
  'name',
  'ids',
  'count',
  'nodeCount',
  'view',
  'enc',
  'ver',
  'code',
  'error',
]);

function _sanitizePayload(payload: any): any {
  const src = payload && typeof payload === 'object' ? payload : {};
  const out: any = {};
  for (const k of Object.keys(src)) {
    if (!PAYLOAD_KEYS.has(k)) continue;
    const v = src[k];
    if (v == null) continue;
    if (k === 'ids') {
      if (Array.isArray(v)) out.ids = v.slice(0, 5).map((x) => String(x));
      continue;
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/** 错误采集入口（产品件 `reportError`）：仅写本地环形日志 / 桌面日志，不做任何外发。 */
export function reportError(kind: string, payload?: any): void {
  if (_inReportError) return; /* 【F12/fixed19】防御性重入守卫 */
  _inReportError = true;
  try {
    /* M2-7：先做结构白名单裁剪（docId / nodes / text 等一律不进日志与外发体），再做脱敏 */
    let p: any = _sanitizePayload(payload);
    /* 加密模式：msg/reason/stack/filename/lineno 一律占位，避免用户内容与绝对路径外泄 */
    const encNow = !!(deps.ui && deps.ui.encrypted);
    if (encNow) {
      if (p.msg != null) p.msg = '<enc-message>';
      if (p.reason != null) p.reason = '<enc-message>';
      if (p.stack != null) p.stack = '<enc-stack>';
      if (p.filename != null) p.filename = '<enc-filename>';
      if (p.lineno != null) p.lineno = '<enc-lineno>';
      if (p.error != null) p.error = '<enc-error>';
    } else {
      if (p.msg != null) p.msg = _redactErrText(p.msg);
      if (p.reason != null) p.reason = _redactErrText(p.reason);
      if (p.stack != null) p.stack = _redactErrText(p.stack);
      if (typeof p.error === 'string') p.error = _redactErrText(p.error);
    }

    /* FIX-ERR-KEY：去重键补 lineno，JSON 数组形消除假值碰撞 */
    const key = JSON.stringify([kind, p.msg || p.reason || '', p.filename || '', p.lineno]);
    const now = Date.now();

    /* FIX-P1-11 / FIX-P3-9：每 ERR_SWEEP_INTERVAL 次访问强制全量清扫，队首过期作 O(1) 快路径 */
    if (++_errSweepCount >= ERR_SWEEP_INTERVAL) {
      _errSweepCount = 0;
      for (const [k, t] of _errSeen) {
        if (now - t > DEDUP_TTL_MS) _errSeen.delete(k);
        else break;
      }
    } else {
      const _oldestKey = _errSeen.keys().next().value;
      if (_oldestKey !== undefined) {
        const _oldestT = _errSeen.get(_oldestKey);
        if (_oldestT !== undefined && now - _oldestT > DEDUP_TTL_MS) {
          for (const [k, t] of _errSeen) {
            if (now - t > DEDUP_TTL_MS) _errSeen.delete(k);
            else break;
          }
        }
      }
    }

    const last = _errSeen.get(key);
    if (last !== undefined && now - last < DEDUP_TTL_MS) return; /* 1 分钟去重 */
    _errSeen.set(key, now);

    /* FIX-ERR-RATE：全局限流 */
    const _rateWin = Math.floor(now / 60_000);
    if (_rateWin !== _errRateWin) {
      _errRateWin = _rateWin;
      _errRateCount = 0;
    }
    if (_errRateCount >= ERR_RATE_MAX) return;
    _errRateCount++;

    /* ctx：M2-7 起不再携带 docId；加密模式连 nodeCount / view 也不采集，仅标记 enc:true */
    const st = deps.getState();
    const _ctx = encNow
      ? { view: null, nodeCount: 0, enc: true, ver: deps.JU_VER }
      : {
          view: deps.ui ? deps.ui.view : null,
          nodeCount: st && st.nodes ? Object.keys(st.nodes).length : 0,
          enc: false,
          ver: deps.JU_VER,
        };

    const entry: any = { kind, ts: now, reported: false, ctx: _ctx, ...p };
    if (entry.stack && typeof entry.stack === 'string' && entry.stack.length > STACK_MAX) {
      entry.stack = entry.stack.slice(0, STACK_MAX);
    }

    const log = getErrorLog();
    log.push(entry);
    if (log.length > LOG_MAX) log.shift();

    /* 桌面版：同步追加写一份错误日志到应用数据目录（本地，供「反馈」导出） */
    try {
      if (deps.isDesktop() && typeof deps.desktopInvoke === 'function') {
        Promise.resolve(deps.desktopInvoke('report_error', { entry: JSON.stringify(entry) })).catch(
          (e: any) => console.warn('[JU] report_error 桌面落盘失败', e),
        );
      }
    } catch (e) { /* 桌面通道不可用 */ }

    /* 匿名错误上报已移除：本地环形日志到此为止，不做任何外发。 */
  } catch (e) {
    /* 采集链路自身异常必须完全吞掉（错误上报不得打断业务） */
  } finally {
    _inReportError = false;
  }
}

/**
 * 兼容键 `__juFlushErrors`：匿名错误上报已移除，纯本地版不发起任何网络请求。
 * 保留空实现只为不改变 window 契约与既有调用点（beforeunload / visibilitychange）。
 */
export function flushPendingErrors(): void {
  /* 纯本地版：无外发队列可补投。 */
}

/**
 * M5-1b · 崩溃包投递通道
 *
 * 唯一通道：桌面壳（`deps.isDesktop()`）经 Tauri IPC `save_crash_dump` 落盘到
 * `app_data_dir/crash_dumps/crash_<timestamp>.json`——数据不出本机（本地诊断，非外发）。
 * 浏览器环境下不再提供任何网络外发通道，直接返回 `skipped`。
 *
 * 任何异常都被吞掉并以 `channel`/`error` 回报，绝不冒泡打断业务链路。
 */
/* 批次 DE · 未使用导出复核：CrashDispatchResult / CrashDumpsReadResult 仅本文件内部使用，降级私有 */
interface CrashDispatchResult {
  ok: boolean;
  channel: 'desktop' | 'skipped';
  error?: string;
}

/** 当前应用版本（与 `reportError` 的 ctx.ver 同源，供崩溃包统一取用） */
export function getErrorAppVersion(): string {
  return deps.JU_VER;
}

/**
 * 取桌面 IPC 调用器：优先 Tauri v2 `core.invoke`，回退 v1 `tauri.invoke`，最后回退注入端口。
 * ISSUE-004：注入端口仅在真实桌面态（`deps.isDesktop()`）生效——Web 端也注入了
 * `desktopInvoke`，若无桥接仍当成功会让 readCrashDumps / sendCrashReport 谎报 ok:true。
 */
function _desktopInvoker(): ((cmd: string, args: any) => any) | null {
  try {
    const t: any = (window as any).__TAURI__;
    if (t && t.core && typeof t.core.invoke === 'function') return (c, a) => t.core.invoke(c, a);
    if (t && t.tauri && typeof t.tauri.invoke === 'function') return (c, a) => t.tauri.invoke(c, a);
  } catch (e) { /* 桥接缺失 */ }
  return deps.isDesktop() && typeof deps.desktopInvoke === 'function' ? deps.desktopInvoke : null;
}

/** 真实桌面壳探测：Tauri 桥接存在即视为桌面运行环境（详见 app/updater.ts 的 same-name 说明） */
function _tauriBridgePresent(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const t: any = (window as any).__TAURI__;
    return !!(t && (t.core || t.tauri || t.updater || t.window));
  } catch (e) {
    return false;
  }
}

export async function sendCrashReport(payload: any): Promise<CrashDispatchResult> {
  const body: any = payload && typeof payload === 'object' ? payload : { msg: String(payload == null ? '' : payload) };
  /* ── 通道 1：桌面壳本地落盘 ── */
  if (deps.isDesktop() || _tauriBridgePresent()) {
    try {
      const invoke = _desktopInvoker();
      if (!invoke) return { ok: false, channel: 'desktop', error: 'desktop invoke unavailable' };
      await Promise.resolve(invoke('save_crash_dump', { payload: JSON.stringify(body) }));
      return { ok: true, channel: 'desktop' };
    } catch (e) {
      return { ok: false, channel: 'desktop', error: String((e && (e as any).message) || e || '') };
    }
  }
  /* 浏览器：不提供网络外发通道（匿名错误上报已移除） */
  return { ok: false, channel: 'skipped' };
}

/**
 * 通用 JSON 文本下载通道（真实 `<a download>` 落盘）
 *
 * 契约：
 *   - 单一出口：`__juLogDownload` 与 M5-1b 崩溃日志导出共用本函数，避免两套下载实现分叉；
 *   - FIX-ERR-LEAK 口径沿用：挂载 → click → remove → `revokeObjectURL`，不留 DOM/URL 泄漏；
 *   - 返回是否成功发起下载（`Blob` / `URL` 不可用的环境返回 false，调用方自行提示）。
 */
export function downloadJsonText(filename: string, text: string): boolean {
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    return true;
  } catch (e) {
    return false;
  }
}

/** 本地错误日志导出（产品件 `__juLogDownload`） */
export function downloadErrorLog(): void {
  try {
    downloadJsonText('ju-error-log.json', JSON.stringify(getErrorLog(), null, 2));
  } catch (e) { /* 导出失败静默 */ }
}

/**
 * M5-1b · 崩溃日志读取结果
 */
interface CrashDumpsReadResult {
  /** 是否成功取回（目录为空也视为成功，`json` 中 `count=0`） */
  ok: boolean;
  /** Rust 端 `read_crash_dumps` 返回的单个 JSON 字符串（可直接落盘为 .json 文件） */
  json?: string;
  error?: string;
}

/**
 * M5-1b · 读取本机崩溃日志（桌面壳专用）
 *
 * 契约：
 *   - 仅经 Tauri IPC `read_crash_dumps` 取数，Rust 端遍历 `app_data_dir/crash_dumps/` 并
 *     拼成单个 JSON 字符串，前端不再做二次聚合；
 *   - 数据不出本机：读取不触发任何网络请求（匿名上报已移除；本地诊断 ≠ 外发）；
 *   - 桥接缺失 / IPC 异常一律以 `{ ok:false, error }` 回报，绝不冒泡打断 UI 链路。
 */
export async function readCrashDumps(): Promise<CrashDumpsReadResult> {
  try {
    const invoke = _desktopInvoker();
    if (!invoke) return { ok: false, error: 'desktop invoke unavailable' };
    const raw = await Promise.resolve(invoke('read_crash_dumps', {}));
    if (typeof raw === 'string') return { ok: true, json: raw };
    return { ok: true, json: JSON.stringify(raw == null ? [] : raw) };
  } catch (e) {
    return { ok: false, error: String((e && (e as any).message) || e || '') };
  }
}

/** 错误消息归一（产品件 `errMsg(e)`，供 boot / outline / graph 的错误分支使用） */
export function errMsg(e: any): string {
  return String((e && e.message) || e || '');
}
