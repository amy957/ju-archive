#!/usr/bin/env node
/** @deprecated 请使用 scripts/verify.js */
/**
 * P0-T3 Step9 · 本地验证编排（⚠️ DEPRECATED · 已被 scripts/verify.js 取代）
 *
 * @deprecated 请使用 scripts/verify.js
 *   本文件是早期门禁的遗留入口：只跑 4 个 Node 测试文件 + 4 个 Playwright spec + bench，
 *   覆盖面远小于现行门禁（Node 471 + PW 171 + bench 7）。它仅为兼容旧命令与哈希登记而保留，
 *   运行时会打印废弃警告。任何新脚本 / CI / 文档**不得**再调用本文件。
 *
 * 用法（⚠️ 已废弃，仅为旧命令兼容而保留）：
 *   node tools/verify.js spec        # 默认 spec（4 Node + 4 PW spec）
 *   node tools/verify.js node        # 仅 Node 单元测试（4 文件）
 *   node tools/verify.js pw          # 仅 Playwright 集成测试（4 spec）
 *   node tools/verify.js bench       # 仅性能对拍（排除 commitRewriteAllText）
 *   node tools/verify.js all         # spec + bench
 *   ➜ 现行全量门禁请用： node scripts/verify.js all
 *
 * 退出码：0 全绿 / 非 0 = 首个失败步骤的退出码 / 2 = 未知 mode（废弃守卫）
 * 前置：存在本地 git（可选远端）、无云端依赖；需 Node ≥ 22 + Chromium（见 playwright.config.ts）
 * 环境变量：
 *   NO_COLOR=1        禁用 ANSI 彩色输出
 *   JU_CHROMIUM_PATH  自定义 Chromium 路径（透传给 playwright.config.ts）
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODE = process.argv[2] || 'spec';

/* ── DEPRECATED 守卫（ISSUE-018） ──
   1) 任何调用都被显式告警，避免把本入口的“全绿”误当成 471 用例的全量门禁；
   2) 未知 mode 直接失败（原实现会落到末尾无条件打印「全部通过」= 假绿）。 */
const VALID_MODES = ['spec', 'node', 'pw', 'bench', 'all'];
console.error('[verify:deprecated] tools/verify.js 已废弃：仅覆盖 4 Node + 4 PW spec；请使用 scripts/verify.js（Node 471 + PW 171 + bench 7）。');
if (!VALID_MODES.includes(MODE)) {
  console.error(`[verify:deprecated] 未知 mode='${MODE}'（合法值：${VALID_MODES.join(' / ')}）。`);
  console.error('[verify:deprecated] 未执行任何步骤，退出码 2。请改用 scripts/verify.js all。');
  process.exit(2);
}
/* ── ANSI 彩色（非 TTY 或 NO_COLOR 时自动禁用） ── */
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold  = wrap(1);
const dim   = wrap(2);
const red   = wrap(31);
const green = wrap(32);
const cyan  = wrap(36);
/* ── 步骤登记（失败摘要用） ── */
const steps = [];
function run(cmd, args, label) {
  const bin = process.platform === 'win32' && (cmd === 'npx' || cmd === 'npm')
    ? `${cmd}.cmd`
    : cmd;
  console.log(`\n${cyan('▶')} ${bold(label)}`);
  console.log(`  ${dim(`$ ${bin} ${args.join(' ')}`)}`);
  const started = Date.now();
  const r = spawnSync(bin, args, {
    stdio: 'inherit',
    cwd: ROOT,
    shell: false,
    env: { ...process.env, FORCE_COLOR: COLOR ? '1' : '0' },
  });
  const ms = Date.now() - started;
  const code = r.status ?? (r.error ? 1 : 0);
  steps.push({ label, code, ms, error: r.error });
  if (code !== 0) {
    console.error(`\n${red('✗')} ${bold(label)} ${red(`失败（退出码 ${code}，${ms}ms）`)}`);
    printSummary();
    process.exit(code);
  }
  console.log(`${green('✓')} ${bold(label)} ${dim(`(${ms}ms)`)}`);
}
function printSummary() {
  console.log(`\n${bold('━━ 步骤摘要 ━━')}`);
  for (const s of steps) {
    const icon = s.code === 0 ? green('✓') : red('✗');
    const note = s.error ? red(` [${s.error.message}]`) : '';
    console.log(`  ${icon} ${s.label} ${dim(`(${s.ms}ms)`)}${note}`);
  }
}
/* ── 套件清单 ── */
const NODE_TESTS = [
  'P0-T3/tests/structural-sharing.test.mjs',
  'P0-T3/tests/step1-produce.test.mjs',
  'P0-T3/tests/step2-commit.test.mjs',
  'P0-T3/tests/step3-light.test.mjs',
];
const PW_TESTS = [
  'tests/t3-invariants.spec.ts',
  'tests/t3-commit-callbacks.spec.ts',
  'tests/t3-reference-semantics.spec.ts',
  'tests/t3-light-pollution.spec.ts',
];
const nodeTests = () => run('node', ['--test', ...NODE_TESTS], 'Node 单元测试（48 断言）');
const pwTests   = () => run('npx',  ['playwright', 'test', ...PW_TESTS], 'Playwright 集成测试（68 用例）');
const bench     = () => run('node', [
  'scripts/compare-bench.js',
  'bench-p0-baseline.json', 'bench-p0-after-t3.json',
  '--exclude-op=commitRewriteAllText',
], '性能对拍（排除 commitRewriteAllText）');
/* ── 模式分发 ── */
console.log(`${bold('[verify]')} ${dim(`mode=${MODE} root=${ROOT}`)}`);
if (MODE === 'spec' || MODE === 'all') { nodeTests(); pwTests(); }
if (MODE === 'node')  nodeTests();
if (MODE === 'pw')    pwTests();
if (MODE === 'bench' || MODE === 'all') bench();
printSummary();
console.log(`\n${green(bold('[verify] 全部通过'))}`);
