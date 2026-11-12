/**
 * M1-1 · 批次 AI · 应用启动引导与全局事件绑定
 *
 * 来源：6.P0-T3基线/public/v2.0-t3.html（canonical，只读）
 *   - bindReminder / initReminder ................................................... 16933-16979
 *   - window 'error' / 'unhandledrejection' 全局兜底 ................................ 18448-18458
 *   - initPomo ..................................................................... 18496-18546
 *   - initFloatCalDrag ............................................................. 18634-18661
 *   - initSettingsDrag ............................................................. 18662-18687
 *   - boot ......................................................................... 22470-22791
 *   - DOMContentLoaded 启动分发 .................................................... 22792
 *   - 键盘可达性 roving tabindex IIFE（原独立 script 块）............................ 22794-22904
 *
 * 约束（零漂移）：数据装载分支顺序、加密/桌面壳回退链、sessionStorage 兜底窗口、
 *   subscribe 双通道（渲染调度 + 版本快照防抖）、时钟 interval 句柄化、多标签广播
 *   （BroadcastChannel + storage）、visibilitychange / beforeunload 清理链、
 *   JU.lifecycle 10 项释放登记与 pagehide 统一释放、全局 API 暴露契约逐字保留。
 *   仅作两类纯类型层处理：
 *     1) 尚未拆分的业务符号统一走 `BootDeps` 注入容器（与既有批次 bind*Deps 同款约定）。
 *     2) 模块级状态（IS_DESKTOP / _graphPositions / _reminderTimer / _graphWorker 等）
 *        以 getter / setter 端口承接（跨模块无法共享 `let` 绑定）。
 *
 * 受控结构差异（运行期语义等价，均记档）：
 *   - `bindSettings` / `bindTools` 两处重面板绑定（源 18775-19998 / 21422-22469，合计约
 *     2.2k 行、依赖 150+ 同作用域符号）仍以 `BootDeps` 端口承接，由各自模块在后续批次
 *     迁入时以真实实现回填；`boot()` 的调用位置与顺序不变。
 *   - 原 `bindReminder` / `initPomo` / `initFloatCalDrag` / `initSettingsDrag` 已在本文件
 *     逐字迁入，`musicVol` 保留为模块级可写单例（与产品同作用域语义一致）。
 */

import { $, pad, todayStr, esc } from '../core/utils';
/* 【D-07】bindClick：提醒铃等顶栏按钮统一 addEventListener 绑定（不再用 el.onclick 属性赋值） */
/* 【fix10】appConfirm / _modalStack / _syncAppInert：4 项恢复 UI 的模态链路（与 canonical 同一套栈语义） */
import { bindClick, appConfirm, _modalStack, _syncAppInert } from '../ui/common';
/* 【fix10】#setEncrypt 设密码面板的真实写入通道（core/crypto 单一来源；与 session.saveUI 同一密文格式） */
import { writeEncryptedStore } from '../core/crypto';
/* 【review12 · ISSUE-001】主库可读时残留 preimport 快照一次性清除（不再等待下次灾备消费） */
import { purgeLocalCopy } from '../core/local-copies';
/* Track B · 启动复核 localStorage 中的离线授权码（验签通过才置 ui.isPro） */
import { restoreLicense } from '../core/license';
/**
 * M1-2 · 批次 AQ：持久化 / 广播的常量与单例由 core/persist 单一供给。
 * 此处直接引用真实模块，保证 boot 装配的 `STORE_BC_INSTANCE` 与 `_broadcastRev` 落盘广播
 * 使用**同一个** BroadcastChannel 实例（避免同源双通道造成重复合并）。
 */
import { STORE_KEY, PENDING_SYNC_KEY, STORE_BC_NAME, initStoreBc, setStoreBcInstance } from '../core/persist';
/**
 * M5-1a / M5-1b · 桌面壳增强通道（自动更新检查 + 崩溃包采集）。
 * 两者均为「增强能力」：未接入桌面壳或不满足前置条件时静默跳过，不阻断启动链路。
 */
import { checkForUpdates, isTauriShell, UPDATER_ACTIVE } from './updater';
import {
  sendCrashReport,
  getErrorAppVersion,
  getErrorLog,
  downloadJsonText,
  readCrashDumps,
} from '../core/errors';

/* ============================================================
   依赖注入容器
   ============================================================ */
export interface BootDeps {
  /* ── 存储键 / 通道名 ── */
  PENDING_KEY: string;
  PENDING_SYNC_KEY: string;
  REMIND_SENT_KEY: string;
  STORE_KEY: string;
  ENC_KEY: string;
  STORE_BC_NAME: string;

  /* ── 运行时状态（跨模块 let 绑定以端口承接） ── */
  ui: any;
  getState: () => any;
  isDesktop: () => boolean;
  setIsDesktop: (v: boolean) => void;
  getGraphPositions: () => any;
  setGraphPositions: (v: any) => void;
  getStoreBc: () => any;
  setStoreBc: (v: any) => void;
  getGraphWorker: () => any;
  getL7YieldCh: () => any;
  setL7YieldCh: (v: any) => void;
  getL7YieldQ: () => any;
  getSyncAppInertObserver: () => any;
  setSyncAppInertObserver: (v: any) => void;
  getReminderTimer: () => any;
  setReminderTimer: (v: any) => void;
  getEncFallbackTimer: () => any;
  setEncFallbackTimer: (v: any) => void;
  setLastEncPayload: (v: any) => void;
  getPomoState: () => any;
  getLogTimers: () => any;
  getL14LongtaskGate: () => any;

  /* ── 数据装载 / 持久化 / 加密 ── */
  detectDesktop: () => boolean;
  desktopInvoke: (cmd: string, args?: any) => Promise<any>;
  dsLoadState: () => Promise<any>;
  promptUnlock: (payload?: any) => Promise<any>;
  migrateOrBackup: (st: any) => any;
  migrateOrFallback: (st: any) => any;
  migrateStateObject: (st: any) => any;
  defaultState: () => any;
  hasEncryptedStore: () => boolean;
  loadState: () => any;
  loadAutoBackup: () => any;
  loadAutoBackupAsync: () => Promise<any>;
  loadUI: () => void;
  loadUIEncrypted: () => Promise<void>;
  applyUIFields: (u: any) => void;
  applyScale: () => void;
  initStore: (initial: any) => void;
  ensureCalendarRoot: () => void;
  VDB: { ensure: () => Promise<any> };
  migrateVersionsFromLS: () => Promise<any>;
  /** 全量立即落盘（对应产品 `persistNow()`；启动成功后的初始落盘由此完成） */
  persistNow: () => void;
  /** 【review14-01 · ISSUE-001】可等待落盘：关闭加密前确认真实明文已写盘（失败即回滚） */
  persistNowAwait: () => Promise<boolean>;
  flushPersistNow: () => void;
  flushGraphPositions: () => void;
  takeVersionSnapshot: () => void;
  recoverPendingEncrypted: () => Promise<any> | any;
  encryptState: (data: any, key: any) => Promise<any>;
  decryptState: (payload: any, key: any) => Promise<any>;
  readEncryptedStore: () => any;
  mergeRemoteIfNewer: (st: any) => void;
  onRemoteStoreChange: (raw: any) => void;
  flushPendingSession: () => void;
  flushPendingLogs: () => void;
  reportError: (type: string, info: any) => void;
  errMsg: (e: any) => string;
  applyModuleConfig: () => void;

  /* ── 渲染与派生面板 ── */
  renderMain: () => void;
  renderFloatCal: () => void;
  updateRightSidebar: () => void;
  updateSidebarActiveState: () => void;
  updateEncryptSwitch: () => void;
  updateRemindBadge: () => void;
  refreshRemindStatus: () => void;
  checkDueReminders: () => void;
  remindersSupported: () => boolean;
  toggleRemindPanel: (show?: any) => void;
  initReminder: () => void;
  showLockOverlay: () => void;
  floatCalVisible: () => boolean;
  ensureElInViewport: (el: any) => void;
  setActiveKey: (k: string) => void;
  setFloatCalVisible: (visible: boolean, persist?: boolean) => void;
  /** UI 状态落盘（对应产品 `saveUI()`） */
  saveUI: () => void;
  /** 强制重渲染（对应产品 `forceRender()`） */
  forceRender: () => void;

  /* ── 主题 ── */
  applyTheme: (t: string) => void;
  applySystemTheme: () => void;

  /* ── 全局绑定与浮窗 / 模块初始化 ── */
  bindTopbar: () => void;
  bindSidebar: () => void;
  bindTools: () => void;
  bindMainToggles: () => void;
  bindRightSidebar: () => void;
  bindSettings: () => void;
  bindTheme: () => void;
  initJuDnd: () => void;
  initJuModules: () => void;
  initJuSlides: () => void;

  /* ── 番茄钟 / 音乐 ── */
  togglePomo: () => void;
  resetPomo: () => void;
  updatePomoDisplay: () => void;
  renderMusicList: () => void;
  playTrack: (id: string) => void;
  stopMusic: () => void;
  /**
   * M07 · 音量同步端口（core/audio.ts 的 setMusicVolume）。
   * 滑杆改写模块级 `musicVol` 之后必须同步到真实 HTMLAudioElement，否则「拖动音量条无效」。
   */
  setMusicVolume?: (v: number) => void;
  /** M07 · 真实播放态查询（图标 ▶/⏸ 与点击语义以音频元素为准，而非 ui 镜像字段） */
  isMusicPlaying?: () => boolean;
  MUSIC_TRACKS: any[];

  /* ── 其它运行时 ── */
  toast: (msg: any) => void;
  subscribe: (fn: () => void) => void;
  scheduleRender: () => void;
  commit: any;
  actions: any;
  N: (id: any) => any;
  viewOf: (doc: any) => any;
  tickClock: () => void;
  indexWorkerDispose: (fin?: boolean) => void;
  /** 全局 `JU` 命名空间（只读用途：`JU.lifecycle` 释放登记） */
  JU: any;
  /**
   * M1-1d · 全局 `JU` 写入的唯一出口。
   * 本模块不再直接给 `window.JU.xxx` 赋值；所有对外属性集中经此端口交给 `src/main.ts`
   * 的 JU 全局装配点统一落位（消除零散赋值）。
   */
  publishJU: (patch: Record<string, any>) => void;
}

