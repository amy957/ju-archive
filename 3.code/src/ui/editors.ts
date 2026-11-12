/**
 * M1-1 · 批次 AH · 富文本编辑器工具（颜色 / 字号选择器 · 格式刷 · 批量格式化）
 *
 * 来源：6.P0-T3基线/public/v2.0-t3.html（canonical，只读）
 *   - colorPickerEl / openColorPicker / closeColorPicker / onDocClickForPicker ....... 17202-17248
 *   - clearBgFromSelection / cleanupBg ............................................... 17249-17276
 *   - sizePickerEl / FONT_SIZE_RATIOS / currentBaseFontPx / fontSizePxFor ............ 17277-17290
 *   - applyFontSize ............................................................... 17330-17355
 *   - clearFontSizeFromSelection / openSizePicker / closeSizePicker ................. 17359-17417
 *   - 批量格式（HTML 字符串级）normalizeFormatHtml / captureFormatFromHtml /
 *     applyFormatToHtml / batchFormatHtml ......................................... 17418-17567
 *   - 格式刷 _fmtPainter / selectionKey / captureFormat / applyCapturedFormat /
 *     deactivatePainter / toggleFormatPainter / captureFormatFromNodes /
 *     applyFormatToNodes / toggleBatchPainter / onSelectionChangeForPainter /
 *     onKeyForPainter ............................................................. 17568-17722
 *
 * 约束（零漂移）：函数体表达式、正则、DOM 选择器、toast 文案、防抖时长逐字保留。
 *   仅三类纯类型层处理：
 *     1) 追加 `export` 与 TS 类型注解（`any` 为纯类型层，运行期无差异）。
 *     2) 跨模块符号（state / commit / nowSeq / forceRender / safeExec / 主题令牌 /
 *        placePop）统一走 `EditorDeps` 依赖注入容器。
 *     3) 空内联元素集合与三个纯 DOM 清理工具复用 `ui/focus` 的同一实现（单一来源，
 *        与产品同作用域语义一致）。
 *
 * 受控结构差异（运行期语义等价，均记档）：
 *   - `_fmtPainter` 在每处复位点由「整对象重新赋值」改为「同一 holder 对象字段复位」
 *     （`resetPainter()`）。这样 `bindRightbarDeps({fmtPainter})` 注入的是稳定引用，
 *     右键栏 `deps.fmtPainter.active` 判断不会因对象被替换而读到陈旧快照。
 */

import { toast, initDragClose } from './common';
import {
  applyCustomStyleToSelection,
  applyInlineStyle as applyInlineStyleToSelection,
  clearInlineStyleFromSelection,
  deepElementAtRangeStart,
  normalizeCssValue,
  sameCssValue,
  safeExec,
} from '../core/richtext';
import {
  EMPTY_INLINE_TAGS,
  cleanupEmptyInline,
  collectRangeIntersectElements,
  unwrapStylelessSpans,
} from './focus';

/* ============================================================
   依赖注入容器
   ============================================================ */
export interface EditorDeps {
  /** 全局 state（多选节点格式刷读取 nodes[id].text） */
  state: any;
  /** 全局 UI 状态对象 */
  ui: any;
  /** 结构共享提交（批量格式刷写回节点 text） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** document.execCommand 包装（透明背景清除） */
  safeExec: (cmd: string, val?: any) => any;
  /** 轻提示 */
  toast: (msg: any) => void;
  /** 单调毫秒水位（节点 updatedAt） */
  nowSeq: () => number;
  /** 强制重渲染 */
  forceRender: () => void;
  /** 主题色板读取（对应产品 `_themeList(name,fallback)`） */
  themeList: (name: string, fallback?: string[]) => string[];
  /** 主题令牌取色（对应产品 `_themeColor(name,fallback)`） */
  themeColor: (name: string, fallback: string) => string;
  /** 浮层定位（对应产品 `placePop(el,W,H,anchor)`） */
  placePop: (el: any, W: number, H: number, anchor: any) => void;
  /** 浮层拖拽关闭（对应产品 `initDragClose`） */
  initDragClose: (el: HTMLElement, onClose?: (() => void) | null) => void;
}

/**
 * 模块内默认实现：`safeExec` 直接取自 core/richtext（M1-1c 单一来源），
 * 其余跨模块符号保持安全占位（真实实现在 src/main.ts 装配时注入）。
 */
