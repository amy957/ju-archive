fix26-p3 归档批 README
批次：fix26-p3-1/2（演示 / 图谱 / 历史 视图标题行复用大纲标准结构 + 重打包 v2.1.0-2026-10-29）；2/2 归档收尾核对 2026-10-30
时间：2026-10-30 20:46（UTC+8）；2/2 收尾 2026-10-30 21:03（UTC+8）
DIST_BEFORE = 4,699,470 B（fix26-p2 dist/index.html = release JU-v2.1-Web.html，sha256 6cec1ea0…55c8）
DIST_AFTER  = 4,699,887 B（sha256 0a9b7339…65a5）
本目录内容：
  README.txt —— 本归档批说明（批次 / 时间 / DIST / 文件清单）
  fix26_p3_回执_20261030.md —— 本批回执（变更文件 / 验收命令 / 结果 / 遗留）
  fix26-p3_回执_20261030.md —— 1/2 批回执原文（连字符旧名，保留不改）
  red-20261030.log / green-20261030.log / green-r2-20261030.log / green-r3-20261030.log —— 红绿证与门禁全量日志
  prev-release-v2.1.0-2026-10-29/ —— fix26-p2 旧发布包（移动前结束运行实例 PID 27320）
范围：演示 / 图谱 / 历史 视图标题行强制复用大纲标准结构（字号 / 中轴 / 横线 / 星标占位）
变更：src/style.css, src/views/lists.ts, src/views/presentation.ts, tests/v21-fix26-ui-align.spec.ts
门禁：verify-hash-registry RESULT=PASS（66 方 / drift 0）；verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）
发布：8.发布与CI/release/v2.1.0-2026-10-29（Web 4,699,887 B · exe 6,767,104 B · checksums 169 B）
日志镜像：2.项目日志/fix26-p3-verify-all-r2-2026-10-30.txt、fix26-p3-hash-registry-r2-2026-10-30.txt、m07-fix26-p3-build-all-2026-10-30.txt
edge_profile 清理：90过程材料/tmp/ 下 edge_profile* 匹配为空 ⇒ 跳过删除，未删除任何其他内容（2/2 复核仍为空）
