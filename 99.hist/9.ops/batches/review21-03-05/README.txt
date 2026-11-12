批次: review21-03-05 -- review21 ISSUE-004 layout 桌面探测同源门禁
时间: 2026-11-08T07:04Z ~ 07:09Z
DIST_BEFORE: 4,716,598 B / D5DC035A...42DE7 (6.P0-T3基线/m07-vite/dist/index.html)
DIST_AFTER:  同 DIST_BEFORE（本批不重建，未触 dist）
变更文件:
  6.P0-T3基线/m07-vite/scripts/check-deps-wired.mjs  (+29 行 layout 桌面探测断言)
  6.P0-T3基线/m07-vite/src/ui/layout.ts  (仅负向临时改 1 行, 已 copy /Y 复原, sha256 412C17C0...4F84)
证据:
  gate-green.log            正向 PASS 83 键 失败 0, 含 layout 桌面探测: OK
  gate-neg.log              负向 layout.ts:101 -> !!_win.__TAURI__, FAIL 1 项, EXIT=1
  gate-green-restore.log    复原后 PASS 83 键 失败 0, EXIT=0
  layout-before.sha / layout-after.txt   复原前后 sha256 一致
  hash-registry.log         PARTY_COUNT=66 drift=0 RESULT=PASS
  verify-all.log / verify-all-tail.txt    Exit 0（静态 0, Node 503, PW 171, bench 7/7, 最大恶化 0.0%）
  dist-before.txt           dist 字节/哈希/mtime 快照
备注: step9 无 check-deps-wired 镜像（搜索 0 命中），无需同步。
清理: 90过程材料/tmp/ 下 edge_profile* 匹配 0 项（MATCH=0），已跳过。
