import { test, expect, type BrowserContext, type Route } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * v2.1 · fix23 · 幻灯片视图样式外提（严格 CSP）
 *
 * 缺陷（fix21 遗留）：src/views/slides.ts 的 _styleOnce() 在运行期
 *   createElement('style') + head.appendChild 注入 #juSlidesStyle（r9 / r23 / L22-final-r4 /
 *   不变量 #77 全量），并以 innerHTML 字符串写 <li style="margin-left:Npx">。
 *   严格 CSP（default-src 'self'; style-src 'self' 'unsafe-inline'，注入方按 nonce/hash 收口）下
 *   该 <style> 被拦截 ⇒ 幻灯片视图退化为纯文本、样式丢失。
 *
 * 修复：CSS 迁入 src/style.css（选择器统一 .ju-sl-wrap 前缀）；内联 style 改 class；
 *   运行期动态几何改写入 CSS 变量 --ju-sl-*。断言：
 *   ① page console CSP error = 0；② .ju-sl-wrap 存在且 boundingBox 宽高 > 0；
 *   ③ 至少 1 个幻灯片元素 computedStyle position 非 static；④ 不再出现 #juSlidesStyle。
 *
 * 承载：默认 vite build 产物 + context.route 映射到 http://localhost:5173；
 *   设 JU_RELEASE_HTML 时改为拦截该单文件产物（发布件复跑同一断言面）。
 */
const BASE = 'http://localhost:5173';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE = process.env.JU_RELEASE_HTML ? path.resolve(process.env.JU_RELEASE_HTML) : '';
/* 严格 CSP 取 src-tauri/tauri.conf.json security.csp 的同一口径；单文件产物把自身 bundle 内联，
   故脚本侧需 unsafe-inline（Tauri 侧由注入 hash / nonce 收口）。 */
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** 默认模式：以项目目录为 cwd 跑 Vite CLI（build() API 会被门禁进程 cwd 带偏），产出单文件 dist/index.html。 */
function buildDist(): void {
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--logLevel', 'silent'], { cwd: ROOT, stdio: 'pipe' });
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('vite build 未产出 dist/index.html');
}

/** 同一断言面服务两种承载：JU_RELEASE_HTML 单文件产物，或 dist 目录产物（均带严格 CSP 响应头）。 */
async function serve(context: BrowserContext): Promise<void> {
  const single = RELEASE ? await fsp.readFile(RELEASE) : null;
  await context.route(BASE + '/**', async (route: Route) => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname);
    const headers = { 'Content-Security-Policy': CSP };
    if (single) {
      if (p === '/' || p === '/index.html') return route.fulfill({ status: 200, contentType: MIME['.html'], headers, body: single });
      return route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'not found: ' + p });
    }
    const file = path.join(ROOT, 'dist', p && p !== '/' ? p : '/index.html');
    const ext = path.extname(file).toLowerCase();
    try {
      const body = await fsp.readFile(file);
      return route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', headers: ext === '.html' ? headers : {}, body });
    } catch {
      return route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'not found: ' + p });
    }
  });
}

test('fix23 · 幻灯片视图在严格 CSP 下样式完整、零 CSP 拦截', async ({ browser }) => {
  test.setTimeout(240_000);
  if (!RELEASE) buildDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await serve(context);
  const page = await context.newPage();
  const cspErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /content security policy|refused to apply|refused to load|csp/i.test(m.text())) cspErrors.push(m.text());
  });
  try {
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => !!(window as any).JU && typeof (window as any).JU.getState === 'function', null, { timeout: 60_000 });
    /* 建文档 + 3 个顶级节点（幻灯片分页 = 大纲顶级节点），全程走产品端口，不改写 JU.ui */
    await page.evaluate(() => {
      const J: any = (window as any).JU;
      let docId = typeof J.actions.createDoc === 'function' ? J.actions.createDoc('fix23 探针文档') : null;
      if (!docId) { const st = J.getState(); docId = (st.ui && st.ui.currentDocId) || st.rootId; }
      if (docId && typeof J.actions.setCurrentDoc === 'function') J.actions.setCurrentDoc(docId);
      for (let i = 1; i <= 3; i++) J.actions.addNode(docId, null, { text: '第' + i + '页 FIX23 幻灯片正文' });
      if (typeof J.forceRender === 'function') J.forceRender();
    });
    await page.locator('#tbNav .tb-nav-btn[data-view="slides"]').first().click();
    await page.waitForSelector('.ju-sl-wrap', { timeout: 30_000 });
    await page.waitForTimeout(600);

    /* ① 页面级 CSP 拦截必须为 0（此前 _styleOnce 注入的 <style> 在此被拒） */
    expect(cspErrors, 'CSP error 必须为 0：' + cspErrors.join(' | ')).toHaveLength(0);
    /* ④ 样式全部来自 style.css：运行期不再注入 <style id="juSlidesStyle"> */
    expect(await page.locator('#juSlidesStyle').count(), '不得再注入 #juSlidesStyle').toBe(0);

    /* ② 布局成立：.ju-sl-wrap 可见且宽高 > 0 */
    const box = await page.locator('.ju-sl-wrap').first().boundingBox();
    expect(box, '.ju-sl-wrap 必须参与布局').not.toBeNull();
    expect(box!.width, '.ju-sl-wrap 宽必须 > 0').toBeGreaterThan(0);
    expect(box!.height, '.ju-sl-wrap 高必须 > 0').toBeGreaterThan(0);

    /* ③ 至少 1 个幻灯片元素 computedStyle position 非 static */
    const positioned = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.ju-sl-wrap, .ju-sl-wrap .ju-sl-rail, .ju-sl-wrap .ju-sl-main, .ju-sl-wrap .ju-sl-stage, .ju-sl-wrap .ju-sl-content, .ju-sl-wrap .ju-sl-thumb'));
      return els.filter((el) => getComputedStyle(el).position !== 'static').length;
    });
    expect(positioned, '至少 1 个幻灯片元素 computedStyle position 必须非 static').toBeGreaterThan(0);

    /* style.css 独有几何：舞台 8px 圆角 + 恒 16:9（证明规则来自外部样式表而非写入内联样式） */
    const stage = await page.locator('.ju-sl-wrap .ju-sl-stage').first().evaluate((el) => {
      const s = getComputedStyle(el as HTMLElement);
      return { radius: s.borderTopLeftRadius, ratio: s.aspectRatio.replace(/\s+/g, '') };
    });
    expect(stage.radius, '舞台圆角必须来自 style.css').toBe('8px');
    expect(stage.ratio, '舞台 aspect-ratio 必须来自 style.css').toBe('16/9');
  } finally {
    await context.close();
  }
});
