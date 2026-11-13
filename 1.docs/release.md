# 8.发布与CI — 正式上线路径（路径 B · S1→S5）

> **性质**：**非产品目录**（发布链工装 / 文档）。本目录**不含任何产品代码**，
> **不触及** canonical / `step9` 镜像 / `1.历史归档\1.1冻结版本\` 任何冻结件。
> **依据**：Project-Closure-2026-10-15 §6.3（正式上线路径 S1→S5）；
> [`CURRENT_TASK.md`](../2.项目日志/CURRENT_TASK.md:1) §二（路径 B）。
> **红线（铁律 4）**：本路径（S1~S6）**未改 canonical / 未覆盖任何冻结件 / 未重复归档**。
> **封存 HEAD 指针**：[`1.历史归档/1.1冻结版本/HEAD.json`](../1.历史归档/1.1冻结版本/HEAD.json:1)
> （指向 `v2.0-l13-frozen-l22-final-r5-2026-10-20`，1,212,364 B / `FE04CC1A…7C1D5` / LF，为历史冻结锚）。
> **现行 canonical（2026-10-29 实测 · 登记器口径）**：`6.P0-T3基线/v2.0-t3.html`，
> **1,316,707 B / `5FED0215…BFF818` / LF**，与 step9 镜像、`m07-vite/public` 副本三方逐字节一致。
> （历史留痕：S1~S5 期间依次为 `983,460 / CFCD67DA…FC34`（L12）→ `991,316 / 21BECFD4…`（L13）
> → `1,020,617 / 1DB17C7E…`（L14）→ `1,086,613 / 015C0DC9…`（L15）→ `1,174,919 / 0B4AA2A6…5A3C`（r4）
> → `1,212,364 / FE04CC1A…7C1D5`（r22）。）

## 目录结构

| 路径 | 内容 | 阶段 |
|---|---|---|
| [`ci/env.example.ps1`](ci/env.example.ps1:1) | Windows 可复现环境注入（`JU_NODE_DIR` / `JU_CHROMIUM_PATH`） | S1（OP-12） |
| [`ci/env.example.sh`](ci/env.example.sh:1) | POSIX 同义注入（异机 / CI runner） | S1（OP-12） |
| [`../.github/workflows/ci-gate.yml`](../.github/workflows/ci-gate.yml:1) | **CI 门禁定义（现行位置 · GitHub Actions 从此加载）** | S2 |
| [`ci/ci-gate.yml`](ci/ci-gate.yml:1) | 同内容历史副本（已迁移说明 · **不会被平台执行**） | S2 |
| [`../1.历史归档/1.3封存/reports/s1-op12-closure-2026-10-16.md`](../1.历史归档/1.3封存/reports/s1-op12-closure-2026-10-16.md:1) | S1 · OP-12 关闭报告 | S1 |
| [`../1.历史归档/1.3封存/reports/s2-ci-gate-2026-10-16.md`](../1.历史归档/1.3封存/reports/s2-ci-gate-2026-10-16.md:1) | S2 · CI 门禁报告 | S2 |
| [`../1.历史归档/1.3封存/reports/s3-outofrepo-closure-2026-10-16.md`](../1.历史归档/1.3封存/reports/s3-outofrepo-closure-2026-10-16.md:1) | S3 · 仓外项关闭报告（OP-1） | S3 |
| [`../1.历史归档/1.3封存/release/v2.0-t15-2026-10-16/`](../1.历史归档/1.3封存/release/v2.0-t15-2026-10-16/RELEASE-NOTES.md:1) | S4~S6 · 历史发布包（`archived: true` · 已被 r4 取代） | S4 |
| [`../1.历史归档/1.3封存/reports/s4-release-freeze-2026-10-16.md`](../1.历史归档/1.3封存/reports/s4-release-freeze-2026-10-16.md:1) | S4 · 发布包冻结报告 | S4 |
| [`../1.历史归档/1.3封存/reports/s4s5-closure-2026-10-16.md`](../1.历史归档/1.3封存/reports/s4s5-closure-2026-10-16.md:1) | S4~S5 · 收口复跑 + 一致性报告 | S4~S5 |
| [`release/v2.0-t22-r4-2026-10-18/`](release/v2.0-t22-r4-2026-10-18/RELEASE-NOTES.md:1) | **现行交付发布包**（产物 + `checksums.sha256` · BAD=0） | 现行 |
| [`../1.历史归档/1.3封存/reports/t22-closure-2026-10-17.md`](../1.历史归档/1.3封存/reports/t22-closure-2026-10-17.md:1) | T22 收口报告 | 现行 |
| [`../1.历史归档/1.3封存/reports/t22-batch4-2026-10-18.md`](../1.历史归档/1.3封存/reports/t22-batch4-2026-10-18.md:1) | T22 批次 4 报告（r4 基线来源波） | 现行 |

> 历史发布包：`v2.0-t12` / `v2.0-t13` / `v2.0-t14` / `v2.0-t15` 均按历史包保留于 `release/`（各 5 件，未被覆盖）。
> 注意：`v2.0-t15` 包内的 `checksums.sha256` 在归档后发生改写（见
> [`release/v2.0-t15-2026-10-16/ERRATA.md`](release/v2.0-t15-2026-10-16/ERRATA.md:1)），
> 以 [`90过程材料/_报告与元数据/ARCHIVE-INDEX.md`](../90过程材料/_报告与元数据/ARCHIVE-INDEX.md:1) 为准。

## 阶段状态（发布链闭环）

| 步 | 动作 | 状态 |
|---|---|---|
| S1 | 关闭 OP-12（环境可移植性 · 固化两变量注入） | ✅ 完成 |
| S2 | 建 CI 门禁（`verify:all` + **49 方** registrar + 冻结门） | ✅ 完成 |
| S3 | 关闭仓外项（Rust/Tauri 基座 K-1 · OP-1 仓外移交） | ✅ 完成 |
| S4 | 发布包冻结（`release/v2.0-t15-2026-10-16` · 发布标识替代 `git tag`） | ✅ 完成 |
| S5 | 上线前最终收口复跑（**49 方** + 冻结门只读 + `verify:all` · 四方一致） | ✅ 完成 |
| S6 | 正式上线收尾（发布包世代递进 + CI 门禁复核 + 遗留 HASH-DRIFT 消除） | ✅ 完成 |
| 现行 | r4 基线发布包 `release/v2.0-t22-r4-2026-10-18`（HEAD = 1,174,919 / `0B4AA2A6…`） | ✅ 有效 |

## 本地等价门禁（Windows 参考工作站）

```powershell
. "8.发布与CI\ci\env.example.ps1"              # 注入 JU_NODE_DIR / JU_CHROMIUM_PATH（OP-12）
cd "6.P0-T3基线\step9"
node verify-hash-registry.mjs                  # 49 方 / drift 0 / PASS
node scripts\verify.js all                     # 静态 0 + Node 471 + PW 171 + bench 7
powershell -ExecutionPolicy Bypass -File scripts\_w5freeze.ps1 -Wave l15 -NoFreeze
```

> `-NoFreeze` 使冻结门**只读**，CI / 复跑**永不写入**冻结件。
> 登记器方数以 `verify-hash-registry.mjs` 实际输出为准（2026-10-29 实测 `PARTY_COUNT=66` / `drift=0`）；
> 门禁口径：Node 471 + PW 171 + bench 7/7（历史口径 Node 145 已作废）。

## 同日重打包（ISSUE-005 · `JU_RELEASE_OVERWRITE`）

`prepare-release.mjs` 默认拒绝已存在的归档目录（`release/<版本>/`）。同日重打包时显式设该变量，
旧目录**整体改名让位、不删除不覆盖**，随后按常规流程产出新包：

```powershell
$env:JU_RELEASE_OVERWRITE = '1'
node '6.P0-T3基线\m07-vite\scripts\build-all.mjs'   # 连续两次均以「✓ 一键发版链路完成」收尾
```

- 让位目录名：`v<版本>-<日期>.prev-<UTCms>`，与正式归档目录同级。
- `build-all.mjs` 产物清单、`check-release-parity.mjs` 的「最新归档」判定均按名排除 `.prev-*`。
- 未设该变量时链路仍在发布归档步骤中止（Exit 1），提示中会给出变量名。

## CI 首跑（2026-11-13 · 已出绿）

`.github/workflows/ci-gate.yml` 首次完整通过，作为「门禁可在干净环境复现」的硬证据留存。

| 项 | 值 |
|---|---|
| workflow | `ju-ci-gate`（job `verify + registrar`） |
| run ID | `43363821905` |
| job ID | `131683374035` |
| 提交 | `c48fff8` |
| 运行环境 | `windows-latest` · Node 22 |
| 耗时 | 2m39s |
| 结论 | **success**（24 个步骤全绿） |
| 链接 | https://github.com/amy957/ju-archive/actions/runs/43363821905 |

覆盖内容：dist/web/release 三项 parity（`--ci-mode`）· spec-registration · deps-wired ·
inline-style · no-fixed-sleep · css-tokens · package-scripts · security · Registrar（PARTY_COUNT=63 / drift=0）·
**Regression · spec**（lint + Node 503 + Playwright 171 + invariants）· **Regression · bench**（7 项）·
check-manifest · 二次 parity 与 release parity。

使 CI 可绿的关键修复（均为「只有本地能过」的隐性依赖）：

1. `npm ci` / chromium 安装 / Registrar / verify 缺 `working-directory`（根目录无 package.json）。
2. 源码指纹直接哈希原始字节，受行尾影响 → 改为 CRLF→LF 归一（`3a0532e1…`）。
3. `.gitattributes` 统一 `eol=lf`，登记表按 LF 口径重冻结；退役 1 条指向 `_quarantine/` 的条目（64→63）。
4. `check-inline-style` 干净检出无 `dist` → `--ci-mode` 降级。
5. `gen-open-issues` 无 `dist` 时回落到归档 Web 哈希。
6. 55+ 个门禁用例仍引用重组前路径（`3.code/v2.0-t3.html`、`1.历史归档/…`）→ 全部指向
   `3.code/canonical/v2.0-t3.html` 与 `99.hist/6.dev/frozen/`。
