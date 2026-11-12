批次 review9-13 · ISSUE-013 setItem 失败不中断主题切换
时间 2026-11-03
DIST_BEFORE=4,710,870 B / DC0940B4…6DCFF4
DIST_AFTER=4,710,986 B / 44B611A5…782C09
变更文件：6.P0-T3基线/m07-vite/src/ui/theme.ts
  toggleTheme :63 与主题选择器确认应用 :153 两处 setItem 包 try/catch，失败仅 console.warn
  saveUI/forceRender/toast/dataset.theme/主题判定/UI 键名零改动
探针：probe-review9-13.spec.ts（临时置 tests/ 跑，跑后移入本目录，未入产物）
证据：2.项目日志/review9-13-{spec-green,spec-green-r2,spec-falsify,tsc,hash-registry,verify-all}-2026-11-03.txt
edge_profile* 匹配 0 项，已跳过
