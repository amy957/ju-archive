review15-07 README（2026-11-06）
批次：review15-07/13 · ISSUE-007 未关闭清单单一真相源
时间：2026-11-06 19:55 (UTC+8)
DIST_BEFORE：4,715,782 B / 8FB58D12…DA024（dist/index.html）
核查文件：
- 6.P0-T3基线/m07-vite/docs/OPEN-ISSUES.md（每行 ISSUE-xxx 标题）
- 6.P0-T3基线/m07-vite/scripts/prepare-release.mjs:64-78（读 docs 生成 OPEN_ISSUES）
- 6.P0-T3基线/m07-vite/scripts/check-manifest.mjs:23-30（manifest 与 docs 集合比对）
核查结论：三项均已存在，源码零 diff；docs 为唯一清单，无第二份硬编码
证伪：追加 ISSUE-009 且不重生成 → RESULT=FAIL openIssues 与 docs/OPEN-ISSUES.md 不一致，EXIT=1
复原：docs SHA256 509bb10c30d493b8d2af5615441f804595b9700ea2bb0dda07406cf4552d4bb1 = 备份
门禁：verify-hash-registry PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS
DIST_AFTER：4,715,782 B / 8FB58D12…DA024（未重建）
edge_profile*：0 项匹配，跳过并记录
证据：本 README.txt · 回执 · falsify.log · pass.log · OPEN-ISSUES.md.bak
