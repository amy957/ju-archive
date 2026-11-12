// @ts-nocheck
/**
 * L7 阶段 · 索引 Worker 化（IndexAgent-Worker）专题 spec
 *   W1 范围：Worker 骨架 + 消息协议 + IndexWorkerClient + 影子模式
 *
 * 依据：l7-design-2026-10-14.md § 四（协议）、§ 六（W1 里程碑）、§ 十（LO-1 ~ LO-6 决策）
 * 配套：v2.0-t3.html（L7-W1 段：INDEX_WORKER_SRC / getIndexWorkerUrl / IndexWorkerClient /
 *       l7IndexShadowApplyDelta / l7WorkerFailure / updateIncrementalIndexes 包装）
 *
 * 决策对用例的约束：
 *   - LO-1 A：主线程 L6 永久保留为 syncFallback → 任意 Worker 故障必须降级 'sync' 且功能不降级
 *   - LO-2 A：gen 代次丢弃过期回包
 *   - LO-4 A：结构化克隆（不做 Transferable 零拷贝）
 *   - LO-5 修订 R1：classic worker（R5 实测：file:// 下 Blob module worker 无法加载 → 设计文档 §10.2）
 *
 * W1 矩阵（5 用例 · T-35 ~ T-39）；W2-T1 §8.4（T-40）；W2-T2 §8.5 对拍/权威（T-41 ~ T-44）。
 *   §8.1 模式与回退（2 用例 · T-35 ~ T-36）
 *   §8.2 协议与代次（2 用例 · T-37 ~ T-38）
 *   §8.3 查询降级（1 用例 · T-39）
 *   §8.4 就绪看门狗（1 用例 · T-40，W2-T1）
 *   §8.5 权威切分与双向对拍（4 用例 · T-41 ~ T-44，W2-T2）
 *   §8.6 searchInverted / backlinkMap 迁权威（2 用例 · T-45 ~ T-46，W3）
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
    () => typeof updateIncrementalIndexes === 'function' &&
          typeof _l6UpdateIncrementalIndexesImpl === 'function' &&
          typeof l7IndexShadowApplyDelta === 'function' &&
          typeof ensureIndexWorker === 'function' &&
          typeof l7WorkerFailure === 'function' &&
          typeof setIndexWorkerMode === 'function' &&
          !!window.__juIndexShadow && typeof window.__juIndexShadow.setMode === 'function',
    { timeout: 10_000 }
  );
}

/* ============================================================
   §8.1 模式与回退（2 用例 · T-35 ~ T-36）
   ============================================================ */
test.describe('L7-W1 §8.1 模式与回退', () => {
  test('T-35 Worker 不可用 → 降级 sync，功能不降级', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      /* 模拟不支持 Worker 的环境（file:// + 旧内核 / CSP 限制） */
      try { Object.defineProperty(window, 'Worker', { value: undefined, configurable: true, writable: true }); } catch (e) {}
      const modeAfter = window.__juIndexShadow.setMode('shadow');
      const res = updateIncrementalIndexes(null, null, null, {}); /* 空增量：走 L6 早退路径 */
      return {
        modeAfter,
        modeNow: window.__juIndexWorkerMode,
        errors: window.__juIndexWorker.errors,
        lastError: window.__juIndexWorker.lastError,
        failBufLen: window.__juIndexFailures.length,
        resOk: res.ok,
        resKeys: Object.keys(res).sort().join(','),
      };
    });
    expect(r.modeAfter).toBe('sync');            /* 构造失败必须立即降级 */
    expect(r.modeNow).toBe('sync');
    expect(r.errors).toBeGreaterThanOrEqual(1);  /* 必须报告（#23） */
    expect(r.lastError).toBeTruthy();
    expect(r.failBufLen).toBeGreaterThanOrEqual(1);
    expect(r.resOk).toBe(true);                  /* 功能不降级 */
    expect(r.resKeys).toBe('added,errors,ok,removed'); /* 回包形状与 L6 一致 */
  });

  test('T-36 blob worker 可用（classic · 修订 R1）→ ready + applyDelta ack（file:// 实测 · R5）', async ({ page }) => {
    await bootApp(page);
    const ok = await page.evaluate(() => {
      window.__juIndexShadow.setMode('shadow');
      return window.__juIndexWorkerMode;
    });
    expect(ok).toBe('shadow');
    /* classic worker 是否在 file:// 下构造成功并回 ready（R5 实测门槛，见设计文档 §10.2） */
    /* 注：waitForFunction 第 2 参是 arg，超时必须放第 3 参；原写法误把 {timeout:5_000} 当 arg，
       实际按 test timeout(30s) 等待，失败信息误报 "Test timeout of 30000ms exceeded"（R5 门槛失真） */
    await page.waitForFunction(() => window.__juIndexWorker.ready === true, null, { timeout: 5_000 });
    const afterReady = await page.evaluate(() => ({
      ready: window.__juIndexWorker.ready,
      stub: window.__juIndexWorker.stub,
      sent: window.__juIndexWorker.sent,
      gen: window.__juIndexShadow.gen(),
      url: window.__juIndexShadow.workerUrl().slice(0, 5),
    }));
    expect(afterReady.stub).toBe(true);                /* W1 骨架：stub 标记 */
    expect(afterReady.sent).toBeGreaterThanOrEqual(1); /* init 已发出 */
    expect(afterReady.url).toBe('blob:');
    /* applyDelta 往返 ack */
    await page.evaluate(() => {
      window.__juIndexShadow.applyDelta(new Set(['n1']), { nodes: {} }, { nodes: {} }, {});
    });
    await page.waitForFunction(() => window.__juIndexWorker.acked >= 1, null, { timeout: 5_000 });
    const final = await page.evaluate(() => ({
      acked: window.__juIndexWorker.acked,
      errors: window.__juIndexWorker.errors,
      mode: window.__juIndexWorkerMode,
      ready: window.__juIndexWorker.ready,
    }));
    expect(final.acked).toBeGreaterThanOrEqual(1);
    expect(final.errors).toBe(0);       /* 正常路径不得产生失败记录 */
    expect(final.mode).toBe('shadow');  /* 正常路径不得降级 */
    expect(final.ready).toBe(true);
    /* 收尾：切回 sync 必须释放 Worker（LO-1 常态路径） */
    const back = await page.evaluate(() => {
      const m = window.__juIndexShadow.setMode('sync');
      return { m, ready: window.__juIndexWorker.ready, mode: window.__juIndexWorkerMode };
    });
    expect(back.m).toBe('sync');
    expect(back.ready).toBe(false);
    expect(back.mode).toBe('sync');
  });
});

/* ============================================================
   §8.2 协议与代次（2 用例 · T-37 ~ T-38）
   ============================================================ */
test.describe('L7-W1 §8.2 协议与代次', () => {
  test('T-37 过期 gen 回包被丢弃，当前 gen 计数', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const g = window.__juIndexShadow.gen();
      const before = window.__juIndexWorker.acked;
      window.__juIndexShadow.onMessage({ data: { type: 'ack', gen: g + 99, seq: 1 } }); /* 过期 */
      const afterStale = window.__juIndexWorker.acked;
      window.__juIndexShadow.onMessage({ data: { type: 'ack', gen: g, seq: 2 } });      /* 有效 */
      const afterValid = window.__juIndexWorker.acked;
      window.__juIndexShadow.onMessage({ data: { type: 'ack', gen: 0, seq: 3 } });      /* gen=0 广播：视为有效 */
      return { before, afterStale, afterValid, afterBroadcast: window.__juIndexWorker.acked };
    });
    expect(r.afterStale).toBe(r.before);       /* 过期包丢弃 */
    expect(r.afterValid).toBe(r.before + 1);   /* 有效包计数 */
    expect(r.afterBroadcast).toBe(r.before + 2);
  });

  test('T-38 默认 sync：零 Worker 创建、直通 L6 权威实现', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const sentBefore = window.__juIndexWorker.sent;
      const res = updateIncrementalIndexes(null, null, null, {});
      /* 影子钩子：sync 下必须直接返回 false（不建 Worker） */
      const shadowRet = window.__juIndexShadow.applyDelta(new Set(['n1']), { nodes: {} }, { nodes: {} }, {});
      return {
        mode: window.__juIndexWorkerMode,
        resOk: res.ok,
        resKeys: Object.keys(res).sort().join(','),
        shadowRet,
        sentDelta: window.__juIndexWorker.sent - sentBefore,
        failLen: window.__juIndexFailures.length,
      };
    });
    expect(r.mode).toBe('sync');   /* 默认值 = L6 行为 */
    expect(r.resOk).toBe(true);
    expect(r.resKeys).toBe('added,errors,ok,removed');
    expect(r.shadowRet).toBe(false); /* 未建 Worker */
    expect(r.sentDelta).toBe(0);
    expect(r.failLen).toBe(0);
  });
});

/* ============================================================
   §8.3 查询降级（1 用例 · T-39）
   ============================================================ */
test.describe('L7-W1 §8.3 查询降级', () => {
  test('T-39 非 worker 模式下 query 返回降级结果且不抛错', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const out = {};
      out.sync = await window.__juIndexShadow.query('calIndex', {});
      window.__juIndexShadow.setMode('shadow');
      /* shadow 模式：query 仍非权威 → 应继续降级（worker 权威仅 mode='worker'） */
      out.shadow = await window.__juIndexShadow.query('calIndex', {});
      window.__juIndexShadow.setMode('sync');
      return out;
    });
    for (const k of ['sync', 'shadow']) {
      expect(r[k].ok).toBe(false);
      expect(r[k].stub).toBe(true);
      expect(Array.isArray(r[k].errors)).toBe(true);
      expect(r[k].errors.length).toBeGreaterThanOrEqual(1);
    }
  });
});
/* ============================================================
   §8.4 就绪看门狗（W2 补口 · 1 用例 · T-40）
   ============================================================ */
