批次 review9-06 · ISSUE-006 控制台不得出现正文
时间 2026-11-03
DIST_BEFORE=4,708,861 B / 8E4FDEDB078B702886034F5E182D3737066D1F52C63C48B72587DB7FF8DB4D76
DIST_AFTER=4,708,966 B / 5F323F7244C0C9994697ED50C934EF46707FADCC3A06289FE52FC0C6EBA3D347
变更文件：6.P0-T3基线/m07-vite/src/core/richtext.ts
  logInlineStyleEntry 默认关闭（window.__JU_RT_DEBUG===true 才输出）
  日志仅 rangeCount / collapsed / 容器 tagName / 选中长度；删除 r.toString() 与节点对象
探针：probe-review9-06.spec.ts（临时置 tests/ 跑，跑后移入本目录，未入产物）
证据：review9-06-spec-green / green-r2 / falsify / build / build-falsify / tsc / hash-registry / verify-all（2.项目日志）
edge_profile* 匹配 0 项，已跳过
