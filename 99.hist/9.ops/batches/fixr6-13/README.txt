批次：fixr6-13/19（ISSUE-013 · ISSUE-018 同批）
时间：2026-11-02T06:24Z 起（UTC）
DIST_BEFORE：4,705,181 B / 16894967D9B5CF8666BEC8EB193FFF7651FF2C6184C6EB9CD3100C55ED11A2C9 / mtime 2026-11-01T16:25:24Z
SRC_BEFORE：src/io/import.ts 39,834 B / 8C6E5CC8…38F679F1 / mtime 2026-11-01T16:30:43Z（.db 分支为 toast + return）
变更：src/io/import.ts:608-612 —— toast(...) + return; → errors.push(...) + continue;
断言：90过程材料/tmp/fixr6-13/db-branch-assert.mjs（绿/红双向已跑）
DIST_AFTER：4,704,837 B / 8085488D8E5B7BBFDB9D9CC46951B2D7C91226B8AD6D40CF5344E11A0EEEDDF7 / mtime 2026-11-02T06:32:08Z
edge_profile*：90过程材料/tmp 下匹配 0 项，已跳过（未删除任何文件）
