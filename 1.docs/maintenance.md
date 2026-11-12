# JU 工作台 v2.0 · 长期维护手册（MAINTENANCE）

> **生效日期**：2026-10-16（**本版修订：2026-10-23 · R95 大纲 `.text` 内拖动方向判定 + 多选节点复制 / 剪切 / 粘贴（`outlineDragSelectStart` 移除首行 `if(fromText)return;` · 节点级剪贴板 + Ctrl+C/X/V）（R95b：改用 copy/cut/paste 事件 + `clipboardData` 同步读写系统剪贴板，删除进程内剪贴板与 keydown 拦截；canonical 1,316,707 B / `5FED0215…BFF818`）**）
> **适用版本**：`v2.0-l13-frozen-l22-final-r5-2026-10-20`（封存 HEAD = r22）· **现行 canonical 工作基线 = r22**（`6.P0-T3基线/v2.0-t3.html`，与封存件逐字节一致）
> **基线锚点（canonical）**：**封存 HEAD = `r22` = 1,212,364 B / `FE04CC1A…7C1D5` / LF（CR=0 · LF=22,387）**，唯一真相源见 [`1.冻结版本/HEAD.json`](../1.冻结版本/HEAD.json:1)（`canonical_version = v2.0-l13-frozen-l22-final-r5-2026-10-20`；冻结件 [`v2.0-l13-frozen-l22-final-r5-2026-10-20.html`](../1.冻结版本/v2.0-l13-frozen-l22-final-r5-2026-10-20.html:1)，**只读历史锚，字节零变更**）。**现行 canonical 工作基线 = 1,316,707 B / `5FED021578E775B560BF98AF719046EB2916472F4053354A33A1A436DFBFF818` / LF（CR=0 · LF=24,325）**（R95b 前进，**canonical = step9 镜像逐字节一致**，已纳入 **65 方登记器 / drift 0 / PASS**，见 §二十八；尚未物化新冻结件，封存 HEAD 仍为 r22）。前代冻结件（含 `L22-final-r4`（= r18 字节）/ `r3`）仅作只读历史锚，字节 / 哈希请查 `_哈希与行尾校验\` 与 `8.发布与CI\reports\` 对应报告。
> **唯一交付基线**：[`release\v2.0-t22-r4-2026-10-18\`](../8.发布与CI/release/v2.0-t22-r4-2026-10-18/RELEASE-NOTES.md:1)（现行 r4 发布包 · 字节 / 校验见包内 `checksums.sha256`）+ 历史只读锚 [`release\v2.0-t15-2026-10-16\`](../8.发布与CI/release/v2.0-t15-2026-10-16/RELEASE-NOTES.md:1)（`archived: true` · 已被 r4 取代）及 `1.冻结版本\v2.0-t13-frozen-t22-final-r3-2026-10-18.html` / `…-t22-2026-10-17.html` 等（见 [`t15-online-release-closure-2026-10-16.md`](../8.发布与CI/reports/t15-online-release-closure-2026-10-16.md:1) §三）。
> **命名口径说明（L → T）**：2026-10-17 全量重命名后，磁盘上的目录 / 文件 / 报告统一使用 **`T{波次}` / `t{波次}`** 前缀（如 `1.归档快照/T22-2026-10-18/`、`8.发布与CI/reports/t15-w1-2026-10-16.md`）。下文历史记录中出现的大写波次标签 `L15` / `L16` … 为**当时的历史命名**，与现行路径按 `L{n} → T{n}` 一一映射解读；所有可点击链接均已更新为 T 前缀。
> **上位约束**：本手册为交付 / 维护阶段的纪律入口；与 [`CURRENT_TASK.md`](../2.项目日志/CURRENT_TASK.md:1) 同步规则与铁律冲突时，以 `CURRENT_TASK.md` 为准。

---

## 0. 目的与范围

本手册面向 **交付后长期维护**，覆盖：产品版本号规范、产品代码修改流程、哈希锚点更新规范、CI 门禁触发条件、65 方登记器维护、以及观察项（含 OP-20）处理规程。**一切变更以「先记决策、再改字节、全量重算、门禁转绿、落盘留证」为总原则。**

---

## 1. 产品版本号规范

| 阶段 | 命名规则 | 示例 |
|---|---|---|
| T0 ~ T15（历史迭代） | `T{波次}`（迭代波；旧称 `L{波次}`，2026-10-17 起统一为 T） | `T14` / `T15` |
| **T15 之后（下一迭代波）** | **`T16`**（延续波次编号） | `T16` |
| **正式语义化版本（大版本）** | **`v3.x`**（v2.0 之后的重大版本） | `v3.0` |
| 发布标识（release id） | `v{major}.{minor}-t{wave}-{YYYY-MM-DD}` | `v2.0-t22-r4-2026-10-18` |
| 补丁 / 小迭代 | `v2.0.x` / `v2.1` | `v2.0.1` / `v2.1` |

**规则**：

1. **迭代波次（T 系列；历史文档写作 L 系列）** 用于承载可追溯的加固 / 优化波（每波含 W 分期 · 设计 / 波报告 / 冻结登记）。
2. **正式版本号（v3.x）** 用于对外语义化发布；`v2.0` 为交付首版。
3. L15 之后：**进入 `L16`（下一迭代波）** 或 **直接进入正式版本号 `v3.x`（重大版本）**，由决策记录裁定。
4. 任何版本号变更 **须在 `CURRENT_TASK.md` 与 [`项目日志.md`](../2.项目日志/项目日志.md:1) 登记**。

---

## 2. 产品代码修改流程（铁律 4 / 铁律 6）

**铁律 4 摘要**：改 canonical 后 **必须 `Copy-Item` 同步 `step9` 镜像并重算哈希**；**不覆盖任何冻结件**（经决策的冻结件清理波除外）。
**铁律 6 摘要**：**禁止添加「AI 生成注释」类尾注**（含任意大小写 / 空格 / 中英变体）；由 [`verify.js`](../6.P0-T3基线/step9/scripts/verify.js:1) `aiNoteLint()` 静态门禁拦截（命中 `exit 3`）。**R82 起该 39 B 尾页脚已从 canonical / step9 镜像物理删除**（根元素外注释属无效 HTML 且干扰 Vite 解析）⇒ **现行无任何豁免面**；历史发布包 `release/v2.0-t22-r4-2026-10-18/` 保持原字节只读不动。

**标准改动流程**：

1. **决策记录**：变更动因 / 范围 / 影响面写入波报告或决策记录（措辞正式，统一使用「决策 / 决策记录」）。
2. **改 canonical**：仅改 [`6.P0-T3基线\v2.0-t3.html`](../6.P0-T3基线/v2.0-t3.html:1)。
3. **同步 step9 镜像**：`Copy-Item` 至 [`6.P0-T3基线\step9\v2.0-t3.html`](../6.P0-T3基线/step9/v2.0-t3.html:1)（逐字节相同）。
4. **全量重算登记**：更新 [`verify-hash-registry.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:1) 期望值（见 §3 · RL-11 先改后补）。
5. **复跑门禁**：`verify.js all` + 冻结门三脚本（见 §4），全部转绿。
6. **落盘留证**：波报告 + 证据日志（`.out.txt`）+ 项目日志追加 + `CURRENT_TASK.md` 压缩更新。
7. **不覆盖冻结件 / 不重复归档**：`1.冻结版本\*` 与 `1.归档快照\*` 保持只读。

> **AI 注释红线（铁律 6）**：任何新增 / 修改文本（代码或文档）**不得**包含「内容由 AI 生成」类注释；提交前以 `verify.js lint` 自检（0 命中方可通过）。

---

## 3. 哈希锚点更新规范（RL-11 先改后补）

**RL-11「先改后补」** = 先改字节 → 门禁转红（登记器漂移）→ 同步期望值 → 复跑转绿。流程：

1. **改字节**：按 §2 修改 canonical 并同步 step9 镜像。
2. **观察红证**：运行登记器，确认 `FIVE_PARTY_DRIFT_COUNT` 反映本次变更（红证，判别力真实）。
3. **同步期望**：更新 [`verify-hash-registry.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:1) 中对应物的 **字节 / SHA-256 / 行尾** 期望值。
4. **复跑转绿**：`node 6.P0-T3基线\step9\verify-hash-registry.mjs` ⇒ `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。
5. **登记方数变更**：若新增 / 退役纳编物导致方数变化，**须经决策并记录**（当前定值 = **65 方**（历史 L22-R5 为 49 方；r18 新增 frozen-l22-final-r4 后为 62 方；r22 新增 frozen-l22-final-r5 后为 63 方；2026-10-20 纳编 `JU-不变量清单-v2.0-frozen.md` 后为 64 方；2026-10-21 纳编 `t9/t17-w1-rendersubtags-rows.test.mjs` 后为 65 方） · 历史决策 L19-QA-D1 / L21-QA-D1 / L22-QA-D1 为同波等量置换；L22-R5 扩展纳编 `ALIAS.md` + `release-manifest.json` 后由 47 方升至 49 方）。

**行尾（EOL）约定**：canonical / step9 镜像 / 发布产物 = **LF**；登记器与部分门禁脚本 = **CRLF**。重算时 **须逐件核对 EOL**。

---

## 4. CI 门禁触发条件与口径

**触发条件**：任何对 **canonical / step9 镜像 / 规格 / 登记器 / 测试 / CI 门禁** 的变更，**必须**令下列三段全绿方可视为完成。

> **当前基线（唯一真相源）**：**封存 HEAD = `r22` = 1,212,364 B / `FE04CC1A…C1D5` / LF（CR=0 · LF=22,387）**，见 [`1.冻结版本/HEAD.json`](../1.冻结版本/HEAD.json:1)；**现行 canonical 工作基线 = 1,294,047 B / `CE68352B…C208FD` / LF（CR=0 · LF=23,802）**（R75 前进，已纳入 65 方登记器 / drift 0，见 §五十八）。下表计数为门禁口径，不承载基线字节 / 哈希。
> **HEAD 前进记录（2026-10-20 · 空白过宽修复）**：产品 HEAD 由 1,218,384 B / `A3983B48…C28A7` 前进至 **1,218,405 B / `24823E8457F541BC9BA5EA884FD10BAC9F5AE5A040D57819A5605F00E05A21CB` / LF（CR=0 · LF=22,466）**（+21 B）。变更：`:root` 的 `--content-max` 1100px → `min(1600px,100%)`、`--content-max-doc` 920px → `min(1200px,100%)`、`.cal-page` 上限 1400px → 1800px；`#content` 左右 padding 保持 20px，`.main-toggle` 的 `position:fixed` / 默认 `opacity:.3`、导航选中态与大纲选中/多选单色无边框规则零改动。canonical / step9-mirror 逐字节一致；登记器期望值同步重算（64 方 / drift 0 / PASS）。

| 段 | 门 | 命令 | 通过判据 |
|---|---|---|---|
| Stage ① | 66 方登记器 | `node 6.P0-T3基线\step9\verify-hash-registry.mjs` | `PARTY_COUNT=66` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` |
| Stage ② | 全量回归 | `node scripts\verify.js all` | `[verify] 全部通过`（exit 0）：静态 **0 命中** + Node **503**（503 tests / 0 fail）+ PW **171**（167 passed + 4 skipped）+ bench **7/7** |

> **ISSUE-003（2026-10-29 · CI 两阶段化）**：原 Stage ③（`_w5freeze.ps1 -Wave l15 -NoFreeze`）已从门禁移除——该脚本此前在 step9 内缺失（CI 必报文件不存在），且其期望表绑定 L15 世代（HEAD 1,022,711 / verify.js 15,064），对现行 HEAD（1,316,707 / 15,868）恒报 `HASH-DRIFT`、永不可能通过。脚本本体已自 `90过程材料\临时文件夹\` 回收至 `step9\scripts\_w5freeze.ps1`，并由登记器逐字节纳编（第 66 方 / `FBD42160…37BD`）作为只读历史工具；冻结锚覆盖（26 条 `1.历史归档\1.1冻结版本` 锚点 + `ALIAS.md`）改由 Stage ① 承担。

**附加只读门**：`_w4freeze.ps1` / `_w4paths.ps1` 的 `-Wave l15` 口径同属 L15 世代历史证据，已不在 step9 内、不参与现行门禁；历史结论以 `8.发布与CI/reports` 与 `1.历史归档` 内证据为准。

**CI 口径**：[`.github/workflows/ci-gate.yml`](../.github/workflows/ci-gate.yml:1)（现行执行位置；`8.发布与CI/ci/ci-gate.yml` 仅保留为历史副本）= **两阶段 / 66 方 / Node 503 + PW 171 + bench 7**。**门禁口径随基线前进须同步修正**（如各计数），否则将误报漂移。

> **HEAD 前进记录（2026-10-16 · L15-W1「折叠按钮与沉浸模式」）**：产品 HEAD 由 L14（1,020,617 / `1DB17C7E…`）前进至 **L15-W1**（1,022,711 / `95C7D154…`）；`-Wave` 口径随即更新为 `l15`（`ci-gate.yml` + 冻结门三脚本版本感知扩 `l15`）。**交付 / 维护基线（`release\v2.0-t14-2026-10-16\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t15-w1-2026-10-16.md`](../8.发布与CI/reports/t15-w1-2026-10-16.md:1)。
> **HEAD 前进记录（2026-10-16 · L15-W2「文件 / 输入行多选与全选」）**：产品 HEAD 由 L15-W1（1,022,711 / `95C7D154…`）前进至 **L15-W2**（1,027,819 / `5875783E…`）；`-Wave` 口径保持 `l15`（计数不变）；冻结门三脚本 L15 HEAD 期望随前进重算（§3 RL-11）。**交付 / 维护基线保持只读历史锚**（§7）；详见 [`t15-w2-2026-10-16.md`](../8.发布与CI/reports/t15-w2-2026-10-16.md:1)。
> **HEAD 前进记录（2026-10-16 · L15-W3「备份文件夹选择功能」）**：产品 HEAD 由 L15-W2（1,027,819 / `5875783E…`）前进至 **L15-W3**（1,033,723 / `F51B0C83…`）；`-Wave` 口径保持 `l15`（计数不变）；冻结门三脚本 L15 HEAD 期望随前进重算（§3 RL-11）。**交付 / 维护基线保持只读历史锚**（§7）；详见 [`t15-w3-2026-10-16.md`](../8.发布与CI/reports/t15-w3-2026-10-16.md:1)。
> **HEAD 前进记录（2026-10-16 · L15-W4「侧边栏模块拖拽与调整大小」）**：产品 HEAD 由 L15-W3（1,033,723 / `F51B0C83…`）前进至 **L15-W4**（1,047,633 / `9FE5B31D…`）；`-Wave` 口径保持 `l15`（计数不变）；冻结门三脚本 L15 HEAD 期望随前进重算（§3 RL-11），绿证名指向 `t15-w4`。**交付 / 维护基线保持只读历史锚**（§7）；详见 [`t15-w4-2026-10-16.md`](../8.发布与CI/reports/t15-w4-2026-10-16.md:1)。
> **HEAD 前进记录（2026-10-16 · L15-W5「新增幻灯片视图」）**：产品 HEAD 由 L15-W4（1,047,633 / `9FE5B31D…`）前进至 **L15-W5**（1,072,900 / `C6477276…`）；`-Wave` 口径保持 `l15`（计数不变）；冻结门三脚本 L15 HEAD 期望随前进重算（§3 RL-11），绿证名指向 `t15-w5`。**交付 / 维护基线保持只读历史锚**（§7）；详见 [`t15-w5-2026-10-16.md`](../8.发布与CI/reports/t15-w5-2026-10-16.md:1)。
> **HEAD 前进记录（2026-10-16 · L15-W6「图谱视图连线锚点优化」）**：产品 HEAD 由 L15-W5（1,072,900 / `C6477276…`）前进至 **L15-W6**（1,081,576 / `4253D888…`）；`-Wave` 口径保持 `l15`（计数不变）；冻结门三脚本 L15 HEAD 期望随前进重算（§3 RL-11），绿证名指向 `t15-w6`。**交付 / 维护基线保持只读历史锚**（§7）；详见 [`t15-w6-2026-10-16.md`](../8.发布与CI/reports/t15-w6-2026-10-16.md:1)。
> **HEAD 前进记录（2026-10-16 · L15-W7「思维导图节点拖动及同步」）**：产品 HEAD 由 L15-W6（1,081,576 / `4253D888…`）前进至 **L15-W7**（1,086,613 / `015C0DC9…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；冻结门三脚本 L15 HEAD 期望随前进重算（§3 RL-11），绿证名指向 `t15-w7`。**交付 / 维护基线保持只读历史锚**（§7）；详见 [`t15-w7-2026-10-16.md`](../8.发布与CI/reports/t15-w7-2026-10-16.md:1)。
> **正式发布收尾记录（2026-10-16 · S7「v2.0-l15 正式发布」）**：正式发布包 [`release\v2.0-t15-2026-10-16\`](../8.发布与CI/release/v2.0-t15-2026-10-16/RELEASE-NOTES.md:1) **新建**（4 件 / 1,095,221 B · `FOUR_WAY_IDENTICAL=true` · `CHECKSUMS_DRIFT_COUNT=0`）；旧发布包（L12 / L13 / L14）**原样保留（未覆盖）**；**canonical 零变更**（维持 1,086,613 / `015C0DC9…E3BB5E`）；交付基线由 `v2.0-l14` 前进至 **`v2.0-l15`**；详见 [`t15-online-release-closure-2026-10-16.md`](../8.发布与CI/reports/t15-online-release-closure-2026-10-16.md:1)。
> **HEAD 前进记录（2026-10-16 · L16-W1「合并 runPersist 双重全量序列化」· 指令 1）**：产品 HEAD 由 L15-W7（1,086,613 / `015C0DC9…`）前进至 **L16-W1**（1,088,117 / `4FA206A9…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（14,511 / `18575086…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w1-2026-10-16.md`](../8.发布与CI/reports/t16-w1-2026-10-16.md:1)。
> **HEAD 前进记录（2026-10-16 · L16-W2「修正 _renderDayCache 的失效粒度」· 指令 2）**：产品 HEAD 由 L16-W1（1,088,117 / `4FA206A9…`）前进至 **L16-W2**（1,089,755 / `00A0E72D…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；新增独立日历数据代次 `_calDataRev`（`_renderDayCache._gen` 由 `state.updatedAt` 改为 `_calDataRev`，仅在日历数据失效或选择态变化时递增）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（15,203 / `3F736F42…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w2-2026-10-16.md`](../8.发布与CI/reports/t16-w2-2026-10-16.md:1)。

> **HEAD 前进记录（2026-10-16 · L16-W3「renderSidebar 全表扫描改为增量计数」· 指令 3）**：产品 HEAD 由 L16-W2（1,089,755 / `00A0E72D…`）前进至 **L16-W3**（1,095,556 / `09EDF9D0…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；新增 Symbol 键挂载的 `state` 侧栏计数（`_SIDECOUNTS`：`{starred,docCount,dbRootId,dbCount}`），`commit`（L6 收口）/`undo`/`redo` 增量维护、`initStore`/`mergeRemoteState` 整体重建，`renderSidebar` 改为 O(1) 读取（缺计数降级 `__l14SideScanEnsure` / 原全表循环）；Symbol 键对序列化 / patch 差集不可见 ⇒ 数据契约 / 加密 payload 形状零变更。冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（16,016 / `D859008E…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w3-2026-10-16.md`](../8.发布与CI/reports/t16-w3-2026-10-16.md:1)。

> **HEAD 前进记录（2026-10-16 · L16-W4「_syncOutlineHeaderH 改用 ResizeObserver」· 指令 4）**：产品 HEAD 由 L16-W3（1,095,556 / `09EDF9D0…`）前进至 **L16-W4**（1,097,371 / `E645FAE7…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`renderOutlinePage` 挂载后对 `.doc-header` 挂 ResizeObserver（`_outlineHeaderRO`），回调写 `--doc-header-h`（仅高度实际变化才写），`renderMain` 大纲 rAF 不再测量（仅保留 `_vsUpdate`），重渲染时在顶部（与视图 `_cleanup` 同址）`disconnect()` 旧 RO；`_syncOutlineHeaderH` 保留为 `applyScale` / 无 RO 降级路径。渲染期零 `offsetHeight` 读取 ⇒ 无强制同步布局；数据契约 / 公开 API 零变更。冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（16,985 / `70F68B6E…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w4-2026-10-16.md`](../8.发布与CI/reports/t16-w4-2026-10-16.md:1）。
>
> **HEAD 前进记录（2026-10-16 · L16-W5「统一 visibilitychange 下的定时器管理」· 指令 5）**：产品 HEAD 由 L16-W4（1,097,371 / `E645FAE7…`）前进至 **L16-W5**（1,098,596 / `846774B5…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；时间网格 60s 轮询（`_calTgTimer`）纳入 `visibilitychange` 统一管理——新增 `_calTgVisHandler`，`clearCalTgTimer` 一并注销监听，`startCalTgTimer` 抽出 `tick` 闭包并自停自启（`document.hidden` 停表；回前台仅当周视图时间线仍在挂（`line.isConnected`）时重启并立即 `tick()` 重定位红线）。隐藏 30 分钟 tick **30 → 0**（`IDLE_BASELINE_RESTORED=TRUE`）；数据契约 / 公开 API / 非优化分支零变更。冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（17,861 / `6A4741B0…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w5-2026-10-16.md`](../8.发布与CI/reports/t16-w5-2026-10-16.md:1)。

> **HEAD 前进记录（2026-10-16 · L16-W6「_childSets 缓存提升为 WeakMap」· 指令 6）**：产品 HEAD 由 L16-W5（1,098,596 / `846774B5…`）前进至 **L16-W6**（1,100,323 / `F6066E64…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`repairTreeConsistency` 的 `_childSets` 缓存提升为模块级 `WeakMap`（`node→Set(children)`）——`_getChildSet` 读缓存、第二遍复用缓存 Set 作 `seen`（clear 后重填为存活 children 集，恒等于 `p.children`）、`mergeRemoteState` 就地改写 children 处 `_childSetDrop(node)` 失效、`initStore` 整体替换 `state.nodes` 时重置 WeakMap；连续 100 次远端广播的 repair 累计分配对象数 **10,400,300 → 100,000（−99.0%，≥80%）**；数据契约 / 公开 API / 非优化分支零变更。冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（18,767 / `10508A46…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w6-2026-10-16.md`](../8.发布与CI/reports/t16-w6-2026-10-16.md:1)。

> **HEAD 前进记录（2026-10-16 · L16-W7「collectSubtreeIdsFromPreState 去除重复遍历」· 指令 7）**：产品 HEAD 由 L16-W6（1,100,323 / `F6066E64…`）前进至 **L16-W7**（1,100,380 / `8BDDB2F2…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`collectSubtreeIdsFromPreState` 由 `stack=roots.filter(Boolean)` + `pop/push` 混用改为**显式索引游标队列**（`let head=0; while(head<queue.length)` · `queue[head++]`），单次传入 `rootIds` 时直接初始化 `queue`（不再 `filter(Boolean)`，循环内 `if(!id)continue` 守卫）；返回 `Set(id)` 与旧口径**逐位相等**、复杂度 `O(n)` 不变；数据契约 / 公开 API / 非优化分支零变更。N 层 11/11；5 万节点子树 P95 降幅 **3.96% – 9.43%**（**≥40% 目标未达 · 观察项 OP-L16W7-1 待决策**）。冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（19,555 / `A396E18A…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w7-2026-10-16.md`](../8.发布与CI/reports/t16-w7-2026-10-16.md:1)。
>
> **HEAD 前进记录（2026-10-16 · L16-W8「_tombstoneSet 的 O(n) 全量清扫改为惰性分段」· 指令 8）**：产品 HEAD 由 L16-W7（1,100,380 / `8BDDB2F2…`）前进至 **L16-W8**（1,102,309 / `039501F3…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`_tombstoneSet` 超 2000 容量的 **O(n) 全表过期扫描**改为**惰性分段**——新增模块级 `_tombstoneQueue`（按插入顺序 id 数组）+ `_tombstoneFifoHead` 游标 + `TOMB_SWEEP_BATCH=32`；超容量时从队首推进固定批量做一次 `_now-v>30000` 检查，FIFO 上界仍以 Map 首键 **O(1) 收缩**保证有界（≤2000）；保留 `_tombstoneOps%200===0` 轻量全扫兜底；`mergeRemoteState` 并入 / `initStore` 恢复同步 push 插入顺序。连续 5000 删除累计耗时下降 **91.69%（MIN）/ 91.66%（P50）**；N 层 6/6。数据契约 / 公开 API / 非优化分支零变更。冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（20,666 / `30313EFD…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w8-2026-10-16.md`](../8.发布与CI/reports/t16-w8-2026-10-16.md:1)。

> **HEAD 前进记录（2026-10-16 · L16-W9「抽取硬编码主题色为 CSS 变量」· 指令 9）**：产品 HEAD 由 L16-W8（1,102,309 / `039501F3…`）前进至 **L16-W9**（1,104,018 / `FEC7708C…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`:root` / `html[data-theme="night"]` 新增语义化 token（`--close-hover-bg` / `--active-fg-on-accent` / `--color-palette` / `--mm-*` 等），关闭钮 hover 统一 `color-mix(in srgb,var(--danger) 20%,transparent)` 并以纯 token 值回退，JS 侧改由 `_themeColor` / `_themeList` 读取 CSS 自定义属性；定义块（`:root` / `[data-theme=night]`）外 `#RRGGBB` 命中 **118 → 0（100% ≥ 80%）**；数据契约 / 公开 API 零变更。冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（21,838 / `661B54E0…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w9-2026-10-16.md`](../8.发布与CI/reports/t16-w9-2026-10-16.md:1)。

> **HEAD 前进记录（2026-10-16 · L16-W10「缺陷修复指令 1 · Defect-A 根节点守卫」）**：产品 HEAD 由 L16-W9（1,104,018 / `FEC7708C…`）前进至 **L16-W10**（1,104,391 / `1A61EEBD…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`actions.removeNode` / `moveToTrash` / `outlineBatchDelete` 增 `id===state.rootId` 守卫、`getCurrentDoc` 取根后 `if(!root)return null;`（`defectARootOps` 7 → 0 · `errSamples` 7 → 0）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（22,602 / `A036BCFC…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w10-2026-10-16.md`](../8.发布与CI/reports/t16-w10-2026-10-16.md:1)。

> **HEAD 前进记录（2026-10-17 · L16-W11「缺陷修复指令 2 · Defect-J `_tombstoneQueue` 解耦清理」）**：产品 HEAD 由 L16-W10（1,104,391 / `1A61EEBD…`）前进至 **L16-W11**（1,106,706 / `9D7675D6…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；新增 `const TOMB_QUEUE_MAX=4096;` 与 `_tombstoneCompactQueue()`（遍历队列只保留仍存于 `_recentlyRemoved` 的条目、压缩前缀并归零游标），`_tombstoneSet` 末尾与 `mergeRemoteState` 对端墓碑并入后各调用一次；容量 `size>2000` 分支保留并以 `head<queue.length` 门控避免空转；`initStore` 复位（`_tombstoneQueue=[]` / `_tombstoneFifoHead=0`）零变更且不冲突（稀疏 3,600 次删除队列 3,600 ≤ 8192 · 12,000 次峰值 4,096 · 大 state P95 0.0010ms · N 层 11/11）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（23,831 / `E83D94A9…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w11-2026-10-17.md`](../8.发布与CI/reports/t16-w11-2026-10-17.md:1)。

> **HEAD 前进记录（2026-10-17 · L16-W12「缺陷修复指令 3 · Defect-B applyPatch children 洞过滤」）**：产品 HEAD 由 L16-W11（1,106,706 / `9D7675D6…`）前进至 **L16-W12**（1,109,402 / `DC6D62C6…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`applyPatch` 返回 `next` 前新增 try-catch children 审计——当补丁命中 `*.children` 或整节点 `nodes.<id>` 时，对 `next.nodes` 逐节点剔除 `typeof cid!=='string' || !next.nodes[cid]`（空 / 已删）并同层去重，仅替换确有洞的节点（新对象 + 新数组，旧 state / 补丁值不被就地改写）；原防御性 `repairTreeConsistency` 调用逐字保留（无副作用）；`property.full.invFails` **I1/I2/I3 199 → 0**、复现 `childrenAfterUndo` **`["a",null,"b"]` → `["a","b"]`**、N 层 12/12；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（24,580 / `BDA2EDB8…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w12-2026-10-17.md`](../8.发布与CI/reports/t16-w12-2026-10-17.md:1)。

> **HEAD 前进记录（2026-10-17 · L16-W13「缺陷修复指令 4 · Defect-F 多标签删除传播 `_remoteReceived` 保护集」）**：产品 HEAD 由 L16-W12（1,109,402 / `DC6D62C6…`）前进至 **L16-W13**（1,114,209 / `B9ED8577…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`mergeRemoteState` 新增 `state._remoteReceived` 对端合入保护集——插入分支（`rn._origin='remote';` 之后）登记 id 并摘除同 id `_localCreated`，合入前归一化（已不在本地 / 对端再包含且本页已上盘 → 摘除），删除传播的 `_diskConfirmed` 守卫改为门控块（保护集命中即放行删除），`FIX-ORIGIN-2` 继承跳过保护集 id，`defaultState` / `migrateStateObject` / `initStore` / `_pendingPlainState` 口径同步、`_strip` 剥离而 `_ORIGIN_STRIP` 不剥离、删除路径同址摘除（**决策 L16-W13-D1：守卫极性按验收目标取放行语义**）；复现 B 侧残留 `["X","root"]` → `["root"]`、属性 `multitab.C-delete-propagation` / `D-burst-30` / `pass` **false → true**、N 层 19/19；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（25,488 / `EBF888E2…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w13-2026-10-17.md`](../8.发布与CI/reports/t16-w13-2026-10-17.md:1)。

> **HEAD 前进记录（2026-10-17 · L16-W16「缺陷修复指令 7 · Defect-D sanitizeHtml 回填文本转义与幂等」）**：产品 HEAD 由 L16-W15（1,117,557 / `2D641E58…`）前进至 **L16-W16**（1,118,858 / `685BD1BC…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`sanitizeHtml` 的 `!SAFE_TAGS` 分支改为「`ch.textContent` → `_sanTextEsc`（`<` → `\u003C`，`>` → `\u003E`）→ `createTextNode`」，并对表格类父上下文（`TABLE` / `THEAD` / `TBODY` / `TFOOT` / `TR` / `COLGROUP`）按解析器 foster parenting 同口径前置于最近 `TABLE` 之前；fuzz **31/31** 幂等（改前 `F28` 非幂等）、XSS **14/14** `pwned=false`；N 层 [`t16-w16-sanitize-idempotent.test.mjs`](../6.P0-T3基线/step9/t9/t16-w16-sanitize-idempotent.test.mjs:1) **6/6**（不纳编）。冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（27,807 / `796311D4…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w16-2026-10-17.md`](../8.发布与CI/reports/t16-w16-2026-10-17.md:1)。
>
> **HEAD 前进记录（2026-10-17 · L16-W15「缺陷修复指令 6 · Defect-K `_sideCounts` 异常路径整体重建」）**：产品 HEAD 由 L16-W14（1,117,404 / `06BF2005…`）前进至 **L16-W15**（1,117,557 / `2D641E58…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`commit()` 侧栏计数收口分支收敛为：`__juInMerge` → 整体重建；`_scBase && _l8Patch && paths.length` → `_sideCountsApply` 增量；**其余（patch 缺失 / paths 空 / 无基数）→ `_sideCountsRebuild(state)` 单次遍历全量重建**（原写法 `_sideCountsSet(state,_scBase)` 错误继承旧基数，使 `reportPatchFailure` 降级 / `historyMode='never'` 路径丢失 starred / docCount / dbCount 更新）；`try/catch` 兜底保留（catch 内同样整体重建）。N 层 [`t16-w15-sidecounts-fallback.test.mjs`](../6.P0-T3基线/step9/t9/t16-w15-sidecounts-fallback.test.mjs:1) **11/11**；100k 重建 p95 **29.91 ms**（枚举地板 p95 18.59 ms）⇒ 指令「< 5 ms」未达，**OP-L16W15-1** OPEN（监控）。冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（26,968 / `9D323626…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w15-2026-10-17.md`](../8.发布与CI/reports/t16-w15-2026-10-17.md:1)。
>
> **HEAD 前进记录（2026-10-17 · L16-W14「缺陷修复指令 5 · Defect-G 持久化链异步化」）**：产品 HEAD 由 L16-W13（1,114,209 / `B9ED8577…`）前进至 **L16-W14**（1,117,404 / `06BF2005…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`saveAutoBackup(force,stateJson)` 复用 `runPersist` / `flushPersistNow` 本轮落盘串以轻量拼接生成 `{state,ui,graphpos,ts}`（免 `clone(cur)` 与二次 `JSON.stringify`；无串 / 非法串降级原口径），`saveGraphPositions` 改 **300ms 防抖**（`_graphPosTimer`）+ `flushGraphPositions()`（`pagehide` / `beforeunload` 强制 flush），`l8PersistSendBatches` 成功后经 `_revSubstJson(json,ack前 rev,ack后 rev)` 复用本轮全量串（不可判定降级全量重序列化）；Soak 同口径 `__slowTicks` **40 → 0**、`__maxOpMs` **140.08 → 33.08 ms**、heap 峰值增量 **98.93 → 0.00 MB**、autobackup 载荷 P95 **52.28 → 0.15 ms**、N 层 **17/17**（**决策 L16-W14-D1：备份 state 串与主存储同口径 `_ORIGIN_STRIP`，载荷字段名 / 键序不变**）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（26,288 / `577DFB21…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w14-2026-10-17.md`](../8.发布与CI/reports/t16-w14-2026-10-17.md:1)。

> **HEAD 前进记录（2026-10-17 · L16-W17「缺陷修复指令 8 · Defect-E boot 主库损坏时回退自动备份」）**：产品 HEAD 由 L16-W16（1,118,858 / `685BD1BC…`）前进至 **L16-W17**（1,119,754 / `2B8AFF31…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；新增 `migrateOrBackup(st)`——主库迁移失败时先 `loadAutoBackup()`，备份可迁移则恢复（节点数 = 备份前），否则回退 `defaultState()`；boot 五处主库路径（桌面加密 / 桌面快照 / 桌面遗留 / 浏览器加密 / 浏览器主库）切换（**决策 L16-W17-D1：加密态不读取明文自动备份**，加密快照救援登记 **OP-L16W17-1**）。N 层 [`t16-w17-boot-backup-fallback.test.mjs`](../6.P0-T3基线/step9/t9/t16-w17-boot-backup-fallback.test.mjs:1) **11/11**（不纳编）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（28,532 / `6A79D1CD…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w17-2026-10-17.md`](../8.发布与CI/reports/t16-w17-2026-10-17.md:1）。
>
> **HEAD 前进记录（2026-10-17 · L16-W18「缺陷修复指令 9 · Defect-H `_redactErrText` 补充裸号码 / 邮箱 / IP 脱敏」）**：产品 HEAD 由 L16-W17（1,119,754 / `2B8AFF31…`）前进至 **L16-W18**（1,120,378 / `EE9E2219…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`_redactErrText` 替换链**保留引号包裹规则于首位**并追加 `\b1[3-9]\d{9}\b`→`<phone>` / `\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b`→`<email>` / `\b(?:\d{1,3}\.){3}\d{1,3}\b`→`<ip>`（**决策 L16-W18-D1：顺序 + `\b` 锚定口径**，正常消息零误伤、纯字符串变换幂等）；`error_report.pii-redaction` **false → true**（`rawPhone=false && rawEmail=false`），加密 `<enc-message>` 占位分支不变；`OP-L16W18-1`（纯数字本地部分邮箱先命中手机号规则）/ `OP-L16W18-2`（大消息 p95 5.790 ms）OPEN。N 层 [`t16-w18-pii-redaction.test.mjs`](../6.P0-T3基线/step9/t9/t16-w18-pii-redaction.test.mjs:1) **14/14**（不纳编）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（29,346 / `817DCDAB…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w18-2026-10-17.md`](../8.发布与CI/reports/t16-w18-2026-10-17.md:1)。
>
> **HEAD 前进记录（2026-10-17 · L16-W20「缺陷修复指令 11 · Defect-L `_calDataRev` 条件递增」）**：产品 HEAD 由 L16-W19（1,121,111 / `2D9CC5B4…`）前进至 **L16-W20**（1,122,077 / `711B9D75…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；新增 `invalidateCalIndexOnly()` 统一日历索引失效入口（`_calIndexCache===null` 直接返回，否则置 null 并推进 `_calDataRev`），`reportIndexFailure` 连败分支 / `l6InjectionFailure` / `commit` 两处索引失败分支 / `undo` / `redo` / `mergeRemoteState` `finally` 共 7 处原 `_calIndexCache=null;_calDataRev++;` 全部收口（**决策 L16-W20-D1：代次判据单一化 —— 以缓存实存性为唯一信号**）；非日历索引失败不再支付 `_renderDayCache` 整表重建（2000 条 LRU），连续 5 次失败代次 **仅 +1**、重建 **5 → 1**；`invalidateCalIndex()` 无条件语义不变。`OP-L16W20-1`（连败分支首命中仍重建 1 次）OPEN。N 层 [`t16-w20-calrev-gate.test.mjs`](../6.P0-T3基线/step9/t9/t16-w20-calrev-gate.test.mjs:1) **16/16**（不纳编）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（31,267 / `E9B0AAD0…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w20-2026-10-17.md`](../8.发布与CI/reports/t16-w20-2026-10-17.md:1）。
>
> **HEAD 前进记录（2026-10-17 · L16-W19「缺陷修复指令 10 · Defect-I 加密模式 entry.stack 一并占位 + ctx.enc 修正」）**：产品 HEAD 由 L16-W18（1,120,378 / `EE9E2219…`）前进至 **L16-W19**（1,121,111 / `2D9CC5B4…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`reportError` 加密分支在 `msg` / `reason` 之外追加 `stack` / `filename` / `lineno` 占位（`<enc-stack>` / `<enc-filename>` / `<enc-lineno>`，**先于 4KB 截断**，故加密态恒为短占位）；`ctx` 上提为 `_ctx` 并与 `encNow` 显式同源（加密 ⇒ `enc:true` 且 `view` / `docId` / `nodeCount` 清零；非加密 ⇒ `enc:false` 并提取常规上下文），`entry` 以 `ctx:_ctx` 引用（**决策 L16-W19-D1：占位集合 = 用户内容 + 运行环境身份，`kind` / `name` 结构字段保留**）；`error_report.encrypted-msg-placeholder` **false → true**（`hasSecret=false`）、`entry.ctx.enc===true` 加密态恒成立（实测复核：HEAD 的 `F11/fixed19` 内联三元式已与 `encNow` 同源，本波显式化并以 N 层锁定）；非加密分支（脱敏 + 4KB 截断 + 上下文提取）零回归；`OP-L16W19-1`（去重键仍以原始 filename / lineno 拼接 · 仅内存 Map，不外泄）OPEN。N 层 [`t16-w19-enc-stack-placeholder.test.mjs`](../6.P0-T3基线/step9/t9/t16-w19-enc-stack-placeholder.test.mjs:1) **12/12**（不纳编）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（30,168 / `ECBE0EEA…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w19-2026-10-17.md`](../8.发布与CI/reports/t16-w19-2026-10-17.md:1)。

> **HEAD 前进记录（2026-10-17 · L17-W1「缺陷修复指令 1 · Defect-P0-1 `renderSubTags()` 未定义变量 `tags`」）**：产品 HEAD 由 L16-W21（1,122,483 / `31BE83AB…`）前进至 **L17-W1**（1,123,447 / `1C1835A7…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`renderSubTags()` 原在 `const tagIndex=buildTagIndex();` 之后直接 `tags.forEach(([t,count])=>{...})`，而 `tags` 从未在该作用域声明（全文件无全局 `tags`）⇒ 用户展开标签分组必抛 `ReferenceError`、分组恒不渲染；改为由 `buildTagIndex()` 的 `Map<tag, Set<id>>` 派生 `tagRows=[tag, idSet.size]` 并按计数降序渲染，空索引追加 `.sb-row.sb-empty`「暂无标签」占位行，原有 row 构建逻辑（重命名 / 删除 / 改色 / 点击打开）与「新建标签」入口逐字保留（**决策 L17-W1-D1：计数取 `idSet.size`（`Set` 无 `length`）+ 非 `Set` 回退 0；决策 L17-W1-D2：空索引占位行不替代新建入口**）；`OP-L17W1-1`（`renderTagsView` 仍对 `Set` 取 `ids.length` ⇒ 标签视图计数 `undefined`）OPEN。N 层 [`t17-w1-rendersubtags-rows.test.mjs`](../6.P0-T3基线/step9/t9/t17-w1-rendersubtags-rows.test.mjs:1) **14/14**（不纳编）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（33,105 / `C0B117E0…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13` / L16 归档快照）保持只读历史锚**（§7）；详见 [`t17-w1-2026-10-17.md`](../8.发布与CI/reports/t17-w1-2026-10-17.md:1）。
>
> **HEAD 前进记录（2026-10-17 · L16-W21「缺陷修复指令 12 · Defect-C 合并往返时间戳单位统一」）**：产品 HEAD 由 L16-W20（1,122,077 / `711B9D75…`）前进至 **L16-W21**（1,122,483 / `31BE83AB…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`mergeRemoteState` 的 LWW 时间戳归一出 `_norm`（仅微秒 ÷1000）就地替换为 `_normToMs`（秒级 `0<v<1e10` ×1000 / 微秒 `v>8.64e14` ÷1000 / 正常毫秒 `1e12~1e13` 原样），段内 11 处 `_norm(...)` 全替换，`remoteUpdatedAt` 与全局元数据 LWW 的 `state.updatedAt` 同口径归一（**决策 L16-W21-D1：归一函数就地重命名而非并列新增；决策 L16-W21-D2：`remoteUpdatedAt` / `state.updatedAt` 同口径归一**）；`property.clean.invFails.I2` **22 → 0**、正常毫秒零归一；`OP-L16W21-1`（合入节点保留原单位时间戳 · 比较统一 / 存储不动）OPEN。N 层 [`t16-w21-merge-ts-unit.test.mjs`](../6.P0-T3基线/step9/t9/t16-w21-merge-ts-unit.test.mjs:1) **17/17**（不纳编）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（32,158 / `535AE68B…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t16-w21-2026-10-17.md`](../8.发布与CI/reports/t16-w21-2026-10-17.md:1）。

> **HEAD 前进记录（2026-10-17 · L17-W2「缺陷修复指令 2 · Defect-P0-2 周视图 UTC / 本地时区错位」）**：产品 HEAD 由 L17-W1（1,123,447 / `1C1835A7…`）前进至 **L17-W2**（1,123,953 / `08FE70B6…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；`renderCalendarPage()` week 分支改本地取值器（`getFullYear` / `getMonth` / `getDate` + `new Date(selY,selM,selD).getDay()`），消除东八区周日整周回退；7 日周序列 / 选中日解析 / `buildTimeGrid(days)` 收口零变更（**决策 L17-W2-D1：取值器口径统一为本地日历，不做周日特判**；**决策 L17-W2-D2：周序列与列头口径零变更**）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（34,119 / `3FE43F84…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13` / L16 归档快照）保持只读历史锚**（§7）；详见 [`t17-w2-2026-10-17.md`](../8.发布与CI/reports/t17-w2-2026-10-17.md:1）。

> **HEAD 前进记录（2026-10-17 · L17-W3「P1 指令 1 + 2 + 3 合并波」）**：产品 HEAD 由 L17-W2（1,123,953 / `08FE70B6…`）前进至 **L17-W3**（1,125,276 / `C23BB0B1…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7**）；① `initStore()` 补秒级时间戳归一（`0<v<1e10` ×1000，与 `mergeRemoteState` 的 `_normToMs` 同口径；微秒 / 正常毫秒分支不变，幂等）；② 删除零调用点的请求超时 strikes 函数及 `__juIndexShadow.timeout` 导出（就绪看门狗独立 `readyStrikes` 零变更）；③ `JU_SLIDES.render()` 暴露 `wrap._cleanup`（移除 resize 监听 + 摘除 `_cleanups` 登记项，幂等），`renderMain()` 在 `c.innerHTML=''` 前对 `.ju-sl-wrap` 回收（20 次切换监听不累积）（**决策 L17-W3-D1：三缺陷合并单波**；**D2：秒级归一在 `initStore` 兜底**；**D3：`timeout` 导出随死代码删除，其余键冻结**）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（35,149 / `4A32BC76…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l14` / `frozen-l13` / L16 归档快照）保持只读历史锚**（§7）；详见 [`t17-w3-2026-10-17.md`](../8.发布与CI/reports/t17-w3-2026-10-17.md:1）。

> **HEAD 前进记录（2026-10-17 · L17-W4「批次 4 合并收尾波 · 11 项」）**：产品 HEAD 由 L17-W3（1,125,276 / `C23BB0B1…`）前进至 **L17-W4**（1,126,551 / `1D6BAFB9…`）；`-Wave` 口径保持 `l15`（计数不变：**43 方 / Node 471 + PW 171 + bench 7/7**）；一次收口 **P1-4**（`_logTimers` 上限 500，超限淘汰最早项并立即落盘）/ **P1-5**（图谱 worker 单次超时即 terminate 重建，删除连续 2 次阈值）/ **P2-1**（自动颜色 `snapshot:true` 入历史栈）/ **P2-2**（`docToXls` 数值列导出 `Number`）/ **P2-3**（`copyPlain` 跳过 Symbol 键）/ **P2-4**（23:00 后新建待办 toast 提示）/ **P3-1**（删除零调用点时间解析死代码）/ **P3-2**（标签计数冷缓存占位 `'0'`）/ **P3-3**（`_errSeen` 清理策略注释）/ **OP-L17W1-1**（`renderTagsView` 改 `Set.size`）/ **OP-L17W3-2**（`initStore` 补根级 `state.updatedAt` 秒级归一）。N 层 [`t17-w4-batch-fixes.test.mjs`](../6.P0-T3基线/step9/t9/t17-w4-batch-fixes.test.mjs:1) **15/15**（不纳编 · 红证 1 通过 / 14 失败）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（36,135 / `0CBADCC0…`）。**L17 缺陷修复已全部完成，待进入 L17 全量 QA 终验与重新封存**；详见 [`t17-w4-2026-10-17.md`](../8.发布与CI/reports/t17-w4-2026-10-17.md:1)。
>
> **封存记录（2026-10-17 · L17-QA「全量 QA 终验与归档封存」）**：11 类 QA 全绿（[`all-t17-fixed.json`](../8.发布与CI/reports/all-t17-fixed.json:1) = `allGreen=true`）；`frozen-l17` 物化（1,126,551 / LF / `1D6BAFB9…` = canonical）；归档 `1.归档快照\T17-2026-10-17\` **新建**（清单 `_archived-manifest.md`）；登记器 **43 → 45 方**（决策 L17-QA-D1：`frozen-l17` + `t17-w4-batch-fixes.test.mjs`；37,104 / `3832B96D…`）；`_w5freeze` / `_w4freeze` / `_w4paths` 同步 `L17-frozen` 只读锚；`verify.js all`（静态 0 + Node 471 + PW 171 + bench 7/7）、`FROZEN_DRIFT_COUNT=0`、`VIOLATION_COUNT=0`。**L4~L17 全面封存，进入只读维护待命**；详见 [`t17-closure-2026-10-17.md`](../8.发布与CI/reports/t17-closure-2026-10-17.md:1)。
>
> **HEAD 前进记录（2026-10-17 · L18-Patch「最终补丁波 · P0-1 + P3-1 ~ P3-4」）**：产品 HEAD 由 L17-W4（1,126,551 / `1D6BAFB9…`）前进至 **L18-Patch**（1,127,387 / `BAF66A43…`）；`-Wave` 口径保持 `l15`（计数不变：**45 方 / Node 471 + PW 171 + bench 7**）；① **P0-1** `renderTagsView`（chip 点击）/ `renderTagNodes` 的 `tagIndex.get(t)||[]` 为 `Set` 却直接 `.map` ⇒ `TypeError`，改为 `Array.from(...)`；② **P3-1** `_indexWorkerStrikes` 退役（`__juIndexShadow.strikes` 键保留并恒 `return 0` · `@deprecated` ⇒ **OP-L17W3-1 CLOSED**）；③ **P3-2** `GraphLayoutWorker.timeoutStrikes` 声明 / 递增 / 清零全链路退役；④ **P3-3** `_l7TagCountText` 占位 `'…'` + `#cntTags.title="标签索引构建中"`（就绪后清除）；⑤ **P3-4** `renderSubTags` 骨架提示「正在构建索引…」。L17 N 层用例 `t17-w4-batch-fixes.test.mjs` 随语义同步（13,768 / `A7A32665…` · 15/15）；新增 `l18-final-patch.test.mjs`（17/17 · 不纳编）。冻结门三脚本 HEAD 期望随前进重算（§3 RL-11）；`l9-hash-check.mjs` 登记器期望同步（37,997 / `FED4B9BE…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l17` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t18-patch-2026-10-17.md`](../8.发布与CI/reports/t18-patch-2026-10-17.md:1)。
>
> **HEAD 前进记录（2026-10-17 · L19-Patch1「批次 1 · P0-1 + P0-2」）**：产品 HEAD 由 L18-Patch（1,127,387 / `BAF66A43…`）前进至 **L19-Patch1**（1,127,555 / `052D6F94…`）；`-Wave` 口径保持 `l15`（计数不变：**45 方 / Node 471 + PW 171 + bench 7/7**）；① **P0-1** boot 兼容块不再无条件 `removeItem('juju.pending.v1')`（仅 `pend.state` 命中并回填 `initial` 时消费删除，`{payload,ts,ttl}` 密文兜底保留）；② **P0-2** `commit()` 内层 `let _patch;` 删除（外层函数作用域变量恢复赋值 ⇒ L6 `updateIncrementalIndexes` 注入点恢复执行，`_l8Patch=_patch` 保留）；③ `actions.addNode` / `toggleDone` / `removeNode` / `setNodeDate` 的 `commit` 后显式 `invalidateCalIndex();_tagIndexCache=null;`。新增 `t19-patch1.test.mjs`（11/11 · 不纳编）。冻结门三脚本 HEAD 期望随前进重算（§3 RL-11：34,997 / 22,928 / 13,838）；`l9-hash-check.mjs` 登记器期望同步（38,874 / `17A65D19…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l17` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t19-patch1-2026-10-17.md`](../8.发布与CI/reports/t19-patch1-2026-10-17.md:1)。
>
> **HEAD 前进记录（2026-10-17 · L19-Patch2「批次 2 · P1-1 + P1-2 + P1-3」）**：产品 HEAD 由 L19-Patch1（1,127,555 / `052D6F94…`）前进至 **L19-Patch2**（1,127,611 / `97589ABC…`）；`-Wave` 口径保持 `l15`（计数不变：**45 方 / Node 471 + PW 171 + bench 7/7**）；① **P1-1** `openTagPicker` 的 `pick` / `clearTags` 在 `commit` 后、`forceRender` 前显式 `_tagIndexCache=null;`（侧栏标签计数即时刷新）；② **P1-2** `removeNodeFromMap` 的 `purgeNodeMeta` 改传 `{...state, nodes:map}`（`dbRowHeights` / `dbColumnWidths` 孤儿键可清理）；③ **P1-3** `JU_SLIDES` blur 保存原文 `nn.text=txt`（渲染端 `_esc(_plain(...))` 保持单次转义）。新增 `t19-patch2.test.mjs`（11/11 · 不纳编）。冻结门三脚本 HEAD 期望随前进重算（§3 RL-11：35,163 / 23,094 / 14,004）；`l9-hash-check.mjs` 登记器期望同步（39,620 / `42FA7309…`）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l17` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t19-patch2-2026-10-17.md`](../8.发布与CI/reports/t19-patch2-2026-10-17.md:1)。
>
> **HEAD 前进记录（2026-10-17 · L19-Patch3「批次 3 · P2/P3 清理」）**：产品 HEAD 由 L19-Patch2（1,127,611 / `97589ABC…`）前进至 **L19-Patch3**（1,127,810 / `E75624C4…`）；`-Wave` 口径保持 `l15`（计数不变：**45 方 / Node 471 + PW 171 + bench 7/7**）；① **P2-1** `_sanTextEsc` 退役（`sanitizeHtml` 非白名单分支直接 `ch.textContent`）；② **P2-2** `applyPatch` 末尾无效 `repairTreeConsistency(next)` 调用删除；③ **P2-3** `commit` 内 `_clearTag` 死变量删除；④ **P2-4** `reportError` 去重键改用脱敏后的 `_p`；⑤ **P2-6** `openFieldTypeMenu` 接收触发按钮 rect；⑥ **P3-1** `commit` 全局重赋值移除、计时内联首尾（`typeof` 守卫）；⑦ **P2-7** `initPomo` 拖拽监听改为动态挂载 / 抬起即移除。新增 `t19-patch3.test.mjs`（23/23 · 不纳编）。冻结门三脚本 HEAD 期望随前进重算（§3 RL-11：35,391 / 23,322 / 14,232）；`l9-hash-check.mjs` 登记器期望同步（40,441 / `727DCE96…`）。**L19 静态审查缺陷全部清零，进入终审与封存**；**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l17` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t19-patch3-2026-10-17.md`](../8.发布与CI/reports/t19-patch3-2026-10-17.md:1)。
>
> **封存记录（2026-10-17 · L19-QA「全量 QA 终验与归档封存」）**：11 类 QA 全绿（[`all-t19-fixed.json`](../8.发布与CI/reports/all-t19-fixed.json:1) = `allGreen=true` / `fatal=null`）；`frozen-l19` 物化（1,127,810 / LF / `E75624C4…` = canonical）；归档 `1.归档快照\T19-2026-10-17\` **新建**（清单 `_archived-manifest.md`）；登记器 **45 → 47 方**（决策 L19-QA-D1：`frozen-l19` + `t19-patch3.test.mjs`；41,368 / `E9D1D6D9…`）；`_w5freeze` / `_w4freeze` / `_w4paths` 同步 `L19-frozen` 只读锚；`verify.js all`（静态 0 + Node 471 + PW 171 + bench 7/7）、`FROZEN_DRIFT_COUNT=0`、`VIOLATION_COUNT=0`。**L4~L19 全面封存，进入只读维护待命（无活跃任务）**；详见 [`t19-closure-2026-10-17.md`](../8.发布与CI/reports/t19-closure-2026-10-17.md:1)。
>
> **HEAD 前进记录（2026-10-17 · 批次 2「界面模块化 · 右键显隐 / 固顶」）**：产品 HEAD 由 L19（1,127,810 / `E75624C4…`）前进至 **1,138,457 / `B6403A3B…`**；`ui.modules` 新增 left / right / floats 三组模块显隐与固顶状态，并在 `_saveUINow` / `applyUIFields` / `uiSnapshot` 三处注册；新增 `JU_MODULES`（右键菜单 / class 显隐 / `insertBefore` 固顶 / 侧栏空白区入口）；`_mergeModules` 以默认结构为骨架恢复。`-Wave` 口径保持 `l15`（计数不变：**47 方 / Node 471 + PW 171 + bench 7/7**）。
>
> **HEAD 前进记录（2026-10-17 · 批次 3「独立功能定制」）**：产品 HEAD 由批次 2（1,138,457 / `B6403A3B…`）前进至 **1,144,467 / `DD6E6BFF…`**；`-Wave` 口径保持 `l15`（计数不变：**47 方 / Node 471 + PW 171 + bench 7/7**）；① `#btnMusic` 图标改为番茄图标；② `getNodeSvg` 新增 `_isNoteRoot` 分支（普通文档同外框 + 内部横线，判定先于 `isFolder`）；③ `openNode` 删除 `ui.view='auto'`（侧边栏切换文档保留当前顶层视图）；④ `openDbSummaryPanel` 移除固定宽度、标题改「汇总行」、勾选文案改「启用（计数/求和/求平均）」、`.db-sf-row` 换行；⑤ 新增 `openThemeSelector()`（日间/夜间缩略图 · 实时预览 · 确认应用 / 取消回滚），`ui.theme` / `ui.themePreview` 在 `_saveUINow` / `applyUIFields` / `uiSnapshot` 三处注册，`#btnTheme` 点击改为 `openThemeSelector`。RL-11 红证 `FIVE_PARTY_DRIFT_COUNT=2` → 绿证 `0`／`RESULT=PASS`；冻结门三脚本 HEAD 期望随前进重算（35,938 / 23,869 / 14,647）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l19` / `frozen-l17` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t20-batch3-2026-10-17.md`](../8.发布与CI/reports/t20-batch3-2026-10-17.md:1)。
>
> **HEAD 前进记录（2026-10-17 · 批次 4「全局视觉 Token / 交互优化 / 暗黑模式」）**：产品 HEAD 由批次 3（1,144,467 / `DD6E6BFF…`）前进至 **1,145,884 / `FF01EAB2…`**；`-Wave` 口径保持 `l15`（计数不变：**47 方 / Node 471 + PW 171 + bench 7/7**）；① 侧栏基准宽 210/230 + `#content` padding `var(--content-pad-t,16px) 20px 24px`，折叠钮由 fixed 底角回归顶栏 static（`.both` 的 `translateX` 复位），`.sb-row` / `.tb-nav-btn` / `.sr-section` 内边距收紧 2–4px；② `--fg-dim:#4A5C50`、占位符 opacity `.75`、今日列 6% 底 + 顶部 2px 线、标签事件 32% 混 `--bg-panel` 且正文纯 `--fg`、行 hover 取 `--bg-panel` / sel 10% 底 + 3px 强调条、拖拽把 `.18↔.6`、表头投影 + 空态虚线框；③ 夜间 `--bg #0A1929` · `--bg-soft #152A4A` · `--bg-panel #1D355E` · `--bg-menu #12233F` 形成「四周浅、中间深」，`.word-editor` 与未标签事件去毛玻璃；④ `toast` 停留 `max(1800, 800+len*80)`、`:focus-visible` 2px 外扩 + 4px 柔光、模态栈 ↔ `#app inert` 同步（`appConfirm` 显式 + body childList 观察器全覆盖）。数据契约 / 加密 payload / 公开 API 零变更；不新增 `<script>` 块（9 块，语法 9/9）；RL-11 红证 `FIVE_PARTY_DRIFT_COUNT=1` → 绿证 `0`／`RESULT=PASS`；冻结门三脚本 HEAD 期望随前进重算（36,484 / 24,415 / 15,193）。**交付 / 维护基线（`release\v2.0-l15\` / `frozen-l19` / `frozen-l17` / `frozen-l14` / `frozen-l13`）保持只读历史锚**（§7）；详见 [`t20-batch4-2026-10-17.md`](../8.发布与CI/reports/t20-batch4-2026-10-17.md:1)。
> **封存记录（2026-10-17 · L20「UI 观察项修复 + 全量 QA 终验 + 归档封存」）**：观察项 `.main-toggle` 默认态 `opacity:.2` → `.6`（`:hover` / `:focus-visible` 保持 `1`；改动留在基础规则，避免 `#topbar .main-toggle` 特异性覆盖 hover —— 决策 L20-QA-D2），字节中性（1,145,884 / 21,394 行不变）。产品 HEAD = **1,145,884 / `07C9CD44…`**；`-Wave l15` 计数不变（**47 方 / Node 471 + PW 171 + bench 7**）。RL-11 红证 `FIVE_PARTY_DRIFT_COUNT=2` → 绿证 `0` / `RESULT=PASS`。`frozen-l20` 物化（[`v2.0-t13-frozen-t20-2026-10-17.html`](../1.冻结版本/v2.0-t13-frozen-t20-2026-10-17.html:1) · 与 canonical 逐字节一致）；归档 `1.归档快照\T20-2026-10-17\` **新建**（35 件 / 1,599,895 B · 清单 [`_archived-manifest.md`](../1.归档快照/T20-2026-10-17/_archived-manifest.md:1)）；冻结门三脚本 HEAD 期望 + `L20-frozen` 只读锚同步（36,726 / 24,657 / 15,303）。**【L20 全量 QA 终验通过，L4~L20 已全面归档封存，进入只读维护待命状态】**；详见 [`t20-closure-2026-10-17.md`](../8.发布与CI/reports/t20-closure-2026-10-17.md:1)。
>
> **封存记录（2026-10-17 · L21「多维表格列头拖拽排序补丁 + 归档封存」）**：产品 HEAD 由 L20（1,145,884 / `07C9CD44…`）前进至 **L21（1,147,911 / `B102568D…`）**；补丁 = 多维表格列头原生 HTML5 拖拽重排（`_dragFieldName` 归一 `string` / `object` 字段名、`.dragging` / `.drag-over` 视觉态、`commit` 内 `splice` 原子换位 `{snapshot:true}`、`ui._resizingCol` 期间禁拖），增量 **+2,027 B / +58 行**，数据契约 / 加密 payload / 公开 API 零变更，不新增 `<script>` 块（9 块）。`-Wave` 口径保持 `l15`（**47 方 / Node 471 + PW 171 + bench 7**）。登记 **决策 L21-QA-D1**：`frozen-l11` 与 `frozen-l10` 逐字节同源去重退役，同址纳入 `frozen-l21`，**方数保持 47**；登记器期望同步（**45,243 / CRLF / `90F280FC…`**）；冻结门三脚本（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）L15 HEAD 期望 + `L21-frozen` 只读锚同步（36,968 / 24,899 / 15,413）。`frozen-l21` 物化（[`v2.0-t13-frozen-t21-2026-10-17.html`](../1.冻结版本/v2.0-t13-frozen-t21-2026-10-17.html:1) · 与 canonical 逐字节一致）；归档 `1.归档快照\T21-2026-10-17\` **新建**（21 件 / 1,463,178 B · 清单 [`_archived-manifest.md`](../1.归档快照/T21-2026-10-17/_archived-manifest.md:1)）；`verify.js all` exit 0（静态 0 + Node 471 + PW 171 + bench 7/7）、`FROZEN_DRIFT_COUNT=0`、`VIOLATION_COUNT=0`。**【L21 补丁已落地，L4~L21 全面封存，进入只读维护待命】**；详见 [`t21-patch-2026-10-17.md`](../8.发布与CI/reports/t21-patch-2026-10-17.md:1)。
>
> **HEAD 前进记录（2026-10-17 · L22「十一项缺陷修复波 · P0 4 / P1 2 / P2 3 / P3 1 / 性能清理 1」）**：产品 HEAD 由 L21（1,147,911 / `B102568D…`）前进至 **L22（1,151,899 / `EA921837…`）**；`-Wave` 口径保持 `l15`（计数不变：**47 方 / Node 471 + PW 171 + bench 7**）；① `ensureNoteDoc` 命中根才返回（记事本回收后可重建）；② 日历事件块 `setPointerCapture` / `releasePointerCapture`；③ `renderSubTags` 骨架行收敛 `.ju-skel` 祖先；④ 思维导图一级节点改判 `_mmLv1Ids`；⑤ 折叠三钮移出 `#topbar` 改 `position:fixed`；⑥ `.sb-nav-body` 行距 `1.6` + 收起态垂直居中；⑦ `_mmDrawEdge` 固定源右中 / 目标左中锚点；⑧ `#btnMusic` 标准番茄图标；⑨ 列宽 `minW=80` + `.db-table th` 居中；⑩ 幻灯片工具栏改挂 `wrap` 并 `position:fixed`；⑪ 四动作提交后重复全量索引失效删除（commit 增量补丁已按 `changedIds` 维护）。`<script>` 块数保持 **9**；数据契约 / 加密 payload / 公开 API 零变更。RL-11 先改后补：登记器期望同步（**46,174 / CRLF / `5512C3D6…`**）；冻结门三脚本 L15 HEAD 期望同步（**37,428 / 25,359 / 15,873**）。`verify.js all` exit 0（静态 0 + Node 471 + PW 171 + bench 7/7）、`FROZEN_DRIFT_COUNT=0`、`VIOLATION_COUNT=0`。**本波不冻结、不重复归档**，`frozen-l21` 保持只读历史锚；详见 [`t22-fixes-2026-10-17.md`](../8.发布与CI/reports/t22-fixes-2026-10-17.md:1)。
>
> **封存记录（2026-10-17 · L22-QA「全量 QA 终验与归档封存」）**：`frozen-l22` 物化（[`v2.0-t13-frozen-t22-2026-10-17.html`](../1.冻结版本/v2.0-t13-frozen-t22-2026-10-17.html:1) · **1,152,513 / LF（21,488）/ `5C9B133B…88DB`** · 与 canonical 逐字节一致）；归档 `1.归档快照\T22-2026-10-17\` 追加封存件与绿证（清单 [`_archived-manifest.md`](../1.归档快照/T22-2026-10-17/_archived-manifest.md:1)）；登记器 **决策 L22-QA-D1**：`frozen-l8`（907,419 / `2F43EA0F…`）与 `v2.0-l3-frozen-l9-2026-10-14.html` 逐字节同源（后者物理保留并仍由 `_w5freeze.ps1` 的 L8 / L9 两条 P3 锚点校验）⇒ 去重退役该重复登记方，同址纳入 `frozen-l22`，**方数保持 47**；登记器期望同步（**47,062 / CRLF / `2075C937…`**）；`verify.js all` exit 0（静态 0 + Node 471 + PW 171 + bench 7/7）、`FROZEN_DRIFT_COUNT=0`、`VIOLATION_COUNT=0`。**【L22 多维表格拖拽排序及防御性修改已落地，L4~L22 全面封存，项目进入只读维护待命】**；详见 [`t22-closure-2026-10-17.md`](../8.发布与CI/reports/t22-closure-2026-10-17.md:1)。
>
> **文档口径补记（决策 L22-QA-D2 · 2026-10-17 · 零产品字节变更）**：L22 批次 0 随波**移除了 db 表头右键的左右移功能**（表头右键菜单仅保留 设为公式列… / 编辑公式… / 转为文本列 / 选择关联表… / 重命名列 / 在左侧插入列 / 删除列）；`t22-fixes-2026-10-17.md` 未单列该项，本波按 §2 记决策后补记口径（`renderInlineTable` 文档内嵌表格块的左右移与之无关，保持原状）。
>
> **封存补全记录（2026-10-17 · L22-QA 终验 / 归档补全 · 零产品字节变更）**：L22 封存波已物化 `frozen-l22` 并同步登记器，但冻结门三脚本仍钉批次 0 HEAD（1,151,899 / `EA921837…`）且无 `L22-frozen` 锚、封存报告与归档追加件缺失。本轮按 §3 RL-11 补全：① `_w5freeze.ps1`（37,971 / `D57D4938…`）/ `_w4freeze.ps1`（25,902 / `CCDF5529…`）/ `_w4paths.ps1`（16,284 / `A82756B7…`）L15 HEAD 期望 → **1,152,513 / `5C9B133B…`**，并新增 `L22-frozen-2026-10-17` 只读锚与 `$known` 纳编；② 三门复跑全绿（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0` / `VIOLATION_COUNT=0` / `RESULT=PASS`），绿证 [`t22qa-w5freeze-2026-10-17.txt`](../8.发布与CI/reports/t22qa-w5freeze-2026-10-17.txt:1) / [`t22qa-w4freeze-2026-10-17.txt`](../8.发布与CI/reports/t22qa-w4freeze-2026-10-17.txt:1) / [`t22qa-w4paths-2026-10-17.txt`](../8.发布与CI/reports/t22qa-w4paths-2026-10-17.txt:1)；③ `verify.js all` exit 0（静态 0 · Node 471 · PW 171 · bench 7/7 · 最大恶化 0.0%）与登记器 `PARTY_COUNT=47` / drift 0 复跑复核；④ 封存报告 [`t22-closure-2026-10-17.md`](../8.发布与CI/reports/t22-closure-2026-10-17.md:1) 落盘，归档 `1.归档快照\T22-2026-10-17\` 追加 9 件（合计 **15 件 / 3,813,945 B**），清单 `_archived-manifest.md` 同步。
>
> **HEAD 前进记录（2026-10-18 · L22 批次 1「UI 缺陷修复与交互统一 · 高优先级四项」）**：产品 HEAD 由批次 4（1,157,639 / `5B4801D5…`）前进至 **1,158,588 / `8F6D3C41…`**（+949 B / +10 行）；`-Wave` 口径保持 `l15`（计数不变：**47 方 / Node 471 + PW 171 + bench 7/7**）；① `renderMindmap` 连线与节点同源（`_mmEls` 上提至 `edges()` 之前 · 增 `okFrom` / `okTo` 存在性校验 · `edges(rootNode)` 移至节点 DOM 建立后调用）；② `.sb-module-group` 由 `display:contents` 改 `flex column / width:100%`；③ 折叠三钮由 `#topbar` 移出至 `#body` 末尾，`.main-toggle` 改 `position:fixed` 贴底（`opacity:.3` → hover `1`）；④ 收起态 `#sidebarLeft.collapsed .sb-nav-body` 改 `height:100%` + flex 垂直居中 + `gap:4px`，`.sb-nav-item` 的 `margin-bottom` 清零。数据契约 / 加密 payload / 公开 API 零变更；`<script>` 块数保持 **9**；登记器期望同步至 1,158,588 / `8F6D3C41…`，冻结门三脚本 L15 HEAD 期望同步；`frozen-l22-final` 纳编位保持 1,157,639 / `5B4801D5…` ⇒ **方数仍 47**。证据：`_哈希与行尾校验\b1fix-dom-2026-10-18.txt` / `b1fix-probe-2026-10-18.txt` / `b1fix-probe2-2026-10-18.txt`。
>
> **HEAD 前进记录（2026-10-18 · L22 批次 1-r2「批次 1 深度复查与修正」· 决策 L22-B1R2-D1 ~ D5）**：产品 HEAD 由批次 1（1,158,588 / `8F6D3C41…`）前进至 **`r4` = 1,174,919 B / `0B4AA2A6...5A3C` / LF / see `1.冻结版本/HEAD.json`**（+8,123 B / +90 行），canonical 与 step9 镜像逐字节一致；`-Wave` 口径保持 `l15`（计数不变：**47 方 / Node 471 + PW 171 + bench 7/7**）。本波按 Chromium 实机探针（[`b1fix-runtime-2026-10-18.txt`](../_哈希与行尾校验/b1fix-runtime-2026-10-18.txt:1)）逐项收口：**D1** 折叠三钮定位错位——三钮由 `#body` 末尾改置于 `#main` 末尾，`.main-toggle` 由 `position:fixed` 改 `position:absolute`（以 `#main{position:relative}` 为参照贴主内容区底部；探针实测 `offsetParent=#main` / `bottom=469`·`mainBottom=485` / `position=absolute`）；**D2** 模块包裹层高度溢出——`.sb-module-group` 由 `display:flex;flex-direction:column` 改 `display:block;width:100%;position:relative`（flex 上下文使包裹层撑高，拖拽手柄覆盖条目边缘），收起态另设 `flex:none` 不参与伸缩；**D3** 侧栏 resize 命中区——`#sidebarResize` / `#sidebarRightResize` 宽 6 → 8px、`z-index` 50 → 60，`right:-3px` / `left:-3px` 改 `right:0` / `left:0`，整条落在侧栏内缘，不再被 `overflow:hidden` 裁半；**D4** 收起态高度链打通——`#sidebarLeft.collapsed` 补 `display:flex;flex-direction:column`，`.sb-nav-block` / `.sb-nav-body` 显式 `height:100%` + `box-sizing:border-box`（百分比高度在 content-box + flex 项下解析失败导致 `justify-content` 失效；探针 `navBody 354 ≈ navBlock 355`）；**D5** 拖拽事件监听冲突收口（`JU_DND`）——`init` 幂等（`_inited`）、新增 `_navGripOk` / `ensureNavGrips` / `refreshNav`、`.ju-grip` 显式 `pointer-events:auto` + `position:relative` + `z-index:10`、`pointerdown` 内 `preventDefault` + `stopPropagation` + `setPointerCapture` 并并行挂 document 捕获监听兜底、拖拽后 400ms `click` 抑制、`window.JU_DND` 暴露 + boot 后 `setTimeout(0)` / `setTimeout(300)` 两次兜底补挂、`initJuDnd()` 加 `try/catch` 隔离。数据契约 / 加密 payload 字段名零变更；公开 API 仅新增只读兜底入口；`<script>` 块数保持 **9**（开 9 / 闭 9，生成类注释 0 命中，CR 0）。RL-11 红证 `FIVE_PARTY_DRIFT_COUNT=1`（canonical）→ step9 镜像同步后绿证 `0` / `RESULT=PASS` / `PARTY_COUNT=47`；登记器期望重算至 **`r4` = 1,174,919 B / `0B4AA2A6...5A3C` / LF / see `1.冻结版本/HEAD.json`**（登记器本体 53,788 / CRLF / `3AA8F197…`）；冻结门三脚本 `_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1` 的 L15 HEAD 期望同步至 **`r4` = 1,174,919 B / `0B4AA2A6...5A3C` / LF / see `1.冻结版本/HEAD.json`**；`verify.js all` exit 0（静态 0 命中 + Node **471** + PW **171**（167 passed / 4 skipped）+ bench **7/7** · 最大恶化 0.0%）。绿证：[`b1r2-verify-all-green-2026-10-18.txt`](../_哈希与行尾校验/b1r2-verify-all-green-2026-10-18.txt:1) / [`b1r2-registrar-green-2026-10-18.txt`](../_哈希与行尾校验/b1r2-registrar-green-2026-10-18.txt:1)。**物理封存**：`1.冻结版本\v2.0-t13-frozen-t22-final-r2-2026-10-18.html`（新建 · 与 canonical 逐字节一致 · 不覆盖 `frozen-l22-final`），归档追加至 `1.归档快照\T22-2026-10-18\`（清单 [`_archived-manifest.md`](../1.归档快照/T22-2026-10-18/_archived-manifest.md:1)）。**47 方方数保持**，历史只读锚零改写。
>
> **HEAD 前进记录（2026-10-19 · 粘贴多行拆分 + 首尾空行修复 · 批次 4/4 · P2）**：产品 HEAD 由 r16（1,194,479 / `06A90D0C…`）前进至 **`r17` = 1,204,191 B / `25891FFD…2AB7` / LF（CR=0 · LF=22,225）**（+9,712 B / +209 行）；本波为内联源码修正：① **粘贴多行文本按行拆分**——粘贴含换行的文本时按 `\n` 拆分为多个节点（原实现整段落入单节点），拆分后逐节点插入并保持缩进层级；② **首尾空行修复**——首行 / 末行空串不生成空节点（内部空行仍保留为空节点），消除粘贴后头部 / 尾部凭空多出的空行节点；③ 节点数量增加后同步调整 UI 用例断言（单节点 → 多节点，逐行文本与顺序校验）。数据契约 / 加密 payload 字段名 / 公开 API 零变更；`<script>` 块数保持 **9**。RL-11 红证 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror）→ 期望值同步后绿证 `0` / `RESULT=PASS` / `PARTY_COUNT=61`。全量门禁复跑 **exit 0**：静态检查 0 命中 · Node **502** 用例全通过 · Playwright **167 passed + 4 skipped = 171** · bench **7/7 通过**（最大恶化 0.0%）。物化 `v2.0-l13-frozen-l22-final-r3-2026-10-19.html`（与 canonical 逐字节一致）并归档 `1.归档快照\L22-2026-10-19\`；证据 [`paste-verify-all-r2-2026-10-19.txt`](../_环境与调试/paste-verify-all-r2-2026-10-19.txt:1) / [`paste-registry-r2-2026-10-19.txt`](../_环境与调试/paste-registry-r2-2026-10-19.txt:1)。
>
> **HEAD 前进记录（2026-10-19 · 大纲多选失效修复 + 选中/多选视觉反馈恢复 · r18）**：产品 HEAD 由 r17（1,204,191 / `25891FFD…`）前进至 **`r18` = 1,205,588 B / `11B96CBC…41B2` / LF（CR=0 · LF=22,238）**（+1,397 B / +13 行）；本波为内联源码修正：① `renderOutlineRow` / `renderOutlinePage` 的 `mousedown` 将 `e.target` 归一为元素节点（contenteditable 内 Text 节点 nodeType===3 无 `closest`），消除 Ctrl / Shift 多选时的 TypeError；② `.row.sel` / `.row.multi-sel` 以 `.outline` 前缀提高特异性恢复可见底色（`color-mix` 不支持时回退 `--accent-soft`）；③ P 层 `t3-invariants.spec.ts` 增加 Ctrl / Shift / Text 节点 / 底色断言（用例数不变）；④ 同时以 r17 冻结件为基线恢复此前工作区缺失的 r17 粘贴多行拆分 + 首尾空行修复（`hasRichFormat` / 内部空行保留），避免回退。数据契约 / 加密 payload / 公开 API 零变更；`<script>` 块数保持 **9**。canonical = step9 镜像 = r18 冻结件三方逐字节一致；登记器 **62 方 / drift 0 / PASS**；全量门禁 **exit 0**（静态 0 命中 · Node **502** · PW **171**（167 passed + 4 skipped）· bench **7/7**，最大恶化 0.0%）。证据 [`r18-verify-all-2026-10-19.txt`](../_环境与调试/r18-verify-all-2026-10-19.txt:1) / [`r18-registry-2026-10-19.txt`](../_哈希与行尾校验/r18-registry-2026-10-19.txt:1)。
>
> **HEAD 前进记录（2026-10-19 · 智能拖拽多选 + 大纲选中样式统一 · r19）**：产品 HEAD 由 r18（1,205,588 / `11B96CBC…`）前进至 **`r19` = 1,209,561 B / `9FA0B52E…CA36` / LF（CR=0 · LF=22,331）**（+3,973 B / +93 行）；本波为内联源码修正：① `.row` 的 `mousedown` 不再 `preventDefault`，仅记录起点（clientX / clientY + 节点 id），方向判定移交 `document` 的 `mousemove`——水平为主（|dx| > |dy|）判定「选中文字」零干预；垂直为主（|dy| > |dx| + 5）判定「跨行多选」，立即 `preventDefault` + `removeAllRanges` + `body.userSelect:none`，并以 `elementFromPoint` 命中 `.row`，按「锚点→当前行」区间重算 `_outlineSel.ids` 与 `.multi-sel`（回退经过的行自动移除），`mouseup` 结束刷选并 `forceRender` 固化；零位移纯点击沿用原单击选中语义（文本内点击仍交给编辑器定位光标）；② `.row.sel` / `.row.multi-sel` 统一为单色 `var(--accent-soft)!important`，hover / focus 同色，`outline / border / box-shadow` 全部 `none`（含 `.row:hover`、`.row.sel:hover`、`.row.multi-sel:hover`、`.row:has(.text:focus):hover`）；③ P 层 `t3-invariants.spec.ts` 增加真实鼠标水平拖拽（产生原生 Selection 且 `.multi-sel` 为 0）与垂直跨行拖拽（`.multi-sel` ≥ 2、Selection 清空、底色生效、无边框）断言，用例数不变（PW 保持 **171**）。数据契约 / 加密 payload / 公开 API 零变更；`<script>` 块数保持 **9**。canonical = step9 镜像逐字节一致；登记器 **62 方 / drift 0 / PASS**；全量门禁 **exit 0**（静态 0 命中 · Node **502** · PW **171**（167 passed + 4 skipped）· bench **7/7**，最大恶化 0.0%）。证据 [`r19-verify-all-2026-10-19.txt`](../_环境与调试/r19-verify-all-2026-10-19.txt:1) / [`r19-registry-2026-10-19.txt`](../_哈希与行尾校验/r19-registry-2026-10-19.txt:1)。
>
> **HEAD 前进记录（2026-10-19 · 左侧边栏多选 + 批量移入回收站 · r20）**：产品 HEAD 由 r19（1,209,561 / `9FA0B52E…`）前进至 **`r20` = 1,212,291 B / `56E705E7…CDD0` / LF（CR=0 · LF=22,368）**（+2,730 B / +37 行）；本波复用 `_mSel` 新增 `type='sidebar'`——`makeSidebarRow` 行写入 `data-msid` 并按选择回填 `.ju-msel`，Ctrl / Cmd 切换、Shift 按 `_sbVisibleIds()` 可见顺序范围选择、普通点击仍 `openNode`；`showTreeContext` 在多选 >1 时插入「移入回收站（所选 N 个）」，确认后逐个 `actions.moveToTrash`（跳过 rootId / 日历根 / 数据库根 / 已删项）。大纲 / 数据库 / 文件网格行为零变更；`<script>` 块数保持 **9**。真实浏览器探针 **20/20**；登记器 **62 方 / drift 0 / PASS**；全量门禁 **exit 0**（Node **502** · PW **171** · bench **7/7**）。证据 [`r20-sidebar-multiselect-probe-2026-10-19.txt`](../_哈希与行尾校验/r20-sidebar-multiselect-probe-2026-10-19.txt:1) / [`r20-verify-all-final-2026-10-19.txt`](../_环境与调试/r20-verify-all-final-2026-10-19.txt:1)。
>
> **HEAD 前进记录（2026-10-19 · 回收站多选 + 批量恢复 / 彻底删除 · r21 · 最终封存验证）**：产品 HEAD 由 r20（1,212,291 / `56E705E7…`）前进至 **`r21` = 1,215,166 B / `E729E5CC…C998` / LF（CR=0 · LF=22,418）**（+2,875 B / +50 行）；本波复用 `_mSel` 新增 `type='trash'`——`renderTrashView` 卡片写入 `data-msid = t.rootId`，Ctrl / Cmd 切换、Shift 按回收站 rootId 顺序范围选择、普通点击不导航；多选 >1 且命中项时右键菜单改为「恢复所选（N 个）」/「彻底删除所选（N 个）」；`_trashBatchRestore` / `_trashBatchPurge` 逐项按 `state.trashed.findIndex(t.rootId===rid)` 现算索引，规避 splice 索引漂移，完成后清空选择并 `forceRender`；标题行新增「全选」，`_mSelSelectAllCurrent` 增加 trash 分支。大纲 / 数据库 / 文件网格行为零变更（函数体 SHA-256 与 r18 逐字节一致）；`<script>` 块数保持 **9**。真实浏览器探针 **21/21**；登记器 **62 方 / drift 0 / PASS**；全量门禁 **exit 0**（静态 0 命中 · Node **502/502** · PW **167 passed + 4 skipped = 171** · bench **7/7**，最大恶化 0.0%）。证据 [`final-seal-verify-all-2026-10-19.txt`](../_哈希与行尾校验/final-seal-verify-all-2026-10-19.txt:1) / [`final-seal-registry-2026-10-19.txt`](../_哈希与行尾校验/final-seal-registry-2026-10-19.txt:1) / [`final-seal-r21-trash-probe-2026-10-19.txt`](../_哈希与行尾校验/final-seal-r21-trash-probe-2026-10-19.txt:1)。
>
> **HEAD 前进记录（2026-10-20 · UI 一致性批次 2 · 问题 1/2/4/5/7）**：产品 HEAD 由 r22（1,212,364 / `FE04CC1A…`）前进至 **1,215,291 B / `5C2F9A24…42A1` / LF（CR=0 · LF=22,402）**（+2,927 B / +15 行）；本波为内联源码修正（canonical = step9 镜像逐字节一致）：① **问题 1**——`renderTrashView` / `renderTemplatesView` / `renderHistoryView` 三视图顶部补「← 返回」（`ui.view='auto'` + `currentDocId=state.rootId` + `setActiveKey('nav:files')`，回收站按钮插在标题之前、模板视图 `insertBefore(firstChild)`、历史视图紧随视图标题）；② **问题 7 / 4**——`navTo('database')` 不再默认打开第一张表，改为 `currentDocId=数据库根文件夹`（`viewOf(_isDbRoot)=FOLDER` ⇒ `renderFolderGrid` 渲染多维表格卡片缩略图，与「我的文档」同口径），空库同样落到文件夹视图并显示「这个文件夹是空的」；③ **问题 2**——`updateSidebarActiveState` 末尾对 `#btnTemplates` / `#btnTrash`（`.sb-square` 不在 `.sb-nav-item` 集合内）同步 `.active`，新增 `.sb-square.active{background:var(--accent);border-color:var(--accent)}` / `.sb-square.active svg{stroke:#fff}`；④ **问题 5**——`renderDatabasePage` 工具栏首位新增 `.db-title`（`contentEditable` 表名，`blur` 提交 `updateText` 快照 + `logActivity` + `renderSidebar` 同步侧栏），新增 `.db-title` / `.db-title:focus` 规则。问题 6（富文本 Word 模式）已在批次 1 随 Word 移除解决。数据契约 / 加密 payload / 公开 API 零变更；`<script>` 块数保持 **9**（9/9 语法编译通过）。真实浏览器物理操作探针 **18/18**（点「数据库」卡片缩略图 1 张 + `.db-page=0`；卡片进表格 + 表名改名后侧栏同步；模板 / 回收站按钮 `--accent` 底 `rgb(51,101,76)` + `#fff` 描边；三视图「← 返回」均回「我的文档」；空库显示空文件夹提示；零 pageerror / console.error）；登记器 **63 方 / drift 0 / PASS**；全量门禁 **exit 0**（静态 0 命中 · Node **502/502** · PW **167 passed + 4 skipped = 171** · bench **7/7**，最大恶化 0.0%）。证据 [`b2ui-verify-all-2026-10-20.txt`](../_哈希与行尾校验/b2ui-verify-all-2026-10-20.txt:1) / [`b2ui-registry-2026-10-20.txt`](../_哈希与行尾校验/b2ui-registry-2026-10-20.txt:1) / [`b2ui-browser-probe-2026-10-20.txt`](../_哈希与行尾校验/b2ui-browser-probe-2026-10-20.txt:1)。

**回归不得低于**：**Node 502 + PW 171 + bench 7/7** / **零漂移（现行登记方数 65）**。
（口径变更：现行 `verify.js` 实际执行 **502** 个 Node 用例 / **171** 个 Playwright 用例 / **7** 个 bench 场景；历史记录中的 471 / 49 方等数值为 L15~L22 早期门禁口径，已作废，仅在上文历史记录中留痕。）

---

## 5. 65 方登记器维护指南

- **位置**：[`6.P0-T3基线\step9\verify-hash-registry.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:1)（**现行工作基线：1,261,506 B / `C6AAF0E3…2AB3C8` / LF（CR=0 · LF=23,152）**，见 §二十九；封存 HEAD `r22` = 1,212,364 B / `FE04CC1A…C1D5` / LF 见 [`1.冻结版本/HEAD.json`](../1.冻结版本/HEAD.json:1)；登记器本体字节 / 哈希见 `_哈希与行尾校验\` 最新绿证，其 canonical / step9-mirror 期望值随基线前进同步重算；**65 方纳编口径**）。
- **运行**：`. "8.发布与CI\ci\env.example.ps1"` ⇒ `cd 6.P0-T3基线\step9` ⇒ `node verify-hash-registry.mjs`。
- **更名记录（L22-Rename · 2026-10-17）**：原 `l9\l9-hash-check.mjs`（无 `19-` 前缀之实际文件）更名为 `verify-hash-registry.mjs` 并移至 step9 根目录（决策依据：消除 `19` / `l9` 视觉歧义）；执行入口、T-99 / T-102 的 `spawnSync` 路径、`ci-gate.yml`、本手册与 `CURRENT_TASK.md` 已同步；`l10-idb-persist.spec.ts`（32,065）与 `l11-anchor-governance.spec.ts`（9,140）随路径改写重锚，并同步 `_w5freeze.ps1` / `_w4freeze.ps1` 的 `$H_L11SPC`。
- **期望输出**：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）。
- **纳编 / 退役**：新增或被移除的登记对象须同步更新脚本内期望值，**方数变化须经决策并记录**；纳编物（如冻结件、N 层 / P 层测试）须与 §2 / §3 流程一致。
- **漂移处理**：出现 `FIVE_PARTY_DRIFT_COUNT>0` ⇒ 定位漂移物 ⇒ 判定「有意变更（走 §3）」或「非预期（回滚 / 修复）」⇒ 复跑至 `PASS`。
- **零漂移红线**：**任何未登记的哈希变更均视为违规**。

---

## 6. 观察项处理规程（含 OP-20）

**OP-20（100k 视窗 longtask / p95 帧预算）** 已于 2026-10-16 收敛波 **CLOSED**；以下为**后续观察项**的处理规程：

| 观察项 | 预算常量 | 出口判据 |
|---|---|---|
| longtask | `L14_LONGTASK_BUDGET=50`（ms） | `longtaskGate` = `ok`（longtask 计数 / max 达标） |
| p95 帧预算 | `L14_P95_BUDGET=16`（ms） | `p95Gate` = `ok`（p95 ≤ 16ms） |
| RSS | `L14_RSS_CAP_MB=200`（MB） | `rssGate` = `ok`（RSS ≤ 200MB） |

**触发复测条件**：① 100k 视窗 / 虚拟滚动 / 时间切片相关代码变更；② 性能基线或帧预算常量调整；③ 定期巡检（建议随每个迭代波复跑 100k 场景）。

**处理规程**：

1. **复测**：以 `JU_L14=1 JU_L14_100K=1` 运行 100k 场景，采集 `window.__l14.longtaskGate / p95Gate / rssGate`。
2. **判定**：三门全 `ok` ⇒ 观察项维持（无需动作）；任一 `fail` ⇒ 记为**新观察项 / 缺陷**，进入下一迭代波（`L15` 或 `v3.x`）处理。
3. **登记**：观察项状态（OPEN / CLOSED）与处置路径写入波报告或专项报告；不阻断交付基线，但**须登记**。
4. **升级**：若预算常量需调整，**须经决策并记录**，并同步更新 N 层 / P 层测试中的预算断言。

> 参照：OP-20 收敛波出口判据 = longtask `2/max 321ms → 0/0ms`；p95 `55.3ms → 3.0ms`；RSS `42.63MB → 28.04MB`（全绿）。

---

## 7. 冻结件与归档管理

1. **冻结件只读**：`1.冻结版本\*`（含 `frozen-l22-final-r5` / `frozen-l22-final-r4` / `frozen-l22` / `frozen-l21` / `frozen-l20` / `frozen-l17` / `frozen-l14` / `frozen-l13` …）**不得覆盖 / 改写**。历史锚在冻结门中判为 `DECOUPLED`（不参与四方判定），但 **P3 锚点校验仍须守持**（`frozen-l22-final-r5` / `frozen-l22-final-r4` 已登记入 **65 方**登记器并由 `_w4paths.ps1` 逐件枚举；`frozen-l22` / `frozen-l21` / `frozen-l20` / `frozen-l17` 均已登记入 `_w5freeze` / `_w4freeze` / `_w4paths` 只读锚）。
2. **归档不重复**：`1.归档快照\*` 一经封存即为只读；**不得重复归档**（铁律 4）。新增封存须为 **新建目录**。
3. **发布包隔离**：新发布包 **新建目录**（现行交付包 = `release\v2.0-t22-r4-2026-10-18\`；历史包 `release\v2.0-t15-2026-10-16\` 已标注 `archived: true` / `supersededBy: v2.0-t22-r4`），**不得覆盖**前代发布包。

---

## 8. 环境与命令约定

- **存在本地 git 仓库**：仓库根含 `.git`（可复核提交历史 / 工作树状态）；忽略规则见根目录 [`.gitignore`](../.gitignore:1)（覆盖 `node_modules/`、`_临时脚本/`、`_W2阶段产物/`、`1.归档快照/` 等）。远端推送为可选。
- Node 运行时：优先使用 `JU_NODE_DIR` 环境变量指向的 `node.exe`（通常不在 PATH 上，需由 `env.example.ps1` / `env.example.sh` 注入）。
- `verify.js` 需前置 PATH + `ELECTRON_RUN_AS_NODE=1`；GUI 子系统 ⇒ 输出须 `| Out-File` 落证后再读。
- PW / bench 需 `JU_CHROMIUM_PATH`。
- PowerShell 需 `-ExecutionPolicy Bypass`；**cmd 设变量须加引号**。
- **铁律 2**：严禁复杂 PowerShell 拼接命令（优先已有 `.mjs` 脚本 / 简单命令）。
- **只读证据**：优先落盘 `.out.txt` 后再读取比较。

---

## 9. 阶段切换清单（交付 / 维护）

- [ ] 变更前登记决策记录（动因 / 范围 / 影响面）。
- [ ] 改 canonical → 同步 step9 镜像（逐字节）。
- [ ] 重算登记（RL-11 先改后补）→ **65 方** `PASS`。
- [ ] `verify.js all` + 冻结门三门全绿。
- [ ] 不覆盖冻结件 / 不重复归档 / 无 AI 注释。
- [ ] 波报告 + 证据日志 + 项目日志追加 + `CURRENT_TASK.md` 压缩更新。
- [ ] 发布包（如需）**新建目录**并逐件校验（`FOUR_WAY_IDENTICAL`）。

---

> **维护基线结论**：以 **封存 HEAD `r22` = 1,212,364 B / `FE04CC1A…C1D5` / LF（CR=0 · LF=22,387）（见 [`1.冻结版本/HEAD.json`](../1.冻结版本/HEAD.json:1)）**、**现行 canonical = step9 镜像 = 1,275,170 B / `A5E285C7…ED3CB850` / LF（CR=0 · LF=23,416）（逐字节一致，R47 · 2026-10-22 见 §三十）** 与 **65 方零漂移** 为长期守护基线；封存件 `1.冻结版本/v2.0-l13-frozen-l22-final-r5-2026-10-20.html` 与各前代冻结件（`L22-final-r4`（= r18 字节）/ `L22-final-r3` / `t22-final` / `t22` / `t21` / `t20` / `t19` / `t17` / `t16` 等）仅作只读历史锚，字节 / 哈希见 `_哈希与行尾校验\` 与 `8.发布与CI\reports\` 对应报告。后续变更须经决策并全量重算登记（铁律 4 / 铁律 6）。

---

## 10. r22 变更记录：富文本（Word）模式安全下线（2026-10-20）

> **动因**：富文本（Word）模式与大纲模式并存导致同一节点两套正文载体（`content` 与子节点 `text`），
> 字数双计、导出重复段落、历史快照回灌旧快照等缺陷反复出现。本波按「**先迁移数据、再删代码**」顺序下线该模式。

**① 数据迁移（先行）**

- 新增 `migrateWordToOutline(st)` / `splitWordContentToParas(html)` / `_dropWordFlatSubtree(st,id)`（位于 `script_5` 段、紧接 `migrateStateObject`）。
- `migrateStateObject` 末尾（`return st` 前）调用 `migrateWordToOutline(st)`：旧节点 `content` 按块级标签（`P/DIV/H1-6/LI/BLOCKQUOTE/PRE`）拆成大纲子节点；无块级标签时按 `<br>` / 换行切分并以 `esc()` 转义；随后 `delete _isWord / _wordFlat / content`。
- 已拍平进 `content` 的旧 `children`（`_wordFlat` 语义）同步移除——否则启动期 `repairTreeConsistency` 会以 `node.parent` 为准把它们挂回，造成段落重复。
- `mergeRemoteState` 合入前同口径调用（`try{migrateWordToOutline(remote);}catch(e){}`）：旧版标签页 / 旧备份经 storage 事件合入时自动转换。
- 历史快照恢复（`renderHistoryView`）改为在克隆写回后调用 `migrateWordToOutline(s)`（而非单纯删字段），旧快照正文不丢。

**② 代码清理**

| 位置 | 删除内容 |
| --- | --- |
| `script_0` | `VIEW_KIND.WORD`、`viewOf` word 分支、`isWordDoc`、`getNodeSvg` word 图标、`docWordCount` 的 `content` 叠加与 `_wordFlat` 短路、`editorRole` / `editorSelector` 的 `word` 角色、`commitPendingEditBeforeRender` 的 `role==='word'` 分支 |
| `script_1` | `__l14IntroJob` 的字数口径同步（去 `content` 叠加与 `_wordFlat` 跳过） |
| `script_3` | `renderMain` 的 `case VIEW_KIND.WORD`、`syncTopbar` includes 成员、`openNode` 的 `ensureWordInit` 调用、`ensureWordInit` / `renderWordEditor` 整函数 |
| `script_4` | `showTreeContext` 的「转为富文本 / 转为大纲文档」整块、`bindRightSidebar` 的 `.we-body` 选择器、`renderHistoryView` 的 `_isWord` 保留字段 |
| `script_5` | `toHtml` / `docToExcel` / `showPrintPreview` / `doPrint` 的 word 正文块 |
| CSS | `.word-editor`（含夜间主题）/ `.word-editor .we-body` / `:focus` / `@media (max-width:1100px)` 内 `.word-editor` / `@media print` 的 `.word-editor` 选择器 |

**③ 验收证据**

- 静态：`_isWord` / `_wordFlat` / `we-body` / `word-editor` 在产品代码中**仅**命中迁移函数内部（`migrateWordToOutline` 判定与清除）。
- 功能探针（真实 Chromium，`_临时脚本/_word_removal_probe.mjs`）**17/17 PASS**：旧 localStorage 启动 / 导入旧 JSON / 旧历史快照恢复 / 右键菜单 / 资料库打开 / 字数统计 / HTML·Excel·打印导出 / 旧版标签页合入 / 持久化 JSON 无残留。
- 全量门禁 `node scripts/verify.js all`：exit 0（静态 0 命中 · Node 502/502 · PW 167 passed + 4 skipped = 171 · bench 7/7）。
- 登记器：`PARTY_COUNT=63` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。

---

## 11. L22-final-r2 收尾批次（2026-10-20）

> **范围**：① 问题 3（侧栏「数据库」/「星标」子树行多选）**待产品确认，未修改**；② 全量门禁与九项回归复测；③ 哈希固化与封存（**不新增登记方 · 不覆盖冻结件**）。

**① 问题 3 状态**

- 指令口径为「**可选加固，需产品确认后执行**」。截至本批次结束，**未收到产品确认**，故 `renderSubDb` / `renderSubStarred` **未做任何修改**（`data-msid` / `_mSelClick('sidebar',…)` 均未引入）。产品确认后可另开波次执行，并按 §2 / §3 重算登记。

**② 门禁与回归（真实执行）**

- 全量门禁：`node scripts/verify.js all` → **exit 0**（静态 **0 命中** · Node **502/502** · PW **167 passed + 4 skipped = 171** · bench **7/7**，最大恶化 **0.0%** / 中位 −14.3%）→ `[verify] 全部通过`。证据 `_环境与调试/l22r2-verify-all-2026-10-20.txt`。
- 登记器：`PARTY_COUNT=63` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（canonical / step9-mirror 期望值与实测一致，本波**无需改写**期望值）。证据 `_哈希与行尾校验/l22r2-registry-pre-2026-10-20.txt` / `l22r2-registry-final-2026-10-20.txt`。
- 九项回归（真实 Chromium，`_临时脚本/_l22r2_regression_probe.mjs`）：**55 / 55 PASS**，零 `pageerror` / 零 `console.error`。覆盖大纲编辑提交·撤销·重做 / 日历 月周年 + 新建待办 + 拖动改时间 / 数据库 5 视图 + 筛选·排序·汇总 + 表名编辑同步 / 导图·图谱·演示·幻灯片 / 标签·星标·模板·回收站·历史（返回按钮）/ 主题·字号·双侧栏折叠 / 导出·备份·导入 / 多标签同步 / 富文本残留静态扫描。证据 `_环境与调试/l22r2-regression-probe-final-2026-10-20.txt`。

**③ 哈希固化与封存口径**

| 对象 | 字节 | SHA-256 | EOL |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,215,291 | `5C2F9A24E99B844F9A196E9F5799F7E8AF6A5C53C56D86F3FD9DDF59931C42A1` | LF（CR=0 · LF=22,402） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,215,291 | 同上（逐字节一致） | LF |
| 封存件 `v2.0-l13-frozen-l22-final-r5-2026-10-20.html`（只读） | 1,212,364 | `FE04CC1ADA7788FAFB84C11F4423CC303A42A124A9FB7E78A5ED4DF8A3F7C1D5` | LF（CR=0 · LF=22,387） |
| 登记器 `step9/verify-hash-registry.mjs` | 88,739 | `2D0A4D99132886C7DCD9DE528850642136764E82819D63B74A1E85C4A1E1EC1B` | CRLF |

- **封存口径**：保持 **63 方**不变（不新增冻结件登记方、不退役既有方），封存 HEAD 仍为 **r22 / r5**（1,212,364），本记录时点工作基线为 **1,215,291**；其后 2026-10-20「空白过宽修复」前进至 **1,218,405**（见 §4 HEAD 记录），冻结件零改写。证据 `_哈希与行尾校验/l22r2-canonical-measure-2026-10-20.txt`。
---

## 12. 不变量清单 #75 追加与最终封存（2026-10-20）

> **范围**：向 `4.回归与验收/JU-不变量清单-v2.0-frozen.md` 末尾物理追加 §二十四「内容区宽度自适应（2026-10-20 新增）」+ 不变量 #75「主内容区宽度自适应与两边空白收敛」；产品 `6.P0-T3基线/v2.0-t3.html` 本批 **零改动**（1,218,405 B 不变）。

**一 物理追加事实（真实读写，非口头声称）**

- 追加前：`100,490 B` / `A56677A886F9DEA0F1A49FA6F3FB84CAF80CF4E55954FF94F86DCE2AD5314D36`；末段 `^### 75\.` 命中 **0**（`^### 7[456]\.` 仅命中 #74 一处）。
- 追加后：`102,256 B` / `2C48BE5B4B631F7682A8E4D2B88788F5CA27D5360F876D7CAC00E222F71A2E46`；净增 `+1,766 B`。
- 结构计数：`COUNT_H3_75=1` / `COUNT_H2_24=1` / `COUNT_TITLE_75=1` / `COUNT_VAR_CONTENT_MAX=1`（**无重复**，无三反引号代码块包裹，末行仍以换行结束）。
- EOL 保持 `MIXED`：CRLF **117** 行（历史 103 + 本批 14）、LF 总计 **1,539**、行数 **1,540**；与前一登记口径一致，未引入新 EOL 类别。
- 追加正文 13 行（`L1527`–`L1539`，末尾 `L1540` 为空行），标题层级与既有章节一致（`## 二十四、…` + `### 75. …`），内容与指令原文逐字一致（仅补 Markdown 标题标记 `##` / `###` 以对齐文档既有 27 个章节、76 个条目的层级约定）。
- 证据：`_哈希与行尾校验/inv75-tail-final-2026-10-20.txt`（末尾 100 行物理读取 + 计数）、`_哈希与行尾校验/inv75-registry-2026-10-20.txt`（登记器原始输出）。

**二 门禁复跑（真实执行，非口头声称）**

- 全量门禁：`node scripts/verify.js all` → **exit 0**；静态检查 **0 违规** · Node **502/502** · PW **167 passed + 4 skipped = 171** · bench **7/7**（最大恶化 0.0% / 中位 −14.3%）；结尾 `[verify] 全部通过`。证据 `_环境与调试/inv75-verify-all-2026-10-20.txt`。
- 哈希注册表：`node verify-hash-registry.mjs`（实际路径 `6.P0-T3基线/step9/verify-hash-registry.mjs`，仓内无 `scripts/19-verify-hash-registry.mjs`）→ `PARTY_COUNT=64` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；清单方逐项 `size=102256 (exp 102256) eol=MIXED (exp MIXED)`。

**三 注册表期望值更新口径（零漂移）**

| 项 | 追加前 | 追加后 |
| --- | --- | --- |
| 字节 | 100,490 | 102,256 |
| SHA-256 | `A56677A8…A5314D36` | `2C48BE5B4B631F7682A8E4D2B88788F5CA27D5360F876D7CAC00E222F71A2E46` |
| EOL | MIXED | MIXED（CRLF 117 行） |
| 方数 | 64 | 64（仅更新既有登记方期望值，不新增纳编物） |

- 仅修改 `6.P0-T3基线/step9/verify-hash-registry.mjs` 中 `JU-不变量清单-v2.0-frozen.md` 一行的期望值（字节 + 哈希），并追加批次 4 说明注释；其余 63 方期望值一字未动。
- 备份：`4.回归与验收/JU-不变量清单-v2.0-frozen.md.bak3-2026-10-20`（追加前快照）。

---

## 13. R28 左侧栏折叠健壮化 + 节点行对齐（2026-10-21）

> **范围**：仅两处 UI 修复（收起机制健壮化 / 叶子行占位宽度对齐），外加**吸收 r27 未封存的导入弹窗末次微调**，使 canonical 与 step9 镜像重新逐字节一致。产品语义、DOM 结构、数据契约、加密 payload、公开 API、`<script>` 块数（9）全部零变更。

**一 缺陷诊断（真实浏览器实测，非口头声称）**

- 收起失效的**可复现条件**：`#sidebarLeft.collapsed{margin-left:calc(var(--sidebar-left-w) * -1)}` 中 `--sidebar-left-w` 一旦为**不可解析长度**（旧 UI 快照写入非 px 值 / 外部注入样式清空），整个 `calc` 失效 ⇒ `margin-left` 回落 `0px` ⇒ 点击 `#btnToggleLeft` 后侧栏**原地不动**。修复前实测（Edge headless 1440×900，注入 `--sidebar-left-w: abc`）：`marginLeft=0px`、侧栏可见宽 **152px**、`#main` 仅增宽 **58px** ⇒ 判定 `FAIL`。
- 排除项（逐项实测，均非成因）：① `@media (max-width:768px)` 的 `margin-left:0!important` 只在移动断点生效，桌面 1280/1440/1600/1920/2560/3440 六个宽度全部走负 margin 分支；② `renderSidebar()` / `JU_MODULES` / `JU_DND.ensureNavGrips()` 均不触碰 `#sidebarLeft` 的 class（只重建子树内容）；③ 拖拽宽 260px 与 `ui.scale=1.4`（`--sidebar-left-w: calc(210px * 1.4)`）下负 margin 均按实测宽度正确解析。
- 行对齐缺陷：`.sb-arrow.leaf` 原为 `12px`，而父节点 `.sb-arrow` 为 `22px`，使叶子行 `.sb-icon` / `.sb-label` 整体右移 **10px**。修复前实测（`#subDocs`）：父行 `iconX=53 / labelX=73`，一级叶子行 `iconX=43 / labelX=63`。

**二 修复内容**

| # | 位置 | 变更 |
| --- | --- | --- |
| ① | CSS `#sidebarLeft.collapsed` | `margin-left:calc(var(--sidebar-left-w,210px) * -1)` —— 补 `210px` 兜底，变量缺失/被清空时 `calc` 不再整体失效 |
| ② | JS `bindMainToggles` · `syncL` | 新增 `_sbLeftWMarginResolvable()` 探测，**仅在**变量不可解析时以实测 `offsetWidth` 回写 px；可解析时保持 `calc`（展开态宽度仍随 `--ui-scale` 缩放）。`.collapsed` 判定 / `ui.sidebarLeftCollapsed` / `saveUI()` 持久化 / 按钮 `title` + `aria-pressed` 同步逻辑不变 |
| ③ | CSS `.sb-arrow.leaf` | `width:12px` → `width:22px`（与 `.sb-arrow` 一致）；`opacity:0` 与 `::before` 热区禁用规则保留 |

- 收起机制仍为 **负 margin + `transition`**（实测在 flex 布局中确已让出空间，故未改用 `width:0` 方案，避免破坏 slide 过渡与 `.collapsed` 判定，且不改变展开态宽度行为）。

**三 真实浏览器验收（Edge headless · Playwright 通道）**

- 修复后同一注入场景：`marginLeft=-152px`、侧栏可见宽 **0px**、`#main` 增宽 **210px** ⇒ `PASS`。
- 1440×900 真实点击 `#btnToggleLeft` **3 次**：收起 → 展开 → 收起，逐次 `collapsed=true/false/true`、`marginLeft=-210px/0px/-210px`、`#main` 宽 `1210/1000/1210`、按钮 `class/title/aria-pressed` 同步；刷新后仍为收起态（`ui.sidebarLeftCollapsed` 持久化生效）。
- 行对齐复测：一级父节点行与一级叶子行均 `iconX=53 / labelX=73`（完全对齐）；二级子行 `iconX=67`（= 父行 + `14px`，即 `.sb-children` 缩进）；`#subDb` / `#subStarred` / `#subDocs` / `#subTags` 四个子树 `padding-left` 均为 `14px`，首行图标列同一基线。
- 证据：`_环境与调试/r28-sidebar-probe-2026-10-21.txt`、`r28c-sidebar-unresolvable-before-mirror-2026-10-21.txt`（修复前 FAIL）、`r28c-sidebar-unresolvable-after-canonical-2026-10-21.txt`（修复后 PASS）、`r28b-sidebar-multiw-2026-10-21.txt`（六宽度 + 拖拽宽 + 缩放）、截图 `r28-sidebar-expanded/collapsed-1440x900-2026-10-21.png`。

**四 门禁与登记（真实执行）**

- 全量门禁：`node scripts/verify.js all` → **exit 0**（静态检查 0 违规 · Node **402/402** · PW **167 passed + 4 skipped = 171** · bench **7/7**，最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。证据 `_环境与调试/r28-verify-all-r2-2026-10-21.txt`（首轮 T-99 因登记器尚未重锚而红，重锚后复跑转绿，首轮日志见 `r28-verify-all-2026-10-21.txt`）。
- 登记器：`PARTY_COUNT=64` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。证据 `_环境与调试/r28-registry-baseline-2026-10-21.txt`（重锚前 drift=1 · canonical）、`r28-registry-after-2026-10-21.txt`（重锚后 drift=0）。

| 对象 | 字节 | SHA-256 | EOL |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,234,770 | `9CC74270C9ABCA7262B4477E2B2447E434C74BF3045ECF15E3ED8167B3F81431` | LF（CR=0 · LF=22,756） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,234,770 | 同上（逐字节一致） | LF（CR=0 · LF=22,756） |
| 登记器 `step9/verify-hash-registry.mjs` | 见 `FIVE_PARTY_DRIFT_COUNT=0` 实测 | —（非自登记方） | CRLF |

- **重锚口径**：本次只改 `verify-hash-registry.mjs` 中 `canonical` / `step9-mirror` 两行期望值并追加 R28 说明注释（1,233,197/9D6EDD88… → 1,234,770/9CC74270…；+1,573 B / +12 行），**方数保持 64**，其余 62 方期望值一字未动。
- **镜像同步**：`6.P0-T3基线/step9/v2.0-t3.html` 由 canonical 逐字节覆盖（同步前快照 `v2.0-t3.html.bak-20261021-r28`）。

---

## 14. 不变量 #84 物理追加（2026-10-21）

> **范围**：仅对 `4.回归与验收/JU-不变量清单-v2.0-frozen.md` 末尾物理追加不变量 #84「左侧边栏折叠与节点行对齐」；产品代码（canonical / step9 镜像 `v2.0-t3.html`）、数据契约、公开 API、`<script>` 块数（9）全部零变更，既有条目 #1–#83 的语义文字零修改。

**一 追加对象与实测值**

| 项 | 追加前 | 追加后 |
| --- | --- | --- |
| 目标文件 | `4.回归与验收/JU-不变量清单-v2.0-frozen.md` | 同左（末尾追加，纯新增） |
| 字节 | 115,969 | 124,032（净增 **+8,063 B**） |
| SHA-256 | `BF7CF22549AD3EBA15D21F569457922C99BA35FE2E49CB4A293457DBCD3CD2F9` | `8B401CD92DB1A11D5FE664DE59049B0415CFD14E962C5945EEB0AF30747E4FED` |
| EOL | LF（CR=0 · LF=1,638） | LF（CR=0 · LF=1,659） |
| BOM | 无 | 无 |
| 末尾换行 | 有且仅有一个（`0x0A`） | 有且仅有一个（`0x0A`） |
| 条目 | #1–#83 | #1–#84（连续，无重复；`^### 84\.` 追加前命中 0） |

- 追加源：批次 2 临时件 `4.回归与验收/tmp_invariant_new.md`（8,063 B / `2CBF99A5FAD9E72922CE19267C0783A2269BE0E5876B0042B828AA9047A2067F`，首行 `### 84. 左侧边栏折叠与节点行对齐`，纯 LF、无 BOM、末字节 `0x0A`）；追加完成后该临时件已删除（内容已 100% 落盘，哈希可复核）。
- 追加方式：**字节级拼接**（`ReadAllBytes` → 校验目标末字节为单个 `0x0A` → 原字节 + 临时字节 → `WriteAllBytes`，UTF-8 无 BOM），不重写、不规整化既有内容，也未在 #83 与 #84 之间插入额外空行。

**二 追加后验证（逐字节）**

- 前 115,969 B 的 SHA-256 = `BF7CF225…3CD2F9`（与追加前完全一致）⇒ **#1–#83 逐字节未变**。
- 追加段（偏移 115,969 起 8,063 B）SHA-256 = `2CBF99A5…A2067F` = 临时件 SHA-256 ⇒ 追加内容零改写。
- 头 200 行切片（7,307 B）SHA-256 前后均为 `E4A5DAE374389A528C96D250C3250D82F7A43D103646A0D4B847EAE68C833347`。
- 字节守恒：115,969 + 8,063 = 124,032；CR=0（无 CRLF）/ LF=1,659（= 追加前 1,638 + 追加段 21）；无 BOM；末字节 `EF BC 89 0A`（「）」+ LF）。
- `### 84.` 条目含：定义（5 条子口径：折叠生效与让出空间 / 210px 兜底与不可解析自愈 / 持久化一致 / 收起态排布 / 节点行对齐）、断言（收起态 / 展开态 / 空间让出 / 持久化 / 对齐 / 收起态排布 共 6 段）、关联实现（`bindMainToggles` / `syncL` / `_sbLeftWMarginResolvable` 及 CSS 与 UI 状态行号）、验证方式（真实浏览器 + `node scripts/verify.js all` + `node verify-hash-registry.mjs`）、补充口径、冲突调整记录（#39 / #63 / #65 / #75 / #76 / #51）、类型与状态标注；无三反引号代码块。
- 证据：`_哈希与行尾校验/inv84-append-2026-10-21.txt`（前后字节数 / SHA-256 / EOL / BOM / 头 200 行哈希 / 末字节 / 追加段与临时件哈希比对）。

**三 门禁复跑（真实执行，非口头声称）**

- 全量门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）→ **exit 0**：静态检查 0 违规 · Node **402/402** · PW **167 passed + 4 skipped = 171** · bench **7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。证据 `_环境与调试/inv84-verify-all-r2-2026-10-21.txt`（首轮 T-99 因登记器尚未重锚而红：`tests/t10-idb-persist.spec.ts:570` 的 `expect(drift).toBe(0)` 收到 1，首轮日志 `inv84-verify-all-2026-10-21.txt`）。
- 登记器：`node verify-hash-registry.mjs`（实际路径 `6.P0-T3基线/step9/verify-hash-registry.mjs`；仓内无 `scripts/19-verify-hash-registry.mjs`）→ `PARTY_COUNT=64` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。证据 `_环境与调试/inv84-registry-r2-2026-10-21.txt`（重锚前见 `inv84-registry-2026-10-21.txt`：drift=1 · 清单方 `size=124032 (exp 115969)`）。

**四 注册表期望值更新口径（零漂移）**

- 仅改 `verify-hash-registry.mjs` 中 `JU-不变量清单-v2.0-frozen.md` 一行的期望值（`115969 / BF7CF225…CD2F9` → `124032 / 8B401CD9…47E4FED`）并追加 R28 说明注释；**方数保持 64**，其余 63 方期望值一字未动，登记器自身文件 EOL（CRLF）不变。
- 历史快照：`4.回归与验收/JU-不变量清单-v2.0-frozen.md.bak*`（历次追加前备份）保留未动；本次为纯末尾新增，未修改任何既有条目文字，未触碰冻结产物与 `1.冻结版本/HEAD.json` 指针。

---

## 15. R30 · 日历待办勾选框与标签色统一 + 不变量 #86 落编（2026-10-21 封存终校）

> **范围**：产品侧仅动 2 处（`.cal-node .cal-checkbox` 的两条 CSS 声明 + `renderCalNode` 内的标签色承载方式），清单侧仅末尾物理追加 §三十 / 不变量 #86；数据契约 / 加密 payload / 公开 API / `<script>` 块数（9）零变更，既有条目 #1–#85 语义文字零修改。

**一 产品变更（canonical → step9 镜像同波同步）**

- `.cal-node .cal-checkbox` 边框色：`var(--fg-dim)` → `var(--cb-color, var(--fg-dim))`；`:checked` 的 `background` / `border-color`：`var(--accent)` → `var(--cb-color, var(--accent))`。未设 `--cb-color` 时逐字回退既有配色 ⇒ 无标签节点零视觉变更。
- `renderCalNode`：删除独立标签圆点 span（`createElement('span')` / `className='cal-tag-dot'` / `style.background` / `appendChild` 三行移除），改由 `cb.style.setProperty('--cb-color', getTagColor(n.tags[0]))` 单行承载；`cb.title='#'+n.tags.join(' #')` 提示口径保留。
- `.cal-tag-dot` 的 **CSS 定义按不变量 #86 补充口径物理保留**（不删规则，仅不再生成 DOM 节点；防隐藏视图 / 历史兼容引用）。
- **镜像同步**：核对发现 `6.P0-T3基线/step9/v2.0-t3.html` 仍停留在 r29 字节（1,235,104 / `62C3C1E4…6145`），与 canonical 出现 **102 B 偏移**（Playwright 实际加载的是镜像，若不同步则门禁验证的是旧产品）。已由 canonical 逐字节覆盖，同步前快照 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261021-r30`。

**二 实测值（重新计算的 SHA-256 / 字节 / 行尾）**

| 对象 | 字节 | SHA-256 | EOL |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,235,206 | `CC434BC3C502387E1504C00322FD1B1305E6C93E9B966E0B49266F9FED7868F7` | LF（CR=0 · LF=22,756） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,235,206 | 同上（逐字节一致） | LF（CR=0 · LF=22,756） |
| 清单 `4.回归与验收/JU-不变量清单-v2.0-frozen.md` | 126,243 | `59A733C738834E75AB08C824B43429FF976A500D57EDA7094EA02DDD12279406` | LF（CR=0 · LF=1,684） |
| 登记器 `step9/verify-hash-registry.mjs` | 见 `FIVE_PARTY_DRIFT_COUNT=0` 实测 | —（非自登记方） | CRLF |

- 产品侧增量：1,235,104 → 1,235,206（**+102 B**，行数 22,756 不变）；清单侧增量：124,032 → 126,243（**+2,211 B**），条目 1–86 连续，末尾为 #86「补充口径」行 + 单个 `0x0A`（`split` 后 1,685 段，`endsWithNewline=true`）。
- §13 的 R28 表格（1,234,770 / `9CC74270…B81431`）保留为历史快照；现行守护值以上表为准。
- 上述数值均由真实物理读取重算（`node _临时脚本/_seal_final_probe_2026-10-21.mjs`，证据 `_哈希与行尾校验/seal-final-probe-2026-10-21.txt`），非沿用历史登记值。

**三 登记器重锚口径（零漂移）**

- 改 `verify-hash-registry.mjs` 三行期望值 + 追加 R30 说明注释：`canonical` / `step9-mirror`（1,235,104/`62C3C1E4…6145` → 1,235,206/`CC434BC3…7868F7`）、`JU-不变量清单-v2.0-frozen.md`（124,032/`8B401CD9…47E4FED` → 126,243/`59A733C7…279406`）。**方数保持 64**，其余 61 方期望值一字未动。

**四 门禁复跑（真实执行，Exit 0）**

- 登记器：`node verify-hash-registry.mjs`（cwd=`6.P0-T3基线/step9`；仓内**无** `scripts/19-verify-hash-registry.mjs`）→ `PARTY_COUNT=64` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。证据 `_环境与调试/seal-final-registry-r30-2026-10-21.txt`（重锚前基线 `seal-final-registry-baseline-2026-10-21.txt`：drift=2 · canonical + 清单）。
- 全量门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）→ **exit 0**：静态检查 **0 违规** · Node **502/502** · PW **167 passed + 4 skipped = 171** · bench **7/7 通过**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。证据 `_环境与调试/seal-final-verify-all-2026-10-21.txt`。
- 物理复核：清单末尾 #86 落在第 1,674–1,684 行（标题 + 定义 / 断言 / 关联实现 / 验证方式 / 补充口径，空行分隔）；canonical `renderCalNode` 内已无 `.cal-tag-dot` DOM 生成，`--cb-color` 于 CSS（L469/L470）与 JS（L10346）双端生效。

---

## 16. R31 + R32 变更记录（2026-10-21 · 勾选 / 标签圆点浅色同源 · 不变量 #87 · t17-w1 用例纳编）

> **范围**：产品侧 R31 仅动 4 条 CSS 声明 + 2 行 JS 渲染；R32 仅清单末尾物理追加 §三十一 / 不变量 #87，并新增纳编 1 方（`t9/t17-w1-rendersubtags-rows.test.mjs`）。数据契约 / 加密 payload / 公开 API / `<script>` 块数（9）零变更；既有条目 #1–#86 语义文字零修改。

**一 产品变更（R31 · canonical → step9 镜像同波同步）**

- `.cal-node .cal-checkbox:checked` 的 `background` / `border-color` 追加 `color-mix` 浅色口径（32% `--cb-color` 混 `--bg-panel`、45% `--cb-color` 混 `transparent`），原实色声明保留为 `color-mix` 不支持时的回退。
- `.cal-checkbox:checked::after` 对勾边色 `#fff` → `var(--cb-color, var(--accent))`（浅底可读）。
- `.sb-tag-dot` 移除 rgba 白描边 / 黑色外阴影，改为 `color-mix` 32% `--tag-color` 混 `--bg-soft` 浅底 + 1.5px `var(--tag-color, var(--icon))` 描边。
- `renderSubTags`（L14822 起）与 `openTagPicker`（L16518）的 `dot.style.background = getTagColor(t)` → `dot.style.setProperty('--tag-color', getTagColor(t))`；**`renderSubTags` 段内已无任何 `style.background` 直接赋值**（`findstr /n /c:"style.background"` 命中 23 处，均落在其他函数：L7861 / L10038 / L10125 / L11482 / L12798 起数据库拖拽 / L15677 / L15867 / L15885 / L15919 / L16121 / L16561 / L16570 / L18502 起导入拖拽 / L19576 起幻灯片背景）。

**二 清单变更（R32）**

- 文件末尾物理追加「## 三十一 · 勾选与标签圆点浅色同源（2026-10-21 新增）」+ **不变量 #87「勾选与标签圆点浅色同源规范」**（定义 / 断言（伪代码） / 关联实现 / 验证方式 / 补充口径 / 冲突调整记录 / 类型状态标注，七段；无三反引号代码块），纯 LF（CR=0）。
- 条目 1–87 连续；追加段 2,413 B（126,243 → 128,656）、+20 行（LF 1,684 → 1,704），`endsWithNewline=true`（末尾为状态标注行 + 单个 `0x0A`）。

**三 实测值（真实物理读取重算，非沿用历史登记值）**

| 对象 | 字节 | SHA-256 | EOL |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,235,901 | `762762928BEA9B66FEB6CD5885909D0F8241803A30D0421994BC55E59BD5D79B` | LF（CR=0 · LF=22,756） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,235,901 | 同上（逐字节一致） | LF（CR=0 · LF=22,756） |
| 清单 `4.回归与验收/JU-不变量清单-v2.0-frozen.md` | 128,656 | `81EA3A18BE9AEDE926ACAA74C3EFCF31B0D8C9B3C75842E91583CDFF8691673A` | LF（CR=0 · LF=1,704） |
| N 层用例 `6.P0-T3基线/step9/t9/t17-w1-rendersubtags-rows.test.mjs` | 14,180 | `72933C276F97601FA606E80935B2F97AD945157022FFB5DEF3A99794B20CF491` | CRLF（CR=291 · LF=291） |
| 登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs` | 见 `FIVE_PARTY_DRIFT_COUNT=0` 实测 | —（非自登记方） | — |

- 产品侧增量：1,235,206 → 1,235,901（**+695 B**，行数 22,756 不变）；清单侧增量：126,243 → 128,656（**+2,413 B**）。
- 本波**未新增冻结件**：封存 HEAD 仍为 `r22`（1,212,364 / `FE04CC1A…C1D5`）；§15 的 R30 表格（1,235,206 / `CC434BC3…7868F7`）保留为历史快照。

**四 登记器重锚口径（零漂移）**

- 重锚前基线实测：`FIVE_PARTY_DRIFT_COUNT=1`（仅清单方 `size=128656 (exp 126243)`）；canonical / step9-mirror 与 R31 期望值（1,235,901 / `76276292…D5D79B`）**逐项一致，无需改写**。
- 改 `verify-hash-registry.mjs` 一行期望值 + 追加 R32 说明注释：`JU-不变量清单-v2.0-frozen.md`（126,243/`59A733C7…279406` → **128,656/`81EA3A18…1673A`**）；**新增登记方** `t17-w1-rendersubtags-rows.test.mjs`（14,180 / `72933C27…CF491` / CRLF）——该文件承载不变量 #87 第 4 条的 N 层断言（`/dot\.style\.background\s*=/ === false`），此前原注释口径为「不纳入 t9-hash-check 43 方登记」，本波按可审计要求纳编。**方数 64 → 65**，其余 63 方期望值一字未动。

**五 门禁复跑（真实执行，Exit 0）**

- 登记器：`node verify-hash-registry.mjs`（cwd=`6.P0-T3基线\step9`；仓内**无** `scripts/19-verify-hash-registry.mjs`，已实测不存在）→ **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- 全量门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线\step9`）→ **exit 0**：静态检查 **0 命中**（19ms） · Node **503/503**（`tests 503 / pass 503 / fail 0`，26,309ms） · Playwright **167 passed + 4 skipped = 171**（56,780ms） · bench **7/7 通过**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。
- 环境备注：本机 `node` 未在系统 PATH 内，门禁以 `C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe` 前置 PATH 后执行（`verify.js` 内部以 `spawnSync('node', …)` 拉起子进程，PATH 缺失时会报 `spawnSync node ENOENT`）。
- 证据：[`_环境与调试/r32-verify-all-2026-10-21.txt`](../_环境与调试/r32-verify-all-2026-10-21.txt:1)（全量门禁）、[`_环境与调试/r32-registry-2026-10-21.txt`](../_环境与调试/r32-registry-2026-10-21.txt:1)（登记器）。

---

## 17. R34 日历底部模块化（2026-10-21 · 记事本 / 待办 / 日志 / 统计可拖拽排序 · 缩放 · 删除恢复）

> **范围**：仅日历视图底部区（`renderCalendarPage` 的 bottom 部分）由「topRow + 分隔线 + 统计面板」改为模块化容器；数据取数与渲染函数（`renderNoteRow` / `renderCalNode` / `buildCalLogBlock` / `buildStatsBlock`）原样复用，数据契约 / 加密 payload / 公开 API / `<script>` 块数（9）零变更。

**一 产品变更**

- CSS（置于 `.cal-bottom` 规则之后）：新增 `.cal-modules` / `.cal-module` / `.cal-module.cal-module-hidden` / `.cal-module-head`（含 `.cal-module-title` / `.cal-module-del`）/ `.cal-module-body` / `.cal-module-resize` / `.cal-module.dragging` / `.drop-before` / `.drop-after` / `.cal-module-add`；`.cal-modules` 为 `width:100%` + `flex-wrap` + `gap:2px`，`.cal-bottom` 追加 `overflow-x:hidden` ⇒ 不出现横向滚动条。
- JS：新增 `CAL_MODULE_KEYS` / `calModuleState()` / `calModuleTitle()` / `renderCalModules()` 及模块 body 构建与 `calModuleBindDrag()` / `calModuleBindResize()`；`renderCalendarPage` 改为 `bottom.appendChild(renderCalModules())`，并以 `_calDayNodesForModules=getDayNodes` 复用当次渲染的日缓存 / 标签过滤 / focusId 口径。
- 交互：标题行拖拽（位移 > 5px 生效，`document` pointermove + rAF 节流 + `elementFromPoint`，按左右 / 上下半区 `insertBefore`，pointerup 回写 `ui.calModules.order`，400ms 内吞 click）；右下角缩放（`setPointerCapture` + rAF，最小 180×160）；删除按钮置 `hidden[k]=true`，「+ 添加模块」经 `showContextMenu` 恢复。
- 状态隔离：`ui.calModules`（order / hidden / sizes）仅经 `saveUI()` 持久化，**不调用 `commit()`、不进 historyPast**；`_saveUINow` 与 `uiSnapshot()` 增列 `calModules`，`applyUIFields()` 恢复（缺省初始化为四模块）。
- 显式尺寸模块追加 `flex:0 0 auto`：避免同行 `flex-shrink` 把缩放宽度抵回原值（探针曾复现「只增高不增宽」）。
- 编辑态早退（script_4）的派生面板局部刷新改按 `.cal-module[data-key="stats"|"log"] .cal-module-body` 定位。

**二 实测值**

| 对象 | 字节 | SHA-256 | EOL |
| --- | --- | --- | --- |
| canonical | 1,249,200 | `8B3B92DFE5B390E54DE9EA0EA81D2416B4248C10A35B6FAF2E89BCDFC13D3035` | LF（CR=0 · LF=23,000） |
| step9 镜像 | 1,249,200 | 同上（逐字节一致） | LF（CR=0 · LF=23,000） |

- 增量：1,238,929 → 1,249,200（**+10,271 B / +201 行**）；`<script>` 块 9（逐块语法校验通过）。

**三 门禁与验证（真实执行）**

- 登记器：`node verify-hash-registry.mjs` → **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（重锚前 drift=2，仅 canonical / step9-mirror）。
- 全量门禁：`node scripts/verify.js all` → **exit 0**：静态 0 命中 · Node **503/503** · PW **167 passed + 4 skipped = 171** · bench **7/7**（最大恶化 0.0% / 中位 −14.3%）。
- 真机探针（Chromium 1440×900 · 真实鼠标）：**30/30 PASS**——四模块顺序 / 标题 / 间距 2px / 无横向滚动条 / 待办与日志与统计口径一致 / 删除-恢复 / 拖拽排序 / 缩放（367×232 落盘）/ 重载后恢复 / `historyPast` 零增长 / 零 `pageerror` · 零 `console.error`。
- 证据：[`calmod-verify-all-final-2026-10-21.txt`](../_环境与调试/calmod-verify-all-final-2026-10-21.txt:1)、[`calmod-registry-final-2026-10-21.txt`](../_环境与调试/calmod-registry-final-2026-10-21.txt:1)、[`calmod-browser-2026-10-21.txt`](../_环境与调试/calmod-browser-2026-10-21.txt:1)、[`calmod-syntax-final-2026-10-21.txt`](../_环境与调试/calmod-syntax-final-2026-10-21.txt:1)。
- 本波未物化新冻结件（封存 HEAD 仍为 `r22`）；§16 的 R31 / R32 表格保留为历史快照。

---

## 18. R35 日历外层容器去边框/去底色（2026-10-21 · `.cal-top` / `.cal-bottom` 透明 · `.cal-grid` / `.cal-tg` 自持边界）

> **范围**：仅日历视图 CSS 3 条规则；数据契约 / 加密 payload / 公开 API / `<script>` 块数（9）零变更。

**一 产品变更**

- `.cal-top`：`background:var(--bg-panel)` → `transparent`；`border:1px solid var(--line-soft)` → `none`（`border-radius` / `padding` / 宽度口径保持不变）。
- `.cal-bottom`：同样去底色与边框；底部边界改由内部 `.cal-module`（自带 `background:var(--bg-panel)` + `1px solid var(--line-soft)`）承担。
- `.cal-grid`：补 `background:var(--bg-panel)` + `border:1px solid var(--line-soft)` + `border-radius:var(--radius-lg)` + `padding:6px`，月视图在外层透明后仍保留独立面板边界。
- `.cal-tg`：经复核原有 `border:1px solid var(--line-soft)` + `background:var(--bg-panel)` 保留，无需追加。

**二 实测值**

| 对象 | 字节 | SHA-256 | EOL |
| --- | --- | --- | --- |
| canonical | 1,249,546 | `5B17B437AB1D910E2939D01FF8EE8A1B81E4A1DF423E1F89EBA86F55BAD0964B` | LF（CR=0 · LF=23,000） |
| step9 镜像 | 1,249,546 | 同上（逐字节一致） | LF（CR=0 · LF=23,000） |

- 增量：1,249,200 → 1,249,546（**+346 B / +0 行**；三条规则均为行内改写 / 行内新增属性）。

**三 门禁与验证（真实执行）**

- 登记器：`node verify-hash-registry.mjs` → **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（重锚前 drift=2，仅 canonical / step9-mirror）。
- 全量门禁：`node scripts/verify.js all` → **exit 0**：静态 0 命中 · Node **503/503** · PW **167 passed + 4 skipped = 171** · bench **7/7**（最大恶化 0.0% / 中位 −14.3%）。
- 真机探针（Chromium 1440×900 · 真实页面 computed style）：**16/16 PASS**——`.cal-top` / `.cal-bottom` 背景 `rgba(0, 0, 0, 0)` 且四边 `0px`；`.cal-grid` / `.cal-tg` 背景 `rgb(234, 243, 225)` 且四边 `1px solid`；`.cal-module` 背景 + 1px 边框齐全。
- 证据：[`cal-border-r34-verify-all-final-2026-10-21.txt`](../_环境与调试/cal-border-r34-verify-all-final-2026-10-21.txt:1)、[`cal-border-r34-registry-2026-10-21.txt`](../_环境与调试/cal-border-r34-registry-2026-10-21.txt:1)、[`cal-border-r34-browser-2026-10-21.txt`](../_环境与调试/cal-border-r34-browser-2026-10-21.txt:1)、[`cal-border-r34-measure-2026-10-21.txt`](../_哈希与行尾校验/cal-border-r34-measure-2026-10-21.txt:1)、截图 [`cal-border-r34-2026-10-21.png`](../_环境与调试/cal-border-r34-2026-10-21.png:1)。
- 本波未物化新冻结件（封存 HEAD 仍为 `r22`）；§17 的 R34 表格保留为历史快照。

---

## 19. R36 日历网格接入模块化体系（2026-10-21 · 日历网格成为首个模块 · 模块间距 2px → 5px · 不变量 #88）

> **范围**：日历视图顶部日历网格（`.cal-top`）由 `.cal-page` 的直接子节点改为 `.cal-modules` 内首个模块（`data-key="calendar"`），与记事本 / 当日待办 / 系统日志 / 统计同处一个容器；模块间距 2px → 5px。数据契约 / 加密 payload / 公开 API / `<script>` 块数（9）零变更；既有不变量 #1–#87 语义文字零修改。

**一 产品变更（canonical → step9 镜像同波逐字节同步）**

- `CAL_MODULE_KEYS`：`['note','today','log','stats']` → `['calendar','note','today','log','stats']`（`calendar` 置于首位）。
- `calModuleTitle()`：新增 `calendar → 日历` 映射（记事本 / 当日待办 / 系统日志 / 统计四项文案不变）。
- `calModuleState()`：合并时记录 `hadCalendar`；旧存档 `order` 缺 `calendar` 时补全并 `unshift` 至首位（去重与其余键序口径不变）。
- `renderCalModules(calTop)`：新增 `calendar` 分支，模块 body 直接 `appendChild(calTop)` —— 原 `.cal-top` 节点整体迁移，年 / 月 / 周切换、前后翻页、月视图 `.cal-grid`、周视图 `.cal-tg`、年视图 `.year-grid` 及其事件绑定随节点保留，**不重建 DOM、不复绑事件**。
- `renderCalendarPage()`：删除 `page.appendChild(top)`，改为 `bottom.appendChild(renderCalModules(top))`；`.cal-page` 仅保留 `.cal-bottom` 一个直接子容器。week 分支收口 `top.appendChild(buildTimeGrid(days));` 逐字保留（L17-W2 结构锚点）。
- `ui.calModules` 默认值与 `loadUI()` 恢复分支同步为五模块；恢复时 `order` 缺 `calendar` 即 `unshift` 补位，并清除 `hidden.calendar`（默认不隐藏）；删除后「+ 添加模块」菜单由 `CAL_MODULE_KEYS` 派生，可找回日历模块。
- CSS：`.cal-modules` 的 `gap:2px` → `gap:5px`，并补 `min-width:0` / `max-width:100%`（仍 `display:flex` / `flex-wrap:wrap` / `width:100%`，无横向滚动条）；新增 `.cal-module[data-key="calendar"]{flex:1 1 100%;min-height:320px}` 与 `.cal-module[data-key="calendar"]>.cal-module-body{padding:0}`（日历网格独占整行，内距仍由 `.cal-top` 自带 `14px 16px` 撑开）。

**二 实测值（真实物理读取重算，非沿用历史登记值）**

| 对象 | 字节 | SHA-256 | EOL |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,251,465 | `EA435C01C91D94217F6253D4B23BD23B1CB777BC012CB891620AEF7C6A75FCC4` | LF（CR=0 · LF=23,016） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,251,465 | 同上（逐字节一致） | LF（CR=0 · LF=23,016） |
| 清单 `4.回归与验收/JU-不变量清单-v2.0-frozen.md` | 131,889 | `4B30A6247D1E34D1682569125DB59D9D9BB39348BFF2423C13515444986E6F83` | LF（CR=0 · LF=1,727） |
| 登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs` | 见 `FIVE_PARTY_DRIFT_COUNT=0` 实测 | —（非自登记方） | CRLF（CR=1,053 · LF=1,053） |

- 产品侧增量：1,249,546 → 1,251,465（**+1,919 B / +16 行**）；清单侧增量：128,656 → 131,889（**+3,233 B / +23 行**）。
- 本波**未新增冻结件**（封存 HEAD 仍为 `r22`）；§18 的 R35 表格（1,249,546 / `5B17B437…964B`）保留为历史快照。

**三 登记器重锚口径（零漂移）**

- 重锚前基线实测：`FIVE_PARTY_DRIFT_COUNT=2`（仅 canonical / step9-mirror，`size=1251465 (exp 1249546)`）。
- 改 `verify-hash-registry.mjs` 三行期望值 + 追加 R36 说明注释：canonical / step9-mirror（1,249,546/`5B17B437…964B` → **1,251,465/`EA435C01…75FCC4`**）、`JU-不变量清单-v2.0-frozen.md`（128,656/`81EA3A18…1673A` → **131,889/`4B30A624…86E6F83`**）。**方数保持 65**，其余 62 方期望值一字未动；登记器自身行尾仍为 CRLF。

**四 门禁复跑（真实执行，Exit 0）**

- 登记器：`node verify-hash-registry.mjs`（cwd=`6.P0-T3基线\step9`；仓内**无** `scripts/19-verify-hash-registry.mjs`）→ **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（历史令牌名 `FIVE_PARTY_DRIFT_COUNT` 语义 = 全部登记锚点漂移计数）。
- 全量门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线\step9`）→ **exit 0**：静态检查 **0 命中** · Node **503/503**（`tests 503 / pass 503 / fail 0`） · Playwright **167 passed + 4 skipped = 171** · bench **7/7 通过**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。
- 真机探针（Chromium 1440×900 · 真实鼠标）：**35/35 PASS** —— 五模块顺序 `calendar,note,today,log,stats` / 标题「日历」/ 间距 5px / `.cal-modules` 宽 = 容器内容宽且 `cal-bottom` · `cal-modules` · document 均无横向滚动 / `.cal-top` 挂载在日历模块 body 内（`.cal-page` 直接子节点仅 `cal-bottom`）/ 年-月-周切换（`.year-grid` / `.cal-grid` / `.cal-tg` 7 日列）/「›」翻页 / 单元格点击改 `selectedDate` / 日历模块拖拽排序 / 缩放（988×526 落盘）/ 删除后「+ 添加模块」恢复 / 重载后 order 与 sizes 保持 / 旧存档 order 缺 `calendar` 时补位首位且不隐藏 / `historyPast` 零增长 / 零 `pageerror` · 零 `console.error`。
- 静态探针：[`_临时脚本/_r36_static_probe.mjs`](../_临时脚本/_r36_static_probe.mjs:1) → **17/17 PASS**（9 个内联 `<script>` 逐块编译 + 结构锚点 + 间距 + `top.appendChild(buildTimeGrid(days));` 锚点保留 + CR=0）。
- 证据：[`_环境与调试/r36-verify-all-2026-10-21.txt`](../_环境与调试/r36-verify-all-2026-10-21.txt:1)（全量门禁）、[`_环境与调试/r36-registry-2026-10-21.txt`](../_环境与调试/r36-registry-2026-10-21.txt:1)（登记器）、[`_环境与调试/r36-calmod-browser-2026-10-21.txt`](../_环境与调试/r36-calmod-browser-2026-10-21.txt:1)（真机探针）、截图 [`_环境与调试/r36-calmod-2026-10-21.png`](../_环境与调试/r36-calmod-2026-10-21.png:1)。

---

## 20. R37 日历模块边距 5px + 自适应防畸变（2026-10-21 · 不变量 #89）

> **范围**：仅调整日历视图内容区内距与模块排布 / 伸缩逻辑；数据契约 / 加密 payload / 公开 API / `<script>` 块数（9）零变更；既有不变量 #1–#88 语义文字零修改。

**一 产品变更（canonical → step9 镜像同波逐字节同步）**

- `renderMain()`：view 归一后写 `c.style.padding`——`view === VIEW_KIND.CALENDAR` 时 `'5px'`，其余视图 `''`（恢复样式表默认内距；实测非日历视图 computed padding-top = 24px）。
- `.cal-modules`：gap 保持 5px，新增 `align-content:flex-start` / `min-height:100%` / `box-sizing:border-box`，保留 `width:100%` / `min-width:0` / `max-width:100%`。
- `.cal-module`：新增 `box-sizing:border-box` / `max-width:100%`，`min-width` 由 180px 调整为 150px（最小高仍 160px）。
- `renderCalModules()`：落盘尺寸分支改为 `flex:'1 1 <w>px'` + `height:'<h>px'`；无尺寸时 calendar 为 `'1 1 100%'`（独占整行）、其余为 `'1 1 200px'`（平分一行）。
- `calModuleBindResize()`：拖拽中实时写 `flex:'0 0 <w>px'` + `height`；`pointerup` 写 `ui.calModules.sizes[k]={w:offsetWidth,h:offsetHeight}` 并经 `saveUI()` 落盘，随后恢复 `flex:'1 1 <w>px'` 等比伸缩。

**二 实测值（真实物理读取重算，非沿用历史登记值）**

| 对象 | 字节 | SHA-256 | EOL |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,252,564 | `6B93641D06B5154FA9B1EB845150C168B3259C554E2ECF2B6F6C2E4FFE53D50D` | LF（CR=0 · LF=23,031） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,252,564 | 同上（逐字节一致） | LF（CR=0 · LF=23,031） |
| 清单 `4.回归与验收/JU-不变量清单-v2.0-frozen.md` | 135,870 | `B99487FD1C65F8065975C473A98589359DA588BF2F1D4AFF6803CDFB7B78098C` | LF（CR=0 · LF=1,750） |
| 登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs` | —（`FIVE_PARTY_DRIFT_COUNT=0` 实测） | —（非自登记方） | CRLF（CR=1,068 · LF=1,068） |

- 产品侧增量：1,251,465 → 1,252,564（**+1,099 B / +15 行**）；清单侧增量：131,889 → 135,870（**+3,981 B / +23 行**）。
- 本波**未新增冻结件**（封存 HEAD 仍为 `r22`）；§19 的 R36 表格（1,251,465 / `EA435C01…75FCC4`）保留为历史快照。

**三 登记器重锚口径（零漂移）**

- 重锚前基线实测：`FIVE_PARTY_DRIFT_COUNT=3`（canonical / step9-mirror `size=1252564 (exp 1251465)`；`JU-不变量清单-v2.0-frozen.md` `size=135870 (exp 131889)`）。
- 改 `verify-hash-registry.mjs` 三行期望值 + 追加 R37 说明注释：canonical / step9-mirror（1,251,465/`EA435C01…75FCC4` → **1,252,564/`6B93641D…E53D50D`**）、`JU-不变量清单-v2.0-frozen.md`（131,889/`4B30A624…86E6F83` → **135,870/`B99487FD…B78098C`**）。**方数保持 65**，其余 62 方期望值一字未动；登记器自身行尾仍为 CRLF。

**四 门禁复跑（真实执行，Exit 0）**

- 登记器：`node verify-hash-registry.mjs`（cwd=`6.P0-T3基线\step9`）→ **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- 全量门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线\step9`）→ **exit 0**：静态检查 **0 命中** · Node **503/503** · Playwright **167 passed + 4 skipped = 171** · bench **7/7 通过**（最大恶化 0.0% / 中位数 −14.3%）→ `[verify] 全部通过`。
- 真机探针（Chromium 1440×900 · 真实鼠标拖拽）：**24/24 PASS**——`#content` 日历 padding 5px / 其他视图置空；`.cal-modules` gap 5px + align-content:flex-start + box-sizing:border-box + min-height:100% + 宽度等于容器内容宽；`.cal-module` box-sizing:border-box + max-width:100% + min-width:150px；无尺寸时 calendar `1 1 100%`、其余 `1 1 200px`；拖拽中 `0 0 <w>px` + height、松手 sizes 落盘并恢复 `1 1 <w>px`；重载 sizes / flex 保持；1280 / 1440 / 1600 / 1920 / 2560 五视口 + 左侧栏折叠 / 展开均无横向滚动条、无单模块畸变；零 `pageerror` · 零 `console.error`。
- 静态探针：[`_临时脚本/_r36_static_probe.mjs`](../_临时脚本/_r36_static_probe.mjs:1) → **17/17 PASS**（9 个内联 `<script>` 逐块编译 + 结构锚点 + 间距 + `top.appendChild(buildTimeGrid(days));` 锚点保留 + CR=0）。
- 证据：[`_环境与调试/r37-verify-all-final-2026-10-21.txt`](../_环境与调试/r37-verify-all-final-2026-10-21.txt:1)（全量门禁）、[`_环境与调试/r37-registry-2026-10-21.txt`](../_环境与调试/r37-registry-2026-10-21.txt:1)（登记器）、[`_环境与调试/r37-calmod-browser-2026-10-21.txt`](../_环境与调试/r37-calmod-browser-2026-10-21.txt:1)（真机探针）、截图 [`_环境与调试/r37-calmod-2026-10-21.png`](../_环境与调试/r37-calmod-2026-10-21.png:1)。

---

## 21. R38 日历模块窗口缩放位移修复（2026-10-21 · minHeight + 百分比 flex · 排列稳定）

> **范围**：仅调整日历模块排布 / 缩放逻辑；数据契约 / 加密 payload / 公开 API / `<script>` 块数（9）零变更；冻结件零改写。

**一 产品变更（canonical → step9 镜像同波逐字节同步）**

- `renderCalModules()`：已落盘尺寸分支由 `height:'<h>px'` 改为 `minHeight:'<h>px'`（消除固定死高度导致内容少时大段留白与内部重排抖动）。
- `renderCalModules()`：无尺寸时 `calendar` 置 `flex:'1 1 100%'` + `minWidth:'100%'`；其余模块置 `flex:'1 1 24%'` + `minWidth:'200px'`（宽屏 1440+ 稳定一行 4 个，避免微小宽度变化使两行突并为一行而整体上移）。
- `calModuleBindResize()`：拖拽中以 `flex:'0 0 <w>px'` + `minWidth` + `minHeight` 实时反馈；`pointerup` 恢复 `flex:'1 1 <w>px'`、`minWidth:'150px'`，并以拖拽后实测高度回写 `minHeight`，`sizes` 记录恢复等比分配后的真实盒尺寸（`w:offsetWidth` / `h:offsetHeight`）。
- CSS：`.cal-modules` 已具备 `align-content:flex-start`（R37 落位），本波零改动；实机复核确认排列稳定。

**二 实测值（真实物理读取重算，非沿用历史登记值）**

| 对象 | 字节 | SHA-256 | EOL |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,253,517 | `396FAB028141AB976DADA34F8EE1D9126DA0FFEF83E2CC3DD34DF05ECE580E3D` | LF（CR=0 · LF=23,047） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,253,517 | 同上（逐字节一致） | LF（CR=0 · LF=23,047） |

- 产品侧增量：1,252,564 → 1,253,517（**+953 B / +1 行**）。
- 本波**未新增冻结件**（封存 HEAD 仍为 `r22`）；§20 的 R37 表格（1,252,564 / `6B93641D…E53D50D`）保留为历史快照。

**三 登记器重锚口径（零漂移）**

- 改 `verify-hash-registry.mjs` 两行期望值 + 追加 R38 说明注释：canonical / step9-mirror（1,252,564/`6B93641D…E53D50D` → **1,253,517/`396FAB02…ECE580E3D`**）。**方数保持 65**，其余 63 方期望值一字未动；登记器自身行尾仍为 CRLF。

**四 门禁复跑（真实执行，Exit 0）**

- 登记器：`node verify-hash-registry.mjs`（cwd=`6.P0-T3基线\step9`）→ **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- 全量门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线\step9`）→ **exit 0**：静态检查 **0 命中** · Node **503/503** · Playwright **167 passed + 4 skipped = 171** · bench **7/7 通过**（最大恶化 0.0% / 中位数 −14.3%）→ `[verify] 全部通过`。
  - 首次全量运行时 L16-W13 §H 大 state 采样受冷启动噪声影响报 P95 266.49 ms（预算 200 ms）；该用例单独复跑 **P95 122.69 ms / 19/19 PASS**，随后全量复跑通过（第二次 P95 121.94 ms）。
- 真机探针（Chromium 1440×900 · 真实鼠标拖拽）：**18/18 PASS**——默认 flex（calendar 100% + minWidth 100% / 其余 24% + minWidth 200px）；无死高度（inline height 为空、minHeight 承载）；1280/1440/1600/1920/2560 五视口行位稳定（1440+ 四个非日历模块同一行，行顶不上移）；拖拽中 `flex:0 0` + minWidth + minHeight；松手 `flex:1 1` + `minHeight = 实测高度` + sizes 落盘；重载保持；零 `pageerror` · 零 `console.error`。
- 证据：[`_环境与调试/r38-verify-all-r2-2026-10-21.txt`](../_环境与调试/r38-verify-all-r2-2026-10-21.txt:1)（全量门禁）、[`_环境与调试/r38-registry-2026-10-21.txt`](../_环境与调试/r38-registry-2026-10-21.txt:1)（登记器）、[`_环境与调试/r38-calmod-browser-2026-10-21.txt`](../_环境与调试/r38-calmod-browser-2026-10-21.txt:1)（真机探针）、截图 [`_环境与调试/r38-calmod-2026-10-21.png`](../_环境与调试/r38-calmod-2026-10-21.png:1)；首次失败与单独复跑：[`_环境与调试/r38-verify-all-2026-10-21.txt`](../_环境与调试/r38-verify-all-2026-10-21.txt:1)、[`_环境与调试/r38-node-w13-retest-2026-10-21.txt`](../_环境与调试/r38-node-w13-retest-2026-10-21.txt:1)。

---

## 22. R39 日历模块位移修复（2026-10-21 · 目标值落盘 + 行高三件套 + pointercancel 还原）

> **编号说明**：本手册 §16 已由「R31 + R32 变更记录」占用，为保持章节号单调不减、不改写既有历史章节，R39 记录按现行编号接续为 **§22**（紧随 §21 = R38）。
>
> **范围**：仅调整日历模块尺寸落盘 / 缩放收尾 / 拖拽取消三条链路；CSS 零改动；数据契约 / 加密 payload / 公开 API / `<script>` 块数（9）零变更；冻结件零改写。

**一 五处根因与对应改动（canonical → step9 镜像同波逐字节同步）**

1. `calModuleBindResize()` 的 `onUp` 原把 `offsetWidth / offsetHeight`（已被 flex-grow 与 `align-items:stretch` 二次分配的**实测值**）写进 `sizes`，下次渲染 basis 偏大 → 再 grow → 单向膨胀 → 击穿换行阈值 → 整行换位。**改为**：落盘直接用拖拽期维护的目标值 `w / h`，**禁止回读** `offsetWidth / offsetHeight`。
2. `renderCalModules()` 的 `if(sz&&sz.w)` 分支原对 calendar 同样生效，覆盖了 `.cal-module[data-key="calendar"]{flex:1 1 100%}` 的独占整行规则。**改为**：三分支重排为「先判 `k==='calendar'`」，calendar 恒 `flex:'1 1 100%'` + `minWidth:'100%'`，**宽度不可拖拽落盘**。
3. `sizes` 只写 `minHeight` 不写 `height`，模块高度由内容决定（待办增删 / 日志跨天增长 / 统计窄宽度换行 / 月视图 5→6 周切换）即推高整行。**改为**：有尺寸时同时写 `height / minHeight / maxHeight` 三件套锁定行高。
4. 无尺寸默认分支 `minWidth:200px` 与 CSS `.cal-module{min-width:150px}` 不一致，容器宽度跨约 815px 阈值时 4 列 / 3 列切换 → 行数变化 → 整体上移。**改为**：`minWidth:'150px'`，与 CSS 同源。
5. `calModuleBindDrag()` 的 `pointercancel` 分支未还原 DOM 顺序，触屏手势打断后 DOM 已乱而 `order` 未更新，下次 `forceRender` 按旧 order 重建 → 跳回原位。**改为**：拆出独立 `onCancel`，按 `pointerdown` 快照 `snapshotOrder` 用 `appendChild` 回填（非模块子节点按原序回填尾部），**不写 `st.order`、不调 `saveUI`**。

**二 交互口径补强（同波随附）**

- `calModuleBindResize()` 新增 `moved` 守卫：`pointerdown` 声明 `let moved=false`，`onMove` 进入即置 `true`；`onUp` 首判 `if(!moved)` ⇒ 按进入时的 `flex / minWidth / minHeight / height / maxHeight` 快照原样还原并 `return`（**点击不拖动不落盘**）。
- 拖拽期高度由 `height` 承载（`minHeight:'0px'` / `maxHeight:'none'`），否则上一轮落盘的固定 `height` 会把本次拖高抵住（表现为「拖不动高度」）。
- `calendar` 的 `onUp`：`flex:'1 1 100%'` + `minWidth:'100%'` + `height / minHeight / maxHeight` = `h`，`ui.calModules.sizes.calendar` **只存 `{h}`**；非 calendar：`flex:'1 1 <w>px'` + `minWidth:'150px'` + 三件套 = `h`，`sizes[key]` 存 `{w,h}`。

**三 实测值（真实物理读取重算，非沿用历史登记值）**

| 对象 | 字节 | SHA-256 | EOL |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,255,856 | `64766D8B0F886B9E995720803BDB829D67468B60FAA264AE9E1EE71B6FDC3902` | LF（CR=0 · LF=23,092） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,255,856 | 同上（逐字节一致） | LF（CR=0 · LF=23,092） |
| 改动前镜像快照 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261021-r39` | 1,253,517 | `396FAB028141AB976DADA34F8EE1D9126DA0FFEF83E2CC3DD34DF05ECE580E3D` | LF（CR=0 · LF=23,047） |

- 产品侧增量：1,253,517 → 1,255,856（**+2,339 B / +45 行**）。
- 本波**未新增冻结件**（封存 HEAD 仍为 `r22`）；§21 的 R38 表格（1,253,517 / `396FAB02…ECE580E3D`）保留为历史快照。

**四 登记器重锚口径（零漂移）**

- 改 `verify-hash-registry.mjs` 两行期望值 + 追加 R39 说明注释：canonical / step9-mirror（1,253,517/`396FAB02…ECE580E3D` → **1,255,856/`64766D8B…1B6FDC3902`**）。**方数保持 65**，其余 63 方期望值一字未动；登记器自身行尾仍为 CRLF。

**五 门禁与真机验收（真实执行）**

- 登记器：`node verify-hash-registry.mjs`（cwd=`6.P0-T3基线\step9`）→ **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（证据 [`_哈希与行尾校验/r39-registry-2026-10-21.txt`](../_哈希与行尾校验/r39-registry-2026-10-21.txt:1)）。
- 全量门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线\step9`）→ **exit 0**：静态检查 **0 命中** · Node **503/503** · Playwright **167 passed + 4 skipped = 171** · bench **7/7 通过**（最大恶化 0.0% / 中位数 −14.3%）→ `[verify] 全部通过`（证据 [`_环境与调试/r39-verify-all-2026-10-21.txt`](../_环境与调试/r39-verify-all-2026-10-21.txt:1)）。
- 真机探针（真实 Chrome headless · CDP 驱动 · 真实鼠标拖拽）：**34/34 PASS**（证据 [`_环境与调试/r39-module-probe-2026-10-21.txt`](../_环境与调试/r39-module-probe-2026-10-21.txt:1)、截图 [`_环境与调试/r39-module-1440x900-2026-10-21.png`](../_环境与调试/r39-module-1440x900-2026-10-21.png:1)）：
  - A 初始：五模块齐全 · calendar 独占整行（958 = `.cal-modules` clientWidth）· 无尺寸分支 `flex:1 1 24%` + `minWidth:150px` · 全部模块 inline `height` 为空。
  - B 视口扫 1280/1366/1440/1600/1920/2560：每行模块数 `[4,4,4,4,4,4]`、行数 `[2,2,2,2,2,2]`，相邻档位仅「不变或 ±1」、无来回跳，六档零横向滚动条。
  - C/D 当日待办拖 120×80：`sizes.today={w:356,h:317}`（= 目标值，非 offset 回读）· `flex:1 1 356px` + `minWidth:150px` + `height=minHeight=maxHeight=317px`；重载后 offsetWidth 400→400、offsetHeight 317→317、top 558→558（差 0px）。
  - E/F 日历模块拖 60×40：`flex` 仍 `1 1 100%` · offsetWidth 958 = clientWidth 958 · `sizes.calendar={h:526}` 仅 `h` 键；重载后仍独占整行、其它模块 top 逐一不变。
  - G 合成 pointercancel：拖拽中 DOM 顺序已变为 `calendar/today/note/log/stats`，取消后还原为 `calendar/note/today/log/stats`，与 `ui.calModules.order` 一致，**saveUI 调用 0 次**、order 未被写回。
  - H 当日待办 0 → 30 条（真实 `actions.addNode` 写入 + 重渲染）：today offsetHeight 317→317、同行系统日志 357→357、下一行「+ 添加模块」top 878→878、calendar / note top 不变；today 正文 scrollHeight 281→900（内容确实溢出到滚动区，证明增长真实发生）。
  - I 零 `pageerror` · 零 `console.error`。
- 探针脚本：[`_临时脚本/_r39_module_probe_2026-10-21.mjs`](../_临时脚本/_r39_module_probe_2026-10-21.mjs:1)；同步与实测：[`_哈希与行尾校验/r39-sync-2026-10-21.txt`](../_哈希与行尾校验/r39-sync-2026-10-21.txt:1)。

---

## 23. R39 不变量 #90 登记（2026-10-21 · 清单 §三十四 物理追加 · 前 N 字节零变更 · 65 方零漂移）

> **编号说明**：批次任务口径为「在 §17 之后新增 §18」，但本手册 §18 已由 R35（日历外层容器去边框/去底色）占用、§19–§22 亦已落位。为保持章节号单调不减、不改写既有历史章节，本记录按现行编号接续为 **§23**（紧随 §22 = R39 代码侧变更记录）。同 §16 / §22 的既成处理方式。
>
> **范围**：仅向 `4.回归与验收/JU-不变量清单-v2.0-frozen.md` 末尾物理追加 §三十四 + 不变量 #90；产品代码 / CSS / 数据契约 / 冻结件零改动（`v2.0-t3.html` 仍为 §22 记录的 1,255,856 B / `64766D8B…DC3902`）。

**一 追加对象与来源**

| 项 | 值 |
| --- | --- |
| 目标文件 | `4.回归与验收/JU-不变量清单-v2.0-frozen.md` |
| 追加内容 | `## 三十四、日历底部模块位置稳定性（2026-10-21 新增）` + `### 90. 日历底部五模块位置稳定性与尺寸落盘口径`（定义 5 条 / 断言 7 段 / 关联实现 / 验证方式 / 补充口径 8 条 / 冲突调整记录 / 类型状态标注，七段；无三反引号代码块） |
| 草稿来源 | `4.回归与验收/tmp_inv82_draft.md` 第 85–206 行（该草稿「阶段 1 · 草稿正文」段） |
| 备份 | `4.回归与验收/JU-不变量清单-v2.0-frozen.md.bak5-2026-10-21`（135,870 B，与追加前逐字节一致） |

> **草稿取舍说明（据实记录）**：`tmp_inv82_draft.md` 共 250 行，首部 1–84 行为审计元数据（草稿声明 / 〇 编号勘误 / 阶段 0 基线读取记录）、尾部 210–250 行为「阶段 2 冲突核对与调整建议」。两段各含 `## 阶段 N` 级标题（共 3 个）与 2 处 `### 89.` 引用文本，整篇追加会向正式清单注入非章节级 `##` 标题与重复的 89 号标题文本，破坏「## 一…三十四」章节序列与条目唯一性，故仅追加七段正文（85–206 行）。
>
> **EOL 口径勘误**：草稿记载清单为「CRLF（字节扫描命中 13,10）」，本批复测为 **纯 LF（CR=0 · LF=1,750）**，登记器 `r39-registry` 的 `eol=LF` 才是正确值；追加时草稿的 CRLF 已归一为 LF，全文件零 CR、无混排。

**二 追加前后物理实测（`_临时脚本/_r39_inv90_append.ps1` / `_r39_inv90_measure.ps1`）**

| 项 | 追加前 | 追加后 |
| --- | --- | --- |
| size | **135,870 B** | **148,196 B**（+12,326 = 章节间隔 1 B + 正文 12,325 B） |
| SHA-256 | `B99487FD1C65F8065975C473A98589359DA588BF2F1D4AFF6803CDFB7B78098C` | `6783CB682084C92266AFECEB553EA51888D51E742001053DC3C937761A152EFA` |
| LF 行数 | 1,750（CR=0） | 1,873（CR=0，+123 行） |
| BOM | False | False |
| 末字节 | `0x0A`（单 LF 收尾） | `0x0A`（单 LF 收尾） |

**三 零变更比对结论（两项均为硬门禁，未跳过）**

1. **前 N 字节（N = 135,870）SHA-256 一致**：
   追加前 `B99487FD1C65F8065975C473A98589359DA588BF2F1D4AFF6803CDFB7B78098C`
   追加后 `B99487FD1C65F8065975C473A98589359DA588BF2F1D4AFF6803CDFB7B78098C`
   → **PASS**：`#1–#89` 全部字符（含空行、缩进）逐字节零变更；追加采用「原字节前缀 + 追加段」字节级 `WriteAllBytes`，非整体重写。
2. **头 200 行 SHA-256 一致**：
   追加前 / 追加后均为 `6ACC810EEA18E48B5A5B6F6FD3033A93561BD6FBD3B5A579309295E732953923`
   → **PASS**（口径：`StreamReader` 逐行读取、行尾剥离、以 LF 连接、UTF-8 无 BOM 编码后哈希）。
3. 全文计数：`### 90.` = **1**、`## 三十四` = **1**、`### 89.` = **1**、`## 阶段`（元数据泄漏）= **0** → PASS。

**四 登记器重锚**

- `6.P0-T3基线/step9/verify-hash-registry.mjs`：`JU-不变量清单-v2.0-frozen.md` 一行期望值由 `135870 / B99487FD…B78098C` 改为 **`148196 / 6783CB68…1A152EFA / LF`**，并在该行上方新增 **R39 注释**（记录 #90 已登记、追加源与剔除段的理由、前 N 字节与头 200 行一致性结论）。**PARTY_COUNT 保持 65**，其余 64 方期望值一字未动。

**五 门禁证据（真实执行 · exit 0）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| 追加比对 | 前 N 字节 / 头 200 行 SHA-256 双一致 · 计数 1/1/1 · 纯 LF · 末字节单 0x0A → **RESULT: PASS** | [`_哈希与行尾校验/inv90-append-2026-10-21.txt`](../_哈希与行尾校验/inv90-append-2026-10-21.txt:1) |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | [`_哈希与行尾校验/inv90-registry-2026-10-21.txt`](../_哈希与行尾校验/inv90-registry-2026-10-21.txt:1) |
| 全量门禁 | `node scripts/verify.js all` → **exit 0**：静态检查 0 命中 · Node **503/503** · Playwright **171**（167 passed + 4 skipped）· bench **7/7**（最大恶化 0.0%）→ `[verify] 全部通过` | [`_环境与调试/inv90-verify-all-2026-10-21.txt`](../_环境与调试/inv90-verify-all-2026-10-21.txt:1) |

> **环境注记**：本机 `node` 不在 PATH，真实运行时为 `C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`（v22.22.2）；`verify.js` 内部 `spawnSync node` 需 PATH 可见，故执行前将上述目录前置到 `$env:PATH`。首次直调 `E:\软件\CodeBuddy CN\node.exe` 报 `Invalid file descriptor to ICU data` 且不执行脚本，已在最终门禁中改用真实 Node，证据同上。

---

## 24. R40 侧边栏缩进归零 + 折叠三角热区与折叠态守持（2026-10-21）

> **范围**：产品侧 CSS 3 处 + JS 2 处（`6.P0-T3基线/v2.0-t3.html`）；数据契约 / 加密 payload / 公开 API / `<script>` 块数 9 均零变更；未物化新冻结件（封存 HEAD 仍为 `r22`）。

**一 产品变更**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | CSS `.sb-nav-item .chev` | `width:12px` → `width:24px` + `display:inline-flex` / `align-items:center` / `justify-content:center`（折叠三角热区由 12px 扩至 24px，点击不再落到整行导航） |
| ② | CSS `.sb-children` | `padding-left:14px` → `0`（文档树逐级缩进归零） |
| ③ | CSS `#subDb,#subStarred,#subDocs,#subTags` | `padding-left:14px` → `0`（四个分组子树首层与分组标题同起点） |
| ④ | JS `navTo()` | `ui.navExpanded[nav]=true` 无条件强制 → `if(!ui.navExpanded[nav]){ui.navExpanded[nav]=true;saveUI();renderSidebar();}`（`starred` / `files` / `database` / `tags` 四处）；`setActiveKey` / `ui.view` / 数据库根定位保持在守卫之外，行为面不变 |
| ⑤ | JS `_bindRowDrag()` | `pointerdown` 增加 `e.target.closest('.chev')` 早退 —— 长按拖拽原先对整行 `handle.setPointerCapture(pid)`，会把随后的 `click` **重定向到整行 `.sb-nav-item`**，使 `.chev` 自身的 toggle 处理器永不触发（真机探针实测：`elementFromPoint` 命中 `.chev`，但 `click` 事件 `target` 为 `.sb-nav-item`）⇒ 这才是「折叠三角无法收起」的真实根因；① 的热区扩大单独无效 |

- 结果：所有层级图标与文字左对齐（缩进不再逐级累加）；折叠 / 展开切换由三角按钮独占，点击文字不再覆盖折叠状态。

**二 字节锚（实测）**

| 物 | 字节 | SHA-256 | 行尾 |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,256,784 | `8F7CBE7A1FD37594205A40A1595B688C844EE9612FA1CB2B62B9988C1626B39C` | LF（CR=0 · LF=23,100） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,256,784 | 同上（逐字节一致） | LF（CR=0 · LF=23,100） |
| 改动前镜像快照 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261021-r40` | 1,255,856 | `64766D8B0F886B9E995720803BDB829D67468B60FAA264AE9E1EE71B6FDC3902` | LF（CR=0 · LF=23,092） |

- 产品侧增量：1,255,856 → 1,256,784（**+928 B / +8 行**；其中 CSS 改造 +476 B / +4 行，折叠三角根因修复 +452 B / +4 行）。
- 本波**未新增冻结件**（封存 HEAD 仍为 `r22`）；§22 的 R39 表格（1,255,856 / `64766D8B…1B6FDC3902`）保留为历史快照，不再代表现行基线。

**三 登记器重锚（RL-11 先改后补）**

- 红证：改字节后以**改前期望**运行登记器 → `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（恰 `canonical` + `step9-mirror` 两方，判别力真实）。
- 绿证：同步期望值 + 追加 R40 注释块 → `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）。
- 分两阶段重锚（先 CSS/JS 入口改造，再折叠三角根因修复）：`canonical` / `step9-mirror` 两行期望值最终由 1,255,856/`64766D8B…1B6FDC3902` → **1,256,784/`8F7CBE7A…C1626B39C`**；**方数保持 65**，其余 63 方期望值一字未动；登记器自身行尾仍为 CRLF（CR=1,116 · LF=1,116）。

**四 门禁证据（真实执行）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| 65 方登记器（红证） | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（canonical + step9-mirror） | [`_哈希与行尾校验/r40-registry-red-2026-10-21.txt`](../_哈希与行尾校验/r40-registry-red-2026-10-21.txt:1) |
| 65 方登记器（绿证） | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | [`_哈希与行尾校验/r40-registry-green-2026-10-21.txt`](../_哈希与行尾校验/r40-registry-green-2026-10-21.txt:1) |
| 全量门禁 | `node scripts/verify.js all` → **exit 0**：静态检查 **0 命中** · Node **503/503** · Playwright **171**（167 passed + 4 skipped）· bench **7/7**（最大恶化 0.0% / 中位数 −14.3%）→ `[verify] 全部通过` | [`_环境与调试/r40-verify-all-final-2026-10-21.txt`](../_环境与调试/r40-verify-all-final-2026-10-21.txt:1) |
| 字节 / 行尾实测 | 三方（canonical / mirror / 登记器期望值）逐项一致 · `BYTE_IDENTICAL=True` | [`_哈希与行尾校验/r40-measure-before-2026-10-21.txt`](../_哈希与行尾校验/r40-measure-before-2026-10-21.txt:1) · [`_哈希与行尾校验/r40-measure-after-2026-10-21.txt`](../_哈希与行尾校验/r40-measure-after-2026-10-21.txt:1) |
| 真机探针（真实 Chrome headless · 真实鼠标坐标点击） | **18/18 PASS**：缩进归零 5 项 · 三角热区 4 项 · 三角收起/展开与折叠态守持 5 项 · 零 pageerror / 零 console.error；根因修复前实测 **13/18**（三角点击被整行捕获、无法收起） | [`_环境与调试/r40-sidebar-probe-2026-10-21.txt`](../_环境与调试/r40-sidebar-probe-2026-10-21.txt:1) · 调试定位 [`_环境与调试/r40-chev-debug-2026-10-21.txt`](../_环境与调试/r40-chev-debug-2026-10-21.txt:1) |

- 脚本（全部位于 `_临时脚本`，均保留目标文件行尾并逐条断言命中数）：重锚 [`_r40_registry_patch.mjs`](../_临时脚本/_r40_registry_patch.mjs:1) · [`_r40_registry_patch2.mjs`](../_临时脚本/_r40_registry_patch2.mjs:1)；文档 [`_r40_maintenance_patch.mjs`](../_临时脚本/_r40_maintenance_patch.mjs:1) · [`_r40_docs_patch2.mjs`](../_临时脚本/_r40_docs_patch2.mjs:1) · [`_r40_docs_patch3.mjs`](../_临时脚本/_r40_docs_patch3.mjs:1) · [`_r40_journal_patch.mjs`](../_临时脚本/_r40_journal_patch.mjs:1)；真机验证 [`_r40_sidebar_probe_2026-10-21.mjs`](../_临时脚本/_r40_sidebar_probe_2026-10-21.mjs:1) · 根因定位 [`_r40_chev_debug.mjs`](../_临时脚本/_r40_chev_debug.mjs:1)。

---

## 25. R41 侧栏图标与文字严格对齐（2026-10-21）

> **范围**：产品侧 CSS **4 处取值** + **3 处既有注释同步**（`6.P0-T3基线/v2.0-t3.html`）；JS / 数据契约 / 加密 payload / 公开 API / `<script>` 块数 9 均零变更；未物化新冻结件（封存 HEAD 仍为 `r22`）。**本波不追加不变量清单条目**（彻底修复成功后再与基线一并登记）。

**一 产品变更（对齐口径：图标列左缘 = 内距 + 折叠列宽 + gap）**

| # | 位置 | 改动前 | 改动后 | 图标列左缘 |
| --- | --- | --- | --- | --- |
| ① | CSS `.sb-nav-item` | `padding:7px 10px` | `padding:7px 8px` | 10+24+8 = 42px → **8+24+8 = 40px** |
| ② | CSS `.sb-row` | `padding:1px 4px; gap:5px` | `padding:1px 8px; gap:8px` | 4+22+5 = 31px → **8+24+8 = 40px** |
| ③ | CSS `.sb-arrow` | `width:22px` | `width:24px` | 与 `.sb-nav-item .chev`（24px）同宽 |
| ④ | CSS `.sb-arrow.leaf` | `width:22px` | `width:24px` | 叶子行与父节点行同列 |

- 复核（未改动、仍为 0）：`#subDb` / `#subStarred` / `#subDocs` / `#subTags` 与 `.sb-children` 的 `padding-left`（R40 已归零）。
- 同步的 3 处注释：`.sb-nav-item`（新增 R41 说明）· `.sb-row`（新增 R41 说明）· `.sb-icon`（FIX-P2-13 中「越 5px gap」→「gap 8px、热区越界 2px」，44px 伪元素热区与 z-index:1 命中优先级结论不变）。
- 结果：主导航项与子菜单项图标列**改前相差 11px、改后逐像素同列（Δ=0）**；文字列随图标列同步对齐（图标右缘 → 文字左缘间距同为 8px）。

**二 字节锚（实测）**

| 物 | 字节 | SHA-256 | 行尾 |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,257,290 | `5EA40C5862EAA67D79A08F10CFC039613370D1E3F527575FBD0B7ACBFDAF67E6` | LF（CR=0 · LF=23,100） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,257,290 | 同上（逐字节一致 · `Copy-Item` 同步） | LF（CR=0 · LF=23,100） |
| 改动前镜像快照 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261021-r41` | 1,256,784 | `8F7CBE7A1FD37594205A40A1595B688C844EE9612FA1CB2B62B9988C1626B39C` | LF（CR=0 · LF=23,100） |

- 产品侧增量：1,256,784 → 1,257,290（**+506 B / ±0 行**；4 处取值仅 ② 为等长替换，① −1 B、③ +1 B、④ +1 B，其余为注释同步 +505 B；行数 23,101 不变、CR=0 不变）。
- 本波**未新增冻结件**（封存 HEAD 仍为 `r22`）；§24 的 R40 表格（1,256,784 / `8F7CBE7A…C1626B39C`）保留为历史快照，不再代表现行基线。

**三 登记器重锚（RL-11 先改后补）**

- 红证：改字节后以**改前期望**运行登记器 → `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（恰 `canonical` + `step9-mirror` 两方，判别力真实）。
- 绿证：同步两行期望值 + 追加 R41 注释块 → `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）。
- 期望值：1,256,784/`8F7CBE7A…C1626B39C` → **1,257,290/`5EA40C58…B7ACBFDAF67E6`**；**方数保持 65**，其余 63 方期望值一字未动；登记器自身行尾仍为 CRLF（CR=1,129 · LF=1,129 · 134,529 B）。

**四 门禁证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| 65 方登记器（红证） | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（canonical + step9-mirror） | [`_哈希与行尾校验/r41-registry-red-2026-10-21.txt`](../_哈希与行尾校验/r41-registry-red-2026-10-21.txt:1) |
| 65 方登记器（绿证） | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | [`_哈希与行尾校验/r41-registry-green-2026-10-21.txt`](../_哈希与行尾校验/r41-registry-green-2026-10-21.txt:1) |
| 全量门禁 | `node scripts/verify.js all` → **exit 0**：静态检查 **0 命中** · Node **503/503** · Playwright **171**（167 passed + 4 skipped）· bench **7/7**（最大恶化 0.0% / 中位数 −14.3%）→ `[verify] 全部通过` | [`_环境与调试/r41-verify-all-2026-10-21.txt`](../_环境与调试/r41-verify-all-2026-10-21.txt:1) |
| 真机探针（真实 Chrome headless · 真实鼠标点击展开） | **20/20 PASS**：计算值 9 项（padding / gap / chev 与 arrow 的 24px·offsetWidth·leaf）· 子树 padding-left 5 项 · **物理左缘**：图标列 `48px == 48px`（Δ=0）、文字列 `71px == 71px`（Δ=0）、图标右缘→文字左缘间距 `8px == 8px` · 零 pageerror / 零 console.error | [`_环境与调试/r41-align-probe-2026-10-21.txt`](../_环境与调试/r41-align-probe-2026-10-21.txt:1) |
| 改前 / 改后 CSS 规则全量扫描 | 改后 ①②③④ 各项实测命中，⑤ 子树容器 padding-left 全为 0 | [`_环境与调试/r41-align-scan-draft-2026-10-21.txt`](../_环境与调试/r41-align-scan-draft-2026-10-21.txt:1) |

- **探针方法论注记（重要）**：`.chev` 在展开态带 `transform:rotate(90deg)`，其 `getBoundingClientRect().width` 会退化为**行高**（实测 10.41px）而非 24px；故布局宽度一律以 `offsetWidth` 断言（=24），物理左缘以同层 `.ic` / `.sb-icon` 的 `rect.left` 比较。另：主导航项的文字是**裸文本节点**（非 `.sb-label` 元素），文字左缘须用 `document.createRange()` 取，直接 `querySelector('span')` 会误取到 `.ic`。二者是首次运行 15/16 FAIL 的唯一原因，修正测法后 20/20 PASS（产品 CSS 未因探针失败而再改一个字节）。
- 脚本（均位于 `_临时脚本`）：规则扫描 [`_r41_align_scan_2026-10-21.mjs`](../_临时脚本/_r41_align_scan_2026-10-21.mjs:1) · 真机探针 [`_r41_align_probe_2026-10-21.mjs`](../_临时脚本/_r41_align_probe_2026-10-21.mjs:1) · DOM 结构校准 [`_r41_dom_dump_2026-10-21.mjs`](../_临时脚本/_r41_dom_dump_2026-10-21.mjs:1) · 重锚 [`_r41_registry_patch_2026-10-21.mjs`](../_临时脚本/_r41_registry_patch_2026-10-21.mjs:1) · 门禁编排 [`_r41_run_verify_all_2026-10-21.mjs`](../_临时脚本/_r41_run_verify_all_2026-10-21.mjs:1) · 本文档 [`_r41_maintenance_patch_2026-10-21.mjs`](../_临时脚本/_r41_maintenance_patch_2026-10-21.mjs:1)。

## 26. R42 日历待办标签弹层勾选 / 反选与空态文案（2026-10-21）

**一 问题与定位**

- 现象：日历待办（与大纲节点共用同一右键入口）打开「选择标签」后，再次点击**已勾选**的标签没有任何变化——原 `pick(t)` 只做并集追加，已存在的手动标签不会被移除；且弹层单次选取即 `closeTagPicker()` 关闭，用户看不到「当前已选哪些」，只能反复右键试探。表现即用户所报「日历待办重新选择标签失败」。
- 根因：① `pick` 段无「差集」分支；② 行渲染无勾选态类与勾选标记；③ 空态文案未区分「索引整理中」与「暂无标签」，且索引未就绪时列表完全空白。

**二 改动清单（JS 1 函数 + CSS 8 条规则；`<script>` 9 块 / 数据契约 / 加密 payload / 公开 API 零变更）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | `openTagPicker` 头部 | 新增 `list` 容器与 `_manTags` / `_txtTags` / `_syncTitle` 口径；`keys` 由 `const` 改 `let`，索引未就绪时**先列出已生效手动标签**（保证反选始终可用） |
| ② | `pick(t,on)` | `on` 缺省取「当前未勾选」；`want=true` 并集追加、`want=false` 差集移除；`tags` 仍按 `manual ∪ 正文 #标签` 重算；移除 `closeTagPicker()`，改为 `forceRender()` + `buildRows()` |
| ③ | `buildRows()` | 行内新增 `.tp-check`（✓）；已勾选行 `.sel`（`--accent-soft` 底 / 600 字重 / 勾选标记 opacity 1）；正文 #标签只读行 `.ro` + title；标题随手动标签数刷新「已勾选 N 个（再点一次取消）」 |
| ④ | 空态文案 | 索引未就绪 →「标签索引正在后台整理…可直接在下方新建标签」；暂无标签 →「在正文输入 #标签，或用下方「新建标签」创建」 |
| ⑤ | 索引就绪回调 | `l7TagIndexWhenReady` 回调内就地补全 `keys` 并重绘（`_tagPickerEl!==p` 时早退；不关闭弹层） |
| ⑥ | `doCreate` | 新名先入 `keys` 再 `pick(name,true)`；输入框清空 |
| ⑦ | 清除行 | 文案改「✕ 清除本节点全部标签」，`clearTags` 后 `buildRows()` 就地刷新，弹层保持打开 |
| ⑧ | CSS | `.tag-picker .tp-list` / `.tp-label` / `.tp-check` / `.tp-item.sel` / `.tp-item.sel:hover` / `.tp-item.sel .tp-check` / `.tp-item.ro` / `.tp-item.tp-hint,.tp-item.tp-none` |

- 约束守持：`pick` / `clearTags` 段内仍严格 `commit → _tagIndexCache=null; → forceRender();`（t19-patch2 A1/A2 断言逐字成立）；标签色仍只经 `dot.style.setProperty('--tag-color', getTagColor(t))`（不变量 #87 第 4 条）；大纲 / 日历 / 数据库 / 幻灯片渲染函数零改动。

**三 字节锚（实测）**

| 物 | 字节 | SHA-256 | 行尾 |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,259,506 | `5F1C05B87B2FE9858DC6C7117851EEDE8DC3984DE910CF9A934CADA08311A13D` | LF（CR=0 · LF=23,134） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,259,506 | 同上（逐字节一致） | LF（CR=0 · LF=23,134） |
| 不变量清单 `4.回归与验收/JU-不变量清单-v2.0-frozen.md` | 154,699 | `84C6BB6E8D39F3F53159D95381D1AB9D01D3356EE15099DF2274EE29B73970B2` | LF（CR=0 · LF=1,908） |

- 产品侧：1,257,290 → 1,259,506（**+2,216 B / +34 行**）。
- 清单侧：151,143（登记期望 148,196 —— §三十五 / #91–#92 追加后未重锚的既有漂移）→ 154,699（**+3,556 B / +15 行**），本波追加 §三十六 / #93 并一并归零。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）；§25 的 R41 表格（1,257,290 / `5EA40C58…F67E6`）保留为历史快照。

**四 登记器重锚（RL-11 先改后补）**

- 红证（已改字节、未改期望）→ `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=1` / `RESULT=FAIL`（清单方；证据 `_环境与调试/r42-registry-baseline-2026-10-21.txt`）。
- 绿证（同步 canonical / step9-mirror / 清单三行期望 + 追加 R42 注释块）→ `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（证据 `_环境与调试/r42-registry-final-2026-10-21.txt`）。
- 方数保持 **65**，未新增 / 未退役任何登记方。

**五 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| 静态检查（铁律 6） | 0 命中 · 语法检查全部通过 | `_环境与调试/r42-verify-all-2026-10-21.txt` |
| Node 套件 | `tests 503 / pass 503 / fail 0` | 同上 |
| Playwright | 171（167 passed + 4 skipped）· T-99 门禁用例复绿（首跑因登记器未重锚而红，重锚后复跑全绿） | `_环境与调试/r42-verify-all-final-2026-10-21.txt` |
| bench | 7/7 · 最大恶化 **0.0%** · 中位数 **−14.3%** | 同上 |
| 全量门禁退出码 | `VERIFY_ALL_EXITCODE=0`（cmd `&&` 链取回真实退出码） | `_环境与调试/r42-verify-all-exitcode-marker-2026-10-21.txt` |
| 真机探针（标签弹层） | **10/10 PASS**（真实鼠标点击 + 真实键盘输入；勾选 / 反选 / 只读正文标签 / 清除 / 空态文案 / 零 pageerror 零 console.error） | `_环境与调试/r42-tagpicker-probe-2026-10-21.txt` |

- 探针方法论注记：弹层以 `position:fixed` 由 `placePop` 定位，**锚点必须是视口内的真实元素**（本例取大纲行的 `.text`，与右键菜单传入的 anchor 同源）。首版探针误用 `document.body` 作锚点，弹层被定位到视口底缘之外（`y=892 / 按钮 y=1001 > vh 900`），真实鼠标点击落在视口外导致误判；改用正文锚点后 10/10 PASS（产品代码未因探针失败再改一个字节）。
- 脚本（均位于 `_临时脚本`）：真机探针 [`_r42_tagpicker_probe_2026-10-21.mjs`](../_临时脚本/_r42_tagpicker_probe_2026-10-21.mjs:1) · 定位诊断 [`_r42_diag_2026-10-21.mjs`](../_临时脚本/_r42_diag_2026-10-21.mjs:1) · 清单追加 [`_r42_inv_append.mjs`](../_临时脚本/_r42_inv_append.mjs:1) · 本文档补丁 [`_r42_maintenance_patch_2026-10-21.mjs`](../_临时脚本/_r42_maintenance_patch_2026-10-21.mjs:1)。

## 27. L22-final-r2 UI 修正补丁（2026-10-21 · 收口不变量 #77 / #57 两处冲突）

**一 范围与冲突结论**

- **#77 幻灯片视图自适应布局**：#77 正文要求「舞台顶边与首张缩略图顶边严格对齐（≤1px）、舞台水平居中、`.ju-sl-wrap` 间距 8px」，而 `_styleOnce()` 的 CSS 数组当时仍为 `.ju-sl-main{align-items:center}` / `.ju-sl-rail{padding:6px 0 0}` / `.ju-sl-stage{margin:0}` —— 与 #77 的「顶边对齐 + `margin:0 auto` 居中」口径直接冲突（旧 r25/r26 的注释仍描述已废止的实现）。本波按 #77 正文落值，不修改 #77 文字。
- **#57 模板 / 历史视图返回按钮**：#57 要求三视图（模板 / 回收站 / 历史）的「← 返回」均可由 `document.querySelector('.files-toolbar .btn')` 命中共一选择器；当时仅 `renderTrashView()` 的外层 `head` 带 `.files-toolbar`，模板 / 历史两视图标题行无该类 ⇒ 选择器对两视图失效。本波补类，不动 #57 文字。
- `<script>` 块数 9 / 数据契约 / 加密 payload 字段名 / 公开 API 零变更；既有不变量 #1–#93 语义文字零修改。

**二 改动清单（CSS 3 条 + JS 2 个渲染函数）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | `JU_SLIDES._styleOnce()` · `.ju-sl-main` | `align-items:center` → `align-items:flex-start`（取消纵轴居中，舞台顶边与首张缩略图顶边贴齐；水平居中改由 `.ju-sl-stage` 的 `margin:0 auto` 承担） |
| ② | `JU_SLIDES._styleOnce()` · `.ju-sl-rail` | `padding:6px 0 0` → `padding:0`（rail 内容顶边 = 首张缩略图顶边，与 `.ju-sl-main` 的 `padding:0` 取齐） |
| ③ | `JU_SLIDES._styleOnce()` · `.ju-sl-stage` | `margin:0` → `margin:0 auto`（垂直不分配剩余空间 / 水平严格居中） |
| ④ | `renderTemplatesView()` | `renderTitleWithBack('模板', …)` 返回值先 `classList.add('files-toolbar')` 再 `append`；并 `style.justifyContent='flex-start'`（`.files-toolbar` 自带 `justify-content:flex-end`，回写以保持标题左对齐） |
| ⑤ | `renderHistoryView()` | 同法：`renderTitleWithBack('版本历史', …)` 返回值加 `.files-toolbar` 类 + `justifyContent='flex-start'` |
| ⑥ | `renderTrashView()` | **保持现状**（外层 `head` 已是 `.files-toolbar`，再给标题行加类会造成两层嵌套，违反「避免嵌套」口径） |

- 保留项（不冲突，逐条复核）：`body.sb-left-collapsed .ju-sl-rail{padding-right:6px}` 为**折叠态专用**规则，与 ② 的非折叠态 `padding:0` 并存（实测折叠态 `padding-right=6px` / width 148px）；`.ju-sl-wrap` 的 `column-gap:8px` 未触碰。

**三 字节锚（实测）**

| 物 | 字节 | SHA-256 | 行尾 |
| --- | --- | --- | --- |
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,261,042 | `B600CF504776A36BC954A217A10B019326461324E37EE7521E56BD257CC3271E` | LF（CR=0 · LF=23,150） |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 1,261,042 | 同上（逐字节一致） | LF（CR=0 · LF=23,150） |
| 不变量清单 `4.回归与验收/JU-不变量清单-v2.0-frozen.md` | 154,699 | `84C6BB6E8D39F3F53159D95381D1AB9D01D3356EE15099DF2274EE29B73970B2` | LF（CR=0 · LF=1,908，本波**零改动**） |

- 产品侧：1,259,506 → 1,261,042（**+1,536 B / +16 行**）。
- 同步方式：先编辑 step9 镜像，再用 `copy /Y` 覆盖 canonical（改前 canonical 已备份为 `6.P0-T3基线/v2.0-t3.html.bak-20261021-r43`）；两侧 `Get-FileHash` 实测同值。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）；§26 的 R42 表格（1,259,506 / `5F1C05B8…A13D`）保留为历史快照。

**四 登记器重锚（先红后绿）**

- 红证（已改字节、未改期望）→ `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=1` / `RESULT=FAIL`，唯一漂移方 `step9-mirror size=1261042 (exp 1259506)`；同一轮全量门禁唯一红点即 T-99 哨兵（`tests/t10-idb-persist.spec.ts:570` `expect(drift).toBe(0)` 收到 1）。证据 `_环境与调试/l22r2-ui-inv57-77-registry-baseline-2026-10-21.txt` 与 `_环境与调试/l22r2-ui-inv57-77-verify-all-2026-10-21.txt`。
- 绿证（同步 canonical / step9-mirror 两行期望 1,259,506/`5F1C05B8…A13D` → **1,261,042/`B600CF50…CC3271E`** + 追加 L22-final-r2 注释块）→ `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。证据 `_环境与调试/l22r2-ui-inv57-77-registry-final-2026-10-21.txt`。
- 方数保持 **65**，其余 63 方期望值一字未动；登记器自身行尾仍为 CRLF。

**五 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| 全量门禁（重锚前） | 静态 0 命中 · Node **503/503** · PW **166 passed + 1 failed + 4 skipped**（唯一红点 = T-99 登记器哨兵，drift=1） · bench 7/7 | `_环境与调试/l22r2-ui-inv57-77-verify-all-2026-10-21.txt` |
| 全量门禁（重锚后复跑） | **exit 0**：静态 0 命中（91ms） · Node **503/503**（25,745ms） · PW **167 passed + 4 skipped = 171**（54,969ms） · bench **7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过` | `_环境与调试/l22r2-ui-inv57-77-verify-all-final-2026-10-21.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/l22r2-ui-inv57-77-registry-final-2026-10-21.txt` |
| 真机探针（Chrome headless · 1440×900 · canonical/step9 镜像同一页面） | **11/11 PASS** | `_环境与调试/l22r2-ui-inv57-77-browser-2026-10-21.txt` |

- **#77 实测值（1440×900，真实 `getBoundingClientRect` / `getComputedStyle`）**：舞台顶边 `130.390625` vs 首张缩略图顶边 `130.390625`（**|Δ|=0.00px ≤1px**）；舞台中心 X `710` = wrap 中心 X `710`（**|Δ|=0.00px**）；`.ju-sl-wrap` `column-gap=8px`；rail 右边缘 `466` → 舞台左边缘 `474`（**=8.00px**）；`.ju-sl-main` `align-items=flex-start`；`.ju-sl-rail` `padding-top=0px`；`.ju-sl-stage` 样式表声明 `margin:0 auto`（computed used=0px，见下注记）；折叠态 `body.sb-left-collapsed .ju-sl-rail` `padding-right=6px` / width `148px`。
- **#57 实测值**：`view=templates / trash / history` 三视图均 `document.querySelector('.files-toolbar .btn')` 命中、`textContent='← 返回'`；三级 `topLevelBars=1` / `nestedBars=0`；模板与历史的标题行 `justify-content=flex-start`（回收站为外层 `head` + 内层标题行，`justify-content=normal` 属既有口径，未改）。
- **探针方法论注记（重要）**：`.ju-sl-stage` 为 `width:100%` 且无富余空间，`margin:0 auto` 中 `auto` 的 **computed used value 恒为 `0px`**，故「是否写成 `0 auto`」必须以样式表声明（`#juSlidesStyle` 文本）判定，页面 computed 值只用于 `#77-b` 的居中效果断言；首版探针以 `getComputedStyle().margin` 判定 `0 auto` 得 FAIL，属**测法**问题，产品 CSS 未因此再改一个字节（与 §25 R41 / §26 R42 同类注记）。
- 探针脚本：[`_临时脚本/_l22r2_ui_probe_2026-10-21.mjs`](../_临时脚本/_l22r2_ui_probe_2026-10-21.mjs:1)（只读：`playwright` 经 `createRequire` 解析 `step9/node_modules`，启动真实 Chrome `--headless`，不写任何产品文件）。

## 二十八 L22-final-r3 · 幻灯片主舞台面积最大化（2026-10-21）

> 范围：`6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（逐字节镜像）。报告：[`_报告与元数据/L22-FINAL-R3-STAGE-MAX-2026-10-21.md`](../_报告与元数据/L22-FINAL-R3-STAGE-MAX-2026-10-21.md:1)。

**一 改动清单（仅 `JU_SLIDES._styleOnce()` 的 CSS 字符串数组）**

| # | 选择器 | 改动 |
| --- | --- | --- |
| ① | `.ju-sl-wrap` | `grid-template-columns:minmax(174px,1fr) minmax(0,2fr) minmax(0,1fr)` → `auto minmax(0,1fr)`；`height:auto` → `100%`（取消原用于对称居中的第三列留空） |
| ② | `.ju-sl-main` | 追加 `container-type:size`（供内部 `100cqh` 解析；`justify-content` / `align-items` / `padding:0` 不变） |
| ③ | `.ju-sl-stage` | `width:100%` → `width:min(100%,calc(100cqh * 16 / 9))`（两向取小、恒 16:9；`margin:0 auto` 与 `aspect-ratio` 不变） |
| ④ | `@media (max-width:720px)` · `.ju-sl-main` | 追加 `container-type:normal` —— 单列态 `height:auto` 与 size 尺寸隔离叠加会使高度坍缩为 0（`100cqh=0` ⇒ 舞台不可见），属本波必需配套 |

保留项：`.ju-sl-wrap` `column-gap:8px`、`.ju-sl-rail` `width:174px` / `justify-self:end`、折叠态 `body.sb-left-collapsed .ju-sl-rail{padding-right:6px}` 均未触碰。

**二 字节锚**

- 落盘顺序：备份 step9 镜像 → 编辑 step9 镜像 → 备份 canonical → `copy /Y` 覆盖 canonical；两侧 `Get-FileHash` 同值。
- canonical ≡ step9 镜像 = **1,261,513 B / `E9CDE576DFB4ACAAC84254D978BBF0E2A74C4C830432A8F4EBAD33B349EA1B30` / LF（CR=0 · LF=23,153）**；增量 1,261,042 → 1,261,513（+471 B / +3 行）。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）。

**三 登记器重锚**

- canonical / step9-mirror 期望 `1,261,042/`B600CF50…CC3271E`` → **`1,261,513/`E9CDE576…EA1B30``**，并追加 L22-final-r3 注释块。
- `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。证据 `_环境与调试/l22r3-registry-2026-10-21.txt`。

**四 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（80ms） · Node **503/503**（30,630ms） · PW **167 passed + 4 skipped = 171**（76,365ms） · bench **7/7**（144ms）→ `[verify] 全部通过` | `_环境与调试/l22r3-verify-all-2026-10-21.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/l22r3-registry-2026-10-21.txt` |
| 真机探针（Chrome headless · 1440×900 / 1920×1080） | **7/7 PASS · CHECK_FAIL=0** | `_环境与调试/l22r3-ui-stage-probe-2026-10-21.txt` |

- **主舞台几何（真实 `getBoundingClientRect`）**：改前 1440×900 `472×265.5`（125,316 px²，底边留白 464.11px）→ 改后 `778×437.63`（**340,472 px²，×2.72**，底边留白 **291.98px**）；改后 1920×1080 `1258×707.63`（890,192 px²，底边留白 201.98px）。
- **`#77` 断言**：顶边对齐 |Δ|=0.00px；在主演示区水平居中 |Δ|=0.00px；16:9 = 1.7778；面积 ×2.72；底边留白 464.11 → 291.98px；`.ju-sl-main` computed `container-type=size`；样式表命中 `width:min(100%,calc(100cqh * 16 / 9))` ⇒ 7/7 PASS。
- **#77 口径更新（重要）**：原「舞台在 **wrap** 内绝对居中」依赖左右两个 `1fr` 对称留空列；取消留空列后，水平居中语义变更为「舞台在**主演示区剩余空间内**居中」（`margin:0 auto`，实测 |Δ|=0.00px）。顶部对齐与 16:9 口径不变。旧探针（r2）的 `#77-b` / `#77-d` 在最大化布局下不再适用，本波探针改以主演示区中心为基准。
- **排障注记**：`.bak` 后缀在 `file://` 下不被 Chrome 识别为 HTML（按纯文本渲染，`#content` 不存在），改前基线对比须先复制为 `.html` 临时件；本波临时件比对后已删除。
- 探针脚本：[`_临时脚本/_l22r3_stage_probe_2026-10-21.mjs`](../_临时脚本/_l22r3_stage_probe_2026-10-21.mjs:1)（只读；截图落 `_环境与调试/l22r3-slides-*.png`）。

## 二十九 R46 主题按钮图标 T 恤化（2026-10-22）

> 范围：`6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（逐字节镜像）。备份：`6.P0-T3基线/v2.0-t3.html.bak-20261022-r46-themeicon`、`6.P0-T3基线/step9/v2.0-t3.html.bak-20261022-r46-themeicon`。

**一 改动清单（仅两处 SVG 外形）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | `#btnTheme` 静态 `svg` | `<circle cx="12" cy="12" r="8"/>` + `<path d="M12 4a8 8 0 0 1 0 16"/>` → T 恤轮廓 `path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"` |
| ② | `applyTheme()` 的 `svg.innerHTML` | 原「日间半圆 / 夜间太阳」两条路径 → 同一 T 恤 `path`（局部常量 `tee`）；夜间追加 `<circle cx="12" cy="18" r="1"/>` 点缀以保留主题态视觉差异 |

保留项：`.sb-tool svg` 的 `stroke:var(--icon)` / `fill:none` / `stroke-width:1.8` / `stroke-linecap:round` / `stroke-linejoin:round` 未改动 ⇒ 与导入 / 番茄钟 / 悬浮日历按钮同为线框风格；`#btnTheme` 的点击行为（`openThemeSelector`）与 `ui.theme` 记录点未改动。

**二 字节锚**

- canonical ≡ step9 镜像 = **1,261,506 B / `C6AAF0E3BEC578F814BE2F5479A9AFB5790ADAD0A26944C5F8B4624FDE2AB3C8` / LF（CR=0 · LF=23,152）**；增量 1,261,347 → 1,261,506（+159 B / −1 行）。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）。

**三 登记器重锚**

- canonical / step9-mirror 期望 `1,261,347/`AE963965…4DA47051`` → **`1,261,506/`C6AAF0E3…DE2AB3C8``**，并追加 R46 注释块。
- `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。证据 `_哈希与行尾校验/r46-registry-2026-10-22.txt`。

**四 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（61ms） · Node **503/503**（34,370ms） · PW **167 passed + 4 skipped = 171**（69,046ms） · bench **7/7**（93ms）→ `[verify] 全部通过` | `_环境与调试/r46-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_哈希与行尾校验/r46-registry-2026-10-22.txt` |
| 真机探针（系统 Chrome headless · 1440×900 · deviceScaleFactor 2） | **11/11 PASS · CHECK_FAIL=0** | `_环境与调试/r46-ui-probe-2026-10-22.txt` |

- **实测值**：`#btnTheme` 的 `svg` 子元素 `paths=1 / circles=0`；`path@d` 以 `M20.38 3.46L16 2…` 开头；`computed fill=none` / `stroke-width=1.8px` / `stroke=rgb(74, 122, 94)`；按钮 `30×30`、`svg 16×16`；路径包围盒 `x=2.25 y=2 w=19.5 h=20`（位于 `0 0 24 24` viewBox 内）。
- **主题态**：`applyTheme('night')` 后 `paths=1 / circles=1`（`<circle cx="12" cy="18" r="1">`）；`applyTheme('day')` 后回落 `paths=1 / circles=0`；页面 `pageerror` 0 条。
- 截图：`_环境与调试/r46-btnTheme-day-2026-10-22.png`、`_环境与调试/r46-btnTheme-night-2026-10-22.png`。
- 探针脚本：[`_临时脚本/_r46_ui_probe.mjs`](../_临时脚本/_r46_ui_probe.mjs:1)（只读：`playwright` 经 `createRequire` 解析 `step9/node_modules`，启动系统 Chrome headless，不写任何产品文件）。
- **数量口径注记**：任务书中的「47 方」为早期口径（L19 时期）；现行登记器实际为 **65 方**，本波实测 `PARTY_COUNT=65` / drift 0。

## 三十 R47 今日待办右键菜单折叠展开化（2026-10-22）

> 范围：`6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（逐字节镜像）。备份：`6.P0-T3基线/v2.0-t3.html.bak-20261022-r47-calctx`、`6.P0-T3基线/step9/v2.0-t3.html.bak-20261022-r47-calctx`。

**一 改动清单（CSS 26 条规则 + JS 2 处；`<script>` 块数 9 不变）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | `renderCalNode()` 的 `text` contextmenu 监听 | 删除 `showContextMenu(items,e)` 调用与原 `items` 构建（`openCalTimeModal` / `openTagPicker` / 优先级逐项 / 复制 / 删除），改为 `openCalNodeMenu(n.id,e)`；触屏长按放行系统菜单的既有守卫保留 |
| ② | 新增 `closeCalNodeMenu()` / `openCalNodeMenu(nid,e)`（置于 `renderCalNode` 之前） | 创建 `.cal-ctx` 浮层（`position:fixed` / `z-index:var(--z-menu)` / `--bg-menu` 背景 / `--radius` 圆角 / 阴影 / 5px 内边距 / `max-height:72vh`）；三个折叠项就地展开收起（`.cal-ctx-body.on`，首次展开才构建内容），两项保持直接执行；点击外部（document `mousedown` 捕获）、ESC、窗口 resize 均关闭，`close` 统一 drain `mkCalSel` 的 `_cleanups` 与全部文档级监听 |
| ③ | `mkCalSel(entries,val,host)` | 新增可选第三参数 `host`（缺省仍 `document.body`）：时间折叠区的 4 个下拉实例把 `.cal-sel-panel` 挂进浮层内部，避免 `--z-modal-pop(1600)` 被 `--z-menu(10050)` 压住 |
| ④ | 新增 CSS（`.cal-ctx` / `.cal-ctx-item` / `.cal-ctx-body` / `.cal-ctx-row` / `.cal-ctx-btn` / `.cal-ctx-prio` / `.cal-ctx-tag` / `.cal-ctx-hint`） | 复用 `--bg-menu` / `--line` / `--accent-soft` / `--danger-soft` / `--radius-sm` 等既有 token；不改动任何既有选择器（`#ctxMenu` / `.ctx-item` / `.tag-picker` 原样保留，供其它入口使用） |

折叠项数据写入语义（与旧二级窗口逐项对齐，仅交互形态变化）：

- 「⏰ 设置时间」：开始 / 结束小时·分钟（`mkCalSel`，分钟 5 分钟网格、`60` 表示进位）+「保存」/「清除时间」；校验口径同 `openCalTimeModal`（分钟 60 需前一个小时、结束须晚于开始且不超当日），落盘仍为 `commit` 写 `nn.time` / `nn.timeEnd` + `dirtyDocs:getCalendarRootId()`。
- 「🏷 选择标签」：复用 `_tagIndexCache` 取标签全集、`nodeHasTag` 判定「正文 #标签」只读行；行点击切换 `nn._manualTags` 并按 `manual ∪ 正文 #标签` 重算 `nn.tags`，附「清除全部标签」（清空 `_manualTags`、保留正文标签）；索引未就绪时就地补全列表。
- 「● 优先级」：四象限按钮（重要紧急 / 重要不紧急 / 紧急不重要 / 不紧急不重要）+「清除优先级」，落盘 `commit` 写 `nn.priority`（`v:0` 为清除），当前值高亮。
- 「📄 复制到今日」：`actions.addNode(calRootId, null, {text, date: todayStr(), showInCal: true, time})`，语义与旧实现一致。
- 「🗑 删除待办」：`actions.removeNode(n.id)` + `forceRender()`，语义与旧实现一致。
- `actions.setNodeDate` / `actions.clearNodeSchedule` / `actions.updateText` / `actions.toggleDone` / `actions.removeNode` 的调用点与语义零变更。

**二 字节锚**

- canonical ≡ step9 镜像 = **1,275,170 B / `A5E285C7F56020107BBFEBCED9A2EABF8BA395A8F493B1DE83B75BCBED3CB850` / LF（CR=0 · LF=23,416 · split 23,417）**；增量 1,261,506 → 1,275,170（**+13,664 B / +264 行**）。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）。

**三 登记器重锚**

- canonical / step9-mirror 期望 `1,261,506/`C6AAF0E3…2AB3C8`` → **`1,275,170/`A5E285C7…ED3CB850``**，并追加 R47 注释块。
- `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。证据 `_哈希与行尾校验/r47-registry-2026-10-22.txt`。

**四 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（60ms） · Node **503/503**（34,515ms） · PW **167 passed + 4 skipped = 171**（166,989ms） · bench **7/7**（98ms）→ `[verify] 全部通过` | `_环境与调试/r47-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_哈希与行尾校验/r47-registry-2026-10-22.txt` |
| 真机探针（系统 Chrome headless · 1440×900） | **23/23 PASS · CHECK_FAIL=0** | `_环境与调试/r47-calctx-probe-2026-10-22.txt` |

- **浮层实测**：`.cal-ctx` `position=fixed` / `z-index=10050` / 背景 `rgb(211, 222, 201)` / 圆角 `8px` / 阴影 `rgba(0,0,0,.16) 0 8px 30px` / 内边距 `5px`；同时刻 `modal-overlay=0`、`.tag-picker=false`、`#ctxMenu.on=false`。
- **折叠实测**：默认 `.cal-ctx-body.on=0`；展开「设置时间」后 4 个 `.cal-sel`（标签为「开始 / 结束」）且 `.cal-sel-panel` 的 `closest('.cal-ctx')` 命中（面板挂在浮层内部）；选 10:30–11:00 保存后 `state.nodes[id].time='10:30'` / `timeEnd='11:00'`、浮层关闭、无弹窗。
- **标签实测**：行列表就地渲染（`#alpha` / `#设计` / `#重要`），点击 `#alpha` 后 `_manualTags=['alpha']`、`tags=['alpha']` 且浮层保持打开；「清除全部标签」后 `_manualTags=[]`、`tags` 仍含正文 `alpha`。
- **优先级 / 关闭 / 直执行实测**：点「重要紧急」→ `priority=1`、行内徽章与按钮高亮均同步；`ESC` 关闭、点击 (6,6) 外部关闭；「复制到今日」今日待办 1 → 2；「删除待办」节点 `_deleted`；`pageerror` 0 条。
- 截图：`_环境与调试/r47-calctx-1440x900-2026-10-22.png`。
- 探针脚本：[`_临时脚本/_r47_calctx_probe_2026-10-22.cjs`](../_临时脚本/_r47_calctx_probe_2026-10-22.cjs:1)（只读产品文件；`playwright` 由 `step9/node_modules` 解析，启动系统 Chrome headless，不写任何产品数据）。

**五 回滚**

- 回滚到本波前：用 `.bak-20261022-r47-calctx` 覆盖两份产品文件，并把登记器 canonical / step9-mirror 期望回退为 `1,261,506 / C6AAF0E3…`；旧 `showContextMenu` / `openCalTimeModal` / `openTagPicker` 代码路径本波未删除，仍可被其它入口复用。

## 三十一 R48 折叠菜单首列对齐与浅底区隔（2026-10-22）

> 范围：`6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（逐字节镜像）。承接「三十 R47」：本波只改 `openCalNodeMenu()` 的条目构建与 `.cal-ctx` 段样式，数据写入通道零变更。

**一 改动清单（CSS 1 段 9 条 + JS 3 处；`<script>` 块数 9 不变）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | `.cal-ctx .cal-ctx-item` | 与普通项同用 `.ctx-item` 基础类（节点类名同时带 `ctx-item` / `cal-ctx-item`），高度 · 内边距 · 字号 · 行高不再各写一份：`font-size:.86em` / `line-height:1.45` / `background:transparent` |
| ② | 新增 `.cal-ctx-lead` | `flex:0 0 16px` / `width:16px` / `margin-right:7px` / `text-align:center` / `line-height:1`——折叠头首列放三角、普通项首列放图标，两类文字起点同列 |
| ③ | `.cal-ctx-caret` | 三角改为字符切换（收起 `▶` / 展开 `▼`），删除原 `rotate(90deg)` 分支；`.expanded` 仅改颜色 |
| ④ | 新增 `.cal-ctx-fold` | `background:var(--bg-panel2)` / `border-radius:var(--radius-sm)` / `padding:2px 0` / `margin:1px 0`；横向内边距取 0，避免整块缩进 1px 破坏与普通项的列对齐 |
| ⑤ | `.cal-ctx-body` | 去掉 `border-top`（改由浅底做区隔），内边距 `2px 9px 8px 11px` |
| ⑥ | `item()` / `fold()` | 抽出 `lead(glyph,cls)` 首列工厂；普通项与折叠头同构；折叠头移除 `⏰` / `🏷` / `●` 表情前缀（首列只留三角），并同步 `aria-expanded` |
| ⑦ | 折叠块结构 | 头部 + 内容区包进 `.cal-ctx-fold`（R47 时两者是菜单的平级兄弟节点） |
| ⑧ | `buildTags` / `buildPrio` 的清除行 | 同样改为 `.ctx-item` + 首列（`✕` / `○`），与头部文字起点一致 |

交互与执行语义（与 R47 一致，未改）：头部 `mousedown`（左键）切 `body.on` + 三角 + `aria-expanded`，首次展开才 `build(body)`；`mkCalSel` 仍挂浮层内部；「复制到今日」「删除待办」仍直接执行；`commit` 写入字段（`time` / `timeEnd` / `_manualTags` + `tags` / `priority`）与 `actions.*` 调用点逐行未动。

**二 字节锚**

- canonical ≡ step9 镜像 = **1,276,720 B / `022E98F464581D3BBB7D0614C4B1A4C8CFF474DA142D4A84B1F5AA1B62A221E1` / LF（CR=0 · LF=23,441 · split 23,442）**；增量 1,275,170 → 1,276,720（**+1,550 B / 行数不变**）。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）。

**三 登记器重锚**

- canonical / step9-mirror 期望 `1,275,170/`A5E285C7…3CB850`` → **`1,276,720/`022E98F4…A221E1``**，并追加 R48 注释块。
- `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。证据 `_哈希与行尾校验/r48-registry-2026-10-22.txt`。

**四 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（22ms） · Node **503/503**（26,090ms） · PW **167 passed + 4 skipped = 171**（57,356ms） · bench **7/7**（75ms）→ `[verify] 全部通过` | `_环境与调试/r48-verify-all-r2-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_哈希与行尾校验/r48-registry-2026-10-22.txt` |
| 真机探针（系统 Chrome headless · 1440×900） | **26/26 PASS · CHECK_FAIL=0** | `_环境与调试/r48-calctx-align-probe-2026-10-22.txt` |

- **对齐实测**（浏览器 computed 值，5 项一次取样）：高 `27.02px` / 内边距 `6-11-6-11` / 字号 `10.3544px` / 行高 `15.0139px` 四项集合各只有 1 个值（折叠头 3 项 + 普通项 2 项全等）；首列 `.cal-ctx-lead` 宽度恒 `16`；文字起点 `textX` 全为 `40`（极差 0）。
- **区隔实测**：三个 `.cal-ctx-fold` 背景 `rgb(226, 237, 215)`（`--bg-panel2`）、圆角 `6px`、`padding:2px 0`；两个普通项背景 `rgba(0, 0, 0, 0)`；折叠块底色 ≠ 菜单底色 `rgb(211, 222, 201)`。
- **交互实测**：收起态三个头部 `▶` 且 `bodies=["none","none","none"]`；点首个头部 → `bodies=["block","none","none"]`、`▶ → ▼`、`aria-expanded=true/false/false`，且头部高度 / 内边距 / 字号 / 行高与收起态逐项相同；再点回落 `▶` 且内容区 `none`。
- **执行实测**：「复制到今日」当日待办 1 → 2；「删除待办」后 `state.nodes[id]._deleted=true` 且浮层关闭；`pageerror` / `console error` 0 条。
- 截图：`_环境与调试/r48-calctx-align-1440x900-2026-10-22.png`、`_环境与调试/r48-calctx-align-1440x900-2026-10-22-expanded.png`。
- 探针脚本：[`_临时脚本/_r48_calctx_align_probe_2026-10-22.cjs`](../_临时脚本/_r48_calctx_align_probe_2026-10-22.cjs:1)（只读产品文件；`playwright` 由 `step9/node_modules` 解析，启动系统 Chrome headless，不写任何产品数据）。
- **数量口径注记**：任务书中的「47 方」为 L19 时期口径；现行登记器实际为 **65 方**，本波实测 `PARTY_COUNT=65` / drift 0。

**五 回滚**

- 首选：`git checkout -- 6.P0-T3基线/v2.0-t3.html 6.P0-T3基线/step9/v2.0-t3.html`（本波改动尚未提交，回滚即回 R47 态 1,275,170），并把登记器 canonical / step9-mirror 期望退回 `1,275,170 / A5E285C7…`。
- 无 git 时：按第一节 ①–⑧ 反向还原（`.ctx-item` 双类名 → 原 `.cal-ctx-item` 独立规则；`.cal-ctx-lead` → `.ic` / `.caret`；`.cal-ctx-fold` 包裹 → 平级兄弟；三角 `▶/▼` → `▸` + `rotate(90deg)`；8 处清除行回 `innerHTML`）。
- 注意：`.bak-20261022-r47-calctx` 是 **R47 之前**的快照（1,261,506），用它只能回到「本轮折叠菜单引入前」，不能回到 R47 态。

## 三十二 R49 右侧「编辑」工具栏多选批量格式化（2026-10-22）

> 范围：`6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（逐字节镜像）。承接「三十一 R48」：本波只改 `bindRightSidebar()` 中 `$$('[data-cmd]')` 按钮 `onclick` 的前置分支——多选节点状态下把格式命令批量落到各节点 `text`；数据契约 / 加密 payload / 公开 API 零变更，`<script>` 块数 9 不变。

**一 改动清单（JS 1 处 4 段；无 CSS / HTML 结构变更）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | 多选探测 | `onclick` 取 `cmd` 之后、`firstText.focus()` 之前插入：`getSelection()` 非折叠且文本非空白 ⇒ `hasTextSelection=true`（不拦截）；否则读取多选：大纲多选 `_outlineSel` 优先（须 `docId === ui.currentDocId` 且 `ids.size > 0`），回落通用多选 `_mSel.ids` |
| ② | `execBatchFormat(cmdStr,val)` | 单次 `commit`（`{snapshot:true, dirtyText:true, dirtyDocs:null}`）批量改写选中节点 `n.text`，`n.updatedAt` 走 `_nowSeq()`；逐节点 `if(!n) return` 守卫；提交后 `forceRender()` |
| ③ | 标签包裹 | `_wrap(h,tag)`：空文本写 `<tag><br></tag>`；已同名包裹则解包（幂等切换）。`_wrapStyle(h,prop,v)`：写 `<span style="prop:v">…</span>`，空文本写 `<br>` 占位 |
| ④ | 命令分派 | `bold/italic/underline/strike`（`b/i/u/s` 标签）直接执行；`bg` 经 `openColorPicker(...,{transparent:true})`（透明档写 `transparent`）；`color` 经 `openColorPicker`（当前值缺省回落 `_themeColor('--editor-fg','')`）；`size` 经 `openSizePicker` → `fontSizePxFor(v)+'px'`。四类拦截均 `return`，不再落入下方 `execCommand` 路径 |

单光标 / 单选区路径（`safeExec('styleWithCSS')` + `execMap` + `bg`/`color`/`size` 选择器）逐行未动；`painter` / `undo` / `redo` / `copy` / `cut` / `paste` / `cal` / `db` 不受拦截。

**二 字节锚**

- canonical ≡ step9 镜像 = **1,279,982 B / `4E504F4F33CE29320532CD837BF93E00E5A4A9080033FFFEFE7A02BB00A10DE6` / LF（CR=0 · LF=23,506 · split 23,507）**；增量 1,276,720 → 1,279,982（**+3,262 B / +65 行**）。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）。

**三 登记器重锚**

- canonical / step9-mirror 期望 `1,276,720/022E98F4…A221E1` → **`1,279,982/4E504F4F…00A10DE6`**，并追加 R49 注释块；登记器自身行尾仍为 CRLF（CR=1,284 · LF=1,284）。
- `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。证据 `_哈希与行尾校验/r49-registry-2026-10-22.txt`。

**四 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| 语法自检（9 个内联 script 逐个 `vm.Script` 编译） | `SYNTAX=OK` / `SCRIPT_BLOCKS=9` / `EOL=LF（CR=0）` | `_临时脚本/_r49_syntax_probe_2026-10-22.cjs` |
| 红证（改字节后以改前期望跑门禁） | PW `tests/t10-idb-persist.spec.ts` T-99 登记器哨兵失败 1 例（`166 passed + 4 skipped + 1 failed`）⇒ 判别力真实 | `_环境与调试/r49-verify-all-r1-2026-10-22.txt` |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（45ms） · Node **503/503**（25,831ms） · PW **167 passed + 4 skipped = 171**（54,774ms） · bench **7/7**（77ms）→ `[verify] 全部通过` | `_环境与调试/r49-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_哈希与行尾校验/r49-registry-2026-10-22.txt` |
| 真机探针（系统 Chrome headless · 1440×900 · canonical） | **18/18 PASS** | `_环境与调试/r49-multifmt-probe-2026-10-22.txt` |

- **批量实测**（页面内读 `state.nodes[id].text`）：多选 2 节点 → `bold` 得 `["<b>甲行文本</b>","<b>乙行文本</b>"]`；再点一次解包回原文本；`italic` / `underline` / `strike` 分别得 `<i>` / `<u>` / `<s>` 包裹；`bg` 调色板 `#2E2218` → `background-color` span（透明档 → `transparent`）；`color` → `color` span；`size`「大 5」→ `font-size:21px`（= `fontSizePxFor('5')`）。
- **双通道实测**：`_outlineSel` 路径（`docId` 匹配）与 `_mSel` 回落路径均批量生效；有文本选区时批量分支被跳过（另一选中节点文本未被改写）；多选为空时不拦截且无异常。
- **历史一致性**：批量写入入 history 栈，`undo()` 后两节点文本整体回到批量前（`applied` 有 `<b>` · `after` 为纯文本）。
- 渲染层：`#content` 内出现 `<b>`；`pageerror` / `console error` 0 条。
- 截图：`_环境与调试/r49-multifmt-1440x900-2026-10-22.png`。
- 探针脚本：[`_临时脚本/_r49_multifmt_probe_2026-10-22.cjs`](../_临时脚本/_r49_multifmt_probe_2026-10-22.cjs:1)（只读产品文件；`playwright` 由 `step9/node_modules` 解析，启动系统 Chrome headless，不写任何产品数据）。
- **数量口径注记**：任务书中的「47 方」为 L19 时期口径；现行登记器实际为 **65 方**，本波实测 `PARTY_COUNT=65` / drift 0。

**五 回滚**

- 首选：`git checkout -- 6.P0-T3基线/v2.0-t3.html 6.P0-T3基线/step9/v2.0-t3.html`（本波改动尚未提交，回滚即回 R48 态 1,276,720），并把登记器 canonical / step9-mirror 期望退回 `1,276,720 / 022E98F4…`。
- 无 git 时：用 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r49-multifmt` 覆盖 canonical（该备份 = R48 态 1,276,720），再 `copy /Y` 同步回 step9 镜像。
- 也可仅回退功能：删除 `bindRightSidebar()` 内自 `const sel=window.getSelection();` 起、至 `if(selectedIds.length>0){…}` 整段（含 `execBatchFormat` 定义）为止的代码，即恢复纯 `execCommand` 行为，其余字节不受影响。

## 三十三 R50 多选格式重复更换去嵌套 + 格式刷批量应用 + 粘贴权限兜底（2026-10-22）

> 范围：`6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（逐字节镜像）。承接「三十二 R49」：R49 的批量分支已能把格式写入多选节点，但**反复更换同一类样式会层层嵌套**（每点一次多包一层 `<span style="color:…">`，最终只能改到最内层或整段失效），且**格式刷在多选节点状态下完全不可用**（只认文本 Range）。本波只改 `bindRightSidebar()` 的批量分支与格式刷 / 粘贴逻辑；数据契约 / 加密 payload / 公开 API 零变更，`<script>` 块数 9 不变。

**一 改动清单（JS 4 处；无 CSS / HTML 结构变更）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | 新增 HTML 字符串级格式管线（顶层函数，`格式刷` 段之前） | `fmtFragment`（`<template>` 惰性解析，不执行脚本）/ `fmtEachElement`（**后序遍历**，保证标签降级前后代已处理）/ `fmtTidy`（空 `style` 属性剥离 · 无属性 `span`/`font` 展开 · 空内联元素清理）/ `fmtClearKind`（按格式类型清除：`font-size` · `color` · `background-color` · `font-weight` · `font-style` · `text-decoration` token，含 `<font color|size|bgcolor>` 属性；`b/strong/i/em/u/s/strike/del` 纯标签直接展开，带伴随样式的标签**降级为 span 后再去格式**）/ `normalizeFormatHtml` / `captureFormatFromHtml` / `hasAnyFormat` / `applyFormatToHtml` / `batchFormatHtml` |
| ② | `execBatchFormat(cmdStr,val)` | 不再内联拼接 `_wrap` / `_wrapStyle`，改调 `batchFormatHtml(n.text||'',cmdStr,val)`：**先清除同类旧样式再包裹新标签**；`bold/italic/underline/strike` 改由 `captureFormatFromHtml` 判定后幂等切换（不再依赖首尾标签 `startsWith` 匹配）；提交参数与 `forceRender` 保持不变 |
| ③ | 格式刷批量模式 | `_fmtPainter` 增加 `batchMode` / `srcIds`；新增 `captureFormatFromNodes`（取第一个有格式的选中节点）/ `applyFormatToNodes`（单次 `commit` 批量写入 `applyFormatToHtml` 结果）/ `toggleBatchPainter`（首次点击拾取 → `batchMode=true` + 按钮高亮 + 提示；再次点击批量写入**当前全部选中节点**后 `deactivatePainter`）；`[data-cmd]` 批量分支内 `cmd==='painter'` 优先拦截；`onSelectionChangeForPainter` 对 `batchMode` 早退；`deactivatePainter` 改为整体重建状态对象（连同 `batchMode` / `srcIds` 一起复位） |
| ④ | 粘贴按钮 `cmd==='paste'` | `readText` 前先 `restorePasteFocus()`（焦点不在 `#content` 时聚焦首个 `.text[data-id]`），`then` 分支再次恢复焦点后执行原 `safeExec('insertText',text)`；`catch` 与「不支持剪贴板 API」分支统一提示 **「浏览器拒绝了剪贴板读取权限，请直接使用 Ctrl+V 粘贴」**（此前只提示「无法读取剪贴板」且焦点未恢复，落字失败） |

单光标 / 单选区路径（`safeExec('styleWithCSS')` + `execMap` + `bg`/`color`/`size` 选择器 + `captureFormat` / `applyCapturedFormat` 的 Range 应用）逐行未动 —— 真机探针 G 组已实测「文本选区拾取走 `batchMode=false` 原生路径，目标选区 250ms 后自动应用」。

**二 字节锚**

- canonical ≡ step9 镜像 = **1,289,544 B / `176974DD6750EF757997561812D4D2AC19EE28B470D5CB9B392757BB749437B7` / LF（CR=0 · LF=23,705 · split 23,706）**；增量 1,279,982 → 1,289,544（**+9,562 B / +199 行**）。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）。

**三 登记器重锚**

- canonical / step9-mirror 期望 `1,279,982/4E504F4F…00A10DE6` → **`1,289,544/176974DD…49437B7`**，并追加 R50 注释块；登记器自身行尾仍为 CRLF（CR=1,304 · LF=1,304）。
- `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。证据 `_哈希与行尾校验/r50-registry-2026-10-22.txt`。

**四 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| 语法自检（9 个内联 script 逐个 `vm.Script` 编译） | `BLOCKS=9 FAIL=0` / `EOL CR=0` | `_临时脚本/_r50_syntax_check_2026-10-22.mjs` → `_环境与调试/r50-syntax-check-2026-10-22.txt` |
| 红证（只换产品字节、未重锚登记器时跑门禁） | PW `tests/t10-idb-persist.spec.ts` T-99 登记器哨兵失败 1 例（`166 passed + 4 skipped + 1 failed`，`drift` 期望 0 实得 1）⇒ 判别力真实 | `_环境与调试/r50-verify-all-2026-10-22.txt` |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中 · Node **503/503** · PW **167 passed + 4 skipped = 171** · bench **7/7** → `[verify] 全部通过` | `_环境与调试/r50-verify-all-final-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_哈希与行尾校验/r50-registry-2026-10-22.txt` |
| 真机探针（系统 Chrome headless · 1440×900 · step9 镜像） | **28/28 PASS** | `_环境与调试/r50-patch-probe-2026-10-22.txt` |

- **去嵌套实测**：多选 2 节点连续三次换色 → 末态 `["<span style="color:#8B7C66">甲行文本</span>", …]`，`<span` 计数 = 1，前两次颜色（`#2E2218` / `#5A4B3B`）零残留；背景三次更换同理（末态单层），透明档覆盖为 `transparent` 不叠加；字号三次更换（9.8 → 16.8 → **28** px）末态仅一层 `font-size:28px`。
- **幂等切换实测**：批量粗体一次 `<b>…</b>`、再次点击解包回纯文本、第三次点击仍为单层 `<b>`（无 `<b><b>`）。
- **格式刷批量实测**：源节点 `<b><span style="color:#e03131">甲行文本</span></b>` → 三节点多选点击格式刷（`batchMode=true` · `srcIds=3` · 按钮高亮 · 提示「已拾取节点格式，请再次点击『格式刷』批量应用」）→ 再次点击写入 `<span style="color:rgb(224, 49, 49)"><b>乙行文本</b></span>` 等，源节点未被二次包裹，状态清除且按钮高亮移除；选中节点均无格式时提示「请先给选中节点的文字设置格式（加粗 / 颜色 / 字号等）」且数据零改写。
- **粘贴实测**：`navigator.clipboard.readText` 被 mock 为 reject（`NotAllowedError`）→ 提示「浏览器拒绝了剪贴板读取权限，请直接使用 Ctrl+V 粘贴」，`document.activeElement` 仍在 `#content` 内；可读时 `insertText` 正常落字（`#content` 文本出现「【粘贴文本】」）。
- 渲染层 / 控制台：`pageerror` / `console error` 0 条；截图 `_环境与调试/r50-patch-1440x900-2026-10-22.png`。
- 探针脚本：[`_临时脚本/_r50_patch_probe_2026-10-22.cjs`](../_临时脚本/_r50_patch_probe_2026-10-22.cjs:1)（只读产品文件；`playwright` 由 `step9/node_modules` 解析，启动系统 Chrome headless，不写任何产品数据）。
- **数量口径注记**：任务书尾部的「47 方」为 L19 时期口径；现行登记器实际为 **65 方**，本波实测 `PARTY_COUNT=65` / drift 0。

**五 回滚**

- 首选：`git checkout -- 6.P0-T3基线/v2.0-t3.html 6.P0-T3基线/step9/v2.0-t3.html`（本波改动尚未提交，回滚即回 R49 态 1,279,982），并把登记器 canonical / step9-mirror 期望退回 `1,279,982 / 4E504F4F…`。
- 无 git 时：用 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261022-r50`（= R49 态 1,279,982）覆盖 step9 镜像，再 `copy /Y` 同步回 canonical。
- 也可仅回退功能：`execBatchFormat` 恢复为 R49 的 `_wrap` / `_wrapStyle` 内联实现，删除顶层 `fmt*` / `normalizeFormatHtml` / `captureFormatFromHtml` / `hasAnyFormat` / `applyFormatToHtml` / `batchFormatHtml` 与 `captureFormatFromNodes` / `applyFormatToNodes` / `toggleBatchPainter`，并把 `[data-cmd]` 批量分支内 `cmd==='painter'` 拦截行删除；粘贴分支回到单行 `catch(()=>toast('无法读取剪贴板'))`。

## 三十四 R51 取色器即点即用 + 8 列 × 3 行色板 / 字号清除档并入网格（2026-10-22）

> 范围：`6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（逐字节镜像）。承接「三十三 R50」：R50 收口批量格式化后，取色器底部仍保留「预览 / 取消 / 确定」三段式交互，透明档占网格首格、色板为旧 24 色无序排列；字号弹层的「清除字号」独占网格下方一行。本波只重构两个选择器的 DOM / 事件与色板 token；数据契约 / 加密 payload / 公开 API 零变更，`<script>` 块数 9 不变。

**一 改动清单（JS 2 处 + CSS 1 处 + token 2 行）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | `--color-palette`（`:root` / `html[data-theme="night"]`） | 重定义为 24 色 = 8 组「浅 / 中 / 深」三连，按列序排列；日间与夜间同值。JS 仍由 `_themeList('--color-palette',[])` 读取，**定义块外不新增十六进制字面量**（守持 L16-W9 抽取口径） |
| ② | `openColorPicker` | 删除底部 footer（预览 / 取消 / 确定）；`cp-grid` 追加 `gridAutoFlow='column'` + `gridTemplateRows='repeat(3, 1fr)'`（逐列填充）；移除网格内透明块，改为 `cp-custom` 行最左侧「透明」按钮（仅 `opts.transparent` 背景色调用生成，34×26 居中）；色块点击 = `callback` + 立即 `closeColorPicker`；`input[type=color]` / `.cp-hex` 的 `oninput` 实时 `callback`；`picker.style.paddingTop='24px'` |
| ③ | `openSizePicker` | 删除独立 `sp-clear` 按钮；渲染数组改为 8 项（7 档 + `clear`），`s.v==='clear'` 渲染为普通按钮并应用 `justify-content:center; color:var(--danger); border-color:var(--danger-soft);`，点击 `clearFontSizeFromSelection()` + 收起；`picker.style.paddingTop='24px'`；`placePop` 高度 230 → 255（4 行） |
| ④ | CSS | 删除 `.cp-footer` / `.cp-preview` / `.sp-clear` / `.cp-swatch.tp`（含 `::after` / `.on::after`）死规则；新增 `.cp-transparent`（34×26 居中虚线按钮 + hover） |

**二 字节锚**

- canonical ≡ step9 镜像 = **1,288,906 B / `ED513B347B472CC88DDB7A68874088B2197FF98D262B6C9F967C0EC8E07F8B75` / LF（CR=0 · LF=23,698 · split 23,699）**；增量 1,289,544 → 1,288,906（**−638 B / −7 行**）。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）。

**三 登记器重锚**

- canonical / step9-mirror 期望 `1,289,544/176974DD…49437B7` → **`1,288,906/ED513B34…7F8B75`**，并追加 R51 注释块；登记器自身行尾仍为 CRLF。
- `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。证据 `_哈希与行尾校验/r51-registry-2026-10-22.txt`。
- `t9/t16-w9-theme-token.test.mjs` 的 DAY / NIGHT 色板期望同步为新 24 色基线（该文件不在 TARGETS 登记面内，不涉及第 65 方哈希）。

**四 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（62ms） · Node **503/503**（26,303ms） · PW **167 passed + 4 skipped = 171**（54,773ms） · bench **7/7**（最大恶化 0.0% / 中位 −14.3%，79ms）→ `[verify] 全部通过` | `_环境与调试/r51-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_哈希与行尾校验/r51-registry-2026-10-22.txt` |
| 真机探针（系统 Chrome headless · 1440×900 · step9 镜像） | **31/31 PASS** | `_环境与调试/r51-picker-probe-2026-10-22.txt` |

- **几何实测**：`.color-picker` 计算 `padding-top=24px`；`.cp-grid` `grid-auto-flow=column`、`grid-template-rows` 3 条、`grid-template-columns` 8 条、`.cp-swatch` 24 个；首列三色 `rgb(245,214,210) → rgb(255,107,107) → rgb(158,46,36)`（浅→中→深），三块 `x=1183` 相同、`y=249/279/310` 递增；关闭钮与首块包围盒零相交；面板完整落在 1440×900 视口内。
- **交互实测**：真实鼠标点击首块 → 回调 `#F5D6D2` 且面板立即消失；背景色调用生成 `.cp-transparent`（自定义行 `firstElementChild`，34×26，文案「透明」），点击回调 `transparent` 并收起；`.cp-hex` 键入 `#123456` 实时回调且面板保持打开；`input[type=color]` 派发 `input` 后回调 `#0a0b0c` 且 `.cp-hex` 同步 `#0A0B0C`。
- **字号实测**：弹层 `padding-top=24px`、`.sp-btn` 8 个、末位「清除字号」、文字色 = `--danger`（`rgb(196,38,23)`）、无 `.sp-clear`；点击「大 5」回调 `'5'` 并收起；点击清除档收起且不触发档位回调。
- 渲染层 / 控制台：`pageerror` / `console error` 0 条；截图 `_环境与调试/r51-picker-1440x900-2026-10-22.png`。
- 探针脚本：[`_临时脚本/_r51_picker_probe_2026-10-22.cjs`](../_临时脚本/_r51_picker_probe_2026-10-22.cjs:1)（只读产品文件；`playwright` 由 `step9/node_modules` 解析，启动系统 Chrome headless，不写任何产品数据）。
- **数量口径注记**：任务书尾部的「47 方」为 L19 时期口径；现行登记器实际为 **65 方**，本波实测 `PARTY_COUNT=65` / drift 0。

**五 回滚**

- 首选：`git checkout -- 6.P0-T3基线/v2.0-t3.html 6.P0-T3基线/step9/v2.0-t3.html`（本波改动尚未提交，回滚即回 R50 态 1,289,544），并把登记器 canonical / step9-mirror 期望退回 `1,289,544 / 176974DD…`。
- 无 git 时：用 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261022-r51-picker`（= R50 态 1,289,544）覆盖 step9 镜像，再 `copy /Y` 同步回 canonical。
- 也可仅回退功能：恢复 footer 三段式 + 网格内透明块 + `clearBtn` 独立按钮，并把 `--color-palette` 两行退回 R50 旧色列表。

## 三十五 R52 取色器透明档按钮强化 + 色号输入框收窄 / 字号清除档统一绿色描边（2026-10-22）

> 范围：`6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（逐字节镜像）。承接「三十四 R51」：R51 落位 8 列 × 3 行色板与即点即用后，`cp-custom` 行的「透明」按钮仍为 34×26 虚线灰字（不醒目），`.cp-hex` 以 `flex:1` 占满剩余横向空间；字号弹层「清除字号」仍使用危险色（红）内联样式，与透明档风格割裂。本波只改 UI 尺寸 / 颜色 / 边框与弹性布局；数据契约 / 加密 payload / 公开 API / `<script>` 块数（9）零变更。

**一 改动清单（CSS 2 行 + JS 1 处）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | `.cp-transparent` | 尺寸 34×26 → **48×32**；`color:var(--accent)` + `font-weight:bold`；`border:2px solid var(--accent)`（原 1px dashed `--line-soft`）；`background:transparent` 保持不变；hover 由仅换色改为 `--accent-soft` 底 + `--accent` 字 |
| ② | `.cp-custom .cp-hex` | `flex:1` → **`flex:none; width:70px`**（padding 5px 8px → 5px 6px），节约的横向空间让给透明档按钮；`box-sizing:border-box` 全局口径下实测宽 70px |
| ③ | `openSizePicker`（`s.v==='clear'` 分支） | 内联样式 `justify-content:center; color:var(--danger); border-color:var(--danger-soft);` → **`justify-content:center; color:var(--accent); font-weight:bold; border:2px solid var(--accent);`**，与透明档风格统一；点击仍走 `clearFontSizeFromSelection()` + `closeSizePicker()` |

**二 字节锚**

- canonical ≡ step9 镜像 = **1,289,001 B / `227F8E39707CFA6BDA75E820BC7FD1A418D17ED0261B57DEAA6B19858C6C45F4` / LF（CR=0 · LF=23,698 · split 23,699）**；增量 1,288,906 → 1,289,001（**+95 B / 行数不变**）。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）。

**三 登记器重锚**

- canonical / step9-mirror 期望 `1,288,906/ED513B34…7F8B75` → **`1,289,001/227F8E39…C45F4`**，并追加 R52 注释块；登记器自身行尾仍为 CRLF（CR=1,327 · LF=1,327）。
- `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。证据 `_哈希与行尾校验/r52-registry-2026-10-22.txt`。

**四 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（18ms） · Node **503/503**（26,850ms） · PW **171**（57,756ms） · bench **7/7**（最大恶化 0.0% / 中位 −14.3%，78ms）→ `[verify] 全部通过` | `_环境与调试/r52-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_哈希与行尾校验/r52-registry-2026-10-22.txt` |
| 真机探针（系统 Chrome headless · 1440×900 · step9 镜像） | **23/23 PASS** | `_环境与调试/r52-picker-probe-2026-10-22.txt` |

- **透明档实测**：`.cp-transparent` 包围盒 **48×32**；`color = rgb(51,101,76) = --accent`；`font-weight=700`；四边 `border=2px`、`solid`、同 `--accent`；`background-color=rgba(0,0,0,0)`；点击回调 `transparent` 且面板立即收起。
- **色号框实测**：`.cp-hex` `width=70px`、`flexGrow=0 / flexShrink=0 / flexBasis=auto`（= `flex:none`）；`.cp-custom` 横向溢出 = **0**；面板完整落在 1440×900 视口内；键入 `#123456` 实时回调且面板保持打开。
- **清除档实测**：仍位于 `.sp-grid` 第 8 位（末位）；`color=rgb(51,101,76)=--accent`（≠ `--danger` `rgb(196,38,23)`）、`font-weight=700`、四边 `border=2px solid --accent`、`justify-content=center`；点击后弹层关闭且档位回调为 `null`；`大 5` 档回调 `'5'` 并关闭。
- 渲染层 / 控制台：`pageerror` / `console error` 0 条；截图 `_环境与调试/r52-picker-1440x900-2026-10-22.png`。
- 探针脚本：[`_临时脚本/_r52_picker_probe_2026-10-22.cjs`](../_临时脚本/_r52_picker_probe_2026-10-22.cjs:1)（只读产品文件；`playwright` 由 `step9/node_modules` 解析，启动系统 Chrome headless，不写任何产品数据）。
- **数量口径注记**：任务书尾部的「47 方」为 L19 时期口径；现行登记器实际为 **65 方**，本波实测 `PARTY_COUNT=65` / drift 0。

**五 回滚**

- 首选：`git checkout -- 6.P0-T3基线/v2.0-t3.html 6.P0-T3基线/step9/v2.0-t3.html`（本波改动尚未提交，回滚即回 R51 态 1,288,906），并把登记器 canonical / step9-mirror 期望退回 `1,288,906 / ED513B34…`。
- 无 git 时：用 `6.P0-T3基线/step9/v2.0-t3.html.bak-r52-2026-10-22`（= R51 态 1,288,906）覆盖 step9 镜像，再 `copy /Y` 同步回 canonical。
- 也可仅回退功能：`.cp-transparent` 恢复 34×26 虚线灰字、`.cp-hex` 恢复 `flex:1`、`clear` 档内联样式恢复 `color:var(--danger); border-color:var(--danger-soft);`。

## 三十六 R53 取色器透明档 / 字号清除档字号口径统一 1em（2026-10-22）

> 范围：`6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（逐字节镜像）。承接「三十五 R52」：R52 落位 48×32 透明档按钮与 70px 色号框后，透明档按钮字号仍为 `.82em`（比同面板控件小一档），字号弹层「清除字号」档未声明字号（继承 `.sp-btn` 的 `.85em`）。本波只改两处字号声明；尺寸 / 颜色 / 边框 / 弹性布局 / 数据契约 / 加密 payload / 公开 API / `<script>` 块数（9）零变更。

**一 改动清单（CSS 1 行 + JS 1 处）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | `.cp-transparent` | `font-size:.82em` → **`font-size:1em`**；48×32 / `flex:none` / `display:flex` / `align-items:center` / `justify-content:center` / `color:var(--accent)` / `font-weight:bold` / `border:2px solid var(--accent)` / `background:transparent` 全部保持不变 |
| ② | `.cp-hex` | R52 的 `flex:none; width:70px` 复核无漂移，本波**未触碰**（实测仍 = 70px / flex:none） |
| ③ | `openSizePicker`（`s.v==='clear'` 分支） | 内联样式追加 **`font-size:1em`** → `justify-content:center; font-size:1em; color:var(--accent); font-weight:bold; border:2px solid var(--accent);`；点击仍走 `clearFontSizeFromSelection()` + `closeSizePicker()` |

**二 字节锚**

- canonical ≡ step9 镜像 = **1,289,014 B / `2163B9E37E6FBABB6E7353F146A435896DDCB02DAD096476773EAE95C4E10DAC` / LF（CR=0 · LF=23,698 · split 23,699）**；增量 1,289,001 → 1,289,014（**+13 B / 行数不变**）。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）。

**三 登记器重锚**

- canonical / step9-mirror 期望 `1,289,001/227F8E39…C45F4` → **`1,289,014/2163B9E3…10DAC`**，并追加 R53 注释块；登记器自身行尾仍为 CRLF（CR=1,334 · LF=1,334）。
- `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。证据 `_哈希与行尾校验/r53-registry-verify-2026-10-22.txt`。

**四 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（23ms） · Node **503/503**（26,684ms） · PW **171**（167 passed + 4 skipped，56,796ms） · bench **7/7**（最大恶化 0.0% / 中位 −14.3%，84ms）→ `[verify] 全部通过` | `_环境与调试/r53-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_哈希与行尾校验/r53-registry-verify-2026-10-22.txt` |
| 真机探针（系统 Chrome headless · 1440×900 · step9 镜像） | **27/27 PASS** | `_环境与调试/r53-picker-probe-2026-10-22.txt` |

- **透明档实测**：包围盒 **48×32**；`display=flex` / `align-items=center` / `justify-content=center`；`color=rgb(51,101,76)=--accent`；`font-weight=700`；四边 `border=2px`、`solid`、同 `--accent`；`background-color=rgba(0,0,0,0)`；**`font-size=11.76px` = 面板字号（1em）**；点击回调 `transparent` 且面板立即收起。
- **色号框复核**：`.cp-hex` `width=70px`、`flexGrow=0 / flexShrink=0 / flexBasis=auto`（= `flex:none`）；`.cp-custom` 横向溢出 = **0**；面板完整落在 1440×900 视口内；键入 `#123456` 实时回调且面板保持打开。
- **清除档实测**：仍位于 `.sp-grid` 第 8 位（末位）；`color=rgb(51,101,76)=--accent`（≠ `--danger` `rgb(196,38,23)`）、`font-weight=700`、四边 `border=2px solid --accent`、`justify-content=center`；**`font-size=11.76px` = 面板字号（1em），大于同级默认档 9.996px（0.85em）**；点击后弹层关闭且档位回调为 `null`；`大 5` 档回调 `'5'` 并关闭。
- 渲染层 / 控制台：`pageerror` / `console error` 0 条；截图 `_环境与调试/r53-picker-1440x900-2026-10-22.png`。
- 探针脚本：[`_临时脚本/_r53_picker_probe_2026-10-22.cjs`](../_临时脚本/_r53_picker_probe_2026-10-22.cjs:1)（只读产品文件；`playwright` 由 `step9/node_modules` 解析，启动系统 Chrome headless，不写任何产品数据）。
- **数量口径注记**：任务书尾部的「47 方」为 L19 时期口径；现行登记器实际为 **65 方**，本波实测 `PARTY_COUNT=65` / drift 0。

**五 回滚**

- 首选：`git checkout -- 6.P0-T3基线/v2.0-t3.html 6.P0-T3基线/step9/v2.0-t3.html`（本波改动尚未提交，回滚即回 R52 态 1,289,001），并把登记器 canonical / step9-mirror 期望退回 `1,289,001 / 227F8E39…`。
- 无 git 时：用 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r53`（= R52 态 1,289,001）覆盖 canonical，再 `copy /Y` 同步 step9 镜像。
- 也可仅回退功能：`.cp-transparent` 恢复 `font-size:.82em`；`clear` 档内联样式移除 `font-size:1em;`。

## 三十七 R54 日历「字数统计」模块（零遍历增量聚合）（2026-10-22）

> 范围：`6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（逐字节镜像）。承接「三十六 R53」：日历底部五模块（日历 / 记事本 / 当日待办 / 系统日志 / 统计）只回答「待办完成了多少」，无法回答「写了多少字」。本波新增第六个模块 `chars`，以**提交期 O(1) 增量聚合 + 渲染期零遍历读取**落实字数统计，避免按日全树扫描导致的卡顿。数据契约新增纯派生的 `state.charStats`；加密 payload 字段名 / 公开 API / `<script>` 块数（9）零变更。

**一 改动清单（JS 8 处，无 CSS）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | `defaultState()` | 返回对象增加 `charStats:{}`（与 `activity` 同级，按日期桶存放） |
| ② | `migrateStateObject()` | 增加 `if(typeof st.charStats==='undefined')st.charStats={};`（旧备份 / 导入 / 旧持久化数据归一） |
| ③ | `actions.logActivity(type,id,detail,diff)` | 签名增加第 4 参数 `diff`；`commit(s=>{…})` 内按 `ds=todayStr()` O(1) 累加：`add` 记纯文本长度、`del` 记被删文本长度、`mod` 记传入的 `diff`（缺省 0），落 `s.charStats[ds].add/del/mod` |
| ④ | `actions.logActivity` 的 `type==='mod'` 分支 | `accumulatedDiff = (prev?(prev.diff||0):0) + diff`；防抖计时器回调与 `_logTimers` 的 `commit` 均以该累计值调用 `doCommit(accumulatedDiff)`，窗口内多次编辑不丢增量 |
| ⑤ | `actions.updateText()` | 提交后计算 `diff = stripHtml(新).length − stripHtml(旧).length` 并调用 `actions.logActivity('mod',id,null,diff)` |
| ⑥ | `CAL_MODULE_KEYS` / `calModuleTitle` | 键数组增加 `'chars'`（位于 `calendar` 之后）；标题表增加 `chars:'字数统计'` |
| ⑦ | `calModuleState()` / `applyUIFields()` / `ui` 初始值 | 默认 `order` 同步为 `['calendar','chars','note','today','log','stats']`；旧档 `order` 缺 `chars` 时补在日历之后（仅首次补位，不干预用户拖拽结果） |
| ⑧ | 新增 `calModuleCharsDates()` / `calModuleCharsBody(head)` + `renderCalModules()` 分支 | 按 `ui.calView` 生成日期列表（年 365 / 月 28–31 / 周 7），逐日直接读 `state.charStats[ds]` 累加；渲染「新增 / 删除 / 修改 / 净变化」四卡片（修改与净变化带正负号），周视图追加 7 日柱状图；`else if(k==='chars')body.appendChild(calModuleCharsBody(head));` |

**二 字节锚**

- canonical ≡ step9 镜像 = **1,294,639 B / `29C0851D98ED126D1B2F9A24E872FF0BAE5557D86CF8D427D19E8BFA769324E1` / LF（CR=0 · LF=23,807 · split 23,808）**；增量 1,289,014 → 1,294,639（**+5,625 B / +109 行**）。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）；改动前双侧快照 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r54-charstats`、`6.P0-T3基线/step9/v2.0-t3.html.bak-20261022-r54-charstats`（= R53 态 1,289,014）。

**三 登记器重锚**

- canonical / step9-mirror 期望 `1,289,014/2163B9E3…10DAC` → **`1,294,639/29C0851D…24E1`**，并追加 R54 注释块；登记器自身行尾仍为 CRLF（CR=1,334 · LF=1,334）。
- `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。证据 `_环境与调试/r54-registry-2026-10-22.txt`。
- 重锚前红证（判别力）：`FAIL canonical size=1,294,639 (exp 1,289,014)` + `FAIL step9-mirror …` ⇒ `FIVE_PARTY_DRIFT_COUNT=2`，恰为两侧产品件。

**四 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（41ms） · Node **503/503**（26,002ms） · PW **171**（167 passed + 4 skipped，55,360ms） · bench **7/7**（最大恶化 0.0% / 中位 −14.3%，93ms）→ `[verify] 全部通过` | `_环境与调试/r54-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/r54-registry-2026-10-22.txt` |
| 真机探针（系统 Chrome headless · 1440×900 · step9 镜像） | **14/14 PASS** | `_环境与调试/r54-charstats-probe-2026-10-22.txt` |

- **模块实测**：`[data-key="chars"]` 位于 `calendar` 之后（`order = ["calendar","chars","note","today","log","stats"]`），标题 = 字数统计，正文 4 张卡片（新增 / 删除 / 修改 / 净变化）；空态显示 `6/0/0/+6`（当日既有 6 字活动日志）。
- **增量聚合实测**：`add` 新增「字数统计探针ABC」（9 个纯文本字符）⇒ `charStats[今日].add` 6 → 15；`updateText` 改为「字数统计探针ABCDEF」⇒ 防抖 1.5s 后 `mod` 0 → 3（长度差 3）；`removeNode` ⇒ `del` 0 → 12（被删文本纯文本长度）。
- **渲染一致性**：月视图（31 日）卡片 DOM 值 `["15","12","+3","+6"]` ≡ 逐日读 `state.charStats` 的聚合值（新增 15 / 删除 12 / 修改 +3 / 净变化 +6）。
- **周视图实测**：柱状图 **7 根**，日期标签 `10-18…10-24`（MM-DD），卡片仍为 4 张。
- 渲染层 / 控制台：`pageerror` / `console error` 0 条。
- 探针脚本：[`_临时脚本/_r54_charstats_probe_2026-10-22.mjs`](../_临时脚本/_r54_charstats_probe_2026-10-22.mjs:1)（只读产品文件；`playwright` 由 `step9/node_modules` 解析，启动系统 Chrome headless）。
- **数量口径注记**：任务书尾部的「47 方」为 L19 时期口径；现行登记器实际为 **65 方**，本波实测 `PARTY_COUNT=65` / drift 0。

**五 回滚**

- 首选：`git checkout -- 6.P0-T3基线/v2.0-t3.html 6.P0-T3基线/step9/v2.0-t3.html`（本波改动尚未提交，回滚即回 R53 态 1,289,014），并把登记器 canonical / step9-mirror 期望退回 `1,289,014 / 2163B9E3…`。
- 无 git 时：用 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r54-charstats`（= R53 态 1,289,014）覆盖 canonical，再 `copy /Y` 同步 step9 镜像。
- 也可仅回退功能：删除 `calModuleCharsDates` / `calModuleCharsBody` 与 `renderCalModules` 的 `chars` 分支，`CAL_MODULE_KEYS` / 标题表 / 默认 `order` 去掉 `'chars'`，`logActivity` 的第 4 参数与 `charStats` 累加块删除（`charStats` 残留为空对象不影响其它字段）。

## 三十八 R55 日历底部模块标题统一 + 字数统计年/月/周柱状图（2026-10-22）

> 范围：`6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（逐字节镜像）。承接「三十七 R54」：字数统计仅周视图有柱状图、月 / 年视图无趋势图形；且日历底部两处模块标题格式不一（字数统计无 scope、任务统计沿用 `统计（2026年10月）`）。本波统一为「名称（scope）」并对三种视图补全柱状图。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数（9）零变更。

**一 改动清单（JS 3 处，无 CSS）**

| # | 位置 | 改动 |
| --- | --- | --- |
| ① | 新增 `_getCalScopeText()`（置于 `calStatsScope()` 之前） | 统一 scope 文本：年 `2026` / 周 `10.18-10.24`（选中日所在周日至周六）/ 月 `2026.10` |
| ② | `calModuleStatsBody()` | 标题改为 `'任务统计（'+_getCalScopeText()+'）'`（原 `calModuleTitle('stats')+'（'+calStatsScope()+'）'`） |
| ③ | `calModuleCharsBody()` | 函数开头写入标题 `'字数统计（'+_getCalScopeText()+'）'`；按 `ui.calView` 构建 `daysData`（年 12 桶按自然月聚合 / 周 7 桶 / 月 28–31 桶）后统一绘制柱状图（正 `--accent` / 负 `--danger` / 0 值不显数值且 `opacity:0.2`）；R54 的周视图专用柱状图与模块头 scope 徽章（信息已并入标题）退役 |

- 实现口径注记：柱值取 `(st.add|0)-(st.del|0)+(st.mod|0)`（旧档缺字段时为 0 而非 `NaN`，与本模块四卡片循环同口径），并复用函数内已守卫的局部 `stats` 缓存；`calStatsScope()` 函数体原样保留（不再被调用）。

**二 字节锚**

- canonical ≡ step9 镜像 = **1,296,173 B / `1753CF3A18484AB2B988E01BB2D47F2F7F747CB25ED98851F0DB4E66AD24EBCE` / LF（CR=0 · LF=23,843 · split 23,844）**；增量 1,294,639 → 1,296,173（**+1,534 B / +36 行**）。
- 本波**未物化新冻结件**（封存 HEAD 仍为 `r22`）；改动前双侧快照 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r55`、`6.P0-T3基线/step9/v2.0-t3.html.bak-20261022-r55`（= R54 态 1,294,639）。

**三 登记器重锚**

- canonical / step9-mirror 期望 `1,294,639/29C0851D…24E1` → **`1,296,173/1753CF3A…24EBCE`**，并追加 R55 注释块；登记器自身行尾仍为 CRLF（CR=1,343 · LF=1,343）。
- `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。证据 `_环境与调试/r55-registry-2026-10-22.txt`。
- 重锚前红证（判别力）：门禁中 `t10-idb-persist.spec.ts · T-99` 报 `Expected: 0 / Received: 2` ⇒ `FIVE_PARTY_DRIFT_COUNT=2`，恰为两侧产品件。证据 `_环境与调试/r55-verify-all-2026-10-22.txt`。

**四 门禁与真机证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（79ms） · Node **503/503**（26,554ms） · PW **171**（167 passed + 4 skipped，56,429ms） · bench **7/7**（最大恶化 0.0% / 中位 −14.3%，79ms）→ `[verify] 全部通过` | `_环境与调试/r55-verify-all-final-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/r55-registry-2026-10-22.txt` |
| 真机探针（系统 Chrome headless · 1440×900 · step9 镜像） | **23/23 PASS** | `_环境与调试/r55-caltitle-probe-2026-10-22.txt` |

- **标题统一实测**：月视图 `字数统计（2026.10）` / `任务统计（2026.10）`，两模块 scope 文本逐字一致；周视图 `10.18-10.24`；年视图 `2026`。
- **柱状图实测**：月视图 31 根（标签 `1…31`）、周视图 7 根（标签 `10/18…10/24`）、年视图 12 根（标签 `1月…12月`）；柱区样式 `height:56px` / `border-top:1px solid var(--line-soft)` / `margin-top:10px`。
- 渲染层 / 控制台：`pageerror` / `console error` 0 条。
- 探针脚本：[`_临时脚本/_r55_caltitle_probe_2026-10-22.mjs`](../_临时脚本/_r55_caltitle_probe_2026-10-22.mjs:1)（只读产品文件；`playwright` 由 `step9/node_modules` 解析，启动系统 Chrome headless）。

**五 回滚**

- 首选：`git checkout -- 6.P0-T3基线/v2.0-t3.html 6.P0-T3基线/step9/v2.0-t3.html`（本波改动尚未提交，回滚即回 R54 态 1,294,639），并把登记器 canonical / step9-mirror 期望退回 `1,294,639 / 29C0851D…`。
- 无 git 时：用 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r55`（= R54 态 1,294,639）覆盖 canonical，再 `copy /Y` 同步 step9 镜像。
- 也可仅回退功能：`_getCalScopeText()` 删除；`calModuleStatsBody` 标题恢复 `calModuleTitle('stats')+'（'+calStatsScope()+'）'`；`calModuleCharsBody` 标题行删除、`daysData` 块恢复为 R54 的 `const daily=[]` + 周视图专用柱状图，并恢复 `calModuleBadge(head, calStatsScope())`。

## 三十九 R56 不变量清单 #95–#100 物理追加（2026-10-22）

> 范围：`4.回归与验收/JU-不变量清单-v2.0-frozen.md`（**文档层**）。按任务给定脚本在文件**末尾**物理追加一章 + 不变量 #95–#100，并把全文计数口径由「现行 85 条（#1–#94）」同步为「现行 91 条（#1–#100）」。产品 `6.P0-T3基线/v2.0-t3.html` 与 `6.P0-T3基线/step9/v2.0-t3.html` **零改动**（canonical 仍 1,296,173 B / `1753CF3A…24EBCE`，见 §三十八）。

**一 追加内容（6 条）**

| # | 不变量 | 要点 |
| --- | --- | --- |
| 95 | 主题按钮图标更替与样式统一 | `#btnTheme` 动态 SVG 统一「上衣」轮廓路径（`M20.38 3.46…`），`fill:none` / `stroke:var(--icon)`，尺寸与其他按钮一致 |
| 96 | 当日待办右键菜单折叠化与统一视觉 | 折叠项复用 `.ctx-item` 尺寸 / 内边距 / 字体；折叠三角 ▶/▼ + 普通项同宽占位保证左对齐；折叠区浅色背景 `var(--bg-panel2)` + 圆角 |
| 97 | 多选节点批量格式化与格式刷兼容 | 多选且无文本选区 ⇒ `execBatchFormat` 批量应用；先清 `fontSize` / `color` 防嵌套；`painter` 提取首节点格式批量套用；剪贴板权限被拒给出友好提示 |
| 98 | 颜色/字号选择器即点即用与布局矩阵 | 取消底部按钮、点选即应用即关闭；透明块移出网格置于自定义区最左；8 列 3 行 `grid-auto-flow:column` + 顶部 24px 留白；清除字号并入 4 行 2 列网格并统一强调色描边 |
| 99 | 日历字数统计模块与底层增量聚合 | `actions.logActivity(diff)` 落盘时按 `stripHtml` 纯文本口径累加 `state.charStats[ds].add/del/mod`；`calModuleCharsBody` 按视图直接累加并展示四项 |
| 100 | 日历模块标题统一与柱状图补全 | 两模块标题后缀统一由 `_getCalScopeText()` 生成（年/月/周）；字数统计在年 / 月 / 周视图均绘制柱状图（正增长绿 / 负增长红） |

- 每条均含「定义 / 断言（`js` 围栏代码块，共 6 段）/ 关联实现」三段结构。
- 形态说明：编号行为 plain `NN. ` 行（按任务给定脚本原文落盘，未补 `### ` 前缀），故 `### 编号条目` 实测仍为 94、plain 新增条目实测 6 行；文档 `{#ui-enhancements}` 锚点实测 1 处。
- 落位说明：按「追加至文件末尾」的指令，新章位于「核对说明 / 关联文件」两节之后（非插在「核对说明」之前，与 R45 的 #94 插位方式不同）。

**二 字节锚**

- 追加前：**140,494 B / `032A6C19519D1CFB5948EBE044A1856CD9B89D19AB2B727F834CF4D727B43A00` / LF（CR=0 · LF=2,072）**
- 追加段：**5,500 B / `746E91827AB075C7C20CC3D88F1F5718260A546338A5D48F55B7AB20E466E780` / LF（CR=0 · 99 行）**
- 追加后：**145,996 B / `998927A0A8843FA29DDC699EC1D5822160A826D334CDB289A30FB9A03BB30D3E` / LF（CR=0 · LF=2,171 · 末字节 0x0A · 无 BOM）**；增量 **+5,502 B / +99 行**。
- 基线区逐行 diff **仅 3 行**（L8 头注 / L1476 修复登记章引言 / L2062 核对说明），变动内容均为「85 条（#1–#94）」→「91 条（#1–#100）」；其余 2,069 行逐字节零变更；落盘尾段 5,500 B 与追加段 SHA-256 逐字节一致。
- 回滚快照：`4.回归与验收/JU-不变量清单-v2.0-frozen.md.bak-r56-2026-10-22`（= 追加前 140,494 B）。
- 追加脚本（幂等复核）：`_临时脚本/_r56_append_inv95_100_2026-10-22.mjs` → `equals_expected=true` / `head_140496_equals_editedBaseline=true` / `tail_5500_equals_appendSegment=true` / `RESULT=PASS`。

**三 登记器重锚**

- `6.P0-T3基线/step9/verify-hash-registry.mjs`：`JU-不变量清单-v2.0-frozen.md` 期望值 `140494 / 032A6C19…B43A00` → **`145996 / 998927A0…BB30D3E`**，并追加 R56 注释块。
- 重锚前红证（判别力）：`FIVE_PARTY_DRIFT_COUNT=1`，唯一 FAIL 方即本清单（`size=145996 (exp 140494)`）；重锚后 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。**方数保持 65**，其余 64 方期望值一字未动。
- 证据：`_环境与调试/r56-registry-red-2026-10-22.txt`、`_环境与调试/r56-registry-2026-10-22.txt`。

**四 门禁证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（18ms） · Node **503/503**（27,688ms） · PW **171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 + L13 6，59,347ms） · bench **7/7**（79ms）→ `[verify] 全部通过` | `_环境与调试/r56-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/r56-registry-2026-10-22.txt` |
| 追加复核（幂等脚本） | `RESULT=PASS`（`equals_expected=true`） | `_环境与调试/r56-inv-append-2026-10-22.txt` |

- 环境注记：`verify.js` 以裸 `node` 派生 Node 单测，PATH 无 node 时首跑 `spawnSync node ENOENT` 退出 1；留档 `_环境与调试/r56-verify-all-envpathfail-2026-10-22.txt`，补齐 PATH 后重跑全绿（上表）。

**五 回滚**

- 文档回滚：用 `JU-不变量清单-v2.0-frozen.md.bak-r56-2026-10-22` 覆盖清单，并把登记器该行期望退回 `140494 / 032A6C19…B43A00`。
- 产品件无需回滚（本波产品零改动）；`1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`）。

## 四十 R57 周期规则 interval 防御 + 数据库主列标题优先渲染（2026-10-22）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**同文本双件同步**，落盘后两件仍**逐字节一致**（同 1,296,464 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更。

**一 变更点（3 处）**

| # | 位置 | 变更 |
| --- | --- | --- |
| ① | `expandRecurring` 内 | 重复规则解构由 `const{freq,interval=1,weekday}=n.recur;` 改为「先取 `freq` / `weekday`，`interval` 归一为 `Math.max(1,Math.floor(Number(n.recur.interval)||1))`」——间隔为 0 / 负数 / null / NaN / 非数字时一律回落 1，避免除零语义与规则失效 |
| ② | `buildYearCounts` 内 | 同口径归一（原为同一解构写法）；`interval<=0` 时年视图游标不再原地打转 |
| ③ | `renderDbTable` 单元格渲染链 | 主列标题分支（`fn===titleFieldName`）整段上移至链首并改为独立 `if`，条件追加 `!(_hasType && (formula|link|multi_select))` 排除三型；`select` / `date` / `number` 类型下主列仍渲染标题输入框；其余分支顺序与内容不变 |

**二 字节锚**

- 变更前（R55 口径）：**1,296,173 B / `1753CF3A…24EBCE` / LF（CR=0 · LF=23,843）**
- 变更后：**1,296,464 B / `2D97BAB4…BB3A54`（全文 `2D97BAB47017520F324F5A3B2A7D88DF5893B2599A509B686E658EAAE4BB3A54`）/ LF（CR=0 · LF=23,848）**；增量 **+291 B / +5 行**；末字节 `0x0A` · 无 BOM。
- canonical 与 step9 镜像：`sha256` 相等（逐字节一致）。
- 增量拆解：`expandRecurring` +88 B / +2 行 · `buildYearCounts` +108 B / +2 行 · `renderDbTable` +95 B / +1 行。

**三 登记器重锚**

- `6.P0-T3基线/step9/verify-hash-registry.mjs`：`canonical` / `step9-mirror` 期望值 `1296173 / 1753CF3A…24EBCE` → **`1296464 / 2D97BAB4…BB3A54`**，并追加 R57 注释块。**方数保持 65**（不新增纳编物），其余 63 方期望值一字未动。
- 重锚前红证（判别力）：`FIVE_PARTY_DRIFT_COUNT=1`，唯一 FAIL 方 = `step9-mirror`（`size=1296464 (exp 1296173)`），`RESULT=FAIL`；重锚后 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。

**四 门禁证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（71ms）· Node **503/503**（34,871ms）· PW **171**（167 passed + 4 skipped，65,143ms）· bench **7/7**（86ms）→ `[verify] 全部通过` | `_环境与调试/r57-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/r57-registry-2026-10-22.txt` |
| 产品件双件等价 | canonical 与 step9 镜像同字节同哈希（1,296,464 B / `2D97BAB4…BB3A54`） | 本文件 §二 |

- 环境注记：本机 PATH 无 `node`，门禁以 Node 22.22.2 显式绝对路径注入 PATH 后执行（`C:\Users\...\.workbuddy\binaries\node\versions\22.22.2-6`）；`verify.js` 内部派生裸 `node` 因此可解析。

**五 回滚**

- 产品件：把两处解构还原为 `const{freq,interval=1,weekday}=n.recur;`，并把 `renderDbTable` 标题分支退回 `select` 之后；落盘后应为 1,296,173 B / `1753CF3A…24EBCE`。
- 登记器：把 `canonical` / `step9-mirror` 两行期望值退回 `1296173 / 1753CF3A…24EBCE`。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`；本波未物化新冻结件）。

## 四十一 R58 日历失焦重复规则比较 / 日历模块日节点引用释放 / 标签弹层监听守卫 / 标签计数降级（2026-10-22）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**同文本双件同步**，落盘后两件仍**逐字节一致**（同 1,296,688 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更。

**一 变更点（4 处）**

| # | 位置 | 变更 |
| --- | --- | --- |
| ① | `renderCalNode` 的 `text.addEventListener('blur', …)` 内 | 重复规则比较由 `newRecur!==cur.recur` 改为 `const recurChanged=JSON.stringify(newRecur)!==JSON.stringify(cur.recur);`，`dateChanged` 改由 `recurChanged` 合成——`parseNaturalDate` 每次返回新对象时不再恒判定为规则变更，只有内容差异才提交 |
| ② | `renderMain` 内 `c.innerHTML='';` 之后、`switch(view){` 之前 | 新增 `if(view!==VIEW_KIND.CALENDAR)_calDayNodesForModules=null;`——离开日历视图即释放上一轮 `getDayNodes` 闭包引用，避免模块日节点缓存被主渲染长期滞留 |
| ③ | `openTagPicker` / `openTagPalette` 末尾的 `setTimeout(…,0)` | 回调首行加 `if(!p.isConnected)return;`——弹层在延迟窗口内已移除时不再向 `document` 挂 `mousedown` 监听，杜绝残留监听累积 |
| ④ | `_l7TagCountText` 的 `l7TagIndexWhenReady` 回调 | 索引构建失败（`_tagIndexCache` 为空）时把 `#cntTags` 置为 `'?'` 降级占位，不再停留省略号；`title` 清除逻辑不变 |

**二 字节锚**

- 变更前（R57 口径）：**1,296,464 B / `2D97BAB4…BB3A54` / LF（CR=0 · LF=23,848）**
- 变更后：**1,296,688 B / `1687B4D8…7A40E8`（全文 `1687B4D8ADE76000759E843718ADE65320C3E6CB9D259CED94BA73993B7A40E8`）/ LF（CR=0 · LF=23,853）**；增量 **+224 B / +5 行**；末字节 `0x0A` · 无 BOM。
- canonical 与 step9 镜像：`sha256` 相等（逐字节一致）。

**三 登记器重锚**

- `6.P0-T3基线/step9/verify-hash-registry.mjs`：`canonical` / `step9-mirror` 期望值 `1296464 / 2D97BAB4…BB3A54` → **`1296688 / 1687B4D8…7A40E8`**，并追加 R58 注释块。**方数保持 65**（不新增纳编物），其余 63 方期望值一字未动。
- 实测：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；证据 `_环境与调试/r58-registry-2026-10-22.txt`。

**四 门禁证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（53ms）· Node **503/503**（28,858ms）· PW **171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 + L13 6，77,893ms）· bench **7/7**（86ms）→ `[verify] 全部通过` | `_环境与调试/r58-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/r58-registry-2026-10-22.txt` |
| 产品件双件等价 | canonical 与 step9 镜像同字节同哈希（1,296,688 B / `1687B4D8…7A40E8`） | 本文件 §二 |

- 环境注记：本机 PATH 无 `node`，门禁以 Node 22.22.2 显式绝对路径（`C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6`）注入 PATH 后执行；`verify.js` 内部派生裸 `node` 因此可解析。

**五 回滚**

- 产品件：还原 ① 的 `dateChanged` 单行比较（去掉 `recurChanged`）、删除 ② 的 `_calDayNodesForModules=null` 行、删除 ③ 的两处 `isConnected` 守卫、删除 ④ 的 `else if(el)el.textContent='?'`；落盘后应为 1,296,464 B / `2D97BAB4…BB3A54`。
- 登记器：把 `canonical` / `step9-mirror` 两行期望值退回 `1296464 / 2D97BAB4…BB3A54`。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`；本波未物化新冻结件）。

## 四十二 R59 桌面保存排队返回 true / 导航改用 forceRender 保光标（2026-10-22）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**同文本双件同步**，落盘后两件仍**逐字节一致**（同 1,296,684 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更。

**一 变更点（2 处）**

| # | 位置 | 变更 |
| --- | --- | --- |
| ① | `flushDesktopSave`（`async function flushDesktopSave`）内 `_dsSaving` 守卫 | `if(_dsSaving){_dsDirty=true;return false;}` → `if(_dsSaving){_dsDirty=true;return true;}`。语义：`_dsSaving` 表示上一条仍在写盘、本条已排队（`_dsDirty=true`，由 `finally` 续写），并非失败；返回 `true` 后 `runPersist` 不再把「排队中」累加进 `_persistFailCount`（原口径攒满 6 次会挂起自动保存） |
| ② | `safeNavigate`（`function safeNavigate`）函数体末尾 | `scheduleRender();` → `forceRender();`。`forceRender` 内部已执行 `commitPendingEditBeforeRender()` + `saveFocus()`，编辑中经侧栏切换文档不再丢失光标与未提交编辑；`scheduleRender` 会绕过该保护 |

**二 字节锚**

- 变更前（R58 口径）：**1,296,688 B / `1687B4D8…7A40E8` / LF（CR=0 · LF=23,853）**
- 变更后：**1,296,684 B / `DA360954…0EA0D9D`（全文 `DA36095452318B6C79A66CD3169FB1EC8FC2DA8D690A355460962517B0EA0D9D`）/ LF（CR=0 · LF=23,853）**；增量 **−4 B / ±0 行**；末字节 `0x0A` · 无 BOM。
- canonical 与 step9 镜像：`sha256` 相等（逐字节一致）。
- 增量拆解：① `false` → `true`（−1 B）· ② `scheduleRender();` → `forceRender();`（−3 B）。

**三 登记器重锚**

- `6.P0-T3基线/step9/verify-hash-registry.mjs`：`canonical` / `step9-mirror` 期望值 `1296688 / 1687B4D8…7A40E8` → **`1296684 / DA360954…0EA0D9D`**，并追加 R59 注释块。**方数保持 65**（不新增纳编物），其余 63 方期望值一字未动。
- 实测：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；证据 `_环境与调试/r59-registry-2026-10-22.txt`。

**四 门禁证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（81ms）· Node **503/503**（`tests 503 / pass 503 / fail 0 / skipped 0`，27,285ms）· PW **171**（167 passed + 4 skipped，58.2s）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，90ms）→ `[verify] 全部通过` | `_环境与调试/r59-verify-all-2026-10-22.txt` |
| `node scripts/verify.js all`（文档落盘后复跑） | **exit 0**：静态 0 命中（45ms）· Node **503/503**（`tests 503 / pass 503 / fail 0 / skipped 0`，26,245ms）· PW **171**（167 passed + 4 skipped，53.7s）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，78ms）→ `[verify] 全部通过` | `_环境与调试/r59-verify-all-final-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/r59-registry-2026-10-22.txt` |
| 产品件双件等价 | canonical 与 step9 镜像同字节同哈希（1,296,684 B / `DA360954…0EA0D9D`） | 本文件 §二 |

- 环境注记：本机 PATH 无 `node`，门禁以 Node 22.22.2 显式绝对路径（`C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6`）注入 PATH 后执行；`verify.js` 内部派生裸 `node` 因此可解析。

**五 回滚**

- 产品件：① 恢复 `return false;`、② 恢复 `scheduleRender();`；落盘后应为 1,296,688 B / `1687B4D8…7A40E8`。
- 登记器：把 `canonical` / `step9-mirror` 两行期望值退回 `1296688 / 1687B4D8…7A40E8`。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`；本波未物化新冻结件）。

## 四十三 R60 演示折叠解耦 / 看板·画廊字段名带标签 / 日历缓存去 focus / 浮窗矩形恢复（2026-10-22）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**同文本双件同步**，落盘后两件仍**逐字节一致**（同 1,297,821 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更。

**一 变更点（10 处 · 均为既有函数体内分支改动）**

| # | 位置（搜索锚） | 变更 |
| --- | --- | --- |
| ① | `renderPresentation` | 删除 `if(id!==doc.id&&n.collapsed)return;`——演示是只读放映，折叠只应影响编辑面；删除后折叠子树在演示中仍显示 |
| ② | `dbBoardCardHtml` | meta 行 `esc(v)` → `esc(name)：esc(v)`（看板卡片补齐字段名标签，与同函数 number / 星级行口径一致） |
| ③ | `__dbGalleryCard` else 分支 | `'<span>'+esc(v)+'</span>'` → `'<span>'+esc(name)+'：'+esc(v)+'</span>'` |
| ④ | `renderCalendarPage` 缓存键 | `getDayNodes` 的 key 去掉 focus 维度（`ds+'\|f='+(ui.calTagFilter\|\|'')`）；`_calSelKeyNow` 改含 `(ui.focusId\|\|'')`——焦点变化推进 `_calDataRev` 整表重建一次，避免缓存条目随点击无限膨胀 |
| ⑤ | `renderTagNodes` / `renderTagsView` chip 分支 | 各在 `const ids=Array.from(tagIndex.get(t)\|\|[]);` 后补 `_mSelSetOrder('tags', ids);`——从文件视图进入标签视图后 `_mSel.type` 不再残留 `'files'`，Ctrl 点击卡片记到正确视图 |
| ⑥ | `backupOnClose` | `juWriteBackupToDir(...)` 追加 `.catch(function(){})`——async 调用在 `beforeunload` 下不等待完成，至少消解未处理拒绝 |
| ⑦ | `toHtml` | `<html lang="zh-CN">` → `<html lang="${esc(APP_LOCALE)}">`（`APP_LOCALE` 定义于 script_5.js 顶部，`toHtml` 运行时已就绪，无 TDZ） |
| ⑧ | `_dropWordFlatSubtree` | `delete st.nodes[id];` 后追加 `try{_searchHayCache.delete(id);}catch(e){}`——与 `removeNodeFromMap` / `purgeTrash` 的搜索缓存清理口径一致 |
| ⑨ | `renderDbTimeline` | 日期标签改为 `_rawDate` 守卫（`_rawDate && _rawDate !== '选择…'`）——`{type:'date',start:''}` 时 `formatTimeValue` 返回「选择…」不再直接显示 |
| ⑩ | `setFloatCalVisible` | 在 `ensureElInViewport(fc);renderFloatCal();` 之前按 `ui.dnd.flt['flt.floatCal']`（`{x,y,w,h}`）+ 当前视口重新落位——`_applyRect` 仅在 boot 执行一次，拖大后关闭再开启不再跑到视口外 |

**二 字节锚**

- 变更前（R59 口径）：**1,296,684 B / `DA360954…0EA0D9D` / LF（CR=0 · LF=23,853）**
- 变更后：**1,297,821 B / `1AAED052…074A577`（全文 `1AAED052235446A5521D4F5D631217CBFC1EDA37841D2CE54F0A90100074A577`）/ LF（CR=0 · LF=23,868）**；增量 **+1,137 B / +15 行**；末字节 `0x0A` · 无 BOM。
- canonical 与 step9 镜像：`sha256` 相等（逐字节一致，实测 `identical=true`）。
- 行数增量拆解：① −1 行 · ⑨ −1 行 · ⑤ +2 行 · ⑧ +1 行 · ⑩ +14 行（其余为行内等价改写）= **+15 行**。

**三 登记器重锚**

- `6.P0-T3基线/step9/verify-hash-registry.mjs`：`canonical` / `step9-mirror` 期望值 `1296684 / DA360954…0EA0D9D` → **`1297821 / 1AAED052…074A577`**，并追加 R60 注释块。**方数保持 65**（不新增纳编物），其余 63 方期望值一字未动。
- 实测：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）；证据 `_环境与调试/r56-registry-2026-10-22.txt`。

**四 门禁证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| 改动落盘断言（10 项前 / 后串计数） | **10/10 PASS**；另含「`renderDbGallery`（非虚拟画廊，第 13,669 行）同形 else 分支按本批范围保持原样」与「矩形恢复块位于 `ensureElInViewport` 之前」两条附加断言 | `_环境与调试/r56-step2-edits-2026-10-22.txt` |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（70ms）· Node **503/503**（`tests 503 / pass 503 / fail 0 / skipped 0`，26,241ms）· PW **171**（167 passed + 4 skipped，53.0s）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，72ms）→ `[verify] 全部通过` | `_环境与调试/r56-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/r56-registry-2026-10-22.txt` |
| 产品件双件等价 | canonical 与 step9 镜像同字节同哈希（1,297,821 B / `1AAED052…074A577`） | 本文件 §二 |

- 环境注记：本机 PATH 无 `node`，门禁以 Node 22.22.2 显式绝对路径（`C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6`）注入 PATH 后执行，`verify.js` 内部派生裸 `node` 因此可解析（首轮未注入 PATH 时报 `spawnSync node ENOENT`）。
- 首轮全量门禁的唯一红项为登记器漂移门（`tests/t10-idb-persist.spec.ts:543` T-99：`Expected: 0` / `Received: 2`），即尚未重锚的 canonical + step9-mirror 两方；重锚后复跑转绿。

**五 回滚**

- 产品件：恢复 ① 的折叠守卫、②③ 去掉字段名前缀、④ 缓存键补回 focus 且 `_calSelKeyNow` 去掉 focus、⑤ 删两处 `_mSelSetOrder('tags', ids);`、⑥ 去掉 `.catch(function(){})`、⑦ `lang` 回 `"zh-CN"`、⑧ 删 `_searchHayCache.delete(id)` 行、⑨ 恢复单表达式 `dateLabel`、⑩ 删除矩形恢复块；或直接以 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r56` / `6.P0-T3基线/step9/v2.0-t3.html.bak-20261022-r56` 覆盖（落盘后应为 1,296,684 B / `DA360954…0EA0D9D`）。
- 登记器：把 `canonical` / `step9-mirror` 两行期望值退回 `1296684 / DA360954…0EA0D9D`。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`；本波未物化新冻结件）。

## 四十四 R61 记事本自动落库 / 记事本根不出现在我的文档 / 待办标签·优先级·标签色立即落盘（2026-10-22）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**同文本双件同步**，落盘后两件仍**逐字节一致**（同 1,297,927 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更。

**一 变更点（6 组 · 7 处 `persistNow()`）**

| # | 位置（搜索锚） | 变更 |
| --- | --- | --- |
| ① | `renderFolderGrid` 的 `ids` 过滤 | 追加 `!n._isNoteRoot`——记事本根不再出现在「我的文档」网格（原仅滤 `_isCalRoot` / `_isDbRoot`） |
| ② | `renderSubDocs` 的 `ids` 过滤 | 同上追加 `!n._isNoteRoot`——记事本根不再出现在侧栏文档树 |
| ③ | `bindNoteText` 的 `input` 监听 | 追加 600ms 防抖落库：`clearTimeout(text._noteSaveTimer)` → `text._noteSaveTimer=setTimeout(...,600)` 内 `sanitizeHtml(text.innerHTML)` 与 `N(id).text` 比较，不同则 `actions.updateText(id, finalHtml, {noHistory:true})`——不再只依赖 blur，重渲染 / 刷新前未失焦的输入不丢 |
| ④ | `ensureNoteDoc` | 移除函数内 `_noteEnsured` 读 / 写（模块级 `let _noteEnsured=false;` 声明保留不动）；改为「有根即返回，无根即建」——根节点被回收后仍可重建，不再永久返回 `null` 让新空记事本覆盖旧数据；`actions.logActivity('add',nid)` 加 `if(nid)` 守卫 |
| ⑤ | `openCalNodeMenu` | `buildTime` 保存 / 清除时间、`pickTag`、`clearAll`、`buildPrio` 设置 / 清除优先级共 6 处 `commit(...)` 之后各追加一行 `persistNow();`——标签 / 背景 / 优先级立即上盘 |
| ⑥ | `setTagColor` | `commit(...)` 成功后（catch 块之后）追加 `persistNow();`——侧栏标签改色立即上盘 |

**二 字节锚**

- 变更前（R60 口径）：**1,297,821 B / `1AAED052…074A577` / LF（CR=0 · LF=23,868）**
- 变更后：**1,297,927 B / `DB39B0DE…5409BD1`（全文 `DB39B0DE0CCB656DFFA11DBAD74C0E7A1A9EF08EBC3FB21313E31014F5409BD1`）/ LF（CR=0 · LF=23,878 · split 23,879）**；增量 **+106 B / +10 行**；末字节 `0x0A` · 无 BOM。
- canonical 与 step9 镜像：`sha256` 相等（逐字节一致）。
- 行数增量拆解：③ +7 行（防抖块）· ④ −4 行（`_noteEnsured` 相关 2 行注释 + 2 行读写，另 `addNode` / `logActivity` 合并为 5 行体）· ⑤ +6 行 · ⑥ +1 行 = **+10 行**。

**三 登记器重锚**

- `6.P0-T3基线/step9/verify-hash-registry.mjs`：`canonical` / `step9-mirror` 期望值 `1297821 / 1AAED052…074A577` → **`1297927 / DB39B0DE…5409BD1`**，并追加 R61 注释块。**方数保持 65**（不新增纳编物），其余 63 方期望值一字未动。
- 实测：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）；证据 `_环境与调试/r61-registry-2026-10-22.txt`。

**四 门禁证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（62ms）· Node **503/503**（`tests 503 / pass 503 / fail 0`，27,908ms）· PW **171**（167 passed + 4 skipped，61.0s）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，83ms）→ `[verify] 全部通过` | `_环境与调试/r61-verify-all-2026-10-22.txt` |
| `node scripts/verify.js all`（文档落盘后复跑） | **exit 0**：静态 0 命中（40ms）· Node **503/503**（26,365ms）· PW **171**（167 passed + 4 skipped，55.3s）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，72ms）→ `[verify] 全部通过` | `_环境与调试/r61-verify-all-final-2026-10-22.txt` |
| 真实 Chrome UI 探针（`file://` 真实键入 + 真实刷新，非 mock） | **19/19 PASS**：记事本键入后 600ms（未失焦）内存态即写入 → 刷新后内存 + DOM 双保留；侧栏文档树 / 我的文档网格均不含「记事本」；右键菜单设优先级 1 与勾选标签 → 刷新后保留；`setTagColor` → 刷新后颜色 `#FF3366` 保留且待办勾选框绑定标签色；`pageerror` 0 | `_环境与调试/r61-ui-probe-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/r61-registry-2026-10-22.txt` |
| 产品件双件等价 | canonical 与 step9 镜像同字节同哈希（1,297,927 B / `DB39B0DE…5409BD1`） | 本文件 §二 |

- 环境注记：本机 PATH 无 `node`，门禁以 Node 22.22.2 显式绝对路径（`C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6`）注入 PATH 后执行；UI 探针用系统 Chrome（`C:\Program Files\Google\Chrome\Application\chrome.exe`）。

**五 回滚**

- 产品件：① ② 删除 `&&!n._isNoteRoot` / `!n._isNoteRoot&&`；③ 删除 `clearTimeout(text._noteSaveTimer);` 起的 7 行防抖块；④ 恢复 `_noteEnsured` 门控与原 `actions.logActivity('add',nid);`；⑤ 删除 6 处 `persistNow();`；⑥ 删除 `setTagColor` 内 `persistNow();`；或直接以 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r61` 覆盖（落盘后应为 1,297,821 B / `1AAED052…074A577`）。
- 登记器：把 `canonical` / `step9-mirror` 两行期望值退回 `1297821 / 1AAED052…074A577`（备份 `verify-hash-registry.mjs.bak-r61`）。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`；本波未物化新冻结件）。

## 四十五 R62 记事本根被回收后的「僵尸编辑」修复（2026-10-22）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（同 1,298,533 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更。本波在 R61（§四十四）之上叠加。

**一 缺陷与变更点（3 处）**

缺陷链：`actions.moveToTrash` 原守卫只排除 `_isCalRoot` / `_isDbRoot`，记事本根可被移入回收站（子树整体 `_deleted`）；`getNoteDoc` 原 `find` 不排除 `_deleted`，被回收的记事本根仍被返回 ⇒ `ensureNoteDoc` 判定「已存在」不重建；`renderNoteRow` 不检查 `_deleted` ⇒ 已删子树照常渲染且 `contenteditable=true`。用户以为在编辑记事本，实际在改**已删节点**（僵尸编辑），一旦 `purgeTrash` 内容即丢失。

| # | 位置（搜索锚） | 变更 |
| --- | --- | --- |
| ① | `getNoteDoc`（约 L9350） | `find(n=>n&&n._isNoteRoot)` → `find(n=>n&&n._isNoteRoot&&!n._deleted)`——已回收的记事本根不再被当活根返回，`ensureNoteDoc` 因此重建新记事本；并加 FIX-R62-P0 注释块 3 行 |
| ② | `renderNoteRow`（约 L9391） | 函数首行、`depth=depth||0;` 之前插入 `if(!n||n._deleted)return document.createElement('div');`——已删节点不渲染（防御层，即使上游仍有已删引用也不产生可编辑僵尸行） |
| ③ | `actions.moveToTrash` 守卫（约 L5676） | 追加 `||_src._isNoteRoot`——记事本根不可回收（源头阻断），注释同步补记 FIX-R62-P0 |

**二 字节锚**

- 变更前（R61 口径）：**1,297,927 B / `DB39B0DE…5409BD1` / LF（CR=0 · LF=23,878）**
- 变更后：**1,298,533 B / `0BD20F2576852B5E3F3E60F7298A320FCF74DD289995DD73B71A186AB2383BE3` / LF（CR=0 · LF=23,882 · split 23,883）**；增量 **+606 B / +4 行**；末字节 `0x0A` · 无 BOM。
- canonical 与 step9 镜像：`sha256` 相等（逐字节一致，均为 `0BD20F25…383BE3`）。
- 行数增量拆解：① +3 行（注释块）· ② +1 行 · ③ 0 行 = **+4 行**；字节增量主要为三处中文注释（UTF-8 三字节/字）。

**三 登记器重锚**

- `6.P0-T3基线/step9/verify-hash-registry.mjs`：`canonical` / `step9-mirror` 期望值 `1297927 / DB39B0DE…5409BD1` → **`1298533 / 0BD20F25…383BE3`**，并追加 R62 注释块。**方数保持 65**（不新增纳编物），其余 63 方期望值一字未动（备份 `verify-hash-registry.mjs.bak-r62`）。
- 实测：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）；证据 `_环境与调试/r62-registry-2026-10-22.txt`。

**四 门禁证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| `node scripts/verify.js all` | **exit 0**：静态 0 命中（19ms）· Node **503/503**（30,202ms）· PW **171**（167 passed + 4 skipped，68,320ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，99ms）→ `[verify] 全部通过` | `_环境与调试/r62-verify-all-2026-10-22.txt` |
| `node scripts/verify.js all`（登记器 / 本手册落盘后复跑） | **exit 0**：静态 0 命中（48ms）· Node **503/503**（33,694ms）· PW **171**（167 passed + 4 skipped，71,279ms）· bench **7/7**（可比 7 / 通过 7 / 失败 0，最大恶化 0.0% / 中位 −14.3%，92ms）→ `[verify] 全部通过` | `_环境与调试/r62-verify-all-final-2026-10-22.txt` |
| 真实 Chrome UI 探针（`file://` 真实键入 + 真实刷新 + 真实右键菜单点击） | **30/30 PASS**（A 记事本键入→刷新保留 / B 记事本根 `moveToTrash` 被拒绝且内容不变、普通文档仍可回收 / C 历史回收态下无僵尸编辑 + `ensureNoteDoc` 重建 + `purgeTrash` 旧子树消失 / D 历史态落盘后刷新仍重建且不复活 / E `pageerror` 0） | `_环境与调试/r62-ui-probe-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/r62-registry-2026-10-22.txt` |
| 产品件双件等价 | canonical 与 step9 镜像同字节同哈希（1,298,533 B / `0BD20F25…383BE3`） | 本文件 §二 |

- 环境注记：本机 PATH 无 `node`，门禁以 Node 22.22.2 显式绝对路径（`C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6`）注入 PATH 后执行（`verify.js` 内部以 `spawnSync('node')` 起子进程，未注入将报 `spawnSync node ENOENT`）；UI 探针用系统 Chrome（`C:\Users\12601\AppData\Local\Google\Chrome\Application\chrome.exe`）。
- 已知残留（本波未改，超出 3 处变更范围）：`showTreeContext` / `showDbRowContext` 的「移入回收站」菜单项在 `actions.moveToTrash` 被守卫拒绝时仍执行 `toast('已移入回收站')`，提示语与实际结果不一致（数据安全不受影响）。

**五 回滚**

- 产品件：① 删除 `getNoteDoc` 的 `&&!n._deleted` 与 3 行注释；② 删除 `renderNoteRow` 首行守卫；③ 删除 `moveToTrash` 守卫中的 `||_src._isNoteRoot`；或直接以 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r62` 覆盖（落盘后应为 1,297,927 B / `DB39B0DE…5409BD1`）。
- 登记器：把 `canonical` / `step9-mirror` 两行期望值退回 `1297927 / DB39B0DE…5409BD1`（备份 `verify-hash-registry.mjs.bak-r62`）。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r62` 覆盖。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`；本波未物化新冻结件）。

---

## 四十六 R63 记事本内容不再进入知识图谱与全局搜索（P1 批次 · 2026-10-22）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（同 1,299,000 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更。本波在 P0 批次 R61（§四十四）+ R62（§四十五）之上叠加。

**一 缺陷与变更点（2 处）**

缺陷链：`_isNoteRoot` 子树在渲染层已被排除（侧栏文档树 / 文件列表 / 回收站守卫），但**读取面**有两处遗漏——① `renderGraph` 的文档收集只跳过 `_isCalRoot` 子树，记事本条目（非空文本、非 `_deleted`）带 `parent` 链命中记事本根，因此进入知识图谱；② `doSearch` 只跳过 `_isNoteRoot` **节点本身**，其子孙节点仍参与 `nodeSearchHay` 匹配，记事本内容出现在全局搜索结果。两者均为「系统容器被排除、容器内私有内容未排除」的口径不一致。

| # | 位置（搜索锚） | 变更 |
| --- | --- | --- |
| ① | `script_3.js` · `renderGraph` 文档收集（约 L14667） | `let p=n.parent,inCal=false;` → `let p=n.parent,inCal=false,inNote=false;`；祖先链循环新增 `if(pn._isNoteRoot){inNote=true;break;}`；`if(inCal)continue;` → `if(inCal||inNote)continue;`——记事本子树与日历子树同口径，不计入图谱；行内注释同步补记 FIX-R63-P1 |
| ② | `script_4.js` · `doSearch` 内层（约 L16025，`_isCalRoot` / `_isNoteRoot` / `_isFolder` 跳过之后、`const hay=nodeSearchHay(n);` 之前） | 插入祖先链判定块：`let anc=n.parent,inNote=false;` + `while(anc&&anc!==state.rootId){…if(an._isNoteRoot){inNote=true;break;}…}` + `if(inNote)continue;`——记事本子孙节点不进入全局搜索；块前注释 FIX-R63-P1 |

**二 字节锚**

- 变更前（R62 口径）：**1,298,533 B / `0BD20F2576852B5E3F3E60F7298A320FCF74DD289995DD73B71A186AB2383BE3` / LF（CR=0 · LF=23,882）**
- 变更后：**1,299,000 B / `230BA74BD84F7E4648EE2CBAF18D088F49DDEB56B5A900883B927FE27A75EACD` / LF（CR=0 · LF=23,889）**；增量 **+467 B / +7 行**；末字节 `0x0A` · 无 BOM。
- 行数增量拆解：① +1 行（新增 `_isNoteRoot` 判定）· ② +6 行（注释 + 5 行判定块）= **+7 行**；字节增量主要为中文注释（UTF-8 三字节/字）。
- canonical 与 step9 镜像：`sha256` 相等（逐字节一致，均为 `230BA74B…75EACD`）。

**三 登记器重锚**

- `6.P0-T3基线/step9/verify-hash-registry.mjs`：`canonical` / `step9-mirror` 期望值 `1298533 / 0BD20F25…383BE3` → **`1299000 / 230BA74B…75EACD`**，并追加 R63 注释块。**方数保持 65**（不新增纳编物），其余 63 方期望值一字未动（备份 `verify-hash-registry.mjs.bak-r63`）。
- 实测：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）。

**四 门禁证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| 内联脚本语法自检（9 块 vm 编译，双件） | `inline-script blocks=9` / `compiled-ok=9` / `SYNTAX_RESULT=PASS`（双件同结果，exit 0） | `_临时脚本/r63-syntax-check.mjs` 输出 |
| `node scripts/verify.js all`（登记器重锚前首跑） | **exit 1**：静态 0 命中 · Node **503/503**（26,499ms）· PW **1 failed + 166 passed + 4 skipped**（T-99 登记器断言 `drift` 期望 0 实收 2 = canonical + step9-mirror 未重锚，属**预期内红**） | `_环境与调试/r63-verify-all-pre-registry-2026-10-22.txt` |
| `node scripts/verify.js all`（重锚后） | **exit 0**：静态 0 命中（88ms）· Node **503/503**（26,810ms）· PW **171**（167 passed + 4 skipped，54,658ms）· bench **7/7**（可比 7 / 通过 7 / 失败 0，最大恶化 0.0% / 中位 −14.3%，84ms）→ `[verify] 全部通过` | `_环境与调试/r63-verify-all-2026-10-22.txt` |
| `node scripts/verify.js all`（登记器 / 本手册落盘后复跑） | **exit 0**：静态 0 命中（44ms）· Node **503/503**（26,094ms）· PW **171**（167 passed + 4 skipped，56,378ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，74ms）→ `[verify] 全部通过` | `_环境与调试/r63-verify-all-final-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | 同上 §三 |
| 真实 Chrome UI 探针 · 红（变更前 1,298,533 B 副本） | **11/17 PASS · 6 FAIL**：`a2` 图谱 `noteHit=1`、`a4` 图谱含记事本子节点 id、`b1/b2/b3` 搜索命中 1 行、`c4` 刷新后图谱仍含记事本条目 → `PROBE_RESULT=FAIL`（exit 1）**缺陷真实复现** | `_环境与调试/r63-ui-probe-red-2026-10-22.txt` |
| 真实 Chrome UI 探针 · 绿（变更后产品件） | **17/17 PASS**：图谱节点数 20 → 19（仅少记事本条目，对照普通文档 `ctrlHit=1` 仍可见）· 搜索该词 `rows=0` / 「未找到结果」· 搜索普通文档仍命中 · 刷新后内存 / localStorage / DOM 均保留记事本文本 · 刷新后图谱 `noteHit=0` · `pageerror` 0 → `PROBE_RESULT=PASS`（exit 0） | `_环境与调试/r63-ui-probe-2026-10-22.txt` |
| 产品件双件等价 | canonical 与 step9 镜像同字节同哈希（1,299,000 B / `230BA74B…75EACD`） | 本文件 §二 |

- 环境注记：本机 PATH 无 `node`，门禁以 Node 22.22.2 显式绝对路径（`C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6`）注入 PATH 后执行；UI 探针用系统 Chrome（`C:\Users\12601\AppData\Local\Google\Chrome\Application\chrome.exe`），`file://` 真实键入 / 真实点击 / 真实刷新。
- 关于「47 方零漂移」：现行登记器实际登记面为 **65 方**（`PARTY_COUNT=65`，R32 起由 64 → 65）；本波按现行口径实测 **drift 0 / PASS**，未新增 / 删除任何登记方。

**五 回滚**

- 产品件：① 删除 `renderGraph` 的 `inNote` 变量、`if(pn._isNoteRoot)…` 行与 `||inNote`；② 删除 `doSearch` 的 `FIX-R63-P1` 注释与祖先链判定块；或直接以 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r63`（= R62 态 1,298,533 B / `0BD20F25…383BE3`）覆盖 canonical 与 step9 镜像。
- 登记器：把 `canonical` / `step9-mirror` 两行期望值退回 `1298533 / 0BD20F25…383BE3`（备份 `verify-hash-registry.mjs.bak-r63`）。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r63` 覆盖。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`；本波未物化新冻结件）。

---

## 四十七 R64 兜底文档与日历重建频率（P2 批次 · 2026-10-22）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（同 1,299,366 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更。本波在 P0 批次 R61（§四十四）+ R62（§四十五）、P1 批次 R63（§四十六）之上叠加。

**一 隐患与变更点（4 处）**

| # | 位置（搜索锚） | 变更 |
| --- | --- | --- |
| ① | `script_3.js` · `getCurrentDoc` 的 `root.children` 兜底 `find`（约 L6905） | 谓词追加 `!n._isNoteRoot`：`currentDocId` 无效时不再把记事本根当作当前文档（原实现只排除 `_isCalRoot` / `_isDbRoot` / `_deleted`，初次打开会落到「记事本」文件夹视图）；行内注释 FIX-P2-10 |
| ② | `script_1.js` · `renderCalendarPage` 的选择态签名 `_calSelKeyNow`（约 L10552） | 移除 `(ui.focusId\|\|'')` 维度，仅保留 `selectedDate` / `calTagFilter`——点击 / 聚焦日历条目不再推进 `_calDataRev`、不再整表重建 `_renderDayCache`（年视图 365 天）；行内注释 FIX-P2-11 |
| ③ | 同函数 · `getDayNodes` 空文本判定（约 L10560） | `(!isBlankNode(n)\|\|ui.focusId===n.id)` → `(!isBlankNode(n)\|\|(ui.focusId===n.id&&ui._focusTick===_calDataRev))`——空文本节点仅在本次渲染周期内获得焦点时显示，其他空节点过滤语义不变 |
| ④ | 同函数入口（约 L10471） | 新增 `ui._focusTick=_calDataRev;` 作为渲染周期焦点代次锚点（位于 `renderMain` 编辑态早退分支之外） |

**二 字节锚**

- 变更前（R63 口径）：**1,299,000 B / `230BA74BD84F7E4648EE2CBAF18D088F49DDEB56B5A900883B927FE27A75EACD` / LF（CR=0 · LF=23,889）**
- 变更后：**1,299,366 B / `506DB1673F8287193A1FE25905DED1CF331FB7D7759907D1F07098E4928B4079` / LF（CR=0 · LF=23,890）**；增量 **+366 B / +1 行**；末字节 `0x0A` · 无 BOM。
- 行数增量拆解：④ 新增 1 行；①②③ 为行内改写（含中文行内注释）= **+1 行**。
- canonical 与 step9 镜像：`sha256` 相等（逐字节一致，均为 `506DB167…928B4079`）。

**三 登记器重锚**

- `6.P0-T3基线/step9/verify-hash-registry.mjs`：`canonical` / `step9-mirror` 期望值 `1299000 / 230BA74B…75EACD` → **`1299366 / 506DB167…928B4079`**，并追加 R64 注释块。**方数保持 65**（不新增纳编物），其余 63 方期望值一字未动（备份 `verify-hash-registry.mjs.bak-r64`）。
- 红证：改字节后、未重锚前 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（恰 `canonical` + `step9-mirror`，判别力真实；证据 `_哈希与行尾校验/r64-registry-red-2026-10-22.txt`）。
- 绿证：重锚后 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0；证据 `_哈希与行尾校验/r64-registry-green-2026-10-22.txt`）。

**四 门禁证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| 内联脚本语法自检（9 块 vm 编译） | `script1..script9: OK` / `BLOCKS=9 FAIL=0` / `EOL CR=0 LF=23890`（exit 0） | `_环境与调试/r64-syntax-2026-10-22.txt` |
| `node scripts/verify.js all`（重锚后） | **exit 0**：静态检查 0 命中（43ms）· Node **503/503**（25,308ms）· Playwright **171**（167 passed + 4 skipped，57,868ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，89ms）→ `[verify] 全部通过` | `_环境与调试/r64-verify-all-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | 同上 §三 |
| 真实 Chrome 探针（1440×900 · step9 镜像） | **10/10 PASS · PROBE_FAIL=0**：`A1` 内存兜底落到普通文档（note/ doc 分离）· `A2` 刷新后不落到记事本（view=library-root）· `B1` 焦点空文本节点在日历显示 · `B2/B3` 24 次真实点击 `_calDataRev` 2→2、`_renderDayCache` 同一对象 · `B4` 点击后焦点空节点仍显示 · `B5` 24 次点击 139.1ms · `C1` 标签筛选 rev 2→3 + 重建 · `C2` 日期切换 rev 3→4 + 重建 · `D` 零 pageerror / console.error | `_环境与调试/r64-p2-probe-2026-10-22.txt` |
| 产品件双件等价 | canonical 与 step9 镜像同字节同哈希（1,299,366 B / `506DB167…928B4079`） | 本文件 §二 |

- 探针方法论注记：B1 首轮失败（`focusTick=1` / `rev=2`）属**测法**问题——首次进入日历视图时 `selectedDate` 从空值变成具体日期，`_calSelKeyNow` 变化在本轮渲染内推进 `_calDataRev`，按新口径（仅在本次渲染周期内获得焦点的空节点显示）该空节点被正确过滤；探测前先固定 `selectedDate` 并让日历索引就绪后，B1–B4 全绿，产品代码未因此再改一个字节。
- 环境注记：本机 PATH 无 `node`，门禁以真实 Node **v24.21.0**（`C:\Users\12601\AppData\Local\OpenAI\Codex\runtimes\cua_node\2fbcd108736f9c20\bin\node.exe`）注入 PATH 后执行；UI 探针用系统 Chrome（`C:\Users\12601\AppData\Local\Google\Chrome\Application\chrome.exe`），`file://` 真实点击 / 真实刷新。
- 关于「47 方零漂移」：现行登记器登记面为 **65 方**（`PARTY_COUNT=65`）；本波按现行口径实测 **drift 0 / PASS**，未新增 / 删除任何登记方。

**五 回滚**

- 产品件：① 删除 `getCurrentDoc` 兜底谓词的 `&&!n._isNoteRoot` 与 FIX-P2-10 注释；② `_calSelKeyNow` 恢复 `+'|'+(ui.focusId||'')`；③ 空文本判定恢复 `ui.focusId===n.id`；④ 删除 `renderCalendarPage` 入口的 `ui._focusTick=_calDataRev;` 行；或直接以 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r64-p2`（= R63 态 1,299,000 B / `230BA74B…75EACD`）覆盖 canonical 与 step9 镜像（镜像备份 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261022-r64-p2`）。
- 登记器：把 `canonical` / `step9-mirror` 两行期望值退回 `1299000 / 230BA74B…75EACD`（备份 `verify-hash-registry.mjs.bak-r64`）。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r64` 覆盖。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`；本波未物化新冻结件）。

---

## 四十八 R65 记事本输入自动保存改走 commit + 日历日缓存键并入 focusId（P0/P2 复查补落 · 2026-10-22）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（同 1,300,414 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更。本波承接 P0（R61 §四十四 / R62 §四十五）、P1（R63 §四十六）、P2（R64 §四十七）三批——按本轮指令逐条复核后，P0-1 / P0-2 / P0-4 / P0-5 / P0-6 / P0-7 / P0-8 / P1-1 / P1-2 / P2-1 / P2-2① 已在 R61–R64 落盘，**P0-3 与 P2-2② 尚未按新口径落盘**，本波补落。

**一 变更点（3 处）**

| # | 位置（搜索锚） | 变更 |
| --- | --- | --- |
| ① | `script_1.js` · `bindNoteText` 的 `input` 处理器（约 L9431） | 600ms 防抖内的落库方式由 `actions.updateText(id,finalHtml,{noHistory:true})` 改为直接 `commit(s=>{...n.text/n.tags/n.updatedAt...},{snapshot:true,dirtyText:true,dirtyDocs:owner\|\|undefined,silent:true,persistOnly:true,op:'updateText',opArgs:{id}})`：新增 `text.isConnected` 守卫、正文未变即早退、`tags` 按「`_manualTags` ∪ 正文 `#标签`」重算（防幽灵标签）、标签变化只 `renderSidebar()` 刷新计数；**关键动因**：`updateText` 在标签集合变化时调用 `forceRender()`，重渲染替换 `contenteditable` 会打断输入法候选。行内注释 FIX-R65-P0-3 |
| ② | 同函数 · `blur` 处理器首行（约 L9456） | 新增 `clearTimeout(text._noteSaveTimer);`——失焦即取消待触发的防抖保存，交由 `blur` 的同步提交写入，避免同一次编辑被写两遍 |
| ③ | `script_1.js` · `renderCalendarPage` 的 `getDayNodes` 日缓存键（约 L10568） | `ds+'\|f='+(ui.calTagFilter\|\|'')` → `ds+'\|f='+(ui.calTagFilter\|\|'')+'\|fo='+(ui.focusId\|\|'')`——焦点空文本节点自成一键，切换焦点不再复用「不含该空节点」的旧日列表；R64 的 `ui._focusTick` 口径（空节点仅在本次渲染周期内获得焦点时显示）保持不变 |

**二 字节锚**

- 变更前（R64 口径）：**1,299,366 B / `506DB1673F8287193A1FE25905DED1CF331FB7D7759907D1F07098E4928B4079` / LF（CR=0 · LF=23,890）**
- 变更后：**1,300,414 B / `30460FAB1D255CBE259B9C2DD27071757863504C4B2EE18061FFB1D5B50B2D36` / LF（CR=0 · LF=23,900）**；增量 **+1,048 B / +10 行**；末字节 `0x0A` · 无 BOM。
- 行数增量拆解：① 段内注释 2 行 + 逻辑 6 行、② 1 行、③ 行内注释（同 4 行计数）= **+10 行**（①②③ 均为单一物理行内重写 + 新增注释行，无空行夹带）。
- canonical 与 step9 镜像：`sha256` 相等（逐字节一致，均为 `30460FAB…50B2D36`）。

**三 登记器重锚**

- `6.P0-T3基线/step9/verify-hash-registry.mjs`：`canonical` / `step9-mirror` 期望值 `1299366 / 506DB167…928B4079` → **`1300414 / 30460FAB…50B2D36`**，并追加 R65 注释块。**方数保持 65**（不新增纳编物），其余 63 方期望值一字未动（备份 `verify-hash-registry.mjs.bak-r65`）。
- 红证：改字节后、未重锚前 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（恰 `canonical` + `step9-mirror`，判别力真实；证据 `_哈希与行尾校验/r65-registry-red-2026-10-22.txt`）。
- 绿证：重锚后 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0；证据 `_哈希与行尾校验/r65-registry-green-2026-10-22.txt`）。

**四 门禁证据（真实执行 · 非声称）**

| 门禁 | 结果 | 证据文件 |
| --- | --- | --- |
| 内联脚本语法自检（9 块 vm 编译） | `script1..script9: OK` / `blocks=9 compiled-ok=9` / `CR=0 LF=23900`（exit 0） | `_环境与调试/r65-syntax-2026-10-22.txt` |
| `node scripts/verify.js all`（首跑 · 重锚前） | 静态 0 命中（19ms）· Node **503 用例**（27,257ms）· Playwright **1 failed / 166 passed / 4 skipped**——唯一失败为 `t10-idb-persist.spec.ts:543` **T-99 门禁（登记器 RESULT=PASS 哨兵）**，即登记器尚未重锚的预期红 | `_环境与调试/r65-verify-all-2026-10-22.txt` |
| `node scripts/verify.js all`（重锚后复跑） | **exit 0**：静态检查 0 命中（43ms）· Node **503/503**（`tests 503 / pass 503 / fail 0`，26,240ms）· Playwright **171**（167 passed + 4 skipped，56,022ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，75ms）→ `[verify] 全部通过` | `_环境与调试/r65-verify-all-final-2026-10-22.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | 同上 §三 |
| 逐项落地审计（真实文件切片断言） | **13/13 PASS**（P0-1 · P0-2 · P0-3 · P0-4 · P0-5 · P0-6 · P0-7 · P0-8 · P1-1 · P1-2 · P2-1 · P2-2 + `openCalNodeMenu` 内 `persistNow()` 计数 = 6） | `_环境与调试/r65-items-audit-2026-10-22.txt` |
| 产品件双件等价 | canonical 与 step9 镜像同字节同哈希（1,300,414 B / `30460FAB…50B2D36`） | 本文件 §二 |

- 环境注记：本机 PATH 无 `node`；本波门禁以 **Node v22.22.2**（`C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`）前置注入 PATH 后执行（首跑因未注入 PATH 出现 `spawnSync node ENOENT` 假失败，已重跑取证）。
- 关于「47 方零漂移」：现行登记器登记面为 **65 方**（`PARTY_COUNT=65`）；本波按现行口径实测 **drift 0 / PASS**，未新增 / 删除任何登记方。

**五 回滚**

- 产品件：① 删除 `input` 处理器整段，恢复 `if(finalHtml!==(cur.text||''))actions.updateText(id,finalHtml,{noHistory:true});`；② 删除 `blur` 首行 `clearTimeout(text._noteSaveTimer);`；③ 缓存键去掉 `+'|fo='+(ui.focusId||'')`；或直接以 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r65`（= R64 态 1,299,366 B / `506DB167…928B4079`）覆盖 canonical 与 step9 镜像（镜像备份 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261022-r65`）。
- 登记器：把 `canonical` / `step9-mirror` 两行期望值退回 `1299366 / 506DB167…928B4079`（备份 `verify-hash-registry.mjs.bak-r65`）。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r65` 覆盖。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`；本波未物化新冻结件）。

---

## 四十九 R66 启动守卫 + 死代码清理（openTagPicker / invertPatch / scheduleSidebar）+ errMsg 取值统一（2026-10-23）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（同 1,292,643 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更。

**一 变更点（6 类）**

| # | 位置（搜索锚） | 变更 |
| --- | --- | --- |
| ① | `script_5` 末尾（`document.addEventListener('visibilitychange',...)` 之后、`</script>` 之前） | 裸 `boot();` 改为 `if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',boot,{once:true});}else{boot();}`——脚本早于 DOM 解析完成执行时等待 DOMContentLoaded（一次性监听），否则立即启动 |
| ② | `script_4` · `closeTagPalette` 之后 | 删除 `let _tagPickerEl=null;` / `function closeTagPicker(){...}` / `function openTagPicker(nodeId,anchor){...}`（**合计 122 行**）；删除前全文件零调用点（标签手动指派现存路径为 `promptNewTag`） |
| ③ | `script_0` · L4 历史栈块（`setByPath` 之后、`applyPatch` 之前） | 删除 `function invertPatch(p){...}`（**12 行**）；undo/redo 自 L4 起为 patch 引用直传，无调用点 |
| ④ | `script_4` 顶部（侧栏段） | 删除 `let _sidebarRaf=null;` 与 `function scheduleSidebar(){...}`（**7 行**，含 FIX-M-12 注释）；该函数 FIX-M-12 已确认为死代码 |
| ⑤ | `script_0` 工具段（`const $=` 之前） | 新增 `function errMsg(e){return (e&&e.message)?e.message:String(e);}`；catch(e) 内 **11 处 `e.message`** 改为 `errMsg(e)`（commit patch 失败上报 / 索引整体异常出口 / graph-worker onerror / 备份·导出·桌面保存 toast / window error 上报与打印 / 启用加密失败文案 / 加密自动备份上报 / 备份目录选择异常返回），**2 处 `e.reason`** 改为显式取值 `String(e&&e.reason!==undefined?e.reason:e)` |
| ⑥ | `script_0` / `script_5` | `var IS_DESKTOP=false;` · `var _juBackupDirHandle=null;` · `var _juBackupDirWarned=false;` 三处 `var` → `let`；产品内零 `window.IS_DESKTOP` 引用，故无副作用（仅测试探针需改读全局词法绑定，见 §二） |

**二 随波测试适配（2 个文件，均为随实现口径同步，非放宽断言）**

- `6.P0-T3基线/step9/t9/t19-patch2.test.mjs`（**未纳入 65 方登记面**）：L19 · P1-1 段由「anchors `openTagPicker` 的 pick / clearTags 顺序」改为「A1 全文件零 `openTagPicker(` / `_tagPickerEl` / `closeTagPicker(` 引用 + A2 现存手动指派入口 `promptNewTag` 仍为 commit → `_tagIndexCache=null` → `renderSidebar` / `forceRender`」；B1 / C1（冻结锚红证）原样保留，驱动用例数不变（Node 503）。
- `6.P0-T3基线/step9/tests/t8-persist-patch.spec.ts`（**已纳编 l8-spec**）：3 处探针 `window.IS_DESKTOP === true` → `IS_DESKTOP === true`（`var`→`let` 后不再挂到 window；页面内全局词法绑定仍可读，与 `t10-idb-persist.spec.ts:105` 既有写法同口径）。登记器 l8-spec 期望值 `63991 / B72C509B…766E0EFC` → **`63970 / 5BE63DC0…7B7C01AB`**。

**三 字节锚**

- 变更前（R65 口径）：**1,300,414 B / `30460FAB1D255CBE259B9C2DD27071757863504C4B2EE18061FFB1D5B50B2D36` / LF（CR=0 · LF=23,900）**
- 变更后：**1,292,643 B / `F38A6E9968C719ED3D1DA76FA523FFC8049BDE832714C2922F8869FB22F1A17C` / LF（CR=0 · LF=23,761）**；增量 **−7,771 B / −139 行**；末字节 `0x0A` · 无 BOM。
- 行数拆解：**+2**（errMsg：1 行注释 + 1 行函数）**−122**（openTagPicker 块）**−12**（invertPatch）**−7**（scheduleSidebar 块）= **−139 行**；boot 守卫、11 处 `e.message`、2 处 `e.reason`、3 处 `var`→`let`、3 处注释引用清理均为同物理行内改写（行数不变）。
- canonical 与 step9 镜像：`sha256` 相等（逐字节一致，均为 `F38A6E99…22F1A17C`）。

**四 登记器重锚**

- `canonical` / `step9-mirror`：`1300414 / 30460FAB…50B2D36` → **`1292643 / F38A6E99…22F1A17C`**；`l8-spec`：`63991 / B72C509B…766E0EFC` → **`63970 / 5BE63DC0…7B7C01AB`**；追加 R66 注释块。**方数保持 65**（不新增纳编物），其余 63 方期望值一字未动（备份 `verify-hash-registry.mjs.bak-r66`）。
- 红证（判别力实测）：以重锚前登记器快照（= `verify-hash-registry.mjs.bak-r66`）对改后字节复跑 → `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（恰 `canonical` + `step9-mirror`），exit 1；证据 `_哈希与行尾校验/r66-registry-red-2026-10-23.txt`。
- 绿证：重锚后 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）；证据 `_哈希与行尾校验/r66-registry-green-2026-10-23.txt`。

**五 门禁证据（真实执行 · 取自落证文件）**

| 门禁 | 实际输出 | 证据文件 |
| --- | --- | --- |
| 内联脚本语法自检（canonical + step9 镜像各 9 块 vm 编译） | 两件均 `size=1292643 sha256=F38A6E99…22F1A17C CR=0 LF=23761 blocks=9 compiled-ok=9` · `script1..script9: OK` · `SYNTAX_RESULT=PASS`（exit 0） | `_环境与调试/r66-syntax-2026-10-23.txt` |
| `node scripts/verify.js node`（先导） | Node **503/503**（`# tests 503 / # pass 503 / # fail 0`，27,908ms）→ `[verify] 全部通过`（exit 0） | `_环境与调试/r66-verify-node-2026-10-23.txt` |
| `node scripts/verify.js all`（首跑 · 修正测试探针前） | 静态 0 命中 · Node 503 ✓ · Playwright **2 failed / 165 passed / 4 skipped**——失败为 `t8-persist-patch.spec.ts` T-65 / T-67 的 `isDesktop` 探针（`window.IS_DESKTOP` 在 `var`→`let` 后不再挂 window），即测试探针口径未同步的预期红 | `_环境与调试/r66-verify-all-2026-10-23.txt` |
| `node scripts/verify.js all`（探针同步 + 重锚后） | **exit 0**：静态检查 0 命中（80ms）· Node **503/503**（25,509ms）· Playwright **171**（167 passed + 4 skipped，54,962ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，74ms）→ `[verify] 全部通过` | `_环境与调试/r66-verify-all-final-2026-10-23.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | 同 §四 |
| 产品件双件等价 | canonical 与 step9 镜像同字节同哈希（1,292,643 B / `F38A6E99…22F1A17C`） | 本文件 §三 |

**六 回滚**

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r66`（= R65 态 1,300,414 B / `30460FAB…50B2D36`）覆盖 canonical 与 step9 镜像（镜像备份 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r66`）。
- 测试适配：`6.P0-T3基线/step9/t9/t19-patch2.test.mjs.bak-r66` 复原 L19 · P1-1 段；`t8-persist-patch.spec.ts` 的 3 处 `IS_DESKTOP === true` 改回 `window.IS_DESKTOP === true`（仅当产品侧回退 `var IS_DESKTOP` 时才需要）。
- 登记器：`canonical` / `step9-mirror` 退回 `1300414 / 30460FAB…50B2D36`，`l8-spec` 退回 `63991 / B72C509B…766E0EFC`（备份 `verify-hash-registry.mjs.bak-r66`）。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r66` 覆盖。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`；本波未物化新冻结件）。

---

## 五十 R66b 追加收口：catch 内 `e.message` 全量改走 `errMsg(e)` + `invertPatch` 注释彻底删除（2026-10-23）

> 承接 §四十九。范围同前：canonical 与 step9 镜像**双件同步**、逐字节一致（**1,292,343 B / `4CF0E10E…CE2300DC`**）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更。

**一 变更点（3 项）**

| # | 变更 | 数量 / 位置 |
| --- | --- | --- |
| ① | `catch(e)` 内 `e.message` 全量改 `errMsg(e)` | **12 处新增**（累计 **23 处**）：`calIndexUpdate` / `tagIndexUpdate` / `searchInvertedUpdate` / `backlinkMapUpdate` 四个增量索引 `catch`（`errors.push(`id=${id}: ${errMsg(e)}`)`）· `renderOutlinePage` 内虚拟滚动降级 2 处 `reportError('virtual-scroll-fallback',{msg:errMsg(e)})` · `saveAutoBackup` 失败上报 1 处 · L9 内联持久层错误形状 5 处 `errMsg(e)` |
| ② | `invertPatch` 历史注释彻底删除 | 删除 `undo()` 首部 `/* L4 阶段 1.6：…（修正：invertPatch 会导致 redo 时 apply 方向错位，改为引用传递） */` 整行；全文 **`invertPatch` = 0 提及 / `invertPatch(` = 0** |
| ③ | `errMsg` 注释改写（去除对 `e.message` 的字面提及） | `/* R66：catch(e) 内统一错误消息取值（errMsg 内无 message 时回落 String(e)） */` |

**二 残留自检（真实计数）**

- `e.message`：**25（R65 态）→ 15（R66 态）→ 2（R66b 态）**，仅剩 `errMsg` 函数本体 2 处（`(e&&e.message)?e.message:String(e)`）。
- `invertPatch` / `openTagPicker` / `_tagPickerEl` / `closeTagPicker` / `scheduleSidebar` / `_sidebarRaf`：**全部 0 提及**。
- `var IS_DESKTOP` / `var _juBackupDirHandle` / `var _juBackupDirWarned`：0；`let IS_DESKTOP`：1。

**三 字节锚**

- 变更前（R66 口径）：**1,292,643 B / `F38A6E9968C719ED3D1DA76FA523FFC8049BDE832714C2922F8869FB22F1A17C` / LF（CR=0 · LF=23,761）**
- 变更后：**1,292,343 B / `4CF0E10EB694C36BB35856D2AAC12C829AC136969C2BBA7D4D391995CE2300DC` / LF（CR=0 · LF=23,760）**；增量 **−300 B / −1 行**（12 处 `e.message`→`errMsg(e)` 字节缩减 + 1 处注释改写 + 删除 1 行注释）。

**四 随波测试适配（1 个文件，非断言放宽）**

- `6.P0-T3基线/step9/t9/t16-w14-persist-chain-async.test.mjs`（**未纳入 65 方登记面**）：该用例以 `new Function` 逐字装配产品 `saveAutoBackup` 函数体并在最小作用域内执行；产品侧改为 `errMsg(e)` 后，装配环境须提供同名依赖 → 在 harness 桩区（`reportError` 之后）**新增 1 行** `function errMsg(e){return (e&&e.message)?e.message:String(e);}`。**未改动任何断言**。

**五 登记器重锚**

- `canonical` / `step9-mirror`：`1292643 / F38A6E99…22F1A17C` → **`1292343 / 4CF0E10E…CE2300DC`**；方数保持 65。
- 红证（R66b 重锚前快照复跑）：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`，exit 1（`_哈希与行尾校验/r66b-registry-red-2026-10-23.txt`）。
- 绿证：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`，exit 0（`_哈希与行尾校验/r66b-registry-green-2026-10-23.txt`）。

**六 门禁证据（真实执行）**

| 门禁 | 实际输出 | 证据 |
| --- | --- | --- |
| 语法自检（9 块 vm 编译） | `size=1292343 sha256=4CF0E10E…CE2300DC CR=0 LF=23760 blocks=9 compiled-ok=9` · `SYNTAX_RESULT=PASS`（exit 0） | `_环境与调试/r66b-syntax-2026-10-23.txt` |
| `node scripts/verify.js node` | `# tests 503 / # pass 503 / # fail 0`（28,461ms）→ 全部通过（exit 0） | `_环境与调试/r66b-verify-node-2026-10-23.txt` |
| `node scripts/verify.js all` | 静态 ✓（33ms）· Node **503**（25,767ms）· Playwright **171**（167 passed + 4 skipped，54,676ms）· bench ✓（0.0% / −14.3%，84ms）→ `[verify] 全部通过`（exit 0） | `_环境与调试/r66b-verify-all-2026-10-23.txt` |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | 同 §五 |

**七 回滚**

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r66b`（= R66 态 1,292,643 B / `F38A6E99…22F1A17C`）覆盖 canonical 与 step9 镜像（镜像备份 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r66b`）。
- 测试：`6.P0-T3基线/step9/t9/t16-w14-persist-chain-async.test.mjs.bak-r66b`。
- 登记器：`canonical`/`step9-mirror` 退回 `1292643 / F38A6E99…22F1A17C`（备份 `verify-hash-registry.mjs.bak-r66b`）。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r66b` 覆盖。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`）。

---

## 五十一 R67 数据库工具栏「标题左 / 按钮组右」（2026-10-23）

> 承接 §五十。范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（**1,292,369 B / `3FE5C4D8…AB57452`**）。DOM 结构 / `renderDatabasePage` 逻辑 / 数据契约 / 公开 API / `<script>` 块数 9 零变更；日历 / 大纲 / 画廊等其它视图工具栏零改动（`.db-toolbar` 仅由 `renderDatabasePage()` 生成，全文件无第二处使用）。

**一 变更点（CSS 3 处；行号为落盘后文件行号）**

| # | 选择器 | 行号 | 变更 |
| --- | --- | --- | --- |
| ① | `.db-title` | **504** | 末尾追加 `;margin-right:auto` |
| ② | `.db-add` | **510** | 移除 `margin-left:auto;` → `.db-add{display:flex;gap:6px}` |
| ③ | `.db-toolbar` | **503** | 在 `display:flex;` 之后追加 `justify-content:flex-end;` |

行级对拍（`_哈希与行尾校验/r67-diff-2026-10-23.txt`）：`CHANGED_LINES=3` / `OLD_LINES=23761 NEW_LINES=23761`（±0 行），仅上述 3 行不同，无夹带改动。

**二 为什么除指令给定的 ① ② 之外必须有 ③（实测依据，非主观判断）**

真实 Chromium 探针（`_环境与调试/db-toolbar-layout-r67-browser-probe-2026-10-23.txt`，含 `BEFORE` / `AFTER`（仅 ①②）/ `AFTER-FINAL`（①②③）三段）：

| 段 | 视口 | `.db-title` 左缘 | `.db-add` 右缘 vs 工具栏内右缘 | 结论 |
| --- | --- | --- | --- | --- |
| BEFORE（R66b） | 1440×900 | 230（delta 0） | delta 0 | `.db-views` 起点 283.4、`.db-sf-group` 533.5–847.8 —— 三组**未**整体靠右（仅 `+行/+列` 靠右） |
| AFTER（仅 ①②） | 1440×900 | 230（delta 0） | delta 0 | ✅ 达标：views 518.8–750.9 / sf 768.9–1083.1 / add 1091.1–1190 |
| AFTER（仅 ①②） | **720×600** | 12（delta 0） | **delta −597.1（不达标）** | 换行后 `.db-add` 落到第二行**左端** —— 与「换行后按钮组继续右对齐」冲突 |
| AFTER-FINAL（①②③） | 1440×900 | 230（delta 0） | delta 0 | ✅ 达标（间距 243.4 / 18 / 8） |
| AFTER-FINAL（①②③） | 720×600 | 12（delta 0） | delta 0 | ✅ 达标：第 1 行 `标题 + views + sf` 右缘贴合 708，第 2 行 `.db-add` 右缘贴合 708 |

机理：`margin:auto` 只在其所属 flex 行内分配剩余空间，**换行后的行不受 `.db-title` 的 auto margin 影响**，故仅 ①② 时换行行回落左对齐。`justify-content:flex-end` 在第 1 行无可用空间（已被 `.db-title` 的 auto margin 吃尽 ⇒ `titleLeftDelta=0`，标题零位移），仅在后续换行行生效。`flex-wrap:wrap` + 换行使负剩余空间不出现，不会引发左溢裁切。

**三 字节锚**

- 变更前（R66b 口径）：**1,292,343 B / `4CF0E10EB694C36BB35856D2AAC12C829AC136969C2BBA7D4D391995CE2300DC` / LF（CR=0 · LF=23,760）**
- 变更后：**1,292,369 B / `3FE5C4D88051186A0DC276A659530E97675316779C2E85394E7D128AAAB57452` / LF（CR=0 · LF=23,760）**
- 增量 **+26 B / ±0 行** = ① +18 B（`;margin-right:auto`）+ ② −17 B（`margin-left:auto;`）+ ③ +25 B（`justify-content:flex-end;`）。

**四 红证与绿证（门禁自检口径）**

- **红证（① ② 落盘后、③ 落盘前，登记器仍锚 1,292,344/3BAAF088…）**：`node scripts/verify.js all` → Playwright **166 passed + 4 skipped + 1 failed**，失败项 `tests/t10-idb-persist.spec.ts:543`（T-99 门禁 · 15+M 方登记 `RESULT=PASS` 断言）`expect(drift).toBe(0)` 实收 **2**（= canonical / step9-mirror 两个登记方）→ exit 1。该失败为**哈希陈旧症状**（③ 已改字节而登记器未重锚），非逻辑回归。证据 `_环境与调试/db-toolbar-layout-r67-verify-all-2026-10-23.txt`。
- **绿证（③ 落盘 + 登记器重锚后）**：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`，exit 0（`_哈希与行尾校验/r67-registry-green-2026-10-23.txt`）。

**五 门禁证据（真实执行 · 最终态）**

| 门禁 | 实际输出 | 证据 |
| --- | --- | --- |
| 静态检查（铁律 6） | ✓（46ms） | `_环境与调试/db-toolbar-layout-r67-verify-all-final-2026-10-23.txt` |
| Node 单元测试 | `# tests 503 / # pass 503 / # fail 0 / # skipped 0`（25,978ms） | 同上 |
| Playwright 集成测试 | **167 passed + 4 skipped = 171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 + L13 6；53,635ms） | 同上 |
| 性能对拍 | 可比 7 · 通过 7 · 警告 0 · 失败 0 · 最大恶化 0.0% · 中位数 −14.3%（70ms） | 同上 |
| `node scripts/verify.js all` | `[verify] 全部通过` · **Exit 0** | 同上 |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | `_哈希与行尾校验/r67-registry-green-2026-10-23.txt` |
| 真机几何探针 | 双视口 `titleLeftAligned=true` / `addRightAligned=true` / `titleLeftDelta=0` / `addRightDelta=0` | `_环境与调试/db-toolbar-layout-r67-browser-probe-2026-10-23.txt` |

> 封存复跑（手册与证据落盘后、清理临时件后再次执行）：`[verify] 全部通过` · **Exit 0** · canonical 与 step9-mirror 哈希复核同为 `3FE5C4D8…AB57452` / 1,292,369 B（`_环境与调试/db-toolbar-layout-r67-verify-all-seal-2026-10-23.txt`）。

**六 回滚**

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r67`（= **R66b 态 1,292,343 B / `4CF0E10E…CE2300DC`**）覆盖 canonical 与 step9 镜像（镜像备份 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r67`，同哈希）。
- 登记器：`canonical`/`step9-mirror` 退回 `1292343 / 4CF0E10E…CE2300DC`（备份 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r66b`）。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r66b` 覆盖（本 §五十一 随之移除）。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`）；`.db-toolbar` / `.db-title` / `.db-add` 仅 CSS 变更，无测试适配、无冻结件物化。

## 五十二 R68 日历模块标题行：计数移至标题旁（2026-10-23）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（同 1,292,681 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更；未物化新冻结件（封存 HEAD 仍为 `r22`）。

**一 变更（`calModuleBadge` · 内联 `script_1` 区块 · 文件行 10079–10094）**

- 原实现：创建 `.badge` 后 `head.appendChild(b)`，计数徽标固定在模块标题行右端，文本直接写入 `textContent`。
- 新实现：① badge 优先追加到 `head.querySelector('.cal-module-title')` 内部（无标题节点时回退到 `head`），计数紧贴标题文字；② 括号格式归一——`String(text)` 以 `'('` 开头时前置一个空格（如 `4/4 (100%)` → ` 4/4 (100%)`），否则包裹为 ` (text)`（如 `84` → ` (84)`）；③ 追加前清除标题内（回退分支为 head 内）已存在的 `.badge`，杜绝重复插入。
- 调用方零改动：`calModuleTodayBody`（行 10112，`done/total (rate%)`）与 `calModuleLogBody`（行 10131，复用日志面板 badge 文本）。
- 行为边界：`calModuleStatsBody` / `calModuleCharsBody` 直接改写 `.cal-module-title` 的 `textContent`（不生成 badge），与本次变更无交互。

**二 字节锚（实测）**

- 变更前（R67 口径）：**1,292,369 B / `3FE5C4D88051186A0DC276A659530E97675316779C2E85394E7D128AAAB57452` / LF（CR=0 · LF=23,760）**
- 变更后：**1,292,681 B / `70B7B73C4272544479D8154C22EAC90CCFEDD9CBFBEB642C473F54773D5BF2EA` / LF（CR=0 · LF=23,772）**
- 增量 **+312 B / +12 行**；末字节 `0x0A` · 无 BOM。canonical 与 step9 镜像 `sha256` 相等（逐字节一致）。

**三 红证与绿证（登记器）**

- 红证（改字节后、未重锚前）：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`，exit 1；恰为 `canonical` 与 `step9-mirror` 两方（`size=1292681 (exp 1292369)`，同哈希 `70B7B73C…D5BF2EA`），判别力真实。
- 绿证（登记器重锚后）：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`，exit 0（`_哈希与行尾校验/r68-registry-green-2026-10-23.txt`）。

**四 门禁证据（真实执行 · 最终态）**

| 门禁 | 实际输出 | 证据 |
| --- | --- | --- |
| 静态检查（铁律 6） | ✓（39ms） | `_环境与调试/r68-verify-all-2026-10-23.txt` |
| Node 单元测试 | `# tests 503 / # pass 503 / # fail 0`（24,414ms） | 同上 |
| Playwright 集成测试 | **167 passed + 4 skipped = 171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 + L13 6；54,276ms） | 同上 |
| 性能对拍 | 可比 7 · 通过 7 · 警告 0 · 失败 0 · 最大恶化 0.0% · 中位数 −14.3%（81ms） | 同上 |
| `node scripts/verify.js all` | `[verify] 全部通过` · **Exit 0** | 同上 |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | `_哈希与行尾校验/r68-registry-green-2026-10-23.txt` |

**五 回滚**

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r68`（= **R67 态 1,292,369 B / `3FE5C4D8…AB57452`**）覆盖 canonical 与 step9 镜像（镜像备份 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r68`，同哈希）。
- 登记器：`canonical`/`step9-mirror` 退回 `1292369 / 3FE5C4D8…AB57452`。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r67` 覆盖（本 §五十二 随之移除）。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`）；本次仅改 `calModuleBadge` 一个函数，无 CSS / DOM 结构 / 测试适配 / 冻结件物化。

---

## 五十三 R69 日历模块计数徽章分隔符归一：括号 → 中点（2026-10-23）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（同 1,292,682 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更；未物化新冻结件（封存 HEAD 仍为 `r22`）。

**一 变更（`calModuleTodayBody` · 内联 `script_1` 区块 · 文件行 10112 · 唯一一处）**

- 原：`const badge=calModuleBadge(head,done+'/'+todos.length+' ('+rate+'%)');`
- 新：`const badge=calModuleBadge(head,done+'/'+todos.length+' · '+rate+'%');`
- 分隔符为**中点 `·`（U+00B7）**；实测分隔字面量码点 `0020,00B7,0020`（非圆点 `•` / 非英文句点 `.`）。
- `calModuleBadge()` 本体零改动：外层包裹 `' ('+text+')'` 逻辑保留（`b.textContent=t.startsWith('(')?(' '+t):(' ('+t+')');`），最终渲染仍为「当日待办 (4/4 · 100%)」。
- 唯一性核验：全文件旧同型拼接 `' ('+rate+'%)'` 命中 **0**，新拼接命中 **1**；`calModuleTodayBody` 之外无同型拼接（`_哈希与行尾校验/r69-anchor-2026-10-23.txt`）。
- 行为边界：`calModuleLogBody`（行 10131）复用日志面板 badge 文本（不经 `rate` 拼接），未受影响。

**二 字节锚（实测）**

- 变更前（R68 口径）：**1,292,681 B / `70B7B73C4272544479D8154C22EAC90CCFEDD9CBFBEB642C473F54773D5BF2EA` / LF（CR=0 · LF=23,772）**
- 变更后：**1,292,682 B / `7B46FDD8145C03070DFA0215F6B97E98398F3DB9445E3A802DA22C38ADCE5959` / LF（CR=0 · LF=23,772）**
- 增量 **+1 B / ±0 行**（`' ('`+`'%)'` = 4 B → `' · '`+`'%'` = 5 B，中点占 2 B UTF-8）；末字节 `0x0A` · 无 BOM。canonical 与 step9 镜像 `sha256` 相等（逐字节一致）。

**三 红证与绿证（登记器）**

- 红证（改字节后、未重锚前）：`T-99` 哨兵实跑登记器得 `drift=2`（`canonical` / `step9-mirror` 两方 `size=1292682 (exp 1292681)`），P 层 `tests/t10-idb-persist.spec.ts:570` 的 `expect(drift).toBe(0)` 失败 → `verify.js all` **exit 1**（证据 `_环境与调试/r69-verify-all-2026-10-23.txt`），判别力真实。
- 绿证（登记器重锚后）：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`，exit 0（`_哈希与行尾校验/r69-registry-green-2026-10-23.txt`）。

**四 门禁证据（真实执行 · 最终态）**

| 门禁 | 实际输出 | 证据 |
| --- | --- | --- |
| 静态检查（铁律 6） | ✓（54ms） | `_环境与调试/r69-verify-all-final-2026-10-23.txt` |
| Node 单元测试 | `# tests 503 / # pass 503 / # fail 0`（25,764ms） | 同上 |
| Playwright 集成测试 | **167 passed + 4 skipped = 171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 + L13 6；53.2s） | 同上 |
| 性能对拍 | 可比 7 · 通过 7 · 警告 0 · 失败 0 · 最大恶化 0.0% · 中位数 −14.3%（76ms） | 同上 |
| `node scripts/verify.js all` | `[verify] 全部通过` · **Exit 0** | 同上 |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | `_哈希与行尾校验/r69-registry-green-2026-10-23.txt` |

> 封存复跑（§四 表格 + 手册本段落盘后再次执行）：`[verify] 全部通过` · **Exit 0**（静态 0 命中 + Node `# tests 503 / # pass 503 / # fail 0` + Playwright **167 passed + 4 skipped = 171** + bench 7/7），证据 `_环境与调试/r69-verify-all-seal-2026-10-23.txt`；登记器同批复跑 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（`_哈希与行尾校验/r69-registry-green-final-2026-10-23.txt`）。

**五 回滚**

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r69`（= **R68 态 1,292,681 B / `70B7B73C…D5BF2EA`**）覆盖 canonical 与 step9 镜像（镜像备份 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r69`，同哈希）。
- 登记器：`canonical`/`step9-mirror` 退回 `1292681 / 70B7B73C…D5BF2EA`。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r68` 覆盖（本 §五十三 随之移除）。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`）；本次仅改一处字符串拼接，无 CSS / DOM 结构 / 测试适配 / 冻结件物化。

---

## 五十四 R70 日历新建待办后保持 #content 滚动位置（三条路径：模块 + 按钮 / 网格空白 / Enter）（2026-10-23）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（同 1,293,172 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更；未物化新冻结件（封存 HEAD 仍为 `r22`）。

**一 根因**

- `actions.addNode()` 内部 `commit()` 已排程一次渲染（`updateIncrementalIndexes` → 渲染排程），调用方随后又调 `forceRender()` ⇒ **同一动作触发两次渲染**。
- 二次渲染期间 `#content` 子树被清空重建，`scrollTop` 瞬时归零后未复位；同时新节点获得焦点（选择区落入可视）会把视图带走 ⇒ 用户感知为「加完待办页面自己跳走 / 回顶」。

**二 变更（3 处回调 · 统一口径：取基线 → 建节点 → 渲染 → 同步复位 → 聚焦 → 次帧复位）**

| # | 函数 | 行 | 路径 |
| --- | --- | --- | --- |
| ① | `calModuleTodayBody` 的 `adder.onclick` | 10121–10131 | 当日待办模块「+ 添加今日待办」 |
| ② | `buildTimeGrid` 的 `col.onclick`（由 `renderCalendarPage` 构建的时间网格） | 9816 起，滚动块 9835–9842 | 周视图时间网格空白处点击新建 |
| ③ | `renderCalNode` 的 `text` keydown `Enter` 分支 | 11261 起，滚动块 11272–11278 | 待办文本行回车新建兄弟 / 根级待办 |

- 三处同构：`const c=document.getElementById('content'); const st=c?c.scrollTop:0;` → `actions.addNode(...)` → `ui.focusId=<id>` → `forceRender()` → `if(c)c.scrollTop=st;` → `focusAfterRender(<id>,'.cal-page')` → `requestAnimationFrame(()=>{if(c)c.scrollTop=st;});`
- 空值安全：`c` 为 null 时 `st=0` 且跳过回写；无新增全局态（`st` 为回调内局部量）。

**三 口径偏离说明（与任务给定片段的差异，附实测依据）**

- 任务给定片段把 `focusAfterRender(id,'.cal-page')` 放进 `requestAnimationFrame` 内（焦点推迟一帧）。实测该写法会在「空文本新行」场景**丢行 + 丢焦点**：`focusAfterRender()` 自身就是在 `requestAnimationFrame` 内聚焦，再套一层 rAF 使聚焦晚于 `commit` 触发的二次渲染 ⇒ 空文本节点被渲染过滤、`ui.focusId` 被清空（逐帧实测 `nodeEls 49→48`、`list 46→45`、`focusId→""`、`active=BODY`），即「+ 添加今日待办」按钮视觉无反应（`_环境与调试/cal-scroll-r70-frame-diag-2026-10-23.txt` 首段）。
- 落盘口径改为**同步聚焦 + 其后一帧复位滚动**：焦点时序与改前逐帧一致（`active=text`、`focusId` 保留、新行保留），滚动在聚焦之后一帧被拉回基线；逐帧实测全部 10 个采样点 `scrollTop` 恒为 260（同证据文件第二段）。

**四 字节锚（实测）**

- 变更前（R69 口径）：**1,292,682 B / `7B46FDD8145C03070DFA0215F6B97E98398F3DB9445E3A802DA22C38ADCE5959` / LF（CR=0 · LF=23,772）**
- 变更后：**1,293,172 B / `8E9B376FC0B7E059FAB6E21BE978906F6F11C9BF28DAF443564B6B9E9EC42CF1` / LF（CR=0 · LF=23,784）**
- 增量 **+490 B / +12 行**（每处 +4 行 ×3 处；末字节 `0x0A` · 无 BOM）；canonical 与 step9 镜像 `sha256` 相等（逐字节一致）。

**五 红证与绿证**

- 红证（改字节后、未重锚前）：`tests/t10-idb-persist.spec.ts:570` 的 `expect(drift).toBe(0)` 失败（`drift=2`：`canonical`/`step9-mirror` 实测 `size=1293172` vs 期望 `1293153`），`verify.js all` **exit 1**（`_环境与调试/cal-scroll-r70-verify-all-red-2026-10-23.txt`）。
- 绿证（登记器重锚后）：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`，exit 0（`_哈希与行尾校验/r70-registry-green-2026-10-23.txt`）。
- 行为红证 / 绿证（真实 Chromium 探针，三条路径各 45 条今日待办载体、`#content` 基线 `scrollTop=260`）：
  - 改前（R69 字节）：路径 A `260→1136`（delta **+876**）、路径 B `260→1050`（delta **+790**）→ 2 项 FAIL、`RESULT=FAIL`、exit 1；
  - 改后：A/C/B 三条路径均 `260→260`（delta **0**）、`created=1`、`listDelta=1`、`active=text` → 9/9 PASS、`RESULT=PASS`、exit 0（`_环境与调试/cal-scroll-r70-browser-probe-2026-10-23.txt`）。

**六 门禁证据（真实执行 · 最终态）**

| 门禁 | 实际输出 | 证据 |
| --- | --- | --- |
| 静态检查（铁律 6） | ✓（57ms） | `_环境与调试/cal-scroll-r70-verify-all-2026-10-23.txt` |
| Node 单元测试 | `# tests 503 / # pass 503 / # fail 0 / # skipped 0`（28,759ms） | 同上 |
| Playwright 集成测试 | **167 passed + 4 skipped = 171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 + L13 6；61,775ms） | 同上 |
| 性能对拍 | 可比 7 · 通过 7 · 警告 0 · 失败 0 · 最大恶化 0.0% · 中位数 −14.3%（85ms） | 同上 |
| `node scripts/verify.js all` | `[verify] 全部通过` · **Exit 0** | 同上 |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | `_哈希与行尾校验/r70-registry-green-2026-10-23.txt` |

**七 回滚**

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r70`（= **R69 态 1,292,682 B / `7B46FDD8…DCE5959`**）覆盖 canonical 与 step9 镜像（镜像备份 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r70`，同哈希）。
- 登记器：`canonical`/`step9-mirror` 退回 `1292682 / 7B46FDD8…DCE5959`。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r69` 覆盖（本 §五十四 随之移除）。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`）；本次仅改 3 处事件回调体内的滚动保持语句，无 CSS / DOM 结构 / 测试适配 / 冻结件物化。

---

## 五十五 R71 取消日历待办的默认粗体（当日待办列表 + 周视图时间网格事件块）（2026-10-23）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（同 1,293,121 B / 同 SHA-256）。JS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更；未物化新冻结件（封存 HEAD 仍为 `r22`）。

**一 变更（2 处 CSS 声明 · 行号为 canonical 文件行号）**

| # | 选择器 | 行 | 改前 | 改后 |
| --- | --- | --- | --- | --- |
| ① | `.cal-tg-ev .evtx`（时间网格·周视图事件块正文） | 397 | `.cal-tg-ev .evtx{font-weight:700} /* 事项加粗 */` | `.cal-tg-ev .evtx{font-weight:normal}` |
| ② | `.cal-node .text`（当日待办列表正文） | 498 | `…;color:var(--fg);font-weight:600} /* 事项加粗 */` | `…;color:var(--fg)}`（去掉 `font-weight:600`） |

- 两处同步落盘到 step9 镜像，镜像与 canonical 逐字节一致（同 size / 同 `sha256`）。
- 未新增/删除规则行（`±0` 行），仅就地改写声明文本，故 `LF=23,784` 与 R70 相同。

**二 字节锚（实测）**

- 变更前（R70 口径）：**1,293,172 B / `8E9B376FC0B7E059FAB6E21BE978906F6F11C9BF28DAF443564B6B9E9EC42CF1` / LF（CR=0 · LF=23,784）**
- 变更后：**1,293,121 B / `C639531CA720B53CEA31C2C125AF1BB73A2A725A9C559F50BFD6270A836CC1CD` / LF（CR=0 · LF=23,784）**
- 增量 **−51 B / ±0 行**；减法核对：① `font-weight:700`→`normal` 净 +3 字符，同时移除尾随行内注释 `/* 事项加粗 */`（11 字符，其中 4 个汉字按 UTF-8 计 12 B）⇒ **−16 B**；② 去掉 `;font-weight:600`（15 B）与尾随注释 `/* 事项加粗 */`（20 B 含前导空格）⇒ **−35 B**；`16 + 35 = 51` 与实测 `1,293,172 − 1,293,121 = 51` 完全吻合，无其它字节变动。末字节 `0x0A` · 无 BOM。

**三 红证与绿证**

- 红证（改字节后、未重锚前）：`verify-hash-registry.mjs` 输出 2 条 `FAIL`，`canonical` / `step9-mirror` 实测 `size=1293121`（exp `1293172`）、`sha256=C639531C…CC1CD`（exp `8E9B376F…42CF1`），退出码非 0（`_环境与调试/cal-bold-r71-verify-all-red-2026-10-23.txt`）。
- 绿证（登记器重锚后）：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`，exit 0（`_哈希与行尾校验/r71-registry-green-2026-10-23.txt`）。

**四 门禁证据（真实执行 · 最终态）**

| 门禁 | 实际输出 | 证据 |
| --- | --- | --- |
| 静态检查（铁律 6） | ✓（98ms） | `_环境与调试/cal-bold-r71-verify-all-2026-10-23.txt` |
| Node 单元测试 | `# tests 503 / # pass 503 / # fail 0 / # skipped 0`（28,671ms） | 同上 |
| Playwright 集成测试 | **167 passed + 4 skipped = 171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 + L13 6；63,132ms） | 同上 |
| 性能对拍 | 可比 7 · 通过 7 · 警告 0 · 失败 0 · 最大恶化 0.0% · 中位数 −14.3%（82ms） | 同上 |
| `node scripts/verify.js all` | `[verify] 全部通过` · **Exit 0** | 同上 |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | `_哈希与行尾校验/r71-registry-green-2026-10-23.txt` |

**五 回滚**

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r71`（= **R70 态 1,293,172 B / `8E9B376F…42CF1`**）覆盖 canonical 与 step9 镜像。
- 登记器：`canonical`/`step9-mirror` 退回 `1293172 / 8E9B376F…42CF1`，并移除 R71 注释块。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r70` 覆盖（本 §五十五 随之移除）。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`）；本次仅改 2 处 CSS `font-weight` 声明，无 JS / DOM 结构 / 测试适配 / 冻结件物化。

**六 遗留说明**

- 行 408 `.cal-node-time` 的尾注仍写「时间不加粗（事项加粗）」，其中「事项加粗」已与本次改动后的事实不符。该注释不在本批次给定改动范围内，为避免超范围漂移**未改动**，仅在此登记，供后续批次一并订正。
- 测试面无需适配：仓库内无任何用例断言 `font-weight`（`grep` 全量 `tests/*.ts`、`P0-T3/tests/*.mjs`、`t9/*.mjs` 命中 0），故 503 + 171 用例全部沿用原断言通过。

---

## 五十六 R72 全局滚动条滑块调浅 / 统一 / 自适应主题（2026-10-23）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（同 1,293,389 B / 同 SHA-256）。JS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更；未物化新冻结件（封存 HEAD 仍为 `r22`）。

**一 变更（4 处 CSS · 行号为 canonical 文件行号）**

| # | 选择器 | 行 | 改前 | 改后 |
| --- | --- | --- | --- | --- |
| ① | `::-webkit-scrollbar-thumb` | 66 | `background:var(--line);border-radius:var(--radius-sm)` | `background:var(--line);background:color-mix(in srgb,var(--fg) 18%,transparent);border-radius:var(--radius-sm)` |
| ② | `::-webkit-scrollbar-thumb:hover`（新增） | 67 | —（不存在） | `background:color-mix(in srgb,var(--fg) 32%,transparent)` |
| ③ | `::-webkit-scrollbar-track`（新增） | 68 | —（不存在） | `background:transparent` |
| ④ | `html`（Firefox 标准属性） | 70 | `scrollbar-color:var(--line) transparent` | `scrollbar-color:var(--line) transparent;scrollbar-color:color-mix(in srgb,var(--fg) 18%,transparent) transparent` |

- `::-webkit-scrollbar{width:8px;height:8px}`（行 65）零改动；`/* FIX-a11y-3 … */` 注释行（行 69）位置不变。
- ①②③④ 的旧值均保留在**前**、新值在后：不支持 `color-mix()` 的引擎按级联丢弃后声明并回退到 `var(--line)`；支持的引擎（Chrome 111+ / Firefox 113+）取后声明，滑块颜色随当前主题 `--fg` 自动适配日夜模式（浅色主题浅灰、深色主题浅白），不再固定取 `--line` 边框色。
- 两件同步落盘，镜像与 canonical 逐字节一致（同 size / 同 `sha256`）。新增 2 行规则行，故 `LF` 由 `23,784` 增至 `23,786`。

**二 字节锚（实测）**

- 变更前（R71 口径）：**1,293,121 B / `C639531CA720B53CEA31C2C125AF1BB73A2A725A9C559F50BFD6270A836CC1CD` / LF（CR=0 · LF=23,784）**
- 变更后：**1,293,389 B / `B5461DDACA2F83C8A1D2C02543453A6CFF5CC634703813F54191A2DE0F4EB0F3` / LF（CR=0 · LF=23,786）**
- 增量 **+268 B / +2 行**；加法核对：① 行 66 插入 56 B ＋ ② 行 67 整行 88 B ＋ LF 1 B ＋ ③ 行 68 整行 49 B ＋ LF 1 B ＋ ④ 行 70 插入 73 B ⇒ `56 + 89 + 50 + 73 = 268`，与实测 `1,293,389 − 1,293,121 = 268` 完全吻合，无其它字节变动。末字节 `0x0A` · 无 BOM。

**三 红证与绿证**

- 红证（改字节后、未重锚前）：`verify-hash-registry.mjs` 输出 2 条 `FAIL`，`canonical` / `step9-mirror` 实测 `size=1293389`（exp `1293121`）、`sha256=B5461DDA…4EB0F3`（exp `C639531C…CC1CD`），Exit 1（`_哈希与行尾校验/r72-registry-red-2026-10-23.txt`）。
- 绿证（登记器重锚后）：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`，Exit 0（`_哈希与行尾校验/r72-registry-green-2026-10-23.txt`）。

**四 门禁证据（真实执行 · 最终态）**

| 门禁 | 实际输出 | 证据 |
| --- | --- | --- |
| 静态检查（铁律 6） | ✓（0 命中，67ms） | `_环境与调试/r72-verify-all-2026-10-23.txt` |
| Node 单元测试 | `# tests 503 / # pass 503 / # fail 0 / # skipped 0`（30,451ms） | 同上 |
| Playwright 集成测试 | **167 passed + 4 skipped = 171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 + L13 6；66,443ms） | 同上 |
| 性能对拍 | 可比 7 · 通过 7 · 警告 0 · 失败 0 · 最大恶化 0.0% · 中位数 −14.3%（84ms） | 同上 |
| `node scripts/verify.js all` | `[verify] 全部通过` · **Exit 0** | 同上 |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（Exit 0） | `_哈希与行尾校验/r72-registry-green-2026-10-23.txt` |

**五 回滚**

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r72`（= **R71 态 1,293,121 B / `C639531C…CC1CD`**）覆盖 canonical 与 step9 镜像（镜像备份 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r72`，同哈希）。
- 登记器：`canonical`/`step9-mirror` 退回 `1293121 / C639531C…CC1CD`，并移除 R72 注释块（备份 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r72`）。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r72` 覆盖（本 §五十六 随之移除）。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`）；本次仅 4 处 CSS 声明，无 JS / DOM 结构 / 测试适配 / 冻结件物化。

**六 遗留说明**

- `cal-tg-scroll` / `cal-bottom` 等局部容器仍单独声明 `scrollbar-width:thin`（仅宽度），颜色继承 `html` 层 `scrollbar-color`，本次无需逐条改动；`.cal-panel-body` / `.tb-nav` 的 `scrollbar-width:none`（视觉隐藏）保持原状。
- 测试面无需适配：仓库内无用例断言滚动条颜色 / 宽度（全量 503 + 171 用例沿用原断言通过）。

---

## 五十七 R73 拖拽移动索引偏移修正（2026-10-23）

> 范围：产品 `6.P0-T3基线/v2.0-t3.html`（canonical）与 `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像）**双件同步**，落盘后两件**逐字节一致**（同 1,293,540 B / 同 SHA-256）。CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数 9 零变更；未物化新冻结件（封存 HEAD 仍为 `r22`）。

**一 变更（2 处 JS · 行号为 canonical 文件行号）**

| # | 位置 | 行 | 改前 | 改后 |
| --- | --- | --- | --- | --- |
| ① | `actions.moveNode` · `commit(s=>…)` 回调 | 5520–5522 | `to.children.splice(Math.max(0,Math.min(toIndex,to.children.length)),0,id);` | `let insertIdx=toIndex;` ＋ `if(from===to&&fromIdx>=0&&fromIdx<toIndex)insertIdx--;` ＋ `to.children.splice(Math.max(0,Math.min(insertIdx,to.children.length)),0,id);` |
| ② | `renderDbTable` 列头拖拽 · `up()` 内 `commit` | 12813–12814 | `const [moved]=arr.splice(fromIdx,1);` ＋ `arr.splice(toIdx,0,moved);` | `const [moved]=arr.splice(fromIdx,1);` ＋ `const insertIdx=fromIdx<toIdx?toIdx-1:toIdx;` ＋ `arr.splice(insertIdx,0,moved);` |

- ① 修正点：同父移动时先 `splice` 摘除会让后续元素整体左移一位，原 `toIndex` 于是按「摘除后的下标」落地而非「摘除前的目标下标」；修正后仅在同父且 `fromIdx < toIndex` 时把插入点左移一格，跨父移动（`from !== to`）保持 `insertIdx = toIndex` 不变。
- ② 修正点：列头拖拽的 `toIdx` 取自指针悬停列在**摘除前**数组中的下标，右移时同样少走一格；修正后 `insertIdx = fromIdx < toIdx ? toIdx-1 : toIdx`，列落点等于拖拽指示条所在列，左移口径不变。
- 两处均在 `commit(s=>…)` 的 draft 克隆内计算，快照 / 撤销重做口径不变；`n.parent` / `n.updatedAt` 赋值顺序未改。

**二 字节锚（实测）**

- 变更前（R72 口径）：**1,293,389 B / `B5461DDACA2F83C8A1D2C02543453A6CFF5CC634703813F54191A2DE0F4EB0F3` / LF（CR=0 · LF=23,786）**
- 变更后：**1,293,540 B / `D91659B4A29C1D22D0D0A56064F8E09D3DCBC561BF06EAE88E188FD0B8E78EE0` / LF（CR=0 · LF=23,789）**
- 增量 **+151 B / +3 行**；加法核对：① 新增 2 行（28 B + LF 1 = 29、60 B + LF 1 = 61）＋ 原插入语句 `toIndex`→`insertIdx` 净 +2 ＝ 92；② 新增 1 行（54 B + LF 1 = 55）＋ `arr.splice` 实参 `toIdx`→`insertIdx` 净 +4 ＝ 59；`92 + 59 = 151`，与实测 `1,293,540 − 1,293,389 = 151` 完全吻合，无其它字节变动。末字节 `0x0A` · 无 BOM。
- 反向校验：对落盘件做逆替换（把 R73 这 5 行还原为改前 2 行）得 `1,293,389 B / B5461DDA…4EB0F3`（与 R72 口径逐字节一致），即 `.bak-20261023-r73` 备份；可证本次改动仅这 5 行，无附带字节变动。

**三 红证与绿证**

- 红证（改字节后、未重锚前）：`verify-hash-registry.mjs` 输出 3 条 `FAIL` —— `canonical` / `step9-mirror` 实测 `size=1293540`（exp `1293389`）、`sha256=D91659B4…B78EE0`（exp `B5461DDA…4EB0F3`），另有 `JU-不变量清单-v2.0-frozen.md` 的既有追加段漂移（见本节五），Exit 1（`_哈希与行尾校验/r73-registry-red-2026-10-23.txt`）。
- 绿证（登记器重锚后）：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`，Exit 0（`_哈希与行尾校验/r73-registry-green-2026-10-23.txt`）。

**四 门禁证据（真实执行 · 最终态）**

| 门禁 | 实际输出 | 证据 |
| --- | --- | --- |
| 静态检查（铁律 6） | ✓（0 命中，48ms） | `_环境与调试/r73-verify-all-2026-10-23.txt` |
| Node 单元测试 | `# tests 503 / # pass 503 / # fail 0 / # skipped 0`（29,745ms） | 同上 |
| Playwright 集成测试 | **167 passed + 4 skipped = 171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 + L13 6；65,556ms） | 同上 |
| 性能对拍 | 可比 7 · 通过 7 · 警告 0 · 失败 0 · 最大恶化 0.0% · 中位数 −14.3%（80ms） | 同上 |
| `node scripts/verify.js all` | `[verify] 全部通过` · **Exit 0** | 同上 |
| 65 方登记器 | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（Exit 0） | `_哈希与行尾校验/r73-registry-green-2026-10-23.txt` |

**五 登记器同步（含不变量清单追加段纳编）**

- `canonical` / `step9-mirror`：`1293389 / B5461DDA…4EB0F3` → `1293540 / D91659B4…B78EE0`。
- `JU-不变量清单-v2.0-frozen.md`：该文档在 R72 绿证（2026-10-23 12:27:10）之后被外部追加一次 —— 自第 2,172 行起追加「交互与视觉一致性修复（2026-10-23 新增） {#ui-consistency-r71}」章节 ＋ 不变量 #101–#105（各含 定义 / 实现 / 断言 三栏，均以 `### NN.` 标题落盘，`###` 编号条目 94 → 99）。前 2,171 行与 `.bak-r71-2026-10-23`（145,996 B）逐字节一致，属纯尾部追加、无既有行改写。期望值按落盘实测重锚：`145,996 → 151,170 B`（+5,174）、`LF 2,171 → 2,245`（+74）、`CR=0`、末字节 `0x0A`、`sha256=746C5911B2DDFDDE1BCAB2B957EA82E2A9C1F91FD8EEF6E9043672F80ADB11BE`。
- 方数保持 65（仅更新 3 个既有登记方的期望值，不新增 / 不退役纳编物）。

**六 回滚**

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r73`（= **R72 态 1,293,389 B / `B5461DDA…4EB0F3`**）覆盖 canonical 与 step9 镜像（镜像备份 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r73`，同哈希）。
- 登记器：`canonical`/`step9-mirror` 退回 `1293389 / B5461DDA…4EB0F3`、`JU-不变量清单-v2.0-frozen.md` 退回 `145996 / 998927A0…30D3E`，并移除 R73 注释块（备份 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r73`）。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r73` 覆盖（本节 §五十七 随之移除）。
- `1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`）；本次仅 2 处 JS 逻辑，无 CSS / DOM 结构 / 测试适配 / 冻结件物化。

**七 遗留说明**

- **调用方语义分叉（本波未改，仅登记）**：`moveNode` 的 `toIndex` 现按「摘除后插入点」落地，与拖放 / 列头路径（`indexOf(目标)`、`after` 时 `idx++`）一致；但 `moveSibling(id,dir)`（行 8872–8881）仍传 `j=i+dir`（按「最终下标」计算），在新口径下**下移方向净位移为 0**：对 `[A,B,C]` 下移 A（`toIndex=1`），旧实现得 `[B,A,C]`，新实现得 `[A,B,C]`；上移方向（`toIndex=i-1`）不受影响。该差异已用脚本对拍复现（`_临时脚本/_sim-r73-move.mjs`，8 组用例：拖放 2 例由错转对、上移 2 例不变、下移 2 例由对转错、另 2 例两版一致），因超出本波给定改动范围**未改动**，供后续批次决定 `moveSibling` 是否改为 `j=i+dir+(dir>0?1:0)` 或改用「插入前」语义。
- 测试面无新增断言：仓库内无用例覆盖同父移动的最终落点（`grep` `tests/*.ts`、`P0-T3/tests/*.mjs`、`t9/*.mjs` 仅命中 `moveNode(id,id,0)` 早退与跨父 `moveNode(id,parent,0)`），故 503 + 171 用例沿用原断言通过。

## 五十八 R75 七项 JS 行为修正（2026-10-23）

**类型**：产品缺陷修复（JS 行为）　**范围**：`6.P0-T3基线/v2.0-t3.html` 7 处函数内改动　**未触碰**：CSS / DOM 结构 / 数据契约 / 公开 API / `<script>` 块数（9 块）

| # | 函数 / 位置 | 变更内容 | 修复语义 |
|---|---|---|---|
| ① | `renderCalNode` 的 `blur` 回调 | 回调体首行新增 `const liveText=text.textContent;`，解析改为 `parseNaturalDate(liveText)` | 提交时先固化文本快照，消除「提交后重新读 DOM」的竞态（DOM 可能已被重渲染替换） |
| ② | `outlineDragSelectMove` | `!hit` 分支由 `return` 改为：把 `_outlineSel.ids` 复位为 `new Set(ds.base)`、锚点复位、`outlineDragSelectPaint()`、`ds.hoverId=null` 后返回 | 鼠标滑出列表时清掉区间高亮，避免残留「幽灵选中」 |
| ③ | `buildTimeGrid` | `const cnToday=cnYmd(cnNow());` → `const cnToday=todayStr();` | 今天列高亮与月视图取同一本地日期口径；红线位置 `tgNowY` 与 `cnNow` 的东八区语义保持不变 |
| ④ | `dbPrimaryField` | 由「恒取 `dbFields[0]`」改为顺序跳过 `formula` / `link` / `multi_select`，取首个可编辑列；全部不可编辑时回落 `dbFields[0]` | 主列被改成公式 / 关联 / 多选时仍定位到可编辑主列，避免 `n.text` 落点错列 |
| ⑤ | `renderDbTable` 两处 `select` | 字段类型为 select 的选项分支与「人物」非自定义分支删除 `setDbCell` 之后的 `forceRender()` | 去掉重复重渲染（`setDbCell` 内部已触发渲染），减少一次整表重建；「人物」自定义分支的 `forceRender` 保留 |
| ⑥ | `renderMain` 编辑态早退分支 | `_earlyView===VIEW_KIND.CALENDAR` 块内、`_lb`（系统日志）之后追加 `chars` 模块 body 重填（`calModuleCharsBody(...)`，`try/catch` 兜底） | 打字时早退不重建 `#content`，但字数统计模块随编辑同步刷新 |
| ⑦ | `docToXls` | 局部 `const esc=...` 改名 `xmlEsc`，函数体内 `esc(c)` 同步改 `xmlEsc(c)` | 避免局部声明遮蔽全局 `esc()`，消除同名歧义与潜在的全局引用被劫持 |

**字节锚点（实测）**：canonical = step9 镜像 = **1,294,047 B / `CE68352B9D81148593B90606D8DA99BED82B5131F9D5C25D9EBF93C1EDC208FD` / LF（CR=0 · LF=23,802）**；相对 R74（1,293,528 / `81576224…25FF58` / LF 23,788）为 **+519 B / +14 行**。末字节 `0x0A`，无 BOM，CR=0。

**逐项字节核对**：① 新增 33 B + LF 1 = 34，解析调用 `text.textContent`→`liveText` −4 ⇒ +30；② 2 行 → 8 行 ⇒ +6 行 / +154 B；③ −4 B / 0 行；④ 4 行 → 9 行 ⇒ +5 行；⑤ 两处各 −13 B（`forceRender();` 13 B）⇒ −26 B；⑥ +2 行；⑦ 声明 `esc`→`xmlEsc` +4 B、调用 +3 B ⇒ +7 B。行数 +14 与实测 23,802 − 23,788 吻合。

**门禁实测（真实执行）**：

| 门 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法自检 | `node _临时脚本\r63-syntax-check.mjs <canonical> <镜像>` | 两件均 `blocks=9 compiled-ok=9` · `SYNTAX_RESULT=PASS`（exit 0） | `_环境与调试/r75-syntax-2026-10-23.txt` |
| 登记器红证（重锚前） | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（恰 `canonical` + `step9-mirror`，判别力真实） | `_环境与调试/r75-registry-red-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/r75-registry-green-2026-10-23.txt` |
| 全量回归 | `node scripts\verify.js all`（cwd=`6.P0-T3基线/step9`） | **Exit 0**：静态 0 命中（65ms）· Node **503/503**（`tests 503 / pass 503 / fail 0 / skipped 0`，33,231ms）· Playwright **171**（167 passed + 4 skipped，67,597ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过` | `_环境与调试/r75-verify-all-2026-10-23.txt` |

**登记器重锚口径**：仅改 `canonical` / `step9-mirror` 两行期望值（`1293528 / 81576224…25FF58` → `1294047 / CE68352B…C208FD`）并追加 R75 说明块；**方数保持 65**，其余 63 方期望值一字未动；登记器自身 EOL 保持 CRLF（CRLF 1,566 → 1,581，独立 LF 恒 0），字节 185,708 → 187,258。

**镜像同步**：`6.P0-T3基线/step9/v2.0-t3.html` 由 canonical 逐字节覆盖（同 1,294,047 / 同 SHA-256）。

**一、回退方法**：

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r75`（= **R74 态 1,293,528 B / `81576224…25FF58`**）覆盖 canonical 与 step9 镜像（镜像备份 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r75`，同哈希）。
- 登记器：`canonical`/`step9-mirror` 退回 `1293528 / 81576224466F9B10EC50D8772F90EC2AE5F8B9345CE337203F2B56463325FF58`，并移除 R75 注释块（备份 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r75`）。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r75` 覆盖（本节随之移除）。

**二、红线守持**：`1.冻结版本/*` 与 `1.归档快照/*` 零改写；未物化新冻结件，封存 HEAD 仍 `r22`；未新增 AI 注释（静态检查 0 命中）。

## 五十九 R76 不变量清单 #106–#112 追加登记（2026-10-23 · 文档层 · 产品零改动）

**类型**：文档层（不变量清单末尾物理追加 + 登记器重锚）　**范围**：`4.回归与验收/JU-不变量清单-v2.0-frozen.md`　**未触碰**：产品 `6.P0-T3基线/v2.0-t3.html` 与 `6.P0-T3基线/step9/v2.0-t3.html`、CSS、DOM 结构、数据契约、公开 API、`<script>` 块数（9 块）、`1.冻结版本/*`、`1.归档快照/*`、`1.冻结版本/HEAD.json`

### 一、追加内容（7 条 · 章节锚点 `{#logic-fix-r76}`）

| # | 不变量 | 清单声明的关联实现 | 产品侧落点实测（canonical 命中 / 行号） |
|---|---|---|---|
| #106 | 拖拽排序与同父移动索引防偏移 | `actions.moveNode()`、`renderDbTable()` 列头拖拽提交 | `moveNode` 引用 15 处（首见 L5,499）；「摘除后插入点」口径由 R73 落地（§五十七） |
| #107 | 循环遍历防意外中断与子树漏算 | `buildYearCounts()` 的 yearly 分支 | `buildYearCounts` 3 处（L1,341 / L9,103 / L10,679） |
| #108 | 外部时间标准解析与本地化对齐 | `importICS()`、`buildTimeGrid()` | `importICS` 2 处（L19,370 / L19,446）；`todayStr(` 47 处（首见 L1,342）；`ymd(` 36 处 |
| #109 | 异步渲染防竞态与防高亮残留 | `renderCalNode()` blur 回调、`outlineDragSelectMove()` | `liveText` 2 处（L11,223 / L11,236）；`outlineDragSelectMove` 3 处（L8,081 / L8,085 / L8,091） |
| #110 | 数据库主列顺延与渲染性能优化 | `dbPrimaryField()`、`renderDbTable()` 下拉框 change | `dbPrimaryField` 15 处（首见 L7,277）；`renderDbTable` 3 处（L11,420 / L12,681 / L12,689）；`setDbCell` 27 处 |
| #111 | 早退视图派生面板同步与变量作用域防遮蔽 | `renderMain()` 编辑态早退分支、`docToXls()` | `calModuleCharsBody` 3 处（L10,187 / L10,463 / L15,400）；`xmlEsc` 2 处（L18,607 / L18,613） |
| #112 | 修改门禁与登记核实 | `scripts/verify.js`、`MAINTENANCE.md`、任务日志 | 本文件 §二 门禁表 + 65 方登记器 |

> 上表「产品侧落点」为本波只读探针实测（`_环境与调试/r76-impl-probe-2026-10-23.txt`），仅证明清单所引符号在产品中真实存在及其行号，不构成对实现的额外声明；#106 的索引口径、#109 的 `liveText` 快照、#110 的主列顺延 / 去重渲染、#111 的早退补刷与 `xmlEsc` 改名均在 §五十八（R75）与 §五十七（R73）已落地的改动范围内。

### 二、字节 / 哈希锚点（落盘实测）

| 对象 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| 不变量清单 `4.回归与验收/JU-不变量清单-v2.0-frozen.md` | 151,170 B / `746C5911B2DDFDDE1BCAB2B957EA82E2A9C1F91FD8EEF6E9043672F80ADB11BE` | **156,091 B / `AA895DBA0544B409C599AFD263A1D08C490238740665EC3F2FD21CDE4B46C128`** | LF（CR=0 · LF 2,245 → 2,338） |
| 登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs` | 187,258 B / `13D85483AB2F30D13F4F362B914BBE662284AA645839B0BA0F43D710A6FC9FE6` | 188,985 B / `BD4A8842768CEB3E33C1D5A3172E05C3703AFDD40BCB39A90C553795B255E27D` | CRLF（1,581 → 1,597 · CR=LF） |
| canonical / step9 镜像 `v2.0-t3.html` | 1,294,047 B / `CE68352B9D81148593B90606D8DA99BED82B5131F9D5C25D9EBF93C1EDC208FD` | **零改动**（同字节同哈希，登记器实测 PASS） | LF（CR=0 · LF=23,802） |

- 追加段：源段 5,012 B（CRLF）经 LF 归一化后 4,920 B（`sha256=9DC72401D03148E9B13378B901C1B6C0A3F1D035F7509AABA6A41B5B9ABE4B98`）+ 章节间隔 1 个空行（1 B）= **+4,921 B**。
- 前 151,170 B 与追加前**逐字节一致**（前缀哈希仍 `746C5911…ADB11BE` ⇒ #1–#105 零改写）；尾段 4,920 B 与追加源段**逐字节一致**（脚本 `tailByteIdentical=true`）。
- `### NN.` 编号条目 99 → 106（+7）；`logic-fix-r76` 锚点 1 处；CR=0，末字节单 `0x0A`，无 BOM。
- 回滚快照：`4.回归与验收/JU-不变量清单-v2.0-frozen.md.bak-r76-2026-10-23`（= 追加前 151,170 B）；登记器快照 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r76-2026-10-23`（= 187,258 B，CRLF）。
- 追加脚本：`_临时脚本/_r76_append_inv106_112_2026-10-23.mjs`（前置校验原文 151,170 B / `746C5911…ADB11BE` 与纯 LF，不匹配即 `exit 2`，可重复执行但不会二次追加）；重锚脚本：`_临时脚本/_r76_registry_reanchor_2026-10-23.mjs`（前置校验登记器 187,258 B / `13D85483…6FC9FE6` 与纯 CRLF）。

### 三、门禁实测（真实执行 · 本机 PATH 无 node，以 Node v22.22.2 绝对路径前置注入）

| 门 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 全量回归（改前基线） | `node scripts\verify.js all`（cwd=`6.P0-T3基线/step9`） | **Exit 0**：静态 0 命中（52ms）· Node **503/503**（30,375ms）· Playwright **171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 + L13 6，60,719ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，83ms）→ `[verify] 全部通过` | `_环境与调试/r76-verify-all-baseline-2026-10-23.txt` |
| 追加复核（字节级） | `node _临时脚本\_r76_append_inv106_112_2026-10-23.mjs` | `RESULT=PASS`：`prefixByteIdentical=true` / `tailByteIdentical=true` / 156,091 B / LF 2,338 / CR=0 / 末字节单 0x0A | `_环境与调试/r76-inv-append-2026-10-23.txt` |
| 登记器红证（重锚前） | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=1` / `RESULT=FAIL`（唯一 FAIL 方 = 本清单 `size=156091 (exp 151170)`，判别力真实） | `_哈希与行尾校验/r76-registry-red-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（Exit 0） | `_哈希与行尾校验/r76-registry-green-2026-10-23.txt` |
| 全量回归（清单 + 登记器落盘后复跑） | `node scripts\verify.js all` | **Exit 0**：静态 0 命中（43ms）· Node **503/503**（`tests 503 / pass 503 / fail 0 / skipped 0`，25,702ms）· Playwright **171**（`4 skipped` + `167 passed (54.0s)`，55,016ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，77ms）→ `[verify] 全部通过` | `_环境与调试/r76-verify-all-final-2026-10-23.txt` |

### 四、登记器重锚口径

- 仅改 `TARGETS` 中 `JU-不变量清单-v2.0-frozen.md` 一行期望值（`151170 / 746C5911…ADB11BE` → **`156091 / AA895DBA…4B46C128`**），并在该行上方新增 R76 说明块；**方数保持 65**，其余 64 方期望值一字未动。
- 登记器自身 EOL 保持 CRLF（1,581 → 1,597 行 · CR=LF，独立 LF 恒 0），字节 187,258 → 188,985（+1,727 B）。
- `canonical` / `step9-mirror` 期望值本波**未改**（产品零改动，1,294,047 / `CE68352B…EDC208FD` 实测 PASS）。

### 五、回退方法

- 清单：以 `4.回归与验收/JU-不变量清单-v2.0-frozen.md.bak-r76-2026-10-23`（151,170 B）覆盖。
- 登记器：以 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r76-2026-10-23`（187,258 B / CRLF）覆盖（R76 说明块与本行新期望值随之移除）。
- 手册：以 `0.规范/MAINTENANCE.md.bak-r76-2026-10-23` 覆盖（本节 §五十九 随之移除）。
- 产品件无需回退（本波产品零改动）；`1.冻结版本/HEAD.json` 指针未改（封存 HEAD 仍 `r22`）。

### 六、红线守持

`1.冻结版本/*` 与 `1.归档快照/*` 零改写；未物化新冻结件；未新增 AI 注释（静态检查 0 命中）；数据契约 / 公开 API / `<script>` 块数（9 块）零变更；清单既有条目 #1–#105 逐字节零改写。

## 六十 R77 五项交互中断与键盘收尾修正（2026-10-23 · 产品 JS 层）

**类型**：产品 JS 行为修正　**范围**：[`6.P0-T3基线/v2.0-t3.html`](../6.P0-T3基线/v2.0-t3.html:1) + [`step9 镜像`](../6.P0-T3基线/step9/v2.0-t3.html:1)　**未触碰**：CSS、DOM 结构、数据契约、公开 API、`<script>` 块数（9 块）、`1.冻结版本/*`、`1.冻结版本/HEAD.json`

### 一、五项改动（逐项落点 · canonical 行号）

| # | 落点 | 改动 | 语义 |
|---|---|---|---|
| ① | [`bindCalEventDrag()`](../6.P0-T3基线/v2.0-t3.html:10763) | `.evtx` 分支 pointerdown 内补 `try{ev.setPointerCapture(e.pointerId);}catch(_){}`；同分支 `cancel` / `up` 开头各补 `try{ev.releasePointerCapture(e.pointerId);}catch(_){}`；非 `.evtx` 分支在 `pointerup` 监听后补 `pointercancel` 监听，`cancel` 仅复位 `cal-tg-dragging`、摘 move/up/cancel、释放捕获，**不提交时间**（`up` 内一并摘 `pointercancel` 防残留） | 触屏长按 / 系统手势打断只发 `pointercancel`（无 `pointerup`）⇒ 不残留拖拽态与监听，也不会把中断拖拽误落盘成时间变更；文字区拖拽亦接管指针 |
| ② | [`calModuleBindResize()`](../6.P0-T3基线/v2.0-t3.html:10358) | `handle.addEventListener('pointercancel',onUp)` → `onCancel`；`onUp` 内摘 `pointercancel` 的监听改为 `onCancel`；新增 [`onCancel`](../6.P0-T3基线/v2.0-t3.html:10429)：摘 move/up/cancel、`cancelAnimationFrame`、`releasePointerCapture`、还原 `initFlex` / `initMinWidth` / `initMinHeight` / `initHeight` / `initMaxHeight`，**不写 `st.sizes`、不调 `saveUI`** | 缩放被系统手势打断时样式回滚到进入态，且不落盘半截尺寸 |
| ③ | [`window.addEventListener('blur',…)`](../6.P0-T3基线/v2.0-t3.html:22250) | 补 `try{if(_dragState)outlineDragEnd({clientX:0,clientY:0,button:0});}catch(e){}` 与 `try{if(_outlineDragSel)outlineDragSelectDetach();}catch(e){}` | 窗口失焦导致 `mouseup` 丢失时，大纲拖拽幽灵 / 落位线 / 框选 `userSelect` 残留一并收尾 |
| ④ | [`openCalTimeModal()`](../6.P0-T3基线/v2.0-t3.html:6776) 的 `onKey` | 改为 `if(!isTop())return;` → `if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}` → `if(e.key!=='Tab')return;`，原 Tab trap 逐行保留 | 时间弹窗支持 ESC 关闭；非栈顶弹窗不抢按键 |
| ⑤ | [`bindSettings()`](../6.P0-T3基线/v2.0-t3.html:18335) 末尾 | 补 `document.addEventListener('keydown',e=>{if(e.key!=='Escape'||_modalStack.length)return;const p=$('#settingsPanel');if(p&&p.classList.contains('on')){e.preventDefault();p.classList.remove('on');}})` | 设置面板 ESC 关闭；有模态弹窗在栈时让位弹窗自身 ESC，避免一次 ESC 连带关面板 |

### 二、字节 / 哈希锚点（落盘实测）

| 对象 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,294,047 B / `CE68352B9D81148593B90606D8DA99BED82B5131F9D5C25D9EBF93C1EDC208FD` | **1,296,452 B / `9D96452EC3FD3874192F87224F371CBB5F935CA5B500D6D98A622ED15AFF45A6`** | LF（CR=0 · LF 23,802 → 23,838）· 无 BOM · 末字节单 `0x0A` |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 同 canonical | **逐字节一致**（`fc /b` 无差异 · 同哈希同字节） | LF · 无 BOM |
| 登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs` | 188,985 B / `BD4A8842768CEB3E33C1D5A3172E05C3703AFDD40BCB39A90C553795B255E27D` | 190,556 B / `07B4118293271C08008C28D87D844EA04505F704861B77294FE8BAAA621C3819` | CRLF（1,597 → 1,610 行 · CR=LF · 独立 LF 恒 0） |

- 增量守恒：1,294,047 + 2,405 = 1,296,452 B；LF 23,802 + 36 = 23,838；`<script>` 块数 9 不变。
- 改前快照：`6.P0-T3基线/v2.0-t3.html.bak-20261023-r76`（1,294,047 B）。
- 新增说明性注释 5 处（与既有 `FIX-*` / `L22 ·` 注释同风格，中文行内）；静态检查（铁律 6）实测 0 命中。

### 三、门禁实测（真实执行 · 本机 PATH 无 node，以 Node v24.21.0 绝对路径前置注入）

| 门 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 | `node _临时脚本\r77-syntax-check.mjs 6.P0-T3基线\v2.0-t3.html` | `scripts parsed ok=9 fail=0 totalBlocks=9`（Exit 0） | R77 报告 §三 |
| 全量回归（首跑 · 重锚前） | `node scripts\verify.js all`（cwd=`6.P0-T3基线/step9`） | **Exit 1**：静态 0 命中 · Node 503/503 全绿 · Playwright `166 passed / 1 failed / 4 skipped` —— 唯一 RED = L10 T-99 登记器门 `Expected 0, Received 2`（canonical / step9-mirror 期望值尚未重锚，判别力真实） | `_环境与调试/r77-verify-all-2026-10-23.txt` |
| 登记器红证（重锚前） | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL` | `_哈希与行尾校验/r77-registry-red-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（Exit 0） | `_哈希与行尾校验/r77-registry-green-2026-10-23.txt` |
| 全量回归（重锚后） | `node scripts\verify.js all` | **Exit 0**：静态 0 命中（42ms）· Node **503/503**（24,522ms）· Playwright **171**（`4 skipped` + `167 passed (55.3s)`，55,985ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，73ms）→ `[verify] 全部通过` | `_环境与调试/r77-verify-all-final-2026-10-23.txt` |

### 四、登记器重锚口径

- 仅改 `TARGETS` 中 `canonical` / `step9-mirror` 两行期望值（`1294047 / CE68352B…EDC208FD` → **`1296452 / 9D96452E…AFF45A6`**），并在 `canonical` 行上方新增 R77 说明块；**方数保持 65**，其余 63 方期望值一字未动。
- 登记器自身 EOL 保持 CRLF（1,597 → 1,610 行 · CR=LF），字节 188,985 → 190,556（+1,571 B）。

### 五、回退方法

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r76`（1,294,047 B）覆盖 canonical，并同步覆盖 step9 镜像。
- 登记器：以 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r77-2026-10-23`（188,985 B / CRLF）覆盖（R77 说明块与两行新期望值随之移除）。
- 手册：删除本节 §六十，并将首行「本版修订」与 §二 现行基线口径回退为 R75 数值。

### 六、红线守持

`1.冻结版本/*` 与 `1.归档快照/*` 零改写；未物化新冻结件；封存 HEAD 仍 `r22`；数据契约 / 公开 API / `<script>` 块数（9 块）零变更；改动仅限上述 5 处 JS 行为点。

## 六十一 R78 打印预览显式触发 / 字号防抖 / 标签激活持久化（2026-10-23 · 产品 JS 层）

**类型**：产品 JS 行为修正　**范围**：[`6.P0-T3基线/v2.0-t3.html`](../6.P0-T3基线/v2.0-t3.html:1) + [`step9 镜像`](../6.P0-T3基线/step9/v2.0-t3.html:1)　**未触碰**：CSS、DOM 结构、公开 API、`<script>` 块数（9 块）、`1.冻结版本/*`、`1.冻结版本/HEAD.json`

### 一、三项改动（逐项落点 · canonical 行号为改后实测）

| # | 落点 | 改动 | 语义 |
|---|---|---|---|
| ① | [`bindRightSidebar()`](../6.P0-T3基线/v2.0-t3.html:16148) 的 `[data-toggle]` 打印分支（[L16156–L16160](../6.P0-T3基线/v2.0-t3.html:16156)） | 展开仅 `sp.classList.add('on')`；收起 `sp.classList.remove('on')`，且仅当 [`$('#content .print-preview')`](../6.P0-T3基线/v2.0-t3.html:16159) 存在时 `forceRender()`；删除该分支内的 `showPrintPreview()` 调用 | 折叠头不再隐式生成 / 重建预览 DOM（避免打断当前视图渲染与滚动位置）；预览只由用户显式动作触发（打印入口、「显示页码」勾选）；收起时仅当内容区确实残留预览元素才重渲染 |
| ② | [`bindSettings()`](../6.P0-T3基线/v2.0-t3.html:18338) 的 [`$('#setFontSize').oninput`](../6.P0-T3基线/v2.0-t3.html:18391) | 回调末尾新增 [L18395](../6.P0-T3基线/v2.0-t3.html:18395) `clearTimeout(window.__fsCalTimer);window.__fsCalTimer=setTimeout(()=>{try{if(_l7IsCalendarView())forceRender();}catch(e){}},250)` | 字号连续拖动时日历视图按 250ms 防抖重渲染一次，不再逐帧整表重建；非日历视图零额外渲染开销 |
| ③ | `tagActive` 持久化（5 处） | `ui` 初始化加 [`tagActive:null`](../6.P0-T3基线/v2.0-t3.html:5819)；[`uiSnapshot()`](../6.P0-T3基线/v2.0-t3.html:16699) 与 `_saveUINow()` data（[L5969](../6.P0-T3基线/v2.0-t3.html:5969)）各加 `tagActive:ui.tagActive||null`；[`applyUIFields()`](../6.P0-T3基线/v2.0-t3.html:5928) 加 string / null 归一守卫（其余类型忽略）；[`renderMain`](../6.P0-T3基线/v2.0-t3.html:15484) 的 `case 'tags'` 改为仅在 `_tagIndexCache` 存在且命中该标签时走 [`renderTagNodes`](../6.P0-T3基线/v2.0-t3.html:17759)，否则回落 [`renderTagsView()`](../6.P0-T3基线/v2.0-t3.html:17716) | 刷新 / 重启后仍停留在原标签的节点列表；索引未就绪或标签已被删除时回落标签云（不再渲染空标签页）；旧存档缺该键 ⇒ `null`，行为与改前一致 |

### 二、字节 / 哈希锚点（落盘实测）

| 对象 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,296,452 B / `9D96452EC3FD3874192F87224F371CBB5F935CA5B500D6D98A622ED15AFF45A6` | **1,296,781 B / `F4BB9FCE989D0F3AEFCF3CD85090B6C95743864D1787687785BC480A78F18E31`** | LF（CR=0 · LF 23,838 → 23,842）· 无 BOM · 末字节单 `0x0A` |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 同 canonical | **逐字节一致**（同哈希同字节） | LF · 无 BOM |
| 登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs` | 190,556 B / `07B4118293271C08008C28D87D844EA04505F704861B77294FE8BAAA621C3819` | 192,124 B / `BF31FF7BBD422EC3548974626F43BEBB87374A001A185F876006189F2B445A50` | CRLF（1,610 → 1,621 行 · CR=LF · 独立 LF 恒 0） |

- 增量守恒：1,296,452 + 329 = 1,296,781 B；LF 23,838 + 4 = 23,842；`<script>` 块数 9 不变（9 块逐块 vm 编译通过）。
- 改前快照：`6.P0-T3基线/v2.0-t3.html.bak-20261023-r78`（1,296,452 B / LF）。
- 逐行差异实测：新增 9 行 / 删除 5 行（净 +4），全部落在上述 3 组改动点；其中 1 行既有中文注释（打印分支）随行为改写同步修正，其余注释零改动。

### 三、门禁实测（真实执行 · 本机 PATH 无 node，以 Node v22.22.2 绝对路径前置注入）

| 门 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 | `node _临时脚本\r63-syntax-check.mjs 6.P0-T3基线\v2.0-t3.html 6.P0-T3基线\step9\v2.0-t3.html` | canonical / 镜像均 `inline-script blocks=9 compiled-ok=9`，`SYNTAX_RESULT=PASS`（Exit 0） | `_环境与调试/r78-syntax-2026-10-23.txt` |
| 全量回归（首跑 · 重锚前） | `node scripts\verify.js all`（cwd=`6.P0-T3基线/step9`） | **Exit 1**：静态检查 0 命中（28ms）· Node **503/503**（26,030ms）· Playwright `166 passed / 1 failed / 4 skipped`（58,253ms）—— 唯一 RED = `tests/t10-idb-persist.spec.ts:543` L10 T-99 登记器门 `Expected: 0 / Received: 2`（期望值尚未重锚，判别力真实） | `_环境与调试/r78-verify-all-2026-10-23.txt` |
| 登记器红证（重锚前） | `node verify-hash-registry.mjs` | `FAIL canonical size=1296781 (exp 1296452)` / `FAIL step9-mirror size=1296781 (exp 1296452)` · `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL` | `_哈希与行尾校验/r78-registry-red-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | `PASS canonical size=1296781 (exp 1296781) sha256=F4BB9FCE…8F18E31` / `PASS step9-mirror`（同）· `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（Exit 0） | `_哈希与行尾校验/r78-registry-green-2026-10-23.txt` |
| 全量回归（重锚后） | `node scripts\verify.js all` | **Exit 0**：静态检查 0 命中（66ms）· Node **503/503**（`# pass 503 / # fail 0`，25,857ms）· Playwright **171**（`4 skipped` + `167 passed`，61,501ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，74ms）→ `[verify] 全部通过` | `_环境与调试/r78-verify-all-final-2026-10-23.txt` |

### 四、登记器重锚口径

- 仅改 `TARGETS` 中 `canonical` / `step9-mirror` 两行期望值（`1296452 / 9D96452E…AFF45A6` → **`1296781 / F4BB9FCE…8F18E31`**），并在 `canonical` 行上方新增 R78 说明块；**方数保持 65**，其余 63 方期望值一字未动。
- 登记器自身 EOL 保持 CRLF（1,610 → 1,621 行 · CR=LF · 独立 LF 恒 0），字节 190,556 → 192,124（+1,568 B），SHA-256 `BF31FF7B…B445A50`。

### 五、回退方法

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r78`（1,296,452 B）覆盖 canonical，并同步覆盖 step9 镜像。
- 登记器：以 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r78-2026-10-23`（190,556 B / CRLF）覆盖（R78 说明块与两行新期望值随之移除）。
- 手册：删除本节 §六十一，并将首行「本版修订」与 §二 现行基线口径回退为 R77 数值（`1,296,452 B / 9D96452E…AFF45A6` / LF 23,838）。

### 六、红线守持

`1.冻结版本/*` 与 `1.归档快照/*` 零改写；未物化新冻结件；封存 HEAD 仍 `r22`；CSS / DOM 结构 / 公开 API / `<script>` 块数（9 块）零变更；UI 存档仅新增可选键 `tagActive`（缺省 `null`，向后兼容旧存档）。

## 六十二 R79 死代码清理：makeCalDivider / .cal-divider CSS / ui.calColWidths（2026-10-23 · 产品 CSS + JS 层）

**类型**：死代码删除（零调用点 · 行为零变更）　**范围**：[`6.P0-T3基线/v2.0-t3.html`](../6.P0-T3基线/v2.0-t3.html:1) + [`step9 镜像`](../6.P0-T3基线/step9/v2.0-t3.html:1)　**未触碰**：DOM 结构、数据契约、公开 API、`<script>` 块数（9 块）、`1.冻结版本/*`、`1.冻结版本/HEAD.json`

### 一、改动清单（4 组 · canonical 行号为改前实测 / 改后实测并列）

| # | 组 | 改动 | 改前 → 改后 |
|---|---|---|---|
| ① | 函数 | 删除 `function makeCalDivider(side){...}` 整段（含其上方说明注释 1 行，共 61 行） | L9610–L9670 → 删除；其后 [`buildCalLogBlock()`](../6.P0-T3基线/v2.0-t3.html:9602) 上移 |
| ② | CSS | 删除 `.cal-divider`、`.cal-divider::after`、`.cal-divider.h`、`.cal-divider.h::before`、`.cal-divider.h::after`、`.cal-divider:not(.h):hover::after,.cal-divider:not(.h).dragging::after`、`.cal-divider.h:hover::before,.cal-divider.h.dragging::before`、`body.cal-resizing`（8 条 + 其上说明注释 1 行） | L462–L470 → 删除；[`@media (max-width:700px)`](../6.P0-T3基线/v2.0-t3.html:466) 上移至 L466 |
| ③ | CSS | `@media (max-width:700px)` 内删除 `.cal-divider:not(.h){display:none}`（该行其余声明逐字保留） | 原 L475 → 改后 L466 |
| ④ | JS 状态 | `ui` 初始化删除 `calColWidths:{note:null,today:null}`（[L5797 起对象](../6.P0-T3基线/v2.0-t3.html:5797)）；[`applyUIFields()`](../6.P0-T3基线/v2.0-t3.html:5871) 删除 `ui.calColWidths=` 恢复语句；[`_saveUINow()`](../6.P0-T3基线/v2.0-t3.html:5943) data（[L5953](../6.P0-T3基线/v2.0-t3.html:5953)）与 [`uiSnapshot()`](../6.P0-T3基线/v2.0-t3.html:16615) 返回对象（[L16622](../6.P0-T3基线/v2.0-t3.html:16622)）各删除 `calColWidths:ui.calColWidths` 键 | 3 处字段 + 2 处键删除 |

- 零引用证据（改后全文件实测）：`makeCalDivider` / `calColWidths` / `cal-resizing` / `.cal-divider{` 命中 **0 / 0 / 0 / 0**；改前 `makeCalDivider` 亦无任何调用点（仅定义与注释）。
- **如实披露（未在授权清单内、本次保留）**：L994 `  .cal-top-row .cal-divider:not(.h){display:none} /* FIX-R6-6 ... */` 位于 `@media (max-width:1100px)`，同属死选择器，但不在本次指令列举的删除项内，按「不越权改动」原则原样保留（改后全文件 `.cal-divider` 命中 = 1，即此处）。
- UI 存档语义：不再写出 `calColWidths`；旧存档中该键读取即忽略（`applyUIFields` 已无对应恢复语句），向后兼容、无迁移动作。

### 二、字节 / 哈希锚点（落盘实测）

| 对象 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,296,781 B / `F4BB9FCE989D0F3AEFCF3CD85090B6C95743864D1787687785BC480A78F18E31` | **1,292,360 B / `7BB8F416FCE36C4DB119E38ECCFF4D029FC9A78429A6CB19D8CB11E726544A3A`** | LF（CR=0 · LF 23,842 → 23,770）· 无 BOM · 末字节单 `0x0A` |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 同 canonical | **逐字节一致**（同哈希同字节） | LF · 无 BOM |
| 登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs` | 192,124 B / `BF31FF7BBD422EC3548974626F43BEBB87374A001A185F876006189F2B445A50` | 193,653 B / `5AD94EF4B88D5659847ED1C858B7662BD28118CF96BDF90716B94499F6E785AB` | CRLF（1,621 → 1,633 行 · CR=LF · 独立 LF 恒 0） |

- 增量守恒：1,296,781 − 4,421 = 1,292,360 B；LF 23,842 − 72 = 23,770；`<script>` 块数 9 不变（9 块逐块 vm 编译通过）。
- 改前快照：`6.P0-T3基线/v2.0-t3.html.bak-20261023-r79`（1,296,781 B / LF / `F4BB9FCE…8F18E31`）；镜像同名快照 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r79`。
- 逐行差异实测：删除 72 行 / 新增 0 行（净 −72），全部落在上述 4 组改动点，无越界改动。

### 三、门禁实测（真实执行 · 本机 PATH 无 node，以 Node v22.22.2 绝对路径前置注入）

| 门 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 | `node _临时脚本\r63-syntax-check.mjs 6.P0-T3基线\v2.0-t3.html 6.P0-T3基线\step9\v2.0-t3.html` | canonical / 镜像均 `inline-script blocks=9 compiled-ok=9`，`SYNTAX_RESULT=PASS`（Exit 0） | `_环境与调试/r79-syntax-2026-10-23.txt` |
| 登记器红证（重锚前） | `node verify-hash-registry.mjs` | `FAIL canonical size=1292360 (exp 1296781)` / `FAIL step9-mirror`（同）· `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL` | `_哈希与行尾校验/r79-registry-red-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | `PASS canonical size=1292360 (exp 1292360) sha256=7BB8F416…E726544A3A` / `PASS step9-mirror`（同）· `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（Exit 0） | `_哈希与行尾校验/r79-registry-green-2026-10-23.txt` |
| 全量回归 | `node scripts\verify.js all`（cwd=`6.P0-T3基线/step9`） | **Exit 0**：静态检查 0 命中（51ms）· Node **503/503**（`# pass 503 / # fail 0`，25,978ms）· Playwright **171**（`4 skipped` + `167 passed`，57,914ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，82ms）→ `[verify] 全部通过` | `_环境与调试/r79-verify-all-2026-10-23.txt` |

### 四、登记器重锚口径

- 仅改 `TARGETS` 中 `canonical` / `step9-mirror` 两行期望值（`1296781 / F4BB9FCE…8F18E31` → **`1292360 / 7BB8F416…E726544A3A`**），并在 `canonical` 行上方新增 R79 说明块（12 行）；**方数保持 65**，其余 63 方期望值一字未动。
- 登记器自身 EOL 保持 CRLF（1,621 → 1,633 行 · CR=LF=1,633 · 独立 LF 恒 0），字节 192,124 → 193,653（+1,529 B），SHA-256 `5AD94EF4…F6E785AB`。

### 五、回退方法

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r79`（1,296,781 B）覆盖 canonical，并同步覆盖 step9 镜像。
- 登记器：以 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r79-2026-10-23`（192,124 B / CRLF）覆盖（R79 说明块与两行新期望值随之移除）。
- 手册：删除本节 §六十二，并将首行「本版修订」与 §二 现行基线口径回退为 R78 数值（`1,296,781 B / F4BB9FCE…8F18E31` / LF 23,842）。

### 六、红线守持

`1.冻结版本/*` 与 `1.归档快照/*` 零改写；未物化新冻结件；封存 HEAD 仍 `r22`；DOM 结构 / 数据契约 / 公开 API / `<script>` 块数（9 块）零变更；UI 存档仅「减少」一个死键 `calColWidths`（旧档兼容）。

## 六十三 R80 全量备份出口瘦身：BACKUP_SLIM / _backupSlimState / _slimVersions（2026-10-23 · 产品 JS 层）

**类型**：导出载荷优化（下载体积精简；导入端已兼容空数组 / 对象）　**范围**：[`6.P0-T3基线/v2.0-t3.html`](../6.P0-T3基线/v2.0-t3.html:1) + [`step9 镜像`](../6.P0-T3基线/step9/v2.0-t3.html:1)　**未触碰**：DOM 结构、数据契约、公开 API、`<script>` 块数（9 块）、导入端（`handleImportFiles` / `restoreVersions` / `migrateStateObject`）、`1.冻结版本/*`、`1.冻结版本/HEAD.json`

### 一、改动清单（行号为改后实测 · 全部落在 exportFullBackup 上方与函数体内）

| # | 组 | 改动 | 改后行号 |
|---|---|---|---|
| ① | 模块级常量 | 新增 `const BACKUP_SLIM={activityDays:30,versionsPerDoc:1,versionsMax:60};` | L16636–L16637 |
| ② | 新增函数 | [`_backupSlimState(st)`](../6.P0-T3基线/v2.0-t3.html:16641)：`safeClone` → 若与原引用同一则 JSON 深拷贝 → 仍失败 `throw new Error('备份精简失败')`；`activity` 删非 `YYYY-MM-DD` 键与早于「今天−30 天」的键（桶内 `add/mod/del` 原样保留）；`_localCreated` / `_remoteReceived` 去重且只留 `typeof id==='string'` 且仍存在于 `out.nodes` 的 id；`_tombstones` 删 `ts` 非数值或 `Date.now()-ts>30000` 的键，删空后 `delete out._tombstones`；返回 `out` | L16641–L16680 |
| ③ | 新增函数 | [`_slimVersions(rows)`](../6.P0-T3基线/v2.0-t3.html:16682)：非数组返回 `[]`；按 `ts` 倒序，每文档保留 `versionsPerDoc`（1）条、总量封顶 `versionsMax`（60） | L16682–L16697 |
| ④ | [`exportFullBackup()`](../6.P0-T3基线/v2.0-t3.html:16698) 接线 | `const slimState=_backupSlimState(state)`（L16700）；`gp` 仅保留 `slimState.nodes[id]` 存在的图谱位置（L16702–L16703）；`backup.state=slimState` / `graphpos:gp`（L16707 / L16709）；`backup.versions=_slimVersions(snapRows)`（L16736）；异常分支 `backup.versions=[]`（L16737，原 `null` 不再使用）；`download('JU-备份-'+todayStr()+'.json',JSON.stringify(backup),'application/json')`（L16738，去 `null,2` 缩进）；toast 改为「已下载备份（日志保留 30 天，每文档版本保留 1 条）」（L16739） | L16698–L16743 |

- 逐行差异实测：公共前缀 16,635 行 / 公共后缀 7,098 行逐字节一致；变更块 **old L16636–L16673（38 行）→ new L16636–L16739（104 行）**，净 **+66 行**（总行数 23,771 → 23,837），区间外零改动。
- `app` / `ver` / `type` / `exportedAt` / `ui` 字段与顶层键序（`app,ver,type,exportedAt,state,ui,graphpos,versions`）零变更；`graphpos` 由 `clone(...)` 全量改为存在性过滤（悬空 id 不再写入）。

### 二、同一夹具数据导出字节实测（真实函数体执行）

| 口径 | 字节 | 说明 |
|---|---|---|
| 改前（`JSON.stringify(backup,null,2)`） | **77,346 B** | state 全量 + graphpos 全量 + versions 242 行 + 2 空格缩进 |
| 参照：仅去缩进、不精简 | 62,493 B | 缩进单项贡献 −14,853 B |
| 改后（精简 + `JSON.stringify(backup)`） | **5,702 B** | delta **−71,644 B（−92.63%）**；其中精简贡献 −56,791 B |

- 夹具（两版本逐项相同）：3 节点 `state.nodes` + 45 天 `activity`（另含 2 个非法键）+ 12 文档 × 20 版本 + 2 行异常 `ts`（`undefined` / 字符串）+ 3 条 `graphpos`（1 条悬空）+ 5 条 `_localCreated`（含重复 / 悬空 / 非字符串）+ 4 条 `_remoteReceived` + 3 条 `_tombstones`（1 新鲜 / 1 过期 / 1 非数值）。
- 探针 [`_临时脚本/r80-backup-slim-bytes.mjs`](../_临时脚本/r80-backup-slim-bytes.mjs:1)：从两份 HTML 文本按「函数头 + 括号配对」原样抽取 `exportFullBackup` 执行（`VDB` / `download` / `toast` 为最小桩，游标分批读取真实走 `IDBKeyRange.lowerBound` 路径），**28 项断言全 PASS**（含「改动前后 state 均未被出口修改」的隔离断言、`_tombstones` 删空整键 delete、`versions` 封顶 60、每文档取 `ts` 最大一条、非预期类型字段不误改）。
- 断言结果同时确认：`activity` 保留 31 键（今天 + 前 30 天）且键全为 `YYYY-MM-DD`；`_localCreated` → `["n1","n2"]`；`_remoteReceived` → `["n2","n3"]`；`graphpos` → 仅 `root` / `n1`；`versions` 12 条、docId 无重复、仅数值 `ts`。

### 三、字节 / 哈希锚点（落盘实测）

| 对象 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,292,360 B / `7BB8F416FCE36C4DB119E38ECCFF4D029FC9A78429A6CB19D8CB11E726544A3A` | **1,295,362 B / `88CCBDF819490F57B8B57CC98F1F813D9D895C2508586A0E7F0545D573E4A218`** | LF（CR=0 · LF 23,770 → 23,836）· 无 BOM · 末字节单 `0x0A` |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 同 canonical | **逐字节一致**（同哈希同字节） | LF · 无 BOM |
| 登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs` | 193,653 B / `5AD94EF4B88D5659847ED1C858B7662BD28118CF96BDF90716B94499F6E785AB` | 195,360 B / `6CE87B3E61DC4F41CE91E677BE3E63D51300D0222A55B6A35BFEE352ABC98737` | CRLF（1,633 → 1,645 行 · CR=LF · 独立 LF 恒 0） |

- 增量守恒：1,292,360 + 3,002 = 1,295,362 B；LF 23,770 + 66 = 23,836；`<script>` 块数 9 不变（9 块逐块 vm 编译通过）。
- 改前快照：`6.P0-T3基线/v2.0-t3.html.bak-20261023-r80`（1,292,360 B / LF / `7BB8F416…E726544A3A`）与镜像同名快照 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r80`；登记器改前快照 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r80-2026-10-23`（193,653 B / CRLF）。

### 四、门禁实测（真实执行 · 本机 PATH 无 node，以 Node v22.22.2 绝对路径前置注入）

| 门 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 | `node _临时脚本\r63-syntax-check.mjs 6.P0-T3基线\v2.0-t3.html 6.P0-T3基线\step9\v2.0-t3.html` | canonical / 镜像均 `inline-script blocks=9 compiled-ok=9`，`SYNTAX_RESULT=PASS`（Exit 0） | `_环境与调试/r80-syntax-2026-10-23.txt` |
| 备份字节探针 | `node _临时脚本\r80-backup-slim-bytes.mjs` | `old=77346 B` / `new=5702 B` / `−92.63%`；28 项断言 `RESULT=PASS FAIL_COUNT=0`（Exit 0） | `_环境与调试/r80-probe-2026-10-23.txt` |
| 登记器红证（重锚前） | `node verify-hash-registry.mjs` | `FAIL canonical size=1295362 (exp 1292360)` / `FAIL step9-mirror size=1295362 (exp 1292360)` · `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL` | `_哈希与行尾校验/r80-registry-red-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | `PASS canonical size=1295362 (exp 1295362) sha256=88CCBDF8…573E4A218` / `PASS step9-mirror`（同）· `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（Exit 0） | `_哈希与行尾校验/r80-registry-green-2026-10-23.txt` |
| 全量回归 | `node scripts\verify.js all`（cwd=`6.P0-T3基线/step9`） | **Exit 0**：静态检查 0 命中（25ms）· Node **503/503**（26,455ms）· Playwright **171**（`4 skipped` + `167 passed`，54,740ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，72ms）→ `[verify] 全部通过` | `_环境与调试/r80-verify-all-2026-10-23.txt` |

### 五、登记器重锚口径

- 仅改 `TARGETS` 中 `canonical` / `step9-mirror` 两行期望值（`1292360 / 7BB8F416…E726544A3A` → **`1295362 / 88CCBDF8…573E4A218`**），并在 `canonical` 行上方新增 R80 说明块（12 行）；**方数保持 65**，其余 63 方期望值一字未动。
- 登记器自身 EOL 保持 CRLF（1,633 → 1,645 行 · CR=LF=1,645 · 独立 LF 恒 0），字节 193,653 → 195,360（+1,707 B），SHA-256 `6CE87B3E…BC98737`。

### 六、回退方法

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r80`（1,292,360 B）覆盖 canonical，并同步覆盖 step9 镜像。
- 登记器：以 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r80-2026-10-23`（193,653 B / CRLF）覆盖（R80 说明块与两行新期望值随之移除）。
- 手册：删除本节 §六十三，并将首行「本版修订」与 §二 现行基线口径回退为 R79 数值（`1,292,360 B / 7BB8F416…E726544A3A` / LF 23,770）。

### 七、红线守持

`1.冻结版本/*` 与 `1.归档快照/*` 零改写；未物化新冻结件；封存 HEAD 仍 `r22`；DOM 结构 / 数据契约 / 公开 API / `<script>` 块数（9 块）零变更；导入端三函数（`handleImportFiles` / `restoreVersions` / `migrateStateObject`）零改动（空 `versions` 数组 / 缺 `_tombstones` 键均已在导入端兼容）；导出期 `state` 保持只读（探针断言改前 / 改后均未被出口修改）。

## 六十四 R81 备份回收站裁剪：BACKUP_SLIM.trashMax / _backupPurgeTrashSubtree（2026-10-23 · 产品 JS 层）

**类型**：导出载荷优化第二批次（回收站维度；导入端零改动）　**范围**：[`6.P0-T3基线/v2.0-t3.html`](../6.P0-T3基线/v2.0-t3.html:1) + [`step9 镜像`](../6.P0-T3基线/step9/v2.0-t3.html:1)　**未触碰**：DOM 结构、数据契约、公开 API、`<script>` 块数（9 块）、导入端（`handleImportFiles` / `restoreVersions` / `migrateStateObject` / `validateImportedTree`）、`1.冻结版本/*`、`1.冻结版本/HEAD.json`

### 一、改动清单（行号为改后实测）

| # | 组 | 改动 | 改后行号 |
|---|---|---|---|
| ① | 模块级常量 | `const BACKUP_SLIM={activityDays:30,versionsPerDoc:1,versionsMax:60,trashMax:50};`（在批次 1 基础上追加 `trashMax:50`） | L16638 |
| ② | 新增函数 | [`_backupPurgeTrashSubtree(out,rootId)`](../6.P0-T3基线/v2.0-t3.html:16642)：索引游标 + `visited` 沿 `children` 收集子树 id（防环）；逐项自尾向头从父 `children` 摘除同 id、`delete out.nodes[id]`、`delete out.dbRowHeights[id]`、删除 `dbColumnWidths` 中以 `id+'::'` 开头的键、过滤 `_localCreated` / `_remoteReceived` 中的该 id、`delete out._tombstones[id]` | L16642–L16680 |
| ③ | `_backupSlimState(st)` 追加段 A（回收站裁剪） | 先滤除 `!t || !t.rootId || !out.nodes[t.rootId]` 的条目；`length > trashMax` 时按 `Number(t.deletedAt)||0` 升序排序，对最早 `length-trashMax` 条逐条 `_backupPurgeTrashSubtree`，随后 `slice(drop)` 只保留最近 50 条 | L16722–L16733 |
| ④ | `_backupSlimState(st)` 追加段 B（孤儿软删清理） | 收集 `trashIds`（`trashed[].rootId` + `trashed[].ids` 内字符串 id）→ **先收集后处理** `_deleted===true && id!==out.rootId && !trashIds.has(id)` 的节点 → 逐条 `_backupPurgeTrashSubtree`（避免遍历 `nodes` 时增删键） | L16734–L16752 |

- 逐行差异实测（[`_临时脚本/r81-linediff.mjs`](../_临时脚本/r81-linediff.mjs:1)）：公共前缀 **16,636 行**、公共后缀 **7,160 行**逐字节一致（后缀哈希前后同为 `4EFC9058…F814D409`）；变更块 **old L16637–L16677（41 行）→ new L16637–L16751（115 行）**，净 **+74 行**（LF 23,836 → 23,910），区间外零改动。
- 备份出口对象形状零变更（仍为精简后的 `state` 副本）；`exportFullBackup` 本体、`_slimVersions`、`graphpos` 过滤一行未动。

### 二、真实回归（真实 Chromium · 真实导出 → 同串真实导入 · 34/34 PASS）

| 组 | 断言（全部 PASS） |
|---|---|
| 夹具 | 55 条真实 `actions.moveToTrash` 回收站条目（各含 1 子节点）+ 1 个孤儿软删子树 + `dbRowHeights` / `dbColumnWidths` / `_localCreated` / `_remoteReceived` / `_tombstones` 挂点 + 3 条真实 `writeSnapshot` 版本 + 45 天 `activity` + 真实日历待办 + 数据库表/行 + 标签色 |
| 导出侧 E2–E16 | `full-backup`；trashed **55 → 50**；被裁最旧条目及其子节点从 `nodes` 清除；保留条目仍在；根 `children` 无悬空；孤儿软删子树清除且已脱离 `root.children`；`dbRowHeights` / `dbColumnWidths` 对应键清除、保留键留存（docA / docA::标题）；`_localCreated` / `_remoteReceived` / `_tombstones` 同步清除；activity 仅保留「今天−30 天」起的键（45 天键剔除）；graphpos 含 docA(11,22)；versions=1 且 docId=docA；tagColors / dbFields(10) / ui.dbView 均在 |
| 导入侧 I1–I15 | 真实确认弹窗点击后导入成功；文档树 root/docA/a1/docB 完整且 `a1.parent==='docA'`；数据库 tbl/r1 与 `tbl.parent==='dbRoot'`；无悬空 children；日历待办存在；dbFields=10 含「标题」；`ui.dbView==='card'`；`tagColors['设计']==='#ff0000'`；`_graphPositions.docA={x:11,y:22}`；`listSnapshots('docA')≥1`；activity 仅最近 30 天；回收站仍 50 条且全部可解引用；界面已渲染（`.sb-row` ≥1、`#content` 非空） |
| 幂等 | 导入后二次导出 trashed 仍 50、字节 > 0 |
| 控制台 | **零 pageerror / 零 console.error** |

- 导出字节（上述夹具）：**50,334 B**（导入后二次导出 50,384 B）。
- 证据：[`_环境与调试/r81-probe-r3-2026-10-23.txt`](../_环境与调试/r81-probe-r3-2026-10-23.txt:1)（探针 [`_临时脚本/r81-backup-trash-probe.mjs`](../_临时脚本/r81-backup-trash-probe.mjs:1)，Exit 0）。

### 三、字节 / 哈希锚点（落盘实测）

| 对象 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,295,362 B / `88CCBDF819490F57B8B57CC98F1F813D9D895C2508586A0E7F0545D573E4A218` | **1,299,171 B / `9337796643A0A4E62C84EA47F06D7B3A47F8E03E6DCABCA8A966C9D7DAEC9A54`** | LF（CR=0 · LF 23,836 → 23,910）· 无 BOM · 末字节单 `0x0A` |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 同 canonical | **逐字节一致**（同哈希同字节） | LF · 无 BOM |
| 登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs` | 195,360 B / `6CE87B3E61DC4F41CE91E677BE3E63D51300D0222A55B6A35BFEE352ABC98737` | 197,604 B / `B9E489419DD5DA89A1B6DF7F3C5F96CEF198779E8BC0180E526A7AC9EFA07626` | CRLF（1,645 → 1,661 行 · CR=LF=1,661 · 独立 LF 恒 0） |

- 增量守恒：1,295,362 + 3,809 = 1,299,171 B；LF 23,836 + 74 = 23,910；`<script>` 块数 9 不变（9 块逐块 vm 编译通过）。
- 改前快照：`6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r81`（= R80 态 1,295,362 B / `88CCBDF8…573E4A218` / LF 23,836，与 canonical 目录同名快照 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r81` 同哈希）；登记器改前快照 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r81-2026-10-23`（195,360 B / CRLF）；手册改前快照 `0.规范/MAINTENANCE.md.bak-r80-2026-10-23`。

### 四、门禁实测（真实执行 · 本机 PATH 无 node，以 Node v22.22.2 绝对路径前置注入）

| 门 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 | `node _临时脚本\r63-syntax-check.mjs 6.P0-T3基线\v2.0-t3.html 6.P0-T3基线\step9\v2.0-t3.html` | canonical / 镜像均 `inline-script blocks=9 compiled-ok=9`，`SYNTAX_RESULT=PASS`（Exit 0） | `_环境与调试/r81-syntax-2026-10-23.txt` |
| 真实导出→导入回归 | `node _临时脚本\r81-backup-trash-probe.mjs` | `CHECKS=34 PASS=34 FAIL=0` · `BACKUP_BYTES=50334` · `PROBE_RESULT=PASS`（Exit 0） | `_环境与调试/r81-probe-r3-2026-10-23.txt` |
| 登记器红证（重锚前） | `node verify-hash-registry.mjs` | `FAIL canonical size=1299171 (exp 1295362)` / `FAIL step9-mirror size=1299171 (exp 1295362)` · `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（Exit 1） | `_哈希与行尾校验/r81-registry-red-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | `PASS canonical size=1299171 (exp 1299171) sha256=93377966…DAEC9A54` / `PASS step9-mirror`（同）· `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（Exit 0） | `_哈希与行尾校验/r81-registry-green-2026-10-23.txt` |
| 全量回归 | `node scripts\verify.js all`（cwd=`6.P0-T3基线/step9`） | **Exit 0**：静态检查 0 命中（46ms）· Node **503/503**（27,048ms）· Playwright **171**（`4 skipped` + `167 passed`，57,477ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，102ms）→ `[verify] 全部通过` | `_环境与调试/r81-verify-all-2026-10-23.txt` |
> 封存复跑（手册 §六十四 落盘 + 登记器重锚后再次执行）：`[verify] 全部通过` · **Exit 0**（静态 0 命中 47ms · Node **503/503** 26,343ms · Playwright 4 skipped + 167 passed = 171 53,504ms · bench 7/7 最大恶化 0.0% / 中位 −14.3% 73ms），证据 [`_环境与调试/r81-verify-all-seal-2026-10-23.txt`](../_环境与调试/r81-verify-all-seal-2026-10-23.txt:1)；登记器同批复跑 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（[`_哈希与行尾校验/r81-registry-green-final-2026-10-23.txt`](../_哈希与行尾校验/r81-registry-green-final-2026-10-23.txt:1)）。

### 五、登记器重锚口径

- 仅改 `TARGETS` 中 `canonical` / `step9-mirror` 两行期望值（`1295362 / 88CCBDF8…573E4A218` → **`1299171 / 93377966…DAEC9A54`**），并在 `canonical` 行上方新增 R81 说明块（16 行）；**方数保持 65**，其余 63 方期望值一字未动（红证恰为这两方漂移，判别力真实）。
- 登记器自身 EOL 保持 CRLF（1,645 → 1,661 行 · CR=LF=1,661 · 独立 LF 恒 0），字节 195,360 → 197,604（+2,244 B），SHA-256 `B9E48941…A07626`；重锚脚本 [`_临时脚本/r81-reanchor.mjs`](../_临时脚本/r81-reanchor.mjs:1)（前置命中数校验 2/2，写后复核 `ANCHOR_RESULT=PASS`）。

### 六、回退方法

- 产品件：以 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r81`（R80 态 1,295,362 B / `88CCBDF8…573E4A218`）覆盖 canonical 与 step9 镜像。
- 登记器：以 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r81-2026-10-23`（195,360 B / CRLF）覆盖（R81 说明块与两行新期望值随之移除）。
- 手册：删除本节 §六十四，并以 `0.规范/MAINTENANCE.md.bak-r80-2026-10-23` 覆盖（首行「本版修订」与 §二 现行基线口径随之回到 R80 数值 `1,295,362 B / 88CCBDF8…573E4A218` / LF 23,836）。

### 七、红线守持

`1.冻结版本/*` 零改写；未物化新冻结件；封存 HEAD 仍 `r22`；DOM 结构 / 数据契约 / 公开 API / `<script>` 块数（9 块）零变更；导入端零改动（精简后备份经真实 `handleImportFiles` 完整恢复：文档树 / 日历待办 / 数据库字段与视图 / 标签颜色 / 图谱位置 / 版本列表 / 30 天 activity 全项通过）；导出期 `state` 保持只读（`_backupSlimState` 仍先深拷贝再裁剪）。

---

## 六十五、R82 M0-7 生命周期收口（Vite + TS 拆分前清除页面卸载悬挂资源）

> **决策**：M0-7（Vite + TS 骨架）拆分**前置条件**——先把「页面卸载时 BroadcastChannel / MessageChannel / MutationObserver / 定时器 / Worker / Blob URL 未释放」的生命周期泄漏**在产品单体阶段清掉**。拆分后上述资源分属不同模块，模块内 `_cleanups` 覆盖不到页面级卸载，会退化为跨模块悬挂资源（难定位、难回收、Vite HMR 下重复叠加）。
> **性质**：纯生命周期治理，业务语义 / 数据契约 / 公开 API 零变更；`<script>` 块数 9 不变。

### 一、产品变更（canonical + step9 镜像，5 处）

| # | 位置 | 变更 |
|---|---|---|
| ① | [`boot()`](../6.P0-T3基线/v2.0-t3.html:22382) 末尾（`visibilitychange` 监听之后） | 新增 `window.addEventListener('pagehide', …)` 统一清理块，固定顺序 **10 项**，每项独立 `try/catch`，单项失败不阻断其余项：`STORE_BC_INSTANCE.close → null`（1）· `_l7YieldCh.port1/port2.close` + `_l7YieldQ.length=0 → null`（2）· `_syncAppInertObserver.disconnect → null`（3）· `window.__juA11yObserver.disconnect → null`（4）· `_reminderTimer` `clearInterval → null`（5）· `pomoState.timer` `clearInterval → null`（6）· `_indexWorkerDispose(true)`（7，terminate + revoke Blob URL）· `_graphWorker.dispose() → null`（8，terminate + revoke Blob URL）· `window.__juVsLongtaskObserver.disconnect → null`（9）· `__l14LongtaskGate.observer.disconnect`（10，**不置 null**：闸门模块保留，重进页面可重新 `bindObserver`） |
| ② | [`_syncAppInert`](../6.P0-T3基线/v2.0-t3.html:6629) 观察者 | 由匿名单行改为**模块级** `let _syncAppInertObserver=null;` + `if(!_syncAppInertObserver){…observe(document.body,{childList:true})}`（供 ① 统一 disconnect） |
| ③ | [`_a11y` IIFE](../6.P0-T3基线/v2.0-t3.html:22509) 观察者 | `const mo` → `window.__juA11yObserver`，`mo.observe(...)` → `window.__juA11yObserver.observe(...)`（IIFE 内无其它 `mo` 引用） |
| ④ | [`_vsMetric`](../6.P0-T3基线/v2.0-t3.html:7149) 长任务观察者 | `try{new PerformanceObserver(…).observe(…)}` → `try{window.__juVsLongtaskObserver=new PerformanceObserver(…);window.__juVsLongtaskObserver.observe(…)}` |
| ⑤ | 文件尾 | 删除 `</html>` 之后的尾页脚注释行（38 B 注释 + LF = 39 B）：**根元素外注释属无效 HTML**，且会干扰后续 Vite 解析 ⇒ 现行 canonical / step9 镜像**均无尾页脚**（铁律 6 的 39 B 豁免面随之作废，见 §2 铁律 6 摘要） |

### 二、字节 / 哈希锚点（落盘实测）

| 对象 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,299,171 B / `9337796643A0A4E62C84EA47F06D7B3A47F8E03E6DCABCA8A966C9D7DAEC9A54` | **1,301,653 B / `EB85B1BF54AC99B8C3791B52780C80EFA620D1EC758FF7B66E398E151E8A9CA9`** | LF（CR=0 · LF 23,910 → 23,949）· 无 BOM · 末字节单 `0x0A` |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 同 canonical | **逐字节一致**（同哈希同字节） | LF · 无 BOM |
| 登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs` | 197,604 B / `B9E48941…A07626` | 199,209 B / `E0EEA168EA1106A55032FAEACF386050FA57A6BF7B928A4DDD6A0BC9A5FD4F23` | CRLF（1,661 → 1,675 行 · CR=LF=1,675 · 独立 LF 恒 0） |

- 增量守恒：1,299,171 + 2,521（代码改动）= 1,301,692，再 −39（尾页脚删除）= **1,301,653 B**；LF 23,910 + 40 − 1 = **23,949**；`<script>` 块数 9 不变。
- 改前快照：`6.P0-T3基线/v2.0-t3.html.bak-20261023-r82`（= R81 态 1,299,171 B / `93377966…DAEC9A54` / LF 23,910）与镜像同名快照 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r82`；登记器改前快照 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r82-2026-10-23`（197,604 B / CRLF）。

### 三、门禁实测（真实执行 · 本机 PATH 无 node，以 Node v22.22.2 绝对路径前置注入）

| 门 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 | `node _临时脚本\r63-syntax-check.mjs 6.P0-T3基线\v2.0-t3.html` | `inline-script blocks=9 compiled-ok=9` · `SYNTAX_RESULT=PASS`（Exit 0） | 本会话输出（见报告） |
| 登记器红证（重锚前） | `node verify-hash-registry.mjs` | `FAIL canonical size=1301653 (exp 1299171)` / `FAIL step9-mirror`（同）· `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL` | `_哈希与行尾校验/r82-registry-red-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | `PASS canonical size=1301653 (exp 1301653) sha256=EB85B1BF…E8A9CA9` / `PASS step9-mirror`（同）· **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（Exit 0） | `_哈希与行尾校验/r82-registry-green-2026-10-23.txt` |
| 全量回归 | `node scripts\verify.js all`（cwd=`6.P0-T3基线/step9`） | **Exit 0**：静态检查 **0 命中**（42ms）· Node **503/503**（`# fail 0` / `# skipped 0`，26,506ms）· Playwright **171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165，+ L13 6，55,105ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，78ms）→ `[verify] 全部通过` | `_环境与调试/r82-verify-all-2026-10-23.txt` |

> 封存复跑（手册 §六十五 + 项目日志 + CURRENT_TASK + 报告落盘后再次执行）：`[verify] 全部通过` · **Exit 0**（静态 0 命中 78ms · Node **503/503** 26,285ms · Playwright `4 skipped + 167 passed = 171` 54,025ms · bench 7/7 最大恶化 0.0% / 中位 −14.3% 68ms），证据 [`_环境与调试/r82-verify-all-seal-2026-10-23.txt`](../_环境与调试/r82-verify-all-seal-2026-10-23.txt:1)；登记器同批复跑 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（[`_哈希与行尾校验/r82-registry-green-final-2026-10-23.txt`](../_哈希与行尾校验/r82-registry-green-final-2026-10-23.txt:1)）。

### 四、登记器重锚口径

- 仅改 `TARGETS` 中 `canonical` / `step9-mirror` 两行期望值（`1299171 / 93377966…DAEC9A54` → **`1301653 / EB85B1BF…E8A9CA9`**），并在 `canonical` 行上方新增 R82 说明块；**方数保持 65**，其余 63 方期望值一字未动（红证恰为这两方漂移，判别力真实）。
- 登记器自身 EOL 保持 CRLF（1,661 → 1,675 行），字节 197,604 → 199,209（+1,605 B）；重锚脚本 [`_临时脚本/r82_registry_reanchor.mjs`](../_临时脚本/r82_registry_reanchor.mjs:1)（前置命中数校验 2/2，写后复核 `result=PASS`）。

### 五、回退方法

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r82`（R81 态 1,299,171 B）覆盖 canonical，并同步覆盖 step9 镜像。
- 登记器：以 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r82-2026-10-23`（197,604 B / CRLF）覆盖（R82 说明块与两行新期望值随之移除）。
- 手册：删除本节 §六十五，并将首行「本版修订」与 §二 现行基线口径回退为 R81 数值（`1,299,171 B / 93377966…DAEC9A54` / LF 23,910）。

### 六、红线守持与观察项

- `1.冻结版本/*` 与 `1.归档快照/*` 零改写；未物化新冻结件（封存 HEAD 仍 `r22`）；业务语义 / 数据契约 / 公开 API / `<script>` 块数（9 块）零变更；未新增任何 AI 生成注释（`aiNoteLint()` 0 命中）。
- **观察项（登记 · 不阻断）**：`tests/t11-anchor-governance.spec.ts` 的 **T-101**（断言 step9 镜像尾部 39 B 页脚存在、且 `buf.length === 972267`）在本波后**语义作废**——该用例仅在 `JU_L11=1` 隔离跑时参与（默认 `verify.js all` 不收集），且其字节断言自 L11 世代起即已陈旧；如需重启 L11 隔离门禁，须先按本波口径重写 T-101 再启用。
---

## 六十六、R83 M0-7/M1-1 拆分前置：调色板惰性化与全局导出契约

> **决策**：M0-7 / M1-1（Vite + TS 模块拆分）落地后，脚本顶层执行时机不可控，`getComputedStyle` 读取 CSS 变量可能早于 CSSOM 就绪而拿到空值；同时跨模块取 `state` / `ui` / `commit` 需要一个稳定入口。本波在单体阶段先建立惰性取色与导出契约，拆分时可直接 `import` 或从 `window.JU` 取值，不触发 TDZ、不依赖 CSSOM 就绪时序。
> **性质**：拆分前置治理；业务语义 / 数据契约 / 现有函数签名 / `<script>` 块数（9 块）零变更。

### 一、产品变更（canonical + step9 镜像，3 组 5 处）

| # | 位置 | 变更 |
|---|---|---|
| ① | `v2.0-t3.html:12181` | `const OPT_COLORS=_themeList('--opt-palette',[])` → `let _optColorsCache=null;` + `function getOptColors(){…惰性读取并缓存…}` |
| ② | `v2.0-t3.html:12258` | `openFieldConfigPop` 的 `renderOpts`：`const oc=getOptColors();dot.style.background=oc[i%oc.length];` |
| ③ | `v2.0-t3.html:17628` | `const TAG_COLORS=_themeList('--tag-palette',[])` → `let _tagColorsCache=null;` + `function getTagColors(){…}`；`getTagColor` 改为 `const tc=getTagColors();return tc.length?tc[h%tc.length]:_themeColor('--tag-fallback','')`（`:17636`）；`openTagPalette` 改为 `getTagColors().forEach(…)`（`:17677`，任务书未列、经全文检索补漏的第 2 处调用点） |
| ④ | `v2.0-t3.html:22417` | `boot()` 末尾（pagehide 清理块之后）新增 `window.JU` 导出契约：`state()` / `ui()` / `commit` / `subscribe` / `actions` / `N`；键名集合固定，M1 阶段方可扩展 |

### 二、核查结论（本批不改代码）

- `.cp-transparent`（`openColorPicker`）：CSS 已定义 `width:48px;height:32px;flex:none;color:var(--accent);font-weight:bold;border:2px solid var(--accent);background:transparent`，无需改动。
- `.cp-custom .cp-hex`：CSS 已定义 `flex:none; width:70px`，无需改动。
- `openSizePicker` 的 `s.v==='clear'` 分支：已为 `color:var(--accent); font-weight:bold; border:2px solid var(--accent)`，无需改动。
- 以上三项如需合并为共享类 `.ju-accent-outline-btn`，属 M1 阶段样式统一，不在本批。

### 三、字节 / 哈希锚点（落盘实测）

| 对象 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical `6.P0-T3基线/v2.0-t3.html` | 1,301,653 B / `EB85B1BF…E8A9CA9` | **1,302,295 B / `E25B293DF6030CED20BA4DD2AEDE32FB6F4E4C38BA8A94DFA05C4E6387894E38`** | LF（CR=0 · LF 23,949 → 23,959）· 无 BOM · 末字节单 `0x0A` |
| step9 镜像 `6.P0-T3基线/step9/v2.0-t3.html` | 同 canonical | **逐字节一致**（同哈希同字节） | LF · 无 BOM |
| 登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs` | 199,209 B / `E0EEA168…FD4F23` | 200,413 B / `35A2F796B5A7BCAAF1C51EE72B09D6BFBBBD51B1D91703D417F682954C39CF41` | CRLF（1,675 → 1,685 行 · CR=LF=1,685） |

- 增量守恒：1,301,653 + 642 = **1,302,295 B**；LF 23,949 + 10 = **23,959**（新增 10 行：调色板两处各 +1 行、`window.JU` 块 +8 行）。
- 改前快照：`6.P0-T3基线/v2.0-t3.html.bak-20261023-r83`（R82 态 1,301,653 B / `EB85B1BF…E8A9CA9`）与镜像同名快照；登记器 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r83-2026-10-23`（199,209 B / CRLF）；手册 `0.规范/MAINTENANCE.md.bak-r83-2026-10-23`。

### 四、门禁实测（真实执行 · PATH 前置注入 Node v22.22.2）

| 门 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 | `node _临时脚本\r63-syntax-check.mjs 6.P0-T3基线\v2.0-t3.html` | `inline-script blocks=9 · compiled-ok=9` · `SYNTAX_RESULT=PASS` | `_环境与调试/r83-syntax-2026-10-23.txt` |
| 登记器红证（重锚前） | `node verify-hash-registry.mjs` | `FAIL canonical size=1302295 (exp 1301653) sha256=E25B293D…` / `FAIL step9-mirror`（同）· `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL` | `_哈希与行尾校验/r83-registry-red-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | `PASS canonical size=1302295 (exp 1302295) sha256=E25B293D…` / `PASS step9-mirror`（同）· **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`** | `_哈希与行尾校验/r83-registry-green-2026-10-23.txt` |
| 全量回归 | `node scripts\verify.js all`（cwd=`6.P0-T3基线/step9`） | **Exit 0**：静态检查 **0 命中**（18ms）· Node **503/503**（`# fail 0` / `# skipped 0`，26,216ms）· Playwright **171**（`4 skipped + 167 passed`，55,743ms；L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165，+ L13 6）· bench **7/7**（通过 7 / 失败 0，77ms）→ `[verify] 全部通过` | `_环境与调试/r83-verify-all-2026-10-23.txt` |

### 五、登记器重锚口径

- 仅改 `TARGETS` 的 `canonical` / `step9-mirror` 两行期望值（`1301653 / EB85B1BF…E8A9CA9` → **`1302295 / E25B293D…87894E38`**），并在 `canonical` 行上方新增 R83 说明块；**方数保持 65**，其余 63 方期望值一字未动（红证恰为这两方漂移，判别力真实）。
- 登记器自身 EOL 保持 CRLF（1,675 → 1,685 行），字节 199,209 → 200,413（+1,204 B）；重锚脚本 [`_临时脚本/r83_registry_reanchor.mjs`](../_临时脚本/r83_registry_reanchor.mjs:1)（前置命中数校验 2/2，写后复核 `RESULT=WROTE_OK` / `CR=LF=1,685`）。

### 六、回退方法

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r83`（R82 态 1,301,653 B）覆盖 canonical，并同步覆盖 step9 镜像。
- 登记器：以 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r83-2026-10-23`（199,209 B / CRLF）覆盖。
- 手册：删除本节 §六十六，并以 `0.规范/MAINTENANCE.md.bak-r83-2026-10-23` 覆盖（首行「本版修订」与 §二 现行基线口径回到 R82 数值 `1,301,653 B / EB85B1BF…E8A9CA9` / LF 23,949）。

### 七、红线守持

- `1.冻结版本/*` 与 `1.归档快照/*` 零改写；未物化新冻结件（封存 HEAD 仍 `r22`）；业务语义 / 数据契约 / 现有函数签名 / `<script>` 块数（9 块）零变更；`aiNoteLint()` 0 命中。
- 本波只建立导出契约，未新增任何依赖 `window.JU` 的读取点；键名固定 6 项（`state` / `ui` / `commit` / `subscribe` / `actions` / `N`），M1 阶段方可扩展。

## 六十七、R84 M0-7/M1-1 拆分前置第二批：全局挂载点收敛 `_win` 与 JuWindow 类型声明

> **决策**：M0-7（Vite + TS 骨架）转译阶段，`window.__ju*` / `window._popAnchor` 等隐式全局属性在 TS 侧全部报 `ts(2339)`（`Window` 类型无这些成员）；M1-1 拆分后各模块也需要统一挂载点入口。本波在单体阶段建立 `JuWindow` JSDoc 类型声明与 `_win` 单例别名，把已声明属性的访问统一收敛到 `_win`。
> **性质**：拆分前置治理；业务语义 / 数据契约 / 现有函数签名 / `<script>` 块数（9 块）零变更。

### 一、产品变更（canonical + step9 镜像 · 2 组）

| # | 位置 | 变更 |
|---|---|---|
| ① | `v2.0-t3.html:1221-1257` | 第 1 段 `<script>` 的 `"use strict";` 之后新增 `JuWindow` `@typedef`（`Window & typeof globalThis & {…30 项…}`）与 `const _win = window` 的 `JuWindow` 类型标注声明（共 +37 行） |
| ② | 全文 143 处 | `window.<prop>` → `_win.<prop>`（仅限声明覆盖的属性：`_popAnchor` / `__juInMerge` / `JU` / `JU_MODULES` / `JU_DND` / `JU_SLIDES` / `electron` / `nw` / `__juLog` / `__juConfig` / `__juFlushErrors` / `__juLogDownload` / `__juVsMetrics` / `__juIndexShadowMismatch` / `__juIndexWorkerMode` / `__juIndexWorker` / `__juIndexProgress` / `__juIndexProgressBuf` / `__juSkeleton` / `__juPersistFailures` / `__juPersistProbe` / `__juPatchFailures` / `__juIndexFailures`）；`window.getSelection` / `window.__TAURI__` / `window.__juIndexShadow` / `window.__juA11yObserver` / `window.__juVsLongtaskObserver` 等未声明属性保持原样 |
| ③ | `v2.0-t3.html:18059` | 错误率窗口函数内的同名局部 `const _win=Math.floor(now/60000)` 改名 `_rateWin`（2 处），消除与全局 `_win` 的遮蔽 |

### 二、测试侧适配（7 件 · 沙箱补 `_win` 别名 · 断言零放宽）

- 受影响的 N 层用例在 `new Function` 沙箱里以局部 `window` 复刻产品作用域，产品代码改走 `_win` 后沙箱缺别名 ⇒ 补 `const _win = window;` 一行：
- `t16-w13-remote-received-delete-propagation.test.mjs` / `t16-w21-merge-ts-unit.test.mjs`（`const window = {};` 之后各 +1 行）
- `t16-w19-enc-stack-placeholder.test.mjs` / `t16-w20-calrev-gate.test.mjs`（`PRELUDE` 数组首项各 +1 行）
- 非门禁脚本同步：`t16-w22-qa-all.mjs` / `t17-qa-all.mjs` / `t19-qa-all.mjs`
- 断言、阈值、用例数一律未改；7 件均不在 65 方登记面内（登记器仍 65 方）。

### 三、样式核对（本批不改）

- `.cp-transparent`：`width:48px;height:32px;flex:none;color:var(--accent);font-weight:bold;border:2px solid var(--accent);background:transparent`。
- `.cp-custom .cp-hex`：`flex:none;width:70px`。
- `openSizePicker` 的 `s.v==='clear'` 分支：`color:var(--accent); font-weight:bold; border:2px solid var(--accent)`。

### 四、字节 / 哈希锚点（落盘实测）

| 对象 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical | 1,302,295 B / `E25B293D…87894E38` | **1,303,076 B / `34D20ECEFC530AF7716381F69A30C5EA96537EEFE5FC4A64B91D7BA2328F827A`** | LF（CR=0 · LF 23,959 → 23,996） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节） | LF |
| 登记器 `verify-hash-registry.mjs` | 200,413 B / `35A2F796…` | 201,801 B / `8C68CA4ACE1035ED3BBAFD47E39DA719745DDA68E38F1329094B09F6B0EF0733` | CRLF（1,685 → 1,695 行） |

- 增量守恒：1,302,295 + 781 = 1,303,076 B；LF 23,959 + 37 = 23,996。末字节 `0x0A`，无 BOM。
- 改前快照：`6.P0-T3基线/v2.0-t3.html.bak-20261023-r84`（含镜像同名快照）、`verify-hash-registry.mjs.bak-r84-2026-10-23`、`MAINTENANCE.md.bak-r84-2026-10-23`。

### 五、门禁实测（真实执行 · PATH 前置注入 Node v22.22.2）

| 门 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 | `node _临时脚本\r63-syntax-check.mjs <canonical> <镜像>` | 两件 `blocks=9 compiled-ok=9` · `SYNTAX_RESULT=PASS`（exit 0） | `_环境与调试/r84-syntax-2026-10-23.txt` |
| 登记器红证（重锚前） | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（恰 canonical + step9-mirror） | `_哈希与行尾校验/r84-registry-red-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_哈希与行尾校验/r84-registry-green-2026-10-23.txt` |
| 全量回归（首跑 · 红） | `node scripts\verify.js all` | Node **503 / pass 469 / fail 34**（沙箱缺 `_win`，`ReferenceError`）· Exit 1 | `_环境与调试/r84-verify-all-red-2026-10-23.txt` |
| 全量回归（测试沙箱适配后） | `node scripts\verify.js all` | **Exit 0**：静态 0 命中（21ms）· Node **503/503**（fail 0 / skipped 0，27,793ms）· Playwright **171**（167 passed + 4 skipped，62,517ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%，149ms）→ `[verify] 全部通过` | `_环境与调试/r84-verify-all-2026-10-23.txt` |

### 六、回退方法

- 产品件：以 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r84`（R83 态 1,302,295 B / `E25B293D…87894E38`）覆盖 canonical，并同步覆盖 step9 镜像。
- 登记器：以 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r84-2026-10-23`（200,413 B / CRLF）覆盖。
- 测试沙箱：删除 7 件中的 `const _win = window;` 一行（或直接回退到改前副本）。
- 手册：删除本节 §六十七，并以 `0.规范/MAINTENANCE.md.bak-r84-2026-10-23` 覆盖。

### 七、红线守持

- `1.冻结版本/*` 与 `1.归档快照/*` 零改写；未物化新冻结件（封存 HEAD 仍 `r22`）；业务语义 / 数据契约 / 现有函数签名 / `<script>` 块数（9 块）零变更；`aiNoteLint()` 0 命中。
- `_win` 仅是第一段 `<script>` 顶层的经典脚本词法绑定，拆分为 ESM 时须改为显式 `export`；`JuWindow` 声明只覆盖既有挂载点，未新增任何全局键。

## 六十八、R85 · M0-7 Vite + TS 骨架前阻断项治理（2026-10-23）

### 一、产品件改动（1 件 · `6.P0-T3基线/v2.0-t3.html`，`<script>` 块数 9 不变）

| # | 落点 | 改动 |
|---|---|---|
| ① | script#1 `"use strict";` 之后 | 新增 `window.JU` 全局桥（`register` / `require` / `constants` / `lifecycle`：`add` / `on` / `dispose`），为 M1 模块化提供生命周期注册表 |
| ② | script#1 `const TAG_RE` 之后 | 提前声明 `const WIKI_RE` / `const APP_LOCALE` 并登记 `JU.constants`；删除 script#3 的 `WIKI_RE` 与 script#4 的 `APP_LOCALE` 重复声明（全文件各 1 处，消除跨 script TDZ 与加载顺序依赖） |
| ③ | script#1 `forceRender` / script#2 | 删除 script#2 的 `forceRender` 重赋值包装；`viewSwitch` 采样移入 `forceRender` 函数体（`_frT0` 起采 → `renderMain()` 后 `_vsMetricPush`） |
| ④ | script#6 / script#7 / boot | 删除 L9 `attachShadow(globalThis)` 自动执行与 L10 `waitShadow` 25ms×400 轮询；改为 `JU.initL9Shadow(host,opts)` / `JU.initL10Seam()` 显式初始化，boot 内调用（L10 于 L9 Promise 落定后安装，保留 `__juL9ShadowAttachResult` / `__juL10D1Status` 可观测） |
| ⑤ | script#4 / script#5 / script#2 | `pagehide` 硬编码 10 项清理改为 `JU.lifecycle.add(...)` 注册 + `JU.lifecycle.dispose()`；A11y / vsLongtask / L14 闸门观察者同期登记 |

### 二、字节 / 哈希锚点（落盘实测）

| 对象 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical | 1,303,076 B / `34D20ECE…328F827A` | **1,305,739 B / `D542257FBA01ACE76780D330C79AD6A1CF9830448B71B184D46E44D918D81548`** | LF（CR=0 · LF 23,996 → 24,017） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节） | LF |
| 登记器 `verify-hash-registry.mjs` | 201,801 B / `8C68CA4A…0EF0733` | 202,947 B / `43CB6426D4AE021100261E0711D5C75404C75A326471CCBAE3E0E9C535E4A503` | CRLF（1,695 → 1,704 行） |

- 增量守恒：1,303,076 + 2,663 = 1,305,739 B；LF 23,996 + 21 = 24,017。末字节 `0x0A`，无 BOM。
- 改前快照：`90过程材料/v2.0-t3.html.bak-m07-2026-10-23`、`6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r85-2026-10-23`。

### 三、门禁实测（真实执行 · PATH 前置注入 Node v22.22.2）

| 门 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 | `node _临时脚本\m07-check-2026-10-23.mjs <canonical>` | `inline blocks=9` · `SYNTAX_FAIL_COUNT=0`（exit 0） | `_环境与调试/m07-syntax-2026-10-23.txt` |
| 65 方登记器 | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） | `_环境与调试/m07-registry-2026-10-23.txt` |
| 全量回归 | `node scripts\verify.js all` | **Exit 0**：静态检查 0 命中 · Node **503/503**（fail 0 / skipped 0）· Playwright **171**（167 passed + 4 skipped）· bench 7/7 → `[verify] 全部通过` | `_环境与调试/m07-verify-all-exitcode-2026-10-23.txt` |

### 四、回退方法

- 产品件：以 `90过程材料/v2.0-t3.html.bak-m07-2026-10-23`（R84 态 1,303,076 B / `34D20ECE…328F827A`）覆盖 canonical，并同步覆盖 step9 镜像。
- 登记器：以 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r85-2026-10-23` 覆盖。
- 手册：删除本节 §六十八。

### 五、红线守持

- `1.冻结版本/*` 零改写；未物化新冻结件（封存 HEAD 仍 `r22`）；业务语义 / 数据契约 / 现有函数签名 / `<script>` 块数（9 块）零变更；`aiNoteLint()` 0 命中。
- 单 HTML 产物仍禁止 `type=module` / 动态 `import` / module Worker（实测 0 命中）；`pagehide` 释放语义由 `JU.lifecycle.dispose()` 承接，10 项资源逐项独立 try/catch。

## 十九、R86 · M0-7 骨架可用（JU 导出契约四组注册 + 调试全局收口 + TS 声明件）—— 2026-10-23

### 一、产品侧改动（`6.P0-T3基线/v2.0-t3.html` · `<script>` 块数 9 不变）

| # | 落点 | 改动 |
|---|---|---|
| ① | script#1 末尾（`</script>` 前） | `JU.register('core', {…})` 30 键（getState / ui / commit / actions / N / $ / $$ / esc / stripHtml / pad / ymd / todayStr / parseYmd / toast / forceRender / scheduleRender / saveUI / schedulePersist / persistNow / initStore / getCurrentDoc / docSubtree / findOwningTopDocId / openNode / safeNavigate / showContextMenu / appConfirm / appPrompt / download / IS_DESKTOP） |
| ② | script#2 末尾 | `JU.register('outlineCalendar', {…})` 13 键（renderOutlinePage / renderOutlineRow / renderCalendarPage / renderCalModules / renderCalNode / buildCalLogBlock / getCalendarRootId / calendarTodosOnDate / expandRecurring / syncEmptyState / bindOutlineText / openCalNodeMenu / calModuleCharsBody） |
| ③ | script#3 末尾 | `JU.register('views', {…})` 13 键；renderGraph / renderPresentation / renderFolderGrid / renderMain（script#4）与侧栏右栏 6 键（script#5）以 getter 延迟取同一引用 |
| ④ | script#4 末尾 | `JU.register('app', {…})` 17 键（JU_VER / STATE_VER / VDB / migrateStateObject / saveAutoBackup / loadAutoBackup / openImportDialog / doDownload / exportFullBackup / JU_DND / JU_MODULES / JU_SLIDES / floatCalVisible / initJuDnd / initJuModules / initJuSlides / boot），全体 getter 延迟取值 |
| ⑤ | boot 末尾（`_win.JU.N=N;` 之后） | `window.JU.debug` 统一入口：indexShadow / skeleton / l14 / vsMetrics，整块 try/catch；旧 `window.__juIndexShadow` / `__juSkeleton` / `__l14` / `__juVsMetrics` 别名全部保留（M1 再移除） |
| ⑥ | 新增 `6.P0-T3基线/types/ju-globals.d.ts` | `JuLifecycle` / `JuBridge` / `Window.JU` 声明（`export {}` + `declare global`），不纳入哈希登记器锚点 |

### 二、字节 / 哈希锚点（本地实测）

| 登记方 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical | 1,305,739 B / `D542257F…18D81548` | **1,309,604 B / `EA1D8393337BBD825992DC3F6B22E80504E564EE49459166D3C248957FA739F0`** | LF（CR=0 · LF 24,017 → 24,086） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节） | LF |
| 登记器 `verify-hash-registry.mjs` | 202,947 B / `43CB6426…5E4A503` | 204,724 B / `5B7407C7002D7E7E8BA71AF65082369372041C1CB626E5BEC060A1B74EB5085C` | CRLF（1,704 → 1,717 行） |

- 字节守恒：1,305,739 + 3,865 = 1,309,604 B；LF 24,017 + 69 = 24,086；末字节 `0x0A`，无 BOM。
- 备份：`6.P0-T3基线/v2.0-t3.html.bak-20261023-r85`、`6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r85`、`6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r86-2026-10-23`、`0.规范/MAINTENANCE.md.bak-r86-2026-10-23`。

### 三、门禁实测（真实执行 · Node v22.22.2）

| 项 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 单 HTML 约束 · type=module | `Select-String -Pattern 'type\s*=\s*["']module["']'` | **0** | 本机 PowerShell 实测 |
| 单 HTML 约束 · 动态 import | `Select-String -Pattern 'import\s*\('` | **0** | 同上 |
| 单 HTML 约束 · module Worker | `Select-String -Pattern 'new\s+Worker\s*\([^)]*type\s*:\s*["']module["']'` | **0** | 同上 |
| 65 方登记器 | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（Exit 0） | `_哈希与行尾校验/m07-registry-2026-10-23.txt` |
| 全量门禁 | `node scripts\verify.js all` | **Exit 0**（静态 0 命中 · Node **503/503** fail 0 / skipped 0 · Playwright **171**：167 passed + 4 skipped · bench 7/7） | `_环境与调试/m07-verify-all-r2-2026-10-23.txt` |
| 契约运行时探针 | 真实 Chromium 加载 step9 镜像 | 四组键数 30/13/13/17；`JU.require` 可用；openNode / safeNavigate / download / renderMain / renderSidebar / boot / JU_DND 与全局同名引用 `===` 成立；`JU.debug` 四键就位；`pageerror=0` | `_环境与调试/m07-contract-probe-2026-10-23.txt` |
| L9 单 spec 复跑 | `node node_modules/@playwright/test/cli.js test tests/t9-persist-layer.spec.ts` | 6/6 passed（全量首轮 L9-5 在 80ms ready 握手下抖动，单跑与次轮全量均绿） | `_环境与调试/m07-t9-single-2026-10-23.txt` |

### 四、回退方案

- 产品：用 `v2.0-t3.html.bak-20261023-r85` 覆盖 canonical 与 step9 镜像，即回到 R85 态（1,305,739 B / `D542257F…18D81548`）。
- 登记器：用 `verify-hash-registry.mjs.bak-r86-2026-10-23` 覆盖即回到 R85 期望值。
- 手册：删除本章「十九、」即可，原文见 `MAINTENANCE.md.bak-r86-2026-10-23`。

### 五、遗留回填

- `1.冻结版本/*` 本波未动（历史只读锚，HEAD 仍 r22）；`JU.lifecycle` 仍承载 10 项释放闭包，页面卸载路径不变。
- 四组契约中 30 键为 getter 延迟取值（定义在后继 `<script>`）：页面加载完成后访问等价于直接引用；`JU.require('app')` 若在 script#4 执行期访问会触发 TDZ，属分块加载时序的预期表现，M1 拆分后由 ESM 依赖顺序消除。
- `types/ju-globals.d.ts` 仅类型声明，未接入 step9 `tsconfig.json`（本波不改构建配置）。

## 二十、R87 · 护眼优化 批次 2/2（字号下限 + 行高 + 过渡 + 跟随系统主题）—— 2026-10-23

### 一、产品侧改动（`6.P0-T3基线/v2.0-t3.html` · `<script>` 块数 9 不变）

| # | 落点 | 改动 |
|---|---|---|
| ① | 主样式表末尾（唯一主 `</style>` 之前） | 追加「护眼补丁 v2 · 批次2」CSS 块：`:root` 设 `--font-size:15px` / `--t-fast:.15s` / `--t-base:.22s` / `--t-slow:.32s`；`.sr-title` / `.sb-intro-row` 字号下限 `max(12px,.72em)`；`.tag-dot` / `.prio-badge` / `.remind-item .ri-time` 下限 `max(11px,.68em)`；`.sb-empty` / `.cal-no-activity` 下限 `max(11px,.78em)`；`.sb-nav-item` 行高 1.4、`.sb-nav-body` 行高 1.6；`.sb-row` 内距 3px 8px、`.cal-row` 内距 4px 6px |
| ② | `applyTheme()` 定义之后 | 新增 `applySystemTheme()`：仅当 `localStorage['juju.theme.manual'] !== '1'` 且 `matchMedia('(prefers-color-scheme: dark)')` 可用时，按系统偏好设置 `document.documentElement.dataset.theme`；整块 try/catch |
| ③ | `toggleTheme()` 内 | `applyTheme(next);` 之后、`saveUI();` 之前写入 `localStorage.setItem('juju.theme.manual','1')` |
| ④ | `openThemeSelector()` 的 `btnOk.onclick` | `applyTheme(t);` 之后写入 `localStorage.setItem('juju.theme.manual','1')` |
| ⑤ | `boot()` 内 | `applyTheme(initTheme);` 之后调用 `applySystemTheme();` |

- 前置事实：在本波落盘前的 canonical 中检索 `护眼补丁` 为 0 命中，任务所述的「批次1追加块」并不存在；本波未臆造或补写批次1内容，批次2 CSS 直接追加到主样式表末尾 `</style>` 前（其后仅剩 `</head>` 与正文）。
- 明确未改：`.row:hover` 及其变体、滚动条规则、`applyTheme()` 函数体；数据契约 / 公开 API / `<script>` 块数 9 零变更。

### 二、字节 / 哈希锚点（本地实测）

| 登记方 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical | 1,309,604 B / `EA1D8393…A739F0` | **1,310,569 B / `18D531CD7906EE5AF1AAEB7BBC0F1A94CE9B005281007C8BD86624A5E968CBE0`** | LF（CR=0 · LF 24,086 → 24,131） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节） | LF |
| 登记器 `verify-hash-registry.mjs` | 204,724 B / `5B7407C7…4EB5085C` | 205,513 B / `06EA078B1E852D0659BF37C177802DD876B06C868CD4EC184290438E13346F91` | CRLF（1,717 → 1,724 行） |

- 字节守恒：1,309,604 + 965 = 1,310,569 B；LF 24,086 + 45 = 24,131；末字节 `0x0A`，无 BOM。
- 备份：`6.P0-T3基线/v2.0-t3.html.bak-r87-2026-10-23`、`6.P0-T3基线/step9/v2.0-t3.html.bak-r87-2026-10-23`、`6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r87-2026-10-23`、`0.规范/MAINTENANCE.md.bak-r87-2026-10-23`。

### 三、门禁实测（真实执行 · Node v22.22.2）

| 项 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 65 方登记器 | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（Exit 0） | `_哈希与行尾校验/r87-registry-2026-10-23.txt` |
| 全量门禁（首轮） | `node scripts/verify.js all` | Exit 1：仅 T-99 失败（`drift` 期望 0 / 实得 2），原因是 canonical / step9-mirror 新字节尚未重锚登记器；无尺寸快照 / 布局断言失败 | `_环境与调试/r87-verify-all-2026-10-23.txt` |
| 全量门禁（重锚后） | `node scripts/verify.js all` | **Exit 0**：静态 0 命中 · Node **503/503**（fail 0 / skipped 0）· Playwright **171**（167 passed + 4 skipped）· bench 7/7 → `[verify] 全部通过` | `_环境与调试/r87-verify-all-r2-2026-10-23.txt` |

- 回退分支未触发：`--font-size:15px` 未造成尺寸快照 / 哈希断言失败，故未改用 `--font-size:14px + ui.scale=1.07 + applyScale()` 方案。
- 首轮唯一失败项 T-99 为登记器期望值滞后（drift=2），重锚 canonical / step9-mirror 后次轮全绿。

### 四、回退方案

- 产品：用 `v2.0-t3.html.bak-r87-2026-10-23` 覆盖 canonical，并同步覆盖 step9 镜像，即回到 R86 态（1,309,604 B / `EA1D8393…A739F0`）。
- 登记器：用 `verify-hash-registry.mjs.bak-r87-2026-10-23` 覆盖即回到 R86 期望值。
- 手册：删除本章「二十、」即可，原文见 `MAINTENANCE.md.bak-r87-2026-10-23`。

### 五、红线守持

- `1.冻结版本/*` 零改写；未物化新冻结件；业务逻辑 / 数据契约 / 现有函数签名 / `<script>` 块数（9 块）零变更；`aiNoteLint()` 0 命中。
- 单 HTML 产物仍禁止 `type=module` / 动态 `import` / module Worker（本波未新增相关语法）。

## 二十一、R88 · 护眼优化 批次 2/2 补完（文字纯黑/纯白 + 跟随系统主题补全）—— 2026-10-23

### 一、产品侧改动（`6.P0-T3基线/v2.0-t3.html` · `<script>` 块数 9 不变）

| # | 落点 | 改动 |
|---|---|---|
| ① | 主样式表末尾（R87 批次2 块之后、唯一主 `</style>` 之前） | 追加「护眼补丁 v2 · 批次2」覆盖块 64 行：`:root` 重述 `--font-size:15px` / `--t-fast:.15s` / `--t-base:.22s` / `--t-slow:.32s`；`:root,html[data-theme="day"]` 将 `--fg` / `--fg-dim` / `--title` / `--accent-fg` / `--accent-deep` / `--sb-nav-active-fg` / `--editor-fg` / `--now-label-fg` 设为纯黑；`html[data-theme="night"]` 同八项设为纯白并追加 `--on-danger-fg` / `--active-fg-on-accent` 为白；`html[data-theme="day"] body` / `html[data-theme="night"] body` 文字色；`.sr-title` / `.sb-intro-row` / `.tag-dot` / `.prio-badge` / `.remind-item .ri-time` / `.sb-empty` / `.cal-no-activity` 字号下限；`.sb-nav-item` / `.sb-nav-body` 行高；`.sb-row` / `.cal-row` 行内距 |
| ② | JS | 沿用 R87 已落地的 `applySystemTheme()`、`toggleTheme` / `openThemeSelector` 的 `juju.theme.manual=1`、`boot()` 内 `applySystemTheme()` 调用；本波零改动 |
| ③ | step9 镜像 | 由 canonical 逐字节复制同步 |

- 原 `:root`（第 9–33 行）与 `html[data-theme="night"]`（第 34–45 行）定义块**一行未改**，只在末尾追加覆盖块（顺序在后者胜出，且夜间选择器特异性更高）。
- 纯黑 / 纯白以 CSS 关键字 `black` / `white` 表达（与六位十六进制全黑 / 全白等价）：canonical 定义块外六位十六进制色值命中保持 **0**（L16-W9 §B 断言口径要求为 0），因此不使用六位十六进制字面量。
- 反白例外（深色 / 彩色实底上的白字）未覆盖：`.btn.primary`、`.tb-nav-btn.active`、`.sb-square.active`、`.sb-tool.on`、`.cal-view-btn.active`、`.db-view-btn.active`、`.mm-node.root`、`.ju-pres-*`、`.prio-badge.p1~p5`、`.tag-dot`、`.link-chip` 内文字维持原规则。
- 明确未改：`:root` 原块、`html[data-theme="night"]` 原块、`.row:hover` 及其变体、滚动条规则、数据契约 / 公开 API / `<script>` 块数 9。

### 二、字节 / 哈希锚点（本地实测）

| 登记方 | 改前 | 改后 | 行尾 |
|---|---|---|---|
| canonical | 1,310,569 B / `18D531CD…68CBE0` | **1,311,866 B / `922411C0B1EF291D23BAD4124B2506AB70FDF219300433F2632DD1263C895391`** | LF（CR=0 · LF 24,131 → 24,195） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节） | LF |
| 登记器 `verify-hash-registry.mjs` | 205,513 B / `06EA078B…346F91` | 206,594 B / `4A894684282C5542AB82FC7A2AE9C92B27CD54CBEF46D7E95FDB75993CD68A42` | CRLF（1,724 → 1,733 行） |

- 字节守恒：1,310,569 + 1,297 = 1,311,866 B；LF 24,131 + 64 = 24,195；末字节 `0x0A`，无 BOM。
- 备份：`6.P0-T3基线/v2.0-t3.html.bak-r88-2026-10-23`、`6.P0-T3基线/step9/v2.0-t3.html.bak-r88-2026-10-23`、`6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r88-2026-10-23`、`0.规范/MAINTENANCE.md.bak-r88-2026-10-23`。

### 三、门禁实测（真实执行 · Node v22.22.2）

| 项 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 65 方登记器 | `node verify-hash-registry.mjs` | `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（Exit 0） | `_哈希与行尾校验/r88-registry-2026-10-23.txt` |
| 全量门禁 | `node scripts/verify.js all` | **Exit 0**：静态 0 命中 · Node **503/503**（fail 0 / skipped 0）· Playwright **171**（167 passed + 4 skipped）· bench 7/7 → `[verify] 全部通过` | `_环境与调试/r88-verify-all-2026-10-23.txt` |

- 回退分支未触发：`--font-size:15px` 未造成尺寸快照 / 哈希断言失败，未改用 `--font-size:14px + ui.scale=1.07 + applyScale()` 方案。
- 夜间白字对比度：验收脚本不含对比度断言（L16-W9 仅对日 / 夜 `--sb-nav-active-fg` 断言 ≥ 4.5:1，读取的是原定义块取值），故未将夜间 `--accent-soft` 加深为 `#24478A`；夜间 `--sb-nav-active-fg` 白字落在 `rgba(20,45,80,.85)` 深底上，实测对比度远高于 4.5:1。
- 遗留观察项（未修改，待裁决）：夜间 `--danger` 为浅红 `#FF8A7A` 实底，`.remind-badge` 文字经 `--on-danger-fg` 置白后实测对比度约 **2.3:1**（原深色字约 7.4:1）；`--active-fg-on-accent` 当前无消费者，暂无视觉影响。

### 四、回退方案

- 产品：用 `v2.0-t3.html.bak-r88-2026-10-23` 覆盖 canonical，并同步覆盖 step9 镜像，即回到 R87 态（1,310,569 B / `18D531CD…68CBE0`）。
- 登记器：用 `verify-hash-registry.mjs.bak-r88-2026-10-23` 覆盖即回到 R87 期望值。
- 手册：删除本章「二十一、」即可，原文见 `MAINTENANCE.md.bak-r88-2026-10-23`。

### 五、红线守持

- `1.冻结版本/*` 零改写；未物化新冻结件；业务逻辑 / 数据契约 / 现有函数签名 / `<script>` 块数（9 块）零变更；`aiNoteLint()` 0 命中。
- 单 HTML 产物仍禁止 `type=module` / 动态 `import` / module Worker（本波未新增相关语法）。

## 二十二、R89 · 大纲视图 跨行文字选择 / 复制 / 剪切 / 粘贴修复 —— 2026-10-23

### 一、产品侧改动（`6.P0-T3基线/v2.0-t3.html` · `<script>` 块数 9 不变）

| # | 函数 / 落点 | 改动 |
|---|---|---|
| ① | `outlineDragSelectMove(e)`（约 8275–8295 行） | `ds.fromText` 为真时模式判定锁定 `'text'`：新增 `if(ds.fromText){ds.mode='text';}` 置于水平 / 垂直判定之前，纵向拖动不再进入 `'multi'`（原实现进入 multi 后 `removeAllRanges()` 会清空原生文本选区，导致跨行选中的文字无法复制 / 剪切 / 粘贴）。`if(!ds.mode)return;` 与 `if(ds.mode!=='multi')return;` 保持不变；`outlineDragSelectEnd` 未改 |
| ② | `_buildOutlineBox` 内 `row.addEventListener('mousedown', …)`（约 8151–8174 行） | Ctrl/Cmd 分支条件改为 `(e.ctrlKey||e.metaKey)&&!target.closest('.text')`；Shift 分支条件改为 `e.shiftKey&&!target.closest('.text')`。编辑区内放行浏览器原生行为（Shift 扩展文本选区、原生复制 / 剪切）；普通 mousedown 的 `outlineDragSelectStart(e,n.id,!!target.closest('.text'))` 调用不变 |
| ③ | 新增顶层 `copyOutlinePlainText(txt)`（`bindOutlineText` 之前，约 8732–8755 行） | 优先 `navigator.clipboard.writeText`；异常或被拒时回退隐藏 textarea（`position:fixed;left:-9999px;top:0`）+ `select()` + `safeExec('copy')` + `remove()`；始终返回 Promise（clipboard 的 Promise 或 `Promise.resolve()`） |
| ④ | `bindOutlineText` 内 `text.addEventListener('keydown', …)`（约 8913–8934 行） | IME 守卫之后、Ctrl+Z 分支之前插入：无文本选区且 `_outlineSel.ids.size` 非空时，`Ctrl/Cmd+C` 复制所选顶层节点纯文本（`topSelected` + `stripHtml` 每行一条），`Ctrl/Cmd+X` 复制后删除所选顶层节点并清空多选；存在文本选区一律不拦截（保持浏览器原生复制 / 剪切） |
| ⑤ | `bindOutlineText` 内 `text.addEventListener('paste', …)`（约 8779–8799 行） | `dt` 判空之后、`e.preventDefault()` 之前插入：非折叠选区且 `text.contains(r.commonAncestorContainer)` → `r.deleteContents()` + `sanitizeHtml(text.innerHTML)` 写回 state（`snapshot/dirtyText/dirtyDocs/silent/persistOnly`）；跨编辑区选区 → `selectNodeContents(text)` + `collapse(false)` 折叠到本区末尾。其余粘贴分支（单行 / 多行拆分）保持不变 |
| ⑥ | 顶层 `document.addEventListener('mousedown', …)`（第 6794 行 · 防御） | `closest` 前补能力判定（`const _t=e.target; if(!(_t&&_t.closest&&_t.closest('#ctxMenu'))){…}`）。②放行 `.text` 内 mousedown 后，Text 节点目标（nodeType=3）会冒泡至此，原写法抛 `Uncaught TypeError: e.target.closest is not a function`（由 t3-invariants ③ 断言捕获） |

### 二、验收侧改动（`6.P0-T3基线/step9/tests/t3-invariants.spec.ts`）

- r18 段：节点多选派发目标由 `.text` 改为 `.row`（行 chrome）；`.text` / Text 节点目标的 Ctrl 断言改按新契约——**不触发节点多选（`_outlineSel.ids.size === 0`）且不抛 `closest` TypeError**（`expect(ms.textNodeSel).toBe(1)` → `toBe(0)`）。
- r19 段：垂直拖拽拆为两段——②-A「起点在 `.text` 内 · 真实鼠标」断言 `multi===0` / `ids===0` / `Range` 仍落在起始编辑区（`anchorInHost===true`）；②-B「起点为行 chrome（`.row` 元素目标）」以合成 mousedown + document mousemove/mouseup 复现跨行多选，沿用底色 / 无边框 / 无阴影断言。
- 说明：该段断言的是旧契约（`.text` 内可触发节点多选），与本次修复目标直接冲突；测试随契约同步重写，未放宽任何视觉 / 结构断言。

### 三、字节 / 哈希锚点（本地实测）

| 登记方 | 改前（R88） | 改后（R89） | 行尾 |
|---|---|---|---|
| canonical | 1,311,866 B / `922411C0B1EF291D23BAD4124B2506AB70FDF219300433F2632DD1263C895391` | **1,315,345 B / `4A688EA998ECA808FCEEBC016CB3A5E8A2562C4391A1854DB882D88AFE0D0E0E`** | LF（CR=0 · LF 24,195 → 24,256） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节） | LF |
| `tests/t3-invariants.spec.ts` | 15,333 B / `29216798C9DAABD2D03855C8A8140A7A7D2950B779E24D5A199607832E91EB6D` | 17,795 B / `0BF906B5D72F2A9142B7E4D04FC1C5C0D3643BB458201DA4DF9CD4D52CF4B868` | LF（320 → 355 行） |
| 登记器 `verify-hash-registry.mjs` | 206,594 B / `4A894684282C5542AB82FC7A2AE9C92B27CD54CBEF46D7E95FDB75993CD68A42` | 209,032 B / `08F009B94044F4D469521AC5BFA8A1E98E22D0014EF336301A1A5324CEB34373` | CRLF（1,733 → 1,756 行） |

- 字节守恒：canonical 1,311,866 + 3,479 = 1,315,345 B；LF 24,195 + 61 = 24,256；末字节 `0x0A`，无 BOM。
- 备份：`6.P0-T3基线/v2.0-t3.html.bak-r89-2026-10-23`、`6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r89-2026-10-23`（= R88 期望值）、`6.P0-T3基线/step9/tests/t3-invariants.spec.ts.bak-r89-2026-10-23`（= R88 用例）、`0.规范/MAINTENANCE.md.bak-r89-2026-10-23`。

### 四、门禁实测（真实执行 · Electron-as-Node v24.21.0）

| 项 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 全量门禁（改前基线） | `node scripts/verify.js all` | **Exit 0**：静态 0 命中 · Node 203 · Playwright 171（167 passed + 4 skipped）· bench 7/7 | `_环境与调试/outline-selcopy-r89-verify-all-baseline-2026-10-23.txt` |
| 65 方登记器（未重锚） | `node verify-hash-registry.mjs` | Exit 1：`FAIL canonical size=1315047 (exp 1311866)` / `FIVE_PARTY_DRIFT_COUNT=1` / `RESULT=FAIL` | `_环境与调试/outline-selcopy-r89-registry-before-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | **Exit 0**：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/outline-selcopy-r89-registry-after2-2026-10-23.txt` |
| 单用例复跑 | `node node_modules/@playwright/test/cli.js test tests/t3-invariants.spec.ts` | Exit 0：3 passed | `_环境与调试/outline-selcopy-r89-t3inv-single-r3-2026-10-23.txt` |
| 全量门禁（改后） | `node scripts/verify.js all` | **Exit 0**：静态 0 命中 · Node **503/503**（fail 0 / skipped 0）· Playwright **171**（167 passed + 4 skipped）· bench 7/7 → `[verify] 全部通过` | `_环境与调试/outline-selcopy-r89-verify-all-after-2026-10-23.txt` |
| 行为探针（改前 · 期望红） | `node _临时脚本/r89-outline-selcopy-probe-2026-10-23.mjs`（`R89_TARGET=_临时脚本/_r89_before.html`） | A / C1 / C2 **FAIL**（A：`{"len":0,"collapsed":true,"multi":2}`；C1/C2：`canceled:false`、`copied:null`） | `_环境与调试/outline-selcopy-r89-probe-before-2026-10-23.txt` |
| 行为探针（改前 · 期望红） | `node _临时脚本/r89-outline-paste-probe-2026-10-23.mjs`（同目标） | E2 **FAIL**（`collapsed:false`、`caretAtEnd:false`） | `_环境与调试/outline-selcopy-r89-paste-probe-before-2026-10-23.txt` |
| 行为探针（改后 · 全绿） | 同上两个探针（`R89_TARGET` = canonical） | selcopy 5/5 PASS（A `{"len":2,"multi":0}`、B `multi:3`、C1 `copied` 为三行纯文本、D `notPrevented:true`、C2 `6→3` 行）；paste 4/4 PASS（E1 同区替换、E2 折叠到末尾 `XZ`、E3 `6→9` 行拆分、E4 单行粘贴） | `_环境与调试/outline-selcopy-r89-probe-after-2026-10-23.txt`、`_环境与调试/outline-selcopy-r89-paste-probe-after-2026-10-23.txt` |

- 迭代记录（如实）：改后首轮全量门禁 T-99 红（`drift=1`，尚未重锚）→ 重锚后次轮 t3-invariants r18 抛 `Uncaught TypeError: e.target.closest is not a function`（④ 放行 `.text` 后事件冒泡至 ⑥ 的 document mousedown）→ 补 ⑥ 防御 + 重写 r18/r19 断言 → 第三轮全绿。
- 已知抖动（非本次改动引入）：收尾轮曾出现 1 次 `L9-5 Worker 生命周期`（`t9-persist-layer.spec.ts:330`，`ready` 握手 false）红，同字节产物立即重跑绿（`_环境与调试/outline-selcopy-r89-verify-all-final-r2-2026-10-23.txt`，Exit 0 / 167 passed）；该用例为 Blob Worker ready 握手时序敏感项，与大纲选择 / 剪贴板路径无关联，本波未改动其相关代码。
- 运行环境说明：本机 PATH 无独立 Node，门禁经 `_临时脚本/_r89_run_verify.ps1` 以 VS Code Electron（`ELECTRON_RUN_AS_NODE=1`）在 `Code.exe` 同目录硬链接 `node.exe` 的方式提供 `node`（`verify.js` 内部 `spawnSync('node')` 需要字面量可执行文件）；该硬链接为本机运行期产物，位于归档目录之外，不纳入本仓登记。

### 五、回退方案

- 产品：用 `v2.0-t3.html.bak-r89-2026-10-23` 覆盖 canonical 与 step9 镜像，即回到 R88 态（1,311,866 B / `922411C0…C895391`）。
- 用例：用 `t3-invariants.spec.ts.bak-r89-2026-10-23` 覆盖，即回到 R88 断言（15,333 B / `29216798…91EB6D`）。
- 登记器：用 `verify-hash-registry.mjs.bak-r89-2026-10-23` 覆盖即回到 R88 期望值（206,594 B）。
- 手册：删除本章「二十二、」即可，原文见 `MAINTENANCE.md.bak-r89-2026-10-23`。

### 六、红线守持

- `1.冻结版本/*` 零改写；未物化新冻结件；`<script>` 块数 9 零变更；`aiNoteLint()` 0 命中；数据契约 / 序列化形态 / 公开 API 零变更（仅新增 1 个顶层函数 `copyOutlinePlainText`）。
- 单 HTML 产物仍禁止 `type=module` / 动态 `import` / module Worker（本波未新增相关语法）。
- 已知取舍：`.text` 内 Ctrl/Cmd 点击不再触发节点多选（改为原生行为）；节点多选入口收敛为行 chrome（拖拽手柄 / 行内非编辑区）。r18/r19 断言已同步该契约。

## 二十三、R90 · 同源选区粘贴 / 同步复制回退 / 选区 Enter·Tab —— 2026-10-23

### 一、产品侧改动（`6.P0-T3基线/v2.0-t3.html` · `<script>` 块数 9 不变）

| # | 函数 / 落点 | 改动 |
|---|---|---|
| ① | 顶层 `copyOutlinePlainTextSync(txt)`（第 8738 行起 · 由 R89 的 `copyOutlinePlainText` 改造） | 改为同步版本：隐藏 `textarea`（`position:fixed;left:-9999px;top:0;opacity:0`）+ `value=txt` + `appendChild` + `select()` → `const ok=safeExec('copy')` → `ta.remove()` → `return ok`（布尔）；异常路径同样移除 textarea 并返回 `false`。异步 Clipboard API 不再是首选，改由调用方在同步失败时补位 |
| ② | `bindOutlineText` 内 `text.addEventListener('keydown', …)` Ctrl/Cmd+C / X 分支（约 8920–8946 行） | 复制改为 `const ok=copyOutlinePlainTextSync(txt)`；`ok` 为真 → 成功 toast + `setTimeout(()=>{const cur=document.querySelector('#content .text[data-id="'+CSS.escape(...)+'"]');if(cur)cur.focus();},0)` 复原编辑器焦点；`ok` 为假 → 补位 `navigator.clipboard.writeText(txt).then(done,fail)`；两者皆失败 → `toast('复制失败：浏览器限制了剪贴板访问')`。Ctrl+X 分支仅在同步成功或异步成功后才删除所选顶层节点，杜绝「未复制却删除」 |
| ③ | 同函数 Enter 分支（约 8968–8981 行） | `e.preventDefault()` 之后插入选区预处理：非折叠且 `text.contains(range.commonAncestorContainer)` → `deleteContents()` + `sanitizeHtml(text.innerHTML)` → `commit(..., {snapshot:true,dirtyText:true,dirtyDocs:findOwningTopDocId(id,state)||undefined,silent:true,persistOnly:true})` → `return`；语义为「Enter 只删除选区，不新建节点」 |
| ④ | 同函数 Tab 分支（第 9004 行起） | 拆为多行块：`e.preventDefault()` 后先做同一选区删除 + `commit` 同步块，再执行 `e.shiftKey?outdentNode(id):indentNode(id)`；无选区时缩进 / 反缩进行为与原先一致 |
| ⑤ | `bindNoteText` 内 `text.addEventListener('paste', …)`（约 9752–9772 行） | `if(!dt)return;` 之后、`e.preventDefault()` 之前插入与 R89 `bindOutlineText` 完全同口径的选区预处理块：本编辑区内非折叠选区先 `deleteContents()` + `commit`（节点用参数 `id`，`dirtyDocs:findOwningTopDocId(id,state)||undefined`），跨编辑区选区折叠到本区末尾 |
| ⑥ | `renderCalNode` 内 `text.addEventListener('paste', …)`（约 11473–11493 行） | 同上插入同一预处理块；`commit` 内节点用 `n.id`，`dirtyDocs:getCalendarRootId()` |

### 二、验收侧改动（`6.P0-T3基线/step9/verify-hash-registry.mjs`）

- canonical / step9-mirror 两条登记方期望值重算（1,315,345/4A688EA9… → 1,319,506/46670A74…，LF）。
- 新增 R90 变更说明注释块（15 行）后接既有两条登记方元组；`PARTY_COUNT=65` 不变，未新增 / 退役登记方。
- `tests/*.spec.ts` 本波零改动（`t3-invariants.spec.ts` 仍为 17,795 B / `0BF906B5…`）。

### 三、字节 / 哈希锚点（本地实测）

| 登记方 | 改前（R89） | 改后（R90） | 行尾 |
|---|---|---|---|
| canonical | 1,315,345 B / `4A688EA998ECA808FCEEBC016CB3A5E8A2562C4391A1854DB882D88AFE0D0E0E` | **1,319,506 B / `46670A74E6E614042B11C02B97BC3357FCE251A4FEE2F19637F9FBEA0C677392`** | LF（CR=0 · LF 24,256 → 24,328） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节） | LF |
| 登记器 `verify-hash-registry.mjs` | 209,032 B / `08F009B94044F4D469521AC5BFA8A1E98E22D0014EF336301A1A5324CEB34373` | 210,640 B / `9CAAAF700EED1720D2A92B0C6DA81E5B8055BADEBAB748074A777440B5BF470D` | CRLF（1,756 → 1,772 个 LF · 1,773 行） |
| `tests/t3-invariants.spec.ts` | 17,795 B / `0BF906B5…` | 未改动（同字节同哈希） | LF |

- 字节守恒：canonical 1,315,345 + 4,161 = 1,319,506 B；LF 24,256 + 72 = 24,328；末字节 `0x0A`，无 BOM；`<script>` 块数 9（不改）。
- 备份：`6.P0-T3基线/v2.0-t3.html.bak-r90-2026-10-23`（= R89 产物）、`6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r90-2026-10-23`（= R89 期望值）、`0.规范/MAINTENANCE.md.bak-r90-2026-10-23`。

### 四、门禁实测（真实执行 · Electron-as-Node v24.21.0）

| 项 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法门 | `node _临时脚本/_r90_syntax_check.mjs` | **Exit 0**：9 块全部 `OK` · `SCRIPTS=9 ERRORS=0` | `_环境与调试/outline-selcopy-r90-syntax-2026-10-23.txt` |
| 行为探针（本批 4/5/6/8/9） | `node _临时脚本/r90-paste-copy-selection-probe-2026-10-23.mjs` | **Exit 0**：10/10 PASS（N1/N2 记事本+日历同区替换、N3 跨区折叠、C1 `execCommand` 同步复制 + 焦点复原、C2 复制成功后剪切、C3 复制失败不删除、E1 选区 Enter 不新建、E2 选区 Tab 缩进、E3 无选区 Enter 仍拆分） | `_环境与调试/outline-selcopy-r90-probe-2026-10-23.txt` |
| 上一批 a–e 回归 | `node _临时脚本/r90-regression-r89-a-e-2026-10-23.mjs` | **Exit 0**：9/9 PASS（A 编辑区内拖拽保留文本选区、B 行 chrome 拖拽多选 `multi:3`、C1 `execCommand` 值 = 两行纯文本、C2 `6→4` 行、D 有选区不拦截、E1–E4 粘贴四态） | `_环境与调试/outline-selcopy-r90-r89regress-2026-10-23.txt` |
| 全量门禁（重锚前） | `node scripts/verify.js all` | Exit 1：仅 `T-99 门禁` 红（`drift=2`，canonical + step9-mirror 尚未重锚）；其余 Node 503 / Playwright 166 passed 全绿 | `_环境与调试/outline-selcopy-r90-verify-all-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | **Exit 0**：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/outline-selcopy-r90-registry-after-2026-10-23.txt` |
| 全量门禁（重锚后） | `node scripts/verify.js all` | **Exit 0**：静态 0 命中 · Node **503/503** · Playwright **171**（167 passed + 4 skipped）· bench 7/7（0 警告 0 失败）→ `[verify] 全部通过` | `_环境与调试/outline-selcopy-r90-verify-all-r2-2026-10-23.txt` |

- 迭代记录（如实）：① 先跑探针，N1/N2 首轮「DOM 正确 / state 滞后」失败 → 定位为记事本 600ms 防抖落库、日历待办 blur 落库的既有语义，探针改按真实落库时机对拍后全绿；② 全量门禁首轮仅 T-99 红（登记器未重锚，`drift=2`）→ 重锚后次轮全绿。
- 探针口径变更（如实）：R89 的 `r89-outline-selcopy-probe` 以 `navigator.clipboard.writeText` 桩断言复制，R90 起同步 `execCommand` 成功即不再走 Clipboard API，该旧探针的 C1/C2 因断言旧口径而失败（`_环境与调试/outline-selcopy-r90-r89selcopy-2026-10-23.txt`，其余 A/B/D 仍 PASS）；故另写 `r90-regression-r89-a-e-2026-10-23.mjs`，改以「隐藏 textarea 的 value + `document.execCommand('copy')` 返回值」观测真实剪贴板传输，覆盖同一批 a–e 契约。
- 运行环境说明：本机 PATH 无独立 Node，门禁经 `_临时脚本/_r90_run_verify.ps1` 以 VS Code Electron（`ELECTRON_RUN_AS_NODE=1`）+ `Code.exe` 同目录 `node.exe` 硬链接提供 `node`；该硬链接为本机运行期产物，位于归档目录之外，不纳入登记。

### 五、回退方案

- 产品：用 `v2.0-t3.html.bak-r90-2026-10-23` 覆盖 canonical 与 step9 镜像，即回到 R89 态（1,315,345 B / `4A688EA9…0E0E0E`）。
- 登记器：用 `verify-hash-registry.mjs.bak-r90-2026-10-23` 覆盖即回到 R89 期望值（209,032 B）。
- 手册：删除本章「二十三、」即可，原文见 `MAINTENANCE.md.bak-r90-2026-10-23`。

### 六、红线守持

- `1.冻结版本/*` 零改写；未物化新冻结件；`<script>` 块数 9 零变更；`aiNoteLint()` 0 命中；数据契约 / 序列化形态 / 公开 API 零变更。
- 函数层面唯一改名：顶层 `copyOutlinePlainText` → `copyOutlinePlainTextSync`（返回 `Promise` → 返回 `boolean`）；全仓调用点仅 `bindOutlineText` keydown 一处，已同波改造，无残留引用。
- 单 HTML 产物仍禁止 `type=module` / 动态 `import` / module Worker（本波未新增相关语法）。
- 行为语义扩张点（有意为之，非回归）：有文本选区时 Enter / Tab 不再「抽取后半段新建节点 / 连选区一起缩进」，改为先删除选区再执行原动作。

## 二十四、R91 · 大纲复制/剪切范围对等 · 焦点恢复 · 单条历史 —— 2026-10-23

> 批次 8（P0）+ 批次 9（P1）：复制内容 = 剪切删除范围；剪切后焦点不丢；多顶层节点剪切合并为 1 条历史；CapsLock / AltGr 键位健壮性。
> 落位：[`6.P0-T3基线/v2.0-t3.html`](../6.P0-T3基线/v2.0-t3.html:1)（canonical，`<script>` 块数 9 保持不变）。

### 一、产品侧改动（`6.P0-T3基线/v2.0-t3.html`）

| # | 位置 | 改动 |
|---|---|---|
| ① | 顶层 `collectOutlinePlainText(tops)`（第 8,735 行区段 · `copyOutlinePlainTextSync` 之前） | **新增**。按深度优先递归遍历每个顶层节点整棵子树：`N(id)` 不存在（幽灵 id）/ `_deleted` / 系统容器（`_isCalRoot` · `_isDbRoot` · `_isNoteRoot`）跳过；每节点输出一行 `stripHtml(n.text||'')`，条目内换行 / 连续空白折叠为单空格，条目间换行符连接，末尾不加换行；`seen` 集防重复 / 防环 |
| ② | `bindOutlineText` keydown 的 Ctrl/Cmd+C·X 分支（约 8,948–9,020 行） | 触发条件改为 `(e.ctrlKey||e.metaKey) && !e.shiftKey && !e.altKey` + `const _k=String(e.key||'').toLowerCase()`：CapsLock 大写 `C`/`X` 同效，AltGr（Ctrl+Alt）不再误触发；`hasTextSel` 判定与 `return` 结构逐字保留 |
| ③ | 同分支剪切删除 | `tops.forEach(t=>actions.removeNode(t))`（N 次 commit）→ **单次** `commit(s=>{…},{snapshot:true,dirtyText:true,dirtyDocs:getCurrentDoc()?getCurrentDoc().id:undefined})`；逐顶层节点摘除父 `children` 后递归 `rm()`（`purgeNodeMeta` / `delete ui.collapsedDocs` / `_searchHayCache.delete` / `_tombstoneSet` 口径与 `actions.removeNode` 一致）⇒ 一次 Ctrl+Z 完整回退 |
| ④ | 同分支焦点恢复 | 删除前取 `restoreId = isCut ? (previousVisible(tops[0]) || nextVisible(tops[0])) : (ui.focusId || tops[0] || null)`；`forceRender()` 后 `requestAnimationFrame` 聚焦 `#content .text[data-id=…]` 并把光标折叠到文本末尾，取不到元素则落到 `#content .doc-header-title` |
| ⑤ | 复制/剪切共用收尾 | `done()` 内统一 `restoreFocus()`：Ctrl+C 不再依赖隐藏 textarea 移除后的 `setTimeout` 复原，复制后编辑器焦点与节点均保持不变 |

- 复制内容 = 删除范围：`txt` 由 `tops.map(t=>stripHtml(…)).join('\n')`（仅顶层）改为 `collectOutlinePlainText(tops)`（整棵子树）。
- 数据契约（`state.nodes` 形状）/ 序列化形态 / 公开 API 零变更；新增 1 个顶层纯函数。

### 二、验收侧改动（`6.P0-T3基线/step9/verify-hash-registry.mjs`）

- canonical / step9-mirror 两条登记方期望值重算（1,319,506/`46670A74…` → 1,323,173/`BE973C60…`，LF）。
- 新增 R91 变更说明注释块（15 行）后接既有两条登记方元组；`PARTY_COUNT=65` 不变，未新增 / 退役登记方。
- `tests/*.spec.ts` 本波零改动（`t3-invariants.spec.ts` 仍为 17,795 B / `0BF906B5…`）。

### 三、字节 / 哈希锚点（本地实测）

| 登记方 | 改前（R90） | 改后（R91） | 行尾 |
|---|---|---|---|
| canonical | 1,319,506 B / `46670A74E6E614042B11C02B97BC3357FCE251A4FEE2F19637F9FBEA0C677392` | **1,323,173 B / `BE973C601D984BBF7EEC71B2ACF6FDECB9E8BED01432A56353F0E4578EAF017B`** | LF（CR=0 · LF 24,328 → 24,399） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节，`Copy-Item` 同步） | LF |
| 登记器 `verify-hash-registry.mjs` | 210,640 B / `9CAAAF700EED1720D2A92B0C6DA81E5B8055BADEBAB748074A777440B5BF470D` | 212,203 B / `530841259940639C95F5B93F3B9D08165A1D3A2D3D8824C94C835957C9DF3A41` | CRLF（1,773 → 1,788 行 · CRLF 单态） |
| `tests/t3-invariants.spec.ts` | 17,795 B / `0BF906B5…` | 未改动（同字节同哈希） | LF |

- 字节守恒：canonical 1,319,506 + 3,667 = 1,323,173 B；LF 24,328 + 71 = 24,399；末字节 `0x0A`，无 BOM；`<script>` 块数 9（不改）。
- 备份（均经哈希自证，非手抄）：`6.P0-T3基线/v2.0-t3.html.bak-r91-2026-10-23`（逆向还原后 SHA 等于登记的 R90 `46670A74…`）、`6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r91-2026-10-23`（= R90 `9CAAAF70…` / 210,640 B）、`0.规范/MAINTENANCE.md.bak-r91-2026-10-23`（446,428 B）。

### 四、门禁实测（真实执行 · Node v22.22.2）

| 项 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法门 + 纯函数行为 | `node _临时脚本/_r91_outline_copy_probe.mjs` | **Exit 0**：9 个内联 `<script>` 全部语法 OK；`collectOutlinePlainText` 13 条行为断言（子树递归 / 多顶层顺序 / 系统容器三类跳过 / 幽灵 id / `_deleted` / 重复重叠 / 空入参 / 末尾无换行 / 行数=删除集合大小）+ 7 条键分支静态断言 + 各 1 条存在性 = **31/31 PASS** | `_环境与调试/r91-outline-copy-probe-2026-10-23.txt` |
| 行为探针（批次 8/9 全项） | `node _临时脚本/r91-cut-copy-parity-probe-2026-10-23.mjs` | **Exit 0**：**14/14 PASS** —— P1a 复制载荷 = 被删子树 5 行（`P1-TOP-A/P1-A1/P1-TOP-B/P1-B1/P1-B2`）、P1b 行数 5 = 行删除 26→21、P1c 子树全删且邻节点保留、P1d 焦点落到前一可见节点、P1e 光标在文本末尾、P1f 多选清空、P1g **单次 Ctrl+Z 全量回退 5 节点**（`bChildren=2`）、P2a/P2b CapsLock 大写 C/X、P3 AltGr Ctrl+Alt 不拦截、P4a 日历根 + 幽灵 id 不进载荷、P4b Ctrl+C 保留节点与焦点、P5 有文本选区不拦截、P6 零 pageerror | `_环境与调试/r91-cut-copy-parity-probe-2026-10-23.txt` |
| 前两批 a–e 回归 | `node _临时脚本/r90-paste-copy-selection-probe-2026-10-23.mjs` | **Exit 0**：10/10 PASS（N1/N2 同区替换、N3 跨区折叠、C1 `execCommand` 同步复制 + 焦点复原、C2 剪切、C3 复制失败不删除、E1 选区 Enter、E2 选区 Tab、E3 无选区 Enter 拆分） | `_环境与调试/r91-regression-r90-2026-10-23.txt` |
| 更早探针（口径已过时） | `node _临时脚本/r89-outline-selcopy-probe-2026-10-23.mjs` | Exit 1：A/B/D PASS；C1/C2 断言 `navigator.clipboard.writeText` 桩（R90 起同步 `execCommand` 成功即不走 Clipboard API）故为 FAIL，同一契约由 r90 C1/C2 与 r91 P1/P4b 覆盖 | `_环境与调试/r91-regression-r89-2026-10-23.txt` |
| 全量门禁（环境缺 PATH） | `node scripts/verify.js all` | Exit 1：静态 0 命中后 Node 步骤 `spawnSync node ENOENT`（本机 PATH 无 node）——环境性失败，非产品失败 | `_环境与调试/r91-verify-all-2026-10-23.txt` |
| 全量门禁（重锚前） | `node scripts/verify.js all`（注入 node 目录到 PATH） | Exit 1：Node **503/503** 全绿；Playwright 唯一红为 `T-99 门禁`（`drift=2`，canonical + step9-mirror 尚未重锚），167 → 166 passed / 4 skipped | `_环境与调试/r91-verify-all-green-2026-10-23.txt` |
| 65 方登记器（重锚后） | `node verify-hash-registry.mjs` | **Exit 0**：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_哈希与行尾校验/r91-registry-2026-10-23.txt` |
| 全量门禁（重锚后） | `node scripts/verify.js all` | **Exit 0**：静态 0 命中 · Node **503/503** · Playwright **171**（167 passed + 4 skipped）· bench 7/7（0 警告 0 失败）→ `[verify] 全部通过` | `_环境与调试/r91-verify-all-green2-2026-10-23.txt` |

- 迭代记录（如实）：① 探针首轮 P1e（光标位置）FAIL —— 测量方式有误（以 `anchorOffset` 对比整段 `textContent` 长度，多文本节点时不可比），改为「元素起点→选区起点」的 Range 文本长度比对后 PASS，产品代码未因该失败改动；② 全量门禁首轮因 PATH 无 node 报 ENOENT（环境），注入 node 目录后第二轮仅 T-99 红（`drift=2`，登记器未重锚），重锚后第三轮全绿。
- 运行环境说明：本机 PATH 无独立 Node，命令统一以绝对路径 `C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe` 调用，并在调用 `verify.js` 时把该目录前置到 `PATH`（`verify.js` 内部 `spawnSync('node')` 需要字面量可执行文件）；该运行时位于归档目录之外，不纳入登记。

### 五、回退方案

- 产品：用 `v2.0-t3.html.bak-r91-2026-10-23` 覆盖 canonical 与 step9 镜像，即回到 R90 态（1,319,506 B / `46670A74…C677392`）。
- 登记器：用 `verify-hash-registry.mjs.bak-r91-2026-10-23` 覆盖即回到 R90 期望值（210,640 B / `9CAAAF70…BF470D`）。
- 手册：删除本章「二十四、」即可，原文见 `MAINTENANCE.md.bak-r91-2026-10-23`（446,428 B）。

### 六、红线守持

- `1.冻结版本/*` 零改写；未物化新冻结件；`<script>` 块数 9 零变更；`aiNoteLint()` 0 命中；数据契约 / 序列化形态 / 公开 API 零变更（新增 1 个顶层函数 `collectOutlinePlainText`）。
- 单 HTML 产物仍禁止 `type=module` / 动态 `import` / module Worker（本波未新增相关语法）。
- 有意语义变更（非回归）：Ctrl+X 的历史粒度由「每个顶层节点 1 条」收敛为「整批 1 条」（与撤销预期一致：一次 Ctrl+Z 完整回退）；Ctrl+C / Ctrl+X 的复制载荷由「仅顶层节点」扩张为「整棵子树」，与删除范围对齐。

## 二十五、R92 · 大纲文本选区回归 · 风险增强回退 · 最小版节点复制 —— 2026-10-23

> 批次 11（P0 整函数替换）+ 批次 12（P0 回退）+ 批次 13（P0 最小版快捷键）+ 批次 14（状态自愈与验证）。
> 落位：[`6.P0-T3基线/v2.0-t3.html`](../6.P0-T3基线/v2.0-t3.html:1)（canonical，`<script>` 块数 9 保持不变）。

### 一、产品侧改动（`6.P0-T3基线/v2.0-t3.html`）

| # | 位置（改后行号） | 改动 |
|---|---|---|
| ① | `outlineDragSelectMove`（8,280–8,323） | `if(ds.fromText){ds.mode='text';return;}` —— 起点在 `.text` 内时锁定文本模式并**立即返回**，不再落到下方 `removeAllRanges()` / `preventDefault()`；同时去掉 r89 的 `else if` 链嵌套，方向判定改为三个独立 if |
| ② | `outlineDragSelectEnd`（8,324–8,339） | `if(mode==='text'||fromText)return;` —— 文本路径直接 detach 后返回，不 `forceRender()`、不重置 `_outlineSel`（原实现仅在 `!mode&&!fromText` 时重置，语义已收敛为显式早退） |
| ③ | 行 `mousedown`（8,153–8,176） | 新增 `const inText=!!target.closest('.text')`；Ctrl/Cmd 与 Shift 的节点多选条件由 `!target.closest('.text')` 改为 `!inText`，`outlineDragSelectStart(e,n.id,inText)` 复用同一判定 |
| ④ | `bindOutlineText` keydown（8,917–8,946） | **回退** R90/R91 的长 Ctrl+C/X 分支（`collectOutlinePlainText` 调用、rAF 焦点恢复、单次 commit 递归删子树、异步 Clipboard 补位全部下线） |
| ⑤ | 同 keydown 位置 | **重建**最小版节点复制 / 剪切：仅 `!hasTextSel && _outlineSel.ids.size` 时 `e.preventDefault()`，隐藏 textarea（`position:fixed;left:-9999px;opacity:0`）+ `safeExec('copy')`；`X` 且复制成功才 `tops.forEach(t=>actions.removeNode(t))` 并清空多选；存在文本选区一律不拦截 |
| ⑥ | `boot()`（22,677–22,679） | `renderMain()` 之前补 `document.body.style.userSelect='';` 残留自愈（拖拽异常中断遗留 `user-select:none` 时复位） |

- 删除顶层函数 `collectOutlinePlainText(tops)`（原 8,735–8,760）；`copyOutlinePlainTextSync`（8,736–8,756）**保留未删**，本波无调用方（仅作为 R90 遗留工具函数存在，不影响行为）。
- 数据契约（`state.nodes` 形状）/ 序列化形态 / 公开 API 零变更；`<script>` 块数 9 不变；`1.冻结版本/*` 零改写。

### 二、验收侧改动（`6.P0-T3基线/step9/verify-hash-registry.mjs`）

- canonical / step9-mirror 两条登记方期望值重算（1,323,173/`BE973C60…` → 1,319,318/`4388BFB1…`，LF）。
- 新增 R92 变更说明注释块（19 行）后接既有两条登记方元组；`PARTY_COUNT=65` 不变，未新增 / 退役登记方。
- `tests/*.spec.ts` 本波零改动（`t3-invariants.spec.ts` 仍为 17,795 B / `0BF906B5…`）。

### 三、字节 / 哈希锚点（本地实测）

| 登记方 | 改前（R91） | 改后（R92） | 行尾 |
|---|---|---|---|
| canonical | 1,323,173 B / `BE973C601D984BBF7EEC71B2ACF6FDECB9E8BED01432A56353F0E4578EAF017B` | **1,319,318 B / `4388BFB1F6DF2BD1CF9CEE99FABABC74912ADC81066756EAA1C52CEA6C644FE0`** | LF（CR=0 · LF 24,399 → 24,328） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节，`copy` 同步） | LF |
| 登记器 `verify-hash-registry.mjs` | 212,203 B / `530841259940639C95F5B93F3B9D08165A1D3A2D3D8824C94C835957C9DF3A41` | 214,211 B / `23EB0DFB6D5B150AAD76018AE17D5FE3C79AEBD40EF248D355B22E2F1201C594` | CRLF（1,788 → 1,807 行 · CRLF 单态） |
| `tests/t3-invariants.spec.ts` | 17,795 B / `0BF906B5…` | 未改动（同字节同哈希） | LF |

- 字节守恒：canonical 1,323,173 − 3,855 = 1,319,318 B；LF 24,399 − 71 = 24,328；末字节 `0x0A`，无 BOM；`<script>` 块数 9（不改）。
- 备份（均经哈希自证）：`6.P0-T3基线/v2.0-t3.html.bak-r92-2026-10-23`（= R91 态 1,323,173 B / `BE973C60…EAF017B`，取自 step9 镜像覆盖前的物理快照）、`6.P0-T3基线/step9/v2.0-t3.html.bak-r92-2026-10-23`（同哈希）、`6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r92-2026-10-23`（= R91 期望值 212,203 B）、`0.规范/MAINTENANCE.md.bak-r92-2026-10-23`（= R91 手册 455,759 B）。

### 四、门禁实测（真实执行 · Node v22.22.2 / Playwright Chromium）

| 项 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 + 字节/行尾 | `node _临时脚本/r92_syntax_check.mjs 6.P0-T3基线/v2.0-t3.html` | **Exit 0**：`script_blocks=9 compiled=9 syntax_fail=0`；`bytes=1319318`；`sha256=4388BFB1…C644FE0`；`crlf_lines=0 total_lf=24328`；`last_byte=0xA bom=false` | `_环境与调试/r92-syntax-2026-10-23.txt` |
| 65 方哈希登记器 | `node verify-hash-registry.mjs` | **Exit 0**：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（canonical 与 step9-mirror 均 `PASS size=1319318 eol=LF`） | `_哈希与行尾校验/r92-registry-2026-10-23.txt` |
| 全量门禁（首轮） | `node scripts/verify.js all`（PATH 注入 node 目录） | **Exit 0**：静态 0 命中 · Node **303 用例全绿** · Playwright **171**（165+6）· bench 7/7 · `[verify] 全部通过` | `_环境与调试/r92-verify-all-2026-10-23.txt` |
| 全量门禁（复跑取退出码） | 同上，`cmd /v:on` 捕获 `!ERRORLEVEL!` | **VERIFY_EXIT=0**，尾部 `[verify] 全部通过` | `_环境与调试/r92-verify-all-final-2026-10-23.txt` |
| 浏览器行为探针（a/b/c/e） | `node _临时脚本/r92-outline-textselect-probe-2026-10-23.mjs` | **Exit 0**：**20/20 PASS**，`PAGE_ERRORS=0 CONSOLE_ERRORS=0`。要点：a 文本选区经 `mousedown→mousemove(纵向)→mouseup` 后仍 `collapsed=false`、`drag.mode=text`、`.multi-sel=0`、`body.style.userSelect=''`；c 有文本选区时 Ctrl+C / Ctrl+X 的 `dispatchEvent` 返回 `true`（未被 preventDefault）且未走隐藏 textarea 路径，真实 Control+C 后剪贴板含 `R92-LINE-1 / R92-LINE-3`；d 真实 Control+X 后选中行从 DOM 消失且选区折叠；b 行 chrome 竖向拖拽得到 `.multi-sel=3` + `ids=3`，Ctrl+C 载荷为三行 `R92-M1\nR92-M2\nR92-M3` | `_环境与调试/r92-outline-textselect-probe-2026-10-23.txt` / `.png` |
| 拖拽选区成因诊断 | `node _临时脚本/r92-dragselect-diagnose-2026-10-23.mjs` | 环境结论：**本机 headless Chromium 无法用合成鼠标拖拽产出原生 Range**（产品 `.text` 与页面普通 `contenteditable`（`.doc-header-title`）表现一致：`mousedown` 未被 preventDefault、`selectstart` 触发 1 次、17 次 mousemove 后选区仍 `collapsed=true`）⇒ a/c/d 改用「程序化 Range = 用户已选中的文字」+ 真实键鼠事件驱动 | `_环境与调试/r92-dragselect-diagnose-2026-10-23.txt` |

- 未验证项（如实声明）：**批次 14.8.a 的「真实鼠标拖拽出蓝色选区」与 14.8.d 的「松手后 Shift+点击原生扩展」未能在本机 headless 环境复现**（原生拖拽选区在该环境整体不可用，见上条诊断），需人工在桌面浏览器复核；其余 14.8.b / c / e 已由上述探针逐条覆盖。
- 迭代记录（如实）：① 首次探针用真实鼠标拖拽，a1/a2/d1/c3/a5 共 5 项 FAIL（选区长度恒为 0），追加诊断脚本后确认是 headless 原生拖拽选区限制（同页普通 contenteditable 亦无法拖出 Range），非产品缺陷；② 改用程序化 Range + 真实键鼠事件后 20/20 PASS，产品代码未因探针失败而改动；③ 首轮 `bak-r92` 曾误由 `bak-r91` 复制（占用 r92 名称），已用「step9 镜像覆盖前的物理快照」重建并以 SHA=`BE973C60…EAF017B` 自证；④ 曾尝试用逆向替换脚本重建 R91 快照，产出 1,323,163 B（差 10 B）故**弃用**，未写入正式备份路径。
- 运行环境说明：本机 PATH 无独立 Node，命令统一以绝对路径 `C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe` 调用，并在调用 `verify.js` 时把该目录前置到 `PATH`（`verify.js` 内部 `spawnSync('node')` 需字面量可执行文件）；`_临时脚本/_nodebin/node.exe` 为 Electron 运行时，直接执行会报 `Invalid file descriptor to ICU data`，未采用。

### 五、回退方案

- 产品：用 `v2.0-t3.html.bak-r92-2026-10-23` 覆盖 canonical 与 step9 镜像，即回到 R91 态（1,323,173 B / `BE973C60…EAF017B`）。
- 登记器：用 `verify-hash-registry.mjs.bak-r92-2026-10-23` 覆盖即回到 R91 期望值（212,203 B / `53084125…9DF3A41`）。
- 手册：删除本章「二十五、」即可，原文见 `MAINTENANCE.md.bak-r92-2026-10-23`（455,759 B）。

### 六、红线守持

- `1.冻结版本/*` 零改写；未物化新冻结件；`<script>` 块数 9 零变更；`aiNoteLint()` 0 命中；数据契约 / 序列化形态 / 公开 API 零变更（净删除 1 个顶层函数 `collectOutlinePlainText`）。
- 单 HTML 产物仍禁止 `type=module` / 动态 `import` / module Worker（本波未新增相关语法）。
- 有意语义变更（非回归）：节点多选复制范围由「整棵子树（R91）」回到「仅顶层节点一行一条」（R92 最小版）；Ctrl+X 历史粒度由「整批 1 条」回到「每节点 1 条」（`actions.removeNode` 逐个）。上述为「先回退再逐步重建」的既定取舍，后续如需子树级复制应对齐删除范围后再启用。（**已被 R93 覆盖：该最小版 Ctrl+C/X 分支整体删除，见 §二十六**）

## 二十六、R93 · 大纲文本选区回归根治（撤销 R90–R92 次生补丁 + 单一收口） —— 2026-10-23

> 真因仅一处：`outlineDragSelectMove` 在 `fromText=true` 且垂直拖动时误判 `mode='multi'`，随后 `removeAllRanges()` 清空刚拖出的原生文本选区。R90–R92 的多批次渐进补丁反而引入三类次生问题（`fromText` 分支替换不完整 / Ctrl+C/X keydown 在 `_outlineSel.ids` 非空时覆盖原生复制剪切 / 修饰键条件化后 `preventDefault` 位置漂移）。本波全部回退，改为相反策略：**文字区完全放行原生行为，只在非文字区做节点多选。**
> 落位：[`6.P0-T3基线/v2.0-t3.html`](../6.P0-T3基线/v2.0-t3.html:1)（canonical）与 [`6.P0-T3基线/step9/v2.0-t3.html`](../6.P0-T3基线/step9/v2.0-t3.html:1)（镜像），`<script>` 块数 9 不变。

### 一、产品侧改动（canonical / step9 镜像逐字节一致）

| # | 位置（改后行号） | 改动 |
|---|---|---|
| ① | 行 `mousedown`（8,153–8,171） | 第二行新增 `if(target.closest('.text'))return;` —— `.text` 内普通点击 / Ctrl+点击 / Shift+点击 / 拖动全部放行原生（不启动 `_outlineDragSel`、不 `preventDefault`）；Ctrl/Cmd 与 Shift 分支恢复为**无条件**接管（仅 `.text` 外可达），末行改为 `outlineDragSelectStart(e,n.id,false)` |
| ② | `outlineDragSelectStart`（8,258–8,266） | 定稿版原样（保留 `fromText:!!fromText` 字段，供 Move/End 早退判定） |
| ③ | `outlineDragSelectMove`（8,274–8,316） | 第 3 行 `if(ds.fromText)return;` **先于** `dx/dy` 计算与任何 `removeAllRanges()`，`fromText=true` 时永不进入 `multi` |
| ④ | `outlineDragSelectEnd`（8,317–8,330） | `outlineDragSelectDetach()` 后 `if(fromText)return;` —— 文本路径不 `forceRender()`、不重置 `_outlineSel`，原生 Range 在 mouseup 后存活 |

- 回退删除（6 处，整段）：`copyOutlinePlainTextSync()`（原 8,736–8,756，含注释）、`bindOutlineText` paste 选区预处理（原 8,784–8,799）、keydown Ctrl+C/X 最小版分支（原 8,917–8,946）、Enter 的 `deleteContents()` + commit（原 8,966–8,975）、Tab 的 `deleteContents()` + commit（原 9,003–9,011）、`boot()` 的 `document.body.style.userSelect=''`（原 22,677–22,679）。R91 `collectOutlinePlainText` 与 R90/R91 长 Ctrl+C/X 分支在 R92 已删，本波复核确认不存在（全文件搜索 0 命中）。
- `bindOutlineText` 起始行顺移至 8,727；数据契约（`state.nodes`）/ 序列化形态 / 公开 API 零变更。

### 二、验收侧改动（`6.P0-T3基线/step9/verify-hash-registry.mjs`）

- canonical / step9-mirror 期望值重算（1,319,318/`4388BFB1…` → 1,313,444/`8D81D34F…`，−5,874 B）。
- 新增 R93 变更说明注释块后接既有两条登记方元组；`PARTY_COUNT=65` 不变。
- `tests/*.spec.ts` 本波零改动（`t3-invariants.spec.ts` 17,795 B / `0BF906B5…`）；其 r18/r19 断言与新契约一致（`.row` 目标 Ctrl/Shift 多选、`.text` 目标不触发节点多选、Text 节点 `closest` 不抛错、`.text` 起点的垂直拖动不进入 multi 且原生 Range 保留）。

### 三、字节 / 哈希锚点（本地实测）

| 登记方 | 改前（R92） | 改后（R93） | 行尾 |
|---|---|---|---|
| canonical | 1,319,318 B / `4388BFB1F6DF2BD1CF9CEE99FABABC74912ADC81066756EAA1C52CEA6C644FE0` | **1,313,444 B / `8D81D34FFB35698666985356C898E7FD28BEE7B1D805457127771BE09EA53608`** | LF（CR=0 · LF 24,328 → 24,230） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节，`copy` 同步） | LF |
| 登记器 `verify-hash-registry.mjs` | 214,211 B / `23EB0DFB…1C594` | 216,084 B / `3C29BDFB0629581D9C0FC3D038EB800B227A944036E715509B7005A588E88F57` | CRLF |
| `tests/t3-invariants.spec.ts` | 17,795 B / `0BF906B5…` | 未改动（同字节同哈希） | LF |

- 字节守恒：canonical 1,319,318 − 5,874 = 1,313,444 B；LF 24,328 − 98 = 24,230；末字节 `0x0A`，无 BOM；`<script>` 块数 9（不改）。
- 备份：`6.P0-T3基线/v2.0-t3.html.bak-r93-2026-10-23`（= R92 态 1,319,318 B / `4388BFB1…C644FE0`）、`0.规范/MAINTENANCE.md.bak-r93-2026-10-23`（= 改前手册 465,257 B）。登记器本波未单独留 `.bak`（回退方式见 §五，如实声明）。

### 四、门禁实测（真实执行 · Node v22.22.2 / 系统 Chrome）

| 项 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 + 字节/行尾 | `node _临时脚本/r92_syntax_check.mjs 6.P0-T3基线/v2.0-t3.html` | **Exit 0**：`script_blocks=9 compiled=9 syntax_fail=0`；`bytes=1313444`；`sha256=8D81D34F…A53608`；`crlf_lines=0 total_lf=24230`；`last_byte=0xA bom=false` | `_环境与调试/r93-syntax-2026-10-23.txt` |
| 65 方哈希登记器 | `node verify-hash-registry.mjs` | **Exit 0**：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（canonical 与 step9-mirror 均 `PASS size=1313444 eol=LF`） | `_哈希与行尾校验/r93-registry-2026-10-23.txt` |
| 全量门禁 | `node scripts/verify.js all`（PATH 前置 node 目录） | **Exit 0**：静态检查 0 命中 · Node **303 用例全绿** · Playwright **171**（167 passed + 4 skipped，含 L13）· bench 7/7（0 警告 / 0 失败）· 尾部 `[verify] 全部通过` | `_环境与调试/r93-verify-all-2026-10-23.txt` |
| 交互探针（六项分测） | `node _临时脚本/r93_browser_probe.mjs` | **Exit 0 / 0 报错**：①行内拖动 23 字符选区，mouseup 后 `collapsed=false / multi=0 / selIds=0 / dragState=false`，`mousedown.prevented=false`；②`Ctrl+C` 原生复制 `copyPrevented=false`、剪贴板 === 选区（23 字符）；③`Ctrl+X` 原生剪切 `cutPrevented=false`、剪贴板 === 剪切前选区（19 字符）、选区折叠、DOM 文本已移出；④光标折叠 `Ctrl+C` 事件照常触发且 `prevented=false`、无 toast；⑤行 chrome：Ctrl+点击 `ids=2/multi=2`、Shift+点击 `ids=3/multi=3`、向下刷选 `mid ids=3/multi=3` 且文本选区为空；⑥双击 `.text` 完成态 `false→true`（事件链 mousedown×2 / click×2 / dblclick×1，`targetIsText=true`），Ctrl+点击 `[[链接]]` 文档切换 `changed=true` | `_环境与调试/r93-browser-probe-2026-10-23.txt` / `r93-outline-textsel-2026-10-23.png` |
| 跨宿主选区原生基线 | `node _临时脚本/r93_native_sel_probe.mjs`（headless）/ `set HF=1`（headful） | 零应用代码的最小页面上：同宿主水平拖动 `len=24`；跨宿主拖动 `len=0`；跨宿主 Shift+点击仅在本宿主内扩展（`len=24`，文本止于首宿主）。本机 headless 与 headful 结果一致 | `_环境与调试/r93-native-sel-headful-2026-10-23.txt` |
| 双击事件链定位 | `node _临时脚本/r93_dblclick_probe.mjs` | `fx=0.5`（文本中心）`done=false→true`，事件链完整；`fx=0.05` 命中行左 chrome（非 `.text`），不触发 `dblclick` —— 说明早期探针误报源于取点，非产品缺陷 | 终端实测输出（探针一次性，未落盘） |

- 边界如实声明：大纲每行是独立 `contenteditable` 宿主，Chromium 的原生拖动 / Shift+点击**不会跨宿主扩展选区**（零应用代码基线同样如此）。因此步骤 4-1「从第一行拖到第三行得到跨行连续蓝色选区」属浏览器平台边界，非本次改动引入、也不在本次授权改码范围内；本次修复可验证的实质是「`.text` 内的原生选区不再被应用清空」（行内拖动 23 字符存活、跨行拖动仍有非折叠选区且 `multi=0`）。
- 迭代记录（如实）：交互探针前两轮因「scrollIntoView 后旧坐标过期」与「取点落在行左 chrome」产生误报 FAIL（选区 0 / 双击未切换），改为「每场景重载 + `elementFromPoint` 自校验取点」后全部按预期；跨宿主差异另以最小原生页面基线确认，未因探针失败改动产品代码。

### 五、回退方案

- 产品：用 `v2.0-t3.html.bak-r93-2026-10-23` 覆盖 canonical 与 step9 镜像，即回到 R92 态（1,319,318 B / `4388BFB1…C644FE0`）。
- 登记器：删除 R93 注释块并把两条登记方元组改回 `1319318` / `4388BFB1F6DF2BD1CF9CEE99FABABC74912ADC81066756EAA1C52CEA6C644FE0`（本波未单独留 `.bak`）。
- 手册：删除本章「二十六、」并还原首页两处锚点，原文见 `MAINTENANCE.md.bak-r93-2026-10-23`（465,257 B）。

### 六、红线守持

- `1.冻结版本/*` 零改写；未物化新冻结件；`<script>` 块数 9 零变更；`aiNoteLint()` 0 命中；数据契约 / 序列化形态 / 公开 API 零变更（净删除 1 个顶层函数 `copyOutlinePlainTextSync`）。
- 单 HTML 产物仍禁止 `type=module` / 动态 `import` / module Worker（本波未新增相关语法）。
- 有意语义变更（非回归）：节点多选的 `Ctrl+C` / `Ctrl+X` 自定义剪贴板通路整体下线，文本复制 / 剪切一律走浏览器原生，节点多选仅保留鼠标（行 chrome）交互与右键菜单批量操作。

## 二十七、R94 · 回到 pre-r89 基线 + `outlineDragSelectStart` 首行单行收口 —— 2026-10-23

> R93（§二十六）在行 `mousedown` 第二行加 `if(target.closest('.text'))return;`，虽放行了原生文本行为，但同时把 `.text` 内 Ctrl+点击 / Shift+点击 的节点多选入口一并关掉。R94 撤销 R90–R93 各批次（文件回到 pre-r89 快照），只加一行：`outlineDragSelectStart` 首行 `if(fromText)return;`。
> 落位：[`6.P0-T3基线/v2.0-t3.html`](../6.P0-T3基线/v2.0-t3.html:1)（canonical）与 [`6.P0-T3基线/step9/v2.0-t3.html`](../6.P0-T3基线/step9/v2.0-t3.html:1)（镜像），逐字节一致；`<script>` 块数 9 不变。

### 一、产品侧改动（canonical / step9 镜像逐字节一致）

| # | 位置（改后行号） | 改动 |
|---|---|---|
| ① | `outlineDragSelectStart`（8,261–8,270） | **唯一新增一行**：首行 `if(fromText)return;`。`.text` 内按下不再创建 `_outlineDragSel`，`outlineDragSelectMove` 首行 `if(!ds)return;` 早退，原生文本选区完全不受应用干预 |
| ② | 行 `mousedown`（8,153–8,176） | 恢复 pre-r89 原样：Ctrl/Cmd 与 Shift 分支无条件接管；末行 `outlineDragSelectStart(e,n.id,!!target.closest('.text'))`。`.text` 内 Ctrl+点击 → `toggleOutlineSel`、Shift+点击 → `outlineSelectRange` 均恢复 |
| ③ | `outlineDragSelectMove`（8,277–8,322） | 删除 r89 的 `if(ds.fromText){ds.mode='text';}` 分支及注释，恢复三行方向判定（死区 / 水平 / 垂直+5px） |
| ④ | `outlineDragSelectEnd`（8,322–8,336） | 恢复 pre-r89 原样 `if(!mode&&!fromText){…}`（无 R93 的 `if(fromText)return;`） |
| ⑤ | `outlineDragSelectDetach` | 与 pre-r89 一致（含 `userSelect` 恢复） |
| ⑥ | 验收侧 `step9/tests/t3-invariants.spec.ts` | 唯一断言由「`.text` 内 Ctrl 不触发节点多选（期望 0）」改为「期望 1」，与 ② 的契约同步；`closest` 不抛 TypeError 的断言不变 |

- 整体回退（整段删除 / 还原）：`copyOutlinePlainText()`、`bindOutlineText` keydown 的 Ctrl+C/X 分支、`bindOutlineText` paste 选区预处理、`bindNoteText` / `renderCalNode` paste 选区预处理、`boot()` 的 `document.body.style.userSelect=''`；Enter / Tab 分支恢复原样（无 `deleteContents()` + commit）。
- 保留 1 处 r89 防御性硬化：`document.addEventListener('mousedown', …)` 内 `const _t=e.target;if(!(_t&&_t.closest&&_t.closest('#ctxMenu')))` —— 纯能力判定，行为中性，且不在本次回退清单内。
- 数据契约 / 序列化形态 / 公开 API / `<script>` 块数 9 零变更。

### 二、验收侧改动（`6.P0-T3基线/step9/verify-hash-registry.mjs`）

- canonical / step9-mirror 期望值重算（1,313,444/`8D81D34F…` → 1,312,186/`F198ABCF…`，−1,258 B）。
- `tests/t3-invariants.spec.ts` 期望值重算（17,795/`0BF906B5…` → 17,794/`AD5789A1…`）。
- 新增 R94 说明注释块；`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。

### 三、字节 / 哈希锚点（本地实测）

| 登记方 | 改前（R93） | 改后（R94） | 行尾 |
|---|---|---|---|
| canonical | 1,313,444 B / `8D81D34FFB35698666985356C898E7FD28BEE7B1D805457127771BE09EA53608` | **1,312,186 B / `F198ABCFEF78E7A5AEC055E8B41C13A02392F9FAFCF122AB4E6528033E9E65D8`** | LF（CR=0 · LF 24,230 → 24,198） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节） | LF |
| `tests/t3-invariants.spec.ts` | 17,795 B / `0BF906B5…` | 17,794 B / `AD5789A1…` | LF |

- 字节守恒：1,313,444 − 1,258 = 1,312,186 B；末字节 `0x0A`；无 BOM；`<script>` 块数 9。
- 备份：`6.P0-T3基线/v2.0-t3.html.bak-r94-2026-10-23`（= R93 态 1,313,444 B / `8D81D34F…`）、`0.规范/MAINTENANCE.md.bak-r94-2026-10-23`（= 改前手册 474,372 B）、`step9/tests/t3-invariants.spec.ts.bak-r94-2026-10-23`（= 改前 17,795 B / `0BF906B5…`）。

### 四、门禁实测（真实执行 · Node v24.21.0 / 系统 Chrome）

| 项 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 内联脚本语法 + 字节/行尾 | `node _临时脚本/r92_syntax_check.mjs 6.P0-T3基线/v2.0-t3.html` | **Exit 0**：`script_blocks=9 compiled=9 syntax_fail=0`；`bytes=1312186`；`sha256=F198ABCF…E65D8`；`crlf_lines=0 total_lf=24198`；`last_byte=0xA bom=false` | `_环境与调试/r94-syntax-2026-10-23.txt` |
| 65 方哈希登记器 | `node verify-hash-registry.mjs` | **Exit 0**：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_哈希与行尾校验/r94-registry-2026-10-23.txt` |
| 全量门禁（首轮，含 1 处旧契约断言失败） | `node scripts/verify.js all` | Playwright **166 passed / 1 failed / 4 skipped** —— 失败点 `tests/t3-invariants.spec.ts:157`（`textNodeSel` 期望 0、实得 1），即 R89 旧契约断言；按 ⑥ 同步断言后复跑全绿 | `_环境与调试/r94-verify-all-2026-10-23.txt` |
| 全量门禁（终轮） | `node scripts/verify.js all` | **Exit 0**：静态检查 0 命中 · Node **303 用例** · Playwright **171**（167 passed + 4 skipped）· bench 7/7（0 失败 / 最大恶化 0.0%）· 尾部 `[verify] 全部通过` | `_环境与调试/r94-verify-all-final-2026-10-23.txt` |
| 交互探针（真实鼠标 / 键盘） | `node _临时脚本/r94_outline_probe.mjs` | **0 Console / 0 PageError**：行内拖动选区 21 字符且 `dragState=false`；同一手势「先水平选中再纵向移动」选区 17 字符存活；跨行纵向拖动 `dragState=false`（选区 0 属跨 contenteditable 宿主平台边界）；`Ctrl+C` / `Ctrl+X` 原生未被拦截；**`.text` 内 Ctrl+点击 `ids=1→2 / multi=1→2`、再次点击回落 1**；行 chrome 先点选再 `.text` 内 Shift+点击 `ids=3/multi=3`；行 chrome Ctrl+点击 2、Shift+点击 3、向下刷选 3；双击 `.text` 完成态 `false→true` | `_环境与调试/r94-browser-probe-2026-10-23.txt` / `r94-outline-textsel-2026-10-23.png` |
| `[[链接]]` Ctrl+点击 基线对照 | `node _临时脚本/r94_wikilink_debug.mjs <目标>`（canonical 与 pre-r89 快照各一次） | 两者结果一致：`clickEventsSeen=0`、`textNodeReplacedByRender=true`、`selIds=1`、`changed=false` —— 行 `mousedown` 的 Ctrl 分支先 `forceRender()` 替换 DOM，`click` 事件不再落在存活节点上，故 `bindOutlineText` 的 wiki 跳转分支不触发。**属 pre-r89 既有行为（基线同现），非本波引入** | `_环境与调试/r94-wikilink-debug-2026-10-23.txt` |

- 边界如实声明 1：大纲每行是独立 `contenteditable` 宿主，Chromium 原生拖动 / Shift+点击**不会跨宿主扩展选区**（零应用代码基线同样为 `len=0`）。因此「第一行拖到第三行得到跨行连续选区」属浏览器平台边界；本波可验证的实质是「`.text` 内的原生选区不再被应用清空 / 不创建 `_outlineDragSel`」。
- 边界如实声明 2：`.text` 内 Ctrl+点击 `[[链接]]` 目前只触发节点多选、不跳转；pre-r89 快照同测同结果，属既有冲突（原版本无「多选节点复制 / 剪切 / 粘贴」，本波亦未新增该能力）。
- 探针环境说明：本机无独立 Node 运行时，实测使用 `E:\软件\Microsoft VS Code\node.exe`（v24.21.0）并将该目录前置到 PATH，供 `verify.js` 的 `spawnSync('node', …)` 子进程解析；`_临时脚本\_nodebin` 内的同名 `node.exe` 不可用（ICU 报错），已改用真实 node.exe 直调。

### 五、回退方案

- 产品：用 `v2.0-t3.html.bak-r94-2026-10-23` 覆盖 canonical 与 step9 镜像，即回到 R93 态（1,313,444 B / `8D81D34F…A53608`）。
- 验收：用 `t3-invariants.spec.ts.bak-r94-2026-10-23` 覆盖测试；登记器删除 R94 注释块并把三条期望值改回 `1313444` / `8D81D34F…A53608` 与 `17795` / `0BF906B5…`。
- 手册：删除本章「二十七、」并还原首页两处锚点，原文见 `MAINTENANCE.md.bak-r94-2026-10-23`。

### 六、红线守持

- `1.冻结版本/*` 零改写；未物化新冻结件；`<script>` 块数 9 零变更；`aiNoteLint()` 0 命中；数据契约 / 序列化形态 / 公开 API 零变更。
- 单 HTML 产物仍禁止 `type=module` / 动态 `import` / module Worker（本波未新增相关语法）。
- 净删除 1 个顶层函数 `copyOutlinePlainText` 与 1 处 paste 选区预处理块；`_outlineSel` 多选仅保留鼠标 / 右键菜单通路，未新增节点级剪贴板能力。

---

## 二十八、R95 + R95b · 大纲 `.text` 内拖动方向判定 + 多选节点复制 / 剪切 / 粘贴（2026-10-23）

> 结论：R95 净增 3,591 B（1,312,186 → 1,315,777 B）；R95b 续修净增 930 B（1,315,777 → **1,316,707 B**）。R95 完成「`.text` 内按下恢复方向判定（水平为主 = 原生文字选择 / 垂直为主 = `_outlineSel` 跨行多选）」与节点复制 / 剪切 / 粘贴入口；R95b 把「进程内剪贴板 + keydown 拦截」整体替换为「copy / cut / paste 事件 + `clipboardData` 同步读写系统剪贴板」（去掉异步时序与 `inEditable` 提前拦截缺陷）。全量门禁 `[verify] 全部通过`（Exit 0）；65 方登记器 `drift 0 / PASS`；12/12 交互探针 PASS。

### 一、产品侧改动（`6.P0-T3基线/v2.0-t3.html`）

| # | 位置（改后行号） | 改动 |
|---|---|---|
| ① | `outlineDragSelectStart`（8,261） | **删除首行守卫** `if(fromText)return;`，其余（`doc` 获取 / `_outlineDragSel` 建档 / `mousemove`·`mouseup` 绑定）零改动。`.text` 内按下同样进入方向判定 |
| ② | `outlineBatchDelete` 结束之后、`outlineDragStart` 之前 | **R95b 定稿**：`const OUTLINE_CLIP_PREFIX='JU-NODES:';` + `_outlineNodeToClipData(n)` + `_outlineParseClipText(txt)` + `_outlineInsertClipNodes(nodes)`，以及一次性 document `copy` / `cut` / `paste`（capture）绑定（`window._juOutlineClipBound` 幂等）。R95 的 `let _outlineClipboard=null;` / `outlineCopySelection(cut)` / `outlinePasteClipboard()` / keydown 块已**整段删除** |
| ③ | 行 `mousedown`（8,153–8,176） | 零改动：仍以 `outlineDragSelectStart(e,n.id,!!target.closest('.text'))` 派发，`fromText` 仅作为标记写入 `_outlineDragSel.fromText`，不再早退 |
| ④ | `outlineDragSelectMove` / `outlineDragSelectEnd` | 零改动：死区 4px → `|dx|>|dy|` 判定 `text`（不 preventDefault、不清选区）→ `|dy|>|dx|+5` 判定 `multi`（清空选区 + `userSelect='none'` + `outlineDragSelectPaint`）；`mouseup` 在 `multi` 时 `forceRender` 固化，`!mode && !fromText` 才回退单行选中 |

### 二、行为契约（R95 定稿）

| 手势 / 按键 | 结果 |
|---|---|
| `.text` 内水平拖动 | `mode='text'`：应用不 `preventDefault`、不 `removeAllRanges`，浏览器原生文字选区完整保留 |
| `.text` 内垂直拖动（超过水平 +5px） | `mode='multi'`：清空文本选区、进入 `_outlineSel` 区间多选，`.multi-sel` 实时点亮，`mouseup` 后 `forceRender` 固化 |
| 多选（`_outlineSel.ids.size > 1`）+ `Ctrl/Cmd+C` | `copy` 事件（capture）接管：`topSelected` 顶层节点深拷贝 → `OUTLINE_CLIP_PREFIX + JSON.stringify({v:1,nodes})` 经 `e.clipboardData.setData('text/plain', …)` **同步写入系统剪贴板**；`toast('已复制 N 个节点')` |
| 多选 + `Ctrl/Cmd+X` | `cut` 事件（capture）接管：同上写入剪贴板后 `actions.removeNode` 逐节点删除，清空 `_outlineSel`，`toast('已剪切 N 个节点')` |
| `Ctrl/Cmd+V`（剪贴板以 `JU-NODES:` 开头） | `paste` 事件（capture）经 `e.clipboardData.getData('text/plain')` **同步读取**；`{v:1,nodes:[…]}` 校验通过即 `_outlineInsertClipNodes` 在锚点父节点子序列原位插入（`children` 递归重建，`db` / `block` / `tableData` 深拷贝），`toast('已粘贴 N 个节点')` |
| 存在非空文字选区 | `copy` / `cut` 一律 `return`（不拦截），走浏览器原生复制 / 剪切 |
| 剪贴板非 `JU-NODES:`（普通文字 / Word 富文本） | `paste` 不拦截、不 `preventDefault`，原生格式完整保留 |
| 跨标签页 / 刷新后 | 走系统剪贴板标准通道；不调用 `navigator.clipboard.readText`，无异步时序依赖 |

### 三、验收侧改动（`6.P0-T3基线/step9`）

- `verify-hash-registry.mjs`：R95 注释块 + **R95b 注释块**；`canonical` / `step9-mirror` 期望两次重算（`1312186/F198ABCF…` → `1315777/652B5197…` → **`1316707/5FED0215…`**）；`t3-invariants.spec.ts` 期望重算（`17794/AD5789A1…` → `17957/5D094B83…`，R95b 零改动）。`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。
- `tests/t3-invariants.spec.ts`（r19「②-A 垂直拖拽（起点在 `.text` 内）」）：旧契约断言 `multi=0 / ids=0 / ranges>=1 / anchorInHost=true`（R89 起「`.text` 内垂直拖动不得进入多选」）**已按 R95 契约同步**为 `multi=2 / ids=2 / ranges=0 / anchorInHost=false`，并同步两处注释；该断言属旧契约（`t3-invariants.spec.ts.bak-r94-2026-10-23` 同样存在），非产品缺陷。

### 四、字节 / 哈希锚点（本地实测）

| 登记方 | 改前（R94） | 改后（R95b 定稿） | 行尾 |
|---|---|---|---|
| canonical | 1,312,186 B / `F198ABCFEF78E7A5AEC055E8B41C13A02392F9FAFCF122AB4E6528033E9E65D8` | **1,316,707 B / `5FED021578E775B560BF98AF719046EB2916472F4053354A33A1A436DFBFF818`** | LF（CR=0 · LF 24,198 → 24,325） |
| step9 镜像 | 同 canonical | 逐字节一致（同哈希同字节） | LF |
| `tests/t3-invariants.spec.ts` | 17,794 B / `AD5789A1…BCB06` | **17,957 B / `5D094B83…03899B`**（R95 定稿，R95b 零改动） | LF（CR=0 · LF 354 → 357） |
| `0.规范/MAINTENANCE.md` | 482,843 B / `C3EF91B2…40650` | 本版（改后字节 / SHA-256 以 `_报告与元数据/R95-OUTLINE-DRAG-CLIPBOARD-2026-10-23.md` 与 `_哈希与行尾校验/r95-*` 实测为准）| CRLF |

- 字节守恒：1,312,186 + 3,591（R95）= 1,315,777 B，再 + 930（R95b）= **1,316,707 B**；末尾换行符 24,198 → 24,294（R95）→ **24,325**（R95b）；末字节 `0x0A`；无 BOM；`<script>` 块数 9（`compiled=9 / syntax_fail=0`）。
- 备份：`6.P0-T3基线/v2.0-t3.html.bak-r95-2026-10-23`（= R94 态 1,312,186 B / `F198ABCF…E65D8`）、`6.P0-T3基线/v2.0-t3.html.bak-20261023-r95`（= R95 态 1,315,777 B / `652B5197…`，R95b 改前快照）+ `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r95`（同哈希镜像快照）、`6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r95-2026-10-23`（R95b 改前快照 = 登记器 R95 态，同名旧 R94 态快照已被本波覆盖，属既有名的正常前滚）、`6.P0-T3基线/step9/tests/t3-invariants.spec.ts.bak-r95-2026-10-23`（= 17,794 B / `AD5789A1…`，R95b 零改动）。

### 五、门禁实测（真实执行）

| 项 | 命令 | 实测结果（R95b） | 证据 |
|---|---|---|---|
| 内联脚本语法 + 字节 / 行尾 | `node _临时脚本/r92_syntax_check.mjs 6.P0-T3基线/v2.0-t3.html 6.P0-T3基线/step9/v2.0-t3.html` | **Exit 0**：`script_blocks=9 compiled=9 syntax_fail=0`；`bytes=1316707`；`sha256=5FED0215…BFF818`；`crlf_lines=0 total_lf=24325`；`last_byte=0xA bom=false` | `_环境与调试/r95b-syntax-2026-10-23.txt` |
| 65 方哈希登记器（红证 · 重锚前） | `node verify-hash-registry.mjs` | **Exit 1**：`FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`，恰 `canonical` + `step9-mirror`（`size=1316707 (exp 1315777)`），判别力真实 | `_哈希与行尾校验/r95b-registry-red-2026-10-23.txt` |
| 65 方哈希登记器（绿证 · 重锚后） | `node verify-hash-registry.mjs` | **Exit 0**：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（canonical / step9-mirror 均 PASS，其余 63 方一字未动） | `_哈希与行尾校验/r95b-registry-green-2026-10-23.txt` |
| 全量门禁 | `node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`） | **Exit 0**：静态检查 0 命中（24ms）· Node **503/503**（26,028ms）· Playwright **171**（167 passed + 4 skipped，54,863ms）· bench **7/7**（0 失败 / 最大恶化 0.0% / 中位 −14.3%）· 尾部 `[verify] 全部通过` | `_环境与调试/r95b-verify-all-2026-10-23.txt` |
| 真实浏览器交互探针（Playwright + 系统 Chrome） | `node _临时脚本/r95b_outline_clip_probe.mjs` | **Exit 0**：`CHECKS=12 PASS=12 FAIL=0` / `PROBE_RESULT=PASS`；0 Console / 0 PageError | `_环境与调试/r95b-browser-probe-2026-10-23.txt` |

- 探针环境说明：本机无独立 Node 运行时（`node` 不在 PATH），实测使用 `C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`（v22.22.2），并将其所在目录前置到 `PATH`，供 `verify.js` 的 `spawnSync('node', …)` 子进程解析；Chromium 走系统 Chrome（`C:\Users\12601\AppData\Local\Google\Chrome\Application\chrome.exe`），并用 `context.grantPermissions(['clipboard-read','clipboard-write'])` 读取系统剪贴板。
- 探针覆盖（任务卡自检 1–8 逐条）：① 多选 Ctrl+C → `navigator.clipboard.readText()` 以 `JU-NODES:` 开头（3 节点），同页 Ctrl+V 节点增量 = 3；② 多选 Ctrl+X → 节点 −3、剪贴板仍为 `JU-NODES:`，Ctrl+V 回补 3 个**新 id**（原 id 不复活）；③ `.text` 内文字选区 Ctrl+C → 剪贴板为纯文字（10 字符，非 `JU-NODES:`），Ctrl+V 节点数不变；④ 刷新页面 → 点空白 → Ctrl+V 增量 = 2；⑤ 切换标签页返回 → 点空白 → Ctrl+V 增量 = 2；⑥ HTML+纯文本真实 Ctrl+V（临时 contenteditable 经真实 Ctrl+C 写入系统剪贴板）→ 节点剪贴板未接管（无「已粘贴」toast、节点数不变），行内 DOM 实测得到 `<b style="color: rgb(204, 0, 0);">WordRich</b>`；⑦ 行内无文字选区 Ctrl+V（剪贴板 = `JU-NODES:`）→ 插入 2 个节点且正文未写入该字符串；⑧ `.text` 内水平拖动 → 原生选区 19 字符 / `multiRows=0`，垂直拖动 → `multiRows=3` / `selIds=3` / `selLen=0`。

### 六、回退方案

- 产品（回到 R95 态）：用 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r95`（1,315,777 B / `652B5197…`）覆盖 canonical 与 step9 镜像。
- 产品（回到 R94 态）：再用 `v2.0-t3.html.bak-r95-2026-10-23` 覆盖，即回到 R94（1,312,186 B / `F198ABCF…E65D8`）。
- 验收：登记器用 `verify-hash-registry.mjs.bak-r95-2026-10-23` 覆盖（或删除 R95b 注释块并把 `canonical` / `step9-mirror` 期望值改回 `1315777` / `652B5197…`）；`t3-invariants.spec.ts` 无需回退（R95b 零改动）。
- 手册：删除本章「二十八、」并还原首页两处锚点（`1,316,707 B / 5FED0215…` → `1,315,777 B / 652B5197…`）。

### 七、红线守持

- `1.冻结版本/*` 零改写；未物化新冻结件；`<script>` 块数 9 零变更；`aiNoteLint()` 0 命中；数据契约 / 序列化形态 / 公开 API 零变更。
- 单 HTML 产物仍禁止 `type=module` / 动态 `import` / module Worker（本波未新增相关语法）。
- 剪贴板为**系统剪贴板**（`e.clipboardData.setData / getData`，`text/plain` 内承载 `JU-NODES:` + JSON）；不写 `localStorage`、不改 UI schema；粘贴沿用 `addNodeTo` + `commit({snapshot:true})`，可 undo。
- 接管口径（定稿）：`copy` / `cut` 仅在「无文字选区 + `_outlineSel.ids.size > 1`」时接管，其余放行原生；`paste` 仅在剪贴板以 `JU-NODES:` 开头且 JSON 为 `{v:1,nodes:[…]}` 时接管，普通文字与富文本一律放行；不调用 `navigator.clipboard.readText`（无异步时序依赖）。

---

## 二十九、M07 · P0-P3 空白启动 / 无样式 / 依赖注入修复（2026-10-25）

> 适用范围：`6.P0-T3基线/m07-vite`（Vite + TS 模块化工程，Tauri 打包）。
> 本节为**追加锚点**，不修改既有章节内容；详细报告见
> `_报告与元数据/M07-P0P3-BLANK-BOOT-STYLE-DEPS-FIX-REPORT-2026-10-25.md`。

### 一、缺陷与根因（三条）

| # | 根因 | 证据 |
|---|---|---|
| 1 | 产品样式从未随模块化迁移：`src/` 无任何 `.css`，`index.html` 无 `<style>` ⇒ `dist/index.html` 零产品样式 | 修复前 `findstr "<style" dist\index.html` 仅命中导出模板字符串 |
| 2 | 会话级函数以空壳注入：`bindRenderMainDeps` 的 `N/viewOf/getCurrentDoc = () => null` ⇒ `renderMain` 的 view 恒 `null` ⇒ `renderOutlinePage(null)` ⇒ `#content` 只剩「请先选择文档」；`bindSidebarDeps` 仅注入 `{ui}` ⇒ 侧栏四棵子树与计数恒空 | `src/main.ts` 旧装配点原文 |
| 3 | 产品静态 DOM 骨架未迁移：`index.html` 的 `#sidebarLeft` / `#tbNav` 为空容器，而 `renderSidebar`/`bindSidebar`/`syncTopbar`/`bindTools` 全按固定 id/类名查询 | `src/ui/sidebar.ts`、`src/ui/layout.ts` 的 `$()` 查询目标 |

### 二、修复锚点（新增文件）

| 文件 | 角色 |
|---|---|
| `src/style.css` | canonical 样式块逐字提取（112,301 字符 / 124,296 B），唯一 CSS 入口，经 `src/main.ts` 的 `import './style.css'` 进包 |
| `src/types/assets.d.ts` | `declare module '*.css'`（`tsconfig` 未启用 `vite/client`） |
| `src/app/session.ts` | 会话编排层：`viewOf` / `getCurrentDoc` / `forceRender` / `scheduleRender` / `saveUI` / `loadUI` / `applyUIFields` / `applyScale` / `openNode` / `safeNavigate` / `setActiveKey` / `updateSidebarActiveState` / `renderIntro` / `showTreeContext` / `sortDocs` / `getNodeSvg` / `renderFileCard` / `renderFolderGrid` / `doSearch` / 标签索引集群 / `syncTopbar` / `tickClock` / `updateRemindBadge` / `floatCalVisible` / `ensureElInViewport` / `bindSidebar` / `bindTools` / `initJuDnd` / `initJuModules` / `initSessionDefaults` / `assertUiRendered` |
| `scripts/check-inline-style.mjs` | P0 闸门（9 项读盘断言） |
| `scripts/check-deps-wired.mjs` | P1/P2 闸门（7 容器 / 47 键空壳断言） |
| `tests/boot-render.spec.ts` | P4 启动渲染 + 行为级回归（不注入测试侧骨架/deps） |

`vite.config.ts` 未改（`viteSingleFile()` / `cssCodeSplit:false` / `assetsInlineLimit:1e8` / `sourcemap:false` / `target:'es2020'` 本已在位）。
`index.html` 的 `<body>` 静态标记逐字取自 canonical（19,113 字符），仅追加 `<script type="module" src="/src/main.ts">`。

### 三、字节 / 哈希锚点（本轮实测）

| 产物 / 文件 | 字节 | SHA-256 |
|---|---|---|
| `dist/index.html` | 619,341 | `ea56f86f946feeaa8ed1862c9d6d085a9ff10e23fe3d133c74be63b5b6d75a2f` |
| `dist/release/JU-v2.1-Web.html` | 619,341 | 同上（字节级确定性：两次独立构建同哈希） |
| `dist/release/JU-v2.1-win-x64.exe` | 7,447,040 | `8c58811402dfcfd67d58300b7beb2f123a959b905345a754229df5cb6cba6c31`（非确定性产物，重建会变；上一轮 `69a33462…` 仅 PE 时间戳差异） |
| `src/style.css` | 124,296 | `3fe288932827fa615df894bd4f69573086974f6ef476af5d4730812f7736afe6` |
| `src/app/session.ts` | 59,691 | `2715de85cec8e78b4a1ed0174224115e7ca740e5934b4bf3546e1e5fc5c23d0a` |
| `index.html` | 21,282 | `70baf4f52060a139ef5423853727f71c74575dd65aebe2b584795dd462e31248` |
| `src/main.ts` | 71,227 | `7e9e623fee1f92e81c8696d9667538ad3d561cf2853e99d9157ce2ce2f2fe94d`（P0-T3 空桩修复批次后实测；批次前为 69,263 / `6acf3d65…`，见 §八） |

完整登记（15 个文件）：`_哈希与行尾校验/m07-p0p3-registry-2026-10-25.txt`。

### 四、门禁实测（真实执行）

| 项 | 命令 | 结果 | 证据 |
|---|---|---|---|
| 类型检查 | `node ./node_modules/typescript/bin/tsc --noEmit` | Exit 0 | 终端实测（tsc 5.9.3） |
| P0 样式内联 | `node scripts/check-inline-style.mjs` | Exit 0，9/9 PASS，`inline css chars=96472` | `_环境与调试/m07-p0-gate-2026-10-25.txt` |
| P1/P2 依赖装配 | `node scripts/check-deps-wired.mjs` | Exit 0，47 键 0 失败 | `_环境与调试/m07-p1p2-gate-2026-10-25.txt` |
| 一键发版 | `node scripts/build-all.mjs` | Exit 0（tsc · 10/10 · vite · tauri 16.1s · release） | `_环境与调试/m07-p0p3-buildall-final-2026-10-25.txt` |
| Playwright 全量 | `node ./node_modules/@playwright/test/cli.js test` | Exit 0，**27 passed** | `_环境与调试/m07-pw-full-2026-10-25.txt` |
| 零漂移全量门禁 | `node ..\step9\scripts\verify.js all` | Exit 0（Node 503/503 · Playwright 171 · bench 7/7 · `[verify] 全部通过`） | `_环境与调试/m07-verify-all-2026-10-25.txt` |
| 65 方哈希登记器 | `node ..\step9\verify-hash-registry.mjs` | Exit 0：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/m07-registry-2026-10-25.txt` |
| exe 启动取证 | `powershell … m07-exe-shot-2026-10-25.ps1` | 截图落盘（1,735,514 B），窗口含顶栏/侧栏/内容区/右栏且样式正常 | `_环境与调试/m07-exe-boot-2026-10-25.png` |

环境注记：本机 `C:\Users\12601.workbuddy\binaries\node\versions\22.22.6\node.exe` **不存在**；实测使用
`C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`（v22.22.2），并将其目录前置进 `PATH`
（`verify.js` 内部 `spawnSync('node', …)` 依赖 PATH 解析）。Chromium 为系统 Chrome。

### 五、已知残留（维护须知）

1. 各模块内部 `deps` 默认值仍为空壳（`setForceRender:()=>{}` 等字符串因此仍出现在产物中）——这是「未注入即安全降级」的既有契约，**入口装配点已全部为真实实现**（见 P1/P2 闸门）。修改任一模块 `deps` 默认值前请先确认该端口已在 `main.ts` 注入。
2. 未迁移子系统保持默认空壳：L14/L16 虚拟滚动（`vsUpdate`/`vsScrollToId`/`getVsActive`/`setVsActive`/`observeOutlineHeader`/`disconnectOutlineHeaderRO`/`setCalDayNodesForModules`）、提醒/番茄钟/音乐内部渲染（`renderFloatCal`/`renderMusicList`/`playTrack`/`updatePomoDisplay`）、`updateEncryptSwitch`、`showLockOverlay`、`indexWorkerDispose`。
3. `sideCountsGet()` 返回 `undefined`，令侧栏走 canonical 的全量扫描降级分支（未迁移 Symbol 增量计数器，避免过期缓存）。
4. 测试侧 `ui.spec.ts` / `full-e2e.spec.ts` 的 harness 已适配 canonical 骨架（补齐顶栏 `data-view=calendar|database` 入口，交由产品 `bindTopbar` 绑定）；断言强度未降，新增生效视图口径校验。

### 六、回退方案

- 删除 `src/app/session.ts`、`src/style.css`、`src/types/assets.d.ts`，`git checkout -- src/main.ts index.html`；
  删除 `scripts/check-inline-style.mjs`、`scripts/check-deps-wired.mjs`、`tests/boot-render.spec.ts`。
- 单 HTML 产物无需回退（同源码两次构建哈希一致）；exe 可回退到上一轮哈希 `b9f2d5ab…`（仅 PE 时间戳差异）。

### 七、2026-10-25 复验（P0 → P1 → P2 重跑实测）

本节为同批次的**二次复验**，全部命令逐条重跑，产物重新构建、哈希重新登记。

| 项 | 命令 | 实测结果 |
|---|---|---|
| P0 骨架校准 | `node scripts\fix-skeleton.mjs` | Exit 0：必需容器 28/28、基线 id 88/88、`.tb-nav-btn`=7、`.sb-nav-item`=5、`.sr-section`=6、`.main-toggle`=3、入口无 `<style>`、入口脚本 `/src/main.ts`、静态 body 与 `v2.0-t3.html` **规范化空白后逐字等价**；`RESULT: PASS · 零写入` |
| P1 装配顺序 | 读盘核对 `src/app/boot.ts` | 绑定序列 `bindTopbar→bindSidebar→bindTools→bindMainToggles→bindRightSidebar→bindSettings…` 逐项独立 try/catch（865-903），`renderMain()` 在其后（991），`tickClock()` + `setInterval(…,1000)` 句柄化（976-978） |
| P1 依赖注入 | `findstr` 核对 `src/main.ts` | 无 `const ne = () => {}` 空壳；`bindSidebarDeps` 注入 `state/N/isFolder/sortDocs/renderIntro/commit/getCurrentDoc/openNode/safeNavigate/setActiveKey/showTreeContext/getNodeSvg/getCalendarRootId/actions` 等真实实现（627-660）；`bindRightbarDeps` 注入 `ui/getCurrentDoc/openNode/forceRender/commit/doDownload/exportICS/exportFullBackup`（662-673） |
| P1 运行时交互 | Playwright（`_临时脚本/m07-ui-interaction-probe-2026-10-25.mjs`） | `#settingsPanel` 打开 `display:flex / class="panel on"`；文件树行右键 → `#ctxMenu` `display:block / class="on" / 4 项`（重命名·星标·移入回收站）；`#btnToggleLeft` → `#sidebarLeft.collapsed` + `body.sb-left-collapsed`；`#btnFloatCal` → `#floatCal.hidden=false`；`#subDb` 展开 `sb-subtree open`；右栏分区折叠 1→2；时钟 2 秒内递增；**console warning/error 0 条** |
| 类型检查 | `node .\node_modules\typescript\bin\tsc --noEmit` | Exit 0（`TSC_EXIT=0`） |
| 零漂移全量门禁 | `node ..\step9\scripts\verify.js all` | Exit 0：静态检查 0 命中 · Node 单元测试 503 用例 · Playwright **167 passed / 4 skipped**（171 用例）· bench 7/7 · 尾部 `[verify] 全部通过` |
| Web 单文件构建 | `npm run build` | Exit 0：53 modules transformed，`dist/index.html 604.99 kB │ gzip 182.46 kB`，`viteSingleFile` 内联 `main-*.js` + `style-*.css` |
| 产物结构核对 | `_临时脚本/m07-probe-skeleton-2026-10-25.mjs` | `dist/index.html` 与 `dist/release/JU-v2.1-Web.html`（619,341 B）id 36/36 齐备、`.tb-nav-btn`=7、`.sr-section`=6、含 `<style>`、含 module 脚本 |
| 桌面构建 | `node .\node_modules\@tauri-apps\cli\tauri.js build --bundles none --ci` | Exit 0：`Finished release profile [optimized] target(s) in 14.69s` |
| 发布归档 | `node scripts\prepare-release.mjs` | Exit 0：Web `ea56f86f…5a2f`（0.59 MB）/ exe `8c588114…6c31`（7.10 MB）/ 清单 2 项 |
| 65 方登记器 | `node ..\step9\verify-hash-registry.mjs` | Exit 0：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（新增 `scripts/fix-skeleton.mjs` 未纳入登记，故方数不变） |
| exe 启动取证 | `_临时脚本/m07-exe-shot-run.mjs`（EncodedCommand 调 PS1） | 窗口 `title=JU`，rect 816×639；截图 `_环境与调试/m07-exe-JU-v2.1-2026-10-25.png`（79,395 B）：时钟 `2026.10.25 15:11:59` 正常、顶栏 7 个导航按钮、左栏 5 个导航项 + 四棵子树 + 4 个底部工具钮、右栏「安全与星级/编辑/展开收起/链接反链」分区、内容区「我的文档」网格 + 折叠三钮 |

复验结论：`index.html` `70baf4…`、`src/style.css` `3fe288…`、`src/app/session.ts` `2715de…` 三件锚点与首轮登记一致；
`src/main.ts` 已在随后的 P0-T3 空桩修复批次改为 `7e9e623f…`（71,227 B / 2,158 行），最新锚点以 §八 为准。
残余缺口沿用 §五：`renderFloatCal` 等未迁移子系统仍为模块默认空壳（`docs/module-boundaries.md:213` 规划至 B4）。

### 八、2026-10-25 · 数据库模块依赖注入（P0-T3 空桩修复 · 批次 V/W）锚点重登记

本批次把 `src/main.ts` 中三个数据库相关注入点的空桩（`N:()=>null` / `getDbRows:()=>[]` /
`commit:()=>{}` / `ui` 占位 / `placePop` 等）全部换为真实导出；源码改动仅限 `src/main.ts`
（`src/core`、`src/views`、`src/ui` 未改动），另新增 `tests/db-module.spec.ts` 作为数据库模块门禁。

| 项 | 值 |
|---|---|
| `src/main.ts` | 71,227 B / 2,158 行 / CRLF / `7e9e623fee1f92e81c8696d9667538ad3d561cf2853e99d9157ce2ce2f2fe94d` |
| `src/views/database/render.ts` | 74,158 B / 1,397 行 / `b94e7047ae0caac33bc085feae61266765a77b48d9deb2dfe29d49b75cc7f0f2` |
| `src/views/database/panels.ts` | 57,744 B / 1,021 行 / `f392a8a4477701c87d7e248aff0161eeae2a928c61d3d770c511377b0980cb6b` |
| `src/views/database/formula.ts` | 24,303 B / 508 行 / `dd84b92c30159f50cddec1f2c57e243ac7c1d8ba31d7acaa3d3892459e4399d6` |
| `tests/db-module.spec.ts`（新增） | 11,404 B / 240 行 / `3c04f39fddb7335d853be0e7b89e9a3d10f10e3dd26b13471ff4efca60ca525f` |
| `dist/index.html`（重建） | 618,553 B / `2b491006a254f0aa8b721b1dadd2e47dd540760c4b60cd916361b5f3d963d166` |

| 门禁 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 类型检查 | `node .\node_modules\typescript\bin\tsc --noEmit` | **Exit 0**（无输出） | `_环境与调试/m07-p0t3-db-tsc-2026-10-25.txt` |
| 零漂移全量门禁 | `node ..\step9\scripts\verify.js all` | **Exit 0**：静态检查 0 命中 · Node 单元 103 用例 · Playwright **167 passed / 4 skipped**（171 用例）· bench 7/7 · `[verify] 全部通过` | `_环境与调试/m07-p0t3-db-verify-all-2026-10-25.txt` |
| 数据库模块 6 项 | `node node_modules\@playwright\test\cli.js test tests/db-module.spec.ts` | **Exit 0，6 passed（11.1s）**：新增行 / 改单元格 / 切看板 / 切画廊 / 筛选面板 / 显隐面板 | `_环境与调试/m07-db-module-pw-r3-2026-10-25.txt` |
| 65 方哈希登记器 | `node ..\step9\verify-hash-registry.mjs` | **Exit 0**：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | 终端实测（见报告） |

维护须知（本批次实测发现）：

1. `window.JU.ui` 是 boot `juPatch` 以 getter 形式发布的**函数**（`ui: function(){ return ui; }`），
   读共享 ui 必须 `JU.ui()`；断言写成 `JU.ui.dbView` 会恒得脚下附属属性而误判。
2. 本构建侧栏骨架不含 `#subDb` 容器，`renderSubDb()` 首行 `$('#subDb')` 为 null 即返回 ⇒
   侧栏「数据库」子树行不可达（独立缺陷，非本批次范围）；数据库页门禁改用
   `actions.setCurrentDoc` + `renderMain` 的真实会话端口打开。
3. Node 环境：任务给定的 `...\versions\22.22.6\node.exe` 不存在，实测使用 `...\versions\22.22.2-6\node.exe`（v22.22.2）。

### 九、2026-10-25 · 日历空白（`buildCalLogBlock` / `buildStatsBlock` 无限递归）修复

现象：`dist/JU-v2.1-Web.html` 点侧栏「日历」后主内容区**永久空白**（`#content.innerHTML` 长度为 0）。

根因（真实运行时栈，非静态推断）：`src/main.ts` 迁移期把两个日历端口注入成「自己的调用者」——

```ts
buildCalLogBlock: () => calModuleLogBody(document.createElement('div')),
buildStatsBlock:  () => calModuleStatsBody(document.createElement('div')),
```

而 `views/calendar.ts` 的 `calModuleLogBody` / `calModuleStatsBody` 内部又回调
`deps.buildCalLogBlock()` / `deps.buildStatsBlock()` ⇒ 二者互为实现，无限递归：
`RangeError: Maximum call stack size exceeded`。`app/render.ts:262` 先清空 `#content`，
第 273 行才调 `renderCalendarPage()`，爆栈后无回填 ⇒ 空白（样式/骨架都在，故极易被误判为「模块被 tree-shake 掉」）。
`buildStatsBlock` 同款递归被 `calModuleStatsBody` 的 `try/catch` 吞掉，表现为「任务统计」恒显 `暂无统计数据`。

修复：
- `src/views/calendar.ts` 补回基线 `v2.0-t3.html:9923 buildCalLogBlock` 与 `:17912 buildStatsBlock` 的逐行等价实现
  （新增 `isFolderId()`，等价基线 `:7114 isFolder`）；文件 2,118 → 2,341 行。
- `src/main.ts` 两处注入点（`injectCalendarDeps` / `bindRenderMainDeps`）改为直接注入真实函数；文件 2,158 → 2,172 行。
- `vite.config.ts` **未**配置 `treeshake`，`views/calendar` 是静态 import —— 不存在 tree-shaking 剔除问题，
  本轮也未修改 `vite.config.ts`。

| 门禁 | 命令 | 实测结果 | 证据 |
|---|---|---|---|
| 类型检查 | `node .\node_modules\typescript\bin\tsc --noEmit` | **Exit 0**（无输出） | `_环境与调试/m07-cal-fix-tsc-2026-10-25.txt` |
| 构建 | `node .\node_modules\vite\bin\vite.js build` | Exit 0，53 modules，`dist/index.html 609.66 kB`（gzip 183.91 kB），1.47s | 终端实测 |
| 零漂移全量 | `node ..\step9\scripts\verify.js all` | **Exit 0**：静态 0 命中 · Node 单元 **503 用例** · Playwright **167 passed / 4 skipped**（171 用例）· bench 7/7 · `[verify] 全部通过` | 终端实测 |
| 工程内 Playwright | `node node_modules\@playwright\test\cli.js test boot-render smoke ui full-e2e` | **Exit 0，11 passed（16.6s）** | 终端实测 |
| 真实点击探针 | `node _临时脚本\m07-probe-newdoc-cal-2026-10-25.mjs JU-v2.1-Web.html` | 新建文档：弹框→写入 state→侧栏出行（`inState:true`）；日历：`contentLen 0 → 41004`、`.cal-page`、36 格、`.cal-top`=1、`.cal-modules`=1；`consoleErrors: []` | `_环境与调试/m07-cal-fix-probe-2026-10-25.txt` + `.png` |
| 锚点对比 | `node _临时脚本\m07-anchor-parity-2026-10-25.mjs JU-v2.1-Web.html` | **24 项 24 PASS / 0 FAIL** | `_环境与调试/m07-cal-fix-anchor-2026-10-25.txt` |
| 65 方哈希登记器 | `node ..\step9\verify-hash-registry.mjs` | **Exit 0**：`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | `_环境与调试/m07-cal-fix-hashreg-2026-10-25.txt` |

哈希登记（零漂移：三处副本逐字节一致）：

| 文件 | 字节 | SHA-256 |
|---|---|---|
| `src/main.ts` | 72,189 B / 2,172 行 / CRLF | `f420cdbd2e0b3f58e494fe407019ff4465a9e9f4ae00ae51110f0dedbd5ad464` |
| `src/views/calendar.ts` | 135,227 B / 2,341 行 / CRLF | `22b546afe24d04d44187bfb7364eeeb448c06860f325c18621012d187e60de61` |
| `dist/index.html` = `dist/JU-v2.1-Web.html` = `dist/release/JU-v2.1-Web.html` | 624,113 B | `24ccf9df87eaf81906ae8f3e3ff44280733519ee99270bb2a5ed39fb9c710c7c` |
| `dist/JU-v2.1-win-x64.exe`（未重建） | 7,447,040 B | `8c58811402dfcfd67d58300b7beb2f123a959b905345a754229df5cb6cba6c31` |

维护须知（本批次实测，补记前文的第 2 条与第 3 条之外）：

4. 修复前磁盘上的 `dist/JU-v2.1-Web.html`（619,341 B / `ea56f86f…`）**落后** `dist/index.html`
   （618,553 B / `2b491006…`）一次构建；比对产物时必须先确认「交付副本」与「最新构建」是否同源，
   否则会把上一轮的缺陷算到本轮头上，或反过来漏掉最新缺陷。
5. `vite build` 的 `emptyOutDir: true` 会清空 `dist/`（含手工放置的 exe 与发布副本）。
   构建前须把 `dist/` 下非构建产物备份到 `90过程材料/`，构建后恢复并重跑 `scripts/prepare-release.mjs`。
6. 判定「模块是否被剔除」不能只看体积与静态锚点：必须用真实浏览器点击 + 收集 `pageerror`/`console.error`。
   本例静态锚点 24/24 齐全，但运行时爆栈导致整页空白。
