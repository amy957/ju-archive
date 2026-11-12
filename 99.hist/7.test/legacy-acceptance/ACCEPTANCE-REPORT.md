# ACCEPTANCE-REPORT — 收尾批次验收报告（r4 基线）

> 🧾 **[SUPERSEDING 裁决记录 · 记录号 `R6-ISSUE-003-SUPERSEDING-2026-10-18` · 具名责任方：R6 缺陷修复批次（Code 模式 · Zoo）· 2026-10-18]**
> **唯一交付结论（唯一权威口径）**：r4 基线 **NOT ACCEPTED / INVALID / DO-NOT-SHIP**。本记录**取代**归档内一切与本结论相反的「可交付 / 已全绿」表述（含 `PROJECT-HEALTH-REPORT.md:12-21` 的 471/471 · PW 171 · bench 7/7，与 `PROJECT-STATUS-FINAL-2026-10-18.md:44-51` 的同类叙述），直至下述撤销条件成立。
> **本批次未出具 superseding 绿证的原因（不得解读为通过）**：本次修复环境**无可用 `node` 运行时**（`node -v` 返回「不是内部或外部命令」；`Program Files` / `ProgramData` / `LocalAppData` 及 `E:` 工具目录下均无独立 `node.exe`，仅有一份无法作为运行时启动的 Electron 二进制），故 **Node 全量 471 用例 + Playwright + bench 均无法在本批次重跑，其完整原始输出不存在**。`git` 侧已定位并使用便携版（`E:\APP\tools\PortableGit\cmd\git.exe`，2.56.0.windows.2）完成 ISSUE-001 的 `git add -f`，与本结论无关。依照本报告第四节红线（不得为强行发布而放宽标准 / 不得虚报绿证），此处**不虚构任何 Node+PW+bench 输出、不以历史绿证充当本批次绿证**，因此 superseding 绿证**不予出具**，验收结论维持不通过。
> **互链（双向）**：本裁决已同步落盘至发布包 [`release-manifest.json`](../8.发布与CI/release/v2.0-t22-r4-2026-10-18/release-manifest.json:7)（`status: INVALID` + `statusNote` 指向本节；`gate.playwright` / `gate.bench` 由 `PASS` 改为 `UNVERIFIED`）与 [`RELEASE-NOTES.md`](../8.发布与CI/release/v2.0-t22-r4-2026-10-18/RELEASE-NOTES.md:91)「八、勘误（ERRATA）」；两文件均反向指回本节。
> **撤销条件（唯一解禁路径）**：出具一份**具名** superseding 验收记录，内含 `node scripts/verify.js all` 的 **Node 471/471**、**Playwright 计数**、**bench 7/7** 的**完整原始输出与落盘日志路径**（须为本批次实跑，不得为历史复用）；届时由该记录将 `release-manifest.json` 的 `status` 改回 `current`，重算包内字节 / SHA-256，并同步刷新 `ARCHIVE-INDEX.md` 与本报告结论。

> ⚠️ **[ERRATUM · 追加批注 · 2026-10-18 — 本节为新增记录，下方历史正文未作任何修改]**
> 本报告判定 **未通过（NOT ACCEPTED）**：门禁 471 用例中 **470 通过 / 1 失败**，且 Playwright 与 bench 步骤未被执行。
> 据此声明：当前发布包 [`8.发布与CI/release/v2.0-t22-r4-2026-10-18/`](../8.发布与CI/release/v2.0-t22-r4-2026-10-18/RELEASE-NOTES.md:1) 的发布状态**需重新确认**，暂定为 **INVALID / 需撤回（DO-NOT-SHIP）**；在新的全量门禁绿证出具 superseding 验收记录之前，不得作为交付物交付或复用。
> 解除条件：重跑全量门禁（Node + Playwright + bench）并以完整输出出具新的验收记录；在此之前，任何文档不得引用本报告作为"已通过"依据。

---

