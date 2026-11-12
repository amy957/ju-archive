# 未使用导出清单（UNUSED-EXPORTS）

> 扫描工具：`scripts/check-unused-exports.mjs`（静态 `import` 反查，无运行时开销）
> 扫描日期：2026-11-02
> 扫描范围：`src/**/*.ts`（50 个文件，排除入口 `src/main.ts` 与 `*.d.ts`）

## 一、汇总

| 指标 | 数值 |
| --- | --- |
| 扫描文件 | 50 |
| 导出符号总数 | 1214 |
| 未使用导出 | **212** |
| 导出使用率 | 82.5% |
| 跳过（`export default`） | 0 |

## 二、判定口径

1. 任一**其它**文件以 `import { X } from …` / `import X from …` 引入同名符号 → 视为已使用；
2. `import * as ns from './x'` 或 `export * from './x'` → 该模块全部导出视为已使用；
3. 入口 `src/main.ts` 的导出不计入「未使用」（挂载点自身无外部引用）；
4. 通过字符串 / `window` 全局键间接引用的符号不会被本工具识别，人工复核时请保留。

## 三、明细（仅标记，不删代码）

| # | 文件 | 行 | 符号 | 类型 |
| --- | --- | --- | --- | --- |
| 1 | `src/app/boot.ts` | 61 | `BootDeps` | interface |
| 2 | `src/app/boot.ts` | 205 | `deps` | const |
| 3 | `src/app/boot.ts` | 933 | `pomoState` | const |
| 4 | `src/app/render.ts` | 50 | `RenderMainDeps` | interface |
| 5 | `src/app/render.ts` | 112 | `deps` | const |
| 6 | `src/contract/lifecycle.ts` | 25 | `add` | function |
| 7 | `src/contract/lifecycle.ts` | 30 | `on` | function |
| 8 | `src/contract/lifecycle.ts` | 44 | `dispose` | function |
| 9 | `src/contract/registry.ts` | 13 | `register` | function |
| 10 | `src/contract/registry.ts` | 18 | `require` | function |
| 11 | `src/contract/registry.ts` | 24 | `JU_REGISTRY` | const |
| 12 | `src/core/actions.ts` | 130 | `deps` | const |
| 13 | `src/core/actions.ts` | 233 | `FREE_NODE_LIMIT` | const |
| 14 | `src/core/audio.ts` | 29 | `MusicTrack` | interface |
| 15 | `src/core/crypto.ts` | 25 | `ENC_ITER` | const |
| 16 | `src/core/crypto.ts` | 48 | `CryptoDeps` | interface |
| 17 | `src/core/crypto.ts` | 74 | `deps` | const |
| 18 | `src/core/crypto.ts` | 113 | `deriveKey` | function |
| 19 | `src/core/errors.ts` | 36 | `ErrorDeps` | interface |
| 20 | `src/core/errors.ts` | 49 | `deps` | const |
| 21 | `src/core/idb.ts` | 26 | `IDB_NAME` | const |
| 22 | `src/core/idb.ts` | 28 | `IDB_VERSION` | const |
| 23 | `src/core/idb.ts` | 30 | `IDB_STORE_NAME` | const |
| 24 | `src/core/idb.ts` | 32 | `IDB_STATE_KEY` | const |
| 25 | `src/core/idb.ts` | 34 | `IDB_TIMEOUT_MS` | const |
| 26 | `src/core/idb.ts` | 37 | `IdbMirrorStatus` | interface |
| 27 | `src/core/idb.ts` | 104 | `idbOpen` | function |
| 28 | `src/core/idb.ts` | 137 | `idbPut` | function |
| 29 | `src/core/idb.ts` | 177 | `idbGet` | function |
| 30 | `src/core/persist.ts` | 75 | `PersistDeps` | interface |
| 31 | `src/core/persist.ts` | 103 | `deps` | const |
| 32 | `src/core/persist.ts` | 521 | `removeNodeFromMap` | function |
| 33 | `src/core/persist.ts` | 633 | `mergeRemoteState` | function |
| 34 | `src/core/persist.ts` | 987 | `_broadcastRev` | function |
| 35 | `src/core/persist.ts` | 1000 | `markDiskConfirmed` | function |
| 36 | `src/core/persist.ts` | 1084 | `runPersist` | function |
| 37 | `src/core/persist.ts` | 1213 | `HISTORY_LIMIT` | const |
| 38 | `src/core/persist.ts` | 1277 | `resetHistory` | function |
| 39 | `src/core/richtext.ts` | 22 | `RichtextDeps` | interface |
| 40 | `src/core/richtext.ts` | 36 | `deps` | const |
| 41 | `src/core/richtext.ts` | 53 | `string` | const |
| 42 | `src/core/richtext.ts` | 179 | `_execWarnAtMap` | const |
| 43 | `src/core/richtext.ts` | 179 | `number` | const |
| 44 | `src/core/richtext.ts` | 185 | `_warnExecFail` | function |
| 45 | `src/core/richtext.ts` | 315 | `PasteParseResult` | interface |
| 46 | `src/core/richtext.ts` | 399 | `cssPropertyName` | function |
| 47 | `src/core/richtext.ts` | 407 | `cssPropertyCamel` | function |
| 48 | `src/core/richtext.ts` | 416 | `isNeutralStyleValue` | function |
| 49 | `src/core/richtext.ts` | 816 | `selectionHasStyle` | function |
| 50 | `src/core/richtext.ts` | 883 | `INLINE_STYLE_PROPS` | const |
| 51 | `src/core/richtext.ts` | 1423 | `selectionValueEquals` | function |
| 52 | `src/core/richtext.ts` | 1803 | `setTypingInlineStyle` | function |
| 53 | `src/core/richtext.ts` | 1814 | `clearTypingInlineStyle` | function |
| 54 | `src/core/richtext.ts` | 2012 | `hostSelectorOf` | function |
| 55 | `src/core/search.worker.ts` | 31 | `SearchRequest` | interface |
| 56 | `src/core/search.worker.ts` | 63 | `SearchIndex` | interface |
| 57 | `src/core/search.worker.ts` | 70 | `SEARCH_DEFAULT_LIMIT` | const |
| 58 | `src/core/search.worker.ts` | 87 | `toSearchHaystack` | function |
| 59 | `src/core/search.worker.ts` | 100 | `tokenizeForIndex` | function |
| 60 | `src/core/search.worker.ts` | 121 | `buildSearchIndex` | function |
| 61 | `src/core/search.worker.ts` | 170 | `querySearchIndex` | function |
| 62 | `src/core/store.ts` | 23 | `listeners` | const |
| 63 | `src/core/store.ts` | 24 | `state` | let |
| 64 | `src/core/store.ts` | 74 | `PersistStore` | interface |
| 65 | `src/core/store.ts` | 90 | `getPersistStore` | function |
| 66 | `src/core/store.ts` | 112 | `CalIndexPort` | interface |
| 67 | `src/core/store.ts` | 128 | `getCalIndexPort` | function |
| 68 | `src/core/store.ts` | 137 | `invalidateCalIndex` | function |
| 69 | `src/core/virtual-scroll.ts` | 32 | `VS_FIND_RESTORE_MS` | const |
| 70 | `src/core/virtual-scroll.ts` | 41 | `VS_OVERSCAN` | const |
| 71 | `src/core/virtual-scroll.ts` | 43 | `VirtualScrollDeps` | interface |
| 72 | `src/core/virtual-scroll.ts` | 53 | `deps` | const |
| 73 | `src/core/virtual-scroll.ts` | 64 | `VirtualScrollInterceptKind` | type |
| 74 | `src/core/virtual-scroll.ts` | 66 | `VirtualScrollDecision` | interface |
| 75 | `src/core/virtual-scroll.ts` | 107 | `detectDeviceMemory` | function |
| 76 | `src/core/virtual-scroll.ts` | 140 | `decideVirtual` | function |
| 77 | `src/core/virtual-scroll.ts` | 169 | `evaluate` | function |
| 78 | `src/core/virtual-scroll.ts` | 196 | `isIntercepting` | function |
| 79 | `src/core/wordcount.worker.ts` | 21 | `WordCountRequest` | interface |
| 80 | `src/core/wordcount.worker.ts` | 83 | `TokenizeOptions` | interface |
| 81 | `src/core/wordcount.worker.ts` | 93 | `DEFAULT_TOKENIZE_OPTIONS` | const |
| 82 | `src/core/wordcount.worker.ts` | 161 | `tokenize` | function |
| 83 | `src/core/wordcount.worker.ts` | 190 | `hashTokens` | function |
| 84 | `src/core/wordcount.worker.ts` | 241 | `TokenDiffRequest` | interface |
| 85 | `src/core/wordcount.worker.ts` | 250 | `TokenDiffResponse` | interface |
| 86 | `src/io/export.ts` | 48 | `ExportDeps` | interface |
| 87 | `src/io/export.ts` | 82 | `deps` | const |
| 88 | `src/io/export.ts` | 115 | `walkTree` | function |
| 89 | `src/io/export.ts` | 380 | `downloadMindmapSvg` | function |
| 90 | `src/io/import.ts` | 42 | `ImportDeps` | interface |
| 91 | `src/io/import.ts` | 99 | `deps` | const |
| 92 | `src/io/import.ts` | 136 | `MAX_IMPORT_BYTES` | const |
| 93 | `src/io/import.ts` | 138 | `looksLikeBinaryText` | function |
| 94 | `src/io/import.ts` | 191 | `_createImportDoc` | function |
| 95 | `src/io/import.ts` | 402 | `IMPORT_BINARY_EXTS` | const |
| 96 | `src/io/import.ts` | 409 | `IMG_IMPORT_EXTS` | const |
| 97 | `src/io/import.ts` | 466 | `_unzipEntry` | function |
| 98 | `src/legacy/loader.ts` | 10 | `loadLegacy` | function |
| 99 | `src/ui/common.ts` | 210 | `bindPressFallback` | function |
| 100 | `src/ui/editors.ts` | 51 | `EditorDeps` | interface |
| 101 | `src/ui/editors.ts` | 80 | `deps` | const |
| 102 | `src/ui/editors.ts` | 237 | `FONT_SIZE_PRESETS` | const |
| 103 | `src/ui/editors.ts` | 248 | `number` | const |
| 104 | `src/ui/editors.ts` | 318 | `FormatActiveState` | interface |
| 105 | `src/ui/editors.ts` | 592 | `hasAnyFormat` | function |
| 106 | `src/ui/editors.ts` | 640 | `PainterState` | type |
| 107 | `src/ui/editors.ts` | 746 | `captureFormatFromNodes` | function |
| 108 | `src/ui/editors.ts` | 757 | `applyFormatToNodes` | function |
| 109 | `src/ui/focus.ts` | 26 | `FocusRole` | type |
| 110 | `src/ui/focus.ts` | 29 | `SavedFocus` | interface |
| 111 | `src/ui/focus.ts` | 45 | `deps` | const |
| 112 | `src/ui/focus.ts` | 70 | `getSavedFocus` | function |
| 113 | `src/ui/layout.ts` | 32 | `deps` | const |
| 114 | `src/ui/layout.ts` | 699 | `SearchResultEnvelope` | interface |
| 115 | `src/ui/layout.ts` | 705 | `SearchBindOptions` | interface |
| 116 | `src/ui/layout.ts` | 719 | `SearchWorkerHandle` | interface |
| 117 | `src/ui/manual.ts` | 197 | `openManualModal` | function |
| 118 | `src/ui/print.ts` | 23 | `PrintDeps` | interface |
| 119 | `src/ui/print.ts` | 37 | `deps` | const |
| 120 | `src/ui/rightbar.ts` | 59 | `deps` | const |
| 121 | `src/ui/rightbar.ts` | 197 | `refreshFormatButtons` | function |
| 122 | `src/ui/rightbar.ts` | 284 | `saveRange` | function |
| 123 | `src/ui/rightbar.ts` | 316 | `restoreSel` | function |
| 124 | `src/ui/rightbar.ts` | 365 | `clearSavedRange` | function |
| 125 | `src/ui/selection.ts` | 52 | `MSelection` | type |
| 126 | `src/ui/selection.ts` | 54 | `_mSelRaf` | let |
| 127 | `src/ui/sidebar.ts` | 332 | `sortTagRowsByMode` | function |
| 128 | `src/ui/theme.ts` | 22 | `deps` | const |
| 129 | `src/ui/timepicker.ts` | 20 | `TimepickerDeps` | interface |
| 130 | `src/ui/timepicker.ts` | 34 | `deps` | const |
| 131 | `src/ui/timepicker.ts` | 48 | `CalSelEntry` | type |
| 132 | `src/ui/timepicker.ts` | 51 | `CalSelEl` | interface |
| 133 | `src/ui/xselect.ts` | 29 | `XSelRange` | interface |
| 134 | `src/ui/xselect.ts` | 30 | `XSelPoint` | interface |
| 135 | `src/ui/xselect.ts` | 62 | `xselHostById` | function |
| 136 | `src/ui/xselect.ts` | 112 | `xselPointAt` | function |
| 137 | `src/ui/xselect.ts` | 618 | `XSelNativeSnap` | interface |
| 138 | `src/ui/xselect.ts` | 663 | `xselOverlayStats` | function |
| 139 | `src/ui/xselect.ts` | 683 | `xselDescribe` | function |
| 140 | `src/utils/lunar.ts` | 22 | `LunarDate` | interface |
| 141 | `src/utils/lunar.ts` | 30 | `SolarDate` | interface |
| 142 | `src/utils/lunar.ts` | 37 | `DayLabel` | interface |
| 143 | `src/utils/lunar.ts` | 44 | `RecurRule` | interface |
| 144 | `src/utils/lunar.ts` | 51 | `NaturalDateResult` | interface |
| 145 | `src/utils/lunar.ts` | 85 | `CN_NUM` | const |
| 146 | `src/utils/lunar.ts` | 86 | `LUNAR_MONTH_CN` | const |
| 147 | `src/utils/lunar.ts` | 87 | `TIANGAN` | const |
| 148 | `src/utils/lunar.ts` | 88 | `DIZHI` | const |
| 149 | `src/utils/lunar.ts` | 92 | `string` | const |
| 150 | `src/utils/regions.ts` | 44 | `CN_REGIONS` | const |
| 151 | `src/utils/regions.ts` | 44 | `string` | const |
| 152 | `src/views/calendar.ts` | 51 | `CalTodos` | type |
| 153 | `src/views/calendar.ts` | 54 | `PasteLines` | interface |
| 154 | `src/views/calendar.ts` | 64 | `CalendarDeps` | interface |
| 155 | `src/views/calendar.ts` | 130 | `deps` | const |
| 156 | `src/views/calendar.ts` | 579 | `cnYmd` | function |
| 157 | `src/views/calendar.ts` | 1060 | `calModuleBadge` | function |
| 158 | `src/views/calendar.ts` | 2398 | `Prio` | type |
| 159 | `src/views/calendar.ts` | 2399 | `PRIO_LABEL` | const |
| 160 | `src/views/calendar.ts` | 2399 | `string` | const |
| 161 | `src/views/calendar.ts` | 2406 | `prioKeyOf` | function |
| 162 | `src/views/calendar.ts` | 2415 | `priorityBadges` | function |
| 163 | `src/views/database/formula.ts` | 23 | `DbFieldType` | type |
| 164 | `src/views/database/formula.ts` | 26 | `DbFieldDefResolved` | interface |
| 165 | `src/views/database/formula.ts` | 58 | `FormulaDeps` | interface |
| 166 | `src/views/database/formula.ts` | 69 | `deps` | const |
| 167 | `src/views/database/panels.ts` | 40 | `formatTimeValue` | reexport |
| 168 | `src/views/database/panels.ts` | 46 | `PanelDeps` | interface |
| 169 | `src/views/database/panels.ts` | 75 | `deps` | const |
| 170 | `src/views/database/panels.ts` | 103 | `string` | const |
| 171 | `src/views/database/render.ts` | 57 | `DatabaseDeps` | interface |
| 172 | `src/views/database/render.ts` | 140 | `deps` | const |
| 173 | `src/views/graph.ts` | 23 | `GraphPosition` | interface |
| 174 | `src/views/graph.ts` | 32 | `SyncGraphLayoutArgs` | interface |
| 175 | `src/views/graph.ts` | 47 | `GraphDeps` | interface |
| 176 | `src/views/graph.ts` | 100 | `deps` | const |
| 177 | `src/views/lists.ts` | 34 | `ListsDeps` | interface |
| 178 | `src/views/lists.ts` | 87 | `deps` | const |
| 179 | `src/views/lists.ts` | 194 | `BUILTIN_DB_TEMPLATE_NAME` | const |
| 180 | `src/views/mindmap.ts` | 56 | `MindmapDeps` | interface |
| 181 | `src/views/mindmap.ts` | 89 | `deps` | const |
| 182 | `src/views/outline.ts` | 62 | `PasteLines` | interface |
| 183 | `src/views/outline.ts` | 69 | `OutlineHit` | interface |
| 184 | `src/views/outline.ts` | 75 | `DropTarget` | interface |
| 185 | `src/views/outline.ts` | 84 | `OutlineSelection` | interface |
| 186 | `src/views/outline.ts` | 94 | `OutlineDeps` | interface |
| 187 | `src/views/outline.ts` | 152 | `deps` | const |
| 188 | `src/views/outline.ts` | 207 | `_outlineEscBound` | let |
| 189 | `src/views/outline.ts` | 208 | `_dragState` | let |
| 190 | `src/views/outline.ts` | 209 | `_outlineDragSel` | let |
| 191 | `src/views/outline.ts` | 380 | `_buildOutlineBox` | function |
| 192 | `src/views/outline.ts` | 529 | `outlineRowHit` | function |
| 193 | `src/views/outline.ts` | 541 | `outlineDragSelectPaint` | function |
| 194 | `src/views/outline.ts` | 553 | `outlineDragSelectStart` | function |
| 195 | `src/views/outline.ts` | 563 | `outlineDragSelectDetach` | function |
| 196 | `src/views/outline.ts` | 571 | `outlineDragSelectMove` | function |
| 197 | `src/views/outline.ts` | 614 | `outlineDragSelectEnd` | function |
| 198 | `src/views/outline.ts` | 630 | `topSelected` | function |
| 199 | `src/views/outline.ts` | 641 | `isDescendantOf` | function |
| 200 | `src/views/outline.ts` | 741 | `_outlineNodeToClipData` | function |
| 201 | `src/views/outline.ts` | 754 | `_outlineParseClipText` | function |
| 202 | `src/views/outline.ts` | 765 | `_outlineInsertClipNodes` | function |
| 203 | `src/views/outline.ts` | 932 | `outlineDragStart` | function |
| 204 | `src/views/outline.ts` | 948 | `outlineDropTarget` | function |
| 205 | `src/views/outline.ts` | 1000 | `outlineDragMove` | function |
| 206 | `src/views/outline.ts` | 1040 | `outlineDragEnd` | function |
| 207 | `src/views/presentation.ts` | 20 | `PresentationDeps` | interface |
| 208 | `src/views/presentation.ts` | 38 | `deps` | const |
| 209 | `src/views/slides.ts` | 32 | `SlidesDeps` | interface |
| 210 | `src/views/slides.ts` | 50 | `deps` | const |
| 211 | `src/views/slides.ts` | 86 | `SlidesLine` | interface |
| 212 | `src/views/slides.ts` | 103 | `SlidesCtx` | interface |

## 四、后续动作

- 人工确认后，对确认无外部依赖的符号执行「降级为文件内私有（去掉 `export`）或删除」；
- 若符号属于 `window.JU` 契约面（见 `src/main.ts` 的 `Object.assign(window.JU, …)`），保留不动；
- 清理完成后重跑本脚本，未使用导出数应归零或仅剩已登记豁免项。
