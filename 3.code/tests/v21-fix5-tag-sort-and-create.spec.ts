import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix5 · 新建标签的关联性 + 侧栏「我的文档」/「标签」两组列表排序同步
 *
 * P0 取证（90过程材料/tmp/fix5/sidebar_tag_sort_before.log，末行 SIDEBAR_TAG_SORT_VERDICT: H1）：
 *   · H1：fix4 发布产物里点侧栏「＋ 新建标签」，promptNewTag 直接把新标签写进**当前选中节点**的
 *     tags / _manualTags（探针实测 3/3 命中，命中节点 = 刚建的最后一个文档）；
 *   · H2：`renderSubTags` 的排序是硬编码 `.sort((a,b)=>b[1]-a[1])`（按计数降序），而「我的文档」
 *     走 `deps.sortDocs(..., ui.filesSort)`。#sortBtn（title="排序切换"）循环
 *     name→type→created→updated→star 时文档列表顺序变化 2 次、标签列表顺序变化 0 次（冻结）。
 *
 * 修复后口径（本 spec 断言对象）：
 *   · P1：新建标签只登记全局索引 `state._tags`，不写任何节点的 tags / _manualTags；
 *     节点与标签的关联只能由用户显式勾选（日历待办右键 →「选择标签」）。
 *   · P2：`renderSubTags` 经 `sortTagRowsByMode` 读取**同一个** `ui.filesSort` 并复用**同一个**
 *     比较器 `deps.sortDocs`（代表节点 = 标签成员中 updatedAt 最大者；空标签排最后按名称）。
 *
 * 断言口径全部取产品自身 DOM / state，不直写 state、不改夹具；承载方式与 fix1/fix2/fix4/fix9/fix10
 * spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
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

/* ---------------- 中文排序（与 src/core/utils.compareZh 同一口径，仅用于断言参考值） ---------------- */
const ZH = new Intl.Collator('zh-Hans', { numeric: true, sensitivity: 'base' });
const zc = (a: string, b: string) => ZH.compare(String(a ?? ''), String(b ?? ''));

/* ---------------- 页面操作 ---------------- */

async function waitApp(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).JU && typeof (window as any).JU.getState === 'function',
    null,
    { timeout: 60_000 },
  );
}

async function openApp(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const dist = await ensureDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await waitApp(page);
  await page.waitForTimeout(600);
  return { context, page };
}

async function fillModal(page: Page, val: string): Promise<void> {
  const inp = page.locator('.modal-overlay .modal input[type="text"]').last();
  await inp.waitFor({ state: 'visible', timeout: 15_000 });
  await inp.fill(val);
  await page.locator('.modal-overlay .modal [data-ok]').last().click();
  await expect(page.locator('.modal-overlay'), '确定后输入框必须关闭').toHaveCount(0, { timeout: 10_000 });
}

/** 真实点击侧栏「新建文件」，名称为 name（正文即名称，可内嵌 #标签） */
async function newDoc(page: Page, name: string): Promise<void> {
  const btn = page.locator('#btnNewDoc').first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(200);
  await fillModal(page, name);
  await expect
    .poll(async () => page.evaluate((t) => {
      const s = (window as any).JU.getState();
      return Object.keys(s.nodes || {}).some((k) => String((s.nodes[k] || {}).text || '').replace(/<[^>]*>/g, '').trim() === t);
    }, name), { message: '文档「' + name + '」必须落库', timeout: 15_000 })
    .toBe(true);
}

async function ensureGroup(page: Page, nav: 'files' | 'tags'): Promise<void> {
  const item = page.locator('.sb-nav-item[data-nav="' + nav + '"]').first();
  const open = await item.evaluate((el) => el.classList.contains('open'));
  if (!open) {
    await item.locator('.chev').first().click();
    await expect(item, '侧栏分组 ' + nav + ' 必须展开').toHaveClass(/open/, { timeout: 10_000 });
  }
}

