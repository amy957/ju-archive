批次：fix35-1（review3 ISSUE-008~012）
时间：2026-10-31（北京时间 23:2x）
DIST_BEFORE：4,698,308 B / efe6d72b…3e90
DIST_AFTER ：4,698,308 B / efe6d72b…3e90（未变）
变更：package.json:14 / src/app/updater.ts:102-106 / src-tauri/src/main.rs:6,12
      .github/workflows/m07-ci.yml:8-9,21-22,73-75 / src/core/errors.ts:54 / scripts/check-parity.mjs:40-
门禁：parity PASS（main 2.1.0 / errors '' / pkg 2.1.0）；登记器 66 方 / drift 0 / PASS
      verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）
      tsc Exit 0；node --test test/*.mjs src/test/*.mjs 20/20
edge_profile 清理：90过程材料/tmp/ 下匹配为空，跳过
