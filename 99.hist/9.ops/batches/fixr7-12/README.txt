review7-12 / ISSUE-012 关页 activity 日志可 flush
批次：review7-12（2026-11-02 22:38 +08）
DIST_BEFORE：4,705,509 B / 450743964B5738FE738060779D7882331E6C6C9B37E92973F49CE22802B4158A
DIST_AFTER ：同值（本批产品代码净改动 0；负向构建后用 release/v2.1.0-2026-11-02/JU-v2.1-Web.html 复原同一字节）
变更文件：
  1. 6.P0-T3基线/m07-vite/scripts/check-deps-wired.mjs —— injectBootDeps 关键键补 getLogTimers
  2. 6.P0-T3基线/m07-vite/tests/v21-fixr6-close-persist.spec.ts —— 新增 review7-12 用例
验收：check-deps-wired Exit 0（75 键 / injectBootDeps 12 键）；PW close-persist 3 passed
负向：删 main.ts 的 getLogTimers 注入后重建 dist → 1 failed（Expected 1 / Received 0）
门禁：hash-registry RESULT=PASS / drift 0；verify.js all Exit 0（Node 503 / PW 171 / bench 7/7）
