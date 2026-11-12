批次 review9-11 · ISSUE-011 同批后续文件继续处理
时间 2026-11-03
DIST_BEFORE=4,710,281 B / 2D07DC808E93C962A279E54FDE1CD6BF1A33633898F1BE3820F2E53B05A046E3
DIST_AFTER=4,710,350 B / D2C3DC157F3DABE8181E9E1C865B4FEC969573155842C5FFB6A99E488CD4A435
变更文件：6.P0-T3基线/m07-vite/src/io/import.ts
  JSON 恢复分支 return → continue，置 didFullRestore=true，末尾 toast 提示已恢复备份
  禁改项 initStore(normRestore) / applyUIFields / restoreVersions / .db 跳过保持原样
探针：probe-review9-11.spec.ts（临时置 tests/ 跑，跑后移入本目录，未入产物）
证据：review9-11-spec-green / spec-green-r2 / spec-falsify / hash-registry / verify-all（2.项目日志）
edge_profile* 匹配 0 项，已跳过
