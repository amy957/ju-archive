/**
 * L16-W1 · 指令 1「合并 runPersist 双重全量序列化」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：runPersist 在 rev 递增后不再二次 JSON.stringify(snapshot,_ORIGIN_STRIP)，
 *          改由首轮 _ORIGIN_STRIP 全量串经 rev token 替换（_revSubstJson）得到落盘串；
 *          替换不可判定（rev 缺位 / 后继异常 / 命中不唯一）时降级为全量重序列化。
 * 断言口径（确定性 · 无 wall-clock 阈值敏感性，承接 L12-W4 范式）：
 *   ① 字节等价：有效落盘串（优化命中取替换串，否则取降级串）=== 全量重序列化产物；
 *      覆盖 rev 键序首 / 中 / 尾、位数跃迁（9→10 / 99→100 / 999→1000 / 0→1）与大 state（20k 节点）；
 *   ② 优化命中：常规路径（无 rev token 字面量）下替换必须命中（排除「永久降级」假绿）；
 *   ③ 转义安全：节点文本含 rev token 字面量时不得误命中（前置字符判定兜底）；
 *   ④ 降级兜底：rev 缺位 / 后继异常 / 命中不唯一 → 返回 null；
 *   ⑤ 结构收敛：runPersist 体内旧「const json2=JSON.stringify(snapshot,_ORIGIN_STRIP);」已消除。
 * 运行：`node --test l9/t16-w1-persist-rev.test.mjs`（Node ≥ 22）
 * 说明：本文件为 N 层等价哨兵；P 层真实落盘断言由既有 l3-reference-semantics /
 *       l8-persist-patch 承担（本文件不得当作「真实产品路径已验证」）。
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const CANONICAL = path.resolve(STEP9, '..', 'canonical', 'v2.0-t3.html');
const SRC = readFileSync(CANONICAL, 'utf8');

/* 从 canonical 文本提取真实产品实现（避免测试内重复实现）：
   _REV_STRIP / _ORIGIN_STRIP（replacer）+ _revSubstJson（rev token 替换）。 */
const _revStripSrc = SRC.match(/const _REV_STRIP=\(k,v\)=>[^\n]*/);
const _originStripSrc = SRC.match(/const _ORIGIN_STRIP=\(k,v\)=>[^\n]*/);
const _revSubstSrc = SRC.match(/function _revSubstJson\([\s\S]*?\n\}/);
assert.ok(_revStripSrc && _originStripSrc && _revSubstSrc, 'canonical 缺少 L16-W1 实现锚点');
const HARNESS = new Function(
  [_revStripSrc[0], _originStripSrc[0], _revSubstSrc[0],
    'return { _REV_STRIP, _ORIGIN_STRIP, _revSubstJson };'].join('\n')
)();
const { _ORIGIN_STRIP, _revSubstJson } = HARNESS;

/* 确定性 state 构造：n 个节点（正文含引号 / 反斜杠 / # 标签），revPos 决定 _rev 的键序位置。 */
function buildState(n, { revPos = 'last', rev = 7, tokenInText = '' } = {}) {
  const nodes = {};
  for (let i = 0; i < n; i++) {
    const id = 'n' + i;
    nodes[id] = {
      id,
      parent: i ? ('n' + ((i / 2) | 0)) : null,
      children: [],
      text: '节点' + i + ' "\\ #tag ' + tokenInText,
      _origin: 'local',
    };
  }
  const st = {};
  if (revPos === 'first') st._rev = rev;
  st.nodes = nodes;
  st.rootId = 'n0';
  if (revPos === 'middle') st._rev = rev;
  st.updatedAt = 1700000000000;
  st._localCreated = [];
  if (revPos === 'last') st._rev = rev;
  return st;
}

/* 模拟 runPersist 落盘：全量串（旧 rev）→ 替换串（快速路径）→ 降级串（若替换为 null）；
   再原地 bump 后取全量重序列化作为参照；随后还原 rev，保证可重复。 */
function diskCompare(st, newRev) {
  const oldRev = st._rev;
  const before = JSON.stringify(st, _ORIGIN_STRIP);
  const fast = _revSubstJson(before, oldRev, newRev);
  st._rev = newRev;
  const ref = JSON.stringify(st, _ORIGIN_STRIP);
  st._rev = oldRev;
  const disk = fast === null ? ref : fast;
  return { fast, ref, disk };
}

describe('L16-W1 §字节等价（runPersist 单次全量序列化）', () => {
  test('大 state（20k 节点）· 落盘串逐字节一致且优化命中', () => {
    const st = buildState(20000);
    const r = diskCompare(st, 8);
    assert.notEqual(r.fast, null, '常规大 state 应命中替换（非降级）');
    assert.equal(typeof r.fast, 'string');
    assert.equal(r.disk, r.ref);
  });

  test('rev 键序首 / 中 / 尾三态均逐字节一致且优化命中', () => {
    for (const revPos of ['first', 'middle', 'last']) {
      const st = buildState(200, { revPos, rev: 7 });
      const r = diskCompare(st, 8);
      assert.notEqual(r.fast, null, `revPos=${revPos} 应命中替换`);
      assert.equal(r.disk, r.ref, `revPos=${revPos}`);
    }
  });

  test('位数跃迁 · 9→10 / 99→100 / 999→1000 / 0→1 逐字节一致', () => {
    for (const [a, b] of [[9, 10], [99, 100], [999, 1000], [0, 1]]) {
      const st = buildState(50, { revPos: 'last', rev: a });
      const r = diskCompare(st, b);
      assert.notEqual(r.fast, null, `${a}->${b} 应命中替换`);
      assert.equal(r.disk, r.ref, `${a}->${b}`);
    }
  });

  test('转义安全 · 节点文本含 rev token 字面量不误命中（落盘仍逐字节一致）', () => {
    const st = buildState(50, { revPos: 'last', rev: 7, tokenInText: '"_rev":7}' });
    const r = diskCompare(st, 8);
    assert.equal(r.disk, r.ref, '含字面量 token 时落盘仍须一致（命中或降级皆可）');
  });
});

describe('L16-W1 §降级兜底（返回 null → 调用方全量重序列化）', () => {
  test('rev 缺位 / 后继异常 / 命中不唯一 → null', () => {
    assert.equal(_revSubstJson('{"nodes":{}}', 0, 1), null, 'rev 缺位');
    assert.equal(_revSubstJson('{"_rev":77}', 7, 8), null, '后继非 ,/}');
    assert.equal(_revSubstJson('{"a":{"_rev":7},"_rev":7}', 7, 8), null, '命中不唯一');
  });
});

describe('L16-W1 §结构收敛（runPersist 体内不再二次全量序列化）', () => {
  test('旧双序列化消除 + 降级分支保留', () => {
    assert.ok(SRC.includes('let json2=_revSubstJson(json,_revOld,state._rev);'), '缺替换调用');
    assert.ok(!SRC.includes('const json2=JSON.stringify(snapshot,_ORIGIN_STRIP);'), '旧二次序列化仍在');
    assert.ok(SRC.includes('if(json2===null)json2=JSON.stringify(snapshot,_ORIGIN_STRIP);'), '缺降级分支');
  });
});
