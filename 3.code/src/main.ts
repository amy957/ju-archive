/**
 * P0 · 样式入口（唯一 CSS 入口，见 vite.config.ts 的 cssCodeSplit=false + viteSingleFile()）
 *
 * 缺陷根因：M1-1 模块化迁移时产品件的 112KB `<style>` 块未随之迁移，`src/` 下不存在任何 .css，
 * `index.html` 也无 `<style>`，因此 `vite build` 产物 `dist/index.html` 不含任何产品样式，
 * 启动后只剩无样式文本（表现为「空白 / 仅有『请先选择文档』」）。
 * 本文件承载 canonical 样式（来源：public/v2.0-t3.html 首个 `<style>` 块，逐字提取，零改写）。
 */
import './style.css';
import { registry } from './contract/registry';
import { lifecycle } from './contract/lifecycle';
import { TAG_RE, WIKI_RE, APP_LOCALE } from './core/constants';
import * as utils from './core/utils';
import * as charstats from './core/charstats';
import { purgeLocalCopy } from './core/local-copies';
import { copyPlain, __juProduce, __juProduceSafe } from './core/produce';
import { initStore, getState, subscribe, scheduleNotify, schedulePersist, bindPersistStore,
  bindCalIndexPort,
  docWordCount, requestDocWordCountAsync, clearDocWordCountCache, getWordCountDiagnostics,
  disposeWordCountWorker, WORDCOUNT_WORKER_THRESHOLD } from './core/store';
import {
  commit as persistCommit,
  persistNow,
  persistNowAwait,
  flushPersistNow,
  schedulePersist as persistSchedulePersist,
  bindPersistDeps,
  defaultState,
  loadState,
  N as nodeById,
  findOwningTopDocId,
  isBlankNode,
  purgeNodeMeta,
  docSubtree,
  tombstoneSet,
  recentlyRemovedDelete as persistRecentlyRemovedDelete,
  mergeRemoteIfNewer,
  onRemoteStoreChange,
  recoverPendingEncrypted,
  initPersist,
  STORE_KEY,
  /* 【review7-01 · ISSUE-001】加密兜底键与会话兜底写入口（与 boot 同一常量，禁止本地字面量） */
  PENDING_SYNC_KEY,
  getLastEncPayload,
  /* Track B · M0-15 · 云端同步（Pro 阈值拦截 + Mock 闭环） */
  syncToCloud,
  syncFromCloud,
  isCloudSyncAllowed,
  /* ISSUE-012 · 端点未配置时隐藏同步入口 */
  isCloudSyncEnabled,
  SYNC_ENABLED,
  SYNC_PUSH_URL,
  SYNC_PULL_URL,
  SYNC_PRO_GATE_MESSAGE,
  /* M07 · 撤销 / 重做历史栈（结构共享根引用，见 core/persist.ts 历史栈段） */
  undo,
  redo,
  canUndo,
  canRedo,
} from './core/persist';
/**
 * M07 · 本地音频播放（Goldberg Variations）
 * 音源解析：window/localStorage 覆盖 → 约定本地绝对路径（Tauri convertFileSrc）→ 内置音源。
 */
import {
  MUSIC_TRACKS,
  playTrack as audioPlayTrack,
  stopMusic as audioStopTrack,
  setMusicVolume as audioSetVolume,
  bindAudioListener,
  currentTrackId as audioCurrentTrackId,
} from './core/audio';
/**
 * M1-2 · 批次 AR · 加密适配层（真实 AES-GCM + PBKDF2 实现，替换 boot 侧的加密占位端口）
 * 算法内核、盐复用、iter 兼容解密见 core/crypto.ts（源自产品件 1384-1470 / 21752-21821）。
 */
import {
  bindCryptoDeps,
  hasEncryptedStore,
  readEncryptedStore,
  encryptState,
  decryptState,
  promptUnlock,
} from './core/crypto';
/* 【D-01】IDB 持久化镜像（写入在 core/persist 的明文分支；此处只暴露只读观测端口） */
import { getIdbMirrorStatus, idbListDatabases, idbReadState, isIdbSupported } from './core/idb';
import {
  SAFE_TAGS,
  SAFE_ATTRS,
  CSS_WHITELIST,
  /* 【D-02】颜色归一（color(srgb …) → #RRGGBB / rgba()）：写入 style 前的唯一闸口 */
  COLOR_STYLE_PROPS,
  normalizeColorValue,
  normalizeInlineDeclValue,
  sanitizeHtml,
  sanitizeStyle,
  safeExec,
  parsePasteLines,
  trimPasteHtml,
  injectRichtextDeps,
  applyCustomStyleToSelection,
  toggleCustomStyleToSelection,
  /* 【富文本三项合并】颜色 / 背景 / 字号写入引擎 + typing style + 结构归一 */
  applyInlineStyle as applyInlineStyleEngine,
  clearInlineStyleFromSelection,
  getTypingInlineStyle,
  initRichtextStyleMode,
  normalizeInlineStyles,
  /* 【P0 · 选区锚点】宿主选择器 + 纯文本偏移：正文重渲染后仍可恢复同一段选区 */
  captureSelectionAnchor,
  rangeFromSelectionAnchor,
  logInlineStyleEntry,
  /* 【P0 · 实机选区丢失】编辑器格式写入期间的重绘拦截标记（renderMain 据此跳过 blur 触发的重建） */
  isEditorFormatting,
  beginEditorFormatting,
  endEditorFormatting,
} from './core/richtext';
import {
  toast,
  appConfirm,
  appPrompt,
  showContextMenu,
  initDragClose,
  _modalStack,
  _syncAppInert,
  _syncAppInertObserver,
} from './ui/common';
import {
  applyTheme,
  applySystemTheme,
  toggleTheme,
  openThemeSelector,
  bindThemeDeps,
} from './ui/theme';
import { bindTopbar, bindMainToggles, bindLayoutDeps, bindCrashLogRow, bindLicenseActivation, bindSearchWorker, bindSettingsPanel, bindPublishTools, openSettingsPanel, closeSettingsPanel, isSettingsPanelOpen } from './ui/layout';
/* 设置 · 区块四「帮助 → 查看手册」：帮助手册弹窗（内容内联自 docs/RELEASE/USER-MANUAL用户手册.md） */
import { bindManualModal } from './ui/manual';
import {
  ui as sharedUi,
  deps as selectionDeps,
  bindSelectionDeps,
  _mSel,
  _mSelSetOrder,
  _mSelHas,
  _sbVisibleIds,
  _mSelClear,
  _mSelSelectAll,
  _mSelClick,
  _mSelPaint,
  _mSelSelectAllCurrent,
} from './ui/selection';
import {
  bindSidebarDeps,
  renderSidebar,
  renderSubDb,
  renderSubStarred,
  renderSubDocs,
  renderSubTags,
  makeSidebarRow,
  navTo,
  promptNewTag,
  renameTag,
  removeTag,
  replaceTagInHtmlTag,
} from './ui/sidebar';
import {
  bindRightbarDeps,
  bindRightSidebar,
  updateRightSidebar,
  renderBacklinkPanel,
  outgoingLinksOf,
  backlinksOf,
  normTitle,
  findNodeByTitle,
  navigateToWikiLink,
  caretTextInfo,
  linkTitleAtPoint,
} from './ui/rightbar';
import {
  bindFocusDeps,
  saveFocus,
  restoreFocus,
  focusNode,
  focusAfterRender,
  focusTextAfterRender,
  syncEmptyState,
  isBlurSuppressed,
  getTextOffset,
  nodePath,
  rangeFromPath,
  rangeFromTextOffset,
  editorRole,
  editorSelector,
  isEditable,
  cleanupEmptyInline,
  unwrapStylelessSpans,
  collectRangeIntersectElements,
} from './ui/focus';
import {
  injectDeps as injectOutlineDeps,
  _outlineSel,
  renderOutlinePage,
  renderDocHeaderInline,
  renderOutlineRow,
  bindOutlineText,
  outlineVisibleSeq,
  toggleOutlineSel,
  outlineSelectRange,
  outlineBatchMove,
  outlineBatchIndent,
  outlineBatchOutdent,
  outlineBatchDelete,
  previousVisible,
  nextVisible,
  indentNode,
  outdentNode,
  moveSibling,
  /* M07 · 多行（多选）复制 / 剪切（右栏 [data-cmd] 按钮与键盘路径共用） */
  outlineCopySelected,
  outlineCutSelected,
  outlinePasteFromText,
} from './views/outline';
import {
  bindTimepickerDeps,
  mkCalSel,
  openCalTimeModal,
  fmtHm,
  snapHalfMins,
  calMinToHm,
  clampM,
  fmtCalTime,
} from './ui/timepicker';
import {
  LUNAR_INFO,
  LUNAR_MIN,
  LUNAR_MAX,
  leapMonth,
  leapDays,
  monthDays,
  lYearDays,
  solarToLunar,
  lunarToSolarDate,
  lunarDayStr,
  lunarMonthStr,
  ganzhiYear,
  SOLAR_FEST,
  LUNAR_FEST,
  HOLIDAY_REST,
  isRestDay,
  dayLabel,
  parseNaturalDate,
} from './utils/lunar';
import {
  injectCalendarDeps,
  CAL_MODULE_KEYS,
  ensureCalendarRoot,
  getCalendarRootId,
  dedupCalRoots,
  expandRecurring,
  buildCalIndex,
  buildRecurList,
  calendarTodosOnDate,
  buildYearCounts,
  invalidateCalIndex,
  invalidateCalIndexOnly,
  l7CalIndexWhenReady,
  getCalIndexCache,
  setCalIndexCache,
  getCalDataRev,
  getCalIndexFallbackAttempted,
  tgHourH,
  tgTotalH,
  cnNow,
  tgTimeY,
  tgNowY,
  tgDayNodes,
  buildTimeGrid,
  startCalTgTimer,
  clearCalTgTimer,
  getCalTgState,
  bindCalEventDrag,
  calModuleState,
  calModuleTitle,
  calModuleDayNodes,
  calModuleNoteBody,
  calModuleTodayBody,
  calModuleLogBody,
  calModuleStatsBody,
  /* P0-T3 缺陷修复：系统日志 / 任务统计的真实实现（canonical :9923 / :17912）。
     此前这两个端口被注入成 calModuleLogBody / calModuleStatsBody 的别名，
     而后者内部又回调 deps.buildCalLogBlock() / deps.buildStatsBlock() ⇒ 无限递归。 */
  buildCalLogBlock,
  buildStatsBlock,
  calModuleCharsDates,
  calModuleCharsBody,
  calModuleBindDrag,
  calModuleBindResize,
  renderCalModules,
  renderCalendarPage,
  openCalNodeMenu,
  closeCalNodeMenu,
  renderCalNode,
} from './views/calendar';
import {
  injectFormulaDeps,
  dbFieldName,
  dbFieldType,
  dbFieldDef,
  dbFieldVisible,
  dbResolveField,
  dbPrimaryField,
  dbRawValue,
  dbTextValue,
  dbNumValue,
  dbDateStr,
  dbFormulaEval,
  dbFormulaDisplay,
  dbFormulaToNum,
  dbFormulaToStr,
  dbFormulaTruthy,
  dbFormulaAgg,
  dbFormulaCall,
  _dbFormulaDiff,
  _FormulaParser,
  DB_AGG_FNS,
  formatTimeValue,
} from './views/database/formula';
import {
  injectPanelDeps,
  DB_SF_OPS,
  dbSfAutoClose,
  dbSfCloseAll,
  openDbFilterPanel,
  openDbSortPanel,
  openDbSummaryPanel,
  openDbHiddenFieldsPanel,
  dbTableList,
  dbFieldSummable,
  dbSummaryMode,
  dbSummaryOf,
  dbFmtSummary,
  getOptColors,
  ntAutoClose,
  openFieldTypeMenu,
  openFieldConfigPop,
  openDbFieldConfigDialog,
  dbLinkTitle,
  openLinkPicker,
  openMultiSelectPicker,
  attachPanScroll,
  closePicker,
  bindPickerAutoClose,
  openTimePicker,
  openRegionPicker,
  showDbRowContext,
  _panCleanups,
} from './views/database/panels';
import {
  injectDatabaseDeps,
  DB_VIEWS,
  _dbCellSchedule,
  _dbCellCancel,
  dbFilterRuleActive,
  dbRowMatches,
  dbFilterItemActive,
  dbRowMatchesItem,
  dbCompareRows,
  dbRowsApply,
  renderDatabasePage,
  renderDbTable,
  renderDbGallery,
  mkStarsHtml,
  isStarField,
  dbBoardCardHtml,
  dbInferSelectField,
  dbBoardGroupDef,
  renderDbBoard,
  renderDbTimelineList,
  dbUserSortActive,
  renderDbTimeline,
  renderDbChart,
  getDbRows,
} from './views/database/render';
import {
  injectMindmapDeps,
  MM_NW,
  MM_NH,
  MM_GX,
  MM_GY,
  mmLayoutConsts,
  mmNodeText,
  mmNodeHeight,
  layoutMindmap,
  juBorderAnchor,
  renderMindmap,
  downloadMindmapSvg,
} from './views/mindmap';
import {
  injectGraphDeps,
  GRAPH_WORKER_SRC,
  getGraphWorker,
  GraphLayoutWorker,
  GraphRenderer,
  renderGraph,
  runSyncGraphLayout,
} from './views/graph';
import {
  injectJuSlidesDeps,
  JU_SLIDES,
  renderSlidesView,
  initJuSlides,
} from './views/slides';
import {
  injectPresentationDeps,
  treeRowVisible,
  renderPresentation,
} from './views/presentation';
import {
  injectListsDeps,
  renderTitleWithBack,
  _trashBatchRestore,
  _trashBatchPurge,
  renderStarredView,
  renderTemplatesView,
  renderTrashView,
  renderTagsView,
  renderTagNodes,
  renderHistoryView,
  renderViewTitle,
} from './views/lists';
import { _nowSeq, addNodeTo, actions, injectActionsDeps, extractTags, getLogTimers, flushPendingLogs } from './core/actions';
import { bindPrintDeps, showPrintPreview, doPrint } from './ui/print';
import { verifyLicense, restoreLicense, LICENSE_STORAGE_KEY } from './core/license';
import {
  injectExportDeps,
  download,
  toMarkdown,
  toMarkdownAsync,
  toOpml,
  toHtml,
  docToXls,
  docToExcel,
  outlineToIcs,
  outlineToIcsAsync,
  doDownload,
  exportICS,
  exportFullBackup,
  exportMarkdown,
  isLargeLibrary,
  nodeCount,
  l7Yield,
  BIG_LIB_NODE_THRESHOLD,
  NODE_CHUNK,
  /* 导出目标统一解析（doDownload 使用） */
  resolveExportDoc,
} from './io/export';
import {
  injectImportDeps,
  readFile,
  readFileArrayBuffer,
  readFileDataURL,
  importOutline,
  importOpml,
  importHtml,
  importICS,
  importDocx,
  stripDangerKeys,
  validateImportedTree,
  handleImportFiles,
  openImportDialog,
} from './io/import';
/**
 * M1-1 · 批次 AH · 富文本编辑器（颜色 / 字号选择器 · 格式刷 · 批量格式化）
 * M1-1 · 批次 AI · 主渲染器 renderMain
 * M1-1 · 批次 AJ · 启动引导 boot / 全局事件
 */
import {
  injectEditorDeps,
  bindPainterListeners,
  openColorPicker,
  closeColorPicker,
  openSizePicker,
  closeSizePicker,
  applyFontSize,
  applyInlineStyle,
  selectionStyleValue,
  formatActiveState,
  normalizeCssStyle,
  clearFontSizeFromSelection,
  clearBgFromSelection,
  clearColorFromSelection,
  fontSizePxFor,
  currentBaseFontPx,
  FONT_SIZE_RATIOS,
  _fmtPainter,
  selectionKey,
  captureFormat,
  applyCapturedFormat,
  deactivatePainter,
  toggleFormatPainter,
  toggleBatchPainter,
  onSelectionChangeForPainter,
  onKeyForPainter,
  batchFormatHtml,
  normalizeFormatHtml,
  captureFormatFromHtml,
  applyFormatToHtml,
} from './ui/editors';
/**
 * M3 · 批次 AW · 全局错误采集（本地环形日志）
 * 真实实现见 core/errors.ts（canonical 18318-18447 的模块化承接；匿名上报通道已移除）。
 */
