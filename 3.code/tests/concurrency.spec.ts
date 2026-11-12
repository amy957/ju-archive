import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'vite';

/**
 * M1-2 · 批次 AS · 3 标签并发收敛测试（内存态 + 磁盘态双收敛）
 *
 * 被测链路：`window.JU.actions.*` → core/store.scheduleNotify → core/persist.commit
 *           → runPersist（localStorage 全量落盘 `juju.store.v31`）
 *           → _broadcastRev（BroadcastChannel `juju-store`）+ storage 事件
 *           → mergeRemoteState（节点级 LWW / 墓碑压制 / 删除传播 / children 确定性收敛）
 *
 * 断言三层（本批次新增第 2、3 层）：
 *   ① 内存态收敛：三标签 `JU.getState().nodes` 深度一致（剥离运行期来源标记 `_origin`，
 *      该字段是各标签页独立的 local/remote 标记，非用户内容，产品件自身比较内容时也剥离它）；
 *   ② 磁盘态收敛：三标签 `localStorage['juju.store.v31']` 的**内容投影** SHA-256 一致
 *      （投影剥离 `_rev` / `_localCreated` / `_remoteReceived` / `_tombstones` 等各页自持的
 *      写盘信号量与保护集——它们按设计不跨页相等；节点内容 / 父子结构 / LWW 时间戳必须逐字节一致）；
 *   ③ 内存 ↔ 磁盘一致：每个标签页自身的「内存投影」与「磁盘投影」哈希相同（落盘不滞后于内存）。
 *
 * 环境说明（实测）：本机浏览器进程到 127.0.0.1 / localhost 的入站连接被系统策略阻断
 * （curl / PowerShell / 同进程 Vite 均超时，netstat 可见端口 LISTENING 但连接不建立）。
 * 因此本 spec 在 `context.route` 层把 `baseURL` 请求映射到 Vite 构建产物：
 *   - 页面仍是 `http://localhost:5173` 这一真实 HTTP 源（localStorage / BroadcastChannel
 *     的跨标签共享语义与真实服务端承载完全一致）；
 *   - 3 个 Page 必须位于同一个 BrowserContext（跨 Context 不共享 localStorage 与
 *     BroadcastChannel，无法验证多标签同步）。
 *
 * 操作策略：每标签 1000 次随机 addNode / updateText / removeNode，每 10 次等待 200ms
 * 让广播与落盘合并完成；结束后额外等待 500ms 让 `schedulePersist` 的 300ms 防抖窗口落定
 * （真实写盘完成、broadcast 送达），再分别比对内存态与磁盘态。
 */

const BASE = 'http://localhost:5173';
const STORE_KEY = 'juju.store.v31';
const OPS_PER_TAB = 1000;
const SYNC_EVERY = 10;
const SYNC_WAIT_MS = 200;
/** 落盘/广播静默窗口（> schedulePersist 300ms 防抖 + 事件派发） */
const WRITE_SETTLE_MS = 500;

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

function projectRoot(): string {
  /* testDir = <root>/tests；config.rootDir 即 testDir 绝对路径 */
  return path.dirname(test.info().config.rootDir);
}

/** 重新构建（保证被测代码即当前源码），并把 dist 目录映射到 baseURL。 */
async function prepareDist(): Promise<string> {
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  return dist;
}

