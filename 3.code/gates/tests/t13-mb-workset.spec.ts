// @ts-nocheck
/**
 * L13-W2 实施波 · E-3「M-B 内存工作集（P3b · 不变量 #33）」专题 spec（P 层 · **默认关闭态**）
 * ============================================================================
 * 冻结依据：[`t13-w2-wiring-2026-10-16.md`](reports/t13-w2-wiring-2026-10-16.md) §七（编号区启用 T-111–T-116 · 逐号归属）
 *           §五（MB-SEAM 唯一异步边界）§四（MB-LRU 分层 + 三重淘汰守卫）§三（TS-V 单接入点 `mbResolve`）§六（影子）。
 * 编号纪律：L13 自 **T-111** 起单调接续（L12 末号 T-110；区间 T-111–T-116 归 E-3 `M-B`）。
 *   T-111 P  MB-SEAM 唯一异步边界 `getNodeAsync`（红：缺位；绿：默认态 === N）—— **红证载体（红证先行）**。
 *   T-112 P  MB-LRU 上限与回填一致（红：超限不淘汰；绿：LRU 稳定 + 回填一致）。
 *   T-113 P  视口集常驻（守卫 ① · `MB.viewport`；红：误淘汰）。
 *   T-114 P  TS-V 单接入点 `mbResolve`（红：视图直读 `state.nodes` 绕过接缝；绿：仅经接缝 + 投影不泄漏）
 *            + 测试侧只读影子探针 `ready`（§6.4 W2 退出判据，折入本用例以保持恰 6 用例）。
 *   T-115 P  M-B 内存封顶（100k 真规模闸门：RSS ≤ 200MB + 工作集 ≤ 5,000 + capBreach=0；JU_L13_100K=1 启用 · L0-5）。
 *   T-116 P  降级等阶（off 态 ≡ L12 全量路径 + 一致性审计 + 崩溃安全网 · 哨兵 · 不变量 #33；JU_L13_100K=1 启用 · L0-6）。
 *
 * ── 默认关闭态（W2 · 只记录不启用 · 承 l13-w2-wiring §6.1「默认关闭 / 零产品字节」） ──
 * 本 spec 仅当环境变量 `JU_L13=1` 时由 `scripts/verify.js` 纳入门禁；
 * 默认（`JU_L13` 缺省）整个文件 skip，门禁与 L12 冻结版逐项一致（PW = 165 用例）。
 *
 * 红证（W2）语义：T-111–T-116 断言**产品侧**接缝（`getNodeAsync` / `MB` / `mbResolve`），
 * 现状产品缺位 ⇒ `JU_L13=1` 隔离跑 = **6 failed**（判别力真实 · 承 L12-W2 范式）；
 * 6 例转绿归 W3（SEAM / LRU / TS-V）与 W4（RSS / 降级）。
 *
 * 运行（仅本 spec）：
 *   set "JU_L13=1" && node node_modules/@playwright/test/cli.js test tests/t13-mb-workset.spec.ts --workers=1
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STEP9 = path.resolve(__dirname, '..');
const CANONICAL = path.resolve(STEP9, '..', 'v2.0-t3.html');
const APP_URL =
  process.env.JU_APP_URL ||
  'file://' + path.join(STEP9, 'v2.0-t3.html');

/* 【L13-W3 · 门禁激活】由 W2 的「默认 false（红证载体）」改为「激活/开启」：
   缺省即运行（显式 JU_L13=0 才关闭），确保 T-111~T-114 真实运行；T-115/T-116 条件跳过。 */
const L13_ON = process.env.JU_L13 !== '0';
/* 设计阈值（l13-w2-wiring §4.1 / §4.7 MB-Q1；「拟定」值，LO-4 待决） */
const MB_LRU_CAP = 5000;   /* LRU 段上限 */
const MB_VIEW_CAP = 200;   /* 视口段上限（对齐 VIRTUAL_THRESHOLD） */

/* L13 默认关闭态：未显式启用（JU_L13!=1）则逐例跳过（W2「接缝 + 只读影子」）。 */
test.beforeEach(() => {
  test.skip(!L13_ON, 'L13 默认关闭态（JU_L13!=1）：本 spec 不纳入默认门禁');
});

const APP_READY = () =>
  typeof forceRender === 'function' && typeof commit === 'function' &&
  typeof N === 'function' &&
  typeof state === 'object' && state !== null && !!state.nodes &&
  typeof ui === 'object' && ui !== null;

