批次：fix32-10（ISSUE-010 打包目标与白名单对齐）
时间：2026-10-31
DIST_BEFORE：4,702,332 B / 9B01FCFC618599F3BE82D1D760A08DEDE654AD9405ED499A673004398580A3A5（release v2.1.0-2026-10-29/JU-v2.1-Web.html）
DIST_AFTER：4,698,861 B / 3DB00F3758FDFF42E306CAF4768772C6C50300F1E0BDC61F6E8645C9B61A8841（vite build）
变更文件：
- 6.P0-T3基线/m07-vite/src-tauri/tauri.conf.json：targets ["app"] → ["nsis"]；删除无效 allowlist.fs 段
- 6.P0-T3基线/m07-vite/package.json：build:app 去掉 --bundles none
- 6.P0-T3基线/m07-vite/src/app/updater.ts：UPDATER_ACTIVE=false 短路，返回 null，不导入 updater API
验收：
- verify.js all：Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）
- verify-hash-registry.mjs：PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS
- tauri build：Rust 编译 Finished release 10.25s；nsis-3.zip 与 nsis_tauri_utils.dll 校验通过；makensis 打包成功
- 产物：src-tauri/target/release/bundle/nsis/JU_2.1.0_x64-setup.exe（4,322,528 B / 2026-10-31T11:25:52Z）
环境：npm 不在 PATH，改用 99.开发辅助工具/node.exe + node_modules/@tauri-apps/cli/tauri.js
edge_profile*：90过程材料/tmp/ 下无匹配项，跳过（未删除其他内容）
