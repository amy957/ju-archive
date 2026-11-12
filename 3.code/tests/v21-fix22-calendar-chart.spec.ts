import { test, expect, type Route } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * v2.1 · fix22 / fix22-patch1 · 日历「字数统计 / 任务统计」柱状图布局坍塌与 X 轴文字重叠
 *
 * before：柱高以百分比内联 style 写入、与上数值行 / 下标签行共用 56px 定高，列宽 flex:1 + min-width:0
 * 在窄模块内被压到 1px 以下 ⇒ 图表坍塌、日期文字互相重叠；且完全依赖内联 style（严格 CSP 下即失效）。
 * fix22：几何改由 SVG 呈现属性承载（src/views/calendar.ts buildCalBarChart）。
 * patch1：原断言只验「容器高 > 0 + 相邻文字不重叠」⇒ 图表整幅挤在左缘（SVG 根被
 * style.css 的 `.cal-chart{width:auto}` 覆盖退回默认 300px 视口）、柱体高度为 0 也判过，
 * 属误判通过。本 spec 追加两条硬断言：末位 X 轴文字必须落在容器右半区（铺满），
 * 每根柱体 boundingBox 的宽 / 高必须 > 0（柱体真实显示）。
 * 承载方式与 fix1/fix5/fix6/fix7/fix8 spec 一致：vite build 产物 + context.route 映射到 http://localhost:5173。
 */
const BASE = 'http://localhost:5173';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

