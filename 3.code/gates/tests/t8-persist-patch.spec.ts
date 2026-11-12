// @ts-nocheck
/**
 * L8 阶段 · 增量落盘（JU-PersistAgent）专题 spec
 *   W1 范围：L-1 采集层（脏集投影 / I-1~I-4 注入点 / LO-3 硬删子树补全）+ 探针 __juPersistProbe
 *
 * 依据：l8-design-2026-10-14.md § 五（5.1~5.5 实现方案）、§ 六（交付物）、§ 七（7.2/7.3 路径隔离）、
 *       § 八 8.4（用例矩阵 T-53 ~ T-57）、§ 十一（LO-1~LO-10 裁决回执）
 * 配套：v2.0-t3.html（L8-W1 段：_dirtyNodes / _removedNodes / _persistMode / L8_* 常量 +
 *       markPersistDirty / collectSubtreeIdsFromPreState / markPersistFromPatch / markPersistMerged /
 *       persistDirtyStats / l8PersistActive / l8PersistFailure / __juPersistProbe）
 *
 * 运行（设计文档 § 八 8.5）：npx playwright test step9/tests/t8-persist-patch.spec.ts --workers=1
 *
 * 约定（同 l3-/l4-/l6-/t7- spec）：被测对象为工作文件 v2.0-t3.html；
 *   顶层 let/const（state / historyPast / historyFuture / _dirtyNodes / _removedNodes）在页面全局词法环境可见；
 *   顶层 function（commit / undo / redo / mergeRemoteState / actions / 采集层函数）挂 window。
 *
 * 裁决对用例的约束：
 *   - LO-1 A：mergeRemoteState 广播语义不变、仍不入历史栈（#22）→ T-55
 *   - LO-3 A：硬删必须补全 pre 态子树 id 全集（否则持久层残留孤儿行，违反 #27）→ T-56
 *   - LO-5 A：脏集存「节点引用」（不存 data 字符串）→ T-53 引用相等断言
 *   - LO-9 B：默认 _persistMode === 'patch'（增量默认开启；探针可降级 'full'）→ T-53
 *
 * 矩阵（5 用例 · T-53 ~ T-57，编号沿用设计文档冻结矩阵；LO-10 门禁计数不变）：
 *   §8.1 采集（1 用例 · T-53）
 *   §8.2 撤销/重做标脏（1 用例 · T-54）
 *   §8.3 远端合并采集 + #22 不变（1 用例 · T-55）
 *   §8.4 软删/硬删分流 + LO-3 子树全集（1 用例 · T-56）
 *   §8.5 删除优先（终态裁决）（1 用例 · T-57）
 *   W2 追加（本文件已实现；红证阶段：产品层 W2 尚未落地 → 预期 5 failed）：
 *     T-58 真实通道批形状 / T-59 组批上限 500 + 超限退全量 / T-60 ack 回执 /
 *     T-61 轻量指纹守卫 + 探针 w2 字段 + __juPersistFailures / T-62 mode='full' 双重守卫反向护栏。
 *   W3+：崩溃原子性（T-63/T-64）/ checkpoint 混合（T-65）/ 路径隔离（T-66/T-67）/ 哨兵（T-68）。
 *
 * 环境说明（R5 实测）：Playwright 走 file://（无 Tauri）→ IS_DESKTOP === false，
 *   采集层按设计 § 七 7.3 早退不采集。故 P 层用例统一经探针旁路 __juPersistProbe.forceDesktop(true)
 *   打开采集（等价「桌面判定为真」），不改动任何生产判定逻辑；W2 起通道层用例同法。
 * 零回归口径（W1 验收）：W1 为影子模式（只记账、不发 desktopInvoke），
 *   即使把探针切回 mode='full'，既有 136 用例行为与 L7-W5 冻结门禁逐项一致。
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
    () => typeof commit === 'function' &&
          typeof undo === 'function' &&
          typeof redo === 'function' &&
          typeof mergeRemoteState === 'function' &&
          typeof actions === 'object' &&
          typeof markPersistDirty === 'function' &&
          typeof markPersistFromPatch === 'function' &&
          typeof markPersistMerged === 'function' &&
          typeof collectSubtreeIdsFromPreState === 'function' &&
          typeof l8PersistActive === 'function' &&
          typeof state === 'object' && state !== null && !!state.nodes &&
          !!window.__juPersistProbe && window.__juPersistProbe.ready === true,
    { timeout: 10_000 }
  );
  /* 采集前置（探针三连）：桌面判定为真（file:// 下 IS_DESKTOP=false）+ 增量模式 + 干净脏集 */
  await page.evaluate(() => {
    window.__juPersistProbe.forceDesktop(true);
    window.__juPersistProbe.setMode('patch');
    window.__juPersistProbe.clearDirty();
  });
}

/* ============================================================
   一、采集层（1 用例 · T-53 · § 五 5.1 脏集投影 / D-1 / I-1）
   ============================================================ */
test.describe('L8-W1 §8.1 采集（脏集投影）', () => {
  test('T-53 commit 后仅改动节点入脏集（引用相等 · 默认 patch 模式）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const docId = actions.createDoc('L8-T53');
      const editId = actions.addNode(docId, 0, { text: 'v1' });
      const p = window.__juPersistProbe;
      p.clearDirty();                              /* 隔离：只测本次 commit 的投影 */
      commit(s => { s.nodes[editId].text = 'v2'; }, { snapshot: true });
      const st = p.stats();
      return {
        editId,
        dirty: st.dirty,
        removed: st.removed,
        mode: st.mode,
        active: st.active,
        defaultMode: p.defaultMode,
        inDirty: p.dirtyIds().indexOf(editId) >= 0,
        refEqual: p.refOf(editId) === state.nodes[editId], /* LO-5 A：引用（当前态），非克隆/字符串 */
        text: state.nodes[editId] ? state.nodes[editId].text : null,
      };
    });
    expect(r.text).toBe('v2');
    expect(r.active).toBe(true);          /* 桌面旁路 + 明文态 → 采集生效 */
    expect(r.mode).toBe('patch');         /* LO-9 B：默认增量 */
    expect(r.defaultMode).toBe('patch');
    expect(r.dirty).toBe(1);              /* 仅 editId 变动（快照型 patch 不含旁支） */
    expect(r.removed).toBe(0);
    expect(r.inDirty).toBe(true);
    expect(r.refEqual).toBe(true);
  });
});

/* ============================================================
   二、撤销/重做标脏（1 用例 · T-54 · I-2 / I-3）
   ============================================================ */
test.describe('L8-W1 §8.2 撤销/重做标脏', () => {
  test('T-54 undo/redo 同样标脏（落盘写当前态，与历史栈正交）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const docId = actions.createDoc('L8-T54');
      const id = actions.addNode(docId, 0, { text: 'v1' });
      const p = window.__juPersistProbe;
      const inSet = () => p.dirtyIds().concat(p.removedIds()).indexOf(id) >= 0;

      p.clearDirty();
      const histBefore = historyPast.length;
      commit(s => { s.nodes[id].text = 'v2'; }, { snapshot: true });
      const afterCommit = inSet();

      p.clearDirty();
      const okUndo = undo();
      const afterUndo = inSet();
      const textAfterUndo = state.nodes[id] ? state.nodes[id].text : null;

      p.clearDirty();
      const okRedo = redo();
      const afterRedo = inSet();
      const textAfterRedo = state.nodes[id] ? state.nodes[id].text : null;

      return { afterCommit, okUndo, afterUndo, textAfterUndo, okRedo, afterRedo, textAfterRedo,
               histBefore, histAfter: historyPast.length };
    });
    expect(r.afterCommit).toBe(true);
    expect(r.okUndo).toBe(true);
    expect(r.textAfterUndo).toBe('v1');
    expect(r.afterUndo).toBe(true);   /* I-2：undo 也标脏（落盘写「当前态」，非快照） */
    expect(r.okRedo).toBe(true);
    expect(r.textAfterRedo).toBe('v2');
    expect(r.afterRedo).toBe(true);   /* I-3：redo 同理 */
    expect(r.histAfter).toBeGreaterThanOrEqual(r.histBefore); /* 历史栈语义未被采集层改动 */
  });
});

/* ============================================================
   三、远端合并采集（1 用例 · T-55 · I-4 / #22 不变 / LO-1 A）
   ============================================================ */
