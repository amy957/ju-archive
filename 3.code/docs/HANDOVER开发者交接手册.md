# JU 笔记 v2.1 · 开发者交接手册（HANDOVER）

> 适用版本：v2.1.0（`m07-vite`）
> 读者：接手本工程的开发者 / 维护者
> 配套文档：`docs/RELEASE/RELEASE-NOTES-v2.1.md`、`docs/module-boundaries.md`、`docs/M1-1-ARCH-DECISION.md`

---

## 一、工程定位

本工程是「JU 笔记」v2.1 的**模块化源码工程**：把原单体 HTML（23,451 行、9 段内联脚本）拆成 TypeScript
模块，由 Vite 打包为**完全自包含的单文件** `dist/index.html`，再由 Tauri 包一层 Windows 桌面壳（裸 exe）。

两条交付形态共用同一份前端源码：

| 形态 | 入口 | 产物 |
| --- | --- | --- |
| Web | `index.html` → `src/main.ts` | `dist/index.html`（单文件，无外链 assets） |
| 桌面 | 同上，经 Tauri WebView 加载 | `src-tauri/target/release/ju.exe` → 归档为 `dist/release/JU-v2.1-win-x64.exe` |

**硬约束**：`dist/` 只允许存在 `index.html`。任何会拆出独立 chunk 的写法（动态 `import()` 出 JS 文件、
外链 CSS、静态资源引用）都会破坏单文件交付，必须用内联手段（如 `?worker&inline`）替代。

---

## 二、目录结构

```text
m07-vite/
├─ index.html                 # Vite 入口 HTML（挂载点 #app）
├─ vite.config.ts             # 单文件构建配置（vite-plugin-singlefile）
├─ tsconfig.json              # 类型检查面（含 src / tests）
├─ playwright.config.ts       # E2E 配置（Chromium 解析顺序 / 300s 超时 / 单 worker）
├─ package.json               # 脚本与依赖
├─ .github/workflows/ci.yml   # CI：tsc → 单测 → E2E → vite build → 上传 dist/index.html
│
├─ src/                       # 前端源码（TypeScript）
│  ├─ main.ts                 # 唯一装配出口：注入所有 Deps、挂载 window.JU
│  ├─ core/                   # 状态与数据内核
│  │  ├─ store.ts             # state / listeners / notify 调度 / 字数统计入口
│  │  ├─ actions.ts           # 节点增删改、_nowSeq 单调序列
│  │  ├─ produce.ts           # 不可变更新（__juProduce）
│  │  ├─ persist.ts           # 落盘调度 / 多标签广播 / LWW 合并 / 墓碑
│  │  ├─ crypto.ts            # AES-GCM-256 + PBKDF2 加密适配层
│  │  ├─ license.ts           # 离线授权码验签（ECDSA P-256）
│  │  ├─ license-keys.ts      # 授权公钥（SPKI DER Base64，只读）
│  │  ├─ wordcount.worker.ts  # 字数统计 Worker + 同步实现
│  │  ├─ search.worker.ts     # 搜索倒排索引 Worker
│  │  ├─ richtext.ts / errors.ts / constants.ts / utils.ts
│  ├─ views/                  # 业务视图：outline / calendar / database / mindmap /
│  │                          #   graph / lists / presentation / slides
│  ├─ ui/                     # 布局、侧栏、右栏、焦点、选区、编辑器、主题、时间选择器
│  ├─ io/                     # import.ts / export.ts（JSON / Markdown / HTML / OPML / Excel / ICS）
│  ├─ app/                    # boot.ts（启动编排）、render.ts、updater.ts（Tauri 更新检查）
│  ├─ contract/               # registry.ts（契约键注册）、lifecycle.ts（释放栈）
│  ├─ types/                  # 全局类型声明（ju.d.ts 等）
│  └─ legacy/                 # 尚未完全迁移的过渡实现
│
├─ src-tauri/                 # 桌面壳（Rust）
│  ├─ src/main.rs             # 3 条存储命令 + crash/update 相关命令注册
│  ├─ Cargo.toml              # 依赖与 profile
│  ├─ tauri.conf.json         # 窗口 / 白名单 / bundle.targets=["app"]
│  └─ target/release/ju.exe   # 构建产物（prepare-release 的输入）
│
├─ scripts/                   # 工程脚本（Node ESM）
│  ├─ build-all.mjs           # 一键发版：tsc → test → vite → tauri → prepare-release
│  ├─ prepare-release.mjs     # 归档 dist/release/* + SHA-256 清单
│  ├─ gen-license.mjs         # 生成授权码（私钥签名，开发者本地执行）
│  ├─ gen-sbom.mjs            # 生成 SBOM
│  ├─ audit-license.mjs       # 依赖许可审计
│  ├─ check-unused-exports.mjs# 未使用导出扫描（仅标记）
│  ├─ check-parity.mjs        # 与冻结版只读对拍
│  └─ fix-empty-catch.mjs     # 空 catch 批量修复（一次性工具）
│
├─ test/                      # 契约单元测试（node:test，.mjs）
│  ├─ contract.test.mjs
│  └─ api-shape.test.mjs
│
├─ tests/                     # Playwright E2E 与性能/稳定性用例（.spec.ts）
├─ docs/                      # 架构、法务、发布、业务文档
├─ server/                    # license-server.mjs（本地试用授权服务）
└─ public/                    # 默认不进入产物（需 JU_KEEP_PUBLIC=1 才直通拷贝）
```

