/**
 * M1-2 · 批次 AR · 加密适配层（AES-GCM-256 + PBKDF2-SHA256）
 *
 * 来源：6.P0-T3基线/public/v2.0-t3.html（canonical，只读，零字节改动）
 *   - ENC_KEY / ENC_ITER / PENDING_KEY / VERS_KEY / VERS_ENC_KEY / UI_ENC_KEY ....... 1384-1389
 *   - bufToB64 / b64ToBuf ............................................................ 1401-1402
 *   - _encSalt / _encSaltPwd / _encKey / _encKeySig .................................. 1403-1404
 *   - deriveKey ..................................................................... 1405-1413
 *   - _getOrCreateSalt .............................................................. 1414-1420
 *   - encryptState / decryptState ................................................... 1421-1438
 *   - hasEncryptedStore / readEncryptedStore / writeEncryptedStore ................... 1439-1458
 *   - clearEncryptedStore ........................................................... 1459-1470
 *   - promptUnlock（解密链路 UI）..................................................... 21752-21821
 *
 * 兼容处理（唯一结构差异，均属纯装配层，不改动算法字节）：
 *   产品件中 `toast` / `ui` / `appConfirm` / `_modalStack` / `_syncAppInert` / `IS_DESKTOP` /
 *   `desktopInvoke` / `defaultState` / `VDB.destroy` 均来自单文件全局作用域；本工程拆分为多模块后
 *   以 `CryptoDeps` 显式注入承接（未注入时保持安全 noop，等价于「该全局不存在」的产品语义）。
 *   算法内核（盐复用、key 派生缓存 sig、iter 兼容解密、体积上限、桌面后端回退）逐字保留原注释与判定。
 */
import { purgeLocalCopies } from './local-copies';

/** 加密存储键（与产品件同址同值） */
export const ENC_KEY = 'juju.enc.v1';
/** PBKDF2 迭代数（FIX-enc-1: 250000→600000，对齐 OWASP PBKDF2-SHA256 建议；旧密文按 payload.iter 兼容解密） */
export const ENC_ITER = 600000;
/** 历史遗留明文暂存键（启动期清理用） */
export const PENDING_KEY = 'juju.pending';
/* 批次 DE · 未使用导出复核：三个键名常量仅在本文件内部使用，降级为模块内私有 */
const VERS_KEY = 'juju.versions';
const VERS_ENC_KEY = 'juju.versions.enc';
const UI_ENC_KEY = 'juju.ui.enc';
/** 加密载荷形状（v1：salt / iv / cipher 均为 base64，iter 随载荷写入以兼容旧密文） */
export interface EncPayload {
  v: number;
  salt: string;
  iv: string;
  cipher: string;
  iter: number;
  updatedAt: number;
}

/**
 * 加密适配层依赖（跨模块端口）
 *
 * 说明：本接口只承载产品件的「同作用域符号」，不引入任何加密算法差异；
 * 未注入的端口一律走安全 noop（等价于产品件中该符号为 undefined 的路径）。
 */
export interface CryptoDeps {
  /** 轻提示（对应产品 `toast`） */
  toast: (msg: any) => void;
  /** 全局 ui 单例（对应产品 `ui`：encrypted / encKey / locked 三字段） */
  getUi: () => any;
  /** 默认态（对应产品 `defaultState`，忘记密码重置时返回） */
  defaultState: () => any;
  /** 二次确认（对应产品 `appConfirm`） */
  appConfirm: (msg: string, onOk: () => void) => void;
  /** 模态入栈（对应产品 `_modalStack.push`） */
  mountModal: (el: any) => void;
  /** 模态出栈（对应产品 `_modalStack.splice(indexOf,1)`） */
  unmountModal: (el: any) => void;
  /** 是否为栈顶模态（对应产品 `_modalStack[_modalStack.length-1]===modal`） */
  isTopModal: (el: any) => boolean;
  /** 同步 #app inert（对应产品 `_syncAppInert()`） */
  syncAppInert: () => void;
  /** 桌面壳判定（对应产品 `IS_DESKTOP`） */
  isDesktop: () => boolean;
  /** 桌面壳调用（对应产品 `desktopInvoke`） */
  desktopInvoke: (cmd: string, args?: any) => Promise<any>;
  /** 版本库销毁（对应产品 `VDB.destroy()`；忘记密码重置时清空版本快照） */
  purgeVersions: () => void;
}

