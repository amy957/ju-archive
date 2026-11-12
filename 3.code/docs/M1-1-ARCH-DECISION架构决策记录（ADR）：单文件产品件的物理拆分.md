# M1-1 · 架构决策记录（ADR）：单文件产品件的物理拆分

> 文档编号：M0-8 / 批次 BB
> 决策状态：**已接受（Accepted）· 已由 M1-9 G1 门控验收**
> 上游依据：[`docs/module-boundaries.md`](module-boundaries.md)（M0-7 模块边界清单，9 个 `<script>` 块 / 557 条跨块引用边取证）
> 产品原件（只读）：`6.P0-T3基线/v2.0-t3.html`（1,316,707 字节 / 23,451 行 / SHA-256 `5FED0215…DFBFF818`）
> 工程产物：`6.P0-T3基线/m07-vite/`（38 个 `.ts` 源文件 / 19,331 行 / 构建产出单文件 `dist/index.html`）

---

## 1. 背景与问题陈述

产品件 `v2.0-t3.html` 是**单文件自包含应用**：HTML 骨架 + 9 个 inline `<script>` 块（B1–B9）+ 内联样式，合计 1.3 MB。

该形态在「可交付、可双击运行」上是优点，但在**可维护性**上构成三类硬约束：

| 问题 | 表现 | 后果 |
| --- | --- | --- |
| 单点冲突 | 6 个主干块共享同一全局词法环境，399 个顶层声明集中在 B1 | 任何改动都可能与其他批次的符号重名 / 相互覆盖 |
| 隐式耦合 | 跨块引用无显式声明，靠「按 script 顺序求值」维持 | 改动求值顺序即产生 TDZ `ReferenceError`，且无法静态发现 |
| 无法静态检查 | 无模块边界 ⇒ 无 `import` 图 ⇒ TS / ESLint / Tree-shaking 全部失效 | 类型错误只能靠运行期暴露；无用代码无法被剔除 |

M0-7 已完成**只读取证**（块切分、跨块引用边、副作用计数、TDZ / 函数提升清单），但**未迁移任何字节**。M1-1 的任务是把这份「依赖地图」落成真实的模块文件系统。

---

## 2. 决策

### 决策 D1：物理拆分到 Vite + TypeScript 工程，而非「继续单文件 + 保持约定」

**选择**：在 `6.P0-T3基线/m07-vite/` 建立 Vite 5 + TypeScript 5 工程，按 `src/{contract,core,ui,views,io,app,utils,legacy,types}` 分层，把产品件逐块迁入 38 个 `.ts` 模块。

**放弃的备选**：

| 备选 | 否决理由 |
| --- | --- |
| 保持单 HTML，仅追加注释/分区 | 不产生 `import` 图，类型检查与 Tree-shaking 仍然无效；文件数不降反升 |
| 拆成多个 `<script>` 外链文件（无构建） | 保留全局词法环境与加载顺序依赖，只是把 TDZ 风险从「块内」搬到「文件间」，且产品不再可双击运行 |
| 直接改用 Webpack / esbuild 手写配置 | Vite 的 `vite-plugin-singlefile` 已能保证「构建后仍是单 HTML」，零额外自研构建逻辑 |

**关键约束（不可谈判）**：拆分**不得改变交付形态** —— 构建产物必须仍是**单个 `index.html`**、**无需服务端**、**双击可运行**。因此拆分是「源码层」的，产物层保持单文件。

### 决策 D2：用 `vite-plugin-singlefile` 保证产物回退到单文件

[`vite.config.ts`](../vite.config.ts) 的配置即该决策的实现：

- `plugins: [viteSingleFile()]` —— 把入口 `<script type="module">` 与全部样式内联进 HTML，删除外链 chunk；
- `assetsInlineLimit: 100_000_000` —— 任何资源（图片/字体/JSON）一律 data URI 内联，杜绝 `assets/` 残留；
- `cssCodeSplit: false` —— 样式合并，不单独产出 CSS 文件；
- `build.target: 'es2020'` —— 与产品件的现代浏览器假设一致，不做无谓降级；
- `publicDir` 在 `build` 时置 `false`（除非显式 `JU_KEEP_PUBLIC=1`）—— 保证 `dist/` 只有 `index.html`。

