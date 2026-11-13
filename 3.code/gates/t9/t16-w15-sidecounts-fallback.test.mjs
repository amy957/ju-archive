/**
 * L16-W15 · 缺陷修复指令 6「侧栏计数异常路径改为整体重建（Defect-K）」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：
 *   commit() 的 L16-W3 侧栏计数收口在 `_l8Patch` 为空时（reportPatchFailure 序列化失败降级 /
 *   historyMode='never' 等异常路径）执行 `_sideCountsSet(state,_scBase)`，把旧 state 的计数
 *   原样继承给新 state —— 若本轮节点确实变更（如 setStar），starred / docCount / dbCount 更新丢失。
 * 本波改动（L16-W15）：
 *   - `_l8Patch` 存在且 paths 非空 → 增量 `_sideCountsApply`（语义不变）；
 *   - `_l8Patch` 缺失 / paths 为空 → `_sideCountsRebuild(state)` 单次遍历全量重建（不再继承旧基数）；
 *   - `__juInMerge` / 缺基数 / try-catch 兜底同口径走整体重建。
 * 断言口径（确定性 · 承接 L16-W3 / W14 范式）：
 *   A. 真实 commit 收口块（逐字提取）在异常路径下的计数正确性 + 与旧继承行为的分歧。
 *   B. 增量路径与整体重建结果等价（随机状态对拍）。
 *   C. 与 renderSidebar 原全表循环口径（starred / docCount / dbCount）逐项一致。
 *   D. 大 state（100,000 节点）单次重建耗时采样（记录值 · 与同期枚举地板对比）。
 * 运行：`node --test l9/t16-w15-sidecounts-fallback.test.mjs`（Node >= 22）
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

/* ---------- 1) 提取真实产品实现：侧栏计数段 ---------- */
const SC0 = SRC.indexOf("const _SIDECOUNTS=Symbol('_sidebarCounts');");
const SC1 = SRC.indexOf('/* collectSubtreeIds', SC0);
assert.ok(SC0 > 0 && SC1 > SC0, 'canonical 缺侧栏计数段');
const COUNTS_SRC = SRC.slice(SC0, SC1);

const COUNTS = new Function(`${COUNTS_SRC}
return { _SIDECOUNTS, _sideCount, _sideCountsFinalize, _sideCountsRebuild, _sideCountsApply,
         _sideCountsSet, _sideCountsGet, _sideCountsEnsure, extractChangedIds };`)();

const { _SIDECOUNTS, _sideCountsRebuild, _sideCountsApply, _sideCountsSet, _sideCountsGet, extractChangedIds } = COUNTS;

/* ---------- 2) 提取真实 commit 收口块（含 try/catch 兜底） ---------- */
const CB0 = SRC.indexOf('/* L16-W3 · 指令 3：侧栏计数增量维护');
const CB1 = SRC.indexOf('/* L8 阶段 W1 · I-1 采集注入点', CB0);
assert.ok(CB0 > 0 && CB1 > CB0, 'canonical 缺 commit 侧栏计数收口块');
const COMMIT_BLOCK = SRC.slice(CB0, CB1);

function runCommitCounts(state, oldState, l8Patch, inMerge, overrides) {
  const ov = overrides || {};
  const fn = new Function(
    'state', '_oldState', '_l8Patch', '__juInMerge',
    '_sideCountsGet', '_sideCountsSet', '_sideCountsRebuild', '_sideCountsApply', 'extractChangedIds',
    `${COMMIT_BLOCK}\nreturn state;`,
  );
  return fn(
    state, oldState, l8Patch, !!inMerge,
    ov.get || _sideCountsGet, ov.set || _sideCountsSet,
    ov.rebuild || _sideCountsRebuild, ov.apply || _sideCountsApply,
    ov.extract || extractChangedIds,
  );
}

