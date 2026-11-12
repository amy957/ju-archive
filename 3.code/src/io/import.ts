/**
 * M1-1 · 批次 AF · 导入与解析（Import）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - MAX_IMPORT_BYTES / looksLikeBinaryText ................... 18983-18994
 *   - readFile ................................................ 18995-19020
 *   - _createImportDoc ........................................ 19428-19440
 *   - importOutline ........................................... 19441-19498
 *   - importOpml .............................................. 19499-19525
 *   - importHtml .............................................. 19526-19577
 *   - stripDangerKeys / validateImportedTree ................... 19578-19634
 *   - IMPORT_BINARY_EXTS / IMG_IMPORT_EXTS .................... 19635-19643
 *   - readFileDataURL / _imgDataUrlWhitelisted /
 *     _imgRasterToPng / _imgToPngDataUrl ...................... 19644-19693
 *   - _unzipEntry / importDocx ................................ 19694-19786
 *   - handleImportFiles ....................................... 19787-19919
 *   - importICS ............................................... 19920-19959
 *   - openImportDialog ........................................ 19960-19995
 *   - readFileArrayBuffer（源「桌面 / 反馈」区同段工具）........ 22393-22400
 *
 * 约束：扩展名名单（47 项二进制 / 7 项图片）、64MB 上限、编码回退链（utf-8 fatal → gbk → utf-8）、
 *       二进制探测阈值（0.05）、图片内联上限（700,000 字符）、ZIP 结构校验、危险键清洗、
 *       环路 / 引用完整性校验、弹窗结构与文案逐字保留。
 *   纯结构调整（运行期零行为差异）：
 *     1) 未拆分业务符号统一走 `deps` 注入：commit / state / ui / N / actions / addNodeTo / saveUI /
 *        renderSidebar / forceRender / getCalendarRootId / ensureCalendarRoot / migrateStateObject /
 *        IS_DESKTOP / sanitizeHtml / flushPersistNow / schedulePersist / applyUIFields /
 *        setGraphPositions / saveGraphPositions / restoreVersions / desktopInvoke / desktopReloadIntoApp。
 *     2) 产品件 `_graphPositions=p.graphpos` 的顶层赋值改为 `deps.setGraphPositions(p.graphpos)`
 *        （跨模块无法共享 `let` 绑定，以写入端口承接，语义等价）。
 *   已拆分模块直接 import：esc / stripHtml / ymd / pad（core/utils）；toast / appConfirm /
 *     _modalStack / _syncAppInert（ui/common）；initStore（core/store）。
 */
import { esc, stripHtml, ymd, pad } from '../core/utils';
import { toast, appConfirm, _modalStack, _syncAppInert } from '../ui/common';
import { initStore } from '../core/store';
import { encryptState, decryptState } from '../core/crypto';
import { purgeLocalCopy } from '../core/local-copies';

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export interface ImportDeps {
  /* 核心运行时 */
  /** 不可变提交（对应产品的 `commit(fn,opts)`） */
  commit: (fn: (s: any) => void, opts?: any) => any;
  /** 全局数据状态（对应产品的 `state`） */
  state: any;
  /** 当前状态快照（对应产品的 `getState()`：导入前备份须取真实状态，代理对象无枚举键） */
  getState: () => any;
  /** 全局 UI 状态对象（对应产品的 `ui`，导入后回填 currentDocId / view） */
  ui: any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** 业务动作集合（对应产品的 `actions`，导入落账走 logActivity） */
  actions: any;
  /** 节点工厂（对应产品的 `addNodeTo(st,pid,idx,init)`） */
  addNodeTo: (st: any, parentId: any, index: any, init: any) => any;

  /* 渲染 / 持久化 */
  /** UI 状态持久化（对应产品的 `saveUI()`） */
  saveUI: () => void;
  /** 侧栏重绘（对应产品的 `renderSidebar()`） */
  renderSidebar: () => void;
  /** 请求下一次渲染（对应产品的 `forceRender()`） */
  forceRender: () => void;
  /** 立即落盘（对应产品的 `flushPersistNow()`） */
  flushPersistNow: () => void;
  /** 持久化调度（对应产品的 `schedulePersist()`） */
  schedulePersist: () => void;

  /* 日历 / 状态迁移 */
  /** 日历根 id（对应产品的 `getCalendarRootId()`） */
  getCalendarRootId: () => any;
  /** 确保日历根存在（对应产品的 `ensureCalendarRoot()`） */
  ensureCalendarRoot: () => void;
  /** 旧版备份归一化（对应产品的 `migrateStateObject(st)`） */
  migrateStateObject: (st: any) => any;
  /** 桌面版判定（对应产品的 `IS_DESKTOP`） */
  IS_DESKTOP: boolean;
  /** UI 字段回填（对应产品的 `applyUIFields(u)`，完整备份恢复用） */
  applyUIFields: (u: any) => void;
  /** 图谱坐标写入（对应产品的 `_graphPositions = p.graphpos`） */
  setGraphPositions: (pos: any) => void;
  /** 图谱坐标持久化（对应产品的 `saveGraphPositions()`） */
  saveGraphPositions: () => void;
  /** 历史版本恢复（对应产品的 `restoreVersions(list)`） */
  restoreVersions: (list: any) => Promise<any>;

  /* 桌面壳端口 */
  /** 桌面 IPC 调用（对应产品的 `desktopInvoke(cmd,args)`） */
  desktopInvoke: (cmd: string, args: any) => Promise<any>;
  /** 桌面快照重载（对应产品的 `desktopReloadIntoApp()`） */
  desktopReloadIntoApp: () => Promise<boolean>;

  /* 富文本 */
  /** HTML 净化（对应产品的 `sanitizeHtml(html)`，图片内联校验） */
  sanitizeHtml: (html: string) => string;
}

