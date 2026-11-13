/**
 * L16-W12 · Defect-B regression: applyPatch children hole filter
 * ---------------------------------------------------------------------------
 * Coverage:
 *   A. structural anchors of the L16-W12 block inside applyPatch
 *   B. repro: undo of an appended child writes back a holed children array -> all strings
 *   C. same-level duplicate removed
 *   D. dangling (deleted) child id removed
 *   E. patches that cannot carry children are untouched (children array identity kept)
 *   F. previous state is not mutated (structure sharing preserved)
 *   G. patch values are not mutated (undo/redo reuse the same patch object)
 *   H. redo direction is filtered as well
 *   I. property: 60 seeded scenarios, I1/I2/I3 invariants all clean
 *   J. 5,000-node state P95 for the filtered write-back
 *   K. root node children stay valid
 *
 * Run: `node --test l9/t16-w12-patch-children-holes.test.mjs` (Node >= 22)
 * Registry: this file is NOT part of the 43-party registry (party count stays 43).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CANON = path.join(HERE, '..', '..', 'canonical', 'v2.0-t3.html');
const SRC = fs.readFileSync(CANON, 'utf8');

function grab(re, name) {
  const m = SRC.match(re);
  if (!m) throw new Error('canonical missing ' + name);
  return m[0];
}

const COPYPLAIN_SRC = grab(/function copyPlain\(src\)\{[\s\S]*?\n\}/, 'copyPlain');
const PRODUCE_SRC = grab(/function __juProduce\(base, recipe\)\{[\s\S]*?\n\}/, '__juProduce');
const PRODUCESAFE_SRC = grab(/function __juProduceSafe\(base,recipe\)\{[\s\S]*?\n\}/, '__juProduceSafe');
const EXTRACT_SRC = grab(/function extractAtPaths\(s,paths\)\{[\s\S]*?\n\}/, 'extractAtPaths');
const SETPATH_SRC = grab(/function setByPath\(s,path,value\)\{[\s\S]*?\n\}/, 'setByPath');
const APPLY_SRC = grab(/function applyPatch\(s,patch,direction\)\{[\s\S]*?\n\}/, 'applyPatch');
const BUILD_SRC = grab(/function buildPatch\(opts\)\{[\s\S]*?\n\}/, 'buildPatch');
const REPAIR_SRC = grab(/function repairTreeConsistency\(\)\{[\s\S]*?\n\}/, 'repairTreeConsistency');

const api = new Function(
  'repairTreeConsistency',
  'const _MAX_PATH_DEPTH=8;\n' +
    COPYPLAIN_SRC + '\n' +
    PRODUCE_SRC + '\n' +
    PRODUCESAFE_SRC + '\n' +
    EXTRACT_SRC + '\n' +
    SETPATH_SRC + '\n' +
    APPLY_SRC + '\n' +
    BUILD_SRC + '\n' +
    'return {extractAtPaths,setByPath,applyPatch,buildPatch};',
)(function () {});

function mkState(children, extraNodes) {
  const nodes = {
    root: { id: 'root', parent: null, children: ['doc'], updatedAt: 1000 },
    doc: { id: 'doc', parent: 'root', children, updatedAt: 1000 },
    a: { id: 'a', parent: 'doc', children: [], updatedAt: 1000 },
    b: { id: 'b', parent: 'doc', children: [], updatedAt: 1000 },
  };
  if (extraNodes) for (const k of Object.keys(extraNodes)) nodes[k] = extraNodes[k];
  return { rootId: 'root', updatedAt: 1000, nodes };
}

function buildPatchFor(preState, postState, paths) {
  const pre = api.extractAtPaths(preState, paths);
  const post = api.extractAtPaths(postState, paths);
  const raw = api.buildPatch({ t: 2000, op: 'appendChild', mode: 'snapshot', paths, pre, post, meta: {} });
  /* history persistence boundary: undefined / holes become null */
  return JSON.parse(JSON.stringify(raw));
}

function checkInvariants(state) {
  const ns = state.nodes;
  for (const id in ns) {
    const n = ns[id];
    if (!n || !Array.isArray(n.children)) continue;
    const seen = new Set();
    for (const cid of n.children) {
      assert.equal(typeof cid, 'string', 'I1: children entry must be a string (' + id + ')');
      assert.ok(ns[cid], 'I2: children entry must exist in nodes (' + id + ' -> ' + cid + ')');
      assert.equal(seen.has(cid), false, 'I3: duplicate child id (' + id + ' -> ' + cid + ')');
      seen.add(cid);
    }
  }
}

