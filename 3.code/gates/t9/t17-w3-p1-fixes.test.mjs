/**
 * L17-W3 · 缺陷修复指令 1 / 2 / 3 合并波 N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：
 *   指令 1（P1-1 · initStore 秒级时间戳归一）：旧数据 createdAt / updatedAt 以秒存储时
 *     （0 < v < 1e10）在 initStore 启动归一阶段统一 ×1000 转毫秒，与 mergeRemoteState 的
 *     _normToMs（L16-W21）同口径；微秒级（> 8.64e14）÷1000 与正常毫秒（1e12~1e13）原样保留。
 *     归一幂等；未归一时秒级旧值参与 LWW 比较会被当作远古时间 ⇒ 本波补口后不再被误覆盖。
 *   指令 2（P1-2 · 删除死代码）：原请求超时 strikes 处理函数（与图谱 FIX-P2-2 同口径）全文件
 *     无调用点，已删除；`window.__juIndexShadow` 亦不再导出 timeout 键（无测试引用）。
 *     就绪看门狗 _indexWorkerReadyWatch 使用独立的 readyStrikes 计数，行为零变更。
 *   指令 3（P1-3 · 幻灯片视图卸载）：JU_SLIDES.render(doc) 返回的 wrap 暴露 _cleanup
 *     （移除 window resize 监听 + 从模块级 _cleanups 摘除登记项，幂等）；renderMain() 在
 *     c.innerHTML='' 之前对 .ju-sl-wrap 调用 _cleanup ⇒ 反复切换「幻灯片 ↔ 大纲」监听器不累积。
 * 断言口径：
 *   A. 结构锚点：三段改动在 canonical 中的形态齐备 / 旧形态零残留。
 *   B. 行为：提取 initStore 归一循环与 JU_SLIDES resize 登记块最小装配执行。
 *   C. 端口一致性：归一函数与 mergeRemoteState 的 _normToMs 结果逐值相等。
 *   D. 红证：只读冻结锚 frozen-l14（改前形态）⇒ 三项断言均失败（判别力）。
 * 运行：`node --test l9/t17-w3-p1-fixes.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const ROOT = path.resolve(STEP9, '..', '..');
const CANONICAL = process.env.JU_L17W3_CANONICAL
  ? path.resolve(process.env.JU_L17W3_CANONICAL)
  : path.resolve(STEP9, '..', 'canonical', 'v2.0-t3.html');
/* 只读历史锚（改前形态 · 仅读取 · 不写入） */
const FROZEN_L14 = path.resolve(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t3-frozen-t14-2026-10-16.html');

const SRC = readFileSync(CANONICAL, 'utf8');
const STRIP = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* ---------- 提取器（缺失即返回 null，交由各用例独立断言，保持失败粒度） ---------- */
function tryExtract(src, head, tail) {
  const s = src.indexOf(head);
  if (s < 0) return null;
  const e = src.indexOf(tail, s + head.length);
  if (e < 0) return null;
  return src.slice(s, e + tail.length);
}

function extractInitStore(src) {
  const s = src.indexOf('function initStore(initial){');
  if (s < 0) return null;
  const e = src.indexOf('\n}\n', s + 10);
  if (e < 0) return null;
  return src.slice(s, e + 2);
}

/* initStore 内的节点时间戳归一循环（缩进 2 空格的 for 块） */
function extractNormLoop(src) {
  const fn = extractInitStore(src);
  if (!fn) return null;
  const head = 'for (const id in state.nodes) {';
  const s = fn.indexOf(head);
  if (s < 0) return null;
  const e = fn.indexOf('\n  }\n', s);
  if (e < 0) return null;
  return fn.slice(s, e + 4);
}

function makeNorm(fnBody) {
  return new Function('state', fnBody + '\nreturn state;');
}

/* mergeRemoteState 内的 _normToMs（L16-W21 口径） */
function extractNormToMs(src) {
  const line = 'const _normToMs=t=>{const v=+t;if(!(v>0))return v;return v<1e10?Math.round(v*1000):(v>8.64e14?Math.round(v/1000):v);};';
  if (src.indexOf(line) < 0) return null;
  return new Function(line + '\nreturn _normToMs;')();
}

/* JU_SLIDES.render 内的 resize 登记 / 卸载钩子块 */
function extractSlideCleanupBlock(src) {
  return tryExtract(src, 'const onResize=_throttle(', 'outer._cleanup=_slideCleanup;');
}

/* 最小装配：window 监听计数 + _cleanups 数组 */
function runSlideBlock(block) {
  const live = new Set();
  let addCount = 0;
  let removeCount = 0;
  const window = {
    addEventListener(type, fn) { if (type === 'resize') { addCount++; live.add(fn); } },
    removeEventListener(type, fn) { if (type === 'resize') { removeCount++; live.delete(fn); } }
  };
  const _throttle = (fn) => fn;
  const ctx = { updateRail: null };
  const wrap = {};
  const outer = {};
  const _cleanups = [];
  const run = new Function('window', '_throttle', 'ctx', 'wrap', 'outer', '_cleanups', block);
  run(window, _throttle, ctx, wrap, outer, _cleanups);
  return { wrap, outer, _cleanups, live, addCount, removeCount };
}

/* ---------- 指令 1 · initStore 秒级时间戳归一 ---------- */
describe('L17-W3 · 指令 1 · initStore 秒级时间戳归一', () => {
  test('A1 归一循环含秒级分支（0<v<1e10 ×1000）', () => {
    const loop = extractNormLoop(SRC);
    assert.ok(loop, 'initStore 缺少节点时间戳归一循环');
    const code = STRIP(loop);
    assert.match(code, /n\.createdAt > 0 && n\.createdAt < 1e10/, '缺少 createdAt 秒级分支');
    assert.match(code, /n\.updatedAt > 0 && n\.updatedAt < 1e10/, '缺少 updatedAt 秒级分支');
  });

  test('A2 微秒 / 毫秒既有分支零变更', () => {
    const code = STRIP(extractNormLoop(SRC) || '');
    assert.match(code, /if \(n\.createdAt > 8\.64e14\) n\.createdAt = Math\.round\(n\.createdAt \/ 1000\);/, '微秒 createdAt 分支被改动');
    assert.match(code, /if \(n\.updatedAt > 8\.64e14\) n\.updatedAt = Math\.round\(n\.updatedAt \/ 1000\);/, '微秒 updatedAt 分支被改动');
  });

  test('B1 秒级 → 毫秒（createdAt / updatedAt 同时归一）', () => {
    const norm = makeNorm(extractNormLoop(SRC));
    const state = { nodes: { a: { createdAt: 1750000000, updatedAt: 1750000001 } } };
    norm(state);
    assert.equal(state.nodes.a.createdAt, 1750000000000);
    assert.equal(state.nodes.a.updatedAt, 1750000001000);
  });

  test('B2 微秒仍 ÷1000、正常毫秒原样、零值 / 负值不动', () => {
    const norm = makeNorm(extractNormLoop(SRC));
    const state = {
      nodes: {
        us: { createdAt: 1750000000000000, updatedAt: 1750000000000001 },
        ms: { createdAt: 1750000000123, updatedAt: 1750000000456 },
        zero: { createdAt: 0, updatedAt: 0 },
        neg: { createdAt: -5, updatedAt: -1 },
        hole: null
      }
    };
    norm(state);
    assert.equal(state.nodes.us.createdAt, 1750000000000);
    assert.equal(state.nodes.us.updatedAt, 1750000000000);
    assert.equal(state.nodes.ms.createdAt, 1750000000123);
    assert.equal(state.nodes.ms.updatedAt, 1750000000456);
    assert.equal(state.nodes.zero.createdAt, 0);
    assert.equal(state.nodes.zero.updatedAt, 0);
    assert.equal(state.nodes.neg.createdAt, -5);
    assert.equal(state.nodes.neg.updatedAt, -1);
    assert.equal(state.nodes.hole, null);
  });

  test('B3 幂等：连续两次归一结果不变', () => {
    const norm = makeNorm(extractNormLoop(SRC));
    const state = { nodes: { a: { createdAt: 1750000000, updatedAt: 1750000001 } } };
    norm(state);
    const once = { c: state.nodes.a.createdAt, u: state.nodes.a.updatedAt };
    norm(state);
    assert.equal(state.nodes.a.createdAt, once.c);
    assert.equal(state.nodes.a.updatedAt, once.u);
  });

  test('C1 与 mergeRemoteState 的 _normToMs 结果逐值一致', () => {
    const norm = makeNorm(extractNormLoop(SRC));
    const normToMs = extractNormToMs(SRC);
    assert.ok(normToMs, '未找到 mergeRemoteState 的 _normToMs 口径');
    const samples = [1750000000, 1750000001, 1750000000000, 1750000000123, 1750000000000000];
    for (const v of samples) {
      const state = { nodes: { a: { createdAt: v, updatedAt: v } } };
      norm(state);
      assert.equal(state.nodes.a.createdAt, normToMs(v), 'initStore 与 _normToMs 口径不一致: ' + v);
      assert.equal(state.nodes.a.updatedAt, normToMs(v), 'initStore 与 _normToMs 口径不一致: ' + v);
    }
  });

  test('C2 LWW：秒级旧数据归一后不再压过较新的毫秒值', () => {
    const norm = makeNorm(extractNormLoop(SRC));
    const olderSec = 1750000000;              /* 2025 级秒值（归一后 ~1.75e12） */
    const newerMs = 1750000000500;            /* 同日稍晚毫秒值 */
    const state = { nodes: { a: { createdAt: olderSec, updatedAt: olderSec } } };
    norm(state);
    assert.ok(state.nodes.a.updatedAt < newerMs, '归一后仍不小于较新的毫秒值');
    assert.ok(state.nodes.a.updatedAt > 1e12, '归一结果不是毫秒量级');
    /* 未归一时同一比较会得到相反结论（缺陷根因口径） */
    assert.ok(olderSec < newerMs);
  });
});

/* ---------- 指令 2 · 删除死代码 ---------- */
describe('L17-W3 · 指令 2 · 请求超时 strikes 死代码清除', () => {
  test('A1 全文件无该函数标识符残留', () => {
    assert.equal(SRC.indexOf('_indexWorkerTimeout'), -1, '仍残留 _indexWorkerTimeout');
  });

  test('A2 __juIndexShadow 不再导出 timeout 键', () => {
    const block = tryExtract(SRC, 'window.__juIndexShadow={', '};');
    assert.ok(block, '未找到 __juIndexShadow 导出块');
    assert.equal(/\btimeout\s*:/.test(STRIP(block)), false, '__juIndexShadow 仍导出 timeout');
  });

  test('A3 就绪看门狗与 readyStrikes 独立计数保留', () => {
    assert.ok(SRC.indexOf('function _indexWorkerReadyWatch(gen){') > 0, '缺少 _indexWorkerReadyWatch');
    const code = STRIP(tryExtract(SRC, 'function _indexWorkerReadyWatch(gen){', '\n}') || '');
    assert.match(code, /_indexWorkerReadyStrikes\+\+/, '就绪看门狗未使用独立 readyStrikes');
    assert.match(code, /if\(_indexWorkerReadyStrikes>=2\)/, '就绪看门狗降级门槛被改动');
    assert.match(STRIP(SRC), /readyStrikes:function\(\)\{return _indexWorkerReadyStrikes;\}/, '缺少 readyStrikes 公开导出');
  });

  test('A4 其余公开导出保持不变（签名冻结）', () => {
    const block = STRIP(tryExtract(SRC, 'window.__juIndexShadow={', '};') || '');
    for (const key of ['applyDelta', 'onMessage', 'gen', 'strikes', 'readyStrikes', 'workerUrl', 'setMode', 'query']) {
      assert.match(block, new RegExp('\\b' + key + '\\s*:'), '公开导出缺失: ' + key);
    }
  });
});

/* ---------- 指令 3 · JU_SLIDES 卸载 ---------- */
describe('L17-W3 · 指令 3 · JU_SLIDES 视图卸载回收', () => {
  test('A1 render 暴露 wrap._cleanup / outer._cleanup', () => {
    assert.ok(/wrap\._cleanup=_slideCleanup;/.test(SRC), '缺少 wrap._cleanup 暴露');
    assert.ok(/outer\._cleanup=_slideCleanup;/.test(SRC), '缺少 outer._cleanup（.ju-sl-wrap 卸载锚）');
  });

  test('A2 卸载钩子移除 resize 监听并摘除 _cleanups 登记项', () => {
    const block = STRIP(extractSlideCleanupBlock(SRC) || '');
    assert.match(block, /window\.addEventListener\('resize',onResize\);/, '缺少 resize 登记');
    assert.match(block, /window\.removeEventListener\('resize',onResize\);/, '缺少 resize 移除');
    assert.match(block, /_cleanups\.indexOf\(_slideCleanup\)/, '未从 _cleanups 摘除登记项');
    assert.match(block, /_cleanups\.splice\(i,1\)/, '未从 _cleanups 摘除登记项');
    assert.match(block, /_cleanups\.push\(_slideCleanup\)/, '缺少 pagehide 全局兜底登记');
  });

  test('B1 钩子幂等：调用后监听归零、登记项归零', () => {
    const h = runSlideBlock(extractSlideCleanupBlock(SRC));
    assert.equal(h.addCount, 1);
    assert.equal(h.live.size, 1);
    assert.equal(h._cleanups.length, 1);
    h.wrap._cleanup();
    assert.equal(h.live.size, 0, '调用后 resize 监听未移除');
    assert.equal(h._cleanups.length, 0, '调用后 _cleanups 登记项未摘除');
    h.wrap._cleanup();
    assert.equal(h.live.size, 0);
    assert.equal(h._cleanups.length, 0);
    assert.equal(h.outer._cleanup, h.wrap._cleanup, 'outer 与 wrap 未共享同一钩子');
  });

  test('B2 反复切换 20 次：活跃监听器不累积（≤1）', () => {
    const block = extractSlideCleanupBlock(SRC);
    let maxLive = 0;
    let last = null;
    for (let i = 0; i < 20; i++) {
      last = runSlideBlock(block);      /* 每次渲染 = 新 wrap */
      maxLive = Math.max(maxLive, last.live.size);
      last.outer._cleanup();            /* 切走 → 视图卸载 */
      maxLive = Math.max(maxLive, last.live.size);
    }
    assert.ok(maxLive <= 1, 'resize 监听器数量累积: ' + maxLive);
    assert.equal(last.live.size, 0, '卸载后仍有活跃监听');
    assert.equal(last._cleanups.length, 0, '卸载后 _cleanups 残留登记项');
  });

  test('A3 renderMain 在 c.innerHTML 清空前调用 .ju-sl-wrap 卸载钩子', () => {
    const iHook = SRC.indexOf("const oldSlides=content&&content.querySelector('.ju-sl-wrap');");
    assert.ok(iHook > 0, 'renderMain 缺少 .ju-sl-wrap 卸载钩子');
    assert.ok(SRC.indexOf('if(oldSlides&&oldSlides._cleanup)oldSlides._cleanup();', iHook) > 0, '缺少 _cleanup 调用');
    const iClear = SRC.indexOf("c.innerHTML='';", iHook);
    assert.ok(iClear > iHook, '卸载钩子未位于 c.innerHTML=\'\' 之前');
    const renderMainStart = SRC.indexOf('function renderMain(){');
    assert.ok(iHook > renderMainStart && iHook < iClear, '卸载钩子不在 renderMain 卸载段内');
  });

  test('A4 与既有图谱 / 导图卸载钩子同址（顺序不冲突）', () => {
    const iGraph = SRC.indexOf("if(oldGraph&&oldGraph._cleanup)oldGraph._cleanup();");
    const iMM = SRC.indexOf("if(oldMM&&oldMM._cleanup)oldMM._cleanup();");
    const iSlides = SRC.indexOf("const oldSlides=content&&content.querySelector('.ju-sl-wrap');");
    assert.ok(iGraph > 0 && iMM > iGraph && iSlides > iMM, '卸载钩子顺序异常');
  });
});

/* ---------- 红证 · 改前形态（只读冻结锚）---------- */
describe('L17-W3 · 红证（frozen-l14 改前形态 · 判别力）', () => {
  const frozen = readFileSync(FROZEN_L14, 'utf8');

  test('D1 改前形态仍含死代码标识符', () => {
    assert.ok(frozen.indexOf('_indexWorkerTimeout') > 0, 'frozen-l14 不含该函数，红证判别力不足');
  });

  test('D2 改前形态无秒级归一分支', () => {
    const loop = extractNormLoop(frozen) || '';
    assert.equal(/n\.createdAt < 1e10/.test(loop), false, 'frozen-l14 已含秒级分支，红证判别力不足');
  });

  test('D3 改前形态无幻灯片卸载钩子', () => {
    assert.equal(frozen.indexOf('wrap._cleanup=_slideCleanup'), -1, 'frozen-l14 已含卸载钩子，红证判别力不足');
    assert.equal(frozen.indexOf("const oldSlides=content&&content.querySelector('.ju-sl-wrap');"), -1, 'frozen-l14 已含 renderMain 卸载段');
  });
});
