#!/usr/bin/env node
/**
 * 死代码扫描 · 未使用导出清单（M5-1b · 批次 CU）
 *
 * 用途：静态扫描 `src/**\/*.ts`，找出「被 `export` 定义、但从未被其它文件 `import`」的
 * 变量 / 函数 / 类型，输出到 `docs/UNUSED-EXPORTS.md` 供人工清理。
 *
 * 口径（只标记，不改代码）：

 *   - 导出收集：`export const|let|var|function|class|interface|type|enum`、`export { … }`；
 *   - 使用判定：任一**其它**文件以 `import { … }` / `import … from` 引入同名符号，
 *     或 `import * as ns from './x'` / `export * from './x'`（视该模块全部导出为已使用）；
 *   - 入口排除：`src/main.ts`（挂载入口，其导出天然无外部引用）不参与统计；
 *   - `export default` 计入「跳过」计数（默认导出无法按名追踪，不纳入未使用判定）；
 *   - 扫描面不含 `*.d.ts`（纯类型声明，非运行期代码）。
 *
 * 局限（已知，仅影响报告精度，不影响判定结论）：
 *   - 注释剥离为行级启发式（`//` 与 `/* *\/`），模板字符串内出现 `//` 的极端写法可能被截断；
 *   - 通过字符串 / `window` 全局键间接引用的符号不在 `import` 统计内（此类符号请在人工复核时保留）。
 *
 * 用法：
 *   node scripts/check-unused-exports.mjs [--check] # 只计算并打印，不写文件（默认）
 *   node scripts/check-unused-exports.mjs --write   # 落盘 docs/UNUSED-EXPORTS.md（人工更新）
 *   node scripts/check-unused-exports.mjs --stdout  # 仅打印摘要，不写文件
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, 'docs');
const OUT_FILE = path.join(OUT_DIR, 'UNUSED-EXPORTS.md');
const STDOUT_ONLY = process.argv.includes('--stdout');
const WRITE = process.argv.includes('--write') && !STDOUT_ONLY;
/* 未使用导出上限（基线 214）：超出即失败，等于/低于仅记录 */
const MAX_UNUSED = 214;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'test-results', 'playwright-report', 'target']);
/** 入口文件（挂载点，导出不作「未使用」判定） */
const ENTRY_FILES = new Set([path.join(SRC, 'main.ts')]);

/* ─────────────── 文件枚举 ─────────────── */

function listTsFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let ents = [];
    try { ents = readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const abs = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) stack.push(abs);
        continue;
      }
      if (e.isFile() && /\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(abs);
    }
  }
  return out.sort();
}

/* ─────────────── 注释剥离（行级） ─────────────── */

function stripComments(text) {
  const src = text.split(/\r?\n/);
  const out = [];
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    let line = src[i];
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end < 0) { out.push(''); continue; }
      line = line.slice(end + 2);
      inBlock = false;
    }
    const b = line.indexOf('/*');
    if (b >= 0) {
      const e = line.indexOf('*/', b + 2);
      if (e < 0) { inBlock = true; line = line.slice(0, b); }
      else line = line.slice(0, b) + ' ' + line.slice(e + 2);
    }
    const l = line.indexOf('//');
    if (l >= 0) line = line.slice(0, l);
    out.push(line);
  }
  return out;
}

/* ─────────────── 语句收集（const/let/var 逗号列表） ─────────────── */

