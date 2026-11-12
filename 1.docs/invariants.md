### 1. 根唯一且可达
**定义**
`state.rootId` 必须存在；`state.nodes[state.rootId]` 必须存在；根节点 `parent` 为 `null`；从任意活树节点沿 `parent` 上溯，有限步内必达 `rootId`。
**断言**
```js
const root = state.nodes[state.rootId];
assert(root && root.parent === null);
for (const id of liveTreeIds()) {
  let cur = id, steps = 0;
  while (cur !== state.rootId) {
    cur = state.nodes[cur].parent;
    assert(cur && ++steps <= Object.keys(state.nodes).length);
  }
}
```
**关联实现**
`migrateStateObject()`、`repairTreeConsistency()` 第一遍。
**验证方式**
导入旧备份、删除根子节点、多标签合并后检查。
**覆盖用例 id**：

---

### 2. 活树父子互反
**定义**
对任意非根活树节点 `n`：若 `n.parent = p`，则 `p` 必须存在且 `!p._deleted`，并且 `p.children.includes(n.id)`；反之，若 `p.children` 含 `c`，则 `state.nodes[c].parent === p.id`。
**断言**
```js
for (const id in state.nodes) {
  const n = state.nodes[id];
  if (n._deleted || id === state.rootId) continue;
  const p = state.nodes[n.parent];
  assert(p && !p._deleted && p.children.includes(id));
}
for (const pid in state.nodes) {
  const p = state.nodes[pid];
  if (p._deleted) continue;
  for (const cid of p.children) {
    assert(state.nodes[cid] && state.nodes[cid].parent === pid);
  }
}
```
**关联实现**
`repairTreeConsistency()` 第一遍、`mergeRemoteState()` 尾部修复。
**验证方式**
并发移动 + 删除、远端覆盖祖先、侧栏拖拽后检查。
**覆盖用例 id**：

---

### 3. children 无重复、无幽灵 id
**定义**
对任意节点 `p`：`new Set(p.children).size === p.children.length`；且 `p.children` 中每个 `cid` 都必须在 `state.nodes` 中存在。
**断言**
```js
for (const pid in state.nodes) {
  const p = state.nodes[pid];
  if (!Array.isArray(p.children)) continue;
  assert(new Set(p.children).size === p.children.length);
  for (const cid of p.children) assert(state.nodes[cid]);
}
```
**关联实现**
`repairTreeConsistency()` 第二遍保序去重 + stray 清理。
**验证方式**
多标签同父并发插入、重复导入、LWW 平局合并后检查。
**覆盖用例 id**：

---

### 4. 活树无环、无多父
**定义**
从 `rootId` 做 DFS，不得重复访问同一节点；从任意节点沿 `parent` 上溯，不得进入环。
**断言**
```js
const seen = new Set();
(function dfs(id) {
  assert(!seen.has(id));
  seen.add(id);
  const n = state.nodes[id];
  if (n && !n._deleted) (n.children || []).forEach(dfs);
})(state.rootId);
for (const id in state.nodes) {
  const chain = new Set();
  let cur = id;
  while (cur && !chain.has(cur)) {
    chain.add(cur);
    cur = state.nodes[cur]?.parent;
  }
  assert(!cur || cur === state.rootId || !chain.has(cur));
}
```
**关联实现**
`validateImportedTree()` 的 `visited/onStack` 环检测；`repairTreeConsistency()` 第二遍多父清理。
**验证方式**
导入含环 JSON、导入漂浮子树、并发移动成环后检查。
**覆盖用例 id**：

---

### 5. 非根活节点 parent 必须存在且非删除
**定义**
对任意 `!n._deleted` 且从根可达的节点：`n.parent` 必须指向 `state.nodes` 中存在的节点，且 `!parent._deleted`。
**断言**
```js
for (const id in state.nodes) {
  const n = state.nodes[id];
  if (n._deleted || id === state.rootId) continue;
  const p = state.nodes[n.parent];
  assert(p && !p._deleted);
}
```
**关联实现**
`repairTreeConsistency()` 第一遍：父缺失挂回根、父删除则重新挂根。
**验证方式**
删除父节点、远端删除父节点、导入悬空 parent 后检查。
**覆盖用例 id**：

---
## 删除、回收站与墓碑 {#trash-tombstone}

### 6. 删除节点不在活树
**定义**
对任意 `n._deleted === true`：不得从 `rootId` 可达；不得出现在任何活树节点的 `children` 中。
**断言**
```js
const reachable = new Set();
(function dfs(id) {
  if (reachable.has(id)) return;
  reachable.add(id);
  const n = state.nodes[id];
  if (n && !n._deleted) (n.children || []).forEach(dfs);
})(state.rootId);
for (const id in state.nodes) {
  if (state.nodes[id]._deleted) assert(!reachable.has(id));
}
for (const pid in state.nodes) {
  const p = state.nodes[pid];
  if (p._deleted) continue;
  for (const cid of p.children) assert(!state.nodes[cid]?._deleted);
}
```
**关联实现**
`moveToTrash()` 从父 `children` 摘除；`mergeRemoteState()` 对 `_deleted` 覆盖同步摘除；`repairTreeConsistency()` 跳过 `_deleted` 节点。
**验证方式**
回收站恢复、彻底删除、多标签删除传播后检查。
**覆盖用例 id**：

---

### 7. 回收站引用一致
**定义**
`state.trashed` 中每条 `{rootId, ids}`：`state.nodes[rootId]` 存在且 `_deleted`；`ids` 等于该 `rootId` 子树的全部节点 id；恢复后 `_deleted=false` 并挂回目标父 `children`；彻底删除后这些 id 不在 `state.nodes`。
**断言**
```js
for (const t of state.trashed || []) {
  const root = state.nodes[t.rootId];
  assert(root && root._deleted);
  const sub = collectSubtree(t.rootId);
  assert(sameSet(sub, t.ids));
}
```
**关联实现**
`moveToTrash()`、`restoreFromTrash()`、`purgeTrash()`。
**验证方式**
回收 → 恢复 → 再回收 → 彻底删除；多标签同步回收站。
**覆盖用例 id**：

---

### 8. 墓碑有界、TTL 一致、恢复即清
**定义**
`_recentlyRemoved` 与 `state._tombstones` 中同一 id 时间戳一致；超过 30s 清理；容量 ≤2000；恢复节点时同步 `delete _recentlyRemoved[id]` 与 `delete state._tombstones[id]`。
**断言**
```js
for (const [id, ts] of _recentlyRemoved) {
  assert(state._tombstones?.[id] === ts || !state._tombstones?.[id]);
  assert(Date.now() - ts <= 30000);
}
assert(_recentlyRemoved.size <= 2000);
```
**关联实现**
`_tombstoneSet()`、`_tombstoneDelete()`、`restoreFromTrash()`。
**验证方式**
30s 内刷新、恢复后对端旧快照、2000+ 连续删除后检查。
**覆盖用例 id**：

---

## 标签与索引一致 {#tag-index}

### 9. 标签并集公式
**定义**
对任意节点：`n.tags === unique(n._manualTags ∪ extractTags(stripHtml(n.text)))`。
正文删除 `#tag` 后，若该标签不在 `_manualTags`，则必须从 `n.tags` 中消失，不得成为幽灵标签。
**断言**
```js
for (const id in state.nodes) {
  const n = state.nodes[id];
  if (!n || n._deleted || n._isFolder) continue;
  const expected = [...new Set([
    ...(n._manualTags || []),
    ...extractTags(stripHtml(n.text || ''))
  ])];
  assert(sameSet(n.tags || [], expected));
}
```
**关联实现**
`updateText()`、`commitPendingEditBeforeRender()`、`openTagPicker()`、`nodeHasTag()`。
**验证方式**
输入 `#设计` 后删除、手动标签后清空正文、重命名标签后检查。
**覆盖用例 id**：

---

### 10. 标签索引一致
**定义**
`buildTagIndex().get(t)` 必须等于 `{ id | nodeHasTag(N(id), t) }`，且结果无重复 id。
侧栏标签计数、标签视图、日历标签筛选三处口径一致。
**断言**
```js
const idx = buildTagIndex();
for (const [t, ids] of idx) {
  const expected = [];
  for (const id in state.nodes) {
    if (nodeHasTag(state.nodes[id], t)) expected.push(id);
  }
  assert(sameSet(ids, expected));
}
```
**关联实现**
`buildTagIndex()`、`nodeHasTag()`、`_tagIndexCache`。
**验证方式**
标签树展开、标签视图点击、日历标签筛选后计数一致。
**覆盖用例 id**：

---

### 11. 搜索缓存一致
**定义**
`_searchHayCache` 中条目 `updatedAt` 必须与节点当前 `updatedAt` 一致；节点文本、标签、数据库字段变更后，旧缓存不得命中；搜索结果与实时 `nodeSearchHay(n)` 一致。
**断言**
```js
for (const [id, entry] of _searchHayCache) {
  const n = state.nodes[id];
  if (!n) continue;
  assert(entry.updatedAt === n.updatedAt);
  assert(entry.hay === nodeSearchHay(n));
}
```
**关联实现**
`nodeSearchHay()`、`_searchHayCache`、`makeLRU(2000)`。
**验证方式**
编辑文本、改标签、改数据库字段后立即搜索。
**覆盖用例 id**：

---

### 12. 日历索引一致
**定义**
`buildCalIndex()`、`calendarTodosOnDate(ds)`、`nodesOnDate(ds)` 对同一天返回的节点集合去重后一致；`calRoot` 子树不双计；全树带 `date` 节点补扫时用 `visited` 去重；重复展开按 `expandRecurring()` 规则；`_calDayCache` 代次与 `state.updatedAt` 同步。
**断言**
```js
const ds = todayStr();
const a = calendarTodosOnDate(ds).map(n => n.id).sort();
const b = nodesOnDate(ds).map(n => n.id).sort();
assert(a.join() === b.join());
assert(new Set(a).size === a.length);
```
**关联实现**
`buildCalIndex()`、`calendarTodosOnDate()`、`_calDayCache`、`invalidateCalIndex()`。
**验证方式**
月/周/年视图切换、设置重复、清除日期后检查。
**覆盖用例 id**：

---

### 13. 字数缓存一致
**定义**
`docWordCount(id)` 缓存命中值与实时遍历一致；字数 = 子树所有节点 `stripHtml(text)` 长度之和（深度优先递归 `children`），不额外读取 `content` 或 `_wordFlat` 字段（这两个字段已由 #56 删除）；`dirtyDocs` 变更时对应缓存删除或清空。
**断言**
```js
const id = getCurrentDoc().id;
const cached = _wordCountCache.get(id);
const live = liveWordCount(id);
assert(cached === undefined || cached === live);
```
**关联实现**
`docWordCount()`、`_wordCountCache`、`makeLRU(2000)`。
**验证方式**
编辑正文、转换 Word/大纲、删除子树后检查。
**覆盖用例 id**：

---
## 历史栈 {#history}

### 14. 历史栈边界与互斥
**定义**
`historyPast.length <= HISTORY_MAX=30`；`historyFuture` 与 `historyPast` 不得同时包含同一状态快照。

**写入规则（按 `historyMode` 枚举，`l4-design-2026-10-13.md` § 一 2）**：
- `'snapshot'`：写入 `historyPast`，触发 `historyFuture.length=0`；
- `'merge'`：写入 `historyPast`，触发 500ms 合并规则（见 14.M），触发 `historyFuture.length=0`；
- `'never'`：不写入 `historyPast`，仍触发 `historyFuture.length=0`（FIX-H-03 语义）。

**兼容映射**：旧 `snapshot:true` → `'snapshot'`；旧 `noHistory:true` / `light:true` / `persistOnly:true` → `'never'`（`persistOnly` 仅控制通知/持久化，不影响历史栈）。

- 元素类型：`historyPast` / `historyFuture` 元素为 `Patch` 对象（`{v, t, op, mode, paths, pre, post, meta, groupKey?}`），不再为完整 `state` 克隆。
- **14.M 合并规则**（决策 3.2 落地，硬编码不暴露 UI）：仅当 stack 顶部 patch 的 `groupKey === 新 patch.groupKey` 且 `patch.t - last.t <= 500ms`，合并（取并集 paths，pre 用首次，post 用末次，`mergedCount++`）。`_MERGE_WINDOW_MS` 硬编码 500ms，写入不变量文档，不暴露 UI（决策 3.2）。
- **14.M2 远端合并保持**：mergeRemoteState 完成后 `historyPast` / `historyFuture` 保持不变（修正 1）。
- **14.M3 系统自愈不入历史**：dedupCalRoots (4731) / dedupNoteRoots (5141) 等系统自愈调用固定为 `'never'`，不入栈（澄清 2 + 决策 3.1）。
- **14.M4 增量索引输出**（L6 阶段 2 扩展，2026-10-14）：commit 收口（`v2.0-t3.html` `commit()` 函数）在 patch 入栈后必须输出 `changedIds` 并触发 `updateIncrementalIndexes(changedIds, _oldState, state, {op})`；`__juInMerge=true`（mergeRemoteState 期间）跳过增量维护（#22.22.M1 一致）。
- mergedCount 上限 50；paths 并集上限 10；HISTORY_MAX=30 不变。

**断言**
```js
assert(historyPast.length <= 30);
for (const p of historyFuture) assert(!historyPast.includes(p));
for (const p of historyPast) {
  assert(p && p.v === 1 && p.t && p.op && p.mode);
  assert(p.paths && p.pre && p.post);
  assert(['snapshot', 'merge', 'never'].includes(p.mode));
}
assert(_MERGE_WINDOW_MS === 500);
```
**关联实现**
`commit()` 历史入栈逻辑（`l4-design § 一 4` 收口 catch）、`undo()` / `redo()`（`applyPatch(patch, direction)`，方向由参数决定，不调用 `invertPatch`）、`tryMergeWithLast()`、`HISTORY_MAX=30`、`_MERGE_WINDOW_MS=500`。
**验证方式**
连续编辑 31 次、noHistory 提交后 undo/redo、批量操作后检查；`l4-history.spec.ts` T-09/T-10/T-11（合并规则）+ T-15/T-16（#22）。
**覆盖用例 id**：T-27, T-28, T-29

---

### 15. undo/redo 状态等价
**定义**
`undo()` 后 `state` 必须等价于上一历史快照；`redo()` 后必须等价于被撤销的快照；两者都必须使 `_wordCountCache`、`_calRecurCache`、`_yearCountsCache`、`_calDayCache`、`_renderDayCache` 失效；四个索引（`calIndex` / `tagIndex` / `searchInverted` / `backlinkMap`）按 #23 与 #15.M4 走增量维护，不再整体置空。
P0 后目标：撤销栈内存不随节点数线性增长（<1KB 级）。

- 等价判定：通过 `patch.paths` 集合遍历，比较路径上值与对应 `pre` / `post` 一致（不再依赖完整 state 克隆对比）。
- undo 走 `applyPatch(state, patch, 'undo')`（应用 `pre`）；redo 走 `applyPatch(state, patch, 'redo')`（应用 `post`）。
- **15.M4 增量索引反向维护**（L6 阶段 2 扩展，2026-10-14，O-2 决策）：undo / redo 在 `applyPatch` 之后必须调用 `updateIncrementalIndexes(changedIds, _preState, state, {direction: 'undo'|'redo'})`；`__juInMerge=true` 跳过；失败时强制 4 索引 null（lazy full rebuild 兜底）；与正向 commit 增量维护（#14.M4）对称。
- **M4 修复 · 复活对称性**（2026-10-14，F-1）：当补丁使 `_deleted` 由 `true`→`false`（复活）且 `date` 不变时，`calIndex` 必须把该 id **重新加入**对应 date 集合（原 `toDate!==fromDate` 守卫会漏加，导致撤销软删 / `restoreFromTrash` 后节点在日历视图消失）。由 `l6-index.spec.ts` T-27 / T-28 / T-29 覆盖。相关哈希 `81e5772a…dfdce13`。
- 缓存失效：`_wordCountCache.clear()`，`_calRecurCache` / `_yearCountsCache` / `_calDayCache` / `_renderDayCache` 置空；四个索引由 #23 增量维护，不在此处清空。
- 树结构修复：`applyPatch` 后必须触发 `repairTreeConsistency()`（不变量 #1-#5 兜底）。
- 墓碑清理：撤销删除类 patch 时同步清 `_tombstones` 中对应 id。
- **15.M 内存目标**（修正 3）：
  - historyPast 中典型 patch（updateText）< 200 B；
  - historyPast 中典型 patch（addNode/removeNode）< 1 KB；
  - 30 条 historyPast 累计 < 30 KB（远低于 1KB/step 平均）；
  - 序列化失败 → 降级为 `'never'` + 记录报告（`window.__juPatchFailures`），不持有 state 引用。
- **15.M2 不持有 state 引用**：patch 不存 state 整体引用；undo/redo 走 `__juProduceSafe` 路径。
- **15.M3 远端合并不可撤销**：mergeRemoteState 期间的 state 变更不入历史栈；undo 不会触达 merge 中间态（修正 1 + #22 互证）。

**断言**
```js
const before = snapshot(state);
undo();
assert(equivalent(state, previousSnapshot));
assert(_wordCountCache.size === 0);
redo();
assert(equivalent(state, before));
const totalBytes = JSON.stringify(historyPast).length;
assert(totalBytes < 30 * 1024);
```
**关联实现**
`undo()` / `redo()`（`applyPatch(patch, direction)`，patch 不可变假设）、`invalidateCalIndex()`、`_wordCountCache.clear()`、`reportPatchFailure()`。
**验证方式**
编辑 → 撤销 → 恢复 → 再撤销；20k 节点内存快照对比；`l4-history.spec.ts` T-12（内存）+ T-13/T-14（等价）+ T-19（序列化失败降级）。

---
**辅助工具**：`invertPatch(patch)`（`v2.0-t3.html:2230-2240`）保留为工具函数，构造 `pre`/`post` 互换、`op` 标记为反向的新 patch。当前 L4 undo/redo 流程**不调用**该函数（基于 patch 不可变假设，方向由 `applyPatch` 参数决定）。后续若方案 A 逃生舱日志、远端 patch 同步等场景需要可复用。
**覆盖用例 id**：T-27, T-28, T-29

---
## 多标签 LWW 与删除传播 {#lww}

### 16. 多标签 LWW 收敛
**定义**
任意两个标签并发修改同一节点，合并后按 `updatedAt` 较大者胜；同 `updatedAt` 同 `createdAt` 时，按剥离 `_rev/_origin/_deleted` 后的 JSON 字典序确定性 tie-break；最终两端节点内容一致。
**断言**
```js
mergeRemoteState(remoteA);
mergeRemoteState(remoteB);
assert(JSON.stringify(nodesA) === JSON.stringify(nodesB));
```
**关联实现**
`mergeRemoteState()` 节点级 LWW、`mergeRemoteIfNewer()`。
**验证方式**
Playwright 双标签并发随机操作 1000 次收敛测试。
**覆盖用例 id**：

---

### 17. 多标签删除传播守卫
**定义**
对“本地有、远端无”的节点，只有同时满足：`updatedAt < remoteUpdatedAt`、非 `_origin==='local'`、不在 `_localCreated`、且 `_diskConfirmed` 包含该 id，才可视为远端已删除；否则保留。
**断言**
```js
for (const id in localNodes) {
  if (remote.nodes[id]) continue;
  const ln = localNodes[id];
  const deletable =
    _norm(ln.updatedAt) < remoteUpdatedAt &&
    ln._origin !== 'local' &&
    !state._localCreated?.includes(id) &&
    _diskConfirmed?.has(id);
  if (!deletable) assert(localNodes[id]);
}
```
**关联实现**
`mergeRemoteState()` 删除传播分支 + `_recentlyRemoved` 墓碑防复活。
**验证方式**
新建节点后对端发旧快照、删除后对端发旧快照、离线标签重连。
**覆盖用例 id**：

---

### 18. rev 单调与广播门控
**定义**
`state._rev` 非负且单调不减；合并时取 `max(local, remote) + 1`；广播只携带 `rev + updatedAt`，不递增 rev；接收端只按 `updatedAt` 严格小于跳过，同毫秒继续走 LWW，不按 rev 拒绝对端内容。
**断言**
```js
const before = state._rev;
mergeRemoteState(remote);
assert(state._rev >= before);
assert(state._rev === Math.max(before, remote._rev || 0) + 1);
```
**关联实现**
`runPersist()`、`_broadcastRev()`、`mergeRemoteIfNewer()`、`STORE_BC_INSTANCE.onmessage`。
**验证方式**
两标签交替写盘、同毫秒并发、广播风暴后检查。
**覆盖用例 id**：

---

### 22. 远端合并不可撤销性（L4 阶段 1.6 新增）
**定义**
`mergeRemoteState()` 完成后，`historyPast` / `historyFuture` 保持不变；`undo` / `redo` 不得触达 merge 产生的中间态（修正 1 后版本，2026-10-13）。
- 触发：`mergeRemoteState()` 完成且 `_structDirty || _metaDirty`（D-4 条件）。
- 核心规则：mergeRemoteState 不进入历史栈；已有 historyPast/historyFuture 保持不变。
- undo/redo 不得触达 merge 中间态：merge 期间对 state 的所有修改（localNodes[id]=rn, pp.children.push, splice 等）不被历史栈记录；用户按 Ctrl+Z 撤销的是"合并后"用户操作，不会"跨过"合并点回到合并前。
- 实现：mergeRemoteState 不调用 `commit()`，不调用 `historyPast.push` / `historyPast.length=0` / `historyFuture.length=0`。
- **22.M1 增量索引豁免**（L6 阶段 2 扩展，2026-10-14）：mergeRemoteState 期间 `__juInMerge=true`，commit 收口跳过 `updateIncrementalIndexes`（与不入历史栈一致）；merge 结束后 finally 块强制 4 索引 null（lazy full rebuild 兜底）+ 清零 `__juInMerge`。

**断言**
```js
commit((s) => { s._test = 1; }, { historyMode: 'snapshot', silent: true, persistOnly: true });
const lenBeforeMerge = historyPast.length;
mergeRemoteState(remoteWithNewNodeY);
assert(historyPast.length === lenBeforeMerge);
assert(historyFuture.length === 0);
undo();
assert(!('_test' in state && state._test === 0));
```
**关联实现**
`mergeRemoteState()`（不调用 commit/清栈）；`l4-design-2026-10-13.md` § 二 3。
**验证方式**
本地编辑 3 步 → 远端合并 → undo 1 次，验证 historyPast 长度保持 + state 行为符合"合并后基线"；`l4-history.spec.ts` T-15 / T-16。
**覆盖用例 id**：

---

### 43. 历史栈隔离与远端合并不可撤销（交叉引用）
**定义**
见 **#22**。本条为 #22 的交叉引用，不独立计数。
**断言**
```js
const lenBefore = historyPast.length;
mergeRemoteState(remoteWithNewNode);
assert(historyPast.length === lenBefore);
```
**关联实现**
`mergeRemoteState()`、`commit()`、`applyPatch()`。
**覆盖用例 id**：

---
## 加密兜底 {#crypto-fallback}

### 19. 加密兜底双写、明文最小化与恢复
**定义**
加密模式下：
1. `commit()` 必须同步写入 `sessionStorage.PENDING_PLAIN_KEY`，但数据**必须**经过 `_pendingPlainState()` 最小化处理（剥离 `activity`、`_rev` 等冗余信息）。
2. 约 200ms 防抖写 `PENDING_SYNC_KEY` 密文。
3. 主存储成功后**或**加密兜底定时器成功执行后，必须立即清除上述两个 Key，将明文暴露窗口缩小至 0。
4. `recoverPendingEncrypted()` 启动恢复时先密文、后明文，TTL 内 LWW 合并；明文 TTL 10min，密文 TTL 60s。

> 本条目由原 #19（双写与恢复）与原 #44（明文最小化与崩溃兜底）合并而来；#44 仅保留交叉引用，不独立计数。

