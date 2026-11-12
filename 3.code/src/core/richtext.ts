/**
 * M1-1c · 富文本适配层（安全白名单 / 清洗 / execCommand 包装 / 粘贴解析）
 *
 * 来源（逐行对应 canonical v2.0-t3.html）：
 *   - 1733-1759  _execWarnAtMap / _warnExecFail / safeExec
 *   - 1760-1799  SAFE_TAGS / SAFE_ATTRS / CSS_WHITELIST / sanitizeStyle
 *   - 1800-1854  sanitizeHtml（非白名单标签文本回填 + 表格 foster-parenting 幂等）
 *   - 1855-1890  parsePasteLines
 *   - 1892-1912  trimPasteHtml
 *
 * 约束（零漂移）：白名单集合、属性清洗顺序、CSS 数值 clamp 上限、data:image 体积阈值
 *   （700,000 字符）、XSS 诱因过滤（expression / behavior / -moz-binding / javascript: / vbscript:）
 *   逐字保留；仅追加 export 与 TS 类型注解（any 为纯类型层，运行期无行为差异）。
 *
 * 依赖显式化（M1-1d 口径）：原 `_warnExecFail` 直接调用同作用域的全局 `toast()`，
 *   本模块改为经 `RichtextDeps.toast` 端口调用，由 src/main.ts 装配期注入（不再隐式读取全局）。
 */

/* ============================================================
   依赖注入容器（仅 toast：execCommand 失败的可视提示）
   ============================================================ */
export interface RichtextDeps {
  /** 轻提示（对应产品 `toast(msg)`） */
  toast: (msg: any) => void;
  /**
   * 内联样式写入成功后把 DOM 结果**显式**写回数据模型（等价产品的 `updateText`）。
   *
   * 装配期注入 `main.ts` 的 `syncActiveEditor`：noNotify 静默提交 ——
   * state / 撤销栈 / 落盘同步更新，但不广播 notify、不调度渲染，
   * 因此写入后的 DOM 与原生选区原地保留，下一次命令仍有有效 Range。
   */
  commitInlineStyle?: () => void;
}

/** 模块内安全占位（加载即不抛错；真实实现在 src/main.ts 装配时注入）。 */
export const deps: RichtextDeps = {
  toast: () => {},
};

/** 依赖注入入口（装配期回填真实实现；未注入时保持静默占位）。 */
export function injectRichtextDeps(patch: Partial<RichtextDeps>): void {
  Object.assign(deps, patch);
}

/* ============================================================
   白名单常量
   ============================================================ */

/** 允许保留的标签集合（产品件 1760 逐字对齐）。 */
export const SAFE_TAGS: Set<string> = new Set(['B','I','U','S','STRONG','EM','BR','SPAN','FONT','DIV','P','H1','H2','H3','H4','H5','H6','UL','OL','LI','BLOCKQUOTE','CODE','PRE','TABLE','THEAD','TBODY','TR','TH','TD','A','IMG','MARK','SUB','SUP','HR','DEL','INS','SMALL']);

/** 标签 → 允许属性名（低级 names，`'*'` 为全标签公共集；产品件 1761 逐字对齐）。 */
export const SAFE_ATTRS: Record<string, string[]> = {'A':['href','title','target','rel'],'IMG':['src','alt','title','width','height'],'FONT':['color','size','face'],'SPAN':['style'],'DIV':['style'],'P':['style'],'*':['style']};

/* 【P0-1 S3】CSS 属性白名单：仅允许排版类属性，剥离 position/z-index/inset/background 等覆盖类属性 */
/* 【D-02 显式放行】`color` / `background-color` / `font-size` / `font-weight` 必须在白名单内——
   否则 `sanitizeStyle` 会把富文本三项叠加（颜色 / 背景 / 字号 / 加粗）逐条丢弃，
   表现为「设了颜色，再设背景就没了」。此集合即该契约的唯一来源，改白名单必须同步本文注释。 */
export const CSS_WHITELIST: Set<string> = new Set(['color','background-color','font-size','font-weight','font-style','text-decoration','text-align','line-height','border','border-color','border-width','border-style','margin','margin-top','margin-right','margin-bottom','margin-left','padding','padding-top','padding-right','padding-bottom','padding-left','width','max-width','height','max-height','border-radius','opacity']);

/* ============================================================
   颜色值归一（D-02 / D-08 真实成因）
   ------------------------------------------------------------
   现象：一次选区施加「字体颜色 → 字号 → 背景色 → 加粗」后，span 序列化为
        background-color: color(srgb 0.2 0.396078 0.298039 / 0.14)
   成因：Chromium 150+ 的 `getComputedStyle().backgroundColor` 对带 alpha 的颜色
        返回 CSS Color 4 的 `color(srgb r g b / a)` 语法；`_baseInlineDecls`
        把它原样写回 style，于是 DOM 上留下旧内核（WebView2 老版本 / 国产内核 /
        老 Electron）无法解析的声明 ⇒ 颜色静默失效，看起来就是「颜色不叠加」。
   修复：写入 style 之前统一归一为 #RRGGBB（a >= 1）或 rgba(r,g,b,a)（a < 1）。
        · `color(srgb …)` 的 r/g/b 为 0~1 浮点 ⇒ ×255 取整；百分比按 ×2.55 取整；
        · `rgb(r g b)` / `rgb(r g b / a)` 空格语法同样支持；
        · 已是 hex / 命名色 / 其它语法（如 color-mix）一律原样返回，不做猜测。
   ============================================================ */

/** 需要做颜色归一的属性集合（其余属性只做去空白）。 */
export const COLOR_STYLE_PROPS: Set<string> = new Set([
  'color',
  'background-color',
  'border-color',
  'text-decoration-color',
  'caret-color',
  'outline-color',
]);

/** 颜色通道 token → 0~255 整数（percent / 0~1 浮点 / 0~255 整数三种口径）。 */
function _colorChannelUnit(token: string, srgbFloat: boolean): number | null {
  const t = String(token == null ? '' : token).trim();
  if (!t) return null;
  if (t === 'none') return 0;
  if (/%$/.test(t)) {
    const p = parseFloat(t);
    if (!isFinite(p)) return null;
    return Math.round(Math.max(0, Math.min(100, p)) * 2.55);
  }
  const n = parseFloat(t);
  if (!isFinite(n)) return null;
  /* srgb 口径恒为 0~1；其它写法仅在「带小数点且落在 0~1」时按 0~1 解释
     （`rgb(1 2 3)` 仍按 0~255 处理，避免把近黑色误放大成白色）。 */
  const scaled = srgbFloat || (t.indexOf('.') >= 0 && n >= 0 && n <= 1) ? n * 255 : n;
  return Math.round(Math.max(0, Math.min(255, scaled)));
}

/** alpha token → 0~1（percent / 浮点两种口径；缺省返回 null = 完全不透明）。 */
function _colorAlphaUnit(token: any): number | null {
  if (token == null) return null;
  const t = String(token).trim();
  if (!t) return null;
  if (t === 'none') return 1;
  if (/%$/.test(t)) {
    const p = parseFloat(t);
    return isFinite(p) ? Math.max(0, Math.min(1, p / 100)) : null;
  }
  const n = parseFloat(t);
  return isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
}

/** 0~255 三通道 + alpha → `#RRGGBB`（不透明）或 `rgba(r, g, b, a)`（半透明）。 */
function _cssColorFromChannels(r: number, g: number, b: number, a: number | null): string {
  const hex = (n: number): string => (n < 16 ? '0' : '') + n.toString(16);
  if (a != null && a < 1) return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + Math.round(a * 1000) / 1000 + ')';
  return '#' + hex(r) + hex(g) + hex(b);
}

/**
 * 任意颜色值 → `#RRGGBB` / `rgba(r,g,b,a)`（D-02）。
 * 已是 hex / 命名色 / 不认识的语法时原样返回（空值返回空串）。
 */
export function normalizeColorValue(raw: any): string {
  const input = String(raw == null ? '' : raw).trim();
  if (!input) return '';
  const low = input.toLowerCase();
  /* ① color(srgb r g b / a) —— CSS Color 4，Chromium 最新 computed 口径 */
  let m = low.match(/^color\(\s*srgb\s+([^\s/)]+)\s+([^\s/)]+)\s+([^\s/)]+)\s*(?:\/\s*([^\s)]+))?\s*\)$/);
  if (m) {
    const r = _colorChannelUnit(m[1], true);
    const g = _colorChannelUnit(m[2], true);
    const b = _colorChannelUnit(m[3], true);
    if (r != null && g != null && b != null) return _cssColorFromChannels(r, g, b, _colorAlphaUnit(m[4]));
    return input;
  }
  /* ② rgb(...) / rgba(...)：逗号语法与空格语法都接受 */
  m = low.match(/^rgba?\(\s*([^)]+)\)$/);
  if (m) {
    const body = m[1].replace(/\//g, ' ');
    const parts = body.split(/\s*,\s*|\s+/).filter((p: string) => p.length > 0);
    if (parts.length >= 3) {
      const r = _colorChannelUnit(parts[0], false);
      const g = _colorChannelUnit(parts[1], false);
      const b = _colorChannelUnit(parts[2], false);
      if (r != null && g != null && b != null) {
        return _cssColorFromChannels(r, g, b, parts.length >= 4 ? _colorAlphaUnit(parts[3]) : null);
      }
    }
    return input;
  }
  return input;
}

/**
 * 单条样式值归一：颜色属性走 `normalizeColorValue`，其余属性只去首尾空白。
 * `applyInlineStyle` / `applyCustomStyleToSelection` / `_baseInlineDecls` 共用，
 * 保证「写进 style 的每一处颜色」都经过同一个归一函数（单测入口）。
 */
export function normalizeInlineDeclValue(styleProp: string, styleValue: any): string {
  const raw = String(styleValue == null ? '' : styleValue).trim();
  if (!raw) return '';
  /* cssPropertyName 为函数声明（提升），此处可直接复用：驼峰与 kebab 两种写法都归一 */
  const prop = cssPropertyName(styleProp);
  if (COLOR_STYLE_PROPS.has(prop)) return normalizeColorValue(raw);
  return raw;
}

/* ============================================================
   execCommand 安全包装（限频告警）
   ============================================================ */

/** FIX-EXEC-2: 按命令分组的限频——全局单变量会让 bold 失败后的 30s 内 italic/underline 等其它命令的失败提示被静默吞掉。 */
export const _execWarnAtMap: Map<string, number> = new Map();

/**
 * execCommand 失败告警（对应产品 `_warnExecFail`）。
 * quiet 失败不占用 toast 限频名额：连击时先失败的 styleWithCSS 不会吞掉后续 bold/italic 的提示。
 */
export function _warnExecFail(cmd: string, quiet?: boolean): void {
  const _now = Date.now();
  if (quiet) {
    try{console.warn('[JU] execCommand 静默失败（无害）:',cmd);}catch(e){console.warn('[JU] caught error', e);}
    return;
  }
  const _last = _execWarnAtMap.get(cmd) || 0;
  if (_now - _last > 30000) {
    _execWarnAtMap.set(cmd, _now);
    try{console.warn('[JU] execCommand 执行失败（命令已废弃或当前宿主不支持）:',cmd);}catch(e){console.warn('[JU] caught error', e);}
    try{deps.toast('当前浏览器不支持该编辑命令');}catch(e){console.warn('[JU] caught error', e);}
  }
}

/** document.execCommand 包装（失败不抛错，只限频告警；返回 boolean 与产品一致）。 */
export function safeExec(cmd: string, val?: any): boolean {
  try{
    if(typeof document.execCommand !== 'function'){_warnExecFail(cmd, true);return false;}
    const _ok = document.execCommand(cmd, false, val != null ? val : (null as any));
    if(!_ok)_warnExecFail(cmd, cmd === 'styleWithCSS' || cmd === 'copy' || cmd === 'cut');
    return _ok;
  }catch(e){_warnExecFail(cmd, cmd === 'styleWithCSS' || cmd === 'copy' || cmd === 'cut');return false;}
}

/* ============================================================
   样式 / HTML 清洗
   ============================================================ */

