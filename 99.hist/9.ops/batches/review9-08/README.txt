批次 review9-08 · ISSUE-008 旧备份归一化不再是恒等
时间 2026-11-03
DIST_BEFORE=4,708,966 B / 5F323F7244C0C9994697ED50C934EF46707FADCC3A06289FE52FC0C6EBA3D347
DIST_AFTER=4,710,281 B / 2D07DC808E93C962A279E54FDE1CD6BF1A33633898F1BE3820F2E53B05A046E3
变更文件：6.P0-T3基线/m07-vite/src/main.ts
  migrateStateObject(st) 实现：补 tagColors/dbFields/activity/_ver 缺省
  按 parent 重建 children：丢弃悬空 / 自引用 / 根引用 / 重复项，孤儿挂根，回收站子树保持脱离活树
  injectBootDeps 与 injectImportDeps 两处 (st)=>st 替换为真实实现
探针：probe-review9-08.spec.ts（临时置 tests/ 跑，跑后移入本目录，未入产物）
证据：review9-08-spec-green / spec-green-r2 / falsify / build / tsc / hash-registry / verify-all（2.项目日志）
edge_profile* 匹配 0 项，已跳过
