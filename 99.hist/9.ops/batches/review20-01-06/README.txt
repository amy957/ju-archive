批次 review20-01-06/6  ISSUE-002 发布门禁不得跳过无 manifest 的最新归档
时间 2026-11-07T16:15Z ~ 2026-11-07T16:23Z (UTC)
DIST_BEFORE dist/index.html sha256=d5dc035aca7ee32bc240fdce7a9f5ed4c2cafb1c03077a1c5a0138f752442de7（本批未触碰 dist）
DIST_AFTER  同上（未重建，未改归档字节）
证据文件
neg-manifest.txt        沙箱 8.发布与CI/release/v2.1.0-2999-01-01 空目录 → LATEST_ARCHIVE_NO_MANIFEST / Exit 1
neg-web-parity.txt      同时序 → LATEST_ARCHIVE_NO_MANIFEST / Exit 1
neg-release-parity.txt  同时序 → LATEST_ARCHIVE_NO_MANIFEST / Exit 1
falsify.txt             resolver 临时回退 .filter(manifest) → 同沙箱 Exit 0（缺陷态复现）
clean-after-removal.txt 删除沙箱 → Exit 0  dir=v2.1.0-2026-11-07
hash-registry.txt       RESULT=PASS  FIVE_PARTY_DRIFT_COUNT=0
release-paths.mjs.bak   falsify 前字节备份；还原后与产品文件同 sha256 b806d5219b7f04befa0f7b84b77ad4b46d3f7420f60292812525c4e222cb2122
全量门禁                verify.js all → Exit 0；日志 2.项目日志/review20-01-02-6-verify-all-2026-11-07.txt
