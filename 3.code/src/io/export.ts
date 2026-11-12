/**
 * M1-1 · 批次 AF · 导入导出（Export）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - download ................................................ 18973-18982
 *   - walkTree（自建，源同段）.................................. 19021-19024
 *   - toMarkdown .............................................. 19025-19036
 *   - toOpml .................................................. 19037-19058
 *   - toHtml .................................................. 19059-19077
 *   - docToXls ................................................ 19078-19093
 *   - docToExcel .............................................. 19094-19122
 *   - foldIcs（outlineToIcs 私有折叠器）....................... 19123-19142
 *   - outlineToIcs ............................................ 19143-19214
 *   - downloadMindmapSvg ...................................... 19215-19261
 *   - doDownload .............................................. 19262-19318
 *   - exportICS ............................................... 19418-19424
 *
 * 约束：文件名 sanitize 正则、MIME、30s revoke 兜底、Markdown / OPML / HTML / SpreadsheetML /
 *       ICS（VTIMEZONE + RRULE + 75 字节折叠）输出格式与文案逐字保留。
 *   纯结构调整（运行期零行为差异）：
 *     1) 未拆分业务符号统一走 `deps` 注入：state / ui / N / getCurrentDoc / actions /
 *        mmLayoutConsts / layoutMindmap / currentBaseFontPx / themeColor / sanitizeHtml /
 *        getCalendarRootId。
 *     2) `walkTree` 由本模块自建（仅依赖 deps.N），与产品件同段实现逐字一致。
 *   已拆分模块直接 import：APP_LOCALE（core/constants）；stripHtml / esc / clone / todayStr /
 *     parseYmd / pad / ymd（core/utils）；toast（ui/common）；dbPrimaryField / formatTimeValue
 *     （views/database/formula）；mmLayoutConsts / layoutMindmap 及类型（views/mindmap，作为 deps 默认值）。
 *   注：`downloadMindmapSvg` 的屏幕挂载仍沿用批次 Z 的 views/mindmap 实现（main.ts 既有行），
 *       本模块内为 doDownload 的 PNG 分支提供同源端口（布局函数经 deps 注入自 views/mindmap，
 *       故两处输出必然一致）。
 */
import { APP_LOCALE } from '../core/constants';
import { stripHtml, esc, clone, todayStr, parseYmd, pad, ymd } from '../core/utils';
import { toast, appConfirm } from '../ui/common';
import { dbPrimaryField, formatTimeValue } from '../views/database/formula';
import {
  mmLayoutConsts,
  layoutMindmap,
  type MindmapConsts,
  type MindmapLayout,
  type MindmapLayoutNode,
} from '../views/mindmap';

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export interface ExportDeps {
  /** 全局数据状态（对应产品的 `state`，docToExcel 读取 dbFields） */
  state: any;
  /** 全局 UI 状态对象（对应产品的 `ui`，端口对齐，供后续主题 / 缩放取用） */
  ui: any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** 当前文档（对应产品的 `getCurrentDoc()`） */
  getCurrentDoc: () => any;
  /** 业务动作集合（对应产品的 `actions`，模板保存走 addTemplate） */
  actions: any;
  /** 导图布局常量（对应产品的 `mmLayoutConsts()`，随字号缩放，与屏幕渲染同源） */
  mmLayoutConsts: () => MindmapConsts;
  /** 导图布局（对应产品的 `layoutMindmap(docId)`，含动态节点高度） */
  layoutMindmap: (docId: any) => MindmapLayout;
  /** 当前基准字号（对应产品的 `currentBaseFontPx()`，SVG 行高换算） */
  currentBaseFontPx: () => number;
  /** 主题令牌取色（对应产品的 `_themeColor(name,fallback)`） */
  themeColor: (name: string, fallback: string) => string;
  /** HTML 净化（对应产品的 `sanitizeHtml(html)`，toHtml 节点正文输出） */
  sanitizeHtml: (html: string) => string;
  /** 日历根 id（对应产品的 `getCalendarRootId()`，exportICS 取日历根文档） */
  getCalendarRootId: () => any;

  /* ── 批次 CX · 全量备份端口（可选；缺省以 localStorage / 空数组回落） ── */
  /** 活状态读取（对应产品 `state`；未注入时回落到 `deps.state`） */
  getState?: () => any;
  /** 图谱位置读取（对应产品 `_graphPositions`；缺省读 localStorage `juju.graphpos`） */
  getGraphPositions?: () => any;
  /** 版本快照读取（对应产品 `VDB.snapshots` 全量；缺省返回空数组） */
  getVersions?: () => Promise<any[]> | any[];
}

