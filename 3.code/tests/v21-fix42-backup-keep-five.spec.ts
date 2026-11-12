import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const BASE = 'http://localhost:5173';
test('fix42 · 自动备份仅保留最近 5 份', async ({ browser }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ju42-'));
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1200, height: 900 } });
  await ctx.route(BASE + '/**', (r) => { const p = new URL(r.request().url()).pathname; const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p)); try { return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f) }); } catch { throw new Error('dist/index.html 缺失，请先 vite build'); } });
  let seq = 0;
  await ctx.exposeFunction('__juWriteBackup', (p: string, c: string) => {
    const d = path.dirname(p); fs.mkdirSync(d, { recursive: true });
    const target = path.join(d, `JU_Backup_${String(Date.now() * 1000 + (seq++))}.json`);
    fs.writeFileSync(target, c, 'utf8');
    const names = fs.readdirSync(d).filter((n) => n.startsWith('JU_Backup_') && n.endsWith('.json')).sort().reverse();
    for (const old of names.slice(5)) fs.unlinkSync(path.join(d, old));
    return target;
  });
  await ctx.addInitScript(() => { (window as any).__TAURI__ = { core: { invoke: async (c: string, a: any) => { if (c === 'save_backup') return await (window as any).__juWriteBackup(a.path, a.content); return '{}'; } } }; });
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'load' });
  const tgt = dir + '/JU-备份-' + new Date().toISOString().slice(0, 10) + '.json';
  const written = await page.evaluate(async ({ p }) => {
    const out: string[] = [];
    for (let i = 0; i < 6; i++) out.push(String(await (window as any).__TAURI__.core.invoke('save_backup', { path: p, content: '{"type":"full-backup"}' })));
    return out;
  }, { p: tgt });
  const files = fs.readdirSync(dir).filter((f) => f.startsWith('JU_Backup_') && f.endsWith('.json'));
  expect(files.length, '6 次备份后仅保留 5 份').toBe(5);
  expect(fs.existsSync(written[0]), '最早备份应被删除').toBe(false);
  expect(fs.existsSync(written[5]), '最新备份应存在').toBe(true);
  await ctx.close();
});
