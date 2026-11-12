#!/usr/bin/env node
/**
 * M07 · 本地一键发版流水线（build:all）
 *
 * 串联步骤（共 15 步，任一失败立即中止，退出码透传）：
 *   1) tsc --noEmit                        —— 类型门禁（含 tests/**\/*.ts 编译面）
 *   1b) scripts/check-deps-wired.mjs        —— 装配门禁（禁止 noop / () => null）
 *   1c) scripts/check-parity.mjs            —— 零漂移与版本同源
 *   1d) scripts/audit-license.mjs           —— 许可审计（AGPL/GPL/SSPL）
 *   1e) scripts/check-unused-exports.mjs    —— 未使用导出统计（上限 214，超出即失败）
 *   1f) cargo check --manifest-path src-tauri/Cargo.toml —— Rust 编译检查
 *   1g) cargo test --manifest-path src-tauri/Cargo.toml —— Rust 用例（数据安全回归，失败即终止）
 *   1h) 90过程材料/tmp/<batch>/receipt.json —— 回执扫描（缺失仅告警 ⚠ 无回执 <batch>，不阻断）
 *   2) node --test test/*.mjs src/test/*.mjs —— 契约单元测试
 *   3) vite build                          —— Web 单文件产物 dist/index.html
 *   3b) scripts/check-inline-style.mjs      —— 内联样式闸门（自 1c 移入；dist 单 HTML 闸门另见 D-05b）
 *   4) playwright test（E2E）              —— smoke + full-e2e + concurrency（ISSUE-011）
 *   5) tauri build --bundles ${BUNDLES}    —— 桌面 exe + 安装包（默认 BUNDLES=nsis，产出 setup.exe）
 *   6) scripts/prepare-release.mjs         —— 归档到 99.hist/8.rel/<版本>/ + SHA-256 清单
 *   6b) scripts/check-release-parity.mjs   —— 归档三角校验（ISSUE-006）
 *
 * 【默认一条命令出包】不设任何环境变量即：OVERWRITE=1（同日重打包自动让位旧归档）、
 *   BUNDLES=nsis（第 5 步产出 setup.exe）、BUILD_DATE=当天 UTC 日期。
 *   仅显式设置 JU_RELEASE_OVERWRITE=0 才关闭同日重打包让位（第 6 步 abort），
 *   仅显式设置 JU_BUNDLES=none 才关闭安装包产出（第 5 步只出裸 exe）。
 *
 * 【D-05b】归档目录已移出 dist（见 scripts/release-paths.mjs）：
 *   历史上归档写在 `dist/release/`，而 Tauri v1 按 distDir=../dist 递归内嵌整个目录，
 *   导致每轮 exe 都多背一份旧 HTML（4.6 MB）+ 上一轮整个 exe（10.4 MB），体积 10.4→18.9 MB。
 *   现在 dist 只产出 index.html，内嵌范围天然收敛；本脚本额外做「dist 只有一份 HTML」的硬闸门，
 *   并清理历史遗留的 dist/release（搬到 node_modules/.cache，不删除）。
 *
 * 末尾打印全部产物的「路径 / 字节数 / SHA-256」，便于人工核对与哈希留档。
 *
 * 设计要点：
 *   - 不使用 shell，全部以 `process.execPath` + 本地 JS 入口调用（npm 不在 PATH 时同样可用，
 *     也避免 Windows 上 .cmd 包装器对 node 的 PATH 依赖）；
 *   - 每个步骤打印耗时，失败时打印失败步骤与建议命令，不产生半套归档以外的副作用；
 *   - 产物清单在 prepare-release 之后扫描真实文件生成，不做任何硬编码断言。
 *
 * 用法：node scripts/build-all.mjs   （或 npm run build:all）
 * 退出码：0 = 全链路成功；非 0 = 首个失败步骤的退出码。
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKSUMS_NAME, EXE_OUT_NAME, PKG_VERSION, RELEASE_DIR, WEB_OUT_NAME } from './release-paths.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const STEP_TOTAL = 15; /* 与 runStep 调用逐一对应：1/1b/1c/1d/1e/1f/1g/1h/2/3/3b/4/5/6/6b */

/* ── 一条命令出包的默认口径（无需记忆环境变量） ── */
const OVERWRITE = process.env.JU_RELEASE_OVERWRITE !== '0';
const BUNDLES = process.env.JU_BUNDLES || 'nsis';
const BUILD_DATE = process.env.JU_BUILD_DATE || new Date().toISOString().slice(0, 10);
/* 子步骤（prepare-release）读取同名环境变量：统一以本脚本常量为唯一口径 */
process.env.JU_RELEASE_OVERWRITE = OVERWRITE ? '1' : '0';
process.env.JU_BUILD_DATE = BUILD_DATE;

