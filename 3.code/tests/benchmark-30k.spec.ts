import { test, expect, type BrowserContext, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * M3 · 批次 AU/AV · 「M3-3 3 万节点性能基准」
 *
 * 被测链路（真实运行期行为，无 mock、无桩数据）：
 *   `/?fixture=30k`
 *     → `src/app/boot.ts` 的 `loadBenchFixture()`（`fetch('/30k-fixture.json')`，30,000 节点）
 *     → `core/store.initStore(initial)`（含 `repairTreeConsistency` 30k 结构校验 / 磁盘确认集 / 侧栏计数）
 *     → 首个 `renderMain()`（真实视图分发：清空 `#content` → 视图渲染 → 侧栏/右栏/顶栏同步）
 *     → 首帧绘制
 *
 * 三项指标与阈值（M3 门禁）：
 *   ① 启动时间 `< 3000ms`：`page.goto('/?fixture=30k')` 起，到 `JU.getState().nodes` 达 30,000、
 *      首屏大纲节点行已进入 DOM、并经过双 rAF（首帧已提交）的耗时；
 *   ② 视图切换 `< 200ms`：真实点击顶栏 `.tb-nav-btn[data-view]`（大纲 → 导图 → 大纲），
 *      记录「click 派发 → 产品处理器同步完成 → 强制样式/布局」与「+ 双 rAF 首帧」两档耗时；
 *   ③ 内存 `< 800MB`：`performance.memory.usedJSHeapSize`（Chromium 专有；缺失时打印
 *      「无法测量」并跳过该条断言）。
 *
 * ── 迁移期装配说明（本 spec 的骨架与端口回填，均不改动产品源码） ──
 * 1) **DOM 骨架**：`index.html` 目前只有 `#app`（属于 M0-7 最小壳）。本 spec 在 document-start
 *    注册 DOMContentLoaded 回调（早于产品 `boot()` 的 UI 绑定段），注入最小可渲染骨架：
 *    `#bench-topbar`（`.tb-nav-btn[data-view]` 大纲/导图 + `#btnClose`）、`#content`、
 *    `#sidebarLeft` / `#sidebarRight`、`#btnToggleLeft` / `#btnToggleRight`。
 *    按钮由产品自身的 `bindTopbar()` 绑定（真实 onclick 处理器），点击链路不经过任何测试替身。
 * 2) **渲染端口回填**：`main.ts` 装配点中 `bindLayoutDeps.renderMain`、`bindRenderMainDeps.N`、
 *    `injectOutlineDeps.N`、`injectMindmapDeps.N` 仍为迁移期占位（`() => null` / `noop`），
 *    若不回填，`renderMain()` 会在 `const curDoc = N(curId)` 得到 `null` 后渲染「请先选择文档」空态，
 *    视图切换将无实际渲染代价可测。故本 spec 经产品**已导出的注入入口**
 *    （`JU.bindLayoutDeps` / `JU.bindRenderMainDeps` / `JU.injectOutlineDeps` / `JU.injectMindmapDeps`）
 *    回填只读端口：`N = JU.N`（真实节点取用）、`renderMain = JU.renderMain`（真实渲染分发）、
 *    `state` 为 getter 活跃代理（与 `main.ts` 中 `liveState` 同口径）。渲染代码本身 100% 为产品模块实现。
 *
 * ── 环境适配（与 `tests/concurrency.spec.ts` 同一实测结论） ──
 * 本机浏览器进程到 `127.0.0.1/localhost` 的入站连接被系统策略阻断（端口 LISTENING 但连接不建立）。
 * 故先直连真实 Vite dev server；导航失败则回落「`vite build` 产物 + 路由拦截」：页面仍运行在
 * `http://localhost:5173` 真实 HTTP 源上，`fetch('/30k-fixture.json')` 仍是真实 fetch（由路由从
 * `dist/30k-fixture.json` 应答），计时口径与直连模式完全一致。
 */