async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route(BASE + '/**', async (route: Route) => {
    const url = new URL(route.request().url());
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';
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

/** 稳定键序序列化（节点对象键序不影响语义） */
function canonicalStringify(value: any): string {
  const canon = (v: any): any => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(canon(value));
}

/**
 * 节点内容投影：剥离 `_origin`（运行期来源标记，各标签页独立）。
 * 与产品件 `_REV_STRIP` 的比较口径一致：来源标记不是用户内容，不参与收敛断言。
 */
function projectNodes(nodes: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const id of Object.keys(nodes || {})) {
    const n = nodes[id];
    if (!n || typeof n !== 'object') { out[id] = n; continue; }
    const copy: Record<string, any> = {};
    for (const k of Object.keys(n)) { if (k !== '_origin') copy[k] = n[k]; }
    out[id] = copy;
  }
  return out;
}

/**
 * 整库内容投影：只保留跨标签应当相等的部分。
 * 剥离项均为「单页自持」的落盘信号量 / 保护集（产品件 2028-2047、L16-W13 指令 4）：
 *   `_rev`（各页独立写盘计数，跨页不可比）、`_localCreated` / `_remoteReceived`（各页删除传播保护集）、
 *   `_tombstones`（各页墓碑窗口，TTL 内按到达顺序并入）、`updatedAt`（各页最后一次提交时钟）。
 */
function projectStore(st: any): string {
  const nodes = projectNodes(st && st.nodes ? st.nodes : {});
  return canonicalStringify({ rootId: st && st.rootId, nodes });
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

type Diff = { missingIn: Record<string, string[]>; differentNodes: Array<{ id: string; sigs: string[] }> };

function diffSnapshots(snaps: Array<{ name: string; nodes: Record<string, any> }>): Diff {
  const diff: Diff = { missingIn: {}, differentNodes: [] };
  const allIds = new Set<string>();
  for (const s of snaps) for (const id of Object.keys(s.nodes)) allIds.add(id);
  for (const s of snaps) {
    const missing: string[] = [];
    for (const id of allIds) if (!(id in s.nodes)) missing.push(id);
    if (missing.length) diff.missingIn[s.name] = missing;
  }
  for (const id of allIds) {
    const sigs = snaps.map((s) => (s.nodes[id] ? canonicalStringify(s.nodes[id]) : '<absent>'));
    if (new Set(sigs).size > 1) diff.differentNodes.push({ id, sigs });
  }
  return diff;
}

test('M1-2 3 标签并发收敛测试（内存态 + 磁盘态）', async ({ context, page }) => {
  test.setTimeout(300_000);

  const dist = await prepareDist();
  await installDistRoute(context, dist);

  const pages: Page[] = [page, await context.newPage(), await context.newPage()];
  const pageErrors: string[] = [];
  pages.forEach((p, i) => p.on('pageerror', (e) => pageErrors.push(`p${i + 1}: ${String((e && e.message) || e)}`)));

  /* 1) 三标签依次装载（首标签落默认态并写盘，后两个标签从同一 origin 的 localStorage 装载） */
  await Promise.all(pages.map((p) => p.goto('/', { waitUntil: 'load' })));
  await Promise.all(pages.map((p) => p.waitForFunction(
    () => {
      const J = (window as any).JU;
      return !!(J && typeof J.getState === 'function' && typeof J.actions === 'object');
    },
    null,
    { timeout: 30_000 },
  )));

  /* 启动后首次落盘由 boot 的 persistNow() 完成：先确认磁盘上已有真实快照 */
  await page.waitForTimeout(WRITE_SETTLE_MS);
  const bootDisk = await pages[0].evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? raw.length : 0;
  }, STORE_KEY);
  expect(bootDisk, '启动成功后必须已真实落盘（boot persistNow）').toBeGreaterThan(0);

  /* Track B · 免费版 500 节点限额（core/actions.ts FREE_NODE_LIMIT）：
     本用例每标签要执行 1000 次操作（含大量 addNode），免费版会在 500 节点处拦截，
     导致并发吞吐量断言失败。此处对**每个标签页**置 `ui.isPro = true` 绕过限额。
     时机：必须放在 boot 首次落盘之后——`boot()` 内的 `restoreLicense()` 是 await 异步复核，
     若在 boot 完成前写入 isPro 会被启动复核覆盖回免费版。 */
  /* `JU.ui` 在产品件里有两种形态（对象 / 返回对象的函数），与 full-e2e 同一口径取真实 UI 对象。
     直接写 `JU.ui.isPro` 在函数形态下只写到函数自身属性，实现层的 `deps.ui.isPro` 仍为 false，
     限额拦截照旧生效（本用例曾因此静默漏拦 665 次 addNode）。 */
  const setPro = (): boolean => {
    const J = (window as any).JU;
    const U = typeof J.ui === 'function' ? J.ui() : J.ui;
    U.isPro = true;
    return U.isPro === true;
  };
  const proFlags = await Promise.all(pages.map((p) => p.evaluate(setPro)));
  expect(proFlags, '三标签必须已置 Pro（绕过免费版 500 节点限额）').toEqual([true, true, true]);

  const baseline = await pages[0].evaluate(() => {
    const J = (window as any).JU;
    const st = J.getState();
    return { rootId: st && st.rootId, nodeCount: st && st.nodes ? Object.keys(st.nodes).length : -1 };
  });
  expect(baseline.rootId, '首标签必须装载到根节点').toBeTruthy();
  expect(baseline.nodeCount, '首标签必须装载到初始状态').toBeGreaterThan(0);

  /* 2) 三标签并发执行 1000 次随机操作 */
  const runOps = async (p: Page, seed: number) => p.evaluate(async ({ seed, ops, syncEvery, syncWait, storeKey }) => {
    const J = (window as any).JU;
    const uiOf = (): any => (typeof J.ui === 'function' ? J.ui() : J.ui);
    /* 并发吞吐量用例：执行期再做一次 Pro 断言（幂等），确保 500 节点限额不会中断操作循环 */
    uiOf().isPro = true;
    const mulberry32 = (a: number) => () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rnd = mulberry32(seed);
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const stats = { add: 0, update: 0, remove: 0, skipped: 0, limitBlocked: 0, addNull: 0, errors: [] as string[] };
    for (let i = 1; i <= ops; i++) {
      const st = J.getState();
      const rootId = st && st.rootId;
      const ids: string[] = st && st.nodes ? Object.keys(st.nodes).filter((id) => id !== rootId) : [];
      const roll = rnd();
      try {
        if (roll < 0.55 || ids.length === 0) {
          const id = J.actions.addNode(rootId, null, { text: '' });
          if (id) stats.add++;
          else {
            stats.skipped++;
            /* 诊断分流：Pro 丢失（免费版限额拦截） vs 其它原因（父节点缺失等） */
            if (!uiOf().isPro) stats.limitBlocked++;
            else stats.addNull++;
          }
        } else if (roll < 0.85) {
          const id = ids[Math.floor(rnd() * ids.length)];
          J.actions.updateText(id, 'T' + Math.floor(rnd() * 1e9).toString(36));
          stats.update++;
        } else {
          const id = ids[Math.floor(rnd() * ids.length)];
          J.actions.removeNode(id);
          stats.remove++;
        }
      } catch (e) {
        stats.errors.push(String((e && (e as any).message) || e));
        if (stats.errors.length > 8) break;
      }
      if (i % syncEvery === 0) await sleep(syncWait);
    }
    return {
      ...stats,
      finalCount: Object.keys(J.getState().nodes).length,
      storedBytes: (localStorage.getItem(storeKey) || '').length,
    };
  }, { seed, ops: OPS_PER_TAB, syncEvery: SYNC_EVERY, syncWait: SYNC_WAIT_MS, storeKey: STORE_KEY });

  const runs = await Promise.all(pages.map((p, i) => runOps(p, 20261024 + i * 7919)));
  for (const r of runs) {
    expect(r.errors, '页面内操作不得抛错：' + JSON.stringify(r.errors)).toEqual([]);
  }
  console.log('[M1-2] perTab stats=' + JSON.stringify(runs));
  const executed = runs.reduce((n, r) => n + r.add + r.update + r.remove, 0);
  const skipped = runs.reduce((n, r) => n + r.skipped, 0);
  expect(
    executed,
    '三标签合计应执行 3000 次有效操作（skipped=' + skipped + '，明细=' + JSON.stringify(runs) + '）',
  ).toBe(OPS_PER_TAB * pages.length);

  /* 3) 等待收敛：三标签节点数连续 10 次一致（或 20s 超时后由下面的深度对比判定） */
  const snapshot = async (p: Page) => p.evaluate(() => {
    const J = (window as any).JU;
    return J.getState().nodes as Record<string, unknown>;
  });

  let stableRounds = 0;
  const deadline = Date.now() + 20_000;
  let lastCounts: number[] = [];
  while (Date.now() < deadline) {
    const counts = await Promise.all(pages.map(async (p) => Object.keys(await snapshot(p)).length));
    if (counts.every((c) => c === counts[0])) {
      stableRounds++;
      if (stableRounds >= 10) { lastCounts = counts; break; }
    } else {
      stableRounds = 0;
    }
    lastCounts = counts;
    await new Promise((r) => setTimeout(r, 120));
  }

  /* 3b) 真实落盘静默窗口：等待 schedulePersist(300ms) 防抖窗口落定 + storage/BC 事件派发完毕，
         保证接下来读到的 localStorage 是收敛后的磁盘态（而非上一次写盘）。 */
  await Promise.all(pages.map((p) => p.waitForTimeout(WRITE_SETTLE_MS)));

  /* 4) 内存态深度对比：与磁盘态使用**同一**投影函数（projectStore），
        剥离运行期来源标记 `_origin` 与各页自持的写盘信号量（_rev / 保护集 / 墓碑 / updatedAt）。 */
  const rawMem = await Promise.all(pages.map((p) => p.evaluate(() => JSON.stringify((window as any).JU.getState()))));
  const names = ['tab-1', 'tab-2', 'tab-3'];
  const memState = rawMem.map((s) => JSON.parse(s));
  const memProjection = memState.map((st) => projectStore(st));
  const memHashes = memProjection.map(sha256);
  const parsed = memState.map((st, i) => ({ name: names[i], nodes: projectNodes(st && st.nodes ? st.nodes : {}) }));
  const diff = diffSnapshots(parsed);

  /* 5) 磁盘态对比：读三标签 localStorage 的真实落盘串，做同样的内容投影后比对哈希 */
  const diskRaw = await Promise.all(pages.map((p) => p.evaluate((key) => localStorage.getItem(key) || '', STORE_KEY)));
  diskRaw.forEach((raw, i) => {
    expect(raw.length, `${names[i]} 磁盘必须存在真实快照（${STORE_KEY}）`).toBeGreaterThan(0);
  });
  const diskProjection = diskRaw.map((raw) => projectStore(JSON.parse(raw)));
  const diskHashes = diskProjection.map(sha256);
  /* 原始字节哈希：仅作诊断输出——`_rev` / 保护集按设计各页不等，不参与断言 */
  const diskRawHashes = diskRaw.map(sha256);
  const memDiskHashes = memProjection.map((m, i) => ({ tab: names[i], mem: memHashes[i], disk: diskHashes[i] }));

  const summary = {
    perTab: runs.map((r, i) => ({
      tab: names[i], add: r.add, update: r.update, remove: r.remove,
      finalCount: r.finalCount, storedBytes: r.storedBytes,
    })),
    totalOps: executed,
    convergedCounts: lastCounts,
    memoryProjectionHash: memHashes,
    diskProjectionHash: diskHashes,
    diskRawHash: diskRawHashes,
    memoryDiskAligned: memDiskHashes,
    canonicalEqual: memProjection.every((s) => s === memProjection[0]),
    pageErrors: pageErrors.slice(0, 5),
  };
  console.log('[M1-2] ' + JSON.stringify(summary, null, 2));

  const missingIds = Object.values(diff.missingIn).flat();
  const changedIds = diff.differentNodes.map((d) => d.id);
  if (missingIds.length || changedIds.length) {
    throw new Error(
      'M1-2 内存态收敛失败：三标签 state 不一致。\n' +
      '缺失节点（按标签）: ' + JSON.stringify(diff.missingIn) + '\n' +
      '内容不同节点 ID: ' + JSON.stringify(changedIds.slice(0, 50)) + '\n' +
      '节点明细: ' + JSON.stringify(diff.differentNodes.slice(0, 10)) + '\n' +
      '统计: ' + JSON.stringify(summary),
    );
  }

  expect(missingIds, '不得存在某标签缺失的节点').toEqual([]);
  expect(changedIds, '不得存在内容不一致的节点').toEqual([]);
  expect(lastCounts.every((c) => c === lastCounts[0]), '三标签节点数必须一致').toBe(true);
  expect(lastCounts[0], '收敛后节点总数应远大于初始状态').toBeGreaterThan(100);

  /* 磁盘态：内容投影哈希必须三者一致（磁盘也收敛，不只是内存收敛） */
  expect(
    new Set(diskHashes).size,
    '磁盘态未收敛：三标签 localStorage 内容投影哈希不一致。\n' + JSON.stringify({ diskHashes, diskRawHashes }),
  ).toBe(1);
  /* 内存 ↔ 磁盘：每个标签页自身的内存投影与磁盘投影必须一致（落盘不滞后） */
  for (let i = 0; i < pages.length; i++) {
    expect(
      diskHashes[i],
      `${names[i]} 内存态与磁盘态不一致（落盘滞后或丢写）。\n` + JSON.stringify({ mem: memHashes[i], disk: diskHashes[i] }),
    ).toBe(memHashes[i]);
  }
});