/** 模块内安全占位（加载即不抛错；真实实现在 src/main.ts 装配时注入）。 */
export const deps: BootDeps = {
  PENDING_KEY: 'juju.push',
  PENDING_SYNC_KEY,
  REMIND_SENT_KEY: 'juju.remind.sent',
  /* M1-2 · 批次 AQ：与产品件同址同值（core/persist 单一来源） */
  STORE_KEY: STORE_KEY,
  ENC_KEY: 'juju.enc.v1',
  STORE_BC_NAME: STORE_BC_NAME,
  ui: {},
  getState: () => null,
  isDesktop: () => false,
  setIsDesktop: () => {},
  getGraphPositions: () => ({}),
  setGraphPositions: () => {},
  getStoreBc: () => null,
  setStoreBc: () => {},
  getGraphWorker: () => null,
  getL7YieldCh: () => null,
  setL7YieldCh: () => {},
  getL7YieldQ: () => [],
  getSyncAppInertObserver: () => null,
  setSyncAppInertObserver: () => {},
  getReminderTimer: () => null,
  setReminderTimer: () => {},
  getEncFallbackTimer: () => null,
  setEncFallbackTimer: () => {},
  setLastEncPayload: () => {},
  getPomoState: () => ({ running: false, timer: null }),
  getLogTimers: () => null,
  getL14LongtaskGate: () => null,
  detectDesktop: () => false,
  desktopInvoke: () => Promise.resolve(null),
  dsLoadState: () => Promise.resolve(null),
  promptUnlock: () => Promise.resolve(null),
  migrateOrBackup: (st: any) => st,
  migrateOrFallback: (st: any) => st,
  migrateStateObject: (st: any) => st,
  defaultState: () => ({ nodes: {}, rootId: null }),
  hasEncryptedStore: () => false,
  loadState: () => null,
  loadAutoBackup: () => null,
  loadAutoBackupAsync: () => Promise.resolve(null),
  loadUI: () => {},
  loadUIEncrypted: () => Promise.resolve(),
  applyUIFields: () => {},
  applyScale: () => {},
  initStore: () => {},
  ensureCalendarRoot: () => {},
  VDB: { ensure: () => Promise.resolve(null) },
  migrateVersionsFromLS: () => Promise.resolve(null),
  persistNow: () => {},
  persistNowAwait: () => Promise.resolve(true),
  flushPersistNow: () => {},
  flushGraphPositions: () => {},
  takeVersionSnapshot: () => {},
  recoverPendingEncrypted: () => Promise.resolve(null),
  encryptState: () => Promise.resolve(null),
  decryptState: () => Promise.resolve(null),
  readEncryptedStore: () => null,
  mergeRemoteIfNewer: () => {},
  onRemoteStoreChange: () => {},
  flushPendingSession: () => {},
  flushPendingLogs: () => {},
  reportError: () => {},
  errMsg: (e: any) => String((e && e.message) || e || ''),
  applyModuleConfig: () => {},
  renderMain: () => {},
  renderFloatCal: () => {},
  updateRightSidebar: () => {},
  updateSidebarActiveState: () => {},
  updateEncryptSwitch: () => {},
  updateRemindBadge: () => {},
  refreshRemindStatus: () => {},
  checkDueReminders: () => {},
  remindersSupported: () => false,
  toggleRemindPanel: () => {},
  initReminder: () => {},
  showLockOverlay: () => {},
  floatCalVisible: () => false,
  ensureElInViewport: () => {},
  setActiveKey: () => {},
  setFloatCalVisible: () => {},
  saveUI: () => {},
  forceRender: () => {},
  applyTheme: () => {},
  applySystemTheme: () => {},
  bindTopbar: () => {},
  bindSidebar: () => {},
  bindTools: () => {},
  bindMainToggles: () => {},
  bindRightSidebar: () => {},
  bindSettings: () => {},
  bindTheme: () => {},
  initJuDnd: () => {},
  initJuModules: () => {},
  initJuSlides: () => {},
  togglePomo: () => {},
  resetPomo: () => {},
  updatePomoDisplay: () => {},
  renderMusicList: () => {},
  playTrack: () => {},
  stopMusic: () => {},
  MUSIC_TRACKS: [],
  toast: () => {},
  subscribe: () => {},
  scheduleRender: () => {},
  commit: () => undefined,
  actions: {},
  N: () => null,
  viewOf: () => null,
  tickClock: () => {},
  indexWorkerDispose: () => {},
  JU: {},
  publishJU: () => {},
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function injectBootDeps(next: Partial<BootDeps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   提醒（bell 面板开关 + 系统通知开关）
   ============================================================ */
export function bindReminder(): void {
  const ui = deps.ui;
  /**
   * 【D-09 · 真实修复】提醒铃面板开关。
   *
   * 根因：`deps.toggleRemindPanel` 在 boot 侧只有空实现 `() => {}`，且 main.ts **从未覆盖**它
   * （全仓 grep 仅命中 boot.ts 三处）。于是 `#btnBell` 点击恒无任何反应 ——
   * 这正是用户反馈的「提醒铃点了没反应」，也是矩阵里唯一 NO_EFFECT 的按钮。
   *
   * 面板本体 `#remindPanel` 是 `.panel`，显隐由 `.panel.on` 控制（style.css `.panel.on{display:flex}`）。
   * 这里补上真实实现，并回填到 deps 端口（若 main 覆盖则以 main 为准）。
   */
  const toggleRemindPanel = (show?: any): void => {
    const p = document.getElementById('remindPanel');
    if (!p) return;
    const want = show == null ? !p.classList.contains('on') : !!show;
    if (want) {
      p.classList.add('on');
      /* 【fix30】#remindPanel 的 CSS 为 `bottom:auto`（设计为跟随铃铛定位），若无显式 top
         ⇒ 回落到静态流位置（#app 之后、视口下方）⇒ 面板「打开了却看不见」，用户视为点击无反应。
         此处按 #btnBell 的实测矩形锚定，并夹紧到视口内（右侧对齐、按钮下方 6px）。 */
      try {
        const b = document.getElementById('btnBell');
        const r = b ? b.getBoundingClientRect() : null;
        const w = p.offsetWidth || 320, h = p.offsetHeight || 120;
        const left = r ? Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) : Math.max(8, (window.innerWidth - w) / 2);
        const top = r ? Math.max(8, Math.min(r.bottom + 6, window.innerHeight - h - 8)) : 64;
        p.style.left = left + 'px'; p.style.top = top + 'px'; p.style.bottom = 'auto';
      } catch (e) { console.warn('[JU] caught error', e); }
      try { deps.ensureElInViewport(p); } catch (e) { console.warn('[JU] caught error', e); }
    } else {
      p.classList.remove('on');
    }
  };
  deps.toggleRemindPanel = toggleRemindPanel;
  const bell=$('#btnBell');
  /* 【D-07】浮窗类按钮：addEventListener 绑定 + 按压兜底（旧内核无 PointerEvent 时降级 mousedown） */
  /* 【fix32-12】按压不冒泡由 bindTopbar 的 `.tb-right .tb-wbtn` 权威监听统一承担（此处不重复挂钩），点击内打点便于定位事件丢失 */
  bindClick(bell,(e)=>{e.stopPropagation();toggleRemindPanel();},{pressFallback:true});
  /* 【UI修复7】灰色 #remindClose 已移除：关闭由 initDragClose 生成的 .pop-close 承担（绑定 toggleRemindPanel(false)） */
  const gocal=$('#remindGoCal');
  if(gocal)bindClick(gocal,()=>{
    toggleRemindPanel(false);
    ui.view='auto';ui.activeKey='nav:calendar';ui.selectedDate=todayStr();
    deps.saveUI();
    deps.forceRender();
  });
  const sw=$('#setReminder');
  if(sw){
    sw.classList.toggle('on',!!ui.reminderEnabled);
    sw.onclick=()=>{
      if(ui.reminderEnabled){
        ui.reminderEnabled=false;deps.saveUI();sw.classList.remove('on');
        /* 【修复 F-13】关闭时停止轮询 */
        const t=deps.getReminderTimer();
        if(t){clearInterval(t);deps.setReminderTimer(null);}
        deps.toast('系统提醒已关闭');deps.refreshRemindStatus();return;
      }
      if(!deps.remindersSupported()){deps.toast('当前浏览器不支持系统通知');return;}
      if(Notification.permission==='denied'){deps.toast('通知权限已被浏览器拒绝，请先在浏览器设置中开启');return;}
      ui.reminderEnabled=true;deps.saveUI();sw.classList.add('on');
      /* 【修复 F-13】开启时立即补一次检查并启动轮询（此前仅在 boot 时初始化，启动后才开启会到点不提醒） */
      if(!deps.getReminderTimer()){deps.checkDueReminders();deps.setReminderTimer(setInterval(()=>deps.checkDueReminders(),30000));}
      if(Notification.permission==='granted'){deps.toast('系统提醒已开启');}
      else{
        deps.toast('正在请求系统通知权限…');
        Notification.requestPermission().then((p: NotificationPermission)=>{
          if(p!=='granted')deps.toast('未获得通知权限，到点将仅在应用内提示');
          else deps.toast('系统提醒已开启');
          deps.refreshRemindStatus();
        }).catch(()=>{});
      }
      deps.refreshRemindStatus();
    };
  }
}

/* ============================================================
   设置面板 · 4 项「需新增 UI」恢复（第十轮 fix10 · Q1=允许新增 UI）
   ------------------------------------------------------------
   第九轮按保守默认把 4 项移出 UI（REMOVE，回滚锚点见 settings_bind_fix.log §5）；
   产品方答复 Q1=允许新增 UI ⇒ 本轮按回滚锚点原样恢复 DOM（index.html + ui/layout.ts 同步），
   并按 canonical 逐条移植处理器。**全部走既有端口**（ui / saveUI / toast / isDesktop /
   encryptState / flushPersistNow），不新增 ui 字段、不改 style.css。
     · #setEncrypt       ← canonical 18835-18864 + appConfirm(6812) + showSetPasswordDialog(21822)
                           + updateEncryptSwitch(21885)
     · #btnBackupDirPick ← canonical 18802 + pickBackupDir(22268) + 依赖链 22222-22301
     · #setShortcuts     ← canonical 18834 + showHelp(18868)
     · #btnFeedback      ← canonical 18814 + openFeedbackDialog(22415)
   幂等：全部 `el.onclick = …` 属性赋值，重复调用只替换处理器，不叠加监听。
   ============================================================ */

/* ---------------- 备份目录：canonical 22220-22301 依赖链 ---------------- */
/** 路径归一（canonical 22222）：反斜杠转正斜杠 + 去尾部斜杠 */
function _juNormDir(p: any): string {
  return String(p == null ? '' : p).replace(/\\/g, '/').replace(/\/+$/, '');
}

/** 系统关键目录拦截（canonical 22223-22233）；【review7-07 · ISSUE-007】导出供 session 关闭备份落点复核 */
export function _juBlockedDir(p: any): boolean {
  const s = _juNormDir(p).toLowerCase();
  if (!s) return false;
  if (/^[a-z]:$/.test(s)) return true;
  const win = ['c:/windows', 'c:/program files', 'c:/program files (x86)', 'c:/programdata'];
  for (let i = 0; i < win.length; i += 1) {
    if (s === win[i] || s.indexOf(win[i] + '/') === 0) return true;
  }
  const nix = ['/bin', '/boot', '/dev', '/etc', '/lib', '/proc', '/root', '/sbin', '/sys', '/usr', '/var', '/library', '/system', '/applications'];
  for (let j = 0; j < nix.length; j += 1) {
    if (s === nix[j] || s.indexOf(nix[j] + '/') === 0) return true;
  }
  return s === '/';
}

/** 【review25-04】可写落点判定：仅盘符绝对路径或 Unix 根路径，且非系统关键目录；相对名 / UNC 一律仅记录 */
export function _juWritableDir(p: any): boolean {
  const s = _juNormDir(p);
  if (!s || _juBlockedDir(s)) return false;
  if (/^[a-zA-Z]:\//.test(s)) return true;
  return /^\/(?!\/)/.test(s);
}

/** 备份路径显示回填（canonical 22235-22243）：#setBackupDirVal 文案 / title / .on */
function juApplyBackupDirUI(): void {
  const el = document.getElementById('setBackupDirVal');
  if (!el) return;
  const raw = _juNormDir(deps.ui.backupDir);
  if (!raw) {
    el.textContent = '默认路径';
    el.classList.remove('on');
    el.removeAttribute('title');
    el.hidden = true;
    return;
  }
  const writable = typeof deps.ui.backupDirWritable === 'boolean'
    ? deps.ui.backupDirWritable
    : _juWritableDir(raw);
  el.textContent = raw;
  el.setAttribute('title', writable ? raw : raw + '（仅记录）');
  el.classList.toggle('on', !!raw && !_juBlockedDir(raw));
  el.hidden = false;
}

/** 桌面壳 IPC 取用（Tauri v2 core.invoke → v1 tauri.invoke → JU 端口；均无则返回 null） */
function _juDesktopInvoke(cmd: string, args: any): Promise<any> | null {
  try {
    const t: any = (window as any).__TAURI__;
    if (t && t.core && typeof t.core.invoke === 'function') return Promise.resolve(t.core.invoke(cmd, args));
    if (t && t.tauri && typeof t.tauri.invoke === 'function') return Promise.resolve(t.tauri.invoke(cmd, args));
  } catch (e) { /* 桥接缺失：降级 */ }
  const j: any = (window as any).JU;
  if (j && typeof j.desktopInvoke === 'function') {
    try { return Promise.resolve(j.desktopInvoke(cmd, args)); } catch (e) { return null; }
  }
  return null;
}

/** webkitdirectory 兜底目录选择（canonical 22251-22267；取消时按 null 返回） */
function _juPickDirViaInput(): Promise<string | null> {
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.setAttribute('webkitdirectory', '');
    inp.setAttribute('directory', '');
    inp.style.display = 'none';
    document.body.appendChild(inp);
    let done = false;
    const finish = (v: string | null): void => {
      if (done) return;
      done = true;
      try { inp.remove(); } catch (e) { /* 已移除 */ }
      res(v);
    };
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) { finish(null); return; }
      const rel = String((f as any).webkitRelativePath || f.name || '');
      const parts = rel.split(/[/\\]/);
      finish(parts[0] || rel || null);
    };
    /* Chromium 支持 input 的 cancel 事件：用户取消时不至于永久悬挂 Promise */
    inp.addEventListener('cancel', () => finish(null));
    try { inp.click(); } catch (e) { finish(null); }
  });
}

/** 接受目录：写 ui.backupDir / backupDirWritable + 回填显示（canonical 22288-22301） */
function _juAcceptDir(dir: any): any {
  const norm = _juNormDir(dir);
  if (_juBlockedDir(norm)) {
    deps.toast('该位置为系统关键目录，已忽略，保持原路径');
    return { blocked: true };
  }
  deps.ui.backupDir = norm;
  const canWrite = _juWritableDir(norm);
  deps.ui.backupDirWritable = canWrite;
  deps.saveUI();
  juApplyBackupDirUI();
  if (canWrite) deps.toast('已设置备份文件夹：' + norm);
  else deps.toast('仅记录路径：' + norm + '（无法直接写入；关闭时自动备份会写入默认位置 backups/，如需备份到该目录请用"下载 JSON（完整备份）"，或改选绝对路径）');
  return { ok: true, path: norm, writable: canWrite };
}

