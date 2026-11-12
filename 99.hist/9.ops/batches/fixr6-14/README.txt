批次：fixr6-14/19 · ISSUE-014 backupOnClose 死装配
时间：2026-11-01 23:52 (+08:00)
DIST_BEFORE：4,705,615 B / B569B0E9…5BE818
DIST_AFTER ：4,705,111 B / A0A1C9AC…E60DC6
变更文件：src/main.ts（删函数 + bindLayoutDeps/injectBootDeps 两处注入）
          src/ui/layout.ts（删 deps 类型键与默认值）
验收命令：
  node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit        → Exit 0
  node scripts/check-deps-wired.mjs                                    → PASS 71 键 / 10 容器
  node 90过程材料/tmp/fixr6-14/layout-deps-assert.mjs                   → PASS（红证 FAIL 退出码 1）
门禁：verify-hash-registry PARTY_COUNT=66 / DRIFT=0 / PASS
      verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）
证据：assert-green.log · assert-red.log · check-deps-wired.log · hash-registry.log · verify-all.log
edge_profile*：90过程材料/tmp 下匹配 0 项，跳过删除，未删其他内容。
