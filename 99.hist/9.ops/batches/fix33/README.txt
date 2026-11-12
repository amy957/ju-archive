批次：fix33-1/X · ISSUE-001 桌面明文快照契约不匹配
时间：2026-10-31 20:16 (UTC+8)
DIST_BEFORE：未留存字节（重建前为 fix32 产物；vite build 输出 4,674.89 kB / main-B_8MxIt1.js）
DIST_AFTER：4,698,725 B / 159FC4D39B60E415374AA38FEDE42C77F65939FB411A671073B3569FD5AF6AC8
变更：src/main.ts 新增 normalizeDesktopSnapshot(raw)，两处 dsLoadState 改调该函数
变更：src/core/persist.ts 的 initPersist 桌面分支跳过首次落盘（避免装载前默认态覆盖 ju_store.json）
新增：tests/v21-fix33-desktop-load-contract.spec.ts（19 行）
门禁：tsc --noEmit Exit 0；登记器 PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS
门禁：verify.js all Exit 0（静态 0 命中 · Node 503 · Playwright 171 · bench 7/7 最大恶化 0.0%）
专用用例：红证 1 failed（sentinel false）→ 绿证 1 passed (2.7s)
edge_profile* 匹配：无（跳过，未删除其他内容）