- 验收时间：**2026-10-18 18:30 +08:00**（本机时区 Asia/Shanghai）
- 验收对象：`HEAD.json` 记录的 r4 基线（`6.P0-T3基线/v2.0-t3.html`，**1,174,919 B / `0B4AA2A6…5A3C` / LF**）
- 验收结论：**未通过（NOT ACCEPTED）** — 门禁 471 用例中 **470 通过 / 1 失败**
- 处置：按本批次红线约束第 3 条，**已在第一次门禁失败处停止**；未重新打包、未改动任何产品业务代码、未放宽任何测试阈值。

---

## 一、命令 1：`verify.js`（完整门禁）

### 1.1 执行

```powershell
node 6.P0-T3基线\step9\scripts\verify.js
```

- 实际执行方式：`verify.js` 内部按 `node --test --test-concurrency=1` 串行编排（默认 mode=spec）
- 运行环境：Node **v22.23.2**；Chromium 回退路径 `C:\Users\12601\AppData\Local\Google\Chrome\Application\chrome.exe`（存在）
- 原始日志：[`_哈希与行尾校验/acceptance-r4-verify-2026-10-18.log`](../_哈希与行尾校验/acceptance-r4-verify-2026-10-18.log:1)
- 退出码：**1**

### 1.2 最终输出（摘录）

```text
[verify] mode=spec root=E:\APP\归档\6.P0-T3基线\step9

▶ 静态检查（铁律 6 · 禁止 AI 生成注释）
  ✓ 静态检查（铁律 6 · 禁止 AI 生成注释） (0 命中, 32ms)

▶ Node 单元测试
  ...
# tests 471
# suites 176
# pass 470
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 25935.4803

━━ 步骤摘要 ━━
  ✓ 静态检查（铁律 6 · 禁止 AI 生成注释） (32ms)
  ✗ Node 单元测试（471 用例） 失败（退出码 1，26160ms）
```

- 静态检查：**0 命中 / PASS**
- Node 用例：**tests 471 / pass 470 / fail 1 / skipped 0**
- 因首个步骤失败即退出，**Playwright 与 bench 步骤未被执行**（不是失败，也不是通过）

### 1.3 失败项（唯一）

| 项 | 内容 |
|---|---|
| 用例文件 | [`6.P0-T3基线/step9/t9/t16-w8-tombstone-sweep.test.mjs`](../6.P0-T3基线/step9/t9/t16-w8-tombstone-sweep.test.mjs:161) |
| 用例名 | `L16-W8 §F 性能验收（连续 5000 删除累计耗时下降 ≥60%）` → `新口径累计耗时 ≤ 旧口径 40%（交错采样 · 取多轮最小值）` |
| 断言位置 | 定义 `:162`，断言 `:176` |
| 断言原文 | `新口径 58.779ms 未较旧口径 72.212ms 下降 ≥60%（实测 18.6%）` |
| 失败码 | `ERR_ASSERTION`（`expected: true / actual: false`） |
| 性质 | 相对性能验收（ratio 阈值 60%），非功能缺陷断言 |

### 1.4 复现性核验（只读取证，未改动测试）

单文件独立执行 3 次，结果一致：

```text
RUN1  # pass 5  # fail 1
RUN2  # pass 5  # fail 1
RUN3  # pass 5  # fail 1
```

单文件两轮实测值：

```text
新口径 55.925ms / 旧口径 64.536ms → 实测下降 13.3%（阈值要求 ≥60%）
新口径 58.779ms / 旧口径 72.212ms → 实测下降 18.6%（阈值要求 ≥60%）
```

补充量化（只读诊断脚本，取 5 轮最小值，已随后删除）：

```text
RUN1  bestNew=50.866  bestOld=61.850  drop=17.8%  threshold_met=false
RUN2  bestNew=52.569  bestOld=62.240  drop=15.5%  threshold_met=false
RUN3  bestNew=54.625  bestOld=61.102  drop=10.6%  threshold_met=false
```

结论：**稳定复现**（非偶发抖动），失败与采样轮次无关，当前环境下新口径累计耗时约为旧口径的 81%~89%，未达到 ≤40% 的验收线。