/** 依赖注入容器（模块内安全占位：加载即不抛 ReferenceError）。 */
export const deps: ImportDeps = {
  commit: () => undefined,
  state: { nodes: {}, rootId: null },
  getState: () => ({ nodes: {}, rootId: null }),
  ui: {},
  N: () => null,
  actions: {},
  addNodeTo: () => null,

  saveUI: () => undefined,
  renderSidebar: () => undefined,
  forceRender: () => undefined,
  flushPersistNow: () => undefined,
  schedulePersist: () => undefined,

  getCalendarRootId: () => null,
  ensureCalendarRoot: () => undefined,
  migrateStateObject: (st: any) => st,
  IS_DESKTOP: false,
  applyUIFields: () => undefined,
  setGraphPositions: () => undefined,
  saveGraphPositions: () => undefined,
  restoreVersions: () => Promise.resolve(null),

  desktopInvoke: () => Promise.resolve(null),
  desktopReloadIntoApp: () => Promise.resolve(false),

  sanitizeHtml: (html: string) => html,
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function injectImportDeps(next: Partial<ImportDeps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   文件读取辅助
   ============================================================ */
export const MAX_IMPORT_BYTES = 67108864; /* FIX-file-2 单文件导入大小上限：64MB（67108864 字节） */

export function looksLikeBinaryText(text: string): boolean {
  if (!text) return false;
  const n = Math.min(text.length, 2048);
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    if (c === 0xFFFD) bad += 1;
    else if (c === 0x00 || (c >= 0x00 && c <= 0x08) || (c >= 0x0E && c <= 0x1F)) bad += 2;
  }
  return n > 0 && bad / n > 0.05;
}

export function readFile(file: any): Promise<string> {
  /* FIX-file-2 无大小检查：readAsArrayBuffer + TextDecoder 一次性把整文件读入内存并解码，>64MB 会冻结主线程；
     超过阈值直接 reject，由 handleImportFiles 捕获后 toast 提示（errors.push(f.name+'：'+err.message)） */
  if (file && typeof file.size === 'number' && file.size > MAX_IMPORT_BYTES) {
    return Promise.reject(new Error('文件超过 64MB 上限（' + Math.round(file.size / 1048576) + 'MB），已拒绝导入以避免卡死'));
  }
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const buf = r.result as ArrayBuffer;
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
      catch (e) {
        try { text = new TextDecoder('gbk').decode(buf); }
        catch (e2) { text = new TextDecoder('utf-8').decode(buf); }
      }
      if (looksLikeBinaryText(text)) {
        rej(new Error('文件疑似二进制格式（PDF/图片/压缩包等），无法作为文本读取，请先转换为 Markdown 或 HTML 后重试'));
        return;
      }
      res(text);
    };
    r.onerror = () => rej(new Error('读取失败'));
    r.readAsArrayBuffer(file);
  });
}

export function readFileArrayBuffer(file: any): Promise<ArrayBuffer> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as ArrayBuffer);
    r.onerror = () => rej(new Error('读取失败'));
    r.readAsArrayBuffer(file);
  });
}

/* ============================================================
   导入：单文档化容器 + 各格式解析器
   ============================================================ */
/* 【导入单文档化】按被导入文件名创建容器文档（root 下第 0 位），返回新文档节点 id；失败返回 null。
   标题 = 文件名去掉最后一个扩展名；无标题时用「导入文档」。 */
export function _createImportDoc(baseName: any): any {
  let title = String(baseName == null ? '' : baseName).trim();
  const dot = title.lastIndexOf('.');
  if (dot > 0) title = title.slice(0, dot).trim();
  if (!title) title = '导入文档';
  let id: any = null;
  try {
    deps.commit((s: any) => { const n = deps.addNodeTo(s, s.rootId, 0, { text: title }); id = n ? n.id : null; }, { snapshot: true });
  } catch (e) { console.warn('[JU] 创建导入容器文档失败', e); return null; }
  return id || null;
}

