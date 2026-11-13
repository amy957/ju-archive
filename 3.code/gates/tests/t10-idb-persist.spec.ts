// @ts-nocheck
/**
 * L10-W2 · D-1「持久层落地收口」接缝专题 spec（P 层 + 门禁断言）
 * ============================================================================
 * 冻结依据：`reports/t10-w1-2026-10-15.md` §五(b) 红证矩阵（**FROZEN，不得重编号 / 重划范围**）：
 *   T-93 N+P  红：未接线时写 8MB → `QuotaExceededError`；绿：接线后 8MB/32MB 落盘成功且投影等价
 *   T-94 N    `buildPersistBatch` 形状 / 删除优先 / 上限（纯函数）
 *   T-95 P    `l9_*` → IDB 事务 mock 等价（S-1 / S-2 三段式）
 *   T-96 P    单批事务原子性（中途 throw → 无半批，#28 延伸）
 *   T-97 P    旧库迁移幂等（逐 id 值等价）
 *   T-98 门禁 `verify.js` 计数同步（`158 + N`，LO-7）
 *   T-99 门禁 15+M 方登记 `RESULT=PASS`（哨兵 · 不变量 #29 · LO-8）
 *
 * ── 本 spec 定义并冻结的「D-1 接缝契约」（W2 接线子任务按此实现） ─────────────
 * ① 特性开关：globalThis.__juL10D1Seam —— **缺省启用**（L11-W6 · M-I 默认值翻转 OFF → ON）。
 *    显式 false 时产品必须与 L9-W6 冻结版逐字节语义一致（零行为变化）。
 * ② 接缝面：仅当开关在页面脚本执行期（安装点）为真时，产品安装
 *    globalThis.__juL10D1（Object.defineProperty 不可枚举；关闭时不得存在）：
 *      { version:'l10-d1/v1', flag:'__juL10D1Seam',
 *        backend      — 通道层：IDB 能力后端；公共面 kind / transact / saveState / rows / setFailNext / close,
 *        store        — L9 PersistStore 实例，已注入 backend（drop-in，不改支柱语义）,
 *        applyBatch(batch) → Promise<{ok, ack?, replay?}>               — 注入缝方法 1,
 *        flushNow(snapshot) → Promise<{ok}>                             — 注入缝方法 2,
 *        projection() → Map<id, json>                                   — 注入缝方法 3,
 *        buildPersistBatch(dirtyNodes, removedIds) → {reason, batches}  — 组批层（复用 L9 形状）,
 *        migrateLegacy(rawJsonOrObject) → Promise<{ok, migrated, already?, ids}> — 迁移层（幂等） }
 * ③ 降级原因字面量保持逐字：no-product / no-l9 / already-attached / install-failed / attached。
 * ④ 未开关时产品持久路径（非桌面 localStorage 全量 / 桌面 patch_nodes / 加密 writeEncryptedStore）
 *    不得发生任何变化（T-93 的 OFF 基线即为此不变量）。
 *
 * ── 红证语义（本波 = 红证先行） ───────────────────────────────────────────
 * 全部新路径断言在「`__juL10D1Seam` 接缝尚未接线」时必须**真实失败**：
 *   ON 页（`addInitScript` 置开关）→ `globalThis.__juL10D1` 不存在 → 断言红；
 *   T-98/T-99 → 门禁文件尚未同步（`verify.js` 标签仍 158；`verify-hash-registry.mjs` 仍 15 方）。
 *
 * ── 诚实适配声明（不得当作「已验证」） ───────────────────────────────────
 * · T-94：L10 组批层（`__juL10D1.buildPersistBatch`）未接线 → 红；同时断言 L9 影子层内联实现
 *   可达（`__juL9Shadow.modules.persistStore.buildPersistBatch`）并做**逐样本对拍**，避免断言空转。
 * · T-96：「中途 throw」以接缝后端公共面可得的故障注入为手段：优先 `backend.crashBeforeCommit`
 *   （S-2 崩溃钩子），否则退 `backend.setFailNext(1)`；两者都以「无半批」为断言口径，实际所用模式
 *   在探针结果中回报（`inject`），**不声称未实际执行的注入方式已被覆盖**。
 * · T-99：以 `spawnSync(process.execPath, ['verify-hash-registry.mjs'])` 执行登记器并解析其 stdout
 *   （`PARTY_COUNT` / `FIVE_PARTY_DRIFT_COUNT` / `RESULT`）；若无法执行则**显式失败**并回报
 *   `mode='spawn-failed'`（不回退为「只读文件即算通过」）。
 *
 * 运行（仅本 spec）：
 *   JU_CHROMIUM_PATH=<chrome> node node_modules/@playwright/test/cli.js test tests/t10-idb-persist.spec.ts
 * （file:// 形态 → `IS_DESKTOP===false`；`JU_APP_URL` 可覆盖被测 HTML，见 playwright.config.ts）
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

/* ── 接缝契约常量（与上文冻结契约 ①② 一致） ── */
const SEAM_FLAG = '__juL10D1Seam';
const SEAM_KEY = '__juL10D1';
const SEAM_VERSION = 'l10-d1/v1';

