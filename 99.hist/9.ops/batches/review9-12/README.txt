批次 review9-12 · ISSUE-012 恢复链 UI 分支名实一致
时间 2026-11-03
DIST_BEFORE=4,710,350 B / D2C3DC15…A435
DIST_AFTER=4,710,870 B / DC0940B4…6DCFF4
变更文件：6.P0-T3基线/m07-vite/src/io/import.ts、6.P0-T3基线/m07-vite/src/main.ts
  preimport 快照附 UI 偏好白名单字段（encKey/encrypted 不入快照）
  loadAutoBackup 返回 {state,ui}，boot.ts:1404 ab.ui 分支生效
探针：probe-review9-12.spec.ts（临时置 tests/ 跑，跑后移入本目录，未入产物）
证据：2.项目日志/review9-12-{spec-green,spec-green-r2,spec-green-r3,spec-falsify,tsc,hash-registry,verify-all,verify-all-r2}-2026-11-03.txt
edge_profile* 匹配 0 项，已跳过
