#!/usr/bin/env node
/* WEB_MISMATCH 三角校验：最新归档 Web 与 dist/index.html 的 SHA-256 必须一致（仅读元数据 + 哈希）；历史编号 006 */
/* DEGRADED：--ci-mode / GITHUB_ACTIONS / 检测不到 src-tauri/target/release/*.exe 时降级为
   「仅校验归档目录内 Web/exe/setup/checksums 自洽」，不再要求构建产物（干净 runner 不得报 EXE_MISMATCH） */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { CHECKSUMS_NAME, DESKTOP_RELEASE_DIR, EXE_OUT_NAME, MANIFEST_NAME, PKG_VERSION, PROJECT, REPO_ROOT, WEB_BUNDLE, WEB_OUT_NAME, relFromRepo, resolveLatestReleaseDir } from './release-paths.mjs';
import { srcFingerprint } from './gen-src-fingerprint.mjs';

const ROOT = path.join(REPO_ROOT, '99.hist', '8.rel');
/* 归档目录由 release-paths 的 resolveLatestReleaseDir 解析：显式 JU_BUILD_DATE 严格取名（缺目录即失败，不静默降级）；
   未显式时取最新非 .prev-* 归档目录且不按 manifest 过滤（ISSUE-002），最新目录缺清单即失败，禁回退更旧归档 */
const dir = resolveLatestReleaseDir();
const latest = existsSync(dir) ? path.relative(ROOT, dir) : '';
const archived = latest ? path.join(ROOT, latest, WEB_OUT_NAME) : dir;
const errors = [];
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
/* ISSUE-002：最新归档缺 manifest 时先给出明确诊断，不得静默跳到更旧归档而放过未发布目录 */
if (existsSync(dir) && !existsSync(path.join(dir, MANIFEST_NAME))) { console.error('[parity] ✗ LATEST_ARCHIVE_NO_MANIFEST 最新归档缺 release-manifest.json ' + relFromRepo(dir)); errors.push('LATEST_ARCHIVE_NO_MANIFEST'); }
/* ARTIFACT_MISMATCH 可重复、可诊断：缺件记入 errors 后继续跑完其余判据，不得以 ENOENT 堆栈崩溃（历史编号 009） */
const hasArchived = existsSync(archived);
if (!hasArchived) { console.error('[parity] ✗ 缺少 ' + relFromRepo(archived) + '（先跑 build-all 或设置 JU_BUILD_DATE）'); errors.push('ARTIFACT_MISMATCH'); }
/* 构建产物探测先于 Web 比对：缺失即降级，避免干净 runner 因 target/ 被 gitignore 而必红 */
const builtExe = ['app.exe', 'ju.exe', 'JU.exe', 'Ju.exe'].map((n) => path.join(DESKTOP_RELEASE_DIR, n)).find((p) => existsSync(p));
const ciMode = process.argv.includes('--ci-mode') || process.env.GITHUB_ACTIONS === 'true';
const degraded = ciMode || !builtExe;
if (degraded) {
  console.log('[parity] DEGRADED 归档自洽模式（' + (ciMode ? '--ci-mode/CI 环境' : '未检测到 src-tauri/target/release exe') + '）：跳过与 dist/exe 的构建产物比对');
}
if (!degraded) {
  if (!existsSync(WEB_BUNDLE)) { console.error('[parity] ✗ 缺少 ' + relFromRepo(WEB_BUNDLE) + '（先跑 build-all 或设置 JU_BUILD_DATE）'); errors.push('WEB_MISSING'); }
  else if (hasArchived) {
    const a = sha(archived), b = sha(WEB_BUNDLE);
    console.log('[parity] ' + latest + '/' + WEB_OUT_NAME + '  ' + a + '\n[parity] dist/index.html  ' + b);
    if (a !== b) {
      console.log('[parity] ✗ WEB_MISMATCH 归档 Web 与 dist 不一致（发布包内嵌旧前端）');
      errors.push('WEB_MISMATCH');
    } else {
      console.log('[parity] ✓ 归档 Web 与 dist 一致');
    }
  }
} else if (existsSync(WEB_BUNDLE) && hasArchived) {
  const a = sha(archived), b = sha(WEB_BUNDLE);
  console.log(a === b ? '[parity] ✓ 附带比对：归档 Web 与 dist 一致' : '[parity] ! 附带比对：归档 Web 与 dist 不一致（降级模式不判失败，权威判定在 build-all 6b）');
}
/* EXE_MISMATCH：桌面产物同样纳入三角校验，避免归档 exe 停留在上一轮（历史编号 012） */
const archExe = path.join(ROOT, latest, EXE_OUT_NAME);
const hasArchExe = existsSync(archExe);
if (!degraded) {
  const c = hasArchExe ? sha(archExe) : '';
  const d = sha(builtExe);
  console.log('[parity] ' + latest + '/' + EXE_OUT_NAME + '  ' + (c || '(缺失)') + '\n[parity] ' + path.relative(REPO_ROOT, builtExe) + '  ' + d);
  if (!c || c !== d) { console.log('[parity] ✗ EXE_MISMATCH 归档 exe 与构建产物不一致'); errors.push('EXE_MISMATCH'); }
  else console.log('[parity] ✓ 归档 exe 与构建产物一致');
} else if (!hasArchExe) {
  console.error('[parity] ✗ ARTIFACT_MISMATCH 归档 exe 缺失 ' + relFromRepo(archExe));
  errors.push('ARTIFACT_MISMATCH');
}
/* EXE_AFTER_RELEASE：降级（干净检出无 dist / 无构建产物 exe）时以归档目录名中的发布日为锚点，
   归档 exe 晚于该日末即说明包内 exe 非发布日同批构建（Rust/前端源已超出发布日），CI/PR 阶段直接判红；
   dist 缺失时只读归档 exe 元数据，不得 ENOENT（ISSUE-002） */
