/**
 * L16-W4 · 指令 4「_syncOutlineHeaderH 改用 ResizeObserver」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：renderMain() 尾部原本每次渲染都经 rAF 调用 _syncOutlineHeaderH(el) 读取
 *           .doc-header.offsetHeight 写 --doc-header-h（每次渲染触发强制布局；且 rAF 前
 *           元素可能已被下一次渲染移除，快速切换视图时读到幽灵节点）。本波改为：
 *           在 renderOutlinePage 挂载后对该 .doc-header 挂 ResizeObserver（_outlineHeaderRO），
 *           观察回调里 wrap.style.setProperty('--doc-header-h', h+'px')；视图切换 / 重渲染
 *           时 disconnect() 旧 RO（renderMain 顶部与视图 _cleanup 同址）。_syncOutlineHeaderH
 *           保留为 applyScale / 无 RO 降级路径，并改为「高度变化才写入」。
 * 断言口径（确定性 · 无 wall-clock 阈值敏感，承接 L16-W1/W2/W3 范式）：
 *   A. 结构锚点：canonical 具备 _outlineHeaderRO / _setOutlineHeaderH / _observeOutlineHeader /
 *      _disconnectOutlineHeaderRO；renderMain 挂载后订阅、顶部断开；大纲 rAF 不再调用
 *      _syncOutlineHeaderH；
 *   B. 写入门槛：_setOutlineHeaderH 仅在 --doc-header-h 变化时写（同高重复调用不重写）；
 *   C. 订阅行为：_observeOutlineHeader 观察 .doc-header，回调按 offsetHeight 刷新；
 *   D. 断开语义：_disconnectOutlineHeaderRO 断开旧 RO 并置空；重订阅先断开上一个；
 *   E. 降级兜底：无 ResizeObserver 时回退 _syncOutlineHeaderH；无 .doc-header 时移除属性。
 * 运行：`node --test l9/t16-w4-outline-header-ro.test.mjs`（Node >= 22）
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

/* 从 canonical 提取真实产品实现（_syncOutlineHeaderH + L16-W4 新增辅助整段），装配进最小作用域。 */
const BLOCK = SRC.match(/function _syncOutlineHeaderH\(wrap\)\{[\s\S]*?\n(?=function renderDocHeaderInline\(doc\)\{)/);
assert.ok(BLOCK, 'canonical 缺少 L16-W4 标题高度订阅辅助段');

function makeHarness(RO) {
  const body = BLOCK[0] + '\nreturn {_syncOutlineHeaderH,_setOutlineHeaderH,_observeOutlineHeader,_disconnectOutlineHeaderRO,getRO:function(){return _outlineHeaderRO;}};';
  return new Function('ResizeObserver', body)(RO);
}

/* ---- 最小 DOM / RO 替身 ---- */
function mkStyle(c) {
  const m = Object.create(null);
  return {
    getPropertyValue: (k) => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : ''),
    setProperty: (k, v) => { c.set++; m[k] = v; },
    removeProperty: (k) => { c.remove++; delete m[k]; },
  };
}
function mkWrap(header) {
  const c = { set: 0, remove: 0 };
  return { style: mkStyle(c), _c: c, querySelector: (sel) => (sel === '.doc-header' ? header : null) };
}
function makeROClass(reg) {
  return class {
    constructor(cb) { this.cb = cb; this.targets = []; this.disconnected = false; }
    observe(el) { this.targets.push(el); }
    disconnect() { this.disconnected = true; }
  };
}

describe('L16-W4 §A 结构锚点', () => {
  test('canonical 具备 _outlineHeaderRO 与订阅 / 断开辅助', () => {
    assert.ok(SRC.includes('let _outlineHeaderRO=null;'), '缺 _outlineHeaderRO 载体');
    assert.ok(SRC.includes('function _setOutlineHeaderH('), '缺 _setOutlineHeaderH');
    assert.ok(SRC.includes('function _observeOutlineHeader('), '缺 _observeOutlineHeader');
    assert.ok(SRC.includes('function _disconnectOutlineHeaderRO('), '缺 _disconnectOutlineHeaderRO');
    assert.ok(SRC.includes('new ResizeObserver('), '缺 ResizeObserver 实例化');
  });

  test('renderMain 挂载后订阅、顶部断开，大纲 rAF 不再调用 _syncOutlineHeaderH', () => {
    const rm = SRC.match(/function renderMain\(\)\{[\s\S]*?\n\}\n/);
    assert.ok(rm, 'canonical 缺少 renderMain');
    const body = rm[0];
    assert.ok(body.includes('_observeOutlineHeader(el)'), 'renderMain 未在大纲挂载后订阅标题尺寸');
    assert.ok(body.includes('_disconnectOutlineHeaderRO()'), 'renderMain 顶部未断开旧标题 RO');
    assert.ok(!/requestAnimationFrame\(\(\)=>\{_syncOutlineHeaderH\(el\)/.test(body), '大纲 rAF 仍调用 _syncOutlineHeaderH（未移除）');
    /* 断开与视图 _cleanup 同址（早于第二个 rAF 段与视图分派） */
    const top = body.slice(0, body.indexOf('switch(view)'));
    assert.ok(top.includes('_disconnectOutlineHeaderRO()'), '断开未位于 renderMain 顶部');
  });

  test('_syncOutlineHeaderH 改为「变化才写入」并经 _setOutlineHeaderH 收口', () => {
    const fn = SRC.match(/function _syncOutlineHeaderH\(wrap\)\{[\s\S]*?\n\}/);
    assert.ok(fn, '缺少 _syncOutlineHeaderH');
    assert.ok(fn[0].includes('_setOutlineHeaderH(wrap,'), '_syncOutlineHeaderH 未收口到 _setOutlineHeaderH');
  });
});

describe('L16-W4 §B 写入门槛（--doc-header-h 仅在变化时更新）', () => {
  const RO = makeROClass([]);
  const H = makeHarness(RO);
  test('同高重复写入不重复 setProperty；变化才写', () => {
    const header = { offsetHeight: 40 };
    const wrap = mkWrap(header);
    H._setOutlineHeaderH(wrap, 40);
    assert.equal(wrap._c.set, 1, '首次应写入');
    H._setOutlineHeaderH(wrap, 40);
    assert.equal(wrap._c.set, 1, '同高重复调用不应重写');
    H._setOutlineHeaderH(wrap, 52);
    assert.equal(wrap._c.set, 2, '高度变化应写入');
    assert.equal(wrap.style.getPropertyValue('--doc-header-h'), '52px');
  });
});

describe('L16-W4 §C 订阅行为（回调按 offsetHeight 刷新）', () => {
  test('_observeOutlineHeader 观察 .doc-header，回调刷新属性', () => {
    const reg = [];
    const H = makeHarness(makeROClass(reg));
    const header = { offsetHeight: 42 };
    const wrap = mkWrap(header);
    H._observeOutlineHeader(wrap);
    assert.equal(H.getRO() && H.getRO().targets.length, 1, '应观察 1 个目标');
    assert.equal(H.getRO().targets[0], header, '观察目标应为 .doc-header');
    /* 触发一次（初始 / 变化） */
    H.getRO().cb([{ target: header }]);
    assert.equal(wrap.style.getPropertyValue('--doc-header-h'), '42px');
    /* 高度变化 */
    header.offsetHeight = 66;
    H.getRO().cb([{ target: header }]);
    assert.equal(wrap.style.getPropertyValue('--doc-header-h'), '66px');
    /* 同高再次触发不重写 */
    const before = wrap._c.set;
    H.getRO().cb([{ target: header }]);
    assert.equal(wrap._c.set, before, '同高回调不应重写属性');
  });
});

describe('L16-W4 §D 断开语义', () => {
  test('_disconnectOutlineHeaderRO 断开并置空；重订阅先断开上一个', () => {
    const reg = [];
    const H = makeHarness(makeROClass(reg));
    const wrap = mkWrap({ offsetHeight: 30 });
    H._observeOutlineHeader(wrap);
    const first = H.getRO();
    assert.ok(first, '首次订阅应创建 RO');
    /* 重订阅：应断开上一个 */
    H._observeOutlineHeader(wrap);
    assert.ok(first.disconnected, '重订阅应先断开旧 RO');
    const second = H.getRO();
    assert.notEqual(second, first, '重订阅应创建新 RO');
    H._disconnectOutlineHeaderRO();
    assert.ok(second.disconnected, '断开应 disconnect 当前 RO');
    assert.equal(H.getRO(), null, '断开后载体应置空');
  });
});

describe('L16-W4 §E 降级兜底', () => {
  test('无 ResizeObserver 时回退 _syncOutlineHeaderH（即时写入）', () => {
    const H = makeHarness(undefined);
    const header = { offsetHeight: 24 };
    const wrap = mkWrap(header);
    H._observeOutlineHeader(wrap);
    assert.equal(H.getRO(), null, '无 RO 时不应创建实例');
    assert.equal(wrap.style.getPropertyValue('--doc-header-h'), '24px', '降级应即时写入');
  });

  test('无 .doc-header 时移除属性', () => {
    const H = makeHarness(makeROClass([]));
    const wrap = mkWrap(null);
    wrap.style.setProperty('--doc-header-h', '99px');
    H._observeOutlineHeader(wrap);
    assert.equal(wrap.style.getPropertyValue('--doc-header-h'), '', '无标题应移除属性');
    assert.equal(H.getRO(), null, '无标题不应创建 RO');
  });
});
