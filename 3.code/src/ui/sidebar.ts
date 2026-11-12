/**
 * M1-1 · 批次 N · 侧边栏渲染与导航
 *
 * 来源：6.P0-T3基线\v2.0-t3.html「侧栏」区原文逐行对应
 *   - renderSidebar ................... 15840-15891
 *   - renderSubDb ..................... 15892-15901
 *   - renderSubStarred ................ 15902-15915
 *   - renderSubDocs ................... 15916-15928
 *   - promptNewTag .................... 15929-15956
 *   - renderSubTags ................... 15957-16033
 *   - replaceTagInHtmlTag ............. 16034-16050
 *   - renameTag ....................... 16051-16065
 *   - removeTag ....................... 16066-16081
 *   - makeSidebarRow .................. 16082-16181
 *   - navTo ........................... 16247-16300
 *
 * 约束：DOM 查询串、内联样式/HTML 片段、交互顺序、提示文案与 FIX/批次注释逐字保留。
 *   两类纯结构调整：
 *     1) 未拆分业务符号统一走 `deps` 依赖注入容器（原直接调用改为 deps.xxx）：
 *        ui / state / N() / isFolder() / sortDocs() / getCurrentDoc() / actions / commit() /
 *        saveUI() / forceRender() / renderIntro() / updateSidebarActiveState() / openNode() /
 *        safeNavigate() / setActiveKey() / showTreeContext() / getNodeSvg() / getCalendarRootId() /
 *        _sideCountsGet() / __l14On() / __l14SideScan* / _l7TagCountText() / _sidebarFingerprint() /
 *        _tagIndexCache / _l7SkeletonEnsureCss() / l7TagIndexWhenReady() / buildTagIndex() /
 *        getTagColor() / openTagPalette() / openTag() / _nowSeq()。
 *     2) `$()` 结果可空处的非空断言 / 事件目标与 dataset 的显式元素类型（纯类型层）。
 *   注：`_mSel*` 自 ./selection 引入（批次 N 已提取）；`toast` / `appPrompt` / `appConfirm` /
 *       `showContextMenu` 自 ./common 引入；`$` / `stripHtml` / `todayStr` 自 ../core/utils 引入。
 */
import { $, stripHtml, todayStr, compareZh } from '../core/utils';
/* 【P0 · 新建标签不实时显示】标签写操作必须推进侧栏结构版本（FIX-M-12 指纹 memo 的失效源），
   否则 renderSidebar 会跳过四棵子树重建，标签徽标 / 标签行保持旧状。 */
import { bumpStructRev } from '../core/actions';
/* 【D-09】bindDelegatedContextMenu：右键菜单绑在侧栏容器上做事件委托（行重建后依然生效） */
import { toast, appPrompt, appConfirm, showContextMenu, bindClick, bindDelegatedContextMenu } from './common';
import { _mSel, _mSelSetOrder, _mSelHas, _mSelClick, _mSelPaint, _sbVisibleIds } from './selection';

