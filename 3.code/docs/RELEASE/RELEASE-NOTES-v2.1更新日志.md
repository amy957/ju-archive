# JU 笔记 v2.1.0 更新日志（Release Notes）

> 版本：v2.1.0
> 发布日期：2026-10-24
> 适用平台：Windows 10 / 11（x64，需 WebView2 Runtime）
> 交付形态：单文件 Web 构建 `dist/index.html` + Tauri 桌面壳 `JU-v2.1-win-x64.exe`

---

## 一、版本亮点（Highlights）

### 1. 工程重构完成（M1）

- 原 1 个 23,451 行、内含 9 段内联脚本的单体 HTML，拆分为 **38 个 TypeScript 模块 / 19,331 行**，
  分层为 `core`（状态、提交、持久化、加密、富文本）、`app`（启动、渲染）、`views`（大纲 / 日历 /
  多维表格 / 导图 / 图谱 / 演示 / 幻灯片 / 列表）、`ui`（布局、侧栏、右栏、焦点、选区、编辑器）、
  `io`（导入导出）、`contract`（注册表与释放栈）。
- 源码总量较重构前减少 **4,120 行（-17.6%）**，最大单文件由 23,451 行降至 2,086 行（-91.1%）。
- 构建产物为完全自包含的单 HTML：**431,216 字节（gzip 134.33 kB）**，较原版 1,316,707 字节
  下降 **67.25%**；`dist/` 内只有 `index.html`，无 `assets/` 外链。
- `window.JU` 全局挂载点收拢为**单一装配出口**（343 个契约键集中落位），模块不再零散直写全局。

### 2. 3 万节点基准达标

- `tests/benchmark-30k.spec.ts` 在真实 Chromium + 30,000 节点夹具下通过：
  - 启动到 3 万节点装载 + 首屏大纲渲染：**497.2 ms**（门禁 < 3,000 ms）；
  - 视图切换（大纲 ⇄ 导图）：同步 **12.7 / 14.3 ms**，含首帧 **28.2 / 36.7 ms**（门禁 < 200 ms）；
  - JS 堆占用：**29.0 MB**（总堆 38.6 MB，门禁 < 800 MB）；
  - 页面无未捕获异常，`bootError = null`。

### 3. Worker 化防卡顿

- **字数统计 Worker**：文档节点超过阈值（5,000）时改由 `wordcount.worker.ts` 计算，主线程不再做
  全量子树遍历；小文档仍同步返回，接口语义不变（`JU.docWordCount` / `requestDocWordCountAsync`）。
- **搜索 Worker**：`search.worker.ts` 常驻倒排索引（拉丁词 / CJK 单字 / CJK 双字），输入去抖 40 ms、
  Enter 立即检索；Worker 不可用或超时自动回落同步扫描，结果口径一致。
- 3 万节点下真实键入 5 字符的搜索用例无 > 50 ms LongTask，索引命中来源为 `worker`。

### 4. Tauri 桌面壳接入

- 新增 Rust 端 3 条存储命令并完成注册：
  - `save_state`：先校验 JSON 合法性再写入 `app_data_dir/ju_store.json`；
  - `load_state`：文件缺失返回 `"{}"`（空库语义，不报错）；
  - `patch_nodes`：按 id 覆盖 / 追加 / 剔除后原子写（`ju_store.json.tmp` + `rename`）。
- `cargo build --release` 与 `tauri build`（`targets=["app"]`）均 Exit 0，产出可运行裸 exe；
  前端既有 `desktopInvoke('save_state', …)` 契约无需改动。
- 发布脚本 `scripts/prepare-release.mjs` 自动归档 exe、计算流式 SHA-256、生成
  `JU-v2.1-checksums.txt`，重复执行字节一致。

---

## 二、功能与体验

- 五种视图共享同一份数据：大纲、多维表格、日历、思维导图、幻灯片；视图切换不再复制数据。
- 多维表格行可直接「添加到日历」（行右键菜单），日历「当日待办」即时可见，无需二次录入。
- 全库加密：AES-GCM-256 + PBKDF2-SHA256（600,000 次迭代），密文写入本地，明文主库自动清除；
  刷新后进入解锁界面，密码错误会被拒绝，正确密码解密后数据完整回填。
- 导入 / 导出闭环：JSON 备份导入（结构校验 + 环路检测 + 覆盖前自动备份）、Markdown / HTML /
  OPML / Excel / ICS 导出均使用产品真实下载通道。
- 跨标签同步：BroadcastChannel + localStorage 版本号合并（LWW），3 标签 × 1000 次随机操作后
  内存态与磁盘态投影哈希完全一致。

---

## 三、破坏性变更（Breaking Changes）

