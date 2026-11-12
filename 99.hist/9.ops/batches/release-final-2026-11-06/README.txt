批次：release-final-2026-11-06（review15 全量闭环后的正式发版）
时间：2026-11-06T10:38Z（build-all 完成）
DIST_BEFORE：4715662 B 469EBAF430CFDD4293836886BF2B1D17F5BF3500F244E634C23E9E36BE34CAC2
DIST_AFTER ：4715782 B 8FB58D1267DD6B175526F4D20E782C471024F4A0EEBE0CEA1FD3EA7C16CDA024
命令：JU_RELEASE_OVERWRITE=1 JU_BUNDLES=nsis node scripts/build-all.mjs → Exit 0（14/14 · E2E 44 passed · 6b 三角 PASS）
归档：8.发布与CI/release/v2.1.0-2026-11-06/（Web / exe / setup / checksums / RELEASE-NOTES / release-manifest）
文档重生成：JU_RELEASE_DOCS_ONLY=1 JU_BUILD_DATE=2026-11-06 prepare-release → openIssues=1（仅 ISSUE-008）
门禁：verify.js all Exit 0（静态 0 · Node 503 · PW 167+4=171 · bench 7/7 · 最大恶化 0.0%）
门禁：verify-hash-registry RESULT=PASS / drift 0 / PARTY_COUNT=66
门禁：cargo test 13 passed / 0 failed
证据：2.项目日志/build-all-release-2026-11-06.log · release-2026-11-06-{verify-all,verify-all-r2,hash-registry,hash-registry-r2,cargo-test,docs-only,check-manifest,final-state}.log
edge_profile*：匹配项见回执清理记录