/** 目录选择主入口（fix41：desktop 原生 dialog.open → showDirectoryPicker → webkitdirectory） */
async function pickBackupDir(): Promise<any> {
  try {
    if (deps.isDesktop()) {
      /* 【fix41】优先走 Tauri 原生目录对话框：不再触发 WebView2 的 File System Access 权限弹窗 */
      try {
        const dlg: any = (window as any).__TAURI__ && (window as any).__TAURI__.dialog;
        if (dlg && typeof dlg.open === 'function') {
          const picked = await dlg.open({ directory: true, multiple: false, title: '选择备份文件夹' });
          const dir = Array.isArray(picked) ? picked[0] : picked;
          if (dir) return _juAcceptDir(String(dir));
          return { cancelled: true, reason: 'AbortError' };
        }
      } catch (e: any) {
        if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return { cancelled: true, reason: e.name };
      }
    }
    /* file:// 下 File System Access API 属受限来源（Chromium 直接抛 SecurityError，用户点了像「无反应」），
       故 file: 直接走 webkitdirectory 兜底；http(s)/localhost 才用目录句柄（可写目录） */
    const w: any = window as any;
    const isFileProto = typeof location !== 'undefined' && location.protocol === 'file:';
    if (!isFileProto && typeof w.showDirectoryPicker === 'function') {
      try {
        const h = await w.showDirectoryPicker({ mode: 'readwrite' });
        if (h) {
          return _juAcceptDir(h.name || '已选文件夹');
        }
      } catch (e: any) {
        if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return { cancelled: true, reason: e.name };
      }
    }
    const name = await _juPickDirViaInput();
    if (name === null) return { cancelled: true, reason: 'AbortError' };
    /* 【修复·关闭备份落错位置】webkitdirectory 兜底只拿得到文件夹名（浏览器不暴露绝对路径）。
       桌面版若把 basename 存成 backupDir，关闭备份会永远落不到该目录 —— 直接拒绝并给出可操作提示，
       而不是存一个「仅记录」的假路径。 */
    if (deps.isDesktop() && !_juWritableDir(name)) {
      return {
        error: true,
        message: '无法取得绝对路径（浏览器安全限制只返回文件夹名）。请用「浏览」按钮打开系统对话框选择；本次未修改备份位置。',
      };
    }
    return _juAcceptDir(name);
  } catch (e: any) {
    return { error: true, message: String((e && e.message) || e || '') };
  }
}

/* ---------------- 加密：设密码面板（canonical 21822-21884） ---------------- */
/**
 * 「设置主密码」面板。真实写入链：deps.encryptState(state, pwd) → writeEncryptedStore(payload, true)
 * （core/crypto 单一来源）→ ui.encrypted/ui.encKey → saveUI() → #setEncrypt 状态回填。
 * 取消 / ESC / 遮罩点击：不改任何状态（ui.encrypted 仍为 false）。
 */
function showSetPasswordDialog(): void {
  const ui = deps.ui;
  if (ui.locked) { deps.toast('请先解锁'); return; }
  const c: any = (window as any).crypto;
  if (!c || !c.subtle) { deps.toast('当前环境不支持加密（需 HTTPS 或 localhost）'); return; }
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = '<div class="modal" role="dialog" aria-modal="true" style="max-width:440px">'
    + '<div class="modal-head"><span>🔒 设置主密码</span><button class="modal-close">✕</button></div>'
    + '<div class="modal-body">'
    + '<div style="font-size:.84em;color:var(--warn);margin-bottom:10px">⚠️ 忘记密码将无法恢复数据。建议先导出备份。</div>'
    + '<div class="field"><label>主密码</label><input type="password" id="setPwd1"></div>'
    + '<div class="field"><label>确认密码</label><input type="password" id="setPwd2"></div>'
    + '<div id="setPwdErr" style="color:var(--danger);font-size:.8em;min-height:1.2em"></div>'
    + '<div class="modal-footer"><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>启用加密</button></div>'
    + '</div></div>';
  document.body.appendChild(modal);
  _modalStack.push(modal);
  _syncAppInert();
  const isTop = (): boolean => _modalStack[_modalStack.length - 1] === modal;
  const p1 = modal.querySelector('#setPwd1') as HTMLInputElement;
  const p2 = modal.querySelector('#setPwd2') as HTMLInputElement;
  const err = modal.querySelector('#setPwdErr') as HTMLElement;
  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    modal.remove();
    const i = _modalStack.indexOf(modal);
    if (i >= 0) _modalStack.splice(i, 1);
    _syncAppInert();
  };
  const onKey = (e: KeyboardEvent): void => { if (isTop() && e.key === 'Escape') close(); };
  (modal.querySelector('.modal-close') as HTMLElement).onclick = close;
  (modal.querySelector('[data-cancel]') as HTMLElement).onclick = close;
  modal.onclick = (e) => { if (e.target === modal && isTop()) close(); };
  document.addEventListener('keydown', onKey);
  p1.focus();
  (modal.querySelector('[data-ok]') as HTMLElement).onclick = async (): Promise<void> => {
    const a = p1.value;
    const b = p2.value;
    if (a.length < 6) { err.textContent = '密码至少 6 位'; return; }
    if (a !== b) { err.textContent = '两次输入不一致'; return; }
    err.textContent = '';
    const btn = modal.querySelector('[data-ok]') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '加密中…';
    try {
      const payload = await deps.encryptState(deps.getState(), a);
      const ok = await writeEncryptedStore(payload, true);
      if (!ok) {
        err.textContent = '加密写入失败（可能是存储空间不足），数据保持不变';
        btn.disabled = false;
        btn.textContent = '启用加密';
        return;
      }
      ui.encrypted = true;
      ui.encKey = a;
      /* canonical 21870-21871：启用加密成功后清除**明文主库**与**明文 UI 快照**
         （密文已由 writeEncryptedStore 写入 juju.enc.v1；saveUI 随后把 UI 快照写进 juju.ui.enc） */
      try { localStorage.removeItem(deps.STORE_KEY); } catch (e) { /* 存储不可用：忽略 */ }
      try { localStorage.removeItem('juju.ui.v31'); } catch (e) { /* 同上 */ }
      deps.saveUI();
      close();
      const sw = document.getElementById('setEncrypt');
      if (sw) sw.classList.add('on');
      try { deps.updateEncryptSwitch(); } catch (e) { /* 端口未注入：DOM 已回填 */ }
      deps.toast('已启用加密');
    } catch (e: any) {
      ui.encrypted = false;
      ui.encKey = null;
      err.textContent = '加密失败：' + deps.errMsg(e);
      btn.disabled = false;
      btn.textContent = '启用加密';
    }
  };
}

/* ---------------- 快捷键速查面板（canonical 18868-18894） ---------------- */
function showHelp(): void {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = '<div class="modal" role="dialog" aria-modal="true" style="max-width:560px">'
    + '<div class="modal-head"><span>JU · 快捷键速查</span><button class="modal-close">✕</button></div>'
    + '<div class="modal-body" style="font-family:ui-monospace,monospace;font-size:.85em;line-height:1.9;white-space:pre-wrap">'
    + esc('Enter            新建同级节点\n'
      + 'Shift + Enter    换行\n'
      + 'Tab              缩进\n'
      + 'Shift + Tab      反缩进\n'
      + 'Backspace        行首按：合并 / 删除\n'
      + 'Ctrl + ↑ / ↓     上下移动节点\n'
      + 'Ctrl + D         复制节点\n'
      + 'Ctrl + Z         撤回\n'
      + 'Ctrl + Y         恢复\n'
      + 'Ctrl + K         全局搜索\n'
      + 'Ctrl + 点击      跳转 [[链接]]（大纲 / 日历 / 文档 / 导图）\n'
      + '                  右侧「链接 / 反链」面板可查看出链与反链\n')
    + '</div></div>';
  document.body.appendChild(modal);
  _modalStack.push(modal);
  _syncAppInert();
  const isTop = (): boolean => _modalStack[_modalStack.length - 1] === modal;
  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    modal.remove();
    const i = _modalStack.indexOf(modal);
    if (i >= 0) _modalStack.splice(i, 1);
    _syncAppInert();
  };
  const onKey = (e: KeyboardEvent): void => { if (isTop() && e.key === 'Escape') close(); };
  (modal.querySelector('.modal-close') as HTMLElement).onclick = close;
  modal.onclick = (e) => { if (e.target === modal && isTop()) close(); };
  document.addEventListener('keydown', onKey);
}

/* ---------------- 反馈与错误上报面板（canonical 22415-22455） ---------------- */
/**
 * 反馈面板：错误日志条数 / 运行模式 / 节点数 / 版本 + 三按钮
 * （导出错误日志 / 复制日志 / 导出反馈包）。全部本地动作，未配置上报端点不联网。
 * 日志与下载通道复用既有实现：core/errors 的 getErrorLog / downloadJsonText / getErrorAppVersion。
 */
