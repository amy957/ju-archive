import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * M07 · 富文本「样式叠加」真机回归（真实 Chromium 内核，对齐 Tauri/WebView2 行为）
 *
 * 缺陷背景（用户实机反馈）：
 *   选中文本 → 点加粗（生效）→ 点颜色（选红）→「加粗没了」；
 *   选中文本 → 点背景色 →「此前的字号/加粗失效」。
 * 根因：颜色 / 背景 / 字号走 `document.execCommand('foreColor' | 'hiliteColor' | 'fontSize')`，
 *   该 API 在 Edge WebView2（Tauri 桌面版）中已废弃，执行时会重建选区边界节点
 *   （拆 <b>、整段换成 <font>），并依赖「活着的」原生选区 —— 而点击浮层必然让选区塌陷。
 *
 * 本 spec 全程使用**真实鼠标事件**（Playwright click = mousedown + mouseup + click），
 * 逐步骤断言「新样式生效且旧样式仍在」，并断言样式合并在**同一个 span** 上：
 *   ① 选中文字 → 点「加粗」   ⇒ font-weight ≥ 600，且正文焦点 / 选区未丢
 *   ② 保持选中 → 点「颜色」→ 红色色块 ⇒ 变红 **且依然加粗**
 *   ③ 保持选中 → 点「字号」→ 大号   ⇒ 变大 **且依然变红、依然加粗**
 *   ④ 保持选中 → 点「背景色」→ 色块 ⇒ 有背景 **且前三步格式全在**
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

const HOST_SEL = '#content .text[data-id="probe-rt"]';
const FIXTURE_TEXT = 'ALPHA BETA GAMMA';
const TARGET_TEXT = 'ALPHA BETA';

/** 项目根（testDir = <root>/tests） */
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

/** 把 baseURL 请求映射到 dist 产物（本机回环入站被系统策略阻断，故走路由拦截）。 */
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

interface ProbeState {
  weight: string;
  color: string;
  bg: string;
  sizePx: number;
  selected: string;
  focused: boolean;
  connected: boolean;
  html: string;
  spans: number;
  spanStyle: string;
}

/** 造夹具：`#content` 内一个真实 contenteditable 正文节点，并选中前两段文字。 */
async function mountFixture(page: Page): Promise<void> {
  await page.evaluate(
    ({ sel, text, target }) => {
      /* 右侧栏若处于收起态（margin-right 负值），按钮点不到：先展开（仅测试夹具，不改产品代码） */
      const sb = document.getElementById('sidebarRight');
      if (sb) sb.classList.remove('collapsed');
      const content = document.getElementById('content') || document.body;
      let host = document.querySelector(sel) as HTMLElement | null;
      if (!host) {
        host = document.createElement('div');
        host.className = 'text';
        host.setAttribute('data-id', 'probe-rt');
        host.setAttribute('contenteditable', 'true');
        content.appendChild(host);
      }
      host.textContent = text;
      host.focus();
      const node = host.firstChild as Text;
      const r = document.createRange();
      r.setStart(node, 0);
      r.setEnd(node, target.length);
      const s = window.getSelection();
      if (!s) throw new Error('no selection');
      s.removeAllRanges();
      s.addRange(r);
    },
    { sel: HOST_SEL, text: FIXTURE_TEXT, target: TARGET_TEXT },
  );
}

/**
 * 读回「选区当前生效样式」+ 结构与焦点状态（全部走真实 DOM / getComputedStyle）。
 *
 * 注意：样式写入后选区边界落在**元素**边界上（range.startContainer = 父 DIV，offset=span 下标），
 * 直接对该 DIV 取 getComputedStyle 读到的是父级继承值，会误判成「样式没生效」。
 * 这里从边界位置一路下钻到最深节点（第一个被选中的文本节点），再读其父元素的计算样式。
 */
async function readState(page: Page): Promise<ProbeState> {
  return page.evaluate((sel) => {
    const host = document.querySelector(sel) as HTMLElement | null;
    if (!host) throw new Error('probe host missing: ' + sel);
    const s = window.getSelection();
    const range = s && s.rangeCount ? s.getRangeAt(0) : null;
    let node: any = range ? range.startContainer : host.firstChild;
    let offset = range ? range.startOffset : 0;
    while (node && node.nodeType === 1 && node.childNodes.length) {
      const child: any = node.childNodes[Math.min(offset, node.childNodes.length - 1)];
      if (!child) break;
      node = child;
      offset = 0;
    }
    const el: any = node ? (node.nodeType === 3 ? node.parentElement : node) : host;
    const cs = getComputedStyle(el);
    const span = host.querySelector('span') as HTMLElement | null;
    return {
      weight: String(cs.fontWeight || ''),
      color: String(cs.color || ''),
      bg: String(cs.backgroundColor || ''),
      sizePx: parseFloat(String(cs.fontSize || '0')),
      selected: s ? String(s) : '',
      focused: document.activeElement === host || host.contains(document.activeElement),
      connected: host.isConnected,
      html: host.innerHTML,
      spans: host.querySelectorAll('span').length,
      spanStyle: (span && span.getAttribute('style')) || '',
    };
  }, HOST_SEL);
}

/** 打开被测页面（构建产物 → 路由映射 → 等 JU 装配完成）。 */
async function openProbe(browser: Browser): Promise<{ context: BrowserContext; page: Page; pageErrors: string[] }> {
  const dist = await prepareDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') pageErrors.push(String(m.text())); });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(
    () => !!(window as any).JU && typeof (window as any).JU.applyCustomStyleToSelection === 'function',
  );
  return { context, page, pageErrors };
}

