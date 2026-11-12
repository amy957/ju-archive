# M0-7 · 模块边界清单（canonical v2.0-t3.html → Vite + TS 拆分前置文档）

> 生效批次：M0-7 / 批次 C（P2，只出文档，零代码迁移）
> 产品件：`6.P0-T3基线/v2.0-t3.html`（**本次任务零字节改动**，parity 见 §6）
> 取证脚本：`_临时脚本/_m07_module_scan.mjs`、`_临时脚本/_m07_probe_lines.mjs`、`_临时脚本/_m07_probe_effects.mjs`
> 取证输出：`_临时脚本/_m07_module_scan.json`、`_临时脚本/_m07_block_edges.txt`

---

## 0. 取证口径与方法（可复现）

```bat
"C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" "_临时脚本\_m07_module_scan.mjs" "e:\APP\归档\6.P0-T3基线\v2.0-t3.html" "_临时脚本\_m07_module_scan.json"
:: → SCAN OK blocks=9 edges=557
```

| 口径项 | 判定规则 |
| --- | --- |
| 块切分 | 按字面 `<script>` … `</script>` 顺序配对（与浏览器 HTML 解析同规则；`<\/script>` 转义串不参与配对） |
| 顶层声明 | 行首**零缩进**的 `const` / `let` / `var` / `function` / `class`（含 `async`）声明；另补 `const A=1,B=2` 多声明形式 |
| 跨块引用边 | 「块 X 声明的标识符」在「块 Y 文本」中按 `\bname\b` 命中 ≥1 次 ⇒ 边 `X → Y` |
| 已知局限 | 该判定是**词法级**的，不含作用域解析：当同名标识符在另一块内被**重新声明**（典型：B8/B9 为自包含 IIFE 影子层），会产生「同名碰撞」而非真实依赖。此类边在 §1 中标注 `[collision]`，**不计入迁移依赖**。 |
| 副作用统计 | 正则命中计数（IIFE 行首、`document/window.addEventListener`、`execCommand=`、`new MutationObserver`、`new Worker`、`new MessageChannel`、`localStorage.setItem`、`indexedDB.open`） |

### 0.1 真实块切分表（行号 = 以 `\n` 切分的原始行号，可由 `_m07_module_scan.mjs` 复算）

| 块 | 行区间 | 字符数 | 顶层声明数 | 被其它块引用名数 | 主要副作用命中 |
| --- | --- | --- | --- | --- | --- |
| B1 (script1) | 1315–7161 | 271,841 | 399 | 161 | IIFE×11、doc 监听×10、win 监听×2、`execCommand=`×2、MutationObserver×1、Worker×1、MessageChannel×1、localStorage.setItem×8 |
| B2 (script2) | 7162–11612 | 199,179 | 199 | 51 | IIFE×2、doc 监听×15、win 监听×10 |
| B3 (script3) | 11613–14551 | 130,434 | 81 | 16 | IIFE×3、doc 监听×10 |
| B4 (script4) | 14552–15821 | 53,242 | 53 | 18 | doc 监听×1、win 监听×1、Worker×1、MessageChannel×1 |
| B5 (script5) | 15822–18309 | 111,937 | 127 | 42 | IIFE×4、doc 监听×7、localStorage.setItem×1 |
| B6 (script6) | 18310–22793 | 207,002 | 138 | 31 | IIFE×5、doc 监听×27、win 监听×9、localStorage.setItem×9、indexedDB.open×1 |
| B7 (补丁块) | 22794–22904 | 5,046 | 0 | 0 | IIFE×1、MutationObserver×1 |
| B8 (L9-W6 内联) | 22905–24233 | 51,709 | 94 | 19 | IIFE×1、Worker×2 |
| B9 (L10-W2 接缝) | 24234–24323 | 3,559 | 0 | 0 | IIFE×1 |

> 任务约定口径为「6 个 script 块」，实测文件为 **9 个** `<script>` 块。B1–B6 为主干（对应 4 处 `JU.register` 导出契约，见 §1.7），B7–B9 为后置补丁/影子层，单独列于 §5 附录，避免遗漏。

---

## 1. 逐块清单（B1–B6）

格式：`名称 → 引用块`。仅列**被其它块引用**的顶层声明；名后 `[collision:By]` 表示该块内同名标识符被目标块重新声明，属词法碰撞，非真实依赖。

### 1.1 B1 · script1（1315–7161）— 契约层 + 加密 + 桌面存储 + Store/工具 + L6/L7/L8 基础设施 + 数据核心

职责（块内横幅实测）：`加密模块`｜`桌面版（Tauri）检测与 SQLite 存储适配（核心）`｜`工具`｜`Store`｜`L8 增量落盘（P1a）· 脏集状态`｜`L4 JU-HistoryAgent`｜`L6 基础设施`｜`L16-W3 侧栏计数增量维`｜`L7 索引 Worker 化`｜`L7-W4 两阶段渲染 + progress 协议`。

