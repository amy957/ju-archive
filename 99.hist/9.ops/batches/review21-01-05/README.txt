批次：review21-01-05（ISSUE-001/002 发布门禁对 Rust 源与当前 dist 断言 + exe/setup 重建）
时间：2026-11-08T06:42Z（UTC）/ 2026-11-08 14:42（UTC+8）
DIST_BEFORE：4,716,598 B / D5DC035A…42DE7（dist/index.html，2026-11-07 23:39:30）
EXE_BEFORE：7,355,904 B / 84B39CB6…F048（JU.exe，2026-11-07 22:27:19，早于 main.rs 2026-11-08 00:45:04）
变更文件：
  6.P0-T3基线/m07-vite/scripts/check-release-parity.mjs（EXE_AFTER_SRC 扩展 + EXE_STALE 锚点 max(归档 Web, dist)）
  6.P0-T3基线/m07-vite/scripts/build-all.mjs（staleReason 纳入 main.rs/Cargo.toml/build.rs mtime）
产物：build-all.txt（重建实跑日志）