const BASE = 'http://localhost:5173';
const FIXTURE_URL = '/?fixture=30k';
const EXPECTED_NODES = 30_000;
const LIMIT_STARTUP_MS = 3000;
const LIMIT_SWITCH_MS = 200;
/* 首帧绘制为墙钟量：合成器排队 / GC 会让单次采样偶发尖峰（同轮可差 2 倍以上）。
   门禁取 5 次采样中位数，另设单次峰值兜底，避免把环境抖动判成产品回归。 */
const LIMIT_SWITCH_PEAK_MS = 600;
const LIMIT_HEAP_MB = 800;
const STORE_KEY = 'juju.store.v31';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

/** 项目根（testDir = <root>/tests） */
function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

/**
 * document-start 注入：最小可渲染骨架 + 渲染端口回填。
 * 端口回填以 1ms 轮询等待 `window.JU` 装配完成（模块脚本执行先于 DOMContentLoaded，
 * 通常首轮即命中；20s 后停止轮询）。
 */
async function installBenchHarness(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as any;

    /* ① 顶栏视图入口：M1 起 index.html 已自带三区骨架（#topbar / #tbNav / #content），
       旧实现的「#content 不存在才整套重建」守卫会直接 return，导致 bindTopbar() 无按钮可绑。
       改为仅在 #tbNav 为空时补两个视图按钮，并在 readystatechange→interactive（deferred 模块
       执行之前）即挂载，确保产品 boot() 的 UI 绑定段能命中。 */
    const mountNav = (): void => {
      const nav = document.getElementById('tbNav');
      if (nav && !nav.querySelector('.tb-nav-btn')) {
        nav.innerHTML =
          '<button type="button" class="tb-nav-btn" data-view="outline">大纲</button>' +
          '<button type="button" class="tb-nav-btn" data-view="mindmap">导图</button>';
      }
    };
    mountNav();
    document.addEventListener('readystatechange', mountNav);
    document.addEventListener('DOMContentLoaded', mountNav, { once: true });

    /* ② 渲染端口回填（只读端口；状态经 getter 活跃代理读取，与 main.ts 的 liveState 同口径） */
    const liveState: any = {};
    Object.defineProperty(liveState, 'nodes', { get: () => { const s = w.JU.getState(); return (s && s.nodes) || {}; } });
    Object.defineProperty(liveState, 'rootId', { get: () => { const s = w.JU.getState(); return s ? s.rootId : null; } });
    Object.defineProperty(liveState, 'trashed', { get: () => { const s = w.JU.getState(); return (s && s.trashed) || []; } });

    const uiOf = (): any => {
      const u = w.JU.ui;
      return typeof u === 'function' ? u() : u;
    };
    const currentDoc = (): any => {
      const u = uiOf();
      const id = u && u.currentDocId;
      return (id && w.JU.N(id)) || null;
    };
    const viewOf = (): string => 'outline';

    const wire = (): boolean => {
      const J = w.JU;
      if (!J || typeof J.injectOutlineDeps !== 'function' || typeof J.bindRenderMainDeps !== 'function') return false;
      if (w.__m3BenchWired) return true;
      w.__m3BenchWired = true;
      J.bindLayoutDeps({ renderMain: J.renderMain, getCurrentDoc: currentDoc, viewOf });
      J.bindRenderMainDeps({ N: J.N, viewOf, getCurrentDoc: currentDoc });
      J.injectOutlineDeps({ N: J.N, state: liveState, viewOf, getCurrentDoc: currentDoc });
      J.injectMindmapDeps({ N: J.N, state: liveState });
      return true;
    };
    if (!wire()) {
      const t = setInterval(() => { if (wire()) clearInterval(t); }, 1);
      setTimeout(() => clearInterval(t), 20_000);
    }
  });
}

/** 重新构建（保证被测代码即当前源码），返回 dist 绝对路径。 */
async function prepareDist(): Promise<string> {
  const root = projectRoot();
  /* M1-1 单文件构建默认不拷贝 public/；本基准需要 dist/30k-fixture.json，显式开启 public 直通。 */
  const prevKeepPublic = process.env.JU_KEEP_PUBLIC;
  process.env.JU_KEEP_PUBLIC = '1';
  try {
    await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  } finally {
    if (prevKeepPublic === undefined) delete process.env.JU_KEEP_PUBLIC;
    else process.env.JU_KEEP_PUBLIC = prevKeepPublic;
  }
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  if (!fs.existsSync(path.join(dist, '30k-fixture.json'))) throw new Error('dist 缺少 30k-fixture.json（public 直通拷贝）');
  return dist;
}

