批次：fix26-p1（资料库置灰补口 / 各视图标题三列网格居中 / 思维导图移除无作用「重置布局」按钮）
时间：2026-10-30T18:01+08:00
DIST_BEFORE：6.P0-T3基线/m07-vite/dist/index.html 4,698,667 B / d416fccc…f524a（本轮改码后 spec 构建产物）
REL_BEFORE：8.发布与CI/release/v2.1.0-2026-10-29/JU-v2.1-Web.html 4,699,068 B / 1605bb70…e5e3b（fix26 发布件）
变更文件：src/style.css、src/app/session.ts、src/views/mindmap.ts、tests/v21-fix26-ui-align.spec.ts
产品口径：业务数据结构 / CSP / src-tauri 零改动；canonical 与 step9 镜像零改动
旧包封存：90过程材料/tmp/fix26-p1/prev-release-v2.1.0-2026-10-29
验收命令：verify-hash-registry.mjs（期望 PASS / drift=0）、verify.js all（期望 Exit 0）