块首契约（1320–1339，被 M0-7 TS 层镜像）：

```
J.register   L1320
J.require    L1321
J.lifecycle  L1325（add / on / dispose，_disposers 栈）
```

**被其它块引用的顶层声明（161 条）**

```
state→B2,B3,B4,B5,B6,B8 | commit→B2,B3,B4,B5,B6 | actions→B2,B3,B4,B5,B6 | getCurrentDoc→B2,B3,B4,B5,B6
forceRender→B2,B3,B4,B5,B6 | saveUI→B2,B3,B4,B5,B6 | esc→B2,B3,B4,B5,B6 | stripHtml→B2,B3,B4,B5,B6
todayStr→B2,B3,B4,B5,B6 | isBlankNode→B2,B3,B4,B5,B6 | _nowSeq→B2,B3,B4,B5,B6 | pad→B2,B3,B4,B5,B6
viewOf→B2,B4,B5,B6 | toast→B2,B3,B5,B6 | appConfirm→B2,B3,B5,B6 | sanitizeHtml→B2,B3,B6 | ymd→B2,B3,B5,B6
showContextMenu→B2,B3,B5,B6 | VIEW_KIND→B2,B4,B6 | docWordCount→B2,B4,B5,B6 | uid→B2,B6
addNodeTo→B2,B5,B6（L5545 `function addNodeTo(st,parentId,index,init={})`） | clone→B2,B5,B6 | docSubtree→B2,B5,B6 | parseYmd→B2,B5,B6
runPersist→B2,B6 | _win→B2,B3,B5,B6 | safeExec→B2,B3,B4,B5 | makeLRU→B2,B5 | persistNow→B2,B5
undo→B2,B5 | redo→B2,B5 | nodesOnDate→B2,B5 | findOwningTopDocId→B2,B3,B5 | extractTags→B2,B3,B5
appPrompt→B2,B3,B5 | parsePasteLines→B2,B3,B4 | isBlurSuppressed→B2,B3,B4 | l7Skeleton→B2,B5
l7TagIndexWhenReady→B2,B5 | trimPasteHtml→B2,B3 | _tagIndexCache→B2,B4,B5 | _themeList→B3,B5
initDragClose→B3,B5 | isFolder→B3,B4,B5 | placePop→B3,B5 | applyScale→B2,B6
_calDataRev→B2,B6 | _calIndexCache→B2,B6 | _calRecurCache→B2,B6 | _l7IsCalendarView→B2,B6
_l7Now→B2,B5 | _calDayCache→B2 | _calSelKey→B2 | _l7Yield→B2 | _wordCountCache→B2 | _yearCountsCache→B2
commitPendingEditBeforeRender→B2 | fmtDateShort→B2 | focusAfterRender→B2 | focusNode→B2
getBaseFontSize→B2 | historyPast→B2 | invalidateCalIndex→B2 | l7BuildCalIndexAsync→B2
l7CalIndexWhenReady→B2 | mergeRemoteState→B2 | mkCalSel→B2 | openCalTimeModal→B2
savedFocus→B2 | splitPastedLinesToNodes→B2 | _forceRender→B4,B6 | _graphPositions→B4,B5,B6
APP_LOCALE→B4,B6 | fmtRelative→B4,B5 | getNodeSvg→B4,B5 | renderViewTitle→B4,B5 | restoreFocus→B4
saveGraphPositions→B4,B6 | _l7IsTagsView→B5 | _l7SkeletonEnsureCss→B5 | _l7TagCountText→B5
_searchHayCache→B5,B6 | _sideCountsGet→B5 | _themeColor→B5,B6 | docNodeCount→B5,B6
IS_DESKTOP→B5,B6 | purgeNodeMeta→B5 | safeClone→B5,B6 | TAG_RE→B5,B6 | WIKI_RE→B5,B6
_encFallbackTimer→B6 | _encKey→B6 | _encSalt→B6 | _flushPendingSession→B6 | _indexWorkerDispose→B6
_l7YieldCh→B6 | _lastEncPayload→B6 | _lastWrittenJson→B6 | _logTimers→B6 | _modalStack→B6
_ORIGIN_STRIP→B6 | _syncAppInert→B6 | _syncAppInertObserver→B6 | applySystemTheme→B6 | applyTheme→B6
applyUIFields→B6 | b64ToBuf→B6 | bufToB64→B6 | clearEncryptedStore→B6 | defaultState→B6
desktopInvoke→B6 | detectDesktop→B6 | ENC_KEY→B6 | flushGraphPositions→B6 | flushPendingLogs→B6
flushPersistNow→B6 | getState→B6 | hasEncryptedStore→B6 | initStore→B6 | loadUI→B6 | loadUIEncrypted→B6
mergeRemoteIfNewer→B6 | onRemoteStoreChange→B6 | openThemeSelector→B6 | PENDING_KEY→B6
PENDING_SYNC_KEY→B6 | readEncryptedStore→B6 | recoverPendingEncrypted→B6 | removeNodeFromMap→B6
repairTreeConsistency→B6 | schedulePersist→B6 | scheduleRender→B6 | STORE_BC_INSTANCE→B6
STORE_BC_NAME→B6 | STORE_KEY→B6 | subscribe→B6 | UI_ENC_KEY→B6 | UI_KEY→B6 | VERS_ENC_KEY→B6
VERS_KEY→B6 | writeEncryptedStore→B6
decryptState→B6,B8 [collision:B8] | deriveKey→B6,B8 [collision:B8] | ENC_ITER→B6,B8 [collision:B8]
encryptState→B6,B8 [collision:B8] | applyPatch→B8 [collision:B8] | buildPersistBatch→B8,B9 [collision:B8]
extractWikiTitles→B8 [collision:B8] | nodeAllTags→B8 [collision:B8] | tokenize→B8 [collision:B8]
_getOrCreateSalt→B8 | calIndexUpdate→B8 | L8_FAIL_CAP→B8 | L8_MAX_PER_BATCH→B8 | L8_PATCH_MAX→B8
l8PersistFailure→B8 | post→B8 | setIndexWorkerMode→B8 | tagIndexUpdate→B8
```