test.describe('L8-W1 §8.3 远端合并采集（#22 保持不变）', () => {
  test('T-55 mergeRemoteState 后远端新节点入脏集（且不改变历史栈）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      actions.createDoc('L8-T55');
      const rootId = state.rootId;
      const remoteId = 'l8_remote_t55';
      const ts = Date.now() + 600000;                     /* 远端时间戳更新 → 触发结构变更 */
      const remote = JSON.parse(JSON.stringify(state));    /* 完整广播快照：避免删除传播干扰 */
      remote.nodes[remoteId] = {
        id: remoteId, text: 'remote', parent: rootId, children: [],
        collapsed: false, done: false, date: null, tags: [], priority: 0,
        recur: null, habit: null, createdAt: ts, updatedAt: ts, showInCal: true,
      };
      remote.nodes[rootId].children = (remote.nodes[rootId].children || []).concat([remoteId]);
      remote.nodes[rootId].updatedAt = ts;
      remote.updatedAt = ts;
      remote._rev = (state._rev | 0) + 5;

      const p = window.__juPersistProbe;
      const histBefore = historyPast.length;
      p.clearDirty();
      const changed = mergeRemoteState(remote);
      const st = p.stats();
      return {
        changed,
        nodeExists: !!state.nodes[remoteId],
        inDirty: p.dirtyIds().indexOf(remoteId) >= 0,
        refEqual: p.refOf(remoteId) === state.nodes[remoteId],
        removed: st.removed,
        histBefore,
        histAfter: historyPast.length,
        inMerge: !!window.__juInMerge,
      };
    });
    expect(r.changed).toBe(true);
    expect(r.nodeExists).toBe(true);        /* 合并确实落地（前置条件成立） */
    expect(r.inDirty).toBe(true);           /* I-4：merge 直接改写 state.nodes → 必须独立采集（#27） */
    expect(r.refEqual).toBe(true);
    expect(r.removed).toBe(0);
    expect(r.histAfter).toBe(r.histBefore); /* §八 T-55：合并仍不进历史栈（#22 / LO-1 A） */
    expect(r.inMerge).toBe(false);          /* finally 已复位 __juInMerge */
  });
});

/* ============================================================
   四、软删 / 硬删分流 + LO-3 子树全集（1 用例 · T-56 · D-5 / § 五 5.4）
   ============================================================ */
test.describe('L8-W1 §8.4 软删/硬删分流 + LO-3 子树全集', () => {
  test('T-56 软删进 dirty；硬删进 removed 且含 pre 态子树 id 全集', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const docId = actions.createDoc('L8-T56');
      const softId = actions.addNode(docId, 0, { text: 'soft' });
      const hardRoot = actions.addNode(docId, 1, { text: 'hard-root' });
      const hardChild = actions.addNode(hardRoot, 0, { text: 'hard-child' });
      const hardGrand = actions.addNode(hardChild, 0, { text: 'hard-grand' });
      const p = window.__juPersistProbe;

      /* ① 软删（_deleted:true）：节点仍在 state.nodes → D-5 进 dirty、不进 removed */
      p.clearDirty();
      commit(s => { s.nodes[softId]._deleted = true; }, { snapshot: true });
      const soft = {
        inDirty: p.dirtyIds().indexOf(softId) >= 0,
        inRemoved: p.removedIds().indexOf(softId) >= 0,
        dirty: p.stats().dirty,
      };

      /* ② 硬删（actions.removeNode 递归删除子树）：已从 state.nodes 移除 → D-2 进 removed */
      p.clearDirty();
      actions.removeNode(hardRoot);
      const rem = p.removedIds();
      const dty = p.dirtyIds();
      const hard = {
        rootGone: !state.nodes[hardRoot],
        rootRemoved: rem.indexOf(hardRoot) >= 0,
        childRemoved: rem.indexOf(hardChild) >= 0,
        grandRemoved: rem.indexOf(hardGrand) >= 0, /* LO-3 A：pre 态子树 id 全集补全（防孤儿行） */
        rootDirty: dty.indexOf(hardRoot) >= 0,
      };

      /* ③ LO-3 纯函数旁证：pre 态递归收集 + 环引用防护（不依赖当前 state） */
      const pre = { nodes: {
        a: { id: 'a', children: ['b', 'c'] },
        b: { id: 'b', children: ['c'] },
        c: { id: 'c', children: ['a'] },
      } };
      const ids = p.subtreeIdsFromPre(pre, ['a']).sort();

      return { soft, hard, ids };
    });
    /* 软删 → dirty */
    expect(r.soft.inDirty).toBe(true);
    expect(r.soft.inRemoved).toBe(false);
    expect(r.soft.dirty).toBeGreaterThanOrEqual(1);
    /* 硬删 → removed（含子树全集） */
    expect(r.hard.rootGone).toBe(true);
    expect(r.hard.rootRemoved).toBe(true);
    expect(r.hard.childRemoved).toBe(true);
    expect(r.hard.grandRemoved).toBe(true);
    expect(r.hard.rootDirty).toBe(false);     /* D-2 删除优先：终态已删 → 只记 removed */
    /* LO-3 纯函数 */
    expect(r.ids).toEqual(['a', 'b', 'c']);   /* 环引用不重复、不栈溢出 */
  });
});

/* ============================================================
   五、删除优先（1 用例 · T-57 · D-2 终态裁决）
   ============================================================ */
test.describe('L8-W1 §8.5 删除优先（终态裁决）', () => {
  test('T-57 同 id 先入 dirty 后硬删 → 仅保留于 removed（dirty 剔除）', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(() => {
      const docId = actions.createDoc('L8-T57');
      const id = actions.addNode(docId, 0, { text: 'x' });
      const p = window.__juPersistProbe;
      p.clearDirty();

      /* ① 节点尚在 state.nodes 中 → 入 dirty（D-1） */
      p.mark(new Set([id]));
      const step1 = { dirty: p.stats().dirty, removed: p.stats().removed,
                      inDirty: p.dirtyIds().indexOf(id) >= 0 };

      /* ② 终态已从 state.nodes 移除（硬删） → 删除优先：dirty 剔除、removed 收录（D-2） */
      delete state.nodes[id];
      p.mark(new Set([id]));
      const step2 = { dirty: p.stats().dirty, removed: p.stats().removed,
                      inDirty: p.dirtyIds().indexOf(id) >= 0,
                      inRemoved: p.removedIds().indexOf(id) >= 0 };

      return { step1, step2 };
    });
    expect(r.step1.dirty).toBe(1);
    expect(r.step1.removed).toBe(0);
    expect(r.step1.inDirty).toBe(true);
    expect(r.step2.dirty).toBe(0);        /* 批内 changed 不含该 id（W2 T-58 复核批形状） */
    expect(r.step2.removed).toBe(1);      /* 批内 deleted 含该 id */
    expect(r.step2.inDirty).toBe(false);
    expect(r.step2.inRemoved).toBe(true);
  });
});

/* ============================================================
   六、L8-W2 通道层（5 用例 · T-58 ~ T-62 · §六 6.1~6.4 / §八 8.6~8.10）

   红证阶段：真实 desktopInvoke 通道「patch_nodes」/ 组批 / ack / 轻量指纹守卫 / 探针 w2 字段
   均尚未在产品层实现（W1 为影子模式，只记账不发命令）→ 本 5 用例预期全红（5 failed）。
   一旦产品层落地 W2（E1 buildPersistBatch / E2 applyPatchAck / E3 桌面分支 patch_nodes /
   E4 指纹守卫 / E5 探针 w2），应转绿。

   接缝（设计 §八 8.1~8.2）：Playwright addInitScript 在页面脚本执行前注入 window.__TAURI__ 最小后端
   mock（与实际 Tauri/Electron 注入时机同构）→ detectDesktop() 判定 IS_DESKTOP=true → runPersist
   走桌面分支、desktopInvoke 命中 mock。mock 记录全部 invoke（命令名 + payload）供断言；mock 语义
   对齐 SQLite/WAL 契约：patch_nodes 单批事务缓冲（K-1）/ seq 幂等（K-2）/ save_state 整包重建（K-7）/
   load_state 装配（K-5）。
   ============================================================ */
