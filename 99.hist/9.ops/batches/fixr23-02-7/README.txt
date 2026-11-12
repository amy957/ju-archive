批次：review23-02/7（ISSUE-002 门禁红未登记 / manifest parity 失真）
时间：2026-11-08T09:1xZ（UTC）
DIST_BEFORE：6.P0-T3基线/m07-vite/dist/index.html 存在，大小未改（本轮未触碰 dist 与 src）
内容：
- _sandbox.ps1          红绿对照沙箱脚本（复制真实 4 个脚本 + 真实 OPEN-ISSUES.md，禁用路径不含真实归档/src）
- red-green-log.txt     三态实跑日志（A 红=BLOCK、B 硬编码缺陷态=PASS+红并存、C 绿=PASS）
- sandbox/              沙箱产物（可整目录删除，非发布证据）
未触碰：src/**、src-tauri/**、8.发布与CI/release/** 字节、HEAD.json
edge_profile 匹配项：0（跳过删除，未删任何内容）