/* ── 门禁口径（LO-7 = A：`158 + N`；本波新增用例 N = 7 → 165；既有跳过项仅 T-48/T-49） ── */
const L10_NEW_CASES = 7;
const EXPECTED_PW_TOTAL = 158 + L10_NEW_CASES;      /* 165 */
/* LO-8 = B：登记方数扩到 `15 + M`；本波至少纳编 1 物（本 spec）→ 期望 ≥ 16 */
const EXPECTED_PARTY_MIN = 15 + 1;
const L10_SPEC_BASENAME = 't10-idb-persist.spec.ts';
const L10_SPEC_REL = 'tests/' + L10_SPEC_BASENAME;

/* ── 页面装载：显式置开关（安装点必须早于页面脚本 → addInitScript）；
      M-I（L11-W6）默认启用后，OFF 场景须显式置 false（缺省即启用） ── */
async function bootProduct(page, seamOn) {
  await page.addInitScript({
    content: `try { globalThis.${SEAM_FLAG} = ${seamOn ? 'true' : 'false'}; } catch (e) {}`,
  });
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof commit === 'function'
      && typeof runPersist === 'function'
      && typeof state === 'object' && state !== null,
    null,
    { timeout: 10_000 },
  );
  /* L9-W6 冻结影子层入口（`attachShadow(globalThis)` 的异步结果）——本 spec 以它为 L9 参考实现锚 */
  await page.waitForFunction(() => !!globalThis.__juL9ShadowAttachResult, null, { timeout: 10_000 });
}

