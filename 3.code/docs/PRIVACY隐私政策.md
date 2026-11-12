# JU 隐私政策（Privacy Policy）

> 适用范围：JU（含 Web 版与 Tauri 桌面版）。
> 生效日期：2026-10-24　对应里程碑：M2-7 / M3-5。
> 本文档描述的是**当前发布候选版本的真实实现**，与源码一一对应。

## 1. 核心承诺：本地优先（Local-first）

JU 是一款本地优先应用。你的笔记、节点树、标签、日历、数据库视图、演示稿、图片附件与
界面偏好，**全部保存在你自己的设备上，不上传任何云端服务器**。

具体落盘位置：

| 数据 | 存储位置 |
| --- | --- |
| 文档树 / 节点正文 / 标签 / 回收站 | 浏览器 `localStorage`（键名 `juju.store.*`）与内存态 |
| 附件、缓存、大对象（IndexedDB 通道） | 浏览器 `IndexedDB` |
| 桌面版快照 / 自动备份 / 错误日志 | Tauri 应用数据目录（本机文件，例如 `%APPDATA%\JU\`） |
| 界面状态（当前文档、视图、宽度等） | 浏览器 `localStorage` |

补充说明：

- JU 不使用任何远程数据库、远程文件存储或账号体系；没有“同步到云端”的默认路径。
- 你主动使用“导出”功能时，文件写入你指定的本机位置，由你自行保管与分享。
- 若未来引入本地 SQLite 存储，同样只落在本机应用数据目录，仍不上传云端。
- 加密模式（`ui.encrypted`）下，落盘内容为密文，密钥仅保存在本机。

## 2. 错误上报（默认关闭）

### 2.1 默认状态

错误上报**默认关闭**。判定口径（见 `src/core/errors.ts`）：
仅当 `ui.errorReporting === true` **且**配置了上报端点（`window.__juConfig.errorEndpoint`）时，
才会发起网络请求。缺省（`undefined`）与显式 `false` 均不发送任何数据。

关闭状态下：

- 不发起任何网络请求；
- 本地仍保留一个容量上限为 200 条的环形日志（`window.__juLog`），用于你在「反馈」面板中
  自行导出 / 复制，日志不会自动离开设备；
- 显式设置为 `false` 时按“完全零采集”处理：不脱敏、不去重、不写环形日志、不落桌面日志、不外发。

### 2.2 开启后发送什么

开启后仅发送**结构性指标与脱敏后的错误信息**，字段白名单固定为：

`msg` / `reason` / `stack` / `filename` / `lineno` / `name` / `ids`（最多 5 个节点 ID） /
`count` / `nodeCount` / `view` / `enc` / `ver` / `code`，外加采集上下文 `kind` / `ts` / `ctx`。

**明确排除**（不会进入日志，也不会进入外发体）：

- `ui.currentDocId`（当前文档标识）；
- `state.nodes` 及任何节点的正文、标题、HTML、富文本内容；
- `docId` / `currentDocId` / `nodes` / `text` / `content` 等字段（结构白名单直接丢弃）。

### 2.3 脱敏规则

发送前对 `msg` / `reason` / `stack` 统一执行文本脱敏（`errors.ts` 的 `_redactErrText`）：

| 模式 | 替换为 |
| --- | --- |
| 引号包裹的连续文本（≥4 字符，可能含标题 / 用户输入） | `"<redacted>"` |
| 中国大陆手机号 | `<phone>` |
| 邮箱地址 | `<email>` |
| IPv4 地址 | `<ip>` |

加密模式下 `msg` / `reason` / `stack` / `filename` / `lineno` 一律替换为占位符
（`<enc-message>` / `<enc-stack>` / `<enc-filename>` / `<enc-lineno>`），`ctx` 仅保留
`enc: true` 与版本号，不采集 `view` / `nodeCount`。

### 2.4 何时发送

- 单条即时上报（`navigator.sendBeacon`，`file://` 下回落 `fetch keepalive`）；
- 离线队列补投（`flushPendingErrors`，同样受开关与端点约束）；
- 发送失败不会重试到无限，也不影响本地功能。

## 3. 第三方 SDK 与追踪

JU **不包含任何用户行为追踪 SDK**，包括但不限于：

- Google Analytics / Google Tag Manager / Firebase Analytics；
- 友盟（Umeng）/ 百度统计 / 神策 / GrowingIO / Mixpanel / Amplitude / Sentry SaaS；
- 广告 SDK、推送 SDK、指纹识别或跨站追踪脚本。

依赖情况：

- 运行时零第三方依赖（`dependencies` 为空），仅使用浏览器原生 API；
- `devDependencies`（Vite / TypeScript / Playwright 等）只参与构建与测试，不进入产品包；
- 完整依赖清单见 [`SBOM.json`](./SBOM.json)，许可证审计见 [`LICENSE-AUDIT.md`](./LICENSE-AUDIT.md)。

## 4. 你的权利与控制

- **随时关闭上报**：设置面板 →「允许匿名错误上报」开关（默认关闭），关闭后立即停止外发。
- **查看本地日志**：「反馈」面板可导出 / 复制 `window.__juLog`，自行检查内容。
- **彻底删除数据**：清除站点数据 / 删除 Tauri 应用数据目录即可，服务端无副本（因为不存在服务端）。
- **数据可携带**：通过 JSON / Markdown / HTML 导出功能随时备份与迁移。

## 5. 儿童隐私

JU 不面向儿童定向收集任何信息，也不存在账号注册与画像行为。

## 6. 政策变更

本政策随版本更新。涉及数据外发行为的变更会在发行说明中显著标注，并保持“默认关闭”的基线不被削弱。

## 7. 联系方式

如对隐私实现有疑问，请通过项目仓库的 Issue 反馈；请勿在公开 Issue 中粘贴真实笔记内容。
