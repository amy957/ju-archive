import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix17 · 右侧边栏列表项「图标 / 文字」左对齐 + 视觉密度
 *
 * 缺陷（P0 取证：90过程材料/tmp/fix17/rightbar_align_before.log，对 fix16 发布产物
 * sha256 eba32175…2a83，Edge 真窗口 file://，1440×1000 大纲视图实测）：
 *   · 右栏 `.sr-btn`：padding 6px 12px、行高 33.156px、图标列相对行缘 12px；
 *     左栏 `.sb-row`：padding 3px 8px、行高 25.922px、图标列相对行缘 8px
 *     ⇒ 同屏左右两栏视觉密度不一致（右栏行高多 7.234px、图标列多内缩 4px）；
 *   · 「安全与星级」锁图标列比操作行图标列左偏 2px（右栏三处不在同一条竖线上）。
 *
 * 修复（src/style.css 追加覆盖，既有规则一行未改）：
 *   · `#sidebarRight .sr-body .sr-btn`：display:flex / align-items:center / gap:8px /
 *     padding:3px 8px / box-sizing:border-box / line-height:1.6 / text-align:left
 *     ⇒ 行高 25.92px 与左侧 `.sb-row` 逐像素一致；
 *   · `.ic` 固定 15px（= `.sb-icon`），不同 viewBox 的 SVG 不再改变文字起点；
 *   · 折叠头 chev / 星级锁 / 操作行图标统一到同一条 8px 内层列。
 *
 * 承载方式与 fix13/fix15/fix16 spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
 * 全部断言基于真实浏览器里的 getBoundingClientRect() / Range 实测值（非推算、非夹具回填）。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:5173';

/** 对齐容差（px）：任务书 P2 要求 ≤ 1px */
const TOL = 1;

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

/** 一个列表项的实测几何（Range 实测文字左缘，不做 padding 推算） */
interface RowMetric {
  text: string;
  iconLeft: number;
  iconWidth: number;
  textLeft: number;
  height: number;
  paddingTop: number;
  paddingLeft: number;
  gap: string;
  hasIcon: boolean;
}

let DIST: string | null = null;

async function ensureDist(): Promise<string> {
  if (DIST) return DIST;
  await build({ root: ROOT, logLevel: 'silent' });
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  DIST = dist;
  return DIST;
}

async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE) return route.continue();
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
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

async function openApp(page: Page): Promise<void> {
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => {
    const J = (window as any).JU;
    return !!(J && typeof J.getState === 'function' && typeof J.renderMain === 'function' && J.actions);
  }, null, { timeout: 60_000, polling: 25 });
  await page.waitForTimeout(400);
}

/**
 * 进入大纲视图（真实点顶栏 data-view="outline"，走产品 bindTopbar 处理器）
 * 并确保右侧边栏可见、所有分组展开（真实点折叠头）。
 */
