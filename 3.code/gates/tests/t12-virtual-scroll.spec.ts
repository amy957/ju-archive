// @ts-nocheck
/**
 * L12-W2 · E-2「M-H 真虚拟滚动（P1c 剩余）」专题 spec（P 层 · **默认关闭态**）
 * ============================================================================
 * 冻结依据：[`t12-design-2026-10-15.md`](reports/t12-design-2026-10-15.md) §六（红证矩阵 T-105–T-110 与可测性接缝）
 *           与 §九 W2；[`t12-w1-2026-10-15.md`](reports/t12-w1-2026-10-15.md) §三（交互破坏面台账 D-1…D-8）+ §六（编号区启用）。
 * 编号纪律：L12 自 **T-105** 起单调接续（L11 末号 T-104；区间 T-105–T-110 归 E-2 `M-H`）。
 *   T-105 P  视口外节点不在 DOM（结构性断言）—— 现状「content-visibility 弱虚拟滚动」屏外节点仍在 DOM → **红证载体（红证先行）**。
 *   T-106 P  渲染工作集规模（渲染节点数 ≤ 视口上限 200）—— 现状 O(可见节点数) → 红证载体。
 *   T-107 P  只读试点影子（演示/画廊）探针 `ready`（**只记录不启用**；零 DOM 变更）。
 *   T-108 P  交互破坏面台账 D-1…D-8 canonical 文本锚存在性（逐项等价断言的靶位）。
 *   T-109 P  降级开关接地（`_virtualDisabled` + `virtual-scroll-fallback`）。
 *   T-110 P  不变量 #32 哨兵（真虚拟滚动视口一致：滚动位置 ↔ 渲染区间映射可测）。
 *
 * ── 默认关闭态（W2 · 只记录不启用，承接 l12-design §九 W2「接缝 + 只读试点影子」） ──
 * 本 spec 仅当环境变量 `JU_L12=1` 时由 `scripts/verify.js` 纳入门禁；
 * 默认（`JU_L12` 缺省）整个文件 skip，门禁与 L11 收口冻结版逐项一致（PW = 165 用例）。
 *
 * 只读试点影子（S-4「探针只读不改语义」）：不新增产品字节、不改变渲染路径；
 * 仅在页面内只读地记录「真虚拟滚动将渲染的可视区间」，默认零写入（测试显式开启）。
 *
 * 运行（仅本 spec）：
 *   set "JU_L12=1" && node node_modules/@playwright/test/cli.js test tests/t12-virtual-scroll.spec.ts --workers=1
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

const L12_ON = process.env.JU_L12 === '1';
/* 视口上限（= VIRTUAL_THRESHOLD，l12-w1 §四 冻结；真虚拟滚动渲染节点数上限） */
const VIEWPORT_CAP = 200;
/* 只读试点（演示/画廊）载体规模：> 视口上限即触发弱虚拟滚动 .virtual */
const PILOT_N = 400;

/* L12 默认关闭态：未显式启用（JU_L12!=1）则逐例跳过（W2「只读试点影子」）。 */
test.beforeEach(() => {
  test.skip(!L12_ON, 'L12 默认关闭态（JU_L12!=1）：本 spec 不纳入默认门禁');
});

const APP_READY = () =>
  typeof forceRender === 'function' && typeof commit === 'function' &&
  typeof state === 'object' && state !== null && !!state.nodes &&
  typeof ui === 'object' && ui !== null;

async function boot(page) {
  await page.goto(APP_URL);
  await page.waitForFunction(APP_READY, null, { timeout: 10000 });
}

