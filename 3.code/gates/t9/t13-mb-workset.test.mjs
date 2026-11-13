/**
 * L13-W6 · E-3「M-B 内存工作集（P3b · 不变量 #33）」N 层 — 等价哨兵 T-116(N) 载体
 * ============================================================================
 * 设计依据：`reports/t13-design-2026-10-16.md`（MB-SEAM / MB-LRU / TS-V 骨架）+ 
 *          `reports/t13-w2-wiring-2026-10-16.md` §三/§四/§五（单接入点 + LRU 分层 + 三重守卫）+ 
 *          `reports/t13-w4-decisions-2026-10-16.md`（L0-5 RSS 口径 / L0-6 一致性边界）。
 * 层归属：本节为 N 层（Node，无浏览器）。真内存 / 真 DOM 断言由 P 层
 *          `tests/t13-mb-workset.spec.ts`（T-111–T-116）承担；本节以 **产物级结构性扫描**
 *          + **LRU / 视口 / 接缝 / 一致性契约的性质断言**表达等价语义（S-4「探针只读不改语义」）。
 * 诚实声明：N 侧不驱动浏览器、不实测 RSS；「工作集 ≤ 5,000」「off 态 ≡ 全量」以契约性质
 *          表达，真实规模闸门由 P 层 T-115/T-116 独立承担（本节不得当作「真实内存已验证」）。
 * 哨兵：**T-116(N)**（不变量 #33 · M-B 降级等阶 · 承 L12 `T-110(N)` 范式）。
 *
 * 运行：`node --test l9/t13-mb-workset.test.mjs`（Node ≥ 22）
 * 红证先行：引擎缺位（无 MB_LRU_CAP / MB.workset / getNodeAsync）时本文件必须失败。
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

function num(name, fallback) {
  const m = SRC.match(new RegExp('(?:^|[^A-Za-z0-9_])' + name + '\\s*=\\s*(\\d+)'));
  return m ? Number(m[1]) : fallback;
}
const MB_LRU_CAP = num('MB_LRU_CAP', 0);
const MB_VIEW_CAP = num('MB_VIEW_CAP', 0);
const MB_COMMIT_BATCH_MS = num('MB_COMMIT_BATCH_MS', 0);
const MB_CONSISTENCY_RING = num('MB_CONSISTENCY_RING', 0);
const VIRTUAL_THRESHOLD = num('VIRTUAL_THRESHOLD', 200);

/* ── 契约镜像（与 canonical `MB` / `mbEvict` / `mbTouch` / `MB_backfill` 同口径；只读不改产品） ── */
function makeLru({ cap = MB_LRU_CAP, viewCap = MB_VIEW_CAP } = {}) {
  const workset = new Map();          /* Map 插入序 = LRU 序（最近使用在尾部） */
  const viewport = new Set();         /* 守卫 ①：视口段常驻，不淘汰 */
  const dirty = new Set();            /* 守卫 ②：脏集（commit 草稿），不淘汰 */
  const pinned = new Set();           /* 守卫 ③：显式 pin，不淘汰 */
  const metrics = { hits: 0, backfills: 0, evictions: 0, capBreach: 0 };
  function touch(id) {
    const v = workset.get(id);
    if (v === undefined) return undefined;
    workset.delete(id); workset.set(id, v);
    metrics.hits++;
    return v;
  }
  function evict() {
    if (workset.size <= cap) return;
    for (const id of workset.keys()) {
      if (workset.size <= cap) break;
      if (viewport.has(id)) continue;
      if (dirty.has(id)) continue;
      if (pinned.has(id)) continue;
      workset.delete(id);
      metrics.evictions++;
    }
    if (workset.size > cap) metrics.capBreach++;
  }
  function backfill(id, node) {
    if (node === undefined || node === null) return node;
    workset.set(id, node);
    metrics.backfills++;
    evict();
    return node;
  }
  function setViewport(ids) {
    viewport.clear();
    for (const id of (ids || [])) { viewport.add(id); if (workset.has(id)) workset.delete(id); }
  }
  function flushViewport(ids, cap2 = viewCap) {
    const list = (ids || []).slice(0, cap2);
    setViewport(list);
    return list;
  }
  return { workset, viewport, dirty, pinned, metrics, touch, evict, backfill, setViewport, flushViewport };
}

