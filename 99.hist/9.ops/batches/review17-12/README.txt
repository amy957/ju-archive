review17-12 / ISSUE-012 批次记录
批次：review17-12（并发写同一临时文件交错损坏）
时间：2026-11-07（本地 UTC+8）
DIST_BEFORE：4,716,422 B / BDB089050B30B707BF0385BB9F778D816FB540371816B5F617A5A40DEAB6685E
改动文件：6.P0-T3基线/m07-vite/src-tauri/src/main.rs（唯一）
临时文件：ju_store.<pid>.<AtomicU64 序号>.json.tmp
互斥：进程内 STORE_WRITE_LOCK（Mutex）保留
rename 前：回读临时文件并 serde_json::from_str 复核，失败即删除并返回错误
证据：2.项目日志/review17-12-cargo-test-r3-2026-11-07.txt（14 passed）
      2.项目日志/review17-12-falsify-2026-11-07.txt（固定名 + 11 次放大，3 次不可解析）
      2.项目日志/review17-12-hash-registry-2026-11-07.txt（PASS / drift 0）
      2.项目日志/review17-12-verify-all-2026-11-07.txt（Exit 0）
edge_profile*：0 项，已跳过
