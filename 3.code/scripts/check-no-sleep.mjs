/* 【review17 · ISSUE-006】全量比对：遍历 tests/*.spec.ts 逐文件与基线比较，不再依赖 git diff（未跟踪 spec 曾导致假绿） */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(here, '..', 'tests');
const baseFile = path.join(here, 'no-sleep-baseline.json');

/* 仓库根：自 scripts 目录上溯直到含 .git，避免依赖 git 可执行文件 */
function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(dir, '.git'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return path.resolve(start, '..', '..', '..');
}
const root = findRoot(here);

/* 按出现次数计数（同一行两次调用计 2 处），与全库实测 199 对齐 */
const count = (text) => (text.match(/waitForTimeout/g) || []).length;
const linesOf = (text) =>
  text
    .split(/\r?\n/)
    .flatMap((l, i) => Array.from({ length: (l.match(/waitForTimeout/g) || []).length }, () => i + 1));

const specs = existsSync(TESTS_DIR)
  ? readdirSync(TESTS_DIR).filter((f) => f.endsWith('.spec.ts') && statSync(path.join(TESTS_DIR, f)).isFile())
  : [];
if (!specs.length) {
  console.log('FAIL 未找到 tests/*.spec.ts');
  process.exit(1);
}

const rel = (f) => path.relative(root, path.join(TESTS_DIR, f)).replace(/\\/g, '/');

if (process.argv.includes('--write-baseline')) {
  const out = {};
  let total = 0;
  for (const f of specs) {
    const c = count(readFileSync(path.join(TESTS_DIR, f), 'utf8'));
    total += c;
    if (c) out[rel(f)] = c;
  }
  writeFileSync(baseFile, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`baseline written: ${Object.keys(out).length} files / ${total} waitForTimeout`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baseFile, 'utf8'));
let hits = 0;
let totalActual = 0;
let totalBase = 0;
for (const f of specs) {
  const file = rel(f);
  const text = readFileSync(path.join(TESTS_DIR, f), 'utf8');
  const actual = count(text);
  const base = baseline[file] || 0;
  totalActual += actual;
  totalBase += base;
  const excess = actual - base;
  if (excess <= 0) continue;
  const all = linesOf(text);
  for (const ln of all.slice(-excess)) {
    console.log(`FAIL 新增 waitForTimeout: ${file}:${ln}`);
    hits += 1;
  }
}
if (hits > 0) {
  console.log(`no-sleep FAIL: 新增 ${hits} 处（实际 ${totalActual} / 基线 ${totalBase}）`);
  process.exit(1);
}
console.log(`no-sleep OK: 全量 ${specs.length} 个 spec，实际 ${totalActual} 处，基线 ${totalBase} 处，新增 0 处`);
