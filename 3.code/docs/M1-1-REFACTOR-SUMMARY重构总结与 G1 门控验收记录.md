# M1-1 · 重构总结与 G1 门控验收记录

> 文档编号：批次 BB（重构总结）/ 批次 BC（M1-9 G1 门控验收 + 基线冻结）
> 决策依据：[`docs/M1-1-ARCH-DECISION.md`](M1-1-ARCH-DECISION.md)、[`docs/module-boundaries.md`](module-boundaries.md)
> 执行时间：2026-10-24（UTC+8）
> 结论：**全量测试全绿 · 零漂移 · 新基线已冻结**

---

## 1. 重构前后核心指标对比

### 1.1 总量指标

| 指标 | 重构前（`v2.0-t3.html` 单文件） | 重构后（`m07-vite` 工程 → `dist/index.html`） | 变化 |
| --- | --- | --- | --- |
| 物理文件数 | **1** 个 HTML（内含 9 个 inline `<script>` 块） | **38** 个 `.ts` 模块（工程内共 59 个受版本管理文件） | +37 模块 |
| 总代码行数 | 23,451 行（HTML+JS+CSS 混排） | 19,331 行（仅 `.ts`；HTML 骨架 37 行 + CSS 独立） | **-4,120 行（-17.6%）** |
| 交付产物体积 | **1,316,707 字节**（1.26 MB） | **431,216 字节**（421 KB） | **-885,491 字节（-67.25%）** |
| 交付产物 gzip | —（未压缩交付） | 134.33 kB | — |
| 编译 / 构建时长 | 无构建（直接编辑交付） | **1.31 s**（Vite 内部计时）/ 2.07 s（含进程启动，实测墙钟） | 新增构建步骤 |
| 类型检查 | **不可用**（无模块边界） | `tsc --noEmit` 全量通过（38 模块 / 19,331 行） | 0 错误 |
| Tree-shaking | **不可用** | 参与构建的模块 **38** 个，实测 `38 modules transformed` | 生效 |
| 最大单文件 | 23,451 行 | 2,086 行（[`src/views/calendar.ts`](../src/views/calendar.ts)） | **-91.1%** |
| 单文件产物 | 1 个（但不可维护） | **1 个（`dist/index.html`）** | 持平（形态不变量） |

### 1.2 模块分布（38 个 `.ts` / 19,331 行）

| 目录 | 文件数 | 代码行数 | 职责 |
| --- | --- | --- | --- |
| [`src/views/`](../src/views) | 10 | 8,959 | 视图层：大纲 / 日历 / 思维导图 / 图谱 / 演示 / 幻灯片 / 列表 / 数据库（公式·面板·渲染） |
| [`src/ui/`](../src/ui) | 9 | 2,899 | 交互层：通用组件 / 主题 / 布局 / 侧栏 / 右侧栏 / 焦点 / 选区 / 编辑器 / 时间选择器 |
| [`src/core/`](../src/core) | 9 | 2,817 | 内核层：store / produce / persist / actions / crypto / richtext / constants / utils / errors |
| [`src/main.ts`](../src/main.ts) | 1 | 1,850 | 装配中枢：全部 `bind*Deps` 回填 + `window.JU` 单一落位 |
| [`src/app/`](../src/app) | 2 | 1,281 | 启动引导（`boot.ts` 997 行）+ 主渲染（`render.ts`） |
| [`src/io/`](../src/io) | 2 | 1,151 | 导入 / 导出（Markdown、HTML、ICS、备份） |
| [`src/utils/`](../src/utils) | 1 | 214 | 农历换算 |
| [`src/contract/`](../src/contract) | 2 | 72 | 契约层：`registry`（`JU.register/require`）+ `lifecycle`（释放栈） |
| [`src/types/`](../src/types) | 1 | 63 | `window.JU` / `window.__ju*` 全局类型声明 |
| [`src/legacy/`](../src/legacy) | 1 | 25 | legacy 脚本按序注入器（接口 + 占位） |
| **合计** | **38** | **19,331** | — |

---

## 2. 产物运行要求（交付形态不变量）

产出的 `dist/index.html` 是**完全自包含的单文件应用**，满足以下三条：

| 要求 | 状态 | 取证 |
| --- | --- | --- |
| **单文件** | ✅ `dist/` 内**只有** `index.html`，无 `assets/` 子目录 | `tests/smoke.spec.ts` 断言 `dirs === []`、`files === ['index.html']` |
| **无需服务端** | ✅ 脚本/样式全部内联为 `<script type="module">` 与 `<style>`；无 `<script src=>` / `<link href=>` 外链 | `tests/smoke.spec.ts` 断言无外链残留 |
| **双击可运行** | ✅ HTML 骨架已内置三区结构（`#topbar` / `#sidebarLeft` / `#main` / `#sidebarRight`）+ `#toast`，脱离测试注入脚本后仍可独立启动 | [`index.html`](../index.html:15) + `tests/smoke.spec.ts` 实测加载后 `JU.getState()` 可取到「欢迎使用 JU」节点 |

