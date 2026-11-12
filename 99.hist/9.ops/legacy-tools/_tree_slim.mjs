#!/usr/bin/env node
/**
 * _tree_slim.mjs —— 「修改影响面精简目录树」生成器（只读扫描 · 确定性排序）
 *
 * 目的：生成 / 更新仓库根目录 `归档结构.txt`，只列对修改有价值的条目，
 *       避免全量仓库快照把归档文本撑爆。
 *
 * 规则：
 *   1. 过滤：忽略依赖 / 构建 / 缓存目录与二进制、图片、音视频、字体、压缩包、
 *      锁文件、自动生成文件；
 *   2. 压缩：最大深度 4；每目录最多 12 条（超出记「…（其余 N 项省略）」）；
 *      低价值目录折叠为一行摘要（含 / 结尾）；总行数上限 200，超出继续折叠；
 *   3. 近 2 天变更文件优先保留（不因截断 / 折叠被隐藏）；
 *   4. 输出 UTF-8 纯文本，模板字符 ├── / └── / │   + 每层 4 字符缩进。
 *
 * 用法：
 *   node 99.开发辅助工具/_tree_slim.mjs
 *   node 99.开发辅助工具/_tree_slim.mjs --out=90过程材料/归档结构.txt
 *   node 99.开发辅助工具/_tree_slim.mjs --depth=4 --max-lines=200
 *
 * 退出码：0 = 成功；1 = 失败（根目录解析异常 / 写入失败）。
 */

import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_SENTINEL = '99.开发辅助工具';

/** 项目根：脚本位于 99.开发辅助工具/ ⇒ 上一级 */
function resolveRoot() {
  for (const dir of [HERE, path.resolve(HERE, '..')]) {
    try {
      if (statSync(path.join(dir, ROOT_SENTINEL)).isDirectory()) return dir;
    } catch {
      /* 继续探测下一个候选 */
    }
  }
  return path.resolve(HERE, '..');
}
const ROOT = resolveRoot();

/** 命令行参数 */
const opts = { depth: 4, maxChildren: 12, smallCap: 4, maxLines: 200, out: path.join(ROOT, '归档结构.txt') };
for (const arg of process.argv.slice(2)) {
  const m = /^--(depth|max-lines|max-children|small-cap|out)=(.+)$/.exec(arg);
  if (!m) continue;
  if (m[1] === 'out') opts.out = path.isAbsolute(m[2]) ? m[2] : path.join(ROOT, m[2]);
  else if (m[1] === 'max-children') opts.maxChildren = Math.max(1, Number.parseInt(m[2], 10) || 1);
  else if (m[1] === 'small-cap') opts.smallCap = Math.max(1, Number.parseInt(m[2], 10) || 1);
  else if (m[1] === 'max-lines') opts.maxLines = Math.max(1, Number.parseInt(m[2], 10) || 1);
  else if (m[1] === 'depth') opts.depth = Math.max(1, Number.parseInt(m[2], 10) || 1);
}

/** 任意层级跳过的依赖 / 构建 / 缓存 / 工具链目录 */
const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', 'logs', 'log', 'cache', '.cache',
  'venv', '.venv', '__pycache__', '.next', 'out', 'target', 'vendor', 'playwright-report',
  'test-results', '.turbo', '.vite', '.parcel-cache', '.svelte-kit', 'tmp', '.tmp',
  'PortableGit', 'node', 'env', 'mingw64', 'usr', 'etc', 'cmd', 'bin', 'lib', 'libexec',
]);

/** 跳过的大体积 / 二进制 / 生成物文件后缀 */
const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.avif', '.svg',
  '.mp3', '.mp4', '.wav', '.webm', '.ogg', '.flac', '.mov', '.avi',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.zip', '.7z', '.rar', '.gz', '.tgz', '.bz2', '.xz',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.node', '.pdb', '.lib', '.obj',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf',
  '.lock', '.map', '.pyc', '.class', '.jar', '.wasm', '.tsbuildinfo',
]);

/** 跳过的大体积 / 生成物文件名 */
const SKIP_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'npm-shrinkwrap.json',
  '.DS_Store', 'Thumbs.db', 'desktop.ini',
]);

/** 跳过的大体积 / 生成物文件名模式 */
const SKIP_FILE_RES = [
  /\.min\.(js|css)$/i,
  /\.bak(\b|[-_.])/i,
  /\.log$/i,
  /\.out\.txt$/i,
  /\.tmp$/i,
  /^tmp_/i,
  /^_tmp/i,
  /^~\$/,
];