/** 真实点击侧栏「＋ 新建标签」入口 → 输入名称 → 确定 */
async function newTagViaSidebar(page: Page, tag: string): Promise<void> {
  await ensureGroup(page, 'tags');
  const add = page.locator('#subTags .sb-add').last();
  await add.waitFor({ state: 'visible', timeout: 20_000 });
  await add.click();
  await page.waitForTimeout(300);
  await fillModal(page, tag);
  await expect
    .poll(async () => sidebarState(page).then((s) => s.tags.some((r) => r.tag === tag)),
      { message: '侧栏「标签」列表必须出现 #' + tag, timeout: 20_000 })
    .toBe(true);
}

/** 侧栏两块列表 + 标签成员映射 + 当前排序状态 */
async function sidebarState(page: Page): Promise<{
  docs: { id: string; label: string }[];
  tags: { tag: string; count: number }[];
  members: Record<string, string[]>;
  sort: string | null;
}> {
  return page.evaluate(() => {
    const txt = (el: any) => String((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
    const docs = Array.from(document.querySelectorAll('#subDocs > .sb-node > .sb-row[data-id]')).map((r: any) => ({
      id: String(r.dataset.id),
      label: txt(r.querySelector('.sb-label')),
    }));
    const tags = Array.from(document.querySelectorAll('#subTags .sb-row[data-tag]')).map((r: any) => ({
      tag: String(r.dataset.tag),
      count: Number(txt(r.querySelector('.count')) || 0),
    }));
    const s = (window as any).JU.getState();
    /* 成员映射：与 buildTagIndex 的 _tagScanStep 同口径（stripHtml 后正文 #tag 命中） */
    const members: Record<string, string[]> = {};
    for (const id of Object.keys(s.nodes || {})) {
      const n = s.nodes[id];
      if (!n || n._deleted || n._isFolder) continue;
      const raw = String(n.text || '').replace(/<[^>]*>/g, '');
      const m = raw.match(/#[^\s#<>"'`]+/g) || [];
      for (const hit of m) {
        const t = hit.slice(1);
        if (!members[t]) members[t] = [];
        if (members[t].indexOf(id) < 0) members[t].push(id);
      }
    }
    const ju: any = (window as any).JU;
    const u = ju && typeof ju.ui === 'function' ? ju.ui() : (ju ? ju.ui : null);
    return { docs, tags, members, sort: (u && typeof u.filesSort === 'string') ? u.filesSort : null };
  });
}

/** 点一次侧栏「排序切换」（#sortBtn，title="排序切换"），返回产品 toast 文案 */
async function clickSort(page: Page): Promise<string> {
  const btn = page.locator('#sortBtn').first();
  await expect(btn, '侧栏「排序切换」按钮必须存在').toHaveCount(1, { timeout: 10_000 });
  await expect(btn).toHaveAttribute('title', '排序切换');
  await btn.click();
  await page.waitForTimeout(650);
  const toast = await page.evaluate(() => String((document.querySelector('#toast') || ({} as any)).textContent || '').trim());
  return toast;
}

const MODE_BY_TOAST: Record<string, string> = {
  '排序：按名称': 'name',
  '排序：按类型': 'type',
  '排序：按创建时间': 'created',
  '排序：按修改时间': 'updated',
  '排序：按星标等级': 'star',
};

/** 当前文档节点 id（JU.ui().currentDocId） */
async function currentDocId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const ju: any = (window as any).JU;
    const u = ju && typeof ju.ui === 'function' ? ju.ui() : (ju ? ju.ui : null);
    return (u && u.currentDocId) || null;
  });
}

