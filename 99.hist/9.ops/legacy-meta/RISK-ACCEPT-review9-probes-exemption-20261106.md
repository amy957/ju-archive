# RISK-ACCEPT · review9-08/11/12/13/14 五批探针豁免

- 编号：RISK-REVIEW9-PROBES-20261106
- 状态：已被 REQUIRED_PROBES 取代，补建前发布阻塞=是
- 发布阻塞：是（补建前）
- 签字人：项目负责人
- 签署日期：2026-11-06
- 记录人：Code 模式本批执行（代记，不代签）

## 范围

review9-08 / review9-11 / review9-12 / review9-13 / review9-14 五批探针（原未纳编 `tests/`）。

## 理由

已被后续重构覆盖：对应行为由 `tests/v21-review9-06-rt-console.spec.ts` 等现行 spec 与 check-deps-wired / check-dist-parity / check-release-parity 门禁承接，五批探针不再具备独立性。

## 复审条件

相应模块再次改写时，须重评是否恢复独立探针；`docs/OPEN-ISSUES.md` 不再登记该五项。