**断言**
```js
ui.encrypted = true;
commit(s => { s.nodes[root].text = 'secret'; });
const plain = JSON.parse(sessionStorage.getItem(PENDING_PLAIN_KEY));
assert(plain.st.nodes[root].text === 'secret');
assert(plain.st.activity === undefined);   // 最小化处理
assert(sessionStorage.getItem(PENDING_SYNC_KEY));  // 防抖后密文
assert(!sessionStorage.getItem(PENDING_PLAIN_KEY)); // 主存储成功后明文清除
assert(!sessionStorage.getItem(PENDING_SYNC_KEY));
```
**关联实现**
`_pendingPlainState()`、`scheduleEncFallback()`、`recoverPendingEncrypted()`、`commit()` 尾部的 `PENDING_PLAIN_KEY` 写入。
**验证方式**
加密模式编辑后立即刷新、关页前编辑、崩溃恢复；校验 `activity` 不出现在明文兜底载荷中。
**覆盖用例 id**：

---

### 20. 锁定态与加密备份不破坏密文
**定义**
`ui.locked === true` 时 `runPersist()` / `flushPersistNow()` 不得写盘；加密模式不写明文 `AUTO_BACKUP_KEY`，改由 `saveEncryptedAutoBackup()` 写 IndexedDB `versions` 表 `docId='__autobackup__'` 的加密记录；解锁失败或取消不得删除 `ENC_KEY`、不得覆盖原密文、不得初始化真实数据。
**断言**
```js
if (ui.locked) {
  assert(!_persistRunning);
  assert(localStorage.getItem(ENC_KEY));
  assert(!localStorage.getItem(AUTO_BACKUP_KEY));
}
```
**关联实现**
`boot()` 锁定分支、`saveEncryptedAutoBackup()`、`promptUnlock()`。
**验证方式**
取消解锁、输错密码、锁定态关页、加密模式备份后检查。
**覆盖用例 id**：

---

### 44. 加密模式下的明文最小化与崩溃兜底（交叉引用）
**定义**
见 **#19**。本条为 #19 的交叉引用，不独立计数。
**断言**
```js
ui.encrypted = true;
commit(s => { s.nodes[root].text = 'secret'; });
const plain = JSON.parse(sessionStorage.getItem(PENDING_PLAIN_KEY));
assert(plain.st.nodes[root].text === 'secret');
assert(plain.st.activity === undefined);
```
**关联实现**
`_pendingPlainState()`、`commit()` 尾部的 `PENDING_PLAIN_KEY` 写入、`recoverPendingEncrypted()`。
**覆盖用例 id**：

---

## 主题 token 约束 {#theme-tokens}

### 21. 主题 token 不变量（视觉约束）
**定义**
日间主题（轻盈淡雅）必须使用 `#DFECD5` + `#CAD3C3`；夜间主题（深邃沉稳）必须使用 `#0A1929` + `#152A4A` + `#1D355E`（三层深藏青，四周浅、中间深）。在现有代码中变量映射如下：
| 主题 | 变量 | 必须值 | 语义 |
|---|---|---|---|
| 日间 | `--bg` | `#DFECD5` | 轻盈淡雅：主背景 |
| 日间 | `--bg-soft` | `#CAD3C3` | 轻盈淡雅：顶栏 / 侧栏 / 浅层底 |
| 夜间 | `--bg` | `#0A1929` | 深邃沉稳：主背景（深藏青，四周浅、中间深）|
| 夜间 | `--bg-soft` | `#152A4A` | 深邃沉稳：顶栏 / 侧栏（次深）|
| 夜间 | `--bg-panel` | `#1D355E` | 深邃沉稳：卡片面板（最浅，形成层级）|
**断言**
```js
const css = getComputedStyle(document.documentElement);
if (document.documentElement.dataset.theme === 'day') {
  assert(css.getPropertyValue('--bg').trim().toLowerCase() === '#dfecd5');
  assert(css.getPropertyValue('--bg-soft').trim().toLowerCase() === '#cad3c3');
}
if (document.documentElement.dataset.theme === 'night') {
  assert(css.getPropertyValue('--bg').trim().toLowerCase() === '#0a1929');
  assert(css.getPropertyValue('--bg-soft').trim().toLowerCase() === '#152a4a');
  assert(css.getPropertyValue('--bg-panel').trim().toLowerCase() === '#1d355e');
}
```
**派生与一致性约束**
1. 日间派生：面板、菜单、中间层从 `#DFECD5` / `#CAD3C3` 低饱和派生，保持“轻盈淡雅”。
2. 夜间派生：以 `--bg`（`#0A1929`）为主背景最深色，`--bg-soft`（`#152A4A`）为顶栏 / 侧栏次深，`--bg-panel`（`#1D355E`）为卡片最浅，形成“四周浅、中间深”的层级（对齐代码注释“批次4: 夜间层级修正”）。面板、菜单、浮层从 `--bg-panel` 向深藏青派生，保持“深邃沉稳”。
3. 切换一致：`applyTheme()` / `saveUI()` / `forceRender()` 后，上述五个主题 token 不得被改写。
4. 持久化一致：`localStorage` 中 UI 的 `theme` 必须与当前 `data-theme` 一致。
5. 打印与导出：打印样式不得覆盖根主题 token；PNG / HTML 导出应使用当前主题或明确声明导出主题。
6. 对比度目标：正文 `--fg` 对 `--bg` / `--bg-panel` 目标至少 WCAG AA 4.5:1；大文本 3:1，实测为准。
**关联实现**
`<style>:root` 与 `html[data-theme="night"]` 中的 `--bg`、`--bg-soft`、`--bg-panel`；`applyTheme()`、`saveUI()`。
**验证方式**
切换主题后读取 computed style；刷新后检查变量与持久化一致；打印预览不覆盖 token。
**覆盖用例 id**：

---
## 索引一致性（L6 阶段 2 新增） {#l6-index}

### 23. 增量索引一致性
**定义**
任意 commit 后，4 索引（`calIndex` / `tagIndex` / `searchInverted` / `backlinkMap`）必须与「全表重建」结果一致（在不可变快照上对比）。`updateIncrementalIndexes(changedIds, fromState, toState, opts)` 是单一入口，4 索引按顺序更新，任一失败 → 报告 + 降级（强制 4 索引 null → lazy full rebuild）。
- 数据结构：
  - `calIndex: Map<date, Set<id>>`（替代旧 `Map<date, Node[]>`）
  - `tagIndex: Map<tag, Set<id>>`（替代旧 `Map<tag, id[]>`）
  - `searchInverted: Map<term, Set<id>>`（新增倒排索引；旧 `_searchHayCache` LRU 保留兼容）
  - `backlinkMap: Map<docId, Map<topId, count>>`（新增反链索引；`backlinkReverse: Map<sourceId, Set<docId>>` 用于子树清理 O(1) 查询）
- 注入点：commit 收口（#14.M4）+ undo/redo 反向（#15.M4）；三处守卫写法统一（M5-1，均为 `_patch&&_patch.paths&&_patch.paths.length&&!__juInMerge`）
- 失败兜底：
  - `__juIndexFailures` 容量 50（FIFO，与 `__juPatchFailures` 对齐）
  - 连续 3 次失败 → 强制 4 索引 null（lazy full rebuild）+ 重置 streak
  - `assertIndexConsistency()`（fuzz 100 commit 序列 + 每步与全表重建对比）失败 → 同上
- 关键操作后强制全表校验：`loadFromLocalStorage` / `mergeRemoteState` / `initStore` 后必须跑一次 `assertIndexConsistency()`

**断言**
```js
for (let i = 0; i < 100; i++) {
  const r = randomCommit(state);
  if (r.changedIds.size) {
    const _res = updateIncrementalIndexes(r.changedIds, r.fromState, r.toState, {});
    if (!_res.ok) { /* 报告 + 降级 */ }
  }
  assert(deepEqual(_calIndexCache, buildCalIndexFull()));
  assert(deepEqual(_tagIndexCache, buildTagIndexFull()));
  assert(deepEqual(_searchInverted, buildSearchInvertedFull()));
  assert(deepEqual(_backlinkMap, buildBacklinkMapFull()));
}
```
**关联实现**
`extractChangedIds(paths, meta)`、`updateIncrementalIndexes(changedIds, fromState, toState, opts)` 统一入口（`v2.0-t3.html` L6 基础设施段）；4 子函数 `calIndexUpdate` / `tagIndexUpdate` / `searchInvertedUpdate` / `backlinkMapUpdate`；`reportIndexFailure()`、`resetIndexFailureStreak()`；`__juIndexFailures` 全局缓冲；`l6InjectionFailure(tag, op, err, t)`（**M5-2 加固，2026-10-14**：注入点内层异常统一降级出口 = `reportIndexFailure` + 强制 4 索引 null，取代原 `catch(_e){}` 静默吞异常）。
**验证方式**
`l6-index.spec.ts` T-23~T-26（fuzz 100 commit 序列 + `__juIndexFailures` 容量 50 + 连续 3 次失败强制 rebuild）。
**覆盖用例 id**：T-30, T-31, T-32, T-33, T-34

---

### 24. 删除子树索引收敛
**定义**
删除子树时（`actions.removeNode` / `moveToTrash` / `purgeTrash` 触发 `_deleted:true` 或硬删 `nodes.<id>` path），4 索引必须在同一 commit 内完成清理：
- `calIndex` 移除被删节点的所有 date 引用
- `tagIndex` 移除被删节点的所有 tag 引用
- `searchInverted` 移除被删节点的所有 term 引用
- `backlinkMap` 移除被删节点的所有 sourceId → docId 引用

**实现**
- 软删识别：`paths` 含 `nodes.<id>._deleted`，pre=false → post=true
- 硬删识别：`paths` 含 `nodes.<id>`（仅 id 层级），pre=Node → post=undefined
- 识别后调用 `updateIncrementalIndexes(new Set(), fromState, toState, {subtreeCleanup: true, subtreeIds: deletedIds, op: op + ':remove'})`
- 依赖 `removeNodeFromMap` 递归（已验证 `v2.0-t3.html` line 1588 递归删除子节点）；每个被删子节点都产生独立 `_deleted:true` 或 `nodes.<id>` path，被 L6 增量清理覆盖

**断言**
```js
const root = buildSubtree(5, 100);
commit(() => { actions.removeNode(root.id); });
assert(!calIndexHasAnyId(_calIndexCache, subtreeIds));
assert(!tagIndexHasAnyId(_tagIndexCache, subtreeIds));
assert(!searchInvertedHasAnyId(_searchInverted, subtreeIds));
assert(!backlinkMapHasAnyId(_backlinkMap, subtreeIds));
undo();
assert(calIndexEqualsBefore(_calIndexCache, snapshot));
assert(tagIndexEqualsBefore(_tagIndexCache, snapshot));
assert(searchInvertedEqualsBefore(_searchInverted, snapshot));
assert(backlinkMapEqualsBefore(_backlinkMap, snapshot));
```
**M4-5 补注（2026-10-14）**
上例 `undo()` 后的 `assert(calIndexEqualsBefore(...))` 由 M4 的 F-1 修复保证：软删 / 硬删经 `undo()` 复活时，`calIndexUpdate` 会经由 `(toDate!==fromDate||fromDeleted)` 分支把 id 重新加入。由 `l6-index.spec.ts` T-28 覆盖。
**关联实现**
commit 收口 `_delIds` 识别；`updateIncrementalIndexes({subtreeCleanup: true, ...})`。
**验证方式**
`l6-index.spec.ts` T-08~T-10（删除子树 + 5 层 100 节点 + undo 恢复）。
**覆盖用例 id**：

---

### 25. 性能预算
**定义**
L6 阶段 2 性能目标（自决 6）：
- 切日历视图 P95 < 50ms（20k 节点）
- 切标签视图 P95 < 40ms
- 搜索查询 P95 < 100ms
- 单次 commit 增量维护 P95 < 5ms（O(|changedIds|)）
- undo/redo 增量维护 P95 < 5ms

**实现**
- 首次构建：保持现状（全表懒构建），P95 仍可能在 50-100ms 区间（自决 5：L6 不优化）
- 二次构建：4 索引命中（`_calIndexCache` 等非 null），O(1) 返出
- 增量维护：单 commit < 5ms（patch 路径数 ≤ 30，每路径最多 4 索引 add/remove 操作）

**验证方式**
`bench-p0-after-l6.json` + 20k 节点夹具；`l6-bench.spec.ts` 切视图 + commit/undo/redo 增量维护 + 删除子树清理 P50/P95/P99。
**覆盖用例 id**：

---
## 异步索引与首屏（L7 阶段新增） {#l7-async-index}

### 26. 骨架屏 + progress 出口 + 分块异步构建
**定义**
冷缓存下切换视图时，UI 必须走「两阶段渲染」，且索引构建必须分块执行（单块预算 `_L7_CHUNK_BUDGET_MS=8`）并在块间让出主线程；可执行判定由结构性哨兵承担（T-52）：骨架两阶段、progress 0%→100% 单调不减、异步四索引结果与同步 L6 构建逐项 digest 等价。wall-clock longtask 仅作观测项，不作门禁。

- **阶段 1（同步骨架）**：切视图的那一帧内**同步**渲染骨架（`.ju-skel`，`role=status`、`aria-busy=true`、`data-ju-skel=<kind>`），**绝不出现真数据**；阶段 1 同步栈耗时 < 50ms。
- **阶段 2（真渲染）**：索引就绪后 `forceRender()` 以真 DOM 覆盖骨架，骨架**零残留**（`.ju-skel` 计数归零）。
- **progress 出口**：`l7ProgressEmit(src, {phase, done, total, label})` 必须把进度写入统一出口（`window.__juIndexShadow.progress*`，缓冲上限 64）+ 广播 `CustomEvent 'ju:index-progress'` + 驱动骨架进度条；单轮内 **0% → 100% 单调不减**，末条必达 `done === total`。
- **分块异步构建**：主线程以 `_L7_CHUNK_BUDGET_MS = 8`（< 50ms longtask 阈值，留足余量）逐块构建，`_l7Yield` 用 `MessageChannel` 让出；**在途去重**（同一 token 复用同一 Promise）；**异步四索引结果 ≡ 同步 L6 构建**（`_l7DigestFrom*` 逐项 digest 相等，LO-1）。
- **降级不降级**：构建失败走 `onError` 兜底（功能不降级）；Worker 不可用时回退 `'sync'`（#23 兜底）。

**断言**
```js
const sk = window.__juSkeleton, w = window.__juIndexShadow;
assert(typeof sk.twoPhase === 'function');
assert(typeof w.progressReset === 'function' && typeof w.progressBuf === 'function');
assert(w.chunkBudget() === 8 && _L7_CHUNK_BUDGET_MS === 8);
sk.twoPhase(host, { kind: 'tags', mode: 'chips', count: 6, build: () => gate, onData: () => real });
assert(host.querySelectorAll('.ju-skel').length > 0 && !host.querySelector('#real'));
w.progressReset();
l7ProgressEmit('main', { phase: 'tagIndex', done: 0,  total: 10 });
l7ProgressEmit('main', { phase: 'tagIndex', done: 10, total: 10 });
const seq = w.progressBuf().filter((e) => e.src === 'main');
assert(seq[seq.length - 1].done === seq[seq.length - 1].total);
assert(seq[seq.length - 1].pct === 1);
release(); await tick(60);
assert(host.querySelector('#real') && host.querySelectorAll('.ju-skel').length === 0);
assert(dgMap(_tagIndexCache) === dgMap(buildTagIndexSync()));
```
**关联实现**
`l7Skeleton()` / `l7TwoPhaseRender()` / `l7CalIndexWhenReady` / `l7TagIndexWhenReady`；`_L7_CHUNK_BUDGET_MS=8` / `_l7BuildInflight` / `_l7Yield`（MessageChannel）/ `l7ProgressEmit`（`v2.0-t3.html` L7 段）；Worker `PROGRESS_EVERY=2000` + `fullRebuildCore` 分块上报。
**验证方式**
`l7-index-worker.spec.ts` §8.7（T-47 / T-49 / T-50 / T-51）+ **§8.8 哨兵 T-52**。**W5 冻结（2026-10-14）后** §8.7 的可执行项为 **T-47 / T-50 / T-51**（T-48 / T-49 已 `test.skip` 隔离，不影响本不变量的可判定性）。

> **W5 隔离说明（2026-10-14）**：T-48 与其孪生 T-49 均为 **wall-clock** longtask 指标，`verify:all`（6 workers）下负载敏感误判，已分别 `test.skip` 隔离并留待评审；本不变量 #26 的**可执行判定**由 T-52 承担（结构性 + 单调性 + digest 等价，均与并发负载无关）。**L7 冻结判定：本不变量的产品语义已由 T-52 + T-47 / T-50 / T-51 全部验证通过；被隔离的两项仅涉 wall-clock 观测口径，非产品缺陷。**
**覆盖用例 id**：

---

## 增量落盘（L8 阶段新增） {#l8-persist}

### 27. 增量落盘投影等价
**定义**
落盘采用增量批（`patch_nodes`）时，「持久层投影」必须始终等价于内存 `state.nodes` 的**某个已提交状态**：
1. `_dirtyNodes` / `_removedNodes` 只增不减，**除非**对应批获得成功 ack（D-4）；
2. 批的 `changed[].data` 反序列化后逐字段等于内存节点（D-3，写当前态）；
3. 每批最多包含「已 ack 之后 + 本批生成之前」的变更（**不丢批、不重放已清项**）；
4. 全量 checkpoint 后脏集必须为空（§六 6.2）；
5. 非桌面 / 加密态**不得**发出 `patch_nodes`（§七 7.2 / 7.3）。

**断言**
```js
await page.evaluate(() => window.__juPersistProbe.setMode('patch'));
await step();
await page.evaluate(() => flushPersistNow());
const probe = await page.evaluate(() => window.__juPersistProbe.stats());
assert(probe.dirty === 0 && probe.removed === 0);
const rows  = await page.evaluate(() => [...window.__juMockDb.rows.entries()]);
const nodes = await page.evaluate(() => state.nodes);
for (const id of Object.keys(nodes)) assert(rows.find(r => r[0] === id)[1] === JSON.stringify(nodes[id]));
for (const [id] of rows) assert(id in nodes);
```
**关联实现**
`markPersistDirty`（I-1~I-4）、`buildPersistBatch`、`applyPatchAck`、`markFullOnce`、`flushDesktopSave`（checkpoint）、`_lastPersistFingerprint`（D-8）。
**验证方式**
`l8-persist-patch.spec.ts` T-53 ~ T-62 / T-65；**哨兵 T-68**（200 步随机序列，结构性断言，负载鲁棒）。
**覆盖用例 id**：T-66, T-67, T-68

---

### 28. 落盘批崩溃原子性
**定义**
任一 `patch_nodes` 调用在持久层必须是**全有或全无**：崩溃于批中途 → 读回批前态；崩溃于提交后 → 读回批后态。**不得**出现「部分 `changed` 已写、`deleted` 未写」之类的半批。前端在失败（`ok:false` 或 `invoke-throw`）时**不得**清脏集，且必须降级 `_persistMode='full'`。
**断言**
```js
await page.evaluate(() => { window.__juMockCrashMidBatch = true; });
await edit();
await page.reload();
const snapshot = await page.evaluate(() => Object.fromEntries(window.__juMockDb.rows));
assert(deepEqual(snapshot, beforeBatchRows));
const probe = await page.evaluate(() => window.__juPersistProbe);
assert(probe.mode === 'full');
assert(probe.errors.length >= 1);
```
**关联实现**
`runPersist` 桌面子分支的 `try/catch` + `markFullOnce()`；Rust 侧 `BEGIN IMMEDIATE … COMMIT` + `PRAGMA journal_mode=WAL`（K-1，仓外）。
**验证方式**
T-63（半批）/ T-64（提交后未 ack）/ T-61（失败降级）；Rust 侧 K-1 归入仓外验收清单 OP-1。

> **L8-W5 登记说明（2026-10-14）**：#27 哨兵 **T-68**（`l8-persist-patch.spec.ts` §8.16，`ok 152` 绿）；#28 由 **T-63 / T-64 / T-61** 覆盖。二者已随 L8 spec 接入 `verify.js`（`PW_TESTS` 7→8；PW = 150 passed + 2 skipped(T-48/T-49) = 152）；canonical = `step9` 镜像 = L8 冻结件 `1.冻结版本\v2.0-l3-frozen-l8-2026-10-14.html`（`6CAD8950…C42B10`）三方逐位一致，冻结登记证据 `step9\reports\_w5freeze.txt`；`verify.js` 新哈希 `13D6F030…B8098`（4,201 B，纯 LF）。
**覆盖用例 id**：

---
## 持久层落地（L10-W4 新增） {#l10-persist}

### 29. 浏览器持久层投影等价（影子 → 落地）
**定义**
当 L10 D-1 接缝（`globalThis.__juL10D1Seam`）**开启**时，「浏览器 IDB / 分片持久层投影」必须始终等价于内存 `state.nodes` 的**某个已提交态**：
1. 单批 = 一个 IDB `readwrite` 事务，**全有或全无**——崩溃于批中途（BEGIN / APPLY）→ 读回**批前态**，无半批；
2. 批的 `changed[].data` 反序列化后逐字段等于内存节点（写当前态）；
3. 批**幂等**（键 = `seq`）：`seq <= lastAcceptedSeq` → `replay:true` 且不重复生效；
4. 全量 checkpoint（`flushNow`）后脏集为空、无孤儿行、投影原子替换；
5. **加密态**持久层字节**无明文片段**；**非桌面 / 加密态不得发出 `patch_nodes`**。
> 与 #27 / #28 **同族**；本条为「影子层升为真路径（默认关闭）」后的**浏览器侧延伸**。**L10 历史态：接缝默认关闭**；现行默认启用见 **#30**。本条只约束「接缝开启后」的行为，默认值以 #30 为准，不再以本条为准。

**断言**
```js
const seam = createSeam({ backend: new InMemoryBackend() });
await seam.applyBatch({ changed: [{ id: 'a', data: '{"id":"a"}' }], deleted: [], seq: 1, baseRev: 0 });
seam.backend.crashBeforeCommit((phase) => { if (phase === 'apply') throw new Error('crash'); });
const r = await seam.applyBatch({ changed: [{ id: 'b', data: '{"id":"b"}' }], deleted: [], seq: 2, baseRev: 1 });
assert(r.ok === false && !seam.projection().has('b'));
assert(seam.stats().mode === 'full');
assert((await seam.applyBatch({ ...b2, seq: 2 })).replay === true);
assert(!String(seam.projection().get('s1')).includes(MARK));
```
**关联实现**
`l9\l10-idb-persist.mjs`（`createSeam` / `applyBatch` / `flushNow` / `projection` / `probeTransact` / `migrateLegacy`）、`l9\persist-store.mjs`（`PersistStore` / `InMemoryBackend` / `buildPersistBatch`）、`l9\backend-adapters.mjs`（`createAdapter('idb'|'invoke')`）；产品侧接缝块 `__juL10D1Seam`（`v2.0-t3.html`，**L10 历史态：默认关闭**；现行默认启用见 #30）。
**验证方式**
N 层 **`l9\l10-w4-consistency.test.mjs`**（T-96 崩溃原子性 ×2 / checkpoint 原子性 / seq 幂等 / 三路径隔离 / 密文纯净 / p95 指标）+ P 层 **`tests\l10-idb-persist.spec.ts`**（T-93 ~ T-99）。
**哨兵 T-99**：P 层 `tests\l10-idb-persist.spec.ts` 之门禁哨兵（`PARTY_COUNT ≥ 16` + `RESULT=PASS`）+ N 层 **T-99(N)**（`l10-w4-consistency.test.mjs`，**200 步确定性随机序列** → 投影一致性；**结构性、无 wall-clock**，承接 T-68 负载鲁棒范式）。

> **L10-W4 登记说明（2026-10-15）**：[历史口径] #29 由 **T-96(N)** + **T-93 ~ T-99** + **T-99(N) 哨兵** 覆盖；D-1 接缝默认关闭，关闭态零回归；三路径锚点由 `_临时脚本\_l10w4_entropy.mjs paths`（18/18 PRESENT）独立佐证；登记器 `19-verify-hash-registry.mjs`（旧路径 l9\l9-hash-check.mjs，已更名）= **`PARTY_COUNT=19`** / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。**#30–#33 为未启用方向（D-2 / D-3）预留空洞，不回填。**
**覆盖用例 id**：T-99

