批次：review17-05（ISSUE-005 · 发布阻塞=是）
时间：2026-11-07（UTC 05:39–05:41）
DIST_BEFORE：4,716,422 B / BDB08905…6685E
DIST_AFTER：同（docs-only，未重建产物）
变更：docs/OPEN-ISSUES.md 17 行 → 22 行（补 ISSUE-002/003/005/008/011）；JU_RELEASE_DOCS_ONLY=1 重生成 v2.1.0-2026-11-07 的 RELEASE-NOTES.md 与 release-manifest.json
验收：
- check-manifest → RESULT=PASS entries=4 openIssues=22 Exit 0
- Select-String 'ISSUE-001' docs/OPEN-ISSUES.md → 1（HIT≥1）
- 证伪：删 ISSUE-001 行不重生成 → RESULT=FAIL openIssues 与 docs/OPEN-ISSUES.md 不一致 Exit 1（falsify.log），复原后 SHA256 3CAC0C7E…FDCC 与变更后一致
- verify-hash-registry → PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS
edge_profile*：匹配 0 项，已跳过，未删除任何内容
