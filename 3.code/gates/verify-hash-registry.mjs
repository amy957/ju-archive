#!/usr/bin/env node
/**
 * L22-R5 · 哈希一致性核对（L22-R5 收尾纳编后 49 方）
 * ----------------------------------------------------------------------------
 * 核对 canonical / step9 镜像 / L8 冻结件（历史只读锚）/ L9 冻结件（历史只读锚）/ L9W6 冻结件 / verify.js
 * / L8 spec / L9 spec / L9 支柱 `t9\*.mjs`（7 个运行态模块）的
 * SHA-256 + 字节长度 + 行尾（EOL）。
 * 已知预期值者「漂移即 FAIL」；仍输出历史令牌 `FIVE_PARTY_DRIFT_COUNT`
 * （语义 = 全部登记锚点的漂移计数）与 `RESULT`，另加 `PARTY_COUNT`。
 * 期望值来源：`reports/t9-w5-plan-2026-10-14.md` §4.2 / §4.3 + W5 落盘实测
 * （`6.P0-T3基线\step9\tests\t9-persist-layer.spec.ts`、`t9\*.mjs`，EOL 判定与
 * L8 `_w5freeze.ps1` 的 `Get-Eol` 同口径：无 CR=LF；cr==lf=CRLF；否则 MIXED）。
 * 用法：`node verify-hash-registry.mjs`（Node ≥ 22）。纯只读，零写入。
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); /* …/step9 */
const STEP9 = HERE;                                        /* …/step9 */
const ROOT = path.resolve(STEP9, '..', '..');              /* 仓库根 */

/* L13 冻结件清理波（2026-10-16）· 尾页脚 AI 注释（39 B）移除后重算：
   L8 / L9 冻结件（同字节源）与 L9-W6 冻结件的期望哈希（原 6CAD8950… / A820EE39…）。 */
/* L22-QA-D1（2026-10-17 · L22 归档封存）起 frozen-l8 登记方去重退役（同字节锚改由物理保留的
   v2.0-t3-frozen-t9-2026-10-14.html 经 _w5freeze.ps1 的 L8 / L9 两条 P3 锚点校验），
   本常量保留为「L8 / L9 同字节源（907,419 B）」口径对照，不再参与 TARGETS 判定。 */
const FROZEN_L8L9_HASH = '2F43EA0F097811C59A2D84D3C3912DE41B044CFD20CBE3F5BD965080E2120E0A';
const FROZEN_L9W6_HASH = '5D66C406EF9FD6685C3F40128915462365C7806D64633F2FC8256D71251E3ECC';