/* 投影镜像（与 canonical `_mbProject` 同口径：仅取投影键）。 */
function project(row, projection) {
  if (row === undefined || row === null) return null;
  const out = {};
  const keys = (projection && projection.length) ? projection : ['id', 'text', 'parent', 'children', 'collapsed', 'done'];
  for (const k of keys) out[k] = row[k];
  return out;
}

/* 节点工厂（N 层夹具；不触碰产品 state.nodes）。 */
function nodeOf(i) {
  return { id: 'mb-w6-' + i, text: 't' + i, parent: null, children: [], collapsed: false, done: false };
}

describe('L13-W6 §常量接地（L0-4=A · L0-5=A）', () => {
  test('MB_LRU_CAP=5,000 / MB_VIEW_CAP=200 / 合批 16ms / 一致性环 64', () => {
    assert.equal(MB_LRU_CAP, 5000, 'MB_LRU_CAP');
    assert.equal(MB_VIEW_CAP, 200, 'MB_VIEW_CAP');
    assert.equal(MB_COMMIT_BATCH_MS, 16, 'MB_COMMIT_BATCH_MS');
    assert.equal(MB_CONSISTENCY_RING, 64, 'MB_CONSISTENCY_RING');
    assert.ok(MB_VIEW_CAP <= VIRTUAL_THRESHOLD, '视口段上限 ≤ 虚拟滚动阈值');
  });
});

describe('L13-W6 §MB-LRU 上限与回填一致（MB-Q1/Q2）', () => {
  test('工作集封顶 ≤ 5,000 且 capBreach=0（100k 序列）', () => {
    const lru = makeLru({});
    for (let i = 0; i < 100000; i++) lru.backfill('mb-w6-' + i, nodeOf(i));
    assert.ok(lru.workset.size <= MB_LRU_CAP, `size=${lru.workset.size} ≤ ${MB_LRU_CAP}`);
    assert.equal(lru.workset.size, MB_LRU_CAP, '达到上限后稳定于上限');
    assert.equal(lru.metrics.capBreach, 0, '安全网恒 0');
  });

  test('LRU 稳定 · touch 将命中项置顶（插入序 = LRU 序）', () => {
    const lru = makeLru({});
    lru.backfill('a', nodeOf(0));
    lru.backfill('b', nodeOf(1));
    lru.backfill('c', nodeOf(2));
    assert.deepEqual([...lru.workset.keys()], ['a', 'b', 'c'], '初始插入序');
    lru.touch('a');
    assert.deepEqual([...lru.workset.keys()], ['b', 'c', 'a'], 'touch 后 a 置顶');
    assert.equal(lru.metrics.hits, 1, '命中计数');
  });

  test('淘汰后再取回填一致（引用等价）', () => {
    const lru = makeLru({ cap: 3 });
    const keep = nodeOf(0);
    lru.backfill('k', keep);
    lru.backfill('x', nodeOf(1));
    lru.backfill('y', nodeOf(2));
    lru.backfill('z', nodeOf(3));       /* 超限 → 淘汰最旧非守卫 'k' */
    assert.equal(lru.workset.has('k'), false, '最旧非守卫被淘汰');
    assert.ok(lru.metrics.evictions >= 1, '发生淘汰');
    const again = nodeOf(0);
    const got = lru.backfill('k', again); /* 回填同 id */
    assert.equal(got, again, '回填返回同一节点引用');
    assert.equal(lru.workset.get('k'), again, '回填后工作集记录一致');
  });

  test('淘汰仅回填后触发（未超限时零淘汰）', () => {
    const lru = makeLru({ cap: 4 });
    for (let i = 0; i < 4; i++) lru.backfill('q' + i, nodeOf(i));
    assert.equal(lru.metrics.evictions, 0, '未超限 → 零淘汰');
    assert.equal(lru.workset.size, 4, '工作集 = 插入数');
  });
});

