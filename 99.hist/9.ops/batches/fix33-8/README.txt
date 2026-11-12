批次：fix33-8/X · ISSUE-008/009/010/011/013/014/015/016/017（ISSUE-012 已满足，零改动）
时间：2026-10-31（UTC 13:17–13:40）
变更文件（11）：
- m07-vite/src/ui/layout.ts；tests/v21-fix33-8-topbar-doc-close.spec.ts（新建）；tests/v21-fix33-8-pin-catch.spec.ts（新建）
- m07-vite/index.html；src/style.css；src/app/session.ts；src/app/boot.ts
- m07-vite/scripts/check-inline-style.mjs；m07-vite/scripts/release-paths.mjs；.github/workflows/m07-ci.yml
- 2.项目日志/CURRENT_TASK.md
DIST_BEFORE：m07-vite/dist/index.html 4,698,835 B / 77749E67…3EEB
DIST_AFTER：m07-vite/dist/index.html 4,698,196 B / C0637DA8…6D9C
验收：
1) 新 spec 红：2 failed（#btnPin 残留 "tb-wbtn on" / .color-picker count 1）
2) 新 spec 绿：2 passed (4.5s)
3) check-inline-style.mjs → PASS（index.html inline style attrs = 0；dist 65 仅记录）
4) tsc --noEmit → Exit 0
5) verify-hash-registry.mjs → PARTY_COUNT=66 / drift 0 / PASS
6) verify.js all → Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）
edge_profile 清理：90过程材料/tmp 下匹配 0 项，跳过（未删任何内容）
回执：fix33-8_回执_20261031.md
