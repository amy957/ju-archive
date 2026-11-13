/**
 * L16-W7 · 指令 7「collectSubtreeIdsFromPreState 去除重复遍历」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：collectSubtreeIdsFromPreState(pre, rootIds) 从「patch 应用前」状态收集子树 id 全集。
 *           原实现以 roots.filter(Boolean) 建栈并混用 Array.prototype.pop / push（大型子树下有多次
 *           数组扩容风险）；本波改为显式索引游标队列：
 *             - const queue 以显式游标推进（let head=0; while(head<queue.length)），不再混用 pop/push；
 *             - 单次传入 rootIds 时直接初始化 queue（不再 roots.filter(Boolean)），循环内 if(!id)continue 守卫。
 *           语义等价：返回 id 集与原实现逐位（元素集）相等。
 * 断言口径（确定性 · 无 wall-clock 强阈值，承接 L16-W1..W6 范式）：
 *   A. 结构锚点：canonical 使用索引游标 queue[head++]；函数体内无 stack.filter(Boolean) / stack.pop()；
 *   B. 结果等价：合法 / 平坦 / 深链 / 分叉 / 畸形（环引用 / 重复 / 悬空 / null / undefined）树逐位相等；
 *   C. 单根传入：非数组单根 / 数组单根与旧口径等价；
 *   D. 5 万节点子树：逐位相等（验收 ①）；
 *   E. 确定性幂等：同输入重复调用返回相同的元素集（且相互独立）；
 *   F. 环引用防护：自引用子树可终止且结果悬空闭合；
 *   G. 非显著劣化：50k 子树新旧 P95 对照，新口径不显著劣于旧口径（容差宽，避免抖动误报）。
 * 运行：`node --test l9/t16-w7-collect-subtree.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const CANONICAL = path.resolve(STEP9, '..', 'canonical', 'v2.0-t3.html');
const SRC = readFileSync(CANONICAL, 'utf8');

/* 从 canonical 提取真实产品实现。 */
const IMPL = SRC.match(/function collectSubtreeIdsFromPreState\(pre,rootIds\)\{[\s\S]*?\n\}/);
assert.ok(IMPL, 'canonical 缺少 collectSubtreeIdsFromPreState 实现');
const IMPL_SRC = IMPL[0];

/* 旧口径（roots.filter(Boolean) + pop/push 混用）参照实现：用于「结果等价」与「P95 对照」。 */
const BASELINE_SRC = `function collectSubtreeIdsFromPreState(pre,rootIds){
  const nodes=(pre&&pre.nodes)?pre.nodes:(pre||{});
  const ids=new Set();
  const roots=Array.isArray(rootIds)?rootIds:(rootIds?[rootIds]:[]);
  const stack=roots.filter(Boolean);
  while(stack.length){
    const id=stack.pop();
    if(!id||ids.has(id))continue;
    ids.add(id);
    const n=nodes[id];
    if(n&&Array.isArray(n.children)){for(const cid of n.children)if(cid&&!ids.has(cid))stack.push(cid);}
  }
  return ids;
}`;

const mk = (src) => new Function(src + '\nreturn collectSubtreeIdsFromPreState;')();
const NEW_FN = mk(IMPL_SRC);
const OLD_FN = mk(BASELINE_SRC);

const sorted = (set) => [...set].sort();

/* ---- 树构造器 ---- */
function flat(n) { const nodes = { root: { id: 'root', parent: null, children: [] } }; for (let i = 0; i < n; i++) { const id = 'n' + i; nodes[id] = { id, parent: 'root', children: [] }; nodes.root.children.push(id); } return { rootId: 'root', nodes }; }
function chain(n) { const nodes = { root: { id: 'root', parent: null, children: ['n0'] } }; for (let i = 0; i < n; i++) { const id = 'n' + i; nodes[id] = { id, parent: i === 0 ? 'root' : 'n' + (i - 1), children: i + 1 < n ? ['n' + (i + 1)] : [] }; } return { rootId: 'root', nodes }; }
function bushy(np, pp) { const nodes = { root: { id: 'root', parent: null, children: [] } }; let k = 0; for (let i = 0; i < np; i++) { const pid = 'p' + i; nodes[pid] = { id: pid, parent: 'root', children: [] }; nodes.root.children.push(pid); for (let j = 0; j < pp; j++) { const cid = 'c' + (k++); nodes[cid] = { id: cid, parent: pid, children: [] }; nodes[pid].children.push(cid); } } return { rootId: 'root', nodes }; }
function deep2(n) { const nodes = { root: { id: 'root', parent: null, children: [] } }; let fr = ['root'], k = 0, tot = 1; while (tot < n && fr.length) { const nf = []; for (const pid of fr) for (let c = 0; c < 2 && tot < n; c++) { const id = 'd' + (k++); nodes[id] = { id, parent: pid, children: [] }; nodes[pid].children.push(id); nf.push(id); tot++; } fr = nf; } return { rootId: 'root', nodes }; }
function malformed() {
  const s = { rootId: 'root', nodes: {} };
  s.nodes.root = { id: 'root', parent: null, children: ['a', 'ghost', 'a', null, undefined, ''] };
  s.nodes.a = { id: 'a', parent: 'a', children: ['b', 'b', 'a'] };  /* 自引用 + 重复 */
  s.nodes.b = { id: 'b', parent: 'root', children: ['c'] };         /* 多父 */
  s.nodes.c = { id: 'c', parent: 'missing', children: ['d'] };      /* 悬空 parent */
  s.nodes.d = { id: 'd', parent: 'c', children: ['b'] };            /* 环：b→c→d→b */
  s.nodes.e = { id: 'e', parent: 'root', children: null };          /* children 非数组 */
  s.nodes.root.children.push('c', 'e');
  return s;
}