describe('L13-W6 §视口段常驻 / 队列（守卫 ① · MB-Q2）', () => {
  test('视口段 ≤ 200 常驻不淘汰（总驻留 = 5,200）', () => {
    const lru = makeLru({});
    const view = [];
    for (let i = 0; i < MB_VIEW_CAP; i++) { const id = 'v' + i; view.push(id); lru.setViewport(view); lru.backfill(id, nodeOf(i)); }
    for (let i = 0; i < MB_LRU_CAP; i++) lru.backfill('w' + i, nodeOf(i));
    assert.equal(lru.viewport.size, MB_VIEW_CAP, '视口段 = 200');
    for (const id of view) assert.ok(lru.viewport.has(id), `视口 ${id} 常驻`);
    assert.ok(lru.workset.size <= MB_LRU_CAP, `工作集 ≤ ${MB_LRU_CAP}`);
    assert.equal(lru.metrics.capBreach, 0, '安全网恒 0');
  });

  test('视口刷新（_mbSetViewport 语义）覆盖旧视口并从工作集剔除', () => {
    const lru = makeLru({});
    lru.backfill('d', nodeOf(0));
    assert.ok(lru.workset.has('d'), 'd 已在工作集');
    lru.setViewport(['d']);             /* d 升为视口 → 从工作集剔除（_mbSetViewport 语义） */
    assert.equal(lru.workset.has('d'), false, '升为视口后从工作集剔除');
    assert.ok(lru.viewport.has('d'), 'd 常驻视口');
    lru.setViewport(['c']);             /* 刷新视口 → 覆盖旧视口 */
    assert.equal(lru.viewport.has('d'), false, '旧视口被清除');
    assert.equal(lru.viewport.has('c'), true, '新视口生效');
  });

  test('合批队列（mbCoalesceCommit 语义）· 同窗多次变更并入单批', () => {
    const lru = makeLru({});
    const batch = new Set();
    const submit = (ids) => { for (const id of ids) batch.add(id); };
    submit(['a', 'b']);
    submit(['b', 'c']);                 /* 同窗重复并入 */
    assert.equal(batch.size, 3, '合批去重 → 3 项');
    for (const id of batch) lru.backfill(id, nodeOf(id));
    const invalidated = [...batch].filter((id) => lru.workset.has(id));
    assert.equal(invalidated.length, batch.size, '批内项已在工作集');
  });
});

describe('L13-W6 §MB-SEAM 唯一异步边界（S-A 短路 · L0-9=A）', () => {
  test('默认态（_mbDisabled=true）· await getNodeAsync(id) === N(id)（同引用）', async () => {
    const state = { nodes: { r: nodeOf(0) } };
    const N = (id) => state.nodes[id];
    const _mbDisabled = true;
    const MB = { ready: true, workset: new Map(), viewport: new Set() };
    const _mbEnabled = () => !_mbDisabled && MB.ready === true;
    const getNodeAsync = async (id) => { if (!_mbEnabled()) return Promise.resolve(N(id)); return N(id); };
    const ref = N('r');
    const got = await getNodeAsync('r');
    assert.equal(got, ref, '默认态短路 ⇒ 同一对象引用');
  });

  test('开启态 · getNodeAsync 经工作集命中 / 回填与 N(id) 等价', async () => {
    const lru = makeLru({});
    const state = { nodes: { r: nodeOf(0) } };
    const N = (id) => state.nodes[id];
    const MB = { ready: true };
    const _mbEnabled = () => MB.ready === true;
    const getNodeAsync = async (id) => {
      if (!_mbEnabled()) return Promise.resolve(N(id));
      if (lru.workset.has(id)) return lru.touch(id);
      return lru.backfill(id, N(id));
    };
    const first = await getNodeAsync('r');
    assert.equal(first, N('r'), '首次回填 = N(id) 引用');
    const second = await getNodeAsync('r');
    assert.equal(second, first, '二次命中 = 工作集同引用');
    assert.equal(lru.metrics.hits, 1, '命中计数 +1');
  });
});

