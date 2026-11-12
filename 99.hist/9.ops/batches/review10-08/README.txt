批次: review10-08 · ISSUE-008 核心链路去固定等待（发布阻塞=否）
时间: 2026-11-03T16:30Z（本地 2026-11-04 00:30 +08）
DIST_BEFORE: 4,712,158 B / EDC75BF5E8FD7A3C231EDE83CE8C68A54D68C099192C42E447E25E30A0B5B87C
DIST_AFTER: 同值（零漂移；本批仅改 tests/*.spec.ts）
变更: 3 spec / 4 处 waitForTimeout → waitForFunction（4000ms，未放大）
计数: 215 处/214 行 → 211 处/210 行（任务卡记 210，实测差 5，以实测登记）
证据: 2.项目日志/review10-08-{targeted,accept-r1..r3,falsify,falsify-r2,tsc,hash-registry,verify-all-r2,r3,w21-single}-2026-11-03.txt
归档范围: 仅本批 README 与回执；edge_profile* 匹配 0 项，已跳过
