/**
 * D-01 · IndexedDB 持久化验收（方案 A：恢复 IDB 写入 + 保留 localStorage 兜底）
 *
 * 缺陷（v2.1-缺陷对比报告 D-01）：v2.1 运行期 `indexedDB.databases()` 返回 `[]`，
 * 脚本内 `indexedDB` 命中 0 次，仅 localStorage["juju.store.v31"] 落盘。
 *
 * 本用例是**真实浏览器**验收（不是桩）：启动 Chromium → 用 `context.route` 把
 * `http://localhost:4173/**` 映射到真实构建产物 `dist/index.html`（页面因此运行在真实
 * HTTP 源上，IndexedDB 语义与线上一致；本机 file:// 源的 IDB 被浏览器禁用，故不用 file://）
 * → 等应用完成首次落盘 → 断言：
 *   1) `indexedDB.databases()` 非空；
 *   2) 库名列表包含 `juju.store`；
 *   3) `JU.persistence.idbStatus().lastOk === true`（镜像写入确实成功）；
 *   4) `JU.persistence.idbReadState()` 能读回状态快照（json 可解析且含 nodes/rootId）；
 *   5) 全程零 pageerror。
 *
 * 运行：node --test src/test/persist-idb.test.mjs   （需先 npm run build）
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** m07-vite 工程根（src/test → src → 根） */
const PROJECT = path.resolve(HERE, '..', '..');
const DIST = path.join(PROJECT, 'dist');
const ORIGIN = 'http://localhost:4173';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/** 系统 Chrome 优先（与 playwright.config.ts 同口径），否则回落 Playwright 自带 Chromium。 */
function chromeExecutable() {
  const candidates = [
    process.env.JU_CHROMIUM_PATH,
    process.env['ProgramFiles'] ? path.join(process.env['ProgramFiles'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    process.env['LOCALAPPDATA'] ? path.join(process.env['LOCALAPPDATA'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
  ].filter(Boolean);
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (e) { /* 忽略探测异常 */ }
  }
  return null;
}

/** 把 http://localhost:4173 的请求映射到 dist 产物（等价 vite preview，不依赖真实端口）。 */
async function installDistRoute(context) {
  await context.route(ORIGIN + '/**', async (route) => {
    const url = new URL(route.request().url());
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';
    const file = path.join(DIST, pathname);
    try {
      const stat = await fsp.stat(file);
      if (stat.isDirectory()) throw new Error('directory');
      await route.fulfill({
        status: 200,
        contentType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        body: await fsp.readFile(file),
      });
    } catch (e) {
      await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'not found: ' + pathname });
    }
  });
}

test('D-01 · 打开页面后 indexedDB.databases() 非空且 juju.store 库存在', async () => {
  const html = path.join(DIST, 'index.html');
  assert.ok(fs.existsSync(html), '缺少构建产物 dist/index.html，请先执行 npm run build');

  const exe = chromeExecutable();
  const browser = await chromium.launch(exe ? { headless: true, executablePath: exe } : { headless: true });
  try {
    const context = await browser.newContext();
    await installDistRoute(context);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));

    await page.goto(ORIGIN + '/', { waitUntil: 'load', timeout: 60_000 });
    /* 等应用装配完成 */
    await page.waitForFunction(
      () => {
        const J = window.JU;
        return !!(J && typeof J.getState === 'function' && J.persistence);
      },
      null,
      { timeout: 30_000, polling: 50 },
    );

    /* 等一次 IDB 镜像写入完成（runPersist 明文分支 → idbMirrorState；异步，最多等 20s） */
    await page
      .waitForFunction(
        () => {
          const p = window.JU.persistence;
          return !!(p && typeof p.idbStatus === 'function' && p.idbStatus().lastOk === true);
        },
        null,
        { timeout: 20_000, polling: 100 },
      )
      .catch(() => { /* 超时不抛出：下面的断言会给出明确失败原因与状态快照 */ });

    const info = await page.evaluate(async () => {
      const p = window.JU.persistence;
      let dbs = [];
      try {
        if (typeof indexedDB.databases === 'function') dbs = (await indexedDB.databases()).map((d) => d && d.name);
      } catch (e) { dbs = ['<databases() threw: ' + String(e) + '>']; }
      let recovered = null;
      try { recovered = await p.idbReadState(); } catch (e) { recovered = null; }
      return {
        supported: p.idbSupported(),
        dbs,
        status: p.idbStatus(),
        recoveredHasNodes: !!(recovered && recovered.nodes && recovered.rootId),
        recoveredBytes: recovered ? JSON.stringify(recovered).length : 0,
        localStorageBytes: (localStorage.getItem('juju.store.v31') || '').length,
      };
    });

    assert.equal(info.supported, true, '宿主应支持 indexedDB');
    assert.ok(Array.isArray(info.dbs) && info.dbs.length > 0,
      `indexedDB.databases() 不应为空，实际：${JSON.stringify(info.dbs)}；状态：${JSON.stringify(info.status)}`);
    assert.ok(info.dbs.includes('juju.store'),
      `库名列表应包含 juju.store，实际：${JSON.stringify(info.dbs)}`);
    assert.equal(info.status.lastOk, true,
      `IDB 镜像最近一次写入应成功，状态：${JSON.stringify(info.status)}`);
    assert.ok(info.status.writes >= 1, `IDB 写入次数应 >= 1，实际 ${info.status.writes}`);
    assert.ok(info.recoveredHasNodes, 'IDB 中应能读回含 nodes/rootId 的状态快照');
    assert.ok(info.localStorageBytes > 0, 'localStorage 兜底必须仍然存在（方案 A 不替换主链路）');
    assert.deepEqual(pageErrors, [], `页面不应抛错：${pageErrors.join(' | ')}`);

    console.log('[D-01] IDB_USED=true dbs=' + JSON.stringify(info.dbs)
      + ' writes=' + info.status.writes
      + ' recoveredBytes=' + info.recoveredBytes
      + ' localStorageBytes=' + info.localStorageBytes);
  } finally {
    await browser.close();
  }
});