export function importOutline(text: any, parentId: any): number {
  const lines = String(text).split(/\r?\n/);
  const entries: any[] = [];
  let inCode = false;
  const allIndents = lines.map(l => {
    const m = l.match(/^([ \t]*)\S/);
    if (!m) return Infinity;
    const n = m[1].replace(/\t/g, '  ').length;
    return n > 0 ? n : Infinity;
  }).filter(Number.isFinite);
  const unit = allIndents.length ? allIndents.reduce((a, b) => a < b ? a : b) : 2;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) { inCode = !inCode; continue; }
    if (inCode || !line.trim()) continue;
    const m = line.match(/^([ \t]*)(.*)$/); if (!m) continue;
    const rawIndent = m[1].replace(/\t/g, '  ').length;
    let content = m[2]; let level = -1;
    const hMatch = content.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) { level = hMatch[1].length - 1; content = hMatch[2]; }
    content = content.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
    let done = false;
    if (/^\[x\]\s*/i.test(content)) { done = true; content = content.replace(/^\[x\]\s*/i, ''); }
    else if (/^\[\s\]\s*/i.test(content)) content = content.replace(/^\[\s\]\s*/i, '');
    let date: any = null;
    const dm = content.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
    if (dm) { date = dm[1]; content = content.replace(/📅\s*\d{4}-\d{2}-\d{2}/g, ''); }
    content = content.trim();
    if (!content) continue;
    const effIndent = level >= 0 ? level : Math.round(rawIndent / unit);
    entries.push({ indent: effIndent, text: content, done, date });
  }
  if (!entries.length) return 0;
  let count = 0, firstId: any = null;
  deps.commit((s: any) => {
    const baseId = (parentId && s.nodes[parentId]) ? parentId : s.rootId;
    const stack = [{ indent: -1, id: baseId }];
    for (const e of entries) {
      while (stack.length > 1 && stack[stack.length - 1].indent >= e.indent) stack.pop();
      const pid = stack[stack.length - 1].id;
      const n = deps.addNodeTo(s, pid, null, { text: e.text, done: e.done, date: e.date });
      if (!n) continue;
      count++;
      if (!firstId) firstId = n.id;
      stack.push({ indent: e.indent, id: n.id });
    }
  }, { snapshot: true });
  const uniqueIndents = new Set(allIndents);
  const hint = uniqueIndents.size > 4
    ? '（缩进不规整，层级可能不准）'
    : unit > 2
      ? '（缩进单位 ' + unit + ' 空格）'
      : '';
  const docId = (parentId && parentId !== deps.state.rootId && deps.state.nodes[parentId]) ? parentId : null;
  if (count > 0 && (docId || firstId)) deps.actions.logActivity('add', docId || firstId);
  toast(`已导入 ${count} 个节点${hint}`);
  return count;
}

export function importOpml(text: any, parentId: any): number {
  const doc = new DOMParser().parseFromString(String(text), 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('OPML 解析失败');
  const body = doc.querySelector('body'); if (!body) return 0;
  let count = 0, firstId: any = null;
  deps.commit((s: any) => {
    function walk(el: any, pid: any): void {
      const raw = (el.getAttribute('text') || el.getAttribute('title') || '').trim();
      const childOutlines = Array.from(el.children).filter((c: any) => c.tagName && c.tagName.toLowerCase() === 'outline');
      if (!raw && !childOutlines.length) return;
      let content = raw || '(空)', done = false, date: any = null;
      if (el.getAttribute('_complete') === 'true') done = true;
      const note = el.getAttribute('_note');
      if (note && /^\d{4}-\d{2}-\d{2}$/.test(note)) date = note;
      const n = deps.addNodeTo(s, pid, null, { text: content, done, date });
      if (!n) return;
      count++;
      if (!firstId) firstId = n.id;
      childOutlines.forEach((c: any) => walk(c, n.id));
    }
    const baseId = (parentId && s.nodes[parentId]) ? parentId : s.rootId;
    Array.from(body.children).forEach((c: any) => { if (c.tagName && c.tagName.toLowerCase() === 'outline') walk(c, baseId); });
  }, { snapshot: true });
  const docId = (parentId && parentId !== deps.state.rootId && deps.state.nodes[parentId]) ? parentId : null;
  if (count > 0 && (docId || firstId)) deps.actions.logActivity('add', docId || firstId);
  return count;
}

export function importHtml(text: any, parentId: any): number {
  const doc = new DOMParser().parseFromString(String(text), 'text/html');
  doc.querySelectorAll('script,style,head,nav,footer,header,title').forEach(el => el.remove());
  const body = doc.body; if (!body) return 0;
  const entries: any[] = [];
  function walk(el: any, depth: number): void {
    for (const child of Array.from(el.children) as any[]) {
      const tag = child.tagName.toLowerCase();
      if (/^h([1-6])$/.test(tag)) { const t = child.textContent.trim(); if (t) entries.push({ depth: Math.max(0, parseInt(tag[1], 10) - 1), text: t }); }
      else if (tag === 'ul' || tag === 'ol') walk(child, depth + 1);
      else if (tag === 'li') {
        const own = Array.from(child.childNodes).filter((n: any) => n.nodeType === 3 || (n.nodeType === 1 && !/^(ul|ol)$/i.test(n.tagName))).map((n: any) => n.textContent).join('').trim();
        if (own) entries.push({ depth, text: own });
        for (const sub of Array.from(child.children) as any[]) { if (/^(ul|ol)$/i.test(sub.tagName)) walk(sub, depth + 1); }
      } else if (tag === 'p' || tag === 'div') {
        const hasBlocks = Array.from(child.children).some((c: any) => /^(div|p|ul|ol|li|h[1-6])$/i.test(c.tagName));
        if (hasBlocks) walk(child, depth);
        else {
          const t = child.textContent.trim();
          if (t) {
            if (t.length < 900) entries.push({ depth, text: t });
            else {
              const parts = t.split(/(?<=[。！？；.!?;])/).map((s: string) => s.trim()).filter(Boolean);
              parts.forEach((p: string) => entries.push({ depth, text: p }));
            }
          }
        }
      }
    }
  }
  walk(body, 0);
  if (!entries.length) return 0;
  let count = 0, firstId: any = null;
  deps.commit((s: any) => {
    const baseId = (parentId && s.nodes[parentId]) ? parentId : s.rootId;
    const stack = [{ depth: -1, id: baseId }];
    for (const e of entries) {
      let content = e.text.replace(/\s+/g, ' ').trim();
      if (!content) continue;
      while (stack.length > 1 && stack[stack.length - 1].depth >= e.depth) stack.pop();
      const pid = stack[stack.length - 1].id;
      const n = deps.addNodeTo(s, pid, null, { text: content });
      if (!n) continue;
      count++;
      if (!firstId) firstId = n.id;
      stack.push({ depth: e.depth, id: n.id });
    }
  }, { snapshot: true });
  const docId = (parentId && parentId !== deps.state.rootId && deps.state.nodes[parentId]) ? parentId : null;
  if (count > 0 && (docId || firstId)) deps.actions.logActivity('add', docId || firstId);
  return count;
}

/* 【修复 M3】导入 JSON 前做环路/引用完整性校验 */
/* FIX-H-04b 递归剔除 JSON.parse 可能产生的危险自有键 __proto__/constructor/prototype，从源头阻断原型污染进入状态树；仅删这三个键，不影响正常节点数据（兼容 null/数组） */
export function stripDangerKeys(v: any): any {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) { for (const item of v) stripDangerKeys(item); return v; }
  for (const k of ['__proto__', 'constructor', 'prototype']) {
    if (Object.prototype.hasOwnProperty.call(v, k)) delete v[k];
  }
  for (const k in v) {
    if (Object.prototype.hasOwnProperty.call(v, k)) stripDangerKeys(v[k]);
  }
  return v;
}

