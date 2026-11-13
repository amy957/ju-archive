/**
 * L16-W14 · 缺陷修复指令 5「持久化链异步化（Defect-G）」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义（Defect-G · Soak 报 __slowTicks 最高 19.5s 冻结；桩掉 persistNow / saveAutoBackup /
 * saveGraphPositions 后 0 慢操作）：
 *   1. saveAutoBackup 每次落盘都 clone(cur) + JSON.stringify(payload)（与主存储串重复的全量序列化）；
 *   2. saveGraphPositions 在每次图拖拽结束同步 JSON.stringify + localStorage.setItem（高频小卡顿）；
 *   3. runPersist 的桌面 patch 通道 ack 成功后再 JSON.stringify(getState(),_ORIGIN_STRIP) 做指纹同步
 *      （本轮第三次全量序列化）。
 * 本波改动（L16-W14）：
 *   A. saveAutoBackup(force,stateJson)：接收 runPersist / flushPersistNow 本轮已生成的落盘串，
 *      以轻量拼接生成 {state,ui,graphpos,ts}（字段名 / 键序不变），免除 clone 与二次 stringify；
 *      未传串（关页 backupOnClose / 周期备份）→ 原口径（clone + stringify），逐字节等价；
 *   B. saveGraphPositions：300ms 防抖（_graphPosTimer），flushGraphPositions() 执行实际写入并顺带
 *      scheduleDesktopSave()；pagehide / beforeunload 强制 flush；
 *   C. l8PersistSendBatches 成功后：_revSubstJson(json, ack 前 rev, ack 后 rev) 复用本轮全量串，
 *      不可判定时降级为全量重序列化（与 L16-W1 同口径）。
 * 断言口径（确定性 · 承接 L16-W1 / W13 范式）：
 *   A. 结构锚点（canonical 文本 · 旧同步写法已消除）。
 *   B. 载荷等价（真实 saveAutoBackup 函数体逐字执行）：键序 / state 内容 / 降级路径逐字节一致。
 *   C. 防抖语义（真实函数体 + 确定性假定时器）：窗口内合并、flush 幂等、pagehide 已注册。
 *   D. patch ack 指纹复用：与全量重序列化逐字节一致 + 降级兜底。
 *   E. 大 state（20,000 节点）载荷构造 P95 采样（拼接路径 vs 旧 clone+stringify 路径）。
 * 运行：`node --test l9/t16-w14-persist-chain-async.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const CANONICAL = path.resolve(STEP9, '..', 'canonical', 'v2.0-t3.html');
const SRC = readFileSync(CANONICAL, 'utf8');

/* ---------- 1) 提取真实产品实现 ---------- */
const AB0 = SRC.indexOf('function saveAutoBackup(force,stateJson){');
const AB1 = SRC.indexOf('/* FIX-ENC-BACKUP-1:', AB0);
assert.ok(AB0 > 0 && AB1 > AB0, 'canonical 缺 saveAutoBackup(force,stateJson) 段');
const AUTOBACKUP_SRC = SRC.slice(AB0, AB1);

const GP0 = SRC.indexOf('let _graphPosTimer=null;');
const GP1 = SRC.indexOf('function purgeNodeMeta(s,id){', GP0);
assert.ok(GP0 > 0 && GP1 > GP0, 'canonical 缺 saveGraphPositions 防抖段');
const GRAPHPOS_SRC = SRC.slice(GP0, GP1);

const STRIP_M = SRC.match(/const _ORIGIN_STRIP=(\(k,v\)=>k==='_origin'\?undefined:v);/);
const SUBST_M = SRC.match(/function _revSubstJson\([\s\S]*?\n\}/);
assert.ok(STRIP_M && SUBST_M, 'canonical 缺 _ORIGIN_STRIP / _revSubstJson');
const { _ORIGIN_STRIP, _revSubstJson } = new Function(
  [STRIP_M[0], SUBST_M[0], 'return { _ORIGIN_STRIP, _revSubstJson };'].join('\n'),
)();

