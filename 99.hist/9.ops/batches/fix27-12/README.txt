批次：fix27-12 发版重建 nsis（outline.ts 变更后重打包 · 归档日期 2026-11-10）
时间：2026-11-10T13:10Z～2026-11-10T13:29Z
DIST_BEFORE：4,719,438 B / 6FED7D742F2B75636A7122A03EA6AF9CF21938247E1897D9EFD1E4F419868E34
DIST_AFTER ：4,719,438 B / 6FED7D742F2B75636A7122A03EA6AF9CF21938247E1897D9EFD1E4F419868E34（零漂移）
命令：$env:JU_RELEASE_OVERWRITE='1'; $env:JU_BUNDLES='nsis'; $env:JU_BUILD_DATE='2026-11-10'
     node scripts/build-all.mjs（cwd=6.P0-T3基线/m07-vite）
首次红（build-all-nsis-2026-11-10-r4.txt）：步骤 1-5 全绿，第 6 步 prepare-release EBUSY
     rename 'v2.1.0-2026-11-10' -> '...prev-1794316545478'，占用者 PID 13096 JU-v2.1-win-x64.exe
     （从归档目录双击启动的旧包实例）。用户裁决：终止 PID 13096 后重跑。
第二次绿（build-all-nsis-2026-11-10-r5.txt）：Exit 0，1-6b 全绿，E2E 59 passed，checksums 3 项。
归档让位：v2.1.0-2026-11-10.prev-1794317036294（JU_RELEASE_OVERWRITE=1）。
