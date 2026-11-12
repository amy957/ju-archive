批次：review21-02/5（ISSUE-003 装配门禁证明持久化端口被真实消费）
时间：2026-11-08
DIST_BEFORE：4,716,598 B / D5DC035A…42DE7
DIST_AFTER：4,716,598 B / D5DC035A…42DE7（同值，未重建）
变更文件（1）：6.P0-T3基线/m07-vite/scripts/check-deps-wired.mjs
  +31 行：fnBody() 函数体提取；persist.ts 明文/密文分支 dsLoadState 读端；boot.ts flushPendingSession 读端
未改文件：src/core/persist.ts、src/app/boot.ts（mtime 仍为 2026-11-07）、src/main.ts 装配键、HEAD.json
证据日志：
  gate-green.log 正向 PASS（81 键 / 失败 0，含新增读端行）
  gate-neg.log 负向 persist.ts 明文分支改 const _ds: any = null; → FAIL dsLoadState 读端不可达 / EXIT 1
  gate-neg2.log 负向 boot.ts 删 deps.flushPendingSession(); → FAIL flushPendingSession 读端不可达 / EXIT 1
  gate-green-restore.log 复原后复绿（真实 src 未改动）
  hash-registry.log PARTY_COUNT=66 / drift 0 / RESULT=PASS
  verify-all.log Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）
edge_profile*：90过程材料/tmp 下匹配 0 项，跳过删除，未删其他内容