---

## 遗留收口与默认启用治理（L11-W4 / W5 / W6 新增） {#l11-governance}

### 30. 接缝默认启用零回归（default-on 四路径等价）
**定义**
L10 D-1 接缝（`globalThis.__juL10D1Seam`）**默认启用**（`M-I`：缺省即安装 `globalThis.__juL10D1`；仅显式置 `false` 时惰性关闭）后，必须同时满足：
1. **零回归**：默认门禁口径与 L10 冻结版逐项一致——`verify:all` = Node **72** + PW **163 passed + 2 skipped（T-48/T-49）= 165** + bench **7/7**；`19-verify-hash-registry.mjs` = **32 方** / drift 0 / PASS；现行门禁见 #90。
   > [历史快照] 此处的 Node 72 / PW 163 / 32 方均为当时版本口径；现行门禁以 #90 为准（Node 503 / PW 171 / 65 方）。
2. **四路径等价**（桌面 / 加密 / 浏览器 / 影子层）：接缝仅新增**不可枚举** `__juL10D1`（`version='l10-d1/v1'`，9 键公共面），不改桌面 `patch_nodes`/`applyPatchAck`、加密兜底、`localStorage` 主存储与影子层语义；
3. **契约逐字保留**：`version` / `flag` / 降级 5 原因（`no-product` / `no-l9` / `already-attached` / `install-failed` / `attached`）/ 关页不接管。
> 与 #29 同族；本条为「默认启用收口（E-1 · `M-I`）」的面。

**断言**
```js
assert(typeof globalThis.__juL10D1 === 'object');
assert(Object.getOwnPropertyDescriptor(globalThis, '__juL10D1').enumerable === false);
assert(globalThis.__juL10D1.version === 'l10-d1/v1');
// 现行门禁：node scripts/verify.js all → [verify] 全部通过（现行 65 方，见 #90）
```
**关联实现**
产品侧接缝块 `__juL10D1Seam`（`v2.0-t3.html:18294`，**默认启用**，L11-W6 翻转默认值 1 处）；`l9\l10-idb-persist.mjs`（`createSeam` / `applyBatch` / `flushNow` / `projection`）；逐字保留契约（`version='l10-d1/v1'` / 降级 5 原因）。
**验证方式**
P 层 `tests\l11-anchor-governance.spec.ts` **T-104**（default-on 四路径等价）与 **T-100**（缺省启用态 + 显式 false 关闭）；门禁 `19-verify-hash-registry.mjs`（现行 65 方，见 #90）。
**哨兵 T-104**：P 层 `l11-anchor-governance.spec.ts` 之「`M-I` 默认启用零回归」哨兵（`JU_L11=1` 启用）。

> **L11-W6 登记说明（2026-10-15）**：[历史快照] #30 由 **T-104** + **T-100** 承担；canonical = step9 镜像 = **L11 收口冻结件** `1.冻结版本\v2.0-l3-frozen-l11w6-2026-10-15.html` = **972,267 B / `D6204DFC…D7C1` / LF**（三方逐字节一致）。红证 `reports\l11-w6-red-log-2026-10-15.txt`；绿证 `reports\l11-w6-green-log-2026-10-15.txt`（7 passed）。
**覆盖用例 id**：T-104

---
### 31. 登记锚点治理后零漂移（含新增锚点集）
**定义**
登记锚点集（`19-verify-hash-registry.mjs` `TARGETS`）在**治理**后必须**逐字节零漂移**：
1. `PARTY_COUNT` = 登记方数（现行 = 65，见 #90）；每方的 SHA-256 + 字节长度 + 行尾（EOL）与期望一致；
   > [历史快照] L11-W5 定值 31；L11-W6 定值 32；L12-W5 定值 36；L13-W5 定值 38；L14-W5 定值 43。当前已扩至 65 方。
2. `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`（exit 0）；
3. 「先改锚、后清理」顺序纪律（C-8）：清理前未改锚 → 机器可见漂移（`RESULT=FAIL`），改锚一致后转绿；
4. 登记器自身**在登记方之外**（自指排除）。
> 与 #27 / #28 / #29 同族；本条为「遗留收口（E-1 · `M-G′`）」的治理面。

**断言**
```js
const out = spawnSync(node, ['19-verify-hash-registry.mjs']).stdout;
assert(/PARTY_COUNT=65/.test(out));
assert(/FIVE_PARTY_DRIFT_COUNT=0/.test(out));
assert(/RESULT=PASS/.test(out));
```
**关联实现**
`19-verify-hash-registry.mjs`（`TARGETS` **现行 65 方**）；版本感知期望表 `scripts\_w5freeze.ps1`（`$VJS_GEN['l11w6']` / `$H_GEN`）/ `scripts\_w4freeze.ps1` / `scripts\_w4paths.ps1`。
**验证方式**
P 层 `tests\l11-anchor-governance.spec.ts` **T-102**（登记器口径 65 方 / drift 0 / PASS；默认关闭态由 `JU_L11=1` 启用）+ N 层 `l9\l11-w4-consistency.test.mjs`（结构性）。
**哨兵 T-100**：P 层 `l11-anchor-governance.spec.ts` 之 E-1 面哨兵（接缝默认关闭态 + 登记锚点治理；默认关闭态下与 L10 冻结门禁逐项一致）。

> **L11-W5 登记说明（2026-10-15）**：[历史快照] #31 的机器判定由登记器 `19-verify-hash-registry.mjs` = **`PARTY_COUNT=31`** / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`。顺序纪律红证见 `reports\l11-w3-red-log-2026-10-15.txt`。
>
> **L11-W6 登记说明（2026-10-15）**：[历史快照] #31 的机器判定更新为 **`PARTY_COUNT=32`**；**L11 收口冻结件** = 972,267 / `D6204DFC…D7C1` / LF。
>
> **L12-W5 登记说明（2026-10-15）**：[历史快照] #31 的机器判定更新为 **`PARTY_COUNT=36`**；canonical/step9-mirror 期望值随 L12 同步为 **983,460 / `CFCD67DA…FC34`**；**L12 冻结件** = `1.冻结版本\v2.0-l3-frozen-l12-2026-10-15.html` = 983,460 / `CFCD67DA…FC34` / LF（三方逐字节一致）。
**覆盖用例 id**：

---

### 34. 环境可达性（Chrome / node 路径存在性）
**定义**
`verify:all`（PW + bench）的可执行性依赖**两个环境锚**可解析：
1. **浏览器**：`JU_CHROMIUM_PATH`（`C:\Users\12601\AppData\Local\Google\Chrome\Application\chrome.exe`）或 `playwright.config.ts` 内联回退常量同值；缺失则 PW 退化为「未测量」；
2. **Node**：非 PATH 的 `E:\软件\CodeBuddy CN\node.exe`（`verify.js` 内部 `spawnSync('node')` 需前置 PATH）。
> 换机 / CI 须重设两变量（C-7）；本项为**环境事项**登记，不改变产品语义。**产品 HTML 尾页脚**（`<!-- … -->` + LF = 39 B）属**字节冻结件组成部分**，**不得清理**（LO-9=A）。

**断言**
```js
assert(fs.existsSync(process.env.JU_CHROMIUM_PATH));
const tail = fs.readFileSync(canonical).subarray(-39).toString('utf8');
assert(tail.startsWith('<!-- ') && tail.endsWith('-->\n'));
```
**关联实现**
`scripts\verify.js`（`JU_CHROMIUM_FALLBACK` 内联回退常量）；`playwright.config.ts`（`CHROMIUM_CANDIDATES`）；`2.项目日志\CURRENT_TASK.md` §三（环境约束）。
**验证方式**
P 层 `tests\l11-anchor-governance.spec.ts` **T-101**（产品尾页脚 39 B 保持）+ 本仓实测（Chrome FOUND / node v22.20.0）。
**哨兵 T-101**：P 层 `l11-anchor-governance.spec.ts` 之字节冻结件保持哨兵。

> **L11-W5 登记说明（2026-10-15）**：[历史快照] #34 为**环境事项**（OP-12），无产品字节变更；哨兵 T-101 绿（尾页脚 39 B 保持）。**#30 已于 L11-W6 登记；#32 已于 L12-W5 登记；#33 已于 L13-W5 回填；#35 已于 L14-W5 登记。**
**覆盖用例 id**：

---

## 真虚拟滚动（L12-W5 新增） {#l12-virtual-scroll}

### 32. 真虚拟滚动视口一致（rendered ≈ viewport）
**定义**
当 L12 真虚拟滚动（`M-H`）**启用**（`JU_L12=1`）时，大纲 / 长文档视图必须满足「**渲染节点数 ≈ 视口内节点数**（`rendered ≈ viewport`）」，且与关闭态**语义等价**：
1. **视口一致**：屏外节点**不在 DOM**；任意滚动位置下渲染行数 ≤ `VS_MAX_ROWS`（≤ 200）且 ≥ 视口覆盖所需行数；
2. **单调有界**：200 步确定性滚动序列下窗口起点**单调不减**、窗口**有界**（哨兵 T-110）；
3. **零语义变更**：启用态与关闭态**逐字节语义一致**——`commit` / `forceRender` 返回值、`this` 绑定、副作用逐字不变（包装器仅计时，`try/finally`）；
4. **降级安全网**：窗口计算抛错 → 置 `_virtualDisabled` + 走全量路径且**行数 = total**；**H5 显式开关**（`#setVirtualScrollOff` / `_vsUserDisabled`）/ 打印强制全量 / 阈值外 / doc 缺位 → 均**永不虚拟化**（T-109(N)）；
5. **指标有界**：commit / 切视图 / longtask 三序列 p95 wall-clock，采样 ring 上限 `VS_METRIC_CAP=256`。
> 与 #27–#31 同族；本条为「真虚拟滚动（E-2 · `M-H`）」的视口一致面。**关闭态**（缺省）与 L11 收口冻结版**逐项一致**（[历史快照] PW = 165；现行见 #90）。

**断言**
```js
assert(vs.shouldUse(doc) === false);
assert(vs.renderedRowsAt(scrollTop) <= VS_MAX_ROWS);
let prev = -1; for (const y of seq200) { const s = vs.windowStart(y); assert(s >= prev); prev = s; }
terminal.disabled = true; assert(vs.renderedRows() === total);
assert(vs.metrics().commit.p95 >= 0 && vs.metrics().commit.samples <= VS_METRIC_CAP);
// 门禁：node scripts/verify.js all → [verify] 全部通过（现行 65 方，见 #90）
```
**关联实现**
产品侧真虚拟滚动块 `v2.0-t3.html:5907`（`_vsShouldUse` / `_vsUserDisabled` / `.virtual` 弱虚拟门控 / `VS_MAX_ROWS` / `#setVirtualScrollOff` / `VS_METRIC_CAP` / `vsMetricsStats` / `window.__juVsMetrics`）；N 层 `l9\l12-virtual-scroll.test.mjs` / `l9\l12-w4-consistency.test.mjs`。
**验证方式**
N 层 `l9\l12-virtual-scroll.test.mjs`（结构性）+ `l9\l12-w4-consistency.test.mjs`（9 用例：降级三态 + 崩溃注入 + H5 显式开关 + T-110 哨兵 + 指标纯函数）；P 层 `tests\l12-virtual-scroll.spec.ts`（T-105 ~ T-110，`JU_L12=1` 启用）。
**哨兵 T-110**：P 层 `l12-virtual-scroll.spec.ts` 之「渲染节点数有界 + 单调」哨兵；**T-110(N)**：N 层 `l12-w4-consistency.test.mjs` 之 200 步确定性滚动序列哨兵。

> **L12-W5 登记说明（2026-10-15）**：[历史快照] #32 由 **T-110** + **T-110(N)** + **T-105 ~ T-109** 覆盖；红证 `reports\_l12w4_red0.txt`（6 passed / 3 failed，新锚缺位）；绿证 `reports\l12-w5-green-log-2026-10-15.txt`（Node 91 / PW 165 / bench 7/7）+ `reports\l12-w5-green-log-2026-10-15-l12on.txt`（启用 Node 91 / PW 171 / bench 7/7）。产品字节冻结：canonical = step9 镜像 = **L12 冻结件** `1.冻结版本\v2.0-l3-frozen-l12-2026-10-15.html` = **983,460 B / `CFCD67DA…FC34` / LF**（三方逐字节一致）。
**覆盖用例 id**：T-110

---
## 内存工作集封顶（L13-W5 新增） {#l13-workset}

### 33. 内存工作集封顶（视口 + LRU ≤ 5,000 · 同步→异步等价）
**定义**
当 L13 内存工作集（`M-B`）**启用**（`_mbDisabled=false`）时，节点驻留必须**与全量规模解耦（O(1)）**；**关闭态**（缺省 `_mbDisabled=true`）与 L12 收口冻结版**逐项语义一致**：
1. **驻留基数有界**：非视口 LRU 段 `|workset| ≤ MB_LRU_CAP = 5,000`；视口段 `|viewport| ≤ MB_VIEW_CAP = 200`（**单列**口径）；总驻留 `≤ 5,200`；均**与节点总数 N 无关**。
2. **淘汰纪律**：**仅**在 `getNodeAsync` 回填成功后触发 `mbEvict()`（MB-Q3）；`Map` **插入序** LRU（MB-Q4）；**三重守卫**（① 视口集常驻 / ② 脏集保护 / ③ 显式 `pin`）；安全网 `capBreach === 0`；冷路径显式排除。
3. **同步→异步等价**：**唯一异步边界** = `getNodeAsync(id)`；默认态 **S-A 短路** ⇒ `await getNodeAsync(id) === N(id)`（**同一引用**）；启用态等价口径 = 投影字段**逐项结构等价**（`deepEqual(projection)`）。
4. **一致性边界**：**增量失效 ⊆ 全量对拍**（`mbAuditConsistency` ⇒ `mismatch === 0`）；工作集路径任一异常 ⇒ `_mbCrashSafe` **会话级降级回全量**。
5. **100k 真规模闸门**：100k 合成夹具 ⇒ `|workset| ≤ 5,000` + `capBreach = 0` + **`RSS ≤ 200MB`**（`performance.memory` · L0-5 = A）。

**断言**
```js
assert(mb.worksetSize()  <= MB_LRU_CAP);
assert(mb.viewportSize() <= MB_VIEW_CAP);
assert(mb.metrics.capBreach === 0);
assert(await getNodeAsync(id) === N(id));
assert(mb.auditConsistency(desc).mismatch === 0);
assert(fixture100k.rss <= 200 * 1024 * 1024);
// 门禁：node scripts/verify.js all → [verify] 全部通过（现行 65 方，见 #90）
```
**关联实现**
产品侧 L13 块 `v2.0-t3.html:5206`（`mbResolve` 单接入点 / `MB-LRU` 视口段+LRU 段+三重守护 / `getNodeAsync` 唯一异步边界 / `mbDebounceViewport` + `mbCoalesceCommit` + `_mbApplyIncremental` + `mbAuditConsistency` + `_mbCrashSafe` / `MB_W4`）；P 层 `tests\l13-mb-workset.spec.ts`（**T-111 – T-116**）。
**验证方式**
P 层 `tests\l13-mb-workset.spec.ts`：T-111（`MB-SEAM` 等价）/ T-112（LRU 上限与回填一致）/ T-113（视口集常驻）/ T-114（`TS-V` 不直读）/ **T-115（100k RSS 闸门）** / **T-116（降级等阶）**；T-115/T-116 **缺省条件跳过**（`JU_L13_100K=1` 启用 ⇒ 6 passed）。
**哨兵 T-116**：P 层 off 态 `mbResolve` ⇒ `degraded === true` 且 `rows` 与全量路径**逐项相等**（+ 一致性 `mismatch=0` + 崩溃兜底）。
**T-116(N)**：**已登记** —— N 层载体 `l9\l13-mb-workset.test.mjs`（L13-W6 · `OP-19` 补全后创建并纳编 `verify.js` `NODE_TESTS`）。

> **L13-W5 登记说明（2026-10-16）**：[历史快照] #33 由 **T-116** + **T-115** + **T-116(N)** 覆盖；红证 `reports\_l13w5-hash-red.txt`（38 方新锚 `frozen-l13` 缺位 ⇒ `FIVE_PARTY_DRIFT_COUNT=1` / FAIL）；绿证 `reports\l13-w5-green-log-2026-10-16.txt`（Node 91 / PW 167 passed + 4 skipped = 171 / bench 7/7）+ `reports\_l13w5-registrar-2026-10-16.txt`（`PARTY_COUNT=38` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`）。产品字节冻结：canonical = step9 镜像 = **L13 冻结件** `1.冻结版本\v2.0-l3-frozen-l13-2026-10-16.html` = **991,316 B / `21BECFD4…A3CA` / LF**（三方逐字节一致）。
> **L14-W5 #33 回填收口（2026-10-16）**：`OP-19` 已于 **L13-W6** 补全（N 层载体 `l9\l13-mb-workset.test.mjs` 创建并纳编）⇒ **`T-116(N)` 由「待补」转「已登记」**；登记方数 [历史快照] **38 → 39**（L13-W6）。本轮 L14 纳编后 = [历史快照] **43 方**（见 #35）。
**覆盖用例 id**：T-115, T-116

---
## `M-H′` 虚拟滚动加固（L14-W5 新增） {#l14-hardening}

### 35. `M-H′` 加固不变量（变高行布局正确 + 增量 patch 与全量等价 + 视图覆盖 ≤ 视口上限 + 交互不触发全量重渲染）
**定义**
当 L14 `M-H′` 加固启用（`__l14.enable()` · `_l14Enabled=true`）时，界面规模收口二期须满足以下五面；**关闭态**（缺省 `_l14Enabled=false`）与 L13 收口冻结版**逐项语义一致**：
1. **变高行布局正确**：首屏实测行高 + 前缀和 + 二分定位（`__vsHeightTable`）⇒ 行高误差 ≤ 1px、无重叠、`scrollHeight` 误差 ≤ 1px。
2. **增量 patch 与全量等价**：代次键 = `state.updatedAt`（`__vsGenCache` + `__vsPatchEquals`）⇒ 增量末态与全量路径**逐节点等价**。
3. **视图覆盖 ≤ 视口上限**：画廊 + 导图虚拟化（`__renderDbGalleryVirtual` / `__renderMindmapVirtual`）⇒ 渲染节点数 ≤ 200；应用内搜索（`__l14SearchAll`）跨全文档、命中屏外可定位（`_vsScrollToId`）。
4. **交互不触发全量重渲染**：`__vsInteractGuard`（计数 + `coalesce` 合批 + 几何缓存）⇒ 每交互渲染增量 ≤ 1、几何读取每帧 ≤ 1。
5. **真规模闸门（G6）**：`__l14LongtaskGate`（100k 合成夹具）⇒ 预算常量 `L14_LONGTASK_BUDGET=50` / `L14_RSS_CAP_MB=200` / `L14_P95_BUDGET=16`；**内存封顶 `RSS ≤ 200MB` 达标**（longtask / p95 为观测指标，登记 **OP-20**）。

**断言**
```js
assert(Math.abs(rowTopError) <= 1);
assert(deepEqual(incNodes, fullNodes));
assert(renderedNodeCount <= 200);
assert(interactRenderDelta <= 1);
assert(fixture100k.rss <= 200 * 1024 * 1024);
// 门禁：node scripts/verify.js all → [verify] 全部通过（现行 65 方，见 #90）
```
**关联实现**
产品侧 L14 块 `v2.0-t3.html`（G1 `__vsHeightTable` / G2 `__vsGenCache` / G3 `__renderDbGalleryVirtual` + `__renderMindmapVirtual` / G4 `__l14SearchAll` / G5 `__vsInteractGuard` / G6 `__l14LongtaskGate`；缺省 `_l14Enabled=false` 零回归兜底；落地记录见 `l14-w3-2026-10-16.md` / `l14-w4-2026-10-16.md`）；P 层 `tests\l14-virtual-scroll-hardening.spec.ts`（**T-117 – T-124**）。
**验证方式**
P 层 `tests\l14-virtual-scroll-hardening.spec.ts`：T-117（G1 变高行）/ T-118（G6 真规模闸门 + 100k 条件实测）/ T-119（G2 消除每次渲染 O(n)）/ T-120（G3 视图覆盖扩展）/ T-121（G4 应用内搜索替代）/ T-122（G5 交互加固）/ T-123（降级开关接地）/ T-124（接缝默认关闭 + 影子 ready）；`JU_L14=1` 启用 ⇒ **8 passed + 1 skipped**。
**哨兵 T-123**：P 层降级开关接地（缺省关闭 · 异常回退全量）⇒ 显式关闭语义与 L13 冻结件一致。
**N 层等价哨兵**：`l9\l14-vs-hardening.test.mjs`（G1–G5 等价哨兵 · 20 用例 / 4 套）+ `l9\l14-w4-consistency.test.mjs`（G6 真规模闸门 + 崩溃/一致性 + 降级等阶 · 14 用例 / 2 套）。

> **L14-W5 登记说明（2026-10-16）**：[历史快照] #35 由 **T-117 – T-124** + N 层等价哨兵覆盖；红证 `reports\_l14w5-hash-red.txt`（43 方新锚 `frozen-l14` 缺位 ⇒ `FIVE_PARTY_DRIFT_COUNT=1` / FAIL）；绿证 `reports\l14-w5-green-log-2026-10-16.txt`（Node 145 / PW 167 passed + 4 skipped = 171 / bench 7/7）+ `reports\_l14w5-registrar-2026-10-16.txt`（`PARTY_COUNT=43` / `FIVE_PARTY_DRIFT_COUNT=0` / `RESULT=PASS`）。产品字节冻结：canonical = step9 镜像 = **L14 冻结件** `1.冻结版本\v2.0-l3-frozen-l14-2026-10-16.html` = **1,012,003 B / `D110699F…D7BBDD` / LF**（三方逐字节一致）。
> **观测项（不阻断）**：**`OP-20`** —— 100k 切视图 longtask / p95 帧预算持续优化（`RSS ≤ 200MB` 已达标）。
**覆盖用例 id**：T-117, T-118, T-119, T-120, T-121, T-122, T-123

---

## 剪贴板与输入交互（P0 级新增） {#paste-input}

### 36. 剪贴板多行必拆与首尾空行净化（INV-PASTE-01/02）
**定义**
所有富文本或纯文本的粘贴操作，只要被 `parsePasteLines` 解析出的有效行数 **> 1**，**必须**调用 `splitPastedLinesToNodes` 拆分为多个兄弟节点，**严禁**因包含行内富文本标签而塞入单节点。所有插入内容必须经 `trimPasteHtml` 剔除首尾空白节点及 `<div><br></div>` 等无效结构。单行语义控件除外：文档标题、数据库行标题、日历事件块、日历待办的标题类输入框，粘贴多行时按 #37 处理（换行折叠为空格，不拆分节点）。
**断言**
```js
const dt = mockDataTransfer({ plain: "line1\nline2\n\n", html: "<p>line1</p><p>line2</p>" });
const parsed = parsePasteLines(dt);
assert(parsed.lines.length === 2);
assert(!parsed.hasRichFormat);
assert(trimPasteHtml("<div><br></div><p>a</p><div><br></div>") === "<p>a</p>");
```
**关联实现**
`parsePasteLines()`、`trimPasteHtml()`、`splitPastedLinesToNodes()`、`bindOutlineText()`、`bindNoteText()`、`renderCalNode()`。

**分流说明（2026-10-23）**：节点级剪贴板（见 #114 / #115）在 document 捕获阶段以 `JU-NODES:` 前缀识别，命中即 `preventDefault + stopPropagation`，不进入 `parsePasteLines` 拆分路径；`JU-NODES:` 载荷为单行 JSON，若未命中前缀按本条正常分流。本条 `parsePasteLines` 的多行拆分规则对所有非 `JU-NODES:` 粘贴内容不变。
**覆盖用例 id**：

---

