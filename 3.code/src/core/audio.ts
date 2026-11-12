/**
 * M07 · 本地音频播放（Goldberg Variations）
 *
 * 背景：迁移期 `MUSIC_TRACKS` / `playTrack` / `stopMusic` 在 app/boot.ts 里一直是占位
 * （`MUSIC_TRACKS: []` + 两个 noop），点音乐条目只会命中空实现，番茄钟面板「有按钮没声音」。
 * 本模块以真实 HTMLAudioElement 承接播放，并把音源解析拆成三层：
 *
 *   1) 显式覆盖：`window.__JU_AUDIO_SRC` 或 localStorage `juju.music.src`
 *      —— 用户想指向自己的本地文件时用这一层；
 *   2) Tauri 桌面壳：绝对路径经 `window.__TAURI__.core.convertFileSrc()` /
 *      `window.__TAURI__.tauri.convertFileSrc()` 转成 `http://asset.localhost/...`，
 *      这是 Tauri（WebView2）下唯一能读本地文件的方式；直接写 `file:///...` 会被
 *      WebView2 以「Not allowed to load local resource」拒绝（浏览器同策略）。
 *      转换不可用时退回 `file:///` 规范化 URL（普通浏览器 / file:// 打开时仍有效）；
 *   3) 内置音源：`src/assets/Goldberg Variations.mp3` 以 Vite 资源导入（本工程
 *      `assetsInlineLimit = 100000000`，构建期内联为 data URI），因此打包后的单文件
 *      HTML 与桌面 exe 自带音频，不依赖任何外部路径 —— 换机、断网都能出声。
 *
 * 播放状态经 `bindAudioListener()` 单点回传（app/boot 侧据此同步 `ui.musicPlaying`
 * 与 `renderMusicList()` 的 ▶/⏸ 图标），音量沿用 localStorage `juju.musicvol`
 * 与番茄钟面板既有滑杆口径（0–1 浮点）。
 *
 * 说明：本工程不存在 `OscillatorNode` 合成器实现（全库检索 0 命中），故本模块即
 * 「弃用合成器、改用真实音频文件」的落地形态；音量调节仍由 `setMusicVolume()` 承担。
 */
import bundledGoldberg from '../assets/Goldberg Variations.mp3';
import { toast } from '../ui/common';

/** 音轨形状：与 app/boot.ts 的 `deps.MUSIC_TRACKS` 消费方式（`.id` / 名称）一致 */
export interface MusicTrack {
  id: string;
  name: string;
  /** 解析后的可播放 URL（内置音源为 data URI） */
  src: string;
}

/** 音量持久化键（与 app/boot.ts 的 `musicVol` 同一存储位） */
const VOL_KEY = 'juju.musicvol';
/** 自定义音源覆盖键（存绝对路径） */
const SRC_KEY = 'juju.music.src';
/** 默认音量（与 boot 占位实现一致） */
const DEFAULT_VOL = 0.4;

function safeStorageGet(key: string): string {
  try { return String(localStorage.getItem(key) || ''); } catch (e) { return ''; }
}

function clampVol(v: any): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return DEFAULT_VOL;
  return Math.max(0, Math.min(1, n));
}

function readVol(): number {
  const raw = safeStorageGet(VOL_KEY);
  return raw ? clampVol(raw) : DEFAULT_VOL;
}

/**
 * 绝对路径 → 可播放 URL。
 *
 * Tauri v1（本工程 `src-tauri/tauri.conf.json` 为 v1 口径）把 `convertFileSrc` 挂在
 * `window.__TAURI__.core`（v2）或 `window.__TAURI__.tauri`（v1 的 withGlobalTauri 全局）。
 * 两者都探测；都没有时退回标准的 `file:///` 形式（反斜杠统一为 `/`，逐段 encodeURIComponent，
 * 保证中文目录 `归档` 与空格文件名都能被解析）。
 */
function toPlayableUrl(absPath: string): string {
  const p = String(absPath || '').trim();
  if (!p) return '';
  if (/^(data:|blob:|https?:|tauri:|asset:)/i.test(p)) return p;
  const T: any = (window as any).__TAURI__;
  const conv = T && ((T.core && T.core.convertFileSrc) || (T.tauri && T.tauri.convertFileSrc));
  if (typeof conv === 'function') {
    try {
      const out = conv(p);
      if (out) return String(out);
    } catch (e) { console.warn('[JU] convertFileSrc failed', e); }
  }
  const norm = p.replace(/\\/g, '/');
  const encoded = norm.split('/').map((seg) => encodeURIComponent(seg)).join('/');
  return 'file:///' + encoded.replace(/^\/+/, '');
}

/** 桌面壳是否提供 convertFileSrc（Tauri v1/v2 全局两种挂载点） */
function hasConvertFileSrc(): boolean {
  const T: any = (window as any).__TAURI__;
  return !!(T && ((T.core && T.core.convertFileSrc) || (T.tauri && T.tauri.convertFileSrc)));
}

/**
 * 自定义音源候选：window 覆盖 > localStorage 覆盖。
 *
 * 绝对路径只有在 Tauri 的 `convertFileSrc` 可用时才纳入候选：
 * 浏览器 / WebView2 的 http(s) / tauri:// 页面禁止加载 `file://` 子资源，
 * 盲试绝对路径只会产出一条 `Not allowed to load local resource` 控制台错误，
 * 因此这里在无转换能力时直接跳过，回落到内置音源。
 */