async function installTauriMock(page, opts) {
  /* W3 mock 升级（全部 opt-in）：第二参数 {persist:true} 才启用
     「行集跨 reload 保留（模拟落盘）+ 真实 load_state 装配 + COMMIT 后崩溃注入」。
     省略第二参数 = W2 原行为（T-53 ~ T-62 逐字不变，见 RA 缓解）。 */
  await page.addInitScript((cfg) => {
    cfg = cfg || {};
    const KEY = '__juMockPersistRows';
    const norm = (v) => (typeof v === 'string' ? v : JSON.stringify(v));   /* 行值：patch 存 JSON 串 / save_state 存对象 → 统一口径 */
    const db = { rows: new Map(), meta: {}, ui: null, graphpos: null,
                 lastSeq: 0, lastRev: 0, calls: [], replays: 0, crashSeq: null,
                 bootId: 'd' + Math.random().toString(36).slice(2, 8), audit: [] };
    /* 跨文档调用审计（sessionStorage 持久化）：记录 reload 前后各 invoke 的（文档 id, 命令, seq），
       用于区分「本会话崩溃点盘面」与「关页/reload 期全量收口」——W3 崩溃用例的测量前提。 */
    if (cfg.persist) { try { db.audit = JSON.parse(sessionStorage.getItem('__juMockAudit') || '[]'); } catch (e) {} }
    const pushAudit = (entry) => {
      if (!cfg.persist) return;
      db.audit.push(entry);
      try { sessionStorage.setItem('__juMockAudit', JSON.stringify(db.audit)); } catch (e) {}
    };
    /* opt-in 恢复：上一次「会话」COMMIT 后写入 sessionStorage 的行集（= 模拟 SQLite 已落盘内容） */
    if (cfg.persist) {
      try {
        const raw = sessionStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw);
          db.rows = new Map((s.rows || []).map((e) => [e[0], e[1]]));
          db.meta = s.meta || {}; db.ui = s.ui || null; db.graphpos = s.graphpos || null;
          db.lastSeq = s.lastSeq || 0; db.lastRev = s.lastRev || 0;
        }
      } catch (e) {}
    }
    /* dumpRows：行集稳定序列化（id 排序 + 值归一）——测试断言与「落盘」共用同一口径 */
    const dumpRows = () => JSON.stringify(
      Array.from(db.rows.entries()).map((e) => [e[0], norm(e[1])])
        .sort((a, b) => (a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0)))
    );
    const persistRows = () => {
      if (!cfg.persist) return;
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ rows: JSON.parse(dumpRows()),
          meta: db.meta, ui: db.ui, graphpos: db.graphpos, lastSeq: db.lastSeq, lastRev: db.lastRev }));
      } catch (e) {}
    };
    window.__juMockDb = db;                    /* 测试读取 db.calls / db.rows / db.lastSeq / db.replays */
    window.__juMockDumpRows = dumpRows;        /* 与断言同口径的行集快照 */
    window.__juMockRestoredRows = cfg.persist ? dumpRows() : null; /* reload 时「磁盘」真实恢复的行集（先于应用任何后续写盘） */
    window.__juMockPatchFail = false;          /* 可切换：patch_nodes 抛错（失败降级红线） */
    window.__juMockCrashMidBatch = false;      /* W3 崩溃注入 A：COMMIT 前 throw（丢弃缓冲 → 批前态，= WAL 回滚） */
    window.__juMockCrashAfterCommit = false;   /* W3 崩溃注入 B（新增）：COMMIT 落盘后 throw（批已提交、ack 丢失 → T-64） */
    const invoke = async (cmd, args) => {
      db.calls.push({ cmd: cmd, args: args || {} });
      if (cmd === 'patch_nodes') {
        if (window.__juMockPatchFail) return Promise.reject(new Error('mock patch_nodes failure'));
        const a = args || {};
        if (typeof a.seq === 'number' && a.seq <= db.lastSeq) {
          /* K-2 幂等：同 seq 重复投递不重复生效，仍返回 ok:true */
          db.replays++;                                              /* W3：统计「同 seq 重放」次数（T-64 断言 0） */
          return { ok: true, applied: { changed: 0, deleted: 0 }, seq: a.seq, lastSeq: db.lastSeq };
        }
        const buf = new Map();                                            /* 事务缓冲（K-1） */
        for (const d of (a.changed || [])) buf.set(d.id, d.data);
        const del = [];
        for (const id of (a.deleted || [])) { buf.delete(id); del.push(id); }
        if (window.__juMockCrashMidBatch) throw new Error('mock crash mid batch'); /* 丢弃缓冲 → 批前态 */
        for (const [id, data] of buf) db.rows.set(id, data);              /* COMMIT */
        for (const id of del) db.rows.delete(id);
        db.lastSeq = (typeof a.seq === 'number') ? a.seq : (db.lastSeq + 1);
        db.lastRev = a.baseRev || 0;
        persistRows();                                                   /* 单批事务已提交 → 落「盘」 */
        if (window.__juMockCrashAfterCommit) {                           /* 批后崩溃：ack 丢失（T-64） */
          db.crashSeq = (typeof a.seq === 'number') ? a.seq : db.lastSeq;
          throw new Error('mock crash after commit (ack lost)');
        }
        return { ok: true, applied: { changed: buf.size, deleted: del.length },
                 seq: a.seq, rev: a.baseRev, lastSeq: db.lastSeq };
      }
      if (cmd === 'save_state') {
        /* K-7：全量整包重建 nodes 行 */
        try { const p = JSON.parse(args.payload); if (p && p.nodes) { db.rows = new Map(Object.entries(p.nodes)); db.meta = p.stateMeta || {}; db.ui = p.ui || null; db.graphpos = p.graphpos || null; } } catch (e) {}
        db.lastSeq++;
        persistRows();
        return { ok: true };
      }
      if (cmd === 'load_state') {
        /* K-5：默认（非 opt-in）空库 → hasData=false，boot 走 defaultState 分支（不干扰测试基线） */
        if (!cfg.persist) return { hasData: false, state: null };
        if (!db.rows.size) return { hasData: false, state: null };
        /* opt-in 且库非空：以真实行集装配 state（stateMeta 并入 state，与 desktopReloadIntoApp/ boot 消费口径一致） */
        const nodes = {};
        for (const [id, v] of db.rows) { try { nodes[id] = (typeof v === 'string') ? JSON.parse(v) : v; } catch (e) { nodes[id] = v; } }
        return { hasData: true, state: Object.assign({}, db.meta || {}, { nodes: nodes }),
                 ui: db.ui || {}, graphpos: db.graphpos || {} };
      }
      return { ok: true };
    };
    window.__TAURI__ = { core: { invoke } };
  }, { persist: !!(opts && opts.persist) });
}

/* bootWithMock：注入 mock → bootApp（探针三连）→ 等待 boot 期防抖落盘结算，隔离测量窗口
   opts 省略 = W2 原行为（persist:false）；{persist:true} 供 W3 崩溃/relaod 用例 */
async function bootWithMock(page, opts) {
  await installTauriMock(page, opts);
  await bootApp(page);
  await page.waitForTimeout(500);
}

test.describe('L8-W2 §8.6 真实通道批形状', () => {
  test('T-58 desktopInvoke(patch_nodes,{changed,deleted,seq,baseRev}) 批形状（§六 6.1/6.4）', async ({ page }) => {
    await bootWithMock(page);
    const r = await page.evaluate(async () => {
      const p = window.__juPersistProbe;
      const docId = actions.createDoc('L8-T58');
      const id = actions.addNode(docId, 0, { text: 'v1' });
      await new Promise(res => setTimeout(res, 450));           /* 建立落盘基线 */
      p.clearDirty();
      const before = window.__juMockDb.calls.length;
      commit(s => { s.nodes[id].text = 'v2'; }, { snapshot: true });
      await new Promise(res => setTimeout(res, 450));           /* 300ms 防抖 → runPersist → patch_nodes */
      const sent = window.__juMockDb.calls.slice(before).filter(c => c.cmd === 'patch_nodes');
      return {
        id,
        sentCount: sent.length,
        args: sent.length ? sent[0].args : null,
        memNode: state.nodes[id] ? JSON.parse(JSON.stringify(state.nodes[id])) : null,
        probeSent: p.sent ? p.sent.length : null,
        lastPatch: p.lastPatch || null,
      };
    });
    expect(r.sentCount).toBeGreaterThan(0);                    /* 红：W1 影子模式 → 无 invoke */
    expect(r.args).toBeTruthy();
    expect(Array.isArray(r.args.changed)).toBe(true);
    expect(Array.isArray(r.args.deleted)).toBe(true);
    expect(typeof r.args.seq).toBe('number');
    expect(typeof r.args.baseRev).toBe('number');
    expect(r.args.changed.length).toBeGreaterThan(0);
    expect(typeof r.args.changed[0].id).toBe('string');
    expect(typeof r.args.changed[0].data).toBe('string');      /* data = 单节点 JSON 字符串 */
    expect(JSON.parse(r.args.changed[0].data)).toEqual(r.memNode); /* 反序列化 == 内存节点（D-3） */
    expect(r.probeSent).toBeGreaterThan(0);                    /* 探针 sent 被通道层填充 */
    expect(r.lastPatch).toBeTruthy();
  });
});

