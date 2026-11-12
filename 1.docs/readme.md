# JU 归档 · 目录规范

> 重组日期：2026-11-11 · 规格来源 `2.res/tpl/doc/archive-layout-spec.txt`

## 根级白名单（6 业务目录 + 已登记工具入口）

| 目录 | 用途 |
|---|---|
| `0.stage/` | 当前唯一未完成阶段；`_tmp/` 受控临时区（24h 清理）；`_quarantine/` 隔离区（7 天保留待删） |
| `1.docs/` | 公共文档（readme/version.json/acceptance.md 等），全程使用不随阶段归档 |
| `2.res/` | 共享资源（design/assets/data/tpl/docs） |
| `3.code/` | 应用代码（src/src-tauri/tests/scripts/server/gates/canonical/docs/public） |
| `4.cfg/` | 工具配置（ci/editor/lint/notes/scripts/tools） |
| `99.hist/` | 历史归档（`0.index.md` + `1.init`~`9.ops` + `99.trash`，只读） |

## 已登记工具入口（根级例外）

- `.git/` `.gitignore` `.github/` — 版本库与 CI 平台强制路径
- `.clinerules` `.roo/` — AI 工具自动加载规则（Claude/Roo），须根级生效，登记为例外

## 单一真相源

| 概念 | 唯一位置 |
|---|---|
| 现行基线 | `1.docs/version.json`（canonical 字节/哈希，由脚本生成） |
| 历史封存锚 | `99.hist/6.dev/sealed-head.json`（旧 `HEAD.json`，非现行） |
| 现行验收结论 | `1.docs/acceptance.md` |
| 现行回归账 | `1.docs/acceptance-matrix.md` |
| 现行交付指针 | `99.hist/8.rel/CURRENT.json` |

## 规则

1. 根目录只允许 6 业务目录 + 已登记工具入口；不得出现中文目录名、`01_`/`NN_` 编号。
2. 库内文件路径深度 ≤ 4 层，超出须加索引或扁平化。
3. 构建产物 / `node_modules` / `target` / 临时沙箱不入库（`_quarantine/` 隔离 7 天后删除）。
4. 私钥永久仓库外；`*.pem/*.key/*.p12/*.pfx` 硬排除。
5. 文档只引用生成的计数（`METRICS.json` / `version.json`），禁止手写数字。