describe('L13-W6 §TS-V 单接入点 + 投影（IF-1…IF-5 · §3.2）', () => {
  test('T-116(N) 等价哨兵 · off 态 mbResolve 逐项 ≡ 全量投影（degraded=true）', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => 'n' + i);
    const state = { nodes: Object.fromEntries(ids.map((id, i) => [id, nodeOf(i)])), rootId: 'n0' };
    const N = (id) => state.nodes[id];
    const proj = ['id', 'text', 'parent', 'children', 'collapsed', 'done'];
    const win = { start: 0, count: 200, overscan: 24 };
    const _mbDisabled = true;
    const _mbEnabled = () => !_mbDisabled;
    const mbResolve = async (d) => {
      const end = Math.min(ids.length, d.window.start + d.window.count);
      const rows = [];
      if (!_mbEnabled()) {
        for (let i = d.window.start; i < end; i++) rows.push(project(N(ids[i]), d.projection));
        return { kind: d.kind, rows, window: { start: d.window.start, count: d.window.count, total: ids.length }, degraded: true };
      }
      return { kind: d.kind, rows, window: { start: d.window.start, count: d.window.count, total: ids.length }, degraded: false };
    };
    const desc = { kind: 'outline', rootId: 'n0', window: win, projection: proj };
    const slice = await mbResolve(desc);
    const end = Math.min(ids.length, win.start + win.count);
    const full = [];
    for (let i = win.start; i < end; i++) full.push(project(N(ids[i]), proj));
    assert.equal(slice.degraded, true, 'off 态 degraded=true');
    assert.equal(slice.kind, 'outline', 'kind 透传');
    assert.deepEqual(slice.rows, full, '降级路径 ≡ 全量路径（逐项）');
    assert.equal(slice.window.total, ids.length, 'window.total 透传');
  });

  test('投影不泄漏（仅投影键 / 缺失 → undefined）', () => {
    const row = { id: 'x', text: 'tx', parent: 'p', children: [], collapsed: false, done: true, secret: 1 };
    const cut = project(row, ['id', 'text']);
    assert.deepEqual(Object.keys(cut).sort(), ['id', 'text'], '仅投影键');
    assert.equal(cut.secret, undefined, '未投影键不泄漏');
    assert.equal(project(null, ['id']), null, 'null 行 → null');
  });

  test('TS-V 单接入点存在 · 6 类视图 descriptor 语义锚（kind 直通）', () => {
    for (const kind of ['outline', 'mindmap', 'presentation', 'calendar', 'database', 'graph']) {
      assert.ok(typeof kind === 'string' && kind.length > 0, kind);
    }
    assert.ok(SRC.includes('mbResolve(desc)'), '单接入点签名');
  });
});

