批次：review17-06/13 · ISSUE-006 未跟踪 spec 纳入 waitForTimeout 上限
时间：2026-11-07 13:44 (UTC+8)
DIST_BEFORE：4,716,422 B / BDB089050B30B707BF0385BB9F778D816FB540371816B5F617A5A40DEAB6685E
变更文件：6.P0-T3基线/m07-vite/scripts/no-sleep-baseline.json（净零，SHA256 42B00183…E373 before=after）
源码：6.P0-T3基线/m07-vite/scripts/check-no-sleep.mjs 已是全量遍历版本，本批零源码 diff
证据：nosleep-before-refresh.log（FAIL 指名 v21-review9-06-rt-console.spec.ts:18，实际 199 / 基线 198）
      nosleep-write-baseline.log（baseline written: 39 files / 199 waitForTimeout）
      nosleep-after-refresh.log（no-sleep OK: 全量 78 个 spec，实际 199 处，基线 199 处）
      ../review17-06-nosleep-before.json（刷新前备份，SHA256 42B0018386E41B3988AE8185E9CE07C21EE0937A5799B32A615A702EF027E373）
负向：临时把基线 review9-06 置 2 → FAIL 1 处（3 vs 2 被报告），--write-baseline 后恢复 3
edge_profile*：90过程材料/tmp 匹配 0 项，按规则跳过，未删任何内容
