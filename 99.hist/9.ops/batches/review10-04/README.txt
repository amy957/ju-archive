批次：review10-04/11 · ISSUE-004 14 批修复纳入发版 E2E 回归
时间：2026-11-03（UTC 15:25–15:48）
DIST_BEFORE：4,712,153 B / 8892F340366B372C6CD98E9B64CF47D38B958377F34377887D51BFAFED1A7A886
DIST_AFTER：同值（零漂移；本批仅新增测试与 build-all 用例清单）
变更：新建 tests/v21-review9-{01-close-backup-enc,02-preimport-enc,05-locked-backup,06-rt-console}.spec.ts；
      scripts/build-all.mjs 的 E2E_SPECS 与 CLOSED_HIGH_SPECS 各追加同 4 项。
验收：build-all Exit 0（[1..6b/12] 全绿，第 4 步 28 passed）；verify.js all r5 Exit 0；
      登记器 PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS。
证伪：删 E2E_SPECS 中 review9-06 行 → Exit 1，打印「✗ 发版 E2E 缺少关闭链路定向用例」。
edge_profile*：90过程材料/tmp/ 下匹配 0 项，已跳过；未删除其它内容。
