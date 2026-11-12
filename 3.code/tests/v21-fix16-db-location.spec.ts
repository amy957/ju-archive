import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

/**
 * v2.1 · 缺陷修复 fix16 · 数据库「地点」字段类型 + 省市级联选择器
 *
 * 缺陷（P0 取证：90过程材料/tmp/fix16/location_before.log，对 fix15 发布产物
 * sha256 819a6e54…7d89，Edge 真窗口 file://）：
 *   · 「字段类型」浮窗只有 文本/数字/日期/单选/多选/公式/关联 —— 无「地点」类型（idxLocation = -1）；
 *   · 内置「地点」列的地区浮窗只有 9 个省级单位、每省 8 个城市，**不含**台湾省 / 香港特别行政区 /
 *     澳门特别行政区；存储拼接为旧格式 `中国-北京市-东城区`（半角连字符）。
 *
 * 修复：
 *   · src/utils/regions.ts —— 新增 34 个省级行政区（含台湾省 / 香港特别行政区 / 澳门特别行政区）
 *     + 完整地级列表 + joinLocation/parseLocation（存储口径 `国家 / 省 / 市`）；
 *   · src/views/database/panels.ts —— 「地点」类型项插入「日期」之后（`{k:'location'}`），
 *     字段配置浮窗标题「地点列」；openRegionPicker 改用完整数据并按 `国家 / 省 / 市` 落值（旧连字符可解析）；
 *   · src/views/database/render.ts —— `field.type === 'location'` 的单元格分支：有值显示文本，
 *     无值显示 `div.db-cell-btn`「选择...」，点击弹出级联框，确定后经 setDbCell 持久化并重绘。
 *
 * 承载方式与 fix13/fix15 spec 一致：`vite build` 产物 + `context.route` 映射到 http://localhost:5173。
 * 全部断言均为真实交互（真实点「+ 列」→ 真实点类型项 → 真实填列名 → 真实点「确定」→ 真实选省/市），
 * 无夹具直改 state、无测试侧依赖回填。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:5173';

/** 统一存储格式（与 src/core/constants.ts 契约一致） */
const EXPECT_HK = '中国 / 香港特别行政区 / 香港岛';
const EXPECT_TW = '中国 / 台湾省 / 台北市';

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

let DIST: string | null = null;

async function ensureDist(): Promise<string> {
  if (DIST) return DIST;
  await build({ root: ROOT, logLevel: 'silent' });
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  DIST = dist;
  return DIST;
}

async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE) return route.continue();
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    const file = path.join(dist, pathname);
    try {
      const stat = await fsp.stat(file);
      if (stat.isDirectory()) throw new Error('directory');
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

async function openApp(page: Page): Promise<void> {
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => {
    const J = (window as any).JU;
    return !!(J && typeof J.getState === 'function' && typeof J.renderMain === 'function' && J.actions);
  }, null, { timeout: 60_000, polling: 25 });
  await page.waitForTimeout(400);
}

/**
 * 建「数据库根 → 表格」最小数据集并打开（真实 actions：createDoc / addNode / addDbField / addDbRow）。
 * 与 tests/db-module.spec.ts 同口径：本构建侧栏骨架不含 #subDb，故用产品对外会话端口打开。
 */
async function seedAndOpenDb(page: Page, tableName: string): Promise<{ tableId: string }> {
  const ids = await page.evaluate((nm) => {
    const J: any = (window as any).JU;
    const uiObj: any = typeof J.ui === 'function' ? J.ui() : J.ui;
    const dbRootId: any = J.actions.createDoc('数据库', { _isDbRoot: true, _isFolder: true, dbRoot: true });
    const tableId: any = J.actions.addNode(dbRootId, null, { text: nm, dbRoot: true });
    J.actions.addDbField(tableId, '标题');
    J.actions.addDbRow(tableId, { text: '行A' });
    uiObj.dbView = 'table';
    J.actions.setCurrentDoc(tableId);
    J.renderMain();
    return { tableId };
  }, tableName);
  expect(ids.tableId, '表格节点必须由真实 actions.addNode 创建').toBeTruthy();
  await expect(page.locator('.db-page'), '切到该表后必须渲染数据库页').toBeVisible({ timeout: 30_000 });
  return { tableId: ids.tableId as string };
}