/* ---------- 2) saveAutoBackup 最小作用域装配（函数体逐字执行） ---------- */
function makeBackupEnv(stateObj, graphpos, opts) {
  opts = opts || {};
  const writes = [];
  const body = `
    const AUTO_BACKUP_KEY='juju.autobackup.v18';
    const STORE_KEY='juju.store.v31';
    const IS_DESKTOP=false;
    let ui={locked:false,encrypted:false};
    let _lastAutoBackupTs=(opts.lastTs||0);
    let _graphPositions=graphpos;
    const clone=(o)=>JSON.parse(JSON.stringify(o));
    function uiSnapshot(){return {theme:'day',scale:1,uiVersion:3};}
    function toast(){}
    function reportError(){}
    function errMsg(e){return (e&&e.message)?e.message:String(e);}
    function saveEncryptedAutoBackup(){}
    function getState(){return state;}
    const localStorage={
      setItem(k,v){writes.push([k,String(v)]);},
      getItem(k){(opts.mainLen||0)>0&&k===STORE_KEY?null:null;return opts.mainLen?'x'.repeat(opts.mainLen):null;},
      removeItem(){},
    };
    ${AUTOBACKUP_SRC}
    return { save:saveAutoBackup, writes, ts:()=>({_lastAutoBackupTs}) };
  `;
  const factory = new Function('state', 'graphpos', 'opts', 'writes', body);
  const env = factory(stateObj, graphpos, opts, writes);
  return env;
}

function buildState(n) {
  const nodes = {};
  for (let i = 0; i < n; i++) {
    const id = 'n' + i;
    nodes[id] = {
      id,
      parent: i ? 'n' + ((i / 2) | 0) : null,
      children: i ? [] : ['n1'],
      text: '节点' + i + ' "\\ #tag',
      createdAt: 1000 + i,
      updatedAt: 2000 + i,
      _origin: i % 3 ? 'remote' : 'local',
    };
  }
  return { nodes, rootId: 'n0', updatedAt: 1700000000000, _rev: 7, _localCreated: [], _remoteReceived: [] };
}

/* ---------- 3) saveGraphPositions 最小作用域装配（确定性假定时器） ---------- */
function makeGraphEnv(positions) {
  const timers = new Map();
  let seq = 0;
  const writes = [];
  const listeners = [];
  const setTimeoutFake = (fn, ms) => {
    const id = ++seq;
    timers.set(id, { fn, ms });
    return id;
  };
  const clearTimeoutFake = (id) => timers.delete(id);
  const runTimers = () => {
    const due = Array.from(timers.entries());
    timers.clear();
    for (const [, t] of due) t.fn();
  };
  const factory = new Function(
    'positions',
    'setTimeout',
    'clearTimeout',
    'writes',
    'listeners',
    `
    let _graphPositions=positions;
    const IS_DESKTOP=false;
    const localStorage={setItem(k,v){writes.push([k,String(v)]);}};
    function scheduleDesktopSave(){}
    const window={addEventListener(ev,fn){listeners.push([ev,fn]);}};
    ${GRAPHPOS_SRC}
    return { save:saveGraphPositions, flush:flushGraphPositions, pending:()=>_graphPosTimer,
             positions:()=>_graphPositions, writes, listeners };
    `,
  );
  const env = factory(positions, setTimeoutFake, clearTimeoutFake, writes, listeners);
  env.runTimers = runTimers;
  env.timerCount = () => timers.size;
  return env;
}