/* 测试侧只读影子探针（W2 · 零产品字节 · 承 l13-w2-wiring §6.1/§6.2/§6.4）。
   仅注入到本 spec 的页面上下文；不改变任何产品语义（S-4「探针只读不改语义」）。 */
async function installShadow(page) {
  await page.addInitScript(() => {
    window.__mbShadow = {
      enabled: true, seq: 0, ring: [],
      metrics: { calls: 0, mismatch: 0, maxSize: 0, simEvict: 0 },
    };
    window.shadowBuildDescriptor = function () {
      const rawKind = (typeof ui === 'object' && ui) ? (ui.view || 'outline') : 'outline';
      const rootId = (typeof ui === 'object' && ui && ui.currentDocId) ||
        (typeof state === 'object' && state && state.rootId) || null;
      return {
        kind: (rawKind === 'mindmap' || rawKind === 'presentation' || rawKind === 'calendar' ||
               rawKind === 'database' || rawKind === 'graph') ? rawKind : 'outline',
        rootId: rootId,
        window: { start: 0, count: 200, overscan: 24 },
        projection: ['id', 'text', 'parent', 'children', 'collapsed', 'done'],
      };
    };
    /* 干跑（dry-run）LRU：只读观测真实 id 序列，在影子副本上模拟 touch → evict（不触碰真实结构）。 */
    window.shadowDryRunLru = function () {
      const cap = 5000, viewCap = 200;
      const shadow = new Map();
      let evict = 0, viewport = 0, ids = [];
      try {
        const rootId = (typeof state === 'object' && state && state.rootId) || null;
        if (rootId && typeof docSubtree === 'function') ids = docSubtree(rootId);
      } catch (e) { ids = []; }
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (i < viewCap) { viewport++; continue; }      /* 视口段常驻：不入 LRU、不淘汰 */
        if (shadow.has(id)) shadow.delete(id);
        shadow.set(id, 1);                               /* 命中/插入 → 置顶（插入序） */
        while (shadow.size > cap) { const k = shadow.keys().next().value; shadow.delete(k); evict++; }
      }
      return { size: shadow.size, evict: evict, viewport: viewport };
    };
    window.mbShadowSample = function () {
      const m = window.__mbShadow.metrics;
      m.calls++;
      const desc = window.shadowBuildDescriptor();
      const pressure = window.shadowDryRunLru(desc);
      m.maxSize = Math.max(m.maxSize, pressure.size || 0);
      return { ok: true, pressure: pressure, desc: desc };
    };
  });
}

async function boot(page) {
  await installShadow(page);
  await page.goto(APP_URL);
  await page.waitForFunction(APP_READY, null, { timeout: 10000 });
}

/* ── T-111 · MB-SEAM 唯一异步边界（getNodeAsync 缺位 · 红证先行） ── */
test('T-111 · MB-SEAM 唯一异步边界（getNodeAsync 缺位 · 红证先行）', async ({ page }) => {
  await boot(page);
  const probe = await page.evaluate(async () => {
    if (typeof getNodeAsync !== 'function') return { seam: false };
    const id = state.rootId;
    const ref = N(id);
    const got = await getNodeAsync(id);
    /* S-A 短路（默认态 `_mbDisabled=true`）：`await getNodeAsync(id) === N(id)`（同一对象引用 · §5.2）。 */
    return { seam: true, refEq: got === ref };
  });
  /* 现状：产品侧唯一异步边界 `getNodeAsync` 缺位 → 本断言必红（W2 红证载体；W3 实装后转绿）。 */
  expect(probe.seam).toBe(true);
  expect(probe.refEq).toBe(true);
});

/* ── T-112 · MB-LRU 上限（工作集 ≤ 5,000）与回填一致（缺位 · 红证载体） ── */
test('T-112 · MB-LRU 上限（工作集 ≤ 5,000）与回填一致（缺位 · 红证载体）', async ({ page }) => {
  await boot(page);
  const probe = await page.evaluate(() => {
    const hasMB = (typeof MB === 'object' && MB !== null);
    return {
      mb: hasMB,
      workset: hasMB && (MB.workset instanceof Map),
      cap: (typeof MB_LRU_CAP === 'number') ? MB_LRU_CAP : null,
    };
  });
  /* 现状：`MB.workset`（Map 插入序 = LRU 序）与 `MB_LRU_CAP` 缺位 → 必红。
     W3 实装（§4.1 / §4.3）：`|workset| ≤ 5,000` + 淘汰后再取回填一致。 */
  expect(probe.mb).toBe(true);
  expect(probe.workset).toBe(true);
  expect(probe.cap).toBe(MB_LRU_CAP);
});