> 注：`B1 → B8` 一组中，除 `_getOrCreateSalt / calIndexUpdate / L8_* / l8PersistFailure / post / setIndexWorkerMode / tagIndexUpdate` 属真实跨块同名（L9 影子层内联时沿用同名符号），其余均标 `[collision]`——B8 是自包含 IIFE，其内部有独立的 `encryptState / decryptState / tokenize / applyPatch ...` 同名实现，**不依赖 B1 的绑定**。

全局副作用：契约 IIFE（1318）；`execCommand` 猴子补丁 **L1961–1963**（`document.execCommand = function(cmd,ui,value){...}`，先 `bind` 原函数）；`document.addEventListener('dragover'/'drop')` L1979/L1987；`_syncAppInertObserver=new MutationObserver(...)` **L6809**；`_indexWorker=new Worker(getIndexWorkerUrl())` **L4235**；`_l7YieldCh=new MessageChannel()` **L4566**；`localStorage.setItem` ×8。

迁移必守项：`state / commit / actions / N / subscribe` 为全局单实例，**必须先于 B2–B6 初始化**；`execCommand` 补丁依赖 `document.execCommand.bind(document)` 的原始引用，拆块时不得分散到两个模块；`_l7YieldCh` 与 `_l7YieldQ` 必须同模块（同一 `let` 多声明）。

---

### 1.2 B2 · script2（7162–11612）— 大纲视图 + 虚拟滚动 + 日历

职责：`大纲视图`｜`【L12-W3 · M-H 真虚拟滚动】窗口化渲染引擎`｜`【L12-W4 · H5 指标度量】`｜`【L14-W3 · M-H′ 加固】`｜`【L14-OP20 · G7 时间切片】`｜`大纲多选 / 跨行选中 / 批量拖拽`｜`内联表格块`｜`日历容器 + 农历`｜`自然语言日期`｜`日历视图`｜`记事本列`｜`日历时间网格`｜`日历模块化`。

**被其它块引用的顶层声明（51 条）**

```
renderOutlinePage→B4 | renderCalendarPage→B4 | renderOutlineRow→B4 | buildCalLogBlock→B4
calModuleCharsBody→B4 | outlineVisibleSeq→B4 | _calDayNodesForModules→B4 | _disconnectOutlineHeaderRO→B4
_observeOutlineHeader→B4 | _renderPresentationVirtual→B4 | _savedOutlineScroll→B4
_savedMindmapScroll→B4 | _vsShouldUse→B4 | _vsUpdate→B4 | syncEmptyState→B3,B4
renderDocHeaderInline→B3,B4,B6 | __renderDbGalleryVirtual→B3 | __renderMindmapVirtual→B3
countVisibleNodes→B3 | VIRTUAL_THRESHOLD→B3 | _outlineSel→B4,B5 | _outlineDragSel→B6
_dragState→B6 | outlineDragEnd→B6 | outlineDragSelectDetach→B6 | ensureCalendarRoot→B6
__l14LongtaskGate→B6 | _vsUserDisabled→B1,B6 | calendarTodosOnDate→B1,B5,B6
getCalendarRootId→B1,B5,B6 | __l14On→B1,B3,B5 | __l14SideScanEnsure→B1,B5 | __l14SideScan→B5
__l14IntroCounts→B5 | __l14LongtaskGate→B6 | _calSubtreeStep→B1 | _calSweepStep→B1
_renderDayCache→B1 | _syncOutlineHeaderH→B1 | _vsActive→B1,B4 | _vsMetricPush→B1 | _vsNow→B1
_vsScrollToId→B1,B4 | buildCalIndex→B1 | buildYearCounts→B1 | calMinToHm→B1 | calModuleState→B1
dedupCalRoots→B1 | dedupNoteRoots→B1 | ensureNoteDoc→B1 | expandRecurring→B1 | tgHourH→B1
```