/* ---------- 4) 结构锚点 ---------- */
describe('L16-W14 §A 结构锚点（canonical 文本）', () => {
  test('A1: saveGraphPositions 防抖 + flushGraphPositions + pagehide 注册', () => {
    assert.ok(GRAPHPOS_SRC.includes('let _graphPosTimer=null;'), '缺 _graphPosTimer');
    assert.ok(GRAPHPOS_SRC.includes('_graphPosTimer=setTimeout(flushGraphPositions,300);'), '缺 300ms 防抖');
    assert.ok(GRAPHPOS_SRC.includes('function flushGraphPositions(){'), '缺 flushGraphPositions');
    assert.ok(GRAPHPOS_SRC.includes("window.addEventListener('pagehide',flushGraphPositions)"), '缺 pagehide flush');
    assert.ok(!GRAPHPOS_SRC.includes("function saveGraphPositions(){\n  try{localStorage.setItem('juju.graphpos'"), '旧同步写入仍在');
  });

  test('A2: beforeunload 路径（flushBeforeUnload）强制 flush', () => {
    assert.ok(SRC.includes('try{flushGraphPositions();}catch(e){}'), '缺关页 flush 调用');
    const F0 = SRC.indexOf('function flushBeforeUnload(){');
    const F1 = SRC.indexOf('\n  }', SRC.indexOf('backupOnClose();', F0));
    const body = SRC.slice(F0, F1);
    assert.ok(body.includes('flushGraphPositions()'), 'flushBeforeUnload 未调用 flushGraphPositions');
    assert.ok(body.indexOf('flushPersistNow()') < body.indexOf('flushGraphPositions()'), 'flush 顺序异常');
  });

  test('A3: saveAutoBackup 复用落盘串（拼接 + 降级分支保留）', () => {
    assert.ok(!SRC.includes('function saveAutoBackup(force){'), '旧签名仍在');
    assert.ok(AUTOBACKUP_SRC.includes("out='{\"state\":'+stateJson+',\"ui\":'+JSON.stringify(uiSnapshot())"), '缺轻量拼接');
    assert.ok(AUTOBACKUP_SRC.includes('stateJson.charCodeAt(0)===123'), '缺首字符判定');
    assert.ok(AUTOBACKUP_SRC.includes('const payload={state:clone(cur),ui:uiSnapshot(),graphpos:clone(_graphPositions||{}),ts:now};'), '缺降级分支');
    assert.ok(AUTOBACKUP_SRC.includes('localStorage.setItem(AUTO_BACKUP_KEY,out);'), '缺写入 out');
  });

  test('A4: runPersist / flushPersistNow 均传 json2（共 4 处）', () => {
    assert.ok(SRC.includes('saveAutoBackup(false,json2); /* L16-W14 · 指令 5：复用本轮落盘串，免除 clone + 二次 stringify */'));
    assert.ok(SRC.includes('saveAutoBackup(false,json2); /* L16-W14 · 指令 5：同上（Soak 慢操作主因） */'));
    assert.ok(SRC.includes('saveAutoBackup(false,json2); /* L16-W14 · 指令 5：关页全量路径复用本轮落盘串 */'));
    assert.ok(SRC.includes('saveAutoBackup(false,json2); /* L16-W14 · 指令 5：同上 */'));
  });

  test('A5: patch ack 指纹复用（旧二次序列化消除 + 降级保留）', () => {
    assert.ok(!SRC.includes('_lastWrittenJson=JSON.stringify(getState(),_ORIGIN_STRIP); /* 增量已全量落盘 → 指纹同步 */'), '旧 ack 二次序列化仍在');
    assert.ok(SRC.includes('const _revBeforeBatch=state._rev|0;'), '缺 ack 前 rev 采样');
    assert.ok(SRC.includes('let _jsonAck=_revSubstJson(json,_revBeforeBatch,state._rev|0);'), '缺 rev 替换复用');
    assert.ok(SRC.includes('if(_jsonAck===null)_jsonAck=JSON.stringify(getState(),_ORIGIN_STRIP);'), '缺降级分支');
  });
});

