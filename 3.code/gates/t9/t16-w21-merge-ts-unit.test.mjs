/**
 * L16-W21 · 缺陷修复指令 12「合并往返时间戳单位统一（Defect-C）」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义（Defect-C）：
 *   mergeRemoteState 的 LWW 比较使用 `_norm(t)`，其仅把微秒级（>8.64e14）除以 1000，
 *   对「秒级」时间戳（0 < v < 1e10）不作处理。对端快照若以秒为单位（其他客户端 / 旧导出 /
 *   跨端往返），与本地毫秒级时间戳直接比较时 1.7e9 < 1.7e12 恒成立 ⇒ 对端更新的节点永远
 *   在 LWW 中落败（本地旧值保留、对端删除不传播），形成时间戳伪影。
 * 本波改动（L16-W21）：
 *   A. 新增 `_normToMs(t)`——秒级（0<v<1e10）×1000、微秒级（v>8.64e14）÷1000、其余原样返回；
 *   B. mergeRemoteState 内全部 `_norm(...)` 调用改为 `_normToMs(...)`；
 *   C. `remoteUpdatedAt` 与全局元数据 LWW 的 `state.updatedAt` 同口径归一。
 * 断言口径（确定性 · 承接 L16-W12/W13/W20 范式）：
 *   A. 结构锚点：helper 三分支存在；merge 段内 `_norm(` 残留 0；remoteUpdatedAt 归一。
 *   B. 归一函数：秒 / 毫秒 / 微秒三分支；毫秒域（1e12~1e13）不被归一（无副作用）；幂等。
 *   C. 行为：对端秒级更新胜出、对端秒级删除传播、本地毫秒较新仍胜、微秒分支不回归、
 *      墓碑守卫（旧快照）不复活。
 *   D. 属性采样（property.clean · 200 场景 / 其中 22 个携带秒级对端快照）：
 *      I1 = 结构干净；I2 = 单位不变性（秒级合入 ≡ 同值毫秒合入，oracle 等价）；I3 = 毫秒域原样。
 *   E. 大 state（20,001 节点）合并 P95 采样。
 * 运行：`node --test l9/t16-w21-merge-ts-unit.test.mjs`（Node >= 22）
 * 红证：`JU_W21_CANONICAL=<改前字节副本>` 指向前进前字节（本文件同时以文本还原构造旧口径）。
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
/* 红证支持：JU_W21_CANONICAL 可指向改前字节副本（默认 canonical） */
const CANONICAL = process.env.JU_W21_CANONICAL
  ? path.resolve(process.env.JU_W21_CANONICAL)
  : path.resolve(STEP9, '..', 'canonical', 'v2.0-t3.html');
const SRC = readFileSync(CANONICAL, 'utf8');

/* ---------- 1) 提取真实产品实现：removeNodeFromMap + mergeRemoteState ---------- */
const M0 = SRC.indexOf('function removeNodeFromMap(map,id){');
const M1 = SRC.indexOf('/* L16-W6 · 指令 6：node→Set(children) 模块级缓存（WeakMap）', M0);
assert.ok(M0 > 0 && M1 > M0, 'canonical 缺 merge 段（removeNodeFromMap … mergeRemoteState）');
const MERGE_SRC = SRC.slice(M0, M1);