async function gotoOutlineWithRightbar(page: Page): Promise<void> {
  const btn = page.locator('#tbNav .tb-nav-btn[data-view="outline"]').first();
  await expect(btn, '顶栏必须有大纲入口').toHaveCount(1, { timeout: 20_000 });
  await btn.click();
  await expect(page.locator('#content .outline'), '大纲视图必须渲染 .outline').toHaveCount(1, { timeout: 30_000 });

  /* 右栏若处于收起态，真实点折叠钮展开 */
  const collapsed = await page.evaluate(() => {
    const sb = document.getElementById('sidebarRight');
    return !!sb && sb.classList.contains('collapsed');
  });
  if (collapsed) {
    const tog = page.locator('#btnToggleRight').first();
    await expect(tog, '右栏收起时必须存在展开钮').toHaveCount(1, { timeout: 10_000 });
    await tog.click();
    await page.waitForTimeout(400);
  }
  await expect(page.locator('#sidebarRight'), '右侧边栏必须可见').toBeVisible({ timeout: 10_000 });

  /* 展开全部折叠分组（真实点 .sr-title） */
  const collapsedTitles = await page.evaluate(() =>
    [...document.querySelectorAll('#sidebarRight .sr-section.collapsed .sr-title')].map((t) =>
      String(t.textContent || '').replace(/[▼▶]/g, '').replace(/\s+/g, ' ').trim()));
  for (const t of collapsedTitles) {
    await page.locator('#sidebarRight .sr-section.collapsed .sr-title').filter({ hasText: t }).first().click();
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(300);
}

/** 读某右侧栏分组（按折叠头文本定位）内全部 `.sr-btn` 的实测几何 */
async function measureRightGroup(page: Page, title: string): Promise<RowMetric[]> {
  return page.evaluate((groupTitle) => {
    const norm = (s: string) => String(s || '').replace(/[▼▶]/g, '').replace(/\s+/g, ' ').trim();
    const sec = [...document.querySelectorAll('#sidebarRight .sr-section')].find(
      (s) => norm((s.querySelector('.sr-title') as HTMLElement | null)?.textContent || '') === groupTitle,
    ) as HTMLElement | undefined;
    if (!sec) return [];
    const body = sec.querySelector('.sr-body') as HTMLElement | null;
    if (!body) return [];
    return [...body.querySelectorAll('.sr-btn')].map((el) => {
      const row = el as HTMLElement;
      const icon = row.querySelector('.ic') as HTMLElement | null;
      const ir = icon ? icon.getBoundingClientRect() : null;
      let textLeft = NaN;
      for (const n of [...row.childNodes]) {
        if (n.nodeType === 3 && String(n.textContent || '').trim() !== '') {
          const r = document.createRange();
          r.selectNodeContents(n);
          textLeft = r.getBoundingClientRect().left;
          break;
        }
      }
      const er = row.getBoundingClientRect();
      const cs = getComputedStyle(row);
      return {
        text: String(row.textContent || '').trim(),
        iconLeft: ir ? ir.left : NaN,
        iconWidth: ir ? ir.width : NaN,
        textLeft,
        height: er.height,
        paddingTop: parseFloat(cs.paddingTop),
        paddingLeft: parseFloat(cs.paddingLeft),
        gap: cs.gap,
        hasIcon: !!icon,
      };
    });
  }, title);
}

/** 极差（max - min）：对齐断言的核心量 */
function spread(vals: number[]): number {
  const a = vals.filter((v) => typeof v === 'number' && isFinite(v));
  expect(a.length, '统计样本不得为空').toBeGreaterThan(0);
  return Math.max(...a) - Math.min(...a);
}

/** 读左侧栏真实 `.sb-row`（含 .sb-label 的行）的实测几何，作为视觉密度基线 */
async function measureLeftRows(page: Page): Promise<RowMetric[]> {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('#sidebarLeft .sb-row')].filter(
      (r) => (r.querySelector('.sb-label') as HTMLElement | null) && String(r.textContent || '').trim() !== '',
    ) as HTMLElement[];
    return rows.map((row) => {
      const icon = row.querySelector('.sb-icon') as HTMLElement | null;
      const ir = icon ? icon.getBoundingClientRect() : null;
      const lab = row.querySelector('.sb-label') as HTMLElement | null;
      const lr = lab ? lab.getBoundingClientRect() : null;
      const er = row.getBoundingClientRect();
      const cs = getComputedStyle(row);
      return {
        text: String(row.textContent || '').trim(),
        iconLeft: ir ? ir.left : NaN,
        iconWidth: ir ? ir.width : NaN,
        textLeft: lr ? lr.left : NaN,
        height: er.height,
        paddingTop: parseFloat(cs.paddingTop),
        paddingLeft: parseFloat(cs.paddingLeft),
        gap: cs.gap,
        hasIcon: !!icon,
      };
    });
  });
}

/**
 * fix17-patch1 新增口径：分区标题「文字」左缘 ↔ 其下内容左缘。
 * 全部用 Range / getBoundingClientRect 实测，不做 padding 推算；标题文字取 .sr-title 内最后一个非空文本节点
 * （.sr-title 结构为 `<span class="chev">▼</span>标题文字`，标题文字并不从 padding 边缘起排）。
 */