test.describe('L8-W2 §8.7 组批上限 + 超限退全量', () => {
  test('T-59 单批 ≤ L8_MAX_PER_BATCH(500)；脏集 > L8_PATCH_MAX(2000) → over-threshold 退全量（D-6）', async ({ page }) => {
    await bootWithMock(page);
    /* ① 1200 脏：每批 changed ≤ 500（组批上限） */
    const cap = await page.evaluate(async () => {
      const p = window.__juPersistProbe;
      const fake = { nodes: {} };
      const ids = [];
      for (let i = 0; i < 1200; i++) { const id = 'l8cap_' + i; fake.nodes[id] = { id, text: 't' + i, children: [] }; ids.push(id); }
      p.clearDirty();
      p.mark(new Set(ids), fake);
      const before = window.__juMockDb.calls.length;
      await runPersist();
      const patched = window.__juMockDb.calls.slice(before).filter(c => c.cmd === 'patch_nodes');
      return { dirty: p.stats().dirty, counts: patched.map(c => (c.args.changed || []).length) };
    });
    expect(cap.counts.length).toBeGreaterThan(0);              /* 红：当前无 patch_nodes */
    for (const n of cap.counts) expect(n).toBeLessThanOrEqual(500);

    /* ② 2001 脏：超阈值 → 走全量 save_state，且不发 patch_nodes */
    const over = await page.evaluate(async () => {
      const p = window.__juPersistProbe;
      const fake = { nodes: {} };
      const ids = [];
      for (let i = 0; i < 2001; i++) { const id = 'l8ov_' + i; fake.nodes[id] = { id, text: 'x', children: [] }; ids.push(id); }
      p.clearDirty();
      p.mark(new Set(ids), fake);
      const before = window.__juMockDb.calls.length;
      await runPersist();
      const tail = window.__juMockDb.calls.slice(before);
      return { patch: tail.filter(c => c.cmd === 'patch_nodes').length,
               save: tail.filter(c => c.cmd === 'save_state').length,
               sinceFull: p.stats().sinceFull };
    });
    expect(over.patch).toBe(0);                                /* 超限 → 不发批 */
    expect(over.save).toBeGreaterThan(0);                      /* 超限 → 全量 checkpoint */
  });
});

test.describe('L8-W2 §8.8 ack 回执（清脏 + 基线维护）', () => {
  test('T-60 ack 后：引用比对清脏 / _removedNodes.delete / _diskConfirmed / _rev++ / _persistBatchSeq++ / _lastPersistFingerprint（§六 6.2）', async ({ page }) => {
    await bootWithMock(page);
    const r = await page.evaluate(async () => {
      const p = window.__juPersistProbe;
      const docId = actions.createDoc('L8-T60');
      const upId = actions.addNode(docId, 0, { text: 'v1' });
      const delId = actions.addNode(docId, 1, { text: 'del' });
      await new Promise(res => setTimeout(res, 450));           /* 基线结算 */
      p.clearDirty();
      const before = window.__juMockDb.calls.length;
      const revBefore = state._rev | 0;
      const seqBefore = _persistBatchSeq;
      commit(s => { s.nodes[upId].text = 'v2'; }, { snapshot: true });  /* 更新 → dirty */
      actions.removeNode(delId);                                /* 硬删 → removed */
      await new Promise(res => setTimeout(res, 450));           /* ack 结算 */
      const tail = window.__juMockDb.calls.slice(before);
      return {
        upId, delId, revBefore, seqBefore,
        patchCount: tail.filter(c => c.cmd === 'patch_nodes').length,
        dirty: p.stats().dirty, removed: p.stats().removed,
        revAfter: state._rev | 0,
        seqAfter: _persistBatchSeq,
        fp: _lastPersistFingerprint,
        diskHasUp: (function () { try { return !!_diskConfirmed && _diskConfirmed.has(upId); } catch (e) { return null; } })(),
        removedHasDel: (function () { try { return _removedNodes.has(delId); } catch (e) { return null; } })(),
      };
    });
    expect(r.patchCount).toBeGreaterThan(0);                   /* 红：a ck 通道未实现 */
    expect(r.dirty).toBe(0);                                   /* 引用比对清脏 */
    expect(r.removed).toBe(0);                                 /* _removedNodes.delete */
    expect(r.diskHasUp).toBe(true);                            /* _diskConfirmed.add(id) */
    expect(r.removedHasDel).toBe(false);                       /* 删除 id 已从脏集移除 */
    expect(r.revAfter).toBeGreaterThan(r.revBefore);           /* _rev++ */
    expect(r.seqAfter).toBeGreaterThan(r.seqBefore);           /* _persistBatchSeq++ */
    expect(r.fp).toBeTruthy();                                 /* _lastPersistFingerprint 已写 */
  });
});

test.describe('L8-W2 §8.9 轻量指纹守卫 + 探针 w2 + 失败缓冲', () => {
  test('T-61 无变更跳过 invoke（D-8）；探针 w2 字段；__juPersistFailures 上限 L8_FAIL_CAP(50)', async ({ page }) => {
    await bootWithMock(page);
    const r = await page.evaluate(async () => {
      const p = window.__juPersistProbe;
      const docId = actions.createDoc('L8-T61');
      const id = actions.addNode(docId, 0, { text: 'v1' });
      await new Promise(res => setTimeout(res, 450));
      /* 第 1 轮：有变更 → 应发一批 */
      p.clearDirty();
      commit(s => { s.nodes[id].text = 'v2'; }, { snapshot: true });
      await new Promise(res => setTimeout(res, 450));
      const n1 = window.__juMockDb.calls.filter(c => c.cmd === 'patch_nodes').length;
      const rev1 = state._rev | 0;
      /* 第 2 轮：无变更 → 指纹命中，跳过 invoke、不递增 rev */
      await runPersist();
      const n2 = window.__juMockDb.calls.filter(c => c.cmd === 'patch_nodes').length;
      const rev2 = state._rev | 0;
      /* 失败注入：patch 抛错 → 缓冲留痕（+ 降级 full） */
      window.__juMockPatchFail = true;
      p.clearDirty();
      commit(s => { s.nodes[id].text = 'v3'; }, { snapshot: true });
      await new Promise(res => setTimeout(res, 450));
      window.__juMockPatchFail = false;
      const fails = window.__juPersistFailures || [];
      const w2 = p.w2 || (p.stats() && p.stats().w2) || null;
      return { n1, n2, rev1, rev2,
               failCount: fails.length,
               failArray: Array.isArray(window.__juPersistFailures),
               errAlias: p.errors === window.__juPersistFailures,
               w2: w2 };
    });
    expect(r.n1).toBeGreaterThan(0);                           /* 红：无 patch 通道 */
    expect(r.n2).toBe(r.n1);                                   /* 守卫：无变更不再发批 */
    expect(r.rev2).toBe(r.rev1);                               /* 守卫：无变更不递增 rev */
    expect(r.w2).toBeTruthy();                                 /* 红：探针 w2 字段未实现 */
    expect(r.w2 && r.w2.maxPerBatch).toBe(500);
    expect(r.w2 && r.w2.failCap).toBe(50);
    expect(r.failArray).toBe(true);
    expect(r.errAlias).toBe(true);
    expect(r.failCount).toBeGreaterThanOrEqual(1);             /* 红：当前无失败记录 */
  });
});