/** 依赖注入容器（模块内安全占位：加载即不抛 ReferenceError）。 */
export const deps: ExportDeps = {
  state: { nodes: {}, rootId: null },
  ui: {},
  N: () => null,
  getCurrentDoc: () => null,
  actions: {},
  mmLayoutConsts,
  layoutMindmap,
  currentBaseFontPx: () => 14,
  themeColor: (_name: string, fallback: string) => fallback || '',
  sanitizeHtml: (html: string) => html,
  getCalendarRootId: () => null,
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function injectExportDeps(next: Partial<ExportDeps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   下载与格式转换
   ============================================================ */
export function download(filename: string, content: any, mime?: string): void {
  const blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  /* FIX-L-38 延迟由 100ms 延长到 3000ms，避免大 Blob 在浏览器尚未完成抓取时即 revoke 导致 0 字节下载。
     FIX-DL-1（P2-3）：3s 对慢磁盘/超大 Blob（如几百 MB 完整备份 JSON）仍可能不够——放宽到 30s
     （a.click() 后无可靠 onload 信号，30s 兜底覆盖绝大多数场景且迟 revoke 无副作用）。 */
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 30000);
}

export function walkTree(doc: any, visit: (n: any, id: any, depth: number) => void): void {
  function step(id: any, depth: number): void { const n = deps.N(id); if (!n) return; visit(n, id, depth); (n.children || []).forEach((c: any) => step(c, depth + 1)); }
  step(doc.id, -1);
}

export function toMarkdown(doc: any): string {
  let out = '# ' + (stripHtml(doc.text) || '未命名') + '\n\n';
  out += '> 导出时间：' + new Date().toLocaleString(APP_LOCALE) + '\n\n';
  walkTree(doc, (n, id, depth) => {
    if (id === doc.id) return;
    const indent = '  '.repeat(depth);
    let line = indent + '- ' + (n.done ? '[x] ' : '[ ] ') + stripHtml(n.text).replace(/[\r\n]+/g, ' ');
    if (n.date) line += ` \`📅 ${n.date}\``;
    out += line + '\n';
  });
  return out;
}

export function toOpml(doc: any): string {
  const escAttr = (s: any) => String(s || '')
    .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"')
    .replace(/[\r\n]+/g, ' ').replace(/\t/g, ' ');
  const INDENT = '    ';
  let body = '';
  function walk(id: any, depth: number): void {
    const n = deps.N(id);
    if (n.id === doc.id) { n.children.forEach((c: any) => walk(c, depth)); return; }
    const padStr = INDENT.repeat(depth);
    const attrs = [`text="${escAttr(stripHtml(n.text) || '(空)')}"`, `_complete="${n.done ? 'true' : 'false'}"`];
    if (n.date) attrs.push(`_note="${escAttr(n.date)}"`);
    body += padStr + `<outline ${attrs.join(' ')}`;
    if (n.children.length) {
      body += '>\n';
      n.children.forEach((c: any) => walk(c, depth + 1));
      body += padStr + '</outline>\n';
    } else body += '/>\n';
  }
  walk(doc.id, 1);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0"><head><title>${escAttr(stripHtml(doc.text) || 'JU')}</title>\n<dateCreated>${new Date().toUTCString()}</dateCreated></head>\n<body>\n${body}  </body></opml>`;
}

export function toHtml(doc: any): string {
  function renderChildren(id: any): string {
    const n = deps.N(id);
    const kids = n.children.map((cid: any) => deps.N(cid)).filter(Boolean);
    if (!kids.length) return '';
    let html = '<ul>';
    kids.forEach((c: any) => {
      const cls = c.done ? ' class="done"' : '';
      html += `<li${cls}>${deps.sanitizeHtml(c.text || '')}`;
      if (c.date) html += ` <span class="meta">📅 ${c.date}</span>`;
      html += renderChildren(c.id);
      html += '</li>';
    });
    html += '</ul>';
    return html;
  }
  let body = renderChildren(doc.id);
  return `<!DOCTYPE html>\n<html lang="${esc(APP_LOCALE)}"><head><meta charset="utf-8"><title>${esc(stripHtml(doc.text) || 'JU')}</title>\n<style>body{font-family:"Noto Sans SC","PingFang SC",sans-serif;font-size:15px;line-height:1.75;color:${deps.themeColor('--fg', '')};background:${deps.themeColor('--bg', '')};max-width:820px;margin:40px auto;padding:0 24px}ul{list-style:disc}li.done{text-decoration:line-through;opacity:.6}.meta{color:${deps.themeColor('--title', '')};font-size:.8em}</style></head>\n<body><h1>${esc(stripHtml(doc.text) || '')}</h1>${body}</body></html>`;
}

/**
 * 解析导出目标文档：显式入参 → `deps.getCurrentDoc()` → `ui.currentDocId`
 * → 根节点下第一篇顶层文档。占位装配下 `getCurrentDoc` 恒为 null，
 * 后两级保证「设置面板点导出」在真实页面里仍能命中用户当前正在看的文档。
 */
export function resolveExportDoc(explicit?: any): any {
  if (explicit && explicit.id != null) return explicit;
  try {
    if (typeof deps.getCurrentDoc === 'function') {
      const cur = deps.getCurrentDoc();
      if (cur && cur.id != null) return cur;
    }
  } catch (e) { console.warn('[JU] caught error', e); }
  try {
    const ui = deps.ui;
    const curId = ui && ui.currentDocId;
    if (curId) {
      const n = deps.N(curId);
      if (n) return n;
    }
  } catch (e) { console.warn('[JU] caught error', e); }
  try {
    const st = resolveState();
    const root = st && st.nodes && st.rootId ? st.nodes[st.rootId] : null;
    const kids = (root && root.children) || [];
    for (const cid of kids) {
      const n = st.nodes[cid];
      if (n && !n._deleted) return n;
    }
  } catch (e) { console.warn('[JU] caught error', e); }
  return null;
}
export function docToXls(doc: any): string {
  /* 【UI修复8】导出真正的 Excel 文件（SpreadsheetML 2003 XML，Excel/WPS 原生打开，中文不乱码） */
  const tsv = docToExcel(doc);
  const xmlEsc = function (v: any) { return String(v).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"'); };
  const rows = tsv.split('\n').filter(function (r) { return r.length > 0; });
  const body = rows.map(function (r) {
    /* L17-W4 · P2-2：数值列以 Number 类型导出（Excel/WPS 可直接参与计算），其余仍为 String。 */
    return '<Row>' + r.split('\t').map(function (c) {
      const isNum = /^-?\d+(\.\d+)?$/.test(c) && c !== '';
      return isNum ? '<Cell><Data ss:Type="Number">' + c + '</Data></Cell>' : '<Cell><Data ss:Type="String">' + xmlEsc(c) + '</Data></Cell>';
    }).join('') + '</Row>';
  }).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n'
    + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">'
    + '<Worksheet ss:Name="数据"><Table>\n' + body + '\n</Table></Worksheet></Workbook>';
}

export function docToExcel(doc: any): string {
  const rows: string[] = [];
  const isDb = doc.children.some((cid: any) => { const n = deps.N(cid); return n && n.db; });
  if (isDb) {
    const fields = deps.state.dbFields || ['标题'];
    rows.push(fields.map((f: any) => (typeof f === 'string') ? f : f.name).join('\t'));
    doc.children.forEach((cid: any) => {
      const n = deps.N(cid); if (!n) return;
      const row = fields.map((f: any) => {
        const fn = (typeof f === 'string') ? f : f.name;
        if (fn === dbPrimaryField()) return stripHtml(n.text).replace(/[\t\r\n]+/g, ' '); /* FIX-DB-11: 主列判定改用 dbPrimaryField，重命名后导出仍输出节点文本 */
        if (n.db && n.db[fn] !== undefined) {
          const v = n.db[fn];
          if (typeof v === 'object') return formatTimeValue(v).replace(/[\t\r\n]+/g, ' ');
          return String(v).replace(/[\t\r\n]+/g, ' ');
        }
        return '';
      });
      rows.push(row.join('\t'));
    });
  } else {
    rows.push('层级\t内容\t完成\t日期');
    walkTree(doc, (n, id, depth) => {
      if (n.id === doc.id) return;
      rows.push([depth, stripHtml(n.text), n.done ? '✓' : '', n.date || ''].map(x => String(x).replace(/[\t\r\n]+/g, ' ')).join('\t'));
    });
  }
  return '\ufeff' + rows.join('\n');
}

/* ICS 行折叠（75 字节上限，UTF-8 字节口径；源 19123-19142） */
function foldIcs(line: string): string {
  const out: string[] = [];
  let buf = '';
  let bufBytes = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const c = line.charCodeAt(i);
    const bytes = c < 128 ? 1 : (c < 2048 ? 2 : 3);
    if (bufBytes + bytes > 75) {
      out.push(buf);
      buf = ' ' + ch;
      bufBytes = 1 + bytes;
    } else {
      buf += ch;
      bufBytes += bytes;
    }
  }
  out.push(buf);
  return out.join('\r\n');
}

/** ICS 文件头（逐字对齐产品件 19143-19152：VCALENDAR + Asia/Shanghai VTIMEZONE） */
function icsHeaderLines(): string[] {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JuJu//CN', 'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Shanghai', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800', 'END:STANDARD', 'END:VTIMEZONE',
  ];
}

