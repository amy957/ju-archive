# 归档重组 · 干跑报告（零字节移动）

- 生成时间：2026-11-11 14:0x +08:00
- 规格来源：`E:\APP\归档\归档目录.txt`（75 行，13:39 写入）
- 审计基线：`归档审计报告-2026-11-10.html`（25 项发现）
- 覆盖范围：**30,402 个文件 / 8,203.0 MB**（不含 `.git/`）
- 状态：**仅生成映射与报告，未移动、未改名、未删除任何归档内文件**

---

## 0. 一句话结论

按规格重组后，归档从 **13 个中文一级目录 / 8.2 GB / 最大深度 6 层**
收敛为 **6 个规格目录 / 1.37 GB 在库 + 6.79 GB 移出隔离区 / 最大深度 4 层**，
并在结构上**物理消灭**三处冲突（版本真相源、发布验收、回归证据），
同时给出代码与安全的 11 项整改落点。

---

## 1. 体积账（实测，非估算）

| 目标层 | 文件数 | 体积 | 动作 |
|---|---:|---:|---|
| `99.hist/`（历史归档） | 6,775 | 1,138.6 MB | MOVE 6,763 + RENAME 12 |
| `2.res/`（共享资源） | 149 | 254.5 MB | MOVE |
| `3.code/`（应用代码） | 330 | 13.1 MB | MOVE 329 + RENAME 1 |
| `4.cfg/`（工具配置） | 51 | 0.8 MB | MOVE |
| `1.docs/`（公共文档） | 5 | 0.7 MB | RENAME |
| `0.stage/`（当前阶段） | 1 | 0.4 MB | MOVE |
| 根级工具入口 | 2 | 0.0 MB | KEEP（`.gitignore`、`ci-gate.yml`） |
| **移出归档（隔离区）** | **23,087** | **6,794.9 MB** | QUARANTINE |
| **合计** | **30,402** | **8,203.0 MB** | — |

> **在库体积：1,408.5 MB（7,315 文件）→ 比现状减少 82.8%。**
> 移出部分全部是**可再生件或低证据价值副本**，见 §5。

### 拆解：6,795 MB 移出清单

| 内容 | 文件数 | 体积 | 判定 |
|---|---:|---:|---|
| `src-tauri/target/`（debug 2.77 GB + release 1.78 GB） | 9,697 | 4,544.4 MB | 可再生（build-all 重建） |
| `90过程材料/tmp/`（sandbox 副本 + prev-release 回滚 + EBWebView profile） | 2,586 | ~1,617 MB | 已留 453 份回执在库 |
| `99.开发辅助工具/PortableGit + node.exe` | 9,541 | 475.1 MB | 只读工具，按版本号登记 |
| `m07-vite/node_modules` + `step9/node_modules` | 1,196 | 134.2 MB | `npm ci` 可再生 |
| `dist/`、`test-results/`、`playwright-report/` | 67 | 23.5 MB | 运行产物 |

---

## 2. 目标结构与规格映射（含我对规格的补全）

