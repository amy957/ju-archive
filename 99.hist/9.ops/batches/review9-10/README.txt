review9-10 / ISSUE-010 拒绝分支零副作用 + .prev-* 重建后计数=1
批次：review9-10（≤1 文件 / ≤30 行 diff）
时间：2026-11-03T11:19Z ~ 11:25Z（UTC）
改动文件（1）：6.P0-T3基线/m07-vite/scripts/prepare-release.mjs
DIST_BEFORE=4710281 B / 2D07DC808E93C962A279E54FDE1CD6BF1A33633898F1BE3820F2E53B05A046E3
DIST_AFTER =4710281 B / 2D07DC808E93C962A279E54FDE1CD6BF1A33633898F1BE3820F2E53B05A046E3（零漂移，未重构建）
REAL_RELEASE_PREV_BEFORE=2  REAL_RELEASE_PREV_AFTER=2（拒绝分支运行后逐项一致）
SANDBOX：90过程材料/tmp/review9-10/sandbox、90过程材料/tmp/review9-10/sandbox-neg（脚本副本，不触碰正式归档）
探针：90过程材料/tmp/review9-10/sandbox.mjs
日志：2.项目日志/review9-10-{prepare-release,hash-registry,verify-all,dist-after}-2026-11-03.txt
EDGE_PROFILE：90过程材料/tmp 下 edge_profile* 匹配 0 项，跳过删除（无删除动作）
约束遵守：未删任何 .prev-* / 让位件，仅移动；未改正式归档字节；未改 keep=slice(-1) 与目录名规则
