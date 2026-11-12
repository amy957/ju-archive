/**
 * M1-1 · 批次 O · 右侧栏与 Wiki 链接 / 反链面板
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - bindRightSidebar ...... 16444-16617
 *   - updateRightSidebar .... 16618-16624
 *   - normTitle ............. 16629
 *   - findNodeByTitle ....... 16630-16642
 *   - navigateToWikiLink .... 16643-16652
 *   - caretTextInfo ......... 16653-16666
 *   - linkTitleAtPoint ...... 16667-16693
 *   - outgoingLinksOf ....... 16694-16706
 *   - backlinksOf ........... 16707-16733
 *   - renderBacklinkPanel ... 16734-16808
 *
 * 约束：DOM 查询串、内联样式/HTML 片段、SVG path、提示文案与 R49/FIX/批次注释逐字保留。
 *   两类纯结构调整：
 *     1) 未拆分业务符号统一走 `deps` 依赖注入容器（原直接调用改为 deps.xxx）：
 *        ui / state / N() / isFolder() / isBlankNode() / getCurrentDoc() / openNode() / actions /
 *        commit() / forceRender() / _nowSeq() / docSubtree() / findOwningTopDocId() / nodeDepth() /
 *        safeExec() / _fmtPainter / deactivatePainter() / toggleBatchPainter() / toggleFormatPainter() /
 *        openColorPicker() / _themeColor() / openSizePicker() / fontSizePxFor() / clearBgFromSelection() /
 *        applyFontSize() / undo() / redo() / batchFormatHtml() / onSelectionChangeForPainter() /
 *        onKeyForPainter() / openAddToCalendarDialog() / openAddToDbDialog() / doDownload() / doPrint() /
 *        showPrintPreview() / exportICS() / exportFullBackup() / _outlineSel。
 *     2) 非标准 DOM 成员（document.caretPositionFromPoint / caretRangeFromPoint / __fmtPainterBound）
 *        以 `as any` 访问、事件目标与 dataset 的显式元素类型（纯类型层，运行期零差异）。
 *   注：`_mSel` 自 ./selection 引入（批次 N 已提取）；`renderSidebar` 自 ./sidebar 引入（批次 N）；
 *       `toast` / `appConfirm` / `appPrompt` 自 ./common 引入；`$` / `$$` / `stripHtml` 自 ../core/utils；
 *       `WIKI_RE` 自 ../core/constants（M0-7 已提升至常量区，本文件不重复声明）。
 */
import { $, $$, stripHtml } from '../core/utils';
import { WIKI_RE } from '../core/constants';
/* 【D-07】bindClick：右栏操作按钮统一 addEventListener 绑定 */
import { toast, appConfirm, bindClick } from './common';
import { _mSel } from './selection';
import { renderSidebar } from './sidebar';
/* 【fix7 · D-12】跨行（跨 contenteditable 宿主）文本选区模型 —— 工具栏逐块套样式的唯一来源 */
import { xselActive, xselRanges, xselRangeInHost, xselRestoreNativeStart, xselCaptureNative, xselKeepAfterFormat } from './xselect';
/**
 * 选区锚点（宿主选择器 + 纯文本偏移）：正文 blur → notify → renderMain 重建
 * `#content` 后，克隆的 Range 边界节点会脱离文档；锚点仍能按 data-id 找回宿主，
 * 从而保证「颜色 → 背景 → 字号」连续三次命令都能落在同一段文字上。
 */
import {
  captureSelectionAnchor,
  rangeFromSelectionAnchor,
  richtextHostOf,
  type SelectionAnchor,
} from '../core/richtext';

/* HTML:1377 原文 const _win = (window) —— 同语义别名 */
const _win: any = window;

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export const deps: {
  /** 全局 UI 状态对象（对应产品的 `ui`） */
  ui: any;
  /** 全局数据状态（对应产品的 `state`） */
  state: any;
  N: (id: any) => any;
  isFolder: (id: any) => boolean;
  isBlankNode: (n: any) => boolean;
  getCurrentDoc: () => any;
  openNode: (id: any) => void;
  forceRender: () => void;
  commit: (fn: (s: any) => void, opts?: any) => any;
  nowSeq: () => any;
  actions: any;
  docSubtree: (id: any) => any[];
  findOwningTopDocId: (id: any, s: any) => any;
  nodeDepth: (id: any) => number;
  safeExec: (cmd: string, val?: any) => any;
  /** 格式刷状态对象（对应产品 `_fmtPainter`） */
  fmtPainter: any;
  deactivatePainter: () => void;
  toggleBatchPainter: (b: any, ids: any[]) => void;
  toggleFormatPainter: (b: any) => void;
  openColorPicker: (anchor: any, cb: (c: any) => void, cur?: any, opts?: any) => void;
  themeColor: (name: string, fallback: any) => string;
  openSizePicker: (anchor: any, cb: (v: any) => void) => void;
  fontSizePxFor: (v: any) => any;
  clearBgFromSelection: () => void;
  /** 清除选区文字颜色（独立按钮通道，不做 toggle） */
  clearColorFromSelection?: () => void;
  applyFontSize: (v: any) => void;
  /**
   * DOM Range 内联样式写入（ui/editors.applyInlineStyle）：
   * 颜色 / 背景 / 字号的主通道 —— 读取选区祖先链上已有内联格式，
   * 把「旧格式 + 新格式」合并进同一个 <span style="…"> 再包裹选区，
   * 全程不经过 execCommand，因此不会重建边界节点、不会覆盖前一步格式。
   */
  applyInlineStyle?: (prop: string, value: string, opts?: { clearSameProp?: boolean; merge?: boolean }) => boolean;
  /**
   * 选区样式写入主入口（core/richtext.applyCustomStyleToSelection）：
   * 颜色 / 背景 / 字号 / 加粗统一走它 —— Range 抽取 + 就地合并 style + 插回，
   * 彻底不经过 document.execCommand（WebView2 下该 API 已废弃，会重建 DOM 摧毁既有格式）。
   */
  applyCustomStyle?: (styleProp: string, styleValue: string) => boolean;
  /** 按钮类格式的纯 DOM 幂等切换（core/richtext.toggleCustomStyleToSelection） */
  toggleCustomStyle?: (styleProp: string, onValue: string, offValue?: string) => boolean;
  /** 读取选区当前生效样式（getComputedStyle 口径），用于色板 / 背景面板回显当前值 */
  selectionStyle?: (prop: string) => string;
  /** 把任意 CSS 值归一化成 getComputedStyle 口径（保留端口，供外部探针比对） */
  normalizeCssStyle?: (prop: string, value: string) => string;
  /** 工具栏按钮 active 状态（ui/editors.formatActiveState：getComputedStyle(selection.anchorNode) 口径） */
  formatActive?: () => any;
  undo: () => boolean;
  redo: () => boolean;
  batchFormatHtml: (html: any, cmdStr: any, val: any) => string;
  onSelectionChangeForPainter: () => void;
  onKeyForPainter: (e: KeyboardEvent) => void;
  openAddToCalendarDialog: () => void;
  openAddToDbDialog: () => void;
  doDownload: (type: any) => void;
  doPrint: () => void;
  showPrintPreview: () => void;
  exportICS: () => void;
  exportFullBackup: () => void;
  /** 大纲/通用多选集合（对应产品 `_outlineSel`） */
  outlineSel: any;
  /**
   * 大纲多选复制 / 剪切（返回处理的节点数，0 = 无多选）。
   * 由 views/outline 的真实实现经 main.ts 注入：右栏 [data-cmd="copy"|"cut"]
   * 原本只走浏览器原生 copy/cut，无文本选区时静默无动作 ⇒ 「选中多行点复制」毫无反应。
   */
  outlineCopy?: () => number;
  outlineCut?: () => number;
  outlinePaste?: (txt: string) => number;
  /**
   * 编辑器正文冲刷（把「正在编辑、尚未 blur 提交」的 innerHTML 写回 state）。
   * 撤销栈按「提交前根引用」记录，若不冲刷，格式类 execCommand 的改动不在栈里，
   * 撤销会跨过它直接回退到上一次提交（用户视角：点撤销把刚打的字一起删了）。
   */
  flushEditor?: () => void;
  /**
   * 富文本格式命令执行后的**静默**置性同步（noNotify 提交）。
   *
   * 与 `flushEditor` 的关键差异：只把编辑区 DOM 的结果写进 state（并推进撤销栈 / 落盘调度），
   * **不广播 notify、不调度渲染**。格式命令走这里，避免 renderMain 重建编辑区导致选区丢失
   * （详见 `[data-cmd]` 点击绑定处的说明）。
   */
  syncEditor?: () => void;
} = {
  ui: {},
  state: {},
  N: () => null,
  isFolder: () => false,
  isBlankNode: () => false,
  getCurrentDoc: () => null,
  openNode: () => {},
  forceRender: () => {},
  commit: () => null,
  nowSeq: () => 0,
  actions: {},
  docSubtree: () => [],
  findOwningTopDocId: () => null,
  nodeDepth: () => 0,
  safeExec: () => false,
  fmtPainter: null,
  deactivatePainter: () => {},
  toggleBatchPainter: () => {},
  toggleFormatPainter: () => {},
  openColorPicker: () => {},
  themeColor: () => '',
  openSizePicker: () => {},
  fontSizePxFor: () => null,
  clearBgFromSelection: () => {},
  clearColorFromSelection: () => {},
  applyFontSize: () => {},
  formatActive: () => null,
  undo: () => false,
  redo: () => false,
  batchFormatHtml: (html: any) => html,
  onSelectionChangeForPainter: () => {},
  onKeyForPainter: () => {},
  openAddToCalendarDialog: () => {},
  openAddToDbDialog: () => {},
  doDownload: () => {},
  doPrint: () => {},
  showPrintPreview: () => {},
  exportICS: () => {},
  exportFullBackup: () => {},
  outlineSel: {},
};

