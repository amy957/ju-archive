# 验收结论（唯一入口）

> 生成：2026-11-11T19:55:08+08:00 · 本文件是「当前验收结论」的唯一权威口径；历史验收记录只作证据，不得另立结论。

## 当前状态：RELEASE-HOLD（v2.1.0 为候选，非「已发布」）

**判定：交付资格尚未建立，发布状态维持 HOLD。**

| 项 | 结论 |
|---|---|
| r4 基线验收（`99.hist/7.test/legacy-acceptance/ACCEPTANCE-REPORT.md`） | **NOT ACCEPTED / INVALID / DO-NOT-SHIP**，且该裁决**未被撤销** |
| superseding 复验记录（唯一解禁条件） | **从未出具**（全库检索仅命中回归矩阵 ISSUE-002 OPEN） |
| `v2.1.0` release-manifest | `parity` 经 review28 修复后转 `PASS`（check-release-parity / web / dist / manifest / hash-registry 全绿）；原 `BLOCK:ISSUE-114` 为历史阻塞，已由真实重打包收口 |
| 13 项桌面端实机验证（ISSUE-101~113） | 全部欠账（书面接受，实机待发版后观察） |

## 解禁路径（二选一，须落具名文件）

1. **SUPERSEDING-ACCEPTED**：对 v2.1 产物实跑 `node scripts/verify.js all`，出具含 Node 471/471、Playwright 计数、bench 7/7 的完整原始输出与日志路径（本批次实跑，不得历史复用）。
2. **RELEASE-HOLD 维持**：撤下「已发布」措辞，产品状态标「候选」，直至上述复验完成。

## 证据位置（单一来源）

- 现行回归账：`1.docs/acceptance-matrix.md`
- 现行不变量：`1.docs/invariants.md`
- r4 验收否决原文：`99.hist/7.test/legacy-acceptance/ACCEPTANCE-REPORT.md`
- 未关闭问题清单：`3.code/docs/OPEN-ISSUES.md`
- 现行基线：`1.docs/version.json`（canonical 1,316,707 B / 5FED0215…BFF818）
