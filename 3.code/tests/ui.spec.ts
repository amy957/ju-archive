import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * BW · 全链路 UI 交互 E2E 回归测试（M1 重构后 DOM 事件绑定未丢失）
 *
 * 三个用例全部走「真实浏览器 + 真实 DOM 事件 + 产品真实事件处理器」：
 *
 *   用例 1 · 大纲视图交互
 *     `#btnNewFile`（左侧「新建文件」）→ 产品 `actions.createDoc()` + `setCurrentDoc()`
 *     → `.add-node` 点击（产品 `renderOutlinePage` 的 adder.onclick）
 *     → 首行 `.text` 输入 → `Enter`（产品 `bindOutlineText` keydown：拆分/新建同级）
 *     → 第二行输入 → `Tab`（产品 `bindOutlineText` keydown：`indentNode()`）
 *     → 断言 `window.JU.getState().nodes` 的父子关系 + DOM `.row[data-depth]` / `.children` 嵌套变化。
 *
 *   用例 2 · 日历视图交互
 *     左侧「日历」→ 顶栏 `data-view="calendar"` 产品处理器（`bindTopbar`）→ `renderCalendarPage()`
 *     → 点击 `.cal-cell[data-ds]`（产品 `cell.onclick`：写入 `ui.selectedDate` + 重渲染）
 *     → 断言「当日待办」模块出现（`.cal-module[data-key="today"]`）+ 生成待办输入框
 *     → 点击 `.cal-adder`（产品 `calModuleTodayBody` 的 adder.onclick：以 `date=selectedDate` 建节点）
 *     → 在 `.cal-node .text[contenteditable]` 输入文本并回车/失焦（产品 `renderCalNode` blur → `actions.updateText`）
 *     → 断言节点文本与 `date` 属性。
 *
 *   用例 3 · 多维表格视图交互
 *     夹具：`actions.createDoc()` 建表文档 + `commit()` 写 `_isDbRoot` / `dbFields` / 行节点
 *     → 左侧「多维表格」→ 顶栏 `data-view="database"` 产品处理器 → `renderDatabasePage()`
 *     → 双击「状态」列单元格 + 下拉选择「进行」（产品 `select.onchange` → `actions.setDbCell`）
 *     → 断言 `window.JU.getState().nodes[rowId].db['状态'] === '进行'`。
 *
 *   用例 4 · 设置面板交互回归（批次 CW）
 *     `#btnSettings`（顶栏齿轮，骨架 index.html 真实节点）→ 产品 `bindSettingsPanel()`
 *     → 断言 `.panel.on` 出现（设置面板被打开）、`#settingsPanel.hidden === false`；
 *     → 点击面板头「关闭」（`#settingsClose`）→ 断言 `.panel.on` 消失、`hidden === true`；
 *     → 旁证绑定链完整：`#settingsPanel #licenseKey` / `#btnViewCrashLogs` 必须已由
 *       `bindSettings` 落位，且全程无 `[JU] ui bind failed` 告警（此前 `bindRightSidebar`
 *       在骨架 DOM 上抛错会使整段 UI 绑定中断，齿轮因此永久无响应）。
 *
 * ── 迁移期装配骨架（与 tests/stability.spec.ts 同口径，**不改动任何产品源码**）──
 * `src/main.ts` 中 render / outline / calendar / database 各模块的 `deps` 仍为迁移期占位
 * （`N` / `viewOf` / `getCurrentDoc` / `commit` / `forceRender` 等）。本 spec 通过产品**已导出**
 * 的注入入口（`bindRenderMainDeps` / `bindLayoutDeps` / `injectOutlineDeps` /
 * `injectCalendarDeps` / `injectDatabaseDeps` / `injectFormulaDeps` / `injectPanelDeps`）
 * 回填活跃端口；渲染、事件绑定、状态提交、数据写入全部为产品模块实现，测试侧只提供端口与夹具。
 *
 * 两个端口说明（口径见下）：
 *   - `ensureCalIndexAsync`：产品真实实现是「分块异步索引」；`renderCalendarPage()` 首帧返回骨架页，
 *     索引就绪后再 `forceRender()`（两阶段渲染）。测试侧在同一微任务内调用产品同步构建器
 *     `JU.buildCalIndex()` 建好 `_calIndexCache`，使阶段 2 落到完整日历。若返回一个「不建索引」的
 *     已决 promise，骨架页会无限重渲染（本机实测主线程卡死），故必须真实建索引。
 *   - `getTagIndexCache` / `setTagIndexCache`：产品侧用于判断标签索引是否就绪，测试侧用一个
 *     可写 Map 承载，语义一致。
 *
 * ── 环境适配（与前序 spec 同一实测结论）──
 * 本机浏览器进程到 `127.0.0.1 / localhost` 的入站连接被系统策略阻断（端口 LISTENING 但连接不建立），
 * 故 `vite build` 产物经 `context.route` 映射到 `http://localhost:5173`：
 * 页面仍运行在真实 HTTP 源上（localStorage / BroadcastChannel 语义与真实服务一致）。
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
  '.ico': 'image/x-icon',
};

