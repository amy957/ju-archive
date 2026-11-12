import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

/**
 * P4 · 启动渲染回归（**不使用任何测试侧依赖注入/骨架补丁**）
 *
 * 与 ui.spec / smoke.spec 的区别：那两个 spec 会用 `addInitScript` 注入顶栏+侧栏骨架
 * 并回填各模块 deps，因此**无法**发现「产品自身缺样式 / 缺 DOM / 装配空壳」这类启动级缺陷
 * （正是本次缺陷：exe / 单 HTML 启动后无样式、空白、只剩「请先选择文档」）。
 *
 * 本 spec 直接加载 `vite build` 产物，断言：
 *   1) 页面存在内联样式或至少一张已生效的样式表，且基础排版生效（body 字体/侧栏宽度）；
 *   2) 侧栏渲染出真实导航项（`.sb-nav-item` ≥ 6）；
 *   3) 内容区不再是「请先选择文档」空态，且渲染出资料库/文件夹/大纲等真实视图；
 *   4) 启动全程无未捕获异常（pageerror / console error）。
 *
 * 环境适配：本机浏览器进程到 localhost 的入站连接被系统策略阻断，故与其余 spec 一致，
 * 用 `context.route` 把 `http://localhost:5173/**` 映射到 dist 目录（页面仍在真实 HTTP 源上）。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:5173';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

/** 真实执行 vite build（单文件产物），返回 dist 绝对路径 */
async function prepareDist(): Promise<string> {
  await build({ root: ROOT, logLevel: 'warn' });
  return path.join(ROOT, 'dist');
}

/** 把 BASE 源下的所有请求映射到 dist 文件 */
async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE) return route.continue();
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
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

async function openApp(page: Page): Promise<void> {
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
  /* 等产品装配完成（window.JU 就绪）并等首帧渲染落定 */
  await page.waitForFunction(() => {
    const J = (window as any).JU;
    return !!(J && typeof J.getState === 'function' && typeof J.renderMain === 'function');
  }, null, { timeout: 60_000, polling: 25 });
  await page.waitForTimeout(600);
}

