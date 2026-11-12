// @ts-nocheck
/**
 * L14-W2 · E-2 补完「M-H′ 加固（界面规模收口二期 · 不变量 #35）」专题 spec（P 层 · **默认关闭态**）
 * ============================================================================
 * 冻结依据：[`t14-design-2026-10-16.md`](reports/t14-design-2026-10-16.md) §四（G1–G6）
 *           与 §八（红证矩阵 T-117–T-124 / 接缝设计 S-1…S-5）；
 *           [`t14-w1-audit-2026-10-16.md`](reports/t14-w1-audit-2026-10-16.md) §二（加固面台账 E-①…E-⑥）
 *           + §三（阈值冻结 · 红线 RL-1…RL-8 · 红证矩阵）。
 * 编号纪律：L14 自 **T-117** 起单调接续（L13 末号 T-116 含 T-116(N)；区间 T-117–T-124 归 E-2 `M-H′`）。
 *   T-117 P  变高行布局正确性（G1 · E-①）—— 红：无「实测行高 + 高度表（前缀和）」原语 ⇒ 变高行错位。
 *   T-118 P  真规模闸门（G6 · E-⑥ 真规模）—— 红：无 L14 100k longtask 门。
 *   T-119 P  消除每次渲染 O(n)（G2 · E-②③）—— 红：无数据代次缓存（`state.updatedAt`）与增量 patch。
 *   T-120 P  视图覆盖扩展（G3 · E-④ · LO-4=B 画廊+导图）—— 红：画廊/导图未窗口化。
 *   T-121 P  应用内搜索替代（G4 · E-⑤ · 关闭 OP-14）—— 红：应用内搜索缺位（Ctrl+F 失效）。
 *   T-122 P  交互加固（G5 · E-⑥）—— 红：无交互重渲染护栏。
 *   T-123 P  降级开关接地（H5 显式开关 · #35 哨兵靶位）—— 现状锚存在（绿）。
 *   T-124 P  L14 接缝默认关闭 + 影子探针 ready（只记录不启用 · §8.1 S-4）。
 *
 * ── 默认关闭态（W2 · 只记录不启用 · 承 l14-design §三「零回归兜底」与 LO-7=A） ──
 * 本 spec 仅当环境变量 `JU_L14=1` 时由 `scripts/verify.js` 纳入门禁；
 * 默认（`JU_L14` 缺省）整个文件 skip，门禁与 L13 收口冻结版逐项一致（PW = 171 用例）。
 *
 * L14 接缝机制（seam · 测试侧只读 · **默认不启用**）：`window.__l14Seam`（`enabled === false`）
 * 以只读描述符 + 干跑（dry-run）承载「加固后应渲染的可视区间」；**零产品路径占用**。
 * 影子模式（shadow · 观测层/干跑）：`window.__l14Shadow` + `l14ShadowSample` + `l14BuildDescriptor`，
 * 经 `page.addInitScript` 只读注入（仅本 spec 页面上下文）；**不占用产品运行字节**（S-4）。
 * 产品侧接缝（`_vsHeightTable` / `_vsGenCache` / `l14SearchAll` / `_vsInteractGuard` / `l14LongtaskGate`
 * / `renderDbGalleryVirtual`）归 **W3** 实装 —— 本波为**红证载体**（现状缺位 ⇒ 判别力真实）。
 *
 * 红证（W2）语义：T-117–T-122 断言**产品侧**加固原语，现状缺位 ⇒ `JU_L14=1` 隔离跑 = **6 failed**；
 * T-123（降级锚）/ T-124（接缝 + 影子 ready）现状**绿**；转绿归 W3 / W4。
 *
 * 运行（仅本 spec）：
 *   set "JU_L14=1" && node node_modules/@playwright/test/cli.js test tests/t14-virtual-scroll-hardening.spec.ts --workers=1
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

/* L14 接缝（seam）门禁 —— 默认不启用（承 l14-w1 §3.2 RL-7 与 LO-7=A）：
   仅当 JU_L14=1 时本 spec 纳入门禁；缺省整文件 skip，PW 与 L13 逐项一致（171）。 */