/**
 * 单节点 → VEVENT 行（产品件同段 `walkTree` 回调体，逐字等价）。
 * 返回空数组的两种情形：`id` 即文档根自身 / 节点无 `date` / 日期不可解析。
 * 抽为纯函数后，同步（`outlineToIcs`）与分片（`outlineToIcsAsync`）两条路径共用同一生成口径，
 * 保证大库导出的 ICS 与小库逐字节一致。
 */
function icsEventLines(n: any, id: any, docId: any, stamp: string): string[] {
  const escIcs = (s: any) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
  if (id === docId || !n.date) return [];
  const out: string[] = [];
  const day = n.date.replace(/-/g, '');
  let dtstart: any, dtend: any, dateOnly = false;
  if (n.time) {
    const [h, mi] = n.time.split(':').map(Number);
    dtstart = day + 'T' + pad(h) + pad(mi) + '00';
    if (h >= 23) {
      const nextDay = new Date(parseYmd(n.date));
      nextDay.setDate(nextDay.getDate() + 1);
      dtend = ymd(nextDay).replace(/-/g, '') + 'T000000';
    } else {
      dtend = day + 'T' + pad(h + 1) + pad(mi) + '00';
    }
  } else {
    dateOnly = true;
    const dt = parseYmd(n.date);
    if (isNaN(dt.getTime())) return [];
    dt.setDate(dt.getDate() + 1);
    dtstart = day;
    dtend = ymd(dt).replace(/-/g, '');
  }
  out.push('BEGIN:VEVENT');
  out.push('UID:' + id + '@juju');
  out.push('DTSTAMP:' + stamp);
  if (dateOnly) {
    out.push('DTSTART;VALUE=DATE:' + dtstart);
    out.push('DTEND;VALUE=DATE:' + dtend);
  } else {
    out.push('DTSTART;TZID=Asia/Shanghai:' + dtstart);
    out.push('DTEND;TZID=Asia/Shanghai:' + dtend);
  }
  if (n.recur) {
    const map: any = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };
    const freq = map[n.recur.freq];
    if (freq) {
      let rrule = 'RRULE:FREQ=' + freq;
      const interval = n.recur.interval || 1;
      if (interval > 1) rrule += ';INTERVAL=' + interval;
      if (n.recur.freq === 'weekly') {
        if (n.recur.weekday != null) {
          const wd = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][n.recur.weekday];
          if (wd) rrule += ';BYDAY=' + wd;
        }
        rrule += ';WKST=MO';
      }
      if (n.recurEnd) {
        rrule += ';UNTIL=' + String(n.recurEnd).replace(/-/g, '') + 'T235959Z';
      } else {
        rrule += ';COUNT=100';
      }
      out.push(rrule);
    }
  }
  out.push('SUMMARY:' + escIcs(stripHtml(n.text) || 'untitled'));
  out.push('END:VEVENT');
  return out;
}