/* ---------- 3) 状态构造 ---------- */
function makeState(opts) {
  const o = opts || {};
  const docs = o.docs == null ? 4 : o.docs;
  const nodes = {};
  const rootChildren = [];
  for (let i = 0; i < docs; i++) {
    const id = 'd' + i;
    rootChildren.push(id);
    nodes[id] = { id, parent: 'root', children: [], text: 'doc' + i, starred: o.starDocs && o.starDocs.indexOf(i) >= 0 ? 3 : 0 };
  }
  if (o.dbRoot !== false) {
    nodes.db = { id: 'db', parent: 'root', children: ['a', 'b'], text: 'db', _isDbRoot: true };
    rootChildren.push('db');
    nodes.a = { id: 'a', parent: 'db', children: [], text: 'a' };
    nodes.b = { id: 'b', parent: 'db', children: [], text: 'b' };
  }
  nodes.root = { id: 'root', parent: null, children: rootChildren, text: 'root' };
  const state = { rootId: 'root', nodes, updatedAt: 1700000000000, _rev: 1 };
  if (o.withCounts !== false) _sideCountsSet(state, _sideCountsRebuild(state));
  return state;
}

function cloneState(s) {
  const st = JSON.parse(JSON.stringify(s));
  const sc = _sideCountsGet(s);
  if (sc) _sideCountsSet(st, { starred: sc.starred, docCount: sc.docCount, dbRootId: sc.dbRootId, dbCount: sc.dbCount });
  return st;
}

