/**
 * M1-1 · 批次 V-1 · 多维表格字段解析与公式引擎
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - dbFieldName / dbFieldVisible / dbResolveField / dbPrimaryField ....... 11653-11688
 *   - dbFieldDef / dbFieldType ............................................. 11689-11709
 *   - dbRawValue / dbTextValue / dbNumValue ................................ 11712-11742
 *   - _formulaDepth / dbDateStr / dbFormulaToNum / dbFormulaToStr /
 *     dbFormulaTruthy ...................................................... 11746-11783
 *   - _dbFormulaDiff / dbFormulaAgg / dbFormulaCall / DB_AGG_FNS ........... 11784-11867
 *   - _FormulaParser ....................................................... 11868-12010
 *   - dbFormulaEval / dbFormulaDisplay ..................................... 12011-12052
 *   - formatTimeValue ...................................................... 13620-13636
 *
 * 约束：函数体表达式、正则、字面量、FIX-* 标记注释逐字保留；仅追加 export 与 TS 类型注解。
 *   未拆分业务符号统一走 deps 依赖注入容器（原直接调用改为 deps.xxx）：
 *     getState()（对应产品 state）/ ui（对应产品 ui）/ N(id) / getDbRows(docId)。
 *   已拆分模块直接 import：pad / ymd / stripHtml / todayStr（../core/utils）。
 */
import { pad, ymd, stripHtml, todayStr } from '../../core/utils';

/** 字段类型字面量（含自定义扩展类型，故允许 string 兜底）。 */
export type DbFieldType = 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'formula' | 'link' | string;

/** 解析后的字段定义（dbFieldDef 的返回形状，恒非空）。 */
export interface DbFieldDefResolved {
  name: string;
  type: DbFieldType;
  expr?: string;
  target?: string;
  options?: string[];
  dateType?: string;
  [k: string]: any;
}

/** 字段入参：字符串列名 或 字段定义对象（产品件两种形态并存）。 */
export type DbField = string | Record<string, any> | null | undefined;

/** 数据库行（即表节点；db 为列值表，字段名 → 值）。 */
export interface DbRow {
  id: string;
  parent?: string | null;
  text?: string;
  db?: Record<string, any>;
  tags?: string[];
  _manualTags?: string[];
  updatedAt?: number;
  children?: string[];
  _deleted?: boolean;
  dbRoot?: boolean;
  [k: string]: any;
}

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export interface FormulaDeps {
  /** 全局数据状态（对应产品的 `state`，取值时刻读取，保持引用活性） */
  getState: () => any;
  /** 全局 UI 状态对象（对应产品的 `ui`） */
  ui: any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** 表格行取数（对应产品的 `getDbRows(docId)`） */
  getDbRows: (docId: any) => DbRow[];
}

export const deps: FormulaDeps = {
  getState: () => null,
  ui: {},
  N: () => null,
  getDbRows: () => [],
};

export function injectFormulaDeps(patch: Partial<FormulaDeps>): void {
  Object.assign(deps, patch);
}

/* 状态取用：等价于产品件同作用域 `state`（此处经 deps 读取，保持引用活性） */
function st(): any {
  return deps.getState() || {};
}

export function dbFieldName(f: DbField): string {
  return typeof f === 'string' ? f : ((f && (f as any).name) || '');
}
/* FIX-DB-02: 显隐统一判断——所有视图（表格/看板/画廊/时间线/图表）均通过它判断字段是否显示 */
export function dbFieldVisible(name: string): boolean {
  return !(deps.ui.dbHiddenFields && deps.ui.dbHiddenFields[name]);
}
/* FIX-DB-10: 解析视图主字段——优先按名称匹配（向后兼容内置列名），失败按字段类型回退，找不到返回 null */
export function dbResolveField(name: string | null | undefined, types?: string | string[] | null): DbField | null {
  const fields: DbField[] = (st().dbFields) || [];
  if (name) {
    const hit = fields.find((f) => dbFieldName(f) === name);
    if (hit) return hit;
  }
  if (types) {
    const t = Array.isArray(types) ? types : [types];
    for (const f of fields) {
      const def = dbFieldDef(f);
      if (t.includes(def.type)) return f;
    }
  }
  return null;
}
/* FIX-DB-11: 主列（数据源判定）= 字段表首位，始终锚定 dbFields[0]，不随显隐变化。
    dbRawValue / 公式引擎 / 添加对话框 / 导出 / 各视图标题槽等读写 n.text 的路径统一用它；
    主列被隐藏时无任何列顶替其编辑语义（见 FIX-DB-12）。
    注：FIX-DB-12 已删除旧 dbTitleField()（第一可见列），避免「渲染层顶替主列、误写 n.text」的层间分叉 */
