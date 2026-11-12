fix34-1 批次说明
批次：fix34-1/X · ISSUE-001 归档 Web 滞后于当前 dist（重制发布件 + 三边对齐）
时间：2026-10-31（UTC 14:38–14:44）
决策：A · 允许覆盖同名目录（旧包整体封存，不删除、不就地改写）
DIST_BEFORE：6.P0-T3基线/m07-vite/dist/index.html 4,698,196 B / C0637DA8…6D9C（本批未改源码，dist 零变更）
RELEASE_BEFORE：release/v2.1.0-2026-11-01/JU-v2.1-Web.html 4,698,835 B / 77749E67…3EEB（旧 dist 副本）
RELEASE_AFTER：4,698,196 B / C0637DA8…6D9C（与 dist 逐字节一致）
封存位置：90过程材料/tmp/fix34-1/prev-release-v2.1.0-2026-11-01（3 件，移动前后字节与哈希一致）
重制命令：JU_BUILD_DATE=2026-11-01 node scripts/build-all.mjs（6/6 通过）
占用处置：旧包被 PID 2492 / 21160 占用致 Move-Item 失败，用户手动关闭后重试成功
edge_profile 清理：90过程材料/tmp 下 edge_profile* 匹配为空，跳过，未删其他内容
证据：2.项目日志/fix34-1-build-all-2026-10-31.txt、fix34-1-hash-registry-2026-10-31.txt、fix34-1-verify-all-2026-10-31.txt、本目录 build-all-tail.txt / verify-tail.txt