export function validateImportedTree(p: any): { ok: boolean; err?: string } {
  if (!p || typeof p !== 'object') return { ok: false, err: '不是有效对象' };
  stripDangerKeys(p); /* FIX-H-04b 校验前先清洗整棵导入对象的危险键 */
  if (!p.nodes || typeof p.nodes !== 'object') return { ok: false, err: '缺少 nodes 字段' };
  if (!p.rootId || !p.nodes[p.rootId]) return { ok: false, err: '缺少根节点' };
  /* 【修复 2026-09-27】DFS 区分「访问过」与「当前路径上」：
     visited 去重（多父共享子树的合法 DAG 不再误报），onStack 判定真环 */
  const visited = new Set<any>();
  const onStack = new Set<any>();
  const stack = [p.rootId];
  while (stack.length) {
    const id = stack[stack.length - 1];
    const n = p.nodes[id];
    if (!n) return { ok: false, err: '引用了不存在的节点：' + id };
    onStack.add(id);
    if (!Array.isArray(n.children)) { onStack.delete(id); stack.pop(); continue; }
    let advanced = false;
    for (const cid of n.children) {
      if (typeof cid !== 'string') return { ok: false, err: '子节点 ID 非字符串' };
      if (!p.nodes[cid]) return { ok: false, err: '子节点引用不存在：' + cid };
      if (onStack.has(cid)) return { ok: false, err: '检测到节点引用环路（节点 ' + cid + '）' };
      if (visited.has(cid)) continue;
      visited.add(cid);
      stack.push(cid);
      advanced = true;
      break;
    }
    if (!advanced) { onStack.delete(id); stack.pop(); }
  }
  /* 【P1-11 M2】检测不可达子树中的环（漂浮节点） */
  for (const id in p.nodes) {
    if (visited.has(id)) continue;
    const seen = new Set<any>();
    let cur = id;
    const chain: any[] = [];
    while (cur && !seen.has(cur)) {
      if (!p.nodes[cur]) break;
      seen.add(cur); chain.push(cur);
      cur = p.nodes[cur].parent;
    }
    if (cur && seen.has(cur)) return { ok: false, err: '检测到漂浮子树环路（节点 ' + cur + '）' };
  }
  return { ok: true };
}

export const IMPORT_BINARY_EXTS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tif', 'tiff', 'psd', 'ai', 'sketch', 'fig',
  'rtf', 'odt', 'pages', 'wps', 'xlsx', 'xls', 'pptx', 'ppt', 'mp3', 'mp4', 'mov', 'avi', 'mkv', 'wav', 'flac',
  'zip', 'rar', '7z', 'tar', 'gz', 'exe', 'msi', 'dmg', 'pkg', 'iso', 'bin', 'apk', 'ttf', 'otf', 'woff', 'woff2', 'eot'
]);
/* R27 图片导入：7 个图片扩展名改由 handleImportFiles 的图片分支前置消费（不变量 #83）；
   IMPORT_BINARY_EXTS 集合本体不变（仍为 47 项二进制名单），其余 40 项一律拒绝口径保持不变量 #78 原文。 */
export const IMG_IMPORT_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);

/* R27 图片导入：读取为 data URL；FileReader 缺失 / 读取失败 / 内容为空时 reject，由调用方转 errors + toast */
export function readFileDataURL(file: any): Promise<string> {
  return new Promise((res, rej) => {
    let fr: FileReader;
    try { fr = new FileReader(); } catch (e) { return rej(new Error('当前环境不支持读取本地文件')); }
    fr.onload = () => { const src = String(fr.result || ''); src ? res(src) : rej(new Error('图片内容为空')); };
    fr.onerror = () => rej(new Error('图片读取失败'));
    try { fr.readAsDataURL(file); } catch (e) { rej(new Error('图片读取失败')); }
  });
}

