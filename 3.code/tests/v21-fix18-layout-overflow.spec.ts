import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix18 · 布局溢出 + 左下角图标脱离侧栏
 *
 * 缺陷（P0 取证：90过程材料/tmp/fix18/layout_before.log；对 fix17 发布产物
 * sha256 ab64f774…460a，Edge 真窗口 file:// 打开，视口 1200×800，27 项 24 OK / 3 FAIL）：
 *   ① **左下角图标脱离侧栏**：真实点 #btnToggleLeft 收起左侧栏后 #sidebarLeft 实测
 *      width=0 / offsetWidth=0，但 `.sb-tools` 被 `body.sb-left-collapsed .sb-tools{position:fixed}`
 *      （fix5·D-10）钉成 position:fixed，rect=[0,743,201,57]、背景 rgb(202,211,195)+上/右边框，
 *      四个按钮 [8,752,40,40]/[56,…]/[104,…]/[152,…] 全部浮在**视口左下角**，
 *      与已收起的侧栏不再有任何几何关系（insideGeometric=false）。
 *   ② **视图显示不完整 / 截断**：图谱 `.graph-canvas` 容器 720×752，内部 `<svg>` 实测 800 宽
 *      （src/views/graph.ts 旧口径 `W=max(800, innerWidth-400)`）⇒ 容器
 *      scrollWidth 800 > clientWidth 720，视图内部出现 80px 横向滚动、右侧节点/连线被裁。
 *
 * 修复：
 *   · src/style.css 追加 fix18 覆盖段（既有规则一行未改）：
 *     桌面（≥769px）撤销「折叠态钉视口左下」，工具条回归 #sidebarLeft 内部最下方的
 *     footer 语义，侧栏宽度归零即随之隐藏；≤768px 抽屉态行为完整保留（fix6·D-11 零漂移）；
 *     `#main>#content{min-width:0;max-width:100%}` + 各视图根容器 `max-width:100%`。
 *   · src/views/graph.ts：画布尺寸改按 #content 内容盒实测计算（读不到才回退旧口径）。
 *
 * 承载方式与 fix13/fix15/fix16/fix17 spec 一致：`vite build` 产物 + `context.route` 映射到
 * http://localhost:5173；全部断言基于真实浏览器里的 getBoundingClientRect() / scrollWidth 实测值。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:5173';

/** 几何容差（px） */
const TOL = 1;
/** 取证口径视口（与 90过程材料/tmp/fix18/layout_probe.cjs 完全一致） */
const VIEW = { width: 1200, height: 800 };

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
  await page.setViewportSize(VIEW);
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => {
    const J = (window as any).JU;
    return !!(J && typeof J.getState === 'function' && typeof J.renderMain === 'function' && J.actions);
  }, null, { timeout: 60_000, polling: 25 });
  await page.waitForTimeout(400);
}

/** 真实点顶栏导航切换视图（走产品 bindTopbar 处理器），等目标根容器出现 */
async function switchView(page: Page, view: string, waitFor: string): Promise<void> {
  const btn = page.locator(`#tbNav .tb-nav-btn[data-view="${view}"]`).first();
  await expect(btn, `顶栏必须有「${view}」入口`).toHaveCount(1, { timeout: 20_000 });
  await btn.click();
  await expect(page.locator(waitFor), `视图 ${view} 必须渲染 ${waitFor}`).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(500);
}

/** 主内容区与文档级的横向溢出实测 */
async function measureHorizontal(page: Page) {
  return page.evaluate(() => {
    const content = document.getElementById('content') as HTMLElement | null;
    const main = document.getElementById('main') as HTMLElement | null;
    const de = document.documentElement;
    let boxWidth = NaN;
    if (content) {
      const cs = getComputedStyle(content);
      boxWidth = content.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    }
    return {
      innerWidth: window.innerWidth,
      docScrollWidth: de.scrollWidth,
      contentScrollWidth: content ? content.scrollWidth : NaN,
      contentClientWidth: content ? content.clientWidth : NaN,
      contentBoxWidth: boxWidth,
      contentWidth: content ? content.getBoundingClientRect().width : NaN,
      mainWidth: main ? main.getBoundingClientRect().width : NaN,
    };
  });
}

