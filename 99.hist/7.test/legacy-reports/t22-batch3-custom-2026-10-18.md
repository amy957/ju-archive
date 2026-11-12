# 批次 3 · 独立功能定制（图标与视图行为 / 多维表格汇总浮窗 / 主题切换面板）— 2026-10-18

> **判定 = 完成**。canonical = step9 镜像 = **1,157,785 B / LF（21,588）/ `53E607D6080DB5A61A89D9AB1A6735832DF57002809C2809699DAECE03B2A063`**
> （改前 HEAD = 批次 2 界面模块化重构补全：1,158,205 / `C413EF15…`）。
> 产品业务逻辑（commit / undo・redo / 自动保存 / 加密崩溃恢复 / 索引 / Web Worker）**零改动**；不新增 `<script>` 块（仍 9 块，语法 9/9 通过）；公开 API / 加密 payload 字段名 / 数据契约零变更；登记方数保持 **47**。

---

## 一、基线复核

| 项 | 字节 | 行尾 | SHA-256 |
|---|---|---|---|
| 改前 canonical = step9 镜像 | 1,158,205 | LF | `C413EF15BC2991EC5D41CD4E00F39742FEE22D3ED4E793E136C5433A7C8A322A` |
| 冻结件 `frozen-l22`（只读锚 · 零改写） | 1,152,513 | LF | `5C9B133BEF8CD46033E9F8F386B3EBCC1CD63267BB5B64C095CA800A470088DB` |

任务卡所述「1,158,285 B / C413EF15…」与实测字节差 80 B；经全目录检索（`1.冻结版本` / `1.归档快照` / `6.P0-L3基线`）**不存在 1,158,285 B 的产品文件**，且哈希前缀 `C413EF15` 与实测 canonical 一致 ⇒ 以实测 **1,158,205 / `C413EF15…`** 为本次基线。冻结件 `frozen-l22` 保持只读，未参与本次改写。

---

## 二、变更清单（canonical 行号以改后文件为准）

| # | 位置 | 变更 | 状态 |
|---|---|---|---|
| 1 | [`#btnMusic`](../6.P0-L3基线/v2.0-l3.html.html:963) | `<svg>` 替换为线性简化番茄（果身 circle + 两条叶梗 path） | **本波改写** |
| 2 | [`getNodeSvg()`](../6.P0-L3基线/v2.0-l3.html.html:6595) | `_isNoteRoot` 分支（普通文档同外框 + 内部横线），判定先于 `isFolder` | 字节复核齐备 |
| 3 | [`openNode()`](../6.P0-L3基线/v2.0-l3.html.html:13937) | 不再强制 `ui.view='auto'`，侧栏切换文档保留当前顶层视图 | 字节复核齐备 |
| 4 | [`openDbSummaryPanel()`](../6.P0-L3基线/v2.0-l3.html.html:10866) | 移除固定宽度、标题「汇总行」、勾选文案、`.db-sf-row` 换行 | 字节复核齐备 |
| 5 | [`openThemeSelector()`](../6.P0-L3基线/v2.0-l3.html.html:5665) | 日间 / 夜间缩略图卡片 · 实时预览 · 确认应用 / 取消回滚 | 字节复核齐备 |
| 6 | [`bindTools()`](../6.P0-L3基线/v2.0-l3.html.html:18836) | `#btnTheme` 点击改为 `openThemeSelector` | 字节复核齐备 |
| 7 | `ui` / [`applyUIFields()`](../6.P0-L3基线/v2.0-l3.html.html:5535) / [`_saveUINow()`](../6.P0-L3基线/v2.0-l3.html.html:5591) / [`uiSnapshot()`](../6.P0-L3基线/v2.0-l3.html.html:15208) | `ui.theme` / `ui.themePreview` 四处登记 | 字节复核齐备 |

### 1 · 侧栏番茄图标（本波唯一字节变更）

