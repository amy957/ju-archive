import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
/* ISSUE-005：开关以产品件导出值为唯一口径，禁止测试内自建布尔 */
import { UPDATER_ACTIVE } from '../src/app/updater';
/* ISSUE-004：崩溃读取链路以产品件真实实现为口径（无 __TAURI__ 必须失败） */
import { bindErrorDeps, readCrashDumps } from '../src/core/errors';

/**
 * M5-1a / M5-1b · 自动更新与崩溃包通道的 Mock 闭环验收（批次 BQ）
 *
 * 被测对象：`vite build` 产出的单 HTML 产物 `dist/index.html`（已内联 Tauri 桥接调用）。
 *
 * ① 自动更新（M5-1a）——真实代码链路：
 *    `start()` → `boot()` 尾部判定 `deps.isDesktop() || isTauriShell()` 为真 →
 *    `app/updater.ts::checkForUpdates({silent:true})` → 动态导入 `@tauri-apps/api/updater` →
 *    v1 IPC 三连：`listen('tauri://update-available')` + `listen('tauri://update-status')` +
 *    `emit('tauri://update')`。
 *    本 spec 用 `addInitScript` 注入真实形态的 `window.__TAURI_IPC__`（v1 注入式 IPC 总线），
 *    收到 `emit('tauri://update')` 时向本地 Mock HTTP 服务的 `/latest.json` 取回伪造响应，
 *    按 Tauri v2 latest.json（`version` / `notes` / `pub_date` / `platforms`）→
 *    v1 `UpdateManifest`（`version` / `date` / `body`）映射后回推 `update-available`，
 *    最终触发 `window.confirm` 询问框。
 *    请求经 Playwright `context.route` 拦截转发（本机浏览器进程与 Node 客户端到
 *    `127.0.0.1` 的入站 TCP 连接均被系统策略阻断，实测 `ETIMEDOUT`，
 *    故转发腿改用 Windows 命名管道连同一台 Mock HTTP 服务，见 §传输适配）。
 *
 * ② 崩溃包（M5-1b）——真实代码链路：
 *    `window 'error'` 事件 → `bindGlobalEvents` 监听器组装崩溃包 →
 *    `core/errors.ts::sendCrashReport` → `_desktopInvoker()` 优先取
 *    `window.__TAURI__.core.invoke` → 指令 `save_crash_dump`。
 *    本 spec 用 `page.exposeFunction('__crashProbe')` 作为 Node 侧 IPC 监视器，
 *    由注入的 `core.invoke` 转发，从而断言「前端确实发出了该 IPC 且载荷合规」。
 *
 * 传输适配（README 级说明）：
 *   Mock HTTP 服务同时监听两个句柄，共用同一 request handler：
 *     - TCP `127.0.0.1:8080`（与伪造响应里的 `http://localhost:8080/JU.exe` 同源，真实绑定）；
 *     - 命名管道（Windows `\\.\pipe\...` / POSIX `tmpdir/*.sock`），供路由转发腿真实取数。
 *   命名管道是本机可达的真实 HTTP 通道，保证 `context.route` 的响应体出自
 *   「真实 Node HTTP 服务」而非测试内联常量。
 */

const APP_ORIGIN = 'http://localhost:4174';
const TCP_PORT = 8080;

/** 任务书指定的伪造更新响应（Tauri v2 latest.json 形态） */
const UPDATE_JSON = {
  version: 'v2.2.0',
  notes: 'test',
  pub_date: '2026-10-25',
  platforms: {
    'windows-x86_64': {
      signature: 'dummy',
      url: 'http://localhost:8080/JU.exe',
    },
  },
};

/** 转发腿使用的真实 IPC 通道（TCP 回环在本机被系统策略阻断，见文件头 §传输适配） */
const SERVICE_PIPE = process.platform === 'win32'
  ? '\\\\.\\pipe\\ju-mock-update-' + process.pid
  : path.join(os.tmpdir(), 'ju-mock-update-' + process.pid + '.sock');

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

/** 项目根（testDir = <root>/tests） */
function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