/** 全库扫描：哪些节点的 tags / _manualTags 含指定标签 */
async function nodesTagged(page: Page, tag: string): Promise<{ id: string; text: string; inTags: boolean; inManual: boolean }[]> {
  return page.evaluate((t) => {
    const s = (window as any).JU.getState();
    const out: any[] = [];
    for (const id of Object.keys(s.nodes || {})) {
      const n = s.nodes[id] || {};
      const tags = Array.isArray(n.tags) ? n.tags : [];
      const man = Array.isArray(n._manualTags) ? n._manualTags : [];
      if (tags.indexOf(t) >= 0 || man.indexOf(t) >= 0) {
        out.push({
          id,
          text: String(n.text || '').replace(/<[^>]*>/g, '').slice(0, 40),
          inTags: tags.indexOf(t) >= 0,
          inManual: man.indexOf(t) >= 0,
        });
      }
    }
    return out;
  }, tag);
}

/** 标签列表中「有成员」标签的相对顺序（空标签 count=0 不参与排序比对） */
function memberTagOrder(state: { tags: { tag: string; count: number }[] }, watch: string[]): string[] {
  return state.tags.filter((r) => watch.indexOf(r.tag) >= 0 && r.count > 0).map((r) => r.tag);
}

/**
 * 参考顺序（= src/ui/sidebar.sortTagRowsByMode 的可观测等价口径，按 mode 分支）：
 *   · name / type（名称语义）：标签按标签名升序（compareZh 同一 Intl.Collator）；
 *   · created / updated / star（时间 / 星标语义）：代表文档在文档列表中的位次升序，同位次按名称。
 */
function expectedMemberOrder(
  state: { docs: { id: string; label: string }[]; members: Record<string, string[]> },
  watch: string[],
  mode: string,
): string[] {
  const present = watch.filter((t) => (state.members[t] || []).length > 0);
  if (mode === 'name' || mode === 'type') return present.slice().sort(zc);
  const pos = new Map<string, number>();
  state.docs.forEach((d, i) => pos.set(d.id, i));
  const rows = present.map((t) => {
    let best = Number.POSITIVE_INFINITY;
    for (const id of state.members[t]) {
      const p = pos.has(id) ? (pos.get(id) as number) : Number.POSITIVE_INFINITY;
      if (p < best) best = p;
    }
    return { t, pos: best };
  });
  rows.sort((a, b) => (a.pos === b.pos ? zc(a.t, b.t) : a.pos - b.pos));
  return rows.map((r) => r.t);
}

/* ---------------- 日历待办（「选择标签」显式勾选路径，复用 fix1 的既有交互） ---------------- */

async function gotoCalendar(page: Page): Promise<void> {
  await page.locator('.sb-nav-item[data-nav="calendar"]').first().click();
  await expect(page.locator('.cal-cell.today'), '日历必须渲染出今天格子').toHaveCount(1, { timeout: 20_000 });
  await page.locator('.cal-cell.today').first().click();
  await expect(page.locator('.cal-adder'), '当日待办模块的「+ 添加今日待办」必须存在').toHaveCount(1, { timeout: 10_000 });
}

async function createTodo(page: Page, text: string): Promise<string> {
  await page.locator('.cal-adder').first().click();
  await page.waitForTimeout(250);
  const focused = await page.evaluate(() => {
    const ae = document.activeElement as HTMLElement | null;
    return !!(ae && (ae as any).isContentEditable);
  });
  if (!focused) await page.locator('.cal-node .text[contenteditable="true"]').last().click();
  await page.keyboard.type(text, { delay: 12 });
  await page.evaluate(() => {
    const ae = document.activeElement as HTMLElement | null;
    if (ae && ae.blur) ae.blur();
  });
  await page.waitForTimeout(600);
  const id = await page.evaluate((t) => {
    const s = (window as any).JU.getState();
    const hit: string[] = [];
    for (const k of Object.keys(s.nodes || {})) {
      const n = s.nodes[k];
      if (String((n && n.text) || '').replace(/<[^>]*>/g, '').indexOf(t) >= 0) hit.push(k);
    }
    return hit.length ? hit[hit.length - 1] : null;
  }, text);
  expect(id, '新建待办必须落库（state 命中「' + text + '」）').toBeTruthy();
  return id as string;
}

