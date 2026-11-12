#!/usr/bin/env node
/* fix27-4 · 发布前强制门禁（只读）：cargo test --no-run → tsc --noEmit → check-deps-wired
   → gen-src-fingerprint --check → check-release-parity → check-manifest；任一非 0 即 Exit 1，
   并打印「下一步该做什么」。本脚本只读：不写 dist/ 与归档目录（cargo 仅编 target/）。 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { PROJECT } from './release-paths.mjs';

const NODE = process.execPath;
const script = (name) => path.join(PROJECT, 'scripts', name);
const STEPS = [
  { name: 'cargo test --no-run', cmd: 'cargo', args: ['test', '--manifest-path', 'src-tauri/Cargo.toml', '--no-run'], next: 'Rust 编译失败：修复 src-tauri 后重跑本门禁' },
  { name: 'tsc --noEmit', cmd: NODE, args: [path.join(PROJECT, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'], next: '类型检查失败：修复类型错误后重跑本门禁' },
  { name: 'check-deps-wired', cmd: NODE, args: [script('check-deps-wired.mjs')], next: '依赖装配为空壳：按 check-deps-wired 报告修复 src/main.ts 后重跑本门禁' },
  { name: 'gen-src-fingerprint --check', cmd: NODE, args: [script('gen-src-fingerprint.mjs'), '--check'], next: '源码已变更，请重跑 build-all' },
  { name: 'check-release-parity', cmd: NODE, args: [script('check-release-parity.mjs')], next: '源码已变更，请重跑 build-all' },
  { name: 'check-manifest', cmd: NODE, args: [script('check-manifest.mjs')], next: '归档清单与产物不一致，请重跑 build-all 重写清单' },
];

let failed = 0;
for (const step of STEPS) {
  console.log('\n[pre-release] ▸ ' + step.name);
  const r = spawnSync(step.cmd, step.args, { cwd: PROJECT, stdio: 'inherit' });
  if (r.error || r.status !== 0) {
    console.error('[pre-release] ✗ ' + step.name + ' Exit ' + (r.status == null ? 'ERR' : r.status));
    console.error('[pre-release] 下一步：' + step.next);
    failed = 1;
    break;
  }
}
console.log('\n[pre-release] RESULT=' + (failed ? 'FAIL' : 'PASS') + '（' + STEPS.length + ' 项门禁）');
process.exit(failed);