export const deps: EditorDeps = {
  state: null,
  ui: {},
  commit: () => undefined,
  safeExec,
  toast,
  nowSeq: () => Date.now(),
  forceRender: () => {},
  themeList: (_name: string, fallback?: string[]) => fallback || [],
  themeColor: (_name: string, fallback: string) => fallback || '',
  placePop: () => {},
  initDragClose,
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function injectEditorDeps(next: Partial<EditorDeps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   颜色选择器
   ============================================================ */
let colorPickerEl: HTMLElement | null = null;

export function openColorPicker(anchorEl: any, callback: (c: string) => void, current?: any, opts?: any): void {
  closeColorPicker();closeSizePicker();
  const palette=deps.themeList('--color-palette',[]);
  const picker=document.createElement('div');picker.className='color-picker';
  /* 顶部留白让出右上角关闭钮热区（.pop-close），避免遮挡第一行色块 */
  picker.style.paddingTop='24px';
  const grid=document.createElement('div');grid.className='cp-grid';
  /* 按列填充：8 列 × 3 行，同一列自上而下为同色系由浅到深 */
  grid.style.gridAutoFlow='column';
  grid.style.gridTemplateRows='repeat(3, 1fr)';
  const curLower=String(current||'').toLowerCase();
  const isTransparent=curLower==='transparent'||curLower==='rgba(0, 0, 0, 0)'||curLower==='rgba(0,0,0,0)'||!current;
  palette.forEach((c: string)=>{
    const sw=document.createElement('div');sw.className='cp-swatch';
    if(current&&curLower===c.toLowerCase())sw.classList.add('on');
    sw.style.background=c;sw.title=c;
    /* 即点即用：写入颜色后立即收起面板，不再依赖底部确认 */
    sw.onclick=()=>{callback(c);closeColorPicker();};
    grid.appendChild(sw);
  });
  picker.appendChild(grid);
  const customRow=document.createElement('div');customRow.className='cp-custom';customRow.innerHTML=`<label>自定义</label>`;
  if(opts&&opts.transparent){
    /* 透明档（仅背景色适用）由网格移入自定义行最左侧，点击即写 transparent 并收起 */
    const tpBtn=document.createElement('button');tpBtn.type='button';tpBtn.className='cp-transparent';tpBtn.textContent='透明';tpBtn.title='无背景色（透明）';
    tpBtn.onclick=()=>{callback('transparent');closeColorPicker();};
    customRow.insertBefore(tpBtn,customRow.firstChild);
  }
  if(opts&&opts.clear){
    /* 「默认」档（仅文字颜色适用）：清除 color 声明、回到主题正文色。
       清除是**独立按钮**，不依赖「再次点击同色 = 取消」这种 toggle 语义 ——
       同值重复点击由引擎判为无操作，颜色不会被误清掉。 */
    const clrBtn=document.createElement('button');clrBtn.type='button';clrBtn.className='cp-transparent';clrBtn.textContent='默认';clrBtn.title='恢复默认文字颜色';
    clrBtn.onclick=()=>{callback('inherit');closeColorPicker();};
    customRow.insertBefore(clrBtn,customRow.firstChild);
  }
  const input=document.createElement('input');input.type='color';input.value=(isTransparent?deps.themeColor('--cp-custom-fill',''):(current||deps.themeColor('--cp-custom-alt','')));
  const hexInput=document.createElement('input');hexInput.type='text';hexInput.className='cp-hex';hexInput.value=input.value.toUpperCase();
  /* 自定义色实时生效：拖动取色 / 输入合法十六进制即写入，无需确认按钮 */
  input.oninput=()=>{hexInput.value=input.value.toUpperCase();callback(input.value);};
  hexInput.oninput=()=>{if(/^#[0-9a-fA-F]{6}$/.test(hexInput.value)){input.value=hexInput.value;callback(hexInput.value);}};
  customRow.appendChild(input);customRow.appendChild(hexInput);
  picker.appendChild(customRow);
  document.body.appendChild(picker);
  picker.addEventListener('mousedown',(e: MouseEvent)=>{
    if((e.target as HTMLElement).closest('.cp-swatch'))e.preventDefault();
  });
  deps.placePop(picker,260,300,anchorEl);
  deps.initDragClose(picker,()=>closeColorPicker());
  colorPickerEl=picker;
  setTimeout(()=>document.addEventListener('mousedown',onDocClickForPicker),0);
}

export function closeColorPicker(): void {
  if(colorPickerEl){colorPickerEl.remove();colorPickerEl=null;}
  document.removeEventListener('mousedown',onDocClickForPicker);
}

function onDocClickForPicker(e: MouseEvent): void {
  if(!(e.target as HTMLElement).closest('.color-picker'))closeColorPicker();
}

/* 清除选区文字背景颜色（纯 DOM 口径：直接移除 background-color 声明，不再调用 execCommand） */
export function clearBgFromSelection(): void {
  const sel=window.getSelection();
  if(!sel||sel.rangeCount===0||sel.isCollapsed){deps.toast('请先选中文字');return;}
  const range=sel.getRangeAt(0);
  const sc=range.commonAncestorContainer;
  const startEl: any=(sc.nodeType===1)?sc:sc.parentNode;
  const host: any=startEl&&startEl.closest?startEl.closest('[contenteditable="true"]'):null;
  if(!host){deps.toast('请先选中文字');return;}
  /* 保存选区：移除 background-color 只改 style，不清空文本节点，因此快照仍然有效 */
  const saved=range.cloneRange();
  collectRangeIntersectElements(host,range).forEach((el: any)=>{
    if(el.style&&el.style.backgroundColor)el.style.removeProperty('background-color');
  });
  cleanupBg(host);
  try{
    if(saved.startContainer&&saved.startContainer.isConnected&&saved.endContainer&&saved.endContainer.isConnected){
      sel.removeAllRanges();sel.addRange(saved);
    }
  }catch(e){console.warn('[JU] caught error', e);}
  deps.toast('已清除背景颜色');
}

function cleanupBg(root: any): void {
  const unwrap: any[]=[];const dead: any[]=[];
  (function walk(n: any){
    Array.from(n.children||[]).forEach((ch: any)=>{
      walk(ch);
      if(ch.style){
        const v=(ch.style.backgroundColor||'').toLowerCase();
        if(v==='transparent'||v==='rgba(0, 0, 0, 0)'||v==='rgba(0,0,0,0)')ch.style.removeProperty('background-color');
      }
      if(!ch.getAttribute('style')&&(ch.tagName==='SPAN'||ch.tagName==='FONT'))unwrap.push(ch);
      if(EMPTY_INLINE_TAGS.has(ch.tagName)&&ch.children.length===0&&!ch.textContent)dead.push(ch);
    });
  })(root);
  unwrap.forEach((el: any)=>{const p=el.parentNode;if(p){while(el.firstChild)p.insertBefore(el.firstChild,el);p.removeChild(el);}});
  dead.forEach((n: any)=>{try{n.remove();}catch(e){console.warn('[JU] caught error',e);}});
}

/**
 * 清除选区文字颜色（**独立按钮**口径：清除不走 toggle）。
 *
 * 与「点第二次同色 = 取消」的旧交互相反：同值重复点击由引擎判定为无操作，
 * 要恢复默认颜色必须走这里 —— 只摘 color 声明，font-size / background-color /
 * font-weight 全部保留。
 */
export function clearColorFromSelection(): void {
  if(clearInlineStyleFromSelection('color')){
    const host: any=(()=>{
      const sel=window.getSelection();
      if(!sel||sel.rangeCount===0)return null;
      const sc: any=sel.getRangeAt(0).commonAncestorContainer;
      const el: any=(sc.nodeType===1)?sc:sc.parentNode;
      return el&&el.closest?el.closest('[contenteditable="true"]'):null;
    })();
    if(host)cleanupBg(host);
    deps.toast('已清除文字颜色');
    return;
  }
  deps.toast('请先选中文字');
}

/* ============================================================
   字号选择器
   ============================================================ */
let sizePickerEl: HTMLElement | null = null;
/* 字号档位（UI 预设）：只描述「相对当前正文字号的倍率 + 显示文案」。
   写入路径一律是 px 字符串（`applyInlineStyle('font-size','24px')`），
   不再产出 1–7 档位号 —— 档位号是 execCommand('fontSize', N) 的产物，
   宿主会把它写成 <font size="N">，与内联 style 混用后被后续命令整段清除。 */
export const FONT_SIZE_PRESETS: Array<{ratio:number;t:string}> = [
  {ratio:0.7,t:'小 1'},
  {ratio:0.85,t:'小 2'},
  {ratio:1.0,t:'正文 3'},
  {ratio:1.2,t:'中 4'},
  {ratio:1.5,t:'大 5'},
  {ratio:2.0,t:'特大 6'},
  {ratio:2.8,t:'最大 7'},
];
/* 契约保留（window.JU.FONT_SIZE_RATIOS 仍对外暴露档位倍率表），
   仅用于展示与历史调用方换算，**不再参与任何样式写入**。 */
export const FONT_SIZE_RATIOS: Record<string, number> = FONT_SIZE_PRESETS.reduce((m,p,i)=>{
  m[String(i+1)]=p.ratio;return m;
},{} as Record<string, number>);

export function currentBaseFontPx(): number {
  const v=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size'));
  return (v&&v>0)?v:14;
}

export function fontSizePxFor(level: any): number | null {
  const ratio=FONT_SIZE_RATIOS[level as string];
  if(!ratio)return null;
  return Number((currentBaseFontPx()*ratio).toFixed(1));
}

/* ============================================================
   选区内联样式写入（DOM Range 口径 · 合并既有内联格式）
   ------------------------------------------------------------
   颜色 / 背景 / 字号三个命令都必须满足同一条不变量：
   **写入新样式不得破坏选区里已有的 <b>/<i>/颜色 span**。
   宿主 execCommand 在「已有多层标签」的选区上会重建边界节点
   （拆 <b> 或整段换成 <font>），前一步格式随之丢失；且写入后
   原生选区可能塌陷，导致下一次「保持选中再点」没有 Range 可用。
   本函数按下面的顺序做纯 DOM 写入，行为与宿主实现无关：
     ① 读取选区祖先链上已有的内联格式（color / background-color /
        font-size / font-weight / font-style / text-decoration-line），
        以及 <b>/<strong>/<i>/<em>/<u>/<s> 等标签语义；
     ② 需要清同类旧声明时（字号）先清，避免嵌套导致行高被深层撑高；
     ③ 构造一个 <span>，把「既有格式 + 新格式」写进同一个 style
        （新格式后写，覆盖同类旧值）；
     ④ 用该 span 包裹选区内容 —— 只包裹不重建，已有标签原样留在新 span 内；
     ⑤ 重排空 span / 空内联元素（复用 ui/focus 的同一实现）；
     ⑥ **把选区重新框到新 span 上**，保证下一次格式命令仍有有效 Range。
   ============================================================ */
function styleCamel(prop: string): string {
  return prop.replace(/-([a-z])/g,(m: string,c: string)=>c.toUpperCase());
}

/**
 * 选区写入内联样式 —— 单一引擎：core/richtext.applyInlineStyle（三项合并口径）。
 *
 * 颜色 / 背景 / 字号三条命令**只**走这一个入口：
 *   ① 读选区文本当前生效的 color / background-color / font-size（getComputedStyle）；
 *   ② 用**单个 span** 承载三项，只覆盖本次要写的那一项；
 *   ③ 合并相邻同 style 的 span 并做结构归一（嵌套摊平 / 空 span 展开 / 文本合并）。
 * 全程零 execCommand、零重渲染，因此六种先后顺序结果完全一致，
 * 不会出现「后一次命令把前一项属性整段清掉」。
 * collapsed 选区（只有光标）不写 DOM，改为登记 typing style，落字时自动套用。
 */
export function applyInlineStyle(prop: string, value: string, _opts?: { clearSameProp?: boolean; merge?: boolean }): boolean {
  return applyInlineStyleToSelection(prop, value);
}

/**
 * 选区起点元素当前生效的样式值（getComputedStyle 口径）；无编辑器选区返回空串。
 * 起点可能落在元素边界（startContainer = 父 DIV、offset = 子节点下标），
 * 必须先下钻到真正承载文字的元素，否则读到继承值 ⇒ 色板 / 字号面板回显错、
 * 下划线 / 删除线的词元增删判断也会失效。
 */
export function selectionStyleValue(prop: string): string {
  try{
    const sel=window.getSelection();
    if(!sel||sel.rangeCount===0)return '';
    const el: any=deepElementAtRangeStart(sel.getRangeAt(0));
    if(!el||!el.closest||!el.closest('[contenteditable="true"]'))return '';
    return String(getComputedStyle(el)[styleCamel(prop) as any]||'');
  }catch(e){return '';}
}

/** 工具栏按钮 active 判定结果（值为规范化后的 computed 值，供高亮 / 回显复用）。 */
export interface FormatActiveState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: boolean;
  bg: boolean;
  size: boolean;
  colorValue: string;
  bgValue: string;
  sizeValue: string;
}

/**
 * 选区锚点处「当前生效格式」的按钮状态（getComputedStyle(selection.anchorNode) 口径）。
 *
 * 不用 queryCommandState：该 API 在 WebView2 已废弃且对同一段文字返回不确定值，
 * 曾经导致「同值再点一次就被 toggle 成清除」。这里一律读计算样式并规范化比较：
 * 字号比数值（px），颜色 / 背景比规范 RGB（#f00 与 rgb(255,0,0) 视为同值）。
 */
export function formatActiveState(): FormatActiveState {
  const out: FormatActiveState = {
    bold: false, italic: false, underline: false, strike: false,
    color: false, bg: false, size: false,
    colorValue: '', bgValue: '', sizeValue: '',
  };
  try {
    const sel: any = window.getSelection();
    if (!sel || sel.rangeCount === 0) return out;
    const anchor: any = sel.anchorNode;
    const el: any = anchor ? (anchor.nodeType === 1 ? anchor : anchor.parentElement) : null;
    if (!el || !el.closest || !el.closest('[contenteditable="true"]')) return out;
    const cs: any = getComputedStyle(el);
    const weight = String(cs.fontWeight || '');
    out.bold = weight === 'bold' || weight === 'bolder' || parseInt(weight, 10) >= 600;
    out.italic = String(cs.fontStyle || '').indexOf('italic') >= 0;
    const deco = String(cs.textDecorationLine || cs.textDecoration || '');
    out.underline = deco.indexOf('underline') >= 0;
    out.strike = deco.indexOf('line-through') >= 0;
    out.colorValue = String(cs.color || '');
    out.bgValue = String(cs.backgroundColor || '');
    out.sizeValue = String(cs.fontSize || '');
    /* 「默认色」= 正文前景色，视为未激活 */
    const baseFg = deps.themeColor('--editor-fg', '');
    out.color = !!out.colorValue && !(baseFg && sameCssValue('color', out.colorValue, baseFg));
    out.bg = !!out.bgValue && out.bgValue !== 'transparent' && out.bgValue !== 'rgba(0, 0, 0, 0)';
    const basePx = currentBaseFontPx();
    const sizePx = parseFloat(out.sizeValue) || 0;
    out.size = sizePx > 0 && Math.abs(sizePx - basePx) >= 0.5;
  } catch (e) {
    console.warn('[JU] caught error', e);
  }
  return out;
}

/** 把任意 CSS 值归一化为 getComputedStyle 口径（颜色 rgb() / 尺寸 px），用于写入后回读比对。 */
export function normalizeCssStyle(prop: string, value: string): string {
  try{
    const probe=document.createElement('span');
    probe.style.setProperty('position','fixed');
    probe.style.setProperty('visibility','hidden');
    probe.style.setProperty(prop,value);
    document.body.appendChild(probe);
    const out=String(getComputedStyle(probe)[styleCamel(prop) as any]||'');
    probe.remove();
    return out;
  }catch(e){return '';}
}

/**
 * 选区字号写入（**px 口径**）：入参是像素值 —— `'18px'` / `18` / `'18'`。
 *
 * 不再接受 1–7 档位号：档位号只属于 execCommand('fontSize', N)，宿主会把它落成
 * `<font size="N">`；一旦与内联 style 混用，后续任一命令重建选区边界节点就会
 * 把整段字号清掉。这里统一写 `font-size:NNpx`，与颜色 / 背景共用同一个合并引擎，
 * 因此既有 color / background-color / font-weight 原样保留。
 */
export function applyFontSize(px: any): void {
  const num=parseFloat(String(px==null?'':px).replace(/px$/i,''));
  if(!num||num<=0){deps.toast('字号取值无效');return;}
  const value=Number(num.toFixed(1))+'px';
  /* collapsed 选区由引擎登记 typing style（下一次落字生效），无需在此拦截 */
  if(!applyInlineStyleToSelection('font-size',value))deps.toast('请先在正文中选中文字');
}

/* 清除选区字号：移除 font-size 样式，并把因此失去全部样式的 span 展开回正文。
   遍历从 contenteditable 根开始（intersectsNode 过滤），覆盖选区祖先/后代所有层级的 font-size span，
   再展开清空后残留的空样式 span，彻底恢复正文行高。 */
export function clearFontSizeFromSelection(): void {
  const sel=window.getSelection();
  if(!sel||sel.rangeCount===0){deps.toast('请先在正文中选中文字');return;}
  /* 折叠光标：没有可清的历史文本，改为撤销「待生效字号」 */
  if(sel.isCollapsed){clearInlineStyleFromSelection('font-size');deps.toast('已取消待生效字号');return;}
  const range=sel.getRangeAt(0);
  const sc=range.commonAncestorContainer;
  const startEl: any=(sc.nodeType===1)?sc:sc.parentNode;
  const host: any=startEl&&startEl.closest?startEl.closest('[contenteditable="true"]'):null;
  if(!host){deps.toast('请先在正文中选中文字');return;}
  /* 修复：从 contenteditable 根遍历（intersectsNode 过滤），
     覆盖选区祖先/后代所有层级的 font-size span（不只 commonAncestorContainer 子树），
     再展开清空后残留的空样式 span，彻底恢复正文行高 */
  collectRangeIntersectElements(host,range).forEach((el: any)=>{
    if(el.style&&el.style.fontSize)el.style.removeProperty('font-size');
  });
  unwrapStylelessSpans(host);
  cleanupEmptyInline(host);
  deps.toast('已清除字号（恢复正文大小）');
}

export function openSizePicker(anchorEl: any, callback: (v: string) => void): void {
  closeSizePicker();closeColorPicker();
  const picker=document.createElement('div');picker.className='color-picker';
  /* 顶部留白让出右上角关闭钮热区（.pop-close），避免遮挡第一行档位 */
  picker.style.paddingTop='24px';
  const grid=document.createElement('div');grid.className='sp-grid';
  /* 计算当前选区字号，高亮匹配档位 */
  let curPx: number | null=null;
  const sel=window.getSelection();
  if(sel&&sel.rangeCount&&!sel.isCollapsed){
    const r=sel.getRangeAt(0);
    const c: any=(r.commonAncestorContainer.nodeType===1)?r.commonAncestorContainer:r.commonAncestorContainer.parentElement;
    if(c)curPx=parseFloat(getComputedStyle(c).fontSize)||null;
  }
  /* 档位 = UI 预设倍率 → 直接换算成 px 字符串回传（写入路径只见 px，不见 1–7 档位号） */
  const items=FONT_SIZE_PRESETS.map(p=>({px:Number((currentBaseFontPx()*p.ratio).toFixed(1)),t:p.t}));
  items.forEach(s=>{
    const btn=document.createElement('button');btn.className='sp-btn';
    btn.innerHTML=`<span>${s.t}</span><span class="sp-px">${s.px}px</span>`;
    if(curPx!=null&&Math.abs(curPx-s.px)<1.5)btn.classList.add('on');
    btn.onclick=()=>{callback(s.px+'px');closeSizePicker();};
    grid.appendChild(btn);
  });
  /* 清除档位并入网格末位（不再单独占据网格下方一行） */
  const clearBtn=document.createElement('button');clearBtn.className='sp-btn';
  clearBtn.textContent='清除字号';
  clearBtn.style.cssText='justify-content:center; font-size:1em; color:var(--accent); font-weight:bold; border:2px solid var(--accent);';
  clearBtn.onclick=()=>{clearFontSizeFromSelection();closeSizePicker();};
  grid.appendChild(clearBtn);
  picker.appendChild(grid);
  document.body.appendChild(picker);
  picker.addEventListener('mousedown',(e: MouseEvent)=>e.preventDefault());
  deps.placePop(picker,180,255,anchorEl);
  deps.initDragClose(picker,()=>closeSizePicker());
  sizePickerEl=picker;
  setTimeout(()=>document.addEventListener('mousedown',onDocClickForSizePicker),0);
}

export function closeSizePicker(): void {
  if(sizePickerEl){sizePickerEl.remove();sizePickerEl=null;}
  document.removeEventListener('mousedown',onDocClickForSizePicker);
}

function onDocClickForSizePicker(e: MouseEvent): void {
  if(!(e.target as HTMLElement).closest('.color-picker'))closeSizePicker();
}

/* ============================================================
   批量格式（HTML 字符串级）
   ------------------------------------------------------------------
   多选节点批量格式化与格式刷批量应用共用此管线：先按「格式类型」把原有的
   对应内联样式 / 格式标签清除，再包裹新标签。反复更换颜色 / 背景色 / 字号时
   不会层层嵌套（旧实现每点一次就多包一层 span，最终只能改到最内层或彻底失效）。
   ============================================================ */
const _FMT_STYLE_PROP: Record<string,string>={fontSize:'font-size',color:'color',bg:'background-color'};
const _FMT_TAG_KIND: Record<string,string>={B:'bold',STRONG:'bold',I:'italic',EM:'italic',U:'underline',S:'strike',STRIKE:'strike',DEL:'strike'};

function fmtIsTransparent(v: any): boolean {
  const s=String(v==null?'':v).trim().toLowerCase();
  return !s||s==='transparent'||s==='rgba(0, 0, 0, 0)'||s==='rgba(0,0,0,0)';
}

function fmtFragment(html: any): DocumentFragment {
  const tpl=document.createElement('template');
  tpl.innerHTML=String(html==null?'':html);
  return tpl.content;
}

/* 后序遍历：先处理子层再处理本层，保证标签降级 / 展开时后代已处理完 */
function fmtEachElement(root: any, fn: (el: any) => void): void {
  Array.from(root.children||[]).forEach((el: any)=>{fmtEachElement(el,fn);fn(el);});
}

function fmtUnwrapElement(el: any): void {
  const p=el&&el.parentNode;
  if(!p)return;
  while(el.firstChild)p.insertBefore(el.firstChild,el);
  p.removeChild(el);
}

function fmtDropDecoration(el: any, token: string): void {
  const raw=(el.style&&(el.style.textDecoration||el.style.textDecorationLine))||'';
  if(!raw)return;
  const keep=String(raw).split(/\s+/).filter((t: string)=>t&&t.toLowerCase()!==token);
  el.style.removeProperty('text-decoration');
  el.style.removeProperty('text-decoration-line');
  if(keep.length)el.style.textDecoration=keep.join(' ');
}

function fmtTidy(root: any): void {
  const unwrap: any[]=[],dead: any[]=[];
  fmtEachElement(root,(el: any)=>{
    if(!(el.getAttribute('style')||'').trim())el.removeAttribute('style');
    const otherAttrs=Array.from(el.attributes||[]).filter((a: any)=>a.name!=='style');
    if((el.tagName==='SPAN'||el.tagName==='FONT')&&otherAttrs.length===0)unwrap.push(el);
    else if(EMPTY_INLINE_TAGS.has(el.tagName)&&el.children.length===0&&!el.textContent)dead.push(el);
  });
  unwrap.forEach(fmtUnwrapElement);
  dead.forEach((n: any)=>{try{n.remove();}catch(e){console.warn('[JU] caught error',e);}});
}

/* 清除某一类格式：颜色 / 背景 / 字号按内联样式（含 <font> 属性）清除；
   粗体 / 斜体 / 下划线 / 删除线同时清除标签与对应样式 */
function fmtClearKind(root: any, kind: string): void {
  if(!kind)return;
  const hit: any[]=[];
  fmtEachElement(root,(el: any)=>{
    if(_FMT_TAG_KIND[el.tagName]===kind){
      const keepStyle=(el.getAttribute('style')||'').trim();
      const otherAttrs=Array.from(el.attributes||[]).filter((a: any)=>a.name!=='style');
      if(!keepStyle&&otherAttrs.length===0){hit.push(el);return;}
      /* 带伴随样式的格式标签降级为 span（标签本身仍带语义，不降级无法真正去掉格式） */
      const sp=document.createElement('span');
      Array.from(el.attributes||[]).forEach((a: any)=>{try{sp.setAttribute(a.name,a.value);}catch(e){console.warn('[JU] caught error',e);}});
      while(el.firstChild)sp.appendChild(el.firstChild);
      if(el.parentNode)el.parentNode.replaceChild(sp,el);
      el=sp;
      el.style.removeProperty('font-weight');
      el.style.removeProperty('font-style');
    }
    if(kind==='bold'){el.style.removeProperty('font-weight');return;}
    if(kind==='italic'){el.style.removeProperty('font-style');return;}
    if(kind==='underline'){fmtDropDecoration(el,'underline');return;}
    if(kind==='strike'){fmtDropDecoration(el,'line-through');return;}
    const prop=_FMT_STYLE_PROP[kind];
    if(!prop)return;
    el.style.removeProperty(prop);
    if(el.tagName==='FONT'){
      if(kind==='color'&&el.hasAttribute('color'))el.removeAttribute('color');
      if(kind==='fontSize'&&el.hasAttribute('size'))el.removeAttribute('size');
      if(kind==='bg'&&el.hasAttribute('bgcolor'))el.removeAttribute('bgcolor');
    }
  });
  hit.forEach(fmtUnwrapElement);
}

export function normalizeFormatHtml(html: any, kinds: any): string {
  const frag=fmtFragment(html);
  (Array.isArray(kinds)?kinds:[kinds]).forEach((k: string)=>fmtClearKind(frag,k));
  fmtTidy(frag);
  const box=document.createElement('div');
  box.appendChild(frag);
  return box.innerHTML;
}

/* 从纯 HTML 字符串提取格式（多选节点格式刷的取值端） */
export function captureFormatFromHtml(html: any): any {
  const fmt: any={fontSize:null,color:null,bg:null,bold:false,italic:false,underline:false,strike:false};
  fmtEachElement(fmtFragment(html),(el: any)=>{
    const st=el.style||{};
    if(!fmt.fontSize&&st.fontSize)fmt.fontSize=st.fontSize;
    if(!fmt.color&&st.color)fmt.color=st.color;
    if(!fmt.bg&&st.backgroundColor&&!fmtIsTransparent(st.backgroundColor))fmt.bg=st.backgroundColor;
    const tagKind=_FMT_TAG_KIND[el.tagName];
    if(tagKind)fmt[tagKind]=true;
    const fw=String(st.fontWeight||'');
    if(fw==='bold'||fw==='bolder'||parseInt(fw,10)>=600)fmt.bold=true;
    if(String(st.fontStyle||'').toLowerCase().includes('italic'))fmt.italic=true;
    const dec=String(st.textDecoration||st.textDecorationLine||'');
    if(dec.includes('underline'))fmt.underline=true;
    if(dec.includes('line-through'))fmt.strike=true;
  });
  return fmt;
}

export function hasAnyFormat(fmt: any): boolean {
  return !!(fmt&&(fmt.fontSize||fmt.color||fmt.bg||fmt.bold||fmt.italic||fmt.underline||fmt.strike));
}

/* 把格式批量写进纯 HTML 字符串（多选节点格式刷的应用端）：先清除同类旧样式再包裹 */
export function applyFormatToHtml(html: any, fmt: any): string {
  const src=String(html==null?'':html);
  if(!fmt)return src;
  const bgOn=!!fmt.bg&&!fmtIsTransparent(fmt.bg);
  const kinds: string[]=[];
  if(fmt.fontSize)kinds.push('fontSize');
  if(fmt.color)kinds.push('color');
  if(bgOn)kinds.push('bg');
  if(fmt.bold)kinds.push('bold');
  if(fmt.italic)kinds.push('italic');
  if(fmt.underline)kinds.push('underline');
  if(fmt.strike)kinds.push('strike');
  let inner=normalizeFormatHtml(src,kinds)||'<br>';
  if(fmt.bold)inner='<b>'+inner+'</b>';
  if(fmt.italic)inner='<i>'+inner+'</i>';
  if(fmt.underline)inner='<u>'+inner+'</u>';
  if(fmt.strike)inner='<s>'+inner+'</s>';
  const style: string[]=[];
  if(fmt.fontSize)style.push('font-size:'+fmt.fontSize);
  if(fmt.color)style.push('color:'+fmt.color);
  if(bgOn)style.push('background-color:'+fmt.bg);
  if(style.length)inner='<span style="'+style.join(';')+'">'+inner+'</span>';
  return inner;
}

/* 右侧栏批量格式化单步：按钮类命令（粗斜下删）按当前格式幂等切换，样式类命令先清后包 */
export function batchFormatHtml(html: any, cmdStr: any, val: any): string {
  const src=String(html==null?'':html);
  if(cmdStr==='bold'||cmdStr==='italic'||cmdStr==='underline'||cmdStr==='strike'){
    const clean=normalizeFormatHtml(src,[cmdStr])||'<br>';
    if(captureFormatFromHtml(src)[cmdStr])return clean;
    const tag=cmdStr==='bold'?'b':(cmdStr==='italic'?'i':(cmdStr==='underline'?'u':'s'));
    return '<'+tag+'>'+clean+'</'+tag+'>';
  }
  const kind=cmdStr==='fontSize'?'fontSize':(cmdStr==='color'?'color':'bg');
  const prop=_FMT_STYLE_PROP[kind];
  const clean=normalizeFormatHtml(src,[kind])||'<br>';
  return '<span style="'+prop+':'+val+'">'+clean+'</span>';
}

/* ============================================================
   格式刷
   ============================================================ */
export type PainterState = {
  active: boolean;
  fmt: any;
  srcKey: string | null;
  btn: any;
  batchMode: boolean;
  srcIds: any[] | null;
};

/* 稳定 holder（受控结构差异见文件头说明）：字段复位而非对象替换，保证外部注入引用活性 */
export const _fmtPainter: PainterState = {active:false,fmt:null,srcKey:null,btn:null,batchMode:false,srcIds:null};
let _fpTimer: any = null;

function resetPainter(): void {
  _fmtPainter.active=false;
  _fmtPainter.fmt=null;
  _fmtPainter.srcKey=null;
  _fmtPainter.btn=null;
  _fmtPainter.batchMode=false;
  _fmtPainter.srcIds=null;
}

export function selectionKey(): string {
  const sel=window.getSelection();
  if(!sel||sel.rangeCount===0)return '';
  const r=sel.getRangeAt(0);
  const path=(n: any)=>{
    let el=n.nodeType===1?n:(n.parentElement||null);
    const p: number[]=[];
    while(el&&el!==document.body){
      const parent=el.parentElement;
      p.unshift(parent?Array.from(parent.children).indexOf(el):-1);
      el=parent;
    }
    return p.join('.');
  };
  return path(r.startContainer)+'|'+r.startOffset+'|'+path(r.endContainer)+'|'+r.endOffset+'|'+sel.toString();
}

export function captureFormat(): any {
  const sel=window.getSelection();
  if(!sel||sel.rangeCount===0||sel.isCollapsed)return null;
  const range=sel.getRangeAt(0);
  let node: any=range.startContainer;
  if(node.nodeType===3)node=node.parentElement;
  if(!node||node.nodeType!==1||!node.closest||!node.closest('[contenteditable="true"]'))return null;
  const root=node.closest('[contenteditable="true"]');
  const fmt: any={fontSize:null,color:null,bg:null,bold:false,italic:false,underline:false,strike:false};
  let el=node;
  while(el&&el!==root){
    const st=el.style||{};
    if(!fmt.fontSize&&st.fontSize)fmt.fontSize=st.fontSize;
    if(!fmt.color&&st.color)fmt.color=st.color;
    if(!fmt.bg&&st.backgroundColor)fmt.bg=st.backgroundColor;
    const cs=getComputedStyle(el);
    if(cs.fontWeight==='bold'||parseInt(cs.fontWeight)>=600)fmt.bold=true;
    if(cs.fontStyle==='italic')fmt.italic=true;
    const dec=cs.textDecorationLine||'';
    if(dec.includes('underline'))fmt.underline=true;
    if(dec.includes('line-through'))fmt.strike=true;
    el=el.parentElement;
  }
  if(!fmt.fontSize&&!fmt.color&&!fmt.bg&&!fmt.bold&&!fmt.italic&&!fmt.underline&&!fmt.strike)return null;
  return fmt;
}

/**
 * 格式刷应用端：把拾取到的格式逐属性写进当前选区。
 * 逐属性走同一选区样式引擎（而不是拼一个 span 一次性 surroundContents），
 * 因此目标文字上已有的其它格式不会被整体覆盖，也不会因跨标签边界而失败。
 */
export function applyCapturedFormat(fmt: any): boolean {
  if(!fmt)return false;
  const sel=window.getSelection();
  if(!sel||sel.rangeCount===0||sel.isCollapsed)return false;
  let ok=false;
  if(fmt.fontSize)ok=applyCustomStyleToSelection('font-size',fmt.fontSize)||ok;
  if(fmt.color)ok=applyCustomStyleToSelection('color',fmt.color)||ok;
  if(fmt.bg&&!fmtIsTransparent(fmt.bg))ok=applyCustomStyleToSelection('background-color',fmt.bg)||ok;
  if(fmt.bold)ok=applyCustomStyleToSelection('font-weight','bold')||ok;
  if(fmt.italic)ok=applyCustomStyleToSelection('font-style','italic')||ok;
  const dec: string[]=[];
  if(fmt.underline)dec.push('underline');
  if(fmt.strike)dec.push('line-through');
  if(dec.length)ok=applyCustomStyleToSelection('text-decoration-line',dec.join(' '))||ok;
  return ok;
}

export function deactivatePainter(): void {
  const btn=(_fmtPainter&&_fmtPainter.btn)||null;
  resetPainter();
  if(btn)btn.classList.remove('on');
  if(_fpTimer){clearTimeout(_fpTimer);_fpTimer=null;}
}

export function toggleFormatPainter(btn: any): void {
  if(_fmtPainter.active){deactivatePainter();deps.toast('已取消格式刷');return;}
  const fmt=captureFormat();
  if(!fmt){deps.toast('请先选中带格式的文字（如加粗/颜色/字号）');return;}
  resetPainter();
  _fmtPainter.active=true;_fmtPainter.fmt=fmt;_fmtPainter.srcKey=selectionKey();_fmtPainter.btn=btn;_fmtPainter.batchMode=false;_fmtPainter.srcIds=null;
  btn.classList.add('on');
  deps.toast('已拾取格式，请选中目标文字后将自动应用');
}

/* ---- 多选节点格式刷（batchMode）：取第一个选中节点的格式，第二次点击批量应用 ---- */
export function captureFormatFromNodes(ids: any): any {
  const list=Array.isArray(ids)?ids:[];
  for(let i=0;i<list.length;i++){
    const n=(deps.state&&deps.state.nodes)?deps.state.nodes[list[i]]:null;
    if(!n)continue;
    const fmt=captureFormatFromHtml(n.text||'');
    if(hasAnyFormat(fmt))return fmt;
  }
  return null;
}

export function applyFormatToNodes(ids: any, fmt: any): boolean {
  if(typeof deps.commit!=='function'||!fmt)return false;
  const list=(Array.isArray(ids)?ids:[]).filter(Boolean);
  if(!list.length)return false;
  deps.commit((s: any)=>{
    list.forEach((id: any)=>{
      const n=s.nodes[id];
      if(!n)return;
      n.text=applyFormatToHtml(n.text||'',fmt);
      n.updatedAt=(typeof deps.nowSeq==='function')?deps.nowSeq():Date.now();
    });
  },{snapshot:true,dirtyText:true,dirtyDocs:null});
  if(typeof deps.forceRender==='function')deps.forceRender();
  return true;
}

export function toggleBatchPainter(btn: any, ids: any): void {
  const list=(Array.isArray(ids)?ids:[]).filter(Boolean);
  if(_fmtPainter.active&&_fmtPainter.batchMode){
    const targets=list.length?list:(Array.isArray(_fmtPainter.srcIds)?_fmtPainter.srcIds:[]);
    const fmt=_fmtPainter.fmt;
    deactivatePainter();
    const ok=applyFormatToNodes(targets,fmt);
    deps.toast(ok?('已批量应用格式刷（'+targets.length+' 个节点）'):'无法批量应用格式刷');
    return;
  }
  const fmt=list.length?captureFormatFromNodes(list):null;
  if(!fmt){deps.toast('请先给选中节点的文字设置格式（加粗 / 颜色 / 字号等）');return;}
  if(_fmtPainter.active)deactivatePainter();
  resetPainter();
  _fmtPainter.active=true;_fmtPainter.fmt=fmt;_fmtPainter.srcKey=null;_fmtPainter.btn=btn||null;_fmtPainter.batchMode=true;_fmtPainter.srcIds=list.slice();
  if(btn)btn.classList.add('on');
  deps.toast('已拾取节点格式，请再次点击「格式刷」批量应用');
}

export function onSelectionChangeForPainter(): void {
  if(!_fmtPainter.active||_fmtPainter.batchMode)return;
  const sel=window.getSelection();
  if(!sel||sel.rangeCount===0||sel.isCollapsed)return;
  const t=String(sel);
  if(!t||!t.trim())return;
  const key=selectionKey();
  if(key===_fmtPainter.srcKey)return; /* 仍是源选区 */
  if(_fpTimer)clearTimeout(_fpTimer);
  _fpTimer=setTimeout(()=>{
    if(!_fmtPainter.active)return;
    const sel2=window.getSelection();
    if(!sel2||sel2.rangeCount===0||sel2.isCollapsed)return;
    if(selectionKey()===_fmtPainter.srcKey)return;
    const ok=applyCapturedFormat(_fmtPainter.fmt);
    deactivatePainter();
    deps.toast(ok?'已应用格式刷':'无法在目标文字上应用格式');
  },250);
}

export function onKeyForPainter(e: KeyboardEvent): void {
  if(e.key==='Escape'&&_fmtPainter.active){deactivatePainter();deps.toast('已取消格式刷');}
}

/**
 * 绑定格式刷全局监听（对应产品 `bindTools` 内 `__fmtPainterBound` 幂等段）。
 * Esc 用捕获阶段：正文 contenteditable 的 keydown 会 stopPropagation，冒泡监听收不到。
 */
export function bindPainterListeners(): void {
  if(!(document as any).__fmtPainterBound){
    (document as any).__fmtPainterBound=true;
    document.addEventListener('selectionchange',()=>onSelectionChangeForPainter());
    document.addEventListener('keydown',(e: KeyboardEvent)=>onKeyForPainter(e),true);
  }
}