### 37. 日历待办粘贴继承与单行语义降级（INV-PASTE-03/04）
**定义**
1. 在日历待办（`_isCalRoot` 子树）多行拆分时，必须透传 `inherit` 参数（包含 `date`、`showInCal`），强制新节点继承日期。
2. 单行语义控件（文档标题、数据库行标题、日历事件块）严禁插入 `<br>`，换行必须折叠为空格。
**断言**
```js
const n = { _isCalRoot: true, date: "2026-10-19" };
const newNodes = splitPastedLinesToNodes(..., inherit={date: n.date});
assert(newNodes.every(n => n.date === "2026-10-19"));
const dt = mockDataTransfer({ plain: "line1\nline2" });
assert(getPastedTextInHeader(dt) === "line1 line2");
```
**关联实现**
`splitPastedLinesToNodes()`（inherit 参数）、`renderDocHeaderInline()`、`renderDbTable()`（row-title）、`buildTimeGrid()`（.evtx）。

**分流说明（2026-10-23）**：节点级剪贴板（见 #114 / #115）在 document 捕获阶段以 `JU-NODES:` 前缀识别，命中即不进入本条的单行语义降级与多行拆分路径；`JU-NODES:` 载荷为单行 JSON，`parsePasteLines` 只会解析出 1 行，不会与本条冲突。非 `JU-NODES:` 的普通文字 / 富文本按本条规则处理不变。
**覆盖用例 id**：

---

### 38. 粘贴拆分后的渲染与焦点同步（INV-PASTE-05 / INV-FOCUS-01）
**定义**
多节点拆分导致 DOM 突增后，**必须**先用 `withSuppressedBlur()` 包裹当前编辑器的 `blur()`，再调用 `forceRender()` 重绘，随后立即调用 `focusAfterRender()` 将光标置于新增的最后一个节点。
**断言**
```js
assert(executionOrder.join(',') === 'blurInSuppressed,forceRender,focusAfterRender');
assert(blurSuppressedDuringBlur === true);
assert(blurSuppressedDuringForceRender === false);
```
**关联实现**
`splitPastedLinesToNodes()`、`withSuppressedBlur()`、`commitPendingEditBeforeRender()`、`saveFocus()`、`focusAfterRender()`。
**设计意图**
`forceRender()` 内部会调用 `commitPendingEditBeforeRender()`，若当前编辑器仍处于聚焦态，它会用旧 DOM 内容回灌，覆盖 `splitPastedLinesToNodes` 刚落库的第一行。因此 `blur()` 必须先于 `forceRender()`，且在抑制窗口内完成——`withSuppressedBlur` 只包裹 `blur`、不包裹 `forceRender` 是**有意为之**，不是遗漏。
> **可执行性说明**：需在 `splitPastedLinesToNodes()` 内打点 `executionOrder` 数组与 `blurSuppressedDuringBlur` / `blurSuppressedDuringForceRender` 抑制标志，否则本断言不可执行。
**覆盖用例 id**：

---
## UI 布局与视图交互 {#ui-layout}

### 39. UI 布局与视图交互（INV-UI-01 ~ 07）
**定义**
1. **折叠按钮**：`.main-toggle` 必须 `position: fixed` 并以视口中心（`50vw`）定位，左右侧栏展开时不漂移。
2. **侧栏拖拽**：手柄不可被裁切，监听必须用 `rAF` 节流。
3. **导航选中态**：仅允许背景色变化，严禁使用左侧色条或粗边框。
4. **幻灯片**：工具栏必须挂载在右侧栏 `data-section="edit"` 内；舞台必须依靠 `aspect-ratio: 16/9` 与 `min()` 逻辑自适应，严禁写死高度；视图卸载时必须执行 `_cleanup` 移除 resize 监听与幽灵节点。
**断言**
```js
assert(getComputedStyle(toggleBtn).position === 'fixed');
assert(toggleBtn.style.left === 'calc(50vw - 40px)');
assert(slideStage.style.aspectRatio === '16/9');
assert(slideToolbar.parentElement.closest('[data-section="edit"]') !== null);
```
**关联实现**
`#btnToggleLeft` 等的 CSS、`bindMainToggles()`、`JU_SLIDES.render()`、`JU_SLIDES._cleanup()`。
**覆盖用例 id**：

---

## 底层架构、并发与安全（P0 级兜底） {#state-concurrency}

### 40. 底层状态流与多标签并发（INV-STATE-01/02）
**定义**
1. 严禁直接原地修改 `state.nodes[id]`。必须通过 `commit()` 结合 `__juProduceSafe`（结构共享）生成新引用。
2. 多标签同步 `mergeRemoteState` 时，全局元数据数组（`templates` / `contacts` / `trashed` / `activity`）必须按主键做并集去重合并；节点内 `children` 数组按 #16 节点级 LWW 处理，并发删除依赖 `_recentlyRemoved` 墓碑机制防复活。
**断言**
```js
const oldStateRef = state;
commit(s => { s.nodes[rootId].text = 'new'; });
assert(state !== oldStateRef); 
```
**关联实现**
`__juProduceSafe()`、`mergeRemoteState()`、`_tombstoneSet()`。
**覆盖用例 id**：

---

### 41. 强制安全净化与输入法隔离（INV-IME-01 / INV-SAFE-01）
**定义**
1. 所有 contenteditable 的 `keydown` 监听，**首行必须**判断 `if (e.isComposing || e.keyCode === 229) return;`。中文组字期间严禁触发 Enter 新建、Tab 缩进等结构操作。
2. 所有外部 HTML 插入 DOM 前，必须经过 `sanitizeHtml()` 处理，剥离 `script`、`on*` 事件及非法 `url` 协议。
**断言**
```js
const mockEvent = { isComposing: true, keyCode: 229, key: 'Enter' };
simulateKeydown(textEl, mockEvent);
assert(nodeCountBefore === nodeCountAfter); 
```
**关联实现**
`bindOutlineText()` 等所有 keydown 事件、`sanitizeHtml()`、`sanitizeStyle()`。
> **与 #113–#115 关系（2026-10-23 核对）**：节点级剪贴板（#114 / #115）走 `copy` / `cut` / `paste` 事件，不使用 `keydown` 拦截 Ctrl+C / Ctrl+X / Ctrl+V，IME 组字期间不会误触节点级剪贴板路径，无冲突。
**覆盖用例 id**：

---

### 42. 大文档虚拟滚动阈值（INV-PERF-01）
**定义**
当单文档渲染可见节点数超过 `VIRTUAL_THRESHOLD` (200) 时，**必须**走 `_vsShouldUse` 的虚拟窗口化渲染机制，**严禁**直接遍历生成全量 DOM 节点。例外（见 #32）：用户显式关闭虚拟滚动（`ui.virtualScrollOff===true`）、打印强制全量（`beforeprint`）、降级标志置位（`_virtualDisabled` / `_vsUserDisabled`）时，不启用虚拟化，按全量渲染。
**断言**
```js
const doc = generateDocWithNodes(500);
assert(_vsShouldUse(doc) === true);
const container = document.querySelector('.outline.vs');
assert(container.querySelectorAll('.node').length <= VS_MAX_ROWS);
```
**关联实现**
`_vsShouldUse()`、`renderOutlinePage()`、`_renderOutlineVirtual()`。
**覆盖用例 id**：

---

## DOM 交互与状态生命周期 {#dom-lifecycle}

### 45. 拖拽事件防冲突与底部保护带（Drag Conflict & Safe Zone）
**定义**
1. **侧栏拖拽节流**：侧边栏节点拖拽与大纲拖拽，必须依赖 `mousemove` 判定阈值（如 5px）后才激活 `dragging` 态，**严禁**按下即触发。适用范围说明：本条的 5px 阈值与 `dragging` 态适用于「拖动手柄（`.drag-handle`）」和「侧栏行（`.sb-row`）」的节点移动；大纲行主体（`.row` 内非手柄区域）的鼠标拖拽判定见 #50 与 #113，两者作用对象不同，不互相覆盖。
2. **底部保护区遮罩**：主内容区 `#main::after` 必须有 32px 高度的实色遮罩（`background: var(--bg)`），且 `pointer-events: none`。
3. **右侧模块 DND 幂等**：右侧栏模块拖拽初始化时，**必须**清理历史遗留的 `.ju-grip` 手柄，且拖拽松手时必须将排序持久化至 `ui.dnd.secOrder`。
**断言**
```js
const afterStyle = getComputedStyle(document.querySelector('#main'), '::after');
assert(afterStyle.height === '32px');
assert(afterStyle.pointerEvents === 'none');
initSections();
assert(document.querySelectorAll('#sidebarRight .ju-grip').length === 0);
```
**关联实现**
`#main::after` 的 CSS、`makeSidebarRow()` 的 `mousedown`、`_buildOutlineBox()` 的拖拽保护、`JU_DND.init()`。
**覆盖用例 id**：

---

### 46. 输入框与重渲染的防丢字机制（Anti-Data-Loss）
**定义**
1. 任何触发全量视图重绘的入口（`renderMain` 或 `forceRender`），在清空 `#content` 之前，**必须**调用 `commitPendingEditBeforeRender()`。
2. 该函数需检查 `document.activeElement`，如果是 `contenteditable` 或 `input`，必须提取当前的 `innerHTML` 或 `value`，强制 `commit` 到 `state` 中。
3. 如果因为外部触发导致焦点丢失，需在重渲染前调用 `saveFocus()`，重渲染后调用 `restoreFocus()` 恢复光标。
**断言**
```js
const textEl = document.querySelector('.text[data-id="123"]');
textEl.innerHTML = '正在输入未保存的内容';
const activeBefore = document.activeElement;
forceRender();
assert(state.nodes['123'].text === '正在输入未保存的内容');
assert(document.activeElement === document.querySelector('.text[data-id="123"]'));
```
**关联实现**
`commitPendingEditBeforeRender()`、`saveFocus()`、`restoreFocus()`、`renderMain()`。
> **与 #113–#115 关系（2026-10-23 核对）**：`paste` 拦截由 `_outlineInsertClipNodes()` 内部 `commit` 完成，插入前后焦点由 `_outlineSel` 选中态承载，不依赖本条 `commitPendingEditBeforeRender` / `saveFocus` / `restoreFocus` 链路，无冲突。
**覆盖用例 id**：

---

### 47. UI 状态与业务状态的严格隔离（UI-State Isolation）
**定义**
1. 所有的界面偏好（如侧栏折叠状态 `collapsedDocs`、当前导航激活项 `activeKey`、缩放比例 `scale`）必须存放在全局变量 `ui` 对象中。
2. `ui` 对象**严禁**混入 `state` 树中。修改 `ui` 对象只调用 `saveUI()` 落盘至 `localStorage`，绝不能调用 `commit()`，以防污染 `historyPast` 撤销栈。
**断言**
```js
ui.navExpanded.files = false;
saveUI();
assert(historyPast.length === 0);
assert(state.nodes === undefined || state._ui === undefined);
```
**关联实现**
`ui` 对象定义、`saveUI()`。
**覆盖用例 id**：

---

### 48. 日历时间网格的指针捕获与吸附（Pointer Capture & Snap）
**定义**
1. 在日历时间网格（`.cal-tg`）中拖动事件（`.cal-tg-ev`）时，**必须**在 `pointerdown` 时调用 `ev.setPointerCapture(e.pointerId)`。
2. 拖拽结束后必须释放捕获。必须通过 `snapHalfMins` 将落点时间吸附到最近的 30 分钟整数倍。
**断言**
```js
const ev = document.querySelector('.cal-tg-ev');
ev.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientY: 0 }));
assert(ev.hasPointerCapture(1) === true);
ev.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 60 }));
assert(ev.hasPointerCapture(1) === false);
assert(state.nodes[ev.dataset.id].time === '08:30');
```
**关联实现**
`bindCalEventDrag()`、`snapHalfMins()`。
**覆盖用例 id**：

---

### 49. 侧栏模块化包裹的原地搬移原则（DOM Reparenting）
**定义**
1. 侧栏模块化初始化（`JU_MODULES.ensureDom()`）时，为了保持原有的事件绑定，**严禁**使用 `innerHTML` 拼接或 `replaceWith` 重建 DOM 树。
2. 必须使用 `document.createElement` 创建外层包裹容器，然后通过 `parentNode.insertBefore` 和 `appendChild` 等原生方法，将原有节点“物理搬移”到新容器中。
**断言**
```js
const originalBtn = document.querySelector('.sb-nav-item[data-nav="files"]');
const originalRef = originalBtn;
JU_MODULES.ensureDom();
assert(document.querySelector('.sb-nav-item[data-nav="files"]') === originalRef);
```
**关联实现**
`JU_MODULES._ensureModuleDom()`。
**覆盖用例 id**：

---
## P0 交互修复：智能拖拽多选与文本选中兼容（2026-10-19） {#p0-interaction}

> 环境前置：错误路径 `e:\APP\归档\6.P0-L3基线` 为历史残留/脑补路径，禁止继续使用；正确项目根目录为 `E:\APP\归档\6.P0-T3基线`。执行前必须先确认该目录下存在 `script_2.js`。

### 50. 拖拽方向智能判定与文本选中/多选互斥
**定义**
在大纲 `.row` 上使用鼠标拖拽时，必须根据位移方向智能判定交互意图，且“选中文字复制”与“跨节点多选”互斥：
1. `mousedown` 记录起始坐标 `(clientX, clientY)` 与触发节点 ID；不立即阻止默认行为，允许事件下发。**适用范围包含 `.text`（contenteditable）内部**：`.text` 内按下同样进入本判定，`outlineDragSelectStart` 不得以 `fromText` 为由提前 return；水平拖动保留原生文字选区，垂直拖动进入多选。
2. `document` 监听 `mousemove`，计算 `deltaX` / `deltaY`。
3. 水平移动为主（`Math.abs(deltaX) > Math.abs(deltaY)`）判定为“选中文字”，不干预浏览器默认行为。
4. 垂直跨行移动为主（`Math.abs(deltaY) > Math.abs(deltaX) + 5`）判定为“多选节点”；立即 `e.preventDefault()` 阻止默认文字选中，执行 `window.getSelection().removeAllRanges()` 清除文本选区，并进入多选刷选模式。
5. 刷选模式下使用 `document.elementFromPoint(e.clientX, e.clientY)` 实时检测鼠标下方 `.row`；未选中行将其节点 ID 加入 `_outlineSel.ids` 并高亮，回退取消则移除。
6. `mouseup` 结束刷选，保存状态并 `forceRender`。
**断言**
```js
// 水平拖拽：不进入多选
assert(Math.abs(deltaX) > Math.abs(deltaY));
assert(multiSelActivated === false);
// 垂直跨行拖拽：进入多选并清除文本选区
assert(Math.abs(deltaY) > Math.abs(deltaX) + 5);
assert(multiSelActivated === true);
assert(window.getSelection().rangeCount === 0);
assert(_outlineSel.ids.has(hitRow.dataset.id));
// 修复点：outlineDragSelectStart 首行不得为 if(fromText)return;
assert(!/^function outlineDragSelectStart\(e,id,fromText\)\{\s*if\(fromText\)return;/.test(outlineDragSelectStart.toString().trim()));
```
**关联实现**
`_buildOutlineBox()`、`renderOutlinePage()`、`.row` 的 `mousedown` / `mousemove` / `mouseup`、`_outlineSel.ids`、`document.elementFromPoint()`、`window.getSelection().removeAllRanges()`、`forceRender()`、`outlineDragSelectStart()`（**不得含 `if(fromText)return;` 早退**）、`outlineDragSelectMove()`、`outlineDragSelectEnd()`、`outlineDragSelectDetach()`、`outlineRowHit()`。
**验证方式**
Playwright 增加用例：模拟鼠标水平拖拽，断言 `multiSelActivated === false`；模拟鼠标垂直跨行拖拽，断言 `multiSelActivated === true`、`rangeCount === 0`、`.multi-sel` 类出现且背景色生效、无边框样式。
**覆盖用例 id**：

---

### 51. 选中态视觉统一为单色背景且无边框
**定义**
所有大纲选中状态（单选 / 多选 / 悬浮）必须统一为单色背景，绝对清除 `outline` / `border` / `box-shadow` 边框视觉：
1. `.row.sel` 与 `.row.multi-sel` 使用完全相同的背景色，例如 `background: var(--accent-soft) !important;`。
2. 彻底清除 `.row.sel`、`.row.multi-sel` 的 `outline`、`border`、`box-shadow`，设置为 `none`。
3. 检查 `.row.sel:hover`、`.row.multi-sel:hover`、`.row:hover` 等悬浮状态；若存在 `outline: 1px solid var(--line-soft)` 等边框，必须一并移除。
4. 选中的行无论是否悬浮，都只能有纯粹单色背景，绝无边框。
**断言**
```js
const sel = getComputedStyle(rowSel);
const multi = getComputedStyle(rowMulti);
assert(sel.backgroundColor === multi.backgroundColor);
assert(sel.outlineStyle === 'none');
assert(sel.borderStyle === 'none' || sel.borderWidth === '0px');
assert(sel.boxShadow === 'none');
assert(multi.outlineStyle === 'none' && multi.boxShadow === 'none');
assert(hoverStyle.outlineStyle === 'none');
```
**关联实现**
包含核心样式的 HTML 或 CSS 文件；`.row.sel`、`.row.multi-sel`、`.row.sel:hover`、`.row.multi-sel:hover`、`.row:hover`；`var(--accent-soft)`。
**验证方式**
Playwright 断言背景色生效且无边框样式；人工检查单选、多选、悬浮三态视觉一致。
**覆盖用例 id**：

---

### 52. 交互修复门禁与哈希登记
**定义**
智能拖拽与选中样式修改完成后，必须执行全量回归与哈希登记，且必须进行真实物理文件操作验证，严禁只在日志中口头声称：
1. 严禁破坏核心业务逻辑，确保全量门禁 100% 绿灯：现行 `node scripts/verify.js all` Exit 0（Node 503 / PW 171 / Bench 7/7，**以 #90 为准**）。
2. 必须维持 **现行 65 方**零漂移（47 方为 [历史快照]），严格运行 `19-verify-hash-registry.mjs`。
3. 重新计算 canonical 字节数，更新 `verify-hash-registry.mjs` 中的期望值，确保零漂移。
4. 更新 `MAINTENANCE.md` 和任务日志，记录真实物理文件操作结果。
**断言**
```js
// 现行门禁
assert(verifyAllExitCode === 0);
assert(nodePassed === 503 && pwPassed === 171 && benchPassed === 7);
assert(hashRegistry.partyCount === 65 && hashRegistry.driftCount === 0);
assert(verifyHashRegistryResult === 'PASS');
// 真实物理文件操作：文件读写 + 哈希复核
const written = fs.readFileSync(canonical);
assert(sha256(written) === hashRegistry.canonicalSha256);
assert(fs.statSync(canonical).size === hashRegistry.canonicalBytes);
assert(physicalFileOperationVerified === true);
```
**关联实现**
`scripts/verify.js`、`verify-hash-registry.mjs`、`19-verify-hash-registry.mjs`、`MAINTENANCE.md`、任务日志。
**验证方式**
运行 `node scripts/verify.js all`（Exit 0）；运行 `node scripts/19-verify-hash-registry.mjs`（65 方零漂移 / PASS）；核对 canonical 字节数与注册表期望值；检查 `MAINTENANCE.md` 与任务日志已记录真实操作结果。
> [历史快照] 2026-10-19 当时为 Node 145 / PW 171 / Bench 7/7 / 47 方；**现行门禁以 #90 为准**。
**覆盖用例 id**：

---
## 侧边栏与回收站多选批量操作（2026-10-20 新增） {#multi-select}

### 53. 多选状态复用与隔离（`_mSel` Model Reuse）
**定义**
侧边栏（`.sb-row`）与回收站（`.file-card`）的批量操作必须复用全局多选模型 `_mSel`，通过 `type` 字段（`'sidebar'` / `'trash'`）实现上下文隔离。
1. Ctrl/Cmd 点击触发 `_mSelClick`，按节点或 `rootId` 切换选中态；Shift 点击触发范围选中。
2. 侧栏仅通过 `data-msid` 和 `.ju-msel` 类名响应选中视觉，不破坏原有 `openNode` 单击导航逻辑。
3. 切换视图或触发普通点击时，必须清空非当前类型的选中状态，防止幽灵选中。
**断言**
```js
assert(_mSel.type === 'sidebar' || _mSel.type === 'trash');
assert(_mSel.ids instanceof Set);
const items = buildContextMenuItems();
assert(items.some(i => i.txt.includes('（所选')));
```
**关联实现**
`_mSel` 对象、`_mSelClick()`、`_mSelHas()`、`_mSelSetOrder()`、`_mSelPaint()`、`makeSidebarRow()`、`renderTrashView()`。
**验证方式**
真实物理点击侧边栏与回收站卡片，按住 Ctrl 和 Shift 验证多选高亮与取消，断言 `_mSel.ids` 内容准确。
> **与 #113–#115 关系（2026-10-23 核对）**：节点级剪贴板（#114 / #115）使用独立 `_outlineSel` 模型，不扩展 `_mSel.type` 枚举（当前仍为 `'sidebar' | 'trash' | 'files' | 'db' | 'tags'`），两者互不干扰。
**覆盖用例 id**：

---

### 54. 回收站批量操作防索引漂移（Index Drift Prevention）
**定义**
在执行回收站批量恢复（`restoreFromTrash`）或批量彻底删除（`purgeTrash`）时，由于操作会实时改变 `state.trashed` 数组的长度和索引，严禁使用预先缓存的索引进行遍历操作。
1. 遍历多选集合中的 `rootId`。
2. 必须在每次执行前，通过 `state.trashed.findIndex(t => t.rootId === id)` 重新获取最新索引。
3. 若找到对应索引，立即执行恢复或删除；若未找到（可能被其他标签页并发删除），则安全跳过。
**断言**
```js
const selIds = ['id1', 'id2', 'id3'];
for (const rid of selIds) {
  const idx = state.trashed.findIndex(t => t.rootId === rid);
  if (idx >= 0) actions.restoreFromTrash(idx);
}
```
**关联实现**
`_trashBatchRestore()`、`_trashBatchPurge()`、`actions.restoreFromTrash()`、`actions.purgeTrash()`。
**验证方式**
选中回收站连续的 3 个条目进行批量删除，断言最终 `state.trashed` 中没有残留，且未发生数组越界错误。
**覆盖用例 id**：

---

### 55. 批量删除的二次确认机制（Batch Deletion Confirmation）
**定义**
无论是侧边栏批量移入回收站，还是回收站批量彻底删除，必须弹窗提示用户确认操作数量，防止误触。
1. 侧栏多选右键 -> “移入回收站（所选 N 个）”。
2. 回收站多选右键 -> “彻底删除所选（N 个）”。
3. 点击后必须调用 `appConfirm`，提示文案需包含具体的数量 N。
**断言**
```js
let confirmCalled = false;
const originalConfirm = appConfirm;
window.appConfirm = (msg, ok) => { confirmCalled = msg.includes('3 个') && ok; };
simulateBatchDelete(3);
assert(confirmCalled === true);
```
**关联实现**
`showTreeContext()`、回收站卡片的 `contextmenu` 事件、`appConfirm()`。
**验证方式**
多选 3 个文档右键点击移入回收站，检查弹窗文案是否为“确认删除所选 3 个节点...”。
**覆盖用例 id**：

---

## 富文本下线与 UI 一致性收敛（2026-10-20 新增） {#richtext-offline}

### 56. 富文本（Word）模式无损下线与数据迁移
**定义**
彻底移除富文本（Word）模式。必须遵循“先迁移数据、再删代码”的原则，防止旧版节点内的 content 字段丢失。
1. 启动迁移：在 `migrateStateObject(st)` 中调用 `migrateWordToOutline(st)`，将旧节点中的 content 按段落拆解回 children，随后删除 `_isWord`、`_wordFlat`、`content` 字段。
2. 清理残留：移除全量代码中的 `VIEW_KIND.WORD`、`renderWordEditor`、`ensureWordInit`、`isWordDoc`，及所有相关的 HTML/CSS。
3. 合并清洗：在 `mergeRemoteState` 处理对端新节点前，必须剔除 `_isWord` / `content` 等旧字段。
**断言**
```js
// (1) 旧 Word 备份导入后，数据转换为大纲子节点，文本无丢失
const before = countTextChars(oldWordBackup);
migrateStateObject(state);
assert(countTextChars(state) >= before);
assert(Object.values(state.nodes).every(n => !n._isWord && !n._wordFlat && n.content === undefined));
// (2) 全文搜索零命中（迁移函数除外）
assert(grepSource(/_isWord|_wordFlat|we-body|word-editor/).filter(f => !isMigrationFn(f)).length === 0);
// (3) 右键菜单无“转为富文本文档”
assert(!contextMenuItems().some(i => i.txt.includes('转为富文本文档')));
```
**关联实现**
`migrateWordToOutline()`、`splitWordContentToParas()`、`migrateStateObject()`、`mergeRemoteState()`。
**验证方式**
导入旧版备份 JSON，断言转化后的大纲子节点文本完整无缺，侧栏结构正常。
**覆盖用例 id**：

