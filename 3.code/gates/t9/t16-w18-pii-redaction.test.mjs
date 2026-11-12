/**
 * L16-W18 · 缺陷修复指令 9「_redactErrText 补充裸号码 / 邮箱 / IP 脱敏（Defect-H）」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：
 *   _redactErrText 原仅匹配引号包裹的连续文本（/["'`]([^"'`\n]{4,})["'`]/g），裸手机号（13800138000）、
 *   邮箱（hello@test.com）、IPv4 会原样进入 window.__juLog，存在隐私泄露风险。本波在替换链追加：
 *     中国大陆手机号 \b1[3-9]\d{9}\b -> <phone>
 *     邮箱         \b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b -> <email>
 *     IPv4         \b(?:\d{1,3}\.){3}\d{1,3}\b -> <ip>
 *   引号规则保留；加密模式（ui.encrypted）的 <enc-message> 占位分支不变。
 * 断言口径（确定性）：
 *   A. 结构锚点（canonical 文本：三条补充规则 + 引号规则并存）。
 *   B. 行为：三类 PII 均被替换；引号规则不回归；短引号正常消息不误伤；幂等。
 *   C. 指标：error_report.pii-redaction = true（rawPhone=false && rawEmail=false）。
 *   D. 加密模式占位行为不变（enc 分支先于脱敏、占位符原样）。
 *   E. 大 state 构造 + 大消息 P95 采样（阈值断言）。
 * 运行：`node --test l9/t16-w18-pii-redaction.test.mjs`（Node >= 22）
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

const R0 = SRC.indexOf('const _redactErrText=');
const R1 = SRC.indexOf('function reportError(', R0);
assert.ok(R0 > 0 && R1 > R0, 'canonical 缺 _redactErrText');

/* 表达式体：_redactErrText = s => ...（去掉声明前缀与结尾分号，供 new Function 装配） */
let REDACT_SRC = SRC.slice(R0, R1).trim();
REDACT_SRC = REDACT_SRC.replace(/^const\s+_redactErrText\s*=\s*/, '').replace(/;\s*$/, '');

const redact = new Function('return (' + REDACT_SRC + ')')();

/* ---------- 1) 样本 ---------- */
const PHONE = '13800138000';
const PHONE2 = '15912345678';
const EMAIL = 'hello@test.com';
const EMAIL2 = 'first.last+tag@sub.example.co.uk';
const IP = '192.168.1.24';
const NOISE = "Column 'foo' not found";

function p95(samples) {
  const s = samples.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)];
}

/* 大 state 构造（20,000 节点）——节点正文含 PII，合并为单条大错误消息 */
function buildBigState(n) {
  const nodes = { root: { id: 'root', text: '根', children: [], createdAt: 1, updatedAt: 2 } };
  for (let i = 0; i < n; i++) {
    const id = 'n' + i;
    const text = i % 3 === 0
      ? '联系人' + PHONE + ' 备注 ' + i
      : (i % 3 === 1 ? '邮箱 ' + EMAIL + ' #' + i : '节点 ' + i + ' 正常文本');
    nodes[id] = { id, parent: 'root', children: [], text, createdAt: 10 + i, updatedAt: 20 + i };
    nodes.root.children.push(id);
  }
  return { nodes, rootId: 'root', updatedAt: 1700000000000, _rev: 7 };
}

/* ---------- 2) 结构锚点 ---------- */
describe('L16-W18 §A 结构锚点（canonical 文本）', () => {
  test('A1: 手机号规则存在（\\b1[3-9]\\d{9}\\b -> <phone>）', () => {
    assert.ok(REDACT_SRC.includes('1[3-9]\\d{9}'), '缺手机号规则');
    assert.ok(REDACT_SRC.includes("'<phone>'"), '缺 <phone> 替换值');
  });

  test('A2: 邮箱规则存在（\\b[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+\\b -> <email>）', () => {
    assert.ok(REDACT_SRC.includes('[\\w.+-]+@[\\w-]+'), '缺邮箱规则');
    assert.ok(REDACT_SRC.includes('(?:\\.[\\w-]+)+'), '邮箱规则应要求至少一级域名后缀');
    assert.ok(REDACT_SRC.includes("'<email>'"), '缺 <email> 替换值');
  });

  test('A3: IPv4 规则存在（\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b -> <ip>）', () => {
    assert.ok(REDACT_SRC.includes('(?:\\d{1,3}\\.){3}\\d{1,3}'), '缺 IPv4 规则');
    assert.ok(REDACT_SRC.includes("'<ip>'"), '缺 <ip> 替换值');
  });

  test('A4: 引号包裹文本规则原样保留', () => {
    assert.ok(REDACT_SRC.includes('([^"\'`\\n]{4,})'), '缺引号包裹规则（4 字符下限）');
    assert.ok(REDACT_SRC.includes('"<redacted>"'), '缺 <redacted> 替换值');
    assert.ok(
      REDACT_SRC.indexOf('"<redacted>"') < REDACT_SRC.indexOf("'<phone>'"),
      '引号规则应先于补充规则执行（保持原有匹配优先级）',
    );
  });
});

