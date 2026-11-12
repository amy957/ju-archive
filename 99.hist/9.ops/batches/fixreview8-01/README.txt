批次：fixreview8-01（review8 · 恢复 preimport）
时间：2026-11-03 14:27 (+08:00)
DIST_BEFORE：未在批前采集（本批 acceptance 的 prepare(spec) 会 vite build 重建 dist）；上批登记 4,706,823 B / B7CD6EF8…D858
DIST_AFTER：4,707,111 B / CDCB84C5…D96128（2026-11-03 14:24:55）
变更：src/main.ts loadAutoBackup 读 juju.backup.preimport 并校验 nodes/rootId；注入替换 () => null；scripts/check-deps-wired.mjs injectBootDeps 加键；新增 tests/v21-review8-recovery.spec.ts 与 tests/review8-helpers.ts
验收：node node_modules/@playwright/test/cli.js test tests/v21-review8-recovery.spec.ts → 1 passed；改回 () => null → 1 failed（REVIEW8-PREIMPORT 未恢复）
门禁：check-deps-wired PASS（13 键 / 76 键）；tsc Exit 0；哈希登记器 PARTY_COUNT=66 / drift 0 / PASS；verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）
edge_profile* 匹配 0 项，已跳过
