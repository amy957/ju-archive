/**
 * P0-T3 Step3 · light 模式原地修改污染回归测试
 *
 * 依赖：
 *   npm i -D @playwright/test
 *   （浏览器：本环境使用系统 Chromium，见 playwright.config.ts 的 executablePath；
 *     其他环境可执行 npx playwright install chromium）
 *
 * 运行：
 *   npx playwright test tests/t3-light-pollution.spec.ts
 *
 * 目标文件：
 *   默认读取 file://<项目根>/v2.0-t3.html（工作文件，含 Step1-3 全部修改）
 *   如产物路径不同，请通过环境变量 JU_APP_URL 覆盖：
 *     JU_APP_URL=http://localhost:8000/v2.0-t3.html npx playwright test ...
 *
 * 断言策略：
 *   - 直接操作页面内全局函数（commit / undo / redo / safeClone / reportError /
 *     scheduleNotify），这些函数在 v2.0-t3.html 的经典 <script> 顶层声明，
 *     挂载于 window。
 *   - 注意：state 是顶层 `let` 声明，属于全局词法绑定，**不挂在 window 上**；
 *     统一通过 window.getState() 读取当前状态。
 *   - 通过 window.__juLog（reportError 的环形缓冲）观察错误 kind。
 *   - 不依赖内部 const（historyPast / historyFuture 非 window 挂载），
 *     改用行为路径（连续 undo 返回值）验证历史栈。
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_URL =
  process.env.JU_APP_URL ||
  'file://' + path.resolve(__dirname, '..', 'v2.0-t3.html');
/** 打开应用并等待关键原语就绪。 */
async function bootApp(page: import('@playwright/test').Page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof (window as any).__juProduce === 'function' &&
          typeof (window as any).commit === 'function' &&
          typeof (window as any).getState === 'function' &&
          (window as any).getState() !== null,
    null,
    { timeout: 5000 }
  );
}
/** 清空历史栈：反复 undo 直到返回 false，保证用例隔离。 */
async function drainHistory(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    let safety = 0;
    while ((window as any).undo() && safety++ < 200) { /* drain */ }
  });
}
test.describe('P0-T3 Step3 · light 原地修改污染', () => {
  test.beforeEach(async ({ page }) => {
    await bootApp(page);
    await drainHistory(page);
  });
  // ── B2 · light 成功路径 ──────────────────────────────────────────
  test('light commit 成功：state 引用改变（copy-on-write），updatedAt 被 bump', async ({ page }) => {
    const r = await page.evaluate(() => {
      const s = window as any;
      const before = s.getState();
      const beforeUpdatedAt = before.updatedAt;
      let actionRan = false;
      s.commit(
        (d: any) => {
          actionRan = true;
          if (!d.dbColumnWidths) d.dbColumnWidths = {};
          d.dbColumnWidths['__l3_light_test__'] = 123;
        },
        { silent: true, persistOnly: true, light: true, noRollback: true }
      );
      const after = s.getState();
      return {
        actionRan,
        sameRef: after === before,
        updatedAtBumped: after.updatedAt > beforeUpdatedAt,
        valueWritten: after.dbColumnWidths['__l3_light_test__'],
      };
    });
    expect(r.actionRan).toBe(true);
    // 【P0-T3 结构共享】light 不再 draft=state 原地修改（commit L2099-2103 注释），
    // 统一 __juProduceSafe 路径复制：引用必变，消除对 historyPast / 在途快照的污染
    expect(r.sameRef).toBe(false);
    // commit 尾部无条件 bump updatedAt，所有指纹可感知
    expect(r.updatedAtBumped).toBe(true);
    expect(r.valueWritten).toBe(123);
  });
  // ── A2 · noRollback + action 抛错 ────────────────────────────────
  test('light + noRollback + action 抛错：state 未污染（produce 失败天然回滚）', async ({ page }) => {
    const r = await page.evaluate(() => {
      const s = window as any;
      const beforeRef = s.getState();
      // commit 内部捕获，不应向外传播
      let thrown = false;
      try {
        s.commit(
          (d: any) => {
            if (!d.dbColumnWidths) d.dbColumnWidths = {};
            // 先写，再抛错
            d.dbColumnWidths['__l3_polluted__'] = 1;
            throw new Error('intentional-light-failure');
          },
          { silent: true, persistOnly: true, light: true, noRollback: true }
        );
      } catch (e) {
        thrown = true;
      }
      const polluted = (s.getState().dbColumnWidths &&
        s.getState().dbColumnWidths['__l3_polluted__'] === 1);
      return {
        thrown,
        polluted,
        refUnchanged: s.getState() === beforeRef,
      };
    });
    // 原语内部吞掉 action 抛错，不向调用方传播
    expect(r.thrown).toBe(false);
    // 【P0-T3 结构共享】__juProduceSafe 失败返回 {ok:false}，state 原引用不变、
    // 天然不污染 base（commit L2102-2103 注释），noRollback 参数保留兼容、语义自然满足
    expect(r.polluted).toBe(false);
    expect(r.refUnchanged).toBe(true);
  });
  // ── A1 · _lightBackup 机制已随结构共享移除（safeClone 与 light 失败路径解耦） ──
  test('light + safeClone 被替换 + action 抛错：state 不受影响（备份机制已移除）', async ({ page }) => {
    const r = await page.evaluate(() => {
      const s = window as any;
      const beforeRef = s.getState();
      // 旧机制防御：safeClone 双失败返回原引用曾触发 backup-invalid 上报；
      // 结构共享后 light 失败路径不再依赖 safeClone/_lightBackup，替换之应无任何影响
      const origSafeClone = s.safeClone;
      s.safeClone = () => s.getState();
      try {
        s.commit(
          (d: any) => {
            if (!d.tagColors) d.tagColors = {};
            d.tagColors['__l3_backup_invalid__'] = '#000';
            throw new Error('force-after-fake-backup');
          },
          { silent: true, persistOnly: true, light: true, noRollback: false }
        );
      } finally {
        s.safeClone = origSafeClone;
      }
      return {
        polluted: !!(s.getState().tagColors && s.getState().tagColors['__l3_backup_invalid__']),
        refUnchanged: s.getState() === beforeRef,
      };
    });
    // 【P0-T3 结构共享】produce 失败 state 原引用不变（commit L2102-2103 注释），
    // safeClone 打桩无法影响 light 失败语义
    expect(r.polluted).toBe(false);
    expect(r.refUnchanged).toBe(true);
  });
  // ── 非 light 路径回归（Step2） ──────────────────────────────────
  test('非 light + action 抛错：state 引用与内容均不变', async ({ page }) => {
    const r = await page.evaluate(() => {
      const s = window as any;
      const beforeRef = s.getState();
      const beforeNodeCount = Object.keys(s.getState().nodes).length;
      s.commit(
        (d: any) => {
          // 在克隆 draft 上破坏，不应影响原 state
          d.nodes = null;
          throw new Error('non-light-failure');
        },
        { silent: true, persistOnly: true }
      );
      const after = s.getState();
      return {
        sameRef: after === beforeRef,
        sameNodesCount: Object.keys(after.nodes).length === beforeNodeCount,
      };
    });
    expect(r.sameRef).toBe(true);
    expect(r.sameNodesCount).toBe(true);
  });
  // ── B2 + 持久化 · 指纹可感知 light 修改 ─────────────────────────
  test('light 修改后 _lastWrittenJson 指纹不一致，持久化写入磁盘', async ({ page }) => {
    // 先等启动期首次持久化完成，避免与本用例的持久化交错
    await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const s = window as any;
      // 通过 storage 观察写盘；加密模式下可能落在 ENC_KEY，故同时检查两者
      const snapshot = () => ({
        plain: localStorage.getItem('juju.store.v31') || '',
        enc: localStorage.getItem('juju.enc.v1') || '',
      });
      const before = snapshot();
      s.commit(
        (d: any) => {
          if (!d.dbColumnWidths) d.dbColumnWidths = {};
          d.dbColumnWidths['__l3_fingerprint__'] = Date.now();
        },
        { silent: true, persistOnly: true, light: true, noRollback: true }
      );
      // 等 300ms 防抖 + 一次写盘
      await new Promise((r) => setTimeout(r, 800));
      const after = snapshot();
      return {
        changed:
          before.plain !== after.plain ||
          before.enc !== after.enc,
      };
    });
    expect(r.changed).toBe(true);
  });
  // ── C1 · light 不入历史栈 ────────────────────────────────────────
  test('light 不入历史栈：连续两次 undo，第二次返回 false', async ({ page }) => {
    // 已 beforeEach drainHistory，历史栈此时应为空
    const r = await page.evaluate(() => {
      const s = window as any;
      // 一次 snapshot commit：入栈
      s.commit(
        (d: any) => {
          if (!d.tagColors) d.tagColors = {};
          d.tagColors['__l3_hist__'] = '#ff0000';
        },
        { snapshot: true, silent: true, persistOnly: true }
      );
      // 一次 light commit：不入栈
      s.commit(
        (d: any) => {
          if (!d.dbColumnWidths) d.dbColumnWidths = {};
          d.dbColumnWidths['__l3_hist__'] = 456;
        },
        { silent: true, persistOnly: true, light: true, noRollback: true }
      );
      const first = s.undo();   // 回退 snapshot
      const second = s.undo();  // 历史栈已空，应返回 false
      return { first, second };
    });
    expect(r.first).toBe(true);
    // light 未入栈，第二次 undo 无事可做
    expect(r.second).toBe(false);
  });
  // ── B1 · 抛错路径在非 silent 下强制重渲染 ────────────────────────
  test('light + action 抛错 + silent:false：scheduleNotify 被调用', async ({ page }) => {
    const r = await page.evaluate(() => {
      const s = window as any;
      const origNotify = s.scheduleNotify;
      let notifyCount = 0;
      s.scheduleNotify = () => { notifyCount++; };
      try {
        s.commit(
          (d: any) => {
            if (!d.dbColumnWidths) d.dbColumnWidths = {};
            d.dbColumnWidths['__l3_notify__'] = 1;
            throw new Error('force-notify');
          },
          { silent: false, persistOnly: false, light: true, noRollback: true }
        );
      } finally {
        s.scheduleNotify = origNotify;
      }
      return { notifyCount };
    });
    expect(r.notifyCount).toBeGreaterThan(0);
  });
});
