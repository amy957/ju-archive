#!/usr/bin/env node
/**
 * _update_tree.mjs —— 归档目录结构树生成器（全量递归 · 可复现 · 幂等）
 *
 * 功能：
 *   1. 解析项目根目录 E:\APP\归档（脚本可位于根目录，也可位于 99.开发辅助工具/，自动识别）
 *   2. 递归遍历全部子目录，用树形字符 ├── / └── / │ 格式化输出
 *   3. 以 UTF-8 覆盖写入归档索引（默认 归档结构.txt）
 *
 * 强制忽略：
 *   - .git（任意层级，且不做任何读取）
 * 附加忽略（任意层级，自动生成 / 依赖 / 构建产物）：
 *   - node_modules
 *   - venv
 *   - __pycache__
 *   - dist
 *   - build
 * 附加忽略（避免索引被 vendored 工具链淹没，仅列目录名、不展开子项）：
 *   - 99.开发辅助工具/{node,env,PortableGit}（可重装运行时与 git 发行版，约 1.8 万文件）
 *   - 符号链接目录不递归（防循环）
 *
 * 可复现：默认不写入时间戳，同一磁盘状态重复执行产物字节一致（幂等）；
 *         需要留痕时加 --stamp。
 *
 * 用法：
 *   node _update_tree.mjs                       # 根目录执行，默认输出 ./归档结构.txt
 *   node 99.开发辅助工具/_update_tree.mjs        # 子目录执行，输出到根目录同名文件
 *   node _update_tree.mjs --stamp               # 头部追加生成时间
 *   node _update_tree.mjs --out=90过程材料/归档结构.txt
 *   node _update_tree.mjs --depth=3
 *
 * 退出码：0 = 成功；1 = 失败（根目录解析异常 / 写入失败）
 */

import {
  readdirSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 根目录标识：只有真正的 E:\APP\归档 才同时具备该子目录 */
const ROOT_SENTINEL = '99.开发辅助工具';

/** 项目根目录：脚本在根目录 -> __dirname；脚本在 99.开发辅助工具/ -> 上一级 */
function resolveRoot() {
  const candidates = [__dirname, path.resolve(__dirname, '..')];
  for (const dir of candidates) {
    try {
      if (existsSync(path.join(dir, ROOT_SENTINEL)) && statSync(path.join(dir, ROOT_SENTINEL)).isDirectory()) {
        return dir;
      }
    } catch {
      /* 探测失败则继续下一个候选 */
    }
  }
  return __dirname;
}

const ROOT = resolveRoot();

/** 默认输出（相对根目录，POSIX 分隔符，便于跨机复现） */
const DEFAULT_OUT = '归档结构.txt';

/** 默认递归深度：0 = 不限（全量递归） */
const DEFAULT_DEPTH = 0;

/** 任意层级强制跳过的条目名（.git / 依赖 / 构建产物为任务要求的硬性忽略项） */
const SKIP_NAMES = new Set([
  '.git',
  'node_modules',
  'venv',
  '__pycache__',
  'dist',
  'build',
]);

/** 命中则不展开子项的目录（相对根目录，POSIX 分隔符） */
const NO_RECURSE_REL = new Set([
  '99.开发辅助工具/node',
  '99.开发辅助工具/env',
  '99.开发辅助工具/PortableGit',
]);

/** 解析命令行参数 */
function parseArgs(argv) {
  const opts = { depth: DEFAULT_DEPTH, out: DEFAULT_OUT, stamp: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--stamp') {
      opts.stamp = true;
      continue;
    }
    const m = /^--(depth|out)=(.+)$/.exec(arg);
    if (!m) continue;
    if (m[1] === 'depth') {
      const n = Number.parseInt(m[2], 10);
      if (Number.isInteger(n) && n >= 0) opts.depth = n;
    } else {
      opts.out = m[2];
    }
  }
  return opts;
}

/** 稳定排序：目录在前，同类按码位升序（不依赖 locale，跨机可复现） */
function sortEntries(entries) {
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const dirs = entries.filter((e) => e.isDir).sort((x, y) => cmp(x.name, y.name));
  const files = entries.filter((e) => !e.isDir).sort((x, y) => cmp(x.name, y.name));
  return dirs.concat(files);
}

/** 读取单层目录（容错：无权限 / 路径过长 / 竞态删除时返回空数组） */
function readDirSafe(absDir, relDir) {
  let dirents;
  try {
    dirents = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const d of dirents) {
    if (SKIP_NAMES.has(d.name)) continue;
    const abs = path.join(absDir, d.name);
    const rel = relDir ? relDir + '/' + d.name : d.name;

    let isLink = false;
    let isDir = d.isDirectory();
    if (d.isSymbolicLink()) {
      isLink = true;
      try {
        isDir = statSync(abs).isDirectory();
      } catch {
        isDir = false;
      }
    }
    out.push({ name: d.name, isDir, isLink, abs, rel });
  }
  return sortEntries(out);
}

