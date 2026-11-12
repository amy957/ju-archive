/**
 * M5-1a · Tauri 自动更新接入（桌面壳）
 *
 * 职责边界：
 *   - 仅负责「检查 → 询问 → 安装」单次流程，不持有 UI 状态，不改写任何业务数据。
 *   - 浏览器通道（非桌面壳）不进入该流程：`checkForUpdates` 由调用方在 `IS_DESKTOP`
 *     为真时才调用；本模块本身也不做环境判定，避免与 `deps.isDesktop()` 口径分叉。
 *
 * 依赖策略：
 *   `@tauri-apps/api/updater` 走**动态导入**——浏览器构建产物不会在首帧加载 Tauri 桥接代码，
 *   仅在真正触发检查时按需拉取；因此普通浏览器运行期不会因缺少 `window.__TAURI__` 而报错。
 *
 * 失败口径：
 *   更新检查属「增强能力」，任何异常（无网络 / 端点 404 / 公钥校验失败 / 桥接缺失）
 *   都被吞掉并以 `reason` 返回，绝不冒泡打断启动链路。
 */

/* 批次 DE · 未使用导出复核：`UpdateCheckResult` 仅在本文件内部使用，降级为模块内私有 */
/** 单次检查结果（供启动期静默调用与手动触发共用） */
interface UpdateCheckResult {
  /** 是否真正完成了与更新端点的比对（异常时为 false） */
  checked: boolean;
  /** 端点是否报告存在新版本 */
  shouldUpdate: boolean;
  /** 新版本号（`shouldUpdate` 为真时可用） */
  version: string | null;
  /** 是否已执行安装（用户确认且 `installUpdate` 未抛错） */
  installed: boolean;
  /** 结果说明：uptodate / declined / installed / busy / error */
  reason: 'uptodate' | 'declined' | 'installed' | 'busy' | 'error';
  /** 异常摘要（仅 reason === 'error' 时存在） */
  error?: string;
}

/** 并发守卫：启动静默检查与手动触发同一时刻只跑一次 */
let _checking = false;

/** 更新器开关：必须与 `src-tauri/tauri.conf.json` 的 `tauri.updater.active` 保持一致。
 *  关闭时不动态导入 updater API、不发任何 IPC / 网络请求，直接返回 null。
 *  导出供测试同源读取，避免用例与产品件开关口径分叉。 */
export const UPDATER_ACTIVE = false;

function _failed(err: unknown): UpdateCheckResult {
  return {
    checked: false,
    shouldUpdate: false,
    version: null,
    installed: false,
    reason: 'error',
    error: String((err && (err as any).message) || err || ''),
  };
}

/**
 * 检查更新；若端点报告新版本，用 `window.confirm` 询问用户是否下载安装。
 *
 * @param opts.silent 静默模式：仅影响日志级别（不弹任何额外提示），询问弹窗逻辑不变。
 */
export async function checkForUpdates(opts?: { silent?: boolean }): Promise<UpdateCheckResult | null> {
  if (!UPDATER_ACTIVE) return null;
  const silent = !!(opts && opts.silent);
  if (_checking) {
    return { checked: false, shouldUpdate: false, version: null, installed: false, reason: 'busy' };
  }
  _checking = true;
  try {
    const { checkUpdate, installUpdate } = await import('@tauri-apps/api/updater');
    const res = await checkUpdate();
    const manifest = res && res.manifest;
    if (!res || !res.shouldUpdate) {
      if (!silent) console.info('[JU] 已是最新版本');
      return { checked: true, shouldUpdate: false, version: null, installed: false, reason: 'uptodate' };
    }
    const version = (manifest && manifest.version) || null;
    const ask =
      `发现新版本 ${version || '(未知版本)'}\n` +
      `${(manifest && manifest.date) ? `发布日期：${manifest.date}\n` : ''}` +
      `${(manifest && manifest.body) ? `更新说明：${manifest.body}\n` : ''}` +
      '是否现在下载并安装？安装过程会关闭当前窗口。';
    const accepted = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(ask)
      : false;
    if (!accepted) {
      return { checked: true, shouldUpdate: true, version, installed: false, reason: 'declined' };
    }
    await installUpdate();
    return { checked: true, shouldUpdate: true, version, installed: true, reason: 'installed' };
  } catch (e) {
    if (silent) console.warn('[JU] 更新检查失败（已忽略）', e);
    else console.warn('[JU] 更新检查失败', e);
    return _failed(e);
  } finally {
    _checking = false;
  }
}

/* 批次 DE · 死代码清理：`isCheckingForUpdates` 经全量静态反查确认无调用方，已删除。
   并发守卫 `_checking` 仍由 checkForUpdates 的重入判定（if (_checking) …）读写，保留。 */
/**
 * 真实桌面壳探测：Tauri 桥接是否存在。
 *
 * 说明：`BootDeps.isDesktop` / `ErrorDeps.isDesktop` 由 `src/main.ts` 绑定
 * `() => !!_tauri()`（命名空间口径），与下方桥接探测同源，打包后的 Tauri 应用里
 * 更新检查与崩溃落盘可达。此函数**只用于增强通道的准入判定**，
 * 不参与任何持久化分支选择，因此不会改变桌面/浏览器落盘语义。
 */
export function isTauriShell(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const t: any = (window as any).__TAURI__;
    return !!(t && (t.core || t.tauri || t.updater || t.window));
  } catch (e) {
    return false;
  }
}
