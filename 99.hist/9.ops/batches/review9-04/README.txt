批次：review9-04/14（ISSUE-004 归档与 dist/src 对齐）
时间：2026-11-03T09:29Z-09:31Z（UTC）
命令：JU_RELEASE_OVERWRITE=1 JU_BUNDLES=nsis JU_BUILD_DATE=2026-11-03 node scripts/build-all.mjs
DIST_BEFORE：4,708,763 B / e1c2f36b…85f0b3c4（2026-11-03T09:11:07Z）
DIST_AFTER ：4,708,763 B / e1c2f36b…85f0b3c4（vite 重跑同字节，零漂移）
归档根：8.发布与CI/release/v2.1.0-2026-11-03/
  JU-v2.1-Web.html      4,708,763 B / e1c2f36b…85f0b3c4
  JU-v2.1-win-x64.exe   7,320,064 B / 5ff3ddb4…cf7b5ff
  JU_2.1.0_x64-setup.exe 4,456,193 B / f43d8db9…46bef4c4
  JU-v2.1-checksums.txt      258 B / 3 行
批前红线：parity Exit 1（归档 CDCB84C5…D96128 ≠ dist e1c2f36b…）
批后绿线：parity Exit 0（Web/exe 双向一致）
日志：2.项目日志/review9-04-{red,precheck,build,green,hash-registry}-2026-11-03.txt
edge_profile* 匹配 0 项 → 跳过并记录
