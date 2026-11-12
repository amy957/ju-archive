import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * CI · 终极全链路 E2E 业务验收（加解密 / 导入导出 / 多视图联动）
 *
 * 三个用例全部运行在真实 Chromium + 真实 HTTP 源（http://localhost:5173）上，
 * 数据写入真实 localStorage，下载事件为真实浏览器下载（Playwright download 事件 + 落盘文件读取）。
 *
 *   用例 1 · 加密与解锁闭环
 *     设置入口的「全库加密」开关 → 主密码 test123 → 产品 `core/persist` 加密分支
 *     （`encryptState` AES-GCM-256 + `writeEncryptedStore` 写 `juju.enc.v1`，删除明文 `juju.store.v31`）
 *     → 刷新页面 → 产品 `promptUnlock()` 锁定界面（`#unlockPwd` 解锁模态）
 *     → 错误密码被拒（AES-GCM 认证失败）→ 正确密码解密 → 主界面恢复且数据零丢失。
 *
 *   用例 2 · 导入与导出闭环
 *     `window.JU.handleImportFiles([File])` 导入 3 节点 JSON（产品 `io/import.ts` 真实分支：
 *     `validateImportedTree` → 产品 `appConfirm` 二次确认 → `initStore()` 整体装载 → `ensureCalendarRoot()`）
 *     → 大纲渲染导入节点 → 点击「导出 Markdown」→ 产品 `doDownload('md')` → `toMarkdown()` → `download()`
 *     → 拦截浏览器 download 事件，读取下载文件正文，断言包含导入节点文本。
 *
 *   用例 3 · 多维表格与日历联动
 *     `actions.createDoc()` 建多维表格文档（`_isDbRoot` + `dbFields` 标题/日期）
 *     → 表格视图点击产品「+ 行」按钮（`actions.addDbRow`）
 *     → 行右键菜单（产品 `showDbRowContext`）点击「添加到日历」（产品 `actions.setNodeDate(id, todayStr())`）
 *     → 顶栏切日历视图 → 点击今日格子 → 「当日待办」模块出现该表格行文本。
 *
 * ── 迁移期装配说明（不改动产品源码；与 tests/ui.spec.ts 同口径）──
 * `src/main.ts` 中 render / outline / calendar / database / panel 各模块的 `deps` 仍有迁移期占位
 * （`N` / `viewOf` / `getCurrentDoc` / `commit` / `forceRender` 等）。本 spec 通过产品**已导出**的
 * 注入入口（`bindLayoutDeps` / `bindRenderMainDeps` / `injectOutlineDeps` / `injectCalendarDeps` /
 * `injectDatabaseDeps` / `injectFormulaDeps` / `injectPanelDeps` / `injectExportDeps`）回填活跃端口；
 * 渲染、事件绑定、状态提交、加解密、导入解析、下载全部为产品模块实现，测试侧只提供端口与夹具。
 *
 * 设置面板同理：`src/main.ts` 的 `bindSettings` 仍只绑定「匿名错误上报」开关
 * （见 `src/main.ts` 中 `bindSettings: () => { bindErrorReportingSwitch(); }`），
 * 完整的 `showSetPasswordDialog` 仍在 canonical HTML 内。本 spec 注入设置面板壳
 * （`#settingsPanel` + `#setEncrypt`）并用产品 `appPrompt` 收集主密码，随后仅设置
 * `ui.encrypted / ui.encKey` 并触发一次产品 `commit` + `flushPersistNow()`；
 * 密文生成与落盘、明文清除、刷新后的锁定 / 解密 / 数据回填全部由产品代码完成。
 *
 * ── 环境适配（与前序 spec 同一实测结论）──
 * 本机浏览器进程到 127.0.0.1 / localhost 的入站连接被系统策略阻断，故以 `vite build`
 * 产物 + `context.route` 承载：页面仍运行在 `http://localhost:5173` 真实 HTTP 源上，
 * localStorage / BroadcastChannel / download 语义与真实服务一致。
 */

const BASE = 'http://localhost:5173';
const STORE_KEY = 'juju.store.v31';
const ENC_KEY = 'juju.enc.v1';
const ENC_ITER = 600000;

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
 * document-start 注入装配骨架：
 *   ① 顶栏视图入口（大纲 / 日历 / 表格）+ 设置入口与设置面板壳（全库加密开关）
 *   ② 左侧导航壳（新建文件 / 日历 / 多维表格 / 导出 Markdown）
 *   ③ `#ctxMenu`（产品 `showContextMenu` 的目标容器）
 *   ④ 把 render / outline / calendar / database / formula / panel / export 七组 deps 回填为活跃端口
 */
