// @ts-nocheck
/**
 * L4 阶段 1.6 · JU-HistoryAgent 专题 spec（path-level patch + applyPatch）
 *
 * 依据：l4-design-2026-10-13.md（1.6 修正版）§ 五 2
 * 配套：v2.0-t3.html（含 L4 基础设施 + 12 处 commit 模式映射）
 *
 * 运行：
 *   npx playwright test tests/t4-history.spec.ts
 *
 * 约定：同 l3-*.spec.ts——被测对象为工作文件 v2.0-t3.html；
 *   顶层 let/const（state / historyPast / historyFuture）在页面全局词法环境可见。
 *   顶层 function（commit / undo / redo / applyPatch / invertPatch / tryMergeWithLast）挂 window。
 *
 * 测试矩阵（20 条）：
 *   §6.1 树结构不变量在 undo 后保持 (T-01 ~ T-03)
 *   §6.2 删除/墓碑不变量 (T-04 ~ T-06)
 *   §6.3 标签/索引/缓存不变量 (T-07 ~ T-08)
 *   §6.4 历史栈边界（合并规则 + #14.M2）(T-09 ~ T-11)
 *   §6.5 undo/redo 等价 + 内存 (T-12 ~ T-14)
 *   §6.6 多标签 LWW + #22 远端合并不可撤销 (T-15 ~ T-16)
 *   §6.7 旁路/兼容 + 系统自愈不入历史 (T-17 ~ T-18, T-20)
 *   §6.8 序列化失败降级 (T-19)
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_URL =
  process.env.JU_APP_URL ||
  'file://' + path.resolve(__dirname, '..', 'v2.0-t3.html');
async function bootApp(page: import('@playwright/test').Page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof __juProduce === 'function' &&
          typeof commit === 'function' &&
          typeof state === 'object' && state !== null,
    { timeout: 10_000 }
  );
}

/* ============================================================
   一、树结构不变量在 undo 后保持（3 用例 · T-01 ~ T-03）
   ============================================================ */
test.describe('L4 §6.1 树结构不变量在 undo 后保持', () => {
  test('T-01 undo 后根可达 + 父子互反', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const before = historyPast.length;
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      const b = actions.addNode(state.rootId, 1, { text: 'B' });
      const c = actions.addNode(state.rootId, 2, { text: 'C' });
      actions.removeNode(b);
      undo();
      const reachable = new Set([state.rootId]);
      const stack = [state.rootId];
      while (stack.length) {
        const x = stack.pop();
        const n = state.nodes[x]; if (!n) continue;
        for (const ch of (n.children || [])) {
          if (reachable.has(ch)) continue;
          reachable.add(ch); stack.push(ch);
        }
      }
      let parentChildOk = true;
      for (const id of reachable) {
        const n = state.nodes[id];
        if (id === state.rootId) { if (n.parent !== null) parentChildOk = false; continue; }
        const p = state.nodes[n.parent];
        if (!p || !p.children || !p.children.includes(id)) parentChildOk = false;
      }
      return { before, after: historyPast.length, hasB: !!state.nodes[b], parentChildOk, reachableSize: reachable.size };
    });
    expect(r.hasB).toBe(true);
    expect(r.parentChildOk).toBe(true);
  });

  test('T-02 undo 后无环（DFS 不重复访问）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      const b = actions.addNode(a, 0, { text: 'B' });
      const c = actions.addNode(b, 0, { text: 'C' });
      actions.removeNode(c);
      actions.removeNode(b);
      actions.removeNode(a);
      undo(); undo(); undo();
      const seen = new Set(); let cycle = false;
      function dfs(id) {
        if (seen.has(id)) { cycle = true; return; }
        seen.add(id);
        const n = state.nodes[id]; if (!n) return;
        for (const ch of (n.children || [])) dfs(ch);
      }
      dfs(state.rootId);
      return { cycle, hasA: !!state.nodes[a] };
    });
    expect(r.cycle).toBe(false);
    expect(r.hasA).toBe(true);
  });

  test('T-03 undo 后 children 无重复', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      const b = actions.addNode(state.rootId, 1, { text: 'B' });
      const c = actions.addNode(state.rootId, 2, { text: 'C' });
      actions.removeNode(a);
      actions.removeNode(b);
      undo(); undo();
      const root = state.nodes[state.rootId];
      const set = new Set(root.children);
      return { hasA: !!state.nodes[a], hasB: !!state.nodes[b], hasC: !!state.nodes[c], childrenLen: root.children.length, childrenSetLen: set.size };
    });
    expect(r.hasA).toBe(true);
    expect(r.hasB).toBe(true);
    expect(r.hasC).toBe(true);
    expect(r.childrenLen).toBe(r.childrenSetLen);
  });
});

