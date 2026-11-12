批次：fix34-6/X  ISSUE-006 无自动化三角校验
时间：2026-10-31T15:16Z（local 2026-10-31 23:16）
DIST_BEFORE=efe6d72bcde7936f4a9ef785a03a335495369dded543359d96f8a1f092563e90（dist/index.html，本批未触碰 dist）
RELEASE_WEB=c0637da808fca54f2f19fcf98a54f6cf1a652e5c6e4f49e76c6fc7b6d91c6d9c（8.发布与CI/release/v2.1.0-2026-11-01/JU-v2.1-Web.html，零改动）
证据留档：
  parity-red.txt        —— check-release-parity.mjs 红态（Exit 1，两值并列）
  hash-registry.txt     —— RESULT=PASS / FIVE_PARTY_DRIFT_COUNT=0
  verify-all.txt        —— verify.js all 全绿（静态 0 命中 / Node 503 / PW 171 / bench 通过）
edge_profile* 匹配：无（90过程材料/tmp 下无该前缀项，跳过删除）
备注：负向证伪条件成立——dist 4698308 B / 归档 4698196 B，mtime 上 dist(14:56:49Z) 新于归档(14:40:08Z)，
      旧闸门（仅比 exe 与 dist 的 mtime）会放行，新闸门按 sha256 判定为不一致。
