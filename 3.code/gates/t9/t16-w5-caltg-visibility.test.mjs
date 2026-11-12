/**
 * L16-W5 · 指令 5「统一 visibilitychange 下的定时器管理」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：boot() 尾部已按 FIX-M-25 处理时钟 interval（_clockTimer）的切后台停表 / 回前台重启，
 *           但时间网格 60s 轮询（_calTgTimer）未纳入该管理——标签页隐藏后仍每 60s 触发一次更新链。
 *           本波在 startCalTgTimer 内部自管理 visibilitychange（更内聚）：
 *             - 将原 setInterval 回调体抽为闭包 tick；
 *             - 注册 _calTgVisHandler：document.hidden 时 clearInterval 停表；否则仅当周视图时间线仍在挂
 *               （line.isConnected 等价「view===week 且时间线已挂载」）时重启轮询，并立即执行一次 tick
 *               重定位红线（含休眠期跨天）；
 *             - clearCalTgTimer 一并注销 _calTgVisHandler（避免重渲染重复挂载）。
 * 断言口径（确定性 · 无 wall-clock 阈值敏感，承接 L16-W1..W4 范式）：
 *   A. 结构锚点：canonical 具备 _calTgVisHandler；startCalTgTimer 注册监听、clearCalTgTimer 注销监听；
 *   B. 前台启动：可见时建立唯一 60s 轮询并注册一个监听；
 *   C. 切后台停表：hidden 时清空轮询（后台零 tick）；
 *   D. 回前台自启 + 立即重定位：可见且线仍在挂时重启轮询并即刻 tick 一次（红线即时刷新）；
 *   E. 回前台线未挂不重启：line.isConnected=false 时不重启（等价非周视图）；
 *   F. 注销语义：clearCalTgTimer 移除监听并置空句柄；
 *   G. 重渲染幂等：重复 startCalTgTimer 不产生重复轮询 / 重复监听；
 *   H. tick 自清理：线卸载后 tick 经 clearCalTgTimer 一并清轮询 + 注销监听。
 * 运行：`node --test l9/t16-w5-caltg-visibility.test.mjs`（Node >= 22）
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

/* 从 canonical 提取真实产品实现（L16-W5 声明 + clearCalTgTimer + startCalTgTimer 整段）。 */
const DECL = SRC.match(/let _calTgTimer=null[^\n]*\nlet _calTgVisHandler=null[^\n]*\nfunction clearCalTgTimer\(\)\{[\s\S]*?\n\}/);
assert.ok(DECL, 'canonical 缺少 L16-W5 时间网格定时器声明 / clearCalTgTimer');
const FN = SRC.match(/function startCalTgTimer\(wrap\)\{[\s\S]*?\n\}/);
assert.ok(FN, 'canonical 缺少 startCalTgTimer');

function makeHarness(opts) {
  const o = opts || {};
  const intervals = new Map();
  let seq = 0;
  const listeners = [];
  const doc = {
    hidden: !!o.hidden,
    addEventListener: (t, h) => { if (t === 'visibilitychange') listeners.push(h); },
    removeEventListener: (t, h) => {
      if (t !== 'visibilitychange') return;
      const i = listeners.indexOf(h); if (i >= 0) listeners.splice(i, 1);
    },
    querySelector: () => null,
  };
  const line = {
    isConnected: o.lineConnected !== false,
    style: {}, setAttribute() {}, getBoundingClientRect() { return { top: 0, height: 0 }; },
  };
  const label = { isConnected: true, textContent: '' };
  const scroll = {
    addEventListener() {}, scrollTop: 0, clientHeight: 0, scrollHeight: 0, scrollTo() {},
    getBoundingClientRect() { return { top: 0, height: 0, bottom: 0 }; },
  };
  const wrap = { _tgScroll: scroll, _tgLine: line, _tgLabel: label, _tgDays: ['2026-10-16'] };
  const ui = {};
  const setInt = (fn, ms) => { const id = ++seq; intervals.set(id, { fn, ms }); return id; };
  const clrInt = (id) => { intervals.delete(id); };
  const body = DECL[0] + '\n' + FN[0] +
    '\nreturn {startCalTgTimer,clearCalTgTimer,getTimer:function(){return _calTgTimer;},getVis:function(){return _calTgVisHandler;}};';
  const H = new Function(
    'document', 'setInterval', 'clearInterval', 'cnNow', 'cnYmd', 'pad', 'tgHourH', 'ui', 'saveUI', 'forceRender',
    body
  )(
    doc, setInt, clrInt,
    () => new Date(2026, 9, 16, 10, 30, 0),
    () => '2026-10-16',
    (n) => String(n).padStart(2, '0'),
    () => 40,
    ui, () => {}, () => {}
  );
  return { H, doc, listeners, intervals, wrap, line };
}
const fireVis = (doc, listeners) => { for (const h of listeners.slice()) h(); };