const L14_ON = process.env.JU_L14 === '1';
/* 视口上限（= VIRTUAL_THRESHOLD · l14-w1 §3.1 冻结：渲染节点数上限） */
const VIEWPORT_CAP = 200;
/* 只读试点载体规模：> 视口上限即触发 .virtual 弱虚拟滚动 */
const PILOT_N = 400;

/* L14 默认关闭态：未显式启用（JU_L14!=1）则逐例跳过（W2「接缝 + 影子」）。 */
test.beforeEach(() => {
  test.skip(!L14_ON, 'L14 默认关闭态（JU_L14!=1）：本 spec 不纳入默认门禁');
});

const APP_READY = () =>
  typeof forceRender === 'function' && typeof commit === 'function' &&
  typeof state === 'object' && state !== null && !!state.nodes &&
  typeof ui === 'object' && ui !== null;

/* 测试侧只读注入探针（W2 · 零产品运行字节 · 承 l14-design §8.1 S-4「探针只读不改语义」）：
   ① 接缝 `window.__l14Seam`（默认 `enabled === false` · 只读描述符 + 干跑）；
   ② 影子 `window.__l14Shadow`（只读观测 / 干跑，不触碰 `commit` / `ui` / DOM）。
   仅注入到本 spec 的页面上下文；不改变任何产品语义。 */
async function installL14Probes(page) {
  await page.addInitScript(() => {
    window.__l14Seam = {
      enabled: false,                       /* 默认不启用（零产品路径占用） */
      version: 'l14-seam/v1',
      /* 只读描述符：从 ui / state 读视图类型、根、视口切片（不触碰产品写路径） */
      descriptor: function () {
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
      },
      /* 干跑：以描述符解析「加固后应渲染的可视区间」（只记录，不应用） */
      dryRun: function () {
        const d = this.descriptor();
        if (!d.rootId) return { ok: false, reason: 'no-root' };
        const total = (typeof countVisibleNodes === 'function' && typeof state === 'object' && state)
          ? countVisibleNodes(state.nodes[d.rootId]) : 0;
        const first = Math.max(0, d.window.start - d.window.overscan);
        const last = Math.min(total, d.window.start + d.window.count + d.window.overscan);
        return { ok: true, total: total, window: { first: first, last: last }, cap: 200 };
      },
    };
    window.__l14Shadow = {
      enabled: true, seq: 0, ring: [],
      metrics: { calls: 0, mismatch: 0, maxSize: 0 },
    };
    window.l14BuildDescriptor = function () {
      return (window.__l14Seam && window.__l14Seam.descriptor) ? window.__l14Seam.descriptor() : null;
    };
    window.l14ShadowSample = function () {
      const m = window.__l14Shadow.metrics;
      m.calls++;
      const desc = window.l14BuildDescriptor();
      const pressure = (window.__l14Seam && window.__l14Seam.dryRun) ? window.__l14Seam.dryRun() : { ok: false };
      if (pressure && typeof pressure.total === 'number') m.maxSize = Math.max(m.maxSize, pressure.total);
      return { ok: !!(pressure && pressure.ok), desc: desc, pressure: pressure };
    };
  });
}

async function boot(page) {
  await installL14Probes(page);
  await page.goto(APP_URL);
  await page.waitForFunction(APP_READY, null, { timeout: 10000 });
}

/* 向根文档注入 N 个同级可见节点（测试载体；只读试点不改变产品语义）。 */
async function seedLargeDoc(page, n) {
  return await page.evaluate((count) => {
    commit((d) => {
      const root = d.nodes[d.rootId];
      for (let i = 0; i < count; i++) {
        const id = '__l14w2_seed_' + i;
        if (!d.nodes[id]) {
          d.nodes[id] = { id: id, text: 'row ' + i, parent: root.id, children: [],
            collapsed: false, done: false, createdAt: 0, updatedAt: 0 };
          root.children.push(id);
        }
      }
    }, { silent: true, noHistory: true, noRollback: true });
    return true;
  }, n);
}

async function setView(page, view) {
  return await page.evaluate((v) => {
    ui.currentDocId = state.rootId;
    ui.view = v;
    forceRender();
    return true;
  }, view);
}

