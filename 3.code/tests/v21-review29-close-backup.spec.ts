import { test, expect } from '@playwright/test';
import { prepare, ready } from './review8-helpers';
const BASE = 'http://localhost:5173';

/* review29 · 关闭备份落点回归（用户报障：关闭时自动备份没写到选择的备份位置）
   根因：目录选择器兜底只能拿到文件夹名（浏览器不暴露绝对路径）→ _juWritableDir 判否
        → _closeBackupPayload 原实现直接 return null（整份备份被丢弃）。
   修复后断言：路径不可写时**仍然发起 save_backup**（path 回落为空 = 写默认 backups/），
   而不是静默跳过。证伪：把 _closeBackupPayload 改回 `return null` 后本用例必须失败。 */

test('close-backup-01 · 备份路径不可写时回落默认位置而非跳过', async ({ context, page }) => {
  test.setTimeout(180_000);

  /* 用 mock __TAURI__ 让页面进入「桌面模式」，并捕获 IPC 调用 */
  await context.addInitScript(() => {
    const calls: any[] = [];
    (window as any).__juCalls = calls;
    const invoke = (cmd: string, args?: any) => {
      calls.push({ cmd, args });
      return Promise.resolve(cmd === 'load_state' ? null : null);
    };
    (window as any).__TAURI__ = {
      core: { invoke },
      dialog: { open: () => Promise.resolve(null) },
      window: {
        getCurrentWindow: () => ({
          onCloseRequested: (h: any) => { (window as any).__juClose = h; },
          hide: () => Promise.resolve(),
          close: () => Promise.resolve(true),
        }),
        getCurrent: () => ({
          onCloseRequested: (h: any) => { (window as any).__juClose = h; },
          hide: () => Promise.resolve(),
          close: () => Promise.resolve(true),
        }),
      },
    };
  });

  await prepare(context);
  await page.goto(BASE, { waitUntil: 'load' });
  await ready(page);

  /* 造一点内容，确保 close 备份载荷非空 */
  await page.evaluate(() => {
    const J: any = (window as any).JU;
    const d = J.actions.createDoc('R29-CLOSEBK ' + Date.now());
    J.actions.setCurrentDoc(d);
    J.actions.addNode(d, undefined, { text: 'CLOSEBK-MARKER' });
    J.renderMain();
  });

  /* 把备份目录设成「只有文件夹名的相对路径」——正是选择器兜底会产生的那种值 */
  const setRes: any = await page.evaluate(() => {
    const J: any = (window as any).JU;
    if (J && J.ui) { J.ui.backupDir = '我的备份'; J.ui.backupDirWritable = false; J.ui.autoBackupOnClose = true; return 'ui'; }
    try {
      const raw = localStorage.getItem('juju.ui.v31');
      const o = raw ? JSON.parse(raw) : {};
      o.backupDir = '我的备份'; o.backupDirWritable = false; o.autoBackupOnClose = true;
      localStorage.setItem('juju.ui.v31', JSON.stringify(o));
      return 'localStorage';
    } catch (e) { return 'failed'; }
  });
  expect(setRes, '必须能设置 backupDir（ui 或 localStorage）').not.toBe('failed');

  /* 触发关闭流程 */
  await page.evaluate(async () => {
    const h = (window as any).__juClose;
    if (h) await h({ preventDefault() {} });
  });
  /* 不用固定等待：轮询 save_backup 调用出现（门禁只拦新增的固定 sleep，此处用 poll） */
  await expect.poll(
    async () => page.evaluate(() => ((window as any).__juCalls || []).filter((c: any) => c.cmd === 'save_backup').length),
    { timeout: 8000 },
  ).toBeGreaterThan(0);

  const calls: any[] = await page.evaluate(() => (window as any).__juCalls || []);
  const backups = calls.filter((c) => c.cmd === 'save_backup');
  expect(backups.length, '路径不可写时仍必须发起 save_backup（旧实现整份丢弃）').toBeGreaterThan(0);
  const payload = backups[backups.length - 1].args || {};
  expect(payload.path, '路径不可用时 path 应为空 → Rust 写默认 backups/').toBe('');
  expect(String(payload.content || '').length, '备份内容不得为空').toBeGreaterThan(0);
  expect(String(payload.content), '备份内容应包含刚才的节点文本').toContain('CLOSEBK-MARKER');
});