/** 真实点「+ 列」→ 真实点「地点」类型项 → 真实填列名 → 真实点「确定」，返回新增列名 */
async function addLocationColumn(page: Page, name: string): Promise<void> {
  await page.locator('.db-add button', { hasText: '+ 列' }).first().click();
  const pop = page.locator('.nt-pop[data-pop="ftype"]');
  await expect(pop).toBeVisible({ timeout: 20_000 });
  await pop.locator('.nt-item').filter({ hasText: '地点' }).first().click();
  const cfg = page.locator('.nt-pop[data-pop="fcfg"]');
  await expect(cfg, '选「地点」类型后必须弹出字段配置浮窗').toBeVisible({ timeout: 20_000 });
  await cfg.locator('input.nt-input').first().fill(name);
  await cfg.locator('.nt-btn.primary').first().click();
  await expect(page.locator('.db-table th').filter({ hasText: name }), '新列必须出现在表头').toHaveCount(1, { timeout: 20_000 });
}

/** 读取某列在 state 中的落值：地点值挂在**行节点** db 上（表格节点只存列定义），故按列名扫描 state */
async function readStoredCell(page: Page, fieldName: string): Promise<any> {
  return page.evaluate((f) => {
    const s = (window as any).JU.getState() || {};
    const hit = Object.keys(s.nodes || {})
      .map((k) => s.nodes[k])
      .filter((n: any) => n && n.db && Object.prototype.hasOwnProperty.call(n.db, f));
    return hit.length ? hit[0].db[f] : null;
  }, fieldName);
}

/** 新增列固定落在最后一列：以「首行最后一个 td」定位，避免与其它列混淆 */
function locationCell(page: Page) {
  return page.locator('.db-table tr[data-msid]').first().locator('td').last()
    .locator('.db-cell-btn, .db-cell-date, .db-cell-loc').first();
}

/** 在已打开的地点级联框里按省 / 市选择并确定 */
async function pickProvinceCity(page: Page, province: string, city: string): Promise<void> {
  const picker = page.locator('.region-picker');
  await expect(picker, '点击「选择...」必须弹出地点级联框').toBeVisible({ timeout: 20_000 });
  await picker.locator('#rpProvince').selectOption(province);
  await expect(picker.locator('#rpCity option').filter({ hasText: city }), `${province} 下必须出现「${city}」`)
    .toHaveCount(1, { timeout: 10_000 });
  await picker.locator('#rpCity').selectOption(city);
  await picker.locator('#rpOk').click();
  await expect(picker).toBeHidden({ timeout: 15_000 });
}

