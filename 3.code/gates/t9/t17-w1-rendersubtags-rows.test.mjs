/**
 * L17-W1 · 缺陷修复指令 1「renderSubTags() 未定义变量 tags（Defect-P0-1）」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义（Defect-P0-1）：
 *   renderSubTags() 在 `const tagIndex=buildTagIndex();` 之后直接 `tags.forEach(([t,count])=>{...})`，
 *   而 `tags` 从未在该作用域声明（全文件无全局 tags）⇒ 用户展开「标签」分组时必抛 ReferenceError，
 *   分组行恒不渲染（仅剩骨架 / 新建入口）。
 * 本波改动（L17-W1）：
 *   A. 由 buildTagIndex() 的 Map<tag, Set<id>> 派生 `tagRows=[tag,count]`（count = idSet.size，
 *      索引值为 Set 无 length），按 count 降序排序；
 *   B. 空索引 → 追加 `.sb-row.sb-empty` 占位行（标签「暂无标签」）；
 *   C. 原有 row 构建逻辑原样保留在 `tagRows.forEach(([t,count])=>{...})` 内，仅 count 来源变更。
 * 断言口径：
 *   A. 结构锚点：改后源码含 tagRows 派生；renderSubTags 段内 `tags.forEach` 残留 0。
 *   B. 行为：行数 / 顺序（降序）/ count 文本 = Set.size / dataset.tag / onclick 可用。
 *   C. 边界：空索引占位行 + 新建入口不丢失；索引值无 size（数组形态）→ count=0 且不抛。
 *   D. 折叠分支（!open）仅出新建入口，行为不变（非优化分支保留）。
 *   E. 红证：以只读冻结锚 frozen-l14 的同名函数（改前形态）驱动同一装配 ⇒ ReferenceError。
 *   F. 属性采样：200 组随机索引，count 总和 = 各 Set 大小总和，且非递增。
 * 运行：`node --test l9/t17-w1-rendersubtags-rows.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const ROOT = path.resolve(STEP9, '..', '..');
const CANONICAL = process.env.JU_L17W1_CANONICAL
  ? path.resolve(process.env.JU_L17W1_CANONICAL)
  : path.resolve(STEP9, '..', 'v2.0-t3.html');
/* 只读历史锚（改前形态 · 仅读取 · 不写入） */
const FROZEN_L14 = path.resolve(ROOT, '1.历史归档', '1.1冻结版本', 'v2.0-t3-frozen-t14-2026-10-16.html');

const SRC = readFileSync(CANONICAL, 'utf8');

/* ---------- 1) 提取 renderSubTags 源码段（按列 0 的结束大括号定界） ---------- */
function extractRenderSubTags(src) {
  const s = src.indexOf('function renderSubTags(){');
  assert.ok(s > 0, '源码缺少 function renderSubTags(){');
  const e = src.indexOf('\n}\n', s + 10);
  assert.ok(e > s, 'renderSubTags 结束定界失败');
  return src.slice(s, e + 2);
}
const FN_SRC = extractRenderSubTags(SRC);
/* 仅剥离块注释后再做代码形态断言（本波说明注释中引用了旧写法，避免自证干扰） */
const FN_CODE = FN_SRC.replace(/\/\*[\s\S]*?\*\//g, '');

/* ---------- 2) 最小 DOM 装配（仅实现 renderSubTags 触达的 API） ---------- */
function makeEl(tag) {
  let _txt = '';
  const el = {
    tagName: tag, className: '', innerHTML: '', title: '',
    /* R31：补齐 CSS 自定义属性读写（renderSubTags 已改为 dot.style.setProperty('--tag-color', …)），
       _vars 同时作为行为断言的采样点；background 仍保留以兼容 frozen-l14 改前形态的红证装配 */
    style: {
      cssText: '', background: '', width: '', _vars: {},
      setProperty(k, v) { this._vars[k] = (v == null) ? '' : String(v); },
      getPropertyValue(k) { return this._vars[k] || ''; },
      removeProperty(k) { delete this._vars[k]; },
    },
    dataset: {}, children: [],
    classList: {
      _s: new Set(),
      toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); return this._s.has(c); },
      contains(c) { return this._s.has(c); },
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
    },
    appendChild(c) { el.children.push(c); c.parent = el; return c; },
    addEventListener() {},
    querySelector() { return null; },
    _onclick: null,
  };
  Object.defineProperty(el, 'onclick', {
    get() { return el._onclick; },
    set(v) { el._onclick = v; },
  });
  /* 与真实 DOM 一致：textContent 赋值一律转字符串 */
  Object.defineProperty(el, 'textContent', {
    get() { return _txt; },
    set(v) { _txt = (v == null) ? '' : String(v); },
  });
  return el;
}