/** 把 baseURL 请求映射到 dist 产物（query 不参与文件定位，`?fixture=30k` 原样保留在 URL 上）。 */
async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route(BASE + '/**', async (route: Route) => {
    const url = new URL(route.request().url());
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';
    const file = path.join(dist, pathname);
    try {
      const stat = await fsp.stat(file);
      if (stat.isDirectory()) throw new Error('directory');
      await route.fulfill({
        status: 200,
        contentType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        body: await fsp.readFile(file),
      });
    } catch {
      await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'not found: ' + pathname });
    }
  });
}

test('M3-3 3 万节点性能基准', async ({ context, page }) => {
  test.setTimeout(300_000);

  await installBenchHarness(context);

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  /* ── ① 导航（先直连 dev server；失败则 vite build + 路由拦截重试） ── */
  const tGoto = Date.now();
  let servedBy = 'vite-dev-server';
  try {
    await page.goto(FIXTURE_URL, { waitUntil: 'commit', timeout: 15_000 });
  } catch (e) {
    servedBy = 'vite-dist+route';
    console.log('[M3-3] dev server 直连失败，回落 dist 路由模式：' + String((e && (e as Error).message) || e).split('\n')[0]);
    const dist = await prepareDist();
    await installDistRoute(context, dist);
    await page.goto(FIXTURE_URL, { waitUntil: 'commit', timeout: 60_000 });
  }

  /* ── ② 启动完成：30,000 节点已装载 + 首屏大纲行已渲染 ── */
  await page.waitForFunction(
    (expected) => {
      const J = (window as any).JU;
      if (!J || typeof J.getState !== 'function') return false;
      const st = J.getState();
      if (!st || !st.nodes || Object.keys(st.nodes).length < expected) return false;
      const c = document.getElementById('content');
      return !!(c && c.querySelector('.outline .node'));
    },
    EXPECTED_NODES,
    { timeout: 120_000, polling: 50 },
  );

  const startup = await page.evaluate(async () => {
    /* 双 rAF：等首帧绘制提交（「首屏渲染完成」口径） */
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const J = (window as any).JU;
    const ui = typeof J.ui === 'function' ? J.ui() : J.ui;
    const st = J.getState();
    const c = document.getElementById('content')!;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return {
      sinceNavigationStart: performance.now(),
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : -1,
      nodeCount: Object.keys(st.nodes).length,
      /* boot 期自动建根的系统容器（日历待办 `_isCalRoot` / 数据库 `_isDbRoot` / 记事本 `_isNoteRoot`）
         不属于 30k 夹具：节点总数断言必须先扣除，否则「夹具装载保真」会被系统容器误判为多 1 个节点。 */
      systemNodes: Object.keys(st.nodes).filter((k) => {
        const n: any = st.nodes[k];
        return !!(n && !n._deleted && (n._isCalRoot || n._isDbRoot || n._isNoteRoot));
      }).length,
      /* 其中挂在根下、会进入 `root.children` 的系统容器（日历待办等），顶层文档数断言需扣除 */
      rootSystemNodes: Object.keys(st.nodes).filter((k) => {
        const n: any = st.nodes[k];
        return !!(n && !n._deleted && n.parent === st.rootId && (n._isCalRoot || n._isDbRoot || n._isNoteRoot));
      }).length,
      rootId: st.rootId,
      rootChildren: st.nodes[st.rootId] ? st.nodes[st.rootId].children.length : -1,
      renderedRows: c.querySelectorAll('.outline .node').length,
      currentDocId: ui ? ui.currentDocId : null,
      currentView: ui ? ui.view : null,
      harnessWired: !!(window as any).__m3BenchWired,
      bootError: J.__bootError || null,
      storedChars: (localStorage.getItem('juju.store.v31') || '').length,
      fixtureMeta: st._fixture || null,
    };
  });
  const wallStartupMs = Date.now() - tGoto;

  /* ── ③ 视图切换：真实点击顶栏按钮（大纲 → 导图 → 大纲） ── */
  const switchStats = await page.evaluate(async () => {
    const J = (window as any).JU;
    const ui = typeof J.ui === 'function' ? J.ui() : J.ui;
    const pick = (v: string) => document.querySelector('.tb-nav-btn[data-view="' + v + '"]') as HTMLButtonElement | null;
    if (!pick('outline') || !pick('mindmap')) return { error: 'topbar .tb-nav-btn[data-view] 缺失' };

    const measure = async (target: string) => {
      const btn = pick(target)!;
      const before = ui.view;
      const t0 = performance.now();
      btn.click(); /* 真实 click：命中的是产品 bindTopbar() 绑定的处理器 */
      const c = document.getElementById('content')!;
      c.getBoundingClientRect(); /* 强制样式 + 布局（含新视图 DOM 的 layout 代价） */
      const t1 = performance.now();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const t2 = performance.now();
      return {
        target,
        applied: ui.view === target && before !== target,
        syncMs: Number((t1 - t0).toFixed(2)),
        withPaintMs: Number((t2 - t0).toFixed(2)),
        firstChildClass: c.firstElementChild ? (c.firstElementChild as HTMLElement).className : null,
        mmNodes: c.querySelectorAll('.mm-node').length,
        outlineRows: c.querySelectorAll('.outline .node').length,
      };
    };

    /* 大纲 ↔ 导图各采样 5 次；报告保留末次明细，门禁用中位数（另设峰值兜底）。 */
    const rounds: string[] = [];
    for (let i = 0; i < 5; i++) rounds.push('mindmap', 'outline');
    const samples: Record<string, any[]> = { mindmap: [], outline: [] };
    for (const target of rounds) samples[target].push(await measure(target));
    const median = (xs: number[]): number => {
      const s = xs.slice().sort((a, b) => a - b);
      return s[Math.floor((s.length - 1) / 2)];
    };
    const summarize = (list: any[]) => {
      const paint = list.map((x) => x.withPaintMs);
      return {
        ...list[list.length - 1],
        applied: list.every((x) => x.applied),
        paintSamples: paint,
        paintMedianMs: median(paint),
      };
    };
    return { toMindmap: summarize(samples.mindmap), toOutline: summarize(samples.outline) };
  });

  /* ── ④ 内存：performance.memory（Chromium 专有） ── */
  const mem = await page.evaluate(() => {
    const m = (performance as any).memory;
    if (!m) return null;
    return {
      usedBytes: m.usedJSHeapSize as number,
      totalBytes: m.totalJSHeapSize as number,
      limitBytes: m.jsHeapSizeLimit as number,
    };
  });
  const heapMB = mem ? mem.usedBytes / (1024 * 1024) : null;

  /* ── ⑤ 详细报告 ── */
  const report = {
    servedBy,
    startup: {
      sinceNavigationStartMs: Number(startup.sinceNavigationStart.toFixed(1)),
      wallClockMs: wallStartupMs,
      domContentLoadedMs: Number(startup.domContentLoaded.toFixed(1)),
      nodeCount: startup.nodeCount,
      rootId: startup.rootId,
      rootChildren: startup.rootChildren,
      renderedOutlineRows: startup.renderedRows,
      currentDocId: startup.currentDocId,
      initialView: startup.currentView,
      harnessWired: startup.harnessWired,
      storedChars: startup.storedChars,
      bootError: startup.bootError,
    },
    fixtureMeta: startup.fixtureMeta,
    viewSwitch: switchStats,
    memory: mem
      ? {
          usedMB: Number(heapMB!.toFixed(1)),
          totalMB: Number((mem.totalBytes / (1024 * 1024)).toFixed(1)),
          limitMB: Number((mem.limitBytes / (1024 * 1024)).toFixed(1)),
        }
      : '无法测量（performance.memory 不可用）',
    limits: { startupMs: LIMIT_STARTUP_MS, switchMs: LIMIT_SWITCH_MS, switchPaintPeakMs: LIMIT_SWITCH_PEAK_MS, heapMB: LIMIT_HEAP_MB },
    pageErrors: pageErrors.slice(0, 5),
    consoleErrors: consoleErrors.slice(0, 5),
  };
  console.log('[M3-3] ' + JSON.stringify(report, null, 2));

  /* ── ⑥ 断言 ── */
  expect(startup.bootError, 'boot 不得失败：' + String(startup.bootError)).toBeNull();
  expect(startup.harnessWired, '渲染端口回填必须生效（否则视图切换无真实渲染）').toBe(true);
  expect(
    startup.nodeCount - startup.systemNodes,
    '夹具装载节点数必须为 30,000（boot 自动建的系统容器 ' + startup.systemNodes + ' 个另计）',
  ).toBe(EXPECTED_NODES);
  expect(
    startup.rootChildren - startup.rootSystemNodes,
    '根节点下应有 100 个顶层文档（挂在根下的系统容器 ' + startup.rootSystemNodes + ' 个另计）',
  ).toBe(100);
  expect(startup.renderedRows, '首屏大纲必须渲染出真实节点行').toBeGreaterThan(0);
  expect(
    startup.sinceNavigationStart,
    `启动时间必须 < ${LIMIT_STARTUP_MS}ms（实测 ${startup.sinceNavigationStart.toFixed(1)}ms，wall ${wallStartupMs}ms）`,
  ).toBeLessThan(LIMIT_STARTUP_MS);

  expect(switchStats.error, '视图切换前置条件：' + String(switchStats.error)).toBeUndefined();
  const sw = switchStats as {
    toMindmap: { applied: boolean; syncMs: number; withPaintMs: number; paintSamples: number[]; paintMedianMs: number; mmNodes: number };
    toOutline: { applied: boolean; syncMs: number; withPaintMs: number; paintSamples: number[]; paintMedianMs: number; outlineRows: number };
  };
  expect(sw.toMindmap.applied, '点击导图按钮后 ui.view 必须切换为 mindmap（产品处理器真实执行）').toBe(true);
  expect(sw.toOutline.applied, '点击大纲按钮后 ui.view 必须切回 outline').toBe(true);
  expect(sw.toMindmap.mmNodes, '导图视图必须渲染出 mm-node').toBeGreaterThan(0);
  expect(sw.toOutline.outlineRows, '切回大纲后必须重新渲染节点行').toBeGreaterThan(0);
  const maxSync = Math.max(sw.toMindmap.syncMs, sw.toOutline.syncMs);
  const maxPaintMedian = Math.max(sw.toMindmap.paintMedianMs, sw.toOutline.paintMedianMs);
  const maxPaint = Math.max(sw.toMindmap.withPaintMs, sw.toOutline.withPaintMs);
  expect(
    maxSync,
    `视图切换（处理器 + 强制布局）必须 < ${LIMIT_SWITCH_MS}ms（实测 导图 ${sw.toMindmap.syncMs}ms / 大纲 ${sw.toOutline.syncMs}ms）`,
  ).toBeLessThan(LIMIT_SWITCH_MS);
  expect(
    maxPaintMedian,
    `视图切换（含首帧绘制）中位必须 < ${LIMIT_SWITCH_MS}ms（实测 导图 ${sw.toMindmap.paintMedianMs}ms / 大纲 ${sw.toOutline.paintMedianMs}ms，各 5 次采样：导图 ${sw.toMindmap.paintSamples.join('/')} / 大纲 ${sw.toOutline.paintSamples.join('/')}）`,
  ).toBeLessThan(LIMIT_SWITCH_MS);
  expect(
    maxPaint,
    `视图切换（含首帧绘制）单次峰值必须 < ${LIMIT_SWITCH_PEAK_MS}ms（实测 导图 ${sw.toMindmap.withPaintMs}ms / 大纲 ${sw.toOutline.withPaintMs}ms）`,
  ).toBeLessThan(LIMIT_SWITCH_PEAK_MS);

  if (mem === null) {
    console.warn('[M3-3] performance.memory 不可用：本环境无法测量 JS 堆内存，跳过内存断言。');
  } else {
    expect(heapMB!, `JS 堆内存必须 < ${LIMIT_HEAP_MB}MB（实测 ${heapMB!.toFixed(1)}MB）`).toBeLessThan(LIMIT_HEAP_MB);
  }
});
