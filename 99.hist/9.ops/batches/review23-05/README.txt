批：review23-05/7 · ISSUE-005 测试绿≠可达
日期：2026-11-08
DIST_BEFORE：4,715,113 B / 6D5A9E54…EBAD
DIST_AFTER：4,715,113 B / 6D5A9E54…EBAD（零构建，Rust 源改动不影响 dist）
MAIN_RS_BEFORE：1061 行（删除前）
MAIN_RS_AFTER：958 行 / sha256 A1C15E1DC18CB9154BE9183BB51A66D4CB2B37AF3079F1F04328E3A2149DFD9B
决策：方案①删除 patch_nodes、其损坏库用例、import_db 占位；清理文档与 handler 注释、无用 HashSet 导入
证据：cargo-test.txt、cargo-test-firstgreen.txt、falsify-probe.txt、falsify-match.txt、falsify-handler.txt、source-scan-final.txt、hash-registry.txt、verify-all.txt
edge_profile*：90过程材料/tmp/ 匹配 0 项，已跳过