```
ProjectRoot/
├── 0.stage/                 当前阶段（唯一未完成阶段）
│   ├── _tmp/                受控临时区（24h 清理，不归档）
│   └── 6.rel/               ★ 本阶段：发布定性与健康收口
│       ├── desc.md          目标/范围/输入/交付物/评审/归档日期
│       ├── 1.in/            现行基线、验收记录、审计发现
│       ├── 2.proc/          迁移过程记录
│       ├── 3.out/           CURRENT.json、acceptance.md、迁移报告
│       ├── 4.rev/           发布状态决定（RELEASE-HOLD / SUPERSEDING）
│       └── 5.issue/         OPEN-ISSUES 与 13 项实机欠账
├── 1.docs/                  公共文档（全程使用，不随阶段归档）
│   ├── readme.md            项目说明 + 目录规范 + 工具例外白名单  ← 新建
│   ├── arch.md              架构总览                            ← 新建
│   ├── api.md               API 文档                            ← 新建
│   ├── ops.md               部署与运维                          ← 新建
│   ├── changelog.md         公共文档变更记录                    ← 新建
│   ├── version.json         ★ 现行版本唯一真相源                ← 新建
│   ├── acceptance.md        ★ 现行验收结论唯一入口              ← 新建
│   ├── acceptance-matrix.md 现行回归矩阵（原 4.回归与验收/…）
│   ├── invariants.md        不变量清单（原 4.回归与验收/…）
│   ├── maintenance.md       维护手册（原 0.规范/MAINTENANCE.md，待拆分）
│   ├── release.md           发布链说明（原 8.发布与CI/README.md）
│   └── benchmark-roadmap.md 产品路线（原 0.规范/…修正版）
├── 2.res/                   共享资源
│   ├── design.md            设计规范                            ← 新建
│   ├── assets/img/uw-screenshots/   4 张 UI 实机截图
│   ├── data/bench/          现行性能基线（16 文件 / 113.7 MB）
│   ├── data/bench-old/      旧批次夹具（140 MB）
│   ├── docs/archive/        旧版路线图
│   └── tpl/{doc,rev,rel}/   文档/评审/发布模板（含规格原文）
├── 3.code/                  应用代码
│   ├── src/                 55 个 TS 文件 / 31,183 行
│   ├── src-tauri/           Rust 工程（已剔除 target/）
│   ├── tests/               87 个 spec + 5 个 Node 单测
│   ├── cfg/                 环境配置模板
│   ├── scripts/             build-all / 9 项 gate / parity
│   ├── gates/               step9 门禁工程（verify.js、登记器、t9）
│   ├── canonical/           v2.0-t3.html（1,316,707 B / 5FED0215…）
│   ├── docs/                代码级文档 + OPEN-ISSUES.md
│   ├── public/              静态资源
│   └── server/              license mock 服务（安全整改对象）
├── 4.cfg/                   工具配置（不放业务/密钥/日志/产物）
│   ├── ci/                  ci-gate 副本、env 注入模板、m07-ci
│   ├── editor/              clinerules、roo
│   ├── lint/                检查规则                            ← 新建
│   ├── notes/               工具版本与迁移说明                  ← 新建
│   ├── scripts/             一次性脚本（原 90过程材料/_临时脚本）
│   └── tools/               开发辅助脚本 + 迁移脚本
├── 99.hist/                 历史归档（固定标准阶段）
│   ├── 0.index.md           归档索引（原 ARCHIVE-INDEX.md，需更新）
│   ├── 1.init/              立项与可行性（6 份评估报告 + docx）
│   ├── 2.req/               需求调研（细节要求描述文档.docx）
│   ├── 3.ux/                产品原型与交互（空，待归档）
│   ├── 4.arch/              架构设计与技术选型（设计框架规范.docx）
│   ├── 5.ui/                UI 视觉与设计规范（UI 交互增强 5 件）
│   ├── 6.dev/               ★ 开发实现（冻结 37 件 + 门禁副本 + sealed-head.json）
│   ├── 7.test/              测试与缺陷修复（快照 550 + ledger 12 + 旧报告）
│   ├── 8.rel/               ★ 发布上线与验收
│   │   ├── v2.1.0-2026-11-10/   ← 唯一现行交付（latest）
│   │   ├── legacy/             14 个历史版本包
│   │   └── reports/            发布链报告
│   ├── 9.ops/               运维交接与复盘（日志 598 + 批次回执 453 + 审计）
│   └── 99.trash/            废弃与临时（根级杂物 4 件 + 封存残余）
└── [Tool-Enforced]          .git/  .gitignore  .github/workflows/ci-gate.yml
```

### 对规格的三处补全（请确认）

| 规格原文 | 未覆盖内容 | 我的处理 |
|---|---|---|
| `n.task/` 子层只写了 `1.in`~`5.issue` | 迁移前的脚本与中间件无家 | 全部进 `0.stage/_tmp/`，迁移完成后清空 |
| `99.hist/2.req`~`9.ops` 只给了名字 | 子层沿用 `1.init` 的 6 件套 | 全部按 `desc.md + 1.in~5.issue` 落位 |
| 规则 9「不得出现 `01_`/`00_` 形式编号」 | 与骨架 `0.stage/`、`99.hist/` 自相矛盾 | 按**骨架优先**：根级 6 个编号保留；`99.hist/` 内部用 `1.init`~`9.ops` 语义名 |

---

## 3. 三处冲突：物理隔离方案

### 3.1 版本真相源 —— 从「3 个数字」到「1 个文件 + 1 个冻结锚」

**现状冲突**

| 文件 | 声称的「现行」 | 与磁盘差 |
|---|---|---|
| `1.历史归档/1.1冻结版本/HEAD.json` | 1,212,364 B / `FE04CC1A…` | −104,343 B |
| `4.回归与验收/CURRENT-REGRESSION-MATRIX.md` | 1,174,919 B / `0B4AA2A6…` | −141,788 B |
| `8.发布与CI/README.md` + 磁盘 | 1,316,707 B / `5FED0215…` | 0（现势） |

