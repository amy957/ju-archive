批次：review11-09/09（ISSUE-009 发布说明失真）
时间：2026-11-04T08:29Z
DIST_BEFORE：4,713,030 B / 5AF650EC888FE0577579CFF5970BA2754FB6E7640AFE1CAE4BDCB2C1EE52CE72（本批零构建，前后同哈希）
HEAD.json：未变 / 9D13101A4AFCE87F12D4113AEB1E29FE6ACCD5E2E169C95495A228C5BE00EDDB
变更文件：
  6.P0-T3基线/m07-vite/scripts/prepare-release.mjs（97B8A60C…6EEFB3F0）
  8.发布与CI/release/v2.1.0-2026-11-03/RELEASE-NOTES.md（生成端重生成，第 5 行改「已知问题」）
  8.发布与CI/release/v2.1.0-2026-11-03/release-manifest.json（生成端重生成，增 parity）
证据：
  parity-before.txt / parity-after.txt / parity-final.txt（Exit 1，a≠b）
  falsify-state.txt / falsify-parity.txt / falsify-docs.txt（固定 PASS → 清单 PASS 与三角红矛盾）
  docs-only.txt / docs-only-final.txt / final-state.txt
  check-manifest.txt / hash-registry.txt / verify-all.txt / gates.txt
edge_profile*：0 项，跳过（未删除任何其他项）
