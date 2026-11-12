import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix12 · 大纲视图「选中样式块级叠加」（绿色区域 ≠ 选区区域）
 *
 * 缺陷与取证（90过程材料/tmp/fix12/selection_visual_before.log，fix11 发布版 sha256 2443cb6c…f168，
 * Edge 真窗口 file:// 真实拖选）：
 *   · 横向拖选 3 字（选区 805px²）：.row.sel 底色 --accent-soft 涂满整行 960×32≈30240px² ⇒ 37.6×；
 *   · 竖向拖选 3 行（选区 4075px²）：.ju-xsel 渐变底 + 内描边涂满 3 块（各 845×30）+ 行底
 *     ⇒ 80098px²，19.7×；且 fix11 把 .text.ju-xsel::selection 置 transparent ⇒ 原生层完全不可见，
 *     绿色 100% 来自块级层 —— 用户看到「整块变绿」，与实际选中的文字不重合。
 *   · 引擎事实（同一份证据 + 90过程材料/tmp_compare/fix7/richtext_capability.log）：
 *     Blink 把原生 Selection 钳在单个 contenteditable 宿主内（SINGLE_HOST_CLAMPED），
 *     竖向拖选 3 行时 window.getSelection() 只覆盖第 1 块（20 字符、不含换行），
 *     跨行选区由产品模型 src/ui/xselect.ts（.ju-xsel + window.__juXsel，实测 covered=3）承载。
 *
 * fix12 契约（仅动 src/style.css）：
 *   ① .text.ju-xsel 的 background-image / background-color / box-shadow 全部清零（零绘制）；
 *   ② .outline .row.sel / .row.multi-sel 底色清零（它们是焦点行标记，不是选区高亮，
 *      见 src/views/outline.ts:403/:1083、src/ui/focus.ts:247-248）；
 *   ③ 原生 ::selection 统一为产品绿 20%，.text 与 .text.ju-xsel 同色（不再有双层深浅）。
 *   ⇒ 绿色区域 == 浏览器原生选区区域，只有一层。
 *
 * 本 spec 口径：真实鼠标拖选 / 真实键盘输入，断言读 DOM computed 样式 + 选区模型，
 * 不注入内联 style、不改夹具（与 fix7 / fix10 / fix11 spec 同一承载方式：vite build + context.route）。
 */

const BASE = 'http://localhost:5173';
const ROWS = '#content .text[contenteditable="true"]';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