test.describe('L7-W2 §8.4 就绪看门狗', () => {
  test('T-40 构造成功但永不 ready 且无 onerror → 重建一次后降级 sync（W2 补口）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(async () => {
      /* 假 Worker：构造成功、接受 postMessage、**永不回 ready**、**不触发 onerror**
         → 精确复现「脚本未执行但未报错」的静默卡死形态（R5 之外的第二种故障） */
      const real = window.Worker;
      let constructed = 0, terminated = 0;
      function FakeWorker() {
        constructed++;
        this.onmessage = null; this.onerror = null;
        this.postMessage = function () { /* 静默吞掉：永不回 ready */ };
        this.terminate = function () { terminated++; };
      }
      window.Worker = FakeWorker;
      let modeAfterSet = null;
      try {
        modeAfterSet = window.__juIndexShadow.setMode('shadow');
        /* 3s 看门狗 × 2 轮 + 余量 */
        await new Promise((res) => setTimeout(res, 7_500));
      } finally {
        window.Worker = real;
      }
      const res = updateIncrementalIndexes(null, null, null, {}); /* 降级后功能不降级 */
      return {
        modeAfterSet,
        mode: window.__juIndexWorkerMode,
        constructed, terminated,
        errors: window.__juIndexWorker.errors,
        lastError: window.__juIndexWorker.lastError,
        ready: window.__juIndexWorker.ready,
        readyStrikesMirror: window.__juIndexWorker.readyStrikes,
        readyStrikesGetter: (typeof window.__juIndexShadow.readyStrikes === 'function') ? window.__juIndexShadow.readyStrikes() : null,
        failLen: window.__juIndexFailures.length,
        lastOp: (window.__juIndexFailures[window.__juIndexFailures.length - 1] || {}).op,
        resOk: res.ok,
        resKeys: Object.keys(res).sort().join(','),
      };
    });
    expect(r.modeAfterSet).toBe('shadow');   /* 构造后**异步**降级：setMode 同步仍回请求值 */
    expect(r.constructed).toBe(2);           /* 第 1 轮看门狗：terminate 重建一次 */
    expect(r.terminated).toBe(2);            /* 重建 + 最终降级各 terminate 一次 */
    expect(r.readyStrikesMirror).toBe(2);    /* 两轮未就绪均被计数 */
    expect(r.readyStrikesGetter).toBe(0);    /* 硬降级后内部计数归零（下次激活重新给 2 轮） */
    expect(r.mode).toBe('sync');             /* 第 2 轮仍未就绪 → 降级 sync（LO-1） */
    expect(r.ready).toBe(false);
    expect(r.errors).toBeGreaterThanOrEqual(1);           /* 必须报告（#23） */
    expect(r.lastError).toContain('未就绪');       /* lastError = err.message（可诊断文案） */
    expect(r.lastOp).toBe('worker:ready-timeout'); /* where 进 __juIndexFailures.op（#23 通道） */
    expect(r.failLen).toBeGreaterThanOrEqual(1);
    expect(r.resOk).toBe(true);              /* LO-1：功能不降级 */
    expect(r.resKeys).toBe('added,errors,ok,removed');
  });
});
/* ============================================================
   §8.5 权威切分与双向对拍（W2-T2 · 4 用例 · T-41 ~ T-44）
   覆盖：__juIndexShadowMismatch 上报与上限 / 阈值自动回退 worker→shadow→sync /
        calIndex·tagIndex 在 'worker' 模式下的等价性 / 权威切换的 ready 前置门槛
   ============================================================ */
test.describe('L7-W2 §8.5 权威切分与双向对拍', () => {
  const BOGUS = '[[\"__w2_bogus__\",[\"zz\"]]]';

  test('T-41 影子对拍 mismatch 上报且缓冲受 _INDEX_SHADOW_CAP 限制', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate((bogus) => {
      const w = window.__juIndexShadow;
      const cap = w.mismatchCap();
      /* 注入与主线程摘要不可能相等的 Worker digest（等价于「故意注入错值」） */
      for (let i = 0; i < cap + 5; i++) {
        w.reconcile({ digest: { cal: bogus, tag: bogus } });
      }
      const buf = w.mismatch();
      const idx = [];
      for (const x of buf) { if (idx.indexOf(x.index) < 0) idx.push(x.index); }
      return {
        cap,
        len: buf.length,
        indices: idx.sort(),
        hasBothSides: !!(buf[0] && typeof buf[0].main === 'string' && typeof buf[0].worker === 'string'),
      };
    }, BOGUS);
    expect(r.len).toBe(r.cap);                                   /* FIFO 上限 50 */
    expect(r.indices).toEqual(['calIndex', 'tagIndex']);          /* 双向：两索引都上报 */
    expect(r.hasBothSides).toBe(true);                            /* 记录含 main/worker 两侧摘要 */
  });

  test('T-42 对拍 mismatch 超阈值 → 自动回退 shadow→sync 并报告（#23）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate((bogus) => {
      const w = window.__juIndexShadow;
      w.setMode('shadow');
      const thr = w.shadowThreshold();
      const before = window.__juIndexFailures.length;
      let i = 0;
      while (window.__juIndexWorkerMode === 'shadow' && i < 40) {
        w.reconcile({ digest: { cal: bogus, tag: bogus } });
        i++;
      }
      const last = window.__juIndexFailures[window.__juIndexFailures.length - 1] || {};
      return {
        thr,
        mode: window.__juIndexWorkerMode,
        iters: i,
        lastOp: last.op,
        grew: window.__juIndexFailures.length - before,
      };
    }, BOGUS);
    expect(r.thr).toBeGreaterThanOrEqual(1);
    expect(r.mode).toBe('sync');                       /* 自动回退到 syncFallback（LO-1） */
    expect(r.lastOp).toBe('worker:shadow-mismatch');   /* 降级走 #23 报告通道 */
    expect(r.grew).toBeGreaterThanOrEqual(1);
  });

  test('T-43 worker 模式 calIndex/tagIndex 查询 = L6 权威结果（等价性）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const w = window.__juIndexShadow;
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const waitFor = async (fn, ms) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(25); }
        return false;
      };
      w.setMode('shadow');
      await waitFor(() => window.__juIndexWorker.ready === true, 5000);
      const modeAfterWorker = w.setMode('worker');                 /* 前置：ready===true */
      const synced = await waitFor(() => w.storeSynced() === true, 5000);

      /* 强制 L6 权威索引已首次构建（calIndexUpdate/tagIndexUpdate 在未构建时跳过） */
      buildCalIndex(); buildTagIndex();

      const id = 'w2t43n1';
      const pre = { nodes: {} };
      const post = { nodes: {} };
      post.nodes[id] = { id: id, text: '#alpha', date: '2026-10-14', parent: null,
        tags: ['alpha'], _manualTags: ['alpha'] };
      updateIncrementalIndexes(new Set([id]), pre, post, {});
      await waitFor(() => window.__juIndexWorker.acked >= 1, 5000);

      const cq = await w.fetch('calIndex', { date: '2026-10-14' });
      const tq = await w.fetch('tagIndex', { tag: 'alpha' });
      const l6cal = Array.from(buildCalIndex().get('2026-10-14') || []).sort();
      const l6tag = Array.from(buildTagIndex().get('alpha') || []).sort();
      return {
        modeAfterWorker, mode: window.__juIndexWorkerMode, synced,
        cqSource: cq.source, cqData: (cq.data || []).slice().sort(),
        tqSource: tq.source, tqData: (tq.data || []).slice().sort(),
        l6cal, l6tag, shadows: w.mismatchCount(),
      };
    });
    expect(r.synced).toBe(true);
    expect(r.modeAfterWorker).toBe('worker');
    expect(r.mode).toBe('worker');
    expect(r.cqSource).toBe('worker');       /* calIndex 权威 = Worker */
    expect(r.tqSource).toBe('worker');       /* tagIndex 权威 = Worker */
    expect(r.cqData).toEqual(r.l6cal);       /* 等价性（#14/#15/#23） */
    expect(r.tqData).toEqual(r.l6tag);
    expect(r.l6cal).toContain('w2t43n1');
    expect(r.l6tag).toContain('w2t43n1');
  });

  test('T-44 权威切换前置 ready 门槛（未就绪拒绝切 worker）', async ({ page }) => {
    await bootApp(page);
    /* 负向：默认 sync、Worker 尚未就绪 → 必须拒绝 */
    const pre = await page.evaluate(() => {
      const w = window.__juIndexShadow;
      const a = w.setMode('worker');
      return { a, mode: window.__juIndexWorkerMode, ready: window.__juIndexWorker.ready };
    });
    expect(pre.a).not.toBe('worker');
    expect(pre.mode).toBe('sync');
    expect(pre.ready).toBe(false);
    /* 正向：shadow → 就绪 → worker */
    const shadow = await page.evaluate(() => window.__juIndexShadow.setMode('shadow'));
    expect(shadow).toBe('shadow');
    await page.waitForFunction(() => window.__juIndexWorker.ready === true, null, { timeout: 5_000 });
    const pos = await page.evaluate(() => {
      const w = window.__juIndexShadow;
      const m = w.setMode('worker');
      return { m, mode: window.__juIndexWorkerMode };
    });
    expect(pos.m).toBe('worker');
    expect(pos.mode).toBe('worker');
  });
});
/* ============================================================
   §8.6 searchInverted / backlinkMap 迁权威（2 用例 · T-45 ~ T-46，W3）
   ------------------------------------------------------------
   迁权威口径（W3 决策）：
   - 主线程把 L6 的**规范化输入**（terms = tokenize(stripHtml(text))；wikiIds = extractWikiTitles →
     resolveDocIdByTitle 的**多重集**）随切片下发 → Worker 侧零正则、无 _docTitleToDocId，
     与 W2「tags 由主线程预计算」同范式（口径不会漂移）；
   - wikiIds 必须为多重集：L6 backlinkMapUpdate 对「两个不同标题解析到同一 docId」会计 2 次，
     若退化为去重 Set → 计数变 1 → T-46 的 digest 对拍立刻失配。
   ============================================================ */
