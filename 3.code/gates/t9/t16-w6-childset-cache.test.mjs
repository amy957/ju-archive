/**
 * L16-W6 · 指令 6「_childSets 缓存提升为 WeakMap」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：repairTreeConsistency 每次调用（含每次 mergeRemoteState 尾部）都重建全部 Set
 *           （第一遍 _childSets Map + 第二遍每父一个 seen Set）。每次远端广播都会重建全量 Set——
 *           大库（10 万节点 / 数千父）单次即分配上千个 Set 对象。本波把 _childSetCache 提升为模块级
 *           WeakMap（node→Set(children)）：
 *             - _getChildSet(pid) 读缓存（结构共享下未变节点引用稳定 ⇒ 跨调用复用零分配）；
 *             - 第二遍复用缓存 Set 作 seen（clear 后就地重填为存活 children 集，与 p.children 恒等）；
 *             - mergeRemoteState 就地改写 children 处 _childSetDrop(node) 失效；
 *             - initStore 整体替换 state.nodes 时重置 WeakMap。
 * 断言口径（确定性 · 无 wall-clock 阈值敏感，承接 L16-W1..W5 范式）：
 *   A. 结构锚点：canonical 具备 _childSetCache/_childSetDrop；_getChildSet 读缓存；initStore 重置 WeakMap；
 *   B. 结果等价：畸形树（自引用 / 悬空 parent / 多父 / children 重复）修复后逐字节 == 旧 Map 口径；
 *   C. 分配下降：连续 100 次 repair，累计分配对象数（Set/Map/WeakMap）下降 ≥80%；
 *   D. 缓存一致性：修复后每个父节点缓存 Set == 实际 children 集；
 *   E. 复用身份：同节点连续两次 repair 命中同一 Set 对象（证明复用而非重建）；
 *   F. 幂等：已合法树 repair 为 no-op（各节点 children 不变）；
 *   G. 空 children 父：缓存为空集，第二遍不误删合法节点；
 *   H. 缓存失效：显式 _childSetDrop 后该节点缓存被清除，下一次 repair 重建为新 Set 对象。
 * 运行：`node --test l9/t16-w6-childset-cache.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const CANONICAL = path.resolve(STEP9, '..', 'v2.0-t3.html');
const SRC = readFileSync(CANONICAL, 'utf8');

/* 从 canonical 提取真实产品实现（L16-W6 声明 + _childSetDrop + repairTreeConsistency 整段）。 */
const IMPL = SRC.match(/let _childSetCache=new WeakMap\(\);[\s\S]*?\n\}/);
assert.ok(IMPL, 'canonical 缺少 L16-W6 repairTreeConsistency / _childSetCache 实现');

/* 旧口径（Map + 每父全新 Set）参照实现：用于「结果等价」与「分配下降」对照。 */
const BASELINE = `
function repairTreeConsistency(){
  if(!state||!state.nodes||!state.rootId)return;
  const ns=state.nodes;
  const root=ns[state.rootId];
  if(!root)return;
  const _childSets=new Map();
  const _getChildSet=pid=>{
    let s=_childSets.get(pid);
    if(!s){s=new Set(((ns[pid]&&ns[pid].children)||[]));_childSets.set(pid,s);}
    return s;
  };
  for(const id in ns){
    if(id===state.rootId)continue;
    const n=ns[id];
    if(!n||typeof n!=='object')continue;
    if(n._deleted)continue;
    if(n.parent===id)delete n.parent;
    const p=(n.parent&&ns[n.parent])?ns[n.parent]:null;
    if(!p){
      n.parent=state.rootId;
      if(!_getChildSet(state.rootId).has(id)){root.children.push(id);_getChildSet(state.rootId).add(id);}
    }else if(!_getChildSet(p.id).has(id)){
      p.children.push(id);_getChildSet(p.id).add(id);
    }
  }
  for(const pid in ns){
    const p=ns[pid];
    if(!p||!Array.isArray(p.children))continue;
    const seen=new Set();
    for(let i=0;i<p.children.length;i++){
      const cid=p.children[i];
      if(seen.has(cid)){p.children.splice(i,1);i--;continue;}
      seen.add(cid);
      const c=ns[cid];
      if(!c||c._deleted)continue;
      if(c.parent!==pid){p.children.splice(i,1);i--;}
    }
  }
}`;

