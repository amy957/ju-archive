fix22-patch1 · 日历「字数统计 / 任务统计」柱状图铺满与柱体显示
批次：fix22-patch1（1/2 修复 + 2/2 归档）
时间：2026-10-30 15:12 → 15:18（本地 UTC+8）
定位：6.P0-T3基线/m07-vite/src/views/calendar.ts（buildCalBarChart）
      6.P0-T3基线/m07-vite/tests/v21-fix22-calendar-chart.spec.ts
根因：SVG 根同挂 .cal-chart 类，style.css 的 .cal-chart{width:auto} 覆盖 width 呈现属性，
      图表退回默认视口、31 列日期被裁在左缘；柱体高度为 0 时原断言仍判过。
改动：外壳容器承担 .cal-chart 类；几何走 SVG 呈现属性，挂载后按容器实宽重排
      （更宽则铺满，更窄则最小列宽 + 模块体横向滚动）。
DIST_BEFORE：未留档（fix22-patch1 首次 vite build 即覆盖，违反「先留档」时未取）
DIST_AFTER：4,697,101 B（6.P0-T3基线/m07-vite/dist/index.html）
edge_profile* 清理：90过程材料/tmp 下匹配为空，按规则跳过（未删除任何内容）
门禁：verify-hash-registry.mjs ⇒ PARTY_COUNT=66 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS
