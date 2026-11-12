# G1 门控验收报告（M1 阶段）

> 工程根：`6.P0-T3基线/m07-vite`
> 验收日期：2026-10-24（UTC+8）
> 执行方式：Code 模式 · 真实文件操作 / 真实浏览器 / 真实命令
> 结论：**G1 门控正式达成，具备进入 M5 稳定期的前置条件。**

---

## 一、M1 阶段成果汇总

### 1.1 工程重构完成

| 指标 | 重构前（`v2.0-t3.html` 单文件） | 重构后（`m07-vite` → `dist/index.html`） |
| --- | --- | --- |
| 形态 | 1 个 HTML，内含 9 段 inline `<script>` | 38 个 TypeScript 模块 + 构建产物单 HTML |
| 源码行数 | 23,451 行（HTML/JS/CSS 混排） | 19,331 行（仅 `.ts`），**-4,120 行（-17.6%）** |
| 最大单文件 | 23,451 行 | 2,086 行（`src/views/calendar.ts`），**-91.1%** |
| 交付体积 | 1,316,707 字节 | **431,216 字节（gzip 134.33 kB）**，**-67.25%** |
| 类型检查 | 不可用 | `tsc --noEmit` 0 错误 |
| 全局耦合 | 散落 `window.*` | `window.JU` **343 个契约键单一装配点**（`src/main.ts`） |

模块分层：`core`（store / produce / persist / actions / crypto / richtext / constants / utils / errors）、
`app`（boot / render）、`views`（10 个视图模块）、`ui`（9 个交互模块）、`io`（导入导出）、
`contract`（registry / lifecycle）、`types`、`legacy`。

### 1.2 死代码清理

| 项目 | 证据 |
| --- | --- |
| `openTagPicker` / `_tagPickerEl` / `closeTagPicker` 整块删除 | 122 行 / 6,120 B；grep 复查 `openTagPicker=0`、`_tagPickerEl=0`、`closeTagPicker=0` |
| `invertPatch` 整块删除 | 12 行 / 277 B；`invertPatch(` 零命中 |
| `scheduleSidebar` / `_sidebarRaf` 整块删除 | 7 行 / 274 B；两符号零残留 |
| 富文本清洗重复实现下线 | 清洗实现仅存于 `src/core/richtext.ts`；`expression(` / `SAFE_TAGS` / `CSS_WHITELIST` 全量复扫无第二份副本 |
| 轻量 store 持久化空壳下线 | `const schedulePersist = (): void => {}` 移除，改为显式 `PersistStore` 接口 + `initStore(initial, persist)` 参数注入 |

来源：`_报告与元数据/r66-CODE-cleanup-boot-errmsg-REPORT-2026-10-23.md`、
`_报告与元数据/M1-1-BATCH-AKALAM-REPORT-2026-10-24.md`、`docs/M1-1-REFACTOR-SUMMARY.md`。

### 1.3 空 catch 消灭

- 脚本：`scripts/fix-empty-catch.mjs`（带注释/字符串遮罩，幂等，支持 `--dry`）。
- 扫描 `src/**/*.ts` 35 个文件，实际改写 **20 个文件 / 176 处**空 catch：

```
EMPTY-CATCH FIXED  files=35  touched=20  total=176
```

- 统一为限频告警式 `console.warn('[JU] caught error', e)`；复跑 `--dry` 为 `touched=0 total=0`。
- 改动后 `tsc --noEmit` Exit 0、`vite build` 成功，证明无语法/类型破损。

---

## 二、质量门禁证据（全部为本轮真实执行）

> 环境：Windows 11 · Chromium `C:\Users\12601\AppData\Local\Google\Chrome\Application\chrome.exe`
> Node 实际路径：`C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`
> （任务书给出的 `…\22.22.6\node.exe` 在本机不存在；该目录下仅 `22.22.2-6` 可用，命令语义不变。）

### 2.1 `tsc --noEmit` — Exit 0

```
命令: <node> .\node_modules\typescript\bin\tsc --noEmit
Exit Code: 0
输出: （无诊断）
```

编译面包含 `src`、`src/types`、`tests/**/*.ts`（`tsconfig.json` 已纳编测试文件）。

### 2.2 接口 / 契约测试 — Exit 0（10/10）

```
命令: <node> --test test\contract.test.mjs test\api-shape.test.mjs
Exit Code: 0
# tests 10 / # pass 10 / # fail 0 / # skipped 0
```

覆盖：`JU.register/require` 往返、缺失错误消息逐字等于 `JU.require missing: xxx`、
`lifecycle.add` 正序 / `dispose` 逆序、单 disposer 抛错不阻断、`lifecycle.on` 的 add/remove 配对、
接口形状校验，以及产品件只读快照哈希稳定（零写入）。