import {
  bindErrorDeps,
  reportError,
  errMsg as errorText,
  flushPendingErrors,
  downloadErrorLog,
  getErrorLog,
} from './core/errors';
/**
 * 虚拟滚动自动策略（2026-10-26）：默认开启；节点数 < 1000 且 deviceMemory >= 8 时自动全量；
 * 卡顿连续超 50ms 强制开启；Ctrl+F / 复制全文 / 打印期间临时全量并在结束后恢复。
 */
import {
  bindVirtualScrollDeps,
  countDocumentNodes as vsCountDocumentNodes,
  shouldUseVirtual as vsShouldUseVirtual,
  getVsActive as vsGetActive,
  setVsActive as vsSetActive,
  vsScrollToId as vsScrollToNode,
  attachJankMonitor,
  markVirtualRender,
  getVsMetrics,
  noteFrameDelta,
  beginInterception,
  endInterception,
  isVirtualActive,
  resetVirtualScrollState,
  forceJankOn,
  /* 【D-04】只读策略快照：虚拟滚动用户开关下线后的验收控制面 */
  getVirtualScrollPolicy,
  VIRTUAL_THRESHOLD as VS_VIRTUAL_THRESHOLD,
  VS_NODE_THRESHOLD,
  VS_MEMORY_THRESHOLD,
  VS_JANK_FRAME_MS,
  VS_JANK_STREAK,
} from './core/virtual-scroll';
import { renderMain, bindRenderMainDeps, _computeViewKey } from './app/render';
/**
 * P1/P2/P3 · 会话编排层（真实实现回填）
 *
 * 产品件中与「唯一 script 作用域」同生的会话级函数（viewOf / getCurrentDoc / forceRender /
 * saveUI / loadUI / openNode / sortDocs / renderFolderGrid / 侧栏标签集群 / bindSidebar /
 * bindTools / syncTopbar / tickClock …）在 M1-1 迁移时未被拆分，历史上以 `noop` 占位注入，
 * 导致 renderMain 的 view 恒为 null（`#content` 只剩「请先选择文档」）且侧栏全空。
 * 现由 src/app/session.ts 按 canonical 语义提供真实实现，本文件仅负责装配。
 */
import * as session from './app/session';
import {
  injectBootDeps,
  boot,
  start,
  bindReminder,
  /* 第九轮 fix9：设置面板「数据 / 常规」四行补绑（autoBackup / backupDirReset / restore / fontSize） */
  bindSettingsRows,
  initReminder,
  initPomo,
  initFloatCalDrag,
  initSettingsDrag,
  bindGlobalEvents,
  bindCrashLogExport,
  /* 番茄钟状态机（本轮按 canonical 18494-18579 回填） */
  togglePomo,
  resetPomo,
  updatePomoDisplay,
  getPomoState,
  renderMusicList,
} from './app/boot';

/**
 * M1-1 · 全局挂载（与产品件 v2.0-t3.html:5601 的 `window.JU.constants.*` 赋值行为对齐）
 */
window.JU = window.JU || {};

/**
 * M1-1d · 全局 `JU` 命名空间的唯一写入出口。
 *
 * 装配约定：任何模块（含 `app/boot.ts`）都不再直接执行 `window.JU.xxx = ...`；
 * 需要对外暴露的属性一律经本函数由本文件的 JU 装配点统一落位，保证「全局属性赋值只在一处」。
 * 采用 `Object.assign` 而非新建对象，确保 `injectBootDeps({ JU })` 等已捕获的引用保持同一性。
 */
export function publishJU(patch: Record<string, any>): void {
  window.JU = window.JU || {};
  Object.assign(window.JU, patch);
}

/**
 * 把「正在编辑、尚未提交」的正文写回 state（撤销前的保鲜动作）。
 *
 * 为什么撤销前必须先冲刷：正文的落库时机是 blur / Enter，加粗这类 execCommand 只改 DOM。
 * 若直接撤销，历史栈栈顶仍是「加粗之前」的那次提交，撤销就会把刚输入的文字一并吃掉。
 * 先冲刷一次（走 actions.updateText 的 snapshot 提交）后，历史栈顶变成「加粗后的正文」，
 * 撤销落点即「同一段文字、没有加粗」——这才是用户点撤销按钮时预期的一步。
 */
function flushEditorById(id: string, noNotify: boolean): void {
  const el = document.querySelector('#content .text[data-id="' + id + '"]') as HTMLElement | null;
  if (!el) return;
  const cur = nodeById(id);
  if (!cur) return;
  const html = sanitizeHtml(el.innerHTML || '');
  /* noNotify=true：静默提交（state / 撤销栈 / 落盘照常，但不广播 notify、不调度渲染）。
     富文本格式命令专用 —— execCommand 已把 DOM 改好，此刻若触发 notify，
     boot 的 subscribe → scheduleRender → renderMain 会重建 #content，编辑区节点被替换，
     选区/光标丢失，连续格式操作第二下失效（本次修复「前一步效果失效」的关键一环）。 */
  if (html !== (cur.text || '')) actions.updateText(id, html, { noNotify });
}

function flushActiveEditor(opts?: { noNotify?: boolean }): void {
  try {
    const ae: any = document.activeElement;
    if (!ae || !ae.closest) return;
    const el = ae.closest('#content .text[data-id]') as HTMLElement | null;
    if (!el) return;
    const id = el.getAttribute('data-id');
    if (!id) return;
    flushEditorById(id, opts?.noNotify === true);
  } catch (e) {
    console.warn('[JU] flush active editor failed', e);
  }
}

/**
 * 把「选区覆盖到的全部大纲行」刷回 state。
 *
 * 【跨行选区】实机选区经常横跨两个大纲行（两个独立 contenteditable）：
 * 只冲刷 `document.activeElement` 那一行，另一行刚写入的颜色 / 背景 / 字号
 * 不会进 state —— 下一次重渲染（blur / notify）就把它整段盖掉，
 * 表现为「三项样式只生效了一行 / 再点一下就没了」。
 */
function flushSelectionEditors(noNotify: boolean): void {
  try {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0) return;
    const r = s.getRangeAt(0);
    const ids: string[] = [];
    const rows: any[] = Array.from((document.querySelectorAll('#content .text[data-id]') as unknown) as any[]);
    rows.forEach((el: any) => {
      let hit = false;
      try { hit = r.intersectsNode(el); } catch (e) { hit = false; }
      if (!hit) return;
      const id = el.getAttribute('data-id');
      if (id && ids.indexOf(id) < 0) ids.push(id);
    });
    ids.forEach((id: string) => flushEditorById(id, noNotify));
  } catch (e) {
    console.warn('[JU] flush selection editors failed', e);
  }
}

/**
 * 富文本格式命令后的静默同步（注入右栏 `deps.syncEditor`）。
 * 只把编辑区 DOM 结果写回 state，不触发任何渲染；UI 由 blur / input 自然收敛。
 */
function syncActiveEditor(): void {
  flushActiveEditor({ noNotify: true });
  flushSelectionEditors(true);
}

/** 撤销入口（UI / 快捷键统一走这里：先冲刷未提交正文，再回退一步历史） */
function undoWithFlush(): boolean {
  flushActiveEditor();
  return undo();
}

/**
 * M1-2 · 批次 AQ · 持久化落盘端口装配（替换 M1-3 的占位转发）
 *
 * core/store 的 `schedulePersist()` 是「落盘调度信号」的唯一入口；此处把它显式接到
 * core/persist 的**真实实现**（`schedulePersist → runPersist`），使
 * `scheduleNotify() → schedulePersist() → localStorage 落盘 + _broadcastRev 广播` 成为完整链路。
 * 说明：core/persist 装载时已自挂载同一实现；本处显式绑定用于装配期可读性与覆盖（幂等）。
 */
const persistStoreBridge = {
  schedulePersist: (): void => { persistSchedulePersist(); },
};
bindPersistStore(persistStoreBridge);

/**
 * M1-1 · 批次 K/L/N/O · 未拆分业务符号的占位注入（依赖注入容器）
 *
 * `ui/layout.ts` / `ui/theme.ts` / `ui/sidebar.ts` / `ui/rightbar.ts` 内部不再直接引用尚未拆分
 * 的同作用域业务实现，一律经各自的 `deps` 容器调用；此处注入占位实现，确保模块被加载/调用时
 * 不抛 ReferenceError（原产品件中这些符号由单一 script 作用域提供）。
 * `ui` 为共享占位对象：layout / theme / sidebar / rightbar / selection 写同一份
 * （对应产品的全局 `ui` 单例口径，来自 ./ui/selection 的导出引用）。
 * 真实实现在对应批次迁移时以 bind*Deps 覆盖回填。
 */
const uiPlaceholder: any = sharedUi;
const noop = (): void => {};
/* 【review7-01 · ISSUE-001】P0-3 关页/切后台会话兜底：仅加密态把最近一次密文写入 persist 同一 key
   （明文态不写；recoverPendingEncrypted 取后即删与 ttl 语义不变）。 */
function flushPendingSession(): void {
  if (!(uiPlaceholder.encrypted && uiPlaceholder.encKey)) return;
  const payload = getLastEncPayload();
  if (!payload) return;
  try { sessionStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ payload, ts: Date.now(), ttl: 60000 })); } catch (e) { console.warn('[JU] caught error', e); }
}
/* M1-3 · actions.removeNode 会清理 `ui.collapsedDocs[已删节点]`，共享 ui 占位必须自带该表，
   否则删除路径在 draft 内抛 TypeError 触发 commit 回滚（节点删不掉）。 */
if (!uiPlaceholder.collapsedDocs || typeof uiPlaceholder.collapsedDocs !== 'object') uiPlaceholder.collapsedDocs = {};
/* Track B · 免费版默认态：未激活 Pro 前 ui.isPro 恒为 false（启动后由 core/license 复核 localStorage 授权码）。 */
if (typeof uiPlaceholder.isPro !== 'boolean') uiPlaceholder.isPro = false;

/**
 * M3 · 批次 AW · 错误采集依赖装配（M3-2a）
 *
 * 产品件 `reportError` 与 `ui` / `state` / `IS_DESKTOP` / `desktopInvoke` 同处一个 script 作用域；
 * 拆分后由本处一次性注入：`ui` 与共享占位同源（开关切换立即被 reportError 读到），
 * `state` 用 getter 端口保证 initStore 整体替换后仍读到最新引用。
 * 桌面通道经 `_tauri()` 真实桥接：Tauri 壳内 isDesktop 为 true，浏览器内恒为 false。
 */
/* fix32-1 · 桌面桥接端口：全局 API 由 tauri.conf.json 的 withGlobalTauri 注入（v1: tauri.invoke，v2: core.invoke） */
const _tauri = (): any => (window as any).__TAURI__ || null;
const desktopInvoke = (cmd: string, args?: any): Promise<any> => {
  const t = _tauri();
  if (t && t.core && typeof t.core.invoke === 'function') return t.core.invoke(cmd, args || {});
  if (t && t.tauri && typeof t.tauri.invoke === 'function') return t.tauri.invoke(cmd, args || {});
  return Promise.resolve(null);
};
/** fix34-3 · ISSUE-003：能力级桌面探测——命名空间存在但 core.invoke / tauri.invoke 缺失时不算桌面通道 */
const hasDesktopInvoke = (): boolean => utils.hasTauriInvoke();
/**
 * fix33-1 · ISSUE-001：main.rs 的 `load_state` 返回裸 state JSON 文本（无 hasData/state 外壳），
 * 而 boot / persist 按 `{encStore}` 或 `{hasData,state}` 读取。此处统一归一：
 * JSON.parse 失败返回 null；含 encStore 原样返回；含 nodes 返回 `{hasData:true,state:v}`。
 */
const normalizeDesktopSnapshot = (raw: any): any => {
  let v: any = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch (e) { return null; }
  }
  if (!v || typeof v !== 'object') return null;
  if (v.encStore) return v;
  if (v.nodes && typeof v.nodes === 'object') return { hasData: true, state: v };
  return v;
};
/** 全量落盘：payload 为当前 state 的 JSON 文本（main.rs `save_state(payload: String)`）；成功返回 true */
async function desktopSave(): Promise<boolean> {
  /* fix33-3 · ISSUE-003：`__TAURI__` 存在不等于 invoke 可用（可能仅注入 window 命名空间），
     无 core.invoke / tauri.invoke 时直接失败，不得以 Promise.resolve(null) 伪装成功。 */
  const t = _tauri();
  const hasInvoke = !!t && ((t.core && typeof t.core.invoke === 'function') || (t.tauri && typeof t.tauri.invoke === 'function'));
  if (!hasInvoke) return false;
  try { await desktopInvoke('save_state', { payload: JSON.stringify(getState()) }); return true; }
  catch (e) {
    /* 【F-2】此前一律 return false，前端只看到「保存失败」无法定位；把后端错误暴露到 console + 全局变量 */
    const msg = String((e && (e as any).message) || e || '未知错误');
    try { console.error('[JU] save_state 失败:', msg); } catch (_) { /* console 不可用 */ }
    try { (window as any).__juLastSaveError = msg; } catch (_) { /* window 不可用 */ }
    return false;
  }
}
/** boot 运行期桌面态（detectDesktop 探测；装载异常时 boot 回置 false） */
let _desktopRuntime = false;
bindErrorDeps({
  ui: uiPlaceholder,
  getState,
  isDesktop: hasDesktopInvoke,
  desktopInvoke,
  /* ISSUE-013 · 版本号同源：唯一真相源为 package.json 的 version，
     本处字面量由 scripts/check-parity.mjs 断言必须相等（漂移即 exit 1）。 */
  JU_VER: '2.1.0',
});
/* 提前建立 `window.__juLog` 环形缓冲（契约视图，ju.d.ts 已声明），避免首次异常前为 undefined */
getErrorLog();

/**
 * M1-2 · 批次 AQ/AR · 持久化 / 加密适配层依赖装配
 *
 * 产品件里 `ui` / `getCalendarRootId` / `dedupCalRoots` / `toast` / `appConfirm` / `_modalStack`
 * 等符号与算法同处一个 script 作用域；拆分后由本处一次性注入（未注入项保持模块内安全 noop）。
 * 前提：`uiPlaceholder` 已初始化（故本段位于其声明之后）。
 */
bindPersistDeps({
  ui: uiPlaceholder,
  getCalendarRootId,
  toast,
  dedupCalRoots,
  /* 桌面壳端口：仅 invoke 可调用时走 SQLite 落盘（ju_store.json），否则回落 localStorage 分支 */
  isDesktop: hasDesktopInvoke,
  desktopSave,
  /* fix32-6 · ISSUE-006：写盘前读磁盘最新快照（load_state 返回裸 state，经 fix33-1 归一） */
  dsLoadState: async () => normalizeDesktopSnapshot(await desktopInvoke('load_state', {})),
});
bindCryptoDeps({
  toast,
  getUi: () => uiPlaceholder,
  defaultState,
  appConfirm: (msg: string, onOk: () => void): void => { appConfirm(msg, onOk); },
  mountModal: (el: any): void => { _modalStack.push(el); },
  unmountModal: (el: any): void => { const i = _modalStack.indexOf(el); if (i >= 0) _modalStack.splice(i, 1); },
  isTopModal: (el: any): boolean => _modalStack[_modalStack.length - 1] === el,
  syncAppInert: (): void => { _syncAppInert(); },
  /* fix43-1 · ISSUE-001：加密保存与 bindPersistDeps 同口径——命名空间存在不等于桌面通道（无 invoke 时落 localStorage） */
  isDesktop: hasDesktopInvoke,
  desktopInvoke,
  purgeVersions: (): void => {},
});

/**
 * M1-3 · 活跃 state 视图（早期绑定版）。
 * `injectActionsDeps` 位于 `const liveState` 声明之前，直接用后者会命中 TDZ；
 * 此处以 getter 代理承接，`initStore` 整体替换 state 绑定后仍读取最新引用。
 */
