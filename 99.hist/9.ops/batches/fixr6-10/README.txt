fixr6-10 / 19 · ISSUE-010 双闸门接线 + CI 补零漂移 / 内联样式
批次：fixr6-10（第 10 批 / 共 19）
时间：2026-11-01T15:02Z（Asia/Shanghai 2026-11-01 23:02）
DIST_BEFORE sha256=b569b0e9b1ea37fb75deff092487bab416293cf1b4e00acc0599b8730c5be818 bytes=4705615
DIST_AFTER  sha256=b569b0e9b1ea37fb75deff092487bab416293cf1b4e00acc0599b8730c5be818 bytes=4705615
CANON       sha256=5fed021578e775b560bf98af719046eb2916472f4053354a33a1a436dfbff818 bytes=1316707
变更：m07-ci.yml（+2 步）/ package.json（scan:license）/ build-all.mjs（1d）/ docs/UNUSED-EXPORTS.md（接线状态）
证据：audit-license Exit 0；check-parity PARITY OK；check-inline-style P0 PASS
负向：public 副本末尾追加 1 字节 → PARITY FAIL Exit 1，已按原字节还原
门禁：verify-hash-registry RESULT=PASS drift=0；verify.js all Exit 0（静态 0 / Node 503 / PW 171 / bench 7-7）
edge_profile*：90过程材料/tmp/ 下无匹配项，跳过（未删除任何文件）
