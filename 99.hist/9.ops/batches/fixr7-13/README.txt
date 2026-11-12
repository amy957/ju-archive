批次: review7-13/20 · ISSUE-013 关闭备份失败不静默
时间: 2026-11-02 22:46 (Asia/Shanghai)
DIST_BEFORE: 4,705,509 B / 45074396…B4158A
DIST_AFTER: 4,705,973 B / 5F8E9A94…B070E7
变更: 6.P0-T3基线/m07-vite/src/app/session.ts (+9/-1)
处置: _saveBackupOnClose 的 invoke('save_backup') 外包 try/catch；失败 console.warn + reportError('close-backup') + toast
边界: 关闭顺序 / 10s 熔断 / 备份载荷 / Rust save_backup 零改动
验收: tsc --noEmit；vite build；probe-backup-fail.mjs；verify-hash-registry.mjs；verify.js all
edge_profile*: 90过程材料/tmp 匹配 0 项，跳过，未删除其他内容
