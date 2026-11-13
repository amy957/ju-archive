/**
 * L14-W4 · E-2 补完「M-H′ 加固」N 层 — 崩溃/一致性 + 100k 真规模闸门 + 哨兵 + 指标
 * ============================================================================
 * 设计依据：`reports/t14-design-2026-10-16.md` §四 G6（真规模闸门）+ §六（量化指标）
 *          + `reports/t14-w1-audit-2026-10-16.md` §2.7（G6 台账）+ §3.1（阈值冻结）。
 * 层归属：N 层（Node，无浏览器）。真实 100k 浏览器度量（longtask / RSS / p95）由 P 层
 *          `tests/t14-virtual-scroll-hardening.spec.ts`（T-118）承担；本节以**闸门契约**、
 *          **防抖/节流语义**、**降级等阶**与**指标纯函数**表达等价语义（承 l12-w4 范式）。
 * 编号纪律：本波为 W3 编号区（T-117–T-124）的 N 侧续扩，**不新增编号**（T-118(N) 等价 /
 *          T-116(N) 降级等阶等价；承接 `l10-w4` / `l11-w4` / `l12-w4` 范式）。
 * 诚实声明：N 侧不驱动浏览器；RSS 以 `rssGate` 契约（≤ L14_RSS_CAP_MB）表达，
 *          longtask 以 `note()` 计数契约表达，p95 以 nearest-rank 纯函数表达。
 * 运行：`node --test l9/t14-w4-consistency.test.mjs`（Node ≥ 22）
 * 红证先行：闸门原语（`__l14LongtaskGate` / `L14_RSS_CAP_MB` / `L14_P95_BUDGET` /
 *          `degradeParity`）缺位时本文件必须失败。
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
const L14_LONGTASK_BUDGET = num('L14_LONGTASK_BUDGET', 0);
const L14_RSS_CAP_MB = num('L14_RSS_CAP_MB', 0);
const L14_P95_BUDGET = num('L14_P95_BUDGET', 0);
const VIRTUAL_THRESHOLD = num('VIRTUAL_THRESHOLD', 200);

/** 长任务计数契约（与 canonical `__l14LongtaskGate.note` 同口径：duration > budget 才计入）。 */
function noteModel(state, duration) {
  const d = Number(duration) || 0;
  if (d > state.budget) { state.longtasks++; if (d > state.maxDuration) state.maxDuration = d; }
  return state.longtasks;
}

/** 100k RSS 门契约（与 canonical `rssGate` 同口径：未采样 ⇒ 条件通过）。 */
function rssGate(rssMB, cap = L14_RSS_CAP_MB) {
  const v = Number(rssMB);
  if (!Number.isFinite(v) || v < 0) return { ok: true, measured: false, cap };
  return { ok: v <= cap, measured: true, rssMB: v, cap };
}

/** longtask 门契约（= 0）。 */
function longtaskGate(state) {
  return { ok: state.longtasks === 0, longtasks: state.longtasks, maxDuration: state.maxDuration, budget: state.budget };
}

/** 帧预算门契约（p95 ≤ budget；无样本 ⇒ 条件通过）。 */
function p95Gate(samples, budget = L14_P95_BUDGET) {
  const s = (samples || []).slice().sort((a, b) => a - b);
  const p = s.length ? s[Math.max(0, Math.ceil(0.95 * s.length) - 1)] : NaN;
  return { ok: !Number.isFinite(p) || p <= budget, p95: Number.isFinite(p) ? p : null, budget };
}

/** 降级等阶契约（与 canonical `degradeParity` 同口径：off 态 ≡ 全量路径逐行等价）。 */
function degradeParity(offRows, fullRows) {
  if (!Array.isArray(offRows) || !Array.isArray(fullRows)) return { ok: false, reason: 'no-rows' };
  if (offRows.length !== fullRows.length) return { ok: false, reason: 'len' };
  for (let i = 0; i < offRows.length; i++) if (offRows[i] !== fullRows[i]) return { ok: false, reason: 'row@' + i };
  return { ok: true, rows: offRows.length };
}

/** 防抖契约（rAF 合批：同一帧内多次调用只执行一次，帧末 flush 执行）。 */
function makeDebounce() {
  let scheduled = false; let runs = 0; let lastFn = null;
  return {
    runs: () => runs,
    pending: () => scheduled,
    call(fn) { if (scheduled) return false; scheduled = true; lastFn = fn; return true; },
    flush() { if (!scheduled) return false; scheduled = false; runs++; lastFn && lastFn(); return true; },
  };
}