if (degraded) {
  const ymd = (/v[\d.]+-(\d{4}-\d{2}-\d{2})$/).exec(latest || '');
  const releaseEnd = ymd ? Date.parse(ymd[1] + 'T23:59:59Z') : 0;
  const archExeAt = hasArchExe ? statSync(archExe).mtimeMs : 0;
  if (releaseEnd && archExeAt > releaseEnd) {
    console.error('[parity] ✗ EXE_AFTER_RELEASE 归档 exe 晚于发布日 ' + ymd[1] + ' 日末（发布件非发布日同批构建） ' + relFromRepo(archExe) + '  ' + archExeAt + ' > ' + releaseEnd);
    errors.push('EXE_AFTER_RELEASE');
  }
  /* EXE_AFTER_COMMIT：EXE_AFTER_RELEASE 只比发布日末，同日提交（ISSUE-003）落在盲区；
     改取 git 最近一次 src/src-tauri 提交的秒级时间（不得以日末替代）比对归档 exe mtime，
     提交晚于 exe 即说明源码已超出归档 exe；git 不可用或无提交时保持 DEGRADED 并告警，不判红 */
  try {
    const ct = execFileSync('git', ['log', '-1', '--format=%ct', '--', 'src', 'src-tauri/src', 'src-tauri/Cargo.toml', 'src-tauri/build.rs'], { cwd: PROJECT, encoding: 'utf8' }).trim();
    const srcCt = ct ? Number(ct) * 1000 : 0;
    if (srcCt && archExeAt && archExeAt < srcCt) {
      console.error('[parity] ✗ EXE_AFTER_COMMIT 归档 exe 早于 src/src-tauri 最新提交（同日提交未被构建） ' + relFromRepo(archExe) + '  ' + archExeAt + ' < ' + srcCt + ' (' + new Date(srcCt).toISOString() + ')');
      errors.push('EXE_AFTER_COMMIT');
    } else if (archExeAt) {
      console.log('[parity] ✓ 归档 exe 不早于 src/src-tauri 最新提交' + (srcCt ? ' ' + new Date(srcCt).toISOString() : '（无提交记录）'));
    }
  } catch (e) {
    console.warn('[parity] ! git 不可用，src 提交时间未判定，保持 DEGRADED：' + e.message);
  }
}
/* EXE_STALE：exe 不得早于 Web 锚点 = max(归档 Web mtime, 存在时的 dist/index.html mtime)；
   dist 缺失（干净 CI 检出）退回归档锚点，不得因 statSync 缺失路径 ENOENT（ISSUE-002） */