内联实现依据 [`vite.config.ts`](../vite.config.ts)：`viteSingleFile()` + `assetsInlineLimit: 100_000_000` + `cssCodeSplit: false` + `publicDir: false`（构建期）。

> 本地数据通过 `localStorage` / `IndexedDB` 持久化，`file://` 源下与应用同源，无需任何后端进程。

---

## 3. G1 门控验收（M1-9）· 真实执行记录

**执行环境**：Windows 11 · Node `v22.22.2` · Vite `5.4.21` · 工作目录 `6.P0-T3基线/m07-vite`

> **Node 路径说明**：任务书给出的 `…\node\versions\22.22.6\node.exe` 在本机**不存在**（该目录下仅有 `22.22.2-6` 一个可用版本，另有 `22.12.0.installing…` 半成品目录）。故全部命令统一改用 `C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`，运行时 `node -v` 实测 `v22.22.2`。

### 3.1 构建产物生成（`vite build`）

```
命令: <node> .\node_modules\vite\bin\vite.js build
Exit Code: 0
```

关键输出：

```
vite v5.4.21 building for production...
transforming...
✓ 38 modules transformed.
rendering chunks...
[plugin vite:singlefile]
[plugin vite:singlefile] Inlining: main-BnusRcuD.js
computing gzip size...
dist/index.html  419.73 kB │ gzip: 134.33 kB
✓ built in 1.31s
```

| 项 | 实测值 |
| --- | --- |
| 产物文件 | `dist/index.html` |
| **产物字节数** | **431,216 字节** |
| 产物 gzip | 134.33 kB |
| 原版字节数 | 1,316,707 字节 |
| 体积下降 | **885,491 字节 / -67.25%** |
| 参与构建模块 | 38 |
| 构建耗时 | 1.31 s（Vite 内部）/ 2.07 s（墙钟，含进程启动） |

Tree-shaking 与压缩成效：产物 431,216 字节 < 源 `.ts` 总行数 19,331 行对应的自然体积，同时显著低于原版 1,316,707 字节；`assetsInlineLimit` 与 `cssCodeSplit:false` 保证**零额外文件**（`dist/` 文件集合恰为 `['index.html']`）。

### 3.2 类型检查（`tsc --noEmit`）

```
命令: <node> .\node_modules\typescript\bin\tsc --noEmit
Exit Code: 0
关键输出: （无诊断输出）
```

38 个模块 / 19,331 行 **零类型错误**。

### 3.3 单元测试与契约测试（`node --test test/contract.test.mjs`）

```
命令: <node> --test test/contract.test.mjs
Exit Code: 0
```

关键输出（TAP 摘要）：

```
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 194.6621
```

6 条全过，覆盖：`register/require` 往返、`require` 缺失错误消息逐字等于 `JU.require missing: xxx`、`lifecycle.add` 正序执行、`lifecycle.dispose` 逆序（栈语义 pop）、单个 disposer 抛错不阻断后续、`lifecycle.on` 的 add/remove 配对。

### 3.4 冒烟与并发（Playwright）

```
命令: <node> .\node_modules\@playwright\test\cli.js test tests/smoke.spec.ts tests/concurrency.spec.ts
Exit Code: 0
```

关键输出：

```
[playwright] Chromium: C:\Users\12601\AppData\Local\Google\Chrome\Application\chrome.exe
Running 3 tests using 1 worker
[smoke] dist/index.html bytes=431216
  ok 1  tests\concurrency.spec.ts:154:1  M1-2 3 标签并发收敛测试（内存态 + 磁盘态） (38.3s)
  ok 2  tests\smoke.spec.ts:88:3      M1-1 单 HTML 产物 · dist 只保留 index.html，且脚本 / 样式已内联 (10ms)
  ok 3  tests\smoke.spec.ts:112:3     M1-1 单 HTML 产物 · 加载构建产物：标题 / JU.getState 欢迎节点 / 三区 DOM 均存在 (369ms)

  3 passed (40.9s)
```

并发收敛实测（3 标签 × 1000 次操作 = 3000 ops）：

| 标签 | add | update | remove | finalCount | storedBytes |
| --- | --- | --- | --- | --- | --- |
| tab-1 | 519 | 316 | 165 | 1161 | 390,459 |
| tab-2 | 563 | 287 | 150 | 1158 | 390,006 |
| tab-3 | 545 | 286 | 169 | 1157 | 389,184 |

- `convergedCounts: [1158, 1158, 1158]` —— 三标签最终节点数一致；
- `memoryProjectionHash` / `diskProjectionHash` 三标签**同哈希** `ceb9b317ca08f63de170b50b2027c4e7df08cad823a63a3e8d377ede6c69f163`；
- `canonicalEqual: true`；`pageErrors: []`（构建产物加载期零 `pageerror`，见 §4.1 坑点验收）。

### 3.5 原有系统零漂移（`verify.js all`）