### 2.3 3 万节点性能基准 — Exit 0（1 passed / 8.6s）

```
命令: <node> .\node_modules\@playwright\test\cli.js test tests/benchmark-30k.spec.ts
Exit Code: 0
1 passed (8.6s)
```

实测指标（真实运行输出）：

| 指标 | 实测 | 门禁 |
| --- | --- | --- |
| 节点装载 | **30,000**（根下 100 个顶层文档） | = 30,000 |
| 启动（导航 → 装载 → 首屏大纲渲染 → 双 rAF） | **497.2 ms** | < 3,000 ms |
| DOMContentLoaded | 94.1 ms | — |
| 视图切换（大纲 → 导图） | 同步 12.7 ms / 含首帧 28.2 ms | < 200 ms |
| 视图切换（导图 → 大纲） | 同步 14.3 ms / 含首帧 36.7 ms | < 200 ms |
| JS 堆占用 | **29.0 MB**（总堆 38.6 MB） | < 800 MB |
| 首屏渲染行 | 300 行；导图节点 301 | > 0 |
| 未捕获异常 / `bootError` | `pageErrors: []` / `null` | 0 |

> 任务书参考值为「启动 564 ms、内存 38.4 MB」；本轮同机复跑为 **497.2 ms / 29.0 MB used（38.6 MB total）**。
> 两者均通过门禁，报告以本轮实测值为准（不引用旧值充作本轮结果）。

### 2.4 3 标签并发收敛 — Exit 0（1 passed / 41.6s）

```
命令: <node> .\node_modules\@playwright\test\cli.js test tests/concurrency.spec.ts
Exit Code: 0
1 passed (41.6s)
```

实测数据：

| 标签 | add | update | remove | finalCount | storedBytes |
| --- | --- | --- | --- | --- | --- |
| tab-1 | 519 | 316 | 165 | 1162 | 391,962 |
| tab-2 | 563 | 287 | 150 | 1159 | 391,460 |
| tab-3 | 545 | 286 | 169 | 1160 | 389,843 |

- 总操作 **3000**（3 标签 × 1000）；
- `convergedCounts: [1159, 1159, 1159]` —— 三标签最终节点数一致；
- `memoryProjectionHash` / `diskProjectionHash` 三标签**全量同哈希**：
  `44b7c3314be5ad9bfef43afbe8f4b0b07ef6dad7ac587b63a6eede5a7f4fa82a`；
- 磁盘原始哈希三标签一致：`569f97e589f4876be93d7fc5d85e0b0221fcb725c8fea645ab152f41e5e0c66a`；
- `canonicalEqual: true`；`pageErrors: []`。

### 2.5 终极全链路 E2E（本轮新增）— Exit 0（3 passed / 6.9s）

```
命令: <node> .\node_modules\@playwright\test\cli.js test tests/full-e2e.spec.ts
Exit Code: 0
3 passed (6.9s)
```

| 用例 | 验证链路 | 结果 |
| --- | --- | --- |
| 加密与解锁闭环 | 设置开启全库加密（主密码 `test123`）→ 产品持久化写密文 `juju.enc.v1` 并删除明文 → 刷新出现解锁锁定界面 → 错误密码被拒 → 正确密码解密 → 数据零丢失并重新渲染 | ok（1.9s） |
| 导入与导出闭环 | `JU.handleImportFiles` 导入 3 节点 JSON → 产品二次确认 → 状态替换 → 大纲渲染导入节点 → 「导出 Markdown」真实下载 `导入文档-<本地日期>.md`（78 B）→ 正文包含「导入节点A」 | ok（599ms） |
| 多维表格与日历联动 | 表格视图「＋ 行」→ 行右键「添加到日历」（`setNodeDate(today)`）→ 切日历点今日 →「当日待办」出现该行文本；日历索引收录该 id | ok（704ms） |

### 2.6 全量回归零漂移 — Exit 0

```
命令: set "PATH=<node目录>;%PATH%" && node ..\step9\scripts\verify.js all
Exit Code: 0
```

步骤摘要（真实输出）：

```
✓ 静态检查（铁律 6 · 禁止 AI 生成注释） (0 命中)
✓ Node 单元测试（503 用例）
✓ Playwright 集成测试（171 用例）→ 167 passed / 4 skipped
✓ 性能对拍（排除 commitRewriteAllText）→ 可比 7 / 通过 7 / 警告 0 / 失败 0，最大恶化 0.0%
[verify] 全部通过
```

只读副本零漂移：

```
命令: <node> scripts\check-parity.mjs
Exit Code: 0
PARITY OK  sha256=5fed021578e775b560bf98af719046eb2916472f4053354a33a1a436dfbff818  bytes=1316707
```

