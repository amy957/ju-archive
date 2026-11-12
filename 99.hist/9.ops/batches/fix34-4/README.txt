fix34-4 · ISSUE-004 崩溃链路谎报成功
批次：fix34-4/X
时间：2026-10-31（UTC+8）
DIST_BEFORE：4,698,196 B / C0637DA8…6D9C
DIST_AFTER：4,698,308 B / EFE6D72B…3E90（verify.js all 的 prepareDist 重建）
变更：src/core/errors.ts 回退端口加 deps.isDesktop() 闸门；tests/update-crash.spec.ts 新增负向用例
证据：2.项目日志/fix34-4-pw-green-2026-10-31.txt、fix34-4-pw-green-r2-2026-10-31.txt、
      fix34-4-pw-negative-2026-10-31.txt、fix34-4-hash-registry-2026-10-31.txt、
      fix34-4-verify-all-2026-10-31.txt
edge_profile 清理：90过程材料/tmp/ 下无 edge_profile* 匹配项，跳过删除并记录