/**
 * 工具栏格式按钮 active 状态刷新。
 *
 * 判定标准是「选区锚点元素的计算样式」（ui/editors.formatActiveState），
 * **不再使用 queryCommandState** —— 该 API 在 WebView2 已废弃且对同一段文字返回
 * 不确定值：用户点第二次同色时会被判成「已激活 ⇒ 再点即取消」，于是颜色被 toggle 掉。
 * 刷新时机：selectionchange（选区 / 光标任何变化）、以及每条格式命令执行之后。
 */
export function refreshFormatButtons(): void {
  try {
    if (typeof document === 'undefined') return;
    const act: any = (typeof deps.formatActive === 'function') ? deps.formatActive() : null;
    if (!act) return;
    const map: Record<string, boolean> = {
      bold: !!act.bold,
      italic: !!act.italic,
      underline: !!act.underline,
      strike: !!act.strike,
      color: !!act.color,
      bg: !!act.bg,
      size: !!act.size,
    };
    $$('[data-cmd]').forEach((b: HTMLElement) => {
      const cmd = b.dataset.cmd as string;
      if (!(cmd in map)) return;
      b.classList.toggle('on', !!map[cmd]);
    });
  } catch (e) { console.warn('[JU] caught error', e); }
}

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function bindRightbarDeps(next: Partial<typeof deps>): void {
  Object.assign(deps, next);



}

/* ============================================================
   【选区快照 saveRange / restoreSel】—— 富文本「前一步效果失效」的正面修复
   ------------------------------------------------------------------
   现象：正文选中文字 → 点加粗（生效）→ 点颜色（选红色）/ 点字号（选大），
         第二步无效果，或第一步的加粗「消失」。
   机理：
     ① 颜色 / 字号都要先弹出浮层（.color-picker），点击浮层内的色块 / 档位会
        把焦点移出正文 contenteditable；原生 selection 随之塌陷 / 失效，
        浮层回调里的 execCommand（foreColor / hiliteColor）**无选区可作用**；
     ② 若此刻有 blur → updateText → commit → notify 的渲染调度，
        #content 会被 renderMain 重建，编辑节点被替换 ⇒ 已保存的 Range 也一并失效。
   对策（严格对齐任务口径）：
     · 在 **mousedown**（弹出面板之前）调用 `saveRange()` 克隆当前 Range；
     · 在浮层回调里**第一步** `restoreSel()`（还原 Range + 聚焦同一编辑节点），
       第二步才执行 `safeExec` / `applyFontSize`；
     · 执行后**绝不** forceRender / renderMain（本文件格式命令只走 `deps.syncEditor()`
       的 noNotify 静默提交），DOM 原地保留 ⇒ 选区不丢、前一步格式不被覆盖。
   ============================================================ */
interface SavedSel {
  /** 快照所属的正文编辑节点（`#content .text[data-id]`） */
  el: HTMLElement | null;
  /** 克隆的 Range（无文本选区时为 null，仅记住编辑节点用于恢复焦点） */
  range: Range | null;
  /** 跨重渲染可恢复的锚点（宿主 data-id + 纯文本偏移；跨行选区带两个端点） */
  anchor: SelectionAnchor | null;
}
let _savedSel: SavedSel = { el: null, range: null, anchor: null };
/**
 * 上一次「成功写入格式」之后的选区锚点。
 *
 * 【实机根因】点颜色 → 正文 blur → updateText → notify → renderMain 重建 `#content`：
 * 编辑节点被整块替换，原生选区在**下一次 mousedown 之前**就已失效，
 * 此时 `saveRange()` 拍不到任何可用选区 ⇒ 第二次点背景 / 字号时无 Range 可作用。
 * 锚点（宿主 data-id + 纯文本偏移）与 DOM 实例无关，重渲染后仍指向同一段文字，
 * 因此把它作为 `saveRange()` 的兜底来源。
 */
let _lastAnchor: SelectionAnchor | null = null;

