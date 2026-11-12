/**
 * L12-W4 · E-2「M-H 真虚拟滚动」N 层 — 崩溃/一致性 + 降级开关 H5 + 哨兵 + 指标（一致性套件续扩）
 * ============================================================================
 * 设计依据：`reports/t12-design-2026-10-15.md` §九 W4 行（**崩溃/一致性 + 降级开关 + 哨兵 + 指标**；
 *          `p95 wall-clock`：commit / 切视图 / longtask 三序列）+ §三 H5（降级开关 · LO-3=A 显式 UI 开关）
 *          + §五 5.2（N 层门禁）+ §八（不变量 #32 哨兵 T-110）。
 * 编号纪律：本波为 W3 编号区（T-105 – T-110）的 **N 侧续扩**，**不新增编号**
 *          （T-109 降级接地的 N 侧等价 / T-110 哨兵的 N 侧等价；承接 `l10-w4` / `l11-w4` 范式）。
 *
 * 诚实声明（不得当作「真实产品路径已验证」）：
 *  · 本节为 **N 层**（Node，无浏览器）。真虚拟滚动的**结构性 DOM 断言**由 P 层
 *    `tests/t12-virtual-scroll.spec.ts`（T-105 – T-110）承担；本节以**窗口计算契约**、
 *    **降级三态模型**、**H5 显式开关语义**与**指标纯函数**表达等价语义（S-4「探针只读不改语义」）。
 *  · 崩溃注入以**模型级**表达（窗口计算抛错 → `_virtualDisabled` → 全量路径行数 = total）；
 *    断言口径为「降级置位 + 全量行数 + 池上限」，**不含任何 wall-clock 阈值敏感性**（承接 T-68 范式）。
 *  · H5 显式开关的**产物级**锚（`setVirtualScrollOff` / `_vsUserDisabled` / `virtualScrollOff`）由
 *    本文件对 canonical 文本只读扫描承担；真实 DOM 开关由 P 层 / 手工验收承担。
 *
 * 运行：`node --test l9/t12-w4-consistency.test.mjs`（Node ≥ 22）
 * 红证先行：H5 显式开关（`_vsUserDisabled` / `setVirtualScrollOff`）与指标锚（`VS_METRIC_CAP` /
 *          `vsMetricsStats`）缺位时本文件必须失败。
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
const VIEWPORT_CAP = 200; /* P 层视口上限（l12-w1 §四 冻结） */

/** 确定性 PRNG（mulberry32）——哨兵用；同种子 → 同序列（无 wall-clock / 负载敏感）。 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 窗口计算契约：与 canonical `_vsWindow` 同口径（first/last 可视区间，含 overscan 与硬上限）。 */
function windowOf({ total, scrollTop, vh, layerTop = 0, rowH = VS_ROW_H, overscan = VS_OVERSCAN, maxRows = VS_MAX_ROWS }) {
  let first = Math.max(0, Math.floor((scrollTop - layerTop) / rowH) - overscan);
  let last = Math.min(total, Math.ceil((scrollTop - layerTop + vh) / rowH) + overscan);
  if (last < first) last = first;
  if (last - first > maxRows) last = Math.min(total, first + maxRows);
  return { first, last };
}

/** 降级三态判定（与 canonical `_vsShouldUse` 同口径）：doc 缺位 / 内部降级 / H5 显式关闭 / 打印强制全量 → false。 */
function vsShouldUse({ hasDoc = true, disabled = false, userDisabled = false, printFull = false,
  visible = 0, threshold = VIRTUAL_THRESHOLD }) {
  if (!hasDoc || disabled || userDisabled || printFull) return false;
  return visible > threshold;
}

/** 崩溃注入模型：窗口计算抛错 → 降级置位 + 全量路径（行数 = total）。 */
function renderModel({ total, scrollTop = 0, vh = 720, throwOnWindow = false }) {
  let disabled = false;
  let rows = 0;
  let mode = 'virtual';
  try {
    if (throwOnWindow) throw new Error('VS_WINDOW_CRASH');
    const w = windowOf({ total, scrollTop, vh });
    rows = w.last - w.first;
  } catch (e) {
    disabled = true;   /* 降级安全网 */
    mode = 'full';
    rows = total;      /* 全量路径：逐子树渲染全部行 */
  }
  return { mode, rows, disabled };
}

/** 指标纯函数：nearest-rank p95（与 persist-store `percentile95` 同口径）。 */
function percentile95(arr) {
  if (!arr || !arr.length) return NaN;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(0.95 * s.length) - 1)];
}

