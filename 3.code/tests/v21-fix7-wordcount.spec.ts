import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix7 · 字数统计（charStats）token 化 + 面板绑定
 *
 * P0 取证（90过程材料/tmp/fix7/wordcount_before.log，对 fix6 发布产物
 * 8.发布与CI/release/v2.1-2026-10-26/JU-v2.1-Web.html sha256 f27b29e5…01fb）：
 *   · 输入「Hello World 测试字数统计」后 `charStats[今日] = {add:20, del:0, mod:18}`：
 *     18 个**字符长度差**全部落进「修改」，新增 A 完全没动；
 *   · 日历「字数统计」面板四张卡仍显示 0/0/0/0（面板读的是 `deps.state.charStats`，
 *     而 state 代理只代理了 nodes/rootId/trashed/_tags ⇒ 读到 undefined 的死引用）；
 *   · 旧面板「净变化」= add - del + mod = 20 - 0 + 18 = 38，把修改重复计了一次。
 *   末行 WORDCOUNT_VERDICT: H3(统计不准)。
 *
 * 修复：
 *   · `src/core/wordcount.worker.ts`：tokenize / tokenDiff（CJK 字素簇、英文按词、空白标点 emoji 各 1）；
 *   · `src/core/charstats.ts`：500ms 批次合并 + token 增量 → M=min(I,D)、A=I-M、R=D-M、N=I-D，
 *     累加进 `charStats[ds].{add,del,mod,net}`；退出校准以当日基线快照**覆盖**当日桶；
 *   · `src/core/actions.ts`：updateText 不再传字符长度差，改发 (旧 HTML, 新 HTML) 给引擎；
 *     logActivity 只维护 activity 流水，节点新增/删除按整段 token 计入 A/R；
 *   · `src/main.ts`：state 代理补 charStats/charBaseline/charStatsRev/pendingCalibration getter
 *     （面板绑定失效根因），并装配引擎 + 启动优先校准 + pagehide 退出校准；
 *   · `src/views/calendar.ts`：净变化读 `net`（缺失回落 add-del），绝不 add-del+mod。
 *
 * 承载方式与 fix1/fix5/fix6 spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
 * 全部断言均为真实交互（真实侧栏「新建文件」→ 真实 appPrompt 输入名称 → 真实 .add-node →
 * 真实 contenteditable 键盘输入 → blur 提交 → 切回日历读面板），无夹具直改 state。
 */

const BASE = 'http://localhost:5173';

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

function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

async function ensureDist(): Promise<string> {
  if (DIST) return DIST;
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  const htmls = fs.readdirSync(dist).filter((n) => /\.html?$/i.test(n));
  if (htmls.length !== 1 || htmls[0] !== 'index.html') throw new Error('dist 下 HTML 不是恰好一份 index.html：' + htmls.join(', '));
  DIST = dist;
  return DIST;
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

/* ---------------- 页面操作 ---------------- */

async function waitApp(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).JU && typeof (window as any).JU.getState === 'function',
    null,
    { timeout: 60_000 },
  );
}

async function openPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const dist = await ensureDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 980 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await waitApp(page);
  await page.waitForTimeout(600);
  return { context, page };
}

interface Bucket {
  add: number;
  del: number;
  mod: number;
  net: number;
}

/** 读 state.charStats[今日] + pendingCalibration（只读，不改） */
async function readStats(page: Page): Promise<{ ds: string; bucket: Bucket | null; pending: boolean }> {
  return page.evaluate(() => {
    const st = (window as any).JU.getState();
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const ds = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    const b = (st.charStats || {})[ds] || null;
    return {
      ds,
      bucket: b
        ? {
            add: b.add | 0,
            del: b.del | 0,
            mod: b.mod | 0,
            net: typeof b.net === 'number' ? b.net | 0 : (b.add | 0) - (b.del | 0),
          }
        : null,
      pending: !!(st && st.pendingCalibration),
    };
  });
}

const zero: Bucket = { add: 0, del: 0, mod: 0, net: 0 };
const b = (x: Bucket | null): Bucket => x || zero;
/** 四象限增量 */
function delta(prev: Bucket | null, next: Bucket | null): Bucket {
  const a = b(prev);
  const c = b(next);
  return { add: c.add - a.add, del: c.del - a.del, mod: c.mod - a.mod, net: c.net - a.net };
}