全局副作用：`window.addEventListener('pointerdown'/'touchstart',...,true)` L7179/L7182（`_lastPointerType`）；`window.addEventListener('resize',onScroll,{passive:true})` L7260；`beforeprint/afterprint` L7305/L7306；`document.addEventListener('keydown')` L7990；`document.addEventListener('visibilitychange')` L10298；`window.addEventListener('pagehide'/'beforeunload')` L10302/L10303（日历标签计时清理）。

迁移必守项：`VIRTUAL_THRESHOLD`（L7167，`const`）在 B3 的渲染函数内**运行期**读取（L13983 画廊、L14223 思维导图，均包在 `if(__l14On()&&...` 内），因此跨块 TDZ 风险仅在「B3 执行期早于 B2 完成初始化」时出现，M1 拆分需保持 B2 先于 B3 求值；`_outlineHeaderRO`（L8007 `let`）与 `_disconnectOutlineHeaderRO`（L8023 `function`）必须同块（前者被后者闭包捕获）；本块对 B1 的 `buildCalIndex / buildYearCounts / ensureNoteDoc ...` 属**被调用方在后**（B1 引用 B2 声明），依赖运行期调用，不得改为顶层立即求值。

---

### 1.3 B3 · script3（11613–14551）— 数据库（多维表格）+ 思维导图

职责：`数据库`｜`多维表格：排序/筛选`｜`公式引擎（含日期函数）`｜`汇总`｜`添加列`｜`字段类型浮窗`｜`列配置`｜`思维导图`。

**被其它块引用的顶层声明（16 条）**

```
renderDatabasePage→B4 | renderMindmap→B4 | juBorderAnchor→B4 | layoutMindmap→B6
mmLayoutConsts→B6 | dbFieldType→B6 | dbPrimaryField→B2,B6 | formatTimeValue→B5,B6
_dbCellCancel→B2 | _dbCellSchedule→B2 | dbFieldDef→B2 | dbFieldVisible→B2 | dbTextValue→B2
isStarField→B2 | mkStarsHtml→B2 | closePicker→B1
```

全局副作用：IIFE×3；`document.addEventListener('mousedown',onDocDown,true)` L11414、`document.addEventListener('keydown',onDocKey,true)` L11415、`window.addEventListener('resize',onResize)` L11416；`document.addEventListener('mousedown',onDoc)` L12191 / L12514；`document.addEventListener('mousemove'/'mouseup')` L13602/L13603；`touchstart` L13665（`{passive:true}`）；`mousemove/mouseup` L14394/L14395（思维导图拖拽）；`wrap.addEventListener('mousedown', ...)` L14502（元素级，随节点回收）。

迁移必守项：`closePicker` 被 B1 引用（B1 先执行、B3 后定义）⇒ **只能以函数声明 + 运行期调用方式存在**，若 M1 改为 `const closePicker = () => {}` 将因跨块 TDZ 直接抛 `ReferenceError`。

---

### 1.4 B4 · script4（14552–15821）— 图谱（Worker + GraphRenderer）+ 演示视图 + 资料库/Word/主渲染

职责：`图谱（Barnes-Hut Worker + GraphRenderer）`｜`演示视图`｜`资料库 / Word / 主渲染`｜`【L15-W2】文件/输入行多选与全选`。

**被其它块引用的顶层声明（18 条）**

```
GraphLayoutWorker→B1 | openNode→B1,B2,B3,B5 | renderMain→B1,B2,B3,B5,B6 | safeNavigate→B1,B5
renderFolderGrid→B3,B5 | renderGraph→B3 | renderPresentation→B3 | _graphWorker→B6
_mSel→B3,B5 | _mSelClick→B3,B5 | _mSelHas→B3,B5 | _mSelSelectAll→B3,B5 | _mSelSetOrder→B3,B5
_mSelPaint→B5 | _sbVisibleIds→B5 | renderFileCard→B5 | sortDocs→B5 | run→B2
```

全局副作用：`GRAPH_WORKER_SRC` 模板串内联整段 Worker 源码（L14552 起）；`this.worker=new Worker(this.url)` **L14841**（GraphLayoutWorker 构造）；`_yieldChannel = new MessageChannel()` **L14567**；`document.addEventListener('keydown')` L15587；`window.addEventListener('resize',onResize)` L15185。

