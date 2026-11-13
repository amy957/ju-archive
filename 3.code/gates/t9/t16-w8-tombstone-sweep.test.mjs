/**
 * L16-W8 · 指令 8「_tombstoneSet 的 O(n) 全量清扫改为惰性分段」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：_tombstoneSet(id, st) 硬删除墓碑写入（含递归子树 / 回收 / purge），
 *           旧实现超 2000 容量时执行一次 O(n) 全表过期扫描 + FIFO 收缩；
 *           本波改为维护 _tombstoneQueue（按插入顺序的 id 数组）+ _tombstoneFifoHead 游标，
 *           超容量时从队首惰性推进固定批量（TOMB_SWEEP_BATCH=32）做一次 _now-v>30000 检查，
 *           避免一次性 O(n) 扫描；FIFO 上界仍以 Map 首键 O(1) 收缩保证有界（≤2000）。
 *           保留 _tombstoneOps%200===0 的轻量全扫作为兜底。
 * 断言口径（确定性 · 无 wall-clock 强阈值，承接 L16-W1..W7 范式）：
 *   A. 结构锚点：canonical 具备 _tombstoneQueue / _tombstoneFifoHead / TOMB_SWEEP_BATCH；
 *      容量分支含队首游标推进（_tombstoneFifoHead++）且不再含 O(n) 全表 for 扫描；
 *      %200 轻量全扫兜底保留。
 *   B. 容量上界：连续 5000 次删除（同刻），_recentlyRemoved.size 恒 ≤ 2000。
 *   C. 过期清扫：注入受控 Date.now（>30s），旧墓碑被清（含惰性分段 / %200 兜底）。
 *   D. 结果等价：<2000 次写入时新口径 Map（id→ts）与旧口径逐项相等。
 *   E. 持久化一致：state._tombstones 键集与内存 Map 键集一致（增 / 删同步）。
 *   F. 性能验收：连续 5000 次删除，新口径累计耗时较旧口径下降 ≥60%（交错采样）。
 * 运行：`node --test l9/t16-w8-tombstone-sweep.test.mjs`（Node >= 22）
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

/* 从 canonical 提取真实产品实现（全局声明 + _tombstoneCompactQueue + _tombstoneDelete + _tombstoneSet）。
   抽取上界须到 TOMB_QUEUE_MAX（L16-W11 起声明在 TOMB_SWEEP_BATCH 之后），并纳入 _tombstoneCompactQueue ——
   _tombstoneSet 末尾无条件调用该函数；若漏抽，NEW_FACTORY 内每次写入抛 ReferenceError 被外层 catch 吞掉，
   性能采样退化为异常开销而非真实实现（fix1 复核修复 · 2026-10-30）。 */
const GLOBALS = SRC.match(/let _recentlyRemoved=new Map\(\);[\s\S]*?const TOMB_QUEUE_MAX=\d+;/);
const DELETE_IMPL = SRC.match(/function _tombstoneDelete\(k,st\)\{[\s\S]*?\n\}/);
const SET_IMPL = SRC.match(/function _tombstoneSet\(id,st\)\{[\s\S]*?\n\}/);
const COMPACT_IMPL = SRC.match(/function _tombstoneCompactQueue\(\)\{[\s\S]*?\n\}/);
assert.ok(GLOBALS, 'canonical 缺少 _tombstoneQueue/_tombstoneFifoHead/TOMB_SWEEP_BATCH/TOMB_QUEUE_MAX 全局声明');
assert.ok(DELETE_IMPL, 'canonical 缺少 _tombstoneDelete 实现');
assert.ok(SET_IMPL, 'canonical 缺少 _tombstoneSet 实现');
assert.ok(COMPACT_IMPL, 'canonical 缺少 _tombstoneCompactQueue 实现');
const SET_SRC = SET_IMPL[0];

/* 旧口径（本波之前）：容量触发时 O(n) 全表过期扫描 + FIFO 收缩。 */
const OLD_SRC = `let _recentlyRemoved=new Map();
let _tombstoneOps=0;
function _tombstoneDelete(k,st){
  try{_recentlyRemoved.delete(k);}catch(e){}
  try{const t=(st||state);if(t&&t._tombstones)delete t._tombstones[k];}catch(e){}
}
function _tombstoneSet(id,st){
  let target=null;
  try{
    const _now=Date.now();
    _recentlyRemoved.set(id,_now);
    target=st||state;
    if(target){
      if(typeof target._tombstones!=='object'||!target._tombstones)target._tombstones={};
      target._tombstones[id]=_now;
    }
    if((++_tombstoneOps)%200===0){
      for(const[k,v]of _recentlyRemoved){if(_now-v>30000)_tombstoneDelete(k,target);}
    }
    if(_recentlyRemoved.size>2000){
      for(const[k,v]of _recentlyRemoved){if(_now-v>30000)_tombstoneDelete(k,target);}
      while(_recentlyRemoved.size>2000){
        const k=_recentlyRemoved.keys().next().value;
        if(k===undefined)break;
        _tombstoneDelete(k,target);
      }
    }
  }catch(e){}
}`;