这三份文件**都自称为「唯一真相源」**（`.roo/rules/00-rules.md` L11、`00-rules` L35、MATRIX L5、MAINTENANCE L5/L74 共 5 处引用 HEAD.json）。审计 P0-3 已判其失败。

**重组后**

| 角色 | 新位置 | 内容 |
|---|---|---|
| **现行基线（机器读）** | `1.docs/version.json` | `{version, canonical{path,bytes,sha256,eol}, sealedHead{…}, release{…}, updatedAt}`，**由脚本生成，禁止手写** |
| **历史封存锚（只读）** | `99.hist/6.dev/sealed-head.json` | 原 `HEAD.json` 改名 + 顶部加注「非现行，仅历史锚」 |
| 人读基线说明 | `1.docs/readme.md` §基线 | 只引用 `version.json`，不写死数字 |
| 冻结件 | `99.hist/6.dev/frozen/`（37 件，字节零改动） | 只读历史锚 |

> 关键动作：**改名 `HEAD.json → sealed-head.json`**。这一步让「唯一真相源」的歧义在文件系统层面消失——文件名不再暗示「HEAD」。

### 3.2 发布验收 —— 从「互斥三结论」到「一条链 + 一个开关」

**现状冲突**

- `…/_报告与元数据/ACCEPTANCE-REPORT.md`：r4 **NOT ACCEPTED / DO-NOT-SHIP**，解禁须具名 superseding；
- `8.发布与CI/release/v2.1.0-2026-11-09/release-manifest.json`：`"parity":"PASS"` + ISSUE-114「发布阻塞=是」；
- `3.评估报告/` 6 份评估报告、`4.回归与验收/` 16 份验收记录**各自为政**，无一份是「当前结论」。

**重组后**

```
0.stage/6.rel/4.rev/            ← 新结论只允许产生在这里（具名、带日期）
        ↓ 审签后
1.docs/acceptance.md            ← 唯一对外的「当前验收结论」入口
        ↑ 引用
1.docs/acceptance-matrix.md     ← 回归矩阵（ISSUE 状态）
99.hist/7.test/                 ← 历史验收记录（含被取代的 ACCEPTANCE-REPORT）
99.hist/8.rel/v2.1.0-2026-11-10/← 唯一现行交付包（含 manifest + checksums）
```

**ACCEPTANCE-REPORT.md 的处置**：不删除、不改字节，移入 `99.hist/7.test/legacy-acceptance/`；另在 `1.docs/acceptance.md` 写明「r4 否决状态：未撤销 / 已撤销（待定）」，**两种状态只允许出现在这一个文件**。

### 3.3 回归证据 —— 从「4 处散落 + 55 个未登记 spec」到「一账一据」

**现状**

- 回归矩阵在 `4.回归与验收/`，验收报告在 `1.3封存/…/_报告与元数据/`，发布链报告在 `8.发布与CI/reports/`，批次日志在 `2.项目日志/`（598 个平铺文件）；
- 4 对字节完全相同的 L/T 前缀重复件；
- `tests/` 87 个 spec 只有 32 个进门禁（审计 P1-1）。

**重组后**

| 证据类型 | 唯一位置 | 现状散落点 |
|---|---|---|
| 现行回归账 | `1.docs/acceptance-matrix.md` | `4.回归与验收/` |
| 历史回归清单/映射 | `99.hist/7.test/ledger/`（12 件，L/T 重复件保留并标 `ALIAS`） | `4.回归与验收/` |
| 波次快照 | `99.hist/7.test/snapshots/`（550 件） | `1.2归档快照/` |
| 批次原始日志 | `99.hist/9.ops/logs/evidence/`（598 件） | `2.项目日志/` |
| 批次回执 | `99.hist/9.ops/batches/`（453 件，只留回执，删沙箱） | `90过程材料/tmp/*` |
| 门禁脚本与用例 | `3.code/gates/` | `6.P0-T3基线/step9/` |
| 发布链报告 | `99.hist/8.rel/reports/` | `8.发布与CI/reports/` |

---

## 4. 层级深度：6 层 → 4 层

| 现状示例 | 深度 | 重组后 | 深度 |
|---|---:|---|---:|
| `1.历史归档\1.3封存\过程材料\90_旧日志与报告\_报告与元数据\ACCEPTANCE-REPORT.md` | **6** | `99.hist/7.test/legacy-acceptance/ACCEPTANCE-REPORT.md` | 4 |
| `90过程材料\tmp\review10-11\sandbox\8.发布与CI\release\v2.1.0-2026-11-03\RELEASE-NOTES.md` | **7** | 隔离区（不入库） | — |
| `6.P0-T3基线\m07-vite\src-tauri\target\release\…` | 5 | `3.code/src-tauri/…`（target 移出） | 3 |
| `8.发布与CI\release\v2.1.0-2026-11-10.prev-…\…` | 4 | `99.hist/8.rel/legacy/…` | 4 |