/* ---------- A. structural anchors ---------- */
test('A1: applyPatch carries the L16-W12 children hole filter', () => {
  assert.match(APPLY_SRC, /L16-W12/);
  assert.match(APPLY_SRC, /typeof _cid!=='string'\|\|!_ns\[_cid\]/);
  assert.match(APPLY_SRC, /_seen\.has\(_cid\)/);
  assert.match(APPLY_SRC, /_write\[_id\]=Object\.assign\(\{\},_n,\{children:_kept\}\)/);
});

test('A2: hole filtering is inlined (no repairTreeConsistency(next)); its signature stays parameterless', () => {
  /* 现行实现已把洞过滤内联进 applyPatch（repairTreeConsistency 只看模块级 state，无法作用于 next），
     故此处守护「不得回退到 repairTreeConsistency(next) 依赖」+「签名保持无参」两条契约。 */
  assert.equal(APPLY_SRC.includes('repairTreeConsistency('), false, 'applyPatch 不得再调用 repairTreeConsistency(next)');
  assert.match(APPLY_SRC, /if\(_childrenPatched\)\{/, 'applyPatch 须保留内联洞过滤分支');
  assert.match(REPAIR_SRC, /^function repairTreeConsistency\(\)\{/, 'repairTreeConsistency must stay parameterless');
});

/* ---------- B. repro ---------- */
test('B1: undo of an appended child no longer plants null holes', () => {
  const pre = mkState(['a', undefined, 'b']);
  const post = mkState(['a', undefined, 'b', 'c'], {
    c: { id: 'c', parent: 'doc', children: [], updatedAt: 2000 },
  });
  const patch = buildPatchFor(pre, post, ['nodes.doc.children', 'nodes.c', 'updatedAt']);
  const next = api.applyPatch(post, patch, 'undo');
  assert.deepEqual(next.nodes.doc.children, ['a', 'b']);
  assert.equal(next.nodes.doc.children.every((x) => typeof x === 'string'), true);
});

/* ---------- C. duplicates ---------- */
test('C1: same-level duplicate ids are removed', () => {
  const pre = mkState(['a', 'b', 'b']);
  const post = mkState(['a', 'b', 'b', 'c'], {
    c: { id: 'c', parent: 'doc', children: [], updatedAt: 2000 },
  });
  const patch = buildPatchFor(pre, post, ['nodes.doc.children', 'nodes.c', 'updatedAt']);
  const next = api.applyPatch(post, patch, 'undo');
  assert.deepEqual(next.nodes.doc.children, ['a', 'b']);
});

/* ---------- D. dangling ids ---------- */
test('D1: deleted / dangling child ids are removed', () => {
  const pre = mkState(['a', 'ghost', 'b']);
  const post = mkState(['a', 'ghost', 'b', 'c'], {
    c: { id: 'c', parent: 'doc', children: [], updatedAt: 2000 },
  });
  const patch = buildPatchFor(pre, post, ['nodes.doc.children', 'nodes.c', 'updatedAt']);
  const next = api.applyPatch(post, patch, 'undo');
  assert.deepEqual(next.nodes.doc.children, ['a', 'b']);
});

/* ---------- E. non-children patches untouched ---------- */
test('E1: patches that cannot carry children keep the children array identity', () => {
  const pre = mkState(['a', 'b', null]); /* pre-existing artifact, unrelated to this patch */
  const post = mkState(['a', 'b', null]);
  const patch = buildPatchFor(pre, post, ['nodes.doc.updatedAt']);
  const next = api.applyPatch(post, patch, 'undo');
  assert.equal(next.nodes.doc.children, post.nodes.doc.children);
});

/* ---------- F. previous state untouched ---------- */
test('F1: the previous state is never mutated', () => {
  const pre = mkState(['a', null, 'b']);
  const post = mkState(['a', null, 'b', 'c'], {
    c: { id: 'c', parent: 'doc', children: [], updatedAt: 2000 },
  });
  const patch = buildPatchFor(pre, post, ['nodes.doc.children', 'nodes.c', 'updatedAt']);
  const beforeRoot = pre.nodes.doc.children.slice();
  const beforePost = post.nodes.doc.children.slice();
  const next = api.applyPatch(post, patch, 'undo');
  assert.deepEqual(pre.nodes.doc.children, beforeRoot);
  assert.deepEqual(post.nodes.doc.children, beforePost);
  assert.notEqual(next.nodes.doc.children, post.nodes.doc.children);
});

/* ---------- G. patch values untouched ---------- */
test('G1: patch pre/post values are not rewritten (redo reuses the same object)', () => {
  const pre = mkState(['a', null, 'b']);
  const post = mkState(['a', null, 'b', 'c'], {
    c: { id: 'c', parent: 'doc', children: [], updatedAt: 2000 },
  });
  const patch = buildPatchFor(pre, post, ['nodes.doc.children', 'nodes.c', 'updatedAt']);
  api.applyPatch(post, patch, 'undo');
  assert.deepEqual(patch.pre['nodes.doc.children'], ['a', null, 'b']);
  assert.deepEqual(patch.post['nodes.doc.children'], ['a', null, 'b', 'c']);
});

/* ---------- H. redo ---------- */
test('H1: redo direction is filtered as well', () => {
  const pre = mkState(['a', 'b']);
  const post = mkState(['a', 'b', null, 'b'], {
    c: { id: 'c', parent: 'doc', children: [], updatedAt: 2000 },
  });
  const patch = buildPatchFor(pre, post, ['nodes.doc.children', 'updatedAt']);
  const next = api.applyPatch(pre, patch, 'redo');
  assert.deepEqual(next.nodes.doc.children, ['a', 'b']);
});

/* ---------- I. property ---------- */
test('I1: 60 seeded scenarios keep I1/I2/I3 clean', () => {
  const seeded = (i) => {
    const base = ['a', 'b'];
    if (i === 0) return base.slice();
    const mode = i % 3;
    let arr;
    if (mode === 0) {
      arr = base.slice();
      arr[0] = undefined;
    } else if (mode === 1) {
      arr = [];
      arr[1] = 'b';
      arr[0] = 'a';
    } else {
      arr = base.slice();
      arr[0] = null;
    }
    arr.push('a');
    arr.push('ghost-' + i);
    return arr;
  };
  for (let i = 0; i < 60; i++) {
    const pre = mkState(seeded(i));
    const post = mkState(['a', 'b', 'c'], {
      c: { id: 'c', parent: 'doc', children: [], updatedAt: 2000 },
    });
    const patch = buildPatchFor(pre, post, ['nodes.doc.children', 'nodes.c', 'updatedAt']);
    const next = api.applyPatch(post, patch, 'undo');
    checkInvariants(next);
    /* surviving order follows the source array; membership must reduce to {a,b} */
    assert.deepEqual(next.nodes.doc.children.slice().sort(), ['a', 'b'], 'scenario ' + i);
  }
});

/* ---------- J. P95 ---------- */
test('J1: 5,000-node state P95 stays within budget', () => {
  const N = 5000;
  const kids = [];
  const extra = {};
  for (let i = 0; i < N; i++) {
    const id = 'k' + i;
    kids.push(id);
    extra[id] = { id, parent: 'doc', children: [], updatedAt: 1000 };
  }
  const preKids = kids.slice();
  for (let i = 0; i < 10; i++) preKids[i * 50] = undefined;
  for (let i = 0; i < 10; i++) preKids[i * 50 + 1] = 'k' + (i * 50 + 2);
  const pre = mkState(preKids, extra);
  const postKids = kids.slice().concat(['x']);
  const post = mkState(postKids, Object.assign({ x: { id: 'x', parent: 'doc', children: [], updatedAt: 2000 } }, extra));
  const patch = buildPatchFor(pre, post, ['nodes.doc.children', 'updatedAt']);
  for (let i = 0; i < 3; i++) api.applyPatch(post, patch, 'undo');
  const ms = [];
  for (let i = 0; i < 20; i++) {
    const t0 = process.hrtime.bigint();
    api.applyPatch(post, patch, 'undo');
    ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  const sorted = ms.slice().sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  assert.ok(p95 <= 50, 'P95 ' + p95.toFixed(3) + 'ms exceeds 50ms');
});

/* ---------- K. root ---------- */
test('K1: root children stay valid after filtering', () => {
  const pre = mkState(['a', 'b']);
  const post = mkState(['a', 'b', 'c'], {
    c: { id: 'c', parent: 'doc', children: [], updatedAt: 2000 },
  });
  const patch = buildPatchFor(pre, post, ['nodes.doc.children', 'nodes.c', 'updatedAt']);
  const next = api.applyPatch(post, patch, 'undo');
  assert.deepEqual(next.nodes.root.children, ['doc']);
  assert.equal(next.nodes.doc.parent, 'root');
});
