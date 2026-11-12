/* P0-L3 结构共享验收：引用语义测试（仅变更路径引用变化，其余节点引用不变）
   从 v2.0-l3.html.html 实际内容提取 __juProduce / __juProduceSafe 并执行，
   不内联副本，保证测试的是交付代码本体。

   运行：
     node --test P0-L3/tests/structural-sharing.test.mjs
   预期：pass 16 / fail 0（11 基线 + BUG-1/2/3 回归 + 深层别名 + 数组 delete 稀疏） */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '..', '..', 'v2.0-l3.html.html');
const html = fs.readFileSync(FILE, 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const all = scripts.join('\n');

/* 提取 produceBlock：const clone= ... function isBlankNode(n){ 之前，
   含 clone / safeClone / __juProduce / __juProduceSafe。 */
const pStart = all.indexOf('const clone=');
const pEnd = all.indexOf('function isBlankNode(n){');
if (pStart < 0 || pEnd < 0) throw new Error('锚点未找到，无法提取 produce 原语');
const block = all.slice(pStart, pEnd);

const ctx = vm.createContext({
  console,
  structuredClone: globalThis.structuredClone,
  Error, TypeError, Date, Map, Set, JSON, RegExp, ArrayBuffer, BigInt, Symbol, Math,
  Object, Array, WeakMap, Proxy, Reflect,
});
vm.runInContext(block, ctx);
const run = code => vm.runInContext(code, ctx);

/* 与 v2.0-l3.html.html 中一致的最小状态样例 */
function makeState() {
  return {
    rootId: 'root',
    updatedAt: 1,
    nodes: {
      root: { id: 'root', parent: null, children: ['a', 'b'], text: 'root' },
      a: { id: 'a', parent: 'root', children: [], text: 'A' },
      b: { id: 'b', parent: 'root', children: [], text: 'B' }
    }
  };
}
/* 序列化回传（vm 上下文对象需先 stringify 再 parse） */
const runJson = code => JSON.parse(JSON.stringify(run(code)));

test('仅变更路径引用变化：改 a.text，b 引用不变', () => {
  const r = runJson(`(()=>{
    const base = ${JSON.stringify(makeState())};
    const aRef = base.nodes.a, bRef = base.nodes.b;
    const next = __juProduce(base, draft => { draft.nodes.a.text = 'A2'; });
    return {
      rootChanged: next !== base,
      nodesChanged: next.nodes !== base.nodes,
      aChanged: next.nodes.a !== aRef,
      bShared: next.nodes.b === bRef,
      aText: next.nodes.a.text,
      baseAText: base.nodes.a.text
    };
  })()`);
  assert.equal(r.rootChanged, true);
  assert.equal(r.nodesChanged, true);
  assert.equal(r.aChanged, true);
  assert.equal(r.bShared, true);
  assert.equal(r.aText, 'A2');
  assert.equal(r.baseAText, 'A');
});

test('数组 splice 结构共享：仅 children 数组与根路径变化', () => {
  const r = runJson(`(()=>{
    const base = ${JSON.stringify(makeState())};
    const aRef = base.nodes.a, bRef = base.nodes.b;
    const next = __juProduce(base, draft => {
      draft.nodes.root.children.splice(0, 1);
    });
    return {
      children: next.nodes.root.children,
      aShared: next.nodes.a === aRef,
      bShared: next.nodes.b === bRef,
      baseLen: base.nodes.root.children.length
    };
  })()`);
  assert.deepEqual(r.children, ['b']);
  assert.equal(r.aShared, true);
  assert.equal(r.bShared, true);
  assert.equal(r.baseLen, 2);
});

test('delete 结构共享：删除 a，b 引用不变', () => {
  const r = runJson(`(()=>{
    const base = ${JSON.stringify(makeState())};
    const bRef = base.nodes.b;
    const next = __juProduce(base, draft => { delete draft.nodes.a; });
    return {
      aGone: !('a' in next.nodes),
      bShared: next.nodes.b === bRef,
      baseHasA: 'a' in base.nodes
    };
  })()`);
  assert.equal(r.aGone, true);
  assert.equal(r.bShared, true);
  assert.equal(r.baseHasA, true);
});

test('recipe 抛错不污染 base', () => {
  const r = runJson(`(()=>{
    const base = ${JSON.stringify(makeState())};
    const res = __juProduceSafe(base, () => { throw new Error('boom'); });
    return {
      ok: res.ok,
      baseSame: res.base === base,
      aText: base.nodes.a.text
    };
  })()`);
  assert.equal(r.ok, false);
  assert.equal(r.baseSame, true);
  assert.equal(r.aText, 'A');
});

test('recipe 返回非 undefined 时直接替换', () => {
  const r = runJson(`(()=>{
    const base = ${JSON.stringify(makeState())};
    const out = __juProduce(base, () => null);
    return out === null ? { isNull: true } : { isNull: false };
  })()`);
  assert.equal(r.isNull, true);
});

test('嵌套数组 push 结构共享', () => {
  const r = runJson(`(()=>{
    const base = ${JSON.stringify(makeState())};
    const bRef = base.nodes.b;
    const next = __juProduce(base, draft => {
      draft.nodes.root.children.push('c');
    });
    return {
      children: next.nodes.root.children,
      bShared: next.nodes.b === bRef,
      baseLen: base.nodes.root.children.length
    };
  })()`);
  assert.deepEqual(r.children, ['a', 'b', 'c']);
  assert.equal(r.bShared, true);
  assert.equal(r.baseLen, 2);
});

test('F-1 回归：delete 后 draft 中间态语义正确（get/in/keys/JSON/descriptor）', () => {
  const r = runJson(`(()=>{
    const base = {a:1,b:2};
    const out = {};
    const next = __juProduce(base, d => {
      out.getBefore = d.a;
      delete d.a;
      out.getAfter = d.a;
      out.inAfter = 'a' in d;
      out.keysAfter = Object.keys(d);
      out.descMissing = Object.getOwnPropertyDescriptor(d,'a') === undefined;
      out.jsonDraft = JSON.stringify(d);
    });
    return {
      getBefore: out.getBefore,
      getAfter: out.getAfter === undefined,
      inAfter: out.inAfter,
      keysAfter: out.keysAfter,
      descMissing: out.descMissing,
      jsonDraft: out.jsonDraft,
      resultKeys: Object.keys(next),
      baseKeys: Object.keys(base),
      baseA: base.a
    };
  })()`);
  assert.equal(r.getBefore, 1);
  assert.equal(r.getAfter, true);
  assert.equal(r.inAfter, false);
  assert.deepEqual(r.keysAfter, ['b']);
  assert.equal(r.descMissing, true);
  assert.equal(r.jsonDraft, '{"b":2}');
  assert.deepEqual(r.resultKeys, ['b']);
  assert.deepEqual(r.baseKeys, ['a', 'b']);
  assert.equal(r.baseA, 1);
});

test('F-1 回归：删后重设 / 重定义，键重新存在', () => {
  const r = runJson(`(()=>{
    const re = __juProduce({a:1,b:2}, d => { delete d.a; d.a = 9; });
    const rd = __juProduce({a:1,b:2}, d => {
      delete d.a;
      Object.defineProperty(d,'a',{value:7,writable:true,enumerable:true,configurable:true});
    });
    return {
      resetKeys: Object.keys(re).sort(),
      resetA: re.a,
      redefKeys: Object.keys(rd).sort(),
      redefA: rd.a
    };
  })()`);
  assert.deepEqual(r.resetKeys, ['a', 'b']);
  assert.equal(r.resetA, 9);
  assert.deepEqual(r.redefKeys, ['a', 'b']);
  assert.equal(r.redefA, 7);
});

test('O-1：Date 走 safeClone 回退（base 为 Date 实例）', () => {
  const r = runJson(`(()=>{
    const base = new Date(0);
    const next = __juProduce(base, d => { d.setFullYear(2000); });
    return {
      isDate: next instanceof Date,
      year: next.getFullYear(),
      baseYear: base.getFullYear(),
      notSame: next !== base
    };
  })()`);
  assert.equal(r.isDate, true);
  assert.equal(r.year, 2000);
  assert.equal(r.baseYear, 1970);
  assert.equal(r.notSame, true);
});

test('O-1：Map 经路径复制保持实例（不触发 Map 方法代理）', () => {
  const r = runJson(`(()=>{
    const base = { m: new Map([[1,2]]), x: 1 };
    const next = __juProduce(base, d => { d.x = 2; });
    return {
      isMap: next.m instanceof Map,
      sameInstance: next.m === base.m,
      x: next.x,
      baseX: base.x
    };
  })()`);
  assert.equal(r.isMap, true);
  assert.equal(r.sameInstance, true);
  assert.equal(r.x, 2);
  assert.equal(r.baseX, 1);
});

test('O-新：嵌套 Map 方法调用抛 TypeError（仅顶层回退，嵌套不保证）', () => {
  const r = runJson(`(()=>{
    const base = { m: new Map([[1,2]]) };
    let threw = false, msg = '';
    try {
      __juProduce(base, d => { d.m.set(3,4); });
    } catch (e) { threw = true; msg = String(e); }
    return {
      threw,
      msg,
      baseHas: base.m instanceof Map && base.m.get(1) === 2,
      baseSize: base.m.size
    };
  })()`);
  assert.equal(r.threw, true);
  assert.ok(/TypeError|invalid receiver|Illegal invocation|incompatible/i.test(r.msg), '实际错误: ' + r.msg);
  assert.equal(r.baseHas, true);
  assert.equal(r.baseSize, 1);
});

/* ============================================================
   BUG 回归（修复清单 4.2）：引用语义三处确定 bug 的直接触发用例
   BUG-1/2 修复前必须 fail（对拍基线，见 结构共享验收记录.md §11.1）；
   修复后含深层别名与 delete 稀疏共 16 全绿。
   ============================================================ */
test('BUG-1: __proto__ 写入保留自有数据键，不替换原型', () => {
  const r = runJson(`(()=>{
    const base = {x:1};
    const next = __juProduce(base, d => { d.__proto__ = {evil:1}; });
    return {
      /* vm 沙箱内 Object.prototype 绑定为主 realm，不能直接 === 比较；
         与同 realm 新字面量原型比较（前置修复前 {evil:1} 原型同样不满足此断言） */
      protoIsObjectProto: Object.getPrototypeOf(next) === Object.getPrototypeOf({}),
      protoNoEvilLeak: !Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(next), 'evil'),
      ownProto: Object.prototype.hasOwnProperty.call(next, '__proto__'),
      x: next.x
    };
  })()`);
  assert.equal(r.protoIsObjectProto, true);
  assert.equal(r.protoNoEvilLeak, true);
  assert.equal(r.ownProto, true);
  assert.equal(r.x, 1);
});

test('BUG-2: 数组 length 截断后越界索引在 draft 与结果中均不可见', () => {
  const r = runJson(`(()=>{
    const base = [1,2,3];
    const out = {};
    const next = __juProduce(base, d => {
      d.length = 1;
      out.draftIdx1 = d[1];
      out.draftKeys = Object.keys(d);
      out.draftJson = JSON.stringify(d);
    });
    return {
      len: next.length,
      idx0: next[0],
      idx1: next[1] === undefined,
      keys: Object.keys(next),
      json: JSON.stringify(next),
      draftIdx1: out.draftIdx1 === undefined,
      draftKeys: out.draftKeys,
      draftJson: out.draftJson
    };
  })()`);
  assert.equal(r.len, 1);
  assert.equal(r.idx0, 1);
  assert.equal(r.idx1, true);
  assert.deepEqual(r.keys, ['0']);
  assert.equal(r.json, '[1]');
  assert.equal(r.draftIdx1, true);
  assert.deepEqual(r.draftKeys, ['0']);
  assert.equal(r.draftJson, '[1]');
});

test('BUG-3: 别名对象修改只走一条父链（告警而非错误）', () => {
  const r = runJson(`(()=>{
    const shared = {v:1};
    const base = {a:shared, b:shared};
    const next = __juProduce(base, d => { d.a.v = 2; });
    return {
      aV: next.a.v,
      bV: next.b.v,
      baseAV: base.a.v
    };
  })()`);
  // 别名声明的语义：a 改了，b 也应该看到（同一对象）
  assert.equal(r.aV, 2);
  assert.equal(r.bV, 2);
  assert.equal(r.baseAV, 1);
});

test('BUG-3 深层：别名对象在两个父级下，修改其中一个父级下的引用（告警 + 不保证）', () => {
  const r = runJson(`(()=>{
    const child = {v:1};
    const base = {x:{c:child}, y:{c:child}};
    let warned = false;
    const origWarn = console.warn;
    console.warn = () => { warned = true; };
    let next;
    try {
      /* 先访问 x.c 建立 parent 链，再经 y.c 命中别名检测；
         仅访问单条路径不会触发告警（childRec 首次 parent 赋值即当前父） */
      next = __juProduce(base, d => { d.x.c; d.y.c.v = 2; });
    } finally { console.warn = origWarn; }
    return {
      warned,
      xV: next.x.c.v,
      yV: next.y.c.v,
      baseV: base.x.c.v,
      xSharedWithBase: next.x === base.x,
      yChanged: next.y !== base.y
    };
  })()`);
  // 告警触发；base 未污染；深层别名下 finalize 结果不保证一致（x 引用共享但值与 y 分叉）
  assert.equal(r.warned, true);
  assert.equal(r.baseV, 1);
  assert.equal(r.xSharedWithBase, true);
  assert.equal(r.yChanged, true);
});

test('delete arr[i] 后 length 不变，稀疏语义正确', () => {
  const r = runJson(`(()=>{
    const base = [1,2,3];
    const next = __juProduce(base, d => { delete d[1]; });
    return {
      len: next.length,
      idx1: next[1] === undefined,
      has1: 1 in next,
      keys: Object.keys(next)
    };
  })()`);
  assert.equal(r.len, 3);
  assert.equal(r.idx1, true);
  assert.equal(r.has1, false);
  assert.deepEqual(r.keys, ['0', '2']);
});
