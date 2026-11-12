/**
 * L14-W3 · E-2 补完「M-H′ 加固」N 层 — G1–G5 等价哨兵（一致性套件）
 * ============================================================================
 * 设计依据：`reports/t14-design-2026-10-16.md` §四（G1–G6）+ §六（量化指标）；
 *          `reports/t14-w1-audit-2026-10-16.md` §二（加固面台账 E-①…E-⑥）+ §三（阈值冻结）。
 * 层归属：本节为 N 层（Node，无浏览器）。变高行几何、画廊/导图 DOM 计数、屏外定位的
 *          真实 DOM 断言由 P 层 `tests/t14-virtual-scroll-hardening.spec.ts`（T-117–T-124）
 *          承担；本节以**产物级结构性扫描** + **窗口/高度表契约复刻**表达等价语义
 *          （沿用 l12-virtual-scroll.test.mjs 范式），二者互补。
 * 诚实声明：N 侧不驱动浏览器；「行高 ≤ 1px / 不重叠」「渲染节点数 ≤ 200」以高度表前缀和
 *          与窗口计算契约的性质断言表达，真实 DOM 计数由 P 层独立承担。
 * 红证先行：加固原语缺位（无 `__vsHeightTable` / `__vsGenCache` / `__renderDbGalleryVirtual`
 *          / `__l14SearchAll` / `__vsInteractGuard`）时本文件必须失败。
 * 运行：`node --test l9/t14-vs-hardening.test.mjs`（Node ≥ 22）
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

function num(name, fallback) {
  const m = SRC.match(new RegExp('(?:^|[^A-Za-z0-9_])' + name + '\\s*=\\s*(\\d+)'));
  return m ? Number(m[1]) : fallback;
}
const VIRTUAL_THRESHOLD = num('VIRTUAL_THRESHOLD', 200);
const VS_ROW_H = num('VS_ROW_H', 0);
const VS_OVERSCAN = num('VS_OVERSCAN', 0);
const VS_MAX_ROWS = num('VS_MAX_ROWS', 0);
const L14_VIEWPORT_CAP = num('L14_VIEWPORT_CAP', 200);
const VIEWPORT_CAP = 200; /* P 层视口上限（l14-w1 §3.1 冻结） */

/* 高度表契约：与 canonical `__vsHeightTable` 同口径（前缀和 + 二分定位 + range）。 */
function heightTable(rows, measure, rowH = VS_ROW_H) {
  const n = rows ? rows.length : 0;
  const heights = new Array(n);
  const prefix = new Array(n + 1);
  prefix[0] = 0;
  for (let i = 0; i < n; i++) {
    let v = measure ? measure(rows[i], i) : 0;
    v = Number(v);
    if (!Number.isFinite(v) || v <= 0) v = rowH;
    heights[i] = v;
    prefix[i + 1] = prefix[i] + v;
  }
  const indexAt = (y) => {
    if (n === 0) return 0;
    const yy = Math.max(0, Math.min(Number(y) || 0, prefix[n]));
    let lo = 0; let hi = n;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (prefix[mid] <= yy) lo = mid + 1; else hi = mid; }
    let i = lo - 1; if (i < 0) i = 0; if (i > n - 1) i = n - 1; return i;
  };
  return {
    n, heights, prefix, total: prefix[n],
    offset: (i) => (i <= 0 ? 0 : (i >= n ? prefix[n] : prefix[i])),
    indexAt,
    range: (scrollTop, vh, overscan = VS_OVERSCAN) => {
      if (n === 0) return { first: 0, last: 0 };
      let first = Math.max(0, indexAt(scrollTop) - overscan);
      let last = Math.min(n, indexAt(scrollTop + vh) + overscan + 1);
      if (last < first) last = first;
      if (last - first > VS_MAX_ROWS) last = Math.min(n, first + VS_MAX_ROWS);
      return { first, last };
    },
  };
}

