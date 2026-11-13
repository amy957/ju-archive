/**
 * L19 · 批次 1（P0 级致命缺陷）N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：
 *   P0-1  boot 的「兼容旧版数据」块对 sessionStorage 'juju.pending.v1' 无条件
 *         removeItem，而现行写入 shape 为 {payload,ts,ttl}（无 state 字段），
 *         导致启动时密文兜底被清空、recoverPendingEncrypted 读不到载荷。
 *         改后：仅当 pend.state 命中并回填 initial 时才消费删除。
 *   P0-2  commit 内层 `let _patch;` 遮蔽函数作用域 _patch，L6 增量索引注入点
 *         恒不执行；改后内层声明删除，_patch 赋给外层变量。
 *         L19 期间曾在 actions.addNode / toggleDone / removeNode / setNodeDate 的
 *         commit 之后显式失效日历 / 标签缓存作为兜底；L22 复核确认该兜底与
 *         commit 的 L6/P0-2 增量补丁重复（每次新建/改期/删除都触发全量重建），
 *         已按 L22 清理 11 删除 —— 本条断言随之翻转为「四动作内不再残留全量失效」。
 * 断言口径：
 *   A 结构锚点（去注释后）；B 行为装配；C 红证（只读冻结锚 frozen-l17 判别力）。
 * 运行：`node --test l9/t19-patch1.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 登记（保持 45 方零漂移）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const ROOT = path.resolve(STEP9, '..', '..');
const CANONICAL = process.env.JU_L19_CANONICAL
  ? path.resolve(process.env.JU_L19_CANONICAL)
  : path.resolve(STEP9, '..', 'canonical', 'v2.0-t3.html');
/* 只读历史锚（改前形态 · 仅读取 · 不写入） */
const FROZEN_L17 = path.resolve(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t17-2026-10-17.html');

const SRC = readFileSync(CANONICAL, 'utf8');
const OLD = readFileSync(FROZEN_L17, 'utf8');
const STRIP = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* 提取函数 / 方法声明（跳过参数表中的括号与默认值对象，再按花括号配对） */
function extractDecl(src, head) {
  const s = src.indexOf(head);
  if (s < 0) return null;
  let i = src.indexOf('(', s);
  let pd = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') pd++;
    else if (ch === ')') {
      pd--;
      if (pd === 0) { i++; break; }
    }
  }
  const b = src.indexOf('{', i);
  let depth = 0;
  for (let j = b; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(s, j + 1);
    }
  }
  return null;
}

/* 提取 boot 内 'juju.pending.v1' 兼容块的 try 体（不含 try 关键字与 catch） */
function extractPendingBody(src) {
  const start = src.indexOf("const pendRaw=sessionStorage.getItem('juju.pending.v1');");
  if (start < 0) return null;
  const end = src.indexOf('}catch(e){}', start);
  if (end < 0) return null;
  return src.slice(start, end);
}

/* 以伪 sessionStorage 执行兼容块，返回 initial 结果 / removeItem 调用 / 剩余键 */
function runPendingBlock(body, seed) {
  const store = new Map(Object.entries(seed || {}));
  const removed = [];
  const sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    removeItem: (k) => { removed.push(k); store.delete(k); },
  };
  const fn = new Function('sessionStorage', 'initial', `${body}\nreturn initial;`);
  const initial = { __sentinel: true };
  const out = fn(sessionStorage, initial);
  return { out, removed, store };
}

