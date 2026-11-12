/**
 * L17 封存 · 全量 QA 终验重跑
 * ============================================================================
 * 产物：
 *   8.发布与CI/reports/all-l17-fixed.json   —— 11 类测试的机器可读结果
 *   8.发布与CI/reports/all.json             —— 测试基座清单（00–08 分组）
 * 约束：
 *   - 只读 canonical / step9 镜像；不写产品字节；不改登记器；不覆盖冻结件。
 *   - 浏览器测试一律使用独立 BrowserContext（独立 localStorage / IndexedDB /
 *     BroadcastChannel 作用域），避免用例间串扰。
 * 运行：
 *   <node.exe> 6.P0-T3基线\step9\t9\t17-qa-all.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const ROOT = path.resolve(HERE, '..', '..', '..');
const CANONICAL = path.resolve(STEP9, '..', 'v2.0-t3.html');
const MIRROR = path.resolve(STEP9, 'v2.0-t3.html');
const REPORTS = path.join(ROOT, '8.发布与CI', 'reports');
const APP_URL = pathToFileURL(CANONICAL).href;
const STORE_KEY = 'juju.store.v31';
const AUTO_BACKUP_KEY = 'juju.autobackup.v18';
const EXPECT = {
  bytes: 1126551,
  sha256: '1D6BAFB95AF5EA893AA17DC6E90DD6189A6BB4C9DAE30344ADBF9A1151E6C00B',
};

const SRC = readFileSync(CANONICAL, 'utf8');
const BUF = readFileSync(CANONICAL);
const sha256 = createHash('sha256').update(BUF).digest('hex').toUpperCase();
const lf = (BUF.toString('latin1').match(/\n/g) || []).length;
const crlf = (BUF.toString('latin1').match(/\r\n/g) || []).length;

function chromePath() {
  const cands = [
    process.env.JU_CHROMIUM_PATH,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
    'C:\\Program Files\\Chromium\\chrome.exe',
  ].filter(Boolean);
  return cands.find((p) => { try { return existsSync(p); } catch { return false; } }) || '';
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function pct(n, d) { return d ? Number(((n / d) * 100).toFixed(2)) : 0; }

/* ============================================================================
 * 00 · static —— 字节锚点 / EOL / 内联脚本语法 / 铁律 6 静态门
 * ========================================================================== */
