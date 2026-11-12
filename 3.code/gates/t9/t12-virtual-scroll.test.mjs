/**
 * L12-W3 · E-2「M-H 真虚拟滚动」N 层 — 窗口化渲染契约 + 破坏面台账锚点（一致性套件）
 * ============================================================================
 * 设计依据：`reports/t12-design-2026-10-15.md` §三（H2 绝对定位 / H3 DOM 复用 / H4 交互重写）+
 *          §四（交互破坏面台账 D-1…D-8）+ §五 5.2（N 层门禁）+ §八（不变量 #32）。
 * 层归属：本节为 N 层（Node，无浏览器）。真虚拟滚动的**结构性断言**由 P 层
 *          `tests/t12-virtual-scroll.spec.ts`（T-105 – T-110）承担；本节以**产物级结构性扫描**
 *          + **窗口计算契约**表达等价语义（S-4「探针只读不改语义」），二者互补。
 * 诚实声明：N 侧不驱动浏览器；「渲染节点数 ≤ 视口上限」以窗口计算契约的性质断言表达，
 *          真实 DOM 计数由 P 层 T-105/T-106 独立承担（本节不得当作「真实 DOM 已验证」）。
 *
 * 运行：`node --test l9/t12-virtual-scroll.test.mjs`（Node ≥ 22）
 * 红证先行：引擎缺位（无 `_vsWindow` / `VS_ROW_H`）时本文件必须失败。
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

function num(name, fallback) {
  const m = SRC.match(new RegExp('(?:^|[^A-Za-z0-9_])' + name + '\\s*=\\s*(\\d+)'));
  return m ? Number(m[1]) : fallback;
}
const VIRTUAL_THRESHOLD = num('VIRTUAL_THRESHOLD', 200);
const VS_ROW_H = num('VS_ROW_H', 0);
const VS_OVERSCAN = num('VS_OVERSCAN', 0);
const VS_MAX_ROWS = num('VS_MAX_ROWS', 0);
const VIEWPORT_CAP = 200; /* P 层视口上限（l12-w1 §四 冻结） */

/* 窗口计算契约：与 canonical `_vsWindow` 同口径（first/last 为可视区间，含 overscan 与硬上限）。 */
function windowOf({ total, scrollTop, vh, layerTop = 0, rowH = VS_ROW_H, overscan = VS_OVERSCAN, maxRows = VS_MAX_ROWS }) {
  let first = Math.max(0, Math.floor((scrollTop - layerTop) / rowH) - overscan);
  let last = Math.min(total, Math.ceil((scrollTop - layerTop + vh) / rowH) + overscan);
  if (last < first) last = first;
  if (last - first > maxRows) last = Math.min(total, first + maxRows);
  return { first, last };
}

