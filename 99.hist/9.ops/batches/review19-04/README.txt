批次：review19-04/9 · ISSUE-004 旧 exe 可绕过（发布阻塞=条件）
时间：2026-11-07 23:13（本地 UTC+8）
DIST_BEFORE：4,716,598 B · D5DC035A…752442DE7
DIST_AFTER ：同 DIST_BEFORE（本批未重建；verify.js all 重建后字节/哈希一致）
SRC 锚点：src/core/errors.ts 15,046 B · 2026-11-07T12:05:13.9906231Z（负向 touch 后已还原 mtime）
EXE 锚点：src-tauri/target/release/ju.exe 7,355,904 B · 2026-11-07T14:27:19Z
变更件（1）：6.P0-T3基线/m07-vite/scripts/check-release-parity.mjs（+21/−2）
断言：递归取 src/** 最新 mtime，statSync(builtExe).mtimeMs < srcLatest → EXE_AFTER_SRC Exit 1
      degraded（--ci-mode / 无构建产物）不判定；EXE_STALE / SETUP 判据保持不变
命令：
  node 6.P0-T3基线/m07-vite/scripts/check-release-parity.mjs → Exit 0（✓ exe ≥ src 最新变更）
  负向 touch src/core/errors.ts（15:10:39Z）→ Exit 1 EXE_AFTER_SRC；还原后 Exit 0
  证伪 if (false && srcLatest && …) + 同 touch → Exit 0；恢复后 Exit 1
edge_profile*：90过程材料/tmp 下 0 项，匹配为空已跳过，未删除其他内容