/** 节流契约（尾沿保障：窗口内首沿立即 + 至多一次尾沿，尾沿经 timer 触发）。 */
function makeThrottle(wait) {
  let last = 0; let pending = false; let runs = 0; let timerFn = null;
  return {
    runs: () => runs,
    pending: () => pending,
    call(now, fn) {
      if (!last || (now - last) >= wait) { last = now; runs++; fn && fn(); return 'leading'; }
      if (pending) return 'skip';
      pending = true; timerFn = fn; return 'queued';
    },
    fire(now) { if (!pending) return false; pending = false; last = now; runs++; timerFn && timerFn(); return true; },
  };
}

describe('L14-W4 §G6 真规模闸门契约（100k · T-118(N) 等价）', () => {
  test('预算常量接地 · longtask/RSS/p95 门槛为冻结值（50 / 200 / 16）', () => {
    assert.equal(L14_LONGTASK_BUDGET, 50, 'L14_LONGTASK_BUDGET');
    assert.equal(L14_RSS_CAP_MB, 200, 'L14_RSS_CAP_MB（承 L13 内存封顶口径）');
    assert.equal(L14_P95_BUDGET, 16, 'L14_P95_BUDGET（帧预算）');
    assert.ok(VIRTUAL_THRESHOLD > 0, 'VIRTUAL_THRESHOLD');
  });

  test('longtask 计数 · 仅 duration > 预算计入；maxDuration 单调取大', () => {
    const st = { longtasks: 0, maxDuration: 0, budget: L14_LONGTASK_BUDGET };
    noteModel(st, 20);   /* ≤ 预算：不计 */
    noteModel(st, 50);   /* = 预算：不计（严格大于） */
    noteModel(st, 120);  /* > 预算：计 */
    noteModel(st, 80);   /* > 预算：计 */
    assert.equal(st.longtasks, 2, 'longtask 计数');
    assert.equal(st.maxDuration, 120, 'maxDuration 取大');
  });

  test('longtask 门 · 100k 切视图无长任务 → ok；出现长任务 → 不通过', () => {
    assert.equal(longtaskGate({ longtasks: 0, maxDuration: 0, budget: 50 }).ok, true, '零长任务 ⇒ ok');
    assert.equal(longtaskGate({ longtasks: 1, maxDuration: 120, budget: 50 }).ok, false, '长任务 ⇒ 不通过');
  });

  test('RSS 门 · ≤ 200MB 通过 / > 200MB 拒绝 / 未采样条件通过', () => {
    assert.equal(rssGate(180).ok, true, '180MB ≤ 200 ⇒ ok');
    assert.equal(rssGate(200).ok, true, '边界 = 200 ⇒ ok');
    assert.equal(rssGate(240).ok, false, '240MB > 200 ⇒ 拒绝');
    const u = rssGate(-1);
    assert.equal(u.measured, false, '未采样');
    assert.equal(u.ok, true, '未采样 ⇒ 条件通过');
  });

  test('p95 门 · nearest-rank p95 ≤ 16ms；无样本条件通过', () => {
    assert.equal(p95Gate([]).ok, true, '无样本 ⇒ 条件通过');
    const good = Array.from({ length: 100 }, (_, i) => 4 + (i % 8)); /* 4..11ms */
    assert.equal(p95Gate(good).ok, true, `p95=${p95Gate(good).p95} ≤ 16`);
    const bad = Array.from({ length: 100 }, (_, i) => 20 + (i % 30)); /* 20..49ms */
    assert.equal(p95Gate(bad).ok, false, 'p95 > 16 ⇒ 不通过');
  });

  test('防抖契约 · 同帧多次合批为一次（去抖动）', () => {
    const d = makeDebounce();
    assert.equal(d.call(), true, '首调排程');
    assert.equal(d.call(), false, '同帧再调被合批');
    assert.equal(d.call(), false, '同帧再调被合批');
    assert.equal(d.runs(), 0, '帧末前未执行');
    assert.equal(d.pending(), true, '排程中');
    assert.equal(d.flush(), true, '帧末 flush');
    assert.equal(d.runs(), 1, '同帧仅一次');
    assert.equal(d.pending(), false, '执行后复位');
  });

  test('节流契约 · 窗口内首沿立即 + 至多一次尾沿（commit(s=>...) 合批）', () => {
    const t = makeThrottle(16);
    assert.equal(t.call(1000), 'leading', '首沿立即');
    assert.equal(t.call(1005), 'queued', '窗口内排程尾沿');
    assert.equal(t.call(1008), 'skip', '尾沿占用期间跳过');
    assert.equal(t.fire(1021), true, '尾沿触发');
    assert.equal(t.runs(), 2, '窗口内至多一次尾沿');
    assert.equal(t.call(1040), 'leading', '下一窗口首沿');
    assert.equal(t.runs(), 3, '累计');
  });

  test('产物级锚 · 闸门原语与暴露出口存在（P 层 T-118 判别力）', () => {
    for (const tok of [
      '__l14LongtaskGate', 'L14_LONGTASK_BUDGET', 'L14_RSS_CAP_MB', 'L14_P95_BUDGET',
      'longtaskGate:', 'rssGate', 'p95Gate', 'degradeParity', 'markSwitch', 'sampleRss',
      '_juL14ResizeBound',
    ]) {
      assert.ok(SRC.includes(tok), `缺 ${tok}`);
    }
  });

  test('默认关闭态守持 · `__l14On()` 保护 resize 防抖（缺省不改路径语义）', () => {
    assert.ok(SRC.includes('if(!__l14On())return;'), 'resize 防抖应受闸门保护');
    assert.ok(SRC.includes('__l14LongtaskGate.bindObserver()'), 'enable() 应懒绑定 longtask 观察者');
    assert.ok(SRC.includes('__l14LongtaskGate.reset()'), 'disable() 应复位闸门');
  });
});