/** 左下角工具条的实测几何 + 可见性 + 结构归属 */
async function measureTools(page: Page) {
  return page.evaluate(() => {
    const tools = document.querySelector('.sb-tools') as HTMLElement | null;
    const sb = document.getElementById('sidebarLeft') as HTMLElement | null;
    if (!tools || !sb) return null;
    const tr = tools.getBoundingClientRect();
    const sr = sb.getBoundingClientRect();
    const cs = getComputedStyle(tools);
    const btns = [...tools.querySelectorAll('.sb-tool')].map((b) => {
      const el = b as HTMLElement;
      const r = el.getBoundingClientRect();
      const bcs = getComputedStyle(el);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      const onScreen = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      return {
        id: el.id,
        width: r.width,
        height: r.height,
        display: bcs.display,
        visibility: bcs.visibility,
        onScreen,
        visible: onScreen && bcs.visibility !== 'hidden' && bcs.display !== 'none' && parseFloat(bcs.opacity) > 0.01,
        hitSelf: !!(hit && (hit === el || el.contains(hit))),
      };
    });
    return {
      position: cs.position,
      left: cs.left,
      bottom: cs.bottom,
      width: tr.width,
      height: tr.height,
      insideStructural: !!tools.closest('#sidebarLeft'),
      insideGeometric: tr.width > 0 && tr.left >= sr.left - 1 && tr.right <= sr.right + 1,
      atSidebarBottom: Math.abs(tr.bottom - sr.bottom) <= 1,
      sidebarWidth: sr.width,
      buttons: btns,
      toolsScrollW: tools.scrollWidth,
      toolsClientW: tools.clientWidth,
    };
  });
}

