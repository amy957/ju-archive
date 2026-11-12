#!/usr/bin/env node
/**
 * 发布产物落位「单一事实来源」（D-05b）
 *
 * 背景（exe 膨胀事故）：
 *   发布归档原先写在 `dist/release/`，而 Tauri v1 按 `tauri.conf.json.build.distDir = ../dist`
 *   **递归内嵌整个 dist 目录**。于是每次 `tauri build` 都会把上一轮的
 *   `dist/release/JU-v2.1-Web.html`（4.6 MB）+ 上一轮 `JU-v2.1-win-x64.exe`（10.4 MB）
 *   一起打进新 exe：exe 从 ~10.4 MB 膨胀到 ~18.9 MB，且内嵌「两份 HTML」。
 *   `build-all.mjs` 与 `vite.config.ts` 曾经用「构建期把 dist/release 搬到 node_modules/.cache
 *   再搬回」的补丁兜住，但直接执行 `npm run tauri build`（不经 build-all）仍然会复发。
 *
 * 处置：发布产物**移出 dist**，落到仓库级
 *   `99.hist/8.rel/<RELEASE_VERSION>/`
 * 使 `dist/` 只剩 `index.html` 一份 HTML —— 内嵌范围天然收敛，不再依赖任何构建期补丁。
 *
 * 本模块是路径常量的唯一出处：`prepare-release.mjs` / `build-all.mjs` / `license-server.mjs`
 * 一律从此处导入，禁止各自硬编码 `dist/release` 或版本目录名。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 工程根（`3.code`） */
export const PROJECT = path.resolve(HERE, '..');

/** 仓库根（`E:/APP/归档`） */
export const REPO_ROOT = path.resolve(PROJECT, '..');

/**
 * 【ISSUE-010】版本号单一事实来源
 *
 * 版本号只在 `3.code/package.json` 的 `version` 维护（`src-tauri/tauri.conf.json`
 * 的 `package.version` 必须与之保持一致，由 `scripts/check-parity.mjs` 之外的人工门禁核对）；
 * 本模块直接读取 package.json，禁止再手写一份版本字符串。
 */
export const PKG_VERSION = String(
  JSON.parse(readFileSync(path.join(PROJECT, 'package.json'), 'utf8')).version || '',
);

/** 本轮构建日期（显式覆盖优先：JU_BUILD_DATE；未设置时取当天 UTC 日期；
    同一版本号不得重复归档，见 prepare-release 守卫） */
export const BUILD_DATE = process.env.JU_BUILD_DATE || new Date().toISOString().slice(0, 10);

/** 本轮发布版本目录名 = `v<package.json version>-<BUILD_DATE>` */
export const RELEASE_VERSION = `v${PKG_VERSION}`; /* 单一发布件目录（不再带日期，历史版本已归档隔离） */

/** 发布归档根目录（各版本归档的父目录） */
export const RELEASE_ROOT = path.join(REPO_ROOT, '99.hist', '8.rel');

/** 发布归档目录（**位于 dist 之外**，不会被 Tauri 递归内嵌） */
export const RELEASE_DIR = path.join(RELEASE_ROOT, RELEASE_VERSION);

/** 构建产物目录（单文件产物：只允许 index.html） */
export const DIST_DIR = path.join(PROJECT, 'dist');

/** Web 单文件产物（vite build 直接输出） */
export const WEB_BUNDLE = path.join(DIST_DIR, 'index.html');

/** 桌面裸 exe 输出目录（tauri build --bundles none） */
export const DESKTOP_RELEASE_DIR = path.join(PROJECT, 'src-tauri', 'target', 'release');

/** 归档文件名（发布版本对外契约名） */
export const WEB_OUT_NAME = 'JU-v2.1-Web.html';
export const EXE_OUT_NAME = 'JU-v2.1-win-x64.exe';
export const CHECKSUMS_NAME = 'JU-v2.1-checksums.txt';
export const MANIFEST_NAME = 'release-manifest.json';

/** 归档目录内的绝对路径（按名取） */
export function releasePath(name) {
  return path.join(RELEASE_DIR, name);
}

/**
 * 读端解析归档目录（ISSUE-004 跨日必红）：
 *   - 显式 `JU_BUILD_DATE`：严格取 `v<版本>-<该日期>`，目录不存在也原样返回，缺目录由调用方判失败，**不静默降级**；
 *   - 未显式（按当天日期滚动）：取含 `release-manifest.json` 的最新归档目录，
 *     避免次日跑 parity 指向尚不存在的日期目录而必红。
 * `.prev-*` 滚期目录不参与选择（历史编号 005）。
 */
export function resolveReleaseDir(dateStr = BUILD_DATE) {
  const name = `v${PKG_VERSION}`;
  /* 单一发布件目录（v2.1.0 固定名）：直接返回，不再扫描历史目录 */
  return path.join(RELEASE_ROOT, name);
}

/**
 * 发布门禁取最新归档目录（ISSUE-002：门禁不得跳过无 manifest 的最新归档）：
 *   - 显式 `JU_BUILD_DATE`：严格取 `v<版本>-<该日期>`，目录不存在也原样返回，由调用方判失败；
 *   - 未显式：取最新非 `.prev-*` 目录，**不按 `release-manifest.json` 过滤**，
 *     最新目录缺清单时由调用方输出 `LATEST_ARCHIVE_NO_MANIFEST` 并失败，禁回退到更旧归档。
 */
export function resolveLatestReleaseDir(dateStr = BUILD_DATE) {
  const name = `v${PKG_VERSION}`;
  /* 单一发布件目录（v2.1.0 固定名）：直接返回，避免字典序把 v2.1.0-<date> 误当“最新” */
  return path.join(RELEASE_ROOT, name);
}

/** 相对工程根的 POSIX 风格路径（日志可读性） */
export function relFromProject(abs) {
  return path.relative(PROJECT, abs).split(path.sep).join('/');
}

/** 相对仓库根的 POSIX 风格路径（跨工程日志可读性） */
export function relFromRepo(abs) {
  return path.relative(REPO_ROOT, abs).split(path.sep).join('/');
}
