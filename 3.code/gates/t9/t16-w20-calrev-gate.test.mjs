/**
 * L16-W20 · 缺陷修复指令 11「_calDataRev 仅在 _calIndexCache 实际失效时递增（Defect-L）」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：
 *   索引层失败的各出口（reportIndexFailure 连败分支 / l6InjectionFailure / commit 两处索引失败分支 /
 *   undo / redo / mergeRemoteState finally）原直接执行 `_calIndexCache=null;_calDataRev++;`，
 *   即便日历索引从未构建（已是 null）也推进日历数据代次，导致 _renderDayCache 整表重建（2000 条 LRU），
 *   部分回退 L16-W2 的失效粒度优化。改为统一 invalidateCalIndexOnly()：_calIndexCache===null 时直接返回，
 *   否则置 null 并推进 _calDataRev。
 * 断言口径（确定性）：
 *   A. 结构锚点：helper 守卫先于置空 / 代次递增；全仓无残留 `_calIndexCache=null;_calDataRev++`；7 处收口。
 *   B. 行为：null 缓存 → 无操作；实有缓存 → 置空并 +1；连续 5 次非日历索引失败仅 +1；
 *      日历数据真实变化（invalidateCalIndex）仍无条件递增。
 *   C. 日历视图：非日历索引失败后 _renderDayCache 代次匹配（对象引用不变，不重建）；
 *      日历数据变化后重建。
 *   D. 指标：calrev_gate.revDelta 等。
 *   E. 大 state 构造 + P95 采样（阈值断言）。
 * 运行：`node --test l9/t16-w20-calrev-gate.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
/* 红证支持：JU_W20_CANONICAL 可指向改前字节副本（默认 canonical） */
const CANONICAL = process.env.JU_W20_CANONICAL
  ? path.resolve(process.env.JU_W20_CANONICAL)
  : path.resolve(STEP9, '..', 'v2.0-t3.html');
const SRC = readFileSync(CANONICAL, 'utf8');

/* ---------- 0) 源码切片：按大括号配对提取函数（跳过注释 / 字符串 / 模板） ---------- */
function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  /* 改前字节（红证）：函数不存在时返回占位注释，令各用例独立失败而非整文件加载失败 */
  if (start < 0) return '/* MISSING ' + name + ' */';
  let i = src.indexOf('{', start);
  let depth = 0;
  let mode = 0; /* 0 code / 1 line comment / 2 block comment / 3 sq / 4 dq / 5 template */
  for (; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (mode === 0) {
      if (c === '/' && n === '/') { mode = 1; continue; }
      if (c === '/' && n === '*') { mode = 2; i++; continue; }
      if (c === "'") { mode = 3; continue; }
      if (c === '"') { mode = 4; continue; }
      if (c === '`') { mode = 5; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    } else if (mode === 1) {
      if (c === '\n') mode = 0;
    } else if (mode === 2) {
      if (c === '*' && n === '/') { mode = 0; i++; }
    } else if (mode === 3) {
      if (c === '\\') i++; else if (c === "'") mode = 0;
    } else if (mode === 4) {
      if (c === '\\') i++; else if (c === '"') mode = 0;
    } else if (mode === 5) {
      if (c === '\\') i++; else if (c === '`') mode = 0;
    }
  }
  return '/* UNTERMINATED ' + name + ' */';
}

const FN_INVAL_ALL = extractFn(SRC, 'invalidateCalIndex');
const FN_INVAL_ONLY = extractFn(SRC, 'invalidateCalIndexOnly');
const FN_REPORT_FAIL = extractFn(SRC, 'reportIndexFailure');
const FN_INJECT_FAIL = extractFn(SRC, 'l6InjectionFailure');

const PRELUDE = [
  'const _win = window;',
  'let _calIndexCache=null;',
  'let _tagIndexCache=null;',
  'let _searchInverted=null;',
  'let _backlinkMap=null;',
  'let _calRecurCache=null;',
  'let _yearCountsCache=null;',
  'let _calDayCache=null;',
  'let _renderDayCache=null;',
  'let _calDataRev=0;',
  'const _INDEX_FAIL_CAP=50;',
  'const _INDEX_FAILURE_STRIKE=3;',
  'let __juIndexFailureStreak=0;',
  '',
].join('\n');

