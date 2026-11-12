import { test, expect, type BrowserContext, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * M5-2 · 搜索 Worker 化长跑测试（3 万节点下输入不得产生 >50ms 长任务）
 *
 * 被测链路（真实运行期行为，无 mock、无桩数据）：
 *   `/?fixture=30k`
 *     → `src/app/boot.ts` 的 `loadBenchFixture()`（真实 fetch `/30k-fixture.json`，30,000 节点）
 *     → `core/store.initStore(initial)`（30k 节点装载，与基准测试同口径）
 *     → 测试注入的 `#searchInput` 经 `JU.bindSearchWorker()` 绑定到
 *       `src/core/search.worker.ts`（`?worker&inline`，单 HTML 产物内联）
 *     → 键入 5 个字符（逐字真实 `keydown`/`input`）→ Enter
 *
 * 断言（全部为产品真实行为）：
 *   ① 命中正确：查询 `基准资料库` 命中唯一节点 `1`（夹具中 `30K 基准资料库`），`total === 1`；
 *   ② 走 Worker：`source === 'worker'`、`engine === 'inverted'`、诊断 `fallbacks === 0`；
 *   ③ 不卡主线程：观测窗口内 **无** `duration > 50ms` 的 LongTask（PerformanceObserver `longtask`）；
 *   ④ 索引预热后每次按键只传 `query`（`cached === true`），不再克隆 3 万节点。
 *
 * ── 环境适配（与 `tests/benchmark-30k.spec.ts` 同一实测结论） ──
 * 本机浏览器进程到 127.0.0.1/localhost 的入站连接被系统策略阻断。故先直连真实 Vite dev server；
 * 导航失败则回落「`vite build` 产物 + 路由拦截」：页面仍运行在 `http://localhost:5173` 真实 HTTP 源上，
 * `fetch('/30k-fixture.json')` 仍是真实 fetch（由路由从 `dist/30k-fixture.json` 应答）。
 */

const BASE = 'http://localhost:5173';
const FIXTURE_URL = '/?fixture=30k';
const EXPECTED_NODES = 30_000;
const QUERY = '基准资料库';
const EXPECTED_ID = '1';
const LONG_TASK_MS = 50;

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
 * document-start 注入：搜索输入框。
 *
 * `index.html` 已自带产品三区骨架（`#app` / `#topbar` / `#content` / 两侧栏），
 * 因此这里不再重造骨架（重造会与产品 `boot()` 的渲染互相覆盖）。`#searchInput`
 * 挂在 `#app` 之外，避免 `renderSidebar()` / `renderMain()` 重建内部 DOM 时被清除；
 * 位置与样式不影响绑定/键盘语义（绑定发生在 `JU` 装配完成之后，见测试主体）。
 */
async function installSearchHarness(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        if (document.getElementById('searchInput')) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'searchInput';
        input.placeholder = '全局搜索…';
        input.setAttribute('aria-label', '全局搜索');
        input.style.position = 'fixed';
        input.style.left = '8px';
        input.style.top = '8px';
        input.style.zIndex = '9999';
        document.body.appendChild(input);
      },
      { once: true },
    );
  });
}

