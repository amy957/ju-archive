import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * v2.1 · fix26 · 顶栏禁用态 / 各视图标题同轴 / 悬浮日历空日无圆点 / 右栏折叠标题居中
 * 承载：vite build 产物 + context.route 映射到 http://localhost:5173（与 fix17 / fix23 同口径）。
 * 断言全部基于真实浏览器里的 class / getComputedStyle / getBoundingClientRect 实测值。
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:5173';
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

test('fix26 · 资料库置灰 / 标题居中 / 空日无圆点 / 侧栏折叠标题居中', async ({ browser }) => {
  test.setTimeout(300_000);
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--logLevel', 'silent'], { cwd: ROOT, stdio: 'pipe' });
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await ctx.route(BASE + '/**', async (r) => {
    const p = new URL(r.request().url()).pathname;
    const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p));
    try { return r.fulfill({ status: 200, contentType: MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', body: await fsp.readFile(f) }); }
    catch { return r.fulfill({ status: 404, body: 'not found' }); }
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const w = window as any; return !!(w.JU && w.JU.actions && typeof w.JU.actions.createDoc === 'function'); }, null, { timeout: 60_000 });
  await page.evaluate(() => { const J: any = (window as any).JU; const id = J.actions.createDoc('fix26 探针文档'); if (id && J.actions.setCurrentDoc) J.actions.setCurrentDoc(id); if (J.forceRender) J.forceRender(); });
  await page.waitForTimeout(800);

  /* ① 顶栏「资料库」：选中文档（点击恒为 no-op）时必须带 disabled 类且外观为禁用灰 */
  const lib = await page.evaluate(() => {
    const b = document.querySelector('#tbNav .tb-nav-btn[data-view="document"]') as HTMLElement | null;
    if (!b) return null; const cs = getComputedStyle(b);
    return { disabled: b.classList.contains('disabled'), cursor: cs.cursor, opacity: Number(cs.opacity) };
  });
  expect(lib, '顶栏「资料库」按钮必须存在').not.toBeNull();
  expect(lib!.disabled, '「资料库」不可点击时必须带 disabled 类').toBe(true);
  expect(lib!.cursor, '禁用态 cursor 必须为 not-allowed').toBe('not-allowed');
  expect(lib!.opacity, '禁用态透明度必须与「大纲」禁用态同值 0.4').toBeCloseTo(0.4, 2);
  /* ② 各视图标题中心点与标题行中心点偏差 ≤ 1px，且横线 .doc-header-line 宽度与大纲误差 ≤ 1px */
  let maxDev = 0;
  /* 【fix26-p3】同时采集：标题字号 / 标题中心点 / 横线宽高与颜色 / 星标（占位）右缘，逐项与大纲对齐 */
  const measure = () => page.evaluate(() => {
    const bar = document.querySelector('#content .doc-header, #content .files-toolbar') as HTMLElement | null;
    if (!bar) return null;
    const t = (bar.querySelector('.doc-header-title') || Array.from(bar.children).find((c) => c.tagName === 'DIV' && !c.classList.contains('files-toolbar'))) as HTMLElement | null;
    if (!t || !(t.textContent || '').trim()) return null;
    const br = bar.getBoundingClientRect(), tr = t.getBoundingClientRect();
    const ln = bar.querySelector('.doc-header-line') as HTMLElement | null;
    const st = bar.querySelector('.doc-header-stars') as HTMLElement | null;
    const lr = ln ? ln.getBoundingClientRect() : null;
    return {
      dev: Math.abs(br.left + br.width / 2 - (tr.left + tr.width / 2)),
      line: lr ? lr.width : -1,
      lineH: lr ? lr.height : -1,
      lineColor: ln ? getComputedStyle(ln).backgroundColor : '',
      fs: parseFloat(getComputedStyle(t).fontSize),
      cx: tr.left + tr.width / 2,
      cy: tr.top + tr.height / 2,
      barRight: br.right,
      stars: st ? st.getBoundingClientRect().right : null,
    };
  });
  const dev0 = await measure();
  expect(dev0, '视图标题行必须存在：document').not.toBeNull();
  maxDev = Math.max(maxDev, dev0!.dev);
  let baseLine = -1;
  const lineErr: string[] = [];
  const detail: Record<string, any> = {};
  for (const v of ['outline', 'mindmap', 'presentation', 'slides', 'graph', 'history']) {
    await page.locator(`#tbNav .tb-nav-btn[data-view="${v}"]`).first().click();
    await page.waitForTimeout(700);
    const m = await measure();
    expect(m, '视图标题行必须存在：' + v).not.toBeNull();
    detail[v] = m;
    maxDev = Math.max(maxDev, m!.dev);
    expect(m!.line, '视图必须含 .doc-header-line 横线元素：' + v).toBeGreaterThan(0);
    if (v === 'outline') baseLine = m!.line;
    else if (Math.abs(m!.line - baseLine) > 1) lineErr.push(`${v}=${m!.line.toFixed(2)} vs outline=${baseLine.toFixed(2)}`);
    /* fix26-p2：非资料库视图下「资料库」必须 disabled 且物理不可点，程序化 click 亦不得切换视图 */
    const libState = await page.evaluate(() => {
      const b = document.querySelector('#tbNav .tb-nav-btn[data-view="document"]') as HTMLElement | null;
      const J: any = (window as any).JU;
      if (!b || !J) return null;
      const before = J.ui().view; b.click();
      return { disabled: b.classList.contains('disabled'), pointerEvents: getComputedStyle(b).pointerEvents, before, after: J.ui().view };
    });
    expect(libState, '顶栏「资料库」按钮必须存在').not.toBeNull();
    expect(libState!.disabled, '非资料库视图下「资料库」必须置灰：' + v).toBe(true);
    expect(libState!.pointerEvents, '非资料库视图下「资料库」必须物理不可点：' + v).toBe('none');
    expect(libState!.after, '置灰后点击「资料库」不得切换视图：' + v).toBe(libState!.before);
  }
  expect(maxDev, '各视图标题中心点偏差必须 ≤1px').toBeLessThanOrEqual(1);
  expect(lineErr, '各视图横线宽度必须与大纲一致（误差 ≤1px）').toEqual([]);
  /* ②b fix26-p3：演示 / 图谱 / 历史强制复用大纲标准结构——字号、中轴、横线宽/高/色、星标位逐项与大纲 ≤1px */
  const o = detail['outline'];
  for (const v of ['presentation', 'graph', 'history']) {
    const m = detail[v];
    expect(m.fs, `标题字号必须与大纲一致：${v}`).toBeCloseTo(o.fs, 2);
    expect(Math.abs(m.cx - o.cx), `标题中心点 x 偏差必须 ≤1px：${v}`).toBeLessThanOrEqual(1);
    expect(Math.abs(m.cy - o.cy), `标题中轴 y 偏差必须 ≤1px：${v}`).toBeLessThanOrEqual(1);
    expect(Math.abs(m.line - o.line), `横线宽度必须与大纲一致（≤1px）：${v}`).toBeLessThanOrEqual(1);
    expect(Math.abs(m.lineH - o.lineH), `横线高度必须与大纲一致：${v}`).toBeLessThanOrEqual(1);
    expect(m.lineColor, `横线颜色必须与大纲一致：${v}`).toBe(o.lineColor);
    expect(m.stars, `${v}：.doc-header-stars（星标或占位）必须存在`).not.toBeNull();
    expect(Math.abs(m.stars! - m.barRight), `${v}：星标/占位必须贴标题行右缘（≤1px）`).toBeLessThanOrEqual(1);
  }

  /* ①b fix26-p1：ui.view=outline 与 auto 渲染同一大纲页 ⇒ 大纲视图下点「资料库」同样恒为 no-op，必须置灰且物理不可点 */
  await page.locator('#tbNav .tb-nav-btn[data-view="outline"]').first().click();
  await page.waitForTimeout(600);
  const libOutline = await page.evaluate(() => {
    const b = document.querySelector('#tbNav .tb-nav-btn[data-view="document"]') as HTMLElement | null;
    if (!b) return null; const cs = getComputedStyle(b);
    return { disabled: b.classList.contains('disabled'), pointerEvents: cs.pointerEvents };
  });
  expect(libOutline, '顶栏「资料库」按钮必须存在').not.toBeNull();
  expect(libOutline!.disabled, '大纲视图下「资料库」点击恒为 no-op，必须带 disabled 类').toBe(true);
  expect(libOutline!.pointerEvents, '禁用态必须物理不可点（pointer-events:none）').toBe('none');

  /* ③ fix26-p1：思维导图不再产出「重置布局」按钮（DOM 与事件绑定已删除） */
  await page.locator('#tbNav .tb-nav-btn[data-view="mindmap"]').first().click();
  await page.waitForTimeout(700);
  const mmBtn = await page.evaluate(() => ({
    cls: document.querySelectorAll('#content .mm-reset-btn').length,
    txt: Array.from(document.querySelectorAll('#content button')).filter((b) => (b.textContent || '').includes('重置布局')).length,
  }));
  expect(mmBtn.cls, '思维导图不得存在 .mm-reset-btn').toBe(0);
  expect(mmBtn.txt, '思维导图不得存在「重置布局」按钮').toBe(0);

  /* ④ 悬浮日历：无待办日期不包含 .fc-dot 元素，有待办日期恰有 1 个 */
  await page.locator('#btnFloatCal').first().click();
  await page.waitForTimeout(500);
  const fc = await page.evaluate(() => {
    const days = Array.from(document.querySelectorAll('#fcDays .fc-day')) as HTMLElement[];
    const hasDays = days.filter((d) => d.classList.contains('has'));
    return {
      total: days.length,
      emptyWithDot: days.filter((d) => !d.classList.contains('has') && !!d.querySelector('.fc-dot')).length,
      dotCount: document.querySelectorAll('#fcDays .fc-dot').length,
      hasCount: hasDays.length,
      hasWithoutDot: hasDays.filter((d) => d.querySelectorAll('.fc-dot').length !== 1).length,
    };
  });
  expect(fc.total, '悬浮日历必须渲染出日期格').toBeGreaterThan(0);
  expect(fc.emptyWithDot, '无待办日期不得包含圆点元素').toBe(0);
  expect(fc.hasWithoutDot, '有待办日期必须恰有 1 个圆点').toBe(0);
  expect(fc.dotCount, '圆点数量必须等于有待办日期数').toBe(fc.hasCount);

  /* ④ 右栏折叠态分区标题：上下 padding 相等、标题下外边距归零、上下留白差 ≤1px */
  const sec = await page.evaluate(() => {
    const s = document.querySelector('#sidebarRight .sr-section') as HTMLElement | null;
    if (!s) return null;
    const t = s.querySelector('.sr-title') as HTMLElement | null;
    if (!t) return null;
    if (!s.classList.contains('collapsed')) t.click();
    const cs = getComputedStyle(s), ct = getComputedStyle(t);
    const sr = s.getBoundingClientRect(), tr = t.getBoundingClientRect();
    return { pt: parseFloat(cs.paddingTop), pb: parseFloat(cs.paddingBottom), mb: parseFloat(ct.marginBottom), top: tr.top - sr.top, bottom: sr.bottom - parseFloat(cs.borderBottomWidth) - tr.bottom };
  });
  expect(sec, '右栏分区必须存在').not.toBeNull();
  expect(sec!.pt, '折叠标题上下 padding 必须相等').toBe(sec!.pb);
  expect(sec!.mb, '折叠标题下外边距必须归零').toBe(0);
  expect(Math.abs(sec!.top - sec!.bottom), '折叠标题上下留白差必须 ≤1px').toBeLessThanOrEqual(1);
  await ctx.close();
});