test.describe('v2.1 fix16 · 数据库「地点」字段类型与省市级联', () => {
  let dist = '';

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    dist = await ensureDist();
  });

  test('1) 字段类型列表包含「地点」且位于「日期」之后', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    await seedAndOpenDb(page, 'fix16 类型列表验收表');

    await page.locator('.db-add button', { hasText: '+ 列' }).first().click();
    const pop = page.locator('.nt-pop[data-pop="ftype"]');
    await expect(pop).toBeVisible({ timeout: 20_000 });

    /* 读真实 DOM 文本（不读常量表）：类型项名称 = .nt-item 内首个文本行 */
    const labels = await pop.locator('.nt-item').evaluateAll((els) =>
      els.map((el) => {
        const box = el.querySelector('span[style*="flex"]');
        const first = box ? box.firstElementChild : null;
        return String(((first && first.textContent) || el.textContent || '')).trim();
      }));
    console.log('[fix16-1] 字段类型列表:', JSON.stringify(labels));

    const idxDate = labels.indexOf('日期');
    const idxLocation = labels.indexOf('地点');
    expect(idxDate, '字段类型列表必须含「日期」').toBeGreaterThanOrEqual(0);
    expect(idxLocation, '字段类型列表必须含「地点」').toBeGreaterThanOrEqual(0);
    expect(idxLocation, '「地点」必须紧跟「日期」之后').toBe(idxDate + 1);
  });

  test('2) 地点选择器支持选择「香港特别行政区」与「台湾省」并级联出对应城市', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    const { tableId } = await seedAndOpenDb(page, 'fix16 级联选择验收表');
    await addLocationColumn(page, '办公地点');

    /* 空值单元格必须是「选择...」按钮（div.db-cell-btn） */
    const cell = locationCell(page);
    await expect(cell).toHaveText(/选择\.{2,3}/, { timeout: 15_000 });
    await expect(cell).toHaveClass(/db-cell-btn/);

    await cell.click();
    const picker = page.locator('.region-picker');
    await expect(picker).toBeVisible({ timeout: 20_000 });

    /* 省级全集：34 个，且含台湾省 / 香港特别行政区 / 澳门特别行政区 */
    const provinces = await picker.locator('#rpProvince option').allTextContents();
    console.log('[fix16-2] 省级数量:', provinces.length);
    expect(provinces.length, '省级行政区必须为 34 个').toBe(34);
    expect(provinces).toContain('台湾省');
    expect(provinces).toContain('香港特别行政区');
    expect(provinces).toContain('澳门特别行政区');

    /* 香港特别行政区 → 城市含「香港岛」，选择并确定 */
    await pickProvinceCity(page, '香港特别行政区', '香港岛');
    await expect(locationCell(page), '选定后单元格必须直接显示文本').toHaveText(EXPECT_HK, { timeout: 15_000 });

    /* 台湾省 → 城市含「台北市」，选择并确定（覆盖第二次修改路径） */
    await locationCell(page).click();
    await pickProvinceCity(page, '台湾省', '台北市');
    await expect(locationCell(page)).toHaveText(EXPECT_TW, { timeout: 15_000 });

    /* 落值必须是 state 里的字符串，且格式为 "国家 / 省 / 市" */
    const stored = await readStoredCell(page, '办公地点');
    console.log('[fix16-2] state 值:', JSON.stringify(stored));
    expect(stored, '确定后必须经 setDbCell 写入 state').toBe(EXPECT_TW);
    expect(String(stored)).toMatch(/^中国 \/ .+ \/ .+$/);
  });

  test('3) 选择地点后刷新页面数据不丢失', async ({ context, page }) => {
    test.setTimeout(180_000);
    await installDistRoute(context, dist);
    await openApp(page);
    const { tableId } = await seedAndOpenDb(page, 'fix16 持久化验收表');
    await addLocationColumn(page, '办公地点');

    await locationCell(page).click();
    await pickProvinceCity(page, '香港特别行政区', '香港岛');
    await expect(locationCell(page)).toHaveText(EXPECT_HK, { timeout: 15_000 });

    /* 真实刷新（不写夹具、不注入 state） */
    await page.reload({ waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction(() => {
      const J = (window as any).JU;
      return !!(J && typeof J.getState === 'function' && typeof J.renderMain === 'function' && J.actions);
    }, null, { timeout: 60_000, polling: 25 });
    await page.waitForTimeout(800);

    const afterReload = await readStoredCell(page, '办公地点');
    console.log('[fix16-3] 刷新后 state 值:', JSON.stringify(afterReload));
    expect(afterReload, '刷新后 state 中的地点值不得丢失').toBe(EXPECT_HK);

    /* 重新打开该表，单元格文本同样不得丢失（真实 setCurrentDoc + renderMain） */
    await page.evaluate((id) => {
      const J: any = (window as any).JU;
      const uiObj: any = typeof J.ui === 'function' ? J.ui() : J.ui;
      uiObj.dbView = 'table';
      J.actions.setCurrentDoc(id);
      J.renderMain();
    }, tableId);
    await expect(page.locator('.db-table tr[data-msid]')).toHaveCount(1, { timeout: 30_000 });
    await expect(locationCell(page), '刷新并重开表后单元格仍显示原值').toHaveText(EXPECT_HK, { timeout: 15_000 });
  });
});
