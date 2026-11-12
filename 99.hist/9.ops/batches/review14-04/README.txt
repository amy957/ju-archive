批次：review14-04 / ISSUE-004（dist-parity 补 package.json / 锁文件）
时间：2026-11-06 18:04 (UTC+8)
DIST_BEFORE：4,715,494 B / index.html mtime 2026-11-06T14:55:29
本批范围：仅补登记证据；不改源码、归档产物、历史任务卡段
实测命令：99.开发辅助工具\node.exe 6.P0-T3基线\m07-vite\scripts\check-dist-parity.mjs
实测结果：Exit 0；[dist-parity] ✓ dist 不早于 src / public / 根配置 / tauri.conf.json
代码核对：scripts/check-dist-parity.mjs:27-28 输入面含 package.json 与 package-lock.json
遗留：负向实测（令 package.json mtime 晚于 dist 观察 Exit 1）未做
复验（2026-11-06 19:59 UTC+8）：同命令 Exit 0；groups 含 package.json / package-lock.json（:27-28）