describe('L12-W3 §窗口计算契约（H2 绝对定位 · 视口上限）', () => {
  test('常量接地 · 阈值/行高/预渲染/池上限均为有效整数', () => {
    assert.ok(VIRTUAL_THRESHOLD > 0, 'VIRTUAL_THRESHOLD');
    assert.ok(VS_ROW_H > 0, 'VS_ROW_H');
    assert.ok(VS_OVERSCAN >= 0, 'VS_OVERSCAN');
    assert.ok(VS_MAX_ROWS > 0, 'VS_MAX_ROWS');
  });

  test('渲染工作集规模 · 任意滚动位置 ≤ 池上限（< 视口上限 200）', () => {
    assert.ok(VS_MAX_ROWS < VIEWPORT_CAP, 'VS_MAX_ROWS 必须 < 视口上限 200');
    const total = 100000;
    const contentH = total * VS_ROW_H;
    for (const scrollTop of [0, 137, 5000, 99999, 1_500_000, Math.max(0, contentH - 720)]) {
      for (const vh of [600, 720, 1080, 2160]) {
        const w = windowOf({ total, scrollTop, vh });
        const count = w.last - w.first;
        assert.ok(count <= VS_MAX_ROWS, `count=${count} ≤ ${VS_MAX_ROWS}`);
        assert.ok(count <= VIEWPORT_CAP, `count=${count} ≤ ${VIEWPORT_CAP}`);
        assert.ok(w.first >= 0 && w.last <= total, '区间落在 [0,total]');
      }
    }
  });

  test('视口外不在 DOM · 窗口严格小于全量且首行归零', () => {
    const total = 100000;
    const w = windowOf({ total, scrollTop: 0, vh: 720 });
    assert.ok(w.last - w.first < total, '窗口严格小于全量');
    assert.equal(w.first, 0, '起始滚动 → 首行 = 0');
  });

  test('不变量 #32 哨兵 · 滚动位置 ↔ 渲染区间映射单调不减', () => {
    const total = 100000;
    let prevFirst = -1; let prevLast = -1;
    for (let s = 0; s <= 60_000; s += 500) {
      const w = windowOf({ total, scrollTop: s, vh: 720 });
      assert.ok(w.first >= prevFirst, `first 单调 @${s}`);
      assert.ok(w.last >= prevLast, `last 单调 @${s}`);
      prevFirst = w.first; prevLast = w.last;
    }
    const end = windowOf({ total, scrollTop: total * VS_ROW_H - 720, vh: 720 });
    assert.equal(end.last, total, '滚到底 → 末行 = total');
  });

  test('可变行高残余（R25）· 估算行高同源且 ≤ 32px', () => {
    assert.ok(VS_ROW_H <= 32, 'VS_ROW_H 估算口径（contain-intrinsic-size 对齐）');
  });
});

describe('L12-W3 §产物级结构性扫描（默认关闭态 + 引擎 API）', () => {
  test('引擎 API 落地（H2 绝对定位 / H3 DOM 复用）', () => {
    for (const tok of ['VS_ROW_H', 'VS_OVERSCAN', 'VS_MAX_ROWS', '_vsFlatten', '_vsWindow',
      '_vsUpdate', '_vsScrollToId', '_buildOutlineBox', 'opts.flat',
      '_renderOutlineVirtual', '_renderPresentationVirtual', 'outline-vs', 'pres-vs']) {
      assert.ok(SRC.includes(tok), `缺 ${tok}`);
    }
  });

  test('降级路径（H5）· _virtualDisabled + fallback 报告锚', () => {
    for (const tok of ['_virtualDisabled', "virtual-scroll-fallback", "classList.add('virtual')"]) {
      assert.ok(SRC.includes(tok), `缺 ${tok}`);
    }
  });

  test('D-7 打印全量渲染锚（beforeprint / afterprint + @media print）', () => {
    for (const tok of ['beforeprint', 'afterprint', '@media print', 'node-print']) {
      assert.ok(SRC.includes(tok), `缺 ${tok}`);
    }
  });

  test('交互破坏面台账 D-1…D-8 锚点存在性', () => {
    const SURFACE = [
      ['D-1', ['outline-ghost', 'outline-drop-line', 'drag-outline', '_lastPointerType']],
      ['D-2', ['outline-selbar', '_outlineSel']],
      ['D-3', ['toggleCollapse', 'collapsed-hint', 'countVisibleNodes']],
      ['D-4', ['indentNode', 'outdentNode', 'commitPendingEditBeforeRender']],
      ['D-5', []],
      ['D-6', ['savedFocus', 'restoreFocus', 'window.getSelection']],
      ['D-7', ['@media print', 'node-print']],
      ['D-8', ['_savedOutlineScroll', '_lastScroll']],
    ];
    const missing = [];
    for (const [s, toks] of SURFACE) for (const t of toks) if (!SRC.includes(t)) missing.push(s + ':' + t);
    assert.deepEqual(missing, []);
  });

  test('默认关闭态（LO-7=A）· 阈值门控 + 原全量路径保留', () => {
    assert.ok(SRC.includes('countVisibleNodes(doc)'), '阈值计数');
    assert.ok(SRC.includes('>VIRTUAL_THRESHOLD'), '阈值门控');
    assert.ok(SRC.includes('_vsShouldUse(doc)'), '虚拟判定接缝');
    assert.ok(SRC.includes('renderOutlineRow(n,0)'), '原全量路径保留');
  });
});
