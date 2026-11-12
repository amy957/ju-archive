import { test, expect } from '@playwright/test';
import { prepare, skeleton, ready } from './review8-helpers';
test('review18-12 · save_backup 抛错后 __juLog 含脱敏 error', async ({ context, page }) => {
  test.setTimeout(240_000); await prepare(context); await skeleton(context);
  await context.addInitScript(() => { localStorage.setItem('juju.ui.v31', JSON.stringify({ autoBackupOnClose: true })); const api: any = { minimize: async () => {}, toggleMaximize: async () => {}, setAlwaysOnTop: async () => {}, hide: async () => {}, close: async () => {}, onCloseRequested: async (cb: any) => { (window as any).__closeCb = cb; } }; (window as any).__TAURI__ = { window: { getCurrent: () => api, getCurrentWindow: () => api }, core: { invoke: async (cmd: string) => { if (cmd === 'save_backup') throw new Error('backup boom "secret payload" 13800138000'); return 'ok'; } } }; });
  await page.goto('/'); await ready(page);
  await page.waitForFunction(() => !!(window as any).__closeCb, null, { timeout: 60_000 });
  await page.evaluate(async () => { await (window as any).__closeCb({ preventDefault: () => {} }); });
  const entry: any = await (await page.waitForFunction(() => ((window as any).__juLog || []).find((e: any) => e.kind === 'close-backup') || null, null, { timeout: 30_000 })).jsonValue();
  expect(typeof entry.error, 'error 必须为字符串留痕').toBe('string');
  expect(entry.error).toContain('<redacted>');
  expect(entry.error).not.toContain('secret payload');
  expect(entry.error).not.toContain('13800138000');
});
