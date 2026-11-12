/* P0-T3 Step3 验证脚本：light 模式原地修改污染防护（A1/A2/B1/B2/C1）
   从 v2.0-t3.html 实际内容提取 commit + produce 原语，在带桩 sandbox 中执行，
   对照 P0-T3/light污染修复记录.md 第五节的测试覆盖。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/* 路径解析：JU_APP_URL 同款约定；默认取 step9 根的 v2.0-t3.html（接线修正：原硬编码归档外 Linux 路径） */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.JU_APP_PATH || path.resolve(HERE, '..', '..', 'v2.0-t3.html');
const html = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name}`); } };

/* ---- 1) 语法检查 ---- */
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log(`内联 <script> 块数量: ${scripts.length}`);
scripts.forEach((s, i) => {
  try { new Function(s); } catch (e) { fail++; console.log(`  script#${i}: 语法错误 -> ${e.message}`); }
});
console.log(`  语法检查: 全部通过`);

/* ---- 提取函数源码 ---- */
function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('未找到 function ' + name);
  let i = start + ('function ' + name).length;
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) { i++; break; } }
  }
  while (src[i] !== '{') i++;
  depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error('函数体括号不闭合: ' + name);
}

const all = scripts.join('\n');
const pStart = all.indexOf('const clone=');
const pEnd = all.indexOf('function isBlankNode(n){');
const produceBlock = all.slice(pStart, pEnd);

/* ---- sandbox：quiet console，reportError 记录 kind ---- */
const PRELUDE = `
var _notifyCount=0;
var __juLog=[];
function scheduleNotify(){_notifyCount++;}
function schedulePersist(){}
function renderIntro(){}
function scheduleEncFallback(){}
function findTouchedNodeId(){return null;}
function findOwningTopDocId(){return null;}
function _pendingPlainState(o){return o;}
function withSuppressedBlur(fn){return fn();}
function invalidateCalIndex(){}
function getCurrentDoc(){return null;}
function reportError(kind,payload){__juLog.push({kind,payload:payload||{}});}
/* L4 阶段 1.6 桩：commit/undo/redo 内部调用 resolveHistoryMode / buildPatch / tryMergeWithLast / collectModifiedPaths / extractAtPaths / setByPath / inferOp / inferGroupKey / reportPatchFailure / invertPatch / applyPatch；本测试仅验证 light 模式不污染 / 不入栈。
   桩实现需保证：snapshot 模式时返回非空 paths 以触发 historyPast 增长；undo/redo 走 invertPatch + applyPatch 路径。 */
var _MERGE_WINDOW_MS=500,_MAX_PATH_DEPTH=8,_PATCH_FAIL_CAP=50;
var __juPatchFailures=[];
function resolveHistoryMode(opts){if(opts&&opts.snapshot)return 'snapshot';return 'never';}
function collectModifiedPaths(){return ['_changed'];}  /* 桩：返回假路径以触发 buildPatch */
function extractAtPaths(){return {};}
function setByPath(s){return s;}
function buildPatch(opts){return {v:1,t:opts.t,op:opts.op,mode:opts.mode,paths:opts.paths,pre:{},post:{},meta:{},groupKey:undefined};}
function tryMergeWithLast(stack,patch){stack.push(patch);if(stack.length>30)stack.shift();}
function inferOp(){return 'unknown';}
function inferGroupKey(){return undefined;}
function reportPatchFailure(){}
function invertPatch(p){return {v:1,t:p.t,op:(p.op||'unknown')+':undo',mode:p.mode,paths:p.paths.slice(),pre:p.post,post:p.pre,meta:p.meta||{},groupKey:p.groupKey,mergedCount:p.mergedCount};}
function applyPatch(s,patch,direction){return s;}  /* 桩：直接返回 s，state 不变 */
/* L6 阶段 2 桩：M1/M2/M3 注入点 no-op 桩（与 step2-commit.test.mjs 一致）*/
function extractChangedIds(){return new Set();}
function updateIncrementalIndexes(){return{ok:true,errors:[],added:0,removed:0};}
function collectSubtreeIds(){return new Set();}
function calIndexUpdate(){return{added:0,removed:0,errors:[]};}
function tagIndexUpdate(){return{added:0,removed:0,errors:[]};}
function searchInvertedUpdate(){return{added:0,removed:0,errors:[]};}
function backlinkMapUpdate(){return{added:0,removed:0,errors:[]};}
function reportIndexFailure(){}
function resetIndexFailureStreak(){}
/* L8-W1 桩：commit（I-1）注入点调用 markPersistFromPatch（undo/redo 的 I-2/I-3 同址复用）。
   W1 影子模式 + Node 非桌面态 → 采集层天然早退；本测试仅验证 light 模式不污染 / 不入栈，
   故按 L6 范式注入 no-op 桩（同 step2-commit.test.mjs）。 */
function persistDirtyStats(){return{dirty:0,removed:0,mode:'patch',seq:0,sinceFull:0,forced:false,active:false};}
function l8PersistActive(){return false;}
function l8PersistFailure(){}
function markPersistFromPatch(){return persistDirtyStats();}
function markPersistMerged(){return persistDirtyStats();}
`;
const ctx = vm.createContext({
  console: { error() {}, warn() {}, log() {} },
  structuredClone: globalThis.structuredClone,
  Error, TypeError, Date, Map, Set, JSON, Math, Array,
  ui: { locked: false, encrypted: false, encKey: null, activeKey: null, _lastTouchedDocId: null },
  historyPast: [], historyFuture: [], HISTORY_MAX: 30,
  _wordCountCache: { clear() {}, delete() {} },
  _calIndexCache: null, _calRecurCache: null, _yearCountsCache: null, _calDayCache: null, _renderDayCache: null, _tagIndexCache: null,
  _searchInverted: null, _searchInvertedDocs: null, _backlinkMap: null, _backlinkReverse: null, _docTitleToDocId: null,
  __juIndexFailures: [], __juInMerge: false,
  PENDING_PLAIN_KEY: 'juju.pending.plain', PENDING_PLAIN_TTL: 60000,
  sessionStorage: { setItem() {} },
  document: { activeElement: null },
});
vm.runInContext(produceBlock + '\n' + PRELUDE, ctx);
vm.runInContext(extractFn(all, 'commit'), ctx);
vm.runInContext(extractFn(all, 'undo'), ctx);
const run = code => vm.runInContext(code, ctx);
const reset = () => run(`
  state={id:'root',rootId:'root',text:'',children:[],nodes:{},done:false,createdAt:1000,updatedAt:1000};
  ui.locked=false;ui.encrypted=false;ui.encKey=null;ui.activeKey=null;ui._lastTouchedDocId=null;
  historyPast.length=0;historyFuture.length=0;_notifyCount=0;__juLog.length=0;
  safeClone=(o)=>{try{return clone(o);}catch(e){try{return JSON.parse(JSON.stringify(o));}catch(e2){return o;}}};
  'ok';
`);
const st = () => run('state');
const logKinds = () => run('__juLog.map(e=>e.kind)');

