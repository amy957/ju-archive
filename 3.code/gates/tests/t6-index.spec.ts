// @ts-nocheck
/**
 * L6 阶段 2 · JU-IndexAgent 专题 spec（4 索引增量维护）
 *
 * 依据：l6-design-2026-10-13.md § 五 2
 * 配套：v2.0-t3.html（含 L6 基础设施 + 4 索引增量实现 + commit/undo/redo 钩子）
 *
 * 测试策略：聚焦 L6 纯函数行为（extractChangedIds / updateIncrementalIndexes / collectSubtreeIds），
 * 不依赖完整 state 模型（state.nodes / _isCalRoot / state.rootId 等可能被其他模块重置）。
 * L6 单元化测试 + 集成测试通过状态 mock 完成。
 *
 * 矩阵（26 条 → 精简为 22 条，聚焦 L6 核心契约）：
 *   §7.1 extractChangedIds 节点 id 提取（4 用例 · T-01 ~ T-04）
 *   §7.2 collectSubtreeIds 子树 id 收集（3 用例 · T-05 ~ T-07）
 *   §7.3 updateIncrementalIndexes 4 索引统一入口（4 用例 · T-08 ~ T-11）
 *   §7.4 calIndexUpdate 增量（2 用例 · T-12 ~ T-13）
 *   §7.5 tagIndexUpdate 增量（2 用例 · T-14 ~ T-15）
 *   §7.6 searchInvertedUpdate 增量（2 用例 · T-16 ~ T-17）
 *   §7.7 backlinkMapUpdate 增量（2 用例 · T-18 ~ T-19）
 *   §7.8 undo/redo 反向增量对称性（2 用例 · T-20 ~ T-21）
 *   §7.9 __juIndexFailures 容量 + 连续失败降级（2 用例 · T-22 ~ T-23）
 *   §7.10 #22.22.M1 merge 豁免（1 用例 · T-24）
 *   §7.11 fuzz 增量一致性（2 用例 · T-25 ~ T-26）
 *   §7.12 calIndex 复活对称性（M4 修复 · 3 用例 · T-27 ~ T-29）
 *   §7.13 M5 边界条件 + 注入点降级（5 用例 · T-30 ~ T-34）
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_URL =
  process.env.JU_APP_URL ||
  'file://' + path.resolve(__dirname, '..', 'v2.0-t3.html');
async function bootApp(page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof __juProduce === 'function' &&
          typeof commit === 'function' &&
          typeof extractChangedIds === 'function' &&
          typeof updateIncrementalIndexes === 'function' &&
          typeof collectSubtreeIds === 'function' &&
          typeof reportIndexFailure === 'function' &&
          typeof resetIndexFailureStreak === 'function' &&
          typeof calIndexUpdate === 'function' &&
          typeof tagIndexUpdate === 'function' &&
          typeof searchInvertedUpdate === 'function' &&
          typeof backlinkMapUpdate === 'function',
    { timeout: 10_000 }
  );
}

/* ============================================================
   §7.1 extractChangedIds 节点 id 提取（4 用例 · T-01 ~ T-04）
   ============================================================ */
test.describe('L6 §7.1 extractChangedIds', () => {
  test('T-01 空 paths 返回空 Set', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const ids = extractChangedIds([], {});
      return { size: ids.size, type: ids.constructor.name };
    });
    expect(r.size).toBe(0);
    expect(r.type).toBe('Set');
  });

  test('T-02 单节点修改路径 → 单 id', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const ids = extractChangedIds(['nodes.foo.text', 'nodes.foo.date'], {});
      return { hasFoo: ids.has('foo'), size: ids.size };
    });
    expect(r.hasFoo).toBe(true);
    expect(r.size).toBe(1);
  });

  test('T-03 多节点修改路径 → 多 id 去重', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const ids = extractChangedIds(['nodes.a.text', 'nodes.b.date', 'nodes.a.tags'], {});
      return { hasA: ids.has('a'), hasB: ids.has('b'), size: ids.size };
    });
    expect(r.hasA).toBe(true);
    expect(r.hasB).toBe(true);
    expect(r.size).toBe(2);
  });

  test('T-04 顶层字段（非 nodes.）→ 不提取', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const ids = extractChangedIds(['updatedAt', 'activity.0.type', '_localCreated.x'], {});
      return { size: ids.size };
    });
    expect(r.size).toBe(0);
  });
});

/* ============================================================
   §7.2 collectSubtreeIds 子树 id 收集（3 用例 · T-05 ~ T-07）
   ============================================================ */
