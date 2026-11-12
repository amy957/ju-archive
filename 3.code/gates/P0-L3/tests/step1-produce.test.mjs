/* P0-L3 Step1 验证脚本：从 v2.0-l3.html.html 实际内容提取并校验
   1) 全部内联 <script> 语法检查
   2) 提取 clone/safeClone/__juProduce/__juProduceSafe 定义并跑单元用例（对照 immutable-adapter.md 7.1） */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/* 路径解析：JU_APP_URL 同款约定；默认取 step9 根的 v2.0-l3.html.html（接线修正：原硬编码归档外 Linux 路径） */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.JU_APP_PATH || path.resolve(HERE, '..', '..', 'v2.0-l3.html.html');
const html = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name}`); } };

/* ---- 1) 语法检查 ---- */
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log(`内联 <script> 块数量: ${scripts.length}`);
scripts.forEach((s, i) => {
  try { new Function(s); console.log(`  script#${i}: 语法 OK (${s.length} chars)`); }
  catch (e) { fail++; console.log(`  script#${i}: 语法错误 -> ${e.message}`); }
});

/* ---- 2) 提取并执行定义 ---- */
const all = scripts.join('\n');
const start = all.indexOf('const clone=');
const end = all.indexOf('function isBlankNode(n){');
if (start < 0 || end < 0) { console.log('锚点未找到，无法提取定义'); process.exit(1); }
const block = all.slice(start, end);
const ctx = vm.createContext({ console, structuredClone: globalThis.structuredClone, Error, TypeError, Date, Map, Set, JSON, RegExp, ArrayBuffer, BigInt, Symbol, Math });
vm.runInContext(block, ctx);
const run = code => vm.runInContext(code, ctx);
const runHas = code => { try { return { threw: false, val: run(code) }; } catch (e) { return { threw: true, val: e }; } };

console.log('--- 单元用例（immutable-adapter.md 7.1） ---');

// 1. 基础修改
{
  const r = runHas(`(()=>{const b={a:1};const r=__juProduce(b,d=>{d.a=2});return {r, b};})()`);
  ok('__juProduce({a:1}, d=>{d.a=2}) -> {a:2} 且 base 仍 {a:1}',
    !r.threw && r.val.r.a === 2 && r.val.b.a === 1 && r.val.r !== r.val.b);
}
// 2. 空 recipe：返回原引用（【P0-L3 结构共享】Immer 式未修改不复制，见 commit L2117 注释）
{
  const r = runHas(`(()=>{const b={a:1};const r=__juProduce(b,d=>{});return {r, same:r===b};})()`);
  ok('__juProduce({a:1}, d=>{}) -> {a:1} 原引用（未修改不复制）', !r.threw && r.val.r.a === 1 && r.val.same);
}
// 3. recipe 返回 null
ok('__juProduce({a:1}, ()=>null) -> null', (r => !r.threw && r.val === null)(runHas(`__juProduce({a:1},()=>null)`)));
// 4. base null + recipe 返回 1
ok('__juProduce(null, ()=>1) -> 1', (r => !r.threw && r.val === 1)(runHas(`__juProduce(null,()=>1)`)));
// 5. base null + recipe 返回 undefined
ok('__juProduce(null, ()=>{}) -> null', (r => !r.threw && r.val === null)(runHas(`__juProduce(null,()=>{})`)));
// 6. 原始值
ok('__juProduce(5, d=>d+1) -> 6', (r => !r.threw && r.val === 6)(runHas(`__juProduce(5,d=>d+1)`)));
// 7. recipe 抛错：base 未污染
{
  const r = runHas(`(()=>{const b={a:1};try{__juProduce(b,()=>{throw new Error('x')});return {threw:false,b};}catch(e){return {threw:true,msg:e.message,b};}})()`);
  ok('recipe 抛错 -> 原样抛出，base 未污染', !r.threw && r.val.threw && r.val.msg === 'x' && r.val.b.a === 1);
}
// 8. __juProduceSafe 抛错
{
  const r = runHas(`(()=>{const b={a:1};const res=__juProduceSafe(b,()=>{throw new Error('x')});return {res,b};})()`);
  ok('__juProduceSafe 抛错 -> {ok:false, base, error}', !r.threw && r.val.res.ok === false && r.val.res.base === r.val.b && r.val.res.error.message === 'x');
}
// 9. __juProduceSafe 成功
ok('__juProduceSafe({a:1}, d=>{d.a=2}) -> {ok:true, next:{a:2}}',
  (r => !r.threw && r.val.ok === true && r.val.next.a === 2)(runHas(`__juProduceSafe({a:1},d=>{d.a=2})`)));
// 10. 数组
ok('__juProduce([1,2], d=>{d.push(3)}) -> [1,2,3]',
  (r => !r.threw && JSON.stringify(r.val) === '[1,2,3]')(runHas(`__juProduce([1,2],d=>{d.push(3)})`)));
// 11. 深克隆
{
  const r = runHas(`(()=>{const b={a:{b:1}};const r=__juProduce(b,d=>{d.a.b=2});return {r,b};})()`);
  ok('__juProduce({a:{b:1}}, d=>{d.a.b=2}) -> {a:{b:2}} 深克隆', !r.threw && r.val.r.a.b === 2 && r.val.b.a.b === 1);
}
// 12. Date
{
  const r = runHas(`(()=>{const d0=new Date(0);const r=__juProduce(d0,d=>{d.setFullYear(2000)});return {isDate:r instanceof Date, y:r.getFullYear(), same:r===d0};})()`);
  ok('__juProduce(new Date(0), ...) -> Date 实例，年份 2000（依赖 structuredClone）',
    !r.threw && r.val.isDate && r.val.y === 2000 && !r.val.same);
}
// 13. Map
{
  const r = runHas(`(()=>{const r=__juProduce({m:new Map([[1,2]])},d=>{});return {isMap:r.m instanceof Map, v:r.m.get(1)};})()`);
  ok('__juProduce({m:Map}, d=>{}) -> Map 保留（依赖 structuredClone）', !r.threw && r.val.isMap && r.val.v === 2);
}
// 14. 字符串原始值 + undefined 返回
ok('__juProduce("abc", ()=>undefined) -> "abc"', (r => !r.threw && r.val === 'abc')(runHas(`__juProduce('abc',()=>undefined)`)));
// 15. recipe 非函数 -> TypeError
{
  const r = runHas(`(()=>{try{__juProduce({a:1},null);return {threw:false};}catch(e){return {threw:true,isType:e instanceof TypeError};}})()`);
  ok('recipe 非函数 -> TypeError', !r.threw && r.val.threw && r.val.isType);
}
// 16. 循环引用（structuredClone 应支持）
{
  const r = runHas(`(()=>{const b={a:1};b.self=b;const r=__juProduce(b,d=>{d.a=2});return {a:r.a,selfOk:r.self===r};})()`);
  ok('循环引用对象 -> structuredClone 正常克隆', !r.threw && r.val.a === 2 && r.val.selfOk);
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