/* HTML:1377 原文 const _win = (window) —— 同语义别名 */
const _win: any = window;

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export const deps: {
  /** 全局 UI 状态对象（对应产品的 `ui`） */
  ui: any;
  /** 全局数据状态（对应产品的 `state`） */
  state: any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  isFolder: (id: any) => boolean;
  sortDocs: (ids: any[], sorter: any) => any[];
  sideCountsGet: (s: any) => any;
  l14On: () => boolean;
  l14SideScanEnsure: () => void;
  l14SideScan: any;
  l7TagCountText: () => any;
  sidebarFingerprint: () => string;
  /** 标签索引缓存（对应模块级 `_tagIndexCache`，可写） */
  tagIndexCache: any;
  /**
   * 标签索引失效（对应产品件 `_tagIndexCache=null` 的**真实**实现）。
   * 可选项：未注入时 invalidateTagIndex() 回退为只清本模块副本（与原行为一致，不降级为崩溃）。
   * 装配层注入 `app/session.invalidateTagIndex`（同时清真实缓存与侧栏副本）。
   */
  invalidateTagIndex?: () => void;
  renderIntro: () => void;
  updateSidebarActiveState: () => void;
  saveUI: () => void;
  forceRender: () => void;
  commit: (fn: (s: any) => void, opts?: any) => any;
  nowSeq: () => any;
  getCurrentDoc: () => any;
  openNode: (id: any) => void;
  safeNavigate: (fn: () => void) => void;
  setActiveKey: (k: any) => void;
  showTreeContext: (e: MouseEvent, id: any) => void;
  getNodeSvg: (id: any) => string;
  getCalendarRootId: () => any;
  actions: any;
  l7SkeletonEnsureCss: () => void;
  l7TagIndexWhenReady: (cb: () => void) => void;
  buildTagIndex: () => any;
  getTagColor: (t: any) => any;
  openTagPalette: (anchor: any, t: any) => void;
  openTag: (t: any) => void;
} = {
  ui: {},
  state: {},
  N: () => null,
  isFolder: () => false,
  sortDocs: () => [],
  sideCountsGet: () => undefined,
  l14On: () => false,
  l14SideScanEnsure: () => {},
  l14SideScan: {},
  l7TagCountText: () => '',
  sidebarFingerprint: () => '',
  tagIndexCache: null,
  renderIntro: () => {},
  updateSidebarActiveState: () => {},
  saveUI: () => {},
  forceRender: () => {},
  commit: () => null,
  nowSeq: () => 0,
  getCurrentDoc: () => null,
  openNode: () => {},
  safeNavigate: () => {},
  setActiveKey: () => {},
  showTreeContext: () => {},
  getNodeSvg: () => '',
  getCalendarRootId: () => null,
  actions: {},
  l7SkeletonEnsureCss: () => {},
  l7TagIndexWhenReady: () => {},
  buildTagIndex: () => null,
  getTagColor: () => '',
  openTagPalette: () => {},
  openTag: () => {},
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function bindSidebarDeps(next: Partial<typeof deps>): void {
  Object.assign(deps, next);
}

/* 来源：v2.0-t3.html:15831 `let _sidebarFp=null;`（renderSidebar 的指纹 memo，模块内私有） */
let _sidebarFp: string|null=null;

/**
 * 标签索引失效（统一入口）。
 *
 * 侧栏读的是 `deps.tagIndexCache`（bindSidebarDeps 的值拷贝），真实缓存实体在 app/session 的
 * `tagIndexCache.value`。原实现只写副本 `deps.tagIndexCache=null`：
 *   · 真实缓存仍为旧 Map ⇒ `buildTagIndex()` 直接命中旧索引，新标签不在其中；
 *   · `#cntTags` 计数取自真实缓存 ⇒ 计数不变；
 *   ⇒ 「新建标签后侧栏毫无变化」。
 * 现改为经端口清真实缓存（session.setTagIndexCache(null) → 同步副本），副本再兜底置空。
 */
function invalidateTagIndex(): void {
  try {
    if(typeof deps.invalidateTagIndex==='function')deps.invalidateTagIndex();
  }catch(e){console.warn('[JU] invalidateTagIndex failed',e);}
  deps.tagIndexCache=null;
}

/* ============================================================
   【D-09 · 右键菜单容器委托】
   ------------------------------------------------------------
   缺陷现象：`btnTrash` / `btnBell` / `sortBtn` 点击后「可见 DOM 签名无变化」被判待复核；
   用户侧则是「右键某些行没反应」。根因之一是菜单能力**逐行绑定**（`row.oncontextmenu = fn`）：
   行由 renderSidebar 反复重建，重建窗口内 / 属性被后续赋值覆盖时监听即丢失。
   处理：监听统一挂在侧栏容器 `#sidebarLeft` 上（事件委托，幂等安装），并对目标加「文档节点才弹」判断：
     · 没有 data-id / 节点不存在 / 已删除 / 根节点 ⇒ 不弹菜单（不是「失效」，而是设计预期）。
   ============================================================ */
function _sbEnsureContextMenuDelegation(): void {
  const host = document.getElementById('sidebarLeft');
  bindDelegatedContextMenu(host, '.sb-row[data-id]', (hit, e) => {
    const id = hit.dataset.id;
    if (!id) return;
    const n = deps.N(id);
    /* 「文档节点才弹」：无节点 / 已删除 / 根节点一律不弹，避免无节点时被误判为菜单失效 */
    if (!n || n._deleted || id === deps.state.rootId) return;
    deps.showTreeContext(e, id);
  });
}

/**
 * 【fix26-p4 · 重命名后行文字不更新】把已渲染行的 `.sb-label` 与节点当前 `text` 对齐。
 *
 * 缺陷根因：重命名只改 `n.text`（showTreeContext / 数据库行 / 各视图标题），既不新建也不删除
 * 节点 ⇒ `_structRev` 不变，`sidebarFingerprint()` 的五个分量（_structRev / navExpanded /
 * filesSort / tagColors / collapsedDocs）全部不变 ⇒ FIX-M-12 的 memo 跳过四棵子树重建，
 * 行文字停留在旧值，直到刷新后整树重建才生效。
 * 处理：指纹未变时不做整树重建（保持 memo 的收益），只对已存在的行做 O(行数) 的标题比对，
 * 仅在文本确有差异时写回 textContent（零 DOM 重建、零滚动位置扰动）。
 */
function _sbSyncRowLabels(box: HTMLElement|null): void {
  if(!box)return;
  const rows=box.querySelectorAll('.sb-row[data-id]');
  for(let i=0;i<rows.length;i++){
    const row=rows[i] as HTMLElement;
    const id=row.dataset.id;
    if(!id)continue;
    const n=deps.N(id);
    if(!n||n._deleted)continue;
    const lab=row.querySelector('.sb-label');
    if(!lab)continue;
    const next=stripHtml(n.text)||'未命名';
    if(lab.textContent!==next)lab.textContent=next;
  }
}

export function renderSidebar(): void {
  const box=$('#sidebarLeft');
  const scrollTop=box?box.scrollTop:0;
  /* 【D-09】委托安装（幂等）：每次渲染前确保容器级右键监听在位 */
  try { _sbEnsureContextMenuDelegation(); } catch (e) { console.warn('[JU] caught error', e); }
  /* 【侧栏整理】主导航项展开状态同步：open class 控制 chev 旋转（▶→▼） */
  ['database','starred','files','tags'].forEach(k=>{
    const btn=document.querySelector('.sb-nav-item[data-nav="'+k+'"]');
    if(btn)btn.classList.toggle('open',!!(deps.ui.navExpanded&&deps.ui.navExpanded[k]));
  });
  const root=deps.N(deps.state.rootId);
  let starred=0,docCount=0,dbRoot: any=null;
  const _sc=deps.sideCountsGet(deps.state); /* L16-W3 · 指令 3：增量计数（Symbol 键挂载，序列化不可见）→ O(1) 读取，与节点数解耦 */
  if(_sc){
    starred=_sc.starred;docCount=_sc.docCount;dbRoot=_sc.dbRootId?deps.N(_sc.dbRootId):null;
  }else if(deps.l14On()){ /* 降级：计数缺失 → __l14SideScanEnsure 分片协同扫描（缺省路径语义不变） */
    deps.l14SideScanEnsure();
    starred=deps.l14SideScan.starred;docCount=deps.l14SideScan.docCount;dbRoot=deps.l14SideScan.dbRoot;
  }else{
    const rootChildSet=new Set(root?root.children:[]);
    for(const id in deps.state.nodes){
      const n=deps.state.nodes[id];
      if(!n||n._deleted||n.id===deps.state.rootId)continue;
      if(n.starred>0&&!n._isFolder&&!n._isDbRoot&&!n._isCalRoot)starred++;
      if(rootChildSet.has(id)){
        if(n._isDbRoot)dbRoot=n;
        else if(!n._isCalRoot)docCount++;
      }
    }
  }
  const elStar=$('#cntStarred');if(elStar)elStar.textContent=starred as any;
  const dbCount=dbRoot?dbRoot.children.length:0;
  const elDb=$('#cntDb');if(elDb)elDb.textContent=dbCount;
  const elDocs=$('#cntDocs');if(elDocs)elDocs.textContent=docCount as any;
  const elTags=$('#cntTags');if(elTags)elTags.textContent=deps.l7TagCountText(); /* L7-W4：冷缓存 → 占位 '…' + 后台分块构建（不再同步全量建索引阻塞侧栏）；L18 · P3-3：占位统一为省略号 + title 构建中 */
  /* FIX-M-12：指纹未变化则跳过四棵子树的全量 innerHTML 重建（计数/导航态仍每帧刷新） */
  const fp=deps.sidebarFingerprint();
  if(fp!==_sidebarFp){
    _sidebarFp=fp;
    renderSubDb(dbRoot);
    renderSubStarred();
    renderSubDocs();
    renderSubTags();
  }else{
    /* 【fix26-p4】跳过重建时仍须让行标题跟上节点 text（重命名只改 text，指纹不含 text） */
    _sbSyncRowLabels(box);
  }
  deps.renderIntro();
  deps.updateSidebarActiveState();
  if(box)box.scrollTop=scrollTop;
  /* 【批次1·侧栏多选】侧栏可见顺序随渲染刷新；仅在无选择或已处于 sidebar 模式时接管，
     避免文件 / 数据库卡片的多选集合被侧栏每帧渲染清空（其它视图行为零变更） */
  if(!_mSel.type||_mSel.type==='sidebar')_mSelSetOrder('sidebar',_sbVisibleIds());
  _mSelPaint();
  /* 【批次1-4 修复】侧栏 DOM 若被重建导致 ⠖ 拖拽手柄丢失，这里幂等补挂（内部只在缺手柄时动作） */
  try{if(_win.JU_DND&&_win.JU_DND.ensureNavGrips)_win.JU_DND.ensureNavGrips();}catch(e){console.warn('[JU] caught error',e);}
}
export function renderSubDb(dbRoot: any): void {
  const box=$('#subDb');if(!box)return;
  const open=!!deps.ui.navExpanded.database;
  box.classList.toggle('open',open);
  box.innerHTML='';
  if(!open)return;
  const items=dbRoot?dbRoot.children.map((id: any)=>deps.N(id)).filter((n: any)=>n&&!n._deleted):[];
  if(!items.length){const empty=document.createElement('div');empty.className='sb-row sb-empty';empty.innerHTML='<span class="sb-arrow leaf"></span><span class="sb-icon"></span><span class="sb-label">暂无多维表格</span>';box.appendChild(empty);return;}
  items.forEach((n: any)=>{ box.appendChild(makeSidebarRow(n.id)); });
}
export function renderSubStarred(): void {
  const box=$('#subStarred');if(!box)return;
  const open=!!deps.ui.navExpanded.starred;
  box.classList.toggle('open',open);
  box.innerHTML='';
  if(!open)return;
  /* 【还原原始版】星标文件分组逐条列出星标文档（按星标数降序、上限 30 条），
     与“我的文档”分组并列显示属原始设计，不再改动星标逻辑 */
  const items: any[]=[];
  for(const id in deps.state.nodes){const n=deps.state.nodes[id];if(n.starred>0&&!deps.isFolder(id)&&!n._deleted)items.push(n);}
  items.sort((a,b)=>(b.starred||0)-(a.starred||0));
  if(!items.length){const empty=document.createElement('div');empty.className='sb-row sb-empty';empty.innerHTML='<span class="sb-arrow leaf"></span><span class="sb-icon"></span><span class="sb-label">暂无星标</span>';box.appendChild(empty);return;}
  items.slice(0,30).forEach(n=>{ box.appendChild(makeSidebarRow(n.id)); });
}
export function renderSubDocs(): void {
  const box=$('#subDocs');if(!box)return;
  /* FIX-M-27：侧栏文档树容器加 role="tree"（纯 ARIA 属性，行为零变化；键盘导航不在本批，后续批次补充） */
  box.setAttribute('role','tree');
  const open=!!deps.ui.navExpanded.files;
  box.classList.toggle('open',open);
  box.innerHTML='';
  if(!open)return;
  const root=deps.N(deps.state.rootId);
  const ids=deps.sortDocs(root.children.filter((id: any)=>{const n=deps.N(id);return n&&!n._isDbRoot&&!n._isCalRoot&&!n._isNoteRoot&&!n._deleted;}),deps.ui.filesSort||'name');
  if(!ids.length){const empty=document.createElement('div');empty.className='sb-row sb-empty';empty.innerHTML='<span class="sb-arrow leaf"></span><span class="sb-icon"></span><span class="sb-label">暂无文档</span>';box.appendChild(empty);return;}
  ids.forEach(id=>box.appendChild(makeSidebarRow(id)));
}
export function promptNewTag(): void {
  appPrompt('新标签名：','',(name)=>{
    if(name===null)return;
    const t=(name||'').trim().replace(/^#/,'');
    if(!t){toast('标签名不能为空');return;}
    /* 【fix5 · P1】新建标签只登记**全局标签索引**（state._tags），不向任何节点的
       tags / _manualTags 写入。原实现「新建后自动把标签赋给当前选中节点」已删除：
       节点与标签的关联只允许发生在用户显式勾选该标签时（如日历待办右键「选择标签」）。
       —— 侧栏数据源 buildTagIndex 会合并 state._tags，空标签（计数 0）同样可见。 */
    let exists=false;
    try{const idx=deps.buildTagIndex();exists=!!(idx&&typeof idx.has==='function'&&idx.has(t));}
    catch(e){console.warn('[JU] tag index check failed',e);}
    if(exists){toast('标签 #'+t+' 已存在');return;}
    try{
      deps.commit((s: any)=>{
        if(!Array.isArray(s._tags))s._tags=[];
        if(s._tags.indexOf(t)<0)s._tags.push(t);
        bumpStructRev(s); /* 标签行集合变化 ⇒ 侧栏指纹失效，禁止被 FIX-M-12 memo 跳过 */
      },{snapshot:true});
    }catch(e){console.error('[JU] create tag failed',e);toast('新建标签失败');return;}
    invalidateTagIndex();renderSidebar();deps.forceRender();toast('已创建标签 #'+t);
  });
}
/**
 * 【fix5 · P2】标签行排序：与「我的文档」列表共用**同一个排序状态**（`deps.ui.filesSort`）与
 * **同一个比较器**（`deps.sortDocs`，即 app/session.sortDocs）。
 *
 * 口径（标签本身没有 created/updated/star，故用「代表节点」把标签映射到文档维度）：
 *   ① **名称语义（mode = 'name' / 'type'）**：标签直接按标签名升序（`compareZh`，即 sortDocs
 *      名称分支用的同一个 Intl.Collator，'zh-Hans' + numeric + sensitivity:base）；
 *      空标签（count=0）同列参与名称排序 —— 名称维度上不存在「无时间」的降级问题。
 *   ② **时间 / 星标语义（mode = 'created' / 'updated' / 'star'）**：
 *      代表节点 = 该标签成员节点中 updatedAt 最大者（无成员 ⇒ 无代表）；
 *      用与 renderSubDocs **完全相同**的输入集合（root.children 同款过滤）与比较器
 *      `deps.sortDocs(kids, mode)` 求「我的文档」列表的真实位次表（含平局时的稳定次序）；
 *      标签按代表节点位次升序排列，平局用 `compareZh` 收尾；
 *      代表不在「我的文档」一级列表内的（如子文件夹里的文档）追加到末尾，内部先按标签名预排再走
 *      同一比较器；无成员的空标签排在最后，彼此按 `compareZh`。
 *
 * 由此：name/type 模式下两组列表都是「名称升序」；created/updated/star 模式下标签顺序与文档列表
 * 严格同序（同一比较器、同一输入集合）。排序每次渲染重算，故新增/重命名/删除标签、修改标签关联
 * （含正文 #tag 变化）后即时生效。
 */
export function sortTagRowsByMode(rows: any[], mode: string): any[] {
  const m=mode||'name';
  /* ① 名称语义：标签名升序（与 sortDocs 名称分支同一比较器）；空标签同列参与 */
  if(m==='name'||m==='type'){
    return (rows||[]).slice().sort((a: any,b: any)=>compareZh(a.tag,b.tag));
  }
  /* ② 代表节点：成员中 updatedAt 最大者（无成员 ⇒ 无代表） */
  const repOf=new Map<string,any>();
  for(const r of (rows||[])){
    const ids: any[]=(r&&r.ids instanceof Set)?Array.from(r.ids):(Array.isArray(r&&r.ids)?r.ids:[]);
    let best: any=null,bestAt=-Infinity;
    for(const id of ids){
      const n=deps.N(id);
      if(!n||n._deleted)continue;
      const at=Number(n.updatedAt||0);
      if(best===null||at>bestAt){best=id;bestAt=at;}
    }
    repOf.set(r.tag,best);
  }
  /* ③ 与 renderSubDocs 同源的「我的文档」位次表 */
  const pos=new Map<any,number>();
  try{
    const root=deps.N(deps.state.rootId);
    const kids: any[]=(root&&Array.isArray(root.children))
      ?root.children.filter((id: any)=>{const n=deps.N(id);return n&&!n._isDbRoot&&!n._isCalRoot&&!n._isNoteRoot&&!n._deleted;})
      :[];
    const ordered: any[]=deps.sortDocs(kids,m)||[];
    ordered.forEach((id: any,i: number)=>{if(!pos.has(id))pos.set(id,i);});
  }catch(e){console.warn('[JU] sortTagRowsByMode docs order failed',e);}
  /* ④ 一级列表之外的代表节点：按标签名预排后走同一比较器，追加到末尾 */
  const leftovers: any[]=[];
  repOf.forEach((id: any,t: string)=>{if(id!==null&&id!==undefined&&!pos.has(id))leftovers.push({id:id,tag:t});});
  if(leftovers.length){
    leftovers.sort((a: any,b: any)=>compareZh(a.tag,b.tag));
    let ordered: any[]=leftovers.map((x: any)=>x.id);
    try{const o=deps.sortDocs(ordered,m);if(Array.isArray(o))ordered=o;}
    catch(e){console.warn('[JU] sortTagRowsByMode leftovers failed',e);}
    let tail=pos.size;
    ordered.forEach((id: any)=>{if(!pos.has(id))pos.set(id,tail++);});
  }
  /* ⑤ 标签排序：代表位次 → 名称 */
  const rankOf=(t: string)=>{
    const id=repOf.get(t);
    if(id===null||id===undefined)return Infinity;
    const p=pos.get(id);
    return (typeof p==='number')?p:Infinity;
  };
  return (rows||[]).slice().sort((a: any,b: any)=>{
    const ra=rankOf(a.tag),rb=rankOf(b.tag);
    if(ra!==rb)return ra-rb;
    return compareZh(a.tag,b.tag);
  });
}
export function renderSubTags(): void {
  const box=$('#subTags');if(!box)return;
  const open=!!deps.ui.navExpanded.tags;
  box.classList.toggle('open',open);
  box.innerHTML='';
  /* 【QA-修复-标签】折叠时也保留「新建标签」入口（注释承诺「无标签时也显示新建标签入口」，
     原实现折叠即整体 return，入口消失 → 用户无法新建标签）。点击入口先展开分组再弹输入。 */
  if(!open){
    const add=document.createElement('div');add.className='sb-row sb-add';
    add.innerHTML='<span class="sb-arrow leaf"></span><span class="sb-icon" style="font-weight:700;color:var(--accent-fg)">＋</span><span class="sb-label" style="color:var(--accent-fg)">新建标签</span>';
    add.onclick=()=>{deps.ui.navExpanded.tags=true;renderSidebar();setTimeout(promptNewTag,0);};
    box.appendChild(add);
    return;
  }
  /* L7-W4 两阶段渲染：标签索引未就绪 → 骨架行**同步**先出（阶段 1），后台分块构建完成后回调重渲染本函数（阶段 2）。
     保留「新建标签」入口：不因索引未就绪而失去功能（LO-1 功能不降级） */
  if(!deps.tagIndexCache){
    deps.l7SkeletonEnsureCss();
    const addSk=document.createElement('div');addSk.className='sb-row sb-add';
    addSk.innerHTML='<span class="sb-arrow leaf"></span><span class="sb-icon" style="font-weight:700;color:var(--accent-fg)">＋</span><span class="sb-label" style="color:var(--accent-fg)">新建标签</span>';
    addSk.onclick=()=>{deps.ui.navExpanded.tags=true;renderSidebar();setTimeout(promptNewTag,0);};
    box.appendChild(addSk);
    /* L22 · 清理 3：骨架行必须包在 .ju-skel 父级内——l7 骨架样式全部为 `.ju-skel .ju-skel-*` 后代选择器，
       原实现把 .ju-skel-row 直接挂在 #subTags 上（无 .ju-skel 祖先）⇒ 行布局 / 行高 / 微光背景全部不生效。 */
    const _swrap=document.createElement('div');_swrap.className='ju-skel';
    for(let _si=0;_si<4;_si++){
      const _sr=document.createElement('div');_sr.className='ju-skel-row';
      const _sl=document.createElement('div');_sl.className='ju-skel-line';_sl.style.width=(118-_si*16)+'px';
      _sr.appendChild(_sl);_swrap.appendChild(_sr);
    }
    box.appendChild(_swrap);
    /* L18 · P3-4：骨架提示与侧栏计数占位同语义（索引构建中） */
    const _shint=document.createElement('div');_shint.className='ju-skel-hint';_shint.textContent='正在构建索引…';_swrap.appendChild(_shint);
    deps.l7TagIndexWhenReady(function(){if(deps.ui.navExpanded.tags)renderSubTags();});
    return;
  }
  const tagIndex=deps.buildTagIndex();
  /* L17-W1 · 指令 1（Defect-P0-1）：原实现此处直接 tags.forEach(...)，而 tags 从未在本作用域声明
     （全文件不存在全局 tags）→ 用户展开标签分组必抛 ReferenceError，分组恒不渲染。
     改为由 buildTagIndex() 返回的 Map<tag, Set<id>> 派生 [tag,count,ids] 行；计数取 idSet.size
     （索引值为 Set，无 length 属性）。
     【fix5 · P2】排序改为**跟随「排序切换」状态**（deps.ui.filesSort）并经 sortTagRowsByMode 复用
     文档列表比较器（deps.sortDocs）——原实现硬编码 `.sort((a,b)=>b[1]-a[1])`（计数降序），
     文档列表跟着 #sortBtn 变而标签列表不动（H2）。空标签（count=0）排在最后，不再与有关联的标签
     混排。空索引渲染「暂无标签」占位行。 */
  const tagRows=sortTagRowsByMode(
    Array.from(tagIndex.entries()).map(([t,idSet]: any)=>({tag:String(t),count:(idSet&&typeof idSet.size==='number')?idSet.size:0,ids:idSet})),
    deps.ui.filesSort||'name'
  );
  if(!tagRows.length){
    const empty=document.createElement('div');empty.className='sb-row sb-empty';
    empty.innerHTML='<span class="sb-arrow leaf"></span><span class="sb-icon"></span><span class="sb-label">暂无标签</span>';
    box.appendChild(empty);
  }else{
    tagRows.forEach(({tag:t,count}: any)=>{
      const row=document.createElement('div');row.className='sb-row';row.dataset.tag=t;
      const arr=document.createElement('span');arr.className='sb-arrow leaf';row.appendChild(arr);
      const ic=document.createElement('span');ic.className='sb-icon';ic.style.cssText='color:var(--icon);font-weight:700';ic.textContent='#';
      const dot=document.createElement('span');dot.className='sb-tag-dot';dot.style.setProperty('--tag-color', deps.getTagColor(t));
      dot.title='点击选择标签颜色';
      dot.onclick=e=>{e.stopPropagation();deps.openTagPalette(dot,t);};
      row.addEventListener('contextmenu',e=>{
        e.preventDefault();
        showContextMenu([
          {ic:'✏️',txt:'重命名标签',fn:()=>{appPrompt('重命名为：',t,(nt)=>{if(nt===null)return;const nt2=(nt||'').trim().replace(/^#/,'');if(!nt2||nt2===t){toast('标签名无效或未变化');return;}renameTag(t,nt2);});}},
          {ic:'🗑',txt:'删除标签',danger:true,fn:()=>{appConfirm('删除标签 #'+t+'（从所有节点文本移除）？',()=>removeTag(t));}},
          {sep:true},
          {ic:'🎨',txt:'更改颜色',fn:()=>{deps.openTagPalette(row.querySelector('.sb-tag-dot'),t);}},
        ],e);
      });
      const lab=document.createElement('span');lab.className='sb-label';lab.textContent=t;
      const cnt=document.createElement('span');cnt.className='count';cnt.textContent=count;
      row.appendChild(ic);row.appendChild(dot);row.appendChild(lab);row.appendChild(cnt);
      row.onclick=()=>deps.openTag(t);
      box.appendChild(row);
    });
  }
  const add=document.createElement('div');add.className='sb-row sb-add';
  add.innerHTML='<span class="sb-arrow leaf"></span><span class="sb-icon" style="font-weight:700;color:var(--accent-fg)">＋</span><span class="sb-label" style="color:var(--accent-fg)">新建标签</span>';
  add.onclick=promptNewTag;
  box.appendChild(add);
}
/* 【UI修复12】标签重命名：全库替换 #旧→#新（仅匹配完整标签词） */
/* FIX-H-10：富文本中标签常被内联包裹为 <b>#设计</b>，原在原始 HTML 上做正则替换时前瞻 (?=\s|$) 遇 '<' 失败，
   节点被命中但可见文本原样保留。改为 DOMParser 解析后遍历文本节点替换，保留富文本结构；newT 传 null 表示删除标签。 */
export function replaceTagInHtmlTag(html: any, oldT: string, newT: string|null): string {
  if(!html)return html||'';
  const re=new RegExp('#'+oldT.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=\\s|$)','g');
  const doc=new DOMParser().parseFromString('<body>'+html+'</body>','text/html');
  const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);
  const texts: Text[]=[];let tn: Node|null;
  while((tn=walker.nextNode()))texts.push(tn as Text);
  texts.forEach(node=>{
    const v=node.nodeValue as string;
    if(v.indexOf('#'+oldT)<0)return;
    node.nodeValue=v.replace(re,newT==null?'':'#'+newT);
  });
  return doc.body.innerHTML;
}
export function renameTag(oldT: string, newT: string): void {
  deps.commit((s: any)=>{
    for(const id in s.nodes){
      const n=s.nodes[id];if(!n||n._deleted||n._isFolder)continue;
      const raw=stripHtml(n.text||'');
      if(raw.indexOf('#'+oldT)<0&&!(Array.isArray(n.tags)&&n.tags.includes(oldT)))continue;
      n.text=replaceTagInHtmlTag(n.text||'',oldT,newT);
      if(Array.isArray(n.tags)&&n.tags.includes(oldT))n.tags=n.tags.map((x: any)=>x===oldT?newT:x);
      /* FIX-L-44：手动标签记录 _manualTags 同步重命名，避免重命名后手动标签失效 */
      if(Array.isArray(n._manualTags)&&n._manualTags.includes(oldT))n._manualTags=n._manualTags.map((x: any)=>x===oldT?newT:x);
      n.updatedAt=deps.nowSeq();
    }
    /* 【fix5 · P1】全局标签索引同步重命名（去重：新名已存在时只保留一份） */
    if(Array.isArray(s._tags)&&s._tags.indexOf(oldT)>=0){
      s._tags=s._tags.map((x: any)=>x===oldT?newT:x).filter((x: any,i: number,arr: any[])=>arr.indexOf(x)===i);
    }
    bumpStructRev(s); /* P0：标签行改名改变侧栏行内容 ⇒ 指纹失效，四棵子树必须重建 */
  },{snapshot:true});
  invalidateTagIndex();renderSidebar();deps.forceRender();toast('已重命名为 #'+newT);
}
/* 【UI修复12】标签删除：从所有节点文本移除 #旧 */
export function removeTag(t: string): void {
  deps.commit((s: any)=>{
    for(const id in s.nodes){
      const n=s.nodes[id];if(!n||n._deleted||n._isFolder)continue;
      const raw=stripHtml(n.text||'');
      if(raw.indexOf('#'+t)<0&&!(Array.isArray(n.tags)&&n.tags.includes(t)))continue;
      n.text=replaceTagInHtmlTag(n.text||'',t,null);
      if(Array.isArray(n.tags)&&n.tags.includes(t))n.tags=n.tags.filter((x: any)=>x!==t);
      /* FIX-L-44：手动标签记录 _manualTags 同步剔除 */
      if(Array.isArray(n._manualTags)&&n._manualTags.includes(t))n._manualTags=n._manualTags.filter((x: any)=>x!==t);
      n.updatedAt=deps.nowSeq();
    }
    /* 【fix5 · P1】全局标签索引同步剔除：否则空标签行删除后仍会以 count=0 留在侧栏 */
    if(Array.isArray(s._tags))s._tags=s._tags.filter((x: any)=>x!==t);
    bumpStructRev(s); /* P0：删除标签改变侧栏标签行集合 ⇒ 指纹失效 */
  },{snapshot:true});
  invalidateTagIndex();renderSidebar();deps.forceRender();toast('已删除标签 #'+t);
}
export function makeSidebarRow(id: any): HTMLElement {
  const n=deps.N(id);
  const wrap=document.createElement('div');wrap.className='sb-node';
  const row=document.createElement('div');row.className='sb-row';row.dataset.id=id;
  /* 【批次1·侧栏多选】data-msid 供 _mSelPaint 统一点亮；渲染时按当前选择回填 ju-msel */
  row.setAttribute('data-msid',id);
  if(_mSel.type==='sidebar'&&_mSelHas(id))row.classList.add('ju-msel');
  /* FIX-M-27：文档树子树行加 role="treeitem"（纯 ARIA 属性，行为零变化；键盘导航不在本批，后续批次补充） */
  row.setAttribute('role','treeitem');
  const isFolderNode=deps.isFolder(id);
  const hasKids=isFolderNode&&n.children.length>0;
  const arrow=document.createElement('span');
  arrow.className='sb-arrow'+(hasKids?'':' leaf');
  if(hasKids){
    const collapsed=!!deps.ui.collapsedDocs[id];
    arrow.textContent=collapsed?'▶':'▼';
    /* FIX-M-27：折叠父节点 aria-expanded 随 ui.collapsedDocs 同步（true=展开/false=折叠），叶子节点不设置该属性 */
    row.setAttribute('aria-expanded',collapsed?'false':'true');
    arrow.onclick=e=>{e.stopPropagation();deps.ui.collapsedDocs[id]=!deps.ui.collapsedDocs[id];deps.saveUI();renderSidebar();};
  }
  row.appendChild(arrow);
  const icon=document.createElement('span');icon.className='sb-icon';icon.innerHTML=deps.getNodeSvg(id);row.appendChild(icon);
  const label=document.createElement('span');label.className='sb-label';label.textContent=stripHtml(n.text)||'未命名';row.appendChild(label);
  row.onclick=e=>{
    /* 【批次1·侧栏多选】Ctrl/Cmd 切换 · Shift 范围（基准 = 侧栏可见顺序）；普通点击保持 openNode */
    if(e&&(e.ctrlKey||e.metaKey||e.shiftKey)){e.preventDefault();_mSelClick('sidebar',id,e,_sbVisibleIds());return;}
    deps.openNode(id);
  };
  /* 【D-09】右键菜单改由**容器委托**承担（见 _sbEnsureContextMenuDelegation）：
     逐行 `row.oncontextmenu = fn` 在行被 renderSidebar 反复重建 / 属性被后续赋值覆盖时会丢，
     表现为「某些行右键无反应」。此处只登记一次委托，行内不再单独绑定。 */
  _sbEnsureContextMenuDelegation();
  /* 【fixed16 A】侧栏拖拽移动节点 */
  row.addEventListener('mousedown',e=>{
    if(e.button!==0)return;
    if((e.target as HTMLElement).closest('.sb-arrow'))return; /* 折叠箭头不触发拖拽 */
    if(id===deps.state.rootId)return; /* 根节点不可拖 */
    const dn=deps.N(id);if(!dn||dn._deleted||dn._isDbRoot||dn._isCalRoot)return;
    const sx=e.clientX,sy=e.clientY;
    let dragging=false,dropMode: any=null,dropTargetId: any=null;
    let hoverTimer: any=null,hoverTid: any=null; /* 【fixed16 A6】hover 展开折叠文件夹定时器 */
    const clearHoverTimer=()=>{if(hoverTimer){clearTimeout(hoverTimer);hoverTimer=null;hoverTid=null;}};
    const onMM=(ev: MouseEvent)=>{
      if(!dragging){
        if(Math.abs(ev.clientX-sx)<5&&Math.abs(ev.clientY-sy)<5)return;
        dragging=true;row.classList.add('dragging');e.preventDefault();
      }
      /* 清除旧高亮 */
      document.querySelectorAll('.sb-row.drop-before,.sb-row.drop-after,.sb-row.drop-child').forEach(r=>{r.classList.remove('drop-before','drop-after','drop-child');});
      const targetEl=document.elementFromPoint(ev.clientX,ev.clientY);
      const targetRow=targetEl?targetEl.closest('.sb-row[data-id]') as HTMLElement|null:null;
      dropTargetId=null;dropMode=null;
      if(targetRow){
        const tid=targetRow.dataset.id;
        if(tid&&tid!==id){
          const rect=targetRow.getBoundingClientRect();
          const p=(ev.clientY-rect.top)/rect.height;
          const tn=deps.N(tid);
          if(p<0.33){dropMode='before';dropTargetId=tid;targetRow.classList.add('drop-before');}
          else if(p>0.67){dropMode='after';dropTargetId=tid;targetRow.classList.add('drop-after');}
          else if(tn&&tn.children){dropMode='child';dropTargetId=tid;targetRow.classList.add('drop-child');}
          /* 【fixed16 A6】hover 折叠文件夹 500ms 自动展开 */
          if(tn&&tn.children&&tn.children.length&&deps.ui.collapsedDocs[tid]){
            if(hoverTid!==tid){clearHoverTimer();hoverTid=tid;
              hoverTimer=setTimeout(()=>{deps.ui.collapsedDocs[tid]=false;deps.saveUI();renderSidebar();},500);
            }
          }else{clearHoverTimer();}
        }else{clearHoverTimer();}
      }else{clearHoverTimer();}
    };
    const onMU=()=>{
      document.removeEventListener('mousemove',onMM);
      document.removeEventListener('mouseup',onMU);
      clearHoverTimer();
      document.querySelectorAll('.sb-row.drop-before,.sb-row.drop-after,.sb-row.drop-child').forEach(r=>{r.classList.remove('drop-before','drop-after','drop-child');});
      row.classList.remove('dragging');
      if(!dragging||!dropTargetId||!dropMode)return;
      const targetNode=deps.N(dropTargetId);if(!targetNode)return;
      try{
        if(dropMode==='child'){
          deps.actions.moveNode(id,dropTargetId,targetNode.children.length);
        }else{
          const parent=deps.N(targetNode.parent)||deps.N(deps.state.rootId);
          if(!parent)return;
          let idx=parent.children.indexOf(dropTargetId);
          if(idx<0)return;
          if(dropMode==='after')idx++;
          deps.actions.moveNode(id,parent.id,idx);
        }
        renderSidebar();deps.forceRender();
      }catch(err){try{toast('不能移动到自身或子节点');}catch(_){console.warn('[JU] caught error',_);}}
    };
    document.addEventListener('mousemove',onMM);
    document.addEventListener('mouseup',onMU);
  });
  wrap.appendChild(row);
  if(hasKids&&!deps.ui.collapsedDocs[id]){
    const kids=document.createElement('div');kids.className='sb-children';
    n.children.forEach((cid: any)=>kids.appendChild(makeSidebarRow(cid)));
    wrap.appendChild(kids);
  }
  return wrap;
}
export function navTo(nav: string|null): void {
  /* 【折叠态守持】navTo 不再无条件强制 ui.navExpanded[nav]=true：已展开时不重复写入 / 重渲染，
     避免点击文字路径覆盖三角折叠状态；折叠 / 展开的切换仍由三角按钮独占。 */
  if(nav==='starred'){
    if(!deps.ui.navExpanded.starred){deps.ui.navExpanded.starred=true;deps.saveUI();renderSidebar();}
    deps.ui.view='starred';
    deps.saveUI();
    deps.safeNavigate(()=>{deps.setActiveKey('nav:starred');});
    return;
  }
  if(nav==='files'){
    /* 【UI修复12】参考“星标文件”：点击文字仅打开并展开，不切换折叠；折叠/展开只由三角触发 */
    if(!deps.ui.navExpanded.files){deps.ui.navExpanded.files=true;deps.saveUI();renderSidebar();}
    deps.setActiveKey('nav:files');
    deps.ui.view='auto';
    deps.ui.currentDocId=deps.state.rootId;
    deps.safeNavigate(()=>{});
    return;
  }
  if(nav==='database'){
    /* 【UI修复12】参考“星标文件”：点击文字仅打开并展开，不切换折叠；折叠/展开只由三角触发 */
    if(!deps.ui.navExpanded.database){deps.ui.navExpanded.database=true;deps.saveUI();renderSidebar();}
    deps.setActiveKey('nav:database');
    /* 批次 2 · 问题 7 / 问题 4：进入“数据库”直接定位数据库根文件夹——viewOf(_isDbRoot) = FOLDER，
       由 renderFolderGrid 渲染卡片缩略图（与“我的文档”同口径）；不再默认打开第一张表，
       空库同样落到文件夹视图并显示空文件夹提示 */
    let dbRootId=null;
    for(const id in deps.state.nodes){if(deps.state.nodes[id]._isDbRoot){dbRootId=id;break;}}
    if(dbRootId){
      deps.ui.currentDocId=dbRootId;
      deps.ui.view='auto';
      deps.safeNavigate(()=>{});
    }
    return;
  }
  if(nav==='tags'){
    /* 【UI修复12】参考“星标文件”：点击文字仅展开，不切换折叠；折叠/展开只由三角触发 */
    if(!deps.ui.navExpanded.tags){deps.ui.navExpanded.tags=true;deps.saveUI();renderSidebar();}
    deps.setActiveKey('nav:tags');
    return;
  }
  if(nav==='calendar'){
    const calRootId=deps.getCalendarRootId();
    const _now=new Date();
    deps.safeNavigate(()=>{
      deps.ui.currentDocId=calRootId;deps.ui.view='auto';
      /* 【UI修复7】每次打开日历默认框选当天日期，月份回到当月 */
      deps.ui.selectedDate=todayStr();deps.ui.calMonth={y:_now.getFullYear(),m:_now.getMonth()};
      deps.saveUI();deps.setActiveKey('nav:calendar');
    });
    return;
  }
  deps.safeNavigate(()=>{deps.ui.view=nav;deps.saveUI();});
}
