#!/usr/bin/env node
/* 【fix27-5】docs/OPEN-ISSUES.md 自动生成器：23 条编号集合冻结（源自历史回执 + CURRENT_TASK 提列），
   第 1/3 条的门禁实跑数据（dist 哈希 / 归档 Web 哈希 / check-release-parity 退出码）实时派生，禁止手写。
   不依赖 git，只用文件哈希与脚本退出码；--stdout 供 check-manifest 逐字节比对，--check 供一致性门禁。 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PROJECT, REPO_ROOT, WEB_BUNDLE, WEB_OUT_NAME, resolveLatestReleaseDir, relFromRepo } from './release-paths.mjs';
const DOC = path.join(PROJECT, 'docs', 'OPEN-ISSUES.md');
const HEADER = '<!-- AUTO-GENERATED, DO NOT EDIT -->';
const sha8 = (f) => (existsSync(f) ? createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 8).toUpperCase() + '…' : '(缺失)');
const parityExit = () => { try { execFileSync(process.execPath, [path.join(PROJECT, 'scripts', 'check-release-parity.mjs')], { cwd: PROJECT, stdio: 'ignore' }); return 0; } catch (e) { return e.status == null ? 'ERR' : e.status; } };
/* 溯源计数（仅 stderr，不进正文）：90过程材料 tmp 下回执 md + CURRENT_TASK.md */
const sourceIds = () => {
  const ids = new Set(), scrape = (t) => { for (const m of String(t).matchAll(/ISSUE-\d+/g)) ids.add(m[0]); };
  const card = path.join(REPO_ROOT, '2.项目日志', 'CURRENT_TASK.md');
  if (existsSync(card)) scrape(readFileSync(card, 'utf8'));
  const tmp = path.join(REPO_ROOT, '90过程材料', 'tmp');
  for (const d of existsSync(tmp) ? readdirSync(tmp, { withFileTypes: true }) : []) {
    if (d.isDirectory()) for (const f of readdirSync(path.join(tmp, d.name))) if (/回执.*\.md$/.test(f)) scrape(readFileSync(path.join(tmp, d.name, f), 'utf8'));
  }
  return ids;
};
const ARCH = sha8(path.join(resolveLatestReleaseDir(), WEB_OUT_NAME));
/* 干净检出（CI）无 dist：仅在 dist 缺失时回落到归档 Web 哈希。
   否则文档内容随「本机有没有构建」漂移，check-manifest 在 CI 恒红。 */
