fix24 归档说明
批次：fix24-1/2（启动窗口宽高 1.5 倍 + 重打包 v2.1.0-2026-10-29）
时间：2026-10-30 16:36（UTC+8）
DIST_BEFORE：dist/index.html 4,698,324 B / a257dd17a881e825eaacdd783ff26eb8fb2b9149c39975a12bde3ef8a18bfeff
RELEASE_BEFORE：8.发布与CI/release/v2.1.0-2026-10-29（fix23 产物 Web 4,698,324 B / exe 6,766,592 B / checksums 169 B）
已移入本目录：prev-release-v2.1.0-2026-10-29
变更：src-tauri/tauri.conf.json tauri.windows[0] width 800→1200 / height 600→900
src 侧：grep setSize|LogicalSize|innerSize|setMinSize 命中 0 ⇒ 未改 src（未命中）
