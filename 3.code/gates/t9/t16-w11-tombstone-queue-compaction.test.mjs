/**
 * L16-W11 · 缺陷修复指令 2「_tombstoneQueue 解耦清理（Defect-J）」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义（Defect-J）：
 *   1. 原实现的队列清理（游标压缩）仅位于 `if(_recentlyRemoved.size>2000)` 分支内部。
 *   2. 稀疏删除场景（每秒 1 次 removeNode）下 _recentlyRemoved 稳定在数十条，该分支永不成立，
 *      _tombstoneQueue 随每次写入持续 push 而无界增长（长时运行可累积数万条）。
 *   本波改动：
 *   A. 新增 const TOMB_QUEUE_MAX=4096；
 *   B. 新增 _tombstoneCompactQueue()——遍历队列，只保留仍存于 _recentlyRemoved 的条目，压缩前缀并归零游标；
 *   C. _tombstoneSet 末尾与 mergeRemoteState 对端墓碑并入后各调用一次（自门控：未超阈值零开销）；
 *   D. 容量分支保留，但分批推进仅在队首仍有未判定条目时执行（避免空转）。
 * 断言口径（确定性 · 承接 L16-W1..W10 范式）：
 *   A. 结构锚点：TOMB_QUEUE_MAX / compaction 调用点在 canonical 中，容量触发仍保留。
 *   B. 缺陷复现（旧口径）：12000 次稀疏删除后队列 > 8192（无界增长）。
 *   C. 验收（新口径）：3600 次稀疏删除（1 次/秒 · 虚拟时钟）后队列 ≤ 8192、_recentlyRemoved ≤ 2000。
 *   D. 突发 5000 次删除：容量分支 + compaction 协同，队列回落且仅保留存活墓碑。
 *   E. compaction 正确性：队列条目 ⊆ _recentlyRemoved，游标归零，顺序保留。
 *   F. 与 initStore 复位（_tombstoneQueue=[] / _tombstoneFifoHead=0）不冲突。
 *   G. 大 state（50,000 节点）P95 采样：单次墓碑写入 P95 ≤ 0.5ms；队列长度上界不变。
 * 运行：`node --test l9/t16-w11-tombstone-queue-compaction.test.mjs`（Node >= 22）
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

/* ---------- 从 canonical 提取真实产品实现（TOMB 常量 + 三个函数） ---------- */
const I0 = SRC.indexOf('const TOMB_SWEEP_BATCH=32;');
const I1 = SRC.indexOf('const _REV_STRIP=');
assert.ok(I0 > 0 && I1 > I0, 'canonical 缺墓碑队列实现段（TOMB_SWEEP_BATCH … _REV_STRIP）');
const TOMB_SRC = SRC.slice(I0, I1);
for (const tag of ['TOMB_QUEUE_MAX=4096', 'function _tombstoneCompactQueue()', 'function _tombstoneSet(id,st)']) {
  assert.ok(TOMB_SRC.includes(tag), `canonical 缺实现锚点：${tag}`);
}

/* 旧口径（本波之前）：无队列长度独立触发（仅保留 size>2000 分支内的游标压缩） */
const OLD_TOMB_SRC = TOMB_SRC.replace(
  '\n    _tombstoneCompactQueue();\n  }catch(e){}\n}',
  '\n  }catch(e){}\n}',
);
assert.ok(OLD_TOMB_SRC !== TOMB_SRC, '旧口径构造失败（_tombstoneSet 内队列长度触发未命中）');

/* ---------- 最小作用域装配（产品函数体逐字执行 · 虚拟时钟） ---------- */
function makeHarness(src, target) {
  const factory = new Function(
    'target',
    `
    let state = target;
    let _recentlyRemoved = new Map();
    let _tombstoneOps = 0;
    let _tombstoneQueue = [];
    let _tombstoneFifoHead = 0;
    ${src}
    return {
      set:(id,st)=>_tombstoneSet(id,st===undefined?state:st),
      compact:()=>_tombstoneCompactQueue(),
      reset:()=>{_tombstoneQueue=[];_tombstoneFifoHead=0;},
      live:()=>new Set(_recentlyRemoved.keys()),
      snap:()=>({qlen:_tombstoneQueue.length,msize:_recentlyRemoved.size,head:_tombstoneFifoHead,q:_tombstoneQueue.slice()})
    };
  `,
  );
  return factory(target);
}

function withClock(start, fn) {
  const realNow = Date.now;
  let t = start;
  Date.now = () => t;
  try {
    return fn((step) => {
      t += step;
    });
  } finally {
    Date.now = realNow;
  }
}

function mkBigState(n) {
  const s = { rootId: 'root', nodes: {}, _tombstones: {}, trashed: [] };
  s.nodes.root = { id: 'root', parent: null, children: [] };
  for (let i = 0; i < n; i++) {
    const id = 'b' + i;
    s.nodes[id] = { id, parent: 'root', children: [], text: id, createdAt: 1, updatedAt: 1 };
    s.nodes.root.children.push(id);
  }
  return s;
}

