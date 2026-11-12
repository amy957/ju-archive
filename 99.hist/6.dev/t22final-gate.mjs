import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ROOT 由本脚本位置推导（<repo>/1.冻结版本/.. → <repo>），
   不依赖 process.cwd()，因此可从任意目录启动。 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STEP9 = path.join(ROOT, '6.P0-T3基线', 'step9');
const EVIDENCE = path.join(ROOT, '_哈希与行尾校验');

/* Chromium 路径只从环境变量解析，禁止硬编码任何用户名 / 用户目录。
   推荐先执行： . "8.发布与CI\ci\env.example.ps1"  */
const chromiumPath = process.env.JU_CHROMIUM_PATH;
if (!chromiumPath) {
  console.error('[t22final_gate] 缺少 JU_CHROMIUM_PATH 环境变量。');
  console.error('[t22final_gate] 请先执行 . "8.发布与CI\\ci\\env.example.ps1"，或显式设置该变量后重试。');
  process.exit(2);
}

const nodeDir = path.dirname(process.execPath);
const env = {
  ...process.env,
  PATH: nodeDir + path.delimiter + (process.env.PATH || ''),
  ELECTRON_RUN_AS_NODE: '1',
  NO_COLOR: '1',
  JU_CHROMIUM_PATH: chromiumPath,
  JU_APP_URL: process.env.JU_APP_URL || 'file:///' + path.join(STEP9, 'v2.0-t3.html').replace(/\\/g, '/'),
};

mkdirSync(EVIDENCE, { recursive: true });

/* ISSUE-012：证据文件名带 UTC 时间戳 + 序号，写入前拒绝覆盖既有证据
   （原实现以固定文件名覆盖同名文件，旧证据不可追溯）。 */
let evidenceSeq = 0;
const evidenceStamp = () => `${new Date().toISOString().replace(/[:.]/g, '-')}-${++evidenceSeq}`;

function run(label, script, args, cwd, timeout) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd,
    env,
    encoding: 'utf8',
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const code = r.status === null ? 1 : r.status;
  const file = path.join(EVIDENCE, `${label}-${evidenceStamp()}.txt`);
  if (existsSync(file)) throw new Error(`[t22final_gate] 证据文件已存在，拒绝覆盖：${file}`);
  writeFileSync(file, out, 'utf8', { flag: 'wx' });
  console.log(`EVIDENCE=${file}`);
  console.log(`EXIT=${code}${r.error ? ' ERROR=' + r.error.message : ''}`);
  const lines = out.split(/\r?\n/).filter((l) => l.length > 0);
  console.log('--- TAIL ---');
  console.log(lines.slice(-30).join('\n'));
  console.log('--- END TAIL ---');
  return code;
}

const regCode = run(
  't22r4-registry',
  path.join(STEP9, 'verify-hash-registry.mjs'),
  [],
  ROOT,
  120000,
);

const allCode = run(
  't22r4-verify-all',
  path.join(STEP9, 'scripts', 'verify.js'),
  ['all'],
  STEP9,
  1800000,
);

console.log(`REGISTRY_EXIT=${regCode}`);
console.log(`VERIFY_ALL_EXIT=${allCode}`);
process.exit(regCode === 0 && allCode === 0 ? 0 : 1);
