批次：review12-fix1205（#3/#4/#7 代码修复 + 实机复测）
时间：2026-11-05
DIST_BEFORE：4,714,056 B / BBF4F861E4DAD162FCD4029A2F00E24F5F01F1B0495F2029F8BD00B18F875641
DIST_AFTER：4,715,035 B / B475CD26F1567D1194BE41AE1F6242C7A7B8BA2B401DC7DF82C4E94BB2BA88FC
EXE：7,332,864 B / BD31B1548346CF5AB0A214F8E44DE429AEC2DCE3BFE31D099098580B23839436
变更：src/ui/layout.ts · src/app/session.ts · src-tauri/src/main.rs · src/core/persist.ts · tests/v21-fixr6-close-persist.spec.ts
结果 #3：PASS，FINAL_COUNT=5（6 轮自定义 X 计数 1/2/3/4/5/5）
结果 #4：PASS，MARKER_FOUND=1（90ms 双击，退出 487ms）
结果 #7：PASS，COMMIT_TO_KILL_MS=114，MARKER_FOUND=2（store 4,426→4,446）
门禁：build-all Exit 0（14 步 · E2E 38 passed · 6b PASS）；cargo test 10 passed
门禁：verify.js all Exit 0（静态 0 · Node 503 · PW 167+4=171 · bench 0.0%）；登记器 66 方 / drift 0 / PASS
环境：%APPDATA%/%LOCALAPPDATA% 隔离后已还原，store 79,646 B / 3DCF3235… / 2026-11-01T22:22:52
证据：item3-final.log · item4a-final.log · item4b-final.log · item7f-final.log · item7b-final.log · restore-final.log · shots/
edge_profile*：90过程材料/tmp 下匹配 0 项，跳过，未删其他内容
