# 现行回归矩阵（CURRENT-REGRESSION-MATRIX）

> 建立日期：2026-10-18（ISSUE-022）
> 适用基线：**r4** = `v2.0-t13-frozen-t22-r4-2026-10-18` · 1,174,919 B / `0B4AA2A6…5A3C` / LF
> 唯一真相源：[`1.冻结版本/HEAD.json`](../1.冻结版本/HEAD.json:1)
> 用途：把 L8–T22 各波修复项映射到**可复跑的测试文件**，使“已修复”可由门禁追踪，而不是仅由波报告自证。
> 本文件取代 `JU-58项修复回归清单-v2.0-frozen.md` / `JU-P0-T3修复回归清单-v2.0-frozen.md` 作为**现行**追踪入口；
> 上述两份 v2.0-frozen / v2.1-dev 清单**仅作历史归档**，不再更新。

---

## 一、门禁口径（现行）

| 段 | 命令 | 通过判据 |
|---|---|---|
| 登记器 | `node 6.P0-T3基线\step9\verify-hash-registry.mjs` | `PARTY_COUNT=49` / drift 0 / `PASS` |
| 全量回归 | `node scripts\verify.js all`（cwd = `6.P0-T3基线\step9`） | 静态 0 + **Node 471** + **PW 171** + bench 7/7 |
| 冻结门 | `scripts\_w5freeze.ps1 -Wave l15 -NoFreeze` | `BYTE_IDENTICAL=True` / drift 0 |

> **Node 471** 为现行实际用例数；历史文档中的 **Node 145** 为 L15–L22 早期口径，已作废。

---

## 二、缺陷 → 测试映射（核心缺陷）

| 编号 | 缺陷 | 修复波 | 回归测试文件（`6.P0-T3基线/step9/t9/`） | 纳编状态 |
|---|---|---|---|---|
| Defect-A | 根节点可被删除 / `root.children` 空引用 | T16-W10 | `t16-w10-defecta-root-guard.test.mjs` | 已纳编 471 |
| Defect-B | `applyPatch` 产生 children 空洞 | T16-W12 | `t16-w12-patch-children-holes.test.mjs` | 已纳编 471 |
| Defect-C | 秒 / 毫秒 / 微秒混用导致 LWW 误判 | T16-W21 | `t16-w21-merge-ts-unit.test.mjs` | 已纳编 471 |
| Defect-D | `sanitizeHtml` 回填文本未转义 / 非幂等 | T16-W16 | `t16-w16-sanitize-idempotent.test.mjs` | 已纳编 471 |
| Defect-E | 主库损坏直接回退默认态 | T16-W17 | `t16-w17-boot-backup-fallback.test.mjs` | 已纳编 471 |
| Defect-F | 多标签删除传播被“未落盘”误跳过 | T16-W13 | `t16-w13-remote-received-delete-propagation.test.mjs` | 已纳编 471 |
| Defect-G | 持久化链异步化 / 缓慢落盘 | T16-W14 | `t16-w14-persist-chain-async.test.mjs` | 已纳编 471 |
| Defect-H | 错误上报含裸手机号 / 邮箱 / IP | T16-W18 | `t16-w18-pii-redaction.test.mjs` | 已纳编 471 |
| Defect-I | 加密态 `stack` / `ctx` 泄露 | T16-W19 | `t16-w19-enc-stack-placeholder.test.mjs` | 已纳编 471 |
| Defect-J | 墓碑队列无界增长 | T16-W11 | `t16-w11-tombstone-queue-compaction.test.mjs` | 已纳编 471 |
| Defect-K | 异常路径继承旧侧栏计数 | T16-W15 | `t16-w15-sidecounts-fallback.test.mjs` | 已纳编 471 |
| Defect-L | 非日历索引失败也推进 `_calDataRev` | T16-W20 | `t16-w20-calrev-gate.test.mjs` | 已纳编 471 |
| P0-1 | `renderSubTags()` 引用未定义 `tags` | T17-W1 | `t17-w1-rendersubtags-rows.test.mjs` | 已纳编 471 |
| P0-2 | 周视图 UTC / 本地时区错位 | T17-W2 | `t17-w2-weekview-local-day.test.mjs` | 已纳编 471 |
| P1 组 | 秒级归一 / 死代码 / 幻灯片监听泄漏 | T17-W3 | `t17-w3-p1-fixes.test.mjs` | 已纳编 471 |
| P1/P2/P3 组 | 11 项合并收尾（含 OP-L17W1-1 / OP-L17W3-2） | T17-W4 | `t17-w4-batch-fixes.test.mjs` | 已纳编 471 |
| 最终补丁 | 标签视图 `Set.map` / 观察项退役 / 骨架提示 | T18-Patch | `t18-final-patch.test.mjs` | 已纳编 471 |
| 批次 1 | boot pending 消费条件 / `commit` patch 作用域 | T19-Patch1 | `t19-patch1.test.mjs` | 已纳编 471 |
| 批次 2 | 标签选择器缓存 / `purgeNodeMeta` / 幻灯片 blur | T19-Patch2 | `t19-patch2.test.mjs` | 已纳编 471 |
| 批次 3 | `_sanTextEsc` 退役 / `applyPatch` 冗余修复 / 上报去重键 | T19-Patch3 | `t19-patch3.test.mjs` | 已纳编 471 |
| TODO-3 | `mergeRemoteState` O(n²) 线性扫描（性能） | T22-r4 收尾波 | 见 `t16-w21` / 属性测试 `property.full`（`t16-w22-qa-all.mjs`） | 已纳编 471（性能噪声抑制靠单测阈值 + 串行编排） |
| DEF-010 | 关页强制落盘竞态 | T22-r4 收尾波 | `t16-w14-persist-chain-async.test.mjs` + `t9-persist-layer.test.mjs` | 已纳编 471 |

