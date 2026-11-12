批次：fixr6-4/19（ISSUE-004 关闭未等主库落盘完成）
时间：2026-11-01（UTC+8）
DIST_BEFORE：4,704,870 B / E8B6CB80F719C3FDD20BEF2565D410ECBAA5B192BB5497DCB5D044B97701C3C0
DIST_AFTER：4,705,048 B / 6F049E0F38D4163674BBDDE3497AE4F306E9912978A8F50D3140566A6099915E
改动：6.P0-T3基线/m07-vite/src/core/persist.ts（新增 persistNowAwait）
      6.P0-T3基线/m07-vite/src/app/session.ts（关闭流程 await persistNowAwait）
      6.P0-T3基线/m07-vite/tests/v21-fixr6-close-persist.spec.ts（新建 1 例）
产物：dist/index.html 已重建；release/v2.1.0-2026-11-01 未重建
edge_profile*：90过程材料/tmp 下匹配 0 项，跳过