const DEP_NAMES = [
  '$', 'ui', 'document', 'buildTagIndex', 'getTagColor', 'openTagPalette', 'showContextMenu',
  'appPrompt', 'appConfirm', 'renameTag', 'removeTag', 'openTag', 'promptNewTag', 'toast',
  'renderSidebar', '_tagIndexCache', '_l7SkeletonEnsureCss', 'l7TagIndexWhenReady',
];

function mountRenderSubTags(fnSrc, opts) {
  opts = opts || {};
  const box = makeEl('div');
  const tagMap = opts.tagMap || new Map();
  const env = {
    $: (sel) => (sel === '#subTags' ? box : null),
    ui: { navExpanded: { tags: opts.open !== false } },
    document: { createElement: (t) => makeEl(t) },
    buildTagIndex: () => tagMap,
    getTagColor: () => '#3b82f6',
    openTagPalette: () => {},
    showContextMenu: () => {},
    appPrompt: () => {},
    appConfirm: () => {},
    renameTag: () => {},
    removeTag: () => {},
    openTag: () => {},
    promptNewTag: () => {},
    toast: () => {},
    renderSidebar: () => {},
    _tagIndexCache: opts.cache !== false ? tagMap : null,
    _l7SkeletonEnsureCss: () => {},
    l7TagIndexWhenReady: (cb) => { if (opts.onReady) opts.onReady(cb); },
  };
  const factory = new Function(...DEP_NAMES, fnSrc + '\nreturn renderSubTags;');
  const fn = factory(...DEP_NAMES.map((n) => env[n]));
  return { fn, box };
}

function mapOf(pairs) {
  const m = new Map();
  for (const [t, n] of pairs) {
    const s = new Set();
    for (let i = 0; i < n; i++) s.add('n' + t + '_' + i);
    m.set(t, s);
  }
  return m;
}

function rowOf(el) {
  const kids = el.children;
  return { tag: el.dataset.tag, label: kids[3] && kids[3].textContent, count: kids[4] && kids[4].textContent };
}