test('富文本：加粗 → 颜色 → 字号 → 背景 可连续叠加（真实鼠标事件）', async ({ browser }) => {
  const { context, page, pageErrors } = await openProbe(browser);

  /* ── 0) 夹具与基线 ── */
  await mountFixture(page);
  const base = await readState(page);
  expect(base.selected).toBe(TARGET_TEXT);
  expect(base.connected).toBe(true);
  expect(parseFloat(base.weight)).toBeLessThan(600);
  const basePx = base.sizePx;
  expect(basePx).toBeGreaterThan(0);

  /* ── 1) 加粗：真实点击（mousedown + mouseup + click）── */
  await page.locator('[data-cmd="bold"]').click();
  const bold = await readState(page);
  expect(bold.focused).toBe(true); /* 按钮 mousedown 已 preventDefault：焦点没被抢走 */
  expect(bold.selected).toBe(TARGET_TEXT); /* 选区仍在 */
  expect(parseFloat(bold.weight)).toBeGreaterThanOrEqual(600);

  /* ── 2) 颜色：点按钮（mousedown 同步弹色板）→ 点红色色块 ── */
  await page.locator('[data-cmd="color"]').click();
  await expect(page.locator('.color-picker .cp-swatch').first()).toBeVisible();
  const redSwatch = page.locator('.color-picker .cp-swatch').nth(2);
  const redRgb = await redSwatch.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);
  await redSwatch.click();
  const colored = await readState(page);
  expect(colored.color).toBe(redRgb); /* 变红 */
  expect(parseFloat(colored.weight)).toBeGreaterThanOrEqual(600); /* 且依然加粗 */
  expect(colored.selected).toBe(TARGET_TEXT);

  /* ── 3) 字号：点按钮 → 选「大 5」 ── */
  await page.locator('[data-cmd="size"]').click();
  await expect(page.locator('.color-picker .sp-btn').first()).toBeVisible();
  await page.locator('.color-picker .sp-btn').nth(4).click();
  const sized = await readState(page);
  expect(sized.sizePx).toBeGreaterThan(basePx * 1.2); /* 变大 */
  expect(sized.color).toBe(redRgb); /* 依然变红 */
  expect(parseFloat(sized.weight)).toBeGreaterThanOrEqual(600); /* 依然加粗 */
  expect(sized.selected).toBe(TARGET_TEXT);

  /* ── 4) 背景色：点按钮 → 点色块（验证「设背景后加粗/字号不失效」）── */
  await page.locator('[data-cmd="bg"]').click();
  await expect(page.locator('.color-picker .cp-swatch').first()).toBeVisible();
  const bgSwatch = page.locator('.color-picker .cp-swatch').nth(10);
  const bgRgb = await bgSwatch.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);
  await bgSwatch.click();
  const final = await readState(page);
  expect(final.bg).toBe(bgRgb); /* 有背景 */
  expect(final.color).toBe(redRgb); /* 颜色仍在 */
  expect(parseFloat(final.weight)).toBeGreaterThanOrEqual(600); /* 加粗仍在 */
  expect(final.sizePx).toBeCloseTo(sized.sizePx, 0); /* 字号仍在 */

  /* ── 5) 结构断言：四层样式合并在【同一个 span】上，没有层层嵌套 ── */
  expect(final.spans).toBe(1);
  const style = final.spanStyle.toLowerCase();
  expect(style).toContain('font-weight: bold');
  expect(style).toContain('color:');
  expect(style).toContain('font-size:');
  expect(style).toContain('background-color:');

  /* ── 6) 全程无 execCommand 报错（已彻底废弃该 API）── */
  expect(pageErrors.filter((t) => /execCommand/i.test(t))).toEqual([]);

  await context.close();
});

test('富文本：字号 → 颜色 → 加粗 反向叠加，且取消加粗不吞掉颜色/字号', async ({ browser }) => {
  const { context, page } = await openProbe(browser);
  await mountFixture(page);
  const base = await readState(page);
  const basePx = base.sizePx;

  /* ① 先字号 */
  await page.locator('[data-cmd="size"]').click();
  await expect(page.locator('.color-picker .sp-btn').first()).toBeVisible();
  await page.locator('.color-picker .sp-btn').nth(5).click();
  const sized = await readState(page);
  expect(sized.sizePx).toBeGreaterThan(basePx * 1.3);

  /* ② 再颜色 */
  await page.locator('[data-cmd="color"]').click();
  const swatch = page.locator('.color-picker .cp-swatch').nth(3);
  const rgb = await swatch.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);
  await swatch.click();
  const colored = await readState(page);
  expect(colored.color).toBe(rgb);
  expect(colored.sizePx).toBeCloseTo(sized.sizePx, 0);

  /* ③ 最后加粗（前两步不能失效） */
  await page.locator('[data-cmd="bold"]').click();
  const bolded = await readState(page);
  expect(parseFloat(bolded.weight)).toBeGreaterThanOrEqual(600);
  expect(bolded.color).toBe(rgb);
  expect(bolded.sizePx).toBeCloseTo(sized.sizePx, 0);
  expect(bolded.spans).toBe(1);

  /* ④ 再点一次加粗 = 取消加粗，颜色 / 字号必须原样保留 */
  await page.locator('[data-cmd="bold"]').click();
  const unbolded = await readState(page);
  expect(parseFloat(unbolded.weight)).toBeLessThan(600);
  expect(unbolded.color).toBe(rgb);
  expect(unbolded.sizePx).toBeCloseTo(sized.sizePx, 0);
  expect(unbolded.selected).toBe(TARGET_TEXT);

  await context.close();
});
