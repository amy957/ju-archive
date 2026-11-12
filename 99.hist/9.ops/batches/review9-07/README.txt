批次：review9-07/14 · ISSUE-007 build-all 必须跑恢复用例
时间：2026-11-03（UTC 10:50 ~ 10:58）
DIST_BEFORE：4,708,966 B / 5F323F7244C0C9994697ED50C934EF46707FADCC3A06289FE52FC0C6EBA3D347
DIST_AFTER ：4,708,966 B / 5F323F7244C0C9994697ED50C934EF46707FADCC3A06289FE52FC0C6EBA3D347（零漂移）
变更：6.P0-T3基线/m07-vite/scripts/build-all.mjs 两处（E2E_SPECS 追加 tests/v21-review8-recovery.spec.ts；CLOSED_HIGH_SPECS 同步追加）
命令：
  1) set "PATH=99.开发辅助工具;%PATH%" + JU_RELEASE_OVERWRITE=1 / JU_BUNDLES=nsis / JU_BUILD_DATE=2026-11-03，node 6.P0-T3基线\m07-vite\scripts\build-all.mjs
  2) 负向：临时删 E2E_SPECS 内该行后同命令
  3) node 6.P0-T3基线\step9\verify-hash-registry.mjs
  4) node 6.P0-T3基线\step9\scripts\verify.js all（JU_CHROMIUM_PATH=ms-playwright/chromium-1248/chrome-win64/chrome.exe）
日志：2.项目日志/review9-07-{build,falsify,hash-registry,verify-all}-2026-11-03.txt
edge_profile* 匹配：0 项，已跳过（无删除）
回执：review9-07_回执_20261103.md
