review10-06 · ISSUE-006 真实归档 .prev-* 收敛为 1
批次：review10-06/11
时间：2026-11-03T16:12Z（UTC+8 2026-11-04 00:12）
DIST_BEFORE：4,712,158 B / EDC75BF5E8FD5A3C231EDE83CE8C68A54D68C099192C42E447E25E30A0B5B87C（本批零构建）
目标：8.发布与CI/release 下 .prev-* = 1（只移不删）
实测：REAL_PREV_COUNT=1（v2.1.0-2026-11-03.prev-1793720162324）
让位件：90过程材料/tmp/fixr6-12/prev-release-1793720162504/v2.1.0-2026-11-03.prev-1793716686717（review10-03 重打包触发 prunePrevs）
沙箱：90过程材料/tmp/review10-06/sandbox.mjs（GREEN_RUN1/RUN2 PREV=1；RED_RUN2 PREV=2）
日志：2.项目日志/review10-06-{prepare-release,prev-hash,state,dist}-2026-11-03.txt
源码：零改动；prepare-release.mjs 未触碰（SHA-256 CDF0C251F249F1BFAE9247852EF26583BC9F22BAE68652A2170083A1A951C4EB）
