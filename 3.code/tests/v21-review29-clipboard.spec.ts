import { test, expect } from '@playwright/test';
import { prepare, ready } from './review8-helpers';
const BASE = 'http://localhost:5173';

/* review29 · ISSUE-005：Ctrl+C/V 多节点 + 跨层级（父与子同时选中不得重复复制）
   证伪：把 copy 处理器的 xsel/多选分支改回「直接放行原生复制」或去掉「祖先过滤」，
   下面的 topCount / 粘贴节点数断言必须失败（旧行为只粘贴 1 个节点或重复子树）。 */

test('review29-02 · 多选跨层级复制只取顶层，粘贴出完整子树', async ({ context, page }) => {
  test.setTimeout(180_000);
  await prepare(context);
  await page.goto(BASE, { waitUntil: 'load' });
  await ready(page);

  const r: any = await page.evaluate(async () => {
    const J: any = (window as any).JU;
    const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

    /* 源文档：A > B，另有同级 C */
    const d = J.actions.createDoc('R29-CLIP-SRC ' + Date.now());
    J.actions.setCurrentDoc(d);
    const a = J.actions.addNode(d, undefined, { text: 'A' });
    const b = J.actions.addNode(a, undefined, { text: 'B' });
    const c = J.actions.addNode(d, undefined, { text: 'C' });
    J.renderMain();
    await wait(150);

    /* 选中 A..C（含子节点 B）——模拟跨层级选区 */
    J.outlineSelectRange(J.getState().nodes[d], a, c, false);
    await wait(80);

    /* 走真实 copy 事件：读 handler 写入的 text/plain（JU-NODES 载荷） */
    const dt = new DataTransfer();
    const cev = new ClipboardEvent('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(cev, 'clipboardData', { value: dt });
    document.dispatchEvent(cev);
    const payload = dt.getData('text/plain');
    const payloadNodes = payload ? JSON.parse(payload.slice(payload.indexOf('{'))).nodes : [];

    /* 目标文档：空树 + 一个占位节点 */
    const d2 = J.actions.createDoc('R29-CLIP-DST ' + Date.now());
    J.actions.setCurrentDoc(d2);
    const t = J.actions.addNode(d2, undefined, { text: 'T' });
    J.renderMain();
    await wait(150);

    /* 选中占位节点后走真实 paste 事件 */
    J.outlineSelectRange(J.getState().nodes[d2], t, t, false);
    await wait(80);
    const pdt = new DataTransfer();
    pdt.setData('text/plain', payload);
    const pev = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pev, 'clipboardData', { value: pdt });
    (document.querySelector(`#content .outline .node[data-id="${t}"] .text`) as HTMLElement)?.focus();
    document.dispatchEvent(pev);
    await wait(300);

    const st = J.getState();
    const ids: string[] = [];
    (function w(id: string) { const n = st.nodes[id]; if (!n) return; ids.push(id); (n.children || []).forEach(w); })(d2);
    const texts = ids.map((id) => String(st.nodes[id].text).replace(/<[^>]*>/g, '').trim()).filter(Boolean);
    const A = ids.map((id) => st.nodes[id]).find((n: any) => n.text === 'A');
    const B = ids.map((id) => st.nodes[id]).find((n: any) => n.text === 'B');
    return {
      payloadTop: payloadNodes.length,
      payloadFlat: (function () { const out: string[] = []; const w = (ns: any[]) => ns.forEach((n) => { out.push(n.text); w(n.children || []); }); w(payloadNodes); return out; })(),
      pastedCount: ids.length - 1,
      texts,
      aHasB: !!(A && B && (A.children || []).includes(B.id)),
    };
  });

  expect(r.payloadTop, 'PU 载荷顶层只应有 A 与 C（B 随 A 的子树，不得重复为顶层）').toBe(2);
  expect(r.payloadFlat, '载荷展平应为 A>B + C').toEqual(expect.arrayContaining(['A', 'B', 'C']));
  expect(r.pastedCount, '粘贴后应新增 4 个节点（A、B、C + 占位 T）').toBe(4);
  expect(r.aHasB, '粘贴后 A 仍包含子节点 B（层级未被压平）').toBe(true);
  expect(r.texts, '粘贴结果含 A/B/C').toEqual(expect.arrayContaining(['A', 'B', 'C']));
});