| # | 变更 | 影响 | 迁移建议 |
| --- | --- | --- | --- |
| 1 | **全局变量挂载点变更**：由原先散落的 `window.*` 函数 / 变量，统一收拢到 `window.JU.*` | 依赖旧全局名（如直接调用 `sanitizeHtml`、`toMarkdown`、`actions` 等裸全局）的外部脚本 / 插件会失效 | 改用 `window.JU.sanitizeHtml(...)`、`window.JU.toMarkdown(...)`、`window.JU.actions.*`；`window.JU.ui` 为访问器，需以 `typeof JU.ui === 'function' ? JU.ui() : JU.ui` 读取 |
| 2 | **构建形态变更**：交付物由「可手改的单 HTML」变为「构建产物单 HTML」 | 直接编辑 `dist/index.html` 的定制方式不再可行 | 修改 `src/**/*.ts` 后执行 `vite build`；产物仍为单文件，部署方式不变 |
| 3 | **`public/` 默认不进入构建产物** | 依赖 `public/` 静态夹具 / 资源随包分发的构建会缺失文件 | 需要直通拷贝时显式设置 `JU_KEEP_PUBLIC=1` 再构建 |
| 4 | 桌面安装包形态：v2.1 仅提供**裸 exe**（Tauri `targets=["app"]`） | 无 MSI / NSIS 安装向导、无开始菜单快捷方式 | 直接运行 exe；安装包待网络可达后另行构建 |

> 数据兼容性：本地存储键（`juju.store.v31`、`juju.enc.v1` 等）与旧版一致，升级不会清空数据；
> 覆盖安装不删除用户数据目录。

---

## 四、已知问题与限制（Known Issues & Limitations）

1. **多端同步（非多标签）需等云端服务**：当前无多人实时协作、无云端账号体系，跨设备同步
   只能手动导出 / 导入 JSON 备份；已有的「跨标签同步」仅限同一浏览器 / 同一设备
   （BroadcastChannel + localStorage 版本号 LWW），不属于多端同步。
2. **加密设置面板迁移中**：M1 阶段 `bindSettings` 仅回填「匿名错误上报」开关与「本地崩溃日志」
   导出行，完整的设置面板（含 `showSetPasswordDialog`、备份目录选择）仍在后续批次迁入；
   数据层加密、解锁、密文落盘链路已可用并通过端到端验收。
3. **MSI 安装包因网络受限暂未生成**：MSI（WiX）与 NSIS 二进制需从 GitHub Releases 下载构建依赖，
   本机构建网络不可达，故 v2.1 仅交付裸 exe（`dist/release/JU-v2.1-win-x64.exe`）；不影响功能运行，
   待网络可达后按同一版本号补发安装器。
4. **`tauri-plugin-shell` 未引入**：crates.io 无 1.x 版本，2.x 需要 Tauri 2.x；当前以 Tauri v1
   内置 `shell-all` / `fs-all` 能力覆盖，未缺失 shell 能力。
5. **Windows 专属**：v2.1 发布包仅提供 Windows x64；macOS / Linux 未验证。
6. **浏览器直连限制（测试环境）**：本机构建机上浏览器进程到 `localhost` 的入站连接被系统策略阻断，
   自动化测试统一采用「构建产物 + 路由映射」承载；不影响用户正常通过文件 / 桌面壳打开。
7. **崩溃日志导出仅覆盖本机**：桌面端读 `app_data_dir/crash_dumps/`、Web 端读 `window.__juLog`，
   两者都不上传；排查需用户手动导出 `JU-CrashLogs-<日期>.json` 后回传。

---

## 五、构建产物（Build Artifacts · 实测）

| 形态 | 实际路径 | 文件大小 | SHA-256 |
| --- | --- | --- | --- |
| Web 版（单 HTML） | `dist/release/JU-v2.1-Web.html` | 475,206 字节（464.07 KiB ≈ 475.2 KB） | `b24bba7159f5e19d93aa058656d72431774af04d4ac21694baac3bf2dc6b8be5` |
| Windows 版（裸 exe） | `dist/release/JU-v2.1-win-x64.exe` | 7,420,928 字节（7.08 MiB ≈ 7.42 MB） | `c3a5b6f03af445ba075a0ef6506573ebbee016d776b3a01d580c4af19cc96f9a` |

- 校验清单随包发布：`dist/release/JU-v2.1-checksums.txt`（169 字节，两行 sha256，逐字比对；
  清单自身 SHA-256 为 `7cdda135153fb196e9dfe2a730dd30db079e76e236ee3de4a7d9f8ba1733042c`）。
- 中间构建产物：`dist/index.html`（475,206 字节，与 Web 版同字节同哈希）。
- 大小口径：括号内「MB / KB」为十进制（1 MB = 1,000,000 字节），「MiB / KiB」为二进制。
- **产物已与源码同步（必读）**：上表为批次 DJ 执行 `npm run build:all` 后重新构建、重新归档的实测值
  （含批次 CT 的崩溃日志查看与导出 UI `#btnViewCrashLogs` + `read_crash_dumps`）。
  此前草稿中的 `456,197` 字节 / `7d1526…` 与 `7,372,288` 字节 / `214c8a…` 均为旧构建，**已作废**，
  一律以本表为准。