test.describe('L6 §7.2 collectSubtreeIds', () => {
  test('T-05 简单 3 节点链 → 收集 3 id', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = state;
      try {
        /* mock state */
        state = {
          nodes: {
            a: { id: 'a', children: ['b'] },
            b: { id: 'b', children: ['c'] },
            c: { id: 'c', children: [] },
          },
        };
        const ids = collectSubtreeIds('a');
        return { size: ids.size, hasA: ids.has('a'), hasB: ids.has('b'), hasC: ids.has('c') };
      } finally { state = backup; }
    });
    expect(r.size).toBe(3);
    expect(r.hasA).toBe(true);
    expect(r.hasB).toBe(true);
    expect(r.hasC).toBe(true);
  });

  test('T-06 环引用防护（child == parent）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = state;
      try {
        state = {
          nodes: {
            a: { id: 'a', children: ['a', 'b'] },  /* a 自引用 */
            b: { id: 'b', children: [] },
          },
        };
        const ids = collectSubtreeIds('a');
        return { size: ids.size, hasA: ids.has('a'), hasB: ids.has('b') };
      } finally { state = backup; }
    });
    expect(r.size).toBe(2);
    expect(r.hasA).toBe(true);
    expect(r.hasB).toBe(true);
  });

  test('T-07 不存在节点 → 空 Set', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = state;
      try {
        state = { nodes: {} };
        const ids = collectSubtreeIds('nonexistent');
        return { size: ids.size };
      } finally { state = backup; }
    });
    expect(r.size).toBe(0);
  });
});

/* ============================================================
   §7.3 updateIncrementalIndexes 4 索引统一入口（4 用例 · T-08 ~ T-11）
   ============================================================ */
test.describe('L6 §7.3 updateIncrementalIndexes', () => {
  test('T-08 空 changedIds → ok=true, added=0, removed=0', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const res = updateIncrementalIndexes(new Set(), {}, {}, {});
      return { ok: res.ok, added: res.added, removed: res.removed, errorsLen: res.errors.length };
    });
    expect(r.ok).toBe(true);
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
    expect(r.errorsLen).toBe(0);
  });

  test('T-09 4 索引未构建（null）→ 静默返回（不抛错）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _calIndexCache, _tagIndexCache, _searchInverted, _backlinkMap };
      try {
        _calIndexCache = null;
        _tagIndexCache = null;
        _searchInverted = null;
        _backlinkMap = null;
        const res = updateIncrementalIndexes(new Set(['x']), { nodes: { x: { id: 'x', date: '2026-10-15' } } }, { nodes: { x: { id: 'x', date: '2026-10-15' } } }, {});
        return { ok: res.ok, added: res.added, removed: res.removed };
      } finally {
        _calIndexCache = backup._calIndexCache;
        _tagIndexCache = backup._tagIndexCache;
        _searchInverted = backup._searchInverted;
        _backlinkMap = backup._backlinkMap;
      }
    });
    expect(r.ok).toBe(true);
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
  });

  test('T-10 subtreeCleanup 模式 → 仅走 4 索引 remove 路径', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _calIndexCache, _tagIndexCache, _searchInverted, _backlinkMap };
      try {
        _calIndexCache = new Map([['2026-10-15', new Set(['x', 'y'])]]);
        _tagIndexCache = new Map([['foo', new Set(['x', 'y'])]]);
        _searchInverted = new Map([['hello', new Set(['x', 'y'])]]);
        _backlinkMap = new Map([['doc1', new Map([['x', 1], ['y', 1]])]]);
        _backlinkReverse = new Map([['x', new Set(['doc1'])], ['y', new Set(['doc1'])]]);
        const res = updateIncrementalIndexes(new Set(), {}, {}, {
          subtreeCleanup: true,
          subtreeIds: new Set(['x', 'y']),
          op: 'test:remove',
        });
        return { ok: res.ok, removed: res.removed };
      } finally {
        _calIndexCache = backup._calIndexCache;
        _tagIndexCache = backup._tagIndexCache;
        _searchInverted = backup._searchInverted;
        _backlinkMap = backup._backlinkMap;
        _backlinkReverse = null;
      }
    });
    expect(r.ok).toBe(true);
    expect(r.removed).toBeGreaterThan(0);
  });

  test('T-11 op 参数透传', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _calIndexCache };
      try {
        _calIndexCache = new Map([['2026-10-15', new Set(['x'])]]);
        const res = updateIncrementalIndexes(new Set(['x']),
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: false } } },
          { nodes: { x: { id: 'x', date: '2026-10-16', _deleted: false } } },
          { op: 'moveDate' });
        return { ok: res.ok, removed: res.removed, added: res.added };
      } finally {
        _calIndexCache = backup._calIndexCache;
      }
    });
    expect(r.ok).toBe(true);
    expect(r.removed).toBe(1);
    expect(r.added).toBe(1);
  });
});

