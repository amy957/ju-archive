批次：fix40-2/2（归档收尾 · 仅登记与清理，产品代码零改动）
时间：2026-11-01
产品树：6.P0-T3基线/m07-vite（canonical / step9 镜像本批零改动）
DIST_BEFORE：4,703,090 B / 0FC69728…BC04（fix40 开工前 release/v2.1.0-2026-11-01/JU-v2.1-Web.html）
DIST_NOW：4,703,693 B / BB4A5A67…B53110（fix40-1 产出，本批复核一致）
EXE_NOW：6,778,880 B / 4307A6F5…95315
CHECKSUMS：169 B / E5E7CFEC…BEAC
文件清单（本批新建）：
- README.txt（本文件）
- fix40_回执_20261101.md
关联变更（fix40-1 已交付，本批不重复登记）：index.html / src/ui/layout.ts / src/main.ts / src-tauri/src/main.rs / tests/v21-fix40-topbar-close-backup.spec.ts
验收命令：
- test -f 90过程材料/tmp/fix40/README.txt
- test -f 90过程材料/tmp/fix40/fix40_回执_20261101.md
- ls 90过程材料/tmp/edge_profile* 2>/dev/null（期望为空）
edge_profile*：90过程材料/tmp 下匹配 0 项，按规则跳过（未删除任何内容）
禁改确认：源码 / 配置 / release 目录 / tmp 下非 edge_profile* 内容均未改动