```html
<!-- 改前（L22 缺陷修复波 · 彩色实心番茄） -->
<button class="sb-tool" id="btnMusic" title="番茄钟与音乐"><svg viewBox="0 0 24 24" fill="none"><path d="M12 7.3c3.9 0 …"/><path d="M12 7.6c-.7-1.4 …"/><path d="M12 7.6V4.4" …/><path d="M9.2 12.1c.5-.6 …"/></svg></button>
<!-- 改后（线性简化番茄） -->
<button class="sb-tool" id="btnMusic" title="番茄钟与音乐"><svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="7"/><path d="M12 7c0-2-1.5-3.5-3-3.5c.5 1.5 1.5 2 3 2.5"/><path d="M12 7c0-2 1.5-3.5 3-3.5c-.5 1.5-1.5 2-3 2.5"/></svg></button>
```

### 2 · 记事本根图标（`getNodeSvg`）

```js
function getNodeSvg(id){
  if(id===state.rootId)return`<svg viewBox="0 0 24 24">…</svg>`;
  /* 【批次3】记事本根：与普通文档一致的外框 + 内部横线（先于 isFolder 判定，避免落到文件夹图标） */
  if(N(id)&&N(id)._isNoteRoot)return`<svg viewBox="0 0 24 24"><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M8 12h8M8 16h5"/></svg>`;
  if(isFolder(id))return`<svg viewBox="0 0 24 24">…</svg>`;