test.describe('L7-W3 §8.6 searchInverted / backlinkMap 迁权威', () => {
  test('T-45 worker 模式 searchInverted / searchInvertedDocs = L6 权威结果（等价性）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const w = window.__juIndexShadow;
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const waitFor = async (fn, ms) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(25); }
        return false;
      };
      const backup = { state, _calIndexCache, _tagIndexCache, _searchInverted, _searchInvertedDocs, _backlinkMap, _backlinkReverse };
      try {
        /* 夹具：CJK 单字 + 英文 word（tokenize 口径）；无 date/tags/wiki → 只扰动 search 桶
           注意：必须显式带上 `_isCalRoot` 节点——否则 buildCalIndex() → getCalendarRootId()
           在无日历根时会走 ensureCalendarRoot() → commit() 兜底建根；若此时 ui.locked===true
           （启动期异步落盘窗口）该 commit 为 no-op → ensureCalendarRoot ↔ getCalendarRootId
           互相递归直至 RangeError（栈溢出），把测试拖到超时。带上日历根即彻底绕开该分支。
           夹具同时补齐 `parent` / `children`：commit → patch/render 路径会对 `children` 做 `.map`，
           缺数组会让运行期任意 commit（如 1.5s activity 防抖）在应用内抛 TypeError。 */
        state = { rootId: 'root', nodes: {
          root: { id: 'root', text: '', parent: null, children: ['calRoot', 'd1', 'd2', 'd3'] },
          calRoot: { id: 'calRoot', text: '日历待办', parent: 'root', children: [], collapsed: false,
            done: false, date: null, tags: [], priority: 0, recur: null, _isCalRoot: true, _isFolder: true },
          d1: { id: 'd1', text: 'alpha beta 中文', parent: 'root', children: [] },
          d2: { id: 'd2', text: 'beta gamma', parent: 'root', children: [] },
          d3: { id: 'd3', text: 'alpha gamma 中文', parent: 'root', children: [] },
        } };
        /* 换夹具必须**同时失效主线程 4 索引缓存**：应用启动即载入持久化文档（实测含「设计/重要」标签）
           → _tagIndexCache 非空且指向旧文档；不失效则对拍拿「旧文档摘要 vs 新夹具摘要」必然失配，
           累计 >= _INDEX_SHADOW_THRESHOLD(3) → 硬降级 'sync'（modeAfterWorker 断言随即失败）。
           （W2 T-43 靠「只增量、不换 state」规避了该前提，此处必须显式失效。）
           cal/tag 用 `new Map()` 而非 null：夹具无 date/tags，空 Map 就是该夹具的正确全量结果；
           置 null 会诱使 cal/tag 侧走 lazy 重建路径（多一次日历根/标签解析，且 tag 桶在启动期已脏）。 */
        _calIndexCache = new Map(); _tagIndexCache = new Map();
        _searchInverted = null; _searchInvertedDocs = null; /* 强制 L6 侧走 W3 新增全量构建器 */
        _backlinkMap = null; _backlinkReverse = null;
        w.setMode('shadow');
        await waitFor(() => window.__juIndexWorker.ready === true, 5000);
        const modeAfterWorker = w.setMode('worker');
        const synced = await waitFor(() => w.storeSynced() === true, 5000);
        buildSearchInverted();                              /* L6 权威全量（同一夹具） */
        /* 增量：新增含 CJK/英文 term 的节点 → L6 增量 vs Worker 增量 */
        const id = 'w3t45n1';
        const post = { nodes: {} };
        post.nodes[id] = { id: id, text: 'delta 中文', tags: [] };
        updateIncrementalIndexes(new Set([id]), { nodes: {} }, post, {});
        await waitFor(() => window.__juIndexWorker.acked >= 1, 5000);
        /* term → ids 逐项对拍（含仅增量出现的 term） */
        const terms = ['alpha', 'beta', '中', '文', 'delta'];
        const wq = [], lq = [];
        for (const t of terms) {
          const q = await w.fetch('search', { term: t });
          wq.push({ source: q.source, data: (q.data || []).slice().sort() });
          const s = buildSearchInverted().get(t);
          lq.push(Array.from(s || []).sort());
        }
        const dq = await w.fetch('searchDocs', { id: id });
        const dg = await w.query('digest', {});
        const ld = _searchInvertedDocs.get(id);
        return {
          modeAfterWorker, synced, mode: window.__juIndexWorkerMode,
          wq, lq,
          dqSource: dq.source, dqData: (dq.data || []).slice().sort(),
          l6doc: ld ? Array.from(ld.terms).sort() : null,
          dgLen: (dg.data || []).length,
          wSearchDigest: (dg.data || [])[2], mSearchDigest: _l7DigestFromMap(_searchInverted),
          wDocsDigest: (dg.data || [])[3],
          mDocsDigest: _l7DigestFromMap(_l7DocsNormMap(_searchInvertedDocs)),
          mism: w.mismatchCount(), mismIdx: (w.mismatch() || []).map((m) => m.index),
          mismBuf: (w.mismatch() || []).slice(),   /* 失配时输出 main/worker 两侧摘要（可诊断） */
          errors: window.__juIndexWorker.errors,
        };
      } finally {
        state = backup.state;
        _calIndexCache = backup._calIndexCache; _tagIndexCache = backup._tagIndexCache;
        _searchInverted = backup._searchInverted;
        _searchInvertedDocs = backup._searchInvertedDocs;
        _backlinkMap = backup._backlinkMap; _backlinkReverse = backup._backlinkReverse;
      }
    });
    expect(r.synced).toBe(true);
    expect(r.modeAfterWorker).toBe('worker');
    expect(r.mode).toBe('worker');
    expect(r.errors).toBe(0);
    expect(r.wq.map((x) => x.source)).toEqual(['worker', 'worker', 'worker', 'worker', 'worker']);
    /* 等价性：term → ids 逐项 = L6 权威（并锚定 CJK 单字切分 + 增量新增口径） */
    expect(r.wq.map((x) => x.data)).toEqual(r.lq);
    expect(r.lq[0]).toEqual(['d1', 'd3']);
    expect(r.lq[1]).toEqual(['d1', 'd2']);
    expect(r.lq[2]).toEqual(['d1', 'd3', 'w3t45n1']);
    expect(r.lq[3]).toEqual(['d1', 'd3', 'w3t45n1']);
    expect(r.lq[4]).toEqual(['w3t45n1']);
    /* docs 桶等价性（id → terms；判定用口径不含非确定的 updatedAt） */
    expect(r.dqSource).toBe('worker');
    expect(r.dqData).toEqual(r.l6doc);
    expect(r.l6doc).toEqual(['delta', '中', '文']);
    /* digest 直接等价（search / searchDocs 已并入 digest 字段 → W3 交接要求） */
    expect(r.dgLen).toBe(5);
    expect(r.wSearchDigest).toBe(r.mSearchDigest);
    expect(r.wDocsDigest).toBe(r.mDocsDigest);
    expect(r.mism).toBe(0);                 /* 双向对拍零失配（#23 延伸） */
    expect(r.mismBuf).toEqual([]);          /* 失配明细为空（失败时打印 main/worker 两侧摘要） */
  });


  test('T-46 worker 模式 backlinkMap（含计数/多重集口径）= L6 权威结果（等价性）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const w = window.__juIndexShadow;
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const waitFor = async (fn, ms) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(25); }
        return false;
      };
      const backup = { state, _calIndexCache, _tagIndexCache, _searchInverted, _searchInvertedDocs, _backlinkMap, _backlinkReverse, _docTitleToDocId };
      try {
        /* 夹具：srcA 用**两个不同标题**指向同一 doc1 → 计数 2（多重集口径的必要性所在）
           与 T-45 同理：必须显式带 `_isCalRoot`（缺失会触发 ensureCalendarRoot 兜底建根 →
           启动期 ui.locked 下 commit 为 no-op → getCalendarRootId/ensureCalendarRoot 死递归）。 */
        state = { rootId: 'root', nodes: {
          root: { id: 'root', text: '', parent: null, children: ['calRoot', 'doc1', 'doc2', 'srcA', 'srcB'] },
          calRoot: { id: 'calRoot', text: '日历待办', parent: 'root', children: [], collapsed: false,
            done: false, date: null, tags: [], priority: 0, recur: null, _isCalRoot: true, _isFolder: true },
          doc1: { id: 'doc1', text: 'doc1', parent: 'root', children: [] },
          doc2: { id: 'doc2', text: 'doc2', parent: 'root', children: [] },
          srcA: { id: 'srcA', text: '见 [[doc1]] 与 [[doc1alias]]', parent: 'root', children: [] },
          srcB: { id: 'srcB', text: '见 [[doc2]]', parent: 'root', children: [] },
        } };
        _docTitleToDocId = new Map([['doc1', 'doc1'], ['doc1alias', 'doc1'], ['doc2', 'doc2']]);
        /* 同 T-45：换夹具必须失效主线程 4 索引缓存（启动文档已建 tag 索引）→ 否则对拍失配 → 硬降级 'sync'；
           cal/tag 用空 Map（夹具无 date/tags，空 Map 即正确全量）而非 null。 */
        _calIndexCache = new Map(); _tagIndexCache = new Map();
        _searchInverted = null; _searchInvertedDocs = null;
        _backlinkMap = null; _backlinkReverse = null;
        w.setMode('shadow');
        await waitFor(() => window.__juIndexWorker.ready === true, 5000);
        const modeAfterWorker = w.setMode('worker');
        const synced = await waitFor(() => w.storeSynced() === true, 5000);
        buildBacklinkMap();                       /* L6 权威全量（同一夹具 + 同一标题解析表） */
        const l6full = _backlinkMap.get('doc1') || new Map();
        const fullQ = await w.fetch('backlink', { docId: 'doc1' });
        const fullL6 = { keys: Array.from(l6full.keys()).sort(), cnt: l6full.get('srcA') };
        /* 增量：srcB 的引用 doc2 → doc1（一次增量覆盖移除 + 新增两条路径） */
        updateIncrementalIndexes(new Set(['srcB']),
          { nodes: { srcB: { id: 'srcB', text: '见 [[doc2]]' } } },
          { nodes: { srcB: { id: 'srcB', text: '见 [[doc1]]' } } }, {});
        await waitFor(() => window.__juIndexWorker.acked >= 1, 5000);
        const q1 = await w.fetch('backlink', { docId: 'doc1' });
        const q2 = await w.fetch('backlink', { docId: 'doc2' });
        const dg = await w.query('digest', {});
        const m1 = _backlinkMap.get('doc1') || new Map();
        return {
          modeAfterWorker, synced, mode: window.__juIndexWorkerMode,
          fullQSource: fullQ.source, fullQData: (fullQ.data || []).slice().sort(), fullL6,
          q1Source: q1.source, q1: (q1.data || []).slice().sort(),
          q2Source: q2.source, q2: (q2.data || []).slice().sort(),
          l1: Array.from(m1.keys()).sort(),
          l2: Array.from(_backlinkMap.get('doc2') || []).sort(),
          cnt1: m1.get('srcA'), cntB: m1.get('srcB'),
          revB: Array.from(_backlinkReverse.get('srcB') || []).sort(),
          dgLen: (dg.data || []).length,
          wBackDigest: (dg.data || [])[4], mBackDigest: _l7DigestFromBacklink(_backlinkMap),
          mism: w.mismatchCount(), mismIdx: (w.mismatch() || []).map((m) => m.index),
          mismBuf: (w.mismatch() || []).slice(),   /* 失配时输出 main/worker 两侧摘要（可诊断） */
          errors: window.__juIndexWorker.errors,
        };
      } finally {
        state = backup.state;
        _calIndexCache = backup._calIndexCache; _tagIndexCache = backup._tagIndexCache;
        _searchInverted = backup._searchInverted;
        _searchInvertedDocs = backup._searchInvertedDocs;
        _backlinkMap = backup._backlinkMap;
        _backlinkReverse = backup._backlinkReverse;
        _docTitleToDocId = backup._docTitleToDocId;
      }
    });
    expect(r.synced).toBe(true);
    expect(r.modeAfterWorker).toBe('worker');
    expect(r.mode).toBe('worker');
    expect(r.errors).toBe(0);
    /* 全量等价：doc1 的引用者 = L6（同一标题解析表 → 两个不同标题计 2 次） */
    expect(r.fullQSource).toBe('worker');
    expect(r.fullQData).toEqual(r.fullL6.keys);
    expect(r.fullL6.keys).toEqual(['srcA']);
    expect(r.fullL6.cnt).toBe(2);
    /* 增量等价：移除（doc2 ← srcB）+ 新增（doc1 ← srcB） */
    expect(r.q1Source).toBe('worker');
    expect(r.q1).toEqual(r.l1);
    expect(r.q1).toEqual(['srcA', 'srcB']);
    expect(r.q2Source).toBe('worker');
    expect(r.q2).toEqual(r.l2);
    expect(r.q2).toEqual([]);
    expect(r.cnt1).toBe(2);
    expect(r.cntB).toBe(1);
    expect(r.revB).toEqual(['doc1']);        /* 反向索引同步（子树清理 O(1) 依赖） */
    /* digest 直接等价（二级 Map，含计数 → 直接判定多重集口径） */
    expect(r.dgLen).toBe(5);
    expect(r.wBackDigest).toBe(r.mBackDigest);
    expect(r.mism).toBe(0);
    expect(r.mismBuf).toEqual([]);           /* 失配明细为空（失败时打印 main/worker 两侧摘要） */
  });
});
/* ============================================================
   §8.7 两阶段渲染骨架屏 + progress 协议 + 异步分块构建（5 用例 · T-47 ~ T-51，W4）
   ------------------------------------------------------------
   设计依据：l7-design-2026-10-14.md §6 W4 行（骨架屏 + progress 消息）、§7.1（长任务指标）、
   §5.1（导出/导入按 LO-3 移出，不设 serialize/parse → 本用例组不覆盖导出/导入）。
   红证：T-48 / T-49（大库切视图：同步栈内建索引 → longtask > 0 且无骨架节点）；
         T-47 / T-50 / T-51（骨架屏 / progress / asyncBuild 入口缺失）。
   绿证：longtask = 0 且骨架同步可见、阶段 2 填充真数据、异步分块结果 digest = 同步 L6 结果。
   共性夹具纪律（沿用 T-45/T-46）：显式带 `_isCalRoot` 节点，规避无日历根时
   ensureCalendarRoot ↔ getCalendarRootId 递归（W3 已确认缺陷，W4 仅确认不修复）。
   ============================================================ */
