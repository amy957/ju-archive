/**
 * L16-W17 · 缺陷修复指令 8「boot 主库损坏时回退自动备份（Defect-E）」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：
 *   boot 读取主库后经 migrateOrFallback(stored) 归一；迁移失败（migrateStateObject 返回 null）
 *   时直接 defaultState() 复位，遮蔽了 localStorage 中可能有效的自动备份（AUTO_BACKUP_KEY）。
 *   本波新增 migrateOrBackup(st)：迁移失败时先尝试 loadAutoBackup()，备份存在且迁移成功则
 *   从备份恢复（节点数与备份前一致）；否则仍回退 defaultState()。boot 内五处调用同步改为
 *   migrateOrBackup。
 * 断言口径（确定性）：
 *   A. 结构锚点（canonical 文本：新函数存在、boot 五处已替换、旧调用仅余定义）。
 *   B. crash.S2 主库损坏 + 有效备份 → 恢复（hasBackupDoc=true · 节点数 = 备份前）。
 *   C. crash.S3 不可解析 JSON / crash.S4 空库 → 既有口径不回归。
 *   D. 备份亦损坏 → 仍回退默认态；加密态不读取明文备份（既有加密语义不变）。
 *   E. 大 state（20,000 节点）恢复 P95 采样。
 * 运行：`node --test l9/t16-w17-boot-backup-fallback.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const CANONICAL = path.resolve(STEP9, '..', 'v2.0-t3.html');
const SRC = readFileSync(CANONICAL, 'utf8');

const BOOT0 = SRC.indexOf('async function boot(){');
const BOOT1 = SRC.indexOf('initStore(initial);', BOOT0);
assert.ok(BOOT0 > 0 && BOOT1 > BOOT0, 'canonical 缺 boot 段');
const BOOT_SRC = SRC.slice(BOOT0, BOOT1);

const B0 = SRC.indexOf('function migrateOrBackup(st){');
const B1 = SRC.indexOf('function repairSnapshotNodes(', B0);
assert.ok(B0 > 0 && B1 > B0, 'canonical 缺 migrateOrBackup(st)');
const MIGRATE_SRC = SRC.slice(B0, B1);

/* ---------- 1) 最小作用域装配（真实 migrateOrBackup 函数体逐字执行） ---------- */
function makeEnv(opts) {
  const o = opts || {};
  const store = new Map();
  if (o.backupPayload !== undefined && o.backupPayload !== null) {
    store.set(
      'juju.autobackup.v18',
      typeof o.backupPayload === 'string' ? o.backupPayload : JSON.stringify(o.backupPayload),
    );
  }
  const calls = [];
  const body = `
    const AUTO_BACKUP_KEY='juju.autobackup.v18';
    let ui={encrypted:!!encrypt,encKey:encrypt?'k':null};
    function migrateStateObject(st){
      calls.push('migrate');
      if(!st||typeof st!=='object')return null;
      if(st.__corrupt)return null;
      const out=JSON.parse(JSON.stringify(st));
      out._ver=31;
      return out;
    }
    function loadAutoBackup(){
      try{
        const raw=store.get(AUTO_BACKUP_KEY);
        if(!raw)return null;
        const p=JSON.parse(raw);
        if(!p||!p.state||!p.state.nodes)return null;
        return p;
      }catch(e){return null;}
    }
    function defaultState(){
      calls.push('default');
      return {nodes:{root:{id:'root',text:'root',children:[]}},rootId:'root',__default:true};
    }
    const toasts=[];
    function toast(m){toasts.push(String(m));}
    ${MIGRATE_SRC}
    return {run:migrateOrBackup,toasts,calls};
  `;
  const factory = new Function('encrypt', 'store', 'calls', body);
  const env = factory(!!o.encrypt, store, calls);
  return { run: env.run, toasts: env.toasts, calls: env.calls, store };
}

function buildState(n) {
  const nodes = { root: { id: 'root', text: '根', children: [], createdAt: 1, updatedAt: 2 } };
  for (let i = 0; i < n; i++) {
    const id = 'n' + i;
    nodes[id] = { id, parent: 'root', children: [], text: '节点' + i, createdAt: 10 + i, updatedAt: 20 + i };
    nodes.root.children.push(id);
  }
  return { nodes, rootId: 'root', updatedAt: 1700000000000, _rev: 3 };
}

function backupPayload(n) {
  return { state: buildState(n), ui: { theme: 'day', scale: 1 }, graphpos: {}, ts: 1700000000000 };
}

function p95(samples) {
  const s = samples.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)];
}

