批次：review17-fix（发布准入回退不可发布 + boot.ts 复核失败不回滚 + no-sleep 全量 + CI 前置 parity + write_store 并发）
时间：2026-11-06T15:18Z
DIST_BEFORE：4,715,782 B / 8FB58D12…DA024
DIST_AFTER ：4,715,625 B / CE323E8F…979731
变更文件：boot.ts · main.rs · check-no-sleep.mjs · no-sleep-baseline.json · m07-ci.yml · ci-gate.yml · docs/OPEN-ISSUES.md · CURRENT_TASK.md
重打包：JU_RELEASE_OVERWRITE=1 JU_BUNDLES=nsis JU_BUILD_DATE=2026-11-06 build-all → Exit 0（14/14 · E2E 44 passed）
归档：8.发布与CI/release/v2.1.0-2026-11-06  Web CE323E8F…979731 / exe 1A2D6E56…5C49CB / setup 4,457,310 B / 19A047CD…1127E / checksums 258 B / FCAC4439…E97A
让位：v2.1.0-2026-11-06.prev-1793978131404；旧让位件 1 件移出 90过程材料/tmp/fixr6-12/
证伪：check-no-sleep 刷新前 FAIL 指名 v21-review9-06-rt-console.spec.ts:18（实际 199 / 基线 198）
edge_profile*：90过程材料/tmp 匹配 0 项，按规则跳过，未删任何内容
