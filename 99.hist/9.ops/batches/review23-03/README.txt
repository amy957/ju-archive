批次：review23-03/7（ISSUE-003 CI 同日盲区 · check-release-parity degraded 分支）
时间：2026-11-08T09:22Z（17:22 CST）
DIST_BEFORE：4,716,499 B / 258EC3910CADD7966645252BB06B71BE0A22D553CA8E8D7D45F4A4EC079EC017
DIST_AFTER：同上（零构建批次，未触碰 dist / 归档 / exe / setup / checksums）
变更文件：6.P0-T3基线/m07-vite/scripts/check-release-parity.mjs
验收命令：
  "99.开发辅助工具\node.exe" "6.P0-T3基线\m07-vite\scripts\check-release-parity.mjs" --ci-mode
  "99.开发辅助工具\node.exe" "6.P0-T3基线\step9\verify-hash-registry.mjs"
  "99.开发辅助工具\node.exe" "6.P0-T3基线\step9\scripts\verify.js" all
证据文件（本目录）：
  _probe.mjs（沙箱构建器：git init + 首提交 + 同日提交 + 去断言副本）
  dist-before.txt / release-parity-first-commit.txt / release-parity-exe-after-commit.txt
  release-parity-falsify-no-assert.txt / falsify-removed.txt / git-log.txt
  release-parity-real-git.txt / hash-registry.txt（同批控制台输出）/ verify-all.txt
沙箱：本目录 sandbox/（可整体删除，不参与门禁）
