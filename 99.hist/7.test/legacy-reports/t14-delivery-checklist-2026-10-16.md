# L14 最终交付清单 · JU 工作台 v2.0（最终交付 · 2026-10-16）

> **版本标识（release id）**：`v2.0-l14-2026-10-16`
> **发布基线（canonical）**：[`6.P0-L3基线\v2.0-l3.html.html`](../../6.P0-L3基线/v2.0-l3.html.html:1) = **1,020,617 B / LF / `1DB17C7E3F71F78B1D1788EFACBABA2C46400EBA4E3AC149046DACA19102E3B0`**
> **性质**：**正式上线收尾（最终交付）**（路径 B · S6）。**未改产品代码字节（canonical 零变更）/ 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）。
> **配套收尾报告**：[`l14-online-release-closure-2026-10-16.md`](../../6.P0-L3基线/step9/reports/l14-online-release-closure-2026-10-16.md:1)。

---

## 一、交付物总览

| # | 交付物 | 路径 | 版本 / 标识 | 说明 |
|---|---|---|---|---|
| 1 | **发布包（产物）** | `8.发布与CI\release\v2.0-l14-2026-10-16\ju-workbench-v2.0-l14.html` | `v2.0-l14-2026-10-16` | 对外交付的正式产品 HTML（= canonical 逐字节副本） |
| 2 | 发布清单 | `…\release\v2.0-l14-2026-10-16\release-manifest.json` | — | 机器可读发布清单（逐件 字节 + SHA-256 + 行尾 + 四方一致声明） |
| 3 | 校验清单 | `…\release\v2.0-l14-2026-10-16\checksums.sha256` | — | 全包逐件校验（排除自身） |
| 4 | 发布说明 | `…\release\v2.0-l14-2026-10-16\RELEASE-NOTES.md` | — | 发布内容 / 校验 / 门禁 / 承前说明 |
| 5 | **CI 门禁** | `8.发布与CI\ci\ci-gate.yml` | L14 口径 | 三段只读门禁（43 方 / Node 145 + PW 171 + bench 7 / `-Wave l14`） |
| 6 | 交付清单（本件） | `8.发布与CI\reports\l14-delivery-checklist-2026-10-16.md` | — | 交付物、哈希锚点与核验说明 |
| 7 | 收尾报告 | `6.P0-L3基线\step9\reports\l14-online-release-closure-2026-10-16.md` | — | 交付物核验 / CI 状态 / 最终哈希锚点 / 上线结论 |

---

## 二、发布包逐件（哈希锚点）

| # | 文件 | 字节 | EOL | SHA-256 |
|---|---|---|---|---|
| 1 | `ju-workbench-v2.0-l14.html` | 1,020,617 | LF | `1DB17C7E3F71F78B1D1788EFACBABA2C46400EBA4E3AC149046DACA19102E3B0` |
| 2 | `release-manifest.json` | 4,044 | LF | `B05CDD34A2AE143220BE0E7F8C6549639A613BB9721F6D885C7D1744DC3D39E2` |
| 3 | `checksums.sha256` | 315 | LF | `70EAABBA05BB94563B2E4B18F074DDC8B846DA5EC00BA89FD3AFDE7A0853E6E6` |
| 4 | `RELEASE-NOTES.md` | 3,124 | LF | `2FD4CEA646AD97252354A80CE1D58E947FA63533C23F2C1F697C5721264891BB` |
| — | **合计** | **1,028,100** | LF | — |

---

## 三、关键哈希锚点（基线台账）

| 物 | 字节 | EOL | SHA-256（前 16） | 角色 |
|---|---|---|---|---|
| canonical | 1,020,617 | LF | `1DB17C7E3F71F78B` | 被守护基准 |
| step9 镜像 | 1,020,617 | LF | `1DB17C7E3F71F78B` | = canonical（`BYTE_IDENTICAL=True`） |
| 发布产物（L14） | 1,020,617 | LF | `1DB17C7E3F71F78B` | = canonical（四方一致） |
| `frozen-l14` | 1,012,003 | LF | `D110699F19D5A9C7` | **历史只读锚**（不参与四方判定 · 零变更） |
| `frozen-l13` | 991,316 | LF | `21BECFD43D330913` | 历史只读锚（前代） |
| `verify.js` | 12,352 | LF | `F7495A19615559F7` | 门禁（现行） |
| `l9-hash-check.mjs` | 12,408 | CRLF | `CF1D0DAD16BAD209` | 43 方登记器 |
| `ci-gate.yml` | 3,281 | CRLF | `86CFAA161424E4CB` | CI 门禁（L14 口径） |

> **四方一致**：`FOUR_WAY_IDENTICAL=true`（canonical / step9 镜像 / 发布产物 / 包内校验记录 = **1,020,617 / `1DB17C7E…102E3B0` / LF**）。

---

## 四、核验步骤（只读）

```powershell
# ① 发布包逐件自校验（于发布包目录内执行）
Get-Content "checksums.sha256" | ForEach-Object {
  $len,$hash,$eol,$path = $_ -split "\s+",4
  $f = Get-Item -Path $path
  $h = (Get-FileHash -Algorithm SHA256 -Path $path).Hash
  "{0}  bytes={1}/{2}" -f (($f.Length -eq [int]$len) -and ($h -eq $hash)), $f.Length, $len
}

# ② 发布门禁（只读）
. "8.发布与CI\ci\env.example.ps1"
cd "6.P0-L3基线\step9"
node l9\l9-hash-check.mjs                                                          # 43 方 / drift 0
node scripts\verify.js all                                                         # 静态 0 + Node 145 + PW 171 + bench 7
powershell -ExecutionPolicy Bypass -File scripts\_w5freeze.ps1 -Wave l14 -NoFreeze  # FROZEN_DRIFT_COUNT=0
```

---

## 五、核验结论（本波实测）

| 核验项 | 结果 |
|---|---|
| 发布产物 ⇄ canonical 逐字节一致 | ✅ **TRUE** |
| `FOUR_WAY_IDENTICAL` | ✅ **TRUE**（1,020,617 / `1DB17C7E…102E3B0` / LF） |
| `CHECKSUMS_DRIFT_COUNT`（新包自校验） | ✅ **0** |
| `OLD_RELEASE_UNTOUCHED_DRIFT_COUNT`（L13 / L12 未覆盖） | ✅ **0** |
| 登记器（43 方） | ✅ **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`** |
| 冻结门 `_w5freeze.ps1 -Wave l14` | ✅ `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS`（`THREE_PARTY_IDENTICAL=DECOUPLED` 历史锚） |
| 字节冻结 `_w4freeze.ps1 -Wave l14` | ✅ `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS` |
| 路径隔离 `_w4paths.ps1 -Wave l14` | ✅ `CANARY_ARTIFACTS=118` / `VIOLATION_COUNT=0` / `RESULT=PASS` |
| 全量回归 `verify.js all`（本波复跑） | ✅ `[verify] 全部通过`（exit 0）：静态 0 + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** |

---

> **交付结论**：**正式上线收尾完成；L4~L14 全线闭环；项目进入交付 / 维护阶段**。以 `release\v2.0-l14-2026-10-16\` 为正式发布物；后续变更须经裁决并全量重算登记（铁律 4）。