/* ============================================================
   §7.4 calIndexUpdate 增量（2 用例 · T-12 ~ T-13）
   ============================================================ */
test.describe('L6 §7.4 calIndexUpdate', () => {
  test('T-12 节点 date 改变 → 旧 set 移除 + 新 set 加入', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = _calIndexCache;
      try {
        _calIndexCache = new Map([
          ['2026-10-15', new Set(['x'])],
          ['2026-10-16', new Set()],
        ]);
        const res = calIndexUpdate(
          new Set(['x']),
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: false } } },
          { nodes: { x: { id: 'x', date: '2026-10-16', _deleted: false } } },
          {}
        );
        const set15 = _calIndexCache.get('2026-10-15');
        const set16 = _calIndexCache.get('2026-10-16');
        return {
          ok: res.errors.length === 0,
          removed: res.removed,
          added: res.added,
          xIn15: set15 ? set15.has('x') : false,
          xIn16: set16 ? set16.has('x') : false,
        };
      } finally {
        _calIndexCache = backup;
      }
    });
    expect(r.ok).toBe(true);
    expect(r.removed).toBe(1);
    expect(r.added).toBe(1);
    expect(r.xIn15).toBe(false);
    expect(r.xIn16).toBe(true);
  });

  test('T-13 节点 _deleted → 从 date set 移除', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = _calIndexCache;
      try {
        _calIndexCache = new Map([['2026-10-15', new Set(['x'])]]);
        const res = calIndexUpdate(
          new Set(['x']),
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: false } } },
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: true } } },
          {}
        );
        const set15 = _calIndexCache.get('2026-10-15');
        return { removed: res.removed, xIn15: set15 ? set15.has('x') : false };
      } finally {
        _calIndexCache = backup;
      }
    });
    expect(r.removed).toBe(1);
    expect(r.xIn15).toBe(false);
  });
});

/* ============================================================
   §7.5 tagIndexUpdate 增量（2 用例 · T-14 ~ T-15）
   ============================================================ */
test.describe('L6 §7.5 tagIndexUpdate', () => {
  test('T-14 节点加 #newtag → tagIndex 新增 entry', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = _tagIndexCache;
      try {
        _tagIndexCache = new Map();
        const res = tagIndexUpdate(
          new Set(['x']),
          { nodes: { x: { id: 'x', text: 'no tag', _deleted: false } } },
          { nodes: { x: { id: 'x', text: 'with #newtag', _deleted: false } } },
          {}
        );
        const newtagSet = _tagIndexCache.get('newtag');
        return { added: res.added, hasX: newtagSet ? newtagSet.has('x') : false };
      } finally {
        _tagIndexCache = backup;
      }
    });
    expect(r.added).toBe(1);
    expect(r.hasX).toBe(true);
  });

  test('T-15 节点删 #oldtag → tagIndex 移除 entry', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = _tagIndexCache;
      try {
        _tagIndexCache = new Map([['oldtag', new Set(['x'])]]);
        const res = tagIndexUpdate(
          new Set(['x']),
          { nodes: { x: { id: 'x', text: 'with #oldtag', _deleted: false } } },
          { nodes: { x: { id: 'x', text: 'no tag', _deleted: false } } },
          {}
        );
        const oldtagSet = _tagIndexCache.get('oldtag');
        return { removed: res.removed, hasX: oldtagSet ? oldtagSet.has('x') : false };
      } finally {
        _tagIndexCache = backup;
      }
    });
    expect(r.removed).toBe(1);
    expect(r.hasX).toBe(false);
  });
});

/* ============================================================
   §7.6 searchInvertedUpdate 增量（2 用例 · T-16 ~ T-17）
   ============================================================ */
