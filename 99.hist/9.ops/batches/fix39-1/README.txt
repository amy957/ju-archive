fix39-1 批次材料
批次：fix39-1/2（下划线与删除线 text-decoration-line 词元叠加）
时间：2026-11-01（UTC+8）
DIST_BEFORE：4,700,754 B / 380FA893…2690（fix38 发布包 Web 副本）
DIST_AFTER ：4,703,090 B / 0FC69728FFC76F2D34E75C9640D515571A45EBCA9B67046C763C69A22F79BC04
变更文件：
- 6.P0-T3基线/m07-vite/src/core/richtext.ts
- 6.P0-T3基线/m07-vite/src/ui/rightbar.ts
- 6.P0-T3基线/m07-vite/tests/v21-fix39-1-decoration-stack.spec.ts（新建）
证据：
- hash-registry.log       登记器 PARTY_COUNT=66 / drift 0 / RESULT=PASS
- verify-all.log          verify.js all 全绿（Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）
- build-all.log           build-all 6/6（E2E 6 passed）· dist 4,703,090 B
- release-parity.log      归档 Web == dist（0FC69728…BC04）
- pw-red.log / pw-green.log  fix38 发布包 1 failed（Received 0）→ 修复后 1 passed
- prev-release-v2.1.0-2026-11-01/  旧发布包 3 件
edge_profile 清理：90过程材料/tmp 下 edge_profile* 匹配 0 项，跳过（未删任何其他内容）。
