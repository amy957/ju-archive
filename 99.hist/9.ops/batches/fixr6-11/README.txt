fixr6-11/19 · ISSUE-011 NSIS 安装包从未产出（可选分支）
批次：fixr6-11（1 批，2 文件）
时间：2026-11-01 23:05–23:16（UTC+8）
DIST_BEFORE：4,705,615 B / B569B0E9B1EA37FB75DEFF092487BAB416293CF1B4E00ACC0599B8730C5BE818
DIST_AFTER ：同 DIST_BEFORE（本批只改 scripts/ 与 docs/，src/** 零改动）
变更：
  scripts/build-all.mjs —— BUNDLES = process.env.JU_BUNDLES || 'none'；第 5 步参数与标签随变量；6b 之后新增分支把 bundle/nsis/*-setup.exe 复制为 JU_<ver>_x64-setup.exe 并入档并写入 checksums
  docs/HANDOVER开发者交接手册.md —— 构建命令表新增 JU_BUNDLES=nsis 用法一行
产物：
  8.发布与CI/release/v2.1.0-2026-11-01/JU_2.1.0_x64-setup.exe 4,451,026 B / E6C80C4C…F67E06
  JU-v2.1-win-x64.exe 7,314,944 B / 5B2D566B…42AF4F
  JU-v2.1-checksums.txt 258 B / 413C606F…CEAD017E（3 项，含 setup）
日志：build-all-nsis.log · build-all-none-falsify.log · build-all-nsis-restore.log · verify-all.log · hash-registry.log
edge_profile*：90过程材料/tmp 下匹配 0 项，跳过（无删除）
遗留：NSIS 实机安装/卸载验证未做；.prev-* 累计 9 个
