批次：review25-05/7（check-release-parity 首错即退 → 收集式报告）
时间：2026-11-08T13:31Z
变更：6.P0-T3基线/m07-vite/scripts/check-release-parity.mjs（errors[] 收集 + 末尾统一 Exit 1；git ENOENT 输出「未判定」）
DIST_BEFORE：4,715,286 B / 96C00A56…5263（LF；只读，零构建）
DIST_AFTER：4,715,286 B / 96C00A56…5263
沙箱：90过程材料/tmp/review25-05/sandbox（过程材料，测毕留存）
验收：
  非 ci 红场景 → WEB_MISMATCH + EXE_STALE / EXIT=1（neg-both.txt）
  --ci-mode 红场景 → EXE_STALE / EXIT=1 + git 未判定（neg-ci-mode.txt）
  证伪（恢复首错即退）→ 仅 WEB_MISMATCH，无 EXE_STALE（falsify-first-exit.txt）
  正常包 → EXIT=0（green-normal.txt）
  verify-hash-registry RESULT=PASS / drift 0（hash-registry.txt）
  verify.js all Exit 0（verify-all.txt）
edge_profile*：90过程材料/tmp/ 下匹配 0 项，已跳过
