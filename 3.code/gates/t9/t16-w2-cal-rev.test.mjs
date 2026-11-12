/**
 * L16-W2 · 指令 2「修正 _renderDayCache 的失效粒度」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：renderCalendarPage 中 _renderDayCache 的代次 _gen 由 state.updatedAt
 *          改为独立日历数据代次 _calDataRev；_calDataRev 仅在「日历数据失效」
 *          （invalidateCalIndex / _calIndexCache 被置空）或「选择态变化」
 *          （ui.selectedDate / ui.calTagFilter）时递增。
 * 断言口径（确定性 · 无 wall-clock 阈值敏感性，承接 L16-W1 范式）：
 *   ① 代次口径收敛：_renderDayCache._gen 比对 _calDataRev，且不再出现
 *      `_renderDayCache._gen!==(state&&state.updatedAt)`；
 *   ② 大纲正文编辑（仅 state.updatedAt 变化）→ 不重建（缓存对象同一性保持）；
 *   ③ 选择态变化（selectedDate / calTagFilter）→ 重建（代次推进 + 新缓存对象）；
 *   ④ 日历数据失效（invalidateCalIndex，模型化「编辑节点 date 字段」）→ 重建；
 *   ⑤ 结构锚点：invalidateCalIndex 内同步推进 _calDataRev；_calIndexCache 置空处均推进代次。
 * 运行：`node --test l9/t16-w2-cal-rev.test.mjs`（Node >= 22）
 * 说明：本文件为 N 层等价哨兵；P 层真实渲染断言由既有日历 / 日历 spec 承担
 *      （本文件不得当作「真实产品路径已验证」）。
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

/* 从 canonical 文本提取真实产品实现（避免测试内重复实现）：
   makeLRU（LRU 载体）+ _calDataRev / _calSelKey 声明 + invalidateCalIndex 函数
   + renderCalendarPage 内的代次判定片段（选择态检测 + _gen 比对）。 */
const srcMakeLRU = SRC.match(/function makeLRU\(max\)\{[\s\S]*?\n\}/);
const srcDataRev = SRC.match(/let _calDataRev=0;/);
const srcSelKey = SRC.match(/let _calSelKey='';/);
const srcInv = SRC.match(/function invalidateCalIndex\(\)\{[\s\S]*?\n\}/);
const srcGen = SRC.match(/const _calSelKeyNow=[\s\S]*?map:makeLRU\(2000\)\};/);
assert.ok(srcMakeLRU, 'canonical 缺少 makeLRU');
assert.ok(srcDataRev && srcSelKey, 'canonical 缺少 L16-W2 代次 / 选择态声明');
assert.ok(srcInv, 'canonical 缺少 invalidateCalIndex');
assert.ok(srcGen, 'canonical 缺少 L16-W2 代次判定片段');

/* 把真实片段装配进一个最小作用域，暴露 invalidateCalIndex + 渲染代次判定。 */
const HARNESS_SRC = [
  'let _calIndexCache=null,_calRecurCache=null,_yearCountsCache=null,_tagIndexCache=null,_calDayCache=null;',
  'let _renderDayCache=null;',
  srcMakeLRU[0],
  srcDataRev[0],
  srcSelKey[0],
  srcInv[0],
  'function _renderGen(){' + srcGen[0] + 'return _renderDayCache;}',
  'function _readRev(){return _calDataRev;}',
  'function _readCache(){return _renderDayCache;}',
  'return {ui:ui,invalidateCalIndex:invalidateCalIndex,_renderGen:_renderGen,_readRev:_readRev,_readCache:_readCache};',
].join('\n');

function makeHarness(uiInit) {
  const ui = Object.assign({ selectedDate: '', calTagFilter: '' }, uiInit);
  return new Function('ui', HARNESS_SRC)(ui);
}

