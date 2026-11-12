批次：review6-17/19（ISSUE-017 build-all 摘要遗漏步骤）
时间：2026-11-02T10:35Z
改动：6.P0-T3基线/m07-vite/scripts/build-all.mjs:266 一行（摘要改列 12 步并带 STEP_TOTAL）
禁改项：步骤执行顺序、runStep 语义、STEP_TOTAL 值（12）均未动
DIST_BEFORE：缺失（m07-vite/dist/index.html 不存在；本批只改 scripts，不重建）
DIST_AFTER：缺失（未重建，既有状态，非本批引入）
证据：
- run-first10.ps1：跑 build-all 取首 10 行并断言 1c/1d/6b
- first10-red.txt + assert-red.txt：旧摘要 10 行 0 命中（False/False/False）
- first10-green.txt + assert-green.txt：新摘要 10 行 True/True/True
- 2.项目日志/review6-17-verify-all-2026-11-02.txt：verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）
- 哈希登记器：PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS，build-all.mjs 不在登记范围
edge_profile*：90过程材料/tmp 下 0 项匹配，跳过
