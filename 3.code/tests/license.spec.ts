import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * Track B · 离线授权码商业闭环回归
 *
 * 用例：
 *   1) 设置面板输入签发端生成的有效授权码 → 激活成功 → 刷新后 ui.isPro === true；
 *   2) 免费版（无授权码）循环调用 window.JU.actions.addNode 501 次 →
 *      第 501 次被 500 节点上限拦截（返回 null）并出现产品 toast 提示；
 *   3) 输入伪造授权码（payload 合法、签名伪造）→ 激活失败，ui.isPro 保持 false，
 *      localStorage 不写入任何授权码。
 *
 * 运行在真实 Chromium + 真实 HTTP 源（http://localhost:5173）上；本机浏览器入站连接被系统
 * 策略阻断，故沿用其它 spec 的 `vite build` 产物 + `context.route` 承载方式，
 * localStorage / WebCrypto / 页面刷新语义与真实服务一致。
 */

const BASE = 'http://localhost:5173';
const LICENSE_STORAGE_KEY = 'juju.license.v1';
/** M0-15 同步 Mock 服务源（server/license-server.mjs，端口 8081） */
const SYNC_ORIGIN = 'http://127.0.0.1:8081';

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

function licenseFile(): string {
  return path.join(projectRoot(), 'scripts', 'licenses', 'test-pro-2030-12-31.license');
}

function readLicense(): string {
  const file = licenseFile();
  if (!fs.existsSync(file)) {
    throw new Error('缺少测试授权码，请先运行：node scripts/gen-license.mjs --user test --plan pro --expire 2030-12-31');
  }
  return fs.readFileSync(file, 'utf8').trim();
}

/**
 * 【ISSUE-012】云端同步端点已改为构建期环境变量注入（产物不再内置 `127.0.0.1:8081`）。
 * 本 spec 要验证真实同步闭环，故在 `build()` 前把 Mock 授权服务地址注入为
 * `VITE_SYNC_PUSH_URL` / `VITE_SYNC_PULL_URL`，构建产物中的端点即指向下方的 `SYNC_ORIGIN`，
 * 再由 `page.route(SYNC_ORIGIN + '/**')` 拦截取证。构建完成后立即还原 process.env，
 * 不影响同进程其它构建（默认构建的产物仍然不含任何本地地址）。
 */
async function prepareDist(): Promise<string> {
  const root = projectRoot();
  const prevPush = process.env.VITE_SYNC_PUSH_URL;
  const prevPull = process.env.VITE_SYNC_PULL_URL;
  process.env.VITE_SYNC_PUSH_URL = SYNC_ORIGIN + '/api/sync/push';
  process.env.VITE_SYNC_PULL_URL = SYNC_ORIGIN + '/api/sync/pull';
  try {
    await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  } finally {
    if (prevPush === undefined) delete process.env.VITE_SYNC_PUSH_URL;
    else process.env.VITE_SYNC_PUSH_URL = prevPush;
    if (prevPull === undefined) delete process.env.VITE_SYNC_PULL_URL;
    else process.env.VITE_SYNC_PULL_URL = prevPull;
  }
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

/**
 * 打开设置面板（批次 CW 后的真实用户路径）。
 *
 * 背景：`bindSettings` 修好之后，产品会在 boot 阶段**自行创建** `#settingsPanel`
 * （`ensureSettingsPanel()`，默认关闭态 `hidden = true`），并在同一调用里落位
 * 「许可证激活」行（`#licenseKey` / `#licenseActivate`）。因此测试不再需要注入面板壳，
 * 只需像真实用户一样点顶栏齿轮 `#btnSettings`（产品 `bindSettingsPanel()` 处理器）打开它。
 *
 * 等待策略：先等 `#licenseKey` 出现（证明 `bindSettings` 已执行 = 齿轮处理器已绑定），
 * 再点击齿轮并断言 `.on` 生效，避免与异步 boot 竞态。
 */
async function openSettingsPanel(page: Page): Promise<void> {
  await expect(page.locator('#settingsPanel #licenseKey')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('#btnSettings')).toHaveCount(1);
  await page.click('#btnSettings');
  await expect(page.locator('#settingsPanel')).toHaveClass(/on/, { timeout: 10_000 });
  await expect(page.locator('#licenseKey')).toBeVisible({ timeout: 10_000 });
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

async function waitPro(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const u = (window as any).JU && (window as any).JU.ui;
      const ui = typeof u === 'function' ? u() : u;
      return !!(ui && ui.isPro === true);
    },
    null,
    { timeout: 30_000, polling: 50 },
  );
}

