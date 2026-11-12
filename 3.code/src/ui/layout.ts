/**
 * M1-1 · 批次 L · 顶栏与主框架交互（Topbar / 侧栏折叠与拖动调宽）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html「顶栏 / 工具」区原文逐行对应
 *   - bindTopbar ...... 19998-20076
 *   - bindMainToggles . 20077-20172
 *
 * 约束：DOM 查询串、内联样式、窗口 API 调用顺序、提示文案与 FIX-* 注释逐字保留。
 *   仅作两类纯类型层调整：
 *     1) 未拆分业务符号统一走 `deps` 依赖注入容器（原直接调用改为 `deps.xxx`）：
 *        ui（ui.view / ui.sidebarLeft|RightCollapsed|Width）、saveUI()、renderMain()、
 *        getCurrentDoc()、viewOf()、_forceRender 置位（原 `_forceRender=true` → deps.setForceRender(true)）。
 *     2) `$()` 返回可空元素处的非空断言 `!`（运行期无任何行为差异）。
 *   注：`VIEW_KIND` 自 ../core/constants 引入；`toast` / `appConfirm` 自 ./common 引入；
 *       `_win` 为 window 的同语义别名（HTML:1377 原文）。
 */
import { $, $$, hasTauriInvoke } from '../core/utils';
import { VIEW_KIND } from '../core/constants';
/* 【D-03 / D-07】bindClick / bindPressFallback：折叠钮与浮窗类按钮统一走 addEventListener */
import { toast, appConfirm, bindClick } from './common';
import { verifyLicense, LICENSE_STORAGE_KEY } from '../core/license';
/* M5-2 · 搜索 Worker：同步口径（回落 / 参考实现）与内联 Worker 构造器 */
import { searchNodes, type SearchResponse } from '../core/search.worker';
import SearchWorkerFactory from '../core/search.worker?worker&inline';
/* HTML:1377 原文 const _win = (window) —— 同语义别名 */
const _win: any = window;

/**
 * 依赖注入容器：承接原同作用域内、尚未拆分到模块的既有业务实现。
 * 占位实现于 src/main.ts 初始化时注入（防止运行时报错；真实实现随对应批次迁移回填）。
 */