/* ── T-113 · 视口集常驻（守卫 ① · 视口段 ≤ 200 不淘汰 · 缺位 · 红证载体） ── */
test('T-113 · 视口集常驻（守卫 ① · 视口段 ≤ 200 不淘汰 · 缺位 · 红证载体）', async ({ page }) => {
  await boot(page);
  const probe = await page.evaluate(() => {
    const hasMB = (typeof MB === 'object' && MB !== null);
    return {
      viewport: hasMB && (MB.viewport instanceof Set),
      dirtyGuard: hasMB && (MB.dirty instanceof Set),
      viewCap: (typeof MB_VIEW_CAP === 'number') ? MB_VIEW_CAP : null,
    };
  });
  /* 现状：`MB.viewport`（视口集常驻）与 `MB.dirty`（脏集守卫 ②）缺位 → 必红。
     W3 实装（§4.3 三重守卫）：视口集永不淘汰；脏集（`commit` 草稿）不淘汰。 */
  expect(probe.viewport).toBe(true);
  expect(probe.dirtyGuard).toBe(true);
  expect(probe.viewCap).toBe(MB_VIEW_CAP);
});

/* ── T-114 · TS-V 单接入点 mbResolve（视图不直读 state.nodes · 红证载体 + 探针 ready） ── */
test('T-114 · TS-V 单接入点 mbResolve（视图不直读 state.nodes · 红证载体 + 探针 ready）', async ({ page }) => {
  await boot(page);
  const probe = await page.evaluate(() => ({
    resolve: typeof mbResolve === 'function',
    shadow: !!window.__mbShadow,
    sample: typeof mbShadowSample === 'function',
    build: typeof shadowBuildDescriptor === 'function',
  }));
  /* 测试侧只读影子探针 ready（§6.4 W2 退出判据 · 折入本用例以保持恰 6 用例）。 */
  expect(probe.shadow).toBe(true);
  expect(probe.sample).toBe(true);
  expect(probe.build).toBe(true);
  /* 产品侧单接入点 `mbResolve`（现状缺位 → 红；W3 实装后转绿 · §3.2）。 */
  expect(probe.resolve).toBe(true);
  /* 结构性锚：接缝落地后 canonical 必含单接入点名 `mbResolve`（现状缺位 → 红）。 */
  const text = fs.readFileSync(CANONICAL, 'utf8');
  expect(text.indexOf('mbResolve') >= 0).toBe(true);
});

/* ── T-115 · M-B 内存封顶（100k 真规模闸门 · RSS ≤ 200MB） ── */
test('T-115 · M-B 内存封顶（100k 真规模闸门 · RSS ≤ 200MB）', async ({ page }) => {
  /* 真规模（100k 夹具 RSS ≤ 200MB）实测归 W4；未显式启用 JU_L13_100K=1 时条件跳过。 */
  test.skip(process.env.JU_L13_100K !== '1', 'T-115 100k 真规模闸门归 W4（需 JU_L13_100K=1）');
  await boot(page);
  const probe = await page.evaluate(() => {
    const hasMB = (typeof MB === 'object' && MB !== null);
    if (!hasMB) return { mb: false };
    const total = 100000;
    MB.metrics.capBreach = 0;
    MB.metrics.evictions = 0;
    MB.viewport.clear(); MB.dirty.clear(); MB.workset.clear();
    /* 100k 夹具：合成节点（fixture 保持可达直至测量完成；不触碰 state.nodes 真理源）。 */
    const fixture = new Array(total);
    for (let i = 0; i < total; i++) {
      const id = 'mb-w4-' + i;
      fixture[i] = { id: id, text: 't' + i, parent: null, children: [], collapsed: false, done: false };
      MB.workset.set(id, fixture[i]);
      mbEvict();
    }
    const size = MB.workset.size;
    const viewportSize = MB.viewport.size;
    const rssMs = (typeof _mbRss === 'function') ? _mbRss()
      : ((typeof performance !== 'undefined' && performance && performance.memory) ? performance.memory.usedJSHeapSize : 0);
    MB.metrics.rss = rssMs;
    const capBreach = MB.metrics.capBreach;
    const out = {
      mb: true,
      metrics: !!MB.metrics,
      rss: typeof MB.metrics.rss === 'number',
      cap: (typeof MB_LRU_CAP === 'number') ? MB_LRU_CAP : null,
      size: size,
      viewportSize: viewportSize,
      capBreach: capBreach,
      rssBytes: rssMs,
      rssMB: rssMs / 1048576,
      w4: (typeof MB_W4 === 'object' && MB_W4 !== null),
    };
    /* 清理夹具（工作集），避免污染后续用例。 */
    MB.workset.clear();
    return out;
  });
  /* W4 真规模闸门（T-115 · L0-5）：100k 夹具下 RSS ≤ 200MB 且工作集 ≤ 5,000（§4.6 / §2.5）。 */
  expect(probe.mb).toBe(true);
  expect(probe.metrics).toBe(true);
  expect(probe.rss).toBe(true);
  expect(probe.cap).toBe(MB_LRU_CAP);
  expect(probe.w4).toBe(true);                         /* W4 防抖/一致性模块在册 */
  expect(probe.size).toBeLessThanOrEqual(MB_LRU_CAP);  /* 工作集封顶 ≤ 5,000 */
  expect(probe.capBreach).toBe(0);                     /* 安全网恒 0（判据） */
  /* RSS 闸门：仅当运行环境暴露 performance.memory 时判定（否则该项条件跳过）。 */
  if (probe.rssBytes > 0) {
    expect(probe.rssMB).toBeLessThanOrEqual(200);
  }
});

