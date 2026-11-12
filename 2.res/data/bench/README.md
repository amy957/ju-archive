# 性能基线套件 · 运行入口（ISSUE-009）

本目录是 JU 工作台的性能基线套件：Playwright 配置 [`playwright.config.ts`](./playwright.config.ts:1)、用例 [`tests/`](./tests)、夹具生成器 [`tools/gen-bench.js`](./tools/gen-bench.js:1)、对拍基准 [`bench-p0-baseline.json`](./bench-p0-baseline.json:1)。

此前该目录**无 `package.json`、无 README、无 npm script**（ISSUE-009：有配置无入口），全项目只有 `6.P0-T3基线/step9/package.json` 一个依赖入口。本文件与 [`package.json`](./package.json:1) 只补齐运行入口，**不新增或改写任何基准数值**。

## 1. 依赖安装（二选一）

依赖版本与 `6.P0-T3基线/step9/package.json` 完全一致（`@playwright/test@1.64.0`、`@types/node@26.6.5`，Node ≥ 22）。

**方案 A · 复用 step9 依赖（推荐，不产生第二份 node_modules）**

```bat
cd /d "e:\APP\归档\6.P0-T3基线\step9"
npm ci
set PLAYWRIGHT_BIN=e:\APP\归档\6.P0-T3基线\step9\node_modules\.bin
set PATH=%PLAYWRIGHT_BIN%;%PATH%
```

**方案 B · 在 5.性能基线 内独立安装**

```bat
cd /d "e:\APP\归档\5.性能基线"
npm install --no-save
```

> `node_modules/`、`test-results/`、`playwright-report/`、`5.性能基线/fixtures/` 已在根 [`.gitignore`](../.gitignore:8) 中忽略，不会进入版本控制。

## 2. 环境变量

| 变量 | 作用 | 缺省 |
|---|---|---|
| `JU_CHROMIUM_PATH` | 指定 Chrome/Chromium 可执行文件（跨机器可移植） | Win32 `C:\Program Files\Chromium\chrome.exe` → `/usr/local/bin/chromium` → Playwright 自带浏览器 |
| `JU_URL` | 被测页面地址 | `http://localhost:8080/v2.0-frozen.html`（`tests/bench-*.spec.ts`） |
| `JU_BENCH_STATE` | 注入用纯 state JSON | `tests/../ju-bench-20k.state.json`（`bench-p0-baseline`）/ `ju-bench-30k.state.json`（`bench-smoke`） |
| `JU_BENCH_OUT` | 基准结果输出路径 | `bench-p0-baseline.json` |

Chromium 解析顺序见 [`playwright.config.ts`](./playwright.config.ts:9) 顶部注释。

## 3. 运行命令

```bat
cd /d "e:\APP\归档\5.性能基线"

npm run bench:fixtures        :: 生成 20k 节点夹具（ju-bench-20k*.json / .load.js）
npm run bench                 :: 运行全部性能基线用例
npm run bench:p0              :: 仅 P0 基线对拍（输出 bench-p0-baseline.json）
npm run bench:smoke           :: 仅大库冒烟（启动 / 切换 / 搜索）
npm run bench:ui              :: 仅 v2.1-dev UI 交互基线
npm run bench:fixtures:30k    :: 生成 30k 节点夹具
```

被测页面若由本地静态服务器提供，先启动服务器并把 `JU_URL` 指向实际地址；亦可使用 `file:///` 指向 `6.P0-T3基线/v2.0-t3.html`。

## 4. 判读口径（重要，勿把「跑通」当「未退化」）

- `bench-p0-baseline.json` 中 `metrics` 仍是 **v2.0-frozen 世代**采样（产品体量已从 775 KB 增至 1,174,919 B），CURRENT-REGRESSION-MATRIX 将其登记为 `PENDING`（ISSUE-021）。**在该基准按现行 canonical 重测回填之前，与它的对拍结论不具判别力**。
- `6.P0-T3基线/step9` 的 `verify.js bench` 7/7 只表示用例执行成功，不等价于「性能未退化」；阈值与断言语义未因本入口文件的加入而调整。
- 性能类结论必须先出证据（原始输出 + 统计口径），不得先改阈值。
- 在无 `node` 运行时或未安装 Playwright 的环境里，本目录命令**不可执行**；此时应记录「未执行」，不得以历史数值充当本轮结果。

## 5. 与 step9 的分工

| 目录 | 职责 |
|---|---|
| `6.P0-T3基线/step9/` | 主门禁：`verify.js` 的 node / pw / bench / lint / all，登记器 `verify-hash-registry.mjs` |
| `5.性能基线/`（本目录） | 性能基线的夹具生成与独立复跑入口，供人工对拍与重测回填 |