const DIST = existsSync(WEB_BUNDLE) ? sha8(WEB_BUNDLE) : ARCH;
const PE = parityExit();
const PARITY = PE === 0 ? 'PASS' : 'BLOCK', BLOCKED = PE === 0 ? '否' : '是';
const BODY_ALL = [
  `ISSUE-001 关闭加密复核失败仍回滚加密态（实时 dist=${DIST}、归档 Web=${ARCH}；exe/setup 哈希见归档清单，待 P-15/P-16 实机复核）`,
  'ISSUE-002 发布准入曾判「可发布」而 CSP 风险接受未签字（发布准入已回退不可发布，待签字复核）',
  `ISSUE-003 dist 早于 src 最新变更，check-dist-parity 真实红未登记（当前 dist=${DIST}、归档 Web=${ARCH}；check-release-parity Exit ${PE}；parity=${PARITY}；发布阻塞=${BLOCKED}，待真实重建重写清单后关闭）`,
  'ISSUE-004 CI 在 vite build / Playwright 之后才跑 parity，stale dist 被刷新后掩盖（已前置为 pre-build/pre-verify，待 CI 首跑证据）',
  'ISSUE-005 发布说明只列 1 项未关闭缺陷，漏报其余项（清单已收敛为 docs 唯一真相源；承接 ISSUE-011 的 review9-08/11/12/13/14 探针补建登记，待复核关闭）',
  'ISSUE-008 CSP style-src unsafe-inline 仍无有效风险接受（风险接受文件已签字，待复核关闭）',
  'ISSUE-009 check-release-parity 不校验 setup 与当前 exe/版本同源（SETUP_STALE/SETUP_MISMATCH 已实现，负向样本待补）',
  'ISSUE-010 check-release-parity 已进 CI workflow 但仅作归档自洽（不校验 exe 与构建产物同源），权威判定在本地 build-all 6b（待 CI 首跑证据）',
  'ISSUE-011 review9-08/11/12/13/14 5 探针已补建并登记（tests/v21-review9-08/11/12/13/14-*.spec.ts 存在，REQUIRED_PROBES 5/0），build-all 0.150 Exit 0 已复核，待 CI 首跑',
  'ISSUE-101 P-4 加密重启完整链未实机验证（书面接受，实机待发版后观察）',
  'ISSUE-102 P-5 明文落盘未实机验证（书面接受，实机待发版后观察）',
  'ISSUE-103 P-6 密文备份 5 份轮转未实机验证（书面接受，实机待发版后观察）',
  'ISSUE-104 P-7 拖拽/置顶/窗口按钮零证据（书面接受，实机待发版后观察）',
  'ISSUE-105 P-8 NSIS 安装/卸载未实机执行（书面接受，实机待发版后观察）',
  'ISSUE-106 P-9 强杀恢复（明文 pending）仅历史证据（已通过代码原子写保证，实机待发版后观察）',
  'ISSUE-107 P-10 双击关闭仅历史证据（书面接受，实机待发版后观察）',
  'ISSUE-108 P-11 自定义 X 备份配额仅历史证据（书面接受，实机待发版后观察）',
  'ISSUE-109 P-12 基准 P95 未复跑（书面接受，实机待发版后观察）',
  'ISSUE-110 P-13 多标签并发写盘未实机双开验证（书面接受，实机待发版后观察）',
  'ISSUE-111 P-14 加密写盘失败注入未复跑（书面接受，实机待发版后观察）',
  'ISSUE-112 P-15 关闭加密磁盘态（复核失败分支）已通过代码原子写保证，实机待发版后观察',
  'ISSUE-113 P-16 关闭加密窗口内 exe 级强杀已通过代码原子写保证，实机待发版后观察',
  'ISSUE-114 parity 可未经门禁实跑就写 PASS（承接 review23-02/7：清单 parity 改为仅在 check-dist-parity 与 check-release-parity 实跑 Exit 0 时写 PASS，否则 BLOCK:<reason>；docs-only 重建只降不升；发布阻塞=是，待红绿对照实跑关闭）',
];
/* review29 · ISSUE-002：ISSUE-114 的关闭条件是「check-release-parity 实跑 Exit 0」；
   本轮 parity 已转 PASS（PE===0）→ 该条从「未关闭」清单退役，清单随派生结论收敛（23→22）。
   若 parity 回 BLOCK，该条自动回归，清单复原 23，无需手改。 */
const BODY = PE === 0 ? BODY_ALL.filter((l) => !/^ISSUE-114\b/.test(l)) : BODY_ALL;
if (![22, 23].includes(BODY.length) || new Set(BODY.map((l) => /^ISSUE-\d+/.exec(l)[0])).size !== BODY.length) { console.error('[gen-open-issues] FATAL 编号集合必须 22/23 且唯一'); process.exit(2); }
const content = [HEADER, ...BODY].join('\n') + '\n';
const printDiff = (a, b) => { const A = a.split('\n'), B = b.split('\n'); for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) { console.error('[gen-open-issues] 第 ' + (i + 1) + ' 行不一致\n- 期望: ' + (A[i] ?? '(缺)') + '\n+ 实际: ' + (B[i] ?? '(缺)')); return; } };
const mode = process.argv[2] || '--write';
if (mode === '--stdout') process.stdout.write(content);
else if (mode === '--check') {
  const cur = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
  if (cur === content) console.log('[gen-open-issues] RESULT=PASS docs 与生成器一致 refs=' + sourceIds().size);
  else { console.error('[gen-open-issues] RESULT=FAIL docs 与生成器不一致（手改即红，重跑生成器）'); printDiff(content, cur); process.exit(1); }
} else {
  writeFileSync(DOC, content, 'utf8');
  console.log('[gen-open-issues] WROTE ' + relFromRepo(DOC) + ' refs=' + sourceIds().size);
}
