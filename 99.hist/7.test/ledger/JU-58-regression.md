# JU · 修复回归清单（v2.0-frozen）
> 原「58 项冻结清单」；Step9 追加 L3-44（`P0-L3/性能预算.md`）后实际 **59 项**，见 §一。
> 冻结时间：2026-10-08
> 冻结对象：`v2.0-l3.html.html`（SHA-256 `d67d349dff46e7fb955bdadae7a94443543b25ddbfa25083602831abd586fb78`；基线 SHA-256 见 `P0-L3/基线核对.md`）
> 数据源：`fix-map.json`、`回归清单.csv`、`P0-L3/P0后基准对比.md`
> 与看板一致性：`ju-week-board.html.html` 内联快照同源
## 一、59 项构成
| 类别 | 数量 | 说明 |
|---|---|---|
| A · 代码修改 | 8 | 内联原语 + commit 双分支 + 断言 |
| B · 工具/脚本 | 3 | 审计工具集 / compare-bench / bench-spec |
| C · 测试 spec | 3 | light-pollution / commit-callbacks / reference-semantics |
| D · 文档产出 | 14 | README、选型、适配、diff、报告、日志等（含 Step9 追加 L3-44 性能预算） |
| E · 后续行动 | 10 | 5 已完成（ACT-1~3 + REF-ACT-1/2）+ 5 待办（Step9） |
| F · OK 抽样 | 10 | 审计通过项代表 |
| G · 观察项 | 4 | OBS-1~4（3 已复核 + 1 已闭环） |
| H · 跨步骤合计 | 7 | 58-01~58-07 |
| **合计** | **59** | 逐条编号见 `fix-map.json` / `回归清单.csv` |
> 状态口径说明（与实测对齐）：
> - `l3-commit-callbacks.spec.ts` 实际为 **24 条**用例（非 22），全量功能用例 59 条；
> - ACT-1（mindmap 拖拽 `snapshot:false`）与 ACT-2（列/行拖拽 `up` 回调 `try/finally`）
>   已在步骤 4 完成，ACT-3（light/dirtyText 文档补遗）已在步骤 6 完成；
> - OBS-3 已决策并应用（`renderMindmap.mousedown.onMU` → `{snapshot:false,persistOnly:true}`）。
## 二、A 类 · 代码修改（8）
| ID | 标题 | 位置 | 级别 | 状态 |
|---|---|---|---|---|
| L3-01 | 内联 `__juProduce` | `v2.0-l3.html.html` | OK | 完成 |
| L3-02 | 内联 `__juProduceSafe` | `v2.0-l3.html.html` | OK | 完成 |
| L3-03 | `commit` 非 light 走 `__juProduceSafe` | `commit()` | OK | 完成 |
| L3-04 | `undo` / `redo` 统一 `safeClone` 入栈 | `undo()/redo()` | OK | 完成 |
| L3-05 | light `_backupValid` 检测 | `commit()` | P1 | 完成（**机制已废除**：produce 失败天然不污染 base，无回滚检测） |
| L3-06 | light 抛错 `reportError`（两种 kind） | `commit()` | P1 | 完成（**机制已废除**：produce 失败不产生 kind，无上报） |
| L3-07 | light 抛错强制通知（非 silent） | `commit()` | P1 | 完成（语义保持：失败非 silent 时 `scheduleNotify` 一次） |
| L3-08 | `flushPendingLogs` 关页前告警断言 | `flushBeforeUnload` | P1 | 完成 |
## 三、B 类 · 工具与脚本（3）
| ID | 标题 | 位置 | 状态 |
|---|---|---|---|
| L3-11 | 审计工具集（`audit-commit-callbacks.js` + `audit-indirect-calls.js`） | `tools/` | 完成 |
| L3-12 | `compare-bench.js`（退出码 2 用于 CI） | `scripts/` | 完成 |
| L3-13 | `bench-p0-after-l3.spec.ts` | `tests/` | 完成 |
## 四、C 类 · 测试 spec（3）
| ID | 标题 | 用例数 | 状态 |
|---|---|---|---|
| L3-21 | `l3-light-pollution.spec.ts` | 7 | 7 通过 |
| L3-22 | `l3-commit-callbacks.spec.ts` | 24 | 24 通过 |
| L3-23 | `l3-reference-semantics.spec.ts` | 28 | 28 通过 |
## 五、D 类 · 文档产出（14）
| ID | 文件 | 说明 |
|---|---|---|
| L3-31 | `P0-L3/README.md` | 基线锁定目标与规则 |
| L3-32 | `P0-L3/基线核对.md` | SHA-256 / 版本标记 / 模块清单 |
| L3-33 | `P0-L3/选型记录.md` | Immer vs 自研对比与结论 |
| L3-34 | `P0-L3/immutable-adapter.md` | `__juProduce` API 契约与边界（含 dirtyText 三态表） |
| L3-35 | `P0-L3/commit-diff.patch` | Step2 补丁 |
| L3-36 | `P0-L3/commit替换说明.md` | Step2 详解与回归矩阵 |
| L3-37 | `P0-L3/light污染修复记录.md` | Step3 A1/A2/B1 修复与设计权衡 |
| L3-38 | `P0-L3/commit-callback-audit.md` | Step4 审计报告 |
| L3-39 | `P0-L3/commit-callback-audit.csv`（显式 84）+ `commit-callback-indirect.csv`（间接 98） | 合计 182 条回调路径登记 |
| L3-40 | `P0-L3/回调验证记录.md` | Step5 覆盖矩阵与结论 |
| L3-41 | `P0-L3/引用语义测试报告.md` | Step6 28 条不变量 |
| L3-42 | `P0-L3/P0后基准对比.md` | Step7 全场景对比 |
| L3-43 | `P0-L3/回归对拍报告.md` | Step7 三套 spec 结果摘要 |
| L3-44 | `P0-L3/性能预算.md` | Step9 性能预算文档（BENCH-ACT-3） |
## 六、E 类 · 后续行动（10：5 已完成 + 5 待办）
| ID | 标题 | 级别 | 状态 | 归属 |
|---|---|---|---|---|
| ACT-1 | OBS-3 落定：mindmap 拖拽改 `snapshot:false` | P1 | 完成（Step4） | Step9 引用 |
| ACT-2 | P1 UI 一致性：列/行拖拽 `up` 回调 `try/finally` | P1 | 完成（Step4） | Step9 引用 |
| ACT-3 | light 引用不变量 + dirtyText 三态文档补遗 | P2 | 完成（Step6） | Step9 引用 |
| ACT-4 | 三套功能 spec 纳入 CI | P1 | 待办 | Step9 |
| REF-ACT-1 | Immer 式未修改返回原引用评估 | P2 | 完成（评估关闭，2026-10-09） | 已闭环 |
| REF-ACT-2 | `mergeRemoteState` 克隆式合并评估 | P2 | 完成（评估关闭，2026-10-09） | 已闭环 |
| REF-ACT-3 | Step5 + Step6 spec 入 CI | P1 | 待办 | Step9 |
| BENCH-ACT-1 | 性能对拍纳入 CI | P1 | 待办 | Step9 |
| BENCH-ACT-3 | 性能预算文档 | P2 | 待办 | Step9 |
| REG-ACT-1 | 功能 spec 入 CI（PR 卡口） | P1 | 待办 | Step9 |
## 七、F 类 · OK 抽样（10）
| ID | 标题 | 位置 |
|---|---|---|
| OK-01 | `actions.addNode` snapshot 齐全 | L1160 |
| OK-02 | `actions.updateText` tags 重算 | L1173 |
| OK-03 | `actions.toggleDone` 双向切换 | L1181 |
| OK-04 | `actions.moveNode` 拒绝自环 | L1215 |
| OK-05 | `actions.removeNode` 递归 + 墓碑 | L1236 |
| OK-06 | `commitPendingEditBeforeRender` 三态 | L2124 |
| OK-07 | `openCalTimeModal` 时间/重复 | L3573 |
| OK-08 | `renderCalNode` blur 日期解析 | L5655 |
| OK-09 | `ensureWordInit` 幂等迁移 | L7420 |
| OK-10 | `importOutline` 缩进单位推断 | L9600 |
## 八、G 类 · 观察项（4）
| ID | 标题 | 结论 |
|---|---|---|
| OBS-1 | `commitPendingEditBeforeRender.word` 四标志 | 已复核：语义正确 |
| OBS-2 | `renderDbTable.titleInput` 400ms 防抖 | 已复核：正确 |
| OBS-3 | `renderMindmap` 拖拽 snapshot 决策 | 已闭环：改 `snapshot:false`（Step4 应用，`P0-L3/diffs/step4.diff`） |
| OBS-4 | `ensureWordInit` `_wordFlat` 标记 | 已复核：正确 |
## 九、H 类 · 跨步骤合计项（7，编号 58-01~58-07）
| ID | 标题 | 所属步骤 |
|---|---|---|
| 58-01 | `__juProduce` 与 `safeClone` 量级同级（固定开销不可测） | Step7 |
| 58-02 | `commit` 非 light delta 0.0%（@100/@500） | Step7 |
| 58-03 | `commit` light 近零（计时分辨率内） | Step7 |
| 58-04 | `undoRedo` delta 0.0%（p95 @500 噪声 -21%） | Step7 |
| 58-05 | 三套 spec 合计 59 用例全绿（after） | Step5 / Step6 |
| 58-06 | P0 前基线（baseline-step1）4 条预期失败 → after 全通过 | Step3 / Step7 |
| 58-07 | 引用不变量 28 条锁定 | Step6 |
## 十、风险级别汇总
| 级别 | 数量 | 状态 |
|---|---|---|
| P0 | 0 | 审计显式 84 条中 P0 = 0 |
| P1 | 5（显式审计） | 全部闭环（Step3 代码层 + Step4 UI/OBS 层） |
| P2 | 5（显式审计） | 全部文档化/复核（ensureCalendarRoot、dirtyText:false 等） |
| OK | 74（显式审计） | 抽样 10 项代表（F 类） |
| OBS | 4 | 3 已复核 + 1 已闭环（OBS-3） |
> 注：以上为步骤 4 显式审计（84 条）的风险分布；间接登记 98 条另见
> `P0-L3/commit-callback-indirect.csv`。冻结清单自身 **59** 项的级别分布
> （P0=0 / P1=15 / P2=8 / OK=**36**）见 `fix-map.json#summary`。
## 十一、冻结规则
1. 本清单冻结后，A/B/C/D 类项内容不再变更。
2. E 类剩余后续行动（5 项：ACT-4 / REF-ACT-3 / BENCH-ACT-1 / BENCH-ACT-3 / REG-ACT-1）按优先级在 Step9 执行，执行后在本清单追加「已完成」标记；REF-ACT-1/2 已评估关闭（2026-10-09，见 §六）。
3. 若基线文件发生变化，须重新执行 Step0 并更新本清单。
4. 任何追加修复以新 ID（如 L3-50+）记录，不回改既有 ID。
## 十二、验收引用
- 完整 CSV：`回归清单.csv`（59 行数据，由 `fix-map.json` 生成，同源）
- 结构化映射：`fix-map.json`
- 看板视图：`ju-week-board.html.html`
- 验收记录：`P0-L3/L3验收记录.md`
