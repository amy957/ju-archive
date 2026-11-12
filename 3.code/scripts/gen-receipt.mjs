#!/usr/bin/env node
/** 批次回执生成器：禁止手写回执；--batch/--files/--cmd/--result，产出 90过程材料/tmp/<batch>/receipt.json。 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(PROJECT, '..', '..');
const TOOLS = path.join(REPO_ROOT, '99.开发辅助工具');
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i < 0 ? '' : (process.argv[i + 1] || ''); };
const batch = arg('batch'), filesArg = arg('files'), cmd = arg('cmd'), result = arg('result');
if (!batch || !cmd || !['pass', 'fail'].includes(result)) { console.error('usage: node scripts/gen-receipt.mjs --batch <name> --files <a,b> --cmd <cmd> --result pass|fail'); process.exit(1); }
const env = { ...process.env };
const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
env[pathKey] = TOOLS + path.delimiter + (env[pathKey] || '');

/** 执行命令并记录退出码与末 2000 字符输出；cwd 固定为 m07-vite 工程根。 */
function run(c) {
  try {
    return { exitCode: 0, stdoutTail: String(execSync(c, { cwd: PROJECT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).slice(-2000) };
  } catch (e) {
    return { exitCode: typeof e.status === 'number' ? e.status : 1, stdoutTail: String((e.stdout || '') + (e.stderr || '')).slice(-2000) };
  }
}

const files = filesArg.split(',').map((s) => s.trim()).filter(Boolean).map((rel) => {
  const abs = path.resolve(PROJECT, rel);
  return { path: rel, sha256: createHash('sha256').update(readFileSync(abs)).digest('hex'), mtime: statSync(abs).mtime.toISOString() };
});
const main = run(cmd);
const tsc = run('"' + process.execPath + '" node_modules/typescript/bin/tsc --noEmit');
if ((result === 'pass') !== (main.exitCode === 0)) { console.error('result 与 exitCode 不一致: result=' + result + ' exitCode=' + main.exitCode); process.exit(1); }
const outDir = path.join(REPO_ROOT, '90过程材料', 'tmp', batch);
mkdirSync(outDir, { recursive: true });
const receipt = { batch, timestamp: new Date().toISOString(), files, command: cmd, exitCode: main.exitCode, stdoutTail: main.stdoutTail, result, gateResults: { tsc } };
const outFile = path.join(outDir, 'receipt.json');
writeFileSync(outFile, JSON.stringify(receipt, null, 2) + '\n');
console.log('[receipt] ' + path.relative(REPO_ROOT, outFile) + ' files=' + files.length + ' result=' + result + ' exitCode=' + main.exitCode + ' tsc=' + tsc.exitCode);