/** 记录当前选区锚点（格式命令成功写入后调用，供下一次命令兜底恢复）。 */
function rememberSelectionAnchor(): void {
  try {
    const a = captureSelectionAnchor();
    if (a) _lastAnchor = a;
  } catch (e) {
    console.warn('[JU] caught error', e);
  }
}

/** 取最近的正文编辑节点（`#content .text[data-id]`）；非正文元素返回 null。 */
function editorAt(node: any): HTMLElement | null {
  if(!node)return null;
  const el = node.nodeType === 1 ? node : node.parentNode;
  if(!el || !el.closest)return null;
  return el.closest('#content .text[data-id]') as HTMLElement | null;
}

/**
 * 保存当前正文选区（**弹出颜色 / 字号面板之前**调用，即 [data-cmd] 的 mousedown）。
 * 返回 true = 保存到非折叠选区；false = 无选文本选区（仍记住编辑节点，供恢复焦点）。
 */
export function saveRange(): boolean {
  try{
    const s = window.getSelection();
    let el = editorAt(document.activeElement);
    const anchorNode = s && s.rangeCount ? s.anchorNode : null;
    if(!el && anchorNode)el = editorAt(anchorNode);
    /* 【跨行选区】焦点行的 `.text` 与锚点行不同：el 只能用于「恢复焦点」，
       真正的选区范围必须交给锚点（两个端点各自记录宿主 + 纯文本偏移）。 */
    let selAnchor = (s && s.rangeCount) ? captureSelectionAnchor(s.getRangeAt(0)) : null;
    /* 原生选区已随重渲染失效：回落到上一次成功写入后的锚点（同一段文字） */
    if(!selAnchor && _lastAnchor)selAnchor = _lastAnchor;
    if(!el && !selAnchor){_savedSel = { el: null, range: null, anchor: null };return false;}
    if(s && s.rangeCount && !s.isCollapsed && s.anchorNode && s.focusNode
      && el && el.contains(s.anchorNode) && el.contains(s.focusNode)){
      _savedSel = { el, range: s.getRangeAt(0).cloneRange(), anchor: selAnchor };
      return true;
    }
    _savedSel = { el, range: null, anchor: selAnchor };
    return !!selAnchor;
  }catch(e){
    console.warn('[JU] caught error', e);
    _savedSel = { el: null, range: null, anchor: null };
    return false;
  }
}

/**
 * 恢复 saveRange() 保存的选区（**浮层回调的第一步**，必须在 execCommand 之前）。
 * 依次兜底：① 聚焦并注入克隆 Range；② 克隆 Range 的边界节点已被 execCommand 拆分 / 替换
 * （startContainer 脱离文档）时，若当前原生选区仍有效则沿用；③ 否则全选该编辑节点内容，
 * 保证格式命令一定作用在同一段文字上，而不是「无选区空执行」。
 */
export function restoreSel(): boolean {
  const saved = _savedSel;
  const el = saved.el;
  try{
    const s = window.getSelection();
    if(!s)return false;
    /* ① 快照 Range 仍有效（DOM 未被重建：常见路径） */
    const r = saved.range;
    if(r && r.startContainer && r.startContainer.isConnected && r.endContainer && r.endContainer.isConnected){
      if(el && el.isConnected && document.activeElement !== el)el.focus();
      s.removeAllRanges();s.addRange(r);
      return true;
    }
    /* ② 编辑节点被重渲染替换 / Range 边界已脱离文档：按锚点（data-id + 纯文本偏移）重建。
       这是实机「点完颜色，再点背景 / 字号失效」的正面修复：blur → notify → renderMain
       重建 #content 后，克隆 Range 必然失效，只有锚点还能找回同一段文字。 */
    const anchored = rangeFromSelectionAnchor(saved.anchor);
    if(anchored){
      const sc: any = anchored.startContainer;
      const host: any = sc && sc.nodeType === 1 ? sc : (sc && sc.parentElement);
      const editable: any = host && host.closest ? host.closest('[contenteditable="true"]') : null;
      if(editable && document.activeElement !== editable)editable.focus();
      s.removeAllRanges();s.addRange(anchored);
      return true;
    }
    /* ③ 当前原生选区仍在正文编辑区内：直接沿用 */
    if(!s.isCollapsed && s.anchorNode && s.anchorNode.isConnected && richtextHostOf(s.anchorNode))return true;
    /* ④ 兜底：聚焦记忆的编辑节点。
       【关键】快照是折叠光标时（空行里先设样式、后落字）绝不能全选内容：
       一旦变成非折叠选区，applyInlineStyle 会走「写 DOM」分支而无文本可写，
       直接返回 false —— 用户看到的仍是「字号 / 颜色没生效」。 */
    if(!el || !el.isConnected)return false;
    if(document.activeElement !== el)el.focus();
    const caret = document.createRange();
    if(saved.anchor && saved.anchor.collapsed === false){
      caret.selectNodeContents(el);
    }else{
      caret.setStart(el, (el.childNodes || []).length);
      caret.collapse(true);
    }
    s.removeAllRanges();s.addRange(caret);
    return true;
  }catch(e){
    console.warn('[JU] caught error', e);
    return false;
  }
}

/** 清空选区快照（浮层关闭 / 格式命令执行完毕后调用）。 */
export function clearSavedRange(): void { _savedSel = { el: null, range: null, anchor: null }; }

/* ============================================================
   右侧栏
   ============================================================ */