/* ============================================================
   review13 · ISSUE-001：提交即落盘（单通道）· 两窗口交替编辑 + 强杀不丢数据
   ------------------------------------------------------------
   背景：cachePendingSnapshotNow 曾在桌面加密态直接 writeEncryptedStore，绕过 runPersist 的
   「读盘 → 节点级 LWW 合并」，两窗口交替编辑会互相覆盖。修复后 commit 只经 persistNow()
   → runPersist 单通道落盘；明文浏览器分支在 commit 返回前已完成 localStorage 写盘。
   强杀口径：page.close() 默认不执行 beforeunload（页面无任何收尾机会），等价于进程被强杀。
   ============================================================ */
test('review13 · 两窗口交替编辑后强杀不丢最后编辑（ISSUE-001 单通道）', async ({ context, page }) => {
  test.setTimeout(120_000);
  const dist = await prepareDist();
  await installDistRoute(context, dist);
  const a = page;
  const b = await context.newPage();
  const ready = (p: Page) => p.waitForFunction(
    () => { const J = (window as any).JU; return !!(J && typeof J.getState === 'function' && typeof J.actions === 'object'); },
    null, { timeout: 30_000 },
  );
  await Promise.all([a.goto('/'), b.goto('/')]);
  await Promise.all([ready(a), ready(b)]);
  await a.waitForTimeout(WRITE_SETTLE_MS);

  /* addNode 自带 persistNow（F-01），只用于建节点；被测的是 updateText 的 commit 路径。 */
  const add = (p: Page, tag: string, n: number) => p.evaluate(({ tag, n }) => {
    const J = (window as any).JU;
    const rootId = J.getState().rootId;
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = J.actions.addNode(rootId, null, { text: tag + i });
      if (id) ids.push(id);
    }
    return ids;
  }, { tag, n });

  const aIds = await add(a, 'R13-A-', 5);
  const bIds = await add(b, 'R13-B-', 5);
  expect(aIds.length, 'A 窗口 5 个节点必须全部建成').toBe(5);
  expect(bIds.length, 'B 窗口 5 个节点必须全部建成').toBe(5);
  await a.waitForTimeout(WRITE_SETTLE_MS); /* 等 addNode 首轮落盘静默，下面只观察 updateText 的提交路径 */

  const rename = (p: Page, ids: string[], tag: string) => p.evaluate(({ ids, tag }) => {
    const J = (window as any).JU;
    ids.forEach((id, i) => J.actions.updateText(id, tag + i + '-V2'));
  }, { ids, tag });

  await rename(a, aIds, 'R13-A-');
  await rename(b, bIds, 'R13-B-');

  /* 提交返回瞬间磁盘必须已含两窗口最后一笔（明文分支 runPersist 同步写 localStorage） */
  const diskNow = JSON.parse(await b.evaluate((key) => localStorage.getItem(key) || '{}', STORE_KEY));
  const lastA = diskNow.nodes && diskNow.nodes[aIds[aIds.length - 1]];
  const lastB = diskNow.nodes && diskNow.nodes[bIds[bIds.length - 1]];
  expect(lastA && lastA.text, 'A 窗口最后编辑必须已在磁盘上（不得等 300ms 防抖）').toBe('R13-A-4-V2');
  expect(lastB && lastB.text, 'B 窗口最后编辑必须已在磁盘上（不得等 300ms 防抖）').toBe('R13-B-4-V2');

  /* 强杀：close() 不带 runBeforeUnload，两窗口均无落盘收尾机会 */
  await a.close();
  await b.close();

  const c = await context.newPage();
  await c.goto('/');
  await ready(c);
  const seen = await c.evaluate(({ aIds, bIds }: { aIds: string[]; bIds: string[] }) => {
    const nodes = (window as any).JU.getState().nodes || {};
    const texts = [...aIds.map((id, i) => 'R13-A-' + i + '-V2'), ...bIds.map((id, i) => 'R13-B-' + i + '-V2')];
    return [...aIds, ...bIds].filter((id, i) => !!nodes[id] && nodes[id].text === texts[i]);
  }, { aIds, bIds });
  expect(seen.length, '强杀后重开必须看到两窗口全部交替编辑的最终内容（ISSUE-001）').toBe(10);
});
