import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * 第二轮 · #btnSettings 契约解耦回归（D 类遗留项）
 *
 * 被修复的机制（「点设置没反应 / 面板闪一下就关」）：
 *   产品侧原先用 `gear.onclick = openPanel` **属性赋值**绑定齿轮，而装配层 / 回归夹具
 *   也用 `gear.onclick = fn` 接管 —— 属性赋值会整段替换上一个处理器；若产品侧同时
 *   改挂 addEventListener，则同一次点击会被两条链路各消费一次（先开后关）⇒ 面板永远打不开。
 *
 * 现行契约（本 spec 锁死）：
 *   1) `#btnSettings` 只挂 addEventListener（`bindClick`），属性 `onclick` 必须为空
 *      —— 测试侧不再改写 onclick；
 *   2) 点击语义 = **幂等开启**：单次点击面板打开（`.on` 生效 + 计算样式可见），
 *      连点两次**仍保持打开**（不翻转误关）；
 *   3) 公开 API `window.JU.openSettings()` / `closeSettings()` 与按钮行为一致，
 *      `window.JU.isSettingsOpen()` 同步反映状态。
 *
 * 可见性口径（实测基线，勿凭想象断言）：
 *   `index.html:166` 已内置 `<div class="panel" id="settingsPanel">`（**无 hidden 属性**），
 *   显隐完全由 CSS 决定：`src/style.css:895` `.panel{display:none}`、
 *   `:896` `.panel.on{display:flex}`。
 *   故「打开」= `.on` 存在 且 computed display 既非 none 且 rect 宽高 > 0
 *   （实际值为 `flex`，不是 `block`）；「关闭」= 无 `.on` 且 computed display 为 `none`。
 *
 * 承载方式与其它 spec 一致：`vite build` 产物 + `context.route` 映射到真实 HTTP 源
 * http://localhost:5173（本机回环入站被系统策略阻断，页面语义与线上一致）。
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

function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

async function prepareDist(): Promise<string> {
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  /* D-05b：dist 只允许一份 HTML（否则会被 Tauri 递归内嵌进 exe） */
  const htmls = fs.readdirSync(dist).filter((n) => /\.html?$/i.test(n));
  if (htmls.length !== 1 || htmls[0] !== 'index.html') {
    throw new Error('dist 下 HTML 不是恰好一份 index.html：' + htmls.join(', '));
  }
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

/** 等 JU 装配完成 + 产品 `bindSettings` 已落位（`#licenseKey` 出现即证明绑定链跑通）。 */
async function waitSettingsReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const J = (window as any).JU;
      return !!(J && typeof J.getState === 'function' && typeof J.openSettings === 'function'
        && typeof J.closeSettings === 'function');
    },
    null,
    { timeout: 60_000, polling: 50 },
  );
  await expect(page.locator('#btnSettings')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('#settingsPanel #licenseKey')).toHaveCount(1, { timeout: 30_000 });
}

interface PanelState {
  display: string;
  hidden: boolean;
  hasOn: boolean;
  visible: boolean;
  rectW: number;
  rectH: number;
  isOpenApi: boolean;
  gearOnclick: string;
}

async function readPanel(page: Page): Promise<PanelState> {
  return page.evaluate(() => {
    const p = document.getElementById('settingsPanel') as HTMLElement | null;
    const gear = document.getElementById('btnSettings') as HTMLElement | null;
    const J = (window as any).JU;
    const cs = p ? getComputedStyle(p) : null;
    const r = p ? p.getBoundingClientRect() : null;
    return {
      display: cs ? cs.display : 'missing',
      hidden: !!(p && p.hidden),
      hasOn: !!(p && p.classList.contains('on')),
      visible: !!(cs && cs.display !== 'none' && cs.visibility !== 'hidden'
        && r !== null && r.width > 0 && r.height > 0),
      rectW: r ? Math.round(r.width) : 0,
      rectH: r ? Math.round(r.height) : 0,
      isOpenApi: !!(J && typeof J.isSettingsOpen === 'function' && J.isSettingsOpen()),
      /* 契约：产品绑定不得再依赖属性赋值 ⇒ 该属性必须为空串（原生 onclick 为 null） */
      gearOnclick: gear ? String((gear as any).onclick || '') : 'missing',
    };
  });
}