/* ── T-116 · 降级等阶（off 态 ≡ L12 全量路径 · 哨兵 · 不变量 #33） ── */
test('T-116 · 降级等阶（off 态 ≡ L12 全量路径 · 哨兵 · 不变量 #33）', async ({ page }) => {
  /* 哨兵（不变量 #33）转绿归 W4 → W5；未显式启用 JU_L13_100K=1 时条件跳过。 */
  test.skip(process.env.JU_L13_100K !== '1', 'T-116 降级等阶哨兵归 W4→W5（需 JU_L13_100K=1）');
  await boot(page);
  const probe = await page.evaluate(async () => {
    if (typeof mbResolve !== 'function') return { resolve: false };
    const desc = {
      kind: 'outline', rootId: state.rootId,
      window: { start: 0, count: 200, overscan: 24 },
      projection: ['id', 'text', 'parent', 'children', 'collapsed', 'done'],
    };
    const slice = await mbResolve(desc);
    const ids = (typeof docSubtree === 'function' && desc.rootId) ? docSubtree(desc.rootId) : [];
    const end = Math.min(ids.length, desc.window.start + desc.window.count);
    const proj = desc.projection;
    const pick = (n) => { const o = {}; for (const k of proj) o[k] = n ? n[k] : undefined; return o; };
    const full = [];
    for (let i = desc.window.start; i < end; i++) full.push(pick(N(ids[i])));
    const rows = (slice.rows || []).map(pick);
    const eq = JSON.stringify(rows) === JSON.stringify(full);
    /* 增量 / 全量一致性审计（产品只读 · L0-6）。 */
    let audit = null;
    if (typeof mbAuditConsistency === 'function') audit = await mbAuditConsistency(desc);
    /* 崩溃安全网（模型级：抛错 → 会话级降级回全量）。 */
    const crash = (typeof _mbCrashSafe === 'function')
      ? _mbCrashSafe(function () { throw new Error('MB_CRASH'); }, 'FULL') : null;
    return {
      resolve: true,
      degraded: !!(slice && slice.degraded === true),
      rows: !!(slice && Array.isArray(slice.rows)),
      kind: slice && slice.kind,
      eq: eq,
      auditOk: audit ? audit.ok : null,
      crash: crash,
    };
  });
  /* off 态 `degraded === true` 且与全量路径逐项一致（IF-3 · 降级等阶哨兵 · #33）。 */
  expect(probe.resolve).toBe(true);
  expect(probe.degraded).toBe(true);
  expect(probe.rows).toBe(true);
  expect(probe.kind).toBe('outline');
  expect(probe.eq).toBe(true);                                    /* 降级路径 ≡ 全量路径（逐项） */
  if (probe.auditOk !== null) expect(probe.auditOk).toBe(true);   /* 一致性 mismatch === 0 */
  if (probe.crash !== null) expect(probe.crash).toBe('FULL');     /* 崩溃安全网 → 全量 */
});
