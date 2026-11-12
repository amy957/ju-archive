import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * M3 · 批次 AX · 备份/恢复端到端故障注入演练（M3-3a）
 *
 * 两个真实故障场景（无 mock、无桩数据，操作全部落在真实 localStorage / 真实运行期链路上）：
 *
 *   ① 主库 JSON 损坏 → 自动恢复默认态
 *      `localStorage['juju.store.v31'] = '{invalid_json}'` → 刷新
 *      → `core/persist.loadState()` 的 `JSON.parse` 抛错 → 返回 null
 *      → `app/boot.boot()` 回落 `loadAutoBackup()`（迁移期无自动备份 → null）
 *      → `deps.defaultState()`（含「欢迎使用 JU」欢迎文档种子）
 *      → `initStore(initial)` → `persistNow()` 用合法 JSON 覆盖坏库。
 *      断言：页面正常装载（无 pageerror / 无 __bootError / 内容区已渲染）、
 *            `JU.getState()` 含默认欢迎节点、磁盘上的坏 JSON 已被合法快照替代。
 *
 *   ② localStorage 配额满 → 降级提示
 *      Hook `Storage.prototype.setItem` 抛 `QuotaExceededError`，随后执行一次真实数据修改
 *      （`JU.actions.addNode`）→ `core/persist.runPersist()` 的 `localStorage.setItem` 失败
 *      → 进入 catch → `toast('保存失败：存储空间不足，请导出备份')`。
 *      断言：toast 文本含「存储空间不足」、内存态修改已生效（不因落盘失败回滚）、
 *            应用未崩溃（#content 仍在、后续读取 state 正常、无 pageerror / 无 __bootError）。
 *
 * ── 环境适配（与 concurrency.spec.ts / benchmark-30k.spec.ts 同一实测结论） ──
 * 本机浏览器进程到 127.0.0.1 / localhost 的入站连接被系统策略阻断（端口 LISTENING 但连接不建立），
 * 故以 `vite build` 产物 + `context.route` 承载：页面仍运行在 `http://localhost:5173` 真实 HTTP 源，
 * localStorage 的持久化 / 刷新语义与真实服务端承载完全一致。
 *
 * ── 迁移期 DOM 骨架（不改产品源码） ──
 * `index.html` 目前只有 `#app`。document-start 注入最小骨架（`#content` / 侧栏 / 折叠按钮 /
 * `#toast` / `#btnClose`），供 `boot()` 的 UI 绑定段与 `toast()` 使用；所有行为仍由产品模块驱动。
 */

const BASE = 'http://localhost:5173';
const STORE_KEY = 'juju.store.v31';
/** 首次落盘静默窗口（boot persistNow 为异步 runPersist） */
const WRITE_SETTLE_MS = 500;

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

/** 重新构建（保证被测代码即当前源码），返回 dist 绝对路径。 */
async function prepareDist(): Promise<string> {
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  return dist;
}

/** 把 baseURL 请求映射到 dist 产物。 */
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
 * document-start 注入最小 DOM 骨架。
 *
 * 时序要点（实测）：Vite 产物为 `<script type="module">`（deferred）。模块求值时
 * `document.readyState` 已是 `'interactive'`，`boot.start()` 因此走同步分支立即开跑；
 * 而它的首个 `await` 只让出一个微任务，**早于** `DOMContentLoaded` 事件。
 * 故骨架必须在 `readystatechange → 'interactive'`（deferred 脚本执行之前）就已挂载，
 * 用 DOMContentLoaded 注册会漏挂（boot 的 UI 绑定段会命中 null）。
 */
async function installSkeleton(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const mount = (): void => {
      if (document.getElementById('recovery-skeleton')) return;
      const host = document.body || document.documentElement;
      if (!host) return;
      const wrap = document.createElement('div');
      wrap.id = 'recovery-skeleton';
      wrap.innerHTML =
        '<div id="recovery-topbar"><button type="button" id="btnClose">x</button></div>' +
        '<div id="recovery-body">' +
        '<aside id="sidebarLeft"></aside>' +
        '<main id="content"></main>' +
        '<aside id="sidebarRight"></aside>' +
        '</div>' +
        '<button type="button" id="btnToggleLeft"></button>' +
        '<button type="button" id="btnToggleRight"></button>' +
        '<div id="toast"></div>';
      host.appendChild(wrap);
    };
    /* 尽早尝试一次（body 已存在时），否则等 readyState 变 interactive（先于 deferred 脚本） */
    mount();
    document.addEventListener('readystatechange', mount);
  });
}

/** 等 `window.JU` 装配完成（store 端口可用）。 */
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