export function bindRightSidebar(): void {
  try{if(_win.JU_MODULES&&_win.JU_MODULES.bindContextMenus)_win.JU_MODULES.bindContextMenus();}catch(e){console.warn('[JU] caught error',e);}
  /* 【已删除】safeExec('styleWithCSS', true)：execCommand 系列在 WebView2 中已废弃，
     颜色 / 背景 / 字号改由 core/richtext 的纯 DOM 引擎写入，不再需要该前置开关。 */
  $$('[data-toggle]').forEach(el=>{el.onclick=()=>{
    const sec=el.closest('.sr-section');if(!sec)return;
    const wasCollapsed=sec.classList.contains('collapsed');
    sec.classList.toggle('collapsed');
    const sp=sec.querySelector('#srPrintPanel');
    if(sp){
      /* 【UI修复8】打印折叠头展开时仅显示面板，预览由用户显式触发；收起时恢复内容渲染 */
      if(wasCollapsed){sp.classList.add('on');}
      else{sp.classList.remove('on');if($('#content .print-preview'))deps.forceRender();}
    }
  };});
  /* 批次 CW · 骨架 DOM 保护：迁移期 `#sidebarRight` 为空容器时 `#srStars` / `#srLock` 不存在，
     原先的非空断言（`$('#srStars')!`）会抛 TypeError，使 boot 的整段 UI 绑定以
     `[JU] ui bind failed` 中断（`bindSettings` / `initPomo` 等后续绑定全部跳过）。
     此处改为「存在才绑定」，缺失即跳过——产品件 DOM 齐备时行为逐字不变。 */
  const srStars=$('#srStars');
  if(srStars)srStars.addEventListener('click',e=>{
    const s=(e.target as HTMLElement).closest('.star') as HTMLElement|null;if(!s)return;
    const level=parseInt(s.dataset.level as string);
    const doc=deps.getCurrentDoc();if(!doc)return;
    deps.actions.setStar(doc.id,doc.starred===level?0:level);
    updateRightSidebar();renderSidebar();deps.forceRender();
  });
  const srLock=$('#srLock');
  if(srLock)srLock.onclick=()=>{
    const doc=deps.getCurrentDoc();if(!doc)return;
    deps.commit((s: any)=>{const n=s.nodes[doc.id];if(!n)return;n.private=!n.private;},{snapshot:true});
    updateRightSidebar();renderSidebar();
    toast(deps.N(doc.id).private?'已标记为私密':'已标记为公开');
  };
  /**
   * [data-cmd] 命令执行入口（mousedown 与 click 两路共用，缺一不可）：
   *   · 颜色 / 背景 / 字号必须先弹浮层 ⇒ 由 mousedown 同步执行（见下方绑定）；
   *   · 其余命令（加粗 / 撤销 / 复制…）走 click，键盘 Enter / 空格激活也落在 click。
   */
  const runRightbarCmd=(b: HTMLElement): void=>{
      const cmd=b.dataset.cmd as string;
      /* 【选区快照兜底】键盘激活按钮（Enter / 空格）不产生 mousedown：
         若快照为空但当前原生选区仍有效，就在执行时补拍一次。 */
      if(!_savedSel.range)saveRange();
      /* 【fix19】跨行富文本编辑前记录「原生可见子选区」（单宿主 id + 纯文本偏移）。
         格式命令会拆/包文本节点，但纯文本长度不变 ⇒ 写完后按偏移重建，选区逐字不变。 */
      const _xselSnap=xselCaptureNative();
      if(cmd!=='painter'&&deps.fmtPainter&&deps.fmtPainter.active)deps.deactivatePainter(); /* 执行其他编辑命令时取消格式刷 */
      /* R49 批量格式化：无文本选区且存在多选节点（大纲 _outlineSel / 通用 _mSel）时，
         粗体 / 斜体 / 下划线 / 删除线 / 背景色 / 文字色 / 字号批量写入每个选中节点的 text；
         有文本选区时保持下方 execCommand 单选区路径不变。 */
      const sel=window.getSelection();
      const hasTextSelection=!!(sel&&!sel.isCollapsed&&String(sel.toString()).trim().length>0);
      const selectedIds: any[]=[];
      if(!hasTextSelection){
        if(typeof deps.outlineSel!=='undefined'&&deps.outlineSel.docId===deps.ui.currentDocId&&deps.outlineSel.ids.size>0){
          deps.outlineSel.ids.forEach((id: any)=>selectedIds.push(id));
        }else if(typeof _mSel!=='undefined'&&_mSel.ids.size>0){
          _mSel.ids.forEach(id=>selectedIds.push(id));
        }
      }
      const execBatchFormat=(cmdStr: string,val?: any)=>{
        if(typeof deps.commit!=='function'||!selectedIds.length)return;
        deps.commit((s: any)=>{
          selectedIds.forEach(id=>{
            const n=s.nodes[id];
            if(!n)return;
            /* 批量格式化统一走 HTML 字符串级管线：先按格式类型清除原有内联样式 / 格式标签，
               再包裹新标签，反复更换颜色 / 背景 / 字号不会层层嵌套导致失效 */
            n.text=deps.batchFormatHtml(n.text||'',cmdStr,val);
            n.updatedAt=(typeof deps.nowSeq==='function')?deps.nowSeq():Date.now();
          });
        },{snapshot:true,dirtyText:true,dirtyDocs:null});
        if(typeof deps.forceRender==='function')deps.forceRender();
      };
      if(selectedIds.length>0){
        /* 多选节点状态下格式刷：首次点击拾取第一个选中节点的格式（batchMode），
           再次点击把格式批量应用到当前全部选中节点并清除格式刷状态 */
        if(cmd==='painter'){deps.toggleBatchPainter(b,selectedIds);return;}
        const batchMap: Record<string,string>={bold:'bold',italic:'italic',underline:'underline',strike:'strike'};
        if(batchMap[cmd]){execBatchFormat(batchMap[cmd]);return;}
        if(cmd==='bg'){
          /* 【已删除】document.queryCommandValue('hiliteColor')：同为废弃 API。
             当前生效背景走 getComputedStyle 口径（deps.selectionStyle）。 */
          const curRaw=(typeof deps.selectionStyle==='function')?deps.selectionStyle('background-color'):'';
          const cur=(curRaw&&curRaw!=='transparent'&&curRaw!=='rgba(0, 0, 0, 0)')?curRaw:'transparent';
          deps.openColorPicker(b,(c)=>{execBatchFormat('bg',c==='transparent'?'transparent':c);},cur,{transparent:true});
          return;
        }
        if(cmd==='color'){
          /* 【已删除】document.queryCommandValue('foreColor')：改为读取选区实际颜色 */
          const cur=((typeof deps.selectionStyle==='function')?deps.selectionStyle('color'):'')||deps.themeColor('--editor-fg','');
          deps.openColorPicker(b,(c)=>execBatchFormat('color',c),cur);
          return;
        }
        if(cmd==='size'){
          /* 面板回调已是 px 字符串（`'24px'`），不再经 1–7 档位号换算 */
          deps.openSizePicker(b,(v)=>{
            const px=parseFloat(String(v==null?'':v).replace(/px$/i,''));
            if(px>0)execBatchFormat('fontSize',Number(px.toFixed(1))+'px');
          });
          return;
        }
      }
      const firstText=$('#content .text[data-id]');
      if(firstText){const ae=document.activeElement;if(!ae||!ae.closest||!ae.closest('#content'))firstText.focus();}
      /* 【已删除】deps.safeExec('styleWithCSS', true)：execCommand 前置开关随样式命令一并废弃。 */
      /**
       * 【格式命令 · 零重渲染约束】
       * DOM 改完**禁止**任何全局重渲染（renderMain / forceRender / 渲染调度）：
       *   旧实现 flushEditor → actions.updateText → commit → scheduleNotify，
       *   boot 的 subscribe → scheduleRender 会在下一帧重建整个 #content，
       *   正在编辑的 contenteditable 被替换 ⇒ 选区 / 光标瞬间丢失，
       *   第二次点加粗或换色时无 Range 可用，表现为「前一步刚做，下一步没效果」。
       * 现统一走 deps.syncEditor()：noNotify 静默把 DOM 结果写回 state ——
       *   · 保留撤销粒度（格式前后各一次快照，撤销只回退格式不吞文字）；
       *   · 不广播 notify、不调度渲染，DOM 与选区原地保留；
       *   · 侧栏计数 / 标签统计由 blur / input 通道自然收敛。
       */
      const sync=()=>{try{if(typeof deps.syncEditor==='function')deps.syncEditor();}catch(e){console.warn('[JU] caught error',e);}};
      /**
       * 【颜色 / 背景 / 字号 / 加粗 · 纯 DOM 合并管线】
       * 统一调用 core/richtext.applyCustomStyleToSelection：
       *   ① 颜色 / 字号浮层的点击会让原生选区失效，回调第一步 restoreSel() 还原克隆 Range；
       *   ② 引擎用 range.extractContents() 抽出选中内容；
       *   ③ 逐节点 `el.style[styleProp] = styleValue` 就地合并 ——
       *      读取同一元素的既有 style 后只覆盖同类声明，加粗 / 颜色 / 字号互不覆盖；
       *   ④ range.insertNode 插回，并把选区重新框在新内容上，下一次命令仍有有效 Range。
       * 全程不经过 execCommand，也不触发任何全局重绘。
       */
      const writeStyle=(styleProp:string,val:string):boolean=>{
        /* 颜色 / 背景 / 字号三条命令的唯一通道：core/richtext.applyInlineStyle
           （读三项 computed 值 → 单 span 合并 → 只覆盖本次那一项 → 结构归一）。 */
        if(typeof deps.applyInlineStyle==='function')return deps.applyInlineStyle(styleProp,val);
        if(typeof deps.applyCustomStyle==='function')return deps.applyCustomStyle(styleProp,val);
        toast('当前环境不支持写入格式');
        return false;
      };
      /* 【fix7 · D-12】跨行选区逐块写入：Blink 把原生 Selection 钳在单个编辑宿主内
         （实测 fix7/richtext_capability.log：裸 DOM、零监听、克隆体三种对照均 covered=1），
         因此跨行时不能指望「一条 Range 打天下」——按选区模型逐块取块内 Range，
         复用同一写入引擎 applyInlineStyle，每块各自 commitInlineStyle，最后把原生选区还原到首段。 */
      const applyAcrossXSel=(styleProp:string,val:string):boolean=>{
        const rs=xselRanges();
        if(!rs.length)return false;
        const s=window.getSelection();
        let ok=false;
        rs.forEach((r)=>{
          const rg=xselRangeInHost(r.id,r.from,r.to);
          if(!rg||!s)return;
          s.removeAllRanges();s.addRange(rg);
          if(writeStyle(styleProp,val))ok=true;
        });
        xselRestoreNativeStart();
        sync();
        return ok;
      };
      /* 【fix39】下划线 / 删除线共用 text-decoration-line：按词元增删交由 core/richtext 合并，
         `underline` = 增、`-line-through` = 删，禁止把整条属性写死成自己那一项。 */
      /**
       * 【fix37-2 / fix38-2】跨行 toggle 判据：遍历模型的**每一段**，段内按文档顺序取
       * 前 XSEL_FMT_SCAN 颗非空文本节点，只要有一处选中文字处于激活态即返回 true
       * （⇒ 本次执行取消）。首行半选 / 首行为空 / 起点落在文本节点末尾都不再导致误判。
       * 旧实现只读「首段起点」的 computed 值：首行无格式时 deepElementAtRangeStart
       * 取到宿主（继承值 normal）⇒ 误判 false ⇒ 再点一次仍写 bold。
       * 叠加加粗 + 斜体后同样逐节点判定：只有真正被取消的那一项会命中。
       */
      const XSEL_FMT_SCAN=64;
      const _computedProp=(el:any,prop:string):string=>{
        try{
          const cs:any=getComputedStyle(el);
          const v=prop==='font-weight'?cs.fontWeight:prop==='font-style'?cs.fontStyle:prop==='text-decoration-line'?cs.textDecorationLine:prop==='text-decoration'?cs.textDecoration:(cs as any)[prop];
          return String(v||'').trim().toLowerCase();
        }catch(e){console.warn('[JU] caught error',e);return '';}
      };
      const _propOn=(el:any,prop:string,token?:string):boolean=>{
        const v=_computedProp(el,prop);
        if(!v)return false;
        if(prop==='font-weight')return v==='bold'||v==='bolder'||parseInt(v,10)>=600;
        if(prop==='font-style')return v.indexOf('italic')>=0;
        /* 【fix39】同一属性承载多个修饰词元：给了词元只认该词元（有下划线不等于已有删除线） */
        if(prop==='text-decoration-line'||prop==='text-decoration')return token?(' '+v+' ').indexOf(' '+token+' ')>=0:v!=='none';
        return true;
      };
      const xselFmtOn=(prop:string,token?:string):boolean=>{
        const rs=xselRanges();
        for(let i=0;i<rs.length;i++){
          const rg=xselRangeInHost(rs[i].id,rs[i].from,rs[i].to);
          if(!rg)continue;
          const c:any=rg.startContainer;
          const seed:any=(c&&c.nodeType===1)?c:(c?c.parentElement:null);
          const host:any=(seed&&seed.closest)?seed.closest('[contenteditable="true"]'):null;
          if(!host)continue;
          /* 4 = NodeFilter.SHOW_TEXT（不依赖全局常量，旧内核同样可用） */
          const walker=document.createTreeWalker(host,4,null);
          let n:any=walker.nextNode();
          let seen=0;
          while(n&&seen<XSEL_FMT_SCAN){
            const t:any=n;
            let hit=false;
            try{hit=rg.intersectsNode(t);}catch(e){hit=false;}
            n=walker.nextNode();
            if(!hit||!String(t.nodeValue||'').trim())continue;
            seen++;
            if(_propOn(t.parentElement,prop,token))return true;
          }
        }
        return false;
      };
      /**
       * 按钮类格式（加粗 / 斜体 / 下划线 / 删除线）：纯 DOM 幂等切换。
       * 已生效 → 写中性值（font-weight:normal / text-decoration:none，并把 <b>/<i>/<u>/<s>
       * 语义标签降级成 span）；否则写目标值。与颜色 / 字号共用同一套「提取-合并-插回」管线。
       */
      const toggleFmt=(prop:string,onVal:string,offVal:string,decoToken?:string):void=>{
        /* 【fix7 · D-12】跨行选区：逐块写入，方向按「首段是否已生效」判定（fix37-1 补）：
           已生效 ⇒ 每一块都写关闭值（中性值 + 同类语义标签拆除），与单行同样「再点一次整体取消」，
           不再出现「只取消首行、其余行仍加粗」。 */
        /* 【fix19】写完后保留跨行模型（不清空 overlay），并按 _xselSnap 还原原生选区 ⇒ 选区保持不变。 */
        if(xselActive()){
          applyAcrossXSel(prop,xselFmtOn(prop,decoToken)?offVal:onVal);
          xselKeepAfterFormat(_xselSnap);sync();rememberSelectionAnchor();clearSavedRange();refreshFormatButtons();return;
        }
        restoreSel();sync();
        if(typeof deps.toggleCustomStyle==='function')deps.toggleCustomStyle(prop,onVal,offVal);
        else writeStyle(prop,onVal);
        /* 写入后记住锚点：下一次命令即便赶上重渲染也能落回同一段文字 */
        sync();rememberSelectionAnchor();clearSavedRange();
        refreshFormatButtons();
      };
      if(cmd==='bold')toggleFmt('font-weight','bold','normal');
      else if(cmd==='italic')toggleFmt('font-style','italic','normal');
      else if(cmd==='underline')toggleFmt('text-decoration-line','underline','-underline','underline');
      else if(cmd==='strike')toggleFmt('text-decoration-line','line-through','-line-through','line-through');
      else if(cmd==='bg'){
        const curRaw=(typeof deps.selectionStyle==='function')?deps.selectionStyle('background-color'):'';
        const cur=(curRaw&&curRaw!=='transparent'&&curRaw!=='rgba(0, 0, 0, 0)')?curRaw:'transparent';
        /* mousedown 已 saveRange()；点击色块必让原生选区失效，回调第一步必须 restoreSel() */
        deps.openColorPicker(b,(c)=>{
          if(xselActive()){
            applyAcrossXSel('background-color',c==='transparent'?'transparent':c);
            xselKeepAfterFormat(_xselSnap);sync();rememberSelectionAnchor();clearSavedRange();refreshFormatButtons();return;
          }
          restoreSel();sync();
          /* 同值点击不 toggle；清除走面板里的独立「透明」按钮 */
          if(c==='transparent')deps.clearBgFromSelection();
          else writeStyle('background-color',c);
          sync();rememberSelectionAnchor();clearSavedRange();
          refreshFormatButtons();
        },cur,{transparent:true});
      }
      else if(cmd==='color'){
        const cur=((typeof deps.selectionStyle==='function')?deps.selectionStyle('color'):'')||deps.themeColor('--editor-fg','');
        deps.openColorPicker(b,(c)=>{
          if(xselActive()){
            applyAcrossXSel('color',c);
            xselKeepAfterFormat(_xselSnap);sync();rememberSelectionAnchor();clearSavedRange();refreshFormatButtons();return;
          }
          restoreSel();sync();
          /* 同值点击不 toggle；清除走面板里的独立「默认」按钮（写入 inherit = 摘声明） */
          if(c==='inherit'){
            if(typeof deps.clearColorFromSelection==='function')deps.clearColorFromSelection();
            else writeStyle('color','inherit');
          }else{
            writeStyle('color',c);
          }
          sync();rememberSelectionAnchor();clearSavedRange();
          refreshFormatButtons();
        },cur,{clear:true});
      }
      else if(cmd==='size'){
        /* 面板回传 px 字符串；applyFontSize 只接受 px（1–7 档位映射已删除） */
        deps.openSizePicker(b,(v)=>{
          if(xselActive()){
            applyAcrossXSel('font-size',String(v));
            xselKeepAfterFormat(_xselSnap);sync();rememberSelectionAnchor();clearSavedRange();refreshFormatButtons();return;
          }
          restoreSel();sync();deps.applyFontSize(v);sync();rememberSelectionAnchor();clearSavedRange();refreshFormatButtons();
        });
      }
      else if(cmd==='painter')deps.toggleFormatPainter(b);
      else if(cmd==='undo'){if(deps.undo()){deps.forceRender();toast('已撤销');}}
      else if(cmd==='redo'){if(deps.redo()){deps.forceRender();toast('已重做');}}
      else if(cmd==='copy'){
        /* 多选节点优先：无文本选区但存在多个节点选中时，写「JU-NODES:」结构化载荷 */
        if(deps.outlineSel&&deps.outlineSel.ids&&deps.outlineSel.ids.size>1&&typeof deps.outlineCopy==='function'){
          const n=deps.outlineCopy();
          if(n>0){toast('已复制 '+n+' 个节点');return;}
        }
        const sel=window.getSelection();
        if(!sel||sel.isCollapsed){toast('请先选中内容');return;}
        deps.safeExec('copy');toast('已复制');
      }
      else if(cmd==='cut'){
        if(deps.outlineSel&&deps.outlineSel.ids&&deps.outlineSel.ids.size>1&&typeof deps.outlineCut==='function'){
          const n=deps.outlineCut();
          if(n>0){toast('已剪切 '+n+' 个节点');return;}
        }
        deps.safeExec('cut');
      }
      else if(cmd==='paste'){
        /* 剪贴板读取在非安全上下文 / 用户拒绝授权时必然 reject：
           粘贴前先恢复编辑区焦点（读剪贴板是异步的，焦点可能已丢失），
           失败时给出可执行指引（改用 Ctrl+V，由浏览器原生 paste 通道落字） */
        const restorePasteFocus=()=>{
          const ae=document.activeElement;
          if(!ae||!ae.closest||!ae.closest('#content')){
            const ft=$('#content .text[data-id]');
            if(ft)ft.focus();
          }
        };
        restorePasteFocus();
        if(navigator.clipboard&&navigator.clipboard.readText){
          navigator.clipboard.readText().then(text=>{
            restorePasteFocus();
            if(!text){toast('剪贴板为空');return;}
            /* 剪贴板若是本应用「JU-NODES:」结构化载荷，按多节点插入（否则退化为纯文本落字） */
            if(typeof deps.outlinePaste==='function'){
              const n=deps.outlinePaste(text);
              if(n>0){toast('已粘贴 '+n+' 个节点');return;}
            }
            deps.safeExec('insertText',text);
          }).catch(()=>{
            restorePasteFocus();
            toast('浏览器拒绝了剪贴板读取权限，请直接使用 Ctrl+V 粘贴');
          });
        }else{
          restorePasteFocus();
          toast('浏览器拒绝了剪贴板读取权限，请直接使用 Ctrl+V 粘贴');
        }
      }
      else if(cmd==='cal')deps.openAddToCalendarDialog();
      else if(cmd==='db')deps.openAddToDbDialog();
  };
  /**
   * [data-cmd] 绑定：命令入口拆成两路（缺一不可）。
   *   · mousedown（**preventDefault 在最前** + saveRange）：按钮不抢焦点，
   *     正文 contenteditable 的选区在命令执行时依然有效；颜色 / 背景 / 字号要先弹浮层，
   *     因此在 mousedown 阶段同步执行 —— 此刻创建浮层，选区快照也已就位。
   *   · click：其余命令（加粗 / 撤销 / 复制…）与键盘 Enter / 空格激活走这里；
   *     同一次交互已在 mousedown 执行过（颜色 / 背景 / 字号）时 click 只做去重。
   */
  $$('[data-cmd]').forEach(b=>{
    let _ranOnMouseDown=false;
    b.addEventListener('mousedown',e=>{
      e.preventDefault();
      _ranOnMouseDown=false;
      saveRange();
      const cmd=b.dataset.cmd as string;
      if(cmd==='color'||cmd==='bg'||cmd==='size'){
        _ranOnMouseDown=true;
        runRightbarCmd(b);
      }
    });
    b.onclick=()=>{
      if(_ranOnMouseDown){_ranOnMouseDown=false;return;}
      runRightbarCmd(b);
    };
  });
  /**
   * 【批次1 · 防失焦拦截（P0）】颜色 / 背景 / 字号三条命令的全部触发点：
   *   ① 右栏三个工具栏按钮（[data-cmd="color"|"bg"|"size"]）；
   *   ② 它们弹出的色板 / 字号面板（.color-picker，含色块与档位按钮）。
   * 一律在 **mousedown** 阶段 `preventDefault()`：浏览器不会把焦点从正文
   * contenteditable 移开，`document.getSelection()` 在命令执行时仍然指向用户选中的
   * 那段文字 —— 这是实机「点一次样式就丢选区 / 第二项样式写不进去」的第一根因。
   *
   * 绑定在 document 的**捕获阶段**（委托）：工具栏被重渲染替换后依然生效，
   * 不在 `$$('[data-cmd]')` 的一次性静态查询上留死角。
   * 唯独放行 input / textarea：原生取色器与十六进制输入框必须拿到真实焦点。
   */
  if(!(document as any).__juFormatFocusGuard){
    (document as any).__juFormatFocusGuard=true;
    document.addEventListener('mousedown',(e: MouseEvent)=>{
      const t=e.target as any;
      if(!t||!t.closest)return;
      if(t.closest('input,textarea'))return;
      const hit=t.closest('[data-cmd="color"],[data-cmd="bg"],[data-cmd="size"],.color-picker');
      if(!hit)return;
      e.preventDefault();
    },true);
  }
  /* 格式刷：全局监听选区变化（目标选区稳定后自动应用）与 Esc 取消。
     Esc 用捕获阶段：正文 contenteditable 的 keydown 会 stopPropagation，冒泡监听收不到 */
  if(!(document as any).__fmtPainterBound){
    (document as any).__fmtPainterBound=true;
    document.addEventListener('selectionchange',deps.onSelectionChangeForPainter);
    document.addEventListener('keydown',deps.onKeyForPainter,true);
  }
  /* 工具栏按钮状态：选区 / 光标变化即按计算样式重算（同值重复点击不再 toggle） */
  if(!(document as any).__fmtButtonsBound){
    (document as any).__fmtButtonsBound=true;
    document.addEventListener('selectionchange',refreshFormatButtons);
  }
  refreshFormatButtons();
  $$('[data-expand]').forEach(b=>{
    b.onclick=()=>{
      const doc=deps.getCurrentDoc();if(!doc)return;
      const mode=b.dataset.expand;
      const _now=Date.now();
      /* 直接改真实节点（deps.N 返回 state 内的对象）。经 deps.commit 的改写会被
         commit 尾部 persistNow→runPersist 立即按落盘快照合并回写为旧值，
         导致「展开全部 / 展开到一级 / 展开到二级」点了没反应（与节点箭头同一根因）。
         递增节点 updatedAt 使 LWW 合并保留本次改动。 */
      deps.docSubtree(doc.id).forEach((id: any)=>{
        if(id===doc.id)return;
        const n=deps.N(id);
        if(!n)return;
        const hasKids=!!(n.children&&n.children.length);
        if(mode==='all')n.collapsed=false;
        else if(mode==='none')n.collapsed=hasKids;
        else if(mode==='l1'){const depth=deps.nodeDepth(id)-deps.nodeDepth(doc.id);n.collapsed=depth>=1&&hasKids;}
        else if(mode==='l2'){const depth=deps.nodeDepth(id)-deps.nodeDepth(doc.id);n.collapsed=depth>=2&&hasKids;}
        else if(mode==='l3'){const depth=deps.nodeDepth(id)-deps.nodeDepth(doc.id);n.collapsed=depth>=3&&hasKids;}
        n.updatedAt=_now;
      });
      deps.forceRender();
    };
  });
  $$('[data-download]').forEach(b=>{b.onclick=()=>deps.doDownload(b.dataset.download);});
  /* 【UI修复8】btnPrintEntry 已删除：打印面板展开/预览改由 data-toggle 折叠头统一处理 */
  const btnPrintDo=$('#btnPrintDo');
  if(btnPrintDo)btnPrintDo.onclick=deps.doPrint;
  const printWithMeta=$<HTMLInputElement>('#printWithMeta');
  if(printWithMeta)printWithMeta.onchange=()=>{if($('#srPrintPanel')!.classList.contains('on'))deps.showPrintPreview();};
  /* 【D-07】下载类按钮改 bindClick（addEventListener）+ 按压兜底：
     `el.onclick = fn` 会被右栏重渲染 / 其它赋值覆盖，用户侧表现为「点了没下载」。
     兜底只在 click 未派发时补执行（不会造成重复下载，见 ui/common.bindPressFallback）。 */
  const btnExportICS=$('#btnExportICS');
  bindClick(btnExportICS,()=>{deps.exportICS();},{pressFallback:true});
  const btnBackupSide=$('#btnBackupSide');
  bindClick(btnBackupSide,()=>{deps.exportFullBackup();},{pressFallback:true});
}
export function updateRightSidebar(): void {
  const doc=deps.getCurrentDoc();
  const cur=doc?(doc.starred||0):0;
  $$('#srStars .star').forEach((s,i)=>{s.classList.toggle('on',i<cur);});
  const lock=$('#srLock');if(lock)lock.classList.toggle('on',!!(doc&&doc.private));
  renderBacklinkPanel();
}
/* ============================================================
   Wiki 链接跳转 + 反链 / 出链 面板
   ============================================================ */
