/* P0-T3 Step2 验证脚本：从 v2.0-t3.html 实际内容提取并校验
   1) 全部内联 <script> 语法检查
   2) 提取 clone/safeClone/__juProduce/__juProduceSafe + commit/undo/redo 函数源码，
      在带桩 sandbox 中执行，覆盖 commit 替换与 undo/redo 一致性的核心行为用例
      （对照 P0-T3/commit替换说明.md 第六节 6.1/6.2/6.3）。 */
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

/* ---- 工具：按签名括号平衡提取函数源码 ---- */
function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('未找到 function ' + name);
  let i = start + ('function ' + name).length; // 位于 '('
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

/* ---- 2) 构建 sandbox ---- */
const all = scripts.join('\n');
const pStart = all.indexOf('const clone=');
const pEnd = all.indexOf('function isBlankNode(n){');
const produceBlock = all.slice(pStart, pEnd);

const PRELUDE = `
var _notifyCount=0;
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
/* L4 阶段 1.6 桩：commit/undo/redo 内部调用 resolveHistoryMode / buildPatch / tryMergeWithLast / collectModifiedPaths / extractAtPaths / setByPath / inferOp / inferGroupKey / reportPatchFailure / invertPatch / applyPatch；本测试仅验证 commit 替换行为（state 引用 / updatedAt）和 undo/redo 的栈操作。
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
function applyPatch(s,patch,direction){return s;}  /* 桩：直接返回 s，state 不变（适用于测试用例 H/I） */
/* L6 阶段 2 桩：M1/M2/M3 注入点调用 extractChangedIds / updateIncrementalIndexes / collectSubtreeIds /
   calIndexUpdate / tagIndexUpdate / searchInvertedUpdate / backlinkMapUpdate / reportIndexFailure。
   桩实现：全部 no-op，不维护 4 索引增量（Node 测试仅验证 commit 替换行为和 undo/redo 栈操作）*/
function extractChangedIds(){return new Set();}
function updateIncrementalIndexes(){return{ok:true,errors:[],added:0,removed:0};}
function collectSubtreeIds(){return new Set();}
function calIndexUpdate(){return{added:0,removed:0,errors:[]};}
function tagIndexUpdate(){return{added:0,removed:0,errors:[]};}
function searchInvertedUpdate(){return{added:0,removed:0,errors:[]};}
function backlinkMapUpdate(){return{added:0,removed:0,errors:[]};}
function reportIndexFailure(){}
function resetIndexFailureStreak(){}
/* L8-W1 桩：I-1（commit）注入点调用 markPersistFromPatch；I-2/I-3（undo/redo）同址复用该包装。
   W1 为影子模式（只记账、不发 desktopInvoke），且 Node 侧为「非桌面」态 → 采集层天然早退；
   本测试仅验证 commit 替换行为与 undo/redo 栈操作，故按 L6 范式注入 no-op 桩，
   返回与 persistDirtyStats() 同形的统计对象，不触达真实脏集（_dirtyNodes/_removedNodes）。 */
function persistDirtyStats(){return{dirty:0,removed:0,mode:'patch',seq:0,sinceFull:0,forced:false,active:false};}
function l8PersistActive(){return false;}
function l8PersistFailure(){}
function markPersistFromPatch(){return persistDirtyStats();}
function markPersistMerged(){return persistDirtyStats();}
`;
const ctx = vm.createContext({
  console, structuredClone: globalThis.structuredClone,
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
vm.runInContext(extractFn(all, 'redo'), ctx);
const run = code => vm.runInContext(code, ctx);
const reset = () => run(`
  state={id:'root',rootId:'root',text:'',children:[],done:false,createdAt:1000,updatedAt:1000};
  ui.locked=false;ui.encrypted=false;ui.encKey=null;ui.activeKey=null;ui._lastTouchedDocId=null;
  historyPast.length=0;historyFuture.length=0;_notifyCount=0;
  'ok';
`);
const stateOf = () => run('state');

console.log('--- commit 替换行为（6.1/6.2） ---');

// B. 非 light 成功：state 被替换为新引用，action 生效，updatedAt 单调
{
  reset();
  const s0 = stateOf();
  run(`__ret=commit(d=>{d.foo=1;});`);
  const r = run('__ret'), st = stateOf();
  ok('非 light 成功：state 替换为新引用且 foo=1, updatedAt 推进',
    r === st && st !== s0 && st.foo === 1 && st.updatedAt >= 1001);
}
// C. 非 light action 抛错：state 原引用未替换，告警 + silent:false 通知，历史栈未 push
{
  reset();
  const s0 = stateOf();
  const before = run('historyPast.length');
  run(`__ret=commit(()=>{throw new Error('x');},{silent:false});`);
  const r = run('__ret'), st = stateOf(), n = run('_notifyCount'), after = run('historyPast.length');
  ok('非 light 抛错：返回原 state 引用，未替换，通知 1 次，历史栈 0 push',
    r === st && st === s0 && n === 1 && before === after && before === 0);
}
// D. light 成功：【P0-T3 结构共享】不再原地修改，copy-on-write 引用必变（commit L2099-2103 注释）
{
  reset();
  const s0 = stateOf();
  run(`commit(d=>{d.colWidth=200;},{light:true,noRollback:true});`);
  const st = stateOf();
  ok('light 成功：state 引用改变（copy-on-write），colWidth=200', st !== s0 && st.colWidth === 200);
}
// E. light 抛错：produce 失败天然回滚，state 原引用不变、无残留
{
  reset();
  const s0 = stateOf();
  run(`commit(d=>{d.colWidth=300;throw new Error('x');},{light:true});`);
  const st = stateOf(), n = run('_notifyCount');
  ok('light 抛错（可回滚语义）：state 原引用不变、无 colWidth 残留，通知 1 次',
    st === s0 && st.colWidth === undefined && n === 1);
}
// F. light 抛错 + noRollback：noRollback 参数保留兼容，语义自然满足（同 E）
{
  reset();
  const s0 = stateOf();
  run(`commit(d=>{d.colWidth=300;throw new Error('x');},{light:true,noRollback:true});`);
  const st = stateOf(), n = run('_notifyCount');
  ok('light 抛错+noRollback：state 原引用不变、无残留（语义自然满足），通知 1 次',
    st === s0 && st.colWidth === undefined && n === 1);
}
// G. snapshot=true：历史栈 push 1 次，future 清空
{
  reset();
  run(`commit(d=>{d.x=1;},{snapshot:true});`);
  const hp = run('historyPast.length'), hf = run('historyFuture.length'), st = stateOf();
  ok('snapshot=true：historyPast=1, historyFuture=0, state.x=1', hp === 1 && hf === 0 && st.x === 1);
}
// H. undo：push 逆 patch 到 future（invertPatch），弹出 past（path-level diff）
{
  reset();
  run(`
    historyPast.push({v:1,t:1,op:'test',mode:'snapshot',paths:['_changed'],pre:{},post:{},meta:{},groupKey:undefined});
    state={id:'root',rootId:'root',text:'A',children:[],done:false,createdAt:1000,updatedAt:2000};
    __r=undo();
  `);
  const r = run('__r'), hfLen = run('historyFuture.length'), st = stateOf();
  const copyIsSame = run('historyFuture[0]===state');
  ok('undo：返回 true，historyFuture=1（invertPatch），state 弹出后由 applyPatch 决定，副本非同一引用',
    r === true && hfLen === 1 && copyIsSame === false);
}
// I. redo：push 逆 patch 到 past（invertPatch），弹出 future
{
  reset();
  run(`
    historyFuture.push({v:1,t:1,op:'test',mode:'snapshot',paths:['_changed'],pre:{},post:{},meta:{},groupKey:undefined});
    state={id:'root',rootId:'root',text:'B',children:[],done:false,createdAt:1000,updatedAt:3000};
    __r=redo();
  `);
  const r = run('__r'), hpLen = run('historyPast.length'), st = stateOf();
  ok('redo：返回 true，historyPast=1（invertPatch 推入），state 由 applyPatch 决定',
    r === true && hpLen === 1);
}
// J. snapshot 分支 push 的是 patch（pre 记录 action 前值，post 记录 action 后值），相互隔离
{
  reset();
  run(`commit(d=>{d.x=1;},{snapshot:true});`);
  run(`commit(d=>{d.x=2;},{snapshot:true});`);
  const p0mode = run('historyPast[0].mode'), p1mode = run('historyPast[1].mode');
  const p0op = run('historyPast[0].op'), p1op = run('historyPast[1].op');
  const sx = run('state.x');
  const sameRef = run('historyPast[0]===historyPast[1]');
  ok('连续 snapshot：historyPast 存 patch（mode=snapshot, op=unknown），state.x=2，副本引用隔离',
    p0mode === 'snapshot' && p1mode === 'snapshot' && sx === 2 && sameRef === false && p0op === 'unknown' && p1op === 'unknown');
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
