import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:5173';
test('fix33-8 · 打开取色器后点 #btnSettings 取色器关闭', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.applyInlineStyle); }, null, { timeout: 60_000 });
  await page.evaluate(() => { const sb = document.getElementById('sidebarRight'); if (sb) sb.classList.remove('collapsed'); const h = document.createElement('div'); h.className = 'text'; h.setAttribute('contenteditable', 'true'); h.textContent = 'ABCDE'; (document.getElementById('content') as HTMLElement).appendChild(h); h.focus(); const s = window.getSelection()!; const r = document.createRange(); r.selectNodeContents(h); s.removeAllRanges(); s.addRange(r); });
  await page.locator('[data-cmd="color"]').click();
  await expect(page.locator('.color-picker')).toHaveCount(1);
  await page.locator('#btnSettings').click();
  await expect(page.locator('.color-picker')).toHaveCount(0);
  await ctx.close();
});
test('fixr6-6 · __TAURI__.window 无 onCloseRequested 时 #btnClose 不直关且提示关闭链路未就绪', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  await ctx.addInitScript(() => {
    const appWindow = {
      close: async () => { (window as any).__closeCalls = ((window as any).__closeCalls || 0) + 1; },
      hide: async () => {},
      isAlwaysOnTop: async () => false,
      setAlwaysOnTop: async () => {},
      minimize: async () => {},
      toggleMaximize: async () => {},
    };
    (window as any).__closeCalls = 0;
    (window as any).__TAURI__ = {
      core: { invoke: async (c: string) => (c === 'load_state' ? '{}' : null) },
      window: { getCurrentWindow: () => appWindow },
    };
  });
  const page = await ctx.newPage(); const errs: string[] = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.applyInlineStyle); }, null, { timeout: 60_000 });
  await page.locator('#btnClose').click();
  await page.waitForFunction(() => { const el = document.getElementById('toast'); return !!(el && String(el.textContent || '').includes('关闭链路未就绪')); }, null, { timeout: 4000 });
  expect(errs.filter((e) => e.includes('TypeError'))).toEqual([]);
  const msg = await page.locator('#toast').textContent();
  expect(msg).toContain('数据已保存'); expect(msg).toContain('再点一次关闭');
  expect(await page.evaluate(() => (window as any).__closeCalls)).toBe(0);
  await ctx.close();
});