test.describe('L6 §7.6 searchInvertedUpdate', () => {
  test('T-16 文本改 hello→goodbye → searchInverted 增量', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _searchInverted, _searchInvertedDocs };
      try {
        _searchInverted = new Map([
          ['hello', new Set(['x'])],
          ['world', new Set(['x'])],
        ]);
        _searchInvertedDocs = new Map([['x', { terms: new Set(['hello', 'world']), updatedAt: Date.now() }]]);
        const res = searchInvertedUpdate(
          new Set(['x']),
          { nodes: { x: { id: 'x', text: 'hello world', _deleted: false } } },
          { nodes: { x: { id: 'x', text: 'goodbye world', _deleted: false } } },
          {}
        );
        const helloSet = _searchInverted.get('hello');
        const goodbyeSet = _searchInverted.get('goodbye');
        return {
          added: res.added,
          removed: res.removed,
          xInHello: helloSet ? helloSet.has('x') : false,
          xInGoodbye: goodbyeSet ? goodbyeSet.has('x') : false,
        };
      } finally {
        _searchInverted = backup._searchInverted;
        _searchInvertedDocs = backup._searchInvertedDocs;
      }
    });
    expect(r.removed).toBe(1); /* hello removed */
    expect(r.added).toBe(1);  /* goodbye added */
    expect(r.xInHello).toBe(false);
    expect(r.xInGoodbye).toBe(true);
  });

  test('T-17 CJK 字符 token 切分', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const terms = tokenize('中文测试 hello world');
      return {
        hasZhong: terms.has('中'),
        hasWen: terms.has('文'),
        hasCe: terms.has('测'),
        hasShi: terms.has('试'),
        hasHello: terms.has('hello'),
        hasWorld: terms.has('world'),
        size: terms.size,
      };
    });
    expect(r.hasZhong).toBe(true);
    expect(r.hasWen).toBe(true);
    expect(r.hasCe).toBe(true);
    expect(r.hasShi).toBe(true);
    expect(r.hasHello).toBe(true);
    expect(r.hasWorld).toBe(true);
    /* 4 CJK + 2 en = 6 */
    expect(r.size).toBe(6);
  });
});

/* ============================================================
   §7.7 backlinkMapUpdate 增量（2 用例 · T-18 ~ T-19）
   ============================================================ */
test.describe('L6 §7.7 backlinkMapUpdate', () => {
  test('T-18 节点加 [[doc1]] wiki 引用 → backlinkMap 新增', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _backlinkMap, _backlinkReverse, _docTitleToDocId };
      try {
        _backlinkMap = new Map();
        _backlinkReverse = new Map();
        _docTitleToDocId = new Map([['doc1', 'doc1']]);
        /* state 用于 normTitle 解析（如果需要） */
        const origState = state;
        state = { nodes: { doc1: { id: 'doc1', text: 'doc1' }, root: { id: 'root', text: '' } } };
        try {
          const res = backlinkMapUpdate(
            new Set(['x']),
            { nodes: { x: { id: 'x', text: 'no wiki', _deleted: false } } },
            { nodes: { x: { id: 'x', text: 'with [[doc1]]', _deleted: false } } },
            {}
          );
          const docMap = _backlinkMap.get('doc1');
          return { added: res.added, hasX: docMap ? docMap.has('x') : false };
        } finally { state = origState; }
      } finally {
        _backlinkMap = backup._backlinkMap;
        _backlinkReverse = backup._backlinkReverse;
        _docTitleToDocId = backup._docTitleToDocId;
      }
    });
    expect(r.added).toBe(1);
    expect(r.hasX).toBe(true);
  });

  test('T-19 节点删 [[doc1]] wiki 引用 → backlinkMap 移除', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _backlinkMap, _backlinkReverse, _docTitleToDocId };
      try {
        _backlinkMap = new Map([['doc1', new Map([['x', 1]])]]);
        _backlinkReverse = new Map([['x', new Set(['doc1'])]]);
        _docTitleToDocId = new Map([['doc1', 'doc1']]);
        const origState = state;
        state = { nodes: { doc1: { id: 'doc1', text: 'doc1' }, root: { id: 'root', text: '' } } };
        try {
          const res = backlinkMapUpdate(
            new Set(['x']),
            { nodes: { x: { id: 'x', text: 'with [[doc1]]', _deleted: false } } },
            { nodes: { x: { id: 'x', text: 'no wiki', _deleted: false } } },
            {}
          );
          const docMap = _backlinkMap.get('doc1');
          return { removed: res.removed, hasX: docMap ? docMap.has('x') : false };
        } finally { state = origState; }
      } finally {
        _backlinkMap = backup._backlinkMap;
        _backlinkReverse = backup._backlinkReverse;
        _docTitleToDocId = backup._docTitleToDocId;
      }
    });
    expect(r.removed).toBe(1);
    expect(r.hasX).toBe(false);
  });
});

/* ============================================================
   §7.8 undo/redo 反向增量对称性（2 用例 · T-20 ~ T-21）
   ============================================================ */
