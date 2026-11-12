批次：fix33-3/X · ISSUE-003 桥接无 invoke 时 desktopSave 误判成功
时间：2026-10-31（UTC+8）
DIST_BEFORE：6.P0-T3基线/m07-vite/dist/index.html 4,698,715 B / 9A0D4AAF…F646
DIST_AFTER：6.P0-T3基线/m07-vite/dist/index.html 4,698,835 B / 77749E67…3EEB
变更：src/main.ts 的 desktopSave 前置 core.invoke / tauri.invoke 能力检查；新增 tests/v21-fix33-desktop-save-guard.spec.ts
未改：desktopInvoke 返回约定、src-tauri/src/main.rs、UI、既有 tests
证据：2.项目日志/fix33-3-spec-red-2026-10-31.txt（1 failed / 1 passed）
      2.项目日志/fix33-3-spec-green-2026-10-31.txt（2 passed）
      2.项目日志/fix33-3-tsc-2026-10-31.txt、fix33-3-vite-build-2026-10-31.txt
      2.项目日志/fix33-3-hash-registry-2026-10-31.txt、fix33-3-verify-all-2026-10-31.txt、fix33-3-verify-all-r2-2026-10-31.txt（终态复跑）
      2.项目日志/fix33-3-dist-before-2026-10-31.txt、fix33-3-dist-after-2026-10-31.txt
环境：node=C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe（v22.22.2）
edge_profile：90过程材料/tmp 下匹配 edge_profile* 计 0 项，跳过清理（未删任何其他内容）
清理：删除本批自建临时文件 _drives_E.txt / _nodes.txt / _nodever.txt / _va_tail.txt / _edge_profile_scan.txt