该决策的验收口径写在 [`tests/smoke.spec.ts`](../tests/smoke.spec.ts:88)：断言 `dist/` **无子目录**、**文件集合恰为 `['index.html']`**、**无 `<script src=>` / `<link href=>` 残留**。

### 决策 D3：模块间依赖只走「三种显式通道」，禁止隐式全局

产品件的跨块引用全部是**隐式全局**（`const/let` 进全局词法记录、`function` 进全局对象）。ESM 后每个模块有独立词法环境，隐式全局**必然断裂**。因此规定：模块间通信只允许以下三条通道。

---

## 3. 解耦策略

### 3.1 闭环依赖：`Deps` 注入容器（替代「同作用域可见」）

**问题**：产品件里 `bindTools()` 之类的重面板函数依赖 150+ 个同作用域符号，直接 `import` 会造成循环依赖（A 需要 B 的渲染函数，B 需要 A 的状态与工具）。

**策略**：每个模块自持一个 `deps` 占位对象 + 一个 `bind*Deps(patch)` 注入入口，装配层（[`src/main.ts`](../src/main.ts:465)）在启动前回填真实实现。

标准形态（以 [`src/core/richtext.ts`](../src/core/richtext.ts:22) 为例）：

```ts
export interface RichtextDeps { toast: (msg: any) => void; }
export const deps: RichtextDeps = { toast: () => {} };          // 加载即不抛错的安全占位
export function injectRichtextDeps(patch: Partial<RichtextDeps>): void {
  Object.assign(deps, patch);                                    // 装配期回填真实实现
}
```

工程内共 10 余处同款端口：`bindPersistStore` / `bindCryptoDeps` / `bindThemeDeps` / `bindLayoutDeps` / `bindSelectionDeps` / `bindSidebarDeps` / `bindRightbarDeps` / `bindFocusDeps` / `bindTimepickerDeps` / `injectOutlineDeps` / `injectBootDeps`。

**为什么依赖方向是「闭环」而非树状**：产品件的引用边本身是双向的（B1 调 B2 的 `buildCalIndex`，B2 调 B1 的 `state/commit`）。强行拉成树会需要在中间层复制状态，破坏单例语义。Deps 端口把**类型依赖**前置、**实现依赖**延后到装配期，从而允许双向引用同时存在而不形成 ESM 循环导入。

[`src/app/boot.ts`](../src/app/boot.ts:42) 的 `BootDeps` 是最大的一处：约 140 个端口键，覆盖存储键、跨模块 `let` 绑定（getter/setter 化）、数据装载 / 持久化 / 加密、渲染、主题、全局绑定、番茄钟等。

**跨模块 `let` 的处置（关键细节）**：ESM 无法共享可写 `let` 绑定。产品件的 `IS_DESKTOP` / `_graphPositions` / `_reminderTimer` / `_graphWorker` / `_l7YieldCh` / `_syncAppInertObserver` 等模块级可变量，一律改为 **getter/setter 端口对**：

```ts
getReminderTimer: () => any;
setReminderTimer: (v: any) => void;
```

写操作只能经 setter，释放逻辑（pagehide 清理）也走同一端口，保证「谁持有句柄」在装配置层唯一可读。

### 3.2 全局函数与变量收敛：`window.JU` 单一装配点

**问题**：产品件的对外契约是 `window.JU`（`JU.state / JU.commit / JU.N / JU.actions / JU.lifecycle` 等，见 M0-7 §1.7 的 4 处 `JU.register` + boot 尾部挂载）。拆分后若各模块各自 `window.JU.xxx = ...`，则「全局属性赋值散落全工程」，与拆分目标相悖；且 `injectBootDeps({ JU })` 已捕获的引用会因对象被重新赋值而失效。

**策略**（M1-1d 收敛口径）：

1. [`src/main.ts`](../src/main.ts:446) 提供唯一写入出口 `publishJU(patch)`；
2. 所有模块（含 `app/boot.ts`）**禁止**直接写 `window.JU.xxx`，需要曝光的能力打包成交给 `deps.publishJU(juPatch)`（[`src/app/boot.ts`](../src/app/boot.ts:1002)）；
3. [`src/main.ts`](../src/main.ts:1062) 的单一 `Object.assign(window.JU, { ... })` 装配点集中落位全部键；
4. 一律 `Object.assign` 而非 `window.JU = {...}`，保持已捕获引用的**同一性**。