function suiteStatic() {
  const tags = [...SRC.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  let syntaxOk = 0;
  const syntaxFails = [];
  tags.forEach((m, i) => {
    const attrs = m[1] || '';
    const body = m[2] || '';
    if (/\bsrc\s*=/.test(attrs)) return;
    if (/type\s*=\s*["'](application\/json|importmap)["']/i.test(attrs)) return;
    try { new vm.Script(body, { filename: 'inline-' + i + '.js' }); syntaxOk++; }
    catch (e) { syntaxFails.push({ i, message: String(e && e.message) }); }
  });
  /* 铁律 6 静态门（与 verify.js aiNoteLint 同口径） */
  const inner = String.fromCharCode(0x5185, 0x5BB9, 0x7531, 0x41, 0x49, 0x751F, 0x6210);
  const re = new RegExp(inner.replace(/(.)/g, '$1\\s*'), 'i');
  const exts = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.ps1']);
  const skip = new Set(['node_modules', 'test-results', 'playwright-report', '.git']);
  const hits = [];
  const stack = [STEP9];
  while (stack.length) {
    const dir = stack.pop();
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (!skip.has(e.name)) stack.push(abs); continue; }
      if (abs === fileURLToPath(import.meta.url)) continue;
      if (!e.isFile() || !exts.has(path.extname(e.name).toLowerCase())) continue;
      let txt; try { txt = readFileSync(abs, 'utf8'); } catch { continue; }
      if (!txt.includes(inner.slice(0, 3))) continue;
      txt.split(/\r?\n/).forEach((ln, i) => { if (re.test(ln)) hits.push(path.relative(STEP9, abs) + ':' + (i + 1)); });
    }
  }
  const pass = BUF.length === EXPECT.bytes && sha256 === EXPECT.sha256 && crlf === 0 && tags.length === 9 && syntaxOk === 9 && hits.length === 0;
  return {
    pass,
    bytes: BUF.length,
    expectedBytes: EXPECT.bytes,
    sha256,
    expectedSha256: EXPECT.sha256,
    eol: crlf === 0 ? 'LF' : 'CRLF',
    lfCount: lf,
    inlineScripts: tags.length,
    inlineSyntaxOk: syntaxOk,
    inlineSyntaxFails: syntaxFails,
    aiNoteHits: hits,
  };
}

/* ============================================================================
 * 02 · property.clean / 05 · multitab —— Node 提取真实 merge 段（无浏览器）
 * ========================================================================== */
const M0 = SRC.indexOf('function removeNodeFromMap(map,id){');
const M1 = SRC.indexOf('/* L16-W6 · 指令 6：node→Set(children) 模块级缓存（WeakMap）', M0);
if (!(M0 > 0 && M1 > M0)) throw new Error('canonical merge 段定位失败');
const MERGE_NEW = SRC.slice(M0, M1);
const STRIP_M = SRC.match(/const _ORIGIN_STRIP=(\(k,v\)=>k==='_origin'\?undefined:v);/);
if (!STRIP_M) throw new Error('canonical 缺 _ORIGIN_STRIP');
const ORIGIN_STRIP = new Function('return ' + STRIP_M[1])();

const SCAFFOLD = `
    let state = initState;
    let _recentlyRemoved = new Map();
    let _tombstoneQueue = [];
    let _tombstoneFifoHead = 0;
    let _diskConfirmed = opts.diskConfirmed ? new Set(opts.diskConfirmed) : null;
    let __juInMerge = false;
    const window = {};
    const _win = window;
    const ui = {};
    const _searchHayCache = new Map();
    let _calIndexCache = null, _calDataRev = 0, _tagIndexCache = null, _searchInverted = null;
    let _backlinkMap = null, _docTitleToDocId = null;
    function _childSetDrop() {}
    function repairTreeConsistency() {}
    function dedupNoteRoots() {}
    function dedupCalRoots() {}
    function reportError() {}
    function markPersistMerged() {}
    function _sideCountsSet() {}
    function _sideCountsRebuild() { return {}; }
    function invalidateCalIndexOnly() {}
    function purgeNodeMeta() {}
    function _tombstoneCompactQueue() {}
    function _tombstoneSet(id, st) {
      const _now = Date.now();
      _recentlyRemoved.set(id, _now);
      _tombstoneQueue.push(id);
      const t = st || state;
      if (t) {
        if (typeof t._tombstones !== 'object' || !t._tombstones) t._tombstones = {};
        t._tombstones[id] = _now;
      }
    }
`;
function makeTab(initState, opts, mergeSrc) {
  const factory = new Function(
    'initState', 'opts',
    SCAFFOLD + mergeSrc + `
    return {
      state: () => state,
      merge: (remote) => mergeRemoteState(remote),
      del: (id) => removeNodeFromMap(state.nodes, id),
      setDiskFromState: () => { _diskConfirmed = new Set(Object.keys(state.nodes)); },
      received: () => (Array.isArray(state._remoteReceived) ? state._remoteReceived.slice() : null),
      ids: () => Object.keys(state.nodes),
      count: () => Object.keys(state.nodes).length,
    };
    `,
  );
  return factory(initState, opts || {});
}
function tabBase() {
  const st = { nodes: {}, rootId: 'root', updatedAt: 1000, trashed: [], _localCreated: [], _remoteReceived: [], _tombstones: {} };
  st.nodes.root = { id: 'root', parent: null, children: [], text: 'root', createdAt: 1, updatedAt: 1 };
  return st;
}
function addNode(state, id, parentId, ts) {
  state.nodes[id] = { id, parent: parentId, children: [], text: id, createdAt: ts, updatedAt: ts, _origin: 'local' };
  if (!Array.isArray(state._localCreated)) state._localCreated = [];
  if (!state._localCreated.includes(id)) state._localCreated.push(id);
  const p = state.nodes[parentId];
  if (p && !p.children.includes(id)) p.children.push(id);
}
function persist(t) {
  const json = JSON.stringify(t.state(), ORIGIN_STRIP);
  t.setDiskFromState();
  return JSON.parse(json);
}
const deliver = (to, snap) => to.merge(clone(snap));

/* ---- 02 · property.clean：I2（秒级 / 毫秒等价快照的 LWW 结果一致） ---- */
const CLEAN_BASE = 1700000000000;
function makeCleanLocal(i) {
  const base = CLEAN_BASE + i * 1000;
  const st = { nodes: {}, rootId: 'root', updatedAt: base, trashed: [], _localCreated: [], _remoteReceived: [], _tombstones: {} };
  st.nodes.root = { id: 'root', parent: null, children: ['d1'], text: 'root', createdAt: 1, updatedAt: 1 };
  st.nodes.d1 = { id: 'd1', parent: 'root', children: ['a', 'b'], text: 'doc-' + i, createdAt: 100, updatedAt: 100 };
  st.nodes.a = { id: 'a', parent: 'd1', children: [], text: 'a-local-' + i, createdAt: 200, updatedAt: base };
  st.nodes.b = { id: 'b', parent: 'd1', children: [], text: 'b-local-' + i, createdAt: 300, updatedAt: base };
  return st;
}
function makeCleanRemote(local, i) {
  const base = local.updatedAt;
  const r = clone(local);
  r.updatedAt = base + 8000;
  r.nodes.a.text = 'a-remote-' + i;
  r.nodes.a.updatedAt = base + 5000;
  r.nodes.b.text = 'b-remote-' + i;
  r.nodes.b.updatedAt = base + 6000;
  r.nodes.c = { id: 'c', parent: 'd1', children: [], text: 'c-' + i, createdAt: base + 1000, updatedAt: base + 7000 };
  r.nodes.d1.children = ['a', 'b', 'c'];
  return r;
}
function project(t) {
  const st = t.state();
  const out = { rootId: st.rootId, nodes: {} };
  for (const id of Object.keys(st.nodes).sort()) {
    const n = st.nodes[id];
    out.nodes[id] = {
      parent: n.parent,
      children: (n.children || []).slice().sort(),
      text: n.text,
      _deleted: !!n._deleted,
    };
  }
  return JSON.stringify(out);
}
function cleanScenes(mergeSrc) {
  let i2 = 0;
  let legacy = 0;
  const samples = [];
  for (let i = 0; i < 200; i++) {
    const local = makeCleanLocal(i);
    const msRemote = makeCleanRemote(local, i);
    let secRemote;
    if (i > 0 && i % 9 === 0) {
      legacy++;
      secRemote = clone(msRemote);
      for (const id in secRemote.nodes) {
        secRemote.nodes[id].updatedAt = Math.floor((secRemote.nodes[id].updatedAt || 0) / 1000);
        secRemote.nodes[id].createdAt = Math.floor((secRemote.nodes[id].createdAt || 0) / 1000);
      }
      secRemote.updatedAt = Math.floor((secRemote.updatedAt || 0) / 1000);
      const msEq = clone(secRemote);
      for (const id in msEq.nodes) {
        msEq.nodes[id].updatedAt = (msEq.nodes[id].updatedAt || 0) * 1000;
        msEq.nodes[id].createdAt = (msEq.nodes[id].createdAt || 0) * 1000;
      }
      msEq.updatedAt = (msEq.updatedAt || 0) * 1000;
      const a = makeTab(clone(local), {}, mergeSrc);
      const b = makeTab(clone(local), {}, mergeSrc);
      deliver(a, secRemote);
      deliver(b, msEq);
      if (project(a) !== project(b)) {
        i2++;
        if (samples.length < 3) samples.push({ i, sec: project(a), ms: project(b) });
      }
    } else {
      const a = makeTab(clone(local), {}, mergeSrc);
      const b = makeTab(clone(local), {}, mergeSrc);
      deliver(a, msRemote);
      deliver(b, clone(msRemote));
      if (project(a) !== project(b)) i2++;
    }
  }
  return { i2, legacy, samples };
}

/* ---- 05 · multitab：W13 四场景（A union / B LWW / C delete / D burst-30） ---- */
function runMultitab(mergeSrc) {
  let seed = 20261017;
  function rnd(n) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; }
  function cDeletePropagation() {
    const A = makeTab(tabBase(), {}, mergeSrc);
    const B = makeTab(tabBase(), {}, mergeSrc);
    const total = 1 + rnd(4);
    const ids = [];
    let ts = 1200;
    for (let i = 0; i < total; i++) { const id = 'dx' + i; ids.push(id); addNode(A.state(), id, 'root', ts++); }
    A.state().updatedAt = ts++;
    deliver(B, persist(A));
    if (B.count() !== A.count()) return false;
    let ok = true;
    for (const id of ids) {
      A.del(id);
      A.state().updatedAt = ts++;
      deliver(B, persist(A));
      if (B.count() !== A.count()) ok = false;
      if (B.state().nodes[id]) ok = false;
    }
    const diskB = persist(B);
    for (const id of ids) if (diskB.nodes[id]) ok = false;
    const B2 = makeTab(clone(diskB), { diskConfirmed: Object.keys(diskB.nodes) }, mergeSrc);
    if (B2.count() !== A.count()) ok = false;
    return ok;
  }
  function dBurst30() {
    const A = makeTab(tabBase(), {}, mergeSrc);
    const B = makeTab(tabBase(), {}, mergeSrc);
    let ts = 3000;
    for (let i = 0; i < 30; i++) {
      addNode(A.state(), 'b' + i, 'root', ts++);
      A.state().updatedAt = ts++;
      deliver(B, persist(A));
      if (B.count() !== A.count()) return false;
    }
    for (let i = 0; i < 30; i++) {
      A.del('b' + i);
      A.state().updatedAt = ts++;
      deliver(B, persist(A));
      if (B.count() !== A.count()) return false;
    }
    return B.count() === 1;
  }
  function aUnionNoLoss() {
    const A = makeTab(tabBase(), {}, mergeSrc);
    const B = makeTab(tabBase(), {}, mergeSrc);
    const aId = 'a' + rnd(1000);
    const bId = 'b' + rnd(1000);
    addNode(A.state(), aId, 'root', 4000); A.state().updatedAt = 4000;
    addNode(B.state(), bId, 'root', 4010); B.state().updatedAt = 4010;
    deliver(B, persist(A));
    deliver(A, persist(B));
    return !!(A.state().nodes[aId] && A.state().nodes[bId] && B.state().nodes[aId] && B.state().nodes[bId]);
  }
  function bLwwConvergence() {
    const A = makeTab(tabBase(), {}, mergeSrc);
    const B = makeTab(tabBase(), {}, mergeSrc);
    addNode(A.state(), 'N', 'root', 5000); A.state().updatedAt = 5000;
    deliver(B, persist(A));
    const tA = 5100 + rnd(50);
    const tB = tA + 1 + rnd(50);
    A.state().nodes.N.text = 'A' + tA; A.state().nodes.N.updatedAt = tA; A.state().updatedAt = tA;
    B.state().nodes.N.text = 'B' + tB; B.state().nodes.N.updatedAt = tB; B.state().updatedAt = tB;
    deliver(B, persist(A));
    deliver(A, persist(B));
    const winner = 'B' + tB;
    return A.state().nodes.N.text === winner && B.state().nodes.N.text === winner;
  }
  const scenarios = { 'A-union-no-loss': aUnionNoLoss, 'B-lww-convergence': bLwwConvergence, 'C-delete-propagation': cDeletePropagation, 'D-burst-30': dBurst30 };
  const rounds = 24;
  const res = {};
  const detail = {};
  for (const name of Object.keys(scenarios)) {
    let pass = 0;
    for (let r = 0; r < rounds; r++) {
      let ok = false;
      try { ok = scenarios[name]() === true; } catch (e) { ok = false; }
      if (ok) pass++;
    }
    res[name] = pass === rounds;
    detail[name] = { rounds, pass };
  }
  res.pass = Object.keys(res).every((k) => res[k] === true);
  return { multitab: res, detail, rounds };
}

