批次：review23-04/7（ISSUE-004 IPC×allowlist 缺口 · 发布阻塞=否）
时间：2026-11-08
DIST_BEFORE：4,716,499 B / 258EC3910CADD7966645252BB06B71BE0A22D553CA8E8D7D45F4A4EC079EC017 / 2026-11-08T09:00:09Z
DIST_AFTER：4,715,113 B / 6D5A9E54FB98557D7FEF893D04007EA507F71357DCA811DF07F2A70E3350EBAD
变更：src/app/boot.ts（删 pick_directory 分支）；src/app/session.ts（fs 兜底显式停用，空实现）
验收：Select-String boot.ts pick_directory → 0；session.ts readBinaryFile → 0；定向 PW 3 passed；探针负向+证伪成立
门禁：PARTY_COUNT=66 / drift 0 / PASS；verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）
证据：source-scan-final.txt / dist-before.txt / dist-after.txt / dist-final.txt / build.txt / build-restore.txt / build-falsify.txt / targeted.txt / probe-fixed.txt / probe-falsify.txt / probe-final.txt / probe.mjs / hash-registry.txt / verify-all.txt
edge_profile*：90过程材料/tmp/ 下匹配 0 项，跳过删除（未删任何内容）
