/**
 * L19 · 批次 2（P1 级隐蔽缺陷）N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：
 *   P1-1  R66 移除标签选择器死代码（openTagPicker / _tagPickerEl / closeTagPicker）
 *         后，现存手动指派入口 promptNewTag 仍保持 commit → _tagIndexCache=null →
 *         renderSidebar / forceRender 的索引即时失效顺序（侧栏标签计数即时刷新）。
 *   P1-2  removeNodeFromMap 的 purgeNodeMeta 改传 {...state, nodes:map}，
 *         使 dbRowHeights / dbColumnWidths 的孤儿键可被清理。
 *   P1-3  JU_SLIDES 文本框 blur 保存原始文本（nn.text=txt），
 *         渲染端 _esc(_plain(n.text)) 保持单次转义。
 * 断言口径：
 *   A 结构锚点（去注释后）；B 行为装配；C 红证（只读冻结锚 frozen-l17 判别力）。
 * 运行：`node --test l9/t19-patch2.test.mjs`（Node >= 22）
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

/* ---------- P1-1 · 标签选择器死代码移除后索引失效语义保持 ---------- */
describe('L19 · P1-1 · 标签选择器死代码移除与手动指派索引失效', () => {
  function assertOrdered(fn, label) {
    const c = fn.indexOf('commit(');
    const inv = fn.indexOf('_tagIndexCache=null;');
    const rs = fn.indexOf('renderSidebar();');
    const fr = fn.indexOf('forceRender();');
    assert.ok(c >= 0, `${label} 缺少 commit`);
    assert.ok(inv > c, `${label} 的 _tagIndexCache=null 必须在 commit 之后`);
    assert.ok(rs > inv, `${label} 的 renderSidebar 必须在索引失效之后`);
    assert.ok(fr > inv, `${label} 的 _tagIndexCache=null 必须在 forceRender 之前`);
  }

  test('A1 全文件零 openTagPicker / _tagPickerEl / closeTagPicker 引用', () => {
    assert.equal(SRC.indexOf('openTagPicker('), -1, 'openTagPicker 仍有引用');
    assert.equal(SRC.indexOf('_tagPickerEl'), -1, '_tagPickerEl 仍有引用');
    assert.equal(SRC.indexOf('closeTagPicker('), -1, 'closeTagPicker 仍有引用');
  });

  test('A2 现存手动指派入口 promptNewTag：commit → _tagIndexCache=null → renderSidebar/forceRender', () => {
    const fn = extractDecl(SRC, 'function promptNewTag(){') || '';
    assert.ok(fn, '缺少 promptNewTag');
    assertOrdered(fn, 'promptNewTag');
  });

  test('B1 索引失效后侧栏计数读取路径回到冷缓存', () => {
    let cache = { 已标记: new Set(['n1']) };
    function invalidate() { cache = null; }
    invalidate();
    assert.equal(cache, null, '失效后应回到冷缓存');
  });

  test('C1 红证：冻结锚 frozen-l17 的 pick / clearTags 段无 _tagIndexCache=null', () => {
    const oldFn = extractDecl(OLD, 'function openTagPicker(nodeId,anchor){') || '';
    const oldPick = oldFn.slice(oldFn.indexOf('const pick='), oldFn.indexOf('const clearTags='));
    const oldClear = oldFn.slice(oldFn.indexOf('const clearTags='), oldFn.indexOf('keys.forEach('));
    assert.ok(oldPick && oldClear, '冻结锚应保留改前形态');
    assert.equal(oldPick.includes('_tagIndexCache=null;'), false, '改前 pick 无索引失效');
    assert.equal(oldClear.includes('_tagIndexCache=null;'), false, '改前 clearTags 无索引失效');
  });
});