async function measureTitleVsContent(page: Page): Promise<{
  starTitleLeft: number;
  lockLeft: number;
  firstStarLeft: number;
  linksTitleLeft: number;
  linksBodyTextLeft: number;
  linksBodyKind: string;
  btnIconLeft: number;
}> {
  return page.evaluate(() => {
    const norm = (s: string) => String(s || '').replace(/[▼▶]/g, '').replace(/\s+/g, ' ').trim();
    const left = (node: Node | null): number => {
      if (!node) return NaN;
      const r = document.createRange();
      try { r.selectNodeContents(node); } catch (e) { return NaN; }
      const b = r.getBoundingClientRect();
      return b.width > 0 || b.height > 0 ? b.left : NaN;
    };
    const lastTextNode = (el: Element | null): Node | null => {
      if (!el) return null;
      for (const n of [...[...el.childNodes]].reverse()) {
        if (n.nodeType === 3 && String(n.textContent || '').trim() !== '') return n;
      }
      return null;
    };
    const secOf = (kw: string): HTMLElement | undefined =>
      [...document.querySelectorAll('#sidebarRight .sr-section')].find(
        (s) => norm((s.querySelector('.sr-title') as HTMLElement | null)?.textContent || '').indexOf(kw) === 0,
      ) as HTMLElement | undefined;

    const star = secOf('安全与星级');
    const links = secOf('链接 / 反链');
    const expand = secOf('展开 / 收起');

    const starTitleLeft = star ? left(lastTextNode(star.querySelector('.sr-title'))) : NaN;
    const lock = star ? (star.querySelector('.sr-lock') as HTMLElement | null) : null;
    const firstStar = star ? (star.querySelector('.sr-stars .star') as HTMLElement | null) : null;

    const linksTitleLeft = links ? left(lastTextNode(links.querySelector('.sr-title'))) : NaN;
    const box = links ? (links.querySelector('#srBacklinks') as HTMLElement | null) : null;
    const head = box ? (box.querySelector('.bl-group-head') as HTMLElement | null) : null;
    const empty = box ? (box.querySelector('.bl-empty') as HTMLElement | null) : null;
    const hint = box ? (box.querySelector('.bl-hint') as HTMLElement | null) : null;
    const bodyEl = head || empty || hint;
    const expandIc = expand ? (expand.querySelector('.sr-btn .ic') as HTMLElement | null) : null;

    return {
      starTitleLeft,
      lockLeft: lock ? lock.getBoundingClientRect().left : NaN,
      firstStarLeft: firstStar ? firstStar.getBoundingClientRect().left : NaN,
      linksTitleLeft,
      linksBodyTextLeft: bodyEl ? left(bodyEl) : NaN,
      linksBodyKind: head ? 'bl-group-head' : empty ? 'bl-empty' : hint ? 'bl-hint' : 'none',
      btnIconLeft: expandIc ? expandIc.getBoundingClientRect().left : NaN,
    };
  });
}