export function dbPrimaryField(): string {
  const a = st().dbFields;
  if (!a || !a.length) return '标题';
  for (const f of a) {
    const t = dbFieldType(f);
    if (t !== 'formula' && t !== 'link' && t !== 'multi_select') return dbFieldName(f);
  }
  return dbFieldName(a[0]);
}
export function dbFieldDef(f: DbField, fields?: DbField[] | null): DbFieldDefResolved {
  /* FIX-P1-2: 字符串字段名先按 state.dbFields 同名字段定义解析——否则公式列（如 SUM([总价]) 中"总价"
     为 {name:'总价',type:'formula'} 时被当文本读取，嵌套聚合恒为空；link/multi_select 同理。
     未定义时按名称约定推断（与 dbFieldType 一致），再回落 text。
     FIX-NEW-3: 增可选第二参 fields 显式注入字段表（默认回落 state.dbFields），
     保持纯函数可测性——单测/沙盒态渲染可不依赖全局 state；现有调用点行为不变。 */
  if (typeof f === 'string') {
    const arr = fields !== undefined ? fields : st().dbFields;
    const hit = Array.isArray(arr) ? arr.find((x) => x && typeof x === 'object' && (x as any).name === f) : null;
    if (hit) return hit as DbFieldDefResolved;
    return { name: f, type: dbFieldType(f) };
  }
  return (f || { name: '', type: 'text' }) as DbFieldDefResolved;
}
export function dbFieldType(f: DbField): DbFieldType {
  if (f && typeof f === 'object' && (f as any).type) return (f as any).type;
  if (f === '优先级' || f === '状态') return 'select';
  if (f === '星级') return 'number';
  if (f === '时间') return 'date';
  return 'text';
}
/* FIX-DB-11: 主列（字段表首位）数据源是 n.text——与 renderDbTable 的 fields[0] 判定一致，
   不再硬编码 '标题'，重命名/隐藏第一列后筛选/排序/汇总/公式仍读取正确数据源 */
export function dbRawValue(n: DbRow, f: DbField): any {
  const def = dbFieldDef(f);
  if (def.type === 'formula') {
    try { return dbFormulaEval(n, def); } catch (e) { return null; }
  }
  if (f === null || f === undefined) return stripHtml(n.text || '');
  if (def.name === dbPrimaryField()) return stripHtml(n.text || '');
  return n.db && n.db[def.name];
}
export function dbTextValue(n: DbRow, f: DbField): string {
  const def = dbFieldDef(f);
  const v = dbRawValue(n, f);
  if (def.type === 'link') {
    const ids = Array.isArray(v) ? v : [];
    if (!ids.length) return '';
    return ids.map((id: any) => { const m = deps.N(id); return m ? stripHtml(m.text || '') : ''; }).filter(Boolean).join('、');
  }
  if (def.type === 'multi_select') {
    const arr = Array.isArray(v) ? v : [];
    return arr.filter((x: any) => x !== '' && x != null).join('、');
  }
  if (v == null || v === '') return '';
  if (typeof v === 'object') return formatTimeValue(v);
  return String(v);
}
export function dbNumValue(n: DbRow, f: DbField): number | null {
  const v = dbRawValue(n, f);
  if (v == null || v === '') return null;
  const num = Number(v);
  return isNaN(num) ? null : num;
}
/* ============================================================
   多维表格：公式引擎（含日期函数）
   ============================================================ */
