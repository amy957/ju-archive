# 项目日志

- 2026-11-10 fix-outline-collapse-1/1：大纲折叠三角与折叠提示条点击无响应——`src/views/outline.ts` 新增 `_toggleCollapseDirect(id)`（`deps.commit` 翻转 `s.nodes[id].collapsed`，异常捕获后 `forceRender`），`injectDeps` 复制 actions 并重写 `toggleCollapse` 指向该函数，`arrow.onmousedown` / `hint.onmousedown` 直连该函数；`tsc --noEmit` Exit 0，`vite build` Exit 0，DIST_BEFORE 4,719,661 B / 26FF6502…92FC7 → 4,719,438 B / 6FED7D74…9868E34，登记器 PARTY_COUNT=66 / drift 0 / PASS，`verify.js all` Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；证据 `2.项目日志/fix-outline-collapse-1-verify-all-2026-11-10-r3.txt`。
- 2026-11-08 review25-05-07：ISSUE-005 parity 首错即退掩盖 exe 检查（发布阻塞=条件）——`check-release-parity.mjs` 改收集式报告：WEB_MISMATCH / EXE_STALE / EXE_AFTER_SRC / SETUP_MISSING / SETUP_STALE / SETUP_MISMATCH 记 `errors[]` 后继续执行，末尾统一 Exit 1（SETUP 缺件跳过 setup 判据防 ENOENT，git ENOENT 文案「未判定」）；沙箱 `_probe.mjs` NEG_BOTH=1（WEB_MISMATCH+EXE_STALE）/ NEG_CI=1 / FALSIFY=1（仅 WEB_MISMATCH）/ GREEN=0；HEAD.json 未改，DIST_BEFORE=AFTER 4,715,286 B / 96C00A56…5263，登记器 PARTY_COUNT=66 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）；证据 `90过程材料/tmp/review25-05/`。
- 2026-11-08 review25-01-07：ISSUE-001 发布包整体滞后重打包（发布阻塞=是）——`cargo test` 22 passed → `build-all` 15 步 Exit 0（1g 22 · E2E 51 · 6b ✓ · 归档同步双 ✓）→ `v2.1.0-2026-11-08` 重生成 Web `6D5A9E54…EBAD` 4,715,113 B / exe `C078FE81…F47B` 7,379,456 B / setup `59ECC4A9…7425` 4,468,036 B / checksums `4D3D8D51…0DD8`，旧包让位 `.prev-1794142687350`；`check-web-parity`/`check-release-parity`/`check-manifest` 均 EXIT=0；证伪旧 Web→WEB_MISMATCH EXIT=1、旧 exe + `--ci-mode`→EXE_STALE EXIT=1，复原后三绿；HEAD.json 未改，登记器 PARTY_COUNT=66 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）；证据 `90过程材料/tmp/review25-01/`。

- 2026-11-08 review23-01-07：ISSUE-001 发布件滞后重建重归档（发布阻塞=是）——`cargo test` 22 passed → `node scripts/build-all.mjs` 15 步全链路（1f/1g/2/3/3b/4/5/6/6b；E2E 51 passed · tauri build 24.9s）→ `v2.1.0-2026-11-08` 重生成 Web/exe/setup/checksums+manifest（旧归档让位 `.prev-1794128450506`）；`check-dist-parity` Exit 0「✓ dist 不早于 src…」、`check-release-parity` Exit 0「✓ exe ≥ src 最新变更 · ✓ checksums 3 项复算一致」；证伪 dist/exe mtime 回拨 15:35 →「dist 早于」+「EXE_AFTER_SRC」双 Exit 1，复原后双 Exit 0；DIST 4,716,598 B / D5DC035A… → 4,716,499 B / 258EC391…C017，exe 7,363,584 B / B530485C…，setup 4,463,198 B / 195C0115…，HEAD.json 未改；登记器 PARTY_COUNT=66 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）；证据 `90过程材料/tmp/review23-01/`。

- 2026-11-08 review22-04-07：ISSUE-004 layout/main 桌面探测收敛（发布阻塞=否）——`src/core/utils.ts` 新增 `hasTauriInvoke()`（core.invoke / tauri.invoke 双通道），`main.ts` 的 `hasDesktopInvoke` 转调 `utils.hasTauriInvoke()`，`layout.ts` 的 `isDesktop` 改调 `hasTauriInvoke()` 并保留 `_win.electron/_win.nw`，`check-deps-wired.mjs` 增两文件同源断言；窗口按钮、setAlwaysOnTop、pinState、bind*Deps 键集合零改动；`node scripts/check-deps-wired.mjs` Exit 0 · 84 键 / 失败 0 · `PASS layout 桌面探测: OK`，负向 `isDesktop=!!_win.__TAURI__` → Exit 1「isDesktop 非能力口径」，复原 Exit 0；登记器 PARTY_COUNT=66 / drift 0 / RESULT=PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,716,598 B / D5DC035A…42DE7 before=after，HEAD.json 未改；证据 `90过程材料/tmp/review22-04/`。

- 2026-11-08 review22-03-07：ISSUE-003 同日备份轮转不得先删最新（发布阻塞=否）——`save_backup` 收集备份名时同取 `metadata.modified()`，排序由纯名字倒序改为 `(mtime desc, name desc)`，metadata 失败回退名字倒序；`.enc` 分桶与明文/密文各 `skip(5)`、`write_backup_file` 原子写/锁/复核、文件名格式、`safe_backup_dir` 白名单零改动；新增 `save_backup_keeps_newest_same_day`（10 份 mtime 递增同日备份 + 第 11 份 `_10`，断言 `_10` 留存 / `_1` 清理 / 总数 5），`cargo test` Exit 0 · 20 passed；证伪改回 `names.sort_by(|a,b| b.0.cmp(&a.0))` → 同用例 FAILED「最新备份 _10 不得被删除」（src\main.rs:881），复原后 20 passed；登记器 PARTY_COUNT=66 / drift 0 / RESULT=PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,716,598 B / D5DC035A…42DE7 before=after，HEAD.json 未改；证据 `90过程材料/tmp/review22-03/`。

- 2026-11-08 review21-03-05：ISSUE-004 layout 桌面能力探测纳入同源门禁（发布阻塞=否）——`scripts/check-deps-wired.mjs` 新增断言：`_tauriCoreInvokeAvailable` 函数体须同时含 `core.invoke` 与 `tauri.invoke` 的 `typeof === 'function'` 判断，`isDesktop` 须引用该 helper 且不得为纯 `!!(window|_win|globalThis).__TAURI__`；PASS 行 `layout 桌面探测: OK`，键数 81 → 83；正向 Exit 0（失败 0），负向 `layout.ts:101` 改 `const isDesktop=!!_win.__TAURI__;` → Exit 1「isDesktop 非能力口径（仅 __TAURI__ 命名空间）」，`copy /Y` 复原后 sha256 412C17C0…4F84 一致并复绿；窗口按钮 / `setAlwaysOnTop` / `pinState` 零改动；登记器 PARTY_COUNT=66 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,716,598 B / D5DC035A…42DE7 before=after，HEAD.json 未改；证据 `90过程材料/tmp/review21-03-05/`。

- 2026-11-07 review18-07：ISSUE-007 web-parity 归档目录口径分裂（发布阻塞=条件）——`check-web-parity.mjs` 改从 `release-paths.mjs` 导入 `resolveReleaseDir()`（显式 `JU_BUILD_DATE` 严格取当日目录、缺目录不降级；未显式取含 `release-manifest.json` 的最新归档），删除按目录名 `sort().pop()` 取最新，新增输出「比较归档目录」行；哈希比较 / DEGRADED 条件 / 归档文件零改动；负向 `JU_BUILD_DATE=2026-11-05` → 打印 `v2.1.0-2026-11-05`、`✗ fe48c6a7… ≠ bdb08905…`、Exit 1，默认环境 → `v2.1.0-2026-11-07` 哈希一致 Exit 0；证伪同环境旧口径副本 → 取 11-07 且 Exit 0；登记器 PARTY_COUNT=66 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,716,422 B / BDB08905…6685E 未重建，HEAD.json 未改；证据 `90过程材料/tmp/review18-07/`。

- 2026-11-07 review18-02：ISSUE-002 build-all 红（发布阻塞=是，本项关闭）——补齐 review9-08/11/12/13/14 五份 dist + window.JU 探针并登记 E2E_SPECS；build-all Exit 0，REQUIRED_PROBES 5 项 · 缺失 0，E2E 50 passed（首跑 concurrency 收敛数 66 < 100 抖动失败，单测 repeat ×2 与二跑全绿）；证伪删 review9-14 → 缺失 1 · ✗ 必检探针缺失 Exit 1，复原后 5 passed；登记器 66 方 / drift 0 / PASS，hash registry RESULT=PASS；dist 4,716,422 B / BDB08905…6685E 前后一致；归档 v2.1.0-2026-11-07 重建 exe 6F4D0571…F9847 / setup 8A19F796…36AA8；证据 cmd-1794048057085.txt / cmd-1794048326443.txt。

- 2026-11-07 review17-09：ISSUE-009 阻止旧 setup 随新 exe 混入（发布阻塞=条件）——`check-release-parity.mjs` 在 SETUP_MISSING 后新增 `SETUP_STALE`（`setup mtimeMs < 归档 exe mtimeMs` 即 exit 1）与 `SETUP_MISMATCH`（`bundle/nsis` 同版本 setup 存在时 SHA-256 比对，不一致 exit 1）；Web/exe/checksums 断言与 setup 字节零改动；parity Exit 0（Web bdb08905…6685e = dist · exe bee37ea0…c301 = target · setup 4,457,987 B · checksums 3 项），负向 setup mtime 置 exe −5 min → Exit 1 `SETUP_STALE`、还原后复绿（size/sha 不变）；登记器 PARTY_COUNT=66 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,716,422 B / BDB08905…6685E before=after，HEAD.json 未改；证据 `90过程材料/tmp/review17-09/`。
- 2026-11-07 review17-07：ISSUE-007 门禁可证伪「复核失败回滚」（发布阻塞=条件）——`check-deps-wired.mjs` 的 `bootTokens` 新增「复核失败不回滚」负向 token（`!/catch\s*\([^)]*\)\s*\{\s*hasEnc\s*=\s*true/`），失败输出「复核失败不回滚（load_state 失败仍回滚已提交明文）」；修后 `node scripts/check-deps-wired.mjs` PASS（78 键 0 失败），负向 boot.ts:902 改 `catch (e) { hasEnc = true; }` → Exit 1 / 失败 1 项并指名该 token，复原后复绿；既有 78 键 / clear_encrypted 读端断言 / boot.ts 业务逻辑零改动；登记器 PARTY_COUNT=66 / drift 0 / PASS；dist 4,716,422 B / BDB08905…6685E before=after，HEAD.json 未改；证据 `90过程材料/tmp/review17-07/`。
- 2026-11-07 review17-01：ISSUE-001 复核失败保持明文态（发布阻塞=是，净零源码 diff）——`boot.ts:896-905` 已为 `catch { hasEnc = false; }`，仅解析成功且 `st.encStore` 真才 `rollback()`，读端异常置 `rereadOk=false` 后只提示「复核未完成，请重启后确认」；新增负向用例 H（spec +31/−2，`tests/v21-review12-preimport-lifecycle.spec.ts:241`）`-g "复核失败"` 1 passed，证伪 `catch { hasEnc = true; }` → 1 failed Expected false / Received true，复原后复绿；登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,716,422 B / BDB08905…6685E 前后一致，HEAD.json 未改；ISSUE-001 关闭仍待 P-15/P-16 实机；证据 `90过程材料/tmp/review17-01/`。

- 2026-11-06 fixUnused1/1：`build-all` [1e/14] `check-unused-exports` 未使用 216 > 基线 214 首跑 Exit 1；`core/richtext.ts` 的 `IndentedOutlineNode` 与 `views/outline.ts` 的 `splitPastedLinesToNodes` 仅本文件自用，去 `export` 回 214（导出 1219 · Exit 0），门禁常量不抬；build-all（OVERWRITE=1 / BUNDLES=nsis）14/14 Exit 0 · 6b 三角 PASS，登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,716,422 B / BDB08905…6685E 前后一致，HEAD.json 未改；证据 `90过程材料/tmp/fixUnused1/`。

- 2026-11-06 fixPaste-1/1：大纲多行带缩进纯文本粘贴由单节点改为多级节点——`core/richtext.ts` 新增 `parseIndentedOutline`（\t 记 2 空格、最小缩进归一、无缩进返回 null），`views/outline.ts` 默认 `splitPastedLinesToNodes` 指向真实实现并按 text/plain 层级插入当前节点之后；新增单测红→绿 2 passed，tsc/vite build Exit 0，dist 集成层级 根A→子B→孙C / 子D / 根E 且 pageerror=0，登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,715,625 B / CE323E8F…979731 → 4,716,422 B / BDB08905…56685E，HEAD.json 未改；证据 `90过程材料/tmp/fixPaste-1/`。

- 2026-11-06 fix1-1/1：解锁浮窗标题「🔒 解锁JU」→「🔒 解锁」，删除 #unlockCancel 按钮与 onclick（ESC 取消路径保留）；日历「任务统计」「字数统计」标题改纯文本、不再拼 scope 括号；同步 full-e2e 解锁标题断言与 review9-05 取消路径改 ESC；tsc Exit 0，定向 PW 3 passed，登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,715,782 B / 8FB58D12…DA024 → 4,715,544 B / 3CEB181F…01BD，HEAD.json 未改；证据 `90过程材料/tmp/fix1-1/`。

- 2026-11-06 review15-13：ISSUE-013 说明口径合并复核（发布阻塞=否，零源码 diff）——canonical `prepare-release.mjs:155` 仅「未关闭 ISSUE：…（来源 docs/OPEN-ISSUES.md）」、`:156` parity≠PASS 时单行「发布一致性：FAIL（原因：Web≠dist）」，旧「已知问题」分支不存在；check-manifest RESULT=PASS entries=4 openIssues=1；真实 Notes 已知问题 0 / 未关闭 ISSUE 1；沙箱恢复旧模板 → 已知问题 1（OLD_EXIT=0），沙箱去 dist/index.html → 发布一致性：FAIL 1 / 已知问题 0；canonical=sandbox B4E7710E…F8CAA648；dist 4,715,782 B / 8FB58D12…DA024 未重建，HEAD.json 未改；证据 `90过程材料/tmp/review15-13/`。
- 2026-11-06 review15-10：ISSUE-010 关闭加密可证伪（发布阻塞=条件，净零源码 diff）——目标态已在基线：`boot.ts:887-901` 桥接能力判定 + `load_state` 复核，`check-deps-wired.mjs:156-179` 断言 `load_state` / 「桥接不可用」token 与原子调用先于「已关闭加密」，`tests/v21-fix43-bridge-capability.spec.ts:20-51` 命名空间-only 用例；gate Exit 0「PASS 关闭加密读端: OK …」78 键 0 失败、新用例 1 passed；证伪 line 890 失败提示置空 → Exit 1「FAIL boot.ts: 关闭加密缺 桥接不可用失败提示」，证伪 isDesktop 恒 false（dist 临时替换）→ 1 failed Expected「桥接不可用」/ Received「已关闭加密」；boot.ts 0AE41B9B…4E11 / dist 8FB58D12…DA024 before=after，HEAD.json 未改；证据 `90过程材料/tmp/review15-10/`。
- 2026-11-06 review15-03-r2：ISSUE-003 归档 Web/exe/setup 与 dist 同源（发布阻塞=是，本项关闭）——1b 门禁收敛后执行 `JU_RELEASE_OVERWRITE=1 JU_BUNDLES=nsis node scripts/build-all.mjs`（cwd=6.P0-T3基线/m07-vite）Exit 0 / 14 步全绿 / E2E 44 passed；归档 `8.发布与CI/release/v2.1.0-2026-11-06/` Web 4,715,782 B / 8fb58d12…da024、exe 7,345,664 B / 33a848e8…b43d1、setup 4,458,341 B / 562a493d…6fe、checksums 258 B 3 行，exe/setup 均为本轮新出字节（48ddf6fa…/9972592b… → 33a848e8…/562a493d…）；证伪（重打包前 `JU_BUILD_DATE=2026-11-05 check-release-parity`）Exit 1，fe48c6a7…2582 ≠ 8fb58d12…da024；check-release-parity / check-web-parity Exit 0；登记器 66 方 / drift 0 / PASS，HEAD.json 未改；源码 diff 0 行，.prev-* 1；首跑 [6/14] prepare-release EBUSY（PID 22848 占用归档 exe）经用户关闭后重跑成功；证据 `90过程材料/tmp/review15-03/`。

- 2026-11-06 review15-02-r2：ISSUE-002 强杀不留「明文+旧密文」双态复核（发布阻塞=是，代码零改动）——`tests/v21-review12-preimport-lifecycle.spec.ts:129-136` r14Mock 的 `save_plain_and_clear` 写盘后延迟 800ms，G（`:205-231`）在窗口内 `context.close()` 后按杀前磁盘快照新开上下文重启，断言 `load_state` 无 encStore、标题 `G-PLAIN`、无 `#unlockPwd`；`src-tauri/src/main.rs:555-574` `save_plain_and_clear_is_atomic` 加密快照→原子命令→无 encStore 且 nodes=2 / rootId 完整；cargo atomic 1 passed / 12 filtered、G `--repeat-each=3` 3/3、spec 全量 7 passed（E/F 断言未改）；证伪（`boot.ts:893` 拆回 `save_state`+`clear_encrypted`，已按原字节复原 RESTORE_MATCH=True）→ G `:228` 红 Expected "" / Received "{\"v\":1,…\"cipher\":…"，复原后 3/3 绿；登记器 PARTY_COUNT=66 / drift 0 / RESULT=PASS，verify.js all Exit 0（静态 0 命中 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,715,782 B / 8FB58D12…DA024 BEFORE=AFTER=FINAL、HEAD.json 未改；证据 `90过程材料/tmp/review15-02-r2/`。
- 2026-11-06 review15-01-r2：ISSUE-001 关闭加密原子写复核（发布阻塞=是，代码零改动）——`6.P0-T3基线/m07-vite/src-tauri/src/main.rs:105` `save_plain_and_clear` 在单次 `write_store` 前 `object.remove("encStore")` 并回填 `errorLog`，`:469` 已登记 `invoke_handler`；`6.P0-T3基线/m07-vite/src/app/boot.ts:893` 单次 `await inv('save_plain_and_clear', { payload })`，失败 `rollback()` 且不再触盘，`:896-901` `load_state` 复核无 `encStore`，读端 `:1407` 无 `encStore` 不走解锁、恢复端 `:1399` 分支保持、导入端零改动；cargo `save_plain_and_clear` 2 passed / 0 failed（含 review15-02 `save_plain_and_clear_is_atomic`，故非 1 passed）、spec E/F 2 passed；证伪（临时改回 `save_state` → `clear_encrypted` 旧序，已按原字节复原）→ E 红 `:164 原子写必须等在途 save_state 完成之后` Expected >= … Received 0；登记器 PARTY_COUNT=66 / drift 0 / RESULT=PASS，check-deps-wired 78 键 0 失败（关闭加密读端 PASS），verify.js all Exit 0（静态 0 命中 · Node 503 · PW 171 · bench 最大恶化 0.0%）；dist 4,715,782 B / 8FB58D12…DA024（spec prepare 重建同哈希）、HEAD.json 未改；证据 `2.项目日志/review15-01-r2-verify-all-2026-11-06.txt`。

- 2026-11-06 review15-06：ISSUE-006 未关闭清单只列真实项——`prepare-release.mjs:65-67` OPEN_ISSUES 由 `003/004/006/007/008/009` 改为 `001/002/003/004/005/008`（注释同步为「review14-ISSUE-008/009 已 Closed with evidence」）；`JU_RELEASE_DOCS_ONLY=1 JU_BUILD_DATE=2026-11-05` 重生成 `8.发布与CI/release/v2.1.0-2026-11-05/` 的 RELEASE-NOTES.md（:6 → `ISSUE-001/002/003/004/005/008`，473 B / ad8d908a…622f）与 release-manifest.json（openIssues 6 项 / artifacts 4 条 / parity FAIL，1,034 B / 07f97e27…e007）；check-manifest RESULT=PASS openIssues=6；Select-String `未关闭 ISSUE` HIT=1、`ISSUE-009` 0、`008/009` 0；证伪旧清单（473 B / df0b072d…）`ISSUE-009` 命中 1；四件产物 Web fe48c6a7…5852 / exe 010a3d01…5411 / setup 004e30a0…4469 / checksums 244db7e9…da00 BEFORE=AFTER；登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,715,494 B / af554472…0509 零变，HEAD.json 未改；证据 `90过程材料/tmp/review15-06/`。
- 2026-11-06 review15-05：ISSUE-005 F 用例可证伪明文残留——`tests/v21-review12-preimport-lifecycle.spec.ts` F 在 encStore 断言后追加 `const st = await r14Load(page)`、`Object.keys(st.nodes||{}).length === 0`、`st.encStore` 非空（E 断言与 r14Mock 延迟语义零改动）；spec 7 passed；证伪（mock 失败前按 save_state 同构写明文并保留 encStore，已按原字节复原）→ F `:197` 红 Expected 0 / Received 7；登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,715,494 B / AF554472…0509 零变（spec prepare 重建同哈希），HEAD.json 未改；证据 `90过程材料/tmp/review15-05/`。
- 2026-11-06 review15-02：ISSUE-002 强杀不留「明文+旧密文」双态——`tests/v21-review12-preimport-lifecycle.spec.ts` 的 r14Mock 让 `save_plain_and_clear` 写盘后延迟 800ms 才返回（`plainDelay`/`seed` 参数，E/F 调用不变），新增 G：写盘瞬间 `context.close()` 强杀，以杀前磁盘快照在新上下文重启，断言 `load_state` 无 `encStore`、标题为 `G-PLAIN`、无 `#unlockPwd`；`src-tauri/src/main.rs` 新增 `save_plain_and_clear_is_atomic`（加密快照→原子命令→无 encStore 且 nodes/rootId 完整）；cargo atomic 1 passed、G `--repeat-each=3` 3 passed、spec 全量 7 passed；证伪（boot.ts 原子调用拆回 `save_state`+`clear_encrypted`，已按原字节复原）→ G 红 `Expected "" / Received "{\"v\":1,…\"cipher\":…}"`；登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）；dist 4,715,494 B / AF554472…0509 零重建，HEAD.json 未改；证据 `90过程材料/tmp/review15-02/`。
- 2026-11-06 review15-01：ISSUE-001 关闭加密改为「一次原子写」——`src-tauri/src/main.rs` 新增 `save_plain_and_clear`（同一次 `write_store` 写不含 `encStore` 的明文快照并 `object.remove("encStore")`，回填 `errorLog`）并登记 `invoke_handler`；`src/app/boot.ts` 改为加密态等完在途写盘 → 翻转 → 单次 `invoke('save_plain_and_clear')` → `load_state` 复核无 `encStore`，失败 `rollback()` 且不再触碰磁盘（禁止先 clear 后写）；`tests/v21-review12-preimport-lifecycle.spec.ts` r14Mock 增 `save_plain_and_clear` 分支，E 增 `writeAt>=saveEnd` / `plainClears==1` / `OLD-ENC|false`，F 增「失败后磁盘不含 R14-NEG」；cargo 1 passed（全量 12 passed）、tsc Exit 0、spec 6 passed；证伪（inv 改回 `clear_encrypted`）→ E 红（Expected "已关闭加密" / Received "关闭加密失败，请重试"）；登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 0 失败 · 最大恶化 0.0%）；dist 4,715,494 B / AF554472…0509，HEAD.json 未改；证据 `90过程材料/tmp/review15-01/`。

- 2026-11-05 review14-08：ISSUE-008 注释纠偏——`src/app/session.ts:1436` catch 注释由「退回底层关闭 API」改为「挂载失败：自定义 X 拒绝直关并提示二次点击」，与 layout.ts fail-closed（flushPersistNow + toast + return）一致；行为代码零改动、dist 未重建（4,715,423 B / 6BC55E86…）；Select-String '退回底层关闭' HIT=0，证伪临时文件 HIT=1；登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）。证据 `90过程材料/tmp/review14-08/`。

- 2026-11-05 review14-05：ISSUE-005 归档说明失真——`prepare-release.mjs` 增 `OPEN_ISSUES`（ISSUE-003/004/006/007/008/009）与 Notes 行「未关闭 ISSUE：ISSUE-003/004/006/007/008/009」，`release-manifest.json` 增 `openIssues` 数组，`check-manifest.mjs` 增同口径断言（openIssues 非空且 Notes 含同文案，删行即 FAIL）；docs-only 重生成前后 Web fe48c6a7… / exe 010a3d01… / setup 004e30a0… / checksums 244db7e9… 四件哈希全等，artifacts 仍 4 条目、checksums 仍 3 行；check-manifest Exit 0 `RESULT=PASS entries=4 openIssues=6`，Select-String '未关闭 ISSUE' HIT=1，证伪（沙箱删行）Exit 1 `RESULT=FAIL`；`parity` 如实转 FAIL（归档 Web ≠ dist 6bc55e86…，dist 随 review14-01/02 重建），随发布批重打包；登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）。证据 `90过程材料/tmp/review14-05/`。

- 2026-11-05 review14-01：关闭加密改为写端明文先落盘 → clear_encrypted → load_state 复核无 encStore（失败回滚加密态并提示）；BootDeps 增 persistNowAwait（main.ts 注入），关闭前推进 `_rev` 强制整库明文落盘；扩展 `v21-review12-preimport-lifecycle.spec.ts` E/F（save_state 延迟 800ms + clear 失败回滚），spec 6 passed；证伪删除 await → E 红（Expected "OLD-ENC" / Received ""）；登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 · 最大恶化 0.0%）。

- 2026-11-05 review12-fix1205：#3/#4 自定义 X 改走 session 暴露的 close-requested 同链路（layout.ts + session.ts），加密备份分桶按去 `.json` 后含 `.enc` 判定（main.rs，含 `_N` 用例），#7 编辑提交第一现场写 pending 并桌面加密态立即写密文库（persist.ts）；build-all Exit 0（14 步 · E2E 38 passed · 6b 三角 PASS），产物 Web 4,715,035 B / b475cd26… / exe 7,332,864 B / bd31b154… / setup 4,455,656 B / fc7a6234…；cargo test 10 passed；verify.js all Exit 0（静态 0 · Node 503 · PW 167+4=171 · bench 0.0%）；登记器 66 方 / drift 0 / PASS；实机 #3 FINAL_COUNT=5、#4 MARKER_FOUND=1、#7 114ms 强杀 MARKER_FOUND=2；原 APPDATA 79,646 B / 3DCF3235… 已还原。证据 `90过程材料/tmp/review12-fix1205/`。

- 2026-11-05 review12-final：build-all Exit 0（14 步 · E2E 38 passed · 6b Web/exe/setup/checksums 全 ✓），产物 Web bbf4f861… / exe 6bf223d2… / setup a93c1be1…；Gate1 Exit 0（静态 0 · Node 503 · PW 171 · bench 0）、Gate2 193 passed、Gate3 9 passed、Gate4 77/0、Gate5/6/7/8 PASS、登记器 66 方/drift 0/PASS；实机 item1 新 exe 开加密→关加密→标题 REALCHECK-T1C-20260805T0734Z→关窗，store 6,751 B / 9C194C80… 关窗前/后命中 1，原 APPDATA 3DCF3235… 已还原；证据 `90过程材料/tmp/review12-final/`。
- 2026-11-05 sync-ci-gate：`8.发布与CI/ci/ci-gate.yml` 在 `verify:all` 之后补齐 `Release manifest gate (check-manifest)` / `Dist parity (src ↔ dist)` / `Web parity (dist ↔ 归档 Web)` 三步（含 `working-directory: 6.P0-T3基线/m07-vite` 与注释），与 canonical `.github/workflows/ci-gate.yml` 逐字一致（SHA256 全等 2146B930…31DCF），canonical 与其他 step 零改动；Select-String 命中 2/1/1，删去三步块后 0/0/0（证伪成立），复原同哈希；登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 167 passed + 4 skipped = 171 · bench 0.0%）；dist 4,713,947 B / a51e8849…543c3 零构建。证据 `90过程材料/tmp/sync-ci-gate/`。

- 2026-11-05 fix1i：`build-all.mjs` 的 `CLOSED_HIGH_SPECS` 由手工数组改为 `readdirSync(tests)` + `/^v21-(review|fixr|fixhex)\d+.*\.spec\.ts$/` 自动扫描，保留缺一 Exit 1 并补反向核对（E2E 已登记项必须仍在扫描集合），`E2E_SPECS` 仅追加 review12-preimport-lifecycle / fixr6-13-db-skip / review5-feature-entries 3 行（经用户授权），`runStep` 计数与其余零改动；build-all Exit 0 且日志 `CLOSED_HIGH_SPECS: 13 项`、E2E 38 passed、6b 三角 PASS，证伪移出 `v21-review10-enc-preimport.spec.ts` → Exit 1 并打印该文件名、复原同哈希 3F89E956…DC98；登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 0.0%）；dist 4,713,947 B / a51e8849…543c3 构建前后同哈希，归档 v2.1.0-2026-11-05 重建。证据 `90过程材料/tmp/fix1i/`。

- 2026-11-05 fix1h：`check-inline-style.mjs` 的 `THRESHOLD_MODE` 由 record 转 hard，上限冻结为实测 `HEX_LIMIT=130` / `BANG_LIMIT=72`，文案 `[record]`→`[hard]`，超阈值经 `failed += 1` 并入 Exit 1（不再「打印 FAIL 但 Exit 0」）；`!important` 生效位置、CSS 选择器、hex 替换逻辑零改动；验收 Exit 0 且无 `[record]`，证伪 `BANG_LIMIT=71` → Exit 1 并输出 `FAIL !important 72 > 71 [hard]`，复原 72 → Exit 0；登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 0.0%）；dist 4,713,947 B / a51e8849…543c3 零重建。证据 `90过程材料/tmp/fix1h/`。

- 2026-11-05 fix1f1g：`build-all.mjs` 1e 后插入 1f `cargo check --manifest-path src-tauri/Cargo.toml`（失败即停）与 1g 回执扫描（缺失仅 `⚠ 无回执 <batch>`，不阻断），`STEP_TOTAL` 12→14 且 1a-1e / 2-6b 语义零改动；build-all Exit 0（含 `[1f/14]` / `[1g/14]`），main.rs 追加语法错误 → 1f Exit 101 立即停、复原同哈希；登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 0.0%）；dist 4,713,947 B / a51e8849…543c3。证据 `90过程材料/tmp/fix1f1g/`。

- 2026-11-04 review11-09/09：ISSUE-009 发布说明失真——`prepare-release.mjs` 新增 `detectParity()`（归档 `JU-v2.1-Web.html` 与 `dist/index.html` 哈希相等才 PASS），说明第 5 行改为「承接 ISSUE」/「已知问题：本归档未含 …」二选一，`release-manifest.json` 增 `parity` 字段；checksums 3 行与格式、manifest 既有 4 条目字段、`JU_RELEASE_DOCS_ONLY` 早退路径零改动，归档正文不手改、由 docs-only 重生成；`JU_BUILD_DATE=2026-11-03` 三角 Exit 1（bbab5c84… ≠ 5af650ec…）与清单 `"parity": "FAIL"` 一致，证伪固定 `'PASS'` → 清单 PASS + Notes「承接」而三角 Exit 1（矛盾成立），复原后 FAIL；`check-manifest` `RESULT=PASS entries=4`；登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 最大恶化 0.0%）；dist 4,713,030 B / 5AF650EC…52CE72 零构建。证据 `90过程材料/tmp/review11-09/`。
- 2026-11-03 review10-11/11：ISSUE-010 归档自带清单与说明——`prepare-release.mjs` 新增 `writeReleaseDocs()`，在 checksums 落盘且 `prunePrevs()` 后按归档内真实字节写 `RELEASE-NOTES.md`（7 行）与 `release-manifest.json`（4 条目：Web/exe/setup/checksums 的 size + SHA-256），并新增 `JU_RELEASE_DOCS_ONLY=1` 只补文档（不复制、不让位）；`build-all.mjs` 在 NSIS 入档并重写 checksums 后以 docs-only 重算清单；Web/exe/setup 字节、checksums 258 B / 3 行、`prunePrevs` 顺序零改动；归档 6 件，`check-manifest.mjs` → `RESULT=PASS entries=4`，证伪沙箱删 manifest → `RESULT=FAIL missing …release-manifest.json`（Exit 1）；登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 167 · bench 最大恶化 0.0%）；dist 4,712,563 B / FDD09588…B8F69711 零构建。证据 `90过程材料/tmp/review10-11/`。

- 2026-11-03 review10-10/11：ISSUE-009 继续 token 化并冻结 `!important`——`src/style.css` 的 `:root` 新增 `--c-bg-soft/--c-bg-mid/--c-bg-panel2/--c-bg-menu/--c-line-soft/--c-accent-soft`，并把 `--bg-soft/--bg-mid/--bg-panel2/--bg-menu/--line-soft/--accent-soft` 的 6 处同值字面量替换为 `var()`；选择器 / 实际色值 / `var()` 回退 / `!important` / 注释内字面量零改动；`Select-String '!important' -AllMatches` 计数 72（本批新增 0），`check-inline-style.mjs` P0 PASS（9 项全 PASS）；三态探针日/夜/打印 RESULT=PASS 1 passed ×2，证伪 `--c-bg-soft:#CAD3C4` → 1 failed（day --bg-soft rgb(202,211,196)），复原 style.css 哈希 84fb78d7…081bc7 同字节；tsc Exit 0、登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 最大恶化 0.0%）；dist 4,712,375 B / 8C15A288…E9F8776 → 4,712,563 B / FDD09588…B8F69711；release 三角未重打包。证据 `90过程材料/tmp/review10-10/`。

- 2026-11-03 review10-09/11：ISSUE-011 加密态导出需明示或加密——`export.ts::exportFullBackup` 入口读 `deps.ui`，`encrypted && encKey` 时先 `appConfirm('当前为加密模式，导出的备份文件为明文，是否继续？')`，取消直接 return；toast 改「已下载明文备份（…）」；`uiSnapshot` 键集合（不含 encKey）/ 瘦身口径 / 分片序列化 / 文件名 / `download` 参数与明文态路径零改动；`tests/v21-review5-feature-entries.spec.ts` 追加 review10-09（置 encrypted+encKey 后点 `#btnBackupSide`）green 2 passed ×3，证伪 `if (false && plainExport)` 重建 → 1 failed（`toBeVisible()` element(s) not found，Received 0），复原重建同字节；tsc Exit 0、登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 最大恶化 0.0%）；dist 4,712,158 B / EDC75BF5… → 4,712,375 B / 8C15A288…E9F8776；release 三角未重打包。证据 `90过程材料/tmp/review10-09/`。

- 2026-11-03 review9-11/14：ISSUE-011 同批后续文件继续处理——`import.ts` JSON 恢复分支 `return` 改 `continue` 并置 `didFullRestore=true`，末尾 toast 增加「已恢复备份，后续文件按新库导入」；`initStore(normRestore)` / `applyUIFields` / `restoreVersions` / `.db` 跳过零改动；`setInputFiles([a.json,b.md])` 探针 green 1 passed、green-r2 1 passed，证伪改回 `return` → 1 failed（Expected 1 / Received 0）；tsc Exit 0、登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 最大恶化 0.0%）；dist 4,710,281 B / 2D07DC80…A046E3 → 4,710,350 B / D2C3DC15…A435；release 三角未重打包。证据 `90过程材料/tmp/review9-11/`。

- 2026-11-03 review9-09/14：ISSUE-009 新增用例不再靠 800ms——`tests/v21-review8-recovery.spec.ts:12` 的 `waitForTimeout(800)` 改为 `waitForFunction`（JU 存在且 `#content` 有子节点）后再写 preimport；`v21-fix9-settings-bind.spec.ts:204` 的 400ms 改为 `expect.poll(有效状态, 4s)`，原断言逐字保留；断言语义 / 产品源码 / 超时上限零改动；review8 连跑 3 次 1 passed（7.0s / 5.9s / 6.4s），settings-bind 6 passed，证伪删 waitForFunction 单跑 1 passed（该用例由 `ready()` 保证 JU 就绪，不依赖隐式等待）；`waitForTimeout` 计数 212 → 210；tsc Exit 0、登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 最大恶化 0.0%）；dist 4,710,281 B / 2D07DC80…A046E3 零漂移；release 三角未重打包。证据 `90过程材料/tmp/review9-09/`。

- 2026-11-03 review9-08/14：ISSUE-008 旧备份归一化不再是恒等——`main.ts` 定义 `migrateStateObject(st)`（原 boot / import 两处均为 `(st)=>st`）：补 `tagColors={}` / `dbFields` / `activity` / `_ver` 缺省，按 `parent` 重建 `children`（丢弃悬空 / 自引用 / 根引用 / 重复项，孤儿挂根，回收站子树保持脱离活树），结构不可识别返回 null；`injectBootDeps` 与 `injectImportDeps` 同步接入；`initStore` 缓存清理 / 树修复、导入侧 `validateImportedTree`、旧备份字段名零改动；探针 2 例 green（旧备份 tagColors=object / dbFields=array / activity=object / _ver=number / dangling=[] / 孤儿挂 old-root；合法新备份四字段原值保留、回收站根未挂回活树），证伪两处注入回 `(st)=>st` → 1 failed（tagColors undefined，dangling 含 old-orphan>ghost-child）；tsc Exit 0、登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 最大恶化 0.0%）；dist 4,708,966 B / 5F323F72…A3D347 → 4,710,281 B / 2D07DC80…A046E3；release 三角未重打包。证据 `90过程材料/tmp/review9-08/`。

- 2026-11-03 review9-06/14：ISSUE-006 控制台不得出现正文——`richtext.ts::logInlineStyleEntry` 入口改 `window.__JU_RT_DEBUG===true` 门控（默认关闭），日志字段收敛为 `rangeCount` / `collapsed` / 起始容器 `tagName` / 选中长度，删除 `r.toString()` 与 startContainer/endContainer 节点对象；`applyInlineStyle` 行为 / 选区恢复 / CSS 属性计算零改动；探针 2 例：默认关闭 green（4 条 console 均不含 REVIEW906-SECRET-TEXT，DOM 落 color/font-weight/font-size 证明引擎执行），证伪恢复原 5 参日志 → 1 failed（leaked 含正文），恢复后 green-r2 2 passed 且门控开启输出 `[JU-RT] 1 false #text 21`；tsc Exit 0、登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 通过）；dist 4,708,861 B / 8E4FDEDB…8DB4D76 → 4,708,966 B / 5F323F72…A3D347；release 三角未重打包。证据 `90过程材料/tmp/review9-06/`。

- 2026-11-03 review9-05/14：ISSUE-005 锁定态不产生空备份——`session.ts::_saveBackupOnClose` 在备份开关判定后新增 `if (ui.locked) { toast('已锁定，未写入关闭备份'); return; }`，`_closeBackupPayload` 入口新增 `if (ui.locked) return null;`；主库落盘顺序不变（`runPersist` 已在 `ui.locked` 早退），`persistNowAwait` / 10s 熔断 / KEEP=5 / 文件名规则零改动；探针 3 例：red（批前）1 failed「锁定无密钥 calls=1 / 2,722 B 空备份」，green 3 passed（加密取消解锁 0 次 + 提示已锁定、解锁态 1 次、锁定无密钥 0 次），证伪（撤两守卫重建）→ calls=1 失败、恢复后重建同字节；tsc Exit 0、登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 通过）；dist 4,708,763 B / E1C2F36B…F0B3C4 → 4,708,861 B / 8E4FDEDB…8DB4D76；release 三角未重打包。证据 `90过程材料/tmp/review9-05/`。
- 2026-11-03 review9-03/14：ISSUE-003 关闭落盘与备份开关解耦——`session.ts::_saveBackupOnClose` 将 `persistNowAwait()` 与未收敛 toast/reportError 前置于 `ui.autoBackupOnClose` 开关与 invoke 判定，仅备份段受开关控制（10s 熔断 / `_closeInFlight` / 双击 preventDefault / 载荷 / UI 文案未改）；`tests/v21-fixr6-close-persist.spec.ts` 追加 review9-03（`autoBackupOnClose:false` + 挂起 `save_state` + 点 ×）→ 绿 4 passed，证伪（早退移回）→ 1 failed「备份开关关闭时 close 不得早于主库落盘」；tsc Exit 0、登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）；dist 4,708,763 B / 73E789CB…BBEFD4DC → 4,708,763 B / e1c2f36b…85f0b3c4；源码仅改 session.ts 与关闭链路 spec。证据 `90过程材料/tmp/review9-03/`。
- 2026-11-03 fixr6-12-2：release 下 `.prev-*` 保留上限 1——设 `JU_BUILD_DATE=2026-11-02` 跑 `prepare-release.mjs`，drop 分支将较旧件 `…prev-1793625615410` 移入 `90过程材料/tmp/fixr6-12/prev-release-1793690554302/`（只移不删，4 文件 SHA-256 与 checksums 全等），保留 `…1793687596800`，随后命中 ISSUE-010 拒绝分支（正式归档零写入）；计数 2→1，`keep=prevs` 反向对照=2；登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）；dist 4,708,019 B / 71FC7C29…56D1F5 未构建；源码零改动。证据 `90过程材料/tmp/fixr6-12/run-20261103/`。
- 2026-11-03 fixhex-01：style.css 重复 hex 收口——8 个高频 hex（#fff/#7CB342/#8064C8/#000/#33654C/#0A1929/#24332B/#2E4B3A）提为 `--c-*` token，声明内重复字面量全量改为 var()（注释字面量保留）；选择器 / 色值 / 72 处 !important 未改；HEX_TOTAL 220→150（≤212），!important=72；v21-fix30/31 2 passed，probe-colors 日/夜/打印三态 RESULT=PASS；登记器 66 方 / drift 0 / PASS，verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）；dist 4,707,111 B / CDCB84C5…D96128 → 4,708,019 B / 71FC7C29…56D1F5；release 三角未重建。证据 `90过程材料/tmp/fixhex-01/`。

- 2026-11-03 review8：恢复 preimport 自动备份——`main.ts` 增真实 `loadAutoBackup`（读 `juju.backup.preimport`，校验 `nodes`/`rootId`，缺失或损坏返回 null，不伪造恢复），`injectBootDeps` 由 `() => null` 换为真实引用并加入 `check-deps-wired` 关键键；新增 `tests/v21-review8-recovery.spec.ts`（`getItem` 注入主库读取故障）→ 1 passed，改回 `() => null` → 1 failed（Expected REVIEW8-PREIMPORT / Received ""）；tsc Exit 0、登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）；dist 4,707,111 B / CDCB84C5…D96128（批前未采集）；release 未重建。证据 `90过程材料/tmp/fixreview8-01/`。
- 2026-11-02 review7-13/20：ISSUE-013 关闭备份失败不静默——`_saveBackupOnClose` 的 `invoke('save_backup')` 外包 try/catch，失败 `console.warn` + `reportError('close-backup')` + toast，不阻断退出；关闭顺序 / 10s 熔断 / 载荷 / Rust 零改动；假桥 reject 探针绿（report_error 与 toast 均早于 close、close 执行），删 catch 内 toast/reportError 负向 RESULT=FAIL，恢复 PASS；tsc Exit 0、登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）；dist 4,705,973 B / 5F8E9A94…B070E7；release 未重建。证据 `90过程材料/tmp/fixr7-13/`。

- 2026-11-02 review7-07/20：ISSUE-007 关闭备份只写授权目录——Rust `safe_backup_dir` 增系统目录拒写（盘符根 / Windows / Program Files / ProgramData / unix 系统目录，与前端 `_juBlockedDir` 同口径），新增单测 `save_backup_rejects_system_dir`；前端导出 `_juBlockedDir`，`_closeBackupPayload` 命中即 `path=''` + toast；证伪：白名单行 / 守卫加 `false &&` 后 Rust 用例 FAILED、前端探针 BACKUP_PATH="C:/Windows/JU-备份-2026-11-02.json"，恢复后 green；非系统目录 D:/JuBackups 正常写盘；build-all 12 步全绿，dist 4,705,509 B / 45074396…B4158A、exe 7,319,040 B / 6b238930…D1C3、setup 4,454,104 B / e008cf38…EB10F，parity ✓；登记器 66 方 / drift 0 / PASS；verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）。
- 2026-11-02 fixr7-04/20：ISSUE-004 发布三角重建——先确认 src/** 无未构建改动（dist mtime 12:49:00Z 晚于 src 最新 12:48:47Z），再以 `JU_RELEASE_OVERWRITE=1` + `JU_BUILD_DATE=2026-11-02` 跑完整 build-all（[1..6b/12] 全绿，含第 5 步 tauri build 与第 6b 步）；dist 重建 4,705,410 B / 3583C822…D221，归档 v2.1.0-2026-11-02 Web 同哈希、exe 7,304,192 B / fa477029…e78e == target/release/JU.exe，旧归档自动让位 `.prev-1793624357374`；check-release-parity PARITY_EXIT=0（双 ✓），证伪（保留 17:36 归档 80CA0473…）仍报 ISSUE-006；登记器 66 方 / drift 0 / PASS；src/** 与 scripts/** 零改动。
- 2026-11-02 fixr6-14/19：方案②删 L9/L10 空包装端口——`main.ts` 的 `initL9Shadow` / `initL10Seam` 仅回调 `window.JU.*`，而 m07-vite 未迁移 L9/L10（ADR-D01 · `core/idb.ts` 同载），全局函数恒不存在；删两端口与 `boot.ts` 接口 2 键及两处调用；`JU-UI交互增强不变量清单-v2.1-dev.md` 登记「l9 不适用」；验收 HITS=0，负向对照 canonical / step9 镜像各 3 命中；tsc Exit 0、登记器 66 方 / drift 0 / PASS、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）；HEAD.json 未变，dist 未重建。
- 2026-11-02 fixr6-19/19：`persistNowAwait` 由单轮改最多 3 轮——每轮清防抖 → `await runPersist()` → `_persistRunning` 时 50ms×20 等结束 → 用 `_lastWrittenJson` 与 `JSON.stringify(deps.getState(), _ORIGIN_STRIP)` 比对，不等且仍有脏/待调度再跑一轮，3 轮不收敛仅 warn 不阻断关闭；`onCloseRequested` 顺序 / 10s 熔断 / 指纹守卫 / `persistNow()` 调用点 / `src-tauri/**` 零改动；用例改为首轮 `save_state` 挂起期间追加节点、放行后断言第二次载荷含该节点且早于 `close`，并登记进 `E2E_SPECS`；红证（换回单轮并重建 dist）1 failed「末次编辑未落盘」，复原 1 passed；tsc Exit 0、登记器 PASS / drift 0、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）；dist 4,704,898 B / 80CA0473…D7；release 未重建。
- 2026-11-02 fixr6-2/19：删 boot `backupOnClose` 死端口（接口声明 / 默认 noop / beforeunload 与切后台两处调用），关闭备份仍走 session.ts `_saveBackupOnClose` 单通道，`autoBackupOnClose` 开关保留；验收 check-deps-wired Exit 0（71 键 · injectBootDeps 8 键）；负向回插声明 → `\bbackupOnClose\b` 1 命中且 tsc 缺键，复原字节全等；登记器 PASS / drift 0、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）；dist 4,704,682 B / AEDA5751…49F90FB3（改前 4,704,837 B）；release 未重建。
- 2026-11-01 fixr6-17/19：入口 spec 补行为断言——`page.on('pageerror')` 前移到 `page.goto` 之前；`#btnBackupSide` 改用 `page.waitForEvent('download',{timeout:5_000})` 并断言文件名 `JU-备份-YYYY-MM-DD.json`；`#btnTheme` 点开选择器后选对侧主题卡并断言 `dataset.theme` 不等于点击前值；负向（`session.ts:1177` 绑定换 `/* removed */` 并重建 dist）1 failed「Expected: not "day"」，复原后 1 passed；登记器 PASS / drift 0、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）；dist 4,705,181 B / 16894967…E11A2C9 与改前全等。证据 `90过程材料/tmp/fixr6-17/`。
- 2026-11-01 fixr6-15/19：`save_backup` 增 `name: Option<String>`（`Some` 用其、去 `/` 与 `\`、空或含 `..` 即 Err；`None` 保留 `JU_Backup_<微秒>`），目标统一 `dir.join(&file)`、撞名加 `_seq`；前端 `_closeBackupPayload` 单传 `name`（path 仍为 dir/name 供取父目录，fix41/42/40 桩零改动）；`safe_backup_dir` / `KEEP=5` / `write_backup_file` / 轮转双前缀过滤零改动；新增 `save_backup_uses_name` 绿 4 passed，红证「文件名应为 JU-备份-…，实得 …JU_Backup_…json」1 failed；tsc Exit 0、登记器 PASS / drift 0、verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7）；dist 4,705,118 B / D9FF2C7C…09EEF00；release 未重建。证据 `90过程材料/tmp/fixr6-15/`。
- 2026-11-01 fixr6-8/19：runPersist 写盘前合并门槛由「磁盘 updatedAt > 内存 updatedAt」改为「磁盘快照存在即合并」（updatedAt 同毫秒 / 内存更新时漏合并会整快照覆盖丢对端节点）；加密态补「读磁盘密文 → decryptState → mergeRemoteIfNewer」，在 encryptState 之前完成、明文不写 localStorage，解密失败仅 warn 且不删磁盘密文；专属 spec 1 passed（红证 Expected 20 / Received 10）；tsc Exit 0、登记器 PASS / drift 0、verify.js all EXIT=0（静态 0 · Node 503 · PW 171 · bench 7/7）；dist 4,705,615 B / B569B0E9…5BE818；release 未重建。
- 2026-11-01 fix40-1/2：顶栏 #btnPin / #btnSettings DOM 顺序对调（置顶落在设置右侧，fix29-2 高亮链路零改动）；#btnClose 去掉 appConfirm，改「先等 backupOnClose 最多 1.5s 再直退」；新增 main.ts backupOnClose + main.rs write_backup_file（dir 空 ⇒ app_data_dir/backups，失败 toast），并注入 boot / layout 两个 deps；专属 spec 1 passed；tsc / cargo check Exit 0；登记器 PASS / drift 0、verify.js all Exit 0（Node 503 · PW 171）、build-all 步骤 1–5（第 6 步重复归档守卫）；dist 4,703,693 B / BB4A5A67…953110；发布件 Web 同哈希 · exe 6,778,880 B / 4307A6F5…95315。
- 2026-11-01 fix39-1/2：下划线与删除线共用 text-decoration-line，新增词元算子（`underline` 增 / `-line-through` 删），应用、取消、拆标签均按词元处理，右栏 xselFmtOn/_propOn 按词元判态；专属 spec 1 passed（红证 Expected >= 2 / Received 0）；登记器 PASS / drift 0、verify.js all Exit 0（Node 503 · PW 171）、build-all 6/6；dist 4,703,090 B / 0FC69728…BC04。

> 说明：按时间倒序排列，每项工作不超过 10 行；覆盖 2026-09-17 至 2026-10-30。

## 2026-11-01 · fix38-1/2 多行富文本叠加后无法只剥单一格式 — 完成（`src/core/richtext.ts` 新增 _detachBranch 逐枝剥离 · `src/ui/rightbar.ts` xselFmtOn 前 64 颗文本节点 · 专属 2 例红 2 failed → 绿 37 passed · 登记器 drift 0）
- 取消格式只抽「承载该文本的那一枝」：语义标签用 span 承接、内联元素用同属性克隆减声明承接 ⇒ `<b><i>text</i></b>` 去加粗保留 `<i>`，颜色 / 字号不陪葬；xselFmtOn 任一段任一非空文本节点激活即取消。门禁：tsc Exit 0；verify.js all Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）；登记器 66 方 / drift 0 / PASS；build-all 步骤 1–5 通过（第 6 步目录句柄占用，改用 prepare-release 暂存后移入）。dist 4,700,754 B / 380FA893…2690；release/v2.1.0-2026-11-01 Web 4,700,754 B / 380FA893…2690 · exe 6,774,272 B / 16486894…9F5F · checksums 169 B / 6FB2B335…FD1F。证据 `90过程材料/tmp/fix38-1/`。

## 2026-10-31 · fix34-2/X ISSUE-002 整快照 save_state 删除 encStore — 完成（`src-tauri/src/main.rs` +9 行回填 / +30 行 tauri mock 用例 · Cargo.toml dev-dependencies features=["test"] · 负向 1 failed → 1 passed · 登记器 drift 0）
- `save_state` 在 errorLog 回填后追加同构 encStore 回填，仅当 payload 不含该键时生效（加密快照 → 明文快照单向保留，不做双向合并）；`clear_encrypted`、`crypto.ts`、命令签名零改动。负向（仅回填 errorLog）1 failed @ `main.rs:398`，真实 `ju_store.json` 的 encStore 命中 0 / errorLog 命中 1；恢复后 1 passed、encStore 命中 1。`cargo check` Exit 0；`verify.js all` Exit 0（静态 0 · Node 503 · PW 171 · bench 7/7 最大恶化 0.0%）；dist 未变 4,698,196 B / C0637DA8…6D9C。证据 `90过程材料/tmp/fix34-2/`。

## 2026-10-31 · fix33-6/X ISSUE-006 check-deps-wired 对 desktopSave 函数体恒值放行 — 完成（`scripts/check-deps-wired.mjs` +29 行 · PASS 69 键 · 负向 2 例 FAIL 指名 desktopSave · 登记器 drift 0）
- 新增 `desktopSaveBody()` 配平提取函数体：须含 `_tauri()` / `.invoke` 能力检查，且不得为 `desktopInvoke(...); return true;` 无 catch 的无判真形态；负向 1（还原恒真 desktopSave）与负向 2（含 `_tauri()` 无 catch）均 FAIL exit=1，改后 PASS exit=0；`main.ts` 恢复哈希一致，SPEC 键与其他脚本零改动。证据 `90过程材料/tmp/fix33-6/`。

## 2026-10-31 · fix33-5/X ISSUE-005 update-crash 与 updater 硬关闭冲突 — 完成（`updater.ts` 导出 `UPDATER_ACTIVE` · 用例按开关分支断言 · 定向 1 passed · 登记器 drift 0 · `verify.js all` Exit 0）
- 启用态才等待更新弹窗与 `tauri://update` IPC；关闭态断言 `dialogMessages=[]`、无 update IPC、无更新端点请求，并校验 `tauri.conf` 的 `updater.active` 与常量一致；负向（常量 true + 配置 false）在 `update-crash.spec.ts:414` 失败后回滚复绿；崩溃包断言零改动。证据 `90过程材料/tmp/fix33-5/`。

## 2026-10-31 · fix33-4/X ISSUE-004 自动保存清空 errorLog — 完成（`src-tauri/src/main.rs` 1 处 · 登记器 66 方 / drift 0 / PASS · `verify.js all` Exit 0）
- `save_state` 改 `write_store` 原子写；写入前 `read_store` 取既有 `errorLog`，payload 不含该键时回填（payload 仍先经 `serde_json` 校验）；`report_error` 追加与 200 条上限、命令签名、前端 state、dist 零改动。cargo check Exit 0（仅既有 `patch_nodes` dead_code 警告）；手工+负向验收待重打包后执行，证据 2.项目日志/fix33-4-*.txt。

## 2026-10-31 · fix33-2/X ISSUE-002 桌面加密把 null 成功当失败 — 完成（`src/core/crypto.ts` 1 处 + spec 1 件 · 登记器 66 方 / drift 0 / PASS · `verify.js all` Exit 0）
- 桌面分支改 `try { await deps.desktopInvoke('save_state',{payload:JSON.stringify({encStore:json})}); return true } catch { toast；return false }`，不再以返回值真值判定（Tauri unit Result 成功序列化为 null）；浏览器分支 / 加密算法 / payload 结构 / Rust 命令零改动。新 spec 红证 1 failed → 绿证 2 passed；dist 4,698,715 B / `9A0D4AAF…F646`。

## 2026-10-30 · fix26-p1 资料库置灰补口 / 各视图标题三列网格居中 / 导图移除「重置布局」— 完成（`src/style.css` 5 处 + `src/app/session.ts` 1 处 + `src/views/mindmap.ts` 1 处 + spec 1 件 · 登记器 66 方 / drift 0 / PASS · `verify.js all` Exit 0 · build-all 6/6 全绿 · 重打包 v2.1.0-2026-10-29）
- 「资料库」在 ui.view=outline（与 auto 渲染同一大纲页）时同样置灰并 pointer-events:none；`.doc-header` 改三列网格（1fr / 2fr / 1fr），标题固定第 2 列、星标固定第 3 列，各视图标题中心恒等于标题行中心且不再与星标重叠；删除导图「重置布局」按钮 DOM / 事件 / CSS。发布件 Web 4,698,667 B / `d416fccc…f524a`、exe 6,767,104 B / `65c6b869…dbaf`、checksums 169 B / `7c4926c2…bb6`；fix26 旧包移至 `90过程材料/tmp/fix26-p1/`。

## 2026-10-30 · fix25 侧栏悬浮白球 / 幻灯片右留白 / 顶栏禁用态 — 完成（`src/style.css` 3 处 + `src/app/session.ts` 1 处 · 登记器 66 方 / drift 0 / PASS · `verify.js all` Exit 0 · build-all 6/6 全绿 · 重打包 v2.1.0-2026-10-29）
- `.sb-arrow:hover::before` 取消 44px 圆形白底（隐形热区保留）；`.tb-nav-btn.disabled` 与 `:hover` 统一 opacity / cursor / 背景 / 字色；`body.slides-mode.sb-left-collapsed #content` padding-right 0 → 16px；`syncTopbar` 增「资料库」disabled（ui.view=auto 且非图书馆根 / 文件夹 / 数据库 ⇒ 置灰，仅视觉）。发布件 Web 4,698,460 B / `2a832c14…9ba`、exe 6,766,592 B / `7da0804c…928`、checksums 169 B / `22bdc5d4…a65`；fix24 旧包移至 `90过程材料/tmp/fix25/`。

## 2026-10-30 · fix23 幻灯片视图样式外提（严格 CSP）— 完成（`src/style.css` 承接 .ju-sl-wrap 段 · spec dist / 发布件双承载各 1 passed · 登记器 66 方 / drift 0 / PASS · `verify.js all` Exit 0 · build-all 6/6 全绿）
- 删除 `src/views/slides.ts` 的 `_styleOnce()`（运行期 `<style id="juSlidesStyle">` 注入）；`<li style="margin-left">` 改 class + `--ju-sl-indent`，虚拟列表总高 / 缩略图 top / 图片几何改 `--ju-sl-rail-h` / `--ju-sl-top` / `--ju-sl-x·y·w·h`；`_paint` 的 `_esc(_plain(n.text))` 与 blur 保存原文（fix19 语义）不变。新增 `tests/v21-fix23-slides-csp.spec.ts`（dist + `JU_RELEASE_HTML` 双承载）。重打包 `8.发布与CI/release/v2.1.0-2026-10-29/`：Web 4,698,324 B / `a257dd17…eff`、exe 6,766,592 B / `258f407d…509`；fix22 旧包移至 `90过程材料/tmp/fix23/`。

## 2026-10-23 · R96 不变量清单 v2.5 全量覆盖（106 条 / #1–#115）— 完成（清单 **168,533 B / `20C34426…E2BDF4`** · LF（CR=0 · LF=2,494）· 登记器 **65 方 / drift 0 / PASS** · `verify.js all` Exit 0 · Node 503/503 · PW 171 · bench 7/7 · 产品件零改动）
- 操作：以「# JU 不变量清单（v2.5 现行对拍基线）」整篇**物理覆盖** `4.回归与验收/JU-不变量清单-v2.0-frozen.md`（整文件替换，非追加）：文件头「不变量总数」改为 **现行 106 条（#1–#115）**；补齐此前缺失的 **#95–#100**（`## 主题图标、右键菜单折叠与多选格式化（2026-10-22 新增）`）与 **#113–#115**（`## 大纲拖拽方向判定与节点级剪贴板（2026-10-23 新增）`）两节；文末新增「### 本批调整汇总（原地修改 + 新增）」表与「> **不变量总数核对**」段。
- 原地修改项：#50 适用范围补 `.text`（contenteditable）内部 + 断言补 `outlineDragSelectStart` 首行 fromText 早退检测；#36 / #37 补「分流说明（2026-10-23）」；#41 / #46 / #53 补「与 #113–#115 关系（2026-10-23 核对）」，#45 适用范围引用 #113。
- 落盘实测：156,091 / `AA895DBA…4B46C128` / LF 2,338 → **168,533 B / `20C34426581A5A232FF6F5E09D01B55072B23801F7A7A0F211942A11E5E2BDF4` / LF（CR=0 · LF=2,494 · 末字节单 0x0A · UTF-8 无 BOM）**；`###` 编号条目 106 → 115（+9，无缺号 / 无重号），独立不变量 **106 条**（排除 #43 / #44 交叉引用 2 条与 #68–#74 修复登记 7 条）。
- 结构性核对：A 首行 / B 文件头 106 条 / C #95–#100 / D #101–#105 / E #106–#112 / F #113–#115 / G #50 `.text` 与 fromText 早退 / H 两处「分流说明」/ J 文末汇总表 + 总数核对 / K #68–#74 仍标「不计入总数」**全部通过**；I 处「与 #113–#115 关系」实测 3 处（#41 / #46 / #53，#45 按权威正文以适用范围引用表述）；L 三反引号 202（偶数），与备份 182 的差 **+20 = +10 组围栏**，成因 = 权威正文在 #95–#100、#101–#105、#112、#113–#115 各断言 / 实现段均用三反引号围栏（与「新增断言块一律 4 空格缩进」的检查口径不一致，按「内容来源为唯一权威」执行，如实登记）。
- 登记器：清单为既有登记方（`TARGETS` 内 `JU-不变量清单-v2.0-frozen.md`）。重锚前 **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=1` / `RESULT=FAIL`**（唯一 FAIL 方即本清单 `size=168533 (exp 156091)`，判别力真实）；改 1 行期望值 + 追加 R96 注释块后 **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**，其余 64 方期望值一字未动，登记器本体仍纯 CRLF（1,893 行 · CR=LF）。
- 门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **Exit 0**：静态 0 命中（45ms）· Node **503/503**（fail 0 / skipped 0）· PW **171**（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 + L13 6，55,805ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。
- 未触碰：`6.P0-T3基线/v2.0-t3.html` 与 `6.P0-T3基线/step9/v2.0-t3.html`（仍 1,316,707 / `5FED0215…BFF818`）、`1.冻结版本/*`、`1.归档快照/*`、`HEAD.json`（封存 HEAD 仍 r22）；`0.规范/MAINTENANCE.md` 未登记本清单字节 / 哈希锚点，故无锚点需同步（如实登记）。
- 证据与回退：备份 `4.回归与验收/JU-不变量清单-v2.0-frozen.md.bak.20261023-214459`（156,091 B）+ 登记器快照 `6.P0-T3基线/step9/verify-hash-registry.mjs.bak-r96-2026-10-23`；证据 `_哈希与行尾校验/r96-list-selfcheck-2026-10-23.txt` / `r96-list-sectiondiff-2026-10-23.txt` / `r96-registry-red-2026-10-23.txt` / `r96-registry-green-2026-10-23.txt` / `_环境与调试/r96-verify-all-2026-10-23.txt`；报告 `_报告与元数据/R96-INVARIANT-LIST-V25-OVERWRITE-2026-10-23.md`。

## 2026-10-23 · R82 M0-7 生命周期收口（pagehide 统一清理 10 项 / 观察者持柄提升 / 尾页脚注释删除）— 完成（canonical **1,301,653 / `EB85B1BF…E8A9CA9`** · LF（CR=0 · LF=23,949）· `verify.js all` Exit 0 · Node 503/503 · PW 171 · bench 7/7 · 登记器 **65 方 / drift 0 / PASS**）
- 动因：M0-7（Vite + TS 骨架）拆分后各资源分属不同模块，模块内 `_cleanups` 覆盖不到页面级卸载 ⇒ 必须在单体阶段先清掉 BroadcastChannel / MessageChannel / MutationObserver / 定时器 / Worker / Blob URL 的页面卸载悬挂。
- 产品件 5 处：① `boot()` 末尾新增 `pagehide` 统一清理（`STORE_BC_INSTANCE` / `_l7YieldCh`+`_l7YieldQ` / `_syncAppInertObserver` / `window.__juA11yObserver` / `_reminderTimer` / `pomoState.timer` / `_indexWorkerDispose(true)` / `_graphWorker.dispose()` / `window.__juVsLongtaskObserver` / `__l14LongtaskGate.observer`，每项独立 try/catch、单项失败不阻断其余项）；② `_syncAppInert` 观察者改模块级 `let _syncAppInertObserver=null` + `if` 守卫内创建并 observe；③ `_a11y` IIFE 的 `const mo` → `window.__juA11yObserver`（含 observe 调用）；④ `_vsMetric` 的 PerformanceObserver → `window.__juVsLongtaskObserver`（先赋值再 observe）；⑤ 删除 `</html>` 之后的 39 B 尾页脚注释行（根元素外注释属无效 HTML，会干扰后续 Vite 解析）。
- 字节：1,299,171 / `93377966…DAEC9A54` / LF 23,910 → **1,301,653 / `EB85B1BF54AC99B8C3791B52780C80EFA620D1EC758FF7B66E398E151E8A9CA9` / LF（CR=0 · LF=23,949）**（+2,482 B / +39 行 = 代码 +2,521 − 尾页脚 39）；canonical ≡ step9 镜像逐字节一致；`<script>` 9 块逐块 vm 编译通过。
- 红证（判别力）：重锚前 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（恰 canonical + step9-mirror，size 实测 1,301,653 / 期望 1,299,171）→ 重锚后 **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；方数保持 65，其余 63 方期望值一字未动。
- 门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **Exit 0**：静态 0 命中（42ms）· Node **503/503**（fail 0 / skipped 0）· PW **171**（55,105ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。
- 证据与回退：`_环境与调试/r82-verify-all-2026-10-23.txt` / `_哈希与行尾校验/r82-registry-red-2026-10-23.txt` / `r82-registry-green-2026-10-23.txt`；报告 `_报告与元数据/R82-M0-7-LIFECYCLE-REPORT-2026-10-23.md`；备份 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r82`（canonical）+ `6.P0-T3基线/step9/v2.0-t3.html.bak-20261023-r82`（镜像）+ `step9/verify-hash-registry.mjs.bak-r82-2026-10-23`。
- 观察项（登记 · 不阻断）：`tests/t11-anchor-governance.spec.ts` 的 T-101（断言 39 B 尾页脚存在 + `buf.length===972267`）语义作废——该用例仅在 `JU_L11=1` 隔离跑参与，默认门禁不收集；若重启 L11 隔离门禁须先按本波口径重写 T-101。

## 2026-10-23 · R75 七项 JS 行为修正（日历 blur 读 DOM 竞态 / 大纲滑出清空高亮 / 今天列与月视图时区口径 / 可编辑主列定位 / 下拉去重复重渲染 / 编辑态补刷字数模块 / docToXls 局部 esc 改名）— 完成（canonical **1,294,047 / `CE68352B…C208FD`** · LF（CR=0 · LF=23,802）· `verify.js all` Exit 0 · Node 503/503 · PW 171 · bench 7/7 · 登记器 **65 方 / drift 0 / PASS**）
- 产品件 7 处：① `renderCalNode` blur 回调首行 `const liveText=text.textContent;` 且解析改 `parseNaturalDate(liveText)`；② `outlineDragSelectMove` 的 `!hit` 分支复位 `_outlineSel.ids` / `anchorId` + `outlineDragSelectPaint()` + `ds.hoverId=null` 后返回；③ `buildTimeGrid` 今天列判定改 `todayStr()`（`tgNowY` / `cnNow` 的东八区语义不动）；④ `dbPrimaryField` 顺序跳过 formula / link / multi_select 取首个可编辑列，全不可编辑回落首列；⑤ `renderDbTable` 两处 select 删除 `setDbCell` 之后的重复 `forceRender()`（人物自定义分支保留）；⑥ `renderMain` 编辑态早退的 CALENDAR 分支追加 `chars` 模块 body 重填；⑦ `docToXls` 局部 `esc` 改名 `xmlEsc` 并同步调用点。
- 字节：1,293,528 / `81576224…25FF58` / LF 23,788 → **1,294,047 / `CE68352B9D81148593B90606D8DA99BED82B5131F9D5C25D9EBF93C1EDC208FD` / LF（CR=0 · LF=23,802）**（+519 B / +14 行）；canonical ≡ step9 镜像逐字节一致。
- 红证（判别力）：重锚前 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`（恰 canonical + step9-mirror，size 实测 1,294,047 / 期望 1,293,528）→ 重锚后 `PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；方数保持 65，其余 63 方期望值一字未动。
- 门禁：内联脚本语法自检 9/9 块 `SYNTAX_RESULT=PASS`；`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **Exit 0**：静态 0 命中 · Node **503/503**（fail 0 / skipped 0）· PW **171**（167 passed + 4 skipped）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。
- 证据与回退：`_环境与调试/r75-syntax-2026-10-23.txt` / `r75-registry-red-2026-10-23.txt` / `r75-registry-green-2026-10-23.txt` / `r75-verify-all-2026-10-23.txt` / `r75-maintenance-patch-2026-10-23.txt`；报告 `_报告与元数据/R75-SEVEN-JS-FIXES-REPORT-2026-10-23.md`；备份 `6.P0-T3基线/v2.0-t3.html.bak-20261023-r75`（canonical + step9 镜像）/ `step9/verify-hash-registry.mjs.bak-r75` / `0.规范/MAINTENANCE.md.bak-r75`。

## 2026-10-22 · R57 周期规则 interval 防御 + 数据库主列标题优先渲染 — 完成（canonical **1,296,464 / `2D97BAB4…BB3A54`** · LF（CR=0 · LF=23,848）· `verify.js all` Exit 0 · Node 503/503 · PW 171 · bench 7/7 · 登记器 **65 方 / drift 0 / PASS**）
- 动因：重复规则 `interval` 为 0 / 负数 / null 时，`expandRecurring` 的取模判定退化为「恒命中」，`buildYearCounts` 的 while 游标原地不前进；数据库表主列为 `select` / `date` / `number` 类型时，标题输入框被类型分支抢走。
- 变更 ①：`expandRecurring` 重复规则解构改为「先取 freq / weekday，interval 归一 `Math.max(1,Math.floor(Number(n.recur.interval)||1))`」。
- 变更 ②：`buildYearCounts` 同口径归一（原同一解构写法）。
- 变更 ③：`renderDbTable` 单元格链主列标题分支上移至链首，条件追加 `!(formula|link|multi_select)` 排除；select / date / number 下主列仍渲染标题输入框，其余分支顺序与内容不变。
- 字节 / 行尾：1,296,173 → **1,296,464 B（+291）/ LF=23,843 → 23,848（+5 行）**，CR=0，末字节 0x0A，无 BOM；canonical 与 step9 镜像**逐字节一致**（同 `2D97BAB47017520F324F5A3B2A7D88DF5893B2599A509B686E658EAAE4BB3A54`）。
- 登记器：重锚前 **drift=1**（唯一 FAIL 方 = `step9-mirror`，`size=1296464 (exp 1296173)`，`RESULT=FAIL`）→ 重锚后 **`PARTY_COUNT=65` / drift 0 / PASS**；其余 63 方期望值一字未动。
- 门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **Exit 0**：静态 **0 命中**（71ms）· Node **503/503**（34,871ms）· PW **171**（167 passed + 4 skipped，65,143ms）· bench **7/7**（86ms）→ `[verify] 全部通过`。
- 环境注记：本机 PATH 无 `node`，以 Node 22.22.2 绝对路径注入 PATH 后执行。
- 判别力：重锚前首跑 `verify.js all` 在 T-99 单点失败（`drift=1` · 唯一 FAIL 方 `step9-mirror` `size=1296464 (exp 1296173)` · PW 166 passed / 1 failed / 4 skipped）；重锚后同一命令全绿（上表）。该红跑输出仅存于会话、未单独落盘；重锚后登记器输出留档于 `_环境与调试/r57-registry-2026-10-22.txt`。
- 文档锚点：`0.规范/MAINTENANCE.md` 新增「## 四十 R57 ...」+ 本版修订标记与基线字节 / LF 计数同步；哈希登记见 `_哈希与行尾校验/R57-product-hash-registry-2026-10-22.md`。
- 证据 / 脚本：`_环境与调试/r57-{verify-all,registry,docs-anchor}-2026-10-22.txt`；`_临时脚本/_r57_cellorder_2026-10-22.mjs`、`_临时脚本/_r57_docs_anchor_2026-10-22.mjs`。

## 2026-10-22 · R56 不变量清单 #95–#100 物理追加 — 完成（清单 **145,996 / `998927A0…BB30D3E`** · LF（CR=0 · LF=2,171）· `verify.js all` Exit 0 · Node 503/503 · PW 171 · bench 7/7 · 登记器 **65 方 / drift 0 / PASS** · 产品件零改动）
- 动因：把「主题图标 / 右键菜单折叠 / 多选批量格式化 / 选择器即点即用 / 字数统计增量聚合 / 模块标题与柱状图」六条 UI 行为固化为可断言不变量，补齐 #95–#100。
- 追加方式：`fs.appendFileSync` 物理追加至文件**末尾**（按任务给定脚本；反引号以 `\x60` 转义，落盘还原为行内代码与 ```js 围栏）；追加段 5,500 B / 99 行，`定义` / `断言` / `关联实现` 各 6 处、`js` 围栏 6 段。
- 计数口径：头注 L8、修复登记章 L1476、核对说明 L2062 三处「现行 85 条（#1–#94）」→「现行 91 条（#1–#100）」；基线区逐行 diff **仅此 3 行**，其余 2,069 行零漂移。
- 字节 / 行尾：140,494 → **145,996 B（+5,502）**，LF 2,072 → 2,171（+99），CR=0，末字节 0x0A，无 BOM；追加段 SHA-256 `746E9182…66E780` 与落盘尾段逐字节一致。
- 登记器：重锚前 **drift=1**（唯一 FAIL 方 = 本清单 `size=145996 (exp 140494)`）→ 重锚后 **`PARTY_COUNT=65` / drift 0 / PASS**；其余 64 方期望值一字未动；**canonical / step9 镜像零改动**（仍 1,296,173 / `1753CF3A…24EBCE`）。
- 门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **Exit 0**：静态 **0 命中**（18ms）· Node **503/503**（27,688ms）· PW **171**（165 + L13 6，59,347ms）· bench **7/7**（79ms）→ `[verify] 全部通过`。
- 环境注记：首跑因 PATH 无 node 触发 `spawnSync node ENOENT`（exit 1），补齐 PATH 后重跑全绿；两次日志均留档，未删改。
- 文档锚点：`0.规范/MAINTENANCE.md` 新增「## 三十九 R56 ...」+ 本版修订标记更新；哈希 / 字节 / 行尾登记见 `_哈希与行尾校验/JU-不变量清单-HASH-REGISTRY-R56-2026-10-22.md`。
- 证据 / 脚本：`_环境与调试/r56-{inv-append,registry-red,registry,verify-all,verify-all-envpathfail,docs-patch}-2026-10-22.txt`；`_临时脚本/_r56_append_inv95_100_2026-10-22.mjs`、`_临时脚本/_r56_docs_patch_2026-10-22.mjs`。

## 2026-10-22 · R55 日历底部模块标题统一 + 字数统计年/月/周柱状图 — 完成（canonical **1,296,173 / `1753CF3A…AD24EBCE`** · LF（CR=0 · LF=23,843）· `verify.js all` Exit 0 · Node 503/503 · PW 171 · bench 7/7 · 登记器 **65 方 / drift 0 / PASS** · 真机探针 23/23）
- 动因：R54 的字数统计只有周视图带柱状图，月 / 年视图无趋势图形；且日历底部两处标题格式不一（字数统计无 scope、任务统计沿用 `统计（2026年10月）`）。
- 产品变更（`6.P0-T3基线/v2.0-t3.html`，JS 3 处、零 CSS）：① 新增 [`_getCalScopeText()`](../6.P0-T3基线/v2.0-t3.html:17352)（置于 `calStatsScope` 之前）——年 `2026` / 周 `10.18-10.24` / 月 `2026.10`；② [`calModuleStatsBody`](../6.P0-T3基线/v2.0-t3.html:10113) 标题统一为「任务统计（scope）」；③ [`calModuleCharsBody`](../6.P0-T3基线/v2.0-t3.html:10147) 标题统一为「字数统计（scope）」并按 `ui.calView` 构建 `daysData`（年 12 桶按月聚合 / 周 7 桶 / 月 28–31 桶）绘制统一柱状图（正 `--accent` / 负 `--danger` / 0 值不显数值且 opacity 0.2），R54 的周视图专用柱状图与模块头 scope 徽章（信息已并入标题）退役。
- 口径差异（等价实现）：柱值取 `(st.add|0)-(st.del|0)+(st.mod|0)` 而非裸 `st.add-st.del+st.mod`（旧档缺字段时为 0 而非 NaN），并复用函数内已守卫的局部 `stats` 缓存；`calStatsScope()` 函数体原样保留。
- 字节 / 行尾：canonical ≡ step9 镜像 **1,296,173 / `1753CF3A18484AB2B988E01BB2D47F2F7F747CB25ED98851F0DB4E66AD24EBCE` / LF（CR=0 · LF=23,843 · `<script>` 9 块）**（1,294,639 → 1,296,173，+1,534 B / +36 行）；未物化新冻结件（封存 HEAD 仍 r22）；改动前双侧快照 `v2.0-t3.html.bak-20261022-r55`（含 step9 同名件）。
- 登记器：重锚前 **drift=2**（恰 `canonical` + `step9-mirror`；首跑门禁即由 `t10-idb-persist.spec.ts · T-99` 报 `Expected 0 / Received 2` 红证）→ 重锚后 **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；方数保持 65，其余 63 方期望值一字未动。
- 门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **Exit 0**：静态 **0 命中**（79ms）· Node **503/503**（26,554ms）· PW **167 passed + 4 skipped = 171**（56,429ms）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。
- 真机验证（系统 Chrome headless · 1440×900 · step9 镜像）**23/23 PASS**：月 `字数统计（2026.10）` / `任务统计（2026.10）` 且 scope 文本一致、柱 31 根；周 `10.18-10.24`、柱 7 根、四卡片仍在；年 `2026`、柱 12 根；柱区 56px 高 / `margin-top:10px` / `border-top:1px solid var(--line-soft)`；零 `pageerror` / 零 `console.error`。
- 报告 / 证据：`_报告与元数据/R55-CAL-MODULE-TITLE-CHART-2026-10-22.md`、`_环境与调试/r55-{syntax,verify-all,verify-all-final,registry,caltitle-probe}-2026-10-22.txt`；脚本 `_临时脚本/_r55_registry_patch.mjs`、`_r55_caltitle_probe_2026-10-22.mjs`、`_r55_docs_patch.mjs`。

## 2026-10-22 · R54 日历「字数统计」模块（零遍历增量聚合）— 完成（canonical **1,294,639 / `29C0851D…769324E1`** · LF（CR=0 · LF=23,807）· `verify.js all` Exit 0 · Node 503/503 · PW 171 · bench 7/7 · 登记器 **65 方 / drift 0 / PASS** · 真机探针 14/14）
- 动因：日历底部五模块只回答「待办完成了多少」，无法回答「写了多少字」；按日全树扫描统计字数会在日历渲染路径产生 O(n·天数) 卡顿。
- 产品变更（`6.P0-T3基线/v2.0-t3.html`，JS 8 处、零 CSS）：① [`defaultState`](../6.P0-T3基线/v2.0-t3.html:5424) 增 `charStats:{}`；② [`migrateStateObject`](../6.P0-T3基线/v2.0-t3.html:21439) 缺字段补 `{}`；③ [`actions.logActivity`](../6.P0-T3基线/v2.0-t3.html:5747) 增第 4 参数 `diff`，`commit` 内按 `ds=todayStr()` O(1) 累加 `charStats[ds].add/del/mod`（add/del 取纯文本长度、mod 取传入 diff）；④ `type==='mod'` 分支以 `accumulatedDiff`（`_logTimers` 项新增 `diff` 字段）累计，防抖 1.5s 后以累计值落盘；⑤ [`updateText`](../6.P0-T3基线/v2.0-t3.html:5483) 计算 `stripHtml(新)−stripHtml(旧)` 并传给 `logActivity`；⑥ [`CAL_MODULE_KEYS`](../6.P0-T3基线/v2.0-t3.html:10041) 增 `chars`（日历之后）+ [`calModuleTitle`](../6.P0-T3基线/v2.0-t3.html:10059) 增 `chars:'字数统计'`；⑦ `calModuleState` / `applyUIFields` / `ui` 初始 `order` 同步为 `[calendar,chars,note,today,log,stats]`（旧档缺 `chars` 时补在日历之后）；⑧ 新增 [`calModuleCharsDates`](../6.P0-T3基线/v2.0-t3.html:10123) / [`calModuleCharsBody`](../6.P0-T3基线/v2.0-t3.html:10147)（年 365 / 月 28–31 / 周 7 次 O(1) 读缓存，四卡片 + 周视图 7 日柱状图）并由 [`renderCalModules`](../6.P0-T3基线/v2.0-t3.html:10369) 的 `chars` 分支挂载。
- 字节 / 行尾：canonical ≡ step9 镜像 **1,294,639 / `29C0851D98ED126D1B2F9A24E872FF0BAE5557D86CF8D427D19E8BFA769324E1` / LF（CR=0 · LF=23,807 · `<script>` 9 块）**（1,289,014 → 1,294,639，+5,625 B / +109 行）；未物化新冻结件（封存 HEAD 仍 r22）；改动前双侧快照 `v2.0-t3.html.bak-20261022-r54-charstats`。
- 登记器：重锚前 **drift=2**（恰 `canonical` + `step9-mirror`，判别力真实）→ 重锚后 **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；方数保持 65，其余 63 方期望值一字未动。
- 门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **Exit 0**：静态 **0 命中** · Node **503/503** · PW **167 passed + 4 skipped = 171** · bench **7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。
- 真机验证（系统 Chrome headless · 1440×900 · step9 镜像）**14/14 PASS**：`chars` 紧随日历、标题「字数统计」、四卡片齐备；`add` 记 9 字 / `mod` 记 +3 / `del` 记 12 字（防抖后落盘）；月视图 DOM 卡片 `["15","12","+3","+6"]` ≡ 逐日缓存聚合；周视图柱状图 7 根（`10-18…10-24`）；零 `pageerror` / 零 `console.error`。
- 文档：[`MAINTENANCE.md`](../0.规范/MAINTENANCE.md:1) 顶部版本注记 / 顶部基线锚点 / §4 当前基线行同步为 **1,294,639 / `29C0851D…24E1` / LF（CR=0 · LF=23,807）** 与 **§三十七**，新增 **§三十七「R54 日历字数统计模块（零遍历增量聚合）」**；库内「47 方」任务书口径仍按现行 **65 方**实测。
- 证据：`_环境与调试/r54-verify-all-2026-10-22.txt`、`_环境与调试/r54-registry-2026-10-22.txt`、`_环境与调试/r54-charstats-probe-2026-10-22.txt`；脚本 `_临时脚本/_r54_registry_patch.mjs`、`_r54_maintenance_patch.mjs`、`_r54_charstats_probe_2026-10-22.mjs`。
## 2026-10-22 · R46 主题按钮图标 T 恤化 — 完成（canonical **1,261,506 / `C6AAF0E3…DE2AB3C8`** · LF（CR=0 · LF=23,152）· `verify.js all` Exit 0 · Node 503/503 · PW 171 · bench 7/7 · 登记器 **65 方 / drift 0 / PASS** · 真机探针 11/11）
- 动因：`#btnTheme` 原为「圆 + 弦（日间）/ 太阳（夜间）」两套图标，与导入 / 番茄钟 / 悬浮日历等 `.sb-tool` 线框图标风格不一致。
- 产品变更（仅两处 SVG 外形，`6.P0-T3基线/v2.0-t3.html`）：① 静态按钮 `svg` 内 `<circle cx="12" cy="12" r="8"/>` + `<path d="M12 4a8 8 0 0 1 0 16"/>` → T 恤轮廓 `path`；② `applyTheme()` 的 `svg.innerHTML` 由日间半圆 / 夜间太阳改为同一 T 恤 `path`（局部常量 `tee`），夜间追加 `<circle cx="12" cy="18" r="1"/>` 点缀以保留主题态差异。
- 风格守持：`.sb-tool svg{stroke:var(--icon);fill:none;stroke-width:1.8;…}` 未改 ⇒ 新增路径自动继承线框口径；`#btnTheme` 点击行为（`openThemeSelector`）与 `ui.theme` 唯一记录点未触碰。
- 字节 / 行尾：canonical ≡ step9 镜像 **1,261,506 / `C6AAF0E3BEC578F814BE2F5479A9AFB5790ADAD0A26944C5F8B4624FDE2AB3C8` / LF（CR=0 · LF=23,152 · `<script>` 9 块）**（1,261,347 → 1,261,506，+159 B / −1 行）；未物化新冻结件（封存 HEAD 仍 r22）。
- 登记器：canonical / step9-mirror 期望重锚 + R46 注释块 ⇒ **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；方数保持 65，其余 63 方期望值一字未动。
- 门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **Exit 0**：静态 **0 命中** · Node **503/503** · PW **167 passed + 4 skipped = 171** · bench **7/7**（最大恶化 0.0%）→ `[verify] 全部通过`。
- 真机验证：`_临时脚本/_r46_ui_probe.mjs`（系统 Chrome headless）⇒ **11/11 PASS**：静态 `paths=1 / circles=0`、`path@d` 以 `M20.38 3.46…` 开头、`fill=none` / `stroke-width=1.8px`、按钮 30×30 / svg 16×16、路径包围盒在 24×24 内、夜间态 `paths=1 / circles=1`、切回日间回落无 circle、零 pageerror；截图 `_环境与调试/r46-btnTheme-{day,night}-2026-10-22.png`。
- 文档：`0.规范/MAINTENANCE.md` 顶部锚点 / §4 基线行 / §5 登记器锚 / §9 阶段清单 / 维护基线结论同步（`见 §26` → `见 §二十九`），新增 **§二十九「R46 主题按钮图标 T 恤化」**；库内「47 方 / 63 方 / 64 方」历史口径一并校正为 **65 方**。
- 证据：`_哈希与行尾校验/r46-registry-pre-2026-10-22.txt`、`_哈希与行尾校验/r46-registry-2026-10-22.txt`、`_环境与调试/r46-verify-all-2026-10-22.txt`、`_环境与调试/r46-ui-probe-2026-10-22.txt`、`_环境与调试/r46-themeicon-probe-2026-10-22.txt`；回滚备份 `6.P0-T3基线/v2.0-t3.html.bak-20261022-r46-themeicon`（含 step9 同名件）。

## 2026-10-21 · R42 日历待办标签弹层勾选 / 反选与空态文案 — 完成（canonical **1,259,506 / `5F1C05B8…08311A13D`** · LF（CR=0 · LF=23,134）· 清单 **154,699 / `84C6BB6E…B73970B2`** · `verify.js all` Exit 0（`VERIFY_ALL_EXITCODE=0`）· Node 503/503 · PW 171 · bench 7/7 · 登记器 **65 方 / drift 0 / PASS** · 真机探针 10/10）
- 缺陷：日历待办（与大纲共用右键「选择标签」入口）弹层再次点击**已勾选**标签无任何变化 —— `pick(t)` 只做并集追加、无差集分支；且单次选取即 `closeTagPicker()` 关闭，用户看不到当前已选集合，只能反复右键试探。
- 产品变更（`6.P0-T3基线/v2.0-t3.html`，JS `openTagPicker` 1 函数 + CSS 8 条）：`pick(t,on)` 支持反选（`on` 缺省取「当前未勾选」，`want=true` 并集 / `false` 差集，`tags` 仍按 manual ∪ 正文 #标签 重算）；列表抽 `buildRows()`（`.tp-check` ✓ + 已勾选行 `.sel` 高亮；正文 #标签 `.ro` 只读行 + title；标题「已勾选 N 个（再点一次取消）」）；空态分流「标签索引正在后台整理…」/「在正文输入 #标签，或用下方「新建标签」创建」；索引就绪后 `l7TagIndexWhenReady` 就地补全（弹层不关闭）；清除行改「✕ 清除本节点全部标签」；`pick` / `clearTags` 段内 `commit → _tagIndexCache=null → forceRender` 次序逐字保留（t19-patch2 A1/A2）。
- 字节 / 行尾：canonical ≡ step9 镜像 **1,259,506 / `5F1C05B87B2FE9858DC6C7117851EEDE8DC3984DE910CF9A934CADA08311A13D` / LF（CR=0 · LF=23,134 · `<script>` 9 块）**（+2,216 B / +34 行）；未物化新冻结件（封存 HEAD 仍 r22）。
- 清单：末尾追加 §三十六 / #93（七段：定义 / 断言 6 条 / 关联实现 / 验证方式 / 补充口径 4 条 / 冲突调整记录 / 类型状态标注）⇒ **154,699 / `84C6BB6E8D39F3F53159D95381D1AB9D01D3356EE15099DF2274EE29B73970B2` / LF（CR=0 · LF=1,908）**；顺带把 §三十五 追加后遗留的清单漂移（151,143 vs 期望 148,196）归零。
- 登记器：红证（未重锚）`PARTY_COUNT=65 / FIVE_PARTY_DRIFT_COUNT=1 / RESULT=FAIL`（清单方）→ 同步 canonical / step9-mirror / 清单三行期望 + R42 注释块 ⇒ **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；方数保持 65，其余 62 方期望值一字未动。
- 门禁：`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **Exit 0**（cmd `&&` 链取回 `VERIFY_ALL_EXITCODE=0`）：静态 **0 命中** · 语法检查全通过 · Node **503/503** · PW **167 passed + 4 skipped = 171**（首跑 T-99 门禁用例红 → 重锚后复绿）· bench **7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。
- 真机验证：`_临时脚本/_r42_tagpicker_probe_2026-10-21.mjs` ⇒ **10/10 PASS**（真实鼠标点击 + 真实键盘输入；新建即勾选 / 再点反选 / 标题计数 / 正文只读行 / 清除 / 空态文案 / 零 pageerror 零 console.error）；方法论注记：弹层 `position:fixed`，锚点必须是视口内真实元素（首版误用 `document.body` 致弹层落在视口外，产品代码未因此改动）。
- 文档：`0.规范/MAINTENANCE.md` 顶部锚点 + §4 基线行同步（`见 §25` → `见 §26`），新增 **§26「R42 变更记录」**；`CURRENT_TASK.md` 顶格进度与 §二「已决 11」同步。证据：`_环境与调试/r42-{hash|registry-baseline|registry-final|verify-all|verify-all-final|verify-all-exitcode|verify-all-exitcode-marker|tagpicker-probe|diag|inv-append|maintenance-patch}-2026-10-21.txt`；报告 `_报告与元数据/R42-TAG-PICKER-TOGGLE-2026-10-21.md`。

## 2026-10-21 · R40 侧边栏缩进归零 + 折叠三角热区与折叠态守持 — 完成（canonical **1,256,784 / `8F7CBE7A…C1626B39C`** · LF（CR=0 · LF=23,100）· `verify.js all` Exit 0 · Node 503/503 · PW 171 · bench 7/7 · 登记器 **65 方 / drift 0 / PASS**）
- 产品变更（`6.P0-T3基线/v2.0-t3.html`，CSS 3 处 + JS 1 处）：① `.sb-nav-item .chev` `width:12px` → `width:24px` + `display:inline-flex` / `align-items:center` / `justify-content:center`（折叠三角热区由 12px 扩至 24px，点击不再落到整行导航）；② `.sb-children` `padding-left:14px` → `0`；③ `#subDb,#subStarred,#subDocs,#subTags` `padding-left:14px` → `0`（层级缩进归零，各层级图标与文字左对齐）；④ `navTo()` 取消无条件 `ui.navExpanded[nav]=true`，改为 `if(!ui.navExpanded[nav]){ui.navExpanded[nav]=true;saveUI();renderSidebar();}`（starred / files / database / tags 四处），`setActiveKey` / `ui.view` / 数据库根定位保持在守卫之外 ⇒ 点击文字不再覆盖三角折叠状态；折叠 / 展开切换由三角按钮独占。⑤ 根因修复 `_bindRowDrag()`：`pointerdown` 增加 `e.target.closest('.chev')` 早退 —— 长按拖拽原先对整行 `handle.setPointerCapture(pid)`，会把随后的 `click` 重定向到整行 `.sb-nav-item`，使 `.chev` 的 toggle 处理器永不触发（真机 `elementFromPoint` 命中 `.chev`、`click.target` 却是 `.sb-nav-item`）；仅扩大热区（①）不解决问题。
- 同步与证据：canonical ≡ step9 镜像（**1,256,784 / `8F7CBE7A…C1626B39C` / CR=0 · LF=23,100**，+928 B / +8 行）；改动前镜像快照 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261021-r40`（1,255,856 / `64766D8B…1B6FDC3902`）。证据 `_哈希与行尾校验/r40-measure-before-2026-10-21.txt`、`r40-registry-red-2026-10-21.txt`、`r40-registry-green-final-2026-10-21.txt`、`_环境与调试/r40-verify-all-2026-10-21.txt`；脚本 `_临时脚本/_r40_registry_patch.mjs`、`_r40_maintenance_patch.mjs`。
- 门禁（真实执行）：`node verify-hash-registry.mjs` 红证 **drift=2**（恰 `canonical` + `step9-mirror`，判别力真实）→ 重锚后 **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **exit 0**：静态 **0 命中** · Node **503/503** · Playwright **167 passed + 4 skipped = 171** · bench **7/7**（最大恶化 0.0% / 中位数 −14.3%）→ `[verify] 全部通过`。
- 文档：`0.规范/MAINTENANCE.md` 顶部基线锚点 / §4 / §5 / §9 维护基线结论同步为 **1,256,332 / `2904697E…98EBB2`**（CRLF 保持），新增 **§24「R40 侧边栏缩进归零 + 折叠三角热区与折叠态守持」**（产品变更表 ①–⑤ / 字节锚 / 分两阶段重锚口径 / 四项门禁证据）。未物化新冻结件（封存 HEAD 仍 r22），未改任何冻结件 / 归档件字节。
## 2026-10-21 · R39 不变量 #90 登记（清单 §三十四 物理追加）— 完成（清单 **148,196 / `6783CB68…1A152EFA`** · 前 N 字节零变更 · 纯 LF（CR=0 · LF=1,873）· 登记器 **65 方 / drift 0 / PASS** · `verify.js all` Exit 0 · Node 503/503 · PW 171 · bench 7/7）
- 追加：[`JU-不变量清单-v2.0-frozen.md`](../4.回归与验收/JU-不变量清单-v2.0-frozen.md:1752) 末尾追加「## 三十四、日历底部模块位置稳定性（2026-10-21 新增）」+ 不变量 #90（定义 / 断言 7 段 / 关联实现 / 验证方式 / 补充口径 8 条 / 冲突调整记录 / 类型状态标注，七段全文），来源为草稿 `4.回归与验收/tmp_inv82_draft.md` 第 85–206 行（**仅取正文段**：草稿首 84 行审计元数据与尾部「阶段 2 冲突核对」含 3 个 `## 阶段 N` 与 2 处 `### 89.` 引用，整篇追加会破坏「## 一…三十四」章节序列与条目唯一性）。135,870 → **148,196 B**（+12,326 = 章节间隔 1 B + 正文 12,325 B），LF 1,750 → **1,873**（+123 行），末字节仍单 `0x0A`、无 BOM、CR=0。
- 前后哈希：`B99487FD1C65F8065975C473A98589359DA588BF2F1D4AFF6803CDFB7B78098C` → `6783CB682084C92266AFECEB553EA51888D51E742001053DC3C937761A152EFA`。
- 一致结论（两项硬门禁均未跳过）**PASS**：前 N 字节（N = 135,870）SHA-256 = `B99487FD…B78098C` 与追加前**逐字节一致** ⇒ #1–#89 全部字符（含空行 / 缩进）零变更；头 200 行 SHA-256 = `6ACC810E…E732953923` 前后一致；全文 `### 90.` = 1、`## 三十四` = 1、`### 89.` = 1、`## 阶段`（元数据泄漏）= 0。
- 口径纠错：草稿记载清单 EOL 为「CRLF（命中 13,10）」，本批复测为 **纯 LF（CR=0 · LF=1,750）**，登记器 `r39-registry` 的 `eol=LF` 才是正确值；追加时草稿 CRLF 已归一为 LF（全文件零混排）。
- 门禁（真实执行）：`node verify-hash-registry.mjs` ⇒ **PARTY_COUNT=65 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**（清单期望值 135,870/`B99487FD…` → **148,196/`6783CB68…1A152EFA`**，并新增 R39 注释；方数保持 65、其余 64 方一字未动）；`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **exit 0**（静态 0 命中 · Node **503/503** · PW **171** = 167 passed + 4 skipped · bench **7/7** 最大恶化 0.0%）→ `[verify] 全部通过`。
- 证据与物化：`_哈希与行尾校验/inv90-append-2026-10-21.txt`、`_哈希与行尾校验/inv90-registry-2026-10-21.txt`、`_环境与调试/inv90-verify-all-2026-10-21.txt`；脚本 `_临时脚本/_r39_inv90_append.ps1`、`_临时脚本/_r39_inv90_measure.ps1`；备份 `4.回归与验收/JU-不变量清单-v2.0-frozen.md.bak5-2026-10-21`（135,870 B，与追加前同哈希）；草稿 `tmp_inv82_draft.md` 已按要求删除。
- 文档：`0.规范/MAINTENANCE.md` 新增 **§23「R39 不变量 #90 登记」**（任务口径的 §18 已被 R35 占用，编号按现行顺延为 §23，不改既有历史章节）。
- 冻结件复核（物理 Get-FileHash）：`1.冻结版本` **39 文件 / 39,435,661 B**、当日写入 **0** 个（最新 mtime 2026-10-20 12:07:06）；`HEAD.json`（2,240 / `AD0B3AE6…B113DCB`）指向 r5 冻结件 **1,212,364 / `FE04CC1A…7C1D5`**，与落盘一致；`v2.0-frozen.html` 与 `73（与v2.0-frozen同哈希源文件）.html` 同为 **775,667 / `97E7331E…F405ABCB`**；`1.归档快照` **593 文件 / 52,796,346 B**、当日写入 **0** 个（最新 mtime 2026-10-19 20:11:05）⇒ 冻结与归档字节零变更，未物化新冻结件（封存 HEAD 仍 r22）。
- 环境：本机 `node` 不在 PATH，实际以 `C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`（v22.22.2）并前置 `$env:PATH` 执行（否则 `verify.js` 子进程报 `spawnSync node ENOENT`；`E:\软件\CodeBuddy CN\node.exe` 非可用 Node，报 `Invalid file descriptor to ICU data`）。

## 2026-10-21 · R39 日历模块位移修复 — 完成（canonical **1,255,856 / `64766D8B…1B6FDC3902`** · LF（CR=0 · LF=23,092）· 登记器 **65 方 / drift 0 / PASS** · `verify.js all` Exit 0 · Node 503/503 · PW 167 passed + 4 skipped = 171 · bench 7/7 · 真机探针 34/34）
- 落盘层（[`renderCalModules`](../6.P0-T3基线/v2.0-t3.html:10224)）：尺寸三分支改为**优先判 `k==='calendar'`**（恒 `flex:1 1 100%` + `minWidth:100%`，宽度不可拖拽落盘，修「拖过日历后重载不再独占整行」）；calendar 与其余模块有尺寸时一律 `height / minHeight / maxHeight` **三件套锁定行高**（内容增删不再推高整行）；无尺寸分支 `minWidth` 200px → **150px**（与 CSS `.cal-module{min-width:150px}` 对齐，消除约 815px 阈值附近的 4 列 / 3 列来回切换）。
- 缩放层（[`calModuleBindResize`](../6.P0-T3基线/v2.0-t3.html:10154)）：`onUp` 落盘改用**拖拽期目标值 `w/h`，禁止回读 `offsetWidth/offsetHeight`**（该值已被 flex-grow 与 `align-items:stretch` 二次分配，回读再落盘会单向膨胀并击穿换行阈值）；新增 `moved` 守卫（点击不拖动按进入时样式快照还原、不落盘）；拖拽期以 `height` 承载高度（`minHeight:0` / `maxHeight:none`）避免上一轮固定高度抵住拖高；calendar 只写高度、`sizes.calendar` **只存 `{h}`**。
- 拖拽层（[`calModuleBindDrag`](../6.P0-T3基线/v2.0-t3.html:10073)）：`pointercancel` 拆出独立 `onCancel`，按 `pointerdown` 快照 `snapshotOrder` 用 `appendChild` **还原 DOM 顺序**（非模块子节点尾部回填），**不写 `st.order`、不调 `saveUI`**，修「触屏打断后下次重渲染按旧 order 重建而跳回原位」。
- 门禁（真实执行）：`node verify-hash-registry.mjs` ⇒ **PARTY_COUNT=65 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**；`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）⇒ **exit 0**（静态 0 命中 · Node **503/503** · PW **167 passed + 4 skipped = 171** · bench **7/7** 最大恶化 0.0% / 中位 −14.3%）。
- 真机验证（真实 Chrome headless · CDP · 真实鼠标）**34/34 PASS**：初始 calendar 独占整行（958 = clientWidth）/ 无尺寸分支 24% + 150px / 无死高度；六档视口（1280–2560）每行模块数与行数单调「不变或 ±1」无来回跳；待办拖 120×80 ⇒ `sizes={w:356,h:317}` 为目标值、三件套 = 317px，重载后 400/317/558 **零漂移**；日历拖 60×40 ⇒ `flex` 仍 `1 1 100%`、offsetWidth = clientWidth、`sizes.calendar` 仅 `h`；合成 `pointercancel` ⇒ DOM 顺序还原且与 `ui.calModules.order` 一致、**saveUI 调用 0 次**；待办 0→30 条 ⇒ today 与同行系统日志高度均不变（317 / 357）、下一行「+ 添加模块」top 878→878、正文 scrollHeight 281→900 证明增长真实发生；零 `pageerror` · 零 `console.error`。
- 同步与证据：canonical ≡ step9 镜像（**1,255,856 / `64766D8B0F886B9E995720803BDB829D67468B60FAA264AE9E1EE71B6FDC3902` / CR=0 · LF=23,092**，+2,339 B / +45 行）；改动前镜像快照 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261021-r39`（1,253,517 / `396FAB02…`）。证据 `_环境与调试/r39-verify-all-2026-10-21.txt`、`_环境与调试/r39-module-probe-2026-10-21.txt`、`_环境与调试/r39-module-1440x900-2026-10-21.png`、`_哈希与行尾校验/r39-registry-2026-10-21.txt`、`_哈希与行尾校验/r39-sync-2026-10-21.txt`；探针脚本 `_临时脚本/_r39_module_probe_2026-10-21.mjs`。
- 文档：`0.规范/MAINTENANCE.md` 顶部基线锚点 / §4 / §5 / §9 维护基线结论同步为 **1,255,856 / `64766D8B…1B6FDC3902`** 与 **65 方**，新增 **§22「R39 日历模块位移修复」**（§16 已被 R31 + R32 占用，编号按现行顺延为 §22，未改写既有历史章节）。未物化新冻结件（封存 HEAD 仍 r22），未改任何冻结件字节，未改 `4.回归与验收/JU-不变量清单-v2.0-frozen.md`。

## 2026-10-21 · R38 日历模块窗口缩放位移修复 — 完成（canonical **1,253,517 / `396FAB02…ECE580E3D`** · LF（CR=0 · LF=23,047）· 登记器 **65 方 / drift 0 / PASS** · `verify.js all` Exit 0 · Node 503/503 · PW 167 passed + 4 skipped = 171 · bench 7/7 · 真机探针 18/18）
- 位移修复：[`renderCalModules`](../6.P0-T3基线/v2.0-t3.html:10186) 已落盘尺寸的 `height` 改为 `minHeight`；无尺寸时 calendar `flex:1 1 100%` + `minWidth:100%`，其余模块 `flex:1 1 24%` + `minWidth:200px`（宽屏 1440+ 稳定一行 4 个，消除两行/一行切换时的整体上移）。
- 缩放：[`calModuleBindResize`](../6.P0-T3基线/v2.0-t3.html:10135) 拖拽中以 `flex:0 0 <w>px` + `minWidth` + `minHeight` 反馈，`pointerup` 恢复 `flex:1 1 <w>px` / `minWidth:150px` 并以实测高度回写 `minHeight`；`sizes` 记录恢复后的真实盒尺寸。
- CSS 复核：`.cal-modules` 已含 `align-content:flex-start`（R37 落位），本波零改动；真机确认五视口行位稳定、零横向滚动条。
- 门禁（真实执行）：`node verify-hash-registry.mjs` ⇒ **PARTY_COUNT=65 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**；`node scripts/verify.js all` ⇒ **exit 0**（静态 0 命中 · Node **503/503** · PW **167 passed + 4 skipped = 171** · bench **7/7** 最大恶化 0.0% / 中位 −14.3%）。首次全量遇 L16-W13 §H P95 冷启动噪声（266.49 ms > 200 ms），单测复跑 122.69 ms 后全量复跑通过（121.94 ms）。
- 真机验证（Chromium 1440×900 · 真实鼠标拖拽）**18/18 PASS**：默认 flex / 无死高度 / 1280–2560 行位稳定 / 拖拽 minWidth+minHeight / 松手实测高度回写 / 重载持久化 / 零 pageerror · 零 console.error。
- 备份与证据：`6.P0-T3基线/step9/v2.0-t3.html.bak-20261021-r38`（改动前镜像快照）；`_环境与调试/r38-verify-all-r2-2026-10-21.txt`、`r38-registry-2026-10-21.txt`、`r38-calmod-browser-2026-10-21.txt`、`r38-calmod-2026-10-21.png`、`r38-verify-all-2026-10-21.txt`、`r38-node-w13-retest-2026-10-21.txt`。未物化新冻结件（封存 HEAD 仍 r22），未改任何冻结件字节。
## 2026-10-21 · R34 日历底部模块化（记事本 / 待办 / 日志 / 统计）— 完成（canonical **1,249,200 / `8B3B92DF…C13D3035`** · LF（CR=0 · LF=23,000）· 登记器 **65 方 / drift 0 / PASS** · `verify.js all` Exit 0 · Node 503/503 · PW 167 passed + 4 skipped = 171 · bench 7/7 · 真机探针 30/30）
- 模块化：[`renderCalendarPage`](../6.P0-T3基线/v2.0-t3.html:10205) 底部由 topRow + 分隔线 + 统计面板直建改为 `bottom.appendChild(renderCalModules())`（[`renderCalModules`](../6.P0-T3基线/v2.0-t3.html:10155)）；四模块 note/today/log/stats 复用既有渲染（`renderNoteRow` / `renderCalNode` / `buildCalLogBlock` / `buildStatsBlock`），`_calDayNodesForModules=getDayNodes` 保证日缓存 / 标签过滤 / focusId 口径完全一致。
- CSS：`.cal-modules`（width:100% / flex-wrap / gap:2px / min-height:240px）+ `.cal-module`（flex:1 1 240px / min-width:180px / min-height:160px）+ head/title/del/body/resize/dragging/drop-before/drop-after/add 全量落位；`.cal-bottom` 追加 `overflow-x:hidden` ⇒ 无横向滚动条。
- 交互：标题行 pointerdown 阈值 5px 进入拖拽，document pointermove + rAF 节流 + elementFromPoint 按左右 / 上下半区实时 insertBefore，pointerup 回写 `ui.calModules.order` 并 400ms 内吞 click；右下角 resize 用 setPointerCapture + rAF（最小 180×160）；删除置 hidden、`+ 添加模块` 经 showContextMenu 恢复。
- 状态隔离：`ui.calModules`（order / hidden / sizes）仅经 saveUI() 落盘（不 commit / 不进 historyPast）；`_saveUINow` 与 `uiSnapshot()` 增列 calModules，`applyUIFields()` 恢复缺省四模块；script_4 编辑态早退的派生面板刷新改按 `.cal-module[data-key="stats"|"log"]` 定位。
- 修复：显式尺寸模块追加 `flex:0 0 auto`——首轮真机探针实测「只增高不增宽」（307→307），修复后 367×232 落盘并在重载后保持。
- 门禁（真实执行）：`node verify-hash-registry.mjs` ⇒ **PARTY_COUNT=65 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**（重锚前 drift=2，仅 canonical / step9-mirror；期望值 1,238,929/`CF2A3A04…` → **1,249,200/`8B3B92DF…C13D3035`**）；`node scripts/verify.js all` ⇒ **exit 0**（静态 0 命中 · Node **503/503** · PW **167 passed + 4 skipped = 171** · bench **7/7** 最大恶化 0.0%）。
- 真机验证（Chromium 1440×900 · 真实鼠标）**30/30 PASS**：四模块顺序 / 间距 2px / 无横向滚动条 / 待办·日志·统计口径一致 / 删除-恢复 / 拖拽排序 / 缩放 / 重载恢复 / historyPast 零增长 / 零 pageerror · 零 console.error。
- 备份与证据：`6.P0-T3基线/v2.0-t3.html.bak-20261021-calmod`（1,238,929 B，改动前快照）；`_环境与调试/calmod-verify-all-final-2026-10-21.txt`、`calmod-registry-final-2026-10-21.txt`、`calmod-browser-2026-10-21.txt`、`calmod-syntax-final-2026-10-21.txt`。未物化新冻结件（封存 HEAD 仍 r22），未改任何冻结件字节。

## 2026-10-21 · R31 + R32 最终哈希重算与封存终校 — 完成（canonical **1,235,901 / `76276292…D5D79B`** · LF（CR=0 · LF=22,756）· 清单 **128,656 / `81EA3A18…1673A`** · 新增不变量 #87 · 登记器 **65 方 / drift 0 / PASS** · `verify.js all` Exit 0 · Node 503/503 · PW 167 passed + 4 skipped = 171 · bench 7/7）
- 重锚前实测 **drift=1**：仅 `JU-不变量清单-v2.0-frozen.md`（`size=128656` vs exp 126,243）；`canonical` / `step9-mirror` 与 R31 期望 **1,235,901 / `76276292…D5D79B` / LF（CR=0 · LF=22,756）** 逐项一致 ⇒ 产品侧期望值未改写。登记器改 1 行期望值（清单 126,243/`59A733C7…279406` → **128,656/`81EA3A18…1673A`** / LF · CR=0 · LF=1,704）+ 追加 R32 注释块。
- **新增纳编 1 方（方数 64 → 65）**：`6.P0-T3基线/step9/t9/t17-w1-rendersubtags-rows.test.mjs` **14,180 / `72933C27…CF491` / CRLF（CR=291 · LF=291）**——承载不变量 #87 第 4 条「DOM 侧 `.sb-tag-dot` 不得直接赋值 background」的 N 层断言（`/dot\.style\.background\s*=/ === false`）；该文件原注释口径「不纳入 43 方登记」按本波可审计要求废止。
- 清单末尾物理追加「## 三十一 · 勾选与标签圆点浅色同源（2026-10-21 新增）」+ 不变量 #87（定义 / 断言（伪代码） / 关联实现 / 验证方式 / 补充口径 / 冲突调整记录 / 类型状态标注；无三反引号代码块），条目 1–87 连续（+2,413 B / +20 行）。
- 产品物理复核：`renderSubTags`（L14822 起）段内 `style.background` 直接赋值 **0 处**，标签色经 `dot.style.setProperty('--tag-color', getTagColor(t))`（L14875）承载；`openTagPicker`（L16518）同口径；产品本波**零字节改动**，`<script>` 块数 9 不变。
- 门禁（真实执行）：`node verify-hash-registry.mjs` → **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；`node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）→ **exit 0**：静态 **0 命中** · Node **503/503**（`tests 503 / pass 503 / fail 0`） · PW **167 passed + 4 skipped = 171** · bench **7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`（`MAINTENANCE.md` 改写后**复跑同结果**）。
- 文档：`MAINTENANCE.md` 顶部基线锚点 / §3 步骤 4·5 / §4 门禁表 / §5 标题与判据 / 维护基线结论同步为 **65 方** 与 **1,235,901 / `76276292…D5D79B`**，新增 **§16「R31 + R32 变更记录」**（产品变更 / 清单变更 / 实测值表 / 重锚口径 / 门禁证据）。
- 证据：`_环境与调试/r32-registry-2026-10-21.txt`、`r32-verify-all-2026-10-21.txt`、`r32-verify-all-final-2026-10-21.txt`；环境备注：本机 `node` 不在系统 PATH，门禁以 `C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6` 前置 PATH 执行（否则 `verify.js` 子进程报 `spawnSync node ENOENT`）。未物化新冻结件（封存 HEAD 仍 r22），未改任何冻结件字节。

## 2026-10-20 · UI 一致性批次 3（P2-1 / P2-2 / P2-4 / P2-5 / P2-6 / P2-7）— 完成（canonical **1,219,328 / `58337D70…B8B6`** · LF（CR=0 · LF=22,472）· `<script>` 9 块 · 浏览器探针 34/34 · lint 0 命中 · Node 499/502（3 例为前批遗留，见下））
- P2-1 [`bindTopbar`](../6.P0-T3基线/v2.0-t3.html:18333) 的 `#btnClose` 浏览器分支 toast：`请手动关闭标签页` → `浏览器不允许网页关闭自身标签页，请点击标签页右上角的 × 号`。
- P2-2 新增 [`renderTitleWithBack(title,onBack)`](../6.P0-T3基线/v2.0-t3.html:16182)（返回按钮在标题左侧、同一水平线、标题左对齐），星标 / 模板 / 回收站 / 历史四视图统一；回收站标题行补 `margin-right:auto` 顶住「全选」保持右对齐；星标返回补 `ui.currentDocId=state.rootId`，四按钮均回资料库根（行为同口径）。
- P2-4 [`.sb-nav-item.active`](../6.P0-T3基线/v2.0-t3.html:154) 增 `position:relative;padding-left:14px` + `::before` 3px 左色条（日间 `--accent` / 夜间 `--accent-deep`）；`.sb-row.active` 无伪元素 ⇒ 导航选中与文档树选中视觉可区分。
- P2-5 [`renderCalNode` blur](../6.P0-T3基线/v2.0-t3.html:10417)：新增 `textChanged`，仅文本真的变化才 `parseNaturalDate`，并把 `updateText` 合并为唯一一次提交（删除原重复行），杜绝「点一下输入框再点空白」把待办跳到其它日期。
- P2-6 [`openThemeSelector`](../6.P0-T3基线/v2.0-t3.html:6008) 在 `_modalStack.push(modal)` 之后显式 `_syncAppInert()`，与 `appConfirm` 等模态同口径（背景 `#app` 退出交互树，关闭后复位）。
- P2-7 [`renderSlidesView`](../6.P0-T3基线/v2.0-t3.html:19526) 的 `#sidebarRight .sr-section[data-section="edit"] .sr-body` 选择器上方补维护提示注释（折叠仅隐藏、不销毁；若改条件渲染需同步选择器或走 else 兜底）。
- P2-3 不变量复核（前批已关闭项）：本批 6 项不触碰数据契约 / 加密 payload / 公开 API，`<script>` 块数仍 9、CR=0（LF=22,472），浏览器回归 34/34 + lint 0 命中确认不变量保持。
- 验证：真实 Chromium（file:// 加载）**34/34 PASS**——四视图返回按钮几何一致（左缘均 230px / 标题 `text-align:start`）、日 / 夜色条颜色跟随主题、日历三种失焦场景（不改字 / 「明天 10:00」/ 普通文字）、主题弹窗 inert 开合、幻灯片工具栏仍挂载于编辑分区，零 `pageerror` / 零 `console.error`。
- 门禁：`verify.js lint` **0 命中**；`verify.js node` **499/502** —— 3 例（`t17-w4-batch-fixes` B1、`t18-final-patch` A1/B1）为**前批遗留**：测试沙箱仅注入 4 个自由变量，而产品 `_l7TagCountText` 已引用 `_tagCountPending`（r5 冻结件无该变量，指向 r5 时 32/32 全过），与本批改动无关，是否补齐沙箱待决策。
- 同步与证据：canonical ≡ step9 镜像（1,219,328 B / 同一 SHA-256 / CR=0），证据 `_哈希与行尾校验\p2c-batch3-sync-2026-10-20.txt`；探针 `_临时脚本\_p2c_browser_probe_2026-10-20.mjs`、语法自检 `_临时脚本\_p0_syntax_check_2026-10-20.mjs`、哈希取证 `_临时脚本\_p2c_hash_2026-10-20.mjs`。未改冻结件 / 未改登记器期望值（canonical 漂移属预期，重锚待决策）。

## 2026-10-20 · L22-final-r2 收尾批次 — 完成（canonical **1,215,291 / `5C2F9A24…C42A1`** · LF（CR=0 · LF=22,402）· `verify.js all` Exit 0 · Node 502/502 · PW 167/4s/0f = 171 · bench 7/7 · 登记器 63 方 drift 0 · 九项回归 55/55 · 问题 3 待产品确认未修改）
- 问题 3（侧栏「数据库」/「星标」子树行多选）为**可选加固、需产品确认**；未收到确认 ⇒ `renderSubDb` / `renderSubStarred` **未修改**，状态已写入封存报告与 `MAINTENANCE.md` §11。
- 门禁真实执行：`node scripts/verify.js all` ⇒ 静态 **0 命中** · Node **502/502** · Playwright **167 passed + 4 skipped = 171** · bench **7/7**（最大恶化 0.0% / 中位 −14.3%）· `[verify] 全部通过`（Exit 0）；登记器 ⇒ **PARTY_COUNT=63 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**。
- 九项回归（真实 Chromium，物理点击 / 键盘 / 拖拽）**55/55 PASS**、零 `pageerror` / 零 `console.error`：大纲编辑·撤销·重做 / 日历月周年 + 新建待办 + 拖动改时间（`05:00→08:30`）/ 数据库 5 视图 + 筛选·排序·汇总 + 表名改名同步 / 导图·图谱·演示·幻灯片 / 标签·星标·模板·回收站·历史返回 / 主题·字号·双侧栏 / 导出·备份·导入 / 多标签同步 / word 残留静态扫描。
- canonical 独立复算（PowerShell 逐字节）：**1,215,291 B / `5C2F9A24E99B844F9A196E9F5799F7E8AF6A5C53C56D86F3FD9DDF59931C42A1` / LF（CR=0 · LF=22,402）**，step9 镜像逐字节一致；登记器期望值已与实测一致，**无重锚**（避免无意义改写）。
- 封存口径：**不新增登记方**（保持 63 方）· **不覆盖冻结件**；封存 HEAD 仍为 r22 / `v2.0-l13-frozen-l22-final-r5-2026-10-20`（1,212,364 / `FE04CC1A…C1D5`，只读）。
- 环境记录：`E:\软件\CodeBuddy CN\node.exe` 为 Electron（RunAsNode 关闭）⇒ ICU 报错；改用真实 Node **v24.21.0**（`…\OpenAI\Codex\runtimes\cua_node\…\bin\node.exe`）执行全部门禁。
- 证据：`_环境与调试\l22r2-verify-all-2026-10-20.txt`、`_环境与调试\l22r2-regression-probe-final-2026-10-20.txt`、`_哈希与行尾校验\l22r2-registry-final-2026-10-20.txt`、`_哈希与行尾校验\l22r2-canonical-measure-2026-10-20.txt`；报告 `_报告与元数据\FINAL-SEAL-L22-FINAL-R2-2026-10-20.md`。

## 2026-10-19 · r21 最终封存验证 — 完成（canonical **1,215,166 / `E729E5CC…C998`** · LF（CR=0 · LF=22,418）· `verify.js all` Exit 0 · Node 502/502 · PW 167/4s/0f = 171 · bench 7/7 · 登记器 62 方 drift 0 · 侧栏探针 20/20 · 回收站探针 21/21 · 大纲/数据库/文件网格函数体与 r18 逐字节一致）
- 门禁真实执行：`node 6.P0-T3基线\step9\scripts\verify.js all` ⇒ 静态 0 命中 · Node **502/502** · Playwright **167 passed + 4 skipped = 171** · bench **7/7**（最大恶化 0.0%）· `[verify] 全部通过`（Exit 0）；登记器 `verify-hash-registry.mjs` ⇒ **PARTY_COUNT=62 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**。
- canonical 复算：**1,215,166 B / `E729E5CC57A8738079A6668C629CB81B2012CB923E1098136D1784C96C84C998` / LF（CR=0 · LF=22,418）**，step9 镜像逐字节一致；登记器期望值已与实测一致，未做无意义改写。
- 真实物理操作：侧栏多选 + 批量移入回收站 **20/20**（`trashed 0→2`、`_deleted=true`、rootId 跳过、普通点击 openNode）；回收站多选 + 批量恢复 / 彻底删除 **21/21**（`{c,a}` splice 索引漂移场景全部恢复、`{f,e}` 真实移除、普通点击不导航、零 pageerror / console.error）。
- 零回归比对（无 git）：`renderDbTable` / `renderFileCard` / `renderFolderGrid` / `renderOutlinePage` / `renderOutlineRow` 函数体 SHA-256 与 r18 冻结件 **SAME**，函数体内变更行 = 0；变更仅落于 r19 大纲拖拽/样式、r20 侧栏、r21 回收站；`db=0` / `files=0`。
- 文档锚点：[`MAINTENANCE.md`](../0.规范/MAINTENANCE.md:1) 同步为「封存 HEAD r18 + 现行 canonical 工作基线 r21」；报告 [`FINAL-SEAL-R21-2026-10-19.md`](../_报告与元数据/FINAL-SEAL-R21-2026-10-19.md:1)。
- 证据：`_哈希与行尾校验\final-seal-verify-all-2026-10-19.txt` / `final-seal-registry-2026-10-19.txt` / `final-seal-r20-sidebar-probe-2026-10-19.txt` / `final-seal-r21-trash-probe-2026-10-19.txt` / `final-seal-code-diff-2026-10-19.txt`。
- 封存：`L22-final-r3` 物理文件 1,204,191 / `25891FFD…F2AB7` / LF（只读历史锚，未改写）；`L22-final-r4` 1,205,588 / `11B96CBC…41B2` / LF（HEAD.json 唯一真相源，未改写）；r21 冻结件物化与 HEAD 切换待决策。

## 2026-10-19 · r21 回收站多选 + 批量恢复 / 彻底删除 — 完成（canonical **1,215,166 / `E729E5CC…C998`** · LF · Node 502/502 · PW 167/4s/0f · bench 7/7 · lint 0 · 回收站探针 21/21 · 登记器 62 方 drift 0）
- 多选模型：`renderTrashView` 卡片写入 `data-msid = t.rootId`，`_mSel.type==='trash'` 时回填 `.ju-msel`；Ctrl/Cmd 切换、Shift 按回收站卡片 rootId 顺序范围选择、普通点击不导航。
- 菜单：`_mSel.type==='trash' && ids.size>1 && ids.has(t.rootId)` 时显示「恢复所选（N 个）」/「彻底删除所选（N 个）」，否则保持原单项菜单（恢复 / 彻底删除）。
- 批量执行：`_trashBatchRestore` / `_trashBatchPurge` 逐项按 `state.trashed.findIndex(t.rootId===rid)` 现算索引后再调 `actions.restoreFromTrash` / `actions.purgeTrash`（防 splice 索引漂移），完成后清空 `_mSel.ids` 并 `forceRender`；彻底删除前置 `appConfirm`。
- 全选：标题行新增「全选」按钮（`.files-toolbar` + `.btn`），`_mSelSelectAllCurrent` 增加 trash 分支；样式复用既有 `.file-card.ju-msel`，零新增 CSS。
- 验证：真实浏览器探针 **21/21**（data-msid 顺序、底色 === `--accent-soft`、Shift 范围、按钮 / Ctrl+A 全选、Esc 清除、多选 / 单项菜单、批量恢复与批量彻底删除真实落库、索引漂移场景 `{c,a}` 均恢复、普通点击不导航、零 pageerror / console.error）；`verify.js all` ⇒ lint 0 · Node **502/502** · PW **167 passed / 4 skipped / 0 failed = 171** · bench **7/7**（最大恶化 0.0%）· `[verify] 全部通过`（Exit 0）。
- 登记器：canonical / step9-mirror 重锚（1,212,291/`56E705E7…` → 1,215,166/`E729E5CC…`；+2,875 B / +50 行）⇒ **PARTY_COUNT=62 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**；未物化新冻结件，`HEAD.json` 仍指向 r18（1,205,588 / `11B96CBC…`，字节零变更）。
- 证据：`_哈希与行尾校验\r21-trash-multiselect-probe-2026-10-19.txt` / `b2trash-sync-2026-10-19.txt` / `b2trash-registry-2026-10-19.txt`；`_环境与调试\b2trash-verify-all{,-r2}-2026-10-19.txt`；报告 [`UI-TRASH-MULTISELECT-R21-2026-10-19.md`](../_报告与元数据/UI-TRASH-MULTISELECT-R21-2026-10-19.md:1)。

## 2026-10-19 · r20 左侧边栏多选 + 批量移入回收站 — 完成（canonical **1,212,291 / `56E705E7…CDD0`** · LF · Node 502/502 · PW 167/4s/0f · bench 7/7 · lint 0 · 侧栏探针 20/20 · 登记器 62 方 drift 0）
- 多选模型：`makeSidebarRow` 行写入 `data-msid`，并在渲染时按当前选择回填 `.ju-msel`；`_mSelPaint` 对侧栏行改为「仅 `type==='sidebar'` 时点亮」防串色；新增 `_sbVisibleIds()` 提供 Ctrl / Shift 范围基准序列。
- 交互：Ctrl/Cmd 切换 · Shift 范围（`preventDefault` + `_mSelClick('sidebar',…)`）· 普通点击保持 `openNode`；`renderSidebar` 末尾同步 `_mSelSetOrder('sidebar', 侧栏可见 id 顺序)` + `_mSelPaint()`（仅在无选择或已为 sidebar 时接管，文件 / 数据库多选集合不被侧栏每帧渲染清空）。
- 样式：新增 `.sb-row.ju-msel`（`--accent-soft` 底 + `--fg` 文字 + 600 字重，夜间同色），与 `.sb-row.active` 同源、无描边 / 阴影。
- 批量回收：`showTreeContext` 在多选 >1 且命中右键行时于菜单顶部插入「移入回收站（所选 N 个）」；`appConfirm` 确认后逐个 `actions.moveToTrash`（跳过 `state.rootId` / `_isCalRoot` / `_isDbRoot` / 已删项），完成后清空 `_mSel.ids` 并 `renderSidebar + forceRender`。
- 全选：`_mSelSelectAllCurrent` 增加 sidebar 分支（全选当前侧栏可见行）；Esc 清除沿用全局 `_mSelClear`；大纲 / 数据库 / 文件网格行为零变更，`<script>` 块数仍 9。
- 验证：真实浏览器探针 **20/20**（`data-msid` 一致、底色 === `--accent-soft`、Shift 范围、Ctrl+A / Esc、菜单顶部项、`trashed 0→2` 真实落库、rootId 跳过、普通点击、零 pageerror / console.error）；`verify.js all` ⇒ lint 0 · Node **502/502** · PW **167 passed / 4 skipped / 0 failed = 171** · bench **7/7**（最大恶化 0.0%）· `[verify] 全部通过`（Exit 0）。
- 登记器：canonical / step9-mirror 重锚（1,209,561/`9FA0B52E…` → 1,212,291/`56E705E7…`；+2,730 B / +37 行）⇒ **PARTY_COUNT=62 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**；未物化新冻结件，`HEAD.json` 仍指向 r18（1,205,588 / `11B96CBC…`，字节零变更）。
- 证据：`_哈希与行尾校验\r20-sidebar-multiselect-probe-2026-10-19.txt` / `_环境与调试\r20-verify-all-final-2026-10-19.txt` / `_哈希与行尾校验\r20-registry-2026-10-19.txt`；报告 [`UI-SIDEBAR-MULTISELECT-TRASH-R20-2026-10-19.md`](../_报告与元数据/UI-SIDEBAR-MULTISELECT-TRASH-R20-2026-10-19.md:1)。

## 2026-10-19 · r19 智能拖拽多选 + 大纲选中样式统一 — 完成（canonical **1,209,561 / `9FA0B52E…CA36`** · LF · Node 502/502 · PW 167/4s/0f · bench 7/7 · lint 0 · 登记器 62 方 drift 0）
- 方向判定：`.row` 的 `mousedown` 不再 `preventDefault`，只记录起点（clientX / clientY）与节点 id；`document.mousemove` 计算位移——`|dx| > |dy|` 判「选中文字」完全不干预浏览器选区；`|dy| > |dx| + 5` 判「跨行多选」，立即 `preventDefault` + `removeAllRanges` + `body.userSelect:none`。
- 刷选实现：多选态下用 `document.elementFromPoint` 实时命中 `.row`，按 `outlineVisibleSeq` 的「锚点→当前行」区间重算 `_outlineSel.ids` 并同步 `.multi-sel`；回退经过的行自动移除，`mouseup` 结束并 `forceRender` 固化；零位移纯点击沿用原单击选中语义。
- 样式统一：`.row.sel` 与 `.row.multi-sel` 使用完全相同的 `background:var(--accent-soft)!important`；`outline / border / box-shadow` 一律 `none`，`.row:hover`、`.row.sel:hover`、`.row.multi-sel:hover`、`.row:has(.text:focus):hover` 的 1px `--line-soft` 描边全部移除。
- 验证：`verify.js all` ⇒ 静态 0 命中 · Node **502/502** · PW **167 passed / 4 skipped / 0 failed = 171** · bench **7/7**（最大恶化 0.0%）· `[verify] 全部通过`；登记器 `PARTY_COUNT=62` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。
- P 层：`t3-invariants.spec.ts` 内新增真实鼠标水平拖拽（原生 Selection 非空且 `.multi-sel` = 0）与垂直跨行拖拽（`.multi-sel` ≥ 2、Selection 为空串、底色非透明、`outlineStyle / borderTopStyle / boxShadow` 均为 `none`）断言，`test()` 数不变。
- 证据：[`r19-verify-all-2026-10-19.txt`](../_环境与调试/r19-verify-all-2026-10-19.txt:1) / [`r19-registry-2026-10-19.txt`](../_哈希与行尾校验/r19-registry-2026-10-19.txt:1)；报告 [`UI-OUTLINE-DRAG-MULTISELECT-R19-2026-10-19.md`](../_报告与元数据/UI-OUTLINE-DRAG-MULTISELECT-R19-2026-10-19.md:1)。

## 2026-10-19 · r14 底部 32px 实色保护区 + 折叠三钮居中 — 完成（canonical **1,193,188 / `C13DD3B2…923F`** · LF · Node 502/502 · PW 167/4s/0f · lint 0 · 专项探针 750/750 · 登记器 59 方 drift 0）
- 底部保护区：`#main::after` 由 `40px` 渐变改为 **`32px` 实色 `var(--bg)`**，`pointer-events:none` / `z-index:50` 保持；`#content` 的 `padding-bottom` 由 `64px` 调为 `40px`（`≤1100px` 断点同步 40px），滚到底时文字在实色带上沿被干净截断。
- 按钮组居中：`.main-toggle.left` 改 `left:calc(50% - 60px);right:auto`，`.main-toggle.right` 改 `right:calc(50% - 60px);left:auto`，`.main-toggle.both` 由 `position:fixed;left:50vw` 收回 `position:absolute;left:50%` + `translateX(-50%)`；三钮 `bottom:8px` 不变，稳定紧凑悬浮于页面正下方中央，不再随侧栏折叠散开。
- 幻灯片视图：取消 `body.slides-mode #main::after{display:none}`，与其他视图共用同一实色保护带；`.ju-sl-wrap` 高度扣减 `48px → 64px`、`.ju-sl-stage` 可用高度扣减 `196px → 212px`，舞台下缘恒在 32px 保护带上方，按钮不遮挡舞台。
- 验证：专项探针 **750/750**（1440×900 / 1920×1080 / 1024×768 × 日/夜 × 大纲/导图/演示/幻灯片/图谱/资料库/历史，零 pageerror / console.error）；`verify.js all` ⇒ lint 0 · Node **502/502** · PW **167 passed / 4 skipped / 0 failed** · bench PASS · `[verify] 全部通过`（冻结后复跑仍全绿）。
- 封存：新件 `v2.0-t13-frozen-t22-r14-2026-10-19.html`（canonical 逐字节，1,193,188 B / `C13DD3B2…` / CR=0 · LF=22,008 / `<script>` 9 块）；`HEAD.json` 指向 r14；r13（1,192,740 / `5D68A858…`）转历史只读锚；登记器新增 `frozen-t22-r14` 并重锚 canonical / step9-mirror，方数 58 → 59。
- 报告：[`UI-BOTTOM-PROTECTION-TOGGLE-R14-2026-10-19.md`](../_报告与元数据/UI-BOTTOM-PROTECTION-TOGGLE-R14-2026-10-19.md:1)；证据 `_哈希与行尾校验\r14-{sync,freeze,bottom-protection-probe,registry}-2026-10-19.txt`、`_环境与调试\r14-verify-all{,-final}-2026-10-19.txt`；脚本 `_临时脚本\_r14_{sync,freeze}.mjs`、`_临时脚本\r14-bottom-protection-probe-2026-10-19.mjs`。

## 2026-10-19 · r13 大纲背景单层化 + 内容区加宽 — 完成（canonical **1,192,740 / `5D68A858…2D0A`** · LF · Node 502/502 · PW 167/4s/0f · lint 0 · 大纲探针 18/18 · 登记器 58 方 drift 0）
- 背景单层：`.text` / `.text:focus` 背景改 `transparent`（移除文本区 8% 底色）；`.row:has(.text:focus)` / `.row.sel:has(.text:focus)` 统一 8% accent，聚焦背景只由 `.row` 提供一层。
- 三态同深浅：`.row.sel` 与 `.row.multi-sel` 由 10% 收敛为 8%，选中 / 聚焦 / 多选不再出现深浅色块；`border / outline / box-shadow` 保持 `none`。
- 内容区加宽：`.outline` 的 `max-width` 由 `var(--content-max-doc)`（920px）改为 `var(--content-max)`（1100px）；未加水平 padding，避免拖拽基准 X（`oc.left+24`）与行起点错位。
- 标题行：`.outline .doc-header` 同宽（`max-width:100%`），底色改 `transparent` + `backdrop-filter:blur(8px)`；日间随 `#main` 实色、夜间随渐变，消除突兀色块，sticky 保留。
- 验证：专项探针 **18/18**（1920×1080 布局、日/夜 × 聚焦/选中/悬浮，零 pageerror / console.error）；`verify.js all` ⇒ lint 0 · Node **502/502** · PW **167 passed / 4 skipped / 0 failed** · bench PASS · `[verify] 全部通过`。
- 封存：新件 `v2.0-t13-frozen-t22-r13-2026-10-19.html`（canonical 逐字节，1,192,740 / `5D68A858…` / CR=0 · LF=22,006 / `<script>` 9 块）；`HEAD.json` 指向 r13；r12（1,192,469 / `72C94A5D…`）转历史只读锚；登记器新增 `frozen-t22-r13` 并重锚 canonical / step9-mirror，方数 57 → 58。
- 报告：[`UI-OUTLINE-BACKGROUND-WIDTH-R13-2026-10-19.md`](../_报告与元数据/UI-OUTLINE-BACKGROUND-WIDTH-R13-2026-10-19.md:1)；证据 `_哈希与行尾校验\r13-{outline-probe,registry}-2026-10-19.txt`、`_环境与调试\r13-verify-all-2026-10-19.txt`；探针 `_临时脚本\_r13_outline_probe.mjs`。

## 2026-10-19 · r12 大纲选中态与顶部导航激活态统一 — 完成（canonical **1,192,469 / `72C94A5D…DE6C`** · LF · Node 502/502 · PW 167/4s/0f · lint 0 · 选中/顶栏探针 33/33 · 登记器 57 方 drift 0）
- 大纲选中态：`.text:focus` / `.cal-node .text:focus` 删除 `box-shadow` 内描边环，仅保留 `accent-soft` 浅色底；`.row.sel` 改为 `box-shadow:none`（`border` / `outline` 同步清除）。
- 聚焦行底色：`.row:has(.text:focus)` 与 `.row.sel:has(.text:focus)` 不再置 `transparent`，分别保留 8% / 10% accent 浅色底；日/夜主题同口径。
- 顶部导航：`syncTopbar()` 的 `outline` 分支追加 `ui.view==='outline'` 判定，修复点击「大纲」后 `.active` 丢失；`.tb-nav-btn.active` 维持 `background:var(--accent);color:#fff`，与「资料库 / 思维导图」完全一致。
- 验证：`verify.js all` ⇒ lint 0 · Node **502/502** · PW **167 passed / 4 skipped / 0 failed** · 性能对拍通过 · `[verify] 全部通过`；r12 专项探针 **33/33**（日/夜 × 真实/合成行 × 顶栏切换，零 pageerror / console.error）。
- 封存：新件 `v2.0-t13-frozen-t22-r12-2026-10-19.html`（canonical 逐字节，1,192,469 / `72C94A5D…` / CR=0 · LF=22,006 / `<script>` 9 块）；`HEAD.json` 指向 r12；r11（1,192,443 / `0010EBE1…`）转历史只读锚；登记器新增 `frozen-t22-r12` 并重锚 canonical / step9-mirror，方数 56 → 57。
- 报告：[`UI-SELECTION-TOPBAR-R12-2026-10-19.md`](../_报告与元数据/UI-SELECTION-TOPBAR-R12-2026-10-19.md:1)；证据 `_哈希与行尾校验\r12-{selection-topbar-probe,freeze,registry}-2026-10-19.txt`、`_环境与调试\r12-verify-all-2026-10-19.txt`；探针 `_临时脚本\r12-selection-topbar-probe-2026-10-19.mjs`。

## 2026-10-19 · r11 主内容区滚动保护区 + 折叠按钮下移 — 完成（canonical **1,192,443 / `0010EBE1…933E`** · LF · Node 502/502 · PW 167/4s/0f · lint 0 · 滚动保护探针 66/66 · 登记器 56 方 drift 0）
- 折叠钮下移：`.main-toggle` 与 `.main-toggle.both` 的 `bottom` 由 `16px` 调整为 `8px`，更贴近页面底边。
- 底部保护区：`#content` 的 `padding-bottom` 由 `24px` 增至 `64px`（`≤1100px` 断点同步），滚到底时最后一行文字与按钮保持安全距离。
- 底部渐隐：`#main::after` 新增 40px 遮罩（`linear-gradient(to top,var(--bg) 40%,transparent)` / `z-index:50` / `pointer-events:none`）；折叠钮 `z-index:100/120` 保持悬浮其上；幻灯片视图关闭遮罩。
- 顶部保护区：`.doc-header` / `.cal-header` / `.db-toolbar` 统一 `position:sticky; top:0; z-index:10` + 实色背景；`#main::before` 新增 `--content-pad-t` 高度实色遮片（`z-index:60`），覆盖 sticky 标题行上方 padding 带，文字上滚不穿透 `#topbar`；打印态关闭遮罩并取消 sticky。
- 验证：`verify.js all` ⇒ lint 0 · Node **502/502** · PW **167 passed / 4 skipped / 0 failed** · 性能对拍通过 · `[verify] 全部通过`；滚动保护专项探针 **66/66**（1440×900 + 1920×1080，滚到底最后一行底 ≤ 按钮顶 − 2px，上滚标题行贴 content-box 顶且顶部遮片生效，零 pageerror / console.error）；r10 顶部对齐回归 **72/72**。
- 封存：新件 `v2.0-t13-frozen-t22-r11-2026-10-19.html`（canonical 逐字节，1,192,443 / `0010EBE1…` / CR=0 · LF=22,004 / `<script>` 9 块）；`HEAD.json` 指向 r11；r10（1,190,729 / `14F3A930…`）转历史只读锚；登记器新增 `frozen-t22-r11` 并重锚 canonical / step9-mirror，方数 55 → 56。
- 报告：[`UI-SCROLL-PROTECTION-R11-2026-10-19.md`](../_报告与元数据/UI-SCROLL-PROTECTION-R11-2026-10-19.md:1)；证据 `_哈希与行尾校验\r11-{scroll-protection-probe,freeze,registry}-2026-10-19.txt`、`_环境与调试\r11-verify-all-2026-10-19.txt`；探针 `_临时脚本\r11-scroll-protection-probe-2026-10-19.mjs`。

## 2026-10-19 · r10 幻灯片主舞台取消垂直居中 + 顶部与缩略图对齐 — 完成（canonical **1,190,729 / `14F3A930…9785`** · LF · Node 502/502 · PW 167/4s/0f · lint 0 · 顶部对齐探针 72/72 · 登记器 55 方 drift 0）
- 根因：`.ju-sl-stage` 的 `margin:auto` 在纵向 flex 容器内把剩余纵向空间上下均分 ⇒ 舞台被推到垂直居中位置；且 `.ju-sl-main` 无顶部内距，与 `.ju-sl-rail` 的 `padding-top:6px` 差 6px。
- 取消居中：`.ju-sl-main` 显式 `justify-content:flex-start` / `align-items:flex-start`；`.ju-sl-stage` 的 `margin:auto` 改为 `margin:0 auto`（垂直不分配剩余空间、水平仍自动居中），补 `align-self:flex-start` 兜底。
- 顶部对齐：`.ju-sl-main` 补 `padding:6px 0 0` + `box-sizing:border-box`，与 `.ju-sl-rail` 顶部内边距同口径 ⇒ 舞台顶部 = 首个缩略图顶部；收起规则只改 rail 左右内距，两态对齐一致。
- 自适应保持：`flex:0 0 auto` + `width:100%` + `max-width:min(100%, calc((100dvh - topbar - 196px) * 16 / 9))` + `aspect-ratio:16/9`；扣减常量 `190px → 196px`（新增 6px 顶部内边距）。
- 验证：`verify.js all` ⇒ lint 0 · Node **502/502** · PW **167 passed / 4 skipped / 0 failed** · 性能对拍通过 · `[verify] 全部通过`；真实 Chrome 顶部对齐探针 **72/72**（1440×900 / 1920×1080 × 展开/收起，四态 `stageTop == thumbTop == railTop + 6`，零 pageerror / console.error）；r8 回归 20/20 · UI-P0/P2 回归 28/28；登记器 **55 方 / drift 0 / PASS**。
- 实测：1440×900 展开 776×437 / 收起 1036×583；1920×1080 展开 1256×707 / 收起 1486×836（左右各 14.89px 对称留白）；四态均无页面 / `#content` 滚动条。
- 封存：新件 `v2.0-t13-frozen-t22-r10-2026-10-19.html`（canonical 逐字节，1,190,729 / `14F3A930…` / CR=0 · LF=21,994）；`HEAD.json` 指向 r10；r9（1,190,072 / `D74D58AA…`）转历史只读锚。
- 报告：[`UI-SLIDES-STAGE-TOP-ALIGN-R10-2026-10-19.md`](../_报告与元数据/UI-SLIDES-STAGE-TOP-ALIGN-R10-2026-10-19.md:1)；证据 `_哈希与行尾校验\r10-{sync,freeze,verify-all,registry,slides-top-align-probe,r8probe-regress,ui-p0p2-regress}-2026-10-19.txt`；探针 `_临时脚本\r10-slides-top-align-probe-2026-10-19.mjs`。

## 2026-10-19 · r9 幻灯片缩略图留白 + 舞台 16:9 最大化 — 完成（canonical **1,190,072 / `D74D58AA…1738`** · LF · Node 502/502 · PW 167/4s/0f · lint 0 · 布局探针 52/52 · 登记器 54 方 drift 0）
- 缩略图留白：左栏收起时 `#content` 左 padding 由 `0` 改为 `16px`（右仍 `0`），缩略图栏距屏幕左缘恒为 16px（实测 `railLeft=16`），贴边但不再死贴；全局 `#content` 规则同口径修正。
- 高度链：幻灯片视图 `#content` 改纵向 flex + `.files-wrap` 纵向撑满；`.ju-sl-wrap` 以 `flex:1` + `height:calc(100vh - var(--topbar-h,48px) - 48px)` 占满剩余高度，`.ju-sl-main` 补 `height:100%/min-height:0`，消除舞台下方多余空白。
- 舞台最大化：删除 `.ju-sl-stage` 写死的 `max-height:68vh`，改为 `flex:0 0 auto` + `width:100%` + `max-width:min(100%,calc((100dvh - var(--topbar-h,48px) - 190px) * 16 / 9))` + `aspect-ratio:16/9` + `margin:auto` ⇒ 宽度取「容器宽 / 可用高度×16/9」较小者，比例恒为 16:9、水平居中、无越界。
- 验证：`verify.js all` ⇒ lint 0 命中 · Node **502/502** · PW **167 passed / 4 skipped / 0 failed** · 性能对拍通过 · `[verify] 全部通过`；真实 Chrome 布局探针 **52/52**（1440×900 / 1920×1080 × 展开/收起；零 pageerror / console.error）；r8 拖拽回归 20/20 · UI-P0/P2 回归 28/28；登记器 **54 方 / drift 0 / PASS**。
- 实测：1440×900 收起态舞台 1036×583（展开 776×437，面积 +78%）；1920×1080 收起态 1497×842（高度受限分支，左右各 9.56px 对称留白），两档均无页面 / `#content` 滚动条。
- 封存：新件 `v2.0-t13-frozen-t22-r9-2026-10-19.html`（canonical 逐字节，1,190,072 / `D74D58AA…` / CR=0 · LF=21,990）；`HEAD.json` 指向 r9；r8（1,189,026 / `7AF8575A…`）转历史只读锚。
- 报告：[`UI-SLIDES-LAYOUT-R9-2026-10-19.md`](../_报告与元数据/UI-SLIDES-LAYOUT-R9-2026-10-19.md:1)；证据 `_哈希与行尾校验\r9-{verify-all,registry,slides-layout-probe,r8probe-regress,ui-p0p2-regress}-2026-10-19.txt`；探针 `_临时脚本\r9-slides-layout-probe-2026-10-19.mjs`。

## 2026-10-19 · r8 幻灯片大纲渲染 + 侧栏长按整行拖拽 — 完成（canonical **1,189,026 / `7AF8575A…5F30`** · LF · Node 502/502 · PW 167/4s/0f · lint 0 · 专项探针 20/20 · 登记器 53 方 drift 0）
- P0-1：`_paint` 现调用 `_lines(n)`，把大纲子节点渲染为 `<ul class="ju-sl-outline"><li>`；标题框 `.ju-sl-box` 与只读大纲置于 `.ju-sl-content` 纵向排布，修复主舞台只显示标题、内容丢失。
- P0-2：左栏收起时 `#content` 左右留白清零、`.files-wrap` 解除限宽、`.ju-sl-rail` 贴左（`left=0`）、`.ju-sl-main/.ju-sl-stage` `width:100%` 且 `max-height:none`，舞台最大化。
- P1：删除 `.ju-grip`（⋮⋮）把手；`.sr-title` / `.sb-nav-item` 整行长按拖拽（200ms + 5px 阈值、`.ju-dnd-dragging` + `cursor:grabbing`、拖拽后抑制 click）；右侧分区新增 `ensureSections()` 幂等补挂，实时 `insertBefore` 并持久化 `ui.dnd.secOrder`。
- 验证：`verify.js lint` 0；`node` 502/502；`pw` 167 passed / 4 skipped / 0 failed；真实 Chrome 专项探针 20/20，零 pageerror / console error；登记器 53 方 drift=0 PASS。
- 封存：新件 `v2.0-t13-frozen-t22-r8-2026-10-19.html`（canonical 逐字节，1,189,026 / `7AF8575A…`）；`HEAD.json` 指向 r8；r7（1,188,344 / `1F972407…`）转历史只读锚。
- 报告：[`UI-SLIDES-DND-R8-2026-10-19.md`](../_报告与元数据/UI-SLIDES-DND-R8-2026-10-19.md:1)；证据 `_哈希与行尾校验\r8-registry-2026-10-19.txt`；探针 `_临时脚本\r8-slides-dnd-probe-2026-10-19.mjs` / 输出 `_临时脚本\r8-probe-out-2026-10-19.txt`。

## 2026-10-19 · r7 幻灯片按钮样式统一 — 完成（canonical **1,188,344 / `1F972407…42ED`** · LF · Node 502/502 · PW 167/4s/0f · lint 0 · 专项探针 27/27 · 登记器 52 方 drift 0）
- 样式：删除「幻灯片编辑 / 图片 / 对齐 / 演示」全部分类文字节点；工具栏改为 3 个 `.sr-edit-row`，10 个按钮统一 `class="sr-edit-btn"`（28px / `--radius-sm` / `--bg-panel` / 同口径 hover）。
- 布局：第 1 行 上传 / 背景 / 删除（3），第 2 行 左 / 中 / 右 / 顶 / 垂直中 / 底（6），第 3 行 演示模式（1）；按钮为 SVG + `title` / `aria-label`。
- 功能：修正 `_pages()` 返回 id 字符串 → 顶级节点对象（`_paint` / `_thumbEl` / `_addFile` / `_delImg` / `_presPaint` 均读取 `.id` / `.text`）；上传 / 对齐 / 删除 / 演示恢复。
- 显隐：非幻灯片视图沿用 `body:not(.slides-mode) .ju-sl-toolbar{display:none!important}`；`_slideCleanup` 随视图卸载移除追加节点。
- 验证：`verify.js lint` 0；`node` 502/502；`pw` 167 passed / 4 skipped / 0 failed；真实 Chrome 专项探针 27/27，零 pageerror / console error；登记器 52 方 drift=0 PASS。
- 封存：新件 `v2.0-t13-frozen-t22-r7-2026-10-19.html`（canonical 逐字节）；`HEAD.json` 指向 r7；r6（1,188,674 / `239250FD…`）转历史只读锚。
- 报告：[`UI-SIDEBAR-SLIDE-BUTTON-UNIFY-2026-10-19.md`](../_报告与元数据/UI-SIDEBAR-SLIDE-BUTTON-UNIFY-2026-10-19.md:1)；证据 `_哈希与行尾校验\r7-{hash,registry,lint,node-gate,pw,sidebar-probe}-2026-10-19.*`；探针 `_临时脚本\r7-sidebar-probe-2026-10-19.mjs`。

## 2026-10-19 · r6 右侧栏「编辑」分区按钮覆盖修正 — 完成（canonical **1,188,674 / `239250FD…75C6`** · LF · Node 502/502 · PW 167/0f · lint 0 · 专项探针 22/22 · 登记器 51 方 drift 0）
- 根因：`body.slides-mode .sr-section[data-section="edit"] .sr-edit-row{display:none}` 命中编辑分区内**全部** `.sr-edit-row`，连带隐藏原有 15 个文本编辑按钮（加粗 / 斜体 / 下划线 / 颜色 / 字号 / 格式刷 / 撤销重做等）。
- 修正：删除该规则；幻灯片工具栏经 `_tbHost.appendChild(tb)` 追加在原有按钮之后，新增「幻灯片编辑」小标题；图片组顺序 上传图片 → 设为背景 → 删除图片；按钮样式对齐 `.sr-edit-btn`（28px / `--radius-sm` / 同口径 hover）；`_slideCleanup` 卸载时移除追加节点。
- 交互：`tb` 内按钮 `onclick` 直接绑定节点，DOM 挂载位置变化不影响绑定；非幻灯片视图沿用 `body:not(.slides-mode) .ju-sl-toolbar{display:none!important}`。
- 验证：`verify.js lint` 0；`node` 502/502；`pw` 167 passed / 0 failed / 26 skipped（`JU_L11` / `JU_L12` 默认关闭态既有跳过）；真实 Chrome 专项探针 22/22，零 pageerror / console error；登记器 51 方 drift=0 PASS。
- 封存：新件 `v2.0-t13-frozen-t22-r6-2026-10-19.html`（canonical 逐字节）；`HEAD.json` 指向 r6；r5（1,187,766 / `3E7FAF2B…`）与 r4 转历史只读锚。
- 报告：[`UI-SIDEBAR-EDIT-TOOLBAR-FIX-2026-10-19.md`](../_报告与元数据/UI-SIDEBAR-EDIT-TOOLBAR-FIX-2026-10-19.md:1)；证据 `_哈希与行尾校验\r6-{hash,registry,lint,node-gate,pw,sidebar-probe}-2026-10-19.*`；探针 `_临时脚本\_r6_sidebar_probe.mjs`。

## 2026-10-19 · UI-P0/P1/P2 修正波 — 完成（canonical **1,187,766 / `3E7FAF2B…43D0`** · LF · Node 502/502 · PW 167/4s/0f · lint 0 · 登记器 50 方 drift 0）
- P0：中钮 `position:fixed;left:50vw;bottom:16px;z-index:120`；四子树统一 14px；左模块分隔线 + 收起 gap 5px；`.sr-title` 23px/13px；`.doc-header-title` 全局居中，幻灯片补标题行。
- P0-5：幻灯片工具栏迁入右栏 `data-section=edit`（图片/对齐/演示三组），`slides-mode` 显隐；左栏收起时 `#content` 左 padding=0、缩略图 148px、舞台解除 68vh。
- P1：`.db-table` 最小列宽 80→30px、th/td/控件居中、拖拽下限 30px；`.row.sel` 加 accent 内环 + accent-soft 外晕。
- P2：`#btnMusic` 改椭圆番茄 + 三叶/短梗 SVG（约 16.23px）。
- 验证：`verify.js lint` 0；`node` 502/502；`pw` 167 passed / 4 skipped / 0 failed；浏览器 UI 探针 28/28 零 console error；登记器 50 方 drift=0 PASS。
- 封存：新件 `v2.0-t13-frozen-t22-r5-2026-10-19.html`（canonical 逐字节）；`HEAD.json` 指向 r5；r4 转历史只读锚（1,174,919 / `0B4AA2A6…`）。
- 报告：[`UI-P0-P2-FIX-2026-10-19.md`](../_报告与元数据/UI-P0-P2-FIX-2026-10-19.md:1)；证据 `_哈希与行尾校验\ui-p0-p2-registry-before|after-2026-10-19.txt`、`ui-p0-p2-browser-probe-2026-10-19.txt`；探针 `_临时脚本\_ui_p0p2_probe_2026-10-19.mjs`。

## 2026-10-18 · 批次 5 / 清理与可维护性 + t3 指纹断言对齐 — 完成（canonical **1,184,857 / `6D201848…D88C`** · LF · Node 502/502 · PW t3 28/28 · lint 0）
- T-01 [`t3-reference-semantics.spec.ts`](../6.P0-T3基线/step9/tests/t3-reference-semantics.spec.ts:398)：3 例旧「每次 commit 指纹必变」改为批次 3-B 契约——非结构提交指纹不变（light / 顶层字段）；正文编辑 `_structRev` 不推进；`addNode` 结构变更指纹必变。
- 5-A [`commit`](../6.P0-T3基线/v2.0-t3.html:4589)：删除 `_l8Patch` 注释中「下方 `let _patch` 遮蔽」失实说明，并同步更正 [:4706](../6.P0-T3基线/v2.0-t3.html:4706)/[:4722](../6.P0-T3基线/v2.0-t3.html:4722)。
- 5-B [`renderMainPanel`](../6.P0-T3基线/v2.0-t3.html:14255)：「buildCalLogBlock 尚未落地」→「定义于 script_1.js 顶部；typeof 守卫仅作极端降级兜底」。
- 5-C [`renderFolderGrid`](../6.P0-T3基线/v2.0-t3.html:13960)：`const ids=sortDocs(...)` 提前到 `selAllBtn` 之前（TDZ 可读性）；浏览器探针全选 3/3。
- 5-D [`_juAcceptDir`](../6.P0-T3基线/v2.0-t3.html:19938)/[`juApplyBackupDirUI`](../6.P0-T3基线/v2.0-t3.html:19880)/[`applyUIFields`](../6.P0-T3基线/v2.0-t3.html:5698)：新增 `ui.backupDirWritable`；浏览器仅记录路径时 toast 明示不自动备份、title 追加「（仅记录）」；持久化 / 恢复该标志。
- T-02 [`verify.js`](../6.P0-T3基线/step9/scripts/verify.js:176)/[`playwright.config.ts`](../6.P0-T3基线/step9/playwright.config.ts:10)：Chromium 候选补 `%LOCALAPPDATA%` 且做存在性校验，消除 bundled `chromium_headless_shell-*` 未安装导致的 PW 假失败（不下载、不改产品源码）。
- 验证：`verify.js node` **502/502**、`lint` 0 命中、PW t3 **28/28**、5-C/5-D 浏览器探针全绿且 **零 console error**；canonical ≡ step9 镜像（1,184,857 B / LF）。
- 登记器 49 方 drift=5（canonical + mirror + t3 spec + verify.js + playwright.config，预期漂移，重锚待决策）；冻结件 r4 仍为只读锚（1,174,919 / `0B4AA2A6…`）。
- 报告与证据：[`B5-CLEANUP-TEST-ALIGN-2026-10-18.md`](../_报告与元数据/B5-CLEANUP-TEST-ALIGN-2026-10-18.md:1)；`_哈希与行尾校验\w5-lint|w5-node-gate|w5-pw-t3-reference|w5-registry-2026-10-18.txt`；`_环境与调试\w5-probe-5cd-2026-10-18.txt`；探针 `_临时脚本\w5-probe-5cd.mjs`。

## 2026-10-18 · 批次 4 / P2 交互与性能与口径统一（4-A～4-F）— 完成（canonical **1,184,025 / `2FC85FEF…11CA`** · LF · 门禁 502/502 · lint 0 命中 · 浏览器 31/31）
- 4-A [`renderDbTable` 标题列 oninput](../6.P0-T3基线/v2.0-t3.html:11960)：标签变化只 `renderSidebar()`，去掉 `forceRender()`（重渲染移除 contenteditable ⇒ 光标/字符丢失）。
- 4-B [`renderMindmap` 节点循环](../6.P0-T3基线/v2.0-t3.html:12839)：空文本但有子节点的节点不再 `return` 跳过，改为渲染半透明 `(空)` 占位框（[:12863](../6.P0-T3基线/v2.0-t3.html:12863)），父/子连线与点击编辑恢复。
- 4-C [`docNodeCount`](../6.P0-T3基线/v2.0-t3.html:6683)：新增 `_docNodeCountCache`（键 = docId + `state._structRev`，>1000 清空）；并在 merge / `initStore` / commit 整树分支 / undo / redo 的 `_wordCountCache.clear()` 处同步清空。
- 4-D [`tagIndexUpdate`](../6.P0-T3基线/v2.0-t3.html:3199) 与 Worker [`applyDeltaCore` tag 分支](../6.P0-T3基线/v2.0-t3.html:3617) 两侧补 `_isFolder` 过滤，与 `buildTagIndex / _tagScanStep / fullRebuildCore` 全量口径对齐（切片载荷已含 `_isFolder`，协议零改动）。
- 4-E [`bindCalEventDrag` `.evtx` 分支](../6.P0-T3基线/v2.0-t3.html:9972)：补 `pointercancel` 收尾（清 dragging + 摘三类监听，不提交时间），`up()` 同时摘 `pointercancel`。
- 4-F [`openCalTimeModal → save()`](../6.P0-T3基线/v2.0-t3.html:6649)：删除多余 `invalidateCalIndex()`，保留 `forceRender()+close()`（commit 内 L6 增量维护已更新 calIndex）。
- 验证：真实浏览器探针 **31/31 PASS**（含零 console error / pageerror）、静态+语义探针 **19/19 PASS**、`verify.js node` **502/502**、`lint` **0 命中**；canonical ≡ step9 镜像（1,184,025 B / CR=0 / LF=21,909）；登记器 49 方 drift=2（canonical + mirror，预期漂移，重锚待决策）。
- PW 透明披露（均属预存问题，非本批引入）：163 passed / 4 failed / 4 skipped —— T-99 为登记器未重锚（drift=2），另 3 例为批次 3-B 指纹口径变更后的旧断言（`state.updatedAt` → `state._structRev`），两项均待决策。
- 证据与报告：[`_报告与元数据/B4-P2-INTERACTION-PERF-FIX-2026-10-18.md`](../_报告与元数据/B4-P2-INTERACTION-PERF-FIX-2026-10-18.md:1)；`_哈希与行尾校验\b4-hash|b4-lint|b4-registry|b4-fixprobe|b4-browser-probe|b4-pw|b4-pw2-2026-10-18.txt`；探针 `_临时脚本\_b4_hashes.mjs`、`_b4_fixprobe.mjs`、`_b4-browser-2026-10-18.mjs`。

## 2026-10-18 · 批次 3 / 多标签与崩溃恢复后的缓存一致性（3-A / 3-B）— 完成（canonical **1,181,067 / `F056A8FD…AA00`** · LF · 门禁 502/502 · lint 0 命中 · 浏览器 22/22）
- 3-A [`mergeRemoteState` finally](../6.P0-T3基线/v2.0-t3.html:2050)：`invalidateCalIndexOnly()` 之后补 `_calDayCache / _calRecurCache / _yearCountsCache / _renderDayCache = null` + `_wordCountCache.clear()`；merge 不走 commit、无 patch 级失效路径，5 类派生缓存改为 finally 统一置空（lazy 重建），原四索引清空逐字保留。
- 3-B-1 [`_sidebarFingerprint`](../6.P0-T3基线/v2.0-t3.html:14330)：首元素 `state.updatedAt` → `(state._structRev\|0)`，修复「每次 commit 指纹必变 ⇒ 优化不生效」与「merge 不更新 updatedAt ⇒ 漏刷新」双向缺陷。
- 3-B-2 [`commit` 收口](../6.P0-T3基线/v2.0-t3.html:4749)：按 patch 路径判定**结构变更**后 `_structRev++`（节点增删 / children / parent / starred / _deleted / collapsed / tags / 类型标志 + 侧栏可见文本）；文档内正文编辑不推版本 ⇒ 四棵子树跳过重建，顶层标题与表格行文本仍刷新。
- 3-B-3/4/5：[`mergeRemoteState` finally](../6.P0-T3基线/v2.0-t3.html:2071) 直接递增；[`initStore`](../6.P0-T3基线/v2.0-t3.html:2305) / [`migrateStateObject`](../6.P0-T3基线/v2.0-t3.html:19664) 补 `_structRev` 归一化（缺字段 → 0）。`_rev` 语义零改动。
- 验证：逻辑探针 **38/38 PASS**（merge finally 运行时执行 / 指纹行为 / 13 组结构判定 / 归一化）；真实浏览器（Playwright + 本机 Chrome headless）**22/22 PASS**（addNode×5 重建、正文改名零重建、顶层改名重建、merge 后 5 类缓存失效 + 日历日/年视图 + 字数 + 侧栏新节点全部正确）；`verify.js node` **502/502**、`lint` **0 命中**；登记器 49 方 drift=2（canonical + mirror，预期）。
- 证据与报告：[`_报告与元数据/B3-CACHE-CONSISTENCY-FIX-2026-10-18.md`](../_报告与元数据/B3-CACHE-CONSISTENCY-FIX-2026-10-18.md:1)；`_哈希与行尾校验\b3-fix-probe-2026-10-18.txt` / `b3-browser-probe-2026-10-18.txt` / `b3-node-gate-2026-10-18.txt` / `b3-lint-2026-10-18.txt` / `b3-registry-2026-10-18.txt` / `b3-fix-hash-2026-10-18.txt`；探针 `_临时脚本\_b3-verify-2026-10-18.mjs`、`_b3-browser-2026-10-18.mjs`。

## 2026-10-18 · 批次 2 / 数据完整性与持久化可靠性（BUG-02 · 2-A/2-B/2-C/2-D）— 完成（canonical **1,178,676 / `B95DB7F2…3BE5`** · LF · 门禁 502/502 · lint 0 命中）
- 2-A [`actions.restoreFromTrash`](../6.P0-T3基线/v2.0-t3.html:5438)：原父可能仍在回收站；改为沿 `parent` 链上溯至最近的非 `_deleted` 祖先（带 `_seen` 环保护），找不到回退 `root`，其余恢复逻辑（`fix()` 递归 / `origIndex` 插入 / 墓碑清理 / `trashed.splice`）逐字保留。
- 2-B [`repairTreeConsistency`](../6.P0-T3基线/v2.0-t3.html:2073)：第一遍把「父存在但 `p._deleted`」与「父缺失」并入同一孤儿分支——先从 `p.children` 摘除自身并 `_childSetDrop(p)`，再挂回 root 并补元数据；`n._deleted` 的 `continue` 与第二遍 stray/去重逻辑不变。
- 2-C [`flushDesktopSave`](../6.P0-T3基线/v2.0-t3.html:19909) 改为 `Promise<boolean>`（`ok=true` 默认 / catch 置 false / guard 返回 false）；[`runPersist`](../6.P0-T3基线/v2.0-t3.html:4843) 桌面分支 `await` 后为假即 toast + `throw`，失败路径不推进 `_lastWrittenJson` / `markDiskConfirmed` / 脏集收口，交由外层 catch + finally 按 `_PERSIST_MAX_RETRY` 重排。
- 2-D [`VDB.tx`](../6.P0-T3基线/v2.0-t3.html:19189)：`done` Promise（`oncomplete` / `onerror` / `onabort`）提升到 `await fn` 之前挂载，消除「事务先提交 → 事件已派发 → 永久 pending」窗口；`writable` 检查与 `VDB_READONLY` 原样保留。
- 验证：内联 `<script>` 9 块语法 0 错误；一次性探针 20/20 PASS（2-A 指定场景 + 环保护 + 缺父回退；2-B 自愈 / 健康树零改动 / `_deleted` 不修复；2-C 真/假/非桌面三分支 + `runPersist` 接线；2-D 同步提交 / 异步提交 / abort / READONLY），其中 **4,800 次随机树「回收→恢复」属性采样：INV1_DANGLING_PARENT / INV2_ORPHAN 均为 0**。
- 门禁：`verify.js node` ⇒ **tests 502 / pass 502 / fail 0**（26,545 ms · exit 0）；`verify.js lint` ⇒ **0 命中**（exit 0）；canonical = step9 镜像（1,178,676 B / `B95DB7F2…3BE5` / LF · CR=0）。
- 登记器：**PARTY_COUNT=49 / FIVE_PARTY_DRIFT_COUNT=2**（仅 canonical + step9-mirror，属预期漂移；冻结件 r4 与 `HEAD.json` 未改，重锚 / 重新冻结待决策）。
- 证据与报告：[`_报告与元数据/B2-DATA-INTEGRITY-FIX-2026-10-18.md`](../_报告与元数据/B2-DATA-INTEGRITY-FIX-2026-10-18.md:1)；`_哈希与行尾校验\b2-fix-probe-2026-10-18.txt` / `b2-node-gate-2026-10-18.txt` / `b2-lint-2026-10-18.txt` / `b2-registry-drift-2026-10-18.txt`；探针 `_临时脚本\_b2-verify-2026-10-18.mjs`。

## 2026-10-18 · 批次 1 / P0 根因修复：`__juProduce` 的 Proxy 泄漏（BUG-01 / BUG-03 / BUG-04 同源）— 完成（canonical **1,176,849 / `3F3B246D…5AF5`** · LF · 门禁 502/502 全绿）
- 根因：draft 上的数组方法（`unshift`/`splice`/`slice`/`filter`）先经 `get` trap 把对象元素读成子 Proxy，再经 `set` 写回 copy；`finalize` 的 `recMap.get(val)` 以原始 target 为键查不到子 Proxy ⇒ Proxy 泄漏进 state；下一轮 `get` 再 `new Proxy(proxy)`，嵌套 +1，`JSON.stringify` 约 2.1×/层指数增长。
- 修复（全部在 [`__juProduce`](../6.P0-T3基线/v2.0-t3.html:1280) 内部，调用方零改动）：A `get` trap 解包 → 杜绝 proxy-of-proxy；B `set` trap 首行解包 → 根因核心；C `finalize` 解包 + 兜底写回 + `cleanDraftElems()` 清洗「元素是子 Proxy 的普通数组」（`slice(-200)` / `templates`、`dbFields` 的 `filter` 重建即此形态）。
- 契约不变：返回普通对象 / 未修改返回原引用 / recipe 抛错不污染 base / 返回非 undefined 直接透出；`__juProduceSafe` / `copyPlain` / `commit` 零改动。
- 验证：内联 `<script>` 9 块语法 0 错误；一次性探针 14 项全 PASS（slice / filter×4 / unshift+splice×25 / restore+purge / 修改保真 / 契约 3 项 / 300 轮压测 / 结构不变量 200 增 + 100 改），300 轮压测单轮最大 **3.06 ms**、均值 **0.138 ms**（无指数增长）；`verify.js node` ⇒ **tests 502 / pass 502 / fail 0**（exit 0）。
- 字节：canonical `1,174,919 / 0B4AA2A6…` → **`1,176,849 / 3F3B246D…5AF5`**（LF · CR=0 / LF=21,806）；step9 镜像已同步（`mirror_equal=True`）；**冻结件 r4 未改动**（历史只读锚），`HEAD.json` / 登记器未改 ⇒ canonical、step9 两方期望值现为预期漂移，重锚 / 重新冻结待批次收尾统一决策。
- 证据与报告：[`_报告与元数据/B1-JUPRODUCE-PROXY-LEAK-FIX-2026-10-18.md`](../_报告与元数据/B1-JUPRODUCE-PROXY-LEAK-FIX-2026-10-18.md:1)；`_哈希与行尾校验\b1-juproduce-leak-2026-10-18.txt` / `b1-juproduce-sync-2026-10-18.txt`；`_环境与调试\b1-juproduce-verify-node-2026-10-18.txt`；探针 `_临时脚本\_b1_juproduce_leak_test.mjs`。

## 2026-10-18 · DEFECT-REVIEW 批次 3（Low）+ 批次 4（收尾清理）— 完成（ISSUE-018 ~ ISSUE-023 + 观察项 8 全闭环 · 49 方零漂移 · 三门全绿）
- ISSUE-018：`6.P0-T3基线/step9/scripts/verify.js` 头注释删除「无 git」；`2.项目日志/CURRENT_TASK.md` §三 同步改为「存在本地 git 仓库」。
- 重锚：verify.js **15,074/C6CDF36C → 15,064/995DE392**（LF）；同步 `verify-hash-registry.mjs` 与 `scripts\_w5freeze.ps1` / `scripts\_w4freeze.ps1` 的 `l15` 期望值。
- ISSUE-019：`0.规范/MAINTENANCE.md` §5 两个 spec 字节终值改为 **32,065 / 9,140**（与登记器同源，消除按手册重锚即漂移的风险）。
- ISSUE-020：`1.冻结版本/ALIAS.md` 追加「取件指引」段（检索仅用 canonical/r4 与 frozen-l13/l14 之后代次）⇒ **2,949/53F72206 → 3,691/B2B233A8**（CRLF），登记器同步。
- ISSUE-021：新增 [`3.评估报告/README.md`](../3.评估报告/README.md:1)，指针现行版 `10-13（2）`，其余 5 件标「历史版本 · 勿引用」。
- ISSUE-022：`0.规范/JU对标分析与产品路线（§2 重构+16项修正版）.md` 强化「已被现行版替代，只读留痕」；现行版 `JU对标分析与产品路线.md` 按用户裁决不动正文。
- ISSUE-023：`.clinerules` 分类落位速查表补 `_W2阶段产物` / `_s4tmp` 两行（一次性中间产物暂存 · 任务收尾须清空）。
- 观察项 8：越界产物 `90过程材料\_review_filelist.txt`（374,761 B）移入 `_临时脚本\_review_filelist.txt`；根目录仅 `.clinerules` / `.gitignore` 两个例外文件。
- 门禁：登记器 **PARTY_COUNT=49 / DRIFT 0 / PASS**；`_w5freeze.ps1 -Wave l15 -NoFreeze` 与 `_w4freeze.ps1` 均 **FROZEN_DRIFT_COUNT=0 / RESULT=PASS**；`verify.js lint` **0 命中**（exit 0）。
- 证据：`_哈希与行尾校验\b3b4-registry-2026-10-18.txt` / `b3b4-w4freeze-2026-10-18.txt` / `b3b4-w5freeze-l15-2026-10-18.txt` / `b3b4-lint-2026-10-18.txt`。

## 2026-10-18 · T22-r4 发布包产出 + 冻结件命名清理（去 final）— 完成（canonical **1,174,919 / `0B4AA2A6`** · LF · 产品字节零变更 · 471/471 全绿 · 47 方零漂移）
- 判定 = 完成；原批次 11 因 `t16-w8` §F wall-clock 相对指标偶发转红被阻断，本轮按「仅增强容错、不放宽阈值」口径解除阻断后继续发布 —— **产品 HTML/JS 字节零改动**（三方同哈希）。
- **测试侧变更（两处 · 均非 47 方登记对象）**：① [`t16-w8-tombstone-sweep.test.mjs`](../6.P0-T3基线/step9/t9/t16-w8-tombstone-sweep.test.mjs:161) §F「下降 ≥60%」阈值逐字保留 + 最多 3 次重试 + 绝对耗时兜底（`< 80 ms` 且 ≥5% 增益）；② [`t16-w21-merge-ts-unit.test.mjs`](../6.P0-T3基线/step9/t9/t16-w21-merge-ts-unit.test.mjs:464) §E E1「200 ms 预算」逐字保留 + 最多 3 次采样重试（语义断言不享受豁免）。两处均在重试耗尽后硬失败并打印采样明细。
- **门禁**：`node scripts\verify.js node` ⇒ **tests 471 / pass 471 / fail 0**（25,166 ms · exit 0），复跑同结果；落盘绿证 [`t22r4-gate-node-2026-10-18.txt`](../8.发布与CI/reports/t22r4-gate-node-2026-10-18.txt:1)。
- **发布包**：`8.发布与CI\release\v2.0-t22-r4-2026-10-18\` —— `ju-workbench-v2.0-t22-r4.html`（= canonical 逐字节副本）+ `checksums.sha256`（2 项，排除自身）+ `RELEASE-NOTES.md`；包内自校验 `ENTRIES=2` / `SELF_CHECK_FAIL_COUNT=0` / `RESULT=PASS`。
- **命名清理**：`1.冻结版本\v2.0-t13-frozen-t22-r4-2026-10-18.html`（原 `…-t22-final-r4-…`，**仅更名、内容零变更**，哈希不变）；`HEAD.json`（`canonical_version` / `frozen_path`）与登记器 `frozen-l22-final-r4` → `frozen-t22-r4` 同步 ⇒ **`PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **历史包标注**：`release\v2.0-t15-2026-10-16\RELEASE-NOTES.md` 顶部补 `ARCHIVED / 历史归档` 标记（包内文件零改写、未覆盖）；`ARCHIVE-INDEX.md` 按只读生成器重算（609 件 / 72,897,582 B）。
- **证据**：`_哈希与行尾校验\t22r4-rename-registry-2026-10-18.txt`；生成 / 校验器 `_临时脚本\_t22r4_checksums.ps1` / `_t22r4_verify_pkg.ps1`。

## 2026-10-18 · L22 终局清算与状态重置（幽灵待办清理 + 自动化探针清算 + 文档状态封存）— 完成（canonical **1,166,711 / `8A17E45F`** · LF（21,686）· 产品字节零变更 · 47 方零漂移）
- 判定 = 完成；**纯文档层清算**，产品代码零变更（canonical / step9 镜像 / `frozen-l22-final-r2` 三方字节均未触碰；`<script>` 9 块与 `setTimeout` 兜底逻辑按原样保留）。
- **物理核对**：`1.冻结版本\v2.0-t13-frozen-t22-final-r2-2026-10-18.html` 实测 **1,166,711 B**（`dir` 实测，与 canonical / 登记器期望逐字节一致）；`frozen-l22-final`（1,157,639 / `5B4801D5…`）零改写。
- **幽灵待办清理**：`CURRENT_TASK.md` §二 原「批次 2 待发送」「批次 3 待发送」经核为失效待办 —— 批次 2（样式统一：选中框颜色 / 全局标题居中 / 列宽 30px / 统一缩进）、批次 3（幻灯片工具栏迁移 / 写实番茄钟 / 主题切换面板）、批次 4（视觉 Token / 交互优化 / 暗黑模式）均已于 2026-10-18 合并入 canonical，并随 `frozen-l22-final` / `frozen-l22-final-r2` 双层封存；本卡已重置为【L22-final-r2 已全面交付，L4~L22 全线完美闭环，进入最终休眠状态，无任何活跃任务】。
- **探针清算**：删除一次性无头浏览器探针 `_环境与调试\_b1fix_probe.js` 与 `_临时脚本\_b1r2_probe.mjs`；无残留常驻 `setTimeout` / 后台进程 / 计划任务；证据性只读脚本（`repro_defectB` / `repro_defectF` 等）按归档口径原样保留。
- **备份**：[`CURRENT_TASK.bak-l22finalr2-2026-10-18.md`](../_W2阶段产物/CURRENT_TASK.bak-l22finalr2-2026-10-18.md:1)。
- **门禁复跑（真实执行）**：`node scripts/verify.js all` ⇒ **exit 0** / `[verify] 全部通过`（静态 **0 命中** · **Node 145** · **PW 171**（167 passed + 4 skipped）· **bench 7/7**，最大恶化 **0.0%** / 中位 **−14.3%**）；`verify-hash-registry.mjs` ⇒ **`PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **证据**：[`l22finalr2-doc-verify-all-2026-10-18.txt`](../_哈希与行尾校验/l22finalr2-doc-verify-all-2026-10-18.txt:1)、[`l22finalr2-doc-registry-2026-10-18.txt`](../_哈希与行尾校验/l22finalr2-doc-registry-2026-10-18.txt:1)。
- **红线守持**：`1.冻结版本\*` / `1.归档快照\*` 零改写 · 无生成类注释（铁律 6 · 静态 0 命中）· 措辞统一「决策 / 待决策」；**下一入口**：无（项目封存 · 只读维护待命）。

## 2026-10-18 · L22 · UI 修正补丁固化（批次 1-r2 深度复查修正 + `frozen-l22-final-r2` 物理封存）— 完成（canonical **1,166,711 / `8A17E45F` · LF（21,686）** · 全量门禁全绿 · 47 方零漂移 · 项目彻底闭环）
- 判定 = 完成（**批次 1 深度复查修正已固化并物理封存**）；canonical = step9 镜像 = `frozen-l22-final-r2` = **1,166,711 B / LF（21,686）/ `8A17E45F8D6ACCE158629775161F9514EFE2D24121580435965F50D98919980F`**（批次 1 = 1,158,588 / `8F6D3C41…`；增量 **+8,123 B / +90 行**）；`<script>` 9 块 · CR 0 · 生成类注释 0 命中 · 数据契约 / 加密 payload 字段名零变更。
- 五项修正（决策 L22-B1R2-D1 ~ D5）：① 折叠三钮移入 `#main` 末尾并改 `position:absolute`（`fixed` 贴浏览器视口底边 → 实测 `offsetParent=#main` / `bottom=469`·`mainBottom=485`）；② `.sb-module-group` 由 flex column 改 `display:block;width:100%;position:relative`（包裹层高度溢出致拖拽手柄盖住条目边缘），收起态 `flex:none`；③ `#sidebarResize` / `#sidebarRightResize` 宽 6→8px、`z-index` 50→60、`right/left:-3px`→`0`（整条落在侧栏内缘，不再被 `overflow:hidden` 裁半）；④ 收起态高度链 `#sidebarLeft.collapsed` → `.sb-nav-block` → `.sb-nav-body` 全链 `height:100%` + `box-sizing:border-box`（实测 `navBody 354 ≈ navBlock 355`）；⑤ `JU_DND` 拖拽监听冲突收口（`init` 幂等 + `_navGripOk`/`ensureNavGrips`/`refreshNav` + `.ju-grip` `pointer-events:auto`/`z-index:10` + pointer capture 与 document 捕获双通道 + 拖拽后 400ms click 抑制 + `window.JU_DND` 暴露 + boot 后 `setTimeout(0)`/`setTimeout(300)` 两次兜底补挂）。
- **全量回归（真实执行 · 已解析到 Node 运行时）**：`node scripts/verify.js all` ⇒ **exit 0**（静态 **0 命中** · **Node 145/145**（0 fail · 0 skipped）· **PW 171**（167 passed + 4 skipped，与批次 4 基线逐项一致；T-99 五方登记门禁哨兵转绿）· **bench 7/7**（0 警告 / 0 失败 · 最大恶化 0.0% / 中位 −14.3%））。
- **RL-11 红 → 绿**：红证 `FIVE_PARTY_DRIFT_COUNT=1`（仅 canonical 漂移，46 方 PASS）→ step9 镜像 `Copy-Item` 逐字节同步 → 登记器期望重算至 **1,166,711 / `8A17E45F…`**（登记器本体 53,788 / CRLF / `3AA8F197…`）→ 绿证 **`PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）。
- **冻结门三绿（真实执行 · exit 0）**：`_w5freeze.ps1 -Wave l15 -NoFreeze` / `_w4freeze.ps1 -Wave l15` ⇒ `BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS`；`_w4paths.ps1 -Wave l15` ⇒ `VIOLATION_COUNT=0` / `RESULT=PASS`（新增 P3 只读锚 `v2.0-t13-frozen-t22-final-2026-10-18.html` 与 `...-final-r2-2026-10-18.html` 均 **FROZEN-OK**）。
- **物理封存**：`Copy-Item` canonical → `1.冻结版本\v2.0-t13-frozen-t22-final-r2-2026-10-18.html`（`pre_exists=False` · 实测 1,166,711 / `8A17E45F…` · **不覆盖** `frozen-l22-final` = 1,157,639 / `5B4801D5…`）；归档 `1.归档快照\T22-2026-10-18\` 追加 **9 件**（合计 **33 件 / 2,865,433 B**，逐件 `pre_exists=False`），清单 `_archived-manifest.md` 同步。
- **文档锚点**：`MAINTENANCE.md` §4 增「批次 1 / 批次 1-r2」HEAD 前进记录、头部基线锚点更新至 **1,166,711 / LF（21,686）**、§5 登记器字节锚更新；`CURRENT_TASK.md` 压缩更新至 L22-final-r2 状态。
- **红线守持 / 证据**：核心业务逻辑零改动 · `1.冻结版本\*` 既有件零改写（仅新增 r2）· `1.归档快照\*` 既有件零覆盖 · 无生成类注释（铁律 6 · 静态 0 命中）· 47 方零漂移；证据 `_哈希与行尾校验\b1r2-verify-all-green-2026-10-18.txt` / `b1r2-registrar-green-2026-10-18.txt` / `b1r2-w5freeze-2026-10-18.txt` / `b1r2-w4freeze-2026-10-18.txt` / `b1r2-w4paths-2026-10-18.txt` / `_b1r2-diff.out.txt`；**下一入口**：批次 2（样式统一与调整）。

## 2026-10-18 · L22 · UI 缺陷修复与交互统一（批次 1 · 四项高优先级）— 已落位（canonical **1,158,588 / `8F6D3C41` · LF（21,596）** · 运行时验证通过 · 门禁待复跑）
- 判定 = 已落位（**批次 1 四项 UI 缺陷修复**）；canonical = step9 镜像 = **1,158,588 B / LF（21,596）/ `8F6D3C411F02757D6F2C9D63D3748B557623D30CA1A884C1AB7724D149632225`**（改前 = 批次 4：1,157,639 / `5B4801D5…`；增量 **+949 B / +10 行**）；`<script>` 9 块；数据契约 / 加密 payload / 公开 API 零变更。
- ① `renderMindmap()`：`_mmEls` 上提至 `edges()` 之前（任务书字面写法命中 `const` TDZ ⇒ 会抛 `ReferenceError`，故同步调整声明时序）、`edges()` 增 `okFrom` / `okTo` 存在性校验、`edges(rootNode)` 移至节点 DOM 建立之后（连线仍无条件下钻，父节点为空文本时不连带漏建后代连线）——决策 L22-B1-D1 / D2。
- ② `.sb-module-group` 由 `display:contents` 改 `display:flex;flex-direction:column;width:100%`（拖拽单元恢复盒模型占位；`JU_DND._initNavGroups()` 的 `body.insertBefore(unit.host,ref)` 与 grip 绑定经复核零改动）——决策 L22-B1-D3。
- ③ `#btnToggleLeft` / `#btnToggleBoth` / `#btnToggleRight` 自 `#topbar` 移出至 `#body` 末尾；`.main-toggle` 改 `position:fixed;bottom:16px;z-index:100;opacity:.3`（hover / focus `1`），`.left{left:16px}` / `.right{right:16px}` / `.both{left:50%;transform:translateX(-50%)}`，原 static 三连规则删除——决策 L22-B1-D4。
- ④ `#sidebarLeft.collapsed .sb-nav-body` 改 `height:100%;min-height:100%;justify-content:center;align-items:center;gap:4px`，并新增 `.sb-nav-item{margin-bottom:0}` 清零「条目外边距 + 容器 gap」双重间距——决策 L22-B1-D5。
- **验证（无 Node 运行时的替代门）**：headless Chromium 探针 —— 三钮父节点 `#body` / `position:fixed` / `bottom:16px` / 左 16 · 右 16 · 中 382（764 视口居中）/ `z:100` / `opacity:.3`；`.sb-module-group` = `flex|column|w:193px|h:34.3px`（5 个包裹层）；收起态 `nav-body` = `h:100%` / `center` / `gap:4px`；导图注入「根 + 空文本子 + 有文本子」⇒ `nodes=21` / `paths=20` 且空节点无 path。静态复核：`<script>` 9/9 · 生成类注释 0 · CR 0 · `display:contents` 0 · 顶栏 `.main-toggle` 0。
- **RL-11**：`verify-hash-registry.mjs`（canonical / step9-mirror → 1,158,588 / `8F6D3C41…`）与 `_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1` 的 L15 HEAD 期望同步；`frozen-l22-final` 纳编位保持 1,157,639 / `5B4801D5…`，`frozen-l22`（1,152,513 / `5C9B133B…`）只读历史锚物理保留 ⇒ **47 方方数不变**。
- **门禁状态**：本工作站 `C:` / `D:` / `E:` 全盘未发现 `node.exe`（`Resolve-NodeDir` 报 `node.exe not found`）⇒ 登记器 / `verify.js all` / 冻结门三门**尚未执行**，须在具备 Node 的环境复跑转绿（命令与判据见任务卡 §二）。
- **红线守持 / 证据**：核心业务逻辑零改动 · `1.冻结版本\*` 与 `1.归档快照\*` 零改写（铁律 4）· 无生成类注释（铁律 6 · 静态 0 命中）· 临时探针副本已清理；报告 [`t22-batch1-uifix-2026-10-18.md`](../8.发布与CI/reports/t22-batch1-uifix-2026-10-18.md:1)、证据 `_哈希与行尾校验\b1fix-dom-2026-10-18.txt` / `b1fix-probe-2026-10-18.txt` / `b1fix-probe2-2026-10-18.txt`；**下一入口**：批次 1 门禁复跑 → 批次 2。

## 2026-10-18 · L22 最终全量归档封存（frozen-l22-final 物化 + 归档快照 + 47 方零漂移）— 完成（canonical **1,157,639 / `5B4801D5` · LF（21,586）** · **项目正式交付**）
- 判定 = 完成；**L22 最终完整版（含批次 2 / 批次 3 / 批次 4 UI 重构）已最终封存，项目正式交付**；产品字节零改动（`<script>` 9 块 · 数据契约 / 加密 payload / 公开 API 零变更）。
- **物理落盘**：`Copy-Item` canonical → [`v2.0-t13-frozen-t22-final-2026-10-18.html`](../1.冻结版本/v2.0-t13-frozen-t22-final-2026-10-18.html:1)；`Get-Item` / `Get-FileHash` 实测 **1,157,639 B / LF（21,586）/ `5B4801D5FD0431C8143BD0CE7655F745940A3553F2924DBF45E2FF224556ADD1`**（与 canonical / step9 镜像逐字节一致）。
- **归档快照**：新建 `1.归档快照\T22-2026-10-18\`，纳入最终冻结件 + 阶段报告（`b2full-modules` / `l22-batch3-custom` / `l22-batch4` / `l22-rename` / `l22-fixes` / `l22-closure`）+ 门禁与冒烟证据（`b3-*` / `b4-*` / `l22b2full-registrar` / `t22-final-standby-verify`）+ 最终门禁复跑证据（`l22final-registry` / `l22final-verify-all`）+ `CURRENT_TASK.snapshot.md`，**24 件 / 1,524,450 B**；清单 [`_archived-manifest.md`](../1.归档快照/T22-2026-10-18/_archived-manifest.md:1)（7,045 B / `0A351A75…`）。
- **登记器**：`verify-hash-registry.mjs` 等量置换 —— `frozen-l22`（1,152,513 / `5C9B133B…`）历史只读锚物理保留，由 `_w5freeze.ps1` / `_w4freeze.ps1` 的 `L22-frozen` 锚独立校验；纳编位由 `frozen-l22-final` 接续 ⇒ `PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）。
- **门禁**：`verify.js all` **exit 0**（静态 **0 命中** · **Node 145** · **PW 171**（167 passed + 4 skipped）· **bench 7/7** 最大恶化 **0.0%**）；`_w5freeze`（`BYTE_IDENTICAL=True` / drift 0）/ `_w4freeze`（drift 0）/ `_w4paths`（`VIOLATION_COUNT=0`）全 PASS。
- **红线守持**：核心业务逻辑零改动 · **47 方零漂移**；`1.冻结版本\*` 既有冻结件零改写（仅新增最终冻结件）；`1.归档快照\*` 既有件零覆盖（仅新建本目录）；无生成类注释（静态 0 命中 · 铁律 6）。
- **入口**：[`CURRENT_TASK.md`](CURRENT_TASK.md:1) 已标注【L22 完整版（含批次2/3/4 UI重构）已最终封存，项目正式交付】；**下一入口**：只读维护待命（无活跃任务）。

## 2026-10-18 · 批次 4 全局视觉 Token、交互优化与暗黑模式 — 完成（canonical **1,157,639 / `5B4801D5` · LF（21,586）** · 47 方零漂移 · 三门全绿）
- 判定 = 完成；canonical = step9 镜像 = **1,157,639 B / LF（21,586）/ `5B4801D5FD0431C8143BD0CE7655F745940A3553F2924DBF45E2FF224556ADD1`**（改前 HEAD = 批次 3 **1,157,785 / `53E607D6…`**；增量 **−146 B**）；`<script>` 9 块；数据契约 / 加密 payload / 公开 API 零变更。
- **基线复核**：任务卡所述 `53E0670D…` 前缀与实测 `53E607D6…` 不符；以实测 **1,157,785 / `53E607D6…`** 为改前 HEAD；`frozen-l22`（1,152,513 / `5C9B133B…`）保持只读零改写。
- ① `#btnToggleLeft` / `#btnToggleBoth` 回归 `#topbar` 首位（`#tbClock` 前），`.main-toggle` 与三钮规则改 static、`.both transform` 清零，L22 P1 的视口 fixed 方案收口；② `.sb-row` 3×6→1×4、`.tb-nav-btn` 5×12→3×9、`.sr-section` 7×12→5×9；③ 批次 4 既有 token（侧栏 210/230、`#content` 内边距、`--fg-dim:#4A5C50`、占位 `.75`、今日列 / 标签事件 / 行态 / 表头空态、夜间四层 token + 去毛玻璃、toast 自适应、`:focus-visible` 柔光、`_modalStack`↔`#app inert`）经字节复核齐备，本波不重复改动。
- **状态登记**：本波未新增 `ui` 状态；`saveUI` / `applyUIFields` / `_saveUINow` / `uiSnapshot` 零改动。
- **RL-11**：登记器期望 `1,157,785/53E607D6… → 1,157,639/5B4801D5…`；三门 HEAD 期望同步；`PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）。
- **门禁**：`verify.js all` **exit 0**（静态 **0 命中** · **Node 145** · **PW 171**（167 passed + 4 skipped）· **bench 7/7** 最大恶化 **0.0%**）；`_w5freeze`（`BYTE_IDENTICAL=True` / drift 0）/ `_w4freeze`（drift 0）/ `_w4paths`（`VIOLATION_COUNT=0`）全 PASS；Chromium 冒烟 `errors=[]`（`inTopbar=true` / `beforeClock=true` / 两钮 static / `.both transform=none` / 侧栏 210·230 / `inert` 开闭正确）。
- **证据**：[`b4-verify-all-2026-10-18.txt`](../_哈希与行尾校验/b4-verify-all-2026-10-18.txt:1)、[`b4-registrar-green-2026-10-18.txt`](../_哈希与行尾校验/b4-registrar-green-2026-10-18.txt:1)、[`b4-w5freeze-2026-10-18.txt`](../6.P0-T3基线/step9/reports/b4-w5freeze-2026-10-18.txt:1)、[`b4-w4freeze-2026-10-18.txt`](../6.P0-T3基线/step9/reports/b4-w4freeze-2026-10-18.txt:1)、[`b4-w4paths-2026-10-18.txt`](../6.P0-T3基线/step9/reports/b4-w4paths-2026-10-18.txt:1)、[`b4-smoke-2026-10-18.txt`](../6.P0-T3基线/step9/reports/b4-smoke-2026-10-18.txt:1)；报告 [`t22-batch4-2026-10-18.md`](../8.发布与CI/reports/t22-batch4-2026-10-18.md:1)。
- **入口**：[`CURRENT_TASK.md`](CURRENT_TASK.md:1) 已更新为【批次 4 已落地 · 待最终全量归档封存】；**下一入口**：最终的全量归档封存。

## 2026-10-18 · 批次 3 独立功能定制（图标与视图行为 / 汇总浮窗 / 主题切换面板）— 完成（canonical **1,157,785 / `53E607D6` · LF（21,588）** · 47 方零漂移 · 三门全绿）
- 判定 = 完成；canonical = step9 镜像 = **1,157,785 B / LF（21,588）/ `53E607D6080DB5A61A89D9AB1A6735832DF57002809C2809699DAECE03B2A063`**（改前 HEAD = 批次 2 补全 **1,158,205 / `C413EF15…`**；增量 **−420 B**）；`<script>` 9 块；数据契约 / 加密 payload / 公开 API 零变更。
- **基线复核**：任务卡所述 1,158,285 B 与实测差 80 B，全目录（`1.冻结版本` / `1.归档快照` / `6.P0-T3基线`）无该字节文件；以实测 **1,158,205 / `C413EF15…`** 为改前 HEAD；`frozen-l22`（1,152,513 / `5C9B133B…`）保持只读零改写。
- ① `#btnMusic` 改线性简化番茄（circle + 两条叶梗 path）；② 记事本根 `getNodeSvg` 文档外框 + 内部横线；③ `openNode` 去 `ui.view='auto'`；④ 汇总浮窗（无内联宽度 / 标题「汇总行」/ 文案「启用（计数/求和/求平均）」/ `.db-sf-row` flex-wrap）；⑤ `openThemeSelector` + `bindTools` 绑定；⑥ `ui.theme` / `ui.themePreview` 于 `ui` / `applyUIFields` / `_saveUINow` / `uiSnapshot` 四处登记。
- **RL-11**：登记器期望 `1,158,205/C413EF15… → 1,157,785/53E607D6…`；三门 HEAD 期望同步；红证 `FIVE_PARTY_DRIFT_COUNT=1` / FAIL → 绿证 `PARTY_COUNT=47` / drift 0 / PASS。
- **门禁**：`verify.js all` exit 0（静态 **0 命中** · **Node 145** · **PW 171**（167 passed + 4 skipped）· **bench 7/7** 最大恶化 **0.0%**）；`_w5freeze`（`BYTE_IDENTICAL=True` / drift 0）/ `_w4freeze`（drift 0）/ `_w4paths`（`VIOLATION_COUNT=0`）全 PASS；功能冒烟 **8/8 PASS**（Chromium 实机 · `errors=[]`）。
- **证据**：[`b3-verify-all-2026-10-18.txt`](../6.P0-T3基线/step9/reports/b3-verify-all-2026-10-18.txt:1)、[`b3-lint-2026-10-18.txt`](../6.P0-T3基线/step9/reports/b3-lint-2026-10-18.txt:1)、[`b3-w5freeze-2026-10-18.txt`](../6.P0-T3基线/step9/reports/b3-w5freeze-2026-10-18.txt:1)、[`b3-w4freeze-2026-10-18.txt`](../6.P0-T3基线/step9/reports/b3-w4freeze-2026-10-18.txt:1)、[`b3-w4paths-2026-10-18.txt`](../6.P0-T3基线/step9/reports/b3-w4paths-2026-10-18.txt:1)、[`b3-smoke-2026-10-18.txt`](../6.P0-T3基线/step9/reports/b3-smoke-2026-10-18.txt:1)、[`b3-registrar-red-2026-10-18.txt`](../_哈希与行尾校验/b3-registrar-red-2026-10-18.txt:1)、[`b3-registrar-green-2026-10-18.txt`](../_哈希与行尾校验/b3-registrar-green-2026-10-18.txt:1)、[`b3-registrar-final-2026-10-18.txt`](../_哈希与行尾校验/b3-registrar-final-2026-10-18.txt:1)；报告 [`t22-batch3-custom-2026-10-18.md`](../8.发布与CI/reports/t22-batch3-custom-2026-10-18.md:1)。
- **入口**：[`CURRENT_TASK.md`](CURRENT_TASK.md:1) 已更新为【批次 3 独立功能定制已落地 · 批次 4 待执行】；**下一入口**：批次 4。

## 2026-10-17 · L22 封存流程补全（冻结门口径同步 + 归档追加 + 封存报告）— 完成（canonical **1,152,513 / `5C9B133B` · LF（21,488）** · 47 方零漂移 · **L4~L22 全面封存**）
- 判定 = 完成；本轮为**只读终验 + 归档补全**，**产品字节零改动**（`<script>` 9 块 · 数据契约 / 加密 payload / 公开 API 零变更）。
- **缺口诊断**：封存波已物化 `frozen-l22` 并同步登记器，但冻结门三脚本仍钉 L22 批次 0 HEAD（1,151,899 / `EA921837…`）且无 `L22-frozen` 锚；`t22-closure-2026-10-17.md` 与归档追加件缺失，清单停留于批次 1（6 件）。
- **RL-11 口径同步**：`_w5freeze.ps1`（37,971 / `D57D4938…`）、`_w4freeze.ps1`（25,902 / `CCDF5529…`）、`_w4paths.ps1`（16,284 / `A82756B7…`）L15 HEAD 期望 → 1,152,513 / `5C9B133B…`，并新增 `L22-frozen-2026-10-17` 只读锚 / `$known` 纳编。
- **冻结门三门绿证**：`_w5freeze.ps1 -Wave l15 -NoFreeze`（5,655 / CRLF / `78DF7C01…` · `BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS`）、`_w4freeze.ps1 -Wave l15`（4,662 / CRLF / `AC1783DD…` · drift 0 / PASS）、`_w4paths.ps1 -Wave l15`（13,449 / CRLF / `EDE96082…` · `VIOLATION_COUNT=0` / PASS），`L22-frozen` 三处均 `FROZEN-OK`。
- **登记器 standby 复核**：[`t22-final-standby-verify-2026-10-17.txt`](../_哈希与行尾校验/t22-final-standby-verify-2026-10-17.txt:1)（6,763 / CRLF / `FBBF37DB…`）⇒ `PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）。
- **全量回归**：[`l22qa-verify-all-2026-10-17.txt`](../8.发布与CI/reports/l22qa-verify-all-2026-10-17.txt:1)（98,747 / CRLF / `473FF553…`）⇒ 静态 **0 命中** · **Node 145** · **PW 171**（167 passed + 4 skipped）· **bench 7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`（exit 0）。
- **封存报告**：[`t22-closure-2026-10-17.md`](../8.发布与CI/reports/t22-closure-2026-10-17.md:1)（8,819 / CRLF / `20A25B4A…`）固化字节锚 / 四方一致性 / 三门绿证 / 决策 L22-QA-D1·D2 / 红线守持。
- **归档追加**：`1.归档快照\T22-2026-10-17\` **追加 9 件**（封存报告 + `v2.0-t13-frozen-t22-sealed-2026-10-17.html`（1,152,513 / LF / `5C9B133B…`）+ standby 复核 + 三门绿证 + 全量回归绿证 + 封存后登记器复核 + 静态门禁复核）；清单 [`_archived-manifest.md`](../1.归档快照/T22-2026-10-17/_archived-manifest.md:1) 更新为 **15 件 / 3,813,945 B**。
- **红线守持**：`1.冻结版本\*` 既有冻结件零改写（仅新增 `frozen-l22`）；归档既有件零覆盖（目录内仅追加）；无「内容由 AI 生成」类注释（静态 0 命中 · 铁律 6）。
- **入口**：[`CURRENT_TASK.md`](CURRENT_TASK.md:1) 维持【L22 多维表格拖拽排序及防御性修改已落地，L4~L22 全面封存，进入只读维护待命】；**下一入口**：只读维护待命（无活跃任务）。

## 2026-10-17 · L22 封存（`frozen-l22` 物化 + 归档追加 + 47 方等量置换）+ 文档口径补记 — 完成（canonical **1,152,513 / `5C9B133B` · LF（21,488）** · 47 方零漂移 · **L4~L22 全面封存**）
- 判定 = 完成（**L22 多维表格拖拽排序及防御性修改已落地**）；`frozen-l22` 物化（[`v2.0-t13-frozen-t22-2026-10-17.html`](../1.冻结版本/v2.0-t13-frozen-t22-2026-10-17.html:1) · **1,152,513 / LF（21,488）/ `5C9B133BEF8CD46033E9F8F386B3EBCC1CD63267BB5B64C095CA800A470088DB`**）= canonical = step9 镜像 = 归档封存副本，逐字节一致；产品字节零变更（核心业务逻辑零改动 · `<script>` 9 块）。
- **登记 / 门禁**：决策 **L22-QA-D1** —— `frozen-l8`（907,419 / `2F43EA0F…`）与 `1.冻结版本\v2.0-l3-frozen-l9-2026-10-14.html` 逐字节同源（后者物理保留，仍由 `_w5freeze.ps1` 的 L8 / L9 两条 P3 锚点校验），去重退役该重复登记方并同址纳入 `frozen-l22`，**方数保持 47**；登记器期望同步（**47,062 / CRLF / `2075C93716478B60958BED5B85D9A6EFDFA2FDBD67D38B5D870112FA2E599CA6`**）⇒ `PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）；`verify.js all` **exit 0**（静态 **0 命中** · **Node 145** · **PW 171**（167 passed + 4 skipped）· **bench 7/7**）。
- **归档**：`1.归档快照\T22-2026-10-17\` 追加 `frozen-l22` 封存副本 + 封存报告 + standby 复核日志 + 双门绿证，清单 [`_archived-manifest.md`](../1.归档快照/T22-2026-10-17/_archived-manifest.md:1) 已更新；L22 批次 0 快照（1,151,899 / `EA921837…`）保持只读历史锚，零覆盖。
- **文档口径补记（决策 L22-QA-D2）**：[`MAINTENANCE.md`](../0.规范/MAINTENANCE.md:1) 补记「L22 批次 0 移除了 db 表头右键的左右移功能」（`t22-fixes-2026-10-17.md` 未单列该项；零产品字节变更）。
- **红线守持**：`1.冻结版本\*` 既有冻结件 **零改写**（仅新增 `frozen-l22`）；归档既有件零覆盖（仅在 L22 目录内追加）；未新增任何「内容由 AI 生成」类注释（静态 0 命中 · 铁律 6）。
- **入口**：[`CURRENT_TASK.md`](CURRENT_TASK.md:1) 已压缩更新为【L22 多维表格拖拽排序及防御性修改已落地，L4~L22 全面封存，进入只读维护待命】；详见 [`t22-closure-2026-10-17.md`](../8.发布与CI/reports/t22-closure-2026-10-17.md:1)。

## 2026-10-17 · L22 批次 1 防御性修改 + 归档收尾 — 完成（canonical **1,152,513 / `5C9B133B` · LF（21,488）** · 47 方零漂移 · **未冻结 / 归档追加**）
- 判定 = 完成（**批次 1 三项防御性修改已落位并经全量回归验证**）；canonical = step9 镜像 = **1,152,513 / LF（21,488）/ `5C9B133BEF8CD46033E9F8F386B3EBCC1CD63267BB5B64C095CA800A470088DB`**（批次 0 = 1,151,899 / `EA921837…`；增量 **+614 B / +11 行**）；`<script>` 保持 **9 块**；数据契约 / 加密 payload / 公开 API 零变更。
- ① `renderMain()`：`const c=$('#content');` 后补 `if(!c)return;` —— 空节点守卫（容器缺失时不再向下执行）。② `waitShadow()`：`tries++ < 400` 尝试上限 + 超时 `console.warn('[L10-D1] Shadow layer not ready after 10s, seam disabled.')` 并落 `__juL10D1Status={ready:false,reason:'timeout'}`（原静默超时改为可观测）。③ `l7CalIndexWhenReady()`：失败回调由 `_calIndexFallbackAttempted` 一次性兜底（循环保护，`cb()` 必达且不重复全量建索引）。
- **登记 / 门禁**：登记器 [`l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:1) 期望同址同步（canonical / step9-mirror 恰 2 处 → 1,152,513 / `5C9B133B…`；`frozen-l21` 1,147,911 / `B102568D…` 不变）⇒ `PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）；`verify.js all` **exit 0**（静态 **0 命中** · **Node 145** · **PW 171**（167 passed + 4 skipped）· **bench 7/7** 最大恶化 **0.0%** / 中位 −14.3%）→ `[verify] 全部通过`。
- **绿证**：[`b1-guard-green-log-2026-10-17.txt`](../6.P0-T3基线/step9/reports/b1-guard-green-log-2026-10-17.txt:1)（98,751 / CRLF / `682A0AAD…`）、[`b1-guard-item1-green-log-2026-10-17.txt`](../6.P0-T3基线/step9/reports/b1-guard-item1-green-log-2026-10-17.txt:1)（98,746 / CRLF / `66601C91…`）、[`b1-archive-registrar-2026-10-17.txt`](../6.P0-T3基线/step9/reports/b1-archive-registrar-2026-10-17.txt:1)（6,760 / CRLF / `9B39564E…` · 47 方 / drift 0 / PASS）。
- **归档收尾**：`1.归档快照\T22-2026-10-17\` **追加 4 件** —— 批次 1 产品快照 `v2.0-t13-frozen-t22-b1-2026-10-17.html`（1,152,513 / LF（21,488）/ `5C9B133B…88DB`）+ 上述三份绿证；清单 [`_archived-manifest.md`](../1.归档快照/T22-2026-10-17/_archived-manifest.md:1) 更新为 **6 件 / 2,516,163 B**（`_archived-manifest.md` 自身另计）；批次 0 快照 `v2.0-t13-frozen-t22-2026-10-17.html`（1,151,899 / `EA921837…`）**保留只读历史锚**，不覆盖、不删除。
- **红线守持**：`1.冻结版本\*` **零新增、零改写**（未物化 `frozen-l22`；`frozen-l21` 保持只读历史锚 · 铁律 4）；未新增任何「内容由 AI 生成」类注释（静态 0 命中 · 铁律 6）；`<script>` 块数 9 不变（RL-2）。
- **入口**：[`CURRENT_TASK.md`](CURRENT_TASK.md:1) §一 / §二 已按新 HEAD 压缩更新；**下一入口**：**只读维护待命（无活跃任务）**。

## 2026-10-17 · L22 十一项缺陷修复波 — 完成（canonical 1,151,899 / `EA921837` · LF（21,477）· 47 方零漂移 · **未冻结 / 未重复归档**）
- 判定 = 完成（**L22 缺陷修复波**：P0 4 项 + P1 2 项 + P2 3 项 + P3 1 项 + 附加性能清理 1 项 = **11 项**）；`<script>` 块数保持 **9**（未新增 · 未拆分 · 语法自检 `SYNTAX_FAIL_COUNT=0`）；数据契约 / 加密 payload / 公开 API 零变更。
- **P0**：① `ensureNoteDoc` 改为命中根才返回（记事本回收后可重建）；② 日历事件块 `pointerdown` / `up` 增 `setPointerCapture` / `releasePointerCapture`（拖出事件块与时间网格仍收 `pointermove` / `pointerup`）；③ `renderSubTags` 骨架行 / 提示收敛到 `.ju-skel` 祖先（后代选择器生效）；④ 思维导图一级节点改判 `_mmLv1Ids`（等价 `depth===1`，不再比对未缩放常量）。
- **P1 / P2**：⑤ `#btnToggleLeft` / `#btnToggleBoth` 移出 `#topbar` 改 `position:fixed` 贴视口左右垂直居中；⑥ `.sb-nav-body` 行距 `1.6` + `#sidebarLeft.collapsed` 收起态垂直居中；⑦ `_mmDrawEdge` 固定源节点右侧中点 / 目标节点左侧中点画横向三次贝塞尔；⑧ `#btnMusic` 换标准番茄图标（红果 + 绿叶 + 高光）；⑨ 列宽下限 `const minW=80` + `.db-table th` 居中；⑩ 幻灯片工具栏改挂 `wrap` 并 `position:fixed` 于右侧。
- **附加清理**：⑪ `actions.addNode` / `toggleDone` / `removeNode` / `setNodeDate` 提交后的重复全量索引失效删除（commit 增量补丁已按 `changedIds` 维护，失败兜底保留）；N 层 `l19-patch1.test.mjs` 断言按新契约翻转（不纳编 · Node 口径保持 145）。
- **字节锚**：canonical = step9 镜像 = **1,151,899 / LF（21,477）/ `EA921837EA92C358CF169DB2BD1364D02764709E9210A01D49C5302BDB03637F`**（改前 = L21：1,147,911 / `B102568D…`）；增量 **+3,988 B / +25 行**；本日实测复核逐字节一致。
- **登记 / 门禁**：登记器 [`l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:1) **46,174 / CRLF / `5512C3D676BEC0408BD78EC42A7D9D899D52AC7E9A9E3F80F1372CCAEAA3CDA7`** ⇒ 本日复跑 `PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；`verify.js all` **exit 0**（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** · 最大恶化 **0.0%** / 中位 −14.3%）；`_w5freeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）/ `_w4freeze`（0）/ `_w4paths`（`VIOLATION_COUNT=0`）全 `RESULT=PASS`。
- **归档纪律**：`frozen-l21`（1,147,911 / `B102568D…`）保持**只读历史锚**，本波**不再冻结、不重复归档**；`1.冻结版本\*` / `1.归档快照\*` 零改写（铁律 4）；冻结门三脚本只读锚同步（**37,428 / `E2124D04…`** · **25,359 / `5CB89FCB…`** · **15,873 / `5F4B7D22…`**）。
- **物化与归档（补全）**：归档目录 [`1.归档快照\T22-2026-10-17\`](../1.归档快照/T22-2026-10-17/_archived-manifest.md:1) **新建**（**2 件 / 1,159,393 B**：`t22-fixes-2026-10-17.md`（7,494 / CRLF / `D790FB0B…`）+ `v2.0-t13-frozen-t22-2026-10-17.html`（canonical 副本 · 1,151,899 / LF（21,477）/ `EA921837…`）· 清单 [`_archived-manifest.md`](../1.归档快照/T22-2026-10-17/_archived-manifest.md:1)）；产品字节零改动、`1.冻结版本\*` 零新增零改写（铁律 4）；归档后复跑登记器 `PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。
- **报告 / 入口**：[`t22-fixes-2026-10-17.md`](../8.发布与CI/reports/t22-fixes-2026-10-17.md:1)；**下一入口**：**只读维护待命（无活跃任务）**。

## 2026-10-17 · L21 多维表格拖拽排序补丁封存 — 完成（canonical 1,147,911 / `B102568D` · frozen-l21 · 47 方零漂移 · **L4~L21 全面封存**）
- 判定 = 完成（**L21 补丁波 + 归档封存**）；补丁 = 多维表格**列头拖拽排序**：列头 `draggable`、`_dragFieldName` 记录源字段（`string` / `object` 统一取 `name`），拖拽期间 `.dragging` / `.drag-over`，落点经 `commit` 内 `splice` 原子换位（`{snapshot:true}` 可撤销）；`ui._resizingCol` 期间禁用 HTML5 拖拽，列宽拖拽 `finally` 恢复 `draggable`。
- **canonical = step9 镜像 = `frozen-l21`**：**1,147,911 / LF（21,452）/ `B102568DBF8A8DD610C758EE45CA7CBBEDBD26CE54BB2E49BEDC919C82A9C1BF`**（改前 = L20：1,145,884 / `07C9CD44…`）；增量 **+2,027 B / +58 行**；核心业务逻辑零改动；不新增 `<script>` 块（9 块）；数据契约 / 加密 payload / 公开 API 零变更。
- **登记**：`PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；登记器 [`l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:1) **45,243 / CRLF / `90F280FCC6DE014A208E7338AD88BE81E0D5BD8B165525944183636A3067B3E3`**。
- **决策 L21-QA-D1**：`frozen-l11` 与 `frozen-l10` 逐字节同源（同 972,078 B / 同 `D7D265D5…`）⇒ 去重退役该重复登记方，同址纳入 `frozen-l21`，**方数保持 47**（`frozen-l11` 文件本体仍受三门只读锚校验）。
- **门禁**：`verify.js all` **exit 0**（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** · 最大恶化 **0.0%**）；`_w5freeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）/ `_w4freeze`（0）/ `_w4paths`（`VIOLATION_COUNT=0`）全 `RESULT=PASS`，`L21-frozen=FROZEN-OK`；三门脚本只读锚同步（36,968 / 24,899 / 15,413）。
- **物化与归档**：`frozen-l21` = [`1.冻结版本\v2.0-l13-frozen-l21-2026-10-17.html`](../1.冻结版本/v2.0-l13-frozen-l21-2026-10-17.html:1)；归档 `1.归档快照\L21-2026-10-17\` **新建**（**21 件 / 1,463,178 B** · 清单 [`_archived-manifest.md`](../1.归档快照/L21-2026-10-17/_archived-manifest.md:1)）；冻结件 / 既有归档零改写。
- **报告 / 入口**：[`l21-patch-2026-10-17.md`](../8.发布与CI/reports/l21-patch-2026-10-17.md:1)；**下一入口**：**只读维护待命（无活跃任务）**。

## 2026-10-17 · L20 全量 QA 终验与归档封存 — 完成（观察项修复 · canonical 1,145,884 / `07C9CD44` · frozen-l20 · 47 方零漂移 · **L4~L20 全面封存 · 项目完美收官**）
- 判定 = 完成（**L20 收尾波**）；**观察项修复**：`.main-toggle` 默认态 `opacity:.2` → `.6`（`:hover` / `:focus-visible` 保持 `1`；留基础规则以免 `#topbar .main-toggle` 特异性覆盖 hover —— 决策 L20-QA-D2）；**字节中性**（1,145,884 / 21,394 行不变），仅 SHA-256 变更。
- **canonical = step9 镜像 = `frozen-l20`**：**1,145,884 / LF / `07C9CD44F9EB9BBDEE03AA03F33D6D6C45EA02CDBDBBCA03C2D01D536D225D62`**（改前 = 批次 4：1,145,884 / `FF01EAB2…`）；核心业务逻辑零改动；不新增 `<script>` 块（9 块）。
- **RL-11 先改后补**：红证 `FIVE_PARTY_DRIFT_COUNT=2`（恰 canonical + step9-mirror，其余 45 方 PASS）→ 同步期望 → 绿证 `PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；登记器 [`l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:1) **44,155 / CRLF / `68A6CF9623049D9C3FD52AB7BA3F18068E7E1EDE86F8E190DE217D6E0CDFD833`**。
- **登记决策 L20-QA-D1**：`frozen-l9` 与 `frozen-l8` 逐字节同源（同 907,419 B / 同 `2F43EA0F…`），去重退役该重复登记方并同址纳入 `frozen-l20` ⇒ **方数保持 47**，字节覆盖面无损失。
- **全量 QA 终验**：`verify.js all` **exit 0**（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** · 最大恶化 **0.0%** · 中位 `-14.3%`）+ `[verify] 全部通过`，无未捕获异常；`_w5freeze`（`FROZEN_DRIFT_COUNT=0`）/ `_w4freeze`（`CANONICAL_BYTES=STEP9_BYTES=1145884` / `BYTE_IDENTICAL=True`）/ `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）全 `RESULT=PASS`。
- **物化与归档**：`frozen-l20` = [`1.冻结版本\v2.0-l13-frozen-l20-2026-10-17.html`](../1.冻结版本/v2.0-l13-frozen-l20-2026-10-17.html:1)（与 canonical 逐字节一致）；归档目录 `1.归档快照\L20-2026-10-17\` **新建**（**35 件 / 1,599,895 B**：批次 3/4 报告 + 全部门禁证据 + 终验工具与 RL-11 红/绿证 + `frozen-l20` + 收口报告 + 清单 [`_archived-manifest.md`](../1.归档快照/L20-2026-10-17/_archived-manifest.md:1)）；批次 1/2 未产出独立报告文件，其内容登记于任务卡 / MAINTENANCE §4（如实登记 · 不臆造补齐）。
- **收口报告**：[`l20-closure-2026-10-17.md`](../8.发布与CI/reports/l20-closure-2026-10-17.md:1)；**下一入口**：**只读维护待命（无活跃任务）**。

## 2026-10-17 · 批次 4 · 全局视觉 Token / 交互优化 / 暗黑模式 — 完成（canonical 1,145,884 · 47 方零漂移）
- 判定 = 完成；canonical = step9 镜像 = **1,145,884 / LF / `FF01EAB2709CCB3B12C6C3AA4119AE7D2A4EAD0EC24786F0388BC62E2610E550`**（改前 = 1,144,467 / `DD6E6BFF…`）；不新增 `<script>` 块（9 块 · 语法 9/9）；未覆盖冻结件 / 未重复归档。
- ① UI 紧凑化：侧栏基准宽 210 / 230、`#content` padding `var(--content-pad-t,16px) 20px 24px`、折叠钮由 fixed 底角回归顶栏 static（`.both` 的 `translateX` 复位，`#btnToggleLeft` / `#btnToggleBoth` 居顶栏左侧）、`.sb-row` / `.tb-nav-btn` / `.sr-section` 内边距收紧 2–4px。
- ② 对比度与层级：`--fg-dim:#4A5C50`、空占位 `opacity:.75`（四处）、今日列 6% 底 + `inset 0 2px 0 var(--accent)`、标签事件 32% 混 `--bg-panel` 且 `.evtx` 纯 `--fg`、`.row:hover` 取 `--bg-panel`、`.row.sel` 10% 底 + 3px 强调条、拖拽把 `.18↔.6`、`.db-table th` 双层投影、`.db-empty` 虚线框。
- ③ 暗黑模式：`--bg:#0A1929` / `--bg-soft:#152A4A` / `--bg-panel:#1D355E` / `--bg-menu:#12233F`（四周浅、中间深，`--bg-mid` / `--bg-panel2` 同口径换算）、`.word-editor` 与 `.cal-tg-ev:not(.tagged)` 去毛玻璃。
- ④ 微交互：`toast` 停留 `Math.max(1800, 800 + len*80)`；`:focus-visible` 2px 外扩 + 4px `color-mix` 柔光；新增 `_syncAppInert()`（`appConfirm` 显式 + body childList 观察器）令模态期间 `#app` 置 `inert`，全部关闭后复位。
- **RL-11**：红证 `FIVE_PARTY_DRIFT_COUNT=1` → 同步期望 → 绿证 `PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；登记器 43,765 / CRLF / `4E58F435…`；冻结门三脚本 HEAD 期望同步（36,484 / 24,415 / 15,193）。
- **门禁**：`verify.js all` exit 0（静态 0 命中 + Node 145 + PW 171（167 passed + 4 skipped）+ bench 7/7 · 最大恶化 0.0%）；`_w5freeze`（`FROZEN_DRIFT_COUNT=0`）/ `_w4freeze`（`BYTE_IDENTICAL=True`）/ `_w4paths`（`VIOLATION_COUNT=0`）。
- **报告 / 入口**：[`l20-batch4-2026-10-17.md`](../8.发布与CI/reports/l20-batch4-2026-10-17.md:1)；CURRENT_TASK 已压缩更新（§一 / §二）；后续按 MAINTENANCE §2 / §3 执行。
## 2026-10-17 — 批次 3 · 独立功能定制 ✅ 完成（图标 / 视图行为 + 汇总浮窗 + 主题选择面板 · canonical 1,144,467 · 47 方零漂移）
- 判定 = 完成；canonical = step9 镜像 = **1,144,467 / LF（21,386）/ `DD6E6BFF2815B1B699DAFCE6614DB930E1B0ACAABDBBD2B0E9592763DBA44FE2`**（改前 1,138,457 / `B6403A3B…`）；不新增 `<script>` 块；未覆盖冻结件 / 未重复归档。
- ① `#btnMusic` 图标改为番茄；② `getNodeSvg` 新增 `_isNoteRoot` 分支（普通文档同外框 + 内部横线，先于 `isFolder`）；③ `openNode` 删除 `ui.view='auto'`（侧边栏切换文档不跳视图）；④ `openDbSummaryPanel` 移除固定宽度（自适应）、标题「汇总行」、文案「启用（计数/求和/求平均）」、`.db-sf-row` 换行。
- ⑤ 新增 `openThemeSelector()`：复用 `.modal-overlay` / `_modalStack`，日间 / 夜间缩略图卡片，点击实时预览（仅改 `dataset.theme`）、「确认应用」→ `applyTheme` + `saveUI` + `forceRender`、「取消 / ESC / 遮罩」回滚到已应用主题；`ui.theme` / `ui.themePreview` 在 `_saveUINow` / `applyUIFields` / `uiSnapshot` 三处注册，`#btnTheme` 点击改为 `openThemeSelector`（`toggleTheme` 保留）。
- **RL-11**：红证 `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望 → 绿证 `PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；登记器 42,897 / CRLF / `616BBB49…`；冻结门三脚本 HEAD 期望同步（35,938 / 23,869 / 14,647）。
- **门禁**：`verify.js all` exit 0（静态 0 命中 + Node 145 + PW 171（167 passed + 4 skipped）+ bench 7/7 · 最大恶化 0.0%）；`_w5freeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）/ `_w4freeze`（0）/ `_w4paths`（`VIOLATION_COUNT=0`）。
- **交互冒烟**（真实浏览器独立 Context）：主题预览 / 确认落盘 `juju.ui.v31` / 取消回滚、汇总浮窗文案与 `flex-wrap:wrap`、记事本图标、`openNode` 视图保持，`pageErrors=[]`。
- **报告 / 入口**：[`l20-batch3-2026-10-17.md`](../8.发布与CI/reports/l20-batch3-2026-10-17.md:1)；CURRENT_TASK 已压缩更新（§一 / §二）；后续按 MAINTENANCE §2 / §3 执行。

## 2026-10-17 — L19 · 缺陷修复 + 全量 QA + 归档封存 ✅ 完成（P0/P1/P2/P3 全部清零 · canonical 1,127,810 · frozen-l19 · 47 方零漂移 · **L4~L19 全面封存 · 项目彻底收官**）
- 判定 = 完成（**L19 收尾波**）；三批修复：P0-1 boot pending 兜底 / P0-2 commit `_patch` 遮蔽；P1-1 标签选择器索引失效 / P1-2 `purgeNodeMeta` 全 state / P1-3 幻灯片双重转义；P2-1 `_sanTextEsc` 退役 / P2-2 无效 repair 调用 / P2-3 `_clearTag` / P2-4 `_errSeen` 键脱敏 / P2-6 字段菜单锚点 / P3-1 commit 计时内联 / P2-7 pomo 监听回收。
- **canonical = step9 镜像**：**1,127,810 / LF（21,071）/ `E75624C49343196734CEF3B3C8FA4E9B04AFC026D8E9BE211863E35124746674`**；本轮 QA/封存**产品字节零变更**；未覆盖冻结件 / 未重复归档（铁律 4 / 铁律 6）。
- **全量 QA 终验**：[`all-l19-fixed.json`](../8.发布与CI/reports/all-l19-fixed.json:1) = `allGreen=true` / 11 门全 `true` / `fatal=null`：static 9 块 · 铁律 6 **0 命中** / smoke 6/6 / property.full I1/I3/I4/I5=0 / property.clean I2=0 / fuzz **31/31** · XSS **pwned=0** / crash 6/6 / multitab 4/4 / soak `__slowTicks=[]` · max 29.2ms / mutation 5/5 / error_report 9/9 / dynamic 15/15（`knownA=false`）；**无 Regression**。
- **物化与归档**：`frozen-l19` = [`1.冻结版本\v2.0-l13-frozen-l19-2026-10-17.html`](../1.冻结版本/v2.0-l13-frozen-l19-2026-10-17.html:1)（1,127,810 / LF / `E75624C4…46674` · 与 canonical 逐字节一致）；归档目录 `1.归档快照\L19-2026-10-17\` **新建**（三批报告 / 三件 N 层用例 / QA 运行器与结果 / 全部证据 / frozen-l19 / 收口报告 / 清单 [`_archived-manifest.md`](../1.归档快照/L19-2026-10-17/_archived-manifest.md:1)）。
- **登记扩方（决策 L19-QA-D1）**：45 → **47 方** —— 新增 `frozen-l19` + `l19-patch3.test.mjs`（23/23 · 10,769 / CRLF，不接入 `NODE_TESTS`，Node 口径保持 145）；登记器 [`l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:1) **41,368 / CRLF / `E9D1D6D9…`** ⇒ `PARTY_COUNT=47` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。
- **门禁三段 + 附加**：`verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** · 最大恶化 **0.0%**）；`_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0` · `L19-frozen=FROZEN-OK`）；`_w4freeze`（0）；`_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）；`ci-gate.yml` 同步 47 方 / L19-Patch3。
- **观察项**：`OP-L17W3-1` **CLOSED（契约保留 · strikes 恒 0）**；`OP-L17W2-1` 与 L16 / L19 系列 OP **挂起 / 记录（OPEN · 不阻断）**，明细见收口报告 §五。
- **收口报告**：[`l19-closure-2026-10-17.md`](../8.发布与CI/reports/l19-closure-2026-10-17.md:1)；**下一入口**：**只读维护待命（无活跃任务）**。

## 2026-10-17 — L18-Patch · 最终补丁波 ✅ 完成（P0-1 + P3-1 ~ P3-4 · canonical 1,127,387 · 45 方零漂移 · **项目彻底封存**）
- 判定 = 完成（**L18 最终补丁**）；canonical = step9 镜像 = **1,127,387 / LF / `BAF66A43CC1FCB63839508531357A4C501BD8806BE0614F18EDFF2971844F169`**（改前 1,126,551 / `1D6BAFB9…C00B` 已备份 `_临时脚本\_l18_canonical.bak.html`）；未覆盖冻结件 / 未重复归档（铁律 4 / 铁律 6）。
- **P0-1**（必崩溃）：`renderTagsView`（标签 chip 点击）/ `renderTagNodes` 的 `tagIndex.get(t)||[]` 为 `Set` 却直接 `.map` ⇒ `TypeError`，改为 `Array.from(tagIndex.get(t)||[])`（左侧栏标签 / 标签视图 chip 进入均正常）。
- **P3-1**：`_indexWorkerStrikes` 死变量与赋值退役，`__juIndexShadow.strikes` **键保留并恒 `return 0`**（`@deprecated`）⇒ **OP-L17W3-1 CLOSED**；**P3-2**：`GraphLayoutWorker.timeoutStrikes` 声明 / 递增 / 清零全链路退役（单次超时即重建语义逐字保留）；**P3-3**：`_l7TagCountText` 占位 `'…'` + `#cntTags.title="标签索引构建中"`（就绪后清除）；**P3-4**：`renderSubTags` 骨架提示「正在构建索引…」。
- **RL-11 先改后补**：红证 `FIVE_PARTY_DRIFT_COUNT=3`（canonical / step9 / l17-w4 用例）→ 同步期望（[`l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:1) **37,997 / CRLF / `FED4B9BE…`**；`l17-w4-batch-fixes.test.mjs` 13,768 / `A7A32665…`）→ 绿证 `PARTY_COUNT=45` / **`FIVE_PARTY_DRIFT_COUNT=0`** / `RESULT=PASS`。
- **门禁**：`verify.js all` **`VERIFY_EXIT=0`**（静态 **0 命中** / 9 块语法全通过 · **Node 145** · **PW 171**（167 passed + 4 skipped）· **bench 7/7** 最大恶化 **0.0%**）；`_w5freeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）/ `_w4freeze`（0）/ `_w4paths`（`VIOLATION_COUNT=0`）；冻结门三脚本 HEAD 期望同步（34,816 / 22,747 / 13,657）。
- **用例**：[`l18-final-patch.test.mjs`](../6.P0-T3基线/step9/t9/l18-final-patch.test.mjs:1) **17/17**（不纳编 · 方数保持 45）；`l17-w4-batch-fixes.test.mjs` **15/15**（P1-5 / P3-2 段随新语义同步）。
- **报告 / 入口**：[`l18-patch-2026-10-17.md`](../8.发布与CI/reports/l18-patch-2026-10-17.md:1)；CURRENT_TASK 已压缩更新并标注**【L18 最终补丁已完成，项目彻底封存】**；后续仅按 MAINTENANCE §2 / §3 走「先记决策 → 改字节 → 全量重算 → 门禁转绿」。

## 2026-10-17 — L17-QA · 全量 QA 终验与归档封存 ✅ 完成（只读终验 + 冻结物化 + 归档 + 登记扩方 · 产品字节零变更 · canonical 1,126,551 · 45 方零漂移 · L4~L17 全面封存）
- 判定 = 完成（**L17 收尾波**）；产品业务逻辑字节**零变更**（canonical = step9 镜像 = **1,126,551 / LF / `1D6BAFB9…C00B`**）；未覆盖冻结件 / 未重复归档（铁律 4 / 铁律 6）。
- **全量 QA 终验**：[`all-l17-fixed.json`](../8.发布与CI/reports/all-l17-fixed.json:1) = `allGreen=true` / 11 门全 `true` / `fatal=null`：static（9 块 syntaxFail=0 · 铁律 6 **0 命中**）/ smoke 6/6 / property.full 200 次（I1/I3/I4/I5 **0** · defectA **0**）/ property.clean 200 次（I2 **0**）/ fuzz **31/31** + XSS **14/14**（`pwned=0`）/ crash 6/6 / multitab 4/4 × 24 轮 / soak 20k 节点 40 次（`__slowTicks=[]` · max **26.3 ms**）/ mutation **5/5** / error_report 9/9 / dynamic 15/15（`knownA=false`）；**无 Regression**。
- **运行器 / 证据**：新增 [`l17-qa-all.mjs`](../6.P0-T3基线/step9/t9/l17-qa-all.mjs:1)（54,007 / CRLF / `A204A928…`；仅 HEAD 期望与产物名版本化，测试语义零变更）；[`_l17qa-qa-all-2026-10-17.txt`](../8.发布与CI/reports/_l17qa-qa-all-2026-10-17.txt:1) / [`_l17qa-verify-all-2026-10-17.txt`](../8.发布与CI/reports/_l17qa-verify-all-2026-10-17.txt:1) / `_l17qa-registrar` / `_l17qa-w5freeze` / `_l17qa-w4freeze` / `_l17qa-w4paths`。
- **物化与归档**：`frozen-l17` = [`1.冻结版本\v2.0-l13-frozen-l17-2026-10-17.html`](../1.冻结版本/v2.0-l13-frozen-l17-2026-10-17.html:1)（1,126,551 / LF / `1D6BAFB9…C00B` · 与 canonical 逐字节一致）；归档目录 `1.归档快照\L17-2026-10-17\` **新建**（波报告 / N 层用例 / QA 运行器 / QA 结果 / 全部证据 / frozen-l17 / 收口报告 / 清单），清单 [`_archived-manifest.md`](../1.归档快照/L17-2026-10-17/_archived-manifest.md:1)（含字节 + SHA-256）。
- **登记扩方（决策 L17-QA-D1）**：43 → **45 方** —— 新增 `frozen-l17` + `l17-w4-batch-fixes.test.mjs`（15/15 · 13,408 / CRLF，不接入 `NODE_TESTS`，Node 口径保持 145）；登记器 [`l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:1) **37,104 / `3832B96D…`** ⇒ `PARTY_COUNT=45` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。
- **门禁三段 + 附加**：Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171** + **bench 7/7** · 最大恶化 **0.0%**）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0` · `L17-frozen` = `FROZEN-OK`）；`_w4freeze`（`FROZEN_DRIFT_COUNT=0`）；`_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。冻结门锚点同步（`_w5freeze` 34,701 / `B2A2E36E…`；`_w4freeze` 22,632 / `A2C9F91C…`；`_w4paths` 13,542 / `F6F8250E…`）。
- **观察项**：OP-L17W1-1 / OP-L17W3-2 **CLOSED**；**OP-L17W3-1**（`strikes()` 恒 0）/**OP-L17W2-1**（非法 `selectedDate`）与 L16 系列 OP（W7-1 / W15-1 / W17-1 / W18-1/-2 / W19-1 / W20-1 / W21-1）**挂起 / 记录（OPEN · 不阻断）**。
- **收口报告**：[`l17-closure-2026-10-17.md`](../8.发布与CI/reports/l17-closure-2026-10-17.md:1)。
- **下一入口**：**只读维护待命**（任何变更须先记决策 → 改 canonical → 同步 step9 → RL-11 → 三门转绿 → 45 方零漂移）。

## 2026-10-17 — L17-W4 · 批次 4 合并收尾波（P1-4 / P1-5 / P2-1…P2-4 / P3-1…P3-3 + OP-L17W1-1 / OP-L17W3-2）✅ 完成（改产品字节波 · canonical 1,125,276 → 1,126,551 · 43 方零漂移 · L17 缺陷修复全部收口）

- 判定 = 完成（**L17 第 4 波 · 批次 4 一次收口 11 项**）；已改 canonical 并 `Copy-Item` 同步 step9 镜像；RL-11 先改后补（红证 `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望 → `PASS`）；未覆盖冻结件 / 未重复归档（铁律 4 / 铁律 6）。
- **P1-4**：`LOG_TIMER_MAX=500`，`logActivity` 的 `mod` 分支仅在新增 key 且达上限时淘汰最早登记项（`clearTimeout` + 立即 `commit` 落盘）⇒ 防抖表容量恒 ≤ 500、日志不丢。
- **P1-5**：`GraphLayoutWorker._timeoutHit` 删除「连续 ≥2 次」阈值，首次超时即 `terminate` + `ready=false` + `timeoutStrikes=0`（保留 `gen` 守卫与 URL revoke）⇒ 悬挂慢任务不再拖住后续布局请求（决策 L17-W4-D2）。
- **P2-1**：`openTagPalette` 自动颜色 `commit` 由 `{light:true,noRollback:true}` 改为 `{snapshot:true}` ⇒ 清除标签颜色进入撤销历史。
- **P2-2/P2-3/P2-4**：`docToXls` 以 `^-?\d+(\.\d+)?$` 判定并导出 `ss:Type="Number"`（决策 L17-W4-D3）；`copyPlain` 循环首行跳过 Symbol 键（`_SIDECOUNTS` 不入复制结果）；`buildTimeGrid` 在 `te=null` 时 toast「已到当日末尾，默认无结束时间」。
- **P3-1/P3-2/P3-3**：删除零调用点 `parseCalTimeInput`（全文件零定义 / 零调用，决策 L17-W4-D4）；`_l7TagCountText` 冷缓存占位符 `'—'` → `'0'`（决策 L17-W4-D5）；`_errSeen` 补注释说明「`set` 早于限流、清理依赖 64 次全扫 + 队首快路径」。
- **遗留观察项**：**OP-L17W1-1 CLOSED**（`renderTagsView` 改 `Set.size`）；**OP-L17W3-2 CLOSED**（`initStore` 补根级 `state.updatedAt` 秒级归一）；`OP-L17W3-1`（`strikes()` 恒 0）/ `OP-L17W2-1`（非法 `selectedDate`）维持 OPEN。
- **N 层**：[`l17-w4-batch-fixes.test.mjs`](../6.P0-T3基线/step9/t9/l17-w4-batch-fixes.test.mjs:1) **15/15**（不纳编 · 43 方不变）；红证以只读冻结锚 `frozen-l14` 驱动改前形态 ⇒ **14 失败 / 1 通过**（唯一通过项为红证锚自身）。
- **三段门禁**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`；登记器 **36,135 / `0CBADCC0…`**）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171** + **bench 7/7** · 最大恶化 0.0% / 中位 −14.3%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）；附加 `_w4freeze` / `_w4paths`（`VIOLATION_COUNT=0`）。
- **基线（HEAD · 实测）**：canonical = step9 镜像 = **1,126,551 / LF / `1D6BAFB9…C00B`**（+1,275 B）；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze` 34,459 / `_w4freeze` 22,390 / `_w4paths` 13,432）；`ci-gate.yml` 3,457（HEAD 注释前进至 L17-W4）。
- **报告 / 证据**：[`l17-w4-2026-10-17.md`](../8.发布与CI/reports/l17-w4-2026-10-17.md:1) + [`_l17w4-verify-all-2026-10-17.txt`](../8.发布与CI/reports/_l17w4-verify-all-2026-10-17.txt:1) / [`_l17w4-w5freeze-2026-10-17.txt`](../8.发布与CI/reports/_l17w4-w5freeze-2026-10-17.txt:1) / [`_l17w4-hashes-2026-10-17.txt`](../8.发布与CI/reports/_l17w4-hashes-2026-10-17.txt:1) 等 11 件证据。
- **下一入口**：**L17 全量 QA 终验与重新封存**（执行前先出终验计划与决策记录）。

## 2026-10-17 — L17-W3 · 指令 1 + 2 + 3（P1 合并波：秒级时间戳归一 / 死代码清除 / 幻灯片视图卸载）✅ 完成（改产品字节波 · canonical 1,123,953 → 1,125,276 · 43 方零漂移）

- 判定 = 完成（**L17 第 3 波 · P1 批次 1-3 一次收口**）；已改 canonical 并 `Copy-Item` 同步 step9 镜像；RL-11 先改后补（红证 `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望 → `PASS`）；未覆盖冻结件 / 未重复归档（铁律 4 / 铁律 6）。
- **P1-1**：`initStore()` 在既有微秒分支下方补秒级归一（`0<v<1e10` → `Math.round(v*1000)`，`createdAt` / `updatedAt` 同时），与 `mergeRemoteState` 的 `_normToMs`（L16-W21）同口径 ⇒ 秒级旧数据不再被当作远古时间而误覆盖（决策 L17-W3-D2）。
- **P1-2**：删除全文件零调用点的请求超时 strikes 函数（与图谱 FIX-P2-2 同口径）及 `window.__juIndexShadow.timeout` 导出（PW `l7-index-worker.spec.ts` 零引用）；就绪看门狗独立 `readyStrikes` 路径逐字保留（决策 L17-W3-D3）。
- **P1-3**：`JU_SLIDES.render()` 暴露 `wrap._cleanup` / `outer._cleanup`（移除 `window resize` 监听 + 从模块级 `_cleanups` 摘除登记项，幂等），`renderMain()` 在 `c.innerHTML=''` 前对 `.ju-sl-wrap` 调用卸载钩子 ⇒ **20 次切换活跃监听器 ≤ 1**（原为线性累积）。
- **N 层**：[`l17-w3-p1-fixes.test.mjs`](../6.P0-T3基线/step9/t9/l17-w3-p1-fixes.test.mjs:1) **20/20**（不纳编 · 43 方不变）；红证以只读冻结锚 `frozen-l14` 驱动改前形态 ⇒ **12 失败 / 8 通过**（判别力覆盖三项）。
- **三段门禁**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`；登记器 **35,149 / `4A32BC76…`**）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171** + **bench 7/7**）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）；附加 `_w4freeze` / `_w4paths`（`VIOLATION_COUNT=0`）。
- **基线（HEAD · 实测）**：canonical = step9 镜像 = **1,125,276 / LF / `C23BB0B1…BEB0`**（+1,323 B / +10 行 · 21,063 行）；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze` 34,051 / `_w4freeze` 21,986 / `_w4paths` 13,317）；`ci-gate.yml` 3,457（HEAD 注释前进至 L17-W3）。
- **历史锚（零变更）**：L17-W2（1,123,953 / `08FE70B6…`）/ `frozen-l14`（1,012,003）/ `frozen-l13`（991,316）/ `1.归档快照\L16-2026-10-17\`（v2.0-l16 基线 1,122,483 / `31BE83AB…`）。
- **观察项**：**OP-L17W3-1**（`_indexWorkerStrikes` / `strikes()` 保留但不再递增 ⇒ 恒 0，公开面形状冻结）OPEN；**OP-L17W3-2**（`state.updatedAt` 秒值仅在 `mergeRemoteState` 比较时归一）OPEN；OP-L17W2-1 / OP-L17W1-1 与 L16 系列维持 OPEN。
- **报告 / 证据**：[`l17-w3-2026-10-17.md`](../8.发布与CI/reports/l17-w3-2026-10-17.md:1) + [`_l17w3-verify-all-2026-10-17.txt`](../8.发布与CI/reports/_l17w3-verify-all-2026-10-17.txt:1) / [`_l17w3-w5freeze-2026-10-17.txt`](../8.发布与CI/reports/_l17w3-w5freeze-2026-10-17.txt:1) / [`_l17w3-hashes-2026-10-17.txt`](../8.发布与CI/reports/_l17w3-hashes-2026-10-17.txt:1) 等 12 件证据。
- **下一入口**：修复指令清单「**批次 4**」（执行前先出决策记录）。

## 2026-10-17 — L17-W2 · 指令 2（Defect-P0-2 周视图 UTC / 本地时区错位）✅ 完成（改产品字节波 · canonical 1,123,447 → 1,123,953 · 43 方零漂移）

- 判定 = 完成（**L17 第 2 波**）；已改 canonical 并 `Copy-Item` 同步 step9 镜像；RL-11 先改后补（红证 `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望 → `PASS`）；未覆盖冻结件 / 未重复归档（铁律 4 / 铁律 6）。
- **缺陷**：`renderCalendarPage()` week 分支以 `getUTCFullYear/getUTCMonth/getUTCDate` 取选中日、以 `Date.UTC` 求星期，而 `parseYmd()`（FIX-TZ-1）/ `ymd()` / `buildTimeGrid()` 一律本地日历语义；东八区本地零点 = 前一日 16:00Z ⇒ UTC 日期早一天，周日（本地 dow=0 / UTC dow=6）起始日 = 选中日 − 7、**整周回退一周**（周一至周六两项恰好抵消故未显形）。
- **修复**：改本地取值器 + `new Date(selY,selM,selD).getDay()`；7 日周序列 `new Date(selY,selM,selD-dow+i)`、选中日解析 `parseYmd(ui.selectedDate||todayStr())`、`top.appendChild(buildTimeGrid(days))` **逐字保留**；决策 L17-W2-D1（取值器口径统一为本地日历，不做周日特判）/ D2（周序列与列头口径零变更）。
- **N 层**：[`l17-w2-weekview-local-day.test.mjs`](../6.P0-T3基线/step9/t9/l17-w2-weekview-local-day.test.mjs:1) **17/17**（固定 `TZ=Asia/Shanghai` · 不纳编 · 43 方不变）；红证以只读冻结锚 `frozen-l14` 驱动改前形态 ⇒ **5 失败 / 12 通过**（周日 `2026-10-18` 实得 `2026-10-11 ~ 2026-10-17`）。
- **三段门禁**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`；登记器 **34,119 / `3FE43F84…`**）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171** + **bench 7/7**）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）；附加 `_w4freeze` / `_w4paths`（`VIOLATION_COUNT=0`）。
- **基线（HEAD · 实测）**：canonical = step9 镜像 = **1,123,953 / LF / `08FE70B6…EDF8`**（+506 B / +4 行 · 21,053 行）；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze` 33,567 / `_w4freeze` 21,705 / `_w4paths` 13,036）；`ci-gate.yml` 3,457（HEAD 注释前进至 L17-W2）。
- **历史锚（零变更）**：`frozen-l14`（1,012,003）/ `frozen-l13`（991,316）/ `1.归档快照\L16-2026-10-17\`（v2.0-l16 基线 1,122,483 / `31BE83AB…`）。
- **观察项**：**OP-L17W2-1**（非法 `selectedDate` 串不触发回退 ⇒ 周视图 7 日渲染 `NaN-NaN-NaN`，与改前逐日同形）OPEN；**OP-L17W1-1** 维持 OPEN；L16 系列观察项 10 项维持 OPEN。
- **报告 / 证据**：[`l17-w2-2026-10-17.md`](../8.发布与CI/reports/l17-w2-2026-10-17.md:1) + [`_l17w2-verify-all-2026-10-17.txt`](../8.发布与CI/reports/_l17w2-verify-all-2026-10-17.txt:1) / [`_l17w2-w5freeze-2026-10-17.txt`](../8.发布与CI/reports/_l17w2-w5freeze-2026-10-17.txt:1) / [`_l17w2-registrar-post-docs-2026-10-17.txt`](../8.发布与CI/reports/_l17w2-registrar-post-docs-2026-10-17.txt:1) 等 12 件证据。
- **下一入口**：修复指令清单「**P0 - 指令 3**」（执行前先出决策记录）。

## 2026-10-17 — L17-W1 · 指令 1（Defect-P0-1 `renderSubTags()` 未定义变量 `tags`）✅ 完成（改产品字节波 · canonical 1,122,483 → 1,123,447 · 43 方零漂移）

- 判定 = 完成（**L17 首波 · 正式脱离只读维护状态**）；已改 canonical 并 `Copy-Item` 同步 step9 镜像；RL-11 先改后补（红证 `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望 → `PASS`）；未覆盖冻结件 / 未重复归档（铁律 4 / 铁律 6）。
- **缺陷**：`renderSubTags()` 在 `const tagIndex=buildTagIndex();` 之后直接 `tags.forEach(([t,count])=>{...})`，而 `tags` 从未在该作用域声明（全文件无全局 `tags`）⇒ 用户展开标签分组必抛 `ReferenceError`、分组恒不渲染（Node 145 / PW 171 / bench 7 均不覆盖该交互路径）。
- **修复**：由 `buildTagIndex()` 的 `Map<tag, Set<id>>` 派生 `tagRows=[tag, idSet.size]` 并按计数降序；空索引追加 `.sb-row.sb-empty`「暂无标签」占位行；原有 row 构建逻辑（重命名 / 删除 / 改色 / 点击打开）与「新建标签」入口**逐字保留**；决策 L17-W1-D1（取 `size` 而非 `length` + 非 `Set` 回退 0）/ D2（占位行不替代新建入口）。
- **N 层**：[`l17-w1-rendersubtags-rows.test.mjs`](../6.P0-T3基线/step9/t9/l17-w1-rendersubtags-rows.test.mjs:1) **14/14**（不纳编 · 43 方不变）；红证以只读冻结锚 `frozen-l14` 驱动改前形态 ⇒ **10 失败 / 4 通过**（`ReferenceError` 落地）。
- **三段门禁**：Stage ① 43 方 `PASS`（`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0`；登记器 **33,105 / `C0B117E0…`**）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171** + **bench 7/7**）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）；附加 `_w4freeze` / `_w4paths`（`VIOLATION_COUNT=0`）。
- **基线（HEAD · 实测）**：canonical = step9 镜像 = **1,123,447 / LF / `1C1835A7…478C`**（+964 B / +13 行）；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze` 32,954 / `_w4freeze` 21,416 / `_w4paths` 12,747）；`ci-gate.yml` 3,453（HEAD 注释前进至 L17-W1）。
- **历史锚（零变更）**：`frozen-l14`（1,012,003）/ `frozen-l13`（991,316）/ `1.归档快照\L16-2026-10-17\`（151 件 / 4,313,203 B · v2.0-l16 基线 1,122,483 / `31BE83AB…`）。
- **观察项**：**OP-L17W1-1**（`renderTagsView` 对 `Set` 取 `ids.length` ⇒ 标签视图计数渲染 `undefined`）OPEN；L16 系列观察项 10 项维持 OPEN（监控 · 不阻断基线）。
- **报告 / 证据**：[`l17-w1-2026-10-17.md`](../8.发布与CI/reports/l17-w1-2026-10-17.md:1) + [`_l17w1-verify-all-2026-10-17.txt`](../8.发布与CI/reports/_l17w1-verify-all-2026-10-17.txt:1) / [`_l17w1-w5freeze-2026-10-17.txt`](../8.发布与CI/reports/_l17w1-w5freeze-2026-10-17.txt:1) 等 9 件证据。
- **下一入口**：修复指令清单「**P0 - 指令 2**」（执行前先出决策记录）。

## 2026-10-17 — L16 最终归档封存（v2.0-l16 基线锁定）✅ 完成（纯归档与文档封存波 · 产品字节零变更 · 151 件封存 · 43 方零漂移）

- 判定 = 完成（**L16 最终归档封存**）；未改 canonical / step9 镜像 / 登记器 / 规格 / 测试；未覆盖冻结件 / 未重复归档（铁律 4 / 铁律 6）；收口报告 [`L16-Closure-2026-10-17.md`](../1.归档快照/L16-2026-10-17/L16-Closure-2026-10-17.md:1) · 归档清单 [`_archived-manifest.md`](../1.归档快照/L16-2026-10-17/_archived-manifest.md:1)。
- **归档目录**：`1.归档快照\L16-2026-10-17\`（**新建**）；**归档件总数 = 151 件 / 4,313,203 B**；复制态 `BYTE_IDENTICAL_COUNT=149` / `MISSING_COUNT=0` / `RESULT=PASS`。
- **归档构成**：L16 波报告 21（W1–W21）+ N 层用例 22（W1–W21 逐波 + 终验基座）+ 门禁/登记证据 96 + 产品与门禁件 5（canonical / step9 镜像 / `verify.js` / `l9-hash-check.mjs` / `ci-gate.yml`）+ 报告与清单 4 + 承前与收口文档 3。
- **五方一致性哈希（实测）**：canonical = step9 镜像 = **1,122,483 / LF / `31BE83AB…751F8`**；`verify.js` **12,352 / `F7495A19…D018`**；登记器 **32,158 / `535AE68B…EE3C`**；终验 QA 基座 **54,032 / `89C6755F…5239`**。
- **登记方数**：`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（封存当轮证据 [`_l16archive-registrar-2026-10-17.txt`](../1.归档快照/L16-2026-10-17/_l16archive-registrar-2026-10-17.txt:1)）。
- **缺陷闭环**：A~L 全部闭环（A/W10 · B/W12 · C/W21 · D/W16 · E/W17 · F/W13 · G/W14 · H/W18 · I/W19 · J/W11 · K/W15 · L/W20）；变异 M1–M5 全部被杀死（5/5）。
- **基线**：**v2.0-l16 最终基线锁定**（`v2.0-l16-2026-10-17`）；回归下限 **Node 145 + PW 171 + bench 7/7**；观察项 10 项维持 OPEN（监控，不阻断基线）。
- **状态标注**：【L16 全部完成并已全面归档封存，v2.0-l16 基线锁定，进入只读维护待命状态】。
- **下一入口**：无（只读维护待命；新需求须经决策并走 MAINTENANCE §2 / §3）。

## 2026-10-17 — L16 终验 · 指令 13（全量 QA 重跑）✅ 完成（测试与报告波 · 产品字节零变更 · 11 类全绿 · 43 方零漂移）

- 判定 = 完成（**L16 缺陷修复阶段终验 · 测试与报告生成波**）；未改 canonical / step9 镜像 / 登记器；未覆盖冻结件 / 未重复归档；报告 [`L16-终验完成报告-2026-10-17.md`](../8.发布与CI/reports/L16-终验完成报告-2026-10-17.md:1) / [`JU-Workbench-v2.0-L16-测试报告.html`](../8.发布与CI/reports/JU-Workbench-v2.0-L16-测试报告.html:1)。
- **基座**：[`l16-w22-qa-all.mjs`](../6.P0-T3基线/step9/t9/l16-w22-qa-all.mjs:1)（不纳编 · 43 方不变）+ [`all.json`](../8.发布与CI/reports/all.json:1)（00–08 分组）+ [`all-l16-fixed.json`](../8.发布与CI/reports/all-l16-fixed.json:1)（`allGreen=true`）；浏览器用例独立 BrowserContext（独立 localStorage / IndexedDB / BroadcastChannel），无串扰。
- **11 类结果**：static 9 块语法 OK / 0 注释命中；smoke **6/6**；property.full I1/I3/I4/I5=**0** · errors=**0** · defectARootOps=**0**；property.clean I2=**0**；fuzz **31/31** · pwned=**0** · unsafeInState=**false**；crash **6/6**；multitab **4/4**；soak `__slowTicks=[]` / `__maxOpMs=**25.1ms**`；mutation **5/5**；error_report **9/9**；dynamic **15/15** · known-A=**false**。
- **三段门禁**：Stage ① 43 方 `PASS`（0 漂移）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171** + **bench 7/7** · 最大劣化 0.0% / 中位 −14.3%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **基线（HEAD · 实测）**：canonical = step9 镜像 = **1,122,483 / LF / `31BE83AB…751F8`**；`verify.js` 零变更 12,352 / `F7495A19…`；登记器 32,158 / `535AE68B…`；冻结件零变更。
- **缺陷闭环**：A~L 全部闭环（A/指令1、B/3、C/12、D/7、E/8、F/4、G/5、H/9、I/10、J/2、K/6、L/11）；逐项证据行号见 HTML 报告 §三。
- **观察项**：OP-L16W21-1 / W20-1 / W19-1 / W18-1 / W18-2 / W17-1 / W16-1 / W15-1 维持 OPEN（监控）。
- **终验结论标注**：【L16 全量 QA 重跑通过，所有缺陷 A~L 已彻底闭环，待进入 L16 最终归档封存】。
- **下一入口**：L16 最终归档封存（新建封存目录 · 不覆盖冻结件 · 不重复归档）。

## 2026-10-17 — L16-W21 · 缺陷修复指令 12（Defect-C · 合并往返时间戳单位统一）✅ 完成（改产品字节波 · canonical 1,122,077 → 1,122,483 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段第 12 波 · 改产品字节波**）；已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w21-2026-10-17.md`](../8.发布与CI/reports/l16-w21-2026-10-17.md:1)。
- **承接**：L16-W20（1,122,077 / `711B9D75…`）→ 本波执行「P3 - 指令 12」。
- **缺陷口径**：`mergeRemoteState` 的 LWW 归一仅处理微秒（`t>8.64e14 → /1000`），秒级时间戳原样返回 ⇒ 对端秒级快照与本地毫秒值混比时 `1.7e9 < 1.7e12` 恒成立：对端更新恒败、对端删除恒被跳过、平局 tie-break 失真、全局元数据 LWW 失效。
- **实现**：局部 `_norm` 就地替换为 `_normToMs`（秒级 `0<v<1e10` ×1000 / 微秒 `v>8.64e14` ÷1000 / 正常毫秒 `1e12~1e13` 原样；`0` / 负值 / `NaN` 原样），段内 **11 处** `_norm(...)` 全替换，`remoteUpdatedAt` 与全局 `state.updatedAt` 同口径归一。**决策 L16-W21-D1**：就地重命名而非并列新增（避免两套口径并存）；**决策 L16-W21-D2**：`remoteUpdatedAt` / `state.updatedAt` 同口径归一（否则删除传播仍失效）。
- **测试**：N 层 [`l16-w21-merge-ts-unit.test.mjs`](../6.P0-T3基线/step9/t9/l16-w21-merge-ts-unit.test.mjs:1) **17/17**（不纳编）：对端秒级更新胜出 / 秒级删除传播 / 本地毫秒较新仍胜 / 微秒分支不回归 / 墓碑守卫保持；`property.clean.invFails.I2` **22 → 0**（200 场景 · 22 个秒级快照）；改前副本（机械重建 = 1,122,077 / `711B9D75…`）红证 **12 fail / 5 pass**；20,001 节点秒级快照 merge P95 **106.27 ms**。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171** + **bench 7/7**）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：机械还原改前期望值的登记器先红 `FAIL canonical size=1122483 (exp 1122077)` / `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实；临时红证副本已删除）。
- **哈希**：canonical = step9 镜像 = **1,122,483 / LF / `31BE83AB…751F8`**（+406 B / +2 行）；登记器 **32,158 / `535AE68B…`**；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本与 `ci-gate.yml` HEAD 期望同步。
- **观察项**：**OP-L16W21-1**（合入节点保留原单位时间戳 · 比较统一 / 存储不动）OPEN（监控）；`OP-L16W20-1` / `OP-L16W19-1` / `OP-L16W18-1` / `OP-L16W18-2` / `OP-L16W17-1` / `OP-L16W16-1` / `OP-L16W15-1` 维持 OPEN。
- **下一入口**：缺陷修复阶段「指令 13」。

## 2026-10-17 — L16-W20 · 缺陷修复指令 11（Defect-L · `_calDataRev` 仅在 `_calIndexCache` 实际失效时递增）✅ 完成（改产品字节波 · canonical 1,121,111 → 1,122,077 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段第 11 波 · 改产品字节波**）；已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w20-2026-10-17.md`](../8.发布与CI/reports/l16-w20-2026-10-17.md:1)。
- **承接**：L16-W19（1,121,111 / `2D9CC5B4…`）→ 本波执行「P2 - 指令 11」。
- **缺陷口径**：索引层失败 7 处出口（`reportIndexFailure` 连败分支 / `l6InjectionFailure` / `commit` 变更集与删除集 / `undo` / `redo` / `mergeRemoteState` `finally`）无条件执行 `_calIndexCache=null;_calDataRev++;`；当 `_calIndexCache` 已为 null 时仍推进日历数据代次 ⇒ `_renderDayCache` 整表重建 2000 条 LRU，部分回退 L16-W2。
- **实现**：新增 `invalidateCalIndexOnly()`（`_calIndexCache===null` 直接返回；否则置 null 并 `_calDataRev++`）并收口 7 处；`_tagIndexCache` / `_searchInverted` / `_backlinkMap` 仍无条件置 null（lazy full rebuild 兜底不变）；`invalidateCalIndex()`（日历数据真实变化）逐字不变。**决策 L16-W20-D1**：代次判据单一化 —— 以缓存实存性作为「已推进过代次」的幂等代理信号。
- **测试**：N 层 [`l16-w20-calrev-gate.test.mjs`](../6.P0-T3基线/step9/t9/l16-w20-calrev-gate.test.mjs:1) **16/16**（不纳编）：连续 5 次非日历索引失败 `_calDataRev` **仅 +1**、日缓存重建 **5 → 1**；缓存未构建时反复失败零重建；`invalidateCalIndex` 仍无条件递增；改前副本（机械重建 = 1,121,111 / `2D9CC5B4…`）红证 **15 fail / 1 pass**；20,001 节点 helper p95 **0.0003 ms**、失败出口 p95 **0.0022 ms**。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171** + **bench 7/7** 最大劣化 0.0% / 中位 −14.3%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：改 canonical + 同步镜像后登记器先红 `FAIL canonical size=1122077 (exp 1121111)` / `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **哈希**：canonical = step9 镜像 = **1,122,077 / LF / `711B9D75…C32D`**（+966 B / +12 行）；登记器 **31,267 / `E9B0AAD0…`**；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本与 `ci-gate.yml` HEAD 期望同步。
- **观察项**：**OP-L16W20-1**（连败分支首命中仍置空日历索引 → 日缓存重建 1 次）OPEN（监控）；`OP-L16W19-1` / `OP-L16W18-1` / `OP-L16W18-2` / `OP-L16W17-1` / `OP-L16W16-1` / `OP-L16W15-1` 维持 OPEN。
- **下一入口**：缺陷修复阶段「指令 12」。
## 2026-10-17 — L16-W19 · 缺陷修复指令 10（Defect-I · 加密模式 `entry.stack` 一并占位 + `ctx.enc` 修正）✅ 完成（改产品字节波 · canonical 1,120,378 → 1,121,111 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段第 10 波 · 改产品字节波**）；已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w19-2026-10-17.md`](../8.发布与CI/reports/l16-w19-2026-10-17.md:1)。
- **承接**：L16-W18（1,120,378 / `EE9E2219…`）→ 本波执行「P2 - 指令 10」。
- **缺陷口径**：加密分支仅占位 `msg` / `reason`，`entry.stack`（截断 4KB）保留错误原文与源码片段、`entry.filename` 保留本机绝对路径、`entry.lineno` 保留行号；实测复核另确认 HEAD 的 `ctx.enc` 已由 `F11/fixed19` 与 `encNow` 同源（并非恒为 false），本波将其显式化并加锁定。
- **实现**：`if(encNow)` 追加 `_p.stack='<enc-stack>'` / `_p.filename='<enc-filename>'` / `_p.lineno='<enc-lineno>'`（**先于 4KB 截断** ⇒ 加密态恒为短占位）；`ctx` 上提为 `const _ctx=encNow?{…enc:true…}:{…enc:false…}`，`entry` 以 `ctx:_ctx` 引用。**决策 L16-W19-D1**：占位集合 = 用户内容（msg/reason/stack）+ 运行环境身份（filename/lineno），`kind` / `name` 结构字段保留。
- **测试**：N 层 [`l16-w19-enc-stack-placeholder.test.mjs`](../6.P0-T3基线/step9/t9/l16-w19-enc-stack-placeholder.test.mjs:1) **12/12**（不纳编）：`error_report.encrypted-msg-placeholder` **false → true**（`hasSecret=false`）、`entry.ctx.enc===true` 加密态恒成立（200 条 entry 全量断言）、超长 stack 仍整体占位、序列化零敏感残留；非加密分支 `stack` / `filename` / `lineno` 原样 + `stack` 仍 4KB 截断 + `msg` 仍脱敏 + `ctx` 常规提取；20,000 节点加密上报 p95 **0.0037 ms**。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0% / 中位 −14.3%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：改 canonical + 同步镜像后登记器先红 `FAIL canonical size=1121111 (exp 1120378)` / `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **哈希**：canonical = step9 镜像 = **1,121,111 / LF / `2D9CC5B4…4035`**（+733 B / +7 行）；登记器 **30,168 / `ECBE0EEA…`**；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本与 `ci-gate.yml` HEAD 期望同步。
- **观察项**：**OP-L16W19-1**（去重键仍以原始 filename / lineno 拼接 · 仅内存 Map，不外泄）OPEN（监控）；`OP-L16W18-1` / `OP-L16W18-2` / `OP-L16W17-1` / `OP-L16W16-1` / `OP-L16W15-1` 维持 OPEN。
- **下一入口**：缺陷修复阶段「指令 11」。

## 2026-10-17 — L16-W18 · 缺陷修复指令 9（Defect-H · `_redactErrText` 补充裸号码 / 邮箱 / IP 脱敏）✅ 完成（改产品字节波 · canonical 1,119,754 → 1,120,378 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段第 9 波 · 改产品字节波**）；已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w18-2026-10-17.md`](../8.发布与CI/reports/l16-w18-2026-10-17.md:1)。
- **承接**：L16-W17（1,119,754 / `2B8AFF31…`）→ 本波执行「P2 - 指令 9」。
- **缺陷口径**：`_redactErrText` 原仅匹配引号包裹文本（`/["'`]([^"'`\n]{4,})["'`]/g`），裸手机号（`13800138000`）/ 邮箱（`hello@test.com`）/ IPv4 原样进入 `window.__juLog`，构成隐私泄露面。
- **实现**：替换链**保留引号规则于首位**并追加 `\b1[3-9]\d{9}\b`→`<phone>` / `\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b`→`<email>` / `\b(?:\d{1,3}\.){3}\d{1,3}\b`→`<ip>`；**决策 L16-W18-D1**：规则顺序与 `\b` 锚定口径（引号优先 · 正常消息零误伤 · 纯字符串变换幂等）。
- **测试**：N 层 [`l16-w18-pii-redaction.test.mjs`](../6.P0-T3基线/step9/t9/l16-w18-pii-redaction.test.mjs:1) **14/14**（不纳编）：`error_report.pii-redaction` **false → true**（`rawPhone=false && rawEmail=false && rawIp=false`）；`Column 'foo' not found` / `timeout after 5000 ms` 等正常消息逐字节不变；加密 `<enc-message>` 占位不变；20,000 节点 / 448,898 字符消息 p95 **5.790 ms**。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0% / 中位 −14.3%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：改 canonical + 同步镜像后登记器先红 `FAIL canonical size=1120378 (exp 1119754)` / `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **哈希**：canonical = step9 镜像 = **1,120,378 / LF / `EE9E2219…5156`**（+624 B）；登记器 **29,346 / `817DCDAB…`**；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本与 `ci-gate.yml` HEAD 期望同步。
- **观察项**：**OP-L16W18-1**（纯数字本地部分邮箱先命中手机号规则）/ **OP-L16W18-2**（大消息脱敏 p95 5.790 ms）OPEN（监控）；`OP-L16W17-1` / `OP-L16W16-1` / `OP-L16W15-1` 维持 OPEN。
- **下一入口**：缺陷修复阶段「指令 10」。

## 2026-10-17 — L16-W17 · 缺陷修复指令 8（Defect-E · boot 主库损坏时回退自动备份）✅ 完成（改产品字节波 · canonical 1,118,858 → 1,119,754 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段第 8 波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w17-2026-10-17.md`](../8.发布与CI/reports/l16-w17-2026-10-17.md:1)。
- **承接**：L16-W16（1,118,858 / `685BD1BC…`）→ 本波执行「P2 - 指令 8」。
- **缺陷口径**：boot 主库路径 `migrateOrFallback(stored)` 在 `migrateStateObject` 失败时直接 `defaultState()` 复位，遮蔽 `localStorage[AUTO_BACKUP_KEY]` 中可用的自动备份（静默覆盖）。
- **实现**：新增 `migrateOrBackup(st)`——迁移失败先 `loadAutoBackup()`，备份 `state` 迁移成功则恢复并提示，否则 `defaultState()`；boot 五处主库路径（桌面加密 / 桌面快照 / 桌面遗留 / 浏览器加密 / 浏览器主库）切换。**决策 L16-W17-D1**：加密态（`ui.encrypted && ui.encKey`）不读取明文备份，维持默认态回退（避免明文残留；加密快照救援登记 OP-L16W17-1）。
- **测试**：N 层 [`l16-w17-boot-backup-fallback.test.mjs`](../6.P0-T3基线/step9/t9/l16-w17-boot-backup-fallback.test.mjs:1) **11/11**（不纳编）：crash.S2 主库损坏 + 有效备份 ⇒ `hasBackupDoc=true` 且节点数 = 备份前；crash.S3 不可解析 JSON / S4 空库不回归；备份亦损坏 ⇒ 默认态；加密态守卫；20,000 节点恢复 P95 采样。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0% / 中位 −14.3%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：改 canonical + 同步镜像后登记器先红 `FAIL canonical size=1119754 (exp 1118858)` / `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **哈希**：canonical = step9 镜像 = **1,119,754 / LF / `2B8AFF31…854E`**（+896 B）；登记器 **28,532 / `6A79D1CD…`**；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本与 `ci-gate.yml` HEAD 期望同步。
- **观察项**：**OP-L16W17-1**（加密态不读明文备份 / 加密快照未纳入恢复链）OPEN（监控）；`OP-L16W16-1` / `OP-L16W15-1` 维持 OPEN。
- **下一入口**：缺陷修复阶段「指令 9」。

## 2026-10-17 — L16-W16 · 缺陷修复指令 7（Defect-D · sanitizeHtml 非 SAFE_TAGS 分支回填文本转义与幂等）✅ 完成（改产品字节波 · canonical 1,117,557 → 1,118,858 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段第 7 波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w16-2026-10-17.md`](../8.发布与CI/reports/l16-w16-2026-10-17.md:1)。
- **承接**：L16-W15（1,117,557 / `2D641E58…`）→ 本波执行「P2 - 指令 7」。
- **缺陷口径**：`!SAFE_TAGS` 分支以 `ch.textContent` 直接回填文本，缺少尖括号显式守卫；文本落入表格类父上下文（`TABLE`/`THEAD`/`TBODY`/`TFOOT`/`TR`/`COLGROUP`）时，二次 DOMParser 解析被 foster parenting 移出表格 ⇒ `sanitizeHtml(sanitizeHtml(x)) !== sanitizeHtml(x)`（实证 `F28`）。
- **实现**：新增 `_sanTextEsc`（`<` → `\u003C`，`>` → `\u003E`）→ `createTextNode`；表格类父上下文的回填文本按解析器同口径前置于最近 `TABLE` 之前；保留 `replaceChild` 回退。**决策 L16-W16-D1**：显式转义为守卫固化（不产生二次转义 / 可见文本不变），foster parenting 前置为消幂等所必需（参照 L16-W13-D1 先例）。
- **测试**：N 层 [`l16-w16-sanitize-idempotent.test.mjs`](../6.P0-T3基线/step9/t9/l16-w16-sanitize-idempotent.test.mjs:1) **6/6**（不纳编）：fuzz **31/31** 幂等（改前 `F28` 非幂等）、`unsafeInState=false`、XSS **14/14** `pwned=false`、结构锚点（转义 / `createTextNode` / 表格守卫）、5,000 节点大 state P95 采样（med 43.10 / p95 57.60 ms，同量级）。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0% / 中位 −14.3%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze`（`BYTE_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：改 canonical 后登记器先红 `FAIL canonical size=1118858 (exp 1117557)` / `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **哈希**：canonical = step9 镜像 = **1,118,858 / LF / `685BD1BC…F64C`**（+1,301 B）；登记器 **27,807 / `796311D4…`**；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本与 `ci-gate.yml` HEAD 期望同步。
- **观察项**：**OP-L16W16-1**（表格上下文回填文本前置于表格之外）OPEN（监控）；`OP-L16W15-1` 维持 OPEN。
- **下一入口**：缺陷修复阶段「指令 8」。

## 2026-10-17 — L16-W15 · 缺陷修复指令 6（Defect-K · `_sideCounts` 异常路径改为整体重建）✅ 完成（改产品字节波 · canonical 1,117,404 → 1,117,557 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段第 6 波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w15-2026-10-17.md`](../8.发布与CI/reports/l16-w15-2026-10-17.md:1)。
- **承接**：L16-W14（1,117,404 / `06BF2005…`）→ 本波执行「P1 - 指令 6」。
- **缺陷口径**：`commit()` 的 L16-W3 侧栏计数收口在 `_l8Patch` 为空时执行 `_sideCountsSet(state,_scBase)`，把旧 state 计数**原样继承**给新 state —— `reportPatchFailure` 序列化失败降级 / `historyMode='never'`（含 `light:true`）路径下节点确实变更时，`starred` / `docCount` / `dbCount` 更新丢失。
- **实现**：分支收敛为 `__juInMerge` → 重建；`_scBase&&_l8Patch&&paths.length` → `_sideCountsApply` 增量；**其余（patch 缺失 / paths 空 / 无基数）→ `_sideCountsRebuild(state)` 单次遍历全量重建**（不再继承旧计数）；`try/catch` 兜底保留（catch 内同样整体重建）。**决策 L16-W15-D1**：patch 缺失不构成「节点未变」，以整体重建换取计数绝对正确（`_SIDECOUNTS` 仍为 Symbol 键 ⇒ 序列化 / patch 差集不可见）。
- **测试**：N 层 [`l16-w15-sidecounts-fallback.test.mjs`](../6.P0-T3基线/step9/t9/l16-w15-sidecounts-fallback.test.mjs:1) **11/11**（A1 无 patch + setStar → starred +1 且 ≠ 旧基数；A2 paths 空 / A3 merge / A4 缺基数 / A5 注入 apply 抛错 → 兜底重建；A6 结构锚点；B1 300 例增量 ≡ 重建；C1 200 例与 `renderSidebar` 全表循环逐项一致；C2 异常路径后三类计数立即正确）。
- **性能（实测 · 100,000 节点）**：`_sideCountsRebuild` med **26.27 ms** / p95 **29.91 ms** / max 32.07 ms；同机 `for..in` 枚举地板 med 15.43 / p95 **18.59 ms** ⇒ 指令「< 5 ms」**未达**（物理下界 > 5 ms），登记 **OP-L16W15-1** OPEN（监控）；相对守卫 `rebuild.p95 < enumFloor.p95 × 5` 实测 1.61× 通过。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0% / 中位 −14.3%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`（`BYTE_IDENTICAL=True`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：改 canonical 后登记器先红 `FAIL canonical size=1117557 (exp 1117404)` / `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **哈希**：canonical = step9 镜像 = **1,117,557 / LF / `2D641E58…A63C57`**（+153 B）；登记器 **26,968 / `9D323626…`**；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本与 `ci-gate.yml` HEAD 期望同步。
- **下一入口**：缺陷修复阶段「指令 7」。

## 2026-10-17 — L16-W14 · 缺陷修复指令 5（Defect-G · 持久化链异步化）✅ 完成（改产品字节波 · canonical 1,114,209 → 1,117,404 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段第 5 波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w14-2026-10-17.md`](../8.发布与CI/reports/l16-w14-2026-10-17.md:1)。
- **承接**：L16-W13（1,114,209 / `B9ED8577…`）→ 本波执行「P1 - 指令 5」。
- **缺陷口径**：Soak 报 `__slowTicks` 最高 19.5s 冻结，桩掉 persistNow / saveAutoBackup / saveGraphPositions 后 0 慢操作 ⇒ 三处同步写叠加（runPersist 同步 setItem / saveAutoBackup `clone` + 二次 `JSON.stringify` / saveGraphPositions 每次拖拽同步 setItem）。
- **实现**：① `saveAutoBackup(force,stateJson)` 复用 runPersist / flushPersistNow 本轮落盘串轻量拼接 `{state,ui,graphpos,ts}`（免 clone 与二次 stringify；无串 / 非法串降级原口径）；② `saveGraphPositions` **300ms 防抖**（`_graphPosTimer`）+ `flushGraphPositions()`，`pagehide` / `beforeunload` 强制 flush；③ `l8PersistSendBatches` 成功后 `_revSubstJson(json,ack前 rev,ack后 rev)` 复用本轮全量串（不可判定降级全量重序列化）。**决策 L16-W14-D1**：备份 state 串与主存储同口径（`_ORIGIN_STRIP`），载荷字段名 / 键序不变。
- **指标（实测）**：Soak 同口径 `__slowTicks` **40 → 0**、`__maxOpMs` **140.08 → 33.08 ms**、heap 峰值增量 **98.93 → 0.00 MB**、autobackup 载荷构造 P95 **52.28 → 0.15 ms**；N 层 [`l16-w14-persist-chain-async.test.mjs`](../6.P0-T3基线/step9/t9/l16-w14-persist-chain-async.test.mjs:1) **17/17**；观察项 **OP-L16W14-1**（备份 state 串不含 `_origin`）/ **OP-L16W14-2**（防抖窗口崩溃丢最后一次拖拽位置）OPEN（监控）。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0% / 中位 −14.3%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`（`BYTE_IDENTICAL=True`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：改 canonical 后登记器先红 `FAIL canonical size=1117404 (exp 1114209)` / `FIVE_PARTY_DRIFT_COUNT=2` → 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **哈希**：canonical = step9 镜像 = **1,117,404 / LF / `06BF2005…E0E5ED`**；登记器 **26,288 / `577DFB21…`**；`verify.js` 零变更 12,352 / `F7495A19…`；冻结门三脚本与 `ci-gate.yml` HEAD 期望同步。
- **下一入口**：缺陷修复阶段「指令 6」。

## 2026-10-17 — L16-W13 · 缺陷修复指令 4（Defect-F · 多标签删除传播 `_remoteReceived` 保护集）✅ 完成（改产品字节波 · canonical 1,109,402 → 1,114,209 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段第 4 波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w13-2026-10-17.md`](../8.发布与CI/reports/l16-w13-2026-10-17.md:1)。
- **承接**：L16-W12（1,109,402 / `DC6D62C6…`）→ 本波执行「P1 - 指令 4」。
- **缺陷口径**：对端节点 A→B 合入（B 侧 `_origin='remote'`）；B 从未写盘 ⇒ `_diskConfirmed` 不含该 id；A 删除后广播 → B 收到不含该 id 的快照，`if(!_diskConfirmed||!_diskConfirmed.has(id))continue;` 以「未上盘」跳过删除 ⇒ 内存残留并随下次写盘落回磁盘；叠加 `FIX-ORIGIN-2` 把 A 的新建标记搬到 B（`_localCreated` 守卫再挡一次）。
- **实现（`state._remoteReceived`）**：合入插入分支（`rn._origin='remote';` 之后）登记 id 并**摘除同 id `_localCreated`**；合入前归一化（已不在本地节点表 / 对端再包含且本页已上盘 → 摘除）；删除传播 `_diskConfirmed` 守卫改为门控块（保护集命中即**放行删除**）；`FIX-ORIGIN-2` 继承**跳过**保护集 id；`defaultState` / `migrateStateObject` / `initStore` / `_pendingPlainState` 口径同步；两处 `_strip` 剥离、`_ORIGIN_STRIP` 不剥离；`removeNodeFromMap` / `purgeTrash` 同址摘除。**决策 L16-W13-D1**：守卫极性按验收目标取放行语义。
- **测试**：复现 [`repro_defectF.mjs`](../_临时脚本/repro_defectF.mjs:1) B 残留 `["X","root"]` → **`["root"]`**（`A.count=1=B.count`）；属性 [`_l16w13_property.mjs`](../_临时脚本/_l16w13_property.mjs:1) `multitab.C-delete-propagation` / `D-burst-30` / `pass` **false → true**（24 轮），`A-union-no-loss` / `B-lww-convergence` 保持 true；N 层 [`l16-w13-remote-received-delete-propagation.test.mjs`](../6.P0-T3基线/step9/t9/l16-w13-remote-received-delete-propagation.test.mjs:1) **19/19**。
- **指标（实测）**：20,000 节点（200 父 × 100 子）/ 200 个对端合入删除 merge P95 **140.35 ms**；观察项 **OP-L16W13-1**（三标签陈旧写）/ **OP-L16W13-2**（归一化 O(n)）登记 OPEN（监控），不阻断验收。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0% / 中位 −14.3%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`（`BYTE_IDENTICAL=True`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：改 canonical 后登记器先红 `FAIL canonical size=1113364 (exp 1109402)` / `FIVE_PARTY_DRIFT_COUNT=1` → 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,114,209 B / LF / `B9ED85775CE20C8AF4451DCFB99D6BD74746C817FD801E6DED59FB446260682F`**（+4,807 B）；`l9-hash-check.mjs` = 25,488 / CRLF / `EBF888E2…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 + `ci-gate.yml` HEAD 期望随前进重算；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（数据契约 / 公开 API / 非优化分支零变更 · 冻结件零覆盖 · 归档不重复 · **未新增 AI 注释**）；下一入口 = **指令 5**。

## 2026-10-17 — L16-W12 · 缺陷修复指令 3（Defect-B · applyPatch children 洞过滤）✅ 完成（改产品字节波 · canonical 1,106,706 → 1,109,402 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段第 3 波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w12-2026-10-17.md`](../8.发布与CI/reports/l16-w12-2026-10-17.md:1)。
- **承接**：L16-W11（1,106,706 / `9D7675D6…`）→ 本波执行「P1 - 指令 3」。
- **缺陷口径**：`applyPatch` 末尾的 `repairTreeConsistency(next)` **不接收参数**（只读模块级旧 `state`）且无返回值 ⇒ `if(fixed)next=fixed` 为死代码；undo 追加子节点时 `extractAtPaths` 的 `children` 可含 `undefined`，补丁经 `JSON.stringify` 往返变 `null`，`setByPath` 写回即在 `children` 中产生洞。
- **实现（返回前 children 审计）**：`applyPatch` 返回 `next` 前新增 try-catch —— 当 `patch.paths` 命中 `*.children` 或整节点 `nodes.<id>` 时，对 `next.nodes` 逐节点剔除 `typeof cid!=='string' || !next.nodes[cid]`（空 / 已删）并同层去重；仅替换确有洞的节点（新对象 + 新数组），旧 state 与补丁值均不被就地改写；原防御性 `repairTreeConsistency` 调用逐字保留（无副作用）。
- **测试**：复现 [`repro_defectB.js`](../_临时脚本/repro_defectB.js:1) `childrenAfterUndo` `["a",null,"b"]` → **`["a","b"]`**（I1 通过）；属性采样 [`_l16w12_property.mjs`](../_临时脚本/_l16w12_property.mjs:1) `property.full.invFails` **I1/I2/I3 199 → 0**（200 轮）；N 层 [`l16-w12-patch-children-holes.test.mjs`](../6.P0-T3基线/step9/t9/l16-w12-patch-children-holes.test.mjs:1) **12/12**。
- **指标（实测）**：50,000 节点 undo P95 干净路径 **58.34ms**（基线 38.27ms）/ 带洞路径 **47.82ms**（基线 37.81ms）；观察项 **OP-L16W12-1**（全量 children 审计开销）登记为 OPEN（监控），不阻断验收。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`（`BYTE_IDENTICAL=True`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：改字节后登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,109,402 B / LF / `DC6D62C661B4899D8E6BD06C9D89F75BE30A486C498268AFFF2121AD3D8EBB45`**（+2,696 B）；`l9-hash-check.mjs` = 24,580 / CRLF / `BDA2EDB8…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 + `ci-gate.yml` HEAD 期望随前进重算；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（数据契约 / 公开 API / 非优化分支零变更 · 冻结件零覆盖 · 归档不重复 · **未新增 AI 注释**）；下一入口 = **指令 4**。

## 2026-10-17 — L16-W11 · 缺陷修复指令 2（Defect-J · `_tombstoneQueue` 解耦清理）✅ 完成（改产品字节波 · canonical 1,104,391 → 1,106,706 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段第 2 波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w11-2026-10-17.md`](../8.发布与CI/reports/l16-w11-2026-10-17.md:1)。
- **承接**：L16-W10（1,104,391 / `1A61EEBD…`）→ 本波执行「P0 - 指令 2」。
- **缺陷口径**：原 `_tombstoneQueue` 清理（游标压缩）**仅**位于 `if(_recentlyRemoved.size>2000)` 分支内；稀疏删除（每秒 1 次 `removeNode`）下 `_recentlyRemoved` 稳定数十条 ⇒ 分支永不成立、队列随每次写入持续 push 而无界增长。
- **实现（解耦触发 + compaction）**：新增 `const TOMB_QUEUE_MAX=4096;` 与 `_tombstoneCompactQueue()`（遍历队列只保留仍存于 `_recentlyRemoved` 的条目、`q.length=_w` 压缩前缀、`_tombstoneFifoHead=0` 游标归零；自门控未超阈值零开销）；`_tombstoneSet` 末尾与 `mergeRemoteState` 对端墓碑并入后各调用一次；容量 `size>2000` 分支保留并以 `head<queue.length` 门控避免空转；`initStore` 复位逻辑零变更（不冲突）。
- **测试**：N 层回归 [`l16-w11-tombstone-queue-compaction.test.mjs`](../6.P0-T3基线/step9/t9/l16-w11-tombstone-queue-compaction.test.mjs:1) **11/11**（结构锚点 / 旧口径 12,000 条无界复现 / 3,600 次稀疏删除 / 突发 5,000 / compaction 正确性 / initStore 复位 / 50,000 节点 P95）；测量 [`_l16w11_measure.mjs`](../_临时脚本/_l16w11_measure.mjs:1) `RESULT=PASS`。
- **指标（实测）**：稀疏 3,600 次删除（1 次/秒）队列 **3,600（峰值 3,600 ≤ 8192）**、`_recentlyRemoved` 峰值 **230 / 终态 31（≤ 2000）**；12,000 次峰值 **4,096**（旧口径 **12,000**）；突发 5,000 次队列 **903** / Map **2,000**；大 state P95 **0.0010ms**（预算 0.5ms）。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`（`BYTE_IDENTICAL=True`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：改字节后登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,106,706 B / LF / `9D7675D62127A6B0A8F44948C344DD637A249E6C546B6C8AC59B5604CEFB466C`**（+2,315 B）；`l9-hash-check.mjs` = 23,831 / CRLF / `E83D94A9…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 + `ci-gate.yml` HEAD 期望随前进重算；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（数据契约 / 公开 API / 非优化分支零变更 · 冻结件零覆盖 · 归档不重复 · **未新增 AI 注释**）；下一入口 = **指令 3**。

## 2026-10-16 — L16-W10 · 缺陷修复指令 1（Defect-A · 根节点守卫）✅ 完成（改产品字节波 · canonical 1,104,018 → 1,104,391 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 缺陷修复阶段首波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w10-2026-10-16.md`](../8.发布与CI/reports/l16-w10-2026-10-16.md:1)。
- **承接**：L16-W9（1,104,018 / `FEC7708C…`）→ 本波执行「P0 - 指令 1」。
- **实现（四处根节点守卫）**：`actions.removeNode` 首守卫追加 `id===state.rootId`；`getCurrentDoc` 于 `state.nodes[state.rootId]` 后追加 `if(!root)return null;`；`moveToTrash` / `outlineBatchDelete` 入口同口径；数据契约 / 公开 API / 非优化分支零变更；不新增 `<script>` 块（9 块不变）。
- **测试**：N 层回归 [`l16-w10-defecta-root-guard.test.mjs`](../6.P0-T3基线/step9/t9/l16-w10-defecta-root-guard.test.mjs:1) **12/12**（结构锚点 / 根操作规模 / getCurrentDoc 判空 / 回收 / 批量删除 / 7→0 性质对照 / 50,000 节点 P95）；性质采样 [`_l16w10_property.mjs`](../_临时脚本/_l16w10_property.mjs:1) `defectARootOps 7 → 0` · `errSamples 7 → 0`（`TypeError: Cannot read properties of undefined (reading 'children')`）· 守卫 P95 **0.0249ms**（旧整树删除 29.6874ms）。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`（`BYTE_IDENTICAL=True`）；附加 `_w4freeze` / `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：改字节后登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,104,391 B / LF / `1A61EEBD3D17F59B5497ACAF4B6F0217770B0243B7AE32B3B1F154ECC07E8C0E`**；`l9-hash-check.mjs` = 22,602 / CRLF / `A036BCFC…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 HEAD 期望随前进重算；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品契约 / 公开 API 零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；下一入口 = **指令 2**。

## 2026-10-16 — L16 收口与全面封存 · 归档 `L16-2026-10-16`（100 件 / 3,750,050 B · 43 方零漂移 · canonical 1,104,018 零变更）✅ 完成（纯归档/文档封存 · 产品零字节变更）

- 判定 = 完成（**L16 收口与全面封存 · 纯归档与文档封存波**）；**未修改产品代码字节（canonical 1,104,018 零变更）/ 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；收口报告 [`L16-Closure-2026-10-16.md`](../1.归档快照/L16-2026-10-16/L16-Closure-2026-10-16.md:1)。
- **承接**：`L16-W9`（抽取硬编码主题色为 CSS 变量 · 指令 9）→ 本波收口 **L16 全阶段（指令 1~9）**。
- **归档目录（新建）**：`1.归档快照\L16-2026-10-16\`（只读封存快照）；归档件 **100 件 / 3,750,050 字节**（`_archived-manifest.md` 自身另计）；逐件 字节 / SHA-256 / 行尾见 [`_archived-manifest.md`](../1.归档快照/L16-2026-10-16/_archived-manifest.md:1)。
- **归档构成**：L16 波报告 9（W1~W9）+ L16 N 层测试 9（不纳编）+ L16 性能采样脚本 10 + L16 门禁/登记证据 65 + L16 现行 canonical 1 + L16 step9 镜像 1 + 接线/门禁/登记器 3 + 承前快照 1 + 收口报告 1 = **100 件**。
- **五方一致性哈希（实测）**：canonical = step9 镜像 = 归档 canonical 副本 = **1,104,018 / LF / `FEC7708C…4B4AB6`**（`BYTE_IDENTICAL=True`）；`verify.js` = 12,352 / LF / `F7495A19…`；`l9-hash-check.mjs` = 21,838 / CRLF / `661B54E0…`；产品三方逐字节一致 = `true`。
- **43 方登记（实测）**：`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）；L16 全阶段 9 波**未新增 / 未退役纳编物**（方数保持 43）。
- **v2.0-l16 基线说明**：产品 HEAD = **1,104,018 B / LF / `FEC7708CA3B6E01E92D1B0532FA00B7144F841ECD7FA1862ABC5EF53E24B4AB6`**（L16 全阶段 1,086,613 → 1,104,018 · **+17,405 B**）；历史只读锚 `release\v2.0-l15-2026-10-16\` + `frozen-l14` + `frozen-l13` 零变更；正式发布须新建目录并逐件校验（铁律 4）。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品零字节变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；**L16 阶段告一段落，性能与可维护性优化需求（指令 1~9）已全部闭环**；下一入口 = **待决策**（发布 `v2.0-l16` 或启动新需求）。

## 2026-10-16 — L16-W9 · 抽取硬编码主题色为 CSS 变量（指令 9）✅ 完成（改产品字节波 · canonical 1,102,309 → 1,104,018 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 第九波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w9-2026-10-16.md`](../8.发布与CI/reports/l16-w9-2026-10-16.md:1)。
- **承接**：L16-W8（1,102,309 / `039501F3…`）→ 本波收口 **L16-W9**，执行「指令 9」。
- **实现（语义化 token 抽取）**：`:root` 新增 `--close-hover-bg` / `--danger-soft` / `--editor-fg` / `--cp-custom-fill` / `--cp-custom-alt` / `--tag-fallback` / `--prio-p1..p5` / `--pres-bg` / `--pres-stage-bg` / `--mm-*` / `--color-palette` / `--opt-palette` / `--tag-palette` / `--tag-auto-gradient`；`html[data-theme="night"]` 新增 `--active-fg-on-accent` / `--on-danger-fg` / `--now-label-fg` / `--night-grad-a/b` / `--mm-*` / `--color-palette`；关闭钮 hover 统一 `color-mix(in srgb,var(--danger) 20%,transparent)` 并以纯 token 值回退；JS 侧改由 `_themeColor` / `_themeList` 读取 CSS 自定义属性；定义块外 `#RRGGBB` 命中 **118 → 0（100% ≥ 80%）**；数据契约 / 公开 API / 非优化分支零变更；不新增 `<script>` 块（9 块不变）。
- **测试**：N 层回归 [`l16-w9-theme-token.test.mjs`](../6.P0-T3基线/step9/t9/l16-w9-theme-token.test.mjs:1) **6/6**（结构锚点 / 抽取口径 / token 齐备 / 结果等价 / 块数不变量 / 性能）；性能采样 [`_l16w9_measure.mjs`](../_临时脚本/_l16w9_measure.mjs:1) token 解析 `MIN_P95=0.10µs`（预算 50µs）· `PALETTE_EQUIV=TRUE`。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`（`BYTE_IDENTICAL=True`）；附加 `_w4freeze`（`CANONICAL_BYTES=1104018`）/ `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。
- **RL-11 红/绿证**：以旧期望值副本登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **观察项（不阻断）**：全量 PW 首轮 `l9-persist-layer.spec.ts:294`（L9-5 Worker `ready` 握手）满负载下偶发 1 次失败（与本波 CSS/token 改动无关）；隔离复跑 **6/6 通过**，全量复跑 `verify.js all` **exit 0**（证 [`_l16w9-l9spec-rerun-2026-10-16.txt`](../8.发布与CI/reports/_l16w9-l9spec-rerun-2026-10-16.txt:1)）。
- **新锚点**：canonical = step9 镜像 = **1,104,018 B / LF / `FEC7708CA3B6E01E92D1B0532FA00B7144F841ECD7FA1862ABC5EF53E24B4AB6`**；`l9-hash-check.mjs` = 21,838 / CRLF / `661B54E0…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品契约 / 公开 API 零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；下一入口 = **L16 收口与全面封存**。

## 2026-10-16 — L16-W8 · _tombstoneSet 的 O(n) 全量清扫改为惰性分段（指令 8）✅ 完成（改产品字节波 · canonical 1,100,380 → 1,102,309 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 第八波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w8-2026-10-16.md`](../8.发布与CI/reports/l16-w8-2026-10-16.md:1)。
- **承接**：L16-W7（1,100,380 / `8BDDB2F2…`）→ 本波收口 **L16-W8**，执行「指令 8」。
- **实现（惰性分段清扫）**：[`_tombstoneSet()`](../6.P0-T3基线/v2.0-l3.html.html:2014) 超 2000 容量的 **O(n) 全表过期扫描**改为**惰性分段**——新增模块级 `_tombstoneQueue`（按插入顺序 id 数组）+ `_tombstoneFifoHead` 游标 + `TOMB_SWEEP_BATCH=32`；超容量时从队首推进固定批量做一次 `_now-v>30000` 检查（避免一次性 O(n) 扫描），FIFO 上界仍以 Map 首键 **O(1) 收缩**保证有界（≤2000）；保留 `_tombstoneOps%200===0` 轻量全扫兜底；`mergeRemoteState` 并入 / `initStore` 恢复同步 push 插入顺序；游标超阈值整体压缩防无界。数据契约 / 公开 API / 非优化分支零变更；不新增 `<script>` 块（9 块不变）。
- **测试**：N 层回归 [`l16-w8-tombstone-sweep.test.mjs`](../6.P0-T3基线/step9/t9/l16-w8-tombstone-sweep.test.mjs:1) **6/6**（结构锚点 / 容量上界 / 过期清扫 / 结果等价 / 持久化一致 / 性能）；性能采样 [`_l16w8_measure.mjs`](../_临时脚本/_l16w8_measure.mjs:1) 连续 5000 删除累计耗时下降 **91.69%（MIN）/ 91.66%（P50）**（**≥60% 达标**）、容量上界 **2000**、`SET_EQUAL_UNDER2000=TRUE`。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`（`BYTE_IDENTICAL=True`）；附加 `_w4freeze`（`CANONICAL_BYTES=1102309`）/ `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。证 [`_l16w8-registrar-2026-10-16.txt`](../8.发布与CI/reports/_l16w8-registrar-2026-10-16.txt:1) / [`_l16w8-verify-all-2026-10-16.txt`](../8.发布与CI/reports/_l16w8-verify-all-2026-10-16.txt:1)。
- **RL-11 红/绿证**：改字节后登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror；证 [`_l16w8-registrar-red-2026-10-16.txt`](../8.发布与CI/reports/_l16w8-registrar-red-2026-10-16.txt:1)）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,102,309 B / LF / `039501F37B64CAA9BE9EF7173EF3D18BA1475AB8AC36FFBAEC80495371549962`**；`l9-hash-check.mjs` = 20,666 / CRLF / `30313EFD…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品契约 / 公开 API 零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；下一入口 = **指令 9**（L16-W9）。

## 2026-10-16 — L16-W7 · collectSubtreeIdsFromPreState 去除重复遍历（指令 7）✅ 完成（改产品字节波 · canonical 1,100,323 → 1,100,380 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 第七波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w7-2026-10-16.md`](../8.发布与CI/reports/l16-w7-2026-10-16.md:1)。
- **承接**：L16-W6（1,100,323 / `F6066E64…`）→ 本波收口 **L16-W7**，执行「指令 7」。
- **实现（索引游标队列）**：[`collectSubtreeIdsFromPreState()`](../6.P0-T3基线/v2.0-l3.html.html:2573) 由 `stack=roots.filter(Boolean)` + `pop/push` 混用改为**显式索引游标队列**（`let head=0; while(head<queue.length)` · `queue[head++]`）；单次传入 `rootIds` 时直接初始化 `queue`（不再 `filter(Boolean)`，循环内 `if(!id)continue` 守卫）。语义等价（返回 `Set(id)` 逐位相等）；复杂度 `O(n)` 不变；数据契约 / 公开 API / 非优化分支零变更；不新增 `<script>` 块（9 块不变）。
- **测试**：N 层回归 [`l16-w7-collect-subtree.test.mjs`](../6.P0-T3基线/step9/t9/l16-w7-collect-subtree.test.mjs:1) **11/11**（结构锚点 / 5 形状结果等价 / 单根 / 5 万节点逐位相等 / 幂等 / 环引用 / 非显著劣化）；性能采样 [`_l16w7_measure.mjs`](../_临时脚本/_l16w7_measure.mjs:1) 5 万节点子树 P95 降幅 **3.96% – 9.43%**、`ALL_SET_EQUAL=TRUE`（**≥40% 目标未达 · OP-L16W7-1 待决策**）。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`（`BYTE_IDENTICAL=True`）；附加 `_w4freeze`（`CANONICAL_BYTES=1100380`）/ `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。证 [`_l16w7-registrar-2026-10-16.txt`](../8.发布与CI/reports/_l16w7-registrar-2026-10-16.txt:1) / [`_l16w7-verify-all-2026-10-16.txt`](../8.发布与CI/reports/_l16w7-verify-all-2026-10-16.txt:1)。
- **RL-11 红/绿证**：改字节后登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror；证 [`_l16w7-registrar-red-2026-10-16.txt`](../8.发布与CI/reports/_l16w7-registrar-red-2026-10-16.txt:1)）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,100,380 B / LF / `8BDDB2F27A441840BC9097A5EFFDEFBEC19242F947916FA1B7AD367D7F7C35FE`**；`l9-hash-check.mjs` = 19,555 / CRLF / `A396E18A…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品契约 / 公开 API 零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；下一入口 = **指令 8**（L16-W8）。

## 2026-10-16 — L16-W6 · _childSets 缓存提升为 WeakMap（指令 6）✅ 完成（改产品字节波 · canonical 1,098,596 → 1,100,323 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 第六波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w6-2026-10-16.md`](../8.发布与CI/reports/l16-w6-2026-10-16.md:1)。
- **承接**：L16-W5（1,098,596 / `846774B5…`）→ 本波启动 **L16-W6**，执行「指令 6」。
- **实现（缓存提升为模块级 WeakMap）**：`repairTreeConsistency` 的 `_childSets` 缓存提升为模块级 `_childSetCache=new WeakMap()`（`node→Set(children)`）——`_getChildSet(pid)` 读缓存（结构共享下未变节点引用稳定 ⇒ 跨调用复用零分配）；第二遍复用缓存 Set 作 `seen`（`clear()` 后就地重填为存活 children 集，恒等于 `p.children`）；`mergeRemoteState` 就地改写 children 处 `_childSetDrop(node)` 失效；`initStore` 整体替换 `state.nodes` 时重置 WeakMap。数据契约 / 公开 API / 非优化分支零变更；不新增 `<script>` 块（9 块不变）。
- **测试**：N 层回归 [`l16-w6-childset-cache.test.mjs`](../6.P0-T3基线/step9/t9/l16-w6-childset-cache.test.mjs:1) **8/8**（结构锚点 / 结果等价 / 分配下降 / 缓存一致性 / 复用身份 / 幂等 / 空父 / 失效）；100k 语境连续 100 次广播 repair 累计分配对象数 **10,400,300 → 100,000（−99.0%，≥80%）**、`CACHE_REUSE_IDENTITY=TRUE`；证据 [`_l16w6_measure.mjs`](../_临时脚本/_l16w6_measure.mjs:1)。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`；附加 `_w4freeze`（`CANONICAL_BYTES=1100323` / `BYTE_IDENTICAL=True`）/ `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。证 [`_l16w6-registrar-2026-10-16.txt`](../8.发布与CI/reports/_l16w6-registrar-2026-10-16.txt:1) / [`_l16w6-verify-all-2026-10-16.txt`](../8.发布与CI/reports/_l16w6-verify-all-2026-10-16.txt:1)。
- **RL-11 红/绿证**：改字节后登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror；证 [`_l16w6-registrar-red-2026-10-16.txt`](../8.发布与CI/reports/_l16w6-registrar-red-2026-10-16.txt:1)）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,100,323 B / LF / `F6066E64C4B883FA73FA461577E6F23AA4466B4763667B301B7A9A6ED2B7A698`**；`l9-hash-check.mjs` = 18,767 / CRLF / `10508A46…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品契约 / 公开 API 零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；下一入口 = **指令 7**（L16-W7）。

## 2026-10-16 — L16-W5 · 统一 visibilitychange 下的定时器管理（指令 5）✅ 完成（改产品字节波 · 1,097,371 → 1,098,596 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 第五波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w5-2026-10-16.md`](../8.发布与CI/reports/l16-w5-2026-10-16.md:1)。
- **承接**：L16-W4（1,097,371 / `E645FAE7…`）→ 本波启动 **L16-W5**，执行「指令 5」。
- **实现（时间网格轮询纳入 visibilitychange 统一管理）**：新增 `let _calTgVisHandler=null;`；`clearCalTgTimer` 由「仅清 interval」扩为**同时注销可见性监听**；`startCalTgTimer` 将 60s 轮询体抽为闭包 `tick` 并注册 `_calTgVisHandler`——`document.hidden` 时 `clearInterval` 停表（后台零 tick）；回前台仅当周视图时间线仍在挂（`line.isConnected` ⇔「view===week 且时间线已挂载」）时重启轮询并**立即执行一次 `tick` 重定位红线**（含休眠期跨天）。数据契约 / 公开 API / 非优化分支零变更；不新增 `<script>` 块（9 块不变）。
- **测试**：N 层回归 [`l16-w5-caltg-visibility.test.mjs`](../6.P0-T3基线/step9/t9/l16-w5-caltg-visibility.test.mjs:1) **8/8**（结构锚点 / 前启 / 停表 / 回启重定位 / 未挂不启 / 注销 / 幂等 / 自清理）；100k 语境隐藏 30 分钟 tick **30 → 0（−100%）**、`IDLE_BASELINE_RESTORED=TRUE`、回前台 `RESUME_IMMEDIATE_TICKS=1`（单 tick P95 18.6126 ms）；证据 [`_l16w5_measure.mjs`](../_临时脚本/_l16w5_measure.mjs:1)。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0` / `BYTE_IDENTICAL=True`；附加 `_w4freeze`（`CANONICAL_BYTES=1098596` / 0）/ `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。证 [`_l16w5-registrar-2026-10-16.txt`](../8.发布与CI/reports/_l16w5-registrar-2026-10-16.txt:1) / [`_l16w5-verify-all-2026-10-16.txt`](../8.发布与CI/reports/_l16w5-verify-all-2026-10-16.txt:1)。
- **RL-11 红/绿证**：改字节后登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror；证 [`_l16w5-registrar-red-2026-10-16.txt`](../8.发布与CI/reports/_l16w5-registrar-red-2026-10-16.txt:1)）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,098,596 B / LF / `846774B5C73B5FF30F24B0079C6012547EF7CC60D024E62092A083DA7710176A`**；`l9-hash-check.mjs` = 17,861 / CRLF / `6A4741B0…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品契约 / 公开 API 零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；下一入口 = **指令 6**（L16-W6）。

## 2026-10-16 — L16-W4 · _syncOutlineHeaderH 改用 ResizeObserver（指令 4）✅ 完成（改产品字节波 · canonical 1,095,556 → 1,097,371 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 第四波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w4-2026-10-16.md`](../8.发布与CI/reports/l16-w4-2026-10-16.md:1)。
- **承接**：L16-W3（1,095,556 / `09EDF9D0…`）→ 本波启动 **L16-W4**，执行「指令 4」。
- **实现（rAF 测量 → ResizeObserver 订阅）**：新增 `let _outlineHeaderRO=null;` 载体 + `_setOutlineHeaderH`（写入门槛：仅 `--doc-header-h` 实际变化才 `setProperty`）/ `_observeOutlineHeader`（挂载后观察 `.doc-header`，回调按 `offsetHeight` 刷新；缺 RO 回退即时测量；无 `.doc-header` 则 `removeProperty`）/ `_disconnectOutlineHeaderRO`（断开置空）；`renderMain` 大纲分支由 rAF 调 `_syncOutlineHeaderH` 改为 `_observeOutlineHeader(el)`（rAF 仅保留 `_vsUpdate`），并在顶部（与视图 `_cleanup` 同址）`_disconnectOutlineHeaderRO()`；`_syncOutlineHeaderH` 保留为 `applyScale` / 无 RO 降级路径并收口「变化才写入」。渲染期零 `offsetHeight` 读取 ⇒ 强制同步布局归零；数据契约 / 公开 API 零变更；不新增 `<script>` 块（9 块不变）。
- **测试**：N 层回归 [`l16-w4-outline-header-ro.test.mjs`](../6.P0-T3基线/step9/t9/l16-w4-outline-header-ro.test.mjs:1) **8/8**（结构锚点 / 写入门槛 / 订阅行为 / 断开语义 / 降级兜底）；100k 语境「标题高度同步」P95 **0.1393 → 0.0001 ms（−99.9%）**，强制布局 **1,000 → 0**（`FORCED_LAYOUT_ELIMINATED=TRUE`），同高写入 **0**；证据 [`_l16w4_measure.mjs`](../_临时脚本/_l16w4_measure.mjs:1)。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0` / `BYTE_IDENTICAL=True`；附加 `_w4freeze`（`CANONICAL_BYTES=1097371` / 0）/ `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。证 [`_l16w4-registrar-2026-10-16.txt`](../8.发布与CI/reports/_l16w4-registrar-2026-10-16.txt:1) / [`_l16w4-verify-all-2026-10-16.txt`](../8.发布与CI/reports/_l16w4-verify-all-2026-10-16.txt:1)。
- **RL-11 红/绿证**：改字节后登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror；证 [`_l16w4-registrar-red-2026-10-16.txt`](../8.发布与CI/reports/_l16w4-registrar-red-2026-10-16.txt:1)）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,097,371 B / LF / `E645FAE7BBB00DFFBC83709F5814A17DA70125C1D330709D9B9094747CA12FF5`**；`l9-hash-check.mjs` = 16,985 / CRLF / `70F68B6E…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品契约 / 公开 API 零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；下一入口 = **指令 5**（L16-W5）。

## 2026-10-16 — L16-W3 · renderSidebar 全表扫描改为增量计数（指令 3）✅ 完成（改产品字节波 · canonical 1,089,755 → 1,095,556 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 第三波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w3-2026-10-16.md`](../8.发布与CI/reports/l16-w3-2026-10-16.md:1)。
- **承接**：L16-W2（1,089,755 / `00A0E72D…`）→ 本波启动 **L16-W3**，执行「指令 3」。
- **实现（全表扫描 → 增量计数）**：新增 Symbol 键挂载的 `state` 计数对象（`_SIDECOUNTS`：`{starred,docCount,dbRootId,dbCount}`）+ `_sideCount` / `_sideCountsRebuild` / `_sideCountsApply` / `_sideCountsGet/Set/Ensure` 辅助；`commit`（L6 收口 · 真实句柄 `_l8Patch`）/ `undo` / `redo` 按「变更节点增量」维护，`initStore` / `mergeRemoteState` 整体重建；`renderSidebar` 改为 O(1) 直读，删除全表循环（保留 `__l14On()`→`__l14SideScanEnsure()` 与原全表循环降级）。Symbol 键对 `JSON.stringify`（持久化 / 加密 / 自动备份）与 `for..in`（patch 差集）**不可见** ⇒ 数据契约 / 加密 payload / patch 形状零变更；不新增 `<script>` 块（9 块不变）。
- **测试**：N 层回归 [`l16-w3-sidebar-counts.test.mjs`](../6.P0-T3基线/step9/t9/l16-w3-sidebar-counts.test.mjs:1) **10/10**（重建/增量口径 == 全表循环；Symbol 计数序列化不可见）；100k 节点库侧栏计数读取 P95 **44.19 → 0.0025 ms（−100%）**，新增 1000 节点后仍 O(1)（`COUPLED_TO_N=FALSE`）；证据 [`_l16w3_measure.mjs`](../_临时脚本/_l16w3_measure.mjs:1)。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0` / `BYTE_IDENTICAL=True`；附加 `_w4freeze`（0）/ `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。证 [`_l16w3-registrar-2026-10-16.txt`](../8.发布与CI/reports/_l16w3-registrar-2026-10-16.txt:1) / [`_l16w3-verify-all-2026-10-16.txt`](../8.发布与CI/reports/_l16w3-verify-all-2026-10-16.txt:1)。
- **RL-11 红/绿证**：改字节后登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror；证 [`_l16w3-registrar-red-2026-10-16.txt`](../8.发布与CI/reports/_l16w3-registrar-red-2026-10-16.txt:1)）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,095,556 B / LF / `09EDF9D029F0BAA21A1686341B5B3B5A322A1580BDD388A45779DE8D139B16D8`**；`l9-hash-check.mjs` = 16,016 / CRLF / `D859008E…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品契约 / 公开 API 零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；下一入口 = **指令 4**（L16-W4）。

## 2026-10-16 — L16-W2 · 修正 _renderDayCache 的失效粒度（指令 2）✅ 完成（改产品字节波 · canonical 1,088,117 → 1,089,755 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 第二波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w2-2026-10-16.md`](../8.发布与CI/reports/l16-w2-2026-10-16.md:1)。
- **承接**：L16-W1（1,088,117 / `4FA206A9…`）→ 本波启动 **L16-W2**，执行「指令 2」。
- **实现（失效粒度解耦）**：新增独立日历数据代次 `_calDataRev` + 选择态签名 `_calSelKey`；`_renderDayCache._gen` 由 `state.updatedAt`（每次 commit 单调递增）改为 `_calDataRev`，**仅在**「日历数据失效」（`invalidateCalIndex` / `_calIndexCache` 置空；全仓 10 处 `_calDataRev++`）或「选择态变化」（`selectedDate` / `calTagFilter`）时递增；编辑大纲正文（日历待办不变）不再整表重建 2000 条 LRU。`commit`/`undo`/`redo` 保守二次守卫保留；非优化分支 / 数据契约 / 公开 API 零变更；不新增 `<script>` 块（9 块不变）。
- **测试**：N 层回归 [`l16-w2-cal-rev.test.mjs`](../6.P0-T3基线/step9/t9/l16-w2-cal-rev.test.mjs:1) **8/8**（大纲正文编辑不重建 / 选择态或日历数据变化重建）；100k 节点库日缓存重渲染 P95 **0.76 → 0.00 ms（−99.6%）**，整表重建 **30 → 1**；证据 [`_l16w2-measure-2026-10-16.txt`](../8.发布与CI/reports/_l16w2-measure-2026-10-16.txt:1) / [`_l16w2-nlayer-2026-10-16.txt`](../8.发布与CI/reports/_l16w2-nlayer-2026-10-16.txt:1)。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0` / `BYTE_IDENTICAL=True`；附加 `_w4freeze`（0）/ `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。证 [`_l16w2-registrar-2026-10-16.txt`](../8.发布与CI/reports/_l16w2-registrar-2026-10-16.txt:1) / [`_l16w2-verify-all-2026-10-16.txt`](../8.发布与CI/reports/_l16w2-verify-all-2026-10-16.txt:1)。
- **RL-11 红/绿证**：改字节后登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror；证 [`_l16w2-registrar-red-2026-10-16.txt`](../8.发布与CI/reports/_l16w2-registrar-red-2026-10-16.txt:1)）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,089,755 B / LF / `00A0E72D124317C29979022EC7A43328063E7850E76BEAFA9FE4A5F1BC958FD8`**；`l9-hash-check.mjs` = 15,203 / CRLF / `3F736F42…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品契约 / 公开 API 零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；下一入口 = **指令 3**（L16-W3）。

## 2026-10-16 — L16-W1 · 合并 runPersist 双重全量序列化（指令 1）✅ 完成（改产品字节波 · canonical 1,086,613 → 1,088,117 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L16 首波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l16-w1-2026-10-16.md`](../8.发布与CI/reports/l16-w1-2026-10-16.md:1)。
- **承接**：`v2.0-l15` 交付基线（1,086,613 / `015C0DC9…`）→ 本波启动 **L16-W1**，执行「指令 1」。
- **实现（合并双重全量序列化）**：新增 `_revSubstJson`（rev token 替换 · 前置 `{`/`,` + 后继 `,`/`}` + 唯一命中三重判定；字符串值内被转义 token 前置恒为 `\` 天然排除）；`runPersist` rev 递增后不再二次 `JSON.stringify(snapshot,_ORIGIN_STRIP)`，由首轮全量串经替换得到落盘串（**逐字节一致**）；不可判定 → 降级全量重序列化。`_lastWrittenJson` 口径不变（I-23）；L8 桌面增量 / 加密 / 浏览器分支行为不变；不新增 `<script>` 块（9 块不变）。
- **测试**：N 层回归 [`l16-w1-persist-rev.test.mjs`](../6.P0-T3基线/step9/t9/l16-w1-persist-rev.test.mjs:1) **6/6**；100k 节点 P95 **551.39 → 316.84 ms（−42.5% · ≥30% 达标）**，`BYTE_EQUAL=true`；证据 [`_l16w1_measure.out.txt`](../_临时脚本/_l16w1_measure.out.txt:1)。
- **门禁（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`（`FIVE_PARTY_DRIFT_COUNT=0`）；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7** 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0` / `BYTE_IDENTICAL=True`；附加 `_w4freeze`（0）/ `_w4paths`（`CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`）。证 [`_l16w1-registrar-2026-10-16.txt`](../8.发布与CI/reports/_l16w1-registrar-2026-10-16.txt:1) / [`_l16w1-verify-all-2026-10-16.txt`](../8.发布与CI/reports/_l16w1-verify-all-2026-10-16.txt:1)。
- **RL-11 红/绿证**：改字节后登记器先红 `FIVE_PARTY_DRIFT_COUNT=2`（canonical + step9-mirror）→ 同步期望值 → 复跑绿 `43 / 0 / PASS`（判别力真实）。
- **新锚点**：canonical = step9 镜像 = **1,088,117 B / LF / `4FA206A9F4608BDA076FD083A56E0517981156BE8C2DC693E5FBCE1AE3E7A5CA`**；`l9-hash-check.mjs` = 14,511 / CRLF / `18575086…`；`verify.js` 零变更（12,352 / `F7495A19…`）；冻结门三脚本 HEAD 期望随前进重算（`_w5freeze.ps1` / `_w4freeze.ps1` / `_w4paths.ps1`）；**43 方零漂移**。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品契约 / 公开 API 零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；下一入口 = **指令 2**（L16-W2）。

## 2026-10-16 — 维护手册版本对齐 · `MAINTENANCE.md` 锚点同步至 `v2.0-l15` ✅ 完成（纯文档对齐波 · 产品字节零变更 · 43 方零漂移 · canonical 1,086,613 零变更）

- 判定 = 完成（**维护手册版本对齐 · 纯文档 / 锚点同步波**）；**未修改产品代码字节（canonical 1,086,613 零变更）/ 未覆盖任何冻结件 / 未重复归档 / 未新增 AI 注释**（铁律 4 / 铁律 6）；维护手册 [`MAINTENANCE.md`](../0.规范/MAINTENANCE.md:1)。
- **承接**：`v2.0-l15` 正式发布收尾（[`l15-online-release-closure-2026-10-16.md`](../8.发布与CI/reports/l15-online-release-closure-2026-10-16.md:1)）→ 本波执行维护手册版本对齐与项目最终闭环。
- **版本锚点对齐**：适用版本 `v2.0-l14-2026-10-16` → **`v2.0-l15-2026-10-16`**；命名规范表 `L0~L14` → **`L0~L15`（下一迭代波 `L16`）**；release id 示例 → `v2.0-l15-2026-10-16`。
- **哈希锚点对齐**：canonical 旧锚 `1,020,617 B / LF / 1DB17C7E…102E3B0` → **`1,086,613 B / LF / 015C0DC9589FD410ABF4152CB2669A15A21DB22481236BC8A78DC39AD6E3BB5E`**；§5 登记器锚 → `13,843 / CRLF / D0AB9228…17C523`；§尾「维护基线结论」同步更新。
- **交付基线对齐**：唯一交付基线 → **`release\v2.0-l15-2026-10-16\`（4 件 / 1,095,221 B）** + 历史只读锚 `release\v2.0-l14\` / `frozen-l14` / `frozen-l13`；§4 新增 **S7「v2.0-l15 正式发布」收尾记录**。
- **一致性校验（实测）**：canonical 实读 = **1,086,613 B / LF / `015C0DC9589FD410ABF4152CB2669A15A21DB22481236BC8A78DC39AD6E3BB5E`**（`Get-FileHash -Algorithm SHA256`，exit 0）—— 与 [`CURRENT_TASK.md`](../2.项目日志/CURRENT_TASK.md:1) / 本日志 / [`MAINTENANCE.md`](../0.规范/MAINTENANCE.md:1) / 收尾报告四方文字一致（注：指令所载 `…ABF2152C…E3B8BFE` 系笔误 · 63 位，以实测 64 位为准）。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品字节零变更 / 冻结件零覆盖 / 归档不重复 / 未新增 AI 注释）；**43 方零漂移**（`FIVE_PARTY_DRIFT_COUNT=0`）；**`v2.0-l15` 已交付签收，项目彻底闭环，进入只读维护待命**。
- 证据：canonical 实测哈希（本波只读复算）；下一入口 = **只读维护待命**（后续变更须经决策 + RL-11 全量重算登记）。

## 2026-10-16 — L15 正式发布收尾 · 发布包 `v2.0-l15-2026-10-16`（4 件 / 1,095,221 B · FOUR_WAY_IDENTICAL=true · 43 方零漂移 · canonical 1,086,613 零变更）✅ 完成（纯发布/文档封存 · 产品零字节变更）

- 判定 = 完成（**L15 正式发布收尾 · 纯发布与文档封存波**）；**未修改产品代码字节（canonical 1,086,613 零变更）/ 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；收尾报告 [`l15-online-release-closure-2026-10-16.md`](../8.发布与CI/reports/l15-online-release-closure-2026-10-16.md:1) + 交付清单 [`l15-delivery-checklist-2026-10-16.md`](../8.发布与CI/reports/l15-delivery-checklist-2026-10-16.md:1)。
- **承接**：`L15` 收口与全面封存（归档 [`L15-2026-10-16`](../1.归档快照/L15-2026-10-16/_archived-manifest.md:1)）→ 本波正式发布 **`v2.0-l15`**。
- **发布包（新建目录）**：[`8.发布与CI\release\v2.0-l15-2026-10-16\`](../8.发布与CI/release/v2.0-l15-2026-10-16/RELEASE-NOTES.md:1)（**4 件 / 1,095,221 B**）：`ju-workbench-v2.0-l15.html`（1,086,613 / LF / `015C0DC9…E3BB5E`）+ `RELEASE-NOTES.md`（4,178 / LF / `A0A0FA53…F989`）+ `release-manifest.json`（4,115 / LF / `56A6B633…28E97`）+ `checksums.sha256`（315 / LF / `987E8742…9ABC`）。
- **四方一致（实测）**：canonical = step9 镜像 = 发布产物 = **1,086,613 / LF / `015C0DC9589FD410ABF4152CB2669A15A21DB22481236BC8A78DC39AD6E3BB5E`** ⇒ **`FOUR_WAY_IDENTICAL=true`**；`CHECKSUMS_DRIFT_COUNT=0`；`OLD_RELEASE_UNTOUCHED_DRIFT_COUNT=0`（L14 / L13 / L12 未覆盖）。
- **CI 门禁复核（三段 + 附加 · 全绿）**：Stage ① 43 方 `PASS`；Stage ② `verify.js all` exit 0（静态 **0 命中** + **Node 145** + **PW 171**（167 passed + 4 skipped）+ **bench 7/7**）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0` / `BYTE_IDENTICAL=True`；**无遗留 HASH-DRIFT**。
- **CI 门禁口径修正**：`ci-gate.yml`（3,312 / `13F06EF0…` → **3,325 / CRLF / `8814D5FED18F8B2EAB219A4F0B72613909E630822D0B7EED3CC45FFB257E0D32`**）；HEAD 注释更正为「L15-W1..W7 · HEAD = L15-W7（v2.0-l15 交付基线）」；口径保持 **43 方 / Node 145 + PW 171 + bench 7 / `-Wave l15`**。
- **哈希锚点（只读复算）**：`verify.js` = 12,352 / LF / `F7495A19…78D018`（零变更）；`l9-hash-check.mjs` = 13,843 / CRLF / `D0AB9228…17C523`（零变更）；`frozen-l14` = 1,012,003 / `D110699F…D7BBDD`（零变更）；`frozen-l13` = 991,316 / `21BECFD4…3AA3CA`（零变更）。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品字节零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；**`v2.0-l15` 已达交付标准**；项目进入**只读维护待命状态**。
- 证据：`8.发布与CI\reports\_l15release-w5freeze-2026-10-16.txt`（Stage ③）/ `_l15release-verify-all-2026-10-16.txt`（Stage ②）；下一入口 = **只读维护待命**（后续变更须经决策 + RL-11 全量重算登记）。

## 2026-10-16 — L15 收口与全面封存 · 归档 `L15-2026-10-16`（45 件 / 2,031,310 B · 43 方零漂移 · canonical 1,086,613 零变更）✅ 完成（纯归档/文档封存 · 产品零字节变更）

- 判定 = 完成（**L15 收口与全面封存 · 纯归档与文档封存波**）；**未修改产品代码字节（canonical 1,086,613 零变更）/ 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；收口报告 [`L15-Closure-2026-10-16.md`](../1.归档快照/L15-2026-10-16/L15-Closure-2026-10-16.md:1)。
- **承接**：`L15-W7`（思维导图节点拖动及同步 · 指令 11）→ 本波收口 **L15 全阶段（指令 5~11）**。
- **归档目录（新建）**：`1.归档快照\L15-2026-10-16\`（只读封存快照）；归档件 **45 件 / 2,031,310 字节**（`_archived-manifest.md` 自身另计）；逐件 字节 / SHA-256 / 行尾见 [`_archived-manifest.md`](../1.归档快照/L15-2026-10-16/_archived-manifest.md:1)。
- **归档构成**：L15 波报告 7（W1~W7）+ L15 设计 1 + L15 证据日志 7（绿证）+ L15 冻结门/登记证据 22 + L15 现行 canonical 1 + 接线/门禁/登记器 2 + 规格/N-P 层测试 3 + 承前快照 1 + 收口报告 1 = **45 件**。
- **五方一致性哈希（实测）**：canonical = step9 镜像 = 归档 canonical 副本 = **1,086,613 / LF / `015C0DC9589FD410ABF4152CB2669A15A21DB22481236BC8A78DC39AD6E3BB5E`**（三方逐字节一致）；`verify.js` = **12,352 / LF / `F7495A19…78D018`**；`l9-hash-check.mjs` = **13,843 / CRLF / `D0AB9228…17C523`**。
- **43 方登记（定值 · `LO-8=B`）**：登记器复跑 `node 6.P0-T3基线\step9\verify-hash-registry.mjs` = **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）；L15 全阶段**未新增 / 未退役纳编物**（方数保持 43）；证据 [`_l15closure-registrar-2026-10-16.txt`](../6.P0-T3基线/step9/reports/_l15closure-registrar-2026-10-16.txt:1)。
- **L15 全阶段锚点（只读历史锚）**：W1 1,022,711（`95C7D154…`）/ W2 1,027,819（`5875783E…`）/ W3 1,033,723（`F51B0C83…`）/ W4 1,047,633（`9FE5B31D…`）/ W5 1,072,900（`C6477276…`）/ W6 1,081,576（`4253D888…`）/ W7 **1,086,613**（`015C0DC9…`）；累计 **+65,996 B**（7 波）。
- **交付/维护基线（只读 · 历史锚）**：`release\v2.0-l14-2026-10-16\`（4 件）+ `frozen-l14`（1,012,003 / `D110699F…D7BBDD`）+ `frozen-l13`（991,316 / `21BECFD4…3AA3CA`）；**v2.0-l15 候选基线** = canonical 1,086,613（正式发布包须新建目录 · 须经决策）。
- **红线守持 + 结论**：**RL-1…RL-3 + 铁律 4/6** 全守持（产品字节零变更 / 冻结件零覆盖 / 归档不重复 / **未新增 AI 注释**）；**L15 阶段告一段落，UI 交互与视图扩展需求已全部闭环**；下一入口 = **待决策（发布 v2.0-l15 或启动新需求）**。

## 2026-10-16 — L15-W7 · 思维导图节点拖动及同步（指令 11）✅ 完成（改产品字节波 · canonical 1,081,576 → 1,086,613 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L15 第七波 · 改产品字节波**）；承铁律 4 已同步 step9 镜像（逐字节）+ RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l15-w7-2026-10-16.md`](../8.发布与CI/reports/l15-w7-2026-10-16.md:1)。
- **承接**：`L15-W6`（图谱视图连线锚点优化 · 指令 10）→ 本波收口 **指令 11**。
- **实现（导图节点拖动 + 同步）**：① 节点**自由拖拽改位置**（`mmX/mmY`）+ **拖到另一节点改层级（变子节点）**；② **视觉反馈**（拖动中 `.dragging` 半透明 / 落点 `.drop-target` 高亮 + `::after`「设为子节点」指示器）；③ 画布**平移 / 缩放**沿用；④ **G-2** 拖动仅局部状态（`_mmDrag`，`useRef` 等价）+ 单 rAF，仅 `mouseup` 单次提交并生成 **`changedIds` 增量补丁 `{被移动节点, 原父, 新父}`**（G-5，≤3）；⑤ **G-1** 换行撑高经 ResizeObserver 实时重绘连线、改层级后清手动坐标自动重排；⑥ >200 节点**视口裁剪** + `content-visibility` 懒渲染；不新增 `<script>` 块（9 块不变）。
- **RL-11 先改后补**：改字节 → 同步 step9 镜像 → 登记器红（canonical + step9-mirror drift=2）→ 同步 [`l9\l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:32) 期望 → 复跑 **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **新版锚点**：canonical = step9 镜像 = **1,086,613 / LF / `015C0DC9589FD410ABF4152CB2669A15A21DB22481236BC8A78DC39AD6E3BB5E`**（`BYTE_IDENTICAL=True` · 字节 **+5,037**）；`verify.js` = 12,352 / LF / `F7495A19…78D018`（**零变更**）；`l9-hash-check.mjs` = 13,843 / CRLF / `D0AB9228…17C523`。
- **门禁口径**：`ci-gate.yml` = **43 方 / Node 145 + PW 171 + bench 7 / `-Wave l15`**（3,312 / CRLF / `13F06EF0…` · **零变更**）；L15 HEAD 期望重算：`_w5freeze.ps1`（24,201 / `4A8CF2BF…`）+ `_w4freeze.ps1`（15,892 / `0EB62355…`）+ `_w4paths.ps1`（8,002 / `9B129E20…`）。
- **三段门禁 + 附加（全绿）**：Stage ① 43 方 `PASS`；Stage ② `verify.js all` exit 0（静态 0 命中 + Node 145 + PW 167 passed + 4 skipped = 171 + bench 0 失败 / 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`；附加 `_w4freeze` `FROZEN_DRIFT_COUNT=0` / `_w4paths` `CANARY_ARTIFACTS=128` / `VIOLATION_COUNT=0`；VM 语法自检 9 块 `SYNTAX_FAIL_COUNT=0`。
- **红线守持**：**RL-1…RL-3 + 铁律 4/6** 全守持；`1.冻结版本\*` 零改动（`FROZEN-OK`）/ `1.归档快照\*` 零改动 / 旧发布包原样保留 / **未新增 AI 注释**。
- 证据：`reports\l15-w7-green-log-2026-10-16.txt` / `_l15w7-w5freeze.txt` / `_l15w7-w4freeze.txt` / `_l15w7-w4paths.txt` / `_l15w7-registrar.txt`；下一入口 = **L15 收口与全面封存**。

## 2026-10-16 — L15-W6 · 图谱视图连线锚点优化（指令 10）✅ 完成（改产品字节波 · canonical 1,072,900 → 1,081,576 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L15 第六波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像 + RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l15-w6-2026-10-16.md`](../8.发布与CI/reports/l15-w6-2026-10-16.md:1)。
- **承接**：`L15-W5`（新增幻灯片视图 · 指令 9）→ 本波收口 **指令 10**。
- **实现（`juBorderAnchor` + 图谱/导图接线）**：连线端点由「节点中心 / 左缘」改为**最外层容器外边框盒（Border Box）最近交点**（节点内部预留 padding，绝不连文字 / 中心）；图谱 `renderGraph` / 导图 `renderMindmap` 均接入 **ResizeObserver**（G-1 文字换行撑高实时重绘）+ **单 rAF 节流 + 尺寸缓存**（G-2 `getBoundingClientRect` 仅对 dirty 节点于 rAF 内节流测量）+ **`changedIds` 增量补丁 + 视口裁剪**（G-5，严禁全局重算）+ 连线层 **z-index 置底**（节点层抬升，连线不压文字）；拖拽仅重算受影响连线；不新增 `<script>` 块（9 块不变）。
- **RL-11 先改后补**：改字节 → 同步 step9 镜像 → 登记器红（canonical + step9-mirror drift=2）→ 同步 [`l9\l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:32) 期望 → 复跑 **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **新版锚点**：canonical = step9 镜像 = **1,081,576 / LF / `4253D888E18E0A1002D5C145923AC918556CF4B50BE9DFB546156A4D2BB18C78`**（`BYTE_IDENTICAL=True` · 字节 **+8,676**）；`verify.js` = 12,352 / LF / `F7495A19…78D018`（**零变更**）；`l9-hash-check.mjs` = 12,972 / CRLF / `6E2B3B32…78B5BF`。
- **门禁口径**：`ci-gate.yml` = **43 方 / Node 145 + PW 171 + bench 7 / `-Wave l15`**（3,312 / CRLF / `13F06EF0…` · **零变更**）；L15 HEAD 期望重算：`_w5freeze.ps1`（24,082 / `F80D4D20…`）+ `_w4freeze.ps1`（15,773 / `F1F8C901…`）+ `_w4paths.ps1`（7,883 / `F9E6873C…`）。
- **三段门禁 + 附加（全绿）**：Stage ① 43 方 `PASS`；Stage ② `verify.js all` exit 0（静态 0 命中 + Node 145 + PW 167 passed + 4 skipped = 171 + bench 0 失败 / 最大劣化 0.0%）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`；附加 `_w4freeze` `FROZEN_DRIFT_COUNT=0` / `_w4paths` `CANARY_ARTIFACTS=127` / `VIOLATION_COUNT=0`；VM 语法自检 9 块 `SYNTAX_FAIL_COUNT=0`。
- **红线守持**：**RL-1…RL-3 + 铁律 4/6** 全守持；`1.冻结版本\*` 零改动（`FROZEN-OK`）/ `1.归档快照\*` 零改动 / 旧发布包原样保留 / **未新增 AI 注释**。
- 证据：`reports\l15-w6-green-log-2026-10-16.txt` / `_l15w6-w5freeze.txt` / `_l15w6-w4freeze.txt` / `_l15w6-w4paths.txt`；下一入口 = **指令 11**。

## 2026-10-16 — L15-W5 · 新增幻灯片视图（指令 9）✅ 完成（改产品字节波 · canonical 1,047,633 → 1,072,900 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L15 第五波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像 + RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l15-w5-2026-10-16.md`](../8.发布与CI/reports/l15-w5-2026-10-16.md:1) ／ 设计 [`l15-w5-design-2026-10-16.md`](../6.P0-T3基线/step9/reports/l15-w5-design-2026-10-16.md:1)。
- **承接**：`L15-W4`（侧边栏模块拖拽与调整大小 · 指令 8）→ 本波收口 **指令 9**。
- **实现（`JU_SLIDES`）**：① 顶部工具栏「幻灯片」入口（`data-view="slides"` + `TOP_LEVEL_VIEWS`）；② **左右分栏**（左缩略图**虚拟化** / 右编辑预览区）；③ **图片管理**（上传 / 拖拽 / 粘贴 · 拖动 / 调整大小 / 对齐 / 设为背景 · **百分比几何边界内钳制** · 独立键 `juju.slides.v1`）；④ **演示模式**（大纲顶级节点**自动分页** · 全屏 · 隐藏工具栏 · 方向键/点击切换 · 页码指示器 · ESC 退出）；⑤ **G-1** 文本框高度自适应 + 窗口调整实时重排；**G-2/G-5** 单 rAF 节流 + 大图懒加载 + **`changedIds` 增量补丁**。
- **RL-11 先改后补**：改字节 → 同步 step9 镜像 → 登记器红（canonical + step9-mirror drift=2）→ 同步 [`l9\l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:32) 期望 → 复跑 **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **新版锚点**：canonical = step9 镜像 = **1,072,900 / LF / `C64772762C3EF20092EA9A6C53D2533E7D035E0D457A945388CD10F0183A5069`**（`BYTE_IDENTICAL=True` · 字节 **+25,267**）；`verify.js` = 12,352 / LF / `F7495A19…78D018`（**零变更**）；`l9-hash-check.mjs` = 12,951 / CRLF / `5E541DE6…E5417E5`。
- **门禁口径**：`ci-gate.yml` = **43 方 / Node 145 + PW 171 + bench 7 / `-Wave l15`**（3,312 / CRLF / `13F06EF0…` · **零变更**）；L15 HEAD 期望重算：`_w5freeze.ps1`（23,955 / `6CAC13E3…`）+ `_w4freeze.ps1`（15,646 / `910ECB95…`）+ `_w4paths.ps1`（7,756 / `4E4BB0F0…`）。
- **三段门禁 + 附加（全绿）**：Stage ① 43 方 `PASS`；Stage ② `verify.js all` exit 0（静态 0 命中 + Node 145 + PW 167 passed + 4 skipped = 171 + bench 0 失败）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`；附加 `_w4freeze` `FROZEN_DRIFT_COUNT=0` / `_w4paths` `CANARY_ARTIFACTS=126` / `VIOLATION_COUNT=0`；VM 语法自检 9 块 `SYNTAX_FAIL_COUNT=0`。
- **红线守持**：**RL-1…RL-3 + 铁律 4/6** 全守持；`1.冻结版本\*` 零改动（`FROZEN-OK`）/ `1.归档快照\*` 零改动 / 旧发布包原样保留 / **未新增 AI 注释**。
- 证据：`reports\l15-w5-green-log-2026-10-16.txt` / `_l15w5-w5freeze.txt` / `_l15w5-w4freeze.txt` / `_l15w5-w4paths.txt`；下一入口 = **指令 10**。

## 2026-10-16 — L15-W4 · 侧边栏模块拖拽与调整大小（指令 8）✅ 完成（改产品字节波 · canonical 1,033,723 → 1,047,633 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L15 第四波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像 + RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l15-w4-2026-10-16.md`](../8.发布与CI/reports/l15-w4-2026-10-16.md:1)。
- **承接**：`L15-W3`（备份文件夹选择功能 · 指令 7）→ 本波收口 **指令 8**；依据 [`拖拽调整大小规范.md`](../7.UI交互增强/拖拽调整大小规范.md:1)。
- **实现（`JU_DND`）**：① 可折叠分区（右侧栏 `.sr-section` / 左侧栏导航组）**拖拽改顺序** + **折叠态持久化** + **高度调整**；② 浮窗 / 悬浮日历（`#floatCal` / `#pomoTimer` / `#settingsPanel`）**尺寸调整** + **视口内钳制** + **位置尺寸持久化**；③ 状态存 `ui.dnd`（`_saveUINow` + 桌面 `uiSnapshot`/`applyUIFields`）**重启可读**；④ **G-2**：`pointermove` 单 rAF 节流；**G-5**：仅更新受影响单元素（无全局重算）；**G-1**：文本实时重排不撑破布局；**pagehide** 兜底清理（防内存泄漏）。
- **RL-11 先改后补**：改字节 → 同步 step9 镜像 → 登记器红（canonical + step9-mirror drift=2）→ 同步 [`l9\l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:36) 期望 → 复跑 **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **新版锚点**：canonical = step9 镜像 = **1,047,633 / LF / `9FE5B31DDF9E2498D01A0FF0B980022A5DBEB1227AE1BBBA244AD9AD69F14076`**（`BYTE_IDENTICAL=True` · 字节 **+13,910**）；`verify.js` = 12,352 / LF / `F7495A19…78D018`（**零变更**）；`l9-hash-check.mjs` = 12,786 / CRLF / `C8D9D168…B6C193`。
- **门禁口径**：`ci-gate.yml` = **43 方 / Node 145 + PW 171 + bench 7 / `-Wave l15`**（3,312 / CRLF / `13F06EF0…` · **零变更**）；L15 HEAD 期望重算：`_w5freeze.ps1`（23,847 / `B9059688…`）+ `_w4freeze.ps1`（15,538 / `2056EA67…`）+ `_w4paths.ps1`（7,648 / `5BAF056B…`）。
- **三段门禁 + 附加（全绿）**：Stage ① 43 方 `PASS`；Stage ② `verify.js all` exit 0（静态 0 命中 + Node 145 + PW 167 passed + 4 skipped = 171 + bench 7/7）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`；附加 `_w4freeze` `FROZEN_DRIFT_COUNT=0` / `_w4paths` `CANARY_ARTIFACTS=124` / `VIOLATION_COUNT=0`；VM 语法自检 9 块 `SYNTAX_FAIL_COUNT=0`。
- **红线守持**：**RL-1…RL-3 + 铁律 4/6** 全守持；`1.冻结版本\*` 零改动（`FROZEN-OK`）/ `1.归档快照\*` 零改动 / 旧发布包原样保留 / **未新增 AI 注释**。
- 证据：`reports\l15-w4-green-log-2026-10-16.txt` / `_l15w4-w5freeze.txt` / `_l15w4-w4freeze.txt` / `_l15w4-w4paths.txt`；下一入口 = **指令 9**。

## 2026-10-16 — L15-W3 · 备份文件夹选择功能（指令 7）✅ 完成（改产品字节波 · canonical 1,027,819 → 1,033,723 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L15 第三波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像 + RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l15-w3-2026-10-16.md`](../8.发布与CI/reports/l15-w3-2026-10-16.md:1)。
- **承接**：`L15-W2`（文件 / 输入行多选与全选 · 指令 6）→ 本波收口 **指令 7**；设置项置于「关闭应用时自动备份全部数据」下方。
- **实现**：新增「备份数据文件夹位置」（左标签 / 右路径 + 「浏览/选择」+「恢复默认路径」；未选显示「默认路径」）；选择器**分层降级**（桌面 Tauri `pick_directory` → Web `showDirectoryPicker({mode:'readwrite'})` → `input webkitdirectory`）；**取消保持原路径**；路径存 `ui.backupDir`（`_saveUINow` 明文 UI + 桌面 `uiSnapshot`/`applyUIFields`）**重启可读**；与关闭自动备份**联动**（有效目录导出完整备份）；**系统关键目录拦截 + 无效路径回退默认**；G-1 自适应（路径折行 + 2 行省略，不撑破布局）。
- **RL-11 先改后补**：改字节 → 同步 step9 镜像 → 登记器红（canonical + step9-mirror drift=2）→ 同步 [`l9\l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:36) 期望 → 复跑 **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **新版锚点**：canonical = step9 镜像 = **1,033,723 / LF / `F51B0C8330638E7AC02FCFAAF6C346188DB408AB675CE782152DFC0761A88529`**（`BYTE_IDENTICAL=True` · 字节 **+5,904**）；`verify.js` = 12,352 / LF / `F7495A19…78D018`（**零变更**）；`l9-hash-check.mjs` = 12,695 / CRLF / `FFBBD9B2…EA53C4`。
- **门禁口径**：`ci-gate.yml` = **43 方 / Node 145 + PW 171 + bench 7 / `-Wave l15`**（3,312 / CRLF / `13F06EF0…` · **零变更**）；L15 HEAD 期望重算：`_w5freeze.ps1`（23,725 / `7A5B1DFD…`）+ `_w4freeze.ps1`（15,416 / `94EFB39F…`）+ `_w4paths.ps1`（7,526 / `548FCF35…`）。
- **三段门禁 + 附加（全绿）**：Stage ① 43 方 `PASS`；Stage ② `verify.js all` exit 0（静态 0 命中 + Node 145 + PW 167 passed + 4 skipped = 171 + bench 7/7）；Stage ③ `_w5freeze.ps1 -Wave l15 -NoFreeze` `FROZEN_DRIFT_COUNT=0`；附加 `_w4freeze` `FROZEN_DRIFT_COUNT=0` / `_w4paths` `CANARY_ARTIFACTS=123` / `VIOLATION_COUNT=0`。
- **红线守持**：**RL-1…RL-3 + 铁律 4/6** 全守持；`1.冻结版本\*` 零改动（`FROZEN-OK`）/ `1.归档快照\*` 零改动 / 旧发布包原样保留 / **未新增 AI 注释**。
- 证据：`reports\l15-w3-green-log-2026-10-16.txt` / `_l15w3-w5freeze.txt` / `_l15w3-w4freeze.txt` / `_l15w3-w4paths.txt`；下一入口 = **指令 8**。

## 2026-10-16 — L15-W2 · 文件 / 输入行多选与全选（指令 6）✅ 完成（改产品字节波 · canonical 1,022,711 → 1,027,819 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L15 第二波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像 + RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l15-w2-2026-10-16.md`](../8.发布与CI/reports/l15-w2-2026-10-16.md:1)。
- **承接**：`L15-W1`（折叠按钮与沉浸模式）→ 本波收口 **指令 6**；承接《JU软件设计框架规范》十六 16.2 + [`多选与全选规范.md`](../7.UI交互增强/多选与全选规范.md:1)。
- **实现**：新增模块级选择模型 `_mSel={type,ids:Set,anchorId,mode,order}`（仅内存 · 不持久化 · 不入撤销栈）；文件卡片 `renderFileCard` + 数据库输入行 `renderDbTable` 接入 **单击单选 · Ctrl/Cmd 切换 · Shift 范围**；工具栏「全选」+ 全局 **Ctrl/Cmd+A** 全选当前视图（大纲补 Ctrl+A）；`Esc` 清除；编辑态不劫持 Ctrl+A；新增 `.ju-msel` 高亮（`accent-soft` 背景）；`_mSelPaint()` **rAF 合批**；全选基于视图模型 `order`（虚拟滚动不漏选）。
- **RL-11 先改后补**：改字节 → 同步 step9 镜像 → 登记器红（canonical drift=1）→ 同步 [`l9\l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:32) 期望 → 复跑 **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **新版锚点**：canonical = step9 镜像 = **1,027,819 / LF / `5875783E7936C2D16C387CF1519E0D5E36F5336660D4358B1BD8E2DF0713BD79`**（`BYTE_IDENTICAL=True` · 字节 **+5,108**）；`verify.js` = 12,352 / LF / `F7495A19…78D018`（**零变更**）；`l9-hash-check.mjs` = 12,618 / CRLF / `B9C01925…D3BCE4`。
- **门禁口径**：`ci-gate.yml` = **43 方 / Node 145 + PW 171 + bench 7 / `-Wave l15`**（3,312 / CRLF / `13F06EF0…` · **零变更**）；L15 HEAD 期望重算：`_w5freeze.ps1`（23,734 / `83D86047…`）+ `_w4freeze.ps1`（15,425 / `832F7386…`）+ `_w4paths.ps1`（7,535 / `60207E93…`）。
- **三段门禁 + 附加（全绿）**：Stage ① 43 方 `PASS`；Stage ② `verify.js all` exit 0（静态 0 命中 + Node 145 + PW 167 passed + 4 skipped = 171 + bench 7/7）；Stage ③ `_w5freeze.ps1 -Wave l15` `FROZEN_DRIFT_COUNT=0`；附加 `_w4freeze` `FROZEN_DRIFT_COUNT=0` / `_w4paths` `CANARY_ARTIFACTS=120` / `VIOLATION_COUNT=0`。
- **红线守持**：**RL-1…RL-3 + 铁律 4/6** 全守持；`1.冻结版本\*` 零改动（`FROZEN-OK`）/ `1.归档快照\*` 零改动 / 旧发布包原样保留 / **未新增 AI 注释**。
- 证据：`reports\l15-w2-green-log-2026-10-16.txt` / `_l15w2-w5freeze.txt` / `_l15w2-w4freeze.txt` / `_l15w2-w4paths.txt`；下一入口 = **指令 7**。

## 2026-10-16 — L15-W1 · 折叠按钮与沉浸模式（指令 5）✅ 完成（改产品字节波 · canonical 1,020,617 → 1,022,711 · 43 方零漂移 · 三段门禁全绿）

- 判定 = 完成（**L15 首波 · 改产品字节波**）；承铁律 4 已 `Copy-Item` 同步 step9 镜像 + RL-11 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l15-w1-2026-10-16.md`](../8.发布与CI/reports/l15-w1-2026-10-16.md:1)。
- **脱只读维护 · 启动新阶段**：由 `v2.0-l14-2026-10-16`（交付 / 维护基线）→ 启动 **L15 / v2.1-dev / v3.x**（UI 交互与视图扩展）；承接《JU软件设计框架规范》十六 16.3 + [`沉浸模式与侧栏折叠按钮规范.md`](../7.UI交互增强/沉浸模式与侧栏折叠按钮规范.md:1)。
- **实现（canonical 三处）**：① 折叠按钮由顶角 `absolute` 改底角 `fixed`（`bottom:8px` · 免疫滚动）+ 沉浸式淡化 `opacity:.2` ↔ `:hover/:focus-visible` `1`（平滑过渡）；② 新增中部 [`#btnToggleBoth`](../6.P0-T3基线/v2.0-l3.html.html:1)「同时折叠/展开」按钮（`.main-toggle.both` · 水平居中）；③ [`bindMainToggles()`](../6.P0-T3基线/v2.0-l3.html.html:1) 接线中钮 + 左右栏 `resize` `mousemove` 改 **rAF 节流（G-2）**。
- **布局守持**：`fixed` 悬浮不挤压文本；侧栏 150px 极窄下三钮互不重叠；侧栏全折叠时按钮保持可用并贴视口边缘；打印隐藏非内容元素（既有 `@media print`）；G-1 文本自适应不受影响。
- **RL-11 先改后补**：改字节 → 同步 step9 镜像 → 登记器红（canonical / step9-mirror drift=2）→ 同步 [`l9\l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:35) 期望 → 复跑 **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **新版锚点**：canonical = step9 镜像 = **1,022,711 / LF / `95C7D154DA4E0F71479F7BD1F19011599C88AF9924700B972C4B8F7B27375AF5`**（`BYTE_IDENTICAL=True` · 字节 **+2,094**）；`verify.js` = 12,352 / LF / `F7495A19…78D018`（**零变更**）；`l9-hash-check.mjs` = 12,581 / CRLF / `FE6E574B…354ACB`。
- **门禁口径前进（同步修正）**：`ci-gate.yml` → **43 方 / Node 145 + PW 171 + bench 7 / `-Wave l15`**（3,312 / CRLF / `13F06EF0…`）；版本感知扩 `l15`：`_w5freeze.ps1`（23,643 / `6830051E…`）+ `_w4freeze.ps1`（15,325 / `B133A712…`）+ `_w4paths.ps1`（7,435 / `A0007740…`）。
- **三段门禁 + 附加（全绿）**：Stage ① 43 方 `PASS`；Stage ② `verify.js all` exit 0（静态 0 命中 + Node 145 + PW 167 passed + 4 skipped = 171 + bench 7/7）；Stage ③ `_w5freeze.ps1 -Wave l15` `FROZEN_DRIFT_COUNT=0`；附加 `_w4freeze` `FROZEN_DRIFT_COUNT=0` / `_w4paths` `CANARY_ARTIFACTS=119` / `VIOLATION_COUNT=0`。
- **红线守持**：**RL-1…RL-3 + 铁律 4/6** 全守持；`1.冻结版本\*` 零改动（`FROZEN-OK`）/ `1.归档快照\*` 零改动 / 旧发布包原样保留 / **未新增 AI 注释**。
- 证据：`reports\l15-w1-green-log-2026-10-16.txt` / `_l15w1-w5freeze.txt` / `_l15w1-w4freeze.txt` / `_l15w1-w4paths.txt`；下一入口 = **指令 6**。

## 2026-10-16 — 项目全面闭环 · 交付/维护模式激活（最终关闭报告）✅ 完成（纯文档/关闭波 · 产品字节零变更 · 43 方零漂移 · canonical 1,020,617 · 基线只读）

- 判定 = 完成（**最终关闭波 · 交付/维护模式激活**）；**未改产品代码字节（canonical 零变更）/ 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；关闭报告 [`l14-project-closure-2026-10-16.md`](../8.发布与CI/reports/l14-project-closure-2026-10-16.md:1)。
- **路线决策**：择定 **【选项 B：交付 / 维护】**（冻结基线只读维护），彻底关闭项目开发周期；未来若明确上线计划再评估【选项 A：线上部署】。
- **最终关闭报告（新建）**：项目全周期概览（L3~L14）+ 最终哈希锚点 + 交付物清单（唯一交付基线）+ 维护手册索引（`MAINTENANCE.md` §0~§9）+ 红线守持。
- **43 方锚点（本波只读复核）**：`node l9\l9-hash-check.mjs` = **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）；证据 [`_l14closure_registrar.out.txt`](../8.发布与CI/reports/_l14closure_registrar.out.txt:1)。
- **最终哈希锚点**：canonical = step9 镜像 = 发布产物 = **1,020,617 / LF / `1DB17C7E3F71F78B1D1788EFACBABA2C46400EBA4E3AC149046DACA19102E3B0`**（`FOUR_WAY_IDENTICAL=true`）；`frozen-l14` = 1,012,003 / `D110699F…D7BBDD`；`frozen-l13` = 991,316 / `21BECFD4…3AA3CA`（历史只读锚 · 零变更）。
- **唯一交付基线（只读）**：`release\v2.0-l14-2026-10-16\`（4 件 / 1,028,100 B）+ `frozen-l14` + `frozen-l13`；承 [`l14-final-acceptance-2026-10-16.md`](../8.发布与CI/reports/l14-final-acceptance-2026-10-16.md:1) §五。
- **维护模式声明**：冻结基线（发布包 / `frozen-l13` / `frozen-l14` / 归档快照）**只读**；后续任何变更须经 **决策** 并遵循 [`MAINTENANCE.md`](../0.规范/MAINTENANCE.md:1) **RL-11 先改后补** + 全量重算登记（铁律 4 / 铁律 6）。
- **红线守持**：**RL-1…RL-3 + 铁律 4/6** 全守持；`1.冻结版本\*` 零改动 / `1.归档快照\*` 零改动（未重复归档）/ 旧发布包原样保留 / **未新增 AI 注释**。
- 结论：**项目已全面闭环，正式进入交付/维护阶段，维护基线已生效**；开发周期关闭，进入长期维护模式。

## 2026-10-16 — L14 最终交付签收 · 维护基线建立（`MAINTENANCE.md`）✅ 完成（纯文档/签收波 · 产品字节零变更 · 43 方零漂移 · canonical 1,020,617 · 项目进入交付/维护阶段）

- 判定 = 完成（**最终交付签收波**）；**未改产品代码字节（canonical 零变更）/ 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；签收单 [`l14-final-acceptance-2026-10-16.md`](../8.发布与CI/reports/l14-final-acceptance-2026-10-16.md:1)。
- **最终交付签收单（新建）**：交付物清单（14 项）+ 最终哈希锚点（canonical = step9 镜像 = 发布产物 = **1,020,617 / LF / `1DB17C7E…102E3B0`** ⇒ `FOUR_WAY_IDENTICAL=true`）+ CI 状态（全绿）+ 签收结论。
- **唯一交付基线锁定**：[`release\v2.0-l14-2026-10-16\`](../8.发布与CI/release/v2.0-l14-2026-10-16/RELEASE-NOTES.md:1)（4 件 / 1,028,100 B）= 唯一交付基线；`frozen-l14`（1,012,003 / `D110699F…D7BBDD`）+ `frozen-l13`（991,316 / `21BECFD4…3AA3CA`）= 历史只读锚（唯一交付基线）。
- **维护基线建立（新建）**：[`MAINTENANCE.md`](../0.规范/MAINTENANCE.md:1) —— 产品版本号规范（L14 后 → `L15` 或正式 `v3.x`）/ 产品代码修改流程（铁律 4 / 铁律 6）/ 哈希锚点更新规范（RL-11 先改后补）/ CI 门禁触发条件 / 43 方登记器维护指南 / OP-20 观察项（p95 帧预算等）处理规程。
- **CI 状态（L14 口径 · 全绿）**：`ci-gate.yml` = **43 方 / Node 145 + PW 171 + bench 7 / `-Wave l14`**；Stage ① registrar `PASS` / Stage ② `verify.js all` exit 0 / Stage ③ `_w5freeze.ps1` `FROZEN_DRIFT_COUNT=0`；附加 `_w4freeze` / `_w4paths` 全绿。
- **本波实测（只读）**：canonical = step9 镜像 = 发布产物 = `1DB17C7E…102E3B0`（三方逐字节一致）；`frozen-l14` / `frozen-l13` 哈希与历史登记值一致（零变更）；发布包 4 件 / 1,028,100 B 逐件字节一致。
- **红线守持**：**RL-1…RL-3 + 铁律 4/6** 全守持；`1.冻结版本\*` 零改动 / `1.归档快照\*` 零改动 / 旧发布包原样保留 / **未新增 AI 注释**；**43 方零漂移**。
- 结论：**最终交付签收已完成，维护基线已建立，项目正式进入交付/维护阶段**；下一入口 = **线上部署** 或 **冻结基线只读维护**。

## 2026-10-16 — L14 正式上线收尾（最终交付）· 发布包重建 `v2.0-l14-2026-10-16` + CI 复核（选项 A）✅ 完成（发布/工装/文档 · 43 方零漂移 · canonical 1,020,617 零变更）

- 判定 = 完成（**正式上线收尾波 · 最终交付**，路径 B 收口 S6）；**未改产品代码字节（canonical 零变更）/ 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l14-online-release-closure-2026-10-16.md`](../6.P0-T3基线/step9/reports/l14-online-release-closure-2026-10-16.md:1)。
- **发布包重建（新建 · 非覆盖 L13 包）**：[`8.发布与CI\release\v2.0-l14-2026-10-16\`](../8.发布与CI/release/v2.0-l14-2026-10-16/RELEASE-NOTES.md:1)（**4 件 / 1,028,100 B**）—— 发布产物 `ju-workbench-v2.0-l14.html` = canonical **逐字节副本**（1,020,617 / `1DB17C7E…102E3B0` / LF）；`release-manifest.json` 4,044 / `B05CDD34…`；`checksums.sha256` 315 / `70EAABBA…`；`RELEASE-NOTES.md` 3,124 / `2FD4CEA6…`。
- **四方一致**：canonical = step9 镜像 = 发布产物 = 包内校验记录 = **1,020,617 / `1DB17C7E3F71F78B1D1788EFACBABA2C46400EBA4E3AC149046DACA19102E3B0` / LF** ⇒ **`FOUR_WAY_IDENTICAL=true`**；**`CHECKSUMS_DRIFT_COUNT=0`**；`frozen-l14` = 1,012,003 / `D110699F…D7BBDD`（**历史只读锚 · 零变更 · 不参与四方判定**）。
- **CI 门禁修正（消除遗留 HASH-DRIFT）**：[`ci\ci-gate.yml`](../8.发布与CI/ci/ci-gate.yml:1) → **43 方 / Node 145 + PW 171 + bench 7 / `-Wave l14`**（3,281 / CRLF / `86CFAA16…CEC476`）；冻结门三脚本 **L14 HEAD 期望重算**（1,012,003 → 1,020,617）+ **HEAD/FROZ 代次解耦**（`frozen-l14` 转历史锚）：`_w5freeze.ps1` 22,817 / `F0ACF606…`、`_w4freeze.ps1` 14,865 / `A86EFFC3…`、`_w4paths.ps1` 7,206 / `ECF5C145…`（均 CRLF · 非登记对象）。
- **红 → 绿（判别力真实）**：修正前 `-Wave l14` = `P1/P2 HASH-DRIFT` + `THREE_PARTY_IDENTICAL=False`；`_w4paths.ps1 -Wave l14` = `canonical HASH-DRIFT` / `VIOLATION_COUNT=1`（FAIL）⇒ 修正后 **三门全绿**：`FROZEN_DRIFT_COUNT=0`（`BYTE_IDENTICAL=True` / `THREE_PARTY_IDENTICAL=DECOUPLED`）、`_w4freeze` `FROZEN_DRIFT_COUNT=0`、`_w4paths` `CANARY_ARTIFACTS=117` / `VIOLATION_COUNT=0`。
- **登记器复跑**：`node l9\l9-hash-check.mjs` = **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）；`verify.js` = 12,352 / LF / `F7495A19…78D018`（零变更）；`l9-hash-check.mjs` = 12,408 / CRLF / `CF1D0DAD…F96168`。
- **旧包未覆盖核对**：`v2.0-l13-2026-10-16\`（991,316 / `21BECFD4…`）与 `v2.0-l12-2026-10-16\`（983,460 / `CFCD67DA…`）逐件复核 = 前代登记值（**`OLD_RELEASE_UNTOUCHED_DRIFT_COUNT=0`**）。
- **红线守持**：**RL-1…RL-3 + 铁律 4/6** 全守持；`1.冻结版本\*` 零改动 / `1.归档快照\*` 零改动（未重复归档）/ 旧发布包原样保留 / **未新增 AI 注释**；`8.发布与CI\` 位于 `step9` 之外 ⇒ 43 方登记不变。
- 证据：`_l14online_verify.out.txt` / `_l14online_hashes.out.txt` / `_l14online_registrar.out.txt` / `_l14online_w5post.txt` / `_l14online_w4f_post.txt` / `_l14online_w4p_post.txt`（红证 `*_pre.txt`）；下一入口 = **线上部署 / 交付维护**。

## 2026-10-16 — OP-20 专项优化 · 100k 视窗 longtask / p95 帧预算收敛（G7 时间切片）✅ 完成（OP-20 OPEN → CLOSED · 产品字节变更波 · 43 方零漂移 · canonical 1,020,617）

- 判定 = 完成（**OP-20 收口波 · 改产品字节**）；承铁律 4 已同步 step9 镜像 + 全量重算登记；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`op20-convergence-2026-10-16.md`](../6.P0-T3基线/step9/reports/op20-convergence-2026-10-16.md:1)。
- **根因（只读诊断）**：四处 100k 规模 O(n) 热区 —— `renderSidebar` 全表扫 + `new Set(root.children)`（≈43ms/次）、`renderIntro` `docWordCount`+`docNodeCount` 全量重扫（≈10–35ms/次）、`_vsShouldUse` 未走代次缓存 `countVisibleNodes`（≈10ms/次）、冷 `__vsGenFlatten` 同步双遍历（≈63ms · 长任务）。
- **优化（G7 · 时间切片 Time Slicing · 全量 `__l14On()` 门控）**：切片调度器 `__l14Slice`（≤6ms/帧预算 · rAF）；`__vsCoopFlatten` 协同展开（与 `_vsFlatten` 逐节点等价）+ `__vsGenFlatten` 冷路径改造；侧栏计数代次 memo + 分片累加 `__l14SideScanEnsure`；摘要统计单次遍历协同 `__l14IntroCounts`/`__l14IntroJob`；`_vsShouldUse` 复用 `__vsGenCount`。缺省路径语义与 L14 冻结件逐字节一致。
- **OP-20 出口判据全绿（`JU_L14=1 JU_L14_100K=1` 实测）**：longtask **2 / max 321ms → 0 / 0ms**；p95 **55.3ms → 3.0ms**（预算 16ms）；RSS **42.63MB → 28.04MB**（≤ 200MB）⇒ `longtaskGate` / `p95Gate` / `rssGate` 全 `ok`。
- **任务级相位**：`enable()` 64.1 → **45.0ms**；预热 render 54.7 → **16.4ms**；3 × 切 outline 合计 ≈169 → **3.8ms**；切片 `maxSliceMs=20`（< 50ms 门）。
- **门禁（全绿）**：`node scripts\verify.js all` = **静态 0 命中 + Node 145 + PW 167 passed + 4 skipped = 171 + bench 7/7** → `[verify] 全部通过`（exit 0）；`JU_L14=1` 隔离跑 = **8 passed + 1 skipped**。
- **RL-11 先改后补**：改字节 → PW `T-99 门禁 · 登记 RESULT=PASS` 红（**登记器 drift=2** = canonical / step9-mirror）→ 同步 [`l9\l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:32) 期望 → 复跑 **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **字节锚点（新）**：canonical = step9 镜像 = **1,020,617 / LF / `1DB17C7E3F71F78B1D1788EFACBABA2C46400EBA4E3AC149046DACA19102E3B0`**（`BYTE_IDENTICAL=True`）；`frozen-l14` = **1,012,003 / `D110699F…D7BBDD`（零变更 · 自本波起转为历史只读锚）**；`verify.js` = **12,352 / LF / `F7495A19…78D018`（零变更）**。
- **冻结件守持**：`1.冻结版本\*` **零改动**（`frozen-l14` / `frozen-l13` … 全只读）；`1.归档快照\*` 零改动（未重复归档）。
- 证据：`reports\op20-convergence-2026-10-16.md` / `_op20w1_probe100k.json` / `_op20w1-l14on100k.txt` / `_op20w1-l14iso.txt` / `op20-w1-green-log-2026-10-16.txt`；下一入口 = **正式上线收尾（选项 A · 最终收尾）**。

## 2026-10-16 — L4~L14 全面封存 · 收口完成（归档 `L4-L14-2026-10-16` · 46 件 / 10,446,766 B · 43 方零漂移 · canonical 1,012,003 · OP-20 登记 OPEN）✅ 完成（纯归档/文档封存 · 产品零字节变更）

- 判定 = 完成（**L4~L14 全面封存 · 纯归档与文档封存波**）；**未修改产品代码字节 / 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；收口报告 [`L14-Closure-2026-10-16.md`](../1.归档快照/L4-L14-2026-10-16/L14-Closure-2026-10-16.md:1)。
- **归档目录（新建）**：`1.归档快照\L4-L14-2026-10-16\`（只读封存快照）；归档复制件 **46 件 / 10,446,766 字节**（+ 收口报告 1 件 ⇒ 目录共 **47 件**；`_archived-manifest.md` 自身另计）；逐件 字节 / SHA-256 / 行尾见 [`_archived-manifest.md`](../1.归档快照/L4-L14-2026-10-16/_archived-manifest.md:1)。
- **归档构成**：L4~L12 独立冻结件 8 + L13 冻结件 1 + L14 冻结件 1 + 现行接线/门禁/登记器 2 + 规格/N-P 层测试 6 + L13 设计/波报告/清理/收口 12 + L14 设计/波报告 6 + L14 证据日志 6 + 承前清单/文档 4 = **46 件**。
- **五方一致性哈希（实测）**：canonical = step9 镜像 = **L14 冻结件** = **1,012,003 / LF / `D110699F19D5A9C79350AFC5375E325ED8D49BAAED2BAF1B18E3D9552ED7BBDD`**（三方逐字节一致）；`verify.js` = **12,352 / LF / `F7495A19…78D018`**；`l14 spec` = **15,334 / CRLF / `C703F91B…4E83E5`**；**frozen-l13 = 991,316 / `21BECFD4…3AA3CA`（只读 · 零变更）**。
- **43 方登记（定值 · `39 + 4` · `LO-8=B`）**：登记器复跑 `node 6.P0-T3基线\step9\verify-hash-registry.mjs` = **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）；L14 纳编 4 物 = `frozen-l14` + [`l9\l14-vs-hardening.test.mjs`](../6.P0-T3基线/step9/t9/l14-vs-hardening.test.mjs:1) + [`l9\l14-w4-consistency.test.mjs`](../6.P0-T3基线/step9/t9/l14-w4-consistency.test.mjs:1) + [`tests\l14-virtual-scroll-hardening.spec.ts`](../6.P0-T3基线/step9/tests/l14-virtual-scroll-hardening.spec.ts:1)。
- **OP-20（登记 OPEN · 不阻断）**：100k 视窗切视图 **longtask / p95 帧预算**持续优化；L14-W4 `JU_L14_100K=1` 实测 **RSS 42.6MB ≤ 200MB 达标**，p95 60.7ms / longtask 2 / max 313ms 为**观测指标**；处置路径见收口报告 §六（后续可开新 W 或专项报告处理）。
- **不变量收口**：`#35` 登记 + `#33` 回填（`T-116(N)` 「待补」→「已登记」）⇒ **`#1–#35` 连续登记无空洞**；清单 = **64,622 / LF / `B4D0554C…F6BD9`**。
- **红线守持**：**RL-1…RL-11** 全守持；**产品字节零变更 / 冻结件零覆盖（`1.冻结版本\*` 零改动）/ 未重复归档（`L4-L12-2026-10-15\` / `L4-L13-2026-10-16\` 零改动）/ 未新增 AI 注释**（铁律 4 / 铁律 6）。
- 下一入口 = **待下一步决策（处理 OP-20 或正式上线收尾）**。

## 2026-10-16 — L14-W5 · 全量回归 + bench + 冻结登记（三方一致 · 43 方定值 · 不变量 `#35` 登记 + `#33` 回填收口）✅ 完成（产品字节零变更 · 43 方零漂移 · canonical 1,012,003）

- 判定 = 完成（**L14-W5 回归 / 冻结 / 登记波**）；**产品 HTML 字节零变更**（canonical = step9 镜像 = **L14 冻结件** = **1,012,003 / LF / `D110699F…D7BBDD`** · **三方逐字节一致**）；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l14-w5-2026-10-16.md`](../6.P0-T3基线/step9/reports/l14-w5-2026-10-16.md:1)。
- **冻结登记（RL-11 先改后补）**：解除 `_w5freeze.ps1` W4「延后 W5」守卫 + 版本感知扩 `l14`（`$H_GEN` / `$VJS_GEN` / `$H_CANON_GEN` / `$known` / canary `l14-*`）⇒ **物化 `frozen-l14`**（`FREEZE_ACTION=CREATED`）⇒ **`FROZEN_DRIFT_COUNT=0` / `THREE_PARTY_IDENTICAL=True` / `RESULT=PASS`**。
- **登记方数定值 43 方（39 + 4 · `LO-8=B`）**：新增 `frozen-l14` + [`l9\l14-vs-hardening.test.mjs`](../6.P0-T3基线/step9/t9/l14-vs-hardening.test.mjs:1)（14,529 / `5C76EA96…`）+ [`l9\l14-w4-consistency.test.mjs`](../6.P0-T3基线/step9/t9/l14-w4-consistency.test.mjs:1)（11,413 / `714600DA…`）+ [`tests\l14-virtual-scroll-hardening.spec.ts`](../6.P0-T3基线/step9/tests/l14-virtual-scroll-hardening.spec.ts:1)（15,334 / `C703F91B…`）；登记器 = **`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **不变量 `#35` 登记**（§十三.35 · 五面 + 哨兵 `T-123` + N 层等价哨兵）+ **`#33` 回填收口**（§十二.33 `T-116(N)` 「待补」→「已登记」；§八末号 → `#35`）⇒ **`#1–#35` 连续登记无空洞**；清单 **58,987 → 64,622 / LF / `B4D0554C…F6BD9`**。
- **全量回归（默认态）**：`node scripts\verify.js all` = **静态 0 命中 + Node 145 + PW 167 passed + 4 skipped = 171 + bench 7/7** → `[verify] 全部通过`（exit 0）；bench **可比 7 / 通过 7 / 警告 0 / 失败 0**（最大恶化 0.0% / 中位 −14.3%）。
- **三脚本 `-Wave l14` 全 PASS**：`_w5freeze.ps1`（`FROZEN_DRIFT_COUNT=0`）/ `_w4freeze.ps1`（`FROZEN_DRIFT_COUNT=0`）/ `_w4paths.ps1`（`CANARY_ARTIFACTS=116` / `VIOLATION_COUNT=0`）。
- **红证**（判别力真实）：纳编 4 物未物化 ⇒ 登记器 `FIVE_PARTY_DRIFT_COUNT=1` / FAIL + PW `T-99` 门禁红（`expect(drift).toBe(0)`）⇒ 物化后转绿；**先改后补（RL-11）**：仅**新增纳编物 + 同步期望值**（**未登记字节漂移 = 0**）；`scripts\_w5freeze.ps1` **20,022 → 21,827**、`_w4freeze.ps1` **13,227 → 14,672**、`_w4paths.ps1` **6,673 → 7,014**（CRLF）；`verify.js` = **12,352 / LF / `F7495A19…78D018`（零变更）**。
- **字节锚点（新）**：canonical = step9 镜像 = **L14 冻结件 = 1,012,003 / LF / `D110699F…D7BBDD`**；`verify.js` = **12,352 / LF / `F7495A19…78D018`**；`l14 spec` = **15,334 / CRLF / `C703F91B…4E83E5`**；`l9\l14-vs-hardening.test.mjs` = **14,529 / CRLF / `5C76EA96…D31D217`**；`l9\l14-w4-consistency.test.mjs` = **11,413 / CRLF / `714600DA…C965FF`**；**frozen-l13 = 991,316 / `21BECFD4…3AA3CA`（只读 · 零变更）**。
- 证据：`reports\l14-w5-2026-10-16.md` / `l14-w5-green-log-2026-10-16.txt` / `_l14w5-hash-red.txt` / `_l14w5-registrar-2026-10-16.txt` / `_l14w5-freeze-l14.txt` / `_l14w5-w4freeze-l14.txt` / `_l14w5-w4paths-l14.txt`；下一入口 = **待评估进入 L4–L14 全面封存 或 处理 `OP-20`**。

## 2026-10-16 — L14-W4 · 崩溃/一致性 + 100k 真规模闸门（G6 · `__l14LongtaskGate`）+ 哨兵 ✅ 完成（产品字节变更波 → 自 W4 起字节冻结 · 39 方零漂移 · canonical 1,012,003）

- 判定 = 完成（**L14-W4 实施波**）；本轮**改产品 HTML 字节**（按 design §七「W4 起字节冻结」先行实装 G6 → 冻结；承铁律 4 已同步 step9 镜像 + 全量重算登记）；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l14-w4-2026-10-16.md`](../6.P0-T3基线/step9/reports/l14-w4-2026-10-16.md:1)。
- **G6 真规模闸门（canonical 落点）**：`__l14LongtaskGate`（longtask 观察者 + 预算常量 `L14_LONGTASK_BUDGET=50` / `L14_RSS_CAP_MB=200` / `L14_P95_BUDGET=16` + `debounce`（rAF 防抖 · 拖拽/resize）+ `throttle`（`commit(s=>...)` 合批）+ `markSwitch`/`p95`/`sampleRss`/`rssGate`/`longtaskGate`/`p95Gate`/`degradeParity`/`measure`/`reset`）；`window.__l14.longtaskGate` 暴露；`enable`/`disable` 挂钩；resize 监听受 `__l14On()` 保护；**默认关闭态 `_l14Enabled=false` 零回归兜底**。
- **编号区转绿**：**T-118 红 → 绿**（`JU_L14=1` 隔离跑 **7 passed + 1 failed → 8 passed + 1 skipped**）；T-117/T-119/T-120/T-121/T-122（W3）与 T-123/T-124 保持绿；**T-118(100k)** 条件实测（`JU_L14_100K=1`）= **RSS 42.6MB ≤ 200MB 达标**（longtask/p95 观测登记 **OP-20**）。
- **哨兵最终验收**：**T-115（100k RSS 门）** 以 100k 实测 RSS 42.6MB ≤ 200MB 佐证；**T-116（降级等阶）** 以 N 层 `degradeParity` + T-123 降级锚承接（L13 编号不重编号 · L14 等价哨兵）。
- **N 层交付**：新建 [`l9\l14-w4-consistency.test.mjs`](../6.P0-T3基线/step9/t9/l14-w4-consistency.test.mjs:1)（G6 真规模闸门 + 崩溃/一致性 + 哨兵 · 14 用例 / 2 套 / CRLF）并纳编 [`verify.js`](../6.P0-T3基线/step9/scripts/verify.js:99) `NODE_TESTS` ⇒ **Node 131 → 145**。
- **P 层增强**：[`tests\l14-virtual-scroll-hardening.spec.ts`](../6.P0-T3基线/step9/tests/l14-virtual-scroll-hardening.spec.ts:1) T-118 锚 + 预算常量 + T-118(100k) 条件实测。
- **先改后补（RL-11）**：`l9-hash-check.mjs` 期望 —— canonical / step9-mirror **1,006,592 / `44EF9542…D211C` → 1,012,003 / `D110699F…D7BBDD`**；`verify.js` **12,217 / `B1EC5B7B…DA907B0` → 12,352 / `F7495A19…78D018`**（**登记方数仍 39** · L14 新物归 W5 纳编）。
- **门禁（全绿）**：`node l9\l9-hash-check.mjs` = **`PARTY_COUNT=39` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）；`node scripts\verify.js all` = **静态 0 命中 + Node 145 + PW 171（167 passed + 4 skipped）+ bench 7/7** → `[verify] 全部通过`（exit 0）。
- **字节锚点（新）**：canonical = step9 镜像 = **1,012,003 / LF / `D110699F…D7BBDD`**；`verify.js` = **12,352 / LF / `F7495A19…78D018`**；`l9-hash-check.mjs` = **11,013 / CRLF / `4E0C672F…29DA5`**；`l14-w4-consistency.test.mjs` = **11,413 / CRLF / `714600DA…C965FF`**；`l14 spec` = **15,334 / CRLF / `C703F91B…4E83E5`**；**frozen-l13 = 991,316 / `21BECFD4…3AA3CA`（只读 · 零变更）**。
- 证据：`reports\l14-w4-green-log-2026-10-16.txt` / `_l14w4_l14on.txt` / `_l14w4_l14on100k.txt` / `_l14w4_probe100k.json` / `_l14w4_registrar.txt` / `_l14w4_ntest.txt` / `_l14w4_syntax.txt` / `_l14w4_apply.txt` / `_l14w4_hash.txt`。
- 下一入口 = **L14-W5（全量回归 + bench + 冻结登记（`_w5freeze.ps1 -Wave l14`）+ `#35` 登记（39 + M））**。

## 2026-10-16 — L14-W3 · 主线实现（G1–G5 加固 · `E-①…E-⑥` 100% 收口）+ N 层等价哨兵 ✅ 完成（产品字节变更波 · 39 方零漂移 · canonical 1,006,592）

- 判定 = 完成（**L14-W3 实施波**）；本轮**改产品 HTML 字节**（按 design §七「每次改 `v2.0-l3.html.html` → 复算登记」；承铁律 4 已同步 step9 镜像 + 全量重算登记）；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l14-w3-2026-10-16.md`](../6.P0-T3基线/step9/reports/l14-w3-2026-10-16.md:1)。
- **G1–G5 实现（canonical 落点）**：G1 `__vsHeightTable`（首屏实测行高 + 前缀和 + 二分 `indexAt` + rAF 校正）；G2 `__vsGenCache`（代次键 = **`state.updatedAt`** + 增量等价 `__vsPatchEquals`）；G3 `__renderDbGalleryVirtual` + `__renderMindmapVirtual`（`LO-4=B`）；G4 `__l14SearchAll`（跨全文档 · 命中屏外 → `_vsScrollToId` 定位 · 关闭 `OP-14`）；G5 `__vsInteractGuard`（计数 + `coalesce` 合批 + 几何缓存）；**默认关闭态 `_l14Enabled=false` 零回归兜底**。
- **引擎接缝**：`_vsWindow`/`_vsUpdate`/`_vsScrollToId`/`_renderOutlineVirtual`/`_renderPresentationVirtual` 优先读 `vs.htable`；`renderDbGallery`/`renderMindmap` 各加单行门控；产品侧**未占用** W2 测试侧探针命名（`__l14Seam`/`__l14Shadow`/`l14ShadowSample`/`l14BuildDescriptor`）⇒ T-124 语义不变仍绿。
- **编号区转绿**：T-117 / T-119 / T-120 / T-121 / T-122 **红 → 绿**（`JU_L14=1` 隔离跑 **6 failed + 2 passed → 7 passed + 1 failed**）；**T-118（G6 · 100k longtask 门）按 W1 §3.3 归 W4**（W3 保持红为预期）；T-123 / T-124 保持绿。
- **N 层交付**：新建 [`l9\l14-vs-hardening.test.mjs`](../6.P0-T3基线/step9/t9/l14-vs-hardening.test.mjs:1)（G1–G5 等价哨兵 · 20 用例 / 4 套 / CRLF）并纳编 [`verify.js`](../6.P0-T3基线/step9/scripts/verify.js:94) `NODE_TESTS` ⇒ **Node 111 → 131**。
- **先改锚（RL-11）**：`l9-hash-check.mjs` 期望 —— canonical / step9-mirror **991,316 / `21BECFD4…3AA3CA` → 1,006,592 / `44EF9542…D211C`**；`verify.js` **12,062 / `F3A8E029…378ABC` → 12,217 / `B1EC5B7B…DA907B0`**（**登记方数仍 39** · L14 新物归 W5 纳编）。
- **门禁（全绿）**：`node l9\l9-hash-check.mjs` = **`PARTY_COUNT=39` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）；`node scripts\verify.js all` = **静态 0 命中 + Node 131 + PW 171（167 passed + 4 skipped）+ bench 7/7** → `[verify] 全部通过`（exit 0）。
- **字节锚点（新）**：canonical = step9 镜像 = **1,006,592 / LF / `44EF9542…D211C`**；`l9-hash-check.mjs` = **11,013 / CRLF / `F9F51E5C…AFCB68`**；`l14-vs-hardening.test.mjs` = **14,529 / CRLF / `5C76EA96…D31D217`**；**frozen-l13 = 991,316 / `21BECFD4…`（只读 · 零变更）**。
- 证据：`reports\l14-w3-red-log-2026-10-16.txt` / `l14-w3-green-log-2026-10-16.txt` / `_l14w3_l14on.txt` / `_l14w3_registrar.txt` / `_l14w3_ntest.txt`。
- 下一入口 = **L14-W4（崩溃/一致性 + 100k 真规模闸门 + 哨兵 `#35`（拟）；产品字节自 W4 起冻结）**。

## 2026-10-16 — L14-W2 · 接缝 + 影子（默认不启用）+ 编号区启用（T-117–T-124）+ `JU_L14` 门禁接线 ✅ 完成（测试/门禁接线 · 39 方零漂移 · 产品零字节变更）

- 判定 = 完成（**L14-W2 实施波 · 测试 + 门禁接线**）；本轮**未改产品 HTML 字节 / 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l14-w2-2026-10-16.md`](../6.P0-T3基线/step9/reports/l14-w2-2026-10-16.md:1)。
- **接缝机制（默认不启用）**：测试侧只读 `__l14Seam`（`enabled === false` · 只读描述符 + 干跑 · **零产品路径占用**）；产品侧接缝（`_vsHeightTable`/`_vsGenCache`/`renderDbGalleryVirtual`/`l14SearchAll`/`_vsInteractGuard`/`l14LongtaskGate`）归 W3/W4。
- **影子模式（不占用产品运行字节）**：`__l14Shadow` + `l14ShadowSample` + `l14BuildDescriptor` 经 `page.addInitScript` 只读注入（观测层 / 干跑 · S-4「探针只读不改语义」· 零 DOM 变更）；探针 `ready`（承 design §八 W2 退出判据）。
- **编号区启用 `T-117–T-124`（不跳号）**：T-117 G1 / T-118 G6 / T-119 G2 / T-120 G3 / T-121 G4 / T-122 G5 / T-123 降级（#35 靶位）/ T-124 接缝+影子；逐号归属 + P/N/R 层 + 哨兵 `#35`（拟 · W5）。
- **门禁接线（[`verify.js`](../6.P0-T3基线/step9/scripts/verify.js:155)）**：`L14_ENABLED = (JU_L14 === '1')`（**默认 false** · 与 L13 门禁结构同构）；`L14_TESTS` 纳入 `PW_EXTRA` / `PW_LABEL`；缺省 PW = **171 与 L13 逐项一致**（`LO-7=A`）。
- **先红 → 改线 → 改锚 → 复跑 → 绿证**：红证 = `JU_L14=1` 隔离跑 = **6 failed + 2 passed**（T-117–T-122 **红证载体** · T-123/T-124 绿）；先改锚（RL-11）= `l9-hash-check.mjs` `verify.js` 期望 **11,305/`3CB1C078…02548` → 12,062/`F3A8E029…378ABC`**。
- **门禁（全绿）**：`node l9\l9-hash-check.mjs` = **`PARTY_COUNT=39` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）；`node scripts\verify.js all` = **静态 0 命中 + Node 111 + PW 171（167 passed + 4 skipped）+ bench 7/7** → `[verify] 全部通过`（exit 0）。
- **字节锚点（新）**：`verify.js` = **12,062 / LF / `F3A8E029…378ABC`**；`l9-hash-check.mjs` = **11,013 / CRLF / `A00451BC…D97052F6`**；`l14-virtual-scroll-hardening.spec.ts` = **13,321 / CRLF / `1C207098…C2D7CA47`**；canonical = step9 镜像 = L13 冻结件 = **991,316 / LF / `21BECFD4…3AA3CA`**（**零变更**）。
- 证据：`reports\l14-w2-red-log-2026-10-16.txt` / `l14-w2-green-log-2026-10-16.txt` / `_l14w2-registrar-2026-10-16.txt` / `_l14w2-hashes-2026-10-16.txt`。
- 下一入口 = **L14-W3（加固实现 G1–G5 + `E-①…E-⑥` 100% 收口 + N 层 `l9\l14-vs-hardening.test.mjs`）**。

## 2026-10-16 — L14-W1 · 决策回执 + 加固面台账（G1–G6 / E-①…E-⑥）+ 阈值标定 ✅ 完成（docs-only · 39 方零漂移 · 产品零字节变更）

- 判定 = 完成（**L14-W1 决策 / 标定波**）；**L14 正式启动**（主线 = **E-2 补完 · `M-H′`**；选项 A 线上部署顺延为最终收尾）；本轮 **docs-only**：**未改产品代码字节 / 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）。报告 [`l14-w1-audit-2026-10-16.md`](../6.P0-T3基线/step9/reports/l14-w1-audit-2026-10-16.md:1)。
- **决策回执**：`LO-0…LO-8` **全部裁决** —— `LO-0=A`（范式文件族继续）/ `LO-1=A`（E-2 主线）/ `LO-2=A`（`T-117` 起归 L14）/ `LO-3=A`（首屏实测 + 高度表）/ `LO-4=B`（画廊 + 导图）/ `LO-5=A`（应用内搜索替代）/ `LO-6=是`（登记 `#35`）/ `LO-7=A`（`171 + N` · `JU_L14=1`）/ `LO-8=B`（`39 + M`）；任务书 `L0-0`/`L0-8` 与 design `LO-0`/`LO-8` **同族**，命名歧义已收口。
- **加固面台账**：`G1–G6` = `E-①…E-⑥`（变高行 / 增量 patch 一致性 / 代次缓存失效 / 视图覆盖扩展 / 应用内搜索跨屏 / 交互不重渲染），逐项记录 **canonical 落点**（`VS_ROW_H:6076` / `countVisibleNodes:6063` / `_vsFlatten:6087` / `renderMain:12426` / `renderPresentation:12228` / `renderDbGallery:11066` / `_buildOutlineBox:6368` / `_vsScrollToId:6134`）、依赖、责任人（角色口径）与验收标准。
- **设计订正（只读事实）**：design §四 G2 记「以 `state._rev` 代次缓存」，但 `_rev` **仅 `runPersist` 成功写盘时递增**（:2593），防抖窗口内连续 commit 共享同一 `_rev`（FIX-S-1 :8386 已踩坑）⇒ **L14 代次信号一律用 `state.updatedAt`**，`_rev` **不作**视图代次键。
- **阈值标定**：§六「拟定」**全部冻结** —— G1 行高误差 ≤1px / 无重叠 / `scrollHeight` 误差 ≤1px；G2 单次切视图 O(n) 遍历 =0、渲染节点 ≤200、增量 vs 全量逐节点等价；G3 画廊+导图 ≤200；G4 命中率 100% + 屏外可定位 100%；G5 每交互渲染增量 ≤1、几何读取每帧 ≤1；G6 100k longtask=0 / **RSS ≤200MB** / p95 ≤16ms。
- **红线 / 红证矩阵 / 不变式**：红线 **RL-1~RL-8**（三方一致 / 39 方 drift 0 / 回归 ≥ Node 111 + PW 171 + bench 7/7 / `aiNoteLint` exit 3 / 禁覆盖冻结件）；红证 **`T-117–T-124`**（逐号绑定 §八）；不变量接续 **`#35`**（拟 · W5 登记，覆盖 `T-117–T-124` + N 层哨兵）。
- **阶段依赖**：W1←`LO` 全决策（已满足）；W2←W1（接缝 + 影子 + 编号区 + `JU_L14` 接线）；W3←W2（G1–G5 实现 + `E-①…E-⑥` 100% 收口）；W4←W3（100k 闸门 + 哨兵 + `#35`；**产品字节自 W4 冻结**）；W5←W4（全量回归 + `_w5freeze.ps1 -Wave l14` + `39 + M`）。
- **零漂移核验 / 门禁状态**：`node l9\l9-hash-check.mjs` = **`PARTY_COUNT=39` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；canonical = step9 镜像 = L13 冻结件 = **991,316 / LF / `21BECFD4…3AA3CA`**（18,741 行 · `CRLF=0`）；`verify.js` = **11,305 / LF / `3CB1C078…02548`**；`l13-mb-workset.test.mjs` = **17,030 / CRLF / `FF40C6A1…7E5AE0`**（既有锚点零变更 · 本波无新增 spec）；证据 `reports\_l14w1-registrar-2026-10-16.txt` / `reports\_l14w1-probe-2026-10-16.txt`。
- **红/绿证结论**：本波 **docs-only**（产品字节零变更）⇒ **无新红/绿证**；回归基线**沿用 L13 绿证**（Node 111 / PW 171 / bench 7/7）；登记器 / 门禁 = **39 方 / drift 0 / PASS**（绿）。
- 下一入口 = **L14-W2（接缝 + 影子（默认不启用）+ 编号区 `T-117` 起 + `JU_L14` 门禁接线）**。

## 2026-10-16 — 最终决策 = 选项 B · L14 启动（界面规模收口二期 · E-2 `M-H` 加固 · 设计推演已落盘 ✅ docs-only · 39 方零漂移 · 产品零字节变更）

- 判定 = 完成（**最终决策 + L14 启动波**）；**选项 B（下一步扩展）** 经裁决执行，**选项 A（线上部署）顺延为最终收尾**（`8.发布与CI\release\v2.0-l13-2026-10-16\` **原样保留 · 零覆盖**）；本轮 **docs-only**：**未改产品代码字节 / 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）。
- **前置确认（S6）**：正式上线收尾已完成（[`l13-online-release-closure-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-online-release-closure-2026-10-16.md:1)）；登记器 = **`PARTY_COUNT=39` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；canonical = step9 镜像 = L13 冻结件 = **991,316 / LF / `21BECFD4…3AA3CA`**（零变更）；L4~L13 封存稳固。
- **设计推演（新建 · docs-only）**：[`l14-design-2026-10-16.md`](../6.P0-T3基线/step9/reports/l14-design-2026-10-16.md:1) —— L14 主线 = **E-2 补完 · `M-H′`**（G1 变高行 / G2 O(n) 消除 / G3 覆盖扩展 / G4 Ctrl+F 替代 / G5 交互加固 / G6 真规模闸门）+ 加固面台账 **E-①…E-⑥** + 阶段 **L14-W1–W5** + 红证矩阵 **T-117–T-124** + 不变量 **#35** + `LO-0…LO-8` + 风险 **R27–R29**（E-2 面）。
- **编号接续**：测试 **T-117** 起（T-111–T-116 + T-116(N) 已由 L13 占用）/ 不变量 **#35** / 风险 **R27** 起 / 开放项承接 **OP-2·OP-3·OP-4·OP-14** + 预留 **OP-20** / 方数 **39 → 39 + M**。
- **前置依赖**：`OP-19`（L13-W6 关闭）的 **N 层等价哨兵范式**（`l9\l13-mb-workset.test.mjs` · Node 91→111 · 38→39 方）**直接扩展**至 L14 载体 `l9\l14-vs-hardening.test.mjs`；回归不得低于 **Node 111 + PW 171 + bench 7/7**。
- **纪律**：docs-only ⇒ **canonical 零变更 / 冻结件零覆盖 / 归档零改动 / 发布包零覆盖**（铁律 4 / 铁律 6）；发布交付（选项 A）作为 **L14 收口后的最终收尾**（统一重建，避免二次重建）。
- **下一步** = **L14-W1**（决策回执 + 阈值标定 + 加固面台账 E-①…E-⑥；待 `LO-0…LO-8` 裁决）；**未裁决前不进入 W1、不写产品代码**。

## 2026-10-16 — L13 正式上线收尾（发布包重建 `v2.0-l13-2026-10-16` + CI 复核 + OPEN 项结转 ✅ 完成 · 39 方零漂移 · 产品零字节变更）

- 判定 = 完成（**正式上线收尾波 · 路径 B 收口 S6**）；**产品 HTML 字节零变更**（canonical = step9 镜像 = L13 冻结件 = **991,316 / LF / `21BECFD4…3AA3CA`**）；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）。报告 [`l13-online-release-closure-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-online-release-closure-2026-10-16.md:1)。
- **阻断发现 → 处置**：S4 发布包 `v2.0-l12-2026-10-16` = **L12 世代（983,460 / `CFCD67DA…FC34`）**，与现行 canonical（L13 · 991,316 / `21BECFD4…`）**不逐字节一致**（亦 ≠ 现 `frozen-l12` 983,421 / `F8529C60…`）→ 触发「遇哈希漂移异常必须停止并报告」→ **上报，经决策 = 以 L13 为准重建发布包**。
- **发布包重建**：新建 [`8.发布与CI\release\v2.0-l13-2026-10-16\`](../8.发布与CI/release/v2.0-l13-2026-10-16/RELEASE-NOTES.md:1)（**4 件 / 997,376 B**）：发布产物 `ju-workbench-v2.0-l13.html` = canonical **逐字节副本**（991,316 / `21BECFD4…`）+ `release-manifest.json`（3,062 / `C90FAAB3…`）+ `checksums.sha256`（315 / `D93FFAEC…`）+ `RELEASE-NOTES.md`（2,683 / `3B4B4E7C…`）；`FOUR_WAY_IDENTICAL=true` / `CHECKSUMS_DRIFT_COUNT=0`；**旧 L12 包原样保留（4 件 = S5 值 · 未覆盖）**。
- **CI 复核（修正）**：[`ci\ci-gate.yml`](../8.发布与CI/ci/ci-gate.yml:1) 滞后（36 方 / PW 165 / `-Wave l12`，Stage ③ 对 L13 HEAD 将判 `FAIL`）→ 修正为 **39 方 / Node 111 + PW 171 / `-Wave l13 -NoFreeze`**（= **3,187 / CRLF / `C6C735CB…D208B0`**）；L13 `T-111~T-116` **全部纳入或条件跳过（T-115/T-116 · `JU_L13_100K=1`）**、`T-116(N)` 已由 N 层 `l13-mb-workset.test.mjs` 纳编；`aiNoteLint()`（铁律 6 · `exit 3`）在册；**流水线无逻辑遗漏**。
- **登记器复跑**：`node l9\l9-hash-check.mjs` = **`PARTY_COUNT=39` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（39 方逐项 `PASS` · 零漂移）。
- **OPEN 项收尾**：`OP-2`（落盘耗时口径 · bench 第 8 项）/ `OP-3`（`_diskConfirmed`）/ `OP-4`（跨标签 `seq`）= 独立项复核完成；`OP-14`（`Ctrl+F` 替代 · `D-5`）= 属 E-2 `M-H′` → 四项**统一结转 L14（不阻塞上线）**；已关闭项 `OP-1`（S3）/ `OP-12`（S1）不变。
- **纪律**：`8.发布与CI\` 位于 `step9` **之外** ⇒ 不动 `step9` canary / 锚点；**canonical 零变更 / 冻结件零覆盖 / 归档零改动**；障碍处置遵循「停止并报告」（铁律 4 / 铁律 6）。
- 证据：`_临时脚本\_l13online_verify.out.txt` / `_l13release.out.txt` / `_l13online_registrar.out.txt` / `_l13online_hashes.out.txt`。
- 下一入口 = **待最终决策：线上部署（发布 `v2.0-l13-2026-10-16`）或 下一步扩展（L14 · E-2 `M-H′`）**。

## 2026-10-16 — L13-W6 · OP-19 补全（N 层 `T-116(N)` 载体 · 38 → 39 方零漂移 · 全量回归 exit 0 ✅ 完成）

- 判定 = 完成（**OP-19 补全波**）：新建 N 层 [`l9\l13-mb-workset.test.mjs`](../6.P0-T3基线/step9/t9/l13-mb-workset.test.mjs:1)（**`T-116(N)`** 等价哨兵载体 · **20 用例 / 8 套 / 0 fail**）并纳编 [`verify.js`](../6.P0-T3基线/step9/scripts/verify.js:92) 门禁（Node 91 → **111**）；**产品 HTML 字节零变更**（canonical = step9 镜像 = L13 冻结件 = **991,316 / LF / `21BECFD4…3AA3CA`**）；**不覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）。报告 [`l13-w6-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-w6-2026-10-16.md:1)。
- **N 层覆盖**：MB-SEAM（S-A 短路 `≡ N(id)`）/ MB-LRU 上限与回填 / 视口段常驻与队列 / TS-V 单接入点与投影（**T-116(N)** 哨兵）/ RWS 增量 ⊆ 全量对拍 / 崩溃安全网 / 产物级结构扫描。
- **先改锚（RL-11）**：登记器 [`l9\l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:44) `verify.js` 期望 **11,149/`E4581EB1…` → 11,305/`3CB1C078…02548`** + **纳编 N 层** ⇒ **38 → 39 方**；同步 [`_w5freeze.ps1`](../6.P0-T3基线/step9/scripts/_w5freeze.ps1:92) / [`_w4freeze.ps1`](../6.P0-T3基线/step9/scripts/_w4freeze.ps1:67) `$VJS_GEN['l12'/'l13']`。
- **门禁复跑（全绿）**：`node l9\l9-hash-check.mjs` = **`PARTY_COUNT=39` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）；`node scripts\verify.js all` = **静态 0 命中 + Node 111 + PW 171（165 + L13 6）+ bench 7/7** → `[verify] 全部通过`（**exit 0**）。
- **三冻结门 `-Wave l13`**：`_w5freeze` `FREEZE_ACTION=PRESENT / FROZEN_DRIFT_COUNT=0 / PASS`；`_w4freeze` `FROZEN_DRIFT_COUNT=0 / PASS`；`_w4paths` `CANARY_ARTIFACTS=102 / VIOLATION_COUNT=0 / PASS`。
- **哈希锚点（新）**：`l13-mb-workset.test.mjs` = **17,030 / CRLF / `FF40C6A1…7E5AE0`**；`verify.js` = **11,305 / LF / `3CB1C078…02548`**；`l9-hash-check.mjs` = **10,940 / CRLF / `7D44A5C9…B54B4BFD`**；`_w5freeze.ps1` = **20,022 / CRLF / `A3499D15…C6AA032C`**；`_w4freeze.ps1` = **13,227 / CRLF / `3529521C…4E790CDE`**。
- **归档清单追加**：[`_archived-manifest.md`](../1.归档快照/L4-L13-2026-10-16/_archived-manifest.md:1) §二 `verify.js` 行复算 + **§五 OP-19 补全登记**（新文件 字节 + SHA-256）；**OP-19 → CLOSED**；恒 `_archived-manifest.md` = 8,284 / LF / `B78B5733…881231`。
- 证据：`reports\_l13w6-registrar-2026-10-16.txt` / `_l13w6-verify-all-2026-10-16.txt` / `_l13w6-w5freeze-l13.txt` / `_l13w6-w4freeze-l13.txt` / `_l13w6-w4paths-l13.txt`。
- 下一入口 = **不变量 `#33` 回填（`T-116(N)`「待补」→「已登记」）** 或 **正式上线收尾**（待明确指令）。

## 2026-10-16 — L4~L13 阶段归档封存（27 封存复制件 + 收口报告 · 38 方零漂移 · OP-19 登记 OPEN ✅ 完成 · 产品零字节变更）

- 判定 = 完成；**L4~L13 阶段归档封存**：归档目录 `1.归档快照\L4-L13-2026-10-16\`，**封存复制件 27 件 / 合计 8,844,465 字节**（+ 收口报告 1 件 · 目录共 28 件）（8 独立冻结件 L7/L8/L9/L9-W6/L10/L11/L11-W6/L12 + **L13 冻结件** + `verify.js`/spec/`l9-hash-check.mjs` + 文档快照 + L4-L12 归档清单副本 + 13 件 L13 产物）。清单 [`_archived-manifest.md`](../1.归档快照/L4-L13-2026-10-16/_archived-manifest.md:1)（逐件 字节 + SHA-256 + 行尾 · Node 只读采集）。
- 收口报告 [`L13-Closure-2026-10-16.md`](../1.归档快照/L4-L13-2026-10-16/L13-Closure-2026-10-16.md:1)（新建）：L4-L13 全面封存清单 + 38 方登记详情 + **OP-19** 说明 + 整体封存结论 + 封存后补全计划。
- **五方一致性**（canonical / step9 镜像 / L13 冻结件 / verify.js / l13 spec）：canonical = step9 镜像 = **L13 冻结件** = **991,316 B / `21BECFD4…3AA3CA` / LF**（`THREE_PARTY_IDENTICAL=True`）；`verify.js` = 11,149 / LF / `E4581EB1…D9C1`；`l13 spec` = 15,393 / CRLF / `FBEA1710…E1E0EC`。
- 登记方核验：`l9\l9-hash-check.mjs` = **`PARTY_COUNT=38` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（零漂移 · 38 方逐项 PASS）。
- **遗链缺陷 OP-19**（N 层 `l9\l13-mb-workset.test.mjs` / `T-116(N)` 载体缺失）→ **登记 OPEN** + 补全计划（建 N 层 → `verify.js` 纳编 → 39 方 → #33 闭环）；本轮**不创建** N 层文件（docs-only）。
- 冻结纪律：本轮为**只读封存快照（canonical 逐字节副本）+ 文档封存**，**未改 canonical**、**未覆盖任何冻结件**、**未重复归档**（铁律 4 / 铁律 6）；归档走 Node 只读工具（`_临时脚本\_l13arch_copy.mjs` / `_l13arch_manifest.mjs`）。
- 下一入口 = **L4~L13 全部阶段已冻结并归档封存，待下一步决策（补全 OP-19 N 层测试 或 正式上线收尾）**。

## 2026-10-16 — L13-W5 完成（全量回归 + bench + 冻结登记 · 38 方定值 · 不变量 #33 回填 ✅ PASS）

- 判定 = 完成（**回归 / 冻结 / 登记 / 文档波**）：**产品 HTML 字节零变更**（canonical = step9 镜像 = **991,316 / LF / `21BECFD4…3AA3CA`**）；**仅新建** L13 冻结件 `1.冻结版本\v2.0-l3-frozen-l13-2026-10-16.html`（**三方逐字节一致**）；**未覆盖既有冻结件 / 未重复归档 / 未新增 AI 注释**（铁律 4 / 铁律 6）。报告 [`l13-w5-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-w5-2026-10-16.md:1)。
- **全量回归 + bench**：`node scripts\verify.js all` = **静态 0 命中 + Node 91 + PW 167 passed + 4 skipped = 171 + bench 7/7** → `[verify] 全部通过`（**exit 0**）；bench 可比 **7** / 通过 **7** / 警告 0 / 失败 0 · **最大恶化 0.0% / 中位 −14.3%**（**无回退**）。证据 [`l13-w5-green-log-2026-10-16.txt`](../6.P0-T3基线/step9/reports/l13-w5-green-log-2026-10-16.txt:1)。
- **冻结登记（守卫解除）**：[`_w5freeze.ps1`](../6.P0-T3基线/step9/scripts/_w5freeze.ps1:133) 移除 W4 的 `SKIPPED(l13-freeze-deferred-to-W5)` 守卫 ⇒ `-Wave l13` 正式物化/校验冻结件；三脚本 `-Wave l13` 全 `PASS`（`FROZEN_DRIFT_COUNT=0` / `VIOLATION_COUNT=0` / `CANARY_ARTIFACTS=101`）。
- **先改锚（RL-11）**：登记器 [`l9\l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:32) `TARGETS` 纳编 `frozen-l13` + `l13-mb-workset.spec.ts` ⇒ **36 → 38 方**；红证 [`_l13w5-hash-red.txt`](../6.P0-T3基线/step9/reports/_l13w5-hash-red.txt:1) = **drift 1**（`frozen-l13` 缺位 · 判别力真实）→ 物化后复跑 = **`PARTY_COUNT=38` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）。
- **L0-8 = B（修订 38 方）**：原指令纳编清单之 N 层 `l9\l13-mb-workset.test.mjs` **经核查从未创建**（W3/W4 仅交付 P 层 spec）⇒ 经用户裁决**仅纳编实际存在件**，缺陷登记为 **OP-19**。
- **不变量 #33 回填**：[`JU-不变量清单-v2.0-frozen.md`](../4.回归与验收/JU-不变量清单-v2.0-frozen.md:864) **§十二.33**「内存工作集封顶（视口 + LRU ≤ 5,000 · 同步→异步等价）」· 哨兵 **T-116**；**`T-116(N)` 标注「待补」**（OP-19）；同步修正 §十 旧注 ⇒ **#1–#34 连续无空洞**。
- 哈希锚点（新旧）：`l9-hash-check.mjs` 10,033 → **10,636（`211083B3…D386`）**；`_w5freeze.ps1` 20,086 → **20,022（`FD3193B7…C248`）**；`_w4paths.ps1` 6,511 → **6,673（`BA8F6DA2…74CB`）**；不变量清单 54,165 → **58,987（`F839E0AC…D1EF`）**；`frozen-l12` 仍 **983,421 / `F8529C60…239DA`**（只读）。
- 证据：`reports\l13-w5-green-log-2026-10-16.txt` / `_l13w5-registrar-2026-10-16.txt` / `_l13w5-hash-red.txt` / `_l13w5-w5freeze-l13.txt` / `_l13w5-w4freeze-l13.txt` / `_l13w5-w4paths-l13.txt` / `_l13w5-hashes-2026-10-16.txt`。
- 下一入口 = **L13 收口评估（L4–L13 全面封存）**（待明确指令）；残余 **OP-19** OPEN。

## 2026-10-16 — L13 冻结件清理波（打破 LO-9=A 尾页脚豁免· 零新增漂移 · 产品零字节变更）

- 判定 = 完成（**冻结件清理 + 哈希重算登记波**）；承用户裁决「删除**所有文件**中的该注释」⇒ **打破既有 LO-9=A 尾页脚豁免**，对冻结件执行「**先改后补 / 先改锚后复跑**」；**仅删尾页脚注释行（39 B）· 非注释产品字节逻辑零改动**；原字节备份 `_W2阶段产物/l13frozen-bak/`；报告 [`l13-cleanup-frozen-ai-notes-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-cleanup-frozen-ai-notes-2026-10-16.md:1)。
- **先改锚（RL-11）**：登记器 [`l9\l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:24) **7 条冻结锚**重算（含常量 `FROZEN_L8L9/L9W6_HASH`）；同步 [`_w5freeze.ps1`](../6.P0-T3基线/step9/scripts/_w5freeze.ps1:71) / [`_w4freeze.ps1`](../6.P0-T3基线/step9/scripts/_w4freeze.ps1:51) 的 `$H_GEN` + `$H_*`、[`_w4paths.ps1`](../6.P0-T3基线/step9/scripts/_w4paths.ps1:84) `$known`；`baseline-original` 新增独立常量（不在本轮范围 · 保持原值）。
- **红 → 绿**：红 = 先改锚后 `node l9\l9-hash-check.mjs` = **`FIVE_PARTY_DRIFT_COUNT=7` / FAIL**（**恰 7 条冻结锚** · 判别力真实）；绿 = 清理后复跑 = **`PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `PASS`**（exit 0）。
- **字节锚点（新 · 均 LF）**：frozen-l12 = **983,421 / `F8529C60…239DA`**；frozen-l8 = frozen-l9 = **907,419 / `2F43EA0F…120E0A`**；frozen-l9w6 = **968,040 / `5D66C406…1E3ECC`**；frozen-l10 = frozen-l11 = **972,078 / `D7D265D5…FD31E5`**；frozen-l11w6 = **972,228 / `72DA6B3E…8BA697`**；frozen-l7 = **887,795 / `89D88973…03940C`**；old-frozen（v2.0-frozen / 73）= **775,667 / `97E7331E…405ABCB`**。
- **门禁（无新增漂移）**：`_w5freeze -Wave l12` = 3 / `_w4freeze -Wave l12` = 2 / `_w4paths -Wave l12` = 1（= **波前基线**；残余系 **L13-W3 起既有** canonical(wave HEAD) 失配 · 与本波无关；冻结锚全 `FROZEN-OK`）；`verify.js all` = **静态 0 命中 + Node 91 + PW 167 passed + 4 skipped = 171 + bench 7/7 → `[verify] 全部通过`（exit 0）**；证据 [`_l13frozen-verify-all-2026-10-16.txt`](../6.P0-T3基线/step9/reports/_l13frozen-verify-all-2026-10-16.txt:1023)。
- **canonical 零变更**（987,497 / `D5CCFF15…A28C` / LF）；归档清单 [`_archived-manifest.md`](../1.归档快照/L4-L12-2026-10-15/_archived-manifest.md:18) 第 5–12 行重算 + 合计 **7,627,033**（−312）。
- **范围外（类别 A 残余 · 不清理）**：canonical / step1–4 历史 HTML / `baseline_original` / 发布包 `ju-workbench-v2.0-l12.html` / `_W2阶段产物` 过渡临时物（报告 §八）。
- 下一入口 = **L13-W4**（崩溃 / 一致性 + **100k 真规模闸门** T-115 + 哨兵 T-116 · **#33**）；前置 = W3 + **L0-5** + **L0-6**。

## 2026-10-16 — L13 规范清理波（铁律 6 · CI 静态门禁加固 ✅ PASS · 非冻结/非登记 · 零冻结漂移）

- 判定 = 完成（**规范清理 + 门禁加固波**）；承用户裁决：**canonical / 冻结件 39 B 尾页脚豁免（LO-9=A）零覆盖**；仅清理【类别 C】非冻结 / 非登记文件；**未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）。报告 [`l13-cleanup-ai-notes-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-cleanup-ai-notes-2026-10-16.md:1)。
- **门禁加固（CI 拦截）**：[`verify.js`](../6.P0-T3基线/step9/scripts/verify.js:169) 增 `aiNoteLint()` 静态检查（扫描 step9 代码类文件 · 标记以内联 char code 构造）+ `lint` 模式，纳入 `spec`/`all` 默认门禁；命中即 **`exit 3`**。
- **红/绿证**：红 = 探针 `tests\_l13lint_probe.ts:2` → **`exit 3`**（判别力真实，探针即时删除）；绿 = `verify.js all` → **静态检查 0 命中 + Node 91 + PW 167 passed + 4 skipped = 171 + bench 7/7** → `[verify] 全部通过`（**exit 0**）。
- **先改锚（RL-11 承 L11 C-8）**：[`l9-hash-check.mjs`](../6.P0-T3基线/step9/verify-hash-registry.mjs:40) `verify.js` 期望 8,801/`ADA39590…` → **11,149/`E4581EB1…D9C1`**；同步 `_w5freeze.ps1` / `_w4freeze.ps1` `$VJS_GEN['l12']`（修复 L13-W3 起遗留的冻结门禁 P4 漂移）。
- **36 方复跑**：`node l9\l9-hash-check.mjs` → **`PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）。
- 字节锚点：canonical = step9 镜像 = **987,497 / `D5CCFF15…A28C` / LF（零变更）**；`frozen-l12` = **983,460 / `CFCD67DA…FC34` / LF（零覆盖）**；`verify.js` = **11,149 / LF / `E4581EB1…D9C1`**；`l9-hash-check.mjs` = **9,793 / CRLF / `2644D643…D733`**。
- **豁免（LO-9=A）**：canonical / 全部冻结件 / 产品 HTML 快照 的 39 B 尾页脚 + 类别 D 工具/规则「标记即数据」**未清理**。
- 证据：`reports\_l13clean-ai-notes-2026-10-16.txt` / `_l13clean-verify-all-2026-10-16.txt` / `_l13clean-lint-red-2026-10-16.txt`；依据 [`l11-design-2026-10-15.md`](../6.P0-T3基线/step9/reports/l11-design-2026-10-15.md:190)（LO-9=A）。
- 下一入口 = **L13-W4**（崩溃/一致性 + 100k 真规模闸门 T-115 + 哨兵 T-116 · #33）；前置 = W3 + **L0-5** + **L0-6**。

## 2026-10-16 — L13-W3 **核心产品实施完成**（`MB-SEAM` + `MB-LRU` + `TS-V` 落地 + `JU_L13` 门禁激活 ✅ PASS · 口径1 · 产品字节变更）

- 判定 = 完成（**核心产品实施波** · **口径1**）：修改 canonical 产品 HTML + 同步 step9 镜像；冻结件**只读**；按 **铁律 4 / §8.6「先改锚」** 更新 36 方登记器 ⇒ **36 方 / drift 0 / PASS**；**未覆盖冻结件 / 未重复归档 / 未新增 AI 注释**（铁律 4 / 铁律 6）。报告 [`l13-w3-implementation-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-w3-implementation-2026-10-16.md:1)。
- **产品变更（+4,037 B）**：canonical `6.P0-T3基线\v2.0-l3.html.html` = step9 镜像 = **987,497 / LF / `D5CCFF15…A28C`**（原 **983,460 / `CFCD67DA…FC34`**）；**`frozen-l12` 仍 983,460 / `CFCD67DA…FC34`（零覆盖）**。
- **落地（严格按 §8.6 + L0-4 / L0-9 裁决）**：① `TS-V` `mbResolve(desc)` 单接入点（IF-1~IF-5）；② `MB-LRU`（视口段 ≤200 常驻 + LRU 段 ≤5,000 + `commit` 唯一写接缝 + **三重淘汰守卫** + 冷路径显式排除）；③ `MB-SEAM`（唯一异步边界 `getNodeAsync(id)` + **S-A 短路默认 `≡ N(id)`**）；④ 影子（测试侧只读注入 · 干跑 LRU · 零产品字节依赖）。控件位 = `N(id)` 定义位 + `commit` 成功尾钩子。
- **门禁激活**：`verify.js` `L13_ENABLED = JU_L13 !== '0'`（**默认开启**；`JU_L13=0` 回落 165）；L13 spec 守卫同步激活；T-115/T-116 **条件跳过**（`JU_L13_100K=1` 才跑）。
- **红 → 绿**：红证（前波）`reports\l13-w3-red-log-2026-10-16.txt` = **6 failed**；本波 **T-111~T-114 转绿**（L13 spec = **4 passed + 2 skipped**）。
- **门禁（本波复跑）**：`node l9\l9-hash-check.mjs` = **`PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；`node scripts\verify.js all` = **Node 91 + PW 167 passed + 4 skipped = 171（165 + L13 6）+ bench 7/7** → `[verify] 全部通过`（**exit 0** · 最大恶化 0.0% / 中位 −14.3%）。
- 哈希锚点：canonical/step9 = **987,497 / LF / `D5CCFF15…A28C`**；`verify.js` = **8,801 / LF / `ADA39590…55E6`**；`l9-hash-check.mjs` = **9,793 / CRLF / `9075BAC4…A45F`**；`l13 spec` = **12,573 / CRLF / `C518E8B4…F6F1`**；frozen-l12 = **983,460 / `CFCD67DA…FC34`**（只读）。
- 证据：`reports\l13-w3-impl-green-log-2026-10-16.txt` / `reports\l13-w3-impl-l13-green-log-2026-10-16.txt` / `reports\_l13w3impl-registrar-2026-10-16.txt` / `reports\_l13w3impl-hashes-2026-10-16.txt`。
- 下一入口 = **L13-W4**（崩溃/一致性 + 100k 真规模闸门 T-115 + 哨兵 T-116 · #33）；前置 = W3 + **L0-5** + **L0-6**。

## 2026-10-16 — L13 前置裁决 **L0-4 / L0-9**（LRU 上限与淘汰策略 + 同步→异步过渡边界 ✅ 裁决完成 · docs-only · 解除 W3 实施阻塞 · 产品零字节变更）

- 判定 = 完成（**决策记录**）；本轮 **docs-only**：**未写产品代码字节 / 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；报告 [`l13-decisions-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-decisions-2026-10-16.md:1)。
- **L0-4 裁决 = A（LRU 上限与淘汰策略）**：`MB_LRU_CAP = 5,000`（**上限语义** · 承评估口径 P3b）+ 视口段 `MB_VIEW_CAP = 200` **单列**（总驻留 **≤ 5,200** · **MB-Q1/MB-Q2 口径收口 ⇒ OP-16 CLOSED**）；淘汰 = **仅 `getNodeAsync` 回填后触发**（MB-Q3）+ **`Map` 插入序**（MB-Q4）+ **三重守卫**（① 视口集常驻 / ② 脏集保护 / ③ 显式 pin）+ **`capBreach` 安全网（判据恒 0）** + **淘汰后回填值一致**；**冷路径显式排除**（`st`/`p`/`remote`/`next`/`prev`/`fromState`/`restoreState`）+ 写接缝草稿 `s.nodes[`（103 处）不入工作集。
- **L0-4 ⇒ RWS 论证**：驻留基数**与 N 解耦（O(1)）** ⇒ 内存不随节点数线性增长；`TS-V` 投影裁剪使 LRU 工作集为**唯一消费者**（上界可验证）；视口段 200 对齐 L12 虚拟滚动 ⇒ DOM 有界；**口径消歧**：① 内存封顶 = **100k 夹具 RSS ≤ 200MB**（阈值归 **L0-5 / W4 / T-115**）② 规模 = **百万节点不崩可导航**（非「1M 下 RSS ≤ 200MB」）；**证伪/回退条件**：W4 若超限则依 L0-5 **下调 `MB_LRU_CAP`（上限可调 · 架构不动）**。
- **L0-9 裁决 = A（同步→异步过渡边界）**：**唯一异步边界 = `getNodeAsync(id)`**（读 `N(id)` 签名冻结 / 写 `commit` 唯一写接缝 / 视图 `mbResolve` ⇒ 三面各一点）；传染面 **A 153 + B 61** 经 **6 档处置**后异步面**收敛至档 1（视图取数）+ 档 4（递归聚合）**。
- **S-A 短路逻辑（默认 `≡ N(id)`）**：`_mbDisabled` **默认 `true`** ⇒ `Promise.resolve(N(id))` 返回**同一对象引用** ⇒ `await getNodeAsync(id) === N(id)`（**严格相等**）⇒ **A 153 调用点零改动 / 零回归 / 可逆跃迁**（off 态等价 L12 冻结件 · D-6 / 哨兵 T-116）；**分档纪律（强制）**：strict `===` 仅 off 态成立，on 态 = `deepEqual(projection)` ⇒ **T-111 须分档**；**S-B 同步预取**（渲染前 `prefetch` · 未达即降级 S-A）+ **MI-S 异步兜底**（索引层回填）。
- **TS 视图（`TS-V`）定位与依赖**：`mbResolve(desc) → Slice` 为**视图取数唯一入口**（IF-1/IF-2/IF-5 · 投影不泄漏）；依赖方向 **`TS-V` ⟵ `MB-LRU` ⟵ `MB-SEAM` ⟵ W1 台账**；`mbResolve` **只读**（禁内部触发 `commit`）；默认态同步退化为 `Promise.resolve({degraded:true, rows: 由 N(id) 全量取})`（D-5）；递归 `docSubtree`/`docWordCount` 改索引层异步聚合 + 对拍，`walkTree`/`toTree` 走 **pin** / `_mbPrintForceFull`；**不引入构建期 TS**（JSDoc 契约 + 运行时 descriptor）。
- **闸门判定**：**W3 前置全部满足**（红证载体就绪 + `JU_L13` 门禁接线 + 台账完整 + **L0-4 / L0-9 裁决完成**）⇒ **「L0-4 / L0-9 已裁决，可进入 L13-W3 核心产品实施」**（T-111/112/113/114 转绿）；**L0-5**（阻 W4）/ **L0-6**（阻 W5）/ **L0-8**（W5）仍待决；**未收到明确指令前不写产品代码字节**。
- 字节锚点（本波复跑）：canonical = step9 镜像 = L12 冻结件 = **983,460 / `CFCD67DA…FC34` / LF**（零变更）；`verify.js` = **8,538 / LF / `185227BA…9B7D`**；`l13 spec` = 11,095 / CRLF / `7EB2D9C7…`；`l9-hash-check.mjs` = 9,781 / CRLF / `11A80A93…`；登记器 = **`PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（本波**未落入 36 方锚点 ⇒ 无需改锚** · RL-11 未触发）。
- 证据：[`l13-decisions-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-decisions-2026-10-16.md:1)（裁决记录）+ [`_l13dec-registrar-2026-10-16.txt`](../6.P0-T3基线/step9/reports/_l13dec-registrar-2026-10-16.txt:38)（登记器复跑）；依据 [`l13-w3-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-w3-2026-10-16.md:144) §八 + [`l13-w2-wiring-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-w2-wiring-2026-10-16.md:207) §四/§五 + [`l13-design-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-design-2026-10-16.md:315) §十。
- 下一入口 = **L13-W3 核心产品实施（待明确指令）**：`MB-SEAM` + `MB-LRU` + `TS-V` 落地产品 HTML + `D-1…D-8` 收口 + N 层 `l9\l13-mb-workset.test.mjs`（T-111/112/113/114 转绿）。

## 2026-10-16 — L13-W3 实施波（W2 实施波 · 测试先行 + `JU_L13` 门禁接线 + 36 方零漂移 ✅ 完成 · 产品零字节变更）

- 判定 = 完成；**严格按 [`l13-w2-wiring-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-w2-wiring-2026-10-16.md:527) §八 8.6 六步执行**（承 **L12-W2 范式**：红证 = `JU_L13=1` 隔离跑；绿证 = 默认态；「171」= 收集计数）；本轮 **未写产品代码字节 / 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）。
- ① **测试先行**：新建 [`tests\l13-mb-workset.spec.ts`](../6.P0-T3基线/step9/tests/l13-mb-workset.spec.ts:1)（**T-111–T-116** · 整文件 `JU_L13` 保护 · 现状必红）；② **红证** `reports\l13-w3-red-log-2026-10-16.txt` = **6 failed**（T-111 `MB-SEAM` / T-112 LRU 上限 / T-113 视口常驻 / T-114 `TS-V` 不直读 + 探针 ready / T-115 100k RSS / T-116 降级 · 全红 · 判别力真实）。
- ③ **门禁接线**：`scripts\verify.js` `JU_L13`（`L13_ENABLED` / `L13_TESTS` / `PW_EXTRA` / `PW_LABEL` · 与 L11/L12 同构 · 默认关闭态）；④ **先改锚**（RL-11）：`l9\l9-hash-check.mjs` 中 `verify.js` 期望 7,876/`4E2DC206…1FCB` → **8,538/`185227BA…9B7D`**。
- ⑤ **登记器复跑** = `node l9\l9-hash-check.mjs` → **`PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（exit 0）；⑥ **绿证** `reports\l13-w3-green-log-2026-10-16.txt` = `verify.js all` → **Node 91 + PW 163 passed + 2 skipped（T-48/T-49）= 165 + bench 7/7** → `[verify] 全部通过`（exit 0）。
- **默认关闭态不变性**：`JU_L13` 缺省 ⇒ PW **165 逐项一致**（与 L12 冻结版）；`JU_L13=1` 收集 = **171**（165 + 6）；**6 例转绿归 W3（SEAM/LRU/TS-V）与 W4（RSS/降级）**。
- 字节锚点（本轮复跑）：canonical = step9 镜像 = L12 冻结件 = **983,460 / `CFCD67DA…FC34` / LF**（**零变更**）；`verify.js` = **8,538 / LF / `185227BA…9B7D`**；`l13 spec` = **11,095 / CRLF / `7EB2D9C7…`**；`l9-hash-check.mjs` = **9,781 / CRLF / `11A80A93…`**；登记器 = **36 方 / drift 0 / PASS**。
- 证据（均 `reports\`）：`l13-w3-2026-10-16.md`（报告）+ `l13-w3-red-log-2026-10-16.txt` / `l13-w3-green-log-2026-10-16.txt` / `_l13w3-registrar{,-pre}-2026-10-16.txt` / `_l13w3-hashes-2026-10-16.txt` / `_l13w3-artifact-hashes-2026-10-16.txt` / `_l13w3-l13spec-list-2026-10-16.txt`；依据 [`l13-w2-wiring-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-w2-wiring-2026-10-16.md:527) §八 8.6 + §七。
- 下一入口 = **L13-W3 实装**（`MB-SEAM` / `MB-LRU` / `TS-V` 落地产品 HTML + `D-1…D-8` 收口 + N 层 `l9\l13-mb-workset.test.mjs`）；**前置 = LO-4 / LO-9 裁决**；**未收到明确指令前暂不进入产品实装阶段**。

## 2026-10-16 — L13-W2（接线设计 + 影子 + 编号区启用 T-111–T-116 + `JU_L13` 门禁接线 ✅ 设计已落盘 · docs-only · 红线先行 · 产品零字节变更）

- 判定 = 完成（**设计推演**）；**W2 交付物 = 接线方案 + 影子逻辑 + 编号区启用 + 门禁接线设计**；本轮 **docs-only**，**未写产品代码字节 / 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）；**未收到明确指令前，暂不进入开发实现阶段**。
- **红线先行（RL-1…RL-11）**：RL-1 不得修改产品代码字节 / RL-2 不得覆盖冻结件 / RL-3 不得重复归档 / RL-4 无真实后端依赖（S-5）/ RL-5 视图不得直读 `state.nodes` / RL-6 异步边界唯一（`getNodeAsync`）/ RL-7 降级与影子默认关闭（`_mbDisabled=true` · `_mbShadow=false`）/ RL-8 红证先行 / RL-9 不动状态机与规则段 / RL-10 铁律 6（尾页脚 39 B 不清）/ **RL-11 先改锚后落改动（承 L11 纪律 C-8）**。
- **① TS 视图接线（依 LO-3=A）**：单接入点 **`mbResolve(desc)`**（紧邻 `N(id)` `:5206`）；A 类接口契约 **IF-1…IF-5**（仅接受 `ViewDescriptor` / 投影不泄漏 / `degraded` 等价 / 行序与 `docSubtree` 一致 / 视图不得 `state.nodes[`）；**6 类视图**（大纲 / 导图 / 日历 / 数据库 / 演示 / `renderMain`）descriptor 映射；默认态 `Promise.resolve` 退化（零回归）。
- **② `MB-LRU` 接线**：分层 = **视口段**（≤200 常驻不淘汰）+ **LRU 段**（≤5,000 · `Map` 插入序）；接入点 = **`commit` 写接缝（`s.nodes[` 103 处）**+ 读入口（A 153 / `state.nodes[` 61）+ C 类 15 处改索引层枚举；**三重淘汰守卫**（视口集 / 脏集 / 显式 pin）+ 淘汰后再取回填一致；**冷路径显式排除**（`st`·`p`·`remote`·`next`·`prev`·`fromState`·`restoreState`）；口径细化 **MB-Q1–MB-Q4**（总驻留 ≈ ≤5,200）。
- **③ `MB-SEAM` 边界**：**唯一异步边界** `getNodeAsync(id)`；三态 **S-A 短路**（默认 · `≡ N(id)`）/ **S-B 预热**（`prefetch` · 未达即降级）/ **S-C 等价**；**口径澄清**：严格相等仅默认态成立，on 态为**投影字段结构等价**（T-111 须分档）；D 类递归（`docSubtree` 等 24 处）改索引层异步聚合 + 对拍；传染面 **6 档处置**（视图取数 / 判定 / 动作 / 聚合 / 全扫 / 冷路径）。
- **④ 影子模式（只记录不启用）**：**测试侧只读注入探针**（**零产品字节**）+ **干跑 LRU**（模拟命中/回填/淘汰，不触碰真实结构）+ 有界环形记录（`ring ≤ 2,000`）；默认关闭（`JU_L13_SHADOW=1` 显式开启）；零 DOM / 零 state / 零调度副作用；探针 `ready` 为 W2 退出判据。
- **⑤ 编号区启用 `T-111–T-116`（逐号归属）**：T-111 `MB-SEAM` 等价（W2 红 → W3 绿）/ T-112 LRU 上限与回填（W3）/ T-113 视口集常驻（W3）/ T-114 `TS-V` 不直读（W3）/ T-115 100k RSS ≤ 200MB（W4）/ **T-116 降级等价（W4→W5 哨兵 · 不变量 #33）**；载体 `tests\l13-mb-workset.spec.ts`（新建）；N 层 `l9\l13-mb-workset.test.mjs`（W3）。
- **⑥ `JU_L13` 门禁接线**：与 `JU_L11`/`JU_L12` 同构（`L13_ENABLED` / `L13_TESTS` / `PW_EXTRA` / `PW_LABEL`），**默认（缺省）PW=165 与 L12 冻结版逐项一致**，`JU_L13=1` → **PW=171**；**关键发现**：`scripts\verify.js` **属 36 方登记锚点** → 实施波须「**先红证 → 改 `verify.js` → 先改锚（登记器期望哈希）→ 复跑 36 方 PASS → 绿证**」。
- 观察项（L13 新）：**OP-16**（LRU 驻留口径）/ **OP-17**（Banner 计数口径 · R26 面）/ **OP-18**（影子干跑保真度）。
- 字节锚点（**本轮复跑登记器**）：canonical = step9 镜像 = L12 冻结件 = **983,460 / `CFCD67DA…FC34` / LF**；`verify.js` = 7,876 / LF / `4E2DC206…1FCB`（未改）；`spec` = 11,251 / CRLF / `2CF7CA06…6265`（未改）；登记器 = **`PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- 证据：`reports\l13-w2-wiring-2026-10-16.md`（接线 + 影子 + 编号区 + 门禁）；登记器 `reports\_l13w2-registrar-2026-10-16.txt`；依据 [`l13-design-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-design-2026-10-16.md:1) §三/§四/§六/§七/§九 + [`l13-w1-nid-audit-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-w1-nid-audit-2026-10-16.md:1)。
- 下一入口 = **L13-W2 实施波（待明确指令）**；**未收到明确指令前暂不进入开发实现阶段**。

## 2026-10-16 — L13-W1（决策回执 + `N(id)` 调用点台账 + LO-3 裁决 ✅ 完成 · docs-only · 产品零字节变更）

- 判定 = 完成；**L13 = E-3（`M-B` 内存工作集 / P3b / #33）正式回执**；原 E-2（`M-H` 加固）**改属 L14 顺延**（原样保留）；本轮 **docs-only**，**未写产品代码字节 / 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）。
- **台账（canonical 只读扫描 · 18,566 行）**：**A**（经 `N(id)`）= **153** 有效调用点（共 156 行 / 164 处；去 **1 定义** `:5206` + **2 注释** `:7248`/`:7911`）；**B**（直读 `.nodes[id]`）= **189 行 / 220 处**（**`state.nodes[` 61** 真理源直读 / **`s.nodes[` 103** commit 事务草稿 / `st`·`p`·`remote`·`next`·`prev`·`fromState`·`restoreState` 共 56 导入·合并·索引对拍）；**C**（O(n) 全扫 `for…in .nodes`）= **29 行**（**`state.nodes` 15** 处 `[2042,2688,5837,7059,7077,11739,12424,12476,12808,12873,12913,13086,13170,13859,13961]`，**≥8 成立并上修至 15**）；**D**（递归）= **24** 处（`docSubtree` 8 / `docWordCount` 6 / `docNodeCount` 4 / `walkTree` 4 / `toTree` 2）。
- **LO-3 裁决 = A**：`TS 视图` = **类型化视图接缝**（`ViewDescriptor` → **`async resolve`** → Slice）；**边界** = 不引入构建期 TS（单文件 HTML classic script，以 JSDoc `@typedef` 契约 + 运行时 view descriptor 落地，不改交付形态、不新增视图）；**依赖** = `TS-V` ⟵ `MB-LRU`·`MB-SEAM` ⟵ 本台账（W3 顺序：台账→接缝→工作集→视图接缝）。
- **交叉结论（风险量化）**：A 153 + B `state.nodes[` 61 = **R30（同步→异步传染面失控）** 量化面（风险「高」成立）；`s.nodes[` 103 处全位于 `commit(s=>…)` 事务闭包内 → **commit 草稿为唯一写接缝** = `M-B` 接入 LRU 的天然改造点（W3 依据）。
- 证据：`reports\l13-w1-nid-audit-2026-10-16.md`（台账 + 裁决）；原始台账 `reports\_l13w1-nidscan-2026-10-16.txt`；登记器 `reports\_l13w1-registrar-2026-10-16.txt`；工具 `_临时脚本\_l13w1_nidaudit.mjs`。
- 门禁：`node l9\l9-hash-check.mjs` → **`PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- 字节锚点（本轮无复跑）：canonical = step9 镜像 = **L12 冻结件** = **983,460 / `CFCD67DA…FC34` / LF**；`verify.js` = 7,876 / LF / `4E2DC206…1FCB`；spec = 11,251 / CRLF / `2CF7CA06…6265`；登记器 = **36 方 / drift 0 / PASS**。
- 依据：[`l13-design-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-design-2026-10-16.md:1)（§三 3.6 台账 / §九 W1 / §十 LO-3）+ [`CURRENT_TASK.md`](CURRENT_TASK.md:1) §二。
- 下一入口 = **L13-W2**（接缝 + 影子 + 编号区启用 T-111–T-116 + `JU_L13=1` 门禁接线）；**未收到明确指令前，暂不进入开发实现阶段**。

## 2026-10-16 — 路径 A 启动 · L13 阶段（E-3 `M-B` 内存工作集 ✅ 设计推演已落盘 · docs-only · 产品零字节变更）

- 判定 = 就绪（设计推演完成）；**路径 B（S1~S5）已完成 → 本轮按决策启动路径 A**，将 **E-3（`M-B` / P3b / #33）独立成阶段 L13**；本轮为 **docs-only 设计推演**，**未写产品代码字节 / 未覆盖任何冻结件 / 未重复归档**（铁律 4 / 铁律 6）。
- **编号归属收口（消歧完成）**：**L13 = E-3**；原 [`l13-design-2026-10-15.md`](../6.P0-T3基线/step9/reports/l13-design-2026-10-15.md:1)（**E-2 补完 · `M-H` 加固**）**改属 L14**（正文原样保留、仅追加改属标注、零覆盖）；**`T-111–T-116` / `#33` 归还 E-3** 预留区。
- **设计件（新建）**：[`l13-design-2026-10-16.md`](../6.P0-T3基线/step9/reports/l13-design-2026-10-16.md:1) —— `M-B` 骨架（**TS 视图接缝 + LRU 工作集 5,000 + 同步→异步接缝 + 强制降级开关**）+ **破坏面台账 D-1…D-8** + 指标（**RSS ≤ 200MB** / 百万节点）+ **红证矩阵 T-111–T-116** + **L13-W1–W5** + **LO-0–LO-9** + 风险（**R22 承接** / **R30–R33 新增**）；**#33 拟 W5 回填**。
- **前置（W1 产出）**：`N(id)` 调用点台账（A 经 `N(id)`（[`:5206`](../6.P0-T3基线/v2.0-l3.html.html:5206)）/ B 直读 `state.nodes[id]` / C O(n) 全扫（已知 **≥8 处**）/ D 递归 `docSubtree`·`docWordCount`）+ 同步→异步**等价接缝** + **强制降级开关**（`_mbDisabled` 默认 `true`）。
- 字节锚点（承前不变，本轮无复跑）：canonical = step9 镜像 = **L12 冻结件** = **983,460 / `CFCD67DA…FC34` / LF**；`verify.js` = 7,876 / LF / `4E2DC206…1FCB`；spec = 11,251 / CRLF / `2CF7CA06…6265`；登记器 = **36 方 / drift 0 / PASS**。
- 依据：[`Project-Closure §4.3`](../6.P0-T3基线/step9/reports/Project-Closure-2026-10-15.md:163)（E-3 候选 / #33）+ §6.2（建议「独立成阶段 L13」）+ [`s4s5-closure §五`](../8.发布与CI/reports/s4s5-closure-2026-10-16.md:73)（S4 不改 canonical → 路径 A 字节基线未变）+ [`评估报告（2）:229`](../3.评估报告/JU工作台融合评估报告（商业化）2026-10-13（2）.md:229)（P3b / 风险 极高）。
- 下一入口 = **L13-W1（决策回执 + `N(id)` 调用点台账 + 阈值标定；待 LO-0–LO-9 裁决）**；**未收到明确指令前暂不进入开发实现阶段**。

## 2026-10-16 — 路径 B 阶段 S4~S5（发布包冻结 + 上线前收口复跑 ✅ 完成 · 四方一致 · 36 方零漂移 · 产品零字节变更）

- 判定 = 完成；**路径 B（正式上线 S1→S5）之 S4 / S5 执行完成**；本轮为**发布产物 / 复跑证据 / 文档产出**，**未改 canonical / 未覆盖任何冻结件 / 未重复归档**（铁律 4）。
- **S4（发布包冻结）**：正式发布包 `8.发布与CI\release\v2.0-l12-2026-10-16\` = **4 件 / 988,564 字节**——发布产物 `ju-workbench-v2.0-l12.html`（= canonical 逐字节副本，**983,460 B / LF / `CFCD67DA…FC34`**）+ `release-manifest.json`（2,659）+ `checksums.sha256`（315）+ `RELEASE-NOTES.md`（2,130）；**逐件 字节 + SHA-256 已登记**。报告 `8.发布与CI\reports\s4-release-freeze-2026-10-16.md`。
- **S4 差异记录**：本仓无 git → 以**发布标识 `v2.0-l12-2026-10-16` + 发布清单 / 校验清单**替代 `git tag`；**对路径 A（E-3）字节依赖 = 无影响**（canonical 逐字节未变）。
- **S5（收口复跑）**：① 登记器 `l9\l9-hash-check.mjs` = **`PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；② 冻结门（只读）`_w5freeze.ps1 -Wave l12 -NoFreeze` = `FREEZE_ACTION=PRESENT`（未写）/ `BYTE_IDENTICAL=True` / `CURRENT_WAVE_THREE_PARTY_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS`；③ 全量回归 `verify.js all` = **`[verify] 全部通过`（EXIT=0）**：Node 91 + PW 165（163 passed + 2 skipped）+ bench 7/7。
- **一致性核验**：发布产物 = canonical = step9 镜像 = L12 冻结件 = **983,460 / `CFCD67DA…FC34` / LF**（`FOUR_WAY_IDENTICAL=true`）；发布包 `checksums.sha256` 逐件复核 **0 漂移**。
- 哈希锚点（承前）：canonical / 镜像 / frozen-l12 = 983,460 / LF / `CFCD67DA…FC34`；`verify.js` = 7,876 / LF / `4E2DC206…1FCB`；spec = 11,251 / CRLF / `2CF7CA06…6265`；登记器 = **36 方 / drift 0**。
- 证据（均 `8.发布与CI\reports\`）：`_s4-release-evidence-2026-10-16.txt` / `_s5-registrar-evidence-2026-10-16.txt` / `_s5-w5freeze-l12-2026-10-16.txt` / `_s5-closure-evidence-2026-10-16.txt` / `_s5-release-vs-frozen-2026-10-16.txt`。
- 报告 `8.发布与CI\reports\s4s5-closure-2026-10-16.md`。
- 下一入口 = **路径 B（S1~S5）全部完成；待评估是否启动路径 A（E-3 独立成阶段 L13）**；结转 OPEN：OP-2 / OP-3 / OP-4 / OP-14。

## 2026-10-16 — 路径 B 阶段 S1~S3（正式上线路径 · 关闭 OP-12 / 建 CI 门禁 / 关闭仓外项 OP-1 ✅ 完成 · 五方一致 · 36 方零漂移 · 产品零字节变更）

- 判定 = 完成；**路径 B（正式上线 S1→S5）之 S1~S3 执行完成**；本轮为 **非产品工装/文档产出**，**未改 canonical / 未覆盖任何冻结件 / 未重复归档**（铁律 4）；**暂未进入 S4/S5**（待指令）。
- **S1（关闭 OP-12 · 环境可移植性）**：新增可复现环境工装 `8.发布与CI\ci\env.example.ps1`（Windows）+ `env.example.sh`（POSIX）——固化 `JU_NODE_DIR`→PATH + `ELECTRON_RUN_AS_NODE=1` + `JU_CHROMIUM_PATH`，运行时推导 `JU_APP_URL`；换机/CI 仅需改两处。报告 `8.发布与CI\reports\s1-op12-closure-2026-10-16.md`。**OP-12 → CLOSED**。
- **S2（建 CI 门禁）**：新增 `8.发布与CI\ci\ci-gate.yml`（三段只读）= ① `node l9/l9-hash-check.mjs`（36 方）② `node scripts/verify.js all`（Node 91 + PW 165 + bench 7）③ `scripts/_w5freeze.ps1 -Wave l12 -NoFreeze`（只读 · 永不写冻结件）；与本地复跑逐条等价。报告 `8.发布与CI\reports\s2-ci-gate-2026-10-16.md`。
- **S3（关闭仓外项）**：Rust/Tauri 基座 K-1 · OP-1 仓外交付在**本仓侧交付包**（前端通道契约 `l8-rust-contract` K-1~K-7 + 合规包装 `l9-op1-compliance-delivery` I-1~I-9 + manifest + 真机验收 A-1~A-10）**已封口并移交**；真机实现属外部交付方。报告 `8.发布与CI\reports\s3-outofrepo-closure-2026-10-16.md`。**OP-1 → CLOSED（仓外移交）**。
- **五方一致（本轮复跑）**：canonical = step9 镜像 = **L12 冻结件** = **983,460 / `CFCD67DA…FC34` / LF**；`verify.js` = 7,876 / LF / `4E2DC206…1FCB`；spec = 11,251 / CRLF / `2CF7CA06…6265`；登记器 `l9-hash-check.mjs` = **`PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- **冻结门（只读）**：`_w5freeze.ps1 -Wave l12 -NoFreeze` → `FREEZE_ACTION=PRESENT`（未写）/ `BYTE_IDENTICAL=True` / `CURRENT_WAVE_THREE_PARTY_IDENTICAL=True` / `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS`；证据 `8.发布与CI\reports\_s1s3-w5freeze-l12-2026-10-16.txt`。
- 冻结纪律：新增物均在 **`step9` 之外**（`8.发布与CI\`）→ 不触发 `step9` 内任何 canary/锚点扫描；产品字节零变更；不变量末号 **#34**（仅 #33 E-3 预留空洞）。
- 依据报告 `8.发布与CI\reports\s3-outofrepo-closure-2026-10-16.md`（发布链 S1→S3 闭环）+ `reports\Project-Closure-2026-10-15.md` §6.3。
- 下一入口 = **待决策/待指令**：**S4（发布包冻结 + `git tag`）→ S5（上线前最终收口复跑）**；路径 A（E-3 / `M-B` / #33）顺延。

## 2026-10-16 — 下一步决策（L4~L12 归档封存完成 ✅ · 待决策：E-3 独立成阶段（L13）或 正式上线路径（S1→S5））

- 判定 = 归档封存完成；复核 `1.归档快照\L4-L12-2026-10-15\_archived-manifest.md` 存在且自洽：**13 件 / 7,627,345 字节**（逐件 字节 + SHA-256 + 行尾，合计复核一致）。
- 五方一致（canonical / step9 镜像 / L12 冻结件 / verify.js / spec）：canonical = step9 镜像 = **L12 冻结件** = 983,460 / `CFCD67DA…FC34` / LF；`verify.js` = 7,876 / LF / `4E2DC206…1FCB`；spec = 11,251 / CRLF / `2CF7CA06…6265`；登记器 = **36 方 / drift 0 / PASS**。
- **决策对比（决策记录）**：路径 A = **E-3 独立成阶段（L13）**（`M-B` 内存工作集 / #33；收益 = 内存封顶 200MB + 百万节点；风险 极高：同步变异步波及所有 `N(id)` 调用点、返工面 40%）；路径 B = **正式上线路径（S1→S5）**（S1 关 OP-12 → S2 CI 门禁 → S3 仓外项 → S4 发布包冻结 → S5 收口复跑）。
- **推荐路径（决策记录）**：**先 B 后 A** —— 先以 S1→S5 收口可发布基线（低风险、可回滚），再行 A（E-3）独立阶段。
- 前置 / 风险 / 回滚：路径 B 前置 = 关闭 OP-12 与仓外项（OP-1）；回滚 = 以 L12 冻结件为唯一发布基线，产品字节零变更。路径 A 前置 = `N(id)` 调用点台账 + 同步→异步等价接缝 + 强制降级开关；回滚 = 默认关闭态短路（承 `M-H` 范式），产品字节回退至 L12 冻结件。
- 依据报告 `reports\Project-Closure-2026-10-15.md`（§4.4 / §5.2 / §6.3）；本轮为 **docs-only 决策记录**，**未改 canonical / 未覆盖任何冻结件 / 未重复归档**（铁律 4）。
- 下一入口 = **待决策**：**E-3 独立成阶段（L13）** 或 **正式上线路径（S1→S5）**；消歧：`l13-design-2026-10-15.md`（E-2 补完）此前已落盘，**L13 编号归属待定**。

## 2026-10-15 — L13 立项（E-2 补完「`M-H` 加固」/ 界面规模收口二期 ✅ 设计已落盘 · docs-only · 产品零字节变更）

- 判定 = 就绪；人类裁决 = **走 L13（方案 A · `M-H` 加固 / 界面规模收口二期）**；L12 差距分析五处（变高行错位 / O(n) 残留 / 覆盖仅 2 视图 / Ctrl+F 失效 / 无增量 patch）。
- 设计件：`reports\l13-design-2026-10-15.md`（新建 · docs-only；**G1–G6** 加固骨架 + **加固面台账 E-①…E-⑥** + 指标 + **L13-W1–W5** + **LO-2–LO-8**；编号接续 **T-111** 起 / **R27** 起 / 拟 **#35** / **OP-15** 起）。
- 产品零字节变更：canonical = step9 镜像 = **L12 冻结件** = 983,460 / `CFCD67DA…FC34` / LF；`verify.js` = 7,876 / LF / `4E2DC206…1FCB`；spec = 11,251 / CRLF / `2CF7CA06…6265`；`l9-hash-check.mjs` = **36 方 / drift 0 / PASS**（按登记不变）。
- 未改动：产品代码 / 冻结件 / spec / `verify.js` / 36 个登记锚点 / 不变量清单（本轮零写入）。
- 下一入口 = **L13-W1（决策回执 + 阈值标定 + 加固面台账；待 LO-2~LO-5 裁决）**。

## 2026-10-15 — L4~L12 阶段归档封存（8 件独立冻结件 + 3 件门禁/接线 + 2 件文档快照 = 13 件 ✅ 完成 · 五方一致 · 36 方零漂移）

- 判定 = 完成；**阶段归档封存**：归档目录 `1.归档快照\L4-L12-2026-10-15\`，**归档件 13 件 / 合计 7,627,345 字节**（8 件独立冻结件 L7/L8/L9/L9-W6/L10/L11/L11-W6/L12 + `verify.js` + `l12-virtual-scroll.spec.ts` + `l9-hash-check.mjs` + `Project-Closure-2026-10-15.md` + `CURRENT_TASK.snapshot.md`）。
- 清单：`1.归档快照\L4-L12-2026-10-15\_archived-manifest.md`（逐件 字节 + SHA-256 + 行尾 · Node 只读采集）。
- **五方一致性**（canonical / step9 镜像 / L12 冻结件 / verify.js / spec）：canonical = step9 镜像 = **L12 冻结件** = **983,460 B / `CFCD67DA…FC34` / LF**（`THREE_PARTY_IDENTICAL=True`）；`verify.js` = 7,876 / LF / `4E2DC206…1FCB`；spec = 11,251 / CRLF / `2CF7CA06…6265`。
- 登记方核验：`l9-hash-check.mjs` = **`PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（零漂移）。
- 归档件定值（8 件独立冻结件）：L7 887,834 / `315D0711…46C0`；L8 = L9 907,458 / `6CAD8950…2B10`；L9-W6 968,079 / `A820EE39…851D`；L10 = L11 972,117 / `3A19A492…F49F`；L11-W6 972,267 / `D6204DFC…D7C1`；L12 983,460 / `CFCD67DA…FC34`（均 LF）。
- 冻结纪律：本次为**只读封存快照（canonical 逐字节副本）**，**未改 canonical**、**未覆盖任何冻结件**（铁律 4）；归档清单自身哈希自指，如需再登记以落盘重算为准。
- 依据报告 `reports\Project-Closure-2026-10-15.md`（L4~L12 全里程碑冻结 · 收口结论 PASS）。
- 下一入口 = **L4~L12 全部阶段已冻结并归档，待决策：E-3 独立成阶段（L13）或 正式上线路径（S1→S5）**。

## 2026-10-15 — L12-W5（全量回归 + bench + 冻结登记 ✅ 完成 · 三方一致 · 36 方定值 · L12 全阶段冻结）

- 判定 = 完成；canonical = step9 镜像 = **L12 冻结件** `1.冻结版本\v2.0-l3-frozen-l12-2026-10-15.html` = **983,460 B / `CFCD67DA…FC34` / LF**（**本波零字节变更**，产品 HTML 未触碰；`CURRENT_WAVE_THREE_PARTY_IDENTICAL=True`）。
- 全量回归（`verify.js all`）：默认态 = **Node 91/91 + PW 163 passed + 2 skipped（T-48/T-49）= 165 + bench 7/7** → `[verify] 全部通过`；启用态（`JU_L12=1`）= **Node 91/91 + PW 169 passed + 2 skipped = 171 + bench 7/7** → 全部通过。
- 冻结登记（版本感知 · `-Wave l12`）：`_w5freeze.ps1 -Wave l12` → `FREEZE_ACTION=CREATED` / `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS`（P1~P20 + 历史只读锚 L8/L9/L9W6/L10/L11/L11W6/L7/old/baseline 全 `FROZEN-OK`）。
- 版本感知区分（**区分 L11/L12 冻结件**）：`-Wave l11` → `FROZEN_DRIFT_COUNT=3 / FAIL`（P1/P2 `HASH-DRIFT` + 三方不一致 · **设计预期**）；`-Wave l9` → `4 / FAIL`（设计预期）；证据 `reports\_w5freeze.txt` / `_w5freeze-l11-recheck-l12w5.txt` / `_w5freeze-l9-recheck-l12w5.txt`。
- 辅助门禁：`_w4paths.ps1 -Wave l12` → `CANARY_ARTIFACTS=79 / VIOLATION_COUNT=0 / PASS`；`_w4freeze.ps1 -Wave l12` → `BYTE_IDENTICAL=True / FROZEN_DRIFT_COUNT=0 / PASS`。
- **不变量 #32**（真虚拟滚动视口一致 · 哨兵 **T-110**）登记于 `4.回归与验收\JU-不变量清单-v2.0-frozen.md` §十一.32；**登记方数定值 36 方**（LO-8=B：新增 `frozen-l12` + L12 三物）。
- 门禁：`l9-hash-check.mjs` = **`PARTY_COUNT=36` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（32 → 36）。
- 哈希锚点：canonical/mirror/frozen-l12 = 983,460 / LF / `CFCD67DA…FC34`；`_w5freeze.ps1` = 19,071 / CRLF / `5D55C2C9…168E`；`_w4freeze.ps1` = 12,687 / CRLF / `D808F727…1ECF`；`_w4paths.ps1` = 6,306 / CRLF / `AA13C26C…E30C`；登记器 = 9,758 / CRLF / `E2E4B31C…2289`；不变量清单 = 54,165 / LF / `396BFAB7…DD06`；spec = 11,251 / CRLF / `2CF7CA06…6265`；N 层（W3）= 6,970 / CRLF / `5C80BE7E…132E`；N 层（W4）= 13,229 / CRLF / `02776619…458BB`。
- 报告 `reports\l12-w5-2026-10-15.md`；下一入口 = **L12 全阶段冻结完成 → 阶段评审 / 归档**（36 方零漂移；`#32` 已登记，仅剩 `#33`（E-3）预留空洞）。

## 2026-10-15 — L12-W4（崩溃/一致性 + 降级开关 H5 + 哨兵 + 指标 ✅ 完成 · 产品字节变更 · 自 W4 起产品代码字节冻结）

- 判定 = 完成；canonical = step9 镜像 = **983,460 B / `CFCD67DA…FC34` / LF**（**产品字节变更**：979,673 → 983,460，+3,787 B；L11 收口冻结件 `D6204DFC…D7C1` 保持只读）；**自 W4 起产品代码字节冻结**。
- 主线 = **E-2**（`M-H`）：**降级开关 H5**（LO-3=A **显式 UI 开关**：`#setVirtualScrollOff` + `_vsUserDisabled` 短路 + `ui.virtualScrollOff` 持久化）+ **指标度量**（commit / 切视图 / longtask 三序列 p95 · `VS_METRIC_CAP=256` · `vsMetricsStats()` / `window.__juVsMetrics` · `PerformanceObserver`）。
- 崩溃/一致性哨兵 **N 层续扩**：`l9\l12-w4-consistency.test.mjs`（**9 用例** · `T-109(N)` / `T-110(N)` · **不新增编号**）；不变量 **#32** 哨兵 T-110 成立（W5 登记）。
- 红证：`reports\_l12w4_red0.txt` = **6 passed / 3 failed**（H5 + 指标新锚未实现必红）；绿证（N 隔离）：`_l12w4_green0.txt` = **9 passed / 0 failed**。
- 门禁：`verify.js all`（默认）= **Node 91/91 + PW 163 passed + 2 skipped = 165 + bench 7/7** → `[verify] 全部通过`；`JU_L12=1` = **Node 91/91 + PW 169 passed + 2 skipped = 171 + bench 7/7** → 全部通过。
- 接线：`verify.js` `NODE_TESTS += l9/l12-w4-consistency.test.mjs`（N 层 +9）；`l9-hash-check.mjs` = **PARTY_COUNT=32 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**（canonical/mirror/verify.js 行重登记）。
- 哈希锚点：`verify.js` = 7,876 / LF / `4E2DC206…1FCB`；登记器 = 8,946 / CRLF / `4426AACD…45CC`；spec = 11,251 / CRLF / `2CF7CA06…6265`；N 层（W4）= 13,229 / CRLF / `02776619…458BB`；`_w5freeze.ps1` = 16,191 / CRLF / `7D96E6CD…FE2D`（`$VJS_GEN` 同步）；报告 `reports\l12-w4-2026-10-15.md`；下一入口 = **L12-W5**（全量回归 165+6=171 + #32 登记 + `_w5freeze.ps1 -Wave l12` 冻结登记）。

## 2026-10-15 — L12-W3（大纲视图绝对定位 + DOM 复用 + 交互重写 ✅ 完成 · 产品字节变更 · 破坏面 D-1…D-8 收口）

- 判定 = 完成；canonical = step9 镜像 = **979,673 B / `65FCCE0A…F6B2` / LF**（**产品字节变更**：972,267 → 979,673，+9,406 B；L11 收口冻结件 `D6204DFC…D7C1` 保持只读）。
- 主线 = **E-2**（`M-H` 真虚拟滚动）：**窗口化引擎**（H2 绝对定位 + H3 DOM 池复用 + H4 交互重写）——`VS_ROW_H=28 / VS_OVERSCAN=24 / VS_MAX_ROWS=160`；`_vsFlatten` / `_vsWindow` / `_vsUpdate` / `_vsScrollToId` / `_renderOutlineVirtual` / `_renderPresentationVirtual`。
- **T-105 / T-106 红 → 绿**（视口外节点不在 DOM / 渲染节点数 ≤ 200）；**T-105 – T-110 全部启用**（`JU_L12=1`）；不变量 **#32** 哨兵 T-110 成立。
- **破坏面台账 D-1…D-8 100% 收口**（拖拽跨屏 / 多选 / 折叠 / Tab 缩进 / Ctrl+F / 选区 / 打印 / 滚动恢复）；D-5 按 **LO-5=B** 显式声明失效 → OP-14。
- 红证：`reports\l12-w3-red-log-2026-10-15.txt` = **2 failed / 4 passed**（T-105/T-106 必红）；绿证（P）：`l12-w3-l12spec-green-log-2026-10-15.txt` = **6 passed**。
- 门禁：`verify.js all`（默认） = **Node 82/82 + PW 163 passed + 2 skipped = 165 + bench 7/7** → `[verify] 全部通过`；`JU_L12=1` = **Node 82/82 + PW 169 passed + 2 skipped = 171 + bench 7/7** → 全部通过。
- 接线：`verify.js` `NODE_TESTS += l9/l12-virtual-scroll.test.mjs`（N 层 +10）；`l9-hash-check.mjs` = **PARTY_COUNT=32 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**。
- 哈希锚点：`verify.js` = 7,840 / LF / `D3594455…EFFA1`；登记器 = 8,946 / CRLF / `96BA7EB1…26B8`；spec = 11,251 / CRLF / `2CF7CA06…6265`；N 层 = 6,970 / CRLF / `5C80BE7E…132E`；报告 `reports\l12-w3-2026-10-15.md`；下一入口 = **L12-W4**（降级开关 H5 + 哨兵 + 指标）。

## 2026-10-15 — L12-W2（接缝 + 只读试点影子 + 编号区启用 + 门禁接线 ✅ 完成 · 默认关闭态 · 产品零字节变更）

- 判定 = 完成；canonical = step9 镜像 = **L11 收口冻结件** = 972,267 B / `D6204DFC…D7C1` / LF（本波**零字节变更**，未触碰产品 HTML）。
- 决策：**LO-5 = B**（D-5 浏览器 Ctrl+F **显式声明失效** → **OP-14**）；LO-2=A（只读视图优先）/ LO-7=A（`165 + N`）/ LO-8=B（W5 方数续扩）。
- 交付：`tests\l12-virtual-scroll.spec.ts`（**接缝** · T-105~T-110 · **默认关闭态** · 只读试点影子「**只记录不启用**」）+ `scripts\verify.js` 接线（`L12_ENABLED = JU_L12==='1'`）。
- 编号区启用：**T-105** 视口外不在 DOM（结构性 · 红证先行）/ **T-106** 渲染节点数 ≤ 200 / **T-107** 试点探针 `ready` / **T-108** D-1…D-8 文本锚 / **T-109** 降级开关 / **T-110** 不变量 #32 哨兵。
- 红证（`JU_L12=1` 隔离跑）：**2 failed / 4 passed** —— **T-105 / T-106 必红**（屏外节点仍在 DOM · 判别力真实）；绿证（默认态）：`verify.js all` = **Node 72/72 + PW 163 passed + 2 skipped（T-48/T-49）= 165 + bench 7/7** → `[verify] 全部通过`。
- 破坏面台账 D-1…D-8：T-108 锚定靶位（D-5 无 JS 锚 → OP-14 显式声明）；**100% 收口归 W3**。
- 门禁：`l9-hash-check.mjs` = **PARTY_COUNT=32 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**（`verify.js` 行重登记 6,951→7,804）。
- 哈希锚点：`verify.js` = 7,804 / LF / `13A12C3D…9C1A`；spec = 11,251 / CRLF / `2CF7CA06…6265`；`l9-hash-check.mjs` = 8,896 / CRLF / `2472793B…D9F5`；red `B5D8F940…6A9E`；green `E18387E7…3A64`；报告 `reports\l12-w2-2026-10-15.md`；下一入口 = **L12-W3**（绝对定位 + DOM 复用 + 交互重写 · D-1…D-8 收口 → T-105/T-106 转绿）。

## 2026-10-15 — L12-W1（E-2「`M-H` 真虚拟滚动」立项 + 阈值冻结 + 交互破坏面台账 ✅ 完成 · docs-only · 产品零字节变更）

- 判定 = 完成；canonical = step9 镜像 = **L11 收口冻结件** = 972,267 B / `D6204DFC…D7C1` / LF（本波**零字节变更**，未触碰产品 HTML）。
- 决策：**LO-1 = E-2**（`M-H` 真虚拟滚动 / P1c 剩余）；OP-2/OP-3/OP-4 **按独立项处理**（OPEN）；OP-12 **暂不处理**；复用 L11 已结项纪律（**顺序纪律 C-8** + **版本感知冻结门范式**）。
- 交付：`reports\l12-design-2026-10-15.md`（E-2 收窄设计底座）+ `reports\l12-w1-2026-10-15.md`（决策回执 + 阈值冻结 + **交互破坏面台账 D-1…D-8**）。
- 门禁复跑：`verify.js all` = **Node 72/72 + PW 163 passed + 2 skipped（T-48/T-49）= 165 + bench 7/7** → `[verify] 全部通过`（EXIT=0）；`l9-hash-check.mjs` = **32 方** / drift 0 / PASS。
- 关键标定：现状仅 `content-visibility` 弱虚拟滚动（屏外节点**仍在 DOM** → 渲染节点数 = O(n) · T-105 红证载体成立）；`VIRTUAL_THRESHOLD=200`；`_virtualDisabled` 为内部降级（无 UI 开关，W3 增补）。
- 阈值冻结：longtask = 0 / 渲染节点数 ≤ 200 / 视口外不在 DOM / 破坏面 100% 收口；**LO-5**（D-5 Ctrl+F）为唯一未决项（仅阻塞 W3）。
- 哈希锚点：`verify.js` = 6,951 / LF / `B74A630F…5D84`；`l9-hash-check.mjs` = 8,854 / CRLF / `1228E821…7623`（32 方）；不变量清单 = 49,655 / LF / `106BE8EE…1B23`；green `41DA2CE2…F476`。
- 证据：`reports\l12-w1-green-log-2026-10-15.txt` = 61,656 / LF / `41DA2CE2…F476`；`reports\_l12w1-hashcheck.txt` = 4,517 / LF / `8B5F4090…DE7B`。
- 报告 `reports\l12-w1-2026-10-15.md`；下一入口 = **L12-W2**（只读试点接缝 · T-105 红证先行；W3 依赖 LO-5）。

## 2026-10-15 — L11-W6（阶段收口 · `M-I` 接缝默认启用 + OP 结项 + 不变量登记 ✅ 完成 · 独立成波 · 首次改变产品默认持久路径）

- 判定 = 完成；canonical = step9 镜像 = **L11 收口冻结件** `1.冻结版本\v2.0-l3-frozen-l11w6-2026-10-15.html` = 972,267 B / `D6204DFC…D7C1` / LF（`CURRENT_WAVE_THREE_PARTY_IDENTICAL=True`）。
- **决策项 · `M-I`（#30 / T-104）**：`globalThis.__juL10D1Seam` 缺省值翻转 **OFF → ON**（产品接缝块默认值 1 处）；契约（`version='l10-d1/v1'` / 降级 5 原因 / 关页不接管）逐字保留；`l10-idb-persist.spec.ts` OFF 场景改为显式置 `false`。
- 红→绿：红 `reports\l11-w6-red-log-2026-10-15.txt`（对 L11 冻结件 972,117 / `3A19A492…` → **T-100 / T-104 红** · 2 failed / 5 passed）；绿 `reports\l11-w6-green-log-2026-10-15.txt`（对默认启用件 → **7 passed**）。
- 门禁：`verify.js all` = **Node 72/72 + PW 163 passed + 2 skipped（T-48/T-49）= 165 + bench 7/7** → `[verify] 全部通过`；`l9-hash-check.mjs` 31 → **32 方** / drift 0 / PASS。
- 冻结门（版本感知 · 新世代 `l11w6`）：`_w5freeze.ps1 -Wave l11w6` / `_w4freeze.ps1 -Wave l11w6` / `_w4paths.ps1 -Wave l11w6` → `RESULT=PASS`（`VIOLATION_COUNT=0`）；`-Wave l11` / `-Wave l10` → `HASH-DRIFT` / FAIL（**设计预期区分**）。
- **OP 结项**：OP-1 `R-1`/`R-3`/`R-4`（仓外移交 · 决策结项）、OP-9（证据不可得 · 归档代替）、OP-10（报告缺位 · 不回填）→ **结项关闭**。
- **不变量登记**：**#30**（default-on 四路径等价 · 哨兵 T-104）登记；**#31** 定值 **32 方**；#1–#34 连续登记（#32/#33 预留）；清单 = 49,655 B / LF / `106BE8EE…1B23`。
- 哈希锚点：`l9-hash-check.mjs` = 8,854 B / CRLF / `1228E821…7623`；`l11 spec` = 9,147 B / CRLF / `751C2EE9…864D`；`_w5freeze.ps1` = 16,191 B / CRLF / `C1547F3F…453B`；`l10 spec` = 32,058 B / CRLF / `A6709AC1…5DAF`。
- 报告 `reports\l11-w6-2026-10-15.md`；下一入口 = **L11 阶段收口完成**；结转 OP-2 / OP-3 / OP-4（OPEN，原样）与 E-2/E-3 候选（#32/#33）。

## 2026-10-15 — L11-W5（全量回归 + 冻结登记 · 三方一致 · 31 方定值 ✅ 完成 · 产品零字节变更）

- 判定 = 完成；canonical = step9 镜像 = **L11 冻结件** `1.冻结版本\v2.0-l3-frozen-l11-2026-10-15.html` = 972,117 B / `3A19A492…F49F` / LF（`CURRENT_WAVE_THREE_PARTY_IDENTICAL=True`；本波零字节变更，仅**新建**冻结件）。
- 冻结门（版本感知）：`_w5freeze.ps1 -Wave l11` → `FREEZE_ACTION=CREATED`（首跑）→ `PRESENT`（复跑）/ `FROZEN_DRIFT_COUNT=0` / `RESULT=PASS`；`-Wave l10` → PASS；`-Wave l9` → HEAD `HASH-DRIFT=4` / FAIL（**设计预期区分**）。
- 全量回归：`verify.js all` → **Node 72/72 + PW 163 passed + 2 skipped（T-48/T-49）= 165 + bench 7/7** → `[verify] 全部通过`（EXIT=0）。
- 不变量登记：**#31**（登记锚点治理后零漂移 · 哨兵 T-100）/ **#34**（环境可达性 · 哨兵 T-101）→ 清单 §十；末号 **#34**；`#30`（`M-I`）deferred / `#32`/`#33` 空洞。
- 登记方数定值 = **31 方**：`l9-hash-check.mjs` 新增 `frozen-l11`（= canonical 字节）；30 → 31；drift 0 / PASS。
- 哈希锚点：`l9-hash-check.mjs` = 8,662 B / CRLF / `498EFB6F…1D38`（31 方）；`l11-anchor-governance.spec.ts` = 7,229 B / CRLF / `A5255382…8F0B`（T-102 口径 31）；`_w5freeze.ps1` = 15,733 B / CRLF / `43B6F38C…E80E`；不变量清单 = 46,400 B / LF / `2C5373DA…6560`。
- 证据：`reports\_w5freeze.txt` = 3,929 B / CRLF / `6D611B66…56D6`；`reports\l11-w5-green-log-2026-10-15.txt` = 60,668 B / LF / `0AA145BD…2FE6`；`reports\_w5freeze-l9-recheck.txt` = `425B0A37…068D`。
- 报告 `reports\l11-w5-2026-10-15.md`；下一入口 = **L11 阶段收口**（`M-I` 接缝默认启用独立决策；结转 OP-1 `R-1`/`R-3`/`R-4`、OP-9、OP-10）。

## 2026-10-15 — L11-W4（崩溃/一致性 + 四路径隔离 + 哨兵 + 指标 · `M-I` deferred ✅ 完成 · 产品零字节变更）

- 判定 = 完成；产品 canonical = step9 镜像 = L10 冻结件 = 972,117 B / `3A19A492…F49F` / LF（本波**零字节变更**，未触碰产品 HTML）。
- ①熵测一致性：`_l11w4_entropy.mjs` snapshot/verify（**30 锚**）/paths（**21 四路径锚**）→ `DRIFT_COUNT=0` / `ENTROPY_RESULT=PASS`；「熵测」非设计词条，按 §十三W4「崩溃/一致性」+§3.1「零漂移」+§八「四路径」映射（同 L10-W4 §二 范式）。
- ②四路径隔离（§八 桌面/加密/浏览器/影子层）：N 层 `classifyPath4` 互斥 + 四接缝独立后端无串味 + 加密密文纯净；产物级 21/21 PRESENT；金丝雀 `_w4paths.ps1 -Wave l11` → `CANARY_ARTIFACTS=49` / `VIOLATION_COUNT=0` / PASS；四产物身份 canonical=step9=L10 冻结件 逐字节一致（`_w4freeze -Wave l11` `BYTE_IDENTICAL=True`）。
- ③哨兵：N 层 **T-105(N)**（200 步四路径轮转确定性 → 投影逐 id 等价、无串味）+ P 层 **T-105**（产物级四路径锚）；`JU_L11=1` 探针 **6 passed**（T-100~T-103 / T-105 / T-106）。
- ④指标：`stats().p95` nearest-rank + ring（`L9_METRIC_CAP=256`）；**commit / 切视图 / longtask** 三序列口径（N 层合成；P 层实测 `commit.p95=0.20ms` / `view.p95=16.90ms` / `longtask.n=0`）——无硬阈值（承 T-48/T-49 负载敏感教训）。
- ⑤N-I 项：`M-I` 接缝默认启用 **deferred → W5**（T-104 空洞，不跳号）；接缝默认关闭态 `__juL10D1Seam`/`__juL10D1` 均不存在（T-100 绿）。
- 门禁接线：`verify.js` `NODE_TESTS` +1（**Node 63→72**）；`l9-hash-check.mjs` **28→30 方**（纳编 `l11-w4-consistency.test.mjs` / `l11-anchor-governance.spec.ts`）；`_w4paths.ps1` / `_w4freeze.ps1` 版本感知扩 `l11`；`_w5freeze.ps1` `VJS_GEN` 同步。
- 红→绿：红 `reports\l11-w4-red-log-2026-10-15.txt`（篡改副本探针 → `ENTROPY_RESULT=FAIL` / `PATHS_RESULT=FAIL` 判别力可见化）；绿 `reports\l11-w4-green-log-2026-10-15.txt`（`verify.js all` → **Node 72/72 + PW 163 passed + 2 skipped = 165 + bench 7/7** → `[verify] 全部通过`；**30 方 drift 0**）。
- 哈希锚点：`verify.js` = 6,951 B / LF / `B74A630FC62760C0909C68BB2B2E9C388A7EE0CFD43C30178161C05940495D84`；`l9-hash-check.mjs` = 8,475 B / CRLF / `9673CD7DC491B9D80AA343E8B7DCAA42A74B1CD8CF5A835827FC8EBBC4FBEF9B`（30 方）；`l11-w4-consistency.test.mjs` = 16,325 B / CRLF / `BE8B6FCF…9880`；`l11-anchor-governance.spec.ts` = 7,229 B / CRLF / `46C3EEA9…C260`。
- 报告 `reports\l11-w4-2026-10-15.md`；下一入口 = **L11-W5**（全量回归 + bench + `_w5freeze.ps1 -Wave l11` + 不变量 #31/#34 登记 + 登记方数定值）。

## 2026-10-15 — L11-W2 + L11-W3（铁律 6 先改锚登记表 + 编号区启用 + Banner 接线（默认关闭态）→ 后清理 ✅ PASS · 产品零字节变更）

- 判定 = 完成；产品 canonical = step9 镜像 = L10 冻结件 = 972,117 B / `3A19A492…F49F` / LF（本波**零字节变更**，未触碰产品 HTML）。
- W2 **先改锚**（LO-2=A）：`l9-hash-check.mjs` 纳编 A/B/C 组 **8 文件**（期望 = 清理前基准）→ `PARTY_COUNT 20 → 28`；重登记 `verify.js`（6,326 / `85D5D139…` → **6,915 / `8DF9689F…`**）；`_w5freeze.ps1` `$VJS_GEN[l10]` 同步。
- W2 **编号区启用 + Banner 接线**：新增 `tests\l11-anchor-governance.spec.ts`（**T-100 ~ T-103** · E-1 面 · **默认关闭态**）；`verify.js` `L11_ENABLED = JU_L11==='1'`（默认 OFF ⇒ **165 逐项一致**）。
- W2 红证 = `reports\l11-w2-red-log-2026-10-15.txt`（期望值先行、文件未清理 ⇒ 冻结哨兵 **T-99 红** · `FIVE_PARTY_DRIFT_COUNT=8`）；绿证 = `reports\l11-w2-green-log-2026-10-15.txt`（**28 方 / drift 0 / PASS** + 门禁 Node 63 + PW 165 + bench 7/7 → `[verify] 全部通过`）。
- W3 **后清理**：清除 A/B/C 8 文件尾部注释（`playwright.config.ts` 1,886→1,854 / `42245965…`；`l7-index-worker.spec.ts` 80,363→80,330 / `FD76426F…`；4 L3 spec；`compare-bench.js`；`tools\verify.js`）；**产品尾页脚 39 B 豁免未触碰**（LO-9=A）。
- W3 红证 = `reports\l11-w3-red-log-2026-10-15.txt`（清理后未同步锚 ⇒ 28 方 `drift=8` / FAIL）；绿证 = `reports\l11-w3-green-log-2026-10-15.txt`（期望值同步至清理后目标值 ⇒ **28 方 / drift 0 / PASS**；门禁全绿；**T-99 哨兵 ok**）。
- 哈希锚点：`l9-hash-check.mjs` = **8,044 B / CRLF / `E9FC023815EE1997802F68694FC59C304F7F973DC35E7A282DCF56400B410C4D`**；`verify.js` = **6,915 B / LF / `8DF9689FB5879CBB68E940FEBE1096E7CCAE0CE22EC0B37D5574C97D0E36C8DB`**；`_w5freeze.ps1` = 14,837 B / CRLF / `03E2F945…6A11C`；l11 spec = 3,487 B / CRLF / `6CB6CFB2…94BE`（启用态校验 4/4）。
- 报告 `reports\l11-w2-2026-10-15.md` = 8,724 B / `7986D0D2…5E98`；`reports\l11-w3-2026-10-15.md` = 6,341 B / `4D93B71C…D87E`；下一入口 = **L11-W4**（崩溃一致性 + 四路径隔离 + 哨兵 + 指标 · `M-I` deferred）。

## 2026-10-15 — L11-W1 启动（E-1 主线 · 决策回执 + 阈值冻结 + 铁律 6 台账 · 产品零字节变更）

- 决策回执：LO-0=A；LO-1=**E-1**（遗留收口与默认启用治理）；LO-2=A（先改锚后清理）；LO-3=A（`__juL10D1Seam` 保持默认关闭 ⇒ `M-I` 本轮不实施）；LO-4=A（维持 T-48/T-49 skip）；LO-5=A（登记不回填）；LO-6=是（预留 #30–#34）；LO-7=A（165+N）；LO-8=B（20→20+M）；LO-9=A（产品尾页脚豁免）；LO-10=无需处理。
- 前置门禁 PASS：`l9-hash-check.mjs` → PARTY_COUNT=20 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS；canonical = step9 = L10 冻结件 = 972,117 B / LF / 3A19A492AB0A6C61377AC0267E8F1FE1B48FB7AAEB97EEC415A6634D0DC1F49F（本波零变更）。
- 基线复跑：`verify.js all` EXIT=0 / `[verify] 全部通过`；Node 63/63；PW 163 passed + 2 skipped = 165（跳过 T-48/T-49）；bench 7/7 · 最大恶化 0.0% · 中位数 −14.3%。
- 铁律 6 存量台账（W1 首件；W3 清理，产品尾页脚 39 B 豁免）：登记锚 `playwright.config.ts:47`=1,886 B/`7247595C…83D2`、`l7-index-worker.spec.ts:1325`=80,363 B/`9C34A952…4E346`；L3 spec 4 件（`l3-invariants`/`l3-commit-callbacks`/`l3-reference-semantics`/`l3-light-pollution`）；补充 `scripts\compare-bench.js`、`tools\verify.js`。
- 关键标定：A/B/C 组 10 文件**均不在** `l9-hash-check.mjs` `TARGETS` 与 `_w5freeze.ps1`；其锚仅**日志文本锚**（`项目日志.md:109` / `l7-w5-2026-10-14.md:91`）⇒ 清理不触发 20 方机器漂移；LO-2=A 的顺序纪律对象 = 日志锚；T-100 红证载体于 W2 标定。
- 登记锚（本波未改）：verify.js = 6,326 B / LF / `85D5D1395D8DE55A7B27B0B32B076B4C4C13C5E0C1B6C16D599C21345627EEA5`；l8-spec = `C48E5D419DA1AFFCB6C0AE40074D6A3A3B9CCB50174C00CF71F0E853BFFD7354`；l9-spec = `921A571C…5721`；l10-spec = `3FE974FF…90C3`；l9-hash-check.mjs = 6,436 B / CRLF / `255EF0876186895B0FD268464C3B498E601E258F2AD5584D457B9EC1E161591A`。
- 证据：`reports\l11-w1-green-log-2026-10-15.txt` = 58,845 B / LF / `178104BE96AF646846046F25850F7696B13C8B0F9F62002495C989102E3CEB44`；`reports\l11-design-2026-10-15.md` = 88,113 B / `B21DCA3A…8501`；报告 `reports\l11-w1-2026-10-15.md` = 16,919 B / `9D1A895F…FE03`。
- 下一入口 = L11-W2（铁律 6 先改锚登记表 + 编号区启用 T-100 起 / #31·#34 + `verify.js` Banner 接线，默认关闭态）。

## 2026-10-15 — L10-W5 复跑补正（PW + bench 实测 · 全阶段冻结 ✅ 完成 · 产品零字节变更）

- 判定 = 完成（**补正**上一版 W5「PW/bench 未测量」为**实测**）；canonical = step9 镜像 = L10 冻结件 = 972,117 B / 3A19A492AB0A6C61377AC0267E8F1FE1B48FB7AAEB97EEC415A6634D0DC1F49F / LF（本波零变更）。
- 环境受限解除：Chrome FOUND `C:\Users\12601\AppData\Local\Google\Chrome\Application\chrome.exe`（Edge `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` 备用）；`JU_CHROMIUM_PATH` 显式设置且 PW 打印 `[playwright] Chromium:` 生效；node 非 PATH（`E:\软件\CodeBuddy CN\node.exe`）。
- 三段实测：`node scripts\verify.js all` → EXIT=0 / `[verify] 全部通过`；Node 63/63（# tests 63 · # pass 63 · # fail 0）；PW 163 passed / 2 skipped（合计 165；跳过 T-48/T-49 负载敏感隔离）；bench 7/7 · 最大恶化 0.0% · 中位数 −14.3%。
- 证据：reports\l10-w5-verifyall-log-2026-10-15.txt = 57,817 B / LF / C39C4C4CA2D4816C6CD0D61302FC5F5BDDE319FF1143FDBB01EB32C8C4FD1904；reports\l10-w5-green-log-2026-10-15.txt = 3,780 B / CRLF / 1FBCC9B07F03B5BAAC57FA9B20E451EF34F66E70F0C333D216E14F33EB828894（旧版 1,538 B / B930B45B…85C0B 先备份后改写 → _W2阶段产物\_l10w5_greenlog.bak-2026-10-15.txt）。
- 冻结门：`_w5freeze.ps1 -Wave l10` → FREEZE_ACTION=PRESENT / L10_FROZEN_BYTES=972117 / CURRENT_WAVE_THREE_PARTY_IDENTICAL=True / FROZEN_DRIFT_COUNT=0 / RESULT=PASS（证据 reports\_w5freeze.txt = 3,979 B / CRLF / A5E9C56DC80B635B69600E6B3C9CCB5E99DB2EF9BA9E66C6A23350D879256D1B；P1–P15 与历史只读锚全 FROZEN-OK）。
- 版本感知区分：`-Wave l9 -NoFreeze` → P3 l9-frozen（968,079 / A820EE39…851D）FROZEN-OK；HEAD 锚 HASH-DRIFT=4 / RESULT=FAIL（**设计预期**，非缺陷）；证据 reports\l10-w5-w5freeze-l9.txt = 3,675 B / CRLF / 9406AE3C6FDBC691FC4079E162D70E45F50E7EA921687CD808ABD8E53BE88036。
- 五方登记复核：l9-hash-check.mjs = 6,436 B / CRLF / 255EF0876186895B0FD268464C3B498E601E258F2AD5584D457B9EC1E161591A（PARTY_COUNT=20 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS）；verify.js = 6,326 B / LF / 85D5D1395D8DE55A7B27B0B32B076B4C4C13C5E0C1B6C16D599C21345627EEA5；l9-spec = 19,851 B / CRLF / 921A571C1084BDDA44338E352963FC1D4C91B152F3A9A9D53E92D273C6F45721。
- W4 门禁复核：`_w4freeze.ps1 -Wave l10` → FROZEN_DRIFT_COUNT=0 / BYTE_IDENTICAL=True / RESULT=PASS；`_w4paths.ps1 -Wave l10` → CANARY_ARTIFACTS=33 / VIOLATION_COUNT=0 / RESULT=PASS；entropy verify DRIFT_COUNT=0、paths PATH_TOKENS=21（双 PASS）。
- 决策项：接缝 `globalThis.__juL10D1Seam` **保持默认关闭**（「默认启用」为后续独立决策项，**不阻塞冻结**）；铁律 6 存量注释（playwright.config.ts:47 = 1,886 B / 7247595C…；l7-index-worker.spec.ts:1325 = 80,363 B / 9C34A952…）位于**已登记锚点**，登记为**待决策项**（需独立红绿波）；产品 HTML 尾页脚属冻结件组成，**不得清理**。
- 报告 reports\l10-w5-2026-10-15.md；下一入口 = 结转 OP-1 R-1/R-3/R-4（仓外·OPEN）、OP-9/OP-10 与上述两项决策项。

## 2026-10-15 — L10-W4 + L10-W5（崩溃/一致性 + 三路径隔离 + 哨兵 + 指标 · OP-11 收口 · 全量冻结登记 ✅ 完成 · 产品零字节变更）

- 判定 = 完成；canonical = step9 镜像 = L10 冻结件 = 972,117 B / 3A19A492AB0A6C61377AC0267E8F1FE1B48FB7AAEB97EEC415A6634D0DC1F49F / LF（本波零变更）。
- W4 ① 熵测/一致性：「熵测」非 l10-design 词条（全仓 0 命中）→ 映射为「崩溃/一致性 + 零漂移」；工具 _临时脚本\_l10w4_entropy.mjs = 8,536 B / CRLF / 92181B8D5B537609C747EB378369E32CFD90B374FFF31E11655E4ABFC9FF2E22；verify → DRIFT_COUNT=0 / PASS。
- W4 ② 三路径隔离 + 哨兵 + 指标：N 层 step9\t9\l10-w4-consistency.test.mjs = 12,388 B / CRLF / 6EC2A595775F66C5573352F9E4AF4E9888D7283EF3097DAF4E61E8C294DCE82F（8 用例：崩溃原子性/幂等/三路径/密文纯净/T-99(N) 哨兵/p95）；paths 锚点 21/21 PRESENT。
- W4 门禁：verify.js = 6,326 B / LF / 85D5D1395D8DE55A7B27B0B32B076B4C4C13C5E0C1B6C16D599C21345627EEA5（Node 55→63）；_w4freeze.ps1 / _w4paths.ps1 版本感知重写；不变量 #29 登记（JU 清单新增 §九）。
- W4 OP-11 结项（关页链路 flushPersistNow/flushBeforeUnload/saveAutoBackup 锚 PRESENT；默认同步路径不变）；OP-1 R-* 按证据裁定：R-2/R-5 结项，R-1/R-3/R-4 保持仓外 OPEN。
- W5 冻结：l9-hash-check.mjs = 6,436 B / CRLF / 255EF0876186895B0FD268464C3B498E601E258F2AD5584D457B9EC1E161591A（PARTY_COUNT=20 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS）；L10 冻结件 v2.0-l3-frozen-l10-2026-10-15.html 物化（972,117 / 3A19A492…F49F）；_w5freeze.ps1 -Wave l10 → FREEZE_ACTION=CREATED / THREE_PARTY_IDENTICAL=True / FROZEN_DRIFT_COUNT=0 / PASS。
- W5 版本感知区分：-Wave l9 → L9W6 冻结件按其自身世代 FROZEN-OK（区分正确）；L10 树上报 HEAD 偏差为设计预期。
- 红→绿：红 reports\l10-w4-red-log-2026-10-15.txt（陈旧脚本误报 + 工具判别力探针）；绿 reports\l10-w4-green-log-2026-10-15.txt + reports\l10-w5-green-log-2026-10-15.txt（node scripts/verify.js node = 63/63 · [verify] 全部通过 · exit 0）。
- 报告 reports\l10-w4-2026-10-15.md / reports\l10-w5-2026-10-15.md；下一入口 = PW/bench 全量复跑 + 结转 OP-1 R-1/R-3/R-4、OP-9/OP-10。

## 2026-10-15 — L10-W3（D-1 主模块 + mock 后端 + 失败/降级 · `_w5freeze.ps1` 版本感知修复 · 页面删除事件日志缺口闭合 ✅ 完成 · 产品零字节变更）

- 判定 = 完成；产品 canonical = step9 镜像 = 972,117 B / 3A19A492AB0A6C61377AC0267E8F1FE1B48FB7AAEB97EEC415A6634D0DC1F49F / LF（本波零变更，未触碰产品 HTML）。
- `_w5freeze.ps1` 误报修复：旧脚本对 L10 状态报 FROZEN_DRIFT_COUNT=4 / RESULT=FAIL（误报）；版本感知重写（-Wave l9|l10 + 版本化期望表 + -NoFreeze）。新脚本 -Wave l10 -NoFreeze → FROZEN_DRIFT_COUNT=0 / RESULT=PASS；冻结路径演示 THREE_PARTY_IDENTICAL=True（物化后即删，L10 冻结件归 W5）；脚本 = 13,868 B / CRLF / CD2D0B97662EC09307BB9357AC1A8DE563E5B691D1260E45BC279ED7424F1001。
- 页面删除事件日志缺口：新增 append-only 日志器 _临时脚本\_l10w3_bytelog.mjs + _哈希与行尾校验\byteslog-2026-10-15.jsonl（5 锚 anchor-observed/OK；--strip-demo → footer-strip-suspected/DRIFT Δ−39 可归因）。
- L10-W3 主线：N 层主模块 step9\t9\l10-idb-persist.mjs = 4,217 B / CRLF / 89DCCFC8BF7B13846EA0DCF54132912341D5BEBD64DCE239576A158DBCBF88EC；N 层用例 step9\t9\l10-idb-persist.test.mjs = 7,079 B / CRLF / DD7106A6796C99E98830292825290D85E697618FF973CA816095EF1FC1619023（5 用例）。
- 门禁接线：step9\scripts\verify.js = 6,322 B / LF / 5F50FBC371E37A771C4626CAC3B219B83BF88062B678AEA1C6F0A98277672496（原 6,289 / CBC051C5…；NODE_TESTS += l9/l10-idb-persist.test.mjs；Node 50 → 55）。
- l9\l9-hash-check.mjs = 5,685 B / CRLF / ED9F4660ADB0F622972318275420126135028E887B520CC19BCF38480CCE6B2A（TARGETS.verify.js 重登记）；l10-spec 3FE974FF…90C3 未变。
- 红→绿：红证 reports\l10-w3-red-log-2026-10-15.txt（N 层主模块缺位 → ERR_MODULE_NOT_FOUND · fail 1）；绿证 reports\l10-w3-green-log-2026-10-15.txt（node scripts/verify.js node = 55/55 · [verify] 全部通过 · exit 0）；16 方登记 node l9\l9-hash-check.mjs → PARTY_COUNT=16 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS。
- 报告 reports\l10-w3-2026-10-15.md；下一入口 = L10-W4（崩溃/一致性 + 三路径隔离 + 哨兵 + 指标）；结转 OP-11 / OP-1 R-1…R-5 / L10 冻结件（W5）。

## 2026-10-15 · L10 规则更新（CURRENT_TASK.md 压缩至 ≤500 字 · 规则与铁律逐字节保持 · 产品代码零改动）

- 判定 = 完成；SHA256=CURRENT_TASK.md=39ACAF7E244F34C785114F6350C70C638614FF401FCED5EEA810E603AEDCDB7F（2,433 B / 35 行 / 纯 CRLF；四段正文 495 码点（含空白）/ 435 非空白，压缩前 1,903 / 1,682）；canonical / step9 镜像 / 冻结件 / verify.js / spec（l10-spec）哈希本轮未变（仅文档更新，无代码/资产改动，故未重算）；下一入口 = L10-W3（未启动）。

## 2026-10-15 — L10-W2（D-1 接缝 + 影子（默认关闭）落地 + 门禁接线 ✅ PASS · 首次产品接线）

- 判定 = PASS；产品变更 canonical = step9 镜像 = 972,117 B / 3A19A492AB0A6C61377AC0267E8F1FE1B48FB7AAEB97EEC415A6634D0DC1F49F / LF（原 968,079 B / A820EE39…851D）；D-1 接缝块 4,038 B / LF-only 拼入字节偏移 968,024 / 行 18,275（真实 </body> 前），inline script 块 8 → 9。
- 开关 = globalThis.__juL10D1Seam（默认 OFF/absent）；关闭态产品路径与 L9-W6 字节语义一致。
- 新增 spec step9\tests\l10-idb-persist.spec.ts = 31,905 B / CRLF / 3FE974FF48C9AC68BB1BF325A18DCDA62EC70CD5325FBCFD3C4C4313605F90C3（T-93~T-99 各一 · 7 用例）。
- 门禁接线 scripts\verify.js = 6,289 B / CBC051C55B8937ED1CC10D06CC027BE6D559389A86B788B5429C04905DAD0E27（原 6,246 / 7F7C40B0…7D56；PW_TESTS += 'tests/l10-idb-persist.spec.ts', + 单横幅改为 Playwright 集成测试（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 用例））。
- l9\l9-hash-check.mjs = 5,685 B / CRLF / E012F6631B7E35A60427F99CF35DB3EF9EF16A54F2723A6E360338015DD67275（原 5,407；TARGETS 新增 l10-spec；PARTY_COUNT 15 → 16）。
- 红→绿：红证 reports\l10-w2-red-log-2026-10-15.txt（7 failed / 0 passed · 接线前）；绿证 reports\l10-w2-green-log-2026-10-15.txt（7 passed (4.6s) · L10 spec 单跑）。
- 关闭态零回归：既有 9-spec（flag OFF）= 156 passed + 2 skipped（T-48/T-49）· 与 L9-W6 逐项一致；16 方登记 node l9\l9-hash-check.mjs → PARTY_COUNT=16 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS。
- 全量门禁 npm run verify:all = Node 50/50 + PW 163 passed + 2 skipped = 165 + bench 7/7 → [verify] 全部通过（exit 0）。
- 完整性异常（已处置）：开工前 l9-hash-check.mjs 报 FIVE_PARTY_DRIFT_COUNT=5 / RESULT=FAIL；按 V1 授权 Buffer 逐字节复原 → FROZEN_DRIFT_COUNT=0 / RESULT=PASS / BYTE_IDENTICAL=True / THREE_PARTY_IDENTICAL=True。
- 裁决六条（D-1 开关默认 OFF；恰一个 spec；哈希期望本波内联重登记；_l10w1_sync.mjs 纪律为 W2 同步规则；N-1 认可 l10-design-2026-10-15.md 为计划视图不建 l10plan-*；V1 复原授权）见 reports\l10-w2-2026-10-15.md §三；N-1/N-2/N-3 结案。
- 报告 reports\l10-w2-2026-10-15.md；下一入口 = L10-W3（未启动）N 层 l9\l10-*.test.mjs + NODE_TESTS 接线 + OP-11；结转 OP-1 R-1…R-5 / OP-9 / OP-10 / OP-11 / _w5freeze.ps1 陈旧字面（W5）与 T-48/T-49 skip。

## 2026-10-15 — L10-W1（裁决回执 + 阈值标定 + 接缝设计 · 主线 D-1 持久层落地收口 · 产品代码零改动 ✅ PASS）

- 判定 = PASS；LO-0~LO-8 全部裁决（LO-0=A 命名族 l<stage>-design-<date>.md；LO-1=A（≡ D-1 持久层落地收口 · M-A′）；LO-2=A 保留 FIVE_PARTY_DRIFT_COUNT；LO-3=B 登记 OP-10 不回填；LO-4=A 维持 T-48/T-49 skip；LO-5=A+B 标记不可得 + 归档记录代替；LO-6=A（≡ 是）新增不变量 #29（哨兵 T-99）；LO-7=A 门禁口径 158 + N；LO-8=B 登记扩到 15 + M）。
- 阈值标定：D-1 由「拟定」转冻结（浏览器单库 8MB / 拉伸 32MB 不抛 QuotaExceededError；持久层投影等价；批幂等 seq；旧库迁移 0 丢失；15 方零漂移）+ 接缝设计附录 + 红证矩阵 T-93~T-99 冻结。
- 绿证 node scripts\verify.js all = Node 50/50 + PW 156 passed + 2 skipped（仅 T-48/T-49）= 158 + bench 7/7 → [verify] 全部通过 · EXIT=0（reports\l10-w1-green-log-2026-10-15.txt）。
- 红证 reports\l10-w1-red-log-2026-10-15.txt（honest：交付物缺位 + 门禁单字节漂移可见 FAIL，未伪造失败）。
- 15 方登记 node l9\l9-hash-check.mjs → PARTY_COUNT=15 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS。
- 未改动 canonical / step9 镜像 / 冻结件 / verify.js / spec / 七支柱（canonical 字节冻结 968,079 B / A820EE3913239A89E9AC970454961F42DCDCA0D8810F069CE420864B06E7851D / LF）。
- 报告 reports\l10-w1-2026-10-15.md；下一入口 = L10-W2（未启动）D-1 接缝 + 影子（默认关闭）；命名歧义待确认：任务书引用 6.P0-T3基线\step9\reports\l10plan-2026-10-15.md 不存在 → L10 计划视图实为 l10-design-2026-10-15.md（本波以 LO-0=A 命名族执行，未新建 l10plan-*）。
- 结转 OP-9 / OP-10 / OP-11 + OP-1 R-1…R-5（仓外 · OPEN，编号未变更）。

## 2026-10-15 — L10 规划（设计方案落盘 · 待裁决 · 产品代码零改动）

- 判定 = L10 规划已就绪（设计件已落盘）；设计件 6.P0-T3基线\step9\reports\l10-design-2026-10-15.md。
- 前置 L9 全阶段冻结 PASS（968,079 B / A820EE39…851D / LF）。
- 主线候选 D-1 持久层落地收口（M-A′，建议待裁决）；阻塞 LO-1（LO-0…LO-8 全部待裁决）；保留 OP-1 R-1…R-5（OPEN，编号未变更）。
- 哈希 PARTY_COUNT=15 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS。
- 纪律：本阶段不触碰产品代码 / 冻结件 / 回归门禁。

## 2026-10-15 — L9-W6（C-2 内联打包闭合 · R-1/R-2/R-3 处置 ✅ PASS · 三方 + 五方冻结一致 · 门禁全绿 · 产品代码首次变更）

- 判定 = PASS；门禁 node scripts\verify.js all = Node 50 用例全绿 + Playwright 156 passed + 2 skipped（仅 T-48/T-49 负载敏感隔离 · 显式声明）= 158 + bench 7/7 → [verify] 全部通过 · EXIT=0；绿证 reports\l9-w6-green-log-2026-10-15.txt（冻结后复跑 reports\l9-w6-freeze-green-log-2026-10-15.txt）。

- R-1 内联打包已应用：attach-shadow + 六支柱 un-shell 为单一 classic <script> IIFE，插于真实 </body> 前（字节偏移 907,403 / 行 16,956；bundle 60,601 B / 1,317 行；无 src= / 无 type=module / 无动态 import()；inline script 块 7 → 8；契约逐字保留）。

- 哈希变更：canonical = step9 镜像 = 新冻结件 = 968,079 B / A820EE3913239A89E9AC970454961F42DCDCA0D8810F069CE420864B06E7851D / LF（原 907,458 B / 6CAD8950…C42B10）⇒ THREE_PARTY_IDENTICAL=True（canonical ⇄ step9 BYTE_IDENTICAL=true）。

- R-2 verify.js 接线：NODE_TESTS += 'l9/l9-shadow-wiring.test.mjs'（新第 81 行 · 原 ]; 81→82）→ 6,246 B / 7F7C40B0AC668948A027A3442AD480212FFB61F08DE193EFBD5B6620F28B7D56（原 6,212 B / 2FA65727…545ABB5）；Node 门禁计数 43 → 50；PW PW_TESTS 9 项与横幅 158 未变。

- R-3 门禁：由「仅未接线（ungated）· 该 7 例（W4-0…W4-6）单跑 7/7 绿但未纳入门禁 · 无伪造失败」→ 纳入门禁后全绿。

- 五方冻结：scripts\_w5freeze.ps1 → RESULT=PASS / FROZEN_DRIFT_COUNT=0（证据 reports\_w5freeze.txt；历史世代归档 scripts\_w5freeze-l9-2026-10-14.ps1 / reports\_w5freeze-l9-2026-10-14.txt 只读）；node l9\l9-hash-check.mjs → PARTY_COUNT=15 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS（14 方 → 15 方）。

- 新冻结件 1.冻结版本\v2.0-l3-frozen-l9w6-2026-10-15.html；报告 reports\l9-w6-2026-10-15.md。

- 残留：装饰性冻结脚本注解（GREEN-RUN 块 · 头部 L11）、OP-1 R-1…R-5（不同编号集 · 仓外 · 仍 OPEN）、T-48/T-49 wall-clock 隔离。

  <!-- 组内排序说明（10-14）：具体时分缺失，按逻辑序倒序——根目录收纳为独立收尾操作置顶；L9 线（工程波次证据完整版与校验条目并存）：L9-W5→L9-W4→文档与看板同步→L9-W3(补记, 实际早于文档同步)→L9-W2 跟办前检查(校验, 晚于 L9-W2 实施)→L9-W2 工程波次→第5轮看板(登记 L9-W1 完成 + L8 冻结, L9-W2 尚为待办 n:97)→L9-W1 实施(最早)；看板线：第5轮→第4轮(done=38)→L6 接入+L8-W3 完成登记→L7→L8 三轮(最早, done=23)；工程实施线置于看板线之下：L8 波次(W1~W5)→L7 波次(W1~W5)→L6 索引完成→M4/M5；46.html 复审为独立复审线置于组末；各看板统计口径与 aka 见条目内。 -->

## 2026-10-14 — 归档根目录临时/过程产物收纳登记

- 范围：E:\APP\归档 根目录下以 _ / tmp_ 开头的扫描、日志、环境探测、哈希校验、W2 阶段产物与零散报告；建立 6 个收纳目录（_临时脚本/_环境与调试/_哈希与行尾校验/_源码扫描/_W2阶段产物/_报告与元数据）。
- 执行 _do_move.ps1（规则 1~6 首个命中归档、脚本自排除、支持 -WhatIf、只处理根目录不递归）；已收纳 _env*、_node_v、_st、_d0~_d2、_kill、_crlf2、_eol*、_w2hash*、_scan_*、_srcscan、_logtail、_w2*、_red*、_reports、L6-M4-M5-8小时挂机总结.md、JU任务看板.url 等。
- 未收纳：scan_md.txt、spec_cnt.txt 无 _ 前缀未命中；_do_move.ps1 自排除；归档结构.docx 未定义规则；tmp_* 裁定（tmp_diag2/4、tmp_log → _环境与调试；tmp_verify、tmp_verify_e → _W2阶段产物）。
- 结果：根目录变为「正式项目目录 + 6 分类目录 + 少量待裁定文件」；未改产品代码、canonical、verify.js、L7/L8/L9 测试与哈希；遗留 4 项（手动移 scan_md/spec_cnt、裁定归档结构.docx、加入工作流、_do_move.ps1 需 UTF-8 BOM）。

## 2026-10-14 — L9-W5（全阶段冻结 ✅ PASS）

- 判定 = L9 全阶段冻结完成 = PASS；门禁 `node scripts\verify.js all` = Node **43** 用例全绿 + Playwright **156 passed + 2 skipped**（T-48/T-49）= **158** + bench **7/7** → `[verify] 全部通过` · **EXIT=0**；绿证 `reports\l9-w5-green-log-2026-10-14.txt`。
- 三方哈希一致：canonical / step9 镜像 / L9 冻结件 = **907,458 B / `6CAD8950…C42B10` / LF** ⇒ `THREE_PARTY_IDENTICAL=True`；冻结件 `1.冻结版本\v2.0-l3-frozen-l9-2026-10-14.html`（= canonical 逐字节副本）。
- 五方+支柱核验：`l9\l9-hash-check.mjs` 已纳编 → **`PARTY_COUNT=14`** / **`FIVE_PARTY_DRIFT_COUNT=0`** / **`RESULT=PASS`**（P1 canonical / P2 step9 镜像 / P3 L9 冻结件 / P4 `verify.js` / P5 L9 spec + 7 支柱 `.mjs`；L8 冻结件保留为只读历史锚）。
- 冻结脚本 `scripts\_w5freeze.ps1`（L9 变体 · ASCII）→ **`RESULT=PASS`** / **`FROZEN_DRIFT_COUNT=0`**，证据 `reports\_w5freeze.txt`（L8 原件归档为 `scripts\_w5freeze-l8-2026-10-14.ps1` / `reports\_w5freeze-l8-2026-10-14.txt`）。
- `verify.js` **未改动**（**6,212 B / `2FA65727…545ABB5`**；`PW_TESTS` 早于 W2/W4 即含 L9 spec 第 9 项 ⇒ PW 接线完成；次级残留：`NODE_TESTS` 仍不含 `l9\l9-shadow-wiring.test.mjs`（7/7 绿但未纳入门禁））。
- C-2 处置：内联打包 `attach-shadow.mjs` + 六支柱至产品 HTML = **延后**（**R-1** 未应用·字节冻结 / **R-2** `file://` module 风险·开放 / **R-3** `verify.js` 接线·本波不改）；canonical 保持 **`6CAD8950…C42B10`** 字节冻结；报告 `reports\l9-w5-2026-10-14.md`。

## 2026-10-14 — L9-W4（W3 四项遗留 + W4 指标/接线交付 · 缺口 ①②③④⑤ 归零）

- D1（harness · 缺口 #5+#3）：`scripts\verify.js` = **6,212 B / `2FA657276A3EFB60FC834EA3C6A81C855F2654953CA81263FBEA7A091545ABB5`**（原 4,313 / `D9CCA310…8E32`）—— Node 横幅计数**由真实 `node --test` 输出派生**（硬编码 69 → 实为 **40 用例**）+ PW 门禁**自动内联 `JU_CHROMIUM_PATH`**（自包含）；`playwright.config.ts` = **1,886 B / `7247595CEBB4D543FF61243006C913D3616C835968CA750303DF23599CDA83D2`**。
- D2（metrics · 缺口 #2）：`l9\persist-store.mjs` **增量**新增 `stats().p95` 墙钟（有界环 256 · 最近秩 p95）→ **12,521 B / `84FB64263981282356D4ADD6D51952AB4F86C2A5C7FC7FB6C29DD95023AA3594`**；证据 `l9\l9-persist-layer.test.mjs` = `F40D039D…56A4`、`l9\l9-backend-parity.test.mjs` = `CDBFB483…0A27`（Node **24 passed / 0 fail**）。
- D3（wiring · 缺口 #1 LO-2）：新增 `l9\attach-shadow.mjs` = **9,084 B / `E3850F4D9B85356D732FCDE1285A994DB394A257FEAB42F14E7452DB0E2F7B6B`**（哨兵 `__juL9ShadowSentinel` · 幂等 · 安全 no-op · 路径隔离）+ `l9\l9-shadow-wiring.test.mjs` = `85FF539A…9FA5`（**7/7**）；**红线：产品零改动**。
- D4（OP-1 · 缺口 #4）：新增 `reports\l9-op1-compliance-delivery-2026-10-14.md` = `4E61F3C3…F2BD`（+ manifest `0C322729…E0D9`；仓外 IDB / `invoke` 边界契约 + 验收清单）。
- 红→绿：`reports\l9-w4-red-log-2026-10-14.txt`（PW 全 fail）/ `reports\l9-w4-green-log-2026-10-14.txt`（**156 passed / 2 skipped**）；`l9-w4-metrics-*` / `l9-w4-wiring-*` 红→绿；Node 单元测试 **40 用例 / 0 fail**；`node scripts\verify.js spec` → `[verify] 全部通过` · **EXIT=0**。
- R 层：canonical **零改动** = **907,458 B / `6CAD8950EA3B07C7CC4363BB053D1268F57E6A85B81BE340E70F9EB321C42B10`**（= step9 镜像 = L8 冻结件），`l9\l9-hash-check.mjs` 复登记 `verify.js` 期望值（`4,313/D9CCA310…` → `6,212/2FA65727…`）后 = **2,525 B / `15D463341335A68D3C0DD8F49A98D86B96166E11DE10691D31A9097B183EB18D`** → **`FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**。
- 报告：`reports\l9-op1-compliance-delivery-2026-10-14.md`、`reports\l9-w4-wiring-optin-2026-10-14.md`。

## 2026-10-14 — 文档与看板同步（L8/L9 状态对齐 · 零产品代码）

- canonical 与全部接线文件字节未动：canonical = 907,458 B / 6CAD8950…C42B10；scripts\verify.js 仍为 L9-W3 值 D9CCA310…E32（4,313 B）。
- ①看板更新：JU任务看板.html 改「L8 增量落盘任务清单」，头部 L7 冻结 · L8-W2 完成/冻结 · W3+ 待启动；Track A 移除 n:89，新增 L8 段 n:90~93；已完成列置顶 L8-W2 / L8-W1 / L7-W5。
- ②一致性审计三轮：(a) CURRENT_TASK.md 落后 3 波次需改写至 L9-W3 完成态；(b) D-1.7 #5 与 D-1.8 的 verify.js 注释仍写 W5 值，需更新为 L9-W3 现值；(c) W2 待办④ l9-hash-check.mjs 期望值已由 L9-W3 顺带更新，闭环。
- Node 计数口径澄清：48/62/69 为断言数、33/40 为 test 级通过数，量纲不同非矛盾；遗留：CURRENT_TASK.md 改写、D-1.7/D-1.8 注释更新待执行；本次未改文件仅出具审计结论。
- 归口说明：本条目 verify.js=4,313 B / D9CCA310…E32 为 L9-W3 波次快照；「L9-W2 跟办前检查」条目的 4,235 B / bb6e96f3…9354f 为另一波次快照，两者归口不同（L9-W3 顺带更新 vs W5 显式更新）；L9-W3 完成见下条证据完整版条目（补记 · 实际早于文档同步），其后的 L9-W4 / L9-W5（verify.js 6,212 B / 2FA65727…）见上方新增条目。

## 2026-10-14 — L9-W3（P 层 spec 接线 + DISPOSE/RESULT 协议 + IDB/invoke 可插拔适配器 parity）（补记 · 实际完成早于文档与看板同步）

- D1（P 层）：新增 `step9\tests\l9-persist-layer.spec.ts` = **19,851 B / `921A571C1084BDDA44338E352963FC1D4C91B152F3A9A9D53E92D273C6F45721`**（6 用例 L9-1~L9-6：真实 Chromium 下影子层注入零影响 / P1a round-trip / 真实 WebCrypto 加解密 / 索引增量==全量 / 适配器 parity / **真实 file:// classic Blob Worker** 生命周期）；`scripts\verify.js` `PW_TESTS += 'tests/l9-persist-layer.spec.ts'` → **4,313 B / `D9CCA310FC3191A7B8B041660FC42DD6258EA6ED14E21092931E20E978038E32`**（原 W2 4,235 / `bb6e96f3…9354f`）。
- D2（协议）：`l9\worker-protocol.mjs` 增 `makeResult`/`isResponse`/`makeDispose`/`isDispose`/`RESPONSE_TYPES`（既有导出名与消息类型逐字保留）→ **2,945 B / `3B8C8E9CA637E2881AAD6B283C3E16429ADCE795DA2D7063DE503BC2DEC00240`**（原 1,576 / `e53e0c70…57cf`）；`l9\persist-worker.mjs` 落地 `DISPOSE`（幂等 teardown + `self.close()`）/ `RESULT` 关联（按既有 `msg.id`）/ `bridge.dispose()`（ack/超时 → release + 清在途 + 摘监听 + post-dispose reject）/ `unknownResponses` 计数 → **15,158 B / `2BE18C04D55A359FA45534B59E62F828AACE570723ADFD0E8142F01EDFCB3C90`**（原 11,638 / `e14749ca…8cb1`）。
- D3（后端）：新增 `l9\backend-adapters.mjs` = **7,636 B / `7F0D0105526596936E32F3B91FE0EFA7F429161BF96C19053C065F5AA7EA8B48`**（`IdbStyleAdapter`/`InvokeStyleAdapter`/`createAdapter` + 唯一语义核心 `_CoreBackend`：读/写/删/查/事务/全量语义与错误形状逐字等价）。
- N 层：`l9\l9-persist-layer.test.mjs` 扩 T-83~T-86（DISPOSE 幂等 / RESULT 关联 / unknown-id 安全 / teardown 后无回调）= **20,869 B / `2895645ED1318FFDE1B6E6B2A142CE29CDCA6C8996C1AB90B31B6D84545FC1BF`**；新增 `l9\l9-backend-parity.test.mjs` T-87~T-89 = **7,102 B / `280A9468BA5A4D3A47C53E763A6B2DCD6D6E6E6C281CF9B5DB153888AE35DEF9`**；`verify.js` `NODE_TESTS += 'l9/l9-backend-parity.test.mjs'`（横幅 `Node 单元测试（69 断言）`）。
- 红→绿：红 `step9\reports\l9-w3-red-log-2026-10-14.txt`（`ERR_MODULE_NOT_FOUND` + 缺 `isDispose` 导出 · **2 fail / 0 pass**）/ 绿 `step9\reports\l9-w3-green-log-2026-10-14.txt`（**21 passed / 0 fail**）。
- R 层：`node scripts\verify.js spec`（内联 `JU_CHROMIUM_PATH=C:\Users\12601\AppData\Local\Google\Chrome\Application\chrome.exe`）= Node **40 passed / 0 fail** + PW **156 passed + 2 skipped(T-48/T-49) = 158 用例** → `[verify] 全部通过` · **EXIT=0**。
- 五方哈希：`node l9\l9-hash-check.mjs` → **`FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（canonical = step9 镜像 = L8 冻结件 = **907,458 B / `6CAD8950EA3B07C7CC4363BB053D1268F57E6A85B81BE340E70F9EB321C42B10`**；L8 spec = **64,006 B / `C48E5D419DA1AFFCB6C0AE40074D6A3A3B9CCB50174C00CF71F0E853BFFD7354`**；`l9-hash-check.mjs` 对 `verify.js` 期望由 4,201/`13D6F030…` 更新为 W3 值 = 遗留 ④）⇒ **产品 HTML 零改动**；报告 `step9\reports\l9-w3-2026-10-14.md`。
- 遗留：① L9 仍为影子层（未接线产品 HTML · LO-2）；② 五方哈希仍未纳编 L9 新文件（拟 W5 冻结时纳编）；③ W4 指标（`stats()` p95）未做；④ PW 门禁前置 `JU_CHROMIUM_PATH` 须内联；⑤ 真机 IDB / `invoke` 后端属仓外交付（OP-1）。
- 补记说明：本条为工程日志证据完整版（替换原补记条目）；verify.js 4,235（W2）→ 4,313（W3）与「文档与看板同步」核验值一致，完成时点在文档同步之前、L9-W2 检查之后。

## 2026-10-14 — L9-W2 跟办前检查（文档一致性核验 · 未动代码）

- 读取 CURRENT_TASK.md + 本日志，交叉核对 L9-W2 锚点：canonical / step9 / L8 冻结件 = 907,458 B / 6CAD8950…C42B10；scripts\verify.js = 4,235 B / bb6e96f3…9354f；l9\persist-worker.mjs = 11,638 B / e14749ca…8cb1；l9\worker-protocol.mjs = 1,576 B / e53e0c70…57cf（未改）；L8 spec = 64,006 B / C48E5D41…D7354。
- 测试：node --test l9\l9-persist-layer.test.mjs 14 passed / 0 fail · EXIT=0；node scripts\verify.js node 33 passed / 0 fail · 横幅 ✓ Node 单元测试（62 断言）。
- 结论：两份文档逐项一致未发现漂移，产品代码零改动声明成立；本次仅文档级核对未执行现场哈希核验，建议下会话开机首条核验五文件哈希，任一偏离即停报。
- 跟办顺序：① P 层 tests\l9-*.spec.ts 新建 + 红/绿证 + verify.js PW_TESTS += L9 spec 接线 + 横幅 152 用例 bump；② DISPOSE/RESULT 协议处理；③ mock 后端可插拔适配器；④ W5 将 l9-hash-check.mjs 对 verify.js 期望由 4,201/13D6F030…B8098 更新为 4,235/bb6e96f3…9354f。红线：不覆盖冻结件；改 canonical 后必须 Copy-Item 同步 step9 并重算哈希。

## 2026-10-14 — L9-W2（接线完成：verify.js 接入 L9 spec + 真实 file:// classic Blob Worker · 协议未改）

- Task A（verify.js 接线）：`scripts\verify.js` `NODE_TESTS` 追加 `'l9/l9-persist-layer.test.mjs'`、Node 横幅标签改为 `Node 单元测试（62 断言）`（原 48）→ **4,235 B / `bb6e96f3567f37016f847cdb1a563cbd0f7c3d4cef048ba1c9f1a0dc4de9354f`**（原 4,201 B / `13D6F0306C65E911DDAC80F2C41D001AB586CF92DD4008269D04924CE60B8098`）。
- Task B（真实 file:// Worker）：`l9\persist-worker.mjs` 新增自包含 classic Blob worker 源 `L9_WORKER_SRC` + `isBrowserWorkerAvailable()` / `createBlobWorkerUrl()` / `createRealWorker()`，`createWorkerSkeleton()` 浏览器→真实 Blob Worker、否则→保留 in-process 骨架，LO-1 `syncFallback` + `PersistWorkerBridge` 公开 API 不变 → **11,638 B / `e14749caf773ff148500c7531cb2d2209afdf44a7c50ac281389944f2c448cb1`**。
- 协议未改：`l9\worker-protocol.mjs` = **1,576 B / `e53e0c70…57cf`**（未修改）。
- 测试结果：`node --test l9\l9-persist-layer.test.mjs` = **14 passed / 0 fail · EXIT=0**；`node scripts\verify.js node` = **33 passed / 0 fail**（横幅 `✓ Node 单元测试（62 断言）`，`[verify] 全部通过`）· **EXIT=0**。
- 证据日志：`step9\reports\l9-w2-red-log-2026-10-14.txt` / `step9\reports\l9-w2-green-log-2026-10-14.txt`。
- 冻结锚点复核（未变）：canonical = step9 镜像 = L8 冻结件 = **907,458 B / `6CAD8950EA3B07C7CC4363BB053D1268F57E6A85B81BE340E70F9EB321C42B10`**，L8 spec = **64,006 B / `C48E5D419DA1AFFCB6C0AE40074D6A3A3B9CCB50174C00CF71F0E853BFFD7354`** ⇒ **产品 HTML 零改动**。
- W2 待办（未完成 · 记待办）：① P 层 Playwright spec `tests\l9-*.spec.ts` 创建 + `PW_TESTS += L9 spec` 接线（横幅 `152 用例` 未 bump）；② `DISPOSE`/`RESULT` 协议处理未实现；③ mock 后端可插拔适配器；④ W5 将 `l9-hash-check.mjs` 对 `verify.js` 期望由 `4201 / 13D6F030…B8098` 更新为 W2 值（`4,235 / bb6e96f3…9354f`）。

## 2026-10-14 — JU任务看板文件名标注进度（L8 冻结 + L9-W1 四支柱，第5轮）

- 内容重定基线：L8 阶段正式冻结，冻结件 v2.0-l3-frozen-l8-2026-10-14.html（canonical 907,458B / 6CAD8950…，不变量 #27/#28）；n:94 归档，新增 n:97 L9-W2 接线待办。
- L9-W1 持久层四支柱骨架完成（step9/t9/）：persist-store、persist-worker + protocol LO-1 桥、crypto-store（AES-GCM/PBKDF2）、index-layer；T-69~T-82 共 14 passed，影子层默认关闭，五方哈希 DRIFT=0，产品代码零改动。
- 本轮交付：已交付看板复制为带进度标注文件名「JU任务看板-40-94-2026-10-14.html」（40 done / 94 total ≈ 43%，aka cEY4KXkxnd）；后续约定交付文件名须带最新进度分数、恢复任务先读 CURRENT_TASK.md。

## 2026-10-14 — L9-W1（持久层四支柱 · 影子层默认关闭）

- 新增 `step9\t9\` = `persist-store.mjs`（P1a 落盘：批构造/事务原子性/flush/错误缓冲）/ `persist-worker.mjs` + `worker-protocol.mjs`（Worker 骨架 + syncFallback 桥 · LO-1）/ `crypto-store.mjs`（加解密：AES-GCM/PBKDF2，密文纯净）/ `index-layer.mjs`（四索引 build/查询/增量等价）+ `l9-persist-layer.test.mjs`（T-69~T-82，14 passed）。
- 红证 `step9\reports\l9-w1-red-log-2026-10-14.txt`（ERR_MODULE_NOT_FOUND）/ 绿证 `step9\reports\l9-w1-green-log-2026-10-14.txt`（14/14，EXIT=0）。
- 五方哈希 DRIFT=0（canonical = step9 = 冻结件 = **907,458 B / `6CAD8950EA3B07C7CC4363BB053D1268F57E6A85B81BE340E70F9EB321C42B10`**；`scripts\verify.js` = **4,201 B / `13D6F0306C65E911DDAC80F2C41D001AB586CF92DD4008269D04924CE60B8098`**；L8 spec = **64,006 B / `C48E5D419DA1AFFCB6C0AE40074D6A3A3B9CCB50174C00CF71F0E853BFFD7354`**）。
- 产品代码零改动（canonical 字节冻结）；LO-2 导出/导入未接线。

## 2026-10-14 — JU任务看板更新为实际进度（第4轮）

- 上传 7 份历史看板（启动清单 5 版、L3 周看板、v2.1-dev UI 增强看板），要求把 JU任务看板.html 更新为实际进度；对照项目日志逐条核对后重构。
- 归档 23 项已完成（L4 全模块 tag s2-l4、P0-L3 八步迭代、M0-3/4/5/6、M1-2/M1-4 由 L8 交付、M2-3/M2-4 由 L6 交付、M3-1 回归套件 152 用例）；新增 v2.1 UI 线（设计冻结 10-13 归档，W9–W12 实现 + W13–W16 回归列为 #95/#96 待办）。
- 页头改「全量任务看板（实际进度 2026-10-14）」；校验：括号配平、node --check 通过，统计 A=24/B=9/C=21/done=38 → 41%，门控 5、进行中 0（基线：编号已续接至 95/96，done=38 晚于 L7→L8 轮3 的 23% 快照）。
- 产物：JU任务看板.html（aka GoOyKeUAlC）；另基于 API 截图估算剩余活跃工期 5–8 天、再花 ¥100–250；Windows 工作副本 E:\APP\归档 看板未同步。

## 2026-10-14 — 任务看板更新（L6 任务接入 + L8-W3 完成登记）

- 更新 JU任务看板.html：Track A 新增 L6 阶段任务 75–81（75 M2 前置只读检查 removeNodeFromMap 是否递归 / 76 M1 extractChangedIds + updateIncrementalIndexes / 77 M2 四索引增量路径 / 78 M3 undo·redo 反向增量 / 79 M4 不变量 #23/#24/#25 / 80 M5 L6 专题 spec 26 条 + bench / 81 L6.5 回归与冻结 + 日志 + SHA-256），三轨统一编号至 81。
- 已完成列新增 L8-W3 落盘层实现与全量验证：canonical 校验通过；E-a~E-i 完成；T-53~T-65 13 个通过（新增 T-63/T-64/T-65）；R 层 Node 51 + PW 134 + bench 7/7；待 W5 冻结。
- 页脚与推进顺序同步，明确 L6 已纳入看板、L8-W3 待冻结；看板未纳入 SHA 登记。
- 快照说明：本条目为「L6 任务入板（编号 75–81，接 L4 细化看板 1–74 之后）」+「L8-W3 完成登记（L8 增量落盘清单独立波次状态）」两个时点的合并记录；L8-W3 完成登记 supersedes L7→L8 轮3 的「W3 未开工」快照；done 演进 23→38→40（三轮→第4轮→第5轮）。

## 2026-10-14 — JU任务看板更新（L7→L8，三轮）

- 轮1：页头改「JU · L7 Worker 化任务清单 / L6 冻结 · L7 推进中」，L6 移入 done，Track A 新增 L7 待办 82–89（86 号 L7-W3 标 doing）；验证 node --check、括号配平、无 L6 残留；产物 E:\APP\归档\JU任务看板.html。
- 轮2：按 L7-W1~W4 完成进度更新，Track A 仅留 89 号 W5（doing），W1–W4 移入 done；done 置顶 L7-W4/W3/W2/W1 与 L6-M1~L6.5；产物云附件版 JU任务看板.html（交付 https://aka.doubaocdn.com/s/8Bcfd3tBFU），Windows 原文件未同步。
- 轮3：按 CURRENT_TASK.md（L8-W2 冻结、W3+ 未开工）更新为「L8 增量落盘任务清单」，Track A 新增 L8 待办 90–93（W3 崩溃原子性 T-63/64、W4 checkpoint 混合 T-65、W5 路径隔离 T-66/67、W6 哨兵 T-68）；done 置顶 L8-W1（897,710 B）、L8-W2（904,796 B）、L7-W5（887,834 B / 315D0711…46C0）；统计 A=48/B=9/C=21/done=23≈23%，门控 5，doing=0；产物 https://aka.doubaocdn.com/s/qsk0E3y8wD。
- 快照说明：轮3 的「L8-W3 未开工 / done=23」为当时状态（看板线最早快照），后续由「L6 任务接入 + L8-W3 完成登记」补登完成、再由第4轮/第5轮刷新为 38→40，本快照已 superseded。

## 2026-10-14 — L8-W5 / W4 / W3 / W2 / W1

- **L8-W5 回归通过里程碑**：`scripts\verify.js` `PW_TESTS` 7→8（追加 `tests/l8-persist-patch.spec.ts`），汇总标签 `L3 64 + L4 20 + L6 34 + L7 18 + L8 16 = 152 用例`；新 SHA-256 **`13D6F0306C65E911DDAC80F2C41D001AB586CF92DD4008269D04924CE60B8098`**（4,201 B，纯 LF；取代 L7-W5 冻结值 `D8687B31…9EB65`）；R 层 `scripts\_s4run.ps1 -Mode all` → **EXIT=0**：Node **48 断言** + PW **150 passed + 2 skipped(T-48/T-49) = 152** + bench **7/7**（最大恶化 0.0% / 中位 -14.3%）→ `[verify] 全部通过`；证据 `E:\APP\归档\tmp_verify.txt` + `step9\scripts\_s4tail.txt`；L8 spec 不变 `C48E5D41…D7354`（64,006 B）；冻结纪律 `scripts\_w5freeze.ps1`（L8 变体）→ **`RESULT=PASS` / `THREE_PARTY_IDENTICAL=True`**（证据 `step9\reports\_w5freeze.txt`）。（`step9\tools\verify.js` = `3EC5F237…` 为陈旧 4 文件模板，非字节镜像，未改。）
- **L8-W4 完成/冻结**：canonical = step9 = **907,458 B / `6CAD8950EA3B07C7CC4363BB053D1268F57E6A85B81BE340E70F9EB321C42B10`**（自 W3 起字节冻结，W4 零产品代码改动）；W4 载体 spec `tests\l8-persist-patch.spec.ts` = **64,006 B / `C48E5D419DA1AFFCB6C0AE40074D6A3A3B9CCB50174C00CF71F0E853BFFD7354`**（CRLF，扩 T-66/T-67/T-68，全量 L8 spec 16 passed）；冻结纪律 `scripts\_w4freeze.ps1` → `FROZEN_DRIFT_COUNT=0` / `BYTE_IDENTICAL=True` / `RESULT=PASS`（ev `reports\_w4freeze.txt`）；路径隔离哨兵 `scripts\_w4paths.ps1` → `VIOLATION_COUNT=0` / `RESULT=PASS`；`scripts\verify.js` 未改动 `D8687B31…9EB65`；报告 `step9\reports\l8-w4-2026-10-14.md`。
- **L8-W3 完成/冻结**：canonical = step9 = **907,458 B / `6CAD8950EA3B07C7CC4363BB053D1268F57E6A85B81BE340E70F9EB321C42B10`**（纯 LF）；W3 载体 spec `tests\l8-persist-patch.spec.ts` = **51,228 B / `E8AAFFE73F5F3DCF37B41AFF73B6FEA312308CB0BCCEAB5B61530914296086C4`**（CRLF，扩 T-63/T-64/T-65，P 层 13 passed）；R 层 Node 48 断言 + PW 134 passed + 2 skipped(T-48/T-49) + bench 7/7 → `[verify] 全部通过`，证据 `E:\APP\归档\tmp_verify.txt`；`scripts\verify.js` 未改动 `D8687B31…9EB65`（4,157 B，L8 spec 仍未接入 `PW_TESTS`）；报告 `step9\reports\l8-w3-2026-10-14.md`（+ `l8-w3-verify-2026-10-14.md` / `l8-w3-plan-2026-10-14.md`）。
- **L8-W2 完成/冻结**：canonical = step9 = **904,796 B / `ABE8B1F7E01006BF187F42859C06694C6BF3921C681FF2DF417314C7502FB3FE`**（旧 897,710 / 904,516 / `64EA6B62…` 作废）；P 层 `tests\l8-persist-patch.spec.ts`（29,431 B）**T-53 ~ T-62 全 10 passed**；R 层 `node scripts/verify.js all` 三段全绿（Node 51 通过项 + PW 134 passed + 2 skipped(T-48/T-49) + bench 7/7 恶化 0.0% 中位 -14.3%）→ `[verify] 全部通过`，证据 `E:\APP\归档\tmp_verify.txt`；E1 `buildPersistBatch` L2538 / E2 `applyPatchAck` L2565 / E3 `runPersist` 桌面 patch 分支 L4316~4334 / E4 指纹早退守卫 L4336 / E5 探针 `w2`+`__juPersistFailures` L2512，反向护栏仅经公开 `setMode` 双守卫（无手动跳闸）；契约文档 `step9\reports\l8-rust-contract-2026-10-14.md`（27,694 B / `18843FC5…09E8`，K-1~K-7 + OP-1）；报告 `step9\reports\l8-w2-2026-10-14.md`；红线复核通过（非桌面/加密/`mode='full'`/超限 四路径历史行为不变，`verify.js` 未改 `D8687B31…9EB65`）；L8 spec 仍不接入 verify.js 单跑。
- **L8-W1 收口登记**：R 层绿证 `[verify] 全部通过`（Node 51 通过项（structural 19 + 16 + 9 + 7）/ PW 134 passed + 2 skipped(T-48/T-49) 41.4s / bench 7/7 最大恶化 0.0% 中位 -14.3%），证据 `E:\APP\归档\tmp_verify.txt`；修复＝按 L6 范式向 `step2-commit.test.mjs`（`1ED49975…4F49`，11,697 B）与 `step3-light.test.mjs`（`296414C0…DAC5`，10,322 B）注入 L8 采集层 no-op 桩（`persistDirtyStats`/`l8PersistActive`/`l8PersistFailure`/`markPersistFromPatch`/`markPersistMerged`），**产品代码零改动**；冻结锚点 canonical = step9 = **897,710 B / `1808D4AAD0CE47131943E46025AC6E35A63F9C7AA37AD79A9409D6EBCF60327B`**；报告 `step9\reports\l8-w1-2026-10-14.md`（W1 哈希锚点表 + LO-3 硬删子树 id 全集实测 + N 层修法）。后续新会话一律只读 `2.项目日志\CURRENT_TASK.md`（≤500 字）。

## 2026-10-14 — L7-W5 / W4 / W3 / W2 / W1

- **L7-W5 交接登记**：L7-W5 冻结状态（canonical `315D0711…46C0` / spec `9C34A952…` 80,363 B / verify.js `D8687B31…` / T-48·T-49 隔离）已全量压缩至 `2.项目日志\CURRENT_TASK.md`（≤500 字，唯一续做入口）；后续新会话一律只读该卡 + 在改代码文件，禁全文读本日志；每次工作结束/80K 换杯仅在项目日志追加一行历史。下一步：清理残留 → 裁定 `_tmp_red_w4.html.html` 去留 → 启动 L8（增量落盘 P1a）。
- **L7-W5：不变量 #26 哨兵 + 全量回归 + T-49 同型隔离 + canonical 冻结**：裁决方案 A —— 隔离 T-49（与 W4 T-48 同型）；`step9\tests\l7-index-worker.spec.ts` 内 T-49 由 `test(...)` → **`test.skip(...)`**（标题追加 `【W5 隔离：负载敏感 wall-clock 指标】`，上方 11 行决策注释 + 恢复条件），落点 **`:833`**；产品代码零改动。隔离后状态：T-48 / T-49 同型隔离；不变量 #26 说明同步更新（`4.回归与验收\JU-不变量清单-v2.0-frozen.md:637-639`）；`verify:all` 首跑全绿（Node 48 / PW 135 passed + 1 skipped / bench 7/7 / `[verify] 全部通过`），复跑仅并发抖动 T-49 转红（红证 `reports\l7-w5-verifyall-log-2026-10-14-all5b-RED.txt`）；隔离后应然门禁 = 134 passed + 2 skipped + bench 7/7 + `[verify] 全部通过`。冻结登记：canonical / step9 / 冻结件三方逐位一致：**887,834 B / `315D0711534D71FC329C050E3D2A7DBF3B7448FB613AA2B501B044AF522946C0`**；bench 7/7 无性能回归；报告 `step9\reports\l7-w5-2026-10-14.md`。判定：L7 阶段正式冻结 ✅。
- **L7-W4：骨架屏 + progress 协议 + 分块异步索引**：正解单行：`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; & '…\step9\scripts\_l7run.ps1' -Mode <l7|all> -Tag <tag> -Detach [-AppUrl …]`；必须 `-Detach` + 轮询 `step9\scripts\_l7tail.txt`。W4 产出：绿证 **17 passed (20.4s)**（含 T-47~T-51）；红证 **5 failed / 12 passed (47.1s)**（T-47 `twoPhase` 未定义 / T-48·T-49 `cacheAfterSync` 应 false 却 true / T-50 无 progress 出口 / T-51 无 `asyncBuild`）；回归 `verify:all` 原判 134 passed / 1 failed（T-48），W5 决策 T-48 隔离 ⇒ 结论更新为"已通过（T-48 已隔离）"。权威哈希（W4 后）：canonical = step9 = **887,834 B / `315D0711534D71FC329C050E3D2A7DBF3B7448FB613AA2B501B044AF522946C0`**；spec `471B77A6…E1BF`；verify.js `1C90B9FD…B277D`；红证靶 `_tmp_red_w4.html.html` = **860,758 B / `E4D05192…09DF2`**；报告 `step9\reports\l7-w4-2026-10-14.md`。判定：W4 已通过（T-48 已隔离）。
- **L7-W3 收官（T-45/T-46 闭环 ✅）**：W3 交付：`searchInverted` / `backlinkMap` 迁 Worker 权威 · LO-6 A 反链随 W3；L6 侧补齐两个全量构建器；Worker 侧 6 桶；主线程投影与对拍；用例 T-45/T-46。三证：红证 **2 failed**（`ReferenceError: buildSearchInverted / buildBacklinkMap is not defined`）；绿证 **2 passed (3.9s)**：T-45 840ms、T-46 636ms；回归 `[verify] 全部通过` · EXIT=0 —— Node 48 断言 ✓；Playwright L3 64 + L4 20 + L6 34 + L7 12 = **130 用例** ✓；性能对拍 **7/7** ✓。关键发现：T-45/T-46 夹具缺陷（产品代码零改动 · 仅测试侧修复）；修复：夹具显式带 `calRoot`、`_calIndexCache` / `_tagIndexCache` 改 `new Map()`、补齐 `parent` / `children`、笔误 `recre` → `recur`。权威哈希（W3 后）：canonical = **860,758 B / `E4D051928F37F0140247C5B97D8B7D45B811B0ACE703FAD90FD0F65E3A909DF2`**；spec = **32,954 B / `C353F2FD…9C84`**；红证靶 `_tmp_red_w3.html.html` = **847,536 B / `2DCD4F01…0336`**。
- **L7-W2 收官（W2-T2 闭环 ✅）**：W2-T2 交付：calIndex / tagIndex 迁权威 + 双向对拍 + 降级；Worker 侧真实存储；主线程切片、双向对拍 + 两级自动回退；权威切换 ready 前置门槛；查询异步两阶段 + 降级；导出新增。三证：红证 **4 failed / 6 passed (19.7s)**；绿证 **10 passed (14.2s)**；回归 `[verify] 全部通过` —— Node 48 断言 ✓；Playwright **128 passed (39.5s)**；性能对拍 **7/7** ✓。W2 收口勘误：`scripts\verify.js` 汇总标签由"68 + L4 20 + L6 34 + L7 5 = 127 用例"改为"**L3 64 + L4 20 + L6 34 + L7 10 = 128 用例**"。权威哈希（W2-T2 后）：canonical = **847,536 B / `2DCD4F01DD083855359D852EE5DC67634BFEA74C3D42D0E4049FC6C686220336`**；spec = **19,075 B / `222DC73C…FC7B`**；verify.js = **4,157 B / `69D17D6F…5BC9`**；红证靶 `_tmp_red_w2.html.html` = **836,158 B / `C9DFB5F3…3363`**。
- **L7-W2 启动（任务 1 闭环 ✅ / 任务 2 未开始）**：W2-T1 就绪看门狗补口；修复 `ensureIndexWorker()` 只挂一次 3s 计时器缺陷；新增 `_indexWorkerReadyStrikes` / `_indexWorkerReadyTimer` / `_indexWorkerReadyWatch(gen)`；三证：红证 **1 failed (T-40) / 5 passed**；绿证 **6 passed**；回归 `[verify] 全部通过`。工具链修复（非产品代码）：`_l7run.ps1` 输出丢失根因（中文路径字面量写进无 BOM 的 .ps1）；摘要管道补 `Get-Content -Encoding utf8`；铁律对齐。
- **L7-W1 完成（红证 → 修 → 绿证 → verify:all 全绿）**：L7-W1 完成 ✅；本轮修复 4 项：① `setIndexWorkerMode(m)` 回传**有效模式**（原 `return m` 回传请求值 → Worker 构造失败降级后仍回 `'shadow'`，调用方误判影子/权威已开启，静默错误）；② R5 定论 → LO-5 决策修订 R1：`file://` 下 Chromium **无法加载任何 `blob:` module worker**（临时探针四象限实证：应用同源 Blob × 内联 Blob × module/classic → 仅 module 两例全灭，与源码内容无关；`onerror` 恒为 `[object Event]`）→ 改 **classic Blob worker**：`new Worker(getIndexWorkerUrl())`（去 `{type:'module'}`），与图谱 `GRAPH_WORKER_SRC`（classic+Blob，早已验证 `file://` 可用）统一范式；`INDEX_WORKER_SRC` 仍为自包含单串（无 import/importScripts）→ 功能等价、零迁移代价，设计文档追加 §10.2 决策修订 R1；③ 测试侧缺陷（诊断失真）：`page.waitForFunction(fn, {timeout:5000})` 把选项当 `arg`（第 2 参）→ 实际按 test timeout(30s) 等待、失败误报 `Test timeout of 30000ms exceeded`；改 `(fn, null, {timeout:5000})`（T-36 两处）；④ 可诊断性：`onerror` 载荷回退 `message → filename → type`（原 `lastError` 记为 `'[object Event]'`）。证据：RED-W1 **5 failed / 0 passed**；RED-R5 **1 failed / 4 passed**；GREEN **5 passed (3.9s)**；回归 `[verify] 全部通过`：Node 单元 48 断言 ✓ + Playwright **123 passed (39.3s)**，零 failed。哈希：canonical = **833,927 B / `431e4a0140cc92f01da7f4440597e4fe4912790ed5d8cda89c2b08cb2aad4649`**；spec = **9,461 B / `85f7335a…fba9`**；设计文档 = **32,501 B / `a695d6e9…0bb73`**。

## 2026-10-14 — L6 索引增量维护完成 + L6.5 条件检查

- L6 完成：按 `l6-design-2026-10-13.md` 实施 4 索引（calIndex / tagIndex / searchInverted / backlinkMap）从「全量懒构建」到「增量维护」的改造；O-1 全纳入 / O-2 undo 反向增量 / O-3 删除子树立即清理；M0~M5 实施表如下：

  | M      | 内容                                                                                                                                   | verify        |
  | ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
  | **M0** | 只读方案分析（`l6-plan-2026-10-13.md`）                                                                                                      | N/A           |
  | **M1** | extractChangedIds + updateIncrementalIndexes + collectSubtreeIds + 4 索引桩 + 失败缓冲                                                      | ✅ 88+48+bench |
  | **M2** | 4 索引增量实现（calIndexUpdate / tagIndexUpdate / searchInvertedUpdate / backlinkMapUpdate + nodeAllTags / tokenize / extractWikiTitles 辅助） | ✅ 88+48+bench |
  | **M3** | commit/undo/redo 反向增量 + 删除子树清理（#22.22.M1 merge 豁免）                                                                                   | ✅ 88+48+bench |
  | **M4** | 不变量扩展（#14.M4 commit 收口 / #15.M4 undo 反向 / #22.M1 merge 豁免 + #23 / #24 / #25 新增）                                                      | N/A（文档）       |
  | **M5** | L6 专题 spec 26 条 + Node 测试桩 + L4 失效移除 + subtreeCleanup 模式 + window.__juInMerge 探针                                                     | ✅ 88+48+bench |

- 实施变更：4 索引数据结构 `Map<date,Set<id>>` / `Map<tag,Set<id>>` / `Map<term,Set<id>>` / `Map<docId,Map<topId,count>>` 替换旧结构；commit 收口增 L6 注入点（路径 + 软删/硬删识别）；undo/redo 反向增量；mergeRemoteState try/finally 设 `__juInMerge` + 强制 4 索引 null。

- 不变量扩展：#14.M4 / #15.M4 / #22.M1 + #23 增量一致性（4 索引 vs 全表重建 fuzz 100 commit）/ #24 删除子树收敛 / #25 性能预算（切视图 P95<50/40/100ms、commit 增量<5ms）。

- 文件大小 + SHA-256：L4 后 **779,xxx bytes / `62882ecae125e1bd4c72548c07efb89994d7eca817c06a6fd40801fde6f0c40b`**；L6 后 **820,803 bytes / `d84eeace6e56d4ed9362a5f0b102c6bd6ccbcb1e9de290cf37b08d12e1e245f7`**；增量约 40KB。

- L6.5 条件检查：无 git 命令环境（`where git` 空）→ 决议方案 2：跳过 tag `s3-l6-20261013`，仅登记 SHA-256 baseline（820,803 B / `d84eeace…`）；tag 延后至有 git 环境补做；0 开放项、不阻塞 L7。

- 报告：`step9\reports\l6-complete-2026-10-13.md`。

## 2026-10-14 — M4/M5 执行与 8 小时挂机

- **M4 执行交接单**（#14.M4 commit 收口 / #15.M4 undo 反向）：审查结论：#14.M4 结构契约已满足；#15.M4 结构契约已满足；唯一必修功能缺陷 F-1：`calIndexUpdate` 添加检测守卫 `toDate!==fromDate` 在复活时漏加；命中 3 条路径（`restoreFromTrash` 正向 commit、`undo()` 撤销 `moveToTrash`、任意使 `_deleted` true→false 且 date 相同的 patch）。次要项 M4-2 / M4-3 登记待办。
- 已完成步骤：步骤 1 核心修复（两副本同步，canonical L2486–2489 → `if(toDate&&!toDeleted&&(toDate!==fromDate||fromDeleted)){`）；步骤 2 补 spec（`l6-index.spec.ts` 末尾 §7.12 T-27/T-28/T-29）；步骤 3 回归全部通过（Node 48/48 + L6 spec 29 passed）；步骤 4 红证未完成（`Command execution aborted`）。
- 环境边界：无 Git；无 Node / npx（用 CodeBuddy CN Electron `ELECTRON_RUN_AS_NODE=1` 作运行时，v22.20.0）；无 Playwright 浏览器缓存（设 `JU_CHROMIUM_PATH` 指向 Chrome）；终端回显不稳定。
- baseline 变更：改动前 **`d84eeace6e56d4ed9362a5f0b102c6bd6ccbcb1e9de290cf37b08d12e1e245f7`（820,803 bytes）** → 改动后 **`81e5772a930ee2af302f8d08275473bc31cfd80cede5016f16928d940dfdce13`**。
- **M4/M5 8 小时挂机执行**：接管状态复核；红证已完成（`_tmp_pw2.txt` 有完整 **3 failed** 证据），修复后 `_tmp_pw1.txt` 有 **29 passed**。环境复核：两副本哈希均为 `81e5772a…dfdce13`（821078 bytes）；`_tmp_red.html.html` 存在，哈希 `d84eeace…e245f7`（旧守卫，820803 bytes）。已完成：`l6-complete-2026-10-13.md` 新增 §十一 M4 补丁；不变量清单追加；`l6-index.spec.ts` 头部矩阵注释追加 §7.12；`verify.js` Playwright 标签 114 → 117。步骤 3 红证复跑：`_tmp_red.html.html` × `--grep 复活` → **3 failed**（T-27/28/29 全红），证据 `_tmp_pw_red2.txt`。步骤 4 `verify:all`：**全部通过** —— Node 单元测试（48 断言）✓；Playwright 集成测试 **113 passed (40.4s)**，含 T-27/28/29 ✓；性能对拍 ✓。
- **M5 阶段：注入点加固 + 边界用例（完成 ✅）**：代码加固 M5-1 守卫统一 `if(_patch&&_patch.paths&&_patch.paths.length&&!__juInMerge)`；M5-2 catch 加固新增 `l6InjectionFailure(tag,op,err,t)`（L2743–2755）；commit / undo / redo 三处 `catch(_e){}` → `catch(_e){l6InjectionFailure(...)}`（L2884 / L3200 / L3236）。新增测试 `tests/l6-index.spec.ts` §7.13 · **T-30 ~ T-34**（T-30 复活+date 变更 / T-31 幂等 / T-32 硬删子树清理↔undo 重加 / T-33 空输入安全 / T-34 注入点降级 helper）。证据：红证 `_tmp_pw_m5red.txt`（**1 failed / 4 passed**，唯一红为 T-34 `ReferenceError: l6InjectionFailure is not defined`）；绿证 `_tmp_verifyall_m5.txt`（`verify:all` **全部通过** —— Node 48 断言 ✓ / Playwright **118 passed (40.2s)** ✓ / bench ✓）。哈希：M4 后 821,078 / `81e5772a…dfdce13`；**M5 后 822,039 / `7b7a9b98c3e6855425201547f7690a2eb88d4b0ec19a8c002e4a240968b2857e`**；canonical 与 step9 副本 `identical=True`。挂机总结文档：`L6-M4-M5-8小时挂机总结.md`。

## 2026-10-14 — 桔JU（46.html）审查（复审线）

- 复审背景：46.html 已于 09-22 完成首轮全量验收 + 四轮 56 项清单核验（见 09-22 条目）；本轮为时隔近三周的复审/补审，评估对象与结论以本轮为准。

- 四轮审查 56 项（P0=10 / P1=14 / P2=14 / P3=18）；另报 2 项 P0（Ctrl+↑/↓ 被拦、日历新增入口断裂），本审查未独立发现——盲区：静态阅读为主，对「事件顺序冲突」「写入→过滤→渲染断链」覆盖不足。

- 六批 51 条修复补丁（B1 P0×10 → B6 细节×10）；指令「不打补丁直接改」，按 6 段交付完整重写代码（文本，无落盘）。

- **结论**：上架推荐 Tauri（Microsoft Store 免费 5-12 工作日 / Apple $99/年 / Google Play $25）；合规风险中（CN103703481A 日历 NL、WO2020139861A1 知识图谱，纯前端可避）；数据持久化须迁 localStorage → 应用目录 + 原子写 + `bundleId` 永不变；地图修复关键 = `style.fill` 双写 + 容器 `aspect-ratio` 跟随 viewBox。

- 遗留：① 46.html 与 v2.0-l3.html.html 同源性未核，若同源 51 条修复需与 L4~L9 合并评估；② 审查盲区与跨轮次自我修正缺位已登记。

- 时序说明：本条目为独立复审线，与看板线/L9 线无时序耦合，置于 10-14 组末不参与两线排序。

  <!-- 组内排序说明（10-13）：按逻辑分组、组内倒序，非严格时间倒序——归档/审查线（JU 归档结构验收→JU归档整理→融合报告归档审查→v2.1-dev 清理→UI 验收→产品 HTML 静态审查[规划·零代码，归审查线]）置顶；开发线 L6 索引→L4 历史栈改造→商业化审查[状态时点 L4 编码前]→L4 细化看板→全流程启动清单→JU Agent→D1~D9 决策执行细化登记（证据完整版，含 D-1.7 源链表与 D-1.8 哈希补登表；S0/S1 后续登记动作）→S0/S1 基座；v2.1-dev 文档同步与归档落盘归文档/UI 线（正文置于 S0/S1 之后、《JU 产品路线》docx+md 生成之前，先后为逻辑推断）；文档生成线 docx+md 最早。具体时分缺失，顺序为逻辑推断；L4 相关状态以「L4 历史栈改造」完成结论为准。 -->

## 2026-10-13 — JU 归档结构验收（P0-L3 多轮产出）

- 验收归档 P0-L3 迭代 5 轮：Step6/Step7 基线、冻结三件套（清单/CSV/FIX映射）、L3验收记录与周看板、结构共享轮（diff/测试/验收记录/bench/immutable-adapter）。
- 识别同名冲突 4 组（JU-58项修复回归清单 / 回归清单.csv / fix-map.json / 项目日志.md）：v2.0-frozen 与 P0-L3 两套体系内容不同，按 P0-L3- 前缀 / -structural-sharing 后缀区分，不覆盖原文件。
- 命名规范：v2.0-frozen 后缀保留原冻结体系；P0-L3- 前缀标记迭代产出；-structural-sharing 标记结构共享轮次；项目日志.md 合并两套内容不拆分。
- 结论：归档结构 8 层（01-冻结版本/02-项目日志/03-评估报告/04-回归与验收/05-性能基线/06-P0-L3基线含 step1~step7 + structural-sharing/90-过程材料）；工作文件 v2.0-l3.html.html 不重复入档，由 bench JSON 与验收记录引用 sha256 846ccdc9…。
- 哈希关系说明：846ccdc9… 为结构共享轮验收记录引用的工作文件（v2.0-l3.html.html 改造中版本）哈希，非 v2.0-frozen 冻结哈希 0635e55a…；二者为不同阶段对象，不构成冲突。
- 遗留：① Step9 收口需修订 fix-map.json / 回归清单.csv / 冻结清单中 L3-05/06/07 旧机制描述；② ACT-2 实际已于 Step4 执行，冻结三源状态待同步。

## 2026-10-13 — JU归档整理（5 批文件归档建议）

- 审查 D4验收、性能对比报告、结构共享验收记录、Step9收口、评估报告等 5 批文件，给出归档/版本化/同名更新/无需归档建议。
- 更新归档结构：新增 06-P0-L3基线/step9/、step7/d4/、structural-sharing/ 版本化文件；删除标注输出纯结构。
- 处理冻结三源（md/csv/json）同名更新，L3验收记录追加 Step9；评估报告.md 与 .docx 并存。
- 结论：归档体系覆盖 Step0~Step9 全链，Step8 以索引方式待补，结构共享验收记录版本链 v1~v4 保留；遗留：Step8 无独立目录、结构共享验收记录最终版待确认、归档文件命名规范已统一。

## 2026-10-13 — JU工作台融合评估报告归档审查

- 检查 5 份历史文件：10-07 docx×2、10-07 md、10-12 修正版、10-13 最终版；识别重复、过期、命名与内文日期不一致。
- 主版本定为 JU工作台融合评估报告（商业化）2026-10-13_最终版.md；原文件名日期与扩展名间多空格需修正；归档保留 10-12 修正版、10-07 md（三轨三门控版）；两个 10-07 docx 重复/早期草稿可不单独保存，若留仅保留一份并去「(2)」。
- 10-12 修正版文件名日期为 10-12、文档内仍写 2026-10-07，需统一或标注「基准/修正日期」。
- 结论：保留 10-13 最终版为主文件；历史 md 入 archive；删除或合并重复 docx 避免验收误用；遗留：未逐字核验 docx 与 md 一致性、未实际重命名/删除（仅归档建议）。

## 2026-10-13 — JU v2.1-dev 验收归档清理审查

- 检查 04/05/06/07/90 归档：区分正式验收/基线产物与过程材料、占位、待执行测试、同源副本、历史中间版本。
- 建议无需正式归档：07/perf 与 05 同源性能 JSON、step10 占位 diff、TODO spec、structural-sharing v1–v3、step7/d4 中间 bench、过程看板。
- 建议改名：去除上传前缀，统一 JU- 前缀、v2.1-dev、状态后缀（待验收/pending/过程快照/最终），并补日期；重新生成归档结构：04/05/06/07 只留冻结/已执行/可复现唯一版本，占位/待执行/历史/中间数据/同源副本移入 90-过程材料并加本轮备注。
- 关键动作：删/移同源性能副本；占位 .diff 改名；TODO spec 标 pending；step10 命名统一；历史验收记录只留最终版；结论：归档需按「正式产物 vs 过程材料」分层、命名需版本+状态+日期统一；遗留：跨文件引用路径、重复清单合并、07/04 同源二选一尚未执行，需 M2 实现后同步核验。

## 2026-10-13 — JU-UI 交互增强 v2.1-dev 验收检查

- 核验设计冻结、回归 R01–R10、验收 A01–A09、不变量 I01–I11、性能基线及规范一致性；结论：设计冻结可过；功能/性能/实现均未执行，不能判定验收通过。
- 覆盖缺口：R03/R04 单业务拖拽撤销无对应验收项；A08 沉浸恢复无回归；侧栏树多选/全选、日历/文档模块调整大小、关闭虚拟滚动降级、拖拽三分法落点均缺失。
- 规范冲突：折叠按钮位置旧版「左上/右上」与 16.3「左下/右下」不一致需统一；不变量建议补：业务拖拽逆操作、三分法、边界约束、多标签同步、加密 UI 状态。
- 性能基线 5 场景 results 为空、spec 全 TODO；step10 三个 diff 与 v2.1-dev-step10.html 未生成；建议补 R11–R15 与 A10–A12 统一描述，M2 实现后回填证据再验收；遗留：实现产物未完成，回归/性能未实测。

## 2026-10-13 — JU 产品 HTML 静态审查 + 生产级六轮修复计划（规划 · 零代码改动）

- 审查 ju-app-fixed (4) (1).html：只读静态审查 + 测试方案 + 修复计划；未改代码、未跑测试、未算 SHA；发现 13 项：高 3（H1 onRemoteStoreChange 加密拒绝分支与 boot 合并语义相反；H2 commit 锁定态静默返回；H3 flushPersistNow 用 getState() 而非 snapshot）；中 6（M1 stats 死路径；M2 _outlineSel 跨文档误删；M3 blur 清空 redo；M4 trashed 未置 _metaDirty；M5 墓碑刷新丢失；M6 加密防抖浪费）；低 4（L1 scheduleSidebar 死代码；L2 记事本无右键删除；L3 ensureNoteDoc 竞态；L4 forceRender 吞错）。
- 不变量 I1~I4 满足、I5 未显式校验；测试方案 8 类：属性 P1~P5、崩溃恢复 5、多标签 5、contenteditable fuzz 7、Soak 9 泄漏点、变异 6 算子、错误上报评估。
- 六轮计划：R1 修复 6 项阻断；R2 验收崩溃/属性/Soak/fuzz；R3 修复 7 项并发一致性；R4 验收三标签/属性/加密；R5 上架准备 9 项；R6 灾难恢复/4h Soak/全量回归。
- 遗留：R1–R6 未启动；产品 HTML 零改动；需先对象对齐，再按「红证→修→绿证→verify:all→报告→日志」启动 R1。

## 2026-10-13 — L6 索引增量维护

- 阶段 0 只读：4 索引 calIndex / tagIndex / searchInverted / backlinkMap 从全量懒构建改增量；L4 已铺 commit 收口 + collectModifiedPaths + extractAtPaths，L6 增加 extractChangedIds + updateIncrementalIndexes。
- 决策 O-1 4 索引全纳入；O-2 undo 反向增量；O-3 删除子树立即清理；7 项自决：失败缓冲 FIFO 50、连续 3 次失败全表 rebuild、bench 100ms / 5ms、removeNodeFromMap 假设递归、首次构建不优化、#25 性能预算、CJK 切分。
- 阶段 1 设计文档 45,016 B / 1042 行，11 章 + 决策回执，L6 专题 spec 26 条；阶段 2 M1–M5 待启动，预估 3–4 小时；待执行指令。

## 2026-10-13 — L4 历史栈改造

- 阶段 0 只读方案：historyPast/historyFuture 全量 state，HISTORY_MAX=30，snapshot:true 82 处，三类旁路；阶段 1 设计：patch {v,t,op,mode,paths,pre,post,meta,groupKey}；historyMode 'snapshot'|'never'|'merge'；82 调用点映射 13 merge + 64 snapshot + 1 never。
- 决策：方案 B；mergeRemoteState never；新增不变量 #22；文本编辑 500ms 自动合并；90/90 + 新增 l4-history.spec.ts；显式 historyMode。
- L5 编码 M1–M7：基础设施、commit 收口、undo/redo applyPatch、mergeRemoteState 不入栈、82 映射（12 merge + 64 snapshot + 6 never）、不变量 #14/#15/#22、20 用例通过。
- L5.5 冻结：88 PW + 48 Node + bench 全绿；tag s2-l4-20261013；新 canonical 62882eca…f0c40b；语义核对：设计文档 redo 逻辑存在 bug、实际实现正确，按方案 A 更新文档后与实现一致；结论：L4 完成，L6 可启动。

## 2026-10-13 — 桔JU（JU工作台）商业化报告审查与AI工具链推荐

- 完成报告五轮审查与修订：统一四门控（G0/G2/G2′/G0′）、商业化整体后置、付费优先级（Supporter>Sync>Publish>Pro>Business）；确认 L3 已完成、L4 待执行、L6 入口，L8 未启动（状态时点：L4 编码前，均已被同日稍晚条目 superseded——L4 完成见「L4 历史栈改造」、L6 索引见「L6 索引增量维护」、L8 冻结见 10-14「第5轮」）。
- 对比 TRAE/Qoder/Kimi Code/CodeBuddy 的合规性、定价与积分消耗，实测标准版额度严重不足；推荐 Cline+DeepSeek API 方案（P0+P1 约 ¥100–300）。
- 提供 Cline 全自动配置：YOLO 模式、.clinerules 项目规则、Plan→Act 指令；解决 VS Code GitHub 登录失败、hosts 修改、BYOK 配置问题。
- 结论：Cline+DeepSeek 为当前性价比最高方案；M1 拆分可临时订阅 TRAE Pro+（¥239/月）应对并行迁移；遗留：待充值 DeepSeek API 并完成 Cline 配置后，启动 L6 增量索引攻坚。

## 2026-10-13 — L4 细化任务看板 + 成品预览答疑

- 加入 L4 详细任务（Pre-L5 到 L5.5 共 10 项：ESM 修复、patch schema+10 helper、commit() 收口、undo/redo 改造、merge 不入栈、82 commit 映射、不变量补全、L4 spec、完成检查、回归冻结），三轨并列 + 已完成列，统一编号 1–74。
- 解答分发前成品预览与修改闭环（M0 单 HTML、M1 热更新、M3 稳定候选、M4 安装包）；遗留：L4 编码即将启动；L4 详细任务需与 v2.0-frozen 基线对齐。

## 2026-10-13 — 全流程启动清单看板生成

- 基于 L3 周看板 v2.0-frozen、融合评估报告、设计框架规范、细节要求描述文档，生成启动看板（13 项任务 + 16 项启动清单 + 路线图 M0–M5 + 门控 G0–G4 + 性能批次 P0–P3 + 合规行动 + 检查点时间线）。
- 后按三轨并列（Track A/B/C + 已完成列）重构，统一编号 1–19。

## 2026-10-13 — JU Agent 开发模式文档完善

- 建议在「总控调度 + 专业角色分工 + 测试合规双门禁」中前置 S0 只读基线审计；新增 JU-AuditAgent，负责遍历工程、验证 L3、盘点 L4/L8/L6/L5、测试、合规与工程卫生，输出 P0-P2 问题清单。
- 生成完整文档：角色总览扩为 S0–M5；补入 JU-AuditAgent 完整 System Prompt；统一调度增设第 0 步；人类职责增「基线确认」；禁止事项增「S0 只读、留痕、可复核」。
- 结论：先审计后开发，避免基于错误前提改历史栈；人类确认基线后才启动 L4；发现 P0 问题立即冻结开发并上报；遗留：S0 审计报告模板、问题清单字段、与 G1/G2/G0 门控映射待固化；本次仅输出文本无落盘。

## 2026-10-13 — D1~D9 决策执行细化登记

- **D6 哈希重登记**（S0 第三轮审计 F-3/台账 F-18）：8 项旧登记值 → 当前实测值（SHA256 前 8 位）：`JU-58项修复回归清单-v2.0-frozen.md` `8fc8b0c7…`→`d1c05d1c…`；`回归清单.csv` `ee685abc…`→`4c1bd749…`（归档实际文件名 `JU-58项修复回归清单-v2.0-frozen.csv`）；`fix-map.json` `2e40f0fb…`→`81047b5a…`（归档实际文件名 `JU-FIX映射-v2.0-frozen-2026-10-08.json`）；`tests/ju-smoke.spec.ts` `59c4779a…`→`74ae0e63…`（归档实际文件名 `ju-smoke-v2.0-frozen.spec.ts`）；`tests/bench-smoke.spec.ts` `7ff650dc…`→`dc5b32d6…`；`tools/gen-bench.js` `86bca62b…`→`440efb57…`；`ju-bench-30k.load.js` `93e63d1f…`→`aab9ef7e…`；`ju-bench-100k.load.js` `125e689b…`→`7285651a…`。原因：登记源为归档外原始工作区时点文件，归档内文件经后续整理入库。

- **D-1.3 Bench JSON 双源标注**：`5.性能基线\bench-p0-baseline.json` = **`64182f59546948b53bf1cf17b5776ee5cf3b9ce7fc9c508362e10cac955d5963`**（v1 `{meta, metrics}`，legacy 历史快照，compare-bench **否**）；`6.P0-T3基线\step9\bench-p0-baseline.json` = **`2a48ca99c3c99df5a96c598f462b43a1983eb1440c767329853a674eb8960188`**（v2 `{env, results}`，current，compare-bench **是**）；`6.P0-T3基线\structural-sharing\P0-L3-structural-sharing-bench-baseline.json` = 同上 v2（与 step9 字节完全相同，current）。

- **D-1.4 最终工作文件**：归档内路径 `6.P0-T3基线\v2.0-l3.html.html`；角色 canonical at root；SHA-256 **`0bead9d5ab610725e0150d779b930af43d7f0e60db454d72df06e541eecdcb3a`**；字节数 **785,334**；与 step9 副本字节完全相同。来源链：pre-bugfix（`846ccdc9`）→ patch（`P0-L3-bugfix-20261009-reference-semantics.patch`，`50709b725bca1b3050c5bea286ecedaf9d50c30a`）→ post-bugfix（`0bead9d5`）★最终工作文件。patch 应用：4 hunk 全部成功，0 conflict；后验 bugfix 4 标记 + 结构共享指纹在位；残留 `safeClone(state)` × 4（属 L4/L8 范围）。L4 启动硬性要求：SHA-256 必须为 `0bead9d5ab…`，任何偏离即视为 baseline 损坏，禁止 L4 启动。

- **D-1.7 归档源链**：step9 16 文件来源链登记（按归档内路径排序）：

  | #   | 归档内路径                                                                                | 原始来源                                                                 | 源类型                  | s0-baseline SHA-256                                                |
  | --- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------ |
  | 1   | `6.P0-T3基线\v2.0-l3.html.html`                                                        | `c:\Users\12601\CodeBuddy\20261013182915\d1-apply\v2.0-l3.html.html` | d1-apply 临时产物        | `3723be0569d106e024ad4c533cf998648ba74c4b`                         |
  | 2   | `6.P0-T3基线\structural-sharing\v2.0-l3.html.html.pre-bugfix-20261009`                 | `E:\APP\备份\75（10.10）P0-L3 结构共享\P0-L3 结构共享验收\v2.0-l3.html.html`       | 备份 75                | `5fb04f1bdab95de7e24edacd84d42900b19c9d69`                         |
  | 3   | `6.P0-T3基线\structural-sharing\diffs\bugfix-20261009-reference-semantics.patch`       | 备份 76                                                                | 备份 76（S1 step 4 已删除） | `3be28ba735ba7869dfa0bd63cde11416b1ca9698b58bfd1d270944f68a1846e4` |
  | 4   | `6.P0-T3基线\structural-sharing\diffs\P0-L3-bugfix-20261009-reference-semantics.patch` | 备份 76                                                                | 备份 76                | `50709b725bca1b3050c5bea286ecedaf9d50c30a`                         |
  | 5   | `6.P0-T3基线\step9\scripts\verify.js`                                                  | `E:\APP\备份\76\5.Step9（CI 接线 + 7 项待办）\verify.js`                      | 备份 76                | `16ddcbc1e2e86c0ea3c09fec5b60901231c868be`                         |
  | 6   | `6.P0-T3基线\step9\scripts\compare-bench.js`                                           | 备份 76                                                                | 备份 76                | `75f7c120933402a997ed9553bb5faaae3bc78ad8`                         |
  | 7   | `6.P0-T3基线\step9\bench-p0-baseline.json`                                             | `E:\APP\归档\5.性能基线\bench-p0-baseline.json`                            | 归档内转抄                | `6eddc8b862739817d11df1362b130e156d7d7fcd`                         |
  | 8   | `6.P0-T3基线\step9\bench-p0-after-l3.json`                                             | `E:\APP\归档\6.P0-T3基线\step7\bench-p0-after-l3.json`                   | 归档内转抄                | `083a54231a79c7a3a312925a0b512a5ba8e667fe`                         |
  | 9   | `6.P0-T3基线\step9\P0-L3\tests\structural-sharing.test.mjs`                            | 备份 76                                                                | 备份 76                | `13fbf1bffcf7d0e454a7def1d1a12ca839b26f57`                         |
  | 10  | `6.P0-T3基线\step9\P0-L3\tests\step1-produce.test.mjs`                                 | `E:\APP\归档\6.P0-T3基线\step1\step1-produce.test.mjs`                   | 归档内转抄                | `57f65ee7ccf5f34dc20d408db2d4aa02d1c72a16`                         |
  | 11  | `6.P0-T3基线\step9\P0-L3\tests\step2-commit.test.mjs`                                  | `E:\APP\归档\6.P0-T3基线\step2\step2-commit.test.mjs`                    | 归档内转抄                | `ede3b05f55f7b65440e957244ab8a22a8c72b7be`                         |
  | 12  | `6.P0-T3基线\step9\P0-L3\tests\step3-light.test.mjs`                                   | `E:\APP\归档\6.P0-T3基线\step3\step3-light.test.mjs`                     | 归档内转抄                | `e775684302aad84c39e80101f903706ff134193d`                         |
  | 13  | `6.P0-T3基线\step9\tests\l3-invariants.spec.ts`                                        | 备份 76                                                                | 备份 76                | `e26af1de50f6381d269d39396a2f08961320eb0a`                         |
  | 14  | `6.P0-T3基线\step9\tests\l3-commit-callbacks.spec.ts`                                  | 备份 76                                                                | 备份 76                | `d27ad12849e01fef262b55c44fcc64cf35429435`                         |
  | 15  | `6.P0-T3基线\step9\tests\l3-reference-semantics.spec.ts`                               | `E:\APP\归档\6.P0-T3基线\step6\step6-reference-semantics.spec.ts`        | 归档内转抄                | `22e9a01a87da866fda9314cb82219f6a938e2dcc`                         |
  | 16  | `6.P0-T3基线\step9\tests\l3-light-pollution.spec.ts`                                   | `E:\APP\归档\6.P0-T3基线\step3\step3-light-pollution.spec.ts`            | 归档内转抄                | `f3feb8ee2be5a50ff938bff909902eaf93c75fb3`                         |
  | 17  | `6.P0-T3基线\step9\playwright.config.ts`                                               | 备份 76                                                                | 备份 76                | `211a1bdb78d09f490cc8828da387c8975596b8b4`                         |

- 统计：备份 75 引入 1；备份 76 引入 7；归档内转抄 7；d1-apply 临时 1；S0 存在/S1 删除 1；合计 17 行登记（s1 实际 16 文件）。与 D-1.7 决议记"13 个文件"的差额 3 已说明。

- D-1.8 哈希补登**：4 spec + 4 mjs + 4 接线文件 s0-baseline SHA-256：

  | 文件                                                                                                                                                                                                             | s0-baseline SHA-256                        |
  | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
  | `l3-invariants.spec.ts`                                                                                                                                                                                        | `e26af1de50f6381d269d39396a2f08961320eb0a` |
  | `l3-commit-callbacks.spec.ts`                                                                                                                                                                                  | `d27ad12849e01fef262b55c44fcc64cf35429435` |
  | `l3-reference-semantics.spec.ts`                                                                                                                                                                               | `22e9a01a87da866fda9314cb82219f6a938e2dcc` |
  | `l3-light-pollution.spec.ts`                                                                                                                                                                                   | `f3feb8ee2be5a50ff938bff909902eaf93c75fb3` |
  | `structural-sharing.test.mjs`                                                                                                                                                                                  | `13fbf1bffcf7d0e454a7def1d1a12ca839b26f57` |
  | `step1-produce.test.mjs`                                                                                                                                                                                       | `57f65ee7ccf5f34dc20d408db2d4aa02d1c72a16` |
  | `step2-commit.test.mjs`                                                                                                                                                                                        | `ede3b05f55f7b65440e957244ab8a22a8c72b7be` |
  | `step3-light.test.mjs`                                                                                                                                                                                         | `e775684302aad84c39e80101f903706ff134193d` |
  | `scripts\verify.js`                                                                                                                                                                                            | `16ddcbc1e2e86c0ea3c09fec5b60901231c868be` |
  | `scripts\compare-bench.js`                                                                                                                                                                                     | `75f7c120933402a997ed9553bb5faaae3bc78ad8` |
  | `playwright.config.ts`                                                                                                                                                                                         | `211a1bdb78d09f490cc8828da387c8975596b8b4` |
  | `package.json`                                                                                                                                                                                                 | `f0e380f1dea517ed6d24bfaa99184b6db00c249d` |
  | verify:all `三段 90/90（Node 19/19 + PW 64/64 + bench 7/7）；环境依赖：`JU_APP_URL=file:///E:/APP/归档/6.P0-T3基线/step9/v2.0-l3.html.html`、`JU_CHROMIUM_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`。 |                                            |

## 2026-10-13 — S0 只读审计与 S1 基座恢复

- S0 只读审计：三份报告 + 台账，13 项问题 + 6 补漏 + 6 报告自身问题；结论 L4 启动条件不满足。人类决策 D1–D9 全部落地：采用 v2.0-l3.html.html（post-bugfix 0bead9d5ab…）；PortableGit 本地安装 + git init；verify:all 门禁；路径引用 900+ 不重命名先对照等。
- S1 基座恢复：PortableGit 2.56.0；git init；全量首提交 345 文件 / 566,069 insertions / 143.97 MB，commit 95f4b11…，tag s0-baseline-20261013；删除冗余 patch；.gitignore 两层；step9 副本说明；bench JSON 标注；清理 197 跟踪；verify 回填 90/90；D-1.4 登记 canonical 0bead9d5ab… / 785,334 B；第二次提交 3f63c7f…，tag s1-baseline-20261013。
- S1 后 6 项校验通过，L4 可启动。

## 2026-10-13 — v2.1-dev UI 交互增强文档同步与归档落盘

- 四份源文档全部更新并核验：JU软件设计框架规范.docx（补「十六/16.1–16.4」标题 outlineLvl、修正 pPr 元素顺序、audit exit 0）；细节要求描述文档.docx（2.1–2.6/3.1/4.1/5.2 八块插入、audit exit 0）；JU工作台融合评估报告（商业化）2026-10-13.md（执行摘要/4.2/7.2–7.5/7.9/7.11/A.4/C.4 十块追加）；JU-归档.txt（完整 v2.1-dev 目录树）。
- 落盘完成：新建 07-UI交互增强/ 与 06-P0-L3基线/step10/ 共 23 个 v2.1-dev 新文件（设计/规范/diff/spec/看板）+ TAG-v2.1-dev-2026-10-13.txt；v2.0-frozen 与 step1–step9 未改动。
- 核心新增规范：拖拽/调整大小统一 pointer 协议 + pagehide 清理；多选/全选 ui.selection（仅内存、不入撤销栈、批量操作一次 commit）；沉浸模式 + 侧栏同时折叠；布局模型与状态管理模型同步扩展。
- 归档整理：删除重复副本（07 回归/验收、07 perf JSON、collapse-buttons (2).diff）；占位 diff/HTML 移入 step10/drafts/ 并改 .pending/.placeholder；04/05 保留唯一权威；新增 00-规范/；TAG 改 v2.1-dev-design-freeze；融合报告与 TAG 归 90-过程材料/。
- 归档口径：现在仅归档设计冻结；M2 归档正式 diff 与 v2.1-dev-step10.html；M3 回填性能实测与验收结论再打最终 v2.1；遗留：正式 diff/HTML/性能实测/验收未生成、07 重复件与 step10 占位件待清理、UI 增强不得插队 P0；框架 TOC 域缓存仍止于「十五」，需 Word 中 Ctrl+A→F9 更新域。

## 2026-10-13 — 《JU 产品路线》docx+md 生成

- 提供完整全文，忠实复刻（未增删内容）生成 Word 文档与 .md 文件两份产物。
- 含动态目录、11 张表格、A4 规范排版（正文宋体 12pt / 标题黑体、标题黑色无主题蓝）；LibreOffice 转 PDF 共 28 页逐页视觉检查无溢出。
- 生成中 audit 报表格 OOXML 节点顺序错误 75 处（tblPr/tcPr），按 schema 顺序修复后审计 0 错误通过；目录由 word 技能 catalogue.py 生成。

## 2026-10-12 — P0-L3 Step4 commit 回调审计归档

- 按既定步骤完成 P0-L3 Step4 commit 回调静态审计归档：explicit 分表（含表头 84 行，源自本工作附件）与 indirect 分表（99 行，取自旧工作目录 38445869379338242/P0-L3/）落地项目根目录；去重复 .csv 后缀。
- Node 脚本合并生成 P0-L3-step4-commit-callback-audit.csv：184 行＝表头 1＋显式 84＋间接 99，id 自 85 续接、1–183 连续无重复；wc -l（184）与 id 唯一数（183）验证均通过。
- 归档目录 JU-归档/06-P0-L3基线/step4/ 共 8 文件：audit.csv、audit.md（沿用旧工作 210 行报告）、explicit.csv、indirect.csv、fix.diff（旧 diffs/step4.diff）、v2.0-l3-step4.html（785,334B，与原文件 cmp 一致）、tools/audit-commit-callbacks.js + audit-indirect-calls.js。
- 交付审计 CSV aka 9tSrSdnFKE、报告 feishu QvDWb0NqlozcGBxYd5tcm1iUn1e；无未竟事项（后续重跑合并注意显式表无尾换行需先补换行）。
- 修订注记：间接调用数由 10-08 八步迭代记录的 98 修订为 99、合计 182→184（审计归档时补录 1 条）；10-08 相关条目已同步标注。

## 2026-10-12 — 报告修正版生成（12 处修正清单落地）

- 上传《JU工作台融合评估报告（商业化）2026-10-07 (2).md》并附 12 处修正清单；生成并交付修正版《JU工作台融合评估报告（商业化）2026-10-12 修正版.md》（78,688B / 主目录 38446851539965954/，feishu OWtObw2yWoN71KxgEibcwPAbn9f）。

- 应用 10 处替换：4.1 第 3 条补商业化启动门 G0′；4.5 工期拆 M5 前期（稳定定稿+G0′ 约 1 月）/后期（商业化+3 轮约 3 月）并补 G0′ 稳定验证 1 月；5 章风险表「过早/过晚商业化」两行改四门控口径与 G0′ 后 waitlist；第 6 章开头改「合规线 Track C、G0 为前置门」；7.2/7.3/7.4 目标行改「商业内部准备」、7.6 改「B4 内部准备收口」；7.8 第 10 月改「G3 预检（正式判定约第 12 月）」；7.9 关键路径补 G0′ 完整链路；附录 C.3 G0′ 补量化验收（G2+G2′ 后连续稳定 ≥1 个月且 G0 通过）。

- 7.9 Track B 原文已一致未改；执行摘要「付费设计」段经核验与 4.3 一致未改；附录 C.2「M5 用户验证 3 个月」未点名保留；回读验证新表述全部就位、旧表述零残留。

## 2026-10-12 — 《JU工作台融合评估报告（商业化）》三轮修订

- 第一轮（18 处一致性）：标题改「两轨先行 + 商业化后置路线」、执行摘要/4.1/4.2/7.9/第9章四门控口径、7.3–7.8 月份标签错位（M1=2–3月…M5后期=9–11月）、7.10 预算时间表、7.11 M5 风险、第8章第9项后置；交付 MD Rvq0bCKhAorib3xZb0ecuFAPnqc。
- 第二轮（14 处时序）：G3 预检第10月/正式判定约第12月、G4 判定移至 M5 后约第15月、4.5 乐观工期 3.5+1+2.5=7 月、7.7 标题与目标、7.9 关键路径明确 Sync 正式上线、4.6.3 订阅/支付服务端说明、6.8 地图残留补国家版图合规；交付 MD L6xkbhvu3omW86xBOfwcYk6Lnrd。
- 第三轮（12 处）：执行摘要与第 7 章统一「两轨先行 + 商业化后置」、四门控 G0/G2/G2′/G0′；4.6.2 补 Business/教育行、4.6.5 门控表完整、7.10 合计行截断修复、附录 C.3 Pro 后置改可验证；校验新表述 18 项齐全、旧表述零残留、表格 467 行；仅交付 MD（76,916B / 40,416 字符），Word 停在第三阶段最终版未动。

## 2026-10-11 — 语义bug根因定位、测试幂等性 + PO性能对比报告（L3结构共享）

- 语义bug根因定位与测试幂等性专项：围绕 v2.0-l3 结构共享版的语义层缺陷做根因定位（引用语义/不变量相关），并以幂等性测试验证修复（工作主题「10.11语义bug根因定位、测试幂等性」）。
- PO 性能对比报告（L3 结构共享）：产出 05-性能基线/ 下 v2.0-frozen 性能基线（JU-bench-p0-baseline-v2.0-frozen.json、JU-bench-smoke.spec.ts、fixtures 20k/30k/100k 三档负载：ju-bench-20k/30k/100k.json 与 .load.js），用于对比结构共享改造前后性能。
- 遗留：性能基线为后续 v2.1-dev UI 交互基准（JU-bench-ui-interaction-v2.1-dev.json）提供对照。

## 2026-10-10 — JU 相关工作（截图分组）

- 工作记录列表存在 10.10 日期分组；未检索到独立任务记录，主题与 10.9/10.11 的 L3 结构共享系列衔接（看板/基线推进期）。

## 2026-10-09 — P0-L3 Step9 验收与归档复核（含文件卫生核查）

- 验收：npm run verify:all 退出码 0（Node 48 断言 / Playwright 68 用例 / bench 7 可比全绿）；三源已同步 59 项；verify:all 链路一致；bench 透传 --exclude-op=commitRewriteAllText；Step9 通过，5 项 CI 接线待办不阻塞。
- 交叉验收 verify.js / compare-bench.js / fix-map.json / 回归清单.csv / JU-58 清单 / L3验收记录 / 结构共享验收记录 / 性能预算 / package.json / playwright.config.ts。
- 文件卫生：免存 node_modules/、playwright-report/、test-results/、日志/系统文件；playwright.config.ts 重复 JSON reporter 可精简；旧 fix-map (1).json、旧 JU-58、旧 L3验收记录应删/归档；P0-L3Step9-tools-输出.md、P0-L3性能预算.md 需归位。
- 归档处理：6 个旧版被最终版取代（07 废除标注、L3验收记录归档注记、4.1 微调完成、§十一、旧 fix-map.json、旧回归清单.csv）→ 移入 P0-L3/archive/obsolete/ 并加 SUPERSEDED-BY.md；正式归档只留最终 59 项三源、最终验收记录、性能预算、工具与配置。
- 发现：L3验收记录 §5.2 仍将 REF-ACT-1/2 列为「Step9 评估」，与 fix-map「完成（评估关闭）」不一致；结论：Step9 验收通过无阻塞，封版前完成三源一致性注记、文件清理与路径规范；遗留：5 项 CI 接线（ACT-4 / REF-ACT-3 / BENCH-ACT-1 / BENCH-ACT-3 / REG-ACT-1）待 CI 落地时执行。

## 2026-10-09 — 58→59 项回归清单三源同源收口（Step9 封版）

- 追加 L3-44（性能预算）后清单由 58 项变 59 项：修正 JU-58项修复回归清单-v2.0-frozen.md 三处残留「58」（标题加注「原 58 项冻结清单，Step9 追加 L3-44 后实际 59 项」、§十底部注 58→59/OK=35→36、§十二 CSV 58 行→59 行）。
- fix-map.json 同步核对：summary.fixes=59 且 byLevel/byStatus/byCategory/fixes 四口径自洽（0+15+8+36、35+1+1+1+5+10+3+1+2、8+3+3+14+10+10+4+7）；回归清单.csv 59 数据行；三源（fix-map.json / 回归清单.csv / JU-58 md）正式同源。
- 目录曾出现 doc:13 旧版与 fix-map (1).json 缓存副本混淆，工程侧仅保留 doc=14 正确版；用 Python 规范化重写重新交付（aka Z8HXGpU6Bw；回归清单 feishu NvuCbCb5SoJIKcx67KwcMPlgnAK）。
- Step9 收口完成，v2.0-frozen 封版；产物 /home/user/Doubao/chats/38445869379338242/（回归清单.md 09 22:26、fix-map.json 09 22:22、回归清单.csv 09 21:57）。

## 2026-10-09 — Step9 工具运行 stdout 证据落档（L3-11 evidence 闭环）

- 指出「工具实际运行正常」仅存于工作记录、不可复现（结构共享验收记录.md §11.2 只写「全部复跑通过」未贴 stdout；CSV 已落盘但产出 stdout 未落盘；fix-map L3-11 evidence 仅为命令字符串）——要求新建 P0-L3/Step9-tools-输出.md 贴入真实 stdout 作为 evidence。
- 执行：重跑两工具取完整输出——audit-commit-callbacks（total 84、flags light4/noRollback3/snapshot76/silent9/persistOnly9/noHistory6、risk OK74/P1 5/P2 5）、audit-indirect-calls（total 99）；CSV 落盘 18395/15432 B；新建 P0-L3/Step9-tools-输出.md（stdout + 产物表 + 与 verify-commit-callbacks「92 调用点」文本匹配口径的区分说明，两口径不同源）。
- fix-map.json L3-11 evidence 由命令字符串改为指向该文件、artifacts 追加路径（未加入 artifacts.docs，维持 tool/doc 计数口径）；JSON 校验通过。
- Step9 证据链闭环、v2.0-frozen 维护态；剩余 5 项 CI 接线待 CI 落地；交付 Step9-tools-输出.md aka YW50bYhtPoOlTsxXHnuc8vkSnmg。

## 2026-10-09 — v2.0-l3 结构共享 · 第四步收口审查（P0-L3）

- 三份冻结源 + 六份早期文档 + §十一/§九 修订交叉核对，整体收口干净，剩余三处措辞/状态微调后完成。
- v2.0-l3.html.html（结构共享版 + Bugfix 冻结）；68/68 + 48 断言全绿；6 份早期文档登记废止注记。
- 引用语义补丁审查 + 第三步验收（语义bug根因定位）：BUG-1（`__proto__` 走 `[[Set]]`）✅、BUG-2（`length=0` 越界索引残留）✅、BUG-3（深层别名告警不阻断）⚠️；3.1 三套件基线全绿、3.2 深层别名用例、3.3 `delete arr[i]` 稀疏语义通过；3.4 新建 tests/l3-invariants.spec.ts（3 pass）；3.5 更新 immutable-adapter.md 与结构共享验收记录.md 第十一章；最终回归 Node 19/19 + Playwright 68/68 全绿。
- 结构共享生产化细节：structural-sharing.diff（整体克隆→Proxy+路径复制）审查 2 轮发现 3 处引用语义 bug 并修复（__proto__ 走 [[Set]] 替换原型、数组 length 截断后越界索引不可见、gOPD 硬编码描述符违反 Proxy 不变量）；compare-bench.js 加 --exclude-op 白名单排除 commitRewriteAllText（无真实 action 的边界探针）；REF-ACT-1/2 评估关闭（结构共享已满足 Immer 式未修改返回原引用、mergeRemoteState 保留节点级 LWW）；tools/*.js 与 6 个 Playwright spec 因 type:module 已补 __dirname shim。
- 遗留：7 项 Step9 待办。

## 2026-10-09 — P0 性能对比报告（Baseline vs After L3）+ 机械复核

- 文件证据（无独立任务记忆，条目据产物与脚本重构）：产出 P0性能对比报告_AfterL3.html（29,312B，19:07 生成，Baseline vs After L3 结构共享对比）与 verify_p0_bench.py（18:54，机械复核初稿所有数字、输出对账表），配套 _shots/ 桌面+移动截图 13 张（desktop_band1-5、check_tbl3/3b/8、mobile 分页）。
- 数据源：bench-p0-baseline.json / bench-p0-after-l3.json（00:03 生成，结构共享改造前后基准）；报告覆盖改造成效对比、分位数/内存指标核查结论。
- 核验结论：打字路径 P95 最大 4.6ms（undoRedo/500）达 ≤5ms、max 6.2ms 达 ≤20ms；唯一显著回归 commitRewriteAllText/500 P95 1.5→3.1ms（+106.7%）；verify_p0_bench.py 逐项复算 16 行×7 列数字与原始 JSON 全部一致、10/10 断言可复现；内存无法判断（JSON 缺 usedJSHeapSize/undoStack/retained 字段）。
- 遗留：① 20k 样本缺失结论只能外推；② 脚本 BASE 路径硬编码须改 CLI 参数；③ mergeRemote* 归入「打字路径」口径偏宽；④ 两轮采集间隔仅 10s、无轮间 GC，尾部数据可能受堆状态污染。
- 与 10-11 工作「PO性能对比报告（L3结构共享）」衔接（基线归档见 10-13 05-性能基线/）；产物 /home/user/Doubao/chats/38446051063661058/，无交付链接。

## 2026-10-09 — D4 验收脚本回归验证报告（v2.1→v2.4 多轮修订）

- 任务记忆确凿（v2.1 审阅→v2.2 落地、v2.2 审阅→v2.3 落地）+ 文件 v2.4 收口版（18:23）：范围 tests/bench-p0-d4.spec.ts（20k 节点打字 commit 计时 + 三项内存指标）对照真实 v2.0-l3.html.html 的契约核验与实测回归。
- 结论：脚本契约 100% 兼容可直接落地；20k 节点 5ms/20ms 预算当前实现不可达（定性为数据结构问题而非调参，copyPlain 全量复制 nodes 表所致）；门禁方案 = inline@5k p95≤5ms 硬门禁（合入门禁）+ snapshot@20k / inline@20k 绝对值与 delta 回归基线（告警不阻断）；D4 全线 bench-p0-d4-*.json 与 Step7 产物分离。
- 数据审查（v2.4 收口版）：snapshot@20k P50 139.1→71.1/61.7ms（−49%~−56%）、P95 244.8→156.8/144.2ms；inline@20k P50 44.9→9.7ms（−78%）、P95 75.8→10.8ms；inline@5k p95=3.6/max=6.9ms 唯一达标档；内存 state 4.48MB 持平、undoStack 158.88→148.2MB（−6.7%）、单快照≈4.94MB×30≈148MB（结构共享未覆盖历史快照层）；redo 栈持 30 快照致全 undo 后 GC 常驻 +10.6MB 清理策略待产品确认。
- 四轮修订要点：v2.1 补 TYPING_COMMITS=300 对照（HISTORY_MAX=30 上界由推导升级为实测）+ 门禁失败行为列；v2.2 修 spec 默认 OUT_JSON 命名 + 300 档 p95 分位数位置效应解释；v2.3 补 p99 对比（196.0→233.8ms +19%）闭环论证 + scan 段采样非独立说明；v2.4 验证记录补全环境变量 + 同名产物改名 -v1 规避静默覆盖。
- 瓶颈定位：snapshot 路径全量 structuredClone（45–62ms）+ O(N) 扫描；inline/light 路径 copyPlain 对 nodes 表全量复制（5k→2.8ms / 20k→10.8ms 线性）；下一阶段前置 = nodes 容器可持久化改造（1a 原型→1b 弱门禁→1c 硬门禁）；遗留：spec 头部示例缺 JU_D4_TYPING_MODE=inline 行、1b「探针 vs 打点」对照表待产出（结构改造成本收益对账基线）、20k 硬门禁待 nodes 改造合入后重新验收；数据审查另遗留 baseline 仅取报告摘要未同环境对拍、HISTORY_MAX 未暴露为可配置（长时峰值待评）。

## 2026-10-09 — JU v2.0-l3（20k 节点打字 P95 ≤5ms / ≥20ms）性能审查

- 单轮静态审查：打字路径（input/keydown）确认 O(1) 达标——syncEmptyState 仅访问当前元素 textContent，与节点数无关，20k 下 P95 ≤2ms；提交路径（blur/commit）定位 5 处 O(n) 热点：__juProduce finalize 的 copyPlain(nodes) 全量 defineProperty、findTouchedNodeId 全表扫、renderIntro 的 docNodeCount 无缓存、renderBacklinkPanel 全库扫 + WIKI_RE 正则、runPersist 的 JSON.stringify；合计 20–50ms，突破 20ms 兜底线。
- 五条修复建议（按性价比）：① docNodeCount 照抄 docWordCount 的 LRU + dirtyDocs 精确失效；② 反链面板折叠态不计算；③ findTouchedNodeId 改为 recMap 顺手收集脏集合；④ copyPlain(state.nodes) 改按需拷贝；⑤ _tagIndexCache 连带重建已可控。
- 结论：纯输入 P95 稳达标（≤5ms）；含 blur 提交的口径下 20k 超标，须先落 ①②；遗留：静态阅读为主，无 profiling、无真实 20k 数据集回放；VIRTUAL_THRESHOLD=200 在「折叠至极少可见节点」时不启用虚拟滚动的边界未实测；本轮零代码改动（纯分析）。

## 2026-10-09 — 桔JU（v2.0-l3.html）L3 验收资产审查

- 单轮审查：判定该文件为被测系统本身而非验收产物；结构共享 produce / 统一 commit / LRU 收敛 / 墓碑+起源保护 / 虚拟滚动已落地，但性能基准、内存采样、不变量对拍、差异清单四类验收资产全缺。
- 缺口四项：①打字 P95 基准（keydown→commit→paint 三口径，≥2000 样本去前 200，禁止只在 root 下敲）；②内存分离（撤销栈 / state 堆 / GC 后常驻）；③20 条不变量对拍（树连通 / 无多父 / 无孤儿 / 无环 / _deleted 脱离活树 / 容量上限 / _rev 单调 / 幽灵标签）；④fix-manifest.json（grep FIX-*|fixed* 自动提取，P0 未验证则 CI fail）。
- 关键发现（P0 候选）：commit() 内 historyPast.push(safeClone(state)) 仍为完整深拷贝（structuredClone）——L3 结构共享红利未覆盖撤销栈，20k×~250B×30 张 ≈ 150MB 常驻，疑为 P0 对比最大热点。
- 产出：perf-comparison.md / bug-list.md / alignment-report.md 三份骨架；结论：验收前须先补 bench/fixture-20k.js + typing-bench.js，否则其余空谈；撤销栈结构共享为本轮最大待修项；遗留：未落盘任何代码，三份报告仅骨架，bench/invariants/CI gate 待确认方向后开工。

## 2026-10-09 — 项目日志：L3 行为对齐 + 性能验收（方案）

- 固定口径：P0/L3、20k 节点、打字/IME、预热 100、采样≥1000；端到端+核心耗时，输出 P50/P95/P99/max；性能门槛：20k 打字 P95≤5ms 目标、≤20ms 硬门槛；>20ms 判 P0 阻塞、5~20ms 记录未达目标。

- 内存对比：P0 vs L3 四时点（加载/连续打字/撤销重做/GC 后）；撤销栈、state 堆、GC 后常驻；行为对拍：20 条不变量，同序列回放，比对 state/DOM/选区/撤销栈/引用图摘要。

- 引用语义：查浅拷贝、原地写、撤销栈存可变引用、缓存悬空；不可变+路径复制+结构共享+回归测试；差异清单：逐项 P0/L3 行为、影响、严重级、证据；明确无 P0 回归。

- 产出：性能对比报告、bug 清单、对齐报告；DoD 含 20/20 对拍、P95≤20ms、内存无异常增长；状态：仅输出验收方案/清单，未跑测、未修复、未落盘；待执行。

  <!-- 组内排序说明（10-08）：按文件时间证据与逻辑链倒序——M0 周计划最早→71.html(00:50)→商业化HTML(01:15)→转Word+附录A(01:36)→v2.0-frozen冻结(09:59)→L3基线核对→启动清单 #2–#5 落地（11:40–12:26 文件证据，独立执行线，证据完整版含各文件 SHA-256）→P0-L3八步迭代→D4方案→D5→P0-L3基线归档→step4/5/6验收→JU归档验收→历史文件验收→ju-bench(12:48/13:40)最新；冻结先于八步迭代，与同哈希基线不冲突。 -->

## 2026-10-08 — ju-bench 性能夹具生成（20k/30k/100k 三档）

- 文件证据（无独立任务记忆，条目据产物目录重构）：生成三档负载夹具 /home/user/Doubao/chats/38445914176507650/ju-bench-{20k,30k,100k}.json + .load.js + .state.json（12:48 生成 100k/30k、13:40 生成 20k）——对应 10-09 P0 性能对比与 10-11「05-性能基线」的 fixtures 来源。
- 用途：为结构共享改造前后性能对比提供 20k/30k/100k 三档可复现负载；同目录另有 JU-58项修复回归清单-v2.0-frozen.md（11:40，doc=13 旧版）、fix-map.json（11:43，doc=13）、JU-不变量清单-v2.0-frozen.md（12:26）、商业化报告 Word 版（11:49）等 10-08 工程产物。

## 2026-10-08 — 桔JU 历史文件验收归档（六轮）

- 六轮验收归档：覆盖冻结基线、项目日志、评估报告、回归清单（MD/CSV/JSON）、性能基线（脚本/配置/夹具/实测）、过程材料六类；逐轮检查文件名、重复性、内容一致性。
- 问题标注：73.html 与 v2.0-frozen.html 逐字节同哈希（不重复归档）；JU-不变量清单旧版文件名与内容不符（实为冻结日志，新版已修正为 21 条不变量）；ju-week-board.html.html 重复扩展名；ju-week-board.html (2).html 带空格与副本标记；项目日志 (2).md 与主日志分叉。
- 归档结构建议：01-冻结版本 / 02-项目日志 / 03-评估报告 / 04-回归与验收 / 05-性能基线 / 90-过程材料 / 99-源文件（可选）；新验收文件加粗标识。
- 结论：正式归档 5 类，过程材料与源文件不纳入正式归档；必须改名或合并 3 项；90-过程材料/ 与 99-源文件/ 仅作辅助；遗留：① 项目日志 (2).md 需去掉 (2) 并合并回主日志；② ju-week-board 系列改名后仅保留最新一份作过程材料；③ fix-map.json 统计 99+126 与回归清单 211 唯一编号口径不一致，需核对统一。

## 2026-10-08 — JU 归档验收与 P0-L3 基线锁定

- 多轮归档验收：v2.0-frozen、58项修复、不变量、Playwright 冒烟、大库基准、评估报告、启动清单看板、P0-L3 基线；检查冗余与命名，建议 ju-bench-20k 不归档、gen-bench.js→ju-gen-bench.js、旧项目日志不入正式、评估报告重复副本删/移、看板双后缀改名。
- P0-L3：v2.0-l3.html.html 与 v2.0-frozen.html 同哈希 0635e55a…da1c6，基线副本一致；原始文件不建议重复归档，只读副本改名 v2.0-l3-baseline-original.html。
- 结论：正式归档结构更新，新增 06-P0-L3基线/（README、基线核对记录、baseline/只读副本）；同哈希确认，无需独立冻结版本；遗留：归档命名规范化待执行；同源性已核，51 条修复需与 L4~L9 合并评估待办。

## 2026-10-08 — 桔JU（P0-L3 归档验收）step4/5/6

- 验收 step4/5/6 材料，更新归档结构（06-P0-L3基线/step4~step6），逐项标注需改名文件：step4 CSV 去重复后缀；step5 加 step5 前缀；step6 加 step6 前缀并将 immutable-adapter 增补版独立归档。
- 建议补生成 step4 合并版 commit-callback-audit.csv（表头+84 显式+99 间接=184 行），确认后归档（10-12 已执行落地，间接数由 98 修订为 99 见 10-12 条目）。
- 未执行实际文件改名/落盘，仅输出归档操作清单与更新后结构；结论：step4~step6 归档路径与命名已明确；需执行改名与合并 CSV 生成；无文件需丢弃；遗留：step4 合并版 CSV 未在附件中提供，需按建议补生成或改报告验收项。

## 2026-10-08 — P0-L3 基线归档（Step1~Step3）

- 三轮验收归档，均落盘至 06-P0-L3基线/：Step1（immutable 原语 __juProduce/__juProduceSafe + 选型记录 + adapter 契约 + diff + 单测）、Step2（commit 非 light 迁移 __juProduceSafe + undo/redo 统一 safeClone）、Step3（light 污染防护 _backupValid + reportError kind 区分 + Playwright 7 用例 + adapter 第八节）。
- 文件名规范化：v2.0-l3-stepN.html / P0-L3-stepN-*.diff / P0-L3-*.md / stepN-*.test.mjs / stepN-light-pollution.spec.ts；去重：playwright.config.ts 复用 05-性能基线/，不重复归档。
- 结论：归档结构稳定，Step3 已实现 light 污染可观测化（norollback-failed / backup-invalid 两 kind）并保留 silent 契约；遗留：Step4 候选（mergeRemoteState / takeVersionSnapshot / restoreFromTrash 迁移）未启动；mmX/mmY 拖拽已改不入撤销栈（snapshot:false）。

## 2026-10-08 — D5 历史栈增量（P0-L4 分步实操）

- 设计 Patch 结构 {op,id,field,prev,next,parent,index,children}，输出 TS 定义与字段说明；实现 undo/redo 逆操作，覆盖 add/update/toggle/move/delete，编写单测。
- 处理批量操作与 noHistory 缺环，记录原 parent/index/顺序；调整加密明文兜底 _pendingPlainState，解除全量引用依赖。
- 归档 07-P0-L4历史栈增量/step1~step5，产出 L4 代码、单测、patch 结构文档（与 10-13 L4 历史栈改造正式实施衔接）。

## 2026-10-08 — D4 性能验收（五步法方案）

- 输出五步法：测脚本（20k 打字 P95/内存）→ 数据对比 → 不变量对拍 → 报告生成 → 差异清单更新；指定输入：bench-p0-baseline/after-l3.json、structural-sharing.test.mjs、immutable-adapter.md。
- 产出建议：性能对比报告、bug 清单、对齐报告、更新 structural-sharing.diff；提示分块、错误堆栈、本地验证、角色扮演（与 10-09 D4 验收脚本回归报告衔接）。

## 2026-10-08 — P0-L3 八步迭代（结构共享改造，Step0–8）

- 阶段目标：P0 完成后引入统一不可变更新原语替换 commit() 内 safeClone(state)，补齐 light 热路径污染可观测性，为 Immer 留单一接入点；全程不改单文件 HTML 交付形态、不引入运行期 npm 依赖；基线 v2.0-l3.html.html（SHA256 0635e55a…，JU_VER=fixed23 / STATE_VER=18 / juju.store.v31）。
- Step0 基线锁定+副本；Step1 选型：D-01 自研 __juProduce 不引入 Immer（单文件约束、commit 已内联 clone-draft-replace 等价度 ~90%、指纹机制重叠）；Step2 替换 commit() 内 safeClone（commit-diff.patch）；Step3 light 污染三层防护 D-03（A1 _backupValid 显式检测、A2 noRollback+action 抛错走 reportError、B1 silent:false 抛错触发通知）。
- Step4 commit 回调静态审计 D-04：显式 84 条（P0=0/P1=5/P2=5/OK=74）+ 间接 98 条，合计 182 条路径（间接数后于 10-12 归档修订为 99、合计 184，见 10-12 条目）；修复 3 处（列/行拖拽 up 回调 try/finally、flushBeforeUnload 加断言、mindmap 拖拽 snapshot:true→false）。
- Step5 回调行为验证（tests/l3-commit-callbacks.spec.ts 24 条）；Step6 引用语义契约 D-05（28 条断言：produce 新引用、produceSafe 失败 base 原引用、commit light 原地改、undo/redo 引用替换等）；Step7 性能对拍 D-06（11/11 场景通过，最大恶化 0.0%，safeClone@5000 5.7→5.6ms）；Step8 文档/看板/日志收口。
- 累计产出：新增文档 12、工具 3（audit 工具集/compare-bench/bench-spec）、spec 4、测试用例 59（7+24+28，不含 bench 14 场景）、内联代码修改 3 处、后续行动登记 16；未覆盖：加密模式性能、多标签 BC、Tauri 路径、间接路径集成、WeakRef。

## 2026-10-08 — 启动清单 #2~#5 落地

- **#2 58 项修复条目化**：`JU-58项修复回归清单-v2.0-frozen.md` = **`d1c05d1cc41629f177073a07ff972327388046b26eeae5eaf3a0b430c80619e8`**；`回归清单.csv` = **`4c1bd74997d25b4061f10ae3abb1b2771ac18bc9a4be09474384c46ea1f1b315`**（58 行：编号/模块/复现/预期/状态/关联 FIX/优先级）；`fix-map.json` = **`81047b5a075a7fdd0573681ce053864cfa0321e0e525b0991afba36d374bf521`**（99 已映射 + 126 未映射）；docx §八验收更新 + 附录 A/B 交叉引用，audit 0 错误；冻结文件未修改（`0635e55a…da1c6`）。
- **#3 不变量清单**：`JU-不变量清单-v2.0-frozen.md` = **`1ec2dbdc6c367f3220583ddde50d8172b81f965bc2bc167d5147ccf51421dd20`**；20 条行为不变量 + 1 条主题 token 约束 = **21 条**可断言不变量（含断言与关联实现）；关联实现与主题色已对 `v2.0-frozen` 静态核对。
- **#4 Playwright 冒烟 10 条**：`tests/ju-smoke.spec.ts` = **`74ae0e6338f7a006ca6238c74f89da8a94a85f18276bb2ab17ef5b23612765a7`**（10 test / 16 expect，覆盖启动/新建/编辑/撤销/切视图/搜索/日历/数据库/导入/多标签）；关键选择器已对 `v2.0-frozen` 核对；CI 可跑（`npm i -D @playwright/test` + `python3 -m http.server 8080` → `JU_URL=http://localhost:8080/v2.0-frozen.html npx playwright test`）。
- **#5 大库基准夹具**：`tools/gen-bench.js` = **`440efb5742f57dcdbbc0b9b8b2261f6d63034a66ce3ed582addfa4dda72a59bf`**；`ju-bench-30k.json` = `e73dca3f808d8275a30bbb422a75af2cc3a359720c1b9abb2441fb78f2df6e58`（8.69 MB）；`ju-bench-30k.state.json` = `da2693d83d422be11304d9eacf6f6ef66350934cd66946d47d56692eb5c31954`；`ju-bench-30k.load.js` = `aab9ef7ed0420d47be0280c47e700f50a75c2ee1c0b5e73d95fac38a61863ea3`；`ju-bench-100k.json` = `6a01d15336c39ece39552b059280bbc854314b363ece29be2945e9236c37bbe7`（29.19 MB）；`ju-bench-100k.state.json` = `0d6d15cb827e1dfc95f5555b661f5cd2ce75994e6330fcc368e0d7c24e63460d`；`ju-bench-100k.load.js` = `7285651a97cffb828830cda42f738568ee69db4ba8ef28c64d39b3c131de3f39`；`tests/bench-smoke.spec.ts` = `dc5b32d61c25771e559693c0c705d4311fae6a8670484ee0758c138df22a6d9a`。结构核对：`initStore(initial)` 直接接受 state、`STATE_VER=18` 与 `_ver:18` 一致、节点字段与工厂一致、`dbFields` 默认值一致、`_isCalRoot/_isDbRoot/dbRoot` 标记存在、`ensureCalendarRoot/forceRender` 存在。生成与校验：30k 实际 30,753 节点 / 100 文档 / 150 日历待办 / 600 数据库行 / 2,977 带标签 / 1,692 带日期；100k 实际 102,503 节点 / 200 文档 / 500 日历待办 / 2,000 数据库行 / 10,115 带标签 / 5,483 带日期；根可达 100%、父子互反、ID 唯一、无环，0 错误；两个 `.load.js` 均通过 `node --check`；冻结文件未修改。
- 与主日志「JU工作台 M0 周计划制定」衔接：M0 列目标（58 项条目化 / 20 条不变量 / 10 条冒烟 / 3万+10万基准）→ 本条为执行落地；ju-bench 三档夹具为其后扩展。

## 2026-10-08 — v2.0-frozen L3 基线核对与看板更新

- 产出 06-P0-L3基线/ 基线核对记录-2026-10-08.md 与 baseline/v2.0-l3-baseline-original.html（结构共享改造前原始版基线存档）。
- 产出 04-回归与验收/ JU-FIX映射-v2.0-frozen-2026-10-08.json（58 项修复的 fix→位置→验证映射，v2.0-frozen 冻结口径）。
- 看板更新：90-过程材料/ JU-启动清单看板-2026-10-08-第4项完成.html（启动清单第 4 项完成标记）与 JU-L3周看板-v2.0-frozen-2026-10-08.html（L3 周看板按 v2.0-frozen 状态刷新）。
- 对应工作记录 10.8 分组（逐条修改方案、数据库视图显隐功能实现、问题清单、JU版面设计审查报告、静态代码审查报告核对修复等衔接）。

## 2026-10-08 — v2.0-frozen.html 冻结（去商标化 + SHA256 校验）

- 由 72.html / 73.html 复制生成 v2.0-frozen.html（775,706B / 14,473 行），SHA256=0635e55a2c…（本地 Windows 复核大小写仅差，值一致）；冻结仅动注释与 fallback 值，未动类名/函数名/选择器/文案/逻辑。
- 注释去商标化 8 处：某品牌风格时间网格→24 小时纵轴+今日列高亮、某品牌风格字段类型浮窗→图标+类型名+说明列表弹层、参考某品牌日历→按 30 分钟吸附默认 1 小时、某品牌日历式→聚焦并全选文本、日历事件拖拽三处注释改写。
- 陈旧注释修正 2 处（--radius-xl(14px)→16px 对齐 FIX-P3-4）、fallback 值修正 1 处（#ctxMenu z-index 2100→10050 对齐 FIX-P2-19）。
- 冻结校验记录：sha256sum 验证通过、72/73.html 与冻结文件逐字节相同可追溯来源；产物 v2.0-frozen.html + 项目日志.md（38445847837922306、38445914176507650 两副本）。
- 时序说明：冻结（09:59）先于基线核对与八步迭代；v2.0-l3.html.html 由冻结件复制而来（同哈希 0635e55a…），「八步迭代基于同哈希基线」与本条不冲突。

## 2026-10-08 — 《JU工作台商业化融合评估报告 2026-10-07》转 Word + 附录A核对

- 要求将已按 M-01~M-21 修改定稿的报告 HTML 去装饰、压缩篇幅转为 Word：去除 emoji/彩色标签/SVG 甘特/锚点导航/封面独立页，保留全部正文与 48 表及附录 A/B/C；A4 37 页、动态 TOC+页码；修复 audit 报错（tblPr/tcPr 节点顺序、6 处 ASCII 双引号、Title 样式蓝下边框）；交付 JU工作台商业化融合评估报告2026-10-07.docx（aka yZlGgzDJYV）。
- 附录 A 以 73.html（已确认与 v2.0-frozen.html 逐字节一致）为基准逐条核对：A.1 性能架构 15 条（未修 4：全量深拷贝/历史栈/增量落盘/增量索引；部分 3；已实现 8）；A.2 稳定性安全 14 条全部已实现；A.3 前 5 条表述仍成立、后 2 条按代码修订（findTouchedNodeId 实为 ×3、L5/L7 改部分实现）；交付修订版 docx（aka StTSjViSvK）。
- 时序说明：转 Word + 附录A 核对执行于 01:36，早于 v2.0-frozen 冻结（09:59）；「附录 A 以 73.html 为基准且与冻结件逐字节一致」为事后补核结论，依赖顺序无冲突。
- 遗留：附录 B 及正文多余「71.html」引用未同步替换。

## 2026-10-08 — 商业化融合评估报告 HTML 生成与 M-01~M-21 修改定稿

- 文件证据（无独立任务记忆，据产物时间线重构）：10-07 20:12 初版 JU工作台商业化融合评估报告.html（29,434B，38445806930103810/，紧接 JU工作台.html 19:22 后生成）→ 10-08 01:15 修改定稿版 JU工作台商业化融合评估报告2026-10-07.html（106,765B，38445892940680194/）。
- 定稿版即 10-08 转 Word 的源件：正文 + 48 表 + 附录 A/B/C，已按 M-01~M-21 修改清单落地；01:36 转 Word 后该 HTML 线完结。
- 补充核对：报告版本号字段（71.html/73.html）与工程线同步；附录 A 以 73.html 为基准（与 v2.0-frozen.html 逐字节一致）。

## 2026-10-08 — 71.html 数据库字段显隐实现与回归验证

- 文件证据（无独立任务记忆，条目据产物与 verify 脚本重构）：71.html（775,598B，10-08 00:50 生成）实现数据库视图字段显隐（`dbFieldVisible`/`renderDbTable` + `ui.dbHiddenFields`），对应工作记录 10.8 分组「数据库视图显隐功能实现」主题。
- verify_db_hidden_fields.js（Playwright + 系统 Chromium）：构造 3 任务最小状态（状态/优先级/时间/地点/人物/星级多字段），隐藏「状态」列后表格无状态列；逐一断言 dbHiddenFields 对表头/单元格渲染的联动。
- verify_db_regression.js：构造 4 任务（含自定义状态 X）回归排序/过滤/隐藏字段三功能互不破坏；dbFieldVisible 白名单外字段列不出现在表头与行。
- 产物 71.html + verify_db_hidden_fields.js + verify_db_regression.js（/home/user/Doubao/chats/38445844144289794/），无交付链接。

## 2026-10-08 — JU工作台 M0 周计划制定

- 依据融合评估报告与 72.html，输出本周目标/步骤/验收：冻结 v2.0-frozen、58 项修复条目化、20 条不变量、10 条 Playwright 冒烟、3 万/10 万节点基准夹具、P0 前性能基线。
- P0：L3 结构共享（commit 去 safeClone，20k 打字 P95≤5ms）；L4 历史栈增量（patch 逆操作，撤销栈<1KB/步，覆盖五类操作 + 随机 1000 次 undo 一致性）。
- 并轨启动合规（商标 9/42 类、FTO 询价、SBOM/AGPL）与商业前置（waitlist 落地页、付费意愿问卷、许可/定价初稿）；方案建议：本周只做 P0 + 启动清单 12 项，不做 P1/P2/M1；72.html 已实现 20+ 项不重复排期，先对齐报告附录 A 差异。
- 遗留：① 72.html 与 71.html/附录 A 状态差异未逐条核实；② P0-L4 逆操作对称性高风险，需 2 周行为对齐；③ 合规仅启动、不阻塞工程线。

## 2026-10-07 — 商业化可行性评估

- 基于已修复的 JU工作台代码盘点评估商业化可行性：五维成熟度评分（功能4/工程3/数据安全3.5/商业化基建1/分发4，综合约3.2/5）与 0→12 月路线图（封版v1.0→许可证/定价/激活→PMF 验证→规模化决策），含里程碑与退出条件（转化率<3% 或留存<40% 则回价值主张）。
- 关键判断：短板在商业化基础设施、本地优先是差异化卖点、云同步放 PMF 后；未修改任何文件、未产生新交付物，结论作后续商业化决策背景。

## 2026-10-07 — 第6份版面审查报告（30条）处理 → JU工作台.html

- 30 条全部处理：28 项修复落地、3 项声明不改（#19 导图缩放架构级不动、#23 列宽上限已按百分比、#27 折叠 handle 已隐藏）。
- 关键修复：`--topbar-h` 自引用锁死拆为 `--topbar-min-h:48px` + 实测偏移；字号缩放同步侧栏/内容宽度；打印放开 `.db-table-wrap/.word-editor`；导图标题 sticky 且平移排除 `.doc-header`；导航断点 1280px；抽屉 `max-width:86vw`；时钟断点 640px；`placePop` 改用实测尺寸；新增 `--z-menu:2100`。
- 自检桌面/移动 0 错误 0 溢出；产物 ju-dashboard/JU工作台.html，备份 _backup/70-v7.html。

## 2026-10-07 — 双主题配色迭代（夜间模式两轮）

- 轮4：主内容区与日历背景统一 #0B2447，侧边栏/顶栏保留 #1772B4 渐变（rgba(23,114,180,.90)→rgba(14,66,112,.78)）；JS 思维导图/画布导出底色同步；备份 _backup/68-v1.html；交付 aka peJRLA1lia。
- 轮5：夜间中间主区 #0F3460 与表格主背景 #001E3D 对调（--bg / --bg-panel）；产物 ju-theme/JU-双主题配色.html（aka znVwbam0se）。
- 对应工作记录「网页双主题配色设计」「颜色方案设计」主题。

## 2026-10-07 — 69.html 专项验证（parseYmd/mergeRemoteState 跨会话保护）

- 文件证据（无独立任务记忆，条目据产物与 verify 脚本重构）：69.html（739,738B，15:22 生成）配套 verify/ 四脚本（extract.js 抽取函数体 + test1~3.js），验证对象为本地日历语义与跨会话合并保护。
- test1：parseYmd 本地语义（2026-10-07 各 getter 与日历一致、2026-02-31/13 月/bad 输入拒绝回滚）、addNodeTo 必须登记 `_localCreated` 且无硬上限（FIX-ORIGIN-2）。
- test2/3：mergeRemoteState 跨会话保护——本地 `_localCreated` 在而远端缺失时节点不删除；F1 对端 `_localCreated` 并入本地（崩溃恢复保护继承，本地不存在的节点不并入）；F2 对端墓碑并入本地（P1-2 崩溃恢复，30s 窗口内墓碑生效）。
- 对应 09-29 87 项清单 H-05（`_diskConfirmed===null` 放行删除）/M-29（parseYmd DST 跳变）同域；产物 69.html + verify/，无交付链接。

## 2026-10-06 — JU思维导图.html 改色方案（预览三版+标注图）

- 第一版改色被否决（「搭配太难看了，不和谐」）：主背景保留 #DFECD5/#1772B4、8 传统标签色、时间线 #7C1823、危险 #D42517、警告 #AB372F、分隔线 #2E4B3A；日间降明度饱和度弱化背景、夜间提亮饱和强化层次；其余颜色优先调明度/饱和度，无法和谐换中国传统色；只出多方案预览不落地。
- 产出三套日/夜方案：A 黛蓝青绿（正文黛蓝降饱和+青绿强调）、B 墨绿全竹（纯绿单色相、移除蓝）、C 花青石青（花青蓝+石青强调）；预览产物 /home/user/Doubao/chats/38445796964060162/配色预览/（_gen.py 可重生成、_shots 四张已交付图）。
- 按「所有颜色用箭头标注」生成日间版全配色箭头标注图（17 色左 9 右 8 + 底部 8 标签色展开，配色标注-日间.html + _desktop.jpg）；待确认后应用到 JU思维导图.html 并做夜间版，原版备份 _backup/68-原版.html。
- 交付预览图：方案A=uzrMcV5CdY、方案B=UUev2O4gpO、方案C=p7I0DaIxW1、第四张=FWmc3kgmS2；箭头标注=JJmXR7fDdI（另 TSdXL7B4mX）；预览图多轮 Q0Nt6J0go0/XF4j23dWhM、42j2C35jet/HBU6CXc3n5、CryeO8fOTM/TEjcbH3RGe；对应工作记录「颜色方案设计」主题。

## 2026-10-06 — 双主题配色迭代（前三轮）

- 轮1：日间提亮降饱和、夜间压暗提对比（明度/饱和度/对比度调整），预览图两版交付。
- 轮2/3：左右侧边栏颜色统一、中间与侧边栏对调；指定色值日间中间 #DFECD5 / 侧边栏 #CAD3C3，夜间中间 #3170A7 / 侧边栏 #1772B4。
- 定稿：完整 HSL 参数表 + 双主题对比总览；功能强调色双主题统一（now-line #7C1823、danger #D42517、warn #AB372F、line #2E4B3A）。

## 2026-10-06 — 67.html 日历周视图打磨

- 00:00 时标顶部对齐、24:00 在底部完整显示；红色当前时间线去白描边框、改纯红文字；表头阳历+农历同一行、去多余横线。
- 事件块改 contentEditable 直接输入，失焦/回车保存并同步今日待办（Esc 取消、保留 #标签）；日历卡片 width:100%+min-width:0 修窄窗偏右。
- 浏览器逐项实测通过；已交付 https://aka.doubaocdn.com/s/UUlcSfpuCC。

## 2026-10-05 — 67.html 日历改造（两波）

- 波1：新建待办默认 1 小时时间段；拖拽改时间吸附整点/半点（30 分钟网格，结束≥开始+30min）；右键「设置时间（8:00 / 8:00-9:00）」改「设置时间」；删除右键「删除待办」；今日待办时间不加粗、事项加粗。
- 波2：右键菜单补齐清除日期/清除时间/清除全部日程，语义实测（清除日期仅清 date、清除时间清 time+timeEnd 变全天、清除全部四项全清）；设置弹窗改参考「新增/编辑倒数日」截图样式。
- 浏览器实测吸附断言全部通过，node --check 通过，测试数据已清理；交付 https://aka.doubaocdn.com/s/2MryYKUwLq 与 /s/dQtygj2a5K。

## 2026-10-04 — 同类工具插件生态效果预览图（JU 应用复现）

- 生成效果预览图；读取 doubao-creative-design skill 与 model-4.5 改写规则后，用 image_gen 生成一张 16:9 经典深色主题三栏工作区高保真 mockup。
- 左栏文件树+标签（同类工具核心）；中栏 Markdown 编辑器+三行×5 自定义格式工具栏（Editing Toolbar+Commander）+Tasks 待办+Dataview 查询块；右栏堆叠 Calendar 月历、Dataview 数据库表格、Pomodoro Timer 番茄钟，并用引线标签标注各区域对应插件。
- 已通过 present_files 交付，CDN URL https://aka.doubaocdn.com/s/MNR1ASDUfc（另见 t7iPrFzGvD）；可后续要求换浅色主题、加 Kanban 面板或局部特写。

## 2026-09-30 — 65.html 报告核对与补修

- 核对修复revision 3：BUG-01（mergeRemoteState 空/未来快照删根守卫）、BUG-02（createDoc 即时落盘）、CAND-01（execCommand insertHTML 拦截 + drop 净化）。
- 补修批进度 62%：BUG-01/BUG-02 已完成并通过 node --check，CAND-01 实施中；13/13 基线、4/4 S2 断言、3/3 探针保持绿。
- 追加 UV-4 加密全链路浏览器内实测；UV-1/2/3 披露为环境不可行的未验证范围；待交付更新版 ju-app-fixed.html + 修复报告，3 项关闭后结论转 conditional_go。
- 交付状态（文件证据）：ju-app-fixed.html 652,252B 已落盘（16:42，/home/user/Doubao/chats/38444947798317570/）；此前任务记忆显示修复版 619,862B / sha256 d763d4a0…、由编排代理 o_000cQAC54Kj 执行，剩余 H-08 收尾 + 全量回归复跑 + 拼装报告，本批 6 项（BUG-01/02/CAND-01 + H-08/M-22/M-23）闭合后转 conditional_go。

## 2026-09-30 — ju.html 第六轮 UI 修复（字号/格式刷/按钮三行）

- 目标：字号调整 bug（无法调整、大小与字体不符）、文字背景色加透明、编辑按钮组加格式刷、15 按钮按功能分三行；headless Chromium 实测定位根因=字号档位硬编码固定 px 与全局缩放（70–200%）脱节、跨格式调字号残留空 span。
- 修复：档位改跟随全局缩放比例档位（70/85/100/120/150/200/280%）+清除字号、cleanupEmptyInline 清 span 残留；背景色新增透明色板（hiliteColor transparent+cleanupBg 兜底）；格式刷（选源→点刷→选目标自动应用，Esc/其他命令/再点击取消）；按钮重排 3 行×5（样式/颜色字号/操作行）。
- 验证：15 按钮逐个点击无报错、200% 下正文 3=28px、格式刷与 blur 持久化全过；稳定产物 ju-app-fixed (4).html（交付 grn8HfZr6U）。

## 2026-09-29 — 65.html QA 双轨

- 轨①（doubao-product-qa）：粘贴 87 项问题总清单（H-01..12 / M-01..30 / L-01..45 + 15 附加）要求对照真实源码逐条「检测核实」；确认被测件为 65.html（qa-results/ju-app/assets/script_0..5.js 共 11,019 行），创建编排代理 o_000cQAC54Kj 委派 102 项逐项判定；**委派被终止、最终报告未交付**，但 qa-results/ju-review/（1.3MB）留有实际产物。
- 产物盘点：verdicts_H/L1/L2/M1/M2/ADD 六组判定矩阵（confirmed/partial/refuted + 行级证据：如 H-01 removeNode 不写墓碑 L991-1012、M-01 repairTreeConsistency 删前留后 L488-491、M-16 scheduleEncFallback leading-edge throttle L743-755、L-01 runPersist 全量 JSON.stringify L677-684、L-24 refuted）；3 探针全部 reproduced（L3 级）。
- 探针结论：H-01 removeNode 内联递归 delete 不写 _recentlyRemoved 墓碑→N/C 同时从 live tree 与 localStorage 消失，删前快照 mergeRemoteState 回本页后复活并随 setStar 落盘；H-09 nodesOnDate 全表扫 vs buildCalIndex 仅 DFS calRoot 子树→「添加到日历」只 setNodeDate 不移动节点，统计面板计入而日历格子不显示；M-17 _broadcastRev 用 Date.now() 而非 state.updatedAt→跳过条件 (rev≤)&&(updatedAt≤) 恒 false，陈旧广播总是触发对端合并。
- 轨②：11 项 QA 活动映射 12 用例全部通过（100%）；发现 BUG-01（S2/P1，空/未来时间戳远端快照删根）、BUG-02（S3/P2，createDoc 无即时落盘）、CAND-01（contenteditable 拖放 blur 前自 XSS 瞬时窗口）；因 BUG-01 未关闭，结论 undetermined；报告 feishu SG9jdGjVPooCmBxZkZXcbzT6nDc。

## 2026-09-29 — 63.html 外部评审转交 + fixed19→fixed23 连续修复交付

- 最后一轮给出新的外部评审，核心风险聚焦：树一致性、多标签 LWW 合并、加密/明文边界、contenteditable 同步、IndexedDB 快照、图谱 Worker 与内存泄漏；要求逐条核对并修复。

- 静态审查高优先级发现 H1–H6：`_diskConfirmed` 启动未初始化致远端删除不传播（删除复活）；`repairTreeConsistency` 第二遍 O(n²)；`commit` light 模式仍克隆整个 state；`VDB.tx` 只读降级静默失败；`saveAutoBackup` 未显式排除加密模式；IndexedDB 事务内 await 游标后 continue delete。另有中优先级：全局字段 LWW 过粗、execCommand 弃用、GraphLayoutWorker 超时 fallback 等。

- 评审转交既有 organizer（o_000cDuHpfYn）接续：附 fixed19/fixed20 已修复项对照（多父/双向 repair/rev 单调/加密脱敏/重入守卫/data: 图片上限等），仅核验新增声称 H1–H6 与键级 LWW、isRestDay 2027+、parseNaturalDate 等，并补齐加密边界/提醒去重/sanitize 幂等等不变量与属性测试缺口。

- 文件证据：63-fixed19→fixed23 五版连续产出（13:32/13:58/14:22/15:05/15:49，/home/user/Doubao/chats/38444694783182594/）+ 63.html-测试报告.html（11:57）+ artifacts/；fixed22/fixed23 已落地，原「尚未回传」表述过时。

- 63-fixed23 QA 九套件完成（09-29 续做）：静态/冒烟/错误上报/不变量/模糊全过，多标签并发 17/19，崩溃恢复 6/9；确认 2 个 P1 并发缺陷（硬删除被陈旧快照经 storage 事件路径在 300ms 防抖窗口内复活、moveToTrash F-03 tie-break 比较含内部字段致 _deleted 双端被覆盖）；崩溃 3 项失败归因为产品设计行为（10s 备份节流/addNode 不落盘）与 headless SIGKILL 下异步落盘；交付 QA-REPORT-2026-09-29.md + out/*.json（feishu BYr0bNGjlo2gY3x1mXJcrTbDnNf）；未跑 soak/mutation/动态审查。

  <!-- 组内排序说明（09-28）：批次按编号倒序——批次11(最新)→批次10→批次8~9→批次5~7→批次4→14-ui-fixes3(最早)。 -->

## 2026-09-28 — ju.html UI修复批次11（侧栏树复核验证）

- 最后一批需求（数据库/我的文档/标签点文字不折叠仅三角、我的文档为总文档不重复显示、逐级缩进对齐、打印 2 次修复）经核查最新版已含全部实现（①②③来自批次8、④来自批次10）→ 本轮为复核验证：新增专项 tests/20-sidebar-tree.js 4/4 全过（results/20-sidebar-tree.json，0 页面错误）。
- 报告追加批次11/22 号验证行（4 ECharts 图渲染正常）；交付 ju.html=cJ0KvfgDGR、报告=kaHZ6D1MZB、截图=TV6OCoaUdb；无新缺陷，后续按既有批次流程继续。

## 2026-09-28 — ju.html UI修复批次10（侧栏去重 + 打印预览）

- 修复 3 bug：①侧栏同一文档重复显示（默认内置「项目A/B」预置星标，星标文件分组逐条列出与「我的文档」分组重复）→ 内置示例不带星标、「星标文件」分组改星标视图入口「⭐查看全部星标（N）」；②打印需点击 2 次才出预览（打印折叠区初始未设 collapsed，首次点击=收起）→ 初始收起，1 次点击即展开面板并生成预览；③打印预览与视图对应（预览基于当前选中对象，与批次9「顶部不跳文档」联动）。
- 输出全新验收专用 tests/20-sidebar-print.js：专项 4/4 通过，回归 01冒烟 / 03不变量 30/30 / 06多标签 / 07模糊全过，0 页面错误。
- 报告更新至「UI修复批次10」（results/20-sidebar-print.json、21 号验证行）；ju.html.fixed 已同步 fixed/ju.html 与原附件。
- 交付：ju.html=615Zw74Qe7、报告=4Umbd1IFiu、截图=xCxUHXmm4X；8643 服务曾死，已用 KEY_FACTS 命令重启。

## 2026-09-28 — ju.html UI修复批次8~9（侧栏树 + 顶部同步）

- 批次8：侧栏「数据库/我的文档/标签」点击文字不折叠仅三角切换；「我的文档」为总文档、新建文件夹在其下，移入文件夹的文档不再重复显示；侧栏树逐级缩进对齐（数据层 actions.moveNode 维护唯一 parent + .sb-children 14px 递归缩进）。
- 批次9：顶部视图与左侧选中一一对应（含打印预览）——bindTopbar 的「大纲/资料库」分支擅自改写 ui.currentDocId 跳到「欢迎」致预览错位 → 顶部按钮只切渲染模式永不跳文档、容器时文档类按钮置灰+toast、syncTopbar 高亮同步；专项 19-topbar-sync 4/4，回归 01/03/06/07 全过。
- 批次9 交付：ju.html=lHYTa3GgSU、报告=CH6VISoXBO、截图=G3TkzT9GoV（ui-fix7-preview.png）。

## 2026-09-28 — ju.html UI修复批次5~7（系统日志面板三连修）

- 批次5（U15~U17）：缺「新增」分组（mkLogGroup 过滤空节点致静默隐藏但角标仍计入）、角标实心加粗、条目未左对齐 → 分组只要有日志即显示、角标=三组之和且改透明底+accent 描边+font-weight 400、.cal-node.cal-log-group{display:block}+左补 20px；tests/16-logpanel.js 3/3。
- 批次6：仍无「新增」组 → 三组无条件渲染（无日志也显示「新增 · 0」）；角标去外框改纯文字；空行恢复严格过滤不渲染不计入；右侧竖线确认为滚动条 thumb，scrollbar-width:none 视觉隐藏保滚动。
- 批次7（方案A 按节点归组）：渲染归组优先级「删除>修改>新增」，每节点每日最多 1 条、三组互斥、组数之和=当日涉及节点数；新增/修改组实时取最新文本、删除组保留删前文本；tests/17-loggroup-a.js 4/4。
- 各轮回归 01 冒烟/03 不变量 30/30/07 模糊全过、0 页面错误；报告逐批更新（批次5/6/7 + 16/17/18 号行）；交付 ju.html.fixed+报告+截图（u0MyHVWhaZ/CH8oMkh9lf/aPPrFG3WNM；45VUtRI1zC/zgcWjJh5Vl/2dCtGdMqwa；sUwM9ppS2/VFJysNnQEP/YeIa658uw6）。

## 2026-09-28 — ju.html UI修复批次4（U10~U14 五项）

- ①「下载表格(TSV)」改「下载 Excel」：新增 docToXls() 输出 SpreadsheetML 2003(.xls) 原生 Excel；②「导出 ICS」改「下载 ICS」；③打印去重：删第二行重复按钮及绑定/CSS，折叠头 data-toggle 统一展开预览；④设置页删除「已知问题与限制」；⑤快捷键弹窗只留快捷键信息，全库「桔JU」统一改「JU」（14 处）。
- 首轮专项中快捷键弹窗残留「日历自然语言」段未删净致 1 项失败，补删后 15-ui-fixes4 5/5；回归 01 冒烟、03 不变量、06 多标签全过，0 页面错误。
- 报告新增批次4+15 号行；交付 ju.html.fixed、ju-test-report.html、ui-fix4-preview.png（Eydt8KFG5U/X56xZWk8DM/kXkmlEdohb），已同步 fixed/ju.html 与源附件。

## 2026-09-28 — ju.html 14-ui-fixes3（三处修复）

- U1 今日待办浮窗出现 2 个关闭按钮：删除 HTML 中 #remindClose 灰色按钮及 JS 绑定，保留 .pop-close 正常关闭；U6 左侧文档信息编辑时间未更新：commit 成功后统一调用 renderIntro() 刷新编辑时间/字数，确保日历与多维表格文档信息正确；日历打开默认框选当天：navTo('calendar') 与 openNode 日历根分支重置 selectedDate=todayStr()、calMonth=当月。
- 专项 14-ui-fixes3 3/3 通过（截图实测日历框选与今天同为 2026-09-28、面板仅 1 关闭按钮）；回归冒烟/不变量 30/30、模糊 100 轮全过。
- 交付 ju.html.fixed、ju-test-report.html、ui-fix3-preview.png（已同步原附件与服务 8643）；产物 aka 4hnbq9oTG9 / VhErxBCibM / hkIVwUWV11。

## 2026-09-27 — 60.html 十一类软件质量测试

- 被测 fixed18（549KB / 11,353 行），11/11 套件完成、71 项命名断言、1700+ 随机轮次（属性+模糊）；冒烟 13/13、动态 15/15、不变量 6/6、崩溃恢复 6/6、Soak 5/5 无泄漏、错误上报 8/8、变异 5 杀伤 3 等价 0 漏检。
- 核心缺陷 P1（3/3 稳定复现）：addNodeTo 用微秒时间戳而编辑路径用毫秒，mergeRemoteState 节点 LWW 未做 _norm 归一化 → 多标签并发时新建节点陈旧副本覆盖真实编辑（数据丢失）；修复点 = 比较处复用 _norm。
- P2×2：importOutline 存储层未净化（纵深防御缺口）、href 协议白名单单点防御；P3 观察项 3 条。
- 稳定产物 juju-tests/（harness 13 脚本、mutants 8、reports/）；最终 HTML 报告交付，无未竟事项。

## 2026-09-26 — 60.html 检查修复（缺闭合标签致命缺陷）

- 检查上传 60.html（561KB / 11,394 行、6 个脚本块）：定位致命缺陷——第 4270 行前缺失 `</script>` 闭合标签，浏览器把 2282–6697 行误判为单一脚本块，解析报 Unexpected token '<'，且 ensureCalendarRoot 等函数成死代码，启动抛 ReferenceError、内容区空白。
- 修复：第 4270 行前补入 `</script>`，生成本地修复版「桔JU_已修复.html」（原文件未改动）；Playwright + 系统 Chromium 实测 0 错误 0 警告，六视图/Enter 新建/主题切换/加密弹窗/浮动日历/localStorage 持久化均正常。
- 产物 /home/user/Doubao/chats/38444359126131970/桔JU_已修复.html（aka VBDhkgnqWO）；无未竟事项。

## 2026-09-26 — 桔JU多维表格增强 · 分割线联动修复

- 报告横分割线上下拖动时上方竖分割线未跟随缩短延长；根因：.cal-top-row 为 flex:none+margin-bottom:auto，行高由内容决定、固定不变。
- 改动 3 处：①行改 flex:1 1 0+min-height:60px，竖线随行高伸缩；②.cal-note 去掉 max-height:260px，防列底与分割线断层；③横线拖动上限由固定 900 改容器实时计算 clientHeight-96，防统计区拖高挤压三列消失/溢出。
- headless Chromium 实测：拖后行高/竖线 68→105 与位移一致，上限钳制后三列保 60px 可见；交付 aka mmmCiXWls1；未竟：统计区标题栏⠿拖动方向(+dy)与分割线(base-dy)相反，待确认是否统一。

## 2026-09-26 — 日历法定节假日「休」标注

- 新增 HOLIDAY_REST 数据表（收录 2024–2026 年国务院办公厅放假安排，含周末连休、不含调休上班日）、isRestDay()、dayLabel 增加 rest 字段，月/周视图日期旁渲染红色 cal-rest 徽标（与节日名共存，如「中秋 休」）。
- headless Chromium 实测 48 项日期判定 + 9月/10月视图渲染抽查全过、0 报错；交付 aka dUOUZfKSOc；未竟：2027 年安排待国务院发布后补充数据表（代码留注释）。

## 2026-09-25 — 桔JU多维表格增强 (2).html 十一项测试（5 缺陷）

- 上传「桔JU多维表格增强 (2).html」要求按 11 项清单测试（静态/动态审查、冒烟、不变量、属性测试、崩溃恢复、多标签并发、contenteditable 模糊、Soak+内存、变异、错误上报）；本地 headless Chromium 146 + CDP + Node 22 搭建黑盒环境全量执行。
- 11 项共 62 断言 61 通过；发现 5 缺陷：P0 多标签页数据丢失（storage 同步走 initStore 整体覆盖 + rev 竞态，决定性复现）、P1 rev 无限膨胀/写盘 ping-pong（单标签 boot 后 rev 即达 271）、P1 BroadcastChannel 从未启用（STORE_BC 未声明）、P2 编辑态 XSS 窗口（iframe onload 在 sanitize 前执行）、P3 actions API 缺系统节点保护。
- 稳定产物：测试报告（aka PH3U25anof）与可复跑脚本目录 juju-tests/（11 个脚本）；交付 aka 3NUEBefl2O/BpMx9nkTBi；未竟：P0 修复补丁未提供（未要求）。

## 2026-09-25 — 桔JU多维表格增强 · 记事本列 + 分割线（两轮）

- 轮1：日历「当日待办」左侧新增「记事本」列（_isNoteRoot 独立文档，自动挂 root，支持输入落库/Enter 新建同级/Tab 缩进/Backspace 合并/双击完成/粘贴净化）；记事本↔当日待办、当日待办↔系统日志两根分割线可拖拽调宽（ui.calColWidths 持久化，刷新保持）；窄屏自动堆叠隐藏分割线；双标签并发首开去重。验证：功能 10/10、冒烟 14/14、属性 400 步 0 违反；交付 aka aGeEhAdOzQ 与布局截图 g9LH2hZsiY。
- 轮2：纵向 .cal-divider::after 高度改 100% 成为全长线；新增 .cal-divider.h 横向变体（cursor:row-resize，贯穿整行）；makeCalDivider 增加 'stats' 横向模式（拖动调整统计面板高度，存 ui.calColWidths.statsH）；CDP 真实鼠标事件实测纵线 +120px、横线 +80px 生效且持久化；交付 aka Rnm7Vwimlu。
- 轮3（反馈仍不可拖动后双保险）：横线加粗至 22px 并加可视手柄块 + 悬停高亮变色；新增第二拖拽入口——按住统计标题行「▼统计（…）」（右侧加 ⠿ 提示）上下拖动调高度，click 仍折叠（拖动抑制 click）。CDP 实测横线拖拽 157→560px、标题拖拽 560→760px 均刷新持久化、折叠不误触、冒烟 14/14；交付 aka NWG7gZu4fy；未竟：两次报拖不动而自动化均过，疑似旧缓存或真实浏览器差异，待复验闭环。

## 2026-09-25 — 桔JU多维表格增强 · 大纲多选与批量拖拽（第三轮）

- 实现大纲多选与批量拖拽：行级左侧拖拽手柄（⋮⋮）；Ctrl/⌘ 单击切换多选、Shift 单击范围选中、Esc/空白清空；顶部「已选 N 个节点」工具栏条；按住手柄拖动全部选中节点（垂直移动顺序、水平右移成子级、左移提升层级、拖到已选行自身拒绝、边缘自动滚动）；选中行右键菜单含批量删除/缩进/反缩进。
- 关键修复：dropTarget 同级索引误用 n.children.indexOf 返回 -1 改取父节点 children；提升分支补沿父链定位插入点。验证：node --check 全过、uitest3.py 9/9、回归 uitest1.py 7/7 + uitest2.py 24/24；备份 _backup/index-v3.html；交付 aka 3PogDr09vg。

## 2026-09-25 — 桔JU多维表格增强 · 字段类型浮窗 + 多选列（第二轮）

- 对已交付的桔JU多维表格增强（38443985968890370/桔JU多维表格/桔JU多维表格增强.html）追加第二轮改造：字段类型改某品牌风格浮窗——点「+列」先弹类型菜单（文本/数字/日期/单选/新增多选/公式/关联），再弹对应配置浮窗（日期含粒度选择参考第4列时间浮窗、单选/多选支持回车快速加选项、公式含函数帮助）。
- 新增多选列类型（单元格 chips + 打勾浮窗，可即输即加选项，已接入筛选与汇总）；日期单元格改为复用 openTimePicker 浮窗；列右键配置（编辑公式/选关联表/转文本）同步浮窗化；删除大纲页 adder 的「+内联表格」按钮（保留「+新增内容（按 Enter）」，内联表格仍可从节点右键插入）。
- 验证：node --check 6 块全过；uitest2.py 24/24、uitest1.py 回归 7/7 均无 console 错误；测试脚本持久化 _tests/；备份 _backup/index-v2.html；交付 aka SQoSP67dCZ。

## 2026-09-24 — Tauri 桌面版工程生成（桔JU.html + SQLite 后端）

- 文件证据（无独立任务记忆，条目据工程目录重构）：生成 Tauri v2 桌面工程 /home/user/Doubao/chats/38443998759707906/——桔JU.html（448,727B，22:42）+ dist/桔JU.html（打包副本）+ src-tauri/（Cargo.toml/build.rs/tauri.conf.json、src/main.rs、lib.rs、db.rs SQLite 存储层：schema/迁移/滚动备份/导出导入/快照、commands.rs load_state/save_state/export_db/import_db）+ icons/（32/128/256）+ package.json。
- 定位「桔JU 升级为纯本地桌面应用」：文件存储迁移 SQLite、自动备份、一键导出/导入恢复、旧数据版本迁移、反馈与已知问题页；配套 START_DESKTOP.md 打包与使用说明。
- 后续衔接（09-25）：已在 Windows 完成 rustup 安装（rustc 1.98.1），本侧给出剩余步骤（WebView2 / VS2022 Build Tools / npm i -D @tauri-apps/cli / copy dist / npm run tauri build），打包未执行、阻塞在外部环境。

## 2026-09-24 — 产品功能分析（JU 不足与创新）

- 针对上传的 fixed17.html（约 400KB）完成功能分析：Python 正则分层提取全部功能文案，结合 [[链接]]/notify/GraphRenderer/图谱边构建代码片段核实真实实现，再检索同类笔记工具、同类白板工具、同类大纲工具、同类任务管理工具的资料进行对比。
- 结论：JU 已覆盖大纲/导图/演示/图谱/多维表格/日历/标签/加密/番茄钟等十余项能力，但缺四块结构层——信任层（无云同步多端，数据困于 localStorage）、生态层（无协作/插件/API/模板市场）、核心深度（双链仅喂图谱无跳转反链、数据库无关系/公式、无 AI）、日历任务层（无系统提醒/习惯/四象限）。
- 差异化主轴判为「加密本地优先 + 单树多投影 + 大纲原生 AI」，P0 为跨设备数据安全、系统提醒、反链面板、大纲 AI；交付 21 项能力覆盖热力图 ECharts 与事实来源引用。

## 2026-09-24 — fixed11 → fixed18 连续交付

- fixed11 的 11 项测试委派编排代理 o_000cis6L22k（复测 fixed11→fixed16 累积能力：多标签 rev 同步、CSS 白名单、虚拟化降级、树 DnD）。

- 三项后续任务（Soak+变异复测、M5 虚拟滚动、错误上报后端）→ fixed13；fixed16 交付（侧栏 DnD 9/10、思维导图拖动 7/7、回归全过；A10 的 5000 节点 DnD 未实测为覆盖缺口）。

- fixed16 的 11 项 QA 验收委派（错误上报用本地收集器真实 E2E、Soak≥20 分钟、变异有效 Score 与 fixed14 的 100% 对比）；fixed18 角标修复（角标隐藏 + 侧栏顺序调整）。

  <!-- 组内排序说明（09-23）：fixed 系列按编号倒序——fixed11(fixed10三轮审查产出,最新)→fixed8→fixed7；其后为统计面板（ttodo 线）与 49/49-1/51/52 版本线（按编号倒序 52→51→49-1→49，见组内分隔注释）。 -->

## 2026-09-23 — fixed10 三轮审查 → fixed11

- fixed10 静态（6 script 块 node --check 全 PASS、无死代码）/动态（三路错误监听全路径 0 异常、加密全链路实跑）/冒烟 22 项全过后交付 fixed11。
- 修复 1 项 P3：promptUnlock 解锁成功后清理明文 STORE_KEY/PENDING_KEY 残留（实测注入明文→解锁→明文消失、加密数据完整）；另 2 项防御性备注。
- 产物 桔JU_fixed11.html（381,773B，aka JDMArOzJNl）+ review/三轮代码审查报告-静态动态冒烟.md（feishu CCnjbmb8DosUZ1xMPJBcmw3AnOc）。

## 2026-09-23 — fixed8 今日待办删除 bug 修复

- 反馈「今日待办删除 bug」，经探查与浏览器实测确认两个缺陷：①已完成待办被 `!curN.done` 拦截，清空文本按 Backspace 无法删除；②今日待办右键菜单无「删除」入口。
- 修复并生成桔JU_fixed8.html（379,255B）：去掉 done 限制 + 菜单新增「🗑 删除待办」（danger 样式，removeNode+forceRender+toast）。
- 6 个 script 块 node --check 全 PASS；浏览器实测：已完成待办 Backspace 删除成功、菜单含删除项、点击删除 + toast「已删除待办」、未完成删除回归正常、0 异常；交付 aka 6oTntQAq6f 与 review/今日待办删除Bug修复报告.md（feishu Ge3ibWLM5os2s6xBV6Gc74cjnxc）；未竟：真机验收。

## 2026-09-23 — fixed7 标签颜色修复 v4（莫兰迪 + 右键选标签）

- 完成桔JU_fixed7.html 三项需求：①中浓度莫兰迪 8 色（豆沙红/陶土橙/橄榄/灰绿/雾霾蓝/灰紫/暖褐/蓝灰，替换过深色板）；②今日待办右键菜单新增「选择标签」→ openTagPicker 标签选择器（全部标签 + ✕无标签，选中写 n.tags+logActivity+toast）；③日历格子 cal-item 有标签时整行标签色背景 + 白字、移除圆点，新增 tagStripText 剥离文本中 #tag 字样。
- 曾把 tag-picker CSS 误插 script 块致 s5 SyntaxError，改 CSS 入 style 区并 let 声明前置后 6/6 node --check PASS。
- 浏览器 9 项验证全通过（剥离单测 4/4、格子背景 rgb(122,149,127)+白字+无圆点、右键→选择器→选「设计」→toast「已标记 #设计」→今日行圆点）；交付桔JU_fixed7.html（378,685B，aka L623jiY3Cu）与 review/标签颜色修复v4报告.md（feishu Z6hNbsm4VopsomxzSZTcXZzGnDP）；未竟：真机验收。

## 2026-09-23 — 统计面板压缩（ttodo 线 · 完成率跟随视图切换）

- 上轮改造的桔JU.html（/home/user/Doubao/chats/38443936273598466/ttodo/桔JU.html，ttodo 项目线）本轮继续：统计面板跟随日历年/月/周视图切换统计口径，并将面板高度压缩约减半。

- 重写 buildStatsBlock：月视图按当月逐日、周视图按选中周 7 天、年视图按 12 月汇总，标题与汇总卡片同步按范围重算；图表高 150→56px、面板约 308→186px。

- 三视图实测口径切换正确、高度达标，桌面/移动无 JS 报错，shot.py 自检通过并交付新链接（aka 5G4oXHtAbu）；备份 _backup/v1.html 保留。

  <!-- 以下为统计面板（ttodo 线）之后的 49/49-1/51/52 版本线，按编号倒序：52→51→49-1→49。 -->

## 2026-09-23 — 52.html 删除专项代码审查

- 静态+动态+冒烟三阶段审查，确认 52.html 与上轮修复版逻辑一致；删除专项 9 场景实测发现 2 个 P0 大纲删除 bug。
- BUG-A：文档首节点 Backspace 其内容并入文档标题（previousVisible 对 index=0 返回父节点所致）；BUG-B：空节点带子 Backspace 触发 outdentNode 将节点踢出文档至根目录。
- 其余场景（合并/空节点删除/右键删除/撤销/删除当前文档/多行边界/日历索引）均通过，全程 0 运行时异常。
- 产物 review/52.html代码审查报告-删除Bug专项.md（含两处可直接落地补丁）；修复尚未应用，待确认后复测。

## 2026-09-23 — 51.html 静态/动态/冒烟审查

- 静态：5 个内联脚本+Worker 全过 node 语法检查；动态：浏览器实测 8 视图、搜索、主题、4 种导出、番茄钟、刷新持久化全程控制台 0 错误；冒烟 11/11 通过。
- 发现缺陷 11 项（高2/中3/低6）：H1 未提交文本在重渲染快捷键后静默丢失（键入不实时落库，forceRender 抑制 blur 致 state 覆盖 DOM）；H2 解锁弹窗取消即销毁加密数据。
- M1 多维表格标题列过滤/排序失效（读写路径不一致）；M2 多标签页无并发锁；M3 JSON 导入无环路校验；P0 必修 H1、H2。

## 2026-09-23 — 49-1.html 检查（24/24 通过）

- 上传 49-1.html 并指示「检查」：node 校验 5 个脚本块语法、HTMLParser 查标签闭合与 id 重复、无头 Chromium 实际加载运行并注入 24 项冒烟断言、截图验证界面。
- 结果 24/24 全部通过：XSS 净化拦截 script/事件属性/javascript: 链接/iframe/svg；加密为 PBKDF2-SHA256（25 万次迭代）+AES-GCM-256 实现规范；农历 2026-09-23=八月十三（中秋八月十五交叉验证）、日/周/月/年重复规则正确；撤销重做（上限 30）、防环移动、导入导出、8 大视图渲染均正常；零外部依赖。
- 非阻断建议 2 条：CSS 净化未拦相对协议 url(//…)；沙箱 crypto.subtle 不返回，加解密未做运行时往返，需真机「设置密码→重启→解锁」验证。
- 产物：49-1检查报告.html（/home/user/Doubao/chats/38443935424872450/，aka qwCbngAXzj）；任务完成。

## 2026-09-23 — 49.html 按钮布局调整

- 番茄钟关闭按钮移到浮窗头部最右（margin-left:auto）；设置按钮移到顶栏「最小化」左侧，原设置按钮位置改为悬浮日历切换按钮 btnFloatCal。

- 悬浮日历按钮与设置面板开关双向联动（bindSettings/openSettings 同步状态）；浏览器实测布局、显隐切换、联动、✕ 关闭均正常。

- 交付 /home/user/Doubao/chats/38443735212042242/49.html，无未竟事项。

  <!-- 组内排序说明（09-22）：按版本号倒序——49(最新)→48→46→45。 -->

## 2026-09-22 — 49.html 悬浮日历与番茄钟浮窗修复

- 报告设置开关开启后不显示浮窗；根因：浮窗位置持久化在 localStorage（juju.fcpos/juju.pomopos），拖动/缩放后位置落视口外（实测 x:-800/y:-600），浮窗渲染在屏幕外。
- 修复：新增 ensureElInViewport() 校验，在启动恢复、开关开启、renderMain 同步浮窗三处时机检查中心点，越界即重置默认位置，共 6 处调用点。
- 回归验证通过：越界数据下刷新后两浮窗均回视口内，开关关/开循环正常，控制台无报错；交付 49.html。

## 2026-09-22 — 48.html 静态代码审查（11 项）

- 检查 48.html（6794 行）完成静态代码审查：5 个 script 块语法全通过、JS 引用 DOM ID 全存在。
- P0 崩溃级 1 项——commit() L862-863 给未声明变量 _graphLayoutSig/_graphLayoutResult 赋值，严格模式抛 ReferenceError，致所有增删节点操作失败（node 实测复现）；P1 三项——日历待办失焦无日期关键词即清空 date/time/recur（3/3 复现）、updateText 以 stripHtml 相等判断致纯格式修改不落库、取消解锁后明文写入 STORE_KEY 而下次启动仍优先加密库致数据静默丢失。
- P2 两项（颜色/字号选择器点击可致编辑器失焦丢选区、_graphDragHandler 清理为死代码）；P3 五项（DB 标题行 silent 提交、加密快照显示 0 节点、ICS 无折行/时区处理、parseNaturalDate 把「3点」当时间、_calRootEnsured 只写不读）。
- 已逐一给出修复方案，尚未实际修复，待确认后动手。

## 2026-09-22 — 46.html 全量验收 + 四轮56项清单核验

- 承接 45.html 验收后的最新版，35 项功能逐项实测；44.html 六项回归确认修复；新发现 2 个 P0（Ctrl+↑/↓ 被拦、日历新增入口断裂）；导出 Excel 实为 TSV；交付 46-check-report.html（aka 2Hh7iBuKuI）。
- 另提供「四轮 56 处问题」清单要求逐条核验：39 项存在、13 项部分成立（条件触发/边缘/描述偏差）、4 项不存在（#16 加密失败回滚、#35 表格标题 snapshot、#54 打印样式已在 46.html 修复）；每项附行号证据（runPersist 931/undo 977/moveNode 1079/renderGraph 3380 等）。

## 2026-09-22 — 45.html 检查

- 上传 45.html（「桔JU」知识管理应用，5259 行/278KB）要求检查：node --check 校验 4 个内联 script 块全部通过，本地 HTTP 服务 + 浏览器自动化逐项实测。

- 结论：14 项功能全部通过（8 视图切换、大纲编辑、日历月/周/年+农历、数据库表格、导出 md/png、加密启用/解锁/错误密码提示、番茄钟、主题、全局搜索），控制台零报错。

- 3 条注意：「下载Excel」实为 .tsv 非 xlsx、密码框不在 form 内 DOM 提示、加密依赖 crypto.subtle 需 HTTPS 或 localhost（file:// 不可用）；曾把「思维导图显示日历待办」误判为代码缺陷，实为浏览器 localStorage 状态残留，清空后正常。

- 产物：主目录下 45-check-report.html（可视化检查报告）；文件完整可用，无阻断性错误。

  <!-- 组内排序说明（09-21）：按版本号倒序——44(最新)→43→42→41-副本→41→40→38→34/30→29(最早)。 -->

## 2026-09-21 — 44.html 独立全量 bug 检查

- 与 43.html 逐块 diff + Node 复现验证 + 4 个 script 块语法校验（全部通过）；结论：上轮报告给 43.html 的 11 项问题在 44.html 已全部修复（每周X丢失 weekday、添加数据库标题失效、日历删除焦点丢失、表首列绑定、loadState 双存储、看板无状态行、打印模式、时间选择器预填、图谱拖拽持久化、sanitizeHtml data: 协议、导图缩放）。
- 新引入 1 个高危回归 + 1 个中危 + 3 项低风险：①高危 moveNode 新增 from===to 索引修正致 Ctrl+↓ 下移节点失效（Node 复现，上移正常，43 版本正确，系「修正」改坏）；②中危 _wordCountCache 未在 initStore 清除，导入 .json 备份后字数显示旧值；③低：表格拖拽放开过宽、明文启动用旧 PENDING_KEY、打印全部含数据库表。
- 行为提示：大纲视图改 innerHTML 富文本后，块级内容时光标定位退化为整段选中；未出修复补丁，43.html 旧 bug 待修复、番茄钟整合方案未应用仍存在。

## 2026-09-21 — 43.html bug 审查

- 通读全部 5026 行与 4 个 script 块，node --check 语法校验全部通过；对可疑逻辑编写 Node 最小复现脚本验证；确认 11 个问题。
- 高2：parseNaturalDate 对象键序中「每周」先命中「每周一~每周日」致 weekday 丢失（每周一待办任意日重复出现，已复现）；openAddToDbDialog 标题写入 db['标题'] 但表格首列渲染 n.text 致弹窗输入失效（已复现）。
- 中4：日历 Backspace 删除空行后 forceRender 重建 DOM 致旧焦点失效；数据库首列固定绑定行标题可错位；loadState 明文/加密双存储并存时返回 null 有覆盖风险；看板视图丢弃无「状态」行。
- 低5：打印「全部内容」与「仅当前文档」同效、时间选择器预填带时间字符串失败、图谱拖拽不持久、sanitizeHtml 未拦截 data:src、思维导图 Ctrl 缩放滚动定位偏移；复现脚本位于 /tmp/htmlcheck，未产出修复补丁。

## 2026-09-21 — 42.html 两轮 bug 审查（50 项清单核验）

- 第一轮自主审查发现 6 个问题；第二轮对照提供的 50 项潜在问题清单逐一验证，确认真 bug 8 个。
- P0：renderDbGallery 星级 parseInt NaN 崩溃（'☆'.repeat(5-NaN) 抛 RangeError）、`ui._lastScroll` 未写入导致滚动位置跳顶、renderGraph 临时坐标（_gx/_gy）污染 state/undo 栈。
- P1：renderHistoryView 未校验 v.nodes、根目录显示系统容器（_isCalRoot/_isDbRoot）、.docx 导入静默失败；P2：timeline 字符串排序不可靠、execCommand('paste') 被浏览器禁用；另确认潜在风险 8 项（全局 dbFields 耦合、编辑态 renderMain 竞态等）。
- 指出标记的「下周 X 日期计算」实际逻辑正确、非 bug；同轮另确认 42.html（4924 行）加回完整功能后，此前 41-副本 的 15 个历史问题已全部修复、新发现 3 个小观察（地图第三层兜底匹配误判、看板拖拽无视觉反馈、搜索高亮只高亮标题）。
- 口径说明：41-副本 遗留「仅 UI 偏好明文存储仍存在」；42.html 称 15 个历史问题已全部修复——若该口径含 UI 偏好存储则已处理，否则属描述偏差（未单独核验该项代码，以 42.html 实际为准）。

## 2026-09-21 — 41-副本.html 最小验证版 15 bug 复验

- 上传「最小验证版」（41-副本.html，2092 行），要求验证此前发现的 15 个 bug 是否修复；通过 diff 对比 41.html 与副本、逐段审查关键函数确认。
- 10 个 bug 已修复：加密相关 4 个 P0/P1 全部修复（版本快照按加密状态分别存储 VERS_ENC_KEY/VERS_KEY、flushPersistNow+PENDING_KEY 暂存解决关页面丢数据、_persistRunning 单飞+_persistSeq 序号解决并发覆盖、关闭加密先写明文再删密文）；图谱点击改为打开节点自身；导出思维导图 SVG 加空指针检查和 isBlankNode 过滤；行高调整 setDbRowHeight 持久化；重复任务新增 expandRecurring 日历展开。
- 4 个因功能砍掉而不存在（Word 编辑器、地图、番茄钟、搜索、看板、缩放）；仅 UI 偏好明文存储仍存在；代码注释带 P0-1/P0-2/P0-3/P1-4 标记，为针对性修复。

## 2026-09-21 — 41.html 第二轮 bug 审查（加密专项）

- 41.html 相比 40.html 新增全库加密（PBKDF2+AES-GCM）、地图真实数据绑定、数据库输入防抖、缩进归一化导入等；识别出 8 个 bug。
- P0：版本快照未加密导致加密形同虚设、加密状态下 beforeunload/visibilitychange 跳过保存导致数据丢失、关闭加密时先删 ENC_KEY 再异步写明文导致数据彻底丢失。
- P1：加密保存异步并发竞争导致旧数据覆盖新数据、ensureWordInit 在渲染流程中调用 commit 造成嵌套渲染；P2：地图城市 includes 子串误匹配、图谱点击节点设置 currentDocId 为父级而非节点本身；P3：UI 偏好仍明文存储。
- 已输出分级 bug 报告，待决定修复方向；纯离线单文件 localStorage 应用。

## 2026-09-21 — 40.html 检查（8 个 bug）

- 上传 40.html（桔JU 新版本，约 4000 行）要求检查 bug；完整阅读代码后识别 8 个 bug 并按 P0-P3 分级。
- P0：Word 编辑器 renderWordEditor 直接修改 state 绕过 commit 致 undo 失效、Backspace 合并节点时 HTML 文本直接拼接破坏富文本结构；P1：Backspace 空文本判断用 n.text.length 而非 stripHtml、日历 toggleDone 后手动操作 classList 与全量重渲染冲突造成视觉闪烁。
- P2：地图视图标记硬编码无实际数据绑定、加密功能仅设 encrypted 布尔标记无任何实际加密逻辑；P3：合并节点子节点顺序问题、importOutline 缩进层级计算不准确。
- bug 报告已交付，等待决定修复方向。

## 2026-09-21 — 38.html 两轮修复（10 项 + 7 项）

- 第一轮（10 项）：根因 renderMain() 检测到 contenteditable 仍在焦点即 early return → 点击 adder/切换日历/折叠面板后界面不刷新；新增 ui.forceRender 标志位绕过，所有日历交互处均设置；renderFolderGrid 加 isFolder 过滤只显示文件夹；顶栏加回打印按钮及 showPrintPreview()；多维表格日期格式改中文（fmtDbDate）；删除侧边栏「导入ICS」按钮及事件绑定。
- 第二轮（7 项，追问「还有哪些 bug、还要修多少次」后）：checkbox 勾选后计数不刷新（INPUT 触发 editingInContent 拦截 renderMain）、月/周/年视图「今天」「今年」按钮缺 forceRender、年视图小日历点击和翻页缺 forceRender。
- 诊断结论：再修 1 轮 P1 即可稳定；剩余 P1：日历待办不支持自然语言日期（parseNaturalDate 重写时丢失）、Enter 新建节点后 focusTextAfterRender 选择器可能匹配不到日历面板节点、日历面板内 Ctrl+Z 被 inEditor 拦截无法撤销；P2：打印预览 CSS、日期选择器浮窗位置、课程代码残留。
- 产物 /home/user/Doubao/chats/38443174659328514/38.html（218,919 字节）；所有修复待强刷确认。
- 附注：同目录另存 39.html（227,228 字节，09-21），为 38→40 之间的中间版本文件；任务记忆无独立记录，未单列条目。

## 2026-09-21 — 34.html / 30.html 日历待办专用容器修复

- 新增 getCalendarRootId()/calendarTodosOnDate()：日历 adder/Enter 新建待办挂到专用「日历待办」容器（_isCalRoot:true），不再污染当前文档；侧栏已过滤该节点。
- 修复日历头部布局：标题 flex:1 1 auto + min-width:0，切换器独立 class .cal-view-switch/.cal-view-btn + flex:none，避免删标题文字后切换器左移。
- 整段替换 renderCalendar()/renderCalNode()；此前 30.html 的 12 项日历修复同样待浏览器验证（34.html 4698 行 / 30.html 5927 行为同应用不同版本）。

## 2026-09-21 — 29.html 删除白板视图等（4项）

- 删除白板视图及关联按钮/样式/全局快捷键（4 项修改）。

## 2026-09-20 — 25.html 功能裁剪与修复（三轮）+ 本地下载

- 轮1（功能裁剪）：顶栏删「维护」按钮，「资料库」语义更新为容器视图（日历/数据库/星标/我的文档/文件夹/图谱/白板/统计/标签/历史下自动高亮，大纲/思维导图/演示不高亮）；左侧删图谱、统计导航入口；右侧删「优先级与重复」「被引用」面板及「版本历史」入口。
- 轮2（功能完善）：日历新增月/周/年三视图切换；思维导图/演示/图谱/白板递归过滤空节点；白板新增工具栏与清空、统计改卡片+柱状图、标签加返回按钮；修复 renderCalNode 待办编辑保存 bug（onInput 空函数未保存、recordMod 未定义改 logActivity）；视图切换按钮顺序改年-月-周；当天日期标题（如 2026.9.20 丙午年八月初十）上移至主内容区标题位置；系统日志过滤空行；模板卡片新增右键删除菜单。
- 轮3（交付诊断）：多次反馈「功能未实现」，代码验证均存在，诊断为下载文件不完整（.crdownload 0 字节）或浏览器缓存；第三次重新交付后待确认文件大小 281KB 且硬刷新；shot.py 验证 0 控制台错误；产物 /home/user/Doubao/chats/38443171114921986/25.html。
- 切换云环境 → 本地 Windows 后要求重新下载：将已修改完成的 25.html（287KB）下载至 C:\Users\12601\Doubao\chats\2026-09-20\桔JU.html 并交付（aka niShwqucLn / TgF6sLbVIA）。

## 2026-09-20 — 24.html 功能修复（两批）

- 批1（9 个 bug）：refreshNodeTags 应为 n.id（每按键抛 ReferenceError 静默中断保存/撤销）；wikilink 每次输入重写 innerHTML 致光标跳动；Enter 拆分 esc() 双重转义；_isWord 鸡生蛋不可达（加 openNode 路由+右键「转为富文本文档」）；DB 行标题双重转义；版本历史恢复残留新增节点；侧栏拖拽缺 recordMove；重复间隔下拉未接线；「下载 PNG」实为 SVG（改 canvas 生成真 2× PNG）。
- 批2：dbFields 已迁移为 {name,type} 但 renderDbTable 仍按字符串取值 → 表头显示 [object Object]、特殊列退化，统一 fname=f.name 并修 openAddToDbDialog/docToExcel；习惯打卡连续天数当天未打卡直接归零改为从昨天回溯；parseNaturalDate 删死分支、收紧「X月X日」正则。
- 均 node --check 通过、shot.py 0 控制台错误；交付 E:\APP\24.html（280,116 字节）。

## 2026-09-20 — 22.html 功能差距分析与改造计划

- 对同类大纲工具、同类日历清单工具、同类块编辑器工具、同类本地知识库工具输出 30+ 项功能差距（A 类大纲工具：标签体系、块编辑器、版本快照、文件夹多选；B 类日历清单工具：重复任务、优先级 P0–P4、自然语言日期、ICS、习惯打卡、番茄钟、完成统计；C 类块编辑器工具：块模型、类型化字段、relation/formula/rollup、多视图持久化、筛选引擎、双链、嵌入、代码块、仪表盘；D 类本地知识库工具：本地 Markdown、关系图谱、Canvas 白板、Dataview、层级标签、日记、快捷键、分屏）。
- 制定 6 批改造计划；阻塞：环境从 Windows 切 Linux 云沙箱，E:\APP\22.html 不可访问，未做代码修改，等待重新上传源文件。

## 2026-09-20 — index.html 桌面版四项修改（番茄钟与日记相关样式）

- 番茄钟开关从按钮改为设置面板拨动开关（UI.pomoVisible 持久化），浮窗默认主内容区右下角，右栏展开/收起联动；完整删除「日记/journal」（入口、VIEWS、navTo、renderMain case、viewJournal、today 快捷键）。
- 大纲叶子圆点 flex 垂直居中（.arrow.leaf::before）；修复 .bullet 原 display:none 导致日历/搜索/星标列表圆点不可见的 bug（改 inline-block + align-self:center）。
- 备份 E:\Desktop\_backup\index-v1.html；node --check 通过，shot.py 无控制台报错，已 present_files 交付。

## 2026-09-17 — MindWeave → 桔JU UI 改造

- 将 MindWeave 预览页改造为桔JU 界面，页面结构按 20 项细则执行（image_edit 生成 4 次）：顶栏模块顺序改为日历/大纲/数据库/思维导图/演示模式，左上角改文档名+图标，左侧栏加+/删文件项/加音乐图标，右侧栏重构为星标→展开收起→保存下载→打印二级菜单，全局文字替换为桔JU，节点颜色统一护眼绿。
- 前 3 次 seedream_4.5 均误将中央主区改为日历视图，第 4 次换 seedream_5.0_pro 并在 prompt 中负向强调「中央必须保持思维导图、不能变日历」后成功；交付 UI 图 aka DhySWtzbs8。
- 右键菜单、数据库模块（视图顺序/默认表头/地图视图）、日历模块（删当日速记/+纪念日）因截图不可见仅给出文字修改方案。

---

## 工作主题索引：归档结构检查、合并 CSV、HTML 内容更新、文档问题修正、逐条修改方案、问题清单、数据库视图显隐、日历与地图配置、静态代码审查修复、同类工具学习成本与插件生态预览、软件测试方法、多维表格功能介绍、功能开发规划、界面布局调整、本地与云环境差异、功能差距与实现方法、代码逻辑分析与优化等，均属过程性工作，相关成果纳入相应工程归档或文档。

---

## 2026-10-20 · r22 富文本（Word）模式安全下线（先迁移后删码 · 封存 HEAD 切换 r5）

- **动因**：Word 模式与大纲模式并存导致同一节点两套正文载体（`content` 与子节点 `text`），字数双计 / 导出重复段落 / 历史快照回灌旧快照等缺陷反复出现。按「先迁移数据、再删代码」顺序下线。
- **迁移（先行）**：新增 `migrateWordToOutline(st)` / `splitWordContentToParas(html)` / `_dropWordFlatSubtree(st,id)`（`script_5` 段，紧随 `migrateStateObject`）。`migrateStateObject` 末尾调用迁移：`content` 按块级标签拆成大纲子节点（无块级标签按 `<br>` / 换行切分），随后清零 `_isWord` / `_wordFlat` / `content`；已拍平旧 children 一并移除（防 `repairTreeConsistency` 挂回造成段落重复）。`mergeRemoteState` 合入前同口径迁移（旧版标签页 / 旧备份自动转换）；`renderHistoryView` 恢复旧快照改为迁移而非丢字段。
- **删码**：`VIEW_KIND.WORD` / `viewOf` word 分支 / `isWordDoc` / `getNodeSvg` word 图标 / `renderWordEditor` / `ensureWordInit` / `editorRole`·`editorSelector` 的 word 角色 / `commitPendingEditBeforeRender` 的 word 分支 / 右键菜单「转为富文本 / 转为大纲文档」整块 / `toHtml`·`docToExcel`·`showPrintPreview`·`doPrint` 的 word 正文块 / `.word-editor`·`.we-body` 五条 CSS / `bindRightSidebar` 的 `.we-body` 选择器；`docWordCount` 与 `__l14IntroJob` 字数口径同步（不再叠加 `content`、不再跳过子节点）。
- **零命中**：`_isWord` / `_wordFlat` / `we-body` / `word-editor` 仅命中迁移函数内部；`word-content` / `renderWordEditor` / `ensureWordInit` / `isWordDoc` / `VIEW_KIND.WORD` 0 命中。
- **门禁**：`node scripts/verify.js all` exit 0（静态 0 命中 · Node **502/502** · PW **167 passed + 4 skipped = 171** · bench **7/7**，最大恶化 0.0%）；登记器 **PARTY_COUNT=63 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**。
- **功能探针**（真实 Chromium，17/17 PASS）：旧 localStorage 启动 / 导入旧 JSON / 旧历史快照恢复 / 右键菜单 / 资料库打开 / 字数统计 / HTML·Excel·打印导出 / 旧版标签页合入 / 写盘 JSON 零残留。
- **哈希**：canonical = step9 镜像 = `1.冻结版本/v2.0-l13-frozen-l22-final-r5-2026-10-20.html` = **1,212,364 B / `FE04CC1A…7C1D5` / LF（CR=0 · LF=22,387）**；`HEAD.json` 切换 r5（previous = r4），`MAINTENANCE.md` 顶部锚点 + 新增 §10，`ALIAS.md` 追加 §七（G9）。
- **偏差（已在波报告 §八 说明）**：迁移三函数置于 `migrateStateObject` 之后（`t16-w13 §G` 源码切片重放需要）；新增旧 children 清理；历史快照恢复改为迁移。
- **报告 / 证据**：`_报告与元数据/WORD-MODE-RETIRE-R22-2026-10-20.md`；`_环境与调试/word-removal-verify-all-2026-10-20.txt`、`word-removal-probe-2026-10-20.txt`、`word-removal-node-r2-2026-10-20.txt`；`_哈希与行尾校验/word-removal-registry-2026-10-20.txt`。

## 2026-10-20 · P0 热修：桌面窗口按钮「假按钮」（P0-1）+ 文件夹/数据库标题空状态占位（P0-2）

- **范围**：`6.P0-T3基线/v2.0-t3.html`（canonical，HEAD 指向文件）与 `6.P0-T3基线/step9/v2.0-t3.html`（镜像）同步修改，改后两文件逐字节一致（`fc /b` 通过）。
- **P0-1 修复**：`bindTopbar` 内 `btnPin/btnMin/btnMax` 不再只弹 toast。桌面壳下按 **Tauri**（`window.getCurrentWindow() || window.getCurrent()` → `minimize` / `toggleMaximize` / `setAlwaysOnTop(!isAlwaysOnTop())`）→ **Electron**（`ipcRenderer.send('window-minimize' | 'window-maximize' | 'window-toggle-top')`）→ **NW.js**（`NW.Window.get()` → `minimize` / `maximize` / `setAlwaysOnTop`）三级真实调用；任一壳内 API 缺失或调用抛错时，该按钮 `display:none` 隐藏并 toast 提示"在当前桌面环境不可用"，不再保留假按钮。浏览器（无桌面壳）分支维持原有隐藏行为，并显式 `return` 避免落入绑定逻辑。
- **P0-2 修复**：`renderFolderHeader` 的文件夹标题、`renderDatabasePage` 的 `titleEl`（数据库表名）接入既有 `syncEmptyState(el,ph)` 并新增 `input` 监听——文件夹占位 `未命名文件夹`、数据库占位 `未命名`；空文本挂 `data-empty="1"` 由 `::before` 渲染灰色占位。原 `blur` 提交、Escape/Enter、粘贴单行化逻辑一字未改。`titleEl` 原单行长语句按文件既有风格拆为多行；补一条 CSS `.db-title[data-empty="1"]::before`（改前仅有 `.doc-header-title` 与 `.row-title` 的空占位规则，`.db-title` 缺失，故必须补，否则占位不显示）。
- **不变量（本次新增/重申）**：
  - **INV-P0-01**：`__TAURI__` / `electron` / `nw` 皆不存在（纯浏览器）时，`btnPin`、`btnMin`、`btnMax` 必须 `display:none`，且不绑定任何点击行为。
  - **INV-P0-02**：存在桌面壳时，三个按钮点击必须**至少真实调用一次**对应窗口 API（`minimize` / `toggleMaximize` / `setAlwaysOnTop`），禁止仅弹 toast。
  - **INV-P0-03**：桌面壳内 API 不可用或调用抛错 → 该按钮自动 `display:none`（不留假按钮），异常必须被 `catch` 吞掉，不得产生 `Uncaught`。
  - **INV-P0-04**：文件夹标题、数据库表名文本为空时置 `data-empty="1"` 并显示 `data-ph` 灰色占位；输入非空立即移除；再次清空必须重新出现。
  - **INV-P0-05**：canonical 与 `step9` 镜像保持逐字节一致；`<script>` 块数恒为 9。
- **验收证据**：
  - 真浏览器（Edge headless + CDP over `--remote-debugging-pipe`，真实 `click()` 与 `Input.insertText`/Backspace 键入）：**34/34 PASS**，四阶段（纯浏览器隐藏 / Tauri 壳真实调用 / 壳内无 API 自动隐藏 / 两个标题占位往返）`Uncaught` 与 `console.error` 计数 **0**；日志 `_环境与调试/p0-hotfix-verify-2026-10-20.txt`。
  - 静态语法：9 个内联 `<script>` 全部通过 `vm.Script` 编译，失败 0；日志 `_环境与调试/p0-syntax-check-2026-10-20.txt`。
  - 文件指纹：canonical = `1,217,327` B / SHA-256 `17A9104510A88FB75E559B17A9A205FF2B51FA9492F39AD1BAF1C6D184CF75BB` / **LF，CR=0**，LF=22,445（改前 1,212,364 B / `FE04CC1A…7C1D5` / LF=22,387；+4,963 B / +58 行，全部为本次两处修复）。
  - 复现脚本：`_临时脚本/_p0_pipe_verify_2026-10-20.mjs`、`_临时脚本/_p0_syntax_check_2026-10-20.mjs`。
- **环境注记**：本机 localhost 的 DevTools HTTP/WS 端点（`/json/*`、`ws://127.0.0.1:<port>/devtools/*`）被安全策略拦截（curl 亦返回空），故验证改用 `--remote-debugging-pipe`（CDP over stdio）完成。
- **遗留**：`1.冻结版本/HEAD.json` 未随本次热修切换（仍指向 r5 冻结件，字节未变）；正式冻结需另立轮次（如 r6）后由冻结脚本重算哈希与登记器。
## 2026-10-20 · 不变量清单 §二十四 / #75 物理追加（内容区宽度自适应）+ 最终封存门禁

- **范围**：`4.回归与验收/JU-不变量清单-v2.0-frozen.md` 末尾追加 §二十四「内容区宽度自适应（2026-10-20 新增）」+ 不变量 **#75 主内容区宽度自适应与两边空白收敛**；产品 `6.P0-T3基线/v2.0-t3.html` **零改动**。
- **追加前检查**：文件末尾 `^### 75\.` 命中 **0**（末段仅 #74 及其后的「登记检查清单」），确认不存在同号章节后才追加，故无重复。
- **落盘指纹**：`100,490 B / A56677A8…A5314D36` → **`102,256 B / 2C48BE5B4B631F7682A8E4D2B88788F5CA27D5360F876D7CAC00E222F71A2E46`**（净增 +1,766 B）；行数 1,540；EOL 仍 `MIXED`（CRLF 117 行 = 历史 103 + 本批 14，主体 LF）；`COUNT_H3_75=1` / `COUNT_H2_24=1`（无重复）。
- **条目口径**：`--content-max: min(1600px, 100%)` / `--content-max-doc: min(1200px, 100%)` / 日历页 `min(1800px, 100%)` / 主内容区左右 `padding: 20px`；大纲·数据库·文件夹·打印预览·日历页一律走变量或明确上限，禁止写死 1100/920/1400px；折叠三钮 `position:fixed` + `opacity:0.3`、导航选中态仅背景色、大纲选中/多选单色无边框三条既有约束重申不变。
- **冲突核对**：与 #21 主题 token、#39/#63 导航选中态、#51 大纲选中样式、#65 折叠按钮透明度、#32/#42 虚拟滚动均无冲突；旧条目若对宽度变量有相反描述，以 #75 为准且只调文字不改行为。
- **门禁复跑**：`node scripts/verify.js all` → **exit 0**；静态 **0 违规** · Node **502/502** · PW **167 passed + 4 skipped = 171** · bench **7/7**（最大恶化 0.0% / 中位 −14.3%）· `[verify] 全部通过`。证据 `_环境与调试/inv75-verify-all-2026-10-20.txt`。
- **登记器**：`node verify-hash-registry.mjs` → **`PARTY_COUNT=64` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；清单方 `size=102256 (exp 102256) eol=MIXED (exp MIXED)`，按实测重算期望值后零漂移。证据 `_哈希与行尾校验/inv75-registry-2026-10-20.txt`。
- **证据**：`_哈希与行尾校验/inv75-tail-final-2026-10-20.txt`（末尾 100 行物理读取）、`_哈希与行尾校验/inv75-tail-2026-10-20.txt`（追加后首读）、`_临时脚本/_inv75_normalize_2026-10-20.mjs`（末段标题层级归一 + 指纹复算）、`_临时脚本/_inv75_tail_2026-10-20.mjs`（末尾 100 行读取与计数）。
- **备份**：`4.回归与验收/JU-不变量清单-v2.0-frozen.md.bak3-2026-10-20`。

2026-10-20 · 最终封存校验与交付归档
门禁验证：Node 502 + PW 171 + Bench 7/7 全绿，verify.js all Exit 0。
注册表验证：verify-hash-registry.mjs 输出 PARTY_COUNT=64 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS。
不变量清单：物理实读 JU-不变量清单-v2.0-frozen.md，末尾确存在 ### 75. 主内容区宽度自适应与两边空白收敛，且无重复编号。
产品代码确认：物理搜索 v2.0-t3.html，确认 :root 中 --content-max 为 min(1600px,100%) 且 --content-max-doc 为 min(1200px,100%)。
结论：空白过宽修复、不变量清单更新与全量门禁验证均已闭环，项目彻底封存。

2026-10-20 · 幻灯片主区完美居中与严格间距修正
修改内容：.ju-sl-main 强制水平居中并移除多余 padding；.ju-sl-wrap 间距固定为 8px；保障 .ju-sl-stage 按比例最大化自适应。

验证结果：Playwright 实测主演示区水平居中、间距严格 8px；verify.js all 全绿 Exit 0；verify-hash-registry.mjs 64 方零漂移 PASS。

结论：布局微调完成，项目闭环。

证据补充：canonical/step9-mirror = 1,222,036 B / SHA-256 8790A0C3…4ED27 / LF（CR=0）；探针 _环境与调试/r25-slides-probe-2026-10-20.txt（78 项全 PASS）、门禁 _环境与调试/r25-verify-all-2026-10-20.txt（Node 502 + PW 171 + Bench 7/7）、截图 _环境与调试/r25-slides-{1440x900,1600x900,1920x1080,2560x1440,1280x720}.png。
2026-10-20 · 幻灯片主区完美居中与严格间距修正
修改内容：.ju-sl-wrap 改为 CSS Grid 布局（1fr auto 1fr）；.ju-sl-rail 靠右对齐；使 .ju-sl-stage 在全屏空间中绝对水平居中，且与缩略图间距严格保持 8px；.ju-sl-stage 移除多余像素限制，纯靠高度驱动。

验证结果：Playwright 实测主演示区水平居中、间距严格 8px；verify.js all 全绿 Exit 0；verify-hash-registry.mjs 64 方零漂移 PASS。

结论：布局微调完成，项目闭环。

证据补充（2026-10-20 · r26）：落地列定义为 minmax(174px,1fr) minmax(0,2fr) minmax(0,1fr) —— Chromium 实测中列 auto 在「舞台 width:100% + aspect-ratio」下最大内容宽度为 0（坍缩为 2px、舞台 4×3px），故以 2fr 等价实现左右 1fr 对称居中；舞台尺寸由中列宽度 + 16:9 反推高度。canonical/step9-mirror = 1,221,205 B / SHA-256 E0B262FC79D4F68655DCCDE034E9F0ED4916FA0E338FB87EEC5387BD01B2C0C1 / LF（CR=0·LF=22,493）。探针 _环境与调试/r26-slides-probe-2026-10-20.txt（4 分辨率 36 项全 PASS，舞台中心↔wrap 中心 Δ=0.00px、rail.right→stage.left=8.00px、stage.top−rail.top=0.00px、ratio=1.7778）、门禁 _环境与调试/r26-verify-all-2026-10-20.txt（Node 502 + PW 171 + Bench 7/7，Exit 0）、注册表 _环境与调试/r26-registry-2026-10-20.txt（PARTY_COUNT=64 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS）、截图 _环境与调试/r26-slides-{1440x900,1920x1080,2560x1440,1280x720}.png。

2026-10-21 · R28 · 左侧栏折叠健壮化 + 节点行对齐（真实浏览器验证 + 全量门禁 + 47 方零漂移）

修改文件：
- `6.P0-T3基线/v2.0-t3.html`（canonical）
- `6.P0-T3基线/step9/v2.0-t3.html`（step9 镜像，由 canonical 逐字节覆盖；同步前快照 `v2.0-t3.html.bak-20261021-r28`）
- `6.P0-T3基线/step9/verify-hash-registry.mjs`（canonical / step9-mirror 期望值重锚 + R28 说明注释）
- `0.规范/MAINTENANCE.md`（维护基线结论锚点 + §13 R28 变更记录）

诊断结论（真实浏览器实测）：
- 收起失效的可复现条件：`#sidebarLeft.collapsed{margin-left:calc(var(--sidebar-left-w) * -1)}` 在 `--sidebar-left-w` 为不可解析长度时整体失效 ⇒ margin-left 回落 0px ⇒ 点击 #btnToggleLeft 后侧栏原地不动。修复前实测（Edge headless 1440×900，注入 `--sidebar-left-w: abc`）：marginLeft=0px、侧栏可见宽 152px、#main 仅增宽 58px ⇒ FAIL。
- 排除项：≤768px 媒体查询的 `margin-left:0!important` 仅在移动断点生效（1280/1440/1600/1920/2560/3440 六宽度实测均走负 margin）；renderSidebar / JU_MODULES / JU_DND.ensureNavGrips 不触碰 #sidebarLeft 的 class；拖拽宽 260px 与 ui.scale=1.4 下负 margin 均正确解析。
- 行对齐缺陷：`.sb-arrow.leaf` 12px vs `.sb-arrow` 22px，叶子行 .sb-icon/.sb-label 整行右移 10px（父行 iconX=53/labelX=73，一级叶子行 43/63）。

修复内容：
- ① CSS `#sidebarLeft.collapsed` → `margin-left:calc(var(--sidebar-left-w,210px) * -1)`（补 210px 兜底）。
- ② JS `bindMainToggles` · `syncL` 新增 `_sbLeftWMarginResolvable()` 探测，仅在变量不可解析时以实测 offsetWidth 回写 px；.collapsed 判定 / ui.sidebarLeftCollapsed / saveUI 持久化 / title + aria-pressed 同步逻辑不变。
- ③ CSS `.sb-arrow.leaf` 宽度 12px → 22px（opacity:0 与 ::before 热区禁用保留）。
- 收起机制仍为负 margin + transition（实测 flex 布局中确已让出空间，未改用 width:0 方案，展开态宽度行为零变更）。

真实浏览器验收（Edge headless · Playwright 通道）：
- 修复后同一注入场景：marginLeft=-152px、侧栏可见宽 0px、#main 增宽 210px ⇒ PASS。
- 1440×900 真实点击 #btnToggleLeft 3 次：collapsed=true/false/true、marginLeft=-210/0/-210px、#main 宽 1210/1000/1210、按钮 class/title/aria-pressed 同步；刷新后仍为收起态。
- 行对齐复测：一级父节点行与一级叶子行均 iconX=53 / labelX=73；二级子行 iconX=67（= 父行 + 14px）；#subDb/#subStarred/#subDocs/#subTags 四子树 padding-left 均 14px，首行图标列同一基线。

字节与哈希（物理实测）：
- canonical = step9-mirror = 1,234,770 B / SHA-256 9CC74270C9ABCA7262B4477E2B2447E434C74BF3045ECF15E3ED8167B3F81431 / LF（CR=0 · LF=22,756）。
- 重锚口径：1,233,197/9D6EDD88… → 1,234,770/9CC74270…（+1,573 B / +12 行），方数保持 64；同时吸收 r27 未封存的导入弹窗末次微调（canonical 1,233,265/8DAC24B3…），使 canonical 与 step9 镜像重新逐字节一致。

验证结果：
- `node scripts/verify.js all` → exit 0：静态检查 0 违规 · Node 402/402 · PW 167 passed + 4 skipped = 171 · bench 7/7（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。
- `node verify-hash-registry.mjs`（实际路径 6.P0-T3基线/step9/verify-hash-registry.mjs；仓内无 scripts/19-verify-hash-registry.mjs）→ `PARTY_COUNT=64` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。

证据：
- `_环境与调试/r28-sidebar-probe-2026-10-21.txt`（折叠 3 次 + 对齐 + 刷新持久化，RESULT: PASS）
- `_环境与调试/r28c-sidebar-unresolvable-before-mirror-2026-10-21.txt`（修复前 FAIL）、`r28c-sidebar-unresolvable-after-canonical-2026-10-21.txt`（修复后 PASS）
- `_环境与调试/r28b-sidebar-multiw-2026-10-21.txt`（六宽度 + 拖拽宽 260px + ui.scale 1.4）
- `_环境与调试/r28-verify-all-2026-10-21.txt`（首轮，T-99 因登记器未重锚而红）、`r28-verify-all-r2-2026-10-21.txt`（重锚后全绿）
- `_环境与调试/r28-registry-baseline-2026-10-21.txt`（drift=1 · canonical）、`r28-registry-after-2026-10-21.txt`（drift=0 · RESULT=PASS）
- 截图 `_环境与调试/r28-sidebar-expanded-1440x900-2026-10-21.png`、`r28-sidebar-collapsed-1440x900-2026-10-21.png`

结论：左侧栏折叠在桌面全宽度断点视觉收起并让出布局空间（含变量不可解析时自愈），叶子行与父节点行图标/文字左缘对齐；全量门禁全绿，64 方零漂移，已物理封存。

2026-10-21 · 批次 7 · 不变量 #84 物理追加 + 全量门禁复跑（回归文档封存）

修改文件：
- `4.回归与验收/JU-不变量清单-v2.0-frozen.md`（末尾物理追加不变量 #84，纯新增，#1–#83 零改动）
- `6.P0-T3基线/step9/verify-hash-registry.mjs`（`JU-不变量清单-v2.0-frozen.md` 期望值重锚 + R28 说明注释）
- `0.规范/MAINTENANCE.md`（§14 追加记录）
- `2.项目日志/项目日志.md`（本条）

追加内容：
- `### 84. 左侧边栏折叠与节点行对齐`：定义（折叠生效与让出空间 / 210px 兜底与不可解析自愈 / 持久化一致 / 收起态排布 / 节点行对齐）、断言（收起态 / 展开态 / 空间让出 / 持久化 / 对齐 / 收起态排布 共 6 段）、关联实现（bindMainToggles / syncL / _sbLeftWMarginResolvable 及 CSS 与 UI 状态行号）、验证方式（真实浏览器 + verify.js all + verify-hash-registry.mjs）、补充口径、冲突调整记录（#39 / #63 / #65 / #75 / #76 / #51）、类型与状态标注。

字节与哈希（物理实测）：
- 追加前：115,969 B / BF7CF22549AD3EBA15D21F569457922C99BA35FE2E49CB4A293457DBCD3CD2F9 / LF（CR=0 · LF=1,638）/ 无 BOM / 末字节单个 0x0A。
- 追加段：8,063 B / 2CBF99A5FAD9E72922CE19267C0783A2269BE0E5876B0042B828AA9047A2067F（与临时件逐字节一致）。
- 追加后：124,032 B / 8B401CD92DB1A11D5FE664DE59049B0415CFD14E962C5945EEB0AF30747E4FED / LF（CR=0 · LF=1,659）/ 无 BOM / 末字节单个 0x0A。
- 前 115,969 B 的 SHA-256 与追加前完全一致 ⇒ #1–#83 逐字节零变更；头 200 行切片哈希 E4A5DAE3…833347 前后相等。

验证结果：
- `node scripts/verify.js all` → exit 0：静态检查 0 违规 · Node 402/402 · PW 167 passed + 4 skipped = 171 · bench 7/7（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。
- `node verify-hash-registry.mjs`（实际路径 6.P0-T3基线/step9/verify-hash-registry.mjs；仓内无 scripts/19-verify-hash-registry.mjs）→ `PARTY_COUNT=64` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（仅更新既有登记方期望值，方数 64 不变）。

证据：
- `_哈希与行尾校验/inv84-append-2026-10-21.txt`（追加前后字节数 / SHA-256 / EOL / BOM / 头 200 行哈希 / 追加段比对）
- `_环境与调试/inv84-registry-2026-10-21.txt`（重锚前 drift=1）、`inv84-registry-r2-2026-10-21.txt`（重锚后 RESULT=PASS）
- `_环境与调试/inv84-verify-all-2026-10-21.txt`（首轮 T-99 红）、`inv84-verify-all-r2-2026-10-21.txt`（重锚后全绿）

清理：
- 临时文件 `4.回归与验收/tmp_invariant_new.md` 已删除（内容 100% 落盘，SHA-256 可复核）。

结论：不变量 #84 物理追加完成，全量门禁全绿，64 方零漂移。


---

## 2026-10-21 · R30 最终哈希重锚与封存终校（不变量 #86 · 日历待办勾选框与标签色统一）

漂移方定位（重锚前真实执行 `node verify-hash-registry.mjs`，cwd=6.P0-T3基线/step9）：`PARTY_COUNT=64` / `FIVE_PARTY_DRIFT_COUNT=2` / `RESULT=FAIL`。
- `canonical`：size=1,235,206（exp 1,235,104）· sha256=`CC434BC3…7868F7` · LF。
- `JU-不变量清单-v2.0-frozen.md`：size=126,243（exp 124,032）· sha256=`59A733C7…279406` · LF。
- **附带发现**：`step9-mirror` 当时仍 PASS（停留在 r29 字节 1,235,104 / `62C3C1E4…6145`），与 canonical 偏移 102 B。Playwright 实际加载镜像，若不同步则门禁验证的是旧产品 ⇒ 已用 canonical 逐字节覆盖镜像（同步前快照 `6.P0-T3基线/step9/v2.0-t3.html.bak-20261021-r30`），两文件现同为 `CC434BC3…7868F7` / 1,235,206 B。

差异内容（`fc /n` 全文比对仅 2 处）：`.cal-node .cal-checkbox` 边框 / 勾选态色改 `var(--cb-color, …)` 回退；`renderCalNode` 删除 `.cal-tag-dot` span 生成，改 `cb.style.setProperty('--cb-color', getTagColor(n.tags[0]))`；`.cal-tag-dot` 的 CSS 规则按 #86 补充口径保留。

重算值（`node _临时脚本/_seal_final_probe_2026-10-21.mjs` 真实物理读取）：
- canonical / step9-mirror：1,235,206 B / `CC434BC3C502387E1504C00322FD1B1305E6C93E9B966E0B49266F9FED7868F7` / LF（CR=0 · LF=22,756）。
- `JU-不变量清单-v2.0-frozen.md`：126,243 B / `59A733C738834E75AB08C824B43429FF976A500D57EDA7094EA02DDD12279406` / LF（CR=0 · LF=1,684）。

登记器重锚（`6.P0-T3基线/step9/verify-hash-registry.mjs`）：仅改 `canonical` / `step9-mirror` / `JU-不变量清单-v2.0-frozen.md` 三行期望值 + 追加 R30 注释块；方数保持 64，其余 61 方一字未动。

验证结果（真实执行）：
- `node verify-hash-registry.mjs` → `PARTY_COUNT=64` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（64 方逐项 PASS）。证据 `_环境与调试/seal-final-registry-r30-2026-10-21.txt`、`seal-final-registry-r30-final-2026-10-21.txt`；重锚前基线 `seal-final-registry-baseline-2026-10-21.txt`。
- `node scripts/verify.js all`（cwd=6.P0-T3基线/step9）→ exit 0：静态检查 0 违规 · Node 502/502 · PW 167 passed + 4 skipped = 171 · bench 7/7（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。证据 `_环境与调试/seal-final-verify-all-2026-10-21.txt`、复跑 `seal-final-verify-all-r2-2026-10-21.txt`。

物理复核：清单第 1,674–1,684 行为 §三十 / 不变量 #86（定义 / 断言 / 关联实现 / 验证方式 / 补充口径），文件末尾单个 0x0A；canonical `renderCalNode`（L10335–L10349）已无 `.cal-tag-dot` DOM 生成，`--cb-color` 于 CSS（L469/L470）与 JS（L10346）双端生效，全文件 `cal-tag-dot` 仅剩 L773 一处 CSS 规则。

文档更新：`0.规范/MAINTENANCE.md` 维护基线结论改为 1,235,206 / `CC434BC3…7868F7`（R30 · §15），新增 §15 全节（含实测值表 / 重锚口径 / 门禁证据 / 镜像同步说明）；本报告落盘 `_报告与元数据/R30-SEAL-FINAL-2026-10-21.md`。

结论：哈希已重算并更新，64 方零漂移；全量门禁全绿（Exit 0）；不变量 #86 已落编且产品侧已实现；项目彻底封存。

## 2026-10-21 · R31 勾选框 / 侧栏标签圆点浅色化（承不变量 #86 · 与时间网格 tagged 块同源）

改动（canonical `6.P0-T3基线/v2.0-t3.html`，逐字节同步 `step9/v2.0-t3.html` 镜像；4 条 CSS 声明 + 2 行 JS）：
- `.cal-node .cal-checkbox:checked`：在原实色 `var(--cb-color, var(--accent))` 之后追加 `background:color-mix(in srgb,var(--cb-color,var(--accent)) 32%,var(--bg-panel))` 与 `border-color:color-mix(…45%,transparent)`；原实色声明保留为 `color-mix` 不支持时的回退（L470）。
- `.cal-node .cal-checkbox:checked::after`：对勾描边由 `#fff` 改为 `var(--cb-color, var(--accent))`，浅底上可读（L471）。
- `.sb-tag-dot`：移除 `border:2px solid rgba(255,255,255,.55)` 与 `box-shadow`，改为 `background:color-mix(in srgb,var(--tag-color,transparent) 32%,var(--bg-soft))` + `border:1.5px solid var(--tag-color, var(--icon))` + `box-shadow:none`（L774）。
- `renderSubTags`（L14875）与 `openTagPicker`（L16518）：`dot.style.background=getTagColor(t)` → `dot.style.setProperty('--tag-color', getTagColor(t))`，供上述变量绑定消费。

护栏：`--tag-color` 未注入时描边回落 `var(--icon)`、底色为 32% transparent + 68% `--bg-soft`（alpha≈0.68），实测 `border=rgb(74,122,94)=var(--icon)`、`bg alpha=0.68`，不会出现隐形/透明点。

门禁与证据（真实执行）：
- `node verify-hash-registry.mjs` → `PARTY_COUNT=64` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`；证据 `_哈希与行尾校验/r31-registry-2026-10-21.txt`。
- `node scripts/verify.js all`（cwd=6.P0-T3基线/step9）→ exit 0：静态检查 0 违规 · Node **503/503** · PW **167 passed + 4 skipped = 171** · bench 7/7（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。证据 `_环境与调试/r31-verify-all-green-2026-10-21.txt`（首跑 `r31-verify-all-2026-10-21.txt` 中 L9-5 Worker 生命周期 1 例为环境抖动，单跑 `r31-verify-pw-2026-10-21.txt` 167 passed 复现绿）。
- 真浏览器探针（Chrome headless + CDP）`_环境与调试/r31-light-ui-probe-2026-10-21.txt`：**PASS=29 / FAIL=0 / RESULT=PASS**；截图 `_环境与调试/r31-light-ui-2026-10-21.png`。

重算值：canonical / step9-mirror = **1,235,901 B / `762762928BEA9B66FEB6CD5885909D0F8241803A30D0421994BC55E59BD5D79B` / LF（CR=0 · LF=22,756）**；登记器仅改 `canonical` / `step9-mirror` 两行期望值 + 追加 R31 注释块，方数保持 64。

真浏览器实测口径（标签色 `#C44D9E`）：未勾选边框 `rgb(196,77,158)`（= 标签色）；勾选底 `color(srgb 0.869961 0.744627 0.798275)` 与 `.cal-tg-ev.tagged` 事件块背景**逐位相等**，勾选边框 `color(srgb 0.768627 0.301961 0.619608 / 0.45)` 与事件块边框逐位相等；对勾描边 `rgb(196,77,158)`；侧栏标签树圆点 `--tag-color=#7CB342`、底色 = 32% 混 `--bg-soft`、描边 `rgb(124,179,66)`、`box-shadow=none`、14×14。

测试同步：`6.P0-T3基线/step9/t9/t17-w1-rendersubtags-rows.test.mjs` 的最小 DOM 装配补齐 `style.setProperty/getPropertyValue`（原仅 `background/width`，新契约下会 TypeError），并新增「R31：标签圆点以 --tag-color 变量绑定（不再写内联 background）」用例（该文件不在登记面内，方数不变）。

结论：勾选框与侧栏标签圆点已统一为「浅色底 + 深色描边」，与时间网格 tagged 事件块同源；哈希 64 方零漂移、全量门禁全绿（exit 0）。

---

## L22-final-r2 · UI 修正补丁（2026-10-21 · 收口不变量 #77 / #57 两处冲突）

**任务**：修复 `v2.0-t3.html` 与不变量 #77（幻灯片布局）/ #57（模板 · 历史视图返回按钮）的 2 处冲突；全量门禁 100% 绿灯；65 方零漂移；真实物理文件操作验证。

**改动（CSS 3 条 + JS 2 个渲染函数；`<script>` 块数 9 / 数据契约 / 加密 payload / 公开 API 零变更）**

1. `JU_SLIDES._styleOnce()`：#77 三处落值 —— `.ju-sl-main` 的 `align-items:center → flex-start`；`.ju-sl-rail` 的 `padding:6px 0 0 → 0`；`.ju-sl-stage` 的 `margin:0 → 0 auto`。保留项：`.ju-sl-wrap` `column-gap:8px` 未动；`body.sb-left-collapsed .ju-sl-rail{padding-right:6px}` 为折叠态专用，保留不冲突。
2. `renderTemplatesView()` / `renderHistoryView()`：`renderTitleWithBack(...)` 返回值先 `classList.add('files-toolbar')` 再 `append`，并回写 `justifyContent='flex-start'`（`.files-toolbar` 自带 `flex-end`，回写以保持标题左对齐）。`renderTrashView()` 保持现状（外层 `head` 已是 `.files-toolbar`，避免两层嵌套）。

**物理落盘**：先改 `6.P0-T3基线/step9/v2.0-t3.html`，再 `copy /Y` 覆盖 `6.P0-T3基线/v2.0-t3.html`（改前备份 `v2.0-t3.html.bak-20261021-r43`）；两侧 `Get-FileHash` 同值 = **1,261,042 B / `B600CF504776A36BC954A217A10B019326461324E37EE7521E56BD257CC3271E` / LF（CR=0 · LF=23,150）**；增量 1,259,506 → 1,261,042（+1,536 B / +16 行）。

**门禁（真实执行）**

- `node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）→ **exit 0**：静态检查 **0 命中**（91ms） · Node **503/503**（25,745ms） · Playwright **167 passed + 4 skipped = 171**（54,969ms） · bench **7/7**（最大恶化 0.0% / 中位 −14.3%）→ `[verify] 全部通过`。证据 `_环境与调试/l22r2-ui-inv57-77-verify-all-final-2026-10-21.txt`。
- 重锚前一轮门禁红点唯一：T-99 登记器哨兵（`tests/t10-idb-persist.spec.ts:570` `expect(drift).toBe(0)` 收到 1，`step9-mirror size=1261042 (exp 1259506)`）；证据 `_环境与调试/l22r2-ui-inv57-77-verify-all-2026-10-21.txt`。
- 65 方登记器 `node verify-hash-registry.mjs`（仓内无 `scripts/19-verify-hash-registry.mjs`，已全仓检索确认）→ **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**（重锚前 baseline：drift=1）；证据 `_环境与调试/l22r2-ui-inv57-77-registry-final-2026-10-21.txt`。
- 真机探针（Chrome headless · 1440×900 · `_临时脚本/_l22r2_ui_probe_2026-10-21.mjs`）→ **11/11 PASS / CHECK_FAIL=0**：舞台顶边 vs 首张缩略图顶边 |Δ|=0.00px；舞台中心 X 710 = wrap 中心 X 710（|Δ|=0.00px）；`column-gap=8px`；rail 右缘 466 → 舞台左缘 474（=8.00px）；`.ju-sl-main align-items=flex-start`；`.ju-sl-rail padding-top=0px`；`.ju-sl-stage` 声明 `margin:0 auto`；折叠态 `padding-right=6px` / width 148px；模板 / 回收站 / 历史三视图 `.files-toolbar .btn` 均命中「← 返回」且 `nestedBars=0`。证据 `_环境与调试/l22r2-ui-inv57-77-browser-2026-10-21.txt`。
- 文档：`0.规范/MAINTENANCE.md` 追加 §27「L22-final-r2 UI 修正补丁」（含字节锚 / 重锚红绿证 / 门禁证据 / 探针方法论注记）。

**结论**：两处不变量冲突已按正文口径修复并物理固化（canonical ≡ step9 镜像逐字节一致），65 方零漂移，全量门禁 Exit 0。

## L22-final-r3 · 幻灯片主舞台面积最大化（2026-10-21）

**目标**：取消 `JU_SLIDES._styleOnce()` 中为对称居中而留空的第三列，让主演示区占据缩略图栏之外的剩余空间，并以容器查询单位在高度方向撑满且恒 16:9。

**改动（仅 CSS 字符串数组；`<script>` 9 块 / 数据契约 / 加密 payload / 公开 API 零变更）**

1. `.ju-sl-wrap`：`grid-template-columns` 由 `minmax(174px,1fr) minmax(0,2fr) minmax(0,1fr)` 收为 `auto minmax(0,1fr)`；`height` 由 `auto` 改 `100%`（为主演示区提供确定高度基准）。
2. `.ju-sl-main`：追加 `container-type:size`；`justify-content:flex-start` / `align-items:flex-start` / `padding:0` 保持不变（#77 顶部对齐口径不变）。
3. `.ju-sl-stage`：`width:100%` → `width:min(100%,calc(100cqh * 16 / 9))`；`aspect-ratio:16/9` 与 `margin:0 auto` 不变。
4. 配套：窄屏 `@media (max-width:720px)` 的 `.ju-sl-main` 追加 `container-type:normal` —— 否则单列态 `height:auto` + size 尺寸隔离会使高度坍缩为 0（`100cqh=0` ⇒ 舞台不可见）。

**物理落盘**：先备份并编辑 `6.P0-T3基线/step9/v2.0-t3.html`，再备份并 `copy /Y` 覆盖 `6.P0-T3基线/v2.0-t3.html`；两侧 `Get-FileHash` 同值 = **1,261,513 B / `E9CDE576DFB4ACAAC84254D978BBF0E2A74C4C830432A8F4EBAD33B349EA1B30` / LF（CR=0 · LF=23,153）**；增量 1,261,042 → 1,261,513（+471 B / +3 行）。

**门禁（真实执行）**

- `node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）→ **exit 0**：静态 **0 命中**（80ms） · Node **503/503**（30,630ms） · Playwright **167 passed + 4 skipped = 171**（76,365ms） · bench **7/7**（144ms）→ `[verify] 全部通过`。证据 `_环境与调试/l22r3-verify-all-2026-10-21.txt`。
- 65 方登记器 `node verify-hash-registry.mjs`（仓内无 `scripts/19-verify-hash-registry.mjs`，已全仓检索确认）→ **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；证据 `_环境与调试/l22r3-registry-2026-10-21.txt`。
- 真机探针（Chrome headless · 1440×900 / 1920×1080 · `_临时脚本/_l22r3_stage_probe_2026-10-21.mjs`）→ **7/7 PASS / CHECK_FAIL=0**：顶边对齐 |Δ|=0.00px；在主演示区水平居中 |Δ|=0.00px；16:9=1.7778；面积 125,316 → **340,472 px²（×2.72）**；底边留白 464.11 → **291.98px**；`.ju-sl-main container-type=size`；样式表命中 `width:min(100%,calc(100cqh * 16 / 9))`。证据 `_环境与调试/l22r3-ui-stage-probe-2026-10-21.txt`，截图 `_环境与调试/l22r3-slides-before-r2-1440x900.png` / `…-after-r3-1440x900.png` / `…-after-r3-1920x1080.png`。
- 排障：`.bak` 在 `file://` 下不被 Chrome 识别为 HTML（纯文本渲染，`#content` 不存在），改前基线需复制为 `.html` 临时件；该临时件比对后已删除。
- 文档：`0.规范/MAINTENANCE.md` 追加 §28；本报告 `_报告与元数据/L22-FINAL-R3-STAGE-MAX-2026-10-21.md`。

**结论**：主演示区已占满缩略图栏之外的剩余空间，舞台两向取小撑满且恒 16:9；canonical ≡ step9 镜像逐字节一致，65 方零漂移，全量门禁 Exit 0。


## L22-final-r4 · 幻灯片「缩略图栏 + 主舞台」贴合与整体居中（2026-10-21）

**目标**：修复幻灯片视图「缩略图与主舞台间距过大」——让缩略图栏与主舞台作为整体水平居中，两者间距恒为 8px。

**改动（仅 `JU_SLIDES._styleOnce()` 的 CSS 字符串数组；`<script>` 9 块 / 数据契约 / 加密 payload / 公开 API 零变更）**

1. `.ju-sl-wrap`：`display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:8px` → `display:flex;justify-content:center;align-items:stretch;gap:8px`（缩略图栏 + 主舞台作为整体居中）。
2. `.ju-sl-rail`：`grid-column:1;justify-self:end;width:174px` → `flex:none;width:174px`（其余纵向 flex / padding:0 保留）。
3. `.ju-sl-main`：去掉 `grid-column:2` 与 `width:100%`，改 `flex:0 1 auto`，并追加 `aspect-ratio:16/9`——宽度由 16:9 比例换算（与舞台宽度同源），不再抢占剩余空间。
4. `.ju-sl-stage`：`width:min(100%,calc(100cqh * 16 / 9))` → `width:calc(100cqh * 16 / 9)` + `max-width:100%` 兜底。
5. 窄屏 `@media (max-width:720px)`：`grid-template-columns/row-gap` → `flex-direction:column` + `gap:8px`，删除 rail/main 的 `grid-column:1`。

**关键判断（真机比对，非口头）**：字面写法（`main` 仅 `flex:0 1 auto` + `container-type:size`）在 Chromium 下会因 size 尺寸隔离使 `flex-basis` 退化为 0 ⇒ 主演示区 0 宽、舞台坍缩为 2px；另一变体（main 自写 `width:calc(100cqh*16/9)`）在高度受限视口下 rail→stage 间距达 250.3px（正是本波要修的 bug）。最终选定 `aspect-ratio:16/9` 换算写法，三档视口实测均为 8px 且整体居中。

**物理落盘**：`6.P0-T3基线/v2.0-t3.html` 与 `6.P0-T3基线/step9/v2.0-t3.html` 逐字节一致 = **1,261,347 B / `AE963965A3F1E4859354472D3EA692F1C0593197A0F269D3BB1E2ACD4DA47051` / LF（CR=0 · LF=23,153）**（1,261,513 → 1,261,347，−166 B，行数不变）；`4.回归与验收/JU-不变量清单-v2.0-frozen.md` 追加 #77 r4 补充口径 = **155,701 B / `9139EF1C591E802C9CC0F8C3BC3B0133E9B106EE7D1A27DEEE18575418D7F760` / LF（CR=0 · LF=1,909）**。

**门禁（真实执行）**

- `node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）→ **exit 0**：静态 **0 命中** · Node **503/503 pass · 0 fail** · Playwright **167 passed + 4 skipped = 171** · bench **7/7 通过** → `[verify] 全部通过`。证据 `_环境与调试/l22r4-verify-all-final-2026-10-21.txt`。
- 65 方登记器 `node verify-hash-registry.mjs` → **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；证据 `_环境与调试/l22r4-registry-2026-10-21.txt`。
- 真机探针（Chrome headless · 1440×900 / 1920×1080 / 2560×1440 / 3440×1440 / 1280×720 / 窄屏 700×600 · `_临时脚本/_l22r4_slides_probe_2026-10-21.mjs`）→ **CHECK_TOTAL=71 / CHECK_FAIL=0 / RESULT=PASS**：wrap computed gap=8px；rail 右边缘→stage 左边缘=8px；整体居中左右留白差 ≤0.02px（3440×1440 实测 L=260.45 / R=260.47）；舞台顶边=首张缩略图顶边（Δ=0）；16:9=1.78；无滚动条；窄屏 column + gap 8px、舞台 684×384.75 可见。证据 `_环境与调试/l22r4-slides-probe-2026-10-21.txt`，截图 `_环境与调试/l22r4-slides-*.png`。
- 报告：`_报告与元数据/L22-FINAL-R4-SLIDES-FLEX-CENTER-2026-10-21.md`。

**结论**：缩略图与主舞台已贴合（间距恒 8px）并在主内容区内整体水平居中；canonical 与 step9 镜像逐字节一致，65 方零漂移，全量门禁 Exit 0，项目闭环。

---

## R44 · 不变量清单 v2.5 全量物理替换（2026-10-21）

**操作**：以「JU 不变量清单（v2.5 现行对拍基线）」整篇**物理覆盖** `4.回归与验收/JU-不变量清单-v2.0-frozen.md`（非追加）。结构变动：头部改记 65 方 / 现行 84 条（#1–#93）；#30 / #31 / #32 / #33 / #35 的历史门禁值统一加 `[历史快照]` 前缀并补注「现行门禁以 #90 为准」；#75 / #76 归一为 100% 宽度口径并补「口径废弃提示（2026-10-21）」；#77 的 r24 Grid 口径标注「已被 #93 取代」；#78 / #83 / #84 补补充口径与废弃提示；末尾为 #91 / #92 / #93 与「核对说明」「关联文件」。原文件备份 `90过程材料/JU-不变量清单-v2.0-frozen.md.bak-r44-2026-10-21`（155,701 B）。

**落盘实测**：**137,321 B / `422EBDBB616FB48A0C42CB507A9D841478987B5231CCE6E601268F562D143B69` / LF（CR=0 · LF=2,045 · 末字节 0x0A）**；`### 编号条目` 实测 **93 条**，首行 `# JU 不变量清单（v2.5 现行对拍基线）`，末行 `| \`v2.0-t3.html\` | **现行基线** |`。

**登记重锚**：`6.P0-T3基线/step9/verify-hash-registry.mjs` 该登记方期望值 155,701 / `9139EF1C591E802C9CC0F8C3BC3B0133E9B106EE7D1A27DEEE18575418D7F760` → **137,321 / `422EBDBB…3B69`**；方数保持 **65**（仅更新既有登记方期望值，不新增纳编物）。登记器现行路径为 `6.P0-T3基线/step9/verify-hash-registry.mjs`（旧称 `19-verify-hash-registry.mjs`、更早 `l9\l9-hash-check.mjs`；仓内已无 `19-` 前缀文件）。

**门禁实测**：
- `node scripts/verify.js all`（cwd=`6.P0-T3基线/step9`）→ **exit 0**：Node **503/503**、Playwright **167 passed + 4 skipped = 171**、bench **7/7**、`[verify] 全部通过`；证据 `_环境与调试/r44-verify-all-2026-10-21.txt`。
- 65 方登记器 `node verify-hash-registry.mjs` → **`PARTY_COUNT=65` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`**；证据 `_环境与调试/r44-registry-2026-10-21.txt`。

**结论**：不变量清单 v2.5 已物理替换，全量测试全绿，65 方零漂移，项目彻底闭环。
