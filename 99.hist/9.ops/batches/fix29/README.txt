fix29 批次归档（2026-10-30）
批次：fix29-2/2 归档收尾（承接 fix29-1/2：右上角功能按钮点击无响应修复 + 顶栏加密图标移除 + 置顶高亮 + 重打包）
文件清单：README.txt · fix29_回执_20261030.md · prev-release-v2.1.0-2026-10-29/（JU-v2.1-Web.html · JU-v2.1-win-x64.exe · JU-v2.1-checksums.txt）
时间：2026-10-30（UTC+8）
DIST_BEFORE：8.发布与CI/release/v2.1.0-2026-10-29 —— JU-v2.1-Web.html 4,700,510 B / 8b6094dd…dfd7；JU-v2.1-win-x64.exe 6,759,936 B / eaeb798b…aa64；JU-v2.1-checksums.txt 169 B / e39c4053…7d4c
DIST_AFTER ：8.发布与CI/release/v2.1.0-2026-10-29 —— JU-v2.1-Web.html 4,700,788 B / 1130e94f…18d；JU-v2.1-win-x64.exe 6,759,936 B / c1f162aa…146c；JU-v2.1-checksums.txt 169 B / 95b166a8…2591
旧包落位：90过程材料/tmp/fix29/prev-release-v2.1.0-2026-10-29（逐件字节与 SHA-256 = DIST_BEFORE，实测 3/3 全等）
变更文件：6.P0-T3基线/m07-vite/index.html · 6.P0-T3基线/m07-vite/src/ui/layout.ts
门禁：verify-hash-registry.mjs → PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS；verify.js all → Exit 0（静态 0 命中 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）
清理：90过程材料/tmp 递归匹配 edge_profile* = 0 项（EDGE_COUNT=0，2/2 批次复核同值）⇒ 跳过删除，删除数 0
证据：2.项目日志/m07-fix29-build-all-2026-10-30.txt · fix29-hash-registry-2026-10-30.txt · fix29-verify-all-2026-10-30.txt · fix29-dist-before/after-2026-10-30.txt
