批次：fix33-6/X（ISSUE-006 check-deps-wired 对 desktopSave 函数体恒值放行）
时间：2026-10-31
DIST_BEFORE：4,698,835 B（6.P0-T3基线/m07-vite/dist/index.html）
DIST_AFTER ：4,698,835 B（本批未改产品代码，未重建）
变更文件：
  - 6.P0-T3基线/m07-vite/scripts/check-deps-wired.mjs（+29 行：函数体提取 + 能力检查 + 无判真判定）
未改文件：
  - src/main.ts（负向注入后按备份原样恢复，SHA-256 1FF3F935…72B4，登记器 drift 0）
证据文件：
  - fix33-6-negative.log（恒真 desktopSave → FAIL 指名 desktopSave，exit=1）
  - fix33-6-negative2.log（含 _tauri() 但 desktopInvoke(...); return true; 无 catch → FAIL，exit=1）
  - fix33-6-green.log（PASS，69 键 / 失败 0，exit=0）
  - fix33-6-restore.log（restore_hash_equal=True）
  - fix33-6-hash-registry.log（PARTY_COUNT=66 / drift 0 / RESULT=PASS）
  - fix33-6.diff（68 行 unified diff）
edge_profile* 匹配项：无（90过程材料/tmp 递归匹配为空，已跳过，未删除任何内容）