let _formulaDepth = 0;
export function dbDateStr(v: any): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    if (v > 1e12) return ymd(new Date(v));
    if (v > 1e9) return ymd(new Date(v * 1000));
    return '';
  }
  if (typeof v === 'object') {
    const s = v.start || v.end || '';
    return String(s).split(' ')[0] || '';
  }
  return String(v).split(' ')[0] || '';
}
export function dbFormulaToNum(v: any): number {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') { const ds = dbDateStr(v); return ds ? Date.parse(ds) : NaN; }
  const s = String(v).trim().replace(/,/g, '');
  if (!s) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  return NaN;
}
export function dbFormulaToStr(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') return formatTimeValue(v);
  return String(v);
}
export function dbFormulaTruthy(v: any): boolean {
  if (v == null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0 && !isNaN(v);
  const s = String(v).trim();
  if (s === '') return false;
  if (s.toLowerCase() === 'false') return false;
  return true;
}
export function _dbFormulaDiff(a: any, b: any, unit: any): number | null {
  const d1 = Date.parse(dbDateStr(a)), d2 = Date.parse(dbDateStr(b));
  if (isNaN(d1) || isNaN(d2)) return null;
  const A = new Date(d1), B = new Date(d2);
  const y1 = A.getFullYear(), m1 = A.getMonth(), dA = A.getDate();
  const y2 = B.getFullYear(), m2 = B.getMonth(), dB = B.getDate();
  const u = String(unit || 'D').toUpperCase();
  if (u === 'Y') return y2 - y1;
  if (u === 'M') return (y2 - y1) * 12 + (m2 - m1);
  if (u === 'D') return Math.round((d2 - d1) / 86400000);
  if (u === 'YM') { let r = ((y2 - y1) * 12 + (m2 - m1)) % 12; if (r < 0) r += 12; return r; }
  if (u === 'YD') { let last = new Date(y2, m2, dA); if (last > B) last = new Date(y2 - 1, m2, dA); return Math.round((B.getTime() - last.getTime()) / 86400000); }
  if (u === 'MD') { let r = dB - dA; if (r < 0) { const pm = new Date(y2, m2, 0).getDate(); r = pm - dA + dB; } return r; }
  return Math.round((d2 - d1) / 86400000);
}
export function dbFormulaAgg(arg: any, mode: string, docId?: any): any {
  if (typeof arg === 'string') {
    const rows = deps.getDbRows(docId); /* FIX-H-08 docId 由公式求值链路显式传入 */
    const vals: number[] = [];
    rows.forEach((r) => {
      const v = dbRawValue(r, arg);
      if (mode === 'count') { vals.push(dbFormulaTruthy(v) ? 1 : 0); }
      else { const n = dbFormulaToNum(v); if (!isNaN(n)) vals.push(n); }
    });
    if (mode === 'count') return vals.reduce((s, x) => s + x, 0);
    if (!vals.length) return null;
    const sum = vals.reduce((s, x) => s + x, 0);
    return mode === 'avg' ? sum / vals.length : sum;
  }
  const arr = Array.isArray(arg) ? arg : [arg];
  if (mode === 'count') return arr.filter((x: any) => dbFormulaTruthy(x)).length;
  const vals = arr.map(dbFormulaToNum).filter((n: number) => !isNaN(n));
  if (!vals.length) return null;
  const sum = vals.reduce((s: number, x: number) => s + x, 0);
  return mode === 'avg' ? sum / vals.length : sum;
}
export function dbFormulaCall(name: any, args: any[], docId?: any): any { /* FIX-H-08 透传 docId 给聚合函数 */
  name = String(name || '').toUpperCase();
  const num = (a: any) => dbFormulaToNum(a);
  const numArgs = args.map(num);
  switch (name) {
    case 'ABS': return Math.abs(num(args[0]));
    case 'ROUND': { const p = Math.max(0, Math.floor(num(args[1]) || 0)); const k = Math.pow(10, p); return Math.round(num(args[0]) * k) / k; }
    case 'ROUNDUP': { const p = Math.max(0, Math.floor(num(args[1]) || 0)); const k = Math.pow(10, p); return Math.ceil(num(args[0]) * k) / k; }
    case 'ROUNDDOWN': { const p = Math.max(0, Math.floor(num(args[1]) || 0)); const k = Math.pow(10, p); return Math.floor(num(args[0]) * k) / k; }
    case 'INT': return Math.floor(num(args[0]));
    case 'FLOOR': return Math.floor(num(args[0]));
    case 'CEIL': case 'CEILING': return Math.ceil(num(args[0]));
    case 'SQRT': return Math.sqrt(num(args[0]));
    case 'POWER': case 'POW': return Math.pow(num(args[0]), num(args[1]));
    case 'MOD': return num(args[0]) % num(args[1]);
    case 'MAX': return Math.max(...numArgs);
    case 'MIN': return Math.min(...numArgs);
    case 'LEN': return dbFormulaToStr(args[0]).length;
    case 'LEFT': return dbFormulaToStr(args[0]).slice(0, Math.max(0, num(args[1]) || 0));
    case 'RIGHT': { const s = dbFormulaToStr(args[0]); const n = Math.max(0, num(args[1]) || 0); return n === 0 ? '' : s.slice(-n); }
    case 'UPPER': return dbFormulaToStr(args[0]).toUpperCase();
    case 'LOWER': return dbFormulaToStr(args[0]).toLowerCase();
    case 'TRIM': return dbFormulaToStr(args[0]).trim();
    case 'CONCAT': return args.map((a: any) => dbFormulaToStr(a)).join('');
    case 'TEXT': return dbFormulaToStr(args[0]);
    case 'VALUE': return dbFormulaToNum(args[0]);
    case 'IF': return dbFormulaTruthy(args[0]) ? args[1] : args[2];
    case 'AND': return args.every((a: any) => dbFormulaTruthy(a));
    case 'OR': return args.some((a: any) => dbFormulaTruthy(a));
    case 'NOT': return !dbFormulaTruthy(args[0]);
    case 'ISBLANK': return args[0] == null || args[0] === '' || (Array.isArray(args[0]) && !args[0].length);
    case 'TODAY': return todayStr();
    case 'NOW': { const d = new Date(); return ymd(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
    case 'YEAR': { const ds = dbDateStr(args[0]); return ds ? new Date(ds).getFullYear() : null; }
    case 'MONTH': { const ds = dbDateStr(args[0]); const d = ds ? new Date(ds) : null; return d ? (d.getMonth() + 1) : null; }
    case 'DAY': { const ds = dbDateStr(args[0]); const d = ds ? new Date(ds) : null; return d ? d.getDate() : null; }
    case 'HOUR': { const s = dbFormulaToStr(args[0]); const m = s.match(/(\d{1,2}):/); return m ? parseInt(m[1], 10) : null; }
    case 'MINUTE': { const s = dbFormulaToStr(args[0]); const m = s.match(/:(\d{1,2})/); return m ? parseInt(m[1], 10) : null; }
    case 'WEEKDAY': { const ds = dbDateStr(args[0]); const d = ds ? new Date(ds) : null; if (!d) return null; const mode = num(args[1]); const w = d.getDay(); if (mode === 2) return w === 0 ? 7 : w; if (mode === 3) return w === 0 ? 6 : w - 1; return w + 1; }
    case 'DATE': { const y = num(args[0]), m = num(args[1]), d = num(args[2]); if (isNaN(y) || isNaN(m) || isNaN(d)) return null; return ymd(new Date(y, m - 1, d)); }
    case 'DATEDIF': return _dbFormulaDiff(args[0], args[1], args[2]);
    case 'SUM': return dbFormulaAgg(args[0], 'sum', docId); /* FIX-H-08 */
    case 'AVG': return dbFormulaAgg(args[0], 'avg', docId);
    case 'COUNT': return dbFormulaAgg(args[0], 'count', docId);
    default: return null;
  }
}
export const DB_AGG_FNS = ['SUM', 'AVG', 'COUNT'];
export class _FormulaParser {
  src: string;
  pos: number;
  fieldValue: (name: string) => any;
  docId: any;
  aggMode: boolean | undefined;
  constructor(src: string, fieldValue: (name: string) => any, docId?: any) {
    this.src = src; this.pos = 0; this.fieldValue = fieldValue; this.docId = docId; /* FIX-H-08 保存求值行所属 docId */
  }
  skipWs(): void { while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++; }
  peek(): string { return this.src[this.pos] || ''; }
  matchWord(w: string): boolean {
    this.skipWs();
    const re = new RegExp('^' + w + '(?![A-Za-z0-9_\\u4e00-\\u9fa5])');
    const m = this.src.slice(this.pos).match(re);
    if (m) { this.pos += m[0].length; return true; }
    return false;
  }
  parse(): any { this.skipWs(); const v = this.orExpr(); this.skipWs(); return v; }
  orExpr(): any {
    let v = this.andExpr();
    for (;;) {
      this.skipWs();
      if (this.matchWord('OR')) { const r = this.andExpr(); v = dbFormulaTruthy(v) || dbFormulaTruthy(r); }
      else if (this.peek() === '|' && this.src[this.pos + 1] === '|') { this.pos += 2; const r = this.andExpr(); v = dbFormulaTruthy(v) || dbFormulaTruthy(r); }
      else break;
    }
    return v;
  }
  andExpr(): any {
    let v = this.cmpExpr();
    for (;;) {
      this.skipWs();
      if (this.matchWord('AND')) { const r = this.cmpExpr(); v = dbFormulaTruthy(v) && dbFormulaTruthy(r); }
      else if (this.peek() === '&' && this.src[this.pos + 1] === '&') { this.pos += 2; const r = this.cmpExpr(); v = dbFormulaTruthy(v) && dbFormulaTruthy(r); }
      else break;
    }
    return v;
  }
  cmpExpr(): any {
    const l = this.addExpr();
    this.skipWs();
    const p = this.peek();
    let op: string | null = null;
    if (p === '=' && this.src[this.pos + 1] === '=') { op = '=='; this.pos += 2; }
    else if (p === '=') { op = '=='; this.pos += 1; }
    else if (p === '!' && this.src[this.pos + 1] === '=') { op = '!='; this.pos += 2; }
    else if (p === '<' && this.src[this.pos + 1] === '>') { op = '!='; this.pos += 2; }
    else if (p === '>' && this.src[this.pos + 1] === '=') { op = '>='; this.pos += 2; }
    else if (p === '<' && this.src[this.pos + 1] === '=') { op = '<='; this.pos += 2; }
    else if (p === '>') { op = '>'; this.pos += 1; }
    else if (p === '<') { op = '<'; this.pos += 1; }
    if (!op) return l;
    const r = this.addExpr();
    const ln = dbFormulaToNum(l), rn = dbFormulaToNum(r);
    const numeric = !isNaN(ln) && !isNaN(rn);
    switch (op) {
      case '==': return numeric ? ln === rn : dbFormulaToStr(l) === dbFormulaToStr(r);
      case '!=': return numeric ? ln !== rn : dbFormulaToStr(l) !== dbFormulaToStr(r);
      case '>': return numeric ? ln > rn : dbFormulaToStr(l) > dbFormulaToStr(r);
      case '>=': return numeric ? ln >= rn : dbFormulaToStr(l) >= dbFormulaToStr(r);
      case '<': return numeric ? ln < rn : dbFormulaToStr(l) < dbFormulaToStr(r);
      case '<=': return numeric ? ln <= rn : dbFormulaToStr(l) <= dbFormulaToStr(r);
    }
    return false;
  }
  addExpr(): any {
    let v = this.mulExpr();
    for (;;) {
      this.skipWs();
      const p = this.peek();
      if (p === '+') { this.pos++; const r = this.mulExpr(); v = dbFormulaToNum(v) + dbFormulaToNum(r); }
      else if (p === '-') { this.pos++; const r = this.mulExpr(); v = dbFormulaToNum(v) - dbFormulaToNum(r); }
      else if (p === '&' && this.src[this.pos + 1] !== '&') { this.pos++; const r = this.mulExpr(); v = dbFormulaToStr(v) + dbFormulaToStr(r); }
      else break;
    }
    return v;
  }
  mulExpr(): any {
    let v = this.unary();
    for (;;) {
      this.skipWs();
      const p = this.peek();
      if (p === '*') { this.pos++; const r = this.unary(); v = dbFormulaToNum(v) * dbFormulaToNum(r); }
      else if (p === '/') { this.pos++; const rn = dbFormulaToNum(this.unary()); v = rn === 0 ? null : dbFormulaToNum(v) / rn; }
      else if (p === '%') { this.pos++; const r = this.unary(); v = dbFormulaToNum(v) % dbFormulaToNum(r); }
      else if (p === '^') { this.pos++; const r = this.unary(); v = Math.pow(dbFormulaToNum(v), dbFormulaToNum(r)); }
      else break;
    }
    return v;
  }
  unary(): any {
    this.skipWs();
    const p = this.peek();
    if (p === '-') { this.pos++; return -dbFormulaToNum(this.unary()); }
    if (p === '+') { this.pos++; return dbFormulaToNum(this.unary()); }
    if (p === '!') { this.pos++; return !dbFormulaTruthy(this.unary()); }
    if (this.matchWord('NOT')) { return !dbFormulaTruthy(this.unary()); }
    return this.atom();
  }
  atom(): any {
    this.skipWs();
    const p = this.peek();
    if (p === '(') { this.pos++; const v = this.orExpr(); this.skipWs(); if (this.peek() === ')') this.pos++; return v; }
    if (p === '"' || p === "'") {
      const q = p; this.pos++; let s = '';
      while (this.pos < this.src.length && this.src[this.pos] !== q) { s += this.src[this.pos]; this.pos++; }
      if (this.peek() === q) this.pos++;
      return s;
    }
    if (p === '[') {
      this.pos++; let s = '';
      while (this.pos < this.src.length && this.src[this.pos] !== ']') { s += this.src[this.pos]; this.pos++; }
      if (this.peek() === ']') this.pos++;
      if (this.aggMode) return s; /* 【修复 F-17】聚合参数返回字段名（与裸标识符一致），由 dbFormulaAgg 遍历行求和，修复 SUM([金额]) 只对单值求和 */
      return this.fieldValue(s);
    }
    const nm = this.src.slice(this.pos).match(/^(\d+(?:\.\d+)?)/);
    if (nm) { this.pos += nm[0].length; return parseFloat(nm[0]); }
    const id = this.src.slice(this.pos).match(/^[A-Za-z_\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5]*/);
    if (id) {
      this.pos += id[0].length;
      this.skipWs();
      const name = id[0];
      if (this.peek() === '(') {
        this.pos++; const args: any[] = [];
        this.skipWs();
        const isAgg = DB_AGG_FNS.includes(name.toUpperCase());
        const prevAgg = this.aggMode;
        if (isAgg) this.aggMode = true;
        if (this.peek() !== ')') {
          for (;;) {
            args.push(this.orExpr());
            this.skipWs();
            if (this.peek() === ',') { this.pos++; continue; }
            break;
          }
        }
        if (this.peek() === ')') this.pos++;
        this.aggMode = prevAgg;
        return dbFormulaCall(name, args, this.docId); /* FIX-H-08 */
      }
      if (this.aggMode) return name; /* 聚合参数：字段名以字符串传入 */
      return this.fieldValue(name);
    }
    return '';
  }
}
export function dbFormulaEval(row: DbRow, field: DbField): any {
  const _def: any = field;
  const src = String(_def && _def.expr || '').trim();
  if (!src) return '';
  if (_formulaDepth > 8) return null;
  _formulaDepth++;
  try {
    const cache = new Map<any, any>();
    const fieldValue = (name: string): any => {
      if (cache.has(name)) return cache.get(name);
      cache.set(name, null);
      let v: any;
      try {
        const def: any = (st().dbFields || []).find((f: any) => dbFieldName(f) === name) || { name, type: 'text' };
        if (dbFieldType(def) === 'formula') {
          v = dbFormulaEval(row, def);
        } else if (name === dbPrimaryField()) { /* FIX-DB-11: 原硬编码 name==='标题'；主列判定改用 dbPrimaryField，重命名后公式引用主列仍读 n.text */
          v = stripHtml(row.text || '');
        } else {
          v = row.db && row.db[name];
        }
      } catch (e) { v = null; }
      cache.set(name, v);
      return v;
    };
    const P = new _FormulaParser(src, fieldValue, row && row.parent); /* FIX-H-08 行.parent 即所属表 docId，显式传入聚合 */
    return P.parse();
  } catch (e) {
    return null;
  } finally {
    _formulaDepth--;
  }
}
export function dbFormulaDisplay(v: any): string {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    if (!isFinite(v)) return String(v);
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 10000) / 10000);
  }
  return String(v);
}
export function formatTimeValue(v: any): string {
  if (!v && v !== 0) return '选择…';
  if (typeof v === 'number') {
    const ms = v > 1e12 ? v : (v > 1e9 ? v * 1000 : 0);
    if (ms) {
      const d = new Date(ms);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    return String(v);
  }
  if (typeof v === 'string') return v;
  if (v.type === 'date') return v.start || '选择…';
  if (v.type === 'datetime') return (v.start || '选择…').trim();
  if (v.type === 'range') return (v.start || '') + ' - ' + (v.end || '');
  if (v.type === 'datetimerange') return (v.start || '') + ' - ' + (v.end || '');
  return String(v);
}