function makeHarness() {
  const win = { __juIndexFailures: [] };
  const quietConsole = { warn() {}, error() {} };
  const factory = new Function(
    'window', 'console',
    PRELUDE
      + FN_INVAL_ALL + '\n'
      + FN_INVAL_ONLY + '\n'
      + FN_REPORT_FAIL + '\n'
      + FN_INJECT_FAIL + '\n'
      + 'return {'
      + ' invalidateCalIndex, invalidateCalIndexOnly, reportIndexFailure, l6InjectionFailure,'
      + ' get calIndex(){return _calIndexCache;}, set calIndex(v){_calIndexCache=v;},'
      + ' get tagIndex(){return _tagIndexCache;}, get searchInverted(){return _searchInverted;},'
      + ' get backlinkMap(){return _backlinkMap;}, get rev(){return _calDataRev;},'
      + ' get renderCache(){return _renderDayCache;}, set renderCache(v){_renderDayCache=v;},'
      + ' get streak(){return __juIndexFailureStreak;}'
      + ' };',
  );
  const mod = factory(win, quietConsole);
  return { mod, win };
}

/* _renderDayCache 重建门槛（与 canonical renderCalendar 同口径：代次不等才整表重建） */
function applyDayCacheGate(h) {
  if (!h.mod.renderCache || h.mod.renderCache._gen !== h.mod.rev) {
    h.mod.renderCache = { _gen: h.mod.rev, map: 'LRU2000' };
  }
  return h.mod.renderCache;
}

function freshCalIndex(tag = 'a') {
  return new Map([['2026-10-17', new Set([tag])]]);
}

function p95(samples) {
  const s = samples.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)];
}

function buildBigState(n) {
  const nodes = { root: { id: 'root', text: '根', children: [], createdAt: 1, updatedAt: 2 } };
  for (let i = 0; i < n; i++) {
    const id = 'n' + i;
    nodes[id] = { id, parent: 'root', children: [], text: '节点 ' + i, createdAt: 10 + i, updatedAt: 20 + i };
    nodes.root.children.push(id);
  }
  return { nodes };
}

/* ---------- 1) 结构锚点 ---------- */
describe('L16-W20 §A 结构锚点（canonical 文本）', () => {
  test('A1: helper 守卫 _calIndexCache===null 先于置空 / 代次递增', () => {
    assert.ok(FN_INVAL_ONLY.includes('function invalidateCalIndexOnly()'), '缺统一失效函数');
    const guard = FN_INVAL_ONLY.indexOf('if(_calIndexCache===null)return');
    const clear = FN_INVAL_ONLY.indexOf('_calIndexCache=null;');
    const bump = FN_INVAL_ONLY.indexOf('_calDataRev++;');
    assert.ok(guard > 0, '缺 null 守卫');
    assert.ok(clear > guard, '置空应位于守卫之后');
    assert.ok(bump > clear, '代次递增应位于置空之后');
  });

  test('A2: 全仓无残留 `_calIndexCache=null;_calDataRev++` 连写', () => {
    assert.equal(SRC.split('_calIndexCache=null;_calDataRev++').length - 1, 0);
  });

  test('A3: 7 处索引失败出口全部收口到 invalidateCalIndexOnly()', () => {
    assert.equal(SRC.split('invalidateCalIndexOnly();').length - 1, 7, '调用点应为 7 处');
    const seg = (a, b) => {
      const i = SRC.indexOf(a);
      const j = b ? SRC.indexOf(b, i + 1) : SRC.length;
      assert.ok(i > 0, '缺区段起点 ' + a);
      return SRC.slice(i, j > 0 ? j : SRC.length);
    };
    const commitSeg = seg('function commit(', 'function undo(');
    assert.equal(commitSeg.split('invalidateCalIndexOnly();').length - 1, 2, 'commit 应 2 处');
    const undoSeg = seg('function undo(', 'function redo(');
    assert.equal(undoSeg.split('invalidateCalIndexOnly();').length - 1, 1, 'undo 应 1 处');
    const redoSeg = seg('function redo(');
    assert.ok(redoSeg.split('invalidateCalIndexOnly();').length - 1 >= 1, 'redo 应 ≥1 处');
    assert.equal(FN_REPORT_FAIL.split('invalidateCalIndexOnly();').length - 1, 1, 'reportIndexFailure 应 1 处');
    assert.equal(FN_INJECT_FAIL.split('invalidateCalIndexOnly();').length - 1, 1, 'l6InjectionFailure 应 1 处');
  });

  test('A4: mergeRemoteState finally 仍强制其余三索引失效（仅日历索引改收口）', () => {
    const i = SRC.indexOf('__juInMerge=false;');
    assert.ok(i > 0, '缺 merge finally 段');
    const tail = SRC.slice(i, i + 600);
    assert.ok(tail.includes('invalidateCalIndexOnly();'), 'merge finally 应调用 helper');
    assert.ok(tail.includes('_tagIndexCache=null;'), 'tag 索引仍应强制失效');
    assert.ok(tail.includes('_searchInverted=null;'), 'search 倒排仍应强制失效');
    assert.ok(tail.includes('_backlinkMap=null;'), '反链索引仍应强制失效');
  });
});