const liveStateEarly: any = {};
Object.defineProperty(liveStateEarly, 'nodes', { get: () => { const s = getState(); return (s && s.nodes) || {}; } });
Object.defineProperty(liveStateEarly, 'rootId', { get: () => { const s = getState(); return s ? s.rootId : null; } });
Object.defineProperty(liveStateEarly, 'trashed', { get: () => { const s = getState(); return (s && s.trashed) || []; } });
/* 【fix5 · P1】全局标签索引视图：日历「选择标签」等注入方据此列出「尚未关联任何节点的新建标签」
   （这些标签只登记在 state._tags，不在任何节点的 tags 里）。 */
Object.defineProperty(liveStateEarly, '_tags', { get: () => { const s = getState(); return (s && Array.isArray(s._tags)) ? s._tags : []; } });
/* 【fix7 · 字数统计绑定失效根因】日历「字数统计」面板读的是 `deps.state.charStats`。
   本代理此前只代理 nodes / rootId / trashed / _tags ⇒ `charStats` 落到普通属性（undefined），
   于是面板永远显示 0（P0 实测：bucket={add:20,mod:18} 而面板四张卡全 0）。
   以下三个 getter 让面板、规则校验与诊断始终读到活引用。 */
Object.defineProperty(liveStateEarly, 'charStats', { get: () => { const s = getState(); return (s && s.charStats) || {}; } });
Object.defineProperty(liveStateEarly, 'charBaseline', { get: () => { const s = getState(); return (s && s.charBaseline) || {}; } });
Object.defineProperty(liveStateEarly, 'charStatsRev', { get: () => { const s = getState(); return (s && s.charStatsRev) | 0; } });
Object.defineProperty(liveStateEarly, 'pendingCalibration', { get: () => { const s = getState(); return !!(s && s.pendingCalibration); } });

/**
 * P1/P2 · 布局 / 主题 / 多选 / 侧栏 / 右侧栏依赖装配（**空壳已全部回填为真实实现**）
 *
 * `setForceRender` / `saveUI` / `renderMain` / `getCurrentDoc` / `viewOf` / `forceRender`
 * 原为 `noop` 空壳：`forceRender` 不渲染、`saveUI` 不落盘、`viewOf` 恒 null ⇒ 视图分发失效。
 * 现统一接 src/app/session.ts 的真实实现（viewOf/getCurrentDoc 逐字对齐 canonical）。
 */
/* P3 · UI 默认态就位（navExpanded / calModules / collapsedDocs 等），必须先于任何 renderSidebar */
session.initSessionDefaults();

/* 【fixr6-14 · ISSUE-014】backupOnClose 已删除：关闭备份单通道为 src/app/session.ts:1372
   bindCloseRequested → _saveBackupOnClose（invoke save_backup），本处不再旁路写盘。 */

bindLayoutDeps({
  ui: uiPlaceholder,
  setForceRender: session.setForceRender,
  saveUI: session.saveUI,
  renderMain,
  getCurrentDoc: session.getCurrentDoc,
  viewOf: session.viewOf,
  /* 【fixr6-14】按钮只调 close()，备份统一走 src/app/session.ts:1372 单通道 */
  /* Track B · M0-15：设置面板的云端同步按钮直达真实实现 */
  syncToCloud,
  syncFromCloud,
  isCloudSyncEnabled,
});
bindThemeDeps({
  ui: uiPlaceholder,
  saveUI: session.saveUI,
  forceRender: session.forceRender,
});
/**
 * 批次 N · 多选依赖注入：outline 分支接入批次 R 的大纲符号
 * （outlineVisibleSeq 真实可见序列 + 共享 _outlineSel 单例），保证 Ctrl+A / Esc 全选分支一致。
 */
bindSelectionDeps({
  getCurrentDoc: session.getCurrentDoc,
  viewOf: session.viewOf,
  outlineVisibleSeq,
  outlineSel: _outlineSel,
  forceRender: session.forceRender,
});
/**
 * P2 · 侧边栏依赖容器（原仅注入 `ui`，`state/N/isFolder/sortDocs/commit/nowSeq/…` 全落模块内空壳
 * ⇒ renderSidebar 内 `deps.N(deps.state.rootId)` 取不到节点、四棵子树与计数恒空、侧栏空白）。
 * 现按 src/ui/sidebar.ts 的 Deps 接口逐项注入真实实现。
 */
bindSidebarDeps({
  ui: uiPlaceholder,
  state: liveStateEarly,
  N: nodeById,
  isFolder: session.isFolder,
  sortDocs: session.sortDocs,
  sideCountsGet: session.sideCountsGet,
  l14On: session.l14On,
  l14SideScanEnsure: session.l14SideScanEnsure,
  l14SideScan: session.l14SideScan,
  l7TagCountText: session.l7TagCountText,
  sidebarFingerprint: session.sidebarFingerprint,
  tagIndexCache: null,
  /* P0 · 新建/重命名/删除标签：侧栏必须清**真实**索引缓存（副本无效），
     否则 buildTagIndex() 命中旧 Map，标签树与 #cntTags 不刷新。 */
  invalidateTagIndex: session.invalidateTagIndex,
  renderIntro: session.renderIntro,
  updateSidebarActiveState: session.updateSidebarActiveState,
  saveUI: session.saveUI,
  forceRender: session.forceRender,
  commit: persistCommit,
  nowSeq: _nowSeq,
  getCurrentDoc: session.getCurrentDoc,
  openNode: session.openNode,
  safeNavigate: session.safeNavigate,
  setActiveKey: session.setActiveKey,
  showTreeContext: session.showTreeContext,
  getNodeSvg: session.getNodeSvg,
  getCalendarRootId,
  actions,
  l7SkeletonEnsureCss: session.l7SkeletonEnsureCss,
  l7TagIndexWhenReady: session.l7TagIndexWhenReady,
  buildTagIndex: session.buildTagIndex,
  getTagColor: session.getTagColor,
  openTagPalette: session.openTagPalette,
  openTag: session.openTag,
});
/** 批次 O · 右侧栏：`ui` + 导出端口 + 当前文档/导航/渲染端口（原为 noop 空壳）。 */
bindRightbarDeps({
  ui: uiPlaceholder,
  getCurrentDoc: session.getCurrentDoc,
  openNode: session.openNode,
  forceRender: session.forceRender,
  commit: persistCommit,
  /* 批次 CX · 右侧栏导出口接真实实现（此前 doDownload / exportICS / exportFullBackup
     落在 deps 占位 noop 上，点按钮无反应）：小库走同步路径，大库走分片异步路径。 */
  doDownload,
  exportICS: () => { void exportICS(); },
  exportFullBackup: () => { void exportFullBackup(); },
});
/* 虚拟滚动策略依赖：文档节点计数 / 当前文档 / 强制重渲染（先于大纲依赖注入） */
bindVirtualScrollDeps({
  N: nodeById,
  getCurrentDoc: session.getCurrentDoc,
  forceRender: session.forceRender,
});

/**
 * 大纲窗口化渲染（对应产品 `renderOutlineVirtual(wrap,doc)`）。
 *
 * 本工程虚拟滚动口径为 `.outline.virtual` + `content-visibility:auto`：行 DOM 全量生成、
 * 浏览器跳过屏外渲染（选区 / 拖拽 / 编辑语义与全量一致）。这里负责加标记、生成行、
 * 记录活动句柄，并在 `#content` 滚动容器上挂接卡顿监测（幂等）。
 */
function renderOutlineVirtualRows(wrap: HTMLElement, doc: any): void {
  wrap.classList.add('virtual');
  const kids = doc && Array.isArray(doc.children) ? doc.children : [];
  for (const cid of kids) {
    const n = nodeById(cid);
    if (n) wrap.appendChild(renderOutlineRow(n, 0));
  }
  markVirtualRender(wrap, doc);
  attachJankMonitor(document.getElementById('content'));
}

/**
 * 批次 Q · 焦点 / 选区：注入共享 `ui`。
 * `getVsActive` / `vsScrollToId` 接 core/virtual-scroll：窗口化下先滚入目标再定位。
 */
bindFocusDeps({
  ui: uiPlaceholder,
  getVsActive: vsGetActive,
  vsScrollToId: vsScrollToNode,
});
/**
 * 批次 R · 大纲视图（P0-T3 · 空桩修复）
 *
 * 原注入 `state:{rootId:null}` / `N:()=>null` / `commit:()=>undefined` / `nowSeq:()=>0` /
 * `actions:{}` 全为空壳：`renderOutlinePage` 内 `deps.N(cid)` 恒 null ⇒ 大纲只有文档标题行、
 * 子节点 0 行（表现为「点开文档后正文空白、不可编辑」）。
 * 现按模块真实导出逐项注入：
 *   - `N` ← core/persist.`N`（活状态节点取用）
 *   - `state` ← 活状态 getter 代理（initStore 整体替换后仍读到最新引用）
 *   - `commit` ← core/persist.`commit`（不可变提交 + __juProduceSafe）
 *   - `nowSeq` ← core/actions.`_nowSeq`（逻辑序号时钟）
 *   - `actions` ← core/actions.`actions`（addNode / updateText / toggleDone / removeNode …）
 *   - `forceRender` / `getCurrentDoc` / `viewOf` / `saveUI` ← app/session 真实实现
 *   - 其余（addNodeTo / findOwningTopDocId / fmtDateShort / getTagColor / openTag / updateRightSidebar）同源真实导出
 */
injectOutlineDeps({
  ui: uiPlaceholder,
  state: liveStateEarly,
  N: nodeById,
  forceRender: session.forceRender,
  getCurrentDoc: session.getCurrentDoc,
  viewOf: session.viewOf,
  commit: persistCommit,
  nowSeq: _nowSeq,
  actions,
  /* 正文 Ctrl+Z / Ctrl+Y（bindOutlineText 的 keydown 分支）此前用模块内占位 `() => false`，
     点下去只 preventDefault 不做事 —— 富文本格式命令「撤销不回来」的直接原因。
     注入与右栏按钮 / 全局快捷键同一套历史栈：撤销前先冲刷未提交正文。 */
  undo: undoWithFlush,
  redo,
  l14On: session.l14On,
  /* 虚拟滚动自动策略（2026-10-26）：默认开启；小文档 + 大内存自动全量；卡顿强制开启。 */
  countVisibleNodes: vsCountDocumentNodes,
  VIRTUAL_THRESHOLD: VS_VIRTUAL_THRESHOLD,
  shouldUseVirtual: vsShouldUseVirtual,
  renderOutlineVirtual: renderOutlineVirtualRows,
  getVsActive: vsGetActive,
  setVsActive: vsSetActive,
  vsScrollToId: vsScrollToNode,
  reportError,
  errMsg: errorText,
  /* M1-1c：富文本端口直接注入 core/richtext 真实实现（不再保留恒等占位）。 */
  sanitizeHtml,
  parsePasteLines,
  trimPasteHtml,
  safeExec,
  fmtDateShort: session.fmtDateShort,
  getTagColor: session.getTagColor,
  openTag: session.openTag,
  addNodeTo,
  findOwningTopDocId,
  updateRightSidebar,
});
/**
 * 批次 S · 时间选择器（P0-T3 · 空桩修复）：state / commit / nowSeq / forceRender 全部换真实实现，
 * `getCalendarRootId` 直接复用批次 T 的真实实现。
 */
bindTimepickerDeps({
  state: liveStateEarly,
  commit: persistCommit,
  nowSeq: _nowSeq,
  forceRender: session.forceRender,
  getCalendarRootId,
});
/**
 * 批次 T · 日历主视图（P0-T3 · 空桩修复）
 *
 * 原注入的 state / N / commit / nowSeq / forceRender / saveUI / actions / getTagColor /
 * extractTags / findOwningTopDocId / buildStatsBlock / buildCalLogBlock / currentBaseFontPx /
 * getTagIndexCache 全为空壳 ⇒ 日历网格取不到节点（无待办、无标签、统计恒空）。
 * 现逐项换成真实导出；仅 L14/L16 尚未迁移的 `makeLRU` / `nodeHasTag` / `calendarTagIndex` /
 * `getCalScopeText` / `renderNoteRow` / `ensureNoteDoc` / `l7Skeleton` 保留 views/calendar 模块默认值。
 *
 * 【P0-T3 二次修复 · 递归环】`buildCalLogBlock` / `buildStatsBlock` 曾注入为
 * `() => calModuleLogBody(...)` / `() => calModuleStatsBody(...)`，而这两个 calModule* 函数
 * 恰好又回调 deps.buildCalLogBlock() / deps.buildStatsBlock() —— 注入的是「自己的调用者」，
 * 形成 函数A→函数B→函数A 的无限递归。首次进入日历视图即
 * `RangeError: Maximum call stack size exceeded`，renderCalendarPage 中断，
 * #content 已在 renderMain 中被清空 ⇒ 日历页全白（本缺陷的实测现象）。
 * 现改为直接注入 views/calendar 里按产品件逐行移植的真实实现。
 */
injectCalendarDeps({
  ui: uiPlaceholder,
  state: liveStateEarly,
  N: nodeById,
  commit: persistCommit,
  nowSeq: _nowSeq,
  forceRender: session.forceRender,
  saveUI: session.saveUI,
  actions,
  /* M07 · 日历待办 Ctrl+Z / Ctrl+Y 接真实历史栈（撤销前先冲刷未提交正文） */
  undo: undoWithFlush,
  redo,
  isBlankNode,
  tagStripText: (n: any) => utils.stripHtml(n && n.text),
  getTagColor: session.getTagColor,
  extractTags,
  findOwningTopDocId,
  buildCalLogBlock,
  buildStatsBlock,
  /**
   * P2 · 日历两阶段渲染的判定与索引推进（原三项为空壳 ⇒ 点「日历」永远停在骨架页）
   *
   * `views/calendar` 在骨架页末尾调用
   *   `l7CalIndexWhenReady(() => { if (deps.isCalendarView()) deps.forceRender(); })`
   * ——`isCalendarView` 恒 false 时阶段 2 永不触发；`ensureCalIndexAsync` 不建索引时阶段 2 无数据。
   * 现按产品语义接线：生效视图（ui.view==='auto' 时由 viewOf 派生）为 calendar 即视为日历视图；
   * 索引则由已迁移的同步构建器 `buildCalIndex()` 在微任务内建好（分块异步构建器尚未迁移）。
   */
  isCalendarView: () => {
    const d = session.getCurrentDoc();
    const v = uiPlaceholder.view === 'auto' ? session.viewOf(d) : uiPlaceholder.view;
    return v === 'calendar';
  },
  ensureCalIndexAsync: () => Promise.resolve().then(() => {
    try { buildCalIndex(); } catch (e) { console.warn('[JU] buildCalIndex failed', e); }
    return null;
  }),
  tagIndexWhenReady: (cb: any) => session.l7TagIndexWhenReady(cb),
  l7Now: () => Date.now(),
  currentBaseFontPx,
  persistNow,
  /* M1-1c：富文本端口直接注入 core/richtext 真实实现（不再保留恒等占位）。 */
  sanitizeHtml,
  parsePasteLines,
  trimPasteHtml,
  safeExec,
  /* `getTagIndexCache` / `setTagIndexCache` 属日历自有标签计数缓存（Map<string, number>，
     与 session 的全库标签索引 Map<string, Set> 口径不同），保留 views/calendar 模块内实现。 */
});
/**
 * 批次 CA · 日历索引失效端口接线（M1-1 遗留空壳修复）
 *
 * `core/store` 侧原先的 `invalidateCalIndex` 是 `(): void => {}` 空壳，导致 `initStore()` /
 * `actions.addNode` / `actions.setNodeDate` 的日历索引失效全部落空（新增待办不刷新）。
 * 此处把 `views/calendar` 导出的**真实实现**注入 store 端口：
 *   置空 _calIndexCache / _calRecurCache / _yearCountsCache / _calDayCache / _renderDayCache
 *   + 标签索引缓存，并推进 _calDataRev（_renderDayCache 的代次来源）。
 * 注入顺序前提：`injectCalendarDeps` 已完成（上方），失效函数内部 `deps.setTagIndexCache` 可用。
 */
