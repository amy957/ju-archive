批次：review19-08/9 · ISSUE-008 manifest 旧快照重生成
时间：2026-11-07 23:56 (+08:00)
DIST_BEFORE：4,716,598 B / D5DC035A…42DE7（= 归档 Web）
DIST_AFTER：同 before（未重建；verify.js all 后仍同哈希）
变更：6.P0-T3基线/m07-vite/scripts/prepare-release.mjs（writeReleaseDocs 先算 artifacts 再写 Notes；Notes 增 Web/exe/setup 三行真实字节+哈希；parity 以 "parity":"PASS" 紧凑写法落盘）
重生成：JU_RELEASE_DOCS_ONLY=1 JU_BUILD_DATE=2026-11-07（未复制产物、未动 checksums）
产物哈希：Web 4,716,598 / d5dc035a… · exe 7,355,904 / 84b39cb6… · setup 4,467,984 / 360523b8… · checksums 258 / b0680772…（before=after）
验收：check-manifest RESULT=PASS entries=4 openIssues=22；check-release-parity / check-web-parity Exit 0
证伪：沙箱 v2.1.0-2026-11-99（Web 改 1 字节）→ parity Exit 1 + manifest 仍 PASS → admission-check BLOCK(manifest-parity-stale) Exit 1；沙箱已删
门禁：verify-hash-registry PARTY_COUNT=66 / drift 0 / PASS；verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 最大恶化 0.0%）
边缘：90过程材料/tmp/ 下 edge_profile* 匹配 0 项，已跳过并记录