/** 从 (lineIdx, col) 起收集到顶层 `;` 为止的语句文本，返回 { text, endLine } */
function collectStatement(lines, lineIdx, col) {
  let text = '';
  let depth = 0;
  let str = '';
  for (let i = lineIdx; i < lines.length; i++) {
    const line = lines[i];
    for (let c = i === lineIdx ? col : 0; c < line.length; c++) {
      const ch = line[c];
      if (str) {
        text += ch;
        if (ch === '\\') { c++; if (c < line.length) text += line[c]; continue; }
        if (ch === str) str = '';
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { str = ch; text += ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') { depth++; text += ch; continue; }
      if (ch === ')' || ch === ']' || ch === '}') { depth--; text += ch; continue; }
      if (ch === ';' && depth <= 0) return { text, endLine: i };
      text += ch;
    }
    text += ' ';
  }
  return { text, endLine: lines.length - 1 };
}

/** 按顶层逗号切分 */
function splitTopLevel(text) {
  const parts = [];
  let cur = '';
  let depth = 0;
  let str = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (str) {
      cur += ch;
      if (ch === '\\') { i++; if (i < text.length) cur += text[i]; continue; }
      if (ch === str) str = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; cur += ch; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; cur += ch; continue; }
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

/* ─────────────── 导出收集 ─────────────── */

const IDENT = /^[A-Za-z_$][\w$]*$/;

/**
 * 返回 { exports: [{name,kind,line}], defaults: number }
 * line 为 1 基行号
 */
function scanExports(text) {
  const lines = stripComments(text);
  const exports = [];
  const seen = new Set();
  let defaults = 0;
  const push = (name, kind, line) => {
    if (!name || !IDENT.test(name) || seen.has(name + ':' + kind)) return;
    seen.add(name + ':' + kind);
    exports.push({ name, kind, line });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /\bexport\b/.exec(line);
    if (!m) continue;
    const rest = line.slice(m.index + 'export'.length).replace(/^\s+/, '');

    if (/^default\b/.test(rest)) { defaults++; continue; }

    /* export { a, b as c } / export type { … } / export * from */
    if (/^\*/.test(rest)) { continue; }
    const brace = /^(?:type\s+)?\{/.exec(rest);
    if (brace) {
      let inner = rest.slice(brace[0].length - 1);
      let endLine = i;
      while (!closeBraceComplete(inner)) {
        endLine++;
        if (endLine >= lines.length) break;
        inner += ' ' + lines[endLine].trim();
      }
      const body = inner.replace(/^\{/, '').replace(/\}[\s\S]*$/, '');
      for (const raw of body.split(',')) {
        const item = raw.trim().replace(/^type\s+/, '');
        if (!item) continue;
        const as = item.split(/\s+as\s+/);
        push((as[1] || as[0]).trim(), 'reexport', i + 1);
      }
      i = endLine;
      continue;
    }

    /* export const / let / var（支持逗号列表、跨行） */
    const decl = /^(?:declare\s+)?(const|let|var)\s+/.exec(rest);
    if (decl) {
      const col = m.index + 'export'.length + (line.slice(m.index + 'export'.length).length - rest.length) + decl[0].length;
      const { text: stmt, endLine } = collectStatement(lines, i, col);
      for (const part of splitTopLevel(stmt)) {
        const id = /^\s*([A-Za-z_$][\w$]*)/.exec(part);
        if (id) push(id[1], decl[1], i + 1);
      }
      i = endLine;
      continue;
    }

    /* export function / class / interface / type / enum */
    const named = /^(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/.exec(rest);
    if (named) { push(named[2], named[1].replace('*', ''), i + 1); continue; }
  }
  return { exports, defaults };
}

function closeBraceComplete(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return true; }
  }
  return false;
}

/* ─────────────── import / re-export 使用收集 ─────────────── */

function scanUsage(text) {
  /** @type {{spec: string, names: string[], namespace: boolean}[]} */
  const imports = [];
  const clean = stripComments(text).join('\n');

  const RE = /\b(?:import|export)\s+([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = RE.exec(clean)) !== null) {
    const clause = m[1].replace(/\s+/g, ' ').trim();
    const spec = m[2];
    if (/^\*/.test(clause) || /^\*\s+as\s+/.test(clause)) {
      imports.push({ spec, names: [], namespace: true });
      continue;
    }
    /** @type {string[]} */
    const names = [];
    const braces = /\{([\s\S]*)\}/.exec(clause);
    if (braces) {
      for (const raw of braces[1].split(',')) {
        const item = raw.trim().replace(/^type\s+/, '');
        if (!item) continue;
        const as = item.split(/\s+as\s+/);
        names.push((as[0] || '').trim());
      }
    } else if (clause && !clause.startsWith('{')) {
      /* 默认引入 `import Foo from './x'`：按符号名计入 */
      const d = /^([A-Za-z_$][\w$]*)/.exec(clause);
      if (d) names.push(d[1]);
    }
    if (names.length) imports.push({ spec, names, namespace: false });
  }
  return imports;
}

function resolveSpecifier(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const cands = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  for (const c of cands) {
    if (/\.tsx?$/.test(c) && existsSync(c)) return c;
  }
  return null;
}

/* ─────────────── 主流程 ─────────────── */

function main() {
  if (!existsSync(SRC)) {
    console.error(`[unused-exports] 未找到源码目录：${SRC}`);
    process.exit(1);
  }
  const files = listTsFiles(SRC);
  const exportMap = new Map(); // abs -> { exports, defaults }
  const rawText = new Map();
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    rawText.set(f, text);
    exportMap.set(f, scanExports(text));
  }

  /** 每个文件被「具名使用」的符号集合 */
  const usedNames = new Map(files.map((f) => [f, new Set()]));
  /** 被通配引入（import * / export *）的文件：其全部导出视为已使用 */
  const wildcardUsed = new Set();
  /** 被非 TS 入口（main.ts 之外的 ts 文件）整体引用的计数，仅用于统计展示 */
  let importStatements = 0;

  for (const f of files) {
    const imports = scanUsage(rawText.get(f));
    if (imports.length) importStatements++;
    for (const item of imports) {
      const target = resolveSpecifier(f, item.spec);
      if (item.namespace) {
        if (target && target !== f) wildcardUsed.add(target);
        continue;
      }
      if (target && target !== f) {
        /* 说明符可解析：只在该目标模块上记「已使用」，口径最精确 */
        const used = usedNames.get(target);
        for (const name of item.names) if (used) used.add(name);
        continue;
      }
      /* 说明符不可解析（npm 包 / `?worker` / 别名）：退化为全库同名匹配，避免误报未使用 */
      for (const name of item.names) {
        for (const [other, info] of exportMap) {
          if (other === f) continue;
          if (info.exports.some((e) => e.name === name)) usedNames.get(other).add(name);
        }
      }
    }
  }

  const rows = [];
  let totalExports = 0;
  let totalDefaults = 0;
  for (const f of files) {
    const info = exportMap.get(f);
    totalDefaults += info.defaults;
    totalExports += info.exports.length;
    if (ENTRY_FILES.has(f)) continue;
    const used = usedNames.get(f);
    const all = wildcardUsed.has(f);
    for (const e of info.exports) {
      if (all || used.has(e.name)) continue;
      rows.push({ file: path.relative(ROOT, f).replace(/\\/g, '/'), name: e.name, kind: e.kind, line: e.line });
    }
  }

  rows.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));

  const scanned = files.length - ENTRY_FILES.size;
  const rate = totalExports ? (((totalExports - rows.length) / totalExports) * 100).toFixed(1) : '100.0';
  const date = new Date();
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const lines = [];
  lines.push('# 未使用导出清单（UNUSED-EXPORTS）');
  lines.push('');
  lines.push('> 扫描工具：`scripts/check-unused-exports.mjs`（静态 `import` 反查，无运行时开销）');
  lines.push(`> 扫描日期：${stamp}`);
  lines.push(`> 扫描范围：\`src/**/*.ts\`（${scanned} 个文件，排除入口 \`src/main.ts\` 与 \`*.d.ts\`）`);
  lines.push('');
  lines.push('## 一、汇总');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('| --- | --- |');
  lines.push(`| 扫描文件 | ${scanned} |`);
  lines.push(`| 导出符号总数 | ${totalExports} |`);
  lines.push(`| 未使用导出 | **${rows.length}** |`);
  lines.push(`| 导出使用率 | ${rate}% |`);
  lines.push(`| 跳过（\`export default\`） | ${totalDefaults} |`);
  lines.push('');
  lines.push('## 二、判定口径');
  lines.push('');
  lines.push('1. 任一**其它**文件以 `import { X } from …` / `import X from …` 引入同名符号 → 视为已使用；');
  lines.push('2. `import * as ns from \'./x\'` 或 `export * from \'./x\'` → 该模块全部导出视为已使用；');
  lines.push('3. 入口 `src/main.ts` 的导出不计入「未使用」（挂载点自身无外部引用）；');
  lines.push('4. 通过字符串 / `window` 全局键间接引用的符号不会被本工具识别，人工复核时请保留。');
  lines.push('');
  lines.push('## 三、明细（仅标记，不删代码）');
  lines.push('');
  if (!rows.length) {
    lines.push('无未使用导出。');
  } else {
    lines.push('| # | 文件 | 行 | 符号 | 类型 |');
    lines.push('| --- | --- | --- | --- | --- |');
    rows.forEach((r, i) => {
      lines.push(`| ${i + 1} | \`${r.file}\` | ${r.line} | \`${r.name}\` | ${r.kind} |`);
    });
  }
  lines.push('');
  lines.push('## 四、后续动作');
  lines.push('');
  lines.push('- 人工确认后，对确认无外部依赖的符号执行「降级为文件内私有（去掉 `export`）或删除」；');
  lines.push('- 若符号属于 `window.JU` 契约面（见 `src/main.ts` 的 `Object.assign(window.JU, …)`），保留不动；');
  lines.push('- 清理完成后重跑本脚本，未使用导出数应归零或仅剩已登记豁免项。');
  lines.push('');

  const report = lines.join('\n');
  if (WRITE) {
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT_FILE, report, 'utf8');
  }
  console.log(`[unused-exports] 扫描 ${scanned} 个文件，导出 ${totalExports} 个，未使用 ${rows.length} 个（使用率 ${rate}%）。`);
  if (rows.length) {
    const byFile = new Map();
    for (const r of rows) byFile.set(r.file, (byFile.get(r.file) || 0) + 1);
    for (const [f, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${f}: ${n}`);
    }
  }
  if (WRITE) console.log(`[unused-exports] 报告已写入 ${path.relative(ROOT, OUT_FILE)}`);
  if (rows.length > MAX_UNUSED) {
    console.error(`[unused-exports] 未使用导出 ${rows.length} > ${MAX_UNUSED}`);
    process.exit(1);
  }
  process.exit(0);
}

main();