async function ensureDist(): Promise<string> {
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
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
      const st = await fsp.stat(file);
      if (st.isDirectory()) throw new Error('directory');
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

async function openApp(browser: Browser): Promise<{ context: BrowserContext; page: Page; pageErrors: string[] }> {
  const dist = await ensureDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') pageErrors.push(String(m.text())); });
  page.on('pageerror', (e: any) => pageErrors.push('pageerror: ' + String(e && e.message)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window as any).JU && typeof (window as any).JU.getState === 'function', null, { timeout: 60_000 });
  await page.waitForTimeout(600);
  return { context, page, pageErrors };
}

async function gotoOutline(page: Page): Promise<void> {
  const btn = page.locator('#tbNav .tb-nav-btn[data-view="outline"]').first();
  await expect(btn, '顶栏必须有大纲入口').toHaveCount(1, { timeout: 20_000 });
  await btn.click();
  await expect(page.locator('#content .outline')).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(400);
}

/** 真实键盘建多行（与 fix11 spec 同口径） */
async function buildRows(page: Page): Promise<number> {
  const first = page.locator(ROWS).first();
  await first.click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('第1行 FIX12 单层选区 ABCDEFGHIJ', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第2行 FIX12 单层选区 KLMNOPQRST', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第3行 FIX12 单层选区 UVWXYZ0123', { delay: 6 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('第4行 FIX12 单层选区 456789abcd', { delay: 6 });
  await page.waitForTimeout(400);
  let n = await page.locator(ROWS).count();
  if (n < 2) {
    await page.evaluate(() => {
      const JU: any = (window as any).JU;
      const st = JU.getState();
      const docId = (st.ui && st.ui.currentDocId) || st.rootId;
      ['第5行 FIX12 追加 A', '第6行 FIX12 追加 B'].forEach((t: string) => JU.actions.addNode(docId, null, { text: t }));
      if (typeof JU.forceRender === 'function') JU.forceRender();
    });
    await page.waitForTimeout(500);
    n = await page.locator(ROWS).count();
  }
  return n;
}

async function clickRow(page: Page, index = 1): Promise<void> {
  await page.keyboard.press('Escape').catch(() => { });
  const pt = await page.evaluate(({ sel, i }) => {
    const rows = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    const r = rows[Math.min(i, rows.length - 1)].getBoundingClientRect();
    return { x: r.left + 30, y: r.top + r.height / 2 };
  }, { sel: ROWS, i: index });
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(200);
}

/** A. 横向拖选同一行内的部分文字（约 3 个汉字） */
async function dragHorizontalPartial(page: Page): Promise<void> {
  const geo = await page.evaluate((sel) => {
    const rows = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    const r0 = rows[0].getBoundingClientRect();
    return { startX: r0.left + 4, startY: r0.top + r0.height / 2, endX: r0.left + 46, endY: r0.top + r0.height / 2 };
  }, ROWS);
  await page.mouse.move(geo.startX, geo.startY);
  await page.mouse.down();
  await page.mouse.move(geo.endX, geo.endY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** B. 竖向拖选多行：第 1 行文本起点 → 第 3 行文本中部 */
async function dragVerticalMultiRow(page: Page): Promise<void> {
  const geo = await page.evaluate((sel) => {
    const rows = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    const r0 = rows[0].getBoundingClientRect();
    const r2 = rows[Math.min(2, rows.length - 1)].getBoundingClientRect();
    return {
      startX: r0.left + 6, startY: r0.top + r0.height / 2,
      endX: r2.left + Math.min(200, r2.width - 8), endY: r2.top + r2.height / 2,
    };
  }, ROWS);
  await page.mouse.move(geo.startX, geo.startY);
  await page.mouse.down();
  await page.mouse.move(geo.endX, geo.endY, { steps: 24 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** 统一的选区 / 绘制读取（页面内自带颜色解析，不依赖外部 helper） */
const READ = () => {
  const parseC = (s: string) => {
    const t = String(s || '').trim();
    let m = t.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.%]+))?\s*\)$/i);
    if (m) {
      const a = m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
      return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a };
    }
    m = t.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i);
    if (m) return { r: parseFloat(m[1]) * 255, g: parseFloat(m[2]) * 255, b: parseFloat(m[3]) * 255, a: m[4] == null ? 1 : parseFloat(m[4]) };
    return null;
  };
  const vis = (c: any) => !!c && c.a > 0.02;
  const colorsOf = (s: string) => {
    const out: any[] = [];
    const re = /rgba?\([^)]*\)|color\(srgb[^)]*\)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(String(s || '')))) { const c = parseC(m[0]); if (c) out.push(c); }
    return out;
  };
  const pseudo = (el: Element | null) => {
    if (!el) return null;
    const cs = getComputedStyle(el, '::selection');
    return { bg: cs.backgroundColor, color: cs.color, parsed: parseC(cs.backgroundColor) };
  };
  const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, area: Math.max(0, r.width) * Math.max(0, r.height) }; };

  const sel = window.getSelection();
  const text = sel ? String(sel.toString()) : '';
  const selRects: { l: number; t: number; w: number; h: number }[] = [];
  if (sel && sel.rangeCount > 0) {
    for (const r of Array.from(sel.getRangeAt(0).getClientRects())) selRects.push({ l: r.left, t: r.top, w: r.width, h: r.height });
  }
  const blocks = Array.from(document.querySelectorAll('#content .text[contenteditable="true"]')) as HTMLElement[];
  const spanned = blocks.filter((b) => {
    const br = rect(b);
    return selRects.some((sr) => {
      const w = Math.min(sr.l + sr.w, br.l + br.w) - Math.max(sr.l, br.l);
      const h = Math.min(sr.t + sr.h, br.t + br.h) - Math.max(sr.t, br.t);
      return w > 0 && h > 0;
    });
  }).length;

  const xsel = Array.from(document.querySelectorAll('#content .text.ju-xsel')) as HTMLElement[];
  const xselDesc = xsel.map((el) => {
    const cs = getComputedStyle(el);
    return {
      id: String(el.dataset.id || ''), bgColor: cs.backgroundColor, bgImage: cs.backgroundImage,
      boxShadow: cs.boxShadow, rect: rect(el),
      paints: colorsOf(cs.backgroundImage).some(vis) || vis(parseC(cs.backgroundColor))
        || (cs.boxShadow !== 'none' && colorsOf(cs.boxShadow).some(vis)),
    };
  });
  const rowsSel = Array.from(document.querySelectorAll('#content .row.sel, #content .row.multi-sel')) as HTMLElement[];
  const rowDesc = rowsSel.map((el) => {
    const cs = getComputedStyle(el);
    return {
      cls: String(el.className || ''), bg: cs.backgroundColor, bgImage: cs.backgroundImage,
      paints: vis(parseC(cs.backgroundColor)) || colorsOf(cs.backgroundImage).some(vis),
    };
  });

  const firstText = document.querySelector('#content .text[contenteditable="true"]') as HTMLElement | null;
  const active = document.activeElement as HTMLElement | null;
  const actCs = active ? getComputedStyle(active) : null;

  return {
    selText: text,
    selTextLen: text.length,
    selHasNewline: /[\r\n]/.test(text),
    spanned,
    xselCount: xselDesc.length,
    xsel: xselDesc,
    rowSelCount: rowDesc.length,
    rowSel: rowDesc,
    overlayPainted: xselDesc.filter((x) => x.paints).length + rowDesc.filter((r) => r.paints).length,
    textSel: pseudo(firstText),
    xselSel: pseudo(xsel.length ? xsel[0] : null),
    anchorSel: pseudo(sel && sel.anchorNode ? (sel.anchorNode.nodeType === 1 ? (sel.anchorNode as Element) : (sel.anchorNode.parentElement as Element)) : null),
    model: (window as any).__juXsel && typeof (window as any).__juXsel.describe === 'function' ? (window as any).__juXsel.describe() : null,
    caret: {
      isText: !!(active && active.classList && active.classList.contains('text')),
      color: actCs ? actCs.caretColor : null,
      hidden: !!(actCs && (/transparent/i.test(actCs.caretColor) || /rgba\(0,\s*0,\s*0,\s*0\)/.test(actCs.caretColor))),
      parsed: actCs ? parseC(actCs.caretColor) : null,
    },
  };
};

