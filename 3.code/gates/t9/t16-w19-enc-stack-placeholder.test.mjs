/**
 * L16-W19 · 缺陷修复指令 10「加密模式 entry.stack 一并占位 + ctx.enc 修正（Defect-I）」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：
 *   reportError 的加密分支（ui.encrypted === true）原仅替换 msg / reason，entry.stack（截断 4KB）仍保留错误原文，
 *   entry.filename / entry.lineno 亦原样外泄（含本机绝对路径与源码片段）；entry.ctx.enc 需与 encNow 显式同源
 *   （加密 ⇒ enc:true 且清空 view / docId / nodeCount；非加密 ⇒ enc:false 并提取常规上下文）。
 * 断言口径（确定性）：
 *   A. 结构锚点：<enc-stack> / <enc-filename> / <enc-lineno> 位于 if(encNow){…} 内且先于 else 脱敏分支；
 *      ctx 由 _ctx 构造并以 encNow 三元式显式绑定，entry 以 ctx:_ctx 引用。
 *   B. 加密行为：stack / filename / lineno 全部占位；ctx.enc=true 且敏感上下文清零；超长 stack 亦为占位。
 *   C. 非加密行为（降级不变）：msg 走 _redactErrText，stack / filename / lineno 原样（stack 仍 4KB 截断），
 *      ctx.enc=false 且提取 view / docId / nodeCount。
 *   D. 指标：error_report.encrypted-msg-placeholder = true（hasSecret=false）。
 *   E. 大 state 构造 + 加密上报 P95 采样（阈值断言）。
 * 运行：`node --test l9/t16-w19-enc-stack-placeholder.test.mjs`（Node >= 22）
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

const C0 = SRC.indexOf('const _redactErrText=');
const C1 = SRC.indexOf('/* 【任务③】批量补投未上报错误 */', C0);
assert.ok(C0 > 0 && C1 > C0, 'canonical 缺 _redactErrText / reportError 区段');
const CHUNK = SRC.slice(C0, C1);

/* ---------- 0) 被测函数装配（模块级状态以 prelude 复刻） ---------- */
const PRELUDE = [
  'const _win = window;',
  'let _inReportError=false;',
  'const _errSeen=new Map();',
  'let _errRateWin=0,_errRateCount=0;',
  'const _ERR_RATE_MAX=40;',
  'let _errSweepCount=0;',
  'const _ERR_SWEEP_INTERVAL=64;',
  '',
].join('\n');

function makeHarness({ encrypted = false, nodes = { root: {}, a: {}, b: {} } } = {}) {
  const juLog = [];
  const win = { __juLog: juLog };
  const ui = { encrypted, view: 'outline', currentDocId: 'doc-1', errorReporting: false };
  const state = { nodes };
  const desktopCalls = [];
  const desktopInvoke = (ch, arg) => {
    desktopCalls.push([ch, arg]);
    return Promise.resolve();
  };
  const factory = new Function(
    'window', 'ui', 'state', 'JU_VER', 'IS_DESKTOP', 'desktopInvoke', 'navigator', 'location', 'ERROR_ENDPOINT',
    PRELUDE + CHUNK + '\nreturn {reportError, _redactErrText};',
  );
  const mod = factory(
    win, ui, state, 'test-ver', false, desktopInvoke,
    { sendBeacon: undefined }, { protocol: 'file:' }, null,
  );
  return { mod, juLog, desktopCalls, state, ui };
}

const SECRET_STACK = 'Error: 节点正文 机密内容\n    at saveNode (C:\\Users\\alice\\AppData\\Roaming\\JU\\app.js:118:17)\n    at async run (file:///C:/JU/main.js:9:3)';
const SECRET_FILE = 'C:\\Users\\alice\\AppData\\Roaming\\JU\\app.js';
const SECRET_LINE = 118;
const LONG_STACK = 'Error: ' + 'x'.repeat(9000) + '\n    at fn (app.js:1:1)';

function p95(samples) {
  const s = samples.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)];
}

function buildBigState(n) {
  const nodes = { root: { id: 'root', text: '根', children: [], createdAt: 1, updatedAt: 2 } };
  for (let i = 0; i < n; i++) {
    const id = 'n' + i;
    nodes[id] = { id, parent: 'root', children: [], text: '节点 ' + i, createdAt: 10 + i, updatedAt: 20 + i };
    nodes.root.children.push(id);
  }
  return nodes;
}

