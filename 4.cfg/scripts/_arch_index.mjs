#!/usr/bin/env node
/**
 * 归档只读索引生成器 · v2（2026-10-29 · ISSUE-014）
 * ---------------------------------------------------------------------------
 * 由 `90过程材料/临时文件夹/_临时脚本/_arch_index_t22r4.mjs` 派生，差异仅三处：
 *   1) 扫描范围改为磁盘现行目录：`1.历史归档/1.1冻结版本`、`1.历史归档/1.2归档快照`、
 *      `8.发布与CI/release`（ISSUE-014：索引内 30 处 `1.冻结版本` / 592 处 `1.归档快照` 失效前缀）；
 *   2) 输出目录改为 `90过程材料/_报告与元数据`（`.clinerules` 落位表）；
 *   3) 说明 / 校验段文字同步新目录，并登记本次「按磁盘实测重锚」口径。
 * 纯只读：仅遍历与计算 SHA-256，不写入、不移动、不删除任何历史文件。
 * 输出行尾固定 LF、无 BOM。
 * 用法：node "90过程材料/_临时脚本/_arch_index.mjs"
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd(); /* 仓库根：e:\APP\归档 */
const TARGETS = ['1.历史归档/1.1冻结版本', '1.历史归档/1.2归档快照', '8.发布与CI/release'];
const OUT_DIR = path.join(ROOT, '90过程材料', '_报告与元数据');
const OUT = path.join(OUT_DIR, 'ARCHIVE-INDEX.md');

/** 递归收集文件（相对 ROOT 的 posix 路径）与空目录 */
function walk(relDir, files, emptyDirs) {
  const abs = path.join(ROOT, relDir);
  let entries;
  try { entries = readdirSync(abs, { withFileTypes: true }); } catch (e) { return; }
  let fileCount = 0;
  for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))) {
    const rel = path.posix.join(relDir.split(path.sep).join('/'), ent.name);
    if (ent.isDirectory()) {
      walk(path.join(relDir, ent.name), files, emptyDirs);
    } else if (ent.isFile()) {
      fileCount++;
      const buf = readFileSync(path.join(ROOT, rel));
      files.push({
        rel,
        size: buf.length,
        sha256: createHash('sha256').update(buf).digest('hex').toUpperCase(),
      });
    }
  }
  if (fileCount === 0 && entries.length === 0) emptyDirs.push(relDir.split(path.sep).join('/'));
}

const files = [];
const emptyDirs = [];
for (const t of TARGETS) {
  if (!existsSync(path.join(ROOT, t))) { console.error('MISSING DIR: ' + t); continue; }
  walk(t, files, emptyDirs);
}

files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

const totalBytes = files.reduce((s, f) => s + f.size, 0);
const nowUtc = new Date().toISOString();
const nowLocal = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date());

const L = [];
L.push('> ⚠️ 【技术只读边界】此目录及子目录下的所有文件为历史锚点与证据，严禁任何 AI 或人类开发者进行修改、删除或移动。新产物请放入 6.P0-T3基线 或对应的工作目录。');
L.push('');
L.push('# 归档只读索引（ARCHIVE-INDEX）');
L.push('');
L.push(`- 生成时间：**${nowLocal} +08:00**（UTC ${nowUtc}）`);
L.push('- 覆盖范围：`1.历史归档/1.1冻结版本/`、`1.历史归档/1.2归档快照/`、`8.发布与CI/release/`（递归）');
L.push('- 生成方式：`node "90过程材料/_临时脚本/_arch_index.mjs"`（纯只读遍历；不写入任何历史文件）');
L.push(`- 文件总数：**${files.length}**；合计字节：**${totalBytes.toLocaleString('en-US')}** B`);
L.push('- 重锚记录（2026-10-29 · ISSUE-014）：旧索引中的根级冻结 / 快照目录前缀已按磁盘现行目录替换为 `1.历史归档/1.1冻结版本/`、`1.历史归档/1.2归档快照/`；全部条目的字节数与 SHA-256 **按磁盘实测重算**（仅路径迁移不改字节，等价于复核登记）。');
L.push('');
L.push('## 0. 只读约定');
L.push('');
L.push('| 目录 | 语义 | 允许的操作 |');
L.push('|---|---|---|');
L.push('| `1.历史归档/1.1冻结版本/` | 各代冻结基线（canonical 的逐字节历史锚）＋`HEAD.json` 封存指针 | 仅读取 / 校验哈希；**禁止**编辑、删除、移动、重命名 |');
L.push('| `1.历史归档/1.2归档快照/` | 各批次收官证据（报告、日志、spec、快照） | 仅读取 / 校验哈希；**禁止**编辑、删除、移动、重命名 |');
L.push('| `8.发布与CI/release/` | 各代发布产物（HTML · checksums · manifest · 发布说明） | 仅读取 / 校验哈希；**禁止**编辑、删除、移动、重命名 |');
L.push('');
L.push('新产物落位：`6.P0-T3基线/`（Canonical 工作树）、`90过程材料/_临时脚本/`（一次性脚本）、`90过程材料/_哈希与行尾校验/`（校验日志）。');
L.push('');
L.push('## 1. 目录汇总');
L.push('');
L.push('| 目录 | 文件数 | 字节数 |');
L.push('|---|---:|---:|');
for (const t of TARGETS) {
  const sub = files.filter((f) => f.rel === t || f.rel.startsWith(t + '/'));
  L.push(`| \`${t}/\` | ${sub.length} | ${sub.reduce((s, f) => s + f.size, 0).toLocaleString('en-US')} |`);
}
L.push(`| **合计** | **${files.length}** | **${totalBytes.toLocaleString('en-US')}** |`);
L.push('');

if (emptyDirs.length) {
  L.push('### 1.1 空目录（无文件，占位保留）');
  L.push('');
  for (const d of emptyDirs.sort()) L.push(`- \`${d}/\``);
  L.push('');
}

L.push('## 2. 文件清单（路径 · 字节数 · SHA-256）');
L.push('');
L.push('| # | 文件 | 字节数 | SHA-256 |');
L.push('|---:|---|---:|---|');
files.forEach((f, i) => {
  L.push(`| ${i + 1} | \`${f.rel}\` | ${f.size} | \`${f.sha256}\` |`);
});
L.push('');
L.push('## 3. 校验方法');
L.push('');
L.push('```bat');
L.push('cd /d "e:\\APP\\归档"');
L.push('powershell -NoProfile -Command "Get-FileHash -LiteralPath \'1.历史归档\\1.1冻结版本\\<文件名>\' -Algorithm SHA256"');
L.push('```');
L.push('');
L.push('任一历史文件的字节数或 SHA-256 与本表不符，即视为**历史锚被篡改**，须立即停止改动并追溯来源。');
L.push('');

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, L.join('\n'), 'utf8');
console.log(`FILES=${files.length}`);
console.log(`TOTAL_BYTES=${totalBytes}`);
console.log(`EMPTY_DIRS=${emptyDirs.length}`);
console.log(`OUT=${OUT}`);
