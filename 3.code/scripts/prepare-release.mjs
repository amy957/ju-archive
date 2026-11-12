#!/usr/bin/env node
/**
 * M4 · 分发准备：Web 单文件版 + 桌面版归档 + SHA-256 校验清单
 *
 * 【D-05b · 归档落位改造】归档目录已从 `dist/release/` 迁到仓库级
 *   `99.hist/8.rel/<RELEASE_VERSION>/`（由 `scripts/release-paths.mjs` 单一管理）。
 *   原因：Tauri v1 按 `tauri.conf.json.build.distDir = ../dist` 递归内嵌整个 dist，
 *   归档留在 dist 内会被打进 exe（体积翻倍 + 内嵌两份 HTML）。
 *
 * 输入（两者必须同时存在，缺一即中止）：
 *   dist/index.html                     —— Web 单文件版（vite-plugin-singlefile 构建产物）
 *   src-tauri/target/release/ju.exe     —— 桌面版（Windows 文件系统大小写不敏感，
 *                                          同时探测 ju.exe / JU.exe / Ju.exe，避免大小写差异造成假缺失）
 * 输出（均在 RELEASE_DIR，即 99.hist/8.rel/<版本>/）：
 *   JU-v2.1-Web.html                    —— Web 分发副本
 *   JU-v2.1-win-x64.exe                 —— 桌面分发副本
 *   JU-v2.1-checksums.txt               —— `<sha256>  <文件名>`（sha256sum 两空格格式，按文件名升序）
 *   src-fingerprint.json                —— 本轮源码聚合指纹（与 check-release-parity 同源，不进 checksums）
 *
 * 设计要点：
 *   - 纯本地文件操作，不访问网络、不调用外部命令。
 *   - 复制后对「源」与「副本」分别计算 SHA-256 并比对，确认归档字节一致后才写清单。
 *   - 清单内容仅由文件内容决定（不含时间戳），重复执行字节可复现，便于哈希与漂移核对。
 *   - 任一产物缺失时不产生半套归档：清单最后写入，前置失败直接退出，不留不完整清单。
 *   - 归档目录**不在 dist 内**，因此任何一次 `vite build`（含测试里的 prepareDist()）都不会
 *     清掉发布包，也不再需要构建期「搬出 / 搬回」的补丁。
 *
 * 用法：node scripts/prepare-release.mjs
 * 退出码：0 = 归档成功；1 = 缺少构建产物 / 复制后哈希不一致。
 * 【ISSUE-010 · 重复归档守卫】目标归档目录（99.hist/8.rel/<RELEASE_VERSION>/）
 *   已存在时**默认拒绝**：说明版本号 / BUILD_DATE 没有更新，继续执行就会静默覆盖上一版
 *   发布包（checksums、exe、Web 单文件全部被顶掉，且无任何差异记录）。
 *   要重新发版，请修改 package.json 的 version 或 release-paths.mjs 的 BUILD_DATE。
 * 【ISSUE-005 · 同日重打包】显式设 JU_RELEASE_OVERWRITE=1 时不做覆盖：既有目录先整体
 *   rename 为 `<目录>.prev-<UTCms>`（原字节保留、可回溯），再按常规流程产出新包。
 *   未设该变量时仍走上一条拒绝分支，提示里会带上变量名。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { copyFileSync, createReadStream, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  BUILD_DATE,
  CHECKSUMS_NAME,
  DESKTOP_RELEASE_DIR,
  EXE_OUT_NAME,
  MANIFEST_NAME,
  PKG_VERSION,
  PROJECT,
  RELEASE_DIR,
  RELEASE_VERSION,
  REPO_ROOT,
  WEB_BUNDLE,
  WEB_OUT_NAME,
  relFromRepo,
} from './release-paths.mjs';
import { srcFingerprint } from './gen-src-fingerprint.mjs';

const RELEASE_SRC_DIR = DESKTOP_RELEASE_DIR;
const WEB_SOURCE = WEB_BUNDLE;
const OUT_DIR = RELEASE_DIR;
const targetDir = OUT_DIR;
const EXE_CANDIDATES = ['app.exe', 'ju.exe', 'JU.exe', 'Ju.exe']; /* crate name=app → target/release/app.exe（历史候选保留） */
const NOTES_NAME = 'RELEASE-NOTES.md';
const FINGERPRINT_NAME = 'src-fingerprint.json';
const SETUP_OUT_NAME = `JU_${PKG_VERSION}_x64-setup.exe`;
/* 【ISSUE-007】未关闭项唯一真相源：docs/OPEN-ISSUES.md（每行 `ISSUE-xxx 标题`）；代码内不得再存清单 */
const OPEN_ISSUES_FILE = path.join(PROJECT, 'docs', 'OPEN-ISSUES.md');
function readOpenIssues() {
  if (!existsSync(OPEN_ISSUES_FILE)) abort(['✗ 缺少未关闭 ISSUE 清单：' + relFromRepo(OPEN_ISSUES_FILE)]);
  /* 【fix27-5】docs 首行为自动生成标记 `<!-- AUTO-GENERATED -->`：忽略 HTML 注释行，其余非法行仍 fail */
  const lines = fs.readFileSync(OPEN_ISSUES_FILE, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('<!--'));
  const ids = lines.map((line) => {
    const m = /^(ISSUE-\d+)\s+\S/.exec(line);
    if (!m) abort(['✗ 清单行格式必须为 `ISSUE-xxx 标题`：' + line]);
    return m[1];
  });
  if (!ids.length || new Set(ids).size !== ids.length) abort(['✗ 未关闭 ISSUE 清单为空或编号重复：' + relFromRepo(OPEN_ISSUES_FILE)]);
  return ids;
}
const OPEN_ISSUES = readOpenIssues();
/* 【ISSUE-114】说明逐项全编号输出（与清单同源）：首项全写、其余省略前缀会让后续编号无法被单独 grep 命中 */
const OPEN_ISSUES_TEXT = OPEN_ISSUES.join('/');