describe('L16-W2 §代次口径收敛（_gen: updatedAt -> _calDataRev）', () => {
  test('_renderDayCache._gen 改用 _calDataRev，旧 updatedAt 代次已消除', () => {
    assert.ok(SRC.includes('if(!_renderDayCache||_renderDayCache._gen!==_calDataRev)'), '缺 _calDataRev 代次比对');
    assert.ok(!SRC.includes('_renderDayCache._gen!==(state&&state.updatedAt)'), '旧 updatedAt 代次仍在');
  });

  test('invalidateCalIndex 内同步推进 _calDataRev', () => {
    assert.ok(srcInv[0].includes('_calDataRev++'), 'invalidateCalIndex 未同步推进代次');
  });

  test('结构锚点 + 同址校验：4 处核心代次推进点齐备，且 _calIndexCache 置空点均推进代次', () => {
    /* ① invalidateCalIndex：置空 _calIndexCache 后同步推进代次 */
    assert.match(srcInv[0], /_calIndexCache=null;[\s\S]{0,160}?_calDataRev\+\+;/, 'invalidateCalIndex 未在置空索引后推进代次');

    /* ② invalidateCalIndexOnly：仅在索引实有缓存（提前返回守卫之后）置空并推进代次 */
    const srcInvOnly = SRC.match(/function invalidateCalIndexOnly\(\)\{[\s\S]*?\n\}/);
    assert.ok(srcInvOnly, 'canonical 缺少 invalidateCalIndexOnly');
    assert.match(srcInvOnly[0], /if\(_calIndexCache===null\)return false;/, 'invalidateCalIndexOnly 缺少「已为 null 直接返回」守卫');
    assert.match(srcInvOnly[0], /_calIndexCache=null;[\s\S]{0,160}?_calDataRev\+\+;/, 'invalidateCalIndexOnly 未在置空索引后推进代次');

    /* ③ 选择态签名分支：ui.selectedDate / ui.calTagFilter 变化时推进代次 */
    assert.match(SRC, /if\(_calSelKeyNow!==_calSelKey\)\{[^}]*_calDataRev\+\+;/, '选择态签名分支未推进代次');

    /* ④ initStore 恢复路径：恢复快照后置空索引并推进代次 */
    assert.match(SRC, /try\{_calIndexCache=null;[^}]*_calDataRev\+\+;[^}]*\}catch\(e\)\{\}/, 'initStore 恢复路径未同时置空索引并推进代次');

    /* 防虚假回归：独立 _calIndexCache=null 赋值点（排除 `let` 声明与 `===null` 比较）须与推进点同址 */
    const assignRe = /(?<!let )_calIndexCache=null/g;
    const sites = [...SRC.matchAll(assignRe)].map((m) => m.index);
    /* 三处置空：invalidateCalIndex / invalidateCalIndexOnly / initStore 恢复路径
       （选择态分支只推进代次、故意不置空索引缓存） */
    assert.equal(sites.length, 3, '独立 _calIndexCache=null 赋值点数量异常：' + sites.length);
    for (const at of sites) {
      const vicinity = SRC.slice(at, at + 160);
      assert.match(vicinity, /_calDataRev\+\+;/, '存在 _calIndexCache=null 未与 _calDataRev++ 同址（虚假回归风险）@' + at);
    }
  });
});

describe('L16-W2 §大纲正文编辑不重建 / 选择态变化重建', () => {
  test('仅 state.updatedAt 变化（连续大纲正文编辑）→ 缓存复用，不重建', () => {
    const h = makeHarness({ selectedDate: '2026-10-16', calTagFilter: '' });
    const c1 = h._renderGen();
    const rev1 = h._readRev();
    assert.equal(c1._gen, rev1, '首次构建后 _gen 应等于当前代次');
    /* state.updatedAt 在每次 commit 均单调递增；本口径下不参与代次，逐次渲染须命中同一缓存对象 */
    for (let i = 0; i < 8; i++) {
      assert.equal(h._renderGen(), c1, '大纲正文编辑触发了日缓存重建');
    }
    assert.equal(h._readRev(), rev1, '大纲正文编辑不应推进日历数据代次');
  });

  test('selectedDate 变化 → 代次推进 + 重建', () => {
    const h = makeHarness({ selectedDate: '2026-10-16', calTagFilter: '' });
    const c1 = h._renderGen();
    const rev1 = h._readRev();
    h.ui.selectedDate = '2026-10-17';
    const c2 = h._renderGen();
    assert.notEqual(c2, c1, 'selectedDate 变化未重建');
    assert.equal(h._readRev(), rev1 + 1, 'selectedDate 变化未推进代次');
    assert.equal(c2._gen, h._readRev());
  });

  test('calTagFilter 变化 → 代次推进 + 重建', () => {
    const h = makeHarness({ selectedDate: '2026-10-16', calTagFilter: '' });
    const c1 = h._renderGen();
    const rev1 = h._readRev();
    h.ui.calTagFilter = 'work';
    const c2 = h._renderGen();
    assert.notEqual(c2, c1, 'calTagFilter 变化未重建');
    assert.equal(h._readRev(), rev1 + 1, 'calTagFilter 变化未推进代次');
  });
});

describe('L16-W2 §日历数据失效触发重建（模型化 date 编辑）', () => {
  test('invalidateCalIndex → 置空缓存 + 代次推进 + 重建', () => {
    const h = makeHarness({ selectedDate: '2026-10-16', calTagFilter: '' });
    const c1 = h._renderGen();
    const rev1 = h._readRev();
    h.invalidateCalIndex();
    assert.equal(h._readRev(), rev1 + 1, 'invalidateCalIndex 未推进代次');
    assert.equal(h._readCache(), null, 'invalidateCalIndex 未置空 _renderDayCache');
    const c2 = h._renderGen();
    assert.notEqual(c2, c1, '日历数据失效后未重建');
    assert.equal(c2._gen, h._readRev());
    assert.ok(c2.map && typeof c2.map.set === 'function', '重建后应具备 LRU map');
  });

  test('代次不变且缓存存在 → 反复渲染命中同一对象（幂等）', () => {
    const h = makeHarness({ selectedDate: '2026-10-16', calTagFilter: '' });
    const c1 = h._renderGen();
    for (let i = 0; i < 12; i++) assert.equal(h._renderGen(), c1);
  });
});