/** 进日历并读「字数统计」面板四张卡（真实 DOM 读数） */
async function gotoCalendarAndReadPanel(page: Page): Promise<Record<string, number>> {
  await page.locator('.sb-nav-item[data-nav="calendar"]').first().click();
  await expect(page.locator('.cal-cell.today'), '日历必须渲染出今天格子').toHaveCount(1, { timeout: 20_000 });
  await page.locator('.cal-cell.today').first().click();
  await expect(page.locator('.cal-module[data-key="chars"]'), '字数统计模块必须存在').toHaveCount(1, { timeout: 20_000 });
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const mod = document.querySelector('.cal-module[data-key="chars"]');
    const out: Record<string, number> = {};
    if (!mod) return out;
    const body = mod.querySelector('.cal-module-body') || mod;
    Array.from(body.querySelectorAll('div')).forEach((d) => {
      const t = String(d.textContent || '').replace(/\s+/g, ' ').trim();
      const m = /^([+-]?\d+)\s*(新增|删除|修改|净变化)$/.exec(t);
      if (m) out[m[2]] = Number(m[1]);
    });
    return out;
  });
}

/**
 * 真实路径建文档 + 建首行 + 正文输入（返回「输入前」的统计快照，供纯净 delta）。
 * 产品路径：侧栏 #btnNewDoc → appPrompt('新文档名称：') → [data-ok] → #content .add-node → 行输入 → blur。
 */
async function createDocAndType(page: Page, text: string): Promise<Bucket | null> {
  const title = 'FIX7WC-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  await page.locator('#btnNewDoc').first().click({ timeout: 20_000 });
  const inp = page.locator('.modal-overlay .modal input[type="text"]').first();
  await inp.waitFor({ state: 'visible', timeout: 15_000 });
  await inp.fill(title);
  await page.locator('.modal-overlay .modal [data-ok]').first().click({ timeout: 10_000 });
  await page.waitForTimeout(900);
  await page.locator('#content .add-node').first().click({ timeout: 20_000 });
  await page.waitForTimeout(400);
  const row = page.locator('#content .outline .node > .row > .text[contenteditable="true"]').first();
  await row.waitFor({ state: 'visible', timeout: 25_000 });
  const before = (await readStats(page)).bucket;
  await row.click();
  await page.waitForTimeout(120);
  await page.keyboard.press('End');
  await page.keyboard.type(text, { delay: 15 });
  await page.waitForTimeout(150);
  await page.evaluate(() => { const ae = document.activeElement as HTMLElement | null; if (ae && ae.blur) ae.blur(); });
  await page.waitForTimeout(900); /* 引擎 500ms 批次 + 落盘调度 */
  return before;
}

/** 选中正文里的 needle 并整段删除（真实键盘 Delete） */
async function selectAndDelete(page: Page, needle: string): Promise<void> {
  const ok = await page.evaluate((t) => {
    const hosts = Array.from(document.querySelectorAll('#content [contenteditable="true"]')) as HTMLElement[];
    const host = hosts.find((h) => String(h.textContent || '').indexOf(t) >= 0);
    if (!host) return false;
    host.click();
    const sel = window.getSelection();
    if (!sel) return false;
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const full = String(host.textContent || '');
    const i = full.indexOf(t);
    if (i < 0) return false;
    let pos = 0, sn: Node | null = null, so = 0, en: Node | null = null, eo = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const len = (node.nodeValue || '').length;
      if (sn === null && pos + len > i) { sn = node; so = i - pos; }
      if (sn !== null && pos + len >= i + t.length) { en = node; eo = i + t.length - pos; break; }
      pos += len;
    }
    if (!sn || !en) return false;
    const r = document.createRange();
    r.setStart(sn, so); r.setEnd(en, eo);
    sel.removeAllRanges(); sel.addRange(r);
    return true;
  }, needle);
  expect(ok, '正文必须定位到待删除片段「' + needle + '」').toBe(true);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
  await page.evaluate(() => { const ae = document.activeElement as HTMLElement | null; if (ae && ae.blur) ae.blur(); });
  await page.waitForTimeout(900);
}

/** 选中正文里的 oldText 并用键盘输入 newText 覆盖（真实替换） */
async function selectAndReplace(page: Page, oldText: string, newText: string): Promise<void> {
  const ok = await page.evaluate((t) => {
    const hosts = Array.from(document.querySelectorAll('#content [contenteditable="true"]')) as HTMLElement[];
    const host = hosts.find((h) => String(h.textContent || '').indexOf(t) >= 0);
    if (!host) return false;
    host.click();
    const sel = window.getSelection();
    if (!sel) return false;
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const full = String(host.textContent || '');
    const i = full.indexOf(t);
    if (i < 0) return false;
    let pos = 0, sn: Node | null = null, so = 0, en: Node | null = null, eo = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const len = (node.nodeValue || '').length;
      if (sn === null && pos + len > i) { sn = node; so = i - pos; }
      if (sn !== null && pos + len >= i + t.length) { en = node; eo = i + t.length - pos; break; }
      pos += len;
    }
    if (!sn || !en) return false;
    const r = document.createRange();
    r.setStart(sn, so); r.setEnd(en, eo);
    sel.removeAllRanges(); sel.addRange(r);
    return true;
  }, oldText);
  expect(ok, '正文必须定位到待替换片段「' + oldText + '」').toBe(true);
  await page.keyboard.type(newText, { delay: 15 });
  await page.waitForTimeout(150);
  await page.evaluate(() => { const ae = document.activeElement as HTMLElement | null; if (ae && ae.blur) ae.blur(); });
  await page.waitForTimeout(900);
}