/* ============================================================
   二、删除/墓碑不变量（3 用例 · T-04 ~ T-06）
   ============================================================ */
test.describe('L4 §6.2 删除/墓碑不变量', () => {
  test('T-04 undo 删除清墓碑', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      actions.removeNode(a);
      const beforeUndo = !!(state._tombstones && state._tombstones[a]);
      undo();
      const afterUndo = !!(state._tombstones && state._tombstones[a]);
      return { beforeUndo, afterUndo, hasA: !!state.nodes[a] };
    });
    expect(r.hasA).toBe(true);
    expect(r.beforeUndo).toBe(true);
    expect(r.afterUndo).toBe(false);
  });

  test('T-05 undo 删除恢复 parent + children', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      const b = actions.addNode(a, 0, { text: 'B' });
      actions.removeNode(b);
      undo();
      const root = state.nodes[state.rootId];
      const aNode = state.nodes[a];
      return { hasB: !!state.nodes[b], bInAChildren: aNode && aNode.children && aNode.children.includes(b), aInRootChildren: root && root.children && root.children.includes(a) };
    });
    expect(r.hasB).toBe(true);
    expect(r.bInAChildren).toBe(true);
    expect(r.aInRootChildren).toBe(true);
  });

  test('T-06 undo 恢复后节点可达（3 层子树）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      const b = actions.addNode(a, 0, { text: 'B' });
      const c = actions.addNode(b, 0, { text: 'C' });
      actions.removeNode(a);
      undo();
      const seen = new Set([state.rootId]);
      const stack = [state.rootId];
      while (stack.length) {
        const x = stack.pop();
        const n = state.nodes[x]; if (!n) continue;
        for (const ch of (n.children || [])) {
          if (!seen.has(ch)) { seen.add(ch); stack.push(ch); }
        }
      }
      return { hasA: seen.has(a), hasB: seen.has(b), hasC: seen.has(c) };
    });
    expect(r.hasA).toBe(true);
    expect(r.hasB).toBe(true);
    expect(r.hasC).toBe(true);
  });
});

/* ============================================================
   三、标签/索引/缓存不变量（2 用例 · T-07 ~ T-08）
   ============================================================ */
test.describe('L4 §6.3 标签/索引/缓存不变量', () => {
  test('T-07 undo 文本编辑清标签', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      actions.updateText(a, 'A #设计');
      const afterEdit = (state.nodes[a].tags || []).includes('设计');
      undo();
      const afterUndo = (state.nodes[a].tags || []).includes('设计');
      return { afterEdit, afterUndo };
    });
    expect(r.afterEdit).toBe(true);
    expect(r.afterUndo).toBe(false);
  });

  test('T-08 undo 触发 _wordCountCache 清空', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      if (typeof docWordCount === 'function') docWordCount(a);
      const before = _wordCountCache.size;
      actions.updateText(a, 'A 修改');
      undo();
      const afterUndo = _wordCountCache.size;
      return { before, afterUndo };
    });
    expect(r.afterUndo).toBe(0);
  });
});

/* ============================================================
   四、历史栈边界（合并规则 + 14.M2）（3 用例 · T-09 ~ T-11）
   ============================================================ */
test.describe('L4 §6.4 历史栈边界（合并规则 + 14.M2）', () => {
  test('T-09 500ms 内文本合并（merge 模式）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      const before = historyPast.length;
      actions.updateText(a, 'A1');
      actions.updateText(a, 'A12');
      actions.updateText(a, 'A123');
      actions.updateText(a, 'A1234');
      actions.updateText(a, 'A12345');
      await new Promise(r => setTimeout(r, 50));
      const after = historyPast.length;
      const lastPatch = historyPast[historyPast.length - 1];
      return { before, after, mergedCount: lastPatch && lastPatch.mergedCount, mode: lastPatch && lastPatch.mode, groupKey: lastPatch && lastPatch.groupKey };
    });
    expect(r.after).toBe(r.before + 1);
    expect(r.mergedCount).toBe(5);
    expect(r.mode).toBe('merge');
  });

  test('T-10 500ms 边界外不合并', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      const before = historyPast.length;
      actions.updateText(a, 'A1');
      await new Promise(r => setTimeout(r, 600));
      actions.updateText(a, 'A12');
      const after = historyPast.length;
      return { before, after };
    });
    expect(r.after).toBe(r.before + 2);
  });

  test('T-11 结构性操作不合并（snapshot 模式）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const before = historyPast.length;
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      actions.toggleCollapse(a);
      actions.toggleCollapse(a);
      actions.toggleCollapse(a);
      const after = historyPast.length;
      return { before, after, diff: after - before };
    });
    expect(r.diff).toBeGreaterThanOrEqual(4);
  });
});

