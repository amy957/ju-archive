fix28 批次归档（2026-10-30）
批次：fix28-2/2（归档收尾：README.txt + fix28_回执_20261030.md + edge_profile* 清理核验）
时间：2026-10-30（UTC+8）
DIST_BEFORE：8.发布与CI/release/v2.1.0-2026-10-29 —— JU-v2.1-Web.html 4,700,328 B / 81f348d3…1e07；JU-v2.1-win-x64.exe 6,759,936 B / f1710b54…da30；JU-v2.1-checksums.txt 169 B / d69d40cd…06c2
DIST_AFTER ：8.发布与CI/release/v2.1.0-2026-10-29 —— JU-v2.1-Web.html 4,700,510 B / 8b6094dd…dfd7；JU-v2.1-win-x64.exe 6,759,936 B / eaeb798b…aa64；JU-v2.1-checksums.txt 169 B / e39c4053…7d4c
旧包落位：90过程材料/tmp/fix28/prev-release-v2.1.0-2026-10-29（3 件，逐件字节与 SHA-256 = DIST_BEFORE）
源码变更（1/2 批，2 件）：6.P0-T3基线/m07-vite/index.html · 6.P0-T3基线/m07-vite/src/ui/layout.ts
本批变更（2/2 归档件，2 件）：90过程材料/tmp/fix28/README.txt · 90过程材料/tmp/fix28/fix28_回执_20261030.md
归档文件清单：README.txt（本文件）· fix28_回执_20261030.md（1,557 B 改写）· fix28_tauri-core-drag-snippet.txt 5,527 B · prev-release-v2.1.0-2026-10-29/（JU-v2.1-Web.html / JU-v2.1-win-x64.exe / JU-v2.1-checksums.txt）
门禁：verify-hash-registry.mjs → PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS；verify.js all → Exit 0（静态 0 命中 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）
清理：90过程材料/tmp 匹配 edge_profile* = 0 项（顶层与递归均无）⇒ 跳过删除，删除数 0，记录于回执遗留
证据：2.项目日志/m07-fix28-build-all-2026-10-30.txt · fix28-prepare-release-2026-10-30.txt · fix28-hash-registry-2026-10-30.txt · fix28-verify-all-r2-2026-10-30.txt
