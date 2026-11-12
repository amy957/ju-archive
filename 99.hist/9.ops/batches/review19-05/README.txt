批次：review19-05/9（ISSUE-005 探针未入发版 E2E）
时间：2026-11-07（UTC 15:14–15:40）
DIST_BEFORE：dist/index.html 4,716,598 B SHA-256 d5dc035a…f752442de7（与 review19-04 同字节）
DIST_AFTER：同一构建重跑 4,716,598 B SHA-256 d5dc035aca7ee32bc240fdce7a9f5ed4c2cafb1c03077a1c5a0138f752442de7
本目录文件：
- run-gate.ps1：调用真实 scripts/build-all.mjs，抓 CLOSED_HIGH_* 行后终止（证据工具）
- build-all-pos.log：正向闸门日志（CLOSED_HIGH_SPECS 19 项，无 MISSING/GONE）
- build-all-neg.log / build-all-neg-exit.log：负向日志（CLOSED_HIGH_MISSING，Exit 1）
- pw-review18-12.log：playwright 单 spec 通过日志（1 passed）
- hash-registry.log：PARTY_COUNT=66 · drift 0 · RESULT=PASS
edge_profile* 匹配：空，跳过删除
