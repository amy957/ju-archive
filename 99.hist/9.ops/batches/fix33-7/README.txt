批次：fix33-7 / ISSUE-007 release Web 仍为 fix31 旧包
时间：2026-10-31（本地 UTC+8）
变更：6.P0-T3基线/m07-vite/scripts/release-paths.mjs BUILD_DATE 2026-10-31 -> 2026-11-01
执行：node scripts/build-all.mjs（tsc -> test -> vite -> e2e -> tauri -> prepare-release）
DIST_BEFORE: 4,698,835 B / 77749e67…3EEB（m07-vite/dist/index.html）
RELEASE_OLD: 8.发布与CI/release/v2.1.0-2026-10-31（原样保留，不覆盖不删除）
WEB_OLD_SHA256: 9b01fcfc618599f3be82d1d760a08dede654ad9405ed499a673004398580a3a5
EXE_OLD_SHA256: 00e44391d5d87d02350e2d9223728f1953d441a92413a131806aa86b62d1515a
RELEASE_NEW: 8.发布与CI/release/v2.1.0-2026-11-01（本轮新目录）
禁改：旧 release 目录 / 冻结件 / canonical / step9 镜像
验收：build-all Exit 0；新 Web SHA-256 != 9b01fcfc…a3a5；Select-String 'pre-persist merge skipped' 命中
证伪：新包哈希仍为旧值，或新包缺少该字符串，即失败