/** 单条 style 串清洗（属性白名单 + 尺寸数值 clamp + XSS 诱因过滤）。 */
export function sanitizeStyle(raw: any): string {
  let s = String(raw||'')
    .replace(/expression\s*\(/gi,'')
    .replace(/behavior\s*:/gi,'')
    .replace(/-moz-binding\s*:/gi,'')
    .replace(/url\s*\(\s*['"]?\s*(?:javascript|vbscript)\s*:/gi,'url(blocked:')
    .replace(/url\s*\(\s*['"]?\s*data\s*:(?!image\/(?:png|jpe?g|gif|webp))/gi,'url(blocked:');
  const kept: string[] = [];
  const re = /([\w-]+)\s*:\s*([^;]+)/g; let m: RegExpExecArray | null;
  while((m = re.exec(s))){
    const prop = m[1].toLowerCase().trim();
    let val = m[2].trim();
    if(!CSS_WHITELIST.has(prop))continue;
    if(/url\s*\(|expression|javascript|vbscript|behavior/gi.test(val))continue;
    if(prop === 'opacity'){
      const num = parseFloat(val);
      if(isNaN(num)||num<0||num>1)continue;
      kept.push('opacity:'+num);
      continue;
    }
    /* 【QA-P1-3】尺寸类属性数值 clamp：防布局 DoS（font-size:999999px / width:999999px 等）。
       白名单属性中尺寸类上限：font-size≤200px，其余宽高边距≤10000px。非数值/百分比/其他单位原样保留。
       FIX-P2-3: line-height/border-radius/letter-spacing 一并纳入数值上限（≤10000），
       防 line-height:999999px 撑爆行高、border-radius:999999px 圆角穿透、letter-spacing 巨量字符间距。 */
    if(/^(font-size|width|height|margin|padding|border-width|line-height|border-radius|letter-spacing)/i.test(prop)){
      const mm = val.match(/(-?\d+(?:\.\d+)?)/);
      if(mm){
        const num = parseFloat(mm[1]);
        const cap = prop.toLowerCase() === 'font-size' ? 200 : 10000;
        if(!isNaN(num) && num > cap)val = val.replace(mm[1], String(cap));
      }
    }
    /* 【D-02】颜色类声明统一归一为 #RRGGBB / rgba()：白名单放行 color / background-color
       之后，若把 `color(srgb …)` 原样保留，旧内核会整条丢弃该声明。 */
    if(COLOR_STYLE_PROPS.has(prop))val = normalizeColorValue(val);
    kept.push(prop+':'+val);
  }
  return kept.join(';');
}

/* L16-W16 · 指令 7（Defect-D）：非白名单标签以文本节点回填。
   L19-Patch3：_sanTextEsc 退役——createTextNode 经 innerHTML 序列化天然转义，无需显式替换尖括号。 */
export function sanitizeHtml(html: string): string {
  if(!html)return '';
  if(!/<[a-z!/]/i.test(html))return html;
  try{
    const doc = new DOMParser().parseFromString('<div>'+html+'</div>','text/html');
    const root: any = doc.body.firstChild;
    if(!root)return '';
    (function walk(node: any){
      Array.from(node.childNodes as any[]).forEach((ch: any)=>{
        if(ch.nodeType === 1){
          const tag = String(ch.tagName || '').toUpperCase();
          if(!SAFE_TAGS.has(tag)){
            /* L16-W16 · 指令 7（Defect-D）：非白名单标签以文本节点回填（文本节点天然安全）。
               表格类父上下文（TABLE/THEAD/TBODY/TFOOT/TR/COLGROUP）中的文本在再次解析时会被
               foster parenting 移出表格，故按解析器同口径前置于最近 TABLE 之前，保证回填结果幂等。 */
            const rawText = ch.textContent || '';
            const textNode = doc.createTextNode(rawText);
            const par = ch.parentNode;
            if(!par)return;
            const ptag = par.nodeType === 1 ? (par.tagName || '') : '';
            if(ptag === 'TABLE' || ptag === 'THEAD' || ptag === 'TBODY' || ptag === 'TFOOT' || ptag === 'TR' || ptag === 'COLGROUP'){
              let tbl: any = par;
              while(tbl && tbl.tagName !== 'TABLE')tbl = tbl.parentNode;
              if(tbl && tbl.parentNode && tbl !== ch){tbl.parentNode.insertBefore(textNode, tbl);par.removeChild(ch);return;}
            }
            par.replaceChild(textNode, ch);return;
          }
          const allowed: string[] = (SAFE_ATTRS[tag]||[]).concat(SAFE_ATTRS['*']||[]);
          Array.from(ch.attributes as any[]).forEach((at: any)=>{
            const name = String(at.name).toLowerCase();
            if(name.startsWith('on')){ch.removeAttribute(at.name);return;}
            if(name === 'class'){ch.removeAttribute(at.name);return;} /* 【P0-1】剥离 class 属性 */
            if(!allowed.includes(name)){ch.removeAttribute(at.name);return;}
            if(name === 'href' || name === 'src'){
              const v = (at.value||'').trim().toLowerCase();
              const rawVal = (at.value||'');
              const okPrefix = ['http://','https://','/','./','../','#','mailto:','tel:'];
              const isDataImg = v.startsWith('data:image/png;')||v.startsWith('data:image/jpeg;')||v.startsWith('data:image/gif;')||v.startsWith('data:image/webp;');
              /* 【F15/fixed19】data: 图片大小上限：base64 长度 >700k 字符(≈500KB) 替换为文本占位，避免整库膨胀 */
              if(isDataImg && rawVal.length > 700000){ch.parentNode.replaceChild(doc.createTextNode('[图片过大已省略]'),ch);return;}
              if(!isDataImg && !okPrefix.some(p=>v.startsWith(p)))ch.removeAttribute(at.name);
            }
            if(name === 'style'){
              ch.setAttribute('style', sanitizeStyle(at.value));
            }
          });
          walk(ch);
        }else if(ch.nodeType === 8){ch.parentNode.removeChild(ch);}
      });
    })(root);
    return root.innerHTML;
  }catch(e){return String(html).replace(/<[^>]*>/g,'');}
}

/* ============================================================
   粘贴解析 / HTML 修剪
   ============================================================ */

/** 粘贴解析结果（对应产品 parsePasteLines 的返回形状）。 */
export interface PasteParseResult {
  lines: string[];
  hasRichFormat: boolean;
  html: string;
  plain: string;
  tree: IndentedOutlineNode[] | null;
}

/** DataTransfer → 行数组 + 富文本标记（对应产品 `parsePasteLines(dt)`）。 */
export function parsePasteLines(dt: any): PasteParseResult {
  const out: PasteParseResult = { lines: [], hasRichFormat: false, html: '', plain: '', tree: null };
  if(!dt) return out;
  out.html = dt.getData('text/html') || '';
  out.plain = dt.getData('text/plain') || '';
  let lines: string[] = [];
  if(out.html){
    try{
      const doc = new DOMParser().parseFromString('<div>'+out.html+'</div>','text/html');
      const root: any = doc.body.firstChild;
      if(root){
        const richTags = ['b','strong','i','em','u','s','span','font','mark','sub','sup','code','a','img'];
        for(const t of richTags){ if(root.querySelector(t)){ out.hasRichFormat = true; break; } }
        let acc = '';
        (function walk(node: any){
          if(node.nodeType === 3){ acc += node.nodeValue; return; }
          if(node.nodeType !== 1) return;
          const tag = String(node.tagName || '').toLowerCase();
          if(tag === 'br'){ acc += '\n'; return; }
          const isBlock = ['div','p','li','h1','h2','h3','h4','h5','h6','tr','blockquote','pre'].indexOf(tag) >= 0;
          if(isBlock && acc && acc.charAt(acc.length-1) !== '\n') acc += '\n';
          for(let i=0;i<node.childNodes.length;i++) walk(node.childNodes[i]);
          if(isBlock && acc.charAt(acc.length-1) !== '\n') acc += '\n';
        })(root);
        lines = acc.split('\n');
      }
    }catch(e){ lines = []; }
  }
  if(!lines.length && out.plain){
    lines = out.plain.split(/\r\n?|\n/);
  }
  while(lines.length && !String(lines[0]).trim()) lines.shift();
  while(lines.length && !String(lines[lines.length-1]).trim()) lines.pop();
  out.lines = lines;
  out.tree = parseHtmlOutline(out.html);
  if (!out.tree) out.tree = parseIndentedOutline(out.plain);
  return out;
}

/** 解析 HTML 嵌套列表 / 平铺 data-indent，返回大纲树；无法识别时返回 null。 */
function parseHtmlOutline(html: string): IndentedOutlineNode[] | null {
  if (!html) return null;
  let root: any;
  try { root = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html').body.firstChild; } catch (e) { return null; }
  if (!root) return null;

  const kids = (el: any): any[] => Array.from((el && el.childNodes) || []).filter((n: any) => n && n.nodeType === 1);
  const isTag = (el: any, ...names: string[]): boolean => names.indexOf(String((el && el.tagName) || '').toLowerCase()) >= 0;

  // 1) 嵌套 <ul>/<ol>/<li>（列表可被 div 等包裹，向下递归查找）
  function walkList(el: any, parentChildren: IndentedOutlineNode[]): void {
    for (const li of kids(el).filter((c: any) => isTag(c, 'li'))) {
      const node: IndentedOutlineNode = { text: '', children: [] };
      let text = '';
      const childLists: any[] = [];
      for (const child of Array.from(li.childNodes || []) as any[]) {
        if (child.nodeType === 3) {
          text += child.nodeValue || '';
        } else if (child.nodeType === 1) {
          if (isTag(child, 'ul', 'ol')) childLists.push(child);
          else text += child.textContent || '';
        } else {
          text += child.textContent || '';
        }
      }
      node.text = text.trim();
      for (const list of childLists) walkList(list, node.children);
      parentChildren.push(node);
    }
  }

  const topLists: any[] = [];
  (function scan(el: any): void {
    for (const c of kids(el)) {
      if (isTag(c, 'ul', 'ol')) topLists.push(c);
      else scan(c);
    }
  })(root);
  if (topLists.length) {
    const result: IndentedOutlineNode[] = [];
    for (const list of topLists) walkList(list, result);
    return result.length ? result : null;
  }

  // 2) 平铺 <div>/<p> + data-indent（缺省沿用上一节点深度，深度最多上浮一层）
  const items: { text: string; depth: number }[] = [];
  (function walk(el: any): void {
    for (const c of kids(el)) {
      if (!isTag(c, 'div', 'p')) { walk(c); continue; }
      const raw = c.getAttribute && c.getAttribute('data-indent');
      const ind = raw == null || raw === '' ? NaN : parseInt(raw, 10);
      items.push({ text: String(c.textContent || '').trim(), depth: isNaN(ind) ? (items.length ? items[items.length - 1].depth : 0) : ind });
    }
  })(root);

  const roots: IndentedOutlineNode[] = [];
  const stack: { depth: number; node: IndentedOutlineNode }[] = [];
  for (const it of items) {
    const depth = Math.max(0, Math.min(it.depth, stack.length ? stack[stack.length - 1].depth + 1 : 0));
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const node: IndentedOutlineNode = { text: it.text, children: [] };
    (stack.length ? stack[stack.length - 1].node.children : roots).push(node);
    stack.push({ depth, node });
  }
  return roots.length ? roots : null;
}

/** 大纲粘贴节点（纯文本按行首缩进解析出的层级树）。 */
export interface IndentedOutlineNode {
  text: string;
  children: IndentedOutlineNode[];
}

/**
 * 多行纯文本 → 缩进节点树：行首空格 / \t 计算层级（\t 记 2 空格），
 * 先按全文最小缩进归一，避免整体右移的剪贴板被误判为单根。
 * 空输入 / 单行返回 null；其余（含无缩近平铺多行）始终返回 roots，平铺行落为同级根节点。
 */
export function parseIndentedOutline(text: string): IndentedOutlineNode[] | null {
  const raw = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
  const items: { lead: number; text: string }[] = [];
  for (const line of raw) {
    if (!line.trim()) continue;
    const prefix = (line.match(/^[ \t]*/) || [''])[0];
    const lead = prefix.replace(/\t/g, '  ').length;
    const rawText = line.trim();
    // 列表前缀仅在“标记 + 空白”时剥离，避免误删 "-abc"
    const stripped = rawText.replace(/^(?:[-*+]|\d+[.)])\s+/, '');
    items.push({ lead, text: stripped });
  }
  if (items.length < 2) return null;
  const base = Math.min(...items.map((it) => it.lead));
  const roots: IndentedOutlineNode[] = [];
  const stack: { indent: number; node: IndentedOutlineNode }[] = [];
  for (const it of items) {
    const indent = it.lead - base;
    const node: IndentedOutlineNode = { text: it.text, children: [] };
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else roots.push(node);
    stack.push({ indent, node });
  }
  return roots;
}

/**
 * 修剪粘贴 HTML 首尾空块/空行（对应产品 `trimPasteHtml(html)`）。
 */
export function trimPasteHtml(html: string): string {
  if(!html) return '';
  try{
    const doc = new DOMParser().parseFromString('<div>'+html+'</div>','text/html');
    const root: any = doc.body.firstChild;
    if(!root) return '';
    const isEmpty = (n: any): boolean => {
      if(!n) return true;
      if(n.nodeType === 3) return !String(n.nodeValue||'').trim();
      if(n.nodeType === 1){
        const tag = String(n.tagName || '').toLowerCase();
        if(tag === 'br') return true;
        if(!String(n.textContent||'').trim() && !(n.querySelector && n.querySelector('img'))) return true;
      }
      return false;
    };
    while(root.firstChild && isEmpty(root.firstChild)) root.removeChild(root.firstChild);
    while(root.lastChild && isEmpty(root.lastChild)) root.removeChild(root.lastChild);
    return root.innerHTML;
  }catch(e){ return html; }
}

/* ============================================================
   选区样式引擎（纯 DOM · Range 提取 + 内联样式合并）
   ------------------------------------------------------------
   【为什么彻底废弃 execCommand】
   Tauri 桌面版跑在 Edge WebView2 上，document.execCommand 已被判定废弃：
     · foreColor / hiliteColor / fontSize 执行时宿主会重建选区边界节点
       （拆开 <b>、把整段换成 <font>），此前写入的加粗 / 字号被一并抹掉，
       用户看到的就是「设了颜色，加粗失效」「设了字号，颜色没了」；
     · 这些命令还要求「活着的」原生选区，而点击颜色 / 字号浮层必然让选区塌陷。
   本引擎只做四步：抽取 Range → 逐节点合并 style → 原样插回 → 恢复选区。
   全程不重建祖先节点，因此「加粗 → 颜色 → 字号」可任意顺序、任意次数叠加。
   ============================================================ */

/** CSS 属性名归一化：`backgroundColor` / `background-color` 一律转成 kebab 形式。 */
export function cssPropertyName(styleProp: string): string {
  const s = String(styleProp == null ? '' : styleProp).trim();
  if (!s) return '';
  if (s.indexOf('-') >= 0) return s.toLowerCase();
  return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/** kebab → 驼峰（读取 CSSStyleDeclaration 成员时使用）。 */
export function cssPropertyCamel(styleProp: string): string {
  return cssPropertyName(styleProp).replace(/-([a-z])/g, (_m: string, c: string) => c.toUpperCase());
}

/**
 * 「等价于清除该属性」的取值判定。
 * transparent / rgba(0,0,0,0) 背景、font-weight:normal、text-decoration:none
 * 这类写入不是叠加而是擦除，直接走「移除声明」路径，避免层层嵌套灰底 / 双重加粗。
 */
export function isNeutralStyleValue(styleProp: string, styleValue: string): boolean {
  const prop = cssPropertyName(styleProp);
  const v = String(styleValue == null ? '' : styleValue).trim().toLowerCase();
  if (!v) return true;
  /* `inherit` / `initial` / `unset` 等价于「回到上级口径」：一律走移除声明路径，
     否则会写出一条把父级颜色 / 字号永久钉死的声明（清除按钮 + typing style 都要用到）。 */
  if (v === 'inherit' || v === 'initial' || v === 'unset' || v === 'revert') return true;
  if (v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || v === 'rgba(0,0,0,0)') return true;
  if (prop === 'font-weight') return v === 'normal' || v === '400';
  if (prop === 'font-style') return v === 'normal';
  if (prop === 'text-decoration-line' || prop === 'text-decoration') return v === 'none';
  return false;
}

/** Range 边界节点 → 最近的 contenteditable 宿主；不在正文编辑区时返回 null。 */
export function richtextHostOf(node: any): HTMLElement | null {
  if (!node) return null;
  const el: any = node.nodeType === 1 ? node : node.parentNode;
  if (!el || !el.closest) return null;
  return el.closest('[contenteditable="true"]') as HTMLElement | null;
}

/**
 * 取 Range 起点处**实际承载文字**的元素。
 *
 * 样式写入后选区边界常常落在元素边界上（startContainer = 父 DIV、startOffset = 子节点下标），
 * 此时对父 DIV 取 getComputedStyle 读到的是继承值，会误判成「格式没生效」：
 * 幂等切换（加粗 → 再点取消）会算错当前状态，表现为「再点一次加粗还是加粗」。
 * 这里沿起点向下钻到最深子节点，再取其父元素。
 */
export function deepElementAtRangeStart(range: Range | null): HTMLElement | null {
  if (!range) return null;
  let node: any = range.startContainer;
  let offset = range.startOffset;
  if (!node) return null;
  if (node.nodeType === 3) return node.parentElement || null;
  let guard = 0;
  while (node && node.nodeType === 1 && node.childNodes.length && guard++ < 200) {
    const idx = offset < node.childNodes.length ? offset : node.childNodes.length - 1;
    const child: any = node.childNodes[idx];
    if (!child) break;
    node = child;
    offset = 0;
  }
  if (!node) return null;
  if (node.nodeType === 3) return node.parentElement || null;
  return node.nodeType === 1 ? node : null;
}

/** 语义格式标签 → 等效内联属性（写中性值时需要把标签降级，否则 <b> 的加粗抹不掉）。 */
const _SEMANTIC_TAG_STYLE: Record<string, [string, string]> = {
  B: ['font-weight', 'bold'], STRONG: ['font-weight', 'bold'],
  I: ['font-style', 'italic'], EM: ['font-style', 'italic'],
  U: ['text-decoration-line', 'underline'],
  S: ['text-decoration-line', 'line-through'],
  STRIKE: ['text-decoration-line', 'line-through'],
  DEL: ['text-decoration-line', 'line-through'],
};

/* 【fix39】下划线与删除线共用 text-decoration-line：按词元增删，禁止整条覆盖。
   值语法：`underline` 增、`-line-through` 删、`none` 清空。 */
const _DECO_TOKENS = ['underline', 'overline', 'line-through', 'blink'];

/** 值 → 词元算子（非修饰属性返回 null）。 */
function _decorationTokenOps(prop: string, value: string): { add: string[]; del: string[]; clear: boolean } | null {
  if (prop !== 'text-decoration-line' && prop !== 'text-decoration') return null;
  const ops = { add: [] as string[], del: [] as string[], clear: false };
  String(value == null ? '' : value).toLowerCase().split(/\s+/).forEach((t: string) => {
    if (t === 'none') { ops.clear = true; return; }
    const tok = t.replace(/^[+-]/, '');
    if (!tok || _DECO_TOKENS.indexOf(tok) < 0) return;
    const bag = t.charAt(0) === '-' ? ops.del : ops.add;
    if (bag.indexOf(tok) < 0) bag.push(tok);
  });
  return ops;
}

/** 词元算子落到词元表上：clear 清空，del 逐项剔除，add 逐项追加（不产生重复词元）。 */
function _mergeDecorationTokens(tokens: string[], ops: any): string[] {
  const out = ops && ops.clear ? [] : tokens.slice();
  (ops && ops.del ? ops.del : []).forEach((t: string) => { const i = out.indexOf(t); if (i >= 0) out.splice(i, 1); });
  (ops && ops.add ? ops.add : []).forEach((t: string) => { if (out.indexOf(t) < 0) out.push(t); });
  return out;
}

/** 元素当前修饰词元：内联声明 + 语义标签，两者皆无时回落到计算样式。 */
function _decorationTokensOf(el: any): string[] {
  const out: string[] = [];
  const push = (raw: any): void => {
    String(raw == null ? '' : raw).toLowerCase().split(/\s+/).forEach((t: string) => {
      if (t && t !== 'none' && _DECO_TOKENS.indexOf(t) >= 0 && out.indexOf(t) < 0) out.push(t);
    });
  };
  if (el && el.style) { push(el.style.getPropertyValue('text-decoration-line')); push(el.style.getPropertyValue('text-decoration')); }
  const pair = _SEMANTIC_TAG_STYLE[String((el && el.tagName) || '').toUpperCase()];
  if (pair && pair[0] === 'text-decoration-line') push(pair[1]);
  if (!out.length) { try { const cs: any = getComputedStyle(el); push(cs.textDecorationLine || cs.textDecoration); } catch (e) { console.warn('[JU] caught error', e); } }
  return out;
}

/** 词元算子落到单个元素：被删词元的语义标签就地降级，余下词元原位合并；空则摘除属性。 */
function _decorationOpsOnElement(el: any, prop: string, ops: any, seed?: string[]): any {
  if (!el || !el.style) return el;
  const tokens = _mergeDecorationTokens(seed ? seed : _decorationTokensOf(el), ops);
  const pair = _SEMANTIC_TAG_STYLE[String((el.tagName || '')).toUpperCase()];
  const target = pair && pair[0] === prop && tokens.indexOf(pair[1]) < 0 ? _downgradeSemanticTag(el, prop) : el;
  if (tokens.length) target.style.setProperty(prop, tokens.join(' '));
  else { target.style.removeProperty('text-decoration-line'); target.style.removeProperty('text-decoration'); }
  return target;
}

/**
 * 把语义格式标签就地降级为 <span>（保留原有属性与子节点）。
 * 只降级「标签唯一语义 == 目标属性」的元素；A / SPAN / CODE 等保持原样。
 */
function _downgradeSemanticTag(el: any, prop: string): any {
  const pair = _SEMANTIC_TAG_STYLE[String((el && el.tagName) || '').toUpperCase()];
  if (!pair || pair[0] !== prop) return el;
  const parent = el.parentNode;
  if (!parent) return el;
  const span = document.createElement('span');
  Array.from(el.attributes || []).forEach((a: any) => {
    try { span.setAttribute(a.name, a.value); } catch (e) { console.warn('[JU] caught error', e); }
  });
  while (el.firstChild) span.appendChild(el.firstChild);
  parent.replaceChild(span, el);
  return span;
}

/**
 * 选区是否完整覆盖该元素的全部文字（用于安全清除祖先上的同类旧声明）。
 *
 * 旧实现用 `selectNodeContents(el)` 造探针再比边界点：探针边界是「元素内容之前 / 之后」，
 * 而样式写回后的选区往往**落在元素内部**（startContainer = 子文本节点），
 * 于是「整段都被选中」被误判成「没覆盖」⇒ 清除加粗 / 字号时祖先上的声明摘不掉
 * （表现为「再点一次加粗还是加粗」）。这里改为逐文本节点用 comparePoint 判定包含关系：
 * 元素内每个文本节点的首尾都必须落在选区内。
 */
function _elementFullySelected(range: Range, el: Element): boolean {
  try {
    const texts: Text[] = _collectTextNodes(el);
    if (!texts.length) return range.intersectsNode(el);
    return texts.every((t: any) => {
      const len = String(t.nodeValue || '').length;
      /* comparePoint：-1 = 在选区之前，0 = 在选区内，1 = 在选区之后 */
      return range.comparePoint(t, 0) <= 0 && range.comparePoint(t, len) >= 0;
    });
  } catch (e) {
    console.warn('[JU] caught error', e);
    return false;
  }
}

/** 块级容器：取消格式时只摘声明（拆结构会改变行内布局），内联元素才拆标签。 */
const _BLOCK_TAGS = ['P', 'LI', 'UL', 'OL', 'DIV', 'TD', 'TH', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE'];

/**
 * 【fix38-1】把 el 里「承载 node 的那一枝」抽出去，只拆这一层。
 *   · 语义标签（<b>/<i> …）→ 用 <span> 承接（标签必须消失），枝上的子标签原样保留：
 *     <b><i>text</i></b> 去加粗 ⇒ <i>text</i>，斜体不陪葬；
 *   · 带内联声明的元素 → 用「同属性克隆 − 被取消的声明」承接，颜色 / 字号 / 另一项格式
 *     随枝保留；克隆已无可保留内容时直接提升，不留空壳。
 * 旧实现把**文本节点**直接提到 el 之外：枝上的其他格式与内联声明被整层丢掉 ⇒
 * 「去加粗顺手把斜体 / 颜色也去了」「再点斜体反而又加回来」。
 */
function _detachBranch(el: any, node: any, prop: string, token?: string): void {
  const parent: any = el && el.parentNode;
  if (!parent) return;
  let branch: any = node;
  while (branch && branch.parentNode !== el) branch = branch.parentNode;
  if (!branch || branch.parentNode !== el) return;
  const pair = _SEMANTIC_TAG_STYLE[String((el && el.tagName) || '').toUpperCase()];
  const keep: any = pair && pair[0] === prop ? document.createElement('span') : el.cloneNode(false);
  Array.from(el.attributes || []).forEach((a: any) => {
    if (keep.getAttribute && keep.getAttribute(a.name) !== null) return;
    try { keep.setAttribute(a.name, a.value); } catch (e) { console.warn('[JU] caught error', e); }
  });
  if (keep.style) {
    if (!token) keep.style.removeProperty(prop);
    else {
      /* 【fix39】只剔除本次那一个词元：枝上另一项修饰随克隆保留，不被整条覆盖 */
      const tokens = _mergeDecorationTokens(_decorationTokensOf(el), { add: [], del: [token], clear: false });
      keep.style.removeProperty('text-decoration-line');
      keep.style.removeProperty('text-decoration');
      if (tokens.length) keep.style.setProperty(prop, tokens.join(' '));
    }
  }
  const styleLeft = String((keep.getAttribute && keep.getAttribute('style')) || '').replace(/[\s;]/g, '');
  const otherAttrs = Array.from(keep.attributes || []).some((a: any) => a.name !== 'style');
  if (styleLeft || otherAttrs) {
    parent.insertBefore(keep, el);
    keep.appendChild(branch);
  } else {
    parent.insertBefore(branch, el);
  }
  if (!el.firstChild) parent.removeChild(el);
}

/**
 * 【fix37-2】取消格式的强制拆解：**只要元素与选区有交集**就处理，不再要求「整段被完整覆盖」。
 *   ① 块级元素（<p> / <li> 等）上的同类内联声明直接摘除（块级声明作用于整块）；
 *   ② 其余元素（语义标签 / 带同类内联声明的 <span>）按文本节点逐枝剥离，
 *      只摘这一层并保住枝上的其他格式（fix38-1 的 _detachBranch）。
 * 旧实现只看 _elementFullySelected：跨行时首行 / 末行必然半选，标签永远拆不掉 ⇒
 * 「多行加粗点两次仍加粗，只能逐行取消」；随后又把文本节点整颗提到标签外 ⇒
 * 「叠加加粗 + 斜体后无法只剥一层」。
 */
function _forceDetachStyleInRange(range: Range, host: any, prop: string, token?: string): void {
  _textNodesInRange(range, host).forEach((t: any) => {
    let up: any = t.parentNode;
    while (up && up !== host) {
      const next: any = up.parentNode;
      if (!up.isConnected) { up = next; continue; }
      const tag = String(up.tagName || '').toUpperCase();
      const pair = _SEMANTIC_TAG_STYLE[tag];
      const own = !!(up.style && String(up.style.getPropertyValue(prop) || '').trim());
      /* 【fix39】带词元时只处理真正含该词元的元素：另一项修饰不算命中 */
      const inline = token ? own && _decorationTokensOf(up).indexOf(token) >= 0 : own;
      if ((pair && pair[0] === prop && (!token || pair[1] === token)) || inline) {
        if (_BLOCK_TAGS.indexOf(tag) >= 0) {
          if (up.style) {
            if (token) _decorationOpsOnElement(up, prop, { add: [], del: [token], clear: false });
            else up.style.removeProperty(prop);
          }
        } else _detachBranch(up, t, prop, token);
      }
      up = next;
    }
  });
}

/**
 * 拆掉 Range 内的同类语义标签（保留全部子节点 ⇒ 文本零丢失）。
 *
 * 【fix37-1】取消格式时若只摘内联声明，<b>/<strong>/<i>/<em>/<u>/<s>/<del> 标签本身仍生效，
 * 文字照样是粗体 / 斜体 ⇒ 用户视角「再点一次没取消」。
 * 【fix37-2】先按交集强制拆解（边界半选也能拆），再对「整段被覆盖」的元素做整体展开收尾。
 */
function _unwrapSemanticTagsInRange(range: Range, prop: string, token?: string): void {
  _hostsInRange(range).forEach((host: any) => {
    _forceDetachStyleInRange(range, host, prop, token);
    Array.from((host.querySelectorAll('*') as unknown) as any[]).forEach((el: any) => {
      const pair = _SEMANTIC_TAG_STYLE[String((el && el.tagName) || '').toUpperCase()];
      if (!pair || pair[0] !== prop || (!!token && pair[1] !== token) || !_elementFullySelected(range, el)) return;
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
  });
}

/**
 * 把一个属性合并进单个元素的内联样式。
 *   · 非中性值 → `el.style[styleProp] = styleValue`，**读写同一个 style 对象**，
 *     因此原有 font-weight / font-size / color 等声明全部保留（这就是「叠加」）；
 *   · 后代同类声明必须洗掉，否则内层旧值会盖住外层新值（红字改蓝字时越改越深）；
 *   · 中性值 → 先降级语义标签，再移除该声明。
 */
function _mergeStyleIntoElement(el: any, prop: string, value: string, neutral: boolean, ops?: any): any {
  if (ops) {
    /* 【fix39】修饰属性按词元合并：自身与自带同类声明的后代都只增删词元，不整条摘除 */
    const merged = _decorationOpsOnElement(el, prop, ops);
    if (merged && merged.querySelectorAll) {
      Array.from(merged.querySelectorAll('*')).forEach((d: any) => {
        const own = d.style ? String(d.style.getPropertyValue('text-decoration-line') || d.style.getPropertyValue('text-decoration') || '').trim() : '';
        if (own) _decorationOpsOnElement(d, prop, ops);
      });
    }
    return merged;
  }
  const target = neutral ? _downgradeSemanticTag(el, prop) : el;
  if (target && target.style) {
    if (neutral) target.style.removeProperty(prop);
    /* 【D-02】颜色值归一后才写进 style（旧内核兜底） */
    else target.style.setProperty(prop, normalizeInlineDeclValue(prop, value));
  }
  if (!target || !target.querySelectorAll) return target;
  Array.from(target.querySelectorAll('*')).forEach((d: any) => {
    const node = neutral ? _downgradeSemanticTag(d, prop) : d;
    if (node && node.style) node.style.removeProperty(prop);
  });
  return target;
}

/** 逐个处理抽取出来的节点：文本节点包 <span>，元素节点就地合并（不新增外层包裹）。 */
function _applyStyleToFragment(fragment: DocumentFragment, prop: string, value: string, neutral: boolean, ops?: any, seed?: string[]): void {
  Array.from(fragment.childNodes).forEach((node: any) => {
    if (node.nodeType === 3) {
      if (!node.nodeValue) return;
      const span = document.createElement('span');
      if (ops) _decorationOpsOnElement(span, prop, ops, seed);
      else if (neutral) return; /* 纯文本无需清除 */
      /* 【D-02】颜色值归一后才写进 style（旧内核兜底） */
      else span.style.setProperty(prop, normalizeInlineDeclValue(prop, value));
      if (!span.style.length) return; /* 无词元可写（纯取消）：保持纯文本，靠祖先词元剔除生效 */
      const parent = node.parentNode;
      if (!parent) return;
      parent.replaceChild(span, node);
      span.appendChild(node);
      return;
    }
    if (node.nodeType !== 1) return;
    _mergeStyleIntoElement(node, prop, value, neutral, ops);
  });
}

/** 清掉因移除声明而变空的 style 属性（只改属性，不动节点结构 ⇒ 不影响选区偏移）。 */
function _tidyEmptyStyleAttr(roots: any[]): void {
  roots.forEach((root: any) => {
    if (!root || root.nodeType !== 1) return;
    const list = [root].concat(Array.from(root.querySelectorAll('*') as any[]));
    list.forEach((el: any) => {
      if (!el.getAttribute) return;
      const raw = el.getAttribute('style');
      if (raw !== null && !String(raw).replace(/[\s;]/g, '')) el.removeAttribute('style');
    });
  });
}

/**
 * 选区样式写入主入口（颜色 / 背景 / 字号 / 加粗 …统一走这里，**不经过 execCommand**）。
 *
 * @param styleProp  CSS 属性名，kebab（`background-color`）与驼峰（`backgroundColor`）都接受
 * @param styleValue 目标值；中性值（transparent / normal / none）等价于清除该属性
 * @returns true = 已写入；false = 无有效选区 / 不在正文编辑区 / 抽取失败
 */
export function applyCustomStyleToSelection(styleProp: string, styleValue: string): boolean {
  const prop = cssPropertyName(styleProp);
  /* 【D-02】入口即归一：所有写入 DOM 的颜色都经 normalizeColorValue */
  const value = normalizeInlineDeclValue(prop, styleValue);
  if (!prop || !value) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return false;
  const host = richtextHostOf(range.commonAncestorContainer);
  if (!host) return false;
  /* 【fix39】下划线 / 删除线按词元增删：先剔除本次要取消的那一项，另一项原地保留 */
  const decoOps = _decorationTokenOps(prop, value);
  const decoTok = decoOps && !decoOps.clear && decoOps.del.length === 1 ? decoOps.del[0] : undefined;
  if (decoOps && (decoOps.del.length || decoOps.clear)) _unwrapSemanticTagsInRange(_splitBoundaryTextNodes(range), prop, decoTok);
  const decoSeed = decoOps ? _decorationTokensOf(deepElementAtRangeStart(range)) : undefined;
  const neutral = !decoOps && isNeutralStyleValue(prop, value);

  /* ① 先登记「被选区完整覆盖」的祖先：只清这些，绝不碰选区外的兄弟文本 */
  const covered: any[] = [];
  let up: any = range.commonAncestorContainer;
  while (up && up !== host) {
    if (up.nodeType === 1 && _elementFullySelected(range, up)) covered.push(up);
    up = up.parentNode;
  }

  /* ② 抽出选中内容：不重建祖先节点，已生效的 <b>/<span style> 原样带走 */
  let fragment: DocumentFragment;
  try { fragment = range.extractContents(); }
  catch (e) { console.warn('[JU] caught error', e); return false; }
  if (!fragment || !fragment.childNodes.length) return false;
  /* ②′ 先记下选区内的文本节点：结构归一（摊平 / 合并）后 span 引用会失效，
      但文本节点对象不变，⑦ 用它把选区重新框住最可靠。 */
  const selTexts: Text[] = _collectTextNodes(fragment);

  /* ③ 逐节点合并写入（同类型旧样式就地覆盖，而不是外层再套一层） */
  _applyStyleToFragment(fragment, prop, value, neutral, decoOps, decoSeed);

  /* ④ 原样插回原位置 */
  const parts: any[] = Array.from(fragment.childNodes);
  try { range.insertNode(fragment); }
  catch (e) { console.warn('[JU] caught error', e); return false; }

  /* ⑤ 整段覆盖的祖先上残留的同类声明一并洗掉（修饰属性只按词元剔除，另一项修饰保留） */
  covered.forEach((el: any) => {
    if (el && el.isConnected && el.style && !decoOps) el.style.removeProperty(prop);
  });

  /* ⑥ 清理空 style 属性 */
  _tidyEmptyStyleAttr(parts);

  /* ⑥′ 结构归一：嵌套 span 摊平 + 相邻同 style 合并 + 空 span 展开 + 文本合并。
     颜色 / 背景 / 字号 / 加粗不论先后顺序，最终都收敛到同一个 span 上，
     不再「内层决定覆盖」，避免后写入的属性把先写入的整段盖掉。 */
  normalizeInlineStyles(host);

  /* ⑦ 把选区重新框在新内容上：下一次点字号 / 颜色仍有有效 Range */
  if (_selectTextNodes(sel, selTexts)) return true;
  const first = parts[0];
  const last = parts[parts.length - 1];
  try {
    if (first && last && first.isConnected && last.isConnected) {
      const nr = document.createRange();
      nr.setStartBefore(first);
      nr.setEndAfter(last);
      sel.removeAllRanges();
      sel.addRange(nr);
    }
  } catch (e) { console.warn('[JU] caught error', e); }
  return true;
}

/** 读取选区起点当前是否已带某格式（getComputedStyle 口径，供按钮类命令做幂等切换）。 */
export function selectionHasStyle(styleProp: string, decoToken?: string): boolean {
  const prop = cssPropertyName(styleProp);
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  /* 起点可能落在元素边界上：必须下钻到真正承载文字的元素再读计算样式 */
  const el: any = deepElementAtRangeStart(sel.getRangeAt(0));
  if (!el || !el.closest || !el.closest('[contenteditable="true"]')) return false;
  let cs: any = null;
  try { cs = getComputedStyle(el); } catch (e) { console.warn('[JU] caught error', e); }
  if (!cs) return false;
  if (prop === 'font-weight') {
    const w = String(cs.fontWeight || '');
    return w === 'bold' || w === 'bolder' || parseInt(w, 10) >= 600;
  }
  if (prop === 'font-style') return String(cs.fontStyle || '').indexOf('italic') >= 0;
  if (prop === 'text-decoration-line' || prop === 'text-decoration') {
    /* 【fix39】同一属性承载多个修饰词元：给了词元时只认该词元（另一项修饰不代表本项已生效） */
    const dec = String(cs.textDecorationLine || cs.textDecoration || '').toLowerCase();
    const tok = String(decoToken || '').trim().toLowerCase();
    if (tok) return (' ' + dec + ' ').indexOf(' ' + tok + ' ') >= 0;
    return !!dec && dec.indexOf('none') < 0;
  }
  const v = String(cs[cssPropertyCamel(prop) as any] || '');
  return !!v && v !== 'transparent' && v !== 'rgba(0, 0, 0, 0)';
}

/** 按钮类格式的「关闭值」。 */
function _neutralStyleValueOf(prop: string): string {
  if (prop === 'font-weight') return 'normal';
  if (prop === 'font-style') return 'normal';
  if (prop === 'text-decoration-line' || prop === 'text-decoration') return 'none';
  return '';
}

/**
 * 按钮类格式（加粗 / 斜体 / 下划线 / 删除线）的纯 DOM 幂等切换：
 * 已生效 → 写入中性值（擦除，且语义标签降级为 span），否则写入目标值。
 * 与颜色 / 字号共用同一套提取-合并-插回管线，天然可叠加。
 */
export function toggleCustomStyleToSelection(styleProp: string, onValue: string, offValue?: string): boolean {
  const prop = cssPropertyName(styleProp);
  const explicitOff = String(offValue == null ? '' : offValue).trim();
  const off = explicitOff || _neutralStyleValueOf(prop);
  if (!off) return applyCustomStyleToSelection(prop, onValue);
  /* 【fix39】修饰属性按本次按钮对应的词元判态：已带另一项修饰不等于本项已生效 */
  const token = String(onValue || '').replace(/^[+-]/, '').trim().toLowerCase();
  return applyCustomStyleToSelection(prop, selectionHasStyle(prop, _DECO_TOKENS.indexOf(token) >= 0 ? token : '') ? off : onValue);
}

/* ============================================================
   三项合并引擎（applyInlineStyle · 单 span 承载 color / bg / font-size）
   ------------------------------------------------------------
   【要解决的问题】颜色 / 背景 / 字号此前是三条互相独立的命令：
     · 每条命令各包一层 span ⇒ 层叠顺序由嵌套深度决定，后写的把先写的盖掉；
     · 字号走 execCommand('fontSize', 1-7) ⇒ 宿主写 <font size="N">，与 span style 混用，
       后续命令重建边界节点时被整段清除；
     · 同值重复点击被 toggle 成「清除」。
   本引擎把「当前文本实际生效的三项 computed 值」一次性合进同一个 span，
   只覆盖调用方指定的那一项，其余两项原样带过去，因此六种先后顺序结果一致：

     <span style="color:rgb(255,0,0);background-color:rgb(255,255,0);font-size:16px">文本</span>

   写入后统一做结构归一（嵌套摊平 → 相邻同 style 合并 → 空 span 展开 → 文本合并），
   保证「三项始终在同一个 span 上」，不会越点越深。
   ============================================================ */

/** 参与合并的三项内联属性（顺序即写入声明顺序）。 */
export const INLINE_STYLE_PROPS: readonly string[] = ['color', 'background-color', 'font-size'];

/** 取子树内全部非空文本节点（文档顺序）。 */
function _collectTextNodes(root: any): Text[] {
  const out: Text[] = [];
  if (!root) return out;
  if (root.nodeType === 3) {
    if (String(root.nodeValue || '').length) out.push(root as Text);
    return out;
  }
  try {
    const doc: any = root.ownerDocument || document;
    const walker: any = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, null);
    let node: any = walker.nextNode();
    while (node) {
      if (node.nodeType === 3 && String(node.nodeValue || '').length) out.push(node);
      node = walker.nextNode();
    }
  } catch (e) { console.warn('[JU] caught error', e); }
  return out;
}

/** style 声明签名（名字排序 + 值小写归一），用于判定「同 style」。 */
function _styleSignature(el: any): string {
  const st = el && el.style;
  if (!st || !st.length) return '';
  const decls: string[] = [];
  for (let i = 0; i < st.length; i++) {
    const name = String(st[i]);
    const v = String(st.getPropertyValue(name) || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (v) decls.push(name + ':' + v);
  }
  return decls.sort().join(';');
}

/** 纯样式 span：唯一属性是 style（带 class / title 等的一律不参与摊平与合并）。 */
function _isPlainStyleSpan(el: any): boolean {
  if (!el || el.nodeType !== 1 || String(el.tagName || '').toUpperCase() !== 'SPAN') return false;
  const attrs: any[] = Array.from(el.attributes || []);
  return attrs.every((a: any) => a.name === 'style');
}

/** 该父节点的「实体子节点」（忽略纯空白文本），用于判断能否安全摊平。 */
function _solidChildren(el: any): any[] {
  return Array.from(el.childNodes || []).filter(
    (n: any) => !(n.nodeType === 3 && !String(n.nodeValue || '').trim()),
  );
}

/** 展开没有任何 style 声明的纯样式 span（保留子节点）。 */
function _unwrapStylelessSpansIn(root: any): void {
  const hits: any[] = [];
  if (_isPlainStyleSpan(root) && !_styleSignature(root)) hits.push(root);
  Array.from(root.querySelectorAll('span') as any[]).forEach((el: any) => {
    if (_isPlainStyleSpan(el) && !_styleSignature(el)) hits.push(el);
  });
  hits.forEach((el: any) => {
    const p = el.parentNode;
    if (!p) return;
    while (el.firstChild) p.insertBefore(el.firstChild, el);
    p.removeChild(el);
  });
}

/** 嵌套 span 摊平：父 span 只有一个实体子节点且该子节点也是纯样式 span ⇒ 子声明并入父。 */
function _flattenNestedSpansIn(root: any): void {
  let guard = 0;
  let changed = true;
  const collect = (): any[] => {
    const list: any[] = [];
    if (_isPlainStyleSpan(root)) list.push(root);
    Array.from(root.querySelectorAll('span') as any[]).forEach((el: any) => list.push(el));
    return list;
  };
  while (changed && guard++ < 500) {
    changed = false;
    collect().forEach((el: any) => {
      if (!el.parentNode) return;
      if (!_isPlainStyleSpan(el)) return;
      const kids = _solidChildren(el);
      if (kids.length !== 1) return;
      const only: any = kids[0];
      if (!_isPlainStyleSpan(only)) return;
      for (let i = 0; i < only.style.length; i++) {
        const name = String(only.style[i]);
        el.style.setProperty(name, String(only.style.getPropertyValue(name)));
      }
      while (only.firstChild) el.insertBefore(only.firstChild, only);
      el.removeChild(only);
      changed = true;
    });
  }
}

/** 合并同层相邻、style 签名一致的纯样式 span。 */
function _mergeAdjacentSameStyleSpansIn(root: any): void {
  const parents: any[] = [root].concat(Array.from(root.querySelectorAll('*') as any[]));
  parents.forEach((parent: any) => {
    let child: any = parent.firstChild;
    while (child) {
      const next: any = child.nextSibling;
      if (_isPlainStyleSpan(child) && _isPlainStyleSpan(next)) {
        const sig = _styleSignature(child);
        if (sig && sig === _styleSignature(next)) {
          while (next.firstChild) child.appendChild(next.firstChild);
          parent.removeChild(next);
          continue; /* 同一 child 可能还能与更靠后的同 style span 合并 */
        }
      }
      child = next;
    }
  });
}

/** 结构归一：摊平嵌套 → 合并相邻同 style → 展开空 span → 合并相邻文本节点。 */
export function normalizeInlineStyles(root: any): void {
  if (!root || root.nodeType !== 1) return;
  try {
    _flattenNestedSpansIn(root);
    _mergeAdjacentSameStyleSpansIn(root);
    _unwrapStylelessSpansIn(root);
    root.normalize();
  } catch (e) { console.warn('[JU] caught error', e); }
}

/** 把选区重新框在给定文本节点上（首节点开头 → 末节点结尾）。 */
function _selectTextNodes(sel: any, texts: Text[]): boolean {
  try {
    const list: any[] = (texts || []).filter((t: any) => t && t.isConnected && t.nodeType === 3);
    if (!list.length || !sel) return false;
    const first = list[0];
    const last = list[list.length - 1];
    const nr = document.createRange();
    nr.setStart(first, 0);
    nr.setEnd(last, String(last.nodeValue || '').length);
    sel.removeAllRanges();
    sel.addRange(nr);
    return true;
  } catch (e) { console.warn('[JU] caught error', e); return false; }
}

/** 任意 CSS 值 → computed 口径字符串（颜色 rgb() / 尺寸 px），用于「同值」比较。 */
export function normalizeCssValue(styleProp: string, styleValue: string): string {
  const prop = cssPropertyName(styleProp);
  const v = String(styleValue == null ? '' : styleValue).trim();
  if (!prop || !v) return '';
  try {
    const probe = document.createElement('span');
    probe.style.setProperty('position', 'fixed');
    probe.style.setProperty('left', '-9999px');
    probe.style.setProperty('visibility', 'hidden');
    probe.style.setProperty(prop, v);
    document.body.appendChild(probe);
    const out = String(getComputedStyle(probe)[cssPropertyCamel(prop) as any] || '');
    probe.remove();
    return out.replace(/\s+/g, ' ').trim().toLowerCase();
  } catch (e) {
    console.warn('[JU] caught error', e);
    return String(v).replace(/\s+/g, ' ').trim().toLowerCase();
  }
}

/** 两个 CSS 值是否等价（规范化后相等；px 数值允许 0.01 误差）。 */
export function sameCssValue(styleProp: string, a: string, b: string): boolean {
  const na = normalizeCssValue(styleProp, a);
  const nb = normalizeCssValue(styleProp, b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const pa = parseFloat(na);
  const pb = parseFloat(nb);
  if (!isNaN(pa) && !isNaN(pb) && /px$/.test(na) && /px$/.test(nb)) return Math.abs(pa - pb) < 0.01;
  return false;
}

/** 切分选区两端的文本节点，使「被选中的文字」恰好是整段文本节点。 */
function _splitBoundaryTextNodes(range: Range): Range {
  const r = range.cloneRange();
  try {
    const sc: any = r.startContainer;
    if (sc && sc.nodeType === 3) {
      const len = String(sc.nodeValue || '').length;
      if (r.startOffset > 0 && r.startOffset < len) r.setStart(sc.splitText(r.startOffset), 0);
    }
  } catch (e) { console.warn('[JU] caught error', e); }
  try {
    const ec: any = r.endContainer;
    if (ec && ec.nodeType === 3) {
      const len = String(ec.nodeValue || '').length;
      if (r.endOffset > 0 && r.endOffset < len) {
        ec.splitText(r.endOffset);
        r.setEnd(ec, r.endOffset);
      }
    }
  } catch (e) { console.warn('[JU] caught error', e); }
  return r;
}

/** Range 覆盖到的文本节点（文档顺序）。 */
function _textNodesInRange(range: Range, host: any): Text[] {
  const out: Text[] = [];
  _collectTextNodes(host).forEach((t: any) => {
    let hit = false;
    try { hit = range.intersectsNode(t); } catch (e) { hit = false; }
    if (hit) out.push(t);
  });
  return out;
}

/**
 * 读元素当前生效的三项 computed 值，并用目标属性覆盖。
 * 背景为透明时不写 background-color（避免给每个 span 塞一条无效声明）。
 */
function _mergedThreeDecls(el: any, prop: string, value: string): Array<[string, string]> {
  let cs: any = null;
  try { cs = el ? getComputedStyle(el) : null; } catch (e) { cs = null; }
  const decls: Array<[string, string]> = [];
  const colorVal = cs ? String(cs.color || '') : '';
  const bgVal = cs ? String(cs.backgroundColor || '') : '';
  const sizeVal = cs ? String(cs.fontSize || '') : '';
  /* 【D-02】computed 颜色归一后再写入声明（color(srgb …) → #RRGGBB / rgba()） */
  const colorNorm = normalizeInlineDeclValue('color', colorVal);
  const bgNorm = normalizeInlineDeclValue('background-color', bgVal);
  if (colorNorm) decls.push(['color', colorNorm]);
  if (bgNorm && !isNeutralStyleValue('background-color', bgNorm)) decls.push(['background-color', bgNorm]);
  if (sizeVal) decls.push(['font-size', sizeVal]);
  const neutral = isNeutralStyleValue(prop, value);
  const idx = decls.findIndex((p) => p[0] === prop);
  if (neutral) {
    if (idx >= 0) decls.splice(idx, 1);
  } else if (idx >= 0) {
    decls[idx] = [prop, value];
  } else {
    decls.push([prop, value]);
  }
  return decls;
}

/* ------------------------------------------------------------
   选区写入核心（P0 重构 · 跨块 / 跨行 / 就地合并）
   ------------------------------------------------------------
   实机失败根因（与 Playwright 夹具的分支差异）：
     · 夹具是「单个 contenteditable + 单个文本节点」，而实机正文的选区经常
       跨多个块级元素（两个 p / div），甚至跨两个大纲行的**独立** contenteditable；
     · 旧实现用 `range.commonAncestorContainer` 求宿主：跨行时它落在 `#content`
       上 ⇒ `richtextHostOf` 返回 null ⇒ 直接 `return false`，三项样式一项都写不进去；
     · 单文本节点走「就地包 span」，多文本节点靠结构归一收敛，但**从不复用**
       「已经存在的纯样式 span」，于是越点越深（嵌套 span 由内层决定覆盖）。
   本实现的口径：
     ① 跨块 / 多文本节点 → 逐文本节点包裹（**禁止** surroundContents，跨块会抛错）；
     ② 单文本节点 → extractContents → 外包 span → insertNode（保留祖先节点）；
     ③ 已有纯样式 span 且其文字整体落在选区内 → 就地合并三项声明（不再嵌套）；
     ④ 写入前后用「宿主 + 纯文本偏移」记录锚点，结构归一 / 重渲染后仍能恢复选区。
   ------------------------------------------------------------ */

/** 写入结果：成功标记 + 被写入的文本节点 + 每个宿主的纯文本偏移锚点。 */
interface InlineWriteResult {
  ok: boolean;
  texts: Text[];
  anchors: Array<{ host: any; from: number; to: number }>;
}

/**
 * 宿主内「纯文本偏移」：容器落在宿主之外时按文档序夹到 0 / 总长。
 *
 * 【必须支持元素边界】选区重建后 `startContainer` 常常是**元素**而非文本节点
 * （`range.selectNodeContents(span)` ⇒ startContainer = span、startOffset = 子节点下标）。
 * 旧实现只识别「文本节点容器」：元素边界会一路走到底返回「宿主总长」
 * ⇒ 锚点 from === to === 总长 ⇒ 恢复出塌陷光标 ⇒ 下一条格式命令被当成
 * 「空光标登记 typing style」而一个字都不写（实机表现为「第二项样式不生效」）。
 * 这里改为用 Range 直接量出「宿主开头 → 该边界」之间的纯文本长度，两种边界一视同仁。
 */
function _textOffsetOf(host: any, container: any, offset: number): number {
  try {
    if (!host || !container) return 0;
    const totalOf = (el: any): number =>
      _collectTextNodes(el).reduce((n: number, t: any) => n + String(t.nodeValue || '').length, 0);
    if (container === host) {
      /* 元素边界：offset 是子节点下标 ⇒ 累加前面兄弟的文字长度 */
      const kids: any[] = Array.from(host.childNodes || []).slice(0, Math.max(0, Math.min(offset, host.childNodes.length)));
      return kids.reduce((n: number, k: any) => n + totalOf(k), 0);
    }
    if (!host.contains(container)) {
      /* 容器在宿主之外（跨行选区 / 空行落字）：宿主之前的算 0，之后的算总长 */
      const rel = host.compareDocumentPosition(container);
      return rel & 4 /* DOCUMENT_POSITION_FOLLOWING ⇒ 容器在宿主之后 */ ? totalOf(host) : 0;
    }
    /* 宿主内部：文本节点边界与元素边界统一用 Range 量出纯文本长度 */
    const probe = document.createRange();
    probe.setStart(host, 0);
    probe.setEnd(
      container,
      container.nodeType === 3
        ? Math.max(0, Math.min(offset, String(container.nodeValue || '').length))
        : Math.max(0, Math.min(offset, (container.childNodes || []).length)),
    );
    return String(probe.toString()).length;
  } catch (e) {
    console.warn('[JU] caught error', e);
    return 0;
  }
}

/** 由「宿主 + 纯文本偏移」重建 Range（结构归一 / 文本节点合并 / 重渲染后依然可靠）。 */
function _rangeFromOffsets(host: any, from: number, to: number): Range | null {
  try {
    if (!host || !host.isConnected) return null;
    const texts = _collectTextNodes(host);
    if (!texts.length) {
      /* 空行（还没有任何文本节点）：返回一个折叠光标，供「先设样式再落字」的 typing style 使用 */
      const ci = Math.max(0, Math.min(from, (host.childNodes || []).length));
      const r0 = document.createRange();
      r0.setStart(host, ci);
      r0.collapse(true);
      return r0;
    }
    const total = texts.reduce((n: number, t: any) => n + String(t.nodeValue || '').length, 0);
    const clampFrom = Math.max(0, Math.min(from, total));
    const clampTo = Math.max(clampFrom, Math.min(to, total));
    const pick = (off: number): { node: Text; offset: number } => {
      let acc = 0;
      for (let i = 0; i < texts.length; i++) {
        const len = String(texts[i].nodeValue || '').length;
        if (off <= acc + len) return { node: texts[i], offset: off - acc };
        acc += len;
      }
      const last = texts[texts.length - 1];
      return { node: last, offset: String(last.nodeValue || '').length };
    };
    const a = pick(clampFrom);
    const b = pick(clampTo);
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    return r;
  } catch (e) {
    console.warn('[JU] caught error', e);
    return null;
  }
}

/**
 * 选区覆盖到的 contenteditable 宿主（可能跨多行 / 多块）。
 *
 * 这是「实机跨行选区三项样式全部失效」的正面修复点：不再只认
 * `commonAncestorContainer` 的最近可编辑祖先，而是回落到「与 Range 相交、
 * 且真的覆盖到文字」的全部可编辑宿主。
 */
function _hostsInRange(range: Range): HTMLElement[] {
  const direct = richtextHostOf(range.commonAncestorContainer);
  if (direct) return [direct];
  const out: HTMLElement[] = [];
  try {
    const all: any[] = Array.from((document.querySelectorAll('[contenteditable="true"]') as unknown) as any[]);
    all.forEach((el: any) => {
      /* 只取最外层宿主：嵌套 contenteditable 由最外层统一处理，避免重复包 span */
      if (el.closest && el.closest('[contenteditable="true"]') !== el) return;
      let hit = false;
      try { hit = range.intersectsNode(el); } catch (e) { hit = false; }
      if (!hit) return;
      /* intersectsNode 对「恰好贴边」的容器也返回 true：必须真的覆盖到文字才算 */
      if (!_textNodesInRange(range, el).length) return;
      out.push(el);
    });
  } catch (e) {
    console.warn('[JU] caught error', e);
  }
  return out;
}

/** 该文本节点的父元素是否「整体」落在选区内（决定能否就地合并，而非再包一层）。 */
function _parentFullySelected(range: Range, text: any): any {
  const p: any = text && text.parentNode;
  if (!p || p.nodeType !== 1) return null;
  if (!_elementFullySelected(range, p)) return null;
  return p;
}

/** 就地合并一项样式到已存在的纯样式 span（清掉后代同类旧声明，避免内层盖住外层）。 */
function _mergeIntoHolder(holder: any, prop: string, value: string): void {
  if (!holder || !holder.style) return;
  const decls = _mergedThreeDecls(holder, prop, value);
  decls.forEach(([name, v]) => {
    try { holder.style.setProperty(name, v); } catch (e) { console.warn('[JU] caught error', e); }
  });
  if (holder.querySelectorAll) {
    Array.from(holder.querySelectorAll('*') as any[]).forEach((d: any) => {
      if (d && d.style) d.style.removeProperty(prop);
    });
  }
}

/** 中性值清除：只从「被选区完整覆盖」的祖先上摘声明，绝不波及选区外的兄弟文本。 */
function _clearStyleFromTextNode(range: Range, text: any, prop: string, host: any): void {
  let up: any = text && text.parentNode;
  while (up && up !== host) {
    if (up.style && _elementFullySelected(range, up)) up.style.removeProperty(prop);
    up = up.parentNode;
  }
}

/** 逐文本节点写入（跨块 / 多文本节点分支）：已有纯样式 span 就地合并，否则包一层。 */
function _writeStyleToTextNode(range: Range, text: any, prop: string, value: string, host: any, neutral: boolean): void {
  const parent: any = text && text.parentNode;
  if (!parent) return;
  if (neutral) { _clearStyleFromTextNode(range, text, prop, host); return; }
  /* ③ 样式保护：父级已是「纯样式 span」且其文字整体在选区内 ⇒ 就地合并，不再嵌套 */
  const holder = _parentFullySelected(range, text);
  if (holder && _isPlainStyleSpan(holder)) { _mergeIntoHolder(holder, prop, value); return; }
  const decls = _mergedThreeDecls(parent, prop, value);
  const span = document.createElement('span');
  decls.forEach(([name, v]) => {
    try { span.style.setProperty(name, v); } catch (e) { console.warn('[JU] caught error', e); }
  });
  parent.insertBefore(span, text);
  span.appendChild(text);
}

/** 单文本节点写入（②）：extractContents → 外包 span → insertNode，不重建祖先节点。 */
function _writeStyleToSingleText(range: Range, text: any, prop: string, value: string, host: any, neutral: boolean): boolean {
  const parent: any = text && text.parentNode;
  if (!parent) return false;
  if (neutral) { _clearStyleFromTextNode(range, text, prop, host); return true; }
  const holder = _parentFullySelected(range, text);
  if (holder && _isPlainStyleSpan(holder)) { _mergeIntoHolder(holder, prop, value); return true; }
  const decls = _mergedThreeDecls(parent, prop, value);
  const sub = document.createRange();
  sub.setStart(text, 0);
  sub.setEnd(text, String(text.nodeValue || '').length);
  let frag: DocumentFragment | null = null;
  try { frag = sub.extractContents(); } catch (e) { console.warn('[JU] caught error', e); frag = null; }
  if (!frag) {
    /* 抽取失败：回落到逐节点包裹（同样不使用 surroundContents） */
    _writeStyleToTextNode(sub, text, prop, value, host, neutral);
    return true;
  }
  const span = document.createElement('span');
  decls.forEach(([name, v]) => {
    try { span.style.setProperty(name, v); } catch (e) { console.warn('[JU] caught error', e); }
  });
  span.appendChild(frag);
  try { sub.insertNode(span); } catch (e) {
    console.warn('[JU] caught error', e);
    return false;
  }
  return true;
}

/** 选区内的全部宿主都已经是目标值（同值重复点击不 toggle、不重复包裹）。 */
function _rangeAlreadyHasValue(range: Range, prop: string, value: string): boolean {
  try {
    const work = _splitBoundaryTextNodes(range);
    const hosts = _hostsInRange(work);
    if (!hosts.length) return false;
    const els: any[] = [];
    hosts.forEach((h: any) => {
      _textNodesInRange(work, h).forEach((t: any) => {
        if (t && t.parentElement) els.push(t.parentElement);
      });
    });
    if (!els.length) return false;
    return els.every((el: any) => {
      let cs: any = null;
      try { cs = getComputedStyle(el); } catch (e) { cs = null; }
      if (!cs) return false;
      return sameCssValue(prop, String(cs[cssPropertyCamel(prop) as any] || ''), value);
    });
  } catch (e) {
    console.warn('[JU] caught error', e);
    return false;
  }
}

/** 用「宿主 + 纯文本偏移」锚点恢复选区（返回 false 表示锚点已不可用）。 */
function _restoreSelectionByAnchors(sel: any, anchors: Array<{ host: any; from: number; to: number }>): boolean {
  try {
    if (!sel || !anchors || !anchors.length) return false;
    const usable = anchors.filter((a: any) => a && a.host && a.host.isConnected);
    if (!usable.length) return false;
    const first = usable[0];
    const last = usable[usable.length - 1];
    const rStart = _rangeFromOffsets(first.host, first.from, first.to);
    if (!rStart) return false;
    if (usable.length === 1) {
      sel.removeAllRanges();
      sel.addRange(rStart);
      return true;
    }
    const rEnd = _rangeFromOffsets(last.host, last.from, last.to);
    if (!rEnd) return false;
    const nr = document.createRange();
    nr.setStart(rStart.startContainer, rStart.startOffset);
    nr.setEnd(rEnd.endContainer, rEnd.endOffset);
    sel.removeAllRanges();
    sel.addRange(nr);
    return true;
  } catch (e) {
    console.warn('[JU] caught error', e);
    return false;
  }
}

/** 对给定 Range 写入一项样式（三项合并），返回写入的文本节点与选区锚点。 */
function _applyInlineToRange(range: Range, prop: string, value: string): InlineWriteResult {
  const neutral = isNeutralStyleValue(prop, value);
  /* 两端文本节点先切开：让「被选中的文字」恰好是整段文本节点 */
  const work = _splitBoundaryTextNodes(range);
  const hosts = _hostsInRange(work);
  if (!hosts.length) return { ok: false, texts: [], anchors: [] };
  const texts: Text[] = [];
  const anchors: Array<{ host: any; from: number; to: number }> = [];
  hosts.forEach((host: any) => {
    const inHost = _textNodesInRange(work, host);
    if (!inHost.length) return;
    /* ④ 写入前记录锚点：结构归一（摊平 / 合并 / 文本合并）会让节点引用失效 */
    const from = _textOffsetOf(host, work.startContainer, work.startOffset);
    const to = _textOffsetOf(host, work.endContainer, work.endOffset);
    anchors.push({ host, from, to });
    inHost.forEach((t: any) => texts.push(t));
    if (inHost.length === 1) {
      /* ② 单文本节点：extractContents → 外包 span → insertNode */
      _writeStyleToSingleText(work, inHost[0], prop, value, host, neutral);
    } else {
      /* ① 跨块 / 多文本节点：逐文本节点包裹（禁止 surroundContents，跨块必抛错） */
      inHost.forEach((t: any) => _writeStyleToTextNode(work, t, prop, value, host, neutral));
    }
    normalizeInlineStyles(host);
  });
  return { ok: texts.length > 0, texts, anchors };
}

/** 元素当前生效值是否已等于目标值（用于跳过「已经带这项样式」的包裹）。 */
function _elementHasCssValue(el: any, prop: string, value: string): boolean {
  if (!el || el.nodeType !== 1) return false;
  let cs: any = null;
  try { cs = getComputedStyle(el); } catch (e) { return false; }
  if (!cs) return false;
  return sameCssValue(prop, String(cs[cssPropertyCamel(prop) as any] || ''), value);
}

/** 选区起点当前生效值是否已等于目标值（同值 ⇒ 不 toggle、不重复包裹）。 */
export function selectionValueEquals(styleProp: string, styleValue: string): boolean {
  const prop = cssPropertyName(styleProp);
  const value = String(styleValue == null ? '' : styleValue).trim();
  if (!prop || !value) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const el: any = deepElementAtRangeStart(sel.getRangeAt(0));
  if (!el || !el.closest || !el.closest('[contenteditable="true"]')) return false;
  let cs: any = null;
  try { cs = getComputedStyle(el); } catch (e) { return false; }
  if (!cs) return false;
  return sameCssValue(prop, String(cs[cssPropertyCamel(prop) as any] || ''), value);
}

/**
 * 【批次1 · 运行态探针】applyInlineStyle 入口快照。
 *
 * 实机（Tauri / WebView2）与 Playwright 夹具的分支不一致时，只看产物无法判断
 * 「是没选区、选区塌陷、还是选区落在编辑区外」。默认关闭，仅 `window.__JU_RT_DEBUG===true`
 * 时输出 `[JU-RT] rangeCount collapsed 容器 tagName 选中长度`（不输出任何正文文本）。
 * 控制台出现该行即可定位到具体分支（无选区 / 非编辑区 / collapsed / 跨块写入）。
 */
export function logInlineStyleEntry(): void {
  try {
    if ((window as any).__JU_RT_DEBUG !== true) return;
    const s = window.getSelection();
    const r = s && s.rangeCount ? s.getRangeAt(0) : null;
    const tag = r ? (r.startContainer.nodeType === 1 ? (r.startContainer as Element).tagName : r.startContainer.nodeName) : '';
    console.log('[JU-RT]', s ? s.rangeCount : 0, r ? r.collapsed : null, tag, r ? r.toString().length : 0);
  } catch (e) {
    console.warn('[JU] caught error', e);
  }
}

/* ============================================================
   editor.isFormatting —— 格式写入区间标记（**纯诊断**，不再拦截重绘）
   ------------------------------------------------------------
   上一轮曾用本标记让 renderMain 在写入期间跳过 `#content` 重建。该拦截属于
   「掩盖症状」：真正导致选区失效的是**点击工具栏把焦点从正文抢走**，
   以及「提取 → 重写 → 插回」在两段命令之间让节点引用失效。
   本轮按批次1 / 批次2 从根上修掉这两条（mousedown 防失焦 + 纯文本重建引擎）后，
   拦截本身反而会与「焦点归还后正常刷新」互相冲突，因此：

     · renderMain 不再读取本标记（`app/render.ts` 已移除该早退分支）；
     · 写入结束后由 `_focusRichtextHost()` 把焦点与选区还给编辑宿主，
       阻断「blur → notify → 重建」这条链路；
     · 标记仅保留给控制台探针 / 回归断言，说明「此刻正处于一次格式写入中」。
   ============================================================ */
let _formattingDepth = 0;
let _formattingActive = false;
let _formattingToken = 0;

/** 进入格式写入区间（可重入：内层写入不会提前解除标记）。 */
export function beginEditorFormatting(): void {
  _formattingDepth += 1;
  _formattingToken += 1;
  _formattingActive = true;
}

/** 退出格式写入区间；最外层退出后保留两帧再回落（只影响标记本身，不影响渲染）。 */
export function endEditorFormatting(): void {
  if (_formattingDepth > 0) _formattingDepth -= 1;
  if (_formattingDepth > 0) return;
  const token = _formattingToken;
  const release = (): void => {
    if (token !== _formattingToken || _formattingDepth > 0) return;
    _formattingActive = false;
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(release));
  }
  /* rAF 在窗口不可见时会被节流到秒级：200ms 兜底，避免标记长期为 true */
  setTimeout(release, 200);
}

/** 当前是否处于格式写入区间（诊断 / 回归断言入口；不再是重绘拦截判据）。 */
export function isEditorFormatting(): boolean {
  return _formattingActive === true;
}

/** 把焦点还给编辑宿主：写入后焦点若停在浮层按钮上，下一次点击必然再触发 blur。 */
function _focusRichtextHost(host: any): void {
  try {
    if (!host || host.nodeType !== 1 || !host.isConnected) return;
    if (document.activeElement === host) return;
    if (typeof host.focus === 'function') host.focus({ preventScroll: true });
  } catch (e) {
    console.warn('[JU] caught error', e);
  }
}

/* ------------------------------------------------------------
   批次2 · 纯文本重建引擎（颜色 / 背景 / 字号写入的唯一实现）
   ------------------------------------------------------------
   自动化夹具全绿、实机仍然互相覆盖的三条根因（本引擎逐条对应）：
     ① 焦点丢失：点工具栏按钮时浏览器把焦点从正文移走，
        `document.getSelection()` 在命令执行瞬间已失效或错位；
     ② 覆盖逻辑错误：旧实现「提取 → 重写 → 插回」在多层 span / 跨块的实机上
        极易丢掉文本节点上原有的内联样式，新样式等于把旧样式换掉；
     ③ 重绘干扰：写入触发的 update + render 会重建 DOM，把刚写好的高亮节点重置。
   引擎只做一件事 —— **整段纯文本重建**（不用 execCommand，也不用 Range 合并 API）：
     ① 读选区起点父元素的三项 computed 值（color / background-color / font-size）
        作为基础样式，另外携带 font-weight / font-style / text-decoration-line，
        保证「加粗 → 换色」这类叠加不会因为纯文本重建而丢掉按钮类格式；
     ② 用本次传入的属性覆盖基础样式（中性值 = 摘除该项）；
     ③ `range.deleteContents()` 删掉旧选区 DOM，新建
        `<span style="…">纯文本</span>` 并 `range.insertNode(span)`；
     ④ 选区重新框住新 span，下一次命令仍有有效 Range；
     ⑤ 显式调用 `deps.commitInlineStyle()`（等价 updateText）把新 DOM 写回数据模型；
     ⑥ 交还焦点（`_focusRichtextHost`），阻断「blur → notify → 重建」链路。
   跨块 / 跨行选区按「逐文本节点分段」重建：每一段的父级各自包一个 span，
   因此两个 <p>、两行大纲都能同时拿到三项样式，且不会产生嵌套 span。
   ------------------------------------------------------------ */

/** 选区内的一个「待重建片段」：某个文本节点内的一段连续区间。 */
interface InlineSegment {
  node: Text;
  from: number;
  to: number;
  host: any;
}

/**
 * 读元素当前生效的基础样式声明（三项 computed 值 + 按钮类格式）。
 *
 * 三项一律显式写入，**不因「与正文继承值相同」而省略**：
 *   · 省略后 span 只剩本次新写的那一项声明，一旦走「清除该项」（例如清除文字颜色），
 *     span 会变成无样式节点并被结构归一展开 ⇒ 选区在展开瞬间塌陷，
 *     下一次「设背景 / 设字号」就写到了空位（实机表现为「第二项样式不生效」）；
 *   · 三项常在同一个 span 上，「整段纯文本重建」必须把另外两项原样带过去，
 *     否则重建等于把旧样式换掉（这正是本次要修掉的覆盖 Bug）。
 * 中性值（transparent 背景 / font-weight:400 / text-decoration:none）仍然跳过，
 * 避免每个 span 都塞一条无效声明。
 */
function _baseInlineDecls(el: any): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let cs: any = null;
  try { cs = el ? getComputedStyle(el) : null; } catch (e) { cs = null; }
  if (!cs) return out;
  const push = (name: string, raw: any): void => {
    /* 【D-02】computed 值可能是 `color(srgb … / a)`：写回 style 前先归一，
       否则 span 上会留下旧内核无法解析的声明（颜色静默失效 = 用户说的「不叠加」）。 */
    const v = normalizeInlineDeclValue(name, raw);
    if (!v || isNeutralStyleValue(name, v)) return;
    out.push([name, v]);
  };
  push('color', cs.color);
  push('font-size', cs.fontSize);
  push('background-color', cs.backgroundColor);
  /* font-weight 的 computed 值可能是 700：统一写回 bold，
     与按钮类格式（加粗按钮写 bold）保持同一份声明文本，结构签名才可比较 / 可合并 */
  const weight = String(cs.fontWeight || '').trim();
  if (weight) push('font-weight', parseInt(weight, 10) >= 600 || weight === 'bolder' ? 'bold' : weight);
  push('font-style', cs.fontStyle);
  push('text-decoration-line', cs.textDecorationLine || cs.textDecoration);
  return out;
}

/** 用本次写入的属性覆盖基础声明（中性值 = 摘除该项；同名单项就地替换，不叠加第二份）。 */
function _overlayInlineDecls(
  base: Array<[string, string]>,
  prop: string,
  value: string,
): Array<[string, string]> {
  const out: Array<[string, string]> = base.map((p) => [p[0], p[1]] as [string, string]);
  /* 【D-02】调用方传入的颜色值（可能来自 color picker 的 `color(srgb …)`）同样归一 */
  const declValue = normalizeInlineDeclValue(prop, value);
  const idx = out.findIndex((p) => p[0] === prop);
  const ops = _decorationTokenOps(prop, declValue);
  if (ops) {
    /* 【fix39】修饰词元与基础声明里的同类词元合并：加删除线保留已生效的下划线，反之亦然 */
    const tokens = _mergeDecorationTokens(idx >= 0 ? String(out[idx][1]).toLowerCase().split(/\s+/).filter((t) => !!t && t !== 'none') : [], ops);
    if (idx >= 0) out.splice(idx, 1);
    if (tokens.length) out.push([prop, tokens.join(' ')]);
    return out;
  }
  if (isNeutralStyleValue(prop, declValue)) {
    if (idx >= 0) out.splice(idx, 1);
    return out;
  }
  if (idx >= 0) out[idx] = [prop, declValue];
  else out.push([prop, declValue]);
  return out;
}

/** 选区按「文本节点分段」切分：每段 = 一个文本节点内的一段连续区间（跨块 / 跨行天然分流）。 */
function _inlineSegmentsInRange(range: Range): InlineSegment[] {
  const out: InlineSegment[] = [];
  _hostsInRange(range).forEach((host: any) => {
    _textNodesInRange(range, host).forEach((t: any) => {
      const len = String(t.nodeValue || '').length;
      if (!len) return;
      let from = 0;
      let to = len;
      try {
        /* comparePoint：-1 = 该点在选区之前，0 = 在选区内，1 = 在选区之后 */
        if (range.comparePoint(t, 0) < 0 && t === range.startContainer) {
          from = Math.max(0, Math.min(range.startOffset, len));
        }
        if (range.comparePoint(t, len) > 0 && t === range.endContainer) {
          to = Math.max(0, Math.min(range.endOffset, len));
        }
      } catch (e) {
        console.warn('[JU] caught error', e);
      }
      if (to > from) out.push({ node: t, from, to, host });
    });
  });
  return out;
}

/** 该段的父级是否就是「承载这段文字的纯样式 span」且被整段覆盖（可直接顶替，避免 span 套 span）。 */
function _segmentReplacesWholeParent(parent: any, seg: InlineSegment): boolean {
  if (!_isPlainStyleSpan(parent)) return false;
  const texts = _collectTextNodes(parent);
  const len = String(seg.node.nodeValue || '').length;
  return texts.length === 1 && texts[0] === seg.node && seg.from === 0 && seg.to === len;
}

/**
 * 纯文本重建单段：删旧 DOM → 新建承载「基础样式 + 本次覆盖」的 span → 插回原位。
 * 返回新节点（span；无任何声明可写时退化为纯文本节点），失败返回 null。
 */
function _rebuildInlineSegment(seg: InlineSegment, prop: string, value: string): any {
  const parent: any = seg.node && seg.node.parentElement;
  if (!parent) return null;
  const text = String(seg.node.nodeValue || '').slice(seg.from, seg.to);
  if (!text) return null;
  /* 基础样式必须在删除旧 DOM **之前**读取：删除后父级（span）可能已被替换 */
  const decls = _overlayInlineDecls(_baseInlineDecls(parent), prop, value);
  const whole = _segmentReplacesWholeParent(parent, seg);
  const sub = document.createRange();
  try {
    sub.setStart(seg.node, seg.from);
    sub.setEnd(seg.node, seg.to);
    sub.deleteContents();
  } catch (e) {
    console.warn('[JU] caught error', e);
    return null;
  }
  if (!decls.length) {
    /* 没有任何声明可写（例如清空全部样式）：退化为纯文本节点，不留空 span */
    const bare = document.createTextNode(text);
    if (whole && parent.parentNode) {
      parent.parentNode.insertBefore(bare, parent);
      parent.parentNode.removeChild(parent);
      return bare;
    }
    try { sub.insertNode(bare); } catch (e) { console.warn('[JU] caught error', e); return null; }
    return bare;
  }
  const span = document.createElement('span');
  decls.forEach(([name, v]) => {
    try { span.style.setProperty(name, v); } catch (e) { console.warn('[JU] caught error', e); }
  });
  span.textContent = text;
  if (whole && parent.parentNode) {
    const up: any = parent.parentNode;
    up.insertBefore(span, parent);
    up.removeChild(parent);
    return span;
  }
  try { sub.insertNode(span); } catch (e) { console.warn('[JU] caught error', e); return null; }
  return span;
}

/** 把选区重新框在重建后的节点上（span 取内容，纯文本节点取整段）。 */
function _selectRebuiltNodes(sel: any, nodes: any[]): boolean {
  const list = (nodes || []).filter((n: any) => n && n.isConnected);
  if (!list.length) return false;
  const pos = (n: any, atEnd: boolean): [any, number] => {
    if (n.nodeType === 3) return [n, atEnd ? String(n.nodeValue || '').length : 0];
    return [n, atEnd ? (n.childNodes || []).length : 0];
  };
  try {
    const a = pos(list[0], false);
    const b = pos(list[list.length - 1], true);
    const nr = document.createRange();
    nr.setStart(a[0], a[1]);
    nr.setEnd(b[0], b[1]);
    sel.removeAllRanges();
    sel.addRange(nr);
    return true;
  } catch (e) {
    console.warn('[JU] caught error', e);
    return false;
  }
}

/**
 * 选区三项内联样式写入主入口（颜色 / 背景 / 字号统一走这里，**不经过 execCommand**）。
 *
 * @param styleProp  CSS 属性名（`color` / `background-color` / `font-size`，驼峰亦可）
 * @param styleValue 目标值；空串、`inherit`、`transparent` 等中性值等价于清除该属性
 * @returns true = 已写入（或已登记 typing style / 已是同值无需重复写）
 */
export function applyInlineStyle(styleProp: string, styleValue: string): boolean {
  /* 入口快照：实机分支与夹具不一致时，这一行就是第一手证据 */
  logInlineStyleEntry();
  const prop = cssPropertyName(styleProp);
  if (!prop) return false;
  /* 【fix39】修饰属性按词元增删（`underline` 增 / `-line-through` 删 / `none` 清空） */
  const decoOps = _decorationTokenOps(prop, styleValue);
  /* 【D-02】写 style 之前先把颜色归一为 #RRGGBB / rgba(r,g,b,a)：
     入参可能是 `color(srgb 0.2 0.396 0.298 / 0.14)`（CSS Color 4），旧内核不认。 */
  const value = normalizeInlineDeclValue(prop, styleValue);
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  /* 宿主判定：跨行选区的 commonAncestorContainer 落在 #content 上（不在任何
     contenteditable 内），必须回落到「与选区相交的可编辑宿主集合」，否则直接 false。 */
  const hosts = _hostsInRange(range);
  if (!hosts.length) return false;
  beginEditorFormatting();
  try {
    const text = range.toString();
    /* ① 折叠光标 / 无可选文字：DOM 无处可写 ⇒ 登记 typing style，下一次落字时自动套用 */
    if (range.collapsed || !text) {
      /* 修饰词元算子是对「选区」增删，无选区时不登记（避免把 `-line-through` 写进 typing style） */
      if (!decoOps) setTypingInlineStyle(prop, value);
      _focusRichtextHost(hosts[0]);
      return true;
    }
    /* ② 同值重复点击不 toggle、也不清除：整个选区都已是目标值 ⇒ 只归还焦点与选区 */
    if (value && _rangeAlreadyHasValue(range, prop, value)) {
      _focusRichtextHost(hosts[0]);
      return true;
    }
    /* ③′ 取消该格式时先拆掉同类语义标签（fix37-1）：标签仍生效时只摘声明文字依旧加粗，
       逐块取消多行永远收不干净。用切分过边界的临时 Range 判定，边界落在文本节点上，
       拆标签后选区 / 偏移仍有效。 */
    if (decoOps ? (decoOps.del.length > 0 || decoOps.clear) : isNeutralStyleValue(prop, value)) {
      /* 【fix39】修饰属性只拆「本次那一个词元」对应的标签 / 声明，另一项修饰原地保留 */
      const tok = decoOps && !decoOps.clear && decoOps.del.length === 1 ? decoOps.del[0] : undefined;
      _unwrapSemanticTagsInRange(_splitBoundaryTextNodes(range), prop, tok);
    }
    /* ③ 逐文本节点分段重建：每段各自「删旧 DOM → 包一个带全量样式的 span → 插回」 */
    const segments = _inlineSegmentsInRange(range);
    if (!segments.length) return false;
    const rebuilt: any[] = [];
    segments.forEach((seg: InlineSegment) => {
      const node = _rebuildInlineSegment(seg, prop, value);
      if (node) rebuilt.push(node);
    });
    if (!rebuilt.length) return false;
    /* ④ 结构归一：嵌套 span 摊平 / 相邻同 style 合并 / 空 span 展开 / 文本合并 */
    hosts.forEach((h: any) => normalizeInlineStyles(h));
    /* ⑤ 先聚焦宿主、再注入 Range：focus() 会把光标塌陷到行首，顺序不能反 */
    _focusRichtextHost(hosts[0]);
    _selectRebuiltNodes(sel, rebuilt);
    /* ⑥ 显式把新 DOM 写回数据模型（等价 updateText；noNotify 静默提交，不触发重绘） */
    try {
      if (typeof deps.commitInlineStyle === 'function') deps.commitInlineStyle();
    } catch (e) {
      console.warn('[JU] caught error', e);
    }
    return true;
  } finally {
    endEditorFormatting();
  }
}

/* ============================================================
   typing style（折叠光标下的「待生效样式」）
   ------------------------------------------------------------
   collapsed 选区没有可包裹的文本，宿主旧实现靠 execCommand 的 typing style，
   而该 API 在 WebView2 已废弃。这里自己维护一份待生效样式表：
     · beforeinput 记录落字起点（文本节点 + 偏移）；
     · input 后只包裹「本次新落下的那几个字」，不碰已有文字；
     · 选区变为非折叠 / 移出编辑区时自动失效。
   ============================================================ */
const _typingInlineStyle: Map<string, string> = new Map();
let _typingStyleBound = false;
let _typingAnchor: { node: any; offset: number } | null = null;

/** 登记 / 更新折叠光标的待生效样式（中性值 = 取消该项）。 */
export function setTypingInlineStyle(styleProp: string, styleValue: string): void {
  const prop = cssPropertyName(styleProp);
  if (!prop) return;
  /* 【D-02】待生效样式同样归一，落字时的 span 不会写出 `color(srgb …)` */
  const value = normalizeInlineDeclValue(prop, styleValue);
  if (!value || isNeutralStyleValue(prop, value)) _typingInlineStyle.delete(prop);
  else _typingInlineStyle.set(prop, value);
  _ensureTypingStyleListeners();
}

/** 清空全部待生效样式。 */
export function clearTypingInlineStyle(): void {
  _typingInlineStyle.clear();
  _typingAnchor = null;
}

/** 当前待生效样式快照（调试 / 回归断言用）。 */
export function getTypingInlineStyle(): Record<string, string> {
  const out: Record<string, string> = {};
  _typingInlineStyle.forEach((v, k) => { out[k] = v; });
  return out;
}

/**
 * 把待生效样式套用到「本次新落下的文字」上。
 *
 * 实机补强（两项此前必然踩空的场景）：
 *   · 空行 / 空 span 落字时光标容器是**元素**（`.text`），旧实现只认 nodeType === 3
 *     ⇒ 直接 return，typed 文字永远拿不到样式；
 *   · 三项依次写入时旧实现复用同一个 Range（多属性多 span 时会重复 splitText），
 *     这里改为「先记宿主纯文本偏移，再逐项用偏移重建 Range」。
 */
function _applyTypingStyleToInserted(target: any): void {
  if (!_typingInlineStyle.size) return;
  const host: any = richtextHostOf(target);
  if (!host) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const caret = sel.getRangeAt(0);
  if (!caret.collapsed) return;
  const anchor = _typingAnchor;
  let node: any = caret.startContainer;
  let caretOffset = caret.startOffset;
  if (!node || !node.isConnected) return;
  if (node.nodeType === 1) {
    /* 空行落字：容器是元素 ⇒ 取光标前一个子节点（刚插入的文本节点） */
    const kids: any[] = Array.from(node.childNodes || []);
    const prev: any = caretOffset > 0 ? kids[caretOffset - 1] : kids[0];
    if (!prev) return;
    if (prev.nodeType === 3) {
      node = prev;
      caretOffset = String(node.nodeValue || '').length;
    } else {
      const inner = _collectTextNodes(prev);
      if (!inner.length) return;
      node = inner[inner.length - 1];
      caretOffset = String(node.nodeValue || '').length;
    }
  }
  if (node.nodeType !== 3) return;
  let from = -1;
  let to = -1;
  if (anchor && anchor.node === node && node.nodeType === 3 && caretOffset > anchor.offset) {
    from = anchor.offset;
    to = caretOffset;
  } else if (!anchor || anchor.node !== node) {
    /* 新起一个文本节点（在空段落 / 空 span 里落字）：整段都是新文字 */
    const len = String(node.nodeValue || '').length;
    if (len > 0 && len === caretOffset) { from = 0; to = len; }
  }
  if (from < 0 || to <= from) return;
  /* 先换算成宿主纯文本偏移：三项依次写入时会不断拆分 / 包裹节点，引用会失效 */
  const offFrom = _textOffsetOf(host, node, from);
  const offTo = _textOffsetOf(host, node, to);
  _typingInlineStyle.forEach((v, k) => {
    /* 【防止逐字嵌套】光标所在元素已经带有该项样式（例如上一键刚包好的 span）
       就直接跳过：否则每输入一个字符都会再套一层 span，越打越深。 */
    const curSel = window.getSelection();
    const caretEl: any = curSel && curSel.rangeCount
      ? (curSel.getRangeAt(0).startContainer.nodeType === 3
        ? (curSel.getRangeAt(0).startContainer as any).parentElement
        : curSel.getRangeAt(0).startContainer)
      : null;
    if (_elementHasCssValue(caretEl, k, v)) return;
    const typed = _rangeFromOffsets(host, offFrom, offTo);
    if (typed) _applyInlineToRange(typed, k, v);
  });
  /* 光标回到新文字末尾（结构归一后原 Range 可能已失效） */
  try {
    const back = _rangeFromOffsets(host, offTo, offTo);
    if (back) {
      back.collapse(true);
      sel.removeAllRanges();
      sel.addRange(back);
    }
  } catch (e) { console.warn('[JU] caught error', e); }
}

/** 一次性装配 typing style 监听（beforeinput / input / selectionchange）。 */
function _ensureTypingStyleListeners(): void {
  if (_typingStyleBound) return;
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  _typingStyleBound = true;
  document.addEventListener('beforeinput', (e: any) => {
    try {
      _typingAnchor = null;
      if (!_typingInlineStyle.size) return;
      if (!richtextHostOf(e.target)) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      if (!r.collapsed) return;
      /* 空行 / 空 span 落字时 startContainer 是元素（nodeType === 1）：
         同样记录，落字后再由 _applyTypingStyleToInserted 解析出新建的文本节点 */
      if (r.startContainer.nodeType !== 3 && r.startContainer.nodeType !== 1) return;
      _typingAnchor = { node: r.startContainer, offset: r.startOffset };
    } catch (err) {
      console.warn('[JU] caught error', err);
      _typingAnchor = null;
    }
  }, true);
  document.addEventListener('input', (e: any) => {
    const anchor = _typingAnchor;
    _typingAnchor = null;
    if (!_typingInlineStyle.size) return;
    try {
      _typingAnchor = anchor;
      _applyTypingStyleToInserted(e.target);
    } catch (err) {
      console.warn('[JU] caught error', err);
    } finally {
      _typingAnchor = null;
    }
  }, true);
  document.addEventListener('selectionchange', () => {
    if (!_typingInlineStyle.size) return;
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) { _typingInlineStyle.clear(); return; }
      const r = sel.getRangeAt(0);
      /* 选区一旦变成非折叠，待生效样式按浏览器口径作废（避免污染后续整段操作） */
      if (!r.collapsed) _typingInlineStyle.clear();
      else if (!richtextHostOf(r.startContainer)) _typingInlineStyle.clear();
    } catch (e) { console.warn('[JU] caught error', e); }
  });
}

/**
 * 编辑器初始化：强制 `styleWithCSS` 模式。
 *
 * 颜色 / 背景 / 字号已改走纯 DOM 引擎，但仍有残留 execCommand 路径（粘贴、insertText、
 * 宿主自动补全等）。这些路径必须产出 CSS（`<span style>`）而不是 `<font size="1-7">`
 * 这类表现型标签 —— 否则内联 style 与表现型标签混用，层叠顺序不可控，
 * 后续命令重建边界节点时会把前一项属性整段清除。
 */
export function initRichtextStyleMode(): void {
  try { safeExec('styleWithCSS', true); } catch (e) { console.warn('[JU] caught error', e); }
}

/** 清除选区上的某一项内联样式（清空按钮的独立通道，不做 toggle）。 */
export function clearInlineStyleFromSelection(styleProp: string): boolean {
  const prop = cssPropertyName(styleProp);
  if (!prop) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  /* 宿主判定与写入引擎同一口径：跨行选区也要能清除（commonAncestorContainer 可能在 #content 上） */
  const hosts = _hostsInRange(range);
  if (!hosts.length) return false;
  beginEditorFormatting();
  try {
    if (range.collapsed) {
      _typingInlineStyle.delete(prop);
      _focusRichtextHost(hosts[0]);
      return true;
    }
    const res = _applyInlineToRange(range, prop, '');
    if (!res.ok) return false;
    /* 与 applyInlineStyle 同序：先聚焦宿主、再注入 Range，避免 focus() 把选区塌陷到行首 */
    _focusRichtextHost(hosts[0]);
    if (!_restoreSelectionByAnchors(sel, res.anchors)) _selectTextNodes(sel, res.texts);
    return true;
  } finally {
    endEditorFormatting();
  }
}

/* ============================================================
   选区锚点（跨重渲染恢复）
   ------------------------------------------------------------
   实机现象：点颜色 / 字号之后，正文 blur → updateText → notify → renderMain
   会重建 `#content`，正在编辑的 contenteditable 被替换 ⇒ 之前克隆的 Range
   边界节点脱离文档，restoreSel() 失败；第二次点「背景 / 字号」时已无有效选区，
   用户看到的就是「三项不能同时应用」。
   锚点用「宿主 data-id + 纯文本偏移」记录，重渲染后仍可按选择器找回宿主。
   ============================================================ */
export interface SelectionAnchor {
  /** 起点宿主选择器（`#content .text[data-id="…"]` 或 `#id`） */
  startSelector: string;
  /** 起点宿主内的纯文本偏移 */
  startOffset: number;
  /** 终点宿主选择器（跨行选区时与起点不同） */
  endSelector: string;
  /** 终点宿主内的纯文本偏移 */
  endOffset: number;
  collapsed: boolean;
}

/** 求解宿主选择器（优先 `#content .text[data-id]`，其次元素 id）。 */
export function hostSelectorOf(host: any): string {
  try {
    if (!host || host.nodeType !== 1) return '';
    const id = host.getAttribute ? host.getAttribute('data-id') : '';
    if (id) return '#content .text[data-id="' + String(id).replace(/"/g, '\\"') + '"]';
    if (host.id) return '#' + host.id;
    return '';
  } catch (e) {
    console.warn('[JU] caught error', e);
    return '';
  }
}

/** 记录当前（或指定）选区的锚点；不在编辑区内 / 无可定位宿主时返回 null。 */
export function captureSelectionAnchor(range?: Range | null): SelectionAnchor | null {
  try {
    let r: Range | null = range || null;
    if (!r) {
      const s = window.getSelection();
      if (!s || s.rangeCount === 0) return null;
      r = s.getRangeAt(0);
    }
    const hosts = _hostsInRange(r);
    if (!hosts.length) return null;
    const first: any = hosts[0];
    const last: any = hosts[hosts.length - 1];
    const startSelector = hostSelectorOf(first);
    const endSelector = hostSelectorOf(last);
    if (!startSelector || !endSelector) return null;
    const startOffset = _textOffsetOf(first, r.startContainer, r.startOffset);
    const endOffset = _textOffsetOf(last, r.endContainer, r.endOffset);
    return { startSelector, startOffset, endSelector, endOffset, collapsed: r.collapsed };
  } catch (e) {
    console.warn('[JU] caught error', e);
    return null;
  }
}

/** 由锚点重建 Range（宿主已随重渲染被替换时按选择器重新查找）；失败返回 null。 */
export function rangeFromSelectionAnchor(anchor: SelectionAnchor | null): Range | null {
  if (!anchor || !anchor.startSelector) return null;
  let startHost: any = null;
  let endHost: any = null;
  try { startHost = document.querySelector(anchor.startSelector); } catch (e) { startHost = null; }
  try { endHost = document.querySelector(anchor.endSelector); } catch (e) { endHost = null; }
  if (!startHost || !startHost.isConnected) return null;
  if (!endHost || !endHost.isConnected) endHost = startHost;
  const startRange = _rangeFromOffsets(startHost, anchor.startOffset, anchor.startOffset);
  const endRange = _rangeFromOffsets(endHost, anchor.endOffset, anchor.endOffset);
  if (!startRange || !endRange) return null;
  const r = document.createRange();
  try {
    r.setStart(startRange.startContainer, startRange.startOffset);
    r.setEnd(endRange.startContainer, endRange.startOffset);
  } catch (e) {
    console.warn('[JU] caught error', e);
    return null;
  }
  return r;
}
