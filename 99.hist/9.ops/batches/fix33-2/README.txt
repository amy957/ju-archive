批次：fix33-2/X · ISSUE-002 桌面加密把 null 成功当失败
时间：2026-10-31（UTC+8）
DIST_BEFORE：6.P0-T3基线/m07-vite/dist/index.html 4,698,725 B / 159FC4D3…F6AC8（fix33-1 登记值）
DIST_AFTER：6.P0-T3基线/m07-vite/dist/index.html 4,698,715 B / 9A0D4AAF…F646
变更：src/core/crypto.ts 桌面分支改 try/catch（不以返回值真值判定）；新增 tests/v21-fix33-encrypted-desktop-save.spec.ts
未改：浏览器分支、加密算法、payload 结构、src-tauri/src/main.rs
证据：2.项目日志/fix33-2-spec-red-2026-10-31.txt（1 failed / 1 passed）
      2.项目日志/fix33-2-spec-green-2026-10-31.txt（2 passed）
      2.项目日志/fix33-2-vite-build-2026-10-31.txt、fix33-2-tsc-2026-10-31.txt
      2.项目日志/fix33-2-hash-registry-2026-10-31.txt、fix33-2-verify-all-2026-10-31.txt
edge_profile：90过程材料/tmp 下匹配 edge_profile* 计 0 项，跳过清理（未删任何其他内容）