test.describe('L10-W2 · D-1 持久层接缝（P 层 · 真实浏览器 / 门禁断言）', () => {

  /* ══════════════════════════════════════════════════════════════════════
   * T-93 · N+P · OFF 基线（8MB → QuotaExceededError）+ 接线后 8MB/32MB 落盘 + 投影等价
   * ══════════════════════════════════════════════════════════════════════ */
  test('T-93 N+P · 未接线写 8MB → QuotaExceededError；接线后 8MB/32MB 落盘成功且投影等价', async ({ page, context }) => {
    /* (a) 显式 OFF（M-I 后须显式置 false） → 产品路径与 L9-W6 冻结版一致（非桌面全量 localStorage） */
    await bootProduct(page, false);
    const off = await page.evaluate((flag) => {
      const flagDefault = !!globalThis[flag];
      const seamAbsentWhenOff = !globalThis.__juL10D1;
      const isDesktop = typeof IS_DESKTOP === 'boolean' ? IS_DESKTOP : null;
      /* 产品非桌面落盘语句即 `localStorage.setItem(STORE_KEY, json)`（逐字复用其键与写入面）；
         自 8MB 起阶梯加压：容量上限到达的那一级即报 QuotaExceededError（累积写不清理）。 */
      let quotaErrorName = null; let firstFailAtMB = null; let attemptedMB = 0;
      for (const mb of [8, 16, 32, 64]) {
        try {
          localStorage.setItem(STORE_KEY + '.l10probe', 'x'.repeat(mb * 1024 * 1024));
          attemptedMB += mb;
        } catch (e) { quotaErrorName = (e && e.name) || String(e); firstFailAtMB = mb; break; }
      }
      /* 证据清理（不污染后续用例） */
      let cleared = true;
      try {
        localStorage.removeItem(STORE_KEY + '.l10probe');
        localStorage.removeItem(STORE_KEY + '.probe');
      } catch (e) { cleared = false; }
      return { flagDefault, seamAbsentWhenOff, isDesktop, quotaErrorName, firstFailAtMB, attemptedMB, cleared };
    }, SEAM_FLAG);

    /* DEFAULT OFF 不变量（缺省必须为假；关闭时不安装接缝面） */
    expect(off.flagDefault).toBe(false);
    expect(off.seamAbsentWhenOff).toBe(true);
    /* file:// 形态 → 非桌面 → 走 localStorage 全量（L9-W6 冻结语义） */
    expect(off.isDesktop).toBe(false);
    /* 红基线（逐字对应矩阵）：未接线时 8MB 起即超配额 */
    expect(off.quotaErrorName).toBe('QuotaExceededError');
    expect(off.firstFailAtMB).not.toBeNull();
    expect(off.attemptedMB + off.firstFailAtMB).toBeGreaterThanOrEqual(8);
    expect(off.cleared).toBe(true);

    /* (b) ON：接线后 8MB / 32MB 必须经接缝落盘成功，且投影与写入输入等价（无孤儿行） */
    const page2 = await context.newPage();
    await bootProduct(page2, true);
    const on = await page2.evaluate(async (KEY) => {
      const seam = await (async () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 2000) {
          if (globalThis[KEY]) return globalThis[KEY];
          await new Promise((r) => setTimeout(r, 50));
        }
        return globalThis[KEY] || null;
      })();
      const flagSeen = !!globalThis.__juL10D1Seam;
      if (!seam) return { seamPresent: false, flagSeen };

      const MB8 = 8 * 1024 * 1024;
      const MB32 = 32 * 1024 * 1024;
      const big8 = 'x'.repeat(MB8);
      const big32 = 'y'.repeat(MB32);
      const nodeA = { id: 'a', text: 'v' };

      /* 单批写入（8MB 主验证点） */
      const r8 = await seam.applyBatch({
        changed: [{ id: 'big8', data: JSON.stringify({ id: 'big8', text: big8 }) },
                  { id: 'a', data: JSON.stringify(nodeA) }],
        deleted: [], seq: 1, baseRev: 0,
      });
      const projAfter8 = seam.projection();
      const p8 = {
        size: projAfter8.size,
        big8Len: (JSON.parse(projAfter8.get('big8') || '{}').text || '').length,
        aValue: projAfter8.get('a'),
      };

      /* 全量 checkpoint（32MB 拉伸点）→ 原子替换：big8 行必须消失（无孤儿行） */
      const r32 = await seam.flushNow({ nodes: { big32: { id: 'big32', text: big32 }, a: nodeA } });
      const projAfter32 = seam.projection();
      const p32 = {
        size: projAfter32.size,
        big32Len: (JSON.parse(projAfter32.get('big32') || '{}').text || '').length,
        aValue: projAfter32.get('a'),
        orphanAfterFlush: projAfter32.has('big8'),
      };

      return {
        seamPresent: true, flagSeen,
        version: seam.version,
        backendKind: seam.backend && seam.backend.kind,
        injectFace: ['applyBatch', 'flushNow', 'projection'].filter((k) => typeof seam[k] === 'function'),
        r8ok: !!(r8 && r8.ok === true),
        r32ok: !!(r32 && r32.ok === true),
        p8, p32, MB8, MB32,
        eqFn: typeof ((globalThis.__juL9Shadow && globalThis.__juL9Shadow.modules
          && globalThis.__juL9Shadow.modules.persistStore || {}).equalProjection) === 'function',
      };
    }, SEAM_KEY);

    expect(on.flagSeen).toBe(true);
    expect(on.seamPresent).toBe(true);                 /* ← 红：接缝未接线 → false */
    expect(on.version).toBe(SEAM_VERSION);
    expect(on.backendKind).toBe('idb');
    expect(on.injectFace).toEqual(['applyBatch', 'flushNow', 'projection']);
    expect(on.r8ok).toBe(true);
    expect(on.r32ok).toBe(true);
    expect(on.p8.size).toBe(2);
    expect(on.p8.big8Len).toBe(on.MB8);
    expect(on.p8.aValue).toBe(JSON.stringify({ id: 'a', text: 'v' }));
    expect(on.p32.size).toBe(2);
    expect(on.p32.big32Len).toBe(on.MB32);
    expect(on.p32.aValue).toBe(JSON.stringify({ id: 'a', text: 'v' }));
    expect(on.p32.orphanAfterFlush).toBe(false);       /* 原子替换：无孤儿行（#27 语义延伸） */
    expect(on.eqFn).toBe(true);                        /* 投影等价函数可达（L9 参考实现） */
  });

  /* ══════════════════════════════════════════════════════════════════════
   * T-94 · N · 组批层 `buildPersistBatch`（形状 / 删除优先 / 上限 · 纯函数）
   * ══════════════════════════════════════════════════════════════════════ */
  test('T-94 N · buildPersistBatch 形状/删除优先/上限（纯函数）', async ({ page }) => {
    await bootProduct(page, true);
    const r = await page.evaluate(async (KEY) => {
      const seam = await (async () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 2000) {
          if (globalThis[KEY]) return globalThis[KEY];
          await new Promise((r) => setTimeout(r, 50));
        }
        return globalThis[KEY] || null;
      })();
      const refMod = (globalThis.__juL9Shadow && globalThis.__juL9Shadow.modules
        && globalThis.__juL9Shadow.modules.persistStore) || null;
      const refFn = refMod && refMod.buildPersistBatch;
      const fn = (seam && seam.buildPersistBatch) || undefined;   /* 缺省 → undefined（失败信息可读） */
      const out = {
        seamPresent: !!seam,
        builderType: typeof fn,
        refReachable: typeof refFn === 'function',
      };
      if (typeof fn !== 'function') return out;      /* ← 红：接缝未接线 → builderType==='undefined' */

      /* ① 形状 + 删除优先：removed 中的 id 必须从 changed 剔除；deleted 仅随首批（LO-4） */
      const dirty = new Map([['a', { id: 'a', text: 'A' }], ['b', { id: 'b', text: 'B' }]]);
      const removed = new Set(['b', 'c']);
      const b1 = fn(dirty, removed);
      out.r1 = {
        reason: b1.reason,
        batches: b1.batches.length,
        changed: b1.batches[0] && b1.batches[0].changed,
        deleted: b1.batches[0] && b1.batches[0].deleted,
      };

      /* ② 单批上限（500）：501 changed → 2 批；deleted 仅首批 */
      const dirty2 = new Map();
      for (let i = 0; i < 501; i++) dirty2.set('n' + i, { id: 'n' + i });
      const b2 = fn(dirty2, new Set(['gone']));
      out.r2 = {
        reason: b2.reason,
        batches: b2.batches.length,
        b0: b2.batches[0] && b2.batches[0].changed.length,
        b0del: b2.batches[0] && b2.batches[0].deleted.length,
        b1: b2.batches[1] && b2.batches[1].changed.length,
        b1del: b2.batches[1] && b2.batches[1].deleted.length,
      };

      /* ③ 脏集总量上限（2000）→ 退全量 */
      const dirty3 = new Map();
      for (let i = 0; i < 2001; i++) dirty3.set('m' + i, { id: 'm' + i });
      const b3 = fn(dirty3, new Set());
      out.r3 = { reason: b3.reason, batches: b3.batches.length };

      /* ④ 空脏集 */
      const b4 = fn(new Map(), new Set());
      out.r4 = { reason: b4.reason, batches: b4.batches.length };

      /* ⑤ 与 L9 影子层内联实现逐样本对拍（conformance cross-check；避免断言空转） */
      if (typeof refFn === 'function') {
        out.parity1 = JSON.stringify(fn(dirty, removed)) === JSON.stringify(refFn(dirty, removed));
        out.parity2 = JSON.stringify(fn(dirty2, new Set(['gone']))) === JSON.stringify(refFn(dirty2, new Set(['gone'])));
        out.parity3 = JSON.stringify(fn(dirty3, new Set())) === JSON.stringify(refFn(dirty3, new Set()));
      }
      return out;
    }, SEAM_KEY);

    expect(r.refReachable).toBe(true);                 /* L9 参考实现可达（本波即已成立） */
    expect(r.builderType).toBe('function');            /* ← 红：'undefined' */
    expect(r.r1.reason).toBe(null);
    expect(r.r1.batches).toBe(1);
    expect(r.r1.changed).toEqual([{ id: 'a', data: '{"id":"a","text":"A"}' }]);   /* 删除优先：b 被剔除 */
    expect(r.r1.deleted).toEqual(['b', 'c']);
    expect(r.r2.reason).toBe(null);
    expect(r.r2.batches).toBe(2);
    expect(r.r2.b0).toBe(500);
    expect(r.r2.b0del).toBe(1);
    expect(r.r2.b1).toBe(1);
    expect(r.r2.b1del).toBe(0);                        /* deleted 仅随首批 */
    expect(r.r3.reason).toBe('over-threshold');
    expect(r.r3.batches).toBe(0);
    expect(r.r4.reason).toBe('empty');
    expect(r.r4.batches).toBe(0);
    expect(r.parity1).toBe(true);
    expect(r.parity2).toBe(true);
    expect(r.parity3).toBe(true);
  });

  /* ══════════════════════════════════════════════════════════════════════
   * T-95 · P · 通道层 `l9_*` → IDB 事务 mock 等价（S-1 真契约 / S-2 三段式）
   * ══════════════════════════════════════════════════════════════════════ */
  test('T-95 P · l9_* → IDB 事务 mock 等价（S-1/S-2 三段式）', async ({ page }) => {
    await bootProduct(page, true);
    const r = await page.evaluate(async (KEY) => {
      const seam = await (async () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 2000) {
          if (globalThis[KEY]) return globalThis[KEY];
          await new Promise((r) => setTimeout(r, 50));
        }
        return globalThis[KEY] || null;
      })();
      const adMod = (globalThis.__juL9Shadow && globalThis.__juL9Shadow.modules
        && globalThis.__juL9Shadow.modules.backendAdapters) || null;
      const out = { seamPresent: !!seam, refPresent: !!adMod };
      if (!seam || !adMod) return out;                /* ← 红：接缝未接线 */

      const ref = new adMod.IdbStyleAdapter();
      const projOf = (m) => JSON.stringify(Array.from(m.entries()).sort());
      const ent = (m) => JSON.stringify(Array.from(m.entries()).sort());

      const bad = { changed: {}, deleted: [], seq: 1, baseRev: 0 };  /* S-1：不合契约形状 */
      let refErr = null;
      try { await ref.transact(bad); } catch (e) { refErr = { name: e.name, message: e.message }; }

      /* 序列 A（真契约三段式：BEGIN→apply→COMMIT） */
      const a1 = { changed: [{ id: 'a', data: '{"id":"a","v":1}' }], deleted: [], seq: 1, baseRev: 0 };
      const seamA1 = await seam.applyBatch(a1);
      const refA1 = await ref.transact(a1);
      out.a1 = {
        seamOk: !!(seamA1 && seamA1.ok === true),
        refOk: !!(refA1 && refA1.ok === true),
        eq: ent(seam.projection()) === ent(ref.rows()),
        proj: ent(seam.projection()),
      };

      /* 序列 B（删除优先 + 同 id 覆盖） */
      const a2 = { changed: [{ id: 'b', data: '{"id":"b"}' }, { id: 'a', data: '{"id":"a2"}' }],
                   deleted: ['a'], seq: 2, baseRev: 1 };
      const seamA2 = await seam.applyBatch(a2);
      const refA2 = await ref.transact(a2);
      out.a2 = {
        seamOk: !!(seamA2 && seamA2.ok === true),
        refOk: !!(refA2 && refA2.ok === true),
        eq: ent(seam.projection()) === ent(ref.rows()),
        proj: ent(seam.projection()),
      };

      /* 全量 checkpoint 等价（saveState） */
      const snap = { nodes: { z: { id: 'z' }, q: { id: 'q' } } };
      const seamS = await seam.flushNow(snap);
      const refS = await ref.saveState(snap);
      out.s = {
        seamOk: !!(seamS && seamS.ok === true),
        refOk: !!(refS && refS.ok === true),
        eq: ent(seam.projection()) === ent(ref.rows()),
      };

      /* S-1：不合形状的错误口径（store 侧 ok:false / 参考适配器抛同契约错误） */
      const seamBad = await seam.applyBatch(bad);
      out.bad = {
        seamOk: !!(seamBad && seamBad.ok === false),
        refErr,
        failures: seam.store && seam.store.stats ? seam.store.stats().failures : null,
      };

      out.publicFace = ['transact', 'saveState', 'rows', 'setFailNext', 'close']
        .filter((k) => typeof seam.backend[k] === 'function');
      out.backendKind = seam.backend.kind;
      return out;
    }, SEAM_KEY);

    expect(r.refPresent).toBe(true);                   /* L9 参考适配器可达 */
    expect(r.seamPresent).toBe(true);                  /* ← 红 */
    expect(r.backendKind).toBe('idb');
    expect(r.publicFace).toEqual(['transact', 'saveState', 'rows', 'setFailNext', 'close']);
    expect(r.a1.seamOk).toBe(true);
    expect(r.a1.refOk).toBe(true);
    expect(r.a1.eq).toBe(true);
    expect(r.a1.proj).toBe('[["a","{\\"id\\":\\"a\\",\\"v\\":1}"]]');
    expect(r.a2.seamOk).toBe(true);
    expect(r.a2.refOk).toBe(true);
    expect(r.a2.eq).toBe(true);
    expect(r.s.seamOk).toBe(true);
    expect(r.s.refOk).toBe(true);
    expect(r.s.eq).toBe(true);
    expect(r.bad.seamOk).toBe(true);
    expect(r.bad.refErr).toEqual({ name: 'Error', message: 'invalid batch shape' });
    expect(r.bad.failures).toBeGreaterThanOrEqual(1);
  });

  /* ══════════════════════════════════════════════════════════════════════
   * T-96 · P · 单批事务原子性（中途 throw → 无半批，#28 延伸）
   * ══════════════════════════════════════════════════════════════════════ */
  test('T-96 P · 单批事务原子性（中途 throw → 无半批，#28 延伸）', async ({ page }) => {
    await bootProduct(page, true);
    const r = await page.evaluate(async (KEY) => {
      const seam = await (async () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 2000) {
          if (globalThis[KEY]) return globalThis[KEY];
          await new Promise((r) => setTimeout(r, 50));
        }
        return globalThis[KEY] || null;
      })();
      if (!seam) return { seamPresent: false };
      const batch = { changed: [{ id: 'h1', data: '{"id":"h1"}' }, { id: 'h2', data: '{"id":"h2"}' }],
                      deleted: ['zz'], seq: 7, baseRev: 0 };
      const before = seam.projection().size;

      /* 故障注入：优先 S-2 崩溃钩子（apply 阶段 = 缓冲就绪、尚未 COMMIT），否则 setFailNext(1) */
      let inject = 'setFailNext';
      if (typeof seam.backend.crashBeforeCommit === 'function') {
        inject = 'crashBeforeCommit';
        seam.backend.crashBeforeCommit((phase) => { if (phase === 'apply') throw new Error('l10-inject-mid-apply'); });
      } else {
        seam.backend.setFailNext(1);
      }
      const bad = await seam.applyBatch(batch);
      const afterFail = seam.projection();
      const noHalf = !afterFail.has('h1') && !afterFail.has('h2') && afterFail.size === before;

      /* 清理注入并按 K-2 同 seq 重投：失败不得推进幂等基准（须被接受，而非 replay） */
      if (typeof seam.backend.crashBeforeCommit === 'function') seam.backend.crashBeforeCommit(null);
      const retry = await seam.applyBatch(batch);
      const afterRetry = seam.projection();

      return {
        seamPresent: true, inject,
        badOk: !!(bad && bad.ok === false),
        noHalf,
        failures: seam.store && seam.store.stats ? seam.store.stats().failures : null,
        retryOk: !!(retry && retry.ok === true),
        retryReplay: !!(retry && retry.replay === true),
        committed: afterRetry.has('h1') && afterRetry.has('h2'),
        sizeAfter: afterRetry.size,
      };
    }, SEAM_KEY);

    expect(r.seamPresent).toBe(true);                  /* ← 红 */
    expect(r.badOk).toBe(true);                        /* 注入的 throw → 批次失败（未静默成功） */
    expect(r.noHalf).toBe(true);                       /* 盘面无半批（#28 语义延伸） */
    expect(r.failures).toBeGreaterThanOrEqual(1);      /* FIFO 失败缓冲记账 */
    expect(r.retryOk).toBe(true);                      /* 失败不推进 K-2 基准 → 同 seq 重投被接受 */
    expect(r.retryReplay).toBe(false);
    expect(r.committed).toBe(true);
    expect(r.sizeAfter).toBe(2);
  });

  /* ══════════════════════════════════════════════════════════════════════
   * T-97 · P · 旧库迁移幂等（localStorage 整包 → 分行；逐 id 值等价）
   * ══════════════════════════════════════════════════════════════════════ */
  test('T-97 P · 旧库迁移幂等（逐 id 值等价）', async ({ page }) => {
    await bootProduct(page, true);
    const r = await page.evaluate(async (KEY) => {
      const seam = await (async () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 2000) {
          if (globalThis[KEY]) return globalThis[KEY];
          await new Promise((r) => setTimeout(r, 50));
        }
        return globalThis[KEY] || null;
      })();
      if (!seam) return { seamPresent: false };

      /* 旧库 = 非桌面产品遗留的 localStorage 整包（键与产品一致：STORE_KEY） */
      const legacyNodes = {
        L1: { id: 'L1', text: '旧库一', children: [], _rev: 1 },
        L2: { id: 'L2', text: '旧库二', children: [] },
      };
      const legacy = JSON.stringify({ rootId: 'root', nodes: legacyNodes, ui: { theme: 'dark' } });
      let seeded = true;
      try { localStorage.setItem(STORE_KEY, legacy); } catch (e) { seeded = false; }

      const m1 = await seam.migrateLegacy(legacy);
      const p1 = Array.from(seam.projection().entries()).sort();
      const m2 = await seam.migrateLegacy(legacy);          /* 幂等重放 */
      const p2 = Array.from(seam.projection().entries()).sort();

      return {
        seamPresent: true, seeded,
        ok1: !!(m1 && m1.ok === true), migrated1: m1 && m1.migrated,
        ok2: !!(m2 && m2.ok === true), migrated2: m2 && m2.migrated,
        ids: p1.map((e) => e[0]),
        node1: p1.length ? JSON.parse(p1[0][1]) : null,
        node2: p1.length > 1 ? JSON.parse(p1[1][1]) : null,
        idem: JSON.stringify(p1) === JSON.stringify(p2),
        size1: p1.length, size2: p2.length,
        expected: legacyNodes,
      };
    }, SEAM_KEY);

    expect(r.seamPresent).toBe(true);                  /* ← 红 */
    expect(r.seeded).toBe(true);
    expect(r.ok1).toBe(true);
    expect(r.migrated1).toBe(2);
    expect(r.ids).toEqual(['L1', 'L2']);
    expect(r.node1).toEqual({ id: 'L1', text: '旧库一', children: [], _rev: 1 });
    expect(r.node2).toEqual({ id: 'L2', text: '旧库二', children: [] });
    expect(r.ok2).toBe(true);
    expect(r.migrated2 || 0).toBe(0);                  /* 迁移幂等：第二次 0 新增 */
    expect(r.idem).toBe(true);
    expect(r.size1).toBe(2);
    expect(r.size2).toBe(2);
  });

  /* ══════════════════════════════════════════════════════════════════════
   * T-98 · 门禁 · `verify.js` 计数同步（`158 + N` = 165，LO-7）
   * ══════════════════════════════════════════════════════════════════════ */
  test('T-98 门禁 · verify.js 计数同步（158 + N，LO-7）', async () => {
    const verifyPath = path.join(STEP9, 'scripts', 'verify.js');
    const src = fs.readFileSync(verifyPath, 'utf8');
    const lines = src.split(/\r?\n/);
    /* 锚定「横幅标签行」：须同时含 `Playwright 集成测试` 与 `= <N> 用例`
       （verify.js 头注 `# 仅 Playwright 集成测试` 无计数，不得被误取） */
    const banner = lines.find((l) => /Playwright\s*集成测试/.test(l) && /=\s*\d+\s*用例/.test(l)) || '';

    const totalMatch = banner.match(/=\s*(\d+)\s*用例/);
    const stagePairs = Array.from(banner.matchAll(/L(\d+)\s+(\d+)/g));
    const byStage = {};
    let sumListed = 0;
    for (const m of stagePairs) { byStage['L' + m[1]] = Number(m[2]); sumListed += Number(m[2]); }

    const pwBlock = src.match(/const\s+PW_TESTS\s*=\s*\[([\s\S]*?)\];/);
    const pwEntries = pwBlock ? Array.from(pwBlock[1].matchAll(/'([^']+)'/g)).map((m) => m[1]) : [];

    expect(banner).not.toBe('');
    expect(totalMatch).not.toBeNull();
    /* ① 横幅总数 = 158 + N（N = 本波新增 7 → 165） */
    expect(Number(totalMatch[1])).toBe(EXPECTED_PW_TOTAL);
    /* ② 分项之和必须等于总数（口径自洽，R10 防漂移） */
    expect(sumListed).toBe(EXPECTED_PW_TOTAL);
    /* ③ 横幅须显式列 L10 分项 = N（本波 7） */
    expect(byStage.L10).toBe(L10_NEW_CASES);
    /* ④ 新 spec 必须进入 PW_TESTS 阵容 */
    expect(pwEntries).toContain(L10_SPEC_REL);
    /* ⑤ 既有跳过项口径不变（T-48/T-49 → 既有 158 计数语义） */
    expect(byStage.L9).toBe(6);
  });

  /* ══════════════════════════════════════════════════════════════════════
   * T-99 · 门禁 · 15+M 方登记 `RESULT=PASS`（哨兵 · 不变量 #29 · LO-8）
   * ══════════════════════════════════════════════════════════════════════ */
  test('T-99 门禁 · 15+M 方登记 RESULT=PASS（哨兵 · 不变量 #29 · LO-8）', async () => {
    const regPath = path.join(STEP9, 'verify-hash-registry.mjs');
    const regSrc = fs.readFileSync(regPath, 'utf8');

    const cp = spawnSync(process.execPath, [regPath], {
      cwd: STEP9,
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });
    const out = `${cp.stdout || ''}${cp.stderr || ''}`;
    const usable = out.includes('PARTY_COUNT=') && out.includes('RESULT=');
    const pick = (k) => {
      const m = out.match(new RegExp(k + '=(\\d+)'));
      return m ? Number(m[1]) : null;
    };
    const partyCount = pick('PARTY_COUNT');
    const drift = pick('FIVE_PARTY_DRIFT_COUNT');
    const resultPass = /RESULT=PASS/.test(out);
    /* LO-8 = B：扩到 `15 + M` → 登记清单必须纳编本波新物（本 spec） */
    const registered = regSrc.includes(L10_SPEC_BASENAME);

    /* 明确失败而非静默降级：登记器必须可执行且输出三令牌 */
    expect(usable).toBe(true);
    expect(partyCount).not.toBeNull();
    expect(drift).not.toBeNull();
    expect(partyCount).toBeGreaterThanOrEqual(EXPECTED_PARTY_MIN);   /* ← 红：现为 15 */
    expect(drift).toBe(0);
    expect(resultPass).toBe(true);
    expect(registered).toBe(true);                                   /* ← 红：现未纳编 */
  });
});
