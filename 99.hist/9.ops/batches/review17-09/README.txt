批次：review17-09（ISSUE-009 阻止旧 setup 随新 exe 混入）
时间：2026-11-07T05:5xZ（UTC）
DIST_BEFORE：4,716,422 B / bdb089050b30b707bf0385bb9f778d816fb540371816b5f617a5a40deab6685e
DIST_AFTER：同 DIST_BEFORE（本批未重建 dist）
变更件（1）：6.P0-T3基线/m07-vite/scripts/check-release-parity.mjs（+6 行）
归档目录：8.发布与CI/release/v2.1.0-2026-11-07
  setup 4,457,987 B / a4f1d917…ca9a2425 / mtime 12:39:32.1378773+08:00
  exe   mtime 12:39:28.9923311+08:00
  NSIS  bundle/nsis/JU_2.1.0_x64-setup.exe 同 SHA-256 a4f1d917…ca9a2425
命令：
  node 6.P0-T3基线/m07-vite/scripts/check-release-parity.mjs → Exit 0
  负向：setup mtime 改 12:34:28.992 → Exit 1 SETUP_STALE；已还原原 mtime
  负向前后 setup 字节不变（size 4,457,987 / sha a4f1d917…）
edge_profile*：90过程材料/tmp 匹配 0 项，已跳过，未删其他内容
