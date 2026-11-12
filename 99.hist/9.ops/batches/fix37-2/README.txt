fix37-2 批次留档（2026-11-01 · 北京时间 12:4x）
目标：跨行选区富文本格式「一键取消」彻底修复 + 重打包。
PRE_FIX 发布包（fix37-1 产物，已整体迁入本目录 prev-release-v2.1.0-2026-11-01）：
  JU-v2.1-Web.html      4,699,044 B  B57259AC…8BE86
  JU-v2.1-win-x64.exe   6,776,320 B  55954609…F142
  JU-v2.1-checksums.txt       169 B  E25D5400…739C
DIST_BEFORE（本批改动前，源码已改但未 build-all）：4,700,334 B / F3F7B5ED…4B1F
DIST_AFTER （build-all 第 3 步重建，E2E 与 tauri 内嵌同一字节）：4,700,334 B / F3F7B5ED…4B1F
RELEASE_AFTER：Web 4,700,334 B / F3F7B5ED…4B1F · exe 6,774,272 B / 0756583E…4A14 · checksums 169 B / 759F79E9…4B2F
本目录文件：pw-red.log（旧包红灯 Expected 0/Received 3）、pw-green.log（3 passed）、
  pw-richtext-subset.log（富文本/选区 8 件 34 passed）、build-all.log（6/6 · E2E 6 passed）、
  dist-before.txt、prev-release-manifest.txt、README.txt、fix37-2_回执_20261101.md
