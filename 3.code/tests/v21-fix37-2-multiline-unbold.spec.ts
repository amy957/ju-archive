import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:5173';
const ROWS = '#content .text[contenteditable="true"]';
const BOLD = /<(b|strong)\b|font-weight\s*:\s*(bold|bolder|[6-9]\d\d)/i;
const ITALIC = /<(i|em)\b|font-style\s*:\s*italic/i;

async function boot(browser: any, html: string[]) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await ctx.route(BASE + '/**', (r: any) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.actions && J.actions.addNode); }, null, { timeout: 60_000 });
  await page.evaluate((t: string[]) => {
    ['sidebarRight', 'sidebarLeft'].forEach((id) => { const e = document.getElementById(id); if (e) e.classList.remove('collapsed'); });
    const r = Array.from(document.querySelectorAll('#content .text[contenteditable="true"]')) as HTMLElement[];
    t.forEach((h, i) => { if (r[i]) r[i].innerHTML = h; });
  }, html);
  await page.waitForTimeout(300);
  return { ctx, page };
}

/** 跨行拖选：从第 first 行的指定位置拖到第 last 行，返回模型覆盖块数。 */
async function drag(page: any, first: string, last: string) {
  const g = await page.evaluate(([sel, f, l]: any) => {
    const rows = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    const point = (el: HTMLElement, which: string) => {
      const walk = (n: any): any => { if (n.nodeType === 3 && String(n.nodeValue || '').trim()) return n; for (const c of Array.from(n.childNodes as any[])) { const r = walk(c); if (r) return r; } return null; };
      const tn: any = walk(el); if (!tn) return null;
      const at = which === 'last' ? tn.nodeValue.length - 1 : Math.floor(tn.nodeValue.length * 0.4);
      const rg = document.createRange(); rg.setStart(tn, at); rg.setEnd(tn, at + 1);
      const rc = rg.getBoundingClientRect(); return { x: rc.left + 1, y: rc.top + rc.height / 2 };
    };
    const a = point(rows[Number(f)], 'last'); const b = point(rows[Number(l)], 'mid');
    return a && b ? { x1: a.x, y1: a.y, x2: b.x, y2: b.y } : null;
  }, [ROWS, first, last]);
  expect(g, '拖选端点必须落在有文字的块内').not.toBeNull();
  await page.mouse.move(g.x1, g.y1); await page.mouse.down();
  await page.mouse.move(g.x2, g.y2, { steps: 20 }); await page.mouse.up();
  await page.waitForTimeout(300);
  return await page.evaluate(() => ((window as any).__juXsel.describe() || {}).covered);
}

const read = (page: any) => page.evaluate((sel: any) => (Array.from(document.querySelectorAll(sel)) as HTMLElement[]).slice(0, 4).map((e) => ({ html: e.innerHTML, text: (e.textContent || '').trim() })), ROWS);

test('fix37-2 · 首行末字起选 + 中间空行 · 再点加粗整体取消', async ({ browser }) => {
  const { ctx, page } = await boot(browser, ['第1行 FIX37 跨行格式 ABCDEFGHIJ', '', '第2行 FIX37 跨行格式 ABCDEFGHIJ', '第3行 FIX37 跨行格式 ABCDEFGHIJ']);
  expect(await drag(page, '0', '3'), '拖选必须覆盖 ≥2 块（含中间空行）').toBeGreaterThanOrEqual(2);
  const bold = page.locator('#sidebarRight [data-cmd="bold"], [data-cmd="bold"]').first();
  await bold.click(); await page.waitForTimeout(500);
  const on = await read(page);
  expect(on.filter((x: any) => BOLD.test(x.html)).length, '首次点击必须加粗').toBeGreaterThanOrEqual(2);
  await bold.click(); await page.waitForTimeout(500);
  const off = await read(page);
  expect(off.filter((x: any) => BOLD.test(x.html)).length, '再次点击后选区内不得残留任何加粗标签 / 声明').toBe(0);
  expect(off.map((x: any) => x.text), '取消格式后文本零丢失').toEqual(on.map((x: any) => x.text));
  await ctx.close();
});

