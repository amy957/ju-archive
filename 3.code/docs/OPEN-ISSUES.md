<!-- AUTO-GENERATED, DO NOT EDIT -->
ISSUE-001 关闭加密复核失败仍回滚加密态（实时 dist=784D2437…、归档 Web=784D2437…；exe/setup 哈希见归档清单，待 P-15/P-16 实机复核）
ISSUE-002 发布准入曾判「可发布」而 CSP 风险接受未签字（发布准入已回退不可发布，待签字复核）
ISSUE-003 dist 早于 src 最新变更，check-dist-parity 真实红未登记（当前 dist=784D2437…、归档 Web=784D2437…；check-release-parity Exit 0；parity=PASS；发布阻塞=否，待真实重建重写清单后关闭）
ISSUE-004 CI 在 vite build / Playwright 之后才跑 parity，stale dist 被刷新后掩盖（已前置为 pre-build/pre-verify，待 CI 首跑证据）
ISSUE-005 发布说明只列 1 项未关闭缺陷，漏报其余项（清单已收敛为 docs 唯一真相源；承接 ISSUE-011 的 review9-08/11/12/13/14 探针补建登记，待复核关闭）
ISSUE-008 CSP style-src unsafe-inline 仍无有效风险接受（风险接受文件已签字，待复核关闭）
ISSUE-009 check-release-parity 不校验 setup 与当前 exe/版本同源（SETUP_STALE/SETUP_MISMATCH 已实现，负向样本待补）
ISSUE-010 check-release-parity 已进 CI workflow 但仅作归档自洽（不校验 exe 与构建产物同源），权威判定在本地 build-all 6b（待 CI 首跑证据）
ISSUE-011 review9-08/11/12/13/14 5 探针已补建并登记（tests/v21-review9-08/11/12/13/14-*.spec.ts 存在，REQUIRED_PROBES 5/0），build-all 0.150 Exit 0 已复核，待 CI 首跑
ISSUE-101 P-4 加密重启完整链未实机验证（书面接受，实机待发版后观察）
ISSUE-102 P-5 明文落盘未实机验证（书面接受，实机待发版后观察）
ISSUE-103 P-6 密文备份 5 份轮转未实机验证（书面接受，实机待发版后观察）
ISSUE-104 P-7 拖拽/置顶/窗口按钮零证据（书面接受，实机待发版后观察）
ISSUE-105 P-8 NSIS 安装/卸载未实机执行（书面接受，实机待发版后观察）
ISSUE-106 P-9 强杀恢复（明文 pending）仅历史证据（已通过代码原子写保证，实机待发版后观察）
ISSUE-107 P-10 双击关闭仅历史证据（书面接受，实机待发版后观察）
ISSUE-108 P-11 自定义 X 备份配额仅历史证据（书面接受，实机待发版后观察）
ISSUE-109 P-12 基准 P95 未复跑（书面接受，实机待发版后观察）
ISSUE-110 P-13 多标签并发写盘未实机双开验证（书面接受，实机待发版后观察）
ISSUE-111 P-14 加密写盘失败注入未复跑（书面接受，实机待发版后观察）
ISSUE-112 P-15 关闭加密磁盘态（复核失败分支）已通过代码原子写保证，实机待发版后观察
ISSUE-113 P-16 关闭加密窗口内 exe 级强杀已通过代码原子写保证，实机待发版后观察