test.describe('L7-W4 §8.7 骨架屏 + progress + 异步分块', () => {
  test('T-47 骨架屏同步渲染（阶段1）+ 进度出口 + 就绪后填充（阶段2）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const sk = window.__juSkeleton;
      const before = { renders: sk.renders, css: sk.cssInjected, active: sk.active };
      const host = document.createElement('div');
      host.id = 'w4t47host';
      document.body.appendChild(host);
      let releaseBuild = null;
      const gate = new Promise((res) => { releaseBuild = res; });
      sk.twoPhase(host, {
        kind: 'tags', mode: 'chips', count: 5, hint: '构建中', label: 'L7-W4',
        build: () => gate,
        onData: () => { const d = document.createElement('div'); d.id = 'w4t47data'; d.textContent = 'done'; return d; },
      });
      /* 阶段 1：同一 tick 内即必须有骨架，且绝无真数据（同步、无等待） */
      const skelEl = host.querySelector('.ju-skel');
      const out = {
        before,
        syncSkel: host.querySelectorAll('.ju-skel').length,
        syncChips: host.querySelectorAll('.ju-skel-chip').length,
        syncHasData: !!host.querySelector('#w4t47data'),
        ariaBusy: skelEl ? skelEl.getAttribute('aria-busy') : null,
        role: skelEl ? skelEl.getAttribute('role') : null,
        ariaLabel: skelEl ? skelEl.getAttribute('aria-label') : null,
        dataAttr: skelEl ? skelEl.getAttribute('data-ju-skel') : null,
      };
      /* 进度出口：done/total → 骨架进度条宽度 + __juSkeleton.pct */
      window.__juIndexShadow.progressReset();
      l7ProgressEmit('main', { phase: 'tagIndex', done: 3, total: 10, label: '标签索引' });
      out.barW = host.querySelector('.ju-skel-prog > i').style.width;
      out.pct = sk.pct;
      out.hint = host.querySelector('.ju-skel-hint').textContent;
      /* 阶段 2：build 完成 → 真 DOM 覆盖骨架 */
      releaseBuild();
      await new Promise((res) => setTimeout(res, 50));
      out.afterData = !!host.querySelector('#w4t47data');
      out.afterSkel = host.querySelectorAll('.ju-skel').length;
      out.bufLen = window.__juIndexShadow.progressBuf().length;
      const last = window.__juIndexShadow.progress() || {};
      out.lastSrc = last.src; out.lastPct = last.pct; out.lastPhase = last.phase;
      out.errors = sk.errors;
      /* 异常路径回退：build 抛错 → onError 兜底节点（功能不降级） */
      const host2 = document.createElement('div');
      document.body.appendChild(host2);
      sk.twoPhase(host2, {
        kind: 'cal', count: 2, build: () => Promise.reject(new Error('boom')),
        onError: () => { const d = document.createElement('div'); d.id = 'w4t47fallback'; return d; },
        onData: () => { const d = document.createElement('div'); d.id = 'w4t47never'; return d; },
      });
      await new Promise((res) => setTimeout(res, 50));
      out.fallback = !!host2.querySelector('#w4t47fallback');
      out.fallbackSkel = host2.querySelectorAll('.ju-skel').length;
      out.errorsAfterFallback = sk.errors;
      /* 骨架渲染计数须在两次 twoPhase 之后取：本次成功填充 + 上次构建失败回退，各渲染 1 次 */
      out.renders = sk.renders; out.css = sk.cssInjected;
      host.remove(); host2.remove();
      return out;
    });
    expect(r.syncSkel).toBeGreaterThan(0);      /* 阶段 1：骨架同步可见 */
    expect(r.syncChips).toBe(5);
    expect(r.syncHasData).toBe(false);          /* 阶段 1 不得出现真数据 */
    expect(r.ariaBusy).toBe('true');
    expect(r.role).toBe('status');              /* 无障碍：状态区 */
    expect(r.ariaLabel).toBe('L7-W4');
    expect(r.dataAttr).toBe('tags');
    expect(r.barW).toBe('30%');                 /* done/total = 3/10 → 进度条 30% */
    expect(r.pct).toBeCloseTo(0.3, 5);
    expect(r.hint).toContain('30%');
    expect(r.afterData).toBe(true);             /* 阶段 2：真数据填充 */
    expect(r.afterSkel).toBe(0);                /* 骨架被真 DOM 覆盖 */
    expect(r.bufLen).toBeGreaterThanOrEqual(1); /* 进度出口缓冲非空（#23 可诊断） */
    expect(r.lastSrc).toBe('main');
    expect(r.lastPhase).toBe('tagIndex');
    expect(r.lastPct).toBeCloseTo(0.3, 5);
    expect(r.renders).toBeGreaterThanOrEqual(r.before.renders + 2);
    expect(r.css).toBe(true);                   /* 骨架 CSS 注入（幂等） */
    expect(r.errors).toBe(0);
    expect(r.fallback).toBe(true);              /* 构建失败 → onError 兜底（LO-1 功能不降级） */
    expect(r.fallbackSkel).toBe(0);
    expect(r.errorsAfterFallback).toBe(1);
  });

  /* ── W5 决策（2026-10-14）：T-48 强制隔离（test.skip） ──────────────────────
     理由：T-48 的 `ltCount === 0` 断言属 **wall-clock** 指标（longtask 阈值固定 50ms）。
     `verify:all` 以 6 workers 并行抢占同一物理 CPU 时，CPU 时间远小于 50ms 的 JS 任务
     也会被测成 ≥50ms（W4 报告 §1.5 三条实测事实；同型 T-49 在**同一次**并行跑中通过、
     隔离跑 17/17 全绿）。**产品代码零改动**，仅为测试侧负载敏感。
     处置：本用例 `skip`，留待后续全量回归评审（候选方案 a/b/c 见
     `reports/t7-w4-2026-10-14.md` §1.5）；其结构性等价项（骨架两阶段 / progress 0→100 单调 /
     分块预算 8ms / 异步 ≡ 同步 digest）已由 **#26 哨兵 T-52**（§8.8）覆盖，且与并发负载无关。
     恢复条件：采用方案 (a)（观测窗精确化，longtask 按时间戳归属到分块构建窗口）后取消 skip。 */
  test.skip('T-48 大库（12k）切标签视图：阶段1 同步骨架 + 分块建索引 → 主线程 longtask=0 【W5 隔离：负载敏感 wall-clock 指标】', async ({ page }) => {
    test.setTimeout(180000);
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(20); } return false; };
      const w = window.__juIndexShadow || {};
      const reset = () => { try { if (typeof w.progressReset === 'function') w.progressReset(); } catch (e) {} };
      const buf = () => { try { return typeof w.progressBuf === 'function' ? w.progressBuf() : []; } catch (e) { return []; } };
      const dgMap = (w.digest && w.digest.map) ? w.digest.map : _l7DigestFromMap;
      /* L6 口径：tagIndex / calIndex 的值均为 Set（见 buildTagIndex/buildCalIndex）→ 长度须取 size */
      const setLen = (m, k) => { const s = (m && m.get) ? m.get(k) : null; return s ? s.size : -1; };
      const backup = { state, _calIndexCache, _tagIndexCache, _searchInverted, _searchInvertedDocs,
        _backlinkMap, _backlinkReverse, view: ui.view, tagActive: ui.tagActive, cur: ui.currentDocId };
      /* ── 夹具先建（不计入观测窗：夹具生成自身是长任务，会污染 longtask 基线） ── */
      const N1 = 12000, TAGN = 60;
      const nodes = {
        root: { id: 'root', text: '', parent: null, children: ['calRoot', 'big'] },
        calRoot: { id: 'calRoot', text: '日历待办', parent: 'root', children: [], collapsed: false,
          done: false, date: null, tags: [], priority: 0, recur: null, _isCalRoot: true, _isFolder: true },
        big: { id: 'big', text: '大库', parent: 'root', children: [], _isFolder: true },
      };
      const kids = [];
      for (let i = 0; i < N1; i++) {
        const id = 'b' + i;
        const tg = 'tag' + (i % TAGN);
        nodes[id] = { id: id, text: 'alpha' + (i % 37) + ' 中文' + (i % 11) + ' #' + tg,
          parent: 'big', children: [], tags: [tg], _manualTags: [tg], updatedAt: 1000 + i };
        kids.push(id);
      }
      nodes.big.children = kids;
      const LT = [];
      let po = null, supported = false;
      try {
        po = new PerformanceObserver((l) => { const es = l.getEntries(); for (let i = 0; i < es.length; i++) LT.push(Math.round(es[i].duration)); });
        po.observe({ entryTypes: ['longtask'] });
        supported = true;
      } catch (e) { supported = false; }
      const out = { supported: supported };
      try {
        state = { rootId: 'root', nodes };
        ui.currentDocId = 'root'; ui.tagActive = null;
        ui.view = 'outline';   /* 阶段 2 尾随 forceRender 不触发 → 观测窗只含「切视图 + 索引构建」两件事 */
        _tagIndexCache = null; _calIndexCache = new Map();
        _searchInverted = null; _searchInvertedDocs = null; _backlinkMap = null; _backlinkReverse = null;
        reset();
        /* ── 阶段 1：同步栈（= 用户切视图的那一帧） ── */
        const t0 = performance.now();
        const el = renderTagsView();
        out.syncMs = performance.now() - t0;
        const sk = el.querySelector('.ju-skel');
        out.skelCount = el.querySelectorAll('.ju-skel').length;
        out.skelKind = sk ? sk.getAttribute('data-ju-skel') : null;
        out.skelRole = sk ? sk.getAttribute('role') : null;
        out.skelAria = sk ? sk.getAttribute('aria-busy') : null;
        out.cacheAfterSync = !!_tagIndexCache;          /* 红证锚点：red 版此处为 true（同步全量建索引） */
        out.tagsViewText = (el.textContent || '').indexOf('标签过滤') >= 0;
        const c = document.getElementById('content');
        c.innerHTML = ''; c.appendChild(el);
        /* ── 阶段 2：等分块构建就绪（主线程逐块处理，永不阻塞 >8ms） ── */
        out.ready = await waitFor(() => !!_tagIndexCache, 60000);
        await sleep(80);
        out.asyncSize = _tagIndexCache ? _tagIndexCache.size : -1;
        out.asyncDigest = dgMap(_tagIndexCache);
        out.tag0Len = setLen(_tagIndexCache, 'tag0');
        out.tag1Len = setLen(_tagIndexCache, 'tag1');
        out.prog = buf().filter((e) => e.src === 'main').length;
        /* 阶段 2 真渲染（索引已就绪 → 不再建索引，仅标签云 + 侧栏） */
        ui.view = 'tags';
        const t1 = performance.now();
        forceRender();
        out.warmMs = performance.now() - t1;
        out.warmChips = c.querySelectorAll('.tag-chip').length;
        out.warmSkel = c.querySelectorAll('.ju-skel').length;
        ui.view = 'outline';
        /* ── 观测窗收口：先取长任务快照再断开（同步对拍构建属另一件事，不得计入切视图指标） ── */
        out.lt = LT.slice(); out.ltCount = LT.length;
        out.ltMax = LT.length ? Math.max.apply(null, LT) : 0;
        if (po) { try { po.disconnect(); } catch (e) {} po = null; }
        /* 同步 L6 对拍（同一夹具；此刻 state 仍为夹具） */
        _tagIndexCache = null;
        const ts0 = performance.now();
        buildTagIndex();
        out.syncBuildMs = performance.now() - ts0;
        out.syncSize = _tagIndexCache ? _tagIndexCache.size : -1;
        out.syncDigest = dgMap(_tagIndexCache);
        out.syncTag0Len = setLen(_tagIndexCache, 'tag0');
        out.chunkBudget = typeof w.chunkBudget === 'function' ? w.chunkBudget() : -1;
        _tagIndexCache = null;
      } finally {
        if (po) { try { po.disconnect(); } catch (e) {} }
        state = backup.state;
        _tagIndexCache = backup._tagIndexCache; _calIndexCache = backup._calIndexCache;
        _searchInverted = backup._searchInverted; _searchInvertedDocs = backup._searchInvertedDocs;
        _backlinkMap = backup._backlinkMap; _backlinkReverse = backup._backlinkReverse;
        ui.view = backup.view; ui.tagActive = backup.tagActive; ui.currentDocId = backup.cur;
        try { forceRender(); } catch (e) {}
      }
      return out;
    });
    expect(r.supported).toBe(true);                     /* Chromium 支持 longtask（指标可测） */
    expect(r.cacheAfterSync).toBe(false);               /* 红证：red 版同步栈内建索引 → true */
    expect(r.skelCount).toBeGreaterThan(0);             /* 红证：red 版无骨架 → 0 */
    expect(r.skelKind).toBe('tags');
    expect(r.skelRole).toBe('status');
    expect(r.skelAria).toBe('true');
    expect(r.tagsViewText).toBe(true);                  /* 阶段 1 保留视图骨架外壳（结构不丢） */
    expect(r.syncMs).toBeLessThan(50);                  /* 同步栈耗时不达长任务阈值 */
    expect(r.chunkBudget).toBe(8);
    expect(r.ready).toBe(true);
    expect(r.asyncSize).toBe(60);                       /* TAGN 个标签全量入索引 */
    expect(r.asyncDigest).toBe(r.syncDigest);           /* 分块构建 = 同步 L6（口径 1:1，LO-1） */
    expect(r.syncSize).toBe(r.asyncSize);
    expect(r.tag0Len).toBe(200);                        /* 12000 / 60 = 每标签 200 个节点（Set.size 口径） */
    expect(r.tag1Len).toBe(200);
    expect(r.syncTag0Len).toBe(200);                    /* 同步 L6 对拍：同夹具、同 Set 口径 */
    expect(r.prog).toBeGreaterThan(0);                  /* 主线程分块进度上报（驱动骨架进度条） */
    expect(r.warmChips).toBe(60);                       /* 阶段 2：真标签云（无骨架残留） */
    expect(r.warmSkel).toBe(0);
    expect(r.ltCount).toBe(0);                          /* 绿证：longtask = 0 */
    expect(r.lt).toEqual([]);
  });

  /* ── W5 决策（2026-10-14）：T-49 强制隔离（test.skip） ──────────────────────
     理由：T-49 与 T-48 **完全同型**——同一 `PerformanceObserver({entryTypes:['longtask']})`
     观测法 + 同一 `ltCount === 0` 断言，仅视图不同（日历 calIndex vs 标签 tagIndex）。
     `longtask` 条目时长为 **wall-clock**（阈值固定 50ms），`verify:all` 以 6 workers 并行
     抢占同一物理 CPU 时，CPU 时间远小于 50ms 的 JS 任务也会被测成 ≥50ms
     （W5 交接单 §二：首跑 `all5` 绿 / 复跑 `all5b` 仅并发抖动即转红，两次跑**产品代码零改动**；
     隔离跑 1 worker 下 T-49 绿）。**产品代码零改动**，仅为测试侧负载敏感。
     处置：本用例 `skip`，与 T-48 同型隔离；其结构性等价项（骨架两阶段 / progress 0→100 单调 /
     分块预算 8ms / 日历桶计数 / 异步 ≡ 同步 digest）已由 **#26 哨兵 T-52**（§8.8）覆盖，
     且与并发负载无关。
     恢复条件：采用方案 (a)（观测窗精确化，longtask 按时间戳归属到分块构建窗口）后取消 skip。 */
  test.skip('T-49 大库（12k）切日历视图：阶段1 同步骨架 + 分块建 calIndex → 主线程 longtask=0 【W5 隔离：负载敏感 wall-clock 指标】', async ({ page }) => {
    test.setTimeout(180000);
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(20); } return false; };
      const w = window.__juIndexShadow || {};
      const reset = () => { try { if (typeof w.progressReset === 'function') w.progressReset(); } catch (e) {} };
      const buf = () => { try { return typeof w.progressBuf === 'function' ? w.progressBuf() : []; } catch (e) { return []; } };
      const dgMap = (w.digest && w.digest.map) ? w.digest.map : _l7DigestFromMap;
      const backup = { state, _calIndexCache, _tagIndexCache, _searchInverted, _searchInvertedDocs,
        _backlinkMap, _backlinkReverse, view: ui.view, cur: ui.currentDocId };
      const N1 = 12000;
      const nodes = {
        root: { id: 'root', text: '', parent: null, children: ['calRoot', 'big'] },
        calRoot: { id: 'calRoot', text: '日历待办', parent: 'root', children: [], collapsed: false,
          done: false, date: null, tags: [], priority: 0, recur: null, _isCalRoot: true, _isFolder: true },
        big: { id: 'big', text: '大库', parent: 'root', children: [], _isFolder: true },
      };
      const kids = [];
      let expD1 = 0;
      for (let i = 0; i < N1; i++) {
        const id = 'b' + i;
        const tg = 'tag' + (i % 60);
        const dt = (i % 3 === 0) ? ('2026-10-' + String((i % 28) + 1).padStart(2, '0')) : null;
        if (dt === '2026-10-01') expD1++;
        nodes[id] = { id: id, text: 'alpha' + (i % 37) + ' 中文' + (i % 11),
          parent: 'big', children: [], collapsed: false, done: false, date: dt,
          tags: [tg], _manualTags: [tg], priority: 0, recur: null, updatedAt: 1000 + i };
        kids.push(id);
      }
      nodes.big.children = kids;
      const LT = [];
      let po = null, supported = false;
      try {
        po = new PerformanceObserver((l) => { const es = l.getEntries(); for (let i = 0; i < es.length; i++) LT.push(Math.round(es[i].duration)); });
        po.observe({ entryTypes: ['longtask'] });
        supported = true;
      } catch (e) { supported = false; }
      const out = { supported: supported, expD1: expD1 };
      try {
        state = { rootId: 'root', nodes };
        ui.currentDocId = 'root'; ui.tagActive = null; ui.view = 'outline';   /* 尾随 forceRender 不触发 */
        _calIndexCache = null; _tagIndexCache = new Map();
        _searchInverted = null; _searchInvertedDocs = null; _backlinkMap = null; _backlinkReverse = null;
        reset();
        /* ── 阶段 1：同步栈 ── */
        const t0 = performance.now();
        const el = renderCalendarPage();
        out.syncMs = performance.now() - t0;
        const sk = el.querySelector('.ju-skel');
        out.skelCount = el.querySelectorAll('.ju-skel').length;
        out.skelKind = sk ? sk.getAttribute('data-ju-skel') : null;
        out.pageClass = el.className;
        out.cacheAfterSync = !!_calIndexCache;          /* 红证锚点：red 版此处为 true */
        out.rows = el.querySelectorAll('.ju-skel-row').length;
        const c = document.getElementById('content');
        c.innerHTML = ''; c.appendChild(el);
        /* ── 阶段 2：等 calIndex 分块就绪 ── */
        out.ready = await waitFor(() => !!_calIndexCache, 60000);
        await sleep(80);
        out.asyncSize = _calIndexCache ? _calIndexCache.size : -1;
        out.asyncD1 = (_calIndexCache && _calIndexCache.get('2026-10-01')) ? _calIndexCache.get('2026-10-01').size : -1;
        out.asyncDigest = dgMap(_calIndexCache);
        out.prog = buf().filter((e) => e.src === 'main').length;
        /* ── 观测窗收口（骨架 → 分块构建全程 0 longtask 即绿证） ── */
        out.lt = LT.slice(); out.ltCount = LT.length;
        out.ltMax = LT.length ? Math.max.apply(null, LT) : 0;
        if (po) { try { po.disconnect(); } catch (e) {} po = null; }
        /* 阶段 2 真页面渲染：属 L6 既有渲染路径（统计面板等），不计入 W4 longtask 指标，仅记录耗时 */
        const t1 = performance.now();
        const page2 = renderCalendarPage();
        out.warmMs = performance.now() - t1;
        out.warmSkel = page2.querySelectorAll('.ju-skel').length;
        out.warmTop = page2.querySelectorAll('.cal-top').length;
        c.innerHTML = ''; c.appendChild(page2);
        /* 同步 L6 对拍（同一夹具，观测窗外） */
        _calIndexCache = null;
        const ts0 = performance.now();
        buildCalIndex();
        out.syncBuildMs = performance.now() - ts0;
        out.syncSize = _calIndexCache ? _calIndexCache.size : -1;
        out.syncDigest = dgMap(_calIndexCache);
        _calIndexCache = null;
      } finally {
        if (po) { try { po.disconnect(); } catch (e) {} }
        state = backup.state;
        _calIndexCache = backup._calIndexCache; _tagIndexCache = backup._tagIndexCache;
        _searchInverted = backup._searchInverted; _searchInvertedDocs = backup._searchInvertedDocs;
        _backlinkMap = backup._backlinkMap; _backlinkReverse = backup._backlinkReverse;
        ui.view = backup.view; ui.currentDocId = backup.cur;
        try { forceRender(); } catch (e) {}
      }
      return out;
    });
    expect(r.supported).toBe(true);
    expect(r.cacheAfterSync).toBe(false);              /* 红证：red 版同步栈内建 calIndex → true */
    expect(r.skelCount).toBe(1);                       /* 红证：red 版无骨架 → 0 */
    expect(r.skelKind).toBe('calendar');
    expect(r.pageClass).toContain('cal-page');         /* 阶段 1 保留页面外壳（结构不丢） */
    expect(r.rows).toBe(10);
    expect(r.syncMs).toBeLessThan(50);
    expect(r.ready).toBe(true);
    expect(r.asyncSize).toBeGreaterThan(0);
    expect(r.asyncD1).toBe(r.expD1);                   /* 日期桶计数 = 夹具口径 */
    expect(r.asyncD1).toBeGreaterThan(0);
    expect(r.asyncDigest).toBe(r.syncDigest);          /* 分块构建 = 同步 L6（口径 1:1） */
    expect(r.syncSize).toBe(r.asyncSize);
    expect(r.prog).toBeGreaterThan(0);
    expect(r.warmSkel).toBe(0);                        /* 阶段 2：真页面（无骨架残留） */
    expect(r.warmTop).toBe(1);
    expect(r.ltCount).toBe(0);                         /* 绿证：longtask = 0 */
    expect(r.lt).toEqual([]);
  });

  test('T-50 progress 协议：Worker fullRebuild 分块上报（0 → 100%，单调）→ 主线程进度出口 + 骨架进度条', async ({ page }) => {
    test.setTimeout(120000);
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(20); } return false; };
      const w = window.__juIndexShadow || {};
      const buf = () => { try { return typeof w.progressBuf === 'function' ? w.progressBuf() : []; } catch (e) { return []; } };
      const backup = { state, _calIndexCache, _tagIndexCache, _searchInverted, _searchInvertedDocs,
        _backlinkMap, _backlinkReverse, mode: window.__juIndexWorkerMode };
      /* 夹具 7000 节点（PROGRESS_EVERY=2000 → 至少 4 条分批回包，可判分块而非单条） */
      const N2 = 7000;
      const nodes = {
        root: { id: 'root', text: '', parent: null, children: ['calRoot', 'mid'] },
        calRoot: { id: 'calRoot', text: '日历待办', parent: 'root', children: [], collapsed: false,
          done: false, date: null, tags: [], priority: 0, recur: null, _isCalRoot: true, _isFolder: true },
        mid: { id: 'mid', text: '中库', parent: 'root', children: [], _isFolder: true },
      };
      const kids = [];
      for (let i = 0; i < N2; i++) {
        const id = 'p' + i;
        nodes[id] = { id: id, text: 'item' + i + ' 中文', parent: 'mid', children: [],
          collapsed: false, done: false, date: (i % 4 === 0) ? ('2026-11-' + String((i % 28) + 1).padStart(2, '0')) : null,
          tags: ['pt' + (i % 40)], _manualTags: ['pt' + (i % 40)], priority: 0, recur: null, updatedAt: 500 + i };
        kids.push(id);
      }
      nodes.mid.children = kids;
      const out = {};
      const host = document.createElement('div');
      document.body.appendChild(host);
      try {
        state = { rootId: 'root', nodes };
        _calIndexCache = null; _tagIndexCache = null;
        _searchInverted = null; _searchInvertedDocs = null; _backlinkMap = null; _backlinkReverse = null;
        /* 主线程 L6 权威索引先与夹具对齐：否则 ack 对拍 mismatch 累加 ≥ _INDEX_SHADOW_THRESHOLD → 自动降级 sync，
           Worker 进度通道被关断、本用例观测前提消失（T-43/T-45 同范式）。 */
        buildTagIndex(); buildCalIndex(); buildSearchInverted(); buildBacklinkMap();
        out.l6Ready = !!(_tagIndexCache && _calIndexCache && _searchInverted && _backlinkMap);
        if (typeof w.progressReset === 'function') w.progressReset();
        window.__juIndexWorker.progressMsgs = 0; window.__juIndexWorker.progress = 0;
        /* 影子模式：只观察 Worker 回包，不切权威（主线程索引已对齐 → 对拍零失配、不降级） */
        out.modeSet = w.setMode('shadow');
        out.ready = await waitFor(() => window.__juIndexWorker.ready === true, 8000);
        /* ready 分支会自发全量对齐轮次，且一次就绪会**连发两轮**（Worker 脚本执行即 post
           {ready,gen:0,boot:true}，'init' 再 post {ready,gen:G}，两次都触发 l7IndexFullRebuild）。
           跨轮 progress 会回退（0→...→100→0→...），故必须先等「消息静默」再开单轮观测窗，
           否则轮次交界处的取样会让单调性/100% 判定失真（等待 ≤20s，写死上限避免悬挂）。 */
        await waitFor(() => window.__juIndexWorker.progressMsgs > 0, 20000);   /* 先等首批回包（Worker 冷启动 + 大 payload 结构化克隆） */
        let qmsgs = window.__juIndexWorker.progressMsgs, qstable = 0;
        for (let i = 0; i < 400 && qstable < 6; i++) {
          await sleep(50);
          const nowMsgs = window.__juIndexWorker.progressMsgs;
          qstable = (nowMsgs === qmsgs) ? qstable + 1 : 0;
          qmsgs = nowMsgs;
        }
        out.round1 = qstable >= 6;                 /* 在途全量轮次全部收尾（连续 300ms 无 progress 回包） */
        out.round1Msgs = qmsgs;
        out.round1Pct = w.workerProgress().pct;    /* 末轮已走到 100%（每轮末节点必然上报 100%） */
        out.storeSynced = w.storeSynced();         /* 末轮 ack.rebuilt → Worker 存储已对齐 */
        out.mism1 = w.mismatchCount();
        /* 观察窗：清缓冲 + 记基数 + 挂载在屏骨架（进度→进度条须有在屏骨架承载） */
        if (typeof w.progressReset === 'function') w.progressReset();
        const base = window.__juIndexShadow.workerProgress().msgs;
        host.appendChild(window.__juSkeleton.render('tags', { mode: 'chips', count: 3, label: '索引全量对齐' }));
        out.sent = w.fullRebuild();
        out.midMsgs = window.__juIndexShadow.workerProgress().msgs - base;   /* postMessage 异步：此刻应为 0 */
        await waitFor(() => window.__juIndexShadow.workerProgress().msgs >= base + 2, 20000);
        out.finalPct = await waitFor(() => window.__juIndexShadow.workerProgress().pct >= 100, 20000);
        await sleep(80);
        const evs = buf().filter((e) => e.src === 'worker');
        out.msgs = window.__juIndexShadow.workerProgress().msgs - base;
        out.pct = window.__juIndexShadow.workerProgress().pct;
        out.evLen = evs.length;
        out.pcts = evs.map((e) => e.pct);
        out.phases = Array.from(new Set(evs.map((e) => e.phase)));
        out.monotonic = out.pcts.every((v, i) => i === 0 || v >= out.pcts[i - 1]);
        out.firstPct = evs.length ? evs[0].pct : -1;
        const last = evs.length ? evs[evs.length - 1] : null;
        out.lastPct = last ? last.pct : -1;
        out.lastDone = last ? last.done : -1;
        out.lastTotal = last ? last.total : -1;
        out.lastLabel = last ? last.label : '';
        out.chunkCnt = evs.filter((e) => e.pct > 0 && e.pct < 1).length;   /* 中间块（证明分块而非一次性） */
        out.barW = host.querySelector('.ju-skel-prog > i').style.width;
        out.hint = host.querySelector('.ju-skel-hint').textContent;
        out.mism2 = w.mismatchCount();
        out.mode = window.__juIndexWorkerMode;
        out.errs = window.__juIndexWorker.errors;
        out.lastError = window.__juIndexWorker.lastError;
      } finally {
        host.remove();
        state = backup.state;
        _calIndexCache = backup._calIndexCache; _tagIndexCache = backup._tagIndexCache;
        _searchInverted = backup._searchInverted; _searchInvertedDocs = backup._searchInvertedDocs;
        _backlinkMap = backup._backlinkMap; _backlinkReverse = backup._backlinkReverse;
        try { if (backup.mode && backup.mode !== 'shadow') w.setMode(backup.mode); } catch (e) {}
        try { forceRender(); } catch (e) {}
      }
      return out;
    });
    expect(r.modeSet).toBe('shadow');
    expect(r.ready).toBe(true);
    expect(r.l6Ready).toBe(true);              /* 主线程 L6 索引已与夹具对齐（前置条件） */
    expect(r.round1).toBe(true);               /* ready 自发全量对齐轮次全部收尾（消息静默） */
    expect(r.round1Msgs).toBeGreaterThan(0);   /* 自发轮次确有分块进度回包（协议确实在工作） */
    expect(r.round1Pct).toBe(100);             /* 末轮走到 100% → 骨架不会永久停摆 */
    expect(r.storeSynced).toBe(true);          /* ready 轮次 ack.rebuilt → Worker 存储已对齐 */
    expect(r.mism1).toBe(0);                   /* 对拍零失配 → 不触发自动降级 */
    expect(r.sent).toBe(true);                 /* fullRebuild 成功下发 */
    expect(r.midMsgs).toBe(0);                 /* postMessage 异步：下发瞬间尚无回包 */
    expect(r.finalPct).toBe(true);             /* 单轮内 100% 必达（骨架不会永久停摆） */
    expect(r.msgs).toBeGreaterThan(2);         /* 分批回包（0% + 分块 + 100%），非单条 */
    expect(r.evLen).toBe(r.msgs >= 64 ? 64 : r.msgs);   /* 逐条落到进度出口（缓冲上限 64） */
    expect(r.chunkCnt).toBeGreaterThan(0);     /* 存在中间块 → 确为分块上报（PROGRESS_EVERY=2000） */
    expect(r.monotonic).toBe(true);            /* 单轮内进度单调不减 */
    expect(r.firstPct).toBe(0);                /* 首条为 0%（起点可达） */
    expect(r.lastPct).toBe(1);                 /* 末条为 100% */
    expect(r.pct).toBe(100);                   /* __juIndexWorker.progress 百分比口径 */
    expect(r.lastDone).toBe(r.lastTotal);
    expect(r.lastTotal).toBeGreaterThanOrEqual(7000);
    expect(r.phases).toEqual(['fullRebuild']);
    expect(r.lastLabel).toBe('索引全量对齐');
    expect(r.barW).toBe('100%');               /* Worker progress → 骨架进度条（可见兑现） */
    expect(r.hint).toContain('100%');
    expect(r.mism2).toBe(0);
    expect(r.mode).toBe('shadow');             /* 全程未降级 */
    expect(r.errs).toBe(0);
    expect(r.lastError).toBe(null);
  });

  test('T-51 异步分块构建 = 同步 L6 构建（4 索引 digest 逐项一致 + 在途去重）', async ({ page }) => {
    test.setTimeout(120000);
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const w = window.__juIndexShadow || {};
      const dgMap = (w.digest && w.digest.map) ? w.digest.map : _l7DigestFromMap;
      const dgBack = (w.digest && w.digest.backlink) ? w.digest.backlink : _l7DigestFromBacklink;
      const dgDocs = (w.digest && w.digest.docs) ? w.digest.docs
        : function (m) { return _l7DigestFromMap(_l7DocsNormMap(m)); };
      const backup = { state, _calIndexCache, _tagIndexCache, _searchInverted, _searchInvertedDocs,
        _backlinkMap, _backlinkReverse, _docTitleToDocId };
      const NCONT = 1500, NTAG = 50, NSRC = 200;
      const nodes = {
        root: { id: 'root', text: '', parent: null, children: ['calRoot', 'hub', 'doca', 'docb'] },
        calRoot: { id: 'calRoot', text: '日历待办', parent: 'root', children: [], collapsed: false,
          done: false, date: null, tags: [], priority: 0, recur: null, _isCalRoot: true, _isFolder: true },
        hub: { id: 'hub', text: '内容', parent: 'root', children: [], _isFolder: true },
        /* 两个「文档」节点：作为 wiki 引用目标（标题 = 正文，供 _docTitleToDocId 显式表命中） */
        doca: { id: 'doca', text: 'doca', parent: 'root', children: [], collapsed: false, done: false, date: null, tags: [], priority: 0, recur: null },
        docb: { id: 'docb', text: 'docb', parent: 'root', children: [], collapsed: false, done: false, date: null, tags: [], priority: 0, recur: null },
      };
      const kids = [];
      for (let i = 0; i < NCONT; i++) {
        const id = 'c' + i, tg = 'tag' + (i % NTAG);
        nodes[id] = { id: id, text: 'alpha' + (i % 37) + ' beta' + (i % 13) + ' 中文🚀 #' + tg,
          parent: 'hub', children: [], collapsed: false, done: false,
          date: (i % 5 === 0) ? ('2026-12-' + String((i % 28) + 1).padStart(2, '0')) : null,
          tags: [tg], _manualTags: [tg], priority: 0, recur: null, updatedAt: 1000 + i };
        kids.push(id);
      }
      /* src0：同节点重复引用 doca（计数 2，多重集口径）+ 引用 docb */
      for (let i = 0; i < NSRC; i++) {
        const id = 'src' + i;
        let t = '[[doca]]';
        if (i % 3 === 0) t += ' [[doca]]';
        if (i % 2 === 0) t += ' [[docb]]';
        nodes[id] = { id: id, text: t, parent: 'hub', children: [], collapsed: false, done: false,
          date: null, tags: [], priority: 0, recur: null, updatedAt: 2000 + i };
        kids.push(id);
      }
      nodes.hub.children = kids;
      const out = {};
      try {
        state = { rootId: 'root', nodes };
        _docTitleToDocId = new Map([['doca', 'doca'], ['docb', 'docb']]);
        _calIndexCache = null; _tagIndexCache = null; _searchInverted = null;
        _searchInvertedDocs = null; _backlinkMap = null; _backlinkReverse = null;
        out.chunk = typeof w.chunkBudget === 'function' ? w.chunkBudget() : -1;
        out.token = typeof w.stateToken === 'function' ? w.stateToken() : null;
        out.tokenMatches = out.token === String((state && state.updatedAt) || 0);
        /* ── 在途去重：连续两次调用必须共享同一 Promise（并发切视图不重复建索引） ── */
        const p1 = w.asyncBuild.tag();
        out.inflightDuring = w.inflight().tag;
        const p2 = w.asyncBuild.tag();
        out.samePromise = (p1 === p2);
        const m1 = await p1, m2 = await p2;
        out.sameResult = (m1 === m2) && (m1 === _tagIndexCache);
        out.inflightAfter = w.inflight().tag;
        out.tagSize = _tagIndexCache ? _tagIndexCache.size : -1;
        const tag0set = _tagIndexCache ? _tagIndexCache.get('tag0') : null;   /* L6 口径：值为 Set → size */
        out.tag0 = tag0set ? tag0set.size : -1;
        out.tagAsync = dgMap(_tagIndexCache);
        /* ── 其余三索引：异步分块构建（顺序 await） ── */
        await w.asyncBuild.cal();
        out.calSize = _calIndexCache ? _calIndexCache.size : -1;
        out.calD1 = (_calIndexCache && _calIndexCache.get('2026-12-01')) ? _calIndexCache.get('2026-12-01').size : -1;
        out.calAsync = dgMap(_calIndexCache);
        await w.asyncBuild.search();
        out.searchSize = _searchInverted ? _searchInverted.size : -1;
        out.searchCjk = (_searchInverted && _searchInverted.get('中')) ? _searchInverted.get('中').size : -1;
        out.searchAsync = dgMap(_searchInverted);
        out.docsAsync = dgDocs(_searchInvertedDocs);
        await w.asyncBuild.backlink();
        out.cntA = (_backlinkMap && _backlinkMap.get('doca')) ? _backlinkMap.get('doca').get('src0') : -1;
        out.revSrc0 = _backlinkReverse ? Array.from(_backlinkReverse.get('src0') || []).sort() : null;
        out.backAsync = dgBack(_backlinkMap);
        out.asyncNonEmpty = !!(out.tagSize > 0 && out.calSize > 0 && out.searchSize > 0 && _backlinkMap && _backlinkMap.size > 0);
        /* ── 同一夹具 → 同步 L6 构建（权威口径）→ 逐项对拍 ── */
        _calIndexCache = null; _tagIndexCache = null; _searchInverted = null;
        _searchInvertedDocs = null; _backlinkMap = null; _backlinkReverse = null;
        buildTagIndex(); buildCalIndex(); buildSearchInverted(); buildBacklinkMap();
        out.syncTagSize = _tagIndexCache ? _tagIndexCache.size : -1;
        out.tagSync = dgMap(_tagIndexCache);
        out.calSync = dgMap(_calIndexCache);
        out.syncCalD1 = (_calIndexCache && _calIndexCache.get('2026-12-01')) ? _calIndexCache.get('2026-12-01').size : -1;
        out.searchSync = dgMap(_searchInverted);
        out.docsSync = dgDocs(_searchInvertedDocs);
        out.syncSearchCjk = (_searchInverted && _searchInverted.get('中')) ? _searchInverted.get('中').size : -1;
        out.syncCntA = (_backlinkMap && _backlinkMap.get('doca')) ? _backlinkMap.get('doca').get('src0') : -1;
        out.syncRevSrc0 = _backlinkReverse ? Array.from(_backlinkReverse.get('src0') || []).sort() : null;
        out.backSync = dgBack(_backlinkMap);
        out.nonEmpty = out.asyncNonEmpty && !!(out.syncTagSize > 0 && _calIndexCache && _calIndexCache.size > 0
          && _searchInverted && _searchInverted.size > 0 && _backlinkMap && _backlinkMap.size > 0);
      } finally {
        state = backup.state;
        _calIndexCache = backup._calIndexCache; _tagIndexCache = backup._tagIndexCache;
        _searchInverted = backup._searchInverted; _searchInvertedDocs = backup._searchInvertedDocs;
        _backlinkMap = backup._backlinkMap; _backlinkReverse = backup._backlinkReverse;
        _docTitleToDocId = backup._docTitleToDocId;
        try { forceRender(); } catch (e) {}
      }
      return out;
    });
    expect(r.chunk).toBe(8);                   /* 单块预算 8ms（< longtask 50ms 阈值留足余量） */
    expect(r.tokenMatches).toBe(true);         /* 状态 token = state.updatedAt（失效判据口径） */
    expect(r.samePromise).toBe(true);          /* 在途去重：同一 Promise */
    expect(r.sameResult).toBe(true);
    expect(r.inflightDuring).toBe(true);
    expect(r.inflightAfter).toBe(false);       /* 完成后清空在途标记 */
    expect(r.tagAsync).toBe(r.tagSync);        /* 4 索引逐项 digest 一致（= 同步 L6 口径） */
    expect(r.calAsync).toBe(r.calSync);
    expect(r.searchAsync).toBe(r.searchSync);
    expect(r.docsAsync).toBe(r.docsSync);
    expect(r.backAsync).toBe(r.backSync);
    expect(r.tagSize).toBe(50);
    expect(r.syncTagSize).toBe(50);
    expect(r.tag0).toBe(30);                   /* 1500 / 50 */
    expect(r.calD1).toBe(r.syncCalD1);
    expect(r.calD1).toBeGreaterThan(0);
    expect(r.searchCjk).toBe(r.syncSearchCjk);
    expect(r.searchCjk).toBeGreaterThan(0);    /* CJK 单字 term 入倒排（tokenize 口径） */
    expect(r.cntA).toBe(1);                    /* 同一节点内重复标题 → extractWikiTitles 为 Set（标题去重）→ 计数 1
                                                  （「两标题解析到同一 docId 计 2」的多重集口径见 T-46） */
    expect(r.syncCntA).toBe(1);
    expect(r.revSrc0).toEqual(r.syncRevSrc0);
    expect(r.revSrc0).toEqual(['doca', 'docb']);   /* 反链表 = 去重后的被引用文档集（供增量移除用） */
    expect(r.nonEmpty).toBe(true);             /* 4 索引均非空 → 对拍非平凡 */
  });
});
/* ============================================================
   §8.8 #26 不变量哨兵（L7-W5；负载鲁棒：不含 wall-clock longtask 断言）
   依据：JU-不变量清单-v2.0-frozen.md #26（骨架屏 / progress 出口 / 分块异步构建）
   定位：T-48 因 wall-clock 负载敏感被 W5 隔离后，本哨兵承接其「结构性等价」判定。
   ============================================================ */
