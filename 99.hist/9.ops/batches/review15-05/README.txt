批次：review15-05（ISSUE-005 · F 用例可证伪明文残留）
时间：2026-11-06T15:00+08:00
DIST_BEFORE：4,715,494 B / AF554472…0509（6.P0-T3基线/m07-vite/dist/index.html）
变更：tests/v21-review12-preimport-lifecycle.spec.ts F 追加 3 行（nodes 空 + encStore 非空）
禁改项：E 断言未动；r14Mock 延迟语义未动
定向验收：npx playwright test tests/v21-review12-preimport-lifecycle.spec.ts → 7 passed
证伪：mock 失败前按 save_state 同构写明文并保留 encStore → F :197 红（Expected 0 / Received 7），复原后 7 passed
DIST_AFTER：4,715,494 B / AF554472…0509（spec prepare 重建，哈希不变）
门禁：登记器 PARTY_COUNT=66 / drift 0 / RESULT=PASS；verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）
edge_profile*：90过程材料/tmp 下匹配 0 项，已跳过