test('fix22 · 字数统计 / 任务统计柱状图不坍塌、X 轴文字不重叠、无 CSP 拦截', async ({ browser }) => {
  test.setTimeout(240_000);
  /* 以项目目录为 cwd 跑 Vite CLI：vite.config.ts 的 root:'.' 按进程 cwd 解析，
     走 build() API 时会被门禁进程的 cwd 带偏（实测 Could not resolve entry module "index.html"）。 */
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--logLevel', 'silent'], { cwd: ROOT, stdio: 'pipe' });
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await context.route(BASE + '/**', async (route: Route) => {
    const u = new URL(route.request().url());
    let p = decodeURIComponent(u.pathname);
    if (!p || p === '/') p = '/index.html';
    const file = path.join(dist, p);
    try {
      await route.fulfill({
        status: 200,
        contentType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        body: await fsp.readFile(file),
      });
    } catch {
      await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'not found: ' + p });
    }
  });
  const page = await context.newPage();
  const cspErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /content security policy|refused to apply|csp/i.test(m.text())) cspErrors.push(m.text());
  });
  try {
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => !!(window as any).JU && typeof (window as any).JU.getState === 'function', null, { timeout: 60_000 });
    await page.locator('.sb-nav-item[data-nav="calendar"]').first().click();
    await expect(page.locator('.cal-cell.today'), '日历必须渲染出今天格子').toHaveCount(1, { timeout: 20_000 });
    await page.locator('.cal-cell.today').first().click();
    await expect(page.locator('.cal-module[data-key="chars"] svg.chars-chart'), '必须渲染「字数统计」图表').toHaveCount(1, { timeout: 25_000 });
    await expect(page.locator('.cal-module[data-key="stats"] svg.stats-chart'), '必须渲染「任务统计」图表').toHaveCount(1, { timeout: 25_000 });
    /* 造一组当日字数增量：零数据下每根柱体都只能取 2px 兜底高度，无法证明「柱高随值伸缩」
       （旧实现把柱高写在内联 style 的百分比里、父级无定高 ⇒ 恒为 0）。 */
    await page.evaluate(() => {
      const J: any = (window as any).JU;
      const d = new Date();
      const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      J.commit((s: any) => {
        s.charStats = s.charStats || {};
        s.charStats[ds] = { add: 400, del: 0, mod: 0, net: 400 };
      });
    });
    await page.locator('.sb-nav-item[data-nav="calendar"]').first().click();
    await page.locator('.cal-cell.today').first().click();
    await expect(page.locator('.cal-module[data-key="chars"] svg.chars-chart'), '造数后必须重新渲染「字数统计」图表').toHaveCount(1, { timeout: 25_000 });

    for (const sel of ['svg.chars-chart', 'svg.stats-chart']) {
      const box = await page.locator(sel).first().boundingBox();
      expect(box, '图表容器必须参与布局：' + sel).not.toBeNull();
      expect(box!.width, sel + ' 容器宽必须 > 0').toBeGreaterThan(0);
      expect(box!.height, sel + ' 容器高必须 > 0').toBeGreaterThan(0);
      /* patch2：是否「铺满」只能相对父容器（模块体可用宽）判定。
         旧口径拿 SVG 自身 boundingBox 当参照 ⇒ 31 列整幅挤在左半区也恒成立（误判通过根因）。 */
      const cont = await page.locator(sel).first().evaluate((el) => {
        const p = el.parentElement as HTMLElement;
        const r = p.getBoundingClientRect();
        return { x: r.x, w: r.width };
      });
      expect(cont.w, sel + ' 父容器宽必须 > 0').toBeGreaterThan(0);
      const ticks = await page.locator(sel + ' .cal-chart-x').evaluateAll((els) =>
        els.map((e) => {
          const r = (e as SVGGraphicsElement).getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height, t: e.textContent || '' };
        }),
      );
      expect(ticks.length, sel + ' 必须有 X 轴文字').toBeGreaterThan(0);
      for (let i = 1; i < ticks.length; i++) {
        const a = ticks[i - 1], b = ticks[i];
        if (a.h > 0 && b.h > 0 && Math.abs(a.y - b.y) < Math.max(a.h, b.h)) {
          expect(b.x, 'X 轴相邻文字重叠：' + a.t + ' / ' + b.t).toBeGreaterThanOrEqual(a.x + a.w - 0.5);
        }
      }
      /* patch2 ①：X 轴必须铺满父容器宽度（相对 SVG 自身宽判定恒真，已废弃） */
      const first = ticks[0], last = ticks[ticks.length - 1];
      expect(first.x - cont.x, sel + ' 首位 X 轴文字必须贴近容器左缘').toBeLessThan(cont.w * 0.25);
      expect(
        last.x - cont.x,
        sel + ' 末位 X 轴文字必须超过父容器宽的 60%（实测 ' + Math.round(last.x - cont.x) + 'px / 容器 ' + Math.round(cont.w) + 'px）',
      ).toBeGreaterThan(cont.w * 0.6);
      /* patch1 ②：柱体必须真实显示（旧断言未覆盖柱体宽高 ⇒ 高度为 0 也判过） */
      const bars = await page.locator(sel + ' .cal-chart-bar').evaluateAll((els) =>
        els.map((e) => {
          const r = (e as SVGGraphicsElement).getBoundingClientRect();
          return { x: r.x, w: r.width, h: r.height };
        }),
      );
      expect(bars.length, sel + ' 必须渲染柱体').toBeGreaterThan(0);
      bars.forEach((b, i) => {
        expect(b.h, sel + ' 第 ' + (i + 1) + ' 根柱体高度必须 > 0（柱子显示）').toBeGreaterThan(0);
        expect(b.w, sel + ' 第 ' + (i + 1) + ' 根柱体宽度必须 > 0').toBeGreaterThan(0);
      });
      if (sel === 'svg.chars-chart') {
        expect(Math.max(...bars.map(b => b.h)), sel + ' 当日有数据（净 +400）的柱体必须按值伸缩，不得恒为 2px 兜底').toBeGreaterThan(4);
      }
      /* patch2 ②：图表宽必须等于父容器实宽（旧实现 496px 图幅塞进 214px 容器 ⇒ 只有左侧 1/3 可见） */
      expect(
        Math.abs(box!.width - cont.w),
        sel + ' 图表宽必须等于父容器宽（实测 ' + Math.round(box!.width) + 'px / 容器 ' + Math.round(cont.w) + 'px）',
      ).toBeLessThanOrEqual(2);
      expect(
        last.x + last.w - (cont.x + cont.w),
        sel + ' 末位 X 轴文字不得越出父容器右缘（禁止横向溢出 / 被裁）',
      ).toBeLessThanOrEqual(1);
      expect(
        bars[bars.length - 1].x - cont.x,
        sel + ' 末位柱体必须超过父容器宽的 60%（实测 ' + Math.round(bars[bars.length - 1].x - cont.x) + 'px / 容器 ' + Math.round(cont.w) + 'px）',
      ).toBeGreaterThan(cont.w * 0.6);
    }
    /* fix1-1 · 「任务统计」数值标签与「字数统计」同口径：0 值不渲染文本节点（截图中的一排 0） */
    const statVals = await page.locator('svg.stats-chart .cal-chart-val').allTextContents();
    expect(statVals.filter((t) => t.trim() === '0').length, '任务统计 0 值不得渲染数值标签').toBe(0);
    /* fix1-1 · 数据绑定：完成一条今日待办后柱状图必须重绘（与字数统计同一条 forceRender 链路） */
    const doneSum = async () =>
      (await page.locator('svg.stats-chart .cal-chart-val').allTextContents()).reduce((s, t) => s + (parseInt(t.trim(), 10) || 0), 0);
    const doneBefore = await doneSum();
    await page.evaluate(() => {
      const J: any = (window as any).JU;
      const st = J.getState();
      const root = Object.values(st.nodes).find((n: any) => n && n._isCalRoot) as any;
      const d = new Date();
      const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const id = J.actions.addNode(root.id, null, { text: 'FIX1-1 任务统计探针', date: ds, showInCal: true });
      J.actions.toggleDone(id);
      if (typeof J.renderMain === 'function') J.renderMain();
    });
    await expect.poll(doneSum, { timeout: 20_000 }).toBe(doneBefore + 1);
    expect(cspErrors, '不得出现 CSP 拦截 console.error').toEqual([]);
  } finally {
    await context.close();
  }
});
