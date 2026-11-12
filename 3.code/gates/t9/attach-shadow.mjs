/**
 * L9-W4 · LO-2 影子层**最小接线**（add-on attach；零产品代码改动）
 * ----------------------------------------------------------------------------
 * 设计依据：`reports/t9-design-2026-10-14.md`
 *   · §十三 L9-W4「路径隔离（桌面 / 加密 / 浏览器）+ 哨兵 + 指标」；
 *   · §十四 LO-2（浏览器路线 M-A / M-D）——本波**不裁决**；仅依 LO-2 约束
 *     「不接线产品路径 / 不接线导出导入」，以**附加式（add-on）**把 L9 影子层挂到宿主，
 *     **不改产品字节**；
 *   · §2.3「In scope（必须）：零回归兜底」——未显式 on 时产品行为与 L8-W5 冻结版**字节级一致**。
 *
 * 硬约束（本子任务）：产品 HTML（canonical `6CAD8950…C42B10`，907,458 B，LF）**字节冻结**。
 *   本文件为**独立附加物**：不写入产品 HTML、不改 `6.P0-T3基线/step9/v2.0-t3.html`、
 *   不写 `1.冻结版本/`、不改 `scripts/verify.js`。产品若需接入，仅在**再冻结时**按
 *   `reports/t9-w4-wiring-optin-2026-10-14.md` 的 opt-in 片段引用本模块（本波不应用）。
 *
 * 契约（哨兵 / 路径隔离 / 幂等 / 降级）：
 *   - `attachShadow(host?, opts?) → {attached, sentinel, id, reason, attachCount?, error?}`
 *       · 宿主**无产品在场标记** → 安全 no-op（`reason:'no-product'`；不置哨兵、不装命名空间）；
 *       · L9 模块**不可加载** → 安全降级（`reason:'no-l9'`；不置哨兵、零残留）；
 *       · 已接线（哨兵在场） → **幂等**（`reason:'already-attached'`；不再产生副作用）；
 *       · 宿主不可写 → 安全降级（`reason:'install-failed'`；回滚）。
 *   - **路径隔离**：六支柱一律以 `new URL(spec, import.meta.url)` 解析，锚定**本模块所在目录**
 *       （与 `process.cwd()` 无关）；`pillarUrls()` / `pillarBaseDir()` 供可观测。
 *   - **哨兵**：`host[SENTINEL_KEY]`（不可枚举）={id, version, attachedAt, attachCount,
 *       namespace, pillars, paths, pillarBaseDir}；`hasSentinel()` / `shadowStatus()` 供可观测。
 *   - **命名空间**：`host[NS_KEY]`（不可枚举）={id, version, modules, paths}（附加全局，非产品路径）。
 *
 * 性质：**影子层（shadow / 默认关闭）**；不接线产品导出/导入（LO-2）。
 * 运行：`node --test l9/t9-shadow-wiring.test.mjs`（Node ≥ 22）
 */

/* ── 哨兵 / 命名空间键（字符串键 → 跨 realm 可观测；均以 describeProperty 不可枚举安装） ── */
export const SENTINEL_KEY = '__juL9ShadowSentinel';
export const NS_KEY = '__juL9Shadow';
export const SENTINEL_ID = 'l9-shadow/v1';

/** 产品在场标记：宿主（窗口 / 全局）出现任一即视为「产品已加载」。 */
const HOST_MARKERS = Object.freeze(['state', '__juPersistProbe', '__juIndexWorker']);

/** 影子层支柱（模块相对文件；路径隔离的解析入口）。 */
export const PILLARS = Object.freeze({
  persistStore: './persist-store.mjs',
  cryptoStore: './crypto-store.mjs',
  indexLayer: './index-layer.mjs',
  workerProtocol: './worker-protocol.mjs',
  persistWorker: './persist-worker.mjs',
  backendAdapters: './backend-adapters.mjs',
});

/* ── 路径隔离：模块相对解析（非 cwd / 非 node_modules 解析），结果缓存且冻结 ── */
let _pillarUrls = null;
/** 六支柱的**绝对 URL**（锚定本模块 import.meta.url；确定性 + 可缓存）。 */
export function pillarUrls() {
  if (_pillarUrls) return _pillarUrls;
  const out = {};
  for (const [k, spec] of Object.entries(PILLARS)) out[k] = new URL(spec, import.meta.url).href;
  _pillarUrls = Object.freeze(out);
  return _pillarUrls;
}

let _baseDir;
let _baseResolved = false;
/** 本模块所在目录（绝对路径）；非 Node 环境不可得 → null（安全降级）。 */
export async function pillarBaseDir() {
  if (_baseResolved) return _baseDir;
  try {
    const { fileURLToPath } = await import('node:url');
    const pathMod = await import('node:path');
    const path = pathMod.default || pathMod;
    _baseDir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    _baseDir = null;
  }
  _baseResolved = true;
  return _baseDir;
}