---

### 57. 视图导航一致性与按钮激活态
**定义**
1. 返回路径一致：回收站、模板、历史三个视图，顶部必须存在“← 返回”按钮，点击后回到“我的文档”视图。
2. 高亮态一致：点击“模板”或“回收站”按钮时，按钮必须加上 active 类，呈现高亮状态。
3. 数据库缩略图优先：点击左侧“数据库”导航，必须展示多维表格的缩略图文件夹网格（FOLDER 视图），而非直接进入第一张表；若无表格，需有明确的空文件夹提示。
**断言**
```js
const backBtn = [...document.querySelectorAll('.files-toolbar .btn')].find(b => b.textContent.trim() === '← 返回');
assert(backBtn);
assert(document.querySelector('#btnTemplates').classList.contains('active'));
assert(viewOf() === VIEW_KIND.FOLDER);
```
**关联实现**
`renderTrashView()`、`renderTemplatesView()`、`renderHistoryView()`、`updateSidebarActiveState()`、`navTo()`。
**验证方式**
真实物理点击导航按钮与视图切换，验证按钮高亮、返回功能及数据库卡片展示。
**覆盖用例 id**：

---

### 58. 数据库表名实时联动与编辑
**定义**
数据库视图的工具栏必须包含可编辑的表名（`.db-title`）。在 blur 提交后，必须更新 state 中的节点文本，并触发侧栏更新。
**断言**
```js
assert(document.querySelector('.db-toolbar .db-title'));
const title = document.querySelector('.db-toolbar .db-title');
title.textContent = '新表名';
title.dispatchEvent(new Event('blur'));
assert(state.nodes[docId].text === '新表名');
assert(document.querySelector(`.sb-row[data-msid="${docId}"] .sb-label`).textContent === '新表名');
```
**关联实现**
`renderDatabasePage()`、`updateText` 对应的 commit 逻辑。
**验证方式**
双击数据库表名进行修改，断言数据层更新且侧栏文档列表同步刷新。
**覆盖用例 id**：

---

### 59. 侧栏子树多选隔离
**定义**
侧栏的“数据库”与“星标”子项（`.sb-row`），必须补充 `data-msid` 属性，以支持 Ctrl/Cmd 和 Shift 多选。行为需与“我的文档”子树完全一致。
**断言**
```js
const row = document.querySelector('#subDb .sb-row[data-msid]');
assert(row);
simulateCtrlClick(row);
assert(row.classList.contains('ju-msel'));
assert(_mSel.type === 'sidebar' && _mSel.ids.has(row.dataset.msid));
```
**关联实现**
`renderSubDb()`、`renderSubStarred()`、`_mSelClick()`。
**验证方式**
按住 Ctrl 在侧栏数据库子树中点击，断言多选状态生效，无页面跳转。
**覆盖用例 id**：

---
## UI 修复与不变量补充（2026-10-20 固化） {#ui-fix}

### 60. 桌面窗口按钮 API 与安全降级
**定义**
在桌面环境（Tauri / Electron / nw.js）下，顶栏的置顶（`#btnPin`）、最小化（`#btnMin`）、最大化（`#btnMax`）按钮，点击时必须真实调用对应的窗口 API。若处于纯浏览器环境，或 API 调用抛出异常，必须将按钮设置为 `display: none` 隐藏，严禁保留仅弹出 Toast 提示的“假按钮”。
**关联实现**
`bindTopbar()`。
**覆盖用例 id**：

---

### 61. 文件夹/数据库空状态占位强同步
**定义**
文件夹标题（`.doc-header-title`）与数据库表名（`.db-title`）在清空内容时，必须与大纲节点保持行为一致。必须调用 `syncEmptyState()`，在空内容时写入 `data-empty="1"` 属性，以触发 CSS 的 `::before` 伪元素显示“未命名”等灰色占位提示。
**关联实现**
`renderFolderHeader()`、`renderDatabasePage()`、`syncEmptyState()`。
**覆盖用例 id**：

---

### 62. 独立视图返回按钮统一渲染
**定义**
星标、模板、回收站、历史四个子视图的“← 返回”按钮，必须统一调用 `renderTitleWithBack()` 辅助函数生成。返回按钮的位置固定在标题行左侧、水平对齐；点击行为必须回退到资料库根节点（`ui.view = 'auto'; ui.currentDocId = state.rootId;`）。
**关联实现**
`renderTitleWithBack()`、`renderStarredView()`、`renderTemplatesView()`、`renderTrashView()`、`renderHistoryView()`。
**覆盖用例 id**：

---

### 63. 导航选中态严格执行 #39（撤销左侧色条尝试）
**定义**
为了与不变量 #39 保持一致，严禁任何情况下给侧栏导航项或文档树行添加左侧色条或粗边框。本轮修复中曾尝试给导航选中态添加左侧 3px 竖色条以增强区分度，该方案因违背 #39 已废弃并回退。导航选中态与文档选中态必须依赖已有的背景色变化（如 `var(--accent-soft)`）和字体加粗来区分。
**关联实现**
CSS `.sb-nav-item.active`、`.sb-row.active`。
**覆盖用例 id**：

---

### 64. 失焦事件日期解析去重
**定义**
日历待办卡片（`.cal-node .text`）失焦（blur）时，必须先判断 `finalHtml` 是否与当前 `state` 中的文本一致。仅当文本真正发生变更时，才允许调用 `parseNaturalDate()` 解析自然语言日期；若文本未变（例如仅点击输入框后直接失去焦点），严禁重新解析，防止日期被动跳转。
**关联实现**
`renderCalNode()` 内的 blur 监听、`parseNaturalDate()`。
**覆盖用例 id**：

---

### 65. 底部折叠三钮默认透明度（刻意设计保留）
**定义**
底部折叠三钮（`.main-toggle`）默认的 `opacity: 0.3` 属刻意设计（降低非活动态视觉噪声），不得修改为更高透明度或加底色。鼠标悬浮时 `opacity` 恢复为 1 的交互保留。
**关联实现**
CSS `.main-toggle`。
**覆盖用例 id**：

---

### 66. 模态弹窗背景 inert 状态强同步
**定义**
所有通过 DOM 手写创建的模态弹窗（如 `openThemeSelector`），在 push 进入 `_modalStack` 后，必须显式调用 `_syncAppInert()`，确保背景内容（`#app`）被加上 `inert` 属性不可点击；关闭弹窗时同步解除。
**关联实现**
`openThemeSelector()`、`_syncAppInert()`。
**覆盖用例 id**：

---

### 67. 标签计数回调去重与视图维护注释
**定义**
1. `_l7TagCountText` 必须引入 `_tagCountPending` 标志，防止侧栏高频重绘时重复后台登记统计回调。
2. `_lastViewKey` 的计算逻辑必须统一封装为 `_computeViewKey()`，严禁在主渲染与早退分支中重复编写。
3. `renderSlidesView` 中的右侧栏编辑区挂载点选择器，必须保留维护注释；`#main::before` 的层级关系与 `.main-toggle` 的 `position: fixed` 定位必须保留注释说明。
**关联实现**
`_l7TagCountText()`、`_computeViewKey()`、`renderSlidesView()`、CSS 注释。
**覆盖用例 id**：

---
## 代码-清单对拍修复登记（修复登记，不计入不变量总数） {#fix-registry}

> 本章 #68–#74 为**修复登记**，只作历史追溯，**不计入不变量总数**（现行 106 条已排除）。
> 背景：2026-10-20 对 `v2.0-t3.html` 与不变量清单 #1–#67 进行对拍检查，发现 4 项明确违反 + 2 项软违反 + 1 项清单自身矛盾，已全部修复并固化。#21 与 #37 属"清单自身修正"已原地更新，本登记仅记录修复历史与验证方式。

### 68. 修复登记：导航选中态回退左侧色条（对齐 #63）
**修复内容**：删除 `v2.0-t3.html` 中 `.sb-nav-item.active::before` 及其夜间版本共 2 条 CSS 规则，导航选中态回归纯背景色 + 加粗。
**关联不变量**：#39、#63
**验证方式**：`.sb-nav-item.active` 不得存在 `::before` 伪元素；grep `sb-nav-item.active::before` 返回 0 结果。
**覆盖用例 id**：

### 69. 修复登记：侧栏数据库/星标子树多选（对齐 #59）
**修复内容**：`renderSubDb()` 与 `renderSubStarred()` 的行构造改为复用 `makeSidebarRow(n.id)`，使两棵子树获得 `data-msid`、Ctrl/Cmd 多选、Shift 范围选择、`ju-msel` 视觉回填。
**关联不变量**：#53、#59
**验证方式**：按住 Ctrl 点击行，应加 `.ju-msel` 且不触发 `openNode`；`_sbVisibleIds()` 包含两棵子树的行。
**覆盖用例 id**：

### 70. 修复登记：富文本多行粘贴强制拆分（对齐 #36）
**修复内容**：`bindOutlineText()`、`bindNoteText()`、`renderCalNode()` 三处 paste 监听移除 `&& !parsed.hasRichFormat` 条件，改为 `parsed.lines.length > 1` 即拆分。
**关联不变量**：#36、#37
**验证方式**：从 Word 或网页复制含加粗标签的多段文本粘贴到大纲，应生成多个兄弟节点；grep `!parsed.hasRichFormat` 返回 0 结果。
**权衡说明**：行内富文本格式在拆分后不保留（内部纯文本 `esc` 转义），属独立优化。
**覆盖用例 id**：

### 71. 修复登记：IME 守卫前移至首行（对齐 #41）
**修复内容**：`bindOutlineText()` 与 `bindNoteText()` 的 keydown 处理器中，将 `if(e.isComposing||e.keyCode===229)return;` 移到 `const n=N(id);if(!n)return;` 之前。
**关联不变量**：#41
**验证方式**：中文输入法组字状态下按 Enter 不得触发新建节点；代码审查确认 IME 判断位于 keydown 回调首行。
**覆盖用例 id**：

### 72. 修复登记：手写模态显式同步 inert（对齐 #66）
**修复内容**：`appPrompt`、`openCalTimeModal`、`showHelp`、`openAddToCalendarDialog`、`openAddToDbDialog`、`promptUnlock`、`showSetPasswordDialog`、`openFeedbackDialog`、`openImportDialog` 共 9 个手写模态，在 `_modalStack.push(modal);` 之后补 `_syncAppInert();`。
**关联不变量**：#66
**验证方式**：打开上述任一弹窗后，`#app` 有 `inert`；关闭后移除。
**覆盖用例 id**：

### 73. 修复登记：夜间主题 token 对齐代码（对齐 #21）
**修复内容**：#21 断言表夜间三行改为 `--bg=#0A1929` / `--bg-soft=#152A4A` / `--bg-panel=#1D355E`；断言代码同步三值；派生约束 2 重写为"四周浅、中间深"三层描述。
**关联不变量**：#21
**验证方式**：夜间主题下读取 computed style 匹配新值。
**覆盖用例 id**：

### 74. 修复登记：断言用例 HTML 自相矛盾（对齐 #37）
**修复内容**：#37 断言中 `mockDataTransfer` 的 `html` 字段去掉行内加粗标签，使 `parsePasteLines` 不再置 `hasRichFormat=true`。
**关联不变量**：#37、#36
**验证方式**：执行 #37 断言块，`parsed.lines.length === 2` 与 `!parsed.hasRichFormat` 同时通过。
**覆盖用例 id**：

---

## 内容区宽度自适应（2026-10-20 新增） {#width-adaptive}

### 75. 主内容区宽度自适应与两边空白收敛
**定义**：在桌面宽屏下，主内容区必须随可用宽度扩展，减少两侧空白，同时保持阅读与操作稳定：
- 根元素变量 `--content-max` 与 `--content-max-doc` 均已自适应（详见 #76），不再设固定像素上限。
- 大纲、数据库、文件夹、打印预览、日历页均使用 100% 比例或明确上限，不得写死 1100px、920px、1400px。
- 底部折叠三钮仍为 `position:fixed` 且默认 `opacity:0.3`；导航选中态仍仅背景色，不得出现左侧色条；大纲选中/多选仍为单色背景无边框。

> **口径废弃提示（2026-10-21）**：本条正文中的 `min(1600px, 100%)` 等旧值已完全移除。宽度口径严格遵循 #76。

**断言**：
```js
// 1920x1080：大纲实际宽度 = 主内容内容宽度 - 40px
assert(Math.abs(outlineWidth - (contentInnerWidth - 40)) <= 1);
// 2560x1440：大纲宽度 = 可用内容宽度 - 40px（无 1600px 上限）
assert(Math.abs(outlineWidth - (contentInnerWidth - 40)) <= 1);
assert(document.documentElement.scrollWidth <= window.innerWidth);
assert(getComputedStyle(toggleBtn).position === 'fixed');
assert(toggleBtn.style.left === 'calc(50vw - 40px)');
assert(!document.querySelector('.sb-nav-item.active::before'));
```
**关联实现**：`v2.0-t3.html` 的 `:root` 变量；各视图容器的 `max-width`；主内容区 padding。
**验证方式**：真实浏览器 1920x1080 与 2560x1440 截图并读取 computed style；运行 `node scripts/verify.js all`；运行 `node scripts/19-verify-hash-registry.mjs`。
**覆盖用例 id**：

---

## 极宽屏幕自适应（2026-10-20 新增） {#ultrawide}

### 76. 极宽屏幕自适应（带鱼屏/4K+ 屏适配）
**定义**：在任意超宽屏幕（如 3440x1440、4K+）下，主内容区容器必须随可用宽度 100% 扩展，消除固定像素上限造成的两侧超大空白；正文纯文本区域设置 1400px 的阅读限宽以保证舒适度，多列组件（如数据库、看板）不受限宽影响。
- 根元素变量 `--content-max` 与 `--content-max-doc` 均为 `100%`；日历页 `.cal-page` 最大宽度为 `100%`；大纲正文 `.outline .text` 最大宽度为 `min(100%, 1400px)` 且保持左对齐；主内容区左右 padding 保持 20px。

**断言**：
```js
assert(Math.abs(outlineContainerWidth - contentInnerWidth) <= 1);
assert(textRowWidth <= 1400);
assert(document.documentElement.scrollWidth <= window.innerWidth);
assert(getComputedStyle(toggleBtn).position === 'fixed');
assert(toggleBtn.style.left === 'calc(50vw - 40px)');
assert(!document.querySelector('.sb-nav-item.active::before'));
assert(!document.querySelector('.sb-row.active::before'));
assert(dbTableWidth >= contentInnerWidth - 2);
```
**关联实现**：`v2.0-t3.html` 的 `:root` 变量 `--content-max` / `--content-max-doc`；`.cal-page` 的 `max-width`；`.outline .text` 的 `max-width`。
**验证方式**：真实浏览器或 Playwright 在 3440x1440 视口下截图并读取 computed style；运行 `node scripts/verify.js all`；运行 `node scripts/19-verify-hash-registry.mjs`。
**覆盖用例 id**：tests/t3-ultrawide-layout.spec.ts · 3440x1440 / 3840x1080

---
## 幻灯片视图自适应布局（2026-10-20 新增） {#slides-layout}

### 77. 幻灯片视图自适应布局与信息归位
**定义**：幻灯片视图下，左侧缩略图栏须为独立 flex 纵向布局，滚动区域与页码信息分离，页码固定于栏位底部；主演示区须占用剩余全部可用高度，保持 16:9 比例最大化显示，且水平居中、与两侧边缘留白均匀；主演示区必须与左侧缩略图保持严格的顶部水平对齐（以第一页缩略图顶边为基准）；主演示区与左侧缩略图之间的最小间距为 8px；页码栏末尾严禁包含冗余说明字符。
**断言**：
```js
assert(document.querySelector('.ju-sl-info').parentElement.classList.contains('ju-sl-rail'));
assert(getComputedStyle(document.querySelector('.ju-sl-main')).justifyContent === 'flex-start');
assert(getComputedStyle(document.querySelector('.ju-sl-main')).alignItems === 'flex-start');
assert(document.documentElement.scrollHeight <= window.innerHeight + 1);
assert(document.documentElement.scrollWidth <= window.innerWidth + 1);
assert(!document.querySelector('.ju-sl-info').textContent.includes('演示模式'));
assert(Math.abs(stageRect.top - firstThumbRect.top) <= 1);
assert(getComputedStyle(document.querySelector('.ju-sl-wrap')).gap === '8px');
assert(getComputedStyle(document.querySelector('.ju-sl-rail')).paddingTop === '0px');
assert(getComputedStyle(document.querySelector('.ju-sl-main')).paddingTop === '0px');
```
**关联实现**：`.ju-sl-wrap` / `.ju-sl-rail` / `.ju-sl-rail-inner` / `.ju-sl-main` / `.ju-sl-stage` 的 CSS；`JU_SLIDES.render` 与 `_mountRail` 的 DOM 挂载逻辑。
**验证方式**：真实浏览器切换幻灯片视图截图，读取 computed style。

> **补充口径（旧 · 已由 r24 Grid 口径取代）**：`.ju-sl-stage` 的 16:9 宽度上限以容器查询单位表达为 `width:min(100%,calc(100cqh * 16 / 9))`（`.ju-sl-main` 设 `container-type:size`）。该写法不含任何视口 / 顶栏写死扣减。**该口径自 r24 起已由下述 CSS Grid 口径取代，仅作历史记录保留。**

> **补充口径（2026-10-20 · r24 幻灯片视图微调，已被 #93 取代）**：本条的「垂直居中」口径自本次起由「与左侧缩略图顶部水平对齐」取代——`.ju-sl-main` 的 `justify-content` / `align-items` 由 `center` 改为 `flex-start`，舞台水平居中改由 `.ju-sl-stage` 的 `margin:0 auto` 保证；`.ju-sl-wrap` 的 `gap` 由 16px 减半为 8px；`.ju-sl-rail` 的 `padding-top` 由 6px 归 0；页码栏删除末尾冗余说明文案。16:9 比例与最大化显示口径不变，与 #75 / #76 无冲突。

> **执行说明（2026-10-21）**：本条以清单为准，代码侧 `.ju-sl-main` 的 `align-items`、`.ju-sl-rail` 的 `padding-top`、`.ju-sl-stage` 的 `margin` 三处 CSS 需按本条修正，不在清单变更范围。**自 #93 起，布局结构已全面替换为 Flex 整体居中模型，此处保留仅作历史追溯。**
**覆盖用例 id**：

---
## 导入管线二进制拒绝与 docx 段落层级导入（2026-10-20 新增） {#import-pipeline}

### 78. 导入二进制格式拒绝
**定义**：`handleImportFiles` 必须在读取文件前按扩展名前置过滤，`IMPORT_BINARY_EXTS` 命中的扩展名一律拒绝并给出明确提示，不得落入 `importOutline` 默认分支。`IMPORT_BINARY_EXTS` 现行 47 个扩展名：pdf/png/jpg/jpeg/gif/webp/bmp/svg/ico/tif/tiff/psd/ai/sketch/fig/rtf/odt/pages/wps/xlsx/xls/pptx/ppt/mp3/mp4/mov/avi/mkv/wav/flac/zip/rar/7z/tar/gz/exe/msi/dmg/pkg/iso/bin/apk/ttf/otf/woff/woff2/eot。
> **图片 7 项例外见 #83**（png/jpg/jpeg/gif/webp/bmp/svg 先于本拒绝判断消费，内联为 data URL）。

**断言**：
```js
assert(IMPORT_BINARY_EXTS.has(ext) === true);
assert(callOrder.indexOf('rejectBinary') < callOrder.indexOf('readFile'));
assert(!root.children.some(id => state.nodes[id].text.includes(fileName)));
```
**关联实现**：`handleImportFiles()`、`IMPORT_BINARY_EXTS`（`v2.0-t3.html:18243 / :18145`）；拒绝文案「不支持导入该格式（二进制），请先在对应软件中另存为 Markdown / HTML / 纯文本后再导入」（`:18248`）。
**验证方式**：导入 pdf/zip/xlsx 各 1 个文件，root 下不新增任何节点，toast 提示不支持该格式。
**补充口径**：db/sqlite/sqlite3 仍走桌面版独立分支（`:18267-18278`），本条不改变其行为；JSON / HTML / OPML / ICS 文本分支（`:18280-18350`）不变；图片 7 项按 #83 例外。

> **类型**：行为不变量　**状态**：已验证
**覆盖用例 id**：

### 79. 二进制乱码检测
**定义**：`readFile` 解码后若 `looksLikeBinaryText` 命中（坏字符比例 > 5%），必须抛出文件疑似二进制格式错误，不得把乱码文本作为导入内容。判定口径：取样前 2048 字符；0xFFFD 计 1，0x00 与 0x00–0x08 / 0x0E–0x1F 控制字符计 2；bad/n > 0.05 即判为二进制。
**断言**：
```js
assert(looksLikeBinaryText(binarySample) === true);
await assert.rejects(readFile(binaryFile), /文件疑似二进制格式/);
```
**关联实现**：`looksLikeBinaryText()`、`readFile()`（`:17494 / :17505`）；解码顺序 utf-8(fatal) → gbk → utf-8（`:17516-17520`）；64MB 上限 `MAX_IMPORT_BYTES`（`:17493 / :17508`）。
**验证方式**：用 pdf 二进制强制走文本分支，`looksLikeBinaryText` 返回 true 且 `readFile` 抛错。

> **类型**：行为不变量　**状态**：已验证
**覆盖用例 id**：

### 80. docx 段落层级导入
**定义**：`importDocx` 解析 `word/document.xml`，按 `w:pStyle` 的 `Heading1-6` 映射大纲层级，正文段落（无 heading）挂到最近标题节点下；未找到 `document.xml` 时抛错且不得产生半成品内容节点。
**断言**：
```js
const levels = parsedParagraphs.map(p => p.level);
assert(levels.every(l => l >= 0 && l <= 6));
assert(root.children.length > 0);
assert(!partialContentNodes.length);
```
**关联实现**：`importDocx()`、`_unzipEntry()`（`:18193 / :18150`）；ZIP 中央目录 + method 0/8 分支，method=8 依赖 `DecompressionStream('deflate-raw')`（`:18181-18186`）；条目标题经 `esc()` 转义后 `addNodeTo`（`:18229 / :18235`）。
**验证方式**：含 H1/正文/H2/正文 的 docx 导入后，H1 顶层、正文与 H2 为 H1 子节点、第二个正文为 H2 子节点。
**补充口径**：docx 分支先 `_createImportDoc(f.name)` 再 `importDocx`（`:18254-18255`），故解析异常时可能残留一个不含内容节点的空容器文档；本条的「不得产生半成品节点」限定为内容节点。

> **类型**：约束　**状态**：已验证
**覆盖用例 id**：

### 81. 旧版 .doc 明确拒绝
**定义**：`.doc` 扩展名必须直接拒绝并提示另存为 `.docx` 或 `.html`，不得尝试解析。
**断言**：
```js
assert(ext === 'doc');
assert(callOrder.indexOf('rejectDoc') < callOrder.indexOf('readFileArrayBuffer'));
assert(!root.children.some(id => state.nodes[id].text.includes(fileName)));
```
**关联实现**：`handleImportFiles()` 的 `.doc` 分支（`:18263`）；错误文案含「旧版 .doc 二进制格式无法解析，请用 Word 打开另存为 .docx 或 .html 后再导入」。
**验证方式**：导入 `.doc` 文件，root 下不新增节点，toast 提示旧版格式无法解析。

> **类型**：行为不变量　**状态**：已验证
**覆盖用例 id**：

---
## 导入弹窗 UI 与图片导入（2026-10-21 新增） {#import-ui}

