批次：fixr6-15/19（ISSUE-015 关闭备份文件名口径不一致）
时间：2026-11-01
DIST_BEFORE：4,705,111 B / A0A1C9AC…E60DC6
DIST_AFTER：4,705,118 B / D9FF2C7C…09EEF00
变更：src-tauri/src/main.rs（save_backup 增 name: Option<String>）· src/app/session.ts（_closeBackupPayload 单传 name）
证据：cargo-test-green-r2.log · cargo-test-red.log · tsc.log · vite-build.log · hash-registry.log · verify-all.log · pw-backup.log
口径：name 与 path 并存（path 仍为 dir + '/' + name，Rust 取父目录、以 name 为唯一文件名来源），fix41/42/40 桩零改动
edge_profile*：90过程材料/tmp 下匹配 0 项，已跳过