bindCalIndexPort({ invalidateCalIndex });
/**
 * 批次 V/W · 多维表格（数据库）：公式引擎 / 渲染核心 / 配置面板依赖注入（P0-T3 · 空桩修复）
 *
 * 原 `N`/`getDbRows`/`commit`/`nowSeq`/`forceRender`/`saveUI`/`getCurrentDoc`/`actions`/`isFolder`/
 * `placePop`/`themeList`/`openNode` 全为空壳 ⇒ 多维表格恒空表（`getDbRows()===[]`）、
 * 单元格编辑不提交、列配置弹层位置不定位。
 * 现全部换真实导出：getDbRows 为 views/database/render 的真实实现（canonical 11180），
 * state 经 getState 读取（保持引用活性），ui 复用共享对象。
 */
injectFormulaDeps({
  getState,
  ui: uiPlaceholder,
  N: nodeById,
  getDbRows,
});
injectPanelDeps({
  getState,
  ui: uiPlaceholder,
  N: nodeById,
  commit: persistCommit,
  forceRender: session.forceRender,
  saveUI: session.saveUI,
  nowSeq: _nowSeq,
  getCurrentDoc: session.getCurrentDoc,
  actions,
  getDbRows,
  isFolder: session.isFolder,
  placePop: session.placePop,
  themeList: session.themeList,
});
injectDatabaseDeps({
  getState,
  ui: uiPlaceholder,
  N: nodeById,
  commit: persistCommit,
  nowSeq: _nowSeq,
  forceRender: session.forceRender,
  saveUI: session.saveUI,
  getCurrentDoc: session.getCurrentDoc,
  actions,
  getDbRows,
  openNode: session.openNode,
  /* M1-1c：富文本端口直接注入 core/richtext 真实实现（不再保留恒等占位）。 */
  sanitizeHtml,
  parsePasteLines,
  trimPasteHtml,
  safeExec,
  extractTags,
  findOwningTopDocId,
  openTimePicker,
  openRegionPicker,
  showDbRowContext,
  attachPanScroll,
  formatTimeValue,
  dbTableList,
  dbSummaryMode,
  dbSummaryOf,
  dbFmtSummary,
  dbFieldSummable,
  dbLinkTitle,
  openDbFilterPanel,
  openDbSortPanel,
  openDbSummaryPanel,
  openDbHiddenFieldsPanel,
  openFieldTypeMenu,
  openFieldConfigPop,
  openDbFieldConfigDialog,
  openLinkPicker,
  openMultiSelectPicker,
  __l14On: session.l14On,
  VIRTUAL_THRESHOLD: 200,
  /* `__renderDbGalleryVirtual`（L14 窗口化画廊）尚未迁入本工程，保留 views/database 模块默认实现。 */
});
/**
 * 批次 Y/Z · 思维导图 + 知识图谱（P0-T3 · 空桩修复）
 *
 * 原 state / N / commit / nowSeq / forceRender / saveUI / isBlankNode / isFolder /
 * renderViewTitle / currentBaseFontPx / themeColor 全为空壳 ⇒ 导图取不到子节点、图谱节点集恒空。
 * 现换真实导出；仅 L14 窗口化（`countVisibleNodes` / `renderMindmapVirtual`）尚未迁移，保留模块默认值。
 * graph 的 _graphPositions / saveGraphPositions 保持模块内默认实现（与产品件同源：
 * localStorage `juju.graphpos` + 300ms 防抖），待 store 持久化批次统一接管。
 */
injectMindmapDeps({
  state: liveStateEarly,
  ui: uiPlaceholder,
  commit: persistCommit,
  N: nodeById,
  renderDocHeaderInline,
  currentBaseFontPx,
  saveUI: session.saveUI,
  forceRender: session.forceRender,
  nowSeq: _nowSeq,
  isBlankNode,
  l14On: session.l14On,
  VIRTUAL_THRESHOLD: 200,
  themeColor: session.themeColor,
});
injectGraphDeps({
  state: liveStateEarly,
  ui: uiPlaceholder,
  N: nodeById,
  commit: persistCommit,
  isFolder: session.isFolder,
  isBlankNode,
  renderViewTitle,
  saveUI: session.saveUI,
  forceRender: session.forceRender,
  errMsg: errorText,
  getGraphWorker,
});
/**
 * 批次 AB/AC · 幻灯片 / 演示 / 列表类视图（P0-T3 · 空桩修复）
 *
 * 幻灯片经 `JU_SLIDES.init(deps)` 一次性完成「依赖注入 + 初始化」（init 内含幂等哨兵，
 * 后续 boot 再调 initJuSlides 不会重复登记 <style> / pagehide 监听）。
 * 原 state / N / commit / saveUI / actions / getCurrentDoc / isFolder / addNodeTo / forceRender /
 * renderFileCard / getNodeSvg / fmtRelative / buildTagIndex / docSubtree / purgeNodeMeta 全为空壳
 * ⇒ 星标 / 模板 / 回收站 / 历史四视图恒空、幻灯片页取不到节点。现逐项换真实导出；
 * 尚未迁移的 `loadVersionList` / `l7Skeleton` / `_l7IsTagsView` / `migrateWordToOutline`
 * 与虚拟滚动端口保留模块默认值。
 */
JU_SLIDES.init({
  state: liveStateEarly,
  ui: uiPlaceholder,
  commit: persistCommit,
  N: nodeById,
  saveUI: session.saveUI,
  renderDocHeaderInline,
  isBlankNode,
});
injectJuSlidesDeps({});
injectPresentationDeps({
  state: liveStateEarly,
  N: nodeById,
  renderDocHeaderInline,
  linkTitleAtPoint,
  navigateToWikiLink,
});
injectListsDeps({
  state: liveStateEarly,
  ui: uiPlaceholder,
  commit: persistCommit,
  N: nodeById,
  actions,
  getCurrentDoc: session.getCurrentDoc,
  isFolder: session.isFolder,
  addNodeTo,
  forceRender: session.forceRender,
  saveUI: session.saveUI,
  safeNavigate: session.safeNavigate,
  setActiveKey: session.setActiveKey,
  renderFileCard: session.renderFileCard,
  getNodeSvg: session.getNodeSvg,
  fmtRelative: session.fmtRelative,
  getTagIndexCache: () => session.getTagIndexCache(),
  buildTagIndex: session.buildTagIndex,
  l7TagIndexWhenReady: session.l7TagIndexWhenReady,
  _mSel,
  _mSelSetOrder,
  _mSelHas,
  _mSelClick,
  _mSelSelectAll,
  _searchHayCache: { clear: noop },
  docSubtree,
  purgeNodeMeta,
});
/**
 * M1-1 · 批次 AE/AF · Actions + 导入导出依赖装配
 * 说明：commit / persistNow / forceRender / docSubtree / findOwningTopDocId / isBlankNode /
 * purgeNodeMeta / _tombstoneSet / _recentlyRemoved.delete / _searchHayCache / migrateStateObject /
 * IS_DESKTOP / 桌面壳端口 等尚未拆分符号先注入占位（防运行期 ReferenceError）；
 * renderSidebar / scheduleNotify / getCalendarRootId / ensureCalendarRoot 等已拆分符号注入真实实现；
 * actions / addNodeTo 为本批次真实模块（供 import 侧 logActivity / 节点工厂调用）。
 */
injectActionsDeps({
  /* M1-3：commit / persistNow / N / 所属文档 / 空节点 / 墓碑 全部接入 core/persist 真实实现
     （此前均为占位，actions.addNode 等实际为空操作，多标签同步无法成立）。 */
  commit: persistCommit,
  state: liveStateEarly,
  ui: uiPlaceholder,
  /* Track B · 免费版限额提示：actions.addNode 达到 500 节点上限时经产品 toast 提示激活 Pro。 */
  toast,
  N: nodeById,
  persistNow,
  renderSidebar,
  forceRender: session.forceRender,
  docSubtree,
  findOwningTopDocId,
  isBlankNode,
  purgeNodeMeta,
  tombstoneSet,
  recentlyRemovedDelete: persistRecentlyRemovedDelete,
  saveUI: session.saveUI,
  scheduleNotify,
  schedulePersist,
  /* 批次 CA：actions 的日历数据变更（addNode / setNodeDate / clearNodeSchedule / createDoc /
     importTree）经此端口触发真实日历索引失效，使 UI 在下次渲染时重建日缓存。 */
  invalidateCalIndex,
  /* 【fix5 · P2】actions.updateText 的 tagsChanged 经此端口触发标签索引失效，
     使侧栏「标签」列表与排序在正文 #tag 增删后立刻重建（不再命中旧 Map）。 */
  invalidateTagIndex: session.invalidateTagIndex,
  /* 【fix7】字数统计 token 化：正文编辑按 token 差分增量累加；节点新增/删除按整段 token 计入。
     实现在 core/charstats（500ms 批次合并 + 退出校准 + pendingCalibration）。 */
  charStatsEdit: (id: any, oldHtml: string, newHtml: string) => { try { charstats.queueEdit(String(id), oldHtml, newHtml); } catch (e) { console.warn('[JU] charStatsEdit', e); } },
  charStatsNodeAdd: (id: any, text: string) => { try { charstats.queueNodeAdd(String(id), text); } catch (e) { console.warn('[JU] charStatsNodeAdd', e); } },
  charStatsNodeRemove: (id: any, text: string) => { try { charstats.queueNodeRemove(String(id), text); } catch (e) { console.warn('[JU] charStatsNodeRemove', e); } },
});
injectExportDeps({
  state: liveStateEarly,
  ui: uiPlaceholder,
  /* 批次 CX · 活节点取用与活状态读取：全量备份 / 大库遍历据此判断规模并分片。 */
  N: nodeById,
  getState,
  getCurrentDoc: session.getCurrentDoc,
  actions,
  mmLayoutConsts,
  layoutMindmap,
  currentBaseFontPx,
  themeColor: session.themeColor,
  /* M1-1c：导出侧富文本净化取自 core/richtext（toHtml 节点正文输出）。 */
  sanitizeHtml,
  getCalendarRootId,
});
injectImportDeps({
  commit: persistCommit,
  state: liveStateEarly,
  getState,
  ui: uiPlaceholder,
  N: nodeById,
  actions,
  addNodeTo,
  saveUI: session.saveUI,
  renderSidebar,
  forceRender: session.forceRender,
  flushPersistNow,
  schedulePersist,
  getCalendarRootId,
  ensureCalendarRoot,
  IS_DESKTOP: hasDesktopInvoke(),
  applyUIFields: session.applyUIFields,
  desktopInvoke,
  desktopReloadIntoApp: () => Promise.resolve(false),
  /* M1-1c：导入侧富文本净化取自 core/richtext（图片内联白名单口径一致）。 */
  sanitizeHtml,
  /* 【review9-08 · ISSUE-008】导入侧旧备份归一化接入真实实现（原保留 io/import 默认恒等函数，
     缺省字段与悬空 children 原样进入状态）。 */
  migrateStateObject,
  /* `setGraphPositions` / `saveGraphPositions` / `restoreVersions`
     （图谱坐标与历史版本持久化）尚未迁入本工程，保留 io/import 模块默认实现。 */
});

/**
 * M1-1 · 批次 AH/AI/AJ · 编辑器 / 主渲染器 / 启动引导依赖装配
 *
 * 装配风格与前序批次一致：只注入本批次已拆分的真实实现；
 * 尚未迁入本工程的同作用域符号保持模块内 deps 默认占位（不抛错，待后续批次回填）。
 */
/* 活跃 state 视图（getter 代理：initStore 替换模块级 state 绑定后仍读到最新引用） */
const liveState: any = {};
Object.defineProperty(liveState,'nodes',{get:()=>{const s=getState();return (s&&s.nodes)||{};}});
Object.defineProperty(liveState,'rootId',{get:()=>{const s=getState();return s?s.rootId:null;}});

/* M1-1c · 富文本适配层依赖：execCommand 失败提示经 toast 端口输出（单次装配，无隐式全局读取）。
   批次2 · 内联样式写入成功后由引擎显式调用 commitInlineStyle（== updateText）：
   把新 DOM 静默写回 state（noNotify，不广播 notify、不调度渲染），
   保证「写进去的样式真的进了数据模型」，而不是只停在 DOM 上等下一次 blur 覆盖。 */
injectRichtextDeps({ toast, commitInlineStyle: syncActiveEditor });
/**
 * 【编辑器初始化 · 强制 CSS 样式模式】
 * 颜色 / 背景 / 字号已完全改走纯 DOM 引擎，但粘贴 / insertText / 宿主补全等残留
 * execCommand 路径仍在：必须让它们产出 `<span style>`（而不是 `<font size="1-7">`），
 * 否则表现型标签与内联 style 混用，层叠顺序由嵌套深度决定，后一条命令会把前一项属性清掉。
 */
initRichtextStyleMode();

/* 批次 AH · 编辑器依赖 + 右侧栏富文本端口回填 */
injectEditorDeps({
  state: liveState,
  ui: uiPlaceholder,
  commit: persistCommit,
  safeExec,
  toast,
  nowSeq: _nowSeq,
  forceRender: session.forceRender,
  themeList: session.themeList,
  themeColor: session.themeColor,
  placePop: session.placePop,
  initDragClose,
});
/**
 * 节点深度（canonical `nodeDepth(id)`）：右栏 `[data-expand]` 的 l1/l2 折叠层级依赖它。
 * 本工程未迁移 depth 缓存，按父链现算（visited 兜底防环）。
 */
const nodeDepthOf = (id: any): number => {
  let d = 0; let cur = nodeById(id); const seen = new Set<any>();
  while (cur && cur.parent) { if (seen.has(cur.id)) break; seen.add(cur.id); d++; cur = nodeById(cur.parent); }
  return d;
};

/**
 * 右侧栏第二批依赖注入（P0-T3 · 第三轮空桩修复）
 *
 * 缺陷背景（本轮实测：`_环境与调试/m07-sixcheck-before-2026-10-25.txt`）：
 *   ① `#btnPrintDo` 绑的是 `deps.doPrint`，而 `doPrint` **从未注入**（占位 `() => {}`）
 *      ⇒ 点「确认打印」window.print 调用数 = 0、无 `.print-preview`；
 *   ② `[data-cmd]`（加粗/斜体/下划线/删除线/颜色/字号/撤销/重做…）全部走 `deps.safeExec`，
 *      而 `safeExec` **从未注入**（占位 `() => false`）⇒ 点加粗毫无反应；
 *   ③ `themeColor` 被接成 `(_n, fallback) => fallback`（恒回退），取色器默认值失效；
 *      且 `state / N / nowSeq / actions / isBlankNode / docSubtree / findOwningTopDocId /
 *      nodeDepth / outlineSel` 全为占位 ⇒ 反链面板恒空、批量格式化恒不生效、
 *      「创建缺失链接」「添加到日历/数据库」无响应。
 *   本节按模块真实导出逐项回填真实实现。
 */
bindRightbarDeps({
  state: liveStateEarly,
  N: nodeById,
  nowSeq: _nowSeq,
  actions,
  isBlankNode,
  docSubtree,
  findOwningTopDocId,
  nodeDepth: nodeDepthOf,
  safeExec,
  fmtPainter: _fmtPainter,
  deactivatePainter,
  toggleBatchPainter,
  toggleFormatPainter,
  openColorPicker,
  themeColor: session.themeColor,
  openSizePicker,
  fontSizePxFor,
  clearBgFromSelection,
  clearColorFromSelection,
  applyFontSize,
  /* 工具栏 active 状态：getComputedStyle(selection.anchorNode) 口径，selectionchange 时刷新 */
  formatActive: formatActiveState,
  /* DOM Range 兜底写入（历史端口，内部已委托给同一选区样式引擎） */
  applyInlineStyle,
  /* 【本轮修复】颜色 / 背景 / 字号 / 加粗的**唯一**写入通道：纯 DOM（抽取 → 就地合并 style → 插回）。
     WebView2 中 document.execCommand 已废弃，执行它会重建边界节点、摧毁已应用的格式，
     故 rightbar 的 writeStyle / toggleFmt 均改走这两个端口，全程零 execCommand。 */
  applyCustomStyle: applyCustomStyleToSelection,
  toggleCustomStyle: toggleCustomStyleToSelection,
  selectionStyle: selectionStyleValue,
  normalizeCssStyle,
  batchFormatHtml,
  onSelectionChangeForPainter,
  onKeyForPainter,
  /* 打印端口（本轮新增 ui/print.ts 真实实现） */
  doPrint,
  showPrintPreview,
  /* 右栏多选集合（批量格式化判定依赖它，此前为 {} ⇒ 恒判无选中） */
  outlineSel: _outlineSel,
  /* M07 · 撤销 / 重做：接 core/persist 的真实历史栈（此前为 `() => false` 占位，
     点按钮与 Ctrl+Z 均无反应）；撤销前先冲刷未提交正文，保证「撤销只回退一步」。 */
  undo: undoWithFlush,
  redo,
  /* M07 · 大纲多行复制 / 剪切：右栏 copy/cut 按钮在多选态下写结构化节点载荷 */
  outlineCopy: outlineCopySelected,
  outlineCut: outlineCutSelected,
  outlinePaste: outlinePasteFromText,
  /* M07 · 格式命令前后冲刷编辑器（让「加粗 → 撤销」只回退格式，不吞文字） */
  flushEditor: flushActiveEditor,
  /* M07 · 本轮修复：格式命令执行后改为**静默**同步（noNotify），绝不触发全局重渲染，
     保证 execCommand 之后选区仍在正文里，连续点加粗/换色不会「前一步失效」。 */
  syncEditor: syncActiveEditor,
});