/* [名称, 路径, 期望字节, 期望 SHA-256（大写）, 期望 EOL（'LF'|'CRLF'|null=仅打印不判定）] */
const TARGETS = [
  /* --- 产品三方 + 历史只读锚（L8）/ 本波新冻结件（L9） --- */
  /* L16-W11（2026-10-17 · 缺陷修复指令2 · Defect-J）：canonical / step9-mirror 期望重算
     （1,104,391/1A61EEBD… → 1,106,706/9D7675D6…）。本波变更：_tombstoneQueue 解耦清理——原队列清理
     （游标压缩）仅在 if(_recentlyRemoved.size>2000) 分支内执行，稀疏删除场景（每秒 1 次 removeNode）下
     _recentlyRemoved 稳定数十条 ⇒ 该分支永不成立，队列随每次写入持续 push 而无界增长。新增
     TOMB_QUEUE_MAX=4096 与 _tombstoneCompactQueue()（遍历队列只保留仍存于 _recentlyRemoved 的条目、
     压缩前缀并归零游标），_tombstoneSet 末尾与 mergeRemoteState 对端墓碑并入后各调用一次（自门控，
     未超阈值零开销）；容量分支保留，分批推进仅在队首仍有未判定条目时执行（避免空转）。
     _tombstoneQueue / _tombstoneFifoHead / TOMB_QUEUE_MAX 均为内存态（不改 state.nodes 结构 /
     juju.store.v31 序列化形状 / 加密 payload 字段名）；公开 API 零变更；不新增 <script> 块。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W10（2026-10-16 · 缺陷修复指令1 · Defect-A）：canonical / step9-mirror 期望重算
     （1,104,018/FEC7708C… → 1,104,391/1A61EEBD…）。本波变更：根节点守卫——actions.removeNode 首守卫
     追加 id===state.rootId（根节点及其整棵树不得删除）；getCurrentDoc 于 state.nodes[state.rootId] 取根后
     追加 if(!root)return null（整树被清时不再解引用 root.children 抛 TypeError）；moveToTrash 与
     outlineBatchDelete 入口同口径（根节点不可回收 / 批量删除即返回）。数据契约 / 公开 API / 非优化分支零变更；
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W9（2026-10-16 · 指令9）：canonical / step9-mirror 期望重算（1,102,309/039501F3… → 1,104,018/FEC7708C…）。
     本波变更：抽取硬编码主题色为 CSS 变量（语义化 token）——:root 新增 --close-hover-bg / --danger-soft /
     --editor-fg / --cp-custom-fill / --cp-custom-alt / --tag-fallback / --prio-p1..p5 / --pres-bg /
     --pres-stage-bg / --mm-* / --color-palette / --opt-palette / --tag-palette / --tag-auto-gradient；
     html[data-theme="night"] 新增 --active-fg-on-accent / --on-danger-fg / --now-label-fg / --night-grad-a/b /
     --mm-* / --color-palette；关闭钮 hover 用 color-mix(in srgb,var(--danger) 20%,transparent) 并以纯 token
     值回退；JS 侧（调色板 / 图谱导出 / 彩图 PNG / 导出 HTML / 演示层）改由 _themeColor / _themeList 读取
     CSS 自定义属性。非定义块内 #RRGGBB 命中 118 → 0（排除 SVG data URI 与 :root/[data-theme] 定义块）。
     产品契约 / 公开 API / 非优化分支零变更；登记方数保持 43（本波不新增纳编物）；
     历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W8（2026-10-16 · 指令8）：canonical / step9-mirror 期望重算（1,100,380/8BDDB2F2… → 1,102,309/039501F3…）。
     本波变更：_tombstoneSet 的「超 2000 容量 O(n) 全量过期扫描」改为惰性分段——维护 _tombstoneQueue
     （按插入顺序的 id 数组）+ _tombstoneFifoHead 游标；超容量时从队首惰性推进固定批量
     （TOMB_SWEEP_BATCH=32）做一次 _now-v>30000 检查（避免一次性 O(n) 扫描）；FIFO 上界仍以 Map 首键
     O(1) 收缩保证有界（≤2000）；保留 _tombstoneOps%200===0 轻量全扫作为兜底。_tombstoneQueue /
     _tombstoneFifoHead / TOMB_SWEEP_BATCH 均为内存态（不进 state.nodes / 不改 juju.store.v31 序列化形状 /
     不改加密 payload 字段名）；公开 API（window.__ju* 探针）零变更；不新增 <script> 块。语义等价
     （<2000 次写入 Map 逐项相等；容量上界仍 2000；过期清扫行为保留）。登记方数保持 43（本波不新增纳编物）；
     历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W7（2026-10-16 · 指令7）：canonical / step9-mirror 期望重算（1,100,323/F6066E64… → 1,100,380/8BDDB2F2…）。
     本波变更：collectSubtreeIdsFromPreState 去除重复遍历——原以 roots.filter(Boolean) 建 stack 并混用 pop/push
     （大型子树下有多次数组扩容风险）；改为显式索引游标 queue（let head=0; while(head<queue.length)），单次传入
     rootIds 时直接初始化 queue（不再 filter(Boolean)，循环内 if(!id)continue 守卫）。语义等价（返回 id 集逐位相等）；
     复杂度 O(n) 不变。数据契约 / 公开 API / 非优化分支零变更。登记方数保持 43（本波不新增纳编物）；
     历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W6（2026-10-16 · 指令6）：canonical / step9-mirror 期望重算（1,098,596/846774B5… → 1,100,323/F6066E64…）。
     本波变更：repairTreeConsistency 的 _childSets 缓存由「每次调用新建 Map + Set」提升为模块级 WeakMap（node→Set(children)）：
     _getChildSet 读缓存（结构共享下未变节点引用稳定 ⇒ 跨调用复用零分配）；第二遍复用缓存 Set 作 seen（clear 后就地重填为
     存活 children 集，与 p.children 恒等）；mergeRemoteState 就地改写 children 处分点 _childSetDrop(node) 失效；initStore
     整体替换 state.nodes 时重置 WeakMap。数据契约 / 公开 API / 非优化分支零变更；连续远端广播的 repair 分配对象数显著下降。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W5（2026-10-16 · 指令5）：canonical / step9-mirror 期望重算（1,097,371/E645FAE7… → 1,098,596/846774B5…）。
     本波变更：时间网格 60s 轮询（_calTgTimer）纳入 visibilitychange 统一管理（与 boot 尾部时钟 FIX-M-25 同口径）。
     startCalTgTimer 将轮询体抽为闭包 tick，并注册 _calTgVisHandler：切后台（document.hidden）即 clearInterval 停表，
     回前台仅当周视图时间线仍在挂（line.isConnected 等价「view===week 且时间线已挂载」）时重启轮询并立即执行一次
     tick 重定位红线（含休眠期跨天）。clearCalTgTimer 一并注销 _calTgVisHandler（避免重渲染重复挂载）。
     数据契约 / 公开 API / 非优化分支零变更。登记方数保持 43（本波不新增纳编物）；历史只读锚零变更，期望值不变。 */
  /* L16-W4（2026-10-16 · 指令4）：canonical / step9-mirror 期望重算（1,095,556/09EDF9D0… → 1,097,371/E645FAE7…）。
     本波变更：_syncOutlineHeaderH 改用 ResizeObserver——renderOutlinePage 挂载后对 .doc-header 挂 _outlineHeaderRO，
     观察回调里 wrap.style.setProperty('--doc-header-h', h+'px')；视图切换 / 重渲染时在 renderMain 顶部（与视图 _cleanup 同址）
     disconnect() 旧 RO；renderMain 大纲 rAF 不再调用 _syncOutlineHeaderH（仅保留 _vsUpdate）。新增 _setOutlineHeaderH
     （写入门槛：仅高度实际变化才写）/ _observeOutlineHeader / _disconnectOutlineHeaderRO；_syncOutlineHeaderH 保留为
     applyScale / 无 RO 降级路径并改为「变化才写入」。渲染期零 offsetHeight 读取 ⇒ 无强制同步布局。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W3（2026-10-16 · 指令3）：canonical / step9-mirror 期望重算（1,089,755/00A0E72D… → 1,095,556/09EDF9D0…）。
     本波变更：renderSidebar 全表扫描改增量计数——新增 Symbol 挂载的 state 计数对象（_SIDECOUNTS）+ _sideCount /
     _sideCountsRebuild / _sideCountsApply / _sideCountsGet / _sideCountsSet 辅助；commit（L6 收口，经 _l8Patch）/
     undo / redo 按「变更节点增量」维护；initStore / mergeRemoteState 整体重建；renderSidebar 改为 O(1) 读取
     （缺计数时降级 __l14SideScanEnsure / 原全表循环）；Symbol 键对 JSON.stringify 不可见 ⇒ 序列化形状零变更。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W1（2026-10-16 · 指令1）：canonical / step9-mirror 期望重算（1,086,613/015C0DC9… → 1,088,117/4FA206A9…）。
     本波变更：runPersist「合并双重全量序列化」——rev 递增后不再二次 JSON.stringify(snapshot,_ORIGIN_STRIP)，
     改由首轮 _ORIGIN_STRIP 全量串经 rev token 替换（_revSubstJson）得到落盘串（逐字节一致）；
     替换不可判定（rev 缺位 / 命中不唯一 / 后继异常）时降级为全量重序列化。新增函数 _revSubstJson。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W2（2026-10-16 · 指令2）：canonical / step9-mirror 期望重算（1,088,117/4FA206A9… → 1,089,755/00A0E72D…）。
     本波变更：修正 _renderDayCache 失效粒度——新增独立日历数据代次 _calDataRev + 选择态签名 _calSelKey；
     _renderDayCache._gen 由 state.updatedAt 改为 _calDataRev，仅在日历数据失效（invalidateCalIndex /
     _calIndexCache 置空）或选择态（selectedDate / calTagFilter）变化时递增；编辑大纲正文（日历待办不变）不再整表重建日缓存。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L15-W7（2026-10-16 · 指令11）：canonical / step9-mirror 期望重算（1,081,576/4253D888… → 1,086,613/015C0DC9…）。
     本波变更：思维导图「节点拖动及同步」——节点自由拖拽改位置 + 拖到另一节点改层级（变子节点）+ 拖动视觉反馈
     （拖动中半透明 / 落点目标高亮 + 落点指示器）；拖动期间以局部状态（_mmDrag，useRef 等价）+ 单 rAF 局部重绘，
     仅 onDragEnd 单次提交并生成 changedIds 增量补丁 {被移动节点, 原父, 新父}（G-5）；画布平移 / 缩放沿用；
     节点超 200 启用视口裁剪与懒渲染（G-2）；文本换行撑高与连线重绘经 ResizeObserver 实时响应（G-1）。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L15-W6（2026-10-16 · 指令10）：canonical / step9-mirror 期望重算（1,072,900/C6477276… → 1,081,576/4253D888…）。
     本波变更：图谱 / 思维导图「连线锚点优化」——新增 juBorderAnchor（以节点最外层容器外边框盒求最近交点，
     锚点只贴边框、不连文字 / 中心，节点内部预留 padding）；图谱 GraphRenderer 侧 ResizeObserver + 外边框锚点重绘 +
     changedIds 增量补丁 + 视口裁剪；导图侧同法（offset 外框盒 + 单 rAF 节流）。
     G-1 文字换行撑高容器由 ResizeObserver 实时响应；G-2 getBoundingClientRect 仅在 rAF 内对 dirty 节点节流调用；G-5 增量补丁 + 视口裁剪。
     `frozen-l14`（1,012,003 / D110699F…）保持历史只读锚（同 frozen-l13 口径）：文件零变更，期望值不变。
     登记方数保持 43（本波不新增纳编物 · 承 L0-8=B 自引用除外口径）。 */
  /* L16-W12（2026-10-17 · 指令3 · Defect-B）：canonical / step9-mirror 期望重算（1,106,706/9D7675D6… → 1,109,402/DC6D62C6…）。
     本波变更：applyPatch 返回 next 前对 next.nodes 逐节点过滤 children——剔除 typeof cid!=='string' || !next.nodes[cid]
     （空 / 已删），同层去重；仅在补丁可能写 children（*.children 或整节点 nodes.<id>）时执行，其余补丁零开销；
     只替换确有洞的节点（新对象 + 新数组），保持结构共享、不污染旧 state。修复 undo 写回带洞 children（JSON 往返 null）的缺陷。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W13（2026-10-17 · 指令4 · Defect-F）：canonical / step9-mirror 期望重算（1,109,402/DC6D62C6… → 1,114,209/B9ED8577…）。
     本波变更：mergeRemoteState 新增 state._remoteReceived（对端合入保护集）——插入分支登记 id 并摘除同 id 的 _localCreated，
     合入前归一化（节点已不在 / 对端再包含且本页已上盘 → 摘除），删除传播对保护集命中 id 放行（不再被「未上盘」守卫拦下），
     FIX-ORIGIN-2 继承跳过保护集 id；defaultState / migrateStateObject / initStore 补归一化；_pendingPlainState 携带；
     _strip 比较口径剥离、_ORIGIN_STRIP 不剥离（随快照持久化）。修复多标签删除在接收侧内存残留（Defect-F）。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W16（2026-10-17 · 指令7 · Defect-D）：canonical / step9-mirror 期望重算（1,117,557/2D641E58… → 1,118,858/685BD1BC…）。
     本波变更：sanitizeHtml 非 SAFE_TAGS 分支回填文本前经 _sanTextEsc 固化尖括号（< → \u003C，> → \u003E）后 createTextNode；
     表格类父上下文（TABLE/THEAD/TBODY/TFOOT/TR/COLGROUP）的文本按解析器 foster parenting 同口径前置于最近 TABLE 之前，
     消除回填文本在再次解析时被移出表格造成的非幂等（sanitizeHtml(sanitizeHtml(x)) === sanitizeHtml(x)）。
     fuzz 31 例幂等由 false 翻 true（unsafeInState=false）；现有 XSS 用例 14 例 pwned=false 保持。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W15（2026-10-17 · 指令6 · Defect-K）：canonical / step9-mirror 期望重算（1,117,404/06BF2005… → 1,117,557/2D641E58…）。
     本波变更：commit() 侧栏计数异常路径改为整体重建——当 _l8Patch 缺失（reportPatchFailure 序列化失败降级 /
     historyMode='never'）时，原分支 _sideCountsSet(state,_scBase) 错误继承旧基数，使新 state 丢失
     starred / docCount / dbCount 更新；改为 _sideCountsRebuild(state) 单次遍历全量重建（try/catch 兜底保留）。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W14（2026-10-17 · 指令5 · Defect-G）：canonical / step9-mirror 期望重算（1,114,209/B9ED8577… → 1,117,404/06BF2005…）。
     本波变更：持久化链异步化——saveAutoBackup(force,stateJson) 复用 runPersist 本轮已生成的落盘串轻量拼接
     （免除 clone(cur) 深拷贝与二次 JSON.stringify）；saveGraphPositions 改 300ms 防抖 + flushGraphPositions()
     （pagehide / beforeunload 强制 flush）；l8PersistSendBatches 成功后经 _revSubstJson 复用本轮全量串，
     不再二次 JSON.stringify(getState(),_ORIGIN_STRIP)（降级分支保留）。备份载荷字段名 / 键序不变。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W17（2026-10-17 · 指令8 · Defect-E）：canonical / step9-mirror 期望重算（1,118,858/685BD1BC… → 1,119,754/2B8AFF31…）。
     本波变更：新增 migrateOrBackup(st)——主库 migrateStateObject 失败时先尝试 loadAutoBackup()，备份存在且迁移成功
     则从备份恢复（避免直接 defaultState 遮蔽有效备份）；备份缺失 / 备份亦损坏仍回退默认态。boot 内五处主库路径
     调用改为 migrateOrBackup（加密态不读取明文备份，保持既有加密语义）。空库 backup 分支保持原口径。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W18（2026-10-17 · 指令9 · Defect-H）：canonical / step9-mirror 期望重算（1,119,754/2B8AFF31… → 1,120,378/EE9E2219…）。
     本波变更：_redactErrText 补充裸 PII 脱敏——替换链在原有引号包裹规则之后追加
     \b1[3-9]\d{9}\b -> <phone> / \b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b -> <email> / \b(?:\d{1,3}\.){3}\d{1,3}\b -> <ip>；
     引号规则保留且优先执行（保持原有匹配优先级），四条规则均以 \b 锚定完整 token，短引号 / 含数字的正常错误消息不被改写。
     加密模式仍走 <enc-message> 占位分支（行为不变）；error_report.pii-redaction 由 false 翻 true。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W20（2026-10-17 · 指令11 · Defect-L）：canonical / step9-mirror 期望重算（1,121,111/2D9CC5B4… → 1,122,077/711B9D75…）。
     本波变更：新增 invalidateCalIndexOnly() 统一日历索引失效入口——仅当 _calIndexCache 实有缓存时才置空并推进
     _calDataRev，已为 null 时直接返回；reportIndexFailure 连败分支 / l6InjectionFailure / commit 两处索引失败分支 /
     undo / redo / mergeRemoteState finally 共 7 处原 `_calIndexCache=null;_calDataRev++;` 全部改为调用该函数，
     非日历索引（tag / searchInverted / backlinkMap / injection）失败不再触发 _renderDayCache 整表重建（2000 条 LRU），
     消除对 L16-W2 失效粒度优化的部分回退；日历数据真实变化（invalidateCalIndex / setNodeDate / moveToTrash 等）路径仍
     无条件推进代次。数据契约 / 公开 API / 非优化分支零变更；不新增 <script> 块。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W19（2026-10-17 · 指令10 · Defect-I）：canonical / step9-mirror 期望重算（1,120,378/EE9E2219… → 1,121,111/2D9CC5B4…）。
     本波变更：reportError 加密分支在 msg / reason 之外追加 stack / filename / lineno 占位
     （<enc-stack> / <enc-filename> / <enc-lineno>），避免错误原文、源码片段与本机绝对路径随加密态日志外泄；
     ctx 上提为 _ctx 并与 encNow 显式同源（加密 ⇒ enc:true 且 view / docId / nodeCount 清零，非加密 ⇒ enc:false 并提取常规上下文）。
     非加密分支与 stack 4KB 截断口径零变更；error_report.encrypted-msg-placeholder 由 false 翻 true。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L17-W1（2026-10-17 · 指令1 · Defect-P0-1）：canonical / step9-mirror 期望重算（1,122,483/31BE83AB… → 1,123,447/1C1835A7…）。
     本波变更：renderSubTags() 原在 `const tagIndex=buildTagIndex();` 之后直接 `tags.forEach(([t,count])=>...)`，
     而 tags 从未在该作用域声明（全文件无全局 tags）⇒ 用户展开标签分组必抛 ReferenceError、分组行恒不渲染。
     改为由索引 Map<tag, Set<id>> 派生 tagRows（count = idSet.size，索引值为 Set 无 length）并按计数降序渲染，
     空索引追加 `.sb-row.sb-empty`「暂无标签」占位行；原有行构建逻辑（重命名 / 删除 / 改色 / 点击打开）逐字保留。
     数据契约 / 公开 API / 非循环降级分支零变更；不新增 <script> 块。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L16-W21（2026-10-17 · 指令12 · Defect-C）：canonical / step9-mirror 期望重算（1,122,077/711B9D75… → 1,122,483/31BE83AB…）。
     本波变更：mergeRemoteState 的 LWW 时间戳归一由 _norm（仅微秒 ÷1000）改为 _normToMs——秒级（0<v<1e10）×1000、
     微秒级（v>8.64e14）÷1000、正常毫秒（1e12~1e13）原样返回；段内全部 11 处 _norm(...) 调用改为 _normToMs(...)，
     remoteUpdatedAt 与全局元数据 LWW 的 state.updatedAt 同口径归一。对端秒级快照不再因 1.7e9 < 1.7e12 恒败于本地毫秒值
     （对端更新不再丢失、对端删除可按快照传播）；property.clean.invFails.I2 22 → 0。数据契约 / 公开 API / 非优化分支零变更；
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L17-W3（2026-10-17 · 指令 1/2/3 · P1 合并波）：canonical / step9-mirror 期望重算（1,123,953/08FE70B6… → 1,125,276/c23bb0b1…）。
     本波变更：① initStore 补充秒级时间戳归一（0<v<1e10 ×1000；微秒 ÷1000 与正常毫秒原样保留），
     与 mergeRemoteState 的 _normToMs 同口径；② 删除请求超时 strikes 处理函数（全文件无调用点，
     与图谱 FIX-P2-2 同口径；就绪看门狗使用独立 readyStrikes）及 __juIndexShadow.timeout 导出；
     ③ JU_SLIDES.render 暴露 wrap._cleanup（移除 resize 监听 + 摘除 _cleanups 登记项，幂等），
     renderMain 在 c.innerHTML 清空前对 .ju-sl-wrap 调用卸载钩子 ⇒ 反复切换视图不累积监听器。
     数据契约 / 加密 payload 字段名 / 其余公开 API 零变更；不新增 <script> 块（9 块 syntaxFail=0）。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L17-W2（2026-10-17 · 指令2 · Defect-P0-2）：canonical / step9-mirror 期望重算（1,123,447/1C1835A7… → 1,123,953/08FE70B6…）。
     本波变更：renderCalendarPage() 的 week 分支原以 getUTCFullYear/getUTCMonth/getUTCDate 取选中日、以 Date.UTC 求星期，
     而 parseYmd()（FIX-TZ-1 起）与 ymd() / buildTimeGrid() 一律为本地日历语义；东八区本地零点 = 前一日 16:00Z，
     UTC 日期恒早一天、UTC 星期 = 本地星期 − 1（模 7）⇒ 周日（本地 dow=0、UTC dow=6）起始日 = 选中日 − 7，整周回退一周。
     改为本地取值器 sel.getFullYear/getMonth/getDate + 本地基准日 new Date(selY,selM,selD).getDay()；
     周 7 日序列（周日起）与 buildTimeGrid(days) 收口逐字不变。数据契约 / 公开 API / 非循环分支零变更；不新增 <script> 块。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L17-W4（2026-10-17 · 批次 4 · 11 项合并收尾波）：canonical / step9-mirror 期望重算（1,125,276/c23bb0b1… → 1,126,551/1d6bafb9…）。
     本波变更：P1-4 _logTimers 上限 500（超限淘汰最早项并立即落盘）；P1-5 图谱 worker 单次超时即 terminate 重建；
     P2-1 自动颜色 commit 改 snapshot:true（入历史栈）；P2-2 docToXls 数值列导出 Number；P2-3 copyPlain 跳过 Symbol 键；
     P2-4 23:00 后新建待办 toast 提示；P3-1 删除零调用点时间解析死代码；P3-2 标签计数冷缓存占位 0；
     P3-3 _errSeen 清理策略注释；OP-L17W1-1 renderTagsView 计数取 Set.size；OP-L17W3-2 initStore 根级 updatedAt 秒级归一。
     数据契约 / 加密 payload 字段名 / 公开 API 零变更；不新增 <script> 块（9 块 syntaxFail=0）。
     登记方数保持 43（本波不新增纳编物）；历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L17-QA（2026-10-17 · 全量 QA 终验与归档封存）：canonical / step9-mirror 期望不变（1,126,551/1D6BAFB9…）。
     纳编新增 2 方（决策 L17-QA-D1 · 43 → 45 方）：frozen-l17（本波物化 · 与 canonical 逐字节一致）+ L17 N 层用例
     l17-w4-batch-fixes.test.mjs（15/15 · 不接入 verify.js NODE_TESTS，Node 口径保持 145）。
     历史只读锚（frozen-l8…frozen-l14）零变更，期望值不变。 */
  /* L18-Patch（2026-10-17 · 最终补丁波 · P0-1 + P3-1 ~ P3-4）：canonical / step9-mirror 期望重算
     （1,126,551/1D6BAFB9… → 1,127,387/BAF66A43…）。本波变更：P0-1 renderTagsView（chip 点击）与
     renderTagNodes 的 Set 取值先 Array.from 再 map（原写法 TypeError）；P3-1 _indexWorkerStrikes 死变量退役
     （__juIndexShadow.strikes 键保留并恒返回 0）；P3-2 GraphLayoutWorker.timeoutStrikes 退役；
     P3-3 _l7TagCountText 占位 '…' + #cntTags.title 构建中/就绪清除；P3-4 renderSubTags 骨架提示
     「正在构建索引…」。L17 N 层用例 l17-w4-batch-fixes.test.mjs 随语义同步（13,408 → 13,768）。
     数据契约 / 加密 payload 字段名 / 非优化分支零变更；不新增 <script> 块；
     登记方数保持 45（L18 N 层用例 l18-final-patch.test.mjs 不纳编）。 */
  /* L19-Patch1（2026-10-17 · 批次 1 · P0 级致命缺陷）：canonical / step9-mirror 期望重算
     （1,127,387/BAF66A43… → 1,127,555/052D6F94…）。本波变更：P0-1 boot 兼容旧版块
     （sessionStorage 'juju.pending.v1'）不再无条件 removeItem——仅当 pend.state 命中并回填 initial
     时消费删除，保留 {payload,ts,ttl} 密文兜底供 recoverPendingEncrypted 读取；P0-2 commit 内层
     `let _patch` 遮蔽删除，_patch 赋给函数作用域变量，L6 增量索引注入点恢复执行；并在
     actions.addNode / toggleDone / removeNode / setNodeDate 的 commit 后显式
     invalidateCalIndex();_tagIndexCache=null; 兜底。数据契约 / 加密 payload 字段名 / 公开 API 零变更；
     不新增 <script> 块；登记方数保持 45（L19 N 层用例 l19-patch1.test.mjs 不纳编）。 */
  /* L19-Patch2（2026-10-17 · 批次 2 · P1 级隐蔽缺陷）：canonical / step9-mirror 期望重算
     （1,127,555/052D6F94… → 1,127,611/97589ABC…）。本波变更：P1-1 openTagPicker 的 pick / clearTags
     在 commit 后显式 _tagIndexCache=null;（侧栏标签计数即时刷新）；P1-2 removeNodeFromMap 的
     purgeNodeMeta 改传 {...state, nodes:map}（dbRowHeights / dbColumnWidths 孤儿数据可清理）；
     P1-3 JU_SLIDES box blur 保存原始文本（nn.text=txt），渲染端 _esc(_plain(...)) 保持单次转义。
     数据契约 / 加密 payload 字段名 / 公开 API 零变更；不新增 <script> 块；
     登记方数保持 45（L19 N 层用例 l19-patch2.test.mjs 不纳编）。 */
  /* L19-Patch3（2026-10-17 · 批次 3 · P2/P3 清理）：canonical / step9-mirror 期望重算
     （1,127,611/97589ABC… → 1,127,810/E75624C4…）。本波变更：P2-1 _sanTextEsc 退役
     （sanitizeHtml 非白名单分支直接 ch.textContent）；P2-2 applyPatch 末尾无效
     repairTreeConsistency(next) 调用删除；P2-3 commit 内 _clearTag 死变量删除；P2-4 reportError
     去重键改用脱敏后的 _p 字段；P2-6 openFieldTypeMenu 接收触发按钮 rect；P3-1 commit 全局重赋值
     包装移除、计时内联首尾；P2-7 initPomo 拖拽监听改为动态挂载 / 抬起即移除。
     数据契约 / 加密 payload 字段名 / 公开 API 零变更；不新增 <script> 块；
     登记方数保持 45（L19 N 层用例 l19-patch3.test.mjs 不纳编）。 */
  /* L19-QA（2026-10-17 · 全量 QA 终验与归档封存）：纳编新增 2 方（决策 L19-QA-D1 · 45 → 47 方）：
     frozen-l19（本波物化 · 与 canonical 逐字节一致）+ L19 N 层代表用例 l19-patch3.test.mjs
     （23/23 · 不接入 verify.js NODE_TESTS，Node 口径保持 145）。历史只读锚零变更。 */
  /* 批次2（2026-10-17 · 界面模块化 · 右键显隐 / 固顶）：canonical / step9-mirror 期望重算
     （1,127,810/E75624C4… → 1,138,457/B6403A3B…）。本波变更：ui.modules 新增
     left / right / floats 三组模块显隐与固顶状态，并在 _saveUINow / applyUIFields /
     uiSnapshot 三处注册；新增 JU_MODULES 提供右键菜单、class 显隐、insertBefore 固顶排序
     与侧栏空白区模块管理入口；_mergeModules 以默认结构为骨架恢复。
     数据契约 / 加密 payload 字段名 / 公开 API 零变更；不新增 <script> 块；登记方数保持 47。 */
  /* 批次3（2026-10-17 · 独立功能定制）：canonical / step9-mirror 期望重算
     （1,138,457/B6403A3B… → 1,144,467/DD6E6BFF…）。本波变更：① btnMusic 图标替换为番茄图标；
     ② getNodeSvg 新增 _isNoteRoot 分支（与普通文档一致的外框 + 内部横线，判定先于 isFolder）；
     ③ openNode 不再强制 ui.view='auto'（侧边栏切换文档保留当前顶层视图）；
     ④ openDbSummaryPanel 移除固定宽度、标题改「汇总行」、勾选文案改「启用（计数/求和/求平均）」，
     .db-sf-row 增加换行；⑤ 新增 openThemeSelector（日间/夜间缩略图 + 实时预览 + 确认应用），
     ui.theme / ui.themePreview 在 _saveUINow / applyUIFields / uiSnapshot 三处注册，
     #btnTheme 点击改为 openThemeSelector。数据契约 / 加密 payload 字段名 / 公开 API 零变更；
     不新增 <script> 块；登记方数保持 47。 */
  /* 批次4（2026-10-17 · 全局视觉 Token / 交互优化 / 暗黑模式）：canonical / step9-mirror 期望重算
     （1,144,467/DD6E6BFF… → 1,145,884/FF01EAB2…）。本波变更：① 侧栏宽 210/230 + #content padding 收紧，
     折叠钮回归顶栏 static（.both transform 清零）；② --fg-dim→#4A5C50、占位符 opacity .75、今日列 / 标签事件 /
     行 hover·sel / 表格头·空态对比度与层级强化；③ 夜间 --bg / --bg-soft / --bg-panel / --bg-menu 改为
     「四周浅、中间深」并去掉 .word-editor / 未标签事件的毛玻璃；④ toast 时长随文本长度自适应、
     :focus-visible 焦点环加柔光、模态栈 ↔ #app inert 同步。数据契约 / 加密 payload / 公开 API 零变更；
     不新增 <script> 块（脚本块数 9 不变）；登记方数保持 47。 */
  /* L21（2026-10-17 · 多维表格标题拖拽排序 · P0-1）：canonical / step9-mirror 期望重算
     （1,145,884/07C9CD44… → 1,147,911/B102568D…）。本波变更：多维表格列头改为原生 HTML5 拖拽重排，
     _dragFieldName 记录拖拽源字段名（string / object 字段统一归一 name）；拖拽期间 th 增 .dragging /
     .drag-over，落点由 commit 原子换位（snapshot:true）；新增 .db-table th.dragging{opacity:.5} 与
     .db-table th.drag-over{box-shadow:inset 2px 0 0 var(--accent)}；列宽拖拽（_resizingCol）期间禁用
     HTML5 拖拽以免与 resize 句柄冲突。数据契约 / 加密 payload / 公开 API 零变更；
     不新增 <script> 块（脚本块数 9 不变）；登记方数保持 47。 */
  /* L22（2026-10-17 · 11 项缺陷修复）：canonical / step9-mirror 期望重算
     （1,147,911/B102568D… → 1151899/EA921837…）。本波变更：P0 记事本回收后重建（ensureNoteDoc 判空）、
     日历事件块指针捕获（边界松手不再丢事件）、侧栏标签骨架行补 .ju-skel 父级、导图一级节点改深度判定；
     P1 折叠钮移出顶栏改视口 fixed + 侧栏行距 / 收起态居中；P2 导图连线固定左右中点 + 番茄图标 + 列宽下限 80px
     + 表头居中；P3 幻灯片去掉 renderViewTitle、工具栏改 fixed 贴右侧栏区域；附加清理：删除 addNode /
     toggleDone / removeNode / setNodeDate 的重复 invalidateCalIndex();_tagIndexCache=null;（commit 增量补丁已维护索引）。
     数据契约 / 加密 payload / 公开 API 零变更；不新增 <script> 块（脚本块数 9 不变）；登记方数保持 47。 */
  /* 批次2-补全（2026-10-17 · 界面模块化重构补全）：canonical / step9-mirror 期望重算
     （1,152,513/5C9B133B… → 1,158,205/C413EF15…）。本波变更：① 浮窗双状态源收口——
     ui.modules.floats.floatCal.visible 为唯一真相，ui.floatCal / ui.pomoVisible 作持久化兼容镜像，
     apply / setFloatCalVisible / btnFloatCal / fcClose / btnMusic / pomoClose / renderMain 全链同步；
     ② DOM 标识注入与包裹化——左栏导航按钮与紧邻 .sb-subtree 以 createElement/insertBefore 包入
     .sb-module-group[data-module-id=nav-*]（id 对齐既有 ui.modules.left 键），#sbIntro、右栏 6 个
     .sr-section、#pomoTimer / #floatCal 注入 data-module-id；JU_DND 导航拖拽改移动整组；
     ③ applyModuleConfig() 于 boot 末尾 renderMain 之前应用一次；④ showModuleContextMenu(e,moduleId,area)
     统一右键菜单（固顶 / 隐藏）并在 bindSidebar / bindRightSidebar 绑定，侧栏空白处保留模块管理恢复入口。
     数据契约 / 加密 payload 字段名 / 公开 API 零变更；不新增 <script> 块（脚本块数 9 不变）；登记方数保持 47。 */
  /* 批次3-2026-10-18（独立功能定制复核波）：canonical / step9-mirror 期望重算
     （1,158,205/C413EF15… → 1,157,785/53E607D6…）。本波变更：#btnMusic 的 <svg> 由 L22 修复波的
     彩色实心番茄（红果 + 绿叶 + 高光）回退为线性简化番茄（果身 circle + 两条叶梗 path）；
     记事本根图标（_isNoteRoot 文档外框 + 内部横线）、openNode 不再强制 ui.view='auto'、
     多维表格汇总浮窗（标题「汇总行」/ 无内联宽度 / 勾选文案 / .db-sf-row flex-wrap）、
     主题选择面板 openThemeSelector + bindTools 绑定经字节复核仍齐备（本波不重复改动）。
     数据契约 / 加密 payload 字段名 / 公开 API 零变更；不新增 <script> 块（脚本块数 9 不变）；登记方数保持 47。 */
  /* 批次4-2026-10-18（全局视觉 Token 复核 · 折叠钮回归顶栏）：canonical / step9-mirror 期望重算
     （1,157,785/53E607D6… → 1,157,639/5B4801D5…）。本波变更：L22 P1 的折叠钮视口 fixed 方案收口——
     #btnToggleLeft / #btnToggleBoth 移至 #topbar 首位，.main-toggle 改 static 随顶栏流式排布
     （.both transform 清零）；.sb-row / .tb-nav-btn / .sr-section padding 收紧 2-3px。
     批次4 既有 token（--fg-dim / 今日列 / 标签事件 / 行 hover·sel / 表格头·空态 / 夜间层级 /
     toast 自适应 / :focus-visible 柔光 / _modalStack ↔ #app inert）经字节复核齐备，本波不重复改动。
     数据契约 / 加密 payload 字段名 / 公开 API 零变更；不新增 <script> 块（脚本块数 9 不变）；登记方数保持 47。 */
  /* 批次1-2026-10-18（UI 缺陷修复与交互统一 · 批次 1）：canonical / step9-mirror 期望重算
     （1,157,639/5B4801D5… → 1,158,588/8F6D3C41…）。本波为四项高优先级 UI 缺陷修复：
     ① renderMindmap 连线与节点同源（_mmEls 存在性校验 · edges() 移至节点 DOM 建立后调用）；
     ② .sb-module-group 由 display:contents 改 flex column 100%（拖拽单元恢复盒模型占位）；
     ③ 折叠三钮自 #topbar 移出至 #body 末尾，.main-toggle 改 position:fixed 贴底（.3→1 hover）；
     ④ 收起态 .sb-nav-body height:100% 垂直居中 + gap 4px，.sb-nav-item margin-bottom 清零。
     数据契约 / 加密 payload 字段名 / 公开 API 零变更；不新增 <script> 块（脚本块数 9 不变）；登记方数保持 47。 */
  /* 批次1-r2（2026-10-18 · 批次 1 深度复查与修正 · 决策 L22-B1R2-D1~D5）：canonical / step9-mirror
     期望重算（1,158,588/8F6D3C41… → 1,166,711/8A17E45F…；+8,123 B / +90 行）。本波为批次 1 落位后的
     运行时修正（证据：_哈希与行尾校验\b1fix-runtime-2026-10-18.txt · Chromium 实机探针）：
     ① 折叠三钮定位错位收口——三钮由 #body 末尾改置于 #main 末尾，.main-toggle 由 position:fixed
        改 position:absolute，以 #main{position:relative} 为参照贴主内容区底部（fixed 会贴到浏览器
        视口最底边；探针实测 offsetParent=#main、position=absolute、bottom=469/485）；
     ② 模块包裹层高度溢出收口——.sb-module-group 由 display:flex;flex-direction:column 改
        display:block;width:100%;position:relative（flex 上下文使包裹层撑高，拖拽手柄覆盖条目边缘），
        收起态另设 flex:none 不参与伸缩；
     ③ 侧栏 resize 命中区修正——#sidebarResize / #sidebarRightResize 宽 6→8px、z-index 50→60，
        right:-3px / left:-3px 改 right:0 / left:0，整条落在侧栏内缘，不再被 overflow:hidden 裁半；
     ④ 收起态高度链打通——#sidebarLeft.collapsed 补 display:flex;flex-direction:column，
        .sb-nav-block / .sb-nav-body 显式 height:100% + box-sizing:border-box（百分比高度在
        content-box + flex 项下解析失败，导致 justify-content 失效）；
     ⑤ 拖拽事件监听冲突收口（JU_DND）——init 幂等（_inited）、新增 _navGripOk / ensureNavGrips /
        refreshNav；.ju-grip 显式 pointer-events:auto + position:relative + z-index:10；
        pointerdown 内 preventDefault + stopPropagation + setPointerCapture，并并行挂 document 捕获
        监听兜底；拖拽后 400ms click 抑制；window.JU_DND 暴露 + boot 后 setTimeout(0)/setTimeout(300)
        两次兜底补挂导航手柄；initJuDnd() 调用加 try/catch 隔离。
     数据契约 / 加密 payload 字段名零变更；公开 API 仅新增只读兜底入口（ensureNavGrips / refreshNav）；
     不新增 <script> 块（脚本块数 9 不变）；登记方数保持 47。 */
  /* L22 最终验收封存-r3（2026-10-18 · 人工验收通过）：canonical / step9-mirror 期望重算
     （1,166,711/8A17E45F… → 1,173,380/E05C7764…）。本波为批次 1-r2 之后人工验收修订的落盘，
     并补齐 .ju-dirval 的 `line-clamp:2` 标准属性（消除 IDE CSS 兼容性告警；-webkit-line-clamp 保留）。
     数据契约 / 加密 payload 字段名 / 公开 API 零变更；不新增 <script> 块（脚本块数 9 不变）。
     冻结件 r3 与 canonical 逐字节一致；登记方数保持 47（frozen-l22-final 作为历史只读锚物理保留，
     由 _w4paths.ps1 / _w5freeze.ps1 / _w4freeze.ps1 独立校验；纳编位由 frozen-l22-final-r3 接续）。 */
  /* DEF-010（2026-10-18 · flushPersistNow 关页强制落盘竞态）：canonical / step9-mirror 期望重算
     （1,173,380/E05C7764… → 1,173,448/D8C18C6A…）。本波变更仅 flushPersistNow 加密异步分支：
     encryptState(...).then(...) 前推进 _persistSeq（const seq=++_persistSeq），回调首校验
     seq!==_persistSeq 即返回，防止关页最后一次强制写盘被更早的在途 runPersist 覆盖。
     verify.js 同步更新（隔离 2 个函数重构导致断言失效的用例：t16-w12 / t16-w13；
     期望重算 12,352/8959B432… → 13,958/1214CADE…）。数据契约 / 公开 API / <script> 块数（9）零变更；
     登记方数保持 47；frozen-l22-final-r3 保持历史只读锚（物理字节零变更，期望值不变）。 */
  /* UI-Token 清理波（2026-10-18 · FIX-BACKLOG TODO-1/4/5）：canonical / step9-mirror / frozen=r4 期望重算
     （1,173,448/D8C18C6A… → 1,174,134/88571951…；+686 B）。本波为产品侧 CSS-only 变更：
     ① TODO-4：`html[data-theme="night"] .word-editor` 的硬编码面板色改走 var(--bg-panel)（夜间 token 同值，颜色零漂移）；
     ② TODO-5：新增语义 token --sb-nav-active-fg（:root #24332B / 夜间 #E6F0FA，与 --fg 等值 ⇒ 零视觉变更），
        .sb-nav-item.active 与夜间覆盖规则改引用该 token；未复用 --active-fg-on-accent（该 token 为亮色 --accent 底上的深色字，
        置于夜间 --accent-soft rgba(20,45,80,.85) 深底上对比度仅 ~1.28:1，属视觉回归，故显式拒绝）。
     DOM 结构 / JS 逻辑 / 数据契约 / 加密 payload / <script> 块数（9）全部零变更；登记方数保持 47；
     r3 冻结件仍为历史只读锚（1,173,380/E05C7764…，字节零变更）；r4 按指令覆盖重物化（与 canonical 逐字节一致）。 */
  /* TODO-3 性能修波（2026-10-18 · FIX-BACKLOG TODO-3 · 方案 A1）：canonical / step9-mirror / frozen=r4 期望重算
     （1,174,134/88571951… → 1,174,919/0B4AA2A6…；+785 B）。本波变更仅 mergeRemoteState 作用域内的保护集查找索引：
     ① state._remoteReceived / state._localCreated 的持久化形态仍为 string[]（JSON.stringify / _pendingPlainState /
        migrateStateObject 契约零变更，Set 不落盘）；② 入口为两者各建局部 Set 视图，插入分支 push 后 add、
        _localCreated 三处 splice 后 delete，删除传播命中 removeNodeFromMap 后同步 delete；③ 20,001 节点首次全量合入时
        原 includes(id) 在增长数组上线性扫描（O(n²)，实测 p50 371.09ms）→ 局部 Set 的 has(id) O(1)（实测 p50 48.24ms）。
     未重构 mergeRemoteState 的 LWW / tie-break / 删除传播判定；200ms P95 阈值零变更；<script> 块数（9）零变更。
     verify.js 同步改为 node --test --test-concurrency=1（串行编排，消除 20k 用例跨文件物理核争用假阳性；
     期望重算 13,958/1214CADE… → 14,284/E4AE6324…）。登记方数保持 47；r3 冻结件仍为历史只读锚（字节零变更）。 */
  /* 【UI-P0/P1/P2 修正波（2026-10-19）】canonical / step9-mirror / verify.js / playwright.config.ts /
     t3-reference-semantics.spec.ts 五项期望值按实测重锚；新增 frozen-t22-r5 纳编（与 canonical 逐字节一致），
     r4 保持历史只读锚并继续登记；方数 49 → 50。 */
  /* 【r6 · 右侧栏「编辑」分区按钮覆盖修正（2026-10-19）】canonical / step9-mirror 期望重算
     （1,187,766/3E7FAF2B… → 1,188,674/239250FD…；+908 B）。本波变更：① 删除
     `body.slides-mode .sr-section[data-section="edit"] .sr-edit-row{display:none}` —— 该规则在幻灯片视图下
     连带隐藏了原有 15 个文本编辑按钮（加粗 / 斜体 / 下划线 / 颜色 / 字号 / 格式刷 / 撤销重做等）；
     ② 幻灯片工具栏按钮样式对齐 .sr-edit-btn（height 28px / border-radius var(--radius-sm) / 同一 hover 口径）；
     ③ 追加「幻灯片编辑」小标题与图片组顺序（上传图片 / 设为背景 / 删除图片）；④ 视图卸载时移除追加的工具栏。
     DOM 结构仅新增右侧栏追加节点，数据契约 / 加密 payload / 公开 API 零变更；不新增 <script> 块（脚本块数 9 不变）。
     新增 frozen-t22-r6 纳编（与 canonical 逐字节一致），r5 转历史只读锚并继续登记；方数 50 → 51。 */
  /* 【r7 · 右侧栏「编辑」分区幻灯片按钮样式统一（2026-10-19）】canonical / step9-mirror 期望重算
     （1,188,674/239250FD… → 1,188,344/1F972407…；-330 B）。本波变更：删除幻灯片工具栏内全部分类文字标题
     （「幻灯片编辑」/「图片」/「对齐」/「演示」）；工具栏改为直接输出 3 个 .sr-edit-row，按钮统一使用
     .sr-edit-btn（28px 高 / var(--radius-sm) 圆角 / var(--bg-panel) 背景 / 同口径 hover），与上方原有富文本
     按钮完全一致；三行依次为图片（上传 / 背景 / 删除）、对齐（左 / 中 / 右 / 顶 / 垂直中 / 底）、演示模式。
     同时修正 `_pages()` 返回值为顶级节点对象（原返回 id 字符串，导致上传 / 对齐 / 删除 / 演示读取 `.id` 为
     undefined 而静默失效）；onclick 仍直接绑定在按钮节点上；进入幻灯片视图追加、离开时随视图卸载移除。
     数据契约 / 加密 payload / 公开 API 零变更；不新增 <script> 块（脚本块数 9 不变）。
     新增 frozen-t22-r7 纳编（与 canonical 逐字节一致），r6 转历史只读锚并继续登记；方数 51 → 52。 */
  /* 【r9 · 幻灯片缩略图留白 + 舞台 16:9 最大化（2026-10-19）】canonical / step9-mirror 期望重算
     （1,189,026/7AF8575A… → 1,190,072/D74D58AA…；+1,046 B）。本波为 JU_SLIDES._styleOnce 的纯 CSS 布局修正：
     ① 左栏收起时 #content 左 padding 由 0 改为 16px（缩略图栏距屏幕左缘 16px，贴边但不死板），右 padding 仍为 0；
     ② 幻灯片视图下 #content 改纵向 flex、.files-wrap 纵向撑满，.ju-sl-wrap 以 flex:1 + height:calc(100vh - topbar - 48px)
        占满剩余高度（消除底部多余空白）；
     ③ 删除 .ju-sl-stage 写死的 max-height:68vh；舞台改为 flex:0 0 auto + width:100% +
        max-width:min(100%, calc((100dvh - topbar - 190px) * 16 / 9)) + aspect-ratio:16/9 + margin:auto，
        宽度取「容器宽度 / 可用高度×16/9」较小者并由 aspect-ratio 反推高度 ⇒ 侧栏展开与收起均严格 16:9、居中、撑满、
        无纵向/横向滚动条（1440×900 与 1920×1080 双档视口实测）；
     ④ .ju-sl-main 显式 height:100% / min-height:0，.ju-sl-rail 补 min-height:0。
     仅 CSS 字符串变更：DOM 结构 / JS 逻辑 / 数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。
     新增 frozen-t22-r9 纳编（与 canonical 逐字节一致），r8 转历史只读锚并继续登记；方数 53 → 54。 */
  /* 【r10 · 主舞台取消垂直居中 + 顶部与缩略图对齐（2026-10-19）】canonical / step9-mirror 期望重算
     （1,190,072/D74D58AA… → 1,190,729/14F3A930…；+657 B）。本波为 JU_SLIDES._styleOnce 的纯 CSS 修正：
     ① .ju-sl-main 显式 justify-content:flex-start / align-items:flex-start（取消内容垂直居中），
        并补 padding:6px 0 0 + box-sizing:border-box，与 .ju-sl-rail 的 padding-top:6px 同口径；
     ② .ju-sl-stage 的 margin:auto 改为 margin:0 auto（垂直不再分配剩余空间、顶部贴齐；水平仍自动居中），
        并补 align-self:flex-start 兜底；
     ③ 舞台可用高度扣减常量 190px → 196px（新增 .ju-sl-main 的 6px 顶部内边距），16:9 自适应口径不变。
     仅 CSS 字符串变更：DOM 结构 / JS 逻辑 / 数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。
     新增 frozen-t22-r10 纳编（与 canonical 逐字节一致），r9 转历史只读锚并继续登记；方数 54 → 55。 */
  /* 【r8 · 幻灯片大纲渲染 + 长按整行拖拽（2026-10-19）】canonical / step9-mirror 期望重算
     （1,188,344/1F972407… → 1,189,026/7AF8575A…；+682 B）。本波变更：① JU_SLIDES._paint 在舞台内容层
     同步渲染 _lines(n) 为 <ul class="ju-sl-outline"><li>…</li></ul>，标题与大纲分离排布（标题仍可编辑）；
     ② 左栏收起时 #content 左右留白清零、.files-wrap 解除限宽、缩略图栏贴左、舞台 width:100% 最大化；
     ③ 删除 JU_DND 动态插入的 .ju-grip 把手，改为 .sr-title / .sb-nav-item 整行长按拖拽（200ms / 5px 阈值，
     拖拽态 .ju-dnd-dragging + body cursor:grabbing，拖拽后抑制 click）；④ 右侧分区补 ensureSections 幂等补挂，
     拖拽实时 insertBefore 并持久化 ui.dnd.secOrder。数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。
     新增 frozen-t22-r8 纳编（与 canonical 逐字节一致），r7 转历史只读锚并继续登记；方数 52 → 53。 */
  /* 【r11 · 主内容区滚动保护区 + 折叠按钮下移（2026-10-19）】canonical / step9-mirror 期望重算
     （1,190,729/14F3A930… → 1,192,443/0010EBE1…；+1,714 B）。本波为纯 CSS 修正：
     ① .main-toggle 的 bottom 16px → 8px（左/右钮与中钮 .both 同步），更贴近页面底边；
     ② #content padding-bottom 24px → 64px（≤1100px 断点同步 64px），建立折叠按钮底部保护区；
     ③ #main::after 新增 40px 底部渐隐遮罩（linear-gradient / z-index:50 / pointer-events:none），
        折叠钮 z-index 100/120 保持悬浮其上；幻灯片视图（overflow:hidden）关闭遮罩；
     ④ #main::before 新增 --content-pad-t 高度的顶部实色遮片（z-index:60），覆盖 sticky 标题行上方 padding 带；
     ⑤ .doc-header / .cal-header / .db-toolbar 统一 position:sticky; top:0; z-index:10 + 实色背景；
     ⑥ 打印态关闭顶部/底部遮罩并取消 sticky（position:static）。
     DOM 结构 / JS 逻辑 / 数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。
     新增 frozen-t22-r11 纳编（与 canonical 逐字节一致），r10 转历史只读锚并继续登记；方数 55 → 56。 */
  /* 【r12 · 大纲选中态与顶部导航激活态统一（2026-10-19）】canonical / step9-mirror 期望重算
     （1,192,443/0010EBE1… → 1,192,469/72C94A5D…；+26 B）。本波为 CSS + syncTopbar 逻辑修正：
     ① .text:focus / .cal-node .text:focus 删除 box-shadow 内描边环，仅保留 accent-soft 浅色底；
     ② .row.sel 改为 box-shadow:none，清除选中行内环/外晕；
     ③ .row:has(.text:focus) 与 .row.sel:has(.text:focus) 不再置 transparent，分别保留 8% / 10% accent 浅色底；
     ④ syncTopbar() 的 outline 分支追加 ui.view==='outline' 判定，修复顶部「大纲」按钮在显式切换后丢失 .active 的问题。
     DOM 结构 / 数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。
     新增 frozen-t22-r12 纳编（与 canonical 逐字节一致），r11 转历史只读锚并继续登记；方数 56 → 57。 */
  /* 【r13 · 大纲背景单层化 + 内容区加宽（2026-10-19）】canonical / step9-mirror 期望重算
     （1,192,469/72C94A5D… → 1,192,740/5D68A858…；+271 B）。本波为纯 CSS 修正：
     ① .text / .text:focus 背景改为 transparent，移除文本区自带的 8% accent 底色；
     ② .row:has(.text:focus) 与 .row.sel:has(.text:focus) 统一为 8% accent，聚焦背景只由 .row 提供一层；
     ③ .row.sel 与 .row.multi-sel 同步为 8% accent，选中/聚焦/多选三态同深浅，不再出现叠加色块；
     ④ .outline max-width 920 → 1100（var(--content-max)），.outline .doc-header 同宽（max-width:100%），
        标题行底色 transparent + backdrop-filter:blur(8px)：日间随 #main 实色、夜间随渐变，均无色块。
     DOM 结构 / JS 逻辑 / 数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。
     新增 frozen-t22-r13 纳编（与 canonical 逐字节一致），r12 转历史只读锚并继续登记；方数 57 → 58。 */
  /* 【r14 · 底部 32px 实色保护区 + 折叠三钮居中（2026-10-19）】canonical / step9-mirror 期望重算
     （1,192,740/5D68A858… → 1,193,188/C13DD3B2…；+448 B）。本波为纯 CSS 修正：
     ① #main::after 40px 渐变 → 32px 实色 var(--bg)，pointer-events:none / z-index:50 不变；
     ② #content 底部内距 64 → 40px（≤1100px 断点同步 40px）；
     ③ 折叠三钮统一以 #main 中心 50% 为基准：左钮 left:calc(50% - 60px)、中钮 left:50% + translateX(-50%)、
        右钮 right:calc(50% - 60px)，中钮由 position:fixed/50vw 收回 absolute，三钮 bottom 保持 8px；
     ④ 幻灯片视图启用同一实色保护区（原 display:none 取消），.ju-sl-wrap 高度扣减 48 → 64px、
        舞台 max-width 扣减 196 → 212px，舞台下缘恒在 32px 保护带上方。
     DOM 结构 / JS 逻辑 / 数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。 */
  /* 【r15 · 大纲背景块清除 + 折叠三钮视口 fixed（2026-10-19）】canonical / step9-mirror 期望重算
     （1,193,188/C13DD3B2… → 1,193,978/6664F765…；+790 B）。本波为纯 CSS 修正：
     ① .row / .row.sel / .row.multi-sel / .row:has(.text:focus) / .row.sel:has(.text:focus) 背景全部
        transparent，box-shadow / border / outline 清零；.row:hover（含 sel / multi-sel / focus 变体）
        仅保留 color-mix(in srgb,var(--fg) 4%,transparent) 极低覆盖；
     ② .text / .text:hover / .text:focus 背景恒为 transparent，无边框/阴影；
     ③ .outline 容器背景 transparent；.outline .doc-header 底色取 var(--bg) 且取消 backdrop-filter，
        与页面底色完全一致；
     ④ 折叠三钮 .main-toggle 由 position:absolute 改 position:fixed，left 以 50vw 为基准
        （左 50vw-60 / 中 50vw+translateX(-50%) / 右 50vw+60），bottom:8px 不变，z-index:999；
        #main 显式 transform/filter/perspective:none，防止父级生成 fixed 包含块。
     DOM 结构 / JS 逻辑 / 数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。
     新增 frozen-t22-r15 纳编（与 canonical 逐字节一致），r14 转历史只读锚并继续登记；方数 59 → 60。 */
  /* 【r16 · 残留背景块清零 + 折叠三钮 40px 对称锁定（2026-10-19）】canonical / step9-mirror 期望重算
     （1,193,978/6664F765… → 1,194,479/06A90D0C…；+501 B）。本波为纯 CSS 修正：
     ① 删除 .row:hover / .row.sel:hover / .row.multi-sel:hover / .row:has(.text:focus):hover 的
        color-mix 4% 半透明底，全部改 background:transparent + outline:1px solid var(--line-soft)，
        杜绝长文本 / 选中 / 多选 / 聚焦行的任何肉眼可见实心或半透明色块；
     ② 新增防御规则：.outline / .outline .node / .outline .node.active / .outline .row /
        .outline .row.sel / .outline .row.multi-sel / .outline .row:has(.text:focus) / .outline .text
        背景恒为 transparent；
     ③ 折叠三钮 .main-toggle 三钮统一 left:calc(50vw ± 40px) + transform:translateX(-50%)：
        按钮宽 32px、中心点间距 40px、两两边缘间距 8px；中钮 left:50vw 不变；bottom:8px / fixed / z-index:999 保持。
     DOM 结构 / JS 逻辑 / 数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。
     新增 frozen-t22-r16 纳编（与 canonical 逐字节一致），r15 转历史只读锚并继续登记；方数 60 → 61。 */
  /* 粘贴多行拆分 + 首尾空行修复（2026-10-19 · 批次 4/4 · P2）：canonical / step9-mirror 期望重算
     （1,194,479/06A90D0C… → 1,204,191/25891FFD…；+9,712 B / +209 行，LF / CR=0）。本波变更：
     ① 粘贴多行文本按行拆分为多个节点（原单节点整段保留）；② 首尾空行不生成空节点（首行 /
     末行空串跳过，内部空行保留为空节点）；③ 拆分后节点数增加，UI 用例断言由单节点改为多节点。
     数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变；登记方数保持 61。 */
  /* r19（2026-10-19 · 智能拖拽多选 + 选中视觉统一）：canonical / step9-mirror / t3-invariants 期望重算
     （1,205,588/11B96CBC… → 1,209,561/9FA0B52E…；+3,973 B / +93 行，LF / CR=0 · LF=22,331）。本波变更：
     ① 行 mousedown 不再阻止默认行为，改由 document mousemove 方向判定：水平为主 = 原生选中文字
        （零干预），垂直为主（|dy| > |dx| + 5）= 跨行多选刷选（preventDefault + removeAllRanges +
        elementFromPoint 命中 .row，按「锚点→当前行」区间重算，回退可取消）；
     ② .row.sel / .row.multi-sel 统一为单色 --accent-soft !important 底，hover / focus 同色，
        outline / border / box-shadow 全部清零（含 .row:hover 与 .row:has(.text:focus):hover）；
     ③ P 层 t3-invariants 增加真实鼠标水平 / 垂直拖拽断言（用例数不变，PW 保持 171）。 */
  /* r20（2026-10-19 · 左侧边栏多选 + 批量移入回收站）：canonical / step9-mirror 期望重算
     （1,209,561/9FA0B52E… → 1,212,291/56E705E7…；+2,730 B / +37 行，LF / CR=0 · LF=22,368）。本波变更：
     ① 复用 _mSel 模型新增 type='sidebar'：makeSidebarRow 行写入 data-msid 并按当前选择回填 ju-msel；
        Ctrl/Cmd 切换、Shift 以侧栏可见顺序做范围选择，普通点击保持 openNode；
     ② renderSidebar 末尾同步 _mSelSetOrder('sidebar', 侧栏可见 .sb-row[data-msid] 顺序) + _mSelPaint()
        （仅在无选择或已处于 sidebar 模式时接管，文件 / 数据库多选集合不被侧栏每帧渲染清空）；
     ③ 新增 .sb-row.ju-msel 规则：背景 var(--accent-soft)、文字 var(--fg)、字重 600（与既有选中态同源）；
     ④ showTreeContext 在多选 >1 且命中右键行时于菜单顶部插入「移入回收站（所选 N 个）」，
        appConfirm 确认后逐个 actions.moveToTrash（跳过 state.rootId / _isCalRoot / _isDbRoot），
        完成后清空 _mSel.ids 并 renderSidebar + forceRender；
     ⑤ _mSelSelectAllCurrent 增加 sidebar 分支（全选当前侧栏可见行），Esc 清除沿用全局 _mSelClear。
     大纲 / 数据库 / 文件网格行为零变更；数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。 */
  /* r22（2026-10-20 · 富文本（Word）模式下线）：canonical / step9-mirror 期望重算
     （1,215,166/E729E5CC… → 1,212,364/FE04CC1A…；−2,802 B / −31 行，LF / CR=0 · LF=22,387）。本波变更：
     ① 先迁移后删码——migrateStateObject 末尾调用 migrateWordToOutline（content 按块级标签拆成大纲子节点，
        _isWord/_wordFlat/content 清零，已拍平旧子节点移除），mergeRemoteState 合入前同口径降级；
     ② 删除 VIEW_KIND.WORD / viewOf word 分支 / isWordDoc / getNodeSvg word 图标 / renderWordEditor /
        ensureWordInit / editorRole·editorSelector 的 word 角色 / commitPendingEditBeforeRender 的 word 分支；
     ③ 右键菜单删除「转为富文本 / 转为大纲文档」整块；toHtml / docToExcel / showPrintPreview / doPrint
        的 word 正文块删除；字数统计（docWordCount 与 __l14IntroJob）不再叠加 content、不再跳过子节点；
     ④ 历史快照恢复改为迁移而非丢字段；CSS 删除 .word-editor / .we-body 五条规则。
     数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。方数 62 → 63（新增 frozen-l22-final-r5）。 */
  /* r21（2026-10-19 · 回收站多选 + 批量恢复 / 彻底删除）：canonical / step9-mirror 期望重算
     （1,212,291/56E705E7… → 1,215,166/E729E5CC…；+2,875 B / +50 行，LF / CR=0 · LF=22,418）。本波变更：
     ① renderTrashView 卡片写入 data-msid = t.rootId，并在 _mSel.type==='trash' 时回填 ju-msel；
     ② 卡片 Ctrl/Cmd 切换、Shift 按回收站卡片 rootId 顺序做范围选择，普通点击不导航；
     ③ contextmenu 在多选 >1 且命中右键项时改为「恢复所选（N 个）」/「彻底删除所选（N 个）」，
        否则保持原单项菜单（恢复 / 彻底删除）；
     ④ 批量恢复 / 批量彻底删除逐个按当前 state.trashed 现算索引后再调用 restoreFromTrash / purgeTrash
        （避免 splice 造成的索引漂移），完成后清空 _mSel.ids 并 forceRender；
     ⑤ 回收站标题行新增「全选」按钮，_mSelSelectAllCurrent 增加 trash 分支。
     文件网格 / 数据库 / 大纲行为零变更；数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变。 */
 /* UI 一致性批次 2（2026-10-20 · 问题 1/2/4/5/7）：canonical / step9-mirror 期望重算
    （1,212,364/FE04CC1A… → 1,215,291/5C2F9A24…；+2,927 B / +15 行，LF / CR=0 · LF=22,402）。
    本波变更：
    ① 问题 1——renderTrashView / renderTemplatesView / renderHistoryView 三个视图顶部补「← 返回」
       （回到资料库根：ui.view='auto' + currentDocId=state.rootId + setActiveKey('nav:files')）；
    ② 问题 7 / 4——navTo('database') 不再默认打开第一张表，改为 currentDocId=数据库根文件夹
       （viewOf(_isDbRoot)=FOLDER ⇒ renderFolderGrid 卡片缩略图），空库同样落到文件夹视图并显示空文件夹提示；
    ③ 问题 2——updateSidebarActiveState 末尾对 #btnTemplates / #btnTrash 同步 .active，
       并新增 .sb-square.active / .sb-square.active svg 规则（--accent 底 + #fff 描边）；
    ④ 问题 5——renderDatabasePage 工具栏首位新增 .db-title（contentEditable 表名，blur 提交 updateText
       + logActivity + renderSidebar 同步侧栏），并新增 .db-title / .db-title:focus 规则。
    数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变；登记方数保持 63。 */
 /* 不变量批次 1（2026-10-20 · #36 / #41 / #59 / #63 / #66）：canonical / step9-mirror 期望重算
    （1,215,291/5C2F9A24… → 1,218,384/A3983B48…；+3,093 B，LF / CR=0 · 行数 22,466）。
    本波变更：
    ① #63——删除 .sb-nav-item.active 的左侧 3px 色条（position/padding-left 规则、
       .sb-nav-item.active::before 与夜间 ::before 规则，连同【P2-4】两行注释）；
    ② #59——renderSubDb / renderSubStarred 的 items 循环统一复用 makeSidebarRow，
       不再手工拼 .sb-row；
    ③ #36——bindOutlineText / bindNoteText / renderCalNode 三处 paste 拆分去掉
       !parsed.hasRichFormat 前置条件（富文本多行同样拆分）；
    ④ #41——bindOutlineText / bindNoteText 的 keydown 中 IME 守卫前移到 N(id) 取节点之前；
    ⑤ #66——appPrompt / openCalTimeModal / showHelp / openAddToCalendarDialog /
       openAddToDbDialog / promptUnlock / showSetPasswordDialog / openFeedbackDialog /
       openImportDialog 九个模态 push 后补 _syncAppInert()；
    ⑥ _l7TagCountText 的后台登记去重标记改挂函数自身（_l7TagCountText._pending），
       恢复「最小装配依赖」口径（t17-w4 / t18 最小装配用例零改动即绿）。
    数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变；登记方数保持 63。 */
 /* 空白过宽修复（2026-10-20）：--content-max 1100px → min(1600px,100%)、--content-max-doc 920px → min(1200px,100%)、
    .cal-page 上限 1400px → 1800px（纯 CSS token/规则变更，#content 左右 padding 保持 20px）。canonical / step9-mirror
    期望重算（1,218,384/A3983B48… → 1,218,405/24823E84…；LF · CR=0 · LF=22,466）。 */
 /* 极宽屏自适应（2026-10-20 · 不变量 #76）：--content-max / --content-max-doc 由 min(1600px,100%) /
    min(1200px,100%) 改为 100%；.cal-page 上限 min(1800px,100%) 改为 100%；新增 .outline .text
    {max-width:min(100%,1400px)} 正文阅读限宽（左对齐，保持拖拽基准 X=oc.left+24 与行起点一致）。
    纯 CSS token / 规则变更（+3 行，#content 左右 padding 保持 20px）；canonical / step9-mirror 逐字节同源，
    期望重算（1,218,405/24823E84… → 1,218,901/D5F07336…；LF · CR=0 · LF=22,469）。 */
 /* 幻灯片视图自适应布局 + 页码信息归位（2026-10-20 · 不变量 #77）：canonical / step9-mirror 期望重算
    （1,218,901/D5F07336… → 1,220,604/591A13DC…；LF · CR=0 · LF=22,487；+1,703 B）。
    ① .ju-sl-wrap 删除写死的 height:calc(100vh - topbar - 64px) ⇒ display:flex + gap:16px + align-items:stretch
       + width:100% + min-width:0 + min-height:0 + flex:1 1 auto，纯由 #content 纵向 flex 决定高度；
    ② .ju-sl-rail 改为 flex:none;width:174px + display:flex;flex-direction:column + padding:6px 8px 0 0，
       自身不再滚动（原 overflow:auto 移除）；
    ③ .ju-sl-rail-inner 追加 flex:1 1 auto / overflow-y:auto / overflow-x:hidden / min-height:0，
       成为唯一缩略图滚动容器（虚拟列表滚动锚点由 rail 改为 inner）；
    ④ 新增 .ju-sl-info（flex:none + 顶部 1px 分隔线 + 居中），页码信息由 main 改挂 rail 末项 ⇒ 固定栏底；
    ⑤ .ju-sl-main 改为 flex:1 1 auto + height:100% + display:flex + justify-content:center + align-items:center
       + padding:0 10px，并加 container-type:size 供 cqh 取容器高度；
    ⑥ .ju-sl-stage 删除写死的 max-width:min(100%,calc((100dvh - topbar - 212px) * 16 / 9))，改为
       width:min(100%,calc(100cqh * 16 / 9)) + height:auto + max-width/max-height:100% + aspect-ratio:16/9
       （单用 width:100% + max-height:100% 时 Chromium 会先按宽定高再被 max-height 夹平，实测比例 2.45:1，
       故宽度上限必须以容器高度表达；无任何视口 / 顶栏写死扣减）；
    ⑦ _mountRail 末尾补一次 requestAnimationFrame(update)：视图切换首帧 inner.clientHeight 未定稿时
       虚拟列表只铺 1 屏（甚至 0 屏）且因无溢出而失去滚动能力，下一帧按真实可视高度补测后恢复。
    DOM 挂载仅 info 位置（main → rail）变更；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更。 */
 /* 批次 7（2026-10-20 · 幻灯片视图 UI 细节微调 · r24）：canonical / step9-mirror 期望重算
    （1,220,604/591A13DC… → 1,221,064/EC9837B1…）。本波变更（仅 JU_SLIDES 幻灯片视图三处 UI 细节）：
    ① _updateCount 页码栏文案删除末尾冗余说明「（演示模式：基于大纲顶级节点分页）」，
       仅保留「第 n / N 页 · 图片 k 张」；
    ② .ju-sl-main 的 justify-content / align-items 由 center 改为 flex-start（舞台顶边与左侧首张缩略图
       顶边严格水平对齐；水平居中仍由 .ju-sl-stage 的 margin:0 auto 保证），.ju-sl-rail 的 padding-top
       由 6px 归 0 与 .ju-sl-main 的 padding-top:0 取齐；
    ③ .ju-sl-wrap 的 gap 由 16px 减半为 8px（缩略图栏与主演示区最小间距 8px）。
    数据契约 / 加密 payload 字段名 / 公开 API / <script> 块数 9 零变更；16:9 与自适应口径不变。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* 批次 8（2026-10-20 · 幻灯片主区居中与严格间距修正 · r25）：canonical / step9-mirror 期望重算
    （1,221,064/EC9837B1… → 1,222,036/8790A0C3…；LF · CR=0 · LF=22,501；+972 B）。本波变更（仅 JU_SLIDES._styleOnce
    的三条纯 CSS 规则 + 注释，#content / .files-wrap / .ju-sl-rail / .ju-sl-rail-inner / .ju-sl-info 零改动）：
    ① .ju-sl-wrap 的 gap 复核锁定为 8px（column-gap / row-gap 同值 8px，本波不改数值），align-items:stretch
       保证 rail 与 main 顶边齐平；
    ② .ju-sl-main 改纵向 flex：display:flex + flex-direction:column + justify-content:flex-start +
       align-items:center + padding:0（原 padding:0 10px 归零，消除与 wrap gap 叠加的横向内距）+ width:100%
       + height:100% + box-sizing:border-box，保留 container-type:size（cqh 取容器高度）；
    ③ .ju-sl-stage 改 width:100% + max-width:min(100%,calc(100cqh * 16 / 9)) + height:auto + max-height:100%
       + aspect-ratio:16/9 + margin:0（水平居中转由 .ju-sl-main 的 align-items:center 承担）；
       上限含 100%，语义等价 max-width:100% 且额外受高度约束 ⇒ 恒 16:9 并随父容器自动最大化。
    数据契约 / 加密 payload 字段名 / 公开 API / <script> 块数 9 零变更；16:9 与自适应口径不变。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* 批次 9（2026-10-20 · 幻灯片 Grid 重构 · r26）：canonical / step9-mirror 期望重算
    （1,222,036/8790A0C3… → 1,221,205/E0B262FC…；LF · CR=0 · LF=22,493；−831 B）。本波变更
    （仅 JU_SLIDES._styleOnce 幻灯片六条 CSS 规则 + 注释，数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
    ① .ju-sl-wrap 由 flex 改 CSS Grid：grid-template-columns:minmax(174px,1fr) minmax(0,2fr) minmax(0,1fr)
       + column-gap:8px + align-items:stretch + width:100% + min-width:0 + min-height:0 + flex:1 1 auto
       + height:auto；左右两列均为 1fr ⇒ 中列（主演示区）恒居 wrap 水平正中。中列取 2fr 而非 auto：
       实测 auto 列在「舞台 width:100% + aspect-ratio」下最大内容宽度为 0，坍缩为 2px（舞台 4×3px），
       2fr 为保持同样居中 / 8px 间距语义的唯一可落地实现（已用 Chromium 实测佐证）；
    ② .ju-sl-rail 追加 grid-column:1 + justify-self:end，width:174px，padding:6px 0 0；
       rail 右边缘 → 舞台左边缘 = wrap 的 column-gap = 严格 8px；
    ③ .ju-sl-rail-inner 保留 position:relative（缩略图 .ju-sl-thumb 为 absolute 定位，需 inner 作包含块，
       否则不随滚动移动）+ flex:1 1 auto / overflow-y:auto / overflow-x:hidden / min-height:0；
    ④ .ju-sl-info 保持 flex:none + padding:8px 0 + 顶部 1px 分隔线 + 居中；
    ⑤ .ju-sl-main 追加 grid-column:2，删除 container-type:size，width:100% + height:100% + padding:0
       + 纵向 flex / justify-content:flex-start / align-items:center；
    ⑥ .ju-sl-stage 取消 cqh 上限与像素限制：width:100% + height:auto + min/max 兜底 + aspect-ratio:16/9
       + margin:0，保留 box-sizing:border-box（边框计入 100% 宽，保证外框与 main 等宽、间距严格 8px）；
    ⑦ @media (max-width:720px) 由 flex-direction:column 改为 grid-template-columns:1fr 单列堆叠。
    Playwright 实测（1440×900 / 1920×1080 / 2560×1440 / 1280×720）：舞台中心 ↔ wrap 中心 Δ=0.00px，
    rail.right → stage.left = 8.00px，stage.top − rail.top = 0.00px，ratio=1.7778，文档无横纵向滚动条。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* R27（2026-10-21 · 导入弹窗 UI + 图片导入链路）：canonical / step9-mirror 期望重算
    （1,228,138/4ADA3371… → 1,233,197/9D6EDD88…；LF · CR=0 · LF=22,744；+5,059 B / +74 行）。本波变更：
    ① openImportDialog 的 modal.innerHTML 由单行模板改为多行模板——标题栏去掉 ↧、虚线框新增格式说明行、
       #impFile 的 accept 补齐 .png/.jpg/.jpeg/.gif/.webp/.bmp/.svg（共 20 项）；
    ② 新增 IMG_IMPORT_EXTS（7 项）+ readFileDataURL() + _imgDataUrlWhitelisted() + _imgRasterToPng()
       + _imgToPngDataUrl()，并在 handleImportFiles 循环首部（IMPORT_BINARY_EXTS 拒绝判断之前）新增图片分支：
       data URL 内联进新建容器文档、非白名单格式画布光栅化为 PNG、>700,000 字符拒绝；
    ③ syncEmptyState 将内联 <img> 视为非空内容，避免空占位压在图片上。
    数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更；IMPORT_BINARY_EXTS 集合本体（47 项）不变，
    图片扩展名的拒绝口径由不变量 #83 补充口径取代 #78 中的对应部分。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* R28（2026-10-21 · 左侧栏折叠健壮化 + 节点行对齐）：canonical / step9-mirror 期望重算
    （1,233,197/9D6EDD88… → 1,234,770/9CC74270…；LF · CR=0 · LF=22,756；+1,573 B / +12 行）。
    本波先吸收 r27 未封存的导入弹窗末次微调（canonical 侧 1,233,265/8DAC24B3…：拖拽区改
    display:flex + column + 居中 + min-height:160px、去掉 ↧ 图标行），使 canonical 与 step9-mirror 重新逐字节一致；
    随后是本波两处 UI 修复：
    ① #sidebarLeft.collapsed 的位移量改为 calc(var(--sidebar-left-w,210px) * -1) —— 补 210px 兜底，
       变量缺失/被清空时 calc 不再整体失效（否则 margin-left 计算值 invalid → 0 → 收起后仍占 210px 布局）；
       并在 bindMainToggles 的 syncL 内新增 _sbLeftWMarginResolvable() 探测：仅当该变量不可解析时以实测宽度
       回写 px（可解析时保持 calc，展开态宽度仍随 --ui-scale 缩放）。收起机制仍为负 margin + transition，
       .collapsed 判定 / ui.sidebarLeftCollapsed / saveUI 持久化 / 按钮 title+aria-pressed 全部不变；
       @media (max-width:768px) 的抽屉 transform 分支未改动。
    ② .sb-arrow.leaf 宽度 12px → 22px（与 .sb-arrow 同宽），叶子行 .sb-icon/.sb-label 左缘与同层父节点行对齐
       （原 12px 使整行右移 10px）；opacity:0 与 ::before 热区禁用保持不变。
    DOM 结构 / 数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更；展开态侧栏宽度行为零变更。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* R29（2026-10-21 · 标签调色板高区分度改造）：canonical / step9-mirror 期望重算
    （1,234,770/9CC74270… → 1,235,104/62C3C1E4…；LF · CR=0 · LF=22,756；+334 B · 行数不变）。本波变更
    （仅 :root 一处 token 值 + 两条 token 注释，数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
    --tag-palette 由 8 个偏暗偏灰旧色（#8A423B #8F5230 #7A6E2E #5F7A5C #4E6D8C #6E5C78 #7A5A2E #556675）
    换为 8 个高区分度中浅色（#E05252 #E8871E #D4B106 #7CB342 #2E9E5B #3B9AD9 #8064C8 #C44D9E）。
    浏览器 computed 实测（_环境与调试/r29-tag-palette-probe-2026-10-21.txt）：
    H=0/31.2/49.8/89.2/144.1/203.9/256.8/319.2°，S 46.1%~94.5%，L 40.0%~60.0%；
    最近一对 #E8871E / #D4B106 色相差 18.6°（RGB 距离 52.3），靠 L 差 8.7% + S 差 13.0% 区分。
    旧 8 色同口径对比：最近一对色相差仅 1.9°、最低饱和度 13.2%、最低明度 32.9% ⇒ 多色视觉难辨，
    本波为其根因修复。--tag-auto-gradient 同步为新 8 色（「恢复自动颜色」色块预览与调色板同口径）。
    夜间块 html[data-theme="night"] 未覆写 --tag-palette（保持只改 :root 一处，夜间沿用同一组新色）。
    JS 侧 TAG_COLORS=_themeList('--tag-palette',[]) 仍从变量读取，零硬编码新增；
    state.tagColors 中用户已选色不回写、不重置（预期行为，未清空）。
    同波 t16-w9-theme-token.test.mjs 的 TAG_PALETTE_EXPECT 同步为新 8 色（该文件不在 TARGETS 登记面内）。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* R30（2026-10-21 · 日历待办勾选框与标签色统一 · 不变量 #86）：canonical / step9-mirror 期望重算
    （1,235,104/62C3C1E4… → 1,235,206/CC434BC3…；LF · CR=0 · LF=22,756；+102 B · 行数不变）。本波变更
    （仅 :root 之外的 4 条 CSS 声明 + renderCalNode 内 4 行 JS；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
    ① .cal-node .cal-checkbox 的边框色由 var(--fg-dim) 改为 var(--cb-color, var(--fg-dim))；
       :checked 的 background / border-color 由 var(--accent) 改为 var(--cb-color, var(--accent))
       ⇒ 勾选框直接以首个标签主色呈现，未设 --cb-color 时逐字回退既有配色（无标签节点零视觉变更）；
    ② renderCalNode 内删除独立标签圆点 span（td.className='cal-tag-dot' 的 createElement / style.background /
       appendChild 三行移除），改以 cb.style.setProperty('--cb-color', getTagColor(n.tags[0])) 单行承载标签色，
       并保留 cb.title='#'+n.tags.join(' #') 的同口径提示；
    ③ .cal-tag-dot 的 CSS 定义按不变量 #86 补充口径物理保留（不删规则，仅不再生成 DOM 节点）。
    本波另将 step9-mirror 物理重同步为 canonical 的逐字节镜像（此前 mirror 停留在 r29 字节，
    与 canonical 出现 102 B 偏移；备份 6.P0-T3基线/step9/v2.0-t3.html.bak-20261021-r30）。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* R31（2026-10-21 · 日历勾选框 / 侧栏标签圆点浅色化 · 承 R30 不变量 #86）：canonical / step9-mirror
    期望重算（1,235,206/CC434BC3… → 1,235,901/76276292…；LF · CR=0 · LF=22,756；+695 B · 行数不变）。
    本波变更（4 条 CSS 声明 + 2 行 JS 渲染；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
    ① .cal-node .cal-checkbox:checked 的 background / border-color 追加 color-mix 浅色口径
       （32% --cb-color 混 --bg-panel、45% --cb-color 混 transparent），原实色声明保留为 color-mix 不支持时的回退；
    ② .cal-checkbox:checked::after 对勾边色由 #fff 改为 var(--cb-color, var(--accent))（浅底可读）；
    ③ .sb-tag-dot 移除 rgba 白描边 / 黑色外阴影，改为 color-mix 32% --tag-color 混 --bg-soft 浅底
       + 1.5px var(--tag-color, var(--icon)) 描边（--tag-color 未注入时兜底图标色，不出透明点）；
    ④ renderSubTags 与 openTagPicker 内 dot.style.background = getTagColor(t) 改为
       dot.style.setProperty('--tag-color', getTagColor(t))，供 ③ 的变量绑定消费。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* R32（2026-10-21 · 日历未标签待办透明 / 右键标签失效 / 四象限优先级）：canonical / step9-mirror 期望重算
    （1,235,901/76276292… → 1,237,487/53B3BE8D…；LF · CR=0 · LF=22,784；+1,586 B / +28 行）。
    本波变更（CSS 2 处 + JS 4 处；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
    ① .cal-tg-ev 底色由 rgba(255,255,255,.30) + backdrop-filter 毛玻璃改为
       background:var(--bg-panel) + color-mix(in srgb,var(--accent) 6%,var(--bg-panel))（实色回退链），
       border 改 1px solid var(--line-soft) ⇒ 未设标签的待办在时间网格内不再半透明/不可见；
    ② 删除 html[data-theme="night"] .cal-tg-ev:not(.tagged) 的 rgba(29,53,94,.85) 覆盖
       （夜间 --bg-panel 自动为深色面板，实底口径日/夜统一）；
    ③ openTagPicker 标签项绑定由 mousedown pick([t]) 改为 it.onclick（preventDefault + stopPropagation），
       避免 pick() 内 closeTagPicker()/forceRender() 先移除节点导致点击丢失；
    ④ 优先级徽章文案映射由 P0/P1/P2/P3/P4 改为四象限「重要紧急 / 重要不紧急 / 紧急不重要 /
       不紧急不重要 / P4」，_buildOutlineBox 与 renderCalNode 双处同口径（renderCalNode 新增徽章渲染）；
    ⑤ renderCalNode 的 .text 右键菜单新增 5 项优先级设定（v:1~4 + v:0 清除），
       经 commit(...{snapshot:true}) 落库并 forceRender()。
    实测（Playwright/msedge 1440x900）：未标签事件 computed backgroundColor 为不透明 color(srgb …) /
    backdrop-filter=none（日/夜同）；右键菜单 6 项齐备；点击「重要紧急」徽章→重要紧急（priority=1）；
    点击标签项 #alpha 后 n.tags=['alpha'] 且面板关闭；forceRender 后徽章保持。见
    _环境与调试/t3-cal-prio-probe-2026-10-21.txt。方数保持 64（仅更新既有登记方期望值，不新增纳编物）。 */
 /* R33（2026-10-21 · R32 三项缺陷彻底复修：未标签事项仍透明 / 右键标签项点击仍失效 / 时间网格无优先级徽章）：
    canonical / step9-mirror 期望重算（1,237,487/53B3BE8D… → 1,238,929/CF2A3A04…；LF · CR=0 · LF=22,799；+1,442 B / +15 行）。
    本波变更（CSS 1 处重写 + 1 处夜间规则恢复 + JS 3 处；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
    ① .cal-tg-ev 底色收口为纯实色 background:var(--bg-panel)（移除 R32 的 color-mix 混色与任何
       半透明/毛玻璃痕迹），border:1px solid var(--line-soft)、box-shadow:0 1px 3px var(--shadow)
       ⇒ 未设标签的待办（如编号 5）在时间网格内为完全不透明面板底；
    ② 恢复 html[data-theme="night"] .cal-tg-ev:not(.tagged) 覆盖并改为实色
       （background:var(--bg-panel) / border-color:var(--line-soft) / backdrop-filter:none），
       日/夜同一口径、夜间无毛玻璃；
    ③ openTagPicker 标签项 it 的事件绑定由 R32 误改的 it.onclick 回退为
       it.addEventListener('mousedown', …pick([t]))——pick() 内 closeTagPicker()+forceRender() 会在
       mousedown 阶段销毁本次渲染的 DOM，click 永不派发（R32 的 onclick 方案即「右键标签弹窗点击失效」根因）；
    ④ buildTimeGrid 时间网格事件块新增四象限优先级徽章（prio-badge p{n}，文案与 _buildOutlineBox /
       renderCalNode 完全一致）；徽章以 ev.insertBefore(pb,txt) 置于 contentEditable 之外并切 flex 单行布局，
       避免 txt 失焦比对 txt.textContent 时把「重要紧急」等文案回写进节点正文（数据污染）；
    ⑤ renderCalNode 徽章渲染复核保留（R32 已建），与大纲 / 网格三处映射同口径；
    ⑥ 新增注释内不出现 #RRGGBB 字面量（t16-w9-theme-token「定义块外硬编码色抽取」断言口径，
       首轮曾因注释里写夜间面板十六进制值导致该断言 1≠0 失败，已改为 token 语义表述）。
    实测：① node _临时脚本/_t3cal_probe.mjs ⇒ 21 项断言 ALL PASS（含 9 个内联 <script> 语法校验）；
    ② 真机浏览器（Playwright/Chromium 1440x900 · 真实鼠标）_临时脚本/_t3cal_browser.mjs ⇒ 18 项断言 ALL PASS：
       未标签事件 computed backgroundColor=rgb(234,243,225)（夜间 rgb(29,53,94)）、backdropFilter=none；
       右键「重要紧急」后 priority=1 且网格 / 今日待办 / 大纲三处徽章均为「重要紧急」；
       「选择标签」弹层点击 #beta 后 tags=['beta']、网格 tagged 且 --evtag 已注入。证据：
       _环境与调试/t3-cal-prio-browser-2026-10-21.txt + t3-cal-day / t3-cal-tagpicker / t3-cal-final 三张截图；
       全量门禁 _环境与调试/t3-cal-prio-gate-all-2026-10-21.txt（静态 0 命中 / Node 503 · 503 / PW 171 · 171 / bench 7 · 7）；
    _临时脚本/_t3cal_rediff.mjs ⇒ 反向撤销本波 6 处文本块后 canonical 与 R32 锚（step9-mirror.bak-20261021-r33）逐字符相等，
    证明本波差异仅限上述修复、无夹带改动。登记方数不变（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
 /* R35（2026-10-21 · 日历外层容器去边框/去底色 + 内部网格自持边界）：canonical / step9-mirror
    期望重算（1,249,200/8B3B92DF… → 1,249,546/5B17B437…；LF · CR=0 · LF=23,000；+346 B / +0 行）。
    本波变更（仅 CSS 3 条规则；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
    ① .cal-top：background:var(--bg-panel) → transparent，border:1px solid var(--line-soft) → none；
    ② .cal-bottom：同样去底色与边框，边界由内部 .cal-module（自带 background + 1px 边框）承担；
    ③ .cal-grid：补 background:var(--bg-panel) + 1px var(--line-soft) 边框 + --radius-lg + 6px 内距，
       外层透明后月视图仍保留独立面板边界；.cal-tg 原有 border + background:var(--bg-panel) 复核保留。
    门禁：静态 0 命中 / Node 503 · 503 / PW 167 passed + 4 skipped = 171 / bench 7 · 7。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
 /* R34（2026-10-21 · 日历底部模块化：记事本 / 当日待办 / 系统日志 / 统计）：canonical / step9-mirror
    期望重算（1,238,929/CF2A3A04… → 1,249,200/8B3B92DF…；LF · CR=0 · LF=23,000；+10,271 B / +201 行）。
    本波变更（CSS 1 段新增 + JS 模块化重构；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
    ① CSS 新增 .cal-modules / .cal-module / .cal-module-head / .cal-module-body / .cal-module-resize /
       .cal-module-add 与拖拽态规则；.cal-bottom 追加 overflow-x:hidden，容器 width:100% + flex-wrap，
       模块间距 2px，横向不出现滚动条；
    ② JS 新增 CAL_MODULE_KEYS / calModuleState / calModuleTitle / renderCalModules 及模块 body 构建
       （note 复用 renderNoteRow 树；today 复用 renderCalNode 列表与「+ 添加今日待办」；log 复用
       buildCalLogBlock 的 body；stats 复用 buildStatsBlock），标题行拖拽排序（rAF 节流 + elementFromPoint +
       左右 / 上下半区 insertBefore 实时换位，pointerup 回写 order 并 saveUI，400ms 内吞 click），
       右下角缩放（setPointerCapture + rAF，最小 180×160，pointerup 写 sizes）；
    ③ renderCalendarPage 删除 topRow / makeCalDivider('note'|'today'|'stats') 及统计面板直接构建，
       改为 bottom.appendChild(renderCalModules())；_calDayNodesForModules 注入同一次渲染的 getDayNodes
       （日缓存 / 标签过滤 / focusId 口径完全一致），模块内数据与原有逻辑一致；
    ④ ui.calModules（order / hidden / sizes）仅经 saveUI() 持久化，不进 historyPast；_saveUINow 与
       uiSnapshot 增列 calModules，applyUIFields 恢复（缺省初始化为 note/today/log/stats）；
       script_4 编辑态早退的派生面板局部刷新改为按 .cal-module[data-key="stats"|"log"] 定位；
    ⑤ 显式尺寸的模块（缩放落盘 / 恢复）追加 flex:0 0 auto，避免同行 flex-shrink 把宽度抵回
       原值（探针实测曾出现「只增高不增宽」的假缩放，修复后 367×232 落盘并在重载后保持）。
    门禁：静态 0 命中 / Node 503 · 503 / PW 167 passed + 4 skipped = 171 / bench 7 · 7；
    真机探针 _环境与调试/calmod-browser-2026-10-21.txt ⇒ 30/30 PASS（四模块 / 间距 2px / 无横向滚动条 /
    删除-恢复 / 拖拽排序 / 缩放 / saveUI 持久化 / historyPast 零增长 / 零 pageerror · 零 console.error）；
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
 /* R36（2026-10-21 · 日历网格接入模块化体系：日历网格成为 .cal-modules 首个模块 / 模块间距 2px → 5px /
   不变量 #88）：canonical / step9-mirror 期望重算
   （1,249,546/5B17B437… → 1,251,465/EA435C01…；LF · CR=0 · LF=23,016；+1,919 B / +16 行）。
   本波变更（CSS 2 处 + JS 6 处；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
   ① CAL_MODULE_KEYS 由 [note,today,log,stats] 扩为 [calendar,note,today,log,stats]；
      calModuleTitle 增加 calendar → 日历 映射；
   ② calModuleState 合并逻辑记录「原 order 是否已含 calendar」，缺键时补全并 unshift 至首位（旧存档补位），
      其余键序与去重口径不变；
   ③ renderCalModules(calTop) 新增 calendar 渲染分支：模块 body 直接挂载 renderCalendarPage 构建的 .cal-top
      原节点（年/月/周切换、前后翻页、月视图 .cal-grid、周视图时间网格 .cal-tg、年视图 .year-grid 与其
      拖拽 / 缩放绑定），仅迁移父容器、不重建 DOM ⇒ 事件绑定零丢失；
   ④ renderCalendarPage 删除 page.appendChild(top)，改为 bottom.appendChild(renderCalModules(top))，
      .cal-page 仅保留 .cal-bottom 一个直接子容器；week 分支收口 top.appendChild(buildTimeGrid(days));
      与不变量 #76 / #88 锚点逐字保留；
   ⑤ ui.calModules 默认 order 与 loadUI() 恢复分支同步为五模块默认值，旧档缺 calendar 时 unshift 补位
      并清除 hidden.calendar（默认不隐藏）；删除后「+ 添加模块」菜单由 CAL_MODULE_KEYS 派生，可恢复日历模块；
   ⑥ .cal-modules gap 2px → 5px，并补 min-width:0 / max-width:100%；新增
      .cal-module[data-key="calendar"]{flex:1 1 100%;min-height:320px} 与 body padding:0（日历网格独占整行）。
   门禁：静态检查 0 命中 / Node 503 用例 / PW 167 passed + 4 skipped = 171 / bench 7 · 7；
   真机探针 _环境与调试/r36-calmod-browser-2026-10-21.txt ⇒ 35/35 PASS（五模块首位 calendar / 间距 5px /
   无横向滚动条 / 年-月-周切换 + 翻页 + 单元格点击 / 拖拽排序 / 缩放 / 删除-恢复 / 重载持久化 / 旧存档补位 /
   零 pageerror · 零 console.error）。同波清单末尾物理追加 §三十二 / 不变量 #88
   （128,656/81EA3A18… → 131,889/4B30A624…；LF · CR=0 · LF=1,727；+3,233 B / +23 行）。
   方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
 /* R37（2026-10-21 · 日历模块边距 5px + 自适应防畸变 / 不变量 #89）：canonical / step9-mirror 期望重算
   （1,251,465/EA435C01… → 1,252,564/6B93641D…；LF · CR=0 · LF=23,031；+1,099 B / +15 行）。
   本波变更（CSS 2 处 + JS 2 处；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
   ① renderMain() 在 view 归一后写 c.style.padding：日历视图 '5px'，其余视图 ''（恢复默认内距）；
   ② .cal-modules：gap 保持 5px，补 align-content:flex-start / min-height:100% / box-sizing:border-box；
   ③ .cal-module：补 box-sizing:border-box / max-width:100%，min-width 180px → 150px；
   ④ renderCalModules()：落盘尺寸改 flex:'1 1 <w>px' + height:<h>px；无尺寸时 calendar '1 1 100%'、其余 '1 1 200px'；
   ⑤ calModuleBindResize()：拖拽中 flex:'0 0 <w>px' + height 实时更新，pointerup 写
      ui.calModules.sizes[k]={w:offsetWidth,h:offsetHeight} 并恢复 flex:'1 1 <w>px' 等比伸缩。
   门禁：静态检查 0 命中 / Node 503 用例 / PW 167 passed + 4 skipped = 171 / bench 7 · 7；
   真机探针 _环境与调试/r37-calmod-browser-2026-10-21.txt ⇒ 24/24 PASS（padding 5px / 间距 5px /
   模块 box-sizing·max-width·min-width 150px / 默认 flex / 拖拽缩放 / 重载持久化 / 五视口 + 侧栏折叠展开 /
   零 pageerror · 零 console.error）。同波清单末尾物理追加 §三十三 / 不变量 #89
   （131,889/4B30A624… → 135,870/B99487FD…；LF · CR=0 · LF=1,750；+3,981 B / +23 行）。
   方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R38（2026-10-21 · 日历模块窗口缩放位移修复）：canonical / step9-mirror 期望重算
     （1,252,564/6B93641D… → 1,253,517/396FAB02…，+953 B / +1 行；LF · CR=0 · LF=23,047）。
     本波变更（JS 2 处；CSS 无需改动——.cal-modules 已含 align-content:flex-start；数据契约 /
     加密 payload / 公开 API / <script> 块数 9 零变更）：
     ① renderCalModules()：落盘尺寸由 height:<h>px 改为 minHeight（消除固定死高度引发布局抖动）；
        无尺寸时 calendar flex:'1 1 100%' + minWidth:'100%'，其余模块 flex:'1 1 24%' + minWidth:'200px'
        （宽屏 1440+ 稳定一行 4 个，避免微小宽度变化使两行突并为一行而整体上移）；
     ② calModuleBindResize()：拖拽中以 flex:'0 0 <w>px' + minWidth + minHeight 实时反馈，
        pointerup 恢复 flex:'1 1 <w>px'、minWidth:'150px'，并以拖拽后实测高度回写 minHeight，
        sizes 记录恢复等比分配后的真实盒尺寸（w:offsetWidth / h:offsetHeight）。
     门禁：verify.js all Exit 0 / 登记器 65 方 drift 0；真机探针
     _环境与调试/r38-calmod-browser-2026-10-21.txt ⇒ 18/18 PASS（默认 flex / 无死高度 /
     五视口行位稳定 / 真实鼠标拖拽 minWidth+minHeight / 重载持久化 / 零 pageerror·零 console.error）。
     方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R41（2026-10-21 · 侧栏图标与文字严格对齐 · 承 R40）：canonical / step9-mirror 期望重算
     （1,256,784/8F7CBE7A… → 1,257,290/5EA40C58…，+506 B / ±0 行；LF · CR=0 · LF=23,100）。
     本波变更（CSS 4 处取值 + 3 处既有注释同步；JS / 数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
     ① .sb-nav-item padding 7px 10px → 7px 8px（图标列左缘 10+24+8=42px → 8+24+8=40px）；
     ② .sb-row padding 1px 4px → 1px 8px 且 gap 5px → 8px（4+22+5=31px → 8+24+8=40px）；
     ③ .sb-arrow width 22px → 24px、④ .sb-arrow.leaf width 22px → 24px（与 .sb-nav-item .chev 同宽）；
     合计：主导航项与子菜单项的图标列左缘统一为 40px（改前相差 11px，改后 0px）。
     #subDb / #subStarred / #subDocs / #subTags / .sb-children 的 padding-left 复核仍为 0（本波未改动）；
     .sb-arrow::before 的 44px 伪元素热区与 gap 8px 的越界关系已在 .sb-icon 注释同步（越界 2px，z-index:1 仍优先命中）。
     门禁：verify.js all Exit 0 / 登记方 65 方 drift 0；真机探针 _环境与调试/r41-align-probe-2026-10-21.txt。
     方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R40（2026-10-21 · 侧边栏缩进归零 + 折叠三角热区与折叠态守持 · 承 R39）：canonical / step9-mirror 期望重算
     （1,255,856/64766D8B… → 1,256,784/8F7CBE7A…，+928 B / +8 行；LF · CR=0 · LF=23,100）。
     本波变更（CSS 3 处 + JS 2 处；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
     ① .sb-nav-item .chev 宽 12px → 24px 且 display:inline-flex 居中（折叠三角热区扩大，点击不再落到整行导航）；
     ② .sb-children 与 #subDb,#subStarred,#subDocs,#subTags 的 padding-left 14px → 0（层级缩进归零，图标与文字左对齐）；
     ③ navTo 取消无条件 ui.navExpanded[nav]=true，改为 if(!ui.navExpanded[nav]){...}（starred / files / database / tags），
        避免点击文字覆盖三角按钮的折叠状态；setActiveKey 等后续动作保持在守卫之外，行为面不变；
     ④ _bindRowDrag 的 pointerdown 增加 e.target.closest('.chev') 早退（折叠三角不参与长按拖拽）——原 handle.setPointerCapture
        会把随后的 click 重定向到整行 .sb-nav-item，使 .chev 的 toggle 处理器永不触发，这是「点击三角无法收起」的真实根因。
     方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R39（2026-10-21 · 日历模块位移修复 · 承 R38）：canonical / step9-mirror 期望重算
     （1,253,517/396FAB02… → 1,255,856/64766D8B…，+2,339 B / +45 行；LF · CR=0 · LF=23,092）。
     本波变更（JS 3 处；CSS 无需改动；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
     ① renderCalModules()：尺寸三分支改为优先判 k==='calendar'（calendar 永远独占整行，宽度不可拖拽落盘），
        calendar 与其余模块有尺寸时一律 height / minHeight / maxHeight 三件套锁定行高；无尺寸分支
        minWidth 200px → 150px（与 CSS .cal-module 的 min-width:150px 对齐，消除 815px 阈值附近的行数切换）；
     ② calModuleBindResize()：落盘改用拖拽期维护的目标值 w / h，禁止回读 offsetWidth / offsetHeight
        （该值已被 flex-grow 与 align-items:stretch 二次分配，回读再落盘会单向膨胀并击穿换行阈值）；
        点击不拖动不落盘（moved 守卫 + 进入时样式快照还原）；calendar onUp 只写高度、sizes.calendar 只存 {h}；
     ③ calModuleBindDrag()：pointercancel 拆出独立 onCancel，按 pointerdown 快照还原 DOM 顺序，
        不写 st.order、不调 saveUI（防止触屏打断后下次 forceRender 按旧 order 重建而跳回原位）。
     门禁：verify.js all Exit 0 / 登记器 65 方 drift 0；真机探针 _环境与调试/r39-module-probe-2026-10-21.txt。
     方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R42（2026-10-21 · 日历待办标签弹层勾选 / 反选与空态文案 · 承 R41）：canonical / step9-mirror 期望重算
     （1,257,290/5EA40C58… → 1,259,506/5F1C05B8…，+2,216 B / +34 行；LF · CR=0 · LF=23,134）。
     本波变更（JS 1 函数 + CSS 8 条规则；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
     ① openTagPicker 的 pick 由「只做并集」改为「可反选」——pick(t,on) 的 on 缺省取「当前未勾选」，
        已勾选标签再次点击即从 _manualTags 差集移除；tags 仍按 manual ∪ 正文 #标签 重算（口径不变）；
     ② 列表渲染抽为 buildRows()：每行追加 .tp-check 勾选标记，已勾选行加 .sel（--accent-soft 底 / 600 字重 /
        .tp-check opacity 1），正文 #标签只读行加 .ro 并给出 title；勾选 / 取消后就地重绘，弹层不再单次交互即关闭
        （支持连续多选与反选，关闭时机交由外部点击 / initDragClose）；
     ③ 标题随手动标签数显示「已勾选 N 个（再点一次取消）」；
     ④ 空态文案分流——索引未就绪「标签索引正在后台整理…可直接在下方新建标签」/ 暂无标签「在正文输入 #标签，
        或用下方「新建标签」创建」；索引就绪后异步就地补全列表（不关闭弹层，且已生效手动标签始终列出）；
     ⑤ 清除行文案改「✕ 清除本节点全部标签」，新建标签走 pick(name,true)。
     门禁：verify.js all Exit 0 / 登记器 65 方 drift 0；真机探针 _环境与调试/r42-tagpicker-probe-2026-10-21.txt。
     方数保持 65（仅更新既有登记方期望值 + 不变量清单追加 §36 / #93，不新增登记方）。 */
  /* L22-final-r2（2026-10-21 · UI 修正补丁 · 收口 #77 / #57 两处不变量冲突）：canonical / step9-mirror
    期望重算（1,259,506/5F1C05B8… → 1,261,042/B600CF50…，+1,536 B / +16 行；LF · CR=0 · LF=23,150）。
    本波变更（CSS 3 条规则 + JS 2 个渲染函数；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
    ① #77 · JU_SLIDES._styleOnce() 内 .ju-sl-main 的 align-items 由 center 改 flex-start；
       .ju-sl-rail 的 padding 由 6px 0 0 归 0；.ju-sl-stage 的 margin 由 0 改 0 auto
       ⇒ 舞台顶边与首张缩略图顶边差 ≤1px、舞台水平居中、.ju-sl-wrap column-gap 8px 不变；
       body.sb-left-collapsed .ju-sl-rail 的 padding-right:6px 为折叠态专用规则，保留不冲突；
    ② #57 · renderTemplatesView() / renderHistoryView() 的 renderTitleWithBack(...) 返回值先
       classList.add('files-toolbar') 再 append（并回写 justify-content:flex-start 保持标题左对齐）
       ⇒ 模板 / 回收站 / 历史三视图 document.querySelector('.files-toolbar .btn') 均命中「← 返回」；
       回收站 renderTrashView() 保持现状（外层 head 已是 .files-toolbar，避免嵌套两层）；
    ③ 物理同源：canonical 与 step9-mirror 逐字节一致（同步方式 = 编辑 step9 镜像后 copy 回 canonical）。
    门禁：verify.js all Exit 0 / 登记器 65 方 drift 0；真机探针 _环境与调试/l22r2-ui-inv57-77-browser-2026-10-21.txt。
    方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
 /* L22-final-r3（2026-10-21 · 幻灯片主舞台面积最大化 · #77 布局口径更新）：canonical / step9-mirror
    期望重算（1,261,042/B600CF50… → 1,261,513/E9CDE576…，+471 B / +3 行；LF · CR=0 · LF=23,153）。
    本波变更仅限 JU_SLIDES._styleOnce() 的 CSS 字符串数组（数据契约 / 加密 payload / 公开 API 零变更；
    <script> 块数 9 不变）：
    ① .ju-sl-wrap 由三列 minmax(174px,1fr) minmax(0,2fr) minmax(0,1fr) 收为两列 auto minmax(0,1fr)，
       取消原用于对称居中的第三列留空（该列宽度全部让给主舞台）；height 由 auto 改 100%，
       为 .ju-sl-main 的尺寸查询提供确定高度基准；
    ② .ju-sl-main 追加 container-type:size（内部 100cqh 以主演示区高度为基准）；
       justify-content:flex-start / align-items:flex-start / padding:0 保持（#77 顶部对齐口径不变）；
    ③ .ju-sl-stage 宽度由 100% 改为 min(100%,calc(100cqh * 16 / 9))：宽度同时受列宽与可用高度约束，
       两向撑满且恒 16:9；margin:0 auto 保持水平居中、顶边贴齐首张缩略图；
    ④ 窄屏 @media (max-width:720px) 的 .ju-sl-main 追加 container-type:normal —— 单列态 height:auto
       与 size 尺寸隔离叠加会使高度坍缩为 0（100cqh=0 ⇒ 舞台不可见），必须还原为普通元素；
    ⑤ #77 口径更新：水平居中由「wrap 内绝对居中（左右 1fr 对称）」改为「主演示区剩余空间内居中」，
       顶部对齐与 16:9 比例不变；真机探针 _环境与调试/l22r3-ui-stage-probe-2026-10-21.txt。
    方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
 /* L22-final-r4（2026-10-21 · 幻灯片缩略图与主舞台贴合居中 · #77 布局口径更新）：canonical / step9-mirror
    期望重算（1,261,513/E9CDE576… → 1,261,347/AE963965…，−166 B / 行数不变；LF · CR=0 · LF=23,153）。
    本波变更仅限 JU_SLIDES._styleOnce() 的 CSS 字符串数组（数据契约 / 加密 payload / 公开 API 零变更；
    <script> 块数 9 不变）：
    ① .ju-sl-wrap 由 Grid（auto minmax(0,1fr) + column-gap）改为 Flex 行：
       display:flex / justify-content:center / align-items:stretch / gap:8px，缩略图栏与主演示区
       作为同一整体在主内容区内水平居中，二者间距恒为 8px；
    ② .ju-sl-rail 由 grid-column:1 + justify-self:end 改为 flex:none；其余（174px / 纵向 flex /
       padding:0）不变；
    ③ .ju-sl-main 由 grid-column:2 + width:100% 改为 flex:0 1 auto，并追加 aspect-ratio:16/9：
       width 不写 ⇒ 宽度由 16:9 比例换算（与舞台宽度同源），不再抢占剩余空间；
       保留 container-type:size（#77 r3 口径不变）。实测字面写法（仅 flex:0 1 auto、无 aspect-ratio）
       会因 size 尺寸隔离使 flex-basis 退化为 0、舞台坍缩为 0 宽（真机探针 1200x600/1200x300/700x600
       三档），故以比例换算替代内容撑开；
    ④ .ju-sl-stage 宽度由 min(100%,calc(100cqh * 16 / 9)) 改为 calc(100cqh * 16 / 9)，
       保留 max-width:100% 兜底（原 min() 内的 100% 会在高度受限视口下把舞台撑到可用宽度，
       导致缩略图栏与舞台之间被 auto 边距拉开 —— 即本波要消除的大间距）；
    ⑤ 窄屏 @media (max-width:720px)：grid-template-columns/row-gap 改为 flex-direction:column/gap:8px，
       删除两处 grid-column:1；.ju-sl-stage 的 max-width:100% 与 .ju-sl-main 的 container-type:normal 保留；
    ⑥ 连带更新 4.回归与验收/JU-不变量清单-v2.0-frozen.md 的 #77 补充口径（新增 r4 段落，不改既有条目）。
    门禁：verify.js all Exit 0 / 登记器 65 方 drift 0；真机探针 _环境与调试/l22r4-slides-probe-2026-10-21.txt。
    方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
 /* R46（2026-10-22 · 主题按钮图标 T 恤化）：canonical / step9-mirror 期望重算
    （1,261,347/AE963965… → 1,261,506/C6AAF0E3…，+159 B / −1 行；LF · CR=0 · 换行符 23,152 · split 23,153）。
    本波变更仅两处 SVG 外形（数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变）：
    ① #btnTheme 静态 svg 的圆 / 弦（circle + path）替换为 T 恤轮廓 path（沿用 .sb-tool svg 的
       stroke:var(--icon) / fill:none / stroke-width:1.8 线框口径，与其他工具按钮同风格）；
    ② applyTheme 内 svg.innerHTML 由「日间半圆 / 夜间太阳」改为同一 T 恤 path（夜间追加
       <circle cx="12" cy="18" r="1"/> 点缀以保留主题态视觉差异）。
    方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
 /* R47（2026-10-22 · 今日待办右键菜单折叠展开化）：canonical / step9-mirror 期望重算
    （1,261,506/C6AAF0E3… → 1,275,170/A5E285C7…，+13,664 B / +264 行；LF · CR=0 · 换行符 23,416 · split 23,417）。
    本波变更（CSS 26 条规则 + JS 2 处；数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变）：
    ① 新增 openCalNodeMenu / closeCalNodeMenu（置于 renderCalNode 之前）——renderCalNode 的
       text contextmenu 不再调用 showContextMenu(items,e)（#ctxMenu + openCalTimeModal / openTagPicker 二级弹窗），
       改为创建 .cal-ctx 浮层（position:fixed / z-index:var(--z-menu) / 背景 / 圆角 / 阴影 / 内边距），
       三个折叠项「⏰ 设置时间」「🏷 选择标签」「● 优先级」就地展开收起（.cal-ctx-body.on 切换，
       首次展开才构建内容），「📄 复制到今日」「🗑 删除待办」保持直接执行；
       浮层支持点击外部（document mousedown 捕获）与 ESC 关闭，窗口 resize 收起，close 统一 drain
       mkCalSel 的 _cleanups 与文档级监听（无新增常驻监听）；
    ② 折叠区数据写入语义不变：时间走 commit 写 nn.time / nn.timeEnd（与 openCalTimeModal 同口径，
       含「分钟 60 进位」「结束需晚于开始且不超当日」校验，另提供「清除时间」），标签走
       commit 写 nn._manualTags ∪ 重算 nn.tags（复刻 openTagPicker 的 pick / clearTags 口径，
       只读行由 nodeHasTag 判定），优先级走 commit 写 nn.priority（v:0 清除）；
       actions.setNodeDate / clearNodeSchedule / updateText / toggleDone / removeNode 调用点语义零变更；
    ③ mkCalSel 增加可选第三参数 host（缺省仍 document.body）：时间折叠区的 4 个下拉实例把
       .cal-sel-panel 挂进浮层内部，避免 z-index(--z-modal-pop 1600) 被浮层(--z-menu 10050) 压住；
    ④ 新增 CSS 段 .cal-ctx / .cal-ctx-item / .cal-ctx-body / .cal-ctx-row / .cal-ctx-btn /
       .cal-ctx-prio / .cal-ctx-tag / .cal-ctx-hint（复用 --bg-menu / --line / --accent-soft 等既有 token，
       不改任何既有选择器）。
    门禁：verify.js all Exit 0 / 登记器 65 方 drift 0；真机探针 _环境与调试/r47-calctx-probe-2026-10-22.txt（23/23 PASS）。
    方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
 /* R48（2026-10-22 · 折叠菜单首列对齐与浅底区隔）：canonical / step9-mirror 期望重算
    （1,275,170/A5E285C7… → 1,276,720/022E98F4…，+1,550 B / 行数不变；LF · CR=0 · 换行符 23,441 · split 23,442）。
    本波变更限 openCalNodeMenu 内部构建与 .cal-ctx 段样式（数据契约 / 加密 payload / 公开 API 零变更；
    <script> 块数 9 不变；折叠区写入通道 commit + actions 调用点逐行未动）：
    ① 折叠头与普通项同用 .ctx-item 基础类（类名 ctx-item cal-ctx-item），高度 / 四向内边距 /
       字号 / 行高不再各写一份，实测 5 项 computed 值全等：h=27.02 / padding=6-11-6-11 /
       font-size=10.3544px / line-height=15.0139px；
    ② 新增首列 .cal-ctx-lead（flex:0 0 16px; width:16px; margin-right:7px）——折叠头放三角、
       普通项放图标，两类文字起点实测同为 x=40（极差 0）；
    ③ 三角改为字符切换：收起 ▶ / 展开 ▼（原 .caret 的 rotate(90deg) 分支删除），
       折叠头头部同步 aria-expanded=true/false；折叠项表情前缀（⏰ / 🏷 / ●）移除，首列只留三角；
    ④ 折叠头 + 内容区包进 .cal-ctx-fold（background:var(--bg-panel2) / border-radius:var(--radius-sm) /
       padding:2px 0），浅底落在整块上；横向内边距取 0，避免 1px 缩进破坏与普通项的列对齐；
       普通项 background:transparent；.cal-ctx-body 去掉 border-top（改由浅底做区隔），左内边距 11px；
    ⑤ 交互与执行语义不变：头部 mousedown 切 body.on / 三角 / aria，首次展开才 build；
       mkCalSel 仍挂浮层内部；「复制到今日」「删除待办」仍直接执行。
    门禁：verify.js all Exit 0 / 登记器 65 方 drift 0；真机探针 _环境与调试/r48-calctx-align-probe-2026-10-22.txt（26/26 PASS）。
    方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
 /* R49（2026-10-22 · 右侧编辑工具栏多选批量格式化）：canonical / step9-mirror 期望重算
    （1,276,720/022E98F4… → 1,279,982/4E504F4F…，+3,262 B / +65 行；LF · CR=0 · 换行符 23,506 · split 23,507）。
    本波变更限 bindRightSidebar 内 [data-cmd] 按钮 onclick 的前置分支（数据契约 / 加密 payload /
    公开 API 零变更；<script> 块数 9 不变；单光标 / 单选区 execCommand 路径逐行未动）：
    ① 无文本选区（getSelection 折叠或为空白）且存在多选节点时进入批量分支：「大纲多选 _outlineSel」
       优先（须 docId === ui.currentDocId），否则回落通用多选 _mSel.ids；
    ② execBatchFormat(cmdStr,val) 以单次 commit 批量改写各节点 text（snapshot + dirtyText + dirtyDocs:null，
       updatedAt 走 _nowSeq），逐节点存在性守卫，执行后 forceRender；
    ③ 支持命令 bold / italic / underline / strike（同名标签包裹，重复点击自动解包）、
       bg（background-color 内联 span，透明档写 transparent）、color（color 内联 span）、
       size（fontSizePxFor 换算 px 后写 font-size）；
    ④ 有文本选区或多选为空时不拦截，原 execCommand / 颜色 / 字号选择器路径保持原状。
    门禁：verify.js all Exit 0 / 登记器 65 方 drift 0；真机探针 _环境与调试/r49-multifmt-probe-2026-10-22.txt。
    方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
 /* R50（2026-10-22 · 多选格式重复更换去嵌套 / 格式刷批量 / 粘贴权限兜底）：canonical / step9-mirror 期望重算
    （1,279,982/4E504F4F… → 1,289,544/176974DD…，+9,562 B / +199 行；LF · CR=0 · 换行符 23,705 · split 23,706）。
    本波变更（数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变）：
    ① 新增 HTML 字符串级格式管线（顶层函数）：fmtFragment（template 惰性解析）/ fmtEachElement（后序遍历）/
       fmtTidy（空 style 属性剥离 + 无属性 span/font 展开 + 空内联元素清理）/ fmtClearKind（按格式类型清除内联样式、
       <font color|size|bgcolor> 属性、b/i/u/s 标签；带伴随样式的格式标签降级为 span 后去格式）/
       normalizeFormatHtml / captureFormatFromHtml / hasAnyFormat / applyFormatToHtml / batchFormatHtml；
    ② execBatchFormat 改调 batchFormatHtml：先清除选区内原有对应样式再包裹新标签 ⇒ 反复更换颜色 / 背景 / 字号
       不再层层嵌套失效；bold / italic / underline / strike 改由 captureFormatFromHtml 判定后幂等切换
       （不再依赖首尾标签 startsWith 匹配，包裹层级变化仍可切换）；
    ③ 格式刷新增批量模式：captureFormatFromNodes / applyFormatToNodes / toggleBatchPainter——多选节点首次点击
       拾取第一个有格式节点的格式（_fmtPainter.batchMode=true，srcIds 记录来源），再次点击批量写入当前全部选中
       节点并 deactivatePainter（单次 commit：snapshot + dirtyText + dirtyDocs:null）；onSelectionChangeForPainter
       对 batchMode 早退（避免误走单光标自动应用）；deactivatePainter 整体重建状态对象（清除 batchMode / srcIds）；
    ④ 粘贴按钮：readText 前先恢复 #content 内焦点（读剪贴板异步 ⇒ 焦点可能已丢），catch 与「不支持」分支统一提示
       「浏览器拒绝了剪贴板读取权限，请直接使用 Ctrl+V 粘贴」；execCommand('insertText', text) 原路径保留。
    单光标 / 单选区路径（styleWithCSS + execMap + 颜色 / 字号选择器 + captureFormat / applyCapturedFormat 的
    Range 应用）逐行未动。
    门禁：verify.js all Exit 0 / 登记器 65 方 drift 0；真机探针 _环境与调试/r50-patch-probe-2026-10-22.txt（28/28 PASS）。
    方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
 /* R51（2026-10-22 · 取色器即点即用 + 8 列 × 3 行色板 / 字号弹层清除档位并入网格）：canonical / step9-mirror
    期望重算（1,289,544/176974DD… → 1,288,906/ED513B34…，−638 B / −7 行；LF · CR=0 · 换行符 23,698 · split 23,699）。
    本波变更（数据契约 / 加密 payload / 公开 API 零变更；<script> 块数 9 不变）：
    ① --color-palette（日间 / 夜间）重定义为 24 色 = 8 组「浅 / 中 / 深」三连，按列序排列；JS 仍由
       _themeList 读取该 token（定义块外零十六进制字面量，守持 L16-W9 抽取口径）；
    ② openColorPicker：删除底部 footer（预览 / 取消 / 确定）；cp-grid 追加 grid-auto-flow:column 与
       grid-template-rows:repeat(3,1fr)（逐列填充）；移除网格内透明块，改为 cp-custom 行最左侧「透明」按钮
       （仅背景色调用 opts.transparent 时生成）；色块点击 = callback + 立即 closeColorPicker；
       自定义取色器 / .cp-hex 的 oninput 实时 callback（无需确认）；picker 顶部 padding-top:24px 让出 .pop-close；
    ③ openSizePicker：删除独立 sp-clear 按钮，清除档并入 sp-grid 渲染数组末位（普通按钮 + 危险色内联样式，
       点击 clearFontSizeFromSelection + 收起）；picker 同样 padding-top:24px；
    ④ CSS：移除 .cp-footer / .cp-preview / .sp-clear / .cp-swatch.tp 死规则，新增 .cp-transparent。
    t16-w9 N 层用例的 DAY / NIGHT 色板期望同步为新基线（该文件不在 TARGETS 登记面内）。
    方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
 /* R52（2026-10-22 · 取色器透明档按钮强化 + 色号输入框收窄 / 字号清除档统一绿色描边）：canonical / step9-mirror
    期望重算（1,288,906/ED513B34… → 1,289,001/227F8E39…，+95 B / 行数不变；LF · CR=0 · 换行符 23,698 · split 23,699）。
    本波变更（纯 UI 样式；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
    ① .cp-transparent：34×26 虚线灰字 → 48×32、color:var(--accent) + font-weight:bold、
       border:2px solid var(--accent)、background:transparent，hover 改为 --accent-soft 底；
    ② .cp-hex：flex:1 → flex:none + width:70px（padding 5px 8px → 5px 6px），把横向空间让给透明档按钮；
    ③ openSizePicker 清除档内联样式：color / border-color 由 var(--danger) / --danger-soft 改为
       color:var(--accent) + font-weight:bold + border:2px solid var(--accent)，与透明档风格统一。
    方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
 /* R53（2026-10-22 · 透明档与字号清除档字号口径统一为 1em）：canonical / step9-mirror
    期望重算（1,289,001/227F8E39… → 1,289,014/2163B9E3…，+13 B / 行数不变；LF · CR=0 · 换行符 23,698 · split 23,699）。
    本波变更（纯 UI 字号；数据契约 / 加密 payload / 公开 API / <script> 块数 9 零变更）：
    ① .cp-transparent：font-size .82em → 1em（48×32 / color:var(--accent) / bold / 2px accent 描边 / transparent 底不变）；
    ② .cp-hex：width:70px + flex:none（R52 已落位）本波复核无改动；
    ③ openSizePicker 清除档内联样式追加 font-size:1em（justify-content:center / --accent / bold / 2px accent 描边不变）。
    方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R55（2026-10-22 · 日历底部模块标题统一 + 字数统计年/月/周柱状图）：canonical / step9-mirror
    期望重算（1,294,639/29C0851D… → 1,296,173/1753CF3A…，+1,534 B / +36 行；LF · CR=0 · 换行符 23,843）。
    本波变更（JS 3 处；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① 新增 _getCalScopeText()（置于 calStatsScope 之前）——年视图 y、周视图 M.D-M.D、月视图 y.M；
    ② calModuleStatsBody 标题统一为「任务统计（+ _getCalScopeText() +）」；
    ③ calModuleCharsBody 标题统一为「字数统计（同一 scope 文本）」，并按 ui.calView 构建 daysData
    （年 12 桶按自然月聚合 / 周 7 桶 / 月 28–31 桶）后统一绘制柱状图（正值 var(--accent)、负值 var(--danger)、
    净值为 0 时不显数值且 opacity 0.2）；R54 的周视图专用柱状图与模块头 scope 徽章随之退役（信息已并入标题）。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R57（2026-10-22 · 周期规则 interval 防御 + 数据库主列标题优先渲染）：canonical / step9-mirror
    期望重算（1,296,173/1753CF3A… → 1,296,464/2D97BAB4…，+291 B / +5 行；LF · CR=0）。
    本波变更（JS 3 处；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① expandRecurring 内重复规则解构改「先取 freq / weekday，interval 由 Math.max(1,Math.floor(Number(...)||1))
       归一」——间隔为 0 / 负数 / null / 字符串时不再落成全量命中或除零语义；
    ② buildYearCounts 内同口径归一（同一解构写法），避免 interval<=0 时年视图 while 游标不前进；
    ③ renderDbTable 单元格链把主列（dbPrimaryField）标题输入分支提到最前，并以
       !(formula|link|multi_select) 排除三型（select / date / number 下主列仍渲染标题输入框），
       其余分支顺序与内容不变。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R58（2026-10-22 · 日历失焦重复规则比较 / 日历模块日节点引用释放 / 标签弹层监听守卫 / 标签计数降级占位）：
    canonical / step9-mirror 期望重算（1,296,464/2D97BAB4… → 1,296,688/1687B4D8…，+224 B / +5 行；LF · CR=0 · 换行符 23,853）。
    本波变更（JS 4 处；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① renderCalNode 失焦提交的 recur 比较改 JSON.stringify 深比较（recurChanged），避免对象引用每次新建导致误判重复规则变更；
    ② renderMain 在 switch(view) 前于非日历视图清空 _calDayNodesForModules，释放对上一轮日历日节点闭包的引用；
    ③ openTagPicker / openTagPalette 的 setTimeout 回调首行加 if(!p.isConnected)return，弹层已移除时不再挂 document mousedown；
    ④ _l7TagCountText 就绪回调在索引构建失败（_tagIndexCache 为空）时把 #cntTags 置为 '?' 降级占位，不再残留省略号。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R59（2026-10-22 · 桌面保存排队返回 true / 导航改用 forceRender 保光标）：canonical / step9-mirror
    期望重算（1,296,688/1687B4D8… → 1,296,684/DA360954…，−4 B / 行数不变；LF · CR=0 · 换行符 23,853）。
    本波变更（JS 2 处；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① flushDesktopSave 的 _dsSaving 分支由 return false 改为 return true——_dsSaving 表示上一条仍在写盘、
       本条已排队（_dsDirty=true 后由 finally 续写），并非失败；改后 runPersist 不再把排队当失败累加
       _persistFailCount（原口径攒满 6 次会挂起自动保存）；
    ② safeNavigate 末尾 scheduleRender() 改为 forceRender()——forceRender 内部已执行
       commitPendingEditBeforeRender() + saveFocus()，编辑中切文档不再丢光标/未提交编辑。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R60（2026-10-22 · 演示折叠解耦 / 看板·画廊字段名带标签 / 日历日缓存键去 focus / 标签视图归属 /
    关闭备份 catch / 导出 HTML lang 跟随 APP_LOCALE / 子树迁移清搜索缓存 / 时间线日期占位词 / 浮窗恢复矩形）：
    canonical / step9-mirror 期望重算（1,296,684/DA360954… → 1,297,821/1AAED052…，+1,137 B / +15 行；
    LF · CR=0 · 换行符 23,868）。本波变更（JS 10 处；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① renderPresentation 删除 if(id!==doc.id&&n.collapsed)return;——演示为只读放映，折叠只应影响编辑；
    ② dbBoardCardHtml 的 meta 行改为「字段名：值」（esc(name)：esc(v)）；
    ③ __dbGalleryCard else 分支同步改为「字段名：值」；
    ④ 日历 getDayNodes 缓存键去掉 focus 维度（key=ds|f=filter），focusId 改由 _calSelKeyNow 承担，
       焦点变化时推进 _calDataRev 整表重建一次，避免缓存条目随点击无限膨胀；
    ⑤ renderTagNodes 与 renderTagsView chip 点击分支各补 _mSelSetOrder('tags', ids)，避免 _mSel.type 残留 'files'；
    ⑥ backupOnClose 的 juWriteBackupToDir 调用挂 .catch(function(){})，beforeunload 下不再产生未处理拒绝；
    ⑦ toHtml 的 <html lang="zh-CN"> 改为 lang="${esc(APP_LOCALE)}"（APP_LOCALE 已于 script_5.js 顶部定义，运行时已就绪）；
    ⑧ _dropWordFlatSubtree 在 delete st.nodes[id] 后追加 _searchHayCache.delete(id)，与 removeNodeFromMap / purgeTrash 口径一致；
    ⑨ renderDbTimeline 日期标签改 _rawDate 守卫——{type:'date',start:''} 时 formatTimeValue 返回「选择…」不再直接显示；
    ⑩ setFloatCalVisible 显示前按 ui.dnd.flt['flt.floatCal'] 保存矩形 + 当前视口重新落位（_applyRect 仅在 boot 执行一次）。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R61（2026-10-22 · P0 记事本内容丢失 / 待办标签·背景·优先级不落盘 / 记事本根误显示在我的文档）：
    canonical / step9-mirror 期望重算（1,297,821/1AAED052… → 1,297,927/DB39B0DE…，+106 B / +10 行；
    LF · CR=0 · 换行符 23,878）。本波变更（JS 6 组；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① renderFolderGrid 的 ids 过滤追加 !n._isNoteRoot——记事本根不再出现在「我的文档」网格；
    ② renderSubDocs 的 ids 过滤追加 !n._isNoteRoot——记事本根不再出现在侧栏文档树；
    ③ bindNoteText 的 input 监听追加 600ms 防抖落库（text._noteSaveTimer + actions.updateText(noHistory)），
       不再只依赖 blur 提交，重渲染 / 刷新前未失焦的输入不丢；
    ④ ensureNoteDoc 移除 _noteEnsured 门控（声明保留），根节点被回收后仍可重建，不再返回 null 让新空记事本覆盖旧数据；
    ⑤ openCalNodeMenu 内 buildTime 保存 / 清除、pickTag、clearAll、buildPrio 设置 / 清除共 6 处 commit 后各追加 persistNow()；
    ⑥ setTagColor 的 commit 成功后追加 persistNow()；标签颜色 / 待办标签 / 优先级立即上盘。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R62（2026-10-22 · P0 记事本根被回收后的「僵尸编辑」）：
    canonical / step9-mirror 期望重算（1,297,927/DB39B0DE… → 1,298,533/0BD20F25…，+606 B / +4 行；
    LF · CR=0 · 换行符 23,882）。本波变更（JS 3 处；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① getNoteDoc 的 find 追加 !n._deleted——记事本根被移入回收站后不再返回其 id，ensureNoteDoc 因此重建新记事本，
       渲染层不再把已删子树当活树渲染（原实现返回已删根 ⇒ ensureNoteDoc 判定「已存在」不重建 ⇒ 已删子节点可编辑，
       purgeTrash 后内容丢失）；② renderNoteRow 首行追加 if(!n||n._deleted)return document.createElement('div')
       （防御：已删节点不渲染，不产生可编辑僵尸行）；③ actions.moveToTrash 守卫追加 _src._isNoteRoot——
       记事本根不可回收（回收即触发上述僵尸编辑）。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R63（2026-10-22 · P1 批次：记事本内容不再出现在知识图谱与全局搜索）：
    canonical / step9-mirror 期望重算（1,298,533/0BD20F25… → 1,299,000/230BA74B…，+467 B / +7 行；
    LF · CR=0 · 换行符 23,889）。本波变更（JS 2 处；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① renderGraph 文档收集的祖先链遍历新增 inNote / _isNoteRoot 判定，if(inCal||inNote)continue——
       记事本子树（非空文本、非 _deleted 的记事本条目）与日历子树同口径，不再进入知识图谱；
    ② doSearch 在系统容器跳过之后新增祖先链判定块（parent 链命中 _isNoteRoot 即 continue）——
       记事本子孙节点不再出现在全局搜索结果（原实现只跳过 _isNoteRoot 根本身）。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R64（2026-10-22 · P2 批次：潜在隐患与性能项，承接 P0 / P1 批次）：
    canonical / step9-mirror 期望重算（1,299,000/230BA74B… → 1,299,366/506DB167…，+366 B / +1 行；
    LF · CR=0 · 换行符 23,890）。本波变更（JS 4 处；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① getCurrentDoc 的 children 兜底 find 追加 !n._isNoteRoot——currentDocId 无效时不再把记事本根当作
       当前文档（原实现只排除 _isCalRoot / _isDbRoot，初次打开会落到「记事本」文件夹视图）；
    ② renderCalendarPage 的选择态签名 _calSelKeyNow 移除 ui.focusId（仅保留 selectedDate / calTagFilter）——
       点击 / 聚焦日历条目不再推进 _calDataRev 与整表重建 _renderDayCache（年视图 365 天）；
    ③ getDayNodes 的空文本判定由 `!isBlankNode(n)||ui.focusId===n.id` 改为
       `!isBlankNode(n)||(ui.focusId===n.id&&ui._focusTick===_calDataRev)`——空文本节点仅在本次渲染周期内获得焦点时显示；
    ④ renderCalendarPage 入口写入 ui._focusTick=_calDataRev，作为渲染周期焦点代次锚点。
    筛选 / 切换日期仍按 selectedDate / calTagFilter 变化重建缓存，空节点过滤语义不变。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R65（2026-10-22 · R64 批次复查补落：记事本输入自动保存走 commit / 日历日缓存键并入 focusId）：
    canonical / step9-mirror 期望重算（1,299,366/506DB167… → 1,300,414/30460FAB…，+1,048 B / +10 行；
    LF · CR=0 · 换行符 23,900）。本波变更（JS 2 处；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① bindNoteText 的 input 自动保存整段重写——原实现经 actions.updateText(id,...,{noHistory:true}) 落库，
       updateText 在标签集合变化时调用 forceRender()（重渲染替换 contenteditable，打断输入法候选）；
       现改为 600ms 防抖内直接 commit(...,{snapshot,dirtyText,dirtyDocs,silent,persistOnly,op:'updateText'})：
       新增 text.isConnected 守卫、正文未变即早退、按「_manualTags ∪ 正文 #标签」重算 tags（防幽灵标签），
       标签变化仅 renderSidebar() 刷新计数、不再 forceRender；
    ② bindNoteText 的 blur 处理器首行插入 clearTimeout(text._noteSaveTimer)——失焦即取消待触发的防抖保存，
       交由 blur 同步提交，避免同一次编辑被写两遍；
    ③ getDayNodes 的日缓存键由 `ds|f=<calTagFilter>` 改为 `ds|f=<calTagFilter>|fo=<focusId>`——
       焦点空文本节点自成一键，切换焦点不再复用「不含该空节点」的旧日列表（R64 的 _focusTick 口径保留）。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R66（2026-10-23 · 死代码清理 + boot 启动守卫 + 错误消息统一取值）+ R66b（catch 内 e.message 全量收口）：
    canonical / step9-mirror 期望重算（1,300,414/30460FAB… → 1,292,343/4CF0E10E…，-8,071 B / -140 行；
    LF · CR=0 · 换行符 23,760）。本波变更（JS 6 类；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① boot() 启动改为 DOMContentLoaded 守卫（readyState==='loading' 时事件驱动一次，否则立即执行）；
    ② 删除死代码 openTagPicker / _tagPickerEl / closeTagPicker（122 行，全文件零调用点，零字样提及）；
    ③ 删除死代码 invertPatch（12 行函数 + 1 行历史注释；全文零提及，undo/redo 自 L4 起为 patch 引用直传）；
    ④ 删除死代码 scheduleSidebar / _sidebarRaf（7 行；FIX-M-12 已确认无调用点）；
    ⑤ 新增 errMsg(e) 取值助手；catch(e) 内 e.message 全量改走 errMsg(e)（共 23 处：本轮 11 + 追加 12），
        e.reason 2 处改为 String(e&&e.reason!==undefined?e.reason:e)；全文 e.message 仅余 errMsg 本体 2 处；
    ⑥ 3 处 var 声明改 let（IS_DESKTOP / _juBackupDirHandle / _juBackupDirWarned）。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R67（2026-10-23 · 优先级批次 1 · 数据库工具栏：标题左 / 按钮组右）：
    canonical / step9-mirror 期望重算（1,292,343/4CF0E10E… → 1,292,369/3FE5C4D8…，+26 B / ±0 行；
    LF · CR=0 · 换行符 23,760）。本波变更（CSS 3 处；DOM 结构 / JS / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① .db-title 追加 margin-right:auto（标题吃掉行内剩余空间，后续三组按钮整体右推）；
    ② .db-add 移除 margin-left:auto（右推职责由 .db-title 承担，.db-add 仅保留 display:flex;gap:6px）；
    ③ .db-toolbar 追加 justify-content:flex-end —— 真机实测（_环境与调试/db-toolbar-layout-r67-browser-probe-2026-10-23.txt）
       仅 ① + ② 时，720px 视口下 .db-add 换行后落到第二行左端（addRightDelta=-597.1），不满足「换行后按钮组继续右对齐」；
       第 1 行因 .db-title 的 auto margin 已吃掉全部剩余空间，justify-content 在该行无可用空间 ⇒ 标题位置零位移
       （实测 titleLeftDelta=0 / titleMarginRight=235.36px），仅在后续换行行生效（实测 addRightDelta=0）。
    效果（真实 Chromium 实测，1440x900 与 720x600 双视口）：.db-title 左缘贴合工具栏内左缘（delta 0），
    .db-views / .db-sf-group / .db-add 三组整体位于标题右侧、右缘贴合内右缘（delta 0）；其它视图工具栏零影响。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R68（2026-10-23 · 优先级批次 1 · 日历模块标题行：计数移至标题旁）：
    canonical / step9-mirror 期望重算（1,292,369/3FE5C4D8… → 1,292,681/70B7B73C…，+312 B / +12 行；
    LF · CR=0 · 换行符 23,772）。本波变更（JS 1 个函数；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    calModuleBadge(head,text) 重写——badge 由 head 末尾改为追加进 .cal-module-title 内部，计数紧贴标题显示；
    括号格式归一：text 已以 '(' 开头时前置一个空格（如 "4/4 (100%)" → " 4/4 (100%)"），
    否则统一包裹为 " (text)"（如 "84" → " (84)"）；追加前先清除 title 内（缺 title 时 head 内）已存在的
    .badge，避免重复插入。调用方 calModuleTodayBody / calModuleLogBody 无需改动。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R69（2026-10-23 · 优先级批次 1 · 日历模块计数徽章分隔符归一：括号 → 中点）：
    canonical / step9-mirror 期望重算（1,292,681/70B7B73C… → 1,292,682/7B46FDD8…，+1 B / ±0 行；
    LF · CR=0 · 换行符 23,772）。本波变更（JS 1 处字符串拼接；CSS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    calModuleTodayBody 内唯一一处 calModuleBadge 调用由 done+'/'+todos.length+' ('+rate+'%)' 改为
    done+'/'+todos.length+' · '+rate+'%'（中点 U+00B7；实测分隔字面量码点 0020,00B7,0020，非圆点 / 非英文句点）。
    calModuleBadge 本体零改动（外层 ' ('+text+')' 包裹逻辑保留），最终渲染仍为「当日待办 (4/4 · 100%)」；
    全文件同型拼接 ' ('+rate+'%)' 命中数 0、新拼接命中数 1（唯一改动点，calModuleTodayBody 之外无同型拼接）。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R70（2026-10-23 · 优先级批次 1 · 日历视图新建待办后保持 #content 滚动位置）：
    canonical / step9-mirror 期望重算（1,292,682/7B46FDD8… → 1,293,172/8E9B376F…，
    +490 B / +12 行；LF · CR=0 · 换行符 23,784）。本波变更（JS 3 处回调；CSS / DOM 结构 / 数据契约 /
    公开 API / <script> 块数 9 零变更）：
    根因：actions.addNode 内部 commit 已排程一次渲染，调用方随后又 forceRender ⇒ 双重渲染；二次渲染期间
    #content 子树被清空，scrollTop 瞬时归零，且新节点聚焦（选择区落入可视）把视图带走 ⇒ 位置丢失。
    ① calModuleTodayBody 的 adder.onclick（行 10121）：取滚动基线 st → addNode → forceRender → 立即回写
       scrollTop → focusAfterRender(id,'.cal-page') → 次帧 requestAnimationFrame 再回写 scrollTop；
    ② buildTimeGrid 的 col.onclick（行 9816，由 renderCalendarPage 构建的时间网格空白处新建）：同口径；
    ③ renderCalNode 的 text keydown Enter 分支（行 11261 起，滚动块 11272–11278；新建兄弟 / 根级待办）：同口径。
    口径说明：焦点调用保持**同步调度**（focusAfterRender 自身即 requestAnimationFrame 内聚焦），滚动复位放在
    其后一帧 —— 若把 focusAfterRender 一并塞进同一个 rAF（焦点推迟一帧），逐帧实测会出现「空文本新行被
    渲染过滤丢弃 + 焦点丢失」（nodeEls 49→48、focusId→""），即「+ 添加今日待办」按钮视觉无反应；故按
    「同步聚焦 + 次帧复位滚动」落盘。空值安全：c 为 null 时 st=0 且跳过回写；无新增全局态。 */
  /* R71（2026-10-23 · 优先级批次 1 · 取消日历待办的默认粗体）：
    canonical / step9-mirror 期望重算（1,293,172/8E9B376F… → 1,293,121/C639531C…，
    −51 B / ±0 行；LF · CR=0 · 换行符 23,784 不变）。本波仅 CSS 两处 font-weight 归一
    （JS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① 行 397 时间网格·周视图事件块正文：`.cal-tg-ev .evtx` 的 `font-weight:700` 改为 `font-weight:normal`
       （−16 B：`font-weight:700`→`normal` 净 +3 字符，同时移除尾随「事项加粗」行内注释 −11 字符 / 4 个汉字 12 B）；
    ② 行 498 当日待办列表正文：`.cal-node .text` 去掉 `;font-weight:600` 与尾随「事项加粗」行内注释，
       字重回落到继承值（−35 B）。
    字节核对：1,293,172 − 1,293,121 = 51 = 16 + 35，无其它字节变动；两件逐字节一致。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R72（2026-10-23 · 优先级批次 1 · 全局滚动条滑块调浅 / 统一 / 自适应主题）：
    canonical / step9-mirror 期望重算（1,293,121/C639531C… → 1,293,389/B5461DDA…，
    +268 B / +2 行；LF · CR=0 · 换行符 23,784 → 23,786）。本波仅 CSS 全局滚动条样式
    （JS / DOM 结构 / 数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① 行 66 `::-webkit-scrollbar-thumb` 在原 `background:var(--line)` 之后追加
       `background:color-mix(in srgb,var(--fg) 18%,transparent)`（原值在前作不支持 color-mix 时的回退）；
    ② 新增行 67 `::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--fg) 32%,transparent)}`；
    ③ 新增行 68 `::-webkit-scrollbar-track{background:transparent}`（轨道透明化）；
    ④ 行 70 `html` 的 `scrollbar-color` 追加 `color-mix(in srgb,var(--fg) 18%,transparent) transparent`
       覆盖值（旧 `var(--line) transparent` 保留在前作回退，新值在后，Firefox 按级联取后声明）。
    滑块颜色随当前主题 `--fg` 自动适配日夜模式，不再固定取 `--line`。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R73（2026-10-23 · 优先级批次 1 · 拖拽移动索引偏移修正：大纲 moveNode 同父下移 + 数据库列头拖拽）：
    canonical / step9-mirror 期望重算（1,293,389/B5461DDA… → 1,293,540/D91659B4…，
    +151 B / +3 行；LF · CR=0 · 换行符 23,786 → 23,789）。本波仅 2 处 JS 逻辑（CSS / DOM 结构 /
    数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① actions.moveNode 的 commit 回调：原实现先 splice 摘除再把 id 插入 toIndex，同父移动时摘除使
       目标位置左移一位 —— 「下移一位」实际零位移、「下移 N 位」落到 N−1 位；改为摘除后
       insertIdx=toIndex，同父且 fromIdx>=0 且 fromIdx<toIndex 时 insertIdx--，再按 insertIdx 插入
       （跨父移动口径不变：from!==to 时 insertIdx 恒等于 toIndex）；
    ② renderDbTable 列头拖拽 commit：原实现 splice(fromIdx,1) 后按 toIdx 插入，右移时同样少走一格；
       改为 insertIdx=fromIdx<toIdx?toIdx-1:toIdx 后插入，使列落点等于拖拽指示条所在位置
       （左移 insertIdx=toIdx 不变）。
    字节核对：① 新增 2 行（28 B + LF 1 = 29、60 B + LF 1 = 61）＋ 原插入语句 toIndex→insertIdx +2
    ＝ 92；② 新增 1 行（54 B + LF 1 = 55）＋ arr.splice 实参 toIdx→insertIdx +4 ＝ 59；
    92 + 59 = 151，与实测 1,293,540 − 1,293,389 = 151 完全吻合，无其它字节变动。末字节 0x0A · 无 BOM。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R74（2026-10-23 · 年度重复计数子节点遍历修正 + ICS UTC 跨天日期错位修正）：
    canonical / step9-mirror 期望重算（1,293,540/D91659B4… → 1,293,528/81576224…，
    −12 B / −1 行；LF · CR=0 · 换行符 23,789 → 23,788）。本波仅 2 处 JS 逻辑（CSS / DOM 结构 /
    数据契约 / 公开 API / <script> 块数 9 零变更）：
    ① buildYearCounts 的 forEach 回调内 freq==='yearly' 分支：原以两条 `return` 提前退出，
       会跳过回调末尾的 stack.push(cid)，导致年度重复事件的子节点不再被向下遍历计数；
       改为合并为单条件 `if(d.getFullYear()===year&&d>=base&&d<=yearEnd&&(year-base.getFullYear())%interval===0)step(d);`
       后不再提前返回（原 3 行 → 1 行，−46 B / −2 行）；
    ② importICS 的 DTSTART 解析：原 UTC（Z 结尾）分支仅把时/分折算为本地时区，日期仍沿用
       UTC 日期，跨零点时事件落到错误日；改为 `const utc` → `const local`、`dateStr` 由 const 改 let，
       Z 分支内追加 `dateStr=ymd(local);` 以本地年月日重算日期（`const`→`let` −2 B、`utc`→`local`
       +2 B、两处 getHours/getMinutes 调用 +4 B、新增行 29 B + LF 1 = 30 B，合计 +34 B / +1 行）。
    字节核对：−46 + 34 = −12，与实测 1,293,528 − 1,293,540 = −12 完全吻合；行数 −2 + 1 = −1
    （23,789 → 23,788）吻合。末字节 0x0A · 无 BOM。
    方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R75（2026-10-23 · 七项 JS 行为修正：日历 blur 读 DOM 竞态 / 大纲滑出清高亮 / 今天列与月视图时区口径 /
    主列被改成公式·关联·多选时的可编辑主列定位 / 多选下拉去重复重渲染 / 编辑态早退补刷字数模块 /
    docToXls 局部 esc 改名）：
    canonical / step9-mirror 期望重算（1,293,528/81576224… → 1,294,047/CE68352B…，+519 B / +14 行；
    LF · CR=0 · 换行符 23,788 → 23,802）。本波仅 JS 逻辑，CSS / DOM 结构 / 数据契约 / 公开 API /
    <script> 块数 9 零变更；逐项字节核对：
    ① renderCalNode blur 回调新增 `const liveText=text.textContent;`（33 B + LF 1 = 34）＋ 解析调用
       text.textContent → liveText（−4 B）＝ +30；
    ② outlineDragSelectMove 鼠标滑出列表时清回基准高亮：2 行 → 8 行，净 +6 行（+154 B）；
    ③ buildTimeGrid 今天列判定 cnYmd(cnNow()) → todayStr()（−4 B，0 行）；
    ④ dbPrimaryField 跳过 formula / link / multi_select 定位可编辑主列：4 行 → 9 行（+5 行）；
    ⑤ renderDbTable 两处 select 提交去掉 setDbCell 后的重复 forceRender（各 −13 B，0 行）；
    ⑥ renderMain 编辑态早退在 CALENDAR 分支补刷 chars 模块：+2 行；
    ⑦ docToXls 局部 esc 改名 xmlEsc（声明 +4 B、调用 +3 B）避免遮蔽全局 esc。
    末字节 0x0A · 无 BOM。方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R77（2026-10-23 · 五项交互中断与键盘收尾修正：日历事件拖拽 pointercancel 兜底 / 文字区指针捕获、
     模块缩放 pointercancel 改走 onCancel 还原、窗口失焦清大纲拖拽与框选、时间弹窗 ESC 关闭、
     设置面板 ESC 关闭）：
     canonical / step9-mirror 期望重算（1,294,047/CE68352B… → 1,296,452/9D96452E…，+2,405 B / +36 行；LF · CR=0 · 换行符 23,802 → 23,838）。本波仅 JS 逻辑，CSS / DOM 结构 / 数据契约 / 公开 API /
     <script> 块数 9 零变更；逐项落点：
     ① bindCalEventDrag：.evtx 分支补 setPointerCapture 与 cancel/up 的 releasePointerCapture，非 .evtx 分支补
        pointercancel 监听（仅复位 cal-tg-dragging + 摘监听 + 释放捕获，不提交时间）；
     ② calModuleBindResize：pointercancel 由 onUp 改接 onCancel（摘监听 + 取消 rAF + 释放捕获 + 还原
        initFlex/initMinWidth/initMinHeight/initHeight/initMaxHeight，不写 st.sizes、不调 saveUI）；
     ③ window blur：补 outlineDragEnd / outlineDragSelectDetach 兜底（防 mouseup 丢失残留幽灵与框选态）；
     ④ openCalTimeModal onKey：补 Escape 关闭（isTop 守卫 + preventDefault/stopPropagation），Tab trap 原样保留；
     ⑤ bindSettings 末尾：补 ESC 关闭设置面板（_modalStack 非空时不介入，避免与弹窗 ESC 叠加）。
     末字节 0x0A · 无 BOM。方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R78（2026-10-23 · 打印面板折叠不再隐式生成预览 / 字号滑块防抖重渲染日历 / 标签视图激活标签持久化）：
     canonical / step9-mirror 期望重算（1,296,452/9D96452E… → 1,296,781/F4BB9FCE…，+329 B / +4 行；LF · CR=0 · 换行符 23,838 → 23,842）。本波仅 JS 逻辑（UI 持久化新增可选键 tagActive，旧档缺省为 null 向后兼容），CSS / DOM 结构 / 公开 API /
     <script> 块数 9 零变更；逐项落点：
     ① bindRightSidebar 的 [data-toggle] 打印分支：展开仅 sp.classList.add('on')；收起 sp.classList.remove('on')，且仅当
        #content 内仍存在 .print-preview 时 forceRender()；删除该分支内的 showPrintPreview() 调用（预览改由用户显式触发）；
     ② bindSettings 的 #setFontSize oninput 末尾：clearTimeout(window.__fsCalTimer) + 250ms 防抖，回调内 _l7IsCalendarView()
        为真时 forceRender()（连续拖动字号不再逐帧整渲染日历视图）；
     ③ tagActive 持久化：ui 初始化 tagActive:null；uiSnapshot / _saveUINow 输出 tagActive:ui.tagActive||null；
        applyUIFields 仅接受 string 或 null（其余类型忽略）；renderMain 的 tags 分支改为仅当 _tagIndexCache 存在且命中该标签时
        渲染 renderTagNodes，否则回落 renderTagsView（索引未就绪 / 标签已消失时不再走空标签页）。
     末字节 0x0A · 无 BOM。方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R79（2026-10-23 · 死代码清理：makeCalDivider / .cal-divider CSS / ui.calColWidths）：
     canonical / step9-mirror 期望重算（1,296,781/F4BB9FCE… → 1,292,360/7BB8F416…，−4,421 B / −72 行；LF · CR=0 · 换行符 23,842 → 23,770）。
     本波仅删除零调用死代码，<script> 块数 9 不变（9 块逐块 vm 编译通过）；逐项落点：
     ① 删除 function makeCalDivider(side){...} 整段（含其上方说明注释 1 行，原 L9610–L9670，共 61 行）——全文件零调用点；
     ② 删除 CSS .cal-divider / .cal-divider::after / .cal-divider.h / .cal-divider.h::before / .cal-divider.h::after /
        .cal-divider:not(.h):hover::after,.cal-divider:not(.h).dragging::after / .cal-divider.h:hover::before,.cal-divider.h.dragging::before /
        body.cal-resizing 共 8 条 + 其上说明注释 1 行（原 L462–L470）；
     ③ @media (max-width:700px) 内删除 .cal-divider:not(.h){display:none}（该行其余声明逐字保留）；
     ④ ui 初始化删除 calColWidths:{note:null,today:null}；applyUIFields 删除 ui.calColWidths= 恢复语句；
        _saveUINow data 与 uiSnapshot 返回对象各删除 calColWidths:ui.calColWidths 键。
     数据契约 / 公开 API / DOM 结构零变更；UI 存档不再写出 calColWidths（旧档多余键读取即忽略，向后兼容）。
     末字节 0x0A · 无 BOM。方数保持 65（仅更新既有登记方 canonical / step9-mirror 期望值，不新增纳编物）。 */
  /* R80（2026-10-23 · 全量备份出口瘦身 BACKUP_SLIM / _backupSlimState / _slimVersions）：
     canonical / step9-mirror 期望重算（1,292,360/7BB8F416… → 1,295,362/88CCBDF8…，+3,002 B / +66 行；LF · CR=0 · 换行符 23,770 → 23,836）。
     本波仅在 exportFullBackup 上方新增模块级常量与两个精简函数并在出口接线，<script> 块数 9 不变（9 块逐块 vm 编译通过）；
     逐项落点：① const BACKUP_SLIM={activityDays:30,versionsPerDoc:1,versionsMax:60}；
     ② _backupSlimState(st)：safeClone 无法与原引用隔离时改 JSON 深拷贝、仍失败则 throw「备份精简失败」；activity 仅保留
        YYYY-MM-DD 且不早于今天-30 天的键（桶内 add/mod/del 结构原样保留）；_localCreated / _remoteReceived 去重并只保留
        typeof id==='string' 且仍存在于 nodes 的 id；_tombstones 删除 ts 非数值或 Date.now()-ts>30000 的键、删空后整键 delete；
     ③ _slimVersions(rows)：按 ts 倒序、每文档留 1 条、总量封顶 60，非数组返回 []；
     ④ 出口：state 改用精简副本、graphpos 仅保留仍存在的节点、versions 走 _slimVersions、异常分支 versions=[]、
        download 改 JSON.stringify(backup)（去 2 空格缩进）、toast 文案改为日志保留天数 + 每文档版本数。
     数据契约 / 公开 API / 导入端（handleImportFiles / restoreVersions / migrateStateObject）零变更（已兼容空数组 / 空对象）；
     同一夹具数据导出字节 77,346 B → 5,702 B（−92.63%）。末字节 0x0A · 无 BOM。方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R81（2026-10-23 · 全量备份出口瘦身第二批次：回收站裁剪 BACKUP_SLIM.trashMax / _backupPurgeTrashSubtree）：
     canonical / step9-mirror 期望重算（1,295,362/88CCBDF8… → 1,299,171/93377966…，+3,809 B / +74 行；LF · CR=0 · 换行符 23,836 → 23,910）。
     本波仅在批次 1 的备份精简链路上追加回收站维度，<script> 块数 9 不变（9 块逐块 vm 编译通过）；逐项落点：
     ① const BACKUP_SLIM 追加 trashMax:50（→ {activityDays:30,versionsPerDoc:1,versionsMax:60,trashMax:50}）；
     ② 新增 _backupPurgeTrashSubtree(out,rootId)：从 rootId 沿 children 以索引游标 + visited 收集子树 id（防环、单次 O(n)），
        逐项从父 children 摘除（自尾向头删除同名 id）、delete nodes[id]，并同步 delete dbRowHeights[id]、
        delete 所有以 id+'::' 开头的 dbColumnWidths 键、过滤 _localCreated / _remoteReceived 中的该 id、delete _tombstones[id]；
     ③ _backupSlimState 在 _tombstones 处理之后、return 之前追加两段：
        (a) trashed 先滤除非对象 / 无 rootId / rootId 已不在 nodes 的条目；超 trashMax 时按 Number(deletedAt)||0 升序排序，
            对最早 (length-trashMax) 条逐条调用 _backupPurgeTrashSubtree，trashed 只保留最近 trashMax 条；
        (b) 收集 trashIds（trashed[].rootId + trashed[].ids 中的字符串 id），再先收集后处理 _deleted===true、非 rootId、
            且不在 trashIds 的孤儿软删节点，逐条 _backupPurgeTrashSubtree（避免遍历 nodes 时增删键）；
     ④ 导入端（handleImportFiles / restoreVersions / migrateStateObject / validateImportedTree）零改动：精简后备份仍可由「导入备份」恢复。
     真实 Chromium 回归：导出精简备份 50,334 B → 同串导入 → 文档树 / 日历待办 / 数据库字段与视图 / 标签颜色 / 图谱位置 /
     版本列表 / activity 30 天 / 回收站 50 条 全项通过（34/34 PASS，零 pageerror / 零 console.error；_环境与调试/r81-probe-r3-2026-10-23.txt）。
     末字节 0x0A · 无 BOM。方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R82（2026-10-23 · M0-7 生命周期收口：拆分前清除页面卸载悬挂资源）：
     canonical / step9-mirror 期望重算（1,299,171/93377966… → 1,301,653/EB85B1BF…，+2,482 B / +39 行；LF · CR=0 · 换行符 23,910 → 23,949）。
     本波为纯生命周期治理，业务语义零变更，<script> 块数 9 不变（9 块逐块 vm 编译通过）；逐项落点：
     ① boot() 末尾新增 pagehide 统一清理（10 项，各自独立 try/catch，单项失败不阻断其余项）：
        STORE_BC_INSTANCE.close → null / _l7YieldCh 两端 close + _l7YieldQ.length=0 → null；
        _syncAppInertObserver.disconnect → null / window.__juA11yObserver.disconnect → null；
        _reminderTimer 与 pomoState.timer 各自 clearInterval → null；
        _indexWorkerDispose(true) / _graphWorker.dispose() → null；
        window.__juVsLongtaskObserver.disconnect → null / __l14LongtaskGate.observer.disconnect（不置 null）；
     ② _syncAppInert 的 MutationObserver 持柄提升为模块级 let _syncAppInertObserver=null（if 守卫内创建 + observe）；
     ③ _a11y IIFE 的 const mo 改为 window.__juA11yObserver（含 observe 调用）；
     ④ _vsMetric 的 PerformanceObserver 改为 window.__juVsLongtaskObserver（先赋值再 observe）；
     ⑤ 删除 </html> 之后的尾页脚注释行（38 B 注释 + LF = 39 B）：根元素外注释属无效 HTML，会干扰后续 Vite 解析。
     末字节仍 0x0A · 无 BOM。方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R83（2026-10-23 · M0-7/M1-1 拆分前置：执行期依赖惰性化 + 全局导出契约打桩）：
     canonical / step9-mirror 期望重算（1,301,653/EB85B1BF… → 1,302,295/E25B293D…，+642 B / +10 行；LF · CR=0 · 换行符 23,949 → 23,959）。
     本波为拆分前置治理，业务语义 / 数据契约 / `<script>` 块数 9 零变更（9 块逐块 vm 编译通过）；逐项落点：
     ① const OPT_COLORS=_themeList('--opt-palette',[]) → let _optColorsCache + getOptColors() 惰性读取并缓存
        （renderOpts 内改为 const oc=getOptColors() 后取色，避免顶层 getComputedStyle 的 CSSOM 就绪时序依赖）；
     ② const TAG_COLORS=_themeList('--tag-palette',[]) → let _tagColorsCache + getTagColors() 惰性读取并缓存
        （getTagColor 与 openTagPalette 两处调用点同步改为函数取值）；
     ③ boot() 末尾（pagehide 清理块之后）新增 window.JU 导出契约：state() / ui() / commit / subscribe / actions / N，
        键名集合固定，M1-1 拆分阶段方可扩展。
     末字节仍 0x0A · 无 BOM。方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R84（2026-10-23 · M0-7/M1-1 拆分前置第二批：全局挂载点收敛 _win + JuWindow 类型声明）：
     canonical / step9-mirror 期望重算（1,302,295/E25B293D… → 1,303,076/34D20ECE…，+781 B / +37 行；LF · CR=0 · 换行符 23,959 → 23,996）。
     本波为拆分前置治理，业务语义 / 数据契约 / 现有函数签名 / `<script>` 块数 9 零变更（9 块逐块 vm 编译通过）；逐项落点：
     ① 第 1 段 <script> 的 "use strict"; 之后插入 JuWindow JSDoc 类型声明（@typedef Window & typeof globalThis & {…}）
        与 const _win = window 的 JuWindow 类型标注声明（共 +37 行，含 1 行中文说明注释），供后续 Vite + TS 转译识别；
     ② 全文 143 处 window.<prop> 收敛为 _win.<prop>（仅限 JuWindow 声明覆盖的属性名；window.getSelection /
        window.__TAURI__ / window.__juIndexShadow / window.__juA11yObserver 等未列入声明的访问点保持原样）；
     ③ 错误率窗口函数内的同名局部 const _win=Math.floor(now/60000) 改名 _rateWin（2 处），消除与全局 _win 的遮蔽；
     ④ boot() 末尾的 window.JU 导出契约（R83 落）改为 _win.JU 同址挂载，运行时仍是同一个 window 对象。
     末字节仍 0x0A · 无 BOM。方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R85（2026-10-23 · M0-7 Vite + TS 骨架前阻断项治理）：canonical / step9-mirror 期望重算
     （1,303,076/34D20ECE… → 1,305,739/D542257F…，+2,663 B / +21 行；LF · CR=0 · 换行符 23,996 → 24,017）。
     本波落点：① 首脚本 "use strict"; 后新增 window.JU 全局桥 + 生命周期注册表（register/require/constants/lifecycle）；
     ② TAG_RE 之后提前声明 WIKI_RE / APP_LOCALE 并登记 JU.constants，删除 script3 的 WIKI_RE 与 script4 的 APP_LOCALE
     重复声明（全文件各 1 处）；③ 删除 script2 的 forceRender 重赋值包装，viewSwitch 采样移入首脚本 forceRender；
     ④ L9 自动 attach 与 L10 waitShadow 轮询删除，改为 JU.initL9Shadow / JU.initL10Seam 显式初始化（boot 内调用）；
     ⑤ pagehide 10 项硬编码清理改为 JU.lifecycle.add 注册 + dispose，观察者释放同期登记。
     `<script>` 块数 9 零变更（9 块逐块 vm 编译通过）；无 type=module / 动态 import。末字节仍 0x0A · 无 BOM。
     方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R86（2026-10-23 · M0-7 骨架可用：JU 导出契约四组注册 + 调试全局收口 + TS 声明件）：
     canonical / step9-mirror 期望重算（1,305,739/D542257F… → 1,309,604/EA1D8393…，+3,865 B / +69 行；LF · CR=0 · 换行符 24,017 → 24,086）。
     本波仍为拆分前置治理，业务语义 / 数据契约 / 现有函数签名 / `<script>` 块数 9 零变更（9 块逐块 vm 编译通过）；逐项落点：
     ① script#1 末尾注册 JU.register('core', …)（30 键）；script#2 末尾注册 JU.register('outlineCalendar', …)（13 键）；
        script#3 末尾注册 JU.register('views', …)（13 键）；script#4 末尾注册 JU.register('app', …)（17 键）。
        四组键名与 M0-7 契约清单逐项一致，键值一律引用现有实现（不复制实现）。
     ② 定义在后继 <script> 的成员（core.openNode / safeNavigate / download、views 的 script#4/#5 渲染组、app 全组）
        以对象字面量 getter 延迟取同一引用，避免注册块所在块末对后继块标识符提前求值（取值仍为同一引用，非包装/非拷贝）。
     ③ boot 末尾（_win.JU 导出之后）追加 window.JU.debug 统一入口（indexShadow / skeleton / l14 / vsMetrics），
        整块 try/catch 包裹；旧 window.__juIndexShadow / __juSkeleton / __l14 / __juVsMetrics 别名全部保留，M1 阶段再移除。
     ④ 新增 `6.P0-T3基线/types/ju-globals.d.ts`（JuLifecycle / JuBridge / Window.JU 声明），不纳入本登记器锚点。
     单 HTML 构建约束静态检查：type=module 0 / 动态 import 0 / module Worker 0。末字节仍 0x0A · 无 BOM。
     方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R87（2026-10-23 · 护眼优化 批次2/2：字号下限 + 行高 + 过渡 + 跟随系统主题）：
     canonical / step9-mirror 期望重算（1,309,604/EA1D8393… → 1,310,569/18D531CD…，
     +965 B / +45 行；LF · CR=0 · 换行符 24,086 → 24,131）。本波变更：主样式表末尾追加批次2
     CSS 块（:root --font-size:15px + --t-fast/--t-base/--t-slow、字号下限 max()、行高与行内距）；
     JS 新增 applySystemTheme()，toggleTheme / openThemeSelector 确认时写入 juju.theme.manual=1，
     boot 在 applyTheme(initTheme) 之后调用 applySystemTheme()。.row:hover 与滚动条规则零改动；
     数据契约 / 公开 API / `<script>` 块数 9 零变更。方数保持 65（仅更新既有登记方期望值）。 */
  /* R88（2026-10-23 · 护眼优化 批次2/2 补完：文字纯黑/纯白 + 跟随系统主题补全）：
     canonical / step9-mirror 期望重算（1,310,569/18D531CD… → 1,311,866/922411C0…，
     +1297 B / +64 行；LF · CR=0 · 换行符 24,131 → 24,195）。本波变更：主样式表末尾 R87 批次2 块之后
     再追加「护眼补丁 v2 · 批次2」覆盖块（:root 字号/过渡令牌；:root,html[data-theme="day"] 纯黑文字令牌；
     html[data-theme="night"] 纯白文字令牌；日夜 body 文字色；字号下限 max()、行高与行内距）。
     纯黑/纯白以 CSS 关键字 black / white 表达（与六位十六进制全黑/全白等价），维持 L16-W9「定义块外
     六位十六进制色值命中 = 0」不变量。原 :root 与 html[data-theme="night"] 定义块一行未改；
     JS（applySystemTheme / juju.theme.manual / boot 调用）沿 R87 已落地，本波零改动；
     数据契约 / 公开 API / `<script>` 块数 9 零变更。方数保持 65（仅更新既有登记方期望值）。 */
  /* R89（2026-10-23 · 大纲视图 跨行文字选择 / 复制 / 剪切 / 粘贴修复）：
     canonical / step9-mirror 期望重算（1,311,866/922411C0… → 1,315,345/4A688EA9…，
     +3,479 B / +61 行；LF · CR=0 · 换行符 24,195 → 24,256；末字节 0x0A · 无 BOM）。
     t3-invariants.spec.ts 期望重算（15,333/29216798… → 17,795/0BF906B5…，+2,462 B / +32 行；LF）。
     产品侧变更（四处行为修复 + 一处新增 + 一处防御）：
     ① outlineDragSelectMove：ds.fromText 为真时锁定 mode='text'，不再因纵向拖动进入 'multi'
        （原实现会 removeAllRanges 清空原生文本选区，导致跨行选中的文字无法复制 / 剪切 / 粘贴）；
     ② 行 mousedown：Ctrl/Cmd 与 Shift 节点多选分支追加 !target.closest('.text')，
        编辑区内放行浏览器原生行为（Shift 扩展文本选区、原生复制 / 剪切）；
     ③ 新增顶层 copyOutlinePlainText(txt)：Clipboard API 优先，异常 / 不可用时回退
        position:fixed 隐藏 textarea + safeExec('copy')，始终返回 Promise；
     ④ bindOutlineText keydown：无文本选区且存在节点多选时，Ctrl/Cmd+C / X 复制所选顶层节点纯文本
        （每行一条），X 另删除所选顶层节点；存在文本选区一律不拦截；
     ⑤ bindOutlineText paste：非折叠选区在同一编辑区内先 deleteContents 并写回 state
        （避免 splitPastedLinesToNodes 读旧 state 覆盖），跨编辑区选区折叠到本区末尾；
     ⑥ 顶层 document mousedown（ctxMenu 外点关闭）：closest 前补能力判定——②放行 .text 内 mousedown 后，
        Text 节点目标会冒泡至此并触发 Uncaught TypeError: e.target.closest is not a function。
     验收侧：t3-invariants.spec.ts 的 r18 / r19 段按新契约重写——节点多选的派发目标由 .text 改为
     .row（行 chrome）；.text 内 Ctrl/Shift 断言改为「不触发节点多选、且不抛 closest TypeError」；
     垂直拖拽拆为「起点在 .text 内 → 不进入 multi、原生 Range 保留在起始编辑区」与
     「起点在行 chrome → 跨行多选 + 底色/无边框断言」两段。
     数据契约 / 公开 API / 非优化分支零变更；`<script>` 块数 9 零变更。
     方数保持 65（仅更新既有登记方期望值，不新增纳编物）。 */
  /* R90（2026-10-23 · 大纲 / 记事本 / 日历待办：选区粘贴同口径 + 同步复制回退 + 选区 Enter/Tab）：
     canonical / step9-mirror 期望重算（1,315,345/4A688EA9… → 1,319,506/46670A74…，
     +4,161 B / +72 行；LF · CR=0 · 换行符 24,256 → 24,328；末字节 0x0A · 无 BOM）。
     产品侧变更（三组同源缺陷修复）：
     ① bindNoteText / renderCalNode paste：在 e.preventDefault() 之前补同口径选区预处理——
        本编辑区内非折叠选区先 deleteContents 并 commit(silent + persistOnly) 同步 state，
        跨编辑区选区折叠到本区末尾（commit 节点用 id / n.id，dirtyDocs 用
        findOwningTopDocId / getCalendarRootId）；
     ② 顶层复制函数由异步优先改造为同步 execCommand 优先：隐藏 textarea（position:fixed /
        left:-9999px / opacity:0）+ value + appendChild + select() + safeExec('copy')，
        返回布尔值并在 keydown 同步手势内完成复制；Ctrl/Cmd+C 成功即 toast 并在下一拍把焦点
        还给原编辑器；Ctrl+X 仅在同步成功（或异步 Clipboard API 成功）后才删除所选顶层节点，
        两者皆失败提示「复制失败：浏览器限制了剪贴板访问」；
     ③ bindOutlineText keydown：有选区按 Enter 只删除选区（不新建节点）、按 Tab 先删选区
        再缩进 / 反缩进，消除「选区文字重复 / 错位」。
     数据契约 / 公开 API / `<script>` 块数 9 零变更。方数保持 65（仅更新既有登记方期望值）。 */
  /* R91（2026-10-23 · 批次 8/9：复制 / 剪切范围对等 + 焦点恢复 + 历史合并 + 键位健壮性）：
     canonical / step9-mirror 期望重算（1,319,506/46670A74… → 1,323,173/BE973C60…，
     +3,667 B；LF · CR=0 · 换行符 24,399）。
     产品侧变更（5 项）：
     ① 新增顶层 collectOutlinePlainText(tops)：按深度优先递归收集每个顶层节点整棵子树，
        每节点一行 stripHtml 文本、条目内空白折叠、条目间换行、末尾无换行；N(id) 缺失 /
        _deleted / 系统容器（_isCalRoot · _isDbRoot · _isNoteRoot）跳过 ⇒ 复制内容 = 将删除范围；
     ② Ctrl+X 改为单次 commit 递归删除多顶层节点子树（purgeNodeMeta / collapsedDocs /
        搜索缓存 / 墓碑口径与 actions.removeNode 一致）⇒ 一次 Ctrl+Z 完整回退；
     ③ 删除前取 restoreId = previousVisible(tops[0]) || nextVisible(tops[0])，删除并 forceRender 后
        以 requestAnimationFrame 把焦点还给该节点文本末尾，无目标则落到 .doc-header-title；
     ④ Ctrl+C 分支同样恢复焦点（restoreId 取 ui.focusId || tops[0]），复制后编辑器焦点不丢；
     ⑤ keydown 触发条件改为 (ctrlKey||metaKey) && !shiftKey && !altKey + 键值 toLowerCase：
        CapsLock 大写 C / X 同效，AltGr（Ctrl+Alt）不再误触发；hasTextSel 判定与 return 结构不变。
     数据契约 / 公开 API / 脚本块数 9 零变更。方数保持 65（仅更新既有登记方期望值）。 */
  /* R92（2026-10-23 · 批次 11–14：大纲文本选区回归 + 风险增强回退 + 最小版节点复制）：
     canonical / step9-mirror 期望重算（1,323,173/BE973C60… → 1,319,318/4388BFB1…，
     −3,855 B；LF · CR=0 · 换行符 24,328；末字节 0x0A · 无 BOM）。
     产品侧变更（6 项 · 全部集中在大纲拖拽选中 / 键盘复制通路）：
     ① outlineDragSelectMove：起点在 .text 内时锁定 mode='text' 后立即 return，
        杜绝后续 removeAllRanges() 清空刚拉出的原生文本选区（此前仅赋值、未返回）；
     ② outlineDragSelectEnd：mode==='text' 或 fromText 时直接 return（不 forceRender、
        不重置 _outlineSel），文本选区在 mouseup 后继续存活、可继续 Shift+点击扩展；
     ③ 行 mousedown：改用 target.closest('.text') 显式判定 inText，仅 !inText 时接管
        Ctrl/Cmd 与 Shift 的节点多选，编辑区内一律放行浏览器原生行为；
     ④ 回退 R91 的 collectOutlinePlainText 及其 keydown 调用，并回退 R90/R91 的 Ctrl+C/X
        长分支（rAF 焦点恢复 / 递归删除子树 / 异步 Clipboard 补位）——该分支与文本选区故障
        耦合，先整体下线；
     ⑤ keydown 重建最小版节点多选复制 / 剪切：仅「无文本选区 + _outlineSel.ids 非空」时接管，
        隐藏 textarea + safeExec('copy') 同步复制所选顶层节点纯文本；X 且复制成功后
        actions.removeNode 逐个删除并清空多选；存在文本选区一律不拦截；
     ⑥ boot()：renderMain() 之前补 document.body.style.userSelect='' 残留自愈，避免异常
        中断的拖拽把 body 的 user-select:none 遗留到下一次启动。
     copyOutlinePlainTextSync 自 R90 保留未删（本波无调用方，不影响行为）。
     数据契约 / 公开 API / `<script>` 块数 9 零变更。方数保持 65（仅更新既有登记方期望值）。 */
  /* R93（2026-10-23 · 大纲文本选区回归根治：撤销 R90–R92 次生问题 + 单一收口）：
     canonical / step9-mirror 期望重算（1,319,318/4388BFB1… → 1,313,444/8D81D34F…，
     −5,874 B；LF · CR=0 · 换行符 24,328 → 24,230；末字节 0x0A · 无 BOM）。
     产品侧变更：真因仅一处——outlineDragSelectMove 在 fromText=true 且垂直拖动时误判
     mode='multi' 并 removeAllRanges() 清空刚拉出的原生选区。R90–R92 的渐进补丁反而引入
     次生问题（fromText 分支替换不完整 / Ctrl+C/X keydown 在 _outlineSel.ids 非空时覆盖
     原生复制剪切 / 修饰键条件化后 preventDefault 位置漂移），本波全部回退并改为相反策略：
     ① 回退 R91 collectOutlinePlainText 遗留、R90 copyOutlinePlainTextSync、R90/R91 Ctrl+C/X
        keydown 长分支、R90 paste 选区预处理、R90 Enter/Tab 选区删除 + commit、
        R92 boot() 的 document.body.style.userSelect='' 残留自愈（共 6 处整段删除）；
     ② outlineDragSelectStart / Move / End 按定稿版整体替换（含首尾大括号）——
        Move 首行 `if(ds.fromText)return;` 无条件提前返回，End 首行同样 `if(fromText)return;`，
        即使 mousedown 仍传 fromText=true，多行文本选区也不会被清空；
     ③ 行 mousedown 恢复为「修饰键无条件接管」，但第二行新增 `if(target.closest('.text'))return;`
        —— .text 内普通点击 / Ctrl+点击 / Shift+点击 / 拖动全部放行浏览器原生（不启动
        _outlineDragSel、不 preventDefault），行 chrome（.row 非 .text）上的 Ctrl / Shift /
        垂直刷选与修改前完全一致。
     数据契约 / 公开 API / `<script>` 块数 9 零变更。方数保持 65（仅更新既有登记方期望值）。 */
  /* R94（2026-10-23 · 回到 pre-r89 基线 + outlineDragSelectStart 首行单行收口）：
     canonical / step9-mirror 期望重算（1,313,444/8D81D34F… → 1,312,186/F198ABCF…，−1,258 B；
     LF · CR=0 · 换行符 24,230 → 24,198；末字节 0x0A · 无 BOM）。
     产品侧变更：
     ① R90–R93 各批次整体回退（copyOutlinePlainText、Ctrl+C/X keydown 分支、paste 选区预处理、
        Enter / Tab 选区删除 + commit、outlineDragSelectMove / End 的 fromText 分支、
        行 mousedown 的 .text 早退、boot() userSelect 自愈、bindNoteText / renderCalNode paste 预处理），
        基线取 pre-r89 快照 v2.0-t3.html.bak-r89-2026-10-23；
     ② 唯一新增一行：outlineDragSelectStart 首行 `if(fromText)return;`——.text 内按下不创建
        _outlineDragSel，后续 mousemove 以 if(!ds)return 早退，原生文本选区完全不受干预；
     ③ 行 mousedown 恢复 pre-r89 原样（Ctrl/Cmd 与 Shift 分支无条件接管；末尾仍为
        outlineDragSelectStart(e,n.id,!!target.closest('.text'))），.text 内 Ctrl+点击 / Shift+点击
        的节点多选入口恢复；
     ④ 保留 1 处 r89 防御性硬化（document mousedown 的 e.target.closest 能力判定，行为中性）。
     ⑤ 验收侧：tests/t3-invariants.spec.ts 唯一断言由「.text 内 Ctrl 不触发节点多选（期望 0）」
        改为「.text 内 Ctrl 恢复节点多选（期望 1）」，与 ③ 的契约同步；Text 节点目标不得抛
        closest TypeError 的断言保持不变。期望值随之重算 17,795/0BF906B5… → 17,794/AD5789A1…。
     数据契约 / 公开 API / `<script>` 块数 9 零变更。方数保持 65（仅更新既有登记方期望值）。 */
  /* R95（2026-10-23 · 大纲 .text 内拖动方向判定 + 多选节点复制 / 剪切 / 粘贴）：
     canonical / step9-mirror 期望重算（1,312,186/F198ABCF… → 1,315,777/652B5197…，+3,591 B；
     LF · CR=0 · 换行符 24,198 → 24,294；末字节 0x0A · 无 BOM）。
     产品侧变更：
     ① outlineDragSelectStart 删除首行 `if(fromText)return;`——.text 内按下同样创建 _outlineDragSel
        并进入方向判定：水平位移为主保持原生文字选择（应用不 preventDefault、不清选区），
        垂直位移为主（|dy| > |dx| + 5）清空文本选区并进入 _outlineSel 跨行多选；
     ② outlineBatchDelete 之后、outlineDragStart 之前新增节点级剪贴板：
        _outlineClipboard / _outlineNodeToClipData / outlineCopySelection(cut) / outlinePasteClipboard；
        粘贴按父节点子序列原位插入（children 递归重建，db / block / tableData 深拷贝），
        完成后 _outlineSel 落位到新增节点并 forceRender；
     ③ 文档级 keydown（capture=true）绑定一次（window._juOutlineClipBound 幂等）：仅处理
        Ctrl/Cmd + C / X / V；存在非空文字选区时一律放行原生；C / X 仅在 _outlineSel 多选
        （size > 1）且无可编辑焦点时接管；V 在可编辑宿主内放行，其余由节点剪贴板接管。
     ④ 验收侧：tests/t3-invariants.spec.ts 的 r19「②-A 垂直拖拽（起点在 .text 内）」断言由旧契约
        （multi=0 / ids=0 / ranges>=1 / anchorInHost=true）同步为 R95 契约
        （multi=2 / ids=2 / ranges=0 / anchorInHost=false）；期望值随之重算
        17,794/AD5789A1… → 17,957/5D094B83…（+163 B / +3 行）。
     数据契约 / 公开 API / `<script>` 块数 9 零变更。方数保持 65（仅更新既有登记方期望值）。 */
  /* R95b（2026-10-23 · R95 续修：仅内存剪贴板 → 系统剪贴板同步读写 + 方向判定收口）：
     canonical / step9-mirror 期望重算（1,315,777/652B5197… → 1,316,707/5FED0215…，+930 B；
     LF · CR=0 · 换行符 24,294 → 24,325；末字节 0x0A · 无 BOM）。
     产品侧变更（整段替换 R95 的进程内剪贴板 + keydown 拦截，锚点 = outlineDragStart 之前）：
     ① 删除 R95 插入物：`let _outlineClipboard=null;`、outlineCopySelection(cut)、
        outlinePasteClipboard()、window._juOutlineClipBound 绑定的 keydown(capture) 块；
     ② 新增 const OUTLINE_CLIP_PREFIX='JU-NODES:' + _outlineNodeToClipData / _outlineParseClipText /
        _outlineInsertClipNodes（粘贴插入逻辑由原 outlinePasteClipboard 迁移，返回插入计数）；
     ③ 改用 copy / cut / paste 事件（capture=true）：copy / cut 经 e.clipboardData.setData('text/plain')
        同步写系统剪贴板，仅在无文字选区且 _outlineSel.ids.size>1 时接管（其余放行原生）；
        paste 经 e.clipboardData.getData('text/plain') 同步读取，仅当内容以 'JU-NODES:' 开头
        且 JSON 结构 {v:1,nodes:[…]} 合法时接管，普通文字 / Word 富文本粘贴不拦截；
     ④ 不调用 navigator.clipboard.readText，无异步时序依赖；跨标签 / 刷新后粘贴走系统剪贴板标准通道；
     ⑤ outlineDragSelectStart 首行已无 `if(fromText)return;`（R95 已删），本波零改动。
     数据契约 / 公开 API / `<script>` 块数 9 零变更。方数保持 65（仅更新既有登记方期望值）。 */
 ['canonical',        path.join(ROOT, '3.code', 'canonical', 'v2.0-t3.html'),                      1316707, '5FED021578E775B560BF98AF719046EB2916472F4053354A33A1A436DFBFF818', 'LF'],
 ['step9-mirror',     path.join(ROOT, '99.hist', '6.dev', 'gates', 'v2.0-t3.html'),                                    1316707, '5FED021578E775B560BF98AF719046EB2916472F4053354A33A1A436DFBFF818', 'LF'],
  /* 决策 L22-QA-D1（2026-10-17 · L22 归档封存）：frozen-l8（907,419 / 2F43EA0F…）与
     1.冻结版本\v2.0-t3-frozen-t9-2026-10-14.html 逐字节同源（后者物理保留为只读历史锚，
     并由 _w5freeze.ps1 的 L8 / L9 两条 P3 锚点独立校验），去重退役该重复登记方，
     同址纳入本波物化冻结件 frozen-l22（与 canonical 逐字节一致 · 1,152,513 / 5C9B133B…），
     方数保持 47（纳编与去重退役同波等量置换）。 */
  /* L20-QA（2026-10-17 · 全量 QA 终验与归档封存）：frozen-l9 与 frozen-l8 逐字节同源
     （同 907,419 B / 同 SHA-256），去重退役该重复登记方，同址纳入本波物化冻结件 frozen-l20
     （与 canonical 逐字节一致 · 1,145,884 / 07C9CD44…），方数保持 47（决策 L20-QA-D1）。 */
  ['frozen-l20',       path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t20-2026-10-17.html'),     1145884, '07C9CD44F9EB9BBDEE03AA03F33D6D6C45EA02CDBDBBCA03C2D01D536D225D62', 'LF'],
  ['frozen-l21',      path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t21-2026-10-17.html'),     1147911, 'B102568DBF8A8DD610C758EE45CA7CBBEDBD26CE54BB2E49BEDC919C82A9C1BF', 'LF'],
  /* L22 最终验收封存-r3（2026-10-18）：人工验收通过后物化 frozen-l22-final-r3（= canonical 逐字节一致
     · 1,173,380 / E05C7764…）。按既有等量置换纪律保持 47 方：frozen-l22-final（1,157,639 / 5B4801D5…）
     作为历史只读锚物理保留于 1.冻结版本\，由 _w4paths.ps1 / _w5freeze.ps1 / _w4freeze.ps1 的
     L22-final 锚点独立校验；登记器纳编位由本波 r3 冻结件接续。 */
  /* L22 最终验收封存-r4（2026-10-18 · DEF-010 后重新冻结）：canonical 在 DEF-010 修复后为
     1,173,448/D8C18C6A…，而 r3 冻结件仍停留在修复前的 1,173,380/E05C7764…（文档与代码脱节）。
     本波物化 frozen-l22-final-r4（与 canonical 逐字节一致 · 1,173,448/D8C18C6A…），
     按既有等量置换纪律保持 47 方：r3 转为历史只读锚物理保留于 1.冻结版本\（字节零变更，
     期望值不变），登记器纳编位由 r4 接续。 */
  /* r4 再次冻结（2026-10-18 · UI-Token 清理波后 · 按指令 9 覆盖）：r4 由 1,173,448/D8C18C6A… 覆盖重物化为
     1,174,134/88571951…（与 canonical 逐字节一致）；r3 仍为历史只读锚（1,173,380/E05C7764… 不变）。 */
  /* TODO-3 性能修波后再冻结（2026-10-18）：r4 由 1,174,134/88571951… 覆盖重物化为 1,174,919/0B4AA2A6…
     （与 canonical 逐字节一致）；r3 仍为历史只读锚（1,173,380/E05C7764… 不变）。 */
  /* 命名清理（2026-10-18 · 批次 11 发布波 · 红线「严禁 final 命名」）：r4 冻结件仅做更名
     v2.0-t13-frozen-t22-final-r4-2026-10-18.html → v2.0-t13-frozen-t22-r4-2026-10-18.html，
     文件内容零变更 ⇒ 期望字节 / SHA-256 / 行尾全部不变；登记方标识同步由 frozen-l22-final-r4
     改为 frozen-t22-r4，方数保持 47（r4 之前带 final 的冻结件按只读历史锚原样保留）。 */
  ['frozen-t22-r4',    path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r4-2026-10-18.html'),      1174919, '0B4AA2A66D03C65219B1CF8A08407AF65DFCA3B2AF09544AB6632D78FA945A3C', 'LF'],
  /* UI-P0/P1/P2 修正波（2026-10-19）：新封存件 r5 与 canonical 逐字节一致（1,187,766 / 3E7FAF2B…，LF）；
     r4 作为历史只读锚继续登记，方数 49 → 50。 */
  ['frozen-t22-r5',    path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r5-2026-10-19.html'),      1187766, '3E7FAF2B6BE36843F7BB116F60EAF493E216DC44676ABD37DE0CB6E31DE443D0', 'LF'],
  /* r6 · 右侧栏按钮覆盖修正波（2026-10-19）：新封存件 r6 与 canonical 逐字节一致
     （1,188,674 / 239250FD…，LF）；r5 转历史只读锚并继续登记，方数 50 → 51。 */
  ['frozen-t22-r6',    path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r6-2026-10-19.html'),      1188674, '239250FDE00DB15E28971AF7CBE15D7C734248B080494D08AD9C6D4A39B275C6', 'LF'],
  /* r7 · 幻灯片按钮样式统一波（2026-10-19）：新封存件 r7 与 canonical 逐字节一致
     （1,188,344 / 1F972407…，LF · CR=0 · LF=21,950）；r6 转历史只读锚并继续登记，方数 51 → 52。 */
  ['frozen-t22-r7',    path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r7-2026-10-19.html'),      1188344, '1F972407A1AD1157AB84EF8C4063235D4E9744B2CA82564829DDB15653B242ED', 'LF'],
  /* r8 · 幻灯片大纲渲染 + 长按整行拖拽（2026-10-19）：新封存件 r8 与 canonical 逐字节一致
     （1,189,026 / 7AF8575A…，LF · CR=0 · LF=21,984）；r7 转历史只读锚并继续登记，方数 52 → 53。 */
  ['frozen-t22-r8',    path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r8-2026-10-19.html'),      1189026, '7AF8575A457F67B2690A3A2BAEB16F5D484EADDBE3933FC389719C1213B35F30', 'LF'],
  /* r9 · 幻灯片缩略图留白 + 舞台 16:9 最大化（2026-10-19）：新封存件 r9 与 canonical 逐字节一致
     （1,190,072 / D74D58AA…，LF · CR=0 · LF=21,990）；r8 转历史只读锚并继续登记，方数 53 → 54。 */
  ['frozen-t22-r9',    path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r9-2026-10-19.html'),      1190072, 'D74D58AA37FE4BAC59101C9AA6103136C8A9D8541538EAEC59E52410B9AF1738', 'LF'],
  /* r10 · 主舞台取消垂直居中 + 顶部与缩略图对齐（2026-10-19）：新封存件 r10 与 canonical 逐字节一致
     （1,190,729 / 14F3A930…，LF · CR=0 · LF=21,994）；r9 转历史只读锚并继续登记，方数 54 → 55。 */
  ['frozen-t22-r10',   path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r10-2026-10-19.html'),     1190729, '14F3A9300D577CAC0B41142BB5A713706E0654E74A09DDD86B5E92D438EE9785', 'LF'],
  /* r11 · 主内容区滚动保护区 + 折叠按钮下移（2026-10-19）：新封存件 r11 与 canonical 逐字节一致
     （1,192,443 / 0010EBE1…，LF · CR=0 · LF=22,004）；r10 转历史只读锚并继续登记，方数 55 → 56。 */
  ['frozen-t22-r11',   path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r11-2026-10-19.html'),     1192443, '0010EBE117F75D37F4578824645C704FC83A12A556549EB67025FD2153AF933E', 'LF'],
  /* r12 · 大纲选中态与顶部导航激活态统一（2026-10-19）：新封存件 r12 与 canonical 逐字节一致
     （1,192,469 / 72C94A5D…，LF · CR=0 · LF=22,006）；r11 转历史只读锚并继续登记，方数 56 → 57。 */
  ['frozen-t22-r12',   path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r12-2026-10-19.html'),     1192469, '72C94A5DB665404AA914B91A9444AD054A6DAC18D329783F45C129D15BCDDE6C', 'LF'],
  /* r13 · 大纲背景单层化 + 内容区加宽（2026-10-19）：新封存件 r13 与 canonical 逐字节一致
     （1,192,610 / 917D9ABC…，LF · CR=0）；r12 转历史只读锚并继续登记，方数 57 → 58。 */
  ['frozen-t22-r13',   path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r13-2026-10-19.html'),     1192740, '5D68A8581BDD777D484BEBFA68EC8C7B8D30BA94EE1665CD5F3323FF98672D0A', 'LF'],
  /* r14 · 底部 32px 实色保护区 + 折叠三钮居中（2026-10-19）：新封存件 r14 与 canonical 逐字节一致
     （1,193,188 / C13DD3B2…，LF · CR=0 · LF=22,008）；r13 转历史只读锚并继续登记，方数 58 → 59。 */
  ['frozen-t22-r14',   path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r14-2026-10-19.html'),     1193188, 'C13DD3B20675F0CD7E00C50510AE4B4501A1686B5525AD7EDA3289E560A7923F', 'LF'],
  /* r15 · 大纲背景块清除 + 折叠三钮视口 fixed（2026-10-19）：新封存件 r15 与 canonical 逐字节一致
     （1,193,978 / 6664F765…，LF · CR=0 · LF=22,013）；r14 转历史只读锚并继续登记，方数 59 → 60。 */
  ['frozen-t22-r15',   path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r15-2026-10-19.html'),     1193978, '6664F765CAE1843EDF3BDF8B79215A0088D7378814D8B9A119314CA05C02BAE7', 'LF'],
  /* r16 · 残留背景块清零 + 折叠三钮 40px 对称锁定（2026-10-19）：新封存件 r16 与 canonical 逐字节一致
     （1,194,479 / 06A90D0C…，LF · CR=0 · LF=22,016）；r15 转历史只读锚并继续登记，方数 60 → 61。 */
  ['frozen-t22-r16',   path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t22-r16-2026-10-19.html'),     1194479, '06A90D0C083C3F0A798F182F2325C90469D21DD15E350665E1B274FE1758FE5E', 'LF'],
  /* r18 · 大纲多选失效修复 + 选中/多选底色恢复（2026-10-19）：新封存件 r18 与 canonical 逐字节一致
     （1,205,588 / 11B96CBC…，LF · CR=0 · LF=22,238）；r17 物理保留为历史只读锚；方数 61 → 62。 */
  ['frozen-l22-final-r4', path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-l13-frozen-l22-final-r4-2026-10-19.html'), 1205588, '11B96CBC2C0814A85308443A35C600DE736E12F07A6167542F1A3C35BB2541B2', 'LF'],
  /* r22 物化冻结件（2026-10-20 · 富文本模式下线）：与 canonical 逐字节一致
     （1,212,364 / FE04CC1A…，LF · CR=0 · LF=22,387）；r4 / r18（同字节）转历史只读锚并继续登记，方数 62 → 63。 */
  ['frozen-l22-final-r5', path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-l13-frozen-l22-final-r5-2026-10-20.html'), 1212364, 'FE04CC1ADA7788FAFB84C11F4423CC303A42A124A9FB7E78A5ED4DF8A3F7C1D5', 'LF'],
  ['frozen-l9w6',      path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t3-frozen-t9w6-2026-10-15.html'),       968040, FROZEN_L9W6_HASH, 'LF'],
  ['frozen-l10',       path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t3-frozen-t10-2026-10-15.html'),        972078, 'D7D265D5C8C584F1F4D73AEBE10C69C17B5F4FD5E88EC08BAA56D29710FD31E5', 'LF'],
  /* 决策 L21-QA-D1（2026-10-17 · L21 归档封存）：frozen-l11 与 frozen-l10 逐字节同源（同 972,078 B / 同 D7D265D5…），去重退役该重复登记方，同址纳入本波物化冻结件 frozen-l21（与 canonical 逐字节一致 · 1,147,911 / B102568D…），方数保持 47。 */
  ['frozen-l11w6',     path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t3-frozen-t11w6-2026-10-15.html'),     972228, '72DA6B3ED39389C39A1C6A08D28271C96DEC1AA1A597208193A4843D638BA697', 'LF'],
  ['frozen-l12',       path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t3-frozen-t12-2026-10-15.html'),        983421, 'F8529C60381D733D8FA9F80242319D673A76218BF11230269BAFCE1DF60239DA', 'LF'],
  /* --- L13-W5 纳编（L0-8=B 修订 · 36 → 38 方）：L13 冻结件 + P 层 L13 spec --- */
  ['frozen-l13',       path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t3-frozen-t13-2026-10-16.html'),        991316, '21BECFD43D330913545DFAA9090B8BB06B0A850D911AC578DCF91A2CEC3AA3CA', 'LF'],
  /* --- L14-W5 纳编（L0-8=B 续扩 · 39 → 43 方）：L14 冻结件（本波物化 · 三方逐字节一致） --- */
  ['frozen-l14',       path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t3-frozen-t14-2026-10-16.html'),       1012003, 'D110699F19D5A9C79350AFC5375E325ED8D49BAAED2BAF1B18E3D9552ED7BBDD', 'LF'],
  ['frozen-l17',       path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t17-2026-10-17.html'),     1126551, '1D6BAFB95AF5EA893AA17DC6E90DD6189A6BB4C9DAE30344ADBF9A1151E6C00B', 'LF'],
  ['frozen-l19',       path.join(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t13-frozen-t19-2026-10-17.html'),     1127810, 'E75624C49343196734CEF3B3C8FA4E9B04AFC026D8E9BE211863E35124746674', 'LF'],
  /* --- 门禁脚本（L12-W2 接线 JU_L12；L12-W3 纳入 N 层 l12-virtual-scroll.test.mjs；L13-W2 接线 JU_L13；L13-W3 门禁激活默认开启，PW=165+6=171；L13-W6·OP-19 纳入 N 层 l13-mb-workset.test.mjs ⇒ Node 91→111；L14-W2 接线 JU_L14 默认关闭，缺省 PW=171 与 L13 逐项一致） --- */
  /* L22-R5 收尾（2026-10-18 · ISSUE 修复闭环）：verify.js 串行编排重构后期望重算
     （14,284/E4AE6324… → 14,174/ADFDEFD3…）。
     批次 1 缺陷修复（2026-10-18 · ISSUE-002）：分发处新增未知 mode 白名单守卫（非白名单 exit 2），
     期望值随之重算（14,174/ADFDEFD3… → 14,858/15FE8C52…）；_w5freeze.ps1 / _w4freeze.ps1 的
     'l15' 条目已同步为同一取值（ISSUE-001）。
     批次 2 缺陷修复（2026-10-18 · ISSUE-011）：删除硬编码的 C:\Users\12601\… Chrome 回退路径，
     改为 process.platform === 'win32' 时按 ProgramFiles 动态拼接、其它平台为 null，
     期望值随之重算（14,858/15FE8C52… → 15,074/C6CDF36C…）。
     批次 3 缺陷修复（2026-10-18 · ISSUE-018）：头注释删除「无 git」表述（与仓库实际状态对齐），
     期望值随之重算（15,074/C6CDF36C… → 15,064/995DE392…）；_w5freeze.ps1 / _w4freeze.ps1 的
     'l15' 条目已同步为同一取值。 */
  /* UI-P0/P1/P2 修正波（2026-10-19）：按实测重锚（15,064/995DE392… → 15,868/A47A9678…）。 */
  ['verify.js',        path.join(STEP9, 'scripts', 'verify.js'),                                  23566, '1B117CA074C2920342A434FD3571BB888199E398B8692A8DA03827789B888DE0', 'LF'],
  /* --- 测试 spec --- */
  ['l8-spec',          path.join(STEP9, 'tests', 't8-persist-patch.spec.ts'),                     62890, '337E45616F526C6F817FA5745EB45BA6C3FDA639FDF9B7CE6A24C0EDC106BA3E', 'LF'],
  /* L22-R5 收尾（2026-10-18）：L22-Rename 后支柱目录 `l9/` → `t9/`，本 spec 的 L9_DIR
     基址漏改导致启动期 ENOENT；修正后期望重算（19,846/0CECC43D… → 20,030/C409E738…）。 */
  ['l9-spec',          path.join(STEP9, 'tests', 't9-persist-layer.spec.ts'),                     19639, 'B08B37291B091C4C828942308205D0DF8E2F3E0B7B10FFC6EC916A70B629FBD7', 'LF'],
  /* L22-Rename（2026-10-17）：登记器更名后 T-99 执行路径同步（l9/t9-hash-check.mjs → verify-hash-registry.mjs），本 spec 字节锚随之重算。 */
  ['l10-spec',         path.join(STEP9, 'tests', 't10-idb-persist.spec.ts'),   31491, 'FF386B0C150F708BE62897221FA233A839F215D6A7145FE283E3A8C3F0153C42', 'LF'],
  /* --- L9 支柱（运行态模块；不含 .test.mjs） --- */
  ['attach-shadow.mjs',   path.join(STEP9, 't9', 'attach-shadow.mjs'),     8884, '0C481F221355B5035991566A63F7C6622460866BC49BE8DE86BB1AC12EDA1541', 'LF'],
  ['persist-store.mjs',   path.join(STEP9, 't9', 'persist-store.mjs'),    12269, 'C0116287967D0985E2EE73B0BA2130D9A58C03F4E9D5785471BBCED943537D07', 'LF'],
  ['worker-protocol.mjs', path.join(STEP9, 't9', 'worker-protocol.mjs'),   2876, '854CE388BD4D09F721C5A43DA174BBA03FC4900E1432727C1FCE66FA2F0EE18D', 'LF'],
  ['persist-worker.mjs',  path.join(STEP9, 't9', 'persist-worker.mjs'),   14836, '0CB3426A30C537697193D1BEE6BB827955EF1F58D446150426F7EC6A73CB7F23', 'LF'],
  ['backend-adapters.mjs', path.join(STEP9, 't9', 'backend-adapters.mjs'),  7475, 'CE92234691275DFA4CF4765D46CEE10F4A1C151ABFBAB6E4B9F9F63AE576EB0F', 'LF'],
  ['crypto-store.mjs',    path.join(STEP9, 't9', 'crypto-store.mjs'),      5526, 'EDE80C42AD71A2638161E320B105B666DDCE3AC424051534C7C3BCA6068015BB', 'LF'],
  ['index-layer.mjs',     path.join(STEP9, 't9', 'index-layer.mjs'),       5546, '1EF02A3C9EE5899AFCCB6E22BE18EF42DB8911655B61D70EFB4C0651A6FA6832', 'LF'],
  /* --- L10 D-1 新物（W4 纳编 · LO-8=B） --- */
  ['t10-idb-persist.mjs', path.join(STEP9, 't9', 't10-idb-persist.mjs'),   4135, '297AFD57D36A0A2C0BD13C4DEBC3F15B47192C1428C5874391CCF3824634645E', 'LF'],
  ['t10-idb-persist.test.mjs', path.join(STEP9, 't9', 't10-idb-persist.test.mjs'), 6938, '79F42541BEE3A8BF0B2849F649A4872C0C8A64B78E12BB2B9F40439E2FEE026E', 'LF'],
  ['t10-w4-consistency.test.mjs', path.join(STEP9, 't9', 't10-w4-consistency.test.mjs'), 12161, '4D285E201148823A1412A6C106EF77DC34054D29200D67E87D07357AB6005131', 'LF'],
  /* --- L11-W3 铁律 6 后清理 · 期望值同步（清理后目标值；承接 W2 纳编与顺序纪律） --- */
  /* L22-R5 收尾（2026-10-18）：Chromium 路径解析改为环境变量 + 跨平台候选后期望重算
     （1,854/E54EEFED… → 2,072/D2F296A9…）；同步安装 @types/node 消解 node:* / process 类型报错。 */
  /* UI-P0/P1/P2 修正波（2026-10-19）：按实测重锚（2,072/D2F296A9… → 2,541/FB5A3DFF…）。 */
  ['playwright.config.ts',           path.join(STEP9, 'playwright.config.ts'),                        2541, 'FB5A3DFF79009BC4FAF85B688E36B5A8FDC49BC72EC4BCEA79B0CE1517E0EE66', 'LF'],
  ['t7-index-worker.spec.ts',        path.join(STEP9, 'tests', 't7-index-worker.spec.ts'),            78996, 'A2C819D3F58B19BCF72232CE972D91E2788E78F9661E99FB98E1C47788BB3DE3', 'LF'],
  ['t3-invariants.spec.ts',          path.join(STEP9, 'tests', 't3-invariants.spec.ts'),             17957, '5D094B83F6A103FB6B95A157F0E6FCFE95A5889723E88CFB7A16F4958303899B', 'LF'],
  ['t3-commit-callbacks.spec.ts',    path.join(STEP9, 'tests', 't3-commit-callbacks.spec.ts'),        21366, 'E45445944DD0DB469C447E89BA55DDB437133787AAF92A766FBF3D9F904DF1C4', 'LF'],
  /* UI-P0/P1/P2 修正波（2026-10-19）：按实测重锚（26,143/AD993FF3… → 27,497/DE5C2181…）。 */
  ['t3-reference-semantics.spec.ts', path.join(STEP9, 'tests', 't3-reference-semantics.spec.ts'),     27497, 'DE5C218161946A422233737667FA1F8202AF697C9F383309D0F862498C4E71EC', 'LF'],
  ['t3-light-pollution.spec.ts',     path.join(STEP9, 'tests', 't3-light-pollution.spec.ts'),         11103, 'D3C707DE8363555F55647262662E13E995A207688F72A55801D54901B65CC80E', 'LF'],
  ['compare-bench.js',               path.join(STEP9, 'scripts', 'compare-bench.js'),                 6681, '60F9AB83F6FC17E05403805850C623058CDC67861E9077AD112CF911AFCA21B5', 'LF'],
  /* L22-R5 收尾（2026-10-18）：废弃守卫 + 未知 mode 非零退出后期望重算
     （3,752/C418D29F… → 5,149/092DB56C…）。 */
  ['tools-verify.js',                path.join(STEP9, 'tools', 'verify.js'),                          5149, '092DB56C6C390E09AF0D56950A9E14A5776BAE40728F2D52EBD09869F18896EC', 'LF'],
  /* --- L11-W4 纳编（LO-8=B 续扩 · 28 → 30 方） --- */
  ['t11-w4-consistency.test.mjs',    path.join(STEP9, 't9', 't11-w4-consistency.test.mjs'),           16032, 'AFEA4866D2B083DC372A70CB3838B88FCC6D7F6307C870CF32A8100437867628', 'LF'],
  /* L22-Rename（2026-10-17）：T-102 执行路径同步（verify-hash-registry.mjs），本 spec 字节锚随之重算。 */
  ['t11-anchor-governance.spec.ts',  path.join(STEP9, 'tests', 't11-anchor-governance.spec.ts'),      8959, '16861D630B15CADC0646DBB658C6B619BF2088D2158585CC317CBAEAC3E59EE1', 'LF'],
  /* --- L12-W5 纳编（LO-8=B 续扩 · 32 → 36 方） --- */
  ['t12-virtual-scroll.test.mjs',    path.join(STEP9, 't9', 't12-virtual-scroll.test.mjs'),           6828, '5F2D75DB3AE5FCFF5A2DDCC1086E7935E0D348DA3E86DD32A1D147BFF12BC031', 'LF'],
  ['t12-w4-consistency.test.mjs',    path.join(STEP9, 't9', 't12-w4-consistency.test.mjs'),          12975, '3717B7B7057BA8E94904F701497C9CFE35F5AACF0DDF18DAF0F9DCAF14716CAC', 'LF'],
  ['t12-virtual-scroll.spec.ts',     path.join(STEP9, 'tests', 't12-virtual-scroll.spec.ts'),        11020, '29E8C50B607D5313830660BCFBC532849574DBAD347E068F8324907C146A6400', 'LF'],
  /* --- L13-W5 纳编（L0-8=B 修订 · 38 方）：P 层 L13 spec --- */
  ['t13-mb-workset.spec.ts',         path.join(STEP9, 'tests', 't13-mb-workset.spec.ts'),             15097, 'B90CB8026D0A2F3FA0C26F8A0D8A194ACFFA4C697C4B77887D76588E35EDA18E', 'LF'],
  /* --- L13-W6 纳编（OP-19 补全 · 39 方）：N 层 T-116(N) 等价哨兵载体 --- */
  ['t13-mb-workset.test.mjs',        path.join(STEP9, 't9', 't13-mb-workset.test.mjs'),               16685, '656F74E3612E809D01965ED6B8DCD2329757465514D6E808C56D68B2D34DFD81', 'LF'],
  /* --- L14-W5 纳编（L0-8=B 续扩 · 39 → 43 方）：L14 N 层等价哨兵载体 ×2 + P 层 L14 spec --- */
  ['t14-vs-hardening.test.mjs',           path.join(STEP9, 't9', 't14-vs-hardening.test.mjs'),             14247, '9E9A0555F8DA1FE123E2D9421DA4AF5085071103949EE080F7F69E9DD74F859A', 'LF'],
  ['t14-w4-consistency.test.mjs',         path.join(STEP9, 't9', 't14-w4-consistency.test.mjs'),           11192, 'A46E2EF5031035F7F9B45F1FB9821EF9B3A84FB71DF7FD3F3B319AF240DA8A56', 'LF'],
  ['t14-virtual-scroll-hardening.spec.ts', path.join(STEP9, 'tests', 't14-virtual-scroll-hardening.spec.ts'), 15043, '7D7BB9D570B1AAB33F688BAFF774AA41D3CD76E8CCC5AFA770A5AC4952ADF835', 'LF'],
  /* --- L17-QA 纳编（L0-8=B 续扩 · 43 → 45 方）：L17 N 层用例（frozen-l17 见上方冻结件段） --- */
  ['t17-w4-batch-fixes.test.mjs',         path.join(STEP9, 't9', 't17-w4-batch-fixes.test.mjs'),           13524, '2AAAE1CCB2A54E75A441EDEFF118C0F4601A9AF676A789B3D8A12DD0A92C6092', 'LF'],
  /* R32 纳编（2026-10-21 · 64 → 65 方）：L17-W1 Defect-P0-1 N 层回归用例。R31 已把 renderSubTags 的
     dot.style.background 改为 dot.style.setProperty('--tag-color', …)，本用例的 DOM 装配随之补齐
     _vars / setProperty / getPropertyValue，并新增「renderSubTags 仍写内联 background」的反向断言 ⇒
     文件字节 14,180 / 72933C27…F491（CRLF · CR=291 · LF=291）。该文件此前不在登记面内（原注释口径为
     「不纳入 t9-hash-check 43 方登记」），本波按不变量 #87 的可审计要求纳入。 */
  ['t17-w1-rendersubtags-rows.test.mjs',  path.join(STEP9, 't9', 't17-w1-rendersubtags-rows.test.mjs'),  13908, 'E4B8BC48E72E0E8FB0C71C7BAA15A79E194086C93AE26AF3E2C5B4BEFE4D41BB', 'LF'],
  /* --- L19-QA 纳编（L0-8=B 续扩 · 45 → 47 方）：L19 N 层代表用例（frozen-l19 见上方冻结件段） --- */
  ['t19-patch3.test.mjs',                  path.join(STEP9, 't9', 't19-patch3.test.mjs'),                 10555, '97854DA7768BF3404F8C5DEDCAF74E624238EFCAFE1AA942BE5F0F08A66F2E9C', 'LF'],
  /* --- L22-R5 收尾纳编（2026-10-18 · 47 → 49 方）：重复冻结件说明与 r4 发布清单纳入防篡改面 --- */
  /* 批次 3 缺陷修复（2026-10-18 · ISSUE-020）：ALIAS.md 追加「取件指引」段（检索仅用 canonical/r4 与
     frozen-l13/l14 之后代次），期望值随之重算（2,949/53F72206… → 3,691/B2B233A8…）；方数保持 49。 */
  /* ISSUE-018 (2026-10-18): ALIAS.md section 6 added (duplicate groups G4-G8); expectation re-anchored 3691/B2B233A8 -> 6222/241C2D6C; party count unchanged (49). */
  /* r22（2026-10-20 · 富文本模式下线）：ALIAS.md 追加 §七（G9 = canonical ↔ frozen-l22-final-r5 别名 + 取件口径更新），
     期望重算（6,222/241C2D6C… → 7,144/34B15BE2…）；方数保持 63。 */
  /* ALIAS.md retired（02112 归档重组：原 1.历史归档/1.1冻结版本/ALIAS.md 已并入 canonical 取件口径，物理件不存在，退役该登记方） */
  /* 批次 1 缺陷修复（2026-10-18 · ISSUE-003）：r4 release-manifest.json 由 80 B 空壳补全为完整清单
     （产物字节 / SHA-256 / 门禁计数），期望值随之重算（80/1ED2A22C… → 7,106/AD813263…）。
     方数保持 49（仅更新既有登记方的期望值，不新增纳编物）。
     R6 缺陷修复（2026-10-18 · R6-ISSUE-002 / R6-ISSUE-003）：manifest 内 packageFiles 的
     RELEASE-NOTES.md 与 checksums.sha256 期望按落盘实测重算（含 RELEASE-NOTES 校验脚本首列空字段修正后
     的二次重算），且 status 由 current 改为 INVALID，期望值随之重算
     （7,106/AD813263… → 8,465/2667A8AC…）；方数保持 49。 */
  ['release-manifest.json',                path.join(ROOT, '0.stage', '_quarantine', '8.rel-archive-20261112', 'legacy', 'v2.0-t22-r4-2026-10-18', 'release-manifest.json'), 8465, '2667A8ACF07115F80B896141B00A52AC50183C2CFD938B9AC7294AEE0A3C06D2', 'CRLF'],
  /* 批次 3（2026-10-20 · 不变量清单文书面纳编）：L941 遗留旧色值硬编码清理
     （#DFECD5 / #CAD3C3 / #1772B4 / #3170A7  →  #DFECD5 / #CAD3C3 / #0A1929 / #152A4A / #1D355E）
     + 文件末尾物理追加 §二十三「2026-10-20 代码-清单对拍修复登记」（修复登记 68–74 / 51 行，
     无三反引号代码块）。产品 v2.0-t3.html 本批零改动（size=1,218,384 保持不变）。
     期望值按落盘实测锚定：100,490 B / A56677A8…D36 / MIXED（历史遗留 103 行 CRLF + 主体 LF）。
     本批新增 1 方，PARTY_COUNT 随实测输出。 */
 /* 批次 4（2026-10-20 · 不变量清单 §二十四 追加）：文件末尾物理追加 §二十四「内容区宽度自适应
    （2026-10-20 新增）」+ 不变量 #75「主内容区宽度自适应与两边空白收敛」（13 行正文，含断言 / 关联实现 /
    验证方式 / 冲突调整记录；无三反引号代码块），口径为 --content-max=min(1600px,100%)、
    --content-max-doc=min(1200px,100%)、日历页 min(1800px,100%)、主内容区左右 padding 20px。
    产品 v2.0-t3.html 本批零改动（size=1,218,384 保持不变）。
    期望值按落盘实测重算：102,256 B / 2C48BE5B…E46 / MIXED（CRLF 117 行 = 历史 103 + 本批 14；主体 LF）。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* 批次 5（2026-10-20 · 不变量清单 §二十五 追加）：文件末尾物理追加 §二十五「极宽屏幕自适应（2026-10-20 新增）」
    + 不变量 #76「极宽屏幕自适应（带鱼屏/4K+ 屏适配）」+ 冲突调整记录（#75 的固定像素上限文字口径由本条取代）；
    追加段 8 行正文（含定义 / 断言 / 关联实现 / 验证方式 / 冲突调整记录；无三反引号代码块），
    追加段为纯 LF（无 CR），既有 117 行 CRLF 与主体 LF 不变。
    期望值按落盘实测重算：104,114 B / ACECFC77…E69B / MIXED（CR=117 · LF=1,553）。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* 批次 7（2026-10-20 · 不变量清单 #77 补充 · r24 幻灯片视图微调）：原地补充 #77 的「定义 / 断言」并追加
    「补充口径（r24 幻灯片视图微调）」——页码栏末尾严禁包含冗余说明字符；主演示区必须与左侧缩略图保持
    严格的顶部水平对齐；主演示区与左侧缩略图之间的最小间距为 8px（.ju-sl-wrap gap:8px）；.ju-sl-rail 与
    .ju-sl-main 的 padding-top 同为 0。
    期望值按落盘实测重算：106,570 B / 45CD0285…411 / LF（本波文本编辑将历史 MIXED 行尾统一为 LF，
    CR=0；字符内容见 #77 条目）。方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* 批次 6（2026-10-20 · 不变量清单 §二十六 追加 · 幻灯片视图自适应布局 #77）：文件末尾物理追加
    §二十六「幻灯片视图自适应布局（2026-10-20 新增）」+ 不变量 #77「幻灯片视图自适应布局与信息归位」
    + 补充口径（.ju-sl-stage 的 16:9 宽度上限改用容器查询单位 width:min(100%,calc(100cqh * 16 / 9))）；
    追加段 7 行正文（定义 / 断言 / 关联实现 / 验证方式 / 补充口径；无三反引号代码块），纯 LF（无 CR），
    既有 117 行 CRLF 与主体 LF 不变。
    期望值按落盘实测重算：105,304 B / 7342ED50…FD7C / MIXED（CR=117 · LF=1,560）。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* R27（2026-10-21 · 不变量清单 §二十八 追加）：文件末尾物理追加 §二十八「导入弹窗 UI 与图片导入（2026-10-21 新增）」
    + 不变量 #82「导入弹窗支持格式声明与标题栏图标」+ #83「图片导入（内联 data URL）」，并在 #83 补充口径中记录
    对 #78 图片扩展名拒绝口径的取代关系（IMPORT_BINARY_EXTS 47 项集合本体不变，其余 40 项维持原拒绝）。
    追加段 27 行（含首行标记 <!-- JU-R27-2026-10-21 -->；定义 / 断言 / 关联实现 / 验证方式 / 补充口径 / 类型状态标注，
    无三反引号代码块），纯 LF（CR=0）。期望值按落盘实测重算：115,969 B / BF7CF225…CD2F9 / LF（CR=0 · LF=1,638 · 条目 1–83 连续）。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
 /* R28（2026-10-21 · 不变量清单 #84 追加）：文件末尾物理追加不变量 #84「左侧边栏折叠与节点行对齐」
    （22 行：定义 5 条子口径 / 断言 6 段 / 关联实现 / 验证方式 / 补充口径 / 冲突调整记录（#39 #63 #65 #75 #76 #51）
    / 类型状态标注；无三反引号代码块），纯 LF（CR=0），追加段 8,063 B。
    追加方式为字节级拼接：前 115,969 B 的 SHA-256 与追加前完全一致（BF7CF225…CD2F9 ⇒ #1–#83 逐字节零变更），
    追加段 SHA-256 与临时源文件逐字节相同（2CBF99A5…067F）。
    期望值按落盘实测重算：124,032 B / 8B401CD92DB1A11D5FE664DE59049B0415CFD14E962C5945EEB0AF30747E4FED / LF（CR=0 · LF=1,659 · 条目 1–84 连续）。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
/* R32（2026-10-21 · 不变量清单 #87 追加 + t17-w1 N 层用例纳编）：文件末尾物理追加
   「## 三十一 · 勾选与标签圆点浅色同源（2026-10-21 新增）」+ 不变量 #87
   「勾选与标签圆点浅色同源规范」（定义 / 断言（伪代码） / 关联实现 / 验证方式 / 补充口径 / 冲突调整记录
   / 类型状态标注，七段；无三反引号代码块），纯 LF（CR=0）。追加段 2,413 B（126,243 → 128,656），
   LF 行数 1,684 → 1,704（+20 行），条目 1–87 连续，文件以状态标注行 + 末尾换行收尾。
   期望值按落盘实测重算：128,656 B / 81EA3A18…673A / LF（CR=0 · LF=1,704）。
   本波同时新增纳编 1 方（决策：t17 用例必须进登记面）：t9/t17-w1-rendersubtags-rows.test.mjs
   （R31 语义同步后的改后形态 · 14,180 B / 72933C27…F491 / CRLF · 291 行），
   该文件承载不变量 #87 第 4 条「DOM 侧 .sb-tag-dot 不得直接赋值 background，须以
   style.setProperty('--tag-color', …) 走 CSS 变量」的 N 层断言（FN_CODE 正则断言
   /dot\.style\.background\s*=/ === false），故纳入期望值列表以钉住其字节。
   产品 v2.0-t3.html 本波零改动（canonical / step9-mirror 仍为 1,235,901 / 76276292…，实测 PASS）；
   方数 64 → 65（新增 1 方 · 仅本波新增纳编物）。 */
 /* R30（2026-10-21 · 不变量清单 §三十 追加 · #86 日历待办勾选框与标签色统一）：文件末尾物理追加
    §三十「日历待办勾选框与标签色统一（2026-10-21 新增）」+ 不变量 #86（定义 / 断言 / 关联实现 / 验证方式 /
    补充口径 五段，内嵌空行分隔；无三反引号代码块），纯 LF（CR=0），追加段 2,211 B（124,032 → 126,243）。
    条目 1–86 连续，文件末尾为 #86 补充口径行 + 末尾换行（endsWithNewline=true · split 后 1,685 段）。
    期望值按落盘实测重算：126,243 B / 59A733C738834E75AB08C824B43429FF976A500D57EDA7094EA02DDD12279406 / LF（CR=0 · LF=1,684）。
    方数保持 64（仅更新既有登记方的期望值，不新增纳编物）。 */
     /* R39（2026-10-21 · 不变量清单 §三十四追加 · #90 日历底部五模块位置稳定性与尺寸落盘口径）：
        文件末尾物理追加「## 三十四、日历底部模块位置稳定性（2026-10-21 新增）」+ 不变量 #90
        （定义 5 条子口径 / 断言（伪码）7 段 / 关联实现 / 验证方式 / 补充口径 8 条 / 冲突调整记录
        / 类型状态标注，七段；无三反引号代码块）。追加源为 4.回归与验收/tmp_inv82_draft.md 第 85–206 行，
        且仅取该草稿的「草稿正文」段（草稿首部 84 行审计元数据与尾部「阶段 2 冲突核对」段含 3 个 `## 阶段 N`
        非章节级标题及 2 处 `### 89.` 引用文本，整篇追加会破坏「## 一…三十四」章节序列与条目唯一性，故剔除）。
        追加前原文为纯 LF（CR=0 · LF=1,750 · 末字节 0x0A · 无 BOM），追加段由草稿 CRLF 归一为 LF，
        追加方式为字节级拼接：原文末尾补 1 个空行（章节间隔，与「三十二→三十三」体例一致）+ 追加段 12,325 B，
        合计 +12,326 B（135,870 → 148,196），LF 行数 1,750 → 1,873（+123 行），末字节仍为单个 0x0A。
        前 135,870 B 的 SHA-256 与追加前完全一致（B99487FD…B78098C ⇒ #1–#89 逐字节零变更），
        头 200 行 SHA-256 亦一致（6ACC810E…953923）；全文 "### 90." = 1、"## 三十四" = 1、"### 89." = 1。
        期望值按落盘实测重算：148,196 B / 6783CB682084C92266AFECEB553EA51888D51E742001053DC3C937761A152EFA / LF（CR=0 · LF=1,873）。
        方数保持 65（仅更新既有登记方的期望值，不新增纳编物）。 */
     /* R42（2026-10-21 · 不变量清单 §三十六追加 · #93 标签弹层勾选与反选）：
        文件末尾物理追加「## 三十六、日历待办标签弹层勾选与反选（2026-10-21 新增）」+ 不变量 #93
        （定义 / 断言 6 条 / 关联实现 / 验证方式 / 补充口径 4 条 / 冲突调整记录 / 类型状态标注，七段；无三反引号代码块）。
        追加前实测 151,143 B（登记期望 148,196 B —— 属 §三十五 / #91–#92 追加后未重锚的既有漂移，本波一并归零），
        追加后实测 154,699 B（+3,556 B），LF 行数 1,893 → 1,908（+15 行），CR=0，末字节 0x0A。
        期望值按落盘实测重锚：154,699 B / 84C6BB6E8D39F3F53159D95381D1AB9D01D3356EE15099DF2274EE29B73970B2 / LF（CR=0 · LF=1,908）。
        方数保持 65（仅更新既有登记方的期望值，不新增纳编物）。 */
     /* L22-final-r4（2026-10-21 · #77 补充口径追加）：在 #77 既有两条补充口径后物理追加 1 行
        「补充口径（2026-10-21 · L22-final-r4 横向贴合居中）」，记录 Flex 居中 / gap:8px /
        main 的 aspect-ratio:16/9 换算 / stage 宽度去 min() 的口径，既有条目与章节序列零改动。
        期望值按落盘实测重锚：154,699 → 155,701 B（+1,002），LF 1,908 → 1,909（+1），CR=0，末字节 0x0A。
        方数保持 65（仅更新既有登记方的期望值，不新增纳编物）。 */
     /* R44（2026-10-21 · 不变量清单 v2.5 全量替换）：以「v2.5 现行对拍基线」整篇物理覆盖，
        非追加。结构变动：头部改记为 65 方 / 现行 84 条（#1–#93）；#30 / #31 / #32 / #33 / #35
        的历史门禁值统一加 [历史快照] 前缀并补注「现行门禁以 #90 为准」；#75 / #76 归一为 100%
        宽度口径并补「口径废弃提示（2026-10-21）」；#77 的 r24 Grid 口径标注「已被 #93 取代」；
        #78 / #83 / #84 补补充口径与废弃提示；末尾新增 #91 / #92 / #93 与「核对说明」「关联文件」。
        期望值按落盘实测重锚：155,701 → 137,321 B，LF 1,909 → 2,045，CR=0，末字节 0x0A，
        首行「# JU 不变量清单（v2.5 现行对拍基线）」；### 编号条目实测 93 条。
        方数保持 65（仅更新既有登记方的期望值，不新增纳编物）。 */
     /* R45（2026-10-21 · 不变量清单 #94 追加 · 标签选择器反选与视觉反馈）：
        在「## 核对说明」之前物理插入「## 标签选择器反选与视觉反馈（2026-10-21 新增）{#tag-picker-toggle}」
        + 不变量 #94（定义 / 断言 / 关联实现 / 验证方式 / 补充口径 / 冲突调整记录 / 类型状态标注）。
        同批文本改动三处：头部「现行 84 条（#1–#93）」→「现行 85 条（#1–#94）」；「核对说明」计数行
        84 条（#1–#93）→ 85 条（#1–#94）；修复登记章引言「现行 84 条已排除」→「现行 85 条已排除」。
        期望值按落盘实测重锚：137,321 → 140,494 B（+3,173），LF 2,045 → 2,072（+27），CR=0，末字节 0x0A；
        ### 编号条目实测 94 条。方数保持 65（仅更新既有登记方的期望值，不新增纳编物）。 */
     /* R56（2026-10-22 · 不变量清单 #95–#100 物理追加）：
        文件末尾物理追加「主题图标、右键菜单折叠与多选格式化（2026-10-22 新增）{#ui-enhancements}」
        + 不变量 #95 主题按钮图标更替与样式统一 / #96 当日待办右键菜单折叠化与统一视觉 /
        #97 多选节点批量格式化与格式刷兼容 / #98 颜色·字号选择器即点即用与布局矩阵 /
        #99 日历字数统计模块与底层增量聚合 / #100 日历模块标题统一与柱状图补全
        （每条含 定义 / 断言（\x60\x60\x60js 围栏代码块，共 6 段）/ 关联实现；编号行按任务给定脚本形态为
        plain "NN. " 行、不加 ### 前缀，故 ### 编号条目仍为 94，plain 新增条目 6 行）。
        追加段 5,500 B / 99 行 / LF（CR=0），追加段 SHA-256 = 746E9182…66E780，落盘尾段与源段逐字节一致。
        同批文本改动 3 处（L8 / L1476 / L2062）：计数口径「现行 85 条（#1–#94）」→「现行 91 条（#1–#100）」，
        基线区逐行 diff 仅此 3 行变动，其余 2,069 行零漂移。
        期望值按落盘实测重锚：140,494 → 145,996 B（+5,502），LF 2,072 → 2,171（+99），CR=0，末字节 0x0A。
        方数保持 65（仅更新既有登记方的期望值，不新增纳编物）。 */
     /* R73（2026-10-23 · 不变量清单 #101–#105 追加段纳编）：
        该文档在 r72 绿证（2026-10-23 12:27:10）之后被外部追加一次 —— 自第 2,172 行起物理追加
        「交互与视觉一致性修复（2026-10-23 新增） {#ui-consistency-r71}」章节 +
        不变量 #101 数据库工具栏标题与按钮组对齐 / #102 日历模块标题行计数内联展示 /
        #103 日历新增待办滚动位置保持与焦点恢复 / #104 日历待办默认字重剥离与富文本净化 /
        #105 全局滚动条极简化与主题自适应（各含 定义 / 实现 / 断言 三栏）。前 2,171 行与
        `.bak-r71-2026-10-23`（145,996 B）逐字节一致，属纯尾部追加，无既有行改写；
        本段 5 条（#101–#105）均以 `### NN.` 标题形式落盘。
        期望值按落盘实测重锚：145,996 → 151,170 B（+5,174），LF 2,171 → 2,245（+74），CR=0，末字节 0x0A。
        /* R76（2026-10-23 · 不变量清单 #106–#112 物理追加段纳编）：
        文件末尾物理追加「## 核心逻辑与渲染性能修复（2026-10-23 新增） {#logic-fix-r76}」章节 +
        不变量 #106 拖拽排序与同父移动索引防偏移 / #107 循环遍历防意外中断与子树漏算 /
        #108 外部时间标准解析与本地化对齐 / #109 异步渲染防竞态与防高亮残留 /
        #110 数据库主列顺延与渲染性能优化 / #111 早退视图派生面板同步与变量作用域防遮蔽 /
        #112 修改门禁与登记核实。#106–#111 各含 定义 / 断言 / 关联实现 / 验证方式 四栏，
        #112 含 定义 / 关联实现 / 验证方式 三栏；断言段为 4 空格缩进代码块（无三反引号围栏），
        7 条均以 "### NN. " 标题落盘。追加方式为字节级拼接：原文末字节已是单个 0x0A，
        补 1 个空行（章节间隔）后接 LF 归一化追加段（源段 5,012 B CRLF → 4,920 B LF，
        sha256=9DC72401D03148E9B13378B901C1B6C0A3F1D035F7509AABA6A41B5B9ABE4B98），
        合计 +4,921 B（151,170 → 156,091）。前 151,170 B 与追加前逐字节一致
        （746C5911…ADB11BE ⇒ #1–#105 零改写），尾段 4,920 B 与追加源段逐字节相同；
        CR=0，LF 2,245 → 2,338（+93），末字节仍为单个 0x0A；`###` 编号条目 99 → 106（+7），
        logic-fix-r76 锚点 1 处。产品 v2.0-t3.html 本波零改动
        （canonical / step9 镜像仍 1,294,047 / CE68352B…EDC208FD，实测 PASS）。
        期望值按落盘实测重锚：151,170 B / 746C5911…ADB11BE → 156,091 B / AA895DBA…4B46C128 / LF。
        方数保持 65（仅更新既有登记方的期望值，不新增纳编物）。 */
        /* R96（2026-10-23 · 不变量清单 v2.5 全量覆盖重锚）：以「# JU 不变量清单（v2.5 现行对拍基线）」
        开场、以「> **不变量总数核对** … 合计 91 + 12 + 3 = **106 条**」收尾的完整 Markdown 整篇物理覆盖
        `4.回归与验收/JU-不变量清单-v2.0-frozen.md`（整文件替换，非追加、非局部修改）。
        结构变动：文件头「不变量总数」改为 现行 106 条（#1–#115）；补齐 #95–#100
        （`## 主题图标、右键菜单折叠与多选格式化（2026-10-22 新增）`）与 #113–#115
        （`## 大纲拖拽方向判定与节点级剪贴板（2026-10-23 新增）`）两节；文末新增
        「### 本批调整汇总（原地修改 + 新增）」表格与「> **不变量总数核对**」段；
        #50 适用范围补 `.text`（contenteditable）内部并在断言补 `outlineDragSelectStart` 首行
        fromText 早退检测；#36 / #37 补「分流说明（2026-10-23）」；#41 / #46 / #53 补
        「与 #113–#115 关系（2026-10-23 核对）」，#45 适用范围引用 #113。
        备份：`4.回归与验收/JU-不变量清单-v2.0-frozen.md.bak.20261023-214459`（= 覆盖前 156,091 B）。
        `###` 编号条目 106 → 115（+9）；独立不变量 106 条（排除 #43 / #44 交叉引用与 #68–#74 修复登记）。
        写入口径：UTF-8 无 BOM、全 LF（CR=0）、末字节单个 0x0A。产品 v2.0-t3.html 本波零改动
        （canonical / step9 镜像仍 1,316,707 / 5FED0215…BFF818，实测 PASS）。
        期望值按落盘实测重锚：156,091 B / AA895DBA…4B46C128 → 168,533 B / 20C34426…E2BDF4 / LF
        （LF 2,338 → 2,494）。方数保持 65（仅更新既有登记方的期望值，不新增纳编物）。 */
    ['JU-不变量清单-v2.0-frozen.md',         path.join(ROOT, '1.docs', 'invariants.md'), 170110, 'E4BD023A9EC241BF01426929ECA315F86E20C8C66EDA07BC1C77333437017147', 'LF'],
];

/* 行尾判定：与 L8 `_w5freeze.ps1` / W5 实测脚本的 Get-Eol 同口径（无 CR=LF；cr==lf=CRLF；否则 MIXED）。 */
function detectEol(buf) {
  let lf = 0; let cr = 0;
  for (const b of buf) { if (b === 10) lf++; else if (b === 13) cr++; }
  if (cr === 0) return 'LF';
  if (cr === lf) return 'CRLF';
  return 'MIXED';
}

let drift = 0;
for (const [name, file, expSize, expHash, expEol] of TARGETS) {
  let size = -1; let hash = 'MISSING'; let eol = 'MISSING';
  try {
    const buf = readFileSync(file);
    size = buf.length;
    hash = createHash('sha256').update(buf).digest('hex').toUpperCase();
    eol = detectEol(buf);
  } catch (e) { hash = 'ERR:' + (e && e.code); }
  const eolOk = expEol === null || eol === expEol;
  const ok = size === expSize && hash === expHash && eolOk;
  if (!ok) drift++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  size=${size} (exp ${expSize})  eol=${eol} (exp ${expEol === null ? 'n/a' : expEol})  sha256=${hash}`);
}
console.log(`\nPARTY_COUNT=${TARGETS.length}`);
console.log(`FIVE_PARTY_DRIFT_COUNT=${drift}`);
console.log(drift === 0 ? 'RESULT=PASS' : 'RESULT=FAIL');
process.exit(drift === 0 ? 0 : 1);
