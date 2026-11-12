批次：fix1h（check-inline-style THRESHOLD_MODE record→hard）
时间：2026-11-05T06:49Z
DIST_BEFORE：6.P0-T3基线/m07-vite/dist/index.html 4,713,947 B / A51E8849E4AE441071A02D54ADAD70E066A8A088F5D06EF301C22BE2725543C3
DIST_AFTER：同上（零重建，本批仅改 scripts/check-inline-style.mjs）
变更：
- HEX_LIMIT=130（实测 130）冻结
- BANG_LIMIT=72（实测 72）冻结
- THRESHOLD_MODE='hard'；超阈值经 failed += 1 → Exit 1
- 文案 [record] → [hard]
实测计数：hex raw 130 / 去注释 121；!important 72
证伪：BANG_LIMIT=71 → Exit 1，输出 FAIL !important 72 > 71 [hard]；复原 72 → Exit 0
门禁：verify-hash-registry RESULT=PASS（PARTY_COUNT=66 · drift 0）；verify.js all r5 Exit 0（静态 0 · Node 503 · PW 167 passed · bench 0.0%）
r1/r2/r4 红：r1、r4 PW t7-index-worker 时序抖动（mode worker→sync/shadow）；r2 t16-w10 P95=1.9851ms；r3/r5 复跑全绿
edge_profile* 匹配 0 项，已跳过（未删除任何文件）