test.describe('v2.1 fix18 · 布局溢出与左下角图标归属', () => {
  let dist = '';

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    dist = await ensureDist();
  });

  test('1) 大纲视图不产生横向滚动（window.innerWidth ≥ documentElement.scrollWidth）', async ({ context, page }) => {
    await installDistRoute(context, dist);
    await openApp(page);
    await switchView(page, 'outline', '#content .outline');

    const m = await measureHorizontal(page);
    /* 文档级：不得出现横向滚动条 */
    expect(
      m.innerWidth,
      `大纲视图出现横向滚动：innerWidth=${m.innerWidth} < scrollWidth=${m.docScrollWidth}`,
    ).toBeGreaterThanOrEqual(m.docScrollWidth - TOL);
    /* 主内容区：内部也不得被撑出横向滚动 */
    expect(m.contentScrollWidth, '主内容区 #content 不得横向溢出').toBeLessThanOrEqual(m.contentClientWidth + TOL);
    /* #content 必须与 #main 同宽（不被内部超宽子树撑破后静默截断） */
    expect(Math.abs(m.contentWidth - m.mainWidth), '#content 必须与 #main 同宽').toBeLessThanOrEqual(TOL);

    const outline = await page.evaluate(() => {
      const el = document.querySelector('#content .outline') as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const c = document.getElementById('content') as HTMLElement;
      const cs = getComputedStyle(c);
      return {
        width: r.width,
        boxWidth: c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        left: r.left,
        contentLeft: c.getBoundingClientRect().left,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });
    expect(outline, '大纲根容器必须存在').not.toBeNull();
    /* 大纲铺满可用宽度，且左缘不越出内容区（不出现负 margin / 超大 padding-left） */
    expect(Math.abs(outline!.width - outline!.boxWidth), '大纲宽度必须等于内容盒宽').toBeLessThanOrEqual(TOL);
    expect(outline!.left, '大纲左缘不得越出 #content').toBeGreaterThanOrEqual(outline!.contentLeft - TOL);
    expect(outline!.scrollWidth, '大纲自身不得横向溢出').toBeLessThanOrEqual(outline!.clientWidth + TOL);
  });

  test('2) 收起左侧栏：左下角图标不可见，且主内容区变宽', async ({ context, page }) => {
    await installDistRoute(context, dist);
    await openApp(page);
    await switchView(page, 'outline', '#content .outline');

    /* 展开态基线：工具条在 #sidebarLeft 内部最下方，按钮可命中 */
    const before = await measureTools(page);
    expect(before, '展开态必须存在 .sb-tools').not.toBeNull();
    expect(before!.insideStructural, '工具条结构上必须在 #sidebarLeft 内部').toBe(true);
    expect(before!.insideGeometric, '展开态工具条必须落在 #sidebarLeft 矩形内').toBe(true);
    expect(before!.atSidebarBottom, '展开态工具条必须贴 #sidebarLeft 底缘（footer 语义）').toBe(true);
    expect(before!.buttons.length, '工具条必须有 4 个按钮').toBe(4);
    for (const b of before!.buttons) {
      expect(b.visible, `展开态按钮 #${b.id} 必须可见`).toBe(true);
      expect(b.hitSelf, `展开态按钮 #${b.id} 中心点必须命中自身`).toBe(true);
      /* WCAG 2.5.5 起步值：命中区 ≥40×40（fix5·D-10 口径不回退） */
      expect(b.width, `展开态按钮 #${b.id} 宽度 ≥40`).toBeGreaterThanOrEqual(40);
      expect(b.height, `展开态按钮 #${b.id} 高度 ≥40`).toBeGreaterThanOrEqual(40);
    }

    const contentBefore = await measureHorizontal(page);

    /* 真实点击「收起侧边栏」 */
    const tog = page.locator('#btnToggleLeft').first();
    await expect(tog, '必须存在左侧栏折叠钮').toHaveCount(1, { timeout: 10_000 });
    await tog.click();
    await page.waitForTimeout(700);

    const collapsed = await page.evaluate(() => ({
      sbClass: [...(document.getElementById('sidebarLeft') as HTMLElement).classList],
      bodyClass: [...document.body.classList],
      sbWidth: (document.getElementById('sidebarLeft') as HTMLElement).getBoundingClientRect().width,
    }));
    expect(collapsed.sbClass, '侧栏必须进入 collapsed 态').toContain('collapsed');
    expect(collapsed.sbWidth, '折叠后 #sidebarLeft 宽度必须归零').toBeLessThanOrEqual(TOL);

    const after = await measureTools(page);
    expect(after, '折叠态仍必须存在 .sb-tools（随父级隐藏，不是被删除）').not.toBeNull();
    /* 核心缺陷点：不得再钉在视口左下角 */
    expect(after!.position, '折叠态工具条不得为 position:fixed（曾钉在视口左下）').not.toBe('fixed');
    expect(after!.insideGeometric, '折叠态工具条不得再浮在 #sidebarLeft 之外').toBe(false);
    /* 左下角图标必须不可见 */
    for (const b of after!.buttons) {
      expect(b.visible, `折叠后左下角图标 #${b.id} 必须不可见`).toBe(false);
      expect(b.onScreen, `折叠后左下角图标 #${b.id} 不得出现在视口内`).toBe(false);
    }

    const contentAfter = await measureHorizontal(page);
    expect(
      contentAfter.contentWidth,
      `收起左侧栏后主内容区必须变宽：${contentBefore.contentWidth} → ${contentAfter.contentWidth}`,
    ).toBeGreaterThan(contentBefore.contentWidth + TOL);
    /* 变宽后仍不得出现横向滚动 */
    expect(contentAfter.innerWidth, '收起侧栏后不得出现横向滚动').toBeGreaterThanOrEqual(contentAfter.docScrollWidth - TOL);

    /* 再点一次恢复：工具条回到侧栏底部且可见（幂等，不留残状态） */
    await tog.click();
    await page.waitForTimeout(700);
    const restored = await measureTools(page);
    expect(restored, '恢复后必须仍存在 .sb-tools').not.toBeNull();
    expect(restored!.sidebarWidth, '恢复后 #sidebarLeft 宽度必须回到 >0').toBeGreaterThan(TOL);
    for (const b of restored!.buttons) {
      expect(b.visible, `恢复后按钮 #${b.id} 必须重新可见`).toBe(true);
    }
  });

  test('3) 思维导图 / 图谱画布宽度＝可用宽度，视图内无横向滚动', async ({ context, page }) => {
    await installDistRoute(context, dist);
    await openApp(page);

    /* ---- 思维导图 ---- */
    await switchView(page, 'mindmap', '#content .mm-wrap');
    const mm = await page.evaluate(() => {
      const wrap = document.querySelector('#content .mm-wrap') as HTMLElement | null;
      const c = document.getElementById('content') as HTMLElement;
      const cs = getComputedStyle(c);
      if (!wrap) return null;
      const r = wrap.getBoundingClientRect();
      return {
        width: r.width,
        boxWidth: c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        innerWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        contentScrollWidth: c.scrollWidth,
        contentClientWidth: c.clientWidth,
      };
    });
    expect(mm, '思维导图根容器 .mm-wrap 必须存在').not.toBeNull();
    expect(Math.abs(mm!.width - mm!.boxWidth), '思维导图画布宽度必须等于内容盒宽（铺满而非写死）').toBeLessThanOrEqual(TOL);
    expect(mm!.width, '思维导图画布不得宽于视口').toBeLessThanOrEqual(mm!.innerWidth + TOL);
    expect(mm!.innerWidth, '思维导图不得产生文档级横向滚动').toBeGreaterThanOrEqual(mm!.docScrollWidth - TOL);
    expect(mm!.contentScrollWidth, '思维导图不得撑破 #content').toBeLessThanOrEqual(mm!.contentClientWidth + TOL);

    /* ---- 图谱 ---- */
    await switchView(page, 'graph', '#content .graph-canvas');
    const gm = await page.evaluate(() => {
      const canvas = document.querySelector('#content .graph-canvas') as HTMLElement | null;
      const c = document.getElementById('content') as HTMLElement;
      const cs = getComputedStyle(c);
      if (!canvas) return null;
      const svg = canvas.querySelector('svg') as SVGElement | null;
      const r = canvas.getBoundingClientRect();
      const sr = svg ? svg.getBoundingClientRect() : null;
      return {
        width: r.width,
        boxWidth: c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        innerWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        scrollWidth: canvas.scrollWidth,
        clientWidth: canvas.clientWidth,
        svgWidth: sr ? sr.width : NaN,
        svgAttrWidth: svg ? Number(svg.getAttribute('width')) : NaN,
      };
    });
    expect(gm, '图谱根容器 .graph-canvas 必须存在').not.toBeNull();
    expect(Math.abs(gm!.width - gm!.boxWidth), '图谱画布宽度必须等于内容盒宽').toBeLessThanOrEqual(TOL);
    expect(gm!.width, '图谱画布不得宽于视口').toBeLessThanOrEqual(gm!.innerWidth + TOL);
    /* 核心缺陷点：SVG 曾写死 W=max(800, innerWidth-400) ⇒ 800 > 容器 720 造成内部横向滚动 */
    expect(gm!.scrollWidth, `图谱容器不得横向溢出：scrollWidth=${gm!.scrollWidth} > clientWidth=${gm!.clientWidth}`).toBeLessThanOrEqual(gm!.clientWidth + TOL);
    expect(gm!.svgWidth, '图谱 SVG 不得宽于容器').toBeLessThanOrEqual(gm!.clientWidth + TOL);
    expect(gm!.svgAttrWidth, '图谱 SVG 的 width 属性不得写死超宽值').toBeLessThanOrEqual(gm!.clientWidth + TOL);
    expect(gm!.innerWidth, '图谱不得产生文档级横向滚动').toBeGreaterThanOrEqual(gm!.docScrollWidth - TOL);
  });

  test('4) 窄视口（≤768px）抽屉态：工具条保留 40×40 命中区（fix6·D-11 不回退）', async ({ context, page }) => {
    await installDistRoute(context, dist);
    await page.setViewportSize({ width: 480, height: 700 });
    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction(() => {
      const J = (window as any).JU;
      return !!(J && typeof J.getState === 'function' && typeof J.renderMain === 'function' && J.actions);
    }, null, { timeout: 60_000, polling: 25 });
    await page.waitForTimeout(600);

    const tools = await measureTools(page);
    expect(tools, '窄视口必须存在 .sb-tools').not.toBeNull();
    /* 窄视口按 D-11 口径钉在视口左下（抽屉态），四个按钮 40×40 且中心命中自身 */
    expect(tools!.position, '≤768px 工具条必须是 position:fixed（D-11）').toBe('fixed');
    expect(tools!.buttons.length, '工具条必须有 4 个按钮').toBe(4);
    for (const b of tools!.buttons) {
      expect(b.visible, `窄视口按钮 #${b.id} 必须可见可点`).toBe(true);
      expect(b.width, `窄视口按钮 #${b.id} 宽度 ≥40`).toBeGreaterThanOrEqual(40);
      expect(b.height, `窄视口按钮 #${b.id} 高度 ≥40`).toBeGreaterThanOrEqual(40);
      expect(b.hitSelf, `窄视口按钮 #${b.id} 中心点必须命中自身`).toBe(true);
    }
  });
});
