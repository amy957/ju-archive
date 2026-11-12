#!/usr/bin/env node
/**
 * M2-5 · 开源许可证合规审计
 *
 * 扫描范围：
 *   1) package-lock.json 的 `packages` 锁定树（全量，含传递依赖）；
 *   2) 已安装的 node_modules/<pkg>/package.json（存在时以安装态为准，
 *      用于覆盖 lock 条目缺 license 字段的情况）。
 *
 * 分类口径：
 *   - strong（强传染 / 分发即触发）：AGPL-*、GPL-*、SSPL-*、OSL-*、EUPL-*、CPAL-*
 *   - weak（弱 / 文件级传染，需逐案评估）：LGPL-*、MPL-*、EPL-*、CDDL-*、CPL-*
 *   - permissive（宽松）：MIT / ISC / BSD-* / Apache-* / 0BSD / Unlicense / CC0-1.0 / BlueOak-*
 *   - unknown：缺失 license 字段或无法匹配（人工复核）
 *
 * 输出：m07-vite/docs/LICENSE-AUDIT.md（仅 --write 时落盘）
 * 模式：默认 --check 只计算并打印，不写 docs/*.md；--write 才写报告供人工更新。
 * 退出码：0 = 未发现 strong 传染协议；1 = 发现 strong 传染协议（门禁拦截）。
 *
 * 用法：node scripts/audit-license.mjs [--check|--write]
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const LOCK = path.join(PROJECT, 'package-lock.json');
const OUT_DIR = path.join(PROJECT, 'docs');
const OUT = path.join(OUT_DIR, 'LICENSE-AUDIT.md');
const WRITE = process.argv.includes('--write');
const CARGO = path.join(PROJECT, 'src-tauri', 'Cargo.toml'), CARGO_LOCK = path.join(PROJECT, 'src-tauri', 'Cargo.lock');

const STRONG = [/^AGPL/i, /^GPL/i, /^SSPL/i, /^OSL/i, /^EUPL/i, /^CPAL/i, /^RPL/i, /^QPL/i];
const WEAK = [/^LGPL/i, /^MPL/i, /^EPL/i, /^CDDL/i, /^CPL/i, /^IPL/i, /^Artistic/i];
const PERMISSIVE = [
  /^MIT/i,
  /^ISC$/i,
  /^BSD/i,
  /^Apache/i,
  /^0BSD$/i,
  /^Unlicense$/i,
  /^CC0/i,
  /^BlueOak/i,
  /^Zlib$/i,
  /^Python-2\.0$/i,
  /^WTFPL/i,
  /^CC-BY-4\.0$/i,
];

function nameFromPath(pkgPath) {
  const marker = 'node_modules/';
  const idx = pkgPath.lastIndexOf(marker);
  return idx >= 0 ? pkgPath.slice(idx + marker.length) : pkgPath;
}

/** 统一 license 字段为字符串（数组用 OR 连接） */
function licenseText(license) {
  if (!license) return '';
  if (typeof license === 'string') return license.trim();
  if (Array.isArray(license)) return license.map(licenseText).filter(Boolean).join(' OR ');
  if (typeof license === 'object' && typeof license.type === 'string') return license.type.trim();
  return '';
}

function classify(text) {
  if (!text) return 'unknown';
  if (/^SEE LICENSE IN/i.test(text)) return 'unknown';
  if (STRONG.some((re) => re.test(text))) return 'strong';
  if (WEAK.some((re) => re.test(text))) return 'weak';
  if (PERMISSIVE.some((re) => re.test(text))) return 'permissive';
  return 'unknown';
}

function readInstalled(pkgPath) {
  const pj = path.join(PROJECT, pkgPath, 'package.json');
  try {
    if (!existsSync(pj)) return null;
    return JSON.parse(readFileSync(pj, 'utf8'));
  } catch {
    return null;
  }
}

function mdCell(v) {
  return String(v == null || v === '' ? '—' : v).replace(/\|/g, '\\|');
}

