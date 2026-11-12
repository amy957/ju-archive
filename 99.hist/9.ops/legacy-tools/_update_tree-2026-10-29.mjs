#!/usr/bin/env node
/**
 * _update_tree.mjs —— 归档结构树生成器（一次性脚本）
 *
 * 规范来源：本次任务书
 *   1. 遍历项目根目录 E:\APP\归档
 *   2. 遍历时跳过 .git（任意层级，且不读取其内容）
 *   3. 递归深度限制 4 层（第 5 层及更深不展开，仅标注省略）
 *   4. 使用树形字符 ├── / └── / │  拼接
 *   5. UTF-8 覆盖写入绝对路径 E:\APP\归档\归档结构.txt
 *
 * 工程约定（为保证幂等 / 可复现，不改变规范语义）：
 *   - 排序：目录在前、文件在后，各自按 Unicode 码位升序（不依赖 locale）
 *   - 输出文件自身不计入结构树（避免第 N 次与第 N+1 次执行结果漂移）
 *   - 符号链接目录不递归（防环），以 @symlink 标注
 *   - 不写入时间戳，同一磁盘状态下重复执行字节一致
 *
 * 用法：
 *   node _update_tree.mjs
 *
 * 退出码：0 = 成功；1 = 失败（写盘异常）
 */

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** 项目根目录（任务书指定的绝对路径） */
const ROOT = 'E:\\APP\\归档';
/** 输出文件（任务书指定的绝对路径） */
const OUT = 'E:\\APP\\归档\\归档结构.txt';
/** 最大递归深度：根的直接子项为第 1 层 */
const MAX_DEPTH = 4;
/** 硬性跳过项 */
const SKIP_NAMES = new Set(['.git']);
/** 统计 */
const stats = { dirs: 0, files: 0, links: 0, cut: 0, unreadable: 0 };

/** 码位序比较（跨机可复现，不受 locale 影响） */
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** 单层读取（容错：无权限 / 路径过长 / 竞态删除 ⇒ null） */
function readSafe(absDir) {
  try {
    return readdirSync(absDir, { withFileTypes: true });
  } catch {
    return null;
  }
}

/** 归一化条目：过滤 .git 与输出文件自身，解析符号链接 */
function normalize(absDir, dirents) {
  const out = [];
  for (const d of dirents) {
    if (SKIP_NAMES.has(d.name)) continue;
    const abs = path.join(absDir, d.name);
    if (path.resolve(abs).toLowerCase() === path.resolve(OUT).toLowerCase()) continue;

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
    out.push({ name: d.name, abs, isDir, isLink });
  }
  return out.sort(
    (x, y) => (x.isDir === y.isDir ? cmp(x.name, y.name) : x.isDir ? -1 : 1),
  );
}

/** 判断目录在「跳过规则」下是否存在可见子项 */
function hasVisibleChildren(absDir) {
  const dirents = readSafe(absDir);
  if (!dirents) return true; // 不可读也标注，避免静默丢失
  return normalize(absDir, dirents).length > 0;
}

/** 递归构建树形行 */
function walk(absDir, prefix, level, lines) {
  const dirents = readSafe(absDir);
  if (dirents === null) {
    stats.unreadable += 1;
    lines.push(prefix + '└── [无法读取：权限或路径过长]');
    return;
  }

  const entries = normalize(absDir, dirents);

  entries.forEach((entry, idx) => {
    const isLast = idx === entries.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    if (!entry.isDir) {
      lines.push(prefix + branch + entry.name + (entry.isLink ? ' @symlink' : ''));
      stats.files += 1;
      if (entry.isLink) stats.links += 1;
      return;
    }

    lines.push(prefix + branch + entry.name + '/');
    stats.dirs += 1;
    if (entry.isLink) stats.links += 1;

    if (entry.isLink) {
      lines.push(childPrefix + '└── [跳过符号链接目录]');
      return;
    }

    if (level >= MAX_DEPTH) {
      stats.cut += 1;
      if (hasVisibleChildren(entry.abs)) {
        lines.push(childPrefix + '└── …（超过 ' + MAX_DEPTH + ' 层，未展开）');
      }
      return;
    }

    walk(entry.abs, childPrefix, level + 1, lines);
  });
}

/** 主流程 */
function main() {
  const lines = [path.basename(ROOT) + '/'];
  walk(ROOT, '', 1, lines);
  const text = lines.join('\n') + '\n';

  try {
    writeFileSync(OUT, text, { encoding: 'utf8' });
  } catch (err) {
    console.error('[FAIL] 写入失败：' + OUT + ' → ' + err.message);
    process.exitCode = 1;
    return;
  }

  console.log('[OK] 输出：' + OUT);
  console.log(
    '[STAT] 行数=' +
      lines.length +
      ' 目录=' +
      stats.dirs +
      ' 文件=' +
      stats.files +
      ' 链接=' +
      stats.links +
      ' 深度截断=' +
      stats.cut +
      ' 不可读=' +
      stats.unreadable +
      ' 字节=' +
      Buffer.byteLength(text, 'utf8'),
  );
}

main();