export function outlineToIcs(doc: any): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = icsHeaderLines();
  walkTree(doc, (n, id) => {
    const ev = icsEventLines(n, id, doc.id, stamp);
    for (let i = 0; i < ev.length; i++) lines.push(ev[i]);
  });
  lines.push('END:VCALENDAR');
  return lines.map(foldIcs).join('\r\n');
}

/**
 * 批次 CX · 分片 ICS（输出与 `outlineToIcs` 逐字节一致）。
 * 遍历改走 `walkTreeAsync`：每 NODE_CHUNK 个节点 `await l7Yield()` 让出主线程，
 * 使日历体量大时导出不再长时间冻结界面。
 */
export async function outlineToIcsAsync(doc: any): Promise<string> {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = icsHeaderLines();
  await walkTreeAsync(doc, (n, id) => {
    const ev = icsEventLines(n, id, doc.id, stamp);
    for (let i = 0; i < ev.length; i++) lines.push(ev[i]);
  });
  lines.push('END:VCALENDAR');
  return lines.map(foldIcs).join('\r\n');
}

export function downloadMindmapSvg(doc: any): string {
  const { NW, NH } = deps.mmLayoutConsts(); /* FIX-R9-3: 导出与屏幕布局同源（随字号缩放），导出与所见一致 */
  const layout = deps.layoutMindmap(doc.id); /* FIX-DB-07: 与屏幕渲染共用同源布局（含动态节点高度） */
  const all = layout.nodes;
  if (!all.length) return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"></svg>';
  const rootNode = layout.rootNode as MindmapLayoutNode;
  const W = all.reduce((a, n) => Math.max(a, n.x), 0) + NW + 80;
  const H = all.reduce((a, n) => Math.max(a, n.y + n.h / 2), 0) + 80;
  const isNight = document.documentElement.dataset.theme === 'night';
  const bg = deps.themeColor('--mm-bg', '');
  const fg = deps.themeColor('--mm-fg', '');
  const nodeBg = deps.themeColor('--mm-node-bg', '');
  const nodeStroke = deps.themeColor('--mm-node-stroke', '');
  const rootBg = deps.themeColor('--mm-root-bg', '');
  const lineColor = deps.themeColor('--mm-line', '');
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="${bg}"/><style>text{font-family:"Noto Sans SC",sans-serif;font-size:12px;fill:${fg}}</style>`;
  (function edges(nd: MindmapLayoutNode) {
    nd.kids.forEach(k => {
      const p1x = nd.x + NW, p1y = nd.y, p2x = k.x, p2y = k.y, mx = (p1x + p2x) / 2;
      svg += `<path d="M${p1x},${p1y} C${mx},${p1y} ${mx},${p2y} ${p2x},${p2y}" fill="none" stroke="${lineColor}" stroke-width="1.5"/>`;
      edges(k);
    });
  })(rootNode);
  all.forEach(nd => {
    const n = deps.N(nd.id);
    const isRoot = nd.id === doc.id;
    const fill = isRoot ? rootBg : nodeBg;
    const stroke = isRoot ? rootBg : nodeStroke;
    const txt = String((isRoot ? stripHtml(doc.text) : (n ? stripHtml(n.text) : '')) || '');
    const h = nd.h || NH;
    /* FIX-DB-07: 导出同样不截断文本——按 16 字/行拆成多行，节点矩形高度随行数自适应 */
    const charsPerLine = 16;
    const lines: string[] = [];
    let cur = '';
    for (const ch of txt) { cur += ch; if (cur.length >= charsPerLine) { lines.push(cur); cur = ''; } }
    if (cur) lines.push(cur);
    if (!lines.length) lines.push('');
    svg += `<rect x="${nd.x}" y="${nd.y - h / 2}" width="${NW}" height="${h}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    const lineH = Math.round(18 * Math.max(0.8, deps.currentBaseFontPx() / 14));
    const startY = nd.y - (lines.length - 1) * lineH / 2 + 4;
    lines.forEach((ln, i) => {
      svg += `<text x="${nd.x + 11}" y="${startY + i * lineH}" fill="${isRoot ? '#fff' : fg}">${esc(ln)}</text>`;
    });
  });
  svg += '</svg>';
  return svg;
}