迁移必守项：`renderMain`（L15654 `function`）被 B1/B2/B3/B5/B6 共 5 块引用，是**最高扇出**节点；`openNode / safeNavigate / download` 在 B1 的 `JU.register('core')`（L7150）中**仅以 getter 暴露**（`get openNode(){return openNode;}`），正是为了避免 B1 执行期对后置块标识符求值——M1 拆分时该 getter 语义必须保留。

---

### 1.5 B5 · script5（15822–18309）— 侧栏 / 右侧栏 / 反链 / 提醒 / 备份 / 视图族

职责：`侧栏`｜`右侧栏`｜`Wiki 链接跳转 + 反链/出链面板`｜`系统提醒通知`｜`一键备份 / 下载全部数据`｜`颜色/字号选择器`｜`批量格式`｜`格式刷`｜`星标/模板/回收站`｜`统计/标签/历史`。

**被其它块引用的顶层声明（42 条）**

```
renderSidebar→B1,B2,B3,B4,B6 | updateRightSidebar→B2,B3,B4,B6 | buildStatsBlock→B2,B4
linkTitleAtPoint→B2,B3,B4 | navigateToWikiLink→B2,B3,B4 | renderIntro→B1,B4
updateSidebarActiveState→B3,B6 | renderBacklinkPanel→B3 | exportFullBackup→B4
renderHistoryView→B4 | renderStarredView→B4 | renderStatsView→B4 | renderTagNodes→B4
renderTagsView→B4 | renderTemplatesView→B4 | renderTrashView→B4 | showTreeContext→B4
updateRemindBadge→B4 | _reminderTimer→B6 | bindReminder→B6 | bindRightSidebar→B6
bindSidebar→B6 | initReminder→B6 | loadRemindSent→B6 | REMIND_SENT_KEY→B6
restoreVersions→B6 | setActiveKey→B6 | uiSnapshot→B6 | currentBaseFontPx→B2,B3,B6
_getCalScopeText→B2 | calendarTagIndex→B2 | getTagColor→B2 | nodeHasTag→B2 | openTag→B2
tagStripText→B2 | buildTagIndex→B1 | backlinksOf→B1,B8 | normTitle→B1 | promptNewTag→B1
renderSubTags→B1 | _tagScanStep→B1 | calStatsScope→B1
```

全局副作用：IIFE×4；`document.addEventListener('mousemove'/'mouseup')` L16171/L16172；`document.addEventListener('selectionchange')` L16586、`document.addEventListener('keydown',onKeyForPainter,true)` L16587；`setTimeout(()=>document.addEventListener('mousedown',onDocClickForPicker),0)` **L17245（延迟绑定）**；`localStorage.setItem` ×1。

迁移必守项：`buildStatsBlock`（**L17912**）由 B2/B4 的渲染早退分支跨块调用；`backlinksOf → B8 [collision]` 为 B8 内同名实现，不构成依赖。

---

### 1.6 B6 · script6（18310–22793）— 错误上报 / 浮窗 / 番茄钟 / 悬浮日历 / 音乐 / 设置 / 导入导出 / JU_DND/MODULES/SLIDES / 版本快照 / boot 与生命周期收口

职责：`全局错误捕获 + 错误上报`｜`浮窗视口校验`｜`番茄钟`｜`悬浮日历`｜`音乐`｜`设置`｜`添加到日历/数据库`｜`IO`｜`导入`｜`顶栏/工具`｜`JU_DND`｜`JU_MODULES`｜`JU_SLIDES`｜`版本快照（IndexedDB）`。

**被其它块引用的顶层声明（31 条）**

```
boot→B1,B2,B4,B5 | download→B1,B5 | JU_DND→B1,B4,B5 | JU_MODULES→B1,B4,B5 | JU_SLIDES→B1,B4
VDB→B1,B4,B5 | migrateStateObject→B1,B4 | migrateWordToOutline→B1,B5 | reportError→B1,B2
saveAutoBackup→B1,B4 | scheduleDesktopSave→B1,B5 | flushDesktopSave→B1
doDownload→B4,B5 | ensureElInViewport→B4,B5 | floatCalVisible→B4 | initJuDnd→B4 | initJuModules→B4
initJuSlides→B4 | JU_VER→B4 | STATE_VER→B4 | loadAutoBackup→B4 | openImportDialog→B4
renderFloatCal→B4 | renderSlidesView→B4 | doPrint→B5 | exportICS→B5 | loadVersionList→B5
openAddToCalendarDialog→B5 | openAddToDbDialog→B5 | showPrintPreview→B5 | loadState→B8 [collision:B8]
```