async function installHarness(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as any;
    const strip = (s: any): string => String(s == null ? '' : s).replace(/<[^>]*>/g, '');

    /**
     * 全库加密开关绑定（幂等）：产品 `appPrompt` 收集主密码 → 置 ui 加密态 → 一次产品 commit + 立即落盘。
     * 从 `__feWire` 内联段抽出，使「面板由产品后创建 / 被产品重建」时也能随时重新绑定。
     */
    const bindSetEncrypt = (): void => {
      const J = w.JU;
      const sw = document.getElementById('setEncrypt') as any;
      if (!J || !sw || sw.__feBound) return;
      /* 【第十轮 fix10】产品已在设置面板内提供真实「全库加密」开关并绑定 handler
         （boot.bindSettingsRows → showSetPasswordDialog）。此时夹具**不得覆盖**产品处理器，
         否则会把真实的「设置主密码」面板换成夹具的 appPrompt 桩。仅当开关是夹具自建时才代绑。 */
      if (!w.__feInjectedEnc) return;
      sw.__feBound = true;
      sw.onclick = (): void => {
        const seedId = w.__feSeedNodeId;
        const liveUi = (): any => { const u = J.ui; return typeof u === 'function' ? u() : u; };
        J.appPrompt('设置主密码（全库加密）', '', (v: string | null) => {
          if (!v) return;
          const U = liveUi();
          U.encrypted = true;
          U.encKey = v;
          if (seedId && J.N(seedId)) {
            J.commit((s: any) => {
              const n = s.nodes[seedId];
              if (!n) return;
              n.note = 'fe-enc-probe';
              n.updatedAt = Date.now();
            }, { snapshot: true });
          }
          J.flushPersistNow();
          sw.classList.add('on');
          w.__feEncPwd = v;
        });
      };
    };
    w.__feBindSetEncrypt = bindSetEncrypt;

    const mountShell = (): void => {
      const host = document.body;
      if (!host) return;

      const nav = document.getElementById('tbNav');
      if (nav) {
        if (!nav.querySelector('.tb-nav-btn')) {
          nav.innerHTML =
            '<button type="button" class="tb-nav-btn" data-view="outline">大纲</button>' +
            '<button type="button" class="tb-nav-btn" data-view="mindmap">导图</button>' +
            '<button type="button" class="tb-nav-btn" data-view="calendar">日历</button>' +
            '<button type="button" class="tb-nav-btn" data-view="database">表格</button>';
        } else {
          /* 批次 P0-P3：`index.html` 恢复 canonical 顶栏（资料库/大纲/导图/演示/幻灯片/图谱/历史）。
             产品把「日历 / 表格」入口放在左侧栏，顶栏不含这两个 data-view；本 spec 的
             `clickTopbarView('calendar'|'database')` 依赖顶栏按钮的产品 bindTopbar 语义，
             故幂等补齐这两个按钮后由产品 bindTopbar 绑定。 */
          for (const view of ['calendar', 'database']) {
            if (!nav.querySelector('.tb-nav-btn[data-view="' + view + '"]')) {
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

      const right = document.querySelector('#topbar .tb-right');
      if (right && !document.getElementById('btnSettings')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.id = 'btnSettings';
        b.textContent = '设置';
        right.insertBefore(b, right.firstChild);
      }

      /* 设置面板：产品自带的 `ensureSettingsPanel()`（src/ui/layout.ts）会在 DOMContentLoaded 期
         先行创建 `#settingsPanel`，因此**不能**以「面板不存在」为注入前提——那样在产品先生成面板时
         `#setEncrypt` 永远不会出现（本用例红灯根因）。改为「面板存在则复用、缺失才建」，
         并把「全库加密」开关行幂等补进面板主体。 */
      let panel = document.getElementById('settingsPanel') as HTMLElement | null;
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'settingsPanel';
        panel.innerHTML = '<div class="settings-head">设置</div>';
        host.appendChild(panel);
      }
      if (!document.getElementById('setEncrypt')) {
        const panelHost = (panel.querySelector('.panel-body') as HTMLElement | null) || panel;
        const row = document.createElement('div');
        row.className = 'settings-item';
        row.innerHTML =
          '<label>全库加密</label>' +
          '<span class="switch" id="setEncrypt" style="display:inline-block;width:34px;height:18px;border-radius:9px;background:#bbb;cursor:pointer"></span>';
        panelHost.appendChild(row);
        /* 夹具自建开关：由 bindSetEncrypt 代绑（产品未提供的降级路径） */
        w.__feInjectedEnc = true;
      }
      bindSetEncrypt();

      if (!document.getElementById('ctxMenu')) {
        const menu = document.createElement('div');
        menu.id = 'ctxMenu';
        host.appendChild(menu);
      }

      const sb = document.getElementById('sidebarLeft');
      if (sb && !document.getElementById('feSidebar')) {
        const box = document.createElement('div');
        box.id = 'feSidebar';
        box.innerHTML =
          '<button type="button" id="btnNewFile" class="sb-nav-btn">＋ 新建文件</button>' +
          '<button type="button" id="navCalendar" class="sb-nav-btn">日历</button>' +
          '<button type="button" id="navDatabase" class="sb-nav-btn">多维表格</button>' +
          '<button type="button" id="btnExportMd" class="sb-nav-btn">导出 Markdown</button>';
        sb.appendChild(box);
      }
    };
    mountShell();
    document.addEventListener('DOMContentLoaded', mountShell, { once: true });
    /* 供用例在「产品重建 / 后挂载设置面板」后重新补齐面板壳与开关行 */
    w.__feMountShell = mountShell;

    /* 活跃状态代理（与 main.ts 的 getter 代理同口径） */
    const liveState: any = {};
    Object.defineProperty(liveState, 'nodes', { get: () => { const s = w.JU && w.JU.getState(); return (s && s.nodes) || {}; } });
    Object.defineProperty(liveState, 'rootId', { get: () => { const s = w.JU && w.JU.getState(); return s ? s.rootId : null; } });
    Object.defineProperty(liveState, 'trashed', { get: () => { const s = w.JU && w.JU.getState(); return (s && s.trashed) || []; } });

    const uiOf = (): any => { const u = w.JU.ui; return typeof u === 'function' ? u() : u; };
    const currentDoc = (): any => { const u = uiOf(); const id = u && u.currentDocId; return (id && w.JU.N(id)) || null; };
    const viewOf = (doc: any): string => {
      if (!doc) return 'library-root';
      if (doc.id === liveState.rootId) return 'library-root';
      if (doc._isCalRoot) return 'calendar';
      if (doc._isDbRoot) return 'database';
      return 'outline';
    };
    const getDbRows = (docId: any): any[] => {
      const d = w.JU.N(docId);
      return ((d && d.children) || []).map((id: any) => w.JU.N(id)).filter((n: any) => n && !n._deleted);
    };

    const noop = (): void => {};
    const div = (): HTMLElement => document.createElement('div');
    const fr = { v: false };
    let tagIdx: Map<string, number> | null = null;

    w.__feWire = (): boolean => {
      const J = w.JU;
      if (!J || typeof J.bindRenderMainDeps !== 'function') return false;
      if (w.__feWired) return true;

      let lastSig = '';
      const stateSig = (): string => {
        const st = J.getState();
        if (!st || !st.nodes) return '0:0';
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
        showDbRowContext: J.showDbRowContext, formatTimeValue: J.formatTimeValue,
      });
      J.injectFormulaDeps({ getState: J.getState, ui: uiOf(), N: J.N, getDbRows });
      J.injectPanelDeps({
        getState: J.getState, ui: uiOf(), N: J.N, commit: J.commit, nowSeq: J._nowSeq,
        forceRender, saveUI: noop, getCurrentDoc: currentDoc, actions: J.actions, getDbRows,
        isFolder: () => false, placePop: noop,
      });
      /* 导出端口：当前文档 + 真实节点取用（toMarkdown 的 walkTree 依赖 deps.N） */
      J.injectExportDeps({
        state: liveState, ui: uiOf(), N: J.N, actions: J.actions, getCurrentDoc: currentDoc,
      });

      /* 顶栏真实绑定（产品 bindTopbar） */
      J.bindTopbar();

      const clickTopbarView = (v: string): void => {
        const b = document.querySelector('.tb-nav-btn[data-view="' + v + '"]') as HTMLElement | null;
        if (b) b.click();
      };
      const btnNew = document.getElementById('btnNewFile');
      if (btnNew) {
        btnNew.onclick = (): void => {
          const id = J.actions.createDoc('FE 新建文档');
          if (id) J.actions.setCurrentDoc(id);
          uiOf().view = 'outline';
          forceRender();
        };
      }
      const navCal = document.getElementById('navCalendar');
      if (navCal) navCal.onclick = (): void => clickTopbarView('calendar');
      const navDb = document.getElementById('navDatabase');
      if (navDb) navDb.onclick = (): void => clickTopbarView('database');
      const btnExport = document.getElementById('btnExportMd');
      if (btnExport) btnExport.onclick = (): void => { J.doDownload('md'); };

      /**
       * 【第二轮 · #btnSettings 契约解耦】**不再改写 `btnSettings.onclick`**。
       *
       * 历史写法 `btnSettings.onclick = toggle` 会整段替换产品 `bindSettingsPanel()` 的处理器；
       * 若产品侧同时用 addEventListener，则同一次点击先开后关 ⇒ 面板永远打不开
       * （这正是「点设置没反应」的机制之一）。现在测试侧只调用产品公开 API：
       *   - `J.bindSettingsPanel()`：幂等重绑（addEventListener 语义，重复绑定=替换）；
       *   - `J.openSettings()` / `J.closeSettings()`：面板开合的公开入口。
       * 按钮点击行为完全由产品 `#btnSettings` 的 addEventListener 处理器承担。
       */
      try {
        if (typeof J.bindSettingsPanel === 'function') J.bindSettingsPanel();
      } catch (e) { /* 面板尚未创建：由 __feMountShell / 产品 mountSettingsPanel 兜底 */ }

      /* 全库加密开关：绑定逻辑见 addInitScript 顶部的 bindSetEncrypt（幂等），此处再确保一次 */
      bindSetEncrypt();

      lastSig = stateSig();
      w.__feWired = true;
      if (J.getState && J.getState()) forceRender();
      return true;
    };

    const timer = setInterval(() => { w.__feWire(); }, 1);
    setTimeout(() => clearInterval(timer), 20_000);
  });
}