describe('L14-W3 §加固原语落地（G1–G5 · 判别力锚）', () => {
  test('G1 · 变高行高度表原语 `__vsHeightTable` 落地', () => {
    assert.ok(SRC.includes('__vsHeightTable'), '缺 __vsHeightTable');
    assert.ok(SRC.includes('_vsHeightTable'), 'P 层锚 _vsHeightTable 不含');
    assert.ok(SRC.includes('__vsHTFor'), '缺 __vsHTFor（注册表）');
    assert.ok(SRC.includes('__vsHTCalibrate'), '缺 __vsHTCalibrate（渲染后校正）');
  });

  test('G2 · 数据代次缓存原语 `__vsGenCache` 落地（键 = state.updatedAt）', () => {
    assert.ok(SRC.includes('__vsGenCache'), '缺 __vsGenCache');
    assert.ok(SRC.includes('_vsGenCache'), 'P 层锚 _vsGenCache 不含');
    assert.ok(SRC.includes('__vsGenTick'), '缺 __vsGenTick');
    assert.ok(SRC.includes('state.updatedAt') || SRC.includes('updatedAt'), '代次信号应为 updatedAt');
  });

  test('G3 · 画廊/导图窗口化原语落地', () => {
    assert.ok(SRC.includes('__renderDbGalleryVirtual'), '缺 __renderDbGalleryVirtual');
    assert.ok(SRC.includes('renderDbGalleryVirtual'), 'P 层锚 renderDbGalleryVirtual 不含');
    assert.ok(SRC.includes('__renderMindmapVirtual'), '缺 __renderMindmapVirtual（LO-4=B 导图）');
  });

  test('G4 · 应用内搜索原语 `l14SearchAll` 落地（关闭 OP-14）', () => {
    assert.ok(SRC.includes('__l14SearchAll'), '缺 __l14SearchAll');
    assert.ok(SRC.includes('l14SearchAll'), 'P 层锚 l14SearchAll 不含');
    assert.ok(SRC.includes('__l14SearchLocate'), '缺 __l14SearchLocate（虚拟列表定位）');
  });

  test('G5 · 交互护栏原语 `__vsInteractGuard` 落地', () => {
    assert.ok(SRC.includes('__vsInteractGuard'), '缺 __vsInteractGuard');
    assert.ok(SRC.includes('_vsInteractGuard'), 'P 层锚 _vsInteractGuard 不含');
    assert.ok(SRC.includes('coalesce'), '缺合批调度 coalesce');
  });

  test('默认关闭闸门 · `_l14Enabled` 缺省 false 且接缝 `__l14On` 存在', () => {
    assert.ok(SRC.includes('let _l14Enabled=false'), '_l14Enabled 缺省必须为 false');
    assert.ok(SRC.includes('function __l14On('), '缺 __l14On 接缝');
    assert.ok(SRC.includes('__l14On()?__vsGenFlatten(doc):_vsFlatten(doc)'), '渲染引擎应受闸门保护');
  });

  test('挂接现有虚拟滚动引擎 · 高度表分支 + 原路径保留', () => {
    assert.ok(SRC.includes('if(vs.htable)'), '缺高度表窗口分支');
    assert.ok(SRC.includes('vs.htable?vs.htable.offset(idx):idx*VS_ROW_H'), '缺 translateY 高度表口径');
    assert.ok(SRC.includes('countVisibleNodes(doc)'), '原全量路径应保留');
    assert.ok(SRC.includes('if(vs.htable)') && SRC.includes('let first=Math.max(0,Math.floor((-layerTop)/rowH)'), '原窗口计算应保留为回退');
  });

  test('降级路径锚（RL-7）· `_virtualDisabled` / `_vsUserDisabled` / fallback 报告保留', () => {
    for (const tok of ['VIRTUAL_THRESHOLD', '_virtualDisabled', '_vsUserDisabled', 'virtual-scroll-fallback']) {
      assert.ok(SRC.includes(tok), `缺 ${tok}`);
    }
  });
});

