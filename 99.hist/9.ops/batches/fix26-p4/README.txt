fix26-p4 归档批（左侧栏重命名后行文字不更新）
批次：fix26-p4-2/2（归档收尾；产品代码 1 件 + 专属断言 1 件 + 重打包）
时间：2026-10-30 21:17（UTC+8）
DIST_BEFORE = 8.发布与CI/release/v2.1.0-2026-10-29
  JU-v2.1-Web.html      4,699,887 B  0A9B7339..CEA765A5
  JU-v2.1-win-x64.exe   6,767,104 B  67256F19..5C72E4E5
  JU-v2.1-checksums.txt       169 B  5D4DD006..FEB3B0A3
旧包落位：90过程材料/tmp/fix26-p4/prev-release-v2.1.0-2026-10-29
移动前运行实例：无（Get-Process ju 返回空）
DIST_AFTER  = 8.发布与CI/release/v2.1.0-2026-10-29
  JU-v2.1-Web.html      4,700,201 B  A66D9035..A73DCD
  JU-v2.1-win-x64.exe   6,767,104 B  680C21AA..B1B5ED
  JU-v2.1-checksums.txt       169 B  8B2195D5..0175AD
变更：6.P0-T3基线/m07-vite/src/ui/sidebar.ts（_sbSyncRowLabels）
      6.P0-T3基线/m07-vite/tests/v21-fix26-p4-sidebar-rename.spec.ts（新建）
edge_profile*：90过程材料/tmp 下无匹配项，按规则跳过（未删除任何其他内容）。