/* R27 图片导入：sanitizeHtml 的 data:image 白名单口径（只放行 png/jpeg/gif/webp），
   不在白名单的格式（bmp/svg 等）先走画布光栅化降级，避免 src 被净化剥离后留下空 img */
function _imgDataUrlWhitelisted(src: any): boolean {
  const s = String(src || '').toLowerCase();
  return s.startsWith('data:image/png;') || s.startsWith('data:image/jpeg;') || s.startsWith('data:image/gif;') || s.startsWith('data:image/webp;');
}

/* R27 图片导入：按最长边上限缩放后编码为 PNG（整库体积可控；透明度经 PNG 保留） */
function _imgRasterToPng(source: any, w: number, hh: number, maxSide: number): string {
  if (!w || !hh) throw new Error('图片尺寸无法识别');
  const lim = (maxSide > 0 ? maxSide : 1600);
  const k = Math.min(1, lim / Math.max(w, hh));
  const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(hh * k));
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const cx = cv.getContext('2d');
  if (!cx) throw new Error('当前环境不支持图片转换');
  cx.drawImage(source, 0, 0, cw, ch);
  return cv.toDataURL('image/png');
}

/* R27 图片导入：画布光栅化（最长边上限 1600px），非白名单格式统一转 PNG 后内联。
   解码优先用 Image（Chromium 下 bmp/svg 均可解码，createImageBitmap 对 svg 会抛 decode 失败），
   Image 失败再退回 createImageBitmap，两者皆失败才报错。 */
async function _imgToPngDataUrl(blob: any, maxSide: number): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const el = new Image();
    const ok = await new Promise<boolean>(res => {
      el.onload = () => res(true);
      el.onerror = () => res(false);
      try { el.src = url; } catch (e) { res(false); }
    });
    const w = el.naturalWidth || 0, hh = el.naturalHeight || 0;
    if (ok && w > 0 && hh > 0) return _imgRasterToPng(el, w, hh, maxSide);
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(blob);
      try { return _imgRasterToPng(bmp, bmp.width || 0, bmp.height || 0, maxSide); } finally { if (bmp.close) bmp.close(); }
    }
    throw new Error('图片解码失败，请另存为 PNG / JPG 后再导入');
  } finally {
    try { URL.revokeObjectURL(url); } catch (e) { console.warn('[JU] revokeObjectURL failed', e); }
  }
}