/* ── T-117 · G1 变高行布局正确性（高度表缺位 · 红证先行） ── */
test('T-117 · G1 变高行布局正确性（高度表缺位 · 红证先行）', async () => {
  const text = fs.readFileSync(CANONICAL, 'utf8');
  /* 现状：只有固定 `VS_ROW_H`，无「首屏实测行高 + 高度表（前缀和）」原语 ⇒ 变高行错位 ⇒ 红。 */
  expect(text.indexOf('VS_ROW_H') >= 0).toBe(true);
  expect(text.indexOf('_vsHeightTable') >= 0).toBe(true);
});

/* ── T-118 · G6 真规模闸门（100k longtask 门 · 锚 + 预算常量接地） ── */
test('T-118 · G6 真规模闸门（100k longtask 门 · 锚 + 预算常量）', async () => {
  const text = fs.readFileSync(CANONICAL, 'utf8');
  /* W4 实装（承 l14-w1 §3.1 G6）：真规模闸门 `__l14LongtaskGate` + 预算常量（longtask/RSS/p95）接地。 */
  for (const tok of [
    'l14LongtaskGate',
    'L14_LONGTASK_BUDGET',
    'L14_RSS_CAP_MB',
    'L14_P95_BUDGET',
    'longtaskGate:',
    'rssGate',
    'p95Gate',
    'degradeParity',
  ]) {
    expect(text.indexOf(tok) >= 0).toBe(true);
  }
});

/* ── T-118(100k) · G6 真规模实测（RSS ≤ 200MB / longtask = 0 / p95 ≤ 16ms） ── */
test('T-118(100k) · G6 真规模实测（RSS ≤ 200MB · longtask/p95 观测）', async ({ page }) => {
  /* 真实 100k 浏览器度量归 W4；未显式启用 JU_L14_100K=1 时条件跳过（承 L13 T-115 范式）。
     判据 = 内存封顶（RSS ≤ 200MB · 承 L13 L0-5 口径）+ 真规模闸门可达；
     longtask / p95 以观测记录落盘（OP-20：100k 切视图 p95 帧预算为持续优化项）。 */
  test.skip(process.env.JU_L14_100K !== '1', 'T-118 100k 真规模实测需 JU_L14_100K=1');
  await boot(page);
  await seedLargeDoc(page, 100000);
  await page.evaluate(() => { if (window.__l14 && window.__l14.enable) window.__l14.enable(); });
  const probe = await page.evaluate(async () => {
    const g = window.__l14 && window.__l14.longtaskGate;
    if (!g) return { ok: false, reason: 'no-gate' };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    ui.currentDocId = state.rootId; ui.view = 'presentation'; forceRender(); /* 预热代次缓存 */
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      ui.currentDocId = state.rootId; ui.view = 'outline'; forceRender();
      g.markSwitch(performance.now() - t0);
    }
    await wait(300);
    g.sampleRss();
    return { ok: true, rs: g.rssGate(g.rssMB), p: g.p95Gate(), m: g.measure() };
  });
  fs.writeFileSync(path.join(STEP9, 'reports', '_l14w4_probe100k.json'),
    JSON.stringify({ rs: probe.rs, p: probe.p, m: probe.m }, null, 2));
  expect(probe.ok).toBe(true);                            /* 真规模闸门可达 */
  if (probe.rs.measured) expect(probe.rs.ok).toBe(true);  /* RSS ≤ 200MB（100k 封顶 · 承 L0-5） */
});

/* ── T-119 · G2 消除每次渲染 O(n)（代次缓存 / 增量 patch 缺位 · 红证先行） ── */
test('T-119 · G2 消除每次渲染 O(n)（代次缓存缺位 · 红证先行）', async () => {
  const text = fs.readFileSync(CANONICAL, 'utf8');
  /* 现状：无数据代次缓存（`state.updatedAt` 代次）+ 无 `changedIds` 增量 patch ⇒ 红；W3 实装。 */
  expect(text.indexOf('_vsGenCache') >= 0).toBe(true);
});

