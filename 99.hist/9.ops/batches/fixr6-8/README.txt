批次：fixr6-8/19 · ISSUE-008 写盘前合并门槛与加密分支缺合并
时间：2026-11-01（UTC+8）
范围：6.P0-T3基线/m07-vite（src/core/persist.ts · tests/v21-fixr6-merge-equal-ts.spec.ts）
DIST_BEFORE：4,705,342 B / EBDC1DFF…862CC（fixr6-6 登记值）
DIST_AFTER：4,705,615 B / B569B0E9B1EA…5BE818
变更摘要：
  1) 门槛由「磁盘 updatedAt > 内存 updatedAt」改为「磁盘快照存在即合并」；
  2) 加密态补「读磁盘密文 → decryptState → mergeRemoteIfNewer」，在 encryptState 之前完成，解密失败保持直接覆盖且不删密文。
证据：
  pw-red.log（负向：Expected 20 / Received 10）
  pw-green.log（正向：1 passed）
  hash-registry.log（PARTY_COUNT=66 / drift=0 / RESULT=PASS）
  verify-all.log（静态 0 · Node 503 · PW 171 · bench 7/7 · EXIT=0）
edge_profile*：90过程材料/tmp 下匹配 0 项，已跳过（无删除）。
