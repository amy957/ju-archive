批次：review11-04/09（ISSUE-004 发布滞后在 CI 可见 · 决策 C）
时间：2026-11-04T07:00Z 起（Asia/Shanghai 15:00）
DIST_BEFORE：4,712,768 B / BBAB5C84EDBB5D6CD84BBC351963BED893F49ACE07FEC9FF7E4BBB5ABF8622AB
DIST_AFTER ：同值（本批零构建，无 build-all）

本批变更（3 文件 · 30 行）：
1. 6.P0-T3基线/m07-vite/scripts/check-manifest.mjs（新建 20 行；默认解析归档内最新非 .prev-* 目录）
2. .github/workflows/m07-ci.yml（audit-license 后加 Release manifest gate，+4 行）
3. .github/workflows/ci-gate.yml（verify:all 后加 Release manifest gate，+6 行）

零改动：check-release-parity.mjs 判据、两条 workflow 既有 step 顺序、verify.js all 段、canonical/step9 镜像、HEAD.json、8.发布与CI/release/**。
决策 C 记录：parity 需 src-tauri/target/release/*.exe，CI 无 tauri build 且 target/ 被 gitignore，
故 parity 不并入 CI，仍在 build-all 第 6b 步；CI 只跑不依赖构建产物的清单闸门。

证据文件：acceptance.txt / manifest-green.txt / manifest-falsify.txt / manifest-fallback.txt /
hash-registry.txt / verify-all.txt / verify-all-tail.txt / verify-all-bench.txt / edge-profile-list.txt
edge_profile*：匹配 0 项，按规则跳过（未删除任何内容）。
