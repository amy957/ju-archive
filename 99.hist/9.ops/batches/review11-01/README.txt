批次: review11-01/09 (ISSUE-001 加密态 preimport 一次性)
时间: 2026-11-04 (UTC+8)
DIST_BEFORE: 4712563 B / FDD095886FDD58357F096470A3DD64C2E7F7DADBF46E70FB09B54336B8F69711
DIST_AFTER: 4712768 B / BBAB5C84EDBB5D6CD84BBC351963BED893F49ACE07FEC9FF7E4BBB5ABF8622AB
源码: src/app/boot.ts, src/main.ts, src/io/import.ts
测试: tests/v21-review11-preimport-once.spec.ts(新建), tests/v21-review10-enc-preimport.spec.ts(改期望), tests/v21-review9-02-preimport-enc.spec.ts(改期望)
验收: playwright test tests/v21-review11-preimport-once.spec.ts tests/v21-review10-enc-preimport.spec.ts -> 2 passed
证伪: 回退 boot.ts:1444 后同命令 -> Expected "REVIEW11-KEEP" / Received "REVIEW10-PREIMPORT"
回归: review9-02 (2 passed) / tsc Exit 0 / 登记器 PASS(66,drift 0)
门禁: verify.js all RED：L16-W21 §E merge P95 223~254ms > 200ms（ISSUE-005 环境抖动，单跑 4 次均红）
证据: verify-all.log, verify-all-r2.log, w21-single{,r2,r3,r4}.log
edge_profile*: 0 项，跳过删除
