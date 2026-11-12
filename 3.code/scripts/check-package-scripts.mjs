#!/usr/bin/env node
/* 【优化 #10】打包脚本回归门禁：把本轮修掉的三个坑钉死，防止改回去。
   断言：① exe 候选含 app.exe（crate 名为 app）；② prepare-release 含 NSIS setup job；
        ③ release-paths 发布目录为固定名 v${PKG_VERSION}（不带日期）；④ parity 有内容优先跳过。 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const read = (rel) => readFileSync(path.join(PROJECT, rel), 'utf8');
const fails = [];
const need = (rel, needle, label) => {
  if (!existsSync(path.join(PROJECT, rel))) { fails.push(rel + ' 不存在（' + label + '）'); return; }
  if (!read(rel).includes(needle)) fails.push(rel + ' 缺少 `' + needle + '`（' + label + '）');
};

/* ① crate 名为 app → target/release/app.exe 必须在候选列表里 */
need('scripts/prepare-release.mjs', "'app.exe'", 'exe 候选含 app.exe');
need('scripts/check-release-parity.mjs', "'app.exe'", 'exe 候选含 app.exe');
need('scripts/build-all.mjs', "'app.exe'", 'exe 候选含 app.exe');

/* ② 安装包必须进发布清单 */
need('scripts/prepare-release.mjs', 'SETUP_OUT_NAME', 'setup 产物名');
need('scripts/prepare-release.mjs', 'bundle', 'NSIS bundle 路径');

/* ③ 发布目录固定名（不带 -日期），否则 EXE_AFTER_RELEASE 会一直红 */
const rp = read('scripts/release-paths.mjs');
if (/v\$\{PKG_VERSION\}-\$\{BUILD_DATE\}/.test(rp)) fails.push('release-paths.mjs 发布目录仍带日期（应为固定名 v${PKG_VERSION}）');
if (!/export const RELEASE_VERSION = `v\$\{PKG_VERSION\}`/.test(rp)) fails.push('release-paths.mjs RELEASE_VERSION 不是固定名 v${PKG_VERSION}');

/* ④ mtime 假红的内容优先跳过必须还在 */
need('scripts/check-release-parity.mjs', 'distSameAsArchived', 'EXE_STALE 内容优先');
need('scripts/check-release-parity.mjs', 'fpSame', 'EXE_AFTER_SRC 内容优先');

if (fails.length) {
  console.error('[package-scripts] ✗ ' + fails.length + ' 项回归：');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('[package-scripts] ✓ 打包脚本 4 类约束齐备（app.exe 候选 / setup 入清单 / 固定名目录 / 内容优先判定）');
