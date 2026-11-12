import { test, expect, type Browser } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173'; const TEXT = 'REVIEW906-SECRET-TEXT';
async function boot(browser: Browser) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } }); const page = await ctx.newPage(); const logs: string[] = [];
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { return r.fulfill({ status: 404, body: '' }); } });
  page.on('console', (m) => logs.push(m.text())); await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.applyInlineStyle && J.actions); }, null, { timeout: 60_000 }); return { ctx, page, logs };
}
test('review9-06 · 加密态选中加粗与 __JU_RT_DEBUG 均不输出正文', async ({ browser }) => {
  const { ctx, page, logs } = await boot(browser);
  await page.click('#btnSettings'); await expect(page.locator('#setEncrypt')).toBeVisible({ timeout: 15_000 }); await page.locator('#setEncrypt').dispatchEvent('click'); await page.locator('#setPwd1').fill('test123'); await page.locator('#setPwd2').fill('test123'); await page.locator('.modal-overlay [data-ok]').last().click(); await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 20_000 });
  await page.evaluate((text) => { const c = document.getElementById('content') || document.body; const d = document.createElement('div'); d.className = 'text'; d.id = 'probe906'; d.setAttribute('contenteditable', 'true'); d.textContent = text; c.appendChild(d); d.focus(); const n = d.firstChild as Text; const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, text.length); const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r); }, TEXT);
  await page.locator('[data-cmd="bold"]').first().click(); await page.waitForTimeout(300); await page.locator('[data-cmd="color"]').click(); await expect(page.locator('.color-picker .cp-swatch').first()).toBeVisible(); await page.locator('.color-picker .cp-swatch').nth(2).click(); await page.waitForTimeout(500);
  const post = await page.evaluate(() => ({ html: (document.getElementById('probe906') as HTMLElement)?.innerHTML || '' })); const leaked = logs.filter((l) => l.includes(TEXT));
  expect(post.html, 'applyInlineStyle 必须实际执行（颜色写入 DOM）').toContain('color'); expect(leaked, '控制台不得输出所选正文').toEqual([]);
  await page.evaluate((text) => { (window as any).__JU_RT_DEBUG = true; const d = document.createElement('div'); d.className = 'text'; d.setAttribute('contenteditable', 'true'); d.textContent = text; (document.getElementById('content') || document.body).appendChild(d); d.focus(); const n = d.firstChild as Text; const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, text.length); const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r); }, TEXT);
  await page.evaluate(() => (window as any).JU.applyInlineStyle('color', 'rgb(255, 0, 0)')); await page.waitForTimeout(300); const rt = logs.filter((l) => l.includes('[JU-RT]'));
  expect(rt.length, '门控开启时必须保留诊断输出').toBeGreaterThan(0); expect(rt.join('|'), '诊断输出不得含所选正文').not.toContain(TEXT); await ctx.close();
});