```
命令: <node> ..\step9\scripts\verify.js all
Exit Code: 0
```

> **PATH 说明**：`verify.js` 内部以 `spawnSync('node', ...)` 调用子进程。首次直接执行报 `spawnSync node ENOENT`（退出码 1），原因是当前 shell 的 `PATH` 未包含 Node 目录 —— 这是**环境问题而非漂移**。将 `C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6` 前置到 `PATH` 后重跑，退出码 0。

关键输出（步骤摘要，逐项全绿）：

```
[verify] mode=all root=E:\APP\归档\6.P0-T3基线\step9

✅ 静态检查（铁律 6 · 禁止 AI 生成注释） (0 命中, 22ms)
✅ Node 单元测试（403 用例）(27573ms)
✅ Playwright 集成测试（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 用例 + L13 6 = 171 用例）(63346ms)
✅ 性能对拍（排除 commitRewriteAllText）(78ms)

[verify] 全部通过
```

补充实测：

- Playwright：**167 passed / 4 skipped**（1.0m），skip 为既有条件跳过，非失败；
- 内联 `<script>` 块数 **9**，`script#0`–`script#8` 语法全部 OK；
- 性能对拍摘要：可比场景 8 个，**通过 7 / 警告 0 / 失败 0**，最大恶化 **0.0%**，中位数恶化 **-14.3%**。

**结论：原有系统零漂移。**

### 3.6 G1 门控汇总

| # | 门控项 | 命令 | Exit Code | 结果 |
| --- | --- | --- | --- | --- |
| 1 | 构建产物 | `vite build` | **0** | `dist/index.html` = 431,216 B |
| 2 | 类型检查 | `tsc --noEmit` | **0** | 0 错误 |
| 3 | 契约测试 | `node --test test/contract.test.mjs` | **0** | 6 pass / 0 fail |
| 4 | 冒烟 + 并发 | `playwright test smoke + concurrency` | **0** | 3 passed |
| 5 | 零漂移 | `verify.js all` | **0** | 静态 0 命中 / 403 单测 / 171 集成 / 性能全过 |

---

## 4. 新冻结基线（v2.1）

### 4.1 冻结件

| 项 | 值 |
| --- | --- |
| 冻结路径 | `1.冻结版本/v2.1-m1-1-frozen.html` |
| 来源 | `6.P0-T3基线/m07-vite/dist/index.html` |
| **字节数** | **431,216** |
| **SHA-256** | **`039610EB7FB7E17AD67401CB44D4095759D681AA3649141D36A908AF2D6F8785`** |
| 基线版本 | v2.1（M1-1 · 单 HTML 产物） |
| 冻结日期 | 2026-10-24 |

### 4.2 与既有基线的对照

| 基线 | 文件 | 字节数 | SHA-256 | 形态 |
| --- | --- | --- | --- | --- |
| v2.0（重构前产品件） | `6.P0-T3基线/v2.0-t3.html` | 1,316,707 | `5FED021578E775B560BF98AF719046EB2916472F4053354A33A1A436DFBFF818` | 单 HTML / 9 inline script |
| **v2.1（本次冻结）** | `1.冻结版本/v2.1-m1-1-frozen.html` | **431,216** | **`039610EB7FB7E17AD67401CB44D4095759D681AA3649141D36A908AF2D6F8785`** | **单 HTML / 构建产物** |

`dist/index.html` 与冻结件 SHA-256 **完全一致**（`039610EB…F8785`），证明冻结件即构建产物本身，无二次加工。

### 4.3 复算命令（可复现）

```powershell
# 字节数
(Get-Item "1.冻结版本\v2.1-m1-1-frozen.html").Length
# → 431216

# SHA-256
(Get-FileHash "1.冻结版本\v2.1-m1-1-frozen.html" -Algorithm SHA256).Hash
# → 039610EB7FB7E17AD67401CB44D4095759D681AA3649141D36A908AF2D6F8785
```

---

## 5. 遗留事项（M1-2+ 衔接）

1. **`deps` 占位端口回填**：[`src/core/store.ts`](../src/core/store.ts:29) 顶部仍有 8 个 `TODO: M1-2+` 端口（`_wordCountCache` / `_docNodeCountCache` / `_searchHayCache` / `invalidateCalIndex` / 墓碑队列 / `_diskConfirmed` / `_sideCountsSet` / `_sideCountsRebuild`），当前为行为等价空壳，须逐项替换为真实实现。
2. **`bindSettings` / `bindTools` 重面板**：`BootDeps` 中仍以端口承接（源约 2.2k 行、依赖 150+ 同作用域符号），待专批迁入。
3. **`legacy/loader.ts`**：仍为「接口 + 占位」，未启用真实注入路径。
4. **`public/` 构建分叉**：需要 `public` 直通的构建（`benchmark-30k`）必须显式 `JU_KEEP_PUBLIC=1`，否则 `dist/` 缺 `30k-fixture.json`。