/** 低价值目录（预先折叠为一行摘要，不展开；内含近 2 天变更则例外展开） */
const BASE_COLLAPSE = new Set([
  '1.历史归档',
  '90过程材料',
  '4.回归与验收/Backup',
  '4.回归与验收/uw-screenshots',
  '6.P0-T3基线/Backup',
  '6.P0-T3基线/baseline',
  '6.P0-T3基线/step1',
  '6.P0-T3基线/step2',
  '6.P0-T3基线/step3',
  '6.P0-T3基线/step4',
  '6.P0-T3基线/step5',
  '6.P0-T3基线/step6',
  '6.P0-T3基线/step7',
  '6.P0-T3基线/step10',
  '6.P0-T3基线/structural-sharing',
  '6.P0-T3基线/step9/P0-T3',
  '6.P0-T3基线/step9/reports',
  '6.P0-T3基线/step9/tools',
  '6.P0-T3基线/m07-vite/docs',
  '6.P0-T3基线/m07-vite/public',
  '8.发布与CI/reports',
]);

/** 一级高价值路径（永不折叠：源码 / 脚本 / 测试 / 门禁 / 规范 / 入口） */
const PROTECTED = new Set([
  '.github',
  '0.规范',
  '6.P0-T3基线',
  '6.P0-T3基线/step9',
  '6.P0-T3基线/step9/scripts',
  '6.P0-T3基线/step9/tests',
  '6.P0-T3基线/step9/t9',
  '6.P0-T3基线/m07-vite',
  '6.P0-T3基线/m07-vite/src',
  '6.P0-T3基线/m07-vite/scripts',
  '6.P0-T3基线/m07-vite/tests',
  '6.P0-T3基线/m07-vite/src-tauri',
  '6.P0-T3基线/m07-vite/server',
  '7.UI交互增强',
  '8.发布与CI/ci',
  '99.开发辅助工具',
]);

/** 二级目录（仅在行数预算超限时优先折叠：日志 / 报告 / 验收 / 性能 / 发布包） */
const TIER_B = new Set([
  '2.项目日志',
  '3.评估报告',
  '4.回归与验收',
  '5.性能基线',
  '8.发布与CI',
  '6.P0-T3基线/step9/P0-T3',
  '6.P0-T3基线/step9/tools',
  '6.P0-T3基线/m07-vite/docs',
  '6.P0-T3基线/m07-vite/public',
  '6.P0-T3基线/m07-vite/test',
  '6.P0-T3基线/m07-vite/.github',
]);

/** 关键入口 / 配置文件（截断时优先保留） */
const IMPORTANT_FILE_RE = /^(package\.json|tsconfig[^/]*\.json|vite\.config\.[^/]+|playwright\.config\.[^/]+|vitest\.config\.[^/]+|\.gitignore|index\.html|Cargo\.toml|tauri\.conf\.json|README\.md|CURRENT_TASK\.md|项目日志\.md|MAINTENANCE\.md|HEAD\.json|verify\.js|verify-hash-registry\.mjs|[^/]+-RELEASE-NOTES\.md|RELEASE-NOTES\.md|release-manifest\.json|JU-不变量清单[^/]*\.md|CURRENT-REGRESSION-MATRIX\.md)$/;

/** 扫描阶段统计（与渲染统计分开，避免被重置） */
const scanStats = { skippedDirs: 0, skippedFiles: 0 };

/** 近 2 天判定窗口 */
const RECENT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const NOW = Date.now();

const stats = {
  skippedDirs: 0,
  skippedFiles: 0,
  shownDirs: 0,
  shownFiles: 0,
  truncations: 0,
  truncatedItems: 0,
  collapsedDirs: 0,
  depthCut: 0,
  recent: 0,
};