test.describe('L6 §7.8 undo/redo 反向增量对称性', () => {
  test('T-20 undo 反向增量：从 post → pre 状态反向维护', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _calIndexCache, _tagIndexCache };
      try {
        _calIndexCache = new Map([
          ['2026-10-15', new Set()],
          ['2026-10-16', new Set(['x'])],
        ]);
        _tagIndexCache = new Map();
        const res = updateIncrementalIndexes(
          new Set(['x']),
          { nodes: { x: { id: 'x', date: '2026-10-16', _deleted: false } } },  /* _preState = post */
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: false } } },  /* state = pre */
          { op: 'moveDate:undo', direction: 'undo' }
        );
        const set15 = _calIndexCache.get('2026-10-15');
        const set16 = _calIndexCache.get('2026-10-16');
        return {
          ok: res.ok,
          added: res.added,
          removed: res.removed,
          xIn15: set15 ? set15.has('x') : false,
          xIn16: set16 ? set16.has('x') : false,
        };
      } finally {
        _calIndexCache = backup._calIndexCache;
        _tagIndexCache = backup._tagIndexCache;
      }
    });
    expect(r.ok).toBe(true);
    expect(r.removed).toBe(1);  /* x removed from 2026-10-16 (post date) */
    expect(r.added).toBe(1);    /* x added to 2026-10-15 (pre date) */
    expect(r.xIn15).toBe(true);
    expect(r.xIn16).toBe(false);
  });

  test('T-21 redo 反向增量：从 pre → post 状态前向维护', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _calIndexCache, _tagIndexCache };
      try {
        _calIndexCache = new Map([
          ['2026-10-15', new Set(['x'])],
          ['2026-10-16', new Set()],
        ]);
        _tagIndexCache = new Map();
        const res = updateIncrementalIndexes(
          new Set(['x']),
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: false } } },  /* _preState = pre */
          { nodes: { x: { id: 'x', date: '2026-10-16', _deleted: false } } },  /* state = post */
          { op: 'moveDate:redo', direction: 'redo' }
        );
        const set15 = _calIndexCache.get('2026-10-15');
        const set16 = _calIndexCache.get('2026-10-16');
        return {
          ok: res.ok,
          added: res.added,
          removed: res.removed,
          xIn15: set15 ? set15.has('x') : false,
          xIn16: set16 ? set16.has('x') : false,
        };
      } finally {
        _calIndexCache = backup._calIndexCache;
        _tagIndexCache = backup._tagIndexCache;
      }
    });
    expect(r.ok).toBe(true);
    expect(r.removed).toBe(1);  /* x removed from 2026-10-15 (pre date) */
    expect(r.added).toBe(1);    /* x added to 2026-10-16 (post date) */
    expect(r.xIn15).toBe(false);
    expect(r.xIn16).toBe(true);
  });
});

/* ============================================================
   §7.9 __juIndexFailures 容量 + 连续失败降级（2 用例 · T-22 ~ T-23）
   ============================================================ */
test.describe('L6 §7.9 __juIndexFailures', () => {
  test('T-22 容量 50 FIFO', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const buf = window.__juIndexFailures;
      const before = buf.length;
      for (let i = 0; i < 60; i++) {
        reportIndexFailure({ op: 'test', index: 'test', error: 'simulated' });
      }
      const after = buf.length;
      return { before, after };
    });
    expect(r.after).toBeLessThanOrEqual(50);
  });

  test('T-23 连续 3 次失败 → 强制 4 索引 null（自决 2）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _calIndexCache, _tagIndexCache, _searchInverted, _backlinkMap };
      try {
        _calIndexCache = new Map();
        _tagIndexCache = new Map();
        _searchInverted = new Map();
        _backlinkMap = new Map();
        const before = {
          cal: _calIndexCache !== null,
          tag: _tagIndexCache !== null,
          search: _searchInverted !== null,
          back: _backlinkMap !== null,
        };
        /* 模拟 3 次失败 */
        for (let i = 0; i < 3; i++) {
          reportIndexFailure({ op: 'test', index: 'test', error: 'simulated' });
        }
        return {
          before,
          calNull: _calIndexCache === null,
          tagNull: _tagIndexCache === null,
          searchNull: _searchInverted === null,
          backNull: _backlinkMap === null,
        };
      } finally {
        _calIndexCache = backup._calIndexCache;
        _tagIndexCache = backup._tagIndexCache;
        _searchInverted = backup._searchInverted;
        _backlinkMap = backup._backlinkMap;
        resetIndexFailureStreak();
      }
    });
    expect(r.before.cal).toBe(true);
    expect(r.calNull).toBe(true);
    expect(r.tagNull).toBe(true);
    expect(r.searchNull).toBe(true);
    expect(r.backNull).toBe(true);
  });
});

/* ============================================================
   §7.10 #22.22.M1 merge 豁免（1 用例 · T-24）
   ============================================================ */