契约对齐是硬约束：键集合与产品件 `_win.JU.*` **逐项一致，不得新增 / 删除键名**（M0-7 契约）。`JU.register / JU.require` 与 `JU.lifecycle` 分别由 [`src/contract/registry.ts`](../src/contract/registry.ts) 与 [`src/contract/lifecycle.ts`](../src/contract/lifecycle.ts) 承接，错误消息字面量 `'JU.require missing: '` 与 `console.warn` 前缀 `'[JU.lifecycle]'` 逐字保留（由 `test/contract.test.mjs` 6 条契约测试锁定）。

`JU.lifecycle` 的栈语义（`push` / `pop`）同样逐字保留 —— 这是全局事件监听清理的统一出口（见 §4.2）。

### 3.3 状态传递：Proxy 结构共享 + 不可变替换

**问题**：`commit()` 的语义是「基于旧 state 产生新 state 并通知订阅者」。若改成深拷贝，大文档（数千节点）每次提交都会 O(n) 复制整棵树，性能不可接受；若改成原地修改，则无法做撤销/重做与历史快照。

**策略**：沿用并模块化产品件的自研结构共享原语（[`src/core/produce.ts`](../src/core/produce.ts:33)），不引入 Immer。

- `__juProduce(base, recipe)`：`base` 为普通对象/数组时返回 `Proxy` draft；recipe 内直接改；
- **未修改分支返回原引用**（Immer 式），已修改分支**仅复制变更路径**，未变更子树保持原引用；
- `base` 为 `Date / Map / Set / RegExp` 时回退 `safeClone`（不保证结构共享）；
- `finalize` 用 `done` 映射防循环引用；
- `__juProduceSafe` 在 `recipe` 抛错时返回 `{ok:false, base, error}`，供 `commit` 走回滚分支而不污染 `base`。

配套的两个坑已在迁移中显式修复（保留原注释与防御分支，不精简）：

- **Proxy 泄漏（proxy-of-proxy 嵌套）**：上一轮泄漏进 `state` 的子 draft 先解包为 `__juBase` 原始 target，再 `getRec()`，避免 `new Proxy(proxy)`；
  ```ts
  if (value && typeof value === 'object' && (value as any).__isJuDraft === true) value = (value as any).__juBase;
  ```
- **删除中间态（F-1）**：draft 内已删的键在 `get` 中返回 `undefined`，**不回落** `target` 旧值，否则撤销/删除合并会出现「幽灵值复活」。

状态单例（`state / listeners / notifyPending`）收拢在 [`src/core/store.ts`](../src/core/store.ts:19)，落盘调度通过 `PersistStore` 端口外发：

```ts
export function schedulePersist(): void { _persistStore.schedulePersist(); }
```

真实落盘实现由 [`src/core/persist.ts`](../src/core/persist.ts) 在**模块装载时**调用 `bindPersistStore({ schedulePersist })` 反向自挂载，`src/main.ts` 再显式覆盖一次（幂等）。这样 `scheduleNotify() → schedulePersist() → runPersist()` 是真实链路，而 `core/store` 不反向 import `core/persist`，闭环依赖成立。

---

## 4. 核心坑点与解决路径

### 4.1 坑点一：`APP_LOCALE` 跨块引用（TDZ / 加载顺序依赖）

**现象**：`APP_LOCALE` 在产品件中定义于 B1 常量区，但被 B4（`export.ts` 的 Markdown/HTML 导出）与 B6（设置面板）在**文件顶部或渲染期**读取。ESM 化后若常量落在使用方之后求值，立即 `ReferenceError: Cannot access 'APP_LOCALE' before initialization`；而 `export.ts` 顶部就 `import { APP_LOCALE }`，若 `core/constants` 又 import 回 `io/export`，则形成循环导入 —— 循环导入下的 `const` 求值顺序**不保证**，是典型的「时好时坏」缺陷。

**解决路径**：