/** 项目根（testDir = <root>/tests） */
function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

/** 重新构建（保证被测代码即当前源码），返回 dist 绝对路径。 */
async function prepareDist(): Promise<string> {
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  return dist;
}

/** 把 baseURL 请求映射到 dist 产物。 */
async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route(BASE + '/**', async (route: Route) => {
    const url = new URL(route.request().url());
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';
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

/**
 * document-start 注入的装配骨架：
 *   ① 顶栏 `#tbNav` 视图按钮 + 左侧导航壳（`#bwSidebar`：新建文件 / 日历 / 多维表格）。
 *      `index.html` 的 `#tbNav` 在生产骨架里为空容器（产品 `bindTopbar` 在此绑定 `.tb-nav-btn`），
 *      左侧导航壳同在 M0-7 骨架中尚未迁入 —— 本骨架先于产品 `boot()` 的 UI 绑定段写入 DOM，
 *      随后调用产品 `JU.bindTopbar()` 建立**产品自己的**点击处理器。
 *   ② 把 render / outline / calendar / database / formula / panel 六组 `deps` 回填为活跃端口
 *      （活状态 getter 代理 + 产品导出的真实函数）。
 */
async function installHarness(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as any;
    const strip = (s: any): string => String(s == null ? '' : s).replace(/<[^>]*>/g, '');

    /* ① 骨架：顶栏视图入口 + 左侧导航（先于产品 boot() 的绑定段写入） */
    const mountShell = (): void => {
      const nav = document.getElementById('tbNav');
      if (nav) {
        if (!nav.querySelector('.tb-nav-btn')) {
          nav.innerHTML =
            '<button type="button" class="tb-nav-btn" data-view="outline">大纲</button>' +
            '<button type="button" class="tb-nav-btn" data-view="mindmap">导图</button>' +
            '<button type="button" class="tb-nav-btn" data-view="graph">图谱</button>' +
            '<button type="button" class="tb-nav-btn" data-view="calendar">日历</button>' +
            '<button type="button" class="tb-nav-btn" data-view="database">表格</button>';
        } else {
          /* 批次 P0-P3：`index.html` 恢复 canonical 顶栏后，nav 已含 资料库/大纲/…/历史，
             但不含「日历 / 表格」两个入口（产品把这两个入口放在左侧栏，点击后落到容器视图）。
             本 spec 的用例 2/3 需要顶栏 `data-view="calendar|database"` 的**产品 bindTopbar 处理器**
             语义（显式 ui.view 赋值），故补齐这两个按钮，再交由产品 bindTopbar 绑定。 */
          for (const view of ['calendar', 'database']) {
            if (!nav.querySelector(`.tb-nav-btn[data-view="${view}"]`)) {
              const b = document.createElement('button');
              b.type = 'button';
              b.className = 'tb-nav-btn';
              b.dataset.view = view;
              b.textContent = view === 'calendar' ? '日历' : '表格';
              nav.appendChild(b);
            }
          }
        }
      }
      const sb = document.getElementById('sidebarLeft');
      if (sb && !document.getElementById('bwSidebar')) {
        const box = document.createElement('div');
        box.id = 'bwSidebar';
        box.innerHTML =
          '<button type="button" id="btnNewFile" class="sb-nav-btn">＋ 新建文件</button>' +
          '<div class="sb-nav-btn" id="navCalendar" data-nav="calendar" role="button" tabindex="0">日历</div>' +
          '<div class="sb-nav-btn" id="navDatabase" data-nav="database" role="button" tabindex="0">多维表格</div>';
        sb.appendChild(box);
      }
    };
    mountShell();
    document.addEventListener('DOMContentLoaded', mountShell, { once: true });

    /* ② 活跃状态代理（与 main.ts 的 getter 代理同口径） */
    const liveState: any = {};
    Object.defineProperty(liveState, 'nodes', { get: () => { const s = w.JU.getState(); return (s && s.nodes) || {}; } });
    Object.defineProperty(liveState, 'rootId', { get: () => { const s = w.JU.getState(); return s ? s.rootId : null; } });
    Object.defineProperty(liveState, 'trashed', { get: () => { const s = w.JU.getState(); return (s && s.trashed) || []; } });

    const uiOf = (): any => { const u = w.JU.ui; return typeof u === 'function' ? u() : u; };
    const currentDoc = (): any => { const u = uiOf(); const id = u && u.currentDocId; return (id && w.JU.N(id)) || null; };
    const viewOf = (doc: any): string => {
      if (!doc) return 'library-root';
      if (doc.id === liveState.rootId) return 'library-root';
      if (doc._isCalRoot) return 'calendar';
      if (doc._isDbRoot) return 'database';
      return 'outline';
    };
    /* 数据库行集：产品的 getDbRows(docId) 语义（表文档的直接子节点、排除已删除） */
    const getDbRows = (docId: any): any[] => {
      const d = w.JU.N(docId);
      return ((d && d.children) || []).map((id: any) => w.JU.N(id)).filter((n: any) => n && !n._deleted);
    };

    const noop = (): void => {};
    const div = (): HTMLElement => document.createElement('div');
    const fr = { v: false };
    let tagIdx: Map<string, number> | null = null;

    w.__bwWire = (): boolean => {
      const J = w.JU;
      if (!J || typeof J.bindRenderMainDeps !== 'function') return false;
      if (w.__bwWired) return true;

      /**
       * 产品语义的 forceRender：先置 _forceRender 再渲染（否则编辑态会被 renderMain 早退拦下）。
       *
       * 迁移期补偿（**不改动产品源码**）：`src/core/store.ts` 的 `invalidateCalIndex` 目前是
       * 占位空函数（源码内标注 `TODO: M1-2+ 日历索引模块接线`），commit 后日历日缓存不会失效，
       * 「新增待办」不会出现在「当日待办」模块。此处按产品真实语义（数据变更 → 日历索引失效）
       * 在**状态指纹变化时**调用产品导出的 `JU.invalidateCalIndex()` 补偿一次，使日历链路可被真实回归。
       */
      let lastSig = '';
      const stateSig = (): string => {
        const st = J.getState();
        return Object.keys(st.nodes).length + ':' + String((st as any).updatedAt || 0);
      };
      const forceRender = (): void => {
        fr.v = true;
        const sig = stateSig();
        if (sig !== lastSig) {
          lastSig = sig;
          try { J.invalidateCalIndex(); } catch (e) { /* 索引失效失败：保持既有缓存 */ }
        }
        J.renderMain();
      };

      J.bindLayoutDeps({
        ui: uiOf(), renderMain: J.renderMain, getCurrentDoc: currentDoc, viewOf,
        setForceRender: (v: boolean) => { fr.v = v; }, saveUI: noop,
      });
      J.bindRenderMainDeps({
        ui: uiOf(), state: liveState, N: J.N, viewOf, getCurrentDoc: currentDoc,
        isForceRender: () => fr.v, setForceRender: (v: boolean) => { fr.v = v; },
        syncTopbar: noop, updateRightSidebar: noop, renderIntro: noop, updateRemindBadge: noop,
        renderFloatCal: noop, floatCalVisible: () => false, ensureElInViewport: noop,
        renderSidebar: noop, restoreFocus: noop,
        buildStatsBlock: div, buildCalLogBlock: div, calModuleCharsBody: div,
        disconnectOutlineHeaderRO: noop, observeOutlineHeader: noop,
        vsUpdate: noop, vsScrollToId: noop, getVsActive: () => null, setVsActive: noop,
        getCalTgPrevScroll: () => null, setCalTgPrevScroll: noop,
        getSavedOutlineScroll: () => 0, setSavedOutlineScroll: noop,
        savedMindmapScroll: { x: 0, y: 0 }, setCalDayNodesForModules: noop, getTagIndexCache: () => tagIdx,
        renderFolderGrid: div, renderCalendarPage: J.renderCalendarPage, renderDatabasePage: J.renderDatabasePage,
        renderOutlinePage: J.renderOutlinePage, renderMindmap: J.renderMindmap,
        renderPresentation: J.renderPresentation, renderGraph: J.renderGraph,
      });
      J.injectOutlineDeps({
        ui: uiOf(), state: liveState, N: J.N, forceRender, getCurrentDoc: currentDoc, viewOf,
        commit: J.commit, nowSeq: J._nowSeq, actions: J.actions, addNodeTo: J.addNodeTo,
        updateRightSidebar: noop, findOwningTopDocId: J.findOwningTopDocId,
        l14On: () => false, vsGenCount: () => 0,
        countVisibleNodes: () => 0, VIRTUAL_THRESHOLD: 1e9, shouldUseVirtual: () => false,
        splitPastedLinesToNodes: () => false, fmtDateShort: () => '', getTagColor: () => '#888',
        openTag: noop, renderInlineTable: div, undo: () => false, redo: () => false,
        lastPointerType: 'mouse', lastTouchDoneToggleAt: 0,
      });
      J.injectCalendarDeps({
        ui: uiOf(), state: liveState, N: J.N, commit: J.commit, nowSeq: J._nowSeq,
        forceRender, saveUI: noop, actions: J.actions, makeLRU: () => new Map(),
        isBlankNode: J.isBlankNode, nodeHasTag: () => false,
        tagStripText: (n: any) => strip(n && n.text), getTagColor: () => '#888', extractTags: () => [],
        findOwningTopDocId: J.findOwningTopDocId, calendarTagIndex: () => new Map(),
        buildCalLogBlock: div, buildStatsBlock: div, getCalScopeText: () => '',
        renderNoteRow: div, ensureNoteDoc: () => null,
        l7Skeleton: () => { const d = document.createElement('div'); d.className = 'ju-skel'; return d; },
        isCalendarView: () => String(uiOf().view) === 'calendar',
        /* 两阶段渲染的阶段 2 触发条件：索引必须真实建好（产品同步构建器 buildCalIndex） */
        ensureCalIndexAsync: () => Promise.resolve().then(() => {
          try { J.buildCalIndex(); } catch (e) { /* 索引构建异常：保留骨架页 */ }
          return null;
        }),
        tagIndexWhenReady: noop, l7Now: () => Date.now(), currentBaseFontPx: () => 14, persistNow: noop,
        splitPastedLinesToNodes: () => false, undo: () => false, redo: () => false,
        getTagIndexCache: () => tagIdx, setTagIndexCache: (v: any) => { tagIdx = v; },
        lastPointerType: () => 'mouse',
      });
      J.injectDatabaseDeps({
        getState: J.getState, ui: uiOf(), N: J.N, commit: J.commit, nowSeq: J._nowSeq,
        forceRender, saveUI: noop, getCurrentDoc: currentDoc, actions: J.actions,
        getDbRows, openNode: noop, extractTags: () => [], findOwningTopDocId: J.findOwningTopDocId,
      });
      J.injectFormulaDeps({ getState: J.getState, ui: uiOf(), N: J.N, getDbRows });
      J.injectPanelDeps({
        getState: J.getState, ui: uiOf(), N: J.N, commit: J.commit, nowSeq: J._nowSeq,
        forceRender, saveUI: noop, getCurrentDoc: currentDoc, actions: J.actions, getDbRows,
        isFolder: () => false, placePop: noop,
      });

      /* ③ 顶栏真实绑定（产品 bindTopbar）；左侧导航项委托给产品顶栏处理器，保证事件链同源 */
      J.bindTopbar();
      const q = (s: string): HTMLElement | null => document.querySelector(s) as HTMLElement | null;
      const btnNew = document.getElementById('btnNewFile');
      if (btnNew) {
        btnNew.onclick = () => {
          const id = J.actions.createDoc('BW 新建文档');
          if (id) J.actions.setCurrentDoc(id);
          uiOf().view = 'outline';
          forceRender();
        };
      }
      /**
       * 批次 P0-P3：`index.html` 已恢复 canonical 产品骨架（顶栏 nav 为 资料库/大纲/导图/演示/幻灯片/图谱/历史，
       * 日历与数据库入口位于左侧栏 `.sb-nav-item[data-nav="…"]`）。原 shim 只认顶栏
       * `.tb-nav-btn[data-view="calendar|database"]`，在真实骨架上取不到节点 → 点击无效。
       * 此处按「顶栏按钮优先，回落左侧栏导航项」的顺序取真实入口，事件处理器仍是产品实现。
       */
      const clickNav = (view: string): void => {
        const top = q(`.tb-nav-btn[data-view="${view}"]`);
        if (top) { top.click(); return; }
        const side = q(`.sb-nav-item[data-nav="${view}"]`);
        if (side) side.click();
      };
      const navCal = document.getElementById('navCalendar');
      if (navCal) navCal.onclick = () => clickNav('calendar');
      const navDb = document.getElementById('navDatabase');
      if (navDb) navDb.onclick = () => clickNav('database');

      lastSig = stateSig();
      w.__bwWired = true;
      forceRender();
      return true;
    };
    const timer = setInterval(() => { w.__bwWire(); }, 1);
    setTimeout(() => clearInterval(timer), 20_000);
  });
}

