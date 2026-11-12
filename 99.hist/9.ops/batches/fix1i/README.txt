批次：fix1i（CLOSED_HIGH_SPECS 手工列表 → tests/ 自动扫描）
时间：2026-11-05T07:00Z
变更：6.P0-T3基线/m07-vite/scripts/build-all.mjs
  - CLOSED_HIGH_SPECS 改为 readdirSync(tests) + /^v21-(review|fixr|fixhex)\d+.*\.spec\.ts$/ 扫描
  - 追加 3 项 E2E_SPECS 登记：review12-preimport-lifecycle / fixr6-13-db-skip / review5-feature-entries
  - 保留缺一 Exit 1，并补反向核对（E2E 已登记的关闭链路 spec 必须仍在扫描集合）
DIST_BEFORE：4713947 B A51E8849E4AE441071A02D54ADAD70E066A8A088F5D06EF301C22BE2725543C3
验收：build-all 日志含 CLOSED_HIGH_SPECS: 13 项；Exit 0
证伪：移出 tests/v21-review10-enc-preimport.spec.ts → Exit 1 且打印该文件名
回执：fix1i_回执_20261105.md