function distDir(): string {
  const dist = path.join(projectRoot(), 'dist');
  const html = path.join(dist, 'index.html');
  if (!fs.existsSync(html)) throw new Error('缺少构建产物 dist/index.html，请先执行 vite build：' + dist);
  return dist;
}

/** 把 APP_ORIGIN 的请求映射到 dist 产物（页面仍运行在真实 http 源上） */
async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route(APP_ORIGIN + '/**', async (route) => {
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

/** 等 `window.JU` 装配完成（store 端口可用） */
async function waitJuReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const J = (window as any).JU;
      return !!(J && typeof J.getState === 'function' && typeof J.actions === 'object');
    },
    null,
    { timeout: 60_000, polling: 50 },
  );
}

interface MockService {
  /** TCP 监听端口（优先 8080，被占用时回落系统分配） */
  tcpPort: number;
  /** TCP 句柄是否真实处于 listening 状态 */
  tcpListening: boolean;
  /** 命名管道句柄是否真实处于 listening 状态 */
  pipeListening: boolean;
  /** 真实到达 Mock 服务的请求路径（由服务端记录，非测试侧伪造） */
  requests: string[];
  close: () => Promise<void>;
}

/** Mock HTTP 服务统一 request handler：/latest.json 返回伪造更新响应 */
function createUpdateHandler(requests: string[]): http.RequestListener {
  return (req, res) => {
    const u = new URL(req.url || '/', 'http://localhost');
    requests.push(u.pathname);
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'cache-control': 'no-store',
    };
    if (u.pathname === '/latest.json') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', ...cors });
      res.end(JSON.stringify(UPDATE_JSON));
      return;
    }
    if (u.pathname === '/JU.exe') {
      /* 仅为证明下载 URL 可解析；更新流程在确认框阶段被拒绝，不会真的下载 */
      res.writeHead(200, { 'content-type': 'application/octet-stream', ...cors });
      res.end('JU-stub-binary');
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', ...cors });
    res.end('not found: ' + u.pathname);
  };
}

/**
 * 启动真实 Node HTTP 服务（TCP + 命名管道双句柄，共用一个 handler）。
 * TCP 端口被占用时回落到系统分配端口，仅影响「同源绑定」这一诊断项。
 */
async function startMockService(): Promise<MockService> {
  const requests: string[] = [];
  const handler = createUpdateHandler(requests);

  const tcpServer = http.createServer(handler);
  const pipeServer = http.createServer(handler);

  await new Promise<void>((resolve, reject) => {
    pipeServer.once('error', reject);
    pipeServer.listen(SERVICE_PIPE, () => resolve());
  });

  const tcpPort = await new Promise<number>((resolve, reject) => {
    let settled = false;
    tcpServer.on('error', (e: any) => {
      if (e && e.code === 'EADDRINUSE' && !settled) {
        tcpServer.listen(0, '127.0.0.1');
        return;
      }
      if (!settled) { settled = true; reject(e); }
    });
    tcpServer.listen(TCP_PORT, '127.0.0.1', () => {
      if (settled) return;
      settled = true;
      const addr = tcpServer.address() as any;
      resolve(addr && addr.port ? addr.port : TCP_PORT);
    });
  });

  return {
    tcpPort,
    tcpListening: !!tcpServer.listening,
    pipeListening: !!pipeServer.listening,
    requests,
    close: () =>
      Promise.all([
        new Promise<void>((r) => tcpServer.close(() => r())),
        new Promise<void>((r) => pipeServer.close(() => r())),
      ]).then(() => undefined),
  };
}

/** 经命名管道向真实 Mock 服务发起一次 HTTP GET（本机可达的转发腿） */
function httpGetViaPipe(pathname: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: SERVICE_PIPE,
        path: pathname,
        method: 'GET',
        headers: { host: 'localhost:' + TCP_PORT, accept: 'application/json' },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode || 0, body }));
      },
    );
    req.on('error', reject);
    req.setTimeout(10_000, () => req.destroy(new Error('mock service timeout: ' + pathname)));
    req.end();
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