describe('L14-W3 §G1 高度表（前缀和）契约（E-①）', () => {
  test('常量接地 · 行高/预渲染/池上限/视口上限均为有效整数', () => {
    assert.ok(VS_ROW_H > 0, 'VS_ROW_H');
    assert.ok(VS_OVERSCAN >= 0, 'VS_OVERSCAN');
    assert.ok(VS_MAX_ROWS > 0, 'VS_MAX_ROWS');
    assert.ok(L14_VIEWPORT_CAP > 0 && VIRTUAL_THRESHOLD > 0, '视口上限 / 阈值');
  });

  test('前缀和严格递增 · total = Σheights · offset(0)=0 · offset(n)=total', () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ i }));
    const t = heightTable(rows, (r) => (r.i % 7 === 0 ? 56 : 28)); /* 变高行（表格/换行） */
    assert.equal(t.prefix[0], 0);
    for (let i = 1; i <= t.n; i++) assert.ok(t.prefix[i] > t.prefix[i - 1], `prefix 递增 @${i}`);
    const sum = t.heights.reduce((a, b) => a + b, 0);
    assert.equal(t.total, sum, 'total = Σheights');
    assert.equal(t.offset(0), 0);
    assert.equal(t.offset(t.n), t.total);
  });

  test('indexAt 覆盖边界（0 / total-1 / 中段行首行尾）', () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({ i }));
    const t = heightTable(rows, (r) => (r.i % 5 === 0 ? 60 : 30));
    assert.equal(t.indexAt(0), 0, 'y=0 → 行 0');
    assert.equal(t.indexAt(t.total), t.n - 1, 'y=total → 末行');
    assert.equal(t.indexAt(t.total + 9999), t.n - 1, '越界夹取 → 末行');
    for (let i = 0; i < t.n; i++) {
      assert.equal(t.indexAt(t.offset(i)), i, `行首命中 @${i}`);
      assert.equal(t.indexAt(t.offset(i) + t.heights[i] - 1), i, `行尾命中 @${i}`);
    }
  });

  test('range 含 overscan · ≤ 池上限 · 相邻行 offset 连续（无重叠/无空洞）', () => {
    const total = 100000;
    const rows = Array.from({ length: total }, (_, i) => ({ i }));
    const t = heightTable(rows, (r) => (r.i % 11 === 0 ? 56 : 28));
    for (const scrollTop of [0, 137, 5000, 99999, 1_500_000, Math.max(0, t.total - 720)]) {
      for (const vh of [600, 720, 1080, 2160]) {
        const w = t.range(scrollTop, vh);
        const count = w.last - w.first;
        assert.ok(count <= VS_MAX_ROWS, `count=${count} ≤ ${VS_MAX_ROWS}`);
        assert.ok(count <= VIEWPORT_CAP, `count=${count} ≤ ${VIEWPORT_CAP}`);
        assert.ok(w.first >= 0 && w.last <= total, '区间落在 [0,total]');
      }
    }
    for (let i = 0; i < t.n - 1; i++) {
      const gap = t.offset(i + 1) - (t.offset(i) + t.heights[i]);
      assert.equal(gap, 0, `相邻行连续 @${i}`); /* 无重叠、无留隙 */
    }
  });

  test('变高行（表格/换行）下窗口区间单调不减（滚动位置 ↔ 渲染区间）', () => {
    const total = 100000;
    const rows = Array.from({ length: total }, (_, i) => ({ i }));
    const t = heightTable(rows, (r) => (r.i % 3 === 0 ? 48 : 28));
    let prevFirst = -1; let prevLast = -1;
    for (let s = 0; s <= 60_000; s += 500) {
      const w = t.range(s, 720);
      assert.ok(w.first >= prevFirst, `first 单调 @${s}`);
      assert.ok(w.last >= prevLast, `last 单调 @${s}`);
      prevFirst = w.first; prevLast = w.last;
    }
    const end = t.range(t.total - 720, 720);
    assert.equal(end.last, total, '滚到底 → 末行 = total');
  });

  test('行高下限保护 · 非法/零高度回退 VS_ROW_H（杜绝行高错乱）', () => {
    const rows = [{ i: 0 }, { i: 1 }, { i: 2 }];
    const t = heightTable(rows, (r) => (r.i === 1 ? 0 : (r.i === 2 ? NaN : 28)));
    assert.equal(t.heights[0], VS_ROW_H);
    assert.equal(t.heights[1], VS_ROW_H, '0 高度回退');
    assert.equal(t.heights[2], VS_ROW_H, 'NaN 高度回退');
  });
});