/** 依赖默认值：全部安全 noop（加载即不抛错；真实实现由 src/main.ts 装配期注入） */
export const deps: CryptoDeps = {
  toast: (): void => {},
  getUi: () => ({}),
  defaultState: () => ({ nodes: {}, rootId: null }),
  appConfirm: (_msg: string, onOk: () => void): void => { onOk(); },
  mountModal: (): void => {},
  unmountModal: (): void => {},
  isTopModal: () => true,
  syncAppInert: (): void => {},
  isDesktop: () => false,
  desktopInvoke: () => Promise.resolve(null),
  purgeVersions: (): void => {},
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持既有实现）。 */
export function bindCryptoDeps(patch: Partial<CryptoDeps>): void {
  Object.assign(deps, patch);
}

/* 批次 DE · 未使用导出复核：bufToB64 / b64ToBuf / _getOrCreateSalt / clearEncryptedStore
   均只在本文件内部被调用，降级为模块内私有（不改行为）。 */
function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buf as any);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let _encSalt: Uint8Array | null = null;
let _encSaltPwd: string | null = null;
let _encKey: CryptoKey | null = null;
let _encKeySig: string | null = null;

export async function deriveKey(password: string, salt: Uint8Array | ArrayBuffer, iter: number): Promise<CryptoKey> {
  const sig = password + '|' + (salt ? bufToB64(salt as any) : '') + '|' + iter;
  if (_encKey && _encKeySig === sig) return _encKey;
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  /* TS 5.7+ 的 TypedArray 泛型收窄：subtle 的 BufferSource 要求 ArrayBuffer 后端，
     Uint8Array<ArrayBufferLike> 需显式提升（运行期同一字节序列，纯类型层兼容）。 */
  const saltSrc = salt as unknown as BufferSource;
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltSrc, iterations: iter, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  _encKey = key;
  _encKeySig = sig;
  return key;
}

function _getOrCreateSalt(password: string): Uint8Array {
  if (_encSalt && _encSaltPwd === password) return _encSalt;
  _encSalt = crypto.getRandomValues(new Uint8Array(16));
  _encSaltPwd = password;
  _encKey = null;
  _encKeySig = null;
  return _encSalt;
}

export async function encryptState(data: any, password: string): Promise<EncPayload> {
  const salt = _getOrCreateSalt(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ENC_ITER);
  const plain = new TextEncoder().encode(JSON.stringify(data));
  /* 同上：TypedArray 泛型收窄的纯类型层提升（运行期字节序列不变） */
  const ivSrc = iv as unknown as BufferSource;
  const plainSrc = plain as unknown as BufferSource;
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivSrc }, key, plainSrc);
  return { v: 1, salt: bufToB64(salt), iv: bufToB64(iv), cipher: bufToB64(cipher), iter: ENC_ITER, updatedAt: Date.now() };
}

export async function decryptState(payload: EncPayload, password: string): Promise<any> {
  const salt = b64ToBuf(payload.salt);
  const iv = b64ToBuf(payload.iv);
  const key = await deriveKey(password, salt, payload.iter || ENC_ITER);
  /* FIX-enc-2: 缓存解密所用盐到内存，使后续 encryptState→_getOrCreateSalt 复用同一盐与已派生 key，
     避免每次刷新解锁后首次 autosave 重生成新盐并重跑 PBKDF2（100-300ms）。解密始终按 payload.salt 处理，不依赖内存盐。 */
  _encSalt = new Uint8Array(salt);
  _encSaltPwd = password;
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64ToBuf(payload.cipher));
  return JSON.parse(new TextDecoder().decode(plain));
}

export function hasEncryptedStore(): boolean {
  try { return !!localStorage.getItem(ENC_KEY); } catch (e) { return false; }
}

export function readEncryptedStore(): EncPayload | null {
  try { return JSON.parse(localStorage.getItem(ENC_KEY) || 'null'); } catch (e) { return null; }
}

export async function writeEncryptedStore(payload: EncPayload, silent?: boolean): Promise<boolean> {
  try {
    const json = JSON.stringify(payload);
    if (json.length > 4500000) { if (!silent) deps.toast('存储空间不足，请导出备份'); return false; }
    if (deps.isDesktop()) {
      /* 【fix33-2】Tauri unit 命令成功序列化为 null，不得以返回值真值判定成败：
         仅 invoke 抛错视为失败；落盘成功即清理浏览器密文副本 */
      try {
        await deps.desktopInvoke('save_state', { payload: JSON.stringify({ encStore: json }) });
        try { localStorage.removeItem(ENC_KEY); } catch (e) { /* 桌面库已持有密文，浏览器副本可清 */ }
        return true;
      } catch (e) {
        if (!silent) deps.toast('桌面加密存储失败');
        return false;
      }
    }
    localStorage.setItem(ENC_KEY, json);
    return true;
  } catch (e: any) {
    if (!silent) deps.toast('存储失败：' + (e && e.name === 'QuotaExceededError' ? '空间不足' : '未知错误'));
    return false;
  }
}

async function clearEncryptedStore(opts?: { purgeVersions?: boolean }): Promise<void> {
  const purgeVersions = !!(opts && opts.purgeVersions === true);
  /* 【ISSUE-005】桌面密文库必须可等待、失败可见：invoke 抛错即上抛，不得吞掉后
     让调用方误以为已清空并翻转 ui.encrypted=false。失败时本地副本保持不动（不做半清空），
     调用方据此维持锁定态并提示重试。 */
  if (deps.isDesktop()) await deps.desktopInvoke('clear_encrypted', {});
  /* 存储不可用：忽略（清空语义已尽力而为）；每键独立 try/catch 见 local-copies */
  purgeLocalCopies('data');
  if (purgeVersions) { try { deps.purgeVersions(); } catch (e) { /* 版本库不可用 */ } }
}

