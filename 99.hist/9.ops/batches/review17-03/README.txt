批次：review17-03/13 · ISSUE-003 dist 早于 src 发布滞后
时间：2026-11-07T05:19Z（Asia/Shanghai 2026-11-07 13:19）
发布阻塞：是
DIST_BEFORE：4,716,422 B / BDB08905…6685E @ 2026-11-07 12:27:21
变更文件：2.项目日志/CURRENT_TASK.md（登记 0.135 ISSUE-003）；构建产物 dist/Web/exe/setup 重建
构建：JU_RELEASE_OVERWRITE=1 JU_BUNDLES=nsis node scripts/build-all.mjs（BUILD_DATE=2026-11-07）→ Exit 0 · 14/14
DIST_AFTER：4,716,422 B / BDB08905…6685E @ 2026-11-07 12:38:59（内容同哈希，仅 mtime 刷新）
归档：8.发布与CI/release/v2.1.0-2026-11-07/（Web=dist bdb08905…6685e · exe bee37ea0…c301 @12:39:28 · setup 4,457,987 B @12:39:32 · checksums 258 B）
验收：check-dist-parity.mjs Exit 0；check-release-parity.mjs Exit 0；Get-Item dist/index.html,归档exe → exe ≥ dist（True）
证伪：touch src/app/session.ts → 输出「✗ dist 早于以下输入的最新变更: src/**/*.ts|css」Exit 1；还原本文件 mtime 2026-11-06 21:18:21.144 后 Exit 0
口径：release-manifest.json:5 parity=PASS 仅代表 Web/exe/checksums，不含 src-vs-dist 新鲜度
遗留：ISSUE-001 仍需 P-15/P-16 实机复核；review17 其余 ISSUE（002/004/005/008/009/010/011）待续
edge_profile*：90过程材料/tmp/ 下 0 项命中，已跳过
