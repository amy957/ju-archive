/**
 * L16-W3 · 指令 3「renderSidebar 全表扫描改为增量计数」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：renderSidebar 原每次渲染对 state.nodes 全表扫描（O(n)）求
 *           starred / docCount / dbRoot（再由 dbRoot.children.length 得 dbCount）。
 *           本波改为「增量计数」：计数对象挂载于 state（Symbol 键 ⇒ 序列化不可见），
 *           由 commit / undo / redo 在 L6 收口按「变更节点增量」维护；initStore /
 *           mergeRemoteState 等整体替换处整体重建；renderSidebar 直接读取（O(1)）。
 * 断言口径（确定性 · 无 wall-clock 阈值敏感，承接 L16-W1/W2 范式）：
 *   A. 结构锚点：canonical 具备 Symbol 计数挂载 + 增量/重建辅助；renderSidebar 经
 *      _sideCountsGet 读取；commit/undo/redo/initStore/mergeRemoteState 接入维护；
 *   B. 序列化契约：Symbol 计数对 JSON.stringify 不可见（store / 加密 payload 形状零变更）；
 *   C. 重建口径 = 原全表循环逐字等价（多组 state）；
 *   D. 增量口径 = 重建口径（star / 增删 / 跨根移动 / dbRoot / dbCount 变更序列）；
 *   E. 降级路径保留：renderSidebar 仍含 __l14SideScanEnsure() 与全表循环兜底分支。
 * 运行：`node --test l9/t16-w3-sidebar-counts.test.mjs`（Node >= 22）
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

/* 从 canonical 提取真实产品实现（辅助函数整段），装配进最小作用域。 */
const BLOCK = SRC.match(/const _SIDECOUNTS=Symbol\('_sidebarCounts'\);[\s\S]*?\n(?=\/\* extractChangedIds)/);
assert.ok(BLOCK, 'canonical 缺少 L16-W3 侧栏计数辅助段');
const HARNESS_SRC = BLOCK[0] + '\nreturn {_sideCount,_sideCountsFinalize,_sideCountsRebuild,_sideCountsApply,_sideCountsGet,_sideCountsSet,_sideCountsEnsure,_SIDECOUNTS};';
const H = new Function(HARNESS_SRC)();

/* 原 renderSidebar 全表循环的等价参照实现（口径基准，仅测试内） */
function refCounts(s) {
  const root = s.nodes[s.rootId];
  let starred = 0, docCount = 0, dbRoot = null;
  const rootChildSet = new Set(root ? root.children : []);
  for (const id in s.nodes) {
    const n = s.nodes[id];
    if (!n || n._deleted || n.id === s.rootId) continue;
    if (n.starred > 0 && !n._isFolder && !n._isDbRoot && !n._isCalRoot) starred++;
    if (rootChildSet.has(id)) {
      if (n._isDbRoot) dbRoot = n;
      else if (!n._isCalRoot) docCount++;
    }
  }
  return { starred, docCount, dbRootId: dbRoot ? dbRoot.id : null, dbCount: dbRoot ? dbRoot.children.length : 0 };
}

/* 构造一组一致（parent/children 互反）的 state。 */
function mkState(spec) {
  const s = { rootId: 'root', nodes: {} };
  s.nodes.root = { id: 'root', parent: null, children: [] };
  const add = (id, parentId, extra) => {
    const n = Object.assign({ id, parent: parentId, children: [], createdAt: 1, updatedAt: 1 }, extra || {});
    s.nodes[id] = n;
    s.nodes[parentId].children.push(id);
    return id;
  };
  for (const d of spec) {
    if (d.type === 'doc') add(d.id, 'root', { text: d.id, starred: d.starred || 0 });
    else if (d.type === 'sub') add(d.id, d.parent, { text: d.id, _isFolder: true, starred: d.starred || 0 });
    else if (d.type === 'leaf') add(d.id, d.parent, { text: d.id, starred: d.starred || 0 });
    else if (d.type === 'dbroot') add(d.id, 'root', { text: d.id, _isDbRoot: true, _isFolder: true });
    else if (d.type === 'dbtable') add(d.id, d.parent, { text: d.id });
    else if (d.type === 'calroot') add(d.id, 'root', { text: d.id, _isCalRoot: true, _isFolder: true });
  }
  return s;
}