test.describe('v2.1 fix17 · 右侧边栏列表项左对齐与视觉密度', () => {
  let dist = '';

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    dist = await ensureDist();
  });

  test('1) 右侧边栏「保存 / 下载」组内图标左边缘误差 ≤ 1px', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    await gotoOutlineWithRightbar(page);

    const rows = await measureRightGroup(page, '保存 / 下载');
    console.log('[fix17-1] 保存/下载 组行数:', rows.length, JSON.stringify(rows.map((r) => ({ t: r.text, i: r.iconLeft, w: r.iconWidth }))));
    expect(rows.length, '「保存 / 下载」必须至少有 5 个操作行').toBeGreaterThanOrEqual(5);
    expect(rows.every((r) => r.hasIcon), '每个操作行都必须有图标容器 .ic').toBe(true);

    /* ① 组内图标左边缘一致 */
    expect(spread(rows.map((r) => r.iconLeft)), '「保存 / 下载」组内图标左边缘误差必须 ≤ 1px').toBeLessThanOrEqual(TOL);
    /* ② 图标盒宽度固定（不同 viewBox 的 SVG 不得改变排版） */
    expect(spread(rows.map((r) => r.iconWidth)), '图标盒宽度必须固定（误差 ≤ 1px）').toBeLessThanOrEqual(TOL);

    /* ③ 与「展开 / 收起」组同列 */
    const expandRows = await measureRightGroup(page, '展开 / 收起');
    expect(expandRows.length, '「展开 / 收起」必须至少有 4 个操作行').toBeGreaterThanOrEqual(4);
    expect(spread(expandRows.map((r) => r.iconLeft)), '「展开 / 收起」组内图标左边缘误差必须 ≤ 1px').toBeLessThanOrEqual(TOL);
    const iconCols = [rows[0].iconLeft, expandRows[0].iconLeft];
    expect(spread(iconCols), '两组操作行图标必须落在同一列（误差 ≤ 1px）').toBeLessThanOrEqual(TOL);
  });

  test('2) 右侧边栏「保存 / 下载」组内文字左边缘误差 ≤ 1px', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    await gotoOutlineWithRightbar(page);

    const rows = await measureRightGroup(page, '保存 / 下载');
    console.log('[fix17-2] 保存/下载 组文字左缘:', JSON.stringify(rows.map((r) => ({ t: r.text, x: r.textLeft }))));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.every((r) => isFinite(r.textLeft)), '每行都必须能测到文字节点左缘').toBe(true);

    /* ① 组内文字左边缘一致 */
    expect(spread(rows.map((r) => r.textLeft)), '「保存 / 下载」组内文字左边缘误差必须 ≤ 1px').toBeLessThanOrEqual(TOL);

    /* ② 图标→文字间距一致（保证不是靠不同的图标宽度凑出来的对齐） */
    const gaps = rows.map((r) => r.textLeft - (r.iconLeft + r.iconWidth));
    expect(spread(gaps), '图标右缘到文字左缘的间距必须一致（误差 ≤ 1px）').toBeLessThanOrEqual(TOL);

    /* ③ 「展开 / 收起」组文字左缘同样一致，且与「保存 / 下载」同一列 */
    const expandRows = await measureRightGroup(page, '展开 / 收起');
    expect(spread(expandRows.map((r) => r.textLeft)), '「展开 / 收起」组内文字左边缘误差必须 ≤ 1px').toBeLessThanOrEqual(TOL);
    expect(spread([rows[0].textLeft, expandRows[0].textLeft]), '两组操作行文字必须落在同一列（误差 ≤ 1px）').toBeLessThanOrEqual(TOL);
  });

  test('3) 右栏操作行视觉密度与左侧 .sb-row 一致（行高 / padding / gap / 图标宽）', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    await gotoOutlineWithRightbar(page);

    /* 真实 actions.createDoc：让左侧导航出现真实 .sb-row 行作为密度基线 */
    await page.evaluate(() => {
      const J: any = (window as any).JU;
      J.actions.createDoc('fix17 密度基线文档');
    });
    await page.waitForTimeout(600);

    const right = await measureRightGroup(page, '保存 / 下载');
    const left = await measureLeftRows(page);
    console.log('[fix17-3] right:', JSON.stringify(right.slice(0, 3)), '\n[fix17-3] left:', JSON.stringify(left.slice(0, 3)));
    expect(right.length).toBeGreaterThanOrEqual(5);
    expect(left.length, '创建文档后左侧栏必须出现真实 .sb-row 行').toBeGreaterThanOrEqual(1);

    const r = right[0];
    const l = left[0];

    /* 行高：右栏不再比左栏高（before 实测 33.156 vs 25.922，差 7.234px） */
    expect(spread(right.map((x) => x.height)), '右栏组内行高必须一致（误差 ≤ 1px）').toBeLessThanOrEqual(TOL);
    expect(Math.abs(r.height - l.height), '右栏行高必须与左栏 .sb-row 一致（误差 ≤ 1px）').toBeLessThanOrEqual(TOL);

    /* 内边距 / gap / 图标宽：逐值与左栏对齐 */
    expect(Math.abs(r.paddingTop - l.paddingTop), '上下内边距必须与左栏一致（误差 ≤ 1px）').toBeLessThanOrEqual(TOL);
    expect(Math.abs(r.paddingLeft - l.paddingLeft), '左右内边距必须与左栏一致（误差 ≤ 1px）').toBeLessThanOrEqual(TOL);
    expect(r.gap, '图标与文字的 gap 必须与左栏一致').toBe(l.gap);
    expect(Math.abs(r.iconWidth - l.iconWidth), '图标盒宽度必须与左栏 .sb-icon 一致（误差 ≤ 1px）').toBeLessThanOrEqual(TOL);

    /* 星级锁图标与操作行图标列对齐（before 实测左偏 2px） */
    const starLockIcon = await page.evaluate(() => {
      const norm = (s: string) => String(s || '').replace(/[▼▶]/g, '').replace(/\s+/g, ' ').trim();
      const sec = [...document.querySelectorAll('#sidebarRight .sr-section')].find(
        (s) => norm((s.querySelector('.sr-title') as HTMLElement | null)?.textContent || '') === '安全与星级',
      ) as HTMLElement | undefined;
      const lock = sec ? (sec.querySelector('.sr-lock') as HTMLElement | null) : null;
      return lock ? lock.getBoundingClientRect().left : NaN;
    });
    expect(isFinite(starLockIcon), '「安全与星级」必须存在锁图标').toBe(true);
    expect(Math.abs(starLockIcon - r.iconLeft), '星级锁图标必须与操作行图标同列（误差 ≤ 1px）').toBeLessThanOrEqual(TOL);
  });

  /**
   * 【fix17-patch1 新增 2 条断言】分区标题文字 ↔ 其下内容的左边缘对齐。
   *
   * 缺陷（90过程材料/tmp/fix17-patch1/right_panel_indent_before.log，1440×1000，Edge 真窗口）：
   *   · 标题文字左缘 1244.2 = .sr-title padding-left 8 + chev 宽 10.2 + gap 6；
   *   · 其下内容左缘 1228（星级行 / 操作行）、1226（「链接 / 反链」正文 .bl-group-head）
   *     ⇒ 内容整体比标题文字**左偏** 16.2px / 18.2px，视觉上「内容悬挂在标题文字左边」。
   * 修复后（right_panel_indent_after.log）：1244.19 / 1244.19，误差 0.01px。
   */
  test('4) 分区标题文字与其下内容左边缘对齐（误差 ≤ 1px）', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    await gotoOutlineWithRightbar(page);

    /* 真实产品动作建一个文档：让「链接 / 反链」进入「有当前文档」分支（出现「出链」组标题） */
    await page.evaluate(() => {
      const J: any = (window as any).JU;
      J.actions.createDoc('fix17-patch1 缩进对齐断言文档');
    });
    await page.waitForTimeout(700);

    const m = await measureTitleVsContent(page);
    console.log('[fix17-patch1-4]', JSON.stringify(m));

    expect(isFinite(m.starTitleLeft), '「安全与星级」标题必须有可测文本节点').toBe(true);
    expect(isFinite(m.lockLeft), '「安全与星级」必须有锁图标').toBe(true);
    expect(isFinite(m.linksTitleLeft), '「链接 / 反链」标题必须有可测文本节点').toBe(true);
    expect(isFinite(m.linksBodyTextLeft), '「链接 / 反链」正文必须有可测文本（实际取到 ' + m.linksBodyKind + '）').toBe(true);

    /* 断言 ①：「安全与星级」标题文字 ↔ 星级行首图标（锁）左边缘差 ≤ 1px */
    expect(
      Math.abs(m.starTitleLeft - m.lockLeft),
      '「安全与星级」标题文字与星级行首图标左边缘误差必须 ≤ 1px（实测 ' + m.starTitleLeft + ' vs ' + m.lockLeft + '）',
    ).toBeLessThanOrEqual(TOL);

    /* 断言 ②：「链接 / 反链」标题文字 ↔ 其下正文文字左边缘差 ≤ 1px */
    expect(
      Math.abs(m.linksTitleLeft - m.linksBodyTextLeft),
      '「链接 / 反链」标题文字与其下正文文字左边缘误差必须 ≤ 1px（实测 ' + m.linksTitleLeft + ' vs ' + m.linksBodyTextLeft + '）',
    ).toBeLessThanOrEqual(TOL);

    /* 记录（不作判定）：星标首字符必然排在锁图标之后（锁 24 + gap 10），故与标题文字相距约 34px */
    console.log('[fix17-patch1-4] 首个星标左缘 =', m.firstStarLeft, ' 相对标题文字 =', m.firstStarLeft - m.starTitleLeft);
  });
});