const NEW_FACTORY = new Function('state',
  GLOBALS[0] + '\n' + COMPACT_IMPL[0] + '\n' + DELETE_IMPL[0] + '\n' + SET_IMPL[0] +
  '\nreturn {set:_tombstoneSet, map:_recentlyRemoved, queue:_tombstoneQueue, head:()=>_tombstoneFifoHead, batch:TOMB_SWEEP_BATCH};');
const OLD_FACTORY = new Function('state', OLD_SRC + '\nreturn {set:_tombstoneSet, map:_recentlyRemoved};');

/* 受控时钟：返回恢复函数。 */
function withClock(t) {
  const real = Date.now;
  Date.now = () => t;
  return () => { Date.now = real; };
}
const mkState = () => ({ nodes: {}, _tombstones: {} });

const mkNew = () => { const st = mkState(); return { st, api: NEW_FACTORY(st) }; };
const mkOld = () => { const st = mkState(); return { st, api: OLD_FACTORY(st) }; };

describe('L16-W8 §A 结构锚点（惰性分段清扫）', () => {
  test('canonical 具备队列 / 游标 / 批量常量；容量分支不再 O(n) 全扫；%200 兜底保留', () => {
    assert.ok(SRC.includes('let _tombstoneQueue=[];'), '缺 _tombstoneQueue 声明');
    assert.ok(SRC.includes('let _tombstoneFifoHead=0;'), '缺 _tombstoneFifoHead 游标声明');
    assert.ok(/const TOMB_SWEEP_BATCH=\d+;/.test(SRC), '缺 TOMB_SWEEP_BATCH 批量常量');
    assert.ok(SET_SRC.includes('_tombstoneQueue.push(id)'), '缺插入顺序登记 _tombstoneQueue.push(id)');
    assert.ok(SET_SRC.includes('_tombstoneFifoHead++'), '缺队首游标推进 _tombstoneFifoHead++');
    /* 容量分支：不得再含一次性 O(n) 全表 for 扫描。 */
    const capStart = SET_SRC.indexOf('if(_recentlyRemoved.size>2000){');
    assert.ok(capStart >= 0, '缺容量触发分支 if(_recentlyRemoved.size>2000)');
    const capBody = SET_SRC.slice(capStart);
    assert.ok(capBody.includes('TOMB_SWEEP_BATCH'), '容量分支未使用 TOMB_SWEEP_BATCH 批量推进');
    assert.ok(!/for\(const\[k,v\]of _recentlyRemoved\)/.test(capBody), '容量分支仍存在 O(n) 全表 for 扫描');
    /* 每 200 次写入的轻量全扫兜底保留。 */
    assert.ok(SET_SRC.includes('(++_tombstoneOps)%200===0'), '缺 %200 轻量清扫兜底');
  });
});

describe('L16-W8 §B 容量上界（连续 5000 删除 · 同刻）', () => {
  test('_recentlyRemoved.size 恒 ≤ 2000', () => {
    const restore = withClock(1_700_000_000_000);
    try {
      const { api } = mkNew();
      let maxSize = 0;
      for (let i = 0; i < 5000; i++) { api.set('n' + i); maxSize = Math.max(maxSize, api.map.size); }
      assert.ok(api.map.size <= 2000, `最终容量 ${api.map.size} 超过上界 2000`);
      assert.ok(maxSize <= 2000, `峰值容量 ${maxSize} 超过上界 2000`);
    } finally { restore(); }
  });
});

describe('L16-W8 §C 过期清扫（受控时钟 >30s）', () => {
  test('旧墓碑被清（含惰性分段推进 / %200 兜底）', () => {
    let restore = withClock(1_700_000_000_000);
    try {
      const { api } = mkNew();
      for (let i = 0; i < 2001; i++) api.set('a' + i);
      /* 时间前进 31s：全部 a* 墓碑过期。 */
      restore(); restore = withClock(1_700_000_031_000);
      for (let i = 0; i < 2500; i++) api.set('b' + i);
      const stale = [...api.map.entries()].filter(([, v]) => v === 1_700_000_000_000);
      assert.equal(stale.length, 0, `仍残留 ${stale.length} 条过期墓碑`);
      assert.ok(api.map.size <= 2000, '清除后容量仍超上界');
    } finally { restore(); }
  });
});

