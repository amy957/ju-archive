批次：review7-09（ISSUE-009 三角门禁可重复、可诊断）
时间：2026-11-02T13:39Z
DIST_BEFORE：6.P0-T3基线/m07-vite/dist/index.html
  SHA256=450743964b5738fe738060779d7882331e6c6c9b37e92973f49ce22802b4158a
DIST_AFTER：同值（仅 ren→dist.neg-probe→ren 往返，未写入任何字节）
ARCHIVE_BEFORE/AFTER：8.发布与CI/release/v2.1.0-2026-11-02 未动
门禁：verify-hash-registry.mjs → PARTY_COUNT=66 / drift=0 / RESULT=PASS；
      verify.js all → Exit 0（静态 0 命中、Node 503、PW 171、bench 全绿）
负向手段：目录改名制造缺件，改名与回滚写在同一命令内，避免残留半状态
产物：verify-all.txt、hash-registry.txt