test('fix37-2 · 存量 <b> 标签跨行整行取消（标签展开 + 文本零丢失）', async ({ browser }) => {
  const { ctx, page } = await boot(browser, ['<b>第1行 FIX37 跨行 ABCDEFGHIJ</b>', '<b>第2行 FIX37 跨行 ABCDEFGHIJ</b>', '<b>第3行 FIX37 跨行 ABCDEFGHIJ</b>', '']);
  const g = await page.evaluate(([sel]: any) => {
    const rows = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    const walk = (n: any): any => { if (n.nodeType === 3 && String(n.nodeValue || '').trim()) return n; for (const c of Array.from(n.childNodes as any[])) { const r = walk(c); if (r) return r; } return null; };
    const a: any = walk(rows[0]), b: any = walk(rows[2]);
    const ra = document.createRange(); ra.setStart(a, 0); ra.setEnd(a, 1);
    const rb = document.createRange(); rb.setStart(b, b.nodeValue.length - 1); rb.setEnd(b, b.nodeValue.length);
    const pa = ra.getBoundingClientRect(), pb = rb.getBoundingClientRect();
    /* 终点取末字右侧：命中行尾空白区 ⇒ 模型焦点偏移 = 该行文本长度（整行选中） */
    return { x1: pa.left + 1, y1: pa.top + pa.height / 2, x2: pb.right + 2, y2: pb.top + pb.height / 2 };
  }, [ROWS]);
  await page.mouse.move(g.x1, g.y1); await page.mouse.down(); await page.mouse.move(g.x2, g.y2, { steps: 20 }); await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => ((window as any).__juXsel.describe() || {}).covered), '拖选必须覆盖 3 块').toBeGreaterThanOrEqual(3);
  const before = await read(page);
  const boldBtn = page.locator('#sidebarRight [data-cmd="bold"], [data-cmd="bold"]').first();
  await boldBtn.click(); await page.waitForTimeout(500);
  const after = await read(page);
  expect(after.filter((x: any) => BOLD.test(x.html)).length, '存量 <b>/<strong> 必须全部展开').toBe(0);
  expect(after.map((x: any) => x.text), '标签展开后文本零丢失').toEqual(before.map((x: any) => x.text));
  await ctx.close();
});

test('fix38-1 · 跨行加粗+斜体叠加 · 逐项取消且不误删另一项', async ({ browser }) => {
  const { ctx, page } = await boot(browser, ['第1行 FIX38 叠加 ABCDEFGHIJ', '第2行 FIX38 叠加 ABCDEFGHIJ', '第3行 FIX38 叠加 ABCDEFGHIJ', '']);
  expect(await drag(page, '0', '2'), '拖选必须覆盖 ≥2 块').toBeGreaterThanOrEqual(2);
  const cmd = (c: string) => page.locator('#sidebarRight [data-cmd="' + c + '"], [data-cmd="' + c + '"]').first();
  const hit = async (re: RegExp) => (await read(page)).filter((x: any) => re.test(x.html)).length;
  await cmd('bold').click(); await page.waitForTimeout(500);
  await cmd('italic').click(); await page.waitForTimeout(500);
  expect(await hit(BOLD), '加粗必须生效').toBeGreaterThanOrEqual(2);
  expect(await hit(ITALIC), '斜体必须生效（与加粗叠加）').toBeGreaterThanOrEqual(2);
  const text = (await read(page)).map((x: any) => x.text);
  await cmd('bold').click(); await page.waitForTimeout(500);
  expect(await hit(BOLD), '仅点加粗后不得残留加粗').toBe(0);
  expect(await hit(ITALIC), '斜体必须保留，不得陪葬').toBeGreaterThanOrEqual(2);
  await cmd('italic').click(); await page.waitForTimeout(500);
  expect((await hit(BOLD)) + (await hit(ITALIC)), '再点斜体后按钮类格式必须清空').toBe(0);
  expect((await read(page)).map((x: any) => x.text), '全程文本零丢失').toEqual(text);
  await ctx.close();
});

test('fix38-1 · 存量 <b><i> 嵌套 · 去加粗只拆一层', async ({ browser }) => {
  const { ctx, page } = await boot(browser, ['<b><i>第1行 FIX38 嵌套 ABCDEFGHIJ</i></b>', '<b><i>第2行 FIX38 嵌套 ABCDEFGHIJ</i></b>', '<b><i>第3行 FIX38 嵌套 ABCDEFGHIJ</i></b>', '']);
  expect(await drag(page, '0', '2'), '拖选必须覆盖 ≥2 块').toBeGreaterThanOrEqual(2);
  const bold = page.locator('#sidebarRight [data-cmd="bold"], [data-cmd="bold"]').first();
  await bold.click(); await page.waitForTimeout(500);
  const off = await read(page);
  expect(off.filter((x: any) => BOLD.test(x.html)).length, '去加粗后 <b>/font-weight 必须消失').toBe(0);
  expect(off.filter((x: any) => ITALIC.test(x.html)).length, '斜体不得陪葬').toBeGreaterThanOrEqual(2);
  await ctx.close();
});
