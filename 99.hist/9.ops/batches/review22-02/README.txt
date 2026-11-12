批次：review22-02/07（ISSUE-002 · CI 侧 Rust 源与归档 exe 滞后可判红）
时间：2026-11-08T07:46Z
DIST_BEFORE：4,716,598 B / D5DC035A…42DE7 / 2026-11-08T07:35:00Z
DIST_AFTER ：同字节同哈希（本批零构建，未跑 vite build）
变更文件（2）：
  6.P0-T3基线/m07-vite/scripts/check-dist-parity.mjs（--ci-mode pathspec 增 src-tauri/src · Cargo.toml · build.rs）
  6.P0-T3基线/m07-vite/scripts/check-release-parity.mjs（degraded 分支增 EXE_AFTER_RELEASE 11 行）
实跑：
  check-dist-parity（dist 存在）+ check-dist-parity --ci-mode → EXIT 0 / 0
  check-release-parity（全量）+ --ci-mode → EXIT 0 / 0
  沙箱 git：Rust 提交 2026-11-09T01:00Z → SRC_AFTER_RELEASE EXIT 1；首提交态 EXIT 0
  证伪：pathspec 回退仅 'src' → 同场景 EXIT 0（缺陷态复现）
  沙箱归档：exe mtime 2026-11-09T05:00Z → EXE_AFTER_RELEASE EXIT 1；还原后 EXIT 0
门禁：verify-hash-registry PARTY_COUNT=66 / drift 0 / RESULT=PASS；verify.js all EXIT 0（静态 0 · Node 503 · PW 171 · bench 0.0%）
沙箱：90过程材料/tmp/review22-02/{repo,sandbox} 已删；归档字节与 mtime 未改动
edge_profile*：90过程材料/tmp 下匹配 0 项，已跳过，未删其他内容