全局副作用：IIFE×5；`window.addEventListener('error')` L18448、`unhandledrejection` L18454；`BroadcastChannel` L22611（`STORE_BC_INSTANCE`）、L21464（`VDB`）；`indexedDB.open(VDB_NAME,VDB_VERSION)` **L21489**；`window.addEventListener('storage')` L22639、`beforeunload` L22692/L22694、`pagehide` L22772、`pagehide(...,true)` L21398；`localStorage.setItem` ×9。

**boot 尾部全局挂载（L22777–22782，逐字）**

```
JU.state=function(){return state;}   JU.ui=function(){return ui;}   JU.commit=commit
JU.subscribe=subscribe              JU.actions=actions              JU.N=N
```

**生命周期注册表（`M0-7 · 页面卸载统一清理`，L22753–22771，共 10 项）**

| # | 资源 | 注册行 |
| --- | --- | --- |
| 1 | `STORE_BC_INSTANCE.close()` | L22753 |
| 2 | `_l7YieldCh.port1/port2.close()` + `_l7YieldQ.length=0` | L22755 |
| 3 | `_syncAppInertObserver.disconnect()` | L22757 |
| 4 | `window.__juA11yObserver.disconnect()` | L22759 |
| 5 | `_reminderTimer` clearInterval | L22761 |
| 6 | `pomoState.timer` clearInterval | L22763 |
| 7 | `_indexWorkerDispose(true)` | L22765 |
| 8 | `_graphWorker.dispose()` | L22767 |
| 9 | `__juVsLongtaskObserver.disconnect()` | L22769 |
| 10 | `__l14LongtaskGate.observer.disconnect()` | L22771 |

> 另有 3 处 `JU.lifecycle.add` 不在该 10 项清单内：L7336（B1 · vsLongtaskObserver）、L7688（B2 · L14 longtask gate）、L22902（B7 · a11y observer）。合计 **13 处** `lifecycle.add` 调用。

迁移必守项：`boot` 为全站唯一启动入口，被 B1/B2/B4/B5 **前向引用**（B1 文件末尾 `get boot(){return boot;}` 暴露）；生命周期 10 项的资源句柄分属 B1（`_l7YieldCh/_l7YieldQ/_indexWorkerDispose`）、B2（`_reminderTimer` 由 B5 声明）、B4（`_graphWorker`）、B7（`__juA11yObserver`），**卸载顺序与资源归属跨界**，M1 拆分后必须由统一的 registry 持有句柄。

### 1.7 四处 `JU.register` 导出契约（实测，非 6 处）

| 注册名 | 行号 | 所属块 | getter 延迟项（避开 TDZ 的关键） |
| --- | --- | --- | --- |
| `core` | L7150 | B1 末尾 | `get openNode`、`get safeNavigate`、`get download` |
| `outlineCalendar` | L11605 | B2 末尾 | 无（全部直接引用，均为本块或 B1 已定义） |
| `views` | L14538 | B3 末尾 | `get renderGraph/renderPresentation/renderFolderGrid/renderMain/renderSidebar/updateRightSidebar/updateSidebarActiveState/renderBacklinkPanel/navigateToWikiLink/linkTitleAtPoint` |
| `app` | L15802 | B4 末尾 | 17 项全部为 getter（`JU_VER/STATE_VER/VDB/migrateStateObject/.../boot`） |

> B5、B6 末尾**没有** `JU.register` 调用（`grep JU\.register\s*\(` 全文件仅 4 处）。B6 末尾的收口物是「生命周期注册表 + `JU.state/ui/commit/subscribe/actions/N` 全局挂载」。M1 拆分若按「每块一个 register」设计，需先为 B5/B6 补契约，而不是假设其已存在。

---

## 2. 全局副作用总表（按块，实测计数）

| 副作用 | B1 | B2 | B3 | B4 | B5 | B6 | B7 | B8 | B9 | 关键行 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IIFE（行首立即执行） | 11 | 2 | 3 | 0 | 4 | 5 | 1 | 1 | 1 | — |
| `document.addEventListener` | 10 | 15 | 10 | 1 | 7 | 27 | 0 | 0 | 0 | 合计 68 |
| `window.addEventListener` | 2 | 10 | 0 | 1 | 0 | 9 | 0 | 0 | 0 | 合计 22 |
| `document.execCommand =`（猴子补丁） | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | L1961–1963 |
| `new MutationObserver` | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | L6809、L22886 |
| `new Worker` | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 2 | 0 | L4235、L14841、L23894 |
| `new MessageChannel` | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | L4566、L14567 |
| `new BroadcastChannel` | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | L21464、L22611 |
| `localStorage.setItem` | 8 | 0 | 0 | 0 | 1 | 9 | 0 | 0 | 0 | — |
| `indexedDB.open` | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | L21489 |

