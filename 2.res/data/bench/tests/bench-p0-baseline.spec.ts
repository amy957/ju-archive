import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
const APP_URL = process.env.JU_URL || 'http://localhost:8080/v2.0-frozen.html';
const STATE_FILE =
  process.env.JU_BENCH_STATE ||
  path.join(__dirname, '..', 'ju-bench-20k.state.json');
const OUT_FILE =
  process.env.JU_BENCH_OUT ||
  path.join(__dirname, '..', 'bench-p0-baseline.json');
// ── 统计工具 ─────────────────────────────────────────────
function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i];
}
function stats(arr: number[]) {
  return {
    n: arr.length,
    min: arr.length ? Math.min(...arr) : 0,
    p50: percentile(arr, 50),
    p95: percentile(arr, 95),
    p99: percentile(arr, 99),
    max: arr.length ? Math.max(...arr) : 0,
    mean: arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0,
  };
}
// ── 通用准备：注入 state、安装 hook ──────────────────────
async function loadBench(page: Page, state: any) {
  // 1) 启动前安装：吞掉 localStorage 配额错误（20k 会超 4.5MB），保证 runPersist 序列化路径完整执行
  await page.addInitScript(() => {
    const _set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      try {
        return _set.call(this, k, v);
      } catch (e: any) {
        if (e && (e.name === 'QuotaExceededError' || e.code === 22)) return;
        throw e;
      }
    };
    (window as any).__bench = {
      commits: [] as number[],
      persists: [] as number[],
      views: [] as number[],
    };
  });
  await page.goto(APP_URL);
  await page.waitForSelector('#topbar', { timeout: 15000 });
  // 2) 注入 state，绕过 localStorage
  await page.evaluate((s) => {
    localStorage.clear();
    // @ts-ignore
    initStore(s);
    // @ts-ignore
    ensureCalendarRoot();
    // 打开第一个文档：默认 currentDocId=null 会渲染文件列表而非大纲
    const firstDoc = Object.keys(s.nodes).find((id) => id.startsWith('doc'));
    if (firstDoc && typeof ui !== 'undefined') {
      ui.currentDocId = firstDoc;
      ui.view = 'auto';
      ui.activeKey = 'node:' + firstDoc;
    }
    // @ts-ignore
    forceRender();
  }, state);
  await page.waitForSelector('#content .outline', { timeout: 30000 });
  // 3) 安装 commit / runPersist 计时 hook
  await page.evaluate(() => {
    const w = window as any;
    const origCommit = w.commit;
    w.commit = function (...args: any[]) {
      const t0 = performance.now();
      const r = origCommit.apply(this, args);
      w.__bench.commits.push(performance.now() - t0);
      return r;
    };
    const origRun = w.runPersist;
    w.runPersist = async function (...args: any[]) {
      const t0 = performance.now();
      const r = await origRun.apply(this, args);
      w.__bench.persists.push(performance.now() - t0);
      return r;
    };
  });
}
// ── 内存读取（CDP 精确 + performance.memory 兜底） ──────
async function readMemory(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const m = await cdp.send('Performance.getMetrics');
  const map: Record<string, number> = {};
  for (const x of m.metrics) map[x.name] = x.value;
  await cdp.detach().catch(() => {});
  return {
    JSHeapUsedSize: map.JSHeapUsedSize || 0,
    JSHeapTotalSize: map.JSHeapTotalSize || 0,
    Nodes: map.Nodes || 0,
    Documents: map.Documents || 0,
  };
}
// ────────────────────────────────────────────────────────
test('P0 前基线：20k 节点四项指标', async ({ page }) => {
  test.setTimeout(300000);
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  const totalNodes = Object.keys(state.nodes).length;
  console.log(`[bench] 注入节点数：${totalNodes}`);
  const result: any = {
    meta: {
      appVersion: 'v2.0-frozen',
      nodeCount: totalNodes,
      ts: new Date().toISOString(),
      appUrl: APP_URL,
    },
    metrics: {},
  };
  // ── 阶段 0：冷启动首屏 ────────────────────────────────
  const tBoot0 = Date.now();
  await loadBench(page, state);
  result.metrics.bootFirstPaint = Date.now() - tBoot0;
  // 预热：等一轮 rAF，避免首次测量含 JIT 抖动
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => r()))
  );
  // ── 阶段 1：内存基线（注入后空闲态） ──────────────────
  const memIdle = await readMemory(page);
  result.metrics.memIdle = memIdle;
  // ── 阶段 2：打字 commit P95 ───────────────────────────
  // 做法：把焦点放第一个可编辑节点，循环 [输入 → blur → focus]，
  // blur 会触发 actions.updateText → commit，hook 记录耗时。
  await page.evaluate(() => {
    const el = document.querySelector('#content .outline .text') as HTMLElement;
    if (el) el.focus();
  });
  const TYPE_ROUNDS = 100;
  for (let i = 0; i < TYPE_ROUNDS; i++) {
    await page.evaluate((n) => {
      const el = document.querySelector('#content .outline .text') as HTMLElement;
      if (!el) return;
      el.focus();
      // 直接在 DOM 上追加一个字符（绕过 IME，模拟最简输入）
      el.textContent = (el.textContent || '') + String.fromCharCode(97 + (n % 26));
      // blur 触发 actions.updateText → commit
      el.blur();
    }, i);
    // 让出主线程，避免 evaluate 队列挤占
    if (i % 10 === 9) await page.waitForTimeout(0);
  }
  const commitSamples: number[] = await page.evaluate(
    () => (window as any).__bench.commits
  );
  result.metrics.commitTyping = stats(commitSamples);
  // ── 阶段 3：内存峰值（打字之后） ──────────────────────
  const memAfterType = await readMemory(page);
  result.metrics.memAfterType = memAfterType;
  // ── 阶段 4：落盘耗时 ──────────────────────────────────
  // 触发一次显式落盘，并等待 runPersist 完成
  await page.evaluate(async () => {
    // @ts-ignore
    if (typeof schedulePersist === 'function') schedulePersist();
    // 等 300ms 防抖 + 序列化时间
    await new Promise((r) => setTimeout(r, 1200));
  });
  const persistSamples: number[] = await page.evaluate(
    () => (window as any).__bench.persists
  );
  result.metrics.persist = stats(persistSamples);
  // ── 阶段 5：切视图耗时 ────────────────────────────────
  const viewRuns: Record<string, number[]> = {
    mindmap: [],
    graph: [],
    outline_back: [],
    calendar: [],
    database: [],
  };
  // 大纲 → 思维导图
  for (let i = 0; i < 3; i++) {
    let t0 = Date.now();
    await page.click('.tb-nav-btn[data-view="mindmap"]');
    await page.waitForSelector('.mm-wrap', { timeout: 30000 });
    viewRuns.mindmap.push(Date.now() - t0);
    // 返回大纲
    t0 = Date.now();
    await page.click('.tb-nav-btn[data-view="outline"]');
    await page.waitForSelector('#content .outline', { timeout: 30000 });
    viewRuns.outline_back.push(Date.now() - t0);
  }
  // 图谱（走 Worker，同步回退也可能触发）
  for (let i = 0; i < 3; i++) {
    let t0 = Date.now();
    await page.click('.tb-nav-btn[data-view="graph"]');
    await page.waitForSelector('.graph-canvas', { timeout: 60000 });
    viewRuns.graph.push(Date.now() - t0);
    t0 = Date.now();
    await page.click('.tb-nav-btn[data-view="outline"]');
    await page.waitForSelector('#content .outline', { timeout: 30000 });
    viewRuns.outline_back.push(Date.now() - t0);
  }
  // 日历（从侧栏进）
  for (let i = 0; i < 3; i++) {
    let t0 = Date.now();
    await page.click('.sb-nav-item[data-nav="calendar"]');
    await page.waitForSelector('.cal-page', { timeout: 30000 });
    viewRuns.calendar.push(Date.now() - t0);
    await page.click('.sb-nav-item[data-nav="files"]').catch(() => {});
    await page.waitForTimeout(150);
  }
  // 数据库（从侧栏进，与日历阶段一致；openNode 仅改 activeKey 不触发重渲染）
  await page.click('.sb-nav-item[data-nav="database"]');
  await page.waitForSelector('.db-page', { timeout: 30000 });
  viewRuns.database.push(0); // 首屏已渲染
  result.metrics.viewSwitch = {
    mindmap: stats(viewRuns.mindmap),
    graph: stats(viewRuns.graph),
    outline_back: stats(viewRuns.outline_back),
    calendar: stats(viewRuns.calendar),
  };
  // ── 阶段 6：内存收尾 ──────────────────────────────────
  const memEnd = await readMemory(page);
  result.metrics.memEnd = memEnd;
  result.metrics.memPeak = {
    JSHeapUsedSize: Math.max(memIdle.JSHeapUsedSize, memAfterType.JSHeapUsedSize, memEnd.JSHeapUsedSize),
  };
  // ── 输出 ──────────────────────────────────────────────
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), 'utf-8');
  console.log('══════════ P0 前基线（20k 节点）══════════');
  console.log(`首屏渲染         : ${result.metrics.bootFirstPaint} ms`);
  console.log(`打字 commit      : P50=${result.metrics.commitTyping.p50.toFixed(1)}  P95=${result.metrics.commitTyping.p95.toFixed(1)}  P99=${result.metrics.commitTyping.p99.toFixed(1)}  max=${result.metrics.commitTyping.max.toFixed(1)} ms  (n=${result.metrics.commitTyping.n})`);
  console.log(`落盘 runPersist  : P50=${result.metrics.persist.p50.toFixed(1)}  P95=${result.metrics.persist.p95.toFixed(1)}  max=${result.metrics.persist.max.toFixed(1)} ms  (n=${result.metrics.persist.n})`);
  console.log(`切视图·思维导图  : P50=${result.metrics.viewSwitch.mindmap.p50.toFixed(0)}  max=${result.metrics.viewSwitch.mindmap.max.toFixed(0)} ms`);
  console.log(`切视图·图谱      : P50=${result.metrics.viewSwitch.graph.p50.toFixed(0)}  max=${result.metrics.viewSwitch.graph.max.toFixed(0)} ms`);
  console.log(`切回大纲         : P50=${result.metrics.viewSwitch.outline_back.p50.toFixed(0)}  max=${result.metrics.viewSwitch.outline_back.max.toFixed(0)} ms`);
  console.log(`内存·空闲        : ${(memIdle.JSHeapUsedSize / 1048576).toFixed(1)} MB`);
  console.log(`内存·打字后      : ${(memAfterType.JSHeapUsedSize / 1048576).toFixed(1)} MB`);
  console.log(`内存·峰值        : ${(result.metrics.memPeak.JSHeapUsedSize / 1048576).toFixed(1)} MB`);
  console.log(`结果已写入       : ${OUT_FILE}`);
  console.log('══════════════════════════════════════════');
  // 基线不做门控断言，仅记录；P0 后以 5ms / 50ms / 100ms 为门控。
  expect(result.metrics.commitTyping.n).toBeGreaterThan(0);
});