/* ---------------- 用例 ---------------- */

test.describe('v2.1 fix7 · 字数统计 token 化', () => {
  test('1) 纯新增：A 增 / R=0 / M=0 / N>0，且日历面板「新增」等于桶内 add（绑定不再失效）', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openPage(browser);
    try {
      const before = await createDocAndType(page, 'Hello World');
      const after = (await readStats(page)).bucket;
      const d = delta(before, after);
      console.log('[fix7-1] before=', JSON.stringify(before), 'after=', JSON.stringify(after), 'delta=', JSON.stringify(d));
      expect(d.add, '纯新增必须让 A 增加').toBeGreaterThan(0);
      expect(d.del, '纯新增不得产生删除 R').toBe(0);
      expect(d.mod, '纯新增不得产生修改 M').toBe(0);
      expect(d.net, '纯新增净变化 N 必须为正').toBeGreaterThan(0);
      expect(b(after).add - b(after).del, '净变化口径必须是 add - del（不得再叠加 mod）').toBe(b(after).net);

      const cards = await gotoCalendarAndReadPanel(page);
      console.log('[fix7-1] panel=', JSON.stringify(cards));
      expect(cards['新增'], '面板「新增」必须等于 charStats.add（P0 缺陷：面板恒 0）').toBe(b(after).add);
      expect(cards['删除'], '面板「删除」必须等于 charStats.del').toBe(b(after).del);
      expect(cards['修改'], '面板「修改」必须等于 charStats.mod').toBe(b(after).mod);
      expect(cards['净变化'], '面板「净变化」必须等于 charStats.net').toBe(b(after).net);
    } finally {
      await context.close();
    }
  });

  test('2) 纯删除：R 增 / N 减', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openPage(browser);
    try {
      await createDocAndType(page, 'Hello World');
      const beforeDel = (await readStats(page)).bucket;
      await selectAndDelete(page, 'World');
      const afterDel = (await readStats(page)).bucket;
      const d = delta(beforeDel, afterDel);
      console.log('[fix7-2] before=', JSON.stringify(beforeDel), 'after=', JSON.stringify(afterDel), 'delta=', JSON.stringify(d));
      expect(d.del, '纯删除必须让 R 增加').toBeGreaterThan(0);
      expect(d.net, '纯删除必须让 N 减小').toBeLessThan(0);
    } finally {
      await context.close();
    }
  });

  test('3) 纯修改：M 增', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openPage(browser);
    try {
      await createDocAndType(page, 'Hello World');
      const beforeMod = (await readStats(page)).bucket;
      await selectAndReplace(page, 'Hello', 'Hi');
      const afterMod = (await readStats(page)).bucket;
      const d = delta(beforeMod, afterMod);
      console.log('[fix7-3] before=', JSON.stringify(beforeMod), 'after=', JSON.stringify(afterMod), 'delta=', JSON.stringify(d));
      expect(d.mod, '纯修改必须让 M 增加').toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });

  test('4) 刷新重开：stats 自洽（add - del == net）、无 pendingCalibration 残留、面板与桶一致', async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await openPage(browser);
    try {
      await createDocAndType(page, 'Hello World');
      await selectAndDelete(page, 'World');
      const beforeReload = (await readStats(page)).bucket;
      console.log('[fix7-4] beforeReload=', JSON.stringify(beforeReload));
      expect(beforeReload, '刷新前必须已有统计').toBeTruthy();

      await page.reload({ waitUntil: 'load', timeout: 60_000 });
      await waitApp(page);
      await page.waitForTimeout(1200);
      const afterReload = await readStats(page);
      console.log('[fix7-4] afterReload=', JSON.stringify(afterReload));
      const nb = b(afterReload.bucket);
      expect(nb.add - nb.del, '重开后必须自洽：add - del == net（校准覆盖后不得出现漂移）').toBe(nb.net);
      expect(nb.net, '重开后净变化必须与刷新前一致（内容未再改动）').toBe(b(beforeReload).net);
      expect(afterReload.pending, '重开后不得残留 pendingCalibration 标记').toBe(false);

      const cards = await gotoCalendarAndReadPanel(page);
      console.log('[fix7-4] panel=', JSON.stringify(cards));
      expect(cards['新增'], '重开后面板「新增」仍须等于桶内 add').toBe(nb.add);
      expect(cards['净变化'], '重开后面板「净变化」仍须等于桶内 net').toBe(nb.net);
    } finally {
      await context.close();
    }
  });
});