test.describe('M3-3a 备份/恢复故障注入', () => {
  test('损坏的主库 JSON 自动恢复默认欢迎节点', async ({ context, page }) => {
    test.setTimeout(180_000);

    const dist = await prepareDist();
    await installDistRoute(context, dist);
    await installSkeleton(context);

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    /* ① 首次装载：boot 生成默认态并完成首次落盘 */
    await page.goto('/', { waitUntil: 'load' });
    await waitJuReady(page);
    await expect.poll(async () => page.evaluate((key) => (localStorage.getItem(key) || '').length, STORE_KEY), { timeout: 4000 }).toBeGreaterThan(0);
    const baselineBytes = await page.evaluate((key) => (localStorage.getItem(key) || '').length, STORE_KEY);
    expect(baselineBytes, '首次装载后必须已有真实落盘（boot persistNow）').toBeGreaterThan(0);

    /* ② 注入损坏主库：非法 JSON（模拟写盘中断 / 外部篡改） */
    await page.evaluate((key) => {
      localStorage.setItem(key, '{invalid_json}');
    }, STORE_KEY);
    const corrupted = await page.evaluate((key) => localStorage.getItem(key), STORE_KEY);
    expect(corrupted).toBe('{invalid_json}');

    /* ③ 刷新：loadState 解析失败 → 回落 defaultState（migrateOrFallback 链路） */
    await page.reload({ waitUntil: 'load' });
    await waitJuReady(page);

    const recovered = await page.evaluate(async () => {
      /* 让 boot 的初始落盘（persistNow → runPersist）完成 */
      await new Promise<void>((r) => setTimeout(r, 600));
      const J = (window as any).JU;
      const st = J.getState();
      const nodes = (st && st.nodes) || {};
      const texts = Object.keys(nodes).map((id) => String((nodes[id] && nodes[id].text) || ''));
      const root = st ? nodes[st.rootId] : null;
      const content = document.getElementById('content');
      const raw = localStorage.getItem('juju.store.v31') || '';
      let diskOk = false;
      try {
        const disk = JSON.parse(raw);
        diskOk = !!(disk && disk.nodes && disk.rootId && disk.nodes[disk.rootId]);
      } catch {
        diskOk = false;
      }
      return {
        rootId: st ? st.rootId : null,
        nodeCount: Object.keys(nodes).length,
        rootChildren: root && Array.isArray(root.children) ? root.children.length : -1,
        texts,
        diskOk,
        diskBytes: raw.length,
        contentChildren: content ? content.children.length : -1,
        bootError: J.__bootError || null,
        welcomeVisible: texts.includes('欢迎使用 JU'),
      };
    });

    /* ④ 恢复成功判据 */
    expect(recovered.bootError, 'boot 不得因坏库抛错（页面无白屏崩溃）').toBeNull();
    expect(recovered.rootId, '恢复后必须持有根节点').toBe('root');
    expect(recovered.nodeCount, '恢复后节点数必须大于 1（根节点 + 欢迎文档）').toBeGreaterThan(1);
    expect(recovered.rootChildren, '欢迎文档必须挂在根节点下').toBeGreaterThan(0);
    expect(recovered.welcomeVisible, '恢复后必须包含默认欢迎节点「欢迎使用 JU」').toBe(true);
    expect(recovered.diskOk, '坏 JSON 必须已被合法默认态快照覆盖').toBe(true);
    expect(recovered.diskBytes).toBeGreaterThan(0);
    expect(recovered.contentChildren, '#content 必须已渲染内容（非白屏）').toBeGreaterThan(-1);
    expect(pageErrors, '恢复过程不得产生未捕获页面异常').toEqual([]);
  });

  test('存储配额满时降级提示且不崩溃', async ({ context, page }) => {
    test.setTimeout(180_000);

    const dist = await prepareDist();
    await installDistRoute(context, dist);
    await installSkeleton(context);

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    await page.goto('/', { waitUntil: 'load' });
    await waitJuReady(page);
    await expect.poll(async () => page.evaluate((key) => (localStorage.getItem(key) || '').length, STORE_KEY), { timeout: 4000 }).toBeGreaterThan(0);

    const result = await page.evaluate(async () => {
      /* ① 注入配额故障：所有 Storage.setItem 抛 QuotaExceededError（localStorage / sessionStorage 同源原型） */
      const proto = Storage.prototype;
      const original = proto.setItem;
      proto.setItem = function (): void {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      };

      const J = (window as any).JU;
      const st = J.getState();
      const before = Object.keys(st.nodes).length;
      let addedId: any = null;
      let thrown: string | null = null;
      try {
        /* ② 真实数据修改：commit → scheduleNotify → schedulePersist → runPersist(setItem 失败) */
        addedId = J.actions.addNode(st.rootId, null, { text: 'quota-probe' });
      } catch (e) {
        thrown = String((e && (e as any).message) || e);
      }

      /* ③ 等降级 toast（persist 落盘失败分支：'保存失败：存储空间不足，请导出备份'） */
      const t = document.getElementById('toast');
      const deadline = Date.now() + 10_000;
      let toastText = '';
      while (Date.now() < deadline) {
        toastText = t ? (t.textContent || '') : '';
        if (toastText.includes('存储空间不足')) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      /* ④ 恢复真实 setItem，验证应用仍可继续工作 */
      proto.setItem = original;
      const after = J.getState();
      const nodeExists = !!(addedId && after.nodes[addedId]);
      const probe = { alive: true };
      try {
        localStorage.setItem('juju.recovery.probe', '1');
        localStorage.removeItem('juju.recovery.probe');
      } catch (e) {
        probe.alive = false;
      }

      return {
        addedId,
        commitError: thrown,
        toastText,
        nodeExists,
        before,
        after: Object.keys(after.nodes).length,
        contentAlive: !!document.getElementById('content'),
        storageUsableAfterRestore: probe.alive,
        bootError: J.__bootError || null,
      };
    });

    /* ⑤ 降级判据 */
    expect(result.commitError, '配额失败不得让写操作抛错到调用方').toBeNull();
    expect(result.addedId, 'addNode 必须返回新节点 id（内存提交成功）').toBeTruthy();
    expect(result.nodeExists, '内存态必须已包含新节点（落盘失败不阻塞数据修改）').toBe(true);
    expect(result.after, '节点数必须较故障前增加').toBe(result.before + 1);
    expect(result.toastText, '必须弹出「存储空间不足」降级提示').toContain('存储空间不足');
    expect(result.contentAlive, '故障后页面结构必须仍存在（不崩溃）').toBe(true);
    expect(result.storageUsableAfterRestore, '故障注入解除后存储必须恢复可用').toBe(true);
    expect(result.bootError, 'boot 不得因配额故障抛错').toBeNull();
    expect(pageErrors, '配额故障不得产生未捕获页面异常').toEqual([]);
  });
});
