批次：review10-01/11 · ISSUE-001 加密态 preimport 恢复链
时间：2026-11-03T14:12Z
DIST_BEFORE=4711371 17A92ACB…D07BFB6
DIST_AFTER=4711862 CAE6BCAA…EB55FB18
变更：src/main.ts（同步 loadAutoBackup 仅服务明文；新增 loadAutoBackupAsync 解锁后异步解密；删除 _preimportDec 缓存）
      src/app/boot.ts（解锁成功后 await 异步结果走 migrateStateObject；主库不可读分支 await）
      tests/v21-review10-enc-preimport.spec.ts 新增
证据：green.log / green-r2.log / green-r3.log / falsify.log / hash-registry.log
      verify-all.log（首跑 L16-W13 §H H1 P95 抖动红）/ verify-all-r2.log（全绿）
edge_profile* 匹配 0 项：已跳过，未删除任何其他内容。
