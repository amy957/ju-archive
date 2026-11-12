// @ts-nocheck
/**
 * P0-T3 Step6 · 引用语义断言
 *
 * 覆盖：
 *   - __juProduce / __juProduceSafe 的返回引用契约
 *   - safeClone 的深拷贝隔离
 *   - commit 非 light / light 的 state 引用替换差异
 *   - undo / redo 引用替换与历史副本隔离
 *   - 指纹机制（state._structRev）与引用解耦
 *   - mergeRemoteState 节点级 LWW 的引用保留/覆盖
 *   - 危险键引用安全
 *
 * 运行：
 *   npx playwright test tests/t3-reference-semantics.spec.ts
 *
 * 约定：
 *   - 被测对象是**工作文件** v2.0-t3.html（P0-T3/baseline 下为只读基线且不含
 *     Step1 的 __juProduce，不可作为被测目标）；可用 JU_APP_URL 覆盖。
 *   - 顶层 function 声明挂 window；顶层 let/const（state / _lastWrittenJson /
 *     _ORIGIN_STRIP / _sidebarFingerprint）在全局词法环境可见，Playwright 全局求值
 *     可直接访问。故函数体直接引用这些标识符。
 *   - 返回对象必须可 JSON 序列化（Playwright 默认按 JSON 传回），因此只返回
 *     boolean / number / string / 数组 / 纯对象，不返回 DOM/函数/循环引用。
 *
 * 与规格的两处实测适配（见 P0-T3/引用语义测试报告.md §5.4）：
 *   - mergeRemoteState 含删除传播：远端快照缺本地节点时，满足条件的本地节点会被删除。
 *     为隔离被测语义，三个 merge 用例的远端快照均包含**全部本地节点**，仅对被测节点做
 *     定向的新增/覆盖/保留。否则启动期种子节点会被误删，断言虽不受影响但污染状态。
 *   - 危险键用例：JSON 字符串手工拼接 "__proto__" 键（JSON.parse 创建自有键而非改原型）。
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
    null,
    { timeout: 5000 }
  );
}
async function drainHistory(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    let n = 0;
    while (undo() && n++ < 200) { /* drain */ }
  });
}
test.describe('P0-T3 Step6 · 引用语义断言', () => {
  test.beforeEach(async ({ page }) => {
    await bootApp(page);
    await drainHistory(page);
  });
  // ============================================================
  // 一、__juProduce / __juProduceSafe
  // ============================================================
  test.describe('__juProduce / __juProduceSafe 引用契约', () => {
    test('对象 + 修改：返回新引用，base 未污染', async ({ page }) => {
      const r = await page.evaluate(() => {
        const a = { x: 1, inner: { y: 1 } };
        const b = __juProduce(a, (d) => { d.x = 2; d.inner.y = 9; });
        return {
          outerDifferent: a !== b,
          innerDifferent: a.inner !== b.inner,
          aX: a.x, bX: b.x,
          aInnerY: a.inner.y, bInnerY: b.inner.y,
        };
      });
      expect(r.outerDifferent).toBe(true);
      expect(r.innerDifferent).toBe(true);
      expect(r.aX).toBe(1);
      expect(r.bX).toBe(2);
      expect(r.aInnerY).toBe(1);
      expect(r.bInnerY).toBe(9);
    });
    test('对象 + 空 recipe：返回原引用（Immer 式未修改不复制）', async ({ page }) => {
      const r = await page.evaluate(() => {
        const a = { x: 1 };
        const b = __juProduce(a, () => { /* no-op */ });
        return {
          different: a !== b,
          sameContent: JSON.stringify(a) === JSON.stringify(b),
        };
      });
      // 【P0-T3 结构共享】未修改时 produce 返回原 state（Immer 式），见 commit L2117 注释；
      // commit 层再浅拷根对象 bump updatedAt（L2120-2122），produce 层契约则是原引用透传
      expect(r.different).toBe(false);
      expect(r.sameContent).toBe(true);
    });
    test('recipe 返回非 undefined：返回值原样透传', async ({ page }) => {
      const r = await page.evaluate(() => {
        const a = { x: 1 };
        const b = __juProduce(a, () => 'sentinel');
        const c = __juProduce(a, () => null);
        const d = __juProduce(a, () => 0);
        return { b, c, d };
      });
      expect(r.b).toBe('sentinel');
      expect(r.c).toBe(null);
      expect(r.d).toBe(0);
    });
    test('原始值 base：返回 recipe 返回值或原值', async ({ page }) => {
      const r = await page.evaluate(() => {
        return {
          withReturn: __juProduce(5, (v) => v + 1),   // 6
          noReturn: __juProduce(5, () => {}),         // 5
          nulNoReturn: __juProduce(null, () => {}),   // null
          undefNoReturn: __juProduce(undefined, () => {}), // undefined → JSON 化为 null
          boolReturn: __juProduce(true, () => false), // false
          strNoReturn: __juProduce('abc', () => {}),  // 'abc'
        };
      });
      expect(r.withReturn).toBe(6);
      expect(r.noReturn).toBe(5);
      expect(r.nulNoReturn).toBe(null);
      // 原始值 undefined + 无返回 recipe → 返回 base（undefined）。
      // Playwright 序列化保留对象属性中的 undefined（不转为 null）。
      expect(r.undefNoReturn).toBeUndefined();
      expect(r.boolReturn).toBe(false);
      expect(r.strNoReturn).toBe('abc');
    });
    test('recipe 抛错：base 引用与内容保持不变', async ({ page }) => {
      const r = await page.evaluate(() => {
        const a = { x: 1 };
        let threw = false;
        try { __juProduce(a, () => { throw new Error('boom'); }); }
        catch (e) { threw = true; }
        return { threw, aX: a.x, sameContent: JSON.stringify(a) === '{"x":1}' };
      });
      expect(r.threw).toBe(true);
      expect(r.aX).toBe(1);
      expect(r.sameContent).toBe(true);
    });
    test('__juProduceSafe 成功：{ok:true, next}，next 是新引用', async ({ page }) => {
      const r = await page.evaluate(() => {
        const a = { x: 1 };
        const r = __juProduceSafe(a, (d) => { d.x = 2; });
        return {
          ok: r.ok,
          hasNext: 'next' in r,
          hasBase: 'base' in r,
          different: r.next !== a,
          nextX: r.next.x,
          aX: a.x,
        };
      });
      expect(r.ok).toBe(true);
      expect(r.hasNext).toBe(true);
      expect(r.hasBase).toBe(false);
      expect(r.different).toBe(true);
      expect(r.nextX).toBe(2);
      expect(r.aX).toBe(1);
    });
    test('__juProduceSafe 失败：{ok:false, base, error}，base 是原引用', async ({ page }) => {
      const r = await page.evaluate(() => {
        const a = { x: 1 };
        const r = __juProduceSafe(a, () => { throw new Error('safe-fail'); });
        return {
          ok: r.ok,
          hasBase: 'base' in r,
          hasNext: 'next' in r,
          sameRef: r.base === a,
          hasError: r.error instanceof Error,
          aX: a.x,
        };
      });
      expect(r.ok).toBe(false);
      expect(r.hasNext).toBe(false);
      expect(r.hasBase).toBe(true);
      expect(r.sameRef).toBe(true);
      expect(r.hasError).toBe(true);
      expect(r.aX).toBe(1);
    });
  });
  // ============================================================
  // 二、safeClone
  // ============================================================
  test.describe('safeClone 深拷贝隔离', () => {
    test('顶层与嵌套均为新引用', async ({ page }) => {
      const r = await page.evaluate(() => {
        const a = { x: { y: 1 }, arr: [1, [2]] };
        const b = safeClone(a);
        return {
          outerDifferent: a !== b,
          innerObjDifferent: a.x !== b.x,
          innerArrDifferent: a.arr !== b.arr,
          nestedArrDifferent: a.arr[1] !== b.arr[1],
        };
      });
      expect(r.outerDifferent).toBe(true);
      expect(r.innerObjDifferent).toBe(true);
      expect(r.innerArrDifferent).toBe(true);
      expect(r.nestedArrDifferent).toBe(true);
    });
    test('修改副本不影响原对象', async ({ page }) => {
      const r = await page.evaluate(() => {
        const a = { x: 1, arr: [1, 2, 3], n: { deep: 'v' } };
        const b = safeClone(a);
        b.x = 99;
        b.arr.push(4);
        b.n.deep = 'mutated';
        return {
          aX: a.x, bX: b.x,
          aArrLen: a.arr.length, bArrLen: b.arr.length,
          aDeep: a.n.deep, bDeep: b.n.deep,
        };
      });
      expect(r.aX).toBe(1);       expect(r.bX).toBe(99);
      expect(r.aArrLen).toBe(3);  expect(r.bArrLen).toBe(4);
      expect(r.aDeep).toBe('v');  expect(r.bDeep).toBe('mutated');
    });
    test('state 快照隔离：修改副本不改变 state', async ({ page }) => {
      const r = await page.evaluate(() => {
        const beforeNodeCount = Object.keys(state.nodes).length;
        const snap = safeClone(state);
        snap.nodes['__l3_injected__'] = { id: '__l3_injected__', parent: 'root', children: [] };
        return {
          stateNodeCount: Object.keys(state.nodes).length,
          snapNodeCount: Object.keys(snap.nodes).length,
          beforeNodeCount,
        };
      });
      expect(r.stateNodeCount).toBe(r.beforeNodeCount);
      expect(r.snapNodeCount).toBe(r.beforeNodeCount + 1);
    });
  });
  // ============================================================
  // 三、commit 引用语义
  // ============================================================
  test.describe('commit 引用语义', () => {
    test('非 light 成功：state 引用替换，旧引用不被污染', async ({ page }) => {
      const r = await page.evaluate(() => {
        const ref = state;
        commit((d) => { d._l3_nl = 1; }, { snapshot: true, silent: true, persistOnly: true });
        return {
          different: state !== ref,
          newHasL3: state._l3_nl === 1,
          oldHasL3: ref._l3_nl === undefined,   // 旧引用未被修改
        };
      });
      expect(r.different).toBe(true);
      expect(r.newHasL3).toBe(true);
      expect(r.oldHasL3).toBe(true);
    });
    test('非 light 失败：state 引用与内容完全不变', async ({ page }) => {
      const r = await page.evaluate(() => {
        const ref = state;
        const before = JSON.stringify(ref);
        commit((d) => { d._l3_nl = 1; throw new Error('nl-fail'); },
          { snapshot: true, silent: true, persistOnly: true });
        return {
          sameRef: state === ref,
          sameContent: JSON.stringify(state) === before,
        };
      });
      expect(r.sameRef).toBe(true);
      expect(r.sameContent).toBe(true);
    });
    test('light 成功：state 引用改变（copy-on-write，不再原地修改）', async ({ page }) => {
      const r = await page.evaluate(() => {
        const ref = state;
        commit((d) => {
          if (!d.dbColumnWidths) d.dbColumnWidths = {};
          d.dbColumnWidths['__l3_light__'] = 1;
        }, { light: true, silent: true, persistOnly: true, noRollback: true });
        return {
          sameRef: state === ref,
          hasValue: state.dbColumnWidths['__l3_light__'] === 1,
        };
      });
      // 【P0-T3 结构共享】light 不再 draft=state 原地修改（commit L2101 注释），
      // 统一走 produce 路径复制 + 结构共享；引用必变，内容照常写入
      expect(r.sameRef).toBe(false);
      expect(r.hasValue).toBe(true);
    });
    test('连续非 light：每次 state 引用唯一', async ({ page }) => {
      const r = await page.evaluate(() => {
        const refs = [];
        refs.push(state);
        for (let i = 0; i < 3; i++) {
          commit((d) => { d['_l3_' + i] = i; }, { snapshot: true, silent: true, persistOnly: true });
          refs.push(state);
        }
        return {
          allUnique: new Set(refs).size === refs.length,
          finalHasAll: refs[3]._l3_0 === 0 && refs[3]._l3_1 === 1 && refs[3]._l3_2 === 2,
        };
      });
      expect(r.allUnique).toBe(true);
      expect(r.finalHasAll).toBe(true);
    });
    test('updatedAt 严格单调递增（同毫秒内仍 +1）', async ({ page }) => {
      const r = await page.evaluate(() => {
        const t0 = state.updatedAt;
        for (let i = 0; i < 8; i++) {
          commit((d) => { d['_l3_t' + i] = i; }, { snapshot: true, silent: true, persistOnly: true });
        }
        return { delta: state.updatedAt - t0, t0, t1: state.updatedAt };
      });
      // commit 尾部：draft.updatedAt = Math.max(Date.now(), (draft.updatedAt||0)+1)
      // 8 次连续调用，delta 至少为 8（同毫秒内逐次 +1）
      expect(r.delta).toBeGreaterThanOrEqual(8);
      expect(r.t1).toBeGreaterThan(r.t0);
    });
  });
  // ============================================================
  // 四、undo / redo 引用语义
  // ============================================================
  test.describe('undo / redo 引用语义', () => {
    test('undo 后 state 是新引用（历史副本），不是初始引用', async ({ page }) => {
      const r = await page.evaluate(() => {
        const initialRef = state;
        commit((d) => { d._l3_u = 1; }, { snapshot: true, silent: true, persistOnly: true });
        const commitRef = state;
        undo();
        const undoRef = state;
        return {
          initialNotUndo: initialRef !== undoRef,
          commitNotUndo: commitRef !== undoRef,
          restoredContent: undoRef._l3_u === undefined,
        };
      });
      // 历史栈入的是克隆副本，出栈也是克隆副本，均非原引用
      expect(r.initialNotUndo).toBe(true);
      expect(r.commitNotUndo).toBe(true);
      expect(r.restoredContent).toBe(true);
    });
    test('redo 后 state 是新引用（future 副本）', async ({ page }) => {
      const r = await page.evaluate(() => {
        commit((d) => { d._l3_r = 1; }, { snapshot: true, silent: true, persistOnly: true });
        const commitRef = state;
        undo();
        const undoRef = state;
        redo();
        const redoRef = state;
        return {
          commitNotRedo: commitRef !== redoRef,
          undoNotRedo: undoRef !== redoRef,
          restoredContent: redoRef._l3_r === 1,
        };
      });
      expect(r.commitNotRedo).toBe(true);
      expect(r.undoNotRedo).toBe(true);
      expect(r.restoredContent).toBe(true);
    });
    test('历史栈深拷贝隔离：commit-commit-undo-undo-redo-redo 状态正确', async ({ page }) => {
      const r = await page.evaluate(() => {
        commit((d) => { d._l3_hist = 1; }, { snapshot: true, silent: true, persistOnly: true });
        commit((d) => { d._l3_hist = 2; }, { snapshot: true, silent: true, persistOnly: true });
        const v2 = state._l3_hist;
        undo();
        const v1 = state._l3_hist;
        undo();
        const v0 = state._l3_hist;
        redo();
        const v1b = state._l3_hist;
        redo();
        const v2b = state._l3_hist;
        return { v0, v1, v1b, v2, v2b };
      });
      expect(r.v2).toBe(2);
      expect(r.v1).toBe(1);
      expect(r.v0).toBe(undefined);
      expect(r.v1b).toBe(1);
      expect(r.v2b).toBe(2);
    });
    test('修改历史副本不影响当前 state（隔离断言）', async ({ page }) => {
      const r = await page.evaluate(() => {
        commit((d) => { d._l3_iso = 'a'; }, { snapshot: true, silent: true, persistOnly: true });
        const refBefore = state;
        const cloned = safeClone(refBefore);
        cloned._l3_iso = 'b';
        cloned.nodes['__l3_ghost__'] = { id: '__l3_ghost__', parent: 'root', children: [] };
        return {
          stateUnchanged: state._l3_iso === 'a',
          cloneChanged: cloned._l3_iso === 'b',
          noGhostInState: !state.nodes['__l3_ghost__'],
          refsDiffer: refBefore !== cloned,
        };
      });
      expect(r.stateUnchanged).toBe(true);
      expect(r.cloneChanged).toBe(true);
      expect(r.noGhostInState).toBe(true);
      expect(r.refsDiffer).toBe(true);
    });
  });
  // ============================================================
  // 五、指纹机制与引用解耦
  // ============================================================
  test.describe('指纹机制与引用解耦', () => {
    test('light 非结构提交：state 引用改变、_sidebarFingerprint 不变', async ({ page }) => {
      const r = await page.evaluate(() => {
        const refBefore = state;
        const fp1 = _sidebarFingerprint();
        commit((d) => {
          if (!d.dbColumnWidths) d.dbColumnWidths = {};
          d.dbColumnWidths['__l3_fp__'] = 1;
        }, { light: true, silent: true, persistOnly: true, noRollback: true });
        const fp2 = _sidebarFingerprint();
        return {
          sameRef: state === refBefore,
          fpChanged: fp1 !== fp2,
        };
      });
      // 【批次 3-B 契约】light 走 produce 复制（引用变化）；非结构字段不推进 _structRev
      // ⇒ 指纹不变、侧栏跳过重建。引用变化与指纹机制彼此独立可感知。
      expect(r.sameRef).toBe(false);
      expect(r.fpChanged).toBe(false);
    });
    test('非 light 非结构提交：_sidebarFingerprint 不变', async ({ page }) => {
      const r = await page.evaluate(() => {
        const fp1 = _sidebarFingerprint();
        commit((d) => { d._l3_fp2 = 1; }, { snapshot: true, silent: true, persistOnly: true });
        const fp2 = _sidebarFingerprint();
        return { fpChanged: fp1 !== fp2 };
      });
      // 顶层非 nodes 字段不属于侧栏可见结构 ⇒ _structRev 不推进、指纹不变
      expect(r.fpChanged).toBe(false);
    });
    test('正文编辑不推进指纹，结构变更（addNode）推进指纹', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        const docId = actions.addNode(rootId, 0, { text: 'fp doc' });
        const childId = actions.addNode(docId, null, { text: 'fp child' });
        const revAfterAdd = state._structRev | 0;
        const fpAfterAdd = _sidebarFingerprint();
        // 纯文本修改（非顶层文档正文）→ 结构版本不推进、指纹不变
        actions.updateText(childId, 'fp child edited', { snapshot: true });
        const revAfterText = state._structRev | 0;
        const fpAfterText = _sidebarFingerprint();
        // 结构修改（新增节点）→ 结构版本推进、指纹必须变化
        const extraId = actions.addNode(rootId, 0, { text: 'fp extra' });
        const revAfterStruct = state._structRev | 0;
        const fpAfterStruct = _sidebarFingerprint();
        // 清理，避免污染后续用例
        actions.removeNode(extraId);
        actions.removeNode(docId);
        return {
          revAfterAdd, revAfterText, revAfterStruct,
          textRevSame: revAfterText === revAfterAdd,
          textFpSame: fpAfterText === fpAfterAdd,
          structRevAdvanced: revAfterStruct > revAfterText,
          structFpChanged: fpAfterStruct !== fpAfterText,
        };
      });
      // 纯文本修改：_structRev 不变 ⇒ 指纹不变（侧栏跳过重建）
      expect(r.textRevSame).toBe(true);
      expect(r.textFpSame).toBe(true);
      // 结构修改：_structRev 递增 ⇒ 指纹必须变化
      expect(r.structRevAdvanced).toBe(true);
      expect(r.structFpChanged).toBe(true);
    });
    test('light 后 _lastWrittenJson 与当前 state 指纹对比可感知变化', async ({ page }) => {
      // 等首次持久化完成
      await page.evaluate(() => flushPersistNow());
      await page.waitForTimeout(50);
      const r = await page.evaluate(() => {
        const before = _lastWrittenJson;
        commit((d) => {
          if (!d.dbColumnWidths) d.dbColumnWidths = {};
          d.dbColumnWidths['__l3_lw__'] = Date.now();
        }, { light: true, silent: true, persistOnly: true, noRollback: true });
        // 不立即 flush，直接比较"当前 state 序列化"与"上次写盘指纹"
        const cur = JSON.stringify(state, _ORIGIN_STRIP);
        return {
          beforeSet: typeof before === 'string' && before.length > 0,
          nowDifferent: before !== cur,
        };
      });
      // _lastWrittenJson 是内容指纹（含 rev），与引用无关
      expect(r.beforeSet).toBe(true);
      expect(r.nowDifferent).toBe(true);
    });
  });
  // ============================================================
  // 六、mergeRemoteState 节点级引用
  // ============================================================
  test.describe('mergeRemoteState 节点级引用', () => {
    test('远端新节点：state.nodes[id] 直接引用远端对象', async ({ page }) => {
      const r = await page.evaluate(() => {
        const newId = '__l3_remote_new__' + Date.now();
        const remoteNode = {
          id: newId,
          parent: state.rootId,
          children: [],
          text: 'remote node',
          updatedAt: state.updatedAt + 5000,
          createdAt: state.updatedAt + 5000,
        };
        const remote = {
          rootId: state.rootId,
          updatedAt: state.updatedAt + 5000,
          nodes: {},
        };
        // 远端快照包含全部本地节点（避免删除传播误删），再定向新增被测节点
        for (const k in state.nodes) remote.nodes[k] = state.nodes[k];
        remote.nodes[newId] = remoteNode;
        const hadBefore = !!state.nodes[newId];
        mergeRemoteState(remote);
        const hasAfter = !!state.nodes[newId];
        const sameRefAsRemote = state.nodes[newId] === remoteNode;
        // 清理：从树中移除测试节点
        delete state.nodes[newId];
        const p = state.nodes[state.rootId];
        if (p && Array.isArray(p.children)) {
          const i = p.children.indexOf(newId);
          if (i >= 0) p.children.splice(i, 1);
        }
        return { hadBefore, hasAfter, sameRefAsRemote };
      });
      // 远端节点入本地时不做克隆（直接引用 rn），符合"合并不复制"的既有实现
      expect(r.hadBefore).toBe(false);
      expect(r.hasAfter).toBe(true);
      expect(r.sameRefAsRemote).toBe(true);
    });
    test('远端较新：覆盖本地引用', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        const id = actions.addNode(rootId, 0, { text: 'local' });
        const localRef = state.nodes[id];
        const localUpd = state.nodes[id].updatedAt;
        const remoteNode = Object.assign({}, state.nodes[id], {
          text: 'remote updated',
          updatedAt: localUpd + 10000,
        });
        const remote = {
          rootId,
          updatedAt: state.updatedAt + 10000,
          nodes: {},
        };
        for (const k in state.nodes) remote.nodes[k] = state.nodes[k];
        remote.nodes[id] = remoteNode;
        mergeRemoteState(remote);
        const afterRef = state.nodes[id];
        const result = {
          refChanged: afterRef !== localRef,
          sameRefAsRemote: afterRef === remoteNode,
          text: afterRef.text,
        };
        // 清理
        actions.removeNode(id);
        return result;
      });
      // 远端较新 → 覆盖本地，直接引用远端节点
      expect(r.refChanged).toBe(true);
      expect(r.sameRefAsRemote).toBe(true);
      expect(r.text).toBe('remote updated');
    });
    test('本地较新：保留本地引用', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        const id = actions.addNode(rootId, 0, { text: 'local new' });
        const localRef = state.nodes[id];
        const localUpd = state.nodes[id].updatedAt;
        // 远端更旧的同 id 节点
        const remoteNode = Object.assign({}, state.nodes[id], {
          text: 'remote stale',
          updatedAt: localUpd - 10000,
        });
        const remote = {
          rootId,
          updatedAt: state.updatedAt + 10000,
          nodes: {},
        };
        for (const k in state.nodes) remote.nodes[k] = state.nodes[k];
        remote.nodes[id] = remoteNode;
        mergeRemoteState(remote);
        const result = {
          sameRefAsLocal: state.nodes[id] === localRef,
          text: state.nodes[id].text,
        };
        actions.removeNode(id);
        return result;
      });
      expect(r.sameRefAsLocal).toBe(true);
      expect(r.text).toBe('local new');
    });
  });
  // ============================================================
  // 七、危险键引用安全
  // ============================================================
  test.describe('危险键引用安全', () => {
    test('mergeRemoteState 跳过 __proto__，不污染原型链', async ({ page }) => {
      const r = await page.evaluate(() => {
        const rootId = state.rootId;
        // 用 JSON.parse 构造含自有 __proto__ 键的远端快照（JSON.parse 会创建自有键而非改原型）。
        // 快照内嵌全部本地节点，避免删除传播误删。
        const nodesJson = JSON.stringify(state.nodes).slice(0, -1) +
                          ',"__proto__":{"polluted":true}}';
        const remoteStr = '{"rootId":' + JSON.stringify(rootId) +
                          ',"updatedAt":' + (state.updatedAt + 1000) +
                          ',"nodes":' + nodesJson + '}';
        const remote = JSON.parse(remoteStr);
        // 快照前状态：__proto__ 是 Object.prototype 上的访问器，不是自有键
        const beforeHasOwn = Object.prototype.hasOwnProperty.call(state.nodes, '__proto__');
        const beforeGloballyPolluted = ({}).polluted === true;
        mergeRemoteState(remote);
        const afterHasOwn = Object.prototype.hasOwnProperty.call(state.nodes, '__proto__');
        const afterGloballyPolluted = ({}).polluted === true;
        return {
          beforeHasOwn, beforeGloballyPolluted,
          afterHasOwn, afterGloballyPolluted,
        };
      });
      // 合并前后均无自有 __proto__ 键、无全局污染
      expect(r.beforeHasOwn).toBe(false);
      expect(r.afterHasOwn).toBe(false);
      expect(r.beforeGloballyPolluted).toBe(false);
      expect(r.afterGloballyPolluted).toBe(false);
    });
    test('__juProduce 不清洗危险键（清洗责任在消费路径）', async ({ page }) => {
      const r = await page.evaluate(() => {
        // JSON.parse 产生的 '__proto__' 是自有键（不是访问器）
        const a = JSON.parse('{"__proto__":{"x":1},"y":2}');
        const hasOwnBefore = Object.prototype.hasOwnProperty.call(a, '__proto__');
        const b = __juProduce(a, (d) => { d.y = 3; });
        const hasOwnAfter = Object.prototype.hasOwnProperty.call(b, '__proto__');
        const globalPolluted = ({}).x === 1;
        return {
          hasOwnBefore, hasOwnAfter, globalPolluted,
          y: b.y,
        };
      });
      // structuredClone 会复制自有 __proto__ 键（用 CreateDataProperty，不触发 setter），
      // __juProduce 不额外清洗，保持原样；但不会污染全局原型。
      expect(r.hasOwnBefore).toBe(true);
      expect(r.hasOwnAfter).toBe(true);
      expect(r.globalPolluted).toBe(false);
      expect(r.y).toBe(3);
    });
  });
});