/* M0-7：WIKI_RE 已提升至首脚本常量区（与 TAG_RE 同处），此处不再重复声明。 */
export function normTitle(t: any): string {return String(t||'').replace(/\s+/g,' ').trim();}
export function findNodeByTitle(title: any): string|null {
  const t=normTitle(title);if(!t)return null;
  let fallback=null;
  for(const id in deps.state.nodes){
    const n=deps.state.nodes[id];
    if(!n||n._deleted||n.id===deps.state.rootId)continue;
    if(normTitle(stripHtml(n.text||''))!==t)continue;
    if(deps.isFolder(id)){if(!fallback)fallback=id;continue;}
    if(n._isCalRoot)continue;
    return id;
  }
  return fallback;
}
export function navigateToWikiLink(title: any, fromEl?: any): void {
  const t=normTitle(title);if(!t){toast('无效链接');return;}
  const id=findNodeByTitle(t);
  if(id){deps.openNode(id);return;}
  appConfirm('节点「'+t.slice(0,30)+'」不存在，创建为新文档并跳转？',()=>{
    const newId=deps.actions.addNode(deps.state.rootId,null,{text:t});
    if(newId)deps.openNode(newId);
    else toast('创建失败');
  },()=>{});
}
export function caretTextInfo(x: number, y: number): any {
  let info: any=null;
  try{
    if((document as any).caretPositionFromPoint){
      const p=(document as any).caretPositionFromPoint(x,y);
      if(p&&p.offsetNode)info={node:p.offsetNode,offset:p.offset};
    }
    if(!info&&(document as any).caretRangeFromPoint){
      const r=(document as any).caretRangeFromPoint(x,y);
      if(r&&r.startContainer)info={node:r.startContainer,offset:r.startOffset};
    }
  }catch(e){console.warn('[JU] caught error',e);}
  return info;
}
export function linkTitleAtPoint(el: any, e: MouseEvent): string|null {
  const info=caretTextInfo(e.clientX,e.clientY);
  if(!info||!info.node)return null;
  let node=info.node;
  if(node.nodeType===1){
    let found: any=null;let acc=0;
    Array.from(node.childNodes).forEach((ch: any)=>{
      if(found)return;
      if(ch.nodeType===3){
        const len=(ch.textContent||'').length;
        if(info.offset>=acc&&info.offset<=acc+len)found=ch;
        acc+=len;
      }
    });
    node=found;
  }
  if(!node||node.nodeType!==3)return null;
  const text=node.textContent||'';
  const off=Math.max(0,Math.min(text.length,info.offset));
  WIKI_RE.lastIndex=0;
  let m;
  while((m=WIKI_RE.exec(text))!==null){
    const s=m.index,en=m.index+m[0].length;
    if(off>=s&&off<=en)return m[1].trim();
  }
  return null;
}
export function outgoingLinksOf(docId: any): Map<any,any> {
  const set: Map<any,any>=new Map();
  deps.docSubtree(docId).forEach((id: any)=>{
    const n=deps.state.nodes[id];
    if(!n||n._deleted)return;
    const txt=stripHtml(n.text||'');if(!txt)return;
    WIKI_RE.lastIndex=0;let m;
    while((m=WIKI_RE.exec(txt))!==null){
      const t=m[1].trim();if(t&&!set.has(t))set.set(t,id);
    }
  });
  return set;
}
export function backlinksOf(docId: any): any[] {
  const doc=deps.N(docId);if(!doc)return [];
  const docTitles=new Set();
  deps.docSubtree(docId).forEach((id: any)=>{
    const n=deps.state.nodes[id];
    if(!n||deps.isBlankNode(n))return;
    const t=normTitle(stripHtml(n.text||''));
    if(t)docTitles.add(t);
  });
  const groups: Map<any,any>=new Map();
  for(const id in deps.state.nodes){
    const n=deps.state.nodes[id];
    if(!n||n._deleted||id===deps.state.rootId)continue;
    if(deps.findOwningTopDocId(id,deps.state)===docId)continue;
    const txt=stripHtml(n.text||'');if(!txt)continue;
    WIKI_RE.lastIndex=0;let m;let hit=false;
    while((m=WIKI_RE.exec(txt))!==null){
      if(docTitles.has(normTitle(m[1]))){hit=true;break;}
    }
    if(!hit)continue;
    const topId=deps.findOwningTopDocId(id,deps.state)||id;
    const g=groups.get(topId)||{topId,count:0};
    g.count++;
    groups.set(topId,g);
  }
  return Array.from(groups.values()).sort((a,b)=>b.count-a.count);
}
export function renderBacklinkPanel(): void {
  const box=$('#srBacklinks');if(!box)return;
  const doc=deps.getCurrentDoc();
  box.innerHTML='';
  const secTitle=box.closest('.sr-section')?.querySelector('.sr-title');
  if(!doc||doc.id===deps.state.rootId||deps.isFolder(doc.id)||doc._isCalRoot||doc._isDbRoot){
    if(secTitle)secTitle.lastChild!.textContent='链接 / 反链';
    const e=document.createElement('div');e.className='bl-empty';
    e.textContent='打开一个文档后，在此查看它的出链与反链。';
    box.appendChild(e);
    return;
  }
  const docTitle=stripHtml(doc.text||'').trim()||'未命名';
  const out=outgoingLinksOf(doc.id);
  const backs=backlinksOf(doc.id);
  if(secTitle)secTitle.lastChild!.textContent='链接 / 反链（出 '+out.size+' · 回 '+backs.length+'）';
  const group=(label: string,count: number)=>{
    const g=document.createElement('div');g.className='bl-group';
    const h=document.createElement('div');h.className='bl-group-head';
    h.textContent=label;
    if(count>0){const c=document.createElement('span');c.className='bl-gh-count';c.textContent=String(count);h.appendChild(c);}
    g.appendChild(h);
    return g;
  };
  const icIn=`<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>`;
  const icOut=`<svg viewBox="0 0 24 24"><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg>`;
  const mkRow=(title: string,targetId: any,{missing=false,create=false,count=null}: {missing?: boolean; create?: boolean; count?: any}={})=>{
    const row=document.createElement('div');row.className='bl-row'+(missing?' bl-missing':'');
    const ic=document.createElement('span');ic.className='bl-ic';ic.innerHTML=missing?icOut:icIn;
    row.appendChild(ic);
    const t=document.createElement('div');t.className='bl-title'+(targetId===doc.id?' sel':'');
    t.textContent=title;t.title=title;
    row.appendChild(t);
    if(count!=null){const c=document.createElement('span');c.className='bl-count';c.textContent=count+' 处';row.appendChild(c);}
    if(missing){
      const b=document.createElement('span');b.className='bl-create';b.textContent='创建';
      b.onclick=e=>{e.stopPropagation();const newId=deps.actions.addNode(deps.state.rootId,null,{text:title});if(newId)deps.openNode(newId);else toast('创建失败');};
      row.appendChild(b);
    }
    row.onclick=()=>{if(targetId)deps.openNode(targetId);};
    return row;
  };
  /* 出链 */
  if(out.size){
    const g=group('出链',out.size);
    Array.from(out.entries()).sort((a,b)=>a[0].localeCompare(b[0],'zh')).forEach(([t,fromId])=>{
      const targetId=findNodeByTitle(t);
      g.appendChild(mkRow(t,targetId,{missing:!targetId}));
    });
    box.appendChild(g);
  }else{
    const g=group('出链',0);
    const e=document.createElement('div');e.className='bl-empty';
    e.textContent='本文档还没有 [[链接]]。';
    g.appendChild(e);box.appendChild(g);
  }
  /* 反链 */
  if(backs.length){
    const g=group('反链',backs.length);
    backs.forEach(b=>{
      const src=deps.N(b.topId);
      const title=src?stripHtml(src.text||'').trim():'未命名';
      g.appendChild(mkRow(title,b.topId,{count:b.count}));
    });
    box.appendChild(g);
  }else{
    const g=group('反链',0);
    const e=document.createElement('div');e.className='bl-empty';
    e.textContent='暂无其他文档链接到本文档。';
    g.appendChild(e);box.appendChild(g);
  }
  const hint=document.createElement('div');hint.className='bl-hint';
  hint.textContent='提示：编辑中 Ctrl / ⌘ + 点击 [[链接]] 跳转；点「创建」生成缺失的节点。';
  box.appendChild(hint);
}