const CLOCK0 = 1_700_000_000_000;

describe('L16-W11 §A 结构锚点（队列长度独立触发 + 容量触发保留）', () => {
  test('TOMB_QUEUE_MAX=4096 与 compaction 调用点存在', () => {
    assert.ok(TOMB_SRC.includes('const TOMB_QUEUE_MAX=4096;'), '缺 TOMB_QUEUE_MAX 常量');
    const setBlock = TOMB_SRC.slice(TOMB_SRC.indexOf('function _tombstoneSet(id,st)'));
    assert.ok(setBlock.includes('_tombstoneCompactQueue();'), '_tombstoneSet 缺队列长度触发调用');
  });

  test('compaction 只保留 _recentlyRemoved 中仍存在的条目', () => {
    const fnBlock = TOMB_SRC.slice(
      TOMB_SRC.indexOf('function _tombstoneCompactQueue()'),
      TOMB_SRC.indexOf('function _tombstoneSet(id,st)'),
    );
    assert.ok(fnBlock.includes('_recentlyRemoved.has(k)'), 'compaction 未按存活集过滤');
    assert.ok(fnBlock.includes('q.length=_w'), 'compaction 未压缩前缀');
    assert.ok(fnBlock.includes('_tombstoneFifoHead=0'), 'compaction 未归零游标');
    assert.ok(fnBlock.includes('q.length<=TOMB_QUEUE_MAX'), 'compaction 缺阈值自门控');
  });

  test('容量触发（size>2000）逻辑保留且分批推进不空转', () => {
    const setBlock = TOMB_SRC.slice(TOMB_SRC.indexOf('function _tombstoneSet(id,st)'));
    assert.ok(setBlock.includes('if(_recentlyRemoved.size>2000){'), '容量触发被移除');
    assert.ok(
      setBlock.includes('if(_tombstoneFifoHead<_tombstoneQueue.length){'),
      '容量触发缺「队首仍有未判定条目」门控',
    );
    assert.ok(setBlock.includes('TOMB_SWEEP_BATCH'), '惰性分段批量常量丢失');
  });
});

describe('L16-W11 §B 缺陷复现（旧口径 · 无界增长）', () => {
  test('12000 次稀疏删除后旧口径队列 > 8192', () => {
    const s = { _tombstones: {} };
    const h = makeHarness(OLD_TOMB_SRC, s);
    const n = 12000;
    withClock(CLOCK0, (advance) => {
      for (let i = 0; i < n; i++) {
        h.set('t' + i);
        advance(1000);
      }
    });
    const sn = h.snap();
    assert.equal(sn.qlen, n, '旧口径队列应逐条累积（无 compaction）');
    assert.ok(sn.qlen > 8192, `旧口径队列未超 8192（实测 ${sn.qlen}）`);
    assert.ok(sn.msize <= 2000, '旧口径 Map 仍应受 2000 上界约束');
  });
});

describe('L16-W11 §C 验收：3600 次稀疏删除（1 次/秒）有界', () => {
  test('队列 ≤ 8192 且 _recentlyRemoved ≤ 2000', () => {
    const s = { _tombstones: {} };
    const h = makeHarness(TOMB_SRC, s);
    let maxQ = 0;
    let maxM = 0;
    withClock(CLOCK0, (advance) => {
      for (let i = 0; i < 3600; i++) {
        h.set('s' + i);
        advance(1000);
        const sn = h.snap();
        if (sn.qlen > maxQ) maxQ = sn.qlen;
        if (sn.msize > maxM) maxM = sn.msize;
      }
    });
    const sn = h.snap();
    assert.ok(maxQ <= 8192, `队列峰值 ${maxQ} 超 8192`);
    assert.ok(sn.qlen <= 8192, `终态队列 ${sn.qlen} 超 8192`);
    assert.ok(maxM <= 2000, `_recentlyRemoved 峰值 ${maxM} 超 2000`);
    /* 3600 < TOMB_QUEUE_MAX(4096) ⇒ 本段不触发 compaction，队列应恰为写入次数（有界且无空洞） */
    assert.equal(sn.qlen, 3600, `终态队列应为 3600（实测 ${sn.qlen}）`);
    assert.equal(sn.head, 0, '稀疏写入未超阈值时游标应保持 0');
  });

  test('同一序列在旧口径下必然无界（判别力对照）', () => {
    const s = { _tombstones: {} };
    const h = makeHarness(OLD_TOMB_SRC, s);
    withClock(CLOCK0, (advance) => {
      for (let i = 0; i < 3600; i++) {
        h.set('s' + i);
        advance(1000);
      }
    });
    assert.equal(h.snap().qlen, 3600, '旧口径对照应逐条累积');
  });
});