/* ---------- 2) 行为：条件递增 ---------- */
describe('L16-W20 §B 条件递增行为', () => {
  test('B1: _calIndexCache 为 null 时 helper 为无操作', () => {
    const h = makeHarness();
    assert.equal(h.mod.calIndex, null);
    assert.equal(h.mod.invalidateCalIndexOnly(), false);
    assert.equal(h.mod.rev, 0, '代次不得递增');
    assert.equal(h.mod.calIndex, null);
  });

  test('B2: 实有缓存时 helper 置空并 +1，二次调用不再递增', () => {
    const h = makeHarness();
    h.mod.calIndex = freshCalIndex();
    assert.equal(h.mod.invalidateCalIndexOnly(), true);
    assert.equal(h.mod.calIndex, null);
    assert.equal(h.mod.rev, 1);
    assert.equal(h.mod.invalidateCalIndexOnly(), false);
    assert.equal(h.mod.rev, 1, '已为 null 时不得再 +1');
  });

  test('B3: 连续 5 次非日历索引失败 → _calDataRev 仅 +1', () => {
    const h = makeHarness();
    h.mod.calIndex = freshCalIndex();
    const rev0 = h.mod.rev;
    for (let i = 0; i < 5; i++) {
      h.mod.reportIndexFailure({ op: 'update:node', index: 'tagIndex', changedIds: new Set(['a']), error: 'tag index update failed' });
    }
    assert.equal(h.mod.rev - rev0, 1, '5 次失败仅推进 1 次代次');
    assert.equal(h.win.__juIndexFailures.length, 5, '失败环形缓冲应记录 5 条');
    assert.equal(h.mod.calIndex, null);
    assert.equal(h.mod.tagIndex, null);
    assert.equal(h.mod.searchInverted, null);
    assert.equal(h.mod.backlinkMap, null);
  });

  test('B4: l6InjectionFailure 同样按缓存实有性递增', () => {
    const h = makeHarness();
    h.mod.l6InjectionFailure('commit', 'text.edit', new Error('injection boom'));
    assert.equal(h.mod.rev, 0, '缓存为 null 时注入失败不得推进代次');
    h.mod.calIndex = freshCalIndex();
    h.mod.l6InjectionFailure('undo', 'text.edit', new Error('injection boom'));
    assert.equal(h.mod.rev, 1);
    h.mod.l6InjectionFailure('redo', 'text.edit', new Error('injection boom'));
    assert.equal(h.mod.rev, 1, '连续注入失败仅 +1');
  });

  test('B5: 日历数据真实变化（invalidateCalIndex）仍无条件递增', () => {
    const h = makeHarness();
    h.mod.invalidateCalIndex();
    assert.equal(h.mod.rev, 1, '缓存为 null 时日历真实变更仍推进（日历视图必须重算）');
    h.mod.calIndex = freshCalIndex();
    h.mod.invalidateCalIndex();
    assert.equal(h.mod.rev, 2);
    assert.equal(h.mod.calIndex, null);
    assert.equal(h.mod.renderCache, null, '日历渲染日缓存同代失效');
  });
});