/* ---------- 1) 结构锚点 ---------- */
describe('L16-W19 §A 结构锚点（canonical 文本）', () => {
  test('A1: 加密分支含 _p.stack / _p.filename / _p.lineno 占位', () => {
    assert.ok(CHUNK.includes("if(_p.stack!=null)_p.stack='<enc-stack>';"), '缺 stack 占位');
    assert.ok(CHUNK.includes("if(_p.filename!=null)_p.filename='<enc-filename>';"), '缺 filename 占位');
    assert.ok(CHUNK.includes("if(_p.lineno!=null)_p.lineno='<enc-lineno>';"), '缺 lineno 占位');
  });

  test('A2: 占位位于 if(encNow){…} 内且先于 else 脱敏分支', () => {
    const E0 = SRC.indexOf('if(encNow){', C0);
    const ST = SRC.indexOf("_p.stack='<enc-stack>';", E0);
    const ELSE = SRC.indexOf('}else{', E0);
    const RED = SRC.indexOf('_p.msg=_redactErrText(_p.msg);', E0);
    assert.ok(E0 > 0, '缺 encNow 分支');
    assert.ok(ST > E0 && ST < ELSE, 'stack 占位应位于加密分支内');
    assert.ok(ELSE < RED, '脱敏分支应位于加密分支之后');
  });

  test('A3: ctx.enc 以 encNow 三元式显式绑定且 entry 引用 ctx:_ctx', () => {
    assert.ok(CHUNK.includes('const _ctx=encNow?'), '缺 _ctx 显式绑定');
    assert.ok(CHUNK.includes('enc:true'), '加密 ctx 应为 enc:true');
    assert.ok(CHUNK.includes('enc:false'), '非加密 ctx 应为 enc:false');
    assert.ok(CHUNK.includes('ctx:_ctx'), 'entry 应以 ctx:_ctx 引用绑定结果');
    assert.ok(!CHUNK.includes('ctx:encNow?'), '旧的内联三元式应已收敛为 _ctx');
  });
});

/* ---------- 2) 加密模式行为 ---------- */
describe('L16-W19 §B 加密模式占位行为', () => {
  test('B1: stack / filename / lineno / msg / reason 一并占位', () => {
    const h = makeHarness({ encrypted: true });
    h.mod.reportError('error', {
      msg: '节点正文 机密内容', reason: '机密原因', stack: SECRET_STACK,
      filename: SECRET_FILE, lineno: SECRET_LINE, name: 'Error',
    });
    assert.equal(h.juLog.length, 1, '未记录 entry');
    const e = h.juLog[0];
    assert.equal(e.stack, '<enc-stack>', 'stack 未占位');
    assert.equal(e.filename, '<enc-filename>', 'filename 未占位');
    assert.equal(e.lineno, '<enc-lineno>', 'lineno 未占位');
    assert.equal(e.msg, '<enc-message>', 'msg 未占位');
    assert.equal(e.reason, '<enc-message>', 'reason 未占位');
    assert.equal(e.name, 'Error', 'kind 类元信息应保留');
  });

  test('B2: entry 序列化后零敏感残留', () => {
    const h = makeHarness({ encrypted: true });
    h.mod.reportError('error', { msg: '节点正文 机密内容', stack: SECRET_STACK, filename: SECRET_FILE, lineno: SECRET_LINE });
    const s = JSON.stringify(h.juLog[0]);
    assert.ok(!s.includes('机密内容'), 'msg 原文残留：' + s);
    assert.ok(!s.includes('alice'), '本机路径残留：' + s);
    assert.ok(!s.includes('app.js:118'), 'stack 源码位置残留：' + s);
  });

  test('B3: ctx.enc=true 且敏感上下文清零', () => {
    const h = makeHarness({ encrypted: true, nodes: buildBigState(50) });
    h.mod.reportError('error', { msg: 'x', stack: SECRET_STACK });
    const c = h.juLog[0].ctx;
    assert.equal(c.enc, true, 'ctx.enc 应为 true');
    assert.equal(c.view, null, 'ctx.view 应清空');
    assert.equal(c.docId, null, 'ctx.docId 应清空');
    assert.equal(c.nodeCount, 0, 'ctx.nodeCount 应清零');
    assert.ok(typeof c.ver === 'string' && c.ver.length > 0, 'ctx.ver 应保留');
  });

  test('B4: 超长 stack（> 4KB）在加密模式下仍整体占位（非截断原文）', () => {
    const h = makeHarness({ encrypted: true });
    h.mod.reportError('error', { msg: 'x', stack: LONG_STACK });
    assert.equal(h.juLog[0].stack, '<enc-stack>', '超长 stack 未占位');
  });
});

