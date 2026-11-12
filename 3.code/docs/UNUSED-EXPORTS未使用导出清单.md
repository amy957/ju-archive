# 未使用导出清单（UNUSED-EXPORTS）

> 扫描工具：`scripts/check-unused-exports.mjs`（静态 `import` 反查，无运行时开销）
> 扫描日期：2026-10-25
> 扫描范围：`src/**/*.ts`（44 个文件，排除入口 `src/main.ts` 与 `*.d.ts`）

## 一、汇总

| 指标 | 数值 |
| --- | --- |
| 扫描文件 | 44 |
| 导出符号总数 | 1057 |
| 未使用导出 | **162** |
| 导出使用率 | 84.7% |
| 跳过（`export default`） | 0 |

## 二、判定口径

1. 任一**其它**文件以 `import { X } from …` / `import X from …` 引入同名符号 → 视为已使用；
2. `import * as ns from './x'` 或 `export * from './x'` → 该模块全部导出视为已使用；
3. 入口 `src/main.ts` 的导出不计入「未使用」（挂载点自身无外部引用）；
4. 通过字符串 / `window` 全局键间接引用的符号不会被本工具识别，人工复核时请保留。

## 三、明细（仅标记，不删代码）

| # | 文件 | 行 | 符号 | 类型 |
| --- | --- | --- | --- | --- |
| 1 | `src/app/boot.ts` | 56 | `BootDeps` | interface |
| 2 | `src/app/boot.ts` | 208 | `deps` | const |
| 3 | `src/app/boot.ts` | 407 | `pomoState` | const |
| 4 | `src/app/render.ts` | 46 | `RenderMainDeps` | interface |
| 5 | `src/app/render.ts` | 108 | `deps` | const |
| 6 | `src/contract/lifecycle.ts` | 25 | `add` | function |
| 7 | `src/contract/lifecycle.ts` | 30 | `on` | function |
| 8 | `src/contract/lifecycle.ts` | 44 | `dispose` | function |
| 9 | `src/contract/registry.ts` | 13 | `register` | function |
| 10 | `src/contract/registry.ts` | 18 | `require` | function |
| 11 | `src/contract/registry.ts` | 24 | `JU_REGISTRY` | const |
| 12 | `src/core/actions.ts` | 109 | `deps` | const |
| 13 | `src/core/actions.ts` | 156 | `bumpStructRev` | function |
| 14 | `src/core/actions.ts` | 201 | `FREE_NODE_LIMIT` | const |
| 15 | `src/core/audio.ts` | 29 | `MusicTrack` | interface |
| 16 | `src/core/audio.ts` | 66 | `toPlayableUrl` | function |
| 17 | `src/core/audio.ts` | 107 | `BUNDLED_TRACK_SRC` | const |
| 18 | `src/core/audio.ts` | 132 | `getMusicVolume` | function |
| 19 | `src/core/audio.ts` | 225 | `toggleTrack` | function |
| 20 | `src/core/crypto.ts` | 25 | `ENC_ITER` | const |
| 21 | `src/core/crypto.ts` | 48 | `CryptoDeps` | interface |
| 22 | `src/core/crypto.ts` | 74 | `deps` | const |
| 23 | `src/core/crypto.ts` | 113 | `deriveKey` | function |
| 24 | `src/core/errors.ts` | 43 | `ErrorDeps` | interface |
| 25 | `src/core/errors.ts` | 56 | `deps` | const |
| 26 | `src/core/persist.ts` | 63 | `PersistDeps` | interface |
| 27 | `src/core/persist.ts` | 89 | `deps` | const |
| 28 | `src/core/persist.ts` | 119 | `PENDING_SYNC_KEY` | const |
| 29 | `src/core/persist.ts` | 502 | `removeNodeFromMap` | function |
| 30 | `src/core/persist.ts` | 608 | `mergeRemoteState` | function |
| 31 | `src/core/persist.ts` | 962 | `_broadcastRev` | function |
| 32 | `src/core/persist.ts` | 975 | `markDiskConfirmed` | function |
| 33 | `src/core/persist.ts` | 997 | `getLastEncPayload` | function |
| 34 | `src/core/persist.ts` | 1010 | `runPersist` | function |
| 35 | `src/core/persist.ts` | 1096 | `HISTORY_LIMIT` | const |
| 36 | `src/core/persist.ts` | 1160 | `resetHistory` | function |
| 37 | `src/core/richtext.ts` | 22 | `RichtextDeps` | interface |
| 38 | `src/core/richtext.ts` | 28 | `deps` | const |
| 39 | `src/core/richtext.ts` | 45 | `string` | const |
| 40 | `src/core/richtext.ts` | 55 | `_execWarnAtMap` | const |
| 41 | `src/core/richtext.ts` | 55 | `number` | const |
| 42 | `src/core/richtext.ts` | 61 | `_warnExecFail` | function |
| 43 | `src/core/richtext.ts` | 188 | `PasteParseResult` | interface |
| 44 | `src/core/search.worker.ts` | 31 | `SearchRequest` | interface |
| 45 | `src/core/search.worker.ts` | 63 | `SearchIndex` | interface |
| 46 | `src/core/search.worker.ts` | 70 | `SEARCH_DEFAULT_LIMIT` | const |
| 47 | `src/core/search.worker.ts` | 87 | `toSearchHaystack` | function |
| 48 | `src/core/search.worker.ts` | 100 | `tokenizeForIndex` | function |
| 49 | `src/core/search.worker.ts` | 121 | `buildSearchIndex` | function |
| 50 | `src/core/search.worker.ts` | 170 | `querySearchIndex` | function |
| 51 | `src/core/store.ts` | 23 | `listeners` | const |
| 52 | `src/core/store.ts` | 24 | `state` | let |
| 53 | `src/core/store.ts` | 74 | `PersistStore` | interface |
| 54 | `src/core/store.ts` | 90 | `getPersistStore` | function |
| 55 | `src/core/store.ts` | 112 | `CalIndexPort` | interface |
| 56 | `src/core/store.ts` | 128 | `getCalIndexPort` | function |
| 57 | `src/core/store.ts` | 137 | `invalidateCalIndex` | function |
| 58 | `src/core/wordcount.worker.ts` | 21 | `WordCountRequest` | interface |
| 59 | `src/io/export.ts` | 48 | `ExportDeps` | interface |
| 60 | `src/io/export.ts` | 82 | `deps` | const |
| 61 | `src/io/export.ts` | 115 | `walkTree` | function |
| 62 | `src/io/export.ts` | 504 | `downloadMindmapSvg` | function |
| 63 | `src/io/import.ts` | 42 | `ImportDeps` | interface |
| 64 | `src/io/import.ts` | 99 | `deps` | const |
| 65 | `src/io/import.ts` | 136 | `MAX_IMPORT_BYTES` | const |
| 66 | `src/io/import.ts` | 138 | `looksLikeBinaryText` | function |
| 67 | `src/io/import.ts` | 191 | `_createImportDoc` | function |
| 68 | `src/io/import.ts` | 402 | `IMPORT_BINARY_EXTS` | const |
| 69 | `src/io/import.ts` | 409 | `IMG_IMPORT_EXTS` | const |
| 70 | `src/io/import.ts` | 466 | `_unzipEntry` | function |
| 71 | `src/legacy/loader.ts` | 10 | `loadLegacy` | function |
| 72 | `src/ui/editors.ts` | 43 | `EditorDeps` | interface |
| 73 | `src/ui/editors.ts` | 72 | `deps` | const |
| 74 | `src/ui/editors.ts` | 187 | `number` | const |
| 75 | `src/ui/editors.ts` | 416 | `hasAnyFormat` | function |
| 76 | `src/ui/editors.ts` | 464 | `PainterState` | type |
| 77 | `src/ui/editors.ts` | 578 | `captureFormatFromNodes` | function |
| 78 | `src/ui/editors.ts` | 589 | `applyFormatToNodes` | function |
| 79 | `src/ui/focus.ts` | 26 | `FocusRole` | type |
| 80 | `src/ui/focus.ts` | 29 | `SavedFocus` | interface |
| 81 | `src/ui/focus.ts` | 45 | `deps` | const |
| 82 | `src/ui/focus.ts` | 70 | `getSavedFocus` | function |
| 83 | `src/ui/layout.ts` | 32 | `deps` | const |
| 84 | `src/ui/layout.ts` | 522 | `SearchResultEnvelope` | interface |
| 85 | `src/ui/layout.ts` | 528 | `SearchBindOptions` | interface |
| 86 | `src/ui/layout.ts` | 542 | `SearchWorkerHandle` | interface |
| 87 | `src/ui/print.ts` | 23 | `PrintDeps` | interface |
| 88 | `src/ui/print.ts` | 37 | `deps` | const |
| 89 | `src/ui/rightbar.ts` | 45 | `deps` | const |
| 90 | `src/ui/selection.ts` | 52 | `MSelection` | type |
| 91 | `src/ui/selection.ts` | 54 | `_mSelRaf` | let |
| 92 | `src/ui/theme.ts` | 22 | `deps` | const |
| 93 | `src/ui/timepicker.ts` | 20 | `TimepickerDeps` | interface |
| 94 | `src/ui/timepicker.ts` | 34 | `deps` | const |
| 95 | `src/ui/timepicker.ts` | 48 | `CalSelEntry` | type |
| 96 | `src/ui/timepicker.ts` | 51 | `CalSelEl` | interface |
| 97 | `src/utils/lunar.ts` | 22 | `LunarDate` | interface |
| 98 | `src/utils/lunar.ts` | 30 | `SolarDate` | interface |
| 99 | `src/utils/lunar.ts` | 37 | `DayLabel` | interface |
| 100 | `src/utils/lunar.ts` | 44 | `RecurRule` | interface |
| 101 | `src/utils/lunar.ts` | 51 | `NaturalDateResult` | interface |
| 102 | `src/utils/lunar.ts` | 85 | `CN_NUM` | const |
| 103 | `src/utils/lunar.ts` | 86 | `LUNAR_MONTH_CN` | const |
| 104 | `src/utils/lunar.ts` | 87 | `TIANGAN` | const |
| 105 | `src/utils/lunar.ts` | 88 | `DIZHI` | const |
| 106 | `src/utils/lunar.ts` | 92 | `string` | const |
| 107 | `src/views/calendar.ts` | 51 | `CalTodos` | type |
| 108 | `src/views/calendar.ts` | 54 | `PasteLines` | interface |
| 109 | `src/views/calendar.ts` | 64 | `CalendarDeps` | interface |
| 110 | `src/views/calendar.ts` | 130 | `deps` | const |
| 111 | `src/views/calendar.ts` | 557 | `cnYmd` | function |
| 112 | `src/views/calendar.ts` | 989 | `calModuleBadge` | function |
| 113 | `src/views/database/formula.ts` | 23 | `DbFieldType` | type |
| 114 | `src/views/database/formula.ts` | 26 | `DbFieldDefResolved` | interface |
| 115 | `src/views/database/formula.ts` | 58 | `FormulaDeps` | interface |
| 116 | `src/views/database/formula.ts` | 69 | `deps` | const |
| 117 | `src/views/database/panels.ts` | 39 | `formatTimeValue` | reexport |
| 118 | `src/views/database/panels.ts` | 45 | `PanelDeps` | interface |
| 119 | `src/views/database/panels.ts` | 74 | `deps` | const |
| 120 | `src/views/database/panels.ts` | 102 | `string` | const |
| 121 | `src/views/database/render.ts` | 57 | `DatabaseDeps` | interface |
| 122 | `src/views/database/render.ts` | 140 | `deps` | const |
| 123 | `src/views/graph.ts` | 23 | `GraphPosition` | interface |
| 124 | `src/views/graph.ts` | 32 | `SyncGraphLayoutArgs` | interface |
| 125 | `src/views/graph.ts` | 47 | `GraphDeps` | interface |
| 126 | `src/views/graph.ts` | 100 | `deps` | const |
| 127 | `src/views/lists.ts` | 32 | `ListsDeps` | interface |
| 128 | `src/views/lists.ts` | 85 | `deps` | const |
| 129 | `src/views/mindmap.ts` | 56 | `MindmapDeps` | interface |
| 130 | `src/views/mindmap.ts` | 89 | `deps` | const |
| 131 | `src/views/outline.ts` | 58 | `PasteLines` | interface |
| 132 | `src/views/outline.ts` | 65 | `OutlineHit` | interface |
| 133 | `src/views/outline.ts` | 71 | `DropTarget` | interface |
| 134 | `src/views/outline.ts` | 80 | `OutlineSelection` | interface |
| 135 | `src/views/outline.ts` | 90 | `OutlineDeps` | interface |
| 136 | `src/views/outline.ts` | 149 | `deps` | const |
| 137 | `src/views/outline.ts` | 205 | `_outlineEscBound` | let |
| 138 | `src/views/outline.ts` | 206 | `_dragState` | let |
| 139 | `src/views/outline.ts` | 207 | `_outlineDragSel` | let |
| 140 | `src/views/outline.ts` | 370 | `_buildOutlineBox` | function |
| 141 | `src/views/outline.ts` | 508 | `outlineRowHit` | function |
| 142 | `src/views/outline.ts` | 520 | `outlineDragSelectPaint` | function |
| 143 | `src/views/outline.ts` | 532 | `outlineDragSelectStart` | function |
| 144 | `src/views/outline.ts` | 542 | `outlineDragSelectDetach` | function |
| 145 | `src/views/outline.ts` | 550 | `outlineDragSelectMove` | function |
| 146 | `src/views/outline.ts` | 593 | `outlineDragSelectEnd` | function |
| 147 | `src/views/outline.ts` | 609 | `topSelected` | function |
| 148 | `src/views/outline.ts` | 620 | `isDescendantOf` | function |
| 149 | `src/views/outline.ts` | 720 | `_outlineNodeToClipData` | function |
| 150 | `src/views/outline.ts` | 733 | `_outlineParseClipText` | function |
| 151 | `src/views/outline.ts` | 744 | `_outlineInsertClipNodes` | function |
| 152 | `src/views/outline.ts` | 865 | `outlinePasteFromText` | function |
| 153 | `src/views/outline.ts` | 918 | `outlineDragStart` | function |
| 154 | `src/views/outline.ts` | 934 | `outlineDropTarget` | function |
| 155 | `src/views/outline.ts` | 986 | `outlineDragMove` | function |
| 156 | `src/views/outline.ts` | 1026 | `outlineDragEnd` | function |
| 157 | `src/views/presentation.ts` | 20 | `PresentationDeps` | interface |
| 158 | `src/views/presentation.ts` | 38 | `deps` | const |
| 159 | `src/views/slides.ts` | 30 | `SlidesDeps` | interface |
| 160 | `src/views/slides.ts` | 48 | `deps` | const |
| 161 | `src/views/slides.ts` | 84 | `SlidesLine` | interface |
| 162 | `src/views/slides.ts` | 101 | `SlidesCtx` | interface |

## 四、后续动作

- 人工确认后，对确认无外部依赖的符号执行「降级为文件内私有（去掉 `export`）或删除」；
- 若符号属于 `window.JU` 契约面（见 `src/main.ts` 的 `Object.assign(window.JU, …)`），保留不动；
- 清理完成后重跑本脚本，未使用导出数应归零或仅剩已登记豁免项。