/* ---- 计数构造器：统计 Set / Map / WeakMap 对象分配数 ---- */
let COUNT = { Set: 0, Map: 0, WeakMap: 0 };
const mk = (name) => { const Real = globalThis[name]; return function (it) { COUNT[name]++; return new Real(it); }; };
const mkSet = mk('Set'), mkMap = mk('Map'), mkWeakMap = mk('WeakMap');

const NEW_BODY = IMPL[0] +
  '\nlet state=null;\nreturn {run:repairTreeConsistency,set:function(s){state=s;},cache:function(){return _childSetCache;},drop:_childSetDrop};';
const BASE_BODY = BASELINE +
  '\nlet state=null;\nreturn {run:repairTreeConsistency,set:function(s){state=s;}};';

const makeHarness = (body) => new Function('Set', 'Map', 'WeakMap', body)(mkSet, mkMap, mkWeakMap);

/* ---- 合法树构造：root → nParents 个父 → 每父 perParent 个叶子 ---- */
function buildValidTree(nParents, perParent) {
  const s = { rootId: 'root', nodes: {} };
  s.nodes.root = { id: 'root', parent: null, children: [] };
  let k = 0;
  for (let i = 0; i < nParents; i++) {
    const pid = 'p' + i;
    s.nodes[pid] = { id: pid, parent: 'root', children: [] };
    s.nodes.root.children.push(pid);
    for (let j = 0; j < perParent; j++) {
      const cid = 'c' + (k++);
      s.nodes[cid] = { id: cid, parent: pid, children: [] };
      s.nodes[pid].children.push(cid);
    }
  }
  return s;
}

/* ---- 畸形树构造：自引用 / 悬空 parent / 多父 / children 重复 / _deleted 节点 ---- */
function buildMalformedTree() {
  const s = { rootId: 'root', nodes: {} };
  s.nodes.root = { id: 'root', parent: null, children: ['a', 'ghost', 'a'] }; /* 重复 + 悬空 ghost */
  s.nodes.a = { id: 'a', parent: 'a', children: ['b', 'b'] };                 /* 自引用 + 重复 */
  s.nodes.b = { id: 'b', parent: 'root', children: [] };                      /* 多父：root 与 a 均含 b */
  s.nodes.c = { id: 'c', parent: 'missing', children: [] };                   /* 悬空 parent（父不存在） */
  s.nodes.d = { id: 'd', parent: 'root', children: [], _deleted: true };      /* 回收站节点（不修复） */
  s.nodes.root.children.push('c');
  s.nodes.a.children.push('b');
  return s;
}

const j = (o) => JSON.stringify(o);

describe('L16-W6 §A 结构锚点', () => {
  test('canonical 具备 _childSetCache(WeakMap) / _childSetDrop；_getChildSet 读缓存；initStore 重置', () => {
    assert.ok(SRC.includes('let _childSetCache=new WeakMap();'), '缺 _childSetCache 载体');
    assert.ok(SRC.includes('function _childSetDrop(n){try{if(n)_childSetCache.delete(n);}catch(e){}}'), '缺 _childSetDrop');
    assert.ok(IMPL[0].includes('_childSetCache.get(node)'), '_getChildSet 未读缓存');
    assert.ok(IMPL[0].includes('_childSetCache.set(node,s)'), '_getChildSet 未写缓存');
    assert.ok(IMPL[0].includes('_childSetCache.get(p)') && IMPL[0].includes('seen.clear()'), '第二遍未复用缓存 Set');
    assert.ok(IMPL[0].includes('seen.delete(cid)'), '第二遍 stray 剔除未同步缓存');
    const resets = SRC.split('_childSetCache=new WeakMap();').length - 1;
    assert.ok(resets >= 2, 'initStore 未重置 _childSetCache（期望 ≥2 处赋值）');
    assert.ok(SRC.includes('state.nodes 整体替换 ⇒ 旧节点引用的 children 缓存失效'), 'initStore 重置注释缺失');
  });
});

describe('L16-W6 §B 结果等价（新口径 == 旧 Map 口径）', () => {
  test('畸形树修复后逐字节一致', () => {
    const m1 = buildMalformedTree();
    const m2 = buildMalformedTree();
    const hN = makeHarness(NEW_BODY); hN.set(m1); hN.run();
    const hB = makeHarness(BASE_BODY); hB.set(m2); hB.run();
    assert.equal(j(m1.rootId), j(m2.rootId));
    assert.equal(j(m1.nodes), j(m2.nodes), '新口径修复结果与旧口径不一致');
  });
});

