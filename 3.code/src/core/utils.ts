/**
 * M1-1 · 公共工具函数模块（自 canonical 只读提取，逻辑零改动）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html:1478-1517（script 块内「工具」区原文逐行对应）
 * 约束：函数体表达式、正则、错误消息字面量、console 前缀逐字保留；仅追加 export 与 TS 类型注解
 *       （as Record<string,string> / (o: any) / (src as any) 为纯类型层断言，运行期无任何行为差异）。
 */

/* 来源：v2.0-t3.html:1476-1477（$ / $$ 选择器工具，与 uid 同处「工具」区，逐字保留） */
const $=<T extends Element = HTMLElement>(s: string,r: ParentNode = document): T|null=>r.querySelector(s) as T|null;
const $$=<T extends Element = HTMLElement>(s: string,r: ParentNode = document): T[]=>Array.from(r.querySelectorAll(s)) as T[];
const uid=(): string=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const esc=(s: unknown): string=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c]);
const stripHtml=(s: unknown): string=>String(s||'').replace(/<[^>]*>/g,'');
const pad=(n: number): string=>n<10?'0'+n:''+n;
const ymd=(d: Date): string=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
export function parseYmd(s: unknown): Date {
  const m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s||''));
  if(!m)return new Date(NaN);
  const y=+m[1],mo=+m[2],d=+m[3];
  if(mo<1||mo>12||d<1||d>31)return new Date(NaN);
  /* FIX-TZ-1: 纯日期语义改本地时区构造（new Date(y,mo-1,d)）——所有调用方（expandRecurring 的 getDay/getDate、
     周视图 selD.setDate/getDate、calStatsScope、buildYearCounts、ICS 导出、浮窗日历）一律使用本地 getter/setter，
     与 todayStr()/ymd() 的本地日历语义一致。原 UTC 构造仅在负时区产生「UTC 日期≠本地日历日期」错位
     （如 UTC-5 时 2026-01-01 解析成本地 2025-12-31，周重复/周视图整体偏移一天）。回环校验同步改用本地 getter。 */
  const dt=new Date(y,mo-1,d);
  if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d)return new Date(NaN);
  return dt;
}
const todayStr=(): string=>ymd(new Date());
const clone: <T>(o: T) => T = (typeof structuredClone==='function')
  ? ((o: any) => structuredClone(o))
  : ((o: any) => JSON.parse(JSON.stringify(o)));
/* 【P0-4 DataCloneError 兜底】safeClone：structuredClone 失败时降级到 JSON 深拷贝，再失败则返回原引用 */
export function safeClone<T>(o: T): T {
  try{return clone(o);}
  catch(e){
    console.error('[JU] clone failed, falling back to JSON',e);
    try{return JSON.parse(JSON.stringify(o));}
    catch(e2){console.error('[JU] JSON clone also failed',e2);return o;}
  }
}
/* 【P0-L3 结构共享】CreateDataProperty 语义复制原语（模块级，供 __juProduce 与 commit 共用）：
   defineProperty 定义自有键，保留 JSON.parse 产生的自有 __proto__ 数据键
   （避免 Object.assign 的 [[Set]] 走原型 setter）。不保原型（state 约定为普通对象，见 immutable-adapter §5.2）。 */
export function copyPlain<T extends object>(src: T): T {
  const tgt: Record<PropertyKey, unknown> = {};
  for(const key of Reflect.ownKeys(src)){
    if(typeof key==='symbol')continue; /* L17-W4 · P2-3：Symbol 键仅用于内部派生计数（如 _SIDECOUNTS），复制时跳过以免带入缓存 */
    Object.defineProperty(tgt,key,{value:(src as any)[key],writable:true,enumerable:true,configurable:true});
  }
  return tgt as T;
}

/**
 * 【fix5 · P2 排序统一】侧栏「我的文档」与「标签」两组共用的中文名称比较器。
 *
 * 与 app/session.ts sortDocs 原 `_getZhCollator()` 的口径逐字一致：
 *   Intl.Collator('zh-Hans', { numeric: true, sensitivity: 'base' })
 * 提取到 utils 是为了让两个列表**引用同一个比较器实现**（而非两处各写一份），
 * 从根上保证「文档列表与标签列表排序规则完全一致」。
 */
let _zhCollator: Intl.Collator | null = null;
export function compareZh(a: unknown, b: unknown): number {
  if (!_zhCollator) _zhCollator = new Intl.Collator('zh-Hans', { numeric: true, sensitivity: 'base' });
  return _zhCollator.compare(String(a == null ? '' : a), String(b == null ? '' : b));
}

/* review22-04/7 · ISSUE-004：Tauri 双通道能力探测（v1 tauri.invoke / v2 core.invoke），layout 与 main 共用 */
export function hasTauriInvoke(): boolean {
  const t: any = (window as any).__TAURI__;
  return !!t && ((t.core && typeof t.core.invoke === 'function') || (t.tauri && typeof t.tauri.invoke === 'function'));
}

export { $, $$, uid, esc, stripHtml, pad, ymd, todayStr, clone };