- 死代码扫描报告：`docs/UNUSED-EXPORTS.md`（`node scripts/check-unused-exports.mjs` 生成，仅标记）。

---

## 六、自动化构建（CI / 本地一键发版）

### 1. 云端流水线（GitHub Actions）

仓库内新增 [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)，触发条件为 **push 到 `main`**
或**任意 `pull_request`**，运行环境 `windows-latest`（与桌面壳构建宿主一致）。流水线按序执行：

| # | 步骤 | 命令 |
| --- | --- | --- |
| 1 | 检出代码 | `actions/checkout@v4` |
| 2 | 安装 Node.js | `actions/setup-node@v4`（`node-version: 22.x`，启用 npm 缓存） |
| 3 | 安装依赖 | `npm ci` |
| 4 | 类型检查 | `npx tsc --noEmit` |
| 5 | 契约单元测试 | `node --test test/*.mjs` |
| 6 | 安装浏览器 | `npx playwright install chromium` |
| 7 | E2E 测试 | `npx playwright test` |
| 8 | 构建产物 | `npx vite build` |
| 9 | 上传产物 | `actions/upload-artifact@v4`，产物名 `ju-web-dist`，内容为 `dist/index.html` |

- 任一步骤非 0 退出即整条流水线失败，不会上传产物；`dist/index.html` 缺失时上传步骤同样失败
  （`if-no-files-found: error`）。
- 流水线不需要任何密钥 / Secrets，纯离线门禁；Tauri 桌面 exe 依赖 Rust 工具链与安装器依赖下载，
  由本地一键发版脚本产出，不在 CI 内构建。
- E2E 用例在各自 `beforeAll` 内重建构建产物（见 `playwright.config.ts` 注释），因此可排在
  `vite build` 之前执行，两者互不依赖。

### 2. 本地一键发版（`npm run build:all`）

`scripts/build-all.mjs` 串起发布前的全部门禁与出包动作，任一环节失败立即中止并透传退出码：

```text
tsc --noEmit → node --test test/*.mjs → vite build → tauri build --bundles none → prepare-release.mjs
```

- 各步骤以 `process.execPath` 调用本地 JS 入口（`node_modules/typescript/bin/tsc`、
  `node_modules/vite/bin/vite.js`、`node_modules/@tauri-apps/cli/tauri.js`），不依赖全局 `node`
  是否在 `PATH`，也不经 `.cmd` 包装器；
- 结束后扫描真实文件，打印 `dist/index.html` 与 `dist/release/*` 的**字节数与 SHA-256**，
  用于与 `JU-v2.1-checksums.txt` 逐字核对；
- 只有 `vite build` 与 `tauri build` 同时成功，`prepare-release.mjs` 才会生成完整发布包，
  不会出现「只有 Web、没有 exe」的半套归档。

因此，v2.1 之后的版本可通过 CI 自动完成「类型 + 单测 + E2E + Web 构建」并留档 `dist/index.html`；
桌面裸 exe 与校验清单由本地 `npm run build:all` 一键产出。

---

## 七、质量门禁（本版本实测）

| 门禁 | 命令 | Exit | 结果 |
| --- | --- | --- | --- |
| 类型检查 | `tsc --noEmit` | 0 | 0 错误（含 `tests/**/*.ts` 编译面） |
| 契约测试 | `node --test test/contract.test.mjs test/api-shape.test.mjs` | 0 | 10 pass / 0 fail |
| 3 万节点基准 | `playwright test tests/benchmark-30k.spec.ts` | 0 | 1 passed；启动 497.2 ms / 堆 29.0 MB |
| 3 标签并发 | `playwright test tests/concurrency.spec.ts` | 0 | 1 passed；3000 ops，三标签同哈希 |
| 终极全链路 E2E | `playwright test tests/full-e2e.spec.ts` | 0 | 3 passed（加解密 / 导入导出 / 多视图） |
| 死代码扫描 | `node scripts/check-unused-exports.mjs` | 0 | 41 文件 / 957 导出 / 177 未使用（仅标记，报告见 `docs/UNUSED-EXPORTS.md`） |
| 全量回归 | `node ..\step9\scripts\verify.js all` | 0 | 静态 0 命中 / Node 503 / PW 167 passed / 性能 7-7 |
| 只读对拍 | `node scripts/check-parity.mjs` | 0 | `PARITY OK sha256=5fed0215… bytes=1316707` |

---

## 八、升级方式

1. 关闭正在运行的旧版本（保存当前编辑）。
2. 备份数据：设置 → 备份数据文件夹位置（或导出一份完整 JSON 备份）。
3. 用新版 `JU-v2.1-win-x64.exe` 覆盖旧 exe（或替换 `dist/index.html`）。
4. 首次启动会做数据版本迁移（`STATE_VER=18`），迁移前自动生成备份。
5. 校验发布包完整性：

```powershell
certutil -hashfile .\JU-v2.1-win-x64.exe SHA256
# 与 JU-v2.1-checksums.txt 中的哈希逐字比对
```
