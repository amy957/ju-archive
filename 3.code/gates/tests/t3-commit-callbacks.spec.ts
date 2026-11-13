// @ts-nocheck
/**
 * P0-T3 Step5 · commit 回调行为验证
 *
 * 覆盖：P0-T3/commit-callback-audit.md 中的全部风险类别（P1/P2/OK/OBS）
 *       与 Step2/Step3 的回归点。
 *
 * 运行：
 *   npx playwright test tests/t3-commit-callbacks.spec.ts
 *   npx playwright show-report playwright-report
 *
 * 约定：
 *   - 被测对象是**工作文件** v2.0-t3.html（P0-T3/baseline 下为只读基线且不含
 *     Step1 的 __juProduce，不可作为被测目标）；可用 JU_APP_URL 覆盖。
 *   - 顶层 function 声明挂 window；顶层 const/let（state / ui / actions / _logTimers）
 *     在页面全局词法环境中可见。因此测试函数体直接使用
 *     state / ui / commit / actions / __juProduce / _logTimers / __juLog 等名字。
 *   - 本文件用 @ts-nocheck 关闭类型检查，避免全局名未声明的 TS 报错。
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_URL =
  process.env.JU_APP_URL ||
  'file://' + path.resolve(__dirname, '..', '..', 'canonical', 'v2.0-t3.html');
async function bootApp(page: import('@playwright/test').Page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof __juProduce === 'function' &&
          typeof commit === 'function' &&
          typeof state === 'object' && state !== null,
    null,
    { timeout: 5000 }
  );
}
async function drainHistory(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    let n = 0;
    while (undo() && n++ < 200) { /* drain to empty */ }
  });
}
test.describe('P0-T3 Step5 · commit 回调行为验证', () => {
  test.beforeEach(async ({ page }) => {
    await bootApp(page);
    await drainHistory(page);
  });
  // ============================================================
  // 一、契约级：标志语义
  // ============================================================
  test.describe('契约级 · 标志语义', () => {
    test('snapshot:true 入历史栈，undo 可回退', async ({ page }) => {
      const r = await page.evaluate(() => {
        const before = state.updatedAt;
        commit((d) => { d._l3_snap = 1; }, { snapshot: true, silent: true, persistOnly: true });
        const after = state.updatedAt;
        const undone = undo();
        return { before, after, undone, restored: state.updatedAt === before };
      });
      expect(r.after).not.toBe(r.before);
      expect(r.undone).toBe(true);
      expect(r.restored).toBe(true);
    });
    test('light:true 不入历史栈，undo 返回 false', async ({ page }) => {
      const r = await page.evaluate(() => {
        commit((d) => {
          if (!d.dbColumnWidths) d.dbColumnWidths = {};
          d.dbColumnWidths['__l3__'] = 1;
        }, { light: true, silent: true, persistOnly: true, noRollback: true });
        const undone = undo();
        return { undone, hasValue: state.dbColumnWidths['__l3__'] === 1 };
      });
      expect(r.undone).toBe(false);
      expect(r.hasValue).toBe(true);
    });
    test('light:true 引用替换（不再原地改），updatedAt 被 bump', async ({ page }) => {
      const r = await page.evaluate(() => {
        const ref = state;
        const t0 = ref.updatedAt;
        commit((d) => {
          if (!d.dbColumnWidths) d.dbColumnWidths = {};
          d.dbColumnWidths['__l3_ref__'] = 2;
        }, { light: true, silent: true, persistOnly: true, noRollback: true });
        // 结构共享：根引用替换，未触碰的 nodes 子树保持共享
        return {
          refReplaced: state !== ref,
          nodesShared: state.nodes === ref.nodes,
          bumped: state.updatedAt > t0,
          valueSet: state.dbColumnWidths['__l3_ref__'] === 2,
        };
      });
      expect(r.refReplaced).toBe(true);
      expect(r.nodesShared).toBe(true);
      expect(r.bumped).toBe(true);
      expect(r.valueSet).toBe(true);
    });
    test('noHistory:true + snapshot:true 清空 historyFuture', async ({ page }) => {
      const r = await page.evaluate(() => {
        commit((d) => { d._l3_a = 1; }, { snapshot: true, silent: true, persistOnly: true });
        undo(); // 产生 historyFuture
        commit((d) => { d._l3_b = 2; }, { snapshot: true, noHistory: true, silent: true, persistOnly: true });
        const redone = redo();
        return { redone };
      });
      // noHistory 分支执行 historyFuture.length=0
      expect(r.redone).toBe(false);
    });
    test('noHistory:true 不污染 historyPast（snapshot 不入栈）', async ({ page }) => {
      const r = await page.evaluate(() => {
        const before = historyPast.length;
        commit((d) => { d._l3_nh = 1; }, { snapshot: true, noHistory: true, silent: true, persistOnly: true });
        return { before, after: historyPast.length, value: state._l3_nh === 1 };
      });
      expect(r.after).toBe(r.before);
      expect(r.value).toBe(true);
    });
    test('persistOnly:true 触发持久化调度但不入历史、不 notify（silent:true）', async ({ page }) => {
      const r = await page.evaluate(() => {
        const before = historyPast.length;
        let persistCalls = 0, notifyCalls = 0;
        const origPersist = schedulePersist, origNotify = scheduleNotify;
        schedulePersist = () => { persistCalls++; };
        scheduleNotify = () => { notifyCalls++; };
        try {
          commit((d) => { d._l3_po = 1; }, { persistOnly: true, silent: true });
        } finally { schedulePersist = origPersist; scheduleNotify = origNotify; }
        return { before, persistCalls, notifyCalls, after: historyPast.length, value: state._l3_po === 1 };
      });
      // 实际实现：persistOnly 走 schedulePersist 调度（flushPersistNow 由调度/显式调用触发），snapshot 默认 false → 不入历史
      expect(r.persistCalls).toBeGreaterThan(0);
      expect(r.notifyCalls).toBe(0);
      expect(r.after).toBe(r.before);
      expect(r.value).toBe(true);
    });
    test('silent:true 不触发 scheduleNotify；silent:false 触发', async ({ page }) => {
      const r = await page.evaluate(() => {
        const orig = scheduleNotify;
        let silentCount = 0, loudCount = 0;
        scheduleNotify = () => { silentCount++; };
        try {
          commit((d) => { d._l3_s = 1; }, { snapshot: true, silent: true, persistOnly: true });
        } finally { scheduleNotify = orig; }
        scheduleNotify = () => { loudCount++; };
        try {
          commit((d) => { d._l3_s = 2; }, { snapshot: true, silent: false, persistOnly: true });
        } finally { scheduleNotify = orig; }
        return { silentCount, loudCount };
      });
      expect(r.silentCount).toBe(0);
      expect(r.loudCount).toBeGreaterThan(0);
    });
    test('persistOnly:true 仍写盘（flush 后 localStorage 变化）', async ({ page }) => {
      await page.waitForTimeout(500); // 等首次持久化完成
      const before = await page.evaluate(() => localStorage.getItem('juju.store.v31') || '');
      await page.evaluate(() => {
        commit((d) => {
          if (!d.dbColumnWidths) d.dbColumnWidths = {};
          d.dbColumnWidths['__l3_persist__'] = Date.now();
        }, { light: true, silent: true, persistOnly: true, noRollback: true });
        flushPersistNow();
      });
      await page.waitForTimeout(120);
      const after = await page.evaluate(() => localStorage.getItem('juju.store.v31') || '');
      expect(after).not.toBe(before);
    });
  });
  // ============================================================
  // 二、契约级：dirtyText 三态（实测语义，见回调验证记录 §2.1）
  // ============================================================
  test.describe('契约级 · dirtyText 三态', () => {
    test('dirtyText:true 失效指定文档字数缓存', async ({ page }) => {
      const r = await page.evaluate(() => {
        const id = actions.addNode(state.rootId, 0, { text: '基线文字' });
        const n0 = docWordCount(id);
        commit((d) => {
          const n = d.nodes[id];
          if (n) { n.text = (n.text || '') + '额外文字'; n.updatedAt = Date.now(); }
        }, { snapshot: true, dirtyText: true, dirtyDocs: id, silent: true, persistOnly: true });
        const n1 = docWordCount(id);
        return { n0, n1 };
      });
      expect(r.n1).toBeGreaterThan(r.n0);
    });
    test('dirtyText:false 不影响字数缓存', async ({ page }) => {
      const r = await page.evaluate(() => {
        const id = actions.addNode(state.rootId, 0, { text: '基线文字' });
        const n0 = docWordCount(id);
        commit((d) => {
          const n = d.nodes[id];
          if (n) { n.text = (n.text || '') + 'AAAA'; }
        }, { snapshot: true, dirtyText: false, silent: true, persistOnly: true });
        const n1 = docWordCount(id);
        return { n0, n1 };
      });
      // 未失效 → 返回旧缓存值
      expect(r.n1).toBe(r.n0);
    });
    test('dirtyText:null 实测走失效路径（_clearWC=snapshot）', async ({ page }) => {
      const r = await page.evaluate(() => {
        const id = actions.addNode(state.rootId, 0, { text: '基线文字' });
        const n0 = docWordCount(id);
        commit((d) => {
          const n = d.nodes[id];
          if (n) { n.text = (n.text || '') + 'ZZZZ'; }
        }, { snapshot: true, dirtyText: null, dirtyDocs: id, silent: true, persistOnly: true });
        const n1 = docWordCount(id);
        return { n0, n1 };
      });
      // 实测：commit 尾 _clearWC=(dirtyText===null)?snapshot:dirtyText → null 等同 true，
      // 按 dirtyDocs 范围失效。规格中的"null 不清缓存"预期不成立，见回调验证记录 §2.1。
      expect(r.n1).toBeGreaterThan(r.n0);
    });
    test('dirtyDocs:null 显式不失效（不影响字数）', async ({ page }) => {
      const r = await page.evaluate(() => {
        const id = actions.addNode(state.rootId, 0, { text: '基线文字' });
        const n0 = docWordCount(id);
        commit((d) => {
          const n = d.nodes[id];
          if (n) { n.text = (n.text || '') + 'MMM'; }
        }, { snapshot: true, dirtyText: true, dirtyDocs: null, silent: true, persistOnly: true });
        const n1 = docWordCount(id);
        return { n0, n1 };
      });
      // dirtyDocs:null → commit 尾「不影响字数」分支，缓存保留
      expect(r.n1).toBe(r.n0);
    });
  });
  // ============================================================
  // 三、显式调用点行为
  // ============================================================
  test.describe('调用点 · actions.*', () => {
    test('actions.addNode → snapshot 入栈', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        const id = actions.addNode(rootId, 0, { text: '__l3_add__' });
        const inTree = !!state.nodes[id];
        const undone = undo();
        return { inTree, undone, afterUndo: !!state.nodes[id] };
      });
      expect(r.inTree).toBe(true);
      expect(r.undone).toBe(true);
      expect(r.afterUndo).toBe(false);
    });
    test('actions.updateText → tags 重算（_manualTags ∪ 正文 #标签）', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        const id = actions.addNode(rootId, 0, { text: '初始' });
        actions.updateText(id, '含标签 #设计 和 #重要');
        const n = state.nodes[id];
        return { tags: (n.tags || []).slice().sort() };
      });
      expect(r.tags).toEqual(['重要', '设计'].sort());
    });
    test('actions.toggleDone → done 翻转', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        const id = actions.addNode(rootId, 0, { text: '__l3_toggle__' });
        actions.toggleDone(id);
        const after1 = state.nodes[id].done;
        actions.toggleDone(id);
        const after2 = state.nodes[id].done;
        return { after1, after2 };
      });
      expect(r.after1).toBe(true);
      expect(r.after2).toBe(false);
    });
    test('actions.moveNode → 拒绝移入自身', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        const id = actions.addNode(rootId, 0, { text: '__l3_move__' });
        const before = state.nodes[id].parent;
        actions.moveNode(id, id, 0);
        const after = state.nodes[id].parent;
        return { before, after };
      });
      expect(r.after).toBe(r.before);
    });
    test('actions.removeNode → 递归删除 + 墓碑写入', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        const parent = actions.addNode(rootId, 0, { text: '__l3_rm_p__' });
        const child = actions.addNode(parent, 0, { text: '__l3_rm_c__' });
        actions.removeNode(parent);
        const parentGone = !state.nodes[parent];
        const childGone = !state.nodes[child];
        const ts = state._tombstones || {};
        return { parentGone, childGone, hasTombParent: !!ts[parent], hasTombChild: !!ts[child] };
      });
      expect(r.parentGone).toBe(true);
      expect(r.childGone).toBe(true);
      expect(r.hasTombParent).toBe(true);
      expect(r.hasTombChild).toBe(true);
    });
    test('actions.setDbColumnWidth → light，不入历史栈，引用替换、nodes 共享', async ({ page }) => {
      const r = await page.evaluate(() => {
        const docId = state.rootId;
        const t0 = state.updatedAt;
        const ref = state;
        actions.setDbColumnWidth(docId, '标题', 200);
        const undone = undo();
        return {
          refReplaced: state !== ref,
          nodesShared: state.nodes === ref.nodes,
          bumped: state.updatedAt > t0,
          undone,
          width: state.dbColumnWidths[docId + '::标题'],
        };
      });
      expect(r.refReplaced).toBe(true);
      expect(r.nodesShared).toBe(true);
      expect(r.bumped).toBe(true);
      expect(r.undone).toBe(false);
      expect(r.width).toBe(200);
    });
    test('actions.logActivity → 1.5s 防抖后 activity 记录写入', async ({ page }) => {
      const r = await page.evaluate(async () => {
        const rootId = state.rootId;
        const id = actions.addNode(rootId, 0, { text: '__l3_log__' });
        actions.logActivity('mod', id);
        await new Promise((res) => setTimeout(res, 1800));
        const today = new Date();
        const ds = today.getFullYear() + '-' +
                   String(today.getMonth() + 1).padStart(2, '0') + '-' +
                   String(today.getDate()).padStart(2, '0');
        const bucket = state.activity && state.activity[ds];
        const hasMod = !!(bucket && bucket.mod && bucket.mod.some((e) => e.id === id));
        return { hasMod };
      });
      expect(r.hasMod).toBe(true);
    });
  });
  // ============================================================
  // 四、OBS 复核（OBS-3 已按 Step4 落定：snapshot:false）
  // ============================================================
  test.describe('OBS 复核', () => {
    test('OBS-3 · mindmap 拖拽 snapshot:false（Step4 已落定）：不入历史栈', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        const id = actions.addNode(rootId, 0, { text: '__l3_mm__' });
        // 与 renderMindmap.mousedown.onMU 现行 commit 同构（Step4 已改 snapshot:false）
        commit((d) => {
          const n = d.nodes[id];
          if (n) { n.mmX = 100; n.mmY = 200; n.updatedAt = Date.now(); }
        }, { snapshot: false, persistOnly: true });
        const hasPos = !!state.nodes[id] && state.nodes[id].mmX === 100;
        const u1 = undo(); // 回退 addNode 的 snapshot 提交 → true
        const u2 = undo(); // mmX 提交（snapshot:false）未入栈 → 无事可做 → false
        return { hasPos, u1, u2 };
      });
      // 视图坐标已写入且未被撤销历史吞掉
      expect(r.hasPos).toBe(true);
      expect(r.u1).toBe(true);
      // 关键证明：snapshot:false 的拖拽提交没有产生撤销条目
      expect(r.u2).toBe(false);
    });
    test('OBS-1 · commitPendingEditBeforeRender.word 四标志语义正确', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        const id = actions.addNode(rootId, 0, { text: 'word' });
        commit((d) => { d.nodes[id]._isWord = true; d.nodes[id].content = ''; },
          { snapshot: true, silent: true, persistOnly: true });
        const before = state.nodes[id].content;
        commit((d) => {
          d.nodes[id].content = '<p>正文</p>';
          d.nodes[id].updatedAt = Date.now();
        }, { snapshot: true, noHistory: true, dirtyText: true, silent: true, persistOnly: true });
        const after = state.nodes[id].content;
        const undone = undo();
        return { changed: before !== after, undone };
      });
      expect(r.changed).toBe(true);
      // 之前 addNode/word 设置已入栈 → undo 仍可用
      expect(r.undone).toBe(true);
    });
  });
  // ============================================================
  // 五、P1 UI 一致性
  // ============================================================
  test.describe('P1 · UI 一致性', () => {
    test('P1-1/P1-2 · setDbColumnWidth / setDbRowHeight 不抛错', async ({ page }) => {
      const r = await page.evaluate(() => {
        let threw = false;
        try {
          actions.setDbColumnWidth(state.rootId, 'X', -1);
          actions.setDbRowHeight('__non_existent__', -1);
        } catch (e) { threw = true; }
        return { threw, width: state.dbColumnWidths[state.rootId + '::X'] };
      });
      expect(r.threw).toBe(false);
      // 上游钳制责任在调用方，函数本身不设限
      expect(r.width).toBe(-1);
    });
    test('P1-3 · flushPendingLogs 清空 _logTimers', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        const id = actions.addNode(rootId, 0, { text: '__l3_flush__' });
        actions.logActivity('mod', id);
        const sizeBefore = _logTimers.size;
        flushPendingLogs();
        const sizeAfter = _logTimers.size;
        return { sizeBefore, sizeAfter };
      });
      expect(r.sizeBefore).toBeGreaterThan(0);
      expect(r.sizeAfter).toBe(0);
    });
  });
  // ============================================================
  // 六、Step2 / Step3 回归
  // ============================================================
  test.describe('Step2 / Step3 回归', () => {
    test('Step2 · 非 light 抛错时 state 引用与内容完全不变', async ({ page }) => {
      const r = await page.evaluate(() => {
        const ref = state;
        const beforeCount = Object.keys(state.nodes).length;
        commit((d) => { d.nodes = null; throw new Error('step2-regression'); },
          { silent: true, persistOnly: true });
        return {
          sameRef: state === ref,
          sameCount: Object.keys(state.nodes).length === beforeCount,
        };
      });
      expect(r.sameRef).toBe(true);
      expect(r.sameCount).toBe(true);
    });
    test('Step3 · light + noRollback + action 抛错 → 原引用不变、零污染、无 kind', async ({ page }) => {
      const r = await page.evaluate(() => {
        const ref = state;
        const logBefore = __juLog.length;
        commit((d) => {
          if (!d.dbColumnWidths) d.dbColumnWidths = {};
          d.dbColumnWidths['__l3_p1__'] = 1;
          throw new Error('step3-light-fail');
        }, { light: true, silent: true, persistOnly: true, noRollback: true });
        const polluted = state.dbColumnWidths && state.dbColumnWidths['__l3_p1__'] === 1;
        return {
          sameRef: state === ref,
          polluted,
          logGrew: __juLog.length > logBefore,
        };
      });
      // 结构共享 produce 失败：state 原引用不变、draft 污染不回流、不再有 reportError kind
      expect(r.sameRef).toBe(true);
      expect(r.polluted).toBe(false);
      expect(r.logGrew).toBe(false);
    });
    test('Step3 · light + safeClone 覆盖 + action 抛错 → produce 天然隔离', async ({ page }) => {
      const r = await page.evaluate(() => {
        const ref = state;
        const logBefore = __juLog.length;
        const orig = safeClone;
        safeClone = () => state;
        try {
          commit((d) => {
            if (!d.tagColors) d.tagColors = {};
            d.tagColors['__l3_bk__'] = '#000';
            throw new Error('backup-invalid-force');
          }, { light: true, silent: true, persistOnly: true, noRollback: false });
        } finally { safeClone = orig; }
        const polluted = state.tagColors && state.tagColors['__l3_bk__'] === '#000';
        return {
          sameRef: state === ref,
          polluted,
          logGrew: __juLog.length > logBefore,
        };
      });
      // safeClone 不再参与 commit 成功/失败路径；produce 失败不污染、不上报
      expect(r.sameRef).toBe(true);
      expect(r.polluted).toBe(false);
      expect(r.logGrew).toBe(false);
    });
  });
});