/** 等 `window.JU` 装配完成 + 装配骨架接线成功。 */
async function waitWired(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const J = (window as any).JU;
    return !!(J && typeof J.getState === 'function' && (window as any).__feWired);
  }, null, { timeout: 60_000, polling: 25 });
}

/** 本地日历语义的今天（YYYY-MM-DD）。 */
async function todayOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    const p = (n: number): string => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  });
}

test.describe('CI · 终极全链路 E2E 业务验收', () => {
  let dist = '';

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    dist = await prepareDist();
  });

  test('用例 1 · 加密与解锁闭环：设置开启全库加密 → 刷新锁定 → 解锁后数据零丢失', async ({ context, page }) => {
    test.setTimeout(300_000);
    await installHarness(context);
    await installDistRoute(context, dist);

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
    await waitWired(page);

    /* ① 明文种子：产品 actions.createDoc / addNode 建文档 + 待加密节点 */
    const seed = await page.evaluate(() => {
      const J = (window as any).JU;
      const docId = J.actions.createDoc('加密验证文档');
      J.actions.setCurrentDoc(docId);
      const childId = J.actions.addNode(docId, null, { text: '加密前明文节点' });
      (window as any).__feSeedNodeId = childId;
      const U = typeof J.ui === 'function' ? J.ui() : J.ui;
      U.view = 'outline';
      J.renderMain();
      return { docId, childId, nodeCount: Object.keys(J.getState().nodes).length };
    });
    expect(seed.docId, '必须创建加密验证文档').toBeTruthy();
    expect(seed.childId, '必须创建待加密节点').toBeTruthy();
    await expect(
      page.locator('#content .outline .node .text', { hasText: '加密前明文节点' }),
      '加密前主界面必须渲染明文节点',
    ).toHaveCount(1, { timeout: 30_000 });

    /* ② 进入设置 → 开启全库加密（产品 appPrompt 输入密码 test123） */
    await page.click('#btnSettings');
    await expect(page.locator('#settingsPanel'), '设置面板必须打开').toHaveClass(/on/);
    /* 产品自带 `ensureSettingsPanel()` 可能晚于本用例的注入壳创建面板：打开面板后重新补齐壳与开关行 */
    await page.evaluate(() => {
      const mount = (window as any).__feMountShell;
      if (typeof mount === 'function') mount();
    });
    /* 设置面板改动后 DOM 挂载时机发生变化：先等开关真实可见再点击，
       避免「节点已挂载但面板尚未完成布局」的竞态（原先直接 click 会找不到或点不中）。 */
    await expect(page.locator('#setEncrypt'), '设置面板必须提供「全库加密」开关').toBeVisible({ timeout: 2000 });
    /* 开关为无文字 span：用真实 click 事件派发（仍命中产品绑定的 onclick 处理器） */
    await page.locator('#setEncrypt').dispatchEvent('click');

    /* 【第十轮 fix10 口径更新】产品真实链路：点击 → 「🔒 设置主密码」面板
       （#setPwd1 / #setPwd2，canonical 21822 showSetPasswordDialog）
       → 两次同一密码 → 「启用加密」。旧口径（夹具 appPrompt input[type=text]）已不适用：
       #setEncrypt 自 fix10 起由产品恢复并提供真实处理器，夹具不再代绑。 */
    const pwd1 = page.locator('.modal-overlay .modal #setPwd1');
    await expect(pwd1, '加密开关必须弹出「设置主密码」面板（产品 showSetPasswordDialog）').toBeVisible({ timeout: 15_000 });
    await pwd1.fill('test123');
    await page.locator('.modal-overlay .modal #setPwd2').fill('test123');
    await page.locator('.modal-overlay .modal [data-ok]').last().click();

    /* ③ 产品持久化加密分支：写入 juju.enc.v1（AES-GCM-256 / PBKDF2 600k），清除明文 juju.store.v31 */
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('juju.enc.v1')), { timeout: 60_000 })
      .not.toBeNull();

    const stored = await page.evaluate(() => {
      const J = (window as any).JU;
      const U = typeof J.ui === 'function' ? J.ui() : J.ui;
      return {
        enc: localStorage.getItem('juju.enc.v1') || '',
        plain: localStorage.getItem('juju.store.v31'),
        encrypted: !!U.encrypted,
        key: U.encKey as string | null,
      };
    });
    expect(stored.plain, '启用加密后必须删除明文主库').toBeNull();
    expect(stored.encrypted, 'ui.encrypted 必须为 true').toBe(true);
    expect(stored.key, 'ui.encKey 必须持有本次主密码').toBe('test123');

    const payload = JSON.parse(stored.enc);
    expect(payload.v, '密文载荷版本必须为 v1').toBe(1);
    expect(payload.iter, 'PBKDF2 迭代数必须为 600000').toBe(ENC_ITER);
    expect(String(payload.cipher || '').length, '密文正文不得为空').toBeGreaterThan(0);
    expect(stored.enc.includes('加密前明文节点'), '密文不得包含明文节点文本').toBe(false);
    expect(stored.enc.includes('加密验证文档'), '密文不得包含明文文档标题').toBe(false);

    /* ④ 刷新页面 → 产品 promptUnlock 锁定界面，且未解锁前不渲染任何加密数据 */
    await page.reload({ waitUntil: 'load', timeout: 60_000 });
    await expect(page.locator('#unlockPwd'), '刷新后必须出现解锁锁定界面').toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.modal-overlay .modal-head')).toContainText('解锁');
    await page.waitForFunction(() => !!(window as any).__feWired, null, { timeout: 60_000 });

    const locked = await page.evaluate(() => {
      const J = (window as any).JU;
      const U = J && J.ui ? (typeof J.ui === 'function' ? J.ui() : J.ui) : null;
      return {
        contentText: (document.getElementById('content') || document.createElement('div')).textContent || '',
        unlockVisible: !!document.getElementById('unlockPwd'),
        encryptedFlag: !!(U && U.encrypted),
        encStore: !!localStorage.getItem('juju.enc.v1'),
        plainStore: localStorage.getItem('juju.store.v31'),
      };
    });
    expect(locked.unlockVisible, '未解锁时必须停留在解锁锁定界面').toBe(true);
    expect(locked.contentText.includes('加密前明文节点'), '锁定态不得渲染加密数据').toBe(false);
    expect(locked.encStore, '刷新后密文库必须仍在').toBe(true);
    /* 产品启动顺序为 initPersist() → boot()：initPersist 会先落一份默认态明文库；
       安全口径要求该明文库不得包含任何加密前的用户数据。 */
    expect(String(locked.plainStore || '').includes('加密前明文节点'), '锁定态明文库不得包含受保护数据').toBe(false);

    /* ⑤ 错误密码：AES-GCM 认证失败被产品拒绝 */
    await page.locator('#unlockPwd').fill('wrongpass');
    await page.click('#unlockOk');
    await expect(page.locator('#unlockErr'), '错误密码必须提示解密失败').toContainText('密码错误', { timeout: 90_000 });
    await expect(page.locator('#unlockPwd'), '错误密码后必须停留在锁定界面').toBeVisible();

    /* ⑥ 正确密码 test123 → 解锁进入主界面 */
    await page.locator('#unlockPwd').fill('test123');
    await page.click('#unlockOk');
    await expect(page.locator('#unlockPwd'), '解锁成功后锁定界面必须关闭').toHaveCount(0, { timeout: 90_000 });
    await expect
      .poll(async () => page.evaluate(() => {
        const J = (window as any).JU;
        const U = J && J.ui ? (typeof J.ui === 'function' ? J.ui() : J.ui) : null;
        return !!(U && U.locked === false);
      }), { timeout: 60_000 })
      .toBe(true);

    /* ⑦ 数据零丢失：解密后节点 / 文档 / 数量与加密前一致 */
    const after = await page.evaluate((ids: { docId: string; childId: string }) => {
      const J = (window as any).JU;
      const U = typeof J.ui === 'function' ? J.ui() : J.ui;
      const st = J.getState();
      return {
        docText: st.nodes[ids.docId] ? String(st.nodes[ids.docId].text || '') : null,
        childText: st.nodes[ids.childId] ? String(st.nodes[ids.childId].text || '') : null,
        nodeCount: Object.keys(st.nodes).length,
        encrypted: !!U.encrypted,
        encKey: U.encKey as string | null,
        locked: !!U.locked,
        bootError: J.__bootError || null,
      };
    }, { docId: seed.docId, childId: seed.childId });

    expect(after.docText, '解密后文档必须原样存在').toBe('加密验证文档');
    expect(after.childText, '解密后节点文本必须原样存在').toBe('加密前明文节点');
    expect(after.nodeCount, '解密后节点总数不得少于加密前').toBeGreaterThanOrEqual(seed.nodeCount);
    expect(after.encrypted, '解锁后仍应为加密模式').toBe(true);
    expect(after.encKey, '解锁后必须持有主密码供后续加密落盘').toBe('test123');
    expect(after.locked, '解锁后不得处于锁定态').toBe(false);
    expect(after.bootError, 'boot 不得失败').toBeNull();

    /* ⑧ 主界面重新渲染解密后的节点树 */
    await page.evaluate((docId: string) => {
      const J = (window as any).JU;
      const U = typeof J.ui === 'function' ? J.ui() : J.ui;
      J.actions.setCurrentDoc(docId);
      U.view = 'outline';
      J.renderMain();
    }, seed.docId);
    await expect(
      page.locator('#content .outline .node .text', { hasText: '加密前明文节点' }),
      '解锁后主界面必须重新渲染解密后的节点',
    ).toHaveCount(1, { timeout: 30_000 });

    expect(pageErrors, '加解密全链路不得产生未捕获页面异常').toEqual([]);
  });

  test('用例 2 · 导入与导出闭环：导入 3 节点 JSON → 渲染 → 导出 Markdown 含导入文本', async ({ context, page }) => {
    test.setTimeout(300_000);
    await installHarness(context);
    await installDistRoute(context, dist);

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
    await waitWired(page);

    /* ① 3 节点 JSON 夹具（根 / 文档 / 子节点），经产品 handleImportFiles 真实解析 */
    const importState = {
      tagColors: {},
      rootId: 'imp-root',
      nodes: {
        'imp-root': {
          id: 'imp-root', text: '导入根', parent: null, children: ['imp-doc'], collapsed: false,
          done: false, date: null, tags: [], priority: 0, createdAt: 1, updatedAt: 1,
        },
        'imp-doc': {
          id: 'imp-doc', text: '导入文档', parent: 'imp-root', children: ['imp-child'], collapsed: false,
          done: false, date: null, tags: [], priority: 0, createdAt: 2, updatedAt: 2,
        },
        'imp-child': {
          id: 'imp-child', text: '导入节点A', parent: 'imp-doc', children: [], collapsed: false,
          done: false, date: null, tags: [], priority: 0, createdAt: 3, updatedAt: 3,
        },
      },
    };

    await page.evaluate((json: string) => {
      const J = (window as any).JU;
      const file = new File([json], 'e2e-import.json', { type: 'application/json' });
      (window as any).__feImportDone = false;
      void J.handleImportFiles([file]).then(() => { (window as any).__feImportDone = true; });
    }, JSON.stringify(importState));

    /* 产品 appConfirm 二次确认（导入会覆盖当前数据） */
    const confirmOk = page.locator('.modal-overlay .modal [data-ok]').last();
    await expect(confirmOk, '导入 JSON 必须弹出产品二次确认').toBeVisible({ timeout: 30_000 });
    await confirmOk.click();
    await expect
      .poll(async () => page.evaluate(() => !!(window as any).__feImportDone), { timeout: 60_000 })
      .toBe(true);

    /* ② 状态层：导入节点真实落库（3 节点 + 产品 ensureCalendarRoot 补建的日历容器） */
    const imported = await page.evaluate(() => {
      const J = (window as any).JU;
      const st = J.getState();
      return {
        rootId: st.rootId,
        docText: st.nodes['imp-doc'] ? String(st.nodes['imp-doc'].text || '') : null,
        childText: st.nodes['imp-child'] ? String(st.nodes['imp-child'].text || '') : null,
        childParent: st.nodes['imp-child'] ? st.nodes['imp-child'].parent : null,
        nodeCount: Object.keys(st.nodes).length,
      };
    });
    expect(imported.rootId, '导入后根节点必须为夹具根').toBe('imp-root');
    expect(imported.docText).toBe('导入文档');
    expect(imported.childText).toBe('导入节点A');
    expect(imported.childParent, '导入层级必须保持 imp-doc → imp-child').toBe('imp-doc');
    expect(imported.nodeCount, '导入的 3 个节点必须全部存在').toBeGreaterThanOrEqual(3);

    /* ③ 节点树渲染：切到导入文档的大纲视图 */
    await page.evaluate(() => {
      const J = (window as any).JU;
      const U = typeof J.ui === 'function' ? J.ui() : J.ui;
      J.actions.setCurrentDoc('imp-doc');
      U.view = 'outline';
      J.renderMain();
    });
    await expect(
      page.locator('#content .outline .node .text', { hasText: '导入节点A' }),
      '大纲必须渲染导入节点',
    ).toHaveCount(1, { timeout: 30_000 });

    /* ④ 点击「导出 Markdown」→ 产品 doDownload('md') → 真实浏览器下载 */
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.click('#btnExportMd'),
    ]);
    expect(download.suggestedFilename(), '导出文件必须为 .md').toMatch(/\.md$/);

    const downloadPath = await download.path();
    expect(downloadPath, '必须拿到真实下载落盘路径').toBeTruthy();
    const md = fs.readFileSync(downloadPath as string, 'utf8');

    console.log('[full-e2e] download=' + download.suggestedFilename() + ' bytes=' + Buffer.byteLength(md, 'utf8'));
    expect(md, '导出 Markdown 必须包含导入节点文本').toContain('导入节点A');
    expect(md, '导出 Markdown 必须包含导入文档标题').toContain('# 导入文档');

    expect(pageErrors, '导入导出全链路不得产生未捕获页面异常').toEqual([]);
  });

  test('用例 3 · 多维表格与日历联动：表格新建行 → 设今天 → 日历当日待办可见', async ({ context, page }) => {
    test.setTimeout(300_000);
    await installHarness(context);
    await installDistRoute(context, dist);

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e && (e as any).message) || e)));

    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
    await waitWired(page);

    const today = await todayOf(page);

    /* ① 建多维表格文档（产品 _isDbRoot + dbFields：标题 / 日期） */
    const docId = await page.evaluate(() => {
      const J = (window as any).JU;
      const id = J.actions.createDoc('E2E 多维表格');
      J.commit((s: any) => {
        const d = s.nodes[id];
        if (!d) return;
        d._isDbRoot = true;
        d.showInCal = false;
        s.dbFields = [
          { name: '标题' },
          { name: '日期', type: 'date', dateType: 'date' },
        ];
      }, { snapshot: true });
      J.actions.setCurrentDoc(id);
      return id as string;
    });
    expect(docId, '必须创建多维表格文档').toBeTruthy();

    /* ② 切换表格视图 → 产品「+ 行」按钮新建一行（空表先渲染空态，建行后才有 table） */
    await page.click('#navDatabase');
    const addRowBtn = page.locator('#content .db-add button', { hasText: '+ 行' }).first();
    await expect(addRowBtn, '表格必须提供「+ 行」按钮').toBeVisible({ timeout: 30_000 });
    await addRowBtn.click();
    await expect(page.locator('#content table'), '新建行后多维表格必须渲染').toHaveCount(1, { timeout: 30_000 });

    await expect
      .poll(async () => page.evaluate((id: string) => {
        const st = (window as any).JU.getState();
        return (st.nodes[id].children || []).length;
      }, docId), { timeout: 30_000 })
      .toBe(1);

    const rowId = await page.evaluate((id: string) => {
      const st = (window as any).JU.getState();
      return String(st.nodes[id].children[0]);
    }, docId);

    await page.evaluate((rid: string) => {
      const J = (window as any).JU;
      J.actions.updateText(rid, '跨视图任务');
      J.renderMain();
    }, rowId);
    await expect(page.locator('#content tbody tr').last(), '新建行必须渲染到表格').toContainText('跨视图任务', {
      timeout: 30_000,
    });

    /* ③ 行右键菜单（产品 showDbRowContext）→「添加到日历」→ 产品 setNodeDate(todayStr()) */
    const dateCell = page.locator('#content tbody tr').last().locator('.db-cell-date').first();
    await expect(dateCell, '表格必须渲染日期单元格').toHaveCount(1);
    await dateCell.evaluate((el) => {
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }));
    });

    const addToCal = page.locator('#ctxMenu .ctx-item', { hasText: '添加到日历' });
    await expect(addToCal, '行右键菜单必须提供「添加到日历」').toBeVisible({ timeout: 15_000 });
    await addToCal.click();

    await expect
      .poll(async () => page.evaluate((rid: string) => String((window as any).JU.getState().nodes[rid].date || ''), rowId), {
        timeout: 30_000,
      })
      .toBe(today);

    /* ④ 切换日历视图 → 点击今日格子 → 当日待办模块包含该表格行 */
    await page.click('#navCalendar');
    await expect(page.locator('#content .cal-cell').first(), '日历网格必须渲染').toBeVisible({ timeout: 45_000 });
    const todayCell = page.locator('.cal-cell.today');
    await expect(todayCell, '月视图必须标出今天').toHaveCount(1, { timeout: 30_000 });
    /* 单元格内可能含待办节点：直接向 .cal-cell 派发 click，命中产品 cell.onclick */
    await todayCell.dispatchEvent('click');
    await expect
      .poll(async () => page.evaluate(() => {
        const J = (window as any).JU;
        const U = typeof J.ui === 'function' ? J.ui() : J.ui;
        return String((U && U.selectedDate) || '');
      }), { timeout: 30_000 })
      .toBe(today);

    const todayModule = page.locator('.cal-module[data-key="today"]');
    await expect(todayModule, '日历必须渲染「当日待办」模块').toHaveCount(1, { timeout: 45_000 });
    await expect(
      todayModule.locator('.cal-node .text', { hasText: '跨视图任务' }),
      '今日待办列表必须包含表格行文本',
    ).toHaveCount(1, { timeout: 30_000 });

    const cross = await page.evaluate((args: { rid: string; today: string }) => {
      const J = (window as any).JU;
      const st = J.getState();
      const list = J.calendarTodosOnDate(args.today) as any[];
      return {
        inIndex: list.some((n: any) => n && n.id === args.rid),
        rowDate: String((st.nodes[args.rid] || {}).date || ''),
        rowText: String((st.nodes[args.rid] || {}).text || ''),
        bootError: J.__bootError || null,
      };
    }, { rid: rowId, today });

    expect(cross.rowDate, '表格行日期必须为今天').toBe(today);
    expect(cross.rowText).toBe('跨视图任务');
    expect(cross.inIndex, '产品日历索引必须收录该表格行').toBe(true);
    expect(cross.bootError, 'boot 不得失败').toBeNull();
    expect(pageErrors, '多视图联动全程不得产生未捕获页面异常').toEqual([]);
  });
});
