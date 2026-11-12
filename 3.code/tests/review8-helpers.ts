import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { build } from 'vite';
export async function prepare(c: any): Promise<void> {
  const root = path.dirname(test.info().config.rootDir);
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  await c.route('http://localhost:5173/**', async (r: any) => { const u = new URL(r.request().url()).pathname; const f = path.join(dist, u === '/' ? 'index.html' : decodeURIComponent(u)); try { await r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream' }); } catch { await r.fulfill({ status: 404, body: '' }); } });
}
export async function skeleton(c: any): Promise<void> {
  await c.addInitScript(() => { const m = (): void => { if (document.getElementById('r8')) return; const h = document.body || document.documentElement; if (!h) return; const w = document.createElement('div'); w.id = 'r8'; w.innerHTML = '<button id="btnClose"></button><main id="content"></main><aside id="sidebarLeft"></aside><aside id="sidebarRight"></aside><button id="btnToggleLeft"></button><button id="btnToggleRight"></button><div id="toast"></div>'; h.appendChild(w); }; m(); document.addEventListener('readystatechange', m); });
}
export async function ready(p: any): Promise<void> {
  await p.waitForFunction(() => { const J = (window as any).JU; return !!(J && J.getState && J.actions); }, null, { timeout: 30000 });
}