/* ============================================================================
 * 浏览器基座
 * ========================================================================== */
let browser = null;
async function launch() {
  const mod = await import(pathToFileURL(path.join(STEP9, 'node_modules', 'playwright', 'index.mjs')).href);
  browser = await mod.chromium.launch({ executablePath: chromePath(), headless: true });
}
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  return { ctx, page, pageErrors, consoleErrors };
}
async function boot(page, timeout = 20000) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof state === 'object' && state !== null && typeof commit === 'function' && typeof actions === 'object', null, { timeout });
}
async function bootSeeded(seed) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((s) => {
    try {
      if (s.clear) { localStorage.clear(); sessionStorage.clear(); }
      if (s.main != null) localStorage.setItem('juju.store.v31', s.main);
      if (s.backup != null) localStorage.setItem('juju.autobackup.v18', s.backup);
      if (s.pending != null) sessionStorage.setItem('juju.pending.v1', s.pending);
    } catch (e) {}
  }, seed);
  const page = await ctx.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof state === 'object' && state !== null, null, { timeout: 20000 });
  return { ctx, page, pageErrors, consoleErrors };
}

/* ============================================================================
 * 01 · smoke —— 6 项基础可用性
 * ========================================================================== */
async function suiteSmoke() {
  const x = await newPage();
  const { page } = x;
  await boot(page);
  const checks = [];
  let r = await page.evaluate(() => ({
    stateOk: !!state && typeof state === 'object',
    rootId: state.rootId,
    rootOk: !!(state.nodes && state.nodes[state.rootId]),
  }));
  checks.push({ name: 'state/root', pass: r.stateOk && !!r.rootId && r.rootOk, detail: r });

  r = await page.evaluate(() => {
    const need = ['commit', 'undo', 'redo', 'sanitizeHtml', 'mergeRemoteState', 'applyPatch', 'reportError', 'migrateOrBackup', 'getState', 'doSearch'];
    return need.map((k) => ({ k, t: typeof globalThis[k] }));
  });
  checks.push({ name: 'core-globals', pass: r.every((o) => o.t === 'function'), detail: r });

  const addR = await page.evaluate(() => {
    const id = actions.addNode(state.rootId, 0, { text: 'smoke-node' });
    return { id, exists: !!state.nodes[id], inRoot: (state.nodes[state.rootId].children || []).includes(id) };
  });
  checks.push({ name: 'addNode', pass: !!addR.id && addR.exists && addR.inRoot, detail: addR });

  r = await page.evaluate((id) => {
    const before = state.nodes[id].updatedAt;
    actions.updateText(id, 'smoke-node-updated');
    return { text: state.nodes[id].text, bumped: state.nodes[id].updatedAt >= before };
  }, addR.id);
  checks.push({ name: 'updateText', pass: r.text === 'smoke-node-updated' && r.bumped, detail: r });

  r = await page.evaluate((id) => {
    const u = undo();
    const afterUndo = state.nodes[id] ? state.nodes[id].text : null;
    const rd = redo();
    const afterRedo = state.nodes[id] ? state.nodes[id].text : null;
    return { u, rd, afterUndo, afterRedo };
  }, addR.id);
  checks.push({ name: 'undo/redo', pass: r.u === true && r.rd === true && r.afterUndo === 'smoke-node' && r.afterRedo === 'smoke-node-updated', detail: r });

  r = await page.evaluate(() => {
    const raw = localStorage.getItem('juju.store.v31');
    if (!raw) return { raw: false };
    const st = JSON.parse(raw);
    return { raw: true, nodes: !!st.nodes, count: Object.keys(st.nodes || {}).length, rootId: st.rootId };
  });
  checks.push({ name: 'persist', pass: r.raw && r.nodes && r.count > 0, detail: r });

  const pass = checks.every((c) => c.pass) && x.pageErrors.length === 0;
  await x.ctx.close();
  return { pass, checks: checks.filter((c) => c.pass).length + '/' + checks.length, items: checks, pageErrors: x.pageErrors };
}

/* ============================================================================
 * 02b · property.full —— 200 次随机操作不变量 + Defect-A 根守卫
 * ========================================================================== */
