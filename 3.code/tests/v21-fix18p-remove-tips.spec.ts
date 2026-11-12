import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix18-patch1 补充 · 移除大纲「已选 N 个节点…」提示条与空节点「输入内容」占位符
 *
 * 缺陷（P0 取证：90过程材料/tmp/fix18-patch1/remove_tips_before.log，
 * 对真实 dist/index.html sha256 59a3aa77…3796，Edge 真窗口 file://，1200×800）：
 *   · 大纲 Ctrl+点击多选两行后出现 `.outline-selbar`：
 *     「已选 2 个节点 · 拖动手柄可批量移动 / 改变层级」；
 *   · 新建空节点后 `.text[data-ph="输入内容"][data-empty="1"]::before` 显示「输入内容」。
 *
 * 修复（仅动 src/views/outline.ts 展示层）：
 *   · 删除两处 `.outline-selbar` DOM 构造（主路径 + 虚拟滚动降级路径）；
 *   · 大纲正文不再设置 data-ph / 不再向 syncEmptyState 传「输入内容」占位文案。
 *   选择模型（_outlineSel）、批量拖拽、Tab 缩进、Esc 取消均保持原逻辑。
 *
 * 承载方式与 fix13~fix18 spec 一致：`vite build` 产物 + `context.route` 映射到
 * http://localhost:5173；全部断言基于真实浏览器 DOM / 产品 state 实测值。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:5173';
const VIEW = { width: 1200, height: 800 };
const OUTLINE = '#content .outline';
const TEXTS = '#content .outline .text[contenteditable="true"]';

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
  await page.waitForTimeout(500);
}

async function gotoOutline(page: Page): Promise<void> {
  const btn = page.locator('#tbNav .tb-nav-btn[data-view="outline"]').first();
  await expect(btn, '顶栏必须有大纲入口').toHaveCount(1, { timeout: 20_000 });
  await btn.click();
  await expect(page.locator(OUTLINE), '大纲视图必须渲染').toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(600);
}

/** 保证至少有 3 个正文行，便于真实 Ctrl+点击多选与 Tab 缩进（走产品 actions，不改写 JU.ui()）。 */
async function ensureRows(page: Page): Promise<void> {
  await page.evaluate(() => {
    const J = (window as any).JU;
    const st = J.getState();
    const docId = (st.ui && st.ui.currentDocId) || st.rootId;
    let texts = Array.from(document.querySelectorAll('#content .outline .text[contenteditable="true"]'));
    if (texts.length < 3) {
      for (let i = texts.length; i < 3; i++) J.actions.addNode(docId, null, { text: 'fix18p 节点 ' + (i + 1) });
      if (typeof J.forceRender === 'function') J.forceRender();
    }
  });
  await expect.poll(async () => page.locator(TEXTS).count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
  await page.waitForTimeout(400);
}

/** 真实点击「+ 新增内容（按 Enter）」创建空节点 */
async function addEmptyNode(page: Page): Promise<void> {
  const adder = page.locator('#content .outline .add-node').first();
  await expect(adder, '大纲底部必须有「+ 新增内容」入口').toHaveCount(1, { timeout: 20_000 });
  await adder.click();
  await page.waitForFunction(() => {
    const els = Array.from(document.querySelectorAll('#content .outline .text[contenteditable="true"]'));
    return els.some((el) => !(el.textContent || '').trim());
  }, null, { timeout: 20_000, polling: 25 });
  await page.waitForTimeout(400);
}

/** 真实 Ctrl+点击指定行正文 → 产品行内 mousedown 多选分支 */
async function ctrlSelectRows(page: Page, indexes: number[]): Promise<void> {
  const rows = page.locator('#content .outline .node > .row');
  for (const i of indexes) {
    await rows.nth(i).locator('.text').first().click({ modifiers: ['Control'], timeout: 20_000 });
    await page.waitForTimeout(300);
  }
}

async function readPlaceholderFacts(page: Page) {
  return page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('#content .outline .text[contenteditable="true"]')) as HTMLElement[];
    const empty = texts.find((el) => !(el.textContent || '').trim()) || null;
    if (!empty) return null;
    const cs = getComputedStyle(empty, '::before');
    const r = empty.getBoundingClientRect();
    return {
      id: empty.dataset.id || null,
      text: empty.textContent || '',
      dataEmpty: empty.dataset.empty || '',
      dataPh: empty.dataset.ph == null ? null : empty.dataset.ph,
      beforeContent: cs.content,
      beforeDisplay: cs.display,
      rect: { width: r.width, height: r.height },
      dataPhInputCount: document.querySelectorAll('#content .outline .text[data-ph="输入内容"]').length,
      hasPlaceholderTextNode: texts.some((el) => (el.textContent || '').includes('输入内容')),
    };
  });
}