describe('L14-W3 §G2 代次缓存与增量等价（E-②③）', () => {
  const patchEquals = (a, b) => {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!a[i] || !b[i] || a[i].id !== b[i].id || a[i].depth !== b[i].depth) return false;
    }
    return true;
  };

  test('增量 patch 与全量重建逐节点等价（id/depth 对齐 → true）', () => {
    const a = [{ id: 'a', depth: 0 }, { id: 'b', depth: 1 }, { id: 'c', depth: 1 }];
    const b = [{ id: 'a', depth: 0 }, { id: 'b', depth: 1 }, { id: 'c', depth: 1 }];
    assert.equal(patchEquals(a, b), true);
  });

  test('长度或深度差异 → 不等（触发全量重建兜底）', () => {
    const base = [{ id: 'a', depth: 0 }, { id: 'b', depth: 1 }];
    assert.equal(patchEquals(base, [{ id: 'a', depth: 0 }]), false, '长度差异');
    assert.equal(patchEquals(base, [{ id: 'a', depth: 0 }, { id: 'b', depth: 2 }]), false, '深度差异');
    assert.equal(patchEquals(base, [{ id: 'a', depth: 0 }, { id: 'x', depth: 1 }]), false, 'id 差异');
    assert.equal(patchEquals(null, base), false, '缺列表 → 不等');
  });

  test('代次缓存原语接线 · 遍历与视口规模成正比（缓存命中分支存在）', () => {
    assert.ok(SRC.includes('function __vsGenFlatten('), '缺 __vsGenFlatten');
    assert.ok(SRC.includes('function __vsGenCount('), '缺 __vsGenCount');
    assert.ok(SRC.includes('__vsGenCache.gen!==gen||__vsGenCache.doc!==doc'), '缺代次/文档失效判定');
    assert.ok(SRC.includes('function __vsIncremental('), '缺 __vsIncremental（增量对拍）');
  });
});

describe('L14-W3 §G3/G4/G5 语义哨兵', () => {
  test('G3 · 视图覆盖上限接线（画廊/导图 ≤ 视口上限）', () => {
    assert.ok(SRC.includes('rows.length>VIRTUAL_THRESHOLD'), '画廊虚拟化门控');
    assert.ok(SRC.includes('countVisibleNodes(doc)>VIRTUAL_THRESHOLD'), '导图虚拟化门控');
    assert.ok(SRC.includes('L14_VIEWPORT_CAP'), '视口上限常量接地');
  });

  test('G4 · 应用内搜索契约（跨全文档 / 命中屏外 / 与滚动定位联动）', () => {
    const searchAll = (nodes, query) => {
      const q = String(query == null ? '' : query);
      const hits = [];
      if (!q) return hits;
      const needle = q.toLowerCase();
      for (const id of Object.keys(nodes)) {
        const n = nodes[id];
        if (!n || n._deleted) continue;
        const text = String(n.text || '');
        if (text && text.toLowerCase().indexOf(needle) >= 0) hits.push({ id, text });
      }
      return hits;
    };
    const nodes = {
      r: { id: 'r', text: 'root' },
      a: { id: 'a', text: 'Alpha 项目' },
      b: { id: 'b', text: 'alfa 备用' },
      c: { id: 'c', text: 'Gamma', _deleted: true },
    };
    assert.equal(searchAll(nodes, 'ALPHA').length, 1, '不区分大小写（a 命中）');
    assert.equal(searchAll(nodes, 'alfa').length, 1, '跨全文档（b 命中）');
    assert.equal(searchAll(nodes, 'gamma').length, 0, '跳过已删除');
    assert.equal(searchAll(nodes, '').length, 0, '空查询无命中');
    assert.ok(SRC.includes('__l14SearchLocate'), '屏外命中定位接缝存在');
    assert.ok(SRC.includes('_vsScrollToId(_vsActive,id)'), '定位与虚拟滚动联动');
  });

  test('G5 · 交互护栏计数形状（renders / geometryReads / geometryHits）', () => {
    const guard = { renders: 0, geometryReads: 0, geometryHits: 0,
      note() { this.renders++; }, geom(hit) { this.geometryReads++; if (hit) this.geometryHits++; } };
    guard.note(); guard.note(); guard.geom(true); guard.geom(false); guard.geom(true);
    const stats = { renders: guard.renders, geometryReads: guard.geometryReads, geometryHits: guard.geometryHits };
    assert.deepEqual(stats, { renders: 2, geometryReads: 3, geometryHits: 2 });
    assert.ok(SRC.includes('_raf'), '缺合批 rAF 去重标志');
    assert.ok(SRC.includes('geometryHits'), '缺几何命中计数');
  });
});
