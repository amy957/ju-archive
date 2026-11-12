批次: review19-09/9 · ISSUE-009 文档过期更正（发布阻塞=否）
时间: 2026-11-07T15:58Z
DIST_BEFORE: 4,716,422 B / BDB08905…B6685E（未重建，本批零构建）
变更: 6.P0-T3基线/m07-vite/docs/OPEN-ISSUES.md:1 单行改写（±1 行）
改后: ISSUE-001 关闭加密复核失败仍回滚加密态（单实例守卫 + 原子写；发布件重建前仍阻塞，实机待验证；证据 main.rs:492-506 单实例守卫、main.rs:72-101 原子写）
禁改核对: ISSUE 编号集合 22 项不变（check-manifest openIssues=22）；其余 21 行零改动；归档零改动；ISSUE-001 未标 Closed
验收(手工): Get-Content -Encoding UTF8 docs/OPEN-ISSUES.md -TotalCount 1 → GREP_HIT=1（含 单实例守卫）
验收(自动): node scripts/check-manifest.mjs → RESULT=PASS entries=4 openIssues=22，Exit 0
证伪: 沙箱删该短语 → SANDBOX_GREP=0，canonical CANON_GREP=True；沙箱已删
编码: BOM=False，2,913 B，23 行（22 条 + 末尾空行）
edge_profile*: 90过程材料/tmp 下匹配 0 项，跳过删除（未删任何其他内容）