test.describe("L8-W2 §8.10 mode='full' 双重守卫反向护栏", () => {
  test("T-62 mode='full' 阻断 patch 通道（退全量）；切回 'patch' 才发批（不手动跳闸，仅经公开 setMode）", async ({ page }) => {
    await bootWithMock(page);
    const r = await page.evaluate(async () => {
      const p = window.__juPersistProbe;
      const docId = actions.createDoc('L8-T62');
      const id = actions.addNode(docId, 0, { text: 'v1' });
      await new Promise(res => setTimeout(res, 450));
      /* 反向护栏：full 模式必须阻断通道，仍走全量 save_state */
      p.setMode('full'); p.clearDirty();
      const b1 = window.__juMockDb.calls.length;
      commit(s => { s.nodes[id].text = 'v2'; }, { snapshot: true });
      await new Promise(res => setTimeout(res, 450));
      const tail1 = window.__juMockDb.calls.slice(b1);
      const fullPatch = tail1.filter(c => c.cmd === 'patch_nodes').length;
      const fullSave = tail1.filter(c => c.cmd === 'save_state').length;
      /* 正向：切回 patch 模式 → 通道开启 */
      p.setMode('patch'); p.clearDirty();
      const b2 = window.__juMockDb.calls.length;
      commit(s => { s.nodes[id].text = 'v3'; }, { snapshot: true });
      await new Promise(res => setTimeout(res, 450));
      const tail2 = window.__juMockDb.calls.slice(b2);
      const patchPatch = tail2.filter(c => c.cmd === 'patch_nodes').length;
      return { fullPatch, fullSave, patchPatch };
    });
    expect(r.fullPatch).toBe(0);                               /* 守卫成立：full 不发批 */
    expect(r.fullSave).toBeGreaterThan(0);                     /* full → 全量 save_state */
    expect(r.patchPatch).toBeGreaterThan(0);                   /* 红：patch 通道未实现 */
  });
});

/* ============================================================
   七、L8-W3 崩溃原子性 + checkpoint 混合（3 用例 · T-63 ~ T-65 · §六 / §八 8.11~8.13 / D-10）

   红证阶段：checkpoint 收敛（requestFullCheckpoint / _l8CheckpointEvery / sinceFull 归零）与
   探针 W3 自描述（requestCheckpoint / checkpointPending / setCheckpointEvery）尚未在产品层实现
   （W2 已落通道层 + markFullOnce 安全网）→ T-65 预期红；T-63/T-64 属 #28 验收（崩溃原子性），
   依赖 mock 的 opt-in「行集跨 reload 保留」而非新增产品代码。

   接缝：installTauriMock(page,{persist:true}) 打开 opt-in——
     ① COMMIT（patch_nodes 批提交 / save_state 全量）后把行集写入 sessionStorage（模拟 SQLite 落盘）；
     ② addInitScript 优先恢复该行集 → reload 后行集真实可读（K-5 装配）；
     ③ __juMockCrashMidBatch（COMMIT 前 throw，批前态）/ __juMockCrashAfterCommit（COMMIT 后 throw，ack 丢失）；
     ④ db.replays 统计 K-2 幂等「同 seq 重放」命中次数（T-64 断言 0）。
   实测（W3 红证）：page.reload() 会触发应用关页收口（beforeunload → flushPersistNow → 桌面全量
   save_state），故 reload 后的盘面是「全量快照」而非原始 WAL。因此：
     - 崩溃原子性（无半批 / 批后持久）在**崩溃点**断言（mid.diskRowsNow / crash.diskTexts）；
     - reload 后只断言「无撕裂批 / 命中已提交终态 / 无同 seq 重放」（对关页全量收口同样成立）。
   __juMockRestoredRows 为 initScript 期捕获的 reload 瞬间盘面（先于 boot 期写盘）。
   ============================================================ */

test.describe('L8-W3 §8.11 崩溃恢复 · 半批（COMMIT 前崩溃 → 批前态）', () => {
  test('T-63 批中途崩溃 → 崩时盘面逐字节 == 批前（无半批）；reload 后无撕裂批（#28 / K-1 / K-5）', async ({ page }) => {
    await bootWithMock(page, { persist: true });
    /* ① 基线：同一批内改动 2 个节点（撕裂批才有可观测形态：一个更新、一个未更新） */
    const pre = await page.evaluate(async () => {
      const docId = actions.createDoc('L8-T63');
      const n1 = actions.addNode(docId, 0, { text: 'v1' });
      const n2 = actions.addNode(docId, 1, { text: 'v1' });
      window.__t63n1 = n1;
      await new Promise((res) => setTimeout(res, 450));
      window.__juPersistProbe.clearDirty();
      return { n1: n1, n2: n2, preRows: window.__juMockDumpRows(), rowCount: window.__juMockDb.rows.size,
               bootId: window.__juMockDb.bootId };
    });
    expect(pre.rowCount).toBeGreaterThan(0);                    /* 基线确有行（否则断言空转） */
    /* ② 注入「批中途崩溃」：patch_nodes 在 COMMIT 前 throw（整批事务缓冲丢弃 = WAL 回滚） */
    const mid = await page.evaluate(async (ids) => {
      window.__juMockCrashMidBatch = true;
      commit((s) => { s.nodes[ids.n1].text = 'v2'; s.nodes[ids.n2].text = 'v2'; }, { snapshot: true });
      await new Promise((res) => setTimeout(res, 450));
      window.__juMockCrashMidBatch = false;
      const st = window.__juPersistProbe.stats();
      return {
        mode: st.mode, dirty: st.dirty,
        fails: (window.__juPersistFailures || []).length,
        crashSeq: window.__juMockDb.crashSeq,                    /* 半批未 COMMIT → 仍应为 null */
        diskRowsNow: window.__juMockDumpRows(),                  /* 崩溃点盘面：必须仍是批前 */
        memTexts: [state.nodes[ids.n1].text, state.nodes[ids.n2].text],
      };
    }, { n1: pre.n1, n2: pre.n2 });
    /* ③ reload：mock 从 sessionStorage 恢复盘面（关页收口见文件头注） */
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__juMockDb && !!window.__juPersistProbe, { timeout: 10_000 });
    const after = await page.evaluate((ids) => {
      const d = window.__juMockDb;
      const text = (id) => {
        const v = d.rows.get(id);
        if (v === undefined) return null;
        try { const n = (typeof v === 'string') ? JSON.parse(v) : v; return n ? n.text : null; } catch (e) { return null; }
      };
      return {
        restored: window.__juMockRestoredRows,
        updated: [text(ids.n1), text(ids.n2)].filter((t) => t === 'v2').length,
        orphan: Array.from(d.rows.keys()).filter((id) => !state.nodes[id]),
        missing: Object.keys(state.nodes).filter((id) => !d.rows.has(id)),
        replays: d.replays,
        audit: d.audit,
      };
    }, { n1: pre.n1, n2: pre.n2 });
    expect(mid.memTexts).toEqual(['v2', 'v2']);                 /* 内存态整批已改（崩溃点只在落盘） */
    expect(mid.crashSeq).toBe(null);                            /* 无 COMMIT → 半批不成立 */
    expect(mid.diskRowsNow).toBe(pre.preRows);                  /* #28/K-1：崩溃点盘面逐字节 == 批前（无半批） */
    expect([0, 2]).toContain(after.updated);                    /* #28：reload 后不得出现撕裂批（1 个更新 / 1 个未更新） */
    expect(after.orphan).toEqual([]);                           /* 无孤儿行 */
    expect(after.missing).toEqual([]);                          /* 无缺行（盘面=完整状态） */
    expect(after.replays).toBe(0);                              /* K-2：未发生同 seq 重放 */
    expect(mid.fails).toBeGreaterThanOrEqual(1);                /* K-5：失败留痕（不静默） */
    expect(mid.mode).toBe('full');                              /* 前端降级安全网（markFullOnce） */
    expect(mid.dirty).toBeGreaterThan(0);                       /* 脏集保留 → 下轮全量收口 */
  });
});

