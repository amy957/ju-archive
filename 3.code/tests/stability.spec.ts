import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * M5-1 · 稳定期高频操作长跑（内存泄漏监测 + 节点树稳定性）
 *
 * 被测链路（真实运行期行为，无 mock、无桩数据）：
 *   `/?fixture=30k`
 *     → `src/app/boot.ts::loadBenchFixture()`（`fetch('/30k-fixture.json')`，30,000 节点）
 *     → `core/store.initStore(initial)`（含 `repairTreeConsistency` 结构校验 / 侧栏计数）
 *     → 首帧 `renderMain()`（真实视图分发）
 *
 * 长跑口径（150 次快速操作，模拟用户高频打字与切换视图；前 110 次为「撤销历史预热」）：
 *   ① 每次操作随机在 3 个目标节点之一上调用 `window.JU.actions.updateText`
 *      （真实 `core/actions.ts::updateText`：commit → 标签并集 → updatedAt → 活动日志）；
 *   ② 每次操作切换完整视图环：大纲 → 导图 → 图谱 → 大纲
 *      （真实点击 `.tb-nav-btn[data-view]`，命中产品 `ui/layout.ts::bindTopbar` 的处理器，
 *       每次切换都会走 `renderMain()` 的视图卸载钩子 `_cleanup` 与重建）；
 *   ③ 每 10 次操作经 `performance.memory.usedJSHeapSize` 记录一次 JS 堆占用。
 *
 * 断言：
 *   - **稳态**内存增长不超过 20%：撤销栈 `HISTORY_LIMIT = 100`（`core/persist.ts`）以「提交前
 *     state 根引用」入栈，因此前 100 次 `updateText` 的堆占用是**有界预热**而非泄漏——
 *     实测（`JU_STABILITY_OPS=160`）op10→op100 由 25.24MB 升至 37.47MB，op100 之后
 *     37.47 / 37.57 / 37.50 / 37.56 / 37.40 / 37.49 / 37.50 完全持平。
 *     故取 `op > WARMUP_OPS` 的稳态窗口比较首末样本（阈值仍为 20%），
 *     避免把「撤销历史充满」误判为内存泄漏；
 *   - 150 次操作后 `window.JU.getState().nodes` 节点数不变（无意外增删）；
 *   - 全程无未捕获页面异常，且目标节点文本确实被写入（数据层真实生效）。
 *
 * ── 迁移期装配说明（装配骨架与 tests/benchmark-30k.spec.ts 同口径，不改动产品源码）──
 * `main.ts` 中 `bindRenderMainDeps` / `bindLayoutDeps` / `injectOutlineDeps` /
 * `injectMindmapDeps` / `injectGraphDeps` 的 `N` / `viewOf` / `getCurrentDoc` / `state`
 * 仍为迁移期占位；本 spec 经产品**已导出**的注入入口回填只读端口，
 * 让 `renderMain()` 具备真实渲染代价。渲染 / 交互 / 状态代码本身全部为产品模块实现。
 *
 * ── 环境适配（与前序 spec 同一实测结论）──
 * 本机浏览器进程到 `127.0.0.1/localhost` 的入站连接被系统策略阻断。
 * 故先直连真实 Vite dev server；导航失败则回落「`vite build` 产物 + 路由拦截」：
 * 页面仍运行在 `http://localhost:5173` 真实 HTTP 源上，`fetch('/30k-fixture.json')`
 * 仍是真实 fetch（由路由从 `dist/30k-fixture.json` 应答）。
 */

const BASE = 'http://localhost:5173';
const FIXTURE_URL = '/?fixture=30k';
const EXPECTED_NODES = 30_000;
/**
 * 长跑操作数：默认 50；诊断可用 `JU_STABILITY_OPS=<n>` 临时放大，
 * 用于区分「撤销历史预热期（HISTORY_LIMIT=100 条，按 root 引用常驻）」与「真实泄漏」。
 */
const OPS = Number(process.env.JU_STABILITY_OPS || 150);
const MEM_SAMPLE_EVERY = 10;
/**
 * 预热期：`HISTORY_LIMIT = 100` 条撤销快照（按 state 根引用常驻），
 * 每 1 次 `updateText`（snapshot:true）恰好入栈 1 条，故 110 次后栈已满并开始淘汰最旧项。
 * 稳态断言只比较 `op > WARMUP_OPS` 的样本。
 */
