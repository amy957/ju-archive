import { test, expect } from '@playwright/test';
import { prepare, ready } from './review8-helpers';
const BASE = 'http://localhost:5173';

/* review29 · ISSUE-005：折叠/批量展开定向回归
   证伪：把 _toggleCollapseDirect 改回「deps.commit 改 collapsed + forceRender」旧实现后，
   第一条用例的 collapsed 断言必须失败（commit→persist→mergeRemoteState 会把翻转回写为旧值）。
   注：actions.addNode(parentId, index?, init?) —— 第一参是父节点，不是文档。 */

test('review29-01 · 箭头点击翻转 collapsed 且 DOM 一致', async ({ context, page }) => {
  test.setTimeout(180_000);
  await prepare(context);
  await page.goto(BASE, { waitUntil: 'load' });
  await ready(page);

  const seed: any = await page.evaluate(() => {
    const J: any = (window as any).JU;
    const d = J.actions.createDoc('R29-COLL ' + Date.now());
    J.actions.setCurrentDoc(d);
    const a = J.actions.addNode(d, undefined, { text: 'A' });
    J.actions.addNode(a, undefined, { text: 'B' });
    J.actions.addNode(a, undefined, { text: 'C' });
    J.renderMain();
    return { d, a };
  });

  const readState = () => page.evaluate((id: string) => {
    const J: any = (window as any).JU;
    const n = J.getState().nodes[id];
    const box = document.querySelector(`#content .outline .node[data-id="${id}"]`) as HTMLElement | null;
    return {
      collapsed: !!n.collapsed,
      kids: (n.children || []).length,
      arrow: box?.querySelector(':scope > .row .arrow')?.textContent ?? '',
      hasHint: !!box?.querySelector(':scope > .collapsed-hint'),
      hasChildren: !!box?.querySelector(':scope > .children'),
    };
  }, seed.a);

  const s0 = await readState();
  expect(s0.kids, 'A 应有 2 个子节点').toBe(2);
  expect(s0.collapsed, '初始应为展开').toBe(false);
  expect(s0.hasChildren, '初始应渲染子树').toBe(true);

  await page.locator(`#content .outline .node[data-id="${seed.a}"] > .row .arrow`).click();
  const s1 = await readState();
  expect(s1.collapsed, '点击箭头后 state.collapsed 必须翻转（不得被 persist 回写）').toBe(true);
  expect(s1.arrow, '箭头字符应为 ▶').toBe('▶');
  expect(s1.hasHint, '应出现折叠提示').toBe(true);
  expect(s1.hasChildren, '折叠后子树应移除').toBe(false);

  await page.locator(`#content .outline .node[data-id="${seed.a}"] > .row .arrow`).click();
  const s2 = await readState();
  expect(s2.collapsed, '再次点击应展开').toBe(false);
  expect(s2.hasChildren, '展开后子树应恢复').toBe(true);
});

test('review29-01b · 右栏批量展开按钮设置正确的 collapsed 集合', async ({ context, page }) => {
  test.setTimeout(180_000);
  await prepare(context);
  await page.goto(BASE, { waitUntil: 'load' });
  await ready(page);

  await page.evaluate(() => {
    const J: any = (window as any).JU;
    const d = J.actions.createDoc('R29-EXPAND ' + Date.now());
    J.actions.setCurrentDoc(d);
    const a = J.actions.addNode(d, undefined, { text: 'A' });
    const b = J.actions.addNode(a, undefined, { text: 'B' });
    J.actions.addNode(b, undefined, { text: 'C' });   /* 三级链：l2 与 l3 结果不同 */
    J.renderMain();
  });

  const collapsedCount = () => page.evaluate(() => {
    const J: any = (window as any).JU;
    const st = J.getState();
    const ids: string[] = [];
    (function w(id: string) { const n = st.nodes[id]; if (!n) return; ids.push(id); (n.children || []).forEach(w); })(st.rootId);
    return ids.filter((id) => id !== st.rootId && st.nodes[id]?.collapsed).length;
  });

  const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('[data-expand]')).map((b: any) => b.dataset.expand));
  expect(buttons, '右栏必须有 all/none/l2/l3 四个按钮').toEqual(expect.arrayContaining(['all', 'none', 'l2', 'l3']));

  await page.locator('[data-expand="none"]').click();
  expect(await collapsedCount(), '收起全部：非叶子节点都折叠').toBe(2);

  await page.locator('[data-expand="all"]').click();
  expect(await collapsedCount(), '展开全部：无节点折叠').toBe(0);

  await page.locator('[data-expand="l2"]').click();
  expect(await collapsedCount(), '展开到二级：仅相对深度≥2 的节点折叠').toBe(1);
});