/* 向根文档注入 N 个同级可见节点（测试载体；只读试点不改变产品语义）。 */
async function seedLargeDoc(page, n) {
  return await page.evaluate((count) => {
    commit((d) => {
      const root = d.nodes[d.rootId];
      for (let i = 0; i < count; i++) {
        const id = '__l12w2_seed_' + i;
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

/* 只读试点影子：只读地记录「真虚拟滚动将渲染的可视区间」，零 DOM 变更（S-4）。 */
async function runPilot(page) {
  return await page.evaluate((cap) => {
    const ITEM_SEL = '.outline .node, .pres-item, .db-gallery-card';
    const c = document.getElementById('content');
    if (!c) return { ready: false, reason: 'no-content' };
    const items = Array.prototype.slice.call(document.querySelectorAll(ITEM_SEL));
    const rowH = items.length ? (items[0].getBoundingClientRect().height || 28) : 28;
    const top = c.scrollTop || 0;
    const vh = c.clientHeight || 0;
    return {
      ready: true,
      mode: 'weak',                              /* 现状：content-visibility 弱虚拟滚动（无绝对定位/无 DOM 复用） */
      rendered: items.length,                    /* DOM 内实际节点数（O(可见节点数)） */
      window: { first: Math.max(0, Math.floor(top / rowH)),
                last: Math.min(items.length, Math.ceil((top + vh) / rowH)) },
      cap: cap,                                  /* 真虚拟滚动的视口上限（只记录，不应用） */
    };
  }, VIEWPORT_CAP);
}

async function countItems(page) {
  return await page.evaluate(() =>
    document.querySelectorAll('.outline .node, .pres-item, .db-gallery-card').length);
}

/* ── T-105 · 视口外节点不在 DOM（结构性断言 · 红证先行） ── */
test('T-105 · 视口外节点不在 DOM（结构性断言 · 红证先行）', async ({ page }) => {
  await boot(page);
  await seedLargeDoc(page, PILOT_N);
  await setView(page, 'outline');
  const r = await page.evaluate((cap) => {
    const visible = (typeof countVisibleNodes === 'function')
      ? countVisibleNodes(state.nodes[state.rootId]) : 0;
    const inDom = document.querySelectorAll('.outline .node').length;
    return { visible: visible, inDom: inDom, cap: cap };
  }, VIEWPORT_CAP);
  /* 前置：确为超阈值文档（模型层可见节点数 > 视口上限），排除「未渲染」伪绿 */
  expect(r.visible).toBeGreaterThan(r.cap);
  /* 真虚拟滚动视口一致：DOM 内节点数 ≤ 视口上限（200）。
     现状（弱虚拟滚动）屏外节点仍在 DOM → 本断言必红（判别力真实，见 l12-w1 §3.2）。 */
  expect(r.inDom).toBeLessThanOrEqual(r.cap);
});

/* ── T-106 · 渲染工作集规模（渲染节点数 ≤ 200 · 只读试点：演示视图） ── */
test('T-106 · 渲染工作集规模 ≤ 视口上限 200（演示视图 · 红证载体）', async ({ page }) => {
  await boot(page);
  await seedLargeDoc(page, PILOT_N);
  await setView(page, 'presentation');
  const r = await page.evaluate((cap) => ({
    inDom: document.querySelectorAll('.pres-item, .outline .node, .db-gallery-card').length,
    cap: cap,
  }), VIEWPORT_CAP);
  /* 现状：演示视图全量渲染 → 渲染节点数 = O(n) → 红（真虚拟滚动目标 ≤ 200）。 */
  expect(r.inDom).toBeLessThanOrEqual(r.cap);
});

/* ── T-107 · 只读试点影子（演示/画廊）探针 ready（只记录不启用） ── */
test('T-107 · 只读试点影子（演示/画廊）探针 ready（只记录不启用）', async ({ page }) => {
  await boot(page);
  await seedLargeDoc(page, PILOT_N);
  await setView(page, 'presentation');
  const before = await countItems(page);
  const p = await runPilot(page);
  const after = await countItems(page);
  expect(p.ready).toBe(true);
  expect(p.mode).toBe('weak');                       /* 记录现状模式（真虚拟滚动未实现 → W3） */
  expect(p.rendered).toBeGreaterThan(0);
  expect(p.cap).toBe(VIEWPORT_CAP);
  expect(Number.isFinite(p.window.first)).toBe(true);
  expect(Number.isFinite(p.window.last)).toBe(true);
  /* 只读纪律：试点不改变产品 DOM（零字节语义变更） */
  expect(after).toBe(before);
});

/* ── T-108 · 交互破坏面台账 D-1…D-8 canonical 文本锚（逐项等价断言靶位） ── */
test('T-108 · 交互破坏面台账 D-1…D-8 canonical 文本锚存在性', async () => {
  const text = fs.readFileSync(CANONICAL, 'utf8');
  /* D-5（浏览器 Ctrl+F）无 JS 锚（浏览器原生）—— LO-5=B：显式声明失效（OP-14），故 tokens 为空。 */
  const SURFACE = [
    ['D-1', ['outline-ghost', 'outline-drop-line', 'drag-outline', '_lastPointerType']],
    ['D-2', ['outline-selbar', '_outlineSel']],
    ['D-3', ['toggleCollapse', 'collapsed-hint', 'countVisibleNodes']],
    ['D-4', ['indentNode', 'outdentNode', 'commitPendingEditBeforeRender']],
    ['D-5', []],
    ['D-6', ['savedFocus', 'restoreFocus', 'window.getSelection']],
    ['D-7', ['@media print', 'node-print']],
    ['D-8', ['_savedOutlineScroll', '_lastScroll']],
  ];
  const missing = [];
  for (const [surface, tokens] of SURFACE) {
    for (const tok of tokens) {
      if (text.indexOf(tok) < 0) missing.push(surface + ':' + tok);
    }
  }
  expect(missing).toEqual([]);
});

/* ── T-109 · 降级开关接地（_virtualDisabled + virtual-scroll-fallback） ── */
test('T-109 · 降级开关接地（_virtualDisabled + virtual-scroll-fallback）', async () => {
  const text = fs.readFileSync(CANONICAL, 'utf8');
  for (const tok of [
    'VIRTUAL_THRESHOLD',
    '_virtualDisabled',
    "virtual-scroll-fallback",
    "classList.add('virtual')",
  ]) {
    expect(text.indexOf(tok) >= 0).toBe(true);
  }
});

/* ── T-110 · 不变量 #32 哨兵（真虚拟滚动视口一致：滚动 ↔ 渲染区间映射可测） ── */
test('T-110 · 不变量 #32 哨兵（真虚拟滚动视口一致：滚动位置 ↔ 渲染区间映射可测）', async ({ page }) => {
  await boot(page);
  await seedLargeDoc(page, PILOT_N);
  await setView(page, 'outline');
  const r = await page.evaluate(async () => {
    const c = document.getElementById('content');
    const spec = () => {
      const items = document.querySelectorAll('.outline .node, .pres-item, .db-gallery-card');
      const rowH = items.length ? (items[0].getBoundingClientRect().height || 28) : 28;
      const top = c.scrollTop || 0;
      const vh = c.clientHeight || 0;
      return { first: Math.max(0, Math.floor(top / rowH)),
               last: Math.min(items.length, Math.ceil((top + vh) / rowH)) };
    };
    const a = spec();
    c.scrollTop = Math.min(2000, c.scrollHeight - c.clientHeight);
    await new Promise((res) => requestAnimationFrame(() => res(null)));
    const b = spec();
    return { a: a, b: b, scrollable: c.scrollHeight > c.clientHeight + 1 };
  });
  expect(r.scrollable).toBe(true);                   /* 超视口文档 → 可滚动 */
  expect(r.b.first).toBeGreaterThanOrEqual(r.a.first); /* 下移滚动 → 可视区间起点单调不减 */
  expect(r.b.first).toBeGreaterThan(r.a.first);        /* 且严格前移（滚动 ↔ 渲染区间映射可测） */
});