/* 打印模块依赖（ui/print.ts）：当前文档 / 节点取用 / 根节点 / 字数 / 强制重渲染 */
bindPrintDeps({
  getCurrentDoc: session.getCurrentDoc,
  N: nodeById,
  state: liveStateEarly,
  docWordCount: (docId: any) => { try { const r = docWordCount(docId); return typeof r === 'number' ? r : 0; } catch (e) { return 0; } },
  forceRender: session.forceRender,
});

/**
 * 批次 AI · 主渲染器依赖（P1/P3 修复）
 *
 * 原注入 `N:()=>null` / `viewOf:()=>null` / `getCurrentDoc:()=>null`：
 * renderMain 计算 `view = ui.view==='auto' ? viewOf(curDoc) : ui.view` 恒得 null，
 * switch 落入 default → `renderOutlinePage(null)` → `#content` 只剩「请先选择文档」。
 * 现全部换为真实实现；`renderFolderGrid` 也由空 div 换为真实资料库/文件夹网格。
 *
 * 说明：`vs*`（L16 虚拟滚动）、`disconnectOutlineHeaderRO` / `observeOutlineHeader`（L16 标题
 * ResizeObserver）、`getCalTgPrevScroll` / `setCalTgPrevScroll` / `getSavedOutlineScroll` /
 * `setSavedOutlineScroll` / `savedMindmapScroll` / `setCalDayNodesForModules`（跨视图滚动位置）
 * 与 `renderFloatCal`（悬浮迷你日历）均属尚未迁入本工程的子系统，**不再显式传本地空函数**，
 * 直接沿用 app/render.ts `deps` 的模块内默认实现（虚拟滚动默认关闭，不影响首屏渲染）。
 */
bindRenderMainDeps({
  ui: uiPlaceholder,
  state: liveState,
  N: nodeById,
  viewOf: session.viewOf,
  getCurrentDoc: session.getCurrentDoc,
  isForceRender: session.isForceRender,
  setForceRender: session.setForceRender,
  syncTopbar: session.syncTopbar,
  updateRightSidebar,
  renderIntro: session.renderIntro,
  updateRemindBadge: session.updateRemindBadge,
  floatCalVisible: session.floatCalVisible,
  ensureElInViewport: session.ensureElInViewport,
  renderSidebar,
  restoreFocus,
  /* 日历模块化后：统计 / 系统日志 / 字符统计三个局部面板由 views/calendar 的模块体承接。
     【P0-T3 二次修复】此处同样不再指向 calModule* 别名（会与 calModule* 内部的
     deps.build*Block() 回调构成递归），直接使用真实实现。 */
  buildStatsBlock,
  buildCalLogBlock,
  calModuleCharsBody: (head: any) => calModuleCharsBody(head),
  getTagIndexCache: () => session.getTagIndexCache(),
  renderFolderGrid: session.renderFolderGrid,
  renderCalendarPage,
  renderDatabasePage,
  renderOutlinePage,
  renderMindmap,
  renderPresentation,
  renderGraph,
  /* 虚拟滚动活动句柄（焦点先滚入 / 重新绑定） */
  getVsActive: vsGetActive,
  setVsActive: vsSetActive,
  vsScrollToId: vsScrollToNode,
  renderStarredView,
  renderTemplatesView,
  renderTrashView,
  renderSlidesView,
  renderTagsView,
  renderTagNodes,
  renderHistoryView,
});

/* 【review8 · 恢复 preimport】导入前快照读取：仅接受含 nodes/rootId 的合法快照；缺失或损坏返回 null（不伪造恢复） */
/* 【review10-01 · ISSUE-001】加密态快照为 {ts,enc} 密文：同步端口只服务明文 {ts,state}；
   密文由 loadAutoBackupAsync 在解锁成功后（ui.encKey 已置）异步解密，不再依赖「首调 null + 会话缓存命中」。 */
function _validPreimportState(st: any): boolean {
  return !!(st && typeof st === 'object' && st.nodes && typeof st.nodes === 'object' && st.rootId && st.nodes[st.rootId]);
}
function _preimportRaw(): any {
  try {
    const raw = localStorage.getItem('juju.backup.preimport');
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && p.enc) return { p, st: null };
    return _validPreimportState(p && p.state) ? { p, st: p.state } : null;
  } catch (e) { console.warn('[JU] caught error', e); return null; }
}
/* 【review9-12 · ISSUE-012】快照中的 ui 偏好原样返回，供 boot 的 ab.ui 分支回填。 */
function loadAutoBackup(): { state: any; ui?: any } | null {
  const r = _preimportRaw();
  if (!r || !r.st) return null;
  purgeLocalCopy('PREIMPORT');
  return { state: r.st, ui: r.p.ui };
}
async function loadAutoBackupAsync(): Promise<{ state: any; ui?: any } | null> {
  const r = _preimportRaw(); if (!r) return null;
  if (r.st) { purgeLocalCopy('PREIMPORT'); return { state: r.st, ui: r.p.ui }; }
  const key = uiPlaceholder && uiPlaceholder.encKey;
  if (!key) return null; /* 未解锁不解密 */
  try {
    const st = await decryptState(r.p.enc, key);
    if (!_validPreimportState(st)) return null;
    /* 【review11-01 · ISSUE-001】密文快照一次性消费：解密成功后立即清除，避免下次启动再次覆盖主库 */
    purgeLocalCopy('PREIMPORT');
    return { state: st, ui: r.p.ui };
  }
  catch (e) { console.warn('[JU] caught error', e); return null; }
}

/* 【review9-08 · ISSUE-008】旧备份归一化：先前注入恒等函数 ⇒ 缺省字段 / 悬空 children 原样进入状态。
   以 parent 为准重建 children（丢弃悬空 / 自引用 / 根引用 / 重复项，孤儿挂根，回收站子树保持脱离活树），
   补齐 tagColors / dbFields / activity / _ver 缺省；结构不可识别返回 null（沿用导入侧「备份结构无法修复」）。 */
const _MIGRATE_STATE_VER = 18; /* 与产品件 STATE_VER 同值 */
function migrateStateObject(st: any): any {
  try {
    if (!st || typeof st !== 'object' || !st.nodes || typeof st.nodes !== 'object') return null;
    const nodes = st.nodes;
    const rootId = st.rootId;
    if (typeof rootId !== 'string' || !nodes[rootId] || typeof nodes[rootId] !== 'object') return null;
    /* 回收站子树：根节点已脱离活树，重建时不得按 parent 挂回原父（合法新备份零改动） */
    const trash = new Set<string>();
    if (Array.isArray(st.trashed)) for (const t of st.trashed) {
      if (!t || typeof t !== 'object') continue;
      if (typeof t.rootId === 'string') trash.add(t.rootId);
      if (Array.isArray(t.ids)) for (const x of t.ids) if (typeof x === 'string') trash.add(x);
    }
    for (const id in nodes) {
      const n = nodes[id];
      if (!n || typeof n !== 'object' || Array.isArray(n)) { delete nodes[id]; continue; }
      if (id === rootId) { n.parent = null; continue; }
      if (n._deleted) continue; /* 回收站节点脱离活树为设计行为，不改其 parent */
      const p = n.parent;
      if (n.parent === id || typeof p !== 'string' || !nodes[p] || nodes[p]._deleted) n.parent = rootId;
    }
    for (const id in nodes) {
      const n = nodes[id];
      const cur: any[] = Array.isArray(n.children) ? n.children : [];
      const kids: string[] = [];
      for (const c of cur) {
        if (typeof c !== 'string' || c === id || c === rootId || !nodes[c] || kids.indexOf(c) >= 0) continue;
        if (nodes[c].parent !== id) continue; /* stray：child.parent 指向别处 */
        kids.push(c);
      }
      n.children = kids;
    }
    for (const id in nodes) {
      if (id === rootId) continue;
      const n = nodes[id];
      if (n._deleted || trash.has(id)) continue;
      const p = n.parent;
      if (typeof p === 'string' && nodes[p] && nodes[p].children.indexOf(id) < 0) nodes[p].children.push(id);
    }
    if (typeof st.tagColors === 'undefined') st.tagColors = {};
    if (typeof st.dbFields === 'undefined') st.dbFields = ['标题', '优先级', '状态', '时间'];
    if (typeof st.activity === 'undefined') st.activity = {};
    if (typeof st._ver !== 'number') st._ver = _MIGRATE_STATE_VER;
    return st;
  } catch (e) {
    console.warn('[JU] migrateStateObject failed', e);
    return null;
  }
}

/* 批次 AI/AJ · 启动引导依赖：已拆分的绑定/初始化接入真实实现 */
injectBootDeps({
  ui: uiPlaceholder,
  getState,
  subscribe,
  actions,
  viewOf: session.viewOf,
  JU: window.JU,
  /* M1-1d · 全局 JU 写入统一出口（boot 侧不再直写 window.JU） */
  publishJU,
  /* M1-1d · initStore 与其持久化影子层以参数显式注入（不再依赖模块内隐式挂载） */
  initStore: (initial: any) => initStore(initial, persistStoreBridge),
  /* M1-3 · 持久化 / 合并 / 节点取用真实端口（boot 侧 juPatch 直接对外发布其中 commit / N） */
  commit: persistCommit,
  N: nodeById,
  defaultState,
  loadState,
  /* fix32-1 · 桌面态与装载端口：桥接存在即桌面；dsLoadState 走 load_state（main.rs 无参签名）并解析 JSON 文本 */
  isDesktop: () => _desktopRuntime,
  setIsDesktop: (v: boolean) => { _desktopRuntime = !!v; },
  /* fixr6-5 · ISSUE-005：boot 运行期桌面态改能力口径，与其余三处注入同一标识符 */
  detectDesktop: hasDesktopInvoke,
  desktopInvoke,
  dsLoadState: async () => normalizeDesktopSnapshot(await desktopInvoke('load_state', {})),
  /* M1-2 · 批次 AR：加密链路接入 core/crypto 真实实现（hasEncryptedStore → promptUnlock → decryptState
     → encryptState → writeEncryptedStore），boot 的加密装载/解锁/兜底分支不再是占位。 */
  hasEncryptedStore,
  readEncryptedStore,
  encryptState,
  decryptState,
  promptUnlock,
  /* 【review10-05 · ISSUE-005】主库装载路径同源归一：desktop 快照 / 浏览器主库 / 自动备份兜底
     统一走 migrateStateObject（含回收站子树语义），兜底保留「迁移失败退回原对象」。 */
  migrateOrBackup: migrateStateObject,
  migrateOrFallback: (st: any) => migrateStateObject(st) || st,
  migrateStateObject,
  loadAutoBackup,
  loadAutoBackupAsync,
  mergeRemoteIfNewer,
  onRemoteStoreChange,
  /* fix32-3 · ISSUE-003：注入加密兜底读取（覆盖 boot 默认 noop） */
  recoverPendingEncrypted,
  /* 【review7-01 · ISSUE-001】加密兜底键 / 会话兜底写入口 / activity 日志防抖 flush 同源注入 */
  PENDING_SYNC_KEY,
  flushPendingSession,
  flushPendingLogs,
  getLogTimers,
  persistNow,
  /* 【review14-01 · ISSUE-001】关闭加密先明文落盘，再清 encStore */
  persistNowAwait,
  flushPersistNow,
  /* 【fixr6-14】关闭 / 切后台备份由 src/app/session.ts:1372 单通道承担，boot 不再注入 */
  renderMain,
  bindTopbar,
  bindMainToggles,
  bindRightSidebar,
  /* P1 · 原 `bindSidebar/bindTools = noop`：侧栏导航 / 新建文档 / 排序 / 搜索全部无响应 */
  bindSidebar: session.bindSidebar,
  bindTools: session.bindTools,
  /* M5-1b · 批次 CT：设置面板补「本地崩溃日志 · 查看与导出」行并绑定导出语义 */
  /* 批次 CW：先接面板开关（#btnSettings / #settingsClose），再接各设置行与行为端口 */
  /* 第九轮 fix9：补回迁移漏迁的 canonical bindSettings() 剩余 4 个处理器（见 bindSettingsRows） */
  /* 第十轮 fix10：bindSettingsRows 内已扩到 8 项（fix9 的 SIMPLE 4 项 + fix10 恢复的 4 项），
     面板级 mountSettingsPanel() 与本串同时调用同一实现，幂等（onclick 属性赋值不叠加）。 */
  bindSettings: () => { bindSettingsPanel(); bindCrashLogRow(); bindLicenseActivation(); bindCrashLogExport(); bindPublishTools(); bindManualModal(); bindSettingsRows(); },
  /* 第十轮 fix10 · Q2=MISSING_INJECT：remindersSupported 注入真实 Notification 能力探测。
     第九轮按保守默认登记 REG-9（DESIGN_LIMIT），产品方答复 Q2=MISSING_INJECT ⇒ 本轮补注入；
     boot.ts:282 的 `() => false` 保留，仅作未注入时的兜底。 */
  remindersSupported: () => typeof Notification !== 'undefined' && Notification.permission !== 'denied',
  /* M3 · 批次 AW · M3-2a：全局 error / unhandledrejection 兜底接真实采集（本地环形日志） */
  reportError,
  errMsg: errorText,
  bindTheme: () => {
    applyTheme(document.documentElement.dataset.theme || 'day');
    applySystemTheme();
  },
  initJuSlides,
  /* 【修复】番茄钟端口接真实状态机（此前全为 `() => {}` ⇒ 浮层能弹出但点「开始」不计时） */
  togglePomo,
  resetPomo,
  updatePomoDisplay,
  getPomoState,
  renderMusicList,
  /* P1 · 原 `initJuDnd/initJuModules = noop`：遗留 JU_DND / JU_MODULES 未加载时静默（canonical 同款 try/catch） */
  initJuDnd: session.initJuDnd,
  initJuModules: session.initJuModules,
  toast,
  saveUI: session.saveUI,
  forceRender: session.forceRender,
  /* P0-T3 · 空桩修复：boot 的启动尾段与通知回调均调用 `deps.updateRightSidebar()`，
     此前未注入 ⇒ 右栏（大纲 / 出链 / 反链 / 字数）启动后不刷新。 */
  updateRightSidebar,
  /* P0-T3 · 关键空桩修复：`boot` 在 `deps.subscribe(() => deps.scheduleRender())` 里以本端口承接
     store 通知（每次 commit / notify 都会触发）。此前未注入 ⇒ 落到 boot 模块默认 `() => {}`，
     所有数据变更后的 UI 刷新被静默丢弃（表现为「改完正文侧栏字数/节点计数不更新」）。
     现接 app/session 的真实 rAF 合并渲染实现。 */
  scheduleRender: session.scheduleRender,
  /* P1/P3 · 会话级端口（原为模块默认空壳，boot 段据此刷新侧栏 / 顶栏时钟 / 提醒角标 / 悬浮日历） */
  setActiveKey: session.setActiveKey,
  updateSidebarActiveState: session.updateSidebarActiveState,
  ensureElInViewport: session.ensureElInViewport,
  floatCalVisible: session.floatCalVisible,
  setFloatCalVisible: session.setFloatCalVisible,
  tickClock: session.tickClock,
  updateRemindBadge: session.updateRemindBadge,
  /* P3 · UI 快照恢复（原 `loadUI/applyUIFields/applyScale` 为空壳 ⇒ 侧栏宽度/折叠态/主题偏好不恢复） */
  loadUI: session.loadUI,
  /* fix43-3 · ISSUE-003：加密态 UI 快照（juju.ui.enc）此前只写不读 ⇒ 补解密回填端口 */
  loadUIEncrypted: session.loadUIEncrypted,
  applyUIFields: session.applyUIFields,
  applyScale: session.applyScale,
  /**
   * M07 · 音乐端口接真实 HTMLAudioElement 实现（core/audio.ts）。
   * 此前 `MUSIC_TRACKS: []` + `playTrack/stopMusic` 恒为占位，点音乐条目只有图标变化没有声音。
   * `playTrack` 同时把播放状态回写 `ui.musicPlaying` 并刷新列表图标（bindAudioListener 见下）。
   */
  MUSIC_TRACKS,
  playTrack: playMusicTrack,
  stopMusic: stopMusicTrack,
  setMusicVolume: audioSetVolume,
  /* 图标 / 点击语义以真实音频元素为准（audio 的 playing / pause 事件驱动） */
  isMusicPlaying: () => !!audioCurrentTrackId(),
});

