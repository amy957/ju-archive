批次 review20-01-03/6  ISSUE-003 聚焦请求不得在窗口未就绪时丢失
时间 2026-11-07T16:24Z ~ 2026-11-07T16:30Z (UTC)
DIST_BEFORE dist/index.html bytes=4716598 sha256=d5dc035aca7ee32bc240fdce7a9f5ed4c2cafb1c03077a1c5a0138f752442de7 mtime=2026-11-07T15:39:30Z
DIST_AFTER  同上（未重建，verify.js all 未改写 dist 字节）
证据文件
cargo-test.txt               修复后全量 cargo test → Exit 0 / 18 passed（focus_when_ready 用例 5.00s）
falsify.txt                  证伪：helper 改单次 if let Some 且恒 true → 同用例 FAILED「无窗口时不得声称聚焦成功」src\main.rs:746
cargo-test-after-restore.txt 复原后复跑 → Exit 0 / 18 passed
hash-registry.txt            RESULT=PASS PARTY_COUNT=66 FIVE_PARTY_DRIFT_COUNT=0
verify-all.txt               verify.js all → Exit 0；静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%
main.rs.fixed.bak            修复后字节备份 sha256=1066A4F1FDFE07FCC6C0DA238BC01FCB158ED5934497FE2DBF36C0552CFE1F6C
edge_profile* 匹配 0 项已跳过（未删除任何其他内容）