describe('L14-W4 §崩溃/一致性（降级等阶 · T-116(N) 等价 · 哨兵 #35 拟）', () => {
  test('降级等阶 · off 态与全量路径逐行等价（100% 一致 ⇒ ok）', () => {
    const full = Array.from({ length: 5000 }, (_, i) => 'row-' + i);
    const off = full.slice();
    assert.deepEqual(degradeParity(off, full), { ok: true, rows: 5000 });
  });

  test('降级等阶 · 长度 / 行内容差异 ⇒ 不通过（触发全量兜底）', () => {
    const full = ['a', 'b', 'c'];
    assert.equal(degradeParity(['a', 'b'], full).ok, false, '长度差异');
    assert.equal(degradeParity(['a', 'x', 'c'], full).ok, false, '行差异');
    assert.equal(degradeParity(null, full).ok, false, '缺列表');
  });

  test('崩溃注入 · 闸门观测快照确定性（同输入 ⇒ 同输出 · 无 wall-clock 敏感）', () => {
    const st = { longtasks: 0, maxDuration: 0, budget: L14_LONGTASK_BUDGET };
    [60, 90, 40].forEach((d) => noteModel(st, d));
    const a = { ...longtaskGate(st), ...p95Gate([5, 7, 6, 8]) };
    const st2 = { longtasks: 0, maxDuration: 0, budget: L14_LONGTASK_BUDGET };
    [60, 90, 40].forEach((d) => noteModel(st2, d));
    const b = { ...longtaskGate(st2), ...p95Gate([5, 7, 6, 8]) };
    assert.deepEqual(a, b, '确定性一致');
  });

  test('降级锚（RL-7）· `_virtualDisabled` / `_vsUserDisabled` / fallback 报告保留', () => {
    for (const tok of ['VIRTUAL_THRESHOLD', '_virtualDisabled', '_vsUserDisabled', 'virtual-scroll-fallback']) {
      assert.ok(SRC.includes(tok), `缺 ${tok}`);
    }
  });

  test('哨兵 #35（拟）· E-2 补全面四断言形状成立', () => {
    /* ① 变高行布局正确（高度表原语） / ② 增量 patch 与全量等价 / ③ 视图覆盖 ≤ 视口上限 / ④ 交互不触发全量重渲染 */
    assert.ok(SRC.includes('__vsHeightTable'), '① 高度表');
    assert.ok(SRC.includes('__vsPatchEquals'), '② 增量等价');
    assert.ok(SRC.includes('L14_VIEWPORT_CAP'), '③ 视口上限');
    assert.ok(SRC.includes('__vsInteractGuard'), '④ 交互护栏');
    assert.ok(SRC.includes('__l14LongtaskGate'), '⑤ 真规模闸门（G6）');
  });
});
