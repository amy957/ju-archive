# L15 正式发布 · 最终交付清单（v2.0-l15 · 2026-10-16）

> **版本标识（release id）**：`v2.0-l15-2026-10-16`
> **发布基线（canonical）**：[`6.P0-L3基线\v2.0-l3.html.html`](../../6.P0-L3基线/v2.0-l3.html.html:1) = **1,086,613 B / LF / `015C0DC9589FD410ABF4152CB2669A15A21DB22481236BC8A78DC39AD6E3BB5E`**
> **发布包**：[`8.发布与CI\release\v2.0-l15-2026-10-16\`](../release/v2.0-l15-2026-10-16/RELEASE-NOTES.md:1)（**4 件 / 1,095,221 B**）
> **性质**：**正式发布收尾（S7）**。**未改产品代码字节（canonical 零变更）/ 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）。

---

## 一、交付物清单

| # | 交付物 | 路径 | 版本 | 说明 |
|---|---|---|---|---|
| 1 | 发布包目录 | `8.发布与CI\release\v2.0-l15-2026-10-16\` | `v2.0-l15` | 4 件 / 1,095,221 B（新建目录，未覆盖前代） |
| 2 | 发布产物 | `…\ju-workbench-v2.0-l15.html` | `v2.0-l15` | **1,086,613 / LF / `015C0DC9…E3BB5E`**（= canonical 逐字节副本） |
| 3 | 发布清单 | `…\release-manifest.json` | `v2.0-l15` | 4,115 / LF / `56A6B633…C7928E97` |
| 4 | 校验清单 | `…\checksums.sha256` | `v2.0-l15` | 315 / LF / `987E8742…349ABC`（全包逐件，排除自身） |
| 5 | 发布说明 | `…\RELEASE-NOTES.md` | `v2.0-l15` | 4,178 / LF / `A0A0FA53…FD19F989` |
| 6 | CI 门禁 | `8.发布与CI\ci\ci-gate.yml` | L15 口径 | 3,325 / CRLF / `8814D5FE…257E0D32`（43 方 / Node 145 + PW 171 + bench 7 / `-Wave l15`） |
| 7 | 交付清单（本件） | `8.发布与CI\reports\l15-delivery-checklist-2026-10-16.md` | — | 交付物、哈希锚点与核验说明 |
| 8 | 上线收尾报告 | `8.发布与CI\reports\l15-online-release-closure-2026-10-16.md` | — | 交付物核验 / CI 状态 / 最终锚点 / 上线结论 |
| 9 | 冻结门证据 | `8.发布与CI\reports\_l15release-w5freeze-2026-10-16.txt` | — | Stage ③ 只读冻结门（`FROZEN_DRIFT_COUNT=0`） |
| 10 | 全量回归证据 | `8.发布与CI\reports\_l15release-verify-all-2026-10-16.txt` | — | Stage ② `verify.js all` 输出（exit 0） |

---

## 二、发布包逐件（字节 / EOL / SHA-256）

| 文件 | 字节 | EOL | SHA-256 |
|---|---|---|---|
| `ju-workbench-v2.0-l15.html` | 1,086,613 | LF | `015C0DC9589FD410ABF4152CB2669A15A21DB22481236BC8A78DC39AD6E3BB5E` |
| `RELEASE-NOTES.md` | 4,178 | LF | `A0A0FA534DB74E69089169EF5652CF3CE5A2E8583F8C4B18D1940D03FD19F989` |
| `release-manifest.json` | 4,115 | LF | `56A6B63389C8383B958948497211CC69A23A66691473826B7078A869C7928E97` |
| `checksums.sha256` | 315 | LF | `987E87422E4EEF9DA46C5E880572CE4D09F9F9571FAC5303F828CD4B67349ABC` |

> **包内自校验**：`CHECKSUMS_DRIFT_COUNT=0`（`checksums.sha256` 逐件回读一致）；发布产物 = canonical = step9 镜像 **逐字节一致** ⇒ **`FOUR_WAY_IDENTICAL=true`**。

---

## 三、哈希锚点（实测）

| 物 | 路径 | 字节 | EOL | SHA-256 | 角色 |
|---|---|---|---|---|---|
| canonical | `6.P0-L3基线/v2.0-l3.html.html` | 1,086,613 | LF | `015C0DC9589FD410ABF4152CB2669A15A21DB22481236BC8A78DC39AD6E3BB5E` | 被守护基准 |
| step9 镜像 | `6.P0-L3基线/step9/v2.0-l3.html.html` | 1,086,613 | LF | `015C0DC9…E3BB5E` | = canonical（`BYTE_IDENTICAL=True`） |
| 发布产物（L15） | `…\release\v2.0-l15-2026-10-16\ju-workbench-v2.0-l15.html` | 1,086,613 | LF | `015C0DC9…E3BB5E` | = canonical（四方一致） |
| `frozen-l14` | `1.冻结版本\v2.0-l3-frozen-l14-2026-10-16.html` | 1,012,003 | LF | `D110699F19D5A9C79350AFC5375E325ED8D49BAAED2BAF1B18E3D9552ED7BBDD` | **历史只读锚**（不参与四方判定 · 零变更） |
| `frozen-l13` | `1.冻结版本\v2.0-l3-frozen-l13-2026-10-16.html` | 991,316 | LF | `21BECFD43D330913545DFAA9090B8BB06B0A850D911AC578DCF91A2CEC3AA3CA` | **历史只读锚**（零变更） |
| `verify.js` | `6.P0-L3基线/step9/scripts/verify.js` | 12,352 | LF | `F7495A19615559F7756CAFD273F3355F74C918FDADACA802CCF4EB32EE78D018` | CI 门禁（零变更） |
| `l9-hash-check.mjs` | `6.P0-L3基线/step9/l9/l9-hash-check.mjs` | 13,843 | CRLF | `D0AB9228810A1A1B0C24415195AC4FA155240BDAE3B498B9ECABED8DD117C523` | 43 方登记器（零变更） |

> **产品三方逐字节一致**：canonical = step9 镜像 = 发布产物 = **1,086,613 / LF / `015C0DC9…E3BB5E`**；发布产物另经包内 `checksums.sha256` 自校验一致 ⇒ **`FOUR_WAY_IDENTICAL=true`**。
> **L15 HEAD 未物化冻结件**：本代以 `v2.0-l15` 交付包为唯一发布物（HEAD / FROZ 解耦口径）。

---

## 四、CI 门禁状态（三段 + 附加 · 全绿）

| 段 | 门 | 命令 | 状态 |
|---|---|---|---|
| Stage ① | 43 方登记器 | `node 6.P0-L3基线\step9\l9\l9-hash-check.mjs` | ✅ `PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` |
| Stage ② | 全量回归 | `node 6.P0-L3基线\step9\scripts\verify.js all` | ✅ `[verify] 全部通过`（exit 0）：静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** |
| Stage ③ | 冻结门 | `_w5freeze.ps1 -Wave l15 -NoFreeze` | ✅ `BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS`（`THREE_PARTY_IDENTICAL=PENDING(not-yet-frozen)`） |

> `ci-gate.yml` = **43 方 / Node 145 + PW 171 + bench 7 / `-Wave l15`**（3,325 / CRLF / `8814D5FE…257E0D32`）；**无遗留 HASH-DRIFT**。

---

## 五、红线守持

| 红线 / 铁律 | 判定 |
|---|---|
| **RL-1** 改产品须同步 step9 + 全量重算 | ✅ 本波**未改产品字节**（canonical 1,086,613 零变更）；同步关系维持 |
| **RL-2** 不得覆盖任何冻结件 | ✅ `1.冻结版本\*` 零改动（`FROZEN-OK`）；旧发布包原样保留 |
| **RL-3** 不得重复归档 | ✅ `1.归档快照\*` 零改动；本波为**新建发布包目录**（非归档） |
| **铁律 4** 改 canonical 须同步 step9 + 不覆盖冻结件 | ✅ 未改字节；零覆盖 |
| **铁律 6** 禁「内容由 AI 生成」注释 | ✅ 静态门禁 **0 命中**（`aiNoteLint`）；本波未新增任何 AI 生成注释 |
| **零漂移** | ✅ 登记器 **43 方 / `FIVE_PARTY_DRIFT_COUNT=0` / `PASS`** |

---

## 六、结论

- **交付物**：`v2.0-l15` 正式发布包 **4 件**（1,095,221 B）+ CI 门禁 + 证据（冻结门 / 全量回归）齐备。
- **最终哈希锚点**：canonical = **1,086,613 B / LF / `015C0DC9589FD410ABF4152CB2669A15A21DB22481236BC8A78DC39AD6E3BB5E`**；**`FOUR_WAY_IDENTICAL=true`**；**43 方零漂移**。
- **状态**：CI 三段 + 附加只读门全绿；回归不低于 **Node 145 + PW 171 + bench 7/7**。

---

> 本清单为交付证据（只读）；写入后哈希自指变更，如需再登记以落盘重算为准。
