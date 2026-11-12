fix26 归档批说明
批次：fix26（导航置灰 / 各视图标题居中 / 日历空日圆点 / 右栏折叠标题居中 + 重打包）
时间：2026-10-30（UTC+8）
DIST_BEFORE：6.P0-T3基线/m07-vite/dist/index.html 4,699,068 B / 1605BB70…930E5E3B（改码后首次实测构建产物）
DIST_AFTER：4,699,068 B / 1605bb70…930e5e3b（与 DIST_BEFORE 逐字节一致，build-all 复建未变动）
上一发布件 Web：4,698,460 B / 2a832c14…9ba（fix25；已移至 prev-release-v2.1.0-2026-10-29）
上一发布件移动前结束运行中的 JU-v2.1-win-x64 实例（PID 20640）以解除目录占用
本批改动：src/style.css、src/app/session.ts、tests/v21-fix26-ui-align.spec.ts（新建）
门禁（改码后）：verify.js all 全部通过（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）
门禁（改码 + 重打包后）：verify-hash-registry PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS
edge_profile 清理：90过程材料/tmp 下匹配 edge_profile* 共 0 项，跳过（未删除任何其他内容）
收尾（fix26-2/2）：2026-10-30 复核 README / 回执两件齐备且行数 ≤20；edge_profile 匹配 0 项，跳过并记录，无删除动作