const isTransparent = (s: string | null) => !s || /rgba\(0,\s*0,\s*0,\s*0\)|transparent/i.test(String(s));
const isGreen = (p: any) => !!p && p.a > 0.02 && p.g > p.b + 10 && p.g >= p.r - 20;
const isBlue = (p: any) => !!p && p.a > 0.02 && p.b > 150 && (p.b - Math.max(p.r, p.g)) > 40;

test.describe('v2.1 fix12 · 大纲拖选 · 选区单层化（绿色 == 选区）', () => {
  test('横向拖选部分文字：行底与 .ju-xsel 均零绘制，只有被选中的几个字有产品绿', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      const n = await buildRows(page);
      expect(n, '必须能建立 ≥2 行正文用于拖选').toBeGreaterThanOrEqual(2);

      await clickRow(page, 0);
      await dragHorizontalPartial(page);
      const r: any = await page.evaluate(READ);

      expect(r.selTextLen, '横向拖选必须真的选中文字').toBeGreaterThan(0);
      expect(r.selTextLen, '横向拖选只应选中几个字（不是整行）').toBeLessThan(12);

      /* ① 行容器：允许存在（焦点行标记），但底色必须透明 */
      for (const row of r.rowSel) {
        expect(isTransparent(row.bg), `行容器 ${row.cls} 底色必须透明（实测 ${row.bg}）`).toBe(true);
        expect(row.bgImage, `行容器 ${row.cls} 不得有背景图/渐变`).toBe('none');
      }
      /* ② .ju-xsel：横向拖选（单宿主）通常不产生；若产生则必须透明且无渐变/描边 */
      for (const x of r.xsel) {
        expect(isTransparent(x.bgColor), `.ju-xsel 背景必须透明（实测 ${x.bgColor}）`).toBe(true);
        expect(x.bgImage, '.ju-xsel background-image 必须为 none').toBe('none');
        expect(x.boxShadow, '.ju-xsel box-shadow 必须为 none').toBe('none');
      }
      /* ③ 唯一的绿色来源：原生 ::selection */
      expect(r.textSel, '必须能读到 .text::selection').not.toBeNull();
      expect(isGreen(r.textSel.parsed), `.text::selection 必须是产品绿（实测 ${r.textSel.bg}）`).toBe(true);
      expect(isBlue(r.textSel.parsed), '.text::selection 不得为蓝色').toBe(false);

      /* ④ 叠加层零绘制（横向：只有焦点行类存在，但不得绘制） */
      expect(r.overlayPainted, '横向拖选不得有任何块级/行级底色绘制').toBe(0);

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('竖向拖选多行：行底与 .ju-xsel 零绘制，选区文本非空且跨宿主钳制已登记', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      const n = await buildRows(page);
      expect(n, '必须能建立 ≥2 行正文用于拖选').toBeGreaterThanOrEqual(2);

      await clickRow(page, 1);
      await dragVerticalMultiRow(page);
      const r: any = await page.evaluate(READ);

      /* ① 行容器（.row.sel 是焦点行标记）必须零绘制 */
      expect(r.rowSelCount, '选中行容器应存在（.row.sel 类不清除）').toBeGreaterThan(0);
      for (const row of r.rowSel) {
        expect(isTransparent(row.bg), `行容器 ${row.cls} 底色必须透明（实测 ${row.bg}）`).toBe(true);
        expect(row.bgImage, `行容器 ${row.cls} 不得有背景图/渐变`).toBe('none');
      }
      /* ② 跨行选区模型的 .ju-xsel 必须零绘制 */
      expect(r.xselCount, '跨行拖选应由产品选区模型覆盖 ≥2 块').toBeGreaterThanOrEqual(2);
      for (const x of r.xsel) {
        expect(isTransparent(x.bgColor), `.ju-xsel 背景必须透明（实测 ${x.bgColor}）`).toBe(true);
        expect(x.bgImage, '.ju-xsel background-image 必须为 none').toBe('none');
        expect(x.boxShadow, '.ju-xsel box-shadow 必须为 none').toBe('none');
      }
      expect(r.overlayPainted, '竖向拖选不得有任何块级/行级底色绘制').toBe(0);

      /* ③ window.getSelection() 必须有内容 */
      expect(r.selTextLen, 'window.getSelection() 必须有选中文本').toBeGreaterThan(0);
      expect(String(r.selText).length, '选区文本不得为空').toBeGreaterThan(0);

      /* ④ 引擎钳制登记（不臆断）：Blink 把原生 Selection 钳在单个 contenteditable 宿主内
         （90过程材料/tmp_compare/fix7/richtext_capability.log: SINGLE_HOST_CLAMPED）。
         · 若浏览器能跨宿主 ⇒ 选区应真实跨越 ≥2 块、且文本含换行；
         · 若被钳制（当前实测）⇒ 选区块数 == 1、文本不含换行，此时跨行范围由产品模型承载，
           covered 必须 ≥2（否则「跨行选区」= 假象，Node 多选或模型失效，必须失败）。 */
      if (r.selHasNewline) {
        expect(r.spanned, '原生选区含换行时应真实跨越 ≥2 个正文块').toBeGreaterThanOrEqual(2);
      } else {
        expect(r.spanned, '原生选区被钳制时应只覆盖 1 个正文块').toBe(1);
        expect(r.model, '跨行选区模型必须存在（window.__juXsel）').not.toBeNull();
        expect(r.model.covered, '被钳制时产品模型必须覆盖 ≥2 块，否则跨行选区是假象').toBeGreaterThanOrEqual(2);
      }

      /* ⑤ 绿色仍在（来自 ::selection），不是「全透明什么都看不见」 */
      const greenPseudo = [r.textSel, r.xselSel, r.anchorSel].filter((p: any) => p && isGreen(p.parsed));
      expect(greenPseudo.length, '至少一处 ::selection 必须是可见产品绿（选区不能不可见）').toBeGreaterThan(0);

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('::selection 是唯一绿色来源：.text 与 .text.ju-xsel 同色，无其他颜色背景', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      await buildRows(page);
      await clickRow(page, 1);
      await dragVerticalMultiRow(page);
      const r: any = await page.evaluate(READ);

      expect(r.textSel, '必须能读到 .text::selection').not.toBeNull();
      expect(r.xselSel, '跨行块必须能读到 .text.ju-xsel::selection').not.toBeNull();

      /* 同色（消除「块内透明 ⇒ 深一块浅一块」的双层叠加） */
      expect(r.xselSel.bg, '.text.ju-xsel::selection 必须与 .text::selection 同色').toBe(r.textSel.bg);
      expect(isGreen(r.textSel.parsed), `.text::selection 必须是产品绿（实测 ${r.textSel.bg}）`).toBe(true);
      expect(isGreen(r.xselSel.parsed), `.text.ju-xsel::selection 必须是产品绿（实测 ${r.xselSel.bg}）`).toBe(true);
      expect(isBlue(r.textSel.parsed), '::selection 不得为蓝色').toBe(false);
      expect(isBlue(r.xselSel.parsed), '::selection 不得为蓝色').toBe(false);

      /* 除 ::selection 外，块级/行级不得有任何颜色背景（否则就是第二层） */
      const paintedXsel = r.xsel.filter((x: any) => x.paints).map((x: any) => x.id);
      const paintedRow = r.rowSel.filter((x: any) => x.paints).map((x: any) => x.cls);
      expect(paintedXsel, '不得存在绘制的 .ju-xsel 块').toEqual([]);
      expect(paintedRow, '不得存在绘制的选中行').toEqual([]);

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('光标：caret-color 仍为产品绿且可见（单层化不得牺牲光标）', async ({ browser }) => {
    const { context, page, pageErrors } = await openApp(browser);
    try {
      await gotoOutline(page);
      await buildRows(page);

      const target = page.locator(ROWS).first();
      await target.click();
      await page.keyboard.press('End');
      await page.keyboard.type(' 光标可见 FIX12', { delay: 8 });
      await page.waitForTimeout(250);

      const r: any = await page.evaluate(READ);
      expect(r.caret.isText, 'activeElement 必须是正文块 .text').toBe(true);
      expect(r.caret.color, 'caret-color 必须有具体值').toBeTruthy();
      expect(r.caret.hidden, 'caret-color 不得为透明（光标必须可见）').toBe(false);
      expect(isGreen(r.caret.parsed), `caret-color 必须是产品绿（实测 ${r.caret.color}）`).toBe(true);

      /* 输入真实落到正文 DOM（产品在 blur 时提交 state，见 views/outline.ts） */
      const domText = await page.evaluate((sel) => {
        const t = document.querySelector(sel) as HTMLElement | null;
        return String((t && t.textContent) || '');
      }, ROWS);
      expect(domText, '键盘输入必须真实落到正文 DOM').toContain('光标可见 FIX12');

      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
