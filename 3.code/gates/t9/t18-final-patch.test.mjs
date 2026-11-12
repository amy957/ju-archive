/**
 * L18 · 最终补丁波 N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义（P0-1 + P3-1 ~ P3-4，共 5 项）：
 *   P0-1  renderTagsView（chip 点击）/ renderTagNodes：tagIndex 值为 Set（无 map），
 *         原写法 `const ids=tagIndex.get(t)||[]; ids.map(...)` 必抛 TypeError；
 *         改后先 `Array.from(...)` 再映射。
 *   P3-1  _indexWorkerStrikes 死变量退役（请求超时逻辑已于 L17-W3 删除）；
 *         公开 API `__juIndexShadow.strikes` 保留键并恒返回 0（兼容）。
 *   P3-2  GraphLayoutWorker.timeoutStrikes 死变量退役（P1-5 已改为单次超时即重建）。
 *   P3-3  _l7TagCountText：冷缓存占位 '…'，构建期 #cntTags.title='标签索引构建中'，
 *         回调就绪后清除 title。
 *   P3-4  renderSubTags 骨架屏提示「正在构建索引…」（与侧栏 / 骨架默认语义一致）。
 * 断言口径：
 *   A 结构锚点（去注释后）；B 最小装配行为；C 红证（只读冻结锚 frozen-l17 判别力）。
 * 运行：`node --test l9/t18-final-patch.test.mjs`（Node >= 22）
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
const CANONICAL = process.env.JU_L18_CANONICAL
  ? path.resolve(process.env.JU_L18_CANONICAL)
  : path.resolve(STEP9, '..', 'v2.0-t3.html');
/* 只读历史锚（改前形态 · 仅读取 · 不写入） */
const FROZEN_L17 = path.resolve(ROOT, '1.历史归档', '1.1冻结版本', 'v2.0-t13-frozen-t17-2026-10-17.html');

const SRC = readFileSync(CANONICAL, 'utf8');
const OLD = readFileSync(FROZEN_L17, 'utf8');
const STRIP = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

function extractFn(src, head) {
  const s = src.indexOf(head);
  if (s < 0) return null;
  let depth = 0;
  for (let i = src.indexOf('{', s); i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(s, i + 1);
    }
  }
  return null;
}

