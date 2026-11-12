批次：review15-03/13（ISSUE-003 归档 Web/exe/setup 与 dist 同源）
时间：2026-11-06T11:37Z（本地 19:37）
目录：8.发布与CI/release/v2.1.0-2026-11-06/
DIST_BEFORE：4,715,782 B / 8fb58d1267dd6b175526f4d20e782c471024f4a0eebe0cea1fd3ea7c16cda024
ARCHIVE_BEFORE：11-06 Web 8fb58d12…da024 / exe 48ddf6fa…2e133d / setup 9972592b…f57b（4457551 B）
证伪（重打包前）：JU_BUILD_DATE=2026-11-05 check-release-parity Exit 1，
             归档 Web fe48c6a7…2582 ≠ dist 8fb58d12…da024（与任务卡缺陷态一致）
说明：同日 11-06 目录已存在且 Web 同源（此前批次产出），裸跑 parity 指向 11-06 为绿；
      红态以 11-05 归档复现，不得据此认定 11-06 曾复用旧 exe/setup（本轮已重出字节）
重打包命令：JU_RELEASE_OVERWRITE=1 JU_BUNDLES=nsis node scripts/build-all.mjs（cwd 6.P0-T3基线/m07-vite）
结果：Exit 0，14/14 步全绿（tsc/1b/1c/1d/1e/1f/1g/test/vite/3b/e2e/tauri/prepare-release/6b）
产物：Web 8fb58d12…da024；exe 33a848e8…b43d1（7345664 B）；setup 562a493d…6fe（4458341 B）
      checksums 3 行；manifest/RELEASE-NOTES 按真实字节重写
PREV_AFTER：1（v2.1.0-2026-11-06.prev-1793965057331；旧让位件移入 90过程材料/tmp/fixr6-12/）
EDGE_PROFILE：90过程材料/tmp 下 edge_profile* 匹配 0 项，按规则跳过（未删任何文件）
失败留痕：首次重打包在 [6/14] prepare-release 因 EBUSY 中断（PID 22848 运行归档 exe 占用），
      用户关闭实例后全链路重跑 Exit 0；首次失败未改动 dist/归档字节