**深度规则（写进 `1.docs/readme.md`）**：库内任何文件路径 ≤ 4 层；超过 4 层视为设计缺陷，必须加索引文件或扁平化。

---

## 5. 代码与安全：11 项整改的落点

| # | 问题（审计编号） | 新落点 | 动作 |
|---|---|---|---|
| 1 | 授权签发私钥缺失、`scripts/keys/` 为空（P2-1） | `3.code/scripts/keys/`（保持空） | 私钥**永久仓库外**；`.gitignore` 硬排除 `*.pem/*.key/*.p12/*.pfx`；`gen-license` 越界拒绝保持 |
| 2 | license mock 服务 CORS `*`、无鉴权（P2-1） | `3.code/server/license-server.mjs` | 加 `JU_LICENSE_ALLOW_ORIGIN` 白名单；启动横幅标「本地演示专用」 |
| 3 | 105 处 `innerHTML` 仅 49 处 sanitize（P2-2） | `3.code/src/**` | 新增 `3.code/src/safety/setSafeHtml.ts` 统一入口 + ESLint 禁直接赋值 |
| 4 | `withGlobalTauri: true` 放大注入面（P2-2） | `3.code/src-tauri/tauri.conf.json` | 关闭或写风险接受（`4.cfg/notes/risk-accept.md`） |
| 5 | 17 处 `console.log` + 6 处 `PASTE-DBG`（P2-3） | `3.code/src/**` | 移除或条件编译；`noUnusedLocals/noUnusedParameters` 打开 |
| 6 | 213 个未使用导出（P2-3） | `3.code/src/**` | 逐项裁决「接线/删除」，`check-unused-exports` 收紧 |
| 7 | Rust MSRV 1.60 却用 1.63 API（P2-4） | `3.code/src-tauri/Cargo.toml` | `rust-version = "1.63"`，清 3 处 clippy |
| 8 | 代码门禁贴顶阈值（P2-5） | `3.code/gates/scripts/check-inline-style.mjs` | 改「基线 + 下降目标」 |
| 9 | 50 个未登记 spec 从不运行（P1-1） | `3.code/tests/` + `gate-manifest.json` | 87 个 spec 分诊：登记 / 豁免 / `_attic` |
| 10 | 两份 CI 定义漂移（P2-7） | `.github/workflows/ci-gate.yml` + `4.cfg/ci/` | 单一真相：根级为唯一，副本改指针 |
| 11 | 根目录杂物违反自订规则（P3-1） | `99.hist/99.trash/root-junk/` | 4 件全部移出根级 |

**新增：`3.code/scripts/check-security.mjs`**（进 build-all 门禁），规则：
1. `src/` 内禁止 `.innerHTML =` 直接赋值（白名单除外）；
2. `scripts/keys/` 非空即失败；
3. 禁止 `Access-Control-Allow-Origin: *`；
4. 禁止 `withGlobalTauri: true`（除非存在签字的 `risk-accept.md`）；
5. 禁止 `console.log` / `PASTE-DBG` 进入 `src/`。

---

## 6. 依赖改写清单（迁移后必须同步，否则门禁全红）

**共 63 个文件含旧路径**（53 代码/配置 + 10 文档）。主要映射：

| 旧路径 | 新路径 | 出现处 |
|---|---|---|
| `6.P0-T3基线/v2.0-t3.html` | `3.code/canonical/v2.0-t3.html` | `verify-hash-registry.mjs`、`verify.js`、`build-all.mjs`、`check-parity.mjs`、53 个文件注释 |
| `6.P0-T3基线/step9/v2.0-t3.html` | **消失**（并入 canonical，门禁改读同一路径） | `verify.js` L409 |
| `6.P0-T3基线/m07-vite/` | `3.code/` | `build-all.mjs`、`package.json`、CI yml |
| `8.发布与CI/release/` | `99.hist/8.rel/` | `build-all.mjs`、`check-release-parity.mjs` |
| `8.发布与CI/reports/` | `99.hist/8.rel/reports/` | `check-manifest.mjs` |
| `2.项目日志/` | `99.hist/9.ops/logs/evidence/` | 文档 7 处 |
| `1.冻结版本/HEAD.json` | `99.hist/6.dev/sealed-head.json` | 45 处文档引用 |
| `1.归档快照/` | `99.hist/7.test/snapshots/` | 20+ 处文档引用 |