1. **把常量下沉到零依赖叶模块**：[`src/core/constants.ts`](../src/core/constants.ts:9) 只导出 `TAG_RE / WIKI_RE / APP_LOCALE / VIEW_KIND`，**不 import 任何模块**。任何模块都能安全地静态 import 它，求值顺序问题被结构性消除。
2. **保持声明形态**：跨块被引用的符号一律保留 `const`（常量）/ `function`（可提升）形态，**禁止**改成顶层 `const f = () => {}` 后再被更早的模块在顶层读取（M0-7 §3.1/§3.2 的迁移必守项）。
3. **getter 规避法**：产品件里 B1 的 `JU.register('core')` 用 `get openNode(){...}` 这类 getter 包裹后置块符号，正是为避开执行期求值。该语义在 [`src/main.ts`](../src/main.ts:1062) 的装配点被完整保留 —— 装配只做引用挂载，不在装配期调用。
4. **验收**：`tsc --noEmit` 通过 + `tests/smoke.spec.ts` 的 `pageErrors` 断言为空（构建产物加载期间零 `pageerror`）。

### 4.2 坑点二：全局事件监听泄露

**现象**：产品件有 **68 处 `document.addEventListener` + 22 处 `window.addEventListener`**（M0-7 §2 实测）。单文件页面「刷新即重置」，泄露不可见；但拆分为模块后：

- 各模块在**模块顶层**注册监听，`import` 即执行 ⇒ 同一监听可能被注册多次（模块被多次引用 / 热更新 / 测试多次导航）；
- 无统一句柄 ⇒ 无法在页面卸载或测试 teardown 时释放（`BroadcastChannel`、两个 `Worker`、`MessageChannel`、4 个 `MutationObserver`、多个 `setInterval` 全部泄漏）；
- 泄露的直接后果是**多标签并发测试不收敛**（本工程 `tests/concurrency.spec.ts` 的 3 标签 3000 次操作场景会因此挂死或哈希不齐）。

**解决路径**：

1. **统一注册表**：[`src/contract/lifecycle.ts`](../src/contract/lifecycle.ts) 复刻产品 `J.lifecycle` 的 `add / on / dispose` 栈语义 —— `on(target, type, handler, opts)` 在注册监听的同时把 `removeEventListener` 闭包压栈，`dispose()` **逆序 pop** 全部释放，单项抛错不阻断后续。
2. **资源句柄集中登记**：[`src/app/boot.ts`](../src/app/boot.ts:951) 把 10 项资源改为 `JU.lifecycle.add(...)` 注册 —— ① BroadcastChannel ② MessageChannel + 待执行队列 ③ 模态栈 inert 观察者 ④ 键盘可达性观察者 ⑤ 提醒轮询定时器 ⑥ 番茄钟定时器 ⑦ 索引 Worker（`terminate` + `revokeObjectURL`）⑧ 图谱 Worker（`dispose`）⑨ vsLongtask 观察者 ⑩ L14 长任务闸门观察者。另有 3 处（vsLongtask / L14 gate / a11y）在各自模块内就地注册，合计 13 处。
3. **卸载单一触发点**：`pagehide` 只做一件事 —— `JU.lifecycle.dispose()`。逐项独立 `try/catch`，任何一项失败都不阻断其余项。
4. **句柄跨模块归属的解法**：这 10 项资源的句柄分属 4 个不同模块（B1/B2/B4/B7），因此释放闭包从 `deps.getXxx()` 取值并在释放后 `deps.setXxx(null)`，保证「释放后不留悬垂句柄」。
5. **验收**：`tests/concurrency.spec.ts` 3 标签 3000 次操作后 `memoryProjectionHash` / `diskProjectionHash` 三标签**同哈希**（`ceb9b317…6c69f163`）、`canonicalEqual: true`、`pageErrors: []`。

### 4.3 坑点三：富文本 DOM 污染

**现象**：产品件用 `document.execCommand` 做富文本编辑，并把粘贴内容 / 用户样式直接写进 `contenteditable` 区域。拆分后出现三类污染：

- **粘贴来源污染**：从 Word / 网页粘贴会带入 `position:fixed`、`z-index:9999`、`background`、`expression()`、`javascript:` 等，直接覆盖应用自身布局（一次粘贴即可让侧栏消失）；
- **`execCommand` 猴子补丁丢失**：产品件在 B1 内 `document.execCommand = function(...)` 包装原函数；拆块时若补丁与被补丁方分散到两个模块，`bind` 丢失原引用 ⇒ 编辑命令静默失效；
- **清洗非幂等**：非白名单标签被剥离时若把子节点文本直接回填，重复清洗会产生文本倍增 / 表格 foster-parenting 结构漂移。