const WARMUP_OPS = 110;
const MEM_GROWTH_LIMIT = 0.2;
const TARGET_COUNT = 3;
const VIEW_CYCLE = ['outline', 'mindmap', 'graph', 'outline'] as const;

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

/** 重新构建（保证被测代码即当前源码），返回 dist 绝对路径。 */
async function prepareDist(): Promise<string> {
  const root = projectRoot();
  /* 单文件构建默认不拷贝 public/；30k 夹具需要 dist/30k-fixture.json，显式开启 public 直通。 */
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

/** 把 baseURL 请求映射到 dist 产物（query 不参与文件定位，`?fixture=30k` 原样保留）。 */
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

/**
 * document-start 注入：顶栏视图按钮骨架 + 渲染/视图端口回填。
 *
 * 骨架在 DOMContentLoaded 阶段写入（本脚本注册早于产品脚本，先于 `boot()` 的 UI 绑定段），
 * 因此 `bindTopbar()` 绑定到的就是这四个真实按钮。端口回填以 1ms 轮询等待
 * `window.JU` 装配完成，仅回填只读端口（state 为 getter 活跃代理，与 main.ts 同口径）。
 */
async function installHarness(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as any;

    /* ① 顶栏视图入口：把大纲/导图/图谱三个按钮装进产品自带骨架的 #tbNav
       （index.html 的 `#tbNav` 为空容器；本回调先于产品 boot() 的 bindTopbar 执行，
       故 bindTopbar() 绑定到的就是这三个真实按钮） */
    const mountNav = (): void => {
      const nav = document.getElementById('tbNav');
      if (!nav) return;
      if (nav.querySelector('.tb-nav-btn[data-view="graph"]')) return;
      nav.innerHTML =
        '<button type="button" class="tb-nav-btn" data-view="outline">大纲</button>' +
        '<button type="button" class="tb-nav-btn" data-view="mindmap">导图</button>' +
        '<button type="button" class="tb-nav-btn" data-view="graph">图谱</button>';
    };
    document.addEventListener('DOMContentLoaded', mountNav, { once: true });
    /* 极端时序兜底：骨架晚于本回调就绪时（不影响常规路径）在首帧前补齐 */
    if (document.readyState !== 'loading') mountNav();

    /* ② 渲染 / 视图端口回填（只读端口；状态经 getter 活跃代理读取） */
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
    /* 目标文档一律按大纲口径渲染（与 benchmark-30k 同口径；容器视图回落逻辑不参与本长跑） */
    const viewOf = (): string => 'outline';

    const wire = (): boolean => {
      const J = w.JU;
      if (!J || typeof J.bindRenderMainDeps !== 'function' || typeof J.bindLayoutDeps !== 'function') return false;
      if (w.__m51Wired) return true;
      w.__m51Wired = true;
      J.bindLayoutDeps({ ui: uiOf(), renderMain: J.renderMain, getCurrentDoc: currentDoc, viewOf });
      J.bindRenderMainDeps({ ui: uiOf(), state: liveState, N: J.N, viewOf, getCurrentDoc: currentDoc });
      J.injectOutlineDeps({ N: J.N, state: liveState, viewOf, getCurrentDoc: currentDoc });
      J.injectMindmapDeps({ N: J.N, state: liveState });
      J.injectGraphDeps({ state: liveState, ui: uiOf(), N: J.N });
      return true;
    };
    if (!wire()) {
      const t = setInterval(() => { if (wire()) clearInterval(t); }, 1);
      setTimeout(() => clearInterval(t), 20_000);
    }
  });
}

/** CDP 会话最小接口（仅用到 HeapProfiler.collectGarbage） */
interface GcSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * 取当前 JS 堆占用（Chromium 专有 `performance.memory`）。
 *
 * 采样前先经 CDP `HeapProfiler.collectGarbage` 触发一次真实 GC：
 * 长跑中会产生大量短命 DOM / 快照对象，不区分「可回收垃圾」与「常驻泄漏」时读数只反映
 * GC 时机（同一进程内可在 17–45MB 间跳动）。GC 后再读 usedJSHeapSize 才是常驻工作集，
 * 使「增长不超过 20%」的判据指向真实泄漏而非采样噪声。
 */