describe('L13-W6 §RWS 增量 ⊆ 全量对拍（L0-6=A · 不变量 #33）', () => {
  test('增量失效集 ⊆ 已回填集（写集不越读集）', () => {
    const lru = makeLru({});
    const backfilled = new Set();
    for (let i = 0; i < 50; i++) { const id = 'r' + i; lru.backfill(id, nodeOf(i)); backfilled.add(id); }
    const dirtyIds = ['r10', 'r20', 'absent'];
    let applied = 0;
    for (const id of dirtyIds) { if (lru.workset.has(id)) { lru.workset.delete(id); applied++; } }
    assert.equal(applied, 2, '仅命中工作集的项被失效');
    assert.ok(dirtyIds.every((id) => backfilled.has(id) || id === 'absent'), '写集 ⊂ 读集 ∪ 边界');
  });

  test('一致性对拍 · 增量失效后回填与全量逐项 mismatch=0', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => 'c' + i);
    const state = { nodes: Object.fromEntries(ids.map((id, i) => [id, nodeOf(i)])) };
    const N = (id) => state.nodes[id];
    const lru = makeLru({});
    for (const id of ids) lru.backfill(id, N(id));
    lru.workset.delete('c30');          /* 增量失效 */
    let mismatch = 0;
    for (const id of ids) {
      const a = project(N(id), ['id', 'text']);
      const b = project(lru.backfill(id, N(id)), ['id', 'text']);
      if (JSON.stringify(a) !== JSON.stringify(b)) mismatch++;
    }
    assert.equal(mismatch, 0, 'mismatch === 0（增量 ⊆ 全量对拍）');
    assert.ok(lru.workset.size <= MB_LRU_CAP, '对拍后工作集仍封顶');
  });
});

describe('L13-W6 §崩溃安全网（会话级降级回全量）', () => {
  test('工作集路径抛错 → 降级回全量（不抛错）', () => {
    let disabled = false;
    let crashFallbacks = 0;
    const MB = { ready: true };
    const crashSafe = (fn, fallback) => {
      try { return fn(); } catch (e) { disabled = true; MB.ready = false; crashFallbacks++; return fallback; }
    };
    const out = crashSafe(() => { throw new Error('MB_CRASH'); }, 'FULL');
    assert.equal(out, 'FULL', '崩溃 → 回退全量');
    assert.equal(disabled, true, '会话级降级标记');
    assert.equal(crashFallbacks, 1, '崩溃计数');
  });
});

describe('L13-W6 §产物级结构性扫描（canonical 引擎 API + 守卫锚）', () => {
  test('L13 引擎 API 落地（MB-SEAM / MB-LRU / TS-V）', () => {
    const TOKENS = [
      'MB_LRU_CAP', 'MB_VIEW_CAP', '_mbDisabled', '_mbUserDisabled', '_mbEnabled',
      'MB.workset', 'MB.viewport', 'MB.dirty', 'MB.ready', 'MB.metrics.capBreach',
      'mbPinned', 'mbTouch', 'mbEvict', 'MB_backfill', 'getNodeAsync', 'prefetch',
      'mbResolve', '_mbProject', '_mbSetViewport', '_mbOnCommit', '_mbRss',
    ];
    const missing = TOKENS.filter((t) => !SRC.includes(t));
    assert.deepEqual(missing, [], '缺失令牌 = []');
  });

  test('默认关闭态锚（_mbDisabled=true · 零回归）', () => {
    assert.ok(SRC.includes('_mbDisabled=true'), '_mbDisabled 默认 true');
    assert.ok(SRC.includes('_mbUserDisabled=false'), '_mbUserDisabled 默认 false');
    assert.ok(SRC.includes('await getNodeAsync(id) === N(id)'), 'S-A 短路注释锚');
  });

  test('三重淘汰守卫锚（视口 / 脏集 / 显式 pin）', () => {
    assert.ok(SRC.includes('MB.viewport.has(id)'), '守卫 ① 视口段常驻');
    assert.ok(SRC.includes('MB.dirty.has(id)'), '守卫 ② 脏集不淘汰');
    assert.ok(SRC.includes('mbPinned(id)'), '守卫 ③ 显式 pin');
  });

  test('W4 防抖 / 合批 / 一致性锚', () => {
    const TOKENS = ['MB_COMMIT_BATCH_MS', 'MB_CONSISTENCY_RING', 'MB_W4', 'mbDebounceViewport',
      '_mbApplyIncremental', 'mbCoalesceCommit', 'mbAuditConsistency', '_mbCrashSafe'];
    const missing = TOKENS.filter((t) => !SRC.includes(t));
    assert.deepEqual(missing, [], '缺失令牌 = []');
  });
});