test.describe('L8-W3 §8.12 崩溃恢复 · 提交后未 ack（COMMIT 已落盘 → 批后态 + 不重放）', () => {
  test('T-64 批已 COMMIT 但 ack 丢失 → 崩时盘面 == 批后（已提交不丢）；reload 后无同 seq 重放（#28 / K-1 / K-2）', async ({ page }) => {
    await bootWithMock(page, { persist: true });
    const pre = await page.evaluate(async () => {
      const docId = actions.createDoc('L8-T64');
      const n1 = actions.addNode(docId, 0, { text: 'v1' });
      const n2 = actions.addNode(docId, 1, { text: 'v1' });
      await new Promise((res) => setTimeout(res, 450));
      window.__juPersistProbe.clearDirty();
      return { n1: n1, n2: n2, seqBefore: window.__juMockDb.lastSeq };
    });
    /* ① 注入「COMMIT 后崩溃」：整批已提交落盘，ack 未回 → 前端视为失败（脏集保留 + 退全量） */
    const crash = await page.evaluate(async (ids) => {
      const d = window.__juMockDb;
      const text = (id) => {
        const v = d.rows.get(id);
        if (v === undefined) return null;
        try { const n = (typeof v === 'string') ? JSON.parse(v) : v; return n ? n.text : null; } catch (e) { return null; }
      };
      window.__juMockCrashAfterCommit = true;
      commit((s) => { s.nodes[ids.n1].text = 'v2'; s.nodes[ids.n2].text = 'v2'; }, { snapshot: true });
      await new Promise((res) => setTimeout(res, 450));
      window.__juMockCrashAfterCommit = false;
      return {
        crashSeq: d.crashSeq,
        diskTexts: [text(ids.n1), text(ids.n2)],                 /* 崩溃点盘面：整批已提交（批后态） */
        lastSeq: d.lastSeq,
        fails: (window.__juPersistFailures || []).length,
        dirty: window.__juPersistProbe.stats().dirty,
        replays: d.replays,
      };
    }, { n1: pre.n1, n2: pre.n2 });
    expect(crash.diskTexts).toEqual(['v2', 'v2']);               /* #28/K-1：单批事务已整体提交（无半批） */
    expect(crash.crashSeq).toBeGreaterThan(pre.seqBefore);       /* 该批确实 COMMIT（seq 推进） */
    expect(crash.lastSeq).toBe(crash.crashSeq);                  /* 崩溃点之后无新命令混入 */
    expect(crash.fails).toBeGreaterThanOrEqual(1);               /* ack 丢失 → 前端留痕 */
    expect(crash.dirty).toBeGreaterThan(0);                      /* 前端未知已落盘 → 脏集保留（宁重不漏） */
    /* ② reload：已提交批次不得回退（不能丢数据），且不得重放同 seq 批 */
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__juMockDb && !!window.__juPersistProbe, { timeout: 10_000 });
    const after = await page.evaluate((ids) => {
      const d = window.__juMockDb;
      const text = (id) => {
        const v = d.rows.get(id);
        if (v === undefined) return null;
        try { const n = (typeof v === 'string') ? JSON.parse(v) : v; return n ? n.text : null; } catch (e) { return null; }
      };
      return {
        text1: text(ids.n1), text2: text(ids.n2),
        orphan: Array.from(d.rows.keys()).filter((id) => !state.nodes[id]),
        missing: Object.keys(state.nodes).filter((id) => !d.rows.has(id)),
        replays: d.replays,
        audit: d.audit,
      };
    }, { n1: pre.n1, n2: pre.n2 });
    expect([after.text1, after.text2]).toEqual(['v2', 'v2']);    /* #28：跨 reload 已提交批次不丢失/不回退 */
    expect(after.orphan).toEqual([]);
    expect(after.missing).toEqual([]);
    /* K-2：审计（跨文档）中不得出现与该批同 seq 的 patch_nodes 重放 */
    const replayed = after.audit.filter((e) => e.cmd === 'patch_nodes' && e.seq === crash.crashSeq);
    expect(replayed).toEqual([]);
    expect(after.replays).toBe(0);                               /* 幂等分支从未被依赖 */
  });
});

test.describe('L8-W3 §8.13 checkpoint 与 patch 混合（含 OP-3 / #17 回归子断言，编号不新增）', () => {
  test('T-65 N 批 patch + 1 次全量 checkpoint + M 批 patch：投影逐 id 等价 / sinceFull 归零 / 无孤儿行 / pending=false（#27 / K-7 / D-10）', async ({ page }) => {
    await bootWithMock(page, { persist: true });
    const r = await page.evaluate(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const p = window.__juPersistProbe;
      const diskHas = (id) => { try { return _diskConfirmed.has(id); } catch (e) { return null; } };
      const tombHas = (id) => { try { return _recentlyRemoved.has(id); } catch (e) { return null; } };

      const docId = actions.createDoc('L8-T65');
      const baseId = actions.addNode(docId, 0, { text: 'b0' });
      await wait(450);

      /* 阈值按「当前批数」相对设置：基线期用大阈值屏蔽误触发，再精确到 +3 批（确定性，无 wall-clock 断言） */
      p.setCheckpointEvery(1000);
      await p.clearDirty();
      const base = p.stats().sinceFull;
      p.setCheckpointEvery(base + 3);
      const c0 = window.__juMockDb.calls.length;

      /* ① N 批 patch（3 次间隔提交 → 3 次 ack）→ 第 3 次 ack 达阈值 → 一次性 pending（不 latch full） */
      for (let i = 1; i <= 3; i++) { commit((s) => { s.nodes[baseId].text = 'b' + i; }, { snapshot: true }); await wait(450); }
      const preFull = { sinceFull: p.stats().sinceFull, pending: p.checkpointPending(), mode: p.stats().mode };

      /* ② 下一次提交驱动全量 checkpoint（E-f 跳过 patch 通道 → E-g 放行早退 → 全量 save_state → E-h 复位） */
      commit((s) => { s.nodes[baseId].text = 'b4'; }, { snapshot: true });
      await wait(450);
      const postFull = {
        sinceFull: p.stats().sinceFull, pending: p.checkpointPending(), mode: p.stats().mode,
        saveState: window.__juMockDb.calls.slice(c0).filter((c) => c.cmd === 'save_state').length,
      };

      /* ③ M 批 patch：一次性语义 → 增量必须恢复（未 latch 'full'，T-62 反向护栏不变） */
      for (let i = 5; i <= 6; i++) { commit((s) => { s.nodes[baseId].text = 'b' + i; }, { snapshot: true }); await wait(450); }
      const postMore = {
        sinceFull: p.stats().sinceFull, mode: p.stats().mode,
        patchCalls: window.__juMockDb.calls.slice(c0).filter((c) => c.cmd === 'patch_nodes').length,
      };

      /* ④ #27 投影等价：逐 id JSON 等价 + 无孤儿行 + 无缺行 */
      const rows = window.__juMockDb.rows;
      const mism = []; const orphan = [];
      for (const [id, v] of rows) {
        const s = (typeof v === 'string') ? v : JSON.stringify(v);
        if (!state.nodes[id]) orphan.push(id);
        else if (s !== JSON.stringify(state.nodes[id])) mism.push(id);
      }
      const missing = Object.keys(state.nodes).filter((id) => !rows.has(id));
      const finalDirty = p.stats().dirty;
      const finalPending = p.checkpointPending();

      /* ⑤ OP-3 / #17 回归子断言（并入本用例，不新增编号）：
            新增 ack → _diskConfirmed.add；删除 ack → _diskConfirmed.delete；陈旧远端快照不得复活已删节点 */
      const upId = actions.addNode(docId, 1, { text: 'op-up' });
      await wait(450);
      const diskHasUp = diskHas(upId);
      const delId = actions.addNode(docId, 2, { text: 'op-del' });
      await wait(450);
      const diskHasDelBefore = diskHas(delId);
      p.clearDirty();
      actions.removeNode(delId);
      await wait(450);
      const diskHasDelAfter = diskHas(delId);
      const tomb = tombHas(delId);
      const staleTs = Date.now() - 60_000;                        /* 陈旧：早于删除时刻 */
      const remote = JSON.parse(JSON.stringify(state));
      remote.nodes[delId] = { id: delId, text: 'op-del', parent: docId, children: [], collapsed: false, done: false,
        date: null, tags: [], priority: 0, recur: null, habit: null, createdAt: staleTs, updatedAt: staleTs, showInCal: true };
      remote.nodes[docId].children = (remote.nodes[docId].children || []).concat([delId]);
      remote.updatedAt = Date.now(); remote._rev = (state._rev | 0) + 5;
      delete remote._tombstones;
      mergeRemoteState(remote);
      const revived = !!state.nodes[delId];

      /* ⑥ 探针 W3 自描述 + boot 期桌面判定实测（D-6）；
            I-3：mock 经 addInitScript 注入 __TAURI__ → detectDesktop() 为真 → boot 期 IS_DESKTOP 实为 true */
      const statsNow = p.stats();
      return { base, preFull, postFull, postMore, mism, orphan, missing, finalDirty, finalPending,
               diskHasUp, diskHasDelBefore, diskHasDelAfter, tomb, revived,
               w3: p.w3 || null, statsEvery: statsNow.checkpointEvery, statsHasPending: ('pending' in statsNow),
               isDesktop: IS_DESKTOP === true, forced: statsNow.forced,
               bootLoadState: window.__juMockDb.calls.some((c) => c.cmd === 'load_state'),
               errAlias: p.errors === window.__juPersistFailures };
    });

    /* ① 阈值触发一次性 pending */
    expect(r.preFull.sinceFull).toBeGreaterThanOrEqual(3);
    expect(r.preFull.pending).toBe(true);                       /* 红：W2 无 checkpoint 收敛（探针缺方法） */
    /* ② 全量 checkpoint 落盘 + 收敛计数归零 + 请求清除（E-e / E-f / E-g / E-h） */
    expect(r.postFull.saveState).toBeGreaterThan(0);
    expect(r.postFull.sinceFull).toBe(0);
    expect(r.postFull.pending).toBe(false);
    /* ③ 一次性语义：增量随后恢复（未 latch 'full'） */
    expect(r.postMore.mode).toBe('patch');
    expect(r.postMore.patchCalls).toBeGreaterThan(0);
    expect(r.postMore.sinceFull).toBe(2);
    /* ④ #27 增量投影等价（第 2/4 条）+ 无孤儿行 */
    expect(r.mism).toEqual([]);
    expect(r.orphan).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.finalDirty).toBe(0);
    expect(r.finalPending).toBe(false);
    /* ⑤ OP-3 / #17 */
    expect(r.diskHasUp).toBe(true);                             /* 新增 ack → _diskConfirmed.add(id) */
    expect(r.diskHasDelBefore).toBe(true);                      /* 删除前该 id 已上盘确认 */
    expect(r.diskHasDelAfter).toBe(false);                      /* 删除 ack → _diskConfirmed.delete(id) */
    expect(r.tomb).toBe(true);                                  /* 硬删留墓碑（防复活基线） */
    expect(r.revived).toBe(false);                              /* 陈旧远端快照不得复活已删节点（#17） */
    /* ⑥ D-6 探针 W3 自描述 + step-6 实测（不改动任何产品行为） */
    expect(r.w3 && r.w3.checkpointEvery).toBe(200);             /* 自描述恒为默认常量（不受测试钩子影响，D-6） */
    expect(r.w3 && r.w3.fullCheckpointOneShot).toBe(true);
    expect(r.statsHasPending).toBe(true);                       /* stats() 含 pending / checkpointEvery */
    expect(r.statsEvery).toBe(r.base + 3);                      /* 探针 setCheckpointEvery 生效（E-a / E-c） */
    expect(r.errAlias).toBe(true);                              /* probe.errors 与 __juPersistFailures 恒同引用（D-6） */
    expect(r.isDesktop).toBe(true);                             /* 实测：mock 注入后 boot 期 IS_DESKTOP===true（spec 头注「file:// → false」仅对无 mock 的 bootApp 成立） */
    expect(r.bootLoadState).toBe(true);                         /* 反证：boot 命中 dsLoadState（仅 IS_DESKTOP 分支可达） */
    expect(r.forced).toBe(true);                                /* bootApp 仍置 forceDesktop(true)（对 W1/W2 用例必需；此处冗余无害） */
  });
});

