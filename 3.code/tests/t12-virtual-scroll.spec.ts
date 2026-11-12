import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * T12 · 虚拟滚动自动策略回归（2026-10-26）
 *
 * 覆盖产品决策：
 *   1) 初始状态默认开启虚拟滚动；
 *   2) 渲染前按「文档节点数 + navigator.deviceMemory」自动判定：
 *        节点数 < 1000 且 deviceMemory >= 8 ⇒ 关闭（全量渲染）；
 *        其余情况 ⇒ 开启（.outline.virtual）；
 *   3) 卡顿自动切换：连续帧耗时 > 50ms ⇒ 强制开启虚拟滚动；
 *   4) 操作完整性：Ctrl+F / 复制全文 / 打印触发时临时全量渲染，结束后恢复；
 *   5) 用户显式「关闭虚拟滚动」开关已移除（UI 断言见 feature-removal.spec）。
 *
 * 运行方式与其余 spec 一致：`vite build` 产物经 `context.route` 承载在
 * `http://localhost:5173` 真实 HTTP 源上。
 */

const BASE = 'http://localhost:5173';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

async function prepareDist(): Promise<string> {
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  return dist;
}

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

/** 在页面脚本执行前把 navigator.deviceMemory 固定为指定值（Chromium 默认 8）。 */
async function setDeviceMemory(context: BrowserContext, gb: number): Promise<void> {
  await context.addInitScript((value: number) => {
    try {
      Object.defineProperty(Navigator.prototype, 'deviceMemory', {
        configurable: true,
        get: () => value,
      });
    } catch (e) {
      try { Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => value }); } catch (_) { /* 环境不支持则按 unknown 处理 */ }
    }
  }, gb);
}

async function waitJuReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const J = (window as any).JU;
      return !!(J && typeof J.getState === 'function' && typeof J.actions === 'object' && typeof J.__juVsMetrics === 'function');
    },
    null,
    { timeout: 30_000, polling: 50 },
  );
}

let dist = '';

test.beforeAll(async () => {
  dist = await prepareDist();
});

/** 建一篇小文档（< 1000 节点）并切到真实大纲视图。 */
async function seedOutlineDoc(page: Page): Promise<string> {
  const docId = await page.evaluate(() => {
    const J = (window as any).JU;
    const st = J.getState();
    const doc = J.actions.addNode(st.rootId, null, { text: 'T12 虚拟滚动文档' });
    if (!doc) return '';
    for (let i = 0; i < 6; i++) J.actions.addNode(doc, null, { text: '正文行 ' + i });
    J.actions.setCurrentDoc(doc);
    const u = typeof J.ui === 'function' ? J.ui() : J.ui;
    if (u) u.view = 'outline';
    return doc;
  });
  expect(docId, '测试文档必须创建成功').toBeTruthy();
  await page.click('#tbNav .tb-nav-btn[data-view="outline"]');
  await expect(page.locator('#content .outline')).toHaveCount(1, { timeout: 30_000 });
  return docId as string;
}

async function readMetrics(page: Page): Promise<any> {
  return page.evaluate(() => (window as any).JU.__juVsMetrics());
}