/** 指标序列（有界 ring；commit / 切视图 / longtask 三序列口径）。 */
class LatencySeries {
  constructor(cap = 256) { this.cap = cap; this._s = []; this._n = 0; }
  record(ms) {
    const v = Number(ms);
    if (!Number.isFinite(v) || v < 0) return this; /* 非法样本忽略 */
    this._s.push(v);
    if (this._s.length > this.cap) this._s.splice(0, this._s.length - this.cap);
    this._n++;
    return this;
  }
  p95() { return percentile95(this._s); }
  stats() { return { p95: this.p95(), samples: this._n, window: this._s.length }; }
}

describe('L12-W4 §崩溃/一致性（降级三态 + 崩溃注入 · 模型级）', () => {
  test('T-109(N) 降级三态 · 阈值内 / 超阈值 / 显式关闭 判定', () => {
    /* 阈值内（小文档）→ 不虚拟化（原全量路径） */
    assert.equal(vsShouldUse({ visible: VIRTUAL_THRESHOLD }), false, '等于阈值不触发（> 阈值）');
    assert.equal(vsShouldUse({ visible: 10 }), false, '小文档 → 全量');
    /* 超阈值 → 虚拟化 */
    assert.equal(vsShouldUse({ visible: VIRTUAL_THRESHOLD + 1 }), true, '超阈值 → 虚拟化');
    /* 内部降级（异常后会话级）→ 全量 */
    assert.equal(vsShouldUse({ visible: 100000, disabled: true }), false, '内部降级 → 全量');
    /* H5 显式关闭 → 全量 */
    assert.equal(vsShouldUse({ visible: 100000, userDisabled: true }), false, 'H5 显式关闭 → 全量');
    /* D-7 打印强制全量 */
    assert.equal(vsShouldUse({ visible: 100000, printFull: true }), false, '打印 → 临时全量');
    /* doc 缺位 → 全量 */
    assert.equal(vsShouldUse({ hasDoc: false, visible: 100000 }), false, 'doc 缺位 → 全量');
  });

  test('T-109(N) 崩溃注入 · 窗口计算抛错 → 降级置位 + 全量行数 = total', () => {
    const total = 100000;
    const ok = renderModel({ total, scrollTop: 5000, vh: 720 });
    assert.equal(ok.mode, 'virtual');
    assert.equal(ok.disabled, false);
    assert.ok(ok.rows <= VS_MAX_ROWS, '窗口行数 ≤ 池上限');
    assert.ok(ok.rows < total, '窗口严格小于全量');

    const bad = renderModel({ total, scrollTop: 5000, vh: 720, throwOnWindow: true });
    assert.equal(bad.disabled, true, '崩溃 → 降级安全网置位');
    assert.equal(bad.mode, 'full', '崩溃 → 全量路径');
    assert.equal(bad.rows, total, '全量路径行数 = total');

    /* 降级后再次判定：即使超阈值也不再虚拟化（会话级持久） */
    assert.equal(vsShouldUse({ visible: total, disabled: true }), false, '降级后保持全量');
  });

  test('H5 显式开关 · _vsUserDisabled=true → 永不虚拟化（等价全量）', () => {
    /* 关闭态：任意规模 → 全量路径 */
    for (const visible of [201, 5000, 100000]) {
      assert.equal(vsShouldUse({ visible, userDisabled: true }), false, '关闭 → 全量 @' + visible);
    }
    /* 重新开启：超阈值恢复虚拟化 */
    assert.equal(vsShouldUse({ visible: 100000, userDisabled: false }), true, '重新开启 → 虚拟化');
  });
});