/* ---------- P0-1 · Set → Array.from ---------- */
describe('L18 · P0-1 · 标签索引值（Set）不得直接 map', () => {
  test('A1 两处取值均为 Array.from(tagIndex.get(t)||[])', () => {
    const code = STRIP(SRC);
    const hits = code.match(/Array\.from\(tagIndex\.get\(t\)\|\|\[\]\)/g) || [];
    assert.equal(hits.length, 2, `期望 2 处 Array.from 包裹，实得 ${hits.length}`);
    assert.doesNotMatch(code, /const ids=tagIndex\.get\(t\)\|\|\[\];/, '仍存在未包裹的 Set 取值');
  });

  test('A2 renderTagNodes 段内 ids 先转数组再 map', () => {
    const fn = STRIP(extractFn(SRC, 'function renderTagNodes(t){') || '');
    assert.ok(fn, '缺少 renderTagNodes');
    const i = fn.indexOf('const ids=');
    assert.ok(i > 0, '缺少 ids 取值');
    assert.match(fn.slice(i, i + 60), /^const ids=Array\.from\(/, 'renderTagNodes 未先转数组');
    assert.match(fn, /const items=ids\.map\(/, 'renderTagNodes items 映射缺失');
  });

  test('B1 Set 取值转数组后映射不抛且顺序保持', () => {
    const tagIndex = new Map([['测试', new Set(['a', 'b', 'c'])], ['空', new Set()]]);
    for (const t of ['测试', '空', '不存在']) {
      const ids = Array.from(tagIndex.get(t) || []);
      const items = ids.map((id) => ({ id })).filter(Boolean);
      assert.equal(items.length, (tagIndex.get(t) || new Set()).size);
    }
    assert.deepEqual(Array.from(tagIndex.get('测试') || []).map((x) => x), ['a', 'b', 'c']);
  });

  test('C1 红证：冻结锚 frozen-l17 同名表达式（未包裹）必抛 TypeError', () => {
    const oldCode = STRIP(OLD);
    assert.match(oldCode, /const ids=tagIndex\.get\(t\)\|\|\[\];/, '冻结锚应保留改前形态');
    const tagIndex = new Map([['测试', new Set(['a'])]]);
    const ids = tagIndex.get('测试') || [];
    assert.throws(() => ids.map((x) => x), TypeError);
  });
});

/* ---------- P3-1 · _indexWorkerStrikes 退役 ---------- */
describe('L18 · P3-1 · _indexWorkerStrikes 死变量退役', () => {
  test('A1 去注释后全文件零 _indexWorkerStrikes', () => {
    assert.doesNotMatch(STRIP(SRC), /_indexWorkerStrikes/, '仍存在 _indexWorkerStrikes 引用');
  });

  test('A2 __juIndexShadow.strikes 键保留且恒返回 0', () => {
    const m = SRC.match(/strikes:function\(\)\{([\s\S]*?)\},/);
    assert.ok(m, '缺少 strikes 导出键（公开 API 不得删除）');
    assert.match(STRIP(m[1]), /return 0;/, 'strikes 应恒返回 0');
    assert.match(SRC, /@deprecated/, 'strikes 应标注 @deprecated');
  });

  test('C1 红证：冻结锚 frozen-l17 仍含该变量与导出', () => {
    assert.match(STRIP(OLD), /let _indexWorkerStrikes=0;/, '冻结锚应为改前形态');
    assert.match(STRIP(OLD), /strikes:function\(\)\{return _indexWorkerStrikes;\}/, '冻结锚导出应为改前形态');
  });
});

/* ---------- P3-2 · timeoutStrikes 退役 ---------- */
describe('L18 · P3-2 · GraphLayoutWorker.timeoutStrikes 死变量退役', () => {
  test('A1 去注释后全文件零 timeoutStrikes', () => {
    assert.doesNotMatch(STRIP(SRC), /timeoutStrikes/, '仍存在 timeoutStrikes 引用');
  });

  test('A2 单次超时重建语义保留（terminate / revoke / ready=false）', () => {
    const fn = STRIP(extractFn(SRC, '_timeoutHit(gen){') || '');
    assert.ok(fn, '缺少 _timeoutHit');
    assert.match(fn, /terminate\(\)/, '缺少 terminate');
    assert.match(fn, /revokeObjectURL/, '缺少 URL revoke');
    assert.match(fn, /this\.ready=false/, '缺少 ready=false');
  });

  test('B1 首超即终止并拒绝挂起请求（无 strikes 写入）', () => {
    const fn = extractFn(SRC, '_timeoutHit(gen){');
    const obj = new Function('return { ' + fn + ' };')();
    let terminated = false;
    let rejected = null;
    obj.pending = { gen: 3 };
    obj.worker = { terminate() { terminated = true; } };
    obj.url = null;
    obj.ready = true;
    obj._rejectPending = (e) => { rejected = e; };
    obj._timeoutHit(3);
    assert.equal(terminated, true);
    assert.equal(obj.ready, false);
    assert.equal('timeoutStrikes' in obj, false);
    assert.ok(rejected && /timeout/.test(rejected.message));
  });

  test('C1 红证：冻结锚 frozen-l17 仍含声明 / 递增 / 清零', () => {
    const code = STRIP(OLD);
    assert.match(code, /this\.timeoutStrikes=0;/, '冻结锚应为改前形态');
    assert.match(code, /this\.timeoutStrikes\+\+;/, '冻结锚应为改前形态');
  });
});

/* ---------- P3-3 · 标签计数占位与 title ---------- */
describe('L18 · P3-3 · _l7TagCountText 占位符与 title 语义', () => {
  function build(src) {
    const el = {
      title: '', textContent: '', removed: '',
      removeAttribute(n) { this.removed = n; if (n === 'title') this.title = ''; },
    };
    const host = new Function(
      '$',
      'l7TagIndexWhenReady',
      'renderSubTags',
      'let _tagIndexCache=null;' + extractFn(src, 'function _l7TagCountText(){') +
        ';return {run:_l7TagCountText,setCache:function(v){_tagIndexCache=v;}};'
    );
    let pendingCb = null;
    let subRendered = 0;
    const api = host(
      () => el,
      (cb) => { pendingCb = cb; },
      () => { subRendered++; }
    );
    /* 模拟后台分块构建完成：先置缓存，再执行登记的回调 */
    const flush = () => { api.setCache(new Set(['a', 'b'])); if (pendingCb) pendingCb(); };
    return { el, api, flush, sub: () => subRendered };
  }

  test('A1 冷缓存返回省略号占位并标注 title', () => {
    const { el, api } = build(SRC);
    assert.equal(api.run(), '…');
    assert.equal(el.title, '标签索引构建中', '构建期应标注 title');
  });

  test('B1 就绪回调回填计数并清除 title', () => {
    const { el, api, flush, sub } = build(SRC);
    api.run();
    flush();
    assert.equal(el.textContent, '2', '应回填标签计数');
    assert.equal(el.removed, 'title', '就绪后应清除 title');
    assert.equal(el.title, '');
    assert.equal(sub(), 1, '应触发侧栏重渲染');
  });

  test('B2 缓存已就绪直接返回计数且不写 title', () => {
    const { el, api } = build(SRC);
    api.setCache(new Set(['a', 'b', 'c']));
    assert.equal(api.run(), '3');
    assert.equal(el.title, '');
  });

  test('C1 红证：冻结锚 frozen-l17 返回 "0" 且不写 title', () => {
    const { el, api } = build(OLD);
    assert.equal(api.run(), '0');
    assert.equal(el.title, '');
  });
});

/* ---------- P3-4 · 侧栏骨架提示 ---------- */
describe('L18 · P3-4 · renderSubTags 骨架提示语义', () => {
  test('A1 骨架段含 ju-skel-hint 与「正在构建索引…」', () => {
    const fn = extractFn(SRC, 'function renderSubTags(){');
    assert.ok(fn, '缺少 renderSubTags');
    assert.match(fn, /ju-skel-hint/, '缺少骨架提示节点');
    assert.match(fn, /正在构建索引…/, '缺少统一提示文案');
    assert.ok(fn.indexOf('正在构建索引…') > fn.indexOf('ju-skel-row'), '提示应在骨架行之后');
  });

  test('C1 红证：冻结锚 frozen-l17 该段无提示文案', () => {
    const fn = extractFn(OLD, 'function renderSubTags(){');
    assert.doesNotMatch(fn, /正在构建索引…/, '冻结锚应为改前形态');
  });
});
