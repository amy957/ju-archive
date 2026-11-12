import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
test('review9-14 · 所有 var(--c-*) 均有定义且日/夜/打印关键色不变', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { return r.fulfill({ status: 404, body: '' }); } });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.actions); }, null, { timeout: 60_000 });
  const css = await page.evaluate(() => Array.from(document.styleSheets).map((s) => { try { return Array.from(s.cssRules).map((r: any) => r.cssText).join('\n'); } catch { return ''; } }).join('\n'));
  const defs = new Set(Array.from(css.matchAll(/--c-[a-z0-9-]+(?=\s*:)/g)).map((m) => m[0])); const refs = new Set(Array.from(css.matchAll(/var\(\s*(--c-[a-z0-9-]+)/g)).map((m) => m[1]));
  expect(Array.from(refs).filter((x) => !defs.has(x)), '引用了未定义的 --c-* token').toEqual([]);
  const raw = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return ['--c-green', '--c-bg-day', '--c-now', '--c-night-fg'].map((n) => cs.getPropertyValue(n).trim().toLowerCase()); });
  expect(raw).toEqual(['#4a7a5e', '#dfecd5', '#7c1823', '#e6f0fa']);
  const col = (th: string) => page.evaluate((t: string) => { document.documentElement.dataset.theme = t; const d = document.createElement('div'); d.style.backgroundColor = 'var(--bg)'; document.body.appendChild(d); const v = getComputedStyle(d).backgroundColor; d.remove(); return v; }, th);
  const day = await col('day'); const night = await col('night'); expect(night, '夜间背景应不同于日间').not.toBe(day);
  expect(css, '打印态应以 --c-white token 收口').toMatch(/@media print[\s\S]*body\s*\{\s*background:\s*var\(--c-white\)/);
  await ctx.close();
});
