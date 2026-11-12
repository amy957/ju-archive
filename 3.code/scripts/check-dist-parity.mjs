/* 只读门禁：dist/index.html 的 mtime 不得早于任何构建输入项的最新 mtime；不写任何文件 */
/* DEGRADED：--ci-mode / GITHUB_ACTIONS 且干净检出无 dist 时跳过 pre-build 判定
   （dist/ 未入库，CI checkout 无产物可判；构建后的 parity step 仍为权威判定） */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { BUILD_DATE, DIST_DIR, PROJECT } from './release-paths.mjs';

const ciMode = process.argv.includes('--ci-mode') || process.env.GITHUB_ACTIONS === 'true';

/* 递归收集：目录缺失返回空集（public/ 可缺省，不视为失败） */
const walk = (dir, keep) => (existsSync(dir)
  ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full, keep) : keep(e.name) ? [full] : [];
  })
  : []);
const mtime = (f) => (existsSync(f) ? statSync(f).mtimeMs : 0);
const latest = (files) => files.reduce((m, f) => Math.max(m, mtime(f)), 0);

const dist = path.join(DIST_DIR, 'index.html');
if (!existsSync(dist)) {
  if (ciMode) {
    /* 【ISSUE-005】dist/ 未入库，干净检出无产物可看 mtime：改比 src 最新提交时间与 BUILD_DATE 日末，
       避免前置门禁在 CI 永久空转。git 不可用或取不到提交时才降级，且必须告警。
       【ISSUE-002】提交面须含 Rust 源（src-tauri/src + Cargo.toml + build.rs），否则纯 Rust 提交在 CI 全绿。 */
    let srcCt = null;
    try {
      const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', 'src', 'src-tauri/src', 'src-tauri/Cargo.toml', 'src-tauri/build.rs'], { cwd: PROJECT, encoding: 'utf8' }).trim();
      srcCt = out ? Number(out) * 1000 : null;
    } catch (e) {
      console.warn('[dist-parity] ! git 不可用，无法判定 src 提交时间，降级 DEGRADED：' + e.message);
    }
    if (srcCt === null) { console.log('[dist-parity] DEGRADED 干净检出无 dist（dist/ 未入库）：pre-build 跳过，构建后 parity 为权威判定'); process.exit(0); }
    const releaseEnd = Date.parse(BUILD_DATE + 'T23:59:59Z');
    if (srcCt > releaseEnd) { console.error('[dist-parity] ✗ SRC_AFTER_RELEASE src/src-tauri 最新提交 ' + new Date(srcCt).toISOString() + ' 晚于发布日 ' + BUILD_DATE); process.exit(1); }
    console.log('[dist-parity] ✓ 干净检出无 dist；src/src-tauri 最新提交 ' + new Date(srcCt).toISOString() + ' 不晚于发布日 ' + BUILD_DATE); process.exit(0);
  }
  console.error('[dist-parity] ✗ 缺少 ' + dist); process.exit(1);
}
const distAt = mtime(dist);

/* 【ISSUE-002】构建输入面必须完整：src 源码 / public 全量 / 根级 index.html 与配置 /
   Tauri 配置，任一最新 mtime 晚于 dist/index.html 即判定 dist 过期。 */
const groups = [
  { name: 'src/**/*.ts|css', files: walk(path.join(PROJECT, 'src'), (n) => /\.(ts|css)$/.test(n)) },
  { name: 'public/**', files: walk(path.join(PROJECT, 'public'), () => true) },
  { name: 'index.html', files: [path.join(PROJECT, 'index.html')] },
  { name: 'vite.config.ts', files: [path.join(PROJECT, 'vite.config.ts')] },
  { name: 'package.json', files: [path.join(PROJECT, 'package.json')] },
  { name: 'package-lock.json', files: [path.join(PROJECT, 'package-lock.json')] },
  { name: 'tsconfig.json', files: [path.join(PROJECT, 'tsconfig.json')] },
  { name: 'src-tauri/tauri.conf.json', files: [path.join(PROJECT, 'src-tauri', 'tauri.conf.json')] },
];
const stale = groups.filter((g) => latest(g.files) > distAt).map((g) => g.name);
if (stale.length) { console.error('[dist-parity] ✗ dist 早于以下输入的最新变更: ' + stale.join(', ')); process.exit(1); }
console.log('[dist-parity] ✓ dist 不早于 src / public / 根配置 / tauri.conf.json'); process.exit(0);