console.log('--- Step3 light 污染防护 ---');

// B2 · light 成功：【P0-T3 结构共享】copy-on-write，引用必变（commit L2099-2103 注释）
{
  reset();
  const s0 = st();
  run(`commit(d=>{d.dbColumnWidths={__l3_light_test__:123};},{silent:true,persistOnly:true,light:true,noRollback:true});`);
  const s1 = st();
  ok('light 成功：state 引用改变（copy-on-write），updatedAt 被 bump，值写入',
    s1 !== s0 && s1.updatedAt >= 1001 && s1.dbColumnWidths.__l3_light_test__ === 123);
}
// A2 · noRollback + action 抛错：produce 失败天然回滚，state 原引用不变、无污染
{
  reset();
  const s0 = st();
  run(`commit(d=>{d.dbColumnWidths={__l3_polluted__:1};throw new Error('x');},{silent:true,persistOnly:true,light:true,noRollback:true});`);
  const s1 = st();
  ok('A2 noRollback 抛错：state 原引用不变、无污染残留（produce 天然回滚）',
    s1 === s0 && s1.dbColumnWidths === undefined &&
    !logKinds().includes('commit-light-norollback-failed'));
}
// A1 · safeClone 打桩 + 抛错：_lightBackup 机制已移除，state 不受 safeClone 影响
{
  reset();
  const s0 = st();
  run(`safeClone=()=>state;`);
  run(`commit(d=>{d.tagColors={__l3_backup_invalid__:'#000'};throw new Error('x');},{silent:true,persistOnly:true,light:true,noRollback:false});`);
  const s1 = st();
  ok('A1 safeClone 打桩 + 抛错：state 原引用不变、无残留（备份机制已移除）',
    s1 === s0 && (s1.tagColors === undefined || s1.tagColors.__l3_backup_invalid__ === undefined) &&
    !logKinds().includes('commit-light-backup-invalid'));
}
// 正常备份 + 抛错：回滚生效，不上报
{
  reset();
  run(`commit(d=>{d.dbColumnWidths={__l3_rollback__:1};throw new Error('x');},{silent:true,persistOnly:true,light:true,noRollback:false});`);
  const s1 = st();
  ok('有效备份 + 抛错：state 被回滚（无污染字段），不上报任何 kind',
    s1.dbColumnWidths === undefined && logKinds().length === 0);
}
// B1 · 非 silent 抛错路径强制通知
{
  reset();
  run(`commit(d=>{d.dbColumnWidths={__l3_notify__:1};throw new Error('x');},{silent:false,persistOnly:false,light:true,noRollback:true});`);
  ok('B1 非 silent 抛错：scheduleNotify 至少被调用 1 次', run('_notifyCount') >= 1);
}
// C1 · light 不入历史栈：snapshot 入栈 1 次，连续 undo 第二次 false
{
  reset();
  run(`commit(d=>{d.tagColors={__l3_hist__:'#ff0000'};},{snapshot:true,silent:true,persistOnly:true});`);
  run(`commit(d=>{d.dbColumnWidths={__l3_hist__:456};},{silent:true,persistOnly:true,light:true,noRollback:true});`);
  const first = run('undo()'), second = run('undo()');
  ok('C1 light 不入历史栈：第一次 undo=true（回退 snapshot），第二次 undo=false',
    first === true && second === false);
}
// Step2 回归 · 非 light 抛错：state 引用与内容均不变
{
  reset();
  const s0 = st();
  const n0 = run('Object.keys(state.nodes).length');
  run(`commit(d=>{d.nodes=null;throw new Error('x');},{silent:true,persistOnly:true});`);
  const s1 = st();
  ok('Step2 回归：非 light 抛错 state 引用不变、nodes 完好、不上报 light kind',
    s1 === s0 && Object.keys(s1.nodes).length === n0 &&
    !logKinds().includes('commit-light-norollback-failed') &&
    !logKinds().includes('commit-light-backup-invalid'));
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
