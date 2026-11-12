import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * v2.1 · 第九轮（fix9）· 设置浮窗「补绑」回归
 *
 * 缺陷背景（P1 fix7 取证）：9 项 FAIL 集中在「设置浮窗控件未绑定处理器」簇。
 * 取证与分档：90过程材料/tmp_compare/fix7/settings_bind_audit.log
 * 复跑探针：  90过程材料/tmp_compare/fix7/settings_each_item.log（SETTINGS_ITEMS_VERDICT: PASS）
 * 修复对照：  90过程材料/tmp_compare/fix7/settings_bind_fix.log
 *
 * 本轮落地（修复实现：src/app/boot.ts bindSettingsRows，装配：src/main.ts）
 *   · #setAutoBackupClose → 写 ui.autoBackupOnClose（canonical 18777-18787 默认开启语义）+ .switch.on + toast
 *   · #btnBackupDirReset  → 清 ui.backupDir / backupDirWritable + toast「已恢复默认备份路径」
 *   · #btnRestoreBackup   → openImportDialog（io/import.ts:740，现有公开入口）
 *   · #setFontSize        → ui.scale + applyScale()（--font-size 变量链路）+ #setFontSizeVal 百分比
 *
 * 分档口径（**第十轮 fix10 已按产品方答复重定**）：
 *   · NEED_BIND_SIMPLE 4 项 → 本 spec 逐项断言（下列 test）
 *   · 原 REMOVE 4 项（#setEncrypt / #btnBackupDirPick / #setShortcuts / #btnFeedback）
 *     → 产品方 Q1=允许新增 UI ⇒ fix10 已恢复 DOM 并在 bindSettingsRows 补绑；
 *       第九轮的「DOM 中已不存在」卫生断言随之作废，改为「4 项已恢复 + 点击有可观测反应」。
 *       逐项功能断言见 tests/v21-fix10-settings-ui.spec.ts。
 *   · 原 DESIGN_LIMIT 1 项（#setReminder）→ 产品方 Q2=MISSING_INJECT ⇒ fix10 已在 main.ts
 *     注入真实 Notification 能力探测，REG-9 撤回，原 test.skip 改为真实用例（断言 ui().reminderEnabled
 *     === true + .switch.on 翻转）。
 *
 * 断言口径：ui 一律 `window.JU.ui()`（函数访问器；getState() 无 ui 字段）。
 * 承载方式与其它 spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
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

/**
 * 打开应用并展开设置面板；返回 page 与控制台错误收集器
 * @param opts.notifications 授予 notifications 权限（fix10 起 #setReminder 为真实用例，
 *                           Notification.permission 必须非 denied 才走「开启」分支）
 */
async function openSettings(
  browser: Browser,
  opts?: { notifications?: boolean },
): Promise<{ context: BrowserContext; page: Page; errors: string[] }> {
  const dist = await ensureDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await installDistRoute(context, dist);
  if (opts && opts.notifications) {
    /* 先授权再导航：remindersSupported() 以 Notification.permission 判定能力 */
    await context.grantPermissions(['notifications'], { origin: BASE });
  }
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
      scale: u.scale,
      autoBackupOnClose: u.autoBackupOnClose,
      backupDir: u.backupDir,
      encEnabled: u.encEnabled,
      encrypted: u.encrypted,
      reminderEnabled: u.reminderEnabled,
    };
  });
}