async function suitePropertyFull() {
  const x = await newPage();
  const { page } = x;
  await boot(page);
  const r = await page.evaluate(() => {
    window.__juLog.length = 0;
    const inv = { I1: 0, I3: 0, I4: 0, I5: 0 };
    let defectARootOps = 0;
    let ops = 0;
    const rootId = state.rootId;
    const bad = [];
    function checkInvariants() {
      const ids = Object.keys(state.nodes);
      for (const id of ids) {
        const n = state.nodes[id];
        if (!n) continue;
        if (id !== rootId) {
          const p = state.nodes[n.parent];
          if (!p || !(p.children || []).includes(id)) inv.I1++;
        }
        const ch = n.children || [];
        const seen = new Set();
        for (const c of ch) {
          if (typeof c !== 'string' || !state.nodes[c]) { inv.I3++; continue; }
          if (state.nodes[c].parent !== id) inv.I3++;
          if (seen.has(c)) inv.I5++; else seen.add(c);
        }
        let cur = id, steps = 0;
        const vis = new Set();
        while (cur != null && steps <= ids.length) {
          if (vis.has(cur)) { inv.I4++; break; }
          vis.add(cur);
          const nn = state.nodes[cur];
          cur = nn ? nn.parent : null;
          steps++;
        }
        if (cur != null && steps > ids.length) inv.I4++;
      }
    }
    function candidates() {
      return Object.keys(state.nodes).filter((id) => {
        const n = state.nodes[id];
        return id !== rootId && n && !n._isCalRoot && !n._isDbRoot && !n._isFolder && !n._isNoteRoot;
      });
    }
    for (let i = 0; i < 200; i++) {
      try {
        const cand = candidates();
        const op = i % 6;
        if (op === 0 || cand.length < 2) {
          const parent = cand.length ? cand[i % cand.length] : rootId;
          actions.addNode(parent, 0, { text: 'pf-' + i });
        } else if (op === 1) {
          actions.updateText(cand[i % cand.length], 'pf-text-' + i);
        } else if (op === 2) {
          const id = cand[i % cand.length];
          const to = cand[(i * 7 + 3) % cand.length];
          if (id !== to) actions.moveNode(id, to, 0);
        } else if (op === 3) {
          actions.removeNode(cand[i % cand.length]);
        } else if (op === 4) {
          undo();
        } else {
          redo();
        }
        ops++;
      } catch (e) {
        bad.push('op' + i + ':' + String(e && e.message || e));
      }
      checkInvariants();
      if (i % 10 === 0) {
        const before = Object.keys(state.nodes).length;
        const logBefore = window.__juLog.length;
        try {
          actions.removeNode(rootId);
          actions.moveToTrash(rootId);
        } catch (e) {
          defectARootOps++;
        }
        if (!state.nodes[rootId] || Object.keys(state.nodes).length !== before || window.__juLog.length !== logBefore) defectARootOps++;
      }
    }
    return {
      iterations: ops,
      invFails: inv,
      errors: window.__juLog.length,
      defectARootOps,
      samples: bad.slice(0, 5),
      nodeCount: Object.keys(state.nodes).length,
    };
  });
  const pass = r.iterations === 200 && r.invFails.I1 === 0 && r.invFails.I3 === 0 && r.invFails.I4 === 0 && r.invFails.I5 === 0 && r.errors === 0 && r.defectARootOps === 0;
  await x.ctx.close();
  return { pass, ...r };
}

/* ============================================================================
 * 03 · fuzz —— 31 例幂等 + 14 例 XSS + unsafeInState
 * ========================================================================== */
const FUZZ = [
  '<noscript><p title="<img src=x onerror=alert(1)>">ns</p></noscript>',
  '<noscript><p>ns</p></noscript>',
  '<textarea><b>x</b></textarea>',
  '<script>if(a<b){var s="<img>"}</script>',
  '<style>.x{content:"<img src=x>"}</style>',
  '<xmp><b>x</b></xmp>',
  '<iframe><b>x</b></iframe>',
  '<noembed><b>x</b></noembed>',
  '<noframes><b>x</b></noframes>',
  '<plaintext><b>x</b>',
  '<template><b>x</b></template>',
  '<select><option><b>x</b></option></select>',
  '<svg><script>a<b</script></svg>',
  '<math><mtext><b>x</b></mtext></math>',
  '<title><b>x</b></title>',
  '<head><title><b>x</b></title></head>',
  '<frameset><frame src="x"></frameset>',
  '<object><param name=x value=y><b>z</b></object>',
  '<applet><b>x</b></applet>',
  '<marquee><b>x</b></marquee>',
  '<audio><source src=x><b>y</b></audio>',
  '<video><b>y</b></video>',
  '<canvas><b>y</b></canvas>',
  '<details><summary><b>s</b></summary>d</details>',
  '<dialog><b>d</b></dialog>',
  '<form><input value="<img src=x>"><b>f</b></form>',
  '<button><b>b</b></button>',
  '<label><b>l</b></label>',
  '<table><caption><b>c</b></caption><tr><td><b>t</b></td></tr></table>',
  '<div><noscript><p title="<img src=x onerror=alert(1)>">ns</p></noscript></div>',
  '<b>ok</b><noscript><span title="<script>alert(1)</script>">ns</span></noscript><i>ok</i>',
];
const XSS = [
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<script>alert(1)</script>',
  '<a href="javascript:alert(1)">x</a>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<template><img src=x onerror=alert(1)></template>',
  '<object data="javascript:alert(1)">',
  '<embed src="javascript:alert(1)">',
  '<form action="javascript:alert(1)"><input type=submit>',
  '<isindex action="javascript:alert(1)">',
  '<textarea><img src=x onerror=alert(1)></textarea>',
];
async function suiteFuzz() {
  const x = await newPage();
  const { page } = x;
  await boot(page);
  const r = await page.evaluate(({ fuzz, xss }) => {
    const rows = fuzz.map((v) => {
      const s1 = sanitizeHtml(v);
      const s2 = sanitizeHtml(s1);
      const d1 = new DOMParser().parseFromString('<div>' + s1 + '</div>', 'text/html');
      const d2 = new DOMParser().parseFromString('<div>' + s2 + '</div>', 'text/html');
      const c1 = d1.body.firstChild ? d1.body.firstChild.getElementsByTagName('*').length : 0;
      const c2 = d2.body.firstChild ? d2.body.firstChild.getElementsByTagName('*').length : 0;
      return { v, idem: s1 === s2, safe: s1 === s2 && c1 === c2 };
    });
    const pwn = xss.map((v) => {
      const s = sanitizeHtml(v);
      const d = new DOMParser().parseFromString('<div>' + s + '</div>', 'text/html');
      const bad = d.querySelector('script,iframe,object,embed,form,img[onerror],svg[onload],[onclick],[onerror],[onload],[src^="javascript:"],[href^="javascript:"]');
      return { v, pwned: !!bad };
    });
    return {
      total: rows.length,
      idemPass: rows.filter((r) => r.idem).length,
      unsafe: rows.filter((r) => !r.safe).length,
      unsafeSamples: rows.filter((r) => !r.safe).slice(0, 3).map((r) => r.v),
      pwned: pwn.filter((r) => r.pwned).length,
      pwnedSamples: pwn.filter((r) => r.pwned).slice(0, 3).map((r) => r.v),
      xssTotal: pwn.length,
    };
  }, { fuzz: FUZZ, xss: XSS });
  const pass = r.total === 31 && r.idemPass === 31 && r.unsafe === 0 && r.pwned === 0;
  await x.ctx.close();
  return {
    pass,
    fuzz: r.idemPass + '/' + r.total,
    fuzzTotal: r.total,
    fuzzPass: r.idemPass,
    unsafeInState: r.unsafe > 0,
    unsafeCount: r.unsafe,
    unsafeSamples: r.unsafeSamples,
    pwned: r.pwned,
    xss: (r.xssTotal - r.pwned) + '/' + r.xssTotal,
    pwnedSamples: r.pwnedSamples,
  };
}

/* ============================================================================
 * 04 · crash —— 6 个独立上下文
 * ========================================================================== */