export function doDownload(type: string): void {
  /* 导出目标统一走 `resolveExportDoc`（getCurrentDoc → ui.currentDocId → 首篇顶层文档），
     使既有下载项都能命中当前文档。 */
  const doc = resolveExportDoc(); if (!doc) { toast('请先选择文档'); return; }
  const name = (stripHtml(doc.text) || '未命名').replace(/[\\/:*?"<>|]/g, '_');
  switch (type) {
    case 'template': {
      const tree: any[] = [];
      function toTree(id: any): any {
        const n = deps.N(id);
        return {
          text: n.text, done: n.done, date: n.date,
          time: n.time || null, tags: (n.tags || []).slice(),
          note: n.note || null, recur: n.recur || null,
          priority: n.priority || 0, starred: n.starred || 0,
          color: n.color || null, showInCal: n.showInCal !== false,
          db: n.db ? clone(n.db) : null,
          children: n.children.map(toTree)
        };
      }
      doc.children.forEach((cid: any) => tree.push(toTree(cid)));
      deps.actions.addTemplate(name, tree);
      toast('已保存为模板');
      break;
    }
    case 'md': {
      /* 批次 CX · 大库保护：节点数超过阈值时改走分片遍历（`toMarkdownAsync`），
         每 NODE_CHUNK 个节点让出主线程；小库仍走原同步路径，输出与旧实现逐字节一致。 */
      const mdName = `${name}-${todayStr()}.md`;
      if (isLargeLibrary()) {
        void exportMarkdown(doc)
          .then((text) => download(mdName, text, 'text/markdown'))
          .catch((e) => toast('导出失败：' + (String((e && (e as any).message) || e || '') || '未知错误')));
        break;
      }
      download(mdName, toMarkdown(doc), 'text/markdown');
      break;
    }
    case 'opml': download(`${name}-${todayStr()}.opml`, toOpml(doc), 'text/xml'); break;
    case 'html': case 'word': download(`${name}-${todayStr()}.html`, toHtml(doc), 'text/html'); break;
    case 'excel': download(`${name}-${todayStr()}.xls`, docToXls(doc), 'application/vnd.ms-excel'); break;
    case 'png': {
      const svgStr = downloadMindmapSvg(doc);
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const w = Math.max(img.width || 800, 800), h = Math.max(img.height || 600, 600);
        canvas.width = w * 2; canvas.height = h * 2;
        const ctx = canvas.getContext('2d')!;
        const isNight = document.documentElement.dataset.theme === 'night';
        ctx.fillStyle = deps.themeColor('--mm-bg', '');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob((pngBlob: any) => {
          if (!pngBlob) { download(`${name}-${todayStr()}.svg`, svgStr, 'image/svg+xml'); return; }
          const url = URL.createObjectURL(pngBlob);
          const a = document.createElement('a'); a.href = url; a.download = `${name}-${todayStr()}.png`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 500);
          toast('已下载 PNG');
        }, 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(svgUrl); download(`${name}-${todayStr()}.svg`, svgStr, 'image/svg+xml'); };
      img.src = svgUrl;
      break;
    }
  }
}

export async function exportICS(): Promise<void> {
  const calRootId = deps.getCalendarRootId();
  const calDoc = deps.N(calRootId);
  if (!calDoc) { toast('未找到日历容器'); return; }
  /* 批次 CX · 大库保护：节点数超过阈值时改走分片遍历（每 NODE_CHUNK 节点让出主线程），
     小库仍走原同步路径，ICS 文本逐字节一致。 */
  const ics = isLargeLibrary() ? await outlineToIcsAsync(calDoc) : outlineToIcs(calDoc);
  /* FIX-M-24 复用 doDownload 的文件名字符 sanitize，避免日历根名含 /\:*?"<>| 生成非法文件名 */
  download((stripHtml(calDoc.text) || 'calendar').replace(/[\\/:*?"<>|]/g, '_') + '.ics', ics, 'text/calendar');
  toast('已下载 ICS');
}

/* ============================================================
   批次 CX · 大库保护（分片异步导出 / 全量备份）
   ------------------------------------------------------------
   契约：
     1) 阈值 `BIG_LIB_NODE_THRESHOLD = 5000`：节点数 ≤ 阈值时导出与旧实现逐字节一致
        （同步 `JSON.stringify` / 递归遍历，无任何行为差异）；
     2) 节点数 > 阈值时改走分片路径：每片 `NODE_CHUNK` 个节点后 `await l7Yield()`
        让出主线程（`setTimeout(0)` 宏任务），渲染 / 输入事件可插队，
        避免大库导出期间的整页冻结（长任务）；
     3) 分片序列化不改 JSON 结构：顶层键顺序与原对象一致，`nodes` 逐条拼接，
        产出仍是单条合法 JSON 文本（import 侧可直接 `JSON.parse`）；
     4) `exportFullBackup` 保留产品件瘦身口径（activity 30 天 / 每文档 1 条版本 /
        版本总量 60 / 回收站 50 条 + 孤儿软删清理 + 悬空图谱坐标剔除）。
   ============================================================ */
export const BIG_LIB_NODE_THRESHOLD = 5000;
/** 分片粒度（每片节点数；500 条 ≈ 4–8ms，远低于 50ms 长任务阈值） */
export const NODE_CHUNK = 500;

/** 主线程让出（等价产品件 `_l7Yield`：宏任务让出，允许渲染与输入处理插队） */
export function l7Yield(): Promise<void> {
  return new Promise<void>((resolve) => { setTimeout(resolve, 0); });
}

/** 活状态读取：`deps.getState()` 优先，未注入时回落 `deps.state`。 */
function resolveState(): any {
  try {
    if (typeof deps.getState === 'function') {
      const s = deps.getState();
      if (s && s.nodes) return s;
    }
  } catch (e) { console.warn('[JU] caught error', e); }
  const s = deps.state;
  return s && s.nodes ? s : { nodes: {}, rootId: null };
}

/** 当前节点总数（大库判定的唯一口径）。 */
export function nodeCount(): number {
  try { return Object.keys(resolveState().nodes || {}).length; } catch (e) { return 0; }
}

/** 是否大库（超过 `BIG_LIB_NODE_THRESHOLD`）。 */
export function isLargeLibrary(): boolean {
  return nodeCount() > BIG_LIB_NODE_THRESHOLD;
}

/**
 * 异步树遍历（DFS 前序，顺序与 `walkTree` 完全一致）。
 * 每 `NODE_CHUNK` 个节点 `await l7Yield()`；父链缺失时跳过该节点及其子树（同 `walkTree`）。
 */
async function walkTreeAsync(doc: any, visit: (n: any, id: any, depth: number) => void): Promise<void> {
  if (!doc) return;
  const stack: Array<{ id: any; depth: number }> = [{ id: doc.id, depth: -1 }];
  let count = 0;
  while (stack.length) {
    const cur = stack.pop() as { id: any; depth: number };
    const n = deps.N(cur.id);
    if (!n) continue;
    visit(n, cur.id, cur.depth);
    const kids = n.children || [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push({ id: kids[i], depth: cur.depth + 1 });
    count += 1;
    if (count % NODE_CHUNK === 0) await l7Yield();
  }
}

/** 分片版 Markdown（输出与 `toMarkdown` 逐字节一致）。 */
export async function toMarkdownAsync(doc: any): Promise<string> {
  const parts: string[] = [];
  parts.push('# ' + (stripHtml(doc.text) || '未命名') + '\n\n');
  parts.push('> 导出时间：' + new Date().toLocaleString(APP_LOCALE) + '\n\n');
  await walkTreeAsync(doc, (n, id, depth) => {
    if (id === doc.id) return;
    const indent = '  '.repeat(depth);
    let line = indent + '- ' + (n.done ? '[x] ' : '[ ] ') + stripHtml(n.text).replace(/[\r\n]+/g, ' ');
    if (n.date) line += ` \`📅 ${n.date}\``;
    parts.push(line + '\n');
  });
  return parts.join('');
}

/**
 * Markdown 导出入口（批次 CX）：
 * 小库 → 同步 `toMarkdown`（零行为差异）；大库 → `toMarkdownAsync`（分片让出主线程）。
 */
export async function exportMarkdown(doc?: any): Promise<string> {
  const d = doc || deps.getCurrentDoc();
  if (!d) return '';
  return isLargeLibrary() ? toMarkdownAsync(d) : toMarkdown(d);
}

/* ── 全量备份瘦身口径（产品件 R80 / R81 常量，逐值保留） ── */
const BACKUP_SLIM = { activityDays: 30, versionsPerDoc: 1, versionsMax: 60, trashMax: 50 };

/**
 * 回收站子树清除（产品件 `_backupPurgeTrashSubtree` 逐行等价）：
 * 从 `rootId` 起沿 children 递归收集子树 id（visited 防环），逐项从父 children 摘除、
 * 删除节点与布局 / 标记队列 / 墓碑残留。
 */
function _backupPurgeTrashSubtree(out: any, rootId: any): void {
  if (!out || !out.nodes || typeof out.nodes !== 'object') return;
  if (typeof rootId !== 'string' || !out.nodes[rootId]) return;
  const ids: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [rootId];
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    if (typeof id !== 'string' || visited.has(id)) continue;
    visited.add(id);
    const n = out.nodes[id];
    if (!n) continue;
    ids.push(id);
    const ch = n.children;
    if (Array.isArray(ch)) {
      for (let i = 0; i < ch.length; i++) {
        const c = ch[i];
        if (typeof c === 'string' && !visited.has(c)) queue.push(c);
      }
    }
  }
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const n = out.nodes[id];
    if (n && typeof n.parent === 'string' && out.nodes[n.parent] && Array.isArray(out.nodes[n.parent].children)) {
      const pc = out.nodes[n.parent].children;
      for (let j = pc.length - 1; j >= 0; j--) { if (pc[j] === id) pc.splice(j, 1); }
    }
    delete out.nodes[id];
    if (out.dbRowHeights && typeof out.dbRowHeights === 'object' && !Array.isArray(out.dbRowHeights)) delete out.dbRowHeights[id];
    if (out.dbColumnWidths && typeof out.dbColumnWidths === 'object' && !Array.isArray(out.dbColumnWidths)) {
      const prefix = id + '::';
      Object.keys(out.dbColumnWidths).forEach((k) => { if (k.indexOf(prefix) === 0) delete out.dbColumnWidths[k]; });
    }
    if (Array.isArray(out._localCreated)) out._localCreated = out._localCreated.filter((x: any) => x !== id);
    if (Array.isArray(out._remoteReceived)) out._remoteReceived = out._remoteReceived.filter((x: any) => x !== id);
    if (out._tombstones && typeof out._tombstones === 'object' && !Array.isArray(out._tombstones)) delete out._tombstones[id];
  }
}

/** 备份出口精简（产品件 `_backupSlimState` 裁剪段逐行等价；入参须为已深拷贝的副本）。 */
function trimBackupSlim(out: any): any {
  if (out && out.activity && typeof out.activity === 'object' && !Array.isArray(out.activity)) {
    const minDs = ymd(new Date(Date.now() - BACKUP_SLIM.activityDays * 86400000));
    Object.keys(out.activity).forEach((k) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) { delete out.activity[k]; return; }
      if (k < minDs) delete out.activity[k];
    });
  }
  const slimIds = (arr: any): any[] | null => {
    if (!Array.isArray(arr)) return null;
    const seen = new Set<string>();
    const keep: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      const id = arr[i];
      if (typeof id !== 'string') continue;
      if (!out.nodes || !out.nodes[id]) continue;
      if (seen.has(id)) continue;
      seen.add(id); keep.push(id);
    }
    return keep;
  };
  if (Array.isArray(out._localCreated)) out._localCreated = slimIds(out._localCreated);
  if (Array.isArray(out._remoteReceived)) out._remoteReceived = slimIds(out._remoteReceived);
  if (out._tombstones && typeof out._tombstones === 'object' && !Array.isArray(out._tombstones)) {
    const now = Date.now();
    Object.keys(out._tombstones).forEach((k) => {
      const ts = out._tombstones[k];
      if (typeof ts !== 'number' || now - ts > 30000) delete out._tombstones[k];
    });
    if (!Object.keys(out._tombstones).length) delete out._tombstones;
  }
  if (Array.isArray(out.trashed)) {
    out.trashed = out.trashed.filter((t: any) => t && t.rootId && out.nodes && out.nodes[t.rootId]);
    if (out.trashed.length > BACKUP_SLIM.trashMax) {
      out.trashed.sort((a: any, b: any) => (Number(a && a.deletedAt) || 0) - (Number(b && b.deletedAt) || 0));
      const drop = out.trashed.length - BACKUP_SLIM.trashMax;
      for (let i = 0; i < drop; i++) _backupPurgeTrashSubtree(out, out.trashed[i].rootId);
      out.trashed = out.trashed.slice(drop);
    }
  }
  const trashIds = new Set<string>();
  if (Array.isArray(out.trashed)) out.trashed.forEach((t: any) => {
    if (!t) return;
    if (t.rootId) trashIds.add(t.rootId);
    if (Array.isArray(t.ids)) t.ids.forEach((i: any) => { if (typeof i === 'string') trashIds.add(i); });
  });
  const orphanSoftIds: string[] = [];
  if (out.nodes && typeof out.nodes === 'object') {
    Object.keys(out.nodes).forEach((id) => {
      const n = out.nodes[id];
      if (n && n._deleted === true && id !== out.rootId && !trashIds.has(id)) orphanSoftIds.push(id);
    });
  }
  for (let i = 0; i < orphanSoftIds.length; i++) {
    const id = orphanSoftIds[i];
    if (out.nodes && out.nodes[id]) _backupPurgeTrashSubtree(out, id);
  }
  return out;
}