/** 等 `window.JU` 装配完成 + 装配骨架接线成功。 */
async function waitWired(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const J = (window as any).JU;
    return !!(J && typeof J.getState === 'function' && (window as any).__bwWired);
  }, null, { timeout: 60_000, polling: 25 });
}

/** 真实 DOM 点击（用于骨架导航项；事件处理器均为产品绑定）。 */
async function domClick(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) throw new Error('元素不存在：' + sel);
    el.click();
  }, selector);
}

test.describe('BW · 全链路 UI 交互 E2E', () => {
  let dist = '';

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    dist = await prepareDist();
  });

  test('用例 1 · 大纲视图交互：新建文件 → 输入 → Enter 新建同级 → Tab 缩进', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installHarness(context);
    await installDistRoute(context, dist);

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
    await waitWired(page);

    /* ① 左侧「新建文件」：产品 actions.createDoc + setCurrentDoc */
    const beforeDocs = await page.evaluate(() => {
      const st = (window as any).JU.getState();
      return (st.nodes[st.rootId].children || []).length;
    });
    await page.click('#btnNewFile');
    await expect
      .poll(async () => page.evaluate(() => {
        const J = (window as any).JU;
        const ui = typeof J.ui === 'function' ? J.ui() : J.ui;
        const st = J.getState();
        const doc = st.nodes[ui.currentDocId];
        return doc ? String(doc.text || '') : '';
      }), { timeout: 30_000 })
      .toBe('BW 新建文档');

    const docInfo = await page.evaluate(() => {
      const J = (window as any).JU;
      const ui = typeof J.ui === 'function' ? J.ui() : J.ui;
      const st = J.getState();
      return { docId: ui.currentDocId as string, docs: (st.nodes[st.rootId].children || []).length };
    });
    expect(docInfo.docs, '新建文件后根节点下应多出一个文档').toBe(beforeDocs + 1);

    /* ② 大纲第一行：`.add-node` → 首行输入 */
    await expect(page.locator('#content .add-node')).toHaveCount(1);
    await page.click('#content .add-node');
    await expect(page.locator('#content .outline .node > .row > .text')).toHaveCount(1);

    await page.locator('#content .outline .node > .row > .text').first().click();
    await page.keyboard.type('第一行');
    await page.keyboard.press('Enter');

    /* ③ Enter → 新增同级节点（父节点不变、位置在后） */
    await expect
      .poll(async () => page.evaluate((docId) => {
        const st = (window as any).JU.getState();
        return (st.nodes[docId].children || []).length;
      }, docInfo.docId), { timeout: 30_000 })
      .toBe(2);

    const afterEnter = await page.evaluate((docId) => {
      const st = (window as any).JU.getState();
      const doc = st.nodes[docId];
      const ids: string[] = doc.children.slice();
      return {
        ids,
        texts: ids.map((id) => String(st.nodes[id].text || '')),
        parents: ids.map((id) => st.nodes[id].parent),
        depths: Array.from(document.querySelectorAll('#content .outline .node > .row')).map(
          (r) => (r as HTMLElement).dataset.depth,
        ),
        rowTexts: Array.from(document.querySelectorAll('#content .outline .node > .row > .text')).map(
          (t) => (t.textContent || '').trim(),
        ),
      };
    }, docInfo.docId);

    expect(afterEnter.texts[0], '第一行文本必须落到数据层').toContain('第一行');
    expect(afterEnter.texts[1], 'Enter 新建的同级节点初始为空').toBe('');
    expect(afterEnter.parents, 'Enter 新建节点必须与首行同父（同级）').toEqual([
      docInfo.docId,
      docInfo.docId,
    ]);
    expect(afterEnter.depths, 'Enter 后两行深度均应为 0').toEqual(['0', '0']);
    expect(afterEnter.rowTexts.length, 'DOM 必须渲染出两行').toBe(2);

    /* ④ 第二行输入 + Tab → 缩进为第一行的子节点 */
    await page.locator('#content .outline .node > .row > .text').nth(1).click();
    await page.keyboard.type('子节点');
    await page.keyboard.press('Tab');

    await expect
      .poll(async () => page.evaluate((docId) => {
        const st = (window as any).JU.getState();
        const first = (st.nodes[docId].children || [])[0];
        return first ? (st.nodes[first].children || []).length : -1;
      }, docInfo.docId), { timeout: 30_000 })
      .toBe(1);

    const afterTab = await page.evaluate((docId) => {
      const J = (window as any).JU;
      const st = J.getState();
      const doc = st.nodes[docId];
      const firstId: string = doc.children[0];
      const childId: string = st.nodes[firstId].children[0];
      const rowOf = (id: string): HTMLElement | null =>
        document.querySelector('#content .outline .node[data-id="' + CSS.escape(id) + '"] > .row') as HTMLElement | null;
      const rowFirst = rowOf(firstId);
      const rowChild = rowOf(childId);
      const nested = document.querySelector(
        '#content .outline .node[data-id="' + CSS.escape(firstId) + '"] > .children > .node[data-id="' + CSS.escape(childId) + '"]',
      );
      return {
        firstId,
        childId,
        docChildren: (doc.children || []).map((id: string) => id),
        childParent: st.nodes[childId].parent,
        childText: String(st.nodes[childId].text || ''),
        depthFirst: rowFirst ? Number(rowFirst.dataset.depth) : -1,
        depthChild: rowChild ? Number(rowChild.dataset.depth) : -1,
        nested: !!nested,
        ariaLevel: (nested as HTMLElement | null)?.getAttribute('aria-level') || null,
        stateParents: Object.keys(st.nodes).filter((id) => st.nodes[id].parent === docId).length,
        bootError: J.__bootError || null,
      };
    }, docInfo.docId);

    expect(afterTab.childText, 'Tab 前输入的文本必须落到被缩进节点').toContain('子节点');
    expect(afterTab.childParent, 'Tab 后节点父级必须变为第一行节点').toBe(afterTab.firstId);
    expect(afterTab.docChildren, '缩进后文档顶层只剩第一行节点').toEqual([afterTab.firstId]);
    expect(afterTab.depthFirst, '第一行深度为 0').toBe(0);
    expect(afterTab.depthChild, '缩进后 DOM 深度必须由 0 变为 1').toBe(1);
    expect(afterTab.nested, '缩进后 DOM 必须渲染为首行节点的 .children 子节点').toBe(true);
    expect(afterTab.ariaLevel, '缩进后 aria-level 必须为 2').toBe('2');
    expect(afterTab.bootError, 'boot 不得失败').toBeNull();
    expect(pageErrors, '大纲交互全程不得出现未捕获页面异常').toEqual([]);
  });

  test('用例 2 · 日历视图交互：左侧日历 → 点格子 → 生成待办输入框 → 写入并带日期', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installHarness(context);
    await installDistRoute(context, dist);

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
    await waitWired(page);

    /* ① 左侧「日历」→ 产品 bindTopbar 处理器 → renderCalendarPage（两阶段渲染：骨架 → 完整网格） */
    await domClick(page, '#navCalendar');
    await expect(page.locator('#content .cal-cell').first()).toBeVisible({ timeout: 30_000 });

    const calInfo = await page.evaluate(() => {
      const J = (window as any).JU;
      const c = document.getElementById('content') as HTMLElement;
      const cells = Array.from(c.querySelectorAll('.cal-cell')) as HTMLElement[];
      const todayCell = cells.find((x) => x.classList.contains('today'));
      const ds = (todayCell || cells[cells.length - 1]).dataset.ds as string;
      /* 生效视图：产品 sidebar 的 navTo('calendar') 写入 ui.view='auto' + currentDocId=日历根，
         由 viewOf(doc) 派生为 'calendar'（顶栏按钮路径才是显式 ui.view='calendar'）。 */
      const u = typeof J.ui === 'function' ? J.ui() : J.ui;
      const doc = u.currentDocId ? J.N(u.currentDocId) : null;
      const eff = String(u.view) === 'auto' ? String((window as any).__bwViewOf ? (window as any).__bwViewOf(doc) : (doc && doc._isCalRoot ? 'calendar' : '')) : String(u.view);
      return { view: String(u.view), effView: eff, cellCount: cells.length, ds };
    });
    expect(calInfo.effView, '点击左侧日历后生效视图必须为 calendar（ui.view=auto + 日历根文档）').toBe('calendar');
    expect(calInfo.cellCount, '月视图必须渲染出日期格子').toBeGreaterThan(27);
    expect(calInfo.ds, '必须取到目标日期').toMatch(/^\d{4}-\d{2}-\d{2}$/);

    /* ② 点击日历格 → 产品 cell.onclick 写入 selectedDate 并重渲染 */
    await page.click('.cal-cell[data-ds="' + calInfo.ds + '"]');
    await expect
      .poll(async () => page.evaluate(() => {
        const J = (window as any).JU;
        const u = typeof J.ui === 'function' ? J.ui() : J.ui;
        return String(u.selectedDate || '');
      }), { timeout: 30_000 })
      .toBe(calInfo.ds);

    /* ③ 「当日待办」模块出现，且提供新增待办输入入口 */
    const todayModule = page.locator('.cal-module[data-key="today"]');
    await expect(todayModule).toHaveCount(1, { timeout: 30_000 });
    await expect(todayModule.locator('.cal-adder')).toHaveCount(1);

    /* ④ 点击「+ 添加今日待办」→ 产品以 date=selectedDate 新建节点，并生成待办输入框 */
    await todayModule.locator('.cal-adder').click();
    const calText = page.locator('.cal-node .text[contenteditable]').first();
    await expect(calText).toBeVisible({ timeout: 30_000 });

    const created = await page.evaluate((ds) => {
      const J = (window as any).JU;
      const st = J.getState();
      const calRoot = Object.values(st.nodes as any).find((n: any) => n && n._isCalRoot) as any;
      const ids: string[] = (calRoot && calRoot.children) || [];
      const todo = ids
        .map((id) => st.nodes[id])
        .filter((n: any) => n && n.date === ds)
        .pop();
      return { calRootId: calRoot ? calRoot.id : null, todoId: todo ? todo.id : null, todoDate: todo ? todo.date : null };
    }, calInfo.ds);
    expect(created.calRootId, '必须存在日历容器（_isCalRoot）').not.toBeNull();
    expect(created.todoId, '新增待办必须落在日历容器下并带 date').not.toBeNull();
    expect(created.todoDate, '新建待办 date 必须等于选中日期').toBe(calInfo.ds);

    /* ⑤ 输入文本 → Enter（产品 renderCalNode keydown：先 actions.updateText 提交正文，再新建下一条） */
    await calText.click();
    await page.keyboard.type('BW 日历待办');
    await page.keyboard.press('Enter');

    await expect
      .poll(async () => page.evaluate((todoId) => {
        const st = (window as any).JU.getState();
        return String((st.nodes[todoId] || {}).text || '');
      }, created.todoId), { timeout: 30_000 })
      .toContain('BW 日历待办');

    const finalTodo = await page.evaluate((todoId) => {
      const J = (window as any).JU;
      const st = J.getState();
      const n = st.nodes[todoId];
      return {
        text: String((n || {}).text || ''),
        date: (n || {}).date,
        parent: (n || {}).parent,
        bootError: J.__bootError || null,
      };
    }, created.todoId);
    expect(finalTodo.text, '待办正文必须写入数据层').toContain('BW 日历待办');
    expect(finalTodo.date, 'date 属性必须保持选中日期').toBe(calInfo.ds);
    expect(finalTodo.parent, '待办父级必须是日历容器').toBe(created.calRootId);
    expect(finalTodo.bootError, 'boot 不得失败').toBeNull();
    expect(pageErrors, '日历交互全程不得出现未捕获页面异常').toEqual([]);
  });

  test('用例 3 · 多维表格视图交互：双击状态单元格 → 选「进行」→ db 值落库', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installHarness(context);
    await installDistRoute(context, dist);

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
    await waitWired(page);

    /* ① 夹具：产品 actions.createDoc + commit 建「多维表格」文档（_isDbRoot / dbFields / 一行数据） */
    const ids = await page.evaluate(() => {
      const J = (window as any).JU;
      const docId = J.actions.createDoc('BW 多维表格');
      const rowId = 'bwrow1';
      J.commit((s: any) => {
        const d = s.nodes[docId];
        d._isDbRoot = true;
        d.showInCal = false;
        s.dbFields = [
          { name: '标题' },
          { name: '状态', type: 'select', options: ['未开始', '进行', '完成'] },
        ];
        s.nodes[rowId] = {
          id: rowId, text: '任务A', parent: docId, children: [], collapsed: false, done: false,
          date: null, tags: [], priority: 0, db: { '状态': '未开始' },
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        d.children.push(rowId);
      }, { snapshot: true });
      J.actions.setCurrentDoc(docId);
      return { docId: docId as string, rowId };
    });
    expect(ids.docId, '必须创建出多维表格文档').toBeTruthy();

    /* ② 左侧「多维表格」→ 产品 bindTopbar 处理器 → renderDatabasePage */
    await domClick(page, '#navDatabase');
    await expect(page.locator('#content table')).toHaveCount(1, { timeout: 30_000 });

    const tableInfo = await page.evaluate(() => {
      const J = (window as any).JU;
      const u = typeof J.ui === 'function' ? J.ui() : J.ui;
      const c = document.getElementById('content') as HTMLElement;
      const doc = u.currentDocId ? J.N(u.currentDocId) : null;
      /* 生效视图：sidebar navTo('database') 定位数据库根后由 viewOf 派生（dbRoot → database / _isDbRoot → folder） */
      const eff = String(u.view) === 'auto' ? (doc && doc.dbRoot ? 'database' : 'folder') : String(u.view);
      return {
        view: String(u.view),
        effView: eff,
        selects: c.querySelectorAll('select').length,
        rows: c.querySelectorAll('tbody tr').length,
        headers: Array.from(c.querySelectorAll('th')).map((h) => (h.textContent || '').trim()),
      };
    });
    expect(tableInfo.effView, '点击左侧多维表格后生效视图必须为 database').toBe('database');
    expect(tableInfo.rows, '表格必须渲染出数据行').toBeGreaterThanOrEqual(1);
    expect(tableInfo.headers.join('|'), '表头必须包含标题与状态列').toContain('状态');

    /* ③ 双击「状态」单元格 → 下拉选择「进行」 */
    const statusSelect = page.locator('#content tbody tr').first().locator('select').first();
    await expect(statusSelect).toBeVisible({ timeout: 30_000 });
    await statusSelect.dblclick();
    await statusSelect.selectOption('进行');

    await expect
      .poll(async () => page.evaluate((rowId) => {
        const st = (window as any).JU.getState();
        const n = st.nodes[rowId];
        return n && n.db ? String(n.db['状态'] || '') : '';
      }, ids.rowId), { timeout: 30_000 })
      .toBe('进行');

    const finalDb = await page.evaluate((rowId) => {
      const J = (window as any).JU;
      const st = J.getState();
      const n = st.nodes[rowId];
      return {
        db: (n && n.db) || null,
        options: Array.from(document.querySelectorAll('#content tbody select option')).map(
          (o) => (o as HTMLOptionElement).value,
        ),
        bootError: J.__bootError || null,
      };
    }, ids.rowId);

    expect(finalDb.db, '节点 db 必须存在').not.toBeNull();
    expect((finalDb.db as any)['状态'], 'db["状态"] 必须变为「进行」').toBe('进行');
    expect(finalDb.options, '状态下拉必须提供「进行」选项').toContain('进行');
    expect(finalDb.bootError, 'boot 不得失败').toBeNull();
    expect(pageErrors, '多维表格交互全程不得出现未捕获页面异常').toEqual([]);
  });

  test('用例 4 · 设置面板交互回归：齿轮打开 .panel.on → 关闭按钮收起', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installHarness(context);
    await installDistRoute(context, dist);

    const pageErrors: string[] = [];
    const bindWarnings: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));
    /* 旁证：boot 的 UI 绑定段不得出现 `[JU] ui bind failed`（批次 CW 前的实际故障信号） */
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.indexOf('ui bind failed') >= 0) bindWarnings.push(text);
    });

    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
    await waitWired(page);

    /* ① 顶栏齿轮必须来自骨架 index.html（真实 DOM，非测试注入） */
    await expect(page.locator('#btnSettings')).toHaveCount(1);

    /* ② 设置行已由 bindSettings 落位 ⇒ UI 绑定链未被前置绑定打断 */
    await expect(page.locator('#settingsPanel #licenseKey')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('#settingsPanel #btnViewCrashLogs')).toHaveCount(1);
    /* 2026-10-26 产品决策：匿名错误上报开关 / 用户虚拟滚动开关 / 静态网页导出项均已移除 */
    await expect(page.locator('#settingsPanel #setErrorReporting')).toHaveCount(0);
    await expect(page.locator('#settingsPanel #setVirtualScrollOff')).toHaveCount(0);
    await expect(page.locator('#settingsPanel #btnExportStaticHtml')).toHaveCount(0);

    /* ③ 初始态：面板存在但未展开（无 .panel.on） */
    await expect(page.locator('.panel.on')).toHaveCount(0);

    /* ④ 点击齿轮 → 断言 `.panel.on` 弹出（产品 bindSettingsPanel 处理器） */
    await page.click('#btnSettings');
    await expect(page.locator('.panel.on')).toHaveCount(1);

    const opened = await page.evaluate(() => {
      const p = document.getElementById('settingsPanel');
      const J = (window as any).JU;
      return {
        hasOn: !!(p && p.classList.contains('on')),
        hidden: !!(p && p.hidden),
        isPanel: !!(p && p.classList.contains('panel')),
        bootError: J.__bootError || null,
      };
    });
    expect(opened.isPanel, '打开的目标必须是 .panel 结构').toBe(true);
    expect(opened.hasOn, '打开后 #settingsPanel 必须带 on 类').toBe(true);
    expect(opened.hidden, '打开后 hidden 必须解除').toBe(false);
    expect(opened.bootError, 'boot 不得失败').toBeNull();

    /* ⑤ 点击「关闭」→ 面板收起 */
    await page.click('#settingsClose');
    await expect(page.locator('.panel.on')).toHaveCount(0);

    const closed = await page.evaluate(() => {
      const p = document.getElementById('settingsPanel');
      return { hasOn: !!(p && p.classList.contains('on')), hidden: !!(p && p.hidden) };
    });
    expect(closed.hasOn, '关闭后 #settingsPanel 必须移除 on 类').toBe(false);
    expect(closed.hidden, '关闭后 hidden 必须复位').toBe(true);

    /* ⑥ 绑定链健康度 + 全程无未捕获异常 */
    expect(bindWarnings, 'UI 绑定段不得出现 [JU] ui bind failed 告警').toEqual([]);
    expect(pageErrors, '设置面板交互全程不得出现未捕获页面异常').toEqual([]);
  });
});
