import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 第十四轮（fix14）· 「设置图标统一为齿轮」回归
 *
 * 缺陷背景（P0 取证，90过程材料/tmp/fix14/settings_icon_before.log，SETTINGS_ICON_VERDICT: PASS）：
 *   · 顶部栏 `#btnSettings` 用的是「太阳 / 放射线」图标（circle r=3 + `M12 2.5v3M12 18.5v3…`），
 *     与设置语义不符，且与面板头部表示不一致；
 *   · 设置面板头部 `#settingsPanel .panel-head` 用 emoji 字符 `⚙`（非 SVG），
 *     渲染依赖系统 emoji 字体，跨平台字形/字重/基线不可控。
 *
 * 本批修复（P1，仅 4 处文件，未动 boot.ts / 富文本核心 / xselect.ts / JU.ui()）：
 *   · [`index.html`](6.P0-T3基线/m07-vite/index.html:36) 顶栏图标 → lucide settings 齿形；
 *   · [`index.html`](6.P0-T3基线/m07-vite/index.html:169) 面板头部 emoji → 同源齿轮 SVG（class="head-gear"）；
 *   · [`layout.ts`](6.P0-T3基线/m07-vite/src/ui/layout.ts:255) 兜底骨架同步为**逐字同款**（静态/兜底双源零漂移）；
 *   · [`style.css`](6.P0-T3基线/m07-vite/src/style.css:1010) `.panel-head>.head-gear` 定尺寸 16×16、右外边距 4px、
 *     `stroke:var(--icon)`（随主题，不写死颜色）。
 *
 * 验收口径（对应任务书 P2）：
 *   1) 顶部栏设置按钮内 SVG 含 `circle cx="12" cy="12" r="3"` 且 path 为标准齿轮特征（含 `1.65` 齿形控制点）；
 *   2) 真实点击后打开的面板头部含**同一份**齿轮 path（与顶栏 path d 逐字相等），且 emoji 已消失；
 *   3) 两处图标尺寸 16×16、描边色取自主题变量（浅色/夜间两主题下均非空且随主题变化），不写死颜色。
 *
 * 承载方式与其它 v21-fix* spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
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
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

/** dist 构建结果缓存（每个 worker 只 build 一次） */
let DIST: string | null = null;

function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