> M0-7 约束「不新增 localStorage / IndexedDB 键名」：本表为**只读盘点**，本次未新增任何键（A/B/C 批次内新增文件均为工程骨架与文档）。

---

## 3. 迁移必守项

### 3.1 TDZ（`const/let` 跨块不可前向读取）

1. **B1 声明 → B2–B6 使用**：`state / _themeList / TAG_RE / WIKI_RE / APP_LOCALE / _l7YieldCh / _l7YieldQ / IS_DESKTOP / JC_*` 等 161 个名字，必须在任何消费块**执行前**完成初始化。
2. **B2 声明 → B3 运行期使用**：`VIRTUAL_THRESHOLD`（L7167 `const`）在 B3 的 `renderDatabasePage`（L13983）与 `renderMindmap`（L14223）**函数体**内读取，非顶层立即求值；风险点在于 M1 若把 B3 模块初始化期排到 B2 之前并出现任何立即读取，即抛 `ReferenceError: Cannot access 'VIRTUAL_THRESHOLD' before initialization`。
3. **B4 声明 → B1 引用**：`openNode / safeNavigate / renderMain / GraphLayoutWorker` 被 B1 的契约注册以 **getter** 包裹（L7150），因此 B1 执行期不触发 TDZ；**一旦把 getter 改成直接取值，B1 立即崩溃**。
4. **B5 声明 → B2/B4 调用**：`buildStatsBlock`（L17912 `function`，函数声明可前向调用）与 `currentBaseFontPx`（`function`）必须保持函数声明形态；若改 `const` 箭头函数同时被更早块顶层引用，即产生 TDZ。
5. **B6 声明 → B1 引用**：`boot / download / VDB / JU_DND / JU_MODULES / JU_SLIDES / JU_VER / STATE_VER` 同 3，靠 getter 与运行期调用规避。

### 3.2 函数提升依赖（跨块前向调用）

- `B1 → B2`：`buildCalIndex / buildYearCounts / ensureNoteDoc / calMinToHm / calModuleState / dedupCalRoots / dedupNoteRoots / expandRecurring / tgHourH`（B1 内调用，B2 内声明）。
- `B2 → B4`：`buildCalLogBlock / _disconnectOutlineHeaderRO / _calDayNodesForModules / syncEmptyState`（B2 内声明，B4 `renderMain` 早退分支调用）。
- `B2 → B1`、`B1 → B6`、`B5 → B1` 等其余边同理：**全部依赖「函数声明 + 运行期调用」**，不依赖加载期求值。
- 迁移规则：跨块被引用的符号一律保留 `function name(){}` 形态（或在模块内显式「延迟绑定」），禁止改为 `const/let` 顶层字面量赋值。

### 3.3 全局函数可见性

- 6 个块均为 classic `<script>`（无 `type=module`），**顶层 `const/let/function` 全部落在同一全局词法环境**：`const/let` 进全局词法记录（跨块可见但 TDZ 生效），`function` 进全局对象（提升可见）。
- 转 ESM 后每个模块拥有独立词法环境：跨块引用必须走显式 `import` / `JU.require` 契约，**不能再靠隐式全局**。M0-7 的 `src/contract/*.ts` 正是该替换点的最小实现。
- `window.__ju*` 调试别名（B6 L22779 注释「旧 window.__ju* 别名保留至 M1 迁移完成后移除」）与 `window.JU.debug.*`（L22780–22782）必须与 `src/types/ju.d.ts` 声明的字段集保持一致。

---

## 4. 强制标注的 TDZ / 顺序敏感点（C2 · 实测校正）