export const deps: {
  /** 全局 UI 状态对象（对应产品的 `ui`） */
  ui: any;
  /** 原 `_forceRender=true`：请求下一次渲染强制全量 */
  setForceRender: (v: boolean) => void;
  saveUI: () => void;
  renderMain: () => void;
  getCurrentDoc: () => any;
  viewOf: (doc: any) => any;
  /* ── Track B · M0-15 设置面板行为端口（可选注入，缺省 noop） ── */
  /** 上传整库快照到云端（core/persist.syncToCloud；Pro 门槛在实现内部拦截） */
  syncToCloud: () => Promise<any>;
  /** 从云端拉取整库快照并合并（core/persist.syncFromCloud） */
  syncFromCloud: () => Promise<any>;
  /** 云端同步入口是否可用（core/persist.isCloudSyncEnabled；端点未配置 ⇒ 隐藏入口） */
  isCloudSyncEnabled: () => boolean;
} = {
  ui: {},
  setForceRender: () => {},
  saveUI: () => {},
  renderMain: () => {},
  getCurrentDoc: () => null,
  viewOf: () => null,
  syncToCloud: () => Promise.resolve(false),
  syncFromCloud: () => Promise.resolve(false),
  /* 缺省视为「入口可用」：未注入端口的场景（单测 / 静态骨架）不改变既有可见性 */
  isCloudSyncEnabled: () => true,
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function bindLayoutDeps(next: Partial<typeof deps>): void {
  Object.assign(deps, next);
}

export function bindTopbar(): void {
  /* 【fix33-8 · ISSUE-008】删除 .tb-wbtn 的 mousedown / pointerdown 阻断：Tauri 1.8.3
     scripts/core.js:160-168 仅按 `e.target.hasAttribute('data-tauri-drag-region')` 判定拖拽，
     按钮及其 svg/path 均无该属性 ⇒ 不是 drag target；阻断冒泡反而让 document 级的
     右键菜单 / 取色器 / 字号面板外部关闭失效。 */
  $$('.tb-nav-btn').forEach(b=>{
    b.onclick=()=>{
      const v=b.dataset.view;
      /* 【fix26-p2】「资料库」在非资料库视图已置灰：pointer-events:none 阻挡真实点击，
         此处再补 JS 层拦截，程序化 click / 键盘激活同样不切换视图 */
      if(v==='document'&&b.classList.contains('disabled'))return;
      const ae=document.activeElement as HTMLElement|null;
      if(ae&&ae.blur)ae.blur();
      deps.setForceRender(true);
      /* 【UI修复13】左侧选中与顶部视图一一对应：顶部只切渲染模式，永不跳转文档；
         容器（日历/文件夹）不支持文档类视图时提示并保持当前页 */
      const _cur=deps.getCurrentDoc();
      const _cv=_cur?deps.viewOf(_cur):null;
      const _isContainer=_cv===VIEW_KIND.LIBRARY_ROOT||_cv===VIEW_KIND.FOLDER||_cv===VIEW_KIND.CALENDAR;
      if(v==='outline'||v==='mindmap'||v==='presentation'||v==='slides'||v==='graph'||v==='history'){
        if(_isContainer){
          toast(_cv===VIEW_KIND.CALENDAR?'当前为日历容器，不生成图谱/历史视图':'当前为文件夹，请先在左侧选择具体文档');
          deps.saveUI();deps.renderMain();return;
        }
        deps.ui.view=v;
      }
      else { deps.ui.view=v==='document'?'auto':v; }
      deps.saveUI(); deps.renderMain();
    };
  });
  /* fixr6-5 · ISSUE-005：窗口按钮按能力口径判定（与 main.ts hasDesktopInvoke 同源；仅注入命名空间不算桌面） */
  const isDesktop=!!(hasTauriInvoke()||_win.electron||_win.nw);
  /* 【fix29-2】置顶按钮高亮：以真实窗口状态为准（isAlwaysOnTop 优先），点击成功后同步按钮视觉 */
  const syncPin=(on:boolean)=>{
    const p=document.getElementById('btnPin');
    if(!p)return;
    p.classList.toggle('on',on);
    p.setAttribute('aria-pressed',on?'true':'false');
    p.style.color=on?'var(--accent)':'';
    p.style.background=on?'var(--accent-soft)':'';
  };
  /* 【fix30】置顶态本地维护：Tauri 1.8.3 的注入 API（scripts/*.js）与 @tauri-apps/api 均无
     isAlwaysOnTop，读真实态恒失败 ⇒ 旧代码 catch 里把按钮 display:none（按钮消失＝「点了没反应」）。
     改为本地状态机 + setAlwaysOnTop 成功后回写，失败不再隐藏按钮。 */
  let pinState=false;
  ['btnPin','btnMin','btnMax'].forEach(id=>{
    const b=$('#'+id);
    if(!b)return;
    if(!isDesktop){
      b.style.display='none'; /* FIX-UI-40: 浏览器环境直接隐藏窗口控制按钮，避免灰显占位 */
      return;
    }
    /* 【P0-1】桌面壳：真实调用窗口 API，不再只弹 toast；壳内 API 缺失或调用失败时自动隐藏按钮，不留假按钮 */
    const label=({btnPin:'窗口置顶',btnMin:'最小化',btnMax:'最大化'} as Record<string,string>)[id]||'';
    b.onclick=async()=>{
      try{
        if(window.__TAURI__&&window.__TAURI__.window){
          const win=window.__TAURI__.window.getCurrentWindow
            ? window.__TAURI__.window.getCurrentWindow()
            : window.__TAURI__.window.getCurrent();
          if(id==='btnMin'&&win.minimize)return await win.minimize();
          if(id==='btnMax'&&win.toggleMaximize)return await win.toggleMaximize();
          if(id==='btnPin'&&win.setAlwaysOnTop){
            const next=!pinState;
            const r=await win.setAlwaysOnTop(next);
            pinState=next;syncPin(next);
            return r;
          }
        }
        if(_win.electron&&_win.electron.ipcRenderer){
          _win.electron.ipcRenderer.send(id==='btnMin'?'window-minimize':id==='btnMax'?'window-maximize':'window-toggle-top');
          return;
        }
        if(_win.nw&&_win.nw.Window&&_win.nw.Window.get){
          const w=_win.nw.Window.get();
          if(id==='btnMin'&&w.minimize)return w.minimize();
          if(id==='btnMax'&&w.maximize)return w.maximize();
          if(id==='btnPin'&&w.setAlwaysOnTop){const cur=!!w.alwaysOnTop;const r=w.setAlwaysOnTop(!cur);syncPin(!cur);return r;}
        }
        b.style.display='none';
      }catch(e){
        /* 【fix33-8 · ISSUE-009】置顶 API 缺失/拒绝时不翻转本地状态，只 toast：保持按钮原态，
           避免「UI 已置顶但窗口未置顶」的假成功；其余按钮维持 fix30 口径。 */
        if(id!=='btnPin')b.style.display='none';
        try{toast(label+' 在当前桌面环境不可用');}catch(_){console.warn('[JU] caught error',_);}
      }
    };
  });
  /* 【fix29-2】启动即回填置顶态：窗口本已置顶时按钮保持高亮，避免首帧状态与真实窗口不一致 */
  try{
    const w0:any=(window as any).__TAURI__&&(window as any).__TAURI__.window;
    const cur0:any=w0&&(w0.getCurrentWindow?w0.getCurrentWindow():(w0.getCurrent?w0.getCurrent():null));
    if(cur0&&cur0.isAlwaysOnTop)cur0.isAlwaysOnTop().then(syncPin).catch(()=>{/* 非桌面环境：保持未置顶 */});
  }catch(e){/* 窗口 API 不可用：保持未置顶 */}
  /* 【fix33-8 · ISSUE-014/015】顶栏右侧按钮不挂任何 mousedown / pointerdown 监听（与 bindTopbar
     开头一致）：按钮不是 drag target，阻断只会切断 document 级浮窗外部关闭。拖拽区仍由
     index.html 的 #topbar / #tbClock 承担（fix27 行为不变；#tbNav 无 drag-region，fix31 用例锁定 0）。 */
  /* 【fix40-1】关闭按钮不再弹「关闭JU？」确认：先等关闭备份落盘（最多 1.5s），再直接退出 */
  $('#btnClose')!.onclick=async()=>{
    /* 【fixreview5-5】备份只走原生 close-requested 单通道，按钮不再竞速触发 backupOnClose */
    try{
      /* 【review12-fix · #3/#4】自定义 X 必须与 Alt+F4 同链路：优先调用 session 暴露的
         close-requested 处理函数（备份/落盘/配额一致），不得直调底层 close() 旁路拦截。 */
      const requestClose:any=(_win as any).__JU_REQUEST_CLOSE__;
      if(typeof requestClose==='function'){ await requestClose(); return; }
      /* 【fix1j · ISSUE-008】关闭链路未就绪时不得直调 api.close() 旁路原生 close-requested
         （备份 / 落盘 / 配额会被整链绕过）：先同步落盘，再提示二次点击，本次终止关闭。 */
      try{ (window as any).JU?.flushPersistNow?.(); }catch(e){ console.warn('[JU] caught error',e); }
      toast('关闭链路未就绪：数据已保存，请再点一次关闭');
      return;
    }catch(e){toast('关闭失败：窗口 API 不可用');}
  };
}
export function bindMainToggles(): void {
  /* FIX-R4-1: 折叠按钮加固——状态/标题/aria 同步，右栏折叠联动 body class */
  /* 【L15-W1 · 指令5】新增中部「同时折叠/展开」按钮 #btnToggleBoth；三钮统一由 CSS 控沉浸式淡化（opacity .2↔1）。 */
  const L=$('#btnToggleLeft')!,R=$('#btnToggleRight')!,B=$('#btnToggleBoth')!;
  /* R28 · 收起态自愈：`.collapsed` 的位移靠 margin-left:calc(var(--sidebar-left-w) * -1)。
     若该变量是不可解析长度（旧 UI 快照写入非 px / 外部注入样式清空），整个 calc 失效 ⇒ margin-left 回落 0
     ⇒ 视觉上「点了没收起」。此处在收起时探测可解析性，仅在不可解析时以实测宽度回写 px（可解析时保持 calc，
     展开态宽度仍随 --ui-scale 缩放，行为零变更）。 */
  const _sbLeftWMarginResolvable=()=>{
    try{
      const d=document.createElement('div');
      d.style.cssText='position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;margin-left:calc(var(--sidebar-left-w) * -1)';
      document.body.appendChild(d);
      const mv=getComputedStyle(d).marginLeft;d.remove();
      return /^-?\d+(\.\d+)?px$/.test(mv)&&parseFloat(mv)<0;
    }catch(e){return true;} /* 探测异常时不写值，保持既有行为 */
  };
  const syncL=()=>{const sb=$('#sidebarLeft') as HTMLElement;const c=sb.classList.contains('collapsed');if(c&&!_sbLeftWMarginResolvable()){const w=sb.offsetWidth;if(w>0)document.documentElement.style.setProperty('--sidebar-left-w',Math.round(w)+'px');}deps.ui.sidebarLeftCollapsed=c;document.body.classList.toggle('sb-left-collapsed',c);L.classList.toggle('collapsed',c);L.title=c?'展开左侧栏':'收起左侧栏';L.setAttribute('aria-pressed',c?'false':'true');};
  const syncR=()=>{const sb=$('#sidebarRight') as HTMLElement;const c=sb.classList.contains('collapsed');deps.ui.sidebarRightCollapsed=c;document.body.classList.toggle('sb-right-collapsed',c);R.classList.toggle('collapsed',c);R.title=c?'展开右侧栏':'收起右侧栏';R.setAttribute('aria-pressed',c?'false':'true');};
  const syncB=()=>{if(!B)return;const both=$('#sidebarLeft')!.classList.contains('collapsed')&&$('#sidebarRight')!.classList.contains('collapsed');B.classList.toggle('collapsed',both);B.title=both?'展开左右侧栏':'同时折叠左右侧栏';B.setAttribute('aria-pressed',both?'true':'false');};
  /* 【fix18-patch1 · 侧栏折叠后视图重算】侧栏折叠会改变 #main 可用宽度（fix18-patch1 已把折叠位移
     从负 margin 改为 0 margin，主内容区从视口 x=0 起铺满）。宽度变化后必须显式通知视图：
       ① window resize —— 图谱滚动可视区 / 依赖 resize 的组件同步；
       ② 日历时间网格与多维表格外层滚动条复位到最左 —— 折叠后视口变宽，旧 scrollLeft 会让
          左侧时间/日期列或首列留在可视区外（贴边/截断的另一种表现）；
       ③ 思维导图 `_recenter`（views/mindmap 提供的等效 resize 钩子）按新容器宽度重新居中；
       ④ 图谱按新容器宽度重渲染（views/graph 的 W/H 在渲染期取 #content 实测值）。
     口径：只调用产品对外入口 deps.renderMain / deps.setForceRender，不触碰 window.JU.ui() 返回值。 */
  const notifyViewResize = () => {
    try { window.dispatchEvent(new Event('resize')); } catch(e){/* 旧内核不支持 Event 构造：忽略 */}
    try {
      const tg=document.querySelector('.cal-tg-scroll') as HTMLElement|null;
      if(tg)tg.scrollLeft=0;
      const tw=document.querySelector('.db-table-wrap') as HTMLElement|null;
      if(tw)tw.scrollLeft=0;
      const c=document.getElementById('content');
      if(c)c.scrollLeft=0;
      const mm=document.querySelector('.mm-wrap') as any;
      if(mm&&typeof mm._recenter==='function')mm._recenter();
      const view=deps.ui&&deps.ui.view;
      if(view==='graph'&&typeof deps.renderMain==='function'){deps.setForceRender(true);deps.renderMain();}
    } catch(e){console.warn('[JU] caught error',e);}
  };
  /* 等 width/margin 过渡（--t-base 0.2s）结束后再量容器宽度，避免按旧宽度重算画布 */
  const scheduleViewResize = () => { setTimeout(notifyViewResize, 240); };
  /* 【D-03】折叠钮改为 addEventListener 绑定：`el.onclick = fn` 会被后续 DOM 重渲染 / 属性覆盖冲掉，
     表现为「点了没收起」。同时补按压兜底（旧内核无 PointerEvent 时降级 mousedown）。 */
  bindClick(L,()=>{$('#sidebarLeft')!.classList.toggle('collapsed');syncL();syncB();deps.saveUI();scheduleViewResize();},{pressFallback:true});
  bindClick(R,()=>{$('#sidebarRight')!.classList.toggle('collapsed');syncR();syncB();deps.saveUI();scheduleViewResize();},{pressFallback:true});
  if(B)bindClick(B,()=>{const both=$('#sidebarLeft')!.classList.contains('collapsed')&&$('#sidebarRight')!.classList.contains('collapsed');const to=!both;$('#sidebarLeft')!.classList.toggle('collapsed',to);$('#sidebarRight')!.classList.toggle('collapsed',to);syncL();syncR();syncB();deps.saveUI();scheduleViewResize();},{pressFallback:true});
  /* 【D-03 · 初始可见性】折叠钮必须初始可见（只由 CSS 控淡化，不得被前序绑定/重建写成 display:none） */
  [L,R,B].forEach((b)=>{if(!b)return;(b as HTMLElement).hidden=false;try{(b as HTMLElement).style.removeProperty('display');}catch(e){console.warn('[JU] caught error',e);}});
  syncL();syncR();syncB();
  /* 【fixed15 A1】侧栏拖动调宽：左栏（G-2：mousemove 以 requestAnimationFrame 节流提交） */
  (function(){
    const handle=$('#sidebarResize');if(!handle)return;
    let startX=0,startW=0,resizing=false,raf=0,lastEv: MouseEvent|null=null;
    handle.addEventListener('mousedown',e=>{
      e.preventDefault();e.stopPropagation();
      resizing=true;startX=e.clientX;
      startW=document.getElementById('sidebarLeft')!.offsetWidth;
      handle.classList.add('dragging');document.body.classList.add('sb-resizing');
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
    function apply(e: MouseEvent){
      const cap=Math.min(480,window.innerWidth*0.3);
      let w=startW+(e.clientX-startX);
      w=Math.max(140,Math.min(cap,w));
      /* FIX-UI-7: 拖到上限时给拖动线"到顶"反色提示，避免 silent clamp */
      handle!.classList.toggle('at-limit',w>=cap-1);
      document.documentElement.style.setProperty('--sidebar-left-w',w+'px');
      deps.ui.sidebarLeftWidth=w;
    }
    function onMove(e: MouseEvent){
      if(!resizing)return;
      lastEv=e;
      if(raf)return;
      raf=requestAnimationFrame(()=>{raf=0;if(lastEv){const ev=lastEv;lastEv=null;apply(ev);}});
    }
    function onUp(){
      if(!resizing)return;resizing=false;
      if(raf){cancelAnimationFrame(raf);raf=0;if(lastEv){const ev=lastEv;lastEv=null;apply(ev);}}
      handle!.classList.remove('dragging');document.body.classList.remove('sb-resizing');
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      deps.saveUI();
    }
  })();
  /* FIX-R4-2: 侧栏拖动调宽：右栏（对称实现，向左拖变宽；G-2：同样以 rAF 节流） */
  (function(){
    const handle=$('#sidebarRightResize');if(!handle)return;
    let startX=0,startW=0,resizing=false,raf=0,lastEv: MouseEvent|null=null;
    handle.addEventListener('mousedown',e=>{
      e.preventDefault();e.stopPropagation();
      resizing=true;startX=e.clientX;
      startW=document.getElementById('sidebarRight')!.offsetWidth;
      handle.classList.add('dragging');document.body.classList.add('sb-resizing');
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
    function apply(e: MouseEvent){
      const cap=Math.min(340,window.innerWidth*0.25);
      let w=startW+(startX-e.clientX);
      w=Math.max(180,Math.min(cap,w));
      handle!.classList.toggle('at-limit',w>=cap-1);
      document.documentElement.style.setProperty('--sidebar-right-w',w+'px');
      deps.ui.sidebarRightWidth=w;
    }
    function onMove(e: MouseEvent){
      if(!resizing)return;
      lastEv=e;
      if(raf)return;
      raf=requestAnimationFrame(()=>{raf=0;if(lastEv){const ev=lastEv;lastEv=null;apply(ev);}});
    }
    function onUp(){
      if(!resizing)return;resizing=false;
      if(raf){cancelAnimationFrame(raf);raf=0;if(lastEv){const ev=lastEv;lastEv=null;apply(ev);}}
      handle!.classList.remove('dragging');document.body.classList.remove('sb-resizing');
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      deps.saveUI();
    }
  })();
}

/**
 * 设置面板骨架（与 `index.html` 同款四区块结构）
 *
 * 区块划分（区块之间以 `<hr>` 分割线隔开，同类型控件聚拢，全局不新增小标题）：
 *   一 · 开关组与数据操作　二 · 常规交互　三 · 账户与网络　四 · 支持与反馈
 *
 * 区块三 / 区块四允许为空容器：许可证、云端同步、本地崩溃日志三行分别由
 * `bindLicenseActivation` / `bindPublishTools` / `bindCrashLogRow` 按
 * `data-settings-slot` 挂载点落位（渲染与行为分离，绑定函数保持幂等）。
 */
const SETTINGS_SKELETON: string = [
  /* 【fix14】头部「⚙」emoji → 与 index.html 逐字同源的齿轮 SVG（保证静态骨架与兜底骨架零漂移） */
  '<div class="panel-head"><svg class="head-gear" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>设置<button class="close" id="settingsClose" type="button">✕</button></div>',
  '<div class="settings-body">',
  '<div class="settings-section" id="setSectionData" data-settings-slot="data">',
  /* 【fix9 · REMOVE】「全库加密」行按产品决策移除（Q1=只补 handler；补绑需新增加密确认框 + 设密码面板）。
     取证与回滚点见 90过程材料/tmp_compare/fix7/settings_bind_audit.log §7；与 index.html 静态标记同步 */
  /* 【fix10 · 本轮恢复】Q1=允许新增 UI ⇒ 骨架模板同步恢复该行（与 index.html 逐字同款），
     handler 见 boot.bindSettingsRows()（canonical 18835-18864 + 21822 + 21885） */
  '<div class="settings-item"><label>全库加密</label><span class="settings-ctrl"><span class="switch" id="setEncrypt"></span></span></div>',
  '<div class="settings-item"><label>系统提醒通知</label><span class="settings-ctrl"><span class="switch" id="setReminder"></span></span></div>',
  '<div class="settings-item"><label>关闭应用时自动备份全部数据</label><span class="settings-ctrl"><span class="switch" id="setAutoBackupClose"></span></span></div>',
  /* 同行布局：标签在左，「恢复默认路径」文字链在右（.settings-ctrl 统一 8px 间距） */
  '<div class="settings-item" id="rowBackupDir"><label>备份位置</label>',
  /* `#setBackupDirVal` 为旧版 `juApplyBackupDirUI()` 的落点，保留隐藏节点避免外部脚本空引用；fix9 起由 boot.bindSettingsRows 回填 */
  /* 【fix9 · REMOVE】「浏览」按钮按产品决策移除（Q1=只补 handler；补绑需新增 filechooser 目录选择链路）。回滚点见 settings_bind_audit.log §7 */
  /* 【fix10 · 本轮恢复】行内恢复「浏览」按钮；handler 见 pickBackupDir（canonical 22268：
     desktop dialog.open → showDirectoryPicker → webkitdirectory） */
  '<div class="settings-ctrl"><button class="btn" id="btnBackupDirPick" type="button">浏览</button><button class="settings-link" id="btnBackupDirReset" type="button">恢复默认路径</button><span class="ju-dirval" id="setBackupDirVal" hidden>默认路径</span></div>',
  '</div>',
  '<div class="settings-item"><label>从备份恢复</label><div class="settings-ctrl"><button class="btn" id="btnRestoreBackup" type="button">导入备份（JSON）</button></div></div>',
  '</div>',
  '<hr class="settings-sep" />',
  '<div class="settings-section" id="setSectionGeneral" data-settings-slot="general">',
  '<div class="settings-item"><label>字号</label><div class="settings-ctrl"><input type="range" id="setFontSize" min="70" max="200" step="5" value="100"><span class="size-val" id="setFontSizeVal">100%</span></div></div>',
  /* 【fix9 · REMOVE】「快捷键 · 查看」行按产品决策移除（Q1=只补 handler；补绑需新增快捷键说明面板）。回滚点见 settings_bind_audit.log §7 */
  /* 【fix10 · 本轮恢复】恢复该行；handler 见 showHelp（canonical 18868：.modal-overlay 快捷键速查面板） */
  '<div class="settings-item"><label>快捷键</label><div class="settings-ctrl"><button class="btn" id="setShortcuts" type="button">查看</button></div></div>',
  '</div>',
  '<hr class="settings-sep" />',
  '<div class="settings-section" id="setSectionAccount" data-settings-slot="account"></div>',
  '<hr class="settings-sep" />',
  '<div class="settings-section" id="setSectionSupport" data-settings-slot="support">',
  '<div class="settings-item"><label>帮助</label><div class="settings-ctrl"><button class="btn" id="btnViewManual" type="button">查看手册</button></div></div>',
  /* 【fix9 · REMOVE】「反馈与错误上报」行按产品决策移除（Q1=只补 handler；补绑需新增反馈入口）。
     本地崩溃日志导出（#btnViewCrashLogs）仍由 bindCrashLogRow 落位到本区块，未受影响。回滚点见 settings_bind_audit.log §7 */
  /* 【fix10 · 本轮恢复】恢复该行；handler 见 openFeedbackDialog（canonical 22415：反馈模态 + 日志导出/复制/反馈包） */
  '<div class="settings-item"><label>反馈与错误上报</label><div class="settings-ctrl"><button class="btn" id="btnFeedback" type="button">反馈</button></div></div>',
  '</div>',
  '</div>',
].join('');

/**
 * 设置面板获取器（幂等）
 *
 * 契约：
 *   - `#settingsPanel` 存在时直接返回；不存在时按四区块结构（`.panel` +
 *     `.panel-head` + `.settings-body` + 4 × `.settings-section`）创建一个隐藏面板并挂到
 *     `document.body`，保证迁移期骨架（index.html 尚无设置面板）下各设置行仍能落位；
 *   - 面板头补齐产品件同款关闭钮 `<button class="close" id="settingsClose">✕</button>`，
 *     使 `bindSettingsPanel()` 有真实关闭入口（此前只有标题，面板一旦打开无法关闭）；
 *   - 不改变可见性：新建面板固定 `hidden = true`，由设置入口自行显隐。
 */
function ensureSettingsPanel(): HTMLElement | null {
  let panel = document.getElementById('settingsPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.className = 'panel';
    panel.hidden = true;
    panel.innerHTML = SETTINGS_SKELETON;
    document.body.appendChild(panel);
  }
  return panel;
}

/**
 * 设置区块挂载点解析（渲染与行为分离：绑定函数只管往「自己的区块」放行）
 *
 * 解析顺序：`[data-settings-slot="<slot>"]` → `.settings-body` → `.panel-body` → 面板根。
 * 后三级兜底用于迁移期骨架 / 测试注入壳（旧结构只有 `.panel-body`），语义与拆分前一致：
 * 找不到区块时按原路径追加到面板主体，绝不抛错。
 */
function settingsSlot(panel: HTMLElement, slot: 'data' | 'general' | 'account' | 'support'): HTMLElement {
  const bySlot = panel.querySelector('[data-settings-slot="' + slot + '"]') as HTMLElement | null;
  if (bySlot) return bySlot;
  return (
    (panel.querySelector('.settings-body') as HTMLElement | null) ||
    (panel.querySelector('.panel-body') as HTMLElement | null) ||
    panel
  );
}

/**
 * 设置面板开合状态（第二轮 · 幂等 toggle 的唯一事实来源）。
 *
 * 语义（见 `bindSettingsPanel` 注释）：**幂等开启**——重复点击顶栏齿轮只会保持打开、
 * 不会「翻转到关闭」；关闭只经 `#settingsClose` 或 Esc。
 */
let settingsPanelOpen = false;

/**
 * 公开 API · 打开设置面板（幂等）。
 *
 * 装配层 / 回归夹具（含 Playwright 的 `__feWire`）**不再改写 `#btnSettings.onclick`**，
 * 改为调用本函数 —— 属性赋值会整段替换产品处理器，是「先开再关」双绑定的历史来源。
 *
 * @returns 面板存在并已打开 → true；面板缺失（迁移期骨架）→ false
 */
export function openSettingsPanel(): boolean {
  const p = document.getElementById('settingsPanel') as HTMLElement | null;
  if (!p) return false;
  p.hidden = false;
  p.classList.add('on');
  settingsPanelOpen = true;
  /* 【fix31】boot 期 initSettingsDrag 会回放 juju.settingspos（旧窗口尺寸 / 旧拖动坐标），
     面板隐藏时 ensureElInViewport 因 0 尺寸直接返回 ⇒ 打开后整体留在屏外，用户视为「没反应」。
     此处按显示后的实测矩形判定，仅当中心点越界时重新按 #btnSettings 锚定并夹紧视口。 */
  try {
    const r = p.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (r.width <= 0 || r.height <= 0 || cx < 0 || cx > window.innerWidth || cy < 0 || cy > window.innerHeight) {
      p.style.left = ''; p.style.top = ''; p.style.bottom = ''; p.style.right = '';
      const g = document.getElementById('btnSettings');
      const gr = g ? g.getBoundingClientRect() : null;
      const w = r.width || 320, h = r.height || 160;
      const left = gr ? Math.max(8, Math.min(gr.right - w, window.innerWidth - w - 8)) : Math.max(8, (window.innerWidth - w) / 2);
      const top = gr ? Math.max(8, Math.min(gr.bottom + 6, window.innerHeight - h - 8)) : 64;
      p.style.left = left + 'px'; p.style.top = top + 'px'; p.style.bottom = 'auto';
    }
  } catch (e) { console.warn('[JU] caught error', e); }
  return true;
}

/** 公开 API · 关闭设置面板（幂等）。 */
export function closeSettingsPanel(): boolean {
  const p = document.getElementById('settingsPanel') as HTMLElement | null;
  if (!p) return false;
  p.classList.remove('on');
  p.hidden = true;
  settingsPanelOpen = false;
  return true;
}

/** 只读状态（诊断 / 回归断言用，不改变任何状态）。 */
export function isSettingsPanelOpen(): boolean {
  return settingsPanelOpen;
}

/**
 * 批次 CW · 设置面板开关绑定（修复「顶栏齿轮点了没反应」的绑定断链）
 *
 * 【第二轮 · #btnSettings 契约解耦（方案 A）】
 *   历史机制：产品侧用 `gear.onclick = openPanel` **属性赋值**，而装配层 / 回归夹具也用
 *   `gear.onclick = fn` 接管 —— 属性赋值会整段替换上一个处理器；若产品侧同时改挂
 *   addEventListener，则两者对同一次点击各跑一次（先开再关）⇒ 面板永远打不开。
 *
 *   现行契约（单一处理链，全程无属性赋值）：
 *     - `#btnSettings` → `bindClick`（addEventListener；重复绑定=替换，不叠加）；
 *     - 点击语义 = **幂等开启**（`openSettingsPanel`）：连点多次只保持打开、绝不误关；
 *     - 关闭入口仅两条：`#settingsClose` 与 `Esc`（无模态弹窗时）；
 *     - 对外暴露 `window.JU.openSettings()` / `closeSettings()`，装配层与测试改用公开 API；
 *     - 面板一律按 id 现取（不缓存闭包引用）：面板被重建 / 替换后点击依然作用于当前节点。
 */
export function bindSettingsPanel(): void {
  const panel = ensureSettingsPanel();
  if (!panel) return;
  const gear = document.getElementById('btnSettings') as HTMLElement | null;
  /* 【fix32-12】按压不冒泡由 bindTopbar 的 `.tb-right .tb-wbtn` 权威监听统一承担（此处不重复挂钩）；
     点击只走本处理器（不叠加属性赋值） */
  /* addEventListener + 幂等开启：单次点击只开一次，连点不翻转 */
  bindClick(gear, (e) => { e.stopPropagation(); openSettingsPanel(); });
  const closeBtn = document.getElementById('settingsClose') as HTMLElement | null;
  bindClick(closeBtn, () => { closeSettingsPanel(); });
  if (!(document as any).__juSettingsEscBound) {
    (document as any).__juSettingsEscBound = true;
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      /* 产品件 L23 口径：有模态弹窗时 ESC 归弹窗处理（帮助手册等），面板不抢 ESC */
      if (document.querySelector('.modal-overlay')) return;
      const p = document.getElementById('settingsPanel');
      if (p && p.classList.contains('on')) {
        e.preventDefault();
        closeSettingsPanel();
      }
    });
  }
}

/**
 * M5-1b · 批次 CT · 设置面板「本地崩溃日志」行（`#btnViewCrashLogs`）
 *
 * 契约：
 *   - 行结构固定为 `settings-item` + `.settings-ctrl > button.btn#btnViewCrashLogs`，**只负责渲染**，
 *     落位到区块四（`[data-settings-slot="support"]`，支持与反馈）；
 *     点击语义（桌面端导出 `crash_dumps` / Web 端导出 `window.__juLog`）由
 *     `app/boot.ts` 的 `bindCrashLogExport()` 绑定，渲染与行为分离；
 *   - 幂等：重复调用只补行；面板缺失时先创建隐藏面板再落位。
 *   - 匿名错误上报开关已按产品决策移除（2026-10-26）：不再渲染 `#setErrorReporting`，
 *     也不再读写 `ui.errorReporting`。
 */
export function bindCrashLogRow(): void {
  const panel = ensureSettingsPanel();
  if (!panel) return;
  if (document.getElementById('btnViewCrashLogs')) return;
  const host = settingsSlot(panel, 'support');
  const row = document.createElement('div');
  row.className = 'settings-item';
  row.innerHTML =
    '<label>本地崩溃日志</label>' +
    '<div class="settings-ctrl"><button class="btn" id="btnViewCrashLogs" type="button">查看与导出</button></div>';
  host.appendChild(row);
}

/**
 * Track B · 设置面板「许可证激活」区块
 *
 * 契约：
 *   - 面板存在（`#settingsPanel`）时把输入框 / 激活按钮追加到区块三
 *     （`[data-settings-slot="account"]`，账户与网络），右侧控件组统一 `.settings-ctrl`；
 *     骨架壳尚无设置面板时创建一个隐藏面板，待设置入口接入后直接复用；
 *   - 点「激活」→ `core/license.verifyLicense()`（WebCrypto ECDSA P-256 验签 + 过期校验）
 *     → 成功写 localStorage 授权码、置 `ui.isPro = true`、提示「激活成功」并刷新页面
 *       （刷新后由 boot 复核授权码恢复 Pro 状态）；
 *   - 失败仅提示「授权码无效或已过期」，不写入任何状态；
 *   - 幂等：重复调用只补一次行、只重绑一次处理器。
 */
export function bindLicenseActivation(): void {
  const panel = ensureSettingsPanel();
  if (!panel) return;
  if (!document.getElementById('licenseKey')) {
    const host = settingsSlot(panel, 'account'); /* 区块三 · 账户与网络 */
    const row = document.createElement('div');
    /* 同行布局：标签在左，输入框（100px）/ 激活按钮 / 状态文案由 .settings-ctrl 右侧成组（gap 8px） */
    row.className = 'settings-item';
    row.id = 'rowLicense';
    const label = document.createElement('label');
    label.textContent = '许可证激活';
    /* 右侧控件组统一 `.settings-ctrl`（flex + nowrap + gap 8px + margin-left:auto），
       输入框宽度由 CSS 收敛到 100px（flex:0 0 auto，不参与压缩），
       输入框与「激活」按钮高度由 CSS 统一 28px（border-box）并垂直居中，
       此处不留任何硬编码内联样式，避免与 CSS 打架造成基线错位 */
    const ctrl = document.createElement('div');
    ctrl.className = 'settings-ctrl';
    const input = document.createElement('input');
    input.id = 'licenseKey';
    input.type = 'text';
    input.placeholder = '粘贴授权码';
    input.autocomplete = 'off';
    input.className = 'settings-input'; /* 宽度 / 边框 / 28px 高度全部由 `#settingsPanel .settings-input` 提供 */
    const btn = document.createElement('button');
    btn.id = 'licenseActivate';
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = '激活';
    const status = document.createElement('span');
    status.id = 'licenseStatus';
    status.className = 'settings-hint';
    /* 字号 / 颜色均由 #settingsPanel 与 .settings-hint 统一管理，不再写内联样式 */
    ctrl.appendChild(input);
    ctrl.appendChild(btn);
    ctrl.appendChild(status);
    row.appendChild(label);
    row.appendChild(ctrl);
    host.appendChild(row);
  }
  const inputEl = document.getElementById('licenseKey') as HTMLInputElement | null;
  const btnEl = document.getElementById('licenseActivate') as HTMLButtonElement | null;
  const statusEl = document.getElementById('licenseStatus');
  if (!inputEl || !btnEl) return;
  const sync = (): void => {
    /* 未激活时不再显示「免费版」字样（产品决策：清理冗余版本文案），状态位留空 */
    if (statusEl) statusEl.textContent = deps.ui.isPro === true ? 'Pro 已激活' : '';
  };
  btnEl.onclick = async (): Promise<void> => {
    const key = String(inputEl.value || '').trim();
    if (!key) { toast('请输入授权码'); return; }
    btnEl.disabled = true;
    let ok = false;
    try { ok = await verifyLicense(key); } catch (e) { ok = false; }
    btnEl.disabled = false;
    if (!ok) { toast('授权码无效或已过期'); sync(); return; }
    try { localStorage.setItem(LICENSE_STORAGE_KEY, key); }
    catch (e) { toast('授权码保存失败'); return; }
    deps.ui.isPro = true;
    sync();
    toast('激活成功');
    setTimeout(() => { try { location.reload(); } catch (e) { console.warn('[JU] license reload failed', e); } }, 300);
  };
  sync();
}

/**
 * Track B · M0-15 · 设置面板「云端同步」区块
 *
 * 契约：
 *   - 幂等补一行：`#btnSyncPush` / `#btnSyncPull`（同步到云 / 从云端拉取），
 *     落位到区块三（`[data-settings-slot="account"]`，账户与网络）；
 *   - 同步按钮只转发到 `deps.syncToCloud` / `deps.syncFromCloud`：**Pro 门槛判定不在 UI 层**，
 *     由 core/persist 统一拦截并 toast「云端同步为 Pro 版专属功能」，避免两处口径漂移；
 *   - 点击期间按钮禁用（防重复请求），结束后按钮恢复可用；结果反馈统一走 toast
 *     （产品决策 2026-10-26：右侧控件组内的「未同步 / 已同步」状态文案属冗余信息，
 *      已从 DOM 中移除，不再渲染 `#syncStatus` 节点）；
 *   - 依赖缺失（未注入端口）时保持 noop，不抛错。
 *   - 静态网页导出（`#btnExportStaticHtml`）已按产品决策整体移除（2026-10-26）。
 */
export function bindPublishTools(): void {
  const panel = ensureSettingsPanel();
  if (!panel) return;
  if (!document.getElementById('btnSyncPush')) {
    const host = settingsSlot(panel, 'account'); /* 区块三 · 账户与网络 */
    const row = document.createElement('div');
    /* 同行布局：标签在左，「同步到云 / 从云端拉取」由 .settings-ctrl 右侧成组（gap 8px） */
    row.className = 'settings-item';
    row.id = 'rowCloudSync';
    const label = document.createElement('label');
    label.textContent = '云端同步 (Pro)';
    const ctrl = document.createElement('div');
    ctrl.className = 'settings-ctrl';
    const push = document.createElement('button');
    push.id = 'btnSyncPush';
    push.type = 'button';
    push.className = 'btn';
    push.textContent = '同步到云';
    const pull = document.createElement('button');
    pull.id = 'btnSyncPull';
    pull.type = 'button';
    pull.className = 'btn';
    pull.textContent = '从云端拉取';
    /* 冗余状态文案节点已移除：控件组只保留两只按钮，宽度不再被「未同步」文本挤占 */
    ctrl.appendChild(push);
    ctrl.appendChild(pull);
    row.appendChild(label);
    row.appendChild(ctrl);
    host.appendChild(row);
  }
  /**
   * 【ISSUE-012】端点未配置（`SYNC_PUSH_URL` / `SYNC_PULL_URL` 均为空）时隐藏同步入口：
   *   - 节点仍保留在 DOM 内（功能移除守卫 test 依赖节点存在，只是不可见）；
   *   - 隐藏后不再绑定点击处理器，避免「看得见但点了没反应」或「隐藏按钮仍发请求」。
   */
  const rowEl = document.getElementById('rowCloudSync') as HTMLDivElement | null;
  let syncEnabled = true;
  try { syncEnabled = deps.isCloudSyncEnabled() !== false; } catch (e) { syncEnabled = true; }
  if (rowEl) {
    rowEl.hidden = !syncEnabled;
    rowEl.setAttribute('aria-hidden', syncEnabled ? 'false' : 'true');
    rowEl.style.display = syncEnabled ? '' : 'none';
  }
  if (!syncEnabled) return;
  const pushBtn = document.getElementById('btnSyncPush') as HTMLButtonElement | null;
  const pullBtn = document.getElementById('btnSyncPull') as HTMLButtonElement | null;
  const runSync = async (kind: 'push' | 'pull'): Promise<void> => {
    const btn = kind === 'push' ? pushBtn : pullBtn;
    const other = kind === 'push' ? pullBtn : pushBtn;
    if (btn) btn.disabled = true;
    if (other) other.disabled = true;
    /* 进度 / 结果反馈由 core 层 toast 统一承载，UI 不再写任何行内状态文本 */
    try {
      if (kind === 'push') await deps.syncToCloud(); else await deps.syncFromCloud();
    } catch (e) {
      console.warn('[JU] cloud sync failed', e);
    } finally {
      if (btn) btn.disabled = false;
      if (other) other.disabled = false;
    }
  };
  if (pushBtn) pushBtn.onclick = (): void => { void runSync('push'); };
  if (pullBtn) pullBtn.onclick = (): void => { void runSync('pull'); };
}

/* ============================================================
   M5-2 · 搜索框 Worker 化（防 10 万节点输入卡顿）
   ------------------------------------------------------------
   设计要点：
     1) 输入事件只做「去抖 + 投递」，主线程不遍历节点表；
     2) 节点表只在引用变化时随消息携带，Worker 侧常驻倒排索引，后续按键零克隆；
     3) Worker 不可用 / 超时 → 同步回落（功能不降级），诊断计数 `fallbacks` 可观测；
     4) 结果同时通过 `ju:search-result`（input 冒泡 + window）与 `window.__juSearchLast`
        发布，便于 UI 消费与 Playwright 取证；
     5) 绑定为显式调用（`bindSearchWorker(input)`），不改变既有搜索框行为；
        若输入框已有 `oninput`，先执行原处理器再执行本绑定。
   ============================================================ */

/** 搜索结果信封（附带查询原文与来源，供 UI / 测试直接消费） */
export interface SearchResultEnvelope extends SearchResponse {
  query: string;
  source: 'worker' | 'fallback';
}

/** 搜索框绑定选项 */
export interface SearchBindOptions {
  /** 节点表读取端口（默认 `JU.getState().nodes`） */
  getNodes?: () => Record<string, any>;
  /** 返回条数上限（默认 500） */
  limit?: number;
  /** 输入去抖（默认 40ms；Enter 立即执行） */
  debounceMs?: number;
  /** 单次 Worker 请求超时（默认 10000ms；超时回落同步检索） */
  timeoutMs?: number;
  /** 结果回调（与事件同口径） */
  onResult?: (res: SearchResultEnvelope) => void;
}

/** 搜索框绑定句柄 */
export interface SearchWorkerHandle {
  /** 预热：把当前节点表交给 Worker 建索引（不返回命中） */
  warmup: () => Promise<SearchResultEnvelope>;
  /** 执行一次检索（自动判断是否需要重传节点表） */
  search: (query: string) => Promise<SearchResultEnvelope>;
  /** 释放 Worker 并解绑事件 */
  dispose: () => void;
  /** 只读诊断视图 */
  diagnostics: () => {
    workerCreated: boolean;
    tasks: number;
    fallbacks: number;
    errors: string[];
    lastElapsedMs: number;
    lastTotal: number;
    lastEngine: string;
    lastCached: boolean;
  };
}

/** 默认节点读取：`JU.getState().nodes`（装配层已发布 `getState`） */
function defaultSearchNodes(): Record<string, any> {
  try {
    const J = (window as any).JU;
    if (J && typeof J.getState === 'function') {
      const st = J.getState();
      return (st && st.nodes) || {};
    }
  } catch (e) {
    console.warn('[JU] caught error', e);
  }
  return {};
}

/**
 * 把搜索框绑定到搜索 Worker。
 *
 * @param input   搜索输入框（`input` 事件触发检索，Enter 立即检索）
 * @param options 读取端口 / 上限 / 去抖 / 超时 / 回调
 */
export function bindSearchWorker(input: HTMLInputElement, options: SearchBindOptions = {}): SearchWorkerHandle {
  const getNodes = options.getNodes || defaultSearchNodes;
  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : 500;
  const debounceMs = typeof options.debounceMs === 'number' && options.debounceMs >= 0 ? options.debounceMs : 40;
  const timeoutMs = options.timeoutMs && options.timeoutMs > 0 ? Math.floor(options.timeoutMs) : 10_000;

  let worker: Worker | null = null;
  let disposed = false;
  let seq = 0;
  let lastNodesRef: any = null;
  let debounceTimer: any = 0;
  const pending = new Map<number, { resolve: (r: SearchResponse) => void; timer: any }>();
  const diagnostics = {
    workerCreated: false,
    tasks: 0,
    fallbacks: 0,
    errors: [] as string[],
    lastElapsedMs: 0,
    lastTotal: 0,
    lastEngine: '',
    lastCached: false,
  };

  /** 事件发布：input 冒泡即可抵达 window；输入框脱离文档时才补发 window 事件（避免重复派发） */
  function fire(type: string, detail: any): void {
    try {
      input.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
    } catch (e) {
      console.warn('[JU] caught error', e);
    }
    if (!input.isConnected) {
      try {
        (window as any).dispatchEvent(new CustomEvent(type, { detail }));
      } catch (e) {
        console.warn('[JU] caught error', e);
      }
    }
  }

  /** 同步回落：口径与 Worker 完全一致（searchNodes → 同一倒排 + includes 复核） */
  function syncFallback(query: string): SearchResponse {
    const nodes = getNodes() || {};
    const ids = searchNodes(nodes, query, limit);
    return {
      type: 'search-result',
      reqId: 0,
      ids,
      total: ids.length,
      scanned: Object.keys(nodes).length,
      elapsedMs: 0,
      engine: 'scan',
      cached: false,
      _fallback: true,
    };
  }

  function failPending(message: string): void {
    diagnostics.errors.push(message);
    pending.forEach((p, id) => {
      clearTimeout(p.timer);
      pending.delete(id);
      p.resolve(syncFallback(''));
    });
  }

  /** 懒创建 Worker（首次检索才创建，未搜索时零开销） */
  function ensureWorker(): Worker | null {
    if (disposed) return null;
    if (worker) return worker;
    if (typeof Worker === 'undefined') return null;
    try {
      worker = new SearchWorkerFactory();
      worker.onmessage = (ev: MessageEvent<SearchResponse>): void => {
        const res = (ev && ev.data) || null;
        if (!res || res.type !== 'search-result') return;
        const p = pending.get(res.reqId);
        if (!p) return; /* 超时已回落 / 已释放的过期响应 */
        pending.delete(res.reqId);
        clearTimeout(p.timer);
        diagnostics.tasks += 1;
        diagnostics.lastElapsedMs = res.elapsedMs;
        diagnostics.lastTotal = res.total;
        diagnostics.lastEngine = res.engine;
        diagnostics.lastCached = res.cached;
        if (res.error) diagnostics.errors.push(res.error);
        p.resolve(res);
      };
      worker.onerror = (ev: ErrorEvent): void => {
        const msg = String((ev && (ev.message || ev.type)) || 'worker error');
        worker = null;
        failPending(msg);
      };
      diagnostics.workerCreated = true;
    } catch (e) {
      diagnostics.errors.push(String((e && (e as Error).message) || e));
      worker = null;
    }
    return worker;
  }

  /** 投递一次检索；`withNodes` 为 true 时携带节点表快照（由 Worker 重建索引） */
  function post(query: string, withNodes: boolean): Promise<SearchResponse> {
    return new Promise<SearchResponse>((resolve) => {
      const w = ensureWorker();
      if (!w) {
        diagnostics.fallbacks += 1;
        resolve(syncFallback(query));
        return;
      }
      const id = ++seq;
      const timer = setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        diagnostics.fallbacks += 1;
        resolve(syncFallback(query));
      }, timeoutMs);
      pending.set(id, { resolve, timer });
      try {
        const msg: any = { type: 'search', reqId: id, query, limit };
        if (withNodes) {
          const nodes = getNodes() || {};
          msg.nodes = nodes;
          lastNodesRef = nodes;
        }
        w.postMessage(msg);
      } catch (e) {
        clearTimeout(timer);
        pending.delete(id);
        diagnostics.errors.push(String((e && (e as Error).message) || e));
        diagnostics.fallbacks += 1;
        resolve(syncFallback(query));
      }
    });
  }

  /** 执行检索并发布结果（节点表引用变化时自动重传） */
  async function run(query: string): Promise<SearchResultEnvelope> {
    const nodes = getNodes() || {};
    const withNodes = nodes !== lastNodesRef;
    input.dataset.searchState = 'searching';
    fire('ju:search-status', { query, state: 'searching' });
    const res = await post(query, withNodes);
    const env: SearchResultEnvelope = {
      ...res,
      query,
      source: res._fallback === true ? 'fallback' : 'worker',
    };
    (window as any).__juSearchLast = env;
    input.dataset.searchState = 'idle';
    fire('ju:search-result', env);
    if (options.onResult) {
      try {
        options.onResult(env);
      } catch (e) {
        console.warn('[JU] caught error', e);
      }
    }
    return env;
  }

  const prevOnInput = input.oninput;
  const onInput = (ev?: Event): void => {
    if (prevOnInput) {
      try {
        (prevOnInput as any).call(input, ev);
      } catch (e) {
        console.warn('[JU] caught error', e);
      }
    }
    const q = String(input.value || '');
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = 0;
    }
    if (!q.trim()) {
      input.dataset.searchState = 'idle';
      fire('ju:search-status', { query: q, state: 'idle' });
      return;
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = 0;
      void run(q);
    }, debounceMs);
  };

  const onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = 0;
    }
    void run(String(input.value || ''));
  };

  input.oninput = onInput as any;
  input.addEventListener('keydown', onKeyDown);

  return {
    warmup: () => run(''),
    search: (query: string) => run(query),
    dispose: () => {
      disposed = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = 0;
      }
      input.removeEventListener('keydown', onKeyDown);
      input.oninput = prevOnInput;
      pending.forEach((p, id) => {
        clearTimeout(p.timer);
        pending.delete(id);
      });
      try {
        if (worker) worker.terminate();
      } catch (e) {
        /* 已终止或无 Worker */
      }
      worker = null;
    },
    diagnostics: () => ({ ...diagnostics, errors: diagnostics.errors.slice() }),
  };
}