/** 本地可执行入口（随 node_modules 走，避免全局 PATH 依赖） */
const TSC_JS = path.join(PROJECT, 'node_modules', 'typescript', 'bin', 'tsc');
const VITE_JS = path.join(PROJECT, 'node_modules', 'vite', 'bin', 'vite.js');
const TAURI_JS = path.join(PROJECT, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
/** Playwright CLI（`npx playwright test` 的本地等价入口，免 shell / 免 PATH 依赖） */
const PLAYWRIGHT_CLI = path.join(PROJECT, 'node_modules', '@playwright', 'test', 'cli.js');

/** 相对项目根的 POSIX 风格路径（报告可读性） */
function rel(abs) {
  return path.relative(PROJECT, abs).split(path.sep).join('/');
}

/** 统一日志前缀 */
function log(msg = '') {
  console.log('[build:all] ' + msg);
}

/** 流式计算 SHA-256（大体积 exe 不整块读入内存） */
async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

/**
 * 执行一个步骤：以当前 node 运行指定入口，参数数组直传（无 shell）。
 *
 * @param {number} index   步骤序号（1 起）
 * @param {string} label   展示名
 * @param {string[]} args  node 参数（首项为脚本路径）
 * @param {string[]} [hints] 失败时的建议命令
 */
function runStep(index, label, args, hints = []) {
  log(`━━━ [${index}/${STEP_TOTAL}] ${label} ━━━`);
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: PROJECT,
    stdio: 'inherit',
  });
  const cost = ((Date.now() - startedAt) / 1000).toFixed(1);

  if (result.error) {
    log(`✗ ${label} 启动失败：${result.error.message}（${cost}s）`);
    process.exit(1);
  }
  if (result.status !== 0) {
    log(`✗ ${label} 失败：Exit ${result.status}（${cost}s）`);
    for (const hint of hints) log(`  建议：${hint}`);
    process.exit(result.status === null ? 1 : result.status);
  }
  log(`✓ ${label} 通过（${cost}s）`);
}

/**
 * 执行外部可执行文件（非 node 入口）：命令名 + 参数数组直传（无 shell）。
 * 与 runStep 共用日志与失败语义，用于 cargo check 等工具链命令。
 *
 * @param {number|string} index   步骤序号
 * @param {string} label          展示名
 * @param {string[]} command      命令与参数（首项为可执行文件名）
 * @param {string[]} [hints]      失败时的建议命令
 */
function runToolStep(index, label, command, hints = []) {
  log(`━━━ [${index}/${STEP_TOTAL}] ${label} ━━━`);
  const startedAt = Date.now();
  const [exe, ...args] = command;
  const result = spawnSync(exe, args, {
    cwd: PROJECT,
    stdio: 'inherit',
  });
  const cost = ((Date.now() - startedAt) / 1000).toFixed(1);

  if (result.error) {
    log(`✗ ${label} 启动失败：${result.error.message}（${cost}s）`);
    process.exit(1);
  }
  if (result.status !== 0) {
    log(`✗ ${label} 失败：Exit ${result.status}（${cost}s）`);
    for (const hint of hints) log(`  建议：${hint}`);
    process.exit(result.status === null ? 1 : result.status);
  }
  log(`✓ ${label} 通过（${cost}s）`);
}

/** 前置检查：本地入口存在，避免以「模块找不到」掩盖真实问题 */
function ensureEntry(file, hint) {
  if (existsSync(file)) return;
  log(`✗ 缺少本地可执行入口：${rel(file)}`);
  log(`  建议：${hint}`);
  process.exit(1);
}

/* ───────────────── 桌面产物新鲜度闸门（第 5 步内自检 + 自愈） ─────────────────
   历史事故：终端里 tsc / vercel 前几步全绿，但人工到归档目录找不到产物。
   根因是「桌面 exe 内嵌的 dist 过期」这条判据原先只在第 6 步（prepare-release）生效：
     · Playwright 的 prepareDist() 会重建 dist/index.html（mtime 变新）；
     · 若随后 cargo 因指纹未变而跳过链接，JU.exe 的 mtime 仍停留在旧时间；
     · 第 6 步时间戳闸门中止 → 归档目录一个文件都不产出，却只剩一条靠后的错误。
   现把检查前移到第 5 步（tauri build 之后立即自检），并在首次不新鲜时**触碰** main.rs
   的 mtime（内容不变，仅强制 cargo 重编）后重试一次；仍不新鲜才中止，且报错位置准确
   指向桌面构建步骤。 */
const DIST_HTML = path.join(PROJECT, 'dist', 'index.html');
const TAURI_SRC = path.join(PROJECT, 'src-tauri', 'src', 'main.rs');
const TAURI_RELEASE_DIR = path.join(PROJECT, 'src-tauri', 'target', 'release');
const EXE_CANDIDATES = ['app.exe', 'JU.exe', 'ju.exe', 'Ju.exe'];