/* ---------- 3) A. 结构锚点 ---------- */
describe('L17-W1 · 结构锚点', () => {
  test('改后源码含 tagRows 派生（Set.size 口径）', () => {
    assert.ok(FN_SRC.includes('const tagRows=Array.from(tagIndex.entries())'), '缺少 tagRows 派生');
    assert.ok(FN_SRC.includes("typeof idSet.size==='number'"), '缺少 idSet.size 口径守卫');
    assert.ok(FN_SRC.includes('.sort((a,b)=>b[1]-a[1])'), '缺少计数降序排序');
  });

  test('renderSubTags 段内无裸 tags.forEach 残留', () => {
    assert.equal(/tags\.forEach\(/.test(FN_CODE), false, 'renderSubTags 段内仍有 tags.forEach');
    assert.equal(FN_CODE.includes('const tagIndex=buildTagIndex();\n  tags.forEach'), false);
  });

  test('空索引占位行锚点存在', () => {
    assert.ok(FN_SRC.includes("empty.className='sb-row sb-empty'"), '缺少 sb-empty 占位行');
    assert.ok(FN_SRC.includes('暂无标签'), '占位行缺少「暂无标签」文案');
  });

  test('原有 row 构建逻辑保留（重命名 / 删除 / 改色 / 点击打开）', () => {
    assert.ok(FN_SRC.includes('renameTag(t,nt2)'), '重命名逻辑缺失');
    assert.ok(FN_SRC.includes('removeTag(t)'), '删除逻辑缺失');
    assert.ok(FN_SRC.includes('openTagPalette(row.querySelector'), '改色逻辑缺失');
    assert.ok(FN_SRC.includes('row.onclick=()=>openTag(t)'), '点击打开逻辑缺失');
  });

  /* R31（2026-10-21 · 侧栏标签圆点浅色化）：颜色改由 CSS 变量 --tag-color 承载，
     .sb-tag-dot 的 background/border 由 color-mix 与 var(--tag-color, var(--icon)) 消费。
     本条锁定「变量绑定存在 + 内联 background 不再写入 + 变量值 = getTagColor(t)」。 */
  test('R31：标签圆点以 --tag-color 变量绑定（不再写内联 background）', () => {
    assert.ok(FN_SRC.includes("dot.style.setProperty('--tag-color', getTagColor(t))"), '缺少 --tag-color 变量绑定');
    assert.equal(/dot\.style\.background\s*=/.test(FN_CODE), false, 'renderSubTags 仍写内联 background');
    const { fn, box } = mountRenderSubTags(FN_SRC, { tagMap: mapOf([['设计', 2]]) });
    fn();
    const row = box.children.find((c) => c.dataset.tag === '设计');
    assert.ok(row, '标签行未渲染');
    const dot = row.children.find((c) => c.className === 'sb-tag-dot');
    assert.ok(dot, '缺少 .sb-tag-dot 节点');
    assert.equal(dot.style.getPropertyValue('--tag-color'), '#3b82f6');
    assert.equal(dot.style.background, '', '内联 background 应为空（交由 CSS 变量消费）');
  });
});

/* ---------- 4) B. 行为：行数 / 顺序 / 计数 ---------- */
describe('L17-W1 · 行渲染与计数', () => {
  test('三标签按计数降序渲染且计数等于 Set.size', () => {
    const tagMap = mapOf([['设计', 3], ['工作', 1], ['生活', 2]]);
    const { fn, box } = mountRenderSubTags(FN_SRC, { tagMap });
    assert.doesNotThrow(() => fn());
    const rows = box.children.filter((c) => c.className === 'sb-row' && c.dataset.tag);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map((r) => rowOf(r).tag), ['设计', '生活', '工作']);
    assert.deepEqual(rows.map((r) => rowOf(r).count), ['3', '2', '1']);
    assert.deepEqual(rows.map((r) => rowOf(r).label), ['设计', '生活', '工作']);
    for (const r of rows) assert.equal(typeof r.onclick, 'function');
  });

  test('计数为数字文本 · 不出现 undefined / NaN', () => {
    const tagMap = mapOf([['a', 0], ['b', 7]]);
    const { fn, box } = mountRenderSubTags(FN_SRC, { tagMap });
    fn();
    const counts = box.children.filter((c) => c.dataset.tag).map((r) => rowOf(r).count);
    assert.deepEqual(counts, ['7', '0']);
    for (const c of counts) assert.match(String(c), /^\d+$/);
  });

  test('新建标签入口始终在末尾', () => {
    const tagMap = mapOf([['x', 2]]);
    const { fn, box } = mountRenderSubTags(FN_SRC, { tagMap });
    fn();
    const last = box.children[box.children.length - 1];
    assert.equal(last.className, 'sb-row sb-add');
    assert.equal(typeof last.onclick, 'function');
  });
});