/* 播放状态单点回传：真实「是否在播」由 audio 元素决定，避免失败时仍显示 ⏸ */
bindAudioListener((id: string | null) => {
  uiPlaceholder.musicPlaying = id;
  try { renderMusicList(); } catch (e) { console.warn('[JU] renderMusicList failed', e); }
});

/**
 * 音乐播放入口（boot 的 `#musicItem`.onclick 消费）。
 * `audioPlayTrack` 内部完成音源回落链，成功后经 bindAudioListener 回写 `ui.musicPlaying`；
 * 此处只做一次乐观同步，让点击瞬间图标即响应，失败时监听器会把它纠回 null。
 */
function playMusicTrack(id: string): void {
  audioPlayTrack(id);
  uiPlaceholder.musicPlaying = audioCurrentTrackId();
  try { renderMusicList(); } catch (e) { console.warn('[JU] renderMusicList failed', e); }
}

/** 停止播放入口（再次点击音乐条目 / 页面卸载）。 */
function stopMusicTrack(): void {
  audioStopTrack();
}

/**
 * M1-1 · 批次 AJ · 启动引导
 * 契约对齐：产品件 v2.0-t3.html:22792 的
 *   `if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',boot,{once:true});}else{boot();}`
 * 此处统一由 `start()` 承接（内部已含全局事件绑定 + 就绪态分发）。
 */
/**
 * M1-1d · `window.JU` 全局属性统一收拢
 *
 * 收敛口径：本文件不再逐条分散写入 `window.JU.xxx`，全部键集中在下方单一装配点落位；
 * 其余模块（含 app/boot.ts）一律经 `publishJU()` 端口上交，禁止自行写全局。
 * 采用 `Object.assign` 而非重新赋值对象：保持 `injectBootDeps({ JU })` 等已捕获引用的同一性；
 * 键集合与产品件 `_win.JU.*` 导出契约逐项一致（M0-7 契约：不得新增/删除键名）。
 */