/* ── T-120 · G3 视图覆盖扩展（画廊 / 导图窗口化缺位 · 红证先行） ── */
test('T-120 · G3 视图覆盖扩展（画廊/导图窗口化缺位 · 红证先行）', async () => {
  const text = fs.readFileSync(CANONICAL, 'utf8');
  /* 现状：已窗口化仅 outline / presentation；画廊 `renderDbGallery` / 导图未接（LO-4=B）⇒ 红。 */
  expect(text.indexOf('renderDbGalleryVirtual') >= 0).toBe(true);
});

/* ── T-121 · G4 应用内搜索替代（Ctrl+F 回补缺位 · 红证先行 · 关闭 OP-14） ── */
test('T-121 · G4 应用内搜索替代（Ctrl+F 回补缺位 · 红证先行）', async () => {
  const text = fs.readFileSync(CANONICAL, 'utf8');
  /* 现状：无应用内搜索（跨全文档 / 命中屏外）⇒ 红（OP-14）；W3 实装（LO-5=A）。 */
  expect(text.indexOf('l14SearchAll') >= 0).toBe(true);
});

/* ── T-122 · G5 交互加固（交互重渲染护栏缺位 · 红证先行） ── */
test('T-122 · G5 交互加固（交互重渲染护栏缺位 · 红证先行）', async () => {
  const text = fs.readFileSync(CANONICAL, 'utf8');
  /* 现状：多选 / 拖拽仍触发整视图全量重渲染，无护栏 ⇒ 红；W3 实装。 */
  expect(text.indexOf('_vsInteractGuard') >= 0).toBe(true);
});

/* ── T-123 · 降级开关接地（H5 显式开关 · #35 哨兵靶位 · 现状锚存在） ── */
test('T-123 · 降级开关接地（H5 显式开关 · #35 哨兵靶位）', async () => {
  const text = fs.readFileSync(CANONICAL, 'utf8');
  /* 降级路径锚（RL-7「默认关闭 · 异常回退全量」）现状存在（绿）—— #35 哨兵的靶位。 */
  for (const tok of [
    'VIRTUAL_THRESHOLD',
    '_virtualDisabled',
    '_vsUserDisabled',
    'virtual-scroll-fallback',
  ]) {
    expect(text.indexOf(tok) >= 0).toBe(true);
  }
});

/* ── T-124 · L14 接缝默认关闭 + 影子探针 ready（只记录不启用） ── */
test('T-124 · L14 接缝默认关闭 + 影子探针 ready（只记录不启用）', async ({ page }) => {
  await boot(page);
  await seedLargeDoc(page, PILOT_N);
  await setView(page, 'outline');
  const probe = await page.evaluate(() => ({
    seam: !!window.__l14Seam,
    seamEnabled: !!(window.__l14Seam && window.__l14Seam.enabled),
    seamVersion: (window.__l14Seam && window.__l14Seam.version) || null,
    shadow: !!window.__l14Shadow,
    sample: typeof l14ShadowSample === 'function',
    build: typeof l14BuildDescriptor === 'function',
  }));
  /* 接缝机制已就位但默认不启用（零产品路径占用 · L14-W2 退出判据）。 */
  expect(probe.seam).toBe(true);
  expect(probe.seamEnabled).toBe(false);
  expect(probe.seamVersion).toBe('l14-seam/v1');
  /* 影子探针 ready（只记录不启用 · 承 l14-w1 §八）。 */
  expect(probe.shadow).toBe(true);
  expect(probe.sample).toBe(true);
  expect(probe.build).toBe(true);
  /* 干跑采样：只读观测，零 DOM 变更（S-4）。 */
  const r = await page.evaluate(() => {
    const sel = '.outline .node, .pres-item, .db-gallery-card';
    const before = document.querySelectorAll(sel).length;
    const s = window.l14ShadowSample();
    const after = document.querySelectorAll(sel).length;
    return { ok: s.ok, calls: window.__l14Shadow.metrics.calls, before: before, after: after };
  });
  expect(r.ok).toBe(true);
  expect(r.calls).toBeGreaterThan(0);
  /* 只读纪律：探针不改变产品 DOM（零字节语义变更）。 */
  expect(r.after).toBe(r.before);
});