async function ensureDist(): Promise<string> {
  if (DIST) return DIST;
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  const htmls = fs.readdirSync(dist).filter((n) => /\.html?$/i.test(n));
  if (htmls.length !== 1 || htmls[0] !== 'index.html') {
    throw new Error('dist 下 HTML 不是恰好一份 index.html：' + htmls.join(', '));
  }
  DIST = dist;
  return DIST;
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

/** 打开应用（不点设置），返回 page 与控制台错误收集器 */
async function openApp(context: BrowserContext): Promise<{ page: Page; errors: string[] }> {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push(String(m.text())); });
  page.on('pageerror', (e: any) => errors.push('pageerror: ' + String(e && e.message)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(
    () => !!(window as any).JU && typeof (window as any).JU.getState === 'function',
    null,
    { timeout: 60_000 },
  );
  return { page, errors };
}

/** 页面内读取某个 SVG 的齿形特征（两处图标共用同一口径） */
type IconProbe = {
  found: boolean;
  pathD: string[];
  circles: { cx: string | null; cy: string | null; r: string | null }[];
  outer: string;
  cssW: string;
  cssH: string;
  stroke: string;
  fill: string;
  strokeWidth: string;
  strokeAttr: string | null;
  fillAttr: string | null;
  textContent: string;
};

const READ_ICON = (selector: string): IconProbe => {
  const host = document.querySelector(selector);
  const svg = host ? host.querySelector('svg') : null;
  if (!svg) {
    return {
      found: false, pathD: [], circles: [], outer: '', cssW: '', cssH: '', stroke: '', fill: '',
      strokeWidth: '', strokeAttr: null, fillAttr: null, textContent: host ? String(host.textContent || '') : '',
    };
  }
  const cs = getComputedStyle(svg);
  return {
    found: true,
    pathD: Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d') || ''),
    circles: Array.from(svg.querySelectorAll('circle')).map((c) => ({
      cx: c.getAttribute('cx'), cy: c.getAttribute('cy'), r: c.getAttribute('r'),
    })),
    outer: svg.outerHTML,
    cssW: cs.width,
    cssH: cs.height,
    stroke: cs.stroke,
    fill: cs.fill,
    strokeWidth: cs.strokeWidth,
    strokeAttr: svg.getAttribute('stroke'),
    fillAttr: svg.getAttribute('fill'),
    textContent: host ? String(host.textContent || '') : '',
  };
};

/** 标准齿轮特征（两处图标同一口径）：① 齿心圆 cx=12 cy=12 r=3；② path 含 1.65 齿形控制点 */
const GEAR_KEY = /1\.65/;

test.describe('fix14 · 设置图标统一为齿轮', () => {
  let context: BrowserContext;
  let dist = '';

  test.beforeAll(async () => {
    dist = await ensureDist();
  });

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
    await installDistRoute(context, dist);
  });

  test.afterEach(async () => {
    await context.close().catch(() => { /* ignore */ });
  });

  test('1) 顶部栏 #btnSettings 使用齿轮 SVG（circle 12/12/3 + 标准齿形 path），旧「放射线」图标已消失', async () => {
    const { page, errors } = await openApp(context);

    const top = (await page.evaluate(READ_ICON, '#btnSettings')) as IconProbe;
    expect(top.found, '#btnSettings 内必须存在 <svg> 图标').toBe(true);

    /* ① 齿心圆：circle cx="12" cy="12" r="3" */
    expect(top.circles.length, '齿轮应恰有 1 个齿心圆').toBe(1);
    expect(top.circles[0].cx, '齿心圆 cx').toBe('12');
    expect(top.circles[0].cy, '齿心圆 cy').toBe('12');
    expect(top.circles[0].r, '齿心圆 r').toBe('3');

    /* ② path 必须命中标准齿形特征（1.65 齿形控制点），且不得残留旧放射线路径 */
    const topD = top.pathD.join(' ');
    expect(top.pathD.length, '齿轮 SVG 应恰有 1 条 path').toBe(1);
    expect(GEAR_KEY.test(topD), 'path 必须含标准齿轮齿形控制点 1.65，实际 d=' + topD.slice(0, 80)).toBe(true);
    expect(topD, '不得残留旧「太阳/放射线」图标路径').not.toContain('M12 2.5v3');
    expect(topD, '不得残留旧「太阳/放射线」图标路径').not.toContain('M2.5 12h3');

    expect(errors, '打开应用不应有控制台错误：' + errors.join(' | ')).toHaveLength(0);
  });

  test('2) 真实点击后设置面板头部含同一份齿轮 SVG，emoji「⚙」已移除，标题文字保留', async () => {
    const { page, errors } = await openApp(context);

    const top = (await page.evaluate(READ_ICON, '#btnSettings')) as IconProbe;
    expect(top.found, '前置：顶部栏图标必须存在').toBe(true);

    await page.click('#btnSettings');
    await expect(page.locator('#settingsPanel'), '设置面板必须打开（.on）').toHaveClass(/on/, { timeout: 10_000 });
    await page.waitForTimeout(300);

    const head = (await page.evaluate(READ_ICON, '#settingsPanel .panel-head')) as IconProbe;
    expect(head.found, '设置面板头部必须存在 <svg> 图标').toBe(true);

    /* ① 同一份齿形：齿心圆 + 标准齿形 path，且与顶栏 path d 逐字相等（双处统一） */
    expect(head.circles.length, '面板头部齿轮应恰有 1 个齿心圆').toBe(1);
    expect(head.circles[0].cx).toBe('12');
    expect(head.circles[0].cy).toBe('12');
    expect(head.circles[0].r).toBe('3');
    const headD = head.pathD.join(' ');
    expect(GEAR_KEY.test(headD), '面板头部 path 必须含标准齿轮齿形控制点 1.65').toBe(true);
    expect(head.pathD, '两处图标必须使用同一份齿轮 path（逐字相等）').toEqual(top.pathD);

    /* ② emoji 已移除（SVG + 纯文字标题，不再依赖系统 emoji 字体） */
    const headText = await page.locator('#settingsPanel .panel-head').evaluate(
      (el) => String(el.textContent || ''),
    );
    expect(/[\u2699\uFE0F]/.test(headText), '面板头部不得再出现「⚙」emoji，实际="' + headText + '"').toBe(false);
    expect(headText.replace(/\s+/g, ''), '面板标题文字「设置」必须保留').toContain('设置');

    /* ③ 关闭钮仍在位且可用（头部结构未被破坏） */
    await expect(page.locator('#settingsClose')).toHaveCount(1);

    expect(errors, '打开设置面板不应有控制台错误：' + errors.join(' | ')).toHaveLength(0);
  });

  test('3) 两处图标尺寸 16×16、颜色随主题（var(--icon)，浅色/夜间不同），不写死颜色', async () => {
    const { page, errors } = await openApp(context);
    await page.click('#btnSettings');
    await expect(page.locator('#settingsPanel')).toHaveClass(/on/, { timeout: 10_000 });
    await page.waitForTimeout(300);

    const light = {
      top: (await page.evaluate(READ_ICON, '#btnSettings')) as IconProbe,
      head: (await page.evaluate(READ_ICON, '#settingsPanel .panel-head')) as IconProbe,
    };
    for (const [name, ic] of Object.entries(light)) {
      expect(ic.found, name + ' 图标必须存在').toBe(true);
      expect(ic.cssW, name + ' 图标宽度应为 16px，实际 ' + ic.cssW).toBe('16px');
      expect(ic.cssH, name + ' 图标高度应为 16px，实际 ' + ic.cssH).toBe('16px');
      expect(ic.fill, name + ' 图标应为描边风格（fill:none）').toBe('none');
      expect(ic.stroke, name + ' 图标描边色必须解析得出（随主题变量），不得为空').not.toBe('');
      /* 断言使用主题变量而非写死颜色：SVG 属性层不得出现硬编码 hex / rgb
         （顶栏图标无 stroke 属性 = 完全由 .tb-wbtn svg 规则的 var(--icon) 接管，属期望态 ⇒ null 归一为空串） */
      expect(String(ic.strokeAttr || ''), name + ' 的 stroke 属性不得写死颜色（应为 currentColor 或空）').not.toMatch(/^#|^rgb/i);
    }
    /* 两处图标描边色同源（都是 var(--icon)） */
    expect(light.head.stroke, '顶栏与面板头部图标描边色必须同源').toBe(light.top.stroke);

    /* 切到夜间主题：描边色必须随主题变化（证明不是写死颜色） */
    const nightStroke = await page.evaluate((sel) => {
      document.documentElement.setAttribute('data-theme', 'night');
      const el = document.querySelector(sel);
      const svg = el ? el.querySelector('svg') : null;
      return svg ? getComputedStyle(svg).stroke : '';
    }, '#settingsPanel .panel-head');
    expect(nightStroke, '夜间主题下描边色必须可解析').not.toBe('');
    expect(nightStroke, '夜间主题描边色必须随主题变化（浅色=' + light.head.stroke + '，夜间=' + nightStroke + '）').not.toBe(light.head.stroke);

    /* 复原主题，避免污染同 context 的后续断言 */
    await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); });

    expect(errors, '切换主题不应有控制台错误：' + errors.join(' | ')).toHaveLength(0);
  });
});