/* ---------- 5) C. 边界：空索引 / 非 Set 值 / 折叠 ---------- */
describe('L17-W1 · 边界与降级', () => {
  test('空索引 → 占位行 + 新建入口（无异常）', () => {
    const { fn, box } = mountRenderSubTags(FN_SRC, { tagMap: new Map() });
    assert.doesNotThrow(() => fn());
    const empty = box.children.filter((c) => c.className === 'sb-row sb-empty');
    assert.equal(empty.length, 1);
    assert.ok(empty[0].innerHTML.includes('暂无标签'));
    assert.equal(box.children[box.children.length - 1].className, 'sb-row sb-add');
  });

  test('索引值为数组（无 size）→ count=0 且不抛', () => {
    const m = new Map([['arr', ['id1', 'id2']], ['set', new Set(['id3'])]]);
    const { fn, box } = mountRenderSubTags(FN_SRC, { tagMap: m });
    assert.doesNotThrow(() => fn());
    const rows = box.children.filter((c) => c.dataset.tag).map(rowOf);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].tag, 'set');
    assert.equal(rows[0].count, '1');
    assert.equal(rows[1].count, '0');
  });

  test('折叠分支（!open）仅出新建入口 · 行为不变', () => {
    const { fn, box } = mountRenderSubTags(FN_SRC, { tagMap: mapOf([['t', 1]]), open: false });
    assert.doesNotThrow(() => fn());
    assert.equal(box.children.length, 1);
    assert.equal(box.children[0].className, 'sb-row sb-add');
    assert.equal(box.classList.contains('open'), false);
  });

  test('展开时 box 标记 open', () => {
    const { fn, box } = mountRenderSubTags(FN_SRC, { tagMap: mapOf([['t', 1]]) });
    fn();
    assert.equal(box.classList.contains('open'), true);
  });
});

/* ---------- 6) E. 红证：只读冻结锚的改前形态 ---------- */
describe('L17-W1 · 红证（frozen-l14 改前形态）', () => {
  test('只读冻结锚存在', () => {
    assert.ok(existsSync(FROZEN_L14), '缺少只读历史锚 frozen-l14');
  });

  test('改前形态在展开标签分组时抛 ReferenceError（tags 未定义）', () => {
    const frozenSrc = readFileSync(FROZEN_L14, 'utf8');
    const oldFn = extractRenderSubTags(frozenSrc);
    assert.ok(oldFn.includes('tags.forEach(([t,count])=>{'), '冻结锚非改前形态（无裸 tags.forEach）');
    const { fn } = mountRenderSubTags(oldFn, { tagMap: mapOf([['设计', 2], ['工作', 1]]) });
    assert.throws(() => fn(), (e) => e instanceof ReferenceError && /tags/.test(String(e.message)));
  });
});

/* ---------- 7) F. 属性采样：计数守恒 + 非递增 ---------- */
describe('L17-W1 · 属性采样（200 组）', () => {
  test('count 总和 = Set 大小总和 · 序列非递增', () => {
    let seed = 20261017;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 200; i++) {
      const n = 1 + Math.floor(rnd() * 12);
      const pairs = [];
      let expectTotal = 0;
      for (let j = 0; j < n; j++) {
        const sz = Math.floor(rnd() * 9);
        pairs.push(['t' + i + '_' + j, sz]);
        expectTotal += sz;
      }
      const { fn, box } = mountRenderSubTags(FN_SRC, { tagMap: mapOf(pairs) });
      fn();
      const rows = box.children.filter((c) => c.dataset.tag).map(rowOf);
      assert.equal(rows.length, n);
      const nums = rows.map((r) => Number(r.count));
      assert.equal(nums.reduce((a, b) => a + b, 0), expectTotal);
      for (let k = 1; k < nums.length; k++) assert.ok(nums[k - 1] >= nums[k], '计数未按降序排列');
      for (const v of nums) assert.ok(Number.isInteger(v) && v >= 0);
    }
  });
});