/* ============================================================
   五、undo/redo 等价 + 内存（3 用例 · T-12 ~ T-14）
   ============================================================ */
test.describe('L4 §6.5 undo/redo 等价 + 内存', () => {
  test('T-12 patch 内存目标（30 条 < 30KB）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const a = actions.addNode(state.rootId, 0, { text: 'A' });
      for (let i = 0; i < 30; i++) {
        actions.updateText(a, 'A' + i);
        await new Promise(r => setTimeout(r, 510));
      }
      const totalBytes = JSON.stringify(historyPast).length;
      return { historyLen: historyPast.length, totalBytes };
    });
    expect(r.historyLen).toBeGreaterThan(0);
    expect(r.totalBytes).toBeLessThan(30 * 1024);
  });

  test('T-13 undo 还原等价（patch 路径覆盖）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      commit((s) => { s._l4v = 1; }, { snapshot: true, silent: true, persistOnly: true });
      commit((s) => { s._l4u = 2; }, { snapshot: true, silent: true, persistOnly: true });
      commit((s) => { s._l4w = 3; }, { snapshot: true, silent: true, persistOnly: true });
      const afterEdit = { v: state._l4v, u: state._l4u, w: state._l4w };
      undo(); undo(); undo();
      const afterUndo = { v: state._l4v, u: state._l4u, w: state._l4w };
      return { afterEdit, afterUndo };
    });
    expect(r.afterEdit).toEqual({ v: 1, u: 2, w: 3 });
    expect(r.afterUndo).toEqual({ v: undefined, u: undefined, w: undefined });
  });

  test('T-14 redo 推进等价', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      commit((s) => { s._l4r1 = 'a'; }, { snapshot: true, silent: true, persistOnly: true });
      commit((s) => { s._l4r2 = 'b'; }, { snapshot: true, silent: true, persistOnly: true });
      commit((s) => { s._l4r3 = 'c'; }, { snapshot: true, silent: true, persistOnly: true });
      undo(); undo(); undo();
      const r0 = { r1: state._l4r1, r2: state._l4r2, r3: state._l4r3 };
      redo();
      const r1 = { r1: state._l4r1, r2: state._l4r2, r3: state._l4r3 };
      redo();
      const r2 = { r1: state._l4r1, r2: state._l4r2, r3: state._l4r3 };
      redo();
      const r3 = { r1: state._l4r1, r2: state._l4r2, r3: state._l4r3 };
      return { r0, r1, r2, r3 };
    });
    expect(r.r0).toEqual({ r1: undefined, r2: undefined, r3: undefined });
    expect(r.r1).toEqual({ r1: 'a', r2: undefined, r3: undefined });
    expect(r.r2).toEqual({ r1: 'a', r2: 'b', r3: undefined });
    expect(r.r3).toEqual({ r1: 'a', r2: 'b', r3: 'c' });
  });
});

/* ============================================================
   六、多标签 LWW + #22 远端合并不可撤销（2 用例 · T-15 ~ T-16）
   ============================================================ */
test.describe('L4 §6.6 多标签 LWW + #22 远端合并不可撤销（修正 1 后）', () => {
  test('T-15 mergeRemoteState 保持 historyPast', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      commit((s) => { s._l4m1 = 1; }, { snapshot: true, silent: true, persistOnly: true });
      commit((s) => { s._l4m2 = 2; }, { snapshot: true, silent: true, persistOnly: true });
      commit((s) => { s._l4m3 = 3; }, { snapshot: true, silent: true, persistOnly: true });
      const lenBefore = historyPast.length;
      const futBefore = historyFuture.length;
      const remote = JSON.parse(JSON.stringify(state));
      const newY = { id: '__l4_Y__', text: 'Y', parent: state.rootId, children: [], updatedAt: Date.now() + 10000 };
      remote.nodes[newY.id] = newY;
      remote.nodes[state.rootId].children.push(newY.id);
      mergeRemoteState(remote);
      const lenAfter = historyPast.length;
      const futAfter = historyFuture.length;
      const hasY = !!state.nodes[newY.id];
      return { lenBefore, lenAfter, futBefore, futAfter, hasY };
    });
    expect(r.lenAfter).toBe(r.lenBefore);
    expect(r.futAfter).toBe(0);
    expect(r.hasY).toBe(true);
  });

  test('T-16 undo 不得触达 merge 中间态', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      /* 1 次本地 snapshot commit → 1 个 patch 在 historyPast */
      commit((s) => { s._l4u_a = 1; }, { snapshot: true, silent: true, persistOnly: true });
      const lenBefore = historyPast.length;
      const futBefore = historyFuture.length;
      /* 远端合并（合入新节点 Y） */
      const remote = JSON.parse(JSON.stringify(state));
      const newY = { id: '__l4_undoY__', text: 'Y', parent: state.rootId, children: [], updatedAt: Date.now() + 10000 };
      remote.nodes[newY.id] = newY;
      remote.nodes[state.rootId].children.push(newY.id);
      mergeRemoteState(remote);
      const lenAfterMerge = historyPast.length;  /* 应保持 = lenBefore */
      const futAfterMerge = historyFuture.length;  /* 应保持 = futBefore */
      /* undo 1 次：撤销合并后第 1 步编辑（_l4u_a → undefined） */
      undo();
      const afterUndo = { a: state._l4u_a, y: !!state.nodes['__l4_undoY__'] };
      const lenAfterUndo = historyPast.length;
      return { lenBefore, lenAfterMerge, futAfterMerge, futBefore, lenAfterUndo, afterUndo };
    });
    expect(r.lenAfterMerge).toBe(r.lenBefore);    /* mergeRemoteState 保持 historyPast 不变（#22 修正 1） */
    expect(r.futAfterMerge).toBe(r.futBefore);    /* mergeRemoteState 保持 historyFuture 不变 */
    expect(r.afterUndo.a).toBeUndefined();        /* undo 撤销合并后的本地编辑 */
    expect(r.afterUndo.y).toBe(true);             /* 远端合入的 Y 仍存在（merge 不被 undo） */
    expect(r.lenAfterUndo).toBe(r.lenBefore - 1); /* historyPast pop 1 条 */
  });
});

