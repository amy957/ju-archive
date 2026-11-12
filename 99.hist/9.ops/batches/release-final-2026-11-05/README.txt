批次：release-final-2026-11-05
时间：2026-11-05T14:46Z
DIST_BEFORE：4,715,056 B / FE48C6A74B095058BDC631ABE69EA01408C55218FAB85ADC6082EB7BE0725852
步骤1：build-all（JU_RELEASE_OVERWRITE=1 / JU_BUNDLES=nsis）→ Exit 0（14/14，E2E 40 passed，6b PASS）
产物：Web 4,715,056 B / FE48C6A7… · exe 7,335,936 B / 010A3D01… · setup 4,458,521 B / 004E30A0…
步骤2：P-8 安装/卸载（p8-r5.log）· P-4 加密重启（p4b-r3.log）· P-5 明文落盘（p5i-r3.log）
步骤3：verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 0.0%）
步骤3b：bench ×5 全部 Exit 0 且判定一致（7 通过 / 0 失败 / 0.0% / 中位 -14.3%）
步骤4：登记器 66 方 / drift 0 / PASS；发布准入=不可发布（第 0.109 条；条件未满足：ISSUE-003 未关闭 + 实机 P-6/P-7/P-13/P-14/P-15 无证据，见 review14-06/09 门槛表）
隔离：%APPDATA% 与 %LOCALAPPDATA% 的 com.ju.app 先备份后原样还原（81,077 B / 3D441B87…）
日志：2.项目日志/build-all-release-r4-2026-11-05.log · release-final-verify-all-r2-2026-11-05.txt · release-final-bench-r1..5-2026-11-05.txt · release-final-hash-registry-2026-11-05.txt
当前证据目录保留：prep/restore/诊断脚本与 shots/（P-8/P-4/P-5 截图）
edge_profile*：匹配 0 项，跳过并记录，未删其他内容
