批次：review18-06（ISSUE-006 时间证据失效 · 发布阻塞=条件）
时间：2026-11-07（UTC 11:09 / 本地 19:09）
DIST_BEFORE：4,716,422 B / BDB08905…B6685E（mtime 10:45:43Z）
DIST_AFTER ：同 DIST_BEFORE（本批未改 dist 字节，仅 mtime 被 verify.js all 重建推进）
变更件（1）：6.P0-T3基线/m07-vite/scripts/check-release-parity.mjs（+5 行）
断言：statSync(archExe).mtimeMs < statSync(archived).mtimeMs → EXE_STALE Exit 1（锚点=归档 Web）
归档目录：8.发布与CI/release/v2.1.0-2026-11-07（字节与 mtime 零改动）
命令：
  node 6.P0-T3基线/m07-vite/scripts/check-release-parity.mjs → Exit 0
  沙箱副本（归档 Web mtime = exe+1s，--ci-mode）→ Exit 1 EXE_STALE
  沙箱副本 + 断言 if 前置 false && → Exit 0（证伪成立）
证据：neg-stale.log · falsify.log · verify-all.log · hash-registry.log
edge_profile*：90过程材料/tmp 下 0 项，匹配为空已跳过（未删任何其他内容）
