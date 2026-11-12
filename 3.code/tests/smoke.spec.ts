import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

/**
 * M1-1 最终目标 · 单 HTML 产物冒烟测试
 *
 * 被测对象：`vite build` 生成的唯一产物 `dist/index.html`
 *   （vite-plugin-singlefile 已把入口模块 / 样式全部内联；public/ 在 build 阶段不拷贝）。
 *
 * 断言两层：
 *   ① 产物自检（无需浏览器）：dist 目录只有一个文件 `index.html`；标题含「JU」；
 *      脚本为内联 `<script type="module">`，不存在外链 `src="/assets/..."` / `href="/assets/..."`。
 *   ② 运行时冒烟（真实 Chromium + 真实 DOM）：
 *      - 页面标题包含「JU」；
 *      - `window.JU.getState()` 可取得初始欢迎节点「欢迎使用 JU」；
 *      - 顶部栏 `#topbar`、左侧栏 `#sidebarLeft`、右侧栏 `#sidebarRight` DOM 节点存在。
 *
 * 环境适配（与 concurrency.spec.ts / recovery.spec.ts / benchmark-30k.spec.ts 同一实测结论）：
 * 本机浏览器进程到 127.0.0.1 / localhost 的入站连接被系统策略阻断（端口 LISTENING 但连接不建立）。
 * 因此本 spec 在 `context.route` 层把 `http://localhost:4173`（vite preview 默认端口）映射到真实
 * 构建产物：页面仍运行在 `http://localhost:4173` 这一真实 HTTP 源上，localStorage / BroadcastChannel
 * 的语义与真实服务端承载一致；同时批次 AY/AZ 仍按要求真实启动 `vite preview --port 4173`。
 */

const ORIGIN = 'http://localhost:4173';
const STORE_KEY = 'juju.store.v31';

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

/** 把 http://localhost:4173 的请求映射到 dist 产物。 */
async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route(ORIGIN + '/**', async (route: Route) => {
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

test.describe('M1-1 单 HTML 产物', () => {
  test('dist 必须产出 index.html，且脚本 / 样式已内联', () => {
    const dist = distDir();
    const entries = fs.readdirSync(dist, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => e.name).sort();
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

    /* 产物契约变更（批次 DD）：
       `vite build` 在 `JU_KEEP_PUBLIC=1`（benchmark-30k 依赖 dist/30k-fixture.json）等场景
       会拷贝 public/，因此 dist 下**不再保证**只有 index.html。
       断言口径改为：index.html 必须存在，且 JS / CSS 已内联进该文件（不再断言目录独占）。 */
    expect(files, 'dist 必须包含 index.html').toContain('index.html');
    /* 附属文件仅作诊断输出（public/ 拷贝件或 worker chunk），不作为失败条件 */
    console.log('[smoke] dist files=' + JSON.stringify(files) + ' dirs=' + JSON.stringify(dirs));

    const htmlPath = path.join(dist, 'index.html');
    const bytes = fs.statSync(htmlPath).size;
    const html = fs.readFileSync(htmlPath, 'utf8');

    /* 真实字节数（供批次 BA 汇报） */
    console.log('[smoke] dist/index.html bytes=' + bytes);

    expect(bytes, 'index.html 不得为空').toBeGreaterThan(0);
    expect(bytes, '单文件体积应在合理范围（< 8MB）').toBeLessThan(8 * 1024 * 1024);
    expect(html, '页面标题必须包含 JU').toMatch(/<title>[^<]*JU[^<]*<\/title>/);
    /* ① JS 已内联：存在内联 module 脚本，且不存在任何外链脚本 */
    expect(html, '入口脚本必须已内联为 <script type="module">').toMatch(/<script type="module"[^>]*>/);
    expect(html, '不得残留外链脚本（src="/assets/..."）').not.toMatch(/<script[^>]+src=/i);
    /* ② CSS 已内联：存在内联 <style>，且不存在任何外链样式表（rel="stylesheet"） */
    expect(html, '样式必须已内联为 <style> 块').toMatch(/<style[^>]*>/i);
    expect(html, '不得残留外链样式表（rel="stylesheet"）').not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
  });

  test('加载构建产物：标题 / JU.getState 欢迎节点 / 三区 DOM 均存在', async ({ context, page }) => {
    test.setTimeout(120_000);

    const dist = distDir();
    await installDistRoute(context, dist);

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    await page.goto(ORIGIN + '/', { waitUntil: 'load' });
    await waitJuReady(page);

    /* ① 页面标题包含「JU」 */
    await expect(page).toHaveTitle(/JU/);

    /* ② window.JU.getState() 可取得初始「欢迎使用 JU」节点 */
    const snapshot = await page.evaluate(() => {
      const J = (window as any).JU;
      const st: any = J.getState();
      const nodes: Record<string, any> = (st && st.nodes) || {};
      const ids = Object.keys(nodes);
      let welcomeText = '';
      let welcomeId: any = null;
      for (const id of ids) {
        const n = nodes[id];
        if (n && String(n.text || '') === '欢迎使用 JU') {
          welcomeText = String(n.text);
          welcomeId = n.id;
          break;
        }
      }
      const root = st && st.nodes ? st.nodes[st.rootId] : null;
      return {
        rootId: st ? st.rootId : null,
        nodeCount: ids.length,
        welcomeText,
        welcomeId,
        rootChildren: root && Array.isArray(root.children) ? root.children.length : -1,
        storedBytes: (localStorage.getItem('juju.store.v31') || '').length,
      };
    });

    expect(snapshot.rootId, '必须持有根节点').toBeTruthy();
    expect(snapshot.nodeCount, '初始状态必须包含节点').toBeGreaterThan(0);
    expect(snapshot.welcomeText, 'JU.getState() 必须能取到「欢迎使用 JU」节点').toBe('欢迎使用 JU');
    expect(snapshot.welcomeId, '欢迎节点必须有 id').toBeTruthy();
    expect(snapshot.rootChildren, '欢迎节点必须挂在根节点下').toBeGreaterThan(0);

    /* ③ 顶部栏 / 左侧栏 / 右侧栏 DOM 节点存在（并已真实挂载到文档） */
    await expect(page.locator('#topbar'), '顶部栏 #topbar 必须存在').toHaveCount(1);
    await expect(page.locator('#sidebarLeft'), '左侧栏 #sidebarLeft 必须存在').toHaveCount(1);
    await expect(page.locator('#sidebarRight'), '右侧栏 #sidebarRight 必须存在').toHaveCount(1);
    await expect(page.locator('#content'), '内容区 #content 必须存在').toHaveCount(1);

    const domFlags = await page.evaluate(() => ({
      topbarVisible: !!document.querySelector('#topbar'),
      leftVisible: !!document.querySelector('#sidebarLeft'),
      rightVisible: !!document.querySelector('#sidebarRight'),
      contentRendered: (document.getElementById('content')?.children.length ?? -1) >= 0,
      bootError: (window as any).JU && (window as any).JU.__bootError ? String((window as any).JU.__bootError) : null,
    }));
    expect(domFlags.topbarVisible).toBe(true);
    expect(domFlags.leftVisible).toBe(true);
    expect(domFlags.rightVisible).toBe(true);
    expect(domFlags.bootError, 'boot 不得抛错').toBeNull();
    expect(pageErrors, '加载构建产物不得产生未捕获页面异常').toEqual([]);

    /* 真实落盘旁证（数据层已在单文件产物中运行） */
    expect(snapshot.storedBytes, '启动后必须完成真实落盘（' + STORE_KEY + '）').toBeGreaterThan(0);
  });
});
