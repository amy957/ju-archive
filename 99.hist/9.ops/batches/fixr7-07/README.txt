fixr7-07 批次材料（2026-11-02 13:27Z）
批次：review7-07/20 · ISSUE-007 关闭备份只写授权目录（发布阻塞）
DIST_BEFORE：4,705,410 B / 3583C822F21762D1141723FE5766BD4FEAD23BA9617BE298402D35D9B29DD221
DIST_AFTER ：4,705,509 B / 450743964B5738FE738060779D7882331E6C6C9B37E92973F49CE22802B4158A
文件：probe-blocked-dir.mjs · probe-green.log · probe-red.log · probe-normal-dir.log · rust-test-final.log · rust-falsify.log · build-dist.mjs · build-final.log
探针口径：假 Tauri 桥记录 save_backup 入参；localStorage juju.ui.v31 置 backupDir=C:/Windows + autoBackupOnClose=true；
断言关闭回调后 path=="" 且出现「该位置为系统关键目录」toast。
证伪：session.ts 守卫加 false && 重建 dist → BACKUP_PATH="C:/Windows/JU-备份-2026-11-02.json"、RESULT=FAIL；
Rust 白名单行加 false && → save_backup_rejects_system_dir FAILED（实得 Ok("C:\\Windows\\Temp\\JU_Backup_….json")）。
非误伤：JU_PROBE_DIR=D:/JuBackups → BACKUP_PATH="D:/JuBackups/JU-备份-2026-11-02.json"、RESULT=PASS。
edge_profile*：90过程材料/tmp 下匹配 0 项，跳过清理（未删其他内容）
