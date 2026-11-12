# S4 · 发布包冻结报告（正式发布包 · 2026-10-16）

> **性质**：**发布产物 / 文档产出**（发布链 S4）。**不改产品代码字节**、**不覆盖任何冻结件**、**不重复归档**（铁律 4）。
> **依据**：[`Project-Closure-2026-10-15.md`](../../6.P0-L3基线/step9/reports/Project-Closure-2026-10-15.md:236) §6.3 **S4**（发布包冻结：以 L12 冻结件为发布基线；补 `git tag`）；
> 前置 **S3**（[`s3-outofrepo-closure-2026-10-16.md`](s3-outofrepo-closure-2026-10-16.md:1)）；
> 承 **S1**（[`s1-op12-closure-2026-10-16.md`](s1-op12-closure-2026-10-16.md:1)）/ **S2**（[`s2-ci-gate-2026-10-16.md`](s2-ci-gate-2026-10-16.md:1)）。
> **被守护对象（canonical）**：[`6.P0-L3基线\v2.0-l3.html.html`](../../6.P0-L3基线/v2.0-l3.html.html:1) = **983,460 B / LF / `CFCD67DA…FC34`**（= step9 镜像 = L12 冻结件）。

---

## 一、发布标识与基线

| 项 | 值 |
|---|---|
| **发布标识（release id）** | `v2.0-l12-2026-10-16` |
| **发布基线** | L12 冻结件 [`v2.0-l3-frozen-l12-2026-10-15.html`](../../1.冻结版本/v2.0-l3-frozen-l12-2026-10-15.html:1) |
| **发布包目录** | [`8.发布与CI\release\v2.0-l12-2026-10-16\`](../release/v2.0-l12-2026-10-16/RELEASE-NOTES.md) |
| **产品定值** | **983,460 B / LF / `CFCD67DA388508CEC62EEB723408703C62E210EA7968B872BD34123170FCFC34`** |
| **三方一致** | canonical = step9 镜像 = L12 冻结件：**`THREE_PARTY_IDENTICAL=true`** |

---

## 二、发布包构成（逐件 字节 + SHA-256）

发布包 [`8.发布与CI\release\v2.0-l12-2026-10-16\`](../release/v2.0-l12-2026-10-16/RELEASE-NOTES.md) **4 件 / 988,564 字节**：

| # | 文件 | 字节 | EOL | SHA-256 | 作用 |
|---|---|---|---|---|---|
| 1 | [`ju-workbench-v2.0-l12.html`](../release/v2.0-l12-2026-10-16/ju-workbench-v2.0-l12.html) | **983,460** | LF | `CFCD67DA388508CEC62EEB723408703C62E210EA7968B872BD34123170FCFC34` | **发布产物**（= canonical 逐字节副本） |
| 2 | [`release-manifest.json`](../release/v2.0-l12-2026-10-16/release-manifest.json) | 2,659 | LF | `EC27377BB8E3D7CDE35BBE676512682AF88F3C2DE237EF478CDDA7959D479D2C` | 机器可读清单（发布内容逐件 + 引用门禁件） |
| 3 | [`checksums.sha256`](../release/v2.0-l12-2026-10-16/checksums.sha256) | 315 | LF | `4614AFB7EB8C0A99EB00D023BFD2991205B0F3145F4CC8C7E1F10F53C87897FC` | 校验清单（全包逐件，排除自身） |
| 4 | [`RELEASE-NOTES.md`](../release/v2.0-l12-2026-10-16/RELEASE-NOTES.md) | 2,130 | LF | `2BBAF6B82832E598BBF313AA105B8AB1532E48A672B8C814768F43850F3A7CC6` | 发布说明 |

> **逐件哈希来源**：Node 只读采集（`_s4tmp\_s4release.mjs`）；证据 [`_s4-release-evidence-2026-10-16.txt`](_s4-release-evidence-2026-10-16.txt:1)。
> **`release-manifest.json` 不登记自身哈希**（避免自指）；**`checksums.sha256` 排除自身**，覆盖其余 3 件。

### 2.1 引用门禁件（发布基线来源 · 全部只读）

| 角色 | 路径 | 字节 | EOL | SHA-256 |
|---|---|---|---|---|
| canonical | `6.P0-L3基线/v2.0-l3.html.html` | 983,460 | LF | `CFCD67DA…FC34` |
| step9 镜像 | `6.P0-L3基线/step9/v2.0-l3.html.html` | 983,460 | LF | `CFCD67DA…FC34` |
| frozen-l12 | `1.冻结版本/v2.0-l3-frozen-l12-2026-10-15.html` | 983,460 | LF | `CFCD67DA…FC34` |
| verify-js | `6.P0-L3基线/step9/scripts/verify.js` | 7,876 | LF | `4E2DC206…1FCB` |
| registrar-36 | `6.P0-L3基线/step9/l9/l9-hash-check.mjs` | 9,758 | CRLF | `E2E4B31C…2289` |
| freeze-gate | `6.P0-L3基线/step9/scripts/_w5freeze.ps1` | 19,071 | CRLF | `5D55C2C9…168E` |

---

## 三、发布门禁（承路径 B S2 · 本地等价）

发布包冻结后，其发布产物须与冻结件**逐字节一致**；门禁口径与 S2 一致：

| 段 | 命令 | 通过判据 | 性质 |
|---|---|---|---|
| ① 登记器 | `node l9/l9-hash-check.mjs` | `PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS` | 只读 |
| ② 全量回归 | `node scripts/verify.js all` | `[verify] 全部通过`（EXIT=0） | 只读 |
| ③ 冻结门 | `powershell -File scripts/_w5freeze.ps1 -Wave l12 -NoFreeze` | `FROZEN_DRIFT_COUNT=0` / `BYTE_IDENTICAL=True` / `RESULT=PASS` | **只读（-NoFreeze）** |

> 复跑结论见 **S5**（[`s4s5-closure-2026-10-16.md`](s4s5-closure-2026-10-16.md:1)）。

---

## 四、`git tag` 与差异记录（诚实登记）

| 项 | 说明 |
|---|---|
| **无 git** | 本仓**无 git**（[`Project-Closure §5`](../../6.P0-L3基线/step9/reports/Project-Closure-2026-10-15.md:194) item 5）→ **无法就地执行 `git tag`**。 |
| **替代物** | 以**发布标识** `v2.0-l12-2026-10-16` + **发布清单**（`release-manifest.json`）+ **校验清单**（`checksums.sha256`）作为**可移植 tag 等价物**；置于具备 git 的环境后可据发布标识补 `git tag v2.0-l12`。 |
| **可移植件** | 发布包为**自包含只读交付物**，不依赖 git 即可校验（`checksums.sha256`）。 |

### 4.1 对路径 A（E-3）字节依赖的影响（必然记录）

- **差异 = 无**。S4 仅**新增发布包副本**（`8.发布与CI\release\`）与报告，**canonical 逐字节未变**（`983,460 / CFCD67DA…FC34 / LF`）。
- 因此路径 A（E-3 / `M-B` / #33）的**字节依赖基线未发生变化**：其前置「`N(id)` 调用点台账 + 同步→异步等价接缝 + 强制降级开关」仍以**同一 canonical** 为靶。
- **发布包不参与路径 A 的改写面**：发布产物为**只读发布副本**，非工作树；路径 A 若启动，改写对象仍为 `6.P0-L3基线\v2.0-l3.html.html`（须遵守铁律 4：改后 `Copy-Item` 同步镜像 + 重算哈希）。

---

## 五、残余声明（诚实登记）

1. **发布包为副本集合**：仅含**单一发布产物**（canonical 副本）+ 清单，**不重复归档** `1.归档快照\L4-L12-2026-10-15\`（13 件 / 7,627,345 字节 **未触碰**）。
2. **不覆盖冻结件**：`1.冻结版本\*` 全部**只读**；本次未写入任何冻结件。
3. **无真机产物**：真机后端（Rust/Tauri K-1）属**仓外**（承 S3），本发布包为**前端产品 HTML** 的正式发布。
4. **结转 OPEN 项不受影响**：`OP-2` / `OP-3` / `OP-4`（独立项）+ `OP-14`（Ctrl+F 替代）；**已关闭**：`OP-1`（S3）/ `OP-12`（S1）。

---

## 六、结论

- **S4 → 完成**：正式发布包 `v2.0-l12-2026-10-16` 已生成并冻结（**4 件 / 988,564 字节**）；发布产物 = L12 冻结件（`983,460 / CFCD67DA…FC34 / LF`，**三方逐字节一致**）。
- **发布标识替代 `git tag`**（无 git 环境）；差异记录：**对路径 A（E-3）字节依赖 = 无影响**。
- **产品零字节变更**：canonical = step9 镜像 = L12 冻结件 = **983,460 / `CFCD67DA…FC34` / LF**。
- **下一入口**：**S5**（上线前最终收口复跑，见 [`s4s5-closure-2026-10-16.md`](s4s5-closure-2026-10-16.md:1)）。