/** 解析桌面产物（Windows 文件系统大小写不敏感，三个候选名逐一探测） */
function findDesktopExe() {
  for (const name of EXE_CANDIDATES) {
    const abs = path.join(TAURI_RELEASE_DIR, name);
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return null;
}

/** 返回 null = 新鲜；否则返回不新鲜的原因（供日志 / 中止信息使用） */
function staleReason() {
  if (!existsSync(DIST_HTML)) return `缺少 Web 产物 ${rel(DIST_HTML)}（第 3 步 vite build 未产出）`;
  const exe = findDesktopExe();
  if (!exe) return `缺少桌面产物 ${rel(path.join(TAURI_RELEASE_DIR, EXE_CANDIDATES[0]))}（第 4 步 tauri build 未产出）`;
  const web = statSync(DIST_HTML);
  const bin = statSync(exe);
  if (bin.mtimeMs < web.mtimeMs) {
    return `exe 早于 Web 产物：${rel(exe)} ${bin.mtime.toISOString()} < ${rel(DIST_HTML)} ${web.mtime.toISOString()}`;
  }
  /* Rust 源（main.rs/Cargo.toml/build.rs）任一晚于 exe 即不新鲜：旧 exe 不得带着旧后端逻辑归档（ISSUE-001） */
  let newest = null;
  for (const f of [TAURI_SRC, path.join(PROJECT, 'src-tauri', 'Cargo.toml'), TAURI_BUILD_RS]) {
    if (!existsSync(f)) continue;
    const m = statSync(f).mtimeMs;
    if (!newest || m > newest.m) newest = { f, m };
  }
  if (newest && bin.mtimeMs < newest.m) {
    return `exe 早于 Rust 源：${rel(exe)} ${bin.mtime.toISOString()} < ${rel(newest.f)} ${new Date(newest.m).toISOString()}`;
  }
  return null;
}

/** 打印两端绝对路径 + 字节数 + mtime，便于人工核对（不依赖 CWD） */
function logFreshness(tag) {
  const web = existsSync(DIST_HTML) ? statSync(DIST_HTML) : null;
  const exe = findDesktopExe();
  const bin = exe ? statSync(exe) : null;
  log(`${tag}`);
  log(`  web ${web ? `${path.join(PROJECT, 'dist', 'index.html')}  ${web.size} B  ${web.mtime.toISOString()}` : '(缺失)'}`);
  log(`  exe ${bin && exe ? `${exe}  ${bin.size} B  ${bin.mtime.toISOString()}` : '(缺失)'}`);
}

/* ───────────── tauri-codegen 资产残留清理（第 4 步前置，P1 · 第三轮） ─────────────
   历史事故：`tauri-codegen-assets` 目录**不会**在每次构建前自动清空。tauri-codegen 以
   内容哈希命名每个压缩资产（如 `c7a0dcc8….html`），内容一变哈希就变，旧哈希文件原地残留。
   于是 `src-tauri/target/release/build/<pkg>-<hash>/out/tauri-codegen-assets/` 会累积：
     · 上一轮的 index.html（旧哈希）
     · 更早轮次的 index.html（更旧哈希）
     · 以及历史 D-05b 事故期从 dist/release 内嵌进来的旧 exe
   这些残留虽大多「未进入当前 exe」，但会被审计脚本计为 `[stale]`，掩盖「exe 内到底嵌了几份」
   这一核心判据。本轮在 tauri build **之前**清空该目录，并触碰 `src-tauri/build.rs`（内容不变）
   强制 Cargo 重跑 build script，生成一份**干净**的资产目录，使构建后 stale 恒为 0。
   【安全边界】只清理 `src-tauri/target/release/build/<pkg>-<hash>/out/tauri-codegen-assets`，
   绝不触碰 `src-tauri/gen`（用户/CLI 生成配置）与 `target/release` 其它产物。 */
const TAURI_BUILD_DIR = path.join(PROJECT, 'src-tauri', 'target', 'release', 'build');
const TAURI_BUILD_RS = path.join(PROJECT, 'src-tauri', 'build.rs');
const CODEGEN_ASSET_LEAF = path.join('out', 'tauri-codegen-assets');

/** 枚举 target/release/build/<pkg>-<hash>/out/tauri-codegen-assets（一次构建可能对应多个 pkg-hash 目录） */
function findCodegenAssetDirs() {
  const hits = [];
  let entries = [];
  try {
    entries = readdirSync(TAURI_BUILD_DIR, { withFileTypes: true });
  } catch {
    return hits;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const cand = path.join(TAURI_BUILD_DIR, e.name, CODEGEN_ASSET_LEAF);
    if (existsSync(cand)) hits.push(cand);
  }
  return hits;
}

/** 清空历史 codegen 资产目录（仅 target/release/build 下），返回被删除的文件数 */
function cleanCodegenAssets() {
  const dirs = findCodegenAssetDirs();
  if (!dirs.length) {
    log('✓ 无历史 codegen 资产残留（target/release/build 下无 tauri-codegen-assets）');
    return 0;
  }
  let removed = 0;
  for (const dir of dirs) {
    let names = [];
    try { names = readdirSync(dir); } catch { names = []; }
    log(`  清理 codegen 资产目录：${rel(dir)}（${names.length} 个文件）`);
    for (const name of names) {
      let size = '?';
      try { size = statSync(path.join(dir, name)).size + ' B'; } catch { /* ignore */ }
      log(`    - ${name}  ${size}`);
      removed += 1;
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      log(`✗ codegen 资产清理失败：${rel(dir)} —— ${String((e && e.message) || e)}`);
      log('  请手工删除该目录后重跑（本次不继续构建，避免 stale 资产污染审计结论）');
      process.exit(1);
    }
  }
  /* 触碰 build.rs（内容不变），强制 Cargo 重新执行 build script → 重新生成干净资产目录 */
  try {
    const now = new Date();
    utimesSync(TAURI_BUILD_RS, now, now);
    log(`  已触碰 ${rel(TAURI_BUILD_RS)}（强制 codegen 重建）`);
  } catch (e) {
    log(`  ⚠ 触碰 build.rs 失败（${String((e && e.message) || e)}），依赖 dist 变更触发重编`);
  }
  log(`✓ codegen 资产清理完成：目录 ${dirs.length} 个 / 文件 ${removed} 个（构建后应 stale=0）`);
  return removed;
}

/** 构建后复核：codegen 资产目录里只允许出现「当前这一份」HTML（stale 必须为 0） */
function assertCodegenClean() {
  const dirs = findCodegenAssetDirs();
  if (!dirs.length) return;
  let staleLike = 0;
  for (const dir of dirs) {
    const names = (() => { try { return readdirSync(dir); } catch { return []; } })();
    const htmls = names.filter((n) => /\.html?$/i.test(n));
    const exes = names.filter((n) => /\.exe$/i.test(n));
    log(`  codegen 资产（构建后）：${rel(dir)}  html=${htmls.length} exe=${exes.length}  [${names.join(', ')}]`);
    /* 构建前已清空，故此处每一项都应是本轮的；若仍出现上一轮 exe，说明清理/重编未生效 */
    if (exes.length) staleLike += exes.length;
    if (htmls.length > 1) staleLike += htmls.length - 1;
  }
  if (staleLike > 0) {
    log(`✗ codegen 资产目录疑似残留/未清理（stale_like=${staleLike}），审计的 stale 判据将不可信`);
    log('  建议：cargo clean -p app --manifest-path src-tauri/Cargo.toml 后重跑本脚本');
    process.exit(1);
  }
  log('✓ codegen 资产目录干净（仅本轮产物，无残留 HTML/exe）');
}

/* ────────────────────────── 流水线 ────────────────────────── */

ensureEntry(TSC_JS, '先执行 npm ci / npm install 安装 devDependencies');
ensureEntry(VITE_JS, '先执行 npm ci / npm install 安装 devDependencies');
ensureEntry(PLAYWRIGHT_CLI, '先执行 npm ci / npm install 安装 @playwright/test');
ensureEntry(TAURI_JS, '先执行 npm ci / npm install 安装 @tauri-apps/cli');

log(`产品件（m07-vite）本地一键发版开始（共 ${STEP_TOTAL} 步）：tsc → 1b → 1c → 1d → 1e → 1f → 1g → 1h → test → vite → 3b → e2e → tauri → prepare-release → 6b`);

runStep(1, '类型检查 tsc --noEmit', [TSC_JS, '--noEmit'], ['npx tsc --noEmit']);

/* 装配门禁：src/main.ts 装配块若残留空壳依赖，后续 test/e2e/tauri 仍会全绿，故发版前必判。 */
runStep('1b', '装配门禁 check-deps-wired', [path.join(PROJECT, 'scripts', 'check-deps-wired.mjs')], ['node scripts/check-deps-wired.mjs', '按 src/main.ts 装配块恢复真实函数引用（禁止 noop / () => null）']);
runStep('1g', 'CSS 令牌门禁 check-css-tokens', [path.join(PROJECT, 'scripts', 'check-css-tokens.mjs')], ['node scripts/check-css-tokens.mjs', '裸 hex / !important 只降不升，新增须走 CSS 变量']);
runStep('1h', '打包脚本回归 check-package-scripts', [path.join(PROJECT, 'scripts', 'check-package-scripts.mjs')], ['node scripts/check-package-scripts.mjs', 'exe 候选含 app.exe / setup 入清单 / 固定名目录 / 内容优先判定']);

/* 零漂移闸门：仓库根 canonical 与产物逐字节比对，防止「构建成功但内容漂移」。 */
runStep('1c', '零漂移与内联样式闸门', [path.join(PROJECT, 'scripts', 'check-parity.mjs')], ['node scripts/check-parity.mjs']);

/* 许可审计：强传染协议（AGPL/GPL/SSPL）随分发即触发合规义务，故发版前必判。 */
runStep('1d', '许可审计 audit-license', [path.join(PROJECT, 'scripts', 'audit-license.mjs'), '--check'], ['node scripts/audit-license.mjs --check']);

/* 未使用导出统计：以基线 docs/UNUSED-EXPORTS.md 的 214 为上限（超出即失败）；--check 只计算不写 docs（人工更新用 --write）。 */
runStep('1e', '未使用导出统计 check-unused-exports', [path.join(PROJECT, 'scripts', 'check-unused-exports.mjs'), '--check'], ['node scripts/check-unused-exports.mjs --check', '人工更新报告用 --write']);
runStep('1f', '安全闸门 check-security', [path.join(PROJECT, 'scripts', 'check-security.mjs')], ['node scripts/check-security.mjs', '私钥出仓 / 无生产调试日志 / 无 CORS *']);

/* Rust 编译检查：Web 侧全绿但 Rust 源码语法/类型错误时，后续 tauri build 才暴露且代价高，故前移到 1f。 */
runToolStep('1f', 'Rust 编译检查', ['cargo', 'check', '--manifest-path', 'src-tauri/Cargo.toml'], ['cargo check --manifest-path src-tauri/Cargo.toml']);

/* Rust 用例：cargo check 只编译不执行断言，数据安全用例（sync_all 失败必须返回 Err 等）须在发版前真跑，失败即中止。 */
runToolStep('1g', 'Rust 用例', ['cargo', 'test', '--manifest-path', 'src-tauri/Cargo.toml'], ['cargo test --manifest-path src-tauri/Cargo.toml']);

/* 回执扫描：90过程材料/tmp/<batch>/receipt.json 缺失仅告警（不阻断发版），供人工补录。 */
const RECEIPT_ROOT = path.resolve(PROJECT, '..', '99.hist', '9.ops', 'batches');
log(`━━━ [1h/${STEP_TOTAL}] 回执扫描 ━━━`);
let receiptBatches = [];
try {
  receiptBatches = readdirSync(RECEIPT_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
} catch {
  log(`⚠ 回执目录不存在：${path.join('99.hist', '9.ops', 'batches')}（跳过，不阻断）`);
}
const receiptMissing = receiptBatches.filter((batch) => !existsSync(path.join(RECEIPT_ROOT, batch, 'receipt.json')));
for (const batch of receiptMissing) log(`⚠ 无回执 ${batch}`);
log(`✓ 回执扫描完成：批次 ${receiptBatches.length} 个，缺回执 ${receiptMissing.length} 个（不阻断）`);

runStep(
  2,
  '契约单元测试 node --test test/*.mjs src/test/*.mjs',
  ['--test', 'test/*.mjs', 'src/test/*.mjs'],
  ['npm test', 'node --test test/contract.test.mjs test/api-shape.test.mjs'],
);

runStep(3, 'Web 构建 vite build', [VITE_JS, 'build'], ['npm run build']);

/* 内联样式闸门需读取 dist 产物，故挂在第 3 步之后。 */
runStep('3b', '内联样式闸门', [path.join(PROJECT, 'scripts', 'check-inline-style.mjs')], ['node scripts/check-inline-style.mjs']);

/* ───────────────── Web 产物内容闸门（紧跟第 3 步，基于字节而非时间戳） ─────────────────
   历史事故：`vite build` 报成功、`dist/index.html` 的 mtime 也是新的，但字节与上一版
   完全一致（入口指向旧 HTML / 打包了旧文件 / node_modules/.vite 缓存命中），
   表现为「源码改了、产物没变，只是时间戳变了」。仅比 mtime 无法识别，故直接校验内容：
     ① 产物必须含本轮源码的特征符号；
     ② 打印字节数与 SHA-256，供与上一版差异对比与哈希留档。 */
const WEB_BUNDLE = path.join(PROJECT, 'dist', 'index.html');
const WEB_BUNDLE_MARKERS = ['applyInlineStyle', 'normalizeInlineStyles', 'initRichtextStyleMode'];

async function assertWebBundleFingerprint() {
  if (!existsSync(WEB_BUNDLE) || !statSync(WEB_BUNDLE).isFile()) {
    log(`✗ 缺少 Web 产物 ${rel(WEB_BUNDLE)}（vite build 未产出 index.html）`);
    process.exit(1);
  }
  const html = readFileSync(WEB_BUNDLE, 'utf8');
  const bytes = statSync(WEB_BUNDLE).size;
  const hash = await sha256(WEB_BUNDLE);
  log(`Web 产物指纹：${rel(WEB_BUNDLE)}  ${bytes} B  SHA-256 ${hash}`);
  const missing = WEB_BUNDLE_MARKERS.filter((m) => !html.includes(m));
  if (missing.length) {
    log(`✗ Web 产物缺少本轮源码特征符号：${missing.join(', ')}`);
    log('  排查顺序：vite.config.ts 的 build.rollupOptions.input -> index.html 的 script src -> 清理 node_modules/.vite');
    process.exit(1);
  }
  log(`✓ Web 产物含特征符号：${WEB_BUNDLE_MARKERS.join(', ')}`);
}

await assertWebBundleFingerprint();

/* ───────────────── 第 4 步 · E2E 门禁（ISSUE-011） ─────────────────
   发版链路必须包含 E2E：历史上发布包只在「tsc + 单测 + vite build」之后就被归档，
   真实浏览器里的冒烟 / 全链路 / 多标签并发回归全部靠人工补跑，出过「单元测试全绿、发出去
   的包里主视图白屏」的事故。

   位置选择（vite build 之后、tauri build 之前）：
     · E2E 依赖可用的 dist 产物（各 spec 的 prepareDist() 会自行重建 dist/index.html）；
     · E2E 重建后的 dist 正是随后被 `tauri build` 内嵌进 exe 的那一份字节，
       因此「测过的包」与「发出去的包」是同一次构建，不存在测旧包；
     · 失败即 `process.exit(1)`（runStep 内统一处理，退出码透传），不会继续产出发布包。 */
/* 单一真相源（fix27-1/8）：E2E 清单统一登记于 gate-manifest.json，本文件不再手写 */
const GATE_MANIFEST = JSON.parse(readFileSync(path.join(PROJECT, 'gate-manifest.json'), 'utf8'));
const E2E_SPECS = GATE_MANIFEST.e2e_specs;

/* 关闭链路定向用例：清单取自 gate-manifest.json.closed_high_specs，并与 tests/ 目录扫描互校
   （新增 spec 漏登记、清单引用已删文件均 Exit 1）；反向核对 E2E_SPECS 逻辑见下方 CLOSED_HIGH_GONE。 */
const CLOSED_HIGH_RE = /^(?:v21-(?:review|fixr|fixhex)|review18-)\d+.*\.spec\.ts$/;
const TESTS_DIR_FILES = readdirSync(path.join(PROJECT, 'tests'));
const CLOSED_HIGH_SPECS = GATE_MANIFEST.closed_high_specs;
const CLOSED_HIGH_SCAN = TESTS_DIR_FILES.filter((f) => CLOSED_HIGH_RE.test(f)).map((f) => `tests/${f}`);
if ([...CLOSED_HIGH_SCAN].sort().join('|') !== [...CLOSED_HIGH_SPECS].sort().join('|')) { log('✗ gate-manifest.json closed_high_specs 与 tests/ 扫描不一致'); process.exit(1); }
log(`CLOSED_HIGH_SPECS: ${CLOSED_HIGH_SPECS.length} 项`);
const CLOSED_HIGH_MISSING = CLOSED_HIGH_SPECS.filter((s) => !E2E_SPECS.includes(s));
if (CLOSED_HIGH_MISSING.length) { log(`✗ 发版 E2E 缺少关闭链路定向用例：${CLOSED_HIGH_MISSING.join(', ')}`); process.exit(1); }
const CLOSED_HIGH_GONE = E2E_SPECS.filter((s) => CLOSED_HIGH_RE.test(s.replace(/^tests\//, '')) && !CLOSED_HIGH_SPECS.includes(s));
if (CLOSED_HIGH_GONE.length) { log(`✗ 发版 E2E 引用的关闭链路定向用例已不存在：${CLOSED_HIGH_GONE.join(', ')}`); process.exit(1); }

/* 必检探针（review17-11 / ISSUE-011）：上面的 CLOSED_HIGH_MISSING 只覆盖「文件已存在但未登记」，
   文件从未建立时扫描集合为空、判据恒绿（CLOSED_HIGH_MISSING=0 不等于探针齐备）。
   此处按 review9 批次号建白名单，命名沿用 tests/ 实有 `v21-review9-NN-*.spec.ts` 约定
   （只锁批次号，不锁描述后缀），缺任一即发行阻断。缺口登记见 docs/OPEN-ISSUES.md · ISSUE-005 承接项。 */
const REQUIRED_PROBES = GATE_MANIFEST.required_probes.map((p) => ({ id: p.id, re: new RegExp(p.re) }));
const REQUIRED_PROBES_MISSING = REQUIRED_PROBES.filter((p) => !TESTS_DIR_FILES.some((f) => p.re.test(f))).map((p) => p.id);
log(`REQUIRED_PROBES: ${REQUIRED_PROBES.length} 项 · 缺失 ${REQUIRED_PROBES_MISSING.length}`);
if (REQUIRED_PROBES_MISSING.length) { log(`✗ 必检探针缺失：${REQUIRED_PROBES_MISSING.join(', ')}（tests/ 无对应 v21-review9-NN-*.spec.ts）`); process.exit(1); }

runStep(
  4,
  'E2E 冒烟 + 全链路 + 并发（playwright）',
  [PLAYWRIGHT_CLI, 'test', ...E2E_SPECS],
  [
    'npx playwright test ' + E2E_SPECS.join(' '),
    'npx playwright install chromium（缺少浏览器时）',
  ],
);

log('E2E 重建后的 Web 产物指纹（即将被 tauri build 内嵌的字节）：');
await assertWebBundleFingerprint();

/* ───────────────── dist 内嵌范围闸门（第 3b 步 / 第 4 步前置） ─────────────────
   【D-05b 根因】Tauri（v1）在编译期按 tauri.conf.json 的 distDir（../dist）**递归**内嵌整个
   目录。历史实现把发布归档写在 dist/release/ 内，于是每轮重建都会把上一轮的
   JU-v2.1-Web.html（4.6 MB）+ 上一轮 JU-v2.1-win-x64.exe（10.4 MB）一并打进新 exe，
   体积 10.4 MB → 18.9 MB，且 exe 内出现「两份 HTML」。
   【本轮处置】归档目录整体迁到仓库级 99.hist/8.rel/<版本>/（scripts/release-paths.mjs），
   dist/ 只剩 index.html；此处保留两条硬闸门，任何回退都会在这里被抓到：
     ① `dist/` 顶层只允许 index.html 一个文件、且不允许任何子目录；
     ② 历史遗留的 `dist/release/` 若存在，搬到 node_modules/.cache/ju-legacy-dist-release
        （只搬不删，绝不重新搬回 dist —— 搬回就会重新被内嵌）。 */
const LEGACY_DIST_RELEASE = path.join(PROJECT, 'dist', 'release');
const LEGACY_BACKUP = path.join(PROJECT, 'node_modules', '.cache', 'ju-legacy-dist-release');

function purgeLegacyDistRelease() {
  if (!existsSync(LEGACY_DIST_RELEASE)) return;
  try {
    mkdirSync(path.dirname(LEGACY_BACKUP), { recursive: true });
    rmSync(LEGACY_BACKUP, { recursive: true, force: true });
    renameSync(LEGACY_DIST_RELEASE, LEGACY_BACKUP);
    log(`⚠ 发现历史遗留 ${rel(LEGACY_DIST_RELEASE)}，已搬离 dist（备份：${rel(LEGACY_BACKUP)}）`);
    log('  归档位置已改为 99.hist/8.rel/<版本>/，dist 内不再保留发布包');
  } catch (e) {
    log(`✗ 历史 dist/release 搬离失败：${String((e && e.message) || e)}`);
    log('  该目录会被 tauri build 递归内嵌进 exe —— 请手工移出 dist 后重跑');
    process.exit(1);
  }
}

function assertDistSingleHtml() {
  const distDir = path.join(PROJECT, 'dist');
  const entries = readdirSync(distDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  const htmlFiles = files.filter((n) => /\.html?$/i.test(n));
  log(`dist 内容：files=[${files.join(', ')}]  dirs=[${dirs.join(', ')}]`);
  if (dirs.length) {
    log(`✗ dist 下存在子目录（会被 Tauri 递归内嵌）：${dirs.join(', ')}`);
    process.exit(1);
  }
  if (htmlFiles.length !== 1 || htmlFiles[0] !== 'index.html') {
    log(`✗ dist 下 HTML 不是恰好一份 index.html：${htmlFiles.join(', ') || '(none)'}`);
    process.exit(1);
  }
  log('✓ dist 内 HTML 恰好 1 份：index.html（内嵌范围收敛）');
}

purgeLegacyDistRelease();
assertDistSingleHtml();

/* 第 5 步前置：清空历史 tauri-codegen 资产（target/release/build/*），
   并触碰 build.rs 强制重编，使构建后 stale 恒为 0（第三轮 P1） */
log('清理历史 tauri-codegen 资产残留（第 5 步前置）：');
cleanCodegenAssets();

/* ISSUE-011：安装包产出默认开启（BUNDLES=nsis），JU_BUNDLES=none 可关闭 */
const TAURI_BUILD_ARGS = [TAURI_JS, 'build', '--bundles', BUNDLES, '--ci'];

runStep(
  5,
  `桌面构建 tauri build --bundles ${BUNDLES}`,
  TAURI_BUILD_ARGS,
  ['确认已安装 Rust 工具链（cargo --version）', `npm run tauri build -- --bundles ${BUNDLES}`],
);

logFreshness('第 5 步产出时间戳：');
let stale = staleReason();
if (stale) {
  log(`⚠ 桌面产物不新鲜：${stale}`);
  log(`  自愈：仅触碰 ${rel(TAURI_SRC)} 的 mtime（内容不变），强制 cargo 重编并重新内嵌最新 dist`);
  try {
    const now = new Date();
    utimesSync(TAURI_SRC, now, now);
    runStep(5, '桌面构建 tauri build（强制重编）', TAURI_BUILD_ARGS, ['cargo clean -p app --manifest-path src-tauri/Cargo.toml']);
    logFreshness('强制重编后产物时间戳：');
    stale = staleReason();
  } catch (e) {
    log(`✗ 强制重编失败：${String((e && e.message) || e)}`);
    stale = `强制重编失败：${String((e && e.message) || e)}`;
  }
  if (stale) {
    log(`✗ 桌面产物仍不新鲜：${stale}`);
    log(`  建议：先确认没有 JU.exe 正在运行（进程占用会让 ${rel(path.join(TAURI_RELEASE_DIR, EXE_CANDIDATES[0]))} 无法覆盖）；`);
    log(`        再执行 cargo clean -p app --manifest-path ${rel(path.join(PROJECT, 'src-tauri', 'Cargo.toml'))} 后重跑本脚本`);
    log('  本次未生成 dist/release 归档（归档在复制前中止，不留下半套发布包）');
    process.exit(1);
  }
  log('✓ 强制重编后桌面产物已重新内嵌最新 dist');
}

/* 第 5 步后置：复核 codegen 资产目录无残留（仅本轮产物） */
assertCodegenClean();

/* 归档目录在 dist 之外，桌面构建前后都不需要「搬出 / 搬回」，此处不再有任何恢复动作 */
assertDistSingleHtml();

runStep(
  6,
  '发布归档 prepare-release',
  [path.join(PROJECT, 'scripts', 'prepare-release.mjs')],
  ['先完成 vite build 与 tauri build，再执行 node scripts/prepare-release.mjs'],
);

/* ───────────────── 归档一致性闸门（第 6 步后，逐字节比对） ─────────────────
   归档目录独立于 dist（99.hist/8.rel/<版本>/），不会被 `vite build` 触碰。
   此处仍把归档副本与最新产物做 SHA-256 逐字节比对：只跑了 Web 构建而没重跑打包时，
   归档里仍是上一轮的旧包，必须在这里硬失败，不能靠时间戳「看起来是新的」。 */
async function assertReleaseSynced() {
  const jobs = [
    { src: WEB_BUNDLE, copy: path.join(RELEASE_DIR, WEB_OUT_NAME) },
    { src: findDesktopExe(), copy: path.join(RELEASE_DIR, EXE_OUT_NAME) },
  ];
  for (const job of jobs) {
    if (!job.src || !existsSync(job.src) || !existsSync(job.copy)) {
      log(`✗ 归档一致性核对缺少文件：${job.src ? rel(job.src) : '(未找到桌面产物)'} / ${rel(job.copy)}`);
      process.exit(1);
    }
    const srcHash = await sha256(job.src);
    const copyHash = await sha256(job.copy);
    if (srcHash !== copyHash) {
      log(`✗ 归档副本与最新产物不一致：${rel(job.copy)}`);
      log(`  产物 ${rel(job.src)}  ${srcHash}`);
      log(`  副本 ${rel(job.copy)}  ${copyHash}`);
      process.exit(1);
    }
    log(`✓ 归档同步：${rel(job.copy)} == ${rel(job.src)}（${srcHash}）`);
  }
}

await assertReleaseSynced();

/* ISSUE-011：BUNDLES=nsis（默认）时把 NSIS 安装包并入归档目录并在 checksums 中登记 */
if (BUNDLES !== 'none') {
  const NSIS_DIR = path.join(PROJECT, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
  const built = existsSync(NSIS_DIR) ? readdirSync(NSIS_DIR).find((n) => /-setup\.exe$/i.test(n)) : '';
  if (!built) {
    log(`✗ 未找到 NSIS 安装包：${rel(NSIS_DIR)}/*-setup.exe（检查 tauri.conf.json build.bundle.targets）`);
    process.exit(1);
  }
  const builtPath = path.join(NSIS_DIR, built);
  const exeNow = findDesktopExe();
  if (statSync(builtPath).mtimeMs < (exeNow ? statSync(exeNow).mtimeMs : Infinity)) {
    log(`✗ NSIS 安装包非本批产出：${rel(builtPath)} 早于桌面产物，拒绝复用（重跑第 5 步 tauri build --bundles nsis）`);
    process.exit(1);
  }
  const setupName = `JU_${PKG_VERSION}_x64-setup.exe`;
  const setupPath = path.join(RELEASE_DIR, setupName);
  copyFileSync(builtPath, setupPath);
  const sumsPath = path.join(RELEASE_DIR, CHECKSUMS_NAME);
  const sumRows = readFileSync(sumsPath, 'utf8').split('\n').filter((l) => l.trim() && !l.endsWith('  ' + setupName));
  sumRows.push(`${await sha256(setupPath)}  ${setupName}`);
  sumRows.sort((a, b) => a.split('  ')[1].localeCompare(b.split('  ')[1]));
  writeFileSync(sumsPath, sumRows.map((l) => l + '\n').join(''), 'utf8');
  log(`✓ NSIS 入档：${setupName} → ${rel(setupPath)}（已登记 checksums）`);
  /* 【ISSUE-010】setup 与最终 checksums 已落盘 → 按真实字节重写归档自带说明与清单（只补文档） */
  const docsRun = spawnSync(process.execPath, [path.join(PROJECT, 'scripts', 'prepare-release.mjs')], {
    cwd: PROJECT,
    env: { ...process.env, JU_RELEASE_DOCS_ONLY: '1' },
    stdio: 'inherit',
  });
  if (docsRun.status !== 0) { log('✗ ISSUE-010 归档说明与清单生成失败（JU_RELEASE_DOCS_ONLY=1）'); process.exit(1); }
}

/* ISSUE-006 三角校验：最新归档 Web 与 dist/index.html 的 SHA-256 必须一致。
   必须在本轮 setup 入档、checksums 补齐 3 行之后执行——放在 prepare-release 之后、
   NSIS 入档之前时，新归档目录恒缺 setup，parity 的 ISSUE-007 判据会必红。 */
runStep('6b', '归档三角校验 check-release-parity', [path.join(PROJECT, 'scripts', 'check-release-parity.mjs')], ['node scripts/check-release-parity.mjs']);

/* ────────────────────── 产物清单（真实扫描） ────────────────────── */

const DIST = path.join(PROJECT, 'dist');

/**
 * 收集产物：dist/index.html + 归档目录（99.hist/8.rel/<版本>）下的全部文件。
 * `*.bak-*` 是人工备份（D-02 / D-05 等留档）、`.prev-*` 是同日重打包让位出的旧归档
 * （ISSUE-005），均不属于本轮产物，清单里按名排除。
 */
function collectArtifacts() {
  const files = [];
  const webBundle = path.join(DIST, 'index.html');
  if (existsSync(webBundle) && statSync(webBundle).isFile()) files.push(webBundle);
  if (existsSync(RELEASE_DIR)) {
    for (const name of readdirSync(RELEASE_DIR).sort()) {
      if (/\.bak[-.]|\.prev[-.]/i.test(name)) continue;
      const abs = path.join(RELEASE_DIR, name);
      if (statSync(abs).isFile()) files.push(abs);
    }
  }
  return files;
}

const artifacts = collectArtifacts();
if (artifacts.length === 0) {
  log('✗ 未发现任何构建产物（dist/ 为空），请检查前置步骤输出');
  process.exit(1);
}

log('');
log('══════════════════ 构建产物清单 ══════════════════');
log('');

const rows = [];
for (const abs of artifacts) {
  const bytes = statSync(abs).size;
  const hash = await sha256(abs);
  rows.push({ name: rel(abs), bytes, hash });
}

const nameWidth = Math.max(...rows.map((r) => r.name.length), '文件'.length);
log(`${'文件'.padEnd(nameWidth)}  ${'字节'.padStart(12)}  SHA-256`);
log(`${'-'.repeat(nameWidth)}  ${'-'.repeat(12)}  ${'-'.repeat(64)}`);
for (const r of rows) {
  log(`${r.name.padEnd(nameWidth)}  ${String(r.bytes).padStart(12)}  ${r.hash}`);
}

const totalBytes = rows.reduce((sum, r) => sum + r.bytes, 0);
log('');
log(`合计 ${rows.length} 个文件，${totalBytes.toLocaleString('en-US')} 字节`);
log('✓ 一键发版链路完成');