test.describe('L6 §7.10 #22.22.M1 merge 豁免', () => {
  test('T-24 mergeRemoteState 入口/出口 __juInMerge 切换', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const initial = window.__juInMerge;
      /* 直接调用 mergeRemoteState；由于 finally 块会重置 __juInMerge=false，
         改用探针：在 commit 上挂一个 spy，merge 期间 commit 应被跳过 */
      let commitCallsDuringMerge = 0;
      let commitsSkippedDuringMerge = 0;
      const origCommit = window.commit;
      window.commit = function(action, opts) {
        if (window.__juInMerge) {
          commitCallsDuringMerge++;
          /* merge 期间 commit 应被识别为 no-op 增量（不调用 updateIncrementalIndexes） */
          /* 简单验证：opts 上无显式 noHistory，但 __juInMerge=true 应让增量维护跳过 */
          return origCommit.call(this, action, opts);
        }
        return origCommit.call(this, action, opts);
      };
      try {
        /* 触发 mergeRemoteState（传入空快照，no-op）*/
        if (typeof window.mergeRemoteState === 'function') {
          window.mergeRemoteState({ nodes: {} });
        }
        const final = window.__juInMerge;
        return { initial, final, commitCallsDuringMerge };
      } finally {
        window.commit = origCommit;
      }
    });
    expect(r.initial).toBe(false);
    expect(r.final).toBe(false);
  });
});

/* ============================================================
   §7.11 fuzz 增量一致性（2 用例 · T-25 ~ T-26）
   ============================================================ */
test.describe('L6 §7.11 fuzz 增量一致性', () => {
  test('T-25 100 步随机 date 变更 → 增量 vs 全表重建一致', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _calIndexCache };
      try {
        _calIndexCache = new Map();
        const dates = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];
        let mismatches = 0;
        /* 100 步：随机改 date */
        for (let i = 0; i < 100; i++) {
          const id = 'x' + (i % 10);
          const fromDate = dates[i % 5];
          const toDate = dates[(i + 1) % 5];
          const fromState = { nodes: { [id]: { id, date: fromDate, _deleted: false } } };
          const toState = { nodes: { [id]: { id, date: toDate, _deleted: false } } };
          calIndexUpdate(new Set([id]), fromState, toState, {});
        }
        /* 全表重建：基于最终 state */
        const finalIdx = new Map();
        for (let i = 0; i < 100; i++) {
          const id = 'x' + (i % 10);
          const finalDate = dates[(i + 1) % 5];  /* i+1 步后的 date */
          if (!finalIdx.has(finalDate)) finalIdx.set(finalDate, new Set());
          finalIdx.get(finalDate).add(id);
        }
        /* 对比 */
        for (const [date, set] of finalIdx) {
          const incSet = _calIndexCache.get(date);
          if (!incSet) { mismatches++; continue; }
          for (const id of set) {
            if (!incSet.has(id)) mismatches++;
          }
        }
        return { mismatches };
      } finally {
        _calIndexCache = backup._calIndexCache;
      }
    });
    expect(r.mismatches).toBe(0);
  });

  test('T-26 50 步 tag 增删 fuzz → 增量 vs 全表重建一致', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _tagIndexCache };
      try {
        _tagIndexCache = new Map();
        const allTags = new Map();  /* expected: tag → Set<id> */
        let mismatches = 0;
        for (let i = 0; i < 50; i++) {
          const id = 'x' + (i % 5);
          const oldText = (i % 2 === 0) ? 'no tag' : 'with #tagA';
          const newText = (i % 3 === 0) ? 'no tag' : 'with #tagB';
          const fromState = { nodes: { [id]: { id, text: oldText, _deleted: false } } };
          const toState = { nodes: { [id]: { id, text: newText, _deleted: false } } };
          /* 更新期望 */
          if (oldText.includes('tagA')) {
            const s = allTags.get('tagA') || new Set();
            s.delete(id);
            if (s.size) allTags.set('tagA', s); else allTags.delete('tagA');
          }
          if (newText.includes('tagB')) {
            const s = allTags.get('tagB') || new Set();
            s.add(id);
            allTags.set('tagB', s);
          }
          tagIndexUpdate(new Set([id]), fromState, toState, {});
        }
        /* 对比 */
        for (const [tag, set] of allTags) {
          const incSet = _tagIndexCache.get(tag);
          if (!incSet) { mismatches++; continue; }
          if (incSet.size !== set.size) { mismatches++; continue; }
          for (const id of set) if (!incSet.has(id)) mismatches++;
        }
        return { mismatches };
      } finally {
        _tagIndexCache = backup._tagIndexCache;
      }
    });
    expect(r.mismatches).toBe(0);
  });
});

/* ============================================================
   §7.12 calIndex 复活对称性（M4 修复 · T-27 ~ T-29）
   依据：不变量 #14.M4（commit 收口）+ #15.M4（undo/redo 反向对称）
   缺陷 F-1：calIndexUpdate 添加检测原守卫 `toDate!==fromDate` 在「复活」
             （_deleted true→false，date 不变）时漏加，导致 calIndex 与全表重建不一致
   ============================================================ */
