批次：review14-05/09（ISSUE-005 归档说明标注未关闭 ISSUE）
时间：2026-11-05T16:26Z
DIST_BEFORE：6.P0-T3基线/m07-vite/dist/index.html 6BC55E86…EAD0D86F（本批零构建）
归档目录：8.发布与CI/release/v2.1.0-2026-11-05
变更：prepare-release.mjs 增 OPEN_ISSUES 常量 + Notes「未关闭 ISSUE」行 + manifest.openIssues
变更：check-manifest.mjs 增同口径断言（openIssues 非空且 Notes 含同文案）
文档重生成：JU_RELEASE_DOCS_ONLY=1，EXIT=0（docs-only.log）
产物字节：Web/exe/setup/checksums 四件前后哈希全等（before-hash.txt / after-hash.txt）
parity：FAIL（归档 Web fe48c6a7… ≠ dist 6bc55e86…；dist 已随 review14-01/02 重建，check-web-parity 同 Exit 1）
验收：check-manifest PASS entries=4 openIssues=6；Select-String '未关闭 ISSUE' HIT=1（grep.txt）
证伪：sandbox 删 Notes 该行 → check-manifest Exit 1 RESULT=FAIL（falsify.log）
门禁：登记器 66 方 / drift 0 / PASS；verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）
edge_profile*：0 项（跳过）
遗留：归档 Web 滞后于 dist，随发布批重打包