### 82. 导入弹窗支持格式声明与标题栏图标
**定义**：`openImportDialog` 弹窗标题栏仅显示文字「导入内容」，不得携带 ↧ 等箭头图标；虚线拖拽区底部必须显示一行支持格式说明；`#impFile` 的 `accept` 必须覆盖实际可导入的全部扩展名。
**断言**：
```js
const head = document.querySelector('.modal-head').textContent.trim();
assert(head === '导入内容');
assert(!/[\u2190-\u21FF\u2900-\u297F]/.test(head));
const fmt = [...document.querySelectorAll('#impDrop *')].find(el => el.textContent.trim() === '支持 Markdown / 文本 / OPML / HTML / Word(docx) / JSON / ICS / SQLite');
assert(fmt && fmt.style.fontSize === '0.75em');
assert(document.querySelector('#impFile').getAttribute('accept').split(',').length === 20);
```
**关联实现**：`openImportDialog()` 的 `modal.innerHTML` 模板（`v2.0-t3.html:18470` 起）；样式沿用行内 style 与 `:root` 变量。
**验证方式**：真实浏览器点击左侧 `#btnImport`，回读 `.modal-head` / `#impDrop` / `#impFile` 的文本、computed style 与属性；并以真实文件触发 filechooser 校验 accept 生效。
**补充口径**：说明行只承载已实现支持的文本类格式文案；图片扩展名单独支持，见 #83；桌面版 SQLite 分支行为按 #78 补充口径维持不变。虚线拖拽区**不要求** ↧ 图标（按 2026-10-21 决策删除该要求）。

> **类型**：行为不变量　**状态**：已验证
**覆盖用例 id**：

### 83. 图片导入（内联 data URL）
**定义**：`handleImportFiles` 必须先于 `IMPORT_BINARY_EXTS` 拒绝判断消费 7 个图片扩展名（png/jpg/jpeg/gif/webp/bmp/svg），把图片内联为 data URL 写入新建的导入容器文档（1 个图片文件 = 1 个容器文档 + 1 个内容节点）；图片不得落入 `importOutline` 文本分支，也不得被当作二进制格式拒绝。
**断言**：
```js
assert(IMG_IMPORT_EXTS.size === 7);
assert(callOrder.indexOf('consumeImage') < callOrder.indexOf('rejectBinary'));
const text = state.nodes[contentId].text;
assert(text.startsWith('<img src="data:image/'));
assert(sanitizeHtml(text).startsWith('<img src="data:image/'));
assert(text.length <= 700000);
assert(document.querySelector(`[data-id="${contentId}"] img`).naturalWidth > 0);
assert(ui.view === 'auto' && ui.currentDocId === containerDocId);
```
**关联实现**：`handleImportFiles()` 图片分支（`:18304`）、`IMG_IMPORT_EXTS`（`:18153`）、`readFileDataURL()`（`:18155`）、`_imgDataUrlWhitelisted()`（`:18166`）、`_imgRasterToPng()`（`:18171`）、`_imgToPngDataUrl()`（`:18185`）、`syncEmptyState()`（`:8444`），均位于 `v2.0-t3.html`。
**验证方式**：真实浏览器导入 2×2 PNG（节点文本以 `<img src="data:image/png;base64,` 开头、渲染 `naturalWidth>0`、`data-empty` 为空、无失败 toast）；导入 64×48 SVG（光栅化为 PNG 后 `naturalWidth=64`）；导入 data URL > 700,000 字符的噪声 PNG（节点数不变、toast 含「图片过大」）；同时回归 `.md` 导入。
**补充口径**：本条自 R27 起取代不变量 #78 对 7 个图片扩展名的拒绝口径及「必须先于任何读取」的顺序约束；#78 的 `IMPORT_BINARY_EXTS` 集合本体（47 项）保持不变，其余 40 项一律维持原拒绝行为；#79 只作用于文本分支，图片分支不读取文本，不受影响；#80 与 #81 不变。

> **类型**：行为不变量　**状态**：已验证
**覆盖用例 id**：

---
### 84. 左侧边栏折叠与节点行对齐
**定义**：左侧边栏折叠必须做到「视觉收起 + 让出布局空间 + 状态持久化 + 收起态排布可控 + 节点行图标文字同基线」，具体口径如下：

1. **折叠生效与让出空间**：点击 `#btnToggleLeft` 后，`#sidebarLeft` 必须加上 `.collapsed` 且视觉完全收起，并让出其在布局中占用的宽度。桌面（>768px）以负位移实现：`#sidebarLeft.collapsed{margin-left:calc(var(--sidebar-left-w,210px) * -1)}`，收起后 `#sidebarLeft` 的右边界必须落在视口左缘（`getBoundingClientRect().right ≤ 0`），主内容区左边界必须归 0；≤768px 抽屉模式以 `transform:translateX(-100%)` 移出视口。负位移必须为负值——原缺陷形态为 calc 因变量不可解析而整条失效、margin-left 回落 0。
2. **210px 兜底与不可解析自愈**：收起态 CSS 必须保留 210px 兜底（`var(--sidebar-left-w,210px)`）；`bindMainToggles()` 的 `syncL()` 在收起时以 `_sbLeftWMarginResolvable()` 探测 `calc(var(--sidebar-left-w) * -1)` 是否可解析为负 px，**仅在不可解析时**以侧栏实测宽度回写 `--sidebar-left-w`（整数 px），可解析时保持 calc 不动；探测抛异常按「可解析」处理，不写值。
3. **持久化一致**：`ui.sidebarLeftCollapsed` 随 `saveUI()` 落盘、`loadUI()` 读回；刷新后 `#sidebarLeft.collapsed`、`body.sb-left-collapsed`、`#btnToggleLeft.collapsed` 与 `ui.sidebarLeftCollapsed` 四者必须一致。≤768px 启动时默认置 true。
4. **收起态排布**：`#sidebarLeft.collapsed` 下必须打通 `#sidebarLeft` → `.sb-nav-block` → `.sb-nav-body` 的高度链，使 `.sb-nav-item` 垂直居中、`margin-bottom:0`、`width:100%`；收起态 `.sb-search` 与 `.sb-icon-row` 必须 `display:none`。
5. **节点行对齐**：`.sb-arrow.leaf` 的占位宽度必须与 `.sb-arrow` 一致为 22px（不得为 12px）；同一行内 `.sb-arrow(22px)` + `.sb-icon(15px)` + `.sb-label` 保持 flex 单行基线，叶子节点行与同层父节点行的 `.sb-icon` 左边界、`.sb-label` 左边界差均 ≤1px；层级缩进仍由 `.sb-children` 的 `padding-left:14px` 表达，不通过改箭头宽度实现。

> **口径废弃提示（2026-10-21）**：本条第 5 点中关于「`.sb-arrow.leaf` 的占位宽度必须与 `.sb-arrow` 一致为 22px」及「层级缩进由 `.sb-children` 的 `padding-left:14px` 表达」的断言已废弃。因需求变更为「取消缩进与严格左对齐」，实际测试请以最新不变量 **#91** 的 24px 宽度与 0 缩进口径为准。**本条第 5 点中的 15px 偏移亦由 #91 取代。** 本条断言已删除 `offsetWidth === 22` 一行，以 #91 为准。

**断言**：
```js
// (1) 收起态
assert(document.querySelector('#sidebarLeft').classList.contains('collapsed'));
const ml = getComputedStyle(document.querySelector('#sidebarLeft')).marginLeft;
assert(parseFloat(ml) < 0 && Math.abs(parseFloat(ml)) === document.querySelector('#sidebarLeft').offsetWidth);
assert(document.querySelector('#sidebarLeft').getBoundingClientRect().right <= 0);
assert(document.querySelector('#content').getBoundingClientRect().left === 0);
assert(document.body.classList.contains('sb-left-collapsed'));
assert(ui.sidebarLeftCollapsed === true);
// (2) 展开态
assert(parseFloat(ml) === 0);
assert(document.querySelector('#content').getBoundingClientRect().left === document.querySelector('#sidebarLeft').offsetWidth);
// (3) 空间让出
assert(document.documentElement.scrollWidth <= window.innerWidth);
// (4) 持久化：刷新后一致
// (5) 对齐（已删除 offsetWidth === 22 一行，以 #91 的 24px 为准）
assert(Math.abs(leafIconRect.left - parentIconRect.left) <= 1);
assert(Math.abs(leafLabelRect.left - parentLabelRect.left) <= 1);
// (6) 收起态排布
assert(Math.abs(navItemTopGap - navItemBottomGap) <= 1);
assert(getComputedStyle(document.querySelector('.sb-search')).display === 'none');
assert(getComputedStyle(document.querySelector('.sb-icon-row')).display === 'none');
```
**关联实现**：`bindMainToggles()`（`v2.0-t3.html:18588`）、`syncL()` 与不可解析探测 `_sbLeftWMarginResolvable()`（`:18605 / :18596`）；`#sidebarLeft` 与 `#sidebarLeft.collapsed` 的 CSS（`:108 / :109` 含 210px 兜底、`:125-135` 收起态高度链与垂直居中、`:944-945` ≤768px 抽屉 transform）；`.sb-arrow`（`:181`）、`.sb-arrow.leaf`（`:186`）、`.sb-icon`（`:188`）、`.sb-label`（`:190`）、`.sb-children`（`:192`）；`renderSidebar()`（`:14705`）、`makeSidebarRow()`（`:14947`）；`ui.sidebarLeftCollapsed` 默认值 / `loadUI` / `saveUI`（`:5744 / :5820 / :5874`）与启动态还原（`:21064-21065`）。
**验证方式**：真实浏览器（1440x900）点击 `#btnToggleLeft` 3 次，逐次读取 classList、computed margin-left / transform、getBoundingClientRect、aria-pressed 与 `ui.sidebarLeftCollapsed`；收起态刷新页面校验持久化；多视口 1280 / 1440 / 1600 / 1920 / 2560 / 3440 各测一次；拖宽至 260px 与 `--ui-scale=1.4` 各测一次；注入 `--sidebar-left-w:abc` 复测自愈，注入 `--sidebar-left-w:150px` 复测 calc 不被替换。R28 探针证据落盘：`_环境与调试/r28-sidebar-probe-2026-10-21.txt`、`r28b-sidebar-multiw-2026-10-21.txt`、`r28c-sidebar-unresolvable-after-canonical-2026-10-21.txt`。
**补充口径**：展开态 `#sidebarLeft` 宽度仍由 `--sidebar-left-w:calc(210px * var(--ui-scale,1))` 给出；收起态 width 不变、仅靠负位移移出；收起态自愈写回只改 `--sidebar-left-w` 的 px 值，不改侧栏拖动调宽逻辑。导航区 `.sb-nav-item` 的折叠小箭头（chev，实测宽 10.4px）不属于 `.sb-arrow`；**导航图标与首层树行图标之间的 15px 偏移自 #91 起由严格左对齐取代**（本条不再维持该偏移）。`.sb-arrow.leaf` 的 `opacity:0` 与 `::before` 热区禁用保持不变。

> **类型**：行为不变量　**状态**：已验证（R28 真实浏览器探针）
**覆盖用例 id**：

---

## 标签调色板差异化（2026-10-21 新增） {#tag-palette}

### 85. 标签调色板差异化与低灰度约束
**定义**：`--tag-palette` 必须包含 8 个高区分度、中浅明度、低灰度的颜色，任意两个颜色的 HSL 色相差不小于 25°，视觉上互不接近；`--tag-auto-gradient` 需同步适配；已单独设置颜色的标签（`state.tagColors`）不受调色板变更影响；`getTagColor()` 哈希回退必须只从 `--tag-palette` 取色，不得硬编码。
**断言**：
```js
const palette = readCssVars('--tag-palette');
assert(palette.length === 8);
for (let i = 0; i < palette.length; i++) {
  for (let j = i + 1; j < palette.length; j++) {
    const dh = Math.abs(hue(palette[i]) - hue(palette[j]));
    assert(Math.min(dh, 360 - dh) >= 25);
  }
}
palette.forEach(c => { assert(saturation(c) >= 55 && lightness(c) >= 45 && lightness(c) <= 65); });
assert(!getTagColor.toString().includes('#'));
```
**关联实现**：`--tag-palette`、`--tag-auto-gradient`、`getTagColor()`、`TAG_COLORS`、`openTagPalette()`。
**验证方式**：视觉检查色板 8 个色块互不接近；已有标签颜色保持不变；运行全量门禁。
**补充口径**：本条只约束标签调色板，不改变 #21、#9 / #10、#51、#39 / #63。与既有条目不冲突。
**覆盖用例 id**：

---
## 日历待办勾选框与标签色统一（2026-10-21 新增） {#cal-checkbox}

### 86. 日历待办勾选框与标签色统一
**定义**：在日历待办列表（`renderCalNode`）中，独立标签圆点（`.cal-tag-dot`）的 DOM 结构必须被移除。勾选框（`.cal-checkbox`）必须接管标签颜色的展示：未勾选时边框颜色为标签主色（若无标签则为默认色），勾选后背景色与边框色均为标签主色。
**断言**：
```js
assert(document.querySelector('.cal-tag-dot') === null);
const cb = document.querySelector('.cal-checkbox');
assert(cb.style.getPropertyValue('--cb-color') === expectedTagColor);
cb.checked = true;
assert(getComputedStyle(cb).backgroundColor === expectedTagColor);
```
**关联实现**：`renderCalNode()`、`.cal-node .cal-checkbox` 相关的 CSS 规则。
**验证方式**：在日历视图中真实点击勾选/取消带标签的待办，目视检查勾选框的边框和背景是否随标签色同步变化，且无多余圆点。
**补充口径**：保留 `.cal-tag-dot` 的 CSS 定义以防其他隐藏视图使用，但渲染待办列表时必须不再生成该 DOM 节点。本条不改变 #9 / #10。
**覆盖用例 id**：

---

## 勾选框与标签圆点浅色同源（2026-10-21 新增） {#checkbox-tagdot}

### 87. 勾选框与标签圆点浅色同源规范
**定义**：为保持界面视觉统一，日历视图中的待办勾选框（`.cal-checkbox`）与侧边栏标签圆点（`.sb-tag-dot`）必须采用与日历时间网格事件块（`.cal-tg-ev.tagged`）一致的“浅色底+深色边框”风格，且颜色数据源必须通过 CSS 变量绑定，禁止使用内联硬编码纯色背景。
**断言**：
```js
const dot = document.querySelector('.sb-tag-dot');
assert(dot.style.getPropertyValue('--tag-color'));
assert(!dot.style.backgroundColor);
const cbCss = getComputedStyle(document.querySelector('.cal-checkbox:checked'));
assert(cbCss.backgroundImage.includes('color-mix') || cbCss.backgroundColor.includes('color-mix'));
assert(getComputedStyle(document.querySelector('.cal-checkbox:checked'), '::after').borderColor === expectedTagColor);
```
**关联实现**：`renderSubTags()`、`openTagPicker()`、`.cal-node .cal-checkbox` 相关的 CSS 规则、`.sb-tag-dot` 相关的 CSS 规则。
**验证方式**：在浏览器中勾选带标签的待办，并观察左侧标签树，确认圆点与勾选框的背景为浅色，边框/打勾为对应标签深色，且视觉上与上方时间网格事件块一致。
**补充口径**：本条不改变标签的核心数据逻辑（#9 / #10），仅改变其视觉表达方式。为兼容旧版浏览器，保留纯色回退声明。对 t17 测试用例的 DOM 断言进行同步更新以匹配变量绑定。
**冲突调整记录**：#86 的 DOM 断言继续有效；但 #86「勾选后背景色与边框色均为标签主色」的纯色填充表述，自本条起由「32% color-mix 浅色底 + var(--cb-color) 深色边框/打勾」取代。本条不修改 #86 条文原文，出现歧义时以本条为准。与 #21、#39 / #63、#51、#85 均无冲突。

> **类型**：视觉不变量　**状态**：已登记
**覆盖用例 id**：

---

## 日历网格接入模块化体系（2026-10-21 新增） {#cal-modules}

### 88. 日历网格模块化与模块间距 5px
**定义**：日历视图顶部的日历网格区域（`.cal-top`：年 / 月 / 周视图切换、前后翻页、月视图 `.cal-grid`、周视图时间网格 `.cal-tg`、年视图 `.year-grid`）必须作为 `.cal-modules` 容器中的首个模块（`data-key="calendar"`）呈现，与记事本 / 当日待办 / 系统日志 / 统计四个模块同处一个容器，并同样支持标题行拖拽排序、右下角缩放、✕ 删除与「+ 添加模块」恢复；模块间距固定为 5px。
**断言**：
```js
assert(CAL_MODULE_KEYS[0] === 'calendar');
assert(calModuleTitle('calendar') === '日历');
assert(CAL_MODULE_KEYS.length === 5);
assert(document.querySelector('.cal-page > .cal-top') === null);
assert(document.querySelector('.cal-module[data-key="calendar"] > .cal-module-body .cal-top'));
assert(getComputedStyle(document.querySelector('.cal-modules')).columnGap === '5px');
assert(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
assert(document.querySelector('.cal-module[data-key="calendar"] .year-grid') || document.querySelector('.cal-module[data-key="calendar"] .cal-grid'));
```
**关联实现**：`CAL_MODULE_KEYS` / `calModuleState()` / `calModuleTitle()` / `renderCalModules(calTop)` / `renderCalendarPage()`；`.cal-modules` 与 `.cal-module[data-key="calendar"]` 的 CSS 规则；`loadUI()` 的 `ui.calModules` 恢复分支。
**验证方式**：真实浏览器探针（1440x900 · 真实鼠标）：五模块顺序 calendar,note,today,log,stats / 间距 5px / 无横向滚动条 / 年-月-周切换与翻页 / 单元格点击 / 标题行拖拽排序 / 右下角缩放 / 删除后「+ 添加模块」恢复 / 重载后 order 与 sizes 保持 / 旧存档补位；零 pageerror · 零 console.error。
**补充口径**：模块状态仍只经 `saveUI()` 持久化，不进 `historyPast`；日历顶部区域为原 DOM 节点整体迁移（不重建、不重绑），故翻页 / 切换视图 / 时间网格拖拽事件零丢失。模块间距由 2px 调整为 5px 属本条新增口径，不改变 #86 / #87。
**冲突调整记录**：本条扩展 R34「日历底部模块化」的容器口径（模块集合由四模块扩为五模块、间距 2px → 5px），不修改既有 #1–#87 条文原文；与 #21、#76 无冲突。

> **口径废弃提示（2026-10-21）**：本条相关模块尺寸口径（见 #89 断言 4/5）已被 **#90** 修正，具体以 **#90** 为准。本条正文不再包含错误引用的断言 4/5 废弃提示。

> **类型**：结构与交互不变量　**状态**：已登记
**覆盖用例 id**：

---
## 日历模块边距与自适应防畸变（2026-10-21 新增） {#cal-margin}

### 89. 日历视图内容区内距 5px 与模块等比伸缩防畸变
**定义**：日历视图下 `#content` 容器内距固定为 5px，其余视图必须清空该行内样式以恢复默认；`.cal-modules` 以 5px 间距、`width:100%` / `min-height:100%` / `box-sizing:border-box` / `align-content:flex-start` 充满 `.cal-bottom` 并自顶部排列；`.cal-module` 以 `box-sizing:border-box` / `max-width:100%` / `min-width:150px` 保证尺寸计算含边框、单模块不超出主内容区、窄窗下不被挤压畸变；模块宽度一律由 flex 等比分配，拖拽仅改变伸缩基准，不锁死固定宽度。
**断言**：
```js
// 1. 内距
assert(document.querySelector('#content').style.padding === '5px');
// 切换到其他视图后
assert(document.querySelector('#content').style.padding === '');
// 2. 容器
const mods = document.querySelector('.cal-modules');
assert(getComputedStyle(mods).columnGap === '5px');
assert(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
// 3. 模块
document.querySelectorAll('.cal-module').forEach(m => {
  assert(getComputedStyle(m).boxSizing === 'border-box');
  assert(getComputedStyle(m).maxWidth === '100%');
  assert(getComputedStyle(m).minWidth === '150px');
  assert(m.offsetWidth <= mods.clientWidth + 1);
});
// 4. 无 sizes 时默认 flex
assert(getComputedStyle(document.querySelector('.cal-module[data-key="calendar"]')).flexGrow === '1');
assert(getComputedStyle(document.querySelector('.cal-module[data-key="calendar"]')).flexBasis === '100%');
// 5. 拖拽后 sizes 存目标值（以 #90 为准）
// 6. 重载后 flex 基准恢复
```
**关联实现**：`renderMain()` 的 `c.style.padding` 分支；`.cal-modules` / `.cal-module` 的 CSS 规则；`renderCalModules()` 的默认 flex 与落盘尺寸分支；`calModuleBindResize()` 的拖拽 flex / height 更新与 pointerup 回写。
**验证方式**：真实浏览器探针（Chromium 1440x900，真实鼠标拖拽），逐项读取 `getComputedStyle` 与 `offsetWidth` / `offsetHeight`；多视口 1280 / 1440 / 1600 / 1920 / 2560 各测一次；折叠 / 展开左侧栏各测一次；重载校验 sizes 持久化与 flex 基准恢复。
**补充口径**：本条扩展 #88 的排布口径（模块最小宽由 180px 放宽为 150px、容器补 `min-height:100%` / `box-sizing:border-box` / `align-content:flex-start`、模块补 `box-sizing` / `max-width:100%`、内容区内距 5px、缩放后不再固定 `flex:0 0 auto` 而是恢复 `1 1 <w>px` 等比伸缩），不修改既有 #1–#88 条文原文；#88 的 gap 5px 与 calendar 首位口径继续有效。
**冲突调整记录**：与 #76 无冲突；#88 断言 3 的间距 5px 与无横向滚动条口径继续有效；本条新增的 `min-width:150px` 仅替换模块最小宽数值，不改变 180×160 之外的缩放 / 落盘 / 拖拽排序语义（最小高仍为 160px）。

> **口径废弃提示（2026-10-21）**：本条断言 4 中「其余模块 `flex-basis === 200px`」及断言 5 中「`sizes[k].w === offsetWidth`」的口径已被 **#90** 修正。具体请严格遵循 **#90** 的「目标值落盘」与「`1 1 24%`」基准。

> **类型**：结构与交互不变量　**状态**：已登记
**覆盖用例 id**：

---
## 日历底部模块位置稳定性（2026-10-21 新增） {#cal-module-stability}

### 90. 日历底部五模块位置稳定性与尺寸落盘口径
**定义**：日历底部五模块（calendar / note / today / log / stats，即 `.cal-modules` 内的 `.cal-module`）在拖拽缩放、点击无位移、内容增删、换行重排、触屏手势打断五类场景下，位置与尺寸必须可预测且可复现，具体口径如下：

1. `ui.calModules.sizes` 的落盘口径为「**拖拽期维护的目标值**」：非 calendar 模块存 `{w,h}`，calendar 模块**只存 `{h}`**；落盘**严禁回读** `offsetWidth` / `offsetHeight`。
2. `calendar` 模块**独占整行**：`flex` 恒为 `1 1 100%`、`minWidth` 恒为 `100%`，宽度**不允许落盘**（`sizes.calendar` 中不得出现 `w` 键）。
3. **固定 height 锁行高**：凡已落盘高度的模块，`height` / `minHeight` / `maxHeight` **三件套同时写入同一 px 值**，使内容增删不再推高整行、不再顶掉下一行。
4. `pointercancel`（触屏 / 系统手势打断）**必须按 pointerdown 快照还原 DOM 顺序**，且不得写 `st.order`、不得调 `saveUI()`。
5. **默认 minWidth 与 CSS 一致**：无落盘尺寸的模块 `minWidth` 取 `150px`（与 `.cal-module{min-width:150px}` 同值），`flex` 取 `1 1 24%`。