/** 依**隔离路径**动态加载六支柱 → 命名空间 modules；任一失败向上抛出（调用方降级）。 */
export async function loadPillars() {
  const urls = pillarUrls();
  const out = {};
  for (const [k, href] of Object.entries(urls)) out[k] = await import(href);
  return out;
}

/** 产品在场判定（零副作用：仅探属性存在性，不读取/不触发产品逻辑）。 */
export function isProductHost(host) {
  if (!host || (typeof host !== 'object' && typeof host !== 'function')) return false;
  for (const m of HOST_MARKERS) {
    try { if (m in host) return true; } catch { /* proxy 异常 → 视为不在场 */ }
  }
  return false;
}

/** 哨兵在场判定。 */
export function hasSentinel(host = globalThis) {
  try {
    const s = host && host[SENTINEL_KEY];
    return !!(s && s.id === SENTINEL_ID);
  } catch {
    return false;
  }
}

/** 接线状态快照（可观测；未接线为 {attached:false, sentinel:false}）。 */
export function shadowStatus(host = globalThis) {
  let s = null;
  try { s = host ? host[SENTINEL_KEY] : null; } catch { s = null; }
  if (!s || s.id !== SENTINEL_ID) {
    return Object.freeze({ attached: false, sentinel: false, id: SENTINEL_ID });
  }
  return Object.freeze({
    attached: true,
    sentinel: true,
    id: s.id,
    version: s.version,
    attachedAt: s.attachedAt,
    attachCount: s.attachCount,
    namespace: s.namespace,
    pillars: Array.isArray(s.pillars) ? s.pillars.slice() : [],
    paths: s.paths,
    pillarBaseDir: s.pillarBaseDir,
  });
}

const _result = (o) => Object.freeze(Object.assign({ attached: false, sentinel: false, id: SENTINEL_ID }, o));

/**
 * 把 L9 影子层**附加**挂到宿主（幂等 / 降级安全 / 零产品代码改动）。
 * @param {object} [host=globalThis] 宿主（浏览器 `window` 或任意带产品标记的对象）
 * @param {object} [opts] `{ loader?, paths? }`（loader 为可测性接缝，默认 loadPillars）
 * @returns {Promise<{attached:boolean, sentinel:boolean, id:string, reason:string, attachCount?:number, error?:string}>}
 */
export async function attachShadow(host = globalThis, opts = {}) {
  /* ① 无产品在场 → 安全 no-op（不触碰宿主任何状态） */
  if (!isProductHost(host)) return _result({ reason: 'no-product' });

  /* ② 哨兵在场 → 幂等短路（零重复副作用） */
  if (hasSentinel(host)) {
    return _result({ attached: true, sentinel: true, reason: 'already-attached', attachCount: host[SENTINEL_KEY].attachCount });
  }

  /* ③ 解析并加载支柱（路径隔离；不可用 → 安全降级，零残留） */
  const loader = typeof opts.loader === 'function' ? opts.loader : loadPillars;
  let pillars;
  try {
    pillars = await loader();
  } catch (e) {
    return _result({ reason: 'no-l9', error: String((e && e.message) || e) });
  }

  const paths = opts.paths || pillarUrls();
  const baseDir = await pillarBaseDir();

  /* ④ 安装命名空间 + 哨兵（附加全局；均不可枚举，不改产品代码路径） */
  try {
    let ns = host[NS_KEY];
    if (!ns || typeof ns !== 'object') {
      ns = {};
      Object.defineProperty(host, NS_KEY, { value: ns, writable: true, enumerable: false, configurable: true });
    }
    ns.id = SENTINEL_ID;
    ns.version = SENTINEL_ID;
    ns.modules = pillars;
    ns.paths = paths;

    const sentinel = {
      id: SENTINEL_ID,
      version: SENTINEL_ID,
      attachedAt: Date.now(),
      attachCount: 1,
      namespace: NS_KEY,
      pillars: Object.keys(pillars),
      paths,
      pillarBaseDir: baseDir,
    };
    Object.defineProperty(host, SENTINEL_KEY, { value: sentinel, writable: true, enumerable: false, configurable: true });
    return _result({ attached: true, sentinel: true, reason: 'attached', attachCount: 1 });
  } catch (e) {
    /* 宿主不可写（如被冻结）→ 回滚 + 安全 no-op */
    try { delete host[SENTINEL_KEY]; } catch { /* ignore */ }
    try { delete host[NS_KEY]; } catch { /* ignore */ }
    return _result({ reason: 'install-failed', error: String((e && e.message) || e) });
  }
}

/** 复位影子层接线（幂等）；返回是否曾存在接线（供可观测 / 测试收尾）。 */
export function detachShadow(host = globalThis) {
  if (!host || (typeof host !== 'object' && typeof host !== 'function')) return false;
  let present = false;
  try { present = !!(host[SENTINEL_KEY] || host[NS_KEY]); } catch { return false; }
  try { delete host[SENTINEL_KEY]; } catch { /* ignore */ }
  try { delete host[NS_KEY]; } catch { /* ignore */ }
  return present;
}