/* 【ISSUE-010】JU_RELEASE_DOCS_ONLY=1：只按归档内已落盘字节补写说明与清单，
   不复制产物、不让位目录、不触碰 checksums（与第 3 步共用同一实现，避免两份口径） */
if (process.env.JU_RELEASE_DOCS_ONLY === '1') {
  await writeReleaseDocs(true);
  console.log('[release] 已补写归档说明与清单：' + relFromRepo(OUT_DIR));
  process.exit(0);
}

/* ── 0) 目标归档目录（ISSUE-010 默认拒绝 / ISSUE-005 显式让位 / ISSUE-012 让位件清理） ── */
/* 【review29-03】发布目录已固定为 v2.1.0（不带日期），「目录存在即中止」与固定名语义冲突：
   默认改为**原地覆盖**（每个产物都走 staging 写入 + rename 原子替换，中途失败不留半个文件）；
   需要保留上一版做对照/回滚时显式加 --keep-prev（或沿用旧环境变量 JU_RELEASE_OVERWRITE=1），
   此时旧目录整体改名为 .prev-<UTCms>，不删除不覆盖。 */
const KEEP_PREV = process.argv.includes('--keep-prev') || process.env.JU_RELEASE_OVERWRITE === '1';

if (fs.existsSync(targetDir)) {
  if (KEEP_PREV) {
    const prev = targetDir + '.prev-' + Date.now();
    renameSync(targetDir, prev);
    console.log('[release] 既有归档整体改名为 ' + relFromRepo(prev) + '（--keep-prev / JU_RELEASE_OVERWRITE=1）');
  } else {
    console.log('[release] 归档目录已存在，按固定名原地覆盖：' + relFromRepo(targetDir) + '（逐文件 staging + 原子替换；需备份请加 --keep-prev）');
  }
}