---

## 三、基础层回归（T9 – T14）

| 层 | 主题 | 测试文件 |
|---|---|---|
| T9 | 持久化层 / 索引层 / 后端适配器 | `t9-persist-layer.test.mjs`、`t9-backend-parity.test.mjs`、`t9-shadow-wiring.test.mjs` |
| T10 | IndexedDB 持久化 | `t10-idb-persist.test.mjs`、`t10-w4-consistency.test.mjs` |
| T11 | 锚点治理 / 一致性 | `t11-w4-consistency.test.mjs` |
| T12 | 虚拟滚动 | `t12-virtual-scroll.test.mjs`、`t12-w4-consistency.test.mjs` |
| T13 | 多维表格工作集 | `t13-mb-workset.test.mjs` |
| T14 | 虚拟滚动硬化 | `t14-vs-hardening.test.mjs`、`t14-w4-consistency.test.mjs` |
| T16-W1–W9 | 性能 / 渲染 / 主题（rev 传播、日历代次、侧栏计数、RO、定时器、childSet、子树、墓碑、主题 token） | `t16-w1-*` … `t16-w9-*`（见同目录） |
| T16-W22 / T17 / T19 | QA 编排器 | `t16-w22-qa-all.mjs`、`t17-qa-all.mjs`、`t19-qa-all.mjs` |

---

## 四、Playwright（PW 171）

- spec 目录：`6.P0-T3基线/step9/tests/`
- 覆盖：不变式 `t3-invariants`、commit 回调、引用语义、轻量污染、IDB 持久化、锚点治理等
- 现行结果：**171**（167 passed + 4 skipped）；skip 仅限负载敏感的 T-48 / T-49，显式声明，不隐藏。

---

## 五、遗留与跟踪

| 项 | 状态 | 说明 |
|---|---|---|
| ISSUE-003 · 2 suites / 13 tests 被停用 | **CLOSED** | `t16-w12-patch-children-holes.test.mjs` + `t16-w13-remote-received-delete-propagation.test.mjs` 已取消 `scripts/verify.js` 中的注释停用并**纳入 `NODE_TESTS`（计入 471）**；两行映射状态已改为「已纳编 471」。 |
| ISSUE-002 · 验收结论互斥 | **OPEN** | `_报告与元数据/ACCEPTANCE-REPORT.md` 判定 NOT ACCEPTED，与 PROJECT-HEALTH-REPORT 的 471/471 全绿并存；需补 superseding 验收记录。 |
| ISSUE-004 · t15 包 checksums 失效 | 已记录 | 见 `8.发布与CI/release/v2.0-t15-2026-10-16/ERRATA.md`。 |
| 性能基线重测 | **PENDING** | `5.性能基线/bench-p0-baseline.json` 的 `metrics` 仍为 v2.0-frozen 世代采样（ISSUE-021），重测前对拍结论不具判别力。 |

---

> 维护规则：任一修复波落地后，**必须**在本矩阵新增 / 更新一行，并给出可复跑的测试文件路径；无法给出测试文件的修复项，须在“遗留与跟踪”中显式登记原因。
