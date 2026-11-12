review11-05 证据目录
批次: review11-05/09 · ISSUE-005（P95 判定不可复现 · Exit≠0 落点）
时间: 2026-11-04（UTC+8）
DIST_BEFORE: 4,712,768 B / BBAB5C84（m07-vite/dist/index.html）
DIST_AFTER : 4,712,768 B / BBAB5C84（本批零构建）

日志清单
bench-run1..5.txt        改前 verify.js bench 五次（无 PATH 前置：5/5 Exit 1 spawnSync node ENOENT）
bench-after-run1..5.txt  改后 verify.js bench 五次（5/5 Exit 0，归一化判据哈希 95C0542EE631 一致）
w21-real-run1..3.txt     改前 t16-w21 §E 三次（2 绿 1 红）
probe-run1..3.txt        改前 P50 探针三次（P95/P50 = 1.08–1.25）
w13-fixed-run1..5.txt    中间态 t16-w13（P50×1.6）五次（3 绿 2 红，比值 1.24–2.01）
pair-run1..5.txt         定稿 w21(×2.0)+w13(×2.5) 同轮五次（5/5 Exit 0）
w21-falsify*.txt         旧断言证伪（BUDGET 20000 → 恒绿；BUDGET 0.05 → 红）
f3-run-*.txt / f3b-run-*.txt  新断言证伪（相对放宽 → 恒绿；相对收紧 → 红）
hash-registry-r2.txt     PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS
verify-all-r2.txt / verify-all-r3.txt   全量门禁两次 Exit 0（静态 0 · Node 503 · PW 171 · bench 通过）

edge_profile*: 匹配 0 项，跳过（未删任何内容）
