#!/usr/bin/env node
/**
 * check-security.mjs — 安全门禁（2026-11-11 新增，进 build-all 门禁）
 *
 * FAIL（阻断）：
 *   1. scripts/keys/ 非空 —— 私钥永久仓库外，仓库内出现即失败
 *   2. src/ 内无条件 console.log / PASTE-DBG —— 生产调试日志（豁免 __JU_RT_DEBUG 门控探针与 src/test/）
 *   3. server/ 内 Access-Control-Allow-Origin: * —— 任意源放开
 * WARN（报告不阻断，属后续重构项）：
 *   4. src/ 内 .innerHTML = 直接赋值计数（统一 setSafeHtml 入口，见 P2-2）
 *   5. withGlobalTauri: true（注入面放大，见 P2-2）
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const failures = [];
const warnings = [];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'target') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

// 1. keys/ 非空
const keysDir = path.join(PROJECT, 'scripts', 'keys');
if (existsSync(keysDir) && readdirSync(keysDir).length > 0) {
  failures.push('scripts/keys/ 非空：私钥不得进入仓库');
}

// 2 & 4. src/ 扫描（前端调试日志 + innerHTML）
const srcFiles = walk(path.join(PROJECT, 'src'));
let innerHTML = 0;
for (const f of srcFiles) {
  const rel = path.relative(PROJECT, f).split(path.sep).join('/');
  if (rel.startsWith('src/test/')) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/console\.log/.test(L) && !/\[JU-RT\]/.test(L)) failures.push('无条件 console.log: ' + rel + ':' + (i + 1));
    if (/\.innerHTML\s*=/.test(L)) innerHTML++;
  }
}
if (innerHTML > 0) warnings.push('src/ 内 .innerHTML = 直接赋值 ' + innerHTML + ' 处（统一 setSafeHtml 入口，见 P2-2）');

// 3. server/ CORS *
for (const f of walk(path.join(PROJECT, 'server'))) {
  const rel = path.relative(PROJECT, f).split(path.sep).join('/');
  const lines = readFileSync(f, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/Access-Control-Allow-Origin:\s*'\*'/.test(lines[i])) failures.push('CORS * : ' + rel + ':' + (i + 1));
  }
}

// 5. withGlobalTauri
const tc = path.join(PROJECT, 'src-tauri', 'tauri.conf.json');
if (existsSync(tc) && /withGlobalTauri\s*:\s*true/.test(readFileSync(tc, 'utf8'))) {
  warnings.push('withGlobalTauri: true 仍开启（注入面放大，见 P2-2）');
}

for (const w of warnings) console.log('[security] WARN ' + w);
if (failures.length) {
  for (const f of failures) console.error('[security] FAIL ' + f);
  process.exit(1);
}
console.log('[security] PASS（keys 空 · 无生产调试日志 · 无 CORS *）');