test.describe('T12 · 虚拟滚动自动策略', () => {
  test('小文档 + deviceMemory>=8：自动关闭虚拟滚动，回退全量渲染', async ({ context, page }) => {
    test.setTimeout(180_000);
    await setDeviceMemory(context, 8);
    await installDistRoute(context, dist);
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await waitJuReady(page);
    await seedOutlineDoc(page);

    const metrics = await readMetrics(page);
    expect(metrics.defaultOn, '虚拟滚动初始状态必须默认为开启').toBe(true);
    expect(metrics.thresholds.nodes, '节点数阈值必须为 1000').toBe(1000);
    expect(metrics.thresholds.deviceMemoryGB, '内存阈值必须为 8GB').toBe(8);
    expect(metrics.lastDecision.nodeCount, '必须真实统计文档节点数').toBeGreaterThan(0);
    expect(metrics.lastDecision.virtual, '小文档 + 大内存必须自动关闭虚拟滚动').toBe(false);
    expect(metrics.lastDecision.reason).toBe('small-doc-and-sufficient-memory');
    await expect(page.locator('#content .outline.virtual'), '自动关闭后不得带 .virtual').toHaveCount(0);
    await expect(page.locator('#content .outline .node'), '全量渲染必须保留所有行').toHaveCount(6);
  });

  test('deviceMemory<8：自动开启虚拟滚动（.outline.virtual + 全量行在位）', async ({ context, page }) => {
    test.setTimeout(180_000);
    await setDeviceMemory(context, 8);
    await installDistRoute(context, dist);
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await waitJuReady(page);
    await seedOutlineDoc(page);

    /* 同一页面把设备内存降为 4GB，点击大纲视图触发真实重渲染 */
    await page.evaluate(() => {
      Object.defineProperty(Navigator.prototype, 'deviceMemory', { configurable: true, get: () => 4 });
    });
    await page.click('#tbNav .tb-nav-btn[data-view="outline"]');
    await expect(page.locator('#content .outline.virtual')).toHaveCount(1, { timeout: 30_000 });

    const metrics = await readMetrics(page);
    expect(metrics.lastDecision.virtual, '内存低于阈值时必须开启虚拟滚动').toBe(true);
    expect(metrics.lastDecision.deviceMemory).toBe(4);
    expect(metrics.lastDecision.reason).toBe('memory-unknown-or-below-threshold');
    await expect(page.locator('#content .outline .node'), '虚拟滚动仍保留全量行 DOM（content-visibility 窗口化）').toHaveCount(6);
  });

  test('连续两帧 > 50ms：强制开启虚拟滚动', async ({ context, page }) => {
    test.setTimeout(180_000);
    await setDeviceMemory(context, 16);
    await installDistRoute(context, dist);
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await waitJuReady(page);
    await seedOutlineDoc(page);
    await expect(page.locator('#content .outline.virtual'), '初始应为全量渲染').toHaveCount(0);

    const forced = await page.evaluate(() => {
      const J = (window as any).JU;
      const first = J.__juVsNoteScrollSample(80);
      const second = J.__juVsNoteScrollSample(80);
      return { first, second, metrics: J.__juVsMetrics() };
    });
    expect(forced.first, '单帧卡顿不得立即强制').toBe(false);
    expect(forced.second, '连续两帧 > 50ms 必须触发强制开启').toBe(true);
    expect(forced.metrics.jank.forced).toBe(true);
    expect(forced.metrics.jank.events).toBeGreaterThanOrEqual(1);
    expect(forced.metrics.lastDecision.policy).toBe('jank-forced');
    await expect(page.locator('#content .outline.virtual'), '卡顿后必须切到虚拟滚动').toHaveCount(1);
  });

  test('Ctrl+F / 复制全文 / 打印：虚拟滚动下临时全量渲染并恢复', async ({ context, page }) => {
    test.setTimeout(180_000);
    await setDeviceMemory(context, 4); /* 内存低于阈值 ⇒ 默认虚拟滚动开启 */
    await installDistRoute(context, dist);
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await waitJuReady(page);
    await seedOutlineDoc(page);
    await expect(page.locator('#content .outline.virtual')).toHaveCount(1);

    /* ① Ctrl+F：临时全量渲染 */
    await page.keyboard.press('Control+f');
    const findState = await page.evaluate(() => {
      const J = (window as any).JU;
      return {
        metrics: J.__juVsMetrics(),
        virtualCount: document.querySelectorAll('#content .outline.virtual').length,
      };
    });
    expect(findState.metrics.intercepts.find, 'Ctrl+F 必须被拦截计数').toBeGreaterThanOrEqual(1);
    expect(findState.virtualCount, '查找期间必须临时全量渲染（移除 .virtual）').toBe(0);

    await page.evaluate(() => (window as any).JU.__juVsResume());
    await expect(page.locator('#content .outline.virtual'), '查找结束后必须恢复虚拟滚动').toHaveCount(1);

    /* ② 打印：beforeprint 切全量，afterprint 恢复 */
    const printFull = await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeprint'));
      const J = (window as any).JU;
      return {
        metrics: J.__juVsMetrics(),
        virtualCount: document.querySelectorAll('#content .outline.virtual').length,
      };
    });
    expect(printFull.metrics.intercepts.print, 'beforeprint 必须被拦截计数').toBeGreaterThanOrEqual(1);
    expect(printFull.virtualCount, '打印期间必须临时全量渲染').toBe(0);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('#content .outline.virtual'), 'afterprint 后必须恢复虚拟滚动').toHaveCount(1);

    /* ③ 复制全文：Ctrl+A → copy，写入全文纯文本并临时全量渲染 */
    const copyState = await page.evaluate(() => {
      const J = (window as any).JU;
      /* 先派发 Ctrl+A（产品快捷键会触发一次重渲染），再对最新 DOM 建立全选，最后派发 copy */
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
      const root = document.querySelector('#content .outline') as HTMLElement | null;
      if (!root) return { data: '', metrics: J.__juVsMetrics(), virtualCount: -1 };
      const range = document.createRange();
      range.selectNodeContents(root);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      let data = '';
      const ev: any = new ClipboardEvent('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clipboardData', { value: { setData: (_type: string, value: string) => { data = value; } } });
      document.dispatchEvent(ev);
      return {
        data,
        metrics: J.__juVsMetrics(),
        virtualCount: document.querySelectorAll('#content .outline.virtual').length,
      };
    });
    expect(copyState.metrics.intercepts.copy, '复制全文必须被拦截计数').toBeGreaterThanOrEqual(1);
    expect(copyState.virtualCount, '复制期间必须临时全量渲染').toBe(0);
    expect(copyState.data, '复制全文必须写入当前文档的完整纯文本').toContain('T12 虚拟滚动文档');
    expect(copyState.data, '复制全文必须包含所有正文行').toContain('正文行 5');

    await expect(page.locator('#content .outline.virtual'), '复制结束后必须恢复虚拟滚动').toHaveCount(1, { timeout: 10_000 });
  });
});