describe('L16-W6 §C 分配下降（100 次连续 repair）', () => {
  test('累计分配对象数下降 ≥80%', () => {
    const sN = buildValidTree(2000, 5);
    const hN = makeHarness(NEW_BODY); hN.set(sN);
    COUNT = { Set: 0, Map: 0, WeakMap: 0 };
    for (let i = 0; i < 100; i++) hN.run();
    const newCount = COUNT.Set + COUNT.Map + COUNT.WeakMap;

    const sB = buildValidTree(2000, 5);
    const hB = makeHarness(BASE_BODY); hB.set(sB);
    COUNT = { Set: 0, Map: 0, WeakMap: 0 };
    for (let i = 0; i < 100; i++) hB.run();
    const baseCount = COUNT.Set + COUNT.Map + COUNT.WeakMap;

    const reduction = baseCount > 0 ? ((baseCount - newCount) / baseCount) * 100 : 0;
    assert.ok(baseCount > 0, '基线分配计数应大于 0');
    assert.ok(reduction >= 80, `分配下降 ${reduction.toFixed(1)}% < 80%（base=${baseCount} new=${newCount}）`);
  });
});

describe('L16-W6 §D 缓存一致性（缓存 Set == 实际 children 集）', () => {
  test('修复后每个父节点缓存 Set 与 p.children 恒等', () => {
    const s = buildValidTree(120, 4);
    const hN = makeHarness(NEW_BODY); hN.set(s); hN.run();
    const cache = hN.cache();
    let checked = 0;
    for (const id in s.nodes) {
      const n = s.nodes[id];
      const set = cache.get(n);
      if (!set) continue;
      checked++;
      assert.equal(set.size, n.children.length, `节点 ${id} 缓存大小 ${set.size} != children ${n.children.length}`);
      for (const c of n.children) assert.ok(set.has(c), `节点 ${id} 缓存缺 ${c}`);
    }
    assert.ok(checked > 0, '应至少校验到一个父节点');
  });
});

describe('L16-W6 §E 复用身份（命中同一 Set 对象）', () => {
  test('同节点连续两次 repair 复用同一 Set 对象', () => {
    const s = buildValidTree(50, 3);
    const hN = makeHarness(NEW_BODY); hN.set(s);
    hN.run();
    const cache = hN.cache();
    const a = cache.get(s.nodes['p0']);
    hN.run();
    const b = cache.get(s.nodes['p0']);
    assert.ok(a, 'p0 应有缓存 Set');
    assert.equal(a, b, '连续两次 repair 应复用同一 Set 对象');
  });
});

describe('L16-W6 §F 幂等（合法树 no-op）', () => {
  test('已合法树 repair 后 children 不变', () => {
    const s = buildValidTree(80, 3);
    const before = {}; for (const id in s.nodes) before[id] = s.nodes[id].children.slice();
    const hN = makeHarness(NEW_BODY); hN.set(s); hN.run();
    for (const id in s.nodes) assert.equal(j(s.nodes[id].children), j(before[id]), `节点 ${id} children 被改动`);
  });
});

describe('L16-W6 §G 空 children 父', () => {
  test('空 children 父缓存为空集且第二遍不误删', () => {
    const s = { rootId: 'root', nodes: {} };
    s.nodes.root = { id: 'root', parent: null, children: ['e'] };
    s.nodes.e = { id: 'e', parent: 'root', children: [] };
    const hN = makeHarness(NEW_BODY); hN.set(s); hN.run();
    const set = hN.cache().get(s.nodes.e);
    assert.ok(set, 'e 应有缓存 Set');
    assert.equal(set.size, 0, '空 children 父缓存应为空集');
    assert.equal(j(s.nodes.root.children), j(['e']), 'e 不应被误删');
  });
});

describe('L16-W6 §H 缓存失效（_childSetDrop）', () => {
  test('drop 后缓存被清除，下一次 repair 重建为新 Set 对象', () => {
    const s = buildValidTree(30, 2);
    const hN = makeHarness(NEW_BODY); hN.set(s);
    hN.run();
    const cache = hN.cache();
    const p = s.nodes['p0'];
    const a = cache.get(p);
    assert.ok(a, 'p0 应有缓存 Set');
    hN.drop(p);
    assert.equal(cache.get(p), undefined, 'drop 后缓存应被清除');
    hN.run();
    const b = cache.get(p);
    assert.ok(b, 'repair 后应重建缓存 Set');
    assert.notEqual(b, a, '重建应为新 Set 对象（证明失效语义）');
  });
});