与既有基线（`docs/M1-1-REFACTOR-SUMMARY.md` §4.2）记录的 canonical 哈希完全一致。

---

## 三、门控结果汇总

| # | 门控项 | 命令 | Exit | 结果 | 判定 |
| --- | --- | --- | --- | --- | --- |
| 1 | 类型检查 | `tsc --noEmit` | 0 | 0 错误 | ✅ |
| 2 | 契约 / 接口 | `node --test contract + api-shape` | 0 | 10 pass / 0 fail | ✅ |
| 3 | 3 万节点基准 | `playwright test benchmark-30k` | 0 | 497.2 ms / 29.0 MB / 切换 < 37 ms | ✅ |
| 4 | 3 标签并发 | `playwright test concurrency` | 0 | 3000 ops，三标签同哈希 | ✅ |
| 5 | 全链路 E2E | `playwright test full-e2e` | 0 | 3 passed（加解密 / 导入导出 / 多视图） | ✅ |
| 6 | 全量回归 | `verify.js all` | 0 | 静态 0 / Node 503 / PW 167 passed+4 skipped / 性能 7-7 | ✅ |
| 7 | 零漂移 | `check-parity.mjs` | 0 | canonical 哈希不变（5fed0215…） | ✅ |

**门控判定：7 / 7 全部通过。**

---

## 四、验收期间发现并修复的问题（留痕）

1. **`benchmark-30k.spec.ts` 装配骨架与 M1 新壳不匹配**
   - 现象：`No tests`/断言失败「topbar `.tb-nav-btn[data-view]` 缺失」。
   - 根因：旧 harness 以「`#content` 不存在」为整套重建条件；M1 的 `index.html` 已内置三区骨架，
     守卫直接 return，导致产品 `bindTopbar()` 无按钮可绑。
   - 修复：改为仅向 `#tbNav` 补视图按钮，并在 `readystatechange → interactive`（deferred 模块执行前）
     即挂载；**未改动任何产品源码**。
2. **`full-e2e.spec.ts` 的 UI 状态读取**
   - `window.JU.ui` 在装配期以**访问器函数**发布；直接写 `JU.ui.encrypted` 只写到函数对象上，
     不影响真实单例。
   - 修复：统一按 `typeof JU.ui === 'function' ? JU.ui() : JU.ui` 取活跃 ui 后再读写。

两项均属测试侧装配修正，产品行为未改变；修复后相关门禁实测通过（见 §2.3、§2.5）。

---

## 五、结论

- M1 全部成果可验证：工程重构完成（38 模块 / 单文件产物 / `window.JU` 单点装配）、死代码清理
  （三处整块删除 + 重复清洗实现下线）、空 catch 消灭（176 处 / 20 文件）。
- 七项质量门禁全部 Exit 0，且关键数据（30k 启动/内存、3 标签哈希、171 用例回归、canonical 哈希）
  均为本轮真实命令输出，无口头声称。
- 遗留项（M5 处理，不阻断 G1）：`bindSettings` / `bindTools` 重面板迁移、`legacy/loader.ts` 实装、
  桌面安装器（NSIS/MSI）受网络阻断暂缺。

> **G1 门控正式达成，具备进入 M5 稳定期前置条件。**

---

## 六、附：证据文件位置

| 类型 | 位置 |
| --- | --- |
| 本报告 | `6.P0-T3基线/m07-vite/docs/MILESTONES/G1-ACCEPTANCE-REPORT.md` |
| 重构总结 | `6.P0-T3基线/m07-vite/docs/M1-1-REFACTOR-SUMMARY.md` |
| 空 catch / 注入点 | `_报告与元数据/M1-1-BATCH-AKALAM-REPORT-2026-10-24.md` |
| 死代码清理 | `_报告与元数据/r66-CODE-cleanup-boot-errmsg-REPORT-2026-10-23.md` |
| Worker / 合规 | `_报告与元数据/M07-CE-CF-CG-CH-SEARCH-WORKER-COMPLIANCE-REPORT-2026-10-24.md` |
| Tauri 桌面壳 | `_报告与元数据/M07-BH-BJ-TAURI-IPC-BUNDLE-REPORT-2026-10-24.md` |
| 长跑稳定期 | `_报告与元数据/M07-BT-BU-BV-M5-1-STABILITY-LONGRUN-REPORT-2026-10-24.md` |
| 新增 E2E | `6.P0-T3基线/m07-vite/tests/full-e2e.spec.ts` |
| 发版材料 | `6.P0-T3基线/m07-vite/docs/RELEASE/RELEASE-NOTES-v2.1.md`、`USER-MANUAL.md` |