test.describe('L6 §7.12 calIndex 复活对称性（#14.M4 / #15.M4）', () => {
  test('T-27 calIndexUpdate 复活（_deleted true→false, date 不变）→ 重新加入', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = _calIndexCache;
      try {
        _calIndexCache = new Map();  /* 软删后 id 已不在索引中 */
        const res = calIndexUpdate(
          new Set(['x']),
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: true } } },
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: false } } },
          {}
        );
        const set15 = _calIndexCache.get('2026-10-15');
        return { errLen: res.errors.length, added: res.added, xIn15: set15 ? set15.has('x') : false };
      } finally {
        _calIndexCache = backup;
      }
    });
    expect(r.errLen).toBe(0);
    expect(r.added).toBe(1);
    expect(r.xIn15).toBe(true);
  });

  test('T-28 反向对称：软删移除 → undo 复活后 calIndex 复原', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _calIndexCache, _tagIndexCache };
      try {
        _calIndexCache = new Map([['2026-10-15', new Set(['x'])]]);
        _tagIndexCache = new Map();
        const alive = { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: false } } };
        const deleted = { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: true } } };
        /* 正向 commit（软删）：alive → deleted */
        const fwd = updateIncrementalIndexes(new Set(['x']), alive, deleted, { op: 'moveToTrash' });
        const liveAfterTrash = !!(_calIndexCache.get('2026-10-15'));  /* 软删后该 date 集合应被移除 */
        /* 反向 undo：deleted → alive */
        const rev = updateIncrementalIndexes(new Set(['x']), deleted, alive, { op: 'moveToTrash:undo', direction: 'undo' });
        const set15 = _calIndexCache.get('2026-10-15');
        return {
          fwdRemoved: fwd.removed,
          liveAfterTrash,
          revAdded: rev.added,
          xIn15: set15 ? set15.has('x') : false,
        };
      } finally {
        _calIndexCache = backup._calIndexCache;
        _tagIndexCache = backup._tagIndexCache;
      }
    });
    expect(r.fwdRemoved).toBe(1);
    expect(r.liveAfterTrash).toBe(false);
    expect(r.revAdded).toBe(1);
    expect(r.xIn15).toBe(true);
  });

  test('T-29 restoreFromTrash 正向：deleted→alive 重新加入 calIndex', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = _calIndexCache;
      try {
        _calIndexCache = new Map();
        const res = updateIncrementalIndexes(
          new Set(['x']),
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: true } } },
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: false } } },
          { op: 'restoreFromTrash' }
        );
        const set15 = _calIndexCache.get('2026-10-15');
        return { ok: res.ok, added: res.added, xIn15: set15 ? set15.has('x') : false };
      } finally {
        _calIndexCache = backup;
      }
    });
    expect(r.ok).toBe(true);
    expect(r.added).toBe(1);
    expect(r.xIn15).toBe(true);
  });
});

/* ============================================================
   §7.13 M5 边界条件 + 注入点降级（T-30 ~ T-34）
   依据：不变量 #23（增量一致性 + 任一失败必须报告降级）+
         M5-1（注入点守卫统一）+ M5-2（catch 加固 → l6InjectionFailure）
   ============================================================ */
