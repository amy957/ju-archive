批次：review17-04（ISSUE-004 · 前置 parity 阻止 E2E 重建掩盖 stale dist）
时间：2026-11-07T13:30+08:00（UTC 05:30）
DIST_BEFORE：4,716,422 B / BDB089050B30B707BF0385BB9F778D816FB540371816B5F617A5A40DEAB6685E / mtime 2026-11-07T13:27:27+08:00
DIST_AFTER：同字节同哈希（vite build 复现，仅 mtime 前进至 13:27:48）
变更：m07-ci.yml / ci-gate.yml / check-dist-parity.mjs / check-web-parity.mjs
验收（实跑）：
  node 6.P0-T3基线/m07-vite/scripts/check-dist-parity.mjs --ci-mode    Exit 0
  node 6.P0-T3基线/m07-vite/scripts/check-web-parity.mjs --ci-mode     Exit 0（bdb08905…）
  node 6.P0-T3基线/m07-vite/scripts/check-release-parity.mjs --ci-mode Exit 0（归档自洽）
  GITHUB_ACTIONS=true 且无 dist → DEGRADED Exit 0（干净检出模拟）
  dist mtime 回拨 6 天 → Exit 1 "[dist-parity] ✗ dist 早于…"；vite build 后 Exit 0
  node 6.P0-T3基线/step9/verify-hash-registry.mjs → PARTY_COUNT=66 / drift 0 / PASS
  node 6.P0-T3基线/step9/scripts/verify.js all → Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）
文件：verify-all.log / parity-preflight.log / stale-negative.log
edge_profile*：0 项，匹配为空，跳过（未删除任何其他内容）
