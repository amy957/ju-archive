import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 缺陷修复回归（D-03 侧栏折叠 / D-04 虚拟滚动只读策略 / D-07 右键委托 / D-09 提醒铃）
 *
 * 缺陷来源：`90过程材料/_报告与元数据/v2.1-缺陷对比报告-2026-10-26.md`
 *   D-03：点击 `#btnToggleLeft` 后侧栏宽度 210 → 210（无变化）。
 *        真实成因是 `.collapsed` 只写 `margin-left:-210px`，元素仍占 210px 布局宽 —— 量测与观感都不闭环。
 *        修复：折叠态同时把 width 归零（可量测、窄屏留白释放），绑定改 addEventListener。
 *   D-04：v2.0 的 `#setVirtualScrollOff` 用户开关已按产品决策下线，验收缺少稳定控制面。
 *        修复：`window.JU.getVirtualScrollPolicy()` 暴露只读 `{ enabled, overscan, thresholds }`。
 *   D-07：右键菜单原绑在单个 `.doc-header-title` 节点上，标题行重建窗口内会丢。
 *        修复：改绑 `#content` 容器做事件委托（幂等），并对 `.sb-row` 增加「文档节点才弹」判断。
 *   D-09：`#btnBell` 绑定的 `deps.toggleRemindPanel` 一直是空实现（main 从未覆盖）⇒ 点击恒无反应。
 *        修复：boot 侧补真实实现（`.panel.on` 显隐）。
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

let DIST = '';

function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

/** 重新构建（保证被测代码即当前源码），返回 dist 绝对路径。 */
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
      const st = await fsp.stat(file);
      if (st.isDirectory()) throw new Error('directory');
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

async function openPage(browser: Browser): Promise<{ context: BrowserContext; page: Page; errors: string[] }> {
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await installDistRoute(context, DIST);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message ? e.message : e)));
  await page.goto(BASE, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => !!(window as any).JU && typeof (window as any).JU.getState === 'function', null, {
    timeout: 30_000,
    polling: 50,
  });
  /* 展开左右侧栏（用户可点前提） */
  await page.evaluate(() => {
    document.getElementById('sidebarLeft')?.classList.remove('collapsed');
    document.getElementById('sidebarRight')?.classList.remove('collapsed');
    document.body.classList.remove('sb-left-collapsed', 'sb-right-collapsed');
  });
  return { context, page, errors };
}

/**
 * 展开侧栏「文件」子树的文档列表（点击 chevron，仅切换展开态、不导航）。
 * 说明：默认态侧栏只渲染导航项，文档行 `.sb-row[data-id]` 在展开后才出现；
 * 首屏本身已有一篇「欢迎使用 JU」文档 + 已打开的文档标题行（`.doc-header-title`）。
 */
async function expandFilesTree(page: Page): Promise<void> {
  const chev = page.locator('.sb-nav-item[data-nav="files"] .chev');
  if (await chev.count()) {
    await chev.first().click({ force: true });
    await page.waitForTimeout(500);
  }
}

