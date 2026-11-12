批次 review9-05 · ISSUE-005 锁定态不产生空备份
时间 2026-11-03
DIST_BEFORE=4,708,763 B / E1C2F36BCC7E7BC365515243C9963597650310EE48BFC8DC6E49198185F0B3C4
DIST_AFTER=4,708,861 B / 8E4FDEDB078B702886034F5E182D3737066D1F52C63C48B72587DB7FF8DB4D76
变更文件：6.P0-T3基线/m07-vite/src/app/session.ts
  _saveBackupOnClose 锁定早退（toast 已锁定，未写入关闭备份）
  _closeBackupPayload 入口 if (ui.locked) return null 双保险
探针：probe-review9-05.spec.ts（临时置 tests/ 跑，跑后移入本目录，未入产物）
证据：red.log（2 通过 1 失败）/ green.log（3 通过）/ green-r2.log / falsify.log / tsc.log / build.log / build-falsify.log / hash-registry.log / verify-all.log
edge_profile* 匹配 0 项，已跳过
