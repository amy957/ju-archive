批次：release-final-2026-11-06
变更文件：6.P0-T3基线/m07-vite/docs/OPEN-ISSUES.md（仅保留 ISSUE-008）；归档 RELEASE-NOTES.md + release-manifest.json（docs-only 重生成）；8.发布与CI/release/v2.1.0-2026-11-06/ 全量产物
验收命令：node scripts/build-all.mjs（JU_RELEASE_OVERWRITE=1 / JU_BUNDLES=nsis）；node '6.P0-T3基线\step9\scripts\verify.js' all；node '6.P0-T3基线\step9\verify-hash-registry.mjs'；cargo test --manifest-path src-tauri/Cargo.toml
结果：build-all Exit 0（14/14）；verify all Exit 0；登记器 PASS / drift 0；cargo 13 passed；check-manifest PASS entries=4 openIssues=1；check-release-parity / check-dist-parity / check-web-parity 均 Exit 0
产物：Web 4,715,782 B / 8fb58d12…da024；exe 7,345,664 B / 48ddf6fa…e133d；setup 4,457,551 B / 9972592b…cf57b；checksums 258 B / ef114ffa…d8ad8a
发布准入：可发布（项目负责人决策；ISSUE-008 CSP 风险接受未签字，仍列未关闭项，不代签）
review15 闭环：001/002 原子写 + 强杀/明文残留用例；003 三角重建；004 dist-parity 转绿；005 明文不得残留断言；006/007 未关闭清单唯一真相源；009 回执补录；010 读端断言；011 parity 文案编号；012 风险注释；013 说明单口径
遗留：ISSUE-008 项目负责人签字；v2.1.0-2026-11-05 与 .prev-* 历史件保留未删