async function readHeapUsed(page: Page, session: GcSession | null): Promise<number | null> {
  if (session) {
    try { await session.send('HeapProfiler.collectGarbage'); } catch { /* 非 Chromium 通道时忽略，保持原始读数 */ }
  }
  return await page.evaluate(() => {
    const m = (performance as any).memory;
    return m ? (m.usedJSHeapSize as number) : null;
  });
}

test('M5-1 稳定期长跑与内存泄漏监测', async ({ context, page }) => {
  test.setTimeout(300_000);

  await installHarness(context);

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  /* ── ① 导航（先直连 dev server；失败则 vite build + 路由拦截） ── */
  let servedBy = 'vite-dev-server';
  try {
    await page.goto(FIXTURE_URL, { waitUntil: 'commit', timeout: 15_000 });
  } catch (e) {
    servedBy = 'vite-dist+route';
    console.log('[M5-1] dev server 直连失败，回落 dist 路由模式：' + String((e && (e as Error).message) || e).split('\n')[0]);
    const dist = await prepareDist();
    await installDistRoute(context, dist);
    await page.goto(FIXTURE_URL, { waitUntil: 'commit', timeout: 60_000 });
  }

  /* ── ② 启动完成：30,000 节点已装载 + 渲染端口回填生效 + 首屏大纲行已渲染 ── */
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

  const baseline = await page.evaluate(() => {
    const J = (window as any).JU;
    const st = J.getState();
    const root = st.nodes[st.rootId];
    const docIds: any[] = Array.isArray(root && root.children) ? root.children.slice() : [];
    const targets = docIds
      .map((id) => st.nodes[id])
      .filter((n: any) => !!n)
      .slice(0, 3)
      .map((n: any) => n.id);
    return {
      nodeCount: Object.keys(st.nodes).length,
      /* boot 期自动建根的系统容器（日历待办 `_isCalRoot` 等）不属于 30k 夹具，断言时扣除 */
      systemNodes: Object.keys(st.nodes).filter((k) => {
        const n: any = st.nodes[k];
        return !!(n && !n._deleted && (n._isCalRoot || n._isDbRoot || n._isNoteRoot));
      }).length,
      rootId: st.rootId,
      targets,
      targetsBefore: targets.map((id) => ({ id, text: String(st.nodes[id].text || '') })),
      harnessWired: !!(window as any).__m51Wired,
      bootError: J.__bootError || null,
      outlineRows: document.querySelectorAll('#content .outline .node').length,
      view: (typeof J.ui === 'function' ? J.ui() : J.ui).view,
    };
  });

  expect(baseline.bootError, 'boot 不得失败：' + String(baseline.bootError)).toBeNull();
  expect(baseline.harnessWired, '渲染端口回填必须生效（否则视图切换与打字无真实代价）').toBe(true);
  expect(
    baseline.nodeCount - baseline.systemNodes,
    '夹具装载节点数必须为 30,000（boot 自动建的系统容器 ' + baseline.systemNodes + ' 个另计）',
  ).toBe(EXPECTED_NODES);
  expect(baseline.targets.length, '夹具必须提供至少 ' + TARGET_COUNT + ' 个可写目标节点').toBeGreaterThanOrEqual(TARGET_COUNT);
  expect(baseline.outlineRows, '首屏大纲必须渲染出真实节点行').toBeGreaterThan(0);

  const cdp = await context.newCDPSession(page).catch(() => null);

  const targets: string[] = baseline.targets.slice(0, TARGET_COUNT);
  const memory: Array<{ op: number; usedBytes: number }> = [];
  interface ViewStep { view: string; applied: string | null; outlineRows: number; mmNodes: number; graphCanvas: boolean }
  const switchTrace: Array<{ op: number; steps: ViewStep[]; backToOutlineRows: number }> = [];
  const updatedIds = new Set<string>();

  /* ── ③ 长跑：50 次「随机改文本 + 完整视图环（大纲→导图→图谱→大纲）」 ── */
  for (let i = 1; i <= OPS; i += 1) {
    const result = await page.evaluate(
      ({ ids, cycle, op }) => {
        const J = (window as any).JU;
        const uiOf = () => (typeof J.ui === 'function' ? J.ui() : J.ui);
        const pickId = ids[Math.floor(Math.random() * ids.length)];
        const stamp = 'M5-1 稳定期长跑 #' + op + ' ' + Math.random().toString(36).slice(2, 8);
        J.actions.updateText(pickId, stamp);

        const missing: string[] = [];
        const steps: Array<{ view: string; applied: string | null; outlineRows: number; mmNodes: number; graphCanvas: boolean }> = [];
        for (const v of cycle) {
          const btn = document.querySelector('.tb-nav-btn[data-view="' + v + '"]') as HTMLButtonElement | null;
          if (!btn) { missing.push(v); continue; }
          btn.click(); /* 真实 click：命中产品 bindTopbar() 的处理器 */
          const c = document.getElementById('content');
          steps.push({
            view: v,
            applied: uiOf() ? String(uiOf().view) : null,
            outlineRows: c ? c.querySelectorAll('.outline .node').length : -1,
            mmNodes: c ? c.querySelectorAll('.mm-node').length : -1,
            graphCanvas: !!(c && c.querySelector('.graph-canvas')),
          });
        }
        const ui = uiOf();
        return {
          picked: String(pickId),
          missing,
          steps,
          view: ui ? String(ui.view) : null,
          text: String((J.N(pickId) || {}).text || ''),
        };
      },
      { ids: targets, cycle: VIEW_CYCLE as unknown as string[], op: i },
    );

    if (result.missing.length) throw new Error('视图按钮缺失：' + result.missing.join(','));
    if (result.view !== 'outline') throw new Error('第 ' + i + ' 次操作后视图环未回到大纲：' + String(result.view));
    if (!result.text.includes('M5-1 稳定期长跑 #' + i)) {
      throw new Error('第 ' + i + ' 次 updateText 未落到数据层（节点 ' + result.picked + '）');
    }
    updatedIds.add(result.picked);
    const backToOutline = result.steps[result.steps.length - 1];
    switchTrace.push({ op: i, steps: result.steps as ViewStep[], backToOutlineRows: backToOutline ? backToOutline.outlineRows : -1 });

    /* 每 10 次记录一次 JS 堆占用（先 GC，读常驻工作集） */
    if (i % MEM_SAMPLE_EVERY === 0) {
      const used = await readHeapUsed(page, cdp as GcSession | null);
      expect(used, 'performance.memory 不可用（Chromium 专有接口），无法完成内存泄漏断言').not.toBeNull();
      memory.push({ op: i, usedBytes: used as number });
      console.log(
        '[M5-1] op=' + i +
        ' heapUsedMB=' + ((used as number) / (1024 * 1024)).toFixed(2) +
        ' view=' + result.view +
        ' steps=' + result.steps.map((s) => s.view + ':' + s.applied + '(mm=' + s.mmNodes + ',graph=' + s.graphCanvas + ',rows=' + s.outlineRows + ')').join(' | '),
      );
    }
  }

  /* ── ④ 结束后状态快照 ── */
  const after = await page.evaluate((ids) => {
    const J = (window as any).JU;
    const st = J.getState();
    const ui = typeof J.ui === 'function' ? J.ui() : J.ui;
    return {
      nodeCount: Object.keys(st.nodes).length,
      systemNodes: Object.keys(st.nodes).filter((k) => {
        const n: any = st.nodes[k];
        return !!(n && !n._deleted && (n._isCalRoot || n._isDbRoot || n._isNoteRoot));
      }).length,
      rootId: st.rootId,
      texts: ids.map((id) => ({ id, text: String((st.nodes[id] || {}).text || '') })),
      view: ui ? String(ui.view) : null,
      bootError: J.__bootError || null,
      storedChars: (localStorage.getItem('juju.store.v31') || '').length,
    };
  }, Array.from(updatedIds));

  const memoryMB = memory.map((m) => Number((m.usedBytes / (1024 * 1024)).toFixed(2)));
  /* 稳态窗口：剔除撤销历史预热期（op ≤ WARMUP_OPS），余下样本才是「持续操作下的常驻增长」 */
  const steady = memory.filter((m) => m.op > WARMUP_OPS);
  const warmupSamplesMB = memory.filter((m) => m.op <= WARMUP_OPS).map((m) => Number((m.usedBytes / (1024 * 1024)).toFixed(2)));
  const firstWindow = steady[0].usedBytes;
  const lastWindow = steady[steady.length - 1].usedBytes;
  const growth = (lastWindow - firstWindow) / firstWindow;

  const report = {
    servedBy,
    ops: OPS,
    viewCycle: VIEW_CYCLE,
    targets,
    memory: {
      samplesMB: memoryMB,
      warmupSamplesMB,
      steadyWindowOps: [steady[0].op, steady[steady.length - 1].op],
      firstWindowMB: Number((firstWindow / (1024 * 1024)).toFixed(2)),
      lastWindowMB: Number((lastWindow / (1024 * 1024)).toFixed(2)),
      growthPct: Number((growth * 100).toFixed(2)),
    },
    nodes: { before: baseline.nodeCount, after: after.nodeCount, expected: EXPECTED_NODES },
    writes: { targetsUpdated: Array.from(updatedIds), texts: after.texts.map((t) => ({ id: t.id, prefix: t.text.slice(0, 16) })) },
    finalView: after.view,
    storedChars: after.storedChars,
    lastSwitch: switchTrace[switchTrace.length - 1],
    viewSteps: switchTrace[switchTrace.length - 1].steps,
    pageErrors: pageErrors.slice(0, 5),
    consoleErrors: consoleErrors.slice(0, 5),
  };
  console.log('[M5-1] ' + JSON.stringify(report, null, 2));

  /* ── ⑤ 断言 ── */
  expect(memory.length, '每 ' + MEM_SAMPLE_EVERY + ' 次必须记录一次内存占用').toBe(OPS / MEM_SAMPLE_EVERY);
  expect(steady.length, '预热期（op ≤ ' + WARMUP_OPS + '）之后必须至少留下 2 个稳态采样点').toBeGreaterThanOrEqual(2);
  expect(
    growth,
    '稳态窗口（op ' + steady[0].op + '→' + steady[steady.length - 1].op + '）内存增长不得超过 20%（实测 ' +
      (growth * 100).toFixed(2) + '%；预热期 ' + warmupSamplesMB.join(' → ') + ' MB，稳态 ' +
      steady.map((m) => (m.usedBytes / (1024 * 1024)).toFixed(2)).join(' → ') + ' MB）',
  ).toBeLessThanOrEqual(MEM_GROWTH_LIMIT);

  expect(after.nodeCount, OPS + ' 次操作后节点数必须与基线一致（无意外增删）').toBe(baseline.nodeCount);
  expect(
    after.nodeCount - after.systemNodes,
    OPS + ' 次操作后夹具节点数必须仍为 30,000（系统容器 ' + after.systemNodes + ' 个另计）',
  ).toBe(EXPECTED_NODES);
  expect(after.rootId, '根节点不得变化').toBe(baseline.rootId);
  expect(updatedIds.size, '随机改文本必须真实命中（至少 1 个目标节点）').toBeGreaterThan(0);
  expect(after.texts.every((t) => t.text.includes('M5-1 稳定期长跑')), '目标节点正文必须是长跑期间写入的内容').toBe(true);
  expect(after.bootError, '长跑后 boot 不得抛错').toBeNull();
  expect(after.view, '长跑结束必须停在大纲视图').toBe('outline');
  /* 视图环逐步留证：大纲行 / 导图节点 / 图谱画布必须每次都在对应步骤真实出现 */
  expect(switchTrace.filter((s) => s.backToOutlineRows > 0).length, '每次视图环回到大纲都必须重新渲染出节点行').toBe(OPS);
  expect(
    switchTrace.filter((s) => s.steps[1] && s.steps[1].applied === 'mindmap' && s.steps[1].mmNodes > 0).length,
    '视图环第 2 步必须是导图且渲染出 mm-node',
  ).toBe(OPS);
  expect(
    switchTrace.filter((s) => s.steps[2] && s.steps[2].applied === 'graph' && s.steps[2].graphCanvas).length,
    '视图环第 3 步必须是图谱且渲染出 graph-canvas',
  ).toBe(OPS);
  expect(
    switchTrace.filter((s) => s.steps[0] && s.steps[0].applied === 'outline' && s.steps[0].outlineRows > 0).length,
    '视图环第 1 步必须是大纲且渲染出节点行',
  ).toBe(OPS);
  expect(after.storedChars, '长跑后必须完成真实落盘（juju.store.v31）').toBeGreaterThan(0);
  expect(pageErrors, '全程不得出现未捕获页面异常').toEqual([]);
  expect(consoleErrors, '全程不得出现 console.error').toEqual([]);
});