Object.assign(window.JU, {
  constants: Object.assign(window.JU.constants || {}, {
    TAG_RE: TAG_RE,
    WIKI_RE: WIKI_RE,
    APP_LOCALE: APP_LOCALE,
  }),

  /**
  * M1-1 · Store & Produce 全局挂载
  * 契约对齐：产品件 v2.0-t3.html:22777-22782（`JU.state=function(){return state;}` /
  * `JU.subscribe=subscribe`）与 5128-5137。本批次仅挂载已提取的 store / produce 端口，
  * `JU.state` 由 getState 承接；持久化、commit、actions 等端口随 M1-2+ 模块迁移补齐。
  */
  initStore: initStore,
  getState: getState,
  state: getState,
  subscribe: subscribe,
  scheduleNotify: scheduleNotify,

  /**
   * M5-2 · 按需字数统计（超过 5,000 节点改由 Worker 计算，结果经 subscribe 派发）
   * `docWordCount(docId)`：小文档同步返回字数；大文档命中缓存返回数字，未命中返回 null 并投递 Worker。
   */
  docWordCount: docWordCount,
  requestDocWordCountAsync: requestDocWordCountAsync,
  clearDocWordCountCache: clearDocWordCountCache,
  getWordCountDiagnostics: getWordCountDiagnostics,
  disposeWordCountWorker: disposeWordCountWorker,
  WORDCOUNT_WORKER_THRESHOLD: WORDCOUNT_WORKER_THRESHOLD,

  /**
   * M1-3 · 持久化 / LWW 合并 / 节点取用全局挂载
   * 契约对齐：产品件 boot juPatch 对外发布 `commit` / `N`（`_win.JU.commit` / `_win.JU.N`），
   * 本工程在 boot 之外再补持久化入口，供多标签同步诊断与 Playwright 并发测试使用。
   */
  commit: persistCommit,
  persistNow,
  flushPersistNow,
  /* M07 · 撤销 / 重做（诊断与真机探针入口，与右栏按钮共用同一历史栈） */
  undo: undoWithFlush,
  redo,
  canUndo,
  canRedo,
  outlineCopySelected,
  outlineCutSelected,
  mergeRemoteIfNewer,
  onRemoteStoreChange,
  defaultState,
  loadState,
  N: nodeById,
  findOwningTopDocId,
  isBlankNode,
  copyPlain: copyPlain,
  __juProduce: __juProduce,
  __juProduceSafe: __juProduceSafe,

  /**
   * M3 · 批次 AW · 错误采集（本地环形日志）
   * 契约对齐产品件 `__juLog` / `__juFlushErrors` / `__juLogDownload` 三个 window 级键，
   * 并对外暴露 `reportError` 供诊断与「反馈」导出复用。
   */
  reportError,
  __juFlushErrors: flushPendingErrors,
  __juLogDownload: downloadErrorLog,
  bindCrashLogRow,
  bindLicenseActivation,
  bindSettingsPanel,

  /**
   * 第二轮 · 设置面板公开开关 API（#btnSettings 契约解耦）
   *
   * 装配层 / 回归夹具不再改写 `#btnSettings.onclick`（属性赋值会替换产品处理器，
   * 与产品 addEventListener 叠加成「先开再关」），改用这两个幂等入口。
   * `isSettingsOpen()` 只读，供诊断与回归断言。
   */
  openSettings: openSettingsPanel,
  closeSettings: closeSettingsPanel,
  isSettingsOpen: isSettingsPanelOpen,

  /**
   * Track B · 离线授权码（签发端 scripts/gen-license.mjs / 校验端 core/license.ts）
   * verifyLicense 供激活 UI 与诊断复用；restoreLicense 供启动阶段复核 localStorage 授权码。
   */
  verifyLicense,
  restoreLicense,
  LICENSE_STORAGE_KEY,

  /**
   * M1-1 · 批次 K · 通用 UI 与主题全局挂载（契约对齐产品件的同作用域函数名）
   */
  toast: toast,
  appConfirm: appConfirm,
  appPrompt: appPrompt,
  showContextMenu: showContextMenu,
  applyTheme: applyTheme,

  /**
  * M1-1 · 批次 K/L · 常用端口补齐（模态栈 / 主题 / 顶栏绑定 / 依赖注入句柄）
  */
  initDragClose: initDragClose,
  applySystemTheme: applySystemTheme,
  toggleTheme: toggleTheme,
  openThemeSelector: openThemeSelector,
  _modalStack: _modalStack,
  _syncAppInert: _syncAppInert,
  _syncAppInertObserver: _syncAppInertObserver,
  bindTopbar: bindTopbar,
  bindMainToggles: bindMainToggles,
  bindLayoutDeps: bindLayoutDeps,
  /* M5-2 · 搜索框 Worker 化（输入去抖 + 倒排索引常驻 Worker） */
  bindSearchWorker: bindSearchWorker,
  bindThemeDeps: bindThemeDeps,

  /**
  * M1-1 · 批次 N · 多选状态与侧栏渲染全局挂载
  * 契约对齐：产品件 v2.0-t3.html:15517-15593（_mSel* 同作用域函数）与 15840-16300（侧栏渲染/导航）。
  */
  ui: uiPlaceholder,
  selectionDeps: selectionDeps,
  bindSelectionDeps: bindSelectionDeps,
  _mSel: _mSel,
  _mSelSetOrder: _mSelSetOrder,
  _mSelHas: _mSelHas,
  _sbVisibleIds: _sbVisibleIds,
  _mSelClear: _mSelClear,
  _mSelSelectAll: _mSelSelectAll,
  _mSelClick: _mSelClick,
  _mSelPaint: _mSelPaint,
  _mSelSelectAllCurrent: _mSelSelectAllCurrent,
  bindSidebarDeps: bindSidebarDeps,
  renderSidebar: renderSidebar,
  renderSubDb: renderSubDb,
  renderSubStarred: renderSubStarred,
  renderSubDocs: renderSubDocs,
  renderSubTags: renderSubTags,
  makeSidebarRow: makeSidebarRow,
  navTo: navTo,
  promptNewTag: promptNewTag,
  renameTag: renameTag,
  removeTag: removeTag,
  replaceTagInHtmlTag: replaceTagInHtmlTag,

  /**
  * M1-1 · 批次 O · 右侧栏与 Wiki 链接 / 反链面板全局挂载
  * 契约对齐：产品件 v2.0-t3.html:16444-16808 同作用域函数名。
  */
  bindRightbarDeps: bindRightbarDeps,
  bindRightSidebar: bindRightSidebar,
  updateRightSidebar: updateRightSidebar,
  renderBacklinkPanel: renderBacklinkPanel,
  outgoingLinksOf: outgoingLinksOf,
  backlinksOf: backlinksOf,
  normTitle: normTitle,
  findNodeByTitle: findNodeByTitle,
  navigateToWikiLink: navigateToWikiLink,
  caretTextInfo: caretTextInfo,
  linkTitleAtPoint: linkTitleAtPoint,

  /**
  * M1-1 · 批次 Q/R · 焦点选区与大纲视图全局挂载
  * 契约对齐：产品件 v2.0-t3.html 同作用域函数名（focusNode / focusAfterRender / renderOutlinePage）。
  */
  bindFocusDeps: bindFocusDeps,
  focusNode: focusNode,
  focusAfterRender: focusAfterRender,
  focusTextAfterRender: focusTextAfterRender,
  saveFocus: saveFocus,
  restoreFocus: restoreFocus,
  syncEmptyState: syncEmptyState,
  isBlurSuppressed: isBlurSuppressed,
  getTextOffset: getTextOffset,
  nodePath: nodePath,
  rangeFromPath: rangeFromPath,
  rangeFromTextOffset: rangeFromTextOffset,
  editorRole: editorRole,
  editorSelector: editorSelector,
  isEditable: isEditable,
  cleanupEmptyInline: cleanupEmptyInline,
  unwrapStylelessSpans: unwrapStylelessSpans,
  collectRangeIntersectElements: collectRangeIntersectElements,
  injectOutlineDeps: injectOutlineDeps,
  _outlineSel: _outlineSel,
  renderOutlinePage: renderOutlinePage,
  renderDocHeaderInline: renderDocHeaderInline,
  renderOutlineRow: renderOutlineRow,
  bindOutlineText: bindOutlineText,
  outlineVisibleSeq: outlineVisibleSeq,
  toggleOutlineSel: toggleOutlineSel,
  outlineSelectRange: outlineSelectRange,
  outlineBatchMove: outlineBatchMove,
  outlineBatchIndent: outlineBatchIndent,
  outlineBatchOutdent: outlineBatchOutdent,
  outlineBatchDelete: outlineBatchDelete,
  previousVisible: previousVisible,
  nextVisible: nextVisible,
  indentNode: indentNode,
  outdentNode: outdentNode,
  moveSibling: moveSibling,

  /**
  * M1-1 · 批次 S · 农历 / 节假日 / 自然语言日期全局挂载
  * 契约对齐：产品件 v2.0-t3.html 同作用域函数与查表常量（dayLabel / solarToLunar / LUNAR_INFO …）。
  */
  LUNAR_INFO: LUNAR_INFO,
  LUNAR_MIN: LUNAR_MIN,
  LUNAR_MAX: LUNAR_MAX,
  leapMonth: leapMonth,
  leapDays: leapDays,
  monthDays: monthDays,
  lYearDays: lYearDays,
  solarToLunar: solarToLunar,
  lunarToSolarDate: lunarToSolarDate,
  lunarDayStr: lunarDayStr,
  lunarMonthStr: lunarMonthStr,
  ganzhiYear: ganzhiYear,
  SOLAR_FEST: SOLAR_FEST,
  LUNAR_FEST: LUNAR_FEST,
  HOLIDAY_REST: HOLIDAY_REST,
  isRestDay: isRestDay,
  dayLabel: dayLabel,
  parseNaturalDate: parseNaturalDate,

  /**
  * M1-1 · 批次 S · 时间选择器全局挂载
  * 契约对齐：产品件 v2.0-t3.html:6879 / 6949 / 10991-11124（mkCalSel / openCalTimeModal / 时间换算）。
  */
  bindTimepickerDeps: bindTimepickerDeps,
  mkCalSel: mkCalSel,
  openCalTimeModal: openCalTimeModal,
  fmtHm: fmtHm,
  snapHalfMins: snapHalfMins,
  calMinToHm: calMinToHm,
  clampM: clampM,
  fmtCalTime: fmtCalTime,

  /**
  * M1-1 · 批次 T · 日历主视图全局挂载
  * 契约对齐：产品件 v2.0-t3.html:11604-11611 的 JU.register('outlineCalendar', {…}) 同名端口。
  */
  injectCalendarDeps: injectCalendarDeps,
  CAL_MODULE_KEYS: CAL_MODULE_KEYS,
  ensureCalendarRoot: ensureCalendarRoot,
  getCalendarRootId: getCalendarRootId,
  dedupCalRoots: dedupCalRoots,
  expandRecurring: expandRecurring,
  buildCalIndex: buildCalIndex,
  buildRecurList: buildRecurList,
  calendarTodosOnDate: calendarTodosOnDate,
  buildYearCounts: buildYearCounts,
  invalidateCalIndex: invalidateCalIndex,
  invalidateCalIndexOnly: invalidateCalIndexOnly,
  l7CalIndexWhenReady: l7CalIndexWhenReady,
  getCalIndexCache: getCalIndexCache,
  setCalIndexCache: setCalIndexCache,
  getCalDataRev: getCalDataRev,
  getCalIndexFallbackAttempted: getCalIndexFallbackAttempted,
  tgHourH: tgHourH,
  tgTotalH: tgTotalH,
  cnNow: cnNow,
  tgTimeY: tgTimeY,
  tgNowY: tgNowY,
  tgDayNodes: tgDayNodes,
  buildTimeGrid: buildTimeGrid,
  startCalTgTimer: startCalTgTimer,
  clearCalTgTimer: clearCalTgTimer,
  getCalTgState: getCalTgState,
  bindCalEventDrag: bindCalEventDrag,
  calModuleState: calModuleState,
  calModuleTitle: calModuleTitle,
  calModuleDayNodes: calModuleDayNodes,
  calModuleNoteBody: calModuleNoteBody,
  calModuleTodayBody: calModuleTodayBody,
  calModuleLogBody: calModuleLogBody,
  calModuleStatsBody: calModuleStatsBody,
  calModuleCharsDates: calModuleCharsDates,
  calModuleCharsBody: calModuleCharsBody,
  calModuleBindDrag: calModuleBindDrag,
  calModuleBindResize: calModuleBindResize,
  renderCalModules: renderCalModules,
  renderCalendarPage: renderCalendarPage,
  openCalNodeMenu: openCalNodeMenu,
  closeCalNodeMenu: closeCalNodeMenu,
  renderCalNode: renderCalNode,

  /**
  * M1-1 · 批次 V · 多维表格（数据库）公式引擎全局挂载
  * 契约对齐：产品件 v2.0-t3.html:11653-12052 同作用域函数名（dbField* / dbFormula* / _FormulaParser）。
  */
  injectFormulaDeps: injectFormulaDeps,
  dbFieldName: dbFieldName,
  dbFieldType: dbFieldType,
  dbFieldDef: dbFieldDef,
  dbFieldVisible: dbFieldVisible,
  dbResolveField: dbResolveField,
  dbPrimaryField: dbPrimaryField,
  dbRawValue: dbRawValue,
  dbTextValue: dbTextValue,
  dbNumValue: dbNumValue,
  dbDateStr: dbDateStr,
  dbFormulaEval: dbFormulaEval,
  dbFormulaDisplay: dbFormulaDisplay,
  dbFormulaToNum: dbFormulaToNum,
  dbFormulaToStr: dbFormulaToStr,
  dbFormulaTruthy: dbFormulaTruthy,
  dbFormulaAgg: dbFormulaAgg,
  dbFormulaCall: dbFormulaCall,
  _dbFormulaDiff: _dbFormulaDiff,
  _FormulaParser: _FormulaParser,
  DB_AGG_FNS: DB_AGG_FNS,
  formatTimeValue: formatTimeValue,

  /**
  * M1-1 · 批次 V · 多维表格渲染核心全局挂载
  * 契约对齐：产品件 v2.0-t3.html:11631-12178 / 12878-14148 同作用域函数名。
  */
  injectDatabaseDeps: injectDatabaseDeps,
  DB_VIEWS: DB_VIEWS,
  _dbCellSchedule: _dbCellSchedule,
  _dbCellCancel: _dbCellCancel,
  dbFilterRuleActive: dbFilterRuleActive,
  dbRowMatches: dbRowMatches,
  dbFilterItemActive: dbFilterItemActive,
  dbRowMatchesItem: dbRowMatchesItem,
  dbCompareRows: dbCompareRows,
  dbRowsApply: dbRowsApply,
  renderDatabasePage: renderDatabasePage,
  renderDbTable: renderDbTable,
  renderDbBoard: renderDbBoard,
  renderDbGallery: renderDbGallery,
  renderDbTimeline: renderDbTimeline,
  renderDbTimelineList: renderDbTimelineList,
  renderDbChart: renderDbChart,
  mkStarsHtml: mkStarsHtml,
  isStarField: isStarField,
  dbBoardCardHtml: dbBoardCardHtml,
  dbInferSelectField: dbInferSelectField,
  dbBoardGroupDef: dbBoardGroupDef,
  dbUserSortActive: dbUserSortActive,

  /**
  * M1-1 · 批次 W · 多维表格配置面板与浮层交互全局挂载
  * 契约对齐：产品件 v2.0-t3.html:11644-12877 / 13578-13800 同作用域函数名。
  */
  injectPanelDeps: injectPanelDeps,
  DB_SF_OPS: DB_SF_OPS,
  dbSfAutoClose: dbSfAutoClose,
  dbSfCloseAll: dbSfCloseAll,
  openDbFilterPanel: openDbFilterPanel,
  openDbSortPanel: openDbSortPanel,
  openDbSummaryPanel: openDbSummaryPanel,
  openDbHiddenFieldsPanel: openDbHiddenFieldsPanel,
  dbTableList: dbTableList,
  dbFieldSummable: dbFieldSummable,
  dbSummaryMode: dbSummaryMode,
  dbSummaryOf: dbSummaryOf,
  dbFmtSummary: dbFmtSummary,
  getOptColors: getOptColors,
  ntAutoClose: ntAutoClose,
  openFieldTypeMenu: openFieldTypeMenu,
  openFieldConfigPop: openFieldConfigPop,
  openDbFieldConfigDialog: openDbFieldConfigDialog,
  dbLinkTitle: dbLinkTitle,
  openLinkPicker: openLinkPicker,
  openMultiSelectPicker: openMultiSelectPicker,
  attachPanScroll: attachPanScroll,
  closePicker: closePicker,
  bindPickerAutoClose: bindPickerAutoClose,
  openTimePicker: openTimePicker,
  openRegionPicker: openRegionPicker,
  showDbRowContext: showDbRowContext,
  _panCleanups: _panCleanups,

  /**
  * M1-1 · 批次 Y/Z · 思维导图 + 知识图谱全局挂载
  * 契约对齐：产品件 v2.0-t3.html:15753 / 15756（renderMindmap(curDoc) / renderGraph()）、
  * 14539-14540 的 JU.register('views', {...})，以及 14941-14945 的 getGraphWorker 单例入口。
  */
  injectMindmapDeps: injectMindmapDeps,
  MM_NW: MM_NW,
  MM_NH: MM_NH,
  MM_GX: MM_GX,
  MM_GY: MM_GY,
  mmLayoutConsts: mmLayoutConsts,
  mmNodeText: mmNodeText,
  mmNodeHeight: mmNodeHeight,
  layoutMindmap: layoutMindmap,
  juBorderAnchor: juBorderAnchor,
  renderMindmap: renderMindmap,
  downloadMindmapSvg: downloadMindmapSvg,
  injectGraphDeps: injectGraphDeps,
  GRAPH_WORKER_SRC: GRAPH_WORKER_SRC,
  GraphLayoutWorker: GraphLayoutWorker,
  GraphRenderer: GraphRenderer,
  getGraphWorker: getGraphWorker,
  renderGraph: renderGraph,
  runSyncGraphLayout: runSyncGraphLayout,

  /**
  * M1-1 · 批次 AB/AC · 幻灯片 / 演示 / 列表类视图全局挂载
  * 契约对齐：产品件 v2.0-t3.html:15750-15759 的 JU.register('views', {...}) 同名端口
  * （renderStarredView / renderTemplatesView / renderTrashView / renderPresentation /
  * renderSlidesView / renderTagsView / renderTagNodes / renderHistoryView），
  * 以及 15814 / 15818 的 `get JU_SLIDES()` / `get initJuSlides()` 同作用域函数名。
  */
  JU_SLIDES: JU_SLIDES,
  initJuSlides: initJuSlides,
  injectJuSlidesDeps: injectJuSlidesDeps,
  renderSlidesView: renderSlidesView,
  injectPresentationDeps: injectPresentationDeps,
  treeRowVisible: treeRowVisible,
  renderPresentation: renderPresentation,
  injectListsDeps: injectListsDeps,
  renderTitleWithBack: renderTitleWithBack,
  _trashBatchRestore: _trashBatchRestore,
  _trashBatchPurge: _trashBatchPurge,
  renderStarredView: renderStarredView,
  renderTemplatesView: renderTemplatesView,
  renderTrashView: renderTrashView,
  renderTagsView: renderTagsView,
  renderTagNodes: renderTagNodes,
  renderHistoryView: renderHistoryView,

  /**
  * M1-1c · 富文本适配层全局挂载
  * 契约对齐：产品件 v2.0-t3.html:1760-1912（白名单常量 / 清洗 / execCommand 包装 / 粘贴解析）。
  */
  SAFE_TAGS: SAFE_TAGS,
  SAFE_ATTRS: SAFE_ATTRS,
  CSS_WHITELIST: CSS_WHITELIST,
  sanitizeStyle: sanitizeStyle,
  sanitizeHtml: sanitizeHtml,
  safeExec: safeExec,
  parsePasteLines: parsePasteLines,
  trimPasteHtml: trimPasteHtml,
  injectRichtextDeps: injectRichtextDeps,
  /* 选区样式引擎（颜色 / 背景 / 字号 / 加粗的纯 DOM 写入与幂等切换；详见 core/richtext） */
  applyCustomStyleToSelection: applyCustomStyleToSelection,
  toggleCustomStyleToSelection: toggleCustomStyleToSelection,
  /* 【三项合并】color / background-color / font-size 单 span 合并写入 + typing style + 结构归一 */
  applyInlineStyle: applyInlineStyleEngine,
  clearInlineStyleFromSelection: clearInlineStyleFromSelection,
  /* 【P0 诊断】applyInlineStyle 入口选区快照（`[JU-RT]` 控制台日志的同源实现） */
  logInlineStyleEntry: logInlineStyleEntry,
  /* 【P0 实机选区丢失】格式写入期间的重绘拦截标记：renderMain 见 true 且非强制重建时
     跳过 #content 重建（只同步顶栏 / 右栏），阻断 blur → render → 选区失效的循环。
     同时暴露 begin/end，供回归探针在夹具里显式验证拦截生效。 */
  isEditorFormatting: isEditorFormatting,
  beginEditorFormatting: beginEditorFormatting,
  endEditorFormatting: endEditorFormatting,
  /* 【P0 选区锚点】宿主选择器 + 纯文本偏移：正文重渲染后仍能找回同一段选区
     （实机「点完颜色再点背景 / 字号失效」的回归断言入口） */
  captureSelectionAnchor: captureSelectionAnchor,
  rangeFromSelectionAnchor: rangeFromSelectionAnchor,
  normalizeInlineStyles: normalizeInlineStyles,
  /* 【D-02】颜色归一：产物内不再出现旧内核无法解析的 `color(srgb …)` */
  COLOR_STYLE_PROPS: COLOR_STYLE_PROPS,
  normalizeColorValue: normalizeColorValue,
  normalizeInlineDeclValue: normalizeInlineDeclValue,
  getTypingInlineStyle: getTypingInlineStyle,
  initRichtextStyleMode: initRichtextStyleMode,

  /**
  * M1-1 · 批次 AH · 富文本编辑器全局挂载
  * 契约对齐：产品件 v2.0-t3.html:17203-17722（颜色/字号选择器 + 格式刷 + 批量格式化）。
  */
  injectEditorDeps: injectEditorDeps,
  bindPainterListeners: bindPainterListeners,
  openColorPicker: openColorPicker,
  closeColorPicker: closeColorPicker,
  openSizePicker: openSizePicker,
  closeSizePicker: closeSizePicker,
  applyFontSize: applyFontSize,
  clearFontSizeFromSelection: clearFontSizeFromSelection,
  clearBgFromSelection: clearBgFromSelection,
  clearColorFromSelection: clearColorFromSelection,
  formatActiveState: formatActiveState,
  fontSizePxFor: fontSizePxFor,
  currentBaseFontPx: currentBaseFontPx,
  FONT_SIZE_RATIOS: FONT_SIZE_RATIOS,
  _fmtPainter: _fmtPainter,
  selectionKey: selectionKey,
  captureFormat: captureFormat,
  applyCapturedFormat: applyCapturedFormat,
  deactivatePainter: deactivatePainter,
  toggleFormatPainter: toggleFormatPainter,
  toggleBatchPainter: toggleBatchPainter,
  onSelectionChangeForPainter: onSelectionChangeForPainter,
  onKeyForPainter: onKeyForPainter,
  batchFormatHtml: batchFormatHtml,
  normalizeFormatHtml: normalizeFormatHtml,
  captureFormatFromHtml: captureFormatFromHtml,
  applyFormatToHtml: applyFormatToHtml,

  /**
  * M1-1 · 批次 AI/AJ · 主渲染器 / 启动引导全局挂载
  * 契约对齐：产品件 v2.0-t3.html:15646-15798（renderMain）与 16933-16979 / 22775-22792（boot 入口）。
  */
  bindRenderMainDeps: bindRenderMainDeps,
  renderMain: renderMain,
  _computeViewKey: _computeViewKey,
  injectBootDeps: injectBootDeps,
  boot: boot,
  start: start,
  bindReminder: bindReminder,
  initReminder: initReminder,
  initPomo: initPomo,
  initFloatCalDrag: initFloatCalDrag,
  initSettingsDrag: initSettingsDrag,
  bindGlobalEvents: bindGlobalEvents,
  lifecycle: lifecycle,
  registry: registry,

  /**
  * M1-1 · 批次 AE/AF · 核心数据操作与导入导出全局挂载
  * 契约对齐：产品件 v2.0-t3.html:22781 的 `_win.JU.actions=actions;`，以及 5532-5954（Actions 区）/
  * 18973-19995（IO 区）/ 22393-22400（readFileArrayBuffer）同作用域函数名。
  */
  _nowSeq: _nowSeq,
  addNodeTo: addNodeTo,
  actions: actions,
  injectActionsDeps: injectActionsDeps,
  download: download,
  toMarkdown: toMarkdown,
  toOpml: toOpml,
  toHtml: toHtml,
  docToXls: docToXls,
  docToExcel: docToExcel,
  outlineToIcs: outlineToIcs,
  /* 批次 CX · 分片导出端口（大库让出主线程）+ 规模判定 + 全量备份 */
  outlineToIcsAsync: outlineToIcsAsync,
  toMarkdownAsync: toMarkdownAsync,
  exportMarkdown: exportMarkdown,
  exportFullBackup: exportFullBackup,
  isLargeLibrary: isLargeLibrary,
  nodeCount: nodeCount,
  l7Yield: l7Yield,
  BIG_LIB_NODE_THRESHOLD: BIG_LIB_NODE_THRESHOLD,
  NODE_CHUNK: NODE_CHUNK,
  doDownload: doDownload,
  exportICS: exportICS,
  /* 导出目标统一解析（doDownload 使用） */
  resolveExportDoc: resolveExportDoc,
  /* Track B · M0-15 · 云端同步：Pro 阈值拦截在 core/persist 内部完成，UI 只做转发 */
  syncToCloud: syncToCloud,
  syncFromCloud: syncFromCloud,
  isCloudSyncAllowed: isCloudSyncAllowed,
  isCloudSyncEnabled: isCloudSyncEnabled,
  SYNC_ENABLED: SYNC_ENABLED,
  SYNC_PUSH_URL: SYNC_PUSH_URL,
  SYNC_PULL_URL: SYNC_PULL_URL,
  SYNC_PRO_GATE_MESSAGE: SYNC_PRO_GATE_MESSAGE,
  injectExportDeps: injectExportDeps,
  handleImportFiles: handleImportFiles,
  openImportDialog: openImportDialog,
  injectImportDeps: injectImportDeps,
  readFile: readFile,
  readFileArrayBuffer: readFileArrayBuffer,
  readFileDataURL: readFileDataURL,
  importOutline: importOutline,
  importOpml: importOpml,
  importHtml: importHtml,
  importICS: importICS,
  importDocx: importDocx,
  stripDangerKeys: stripDangerKeys,
  validateImportedTree: validateImportedTree,
});

/* M1-3 · 持久化底座接通（幂等）：装载 state、建立 BroadcastChannel / storage 监听并首次落盘。 */
initPersist();
start();

/* ============================================================
   fix7 · 字数统计引擎装配（token 增量 + 退出校准 + 节流落盘）
   ------------------------------------------------------------
   ① 装配端口：getState / commit / scheduleNotify / schedulePersist
      （统计改动走 commit({silent,light}) ⇒ 300ms 写合并，不逐键写盘）；
   ② 启动优先校准：上一轮 pagehide 没来得及结算会留下 pendingCalibration，
      此处立即以「当日基线快照 vs 当前正文」重算并**覆盖**当日桶；
   ③ 退出校准：pagehide 结算待处理批次；确实来不及则置 pendingCalibration，
      由下一次启动的 ② 接续 —— 保证「刷新重开 stats 自洽、无残留标记」。
   ============================================================ */
try {
  charstats.injectCharStatsDeps({
    getState,
    commit: persistCommit,
    scheduleNotify,
    schedulePersist,
  });
  const _calibrated = charstats.runStartupCalibrationIfPending();
  if (_calibrated) console.info('[JU] charStats 启动校准已执行（pendingCalibration 已清除）');
  window.addEventListener('pagehide', () => { try { charstats.flushOnExit(); } catch (e) { console.warn('[JU] charStats flushOnExit failed', e); } });
  window.addEventListener('beforeunload', () => { try { charstats.flushOnExit(); } catch (e) { console.warn('[JU] charStats flushOnExit failed', e); } });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    /* 进后台：先结算批次；结算不了就标记待校准（与退出同一口径） */
    try { if (!charstats.flushPending()) { /* 无待处理批次：无需标记 */ } } catch (e) { console.warn('[JU] charStats flushPending failed', e); }
  });
} catch (e) {
  console.warn('[JU] charStats 引擎装配失败', e);
}