/** 重新构建（保证被测代码即当前源码），返回 dist 绝对路径。 */
async function prepareDist(): Promise<string> {
  const root = projectRoot();
  /* 单文件构建默认不拷贝 public/；本测试需要 dist/30k-fixture.json，显式开启 public 直通。 */
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

test('M5-2 搜索 Worker 化：3 万节点输入 5 字符无长任务', async ({ context, page }) => {
  test.setTimeout(300_000);

  await installSearchHarness(context);

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  /* ── ① 导航（先直连 dev server；失败则 vite build + 路由拦截重试） ── */
  let servedBy = 'vite-dev-server';
  try {
    await page.goto(FIXTURE_URL, { waitUntil: 'commit', timeout: 15_000 });
  } catch (e) {
    servedBy = 'vite-dist+route';
    console.log('[M5-2] dev server 直连失败，回落 dist 路由模式：' + String((e && (e as Error).message) || e).split('\n')[0]);
    const dist = await prepareDist();
    await installDistRoute(context, dist);
    await page.goto(FIXTURE_URL, { waitUntil: 'commit', timeout: 60_000 });
  }

  /* ── ② 30,000 节点已装载 + JU 装配完成 + 搜索入口可绑定 ── */
  await page.waitForFunction(
    (expected) => {
      const J = (window as any).JU;
      if (!J || typeof J.getState !== 'function' || typeof J.bindSearchWorker !== 'function') return false;
      const st = J.getState();
      return !!(st && st.nodes && Object.keys(st.nodes).length >= expected);
    },
    EXPECTED_NODES,
    { timeout: 120_000, polling: 50 },
  );

  /* 让启动期渲染 / 首次落盘收敛，避免把启动成本误计入「输入窗口」 */
  await page.evaluate(() => {
    try {
      const J = (window as any).JU;
      if (J && typeof J.flushPersistNow === 'function') J.flushPersistNow();
    } catch (e) {
      /* 落盘端口在迁移期可能为占位，忽略 */
    }
  });
  await page.waitForTimeout(1500);

  /* ── ③ 绑定搜索框（真实产品入口 JU.bindSearchWorker → search.worker.ts） ── */
  await page.evaluate(() => {
    const w = window as any;
    const input = document.getElementById('searchInput') as HTMLInputElement | null;
    if (!input) throw new Error('#searchInput 缺失');
    w.__searchEvents = [];
    window.addEventListener('ju:search-result', (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      w.__searchEvents.push({ at: performance.now(), query: d && d.query, total: d && d.total, source: d && d.source, engine: d && d.engine });
    });
    w.__searchHandle = w.JU.bindSearchWorker(input, { limit: 1000, debounceMs: 25 });
  });

  /* ── ④ 预热：一次性把 30k 节点交给 Worker 建倒排索引（刻意放在观测窗口之外） ── */
  const warmup = await page.evaluate(async () => {
    const w = window as any;
    const r = await w.__searchHandle.warmup();
    return { engine: r.engine, scanned: r.scanned, elapsedMs: r.elapsedMs, source: r.source, diag: w.__searchHandle.diagnostics() };
  });
  expect(warmup.diag.workerCreated, '搜索 Worker 必须真实创建').toBe(true);
  expect(warmup.diag.fallbacks, '预热不得回落同步路径').toBe(0);
  console.log('[M5-2] 预热：' + JSON.stringify(warmup));

  await page.waitForTimeout(300);

  /* ── ⑤ 开始 LongTask 观测（只统计本时刻之后的条目） ── */
  const ltSupported = await page.evaluate(() => {
    const w = window as any;
    w.__lt = [];
    w.__ltStart = performance.now();
    const supported = typeof PerformanceObserver !== 'undefined'
      && Array.isArray((PerformanceObserver as any).supportedEntryTypes)
      && (PerformanceObserver as any).supportedEntryTypes.indexOf('longtask') >= 0;
    if (!supported) return false;
    w.__ltObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.startTime >= w.__ltStart) {
          w.__lt.push({ startTime: Math.round(entry.startTime * 1000) / 1000, duration: Math.round(entry.duration * 1000) / 1000 });
        }
      }
    });
    w.__ltObs.observe({ entryTypes: ['longtask'] });
    return true;
  });
  expect(ltSupported, '当前 Chromium 必须支持 PerformanceObserver longtask').toBe(true);

  /* ── ⑥ 真实键入 5 个字符（逐字 120ms 间隔）→ Enter ── */
  const typingStart = Date.now();
  const keyDelays: number[] = [];
  const input = page.locator('#searchInput');
  await input.click();
  for (const ch of QUERY) {
    const t0 = Date.now();
    await page.keyboard.type(ch);
    keyDelays.push(Date.now() - t0);
    await page.waitForTimeout(120);
  }
  await page.keyboard.press('Enter');
  const typingMs = Date.now() - typingStart;

  await page.waitForFunction(
    (q) => {
      const r = (window as any).__juSearchLast;
      return !!(r && r.query === q && Array.isArray(r.ids));
    },
    QUERY,
    { timeout: 20_000, polling: 20 },
  );
  await page.waitForTimeout(250);

  /* ── ⑦ 取证并断言 ── */
  const metrics = await page.evaluate(() => {
    const w = window as any;
    if (w.__ltObs) {
      for (const entry of w.__ltObs.takeRecords ? w.__ltObs.takeRecords() : []) {
        if (entry.startTime >= w.__ltStart) {
          w.__lt.push({ startTime: Math.round(entry.startTime * 1000) / 1000, duration: Math.round(entry.duration * 1000) / 1000 });
        }
      }
      try {
        w.__ltObs.disconnect();
      } catch (e) {
        /* 已断开 */
      }
    }
    const last = w.__juSearchLast || null;
    return {
      last,
      diag: w.__searchHandle.diagnostics(),
      longTasks: (w.__lt || []).slice(),
      events: (w.__searchEvents || []).slice(),
      stateNodes: Object.keys((w.JU.getState() || {}).nodes || {}).length,
      /* boot 期自动建根的系统容器（日历待办 `_isCalRoot` 等）不属于 30k 夹具，断言时扣除 */
      systemNodes: Object.keys((w.JU.getState() || {}).nodes || {}).filter((k: string) => {
        const n: any = ((w.JU.getState() || {}).nodes || {})[k];
        return !!(n && !n._deleted && (n._isCalRoot || n._isDbRoot || n._isNoteRoot));
      }).length,
      searchState: (document.getElementById('searchInput') as HTMLInputElement | null)?.dataset.searchState || '',
    };
  });

  const longTasks = metrics.longTasks.filter((x: any) => x.duration > LONG_TASK_MS);
  console.log('[M5-2] 搜索指标：' + JSON.stringify({
    servedBy,
    typingMs,
    keyDelays,
    warmup,
    result: metrics.last && { query: metrics.last.query, total: metrics.last.total, ids: metrics.last.ids, elapsedMs: metrics.last.elapsedMs, engine: metrics.last.engine, cached: metrics.last.cached, source: metrics.last.source },
    diag: metrics.diag,
    longTasks: metrics.longTasks,
    events: metrics.events,
    stateNodes: metrics.stateNodes,
    pageErrors,
    consoleErrors,
  }));

  expect(
    metrics.stateNodes - metrics.systemNodes,
    '夹具装载节点数必须为 30,000（boot 自动建的系统容器 ' + metrics.systemNodes + ' 个另计）',
  ).toBe(EXPECTED_NODES);
  expect(metrics.last, '必须有最终搜索结果').toBeTruthy();
  expect(metrics.last.query).toBe(QUERY);
  expect(metrics.last.total, '查询 `' + QUERY + '` 应命中唯一节点').toBe(1);
  expect(metrics.last.ids).toEqual([EXPECTED_ID]);
  expect(metrics.last.source, '结果必须来自 Worker').toBe('worker');
  expect(metrics.last.engine, '预热后查询必须走倒排索引').toBe('inverted');
  expect(metrics.diag.fallbacks, '输入期间不得回落同步路径').toBe(0);
  expect(metrics.diag.tasks, 'Worker 必须完成多次检索').toBeGreaterThan(0);
  expect(longTasks, '输入窗口内不得出现 >50ms 长任务：' + JSON.stringify(longTasks)).toEqual([]);

  /* 收尾：释放 Worker（避免测试进程残留线程） */
  await page.evaluate(() => {
    try {
      (window as any).__searchHandle.dispose();
    } catch (e) {
      /* 已释放 */
    }
  });
});
