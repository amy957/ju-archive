批次: review7-11 (ISSUE-011 自定义音源最小授权且失败可见)
时间: 2026-11-02 22:29 (UTC+8)
DIST_BEFORE: 4705509 (6.P0-T3基线/m07-vite/dist/index.html, 本批未重建 dist)
变更:
- src-tauri/tauri.conf.json: assetScope 收窄为 $APPDATA/ju-media/**（删除 $AUDIO/**）
- src/core/audio.ts: overrideSources() 返回 {urls, rejected}；playTrack 回落时 toast
约束: CSP 未改（script-src/default-src 保持 'self'）；src-tauri/src/** 未改
门禁: check-parity Exit 0；tsc --noEmit Exit 0；cargo check Exit 0
      verify-hash-registry RESULT=PASS drift=0；verify.js all Exit 0
候选清理: 90过程材料/tmp/ 下 edge_profile* 匹配为空，已跳过，无删除
