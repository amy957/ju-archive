fixr6-12 / ISSUE-012  `.prev-*` 归档累积无清理
批次：fixr6-12/19（单文件：6.P0-T3基线/m07-vite/scripts/prepare-release.mjs）
时间：2026-11-01T15:23Z（本地 23:23）
DIST_BEFORE：4,705,615 B  B569B0E9B1EA37FB75DEFF092487BAB416293CF1B4E00ACC0599B8730C5BE818
DIST_AFTER ：同上（本批只改 scripts，verify.js all 后复测同哈希，未重建 dist）
归档前状态：8.发布与CI/release 下 .prev-* 共 9 个（含 1 个带 JU_2.1.0_x64-setup.exe 的 4 件目录，合计 28 文件）
归档后状态：release 下 .prev-* 共 1 个（v2.1.0-2026-11-01.prev-1793545962203，3 件，原地未动）
移动去向：90过程材料/tmp/fixr6-12/prev-release-1793546582565/（8 个目录 / 25 个文件，只移不删）
本目录文件：
  prev-list-before.txt      归档前 .prev-* 目录名清单（9 行）
  prev-hash-before.txt      移动前逐文件 字节+SHA-256（28 行）
  prev-hash-after.txt       移动后逐文件 字节+SHA-256（25 行）
  prev-hash-compare.txt     比对结论（BEFORE_MINUS_KEPT 与 AFTER 全等，DIFF=0）
  prune-run.log             绿：移出 8 件 + 命中 ISSUE-010 拒绝分支（未重建归档）
  falsify-keep-all.log      红：keep=prevs 时零移动（计数保持 9）
  hash-registry.log         登记器 PASS / PARTY_COUNT=66 / DRIFT=0
  verify-all.log / verify-all-tail.txt  verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）
  README.txt / fixr6-12_回执_20261101.md
说明：prev-release-1793546376798 / prev-release-1793546447470 为校验过程产生的空目录（0 文件，未删除）。
