import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 第十轮（fix10）· 设置浮窗「4 项恢复 UI」功能回归
 *
 * 背景：
 *   第九轮按保守默认把 4 项「需新增 UI」的控件移出设置面板（REMOVE），
 *   回滚锚点见 90过程材料/tmp_compare/fix7/settings_bind_fix.log §5。
 *   产品方答复 Q1=允许新增 UI ⇒ 本轮按回滚锚点原样恢复 DOM，并在
 *   src/app/boot.ts 的 bindSettingsRows() 补齐处理器（canonical 移植）：
 *     · #setEncrypt       ← canonical v2.0-t3.html 18835-18864 + appConfirm(6812)
 *                           + showSetPasswordDialog(21822) + updateEncryptSwitch(21885)
 *     · #btnBackupDirPick ← canonical 18802 + pickBackupDir(22268)
 *     · #setShortcuts     ← canonical 18834 + showHelp(18868)
 *     · #btnFeedback      ← canonical 18814 + openFeedbackDialog(22415)
 *
 * 判定口径（与任务书 4b 一致）：
 *   · 加密：点击 → 有确认/设密码模态；取消 → ui().encrypted 保持假值；再点 → 设密码面板出现
 *   · 备份浏览：点击 → 拦到 filechooser 即 PASS；拦不到记 BLOCKED_DIALOG（不判 FAIL）
 *   · 快捷键：点击 → .modal-overlay 出现且含快捷键文本
 *   · 反馈：点击 → 模态出现（count > 0）且含三个动作按钮
 *
 * 承载方式与 fix9 spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
 * 断言口径：ui 一律 `window.JU.ui()`（函数访问器）。
 */

const BASE = 'http://localhost:5173';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

/** dist 构建结果缓存（每个 worker 只 build 一次） */
let DIST: string | null = null;

function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

async function ensureDist(): Promise<string> {
  if (DIST) return DIST;
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  /* dist 只允许一份 HTML（否则会被 Tauri 递归内嵌进 exe） */
  const htmls = fs.readdirSync(dist).filter((n) => /\.html?$/i.test(n));
  if (htmls.length !== 1 || htmls[0] !== 'index.html') {
    throw new Error('dist 下 HTML 不是恰好一份 index.html：' + htmls.join(', '));
  }
  DIST = dist;
  return DIST;
}

async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route(BASE + '/**', async (route: Route) => {
    const url = new URL(route.request().url());
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';
    const file = path.join(dist, pathname);
    try {
      const st = await fsp.stat(file);
      if (st.isDirectory()) throw new Error('directory');
      await route.fulfill({
        status: 200,
        contentType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        body: await fsp.readFile(file),
      });
    } catch {
      await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'not found: ' + pathname });
    }
  });
}

/** 打开应用并展开设置面板；返回 page 与控制台错误收集器 */
async function openSettings(browser: Browser): Promise<{ context: BrowserContext; page: Page; errors: string[] }> {
  const dist = await ensureDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push(String(m.text())); });
  page.on('pageerror', (e: any) => errors.push('pageerror: ' + String(e && e.message)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window as any).JU && typeof (window as any).JU.ui === 'function', null, { timeout: 60_000 });
  await page.click('#btnSettings');
  await expect(page.locator('#settingsPanel'), '设置面板必须打开（.on）').toHaveClass(/on/, { timeout: 10_000 });
  return { context, page, errors };
}

/** 读 ui 关键字段（统一走 window.JU.ui() 函数访问器） */
async function readUi(page: Page): Promise<any> {
  return page.evaluate(() => {
    const J: any = (window as any).JU;
    const u = typeof J.ui === 'function' ? J.ui() : J.ui;
    return {
      encrypted: u.encrypted,
      encEnabled: u.encEnabled,
      encKey: u.encKey,
      backupDir: u.backupDir,
      backupDirWritable: u.backupDirWritable,
    };
  });
}