### 1.5 与历史绿证的差异（对照，不代表放宽依据）

同一用例在历史绿证 [`_s4tmp/t9-node-full-post-fix.txt`](../_s4tmp/t9-node-full-post-fix.txt:849) 中记录为通过（`tests 471 / pass 471 / fail 0`），当时该 §F 套件耗时 **421.88 ms**；本轮同一用例耗时 **822.43 ms**。即当前执行环境整体约 2 倍慢于历史绿证时点，新旧两口径耗时同时抬升，导致相对降幅被压缩至阈值以下。

本报告仅陈述该差异，**不将其作为豁免理由**：红线要求「不得为强行发布而放宽测试标准」，故门禁判定维持 **FAIL**。

---

## 二、命令 2：`verify-hash-registry.mjs`（哈希一致性门禁）

### 2.1 执行

```powershell
node 6.P0-T3基线\step9\verify-hash-registry.mjs
```

- 原始日志：[`_哈希与行尾校验/acceptance-r4-hash-registry-2026-10-18.log`](../_哈希与行尾校验/acceptance-r4-hash-registry-2026-10-18.log:1)
- 退出码：**0**

### 2.2 最终输出

```text
PARTY_COUNT=47
FIVE_PARTY_DRIFT_COUNT=0
RESULT=PASS
```

| 指标 | 结果 |
|---|---|
| 登记方数（PARTY_COUNT） | **47** |
| 哈希漂移数（FIVE_PARTY_DRIFT_COUNT） | **0** |
| 总判定（RESULT） | **PASS** |

- 47 个登记项（canonical / step9 镜像 / 各代冻结件 / spec / 支柱模块 / 门禁脚本）逐项 `PASS`，字节、SHA-256、行尾三类口径全部一致。

---

## 三、验收判定与未执行项

| 项 | 判定 |
|---|---|
| 静态门禁（铁律 6） | PASS（0 命中） |
| Node 单元测试 | **FAIL（470/471）** |
| Playwright 集成测试 | 未执行（前置步骤失败即退出） |
| bench 性能对拍 | 未执行（同上） |
| 哈希一致性门禁 | PASS（47 方 / 0 漂移） |
| 发布包重建（v2.0-t22-r4-2026-10-18） | **未执行（阻断）** |
| 旧发布说明历史归档标注 | **未执行（阻断）** |
| 冻结件命名清理与 HEAD.json 同步 | **未执行（阻断）** |
| `CURRENT_TASK.md` 状态固化 | **未执行（阻断）** |

阻断原因：红线段落明确要求「如果最终门禁出现任何失败，立刻停止并报告，严禁为了强行发布而放宽测试标准」。因此本批次不产出任何发布产物、不复用缺陷发布包、不声明「471/471 全绿」。

---

## 四、红线合规声明

1. 本批次**未修改**任何 HTML / JS 产品业务代码；canonical 仍为 **1,174,919 B / `0B4AA2A6…5A3C` / LF**（哈希门禁 0 漂移可证）。
2. 本批次**未修改**任何测试文件、测试阈值、`verify.js` 编排或 `verify-hash-registry.mjs` 期望值。
3. 本批次**未新建**任何发布目录、`checksums.sha256`、`RELEASE-NOTES.md`。
4. 本报告及其证据文件均未使用被禁用的命名标识。

---

## 五、待决策事项

1. **§F 性能验收的环境依赖**：该用例为相对性能阈值（≥60%），在当前执行环境下稳定落在 10.6%~18.6%。判定方向需决策：
   - 方向 A：确认生产环境（非沙箱受限终端）复跑，以该环境门禁结果为准；
   - 方向 B：将该性能验收用例的度量口径（如采样方式 / 剔除公共开销）经正式决策后修订；**不得直接下调阈值**；
   - 方向 C：认可当前 r4 基线在「功能全绿、性能相对阈值不达标」状态下的发布风险并书面裁决。
2. 上述任一方向落地并取得 **471/471** 绿证后，方可继续执行发布包重建、旧包历史标注、冻结件命名清理与状态固化。
