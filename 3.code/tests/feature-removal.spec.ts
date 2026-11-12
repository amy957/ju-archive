import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * 功能移除回归（2026-10-26）
 *
 * 产品决策：以下四项 UI 能力整体移除（含状态变量 / 事件绑定 / API 调用函数）：
 *   - 「关闭虚拟滚动（大文档回退全量渲染）」用户开关；
 *   - 「允许匿名错误上报」开关；
 *   - 「发布为静态网页」/「导出为静态网页（可发布）」入口与导出 API。
 *
 * 本 spec 同时校验：
 *   1) 运行时（构建产物 + 真实页面）不再渲染对应节点；
 *   2) 设置面板其余功能（许可证 / 崩溃日志 / 云端同步）仍正常落位；
 *   3) `window.JU` 不再暴露静态网页导出 API；
 *   4) dist 单文件产物中不包含上述文案与节点 id（防止旧字符串从其它路径回流）。
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

const REMOVED_TEXTS = [
  '关闭虚拟滚动（大文档回退全量渲染）',
  '允许匿名错误上报',
  '发布为静态网页',
  '导出为静态网页（可发布）',
];
const REMOVED_IDS = ['setVirtualScrollOff', 'setErrorReporting', 'btnExportStaticHtml'];

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

async function waitJuReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const J = (window as any).JU;
      return !!(J && typeof J.getState === 'function' && typeof J.actions === 'object');
    },
    null,
    { timeout: 30_000, polling: 50 },
  );
}

let dist = '';

test.beforeAll(async () => {
  dist = await prepareDist();
});

test.describe('功能移除 · UI 与 API 不再存在', () => {
  test('设置面板不再渲染被移除的四项能力，其余设置行保持可用', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await waitJuReady(page);

    await page.click('#btnSettings');
    await expect(page.locator('#settingsPanel')).toHaveClass(/on/, { timeout: 10_000 });

    /* 被移除节点必须为 0 */
    for (const id of REMOVED_IDS) {
      await expect(page.locator(`#settingsPanel #${id}`), `#${id} 必须已移除`).toHaveCount(0);
    }

    /* 被移除文案不得出现在设置面板可见文本中 */
    const panelText = await page.locator('#settingsPanel').innerText();
    for (const text of REMOVED_TEXTS) {
      expect(panelText, `设置面板不得包含被移除文案：${text}`).not.toContain(text);
    }

    /* 未被移除的设置行仍在位（证明绑定链健康） */
    await expect(page.locator('#settingsPanel #licenseKey')).toHaveCount(1);
    await expect(page.locator('#settingsPanel #btnViewCrashLogs')).toHaveCount(1);
    await expect(page.locator('#settingsPanel #btnSyncPush')).toHaveCount(1);
    await expect(page.locator('#settingsPanel #btnSyncPull')).toHaveCount(1);

    /* 匿名上报状态变量 / 静态导出 API 不再暴露 */
    const api = await page.evaluate(() => {
      const J = (window as any).JU;
      const u = typeof J.ui === 'function' ? J.ui() : J.ui;
      return {
        hasExportApi: typeof J.exportToStaticHtml === 'function',
        hasBuilder: typeof J.buildStaticHtml === 'function',
        hasStyleConst: typeof J.STATIC_HTML_STYLE !== 'undefined',
        hasErrorReportingState: !!(u && Object.prototype.hasOwnProperty.call(u, 'errorReporting')),
        hasVirtualScrollOffState: !!(u && Object.prototype.hasOwnProperty.call(u, 'virtualScrollOff')),
      };
    });
    expect(api.hasExportApi, 'JU.exportToStaticHtml 必须已移除').toBe(false);
    expect(api.hasBuilder, 'JU.buildStaticHtml 必须已移除').toBe(false);
    expect(api.hasStyleConst, 'JU.STATIC_HTML_STYLE 必须已移除').toBe(false);
    expect(api.hasErrorReportingState, 'ui.errorReporting 状态变量必须已移除').toBe(false);
    expect(api.hasVirtualScrollOffState, 'ui.virtualScrollOff 状态变量必须已移除').toBe(false);

    await page.click('#settingsClose');
    await expect(page.locator('#settingsPanel')).not.toHaveClass(/on/);
  });

  test('dist 单文件产物不含被移除文案与节点 id', async () => {
    const html = await fsp.readFile(path.join(dist, 'index.html'), 'utf8');
    for (const text of REMOVED_TEXTS) {
      expect(html, `dist/index.html 不得包含被移除文案：${text}`).not.toContain(text);
    }
    for (const id of REMOVED_IDS) {
      expect(html, `dist/index.html 不得包含被移除节点 id：${id}`).not.toContain(id);
    }
    /* 未移除功能仍需存在（防止误删整块设置面板） */
    expect(html, 'dist/index.html 必须保留云端同步入口').toContain('btnSyncPush');
    expect(html, 'dist/index.html 必须保留崩溃日志入口（设置面板动态渲染）').toContain('btnViewCrashLogs');
  });
});