async function readUiState(page: Page): Promise<{ isPro: boolean; stored: string | null }> {
  return await page.evaluate(() => {
    const J = (window as any).JU;
    const u = J && J.ui;
    const ui = typeof u === 'function' ? u() : u;
    return {
      isPro: !!(ui && ui.isPro === true),
      stored: localStorage.getItem('juju.license.v1'),
    };
  });
}

let dist = '';

test.beforeAll(async () => {
  dist = await prepareDist();
});

test.describe('Track B · 离线授权码商业闭环', () => {
  test('有效授权码激活成功，刷新后 ui.isPro 仍为 true', async ({ context, page }) => {
    test.setTimeout(120_000);
    await installDistRoute(context, dist);

    await page.goto(BASE + '/', { waitUntil: 'load' });
    await waitJuReady(page);

    const before = await readUiState(page);
    expect(before.isPro, '未激活时必须是免费版').toBe(false);

    const license = readLicense();
    const input = page.locator('#licenseKey');
    /* 批次 CW：设置面板默认关闭，必须经顶栏齿轮打开后才可交互（真实用户路径） */
    await openSettingsPanel(page);
    await input.fill(license);

    const reload = page.waitForEvent('load', { timeout: 60_000 });
    await page.locator('#licenseActivate').click();
    await reload;

    await waitJuReady(page);
    await waitPro(page);

    const after = await readUiState(page);
    expect(after.isPro).toBe(true);
    expect(after.stored).toBe(license);
  });

  test('免费版 500 节点上限：第 501 次 addNode 被拦截并提示', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);

    await page.goto(BASE + '/', { waitUntil: 'load' });
    await waitJuReady(page);

    const result = await page.evaluate(() => {
      const J = (window as any).JU;
      const st = J.getState();
      const rootId = st.rootId;
      let firstBlockedAt = 0;
      let blocked = 0;
      let added = 0;
      let last: any = null;
      for (let i = 1; i <= 501; i++) {
        const id = J.actions.addNode(rootId, null, { text: 'limit-' + i });
        if (id == null) {
          blocked++;
          if (!firstBlockedAt) firstBlockedAt = i;
        } else {
          added++;
        }
        last = id;
      }
      const toastEl = document.getElementById('toast');
      const u = J.ui;
      const ui = typeof u === 'function' ? u() : u;
      return {
        last,
        firstBlockedAt,
        blocked,
        added,
        count: Object.keys(J.getState().nodes).length,
        toast: toastEl ? toastEl.textContent || '' : '',
        isPro: !!(ui && ui.isPro === true),
      };
    });

    expect(result.isPro, '未激活时必须是免费版').toBe(false);
    expect(result.firstBlockedAt, '必须触发节点上限拦截').toBeGreaterThan(0);
    expect(result.firstBlockedAt, '拦截不得晚于第 501 次调用').toBeLessThanOrEqual(501);
    expect(result.last, '第 501 次 addNode 必须返回 null').toBeNull();
    expect(result.count, '免费版最终节点数恒为 500').toBe(500);
    expect(result.toast).toContain('免费版最多支持 500 个节点');
  });

  test('伪造授权码激活失败，ui.isPro 保持 false 且不落盘', async ({ context, page }) => {
    test.setTimeout(120_000);
    await installDistRoute(context, dist);

    await page.goto(BASE + '/', { waitUntil: 'load' });
    await waitJuReady(page);

    const valid = readLicense();
    const payloadB64 = valid.split('.')[0];
    const forgedSignature = Buffer.alloc(64, 7).toString('base64');
    const forged = payloadB64 + '.' + forgedSignature;

    /* 批次 CW：同上，先经齿轮打开设置面板 */
    await openSettingsPanel(page);
    await page.locator('#licenseKey').fill(forged);
    await page.locator('#licenseActivate').click();

    await page.waitForFunction(
      () => {
        const t = document.getElementById('toast');
        return !!t && String(t.textContent || '').indexOf('授权码无效') >= 0;
      },
      null,
      { timeout: 30_000, polling: 50 },
    );

    const state = await readUiState(page);
    expect(state.isPro).toBe(false);
    expect(state.stored).toBeNull();
    expect(page.url()).toBe(BASE + '/');
  });

  /* ============================================================
     M0-15 · 云端同步（Pro 阈值拦截 + Mock 闭环）
     ============================================================ */

  test('免费版点「同步到云」被 Pro 阈值拦截：toast 提示且不发任何请求', async ({ context, page }) => {
    test.setTimeout(120_000);
    await installDistRoute(context, dist);

    let remoteHits = 0;
    await page.route(SYNC_ORIGIN + '/**', async (route: Route) => {
      remoteHits += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, state: null }),
      });
    });

    await page.goto(BASE + '/', { waitUntil: 'load' });
    await waitJuReady(page);

    const before = await readUiState(page);
    expect(before.isPro, '未激活时必须是免费版').toBe(false);

    await openSettingsPanel(page);
    await expect(page.locator('#btnSyncPush')).toBeVisible({ timeout: 10_000 });
    await page.locator('#btnSyncPush').click();

    await page.waitForFunction(
      () => {
        const t = document.getElementById('toast');
        return !!t && String(t.textContent || '').indexOf('Pro 版专属') >= 0;
      },
      null,
      { timeout: 30_000, polling: 50 },
    );

    const toastText = (await page.locator('#toast').textContent()) || '';
    expect(toastText).toContain('云端同步为 Pro 版专属功能');
    expect(remoteHits, '免费版被拦截时不得向云端发出任何请求').toBe(0);

    /* 行内状态文案节点已移除（2026-10-26 产品决策）：控件组只保留两只按钮，
       同步结束（含被 Pro 门槛拦截）后按钮恢复可用，结果反馈仅由 toast 承载 */
    await expect(page.locator('#rowCloudSync #syncStatus')).toHaveCount(0);
    await expect(page.locator('#btnSyncPush')).toBeEnabled({ timeout: 10_000 });
    const after = await readUiState(page);
    expect(after.isPro).toBe(false);
  });

  test('Pro 版点「同步到云」：fetch 成功、载荷含整库快照、控制台无报错', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);

    let pushCount = 0;
    let pushPayload: any = null;
    await page.route(SYNC_ORIGIN + '/**', async (route: Route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
        return;
      }
      if (req.url().indexOf('/api/sync/push') >= 0) {
        pushCount += 1;
        try { pushPayload = JSON.parse(req.postData() || '{}'); } catch (e) { pushPayload = null; }
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ ok: true, nodeCount: 1, savedAt: new Date().toISOString() }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, state: null }),
      });
    });

    await page.goto(BASE + '/', { waitUntil: 'load' });
    await waitJuReady(page);

    /* 走真实激活路径（与首条用例同一口径：填授权码 → 页面刷新 → 复核恢复 Pro） */
    const license = readLicense();
    await openSettingsPanel(page);
    await page.locator('#licenseKey').fill(license);
    const reload = page.waitForEvent('load', { timeout: 60_000 });
    await page.locator('#licenseActivate').click();
    await reload;
    await waitJuReady(page);
    await waitPro(page);

    /* 只统计「点击同步之后」的控制台错误，避免 boot 期无关日志干扰 */
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (e) => consoleErrors.push(String((e && (e as any).message) || e)));

    await openSettingsPanel(page);
    await expect(page.locator('#btnSyncPush')).toBeVisible({ timeout: 10_000 });
    await page.locator('#btnSyncPush').click();

    /* 行内 `#syncStatus` 已移除：完成信号改为按钮恢复可用，结果文案由 toast 承载（见下方断言） */
    await expect(page.locator('#rowCloudSync #syncStatus')).toHaveCount(0);
    await expect(page.locator('#btnSyncPush')).toBeEnabled({ timeout: 30_000 });

    expect(pushCount, 'Pro 版必须真实发出一次 push 请求').toBeGreaterThanOrEqual(1);
    expect(pushPayload && pushPayload.state, 'push 载荷必须是 { state } 信封').toBeTruthy();
    expect(pushPayload.state.nodes, 'push 载荷必须携带整库 nodes').toBeTruthy();
    expect(Object.keys(pushPayload.state.nodes).length, '整库至少包含根节点').toBeGreaterThan(0);
    expect(consoleErrors, '同步过程中不得出现控制台错误').toEqual([]);

    await expect(page.locator('#toast')).toContainText('已同步到云端', { timeout: 10_000 });
  });
});