async function readSelectionFacts(page: Page) {
  return page.evaluate(() => {
    const visibleHits: Array<{ tag: string; cls: string; text: string }> = [];
    const ownText = (el: Element) => Array.from(el.childNodes || [])
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent || '')
      .join('');
    (function visit(el: Element) {
      if (!el || el.nodeType !== 1) return;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const hidden = cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || rect.width === 0;
      if (!hidden) {
        const t = ownText(el);
        if (/已选|拖动手柄/.test(t)) visibleHits.push({ tag: el.tagName, cls: String(el.className || ''), text: t.slice(0, 120) });
      }
      Array.from(el.children || []).forEach(visit);
    })(document.body);
    return {
      multiSelCount: document.querySelectorAll('#content .outline .row.multi-sel').length,
      selbarCount: document.querySelectorAll('.outline-selbar').length,
      bodyHasSelectedText: (document.body.innerText || '').includes('已选'),
      bodyHasDragHandleText: (document.body.innerText || '').includes('拖动手柄'),
      visibleHits,
    };
  });
}

async function snapshotNode(page: Page, id: string) {
  return page.evaluate((nodeId) => {
    const J = (window as any).JU;
    const st = J.getState();
    const n = st.nodes[nodeId];
    if (!n) return null;
    const p = st.nodes[n.parent];
    return { id: nodeId, parent: n.parent, idx: p ? p.children.indexOf(nodeId) : -1 };
  }, id);
}

test.describe('v2.1 fix18-patch1 补充 · 移除选中提示条与空节点占位符', () => {
  let dist = '';

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    dist = await ensureDist();
  });

  test('移除选中提示条与空节点占位符', async ({ context, page }) => {
    test.setTimeout(240_000);
    await installDistRoute(context, dist);
    await openApp(page);
    await gotoOutline(page);
    await ensureRows(page);

    /* ---------- 断言 1：空节点不得出现「输入内容」占位 ---------- */
    await addEmptyNode(page);
    const ph = await readPlaceholderFacts(page);
    expect(ph, '必须真实创建出一个空节点').not.toBeNull();
    expect(ph!.text, '空节点内部文本必须为空（不得注入「输入内容」）').toBe('');
    expect(ph!.dataPh, '空节点不得再设置 data-ph="输入内容"').not.toBe('输入内容');
    expect(ph!.beforeContent, '::before 伪元素不得再输出「输入内容」').not.toContain('输入内容');
    expect(ph!.dataPhInputCount, '大纲 DOM 中不得存在 data-ph="输入内容" 的占位元素').toBe(0);
    expect(ph!.hasPlaceholderTextNode, '大纲正文不得包含「输入内容」文本节点').toBe(false);
    expect(await page.locator(OUTLINE).innerText(), '大纲可见文本不得包含「输入内容」').not.toContain('输入内容');
    expect(ph!.rect.width, '空节点本体仍必须占据可编辑宽度').toBeGreaterThan(0);
    expect(ph!.dataEmpty, '空节点 data-empty 空态标记可保留（不影响占位文案）').toBe('1');

    /* ---------- 断言 2：多选后不得出现「已选 / 拖动手柄」提示条 ---------- */
    await ctrlSelectRows(page, [0, 1]);
    await expect.poll(async () => (await readSelectionFacts(page)).multiSelCount, {
      message: 'Ctrl+点击必须真实选中 ≥2 行（选择功能本身不得被移除）',
      timeout: 20_000,
    }).toBeGreaterThanOrEqual(2);
    const sel = await readSelectionFacts(page);
    expect(sel.selbarCount, '不得再渲染 .outline-selbar 提示条').toBe(0);
    expect(sel.visibleHits, '页面上不得存在可见的「已选 / 拖动手柄」文字节点').toEqual([]);
    expect(sel.bodyHasSelectedText, '页面可见文字不得包含「已选」').toBe(false);
    expect(sel.bodyHasDragHandleText, '页面可见文字不得包含「拖动手柄」').toBe(false);

    /* ---------- 断言 3a：Esc 取消选择仍生效 ---------- */
    await page.evaluate(() => {
      try { if (document.activeElement && (document.activeElement as HTMLElement).blur) (document.activeElement as HTMLElement).blur(); } catch { /* ignore */ }
    });
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await readSelectionFacts(page)).multiSelCount, {
      message: 'Esc 必须清空多选（_outlineSel 选择模型仍生效）',
      timeout: 20_000,
    }).toBe(0);

    /* ---------- 断言 3b：选中节点后 Tab 缩进仍生效 ---------- */
    await ctrlSelectRows(page, [0, 1]);
    await expect.poll(async () => (await readSelectionFacts(page)).multiSelCount, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    const targetId: string | null = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#content .outline .row.multi-sel'));
      const last = rows[rows.length - 1];
      return last && last.parentElement ? (last.parentElement as HTMLElement).dataset.id || null : null;
    });
    expect(targetId, '必须能定位到被选中的目标节点').toBeTruthy();
    const before = await snapshotNode(page, targetId!);
    expect(before, '目标节点必须存在于产品 state').not.toBeNull();
    await page.locator(`#content .outline .node[data-id="${targetId}"] .text`).first().click({ timeout: 20_000 });
    await page.waitForTimeout(250);
    await page.keyboard.press('Tab');
    await expect.poll(async () => {
      const now = await snapshotNode(page, targetId!);
      return now ? now.parent : before!.parent;
    }, { message: 'Tab 必须触发真实缩进（节点 parentId 变化）', timeout: 20_000 }).not.toBe(before!.parent);
  });
});