/* ---------- 5) 载荷等价 ---------- */
describe('L16-W14 §B autobackup 载荷等价', () => {
  test('B1: stateJson 路径 —— 键序 state,ui,graphpos,ts + state 内容等价', () => {
    const st = buildState(60);
    const gp = { n1: { x: 10, y: 20 } };
    const json2 = JSON.stringify(st, _ORIGIN_STRIP);
    const env = makeBackupEnv(st, gp, {});
    env.save(false, json2);
    assert.equal(env.writes.length, 1);
    assert.equal(env.writes[0][0], 'juju.autobackup.v18');
    const out = env.writes[0][1];
    const parsed = JSON.parse(out);
    assert.deepEqual(Object.keys(parsed), ['state', 'ui', 'graphpos', 'ts']);
    assert.equal(JSON.stringify(parsed.state), json2, 'state 串须与传入落盘串逐字节一致');
    assert.deepEqual(parsed.graphpos, gp);
    assert.deepEqual(parsed.ui, { theme: 'day', scale: 1, uiVersion: 3 });
    assert.equal(typeof parsed.ts, 'number');
    assert.equal(parsed.state.nodes.n1.text, '节点1 "\\ #tag');
  });

  test('B2: 无 stateJson 降级路径 —— 与旧口径（clone + stringify）逐字节一致', () => {
    const st = buildState(40);
    const gp = { n2: { x: 1, y: 2 } };
    const env = makeBackupEnv(st, gp, { lastTs: 0 });
    env.save(true);
    const legacy = JSON.stringify({ state: JSON.parse(JSON.stringify(st)), ui: { theme: 'day', scale: 1, uiVersion: 3 }, graphpos: JSON.parse(JSON.stringify(gp)), ts: JSON.parse(env.writes[0][1]).ts });
    assert.equal(env.writes[0][1], legacy, '降级路径须与旧口径逐字节一致');
  });

  test('B3: 10s 限频仍生效；force 绕过', () => {
    const st = buildState(5);
    const env = makeBackupEnv(st, {}, {});
    env.save(false, JSON.stringify(st, _ORIGIN_STRIP));
    env.save(false, JSON.stringify(st, _ORIGIN_STRIP));
    assert.equal(env.writes.length, 1, '限频窗口内第二次不应写盘');
    env.save(true, JSON.stringify(st, _ORIGIN_STRIP));
    assert.equal(env.writes.length, 2, 'force 应绕过限频');
  });

  test('B4: 非法 stateJson（非对象首尾）降级而不抛错', () => {
    const st = buildState(5);
    const env = makeBackupEnv(st, {}, {});
    env.save(true, 'not-json');
    assert.equal(env.writes.length, 1);
    assert.deepEqual(Object.keys(JSON.parse(env.writes[0][1])), ['state', 'ui', 'graphpos', 'ts']);
    assert.equal(JSON.parse(env.writes[0][1]).state.nodes.n0.id, 'n0');
  });

  test('B5: 主库接近配额阈值仍跳过（F-16 语义不变）', () => {
    const st = buildState(5);
    const env = makeBackupEnv(st, {}, { mainLen: 3600000 });
    env.save(true, JSON.stringify(st, _ORIGIN_STRIP));
    assert.equal(env.writes.length, 0, '配额阈值分支应跳过自动备份');
  });
});

/* ---------- 6) 图位置防抖 ---------- */
describe('L16-W14 §C 图位置防抖与关页 flush', () => {
  test('C1: 窗口内多次调用只落盘一次（最后一次内容）', () => {
    const env = makeGraphEnv({ a: { x: 0, y: 0 } });
    env.save();
    env.save();
    env.save();
    assert.equal(env.writes.length, 0, '防抖窗口内不应同步写盘');
    assert.equal(env.timerCount(), 1, '应只有 1 个待触发定时器');
    env.runTimers();
    assert.equal(env.writes.length, 1);
    assert.equal(env.writes[0][0], 'juju.graphpos');
    assert.deepEqual(JSON.parse(env.writes[0][1]), { a: { x: 0, y: 0 } });
  });

  test('C2: flushGraphPositions 立即写盘并清除挂起定时器（幂等）', () => {
    const env = makeGraphEnv({ a: { x: 1, y: 2 } });
    env.save();
    env.flush();
    assert.equal(env.writes.length, 1, 'flush 应立即写盘');
    assert.equal(env.pending(), null, 'flush 后不应残留定时器');
    env.runTimers();
    assert.equal(env.writes.length, 1, 'flush 后旧定时器不得重复写盘');
    env.flush();
    assert.equal(env.writes.length, 2, '再次 flush 幂等写盘（内容不变）');
    assert.equal(env.writes[1][1], env.writes[0][1]);
  });

  test('C3: pagehide 已注册且指向 flushGraphPositions（关页强制 flush）', () => {
    const env = makeGraphEnv({ a: { x: 9, y: 9 } });
    const hit = env.listeners.filter(([ev]) => ev === 'pagehide');
    assert.equal(hit.length, 1, '应注册 1 个 pagehide 监听');
    assert.equal(hit[0][1].name, 'flushGraphPositions');
    env.save();
    assert.equal(env.writes.length, 0, 'save 后仍在防抖窗口内');
    hit[0][1](); /* 模拟关页 */
    assert.equal(env.writes.length, 1, 'pagehide 应强制 flush');
    assert.equal(env.pending(), null, 'flush 后无挂起定时器');
    assert.deepEqual(JSON.parse(env.writes[0][1]), { a: { x: 9, y: 9 } });
  });
});