const isRecent = (mtime) => NOW - mtime <= RECENT_WINDOW_MS;

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** 单层读取（容错），返回节点数组 */
function readChildren(absDir, relDir) {
  let dirents;
  try {
    dirents = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const d of dirents) {
    const abs = path.join(absDir, d.name);
    const rel = relDir ? relDir + '/' + d.name : d.name;
    if (abs === opts.out) continue; /* 本文件自身不计入 */
    let isDir = d.isDirectory();
    if (d.isSymbolicLink()) {
      try {
        isDir = statSync(abs).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (isDir) {
      if (SKIP_DIRS.has(d.name)) {
        scanStats.skippedDirs += 1;
        continue;
      }
    } else {
      const lower = d.name.toLowerCase();
      if (SKIP_FILES.has(d.name) || SKIP_EXT.has(lower.slice(lower.lastIndexOf('.')))) {
        scanStats.skippedFiles += 1;
        continue;
      }
      if (SKIP_FILE_RES.some((re) => re.test(d.name))) {
        scanStats.skippedFiles += 1;
        continue;
      }
    }
    let mtime = 0;
    try {
      mtime = statSync(abs).mtimeMs;
    } catch {
      /* 无权限则视作非近期 */
    }
    const node = { name: d.name, rel, isDir, mtime, children: [], fileCount: 0, dirCount: 0, anyRecent: false };
    out.push(node);
  }
  return out;
}

/** 递归建树并统计子树规模（全深度扫描，供折叠摘要使用） */
function build(absDir, relDir) {
  const children = readChildren(absDir, relDir);
  for (const node of children) {
    if (!node.isDir) {
      node.fileCount = 1;
      node.anyRecent = isRecent(node.mtime);
      continue;
    }
    const sub = build(path.join(absDir, node.name), node.rel);
    node.children = sub;
    let files = 0;
    let dirs = 0;
    let recent = false;
    for (const c of sub) {
      files += c.fileCount;
      dirs += c.dirCount + (c.isDir ? 1 : 0);
      recent = recent || c.anyRecent;
    }
    node.fileCount = files;
    node.dirCount = dirs;
    node.anyRecent = recent || isRecent(node.mtime);
  }
  return children;
}

/** 目录在前、文件在后，同类按名称升序 */
function sortEntries(entries) {
  const dirs = entries.filter((e) => e.isDir).sort((a, b) => cmp(a.name, b.name));
  const files = entries.filter((e) => !e.isDir).sort((a, b) => cmp(a.name, b.name));
  return dirs.concat(files);
}

/**
 * 每目录截断（目录优先占位 → 近 2 天文件 → 关键入口/配置 → 其余按名称），
 * 选中后仍按「目录在前、同类按名称升序」输出。
 */
function pickShown(entries, max) {
  if (entries.length <= max) return { shown: entries, omitted: [] };
  const dirs = entries.filter((e) => e.isDir);
  const files = entries.filter((e) => !e.isDir);
  const keep = new Set();
  for (const d of dirs) {
    if (keep.size >= max) break;
    keep.add(d.rel);
  }
  /* 文件优先级：关键入口 / 配置（2 分）> 近 2 天变更（1 分）> 其余（0 分），同分按名称 */
  const ranked = files
    .map((f) => ({ f, score: (IMPORTANT_FILE_RE.test(f.name) ? 2 : 0) + (f.anyRecent ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || cmp(a.f.name, b.f.name));
  for (const r of ranked) {
    if (keep.size >= max) break;
    keep.add(r.f.rel);
  }
  const shown = entries.filter((e) => keep.has(e.rel));
  const omitted = entries.filter((e) => !keep.has(e.rel));
  return { shown, omitted };
}

/** 渲染树体（不含头部）：collapseSet 尊重「近 2 天变更」例外，hardSet 强制折叠 */
function renderTree(children, prefix, depth, collapseSet, hardSet, dirRel) {
  const lines = [];
  const sorted = sortEntries(children);
  /* 二级（日志 / 报告 / 验收 / 性能 / 发布）目录仅列少量条目，把行数预算让给源码面 */
  const cap = dirRel && TIER_B.has(dirRel) ? opts.smallCap : opts.maxChildren;
  const { shown, omitted } = pickShown(sorted, cap);
  const n = shown.length + (omitted.length ? 1 : 0);
  if (omitted.length) {
    stats.truncations += 1;
    stats.truncatedItems += omitted.length;
  }
  shown.forEach((node, idx) => {
    const isLast = idx === n - 1;
    const branch = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    if (!node.isDir) {
      lines.push(prefix + branch + node.name);
      stats.shownFiles += 1;
      if (isRecent(node.mtime)) stats.recent += 1;
      return;
    }
    stats.shownDirs += 1;
    if (node.children.length === 0) {
      lines.push(prefix + branch + node.name + '/   [空目录 / 内容均为已过滤资源]');
      return;
    }
    const empty = node.fileCount + node.dirCount === 0;
    const sizeText = empty ? '空目录 / 内容均为已过滤资源' : node.dirCount + ' 子目录 / ' + node.fileCount + ' 文件';
    const collapse = hardSet.has(node.rel) || (collapseSet.has(node.rel) && !node.anyRecent);
    if (collapse) {
      stats.collapsedDirs += 1;
      lines.push(prefix + branch + node.name + '/   [折叠：' + sizeText + '，未展开]');
      return;
    }
    if (depth + 1 >= opts.depth) {
      stats.depthCut += 1;
      lines.push(prefix + branch + node.name + '/   [超出深度 ' + opts.depth + '，未展开：' + sizeText + ']');
      return;
    }
    lines.push(prefix + branch + node.name + '/');
    lines.push(...renderTree(node.children, childPrefix, depth + 1, collapseSet, hardSet, node.rel));
  });
  if (omitted.length) lines.push(prefix + '└── ' + '…（其余 ' + omitted.length + ' 项省略）');
  return lines;
}

function resetStats() {
  for (const k of Object.keys(stats)) stats[k] = 0;
}

/** 折叠候选（排除一级高价值路径）：二级目录优先 → 规模大者优先 → 路径升序（确定性） */
function collapseCandidates(children, acc = [], depth = 1) {
  for (const node of children) {
    if (!node.isDir) continue;
    if (!PROTECTED.has(node.rel)) {
      acc.push({
        rel: node.rel,
        depth,
        size: node.fileCount + node.dirCount,
        tier: TIER_B.has(node.rel) ? 0 : 1,
      });
    }
    collapseCandidates(node.children, acc, depth + 1);
  }
  return acc;
}

const rootChildren = build(ROOT, '');
const allDirs = collapseCandidates(rootChildren).sort(
  (a, b) => a.tier - b.tier || b.size - a.size || cmp(a.rel, b.rel)
);

/** 头部（含省略统计；总行数占位在数组定长后回填，保证行数自洽） */
function header(linesBody) {
  const nowIso = new Date(NOW).toISOString();
  const cnTime = new Date(NOW + 8 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19) + '（UTC+8）';
  const lines = [
    '归档结构 · 修改影响面精简目录树（非全量仓库快照）',
    '生成时间：' + nowIso + ' / ' + cnTime,
    '项目：JU 工作台 v2.0　根目录：E:\\APP\\归档　生成器：99.开发辅助工具/_tree_slim.mjs',
    '过滤规则摘要：',
    '  · 忽略目录：node_modules、.git、dist、build、coverage、logs、cache、venv、__pycache__、.next、out、target、vendor、',
    '    playwright-report、test-results、PortableGit/node/env 等工具链（任意层级）',
    '  · 忽略文件：二进制、图片、音视频、字体、压缩包、office 文档、锁文件、*.map/*.min/*.log/*.bak/*.out.txt 等自动生成物',
    '  · 压缩规则：最大深度 ' + opts.depth + '；每目录最多 ' + opts.maxChildren + ' 条（超出记省略）；低价值目录折叠为一行；总行数上限 ' + opts.maxLines,
    '  · 优先级：源码 / 配置 / 脚本 / 测试 / 文档 / 数据库迁移 / CI 配置 / 关键入口 + 近 2 天变更文件',
    '省略统计：过滤 ' + scanStats.skippedDirs + ' 个目录 / ' + scanStats.skippedFiles + ' 个文件；折叠 ' + stats.collapsedDirs +
      ' 个目录；截断 ' + stats.truncations + ' 处（省 ' + stats.truncatedItems + ' 项）；超深度 ' + stats.depthCut + ' 处',
    '纳入统计：目录 ' + stats.shownDirs + ' 个 / 文件 ' + stats.shownFiles + ' 个（其中近 2 天变更 ' + stats.recent + ' 个已优先保留）',
    '树体行数：' + linesBody.length + '（含本头部共 __TOTAL__ 行）',
    '说明：[折叠：…] / [超出深度…] 为压缩摘要，均未展开子项；目录条目以 / 结尾；本文件自身不计入。',
    '',
  ];
  const total = linesBody.length + lines.length;
  return lines.map((l) => l.replace('__TOTAL__', String(total))).concat(
    total > opts.maxLines ? ['警告：总行数超出上限 ' + opts.maxLines + '，已折叠至候选耗尽'] : []
  );
}

/** 渲染 → 若超行数预算则继续强制折叠（规模大者优先），直到达标或候选耗尽 */
const collapseSet = new Set(BASE_COLLAPSE);
const hardSet = new Set();
resetStats();
let body = renderTree(rootChildren, '', 0, collapseSet, hardSet, '');
let hdr = header(body);

for (const cand of allDirs) {
  if (hdr.length + body.length <= opts.maxLines) break;
  if (cand.tier === 0) continue; /* 二级目录保留（已按 small-cap 压缩），仅在候选耗尽后才折叠 */
  if (hardSet.has(cand.rel)) continue;
  hardSet.add(cand.rel);
  resetStats();
  body = renderTree(rootChildren, '', 0, collapseSet, hardSet, '');
  hdr = header(body);
}

const text = hdr.join('\n') + '\n' + body.join('\n') + '\n';

try {
  mkdirSync(path.dirname(opts.out), { recursive: true });
  writeFileSync(opts.out, text, 'utf8');
} catch (err) {
  console.error('[tree] 写入失败：' + (err && err.message));
  process.exit(1);
}

console.log('[tree] OUT=' + path.relative(ROOT, opts.out).split(path.sep).join('/'));
console.log('[tree] LINES=' + text.split('\n').length);
console.log('[tree] BYTES=' + Buffer.byteLength(text, 'utf8'));
console.log('[tree] DIRS=' + stats.shownDirs + ' FILES=' + stats.shownFiles + ' COLLAPSED=' + stats.collapsedDirs + ' TRUNC=' + stats.truncations + ' OMITTED=' + stats.truncatedItems + ' DEPTH_CUT=' + stats.depthCut);
