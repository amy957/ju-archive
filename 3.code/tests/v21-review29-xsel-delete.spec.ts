import { test, expect } from '@playwright/test';
import { prepare, ready } from './review8-helpers';
const BASE = 'http://localhost:5173';

/* review29 · ISSUE-005：删除节点的「复活」回归
   根因：直接 `delete s.nodes[id]` 没有 _recentlyRemoved 墓碑，
   commit 尾部 persistNow→runPersist→mergeRemoteState 会按落盘快照把节点写回来。
   证伪：把 removeNode 改成裸 delete（不写墓碑）后，persistNow 之后的断言必须失败。
   说明：跨行 xsel 拖选在 headless 下不触发（.ju-xsel=0），故本 spec 锁定同一条
   「删除必须落墓碑、不得被快照复活」不变量；不依赖拖选手势，也不用固定等待（用 persistNow + poll）。 */

test('review29-03 · 删除节点后强制落盘合并，不得复活', async ({ context, page }) => {
  test.setTimeout(180_000);
  await prepare(context);
  await page.goto(BASE, { waitUntil: 'load' });
  await ready(page);

  const seed: any = await page.evaluate(() => {
    const J: any = (window as any).JU;
    const d = J.actions.createDoc('R29-DEL ' + Date.now());
    J.actions.setCurrentDoc(d);
    const a = J.actions.addNode(d, undefined, { text: 'AAA' });
    const b = J.actions.addNode(a, undefined, { text: 'BBB' });
    const c = J.actions.addNode(a, undefined, { text: 'CCC' });
    J.renderMain();
    return { d, a, b, c };
  });

  const texts = () => page.evaluate(({ d }: any) => {
    const J: any = (window as any).JU;
    const st = J.getState();
    const ids: string[] = [];
    (function w(id: string) { const n = st.nodes[id]; if (!n) return; ids.push(id); (n.children || []).forEach(w); })(d);
    return { list: ids.map((id) => String(st.nodes[id].text).replace(/<[^>]*>/g, '').trim()), count: ids.length };
  }, { d: seed.d });

  const s0 = await texts();
  expect(s0.count, '初始 4 个节点（文档根 + A/B/C）').toBe(4);

  /* 删除 B，立即断言 */
  await page.evaluate((b: string) => (window as any).JU.actions.removeNode(b), seed.b);
  await expect.poll(async () => (await texts()).list.includes('BBB'), { timeout: 3000 }).toBe(false);

  /* 强制落盘 + 合并周期：墓碑必须阻止磁盘快照把 B 写回 */
  await page.evaluate(() => { const J: any = (window as any).JU; J.persistNow(); });
  await expect.poll(async () => (await texts()).list.includes('BBB'), { timeout: 3000 }).toBe(false);
  expect((await texts()).count, '节点数保持 3').toBe(3);

  /* 再删 C，重复同一不变量（连续删除不应互相干扰） */
  await page.evaluate((c: string) => (window as any).JU.actions.removeNode(c), seed.c);
  await page.evaluate(() => { const J: any = (window as any).JU; J.persistNow(); });
  await expect.poll(async () => {
    const t = await texts();
    return t.list.includes('CCC') || t.list.includes('BBB');
  }, { timeout: 3000 }).toBe(false);
});