/* ============================================================
   §8.14 路径隔离 · 浏览器（非桌面） (T-66 · L8-W4)
   依据：l8-design-2026-10-14.md §七 7.3 / §八 8.4 T-66；不变量 #27 第 5 条。
   断言：非桌面（IS_DESKTOP===false 且 forceDesktop(false)）→
     ① 不发批（probe.sent 增量 === 0）；② 不采集（markPersistDirty 早退，dirty/removed 恒 0）；
     ③ localStorage[STORE_KEY] 全量更新且与内存 state 语义等价（既有 L3 用例全绿为行为等价证据，R 层）。
   注：bootApp 默认 forceDesktop(true)（file:// 下采集旁路）；本用例显式置回 false = 真实非桌面态。
   ============================================================ */
test.describe('L8-W4 §8.14 路径隔离 · 浏览器（非桌面）', () => {
  test('T-66 非桌面：sent===0 且不采集；localStorage[STORE_KEY] 全量更新（§七 7.3）', async ({ page }) => {
    await bootApp(page);                    /* 无 __TAURI__ mock → IS_DESKTOP===false */
    const r = await page.evaluate(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const p = window.__juPersistProbe;
      p.forceDesktop(false);                /* 关掉探针旁路 → 真实非桌面态（不采集） */
      p.setMode('patch');
      p.clearDirty();
      const docId = actions.createDoc('L8-T66');
      const id = actions.addNode(docId, 0, { text: 'v1' });
      await wait(450);                      /* 建立落盘基线 */
      p.clearDirty();
      const sentBefore = p.sent.length;
      commit((s) => { s.nodes[id].text = 'v2'; }, { snapshot: true });
      await wait(450);                      /* 300ms 防抖 → runPersist（非桌面全量分支） */
      const stored = localStorage.getItem(STORE_KEY);
      let storedText = null;
      try { const obj = stored ? JSON.parse(stored) : null; storedText = obj && obj.nodes && obj.nodes[id] ? obj.nodes[id].text : null; } catch (e) {}
      return {
        hasMock: !!window.__juMockDb,
        isDesktop: IS_DESKTOP === true,
        forced: p.stats().forced,
        active: p.stats().active,
        sent: p.sent.length - sentBefore,
        dirty: p.stats().dirty,
        removed: p.stats().removed,
        storedNonEmpty: !!stored,
        storedText: storedText,
        memText: state.nodes[id] ? state.nodes[id].text : null,
      };
    });
    expect(r.hasMock).toBe(false);          /* 无 mock → 无真实桌面通道可见 */
    expect(r.isDesktop).toBe(false);        /* file:// 非桌面 */
    expect(r.forced).toBe(false);           /* 探针旁路已关 */
    expect(r.active).toBe(false);           /* 非桌面 → l8PersistActive()===false */
    expect(r.sent).toBe(0);                 /* #27-5：非桌面不得发批 */
    expect(r.dirty).toBe(0);                /* 非桌面不采集（markPersistDirty 早退） */
    expect(r.removed).toBe(0);
    expect(r.storedNonEmpty).toBe(true);    /* 走 localStorage 全量落盘（§七 7.3） */
    expect(r.storedText).toBe('v2');        /* 盘面与内存语义等价 */
    expect(r.memText).toBe('v2');
  });
});

/* ============================================================
   §8.15 路径隔离 · 加密 (T-67 · L8-W4)
   依据：l8-design-2026-10-14.md §七 7.2 / §八 8.4 T-67；不变量 #27 第 5 条。
   断言：加密态（ui.encrypted && ui.encKey）→
     ① 即便桌面判定为真（mock 注入 IS_DESKTOP=true）也绝不发 patch_nodes（sent===0）；
     ② 走现有全量 writeEncryptedStore 分支（命中 ≥1，stub 计数，避免真 WebCrypto）；
     ③ 不采集脏集（l8PersistActive()===false，R3 早退）；
     ④ PENDING_* 兜底链路符号仍在（PENDING_PLAIN_KEY / PENDING_SYNC_KEY）。
   接缝：stub encryptState/writeEncryptedStore（仅计数 + 直接成功），用例末原样恢复（隔离）。
   ============================================================ */
