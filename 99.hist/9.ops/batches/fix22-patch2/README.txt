fix22-patch2 批次说明
批次：fix22-patch2（1/2 代码+测试修复 · 2/2 归档收尾）
时间：2026-10-30（UTC+8）
范围：日历「字数统计 / 任务统计」柱状图 X 轴文字挤压 + 柱高为 0
DIST_BEFORE：未取证（vite build 产物由 spec 每次重建，批次开始时已被上一轮运行覆盖）
DIST_NOW = 4,697,441 B / EFB22E2E…EDA5237（本次 spec 重建产物）
目录内容：
  _html_old.txt / _html_new.txt     两版 release HTML 图表类名检索（cal-chart / chars-chart 均 COUNT=0）
  _probe_old.txt / _probe_new.txt   两版 HTML 关键词计数与首个命中偏移
  _stats_old.txt / _stats_new.txt   两版 HTML buildStatsBlock 窗口（内联 style 百分比柱高）
  _real_new.txt                     新版真实图表实现（span/div 内联 style，height:${S}%）
  _run_baseline.txt                 改断言前基线（1 passed · 自证式断言）
  _run_red.txt                      改断言后首跑（仍 1 passed ⇒ 断言不足）
  _run_diag.txt                     诊断跑（chars 容器 214px / SVG 496px · 柱高全 2px）
  _run_green1.txt                   加宽/越界断言后红证（末位文字越界 +1.79px）
  _run_green2.txt                   几何修正后绿证
  _run_green3.txt                   造数后绿证（当日柱 34px，其余 2px 兜底）
  _run_final.txt                    最终验收（1 passed · 9.9s）
  _tsc.txt                          tsc --noEmit（空输出 = 0 错误）
  _registry.txt                     哈希登记器（66 方 / drift 0 / PASS）
  _dirlist.txt / _dist.txt          本目录清单与 dist 指纹
edge_profile*：90过程材料/tmp 下匹配为空，按规则跳过删除（记录于此）
