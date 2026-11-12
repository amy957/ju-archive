fix37-1 批次工作目录（2026-11-01）
批次：fix37-1 — 大纲多行选区应用富文本格式后再次点击无法整体取消
时间：2026-11-01T04:17Z（UTC+8 12:17 起）
DIST_BEFORE：4,698,331 B / 431F2FFEC8AA…D8F7
DIST_AFTER ：4,699,044 B / B57259AC348949…8BE86
变更：
  6.P0-T3基线/m07-vite/src/ui/rightbar.ts   跨行 toggle 方向判定 xselFmtOn + toggleFmt 分支改写
  6.P0-T3基线/m07-vite/src/core/richtext.ts 中性值拆同类语义标签（_unwrapSemanticTagsInRange）
  6.P0-T3基线/m07-vite/tests/v21-fix37-1-multiline-toggle.spec.ts 新建
证据：pw-red.log 1 failed（Expected 0 / Received 3）
      pw-green.log 1 passed (5.0s)
      build-all.log / verify-all.log / hash-registry.log
prev-release-v2.1.0-2026-11-01：旧发布件整体迁入（决策A · fix34-1 同名覆盖口径）