const archivedAt = hasArchived ? statSync(archived).mtimeMs : 0;
const webAnchor = Math.max(archivedAt, existsSync(WEB_BUNDLE) ? statSync(WEB_BUNDLE).mtimeMs : 0);
/* 【review29-04】dist 会被测试/CI 重建（内容不变），mtime 随之晚于归档 exe ⇒ 假红。
   判定改为「内容优先」：dist 与归档 Web 同哈希时，exe 的内嵌前端未变，跳过 mtime 判定；
   内容不同则交由 WEB_MISMATCH 判红，EXE_STALE 只覆盖「内容已变但 exe 未重建」。 */
const distSameAsArchived = existsSync(WEB_BUNDLE) && hasArchived && sha(WEB_BUNDLE) === sha(archived);
if (hasArchExe && webAnchor && statSync(archExe).mtimeMs < webAnchor) {
  if (distSameAsArchived) {
    console.log('[parity] ✓ EXE_STALE 跳过：dist 与归档 Web 同内容（exe 内嵌前端未变）');
  } else {
    console.error('[parity] ✗ EXE_STALE 归档 exe 早于 Web 锚点（旧 exe 混入） ' + relFromRepo(archExe) + '  ' + statSync(archExe).mtimeMs + ' < ' + webAnchor);
    errors.push('EXE_STALE');
  }
}
/* EXE_AFTER_SRC：构建产物 exe 不得早于 src/**（任意文件）+ src-tauri/src/**.rs + Cargo.toml/build.rs 的最后变更，
   否则旧 exe 可绕过内容哈希随新 Web 发布（ISSUE-004/ISSUE-001） */
if (!degraded) {
  let srcLatest = 0;
  const walk = (d, onlyRs) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, onlyRs);
      else if (e.isFile() && (!onlyRs || p.endsWith('.rs'))) srcLatest = Math.max(srcLatest, statSync(p).mtimeMs);
    }
  };
  walk(path.join(PROJECT, 'src'), false);
  walk(path.join(PROJECT, 'src-tauri', 'src'), true);
  for (const f of [path.join(PROJECT, 'src-tauri', 'Cargo.toml'), path.join(PROJECT, 'src-tauri', 'build.rs')]) {
    if (existsSync(f)) srcLatest = Math.max(srcLatest, statSync(f).mtimeMs);
  }
  const builtMtime = statSync(builtExe).mtimeMs;
  /* 【review29-04】tauri build 会在编译后改写 Cargo.toml 的 mtime（内容不变），导致 exe 恒「早于源码」⇒ 假红。
     判定改为「内容优先」：当前源码指纹与归档 src-fingerprint.json 一致时，源码内容未变，跳过 mtime 判定；
     指纹不一致才按 mtime 判红（真改了源码却没重编）。 */
  const fpArchivedPath = path.join(ROOT, latest, 'src-fingerprint.json');
  let fpSame = false;
  try {
    const cur = srcFingerprint();
    const arch = existsSync(fpArchivedPath) ? JSON.parse(readFileSync(fpArchivedPath, 'utf8')) : null;
    fpSame = !!(arch && arch.sha256 === cur.sha256);
  } catch { fpSame = false; }
  if (srcLatest && builtMtime < srcLatest) {
    if (fpSame) {
      console.log('[parity] ✓ EXE_AFTER_SRC 跳过：源码指纹与归档一致（内容未变，exe 无需重编）');
    } else {
      console.error('[parity] ✗ EXE_AFTER_SRC 构建产物 exe 早于源码最新变更（旧 exe 可绕过） ' + relFromRepo(builtExe) + '  ' + builtMtime + ' < ' + srcLatest);
      errors.push('EXE_AFTER_SRC');
    }
  } else {
    console.log('[parity] ✓ exe ≥ src 最新变更');
  }
}
/* EXE_AFTER_SRC（指纹）：归档 src-fingerprint.json 记录的源码聚合指纹必须等于当前实时指纹，
   不等即说明归档件非当前源码构建（不依赖 mtime，跨机可复现）；生成见 gen-src-fingerprint.mjs */
