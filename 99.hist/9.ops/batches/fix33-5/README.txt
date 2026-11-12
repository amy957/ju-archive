批次：fix33-5（ISSUE-005 update-crash 与 updater 硬关闭冲突）
时间：2026-10-31
DIST_BEFORE：4,698,835 B（6.P0-T3基线/m07-vite/dist/index.html，改写前）
DIST_AFTER ：4,675,100 B（UPDATER_ACTIVE=false 口径重建）
变更文件：
  - 6.P0-T3基线/m07-vite/src/app/updater.ts（导出 UPDATER_ACTIVE）
  - 6.P0-T3基线/m07-vite/tests/update-crash.spec.ts（按开关分支断言）
证据文件：
  - pw-update-crash-green.log（1 passed，4.4s）
  - pw-update-crash-negative.log（1 failed：第 414 行 config active 期望 true 实得 false）
  - pw-update-crash-green-r2.log（回滚后 1 passed，4.0s）
  - verify-all-fix33-5.log（verify.js all Exit 0）
edge_profile* 匹配项：无（已跳过，未删除任何内容）
