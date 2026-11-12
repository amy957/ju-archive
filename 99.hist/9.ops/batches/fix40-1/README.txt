批次：fix40-1/2（顶栏置顶与设置对调 · 移除退出确认 · 关闭备份落盘）
时间：2026-11-01
产品树：6.P0-T3基线/m07-vite（canonical / step9 镜像零改动）
DIST_BEFORE：4,703,090 B / 0FC69728…BC04（release/v2.1.0-2026-11-01/JU-v2.1-Web.html 同值）
DIST_AFTER：4,703,693 B / BB4A5A67…B53110
EXE_AFTER：6,778,880 B / 4307A6F5…95315
变更文件（3 文件 + 新建 1 用例 + 归档件）：
- index.html：顶栏右侧 #btnSettings 与 #btnPin 顺序对调（置顶在设置右侧）
- src/ui/layout.ts：deps 增 backupOnClose；#btnClose 去掉 appConfirm，改「先备份最多 1.5s 再直接退出」
- src/main.ts：新增 backupOnClose 实现（桌面 invoke write_backup_file，失败 toast）
- src-tauri/src/main.rs：新增并注册 write_backup_file 命令（dir 为空 ⇒ app_data_dir/backups）
- tests/v21-fix40-topbar-close-backup.spec.ts：新建 1 例（顺序 / 无弹窗 / 备份调用）
验收命令：
- node 6.P0-T3基线/step9/verify-hash-registry.mjs（66 方 / drift 0 / PASS）
- node 6.P0-T3基线/step9/scripts/verify.js all（静态 0 · Node 503 · PW 171 · bench 7/7）
- node node_modules/@playwright/test/cli.js test "v21-fix40"（1 passed）
- node scripts/build-all.mjs（步骤 1–5 通过；第 6 步重复归档守卫拒绝）
- JU_BUILD_DATE=2026-11-02 node scripts/prepare-release.mjs + check-release-parity（PASS）
edge_profile*：90过程材料/tmp 下匹配 0 项，按规则跳过（未删除任何内容）
