批次：fix33-9/X · build-all 默认一条命令出包（OVERWRITE=1 / BUNDLES=nsis）
时间：2026-11-05（UTC 05:14–06:01）
变更文件（1）：6.P0-T3基线/m07-vite/scripts/build-all.mjs
DIST_BEFORE：m07-vite/dist/index.html 4,713,030 B / 5AF650EC…52CE72（任务卡 review11-09 登记值，本批前未采集）
DIST_AFTER：m07-vite/dist/index.html 4,713,947 B / A51E8849…5543C3
验收：
1) Select-String "BUNDLES || 'nsis'" → HITS=1（:66）
2) 不设环境变量 build-all → Exit 0（第 5 步 --bundles nsis，产出 setup.exe）
3) 归档 v2.1.0-2026-11-05 6 件含 JU_2.1.0_x64-setup.exe（4,460,182 B）
4) JU_BUNDLES=none 重跑 → 归档无 setup.exe；第 6b 步按既有判据报 ISSUE-007（禁改）
5) JU_RELEASE_OVERWRITE=0 同日重跑 → 第 6 步 prepare-release abort（既有目录拒绝）
6) verify-hash-registry.mjs → PARTY_COUNT=66 / drift 0 / RESULT=PASS
7) verify.js all → Exit 0（静态 0 · Node 503 · PW 171 · bench 0 失败）
环境变量清理：90过程材料/tmp 下 edge_profile* 匹配 0 项，跳过（未删任何内容）
回执：fix33-9_回执_20261105.md