/* ============================================================
   虚拟滚动 · 操作完整性拦截（2026-10-26）
   ------------------------------------------------------------
   契约：
     - Ctrl+F（查找）：当前为虚拟滚动时临时全量渲染，4s 后自动恢复；
     - 复制全文（Ctrl+A 后 1s 内，或选区覆盖整篇文档）：临时全量渲染后写入全文纯文本，
       复制结束后立即恢复；
     - 打印（beforeprint）：当前为虚拟滚动时临时全量渲染，afterprint 恢复；
     - 非虚拟滚动状态一律完全放行（零副作用）。
   ============================================================ */

/** 当前文档正文纯文本（复制全文用；剔除标签、按行拼接）。 */
function currentDocPlainText(): string {
  const doc = session.getCurrentDoc();
  if (!doc) return '';
  const lines: string[] = [];
  const title = String(doc.text || '').replace(/<[^>]*>/g, '').trim();
  if (title) lines.push(title);
  const seen = new Set<any>();
  const walk = (id: any): void => {
    if (id == null || seen.has(id)) return;
    seen.add(id);
    const n = nodeById(id);
    if (!n || n._deleted) return;
    lines.push(String(n.text || '').replace(/<[^>]*>/g, ''));
    (n.children || []).forEach(walk);
  };
  (doc.children || []).forEach(walk);
  return lines.join('\n');
}

/** 安装虚拟滚动操作拦截（幂等；启动完成后调用一次）。 */
function installVirtualScrollInterceptors(): void {
  const w = window as any;
  if (w.__juVsInterceptorsBound) return;
  w.__juVsInterceptorsBound = true;

  document.addEventListener('keydown', (ev: any) => {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    const key = String(ev.key || '').toLowerCase();
    if (key === 'f') beginInterception('find');
    else if (key === 'a') w.__juVsSelectAllAt = Date.now();
  }, true);

  document.addEventListener('copy', (ev: any) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    if (!document.querySelector('.outline')) return;
    const recentSelectAll = Date.now() - Number(w.__juVsSelectAllAt || 0) < 1000;
    const fullText = currentDocPlainText();
    const coversDoc = !!fullText && String(sel.toString() || '').length >= Math.max(1, fullText.length - 2);
    if (!recentSelectAll && !coversDoc) return;
    if (!beginInterception('copy')) return;
    try {
      if (ev.clipboardData) {
        ev.preventDefault();
        ev.clipboardData.setData('text/plain', fullText);
      }
    } catch (e) { console.warn('[JU] copy-all intercept failed', e); }
    setTimeout(() => endInterception('copy'), 0);
  }, true);

  window.addEventListener('beforeprint', () => {
    if (isVirtualActive()) beginInterception('print');
  });
  window.addEventListener('afterprint', () => { endInterception('print'); });
}

installVirtualScrollInterceptors();

/* 诊断 / 测试入口：与事件监听共用同一套策略函数（不做任何旁路实现）。 */
(window as any).__juVsMetrics = getVsMetrics;
(window.JU as any).__juVsMetrics = getVsMetrics;
(window.JU as any).__juVsShouldUse = (): boolean => vsShouldUseVirtual(session.getCurrentDoc());
(window.JU as any).__juVsNoteScrollSample = (ms: number): boolean => noteFrameDelta(ms);
(window.JU as any).__juVsIntercept = (kind: string): boolean =>
  beginInterception(kind === 'copy' || kind === 'print' ? kind : 'find');
(window.JU as any).__juVsResume = (): void => endInterception();
(window.JU as any).__juVsForceJank = (): void => { forceJankOn(); session.forceRender(); };
(window.JU as any).__juVsReset = (): void => resetVirtualScrollState();
(window.JU as any).__juVsThresholds = {
  nodes: VS_NODE_THRESHOLD,
  deviceMemoryGB: VS_MEMORY_THRESHOLD,
  jankFrameMs: VS_JANK_FRAME_MS,
  jankStreak: VS_JANK_STREAK,
};
/* 【D-01】持久化后端可观测面：IDB 镜像是否真的在写、库名列表、以及读回端口。
   验收断言（tests 或 90过程材料/tmp_compare/fix/*.log）读取本对象，不旁路内部实现。 */
(window.JU as any).persistence = {
  idbSupported: isIdbSupported,
  idbStatus: getIdbMirrorStatus,
  idbDatabases: idbListDatabases,
  idbReadState: idbReadState,
};
/* 【D-04】只读虚拟滚动策略（`#setVirtualScrollOff` 按产品决策已下线，验收改用本入口）。
   返回 { enabled, overscan, thresholds }；不改变任何状态，可反复调用。 */
(window.JU as any).getVirtualScrollPolicy = getVirtualScrollPolicy;

/**
 * P3 · 启动后防呆（单点执行，失败不阻断启动）
 *
 * boot() 为 async：首次 DOM 渲染在 microtask 之后完成，故在 0ms / 400ms / 1500ms 三个时点各做一次
 * 幂等自检（`#sidebarLeft` 无导航项 / `#content` 仅剩「请先选择文档」时强制重渲染并告警）。
 * 自检本身幂等且只读，重复执行无副作用。
 */
for (const _delay of [0, 400, 1500]) {
  setTimeout(() => { try { session.assertUiRendered(); } catch (e) { console.warn('[JU] assertUiRendered failed', e); } }, _delay);
}

/**
 * Track B · 设置面板独立挂载（许可证激活 + 本地崩溃日志导出 + 云端同步）。
 *
 * boot 内的 UI 绑定串在迁移骨架 DOM 上可能因前置绑定（顶栏 / 右侧栏）抛错而中断
 * （实测：`bindRightSidebar` 在骨架 DOM 上抛错后，整串 UI 绑定以
 *  `[JU] ui bind failed (skeleton DOM)` 告警收尾，`deps.bindSettings()` 不再执行），
 * 故在 DOMContentLoaded 后单独补挂一次。各绑定均为幂等实现：
 * 重复调用只补一次行、只重绑一次处理器，不会与 boot 内的 `bindSettings` 产生重复行。
 */
function mountSettingsPanel(): void {
  try { bindSettingsPanel(); } catch (e) { console.warn('[JU] settings panel toggle mount failed', e); }
  /* 第九轮 fix9：面板级挂载同样补绑（boot 内 bindSettings 可能因前置绑定抛错而中断） */
  try { bindSettingsRows(); } catch (e) { console.warn('[JU] settings rows bind failed', e); }
  try { bindLicenseActivation(); } catch (e) { console.warn('[JU] license activation mount failed', e); }
  try { bindCrashLogRow(); } catch (e) { console.warn('[JU] crash log row mount failed', e); }
  /* Track B · M0-15：云端同步（Pro）设置项 */
  try { bindPublishTools(); } catch (e) { console.warn('[JU] publish tools mount failed', e); }
  try { bindCrashLogExport(); } catch (e) { console.warn('[JU] crash log export mount failed', e); }
  /* 区块四「帮助 → 查看手册」：帮助手册弹窗 */
  try { bindManualModal(); } catch (e) { console.warn('[JU] manual modal mount failed', e); }
}
if (document.readyState === 'loading' || document.readyState === 'interactive') {
  document.addEventListener('DOMContentLoaded', mountSettingsPanel, { once: true });
} else {
  mountSettingsPanel();
}

export {
  registry,
  lifecycle,
  utils,
  initStore,
  getState,
  subscribe,
  scheduleNotify,
  /* M5-2 · 按需字数统计（Worker 化）端口 */
  docWordCount,
  requestDocWordCountAsync,
  clearDocWordCountCache,
  getWordCountDiagnostics,
  disposeWordCountWorker,
  WORDCOUNT_WORKER_THRESHOLD,
  copyPlain,
  __juProduce,
  __juProduceSafe,
  toast,
  appConfirm,
  appPrompt,
  showContextMenu,
  initDragClose,
  _modalStack,
  _syncAppInert,
  _syncAppInertObserver,
  applyTheme,
  applySystemTheme,
  toggleTheme,
  openThemeSelector,
  bindThemeDeps,
  bindTopbar,
  bindMainToggles,
  bindLayoutDeps,
  bindSearchWorker,
  bindSelectionDeps,
  _mSel,
  _mSelSetOrder,
  _mSelHas,
  _sbVisibleIds,
  _mSelClear,
  _mSelSelectAll,
  _mSelClick,
  _mSelPaint,
  _mSelSelectAllCurrent,
  bindSidebarDeps,
  renderSidebar,
  renderSubDb,
  renderSubStarred,
  renderSubDocs,
  renderSubTags,
  makeSidebarRow,
  navTo,
  promptNewTag,
  renameTag,
  removeTag,
  replaceTagInHtmlTag,
  bindRightbarDeps,
  bindRightSidebar,
  updateRightSidebar,
  renderBacklinkPanel,
  outgoingLinksOf,
  backlinksOf,
  normTitle,
  findNodeByTitle,
  navigateToWikiLink,
  caretTextInfo,
  linkTitleAtPoint,
  bindFocusDeps,
  saveFocus,
  restoreFocus,
  focusNode,
  focusAfterRender,
  focusTextAfterRender,
  syncEmptyState,
  isBlurSuppressed,
  getTextOffset,
  nodePath,
  rangeFromPath,
  rangeFromTextOffset,
  editorRole,
  editorSelector,
  isEditable,
  cleanupEmptyInline,
  unwrapStylelessSpans,
  collectRangeIntersectElements,
  injectOutlineDeps,
  _outlineSel,
  renderOutlinePage,
  renderDocHeaderInline,
  renderOutlineRow,
  bindOutlineText,
  outlineVisibleSeq,
  toggleOutlineSel,
  outlineSelectRange,
  outlineBatchMove,
  outlineBatchIndent,
  outlineBatchOutdent,
  outlineBatchDelete,
  previousVisible,
  nextVisible,
  indentNode,
  outdentNode,
  moveSibling,
  bindTimepickerDeps,
  mkCalSel,
  openCalTimeModal,
  fmtHm,
  snapHalfMins,
  calMinToHm,
  clampM,
  fmtCalTime,
  LUNAR_INFO,
  LUNAR_MIN,
  LUNAR_MAX,
  leapMonth,
  leapDays,
  monthDays,
  lYearDays,
  solarToLunar,
  lunarToSolarDate,
  lunarDayStr,
  lunarMonthStr,
  ganzhiYear,
  SOLAR_FEST,
  LUNAR_FEST,
  HOLIDAY_REST,
  isRestDay,
  dayLabel,
  parseNaturalDate,
  injectCalendarDeps,
  CAL_MODULE_KEYS,
  ensureCalendarRoot,
  getCalendarRootId,
  dedupCalRoots,
  expandRecurring,
  buildCalIndex,
  buildRecurList,
  calendarTodosOnDate,
  buildYearCounts,
  invalidateCalIndex,
  invalidateCalIndexOnly,
  l7CalIndexWhenReady,
  getCalIndexCache,
  setCalIndexCache,
  getCalDataRev,
  getCalIndexFallbackAttempted,
  tgHourH,
  tgTotalH,
  cnNow,
  tgTimeY,
  tgNowY,
  tgDayNodes,
  buildTimeGrid,
  startCalTgTimer,
  clearCalTgTimer,
  getCalTgState,
  bindCalEventDrag,
  calModuleState,
  calModuleTitle,
  calModuleDayNodes,
  calModuleNoteBody,
  calModuleTodayBody,
  calModuleLogBody,
  calModuleStatsBody,
  calModuleCharsDates,
  calModuleCharsBody,
  calModuleBindDrag,
  calModuleBindResize,
  renderCalModules,
  renderCalendarPage,
  openCalNodeMenu,
  closeCalNodeMenu,
  renderCalNode,
  injectFormulaDeps,
  dbFieldName,
  dbFieldType,
  dbFieldDef,
  dbFieldVisible,
  dbResolveField,
  dbPrimaryField,
  dbRawValue,
  dbTextValue,
  dbNumValue,
  dbDateStr,
  dbFormulaEval,
  dbFormulaDisplay,
  dbFormulaToNum,
  dbFormulaToStr,
  dbFormulaTruthy,
  dbFormulaAgg,
  dbFormulaCall,
  _dbFormulaDiff,
  _FormulaParser,
  DB_AGG_FNS,
  formatTimeValue,
  injectPanelDeps,
  DB_SF_OPS,
  dbSfAutoClose,
  dbSfCloseAll,
  openDbFilterPanel,
  openDbSortPanel,
  openDbSummaryPanel,
  openDbHiddenFieldsPanel,
  dbTableList,
  dbFieldSummable,
  dbSummaryMode,
  dbSummaryOf,
  dbFmtSummary,
  getOptColors,
  ntAutoClose,
  openFieldTypeMenu,
  openFieldConfigPop,
  openDbFieldConfigDialog,
  dbLinkTitle,
  openLinkPicker,
  openMultiSelectPicker,
  attachPanScroll,
  closePicker,
  bindPickerAutoClose,
  openTimePicker,
  openRegionPicker,
  showDbRowContext,
  _panCleanups,
  injectDatabaseDeps,
  DB_VIEWS,
  _dbCellSchedule,
  _dbCellCancel,
  dbFilterRuleActive,
  dbRowMatches,
  dbFilterItemActive,
  dbRowMatchesItem,
  dbCompareRows,
  dbRowsApply,
  renderDatabasePage,
  renderDbTable,
  renderDbGallery,
  mkStarsHtml,
  isStarField,
  dbBoardCardHtml,
  dbInferSelectField,
  dbBoardGroupDef,
  renderDbBoard,
  renderDbTimelineList,
  dbUserSortActive,
  renderDbTimeline,
  renderDbChart,
  injectMindmapDeps,
  MM_NW,
  MM_NH,
  MM_GX,
  MM_GY,
  mmLayoutConsts,
  mmNodeText,
  mmNodeHeight,
  layoutMindmap,
  juBorderAnchor,
  renderMindmap,
  downloadMindmapSvg,
  injectGraphDeps,
  GRAPH_WORKER_SRC,
  getGraphWorker,
  GraphLayoutWorker,
  GraphRenderer,
  renderGraph,
  runSyncGraphLayout,
  JU_SLIDES,
  initJuSlides,
  injectJuSlidesDeps,
  renderSlidesView,
  injectPresentationDeps,
  treeRowVisible,
  renderPresentation,
  injectListsDeps,
  renderTitleWithBack,
  _trashBatchRestore,
  _trashBatchPurge,
  renderStarredView,
  renderTemplatesView,
  renderTrashView,
  renderTagsView,
  renderTagNodes,
  renderHistoryView,
  _nowSeq,
  addNodeTo,
  actions,
  injectActionsDeps,
  download,
  toMarkdown,
  toMarkdownAsync,
  toOpml,
  toHtml,
  docToXls,
  docToExcel,
  outlineToIcs,
  outlineToIcsAsync,
  doDownload,
  exportICS,
  exportFullBackup,
  exportMarkdown,
  isLargeLibrary,
  nodeCount,
  l7Yield,
  BIG_LIB_NODE_THRESHOLD,
  NODE_CHUNK,
  injectExportDeps,
  handleImportFiles,
  openImportDialog,
  injectImportDeps,
  readFile,
  readFileArrayBuffer,
  readFileDataURL,
  importOutline,
  importOpml,
  importHtml,
  importICS,
  importDocx,
  stripDangerKeys,
  validateImportedTree,
  /* 批次 AH · 富文本编辑器 */
  injectEditorDeps,
  bindPainterListeners,
  openColorPicker,
  closeColorPicker,
  openSizePicker,
  closeSizePicker,
  applyFontSize,
  clearFontSizeFromSelection,
  clearBgFromSelection,
  fontSizePxFor,
  currentBaseFontPx,
  FONT_SIZE_RATIOS,
  _fmtPainter,
  selectionKey,
  captureFormat,
  applyCapturedFormat,
  deactivatePainter,
  toggleFormatPainter,
  toggleBatchPainter,
  onSelectionChangeForPainter,
  onKeyForPainter,
  batchFormatHtml,
  normalizeFormatHtml,
  captureFormatFromHtml,
  applyFormatToHtml,
  /* 批次 AI · 主渲染器 */
  bindRenderMainDeps,
  renderMain,
  _computeViewKey,
  /* 批次 AJ · 启动引导 */
  injectBootDeps,
  boot,
  start,
  bindReminder,
  initReminder,
  initPomo,
  initFloatCalDrag,
  initSettingsDrag,
  bindGlobalEvents,
};
