/* 只读门禁：归档目录（release-paths 的 resolveLatestReleaseDir 口径，含 JU_BUILD_DATE）的 JU-v2.1-Web.html 与 dist/index.html 的 SHA-256 必须相等；只算哈希不打开内容，不写文件 */
/* DEGRADED：--ci-mode / GITHUB_ACTIONS 且干净检出无 dist 时跳过 pre-build 判定（构建后 parity 仍为权威） */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DIST_DIR, MANIFEST_NAME, resolveLatestReleaseDir } from './release-paths.mjs';

const ciMode = process.argv.includes('--ci-mode') || process.env.GITHUB_ACTIONS === 'true';
/* ISSUE-007：归档选择与 check-release-parity 同源；ISSUE-002：最新归档不按 manifest 过滤 */
const dir = resolveLatestReleaseDir();
const web = path.join(dir, 'JU-v2.1-Web.html');
const dist = path.join(DIST_DIR, 'index.html');
console.log('[web-parity] 比较归档目录 ' + path.basename(dir));
if (!existsSync(dir)) { console.error('[web-parity] ✗ 缺少归档目录 ' + dir); process.exit(1); }
if (!existsSync(path.join(dir, MANIFEST_NAME))) { console.error('[web-parity] ✗ LATEST_ARCHIVE_NO_MANIFEST 最新归档缺 release-manifest.json ' + path.basename(dir)); process.exit(1); }
if (!existsSync(web)) { console.error('[web-parity] ✗ 缺少归档 Web ' + web); process.exit(1); }
if (!existsSync(dist)) {
  if (ciMode) { console.log('[web-parity] DEGRADED 干净检出无 dist：pre-build 跳过，构建后 parity 为权威判定'); process.exit(0); }
  console.error('[web-parity] ✗ 缺少构建产物 ' + dist); process.exit(1);
}
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const [a, b] = [sha(web), sha(dist)];
if (a !== b) { console.error('[web-parity] ✗ 归档 Web 与 dist 不一致 ' + a + ' ≠ ' + b); process.exit(1); }
console.log('[web-parity] ✓ 归档 Web 与 dist 一致 ' + a); process.exit(0);