**解决路径**（全部收拢在 [`src/core/richtext.ts`](../src/core/richtext.ts)）：

1. **双白名单**：`SAFE_TAGS`（37 个标签）+ `SAFE_ATTRS`（按标签允许属性）；任何非白名单**标签**被剥离但**文本保留**，非白名单**属性**直接丢弃。
2. **CSS 属性白名单**：`CSS_WHITELIST` 仅允许排版类属性（`color` / `font-*` / `text-*` / `margin-*` / `padding-*` / `border*` / `opacity` 等），**剥离 `position` / `z-index` / `inset` / `background`** —— 这是「粘贴导致布局崩塌」的直接修复（P0-1 S3）。
3. **XSS 诱因过滤**：`expression` / `behavior` / `-moz-binding` / `javascript:` / `vbscript:` 一律剔除；`data:image` 走体积阈值（700,000 字符）。
4. **`execCommand` 补丁与包装同模块**：`safeExec` 包装与 `_warnExecFail`（按命令分组的 30s 限频，避免 bold 失败连带吞掉 italic 提示）同处 `richtext.ts`，`bind(document.execCommand)` 的原引用不被跨模块拆分。
5. **幂等清洗**：`sanitizeHtml` 保证「非白名单标签文本回填 + 表格 foster-parenting」幂等 —— 对同一输入重复清洗结果稳定。该不变量由上游 `t9/t16-w16-sanitize-idempotent.test.mjs` 用例锁定，并在 `verify.js all` 中每次回归。
6. **依赖显式化**：`_warnExecFail` 原本直接调用同作用域的全局 `toast()`，现改为经 `RichtextDeps.toast` 端口调用（[`src/core/richtext.ts`](../src/core/richtext.ts:22)），不再隐式读取全局。

---

## 5. 决策后果（Consequences）

### 正面

- **可静态检查**：`tsc --noEmit` 覆盖 38 个模块 / 19,331 行；类型错误在构建前暴露，而非运行期。
- **可 Tree-shake / 可压缩**：产物从 1,316,707 字节降到 **431,216 字节（-67.25%）**，gzip 134.33 kB。
- **冲突面收敛**：单文件 23,451 行 → 最大单模块 2,086 行（[`src/views/calendar.ts`](../src/views/calendar.ts)），中位模块约 300–600 行。
- **依赖可审计**：所有跨模块依赖是 `import`（静态可见）+ `deps` 端口（装配期可见），M0-7 的隐式边被显式化。

### 负面 / 代价

- **装配层复杂度上移**：[`src/main.ts`](../src/main.ts) 承担全部 `bind*Deps` 回填与 `window.JU` 落位，是 1,850 行的装配中枢；任何端口签名变更都要改这里。
- **占位实现的双重维护**：未迁移符号以 `deps` 空实现承接（如 `core/store.ts` 顶部的 8 个 `TODO: M1-2+` 端口），在后续批次回填前，对应分支是**行为等价的空壳**而非真实逻辑 —— 必须在 M1-2+ 逐项替换，不可遗忘。
- **`public/` 构建语义分叉**：`build` 默认不拷贝 `public/`（保证单文件产物），需要 `public` 直通的构建（如 `benchmark-30k`）必须显式 `JU_KEEP_PUBLIC=1`。

### 不变量（后续任何改动必须保持）

1. 产物仍是**单个 `index.html`**、无子目录、无外链脚本/样式；
2. `window.JU` 键集合与产品件**逐项一致**，只经 `publishJU()` / 单一装配点写入；
3. `JU.require` 错误消息与 `[JU.lifecycle]` 前缀**逐字不变**；
4. `core/constants.ts` 保持**零 import 叶模块**；
5. 跨模块可写状态只经 getter/setter 端口，不共享 `let`；
6. `pagehide` 仍是唯一卸载触发点，`JU.lifecycle.dispose()` 逆序释放。

---

## 6. 关联文档与取证

