批次：review14-03 / ISSUE-003（关闭加密 fail-open 与门禁读端）
时间：2026-11-06 18:04 (UTC+8)
DIST_BEFORE：4,715,494 B / index.html mtime 2026-11-06T14:55:29
本批范围：仅补登记证据；不改源码、归档产物、历史任务卡段
实测命令1：99.开发辅助工具\node.exe 6.P0-T3基线\m07-vite\scripts\check-deps-wired.mjs
实测结果1：共检查 78 个依赖键，失败 1 项，Exit 1
  10 个装配块全 PASS；purge 覆盖 21/21；desktopSave PASS；isDesktop 同源 hasDesktopInvoke
  失败项：FAIL boot.ts: clear_encrypted 缺 await 读端
判读：boot.ts 全文已无 clear_encrypted（await 读端在 src/core/crypto.ts:204），
  判据对「不含该调用」的文件仍报 FAIL，属误报；禁改源码与门禁脚本，登记为遗留
复验（2026-11-06 19:59 UTC+8）：同命令 Exit 0，共检查 78 个依赖键，失败 0 项
  关闭加密读端 PASS（boot.ts load_state 复核 + 桥接不可用提示 + 原子写先于成功；crypto.ts await clear_encrypted）
