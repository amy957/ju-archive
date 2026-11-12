批次：fixr7-19/20（review7-19/20 · ISSUE-019 只读门禁不写 docs）
时间：2026-11-02T15:25Z ~ 2026-11-02T15:31Z
DIST_BEFORE = 4,706,823 B / B7CD6EF81749A60F04388DA01C50E521F33591B5BC10B06F7DDAA1EC74CAD858
DIST_AFTER  = 同值（本批未构建，dist 零改动）
变更：scripts/audit-license.mjs、scripts/check-unused-exports.mjs 增加 --check（默认只读），--write 才落盘
      package.json scan:license / scan:unused 显式 --write；.github/workflows/m07-ci.yml 与 scripts/build-all.mjs 1d/1e 显式 --check
不变：统计口径、阈值 214、许可判定规则、退出码（strong 命中仍 exit 1；未使用 >214 仍 exit 1）
证据：verify.ps1（默认+--check 四次跑 mtime/SHA 不变；--write 后 mtime 变化；按原字节复原哈希一致）
edge_profile* 匹配：90过程材料/tmp/ 下 0 项，跳过，未删除任何文件