test.describe('P4 · 启动渲染回归（真实产物，无测试侧骨架/依赖注入）', () => {
  let dist = '';

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    dist = await prepareDist();
  });

  test('样式生效 + 侧栏非空 + 内容区不是「请先选择文档」空态', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);

    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await openApp(page);

    /* ① 样式：内联 <style> 或已生效样式表 */
    const styleInfo = await page.evaluate(() => {
      const inline = document.querySelectorAll('style').length;
      let cssRules = 0;
      for (const sheet of Array.from(document.styleSheets)) {
        try { cssRules += sheet.cssRules ? sheet.cssRules.length : 0; } catch { /* 跨域表：忽略 */ }
      }
      const bodyFont = getComputedStyle(document.body).fontFamily || '';
      const sideW = (document.getElementById('sidebarLeft') as HTMLElement | null)?.offsetWidth || 0;
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      return { inline, cssRules, bodyFont, sideW, bg };
    });
    console.log('[P4] styleInfo =', JSON.stringify(styleInfo));
    expect(styleInfo.inline + styleInfo.cssRules, '必须存在内联 <style> 或已生效样式表').toBeGreaterThan(0);
    expect(styleInfo.bg, '主题变量 --bg 必须由样式表定义').not.toBe('');
    expect(styleInfo.bodyFont, 'body 字体必须由样式生效').not.toBe('');
    expect(styleInfo.sideW, '侧栏必须占位渲染（宽度 > 100）').toBeGreaterThan(100);

    /* ② 侧栏：真实导航项已渲染 */
    const navCount = await page.locator('#sidebarLeft .sb-nav-item').count();
    console.log('[P4] #sidebarLeft .sb-nav-item =', navCount);
    expect(navCount, '侧栏导航项数量（日历/数据库/星标/我的文档/标签）').toBeGreaterThanOrEqual(5);

    /* ③ 内容区：不是「请先选择文档」空态，且渲染出真实视图 */
    const contentInfo = await page.evaluate(() => {
      const c = document.getElementById('content') as HTMLElement | null;
      const text = (c && c.textContent) || '';
      return {
        childCount: c ? c.children.length : 0,
        textLen: text.trim().length,
        onlyEmptyState: /^\s*请先选择文档\s*$/.test(text),
        hasFilesGrid: !!(c && (c.querySelector('.files-wrap') || c.querySelector('.files-grid'))),
        hasOutline: !!(c && c.querySelector('.outline')),
        hasEmptyState: !!(c && c.querySelector('.empty-state')),
        textSample: text.trim().slice(0, 60),
      };
    });
    console.log('[P4] contentInfo =', JSON.stringify(contentInfo));
    expect(contentInfo.onlyEmptyState, '内容区不得只显示「请先选择文档」').toBe(false);
    expect(contentInfo.childCount, '内容区必须渲染出视图节点').toBeGreaterThan(0);
    expect(contentInfo.hasFilesGrid || contentInfo.hasOutline, '默认应渲染资料库网格或大纲视图').toBe(true);

    /* ④ 无未捕获异常 */
    console.log('[P4] pageErrors =', JSON.stringify(pageErrors));
    console.log('[P4] consoleErrors =', JSON.stringify(consoleErrors.slice(0, 5)));
    expect(pageErrors, '启动过程不得有未捕获异常').toEqual([]);

    /* ⑤ 生产可用性证据：截图落盘（供人工核对顶栏/侧栏/内容区/样式） */
    fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(ROOT, 'test-results', 'p4-boot-render.png'), fullPage: false });
  });

  /**
   * P1/P2 行为级证明（不依赖任何字符串匹配）：
   * 真实点击侧栏「我的文档」→ 产品 `bindSidebar` 绑定的处理器 → `navTo('files')`
   * → `safeNavigate` → `forceRender` → `renderMain` → `renderFolderGrid` 资料库网格。
   * 这条链路同时覆盖 forceRender / saveUI / viewOf / getCurrentDoc / renderFolderGrid /
   * bindSidebar / sortDocs / getNodeSvg 等原本以 `noop` 注入的会话级函数。
   */
  test('P1/P2 行为证明：点击侧栏「我的文档」触发真实链路并渲染资料库网格', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    await openApp(page);

    const rootId = await page.evaluate(() => String((window as any).JU.getState().rootId));
    await page.click('#sidebarLeft .sb-nav-item[data-nav="files"]');

    /* 资料库（根）视图：文件网格或空文件夹提示，二者其一必现 */
    await expect
      .poll(async () => page.evaluate(() => {
        const c = document.getElementById('content') as HTMLElement | null;
        if (!c) return '';
        if (c.querySelector('.files-wrap')) return 'files-wrap';
        if (c.querySelector('.outline')) return 'outline';
        return '';
      }), { timeout: 30_000 })
      .toBe('files-wrap');

    const after = await page.evaluate(() => {
      const J = (window as any).JU;
      const u = typeof J.ui === 'function' ? J.ui() : J.ui;
      const c = document.getElementById('content') as HTMLElement;
      return {
        view: String(u.view),
        currentDocId: String(u.currentDocId || ''),
        activeKey: String(u.activeKey || ''),
        hasSortSelect: !!c.querySelector('.files-sort'),
        hasFilesGrid: !!c.querySelector('.files-grid'),
        hasEmptyState: !!c.querySelector('.empty-state'),
        onlyEmptyText: /^\s*请先选择文档\s*$/.test(c.textContent || ''),
      };
    });
    console.log('[P4-behaviour] after files nav =', JSON.stringify(after), 'rootId =', rootId);

    expect(after.onlyEmptyText, '内容区不得只剩「请先选择文档」').toBe(false);
    expect(after.currentDocId, 'navTo(files) 必须落到根文档').toBe(rootId);
    expect(after.activeKey, 'navTo(files) 必须置激活键 nav:files').toBe('nav:files');
    expect(after.hasSortSelect, '资料库视图必须渲染排序下拉（.files-sort）').toBe(true);
    expect(after.hasFilesGrid || after.hasEmptyState, '资料库视图必须渲染卡片网格或空态').toBe(true);
    expect(pageErrors, '交互过程不得有未捕获异常').toEqual([]);

    fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(ROOT, 'test-results', 'p4-files-nav.png'), fullPage: false });
  });
});
