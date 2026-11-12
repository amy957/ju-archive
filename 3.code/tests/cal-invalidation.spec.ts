import { test, expect, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * 批次 CA · 回归：`invalidateCalIndex` 空壳修复（M1-1 遗留缺陷）
 *
 * 缺陷现象（修复前）：
 *   `src/core/store.ts` 的 `invalidateCalIndex` 为 `(): void => {}` 占位空函数，
 *   `views/calendar` 的真实实现从未被装配到 store 端口 ⇒ `actions.addNode` /
 *   `actions.setNodeDate` 提交后 `_calIndexCache` / `_calDayCache` / `_renderDayCache` 与
 *   `_calDataRev` 均不变，日历「当日待办」命中旧日缓存（新增待办不出现、改期不移动）。
 *
 * 验证口径（**不依赖任何迁移期补偿**）：
 *   1. 用产品导出的 `JU.setCalIndexCache(new Map(...))` 预置一份「已构建」的索引缓存；
 *   2. 在**同一次 page.evaluate 内同步**调用 `JU.actions.addNode(...)`，断言
 *      `JU.getCalIndexCache() === null` 且 `JU.getCalDataRev()` 前进；
 *   3. 再次预置缓存后调用 `JU.actions.setNodeDate(...)`，断言代次再次前进。
 *   同步断言可排除「渲染订阅（scheduleNotify → forceRender）顺带失效」的干扰。
 *
 * 第二个用例是同一批次的连带回归：`getCalendarRootId()` ↔ `ensureCalendarRoot()`
 * 在「找不到日历根」时互相调用，若无守卫会形成无限互递归（RangeError: Maximum call
 * stack size exceeded），使 boot 在 `deps.ensureCalendarRoot()` 处中断。
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
  await context.route(BASE + '/**', async (route) => {
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

test.describe('CA · 日历索引失效链路', () => {
  let dist = '';

  test.beforeAll(async () => {
    dist = await prepareDist();
  });

  test('actions.addNode / setNodeDate 必须使日历索引失效并推进 _calDataRev', async ({ context, page }) => {
    await installDistRoute(context, dist);
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });

    await page.waitForFunction(
      () => {
        const J = (window as any).JU;
        return !!(J && J.actions && typeof J.setCalIndexCache === 'function' && typeof J.getCalDataRev === 'function');
      },
      null,
      { timeout: 30_000 },
    );

    const probe = await page.evaluate(() => {
      const J = (window as any).JU as any;
      const st = J.getState();
      const parent = st.rootId;

      /* ① 预置「已构建」索引缓存 → ② 新增带日期待办（同步断言） */
      J.setCalIndexCache(new Map<string, Set<string>>([['2026-10-24', new Set<string>()]]));
      const cacheBeforeAdd = J.getCalIndexCache() !== null;
      const revBeforeAdd = J.getCalDataRev();
      const newId = J.actions.addNode(parent, 0, { text: 'CA-probe-add', date: '2026-10-24', showInCal: true });
      const cacheAfterAddIsNull = J.getCalIndexCache() === null;
      const revAfterAdd = J.getCalDataRev();

      /* ③ 再次预置 → ④ 改期（同步断言） */
      J.setCalIndexCache(new Map<string, Set<string>>([['2026-10-24', new Set<string>()]]));
      const cacheBeforeDate = J.getCalIndexCache() !== null;
      const revBeforeDate = J.getCalDataRev();
      J.actions.setNodeDate(newId, '2026-10-25');
      const cacheAfterDateIsNull = J.getCalIndexCache() === null;
      const revAfterDate = J.getCalDataRev();
      const nodeDate = J.getState().nodes[newId] ? J.getState().nodes[newId].date : null;

      return {
        parent, newId, nodeDate,
        cacheBeforeAdd, revBeforeAdd, cacheAfterAddIsNull, revAfterAdd,
        cacheBeforeDate, revBeforeDate, cacheAfterDateIsNull, revAfterDate,
      };
    });

    expect(probe.newId, 'addNode 应返回新节点 id').toBeTruthy();
    expect(probe.cacheBeforeAdd, '前置条件：预置后索引缓存非空').toBe(true);
    expect(probe.cacheAfterAddIsNull, 'addNode 后索引缓存必须被置空（真实失效）').toBe(true);
    expect(probe.revAfterAdd, 'addNode 后 _calDataRev 必须前进').toBeGreaterThan(probe.revBeforeAdd);

    expect(probe.cacheBeforeDate, '前置条件：再次预置后索引缓存非空').toBe(true);
    expect(probe.cacheAfterDateIsNull, 'setNodeDate 后索引缓存必须被置空').toBe(true);
    expect(probe.nodeDate, 'setNodeDate 应写入 date').toBe('2026-10-25');
    expect(probe.revAfterDate, 'setNodeDate 后 _calDataRev 必须前进').toBeGreaterThan(probe.revBeforeDate);
  });

  test('日历根解析不得自递归（boot 期间无 RangeError）', async ({ context, page }) => {
    await installDistRoute(context, dist);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));

    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(1_500);

    const repeated = await page.evaluate(() => {
      const J = (window as any).JU as any;
      const out: any[] = [];
      /* 连续解析 5 次：存在自递归时必然抛 RangeError */
      for (let i = 0; i < 5; i++) {
        try { out.push(String(J.getCalendarRootId())); }
        catch (e) { out.push('ERR:' + String((e as Error).message || e)); }
      }
      return out;
    });

    const overflow = [...pageErrors, ...repeated].filter((s) => /Maximum call stack|too much recursion/i.test(s));
    expect(overflow, `日历根解析出现自递归：${overflow.join(' | ')}`).toHaveLength(0);
  });
});
