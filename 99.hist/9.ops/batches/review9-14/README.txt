批次 review9-14 · ISSUE-014 hex/!important 继续收口
时间 2026-11-03
DIST_BEFORE=4,710,986 B / 44B611A5…782C09
DIST_AFTER=4,711,371 B / 17A92ACB…D07BFB6
变更文件：6.P0-T3基线/m07-vite/src/style.css
  新增 --c-* 10 个：green/black6/orange/red/night-fg/cal-blue/bg-day/panel-day/now/pal-1
  替换声明内字面量 15 处；注释内字面量保留；选择器/实际色值/!important/其它规则/var() 回退零改动
登记：hex 150→135（去注释 141→126）；!important 72→72（去注释 70→70）
探针：probe-review9-14.spec.ts（临时置 tests/ 跑，跑后移入本目录，未入产物）
证据：2.项目日志/review9-14-{probe,probe-r2,falsify,targeted,check-inline-style,tsc,hash-registry,verify-all,verify-all-r2,w13-single}-2026-11-03.txt
edge_profile* 匹配 0 项，已跳过