> **关于「`src/tauri`」**：本工程没有 `src/tauri` 目录。桌面桥接由三处共同构成——
> ① Rust 端 `src-tauri/src/main.rs`（命令实现与注册）；② 前端调用的 `desktopInvoke(cmd, args)` 端口
> （在 `src/core/crypto.ts`、`src/core/errors.ts`、`src/io/import.ts` 等以 Deps 形式声明，
> 由 `src/main.ts` 统一注入真实实现）；③ 更新检查 `src/app/updater.ts`（动态 `import('@tauri-apps/api/updater')`）。
> 查找桌面能力时，请以这三处为准，不要按 `src/tauri` 路径搜索。

---

## 三、核心机制

### 1. Store 与 Deps 注入逻辑

**两层结构**：`core/store.ts` 持有唯一可变状态，其余模块只通过端口访问。

```text
core/store.ts
  state / listeners / scheduleNotify() ──► subscribe() 监听者
        │
        └─ schedulePersist()  ← 装载时被 core/persist 反向绑定（bindPersistStore）
                                  └─ runPersist()：明文 / 密文 / 桌面 IPC 三通道
```

- `initStore()` 初始化 state，`getState()` 是唯一读端口，`setState()` 改引用，`scheduleNotify()`
  合并同一 tick 内的多次修改（`notifyPending` 去抖）后统一 `notify`。
- **依赖注入约定**：每个拆分模块导出 `XxxDeps` 接口 + `bindXxxDeps(deps)`，
  - 未注入时一律走**安全 noop**，等价于产品件中「该全局不存在」的分支，不抛错；
  - `src/main.ts` 是**唯一装配点**：所有 `bind*Deps` 在此集中调用，顺序与产品件执行序一致；
  - 跨模块的 `let` 绑定无法共享，统一以 **getter/setter 端口**承接
    （例如 `deps.state()` / `deps.getState()` 恒读同一引用）。
- `core/persist.ts` 是**反向挂载**的特例：它在模块装载时调用 `bindPersistStore({ schedulePersist })`，
  把真实落盘实现回填给 `core/store`，因此 `scheduleNotify → schedulePersist → runPersist` 是真实链路，
  `core/store` 里的默认 noop 只是「persist 未装载」的兜底。
- **对外契约**：全部能力最终挂到单一全局 `window.JU`（由 `src/contract/registry.ts` 注册、`main.ts` 装配）。
  模块不得零散直写 `window.*`；`window.JU.ui` 是访问器，读取需兼容
  `typeof JU.ui === 'function' ? JU.ui() : JU.ui`。

### 2. Worker 的计算逻辑

| Worker | 文件 | 触发条件 | 协议 / 行为 |
| --- | --- | --- | --- |
| 字数统计 | `core/wordcount.worker.ts` | 节点总数 > `WORDCOUNT_WORKER_THRESHOLD`（5,000） | 主线程 `{ nodes, docId }` → Worker `{ docId, wordCount }` |
| 搜索 | `core/search.worker.ts` | 常驻，输入去抖 40 ms，Enter 立即检索 | 倒排索引（拉丁词 / CJK 单字 / CJK 双字） |