/* ---------- P0-1 · boot 兼容块不得清空密文兜底 ---------- */
describe('L19 · P0-1 · boot 兼容旧版块保留 juju.pending.v1 密文兜底', () => {
  test('A1 兼容块存在且 removeItem 受 pend.state 命中门控', () => {
    const body = extractPendingBody(SRC);
    assert.ok(body, '缺少 juju.pending.v1 兼容块');
    const code = STRIP(body);
    assert.match(code, /if\(pend&&pend\.state&&pend\.state\.nodes&&\(pend\.ts\+pend\.ttl\)>Date\.now\(\)\)\{/);
    assert.match(code, /sessionStorage\.removeItem\('juju\.pending\.v1'\);/);
    /* removeItem 必须位于条件块内部：条件块结束前最后一个 } 之前 */
    const condAt = code.indexOf('if(pend&&pend.state&&pend.state.nodes');
    const rmAt = code.indexOf("sessionStorage.removeItem('juju.pending.v1');");
    assert.ok(rmAt > condAt, 'removeItem 不在条件块之后');
  });

  test('B1 新 shape {payload,ts,ttl}：不删除、不覆盖 initial', () => {
    const body = extractPendingBody(SRC);
    const raw = JSON.stringify({ payload: 'ENC-CIPHERTEXT', ts: Date.now(), ttl: 60000 });
    const { out, removed, store } = runPendingBlock(body, { 'juju.pending.v1': raw });
    assert.deepEqual(removed, [], '新 shape 不得被 removeItem 清空');
    assert.equal(out.__sentinel, true, 'initial 不应被覆盖');
    assert.equal(store.get('juju.pending.v1'), raw, '密文兜底应保留供 recoverPendingEncrypted 读取');
  });

  test('B2 旧 shape {state}：命中后回填 initial 并消费删除', () => {
    const body = extractPendingBody(SRC);
    const state = { nodes: { a: { id: 'a' } }, tagColors: { x: '#fff' } };
    const raw = JSON.stringify({ state, ts: Date.now(), ttl: 60000 });
    const { out, removed } = runPendingBlock(body, { 'juju.pending.v1': raw });
    assert.equal(out.nodes.a.id, 'a', '旧 shape 应回填 initial');
    assert.deepEqual(removed, ['juju.pending.v1'], '旧 shape 消费后应删除');
  });

  test('B3 旧 shape 已过期：不覆盖 initial、不删除', () => {
    const body = extractPendingBody(SRC);
    const raw = JSON.stringify({ state: { nodes: { a: {} } }, ts: Date.now() - 120000, ttl: 60000 });
    const { out, removed } = runPendingBlock(body, { 'juju.pending.v1': raw });
    assert.equal(out.__sentinel, true, '过期载荷不得覆盖 initial');
    assert.deepEqual(removed, [], '过期载荷不应在 boot 被清空');
  });

  test('C1 红证：冻结锚 frozen-l17 对新 shape 仍无条件删除', () => {
    const oldBody = extractPendingBody(OLD);
    assert.ok(oldBody, '冻结锚应保留改前形态');
    const raw = JSON.stringify({ payload: 'ENC', ts: Date.now(), ttl: 60000 });
    const { removed, store } = runPendingBlock(oldBody, { 'juju.pending.v1': raw });
    assert.deepEqual(removed, ['juju.pending.v1'], '改前应对新 shape 也无条件删除');
    assert.equal(store.has('juju.pending.v1'), false, '改前密文兜底被清空');
  });
});

/* ---------- P0-2 · commit 内层 _patch 遮蔽 ---------- */
describe('L19 · P0-2 · commit 的 _patch 不再被内层 let 遮蔽', () => {
  test('A1 commit 函数内仅一处 let _patch;（函数作用域）', () => {
    const fn = extractDecl(SRC, 'function commit(action,');
    assert.ok(fn, '缺少 commit');
    const count = (STRIP(fn).match(/let _patch;/g) || []).length;
    assert.equal(count, 1, `期望仅外层 1 处 let _patch;，实得 ${count}`);
  });

  test('A2 _patch 由 buildPatch 赋值（无内层声明），_l8Patch 捕获保留', () => {
    const fn = STRIP(extractDecl(SRC, 'function commit(action,') || '');
    assert.match(fn, /_patch=buildPatch\(/);
    assert.match(fn, /_l8Patch=_patch;/);
    assert.match(fn, /if\(_patch&&_patch\.paths&&_patch\.paths\.length&&!__juInMerge\)/);
  });

  test('B1 遮蔽可复现：内层 let 使外层恒 undefined；去遮蔽后可见', () => {
    function shadowed() {
      let _patch;
      if (true) {
        let _patch;
        _patch = { paths: ['nodes.a'] };
      }
      return _patch;
    }
    function fixed() {
      let _patch;
      if (true) {
        _patch = { paths: ['nodes.a'] };
      }
      return _patch;
    }
    assert.equal(shadowed(), undefined, '内层声明应遮蔽外层');
    assert.deepEqual(fixed(), { paths: ['nodes.a'] }, '去遮蔽后外层应可见');
  });

  test('C1 红证：冻结锚 frozen-l17 的 commit 内含两处 let _patch;', () => {
    const oldFn = STRIP(extractDecl(OLD, 'function commit(action,') || '');
    const count = (oldFn.match(/let _patch;/g) || []).length;
    assert.equal(count, 2, '改前应存在内外两处声明');
  });
});

/* ---------- P0-2 · 关键动作后的显式缓存失效 ---------- */
describe('L19 · P0-2 · 日历 / 标签视图实时刷新兜底', () => {
  const HEADS = [
    ['  addNode(parentId,index,init={}){', 'addNode'],
    ['  toggleDone(id){', 'toggleDone'],
    ['  removeNode(id){', 'removeNode'],
    ['  setNodeDate(id,date){', 'setNodeDate'],
  ];

  test('A1 四个动作不再残留重复的全量缓存失效（L22 · 清理 11）', () => {
    for (const [head, label] of HEADS) {
      const fn = STRIP(extractDecl(SRC, head) || '');
      assert.ok(fn, `缺少 ${label}`);
      assert.doesNotMatch(fn, /invalidateCalIndex\(\);_tagIndexCache=null;/, `${label} 仍有重复的全量失效`);
    }
  });

  test('B1 invalidateCalIndex 清空全部缓存并推进 _calDataRev', () => {
    const fnSrc = extractDecl(SRC, 'function invalidateCalIndex(){');
    assert.ok(fnSrc, '缺少 invalidateCalIndex');
    const factory = new Function(
      '_calIndexCache', '_calDataRev', '_calRecurCache', '_yearCountsCache',
      '_tagIndexCache', '_calDayCache', '_renderDayCache',
      `${fnSrc}\ninvalidateCalIndex();\nreturn {c:_calIndexCache,rev:_calDataRev,r:_calRecurCache,y:_yearCountsCache,t:_tagIndexCache,d:_calDayCache,rd:_renderDayCache};`,
    );
    const out = factory({}, 7, {}, {}, new Set(['x']), [], []);
    assert.equal(out.c, null);
    assert.equal(out.r, null);
    assert.equal(out.y, null);
    assert.equal(out.t, null);
    assert.equal(out.d, null);
    assert.equal(out.rd, null);
    assert.equal(out.rev, 8);
  });
});