/** 统计容器 */
function makeStats() {
  return { dirs: 0, files: 0, links: 0, unreadable: 0, collapsed: 0 };
}

/** 递归构建树形行 */
function walk(absDir, relDir, prefix, level, maxDepth, lines, stats, visited) {
  const entries = readDirSafe(absDir, relDir);

  if (entries.length === 0) {
    let readable = true;
    try {
      readdirSync(absDir);
    } catch {
      readable = false;
    }
    if (!readable) {
      stats.unreadable += 1;
      lines.push(prefix + '└── [无法读取：权限或路径过长]');
    }
    return;
  }

  entries.forEach((entry, idx) => {
    const isLast = idx === entries.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const suffix = entry.isDir ? (entry.isLink ? '/ @symlink' : '/') : entry.isLink ? ' @symlink' : '';

    lines.push(prefix + branch + entry.name + suffix);
    if (entry.isDir) stats.dirs += 1;
    else stats.files += 1;
    if (entry.isLink) stats.links += 1;

    if (!entry.isDir) return;
    if (maxDepth !== 0 && level + 1 > maxDepth) return;

    if (NO_RECURSE_REL.has(entry.rel)) {
      stats.collapsed += 1;
      lines.push(childPrefix + '└── [vendored 工具链，未展开]');
      return;
    }

    if (entry.isLink) {
      lines.push(childPrefix + '└── [跳过符号链接目录]');
      return;
    }

    let real = entry.abs;
    try {
      real = realpathSync(entry.abs);
    } catch {
      /* realpath 失败时退化为绝对路径 */
    }
    if (visited.has(real)) {
      lines.push(childPrefix + '└── [跳过循环引用]');
      return;
    }

    visited.add(real);
    walk(entry.abs, entry.rel, childPrefix, level + 1, maxDepth, lines, stats, visited);
    visited.delete(real);
  });
}

/** 生成时间字符串：YYYY-MM-DD HH:mm:ss (UTC+08:00) */
function stamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} (UTC+08:00)`
  );
}

/** 主流程 */
function main() {
  const t0 = Date.now();
  const { depth, out, stamp: withStamp } = parseArgs(process.argv);

  if (!existsSync(ROOT)) {
    console.error(`[FAIL] root not found: ${ROOT}`);
    process.exit(1);
  }
  try {
    if (!statSync(ROOT).isDirectory()) throw new Error('not a directory');
  } catch (err) {
    console.error(`[FAIL] root invalid: ${ROOT} (${err.message})`);
    process.exit(1);
  }

  const outAbs = path.isAbsolute(out) ? out : path.join(ROOT, out);
  const outDir = path.dirname(outAbs);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const body = [];
  const stats = makeStats();
  const visited = new Set([realpathSync(ROOT)]);
  walk(ROOT, '', '', 1, depth, body, stats, visited);

  const header = [
    'JU 工作台归档 · 目录结构索引',
    ...(withStamp ? [`生成时间：${stamp()}`] : []),
    `项目名称：${path.basename(ROOT)}`,
    `项目根目录：${ROOT}`,
    `递归深度：${depth === 0 ? '不限（全量递归）' : `${depth} 层`}`,
    '强制忽略：.git（任意层级）',
    '附加忽略：node_modules / venv / __pycache__ / dist / build（任意层级）、99.开发辅助工具/{node,env,PortableGit}（vendored 工具链，仅列目录名）、符号链接目录不递归',
    `统计：目录 ${stats.dirs} 个 · 文件 ${stats.files} 个 · 符号链接 ${stats.links} 个 · 未展开工具链 ${stats.collapsed} 个 · 不可读目录 ${stats.unreadable} 个`,
    '',
  ];
  const text = header.concat(body).join('\n') + '\n';

  try {
    writeFileSync(outAbs, text, { encoding: 'utf8' });
  } catch (err) {
    console.error(`[FAIL] write failed: ${outAbs} (${err.message})`);
    process.exit(1);
  }

  const elapsed = Date.now() - t0;
  console.log(`[OK] stamp   = ${withStamp ? 'on' : 'off (deterministic)'}`);
  console.log(`[OK] root    = ${ROOT}`);
  console.log(`[OK] depth   = ${depth === 0 ? 'unlimited' : depth}`);
  console.log(`[OK] out     = ${outAbs}`);
  console.log(`[OK] bytes   = ${Buffer.byteLength(text, 'utf8')}`);
  console.log(`[OK] lines   = ${text.split('\n').length - 1}`);
  console.log(`[OK] dirs    = ${stats.dirs}`);
  console.log(`[OK] files   = ${stats.files}`);
  console.log(`[OK] entries = ${body.length}`);
  console.log(`[OK] elapsed = ${elapsed} ms`);
  process.exit(0);
}

main();