export async function _unzipEntry(arrayBuffer: ArrayBuffer, targetName: string): Promise<ArrayBuffer> {
  const u8 = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);
  const len = u8.length;
  const scanStart = Math.max(0, len - 65557);
  let eocd = -1;
  for (let i = len - 22; i >= scanStart; i--) {
    if (u8[i] === 0x50 && u8[i + 1] === 0x4B && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP 结构损坏：未找到中央目录结束记录');
  const totalEntries = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  const target = String(targetName || '').replace(/\\/g, '/');
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (p + 46 > len) break;
    if (dv.getUint32(p, true) !== 0x02014B50) throw new Error('ZIP 中央目录条目签名校验失败');
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = new TextDecoder('utf-8').decode(u8.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/');
    if (name === target) {
      if (localOffset + 30 > len) throw new Error('ZIP 本地头越界');
      if (dv.getUint32(localOffset, true) !== 0x04034B50) throw new Error('ZIP 本地头签名校验失败');
      const lNameLen = dv.getUint16(localOffset + 26, true);
      const lExtraLen = dv.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const comp = u8.slice(dataStart, dataStart + compSize);
      if (method === 0) return comp.buffer;
      if (method === 8) {
        const DS = (globalThis as any).DecompressionStream;
        if (typeof DS === 'undefined') throw new Error('当前浏览器不支持 .docx 解析，请用 Word 打开另存为 .html 或 .md 后导入');
        const ds = new DS('deflate-raw');
        return await new Response(new Blob([comp]).stream().pipeThrough(ds)).arrayBuffer();
      }
      throw new Error('不支持的 ZIP 压缩方法：' + method);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('ZIP 中未找到 word/document.xml');
}

export async function importDocx(arrayBuffer: ArrayBuffer, parentId: any): Promise<number> {
  const xmlBuf = await _unzipEntry(arrayBuffer, 'word/document.xml');
  const xmlStr = new TextDecoder('utf-8').decode(xmlBuf);
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('docx XML 解析失败');
  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const paras = doc.getElementsByTagNameNS('*', 'p');
  const entries: any[] = [];
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    let level = 0;
    const pStyle = p.getElementsByTagNameNS('*', 'pStyle')[0];
    if (pStyle) {
      const val = pStyle.getAttribute('w:val') || pStyle.getAttributeNS(W_NS, 'val') || '';
      const m = /^Heading(\d)$/.exec(val);
      if (m) {
        const lv = parseInt(m[1], 10);
        if (lv >= 1 && lv <= 6) level = lv;
      }
    }
    const ts = p.getElementsByTagNameNS('*', 't');
    let text = '';
    for (let j = 0; j < ts.length; j++) text += ts[j].textContent || '';
    text = text.trim();
    if (text) entries.push({ text, level });
  }
  if (!entries.length) return 0;
  let count = 0;
  deps.commit((s: any) => {
    const baseId = (parentId && s.nodes[parentId]) ? parentId : s.rootId;
    const stack = [{ level: 0, id: baseId }];
    for (const entry of entries) {
      if (entry.level > 0) {
        const targetLevel = entry.level;
        while (stack.length > 1 && stack[stack.length - 1].level >= targetLevel) stack.pop();
        const pid = stack[stack.length - 1].id;
        const n = deps.addNodeTo(s, pid, null, { text: esc(entry.text) });
        if (!n) continue;
        count++;
        stack.push({ level: targetLevel, id: n.id });
      } else {
        const pid = stack[stack.length - 1].id;
        const n = deps.addNodeTo(s, pid, null, { text: esc(entry.text) });
        if (!n) continue;
        count++;
      }
    }
  }, { snapshot: true });
  return count;
}

/* 【review9-12 · ISSUE-012】快照携带 UI 偏好白名单：不含 encKey / encrypted 等敏感或运行时键，
   使 boot.ts:1404 的 ab.ui 恢复分支名实一致；未列入的字段一律不写入 localStorage 快照。 */
function _uiPrefsSnapshot(): any {
  const u: any = deps.ui || {};
  return {
    theme: typeof u.theme === 'string' ? u.theme : document.documentElement.dataset.theme,
    themePreview: u.themePreview, scale: u.scale, mmScale: u.mmScale, view: u.view,
    sidebarLeftCollapsed: u.sidebarLeftCollapsed, sidebarRightCollapsed: u.sidebarRightCollapsed,
    sidebarLeftWidth: u.sidebarLeftWidth, sidebarRightWidth: u.sidebarRightWidth,
    collapsedDocs: u.collapsedDocs, navExpanded: u.navExpanded,
    currentDocId: u.currentDocId, selectedDate: u.selectedDate, uiVersion: 3,
  };
}

/* ============================================================
   导入主流程
   ============================================================ */
export async function handleImportFiles(files: any): Promise<void> {
  let total = 0; const errors: string[] = []; let didFullRestore = false;
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    /* R27 图片导入：图片分支必须先于 IMPORT_BINARY_EXTS 拒绝判断（一个图片文件 = 1 个导入容器文档 + 1 个内联 img 节点）；
       体积口径与 sanitizeHtml 的 F15 渲染上限一致：data URL 字符串 > 700,000 字符（≈500KB）不予内联。 */
    if (IMG_IMPORT_EXTS.has(ext)) {
      try {
        let dataUrl = await readFileDataURL(f);
        if (!/^data:image\//i.test(dataUrl)) throw new Error('不是有效的图片文件');
        if (!_imgDataUrlWhitelisted(dataUrl)) dataUrl = await _imgToPngDataUrl(f, 1600);
        if (!_imgDataUrlWhitelisted(dataUrl)) throw new Error('图片转换失败，请另存为 PNG / JPG 后再导入');
        if (dataUrl.length > 700000) throw new Error('图片过大（约超过 500KB），请压缩或缩小后再导入');
        const clean = deps.sanitizeHtml('<img src="' + dataUrl + '" alt="' + esc(f.name) + '" style="max-width:100%">');
        if (!/<img\b[^>]*\bsrc="data:image\//i.test(clean)) throw new Error('图片内容无法内联（格式不受支持）');
        const docId = _createImportDoc(f.name);
        const pid = (docId && deps.state.nodes[docId]) ? docId : deps.state.rootId;
        deps.commit((s: any) => { deps.addNodeTo(s, pid, null, { text: clean }); }, { snapshot: true });
        total++;
        if (docId) { deps.ui.currentDocId = docId; deps.ui.view = 'auto'; deps.saveUI(); }
      } catch (err: any) { errors.push(f.name + '：' + (err.message || '图片导入失败')); }
      continue;
    }
    if (IMPORT_BINARY_EXTS.has(ext)) {
      errors.push(f.name + '：不支持导入该格式（二进制），请先在对应软件中另存为 Markdown / HTML / 纯文本后再导入');
      continue;
    }
    if (ext === 'docx') {
      try {
        const buf = await readFileArrayBuffer(f);
        const docId = _createImportDoc(f.name);
        const cnt = await importDocx(buf, docId);
        total += cnt;
        if (docId) { deps.ui.currentDocId = docId; deps.ui.view = 'auto'; deps.saveUI(); }
      } catch (err: any) {
        errors.push(f.name + '：' + (err.message || 'docx 解析失败'));
      }
      continue;
    }
    if (ext === 'doc') {
      errors.push(f.name + '：旧版 .doc 二进制格式无法解析，请用 Word 打开另存为 .docx 或 .html 后再导入');
      continue;
    }
    if (ext === 'db' || ext === 'sqlite' || ext === 'sqlite3') {
      /* ISSUE-018 / ISSUE-013：后端 import_db 已注销注册；只记错误并跳过本文件，不得 return 中断整批 */
      errors.push(f.name + '：当前版本不支持直接导入 .db / SQLite，请改用 JSON 备份恢复');
      continue;
    }
    try {
      const text = await readFile(f);
      if (ext === 'ics') { importICS(text); total++; continue; }
      if (ext === 'opml') {
        const docId = _createImportDoc(f.name);
        total += importOpml(text, docId);
        if (docId) { deps.ui.currentDocId = docId; deps.ui.view = 'auto'; deps.saveUI(); }
        continue;
      }
      if (ext === 'html' || ext === 'htm') {
        const docId = _createImportDoc(f.name);
        total += importHtml(text, docId);
        if (docId) { deps.ui.currentDocId = docId; deps.ui.view = 'auto'; deps.saveUI(); }
        continue;
      }
      if (ext === 'json') {
        let p: any;
        try { p = JSON.parse(text); } catch (perr) { errors.push(f.name + '：JSON 解析失败'); continue; }
        /* 【review10-02 · ISSUE-002】关闭备份落盘为 EncPayload（cipher/salt/iv，含 .enc.json）：
           先解密回 state 再走原恢复流程；无密钥提示解锁后跳过；解密失败给出可读错误，
           绝不把密文对象当明文写入 state。 */
        if (p && p.cipher && p.salt && p.iv) {
          const _key = deps.ui && deps.ui.encKey ? deps.ui.encKey : null;
          if (!_key) { errors.push(f.name + '：该备份为加密备份，请先解锁主密码'); continue; }
          try { p = await decryptState(p, _key); }
          catch (derr: any) { errors.push(f.name + '：加密备份解密失败（' + ((derr && derr.message) || '主密码不匹配') + '）'); continue; }
        }
        const isFull = !!(p && p.app === 'juju' && p.type === 'full-backup' && p.state && p.state.nodes && p.state.rootId);
        const restoreState = isFull ? p.state : p;
        if (!restoreState || typeof restoreState !== 'object' || !restoreState.nodes || typeof restoreState.nodes !== 'object' || !restoreState.rootId) {
          errors.push(f.name + '：不是有效的JU备份（缺少 nodes 或 rootId）');
          continue;
        }
        /* 【修复 M3】环路 / 引用完整性校验 */
        const v = validateImportedTree(restoreState);
        if (!v.ok) { errors.push(f.name + '：' + v.err); continue; }
        /* 旧版本备份归一化（补 tagColors/dbFields/activity/_ver 等，修复孤儿节点） */
        const normRestore = deps.migrateStateObject(restoreState);
        if (!normRestore) { errors.push(f.name + '：备份结构无法修复'); continue; }
        /* 【review9-02 · ISSUE-002】加密态（ui.encrypted && ui.encKey）写密文快照 {ts,enc}，
           明文态保持原形状；localStorage 不落明文全库。快照取 getState() 真实状态。 */
        /* 【review9-12 · ISSUE-012】两种形状均附 ui（偏好白名单）：state 仍按加密态只写密文。 */
        const _snap = deps.getState ? deps.getState() : deps.state;
        const _encKey = (deps.ui && deps.ui.encrypted && deps.ui.encKey) ? deps.ui.encKey : null;
        const _uiSnap = _uiPrefsSnapshot();
        try {
          localStorage.setItem('juju.backup.preimport', JSON.stringify(_encKey
            ? { ts: Date.now(), enc: await encryptState(_snap, _encKey), ui: _uiSnap }
            : { ts: Date.now(), state: _snap, ui: _uiSnap }));
        } catch (e) {
          toast('备份当前数据失败，已取消导入');
          continue;
        }
        let brokenRefs = 0;
        for (const id in restoreState.nodes) {
          const n = restoreState.nodes[id];
          if (!n || !Array.isArray(n.children)) continue;
          n.children.forEach((cid: any) => { if (!restoreState.nodes[cid]) brokenRefs++; });
        }
        const ok = await new Promise<boolean>(res => {
          appConfirm(
            brokenRefs > 0
              ? `备份中存在 ${brokenRefs} 个断裂的子节点引用，导入后这些节点将不可见。仍要继续？`
              : (isFull ? '完整备份将覆盖当前数据（含界面设置 / 图谱位置 / 历史版本，已自动备份当前数据）' : '导入 JSON 备份会覆盖当前数据（已自动备份），确定继续？'),
            () => res(true),
            () => res(false));
        });
        if (!ok) continue;
        initStore(normRestore);
        deps.ensureCalendarRoot();
        if (isFull) {
          if (p.ui && typeof p.ui === 'object') deps.applyUIFields(p.ui);
          if (p.graphpos && typeof p.graphpos === 'object') { deps.setGraphPositions(p.graphpos); deps.saveGraphPositions(); }
          if (Array.isArray(p.versions)) await deps.restoreVersions(p.versions);
          toast('已恢复完整备份');
        } else {
          toast('已恢复备份');
        }
        deps.saveUI();
        deps.renderSidebar();
        deps.forceRender();
        deps.flushPersistNow();
        /* 【review11-01 · ISSUE-001】成功恢复即消费快照（含加密态）：避免残留密文快照在下次启动覆盖主库 */
        purgeLocalCopy('PREIMPORT');
        deps.schedulePersist();
        didFullRestore = true;
        continue;
      }
      const docId = _createImportDoc(f.name);
      total += importOutline(text, docId);
      if (docId) { deps.ui.currentDocId = docId; deps.ui.view = 'auto'; deps.saveUI(); }
    } catch (err: any) { errors.push(f.name + '：' + (err.message || '未知错误')); }
  }
  deps.renderSidebar(); deps.forceRender();
  if (errors.length) toast('部分失败：' + errors.join('；'));
  else if (didFullRestore) toast('已恢复备份，后续文件按新库导入');
  else if (total > 0) toast(`已导入 ${files.length} 个文件，共 ${total} 个节点`);
  else toast('未识别到可导入的内容');
}

export function importICS(text: any): void {
  text = String(text || '').replace(/\r\n[ \t]|\n[ \t]|\r[ \t]/g, '');
  const unescIcs = (s: any) => String(s || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
  const events = String(text).split('BEGIN:VEVENT');
  const calRootId = deps.getCalendarRootId();
  const items: any[] = [];
  events.slice(1).forEach(ev => {
    const summary = unescIcs((ev.match(/SUMMARY[^:]*:([^\r\n]+)/) || [])[1] || 'imported');
    const dtstart = (ev.match(/DTSTART[^:]*:([^\r\n]+)/) || [])[1] || '';
    if (dtstart && dtstart.length >= 8) {
      const y = dtstart.slice(0, 4), m = dtstart.slice(4, 6), d = dtstart.slice(6, 8);
      let dateStr = y + '-' + m + '-' + d;
      let timeStr = null;
      const tMatch = dtstart.match(/T(\d{2})(\d{2})(\d{2})?(Z)?/);
      if (tMatch) {
        let hh = parseInt(tMatch[1], 10), mm = parseInt(tMatch[2], 10);
        if (tMatch[4] === 'Z') {
          const local = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), hh, mm));
          dateStr = ymd(local);
          hh = local.getHours(); mm = local.getMinutes();
        }
        timeStr = pad(hh) + ':' + pad(mm);
      }
      const opts: any = { text: summary.trim(), date: dateStr, showInCal: true };
      if (timeStr) opts.time = timeStr;
      items.push(opts);
    }
  });
  if (items.length) {
    deps.commit((s: any) => {
      items.forEach(opts => deps.addNodeTo(s, calRootId, null, opts));
    }, { snapshot: true });
  }
  deps.forceRender();
  toast('已导入 ' + items.length + ' 个事件');
}

export function openImportDialog(): void {
  const modal = document.createElement('div'); modal.className = 'modal-overlay';
  /* FIX-M-22 在 accept 中补齐桌面版 SQLite 导入所需的 .db/.sqlite/.sqlite3，使其在文件选择器中可见（拖放/所有文件本可绕过，此处补可见性）；原有扩展名保持不动 */
  /* 导入弹窗 UI 优化：标题栏去掉 ↧ 图标、拖拽区补充支持格式说明、accept 同步补齐图片扩展名（仅 UI/属性，不改导入链路） */
  modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <div class="modal-head"><span>导入内容</span><button class="modal-close">✕</button></div>
    <div class="modal-body">
      <div id="impDrop" style="border:2px dashed var(--line);border-radius:10px;padding:20px;text-align:center;cursor:pointer;margin-bottom:12px;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:160px;box-sizing:border-box;">
        <div style="font-weight:600;font-size:1.05em;color:var(--fg)">拖放文件到此处</div>
        <div style="font-size:.82em;color:var(--fg-dim);margin-top:6px">或点击选择文件（可多选）</div>
        <div style="font-size:.75em;color:var(--fg-dim);opacity:.8;margin-top:16px;line-height:1.5">
          支持 Markdown / 文本 / OPML / HTML / Word(docx) / JSON / ICS / SQLite
        </div>
        <input type="file" id="impFile" multiple accept=".md,.markdown,.txt,.opml,.html,.htm,.doc,.docx,.json,.ics,.db,.sqlite,.sqlite3,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg" style="display:none">
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  /* FIX-M-23c: 接入 _modalStack（同 openAddToCalendarDialog 模式） */
  _modalStack.push(modal);
  _syncAppInert();
  const _isTopImp = () => _modalStack[_modalStack.length - 1] === modal;
  const _popImp = () => { const i = _modalStack.indexOf(modal); if (i >= 0) _modalStack.splice(i, 1); };
  const onImpKey = (e: any) => { if (e.key === 'Escape' && _isTopImp()) close(); };
  const close = () => { document.removeEventListener('keydown', onImpKey); modal.remove(); _popImp(); };
  document.addEventListener('keydown', onImpKey);
  (modal.querySelector('.modal-close') as HTMLElement).onclick = close;
  modal.onclick = e => { if (e.target === modal && _isTopImp()) close(); };
  const drop = modal.querySelector('#impDrop') as HTMLElement;
  const fileInput = modal.querySelector('#impFile') as HTMLInputElement;
  drop.onclick = () => fileInput.click();
  fileInput.onchange = () => { if (fileInput.files && fileInput.files.length) { handleImportFiles(Array.from(fileInput.files)).then(close); } };
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; drop.style.background = 'var(--accent-soft)'; }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = 'var(--line)'; drop.style.background = ''; }));
  drop.addEventListener('drop', (e: any) => { e.preventDefault(); if (e.dataTransfer.files && e.dataTransfer.files.length) { handleImportFiles(Array.from(e.dataTransfer.files)).then(close); } });
}
