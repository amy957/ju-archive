import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * v2.1 · fix26-p4 · 侧栏重命名（文档 / 文件夹 / 表格）后行标题必须立即更新
 * 真实路径：右键 #sidebarLeft 行 → 上下文菜单「重命名」→ 模态输入 → Enter（全程不刷新页面）。
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:5173';
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

test('fix26-p4 · 侧栏重命名后 .sb-label 立即变为新名称', async ({ browser }) => {
  test.setTimeout(300_000);
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--logLevel', 'silent'], { cwd: ROOT, stdio: 'pipe' });
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  await ctx.route(BASE + '/**', async (r) => {
    const p = new URL(r.request().url()).pathname;
    const f = path.join(ROOT, 'dist', p === '/' ? 'index.html' : decodeURIComponent(p));
    try { return r.fulfill({ status: 200, contentType: MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', body: await fsp.readFile(f) }); }
    catch { return r.fulfill({ status: 404, body: 'not found' }); }
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => { const w = window as any; return !!(w.JU && w.JU.actions && typeof w.JU.actions.createDoc === 'function'); }, null, { timeout: 60_000 });
  const ids = await page.evaluate(() => {
    const J: any = (window as any).JU;
    const doc = J.actions.createDoc('p4 旧文档');
    const folder = J.actions.createDoc('p4 旧文件夹', { _isFolder: true });
    let dbRoot: any = null;
    for (const k in J.state().nodes) { if (J.state().nodes[k]._isDbRoot) { dbRoot = k; break; } }
    if (!dbRoot) dbRoot = J.actions.createDoc('数据库', { _isDbRoot: true, _isFolder: true, dbRoot: true });
    const table = J.actions.addNode(dbRoot, null, { text: 'p4 旧表格', dbRoot: true });
    return { doc, folder, table };
  });
  /* 展开「我的文档」「数据库」两组（走真实导航点击，等价用户操作） */
  await page.locator('.sb-nav-item[data-nav="files"]').first().click();
  await page.locator('.sb-nav-item[data-nav="database"]').first().click();
  await page.waitForTimeout(800);
  const rename = async (id: string, next: string) => {
    const row = page.locator(`#sidebarLeft .sb-row[data-id="${id}"]`).first();
    await row.click({ button: 'right' });
    await page.locator('#ctxMenu.on .ctx-item', { hasText: '重命名' }).first().click();
    const inp = page.locator('.modal-overlay .modal input').first();
    await inp.fill(next);
    await inp.press('Enter');
    await page.waitForTimeout(250);
    return ((await row.locator('.sb-label').first().textContent()) || '').trim();
  };
  expect(await rename(ids.doc, 'p4 新文档'), '文档重命名后侧栏文字必须立即更新').toBe('p4 新文档');
  expect(await rename(ids.folder, 'p4 新文件夹'), '文件夹重命名后侧栏文字必须立即更新').toBe('p4 新文件夹');
  expect(await rename(ids.table, 'p4 新表格'), '表格重命名后侧栏文字必须立即更新').toBe('p4 新表格');
  await ctx.close();
});
