# P0-T3 基线锁定与副本（现行）

## 目标

锁定 P0-T3 阶段交付文件 `v2.0-t3.html` 作为 canonical 工作文件，保留只读的原始基线快照副本与核对记录，确保后续修改可追溯、可对比、可回滚。

## 基线文件（现行）

- **canonical 工作文件**：`6.P0-T3基线/v2.0-t3.html`
  - 唯一权威版本，所有外部脚本 / 文档 / CI 步骤一律引用本路径。
  - 字节 / SHA-256 / 行尾以 [`../1.冻结版本/HEAD.json`](../1.冻结版本/HEAD.json:1) 为唯一真相源，本 README 不硬编码基线数值。
- **原始基线快照副本（只读）**：`baseline/v2.0-t3_baseline_original.html`（775,706 B）
- **核对记录**：`基线核对记录-2026-10-08.md`（记录基线指纹、结构、版本标记、模块清单与核对结论）
- 文件类型：单文件 HTML 应用
- 默认主题：`day`
- 运行形态：浏览器本地单页应用；桌面版可检测 Tauri 并切换 SQLite 存储

## 锁定规则

1. `baseline/` 下文件视为只读基线，不直接修改。
2. 所有改动在 canonical `v2.0-t3.html` 上进行，改后必须逐字节同步 `step9/v2.0-t3.html` 镜像，并记录 diff / 决策。
3. 每次修改前先核对 `基线核对记录-2026-10-08.md` 中的 SHA-256、字节数、行数。
4. canonical 变化须经决策、同步更新 [`verify-hash-registry.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:1) 期望值并复跑转绿；冻结件不得覆盖。
5. 禁止在未记录的情况下覆盖 `baseline/v2.0-t3_baseline_original.html`。

## 目录结构（现行）

| 路径 | 用途 |
|---|---|
| `v2.0-t3.html` | canonical 工作文件（唯一权威版本） |
| `baseline/v2.0-t3_baseline_original.html` | 原始基线只读快照 |
| `基线核对记录-2026-10-08.md` | 基线核对记录（指纹 / 结构 / 结论） |
| `step1`–`step7` / `step9` / `step10` / `structural-sharing` | 阶段演进目录与门禁工程（`step9` 为现行门禁工程） |

## 执行命令（只读核对）

```powershell
Get-FileHash -Algorithm SHA256 "6.P0-T3基线\v2.0-t3.html"
(Get-Item "6.P0-T3基线\v2.0-t3.html").Length
(Get-Item "6.P0-T3基线\baseline\v2.0-t3_baseline_original.html").Length
```

## 验收标准

- `v2.0-t3.html` 与 `baseline/v2.0-t3_baseline_original.html` 均存在。
- `v2.0-t3.html` 与 `step9/v2.0-t3.html` 镜像逐字节一致。
- `基线核对记录-2026-10-08.md` 已填写实测指纹与核对结论。
- `node 6.P0-T3基线\step9\verify-hash-registry.mjs` ⇒ `RESULT=PASS`（`PARTY_COUNT=49` / `FIVE_PARTY_DRIFT_COUNT=0`）。

## 后续步骤

任何修改前先引用本目录基线与 [`../1.冻结版本/HEAD.json`](../1.冻结版本/HEAD.json:1)；修改后按 [`../0.规范/MAINTENANCE.md`](../0.规范/MAINTENANCE.md:1) §3 流程重算登记并复跑门禁。