/* ---------- 2) 旧口径（改前字节 / 文本还原）：仅微秒归一，秒级原样 ---------- */
function buildBaselineMerge(src) {
  const lines = src.split('\n');
  const h = lines.findIndex((l) => l.includes('const _normToMs='));
  if (h < 0) return src; /* 改前字节：本身即旧口径 */
  let start = h;
  /* 回退整段 L16-W21 说明注释（多行），避免旧口径副本残留未闭合注释 */
  for (let i = h - 1; i >= 0 && i >= h - 4; i--) {
    if (lines[i].includes('/* L16-W21')) { start = i; break; }
  }
  const r = lines.findIndex((l, i) => i > h && l.includes('const remoteUpdatedAt=_normToMs('));
  assert.ok(r === h + 1, 'helper 与 remoteUpdatedAt 邻接口径异常（行 ' + h + '/' + r + '）');
  const out = lines
    .slice(0, start)
    .concat(['  const remoteUpdatedAt=(remote.updatedAt||0);'])
    .concat(['  const _norm=t=>(t>8.64e14)?Math.round(t/1000):t;'])
    .concat(lines.slice(r + 1));
  return out.join('\n').replace(/_normToMs\(/g, '_norm(');
}
const HAS_FIX = MERGE_SRC.includes('const _normToMs=');
const OLD_MERGE_SRC = buildBaselineMerge(MERGE_SRC);
if (HAS_FIX) assert.notEqual(OLD_MERGE_SRC, MERGE_SRC, '旧口径构造失败（改前行未被替换）');

/* 归一函数：从产品字节提取（定义行唯一） */
const NORM_LINE = (MERGE_SRC.match(/^\s*const _normToMs=.*$/m) || [null])[0];
const NORM_FN = NORM_LINE ? new Function(NORM_LINE.replace(/^\s*/, '').replace(/;\s*$/, '') + ';return _normToMs;')() : null;

/* ---------- 3) 最小作用域装配（产品函数体逐字执行 · 每标签独立闭包） ---------- */
function makeTab(initState, opts, mergeSrc) {
  opts = opts || {};
  const factory = new Function(
    'initState',
    'opts',
    `
    let state = initState;
    let _recentlyRemoved = new Map();
    let _tombstoneQueue = [];
    let _tombstoneFifoHead = 0;
    let _diskConfirmed = opts.diskConfirmed ? new Set(opts.diskConfirmed) : null;
    let __juInMerge = false;
    const window = {};
    const _win = window;
    const ui = {};
    let _calIndexCache = null;
    let _calDataRev = 0;
    let _tagIndexCache = null;
    let _searchInverted = null;
    let _backlinkMap = null;
    let _docTitleToDocId = null;
    function _childSetDrop() {}
    function repairTreeConsistency() {}
    function dedupNoteRoots() {}
    function dedupCalRoots() {}
    function reportError() {}
    function markPersistMerged() {}
    function _sideCountsSet() {}
    function _sideCountsRebuild() { return {}; }
    function purgeNodeMeta() {}
    function _tombstoneCompactQueue() {}
    function invalidateCalIndexOnly() {}
    function _tombstoneSet(id, st) {
      const _now = Date.now();
      _recentlyRemoved.set(id, _now);
      _tombstoneQueue.push(id);
      const t = st || state;
      if (t) {
        if (typeof t._tombstones !== 'object' || !t._tombstones) t._tombstones = {};
        t._tombstones[id] = _now;
      }
    }
    ${mergeSrc}
    return {
      state: () => state,
      merge: (remote) => mergeRemoteState(remote),
      del: (id) => removeNodeFromMap(state.nodes, id),
      setDiskFromState: () => { _diskConfirmed = new Set(Object.keys(state.nodes)); },
      disk: () => (_diskConfirmed ? Array.from(_diskConfirmed) : null),
      received: () => (Array.isArray(state._remoteReceived) ? state._remoteReceived.slice() : null),
      ids: () => Object.keys(state.nodes),
      count: () => Object.keys(state.nodes).length,
      tomb: () => Array.from(_recentlyRemoved.keys()),
    };
    `,
  );
  return factory(initState, opts);
}
function tabNew(s, opts) { return makeTab(s, opts || null, MERGE_SRC); }
function tabOld(s, opts) { return makeTab(s, opts || null, OLD_MERGE_SRC); }

/* ---------- 4) 状态构造 ---------- */
function baseState(ts) {
  const T = ts || 1700000000000;
  const st = {
    nodes: {},
    rootId: 'root',
    updatedAt: T,
    trashed: [],
    _localCreated: [],
    _remoteReceived: [],
    _tombstones: {},
  };
  st.nodes.root = { id: 'root', parent: null, children: [], text: 'root', createdAt: T, updatedAt: T };
  return st;
}
function addNode(state, id, parentId, ts, text) {
  const n = { id, parent: parentId, children: [], text: text || id, createdAt: ts, updatedAt: ts };
  state.nodes[id] = n;
  const p = state.nodes[parentId];
  if (p && !p.children.includes(id)) p.children.push(id);
  return n;
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }

/* 决策视图：LWW 裁决结果（存活 id 集 / parent / children / text / _deleted）。
   不比较时间戳原值——本波只统一「比较口径」，不改写已合入节点的原值（数据契约零变更）。 */
function decisionView(st) {
  const ids = Object.keys(st.nodes).sort();
  const shape = {};
  for (const id of ids) {
    const n = st.nodes[id];
    shape[id] = { parent: n.parent, children: (n.children || []).slice(), text: n.text, deleted: !!n._deleted };
  }
  return JSON.stringify({ ids, shape });
}

function checkStructure(st) {
  const ns = st.nodes || {};
  const fails = { I1: 0, I2: 0, I3: 0 };
  for (const id in ns) {
    const n = ns[id];
    if (!n || !Array.isArray(n.children)) continue;
    const seen = new Set();
    for (const cid of n.children) {
      if (typeof cid !== 'string') fails.I1++;
      else if (!ns[cid]) fails.I2++;
      if (seen.has(cid)) fails.I3++;
      seen.add(cid);
    }
  }
  return fails;
}

/* 秒级快照生成：仅当 t 为整千毫秒时无损（本用例的时间戳均按整千构造） */
function toSeconds(st) {
  const c = clone(st);
  const conv = (n) => {
    if (!n || typeof n !== 'object') return;
    if (typeof n.createdAt === 'number') n.createdAt = Math.floor(n.createdAt / 1000);
    if (typeof n.updatedAt === 'number') n.updatedAt = Math.floor(n.updatedAt / 1000);
  };
  for (const id in c.nodes) conv(c.nodes[id]);
  if (typeof c.updatedAt === 'number') c.updatedAt = Math.floor(c.updatedAt / 1000);
  return c;
}
function toMs(st) {
  const c = clone(st);
  const conv = (n) => {
    if (!n || typeof n !== 'object') return;
    if (typeof n.createdAt === 'number') n.createdAt *= 1000;
    if (typeof n.updatedAt === 'number') n.updatedAt *= 1000;
  };
  for (const id in c.nodes) conv(c.nodes[id]);
  if (typeof c.updatedAt === 'number') c.updatedAt *= 1000;
  return c;
}

/* ---------- 5) 结构锚点 ---------- */
describe('L16-W21 §A 结构锚点', () => {
  test('A1: 新增 _normToMs 且含秒 / 微秒 / 原样三分支', () => {
    assert.ok(NORM_LINE, 'canonical 缺 _normToMs 定义');
    assert.ok(/v<1e10/.test(NORM_LINE), '缺秒级分支（v<1e10）');
    assert.ok(/8\.64e14/.test(NORM_LINE), '缺微秒级分支（>8.64e14）');
    assert.ok(/\*1000/.test(NORM_LINE), '秒级分支未乘 1000');
    assert.ok(/\/1000/.test(NORM_LINE), '微秒级分支未除 1000');
  });

  test('A2: merge 段内旧口径 _norm( 调用残留 0', () => {
    const legacyCalls = (MERGE_SRC.match(/\b_norm\(/g) || []).length;
    assert.equal(legacyCalls, 0, '_norm( 残留 ' + legacyCalls + ' 处');
    const newCalls = (MERGE_SRC.match(/\b_normToMs\(/g) || []).length;
    assert.ok(newCalls >= 9, '_normToMs 调用点不足：' + newCalls);
  });

  test('A3: remoteUpdatedAt 与全局 state.updatedAt 同口径归一', () => {
    assert.ok(MERGE_SRC.includes('const remoteUpdatedAt=_normToMs(remote.updatedAt||0);'), 'remoteUpdatedAt 未归一');
    assert.ok(
      MERGE_SRC.includes('const remoteNewer=remoteUpdatedAt>_normToMs(state.updatedAt||0);'),
      '全局元数据 LWW 未同口径归一',
    );
  });

  test('A4: 归一函数位于 merge 作用域内且先于 remoteUpdatedAt', () => {
    const h = MERGE_SRC.indexOf('const _normToMs=');
    const r = MERGE_SRC.indexOf('const remoteUpdatedAt=_normToMs(');
    assert.ok(h > 0 && r > h, '定义顺序异常');
  });
});

/* ---------- 6) 归一函数行为 ---------- */
describe('L16-W21 §B _normToMs 归一', () => {
  const fn = NORM_FN;

  test('B1: 秒级（0<v<1e10）×1000', () => {
    assert.equal(fn(1700000000), 1700000000000);
    assert.equal(fn(1700000000.123), 1700000000123);
    assert.equal(fn(1), 1000);
    assert.equal(fn(9999999999), 9999999999000);
  });

  test('B2: 正常毫秒（1e12~1e13）原样返回（无副作用）', () => {
    for (const t of [1000000000000, 1700000000000, 1900000000000, 9999999999999]) {
      assert.equal(fn(t), t, '毫秒被误归一：' + t);
    }
  });

  test('B3: 微秒级（>8.64e14）÷1000', () => {
    assert.equal(fn(1700000000000000), 1700000000000);
    assert.equal(fn(864000000000001), 864000000000);
  });

  test('B4: 0 / 负值 / NaN 原样（不误判为秒级）', () => {
    assert.equal(fn(0), 0);
    assert.equal(fn(-5), -5);
    assert.ok(Number.isNaN(fn(NaN)));
  });

  test('B5: 幂等（幂等归一不改变二次结果）', () => {
    for (const t of [1700000000, 1700000000000, 1700000000000000, 0]) {
      assert.equal(fn(fn(t)), fn(t), '非幂等：' + t);
    }
  });
});

/* ---------- 7) LWW 行为（秒级对端快照） ---------- */
describe('L16-W21 §C 合并行为', () => {
  test('C1: 对端秒级更新（语义较新）胜出（改前本地旧值保留）', () => {
    const L = 1700000000000;
    const local = baseState(L);
    addNode(local, 'doc', 'root', L, 'local-old');
    local.nodes.doc.children.push('c0');
    addNode(local, 'c0', 'doc', L, 'c0');

    const remoteMs = clone(local);
    remoteMs.updatedAt = L + 5000;
    remoteMs.nodes.doc.updatedAt = L + 5000;
    remoteMs.nodes.doc.text = 'remote-new';
    const remote = toSeconds(remoteMs);

    const cur = tabNew(clone(local));
    cur.merge(clone(remote));
    assert.equal(cur.state().nodes.doc.text, 'remote-new', '秒级对端更新未胜出（Defect-C 未修复）');

    const old = tabOld(clone(local));
    old.merge(clone(remote));
    assert.equal(old.state().nodes.doc.text, 'local-old', '旧口径应保留本地（红证口径失效）');
  });

  test('C2: 对端秒级删除传播（语义较新且缺节点 → 本地删除）', () => {
    const L = 1700000000000;
    const local = baseState(L);
    addNode(local, 'doc', 'root', L, 'doc');
    addNode(local, 'gone', 'doc', L, 'gone');
    local._remoteReceived = ['gone'];
    local._localCreated = [];

    const remote = toSeconds(local);
    remote.updatedAt = L + 5000;
    remote.nodes.doc.updatedAt = L + 5000;
    delete remote.nodes.gone;
    remote.nodes.doc.children = remote.nodes.doc.children.filter((c) => c !== 'gone');

    const cur = tabNew(clone(local), { diskConfirmed: ['doc', 'gone'] });
    cur.merge(clone(remote));
    assert.equal(cur.state().nodes.gone, undefined, '秒级对端删除未传播');
  });

  test('C3: 本地毫秒较新时仍胜（反向护栏）', () => {
    const L = 1700000000000;
    const local = baseState(L + 5000);
    addNode(local, 'doc', 'root', L + 5000, 'local-new');

    const remote = toSeconds(baseState(L));
    remote.nodes.doc = { id: 'doc', parent: 'root', children: [], text: 'remote-old', createdAt: L / 1000, updatedAt: L / 1000 };
    remote.nodes.root.children.push('doc');

    for (const t of [tabNew(clone(local)), tabOld(clone(local))]) {
      t.merge(clone(remote));
      assert.equal(t.state().nodes.doc.text, 'local-new', '本地较新不应被秒级旧快照覆盖');
    }
  });

  test('C4: 微秒级分支不回归', () => {
    const L = 1700000000000;
    const local = baseState(L);
    addNode(local, 'doc', 'root', L, 'local');

    const remote = clone(local);
    remote.updatedAt = (L + 5000) * 1000;
    remote.nodes.doc.updatedAt = (L + 5000) * 1000;
    remote.nodes.doc.text = 'micro-new';

    const cur = tabNew(clone(local));
    cur.merge(remote);
    assert.equal(cur.state().nodes.doc.text, 'micro-new', '微秒级对端更新未胜出');
  });

  test('C5: 墓碑守卫保持（删除前旧快照不复活节点）', () => {
    const L = 1700000000000;
    const local = baseState(L);
    addNode(local, 'doc', 'root', L, 'doc');
    const t = tabNew(clone(local));
    t.del('doc');
    const stale = toSeconds(baseState(L - 1000));
    stale.nodes.doc = { id: 'doc', parent: 'root', children: [], text: 'doc', createdAt: (L - 1000) / 1000, updatedAt: (L - 1000) / 1000 };
    stale.nodes.root.children.push('doc');
    stale.updatedAt = (L - 1000) / 1000;
    t.merge(clone(stale));
    assert.equal(t.state().nodes.doc, undefined, '删除前旧快照复活了节点');
  });
});

/* ---------- 8) 属性采样（property.clean） ---------- */
function propertyClean(mergeSrc) {
  const ITER = 200;
  const invFails = { I1: 0, I2: 0, I3: 0 };
  let legacyScenarios = 0;
  for (let i = 0; i < ITER; i++) {
    const legacy = i > 0 && i % 9 === 0; /* 22/200 = 秒级对端快照（旧客户端占比） */
    if (legacy) legacyScenarios++;
    const L = 1700000000000 + i * 1000; /* 整千毫秒：秒级往返无损 */
    const R = L + 5000;                  /* 对端语义上较新 */

    const local = baseState(L);
    addNode(local, 'doc', 'root', L, 'local-' + i);
    addNode(local, 'c0', 'doc', L, 'c0');
    addNode(local, 'c1', 'doc', L, 'c1');
    local._remoteReceived = ['c0', 'c1'];

    const remoteMs = clone(local);
    remoteMs.updatedAt = R;
    remoteMs.nodes.doc.updatedAt = R;
    remoteMs.nodes.doc.text = 'remote-' + i;
    delete remoteMs.nodes.c1;
    remoteMs.nodes.doc.children = remoteMs.nodes.doc.children.filter((c) => c !== 'c1');
    const remote = legacy ? toSeconds(remoteMs) : remoteMs;

    /* 被测：原样合入 */
    const a = makeTab(clone(local), { diskConfirmed: ['root', 'doc', 'c0', 'c1'] }, mergeSrc);
    a.merge(clone(remote));

    /* oracle：等价毫秒快照合入（单位无关的应有结果；毫秒场景即原样快照） */
    const b = makeTab(clone(local), { diskConfirmed: ['root', 'doc', 'c0', 'c1'] }, mergeSrc);
    b.merge(legacy ? toMs(remote) : clone(remote));

    const s = checkStructure(a.state());
    if (s.I1) invFails.I1++;
    if (s.I2) invFails.I2++;
    if (s.I3) invFails.I3++;

    /* I2 = 单位不变性：秒级合入须与同值毫秒合入产生同一 LWW 裁决 */
    if (decisionView(a.state()) !== decisionView(b.state())) invFails.I2++;

    /* I3 += 毫秒域原样（对端毫秒时间戳不被改写） */
    if (!legacy && a.state().nodes.doc.updatedAt !== R) invFails.I3++;
  }
  return { iterations: ITER, legacyScenarios, invFails };
}

describe('L16-W21 §D 属性采样 property.clean', () => {
  test('D1: 旧口径复现 I2 = 22（红证判别力）', () => {
    const old = propertyClean(OLD_MERGE_SRC);
    console.log('[L16-W21] baseline property.clean=' + JSON.stringify(old));
    assert.equal(old.legacyScenarios, 22, '秒级场景数应为 22');
    assert.equal(old.invFails.I1, 0, '结构 I1 不应失败');
    assert.equal(old.invFails.I2, 22, '旧口径 I2 应为 22（实测 ' + old.invFails.I2 + '）');
  });

  test('D2: 现行口径 property.clean.invFails.I2 = 0', () => {
    const cur = propertyClean(MERGE_SRC);
    console.log('[L16-W21] property.clean=' + JSON.stringify(cur));
    assert.equal(cur.legacyScenarios, 22);
    assert.equal(cur.invFails.I1, 0);
    assert.equal(cur.invFails.I2, 0, 'I2 未清零：' + cur.invFails.I2);
    assert.equal(cur.invFails.I3, 0, 'I3 未清零：' + cur.invFails.I3);
  });
});

/* ---------- 9) 大 state P95 ---------- */
describe('L16-W21 §E 大 state 采样', () => {
  test('E1: 20,001 节点 / 秒级对端快照 —— merge P95 采样', () => {
    const PARENTS = 200;
    const PER = 100;
    const L = 1700000000000;
    const build = () => {
      const st = baseState(L);
      for (let p = 0; p < PARENTS; p++) {
        const pid = 'p' + p;
        st.nodes[pid] = { id: pid, parent: 'root', children: [], text: pid, createdAt: L, updatedAt: L };
        st.nodes.root.children.push(pid);
        for (let c = 0; c < PER; c++) {
          const cid = pid + 'c' + c;
          st.nodes[cid] = { id: cid, parent: pid, children: [], text: cid, createdAt: L, updatedAt: L };
          st.nodes[pid].children.push(cid);
        }
      }
      return st;
    };
    const local = build();
    const remoteMs = clone(local);
    remoteMs.updatedAt = L + 5000;
    for (let p = 0; p < PARENTS; p++) {
      const pid = 'p' + p;
      remoteMs.nodes[pid].updatedAt = L + 5000;
      remoteMs.nodes[pid].text = 'remote-' + p;
      const cid = pid + 'c' + (PER - 1);
      delete remoteMs.nodes[cid];
      remoteMs.nodes[pid].children = remoteMs.nodes[pid].children.filter((c) => c !== cid);
    }
    const remote = toSeconds(remoteMs);

    /* ISSUE-005（review11-05）：绝对墙钟预算 200ms 在本机 P95 实测 186–238ms，同一文件 3 次
       取样 2 绿 1 红 ⇒ 判定不可复现。改为主判据「相对本机同轮中位数 +100%」+ 600ms 绝对兜底
       （防整体退化被中位数同步抬高；实测 P95/P50 = 1.08–1.34）。冷机/空载条件：无其它
       Electron 重载、无并发构建；重试语义与语义断言不变。 */
    const BUDGET_MS = 600;
    const BUDGET_REL = 2;
    const ATTEMPTS = 3;
    const SAMPLES = 12;
    const measured = [];
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const times = [];
      for (let i = 0; i < SAMPLES; i++) {
        const t = tabNew(clone(local), { diskConfirmed: Object.keys(local.nodes) });
        const t0 = process.hrtime.bigint();
        t.merge(clone(remote));
        const t1 = process.hrtime.bigint();
        times.push(Number(t1 - t0) / 1e6);
        assert.equal(t.state().nodes.p0.text, 'remote-0', '秒级对端更新未胜出（大 state）');
        assert.equal(t.state().nodes['p0c' + (PER - 1)], undefined, '秒级对端删除未传播（大 state）');
        assert.equal(t.count(), PARENTS + PARENTS * PER - PARENTS + 1, '节点数正确');
      }
      times.sort((a, b) => a - b);
      const p95 = times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)];
      const p50 = times[Math.floor((times.length - 1) / 2)];
      const limit = Math.min(BUDGET_MS, p50 * BUDGET_REL);
      measured.push(p95);
      console.log('[L16-W21] merge(20,001 nodes / second-unit remote) P95 = ' + p95.toFixed(2) + ' ms'
        + '（P50 ' + p50.toFixed(2) + ' ms，上限 ' + limit.toFixed(2) + ' ms，attempt ' + attempt + '/' + ATTEMPTS + '）');
      if (p95 <= limit) return;
    }
    assert.ok(false, 'merge P95 超上限（连续 ' + ATTEMPTS + ' 次采样均超「P50 × ' + BUDGET_REL + ' 与 ' + BUDGET_MS + ' ms 取较小者」）：'
      + measured.map((v) => v.toFixed(2)).join(' / ') + ' ms');
  });
});
