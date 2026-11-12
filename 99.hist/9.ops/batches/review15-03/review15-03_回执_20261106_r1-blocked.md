# review15-03 回执（2026-11-06）

- 批次：review15-03/13 · ISSUE-003 归档 Web/exe/setup 与 dist 同源 · 发布阻塞=是
- 变更文件：无（源码 diff 0 行）；证据 90过程材料/tmp/review15-03/ 与 2.项目日志/review15-03-*.txt
- 验收命令：node scripts/check-release-parity.mjs（JU_BUILD_DATE=2026-11-05）
             node scripts/check-web-parity.mjs
             node scripts/build-all.mjs（JU_RELEASE_OVERWRITE=1 / JU_BUNDLES=nsis / JU_BUILD_DATE=2026-11-05）
- 结果：证伪成立（重打包前 parity Exit 1，归档 Web fe48c6a7…2582 ≠ dist af554472…0509）；
        重打包 BLOCKED，[1b/14] check-deps-wired Exit 1
        `FAIL  boot.ts: clear_encrypted 缺 await 读端（关闭加密 fail-open）`
- 未达标：check-release-parity / check-web-parity 未取得 Exit 0；归档 4 件与 dist 仍异源
- 状态不变：dist af554472…0509；归档 Web fe48c6a7…；.prev-* 1；HEAD.json 未改
- 遗留（待决策）：门禁判据与 review15-01 原子写收敛不一致——
        boot.ts（:891）关闭加密读端已为 await inv('save_plain_and_clear')（Rust 侧一次写明文并 remove encStore），
        check-deps-wired.mjs（:156-165）仍要求 boot.ts 与 crypto.ts 同时出现 await … clear_encrypted。
        方案 A：门禁接受 save_plain_and_clear 为 boot.ts 读端（scripts 变更，需门禁+哈希同步）；
        方案 B：在 boot.ts 保留 await clear_encrypted（与 review15-01 原子写重复，不采用）。
- 下一入口：待决策方案 A 后重跑本批重打包与三角校验