/**
 * 解锁提示（对应产品件 promptUnlock，21752-21821 逐字迁移）。
 *
 * payloadOverride：桌面版从 SQLite 取出的密文载荷（浏览器版从 localStorage 读）。
 * 返回解密后的 state；取消 / 关闭返回 null；忘记密码返回 defaultState()。
 */
export function promptUnlock(payloadOverride?: EncPayload | null): Promise<any> {
  return new Promise((resolve) => {
    const ui = deps.getUi();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" style="max-width:420px">
        <div class="modal-head"><span>🔒 解锁</span></div>
        <div class="modal-body">
          <div style="margin-bottom:10px;font-size:.86em;color:var(--fg-dim)">此设备上的数据已加密，请输入主密码解锁。</div>
          <input type="password" id="unlockPwd" style="width:100%;padding:8px 10px;border:1px solid var(--line-soft);border-radius:6px;background:var(--bg-mid);outline:none" placeholder="主密码">
          <div id="unlockErr" style="color:var(--danger);font-size:.8em;margin-top:6px;min-height:1.2em"></div>
          <div class="modal-footer">
            <button class="btn" id="unlockReset">忘记密码？</button>
            <button class="btn primary" id="unlockOk">解锁</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    /* FIX-M-23b 接入 _modalStack：打开 push、所有关闭路径 pop，ESC 用 isTop 守卫；
       内嵌 appConfirm（忘记密码）本身已在栈中，其打开会压在本模态之上，关闭 appConfirm 后本模态仍在栈，ESC 顺序正确 */
    deps.mountModal(modal);
    deps.syncAppInert();
    const _isTopUnlock = (): boolean => deps.isTopModal(modal);
    const _popUnlock = (): void => { deps.unmountModal(modal); };
    const pwd = modal.querySelector('#unlockPwd') as HTMLInputElement;
    const err = modal.querySelector('#unlockErr') as HTMLElement;
    const ok = modal.querySelector('#unlockOk') as HTMLButtonElement;
    const reset = modal.querySelector('#unlockReset') as HTMLButtonElement;
    const onKey = (e: KeyboardEvent): void => { if (!_isTopUnlock()) return; if (e.key === 'Escape') { cleanup(); modal.remove(); _popUnlock(); resolve(null); } };
    const cleanup = (): void => document.removeEventListener('keydown', onKey);
    document.addEventListener('keydown', onKey);
    pwd.focus();
    const tryUnlock = async (): Promise<void> => {
      const p = pwd.value;
      if (!p) { err.textContent = '请输入密码'; return; }
      if (!window.crypto || !window.crypto.subtle) { err.textContent = '当前环境不支持加密'; return; }
      ok.disabled = true; ok.textContent = '解锁中…';
      try {
        const payload: any = payloadOverride || readEncryptedStore();
        const st = await decryptState(payload, p);
        ui.encrypted = true; ui.encKey = p;
        /* 解锁成功后清理可能残留的明文（升级/异常路径兜底） */
        try { localStorage.removeItem('juju.store.v31'); } catch (e) { /* 存储不可用：忽略 */ }
        try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* 存储不可用：忽略 */ }
        cleanup(); modal.remove(); _popUnlock();
        resolve(st);
      } catch (e) {
        err.textContent = '密码错误，或数据损坏';
        ok.disabled = false; ok.textContent = '解锁';
        pwd.value = '';
        pwd.focus();
      }
    };
    ok.onclick = (): void => { void tryUnlock(); };
    pwd.onkeydown = (e: KeyboardEvent): void => { if (e.key === 'Enter') void tryUnlock(); };
    /* 【ISSUE-005】清空加密库改为可等待：失败则保持锁定态（不解锁、不落默认态）并提示重试。 */
    const doReset = async (): Promise<void> => {
      try {
        await clearEncryptedStore({ purgeVersions: true });
      } catch (e) {
        try { deps.toast('清空加密库失败，请重试'); } catch (_e) { /* toast 不可用 */ }
        return;
      }
      try { localStorage.removeItem('juju.store.v31'); } catch (e) { /* 存储不可用：忽略 */ }
      purgeLocalCopies('all');
      cleanup(); modal.remove(); _popUnlock();
      ui.encrypted = false; ui.encKey = null; ui.locked = false; /* 【fixed17 #2】重置三字段 */
      resolve(deps.defaultState());
    };
    reset.onclick = (): void => {
      deps.appConfirm('忘记密码将无法恢复加密数据。确定要清空并重新开始吗？', () => { void doReset(); });
    };
  });
}
