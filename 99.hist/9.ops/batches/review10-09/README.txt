批次：review10-09/11 · ISSUE-011 加密态导出需明示或加密
时间：2026-11-03（UTC 16:31–16:45）
DIST_BEFORE：4,712,158 B / EDC75BF5…（review10-06 零构建基线）
DIST_AFTER：4,712,375 B / 8C15A28823BC7389…E9F8776
变更：m07-vite/src/io/export.ts（加密态 appConfirm 确认 + toast 明文提示）
      m07-vite/tests/v21-review5-feature-entries.spec.ts（新增 review10-09 负向用例）
验收：tsc Exit 0；定向 spec 2 passed ×3；证伪 1 failed（Received 0）
门禁：hash-registry PARTY_COUNT=66 / drift 0 / PASS；verify.js all Exit 0
证据：2.项目日志/review10-09-*-2026-11-03.txt
说明：本批不重打包 release（发布阻塞=否，随下一发版批）