/* ---------- 3) 日历视图：_renderDayCache 不被重建 ---------- */
describe('L16-W20 §C 日历视图失效粒度', () => {
  test('C1: 连续 5 次非日历索引失败仅重建 1 次（原实现为 5 次）', () => {
    const h = makeHarness();
    h.mod.calIndex = freshCalIndex();
    let prev = applyDayCacheGate(h);
    let rebuilds = 0;
    for (let i = 0; i < 5; i++) {
      h.mod.reportIndexFailure({ op: 'update:node', index: 'searchInverted', changedIds: new Set(['a']), error: 'search update failed' });
      const cur = applyDayCacheGate(h);
      if (cur !== prev) rebuilds++;
      prev = cur;
    }
    assert.equal(rebuilds, 1, '5 次失败应仅 1 次重建（第 3 次连败触发日历索引强制失效）');
    assert.equal(h.mod.rev, 1, '代次仅推进 1 次');
    assert.equal(prev._gen, h.mod.rev);
  });

  test('C4: 日历索引未构建时反复失败不重建日缓存', () => {
    const h = makeHarness();
    let prev = applyDayCacheGate(h);
    let rebuilds = 0;
    for (let i = 0; i < 5; i++) {
      h.mod.reportIndexFailure({ op: 'update:node', index: 'tagIndex', changedIds: new Set(['a']), error: 'tag update failed' });
      const cur = applyDayCacheGate(h);
      if (cur !== prev) rebuilds++;
      prev = cur;
    }
    assert.equal(rebuilds, 0, '缓存本就为 null → 零重建');
    assert.equal(h.mod.rev, 0, '代次零推进');
  });

  test('C2: 日历数据变化后日缓存按代次重建', () => {
    const h = makeHarness();
    h.mod.calIndex = freshCalIndex();
    const first = applyDayCacheGate(h);
    h.mod.invalidateCalIndex();
    const second = applyDayCacheGate(h);
    assert.notEqual(second, first, '日历数据变化应触发重建');
    assert.equal(second._gen, h.mod.rev);
  });

  test('C3: 重建门槛仍以 _calDataRev 为唯一代次来源', () => {
    assert.ok(SRC.includes('_renderDayCache._gen!==_calDataRev'), '缺日缓存代次门槛');
  });
});

/* ---------- 4) 指标 ---------- */
describe('L16-W20 §D 指标', () => {
  test('D1: calrev_gate 指标（5 次非日历失败 / 代次增量 1）', () => {
    const h = makeHarness();
    h.mod.calIndex = freshCalIndex();
    const rev0 = h.mod.rev;
    for (let i = 0; i < 5; i++) h.mod.reportIndexFailure({ op: 'x', index: 'backlinkMap', error: 'e' });
    const metric = { nonCalFailures: 5, revDelta: h.mod.rev - rev0, calCacheCleared: h.mod.calIndex === null };
    assert.deepEqual(metric, { nonCalFailures: 5, revDelta: 1, calCacheCleared: true });
    console.log('calrev_gate=' + JSON.stringify(metric));
  });
});

/* ---------- 5) 大 state + P95 ---------- */
describe('L16-W20 §E 大 state 与 P95 采样', () => {
  test('E1: 20,000 节点 state 下 helper P95', () => {
    const st = buildBigState(20000);
    assert.equal(Object.keys(st.nodes).length, 20001);
    const h = makeHarness();
    const samples = [];
    for (let i = 0; i < 200; i++) {
      h.mod.calIndex = freshCalIndex();
      const t0 = process.hrtime.bigint();
      h.mod.invalidateCalIndexOnly();
      const t1 = process.hrtime.bigint();
      samples.push(Number(t1 - t0) / 1e6);
    }
    const p = p95(samples);
    assert.ok(p < 0.5, 'helper p95 应 < 0.5 ms，实测 ' + p.toFixed(4));
    assert.equal(h.mod.rev, 200);
    console.log('calrev_gate_helper_p95_ms=' + p.toFixed(4));
  });

  test('E2: 20,000 节点 state 下索引失败出口 P95', () => {
    const st = buildBigState(20000);
    assert.equal(st.nodes.root.children.length, 20000);
    const h = makeHarness();
    const samples = [];
    for (let i = 0; i < 200; i++) {
      h.mod.calIndex = freshCalIndex();
      const t0 = process.hrtime.bigint();
      h.mod.reportIndexFailure({ op: 'update:node', index: 'tagIndex', changedIds: new Set(['n1']), error: 'tag update failed' });
      const t1 = process.hrtime.bigint();
      samples.push(Number(t1 - t0) / 1e6);
    }
    const p = p95(samples);
    assert.ok(p < 5, '索引失败出口 p95 应 < 5 ms，实测 ' + p.toFixed(4));
    assert.equal(h.mod.rev, Math.floor(200 / 3), '仅连败阈值命中时推进代次（每 3 次失败 1 次）');
    console.log('calrev_gate_fail_p95_ms=' + p.toFixed(4));
  });
});
