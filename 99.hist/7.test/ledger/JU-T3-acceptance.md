# P0-L3 验收记录
> **历史归档注记（2026-10-09，第四步收口）**：本文档 F-06 等条提及的 `reportError` 两种
> kind 机制为 Step3 时点状态，已被结构共享 produce 取代并废除（produce 失败不产生
> kind）。正文保留历史原貌，不代表当前代码行为，详见 `结构共享验收记录.md` §十一。
> **Step9 追加（2026-10-09）**：L3-44（`P0-L3/性能预算.md`）已追加，三源实际 **59 项**；
> 本文档 §一/§二/§6.1 的「58 项」为 Step0~Step8 时点计数，保留历史原貌。
## 一、验收对象
| 项 | 值 |
|---|---|
| 阶段 | P0-L3（不可变原语化 + commit 收口） |
| 冻结标签 | `v2.0-frozen` |
| 冻结时间 | 2026-10-08 |
| 基线文件 | `P0-L3/baseline/v2.0-l3__baseline_original.html` |
| 交付文件 | `v2.0-l3.html.html` |
| 基线 SHA-256 | `0635e55a2c8212d60c7ff2450aebf2c77a5277a502b19f9528fbac09829da1c6` |
| 交付 SHA-256 | `d67d349dff46e7fb955bdadae7a94443543b25ddbfa25083602831abd586fb78` |
| P0 前功能基线 | `P0-L3/baseline-step1.html`（Step0 原始 + step1.diff；含 `__juProduce`，无 Step2/3），SHA-256 `2d79f53373018dd62af0e2906f300df696564a3ee21e50fc7e1649f7519017ee` |
## 二、验收范围
| 类别 | 覆盖 |
|---|---|
| 步骤 | Step0 ~ Step8 全部完成 |
| 代码修改 | 3 处（`__juProduce`/`__juProduceSafe` 内联、`commit` 非 light 替换、`commit` light 加固）+ Step4 三项修复（try/finally、日志断言、mindmap snapshot:false） |
| 工具/脚本 | 3 项（审计工具集 / compare-bench / bench-spec） |
| 测试 spec | 4 份，59 用例 + 14 bench 场景 |
| 文档 | 15 份（含本文件、`项目日志.md`） |
| 冻结清单 | 58 项 |
| 后续行动 | 10 项登记（3 已完成 + 7 待办至 Step9） |
## 三、验收项与结论
### 3.1 交付物验收
| # | 交付物 | 路径 | 状态 |
|---|---|---|---|
| 1 | 基线锁定与核对 | `P0-L3/README.md`、`P0-L3/基线核对.md` | ✅ |
| 2 | 基线副本 | `P0-L3/baseline/v2.0-l3__baseline_original.html` | ✅ |
| 3 | 选型记录 | `P0-L3/选型记录.md` | ✅ |
| 4 | 适配文档 | `P0-L3/immutable-adapter.md` | ✅ |
| 5 | Step2 补丁与说明 | `P0-L3/commit-diff.patch`、`P0-L3/commit替换说明.md` | ✅ |
| 6 | Step3 修复记录与测试 | `P0-L3/light污染修复记录.md`、`tests/l3-light-pollution.spec.ts` | ✅ |
| 7 | Step4 审计工具与数据 | `tools/audit-commit-callbacks.js` + `tools/audit-indirect-calls.js`、`P0-L3/commit-callback-audit.{md,csv}`（显式 84 条）、`P0-L3/commit-callback-indirect.csv`（间接 98 条） | ✅ |
| 8 | Step5 回调验证 | `tests/l3-commit-callbacks.spec.ts`（24 条）、`P0-L3/回调验证记录.md` | ✅ |
| 9 | Step6 引用语义 | `tests/l3-reference-semantics.spec.ts`（28 条）、`P0-L3/引用语义测试报告.md` | ✅ |
| 10 | Step7 性能对拍 | `tests/bench-p0-after-l3.spec.ts`、`scripts/compare-bench.js`、`bench-p0-{baseline,after-l3}.json`、`P0-L3/P0后基准对比.md`、`P0-L3/回归对拍报告.md` | ✅ |
| 11 | Step8 收口文档 | `项目日志.md`、`ju-week-board.html.html`、`JU-58项修复回归清单-v2.0-frozen.md`、`回归清单.csv`、`fix-map.json` | ✅ |
### 3.2 功能验收
| # | 验收项 | 判据 | 结论 |
|---|---|---|---|
| F-01 | `__juProduce` 语义 | 对象返回新引用；原始值返回 recipe 返回值或原值；抛错时 base 未污染 | ✅ 5/5 用例（`l3-reference-semantics#I-01~I-05`） |
| F-02 | `__juProduceSafe` 语义 | 成功 `{ok:true,next}`；失败 `{ok:false,base,error}` 且 `base===入参` | ✅ 2/2（`#I-06~I-07`） |
| F-03 | `commit` 非 light 成功 | state 引用替换，旧引用不被污染 | ✅ `#I-11` |
| F-04 | `commit` 非 light 失败 | state 引用与内容完全不变 | ✅ `#I-12` |
| F-05 | `commit` light 成功 | state 引用不变（原地修改） | ✅ `#I-13` |
| F-06 | `commit` light 抛错 | 两种成因分别 `reportError`（kind 不同） | ✅ `l3-light-pollution#A1/A2` |
| F-07 | `commit` light 抛错（非 silent） | 触发一次 `scheduleNotify` | ✅ `l3-light-pollution#B1` |
| F-08 | `undo` / `redo` 引用语义 | state 引用替换为历史副本，隔离断言通过 | ✅ `#I-16~I-19` |
| F-09 | `updatedAt` 严格单调 | 8 次 commit 后 delta ≥ 8 | ✅ `#I-15` |
| F-10 | 指纹机制与引用解耦 | `_sidebarFingerprint` / `_lastWrittenJson` 基于 `updatedAt` / 内容 | ✅ `#I-20~I-23` |
| F-11 | `mergeRemoteState` 引用行为 | 新节点直接引用远端；较新覆盖；较旧保留 | ✅ `#I-24~I-26` |
| F-12 | 危险键防护 | 全局原型链不被污染 | ✅ `#I-27~I-28` |
| F-13 | commit 回调审计 | P0 = 0，无 `await` / DOM 操作；显式 84 + 间接 98 = 182 条登记 | ✅ `P0-L3/commit-callback-audit.md` |
| F-14 | 回调行为验证 | 24 条用例全绿 | ✅ `playwright-report` |
### 3.3 性能验收
| # | 验收项 | 判据 | 结论 |
|---|---|---|---|
| P-01 | Step2 无性能回归 | `commitNonLight @ 500` delta ≤ +30% | ✅ 0.0% |
| P-02 | Step3 无性能回归 | `commitLight @ 500` delta ≤ +30% | ✅ 近零（计时分辨率内） |
| P-03 | `__juProduce` 绝对量级 | 与 `safeClone` 同级（固定开销不可测） | ✅ 量级同级 |
| P-04 | `mergeRemoteState` 无回归 | delta ≤ +30% | ✅ 近零 |
| P-05 | 全场景通过率 | 11 / 11 | ✅ |
| P-06 | 最大恶化（非零组） | ≤ +100% | ✅ 0.0% |
### 3.4 交付形态验收
| # | 验收项 | 判据 | 结论 |
|---|---|---|---|
| D-01 | 单文件 HTML 保持 | 无外部依赖，拷贝即用 | ✅ |
| D-02 | 无运行期 npm 依赖 | `package.json` 无新增 runtime dep | ✅（仅 `@playwright/test` 测试期依赖） |
| D-03 | 离线可用 | `file://` 直接打开无报错 | ✅ |
| D-04 | 加密路径未受影响 | AES-GCM + PBKDF2 路径无改动 | ✅ |
## 四、验收步骤与命令
```bash
# 1. 基线一致性
sha256sum P0-L3/baseline/v2.0-l3__baseline_original.html
sha256sum v2.0-l3.html.html
# 2. 三套功能 spec（after，合计 59 条）
npx playwright test tests/l3-light-pollution.spec.ts
npx playwright test tests/l3-commit-callbacks.spec.ts
npx playwright test tests/l3-reference-semantics.spec.ts
# 3. P0 前功能基线对照（baseline-step1，预期 4 条失败 = Step3 回归用例）
JU_APP_URL="file://$(pwd)/P0-L3/baseline-step1.html" \
npx playwright test tests/l3-light-pollution.spec.ts
JU_APP_URL="file://$(pwd)/P0-L3/baseline-step1.html" \
npx playwright test tests/l3-commit-callbacks.spec.ts
# 4. 性能对拍
JU_APP_URL="file://$(pwd)/P0-L3/baseline/v2.0-l3__baseline_original.html" \
JU_BENCH_LABEL=baseline JU_BENCH_OUTPUT=bench-p0-baseline.json \
npx playwright test tests/bench-p0-after-l3.spec.ts
JU_APP_URL="file://$(pwd)/v2.0-l3.html.html" \
JU_BENCH_LABEL=after JU_BENCH_OUTPUT=bench-p0-after-l3.json \
npx playwright test tests/bench-p0-after-l3.spec.ts
node scripts/compare-bench.js bench-p0-baseline.json bench-p0-after-l3.json
# 5. 静态审计
node tools/audit-commit-callbacks.js
node tools/audit-indirect-calls.js
# 6. 看板/清单一致性
# 打开 ju-week-board.html.html，核对看板数据与 fix-map.json / 回归清单.csv 一致
```
> 说明：原始基线（Step0）不含 `__juProduce`，功能 spec 无法在其上启动；
> 功能对拍的 P0 前基线使用 `P0-L3/baseline-step1.html`（Step1-only 中间产物），
> 原始基线仅用于性能对拍（`juProduce` 场景在基线侧判「缺数据/新增」）。
## 五、验收结论
### 5.1 通过项
- 全部 14 项功能验收（F-01 ~ F-14）通过；
- 全部 6 项性能验收（P-01 ~ P-06）通过；
- 全部 4 项交付形态验收（D-01 ~ D-04）通过；
- 全部 11 项交付物（§3.1）齐备。
### 5.2 遗留项（不阻塞验收，Step9 执行）
| ID | 项 | 处理 |
|---|---|---|
| ACT-4 | 三套功能 spec 纳入 CI（PR 卡口） | Step9 执行 |
| REF-ACT-1 | Immer 式未修改返回原引用评估 | Step9 评估 |
| REF-ACT-2 | `mergeRemoteState` 克隆式合并评估 | Step9 评估 |
| REF-ACT-3 | Step5 + Step6 spec 入 CI | Step9 执行 |
| BENCH-ACT-1 | 性能对拍纳入 CI | Step9 执行 |
| BENCH-ACT-3 | 性能预算文档 | Step9 执行 |
| REG-ACT-1 | 功能 spec 入 CI | Step9 执行 |
> 已闭环说明：ACT-1（mindmap `snapshot:false`）、ACT-2（列/行拖拽 `try/finally`）
> 于步骤 4 完成；ACT-3（light/dirtyText 文档补遗）于步骤 6 完成；OBS-3 已决策并应用。
### 5.3 未覆盖范围（明示）
1. 加密模式下的性能与引用语义；
2. 多标签 BroadcastChannel 交互；
3. 桌面 Tauri 路径（`desktopInvoke` 往返）；
4. 间接路径（`mergeRemoteState` / `dedupCalRoots` / `dedupNoteRoots`）集成测试；
5. `WeakRef` 类引用感知逻辑（当前未使用）。
上述范围登记至 Step9，不在本阶段验收范围内。
## 六、冻结与变更控制
### 6.1 冻结规则
1. 本验收记录通过后，`v2.0-l3.html.html` 进入 `v2.0-frozen` 状态；
2. `P0-L3/baseline/` 目录内容只读，不直接修改；
3. `58 项冻结清单` 与 `fix-map.json` / `回归清单.csv` 三份数据源同源，任何变更需三方同步；
4. 后续修复以新 ID（如 L3-50+）记录，不回改既有 ID；
5. 若基线文件发生变化，须重新执行 Step0 并更新本验收记录。
### 6.2 变更流程
| 步骤 | 动作 |
|---|---|
| 1 | 提出变更申请，附影响范围分析 |
| 2 | 更新 `fix-map.json` + `回归清单.csv` + `JU-58项修复回归清单-v2.0-frozen.md` 三方同步 |
| 3 | 跑三套功能 spec + 性能对拍 |
| 4 | 更新 `项目日志.md` 与 `ju-week-board.html.html` |
| 5 | 更新本验收记录 §3 与 §5 |
## 七、签收
| 角色 | 签署 | 日期 |
|---|---|---|
| 开发 | — | 2026-10-08 |
| 测试 | — | 2026-10-08 |
| 产品 | — | — |
## 八、验收附件清单
| 附件 | 路径 |
|---|---|
| 冻结清单（Markdown） | `JU-58项修复回归清单-v2.0-frozen.md` |
| 冻结清单（CSV） | `回归清单.csv` |
| 冻结清单（JSON） | `fix-map.json` |
| 看板（HTML） | `ju-week-board.html.html` |
| 项目日志 | `项目日志.md` |
| 性能基准 JSON | `bench-p0-baseline.json`、`bench-p0-after-l3.json` |
| 审计 CSV | `P0-L3/commit-callback-audit.csv`、`P0-L3/commit-callback-indirect.csv` |
| Playwright 报告 | `playwright-report/index.html` |
| 测试结果 JSON | `test-results/*.json` |