test.describe('L8-W4 §8.15 路径隔离 · 加密', () => {
  test('T-67 加密态：桌面亦不发批；writeEncryptedStore 命中；不采集（§七 7.2）', async ({ page }) => {
    await bootWithMock(page);               /* IS_DESKTOP===true（有 mock）*/
    const r = await page.evaluate(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const p = window.__juPersistProbe;
      const origEnc = window.encryptState, origWrite = window.writeEncryptedStore;
      let encHits = 0;
      window.encryptState = async function () { return { stub: true }; };     /* 计数用：跳过真加密 */
      window.writeEncryptedStore = async function () { encHits++; return true; };
      const prevEnc = ui.encrypted, prevKey = ui.encKey;
      ui.encrypted = true; ui.encKey = 'l8-t67-key';                          /* 加密态（§七 7.2 判定式）*/
      const docId = actions.createDoc('L8-T67');
      const id = actions.addNode(docId, 0, { text: 'v1' });
      await wait(450);
      p.clearDirty();
      const patchBefore = window.__juMockDb.calls.filter((c) => c.cmd === 'patch_nodes').length;
      const sentBefore = p.sent.length;
      commit((s) => { s.nodes[id].text = 'v2'; }, { snapshot: true });
      await wait(450);                       /* 300ms 防抖 → runPersist（加密全量分支） */
      const out = {
        isDesktop: IS_DESKTOP === true,
        active: p.stats().active,
        dirty: p.stats().dirty,
        removed: p.stats().removed,
        sent: p.sent.length - sentBefore,
        patchDelta: window.__juMockDb.calls.filter((c) => c.cmd === 'patch_nodes').length - patchBefore,
        encHits: encHits,
        pendPlain: typeof PENDING_PLAIN_KEY === 'string' && PENDING_PLAIN_KEY.length > 0,
        pendSync: typeof PENDING_SYNC_KEY === 'string' && PENDING_SYNC_KEY.length > 0,
      };
      ui.encrypted = prevEnc; ui.encKey = prevKey;                            /* 恢复（隔离：不影响后续用例）*/
      window.encryptState = origEnc; window.writeEncryptedStore = origWrite;
      return out;
    });
    expect(r.isDesktop).toBe(true);          /* mock → 桌面判定为真 */
    expect(r.active).toBe(false);            /* 加密态 → l8PersistActive()===false（R3 早退）*/
    expect(r.dirty).toBe(0);                 /* 不采集 */
    expect(r.removed).toBe(0);
    expect(r.sent).toBe(0);                  /* #27-5：加密态不得发批（即便桌面）*/
    expect(r.patchDelta).toBe(0);            /* 无 patch_nodes 调用 */
    expect(r.encHits).toBeGreaterThanOrEqual(1); /* 走全量加密写盘分支（§七 7.2）*/
    expect(r.pendPlain).toBe(true);          /* PENDING_PLAIN_KEY 兜底链路仍在 */
    expect(r.pendSync).toBe(true);           /* PENDING_SYNC_KEY 兜底链路仍在 */
  });
});

/* ============================================================
   §8.16 哨兵 · 不变量 #27 (T-68 · L8-W4)
   依据：l8-design-2026-10-14.md §九 #27 / §八 8.4 T-68 / §八 8.5。
   目标：200 步确定性伪随机操作（增/改/删/撤销/重做/合并）后，持久层投影（mock 行集）
        逐 id JSON 等价于内存 state.nodes；无孤儿行 / 无缺行；脏集收敛为 0；seq/rev 单调。
   负载鲁棒：全程结构性断言，无 wall-clock 断言（规避 T-48/T-49 型抖动）。
   接缝：bootWithMock(page,{persist:true}) → mock 走 K-1/K-2/K-7 真契约；确定性 PRNG（mulberry32，固定种子）保证可复现。
   ============================================================ */
test.describe('L8-W4 §8.16 哨兵 · 不变量 #27（200 步随机序列 · 负载鲁棒）', () => {
  test('T-68 200 步增/改/删/撤销/重做/合并后 投影===内存（结构性 + 单调性）', async ({ page }) => {
    test.setTimeout(120_000);
    await bootWithMock(page, { persist: true });
    const r = await page.evaluate(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const p = window.__juPersistProbe;
      p.setMode('patch'); p.clearDirty();
      await wait(450);
      const seqStart = window.__juMockDb.lastSeq;
      const revStart = state._rev | 0;
      /* 确定性伪随机（mulberry32）：固定种子 → 序列可复现（负载鲁棒，无 wall-clock） */
      let s = 0x9e3779b9 >>> 0;
      const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
      const docId = actions.createDoc('L8-T68-sentinel');
      const ops = { add: 0, edit: 0, del: 0, undo: 0, redo: 0, merge: 0 };
      for (let i = 0; i < 200; i++) {
        const ids = Object.keys(state.nodes);
        const leaves = ids.filter((id) => { const n = state.nodes[id]; return !!n && (!n.children || n.children.length === 0) && id !== docId; });
        const t = rnd();
        if (t < 0.30 || leaves.length < 2) {
          const parent = pick(ids.filter((id) => state.nodes[id])) || docId;
          actions.addNode(parent, 0, { text: 's' + i }); ops.add++;
        } else if (t < 0.55) {
          const id = pick(ids); commit((st) => { st.nodes[id].text = 'e' + i; }, { snapshot: true }); ops.edit++;
        } else if (t < 0.68) {
          actions.removeNode(pick(leaves)); ops.del++;
        } else if (t < 0.80) {
          if (undo()) ops.undo++;
        } else if (t < 0.88) {
          if (redo()) ops.redo++;
        } else {
          const remote = JSON.parse(JSON.stringify(state));
          const pid = pick(Object.keys(remote.nodes));
          const nid = 'r' + i + '_' + Math.floor(rnd() * 1e6);
          remote.nodes[nid] = { id: nid, text: 'r' + i, parent: pid, children: [], collapsed: false, done: false,
            date: null, tags: [], priority: 0, recur: null, habit: null, createdAt: Date.now(), updatedAt: Date.now(), showInCal: true };
          remote.nodes[pid].children = (remote.nodes[pid].children || []).concat([nid]);
          remote.updatedAt = Date.now(); remote._rev = (state._rev | 0) + 1; delete remote._tombstones;
          mergeRemoteState(remote); ops.merge++;
        }
        if (i % 25 === 24) { await wait(360); await runPersist(); await wait(140); }
      }
      /* 终局收敛：多次驱动 runPersist，确保未决批次落盘 + ack 清脏 */
      await wait(420); await runPersist(); await wait(360); await runPersist(); await wait(200);
      const rows = window.__juMockDb.rows;
      const mism = []; const orphan = [];
      for (const [id, v] of rows) {
        const str = (typeof v === 'string') ? v : JSON.stringify(v);
        if (!state.nodes[id]) orphan.push(id);
        else if (str !== JSON.stringify(state.nodes[id])) mism.push(id);
      }
      const missing = Object.keys(state.nodes).filter((id) => !rows.has(id));
      const st = p.stats();
      return {
        ops: ops, mism: mism, orphan: orphan, missing: missing,
        dirty: st.dirty, removed: st.removed, mode: st.mode,
        seqStart: seqStart, seqEnd: window.__juMockDb.lastSeq,
        revStart: revStart, revEnd: state._rev | 0,
        rowsCount: rows.size, nodesCount: Object.keys(state.nodes).length,
        replays: window.__juMockDb.replays,
      };
    });
    /* 覆盖度：6 类操作均被触发（确定性序列 → 可复现断言） */
    expect(r.ops.add).toBeGreaterThan(0);
    expect(r.ops.edit).toBeGreaterThan(0);
    expect(r.ops.del).toBeGreaterThan(0);
    expect(r.ops.undo).toBeGreaterThan(0);
    expect(r.ops.redo).toBeGreaterThan(0);
    expect(r.ops.merge).toBeGreaterThan(0);
    /* #27 结构性等价：逐 id JSON 等价 + 无孤儿 + 无缺行 */
    expect(r.mism).toEqual([]);
    expect(r.orphan).toEqual([]);
    expect(r.missing).toEqual([]);
    /* 终局脏集收敛（#27-4）*/
    expect(r.dirty).toBe(0);
    expect(r.removed).toBe(0);
    /* 单调性（无 wall-clock）：seq / rev 单调不减；投影非空 */
    expect(r.seqEnd).toBeGreaterThanOrEqual(r.seqStart);
    expect(r.revEnd).toBeGreaterThanOrEqual(r.revStart);
    expect(r.rowsCount).toBeGreaterThan(0);
    /* 注：replays 不作断言——本哨兵混入全量 checkpoint 后，mock 的 save_state lastSeq 域
       与产品独立 _persistBatchSeq 会出现一次良性「同 seq」交叉（命中 K-2 幂等分支），非缺陷；
       K-2「无同 seq 重放」的专门零断言由 T-64（persist mock）承担。此处仅记录于证据。 */
  });
});