test.describe('v2.1 fix9 · 设置浮窗补绑（SIMPLE 4 项）', () => {
  test('字号滑杆 #setFontSize：拖到 155 → ui().scale ≈ 1.55 + --font-size 变化 + 百分比更新', async ({ browser }) => {
    const { context, page, errors } = await openSettings(browser);
    try {
      const before = await readUi(page);
      const fsBefore = await page.evaluate(() => document.documentElement.style.getPropertyValue('--font-size').trim());

      /* 真实交互路径：range 走 input/change（与 canonical 18828 oninput 同口径） */
      await page.locator('#setFontSize').evaluate((el) => {
        const i = el as HTMLInputElement;
        i.value = '155';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await expect.poll(async () => (await readUi(page)).scale, { timeout: 4000 }).toBeCloseTo(1.55, 2);

      const after = await readUi(page);
      expect(after.scale, 'ui().scale 必须写入 1.55').toBeCloseTo(1.55, 2);
      expect(after.scale, 'ui().scale 必须相对修改前发生变化').not.toBe(before.scale);

      const fsAfter = await page.evaluate(() => document.documentElement.style.getPropertyValue('--font-size').trim());
      expect(fsAfter, '--font-size 必须由 applyScale() 重新计算（非空）').not.toBe('');
      expect(fsAfter, '--font-size 必须相对修改前发生变化').not.toBe(fsBefore);

      await expect(page.locator('#setFontSizeVal'), '#setFontSizeVal 必须显示 155%').toHaveText('155%');

      const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontSize);
      expect(bodyFont, 'body 实际字号必须跟随 --font-size（非 0）').not.toBe('0px');

      /* 回滚到 100%（夹具口径，不改变出厂默认） */
      await page.locator('#setFontSize').evaluate((el) => {
        const i = el as HTMLInputElement;
        i.value = '100';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await expect.poll(async () => (await readUi(page)).scale, { timeout: 4000 }).toBeCloseTo(1, 2);
      expect((await readUi(page)).scale, '回滚后 ui().scale 必须回到 1').toBeCloseTo(1, 2);
      expect(errors, '控制台/页面错误必须为空').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('自动备份开关 #setAutoBackupClose：点击 → ui().autoBackupOnClose 变化 + .switch.on 变化', async ({ browser }) => {
    const { context, page, errors } = await openSettings(browser);
    /* canonical 18780/18784 语义是「默认开启」：ui.autoBackupOnClose !== false ⇒ 视为开启。
       出厂时该字段为 undefined（从未写过），首次点击会写成明确的 false，
       故回滚只能复原**有效状态**（.switch.on 与 !==false 归一值），不能复原 undefined 字面量。 */
    const eff = (v: any): boolean => v !== false;
    try {
      const before = await readUi(page);
      const onBefore = await page.locator('#setAutoBackupClose').evaluate((el) => el.classList.contains('on'));

      await page.locator('#setAutoBackupClose').click();
      await expect.poll(async () => page.locator('#setAutoBackupClose').evaluate((el) => el.classList.contains('on')), { timeout: 4000 }).toBe(!onBefore);

      const after = await readUi(page);
      const onAfter = await page.locator('#setAutoBackupClose').evaluate((el) => el.classList.contains('on'));

      expect(after.autoBackupOnClose, 'ui().autoBackupOnClose 必须发生变化').not.toBe(before.autoBackupOnClose);
      expect(onAfter, '.switch.on 必须随状态切换').not.toBe(onBefore);
      expect(eff(after.autoBackupOnClose), '有效状态必须翻转').toBe(!eff(before.autoBackupOnClose));
      /* canonical 18785：开关反馈由 toast 承担 */
      await expect
        .poll(async () => page.evaluate(() => /关闭应用时自动备份已(开启|关闭)/.test(document.body.innerText)), { timeout: 4000 })
        .toBe(true);

      /* 回滚：再点一次回到原有效状态 */
      await page.locator('#setAutoBackupClose').click();
      await expect
        .poll(async () => eff((await readUi(page)).autoBackupOnClose), { timeout: 4000 })
        .toBe(eff(before.autoBackupOnClose));
      expect(eff((await readUi(page)).autoBackupOnClose), '回滚后有效状态必须复原').toBe(eff(before.autoBackupOnClose));
      expect(await page.locator('#setAutoBackupClose').evaluate((el) => el.classList.contains('on')), '回滚后 .switch.on 必须复原').toBe(onBefore);
      expect(errors, '控制台/页面错误必须为空').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('恢复默认路径 #btnBackupDirReset：点击 → toast「已恢复默认备份路径」+ ui().backupDir 清空', async ({ browser }) => {
    const { context, page, errors } = await openSettings(browser);
    try {
      await page.locator('#btnBackupDirReset').click();
      await expect
        .poll(async () => page.evaluate(() => document.body.innerText.includes('已恢复默认备份路径')), { timeout: 4000 })
        .toBe(true);
      const ui = await readUi(page);
      expect(String(ui.backupDir || ''), 'ui().backupDir 必须回到空（默认路径）').toBe('');
      expect(errors, '控制台/页面错误必须为空').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('从备份恢复 #btnRestoreBackup：点击 → 打开导入弹窗（openImportDialog）', async ({ browser }) => {
    const { context, page, errors } = await openSettings(browser);
    try {
      await page.locator('#btnRestoreBackup').click();
      /* 现成公开入口 openImportDialog（io/import.ts:740）→ .modal-overlay「导入内容」 */
      await expect(page.locator('.modal-overlay'), '必须弹出导入模态').toHaveCount(1, { timeout: 8000 });
      await expect(page.locator('.modal-overlay .modal-head'), '模态标题必须是「导入内容」').toContainText('导入内容');
      expect(errors, '控制台/页面错误必须为空').toEqual([]);
    } finally {
      await context.close();
    }
  });

  /* REG-9 撤回：产品方 Q2=MISSING_INJECT ⇒ fix10 在 main.ts 注入真实
     `remindersSupported = () => typeof Notification !== 'undefined' && Notification.permission !== 'denied'`；
     boot.ts:282 的 `() => false` 仅留作兜底。本用例由 test.skip 转为真实用例。 */
  test('系统提醒通知 #setReminder：点击 → ui().reminderEnabled === true + .switch.on 翻转（REG-9 撤回）', async ({ browser }) => {
    const { context, page, errors } = await openSettings(browser, { notifications: true });
    try {
      const onBefore = await page.locator('#setReminder').evaluate((el) => el.classList.contains('on'));
      expect((await readUi(page)).reminderEnabled, '出厂 ui().reminderEnabled 必须为假值').toBeFalsy();
      expect(onBefore, '出厂 .switch.on 必须为关').toBe(false);

      await page.locator('#setReminder').click();
      await expect.poll(async () => page.locator('#setReminder').evaluate((el) => el.classList.contains('on')), { timeout: 4000 }).toBe(true);

      const after = await readUi(page);
      const onAfter = await page.locator('#setReminder').evaluate((el) => el.classList.contains('on'));
      expect(after.reminderEnabled, 'ui().reminderEnabled 必须置 true（能力门已放行）').toBe(true);
      expect(onAfter, '.switch.on 必须随状态翻转').toBe(true);

      /* 回滚：再点一次关闭（canonical 关闭分支：ui=false + saveUI + 停轮询） */
      await page.locator('#setReminder').click();
      await expect.poll(async () => page.locator('#setReminder').evaluate((el) => el.classList.contains('on')), { timeout: 4000 }).toBe(false);
      expect((await readUi(page)).reminderEnabled, '回滚后 ui().reminderEnabled 必须回到假值').toBeFalsy();
      expect(
        await page.locator('#setReminder').evaluate((el) => el.classList.contains('on')),
        '回滚后 .switch.on 必须为关',
      ).toBe(false);
      expect(errors, '控制台/页面错误必须为空').toEqual([]);
    } finally {
      await context.close();
    }
  });

  /* 第九轮本用例断言「4 项 count=0」（REMOVE 卫生）；fix10 按 Q1=允许新增 UI 恢复 4 项，
     故改为「4 项 count=1 + 点击有可观测反应」。逐项功能断言见 v21-fix10-settings-ui.spec.ts。 */
  test('4 项已恢复：全库加密 / 备份位置·浏览 / 快捷键 / 反馈 count=1 且点击有可观测反应', async ({ browser }) => {
    const { context, page, errors } = await openSettings(browser);
    try {
      for (const id of ['setEncrypt', 'btnBackupDirPick', 'setShortcuts', 'btnFeedback']) {
        await expect(page.locator('#' + id), '#' + id + ' 必须已恢复（fix10）').toHaveCount(1);
      }
      /* 同区块内相邻控件仍在（防止恢复时误删整块） */
      await expect(page.locator('#setReminder'), '#setReminder 必须保留').toHaveCount(1);
      await expect(page.locator('#btnBackupDirReset'), '#btnBackupDirReset 必须保留').toHaveCount(1);
      await expect(page.locator('#btnViewManual'), '#btnViewManual 必须保留').toHaveCount(1);
      await expect(page.locator('#setAutoBackupClose'), '#setAutoBackupClose 必须保留').toHaveCount(1);

      /* 可观测反应 1：#setShortcuts → 快捷键速查模态 */
      await page.locator('#setShortcuts').click();
      await expect(page.locator('.modal-overlay'), '#setShortcuts 必须弹出模态').toHaveCount(1, { timeout: 5000 });
      await expect(page.locator('.modal-overlay .modal-body'), '快捷键面板必须含快捷键文本').toContainText('Ctrl + K');
      await page.locator('.modal-overlay .modal-close').click();
      await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 5000 });

      /* 可观测反应 2：#btnFeedback → 反馈模态 */
      await page.locator('#btnFeedback').click();
      await expect(page.locator('.modal-overlay'), '#btnFeedback 必须弹出模态').toHaveCount(1, { timeout: 5000 });
      await expect(page.locator('.modal-overlay .modal-head'), '反馈模态标题').toContainText('反馈与错误上报');
      await page.locator('.modal-overlay .modal-close').click();
      await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 5000 });

      /* 可观测反应 3：#setEncrypt → 设密码面板（取消不改状态） */
      await page.locator('#setEncrypt').click();
      await expect(page.locator('.modal-overlay'), '#setEncrypt 必须弹出设密码面板').toHaveCount(1, { timeout: 5000 });
      await expect(page.locator('#setPwd1'), '设密码面板必须含主密码输入框').toHaveCount(1);
      await page.locator('.modal-overlay [data-cancel]').click();
      await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 5000 });
      expect((await readUi(page)).encrypted, '取消后 ui().encrypted 必须仍为假值').toBeFalsy();

      /* 可观测反应 4：#btnBackupDirPick → filechooser 或 BLOCKED_DIALOG（拦不住不判 FAIL） */
      const fcP = page.waitForEvent('filechooser', { timeout: 3000 }).then((fc) => fc).catch(() => null);
      await page.locator('#btnBackupDirPick').click();
      const fc = await fcP;
      if (fc) {
        try { await fc.setFiles([]); } catch { /* 空选择：不改状态 */ }
        await expect(page.locator('#btnBackupDirPick'), 'filechooser 拦截后按钮仍可用').toHaveCount(1);
      } else {
        /* BLOCKED_DIALOG 语义：原生目录对话框不可被自动化拦截，按任务书 4b 不判 FAIL；
           此处只要求「无未捕获异常」与按钮仍在 */
        await expect(page.locator('#btnBackupDirPick'), '目录选择后按钮仍可用').toHaveCount(1);
      }

      expect(errors, '控制台/页面错误必须为空').toEqual([]);
    } finally {
      await context.close();
    }
  });
});