test.describe('v2.1 缺陷修复回归（D-03 / D-04 / D-07 / D-09）', () => {
  test.beforeAll(async () => {
    DIST = await prepareDist();
  });

  test('D-03 点击 #btnToggleLeft：侧栏宽度由 210 变为折叠宽度（0），再点恢复', async ({ browser }) => {
    const { context, page, errors } = await openPage(browser);
    try {
      const btn = page.locator('#btnToggleLeft');
      await expect(btn).toBeVisible();

      const w0 = await page.evaluate(() => (document.getElementById('sidebarLeft') as HTMLElement).offsetWidth);
      expect(w0, '展开态侧栏应约占 210px（允许 --ui-scale 缩放）').toBeGreaterThan(180);
      expect(w0).toBeLessThan(280);

      await btn.click({ force: true });
      await page.waitForTimeout(400);
      const w1 = await page.evaluate(() => (document.getElementById('sidebarLeft') as HTMLElement).offsetWidth);
      expect(w1, '折叠态宽度必须真实归零（D-03 的判据）').toBeLessThanOrEqual(2);
      expect(await page.evaluate(() => document.body.classList.contains('sb-left-collapsed'))).toBe(true);

      await btn.click({ force: true });
      await page.waitForTimeout(400);
      const w2 = await page.evaluate(() => (document.getElementById('sidebarLeft') as HTMLElement).offsetWidth);
      expect(w2, '再次点击应恢复展开宽度').toBeGreaterThan(180);

      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('D-04 window.JU.getVirtualScrollPolicy() 返回只读策略 { enabled, overscan, thresholds }', async ({ browser }) => {
    const { context, page, errors } = await openPage(browser);
    try {
      const policy = await page.evaluate(() => {
        const J = (window as any).JU;
        if (typeof J.getVirtualScrollPolicy !== 'function') return null;
        const a = J.getVirtualScrollPolicy();
        const b = J.getVirtualScrollPolicy();
        return { a, stable: JSON.stringify(a) === JSON.stringify(b) };
      });
      expect(policy, 'JU.getVirtualScrollPolicy 必须存在（D-04 验收控制面）').not.toBeNull();
      expect(typeof policy!.a.enabled).toBe('boolean');
      expect(typeof policy!.a.overscan).toBe('number');
      expect(policy!.a.overscan).toBeGreaterThanOrEqual(0);
      expect(policy!.a.thresholds).toBeTruthy();
      expect(policy!.a.thresholds.nodes).toBe(1000);
      expect(policy!.a.thresholds.deviceMemoryGB).toBe(8);
      expect(policy!.a.thresholds.jankFrameMs).toBe(50);
      expect(policy!.a.thresholds.jankStreak).toBe(2);
      expect(policy!.stable, '只读快照连续两次调用结果必须一致').toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('D-09 点击 #btnBell 打开提醒面板（#remindPanel.on），再点关闭', async ({ browser }) => {
    const { context, page, errors } = await openPage(browser);
    try {
      const panel = page.locator('#remindPanel');
      await expect(panel).toHaveCount(1);
      await expect(panel).not.toHaveClass(/\bon\b/);

      await page.locator('#btnBell').click({ force: true });
      await page.waitForTimeout(350);
      await expect(panel).toHaveClass(/\bon\b/);
      await expect(panel).toBeVisible();

      await page.locator('#btnBell').click({ force: true });
      await page.waitForTimeout(350);
      await expect(panel).not.toHaveClass(/\bon\b/);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('D-07 右键：.doc-header-title / .sb-row 走容器委托弹菜单；.sb-nav-item 不弹（设计预期）', async ({ browser }) => {
    const { context, page, errors } = await openPage(browser);
    const menu = page.locator('#ctxMenu');
    try {
      /* ① 文档标题行（首屏已有欢迎文档）——委托绑在 #content 容器上，节点重建后依然生效 */
      await expect(page.locator('.doc-header-title')).toHaveCount(1, { timeout: 10_000 });
      await page.locator('.doc-header-title').first().click({ button: 'right', force: true });
      await page.waitForTimeout(300);
      await expect(menu).toHaveClass(/\bon\b/);
      expect(await page.locator('#ctxMenu .ctx-item').count()).toBeGreaterThanOrEqual(2);

      /* ② 侧栏文档行（展开「文件」子树后可见）——「文档节点才弹」，data-id 存在即弹 */
      await page.mouse.click(5, 5);
      await page.waitForTimeout(200);
      await expect(menu).not.toHaveClass(/\bon\b/);
      await expandFilesTree(page);
      const rows = page.locator('.sb-row[data-id]');
      const rowCount = await rows.count();
      expect(rowCount, '展开文件子树后应至少有一个文档行').toBeGreaterThan(0);
      await rows.first().click({ button: 'right', force: true });
      await page.waitForTimeout(300);
      await expect(menu, '.sb-row 是文档节点，应弹菜单').toHaveClass(/\bon\b/);

      /* ③ 导航项不是文档节点 —— 不弹菜单（设计预期，避免误判为「菜单失效」） */
      await page.mouse.click(5, 5);
      await page.waitForTimeout(200);
      await expect(menu).not.toHaveClass(/\bon\b/);
      await page.locator('.sb-nav-item').first().click({ button: 'right', force: true });
      await page.waitForTimeout(300);
      await expect(menu, '.sb-nav-item 不是文档节点，不应弹菜单').not.toHaveClass(/\bon\b/);

      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
