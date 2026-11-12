批次：fix34-5/X（ISSUE-005 装配闸门漏检 dsLoadState）
时间：2026-10-31 23:11 (+08:00)
DIST_BEFORE：不适用（本批仅改 m07-vite/scripts 闸门，未触 src/** 与 dist）
变更：scripts/check-deps-wired.mjs SPEC 中 bindPersistDeps 键表末尾追加 'dsLoadState'
证据日志（均在 90过程材料/tmp/）：
- fix34-5-check-deps-wired.txt 正向 PASS
- fix34-5-neg.txt 负向 FAIL（沙箱副本删注入行，未改 src）
- fix34-5-hash.txt 哈希登记 RESULT=PASS drift=0
- fix34-5-verify-all.txt 全量 verify all Exit 0
edge_profile* 匹配项：空（跳过，未删除任何内容）