/** 打开态断言（口径见文件头：`.on` + 计算样式可见，实际 display=flex） */
function expectOpen(s: PanelState, label: string): void {
  expect(s.hasOn, label + '：必须带 .on').toBe(true);
  expect(s.display, label + '：computed display 不得为 none').not.toBe('none');
  expect(s.visible, label + '：rect 宽高必须 > 0（真实可见）').toBe(true);
  expect(s.isOpenApi, label + '：isSettingsOpen() 必须为 true').toBe(true);
}

/** 关闭态断言 */
function expectClosed(s: PanelState, label: string): void {
  expect(s.hasOn, label + '：不得带 .on').toBe(false);
  expect(s.display, label + '：computed display 必须为 none').toBe('none');
  expect(s.visible, label + '：不得可见').toBe(false);
  expect(s.isOpenApi, label + '：isSettingsOpen() 必须为 false').toBe(false);
}

test.describe('第二轮 · #btnSettings 契约解耦（事件单一消费）', () => {
  let dist = '';

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    dist = await prepareDist();
  });

  test('单次点击打开面板；连点两次仍打开（幂等开启，不翻转误关）', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
    await waitSettingsReady(page);

    /* ① 初始态：面板关闭（无 .on / display:none / 不可见） */
    const before = await readPanel(page);
    expectClosed(before, '初始态');
    expect(before.gearOnclick, '#btnSettings 不得存在 onclick 属性赋值（契约解耦）').toBe('');

    /* ② 单次真实点击 → 面板必须打开 */
    await page.click('#btnSettings');
    await expect.poll(async () => (await readPanel(page)).visible, { timeout: 4000 }).toBe(true);
    const once = await readPanel(page);
    expectOpen(once, '单次点击后');
    expect(once.rectW, '单次点击后 rect 宽度必须 > 0').toBeGreaterThan(0);

    /* ③ 连点第二次 → 仍打开（历史双绑定会「先开再关」，在这里翻回关闭态） */
    await page.click('#btnSettings');
    await expect.poll(async () => (await readPanel(page)).visible, { timeout: 4000 }).toBe(true);
    const twice = await readPanel(page);
    expectOpen(twice, '连点两次后');
    expect(twice.rectW, '连点两次后 rect 宽度必须仍 > 0').toBeGreaterThan(0);

    expect(pageErrors, '设置面板开合全程不得出现未捕获页面异常').toEqual([]);
  });

  test('window.JU.openSettings() / closeSettings() 与按钮行为一致', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
    await waitSettingsReady(page);

    /* ① 公开 API 打开：返回值 + 面板状态 + 状态查询三者一致 */
    const openedByApi = await page.evaluate(() => (window as any).JU.openSettings());
    expect(openedByApi, 'JU.openSettings() 必须返回 true（面板存在）').toBe(true);
    await expect.poll(async () => (await readPanel(page)).visible, { timeout: 4000 }).toBe(true);
    expectOpen(await readPanel(page), 'JU.openSettings() 后');

    /* ② 幂等：再调一次不会关闭 */
    const openedAgain = await page.evaluate(() => (window as any).JU.openSettings());
    expect(openedAgain, '重复调用 JU.openSettings() 必须仍返回 true').toBe(true);
    await expect.poll(async () => (await readPanel(page)).visible, { timeout: 4000 }).toBe(true);
    expectOpen(await readPanel(page), '重复 JU.openSettings() 后');

    /* ③ 按钮点击与 API 行为一致：已打开时点击仍是打开态（不翻转） */
    await page.click('#btnSettings');
    await expect.poll(async () => (await readPanel(page)).visible, { timeout: 4000 }).toBe(true);
    expectOpen(await readPanel(page), 'API 打开后再点按钮');

    /* ④ 公开 API 关闭：面板收起且状态查询同步 */
    const closedByApi = await page.evaluate(() => (window as any).JU.closeSettings());
    expect(closedByApi, 'JU.closeSettings() 必须返回 true').toBe(true);
    await expect.poll(async () => (await readPanel(page)).display, { timeout: 4000 }).toBe('none');
    expectClosed(await readPanel(page), 'JU.closeSettings() 后');

    /* ⑤ 关闭钮与 API 等价（真实用户入口） */
    await page.click('#btnSettings');
    await expect(page.locator('#settingsPanel')).toHaveClass(/on/);
    await page.click('#settingsClose');
    await expect.poll(async () => (await readPanel(page)).display, { timeout: 4000 }).toBe('none');
    expectClosed(await readPanel(page), '#settingsClose 后');

    expect(pageErrors, '公开 API 开合全程不得出现未捕获页面异常').toEqual([]);
  });
});