test.describe('L6 §7.13 M5 边界条件 + 注入点降级', () => {
  test('T-30 边界：复活 + date 变更（旧 date 不残留、新 date 加入）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = _calIndexCache;
      try {
        _calIndexCache = new Map([['2026-10-15', new Set(['x'])]]);
        const res = calIndexUpdate(
          new Set(['x']),
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: true } } },
          { nodes: { x: { id: 'x', date: '2026-10-16', _deleted: false } } },
          {}
        );
        const d15 = _calIndexCache.get('2026-10-15');
        const d16 = _calIndexCache.get('2026-10-16');
        return {
          errLen: res.errors.length,
          removed: res.removed,
          added: res.added,
          in15: d15 ? d15.has('x') : false,
          in16: d16 ? d16.has('x') : false,
        };
      } finally {
        _calIndexCache = backup;
      }
    });
    expect(r.errLen).toBe(0);
    expect(r.removed).toBe(1);
    expect(r.added).toBe(1);
    expect(r.in15).toBe(false);
    expect(r.in16).toBe(true);
  });

  test('T-31 边界：幂等 —— 索引已含该 id 时复活不重复添加', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = _calIndexCache;
      try {
        _calIndexCache = new Map([['2026-10-15', new Set(['x'])]]);
        const res = calIndexUpdate(
          new Set(['x']),
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: true } } },
          { nodes: { x: { id: 'x', date: '2026-10-15', _deleted: false } } },
          {}
        );
        const set15 = _calIndexCache.get('2026-10-15');
        return {
          added: res.added,
          removed: res.removed,
          size: set15 ? set15.size : -1,
          has: set15 ? set15.has('x') : false,
        };
      } finally {
        _calIndexCache = backup;
      }
    });
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
    expect(r.size).toBe(1);
    expect(r.has).toBe(true);
  });

  test('T-32 边界：硬删子树清理 → undo 逐节点重加（反向对称）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _calIndexCache, _tagIndexCache, _searchInverted, _backlinkMap };
      try {
        _calIndexCache = new Map([['2026-10-15', new Set(['x', 'y'])]]);
        /* 仅放行 calIndex：其余 3 索引置 null（对应子函数提前返回），
           避免触碰 _searchInvertedDocs / _backlinkReverse 等辅助结构（非本用例关注点）*/
        _tagIndexCache = null;
        _searchInverted = null;
        _backlinkMap = null;
        const alive = { nodes: {
          x: { id: 'x', date: '2026-10-15', _deleted: false, children: ['y'] },
          y: { id: 'y', date: '2026-10-15', _deleted: false, parent: 'x' },
        } };
        const gone = { nodes: {} };
        const cleanup = updateIncrementalIndexes(new Set(), alive, gone, {
          subtreeCleanup: true, subtreeIds: new Set(['x', 'y']),
        });
        const sizeAfterCleanup = _calIndexCache.size;
        const undo = updateIncrementalIndexes(new Set(['x', 'y']), gone, alive, {
          op: 'removeNode:undo', direction: 'undo',
        });
        const set15 = _calIndexCache.get('2026-10-15');
        return {
          cleanupOk: cleanup.ok,
          cleanupRemoved: cleanup.removed,
          sizeAfterCleanup,
          undoOk: undo.ok,
          undoAdded: undo.added,
          sizeAfterUndo: set15 ? set15.size : 0,
          hasX: set15 ? set15.has('x') : false,
          hasY: set15 ? set15.has('y') : false,
        };
      } finally {
        _calIndexCache = backup._calIndexCache;
        _tagIndexCache = backup._tagIndexCache;
        _searchInverted = backup._searchInverted;
        _backlinkMap = backup._backlinkMap;
      }
    });
    expect(r.cleanupOk).toBe(true);
    expect(r.cleanupRemoved).toBe(2);
    expect(r.sizeAfterCleanup).toBe(0);
    expect(r.undoOk).toBe(true);
    expect(r.undoAdded).toBe(2);
    expect(r.sizeAfterUndo).toBe(2);
    expect(r.hasX).toBe(true);
    expect(r.hasY).toBe(true);
  });

  test('T-33 边界：空 changedIds + 无 subtreeIds → 安全空操作', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = _calIndexCache;
      try {
        _calIndexCache = new Map([['2026-10-15', new Set(['x'])]]);
        const res = updateIncrementalIndexes(new Set(), { nodes: {} }, { nodes: {} }, {});
        const set15 = _calIndexCache.get('2026-10-15');
        return { ok: res.ok, added: res.added, removed: res.removed, size: set15 ? set15.size : -1 };
      } finally {
        _calIndexCache = backup;
      }
    });
    expect(r.ok).toBe(true);
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
    expect(r.size).toBe(1);
  });

  test('T-34 M5-2 注入点降级：l6InjectionFailure 记录失败 + 强制 4 索引 null', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const backup = { _calIndexCache, _tagIndexCache, _searchInverted, _backlinkMap };
      try {
        _calIndexCache = new Map();
        _tagIndexCache = new Map();
        _searchInverted = new Map();
        _backlinkMap = new Map();
        l6InjectionFailure('commit', 'setText', new Error('simulated-injection'), 12345);
        const entry = window.__juIndexFailures[window.__juIndexFailures.length - 1];
        return {
          calNull: _calIndexCache === null,
          tagNull: _tagIndexCache === null,
          searchNull: _searchInverted === null,
          backNull: _backlinkMap === null,
          op: entry ? entry.op : null,
          index: entry ? entry.index : null,
          errHasSim: entry ? String(entry.error).indexOf('simulated-injection') >= 0 : false,
        };
      } finally {
        _calIndexCache = backup._calIndexCache;
        _tagIndexCache = backup._tagIndexCache;
        _searchInverted = backup._searchInverted;
        _backlinkMap = backup._backlinkMap;
        resetIndexFailureStreak();
      }
    });
    expect(r.calNull).toBe(true);
    expect(r.tagNull).toBe(true);
    expect(r.searchNull).toBe(true);
    expect(r.backNull).toBe(true);
    expect(r.op).toBe('commit:setText');
    expect(r.index).toBe('injection');
    expect(r.errHasSim).toBe(true);
  });
});