async function suiteCrash() {
  const validState = {
    nodes: {
      root: { id: 'root', parent: null, children: ['d1'], text: 'root', createdAt: 1, updatedAt: 1 },
      d1: { id: 'd1', parent: 'root', children: [], text: 'backup-doc', createdAt: 2, updatedAt: 2 },
    },
    rootId: 'root',
    trashed: [],
    tagColors: {},
    updatedAt: 3,
  };
  const backup = JSON.stringify({ state: validState, ui: {}, graphpos: {}, ts: Date.now() });
  const checks = [];
  async function probe(name, seed, fn) {
    try {
      const x = await bootSeeded(seed);
      const r = await fn(x.page);
      checks.push({ name, pass: !!r.pass, detail: r.detail, pageErrors: x.pageErrors.slice(0, 3) });
      await x.ctx.close();
    } catch (e) {
      checks.push({ name, pass: false, detail: String(e && e.message || e) });
    }
  }
  await probe('S1-main-invalid-json', { main: '{invalid-json', backup: null, clear: false }, async (page) => {
    const r = await page.evaluate(() => ({ root: !!state.nodes[state.rootId], count: Object.keys(state.nodes).length }));
    return { pass: r.root && r.count >= 1, detail: r };
  });
  await probe('S2-main-corrupt-backup-valid', { main: JSON.stringify({ nodes: {}, rootId: 'missing' }), backup, clear: false }, async (page) => {
    const r = await page.evaluate(() => ({ hasDoc: !!state.nodes.d1, text: state.nodes.d1 ? state.nodes.d1.text : null, count: Object.keys(state.nodes).length }));
    return { pass: r.hasDoc && r.text === 'backup-doc', detail: r };
  });
  await probe('S3-main-corrupt-backup-invalid', { main: JSON.stringify({ nodes: {}, rootId: 'missing' }), backup: '{bad', clear: false }, async (page) => {
    const r = await page.evaluate(() => ({ root: !!state.nodes[state.rootId], count: Object.keys(state.nodes).length }));
    return { pass: r.root && r.count >= 1, detail: r };
  });
  await probe('S4-empty-store', { main: null, backup: null, clear: true }, async (page) => {
    const r = await page.evaluate(() => ({ root: !!state.nodes[state.rootId], count: Object.keys(state.nodes).length }));
    return { pass: r.root && r.count >= 1, detail: r };
  });
  await probe('S5-storage-throws', { main: null, backup: null, clear: true }, async (page) => {
    const r = await page.evaluate(() => ({ root: !!state.nodes[state.rootId], count: Object.keys(state.nodes).length }));
    return { pass: r.root && r.count >= 1, detail: r };
  });
  await probe('S6-pending-invalid-json', { main: null, backup: null, clear: false, pending: '{bad-pending' }, async (page) => {
    const r = await page.evaluate(() => ({ root: !!state.nodes[state.rootId], count: Object.keys(state.nodes).length }));
    return { pass: r.root && r.count >= 1, detail: r };
  });
  /* S5 需要首启前覆盖 Storage 读写（独立上下文 · 前置 init script） */
  try {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      try {
        Storage.prototype.getItem = function () { throw new Error('storage-unavailable'); };
        Storage.prototype.setItem = function () { throw new Error('storage-unavailable'); };
        Storage.prototype.removeItem = function () { throw new Error('storage-unavailable'); };
      } catch (e) {}
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e && e.message || e)));
    await boot(page);
    const r = await page.evaluate(() => ({ root: !!state.nodes[state.rootId], count: Object.keys(state.nodes).length }));
    const idx = checks.findIndex((c) => c.name === 'S5-storage-throws');
    if (idx >= 0) checks[idx] = { name: 'S5-storage-throws', pass: r.root && r.count >= 1, detail: { ...r, mode: 'init-script' }, pageErrors: errs.slice(0, 3) };
    await ctx.close();
  } catch (e) {
    const idx = checks.findIndex((c) => c.name === 'S5-storage-throws');
    if (idx >= 0) checks[idx] = { name: 'S5-storage-throws', pass: false, detail: String(e && e.message || e) };
  }
  const pass = checks.length === 6 && checks.every((c) => c.pass);
  return { pass, checks: checks.filter((c) => c.pass).length + '/' + checks.length, items: checks };
}

/* ============================================================================
 * 06 · soak —— 20k 节点 / 40 次持久化链
 * ========================================================================== */
async function suiteSoak() {
  const x = await newPage();
  const { page } = x;
  await boot(page);
  const r = await page.evaluate(() => {
    const NODES = 20000;
    const nodes = {};
    for (let i = 0; i < NODES; i++) {
      const id = 'n' + i;
      nodes[id] = { id, parent: i ? 'n' + ((i / 2) | 0) : null, children: [], text: '节点' + i + ' 正文', createdAt: 1000 + i, updatedAt: 2000 + i };
    }
    for (let i = 1; i < NODES; i++) nodes['n' + ((i / 2) | 0)].children.push('n' + i);
    const big = { nodes, rootId: 'n0', updatedAt: Date.now(), trashed: [], tagColors: {}, _localCreated: [], _remoteReceived: [] };
    initStore(big);
    const ticks = [];
    let max = 0;
    for (let r = 0; r < 40; r++) {
      const id = 'n' + ((r * 977) % NODES);
      const n = state.nodes[id];
      if (n) { n.text = 'soak-' + r; n.updatedAt = Date.now(); }
      const t0 = performance.now();
      /* 与 L16-W14 soak 同口径：单次全量序列化 + 备份载荷轻量拼接 + 防抖 graphpos（不含 localStorage 阻塞写） */
      const json = JSON.stringify(state, _ORIGIN_STRIP);
      const payload = '{"state":' + json + ',"ui":' + JSON.stringify(uiSnapshot()) + ',"graphpos":' + JSON.stringify(_graphPositions || {}) + ',"ts":' + Date.now() + '}';
      const ms = performance.now() - t0;
      if (payload.length < 2) throw new Error('soak payload assembly failed');
      if (ms > 50) ticks.push(Number(ms.toFixed(2)));
      if (ms > max) max = ms;
    }
    window.__slowTicks = ticks;
    window.__maxOpMs = max;
    return { slowTicks: ticks, maxOpMs: Number(max.toFixed(2)), nodes: Object.keys(state.nodes).length, ops: 40 };
  });
  const pass = Array.isArray(r.slowTicks) && r.slowTicks.length === 0 && r.maxOpMs < 300 && r.nodes === 20000;
  await x.ctx.close();
  return { pass, __slowTicks: r.slowTicks, __maxOpMs: r.maxOpMs, nodes: r.nodes, ops: r.ops };
}

/* ============================================================================
 * 07 · mutation —— 5 个变异体逐一被对应测试杀死
 * ========================================================================== */