**字数统计**要点：
- 小文档（≤ 5,000 节点）仍走主线程同步 `countSubtreeChars()`，接口语义与迁移前一致、零延迟；
- 大文档改为「返回缓存值（无缓存为 `null`）+ 投递一次 Worker 计算」，Worker 完成后写缓存并
  `scheduleNotify()` 派发更新，主线程不做全量子树遍历；
- 字数口径：`stripHtml()` 去标签后按 **Unicode 码点**计字（emoji / 代理对计 1 个字）；
- `visited` 集合防脏数据成环；模块顶层带 Worker 环境守卫，被主线程 `import()`（取同步实现）时
  不会给 `window` 挂 `onmessage`；
- **单文件约束**：`core/store.ts` 以 `./wordcount.worker?worker&inline` 引入，Worker 代码以 blob 内联进
  入口 bundle，不产生独立 chunk。改动 Worker 引入方式前必须先验证 `dist/` 仍只有 `index.html`。

**搜索 Worker** 不可用或超时会**自动回落同步扫描**，两条通道结果口径一致，避免功能不可用。

### 3. 加密与验签逻辑

**（a）本地全库加密 —— `core/crypto.ts`**

- 算法：**AES-GCM-256**；密钥派生 **PBKDF2-SHA256**，默认迭代 **600,000** 次（OWASP 建议值）。
- 密文载荷 `EncPayload`：`{ v, salt, iv, cipher, iter, updatedAt }`，`salt / iv / cipher` 均为 Base64，
  `iter` 随载荷写入——**旧密文按各自 `payload.iter` 解密**，升级不会导致历史数据打不开。
- 盐复用：`_getOrCreateSalt()` 在密码未变时复用既有盐，`_encKey` / `_encKeySig` 缓存派生结果，
  避免每次落盘重跑 60 万次迭代。
- 落盘链路：`writeEncryptedStore()` 写 `localStorage[ENC_KEY='juju.enc.v1']`，同时清理明文主库
  （`PENDING_KEY='juju.pending'` 为历史遗留明文暂存键，启动期清理）；桌面端另经
  `desktopInvoke('save_state', …)` 写 `app_data_dir/ju_store.json`。
- 解锁：刷新后进入解锁界面（`promptUnlock`）；密码错误直接拒绝；忘记密码走 `purgeVersions()` 重置路径。
- 密钥不落盘：明文密钥仅存在于内存 `ui.encKey`，不写入存储。

**（b）离线授权码验签 —— `core/license.ts`**

- 授权码格式：`payloadBase64.signatureBase64`（**恰好一个 `.`**，多于一个直接判非法）。
- `payload = {"userId","plan","expire","iat"}` 的 UTF-8 JSON 的 Base64；
  `signature` 为 **64 字节 IEEE P1363（r‖s）** 签名的 Base64。
- 验签：**ECDSA P-256 / SHA-256 / WebCrypto**，公钥硬编码在 `core/license-keys.ts`（SPKI DER Base64），
  私钥只在签发端（`scripts/gen-license.mjs` + 开发机私钥）持有。
- 校验两件事：**签名真实** + **`expire` 未过期**（到期日当天 UTC 末刻仍有效）。
- 对外契约只有 `LICENSE_STORAGE_KEY`(`'juju.license.v1'`) / `verifyLicense` / `restoreLicense`，
  其余解析函数为模块内私有，不扩大对外面。

---

## 四、常用命令

### 开发

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（`http://localhost:5173`） |
| `npm run preview` | 预览构建产物 |
| `npm run server:license` | 启动本地试用授权服务（`server/license-server.mjs`） |

### 构建与发版

| 命令 | 作用 |
| --- | --- |
| `npm run build` | 仅 Web 单文件构建（`vite build` → `dist/index.html`） |
| `npm run build:all` | **一键发版**：`tsc --noEmit` → `node --test` → `vite build` → `tauri build --bundles none` → `prepare-release.mjs`，末尾打印产物清单（字节数 + SHA-256） |
| `node scripts/prepare-release.mjs` | 单独归档 `dist/release/*` 并生成 `JU-v2.1-checksums.txt` |
| `npx tauri build --bundles none` | 仅构建桌面裸 exe（不生成安装器） |
| `set JU_BUNDLES=nsis` + `npm run build:all` | 可选分支：额外产出 NSIS 安装包（`src-tauri/target/release/bundle/nsis/*-setup.exe` 复制为 `JU_<ver>_x64-setup.exe` 并入归档并登记 `JU-v2.1-checksums.txt`）；未设置时默认 `none`，既有链路不变 |