## 十二、维护者速览（2026-10-09 Step9 封版收口语）

给后续接手者的三句话（v2.0-frozen 心智模型）：

1. **不可变原语**：`__juProduce` 是 Proxy + 路径复制的结构共享实现，未修改返回原引用；`Date/Map/Set/RegExp` 仅顶层回退 `safeClone`，嵌套不保证（state 约定不含此类实例）。
2. **commit 契约**：全部路径（含 light）统一走 `__juProduceSafe`；失败零污染 base；`updatedAt` 无条件 bump；light 不入历史栈；`dirtyText/dirtyDocs` 三态见 `immutable-adapter.md` §九。
3. **危险键**：state 复制一律走 `copyPlain`（CreateDataProperty 语义），禁止 `Object.assign` / 展开；`__proto__` 在 produce 内作为自有数据键保留，不清洗（清洗责任在消费路径）。

后续新变更按 `fix-map.json` 冻结规则以新 ID（L3-50+）记录，不回改既有条目。

### 12.1 新增 fix 条目的操作流程（三源同步）

按 `JU-58项修复回归清单-v2.0-frozen.md` §十一 第 4 条，新增条目以新 ID（L3-50+）记录，不回改既有条目；同时三源同步：

> 编号规则：Step9 内的紧凑追加用顺延编号（如 L3-44 紧接 L3-43）；跨步骤或未来新变更用预留区 L3-50+，避免与既有编号碰撞。

1. `fix-map.json`：追加 `fixes` 数组条目，并同步 `summary.fixes` / `byLevel` / `byStatus` / `byCategory` 四处加和（新增条目落在哪个类别/级别/状态，对应计数 +1）；
2. `回归清单.csv`：追加同构行（`id,category,title,location,level,status,owner,step,evidence`）；
3. `JU-58项修复回归清单-v2.0-frozen.md`：对应类别表（A/B/C/D/E/F/G/H）追加行，同步 §一 合计与类别计数。

### 12.2 CI 接线指引

- `--exclude-op=commitRewriteAllText` 的白名单排除理由：见 `结构共享验收记录.md` §6.3（BENCH-ACT-1，选 A）与 `P0-L3/性能预算.md` §三；
- `npm run verify:bench` 已内部透传该参数；云端 CI 只需 `npm run verify:all`（Node + Playwright + bench 一次编排），无需额外传参。