const archFpPath = path.join(ROOT, latest, 'src-fingerprint.json');
const liveFp = srcFingerprint();
let archFpSha = '';
try { archFpSha = existsSync(archFpPath) ? String(JSON.parse(readFileSync(archFpPath, 'utf8')).sha256 || '') : ''; } catch { archFpSha = ''; }
if (archFpSha !== liveFp.sha256) {
  console.error('[parity] ✗ EXE_AFTER_SRC 归档源码指纹与当前源码不一致 ' + relFromRepo(archFpPath) + '  ' + (archFpSha || '(缺失)') + ' != ' + liveFp.sha256);
  errors.push('EXE_AFTER_SRC');
} else {
  console.log('[parity] ✓ 归档源码指纹与当前源码一致 ' + liveFp.sha256);
}
/* SETUP_MISSING / CHECKSUMS_BAD：setup 存在且非空；checksums 三项逐行复算（缺件报错而非放过）；历史编号 007 */
const SETUP_NAME = `JU_${PKG_VERSION}_x64-setup.exe`;
const setupPath = path.join(ROOT, latest, SETUP_NAME);
const setupSize = existsSync(setupPath) ? statSync(setupPath).size : 0;
if (!setupSize) { console.error('[parity] ✗ SETUP_MISSING 归档安装包缺失 ' + relFromRepo(setupPath)); errors.push('SETUP_MISSING'); }
else console.log('[parity] ' + latest + '/' + SETUP_NAME + '  ' + setupSize + ' bytes  ✓');
/* SETUP_STALE / SETUP_MISMATCH：setup 不得早于归档 exe；构建宿主存在同版本 NSIS 产物时按 SHA-256 比对同源 */
const setupMtime = setupSize ? statSync(setupPath).mtimeMs : 0;
const exeMtime = existsSync(archExe) ? statSync(archExe).mtimeMs : 0;
if (setupMtime && exeMtime && setupMtime < exeMtime) { console.error('[parity] ✗ SETUP_STALE 归档安装包早于 exe（旧 setup 混入） ' + relFromRepo(setupPath)); errors.push('SETUP_STALE'); }
const nsisSetup = path.join(DESKTOP_RELEASE_DIR, 'bundle', 'nsis', SETUP_NAME);
if (setupSize && existsSync(nsisSetup) && sha(nsisSetup) !== sha(setupPath)) { console.error('[parity] ✗ SETUP_MISMATCH 归档安装包与 NSIS 产物不一致 ' + relFromRepo(setupPath)); errors.push('SETUP_MISMATCH'); }
const sumsPath = path.join(ROOT, latest, CHECKSUMS_NAME);
const sums = existsSync(sumsPath) ? readFileSync(sumsPath, 'utf8').split(/\r?\n/).filter((l) => l.trim()) : [];
if (sums.length !== 3) { console.error('[parity] ✗ CHECKSUMS_BAD checksums 行数异常 ' + relFromRepo(sumsPath) + '  ' + sums.length + ' 行（期望 3）'); errors.push('CHECKSUMS_BAD'); }
for (const row of sums) {
  const m = /^([0-9a-f]{64})\s+(\S+)$/.exec(row.trim());
  if (!m) { console.error('[parity] ✗ CHECKSUMS_BAD checksums 行格式异常 ' + row.trim()); errors.push('CHECKSUMS_BAD'); continue; }
  const target = path.join(ROOT, latest, m[2]);
  if (!existsSync(target) || sha(target) !== m[1]) { console.error('[parity] ✗ CHECKSUMS_BAD 校验和不符 ' + m[2]); errors.push('CHECKSUMS_BAD'); }
}
if (sums.length === 3 && !errors.includes('CHECKSUMS_BAD')) console.log('[parity] ✓ checksums 3 项复算一致');
/* 收集式报告：先跑完全部判据，末尾统一 Exit，避免首错即退掩盖后续红（EXE/SETUP 依次被 WEB 掩盖的诊断缺口） */
if (errors.length) { console.error('[parity] ✗ 共 ' + errors.length + ' 项失败：' + errors.join(' / ')); process.exit(1); }
