/**
 * L16-W10 · 缺陷修复指令 1「removeNode / getCurrentDoc 增加根节点守卫」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义（Defect-A）：
 *   1. actions.removeNode(id) 原仅守 _isCalRoot / _isDbRoot，传入 state.rootId 时会把根节点
 *      连同整棵树递归删除（purgeNodeMeta / 墓碑 / 搜索缓存链路），此后 getCurrentDoc() 的
 *      `root.children.map(...)` 因根节点缺失抛 TypeError。
 *   2. getCurrentDoc() 原未校验 `state.nodes[state.rootId]` 是否存在，整树被清后直接解引用。
 *   本波改动：
 *   A. removeNode 首个守卫扩为 `if(!n||id===state.rootId||n._isCalRoot||n._isDbRoot)return;`；
 *   B. getCurrentDoc 在 `const root=state.nodes[state.rootId];` 后追加 `if(!root)return null;`；
 *   C. moveToTrash 入口同口径（根节点不可回收）；
 *   D. outlineBatchDelete 入口同口径（目标为根节点即返回）。
 * 断言口径（确定性 · 承接 L16-W1..W9 范式）：
 *   A. 结构锚点：四处守卫均在 canonical 中（且 removeNode 守卫先于 commit）。
 *   B. 行为：removeNode(state.rootId) 节点数不变 / 零 commit / 无 throw；正常节点删除仍生效。
 *   C. 行为：根节点缺失时 getCurrentDoc() 返回 null（不抛 TypeError）；常规路径结果不变。
 *   D. 行为：moveToTrash(state.rootId) 零 commit / 回收站不变。
 *   E. 行为：outlineBatchDelete 命中根节点即返回（零确认框）。
 *   F. 性质对照：旧口径 7 次根操作 defectA 违规 = 7 → 新口径 = 0（errSamples 空）。
 *   G. 大 state（50,000 节点）P95 采样：守卫拒绝路径 P95 有界且不劣于旧口径整树删除。
 * 运行：`node --test l9/t16-w10-defecta-root-guard.test.mjs`（Node >= 22）
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

/* ---------- 从 canonical 提取真实产品实现 ---------- */
const methodToFunction = (src) => src.replace(/^\s*([A-Za-z_$][\w$]*)\(/, 'function $1(');

const REMOVE_M = SRC.match(/  removeNode\(id\)\{[\s\S]*?\n  \},\n  createDoc\(/);
assert.ok(REMOVE_M, 'canonical 缺少 actions.removeNode');
const REMOVE_SRC = methodToFunction(REMOVE_M[0].slice(0, REMOVE_M[0].lastIndexOf('\n  },')) + '\n  }');

const GETDOC_M = SRC.match(/function getCurrentDoc\(\)\{[\s\S]*?\n\}/);
assert.ok(GETDOC_M, 'canonical 缺少 getCurrentDoc');
const GETDOC_SRC = GETDOC_M[0];

const TRASH_M = SRC.match(/  moveToTrash\(id\)\{[\s\S]*?\n  \},\n  restoreFromTrash\(/);
assert.ok(TRASH_M, 'canonical 缺少 actions.moveToTrash');
const TRASH_SRC = methodToFunction(TRASH_M[0].slice(0, TRASH_M[0].lastIndexOf('\n  },')) + '\n  }');

const BATCH_M = SRC.match(/function outlineBatchDelete\(\)\{[\s\S]*?\n\}/);
assert.ok(BATCH_M, 'canonical 缺少 outlineBatchDelete');
const BATCH_SRC = BATCH_M[0];

/* ---------- 最小作用域装配（产品函数体逐字执行，外部依赖以桩替换） ---------- */
function makeRemoveRunner(src, state) {
  const counters = { commit: 0, log: 0 };
  const ui = { collapsedDocs: {} };
  const hay = new Map();
  const commit = (fn) => { counters.commit++; fn(state); };
  const fn = new Function(
    'state', 'N', 'stripHtml', 'findOwningTopDocId', 'commit', 'ui', '_searchHayCache',
    'purgeNodeMeta', '_tombstoneSet', 'actions',
    src + '\nreturn removeNode;',
  )(
    state,
    (id) => state.nodes[id],
    (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, ''),
    () => null,
    commit,
    ui,
    hay,
    (s, x) => { delete s[x]; },
    (x, s) => { (s._tombstones || (s._tombstones = {}))[x] = Date.now(); },
    { logActivity: () => { counters.log++; } },
  );
  return { fn, counters, ui, hay };
}

function makeGetDoc(src, state, ui) {
  return new Function('state', 'ui', src + '\nreturn getCurrentDoc;')(state, ui);
}

function makeTrashRunner(src, state) {
  const counters = { commit: 0 };
  const ui = { currentDocId: null, activeKey: null };
  const commit = (fn) => { counters.commit++; fn(state); };
  const docSubtree = (id) => {
    const a = [];
    (function w(x) {
      const n = state.nodes[x];
      if (!n || n._deleted) return;
      a.push(x);
      (n.children || []).forEach(w);
    })(id);
    return a;
  };
  const fn = new Function(
    'state', 'ui', 'commit', 'docSubtree', '_tombstoneSet',
    src + '\nreturn moveToTrash;',
  )(state, ui, commit, docSubtree, (x, s) => { (s._tombstones || (s._tombstones = {}))[x] = Date.now(); });
  return { fn, counters, ui };
}

function makeBatchRunner(src, state, doc) {
  const counters = { confirm: 0, remove: 0 };
  const sel = { ids: new Set(), anchorId: null };
  const fn = new Function(
    'state', 'getCurrentDoc', 'topSelected', 'appConfirm', 'actions', '_outlineSel', 'forceRender',
    src + '\nreturn outlineBatchDelete;',
  )(
    state,
    () => doc,
    () => ['doc1'],
    (msg, cb) => { counters.confirm++; cb(); },
    { removeNode: () => { counters.remove++; } },
    sel,
    () => {},
  );
  return { fn, counters, sel };
}

/* ---------- 构造态 ---------- */
function mkChainState(n) {
  const s = { rootId: 'root', nodes: {}, _tombstones: {}, trashed: [] };
  s.nodes.root = { id: 'root', parent: null, children: ['doc1'] };
  s.nodes.doc1 = { id: 'doc1', parent: 'root', children: ['n1'], text: 'doc1', createdAt: 1, updatedAt: 1 };
  let parent = 'doc1';
  for (let i = 1; i <= n; i++) {
    const id = 'n' + i;
    s.nodes[id] = { id, parent, children: [], text: id, createdAt: 1, updatedAt: 1 };
    s.nodes[parent].children.push(id);
    parent = id;
  }
  return s;
}
function mkWideState(n) {
  const s = { rootId: 'root', nodes: {}, _tombstones: {}, trashed: [] };
  s.nodes.root = { id: 'root', parent: null, children: [] };
  for (let i = 0; i < n; i++) {
    const id = 'w' + i;
    s.nodes[id] = { id, parent: 'root', children: [], text: id, createdAt: 1, updatedAt: 1 };
    s.nodes.root.children.push(id);
  }
  return s;
}
function mkFlatState(docs) {
  const s = { rootId: 'root', nodes: {}, _tombstones: {}, trashed: [] };
  s.nodes.root = { id: 'root', parent: null, children: [] };
  for (const d of docs) {
    s.nodes[d] = { id: d, parent: 'root', children: [], text: d, createdAt: 1, updatedAt: 1 };
    s.nodes.root.children.push(d);
  }
  return s;
}

/* ---------- 旧口径（本波之前）：无根节点守卫 ---------- */
const OLD_REMOVE_SRC = REMOVE_SRC.replace(
  'if(!n||id===state.rootId||n._isCalRoot||n._isDbRoot)return;',
  'if(!n||n._isCalRoot||n._isDbRoot)return;',
);
const OLD_GETDOC_SRC = GETDOC_SRC.replace(/\n    if\(!root\)return null;[^\n]*/, '');
assert.ok(OLD_REMOVE_SRC !== REMOVE_SRC, '旧口径构造失败（removeNode 守卫未命中）');
assert.ok(OLD_GETDOC_SRC !== GETDOC_SRC, '旧口径构造失败（getCurrentDoc 守卫未命中）');

describe('L16-W10 §A 结构锚点（四处根节点守卫）', () => {
  test('removeNode 守卫含 state.rootId 且先于 commit', () => {
    const flag = 'if(!n||id===state.rootId||n._isCalRoot||n._isDbRoot)return;';
    assert.ok(REMOVE_SRC.includes(flag), 'removeNode 缺根节点守卫');
    assert.ok(REMOVE_SRC.indexOf(flag) < REMOVE_SRC.indexOf('commit('), '守卫未前置到 commit 之前');
  });

  test('getCurrentDoc 在取根后立即判空返回 null', () => {
    const iRoot = GETDOC_SRC.indexOf('const root=state.nodes[state.rootId];');
    const iGuard = GETDOC_SRC.indexOf('if(!root)return null;');
    assert.ok(iRoot >= 0, 'getCurrentDoc 缺取根语句');
    assert.ok(iGuard > iRoot, 'getCurrentDoc 缺根判空守卫');
    assert.ok(iGuard < GETDOC_SRC.indexOf('root.children'), '判空守卫须先于 root.children 解引用');
  });

  test('moveToTrash / outlineBatchDelete 入口同口径', () => {
    assert.ok(TRASH_SRC.includes('id===state.rootId'), 'moveToTrash 缺根节点守卫');
    assert.ok(BATCH_SRC.includes('doc.id===state.rootId'), 'outlineBatchDelete 缺根节点守卫');
    assert.ok(TRASH_SRC.indexOf('id===state.rootId') < TRASH_SRC.indexOf('commit('), '回收守卫未前置');
    assert.ok(BATCH_SRC.indexOf('doc.id===state.rootId') < BATCH_SRC.indexOf('appConfirm('), '批量删除守卫未前置');
  });
});

describe('L16-W10 §B removeNode(state.rootId) 不改变节点数', () => {
  test('大 state（20,000 节点）：节点数不变 / 零 commit / 无 throw', () => {
    const s = mkChainState(20000);
    const before = Object.keys(s.nodes).length;
    const { fn, counters } = makeRemoveRunner(REMOVE_SRC, s);
    assert.doesNotThrow(() => fn(s.rootId));
    assert.equal(Object.keys(s.nodes).length, before, '根节点被删除（整树被清）');
    assert.equal(counters.commit, 0, '根节点删除不应进入 commit');
    assert.equal(s.nodes.root.children[0], 'doc1', '根节点 children 被改动');
  });

  test('正常节点删除仍生效（守卫不误伤）', () => {
    const s = mkChainState(50);
    const before = Object.keys(s.nodes).length;
    const { fn, counters } = makeRemoveRunner(REMOVE_SRC, s);
    fn('n20');
    assert.equal(counters.commit, 1, '正常删除应单次 commit');
    assert.ok(Object.keys(s.nodes).length < before, '正常删除未生效');
    assert.ok(!s.nodes.n20, '目标节点未删除');
  });
});

describe('L16-W10 §C getCurrentDoc 根节点缺失返回 null', () => {
  test('整树被清（state.nodes 无 root）不抛 TypeError', () => {
    const s = { rootId: 'root', nodes: {} };
    const ui = { currentDocId: null };
    const getDoc = makeGetDoc(GETDOC_SRC, s, ui);
    let out;
    assert.doesNotThrow(() => { out = getDoc(); });
    assert.equal(out, null);
  });

  test('常规路径结果不变（返回首个非容器文档 / 空 children 返回 null）', () => {
    const s = mkFlatState(['d1', 'd2']);
    s.nodes.cal = { id: 'cal', parent: 'root', children: [], _isCalRoot: true };
    s.nodes.root.children.unshift('cal');
    const ui1 = { currentDocId: null };
    assert.equal(makeGetDoc(GETDOC_SRC, s, ui1)(), s.nodes.d1, '未回落到首个文档');
    const ui2 = { currentDocId: 'd2' };
    assert.equal(makeGetDoc(GETDOC_SRC, s, ui2)(), s.nodes.d2, '显式 currentDocId 未生效');
    const empty = mkFlatState([]);
    assert.equal(makeGetDoc(GETDOC_SRC, empty, { currentDocId: null })(), null, '空根应返回 null');
  });
});

describe('L16-W10 §D moveToTrash(state.rootId) 不进入回收流程', () => {
  test('零 commit / 回收站不变 / 根节点 children 不变', () => {
    const s = mkChainState(1000);
    const { fn, counters } = makeTrashRunner(TRASH_SRC, s);
    const children = s.nodes.root.children.slice();
    assert.doesNotThrow(() => fn(s.rootId));
    assert.equal(counters.commit, 0, '根节点回收不应进入 commit');
    assert.equal(s.trashed.length, 0, '回收站被写入');
    assert.deepEqual(s.nodes.root.children, children, '根节点 children 被改动');
  });
});

describe('L16-W10 §E outlineBatchDelete 命中根节点即返回', () => {
  test('零确认框 / 零删除调用', () => {
    const s = mkChainState(10);
    const rootNode = s.nodes.root;
    const { fn, counters } = makeBatchRunner(BATCH_SRC, s, rootNode);
    assert.doesNotThrow(() => fn());
    assert.equal(counters.confirm, 0, '根节点场景不应弹出确认');
    assert.equal(counters.remove, 0, '根节点场景不应触发删除');
  });

  test('常规文档目标仍走确认流程', () => {
    const s = mkChainState(10);
    const { fn, counters } = makeBatchRunner(BATCH_SRC, s, s.nodes.doc1);
    fn();
    assert.equal(counters.confirm, 1, '常规文档未走确认流程');
    assert.ok(counters.remove > 0, '常规文档未触发删除');
  });
});

describe('L16-W10 §F 性质对照（defectARootOps 7 → 0）', () => {
  test('旧口径 7 次根操作 = 7 次违规；新口径 = 0 且 errSamples 空', () => {
    const run = (removeSrc, getDocSrc) => {
      const s = mkChainState(200);
      const { fn } = makeRemoveRunner(removeSrc, s);
      const ui = { currentDocId: null };
      const getDoc = makeGetDoc(getDocSrc, s, ui);
      let defectA = 0;
      const errSamples = [];
      for (let i = 0; i < 7; i++) {
        const before = Object.keys(s.nodes).length;
        let bad = false;
        try {
          fn(s.rootId);
          if (Object.keys(s.nodes).length !== before) bad = true;
          getDoc();
        } catch (e) {
          bad = true;
          errSamples.push(String(e && e.name) + ': ' + String(e && e.message));
        }
        if (bad) defectA++;
      }
      return { defectA, errSamples };
    };
    const oldRun = run(OLD_REMOVE_SRC, OLD_GETDOC_SRC);
    const newRun = run(REMOVE_SRC, GETDOC_SRC);
    assert.equal(oldRun.defectA, 7, `旧口径违规数应为 7（实测 ${oldRun.defectA}）`);
    assert.ok(oldRun.errSamples.some((m) => m.startsWith('TypeError:')), '旧口径应复现 TypeError（getCurrentDoc）');
    assert.equal(newRun.defectA, 0, `新口径仍有 ${newRun.defectA} 次违规`);
    assert.deepEqual(newRun.errSamples, [], '新口径不应产生 errSamples');
  });
});

describe('L16-W10 §G 大 state（50,000 节点）P95 采样', () => {
  const p95 = (arr) => {
    const v = arr.slice().sort((a, b) => a - b);
    return v[Math.min(v.length - 1, Math.floor(v.length * 0.95))];
  };
  test('守卫拒绝路径 P95 ≤ 0.5ms 且不劣于旧口径整树删除', () => {
    const N = 50000;
    const s = mkWideState(N);
    const { fn } = makeRemoveRunner(REMOVE_SRC, s);
    const newMs = [];
    fn(s.rootId); /* 预热 */
    for (let i = 0; i < 20; i++) {
      const t0 = process.hrtime.bigint();
      fn(s.rootId);
      const t1 = process.hrtime.bigint();
      newMs.push(Number(t1 - t0) / 1e6);
    }
    assert.equal(Object.keys(s.nodes).length, N + 1, '守卫路径不得改变大 state 规模');
    const p95New = p95(newMs);

    const oldMs = [];
    for (let i = 0; i < 12; i++) {
      const st = mkWideState(N);
      const runner = makeRemoveRunner(OLD_REMOVE_SRC, st);
      const t0 = process.hrtime.bigint();
      runner.fn(st.rootId);
      const t1 = process.hrtime.bigint();
      oldMs.push(Number(t1 - t0) / 1e6);
      assert.equal(Object.keys(st.nodes).length, 0, '旧口径应清空整树（缺陷复现）');
    }
    const p95Old = p95(oldMs);
    assert.ok(p95New <= 0.5, `守卫拒绝 P95=${p95New.toFixed(4)}ms 超出 0.5ms 预算`);
    assert.ok(p95New <= p95Old, `守卫拒绝 P95=${p95New.toFixed(4)}ms 劣于旧口径 P95=${p95Old.toFixed(4)}ms`);
  });
});