/* ---------- P1-2 · removeNodeFromMap 清理 db 元数据 ---------- */
describe('L19 · P1-2 · removeNodeFromMap 清理 dbRowHeights / dbColumnWidths', () => {
  const PURGE = extractDecl(SRC, 'function purgeNodeMeta(s,id){') || '';

  function makeRunner(removeSrc) {
    return new Function(
      'state', 'ui', '_tombstoneSet', 'map', 'id',
      `${PURGE}\n${removeSrc}\nremoveNodeFromMap(map,id);`,
    );
  }

  function fixture() {
    const map = {
      root: { id: 'root', parent: null, children: ['a'] },
      a: { id: 'a', parent: 'root', children: ['b'] },
      b: { id: 'b', parent: 'a', children: [] },
    };
    const state = {
      nodes: map,
      dbRowHeights: { a: 20, b: 30 },
      dbColumnWidths: { 'a::c1': 100, 'b::c2': 120 },
      _localCreated: ['a'],
      _remoteReceived: ['a'],
    };
    const ui = { collapsedDocs: { a: true, b: false } };
    const tomb = [];
    const setTomb = (x) => tomb.push(x);
    return { map, state, ui, tomb, setTomb };
  }

  test('A1 结构锚点：purgeNodeMeta 收到完整 state 且 nodes 覆盖为 map', () => {
    const rm = STRIP(extractDecl(SRC, 'function removeNodeFromMap(map,id){') || '');
    assert.match(rm, /purgeNodeMeta\(\{\.\.\.state, ?nodes:map\},id\)/);
    assert.doesNotMatch(rm, /purgeNodeMeta\(\{nodes:map\},id\)/);
  });

  test('B1 子树删除后 dbRowHeights / dbColumnWidths 无孤儿键', () => {
    const rm = extractDecl(SRC, 'function removeNodeFromMap(map,id){');
    const run = makeRunner(rm);
    const f = fixture();
    run(f.state, f.ui, f.setTomb, f.map, 'a');
    assert.equal(f.map.a, undefined, '节点 a 应删除');
    assert.equal(f.map.b, undefined, '子节点 b 应递归删除');
    assert.equal('a' in f.state.dbRowHeights, false, 'a 行高应清理');
    assert.equal('b' in f.state.dbRowHeights, false, 'b 行高应清理');
    assert.equal('a::c1' in f.state.dbColumnWidths, false, 'a 列宽应清理');
    assert.equal('b::c2' in f.state.dbColumnWidths, false, 'b 列宽应清理');
    assert.deepEqual([...f.tomb].sort(), ['a', 'b']);
    assert.equal('a' in f.ui.collapsedDocs, false);
    assert.deepEqual(f.state._localCreated, []);
    assert.deepEqual(f.state._remoteReceived, []);
  });

  test('C1 红证：冻结锚 frozen-l17 只传 {nodes:map}，db 元数据残留', () => {
    const oldRm = extractDecl(OLD, 'function removeNodeFromMap(map,id){');
    assert.ok(oldRm, '冻结锚应保留改前形态');
    assert.match(STRIP(oldRm), /purgeNodeMeta\(\{nodes:map\},id\)/);
    const run = makeRunner(oldRm);
    const f = fixture();
    run(f.state, f.ui, f.setTomb, f.map, 'a');
    assert.equal(f.map.a, undefined, '节点删除行为应一致');
    assert.equal(f.state.dbRowHeights.a, 20, '改前 a 行高残留');
    assert.equal(f.state.dbColumnWidths['a::c1'], 100, '改前 a 列宽残留');
  });
});

/* ---------- P1-3 · 幻灯片保存路径单次转义 ---------- */
describe('L19 · P1-3 · JU_SLIDES blur 保存原文、渲染单次转义', () => {
  function blurBody(src) {
    const i = src.indexOf("box.addEventListener('blur',function(){");
    if (i < 0) return '';
    const j = src.indexOf('});', i);
    return j > i ? src.slice(i, j + 3) : '';
  }

  test('A1 结构锚点：blur 保存 nn.text=txt（不再 _esc）', () => {
    const b = STRIP(blurBody(SRC));
    assert.match(b, /nn\.text=txt;/);
    assert.doesNotMatch(b, /nn\.text=_esc\(txt\);/);
  });

  test('A2 结构锚点：_paint 渲染仍为 _esc(_plain(n.text)) 单次转义', () => {
    const paint = STRIP(extractDecl(SRC, 'function _paint(ctx){') || '');
    assert.match(paint, /ctx\.box\.innerHTML=_esc\(_plain\(n\.text\)\.trim\(\)\|\|/);
  });

  test('B1 行为：原文保存 + 单次转义不再出现实体字面量', () => {
    const AMP = '&' + 'amp;', LT = '&' + 'lt;', GT = '&' + 'gt;', QUOT = '&' + 'quot;', APOS = '&#' + '39;';
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': AMP, '<': LT, '>': GT, '"': QUOT, "'": APOS }[c]));
    const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '');
    const raw = 'a<b & c';
    const oldShown = esc(stripHtml(esc(raw)));
    const newShown = esc(stripHtml(raw));
    assert.notEqual(oldShown, esc(raw), '改前应双重转义');
    assert.equal(newShown, esc(raw), '改后应单次转义');
    assert.equal(newShown, 'a' + LT + 'b ' + AMP + ' c');
  });

  test('C1 红证：冻结锚 frozen-l17 的 blur 仍 _esc(txt)', () => {
    assert.match(STRIP(blurBody(OLD)), /nn\.text=_esc\(txt\);/);
  });
});