/* 【ISSUE-012 · .prev-* 无上限累积】只在新归档已让位 / 已新建、且清单写成功后才清理：按目录名升序仅保留最近 1 个（含本轮让位件），其余整体**移动**（不删除）到 90过程材料/tmp/fixr6-12/prev-release-<UTCms>/，字节与哈希不变、可回迁。拒绝分支内一次都不会调用，故零副作用。 */
function prunePrevs() {
  const PREV_ROOT = path.dirname(targetDir);
  const prevs = fs.existsSync(PREV_ROOT) ? fs.readdirSync(PREV_ROOT).filter((n) => n.startsWith('v' + PKG_VERSION + '-') && /\.prev[-.]/i.test(n)).sort() : [];
  const keep = prevs.sort().slice(-1);
  const drop = prevs.filter((n) => !keep.includes(n));
  if (!drop.length) return;
  const movedTo = path.join(REPO_ROOT, '99.hist', '99.trash', 'prev-release-' + Date.now());
  mkdirSync(movedTo, { recursive: true });
  for (const n of drop) renameSync(path.join(PREV_ROOT, n), path.join(movedTo, n));
  console.log('[release] ISSUE-012 让位件移出 ' + drop.length + ' 件 → ' + relFromRepo(movedTo) + '，保留 ' + keep[0] + '；清单：' + drop.join(', '));
}