> **建议**：新增 `3.code/scripts/paths.mjs` 作为**唯一路径解析点**，所有脚本从这里取路径常量，禁止再写死目录名。迁移后一次性改完，后续再搬迁只改 1 个文件。

---

## 7. 执行顺序与回滚

### 执行顺序（每步后 `git status` 检查，每步可单独回滚）

| 步 | 动作 | 预计 |
|---|---|---|
| 1 | 冻结现场：`git add -A && git commit`（检查点 `pre-reorg`） | 2 min |
| 2 | 建 6 个空骨架目录 + `.gitignore` 重写 | 1 min |
| 3 | 根级杂物 → `99.hist/99.trash/root-junk/` | 1 min |
| 4 | 代码迁移：`6.P0-T3基线/` → `3.code/` + `target/` 移出 | 3 min |
| 5 | 文档迁移：`0.规范/ 3.评估报告/ 4.回归与验收/ 5.性能基线/` | 2 min |
| 6 | 历史迁移：`1.历史归档/` → `99.hist/` | 3 min |
| 7 | 发布迁移：`8.发布与CI/` → `99.hist/8.rel/` + `4.cfg/ci/` | 1 min |
| 8 | 过程材料：回执入库、沙箱移出 | 3 min |
| 9 | 工具链：`99.开发辅助工具/` → 隔离区 | 2 min |
| 10 | 路径改写：`paths.mjs` + 63 个文件 | 20 min |
| 11 | 生成 `version.json` / `acceptance.md` / `0.index.md` / `readme.md` | 15 min |
| 12 | 复跑门禁：`verify-hash-registry` + `verify.js all` + 7 项 build gate | 15 min |
| 13 | 复查点 commit（`post-reorg`） | 2 min |

### 回滚

- 全量回滚：`git reset --hard pre-reorg`（若步 1 已提交）+ 隔离区原路移回；
- 分步回滚：每步单独 commit，`git revert <step-commit>`；
- **隔离区不删除任何文件**（只是移出目录），回滚后可用映射表 CSV 反向搬回。

---

## 8. 风险与红线

| 风险 | 等级 | 控制 |
|---|---|---|
| 冻结件字节被改写 | 高 | 37 件仅 `Move-Item`，不读写内容；迁移前后逐件 SHA-256 比对 |
| 门禁路径断裂 | 高 | 步 12 全量复跑；未全绿视为迁移未完成 |
| `.git` 索引 17,001 项未收口 | 高 | 步 1 先做检查点；步 13 再提交，中间可随时回退 |
| 移出 6.79 GB 后误删 | 中 | 隔离区保留 7 天；先出 `QUARANTINE-MANIFEST.csv`（含哈希）再允许清空 |
| 中文目录名残留 | 低 | 新结构全 ASCII（`99.hist/8.rel/legacy/` 内历史文件名保留中文，属历史件） |

---

## 9. 待你确认的 6 个决策点

| # | 决策 | 默认建议 |
|---|---|---|
| D1 | `8.发布与CI/release/` 归 `99.hist/8.rel/`（发布属历史阶段）而非 `0.stage/3.out/` | 建议 99.hist |
| D2 | 现行交付 `v2.1.0-2026-11-10` 是否同时在 `0.stage/6.rel/1.in/` 放一份指针 | 仅放 `latest.txt` 指针，不复制产物 |
| D3 | 14 个历史发布包保留完整件还是只留 `checksums + manifest + notes`（约省 380 MB） | 建议只留元数据 |
| D4 | `90过程材料/tmp` 的 453 份回执是否全部入库（约 0.8 MB） | 建议全部入库 |
| D5 | `2.res/data/bench-old`（140 MB 旧夹具）是否留库 | 建议移出隔离区 |
| D6 | `.clinerules` / `.roo` 移入 `4.cfg/editor/` 后，AI 工具是否还能自动加载 | 需实测；若不能，保留为根级登记例外 |

---

## 10. 交付物

| 文件 | 说明 |
|---|---|
| `1.docs/migration/mapping.csv` | 30,402 行逐文件映射（Old → New · Action · Reason · Flag），零 UNMAPPED、零目标冲突 |
| `1.docs/migration/MAP-REPORT.md` | 本报告（自 `0.stage/_tmp/` 提升） |
| `map.mjs` | 规则引擎（可复跑，幂等） |
| `summ.mjs` | 统计脚本（体积/文件数/关键条目） |

> 审计自查：`rows=30402`、`UNMAPPED=0`、`new-path collisions=0`、`IN-ARCHIVE=1408.5 MB`、`EXTERNAL=6794.9 MB`。


