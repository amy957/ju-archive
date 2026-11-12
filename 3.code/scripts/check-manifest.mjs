/* ISSUE-010：归档 release-manifest.json 的 bytes/SHA-256 必须与归档真实字节及 checksums 一致；缺件 exit 1 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { MANIFEST_NAME, PROJECT, resolveLatestReleaseDir } from './release-paths.mjs';
const ok = (d) => !!d && existsSync(path.join(d, MANIFEST_NAME));
/* ISSUE-002：最新归档不按 manifest 过滤；最新目录缺清单必须失败，禁回退更旧归档自证 */
const dir = process.argv[2] || resolveLatestReleaseDir();
const p = (f) => path.join(dir || PROJECT, f);
if (!ok(dir)) { console.error('[manifest] ✗ LATEST_ARCHIVE_NO_MANIFEST 最新归档缺 release-manifest.json（先跑 build-all）'); process.exit(1); }
const m = JSON.parse(readFileSync(p(MANIFEST_NAME), 'utf8'));
if (!existsSync(p(m.checksums))) { console.error('[manifest] ✗ 缺少 ' + m.checksums); process.exit(1); }
const sums = readFileSync(p(m.checksums), 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => l.trim().split(/\s+/));
let bad = 0;
for (const a of m.artifacts) {
  const row = sums.find((r) => r[1] === a.file);
  if (!existsSync(p(a.file))) { console.error('[manifest] missing ' + a.file); bad += 1; continue; }
  if (createHash('sha256').update(readFileSync(p(a.file))).digest('hex') !== a.sha256 || statSync(p(a.file)).size !== a.bytes || (row && row[0] !== a.sha256)) { console.error('[manifest] mismatch ' + a.file); bad += 1; }
}
/* 【ISSUE-005】说明必须与清单同口径列出未关闭 ISSUE；删该行即 FAIL，禁止「承接」掩盖 */
const open = Array.isArray(m.openIssues) ? m.openIssues : [];
const openText = open.map(String).join('/');
/* 【fix27-5】docs 为自动生成物（<!-- AUTO-GENERATED -->）：必须与 gen-open-issues.mjs 当前输出逐字节一致，
   不再只比集合；文档被手改即 FAIL，须重跑 `node scripts/gen-open-issues.mjs` 重新生成 */
const docFile = path.join(PROJECT, 'docs', 'OPEN-ISSUES.md');
const doc = existsSync(docFile) ? readFileSync(docFile, 'utf8') : '';
const generated = execFileSync(process.execPath, [path.join(PROJECT, 'scripts', 'gen-open-issues.mjs'), '--stdout'], { cwd: PROJECT, encoding: 'utf8' });
if (doc !== generated) {
  console.error('[manifest] RESULT=FAIL docs/OPEN-ISSUES.md 与 gen-open-issues.mjs 输出不一致（手改即红，请重跑生成器）');
  process.exit(1);
}
/* 【ISSUE-003】parity 声明同样以 docs 为真相源：docs 必须显式写 `parity=PASS` 或 `parity=BLOCK`，且与清单 parity 同值 */
const docParity = (/\bparity=(PASS|BLOCK)\b/.exec(doc) || [])[1] || '';
const manParity = String(m.parity || '').trim();
const manParityState = manParity === 'PASS' ? 'PASS' : (/^BLOCK:/.test(manParity) ? 'BLOCK' : '');
if (!manParityState || docParity !== manParityState) {
  console.error('[manifest] RESULT=FAIL parity 与 docs/OPEN-ISSUES.md 声明不一致 docs=' + (docParity || '(缺失)') + ' manifest=' + (manParityState || '(非法:' + manParity + ')'));
  process.exit(1);
}
const notes = existsSync(p('RELEASE-NOTES.md')) ? readFileSync(p('RELEASE-NOTES.md'), 'utf8') : '';
if (!open.length || !notes.includes('未关闭 ISSUE：' + openText)) { console.error('[manifest] 未关闭 ISSUE 未在清单/说明中声明'); bad += 1; }
console.log('[manifest] RESULT=' + (bad ? 'FAIL' : 'PASS') + ' entries=' + m.artifacts.length + ' openIssues=' + open.length + ' dir=' + path.basename(dir || '')); process.exit(bad ? 1 : 0);
