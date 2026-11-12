批次：review20-01-01/6 · ISSUE-001（发布阻塞=是）
时间：2026-11-07T16:13Z（本地 2026-11-08 00:13）
DIST_BEFORE=4,716,598 B / d5dc035a…42de7
DIST_AFTER=4,716,598 B / d5dc035a…42de7（未重建）
变更：6.P0-T3基线/m07-vite/src-tauri/src/main.rs（1 文件）
  + existing_store_or_quarantine：读失败且 path.exists() → rename 为
    ju_store.corrupt-<UTCms>.json（只移不删），rename 失败返回 Err
  save_state / save_plain_and_clear 两处改调该函数，不再 unwrap_or_else 静默覆盖
证据：cargo-test.txt（17 passed）
  falsify.txt（FAILED · left: 0 right: 1 · 无 .corrupt- 文件）
  cargo-test-after-restore.txt（17 passed）· main.rs.fixed.bak
  hash-registry.txt（RESULT=PASS）· verify-all.txt（全部通过）
  release-parity.txt（Web=dist d5dc035a… · Exit 0）
备注：copy /Y 保留备份 mtime，cargo 复用旧二进制曾致恢复后假红；
  以 PowerShell 刷新 LastWriteTime 再编译后转绿（详见回执）。
edge_profile* 匹配 0 项，已跳过（未删除任何内容）。