function openFeedbackDialog(): void {
  const log = getErrorLog();
  const st: any = deps.getState() || {};
  const nodeCount = st && st.nodes && typeof st.nodes === 'object' ? Object.keys(st.nodes).length : 0;
  const nav: any = typeof navigator !== 'undefined' ? navigator : {};
  const sys = {
    errorCount: log.length,
    mode: deps.isDesktop() ? 'desktop' : 'web',
    nodeCount,
    ver: getErrorAppVersion(),
    platform: String(nav.platform || ''),
    userAgent: String(nav.userAgent || ''),
  };
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = '<div class="modal" role="dialog" aria-modal="true" style="max-width:600px">'
    + '<div class="modal-head"><span>反馈与错误上报</span><button class="modal-close">✕</button></div>'
    + '<div class="modal-body">'
    + '<div class="field"><label>问题描述（可选）</label>'
    + '<textarea id="fbNote" rows="3" placeholder="描述你遇到的问题…" style="width:100%;padding:6px 8px;border:1px solid var(--line-soft);border-radius:5px;background:var(--bg-mid);color:var(--fg);resize:vertical"></textarea></div>'
    + '<div style="font-size:.76em;color:var(--fg-dim);line-height:1.8;margin:8px 0;word-break:break-all">错误日志 <b>' + sys.errorCount
    + '</b> 条 · 运行模式 <b>' + esc(sys.mode) + '</b> · 节点 <b>' + sys.nodeCount + '</b> · 版本 ' + esc(sys.ver)
    + '<br>' + esc(sys.platform) + ' · ' + esc(sys.userAgent) + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
    + '<button class="btn" id="fbExport">导出错误日志</button>'
    + '<button class="btn" id="fbCopy">复制日志</button>'
    + '<button class="btn primary" id="fbSend">导出反馈包</button>'
    + '</div>'
    + '<div style="font-size:.72em;color:var(--fg-dim);margin-top:8px">反馈包为本地 JSON 文件，包含错误日志与系统信息；请随工单一并发送给开发者。未配置上报端点时不会自动联网。</div>'
    + '</div></div>';
  document.body.appendChild(modal);
  _modalStack.push(modal);
  _syncAppInert();
  const isTop = (): boolean => _modalStack[_modalStack.length - 1] === modal;
  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    modal.remove();
    const i = _modalStack.indexOf(modal);
    if (i >= 0) _modalStack.splice(i, 1);
    _syncAppInert();
  };
  const onKey = (e: KeyboardEvent): void => { if (isTop() && e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  (modal.querySelector('.modal-close') as HTMLElement).onclick = close;
  modal.onclick = (e) => { if (e.target === modal && isTop()) close(); };
  (modal.querySelector('#fbExport') as HTMLElement).onclick = () => {
    const ok = downloadJsonText('JU-error-log-' + todayStr() + '.json', JSON.stringify(getErrorLog(), null, 2));
    deps.toast(ok ? '已导出错误日志' : '导出失败：当前环境不支持下载');
  };
  (modal.querySelector('#fbCopy') as HTMLElement).onclick = () => {
    const txt = JSON.stringify(getErrorLog(), null, 2);
    const clip: any = (navigator as any).clipboard;
    if (clip && typeof clip.writeText === 'function') clip.writeText(txt).then(() => deps.toast('已复制')).catch(() => deps.toast('复制失败'));
    else deps.toast('浏览器不支持剪贴板');
  };
  (modal.querySelector('#fbSend') as HTMLElement).onclick = () => {
    const note = String((modal.querySelector('#fbNote') as HTMLTextAreaElement).value || '');
    const pkg = { ts: Date.now(), note, sys, log: getErrorLog() };
    const ok = downloadJsonText('JU-反馈-' + todayStr() + '.json', JSON.stringify(pkg, null, 2));
    deps.toast(ok ? '反馈包已导出（纯本地，未联网）' : '反馈包导出失败：当前环境不支持下载');
  };
}

/* ============================================================
   设置面板 · 数据 / 常规行（第九轮 fix9 · 补绑）
   ------------------------------------------------------------
   根因：模块化拆分时 canonical `bindSettings()`（v2.0-t3.html:18775-18867）的处理器整体漏迁，
   boot 侧只剩 `bindSettings: () => {}` 占位（deps 默认，boot.ts:299），main.ts 的设置挂载串
   只补了面板开关 / 许可证 / 崩溃日志 / 云端同步 / 手册，导致下列 4 行「有 UI 无 handler」。
   本函数按 canonical 逐条回填，全部走既有端口（ui / saveUI / applyScale / toast），
   **不新增 UI、不改 style.css**。幂等：重复调用只重绑处理器（属性赋值，不叠加监听）。
   ------------------------------------------------------------
   取证与分档：90过程材料/tmp_compare/fix7/settings_bind_audit.log
   · #setAutoBackupClose  ← canonical 18777-18787（【fixed23】默认开启语义）
   · #btnBackupDirReset   ← canonical 22302 resetBackupDir
   · #btnRestoreBackup    ← canonical 18813（openImportDialog，现有公开入口）
   · #setFontSize         ← canonical 18828-18833（ui.scale → applyScale → --font-size）
   ============================================================ */
export function bindSettingsRows(): void {
  const ui = deps.ui;
  if (!ui) return;

  /* 【canonical 18777-18787】关闭应用时自动备份：默认开启（!==false 语义，与产品件逐字一致） */
  const swAC = $('#setAutoBackupClose');
  if (swAC) {
    swAC.classList.toggle('on', ui.autoBackupOnClose !== false);
    swAC.onclick = () => {
      ui.autoBackupOnClose = !(ui.autoBackupOnClose !== false);
      deps.saveUI();
      swAC.classList.toggle('on', ui.autoBackupOnClose !== false);
      deps.toast(ui.autoBackupOnClose !== false ? '关闭应用时自动备份已开启' : '关闭应用时自动备份已关闭');
    };
  }

  /* 【canonical 22302】恢复默认备份路径：清 ui.backupDir / backupDirWritable 并回填显示节点 */
  const bdReset = $('#btnBackupDirReset');
  if (bdReset) {
    bdReset.onclick = () => {
      ui.backupDir = '';
      ui.backupDirWritable = false;
      deps.saveUI();
      const dv = document.getElementById('setBackupDirVal');
      if (dv) {
        dv.textContent = '默认路径';
        dv.classList.remove('on');
        dv.removeAttribute('title');
      }
      deps.toast('已恢复默认备份路径');
    };
  }

  /* 【canonical 18813】从备份恢复 → openImportDialog（已存在的公开入口，不新写恢复链路） */
  const rb = $('#btnRestoreBackup');
  if (rb) {
    rb.onclick = () => {
      const j: any = (window as any).JU;
      if (j && typeof j.openImportDialog === 'function') { j.openImportDialog(); return; }
      deps.toast('导入入口不可用');
    };
  }

  /* 【canonical 18828-18833】字号滑杆：写 ui.scale → applyScale()（唯一 --font-size 链路）→ saveUI */
  const fsEl = document.getElementById('setFontSize') as HTMLInputElement | null;
  if (fsEl) {
    const pct = Math.round((ui.scale || 1) * 100);
    fsEl.value = String(pct);
    const valEl = document.getElementById('setFontSizeVal');
    if (valEl) valEl.textContent = pct + '%';
    const onScale = (): void => {
      ui.scale = Math.max(0.7, Math.min(2, (parseInt(fsEl.value, 10) || 100) / 100));
      deps.applyScale();
      deps.saveUI();
      if (valEl) valEl.textContent = Math.round(ui.scale * 100) + '%';
      /* canonical 同款 250ms 防抖：仅日历视图需按新字号重排时间网格 */
      const w: any = window as any;
      clearTimeout(w.__fsCalTimer);
      w.__fsCalTimer = setTimeout(() => {
        try {
          if (String(ui.view || '') === 'calendar' || String(ui.activeKey || '') === 'nav:calendar') deps.forceRender();
        } catch (e) { /* 渲染失败不影响字号已生效 */ }
      }, 250);
    };
    fsEl.oninput = onScale;
    fsEl.onchange = onScale;
  }

  /* ============================================================
     第十轮 fix10 · 4 项恢复 UI 的补绑（Q1=允许新增 UI）
     DOM 由 index.html / ui/layout.ts 的 fix10 标记行提供；此处只补处理器（幂等）
     ============================================================ */

  /* 【canonical 18835-18864】#setEncrypt：未加密 → 设密码面板；已加密 → 二次确认后关闭 */
  const encSw = $('#setEncrypt');
  if (encSw) {
    /* 初值回填（canonical updateEncryptSwitch 21885 同义） */
    encSw.classList.toggle('on', !!ui.encrypted);
    encSw.onclick = () => {
      if (ui.locked) { deps.toast('请先解锁'); return; }
      if (ui.encrypted) {
        appConfirm(deps.isDesktop()
          ? '关闭加密后，数据将以明文存储在本地 SQLite 中。确定？'
          : '关闭加密后，数据将以明文存储在浏览器中。确定？', async () => {
          const prevKey = ui.encKey;
          const rollback = (): void => {
            ui.encrypted = true;
            ui.encKey = prevKey;
            encSw.classList.add('on');
            try { deps.updateEncryptSwitch(); } catch (e) { /* 端口未注入：DOM 已回填 */ }
            deps.toast('关闭加密失败，请重试');
          };
          /* 【review15-01 · ISSUE-001】写端一次原子写：明文快照落盘并删除 encStore。
             先在加密态等完在途写盘（不触发新写盘），再翻转解密态并单次 invoke；
             失败即回滚，磁盘既不留明文也不丢密文（禁止「先 clear 后写」）。 */
          let ok = false;
          try { ok = await deps.persistNowAwait(); } catch (e) { ok = false; }
          if (!ok) { rollback(); return; }
          ui.encrypted = false;
          ui.encKey = null;
          if (deps.isDesktop()) {
            const inv: any = deps.desktopInvoke || ((window as any).JU && (window as any).JU.desktopInvoke);
            /* 【review15-10/13 · ISSUE-010】命名空间-only（无 core.invoke）必须可见失败：不得跳过写盘仍提示已关闭 */
            const ta: any = (window as any).__TAURI__;
            const canInvoke = !!ta && ((ta.core && typeof ta.core.invoke === 'function') || (ta.tauri && typeof ta.tauri.invoke === 'function'));
            if (typeof inv !== 'function' || !canInvoke) { rollback(); deps.toast('桌面桥接不可用，未关闭加密'); return; }
            /* 明文快照与删密文在同一次 invoke / write_store 内完成，不留「已 clear 未写」窗口 */
            const payload = JSON.stringify(deps.getState());
            try { await inv('save_plain_and_clear', { payload }); }
            catch (e) { rollback(); return; }
            /* 复核：写盘后重读主库，仍带 encStore 视为失败（防止在途密文写盘复活） */
            let raw: any = '';
            let rereadOk = true;
            try { raw = await inv('load_state', {}); } catch (e) { raw = ''; rereadOk = false; }
            let hasEnc = false;
            /* 【review17 · ISSUE-001】复核异常不得回滚已提交的明文：只按未检出 encStore 处理 */
            try { const st = typeof raw === 'string' ? JSON.parse(raw) : raw; hasEnc = !!(st && st.encStore); }
            catch { hasEnc = false; }
            if (hasEnc) { rollback(); return; }
            /* 复核不可用（读端失败/解析失败）只提示重启，禁止恢复加密态 */
            if (!rereadOk) deps.toast('已关闭加密，但复核未完成，请重启后确认');
          } else {
            /* 浏览器端无桌面桥接：翻转为明文后推进写盘序号并立即落盘 */
            const _st: any = deps.getState ? deps.getState() : null;
            if (_st) _st._rev = (_st._rev | 0) + 1;
            try { ok = await deps.persistNowAwait(); } catch (e) { ok = false; }
            if (!ok) { rollback(); return; }
          }
          try { localStorage.removeItem(deps.ENC_KEY); } catch (e) { /* 存储不可用：忽略 */ }
          try { localStorage.removeItem('juju.ui.enc'); } catch (e) { /* 同上 */ }
          deps.saveUI();
          encSw.classList.remove('on');
          try { deps.updateEncryptSwitch(); } catch (e) { /* 端口未注入：DOM 已回填 */ }
          deps.toast('已关闭加密');
        });
      } else {
        showSetPasswordDialog();
      }
    };
  }

  /* 【canonical 18802 + 22268】#btnBackupDirPick：三级目录选择 → 写 ui.backupDir / backupDirWritable */
  const bdPick = $('#btnBackupDirPick');
  if (bdPick) {
    bdPick.onclick = () => {
      void pickBackupDir().then((r: any) => {
        if (r && r.cancelled) deps.toast('已取消选择，保持原路径');
        else if (r && r.error) deps.toast('选择文件夹失败：' + String(r.message || ''));
      }).catch((e: any) => deps.toast('选择文件夹失败：' + String((e && e.message) || e || '')));
    };
    /* 初值回填：把已持久化的 backupDir 显示出来（canonical 18804 juApplyBackupDirUI 同义） */
    juApplyBackupDirUI();
  }

  /* 【canonical 18834 + 18868】#setShortcuts：快捷键速查面板（.modal-overlay） */
  const scBtn = $('#setShortcuts');
  if (scBtn) scBtn.onclick = showHelp;

  /* 【canonical 18814 + 22415】#btnFeedback：反馈面板（模态 + 日志导出 / 复制 / 反馈包） */
  const fbBtn = $('#btnFeedback');
  if (fbBtn) fbBtn.onclick = openFeedbackDialog;
}

export function initReminder(): void {
  deps.updateRemindBadge();
  deps.refreshRemindStatus();
  if(deps.ui.reminderEnabled){
    setTimeout(()=>deps.checkDueReminders(),1500);
    /* 【修复 F-13】防重复：仅在未启动时创建 interval，供开关复用同一句柄 */
    if(!deps.getReminderTimer())deps.setReminderTimer(setInterval(()=>deps.checkDueReminders(),30000));
  }
}

/* ============================================================
   番茄钟 / 悬浮日历 / 设置面板拖拽
   ============================================================ */
/* 音乐音量单例（与产品同作用域语义一致：initPomo 的滑杆直接改写本变量） */
let musicVol: number=(()=>{
  try{
    const v=parseFloat(localStorage.getItem('juju.musicvol') as string);
    return Number.isFinite(v)?Math.max(0,Math.min(1,v)):0.4;
  }catch(e){return 0.4;}
})();

/* 批次 DE · 死代码清理：`getMusicVol` / `setMusicVol` 经全量静态反查（src / tests / test / scripts /
   server / src-tauri 均 0 引用）确认无用，已删除。音量单例 `musicVol` 仍由 initPomo 的滑杆直接读写，保留。 */

/* ────────────────────────────────────────────────────────────────────────────
 * 番茄钟状态机（canonical 18494-18579 逐行移植）
 *
 * 缺陷背景（本轮实测 `_环境与调试/m07-sixcheck-before-2026-10-25.txt`）：
 *   `initPomo()` 把 `#pomoStart` / `#pomoReset` 绑到 `deps.togglePomo` / `deps.resetPomo`，
 *   而这两个端口在 boot 的 deps 里是 `() => {}` 占位，main.ts 也从未注入真实实现 ——
 *   `togglePomo` / `resetPomo` / `updatePomoDisplay` 三个函数（canonical 18547/18570/18575）
 *   在 src/ 下**完全不存在**。表现为：番茄钟浮层能弹出，但点「开始」永远停在 25:00。
 *   本段按产品件逐行回填状态机与显示刷新，`initPomo` 直接绑定本地实现。
 * ──────────────────────────────────────────────────────────────────────────── */
const POMO_WORK = 25 * 60, POMO_BREAK = 5 * 60;
export const pomoState: any = { running: false, endAt: 0, remaining: POMO_WORK, mode: 'work', timer: null };
/** 番茄钟状态取用（boot 的 lifecycle 清理与外部诊断使用） */
export function getPomoState(): any { return pomoState; }
/** 刷新 25:00 显示（canonical 18575） */
export function updatePomoDisplay(): void {
  const m = Math.floor(pomoState.remaining / 60), s = pomoState.remaining % 60;
  const t = $('#pomoTime');
  if (t) t.textContent = pad(m) + ':' + pad(s);
}
/** 开始 / 暂停（canonical 18547） */
export function togglePomo(): void {
  if (pomoState.running) {
    clearInterval(pomoState.timer); pomoState.timer = null; pomoState.running = false;
    pomoState.remaining = Math.max(0, Math.round((pomoState.endAt - Date.now()) / 1000));
    ($('#pomoStart') as HTMLElement).textContent = '继续';
    $('#pomoTimer')!.classList.remove('active');
  } else {
    pomoState.running = true;
    pomoState.endAt = Date.now() + pomoState.remaining * 1000;
    ($('#pomoStart') as HTMLElement).textContent = '暂停';
    $('#pomoTimer')!.classList.add('active');
    pomoState.timer = setInterval(() => {
      const left = Math.max(0, Math.round((pomoState.endAt - Date.now()) / 1000));
      pomoState.remaining = left;
      updatePomoDisplay();
      if (left <= 0) {
        clearInterval(pomoState.timer); pomoState.timer = null; pomoState.running = false;
        if (pomoState.mode === 'work') { pomoState.mode = 'break'; pomoState.remaining = POMO_BREAK; deps.toast('专注完成！休息5分钟'); }
        else { pomoState.mode = 'work'; pomoState.remaining = POMO_WORK; deps.toast('休息结束，开始下一个专注'); }
        ($('#pomoStart') as HTMLElement).textContent = '开始';
        $('#pomoTimer')!.classList.remove('active');
        updatePomoDisplay();
      }
    }, 500);
  }
}
/** 重置（canonical 18570） */
export function resetPomo(): void {
  clearInterval(pomoState.timer); pomoState.timer = null; pomoState.running = false;
  pomoState.mode = 'work'; pomoState.remaining = POMO_WORK;
  ($('#pomoStart') as HTMLElement).textContent = '开始';
  $('#pomoTimer')!.classList.remove('active');
  updatePomoDisplay();
}
/** 音乐条目播放态刷新（canonical 18755；无轨道源时静默返回） */
export function renderMusicList(): void {
  const item = $('#musicItem'); if (!item) return;
  const t = deps.MUSIC_TRACKS && deps.MUSIC_TRACKS[0]; if (!t) return;
  /* 优先读真实音频状态（core/audio 的 playing/pause 事件驱动），ui.musicPlaying 仅作兜底镜像 */
  const playing = (typeof deps.isMusicPlaying === 'function') ? deps.isMusicPlaying() : deps.ui.musicPlaying === t.id;
  item.classList.toggle('playing', playing);
  const ic = $('#musicPlayIc'); if (ic) ic.textContent = playing ? '⏸' : '▶';
}

export function initPomo(): void {
  const ui = deps.ui;
  const el=$('#pomoTimer');if(!el)return;
  el.hidden=!ui.pomoVisible;
  /* 【修复】改绑本地真实实现（canonical 18499/18500）；deps 通道保留给外部覆盖 */
  ($('#pomoStart') as HTMLElement).onclick=()=>togglePomo();
  ($('#pomoReset') as HTMLElement).onclick=()=>resetPomo();
  const closeBtn=$('#pomoClose');
  if(closeBtn)closeBtn.onclick=()=>{
    ui.pomoVisible=false;
    if(ui.modules&&ui.modules.floats&&ui.modules.floats.pomoTimer){ui.modules.floats.pomoTimer.visible=false;ui.modules.floats.pomoTimer.pinned=false;}
    el.style.display='none';deps.saveUI();
  };
  const mi=$('#musicItem');
  /* 音乐轨道端口目前是空占位（BootDeps.MUSIC_TRACKS 缺省 []，playTrack/stopMusic 为 noop）。
     原实现无条件取 deps.MUSIC_TRACKS[0].id，只要有轨道源缺失就在点击时抛
     TypeError: Cannot read properties of undefined (reading 'id')，被 boot 的
     window.onerror 钩子写进 crash_dumps（桌面版实测每次点击稳定复现）。
     改为「无轨道则不绑定」，点击静默返回，不再产生未捕获异常。 */
  const track0=deps.MUSIC_TRACKS&&deps.MUSIC_TRACKS[0];
  if(mi&&track0)mi.onclick=()=>{
    const playing=(typeof deps.isMusicPlaying==='function')?deps.isMusicPlaying():ui.musicPlaying===track0.id;
    if(playing)deps.stopMusic();else deps.playTrack(track0.id);
  };
  const mv=$('#musicVol') as HTMLInputElement|null;
  if(mv){
    mv.value=String(Math.round(musicVol*100));
    mv.oninput=(e: Event)=>{
      musicVol=parseInt((e.target as HTMLInputElement).value)/100;
      try{localStorage.setItem('juju.musicvol',String(musicVol));}catch(err){console.warn('[JU] caught error',err);}
      /* M07 · 音量落到真实音频元素（此前只改模块变量，播放中的音频音量不变） */
      try{if(typeof deps.setMusicVolume==='function')deps.setMusicVolume(musicVol);}catch(err){console.warn('[JU] caught error',err);}
    };
  }
  let dragging=false,ox=0,oy=0;
  try{const p=JSON.parse((localStorage.getItem('juju.ftpos') as string)||'null');if(p&&typeof p.x==='number'){el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.right='auto';el.style.bottom='auto';}}catch(e){console.warn('[JU] caught error',e);}
  deps.ensureElInViewport(el);
  const onPomoMove=(e: MouseEvent)=>{
    if(!dragging)return;
    let x=e.clientX-ox,y=e.clientY-oy;
    x=Math.max(0,Math.min(window.innerWidth-60,x));
    y=Math.max(0,Math.min(window.innerHeight-40,y));
    el.style.left=x+'px';el.style.top=y+'px';
  };
  const onPomoUp=()=>{
    if(!dragging)return;dragging=false;
    document.removeEventListener('mousemove',onPomoMove);
    document.removeEventListener('mouseup',onPomoUp);
    try{localStorage.setItem('juju.ftpos',JSON.stringify({x:parseInt(el.style.left)||0,y:parseInt(el.style.top)||0}));}catch(e){console.warn('[JU] caught error',e);}
  };
  el.addEventListener('mousedown',(e: MouseEvent)=>{
    const t=e.target as HTMLElement;
    if(t.closest('button')||t.closest('.music-item')||t.closest('input'))return;
    dragging=true;
    const r=el.getBoundingClientRect();
    ox=e.clientX-r.left;oy=e.clientY-r.top;
    el.style.right='auto';el.style.bottom='auto';
    el.style.left=r.left+'px';el.style.top=r.top+'px';
    document.addEventListener('mousemove',onPomoMove);
    document.addEventListener('mouseup',onPomoUp);
    e.preventDefault();
  });
  updatePomoDisplay();
  renderMusicList();
}

export function initFloatCalDrag(): void {
  const fc=$('#floatCal');if(!fc)return;
  const head=$('#fcHead');
  let dragging=false,ox=0,oy=0;
  try{const p=JSON.parse((localStorage.getItem('juju.fcpos') as string)||'null');if(p&&typeof p.x==='number'){fc.style.left=p.x+'px';fc.style.top=p.y+'px';}else{fc.style.right='24px';fc.style.top='calc(var(--topbar-h,48px) + 24px)';}}catch(e){fc.style.right='24px';fc.style.top='calc(var(--topbar-h,48px) + 24px)';}
  deps.ensureElInViewport(fc);
  const onMove=(e: MouseEvent)=>{
    if(!dragging)return;
    let x=e.clientX-ox,y=e.clientY-oy;
    x=Math.max(0,Math.min(window.innerWidth-60,x));y=Math.max(0,Math.min(window.innerHeight-40,y));
    fc.style.left=x+'px';fc.style.top=y+'px';
  };
  const onUp=()=>{
    if(!dragging)return;dragging=false;
    document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
    try{localStorage.setItem('juju.fcpos',JSON.stringify({x:parseInt(fc.style.left)||0,y:parseInt(fc.style.top)||0}));}catch(e){console.warn('[JU] caught error',e);}
  };
  if(head)head.addEventListener('mousedown',(e: MouseEvent)=>{
    if((e.target as HTMLElement).id==='fcClose')return;
    dragging=true;
    const r=fc.getBoundingClientRect();
    ox=e.clientX-r.left;oy=e.clientY-r.top;
    fc.style.right='auto';fc.style.left=r.left+'px';fc.style.top=r.top+'px';
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    e.preventDefault();
  });
  ($('#fcClose') as HTMLElement).onclick=()=>{deps.setFloatCalVisible(false,true);};
}

export function initSettingsDrag(): void {
  const p=$('#settingsPanel');if(!p)return;
  const head=p.querySelector('.panel-head') as HTMLElement|null;
  if(!head)return;
  let dragging=false,ox=0,oy=0;
  try{const pos=JSON.parse((localStorage.getItem('juju.settingspos') as string)||'null');if(pos&&typeof pos.x==='number'){p.style.left=pos.x+'px';p.style.top=pos.y+'px';p.style.bottom='auto';}}catch(e){console.warn('[JU] caught error',e);}
  deps.ensureElInViewport(p);
  head.addEventListener('mousedown',(e: MouseEvent)=>{
    if((e.target as HTMLElement).closest('button'))return;
    dragging=true;
    const r=p.getBoundingClientRect();
    ox=e.clientX-r.left;oy=e.clientY-r.top;
    p.style.bottom='auto';p.style.left=r.left+'px';p.style.top=r.top+'px';
    e.preventDefault();
  });
  document.addEventListener('mousemove',(e: MouseEvent)=>{
    if(!dragging)return;
    let x=e.clientX-ox,y=e.clientY-oy;
    x=Math.max(0,Math.min(window.innerWidth-80,x));y=Math.max(0,Math.min(window.innerHeight-40,y));
    p.style.left=x+'px';p.style.top=y+'px';
  });
  document.addEventListener('mouseup',()=>{
    if(!dragging)return;dragging=false;
    try{localStorage.setItem('juju.settingspos',JSON.stringify({x:parseInt(p.style.left)||0,y:parseInt(p.style.top)||0}));}catch(e){console.warn('[JU] caught error',e);}
  });
}

/* ============================================================
   M5-1b · 批次 CT · 本地崩溃日志「查看与导出」（设置面板 #btnViewCrashLogs）
   ------------------------------------------------------------
   契约：
     1) 行由 `ui/layout.ts` 的 `bindCrashLogRow()` 渲染（设置面板「本地崩溃日志」），
        本函数只承接点击语义，渲染与行为分离；
     2) 桌面壳（`IS_DESKTOP` 口径 = `deps.isDesktop()` 或 Tauri 桥接存在）：
        `confirm` 征得用户同意 → IPC `read_crash_dumps` 取本机 crash_dumps 聚合 JSON → 落盘；
     3) Web 端：不经任何 IPC，直接把 `window.__juLog` 环形日志导出（与 `__juLogDownload` 同源）；
     4) 文件名统一为 `JU-CrashLogs-YYYY-MM-DD.json`（本地时区日期，导出当天即日期戳）；
     5) 幂等：`onclick` 覆盖赋值，重复调用不叠加监听；异常一律 `toast` 提示，不冒泡打断面板。
   ============================================================ */
const CRASH_LOG_FILE_PREFIX = 'JU-CrashLogs-';

/** 崩溃日志导出文件名：`JU-CrashLogs-YYYY-MM-DD.json` */
function crashLogFileName(): string {
  const d = new Date();
  const pad = (n: number): string => (n < 10 ? '0' + n : String(n));
  return `${CRASH_LOG_FILE_PREFIX}${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** 桌面壳判定（`deps.isDesktop()` 端口优先，回退 `updater.isTauriShell()` 的真实桥接探测） */
function crashLogDesktopShell(): boolean {
  try {
    if (deps.isDesktop()) return true;
  } catch (e) { /* 端口未注入时继续走桥接探测 */ }
  try { return isTauriShell(); } catch (e) { return false; }
}

export function bindCrashLogExport(): void {
  const btn = $('#btnViewCrashLogs') as HTMLButtonElement | null;
  if (!btn) return;
  btn.onclick = async (): Promise<void> => {
    const fileName = crashLogFileName();
    /* ── Web 端：直接导出 window.__juLog（无 IPC、无外发） ── */
    if (!crashLogDesktopShell()) {
      if (!downloadJsonText(fileName, JSON.stringify(getErrorLog(), null, 2))) {
        deps.toast('日志导出失败，请检查浏览器下载权限');
      }
      return;
    }
    /* ── 桌面端：先征得同意，再读本机 crash_dumps ── */
    const accepted = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm('是否导出本机崩溃日志？导出内容仅保存在本机，不会上传。')
      : false;
    if (!accepted) return;
    const res = await readCrashDumps();
    if (!res.ok) { deps.toast('崩溃日志读取失败：' + (res.error || '未知错误')); return; }
    if (!downloadJsonText(fileName, res.json || '{}')) {
      deps.toast('日志导出失败，请检查下载目录权限');
    }
  };
}

/* ============================================================
   全局事件：错误兜底 + 键盘可达性（原文件底部散落监听统一收拢）
   ============================================================ */
export function bindGlobalEvents(): void {
  /* ── 1. window 级错误 / 未处理拒绝兜底（源 18448-18458） ── */
  window.addEventListener('error',(e: ErrorEvent)=>{
    /* FIX-ERR-1: 仅存在 Error 对象时 preventDefault——资源加载类错误（e.error 缺失）不吞默认处理，避免误吞第三方脚本错误 */
    if(e.error)e.preventDefault();
    deps.reportError('error',{msg:deps.errMsg(e),stack:e.error&&e.error.stack,filename:e.filename,lineno:e.lineno});
    /* M5-1b：崩溃包统一组装（环境上下文 + 堆栈 + 内存快照）后送入崩溃通道。
       仅结构性字段，不含节点正文 / 文档标识，与 M2-7 的 payload 白名单口径一致。 */
    try{
      const _mem:any=(typeof performance!=='undefined')?(performance as any).memory:null;
      void sendCrashReport({
        kind:'window-error',
        ts:Date.now(),
        msg:deps.errMsg(e),
        reason:String((e.error&&e.error.message)||e.message||''),
        stack:(e.error&&e.error.stack)||null,
        filename:e.filename||null,
        lineno:typeof e.lineno==='number'?e.lineno:null,
        colno:typeof e.colno==='number'?e.colno:null,
        userAgent:(typeof navigator!=='undefined'&&navigator.userAgent)||null,
        version:getErrorAppVersion(),
        memoryInfo:_mem?{
          usedJSHeapSize:_mem.usedJSHeapSize,
          totalJSHeapSize:_mem.totalJSHeapSize,
          jsHeapSizeLimit:_mem.jsHeapSizeLimit,
        }:null,
        view:(deps.ui&&deps.ui.view)||null,
      });
    }catch(_crashErr){console.warn('[JU] crash payload build failed',_crashErr);}
    console.error('[JU]',e.error||deps.errMsg(e));
  });
  window.addEventListener('unhandledrejection',(e: PromiseRejectionEvent)=>{
    if(e.reason)e.preventDefault();
    deps.reportError('unhandledrejection',{reason:String(e&&e.reason!==undefined?e.reason:e),stack:e.reason&&e.reason.stack});
    console.error('[JU] unhandled rejection',(e&&e.reason!==undefined?e.reason:e));
  });
  /* ── 2. 键盘可达性补强（roving tabindex，源 22794-22904） ── */
  bindA11yRoving();
}

type RovingCfg = { cols?: number; step?: number; vertical?: boolean; expandedOnly?: boolean };

function bindA11yRoving(): void {
  function getItems(container: any, itemSel: string, cfg: RovingCfg): any[] {
    return ([].filter as any).call(container.querySelectorAll(itemSel),()=>{
      if(cfg.expandedOnly&&!container.classList.contains('open'))return false;
      return true;
    });
  }
  function refreshRoving(container: any, itemSel: string, cfg: RovingCfg): void {
    const items=getItems(container,itemSel,cfg);
    if(!items.length)return;
    let cur=items[0];
    if(cfg.cols){
      cur=container.querySelector('.cal-cell.selected')||container.querySelector('.cal-cell.today')||items[0];
    }
    items.forEach((x: any)=>x.tabIndex=-1);
    cur.tabIndex=0;
  }
  function setupRoving(container: any, itemSel: string, cfg: RovingCfg): void {
    if(!container._rovingNav){
      container._rovingNav=true;
      container.addEventListener('keydown',(e: KeyboardEvent)=>{
        const items=getItems(container,itemSel,cfg);
        if(!items.length)return;
        const cur: any=document.activeElement;
        const idx=items.indexOf(cur);
        if(idx<0)return;
        let nxt=-1;
        if(cfg.cols){
          if(e.key==='ArrowRight')nxt=(idx+1)%items.length;
          else if(e.key==='ArrowLeft')nxt=(idx-1+items.length)%items.length;
          else if(e.key==='ArrowDown')nxt=Math.min(items.length-1,idx+(cfg.step as number));
          else if(e.key==='ArrowUp')nxt=Math.max(0,idx-(cfg.step as number));
        }else{
          if(e.key==='ArrowDown')nxt=Math.min(items.length-1,idx+1);
          else if(e.key==='ArrowUp')nxt=Math.max(0,idx-1);
        }
        if(nxt>=0&&nxt!==idx){
          e.preventDefault();
          items.forEach((x: any,i: number)=>x.tabIndex=i===nxt?0:-1);
          items[nxt].focus();
          return;
        }
        if(e.key==='Enter'||e.key===' '){e.preventDefault();if(typeof cur.click==='function')cur.click();}
      });
    }
    refreshRoving(container,itemSel,cfg);
  }
  const GRID_CFG: RovingCfg={cols:7,step:7};
  const TREE_CFG: RovingCfg={vertical:true,expandedOnly:true};
  function decorate(el: any): void {
    if(!el||el.nodeType!==1)return;
    if(el.querySelectorAll){
      [].forEach.call(el.querySelectorAll('.sb-arrow:not(.leaf)'),(x: any)=>{if(!x.getAttribute('aria-label'))x.setAttribute('aria-label','展开或折叠子项');});
      [].forEach.call(el.querySelectorAll('.drag-handle'),(x: any)=>{if(!x.getAttribute('aria-label'))x.setAttribute('aria-label','拖动排序或移动');});
      [].forEach.call(el.querySelectorAll('.cal-sel-arrow'),(x: any)=>{if(x.getAttribute('aria-hidden')!=='true')x.setAttribute('aria-hidden','true');});
      [].forEach.call(el.querySelectorAll('.cal-sel'),(x: any)=>{if(!x.hasAttribute('tabindex'))x.tabIndex=0;});
      [].forEach.call(el.querySelectorAll('.cal-grid'),(x: any)=>setupRoving(x,'.cal-cell',GRID_CFG));
      [].forEach.call(el.querySelectorAll('.sb-subtree'),(x: any)=>setupRoving(x,'.sb-row:not(.sb-empty)',TREE_CFG));
      [].forEach.call(el.querySelectorAll('.sb-row:not(.sb-empty)'),(x: any)=>{
        if(x.closest&&x.closest('.sb-subtree'))return;
        if(!x.hasAttribute('tabindex'))x.tabIndex=0;
        if(!x._kbEnter){
          x._kbEnter=true;
          x.addEventListener('keydown',(e: KeyboardEvent)=>{
            if(e.key==='Enter'||e.key===' '){e.preventDefault();if(typeof x.click==='function')x.click();}
          });
        }
      });
    }
    if(el.classList&&(el.classList.contains('cal-grid')))setupRoving(el,'.cal-cell',GRID_CFG);
    if(el.classList&&(el.classList.contains('sb-subtree')))setupRoving(el,'.sb-row:not(.sb-empty)',TREE_CFG);
    if(el.classList&&el.classList.contains('cal-sel')&&!el.hasAttribute('tabindex'))el.tabIndex=0;
    const sub=el.closest&&el.closest('.sb-subtree');
    if(sub)refreshRoving(sub,'.sb-row:not(.sb-empty)',TREE_CFG);
  }
  /* 去抖：rAF 批量处理新增节点 */
  const queue: any[]=[];let rafId=0;
  function flush(): void {
    rafId=0;
    while(queue.length)decorate(queue.shift());
  }
  function schedule(n: any): void {queue.push(n);if(!rafId)rafId=requestAnimationFrame(flush);}
  decorate(document);
  /* M0-7：持柄到 window.__juA11yObserver，供 pagehide 统一 disconnect（IIFE 内不再保留局部 const） */
  (window as any).__juA11yObserver=new MutationObserver((muts: MutationRecord[])=>{
    for(const m of muts){
      if(m.type==='attributes'&&m.attributeName==='class'){
        const t: any=m.target;
        if(t&&t.nodeType===1&&t.classList){
          if(t.classList.contains('sb-subtree')||t.classList.contains('cal-grid'))schedule(t);
          else if(t.closest){const sub=t.closest('.sb-subtree');if(sub)schedule(sub);}
        }
        continue;
      }
      for(const n of Array.from(m.addedNodes)){
        if(n&&n.nodeType===1)schedule(n);
      }
    }
  });
  (window as any).__juA11yObserver.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  try{deps.JU.lifecycle.add(function(){const ob=(window as any).__juA11yObserver;if(ob)ob.disconnect();});}catch(e){console.warn('[JU] caught error',e);}
}

/* ============================================================
   M3 · 批次 AT · 3 万节点性能夹具装载（`?fixture=30k`）
   ============================================================ */
/**
 * 基准专用入口：URL 带 `?fixture=30k` 时把 `public/30k-fixture.json`（30,000 节点）
 * 作为初始状态返回；其余情况返回 null，由既有装载链（桌面 / 加密 / 本地存储 / 自动备份）
 * 原样接管。约束（零漂移）：
 *   - 不新增分支到既有装载链内部，调用点仅在其**之前**做一次「有夹具则覆盖 initial」；
 *   - 任何失败（网络不可达 / JSON 非法 / 结构缺 rootId）均返回 null 并告警，
 *     等价于该参数不存在，常规启动行为零变化。
 */
async function loadBenchFixture(): Promise<any> {
  try{
    if(typeof location==='undefined'||typeof fetch!=='function')return null;
    const q=new URLSearchParams(location.search);
    if(q.get('fixture')!=='30k')return null;
    const res=await fetch('/30k-fixture.json',{cache:'no-store'});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data: any=await res.json();
    if(!data||typeof data!=='object'||!data.nodes||!data.rootId||!data.nodes[data.rootId]){
      throw new Error('fixture shape invalid');
    }
    /* 历史快照兼容归一：夹具无 tagColors 时补空对象（与下方既有归一同一口径） */
    if(typeof data.tagColors==='undefined')data.tagColors={};
    /* 【fix5 · P1】夹具无全局标签索引时补空数组（与 ensureShape 同一口径） */
    if(!Array.isArray(data._tags))data._tags=[];
    return data;
  }catch(e){
    console.warn('[JU] bench fixture load failed',e);
    return null;
  }
}

/* ============================================================
   核心启动
   ============================================================ */
export async function boot(): Promise<void> {
  const ui=deps.ui;
  /* Track B · 免费版默认态 + 授权码复核：仅在签名有效且未过期时置 isPro；无效授权码当场清除。 */
  if(typeof ui.isPro!=='boolean')ui.isPro=false;
  try{ui.isPro=await restoreLicense();}catch(e){console.warn('[JU] license restore failed',e);}
  const _win: any = window;
  let initial: any=null;
  /* PENDING_KEY 为历史遗留（旧版本加密态下同步写的明文暂存），新版不再写入；
     启动即清理残留，避免被误当作新数据。 */
  try{localStorage.removeItem(deps.PENDING_KEY);}catch(e){console.warn('[JU] caught error',e);}
  deps.setIsDesktop(deps.detectDesktop());
  if(deps.isDesktop()){
    try{
      const snap=await deps.dsLoadState();
      if(snap&&snap.encStore){
        /* 加密库在 SQLite 中：解锁后解密，走同一迁移归一 */
        ui.encrypted=true;
        let st: any=null;
        try{st=await deps.promptUnlock(JSON.parse(snap.encStore));}catch(e){st=null;}
        if(st){
          ui.locked=false;
          const ab=await deps.loadAutoBackupAsync();
          if(ab&&ab.ui)deps.applyUIFields(ab.ui);
          /* 【review11-01 · ISSUE-001】主库可读时以主库为准，快照仅作一次性灾备 */
          initial=(st&&st.nodes&&st.nodes[st.rootId])?deps.migrateOrBackup(st):(ab?deps.migrateStateObject(ab.state):deps.defaultState());
        }else{
          ui.encKey=null;ui.locked=true;
          initial=deps.defaultState();
        }
        deps.loadUI();
      }else if(snap&&snap.hasData&&snap.state&&snap.state.nodes){
        initial=deps.migrateOrBackup(snap.state);
        purgeLocalCopy('PREIMPORT');
        /* 【fix43-2 · ISSUE-002】desktopUiApplied 只在「快照确实带 ui 字段」时置位：
           load_state 归一只产出 {hasData,state}，无 snap.ui 时若仍置位，尾段 loadUI() 会早退，
           juju.ui.v31 里的主题 / 布局偏好永不恢复（桌面端 UI 偏好丢失）。 */
        if(snap.ui&&typeof snap.ui==='object'){
          deps.applyUIFields(snap.ui);
          if(typeof snap.ui.theme==='string')document.documentElement.dataset.theme=snap.ui.theme;
          ui.desktopUiApplied=true;
        }
        if(snap.graphpos&&typeof snap.graphpos==='object')deps.setGraphPositions(snap.graphpos);
        if(snap.remindSent&&typeof snap.remindSent==='object'){try{localStorage.setItem(deps.REMIND_SENT_KEY,JSON.stringify(snap.remindSent));}catch(e){console.warn('[JU] caught error',e);}}
        deps.applyScale();
      }else{
        /* SQLite 为空：把浏览器遗留库（含旧 JSON / 加密库）迁移进桌面版 */
        if(deps.hasEncryptedStore()){
          initial=await deps.promptUnlock();
          if(!initial){
            ui.encrypted=true;
            ui.encKey=null;
            ui.locked=true;
            initial=deps.defaultState();
          }else{
            ui.locked=false;
            const ab=await deps.loadAutoBackupAsync();
            if(ab&&ab.ui)deps.applyUIFields(ab.ui);
            /* 【review11-01 · ISSUE-001】主库可读时以主库为准，快照仅作一次性灾备 */
            initial=(initial&&initial.nodes&&initial.nodes[initial.rootId])?deps.migrateOrBackup(initial):(ab?deps.migrateStateObject(ab.state):deps.defaultState());
          }
        }else{
          const legacy=deps.loadState();
          const ab=deps.loadAutoBackup();
          const src=legacy?deps.migrateStateObject(legacy):(ab?deps.migrateStateObject(ab.state):null);
          if(!legacy&&ab&&ab.ui)deps.applyUIFields(ab.ui);
          initial=src||deps.defaultState();
          if(!legacy&&ab)deps.toast('主数据不可读，已从自动备份恢复');
        }
        deps.loadUI();
      }
    }catch(e){
      console.error('[JU] desktop load failed, fallback browser mode',e);
      deps.setIsDesktop(false);
      ui.desktopUiApplied=false;
      initial=null;
    }
  }
  /* M3 · 批次 AT：`?fixture=30k` 基准入口——夹具优先作为 initial（先于 initStore），
     保证每次基准的起始态可复现；未带该参数时此处为 null，装载链逐字不变。 */
  {
    const _fx=await loadBenchFixture();
    if(_fx)initial=_fx;
  }
  if(!initial){
    if(deps.hasEncryptedStore()){
      initial=await deps.promptUnlock();
      if(!initial){
        /* 取消解锁 → 锁定态：不初始化真实数据、不写盘、不覆盖加密库 */
        ui.encrypted=true;
        ui.encKey=null;
        ui.locked=true;
        initial=deps.defaultState();
      }else{
        ui.locked=false;
        const ab=await deps.loadAutoBackupAsync();
        if(ab&&ab.ui)deps.applyUIFields(ab.ui);
        /* 【review11-01 · ISSUE-001】主库可读时以主库为准，快照仅作一次性灾备 */
        initial=(initial&&initial.nodes&&initial.nodes[initial.rootId])?deps.migrateOrBackup(initial):(ab?deps.migrateStateObject(ab.state):deps.defaultState());
      }
    }else{
      const stored=deps.loadState();
      if(stored){
        initial=deps.migrateOrBackup(stored);
        purgeLocalCopy('PREIMPORT');
      }else{
        const ab=await deps.loadAutoBackupAsync();
        initial=ab?deps.migrateOrFallback(ab.state):deps.defaultState();
        if(ab)deps.toast('主库不可读，已自动恢复到最近一次备份');
      }
    }
  }
  /* 兼容旧版本数据：历史快照（含解密数据）无 tagColors 字段，初始化空对象，避免选色写入时报错 */
  if(initial&&typeof initial.tagColors==='undefined')initial.tagColors={};
  /* 【fix5 · P1】历史快照无全局标签索引：补空数组，避免新建标签写入时报错 */
  if(initial&&!Array.isArray(initial._tags))initial._tags=[];
  /* 【fix33-8 · ISSUE-013】删除旧形状（{state,ts,ttl}）的 juju.pending.v1 分支：该 key 的写入方
     persist.ts 使用 {payload,ts,ttl}，旧分支永不命中且可能抢先覆盖 initial；崩溃/加密兜底统一
     由 recoverPendingEncrypted 承担（boot 尾部与 visible 事件各触发一次，幂等）。 */
  deps.initStore(initial);
  deps.ensureCalendarRoot();
  try{await deps.VDB.ensure();}catch(e){console.warn('[JU] caught error',e);}
  try{await deps.migrateVersionsFromLS();}catch(e){console.warn('[JU] caught error',e);}
  /* 桌面版：迁移完成后立即落盘到 SQLite（含自动备份） */
  try{deps.flushPersistNow();}catch(e){console.warn('[JU] caught error',e);}
  await deps.loadUIEncrypted();
  deps.loadUI();
  const initTheme=document.documentElement.dataset.theme||'day';
  deps.applyTheme(initTheme);
  deps.applySystemTheme();
  {
    const S=deps.getState()||{nodes:{},rootId:null};
    if(!ui.currentDocId||!S.nodes[ui.currentDocId]){
      const root=S.nodes[S.rootId];
      const first=root&&Array.isArray(root.children)
        ?root.children.map((id: any)=>S.nodes[id]).find((n: any)=>n&&!n._isCalRoot&&!n._isDbRoot)
        :null;
      ui.currentDocId=first?first.id:S.rootId;
    }
  }
  /* FIX-R-27: 窄屏默认收起侧栏（抽屉模式），避免遮挡内容 */
  /* 【fix5 · D-10】折叠阈值 768 → 720（下调；参考 900→720 的建议口径）。
     注意：window.innerWidth **本身就是 CSS 像素**，不要再除 devicePixelRatio。
     命中折叠时打一行取证日志：第五轮复现到的用户真实视口是 533×400 CSS（= exe 816×639 物理 @150%）。 */
  const NARROW_FOLD_MAX=720;
  if(window.innerWidth<=NARROW_FOLD_MAX){
    ui.sidebarLeftCollapsed=true;ui.sidebarRightCollapsed=true;
    console.info('[JU] 窄视口折叠 innerWidth='+window.innerWidth+' innerHeight='+window.innerHeight
      +' dpr='+window.devicePixelRatio+' 条件=innerWidth<='+NARROW_FOLD_MAX
      +' ⇒ 左右侧栏折叠，底部工具条改为固定左下 40×40（style.css 的 body.sb-left-collapsed .sb-tools）');
  }
  if(ui.sidebarLeftCollapsed){($('#sidebarLeft') as HTMLElement).classList.add('collapsed');($('#btnToggleLeft') as HTMLElement).classList.add('collapsed');document.body.classList.add('sb-left-collapsed');}
  if(ui.sidebarLeftWidth&&ui.sidebarLeftWidth!==230){document.documentElement.style.setProperty('--sidebar-left-w',Math.min(ui.sidebarLeftWidth,window.innerWidth*0.35)+'px');} /* FIX-7: 恢复侧栏宽时按视口比例钳制，窗口缩小后自动回收 */
  if(ui.sidebarRightWidth&&ui.sidebarRightWidth!==250){document.documentElement.style.setProperty('--sidebar-right-w',Math.min(ui.sidebarRightWidth,window.innerWidth*0.25)+'px');} /* FIX-R4-2: 右栏宽度按视口比例钳制恢复 */
  if(ui.sidebarRightCollapsed){($('#sidebarRight') as HTMLElement).classList.add('collapsed');($('#btnToggleRight') as HTMLElement).classList.add('collapsed');}
  if(deps.floatCalVisible()){($('#floatCal') as HTMLElement).hidden=false;deps.ensureElInViewport($('#floatCal'));}
  /* M1-2 · 批次 AQ：UI 绑定段收敛为单点 try/catch。
     【批次 CW】单点 try/catch 升级为**逐项独立守卫**：此前 `bindRightSidebar` 在迁移期骨架
     DOM（`#sidebarRight` 空容器）上抛 TypeError 后，整段绑定直接跳到 catch，
     `bindSettings` / `initPomo` / `initSettingsDrag` 等后续绑定**永不执行**
     （实测告警：`[JU] ui bind failed (skeleton DOM)`，设置面板因此没有齿轮入口）。
     现在任一绑定失败只记录该绑定名并继续下一项，DOM 齐备时调用顺序与语义逐字不变；
     全部成功时不输出任何告警（与产品件行为一致）。 */
  const uiBindSteps: Array<[string, () => void]> = [
    ['bindTheme', () => deps.bindTheme()],
    ['bindTopbar', () => deps.bindTopbar()],
    ['bindSidebar', () => deps.bindSidebar()],
    ['bindTools', () => deps.bindTools()],
    ['bindMainToggles', () => deps.bindMainToggles()],
    ['bindRightSidebar', () => deps.bindRightSidebar()],
    ['bindSettings', () => deps.bindSettings()],
    ['bindReminder', () => bindReminder()],
    ['initPomo', () => initPomo()],
    ['initFloatCalDrag', () => initFloatCalDrag()],
    ['initSettingsDrag', () => initSettingsDrag()],
    ['initJuDnd', () => deps.initJuDnd()],
    ['initJuModules', () => deps.initJuModules()],
    ['initJuSlides', () => deps.initJuSlides()],
  ];
  const uiBindFailed: string[] = [];
  for (const [_bindName, _bindFn] of uiBindSteps) {
    try { _bindFn(); }
    catch (e) { uiBindFailed.push(_bindName); console.warn('[JU] ui bind failed: ' + _bindName, e); }
  }
  /* 【批次1-4 修复】JU_DND._initNavGroups 必须在 DOM 渲染完成、且 JU_MODULES 完成 .sb-module-group 包裹之后执行：
     首帧同步调用一次后再补两次异步兜底（init 已幂等，只补挂缺失的手柄，不重复插右侧分区手柄）。 */
  setTimeout(function(){try{deps.initJuDnd();}catch(e){console.warn('[JU] caught error',e);}},0);
  setTimeout(function(){try{if(_win.JU_DND&&_win.JU_DND.ensureNavGrips)_win.JU_DND.ensureNavGrips();}catch(e){console.warn('[JU] caught error',e);}},300);
  if(!ui.activeKey){
    const S=deps.getState()||{nodes:{},rootId:null};
    const cur=ui.currentDocId?S.nodes[ui.currentDocId]:null;
    const v=cur?deps.viewOf(cur):'library-root';
    if(v==='calendar')deps.setActiveKey('nav:calendar');
    else if(v==='database')deps.setActiveKey('nav:database');
    else if(cur)deps.setActiveKey('node:'+cur.id);
    else deps.setActiveKey('nav:files');
  }
  deps.subscribe(()=>{deps.scheduleRender();});
  /* 【P0-2 S2】多标签页同步：BroadcastChannel + storage 事件
     M1-2 · 批次 AQ：改为初始化 core/persist 的 **真实 STORE_BC_INSTANCE 单例**
     （`initStoreBc()`），使落盘侧的 `_broadcastRev()` 与本处接收处理器共用同一通道实例。 */
  try{
    const _storeBc=initStoreBc();
    if(!_storeBc)throw new Error('BroadcastChannel unavailable');
    deps.setStoreBc(_storeBc);
    _storeBc.onmessage=(e: MessageEvent)=>{
      const d=e.data||{};
      /* FIX-REV-1: 门控只看 updatedAt——rev 是各标签页独立的写盘计数、跨标签不可比，
         两标签均写到 rev=5 时按 rev 拒绝会漏合并对端内容。严格小于才跳过：
         同毫秒平局的广播继续走 mergeRemoteIfNewer，由节点级 LWW + 指纹守卫天然收敛。 */
      const S=deps.getState();
      if((d.updatedAt||0)<((S&&S.updatedAt)||0))return;
      /* 收到通知后重读存储 */
      try{
        if(ui.encrypted&&ui.encKey){
          /* 【修复 2026-09-27】加密模式：本地已持有密钥，解密对端密文后合并（浏览器版） */
          const _mergeEnc=(payload: any)=>{if(payload)deps.decryptState(payload,ui.encKey).then((st: any)=>{if(st&&st.nodes)deps.mergeRemoteIfNewer(st);}).catch(()=>{});};
          if(deps.isDesktop()){
            /* FIX-P0-3: 桌面版密文在 SQLite（meta.enc_store），localStorage[ENC_KEY] 为 null——
               直接 readEncryptedStore() 会静默失效，多标签/多窗口加密同步中断。改为从后端 load_state 取 encStore */
            deps.dsLoadState().then((snap: any)=>{
              if(snap&&snap.encStore){try{_mergeEnc(JSON.parse(snap.encStore));}catch(e){console.warn('[JU] caught error',e);}}
            }).catch(()=>{});
          }else{
            _mergeEnc(deps.readEncryptedStore());
          }
          return;
        }
        const raw=localStorage.getItem(deps.STORE_KEY);
        deps.onRemoteStoreChange(raw);
      }catch(err){console.warn('[JU] caught error',err);}
    };
  }catch(e){deps.setStoreBc(null);}
  window.addEventListener('storage',(e: StorageEvent)=>{
    if(e.key===deps.STORE_KEY)deps.onRemoteStoreChange(e.newValue);
    else if(e.key===deps.ENC_KEY&&ui&&ui.encrypted&&ui.encKey){
      /* 【修复 2026-09-27】加密模式：另一标签写入了新密文，用本地密钥解密后合并 */
      const payload=deps.readEncryptedStore();
      if(payload)deps.decryptState(payload,ui.encKey).then((st: any)=>{if(st&&st.nodes)deps.mergeRemoteIfNewer(st);}).catch(()=>{});
    }
  });
  let _snapTimer: any=null;
  let _lastSnapAt=0;
  const SNAP_IDLE_MS=2000;
  const SNAP_MIN_INTERVAL=60000;
  deps.subscribe(()=>{
    clearTimeout(_snapTimer);
    const sinceLast=Date.now()-_lastSnapAt;
    const wait=sinceLast>=SNAP_MIN_INTERVAL?SNAP_IDLE_MS:Math.max(SNAP_IDLE_MS,SNAP_MIN_INTERVAL-sinceLast);
    _snapTimer=setTimeout(()=>{
      _lastSnapAt=Date.now();
      deps.takeVersionSnapshot();
    },wait);
  });
  /* FIX-M-25 时钟 interval 句柄化：切后台时 clear、回前台时重启，避免隐藏标签页仍每秒跑 tickClock */
  let _clockTimer: any=null;
  const _startClock=()=>{deps.tickClock();if(!_clockTimer)_clockTimer=setInterval(()=>deps.tickClock(),1000);};
  const _stopClock=()=>{if(_clockTimer){clearInterval(_clockTimer);_clockTimer=null;}};
  _startClock();
  /* FIX-M-07 recoverPendingEncrypted 原仅在 boot 调用一次（L2322）；
     若 boot 时未解锁（ui.encKey 未就绪）或切后台期间写入了新的 PENDING_SYNC_KEY 兜底，
     回前台 visible 时补一次幂等重试。_recoveringPending 运行中标志避免并发/连续触发导致重复解密-合并-解锁 */
  let _recoveringPending=false;
  const _recoverPendingOnce=()=>{
    if(_recoveringPending)return;
    if(!(typeof deps.recoverPendingEncrypted==='function'))return;
    _recoveringPending=true;
    Promise.resolve(deps.recoverPendingEncrypted()).catch(()=>{}).then(()=>{_recoveringPending=false;});
  };
  ($('#content') as HTMLElement).addEventListener('scroll',(e: Event)=>{ui._lastScroll=(e.target as HTMLElement).scrollTop;},{passive:true});
  deps.applyModuleConfig();
  deps.renderMain();deps.renderFloatCal();deps.updateRightSidebar();deps.updateSidebarActiveState();
  deps.updateEncryptSwitch();
  initReminder();
  /* 【修复 2026-09-27】启动后恢复崩溃窗口的加密兜底数据（同标签页刷新场景） */
  deps.recoverPendingEncrypted();
  if(ui.locked)deps.showLockOverlay();
  document.addEventListener('keydown',(e: KeyboardEvent)=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
      const ae: any=document.activeElement;
      if(ae&&(ae.isContentEditable||ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'))return;
      e.preventDefault();
      const inp=$('#searchInput') as HTMLInputElement|null;
      if(inp){inp.focus();inp.select();}
    }
  });
  window.addEventListener('beforeunload',flushBeforeUnload);
  /* 【fixed17 D-03】窗口失焦时清理所有拖拽视觉状态，防止 mouseup 丢失导致卡住 */
  window.addEventListener('blur',()=>{
    document.querySelectorAll('.sb-row.dragging,.sb-row.drop-before,.sb-row.drop-after,.sb-row.drop-child').forEach(r=>{r.classList.remove('dragging','drop-before','drop-after','drop-child');});
    document.body.classList.remove('sb-resizing');
    /* L23 · 失焦补收尾：大纲拖拽 / 框选中途失焦时 mouseup 丢失 ⇒ 幽灵节点、落位指示线、userSelect 残留 */
    try{const ds=(_win as any)._dragState;if(ds&&_win.outlineDragEnd)_win.outlineDragEnd({clientX:0,clientY:0,button:0});}catch(e){console.warn('[JU] caught error',e);}
    try{if((_win as any)._outlineDragSel&&_win.outlineDragSelectDetach)_win.outlineDragSelectDetach();}catch(e){console.warn('[JU] caught error',e);}
  });
  function flushBeforeUnload(): void {
    try{
      const ae: any=document.activeElement;
      if(ae&&ae.blur&&(ae.isContentEditable||ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')){
        ae.blur();
      }
    }catch(e){console.warn('[JU] caught error',e);}
    try{deps.flushPendingSession();}catch(e){console.warn('[JU] caught error',e);} /* 【P0-3】关页前同步写 sessionStorage 兜底 */
    try{deps.flushPersistNow();}catch(e){console.warn('[JU] caught error',e);}
    try{deps.flushGraphPositions();}catch(e){console.warn('[JU] caught error',e);} /* L16-W14 · 指令 5：关页前强制 flush 防抖中的图形位置（300ms 窗口不丢） */
    try{_win.__juFlushErrors&&_win.__juFlushErrors();}catch(e){console.warn('[JU] caught error',e);} /* 【F12/fixed19】关页前 flush 离线错误队列（sendBeacon） */
    /* 【P0-L3 Step4 P1-3】待落盘 activity 日志断言：关页前仍有未落盘日志则告警并尝试补齐，不阻塞关页 */
    try{const lt=deps.getLogTimers();if(lt&&lt.size!==0){console.warn('[JU] 关页前仍有 '+lt.size+' 条日志待落盘');deps.flushPendingLogs();}}catch(e){console.warn('[JU] caught error',e);}
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      _stopClock(); /* FIX-M-25 切后台暂停时钟 interval */
      try{
        const ae: any=document.activeElement;
        if(ae&&ae.blur&&(ae.isContentEditable||ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'))ae.blur();
      }catch(e){console.warn('[JU] caught error',e);}
      try{deps.flushPendingSession();}catch(e){console.warn('[JU] caught error',e);} /* 【P0-3】切后台时同步兜底 */
      /* FIX-ERR-FLUSH: 切后台/隐藏时也 flush 离线错误队列（原仅 beforeunload，直接 kill 会丢队列） */
      try{_win.__juFlushErrors&&_win.__juFlushErrors();}catch(e){console.warn('[JU] caught error',e);}
      /* 【修复 F-15】切后台/关页前立即启动加密写兜底（不等 200ms 防抖），争取在页面销毁前完成 */
      if(ui&&ui.encrypted&&ui.encKey){
        try{
          clearTimeout(deps.getEncFallbackTimer());deps.setEncFallbackTimer(null);
          deps.encryptState(deps.getState(),ui.encKey).then((payload: any)=>{
            deps.setLastEncPayload(payload);
            try{sessionStorage.setItem(deps.PENDING_SYNC_KEY,JSON.stringify({payload,ts:Date.now(),ttl:60000}));}catch(e){console.warn('[JU] caught error',e);}
          }).catch(()=>{});
        }catch(e){console.warn('[JU] caught error',e);}
      }
    }else{
      _startClock(); /* FIX-M-25 回前台恢复时钟 interval 并立即刷一次 */
      /* FIX-M-07 回前台时幂等重试崩溃窗口加密兜底恢复（运行中标志 + 函数内部 PENDING_SYNC_KEY 取后即删 保证不重复解锁） */
      if(document.visibilityState==='visible')_recoverPendingOnce();
    }
    deps.flushPersistNow();
    const w=deps.getGraphWorker();
    if(!w)return;
    if(!w.ready)return;
    if(document.hidden)w.pause();
    else w.resume();
  });
  /* ===== M0-7 · 页面卸载统一清理（生命周期注册表）=====
     10 项资源改为 JU.lifecycle.add 注册（各模块自持释放闭包），pagehide 仅触发
     JU.lifecycle.dispose() 统一释放；每项独立 try/catch，任何一项失败都不阻断其余项。 */
  const JU=deps.JU;
  /* 1. 跨标签广播通道（M1-2：同时下线 core/persist 的单例引用，避免 pagehide 后持柄） */
  JU.lifecycle.add(function(){try{const bc=deps.getStoreBc();if(bc)bc.close();}catch(e){console.warn('[JU] caught error',e);}try{deps.setStoreBc(null);}catch(e){console.warn('[JU] caught error',e);}try{setStoreBcInstance(null);}catch(e){console.warn('[JU] caught error',e);}});
  /* 2. 块间让出宏任务通道（MessageChannel）与待执行队列 */
  JU.lifecycle.add(function(){try{const ch=deps.getL7YieldCh();if(ch){ch.port1.close();ch.port2.close();}}catch(e){console.warn('[JU] caught error',e);}try{deps.setL7YieldCh(null);const q=deps.getL7YieldQ();if(q&&q.length)q.length=0;}catch(e){console.warn('[JU] caught error',e);}});
  /* 3. 模态栈 ↔ #app inert 观察者 */
  JU.lifecycle.add(function(){try{const ob=deps.getSyncAppInertObserver();if(ob)ob.disconnect();}catch(e){console.warn('[JU] caught error',e);}try{deps.setSyncAppInertObserver(null);}catch(e){console.warn('[JU] caught error',e);}});
  /* 4. 键盘可达性（roving tabindex）观察者 */
  JU.lifecycle.add(function(){try{const ob=(window as any).__juA11yObserver;if(ob)ob.disconnect();}catch(e){console.warn('[JU] caught error',e);}try{(window as any).__juA11yObserver=null;}catch(e){console.warn('[JU] caught error',e);}});
  /* 5. 提醒轮询定时器 */
  JU.lifecycle.add(function(){try{const t=deps.getReminderTimer();if(t){clearInterval(t);}}catch(e){console.warn('[JU] caught error',e);}try{deps.setReminderTimer(null);}catch(e){console.warn('[JU] caught error',e);}});
  /* 6. 番茄钟定时器 */
  JU.lifecycle.add(function(){try{const ps=getPomoState();if(ps&&ps.timer){clearInterval(ps.timer);}}catch(e){console.warn('[JU] caught error',e);}try{const ps2=getPomoState();if(ps2)ps2.timer=null;}catch(e){console.warn('[JU] caught error',e);}});
  /* 7. 索引 Worker（terminate + revoke Blob URL） */
  JU.lifecycle.add(function(){try{deps.indexWorkerDispose(true);}catch(e){console.warn('[JU] caught error',e);}});
  /* 8. 图谱布局 Worker（dispose 内 terminate + revoke Blob URL） */
  JU.lifecycle.add(function(){try{const w=deps.getGraphWorker();if(w)w.dispose();}catch(e){console.warn('[JU] caught error',e);}});
  /* 9. 长任务采样观察者（vsMetric） */
  JU.lifecycle.add(function(){try{if((window as any).__juVsLongtaskObserver)(window as any).__juVsLongtaskObserver.disconnect();}catch(e){console.warn('[JU] caught error',e);}try{(window as any).__juVsLongtaskObserver=null;}catch(e){console.warn('[JU] caught error',e);}});
  /* 10. L14 长任务闸门观察者（不置 null：闸门模块本身保留，重进页面可重新 bind） */
  JU.lifecycle.add(function(){try{const g=deps.getL14LongtaskGate();if(g&&g.observer)g.observer.disconnect();}catch(e){console.warn('[JU] caught error',e);}});
  window.addEventListener('pagehide',()=>{
    try{JU.lifecycle.dispose();}catch(e){console.warn('[JU] lifecycle dispose',e);}
  });
  /* M1-2 · 批次 AQ：启动成功后完成初始落盘（runPersist 内部按 加密 / 桌面 / 明文 三通道选择），
     保证首帧数据在磁盘上可被其它标签页读到，多标签收敛不依赖首次编辑。 */
  try{deps.persistNow();}catch(e){console.warn('[JU] initial persist failed',e);}
  /* M0-7 拆分前置：稳定导出契约，M1-1 拆分时直接 import 本对象或从它取值；不得新增/删除键名，只能在 M1 阶段扩展。
     M1-1d：本模块不再直接写 `window.JU`——契约键一次性打包交给 `deps.publishJU`，
     由 src/main.ts 的 JU 全局装配点统一落位（全局属性赋值不再散落在各模块）。 */
  const juPatch: Record<string, any> = {
    state: function(){return deps.getState();},
    ui: function(){return ui;},
    commit: deps.commit,
    subscribe: deps.subscribe,
    actions: deps.actions,
    N: deps.N,
  };
  /* M0-7 · 调试全局统一入口：旧 window.__ju* 别名保留至 M1 迁移完成后移除 */
  try{
    const _jw: any = window;
    const _dbg: any = (_jw.JU && _jw.JU.debug) || {};
    _dbg.indexShadow=_jw.__juIndexShadow||null;
    _dbg.skeleton=_jw.__juSkeleton||null;
    _dbg.l14=_jw.__l14||null;
    _dbg.vsMetrics=_jw.__juVsMetrics||null;
    juPatch.debug=_dbg;
  }catch(e){console.warn('[JU] caught error', e);}
  deps.publishJU(juPatch);
  /* M5-1a · 启动链路完成后静默检查一次更新：仅桌面壳进入检查，
     结果不打扰用户（无更新 / 检查失败都不提示），只有确认安装时才由
     updater.checkForUpdates 内部弹确认框。 */
  if(UPDATER_ACTIVE && (deps.isDesktop()||isTauriShell())){
    Promise.resolve(checkForUpdates({silent:true})).catch((e:any)=>{console.warn('[JU] update check failed',e);});
  }
}

/* ============================================================
   启动分发（原文件底部 DOMContentLoaded 引导）
   ============================================================ */
export function start(): void {
  bindGlobalEvents();
  /* M1-3：boot 为长链路装配（DOM 绑定 / 主题 / 工作区模块）。迁移期部分 UI 端口仍为占位，
     boot 中段可能在缺失 DOM 节点处抛错；此处统一捕获并登记到 `JU.__bootError`，
     保证「状态装载 + 多标签同步」这类与 UI 无关的能力不受 UI 装配失败影响。 */
  const runBoot = (): void => {
    Promise.resolve(boot()).catch((e: any) => {
      console.error('[JU] boot failed', e);
      try{(window as any).JU.__bootError=String((e&&e.message)||e);}catch(_e){console.warn('[JU] caught error',_e);}
    });
  };
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',()=>{runBoot();},{once:true});}
  else runBoot();
}