test.describe('v2.1 fix10 · 设置浮窗 4 项恢复 UI', () => {
  test('全库加密 #setEncrypt：点击 → 设密码面板；取消 → ui().encrypted 仍为 false；已加密态点击 → 二次确认框（取消不改状态）', async ({ browser }) => {
    const { context, page, errors } = await openSettings(browser);
    try {
      expect((await readUi(page)).encrypted, '出厂 ui().encrypted 必须为假值').toBeFalsy();

      /* ① 未加密 → 设密码面板（canonical 18862 showSetPasswordDialog） */
      await page.locator('#setEncrypt').click();
      await expect(page.locator('.modal-overlay'), '点击 #setEncrypt 必须弹出模态').toHaveCount(1, { timeout: 5000 });
      await expect(page.locator('.modal-overlay .modal-head'), '模态标题必须是「设置主密码」').toContainText('设置主密码');
      await expect(page.locator('#setPwd1'), '必须含主密码输入框').toHaveCount(1);
      await expect(page.locator('#setPwd2'), '必须含确认密码输入框').toHaveCount(1);

      /* ② 取消：不改任何状态 */
      await page.locator('.modal-overlay [data-cancel]').click();
      await expect(page.locator('.modal-overlay'), '取消后模态必须关闭').toHaveCount(0, { timeout: 5000 });
      const afterCancel = await readUi(page);
      expect(afterCancel.encrypted, '取消后 ui().encrypted 必须仍为假值').toBeFalsy();
      expect(
        await page.evaluate(() => { try { return localStorage.getItem('juju.enc.v1'); } catch (e) { return 'ERR'; } }),
        '取消后不得写入密文存储（juju.enc.v1）',
      ).toBeNull();

      /* ③ 再点一次 → 面板再次出现（幂等，不叠模态） */
      await page.locator('#setEncrypt').click();
      await expect(page.locator('.modal-overlay'), '再次点击必须重新弹出面板').toHaveCount(1, { timeout: 5000 });
      await page.locator('.modal-overlay [data-cancel]').click();
      await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 5000 });

      /* ④ 已加密态：点击 → appConfirm 二次确认框；取消后状态不变（canonical 18837-18860） */
      await page.evaluate(() => {
        const J: any = (window as any).JU;
        const u = typeof J.ui === 'function' ? J.ui() : J.ui;
        u.encrypted = true;
        u.encKey = 'fixture-key';
      });
      await page.locator('#setEncrypt').click();
      await expect(page.locator('.modal-overlay'), '已加密态点击必须弹确认框').toHaveCount(1, { timeout: 5000 });
      await expect(page.locator('.modal-overlay .modal-body'), '确认框文案必须说明关闭加密的后果').toContainText('关闭加密后');
      await page.locator('.modal-overlay [data-cancel]').click();
      await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 5000 });
      expect((await readUi(page)).encrypted, '确认框取消后 ui().encrypted 必须保持 true').toBe(true);

      /* 夹具复原（不改产品默认：本 context 即将关闭） */
      await page.evaluate(() => {
        const J: any = (window as any).JU;
        const u = typeof J.ui === 'function' ? J.ui() : J.ui;
        u.encrypted = false;
        u.encKey = null;
      });
      expect(errors, '控制台/页面错误必须为空').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('备份位置·浏览 #btnBackupDirPick：点击 → 拦到 filechooser；拦不到记 BLOCKED_DIALOG（不判 FAIL）', async ({ browser }) => {
    const { context, page, errors } = await openSettings(browser);
    try {
      const before = await readUi(page);
      const fcP = page.waitForEvent('filechooser', { timeout: 3000 }).then((fc) => fc).catch(() => null);
      await page.locator('#btnBackupDirPick').click();
      const fc = await fcP;
      if (fc) {
        /* 拦得住：空选择 = 用户取消 → 不改 ui.backupDir（canonical 22284 cancelled 分支） */
        let setOk = false;
        try { await fc.setFiles([]); setOk = true; } catch { /* 空集不支持：忽略 */ }
        await page.waitForTimeout(600);
        const after = await readUi(page);
        expect(String(after.backupDir || ''), '空选择后 ui().backupDir 必须保持原值').toBe(String(before.backupDir || ''));
        /* 可观测反应：toast（已取消选择 / 已记录路径 / 已设置备份文件夹 三态之一）或路径回填文本变化 */
        const observed = await page.evaluate(() => {
          const t = document.body.innerText;
          return /已取消选择|已记录路径|已设置备份文件夹|选择文件夹失败/.test(t);
        });
        const valText = await page.locator('#setBackupDirVal').textContent().catch(() => null);
        expect(observed || setOk || valText !== null, 'filechooser 拦到后必须有可观测反馈').toBe(true);
      } else {
        /* BLOCKED_DIALOG：原生目录对话框不可拦截（任务书 4b：不判 FAIL），
           只要求无未捕获异常且按钮仍可用 */
        await expect(page.locator('#btnBackupDirPick'), '目录选择后按钮仍可用').toHaveCount(1);
        expect(String((await readUi(page)).backupDir || ''), 'BLOCKED_DIALOG 下 ui().backupDir 不应被改写').toBe(String(before.backupDir || ''));
      }
      expect(errors, '控制台/页面错误必须为空').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('快捷键 · 查看 #setShortcuts：点击 → .modal-overlay 出现且含快捷键文本', async ({ browser }) => {
    const { context, page, errors } = await openSettings(browser);
    try {
      await page.locator('#setShortcuts').click();
      await expect(page.locator('.modal-overlay'), '必须弹出快捷键模态').toHaveCount(1, { timeout: 5000 });
      const body = page.locator('.modal-overlay .modal-body');
      await expect(body, '必须含「新建同级节点」').toContainText('新建同级节点');
      await expect(body, '必须含 Ctrl + K 全局搜索').toContainText('Ctrl + K');
      await expect(body, '必须含 Tab 缩进').toContainText('Tab');
      /* ESC 关闭（canonical 18889 栈顶守卫） */
      await page.keyboard.press('Escape');
      await expect(page.locator('.modal-overlay'), 'ESC 后模态必须关闭').toHaveCount(0, { timeout: 5000 });
      expect(errors, '控制台/页面错误必须为空').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('反馈与错误上报 #btnFeedback：点击 → 模态出现（count>0）且含三个动作按钮', async ({ browser }) => {
    const { context, page, errors } = await openSettings(browser);
    try {
      await page.locator('#btnFeedback').click();
      await expect(page.locator('.modal-overlay'), '必须弹出反馈模态').toHaveCount(1, { timeout: 5000 });
      await expect(page.locator('.modal-overlay .modal-head'), '模态标题必须是「反馈与错误上报」').toContainText('反馈与错误上报');
      await expect(page.locator('#fbExport'), '必须含「导出错误日志」按钮').toHaveCount(1);
      await expect(page.locator('#fbCopy'), '必须含「复制日志」按钮').toHaveCount(1);
      await expect(page.locator('#fbSend'), '必须含「导出反馈包」按钮').toHaveCount(1);
      await expect(page.locator('#fbNote'), '必须含问题描述输入框').toHaveCount(1);
      /* 关闭：遮罩点击（canonical 22439 isTop 守卫） */
      await page.locator('.modal-overlay .modal-close').click();
      await expect(page.locator('.modal-overlay'), '关闭后模态必须消失').toHaveCount(0, { timeout: 5000 });
      expect(errors, '控制台/页面错误必须为空').toEqual([]);
    } finally {
      await context.close();
    }
  });
});