const BASE_SPEC = [
  { type: 'doc', id: 'd1', starred: 4 },
  { type: 'doc', id: 'd2', starred: 0 },
  { type: 'doc', id: 'd3', starred: 2 },
  { type: 'sub', id: 's1', parent: 'd1', starred: 3 },     /* 文件夹（不计 starred / docCount） */
  { type: 'leaf', id: 'l1', parent: 's1', starred: 5 },    /* 文档内节点（非根子，不计 docCount） */
  { type: 'dbroot', id: 'db' },
  { type: 'dbtable', id: 't1', parent: 'db' },
  { type: 'dbtable', id: 't2', parent: 'db' },
  { type: 'calroot', id: 'cal' },
];

describe('L16-W3 §A 结构锚点', () => {
  test('canonical 具备 Symbol 计数挂载与增量/重建辅助', () => {
    assert.ok(SRC.includes("const _SIDECOUNTS=Symbol('_sidebarCounts')"), '缺 Symbol 计数挂载');
    assert.ok(SRC.includes('function _sideCountsRebuild('), '缺 _sideCountsRebuild');
    assert.ok(SRC.includes('function _sideCountsApply('), '缺 _sideCountsApply');
    assert.ok(SRC.includes('function _sideCountsGet('), '缺 _sideCountsGet');
  });

  test('renderSidebar 经 _sideCountsGet 读取，删除直读全表循环（保留降级分支）', () => {
    const rs = SRC.match(/function renderSidebar\(\)\{[\s\S]*?\n\}/);
    assert.ok(rs, 'canonical 缺少 renderSidebar');
    const body = rs[0];
    assert.ok(body.includes('_sideCountsGet(state)'), 'renderSidebar 未读取增量计数');
    /* 主路径不再直接遍历全表（for(const id in state.nodes) 仅应出现在 !__l14On 降级分支内） */
    assert.ok(body.includes('__l14SideScanEnsure()'), 'renderSidebar 缺 __l14SideScanEnsure 降级');
    assert.ok(body.includes('for(const id in state.nodes)'), 'renderSidebar 缺全表循环兜底分支');
  });

  test('commit / undo / redo / initStore / mergeRemoteState 接入计数维护', () => {
    assert.ok(/function commit\(action[\s\S]*?状态零变更|function commit\(action/.test(SRC));
    const commitBody = SRC.match(/function commit\(action[\s\S]*?\n\}\nfunction subscribe/);
    assert.ok(commitBody && commitBody[0].includes('_sideCountsApply'), 'commit 未接入增量维护');
    const undoBody = SRC.match(/function undo\(\)\{[\s\S]*?\n\}\nfunction redo/);
    assert.ok(undoBody && undoBody[0].includes('_sideCountsApply'), 'undo 未接入反向增量');
    const redoBody = SRC.match(/function redo\(\)\{[\s\S]*?\n\}\n\/\* =+[\s\S]*?Actions/);
    assert.ok(redoBody && redoBody[0].includes('_sideCountsApply'), 'redo 未接入前向增量');
    const initBody = SRC.match(/function initStore\(initial\)\{[\s\S]*?\n\}/);
    assert.ok(initBody && initBody[0].includes('_sideCountsRebuild'), 'initStore 未整体重建');
    assert.ok(SRC.includes("try{_sideCountsSet(state,_sideCountsRebuild(state));}catch(_e){}"), 'mergeRemoteState 未整体重建');
  });
});

describe('L16-W3 §B 序列化契约（Symbol 计数对 JSON 不可见）', () => {
  test('挂载计数后 JSON.stringify(state) 不含计数字段', () => {
    const s = mkState(BASE_SPEC);
    H._sideCountsSet(s, H._sideCountsRebuild(s));
    const json = JSON.stringify(s);
    assert.ok(json.indexOf('_sidebarCounts') === -1, 'JSON 泄漏 Symbol 名描述');
    assert.ok(json.indexOf('docRootId') === -1 && json.indexOf('"dbRootId"') === -1, 'JSON 泄漏 dbRootId');
    assert.ok(json.indexOf('"_sidebarCounts"') === -1, 'JSON 出现 _sidebarCounts 键');
    /* for..in 不可见 */
    let seen = false;
    for (const k in s) { if (k === '_sidebarCounts') seen = true; }
    assert.equal(seen, false, 'for..in 可见 Symbol 计数（不应发生）');
    /* 但 Symbol 读取可用 */
    assert.ok(H._sideCountsGet(s) && H._sideCountsGet(s).starred === refCounts(s).starred);
  });
});

describe('L16-W3 §C 重建口径 = 原全表循环', () => {
  const cases = [
    ['基础集', BASE_SPEC],
    ['无 dbRoot', BASE_SPEC.filter(d => d.type !== 'dbroot' && d.type !== 'dbtable')],
    ['无星标', BASE_SPEC.map(d => Object.assign({}, d, { starred: 0 }))],
    ['空库', []],
  ];
  for (const [name, spec] of cases) {
    test(name + '：_sideCountsRebuild == 全表循环参照', () => {
      const s = mkState(spec);
      assert.deepEqual(H._sideCountsRebuild(s), refCounts(s));
    });
  }
});

describe('L16-W3 §D 增量口径 = 重建口径（脚本化变更序列）', () => {
  test('star / 增删 / 跨根移动 / dbRoot / dbCount 序列一致', () => {
    let s = mkState(BASE_SPEC);
    const acc0 = H._sideCountsRebuild(s);
    assert.deepEqual(acc0, refCounts(s));
    H._sideCountsSet(s, acc0); /* 初始挂载（模拟 initStore 整体重建） */

    const step = (mutate, ids) => {
      const old = s;
      const next = structuredClone(s);
      mutate(next);
      const base = H._sideCountsGet(old);
      const applied = H._sideCountsApply(base, old, next, new Set(ids));
      s = next;
      H._sideCountsSet(s, applied);
      assert.deepEqual(applied, refCounts(s), '增量 != 全表参照（changedIds=' + ids.join(',') + '）');
    };

    /* 1) 星标 d2 */
    step(x => { x.nodes.d2.starred = 5; x.nodes.d2.updatedAt++; }, ['d2']);
    /* 2) 取消星标 d3 */
    step(x => { x.nodes.d3.starred = 0; x.nodes.d3.updatedAt++; }, ['d3']);
    /* 3) 根下新增文档 */
    step(x => { x.nodes.d4 = { id: 'd4', parent: 'root', children: [], text: 'd4', starred: 0, createdAt: 2, updatedAt: 2 }; x.nodes.root.children.push('d4'); }, ['d4', 'root']);
    /* 4) dbRoot 下新增表（dbCount 变化；dbRootId 经 children 路径进入 changedIds） */
    step(x => { x.nodes.t3 = { id: 't3', parent: 'db', children: [], text: 't3', createdAt: 3, updatedAt: 3 }; x.nodes.db.children.push('t3'); }, ['t3', 'db']);
    /* 5) 删除根下文档 d4 */
    step(x => { delete x.nodes.d4; x.nodes.root.children = x.nodes.root.children.filter(c => c !== 'd4'); }, ['d4', 'root']);
    /* 6) 跨根移动：d2 从 root 移入 s1（docCount-1） */
    step(x => {
      x.nodes.root.children = x.nodes.root.children.filter(c => c !== 'd2');
      x.nodes.s1.children.push('d2'); x.nodes.d2.parent = 's1'; x.nodes.d2.updatedAt++;
    }, ['d2', 'root', 's1']);
    /* 7) 跨根移回：d2 从 s1 回到 root（docCount+1） */
    step(x => {
      x.nodes.s1.children = x.nodes.s1.children.filter(c => c !== 'd2');
      x.nodes.root.children.push('d2'); x.nodes.d2.parent = 'root'; x.nodes.d2.updatedAt++;
    }, ['d2', 'root', 's1']);
    /* 8) 软删 s1 子树顶部（s1 有 star 不计；其子 l1 带 star → starred-1） */
    step(x => { x.nodes.l1._deleted = true; }, ['l1']);
    /* 9) 新建 dbRoot（原 db 仍在 → 末位覆盖；比较对象 id） */
    step(x => { x.nodes.db2 = { id: 'db2', parent: 'root', children: [], text: 'db2', _isDbRoot: true, _isFolder: true, createdAt: 4, updatedAt: 4 }; x.nodes.root.children.push('db2'); }, ['db2', 'root']);
    /* 10) 删除 dbRoot db */
    step(x => { delete x.nodes.db; x.nodes.root.children = x.nodes.root.children.filter(c => c !== 'db'); delete x.nodes.t1; delete x.nodes.t2; delete x.nodes.t3; }, ['db', 'root', 't1', 't2', 't3']);
  });
});

describe('L16-W3 §E 降级兜底', () => {
  test('_sideCountsEnsure：缺失时重建挂载，存在时幂等', () => {
    const s = mkState(BASE_SPEC);
    assert.equal(H._sideCountsGet(s), undefined, '初始应无计数');
    const a = H._sideCountsEnsure(s);
    assert.deepEqual(a, refCounts(s));
    const b = H._sideCountsEnsure(s);
    assert.equal(a, b, 'Ensure 应幂等（已挂载不重建）');
  });
});