| # | 约定描述 | 实测结论 | 定义位置 | 引用块 | 迁移必守 |
| --- | --- | --- | --- | --- | --- |
| 1 | APP_LOCALE（script5 定义，script3 通过 getter 惰性取值） | **校正**：定义在 **B1（script1）常量区**，非 script5；引用方为 B4、B6（词法边），无「getter 惰性取值」结构 | B1 **L5600** `const APP_LOCALE=(typeof navigator!=='undefined'&&navigator.language)\|\|'zh-CN';` | B4、B6 | 必须留在首块常量区；B6 L18312–18313 注释明确「M0-7：APP_LOCALE 已提升至首脚本常量区（与 TAG_RE / WIKI_RE 同处），此处不再重复声明」 |
| 2 | WIKI_RE / TAG_RE（已上提 script1 常量区） | **成立** | `TAG_RE` **L5597**、`WIKI_RE` **L5599**（B1） | B5、B6 | 同一常量区顺序：TAG_RE → WIKI_RE → APP_LOCALE；`/g` 正则带 `lastIndex` 状态，跨块共享同实例，禁止在拆分时复制成两份实例 |
| 3 | getGraphWorker / _graphWorker（script3 定义，script4 使用） | **校正**：两者均在 **B4（script4）**；`_graphWorker` 被 B6 引用，`getGraphWorker` **无跨块引用**（仅 B4 内部使用） | `let _graphWorker=null;` **L14941**、`function getGraphWorker(){` **L14942** | `_graphWorker → B6` | 二者必须同块（`getGraphWorker` 赋值 `_graphWorker`）；B6 L22767 生命周期第 8 项调用 `_graphWorker.dispose()` |
| 4 | buildStatsBlock（script4 定义，script2 渲染早退分支调用） | **校正**：定义在 **B5（script5）**，非 script4；被 B2 与 B4 引用 | `function buildStatsBlock(){` **L17912**（B5） | B2、B4 | 保持函数声明；B2 早退分支调用点不得改为顶层求值 |
| 5 | buildCalLogBlock（script2 顶部定义，script4 renderMain 早退分支调用） | **成立** | `function buildCalLogBlock(){` **L9923**（B2） | B4（3 处） | 与 `renderCalendarPage / calModuleCharsBody` 同块；`renderMain` 早退分支依赖其可调用性 |
| 6 | _l7YieldCh / _l7YieldQ（script1 定义，生命周期第 2 项释放） | **成立**（同一 `let` 多声明） | `let _l7YieldCh=null,_l7YieldQ=[];` **L4560**（B1） | B6（`_l7YieldCh`） | 两者必须同模块同声明；B6 **L22755** 生命周期第 2 项 `port1/port2.close()` + `_l7YieldQ.length=0` |
| 7 | _outlineHeaderRO / _disconnectOutlineHeaderRO（script2 定义，script4 renderMain 调用） | **部分校正**：定义均在 B2 成立；被 B4 引用的是 `_disconnectOutlineHeaderRO`，`_outlineHeaderRO` **无跨块引用**（仅 B2 内部 + `_observeOutlineHeader` 闭包） | `let _outlineHeaderRO=null;` **L8007**、`function _disconnectOutlineHeaderRO(){` **L8023**（B2） | `_disconnectOutlineHeaderRO → B4` | 二者必须同块；`_outlineHeaderRO` 仅在 B2 内被 `_observeOutlineHeader / _syncOutlineHeaderH` 访问 |

> 校正项均以「实测行号 + 引用边」为准，不做口头让步：约定中的 script 序号与文件实际块序不一致的 4 处（#1、#3、#4、#7 部分）已在此显式标注。

---

## 5. 附录 · B7–B9（后置补丁与影子层）

| 块 | 行区间 | 职责 | 副作用 | 依赖 |
| --- | --- | --- | --- | --- |
| B7 | 22794–22904 | `FIX-a11y-4（v2）键盘可达性补强`：roving tabindex（`.cal-grid` / `.sb-subtree`）、MutationObserver + rAF 批量装饰 | IIFE×1、`window.__juA11yObserver=new MutationObserver(...)` **L22886**、`JU.lifecycle.add(...)` **L22902** | 依赖 B2（`.cal-grid`/`.sb-subtree` DOM）、B1（`JU.lifecycle`） |
| B8 | 22905–24233 | `L9-W6 · C-2 inline bundle`：attach-shadow + 六支柱（crypto-store / persist-store / index-layer / worker-protocol / backend-adapters / persist-worker）单 IIFE 内联，classic script（无 src / 无 module） | IIFE×1、`new Worker(url)` **L23894**、`new Worker` 另一处 L23707 为注释 | 对外仅暴露 `window.JU.initL9Shadow` 与 `window.JU.L9`；**与 B1 同名符号为碰撞，不共享绑定** |
| B9 | 24234–24323 | `L10-W2 · D-1 持久层接缝`：默认启用（`__juL10D1Seam` 缺省即启用），安装不可枚举 `globalThis.__juL10D1`，经 `__juL9Shadow.modules` 接线 | IIFE×1、`Object.defineProperty(globalThis, KEY, {enumerable:false})` | 依赖 B8 的 `attachShadow / PersistStore / IdbStyleAdapter / saveState`（真实跨块依赖，非碰撞） |

---

## 6. 文档产出期的零漂移证明

```bat
:: 只读副本 vs canonical（构建期闸门）
cd 6.P0-T3基线\m07-vite && node scripts/check-parity.mjs
:: PARITY OK  sha256=5fed021578e775b560bf98af719046eb2916472f4053354a33a1a436dfbff818  bytes=1316707
```

- 产品件字节数：**1,316,707 B**，SHA-256：`5fed021578e775b560bf98af719046eb2916472f4053354a33a1a436dfbff818`（M0-7 开始前基线与文档产出后复算一致）。
- 本批次**只读**产品件；所有派生数据存放在 `_临时脚本/`，工程骨架在 `6.P0-T3基线/m07-vite/`。
