批次：review18-05（ISSUE-005 · CI stale dist 空转 · 发布阻塞=条件，CI 首次验证前）
时间：2026-11-07T11:06Z
DIST_BEFORE：4,716,422 B / BDB08905...B6685E
DIST_AFTER ：同字节同哈希（本批零构建，未跑 vite build）
变更：6.P0-T3基线/m07-vite/scripts/check-dist-parity.mjs
      --ci-mode 且无 dist 时改以 git log -1 --format=%ct -- src 取 src 最新提交时间，与 BUILD_DATE 日末比较
验收（实跑，临时 clone + PortableGit 2.56.0）：
  1) HEAD 态：check-dist-parity.mjs --ci-mode → ✓ src 2026-10-26 不晚于发布日 2026-11-07，Exit 0
  2) 提交 src 变更（committer 2026-11-08T01:00:00Z）→ ✗ SRC_AFTER_RELEASE，Exit 1
  3) git reset --hard HEAD~1 还原 → Exit 0
  4) 证伪（删断言版，同 clone 同提交）→ DEGRADED，Exit 0
  5) git 不可用（PATH 无 git）→ 打印「git 不可用…降级 DEGRADED」+ Exit 0
门禁：verify-hash-registry PARTY_COUNT=66 / drift 0 / RESULT=PASS
      verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）
      check-dist-parity（dist 存在路径）Exit 0：✓ dist 不早于 src / public / 根配置 / tauri.conf.json
edge_profile*：90过程材料/tmp 下 0 项，匹配为空已跳过（未删任何其他内容）
遗留：m07-vite/scripts 下 check-dist-parity / check-web-parity / check-release-parity / check-manifest /
      check-no-sleep / release-paths / gen-receipt / no-sleep-baseline.json 均为未跟踪（??），干净检出缺件
