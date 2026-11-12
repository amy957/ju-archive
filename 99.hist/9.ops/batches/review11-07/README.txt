批次：review11-07/09 · ISSUE-007 waitForTimeout 计数单调下降（关闭/落盘/加密相关 spec 条件化）
时间：2026-11-04（UTC 07:43–08:13）
DIST_BEFORE：4,713,030 B / 5AF650EC888FE0577579CFF5970BA2754FB6E7640AFE1CAE4BDCB2C1EE52CE72
DIST_AFTER ：4,713,030 B / 5AF650EC888FE0577579CFF5970BA2754FB6E7640AFE1CAE4BDCB2C1EE52CE72（recovery 重建同字节）
计数：215 → 201（−14）；任务卡 211 处/210 行为陈旧基线（缺 v21-review11-preimport-once 的 4 处）
变更：v21-fix2-btnsync 7 处 / v21-fix9-settings-bind 5 处 / recovery 2 处 → expect.poll 条件同步
定位纠偏：任务卡点名的 3 个 spec（fix33-desktop-save-guard / fixr6-close-persist / fix40-topbar-close-backup）实际 waitForTimeout=0
证伪：settings-bind 单处回退 waitForTimeout(500) → 计数 202、spec Exit 0（假绿）；复原 SHA256 全等、计数 201
绿证：btnsync 2 passed ×3 / settings-bind 6 passed ×3 / recovery 2 passed ×3（均 Exit 0）
门禁：登记器 PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS；verify.js all r3 Exit 0（静态 0 · Node 503 · PW 171 · bench 0.0%）
说明：r1/r2 红因 JU_CHROMIUM_PATH 指向不存在的 Program Files Chrome；r3 改用 LOCALAPPDATA 路径后全绿
证据：settings-bind.bak.ts · 2.项目日志/review11-07-*.txt
edge_profile*：90过程材料/tmp 匹配 0 项，按规则跳过，无删除