test.describe('M5-1a / M5-1b 桌面增强通道', () => {
  test('自动更新确认框（v2.2.0）与崩溃包 save_crash_dump IPC 均真实触发', async ({ context, page }) => {
    test.setTimeout(180_000);

    const dist = distDir();

    /* ① 产物静态旁证：两条通道的 IPC 指令 / 事件名必须已编入单文件产物 */
    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    expect(html, 'M5-1b 崩溃通道必须把 save_crash_dump 指令编入产物').toContain('save_crash_dump');
    const updateEventInBundle = html.includes('tauri://update-available');
    expect(updateEventInBundle, '产物中 update-available 事件名必须与 UPDATER_ACTIVE 一致').toBe(UPDATER_ACTIVE);

    /* ② 真实 Node HTTP 服务（/latest.json） */
    const mock = await startMockService();
    const mockBase = 'http://127.0.0.1:' + mock.tcpPort;
    const intercepted: string[] = [];
    const ipcCalls: Array<{ cmd: string; args: any }> = [];

    try {
      /* 服务自检：TCP 句柄真实监听 + 命名管道真实可取数（同一 handler） */
      expect(mock.tcpListening, 'Mock HTTP 服务 TCP 句柄必须处于 listening').toBe(true);
      expect(mock.pipeListening, 'Mock HTTP 服务命名管道句柄必须处于 listening').toBe(true);
      expect(mock.tcpPort, 'Mock HTTP 服务端口必须已绑定').toBeGreaterThan(0);
      const selfCheck = await httpGetViaPipe('/latest.json');
      expect(selfCheck.status, '服务自检必须返回 200').toBe(200);
      expect(JSON.parse(selfCheck.body).version, '服务自检必须返回伪造版本号').toBe('v2.2.0');

      /* ③ IPC 回传通道：page.exposeFunction 在 Node 侧收到前端真实调用 */
      await page.exposeFunction('__crashProbe', (cmd: string, argsJson: string) => {
        let args: any = null;
        try { args = JSON.parse(argsJson); } catch { args = { raw: argsJson }; }
        ipcCalls.push({ cmd, args });
        return { ok: true };
      });

      /* ④ 注入真实形态的 Tauri v1 桥接：__TAURI__.{core,tauri}.invoke + __TAURI_IPC__ 事件总线 */
      await page.addInitScript(
        ({ mockBase: base }: { mockBase: string }) => {
          const w = window as any;
          const calls: Array<{ surface: string; cmd: string; args: any }> = [];
          w.__ipcCalls = calls;

          const listeners: Record<string, Array<{ id: number; handler: number }>> = {};
          let seq = 0;
          const fire = (id: any, value: any) => {
            const fn = w['_' + id];
            if (typeof fn === 'function') fn(value);
          };

          /* v1 事件总线：message.cmd 为 listen / unlisten / emit */
          w.__TAURI_IPC__ = (msg: any) => {
            const { cmd, callback, error } = msg || {};
            calls.push({
              surface: 'ipc',
              cmd: String(cmd) + ':' + String((msg && msg.message && msg.message.cmd) || ''),
              args: null,
            });
            try {
              if (cmd === 'tauri' && msg.__tauriModule === 'Event') {
                const m = msg.message || {};
                if (m.cmd === 'listen') {
                  const id = ++seq;
                  (listeners[m.event] = listeners[m.event] || []).push({ id, handler: m.handler });
                  fire(callback, id);
                  return;
                }
                if (m.cmd === 'unlisten') {
                  fire(callback, null);
                  return;
                }
                if (m.cmd === 'emit') {
                  fire(callback, null);
                  if (m.event === 'tauri://update') {
                    /* 更新检查请求：交给 Playwright 路由 → 真实 Mock HTTP 服务 */
                    fetch(base + '/latest.json', { cache: 'no-store' })
                      .then((r) => r.json())
                      .then((latest: any) => {
                        /* v2 latest.json → v1 UpdateManifest 字段映射 */
                        const manifest = {
                          version: latest.version,
                          date: latest.pub_date,
                          body: latest.notes,
                          raw: latest,
                        };
                        (listeners['tauri://update-available'] || []).forEach((rec) => {
                          const handler = w['_' + rec.handler];
                          if (typeof handler === 'function') {
                            handler({
                              event: 'tauri://update-available',
                              id: rec.id,
                              payload: manifest,
                              windowLabel: 'main',
                            });
                          }
                        });
                      })
                      .catch(() => { /* 端点不可达时保持静默，与产品口径一致 */ });
                  }
                  return;
                }
              }
              fire(callback, null);
            } catch (e) {
              fire(error, String(e));
            }
          };

          w.__TAURI__ = {
            core: {
              invoke: (cmd: string, args?: any) => {
                calls.push({ surface: 'core.invoke', cmd: String(cmd), args: args || null });
                if (typeof w.__crashProbe === 'function') {
                  return w.__crashProbe(String(cmd), JSON.stringify(args || {}));
                }
                return Promise.resolve(null);
              },
            },
            tauri: {
              invoke: (cmd: string, args?: any) => {
                calls.push({ surface: 'tauri.invoke', cmd: String(cmd), args: args || null });
                return Promise.resolve(null);
              },
            },
          };
        },
        { mockBase },
      );

      /* ⑤ 请求拦截：更新端点的请求被路由到上述本地 Mock 接口 */
      await context.route(mockBase + '/**', async (route) => {
        const u = new URL(route.request().url());
        intercepted.push(u.pathname);
        try {
          const upstream = await httpGetViaPipe(u.pathname);
          await route.fulfill({
            status: upstream.status,
            contentType: 'application/json; charset=utf-8',
            headers: { 'access-control-allow-origin': '*' },
            body: upstream.body,
          });
        } catch (e: any) {
          await route.fulfill({
            status: 502,
            contentType: 'text/plain; charset=utf-8',
            headers: { 'access-control-allow-origin': '*' },
            body: 'mock upstream failed: ' + String((e && e.message) || e),
          });
        }
      });
      await installDistRoute(context, dist);

      /* ⑥ 确认框捕获（页面未处理会挂住，故必须先挂监听再导航） */
      const pageLogs: string[] = [];
      page.on('console', (m) => pageLogs.push(m.type() + ': ' + m.text()));
      page.on('pageerror', (e) => pageLogs.push('pageerror: ' + String((e && (e as any).message) || e)));

      const dialogMessages: string[] = [];
      let resolveDialog: ((m: string) => void) | null = null;
      const firstDialog = new Promise<string>((res) => { resolveDialog = res; });
      page.on('dialog', async (d) => {
        const msg = d.message();
        dialogMessages.push(msg);
        try { await d.dismiss(); } catch { /* 对话框可能已被自动处理 */ }
        if (resolveDialog) { const r = resolveDialog; resolveDialog = null; r(msg); }
      });

      await page.goto(APP_ORIGIN + '/', { waitUntil: 'load' });
      await waitJuReady(page);

      /* ⑦ 自动更新断言：启用态才等待弹窗与 IPC；关闭态必须零弹窗零 update IPC */
      const confUpdater = JSON.parse(fs.readFileSync(path.join(projectRoot(), 'src-tauri', 'tauri.conf.json'), 'utf8')).tauri.updater;
      const busCalls = await page.evaluate(
        () => ((window as any).__ipcCalls || []).filter((c: any) => c.surface === 'ipc').map((c: any) => c.cmd),
      );
      if (UPDATER_ACTIVE) {
        expect(confUpdater.active, 'updater 启用时 tauri.conf 的 updater.active 必须同为 true').toBe(true);
        const confirmedMsg = await withTimeout(firstDialog, 60_000, '未捕获到自动更新确认框（checkForUpdates 未触发或未走 Mock 端点）');
        expect(confirmedMsg, '确认框必须包含新版本号 v2.2.0').toContain('v2.2.0');
        expect(confirmedMsg, '确认框必须包含映射后的发布日期 pub_date').toContain('2026-10-25');
        expect(confirmedMsg, '确认框必须包含映射后的更新说明 notes').toContain('test');
        expect(dialogMessages.length, '本轮只应弹一次更新确认框').toBe(1);
        expect(intercepted, 'Playwright 必须拦截更新请求并转发到 Mock 接口').toContain('/latest.json');
        expect(mock.requests, '真实 Mock HTTP 服务必须收到 /latest.json 请求').toContain('/latest.json');
        const installedCalls = ipcCalls.filter((c) => c.cmd === 'tauri://update-install');
        expect(installedCalls, '用户拒绝后不得调用 installUpdate').toEqual([]);
        expect(
          busCalls.filter((c: string) => c === 'tauri:listen').length,
          '更新检查必须先经事件总线注册 update-available 与 update-status 两个监听',
        ).toBeGreaterThanOrEqual(2);
        expect(busCalls, '更新检查必须经事件总线 emit tauri://update').toContain('tauri:emit');
      } else {
        expect(confUpdater.active, 'updater 关闭时 tauri.conf 的 updater.active 必须同为 false').toBe(false);
        await page.waitForTimeout(1_500);
        expect(dialogMessages, 'updater 关闭时不得弹出更新确认框').toEqual([]);
        expect(busCalls.filter((c: string) => c === 'tauri:listen' || c === 'tauri:emit'), 'updater 关闭时不得发出任何更新 IPC').toEqual([]);
        expect(intercepted, 'updater 关闭时不得请求更新端点').toEqual([]);
      }

      /* ⑧ 崩溃上报断言：ErrorEvent → sendCrashReport → core.invoke('save_crash_dump') */
      await page.evaluate(() => {
        window.dispatchEvent(
          new ErrorEvent('error', {
            error: new Error('M5-1b test crash'),
            message: 'test',
          }),
        );
      });

      await page.waitForFunction(
        () => {
          const calls = (window as any).__ipcCalls || [];
          return calls.some((c: any) => c.surface === 'core.invoke' && c.cmd === 'save_crash_dump');
        },
        null,
        { timeout: 30_000, polling: 50 },
      );

      const crashCall = ipcCalls.find((c) => c.cmd === 'save_crash_dump');
      expect(crashCall, '前端必须经 window.__TAURI__.core.invoke 调用 save_crash_dump').toBeTruthy();
      const payload = crashCall && crashCall.args ? crashCall.args.payload : null;
      expect(typeof payload, 'save_crash_dump 的 payload 必须是 JSON 字符串').toBe('string');
      const dumped = JSON.parse(String(payload));
      /* 字段口径（与 boot.ts 的 window 'error' 监听器一致）：
         msg    = errMsg(ErrorEvent) ⇒ ErrorEvent.message
         reason = ErrorEvent.error.message
         stack  = ErrorEvent.error.stack */
      expect(dumped.kind, '崩溃包 kind 必须为 window-error').toBe('window-error');
      expect(String(dumped.msg), '崩溃包 msg 必须取自 ErrorEvent.message').toBe('test');
      expect(String(dumped.reason), '崩溃包 reason 必须携带 Error.message').toContain('M5-1b test crash');
      expect(String(dumped.stack), '崩溃包 stack 必须来自真实 Error 堆栈').toContain('M5-1b test crash');
      expect(dumped.ts, '崩溃包必须带时间戳').toBeGreaterThan(0);
      expect(dumped.version, '崩溃包必须带版本号').toBeTruthy();
      expect(dumped.userAgent, '崩溃包必须带 userAgent').toBeTruthy();
      expect(JSON.stringify(dumped), '崩溃包不得包含节点正文 / 文档标识字段')
        .not.toMatch(/"(nodes|currentDocId|docId|text|content)":/);
      expect(pageLogs.filter((l) => l.startsWith('pageerror:')), '全程不得出现未捕获页面异常').toEqual([]);
    } finally {
      await mock.close();
    }
  });

  /* ISSUE-004 · 负向证据：无 __TAURI__ 时崩溃读取链路必须真实失败，不得经注入端口谎报成功 */
  test('无 __TAURI__ 时 readCrashDumps 必须返回 ok:false', async () => {
    /* 与 main.ts 装配同口径：desktopInvoke 端口已注入，但桌面桥接缺失 */
    bindErrorDeps({ desktopInvoke: () => Promise.resolve(null) });
    const res = await readCrashDumps();
    expect(res.ok, '无 __TAURI__ 时 readCrashDumps 必须 ok === false').toBe(false);
    expect(res.error, '失败必须给出可诊断原因').toBeTruthy();
  });
});