function rustSummary() {
  const toml = readFileSync(CARGO, 'utf8');
  const pkg = (toml.match(/^\[package\]([\s\S]*?)(?=^\[|\Z)/m) || [])[1] || '';
  const val = (re) => ((pkg.match(re) || [])[1] || '').trim();
  const lockNames = readFileSync(CARGO_LOCK, 'utf8').match(/^name = "([^"]+)"/gm) || [];
  return { name: val(/^name = "([^"]+)"/m), version: val(/^version = "([^"]+)"/m), license: val(/^license = "([^"]*)"/m), lockCount: lockNames.length };
}

function main() {
  const raw = readFileSync(LOCK);
  const lock = JSON.parse(raw.toString('utf8'));
  const packages = lock.packages || {};
  const lockHash = createHash('sha256').update(raw).digest('hex');
  const rust = rustSummary();
  if (!rust.license) { console.error('[audit-license] FAIL：Cargo.toml [package].license 缺失'); process.exit(1); }

  /** key = name@version，避免同一版本被多路径重复计数；但记录出现路径数 */
  const seen = new Map();
  for (const [pkgPath, meta] of Object.entries(packages)) {
    if (!pkgPath || !meta || typeof meta !== 'object' || meta.link) continue;
    const name = meta.name || nameFromPath(pkgPath);
    const installed = readInstalled(pkgPath);
    const version = (installed && installed.version) || meta.version || '';
    if (!name || !version) {
      seen.set(`${name}@?${pkgPath}`, {
        name,
        version,
        license: licenseText(meta.license),
        dev: !!meta.dev,
        paths: 1,
      });
      continue;
    }
    const key = `${name}@${version}`;
    const license = licenseText((installed && installed.license) || meta.license);
    const dev = !!(meta.dev || (installed && installed.dev));
    const prev = seen.get(key);
    if (prev) {
      prev.paths += 1;
      if (!prev.license && license) prev.license = license;
      continue;
    }
    seen.set(key, { name, version, license, dev, paths: 1 });
  }

  const rows = [...seen.values()].map((r) => ({ ...r, category: classify(r.license) }));
  rows.sort((a, b) => (a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name)));

  const byCat = { strong: [], weak: [], permissive: [], unknown: [] };
  for (const r of rows) byCat[r.category].push(r);

  const runtime = rows.filter((r) => !r.dev).length;
  const devOnly = rows.length - runtime;
  const strongRuntime = byCat.strong.filter((r) => !r.dev).length;

  const stamp = new Date().toISOString();
  const lines = [];
  lines.push('# LICENSE-AUDIT · 开源许可证合规审计（M2-5）');
  lines.push('');
  lines.push('> 自动生成，请勿手工编辑。生成器：`m07-vite/scripts/audit-license.mjs`。');
  lines.push('');
  lines.push('## 1. 审计元数据');
  lines.push('');
  lines.push('| 项 | 值 |');
  lines.push('| --- | --- |');
  lines.push(`| 生成时间（UTC） | ${stamp} |`);
  lines.push(`| 锁文件 | \`package-lock.json\`（lockfileVersion ${lock.lockfileVersion}） |`);
  lines.push(`| 锁文件 SHA-256 | \`${lockHash}\` |`);
  lines.push(`| 去重后依赖数 | ${rows.length}（运行时 ${runtime} / 仅开发 ${devOnly}） |`);
  lines.push(`| Rust 侧许可 | \`${rust.name}@${rust.version}\` · \`${rust.license}\` · Cargo.lock 包 ${rust.lockCount} 个 |`);
  lines.push('');
  lines.push('## 2. 分类汇总');
  lines.push('');
  lines.push('| 分类 | 数量 | 判定 |');
  lines.push('| --- | ---: | --- |');
  lines.push(`| strong（强传染：AGPL / GPL / SSPL 等） | ${byCat.strong.length} | ${byCat.strong.length ? '**阻断**' : '通过'} |`);
  lines.push(`| weak（弱 / 文件级传染：LGPL / MPL / EPL / CDDL 等） | ${byCat.weak.length} | ${byCat.weak.length ? '需逐案评估' : '无'} |`);
  lines.push(`| permissive（宽松：MIT / ISC / BSD / Apache 等） | ${byCat.permissive.length} | 通过 |`);
  lines.push(`| unknown（缺失或无法识别） | ${byCat.unknown.length} | ${byCat.unknown.length ? '人工复核' : '无'} |`);
  lines.push('');

  const emitTable = (title, list, note) => {
    lines.push(`## ${title}`);
    lines.push('');
    if (!list.length) {
      lines.push(note);
      lines.push('');
      return;
    }
    lines.push('| 包名 | 版本 | 许可证 | 类型 | 安装路径数 |');
    lines.push('| --- | --- | --- | --- | ---: |');
    for (const r of list) {
      lines.push(
        `| ${mdCell(r.name)} | ${mdCell(r.version)} | ${mdCell(r.license)} | ${r.dev ? 'dev' : 'runtime'} | ${r.paths} |`,
      );
    }
    lines.push('');
  };

  emitTable('3. strong · 强传染协议命中', byCat.strong, '未发现 AGPL / GPL / SSPL 等强传染协议。');
  emitTable('4. weak · 弱 / 文件级传染协议命中', byCat.weak, '未发现 LGPL / MPL / EPL / CDDL 等协议。');
  emitTable('5. unknown · 缺失或无法识别', byCat.unknown, '全部依赖均声明了可识别的许可证。');

  lines.push('## 6. permissive · 宽松协议明细');
  lines.push('');
  if (!byCat.permissive.length) {
    lines.push('无。');
  } else {
    lines.push('| 包名 | 版本 | 许可证 | 类型 |');
    lines.push('| --- | --- | --- | --- |');
    for (const r of byCat.permissive) {
      lines.push(`| ${mdCell(r.name)} | ${mdCell(r.version)} | ${mdCell(r.license)} | ${r.dev ? 'dev' : 'runtime'} |`);
    }
  }
  lines.push('');
  lines.push('## 7. 结论');
  lines.push('');
  if (byCat.strong.length) {
    lines.push(
      `**不通过**：命中 ${byCat.strong.length} 个强传染协议依赖（其中运行时 ${strongRuntime} 个）。` +
        '分发前必须移除 / 替换，或在法务确认后改为隔离进程 + 独立分发。',
    );
  } else {
    lines.push('**通过**：锁定树内未发现 AGPL / GPL / SSPL 等强传染协议，可分发闭源桌面安装包。');
  }
  if (byCat.weak.length) {
    lines.push('');
    lines.push(`注：另有 ${byCat.weak.length} 个弱 / 文件级传染协议依赖，修改其源码或以动态链接以外方式复用时应保留声明与许可文本。`);
  }
  if (byCat.unknown.length) {
    lines.push('');
    lines.push(`注：${byCat.unknown.length} 个依赖许可证缺失 / 无法识别，需人工复核其仓库 LICENSE 文件。`);
  }
  lines.push('');

  if (WRITE) {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, lines.join('\n'), 'utf8');
    console.log(`[audit-license] 写入 ${path.relative(PROJECT, OUT)}`);
  } else {
    console.log(`[audit-license] --check 只读模式：未写入 ${path.relative(PROJECT, OUT)}`);
  }
  console.log(
    `[audit-license] 依赖 ${rows.length}（runtime ${runtime} / dev ${devOnly}）` +
      ` · strong ${byCat.strong.length} · weak ${byCat.weak.length} · permissive ${byCat.permissive.length} · unknown ${byCat.unknown.length}`,
  );
  console.log(`[audit-license] Rust ${rust.name}@${rust.version} · license ${rust.license} · Cargo.lock 包 ${rust.lockCount}`);
  if (byCat.strong.length) {
    console.error('[audit-license] FAIL：发现强传染协议');
    for (const r of byCat.strong) console.error(`  - ${r.name}@${r.version}  ${r.license}`);
    process.exit(1);
  }
  console.log('[audit-license] OK：无 AGPL / GPL / SSPL 强传染协议');
}

main();