function overrideSources(): { urls: string[]; rejected: string[] } {
  const out: string[] = [];
  const winSrc = (window as any).__JU_AUDIO_SRC;
  if (winSrc) out.push(String(winSrc));
  const lsSrc = safeStorageGet(SRC_KEY);
  if (lsSrc) out.push(lsSrc);
  const urls = out.filter((p) => (/^(data:|blob:|https?:)/i.test(p) ? true : hasConvertFileSrc()));
  return { urls, rejected: out.filter((p) => urls.indexOf(p) < 0).map((p) => p + '：当前环境不能加载本地绝对路径') };
}

/** 内置音源（构建期内联为 data URI；Vite 未内联时回落为相对 URL） */
const BUNDLED_TRACK_SRC: string = String(bundledGoldberg || '');

/** 对外音轨表：app/boot.ts 的 initPomo / renderMusicList 消费 `[0]` */
export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'goldberg', name: 'Goldberg Variations', src: BUNDLED_TRACK_SRC },
];

let audioEl: HTMLAudioElement | null = null;
let playingId: string | null = null;
let volume = readVol();
let onChange: ((id: string | null) => void) | null = null;

/** 播放状态回传（唯一出口；boot 侧据此刷新 ui.musicPlaying 与图标） */
export function bindAudioListener(fn: ((id: string | null) => void) | null): void {
  onChange = fn;
}

function emit(): void {
  try { if (onChange) onChange(playingId); } catch (e) { console.warn('[JU] audio listener failed', e); }
}

/** 当前播放中的音轨 id（未播放为 null） */
export function currentTrackId(): string | null { return playingId; }

/** 设置音量并同步到活动音频元素（0–1，越界自动裁剪；同时落盘 juju.musicvol） */
export function setMusicVolume(v: any): number {
  volume = clampVol(v);
  if (audioEl) { try { audioEl.volume = volume; } catch (e) { console.warn('[JU] set volume failed', e); } }
  try { localStorage.setItem(VOL_KEY, String(volume)); } catch (e) { /* 存储不可用：忽略 */ }
  return volume;
}

/** 停止播放并释放当前元素 */
export function stopMusic(): void {
  const el = audioEl;
  audioEl = null;
  playingId = null;
  if (el) {
    try { el.pause(); } catch (e) { console.warn('[JU] pause failed', e); }
    try { el.removeAttribute('src'); el.load(); } catch (e) { /* 元素可能已卸载 */ }
    try { el.remove(); } catch (e) { /* 可能未挂载 */ }
  }
  emit();
}

/**
 * 创建音频元素并挂到 body（隐藏）。
 *
 * 挂载 DOM 的目的不是显示，而是让真机 / 自动化探针能以
 * `document.querySelector('audio[data-ju-audio]')` 读到真实的播放状态
 * （paused / currentTime / src），避免「口头声称已播放」。
 */
function mountAudio(src: string): HTMLAudioElement {
  const a = document.createElement('audio');
  a.dataset.juAudio = '1';
  a.preload = 'auto';
  a.loop = true;
  a.volume = volume;
  a.style.display = 'none';
  a.src = src;
  document.body.appendChild(a);
  return a;
}

/**
 * 播放指定音轨。
 *
 * 音源解析顺序：覆盖源（window / localStorage）→ 约定本地绝对路径 → 内置音源。
 * 任一源触发 error / play() reject 时自动尝试下一个，全部失败则回到「未播放」态，
 * 保证不会把失败伪装成播放成功。
 */
export function playTrack(id: string): void {
  const track = MUSIC_TRACKS.find((t) => t.id === id) || MUSIC_TRACKS[0];
  if (!track) return;
  stopMusic();
  const chain: string[] = [];
  const ov = overrideSources();
  ov.urls.forEach((p) => { const u = toPlayableUrl(p); if (u) chain.push(u); });
  if (track.src) chain.push(track.src);
  const warn = (): void => { if (ov.urls.length > 0 || ov.rejected.length > 0) toast('自定义音源不可用，已回落到内置曲目'); };
  const targetId = track.id;
  const tryAt = (i: number): void => {
    if (ov.urls.length > 0 && i === ov.urls.length) warn();
    if (i >= chain.length) {
      playingId = null;
      emit();
      warn();
      return;
    }
    let el: HTMLAudioElement;
    try { el = mountAudio(chain[i]); } catch (e) { console.warn('[JU] audio init failed', e); tryAt(i + 1); return; }
    audioEl = el;
    playingId = targetId;
    let settled = false;
    /* 以元素自身事件为准：真正开始出声才置「播放中」，暂停/结束时清空。
       这样即使上层有一次多余的 stopMusic()，只要元素仍在播，状态会被自我纠正。 */
    el.addEventListener('playing', () => { playingId = targetId; if (audioEl === el) emit(); });
    el.addEventListener('pause', () => { if (audioEl === el) { playingId = null; emit(); } });
    const fallback = (): void => {
      if (settled) return;
      settled = true;
      if (audioEl === el) audioEl = null;
      try { el.pause(); } catch (e) { /* 忽略 */ }
      try { el.remove(); } catch (e) { /* 忽略 */ }
      tryAt(i + 1);
    };
    el.addEventListener('error', fallback, { once: true });
    const p: any = el.play();
    if (p && typeof p.then === 'function') {
      p.then(() => { settled = true; emit(); })
        .catch((err: any) => { console.warn('[JU] audio play rejected', err); fallback(); });
    } else {
      emit();
    }
  };
  tryAt(0);
}

