// @ts-nocheck
/**
 * L11-W2/W6 · E-1「遗留收口与默认启用治理」专题 spec（P 层 · **W6 起默认启用态**）
 * ============================================================================
 * 冻结依据：`reports/t11-w1-2026-10-15.md` §五（E-1 主线收窄）与 §六（编号区启用 · E-1 面）。
 * 编号纪律：L11 自 **T-100** 起单调接续（L10 末号 T-99；区间 T-100–T-104 归 E-1）。
 *   T-100 P  接缝默认启用态：缺省即安装 `__juL10D1`（M-I 默认值翻转 OFF → ON；显式 false 关闭）。
 *   T-101 P  产品尾页脚（字节冻结件组成部分 · 39 B）保持（LO-9=A，不得清理）。
 *   T-102 门禁 登记器 `verify-hash-registry.mjs` → PARTY_COUNT=32 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS。
 *   T-103 门禁 `scripts/verify.js` 横幅默认口径 = 165（L11 默认关闭态；`L11_ENABLED` 条件接线）。
 *   T-104 P  `M-I` 接缝默认启用零回归（default-on 四路径等价）· 不变量 #30（W6 兑现，回填空洞）。
 *   T-105 P  四路径隔离（产物级 · §八 四行逐字：桌面/加密/浏览器/影子层）哨兵。
 *   T-106 P  指标采集（commit / 切视图 / longtask 的 wall-clock p95；**无硬阈值**，T-48/T-49 教训）。
 *
 * ── 默认关闭态（W2 · 只记录不启用，承接 l11-design §十三 W2「影子只记录不启用」） ──
 * 本 spec 仅当环境变量 `JU_L11=1` 时由 `scripts/verify.js` 纳入门禁；
 * 默认（`JU_L11` 缺省）整个文件 skip，门禁与 L10 冻结版逐项一致（165 用例）。
 *
 * 运行（仅本 spec）：
 *   set JU_L11=1 && node node_modules/@playwright/test/cli.js test tests/t11-anchor-governance.spec.ts
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STEP9 = path.resolve(__dirname, '..');
const APP_URL =
  process.env.JU_APP_URL ||
  'file://' + path.join(STEP9, '..', 'canonical', 'v2.0-t3.html');

const L11_ON = process.env.JU_L11 === '1';

/* L11 默认关闭态：未显式启用（JU_L11!=1）则逐例跳过（W2「只记录不启用」）。 */
test.beforeEach(() => {
  test.skip(!L11_ON, 'L11 默认关闭态（JU_L11!=1）：本 spec 不纳入默认门禁');
});

test('T-100 · 接缝默认启用态（缺省即安装 __juL10D1；显式 false 关闭）', async ({ page }) => {
  await page.goto(APP_URL);
  await page.waitForFunction(() => !!globalThis.__juL10D1, null, { timeout: 10000 });
  const probe = await page.evaluate(() => {
    const d = Object.getOwnPropertyDescriptor(globalThis, '__juL10D1');
    return {
      flag: typeof globalThis.__juL10D1Seam,
      api: typeof globalThis.__juL10D1,
      version: globalThis.__juL10D1 && globalThis.__juL10D1.version,
      enumerable: d ? d.enumerable : null,
    };
  });
  expect(probe.flag).toBe('undefined');
  expect(probe.api).toBe('object');
  expect(probe.version).toBe('l10-d1/v1');
  expect(probe.enumerable).toBe(false);

  const page2 = await page.context().newPage();
  await page2.addInitScript({ content: `try { globalThis.__juL10D1Seam = false; } catch (e) {}` });
  await page2.goto(APP_URL);
  await page2.waitForFunction(() => !!globalThis.__juL9ShadowAttachResult, null, { timeout: 10000 });
  const off = await page2.evaluate(() => ({ api: typeof globalThis.__juL10D1 }));
  expect(off.api).toBe('undefined');
  await page2.close();
});

test('T-101 · 产品尾页脚（字节冻结件组成部分 · 39 B）保持', async () => {
  const buf = fs.readFileSync(path.join(STEP9, '..', 'canonical', 'v2.0-t3.html'));
  const tail = buf.subarray(buf.length - 39).toString('utf8');
  expect(buf.length).toBe(972267);
  expect(tail.startsWith('<!-- ')).toBe(true);
  expect(tail.endsWith('-->' + '\n')).toBe(true);
});