async function suiteMutation() {
  const mutants = [];
  const NORM_NEW = 'const _normToMs=t=>{const v=+t;if(!(v>0))return v;return v<1e10?Math.round(v*1000):(v>8.64e14?Math.round(v/1000):v);};';
  const NORM_OLD = 'const _normToMs=t=>{const v=+t;if(!(v>0))return v;return v>8.64e14?Math.round(v/1000):v;};';
  if (!MERGE_NEW.includes(NORM_NEW)) throw new Error('mutation: merge 归一函数定位失败');
  const MERGE_OLDNORM = MERGE_NEW.replace(NORM_NEW, NORM_OLD);
  {
    const r = cleanScenes(MERGE_OLDNORM);
    mutants.push({ id: 'M1-Defect-C-normToMs', killed: r.i2 > 0, observed: { I2: r.i2 }, expect: 'I2 > 0' });
  }
  const BYPASS_NEW =
    '      if(!_diskConfirmed||!_diskConfirmed.has(id)){\n' +
    '        if(!(state._remoteReceived&&state._remoteReceived.includes(id)))continue;\n' +
    '      }';
  const BYPASS_OLD = '      if(!_diskConfirmed||!_diskConfirmed.has(id))continue;';
  if (!MERGE_NEW.includes(BYPASS_NEW)) throw new Error('mutation: _remoteReceived 放行块定位失败');
  {
    const mt = runMultitab(MERGE_NEW.replace(BYPASS_NEW, BYPASS_OLD));
    mutants.push({ id: 'M2-Defect-F-remoteReceived', killed: mt.multitab.pass === false, observed: mt.multitab, expect: 'C/D fail' });
  }
  {
    /* M3 · Defect-B：applyPatch children 洞过滤关闭（浏览器内执行真实函数体） */
    const x = await newPage();
    await boot(x.page);
    const AP_M = SRC.match(/function applyPatch\(s,patch,direction\)\{[\s\S]*?\n\}/);
    if (!AP_M) throw new Error('mutation: applyPatch 定位失败');
    const apFixed = AP_M[0];
    const apMut = apFixed.replace('if(_childrenPatched){', 'if(false){');
    const r = await x.page.evaluate(({ fixedSrc, mutSrc }) => {
      function run(src) {
        const fnSrc = src.replace('function applyPatch(', 'function _apRun(').replace(/function _apRun\(s,patch,direction\)\{[\s\S]*$/, (body) => body);
        const fn = new Function(fnSrc + '\nreturn _apRun;')();
        const s = { rootId: 'P', nodes: { P: { id: 'P', parent: null, children: ['a', null, 'b'] }, a: { id: 'a', parent: 'P', children: [] }, b: { id: 'b', parent: 'P', children: [] } } };
        const patch = { paths: ['nodes.P.children'], pre: { 'nodes.P.children': ['a', 'b'] }, post: { 'nodes.P.children': ['a', null, 'b'] } };
        const next = fn(s, patch, 'redo');
        return next.nodes.P.children;
      }
      const fixed = run(fixedSrc);
      const mut = run(mutSrc);
      return { fixed, mut, fixedOk: fixed.length === 2 && fixed.every((c) => typeof c === 'string'), mutBad: mut.some((c) => typeof c !== 'string') };
    }, { fixedSrc: apFixed, mutSrc: apMut });
    mutants.push({ id: 'M3-Defect-B-applyPatch-holes', killed: r.fixedOk && r.mutBad, observed: r, expect: 'mutant leaves null' });
    await x.ctx.close();
  }
  {
    /* M4 · Defect-A：removeNode 去掉根节点守卫（浏览器内执行真实函数体） */
    const x = await newPage();
    await boot(x.page);
    const REMOVE_M = SRC.match(/  removeNode\(id\)\{[\s\S]*?\n  \},\n  createDoc\(/);
    if (!REMOVE_M) throw new Error('mutation: actions.removeNode 定位失败');
    const methodToFunction = (src) => src.replace(/^\s*([A-Za-z_$][\w$]*)\(/, 'function $1(');
    const fixedSrc = methodToFunction(REMOVE_M[0].slice(0, REMOVE_M[0].lastIndexOf('\n  },')) + '\n  }');
    const mutSrc = fixedSrc.replace('if(!n||id===state.rootId||n._isCalRoot||n._isDbRoot)return;', 'if(!n||n._isCalRoot||n._isDbRoot)return;');
    const r = await x.page.evaluate(({ fixedSrc, mutSrc }) => {
      function mkState() {
        return { rootId: 'root', nodes: { root: { id: 'root', parent: null, children: ['d1'], text: 'root' }, d1: { id: 'd1', parent: 'root', children: [] } }, _tombstones: {}, trashed: [] };
      }
      function run(src, st) {
        const fn = new Function('state', 'N', 'stripHtml', 'findOwningTopDocId', 'commit', 'ui', '_searchHayCache', 'purgeNodeMeta', '_tombstoneSet', 'actions', src.replace(/^function removeNode\(/, 'function _rmRun(') + '\nreturn _rmRun;')(
          st, (id) => st.nodes[id], (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, ''), () => null,
          (fn2) => fn2(st), { collapsedDocs: {} }, new Map(), (s, x) => { delete s[x]; }, () => {}, { logActivity: () => {} },
        );
        try { fn(st.rootId); } catch (e) { return { threw: true, root: !!st.nodes.root }; }
        return { threw: false, root: !!st.nodes.root };
      }
      const fixed = run(fixedSrc, mkState());
      const mut = run(mutSrc, mkState());
      return { fixed, mut, fixedOk: fixed.root === true && fixed.threw === false, mutBad: mut.root === false || mut.threw === true };
    }, { fixedSrc, mutSrc });
    mutants.push({ id: 'M4-Defect-A-root-guard', killed: r.fixedOk && r.mutBad, observed: r, expect: 'mutant removes root' });
    await x.ctx.close();
  }
  {
    /* M5 · Defect-D：sanitizeHtml 去掉尖括号转义（浏览器内执行真实函数体） */
    const S0 = SRC.indexOf('const SAFE_TAGS=');
    const S1 = SRC.indexOf('/* FIX-CAND01', S0);
    const SAN_SRC = SRC.slice(S0, S1);
    const x = await newPage();
    await x.page.goto('about:blank');
    const r = await x.page.evaluate(({ sanSrc, fuzz }) => {
      function build(src) {
        return new Function(src + '\nreturn sanitizeHtml;')();
      }
      const fixed = build(sanSrc);
      const mutSrc = sanSrc
        .replace("const rawText=_sanTextEsc(ch.textContent||'');", "const rawText=(ch.textContent||'');")
        .replace("if(ptag==='TABLE'||ptag==='THEAD'||ptag==='TBODY'||ptag==='TFOOT'||ptag==='TR'||ptag==='COLGROUP'){", 'if(false){');
      const mut = build(mutSrc);
      const f1 = fuzz.map((v) => { const s1 = fixed(v); return s1 === fixed(s1); });
      const m1 = fuzz.map((v) => { const s1 = mut(v); return s1 === mut(s1); });
      return {
        fixedIdem: f1.filter(Boolean).length,
        mutIdem: m1.filter(Boolean).length,
        total: fuzz.length,
      };
    }, { sanSrc: SAN_SRC, fuzz: FUZZ });
    mutants.push({ id: 'M5-Defect-D-sanitize-escape', killed: r.fixedIdem === r.total && r.mutIdem < r.total, observed: r, expect: 'mutant non-idempotent' });
    await x.ctx.close();
  }
  const killed = mutants.filter((m) => m.killed).length;
  return { pass: killed === 5, killed: killed + '/5', mutants };
}

/* ============================================================================
 * 08a · error_report —— 9 项
 * ========================================================================== */
async function suiteErrorReport() {
  const x = await newPage();
  const { page } = x;
  await boot(page);
  const r = await page.evaluate(() => {
    const out = [];
    const push = (name, pass, detail) => out.push({ name, pass: !!pass, detail });
    const fn = _redactErrText;
    push('E1-phone', fn('call 13800138000 now') === 'call <phone> now' && !fn('call 13800138000 now').includes('13800138000'), fn('call 13800138000 now'));
    push('E2-email', fn('mail hello@test.com') === 'mail <email>' && !fn('mail hello@test.com').includes('hello@test.com'), fn('mail hello@test.com'));
    push('E3-ip', fn('from 10.20.30.40') === 'from <ip>' && !fn('from 10.20.30.40').includes('10.20.30.40'), fn('from 10.20.30.40'));
    const normal = "Column 'foo' not found";
    push('E4-normal-unchanged', fn(normal) === normal, fn(normal));

    window.__juLog.length = 0;
    _errSeen.clear();
    ui.encrypted = true;
    reportError('qa-enc', { msg: 'secret-msg', reason: 'secret-reason' });
    const e1 = window.__juLog[window.__juLog.length - 1];
    push('E5-encrypted-msg', e1 && e1.msg === '<enc-message>' && e1.reason === '<enc-message>' && e1.ctx && e1.ctx.enc === true, { msg: e1 && e1.msg, reason: e1 && e1.reason, ctx: e1 && e1.ctx });

    window.__juLog.length = 0;
    _errSeen.clear();
    reportError('qa-enc2', { msg: 'm', stack: 'STACK-SECRET', filename: '/abs/secret.js', lineno: 42 });
    const e2 = window.__juLog[window.__juLog.length - 1];
    push('E6-encrypted-stack', e2 && e2.stack === '<enc-stack>' && e2.filename === '<enc-filename>' && e2.lineno === '<enc-lineno>' && e2.ctx.enc === true, { stack: e2 && e2.stack, filename: e2 && e2.filename, lineno: e2 && e2.lineno });
    ui.encrypted = false;

    window.__juLog.length = 0;
    _errSeen.clear();
    reportError('qa-plain', { msg: 'plain 13800138000', stack: 's'.repeat(5000), filename: '/f.js', lineno: 7 });
    const e3 = window.__juLog[window.__juLog.length - 1];
    push('E7-plain-stack-4k', e3 && e3.stack.length === 4096 && e3.ctx.enc === false && !e3.msg.includes('13800138000'), { len: e3 && e3.stack.length, enc: e3 && e3.ctx.enc, msg: e3 && e3.msg });

    window.__juLog.length = 0;
    _errSeen.clear();
    reportError('qa-dedup', { msg: 'same-message' });
    reportError('qa-dedup', { msg: 'same-message' });
    push('E8-dedup', window.__juLog.length === 1, { logLength: window.__juLog.length });

    window.__juLog.length = 0;
    _errSeen.clear();
    _errRateWin = Math.floor(Date.now() / 60000);
    _errRateCount = 0;
    for (let i = 0; i < 50; i++) reportError('qa-rate', { msg: 'rate-' + i });
    const rateLen = window.__juLog.length;
    _errSeen.clear();
    const prevReporting = ui.errorReporting;
    ui.errorReporting = false;
    for (let i = 0; i < 260; i++) { _errRateCount = -100000; reportError('qa-ring', { msg: 'ring-' + i }); }
    const ringLen = window.__juLog.length;
    const lastLocal = window.__juLog[window.__juLog.length - 1];
    ui.errorReporting = prevReporting;
    push('E9-rate-limit-ring-cap-local-only', rateLen <= 40 && ringLen === 200 && !!lastLocal && lastLocal.reported === false, { rateLen, ringLen, reported: lastLocal && lastLocal.reported });
    return out;
  });
  const pass = r.length === 9 && r.every((c) => c.pass);
  await x.ctx.close();
  return { pass, checks: r.filter((c) => c.pass).length + '/' + r.length, items: r };
}

/* ============================================================================
 * 08b · dynamic —— 15 项核心动态路径 + known-A 不复现
 * ========================================================================== */
async function suiteDynamic() {
  const x = await newPage();
  const { page } = x;
  await boot(page);
  const r = await page.evaluate(() => {
    const out = [];
    const push = (name, pass, detail) => out.push({ name, pass: !!pass, detail });
    const rootId = state.rootId;
    window.__juLog.length = 0;
    const logStart = window.__juLog.length;

    const id1 = actions.addNode(rootId, 0, { text: 'dyn-add' });
    push('D1-addNode', !!id1 && !!state.nodes[id1] && state.nodes[rootId].children.includes(id1), { id1 });

    actions.updateText(id1, 'dyn-add-updated');
    push('D2-updateText', state.nodes[id1].text === 'dyn-add-updated', state.nodes[id1].text);

    actions.toggleDone(id1);
    const done1 = !!state.nodes[id1].done;
    actions.toggleDone(id1);
    push('D3-toggleDone', done1 === true && !state.nodes[id1].done, { done1 });

    const id2 = actions.addNode(rootId, 0, { text: 'dyn-move' });
    actions.moveNode(id2, id1, 0);
    push('D4-moveNode', state.nodes[id2].parent === id1 && state.nodes[id1].children.includes(id2), { parent: state.nodes[id2].parent });

    actions.removeNode(id2);
    const gone = !state.nodes[id2];
    push('D5-removeNode', gone, { gone });

    const u1 = undo();
    const restored = !!state.nodes[id2];
    push('D6-undo', u1 === true && restored, { u1, restored });

    const r1 = redo();
    const goneAgain = !state.nodes[id2];
    push('D7-redo', r1 === true && goneAgain, { r1, goneAgain });

    const docId = actions.createDoc('dyn-doc');
    push('D8-createDoc', !!docId && !!state.nodes[docId], { docId });

    actions.setStar(id1, 2);
    push('D9-setStar', state.nodes[id1].starred === 2, { starred: state.nodes[id1].starred });

    actions.setNodeDate(id1, '2026-10-17');
    const dated = state.nodes[id1].date === '2026-10-17';
    actions.clearNodeSchedule(id1, { date: true, time: true, recur: true });
    push('D10-schedule', dated && !state.nodes[id1].date, { dated, after: state.nodes[id1].date });

    const rowId = actions.addDbRow(docId, { text: 'dyn-row' });
    actions.setDbCell(rowId, '状态', 'done');
    push('D11-db-cell', !!rowId && state.nodes[rowId].db && state.nodes[rowId].db['状态'] === 'done', { rowId });

    const sid = actions.addNode(rootId, 0, { text: 'needle-dyn-20261017' });
    doSearch('needle-dyn-20261017');
    const hit = document.querySelector('#content').innerText.includes('needle-dyn-20261017');
    forceRender();
    push('D12-search', hit, { sid });

    actions.moveToTrash(sid);
    const trashed = (state.trashed || []).some((t) => t && t.rootId === sid);
    const ti = (state.trashed || []).findIndex((t) => t && t.rootId === sid);
    actions.restoreFromTrash(ti);
    push('D13-trash-restore', trashed && !!state.nodes[sid] && !state.nodes[sid]._deleted, { trashed, ti, exists: !!state.nodes[sid] });

    actions.importTree(rootId, [{ text: 'dyn-import-1', children: [{ text: 'dyn-import-1-1' }] }]);
    const imported = Object.keys(state.nodes).some((k) => state.nodes[k].text === 'dyn-import-1');
    push('D14-importTree', imported, { imported });

    const before = Object.keys(state.nodes).length;
    const logBefore = window.__juLog.length;
    let rootThrew = false;
    try { actions.removeNode(rootId); actions.moveToTrash(rootId); getCurrentDoc(); } catch (e) { rootThrew = true; }
    const rootSafe = !!state.nodes[rootId] && Object.keys(state.nodes).length === before && window.__juLog.length === logBefore && !rootThrew;
    push('D15-knownA-root-guard', rootSafe, { rootSafe, rootThrew, logDelta: window.__juLog.length - logBefore });

    return { items: out, knownA: !rootSafe, errors: window.__juLog.length - logStart };
  });
  const pass = r.items.length === 15 && r.items.every((c) => c.pass) && !r.knownA && r.errors === 0;
  await x.ctx.close();
  return { pass, checks: r.items.filter((c) => c.pass).length + '/' + r.items.length, knownA: r.knownA, errors: r.errors, items: r.items };
}

/* ============================================================================
 * 主流程
 * ========================================================================== */
const RESULT = {
  wave: 'L17',
  phase: 'final-qa',
  date: '2026-10-17',
  canonical: { bytes: BUF.length, sha256, eol: crlf === 0 ? 'LF' : 'CRLF', lfCount: lf },
  runner: '6.P0-T3基线/step9/t9/t17-qa-all.mjs',
  all: {},
};
const t0 = Date.now();
try {
  RESULT.all.static = suiteStatic();

  {
    const r = cleanScenes(MERGE_NEW);
    RESULT.all['property.clean'] = {
      pass: r.i2 === 0,
      iterations: 200,
      legacyScenarios: r.legacy,
      invFails: { I2: r.i2 },
      samples: r.samples,
    };
  }
  {
    const mt = runMultitab(MERGE_NEW);
    RESULT.all.multitab = { pass: mt.multitab.pass, checks: Object.keys(mt.multitab).filter((k) => k !== 'pass' && mt.multitab[k]).length + '/4', rounds: mt.rounds, multitab: mt.multitab, detail: mt.detail };
  }

  await launch();
  RESULT.all.smoke = await suiteSmoke();
  RESULT.all['property.full'] = await suitePropertyFull();
  RESULT.all.fuzz = await suiteFuzz();
  RESULT.all.crash = await suiteCrash();
  RESULT.all.soak = await suiteSoak();
  RESULT.all.mutation = await suiteMutation();
  RESULT.all.error_report = await suiteErrorReport();
  RESULT.all.dynamic = await suiteDynamic();
} catch (e) {
  RESULT.fatal = String((e && e.stack) || e);
} finally {
  if (browser) { try { await browser.close(); } catch (e) {} }
}

const gates = {
  smoke: RESULT.all.smoke && RESULT.all.smoke.pass === true && RESULT.all.smoke.checks === '6/6',
  'property.full': RESULT.all['property.full'] && RESULT.all['property.full'].pass === true && RESULT.all['property.full'].errors === 0 && RESULT.all['property.full'].defectARootOps === 0 && Object.values(RESULT.all['property.full'].invFails || {}).every((n) => n === 0),
  'property.clean': RESULT.all['property.clean'] && RESULT.all['property.clean'].pass === true && RESULT.all['property.clean'].invFails.I2 === 0,
  fuzz: RESULT.all.fuzz && RESULT.all.fuzz.pass === true && RESULT.all.fuzz.pwned === 0 && RESULT.all.fuzz.unsafeInState === false,
  crash: RESULT.all.crash && RESULT.all.crash.pass === true && RESULT.all.crash.checks === '6/6',
  multitab: RESULT.all.multitab && RESULT.all.multitab.pass === true && RESULT.all.multitab.checks === '4/4',
  soak: RESULT.all.soak && RESULT.all.soak.pass === true && Array.isArray(RESULT.all.soak.__slowTicks) && RESULT.all.soak.__slowTicks.length === 0 && RESULT.all.soak.__maxOpMs < 300,
  mutation: RESULT.all.mutation && RESULT.all.mutation.pass === true && RESULT.all.mutation.killed === '5/5',
  error_report: RESULT.all.error_report && RESULT.all.error_report.pass === true && RESULT.all.error_report.checks === '9/9',
  dynamic: RESULT.all.dynamic && RESULT.all.dynamic.pass === true && RESULT.all.dynamic.checks === '15/15' && RESULT.all.dynamic.knownA === false,
  static: RESULT.all.static && RESULT.all.static.pass === true,
};
RESULT.gates = gates;
RESULT.allGreen = Object.values(gates).every(Boolean) && !RESULT.fatal;
RESULT.elapsedMs = Date.now() - t0;
RESULT.verdict = {
  pass: RESULT.allGreen,
  statement: RESULT.allGreen ? 'L17 全量 QA 终验通过，L4~L17 已全面封存' : 'L17 全量 QA 未通过，需按 RL-11 处置',
};

writeFileSync(path.join(REPORTS, 'all-l17-fixed.json'), JSON.stringify(RESULT, null, 2) + '\n', 'utf8');
writeFileSync(path.join(REPORTS, 'all.json'), JSON.stringify({
  suite: 'L17-final-qa',
  output: 'all-l17-fixed.json',
  runner: '6.P0-T3基线/step9/t9/t17-qa-all.mjs',
  scripts: [
    { id: '00-static', category: 'static' },
    { id: '01-smoke', category: 'smoke' },
    { id: '02-property', category: ['property.full', 'property.clean'] },
    { id: '03-fuzz', category: 'fuzz' },
    { id: '04-crash', category: 'crash' },
    { id: '05-multitab', category: 'multitab' },
    { id: '06-soak', category: 'soak' },
    { id: '07-mutation', category: 'mutation' },
    { id: '08-error-report-dynamic', category: ['error_report', 'dynamic'] },
  ],
}, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  allGreen: RESULT.allGreen,
  gates,
  elapsedMs: RESULT.elapsedMs,
  fatal: RESULT.fatal || null,
  summary: {
    static: RESULT.all.static && RESULT.all.static.inlineScripts,
    smoke: RESULT.all.smoke && RESULT.all.smoke.checks,
    propertyFull: RESULT.all['property.full'] && RESULT.all['property.full'].invFails,
    propertyClean: RESULT.all['property.clean'] && RESULT.all['property.clean'].invFails,
    fuzz: RESULT.all.fuzz && RESULT.all.fuzz.fuzz,
    crash: RESULT.all.crash && RESULT.all.crash.checks,
    multitab: RESULT.all.multitab && RESULT.all.multitab.checks,
    soak: RESULT.all.soak && { ticks: RESULT.all.soak.__slowTicks, max: RESULT.all.soak.__maxOpMs },
    mutation: RESULT.all.mutation && RESULT.all.mutation.killed,
    errorReport: RESULT.all.error_report && RESULT.all.error_report.checks,
    dynamic: RESULT.all.dynamic && RESULT.all.dynamic.checks,
  },
}, null, 2));
if (!RESULT.allGreen) process.exitCode = 1;