/* ---------- 2) 结构锚点 ---------- */
describe('L16-W17 §A 结构锚点（canonical 文本）', () => {
  test('A1: migrateOrBackup 存在且迁移失败时先尝试 loadAutoBackup', () => {
    assert.ok(MIGRATE_SRC.includes('const r=migrateStateObject(st);'), '缺主库迁移');
    assert.ok(MIGRATE_SRC.includes('const ab=loadAutoBackup();'), '缺自动备份读取');
    assert.ok(MIGRATE_SRC.includes('const rb=migrateStateObject(ab.state);'), '缺备份迁移');
    assert.ok(MIGRATE_SRC.includes('return defaultState();'), '缺默认态回退');
  });

  test('A2: boot 五处调用均为 migrateOrBackup，主库路径无旧调用', () => {
    const bootCalls = (BOOT_SRC.match(/migrateOrBackup\(/g) || []).length;
    assert.equal(bootCalls, 5, `boot 内 migrateOrBackup 调用数应为 5，实际 ${bootCalls}`);
    assert.ok(!BOOT_SRC.includes('initial=migrateOrFallback('), 'boot 主库路径仍残留 migrateOrFallback 调用');
    assert.ok(
      BOOT_SRC.includes('initial=ab?migrateOrFallback(ab.state):defaultState();'),
      '空库备份分支应保留原口径',
    );
  });

  test('A3: 非加密态守卫（加密态不读取明文备份）', () => {
    assert.ok(MIGRATE_SRC.includes('ui&&ui.encrypted&&ui.encKey'), '缺加密态守卫');
  });
});

/* ---------- 3) 崩溃场景 ---------- */
describe('L16-W17 §B crash.S2 主库损坏回退备份', () => {
  test('B1: 主库迁移失败 + 有效备份 → 从备份恢复，节点数 = 备份前', () => {
    const n = 40;
    const backup = backupPayload(n);
    const env = makeEnv({ backupPayload: backup });
    const main = { nodes: { root: { id: 'root', children: [] } }, rootId: 'root', __corrupt: true };
    const out = env.run(main);
    const hasBackupDoc = env.store.has('juju.autobackup.v18') && !!out && !out.__default;
    assert.equal(hasBackupDoc, true, 'hasBackupDoc 应为 true');
    assert.equal(Object.keys(out.nodes).length, n + 1, '节点数应等于备份前（含根）');
    assert.equal(out.nodes.n0.text, '节点0');
    assert.equal(out.__default, undefined, '不应复位默认态');
    assert.ok(env.toasts.some((m) => m.includes('备份')), '缺备份恢复提示');
  });

  test('B2: 主库损坏 + 备份损坏 → 回退默认态且给出损坏提示', () => {
    const env = makeEnv({ backupPayload: '{bad json' });
    const main = { nodes: { root: { id: 'root', children: [] } }, rootId: 'root', __corrupt: true };
    const out = env.run(main);
    assert.equal(out.__default, true);
    assert.ok(env.toasts.some((m) => m.includes('损坏')), '缺损坏提示');
  });
});

describe('L16-W17 §C crash.S3 / S4 不回归', () => {
  test('C1: 不可解析 JSON（loadState 返回 null）+ 有效备份 → 恢复备份', () => {
    const n = 12;
    const env = makeEnv({ backupPayload: backupPayload(n) });
    const out = env.run(null);
    assert.equal(out.__default, undefined);
    assert.equal(Object.keys(out.nodes).length, n + 1);
  });

  test('C2: 空库（无主库 · 无备份）→ 默认态，不抛错', () => {
    const env = makeEnv({});
    const out = env.run(null);
    assert.equal(out.__default, true);
    assert.equal(env.calls.filter((c) => c === 'default').length, 1);
  });

  test('C3: boot 保留 stored 为空时的自动备份分支', () => {
    assert.ok(BOOT_SRC.includes('const stored=loadState();'), '缺 loadState');
    assert.ok(BOOT_SRC.includes('const ab=loadAutoBackup();'), '缺空库备份分支');
  });
});

describe('L16-W17 §D 加密态与降级口径', () => {
  test('D1: 加密态迁移失败不读取明文备份（既有加密语义不变）', () => {
    const env = makeEnv({ encrypt: true, backupPayload: backupPayload(8) });
    const main = { nodes: { root: { id: 'root', children: [] } }, rootId: 'root', __corrupt: true };
    const out = env.run(main);
    assert.equal(out.__default, true, '加密态应维持默认态回退');
  });

  test('D2: 主库正常时不触碰备份（零额外开销路径）', () => {
    const env = makeEnv({ backupPayload: backupPayload(8) });
    const ok = buildState(3);
    const out = env.run(ok);
    assert.equal(env.calls.includes('migrate'), true);
    assert.equal(out.__default, undefined);
    assert.equal(env.toasts.length, 0, '正常迁移不应提示');
  });
});

describe('L16-W17 §E 大 state 恢复 P95 采样', () => {
  test('E1: 20,000 节点备份恢复 P95 有限且节点数一致', () => {
    const n = 20000;
    const backup = backupPayload(n);
    const env = makeEnv({ backupPayload: backup });
    const main = { nodes: { root: { id: 'root', children: [] } }, rootId: 'root', __corrupt: true };
    const samples = [];
    let out = null;
    for (let i = 0; i < 31; i++) {
      const t0 = process.hrtime.bigint();
      out = env.run(main);
      samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    const p = p95(samples);
    assert.equal(Object.keys(out.nodes).length, n + 1);
    assert.ok(Number.isFinite(p) && p >= 0, 'P95 采样异常');
    assert.ok(p < 2000, `P95 ${p.toFixed(2)}ms 超出安全上界`);
  });
});