/** 在 release 目录里按候选名找桌面构建产物；找不到返回 null */
function findBinary() {
  for (const name of EXE_CANDIDATES) {
    const abs = path.join(RELEASE_SRC_DIR, name);
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return null;
}

/** 流式计算文件 SHA-256（大体积 exe 不整块读入内存） */
async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

/**
 * 【ISSUE-114】parity 只能由实跑门禁得出：依次执行 check-dist-parity / check-release-parity，
 * 两者均 Exit 0 才允许写 PASS；任一非 0 写 `BLOCK:<脚本> Exit <code> <关键行>`。
 * 原实现只比 Web 哈希，dist 过期 / exe 陈旧 / setup 不符仍写 PASS（manifest 失真）。
 * 【fix27-4】调用前必须先落骨架清单：check-release-parity 的 LATEST_ARCHIVE_NO_MANIFEST
 * 判据只认清单存在性，先跑推断层会把手写序误判成红（review26-006）。
 */
function runParityChecks() {
  const reasons = [];
  for (const name of ['check-dist-parity.mjs', 'check-release-parity.mjs']) {
    try {
      execFileSync(process.execPath, [path.join(PROJECT, 'scripts', name)], { cwd: PROJECT, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      const lines = String((e.stdout || '') + (e.stderr || '')).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const key = lines.find((l) => l.includes('✗')) || e.message;
      reasons.push(name.replace(/\.mjs$/, '') + ' Exit ' + (e.status == null ? 'ERR' : e.status) + ' ' + key.replace(/"/g, "'"));
    }
  }
  return reasons.length ? 'BLOCK:' + reasons.join(' | ') : 'PASS';
}

/** 【ISSUE-114】docs-only 只降不升：本轮实跑仍非 PASS 时保留既有 BLOCK（重写文档本身不得变绿） */
function readPrevParity() {
  const file = path.join(OUT_DIR, MANIFEST_NAME);
  if (!existsSync(file)) return '';
  try { return String(JSON.parse(fs.readFileSync(file, 'utf8')).parity || ''); } catch (e) { return ''; }
}

/**
 * 【ISSUE-010】归档自带说明与清单：只读归档内真实文件字节取 size / SHA-256，
 * 说明与清单不计入 checksums（checksums 的项与行数保持 3 行不变）。
 * 【fix27-4】写序：骨架清单（parity=PENDING）先落盘 → 实跑 parity → 回填结论后 rename
 * 原子替换正式清单；正式清单禁止覆盖写，parity 禁止手写。
 */
async function writeReleaseDocs(docsOnly = false) {
  const prevParity = docsOnly ? readPrevParity() : '';
  /* 【ISSUE-008】说明必须记录本轮真实产物哈希：逐项取自归档内字节，与清单同源，禁止手写 */
  const artifacts = [];
  for (const file of [WEB_OUT_NAME, EXE_OUT_NAME, SETUP_OUT_NAME, CHECKSUMS_NAME]) {
    const abs = path.join(OUT_DIR, file);
    if (!existsSync(abs)) continue;
    artifacts.push({ file, bytes: statSync(abs).size, sha256: await sha256(abs) });
  }
  const manifestFile = path.join(OUT_DIR, MANIFEST_NAME);
  /* 【ISSUE-008】parity 以 `"parity":"PASS"` 紧凑写法落盘：验收可直接 grep，值仍由 runParityChecks 实跑得出，禁止手写 */
  const renderManifest = (parity) => {
    const manifest = {
      version: `v${PKG_VERSION}`,
      release: RELEASE_VERSION,
      build_date: BUILD_DATE,
      parity,
      openIssues: OPEN_ISSUES,
      generated_at: new Date().toISOString(),
      source_dir: relFromRepo(DESKTOP_RELEASE_DIR),
      checksums: artifacts.some((a) => a.file === CHECKSUMS_NAME) ? CHECKSUMS_NAME : '',
      artifacts,
    };
    return JSON.stringify(manifest, null, 2).replace('"parity": ', '"parity":') + '\n';
  };
  writeFileSync(manifestFile, renderManifest('PENDING'), 'utf8');
  /* 【fix27-9】docs-only 亦须重跑门禁取结论：build-all 在让位后先落 checksums（缺 setup）再补 setup，
     第 6 步写下的 SETUP_MISSING/CHECKSUMS_BAD 会永久滞留，与 docs 实跑结果相反（check-manifest 必红）。
     口径仍为「parity 只能由实跑得出」：本轮实跑 Exit 0 才覆盖旧 BLOCK，实跑仍红则保留旧 BLOCK。 */
  const rerunParity = runParityChecks();
  const parity = rerunParity === 'PASS' ? rerunParity : (prevParity.startsWith('BLOCK:') ? prevParity : rerunParity);
  writeFileSync(path.join(OUT_DIR, NOTES_NAME), [
    '# RELEASE-NOTES',
    '',
    `- 版本：v${PKG_VERSION}（归档 ${RELEASE_VERSION}）`,
    `- 日期：${BUILD_DATE}`,
    `- 未关闭 ISSUE：${OPEN_ISSUES_TEXT}（来源 docs/OPEN-ISSUES.md）`,
    ...(parity === 'PASS' ? [] : ['- 发布一致性：' + parity]),
    ...artifacts.filter((a) => a.file !== CHECKSUMS_NAME).map((a) => `- ${a.file}：${a.bytes} B / ${a.sha256}`),
    '- 已排除项：release-manifest.json / RELEASE-NOTES.md 不进 checksums；历史归档不回改',
    '',
  ].join('\n'), 'utf8');
  const staging = manifestFile + '.staging';
  writeFileSync(staging, renderManifest(parity), 'utf8');
  renameSync(staging, manifestFile);
}

/**
 * 带重试的复制（Windows 实测：目标文件可能被安全软件实时扫描 / 资源管理器预览短暂占用，
 * copyFile 直接抛 EBUSY「resource busy or locked」）。策略：最多 10 次、每次间隔 1s；
 * 第 4 次起先尝试删除目标再复制（删除同样可能被占用，故仍包在 try 内）。
 */
async function copyWithRetry(source, target, label) {
  const RETRIES = 10;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      copyFileSync(source, target);
      if (attempt > 1) console.log(`[release]   ${label}：第 ${attempt} 次尝试复制成功（前序 EBUSY 已解除）`);
      return;
    } catch (e) {
      const code = e && e.code;
      if (code !== 'EBUSY' && code !== 'EPERM' && code !== 'EACCES') throw e;
      if (attempt >= 4) {
        try { rmSync(target, { force: true }); } catch (e2) { /* 仍被占用：下一轮重试 */ }
      }
      if (attempt === RETRIES) {
        console.error(`[release]   ✗ ${label}：目标文件被占用（${code}），已重试 ${RETRIES} 次`);
        throw e;
      }
      console.log(`[release]   ${label}：目标被占用（${code}），1s 后重试（${attempt}/${RETRIES}）`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

/** 同步等待（毫秒）；仅用于文件系统重试间隔。 */
function sleepSync(ms) {
  /* 用 Atomics.wait 真正挂起当前线程，替代 Date.now 忙等（忙等会占满一个 CPU 核） */
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * 用 staging 文件落位为正式产物名（抗安全软件占用）。
 *
 * Windows 实测（本机装了腾讯电脑管家 QQPCRTP）：
 *   - 直接 `copyFile` 覆盖既有 exe   → EBUSY（写句柄被扫描器持有）
 *   - `unlink` 既有 exe              → EPERM（无 FILE_SHARE_DELETE）
 *   - **`rename` 既有 exe**          → 允许
 *   - 写入新文件名 / rename 新文件到空位 → 允许
 * 因此采用「改名隔离 → 新文件顶位 → 尽力清理隔离文件」：
 *   ① `target` → `target.bak-quarantine-<ts>`（把被占用的旧文件挪开）
 *   ② `staging` → `target`（目标名此刻为空位，无需覆盖）
 *   ③ 尽力删除隔离文件；被占用则保留（文件名带 `.bak-` 前缀，产物清单会自动排除）
 */
function placeArtifact(staging, target, label) {
  const quarantine = target + '.bak-quarantine-' + Date.now();
  let quarantined = false;
  if (existsSync(target)) {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      try {
        renameSync(target, quarantine);
        quarantined = true;
        break;
      } catch (e) {
        const code = e && e.code;
        if (attempt === 1 || attempt === 10) {
          console.log(`[release]   ${label}：旧文件改名被拒（${code}），重试中（${attempt}/10）`);
        }
        if (attempt === 10) throw e;
        sleepSync(1000);
      }
    }
  }
  renameSync(staging, target);
  if (!quarantined) return;
  /* ③ 清理隔离文件：安全软件可能仍持有句柄，失败不影响产物正确性 */
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      rmSync(quarantine, { force: true });
      console.log(`[release]   ${label}：旧产物已清理（隔离文件删除成功）`);
      return;
    } catch (e) {
      if (attempt === 3) {
        console.log(`[release]   ${label}：旧产物隔离文件仍被占用，保留为 ${path.basename(quarantine)}（已排除出产物清单）`);
        return;
      }
      sleepSync(1000);
    }
  }
}

function abort(lines) {
  for (const line of lines) console.error('[release] ' + line);
  /* 明确「没有半套归档」：中止时归档目录不会被写入任何文件，避免人工误判为「产物已生成」 */
  console.error('[release] ✗ 归档未执行：' + OUT_DIR + ' 未写入任何文件');
  process.exit(1);
}

/* ── 1) 前置存在性检查：Web 与桌面必须同时就位 ── */
const exeSource = findBinary();
const missing = [];
if (!existsSync(WEB_SOURCE) || !statSync(WEB_SOURCE).isFile()) {
  missing.push('Web 版 dist/index.html（请先执行：npm run build）');
}
if (!exeSource) {
  missing.push('桌面版 src-tauri/target/release/' + EXE_CANDIDATES[0]
    + '（请先执行：npm run tauri build 或 cargo build --release）');
}
if (missing.length) {
  abort(['✗ 缺少构建产物，归档中止：', ...missing.map((m) => '  - ' + m)]);
}

/* ── 1b) 新鲜度闸门：桌面 exe 不得早于 Web 产物（防止打包进旧 dist 的「假修复」） ──
  历史事故：源码修复 + vite build 已更新 dist/index.html，但未重跑 tauri build，
  分发出去的 exe 仍内嵌旧前端（表现为桌面版功能缺失而 Web 版正常）。
  此处以修改时间为准做门禁：exe 早于 dist/index.html 即中止，并给出复现命令。 */
const exeStat = statSync(exeSource);
const webStat = statSync(WEB_SOURCE);
if (exeStat.mtimeMs < webStat.mtimeMs) {
  abort([
    '✗ 桌面版 exe 早于 Web 产物，归档中止（exe 内嵌的仍是旧前端）：',
    '  exe  ' + exeSource + '  ' + exeStat.size + ' B  ' + exeStat.mtime.toISOString(),
    '  web  ' + WEB_SOURCE + '  ' + webStat.size + ' B  ' + webStat.mtime.toISOString(),
    '  请按顺序执行：vite build → tauri build（distDir=../dist 由 Tauri 在编译期内嵌）',
    '  推荐直接执行 node scripts/build-all.mjs —— 第 4 步内置新鲜度自检，必要时会强制重编桌面产物',
    '  （注意：全量 Playwright 的 prepareDist() 会重建 dist/index.html，故「先测试、后打包」）',
  ]);
}

/* ── 2) 复制到归档目录（dist 之外）并逐项比对哈希 ── */
mkdirSync(OUT_DIR, { recursive: true });

const setupSource = [
  path.join(DESKTOP_RELEASE_DIR, SETUP_OUT_NAME),
  path.join(DESKTOP_RELEASE_DIR, 'bundle', 'nsis', SETUP_OUT_NAME),
].find((f) => existsSync(f));
const jobs = [
  { label: 'Web 单文件版', source: WEB_SOURCE, outName: WEB_OUT_NAME },
  { label: '桌面版 x64', source: exeSource, outName: EXE_OUT_NAME },
];
/* 安装包：tauri build --bundles nsis 产物；缺失时写 SETUP_MISSING 由 check-release-parity 判红（不静默跳过） */
if (setupSource) jobs.push({ label: '安装包 NSIS', source: setupSource, outName: SETUP_OUT_NAME });

const records = [];
for (const job of jobs) {
  const target = path.join(OUT_DIR, job.outName);
  /* 先写 staging 再原子替换：
     Windows 实测「直接覆盖已存在的 exe」会被安全软件 / 索引器持有的写句柄挡住（EBUSY），
     而「写入新文件名」与「替换（rename）既有文件」都允许。这样还能避免中途失败留下半个文件。 */
  const staging = target + '.staging';
  await copyWithRetry(job.source, staging, job.outName + ' (staging)');
  placeArtifact(staging, target, job.outName);
  const sourceHash = await sha256(job.source);
  const targetHash = await sha256(target);
  if (sourceHash !== targetHash) {
    abort([
      '✗ 复制后哈希不一致，归档中止（' + job.outName + '）',
      '  source ' + sourceHash,
      '  target ' + targetHash,
    ]);
  }
  records.push({
    name: job.outName,
    label: job.label,
    hash: targetHash,
    bytes: statSync(target).size,
    source: job.source,
  });
}

/* ── 3) 写校验清单（按文件名升序，内容完全由文件字节决定） ── */
records.sort((a, b) => a.name.localeCompare(b.name));
const checksumsPath = path.join(OUT_DIR, CHECKSUMS_NAME);
writeFileSync(checksumsPath, records.map((r) => `${r.hash}  ${r.name}\n`).join(''), 'utf8');

/* ── 3b) 源码聚合指纹随归档落位（dist 只允许 index.html，故指纹只能写归档）──
   必须在 writeReleaseDocs() 之前落盘：其内部实跑 check-release-parity，缺指纹即 BLOCK */
const fingerprintPath = path.join(OUT_DIR, FINGERPRINT_NAME);
writeFileSync(fingerprintPath, JSON.stringify(srcFingerprint(), null, 2) + '\n', 'utf8');

/* 清单已落盘 → 新归档完整可用，此时才收紧 .prev-* 保留上限（ISSUE-010） */
prunePrevs();

/* 说明与清单在 checksums 落盘后追加（不改 checksums 内容与行数） */
await writeReleaseDocs();

for (const r of records) {
  console.log(`[release] ${r.label.padEnd(10, ' ')} ${relFromRepo(r.source)} -> ${relFromRepo(path.join(OUT_DIR, r.name))}`);
  console.log(`[release]   SHA-256 ${r.hash}  (${(r.bytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`[release]   绝对路径 ${path.join(OUT_DIR, r.name)}`);
}
console.log(`[release] 清单     ${relFromRepo(checksumsPath)}（${records.length} 项）`);
console.log('[release] 归档目录 ' + OUT_DIR + '（位于 dist 之外，不会被 Tauri 内嵌）');
console.log('[release] ✓ 发布包准备完成');
