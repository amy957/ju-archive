批次：review12-final（全链路 + Gate1-8 + 实机 item1）
时间：2026-11-05T18:51+08:00
DIST_BEFORE：4,714,056 B / BBF4F861…（persist/test 修改后未打包）
DIST_AFTER：4,714,056 B / BBF4F861…（build-all 重建同哈希）
Web：4,714,056 B / bbf4f861…；exe：7,324,672 B / 6bf223d2…；setup：4,457,154 B / a93c1be1…
验收：build-all Exit 0（14 步 · E2E 38 passed · 6b 全 ✓）；Gate1-8 全 Exit 0；哈希登记 66/0/PASS
实机 item1：store 6,751 B / 9C194C80… 命中 1（关窗前/后）；原 APPDATA 3DCF3235… 已还原
证据：build-all.log · gate1..8*.log · hash-registry.log · receipt.json · ju_store-item1-final.json · item1-final-run.log · item1-final-before-close.png
遗留：实机 #3/#4/#7 未复跑，维持 review12-realcheck 失败记录
edge_profile*：本批未匹配删除