/* ============================================================
   七、旁路/兼容 + 系统自愈不入历史（3 用例 · T-17 ~ T-18, T-20）
   ============================================================ */
test.describe('L4 §6.7 旁路/兼容 + 系统自愈不入历史', () => {
  test('T-17 setDbColumnWidth 不入历史（兼容 light）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const before = historyPast.length;
      const docId = state.rootId;
      for (let i = 0; i < 5; i++) {
        actions.setDbColumnWidth(docId, 'col' + i, 100 + i);
      }
      const after = historyPast.length;
      return { before, after };
    });
    expect(r.after).toBe(r.before);
  });

  test('T-18 旧 snapshot:true 兼容（→ historyMode snapshot）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const before = historyPast.length;
      commit((s) => { s._l4_compat = 1; }, { snapshot: true, silent: true, persistOnly: true });
      const after = historyPast.length;
      const lastPatch = historyPast[historyPast.length - 1];
      return { before, after, mode: lastPatch && lastPatch.mode, op: lastPatch && lastPatch.op };
    });
    expect(r.after).toBe(r.before + 1);
    expect(r.mode).toBe('snapshot');
    expect(r.op).toBe('unknown');
  });

  test('T-20 dedupCalRoots (4731) 不入历史（澄清 2）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const before = historyPast.length;
      // 模拟两个 _isCalRoot 节点
      commit((s) => {
        const root = s.nodes[s.rootId];
        if (root && root.children && root.children.length >= 1) {
          const firstChild = s.nodes[root.children[0]];
          if (firstChild) {
            firstChild._isCalRoot = true;
            firstChild._isDbRoot = true;
            firstChild.createdAt = 1000;
            // 加第二个 fake cal root
            const fakeId = '__l4_fakecr__';
            s.nodes[fakeId] = { id: fakeId, text: 'fake2', parent: s.rootId, children: [], _isCalRoot: true, _isDbRoot: true, createdAt: 2000, updatedAt: Date.now() };
            root.children.push(fakeId);
          }
        }
      }, { silent: true });
      // 触发 dedupCalRoots
      if (typeof dedupCalRoots === 'function') dedupCalRoots();
      const after = historyPast.length;
      return { before, after, equal: before === after };
    });
    expect(r.equal).toBe(true);
  });
});

/* ============================================================
   八、序列化失败降级（修正 3 + 决策 3.3，1 用例 · T-19）
   ============================================================ */
test.describe('L4 §6.8 序列化失败降级', () => {
  test('T-19 patch 序列化失败 → never + 记录报告（注入点：commit 收口 catch）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const beforeLen = (window.__juPatchFailures || []).length;
      const beforePast = historyPast.length;
      /* 通过 opArgs.failSerialize=true 触发 commit 收口 catch（决策 3.3 注入点） */
      commit((s) => { s._l4_t19 = 1; }, { snapshot: true, silent: true, persistOnly: true, op: 't19test', opArgs: { failSerialize: true } });
      const afterPast = historyPast.length;
      const afterFailLen = (window.__juPatchFailures || []).length;
      return { beforeLen, afterFailLen, beforePast, afterPast, grew: afterFailLen > beforeLen };
    });
    // 期望：historyPast 不增长（catch 降级为 never），__juPatchFailures 有记录
    expect(r.grew).toBe(true);
    expect(r.afterPast).toBe(r.beforePast);
  });
});
