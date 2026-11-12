批次：review11-02/09 · ISSUE-002 发布三角滞后（发布阻塞=是）
时间：2026-11-04（UTC+8）
DIST_BEFORE：dist/index.html 4,712,768 B / bbab5c84…bf8622ab（review11-01 测试 prepare 重建）
归档 BEFORE：v2.1.0-2026-11-03 Web 4,712,153 B / 8892f340…d1a7a886（落后 dist，滞后源）
PREV_BEFORE：1 件（v2.1.0-2026-11-03.prev-1793720162324）
命令：JU_RELEASE_OVERWRITE=1 / JU_BUNDLES=nsis / JU_BUILD_DATE=2026-11-03 跑完整 build-all
验收：node scripts/check-release-parity.mjs（期望 Exit 0，三行 ✓）
证伪：JU_BUILD_DATE=2026-11-02 同命令 → ✗ ISSUE-006 归档 Web 与 dist 不一致（Exit 1）
禁改：归档历史目录仅整体让位 / checksums 3 行 / release-manifest.json 4 条目
edge_profile* 匹配：0 项，跳过（未删除任何内容）
