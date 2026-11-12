# 批次 2 界面模块化重构（补全版）实施报告 — 2026-10-18

> **范围**：在上一轮仅落地 `ui.modules` 状态扩展的基础上，补全浮窗单一状态源、模块 DOM 标识与包裹化、`applyModuleConfig()`、右键菜单管理器与侧栏空白处恢复入口。
> **字节纪律**：产品改动落在 canonical（[`6.P0-L3基线/v2.0-l3.html.html`](../../6.P0-L3基线/v2.0-l3.html.html:1)），并按 RL-11 逐字节同步 step9 镜像；`1.冻结版本/v2.0-l13-frozen-l22-2026-10-17.html` 作为历史只读锚**零改写**（仍为 1,152,513 / `5C9B133B…`）。

## 一、字节锚

| 物件 | 字节 | EOL | SHA-256 |
|---|---|---|---|
| canonical | **1,158,205** | LF | `C413EF15BC2991EC5D41CD4E00F39742FEE22D3ED4E793E136C5433A7C8A322A` |
| step9 镜像 | **1,158,205** | LF | `C413EF15BC2991EC5D41CD4E00F39742FEE22D3ED4E793E136C5433A7C8A322A` |
| frozen-l22（只读锚） | 1,152,513 | LF | `5C9B133BEF8CD46033E9F8F386B3EBCC1CD63267BB5B64C095CA800A470088DB` |
| 登记器 `verify-hash-registry.mjs` | 48,561 | CRLF | `4420084478EEAD1E0E2480B4FF78EA8D36D351753BBDAEA219D5FD839F55ED42` |

- canonical 与 step9 镜像**逐字节一致**；`<script>` 块数保持 **9**（未新增脚本块）。
- 数据契约 / 加密 payload 字段名 / 公开 API 零变更；`commit` / `undo` / `redo` / 自动保存 / 加密崩溃恢复 / 索引路径零改动。

## 二、实现内容

### 1. 浮窗双状态源收口

- **唯一真相**：`ui.modules.floats.floatCal.visible`；`ui.floatCal` / `ui.pomoVisible` 保留为持久化兼容镜像（仍在 `saveUI` / `applyUIFields` / `uiSnapshot` 三处登记）。
- 新增 [`floatCalVisible()`](../../6.P0-L3基线/v2.0-l3.html.html:18274) 与 [`setFloatCalVisible()`](../../6.P0-L3基线/v2.0-l3.html.html:18278)：读写统一走单一入口，同步 `#floatCal.hidden`、`#btnFloatCal.on` 与 `JU_MODULES.apply()`。
- 改造点：`#btnFloatCal` 点击（[`bindTools`](../../6.P0-L3基线/v2.0-l3.html.html:18836)）、`#fcClose`、番茄钟 `#btnMusic` / `#pomoClose`、`renderMain` 浮窗恢复块、设置面板按钮高亮。
- `JU_MODULES.apply()` 对 floats 组回写 `hidden` / `display` / 按钮高亮 / legacy 字段，**隐藏浮窗时按钮高亮同步移除**。
- 默认值修正：`floats.floatCal.visible` 默认 `false`（与 `ui.floatCal=false` 一致）；旧档加载时以始终落盘的 `floatCal` / `pomoVisible` 兼容字段回灌，避免旧存档隐藏态被默认值覆盖。

### 2. DOM 标识注入与包裹化（防事件丢失）

- [`_ensureModuleDom()`](../../6.P0-L3基线/v2.0-l3.html.html:18176) 使用原生 `createElement` / `insertBefore` **只搬移节点**，不重建节点，既有 `onclick` / 拖拽 / 事件委托全部保留；函数幂等。
- 在 [`bindSidebar`](../../6.P0-L3基线/v2.0-l3.html.html:14603) 开头先注入标识并完成包裹，再绑定既有导航事件。
- 左栏 5 个导航单元包裹为 `.sb-module-group[data-module-id="nav-*"]`（按钮 + 紧邻 `.sb-subtree`），id 与既有 `ui.modules.left` 键对齐：`nav-calendar` / `nav-database` / `nav-starred` / `nav-files` / `nav-tags`。
- `#sbIntro` → `data-module-id="sb-intro"`。
- 右栏 6 个 `.sr-section` 依次 → `sec-security` / `sec-edit` / `sec-expand` / `sec-links` / `sec-save` / `sec-print`。
- `#pomoTimer` → `data-module-id="pomoTimer"`；`#floatCal` → `data-module-id="floatCal"`。
- 包裹层 CSS 为 `display:contents`（`!important` 隐藏规则可覆盖），收起态 flex 布局与既有视觉零变化。
- [`_initNavGroups`](../../6.P0-L3基线/v2.0-l3.html.html:17951)（JU_DND）改为移动整组 `host`，避免把按钮从包裹层中拖出；`navOrder` 持久化按组读取。

### 3. `applyModuleConfig()`

- [`applyModuleConfig()`](../../6.P0-L3基线/v2.0-l3.html.html:18289)：委托 `JU_MODULES.apply()` 遍历 `ui.modules` 控制 `ju-mod-hidden`（`display:none`）/恢复，`pinned` 由 `insertBefore` 移到同组最前；末行同步浮窗 `hidden` 与按钮高亮。
- 在 [`boot()`](../../6.P0-L3基线/v2.0-l3.html.html:19984) 末尾、`renderMain()` 之前调用一次。