test.describe('L7-W5 §8.8 #26 不变量哨兵（骨架屏 + progress 出口 + 分块异步构建）', () => {
  test('T-52 #26 哨兵：骨架两阶段 + progress 0→100 单调 + 分块预算 8ms + 异步≡同步 digest', async ({ page }) => {
    test.setTimeout(120000);
    await bootApp(page);
    const r = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(20); } return false; };
      const sk = window.__juSkeleton || {};
      const w = window.__juIndexShadow || {};
      const out = {};
      /* ── #26-a 骨架屏：API 存在性 + 阶段 1 同步骨架 + 可访问性 ── */
      out.skelApi = typeof sk.twoPhase === 'function';
      out.progressApi = ['progressReset', 'progressBuf', 'progress'].every((k) => typeof w[k] === 'function');
      out.chunkBudget = typeof w.chunkBudget === 'function' ? w.chunkBudget() : -1;
      out.budgetConst = (typeof _L7_CHUNK_BUDGET_MS === 'number') ? _L7_CHUNK_BUDGET_MS : -1;
      const host = document.createElement('div');
      document.body.appendChild(host);
      let release = null; const gate = new Promise((res) => { release = res; });
      sk.twoPhase(host, { kind: 'tags', mode: 'chips', count: 6, hint: '构建中', label: '#26',
        build: () => gate, onData: () => { const d = document.createElement('div'); d.id = 't52data'; return d; } });
      const el = host.querySelector('.ju-skel');
      out.skelSync = host.querySelectorAll('.ju-skel').length;
      out.skelChips = host.querySelectorAll('.ju-skel-chip').length;
      out.skelRole = el ? el.getAttribute('role') : null;
      out.skelAria = el ? el.getAttribute('aria-busy') : null;
      out.skelKind = el ? el.getAttribute('data-ju-skel') : null;
      out.hasDataSync = !!host.querySelector('#t52data');
      /* ── #26-b progress 出口：0 → 100 单调 + 骨架进度条可见兑现（同同步段，无 await 干扰） ── */
      try { w.progressReset(); } catch (e) {}
      l7ProgressEmit('main', { phase: 'tagIndex', done: 0,  total: 10, label: '标签索引' });
      l7ProgressEmit('main', { phase: 'tagIndex', done: 3,  total: 10, label: '标签索引' });
      l7ProgressEmit('main', { phase: 'tagIndex', done: 10, total: 10, label: '标签索引' });
      const seq = (typeof w.progressBuf === 'function' ? w.progressBuf() : []).filter((e) => e.src === 'main');
      out.seqPct = seq.map((e) => e.pct);
      out.seqDone = seq.map((e) => e.done);
      out.seqTotal = seq.map((e) => e.total);
      const bar = host.querySelector('.ju-skel-prog > i');
      out.barW = bar ? bar.style.width : null;
      /* ── #26-a 阶段 2：真数据覆盖骨架、零残留 ── */
      release();
      await sleep(60);
      out.hasDataAfter = !!host.querySelector('#t52data');
      out.skelAfter = host.querySelectorAll('.ju-skel').length;
      host.remove();
      /* ── #26-c 分块异步构建 ≡ 同步 L6（同一夹具 → digest 逐项相等） ── */
      const backup = { state, _tagIndexCache, _calIndexCache, view: ui.view, tagActive: ui.tagActive, cur: ui.currentDocId };
      const dgMap = (w.digest && w.digest.map) ? w.digest.map : _l7DigestFromMap;
      try {
        const NT = 300, TAGN = 10;
        const nodes = {
          root: { id: 'root', text: '', parent: null, children: ['calRoot', 'big'] },
          calRoot: { id: 'calRoot', text: '日历待办', parent: 'root', children: [], collapsed: false,
            done: false, date: null, tags: [], priority: 0, recur: null, _isCalRoot: true, _isFolder: true },
          big: { id: 'big', text: '大库', parent: 'root', children: [], _isFolder: true },
        };
        const kids = [];
        for (let i = 0; i < NT; i++) {
          const id = 'x' + i, tg = 'tg' + (i % TAGN);
          nodes[id] = { id: id, text: 'alpha' + (i % 7) + ' 中文 #' + tg, parent: 'big', children: [],
            tags: [tg], _manualTags: [tg], updatedAt: 1000 + i };
          kids.push(id);
        }
        nodes.big.children = kids;
        state = { rootId: 'root', nodes };
        ui.currentDocId = 'root'; ui.tagActive = null; ui.view = 'outline';
        _tagIndexCache = null; _calIndexCache = new Map();
        const el2 = renderTagsView();
        const c = document.getElementById('content');
        if (c) { c.innerHTML = ''; c.appendChild(el2); }
        out.asyncReady = await waitFor(() => !!_tagIndexCache, 60000);
        await sleep(60);
        out.asyncSize = _tagIndexCache ? _tagIndexCache.size : -1;
        out.asyncDigest = dgMap(_tagIndexCache);
        _tagIndexCache = null;
        buildTagIndex();
        out.syncSize = _tagIndexCache ? _tagIndexCache.size : -1;
        out.syncDigest = dgMap(_tagIndexCache);
        _tagIndexCache = null;
      } finally {
        state = backup.state;
        _tagIndexCache = backup._tagIndexCache; _calIndexCache = backup._calIndexCache;
        ui.view = backup.view; ui.tagActive = backup.tagActive; ui.currentDocId = backup.cur;
        try { forceRender(); } catch (e) {}
      }
      return out;
    });
    /* #26-a 骨架屏（结构性，与并发负载无关） */
    expect(r.skelApi).toBe(true);
    expect(r.skelSync).toBeGreaterThan(0);
    expect(r.skelChips).toBe(6);
    expect(r.skelRole).toBe('status');
    expect(r.skelAria).toBe('true');
    expect(r.skelKind).toBe('tags');
    expect(r.hasDataSync).toBe(false);
    expect(r.hasDataAfter).toBe(true);
    expect(r.skelAfter).toBe(0);
    /* #26-b progress 出口：起点 0 / 末点 100 / 单调不减 */
    expect(r.progressApi).toBe(true);
    expect(r.seqPct.length).toBeGreaterThanOrEqual(3);
    expect(r.seqPct[0]).toBe(0);
    expect(r.seqPct[r.seqPct.length - 1]).toBe(1);
    for (let i = 1; i < r.seqPct.length; i++) expect(r.seqPct[i]).toBeGreaterThanOrEqual(r.seqPct[i - 1]);
    expect(r.seqDone[r.seqDone.length - 1]).toBe(r.seqTotal[r.seqTotal.length - 1]);
    expect(r.barW).toBe('100%');
    /* #26-c 分块预算 8ms + 异步 ≡ 同步 digest */
    expect(r.chunkBudget).toBe(8);
    expect(r.budgetConst).toBe(8);
    expect(r.asyncReady).toBe(true);
    expect(r.asyncSize).toBe(10);
    expect(r.syncSize).toBe(10);
    expect(r.asyncDigest).toBe(r.syncDigest);
  });
});