const EQUAL = (a, b, msg) => assert.deepEqual(sorted(a), sorted(b), msg);

describe('L16-W7 §A 结构锚点（索引游标队列）', () => {
  test('使用 queue[head++] 游标；函数体无 stack.filter(Boolean) / stack.pop()', () => {
    assert.ok(IMPL_SRC.includes('let head=0;'), '缺显式索引游标 let head=0');
    assert.ok(IMPL_SRC.includes('while(head<queue.length)'), '缺 while(head<queue.length) 游标推进');
    assert.ok(IMPL_SRC.includes('queue[head++]'), '缺 queue[head++] 出队');
    assert.ok(!IMPL_SRC.includes('stack.filter(Boolean)'), '仍存在 stack.filter(Boolean)');
    assert.ok(!IMPL_SRC.includes('.pop()'), '仍存在 Array.prototype.pop 混用');
    assert.ok(IMPL_SRC.includes('if(!id||ids.has(id))continue;'), '缺循环内 if(!id)continue 守卫');
    /* 单次传入 rootIds 时直接初始化 queue（不再 roots.filter(Boolean)）。 */
    assert.ok(!/const stack\s*=\s*roots\.filter/.test(IMPL_SRC), '仍以 roots.filter 建 stack');
  });
});

describe('L16-W7 §B 结果等价（新口径 == 旧口径，逐位）', () => {
  const shapes = {
    flat: flat(50000),
    chain: chain(50000),
    bushy: bushy(200, 250),
    deep2: deep2(50000),
    malformed: malformed(),
  };
  for (const [name, pre] of Object.entries(shapes)) {
    test(`${name} 子树逐位相等`, () => {
      const n = NEW_FN(pre, ['root']);
      const o = OLD_FN(pre, ['root']);
      EQUAL(n, o, `${name} 新旧口径 id 集不一致`);
      assert.ok(n instanceof Set, `${name} 返回值应为 Set`);
    });
  }
});

describe('L16-W7 §C 单根传入（非数组 / 数组）等价', () => {
  test('单根字符串与单元素数组结果一致（含 null / undefined 守卫）', () => {
    const pre = bushy(20, 5);
    EQUAL(NEW_FN(pre, 'root'), OLD_FN(pre, 'root'), '单根字符串不一致');
    EQUAL(NEW_FN(pre, ['root']), OLD_FN(pre, ['root']), '单根数组不一致');
    EQUAL(NEW_FN(pre, [null, undefined, 'root']), OLD_FN(pre, [null, undefined, 'root']), '含空项数组不一致');
    EQUAL(NEW_FN(pre, null), OLD_FN(pre, null), '空 rootIds 不一致');
    assert.equal(NEW_FN(pre, null).size, 0, '空 rootIds 应返回空集');
  });
});

describe('L16-W7 §D 5 万节点子树（验收 ①：逐位相等）', () => {
  test('50,000 节点子树 id 集逐位相等且规模正确', () => {
    const pre = bushy(200, 250); /* 1 + 200 + 50000 = 50201 */
    const n = NEW_FN(pre, ['root']);
    const o = OLD_FN(pre, ['root']);
    EQUAL(n, o, '5 万子树 id 集不一致');
    assert.equal(n.size, 50201, '子树规模应为 50201');
  });
});

describe('L16-W7 §E 确定性幂等', () => {
  test('同输入两次调用返回相同元素集（互不影响）', () => {
    const pre = bushy(80, 20);
    const a = NEW_FN(pre, ['root']);
    const b = NEW_FN(pre, ['root']);
    EQUAL(a, b, '重复调用结果不一致');
    assert.notEqual(a, b, '两次调用应返回独立 Set 实例');
  });
});

describe('L16-W7 §F 环引用防护（可终止）', () => {
  test('自引用 / 环路子树可终止且结果闭合', () => {
    const pre = malformed();
    const n = NEW_FN(pre, ['root']);
    assert.ok(n.has('root') && n.has('a') && n.has('b'), '环路子树应含 root/a/b');
    assert.ok(![...n].some((x) => x === null || x === undefined || x === ''), '结果不应含空项');
  });
});

describe('L16-W7 §G 非显著劣化（50k 子树 P95 对照）', () => {
  test('新口径 P95 不显著劣于旧口径（宽容差，避免抖动误报）', () => {
    const pre = bushy(200, 250);
    for (let w = 0; w < 30; w++) { OLD_FN(pre, ['root']); NEW_FN(pre, ['root']); }
    const p95 = (fn) => { const t = []; for (let i = 0; i < 120; i++) { const a = process.hrtime.bigint(); fn(pre, ['root']); const b = process.hrtime.bigint(); t.push(Number(b - a) / 1e6); } t.sort((x, y) => x - y); return t[Math.floor(t.length * 0.95)]; };
    const to = p95(OLD_FN), tn = p95(NEW_FN);
    assert.ok(tn <= to * 1.5 + 0.5, `新口径 P95 ${tn.toFixed(3)}ms 显著劣于旧口径 ${to.toFixed(3)}ms`);
  });
});
