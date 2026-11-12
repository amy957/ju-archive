批次: fixr6-9 (ISSUE-009 m07 CI 无 vite build)
时间: 2026-11-01 22:24 (+08:00)
DIST_BEFORE: 存在；源目录 6.P0-T3基线/m07-vite/dist/index.html 未改动
副本: 90过程材料/tmp/fixr6-9/m07-lean，robocopy /E 排除 node_modules dist test-results src-tauri
依赖: mklink /J 将副本 node_modules 指向源目录，构建与测试只作用于副本 dist
证据:
1) build.log：副本无 dist → vite build → dist/index.html 4,681.84 kB
2) pw1.log：构建后跑 v21-fix30-topbar-popover.spec.ts → 1 passed
3) pw2.log：删 dist 且不构建 → 1 failed，Error: dist/index.html 缺失，请先 vite build
4) hash-registry.log：RESULT=PASS，FIVE_PARTY_DRIFT_COUNT=0
清理: 90过程材料/tmp/ 下 edge_profile* 匹配为空，跳过；副本 m07-lean 树验后删除，仅留日志