/* ---------- 3) 行为 ---------- */
describe('L16-W18 §B 脱敏行为', () => {
  test('B1: 裸手机号 -> <phone>', () => {
    const out = redact('保存失败，手机号 ' + PHONE + ' 无效');
    assert.ok(out.includes('<phone>'), '手机号未脱敏：' + out);
    assert.ok(!out.includes(PHONE), '手机号原文残留：' + out);
    assert.ok(!redact('呼出 ' + PHONE2).includes(PHONE2), '第二例手机号未脱敏');
  });

  test('B2: 裸邮箱 -> <email>', () => {
    const out = redact('发送到 ' + EMAIL + ' 失败');
    assert.ok(out.includes('<email>'), '邮箱未脱敏：' + out);
    assert.ok(!out.includes(EMAIL), '邮箱原文残留：' + out);
    assert.ok(!redact('抄送 ' + EMAIL2).includes(EMAIL2), '复合邮箱未脱敏');
  });

  test('B3: IPv4 -> <ip>', () => {
    const out = redact('connect ECONNREFUSED ' + IP + ':8080');
    assert.ok(out.includes('<ip>'), 'IPv4 未脱敏：' + out);
    assert.ok(!out.includes(IP), 'IPv4 原文残留：' + out);
    assert.ok(!redact('server 10.0.0.7 unreachable').includes('10.0.0.7'), '内网地址未脱敏');
  });

  test('B4: 引号包裹规则不回归（>= 4 字符仍替换）', () => {
    const out = redact("Unexpected token 'abcdef'");
    assert.ok(out.includes('"<redacted>"'), '引号规则失效：' + out);
    assert.ok(!out.includes('abcdef'), '引号内容残留：' + out);
  });

  test('B5: 正常错误消息不误伤（Column \'foo\' not found / 数字串）', () => {
    assert.equal(redact(NOISE), NOISE, '正常消息被改写：' + redact(NOISE));
    const other = 'timeout after 5000 ms at step 3';
    assert.equal(redact(other), other, '含数字的正常消息被改写');
    const quotedShort = 'Cannot read properties of undefined (reading \'x\')';
    assert.equal(redact(quotedShort), quotedShort, '短引号消息被改写');
  });

  test('B6: 幂等（redact(redact(x)) === redact(x)）', () => {
    const x = 'phone ' + PHONE + ' mail ' + EMAIL + ' ip ' + IP + " quote 'abcdefgh'";
    const once = redact(x);
    assert.equal(redact(once), once, '脱敏非幂等');
  });

  test('B7: 三类 PII 同一消息内一并脱敏', () => {
    const out = redact(PHONE + ' / ' + EMAIL + ' / ' + IP);
    assert.equal(out, '<phone> / <email> / <ip>', '混合消息脱敏结果不符：' + out);
  });
});

/* ---------- 4) 指标（error_report） ---------- */
describe('L16-W18 §C 指标 error_report.pii-redaction', () => {
  test('C1: rawPhone=false && rawEmail=false ⇒ pii-redaction=true', () => {
    const sample = 'fail ' + PHONE + ' ' + EMAIL + ' ' + IP;
    const out = redact(sample);
    const rawPhone = out.includes(PHONE);
    const rawEmail = out.includes(EMAIL);
    const rawIp = out.includes(IP);
    const errorReport = {
      'pii-redaction': !rawPhone && !rawEmail,
      rawPhone,
      rawEmail,
      rawIp,
    };
    console.log('error_report=' + JSON.stringify(errorReport));
    console.log('error_report.pii-redaction=' + errorReport['pii-redaction']);
    console.log('rawPhone=' + rawPhone);
    console.log('rawEmail=' + rawEmail);
    console.log('rawIp=' + rawIp);
    assert.equal(rawPhone, false, 'rawPhone 应为 false');
    assert.equal(rawEmail, false, 'rawEmail 应为 false');
    assert.equal(rawIp, false, 'rawIp 应为 false');
    assert.equal(errorReport['pii-redaction'], true, 'pii-redaction 应为 true');
  });
});

/* ---------- 5) 加密模式占位不变 ---------- */
describe('L16-W18 §D 加密模式占位行为不变', () => {
  test('D1: enc 分支以 <enc-message> 占位且先于脱敏分支', () => {
    const E0 = SRC.indexOf('const encNow=');
    const E1 = SRC.indexOf("_p.msg='<enc-message>';", E0);
    const E2 = SRC.indexOf('_p.msg=_redactErrText(_p.msg);', E0);
    assert.ok(E0 > 0, '缺 encNow 判定');
    assert.ok(E1 > E0, '缺 <enc-message> 占位');
    assert.ok(E2 > E1, '脱敏分支应位于加密占位之后（else 分支）');
    assert.ok(SRC.includes("if(_p.reason!=null)_p.reason='<enc-message>';"), '缺 reason 占位');
  });
});

/* ---------- 6) 大 state + P95 采样 ---------- */
describe('L16-W18 §E 大 state 构造 + P95 采样', () => {
  test('E1: 20,000 节点正文合并消息脱敏 P95 有限且全量命中', () => {
    const st = buildBigState(20000);
    const texts = Object.keys(st.nodes).map((k) => st.nodes[k].text);
    const big = texts.join(' | ');
    assert.ok(big.length > 300000, '大消息长度不足：' + big.length);

    const samples = [];
    let out;
    for (let i = 0; i < 60; i++) {
      const t0 = process.hrtime.bigint();
      out = redact(big);
      const t1 = process.hrtime.bigint();
      samples.push(Number(t1 - t0) / 1e6);
    }
    const p = p95(samples);
    const max = Math.max(...samples);
    console.log('bigMessage.len=' + big.length);
    console.log('bigMessage.p95ms=' + p.toFixed(3));
    console.log('bigMessage.maxms=' + max.toFixed(3));

    assert.ok(Number.isFinite(p) && p >= 0, 'P95 采样无效');
    assert.ok(p < 200, '大消息脱敏 P95 过长：' + p.toFixed(3) + 'ms');
    assert.ok(!out.includes(PHONE), '大消息手机号残留');
    assert.ok(!out.includes(EMAIL), '大消息邮箱残留');
    assert.ok(out.includes('<phone>') && out.includes('<email>'), '大消息未产生占位符');
  });
});