| 文件 | 作用 |
| --- | --- |
| [`docs/module-boundaries.md`](module-boundaries.md) | M0-7 模块边界清单：9 块切分、557 条引用边、TDZ / 函数提升必守项 |
| [`docs/M1-1-REFACTOR-SUMMARY.md`](M1-1-REFACTOR-SUMMARY.md) | 重构前后指标对比 + G1 门控验收记录 + 基线冻结哈希 |
| [`vite.config.ts`](../vite.config.ts) | 单文件产物构建配置（决策 D2 的实现） |
| [`tests/smoke.spec.ts`](../tests/smoke.spec.ts) | 单文件产物形态 + 构建产物可加载的冒烟验收 |
| [`tests/concurrency.spec.ts`](../tests/concurrency.spec.ts) | 3 标签并发收敛（监听泄露 / 句柄泄露的回归闸门） |
| [`test/contract.test.mjs`](../test/contract.test.mjs) | `register/require/lifecycle` 契约逐字对齐的 6 条单测 |
| `1.冻结版本/v2.1-m1-1-frozen.html` | 本决策产出的基线冻结件 |

---

# ADR-D01 · IndexedDB 持久化：恢复 IDB 写入 + localStorage 兜底（方案 A）

- **日期**：2026-10-27
- **状态**：已采纳（Accepted）
- **触发**：`90过程材料/_报告与元数据/v2.1-缺陷对比报告-2026-10-26.md` **D-01（P1）**
- **范围**：[`src/core/idb.ts`](../src/core/idb.ts)（新增）、[`src/core/persist.ts`](../src/core/persist.ts)、[`src/main.ts`](../src/main.ts)

## 背景

v2.1 产物运行期 `indexedDB.databases()` 返回 `[]`，脚本内 `indexedDB` 命中 **0** 次；
落盘只有 `localStorage["juju.store.v31"]`（约 2.5 KB）。v2.0-t3 单文件件有 9 处 `indexedDB` 引用。
根因：Vite 多模块拆分（M1-1）时未迁移 L9/IDB 持久化适配层，且没有任何文档记录「降级为 localStorage-only」。
即：这是一次**未记录的能力丢失**，不是有意决策。

## 决策

在两个备选中选择 **方案 A：恢复 IDB 写入并保留 localStorage 兜底**。

| 备选 | 内容 | 结论 |
| --- | --- | --- |
| 方案 A（采纳） | 新增 `core/idb.ts` 适配层；`runPersist()` 明文分支成功写 localStorage 后再镜像一份到 IDB；`loadState()` 读路径不变 | ✅ **采纳** |
| 方案 B（驳回） | 明确「v2.1 采用 localStorage-only」并删除全部 IDB 残留引用 | ❌ 驳回：等于把能力丢失固化为设计，且 exe 桌面版缺少第二副本 |

## 实现口径（不变量）

1. **localStorage 仍是唯一权威读路径**：`loadState()` 一行未改，启动语义零漂移；
2. **IDB 是第二副本**：`juju.store` 库 / `kv` 对象仓 / `state` 键，值为 `{ json, updatedAt }`；
3. **加密模式不镜像**：`ui.encrypted` 分支只写密文后端，绝不把明文写进 IDB（不绕过加密）；
4. **失败不扩散**：所有 IDB 操作自带 3 s 超时 + 异常吞掉，只更新 `getIdbMirrorStatus()`；
   镜像失败不改写本次落盘的成功判定，不递增 `_persistFailCount`，不重排调度；
5. **可观测**：`window.JU.persistence = { idbSupported, idbStatus, idbDatabases, idbReadState }`
   是唯一验收面（[`src/main.ts`](../src/main.ts:2260) 附近落位），测试不旁路内部实现。

## 验收

| 项 | 证据 |
| --- | --- |
| `indexedDB.databases()` 非空且含 `juju.store` | [`src/test/persist-idb.test.mjs`](../src/test/persist-idb.test.mjs)（真实 Chromium + HTTP 源） |
| 镜像写入成功（`lastOk === true`，`writes >= 1`） | 同上，读 `JU.persistence.idbStatus()` |
| 可从 IDB 读回含 `nodes` / `rootId` 的快照 | 同上，读 `JU.persistence.idbReadState()` |
| localStorage 兜底仍在 | 同上，断言 `juju.store.v31` 长度 > 0 |
| 实机日志 | `90过程材料/tmp_compare/fix/idb_fix.log`（含 `IDB_USED=true` 与库名列表） |