/** 版本历史精简（产品件 `_slimVersions` 逐行等价）。 */
function _slimVersions(rows: any): any[] {
  if (!Array.isArray(rows)) return [];
  const list = rows.slice().sort((a: any, b: any) => (Number(b && b.ts) || 0) - (Number(a && a.ts) || 0));
  const kept = new Map<string, number>();
  const out: any[] = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const docId = String((r && r.docId) || '');
    const n = kept.get(docId) || 0;
    if (n >= BACKUP_SLIM.versionsPerDoc) continue;
    kept.set(docId, n + 1);
    out.push(r);
    if (out.length >= BACKUP_SLIM.versionsMax) break;
  }
  return out;
}

/** 小库路径：整对象 JSON 深拷贝后裁剪（与产品件同口径；拷贝失败即抛错，绝不外泄原引用）。 */
function slimStateSync(st: any): any {
  let cloned: any;
  try { cloned = JSON.parse(JSON.stringify(st)); }
  catch (e) { throw new Error('备份精简失败'); }
  if (!cloned || typeof cloned !== 'object') throw new Error('备份精简失败');
  return trimBackupSlim(cloned);
}

/**
 * 大库路径：**分片深拷贝**后裁剪——`nodes` 逐片浅拷贝（`children` 数组单独 slice，
 * 保证树形裁剪不污染内存态），其余顶层键（activity / db* 映射等小对象）仍整体深拷贝。
 */