**断言**：
```js
// 1. 缩放落盘：存目标值，非 offset 回读
const sz = ui.calModules.sizes.note;
assert(sz.w === targetW && sz.h === targetH);
assert(el('note').style.flex === '1 1 ' + sz.w + 'px');
assert(el('note').style.height === sz.h + 'px');
reload();
assert(Math.abs(el('note').offsetWidth - targetW) <= 2);
assert(Math.abs(el('note').offsetHeight - targetH) <= 2);
// 2. 点击不拖动：sizes 不新增
const before = JSON.stringify(ui.calModules.sizes);
pointerDownUp(el('today').querySelector('.cal-module-resize'));
assert(JSON.stringify(ui.calModules.sizes) === before);
// 3. calendar 独占
assert(el('calendar').style.flex === '1 1 100%');
assert(el('calendar').style.minWidth === '100%');
assert(!('w' in ui.calModules.sizes.calendar));
dragResize('calendar', 300, 40);
assert(el('calendar').style.flex === '1 1 100%');
assert(Object.keys(ui.calModules.sizes.calendar).join() === 'h');
// 4. 固定行高
const h = ui.calModules.sizes.today.h;
assert(el('today').style.height === h + 'px');
assert(el('today').style.minHeight === h + 'px');
assert(el('today').style.maxHeight === h + 'px');
const hBefore = el('today').offsetHeight;
const topNextBefore = el('stats').getBoundingClientRect().top;
seedDayNodes(ui.selectedDate, 30);
assert(el('today').offsetHeight === hBefore);
assert(el('stats').getBoundingClientRect().top === topNextBefore);
// 5. pointercancel 还原
const snap = Array.from(grid('.cal-modules').querySelectorAll('.cal-module')).map(m => m.dataset.key);
dragStart(el('note'));
dragOver(el('today'));
assert(keys() !== snap.join());
pointerCancel();
assert(keys() === snap.join());
assert(keys() === ui.calModules.order.join());
assert(saveUICallCount === 0 && orderWriteCount === 0);
// 6. 换行单调（侧栏折叠态固定）
let rowsPrev = Infinity;
const seq = [1280, 1366, 1440, 1600, 1920, 2560].map(w => {
  setViewportWidth(w);
  return perRowCounts('.cal-modules');
});
for (let i = 1; i < seq.length; i++) {
  assert(seq[i][1] >= seq[i - 1][1]);
  assert(rows('.cal-modules') <= rowsPrev);
  rowsPrev = rows('.cal-modules');
}
assert(document.documentElement.scrollWidth <= innerWidth + 1);
// 7. 行高恒定
assert(getComputedStyle(grid('.cal-modules')).alignItems === 'stretch');
const sameRow = modulesOnRow(grid('.cal-modules'), 2);
const hs = sameRow.map(m => m.offsetHeight);
assert(Math.max(...hs) - Math.min(...hs) <= 1);
```
**关联实现**：`CAL_MODULE_KEYS`（`v2.0-t3.html:9991`）、`calModuleState()`（`:9993`）、`calModuleTitle()`（`:10007`）、`calModuleBindDrag()`（`:10073`，快照 `snapshotOrder` `:10080`，统一收尾 `stopAll` `:10109–10118`，回写 `onUp` `:10119–10133`，取消还原 `onCancel` `:10135–10143`，`pointercancel` 挂载 `:10146`）、`calModuleBindResize()`（`:10154`，目标值 `w`/`h` 初始化 `:10162`，拖拽期样式 `:10168–10172`，纯点击还原 `:10196–10203`，落盘分支 `:10204–10221`，`calendar` 分支 `:10210–10214`，其余分支 `:10215–10220`，`saveUI()` `:10221`，`pointercancel=onUp` `:10225`）、`renderCalModules()`（`:10228`，`calendar` 分支 `:10242–10245`，`sizes` 分支 `:10246–10249`，无尺寸默认分支 `:10250–10253`，绑定 `:10272–10273`，「+ 添加模块」`:10282–10292`）；CSS `.cal-bottom{overflow-x:hidden}`（`:426`）、`.cal-modules`（`:427`，`gap:5px` / `align-items:stretch` / `align-content:flex-start`）、`.cal-module`（`:428`，`min-width:150px` / `min-height:160px` / `max-width:100%`）、`.cal-module[data-key="calendar"]{flex:1 1 100%;min-height:320px}`（`:431`）、`.cal-module-resize`（`:439`）；`loadUI()` 的 `ui.calModules` 恢复分支（`:5863–5875`）与默认值（`:5771`）。
**验证方式**：真实浏览器探针（Chromium 1440x900 · 真实鼠标）逐项读取 `getComputedStyle` / `offsetWidth` / `offsetHeight` / `getBoundingClientRect`，证据 `_环境与调试/r39-module-probe-2026-10-21.txt` → **RESULT 34/34 PASS**；`node scripts/verify.js all`（cwd=6.P0-T3基线/step9）→ **exit 0**（Node 503 / PW 171 = 167 passed + 4 skipped / bench 7/7）→ `[verify] 全部通过`；`node verify-hash-registry.mjs` → **PARTY_COUNT=65 / FIVE_PARTY_DRIFT_COUNT=0 / RESULT=PASS**。
**补充口径**：
1. `sizes` **只存目标值**。拖拽期以局部变量 `w` / `h` 维护目标值（`:10162` 初始化、`:10182–10183` 更新），落盘直接取该值（`:10214 / :10219`），**禁止**改为 `sizes[k]={w:el.offsetWidth,h:el.offsetHeight}`。
2. **`calendar` 不允许宽度落盘**。`:10242` 的 `calendar` 分支必须**先于** `sz.w>0` 分支判定，且 `minWidth` 写死 `100%`；`sizes.calendar` 恒为 `{h}`。
3. **高度三件套**：`height` / `minHeight` / `maxHeight` 必须同写同值（`:10213 / :10218 / :10245 / :10249`）。拖拽期间则反向放开：`minHeight:0px` + `maxHeight:none` + `height:h`（`:10170–10172`）。
4. 拖拽期必须以 `flex:0 0 <w>px` + `minWidth:<w>px` 固定占位（`:10168–10169`），松手后恢复 `flex:1 1 <w>px`。
5. 最小宽 `150px` / 最小高 `160px` 为 `calModuleBindResize()` 的钳制下限（`:10162 / :10182–10183`），与 CSS `.cal-module{min-width:150px;min-height:160px}`（`:428`）同源。
6. **双口径保留**：无落盘尺寸时其余模块走 `flex:1 1 24%` + `minWidth:150px`（`:10250–10253`）。该内联值**覆盖** CSS `.cal-module{flex:1 1 240px}`（`:428`）的初始基准，属 JS 与 CSS 双口径并存，**本条以 JS 内联值为准**。CSS 240px 仅在 JS 未执行时兜底，正常路径被 JS 内联 24% 覆盖。
7. 模块状态仍只经 `saveUI()` 持久化，不进 `historyPast`（与 #88 补充口径一致）；`ui.calModules` 在 `saveUI()` 载荷中出现于 `:5928` 与 `:16114` 两处，须同步。
8. 换行单调断言的**测量前提**：左侧边栏保持固定折叠状态。#84 的收起/展开会改变 `.cal-modules` 可用宽度，若在同一序列中混入折叠切换，则「每行模块数」不再同属一条单调序列。

**冲突调整记录**：与 #21、#32、#75 / #76、#84、#86 / #87 均无冲突。
**须以本条为准的两处既有口径**（本批不修改原文，仅登记待补注记）：
- **#88 断言 4** 的「其余模块 `flex-grow/flex-shrink/flex-basis === 1/1/200px`」→ 实际实现为 `1 1 24%`（`:10251`），**以 #90 为准**。
- **#88 断言 5** 与 **#89 断言 5** 的「`sizes[k].w === offsetWidth`、`.h === offsetHeight`」→ 与「只存目标值、禁止回读 offset」互斥，**以 #90 为准**。

> **类型**：UI 行为不变量　**状态**：已实现（R39）　**验证**：真机探针 + 门禁（probe 34/34 PASS · verify.js all exit 0 · 65 方零漂移）
**覆盖用例 id**：

---
## 侧边栏取消缩进与折叠按钮修复（2026-10-21 新增） {#sidebar-flat}

### 91. 侧边栏取消缩进与图标文字严格对齐
**定义**：侧边栏主导航项（`.sb-nav-item`）与子菜单项（`.sb-row`）的图标和文字必须在垂直方向上严格左对齐。取消额外层级缩进（全级平铺），依赖相同的 flex 布局基准、padding（左内边距均设为 8px）、gap（均设为 8px）以及统一的折叠箭头占位宽度（设为 24px），确保无论嵌套层级多深，所有的图标（`.ic` / `.sb-icon`）以及文字（`.sb-label`）都在同一条垂直线上。
**断言**：
```js
const nav = getComputedStyle(document.querySelector('.sb-nav-item'));
const row = getComputedStyle(document.querySelector('.sb-row'));
assert(nav.paddingLeft === '8px' && row.paddingLeft === '8px');
assert(nav.gap === '8px' && row.gap === '8px');
assert(document.querySelector('.sb-arrow').offsetWidth === 24);
assert(document.querySelector('.sb-arrow.leaf').offsetWidth === 24);
assert(getComputedStyle(document.querySelector('.sb-children')).paddingLeft === '0px');
assert(getComputedStyle(document.querySelector('#subDb')).paddingLeft === '0px');
// 任意层级图标/文字左边界差为 0
assert(Math.abs(iconRectAtDepth0.left - iconRectAtDepthN.left) === 0);
assert(Math.abs(labelRectAtDepth0.left - labelRectAtDepthN.left) === 0);
```
**关联实现**：CSS 规则 `.sb-nav-item`、`.sb-row`、`.sb-arrow`、`.sb-arrow.leaf`、`.sb-children`。
**验证方式**：真实浏览器中展开多级子树，检查图标与文字的左侧是否绝对对齐。
**冲突调整记录**：本条取代 #84 中关于缩进与宽度的细分口径。#84 原本定义 `.sb-arrow.leaf` 占位宽为 22px，且层级缩进由 `.sb-children` 的 `padding-left:14px` 表达；因用户强制要求“取消缩进，所有图标和图标对齐”，本条将 `.sb-arrow` 与 `.sb-arrow.leaf` 统一定义为 24px，并将所有 `.sb-children` 缩进归零。除这两项尺寸与缩进口径外，#84 中关于折叠状态、面板宽度自适应及自愈探测的语义保持完全有效。**#84 补充口径中的 15px 导航图标偏移亦由本条取代。**
**覆盖用例 id**：

---

### 92. 折叠三角按钮点击折叠可靠性
**定义**：侧边栏导航项的折叠三角（`.chev`）点击时，必须仅触发对应子树（`.sb-subtree`）的展开/收起状态切换，不得因点击冒泡触发 `navTo` 强制覆盖展开状态，且不得被长按拖拽逻辑吞没事件。
**断言**：
```js
const before = ui.navExpanded.files;
document.querySelector('.chev').click();
assert(ui.navExpanded.files === !before);
assert(document.querySelector('.sb-subtree').classList.contains('open') === !before);
document.querySelector('.chev').click();
assert(getComputedStyle(document.querySelector('.sb-subtree')).maxHeight === '0px');
// 拖拽早退
assert(JU_DND._bindRowDrag.toString().includes("e.target.closest('.chev')"));
```
**关联实现**：`bindSidebar()` 的 `.chev` 点击事件、`navTo()` 状态处理、`JU_DND._bindRowDrag()`。
**验证方式**：连续点击 `.chev`，检查子树展开与收起状态切换准确无误，且不触发页面跳转或拖拽。
**冲突调整记录**：本条修复了因 `JU_DND._bindRowDrag` 长按拖拽并调用 `setPointerCapture` 导致 `.chev` 的 click 事件目标被重定向到整行，进而使点击失效的 Bug。此修复增加了 `.chev` 的早退拦截，不改变 #45 中关于 5px 位移触发拖拽的阈值判定逻辑，对 #49 无影响。
**覆盖用例 id**：

---

## 幻灯片视图整体贴合居中（L22-final-r4 新增） {#slides-flex-center}

### 93. 幻灯片主舞台面积最大化与整体贴合居中
**定义**：在幻灯片视图（`slides-mode`）下，左侧缩略图栏（`.ju-sl-rail`）与主演示区（`.ju-sl-stage`）必须作为一个整体在水平方向居中，两者间距固定为 8px；主舞台须基于视口高度利用 `cqh` 单元撑满可用空间，保持 16:9 比例最大化；同时必须处理因 `container-type: size` 导致的 flex 子项宽度塌陷问题；窄屏（≤720px）时退化为上下纵向排列。

**断言**：
```js
const wrap = getComputedStyle(document.querySelector('.ju-sl-wrap'));
assert(wrap.display === 'flex' && wrap.justifyContent === 'center');
assert(wrap.gap === '8px');

const rail = getComputedStyle(document.querySelector('.ju-sl-rail'));
assert(rail.flex.includes('none') && rail.width === '174px');

const main = getComputedStyle(document.querySelector('.ju-sl-main'));
assert(main.flex.includes('0 1 auto'));
assert(main.getPropertyValue('container-type') === 'size');

const stage = getComputedStyle(document.querySelector('.ju-sl-stage'));
assert(stage.width.includes('calc(100cqh * 16 / 9)'));
assert(stage.maxWidth === '100%');

// 目测或测量：
// 1. 舞台顶边与首张缩略图顶边对齐（Δ=0）。
// 2. 缩略图右侧与舞台左侧间距严格为 8px。
// 3. “缩略图+舞台”整体居左/右空白差 ≤1px。
```
**关联实现**：
- 产品侧 L22 块 `v2.0-t3.html` `JU_SLIDES._styleOnce()` 的 CSS 数组：
  - `.ju-sl-wrap` 采用 `flex` + `justify-content: center` + `gap: 8px`。
  - `.ju-sl-rail` 采用 `flex: none` + `width: 174px`。
  - `.ju-sl-main` 通过 `flex: 0 1 auto` 收缩，并利用 `aspect-ratio: 16/9` 解决 `container-type: size` 导致的 0 宽度塌陷问题。
  - `.ju-sl-stage` 采用 `width: calc(100cqh * 16 / 9)` + `max-width: 100%`。
  - `@media (max-width:720px)` 采用 `flex-direction: column` + `gap: 8px`。
**验证方式**：
真实浏览器截图与 getComputedStyle 读取（1440x900、1920x1080、3440x1440），测量间距与空白差。
**冲突调整记录**：本条彻底取代了 #77 及其补充口径中关于网格（Grid）布局的排布方式，但遵守了「顶部对齐」与「16:9 比例」的视觉不变量。

> **类型**：UI 行为不变量　**状态**：已实现（r4）　**验证**：真机探针（gap=8px，左右留白差≤1px，16:9 比例） + 门禁全绿。
**覆盖用例 id**：

---

## 标签选择器反选与视觉反馈（2026-10-21 新增） {#tag-picker-toggle}

### 94. 标签选择器反选与视觉反馈
**定义**：日历待办（`renderCalNode`）的标签选择器（`openTagPicker`）必须支持反选取消：点击已存在的标签时，将其从 `_manualTags` 中移除并重算 `tags`；点击未存在的标签时添加。弹窗列表必须展示当前待办已拥有的标签为选中态（如高亮、打勾），并区分“索引构建中”与“暂无标签”的提示文案。
**断言**：
```js
const nodeId = ...;
const beforeTags = [...state.nodes[nodeId]._manualTags];
openTagPicker(nodeId, anchor);
// 点击已存在的标签
clickTagItem(existingTag);
assert(!state.nodes[nodeId]._manualTags.includes(existingTag));
// 点击不存在的标签
clickTagItem(newTag);
assert(state.nodes[nodeId]._manualTags.includes(newTag));
// 视觉：已选中的标签项有高亮/勾选
assert(tagItem(existingTag).classList.contains('selected') || tagItem(existingTag).querySelector('.check'));
```
**关联实现**：`openTagPicker()`（`v2.0-t3.html:16809`）之 `pick(t,on)` 段（`want=true` 并集 / `want=false` 差集，`tags` 仍按 `manual ∪ 正文 #标签` 重算，不再 `closeTagPicker()`，改 `forceRender()` + `buildRows()` 就地刷新）、`buildRows()`（行内勾选标记与只读行）、`l7TagIndexWhenReady` 就绪回调、`doCreate()`、清除行；CSS `.tag-picker`（`v2.0-t3.html:806`）之 `.tp-list` / `.tp-label` / `.tp-check` / `.tp-item.sel` / `.tp-item.ro` / `.tp-item.tp-hint` / `.tp-item.tp-none`。
**验证方式**：真机探针 `_临时脚本/_r42_tagpicker_probe_2026-10-21.mjs`（真实鼠标 + 真实键盘）⇒ **10/10 PASS**，证据 `_环境与调试/r42-tagpicker-probe-2026-10-21.txt`：新建 A/B 后 `_manualTags=["r42a","r42b"]`、真实鼠标点已勾选行 A 后 `_manualTags=["r42b"]`、再点 B 后 `_manualTags=[]`、正文 `#标签` 行为只读态、清除行就地刷新、索引未就绪文案命中、`pageerror=0 / console.error=0`；随后 `node scripts/verify.js all` Exit 0 与登记器 65 方 drift 0。
**补充口径**（实测类名与语义等价）：产品现行实现中「选中态」落在行元素的 `sel` 类、「勾选标记」为行内 `.tp-check` 元素，故断言里的 `classList.contains('selected')` / `querySelector('.check')` 按语义等价读作 `.tp-item.sel` / `.tp-check`（R42 真机探针实测 `.sel` 与 `.tp-check` opacity 1/0 随勾选翻转）。
**冲突调整记录**：与 #87 无冲突——标签色仍只经 `dot.style.setProperty('--tag-color', getTagColor(t))` 注入，`t17-w1` 的 `/dot\.style\.background\s*=/ === false` 断言仍绿；`pick` / `clearTags` 段内仍严格 `commit → _tagIndexCache=null → forceRender()`（`t19-patch2` A1/A2 逐字成立，Node 503/503 实测）；`<script>` 仍 9 块，数据契约 / 加密 payload / 公开 API 与大纲 · 日历 · 数据库 · 幻灯片渲染函数零改动；与 #93 无交集。

> **类型**：UI 行为不变量　**状态**：已实现（R42）　**验证**：真机探针 10/10 PASS + 门禁（Node 503 / PW 171 / bench 7/7）+ 65 方零漂移
**覆盖用例 id**：

---

## 核对说明

- 关联实现清单已对 `v2.0-frozen.html`（初始基线，SHA256 `0635e55a…da1c6`）与现行基线 `v2.0-t3.html` 静态核对：主题色 `#DFECD5 / #CAD3C3 / #0A1929 / #152A4A / #1D355E`、`data-theme`、`buildTagIndex / nodeHasTag / buildCalIndex / calendarTodosOnDate / nodesOnDate / docWordCount / nodeSearchHay / mergeRemoteState / undo / redo / validateImportedTree / repairTreeConsistency / migrateStateObject / expandRecurring / _tombstoneSet / _tombstoneDelete / saveEncryptedAutoBackup / recoverPendingEncrypted / PENDING_PLAIN_KEY / PENDING_SYNC_KEY / HISTORY_MAX / moveToTrash / restoreFromTrash / purgeTrash / updateText` 均存在。
- 验收对照：启动清单 #3「不变量清单 20 条」→ 初始版本已产出 21 条可断言不变量（20 行为 + 1 主题 token）。**现行清单共 106 条独立不变量**（#1–#115；#43、#44 为交叉引用不计独立条，#68–#74 为修复登记不计入总数）。
- 历史门禁值统一加 `[历史快照]` 前缀；现行门禁以 #90 为准：`node scripts/verify.js all` exit 0（Node 503 / PW 171 = 167 passed + 4 skipped / bench 7/7），`node verify-hash-registry.mjs` = **65 方 / drift 0 / PASS**。

## 关联文件

| 文件 | 说明 |
|---|---|
| `JU-58项修复回归清单-v2.0-frozen.md` | 58 项修复回归清单（初始基线） |
| `fix-map.json` | FIX-* → 回归编号映射 |
| `v2.0-frozen.html` | 初始基线，**不修改**（初始基线哈希见文件头） |
| `v2.0-t3.html` | **现行基线** |

---

## 主题图标、右键菜单折叠与多选格式化（2026-10-22 新增） {#ui-enhancements}

### 95. 主题按钮图标更替与样式统一
**定义**：顶部工具栏的主题切换按钮（`#btnTheme`）及其动态生成的 SVG 图标，必须统一使用“上衣”轮廓路径（`<path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>`），保持空心线框风格（`fill:none`，`stroke:var(--icon)`），与其他按钮尺寸一致。
**断言**：
```js
const svg = document.querySelector('#btnTheme svg');
assert(svg.innerHTML.includes('M20.38 3.46'));
assert(!svg.innerHTML.includes('circle'));
```
**关联实现**：`btnTheme` 的 SVG、`applyTheme()` 中的赋值。
**覆盖用例 id**：

---

### 96. 当日待办右键菜单折叠化与统一视觉
**定义**：在“当日待办”上右键弹出的菜单必须采用折叠展开样式，禁止弹出二级模态窗口。
1. 折叠项（设置时间、选择标签、优先级）的高度、内边距、字体必须与普通项完全一致（复用 `.ctx-item`）。
2. 折叠项最左侧固定显示折叠三角（▶/▼），普通项最左侧需有同宽占位符，保证文本严格左对齐。
3. 折叠项及其展开内容必须使用浅色背景（如 `background:var(--bg-panel2)`）和圆角，与普通项透明背景区隔。
4. 点击折叠项头部展开/收起，不关闭菜单；点击普通项直接执行。
**断言**：
```js
const header = document.querySelector('.fold-header');
assert(getComputedStyle(header).height === getComputedStyle(document.querySelector('.normal-item')).height);
assert(header.querySelector('.arrow').textContent === '▶' || header.querySelector('.arrow').textContent === '▼');
assert(getComputedStyle(header).backgroundColor !== 'transparent');
```
**关联实现**：`renderCalNode()` 的 `contextmenu` 事件。
**覆盖用例 id**：

---

### 97. 多选节点批量格式化与格式刷兼容
**定义**：当选中多个节点且无文本选区时，点击加粗、字号、颜色等按钮，必须直接对选中的所有节点批量应用样式（`execBatchFormat`）。
1. 批量应用前需清除原有相关样式（如 `fontSize`、`color`），防止嵌套叠加。
2. 格式刷（`painter`）在多选状态下必须支持提取首个节点格式，并批量应用到后续选中的节点上。
3. 点击“粘贴”按钮若因权限被拒，应给出友好提示（“浏览器拒绝了剪贴板读取权限，请直接使用 Ctrl+V 粘贴”）。
**断言**：
```js
_mSel.ids = new Set(['id1', 'id2']);
clickBoldBtn();
assert(state.nodes['id1'].text.startsWith('<b>') && state.nodes['id2'].text.startsWith('<b>'));
clickBoldBtn();
assert(!state.nodes['id1'].text.includes('<b><b>'));
```
**关联实现**：`bindRightSidebar()` 的 `[data-cmd]` 点击、`execBatchFormat()`。
**覆盖用例 id**：

---

### 98. 颜色/字号选择器即点即用与布局矩阵
**定义**：
1. `openColorPicker`：取消底部按钮，点击色块或输入色号即刻应用并关闭。透明块移出网格，置于自定义区域最左侧。网格排布为 8 列 3 行（`grid-auto-flow: column`），竖向同色系由浅到深。顶部增加 24px 留白。
2. `openSizePicker`：取消底部独立按钮，将“清除字号”合并进 4 行 2 列网格。透明块与清除字号按钮样式统一为 `color:var(--accent); font-weight:bold; border:2px solid var(--accent);`。
**断言**：
```js
const picker = document.querySelector('.color-picker');
assert(!picker.querySelector('.footer'));
assert(picker.querySelector('.cp-grid').style.gridAutoFlow === 'column');
assert(picker.querySelector('.cp-grid').style.gridTemplateRows === 'repeat(3, 1fr)');
assert(picker.style.paddingTop === '24px');
```
**关联实现**：`openColorPicker()`、`openSizePicker()`。
**覆盖用例 id**：

---