/* ---------- 3) 非加密（降级）行为 ---------- */
describe('L16-W19 §C 非加密分支零回归', () => {
  test('C1: stack / filename / lineno 原样保留，msg 仍脱敏', () => {
    const h = makeHarness({ encrypted: false });
    h.mod.reportError('error', { msg: '保存失败 13800138000', stack: SECRET_STACK, filename: SECRET_FILE, lineno: SECRET_LINE });
    const e = h.juLog[0];
    assert.equal(e.stack, SECRET_STACK, '非加密 stack 被改写');
    assert.equal(e.filename, SECRET_FILE, '非加密 filename 被改写');
    assert.equal(e.lineno, SECRET_LINE, '非加密 lineno 被改写');
    assert.ok(!String(e.msg).includes('13800138000'), '非加密 msg 未脱敏：' + e.msg);
    assert.ok(String(e.msg).includes('<phone>'), '非加密 msg 缺 <phone>');
  });

  test('C2: 非加密 stack 仍截断到 4096 字符', () => {
    const h = makeHarness({ encrypted: false });
    h.mod.reportError('error', { msg: 'x', stack: LONG_STACK });
    assert.equal(h.juLog[0].stack.length, 4096, '4KB 截断口径改变');
    assert.ok(h.juLog[0].stack.startsWith('Error: xxx'), '截断内容不符');
  });

  test('C3: ctx.enc=false 且提取 view / docId / nodeCount', () => {
    const h = makeHarness({ encrypted: false, nodes: buildBigState(7) });
    h.mod.reportError('error', { msg: 'y' });
    const c = h.juLog[0].ctx;
    assert.equal(c.enc, false, 'ctx.enc 应为 false');
    assert.equal(c.view, 'outline', 'ctx.view 未提取');
    assert.equal(c.docId, 'doc-1', 'ctx.docId 未提取');
    assert.equal(c.nodeCount, 8, 'ctx.nodeCount 应为 Object.keys(state.nodes).length');
  });
});

/* ---------- 4) 指标 ---------- */
describe('L16-W19 §D 指标 error_report.encrypted-msg-placeholder', () => {
  test('D1: hasSecret=false ⇒ encrypted-msg-placeholder=true 且 ctx.enc=true', () => {
    const h = makeHarness({ encrypted: true });
    h.mod.reportError('error', { msg: '节点正文 机密内容', stack: SECRET_STACK, filename: SECRET_FILE, lineno: SECRET_LINE });
    const s = JSON.stringify(h.juLog[0]);
    const hasSecret = s.includes('机密内容') || s.includes('alice') || s.includes('app.js:118');
    const errorReport = {
      'encrypted-msg-placeholder': !hasSecret,
      hasSecret,
      'ctx.enc': h.juLog[0].ctx.enc,
    };
    console.log('error_report=' + JSON.stringify(errorReport));
    assert.equal(hasSecret, false, 'entry 仍含敏感原文');
    assert.equal(errorReport['encrypted-msg-placeholder'], true, 'encrypted-msg-placeholder 应为 true');
    assert.equal(errorReport['ctx.enc'], true, 'ctx.enc 应为 true');
  });
});

/* ---------- 5) 大 state + P95 采样 ---------- */
describe('L16-W19 §E 大 state 构造 + P95 采样', () => {
  test('E1: 20,000 节点加密上报 P95 有限且全部占位', () => {
    const nodes = buildBigState(20000);
    const h = makeHarness({ encrypted: true, nodes });
    assert.ok(Object.keys(nodes).length === 20001, '大 state 节点数不符');

    const samples = [];
    for (let i = 0; i < 200; i++) {
      const t0 = process.hrtime.bigint();
      h.mod.reportError('error', { msg: 'm' + i, stack: SECRET_STACK + i, filename: SECRET_FILE, lineno: i });
      const t1 = process.hrtime.bigint();
      samples.push(Number(t1 - t0) / 1e6);
    }
    const p = p95(samples);
    const max = Math.max(...samples);
    console.log('encryptedReport.p95ms=' + p.toFixed(4));
    console.log('encryptedReport.maxms=' + max.toFixed(4));
    console.log('juLog.len=' + h.juLog.length);

    assert.ok(h.juLog.length >= 1, '未产生 entry');
    assert.ok(Number.isFinite(p) && p >= 0, 'P95 采样无效');
    assert.ok(p < 50, '加密上报 P95 过长：' + p.toFixed(4) + 'ms');
    for (const e of h.juLog) {
      assert.equal(e.stack, '<enc-stack>', '存在未占位 stack');
      assert.equal(e.filename, '<enc-filename>', '存在未占位 filename');
      assert.equal(e.ctx.enc, true, '存在 ctx.enc!==true 的 entry');
    }
  });
});
