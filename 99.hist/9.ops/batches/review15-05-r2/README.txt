批次：review15-05-r2
时间：2026-11-06 19:48 (+08:00)
DIST_BEFORE：4,715,782 B / 8FB58D12…DA024（6.P0-T3基线/m07-vite/dist/index.html）
DIST_AFTER：4,715,782 B / 8FB58D12…DA024（spec prepare 重建同哈希）
基线：HEAD.json 未改
净代码改动：0（F 断言已存在于 spec:196-198）
负向：注入 mock 缺陷 → :197 红 Expected 0 / Received 1
负向对照：断言替换 expect(true) → 1 passed（缺陷逃逸，证明覆盖）
复原：SHA256 179415FE…26B41 与备份一致
edge_profile*：0 项，跳过