```

### 3 · `openNode` 不再强制跳回大纲

```js
  safeNavigate(()=>{
    ui.currentDocId=id;
    /* 【批次3】侧边栏切换文档不再强制 ui.view='auto'，保留当前顶层视图（大纲/导图等）不跳变 */
    const n2=N(id);
```

### 4 · 多维表格汇总浮窗

```js
  panel.className='db-sf-panel';
  /* 【批次3】移除固定宽度，交由 .db-sf-panel 的 min/max-width 按内容自适应 */
  panel.innerHTML='<h4>汇总行</h4><div class="db-sf-rules"></div>';
  …
  const span=document.createElement('span');span.textContent='启用（计数/求和/求平均）';onToggle.appendChild(span);
  const row=document.createElement('div');row.className='db-sf-row';
  /* 【批次3】行内允许换行，长文案 + 模式选择器在窄面板下不溢出 */
  row.style.flexWrap='wrap';
```

### 5 · 主题切换面板

`openThemeSelector()` 复用 `.modal-overlay` / `.modal` / `.modal-head` / `.modal-body`、`_modalStack`、`toast`、`forceRender`、`saveUI`、`applyTheme`：卡片点击仅写 `document.documentElement.dataset.theme`（实时预览，不落盘）；「确认应用」→ `applyTheme(t)` + `saveUI()` + `forceRender()`；「取消 / ESC / 遮罩」→ `ui.themePreview=null` + `applyTheme(打开前主题)` 回滚并出栈。

```js
$('#btnTheme').onclick=openThemeSelector; /* 【批次3】主题按钮改为打开主题选择面板（日间/夜间缩略图 + 确认应用） */
```

`toggleTheme()` 保留（内部函数 / 热键复用），语义不变。新增状态登记：`ui` 字面量 `theme:'day', themePreview:null`；`applyUIFields` 非法值归一；`_saveUINow` / `uiSnapshot` 同口径落盘。

---

## 三、全量门禁（Stage ① / ② / ③ + 附加）

| 段 | 命令 | 结果 |
|---|---|---|
| ① 登记器（红证） | 以**改前期望**运行登记器 | `FIVE_PARTY_DRIFT_COUNT=1` / `RESULT=FAIL`（canonical 单侧漂移 · 判别力真实）— [`b3-registrar-red-2026-10-18.txt`](../../_哈希与行尾校验/b3-registrar-red-2026-10-18.txt:1) |
| ① 登记器（绿证） | `node 6.P0-L3基线\step9\verify-hash-registry.mjs` | **`PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`** — [`b3-registrar-green-2026-10-18.txt`](../../_哈希与行尾校验/b3-registrar-green-2026-10-18.txt:1) |
| ② 全量回归 | `node 6.P0-L3基线\step9\scripts\verify.js all` | **exit 0**：静态 **0 命中** / 9 块语法通过 · **Node 145** · **PW 171**（167 passed + 4 skipped）· **bench 7/7** 最大恶化 **0.0%** — [`b3-verify-all-2026-10-18.txt`](../../6.P0-L3基线/step9/reports/b3-verify-all-2026-10-18.txt:1) |
| ② 静态复证 | `node 6.P0-L3基线\step9\scripts\verify.js lint` | **0 命中** / exit 0 — [`b3-lint-2026-10-18.txt`](../../6.P0-L3基线/step9/reports/b3-lint-2026-10-18.txt:1) |
| ③ 冻结门 | `_w5freeze.ps1 -Wave l15 -NoFreeze` | **`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS`** — [`b3-w5freeze-2026-10-18.txt`](../../6.P0-L3基线/step9/reports/b3-w5freeze-2026-10-18.txt:1) |
| 附加只读门 | `_w4freeze.ps1 -Wave l15` | **`FROZEN_DRIFT_COUNT=0` / `RESULT=PASS`** — [`b3-w4freeze-2026-10-18.txt`](../../6.P0-L3基线/step9/reports/b3-w4freeze-2026-10-18.txt:1) |
| 附加只读门 | `_w4paths.ps1 -Wave l15` | **`VIOLATION_COUNT=0` / `RESULT=PASS`**（`CANARY_ARTIFACTS=128`）— [`b3-w4paths-2026-10-18.txt`](../../6.P0-L3基线/step9/reports/b3-w4paths-2026-10-18.txt:1) |
| 功能冒烟 | Chromium 实机加载 step9 镜像 | `musicIcon=true` / `noteIcon=true` / `themeCardCount=2` / `previewTheme=night` / `appliedTheme=night` / `modalClosed=true` / `savedUI=true` / 汇总面板（标题「汇总行」· 无内联宽度 · `flex-wrap=wrap` · 宽 305px）· `errors=[]` — [`b3-smoke-2026-10-18.txt`](../../6.P0-L3基线/step9/reports/b3-smoke-2026-10-18.txt:1) |

---

## 四、RL-11 同步

- 登记器 [`verify-hash-registry.mjs`](../6.P0-L3基线/step9/verify-hash-registry.mjs:1)：canonical / step9-mirror 期望 `1,158,205/C413EF15… → 1,157,785/53E607D6…`，并补记本波变更说明；`frozen-l22` 行保持原值。
- 冻结门 HEAD 期望（仅 HEAD 行，历史冻结锚不变）：[`_w5freeze.ps1`](../6.P0-L3基线/step9/scripts/_w5freeze.ps1:210)、[`_w4freeze.ps1`](../6.P0-L3基线/step9/scripts/_w4freeze.ps1:152)、[`_w4paths.ps1`](../6.P0-L3基线/step9/scripts/_w4paths.ps1:122)。
- 字节 delta：**−420 B**（彩色实心番茄 → 线性简化番茄）；行数 / 行尾不变（LF 21,588 · CR 0）；`<script>` 9 块。

## 五、红线守持

- `1.冻结版本\*`（含 `frozen-l22`）与 `1.归档快照\*` **零改写**；本波仅改 canonical + step9 镜像 + 登记器 / 三门 HEAD 期望 + 报告 / 日志。
- 未新增任何「内容由 AI 生成」类注释（静态 0 命中 · 铁律 6）。
- 核心业务逻辑零改动：commit / undo・redo / 自动保存 / 加密崩溃恢复 / 索引 / Web Worker 均未触及。

**下一入口**：批次 4（主题与功能定制后续波）。