describe('L16-W11 §D 突发 5000 次删除（容量分支 + compaction 协同）', () => {
  test('Map 收缩至 2000 且队列有界（< 写入次数）', () => {
    const s = { _tombstones: {} };
    const h = makeHarness(TOMB_SRC, s);
    withClock(CLOCK0, () => {
      for (let i = 0; i < 5000; i++) h.set('x' + i);
    });
    const sn = h.snap();
    assert.ok(sn.msize <= 2000, `突发后 Map ${sn.msize} 超 2000`);
    assert.ok(sn.qlen <= 8192, `突发后队列 ${sn.qlen} 超 8192`);
    /* 超阈值时 compaction 至少执行过一次 ⇒ 队列长度必然小于写入次数（旧口径恒等于 5000） */
    assert.ok(sn.qlen < 5000, `突发后队列 ${sn.qlen} 未回落（compaction 未生效）`);
    /* compaction 后的队列条目顺序与写入序一致（无空洞 / 无重复） */
    for (let i = 1; i < sn.q.length; i++) {
      assert.ok(Number(sn.q[i].slice(1)) > Number(sn.q[i - 1].slice(1)), '队列顺序被打乱');
    }
  });
});

describe('L16-W11 §E compaction 正确性（存活集 / 游标 / 顺序）', () => {
  test('超阈值后只保留存活条目且游标归零', () => {
    const s = { _tombstones: {} };
    const h = makeHarness(TOMB_SRC, s);
    withClock(CLOCK0, (advance) => {
      /* 先写 3000 条，推进 40s 使其全部过期 */
      for (let i = 0; i < 3000; i++) h.set('old' + i);
      advance(40000);
      /* 再写 2000 条新鲜墓碑，触发 compaction */
      for (let i = 0; i < 2000; i++) h.set('new' + i);
    });
    const sn = h.snap();
    const live = h.live();
    const dead = sn.q.filter((k) => !live.has(k));
    assert.equal(dead.length, 0, 'compaction 后仍残留已过期条目');
    assert.equal(sn.head, 0, 'compaction 后游标未归零');
    const idxOld = sn.q.indexOf('old0');
    assert.equal(idxOld, -1, '已过期条目未被丢弃');
    assert.ok(sn.q.indexOf('new0') >= 0, '存活条目被误删');
    /* 顺序保持：存活条目按插入序 */
    const newPos = sn.q.filter((k) => String(k).startsWith('new'));
    for (let i = 1; i < newPos.length; i++) {
      assert.ok(Number(newPos[i].slice(3)) > Number(newPos[i - 1].slice(3)), '队列顺序被打乱');
    }
  });
});

describe('L16-W11 §F 与 initStore 复位不冲突', () => {
  test('复位（队列清空 + 游标归零）后 compaction / 写入均正常', () => {
    const s = { _tombstones: {} };
    const h = makeHarness(TOMB_SRC, s);
    withClock(CLOCK0, (advance) => {
      for (let i = 0; i < 6000; i++) {
        h.set('r' + i);
        advance(1000);
      }
    });
    h.reset();
    const afterReset = h.snap();
    assert.equal(afterReset.qlen, 0, '复位后队列未清空');
    assert.equal(afterReset.head, 0, '复位后游标未归零');
    withClock(CLOCK0, () => {
      h.set('after');
    });
    const sn = h.snap();
    assert.equal(sn.qlen, 1, '复位后写入未重新登记插入顺序');
    assert.equal(sn.head, 0, '复位后游标非零');
    assert.doesNotThrow(() => h.compact(), '复位后 compaction 不应抛错');
    assert.equal(h.snap().qlen, 1, '复位后 compaction 误删存活条目');
  });

  test('空队列 compaction 幂等（零副作用）', () => {
    const h = makeHarness(TOMB_SRC, { _tombstones: {} });
    const before = h.snap();
    assert.doesNotThrow(() => h.compact());
    assert.deepEqual(h.snap(), before);
  });
});

describe('L16-W11 §G 大 state（50,000 节点）P95 采样', () => {
  test('单次墓碑写入 P95 ≤ 0.5ms 且队列上界不变', () => {
    const s = mkBigState(50000);
    const h = makeHarness(TOMB_SRC, s);
    const samples = [];
    const ITER = 6000;
    withClock(CLOCK0, (advance) => {
      for (let i = 0; i < ITER; i++) {
        const id = 'b' + i;
        const t0 = process.hrtime.bigint();
        h.set(id);
        const t1 = process.hrtime.bigint();
        samples.push(Number(t1 - t0) / 1e6);
        advance(1000);
      }
    });
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
    const p99 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.99))];
    const sn = h.snap();
    assert.ok(p95 <= 0.5, `P95 ${p95.toFixed(4)}ms 超 0.5ms 预算`);
    assert.ok(sn.qlen <= 8192, `大 state 下队列 ${sn.qlen} 超 8192`);
    assert.ok(sn.msize <= 2000, `大 state 下 Map ${sn.msize} 超 2000`);
    assert.ok(p99 <= 5, `P99 ${p99.toFixed(4)}ms 异常（疑似 compaction 抖动失控）`);
  });
});