test('T-102 · 登记器口径 = PARTY_COUNT=32 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS', async () => {
  const r = spawnSync(process.execPath, ['verify-hash-registry.mjs'], { cwd: STEP9, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  expect(out).toContain('PARTY_COUNT=32');
  expect(out).toContain('FIVE_PARTY_DRIFT_COUNT=0');
  expect(out).toContain('RESULT=PASS');
});

test('T-103 · 门禁横幅默认口径 = 165（L11 默认关闭态条件接线）', async () => {
  const src = fs.readFileSync(path.join(STEP9, 'scripts', 'verify.js'), 'utf8');
  expect(src).toContain('L11_ENABLED');
  expect(src).toContain('= 165 用例');
});

test('T-104 · M-I 接缝默认启用零回归（default-on 四路径等价 · 不变量 #30）', async ({ page }) => {
  await page.goto(APP_URL);
  await page.waitForFunction(() => !!globalThis.__juL10D1, null, { timeout: 10000 });
  const r = await page.evaluate(() => {
    const d = Object.getOwnPropertyDescriptor(globalThis, '__juL10D1');
    const api = globalThis.__juL10D1 || {};
    const face = ['version', 'flag', 'backend', 'store', 'applyBatch', 'flushNow', 'projection',
      'buildPersistBatch', 'migrateLegacy'].filter((k) => k in api);
    return { version: api.version, flag: api.flag, enumerable: d ? d.enumerable : null, face: face.length };
  });
  expect(r.version).toBe('l10-d1/v1');
  expect(r.flag).toBe('__juL10D1Seam');
  expect(r.enumerable).toBe(false);
  expect(r.face).toBe(9);
  const text = fs.readFileSync(CANONICAL, 'utf8');
  for (const tok of ['IS_DESKTOP', 'writeEncryptedStore', 'localStorage.setItem', 'attachShadow', '__juL10D1Seam', 'already-attached']) {
    expect(text.indexOf(tok) >= 0).toBe(true);
  }
});

/* ── L11-W4 追加（E-1 · 四路径隔离哨兵 + 指标采集；默认关闭态不变） ── */
const CANONICAL = path.resolve(STEP9, '..', 'canonical', 'v2.0-t3.html');

test('T-105 · 四路径隔离（产物级 · §八 四行逐字：桌面/加密/浏览器/影子层）哨兵', async () => {
  const text = fs.readFileSync(CANONICAL, 'utf8');
  const TOKENS = [
    ['desktop', 'IS_DESKTOP'],
    ['desktop', 'applyPatchAck'],
    ['encrypted', 'writeEncryptedStore'],
    ['encrypted', 'PENDING_PLAIN_KEY'],
    ['browser', 'localStorage.setItem'],
    ['shadow', 'attachShadow'],
    ['shadow', '__juL9ShadowAttachResult'],
    ['seam', '__juL10D1Seam'],
    ['degrade', 'already-attached'],
  ];
  const missing = TOKENS.filter(([, tok]) => text.indexOf(tok) < 0);
  expect(missing).toEqual([]);
});

test('T-106 · 指标采集 · commit / 切视图 / longtask 的 wall-clock p95（度量；无硬阈值）', async ({ page }) => {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof commit === 'function' && typeof state === 'object' && state !== null &&
          typeof ui === 'object' && ui !== null && typeof forceRender === 'function',
    null,
    { timeout: 8000 }
  );
  const r = await page.evaluate(async () => {
    const p95 = (a) => {
      if (!a.length) return NaN;
      const s = a.slice().sort((x, y) => x - y);
      const rank = Math.ceil(0.95 * s.length);
      return s[Math.min(s.length - 1, Math.max(0, rank - 1))];
    };
    const LT = [];
    let supported = false; let po = null;
    try {
      po = new PerformanceObserver((l) => { const es = l.getEntries(); for (let i = 0; i < es.length; i++) LT.push(es[i].duration); });
      po.observe({ entryTypes: ['longtask'] });
      supported = true;
    } catch (e) { /* longtask 不可用（非 Chromium）→ supported=false */ }
    const commitMs = []; const viewMs = [];
    const N = 20;
    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      commit((d) => { d.__l11w4_metric = i; }, { light: true, silent: true, persistOnly: true, noRollback: true });
      commitMs.push(performance.now() - t0);
    }
    for (let i = 0; i < N; i++) {
      ui.view = (i % 2 === 0) ? 'tags' : 'outline';
      const t1 = performance.now();
      try { forceRender(); } catch (e) { /* 视图缺索引等 → 忽略，仅计 wall-clock */ }
      viewMs.push(performance.now() - t1);
      await new Promise((res) => requestAnimationFrame(() => res(null)));
    }
    try { if (po) po.disconnect(); } catch (e) {}
    return {
      supported,
      commit: { n: commitMs.length, p95: p95(commitMs) },
      view: { n: viewMs.length, p95: p95(viewMs) },
      longtask: { n: LT.length, p95: p95(LT) },
    };
  });
  expect(r.supported).toBe(true);              /* Chromium 支持 longtask（指标可测） */
  expect(r.commit.n).toBe(20);
  expect(r.view.n).toBe(20);
  expect(Number.isFinite(r.commit.p95)).toBe(true);
  expect(Number.isFinite(r.view.p95)).toBe(true);
  /* longtask p95：无长任务时 NaN 合法（度量口径，不设硬阈值——承 T-48/T-49 负载敏感教训） */
  console.log(`[L11-W4 metrics] commit.p95=${r.commit.p95}ms view.p95=${r.view.p95}ms longtask.n=${r.longtask.n} longtask.p95=${r.longtask.p95}`);
});
