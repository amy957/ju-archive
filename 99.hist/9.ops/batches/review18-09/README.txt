批次：review18-09（ISSUE-009 备份并发截断 · 发布阻塞=条件）
时间：2026-11-07T11:30Z 起（UTC+8 19:30 起），末次门禁 2026-11-07T11:54Z
变更：6.P0-T3基线/m07-vite/src-tauri/src/main.rs（1 文件，+35 / -10 行）
DIST_BEFORE：6.P0-T3基线/m07-vite/dist/index.html 4716422 B · BDB089050B30B707BF0385BB9F778D816FB540371816B5F617A5A40DEAB6685E
DIST_AFTER：同 BDB08905…DEAB6685E / 4716422 B（本批不重建 dist；check-release-parity EXIT 0）
SRC_AFTER：main.rs 39495 B · 86775012231D4F7A6391E515B74D59CAB7185AB67DC7935667927F4D03ECDB50
证据：cargo-test.txt（16 passed）· cargo-test-after-restore.txt（复原后 16 passed）· falsify.txt（3/3 FAILED）
　　　verify-all.txt（EXIT 0）· hash-registry.txt（PARTY_COUNT=66 / drift 0 / PASS）· release-parity.txt（EXIT 0）
　　　main.rs.fixed.bak（本批冻结源副本，SHA256 同上）
edge_profile*：90过程材料/tmp 下匹配 0 项，已跳过清除，未删任何其他内容。
备注：cargo 缓存陷阱——Copy-Item 复原会保留旧 mtime 导致跳过重编译，复原后须 touch 再跑。
