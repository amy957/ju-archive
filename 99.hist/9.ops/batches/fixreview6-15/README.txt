批次：fixreview6-15/19（ISSUE-015 新增用例硬等待收敛）
时间：2026-11-02
DIST_BEFORE：4,704,916 B / ED3B9201…A94353E6
DIST_AFTER：4,704,916 B / ED3B9201…A94353E6（仅改测试，不产 dist）
变更：6.P0-T3基线/m07-vite/tests/v21-fixr6-merge-equal-ts.spec.ts
口径：删除 waitForTimeout(1200)；启动静默改为轮询 localStorage._rev 连续两次采样相等且静默 ≥600ms（覆盖 300ms 防抖）；A 批次落盘改 expect.poll
证据：r6-15-run1.txt · r6-15-run2.txt · r6-15-run3.txt（各 1 passed）· r6-15-run4-restore.txt · neg-waitForTimeout-4w.log · hash-registry.log
edge_profile*：90过程材料/tmp 下匹配 0 项，已跳过