> `build:all` 以 `process.execPath` 调用 `node_modules` 内的 JS 入口（tsc / vite / tauri），
> 因此**不要求全局 `node` 在 `PATH`**，也不需要 `.cmd` 包装器。任一步骤非 0 即中止并透传退出码。

### 质量门禁

| 命令 | 作用 |
| --- | --- |
| `npx tsc --noEmit` | 类型检查（含 `tests/**/*.ts`） |
| `npm test` | 契约单元测试（`node --test test/contract.test.mjs test/api-shape.test.mjs`） |
| `node --test test/*.mjs` | 同上（glob 由 Node 测试运行器展开） |
| `npx playwright test` | 全量 E2E / 性能 / 稳定性用例 |
| `npx playwright test tests/full-e2e.spec.ts` | 单跑终极全链路 E2E |
| `npm run scan:unused` | 未使用导出扫描（仅标记，报告 `docs/UNUSED-EXPORTS.md`） |
| `npm run parity` | 与冻结版只读对拍（`PARITY OK`） |
| `node ..\step9\scripts\verify.js all` | 仓库级全量回归（静态 / Node / Playwright / 性能） |

### CI

`.github/workflows/ci.yml`：push 到 `main` 或任意 PR 时，在 `windows-latest` 上依次执行
`npm ci` → `npx tsc --noEmit` → `node --test test/*.mjs` → `npx playwright install chromium` →
`npx playwright test` → `npx vite build`，最后把 `dist/index.html` 上传为 artifact `ju-web-dist`。
流水线无 Secrets 依赖；Tauri exe 由本地 `npm run build:all` 产出，不在 CI 内构建。

---

## 五、改动须知（维护红线）

1. **单文件产物不可破**：新增依赖或资源前先确认是否会拆出 `assets/`；构建后检查 `dist/` 只有
   `index.html`。需要静态资源时显式 `JU_KEEP_PUBLIC=1`，但那会破坏单文件形态，慎用。
2. **`window.JU` 是对外契约**：新增能力走 `src/contract/registry.ts` 注册，不直写 `window.*`；
   破坏性变更必须写进 `RELEASE-NOTES` 的「破坏性变更」表。
3. **Deps 注入不得绕过 `main.ts`**：新增模块导出 `XxxDeps` + `bindXxxDeps`，在 `main.ts` 装配；
   未注入时必须走安全 noop，禁止在模块顶层直接读取全局。
4. **存储键不可擅改**：`juju.store.v31`、`juju.enc.v1`、`juju.license.v1`、`juju.versions` 等键与旧版
   一致，改动会导致用户数据「看起来丢了」。
5. **`tests/` 用例会自建产物**：E2E 在 `beforeAll` 内重建构建产物，跑测试后可重跑
   `npm run build:all` 刷新正式归档，避免把测试期产物当发布包。
6. **归档规范**：仓库根目录只允许存在文件夹；本批次新增的脚本 / 文档均已落在 `m07-vite/scripts/`
   与 `m07-vite/docs/` 内，勿在根目录落盘临时文件。

---

## 六、常见问题速查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `prepare-release.mjs` 报缺 `ju.exe` | 未构建桌面壳 | 先 `npx tauri build --bundles none` |
| `prepare-release.mjs` 报缺 `dist/index.html` | 未构建 Web | 先 `npm run build` |
| `tauri build` 报找不到 `node` | `.cmd` 包装器依赖 PATH | 用 `npm run build:all`（内部走 `process.execPath`） |
| E2E 报浏览器缺失 | 未安装 Chromium | `npx playwright install chromium`，或用 `JU_CHROMIUM_PATH` 指定 |
| E2E 连接 `localhost` 超时 | 本机构建机入站策略阻断 | 用例以 Playwright 路由映射到构建产物，勿改为真实 HTTP 拉取 |
| 构建后 `dist/` 出现 `assets/` | 引入了外链资源 / 动态 chunk | 检查 Worker 引入是否带 `?worker&inline`、是否新增了 `import()` |
