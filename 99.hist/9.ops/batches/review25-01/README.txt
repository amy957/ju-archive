批次：review25-01/7（ISSUE-001 发布包整体滞后 · 发布阻塞=是）
时间：2026-11-08T12:53Z ~ 13:03Z
DIST_BEFORE=6D5A9E54FB98557D7FEF893D04007EA507F71357DCA811DF07F2A70E3350EBAD 4,715,113 B mtime 2026-11-08T09:42:29Z
ARCHIVE_BEFORE(v2.1.0-2026-11-08)：Web 258EC391…EC017 / exe B530485C…CD21 / setup 195C0115…DD14 / checksums 3FD30694…AB75
触发：check-web-parity / check-release-parity Exit 1（归档 Web ≠ dist；exe 09:00Z 早于 dist 09:42Z 与 src 变更）
处理：cargo test（22 passed）→ build-all（1f/1g/4/5/6/6b）重生成 dist/exe/setup/checksums/manifest
DIST_AFTER=6D5A9E54…EBAD 4,715,113 B（源码未变，产物字节同源；滞后在归档侧）
ARCHIVE_AFTER：Web 6D5A9E54…EBAD / exe C078FE81…F47B / setup 59ECC4A9…7425 / checksums 4D3D8D51…0DD8
让位目录：8.发布与CI/release/v2.1.0-2026-11-08.prev-1794142687350（旧包，零删除）
证据：dist-before.txt · cargo-test.txt · build-all.txt · dist-after.txt · final-state.txt · falsify.txt
     falsify-run-web.txt · falsify-run-relweb.txt · falsify-run-exe.txt · final-*-r2.txt
     hash-registry.txt · verify-all.txt · verify-all-r2.txt · _run.mjs
备注：verify-all.txt 为首跑环境失败（spawnSync node ENOENT）；verify-all-r2.txt 前置 PATH 后全绿
edge_profile*：90过程材料/tmp 下匹配 0 项，跳过（无删除）