async function slimStateChunked(st: any): Promise<any> {
  const out: any = {};
  const keys = Object.keys(st || {});
  for (const k of keys) {
    if (k === 'nodes') {
      out.nodes = {};
      const ids = Object.keys(st.nodes || {});
      for (let i = 0; i < ids.length; i += NODE_CHUNK) {
        const end = Math.min(i + NODE_CHUNK, ids.length);
        for (let j = i; j < end; j++) {
          const id = ids[j];
          const n = st.nodes[id];
          if (n && typeof n === 'object') {
            const copy: any = Object.assign({}, n);
            if (Array.isArray(n.children)) copy.children = n.children.slice();
            out.nodes[id] = copy;
          } else out.nodes[id] = n;
        }
        if (end < ids.length) await l7Yield();
      }
      continue;
    }
    const v = st[k];
    out[k] = (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
  }
  return trimBackupSlim(out);
}

/** UI 快照（产品件 `uiSnapshot()` 字段逐项保留，`uiVersion` 固定 3）。 */
function uiSnapshot(): any {
  const u = deps.ui || {};
  return {
    theme: (typeof document !== 'undefined') ? document.documentElement.dataset.theme : undefined,
    themePreview: u.themePreview, scale: u.scale,
    mmScale: u.mmScale, view: u.view,
    sidebarLeftCollapsed: u.sidebarLeftCollapsed, sidebarRightCollapsed: u.sidebarRightCollapsed,
    sidebarLeftWidth: u.sidebarLeftWidth, sidebarRightWidth: u.sidebarRightWidth,
    collapsedDocs: u.collapsedDocs, navExpanded: u.navExpanded,
    floatCal: u.floatCal, pomoVisible: u.pomoVisible, filesSort: u.filesSort,
    collapsedPanels: u.collapsedPanels, logCollapsed: u.logCollapsed,
    dbView: u.dbView,
    dbHiddenFields: u.dbHiddenFields,
    dbSortsMap: u.dbSortsMap, dbFiltersMap: u.dbFiltersMap, dbSummary: u.dbSummary,
    maxCalNodes: u.maxCalNodes, calView: u.calView, calTagFilter: u.calTagFilter,
    tagActive: u.tagActive || null,
    reminderEnabled: u.reminderEnabled, backupDir: u.backupDir,
    dnd: u.dnd,
    modules: u.modules,
    calModules: u.calModules,
    selectedDate: u.selectedDate, currentDocId: u.currentDocId,
    uiVersion: 3,
  };
}

/** 图谱位置读取：注入端口优先，缺省与 views/graph 同源（localStorage `juju.graphpos`）。 */
function readGraphPositions(): any {
  try {
    if (typeof deps.getGraphPositions === 'function') {
      const p = deps.getGraphPositions();
      if (p && typeof p === 'object') return p;
    }
  } catch (e) { console.warn('[JU] caught error', e); }
  try { return JSON.parse(localStorage.getItem('juju.graphpos') || '{}') || {}; } catch (e) { return {}; }
}

/** 版本快照读取：注入端口优先，缺省空数组（与产品件 `VDB` 不可用时的 catch 分支同口径）。 */
async function readVersions(): Promise<any[]> {
  try {
    if (typeof deps.getVersions === 'function') {
      const v = await deps.getVersions();
      return Array.isArray(v) ? v : [];
    }
  } catch (e) { return []; }
  return [];
}

/** 节点表分片序列化：逐条 `JSON.stringify(id)` + 节点体，每 `NODE_CHUNK` 条让出主线程。 */
async function stringifyNodesChunked(nodes: any): Promise<string> {
  const ids = Object.keys(nodes || {});
  const parts: string[] = [];
  for (let i = 0; i < ids.length; i += NODE_CHUNK) {
    const end = Math.min(i + NODE_CHUNK, ids.length);
    for (let j = i; j < end; j++) {
      const id = ids[j];
      parts.push(JSON.stringify(id) + ':' + JSON.stringify(nodes[id]));
    }
    if (end < ids.length) await l7Yield();
  }
  return '{' + parts.join(',') + '}';
}

/** state 分片序列化：顶层键顺序保持原对象顺序，`nodes` 就地替换为分片拼接结果。 */
async function stringifyStateChunked(st: any): Promise<string> {
  const parts: string[] = [];
  const keys = Object.keys(st || {});
  for (const k of keys) {
    if (k === 'nodes') { parts.push(JSON.stringify(k) + ':' + (await stringifyNodesChunked(st.nodes))); continue; }
    parts.push(JSON.stringify(k) + ':' + JSON.stringify(st[k]));
  }
  return '{' + parts.join(',') + '}';
}

/** 备份外壳分片序列化：仅 `state` 走分片，其余小对象一次性序列化。 */
async function stringifyBackupChunked(backup: any): Promise<string> {
  const parts: string[] = [];
  const keys = Object.keys(backup || {});
  for (const k of keys) {
    if (k === 'state') { parts.push(JSON.stringify(k) + ':' + (await stringifyStateChunked(backup.state))); continue; }
    parts.push(JSON.stringify(k) + ':' + JSON.stringify(backup[k]));
  }
  return '{' + parts.join(',') + '}';
}

/**
 * 全量备份导出（产品件 `exportFullBackup` 的模块化承接 + 批次 CX 大库保护）。
 *
 * 契约：
 *   1) 文件名固定 `JU-备份-YYYY-MM-DD.json`，MIME `application/json`；
 *   2) 备份外壳 `{app,ver,type,exportedAt,state,ui,graphpos,versions}` 逐键对齐产品件；
 *   3) 瘦身口径：activity 保留 30 天、每文档 1 条版本、总量 60、回收站 50 条 + 孤儿软删清理；
 *      图谱坐标只保留仍存在于备份 nodes 的 id（悬空坐标不写入）；
 *   4) 节点数 > `BIG_LIB_NODE_THRESHOLD` 时，**不**对整库做同步 `JSON.stringify`，
 *      改为分片克隆 + 分片序列化（每 `NODE_CHUNK` 节点让出主线程），产出仍是同结构 JSON；
 *   5) 失败只 `toast` 提示（`备份失败：…`），异常不外抛、不污染内存态。
 */
export async function exportFullBackup(): Promise<void> {
  try {
    /* review10-09：加密态导出仍是明文 JSON，先明示并二次确认；取消则不产生下载。 */
    const u = deps.ui || {};
    const plainExport = !!(u.encrypted && u.encKey);
    if (plainExport) {
      const ok = await new Promise<boolean>((res) => {
        appConfirm('当前为加密模式，导出的备份文件为明文，是否继续？', () => res(true), () => res(false));
      });
      if (!ok) return;
    }
    const st = resolveState();
    const total = Object.keys(st.nodes || {}).length;
    const large = total > BIG_LIB_NODE_THRESHOLD;
    const slimState = large ? await slimStateChunked(st) : slimStateSync(st);
    /* 图谱位置只保留仍存在的节点（悬空 id 不再写入备份） */
    let gp: Record<string, any> = {};
    try {
      const src = readGraphPositions();
      for (const id in src) { if (slimState.nodes && slimState.nodes[id]) gp[id] = src[id]; }
    } catch (e) { gp = {}; }
    const backup: any = {
      app: 'juju', ver: 'fixed18', type: 'full-backup',
      exportedAt: new Date().toISOString(),
      state: slimState,
      ui: uiSnapshot(),
      graphpos: gp,
      versions: null,
    };
    backup.versions = _slimVersions(await readVersions());
    const body = large ? await stringifyBackupChunked(backup) : JSON.stringify(backup);
    download('JU-备份-' + todayStr() + '.json', body, 'application/json');
    toast((plainExport ? '已下载明文备份（' : '已下载备份（') + '日志保留 ' + BACKUP_SLIM.activityDays + ' 天，每文档版本保留 ' + BACKUP_SLIM.versionsPerDoc + ' 条）');
  } catch (e) {
    toast('备份失败：' + (String((e && (e as any).message) || e || '') || '未知错误'));
  }
}
