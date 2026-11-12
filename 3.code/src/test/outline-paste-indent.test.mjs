import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIndentedOutline, parsePasteLines } from '../core/richtext.ts';

class MiniDOM {
  parseFromString(html) {
    const st = [{ childNodes: [] }];
    for (const m of html.matchAll(/<(\/?)(\w+)([^>]*)>|([^<]+)/g)) {
      if (m[4] !== undefined) { if (m[4].trim()) st.at(-1).childNodes.push({ nodeType: 3, nodeValue: m[4] }); continue; }
      if (m[1]) { st.pop(); continue; }
      st.at(-1).childNodes.push({ nodeType: 1, tagName: m[2].toUpperCase(), childNodes: [], querySelector: () => null, get textContent() { return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent || '')).join(''); }, getAttribute: (k) => (new RegExp(k + '="([^"]*)"').exec(m[3]) || [])[1] ?? null });
      st.push(st.at(-1).childNodes.at(-1));
    }
    return { body: { firstChild: st[0].childNodes[0] } };
  }
}
globalThis.DOMParser = MiniDOM;
const tree = (html) => parsePasteLines({ getData: (t) => (t === 'text/html' ? html : '') }).tree;

test('fixPaste-1 多行缩进纯文本解析为节点树', () => {
  const t = parseIndentedOutline('A\n  B\n    C\n  D\nE');
  assert.equal(t.length, 2);
  assert.deepEqual(t.map((n) => n.text), ['A', 'E']);
  assert.deepEqual(t[0].children.map((n) => n.text), ['B', 'D']);
  assert.deepEqual(t[0].children[0].children.map((n) => n.text), ['C']);
});

test('fixPaste-1 制表符缩进同样成树', () => {
  assert.deepEqual(parseIndentedOutline('P\n\tC1\n\t\tG\n\tC2')[0].children.map((n) => n.text), ['C1', 'C2']);
});

test('PASTE-001 无缩近平铺 A\\nB 建为 2 个根节点', () => {
  const t = parseIndentedOutline('A\nB');
  assert.equal(t && t.length, 2);
  assert.deepEqual(t.map((n) => n.text), ['A', 'B']);
});

test('PASTE-001 无缩近平铺 A\\nB\\nC 建为 3 个根节点', () => {
  const t = parseIndentedOutline('A\nB\nC');
  assert.equal(t && t.length, 3);
  assert.deepEqual(t.map((n) => n.text), ['A', 'B', 'C']);
});

test('PASTE-002 嵌套 ul 输出深度 0/1/2', () => {
  const n = tree('<ul><li>A<ul><li>B<ul><li>C</li></ul></li></ul></li></ul>')[0];
  assert.deepEqual([n.text, n.children[0].text, n.children[0].children[0].text], ['A', 'B', 'C']);
});
test('PASTE-002 data-indent 0/1/2 输出链式父子', () => {
  const n = tree('<div data-indent="0">A</div><div data-indent="1">B</div><div data-indent="2">C</div>')[0];
  assert.deepEqual([n.text, n.children[0].text, n.children[0].children[0].text], ['A', 'B', 'C']);
});
test('PASTE-002 平铺无 ind 输出 3 根', () => {
  assert.equal(tree('<div>A</div><div>B</div><div>C</div>').length, 3);
});

test('PASTE-004 剥离无序列表标记 - * +', () => {
  const t = parseIndentedOutline('- 节点A\n  - 节点B');
  assert.deepEqual([t[0].text, t[0].children[0].text], ['节点A', '节点B']);
  assert.deepEqual(parseIndentedOutline('* 星\n+ 加').map((n) => n.text), ['星', '加']);
});

test('PASTE-004 剥离有序列表标记 1. 与 2)', () => {
  assert.deepEqual(parseIndentedOutline('1. 节点A\n2) 节点B').map((n) => n.text), ['节点A', '节点B']);
});

test('PASTE-004 保留连字符开头无空白文本 -abc', () => {
  assert.deepEqual(parseIndentedOutline('-abc\n-def').map((n) => n.text), ['-abc', '-def']);
});