async function rightClickRow(page: Page, id: string): Promise<void> {
  const box = await page.evaluate((nid) => {
    const el = document.querySelector('.cal-node .text[data-id="' + CSS.escape(nid) + '"]') as HTMLElement | null;
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.min(40, Math.max(8, r.width / 2)), y: r.top + r.height / 2 };
  }, id);
  expect(box, '当日待办行必须可定位（.cal-node .text[data-id]）').not.toBeNull();
  await page.mouse.click(box!.x, box!.y, { button: 'right' });
  await expect(page.locator('.cal-ctx'), '右键必须打开日历待办菜单').toHaveCount(1, { timeout: 5000 });
}

async function expandFold(page: Page, title: string): Promise<void> {
  await page.locator('.cal-ctx .cal-ctx-fold > .ctx-item').filter({ hasText: title }).first().click();
  const fold = page.locator('.cal-ctx .cal-ctx-fold').filter({ hasText: title }).first();
  await expect(fold.locator('.cal-ctx-body'), '折叠内容必须展开（.on）').toHaveClass(/on/, { timeout: 5000 });
}

/* ============================================================
   用例
   ============================================================ */

test.describe('v2.1 fix5 · 标签创建与侧栏排序同步', () => {
  test('新建标签不自动关联任何文档（只进全局索引 state._tags）', async ({ browser }) => {
    const { context, page } = await openApp(browser);
    try {
      await newDoc(page, 'F5T1-DOC-A');
      await newDoc(page, 'F5T1-DOC-B');
      const curId = await currentDocId(page);
      expect(curId, '新建文档后应选中该文档').toBeTruthy();

      const tag = 'F5T1NEWTAG';
      await newTagViaSidebar(page, tag);

      /* ① 全库任何节点都不得因「新建标签」而被写入该标签 */
      await expect
        .poll(async () => (await nodesTagged(page, tag)).length,
          { message: '新建标签后不得有任何节点被自动关联', timeout: 15_000 })
        .toBe(0);
      expect(await nodesTagged(page, tag), 'H1 回归：新建标签就被挂到节点上').toEqual([]);

      /* ② 当前节点明确不含（双保险，避免 poll 早期快照误判） */
      const curNode = await page.evaluate((nid) => {
        const n = ((window as any).JU.getState().nodes || {})[nid] || {};
        return { tags: (n.tags || []).slice(), manual: (n._manualTags || []).slice() };
      }, curId as string);
      expect(curNode.tags, '当前文档 tags 不得包含新标签').not.toContain(tag);
      expect(curNode.manual, '当前文档 _manualTags 不得包含新标签').not.toContain(tag);

      /* ③ 侧栏仍必须有这一行（空标签计数 0），且已登记进全局索引 */
      const st = await sidebarState(page);
      const row = st.tags.find((r) => r.tag === tag);
      expect(row, '新建的空标签必须在侧栏「标签」列表可见').toBeTruthy();
      expect(row!.count, '未关联任何节点的标签计数必须为 0').toBe(0);
      const registry = await page.evaluate(() => {
        const s: any = (window as any).JU.getState();
        return Array.isArray(s._tags) ? s._tags.slice() : null;
      });
      expect(registry, 'state._tags 必须存在（全局标签索引）').not.toBeNull();
      expect(registry!, '新标签必须登记在 state._tags').toContain(tag);
    } finally {
      await context.close();
    }
  });

  test('显式勾选标签后，文档才关联该标签', async ({ browser }) => {
    const { context, page } = await openApp(browser);
    try {
      const tag = 'F5T2PICKTAG';
      await newTagViaSidebar(page, tag);
      /* 新建标签阶段：无任何节点关联（与上一条用例同一不变量） */
      expect((await nodesTagged(page, tag)).length, '勾选前不得有关联').toBe(0);

      await gotoCalendar(page);
      const todoId = await createTodo(page, 'F5T2 待办');
      expect((await nodesTagged(page, tag)).length, '仅创建待办不得关联标签').toBe(0);

      /* 显式勾选：右键待办 →「选择标签」→ 点该标签行 */
      await rightClickRow(page, todoId);
      await expandFold(page, '选择标签');
      const row = page
        .locator('.cal-ctx .cal-ctx-tag')
        .filter({ hasText: new RegExp('^#' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '✓?$') })
        .first();
      await expect(row, '「选择标签」必须列出 #' + tag + '（新建的空标签也要可勾选）').toHaveCount(1, { timeout: 15_000 });
      await row.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');

      /* 勾选后：该待办节点的 tags + _manualTags 都必须带上该标签 */
      await expect
        .poll(async () => page.evaluate((arg) => {
          const n = ((window as any).JU.getState().nodes || {})[arg.id] || {};
          return (n.tags || []).indexOf(arg.tag) >= 0 && (n._manualTags || []).indexOf(arg.tag) >= 0;
        }, { id: todoId, tag }), { message: '勾选后节点必须同时写入 tags 与 _manualTags', timeout: 20_000 })
        .toBe(true);
      const after = await page.evaluate((arg) => {
        const n = ((window as any).JU.getState().nodes || {})[arg.id] || {};
        return {
          tags: (n.tags || []).slice(),
          manual: (n._manualTags || []).slice(),
        };
      }, { id: todoId, tag });
      expect(after.manual, '勾选后 _manualTags 必须包含 #' + tag).toContain(tag);
      expect(after.tags, '勾选后 tags 必须包含 #' + tag).toContain(tag);
    } finally {
      await context.close();
    }
  });

  test('点击「排序切换」后，文档列表与标签列表首项顺序同步改变', async ({ browser }) => {
    const { context, page } = await openApp(browser);
    try {
      /* 三条文档，正文各带一个标签：#F5T3A→B 文档、#F5T3B→A 文档、#F5T3C→C 文档
         创建序 B→A→C ⇒ 名称升序 A,B,C 与 created/updated 降序 C,A,B 互不相同，可区分排序模式 */
      const watch = ['F5T3A', 'F5T3B', 'F5T3C'];
      await newDoc(page, 'F5T3DOCB #F5T3A');
      await newDoc(page, 'F5T3DOCA #F5T3B');
      await newDoc(page, 'F5T3DOCC #F5T3C');
      await ensureGroup(page, 'files');
      await ensureGroup(page, 'tags');
      await expect
        .poll(async () => memberTagOrder(await sidebarState(page), watch).length,
          { message: '三个标签都必须出现在侧栏', timeout: 20_000 })
        .toBe(3);

      const samples: {
        mode: string; sort: string | null; docs: string[]; docLabels: string[]; tags: string[]; expected: string[];
      }[] = [];
      const base = await sidebarState(page);
      samples.push({
        mode: 'name',
        sort: base.sort,
        docs: base.docs.map((d) => d.id),
        docLabels: base.docs.map((d) => d.label),
        tags: memberTagOrder(base, watch),
        expected: expectedMemberOrder(base, watch, 'name'),
      });

      for (let i = 1; i <= 4; i++) {
        const toast = await clickSort(page);
        const mode = MODE_BY_TOAST[toast] || ('click' + i);
        const st = await sidebarState(page);
        samples.push({
          mode,
          sort: st.sort,
          docs: st.docs.map((d) => d.id),
          docLabels: st.docs.map((d) => d.label),
          tags: memberTagOrder(st, watch),
          expected: expectedMemberOrder(st, watch, mode),
        });
      }

      /* ① 按钮确实循环了 5 种模式（name→type→created→updated→star） */
      expect(samples.map((s) => s.mode), '排序切换模式序列必须完整循环').toEqual(['name', 'type', 'created', 'updated', 'star']);

      /* ② 文档列表首项顺序必须变化（按钮生效） */
      const docFirsts = samples.map((s) => s.docs[0]);
      expect(new Set(docFirsts).size, '文档列表首项必须随排序切换变化').toBeGreaterThan(1);

      /* ③ 标签列表首项顺序必须同步变化（fix5 前为 0 次变化） */
      const tagOrders = samples.map((s) => s.tags.join('|'));
      expect(new Set(tagOrders).size, '标签列表顺序必须随排序切换变化（H2 回归）').toBeGreaterThan(1);
      const tagFirsts = samples.map((s) => s.tags[0]);
      expect(new Set(tagFirsts).size, '标签列表首项必须随排序切换变化').toBeGreaterThan(1);

      /* ④ 两种列表使用同一比较器：每个模式下标签顺序 == 代表文档在文档列表中的位次顺序 */
      for (const s of samples) {
        expect(s.tags, '[' + s.mode + '] 标签顺序必须与文档列表位次一致（同一比较器）').toEqual(s.expected);
      }

      /* ⑤ name 模式收尾口径：文档列表本身就是名称升序（sortDocs 的 name 分支），
           且 created/updated 模式的文档首项与 name 模式不同（证明状态真的换了） */
      const nameSample = samples[0];
      expect(nameSample.docLabels.length, '文档列表不应为空').toBeGreaterThan(0);
      expect(nameSample.docLabels.slice().sort(zc), 'name 模式文档顺序必须是名称升序').toEqual(nameSample.docLabels);
      expect(nameSample.tags.slice().sort(zc), 'name 模式标签顺序必须是标签名升序（compareZh）').toEqual(nameSample.tags);
      const updatedSample = samples.find((s) => s.mode === 'updated');
      expect(updatedSample, '必须采到 updated 模式样本').toBeTruthy();
      expect(updatedSample!.docs[0], 'updated 模式文档首项必须与 name 模式不同').not.toBe(nameSample.docs[0]);
      expect(updatedSample!.tags[0], 'updated 模式标签首项必须与 name 模式不同').not.toBe(nameSample.tags[0]);
    } finally {
      await context.close();
    }
  });

  test('排序状态在数据更新后实时生效（新关联标签无需再点按钮）', async ({ browser }) => {
    const { context, page } = await openApp(browser);
    try {
      const watch = ['F5T4A', 'F5T4B'];
      await newDoc(page, 'F5T4DOCB #F5T4A');
      await newDoc(page, 'F5T4DOCA #F5T4B');
      await ensureGroup(page, 'files');
      await ensureGroup(page, 'tags');
      await expect
        .poll(async () => memberTagOrder(await sidebarState(page), watch).length,
          { message: '两个标签都必须先出现', timeout: 20_000 })
        .toBe(2);

      /* 切到「按修改时间」：最新更新的文档代表的标签应居首 */
      let mode = 'name';
      for (let i = 0; i < 4 && mode !== 'updated'; i++) {
        const toast = await clickSort(page);
        mode = MODE_BY_TOAST[toast] || mode;
      }
      expect(mode, '必须能切到「按修改时间」模式').toBe('updated');
      const before = await sidebarState(page);
      expect(memberTagOrder(before, watch), '切到 updated 后必须先取位次参考').toEqual(expectedMemberOrder(before, watch, 'updated'));

      /* 数据更新：新建一条带全新标签的文档（updatedAt 最新），标签列表应立刻把它排到首位 */
      await newDoc(page, 'F5T4DOCC #F5T4C');
      await ensureGroup(page, 'tags');
      await expect
        .poll(async () => memberTagOrder(await sidebarState(page), ['F5T4A', 'F5T4B', 'F5T4C'])[0],
          { message: '最新文档的标签必须立刻排到标签列表首位（无需再点排序按钮）', timeout: 20_000 })
        .toBe('F5T4C');
      const after = await sidebarState(page);
      expect(after.sort, '排序状态不得被数据更新清掉').toBe('updated');
      expect(memberTagOrder(after, ['F5T4A', 'F5T4B', 'F5T4C']), '标签顺序必须与文档位次同步')
        .toEqual(expectedMemberOrder(after, ['F5T4A', 'F5T4B', 'F5T4C'], 'updated'));
    } finally {
      await context.close();
    }
  });
});
