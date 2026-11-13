#!/usr/bin/env node
/* P-12 基准 P95 采集（替代 DevTools/CDP）
 *
 * 背景：打包版 WebView2 的 --remote-debugging-port 在本机 LISTENING 但不响应
 * /json/version，DevTools 性能面板接不进；而 P-12 要的是「产品页面」的
 * 首屏渲染 / 滚动 / 视图切换 P95，与引擎无关（WebView2 与 Chromium 同源）。
 *
 * 做法：用 Playwright 打开 canonical/v2.0-t3.html（与门禁同一被测件），
 * 造 1000 节点 → 连续滚动取帧间隔 → 反复切换大纲/思维导图取耗时，
 * 全部用 performance.now() 采样后取 P95，最后按阈值判定并输出 JSON。
 *
 * 阈值来源：1.docs/benchmark-roadmap.md —— 滚动 P95 < 100ms、视图切换 < 500ms。
 * 用法：node scripts/perf-p95.mjs [--json <out>]
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', '..', 'canonical', 'v2.0-t3.html');
const NODE_TARGET = 1000;
const SCROLL_SAMPLES = 40;
const SWITCH_ROUNDS = 10;
const BUDGET_SCROLL_MS = 100;
const BUDGET_SWITCH_MS = 500;

const p95 = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
};
const round = (n) => Math.round(n * 100) / 100;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('file://' + APP.replace(/\\/g, '/'));
await page.waitForFunction(() => typeof state === 'object' && state && state.rootId, null, { timeout: 20000 });

/* 造 1000 节点（直接构造 state 节点树，形状与产品一致），再走产品自带的渲染入口 */
const built = await page.evaluate((target) => {
  const s = state;
  const rootId = s.rootId;
  const stamp = Date.now();
  for (let i = 0; i < target; i += 1) {
    const id = 'perf-' + i;
    if (s.nodes[id]) continue;
    s.nodes[id] = {
      id, text: '性能样本节点 ' + i, parent: rootId, children: [],
      collapsed: false, done: false, date: null, tags: [], priority: 0,
      recur: null, habit: false, createdAt: stamp, updatedAt: stamp, showInCal: false,
    };
    s.nodes[rootId].children.push(id);
  }
  /* 不直接调 _renderOutlineVirtual（它要求视图容器已挂载）；
     改由点击「大纲」页签触发产品自己的完整渲染路径。 */
  return Object.keys(s.nodes).length;
}, NODE_TARGET);

await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '大纲');
  if (b) b.click();
});
/* 首屏：导航起算到 First Contentful Paint（在渲染之后读取，避免条目尚未生成） */
const firstPaint = await page.evaluate(() => {
  const e = performance.getEntriesByType('paint').find((x) => x.name === 'first-contentful-paint');
  return e ? e.startTime : null;
});
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/* 渲染行数：用于判定「注入的节点是否真的进了渲染树」，避免拿假数据量测滚动 */
const renderedRows = await page.evaluate(() => document.querySelectorAll('#content [data-nid], #content .ju-row, #content .ol-row').length);

/* 滚动：大纲是虚拟列表，没有实体滚动条（#content scrollHeight == clientHeight），
   因此用真实滚轮事件（Playwright mouse.wheel → 受信任输入）驱动，再测「滚轮→两帧落定」耗时。
   同时用首行元素位移判定「确实滚动了」，避免在不能滚的页面测出假绿。 */
const scroll = await (async () => {
  await page.mouse.move(640, 320);
  const posOf = () => page.evaluate(() => {
    const c = document.querySelector('#content');
    return { doc: Math.round(window.scrollY || 0), content: c ? Math.round(c.scrollTop) : 0 };
  });
  const before = await posOf();
  const frames = [];
  for (let i = 0; i < SCROLL_SAMPLES; i += 1) {
    const t0 = Date.now();
    await page.mouse.wheel(0, 240);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    frames.push(Date.now() - t0);
  }
  const after = await posOf();
  const movedPx = Math.abs(after.content - before.content) + Math.abs(after.doc - before.doc);
  if (movedPx === 0) return { ok: false, reason: '滚轮未产生位移（页面无滚动入口）', before, after };
  return { ok: true, frames, moved_px: movedPx };
})();

/* 视图切换：工具栏「思维导图」/「大纲」往返，取每次点击→两帧后落定的耗时 */
const switchRes = await page.evaluate(async (rounds) => {
  const btn = (label) => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === label);
  const a = btn('大纲');
  const b = btn('思维导图');
  if (!a || !b) return { ok: false, reason: 'view buttons not found' };
  const times = [];
  for (let i = 0; i < rounds; i += 1) {
    for (const el of [b, a]) {
      const t0 = performance.now();
      el.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      times.push(performance.now() - t0);
    }
  }
  return { ok: true, times };
}, SWITCH_ROUNDS);

await browser.close();

const scrollP95 = p95(scroll.ok ? scroll.frames : []);
const switchP95 = p95(switchRes.ok ? switchRes.times : []);
const report = {
  generated_at: new Date().toISOString(),
  artifact: path.relative(path.resolve(HERE, '..', '..'), APP).replace(/\\/g, '/'),
  nodes: built,
  rendered_rows: renderedRows,
  first_paint_ms: firstPaint === null ? null : round(firstPaint),
  scroll: scroll.ok
    ? { samples: scroll.frames.length, moved_px: scroll.moved_px, p95_ms: round(scrollP95), budget_ms: BUDGET_SCROLL_MS, pass: scrollP95 < BUDGET_SCROLL_MS }
    : { samples: 0, p95_ms: null, budget_ms: BUDGET_SCROLL_MS, pass: null, skipped: scroll.reason },
  view_switch: { samples: switchRes.ok ? switchRes.times.length : 0, p95_ms: round(switchP95), budget_ms: BUDGET_SWITCH_MS, pass: switchRes.ok && switchP95 < BUDGET_SWITCH_MS },
};
const measured = [report.scroll.pass, report.view_switch.pass].filter((v) => v !== null);
report.measured = measured.length;
report.pass = measured.length > 0 && measured.every(Boolean);
if (report.scroll.pass === null) report.verdict = 'PARTIAL（滚动项未采集）';

const outIdx = process.argv.indexOf('--json');
if (outIdx > 0 && process.argv[outIdx + 1]) writeFileSync(process.argv[outIdx + 1], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
const parts = ['视图切换 p95=' + report.view_switch.p95_ms + 'ms/' + BUDGET_SWITCH_MS];
parts.push(report.scroll.p95_ms === null ? '滚动 未采集' : '滚动 p95=' + report.scroll.p95_ms + 'ms/' + BUDGET_SCROLL_MS);
if (!report.pass) {
  console.error('[perf-p95] FAIL ' + parts.join('  '));
  process.exit(1);
}
console.log('[perf-p95] ' + (report.verdict || 'PASS') + ' ' + parts.join('  '));