describe('L16-W5 §A 结构锚点', () => {
  test('canonical 具备 _calTgVisHandler，startCalTgTimer 注册、clearCalTgTimer 注销可见性监听', () => {
    assert.ok(SRC.includes('let _calTgVisHandler=null;'), '缺 _calTgVisHandler 载体');
    assert.ok(FN[0].includes("document.addEventListener('visibilitychange',_calTgVisHandler)"), 'startCalTgTimer 未注册可见性监听');
    assert.ok(DECL[0].includes("document.removeEventListener('visibilitychange',_calTgVisHandler)"), 'clearCalTgTimer 未注销可见性监听');
    assert.ok(FN[0].includes('const tick=()=>{'), 'startCalTgTimer 未抽出 tick 闭包');
    assert.ok(FN[0].includes('setInterval(tick,60000)'), 'startCalTgTimer 未以 tick 建立 60s 轮询');
    assert.ok(DECL[0].includes('clearInterval(_calTgTimer)'), 'clearCalTgTimer 未清理轮询');
  });
});

describe('L16-W5 §B 前台启动', () => {
  test('可见时建立唯一 60s 轮询并注册一个监听', () => {
    const h = makeHarness({ hidden: false, lineConnected: true });
    h.H.startCalTgTimer(h.wrap);
    assert.equal(h.intervals.size, 1, '前台应建立 1 个轮询');
    assert.equal([...h.intervals.values()][0].ms, 60000, '轮询周期应为 60000ms');
    assert.equal(h.listeners.length, 1, '应注册 1 个 visibilitychange 监听');
    assert.ok(h.H.getTimer(), '_calTgTimer 应被赋值');
    assert.ok(h.H.getVis(), '_calTgVisHandler 应被赋值');
  });
});

describe('L16-W5 §C 切后台停表', () => {
  test('document.hidden 时清空轮询（后台零 tick）', () => {
    const h = makeHarness({ hidden: false, lineConnected: true });
    h.H.startCalTgTimer(h.wrap);
    assert.equal(h.intervals.size, 1);
    h.doc.hidden = true;
    fireVis(h.doc, h.listeners);
    assert.equal(h.intervals.size, 0, '切后台应停止轮询');
    assert.equal(h.H.getTimer(), null, '停表后 _calTgTimer 应置空');
  });
});

describe('L16-W5 §D 回前台自启 + 立即重定位', () => {
  test('可见且线仍在挂时重启轮询并即刻 tick 一次', () => {
    const h = makeHarness({ hidden: false, lineConnected: true });
    h.H.startCalTgTimer(h.wrap);
    h.doc.hidden = true;
    fireVis(h.doc, h.listeners);
    assert.equal(h.intervals.size, 0);
    delete h.line.style.transform;
    h.doc.hidden = false;
    fireVis(h.doc, h.listeners);
    assert.equal(h.intervals.size, 1, '回前台应重启轮询');
    assert.ok(String(h.line.style.transform).includes('translateY'), '回前台应立即 tick 重定位红线');
  });
});

describe('L16-W5 §E 回前台线未挂不重启', () => {
  test('line.isConnected=false 时不重启（等价非周视图）', () => {
    const h = makeHarness({ hidden: false, lineConnected: true });
    h.H.startCalTgTimer(h.wrap);
    h.doc.hidden = true;
    fireVis(h.doc, h.listeners);
    h.line.isConnected = false;
    h.doc.hidden = false;
    fireVis(h.doc, h.listeners);
    assert.equal(h.intervals.size, 0, '线未挂不应重启轮询');
  });
});

describe('L16-W5 §F 注销语义', () => {
  test('clearCalTgTimer 移除监听并置空句柄', () => {
    const h = makeHarness({ hidden: false, lineConnected: true });
    h.H.startCalTgTimer(h.wrap);
    assert.equal(h.listeners.length, 1);
    h.H.clearCalTgTimer();
    assert.equal(h.intervals.size, 0, 'clearCalTgTimer 应清轮询');
    assert.equal(h.listeners.length, 0, 'clearCalTgTimer 应注销可见性监听');
    assert.equal(h.H.getVis(), null, 'clearCalTgTimer 应置空句柄');
    h.doc.hidden = true;
    fireVis(h.doc, h.listeners); /* 监听已移除：调用不应产生副作用 */
    assert.equal(h.intervals.size, 0);
  });
});

describe('L16-W5 §G 重渲染幂等', () => {
  test('重复 startCalTgTimer 不产生重复轮询 / 重复监听', () => {
    const h = makeHarness({ hidden: false, lineConnected: true });
    h.H.startCalTgTimer(h.wrap);
    h.H.startCalTgTimer(h.wrap);
    assert.equal(h.intervals.size, 1, '重复启动应只保留 1 个轮询');
    assert.equal(h.listeners.length, 1, '重复启动应只保留 1 个监听');
  });
});

describe('L16-W5 §H tick 自清理', () => {
  test('线卸载后 tick 经 clearCalTgTimer 一并清轮询 + 注销监听', () => {
    const h = makeHarness({ hidden: false, lineConnected: true });
    h.H.startCalTgTimer(h.wrap);
    const tick = [...h.intervals.values()][0].fn;
    h.line.isConnected = false;
    tick();
    assert.equal(h.intervals.size, 0, 'tick 检得线卸载应清轮询');
    assert.equal(h.listeners.length, 0, 'tick 清轮询应一并注销监听');
  });
});