/* ---------- 7) patch ack 指纹复用 ---------- */
describe('L16-W14 §D patch ack 指纹复用等价', () => {
  test('D1: 多批 ack（rev 连增）后复用串与全量重序列化逐字节一致', () => {
    const st = buildState(300);
    const json = JSON.stringify(st, _ORIGIN_STRIP);
    const revBefore = st._rev;
    st._rev = revBefore + 3; /* 三批 ack */
    const ref = JSON.stringify(st, _ORIGIN_STRIP);
    const reuse = _revSubstJson(json, revBefore, st._rev);
    assert.notEqual(reuse, null, '常规 state 应命中 rev 替换');
    assert.equal(reuse, ref, '复用串须与全量重序列化逐字节一致');
  });

  test('D2: 降级兜底 —— rev 缺位时返回 null（调用方全量重序列化）', () => {
    const st = buildState(10);
    const json = JSON.stringify(st, _ORIGIN_STRIP);
    assert.equal(_revSubstJson(json, 12345, st._rev), null);
  });

  test('D3: 文本含 rev token 字面量不误命中', () => {
    const st = buildState(10);
    st.nodes.n3.text = '"_rev":7}';
    const json = JSON.stringify(st, _ORIGIN_STRIP);
    const revBefore = st._rev;
    st._rev = revBefore + 1;
    const reuse = _revSubstJson(json, revBefore, st._rev);
    assert.equal(reuse, JSON.stringify(st, _ORIGIN_STRIP));
  });
});

/* ---------- 8) 大 state 采样 ---------- */
describe('L16-W14 §E 大 state（20,000 节点）载荷构造采样', () => {
  test('E1: 拼接路径 P95 显著低于旧 clone+stringify 路径', () => {
    const st = buildState(20000);
    const gp = { n1: { x: 1, y: 2 }, n2: { x: 3, y: 4 } };
    const json2 = JSON.stringify(st, _ORIGIN_STRIP);
    const ui = { theme: 'day', scale: 1, uiVersion: 3 };
    const legacyTimes = [];
    const fastTimes = [];
    const legacy = () => {
      const payload = { state: JSON.parse(JSON.stringify(st)), ui, graphpos: JSON.parse(JSON.stringify(gp)), ts: Date.now() };
      return JSON.stringify(payload);
    };
    const fast = () => '{"state":' + json2 + ',"ui":' + JSON.stringify(ui) + ',"graphpos":' + JSON.stringify(gp) + ',"ts":' + Date.now() + '}';
    for (let i = 0; i < 9; i++) {
      let t0 = process.hrtime.bigint();
      legacy();
      legacyTimes.push(Number(process.hrtime.bigint() - t0) / 1e6);
      t0 = process.hrtime.bigint();
      fast();
      fastTimes.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    const p95 = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.max(0, Math.ceil(s.length * 0.95) - 1)]; };
    const lp = p95(legacyTimes);
    const fp = p95(fastTimes);
    console.log('[L16-W14] autobackup payload build P95 (20k nodes): legacy=' + lp.toFixed(2) + ' ms, reuse=' + fp.toFixed(2) + ' ms');
    assert.ok(fp < lp, '复用路径 P95 必须低于旧口径：' + fp.toFixed(2) + ' vs ' + lp.toFixed(2));
    assert.ok(fp <= 50, '复用路径 P95 超预算：' + fp.toFixed(2) + ' ms');
    assert.equal(JSON.parse(fast()).state.nodes.n19999.id, 'n19999');
  });
});