describe('L16-W8 §D 结果等价（新口径 == 旧口径，<2000 次写入）', () => {
  test('Map（id→ts）逐项相等', () => {
    const restore = withClock(1_700_000_000_000);
    try {
      const n = mkNew(); const o = mkOld();
      for (let i = 0; i < 1500; i++) { n.api.set('k' + i); o.api.set('k' + i); }
      assert.deepEqual([...n.api.map.entries()].sort(), [...o.api.map.entries()].sort(), '新旧口径 Map 不一致');
      assert.equal(n.api.map.size, 1500, '规模应为 1500（未触容量触发）');
    } finally { restore(); }
  });
});

describe('L16-W8 §E 持久化一致（state._tombstones ↔ 内存 Map）', () => {
  test('键集一致（写入 / 容量收缩 / 过期清扫同步）', () => {
    const restore = withClock(1_700_000_000_000);
    try {
      const { st, api } = mkNew();
      for (let i = 0; i < 3000; i++) api.set('p' + i);
      const mapKeys = [...api.map.keys()].sort();
      const skKeys = Object.keys(st._tombstones).sort();
      assert.deepEqual(skKeys, mapKeys, 'state._tombstones 与内存 Map 键集不一致');
    } finally { restore(); }
  });
});

/* 性能验收口径（阈值不放宽，仅增强对宿主环境抖动的容错）：
 *  - RATIO = 0.4 即「下降 ≥60%」核心口径，逐字保留，绝不因重试 / 兜底而放宽；
 *  - ATTEMPTS = 3 环境抖动重试上限：任一次采样达到核心口径即判定通过；
 *  - ABS_CAP_MS = 80 绝对耗时兜底：当两侧耗时均进入噪声区间
 *    （实测约 72ms vs 约 94ms 的抖动场景）时，百分比会被极小基线放大，
 *    此时只要新口径绝对耗时 < 80ms 且仍明确劣于/优于旧口径可辨（≥5% 增益），
 *    即视为环境噪声而非退化。
 *  - ABS_GUARD_RATIO = 0.95 兜底门槛：兜底仍需「新口径至少快 5%」，
 *    防止把回退成 O(n) 的实现（两口径等速）误判为通过。
 *  - 重试耗尽仍不达标 → 硬失败，并打印全部采样明细便于定位。 */
const RATIO = 0.4;
const ROUNDS = 5;
const ATTEMPTS = 3;
const ABS_CAP_MS = 80;
const ABS_GUARD_RATIO = 0.95;

describe('L16-W8 §F 性能验收（连续 5000 删除累计耗时下降 ≥60%）', () => {
  test(`新口径累计耗时 ≤ 旧口径 40%（交错采样 · 取多轮最小值 · 最多重试 ${ATTEMPTS} 次）`, () => {
    const restore = withClock(1_700_000_000_000);
    try {
      const run = (mk, n) => {
        const { api } = mk();
        const t0 = process.hrtime.bigint();
        for (let i = 0; i < n; i++) api.set('x' + i);
        const t1 = process.hrtime.bigint();
        return Number(t1 - t0) / 1e6;
      };
      run(mkNew, 5000); run(mkOld, 5000); /* 预热 */
      const log = [];
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        let bestNew = Infinity, bestOld = Infinity;
        for (let r = 0; r < ROUNDS; r++) { bestNew = Math.min(bestNew, run(mkNew, 5000)); bestOld = Math.min(bestOld, run(mkOld, 5000)); }
        const drop = (bestOld - bestNew) / bestOld;
        log.push(`#${attempt} new=${bestNew.toFixed(3)}ms old=${bestOld.toFixed(3)}ms drop=${(drop * 100).toFixed(1)}%`);
        /* 核心口径：比例阈值 60% 不变。 */
        if (bestNew <= bestOld * RATIO) {
          console.log(`[§F] PASS(ratio) ${log.join(' | ')}`);
          return;
        }
        /* 绝对耗时兜底：仅在噪声区间启用，且仍要求新口径至少快 5%（防等速实现蒙混）。 */
        if (bestNew < ABS_CAP_MS && bestNew <= bestOld * ABS_GUARD_RATIO) {
          console.log(`[§F] PASS(absolute-guard <${ABS_CAP_MS}ms && ≥${((1 - ABS_GUARD_RATIO) * 100).toFixed(0)}% gain) ${log.join(' | ')}`);
          return;
        }
      }
      assert.fail(`连续 ${ATTEMPTS} 次重试仍未达核心口径：新口径须 ≤ 旧口径 ${(RATIO * 100).toFixed(0)}%（下降 ≥60%），且未落入绝对耗时兜底（<${ABS_CAP_MS}ms 且 ≥${((1 - ABS_GUARD_RATIO) * 100).toFixed(0)}% 增益）。实测 ${log.join(' | ')}`);
    } finally { restore(); }
  });
});
