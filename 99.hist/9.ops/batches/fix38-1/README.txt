fix38-1/2 · 归档过程材料
批次：fix38-1/2（多行选区叠加加粗+斜体后无法只剥单一格式 / 彻底清空）
时间：2026-11-01（UTC 05:00–05:40）
DIST_BEFORE：4,700,334 B / F3F7B5ED…4B1F（fix37-2 登记值，本批源码改动前未重建）
DIST_MID   ：4,700,754 B / 380FA893…2690（fix38-1 首次 vite build，红证前备份 dist-new.html）
DIST_AFTER ：4,700,754 B / 380FA893…2690（build-all 第 3 步重建，字节不变）
红证：pw-red.log（旧发布包 4,700,334 B 复跑 fix38-1 两例 → 2 failed）
绿证：pw-green.log（9 件富文本/选区回归 37 passed）
门禁：hash-registry.log（66 方 / drift 0 / PASS）、verify-all.log（Exit 0）
构建：build-all.log（步骤 1–5 通过，第 6 步目录句柄见回执）、prepare-release.log（暂存目录产出后移入）
旧包：prev-release-v2.1.0-2026-11-01/（3 件，哈希见回执）
edge_profile*：90过程材料/tmp/ 下匹配 0 项 ⇒ 跳过，未删除任何文件