### 99. 日历字数统计模块与底层增量聚合
**定义**：日历新增“字数统计”模块，必须通过底层增量聚合实现。
1. `actions.logActivity` 增加参数 `diff`，在落盘时计算纯文本字数变化，累加至 `state.charStats[ds]`（含 `add`、`del`、`mod`）。
2. 字数口径：剥离 HTML 标签后的纯文本长度（`stripHtml`）。
3. `calModuleCharsBody` 根据视图直接读取 `state.charStats` 累加，展示新增、删除、修改、净变化。
**断言**：
```js
assert(state.charStats);
commit(s => { s.nodes['id'].text = 'new text'; });
// 等待防抖落盘后
assert(state.charStats[todayStr()].mod !== 0);
assert(calModuleCharsBody(document.createElement('div')).querySelector('.stat-cards').children.length === 4);
```
**关联实现**：`actions.logActivity`、`defaultState`、`calModuleCharsBody`。
**覆盖用例 id**：

---

### 100. 日历模块标题统一与柱状图补全
**定义**：
1. 标题统一：“任务统计”与“字数统计”模块标题后缀由 `_getCalScopeText()` 生成，格式为 `年(2026)` / `月(2026.10)` / `周(10.18-10.24)`。
2. 柱状图：字数统计模块在年/月/周视图下均需展示柱状图。正增长为绿色，负增长为红色。
**断言**：
```js
const statsTitle = document.querySelector('.cal-module[data-key="stats"] .cal-module-title').textContent;
const charsTitle = document.querySelector('.cal-module[data-key="chars"] .cal-module-title').textContent;
assert(statsTitle.match(/（(.?)）/)[1] === charsTitle.match(/（(.?)）/)[1]);
assert(document.querySelector('.cal-module[data-key="chars"] .cal-module-body > div:last-child').style.display === 'flex');
```
**关联实现**：`_getCalScopeText()`、`calModuleStatsBody()`、`calModuleCharsBody()`。
**覆盖用例 id**：

---

## 交互与视觉一致性修复（2026-10-23 新增） {#ui-consistency-r71}

### 101. 数据库工具栏标题与按钮组对齐
**定义**：数据库视图（`renderDatabasePage`）的工具栏（`.db-toolbar`）中，表名标题（`.db-title`）必须固定在左侧，紧邻的视图切换（`.db-views`）、筛选/排序/汇总工具组（`.db-sf-group`）以及行列添加按钮（`.db-add`）必须统一靠右对齐。不得改变 DOM 结构。
**实现**：`.db-title` 增加 `margin-right:auto` 撑开剩余空间；`.db-add` 移除原有的 `margin-left:auto` 防止与前者冲突导致分组断裂。
**断言**：
```js
const toolbar = document.querySelector('.db-toolbar');
const title = toolbar.querySelector('.db-title');
const add = toolbar.querySelector('.db-add');
assert(getComputedStyle(title).marginRight === 'auto');
assert(getComputedStyle(add).marginLeft !== 'auto');
```
**覆盖用例 id**：

---

### 102. 日历模块标题行计数内联展示
**定义**：日历视图的模块（`.cal-module`）中，当日待办（`calModuleTodayBody`）和系统日志（`calModuleLogBody`）的统计数字（如 `4/4 · 100%`、`84`）不再作为独立的右侧徽标（`.badge`）渲染，而是直接拼接在模块标题（`.cal-module-title`）的文本末尾，格式为 `标题 (统计值)`。
**实现**：移除了 `calModuleBadge` 函数的调用，转而通过 `head.querySelector('.cal-module-title').textContent += ...` 动态追加。原徽标的悬浮提示（`title`）同步转移至标题元素上。
**断言**：
```js
const todayTitle = document.querySelector('.cal-module[data-key="today"] .cal-module-title');
const logTitle = document.querySelector('.cal-module[data-key="log"] .cal-module-title');
assert(todayTitle.textContent.includes('(') && todayTitle.textContent.includes(')'));
assert(logTitle.textContent.includes('(') && logTitle.textContent.includes(')'));
assert(!document.querySelector('.cal-module-head .badge'));
```
**覆盖用例 id**：

---

### 103. 日历新增待办滚动位置保持与焦点恢复
**定义**：在日历视图的当日待办模块（`calModuleTodayBody` 的 `adder.onclick`）、时间网格（`buildTimeGrid` 的 `col.onclick`）、或待办列表内按回车新建（`renderCalNode` 的 `keydown Enter`）时，必须记录 `#content` 当前的 `scrollTop`，并在 `forceRender()` 重渲染后同步恢复该滚动位置，随后再通过 `requestAnimationFrame` 将焦点定位到新生成的待办节点上。严禁因双重渲染导致页面跳回顶部。
**实现**：
```js
const c = document.getElementById('content');
const st = c ? c.scrollTop : 0;
// ... 执行 addNode 与 forceRender()
if (c) c.scrollTop = st;
requestAnimationFrame(() => {
  if (c) c.scrollTop = st;
  focusAfterRender(id, '.cal-page');
});
```
**断言**：
```js
const content = document.getElementById('content');
content.scrollTop = 1000;
clickAddTodoBtn();
assert(content.scrollTop >= 1000);
```
**覆盖用例 id**：

---

### 104. 日历待办默认字重剥离与富文本净化
**定义**：日历待办列表（`.cal-node .text`）、月视图条目（`.cal-item`）以及时间网格事件块（`.cal-tg-ev .evtx`）的文本必须呈现为正常字重，严禁默认加粗。在渲染待办列表时，必须经过正则过滤，剥离历史数据中可能包含的粗体标签（`<b>`、`<strong>`）和行内加粗样式（`font-weight: bold/bolder/600-900`）。
**实现**：CSS 层面移除或重置为 `font-weight:normal`（时间网格使用 `!important` 防范覆盖）。`renderCalNode` 的 `text.innerHTML` 赋值前增加正则替换：`_raw.replace(/<b\b[^>]*>|<\/b>|<strong\b[^>]*>|<\/strong>|font-weight\s*:\s*(bold|bolder|[6-9]00)\s*;?/gi,'')`。
**断言**：
```js
const textEl = document.querySelector('.cal-node .text');
assert(getComputedStyle(textEl).fontWeight === '400' || getComputedStyle(textEl).fontWeight === 'normal');
state.nodes['test'].text = '<b>加粗文本</b>';
renderCalNode(state.nodes['test']);
assert(!document.querySelector('.cal-node .text').innerHTML.includes('<b>'));
```
**覆盖用例 id**：

---

### 105. 全局滚动条极简化与主题自适应
**定义**：全站 Webkit 滚动条（`::-webkit-scrollbar-thumb`）与 Firefox 滚动条（`scrollbar-color`）的颜色必须基于当前主题的文字色（`--fg`）混合生成，保持 15% 的透明度。滚动条视觉宽度需通过 `border: 2px solid transparent` 与 `background-clip: padding-box` 缩窄至 4px 呈现，悬停时加深至 30%。
**实现**：
```css
::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--fg) 15%, transparent); border: 2px solid transparent; background-clip: padding-box; border-radius: var(--radius-sm); }
::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--fg) 30%, transparent); }
html { scrollbar-color: color-mix(in srgb, var(--fg) 15%, transparent) transparent; }
```
**断言**：
```js
const thumbStyle = window.getComputedStyle(document.documentElement, '::-webkit-scrollbar-thumb');
assert(thumbStyle.background.includes('color-mix') || thumbStyle.backgroundColor.includes('rgba(0, 0, 0, 0.15)'));
assert(thumbStyle.border.includes('2px solid transparent'));
assert(thumbStyle.backgroundClip === 'padding-box');
```
**覆盖用例 id**：

---

## 核心逻辑与渲染性能修复（2026-10-23 新增） {#logic-fix-r76}

### 106. 拖拽排序与同父移动索引防偏移
**定义**：节点或表头在同一父级或同一列表内向后拖拽移动时，移除源元素后如果目标索引大于源索引，插入索引必须减一。严禁因未减一导致元素错位或“多走一格”。
**断言**：
```js
// 节点拖拽
const p = state.nodes[parentId];
const [moved] = p.children.splice(fromIdx, 1);
const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
p.children.splice(insertIdx, 0, moved);
assert(p.children[insertIdx] === movedId);
// 数据库表头列拖拽同理
```
**关联实现**：`actions.moveNode()`、`renderDbTable()` 列头拖拽提交。
**验证方式**：拖拽 A 节点到 B 后面，断言 A 在 B 的下一个位置，不发生跨越。
**覆盖用例 id**：

---

### 107. 循环遍历防意外中断与子树漏算
**定义**：统计聚合遍历子树时，遇到条件不符（如跨年重复任务不在今年），严禁直接使用 `return` 中断当前递归，必须确保子节点依然被压入栈或遍历，防止整棵子树漏算。
**断言**：
```js
(function walk(node) {
  node.children.forEach(child => {
    if (conditionNotMet) return; // 错误：导致子节点漏算
    // 正确：if (conditionMet) { doSomething() }
    stack.push(child);
  });
})(root);
```
**关联实现**：`buildYearCounts()` 的 yearly 分支。
**验证方式**：给跨年重复任务挂载子节点，年视图统计中子节点计数不丢失。
**覆盖用例 id**：

---

### 108. 外部时间标准解析与本地化对齐
**定义**：导入 ICS UTC 时间时，如果时间跨越零点，日期必须同步转换为本地日期；所有日期的“今天”判定需统一口径（如周/月视图均基于本地时间），防止跨天错位。
**断言**：
```js
// ICS 解析
const local = new Date(Date.UTC(...));
dateStr = ymd(local);
// 视图今天判定
const cnToday = todayStr(); // 统一使用本地 todayStr()
assert(todayHighlightedInWeekView === todayHighlightedInMonthView);
```
**关联实现**：`importICS()`、`buildTimeGrid()`。
**验证方式**：导入含 DTSTART:20260101T200000Z 的 ICS，断言显示为次日本地时间；月/周视图今天高亮一致。
**覆盖用例 id**：

---

### 109. 异步渲染防竞态与防高亮残留
**定义**：编辑框失焦时，应提取当时的 DOM 快照进行后续处理，防止异步重渲染导致二次读取失效；鼠标拖拽框选滑出有效区域时，必须清除高亮状态并重置选中集。
**断言**：
```js
// 防竞态
const liveText = text.textContent;
// ... 异步提交 ...
const parsed = parseNaturalDate(liveText);
// 防残留
if (!hit) { _outlineSel.ids = new Set(ds.base); outlineDragSelectPaint(); }
```
**关联实现**：`renderCalNode()` 的 blur 回调、`outlineDragSelectMove()`。
**验证方式**：日历待办编辑失焦后日期正确；大纲框选滑出列表后高亮消失。
**覆盖用例 id**：

---

### 110. 数据库主列顺延与渲染性能优化
**定义**：数据库主列（对应节点标题）被改为公式/关联等不可编辑类型时，系统必须自动顺延至下一个可编辑文本列；`setDbCell` 提交已触发渲染，组件（如 select）提交后不得再次强制 `forceRender` 造成重复渲染。
**断言**：
```js
const fields = state.dbFields;
// 主列顺延
for (const f of fields) { if (editable(f)) return f; }
// 取消双重渲染
sel.onchange = () => actions.setDbCell(...); // 不跟 forceRender
```
**关联实现**：`dbPrimaryField()`、`renderDbTable()` 的下拉框 change 事件。
**验证方式**：第一列变公式后行标题可正常编辑；下拉选择无页面白闪。
**覆盖用例 id**：

---

### 111. 早退视图派生面板同步与变量作用域防遮蔽
**定义**：视图渲染在编辑态早退时，除了保留焦点，也必须同步更新与当前编辑相关的派生面板（如日历底部的字数统计图表）；函数内定义局部同名工具函数必须重命名，严禁遮蔽全局变量。
**断言**：
```js
// 早退补刷
const _cb = c.querySelector('.cal-module[data-key="chars"] .cal-module-body');
_cb.appendChild(calModuleCharsBody(...));
// 防遮蔽
const xmlEsc = function(v) { ... }; // 替代 const esc
```
**关联实现**：`renderMain()` 编辑态早退分支、`docToXls()`。
**验证方式**：日历打字时底部字数图表实时刷新；导出 Excel 时转义正常。
**覆盖用例 id**：

---

### 112. 修改门禁与登记核实
**定义**：代码修复完成后，必须执行全量回归测试确保零漂移，更新对应哈希与登记锚点，并如实记录测试输出。
**关联实现**：`scripts/verify.js`、`MAINTENANCE.md`、任务日志。
**验证方式**：
```js
node scripts/verify.js all // 确保 Exit 0
// 核实 verify-hash-registry 台账，确保零漂移（如现行 65 方）
```
**覆盖用例 id**：

---

## 大纲拖拽方向判定与节点级剪贴板（2026-10-23 新增） {#outline-clipboard}

### 113. 大纲 text 内拖拽方向判定与原生文字选区兼容
**定义**：大纲行内 `.text`（contenteditable）上按下鼠标时，不得因事件来自文本区而跳过拖拽方向判定。按下后依据 document 级 `mousemove` 的位移方向，判定为「选中文字」或「多选节点」，两类意图互斥：
1. 水平位移为主（`|dx| > |dy|`）：判定为「选中文字」，不干预浏览器默认行为，保留原生文字选区与原生复制粘贴；
2. 垂直跨行位移为主（`|dy| > |dx| + 5`）：判定为「多选节点」，立即 `preventDefault()` + `window.getSelection().removeAllRanges()` 清除文本选区，进入 `_outlineSel` 刷选模式；刷选期间以 `document.elementFromPoint()` 实时命中 `.row`，未选中则加入 `_outlineSel.ids` 并高亮，回退则移除；
3. 零位移 `mouseup`：保持单选语义（`_outlineSel.ids = {anchorId}`）。

本条为 #50 的适用范围补充（#50 已同步原地修正，适用范围明确包含 `.text` 内部）；阈值 `|dy| > |dx| + 5` 与 `multiSelActivated` 语义沿用 #50，不重复定义。

**断言**：
```js
// #50 已同步修正：outlineDragSelectStart 首行不得为 if(fromText)return;
assert(!/^function outlineDragSelectStart\(e,id,fromText\)\{\s*if\(fromText\)return;/.test(
  outlineDragSelectStart.toString().trim()
));
// 水平拖拽：不进入多选、文字选区保留
simulateMouseDragInText(textEl, { dx: 40, dy: 2 });
assert(Math.abs(dx) > Math.abs(dy));
assert(multiSelActivated === false);
assert(window.getSelection().rangeCount > 0 && window.getSelection().toString().length > 0);
// 垂直拖拽：进入多选、文字选区清空、命中行高亮
simulateMouseDragInText(textEl, { dx: 2, dy: 60 });
assert(Math.abs(dy) > Math.abs(dx) + 5);
assert(multiSelActivated === true);
assert(_outlineSel.ids.has(hitRow.dataset.id));
assert(window.getSelection().rangeCount === 0);
assert(hitRow.classList.contains('multi-sel'));
```
**关联实现**：`outlineDragSelectStart()`（无 `if(fromText)return;`）、`outlineDragSelectMove()`、`outlineDragSelectEnd()`、`outlineDragSelectDetach()`、`_buildOutlineBox()` 的 `.row` mousedown、`outlineRowHit()`。
**验证方式**：真实浏览器在大纲行文本内 mousedown 后水平拖动 ≥10px，文字选区正常、可 Ctrl+C 复制文字；垂直跨 2 行以上拖动，`.multi-sel` 高亮出现且文字选区清空。

> **类型**：交互行为不变量　**状态**：已实现（2026-10-23）　**验证**：真机探针（水平拖选文字 / 垂直多选）+ 门禁。
**覆盖用例 id**：

---

### 114. 多选节点复制 / 剪切（系统剪贴板同步通道）
**定义**：大纲多选节点（`_outlineSel.ids.size > 1`）且无文字选区（`window.getSelection()` 无 `!isCollapsed && trim()` 选区）时，`copy` / `cut` 事件必须由 document 级捕获监听接管，通过 `e.clipboardData.setData('text/plain', payload)` 同步写入系统剪贴板。payload 格式固定为 `JU-NODES:` 前缀 + `{"v":1,"nodes":[...]}` JSON，其中 nodes 为每个选中顶级节点（`topSelected(doc)`）的递归序列化，字段须覆盖：`text / done / date / tags / priority / recur / recurEnd / time / timeEnd / note / color / showInCal / db / block / tableData / _manualTags / collapsed / children`。

1. 无文字选区且多选 → 接管：`copy` 只写剪贴板；`cut` 写入后逐个 `actions.removeNode` 并清空 `_outlineSel`；
2. 有文字选区 → 不拦截，放行原生文字复制；
3. `_outlineSel.ids.size <= 1` → 不接管，放行原生；
4. 不依赖页面内变量作为唯一来源：同页粘贴可与内部缓存并用，但跨会话 / 跨标签必须依靠系统剪贴板；不得调用 `navigator.clipboard.readText`，不得用 `keydown` 拦截 Ctrl+C / Ctrl+X。

**断言**：
```js
// 多选复制 → 系统剪贴板含 JU-NODES: 前缀（真实写入）
_outlineSel.ids = new Set(['a','b']);
dispatchCopyEventOn(document);
const txt = await navigator.clipboard.readText();
assert(txt.startsWith('JU-NODES:'));
assert(JSON.parse(txt.slice('JU-NODES:'.length)).v === 1);
assert(JSON.parse(txt.slice('JU-NODES:'.length)).nodes.length === 2);
// 有文字选区时不拦截
selectText(textEl, 5, 20);
assert(!copyEventPreventedDefault);
// 单选不接管
_outlineSel.ids = new Set(['a']);
assert(!copyEventPreventedDefault);
// 剪切：原节点从活树移除，剪贴板仍可读取
_outlineSel.ids = new Set(['a','b']);
dispatchCutEventOn(document);
assert(!state.nodes['a'] || state.nodes['a']._deleted || !root.children.includes('a'));
assert((await navigator.clipboard.readText()).startsWith('JU-NODES:'));
```
**关联实现**：document 级 `copy` / `cut` 捕获监听（由 `window._juOutlineClipBound` 幂等标记控制一次挂载）、`_outlineNodeToClipData()`、`topSelected()`、`OUTLINE_CLIP_PREFIX='JU-NODES:'`、`_ocHasTextSel()`、`_ocSelectedTopIds()`、`_ocWriteClip()`。
**验证方式**：Playwright 双标签——标签 A 多选 Ctrl+C，标签 B 点大纲空白处 Ctrl+V；控制台 `navigator.clipboard.readText()` 前缀校验；控制台打印 `nodes[0].text` 与源节点一致。

> **类型**：交互行为不变量　**状态**：已实现（2026-10-23）　**验证**：真机探针（多选复制 / 剪切 / 跨标签粘贴 / 跨会话粘贴 / 普通文字放行）+ 门禁。
**覆盖用例 id**：

---

### 115. 多选节点粘贴（前缀识别与落点规则）
**定义**：document 级 `paste` 捕获监听读取 `(e.clipboardData || window.clipboardData).getData('text/plain')`，仅当内容以 `JU-NODES:` 前缀开头且 JSON 解析合法（`v===1` 且 `nodes.length>0`）时接管：

1. `e.preventDefault()` + `e.stopPropagation()`，不进入原生或大纲元素的默认 paste 分支；
2. 落点规则——锚点为 `_outlineSel.anchorId` 或 `ui.focusId`（须属于当前文档 `findOwningTopDocId(anchorId,state) === doc.id`），有效时插入到锚点父节点的 `children` 中锚点之后；锚点无效或跨文档时插入到当前文档 `children` 末尾；
3. 递归 `addNodeTo` 复原节点树，逐字段拷贝（同 #114 字段清单），恢复后置新节点为 `_outlineSel.ids` 并 `forceRender()`，随后 `toast('已粘贴 N 个节点')`；
4. 内容不以 `JU-NODES:` 开头（普通文字 / Word 富文本 / 空剪贴板）→ 不拦截，放行原生 paste，富文本格式保留。

**断言**：
```js
// 节点粘贴（JU-NODES: 前缀）→ 拦截并插入
dispatchPasteEventOn(document, 'JU-NODES:{"v":1,"nodes":[' +
  '{"text":"line1","children":[]},{"text":"line2","children":[]}' +
']}');
assert(pasteEventPreventedDefault === true);
assert(pastedIds.length === 2);
assert(state.nodes[pastedIds[0]].text === 'line1');
assert(_outlineSel.ids.has(pastedIds[0]));
// 普通文字不拦截
dispatchPasteEventOn(document, 'hello world');
assert(pasteEventPreventedDefault === false);
// 跨会话粘贴
await page.reload();
focusOutlineBlankArea();
dispatchPasteEventOn(document, await navigator.clipboard.readText());
assert(pastedIdsAfterReload.length > 0);
```
**关联实现**：document 级 `paste` 捕获监听、`_outlineParseClipText()`、`_outlineInsertClipNodes()`、`OUTLINE_CLIP_PREFIX`、`findOwningTopDocId()`、`addNodeTo()`。
**验证方式**：多选复制 → 刷新页面 → 点大纲空白 → Ctrl+V，插入成功且保留 `text / done / tags / date / children` 等字段；多选复制 → 切到标签 B → 粘贴到标签 B 当前文档，落点正确。

> **类型**：交互行为不变量　**状态**：已实现（2026-10-23）　**验证**：真机探针（多选复制 / 剪切 / 跨标签粘贴 / 跨会话粘贴 / 普通文字放行）+ 门禁。
**覆盖用例 id**：

---

### 本批调整汇总（原地修改 + 新增）

| 条目 | 处理方式 | 说明 |
|---|---|---|
| 文件头「不变量总数」行 | **原地修改** | 91 条（#1–#100）→ 106 条（#1–#115）；#101–#112 为既有 2026-10-23 两节（12 条），本批追加 #113–#115（3 条） |
| #50 拖拽方向智能判定 | **原地修改** | 适用范围补充 `.text`（contenteditable）内部；关联实现补 `outlineDragSelectStart` 无 `if(fromText)return;`；断言补一条 fromText 早退检测；阈值 `|dy| > |dx| + 5` 与 `multiSelActivated` 语义不变 |
| #36 粘贴多行必拆与首尾空行净化 | **原地修改** | 补「分流说明」：节点级剪贴板在 document 捕获阶段以 `JU-NODES:` 前缀识别，命中即优先拦截，不进入 `parsePasteLines` 拆分路径 |
| #37 日历待办粘贴继承与单行语义降级 | **原地修改** | 补「分流说明」：同 #36；`JU-NODES:` 载荷为单行 JSON，`parsePasteLines` 只解析出 1 行，与本条不冲突 |
| #41 IME 守卫 | 不修改 | 经核对无冲突：新实现不使用 `keydown` 拦截 Ctrl+C/X/V，无 IME 相关风险（在原文尾部追加「与 #113–#115 关系」说明） |
| #45 拖拽事件防冲突 | 不修改 | 经核对无冲突：`.drag-handle` / `.sb-row` 的 `dragging` 态与本条 `copy` / `cut` 无交集（在原文适用范围说明中引用 #113） |
| #46 输入框与重渲染的防丢字机制 | 不修改 | 经核对无冲突：`paste` 拦截由 `_outlineInsertClipNodes` 内部 `commit` 完成，不依赖 `commitPendingEditBeforeRender` / `saveFocus` / `restoreFocus` 链路（在原文尾部追加「与 #113–#115 关系」说明） |
| #51 选中态视觉统一为单色背景且无边框 | 不修改 | 经核对无冲突：`_outlineSel` 命中 / 未命中切换沿用 `.multi-sel` 单色底无边框样式 |
| #53 `_mSel` 模型复用与隔离 | 不修改 | 经核对无冲突：新实现使用独立 `_outlineSel`，不扩展 `_mSel.type` 枚举（在原文尾部追加「与 #113–#115 关系」说明） |
| #113 / #114 / #115 | **新增追加** | 文本区拖拽方向判定、多选复制/剪切（系统剪贴板同步通道）、多选粘贴（前缀识别与落点规则） |

> **不变量总数核对**：文件内既有 #1–#100 为 91 条（排除 #43 / #44 交叉引用 2 条、#68–#74 修复登记 7 条），#101–#112 为 12 条（2026-10-23 两节），本批追加 #113–#115 为 3 条。合计 91 + 12 + 3 = **106 条**。文件头已同步修正为 106 条（#1–#115）。