### 4. 右键菜单管理器

- [`showModuleContextMenu(e, moduleId, area)`](../../6.P0-L3基线/v2.0-l3.html.html:18207)：复用 `showContextMenu`；`area` 支持 `left` / `right` / `floats`，缺省时按 id 前缀推断。
- 菜单项：① 固顶 / 取消固顶；② 隐藏此模块（固顶时不可隐藏，先取消固顶）；③ 模块管理…。
- [`bindContextMenus()`](../../6.P0-L3基线/v2.0-l3.html.html:18260) 在 [`bindSidebar`](../../6.P0-L3基线/v2.0-l3.html.html:14603) 与 [`bindRightSidebar`](../../6.P0-L3基线/v2.0-l3.html.html:14740) 中绑定（带幂等守卫），浮窗 `#pomoTimer` / `#floatCal` 同样绑定。
- **恢复入口**：`#sidebarLeft` / `#sidebarRight` 空白处 `contextmenu` 打开「模块管理」菜单，列出当前 `visible=false` 的模块，点击后置 `true` 并调用 `applyModuleConfig()` 等价路径与 `saveUI()`。

## 三、验证证据

| 门禁 | 命令 | 结果 |
|---|---|---|
| 语法 | 内联 `<script>` 逐块 `new Function` | 9 块 / 0 失败 |
| 登记器 | `node 6.P0-L3基线\step9\verify-hash-registry.mjs` | `PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0） |
| 全量回归 | `node scripts\verify.js all`（cwd = step9） | 静态 **0 命中** · **Node 145** · **PW 171**（167 passed + 4 skipped）· **bench 7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`（exit 0） |
| 冻结门 ① | `_w5freeze.ps1 -Wave l15 -NoFreeze` | `BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS` |
| 冻结门 ② | `_w4freeze.ps1 -Wave l15` | `BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS` |
| 冻结门 ③ | `_w4paths.ps1 -Wave l15` | `VIOLATION_COUNT=0` / `RESULT=PASS` |
| 功能冒烟 | `_临时脚本/_b2full_smoke.mjs`（Chromium） | **25/25 PASS**：包裹结构 / id 注入 / 浮窗显隐与按钮高亮联动 / 隐藏后刷新不闪 `.on` / 空白处恢复 / 导航右键隐藏与恢复 / 固顶前置 / 右栏隐藏与恢复 / 导航点击 / 零 `pageerror` |

证据文件：

- [`b2full-verify-all-2026-10-18.txt`](../../6.P0-L3基线/step9/reports/b2full-verify-all-2026-10-18.txt:1)
- [`b2full-smoke-2026-10-18.txt`](../../6.P0-L3基线/step9/reports/b2full-smoke-2026-10-18.txt:1)
- [`b2full-w5freeze-2026-10-18.txt`](../../6.P0-L3基线/step9/reports/b2full-w5freeze-2026-10-18.txt:1) / [`b2full-w4freeze-2026-10-18.txt`](../../6.P0-L3基线/step9/reports/b2full-w4freeze-2026-10-18.txt:1) / [`b2full-w4paths-2026-10-18.txt`](../../6.P0-L3基线/step9/reports/b2full-w4paths-2026-10-18.txt:1)
- 登记器复核：[`l22b2full-registrar-2026-10-18.txt`](../../_哈希与行尾校验/l22b2full-registrar-2026-10-18.txt:1)

## 四、RL-11 锚点同步

- 登记器 [`verify-hash-registry.mjs`](../../6.P0-L3基线/step9/verify-hash-registry.mjs:1)：canonical / step9-mirror 期望值 `1,152,513/5C9B133B… → 1,158,205/C413EF15…`，并补记本波变更说明；`frozen-l22` 行保持原值。
- 冻结门 HEAD 期望（仅 HEAD 行，历史冻结锚不变）：[`_w5freeze.ps1`](../../6.P0-L3基线/step9/scripts/_w5freeze.ps1:210)、[`_w4freeze.ps1`](../../6.P0-L3基线/step9/scripts/_w4freeze.ps1:152)、[`_w4paths.ps1`](../../6.P0-L3基线/step9/scripts/_w4paths.ps1:122)。

## 五、决策记录

- **决策 B2F-D1（2026-10-18）**：本波产品改动仅落 canonical + step9 镜像；`1.冻结版本\*` 与 `1.归档快照\*` 保持只读，`frozen-l22` 继续作为 L22 历史锚参与冻结门校验。理由是 RL-11 / 铁律 4 要求「改 canonical 后同步 step9、不覆盖冻结件」；若直接改写 frozen-l22，将同时破坏三方冻结门与历史可追溯性。
- **决策 B2F-D2（2026-10-18）**：浮窗以 `ui.modules.floats.floatCal.visible` 为唯一真相，`ui.floatCal` / `ui.pomoVisible` 仅作兼容镜像；加载时兼容字段回灌，保证旧档升级不改变用户可见状态。
