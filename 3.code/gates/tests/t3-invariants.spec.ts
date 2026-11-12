// @ts-nocheck
/**
 * P0-T3 第三步验收 · 结构不变量对拍（补 20 条不变量清单中的空白项）
 *
 * 覆盖（引用语义 bug 修复清单 §3.4 表格中的 ❌ 项）：
 *   - 树结构：produce 修改后每个节点 parent 指向正确、父子一致、children 无重复
 *   - 无环：沿 parent 上溯有限步到 root（done 映射防循环）
 *   - undo 后 state 与快照值相等、引用不等
 *   - 连续 undo/redo 收敛 + 历史栈边界（空栈 undo 返回 false）
 *
 * 运行：
 *   npx playwright test tests/t3-invariants.spec.ts
 *
 * 约定：同 l3-commit-callbacks.spec.ts——被测对象为工作文件 v2.0-t3.html；
 *   顶层 let/const（state / historyPast）与 function（commit / undo / redo / actions）
 *   在页面全局词法环境可见，evaluate 内直接引用。
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
    while (undo() && n++ < 200) { /* drain to empty */ }
  });
}
test.describe('P0-T3 第三步 · 结构不变量对拍', () => {
  test.beforeEach(async ({ page }) => {
    await bootApp(page);
    await drainHistory(page);
  });
  // ============================================================
  // 一、树结构不变量（produce 修改路径后）
  // ============================================================
  test('树结构：parent 指向正确、父子一致、children 无重复、无环', async ({ page }) => {
    const r = await page.evaluate(() => {
      const rootId = state.rootId;
      const a = actions.addNode(rootId, 0, { text: 'A' });
      const b = actions.addNode(rootId, 0, { text: 'B' });
      const a1 = actions.addNode(a, 0, { text: 'A1' });
      const a2 = actions.addNode(a, 0, { text: 'A2' });
      const b1 = actions.addNode(b, 0, { text: 'B1' });
      commit((d) => {
        const n = d.nodes[a1];
        if (n) { n.text = 'A1-改'; n.updatedAt = Date.now(); }
      }, { snapshot: true, silent: true, persistOnly: true });
      const nodes = state.nodes;
      const ids = Object.keys(nodes);
      let parentOk = true, childOk = true, noDup = true, noCycle = true;
      for (const id of ids) {
        const n = nodes[id];
        if (id === rootId) {
          if (n.parent !== null) parentOk = false;
        } else {
          const p = nodes[n.parent];
          if (!p || !(p.children || []).includes(id)) parentOk = false;
        }
        const kids = n.children || [];
        const seen = new Set();
        for (const k of kids) {
          if (seen.has(k)) noDup = false;
          seen.add(k);
          if (!nodes[k]) { childOk = false; continue; }
          if (nodes[k].parent !== id) parentOk = false;
        }
        /* 无环：沿 parent 上溯，超过节点总数仍未到 null 或出现自环 → 有环 */
        let cur = id, steps = 0;
        while (cur !== null && steps <= ids.length) {
          const p = nodes[cur] ? nodes[cur].parent : null;
          if (p === cur) { noCycle = false; break; }
          cur = p; steps++;
        }
        if (cur !== null && steps > ids.length) noCycle = false;
      }
      return { parentOk, childOk, noDup, noCycle, aText: nodes[a1].text, nodesCount: ids.length };
    });
    expect(r.parentOk).toBe(true);
    expect(r.childOk).toBe(true);
    expect(r.noDup).toBe(true);
    expect(r.noCycle).toBe(true);
    expect(r.aText).toBe('A1-改');
    expect(r.nodesCount).toBeGreaterThanOrEqual(6);

    /* ===== r18 大纲多选回归（Ctrl / Shift / Text 节点目标 / 选中底色） =====
       背景：contenteditable 内的 mousedown 目标可能是 Text 节点（nodeType===3），
       旧实现直接调用 e.target.closest(...) 会抛 TypeError 并中断多选；同时选中态被
       r15/r16 的透明规则清零，用户看不到选择结果。本段以真实 DOM 事件复核修复。 */
    const ms = await page.evaluate(() => {
      ui.view = 'outline';
      ui.currentDocId = state.rootId;
      _outlineSel = { docId: state.rootId, anchorId: null, ids: new Set() };
      forceRender();
      const textEls = () => Array.from(document.querySelectorAll('#content .outline .row .text'));
      const fire = (el, mods) => el.dispatchEvent(new MouseEvent('mousedown', Object.assign(
        { bubbles: true, cancelable: true, button: 0, view: window }, mods)));
      const before = textEls().length;
      /* ① Ctrl+点击 两行（行级非编辑区目标 = .row 本身；R94 起 .text 内同样触发节点多选，回到 pre-r89 契约） */
      fire(textEls()[0].closest('.row'), { ctrlKey: true });
      fire(textEls()[1].closest('.row'), { ctrlKey: true });
      const ctrlCount = _outlineSel.ids.size;
      const ctrlRows = document.querySelectorAll('#content .outline .row.multi-sel').length;
      const ctrlBg = getComputedStyle(document.querySelector('#content .outline .row.multi-sel')).backgroundColor;
      /* ② Shift+点击：以首个可见行（排除根）为锚点，选择到第二行 */
      const seq = outlineVisibleSeq(getCurrentDoc()).filter((id) => id !== state.rootId && N(id));
      _outlineSel = { docId: state.rootId, anchorId: seq[0], ids: new Set([seq[0]]) };
      forceRender();
      fire(textEls()[1].closest('.row'), { shiftKey: true });
      const shiftCount = _outlineSel.ids.size;
      const shiftRows = document.querySelectorAll('#content .outline .row.multi-sel').length;
      /* ③ Text 节点目标 + Ctrl：直接向 Text 节点派发 mousedown —— 不得抛 closest TypeError；
         R94 起编辑区（.text）内的 Ctrl / Shift 恢复节点多选（pre-r89 契约），故期望 1。 */
      _outlineSel = { docId: state.rootId, anchorId: null, ids: new Set() };
      forceRender();
      let err = null;
      const onErr = (ev) => { if (!err) err = String(ev.message || ev.error || ''); };
      window.addEventListener('error', onErr);
      const host = textEls().find((el) => el.firstChild && el.firstChild.nodeType === 3) || textEls()[0];
      const tn = host.firstChild || host;
      try {
        tn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, view: window, ctrlKey: true }));
      } catch (e) {
        err = 'THROW:' + String(e);
      }
      window.removeEventListener('error', onErr);
      const textNodeSel = _outlineSel.ids.size;
      const textNodeErr = err;
      /* ④ .row.sel 视觉反馈（清空多选后仅置焦点行） */
      _outlineSel = { docId: state.rootId, anchorId: null, ids: new Set() };
      ui.focusId = textEls()[0].dataset.id;
      forceRender();
      const selRow = document.querySelector('#content .outline .row.sel');
      const selBg = selRow ? getComputedStyle(selRow).backgroundColor : 'none';
      return { before, ctrlCount, ctrlRows, ctrlBg, shiftCount, shiftRows, textNodeSel, textNodeErr, selBg };
    });
    expect(ms.before).toBeGreaterThanOrEqual(2);
    expect(ms.ctrlCount).toBe(2);
    expect(ms.ctrlRows).toBe(2);
    expect(ms.ctrlBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(ms.ctrlBg).not.toBe('transparent');
    expect(ms.shiftCount).toBeGreaterThanOrEqual(2);
    expect(ms.shiftRows).toBe(ms.shiftCount);
    expect(ms.textNodeSel).toBe(1);
    expect(ms.textNodeErr).toBeNull();
    expect(ms.selBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(ms.selBg).not.toBe('transparent');

    /* ===== r19 拖拽方向智能判定（真实鼠标事件）=====
       ① 水平拖拽 = 选中文字：产生原生 Selection，且不进入 .multi-sel；
       ② 垂直跨行拖拽 = 多选：产生 .multi-sel、清空文本 Selection，底色生效且无边框 / 描边 / 阴影。 */
    const seed = await page.evaluate(() => {
      ui.view = 'outline';
      ui.currentDocId = state.rootId;
      _outlineSel = { docId: state.rootId, anchorId: null, ids: new Set() };
      const a = actions.addNode(state.rootId, 0, {
        text: '拖拽多选测试行A：这是一段足够长的文本，用于验证水平拖拽能够产生原生文本选区。'
      });
      const b = actions.addNode(state.rootId, 1, { text: '拖拽多选测试行B：垂直拖拽应当同时选中这两行。' });
      forceRender();
      const rowOf = (id: number) => document.querySelector('#content .outline .node[data-id="' + id + '"] > .row');
      const ra = rowOf(a), rb = rowOf(b);
      const ta = ra.querySelector('.text').getBoundingClientRect();
      const tb = rb.querySelector('.text').getBoundingClientRect();
      return {
        a, b,
        ax: Math.round(ta.left + 6), ay: Math.round(ta.top + ta.height / 2),
        ax2: Math.round(ta.left + Math.min(180, ta.width - 10)), ay2: Math.round(ta.top + ta.height / 2),
        by: Math.round(tb.top + tb.height / 2)
      };
    });
    /* ① 水平拖拽 */
    await page.mouse.move(seed.ax, seed.ay);
    await page.mouse.down();
    await page.mouse.move(seed.ax2, seed.ay2, { steps: 10 });
    const horiz = await page.evaluate(() => ({
      multi: document.querySelectorAll('#content .outline .row.multi-sel').length,
      ids: _outlineSel.ids.size,
      text: String(window.getSelection())
    }));
    await page.mouse.up();
    expect(horiz.multi).toBe(0);
    expect(horiz.ids).toBe(0);
    expect(horiz.text.length).toBeGreaterThan(0);
    /* ②-A 垂直拖拽（起点在 .text 内 · 真实鼠标）：R95 起 .text 内同样进入方向判定，
       垂直为主（|dy| > |dx| + 5）→ 进入 multi-select，文本选区被清空 */
    await page.evaluate(() => {
      try { window.getSelection().removeAllRanges(); } catch (e) { /* noop */ }
      _outlineSel = { docId: state.rootId, anchorId: null, ids: new Set() };
      forceRender();
    });
    await page.mouse.move(seed.ax, seed.ay);
    await page.mouse.down();
    await page.mouse.move(seed.ax + 1, seed.by, { steps: 12 });
    const verticalText = await page.evaluate(() => {
      const s = window.getSelection();
      const ae = document.activeElement;
      const host = ae && ae.classList && ae.classList.contains('text') ? ae : null;
      const anc = s && s.anchorNode ? (s.anchorNode.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode) : null;
      return {
        ids: _outlineSel.ids.size,
        multi: document.querySelectorAll('#content .outline .row.multi-sel').length,
        ranges: s ? s.rangeCount : 0,
        anchorInHost: !!(host && anc && (host === anc || host.contains(anc)))
      };
    });
    await page.mouse.up();
    /* R95 契约：.text 内垂直拖动进入跨行多选（.multi-sel 生效、_outlineSel 落位两行），
       应用在 multi 模式下清空文本 Selection（rangeCount=0），不再保留起始编辑区内的 Range */
    expect(verticalText.multi).toBe(2);
    expect(verticalText.ids).toBe(2);
    expect(verticalText.ranges).toBe(0);
    expect(verticalText.anchorInHost).toBe(false);
    /* ②-B 垂直跨行拖拽（起点为行 chrome = .row 元素目标，非 .text / handle / arrow / actions）→ 多选 */
    const dragStyle = await page.evaluate(async ({ a, b }) => {
      try { window.getSelection().removeAllRanges(); } catch (e) { /* noop */ }
      _outlineSel = { docId: state.rootId, anchorId: null, ids: new Set() };
      forceRender();
      const rowOf = (id) => document.querySelector('#content .outline .node[data-id="' + id + '"] > .row');
      const ra = rowOf(a), rb = rowOf(b);
      if (!ra || !rb) return { ids: 0, multi: 0, text: 'NO_ROW' };
      const ba = ra.getBoundingClientRect(), bb = rb.getBoundingClientRect();
      const ax = Math.round(ba.left + ba.width / 2), ay = Math.round(ba.top + ba.height / 2);
      const by = Math.round(bb.top + bb.height / 2);
      const fire = (type, el, x, y) => el.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, view: window
      }));
      fire('mousedown', ra, ax, ay);
      fire('mousemove', document, ax + 1, ay + 40);
      fire('mousemove', document, ax + 1, by);
      fire('mouseup', document, ax + 1, by);
      await new Promise((r) => setTimeout(r, 60));
      const row = document.querySelector('#content .outline .row.multi-sel');
      const cs = row ? getComputedStyle(row) : null;
      return {
        ids: _outlineSel.ids.size,
        multi: document.querySelectorAll('#content .outline .row.multi-sel').length,
        text: String(window.getSelection()),
        bg: cs ? cs.backgroundColor : 'none',
        outlineStyle: cs ? cs.outlineStyle : 'none',
        outlineWidth: cs ? cs.outlineWidth : '0px',
        borderStyle: cs ? cs.borderTopStyle : 'none',
        borderWidth: cs ? cs.borderTopWidth : '0px',
        shadow: cs ? cs.boxShadow : 'none'
      };
    }, { a: seed.a, b: seed.b });
    const unify = await page.evaluate((ids) => {
      _outlineSel = { docId: state.rootId, anchorId: null, ids: new Set([ids.b]) };
      ui.focusId = ids.a;
      forceRender();
      const selRow = document.querySelector('#content .outline .row.sel');
      const multiRow = document.querySelector('#content .outline .row.multi-sel');
      return {
        selBg: selRow ? getComputedStyle(selRow).backgroundColor : 'none',
        multiBg: multiRow ? getComputedStyle(multiRow).backgroundColor : 'none',
        selOutline: selRow ? getComputedStyle(selRow).outlineStyle : 'outline',
        multiOutline: multiRow ? getComputedStyle(multiRow).outlineStyle : 'outline'
      };
    }, { a: seed.a, b: seed.b });
    expect(dragStyle.multi).toBeGreaterThanOrEqual(2);
    expect(dragStyle.ids).toBe(dragStyle.multi);
    expect(dragStyle.text).toBe('');
    expect(dragStyle.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(dragStyle.bg).not.toBe('transparent');
    expect(dragStyle.outlineStyle).toBe('none');
    expect(dragStyle.borderStyle).toBe('none');
    expect(dragStyle.shadow).toBe('none');
    expect(unify.selBg).toBe(unify.multiBg);
    expect(unify.selOutline).toBe('none');
    expect(unify.multiOutline).toBe('none');
  });
  // ============================================================
  // 二、undo 后 state 与快照值相等、引用不等
  // ============================================================
  test('undo 后 state 与快照值相等、引用不等（历史副本）', async ({ page }) => {
    const r = await page.evaluate(() => {
      const before = state;
      const preUpdatedAt = state.updatedAt;
      commit((d) => { d._iv_undo = 1; }, { snapshot: true, silent: true, persistOnly: true });
      const after = state;
      const midUpdatedAt = state.updatedAt;
      const undone = undo();
      return {
        undone,
        refDiff: state !== after && state !== before,
        valueEqual: state.updatedAt === preUpdatedAt,
        markerGone: state._iv_undo === undefined,
        midValue: after._iv_undo === 1,
        midBumped: midUpdatedAt > preUpdatedAt,
      };
    });
    expect(r.undone).toBe(true);
    expect(r.refDiff).toBe(true);
    expect(r.valueEqual).toBe(true);
    expect(r.markerGone).toBe(true);
    expect(r.midValue).toBe(true);
    expect(r.midBumped).toBe(true);
  });
  // ============================================================
  // 三、连续 undo/redo 收敛 + 历史栈边界
  // ============================================================
  test('连续 undo/redo 收敛：状态稳定、空栈边界 false、可再恢复', async ({ page }) => {
    const r = await page.evaluate(() => {
      commit((d) => { d._iv_a = 1; }, { snapshot: true, silent: true, persistOnly: true }); // h1
      commit((d) => { d._iv_b = 1; }, { snapshot: true, silent: true, persistOnly: true }); // h2（当前）
      const u1 = undo(); // → h1'
      const h1a = state._iv_a === 1, h1b = state._iv_b === undefined;
      const u2 = undo(); // → h0'
      const h0a = state._iv_a === undefined;
      const r1 = redo(); // → h1''
      const h1a2 = state._iv_a === 1, h1b2 = state._iv_b === undefined;
      const r2 = redo(); // → h2'
      const h2a = state._iv_a === 1, h2b = state._iv_b === 1;
      /* 第二轮收敛 */
      const u3 = undo(); const u4 = undo();
      const cleared = state._iv_a === undefined && state._iv_b === undefined;
      const u5 = undo(); // 空栈边界 → false
      const r3 = redo(); // 恢复 h1
      const r4 = redo(); // 恢复 h2
      const reconverged = state._iv_a === 1 && state._iv_b === 1;
      const u6 = undo(); // 仍可撤销 → true
      return { u1, u2, r1, r2, h1a, h1b, h0a, h1a2, h1b2, h2a, h2b, u3, u4, cleared, u5, r3, r4, reconverged, u6 };
    });
    expect(r.u1).toBe(true);
    expect(r.u2).toBe(true);
    expect(r.r1).toBe(true);
    expect(r.r2).toBe(true);
    expect(r.h1a).toBe(true);
    expect(r.h1b).toBe(true);
    expect(r.h0a).toBe(true);
    expect(r.h1a2).toBe(true);
    expect(r.h1b2).toBe(true);
    expect(r.h2a).toBe(true);
    expect(r.h2b).toBe(true);
    expect(r.u3).toBe(true);
    expect(r.u4).toBe(true);
    expect(r.cleared).toBe(true);
    expect(r.u5).toBe(false);   // 空栈边界：继续 undo 返回 false
    expect(r.r3).toBe(true);
    expect(r.r4).toBe(true);
    expect(r.reconverged).toBe(true); // 收敛：第二轮后状态与第一轮一致
    expect(r.u6).toBe(true);     // 栈未损坏，仍可继续撤销
  });
});