describe('L12-W4 §H5 降级开关（显式 UI 开关 · 产物级只读扫描）', () => {
  test('H5 锚存在性 · 显式开关符号 + 持久化字段 + 播报文案', () => {
    const tokens = [
      '_vsUserDisabled',          /* 显式关闭标志（H5） */
      'setVirtualScrollOff',      /* 设置面板开关元素 id */
      'virtualScrollOff',         /* 持久化字段（saveUI / loadUI） */
      '关闭虚拟滚动',              /* 用户可见文案 */
      '_virtualDisabled',         /* 内部降级（保留） */
      'virtual-scroll-fallback',  /* 降级报告锚（保留） */
    ];
    const missing = tokens.filter(t => !SRC.includes(t));
    assert.deepEqual(missing, [], '缺 H5 锚：' + missing.join(','));
  });

  test('H5 接地 · _vsShouldUse 认显式关闭标志（判定接入）', () => {
    /* canonical 的 _vsShouldUse 必须包含 _vsUserDisabled 短路 */
    const m = SRC.match(/function\s+_vsShouldUse\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
    assert.ok(m, '缺 _vsShouldUse 定义');
    assert.ok(m[0].includes('_vsUserDisabled'), '_vsShouldUse 未接入 _vsUserDisabled');
  });
});

describe('L12-W4 §哨兵 + §指标', () => {
  test('T-110(N) 哨兵 · 200 步确定性滚动序列 → 窗口映射有界且单调不减', () => {
    const rand = mulberry32(0xC0FFEE);
    const total = 100000;
    const contentH = total * VS_ROW_H;
    let prevFirst = -1; let prevLast = -1;
    for (let step = 0; step < 200; step++) {
      const scrollTop = Math.floor(rand() * Math.max(1, contentH));
      const vh = 600 + Math.floor(rand() * 1000);
      const w = windowOf({ total, scrollTop, vh });
      assert.ok(w.first >= 0 && w.last <= total, `区间落在 [0,total] @${step}`);
      assert.ok(w.last >= w.first, `last ≥ first @${step}`);
      assert.ok(w.last - w.first <= VS_MAX_ROWS, `窗口 ≤ 池上限 @${step}`);
      assert.ok(w.last - w.first <= VIEWPORT_CAP, `窗口 ≤ 视口上限 @${step}`);
    }
    /* 单调性（固定视口，滚动递增）：滚动位置 ↔ 渲染区间映射单调不减 */
    for (let s = 0; s <= 60000; s += 500) {
      const w = windowOf({ total, scrollTop: s, vh: 720 });
      assert.ok(w.first >= prevFirst, `first 单调 @${s}`);
      assert.ok(w.last >= prevLast, `last 单调 @${s}`);
      prevFirst = w.first; prevLast = w.last;
    }
    const end = windowOf({ total, scrollTop: total * VS_ROW_H - 720, vh: 720 });
    assert.equal(end.last, total, '滚到底 → 末行 = total');
  });

  test('指标 · p95 nearest-rank（纯函数）', () => {
    assert.equal(Number.isNaN(percentile95([])), true, '无样本 → NaN');
    assert.equal(percentile95([7]), 7);
    assert.equal(percentile95([1, 2, 3, 4, 5]), 5);              /* rank = ceil(0.95*5) = 5 */
    assert.equal(percentile95(Array.from({ length: 20 }, (_, i) => i + 1)), 19);
    assert.equal(percentile95(Array.from({ length: 100 }, (_, i) => i + 1)), 95);
    assert.equal(percentile95([5, 1, 3, 2, 4]), 5, '纯函数不改写入参');
  });

  test('指标 · commit / 切视图 / longtask 三序列独立（合成样本）', () => {
    const commit = new LatencySeries();
    const viewSwitch = new LatencySeries();
    const longtask = new LatencySeries();
    for (let i = 1; i <= 20; i++) commit.record(i);          /* 1..20 → p95 = 19 */
    for (let i = 1; i <= 20; i++) viewSwitch.record(i * 2);  /* 2..40 → p95 = 38 */
    for (let i = 1; i <= 20; i++) longtask.record(i * 3);    /* 3..60 → p95 = 57 */

    assert.equal(commit.p95(), 19);
    assert.equal(viewSwitch.p95(), 38);
    assert.equal(longtask.p95(), 57);
    assert.deepEqual(commit.stats(), { p95: 19, samples: 20, window: 20 });
    assert.equal(viewSwitch.stats().samples, 20);
    assert.equal(longtask.stats().samples, 20);

    /* 非法样本忽略；ring 上限生效 */
    commit.record(NaN); commit.record(-1);
    assert.equal(commit.stats().samples, 20, '非法样本忽略');
    const tiny = new LatencySeries(3);
    for (const v of [10, 20, 30, 40]) tiny.record(v);
    assert.equal(tiny.stats().window, 3, 'ring 上限 3 → 窗口最多 3');
    assert.equal(tiny.stats().samples, 4, '累计计数单调');
  });

  test('指标 · canonical 暴露度量锚（ring 上限 + 统计入口 + longtask 观察者）', () => {
    const tokens = [
      'VS_METRIC_CAP',        /* 有界 ring 上限 */
      'vsMetricsStats',       /* 统计入口（p95 / samples） */
      '__juVsMetrics',        /* 供 P 层 / 手工验收读取 */
      "PerformanceObserver",  /* longtask 观察者 */
      "entryTypes:['longtask']",
    ];
    const missing = tokens.filter(t => !SRC.includes(t));
    assert.deepEqual(missing, [], '缺指标锚：' + missing.join(','));
    assert.equal(SRC.includes("_vsMetricPush('commit'"), true, 'commit 序列已接线');
    assert.equal(SRC.includes("_vsMetricPush('viewSwitch'"), true, '切视图序列已接线');
  });
});