/* ---------- A · Defect-K 异常路径 ---------- */
describe('A · Defect-K 异常路径：patch 缺失时整体重建', () => {
  test('A1 无 patch（patch 序列化失败 / historyMode never）+ setStar → starred +1', () => {
    const oldState = makeState({ starDocs: [] });
    const base = JSON.parse(JSON.stringify(_sideCountsGet(oldState)));
    const newState = cloneState(oldState);
    newState.nodes.d1.starred = 3;

    runCommitCounts(newState, oldState, null, false);
    const got = _sideCountsGet(newState);

    assert.equal(got.starred, base.starred + 1, '星标数应 +1');
    assert.notEqual(got.starred, base.starred, '旧口径（继承旧基数）会丢失本次更新');
    assert.deepEqual(got, _sideCountsRebuild(newState), '应与整体重建结果一致');
  });

  test('A2 patch 句柄存在但 paths 为空 → 整体重建（不继承旧基数）', () => {
    const oldState = makeState({ starDocs: [] });
    const base = _sideCountsGet(oldState);
    const newState = cloneState(oldState);
    newState.nodes.d2.starred = 5;

    runCommitCounts(newState, oldState, { paths: [], meta: {} }, false);
    assert.equal(_sideCountsGet(newState).starred, base.starred + 1);
  });

  test('A3 merge 期（__juInMerge=true）→ 整体重建', () => {
    const oldState = makeState({ starDocs: [] });
    const newState = cloneState(oldState);
    newState.nodes.d0.starred = 1;
    newState.nodes.d3.starred = 1;

    runCommitCounts(newState, oldState, { paths: ['nodes.d0.starred'], meta: {} }, true);
    assert.equal(_sideCountsGet(newState).starred, 2);
  });

  test('A4 旧 state 缺计数 → 整体重建', () => {
    const oldState = makeState({ starDocs: [], withCounts: false });
    const newState = cloneState(oldState);
    newState.nodes.d1.starred = 2;

    runCommitCounts(newState, oldState, null, false);
    const got = _sideCountsGet(newState);
    assert.equal(got.starred, 1);
    assert.deepEqual(got, _sideCountsRebuild(newState));
  });

  test('A5 try/catch 兜底：增量函数抛错 → 整体重建仍得正确计数', () => {
    const oldState = makeState({ starDocs: [] });
    const newState = cloneState(oldState);
    newState.nodes.d1.starred = 9;

    const throwingApply = () => { throw new Error('injected apply failure'); };
    runCommitCounts(newState, oldState, { paths: ['nodes.d1.starred'], meta: {} }, false, { apply: throwingApply });

    const got = _sideCountsGet(newState);
    assert.equal(got.starred, 1);
    assert.deepEqual(got, _sideCountsRebuild(newState));
  });

  test('A6 结构锚点：异常分支走 _sideCountsRebuild，旧继承写法已消除', () => {
    assert.ok(/_sideCountsRebuild\(state\)/.test(COMMIT_BLOCK), '异常分支缺少 _sideCountsRebuild(state)');
    assert.ok(!/_sideCountsSet\(state,_scBase\)/.test(COMMIT_BLOCK), '仍存在继承旧基数的写法');
    assert.ok(/catch\(_e\)\{\s*try\{\s*_sideCountsSet\(state,_sideCountsRebuild\(state\)\)/.test(COMMIT_BLOCK), 'try/catch 兜底缺失');
  });
});

/* ---------- B · 增量 vs 重建等价 ---------- */
function lcg(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function randomState(rnd) {
  const docs = 2 + Math.floor(rnd() * 6);
  const st = makeState({ docs, dbRoot: rnd() > 0.4, withCounts: false });
  for (const id in st.nodes) {
    const n = st.nodes[id];
    n.starred = rnd() > 0.6 ? 1 + Math.floor(rnd() * 5) : 0;
    n._isFolder = rnd() > 0.85;
    n._isCalRoot = rnd() > 0.9;
  }
  _sideCountsSet(st, _sideCountsRebuild(st));
  return st;
}

describe('B · 增量路径与整体重建等价', () => {
  test('B1 随机 300 例：_sideCountsApply 结果 === _sideCountsRebuild(新 state)', () => {
    const rnd = lcg(20261017);
    for (let i = 0; i < 300; i++) {
      const from = randomState(rnd);
      const to = cloneState(from);
      const ids = new Set();
      const idsArr = Object.keys(to.nodes);
      const picks = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < picks; k++) {
        const id = idsArr[Math.floor(rnd() * idsArr.length)];
        if (id === to.rootId) continue;
        const n = to.nodes[id];
        const r = rnd();
        if (r < 0.4) n.starred = n.starred ? 0 : 4;
        else if (r < 0.7 && n.parent !== to.rootId) n.parent = to.rootId;
        ids.add(id);
      }
      const inc = _sideCountsApply(_sideCountsGet(from), from, to, ids);
      assert.deepEqual(inc, _sideCountsRebuild(to), `case ${i} 增量与重建不一致`);
    }
  });

  test('B2 commit 收口在 patch 路径下与整体重建一致', () => {
    const from = makeState({ starDocs: [] });
    const to = cloneState(from);
    to.nodes.d1.starred = 7;
    const paths = ['nodes.d1.starred'].concat(Object.keys(to.nodes).filter((id) => to.nodes[id].parent === to.rootId && id !== to.rootId && !to.nodes[id]._isDbRoot).map((id) => `nodes.${id}.parent`));
    runCommitCounts(to, from, { paths, meta: {} }, false);
    assert.deepEqual(_sideCountsGet(to), _sideCountsRebuild(to));
  });
});

/* ---------- C · 与 renderSidebar 原全表循环口径一致 ---------- */
function renderSidebarReference(s) {
  const root = s.nodes[s.rootId];
  const rootChildSet = new Set(root ? root.children : []);
  let starred = 0, docCount = 0, dbRoot = null;
  for (const id in s.nodes) {
    const n = s.nodes[id];
    if (!n || n._deleted || n.id === s.rootId) continue;
    if (n.starred > 0 && !n._isFolder && !n._isDbRoot && !n._isCalRoot) starred++;
    if (rootChildSet.has(id)) {
      if (n._isDbRoot) dbRoot = n;
      else if (!n._isCalRoot) docCount++;
    }
  }
  return { starred, docCount, dbCount: dbRoot ? dbRoot.children.length : 0 };
}

describe('C · 侧栏渲染口径', () => {
  test('C1 随机 200 例：重建计数与 renderSidebar 全表循环逐项一致', () => {
    const rnd = lcg(777001);
    for (let i = 0; i < 200; i++) {
      const s = randomState(rnd);
      const acc = _sideCountsRebuild(s);
      const ref = renderSidebarReference(s);
      assert.equal(acc.starred, ref.starred, `case ${i} starred`);
      assert.equal(acc.docCount, ref.docCount, `case ${i} docCount`);
      assert.equal(acc.dbCount, ref.dbCount, `case ${i} dbCount`);
    }
  });

  test('C2 异常路径后立即读取：星标 / 文档 / 数据库计数正确', () => {
    const oldState = makeState({ starDocs: [], dbRoot: true });
    const newState = cloneState(oldState);
    newState.nodes.d1.starred = 3;
    newState.nodes.newDoc = { id: 'newDoc', parent: 'root', children: [], text: 'new' };
    newState.nodes.root.children.push('newDoc');

    runCommitCounts(newState, oldState, null, false);
    const sc = _sideCountsGet(newState);
    const ref = renderSidebarReference(newState);
    assert.equal(sc.starred, ref.starred);
    assert.equal(sc.docCount, ref.docCount);
    assert.equal(sc.dbCount, ref.dbCount);
    assert.equal(sc.starred, 1, '星标数 +1');
    assert.equal(sc.dbCount, 2, '数据库条目数来自 dbRoot.children');
  });
});

/* ---------- D · 大 state 采样 ---------- */
describe('D · 100k 节点单次重建采样', () => {
  test('D1 重建耗时采样（记录值 + 相对枚举地板的上界守卫）', (t) => {
    const N = 100000;
    const st = { rootId: 'root', nodes: {}, updatedAt: 1, _rev: 1 };
    const rootChildren = [];
    for (let i = 0; i < N; i++) {
      const id = 'n' + i;
      const atRoot = i % 3 === 0;
      if (atRoot) rootChildren.push(id);
      st.nodes[id] = {
        id,
        parent: atRoot ? 'root' : 'n' + ((i - 1) | 0),
        children: [],
        text: 'x',
        starred: i % 7,
        _isFolder: i % 11 === 0,
        _isDbRoot: i % 997 === 0,
        _isCalRoot: i % 991 === 0,
      };
    }
    st.nodes.root = { id: 'root', parent: null, children: rootChildren, text: 'root' };

    const sample = (fn, rounds) => {
      const xs = [];
      let last = null;
      for (let r = 0; r < rounds; r++) {
        const t0 = process.hrtime.bigint();
        last = fn();
        const t1 = process.hrtime.bigint();
        xs.push(Number(t1 - t0) / 1e6);
      }
      xs.sort((a, b) => a - b);
      const q = (p) => xs[Math.min(xs.length - 1, Math.floor(xs.length * p))];
      return { med: q(0.5), p95: q(0.95), max: xs[xs.length - 1], last };
    };

    const enumFloor = sample(() => { let c = 0; for (const id in st.nodes) c += id.length; return c; }, 81);
    const rebuild = sample(() => _sideCountsRebuild(st), 81);

    const sc = rebuild.last;
    const ref = renderSidebarReference(st);
    assert.equal(sc.starred, ref.starred);
    assert.equal(sc.docCount, ref.docCount);
    assert.equal(sc.dbCount, ref.dbCount);

    t.diagnostic(`100k 重建: med=${rebuild.med.toFixed(2)}ms p95=${rebuild.p95.toFixed(2)}ms max=${rebuild.max.toFixed(2)}ms`);
    t.diagnostic(`100k 枚举地板: med=${enumFloor.med.toFixed(2)}ms p95=${enumFloor.p95.toFixed(2)}ms`);
    t.diagnostic(`重建 p95 − 枚举地板 p95 = ${(rebuild.p95 - enumFloor.p95).toFixed(2)}ms`);

    assert.ok(rebuild.p95 < enumFloor.p95 * 5, '单次重建不得超出枚举地板的 5 倍（防止遍历内出现二次分类或额外分配）');
  });
});
