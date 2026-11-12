批次：review9-03/14（ISSUE-003 关闭落盘与备份开关解耦）
时间：2026-11-03（UTC+8）
改动：src/app/session.ts::_saveBackupOnClose；tests/v21-fixr6-close-persist.spec.ts（追加 review9-03 用例）
DIST_BEFORE：4,708,763 B / 73E789CB…BBEFD4DC（沿用 0.77 登记值，本批批前未重采集）
DIST_AFTER：4,708,763 B / e1c2f36b…85f0b3c4（仅语句位置变化，压缩后字节数不变）
基线：HEAD.json 未变；canonical / step9 镜像零改动
门禁：tsc Exit 0；登记器 PARTY_COUNT=66 / drift 0 / PASS；verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）
证据：本目录 review9-03_回执_20261103.md
      2.项目日志/review9-03-build-2026-11-03.txt
      2.项目日志/review9-03-spec-green-2026-11-03.txt
      2.项目日志/review9-03-spec-red-2026-11-03.txt
      2.项目日志/review9-03-spec-green-r2-2026-11-03.txt
      2.项目日志/review9-03-hash-registry-2026-11-03.txt
      2.项目日志/review9-03-verify-all-2026-11-03.txt
edge_profile*：90过程材料/tmp 下 0 项匹配，已跳过（未删除任何其他内容）
