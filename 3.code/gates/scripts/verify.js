#!/usr/bin/env node
/**
 * P0-T3 Step9 · 本地验证编排
 *
 * 用法：
 *   node scripts/verify.js           # 默认 spec（Node + Playwright）
 *   node scripts/verify.js spec      # 同上
 *   node scripts/verify.js node      # 仅 Node 单元测试
 *   node scripts/verify.js pw        # 仅 Playwright 集成测试
 *   node scripts/verify.js bench     # 仅性能对拍（排除 commitRewriteAllText）
 *   node scripts/verify.js all       # spec + bench
 *   node scripts/verify.js lint      # 仅静态检查（铁律 6 · 禁止 AI 生成注释）
 *   node scripts/verify.js qa        # 仅全量 QA 重跑（t9/t16-w22-qa-all.mjs · ISSUE-008）
 *   node scripts/verify.js invar     # 仅不变量覆盖映射（ISSUE-028 · 输出未覆盖清单）
 *
 * 退出码：0 全绿 / 非 0 = 首个失败步骤的退出码（无失败则 0）/ 2 = 未知 mode（分发白名单守卫）
 * 前置：无云端依赖；需 Node ≥ 22 + Chromium（见 playwright.config.ts）
 * 环境变量：
 *   NO_COLOR=1        禁用 ANSI 彩色输出
 *   JU_CHROMIUM_PATH  自定义 Chromium 路径（透传给 playwright.config.ts）
 *   JU_L11=1          启用 L11 spec（E-1；默认关闭态）
 *   JU_L12=1          启用 L12 spec（E-2 · M-H 真虚拟滚动；默认关闭态）
 *   JU_L13=1          启用 L13 spec（E-3 · M-B 内存工作集；自 L13-W3 起默认开启）
 *   JU_L13=0          显式关闭 L13 spec（回落到 L12 冻结版门禁口径 PW=165）
 *   JU_L14=1          启用 L14 spec（E-2 补完 · M-H′ 加固；默认关闭态）
 *
 * ── tests/ 目录 spec 纳入门禁情况一览（ISSUE-017 · 2026-10-29） ──
 *
 * 本文件的 PW_LIST 是「白名单」：`playwright.config.ts` 的 testDir 为 `./tests`，
 * 不带文件参数直接 `npx playwright test` 会收集该目录全部 spec。下列 spec 不属于
 * 默认门禁集合（PW_LIST），其取舍原因如下（未纳入 ≠ 失效，均可单独执行）：
 *
 * | spec                              | 纳入状态                  | 未纳入默认门禁的原因                                                                 |
 * | --------------------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
 * | tests/t3-ultrawide-layout.spec.ts | 不纳入（仅手工执行）      | 度量型实测：断言之外还落盘物理截图（2.res/assets/img/uw-screenshots）与宽度度量（_哈希与行尾校验），结论需人工查阅；且依赖极宽视口实测环境，不适合无头门禁硬断言 |
 * | tests/t11-anchor-governance.spec.ts | 条件纳入（JU_L11=1）    | 默认关闭态：保持 L3..L10 冻结口径 PW=171，避免新编号区（T-100 起）混入冻结基线          |
 * | tests/t12-virtual-scroll.spec.ts  | 条件纳入（JU_L12=1）      | 默认关闭态：同上（T-105 起；回落到 L11 收口冻结口径）                                  |
 * | tests/t14-virtual-scroll-hardening.spec.ts | 条件纳入（JU_L14=1） | 默认关闭态：同上（T-117 起；回落到 L13 收口冻结口径 PW=171）                           |
 * | tests/t13-mb-workset.spec.ts      | 默认纳入（JU_L13≠0）     | 已纳入；其中 T-115（100k 真规模）/T-116（降级等阶）为大库条件用例，需 JU_L13_100K=1 才执行，否则 skip |
 * | tests/t3-invariants.spec.ts 等 10 件 | 默认纳入               | 即 PW_TESTS 白名单（L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165）     |
 *
 * 已移除的重复副本（ISSUE-017）：`tests/{l3-invariants, l3-commit-callbacks,
 * l3-light-pollution, l3-reference-semantics, l4-history, l6-index,
 * l9-persist-layer}.spec.ts` 共 7 件——与 `t3-* / t4-* / t6-* / t9-*` 同名同义，
 * 属 L22-Rename 后遗留的旧命名副本（改写 v2.0-l3.html.html 且不在白名单内，
 * 直接 `npx playwright test` 会重复执行并指向已废弃的被测文件），已全部删除；
 * 现 `tests/` 目录只保留 t 前缀唯一副本。
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODE = process.argv[2] || 'spec';
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
function run(cmd, args, label, opts = {}) {
  const bin = process.platform === 'win32' && (cmd === 'npx' || cmd === 'npm')
    ? `${cmd}.cmd`
    : cmd;
  console.log(`\n${cyan('▶')} ${bold(label)}`);
  console.log(`  ${dim(`$ ${bin} ${args.join(' ')}`)}`);
  const started = Date.now();
  const r = spawnSync(bin, args, {
    stdio: opts.capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    encoding: opts.capture ? 'utf8' : undefined,
    cwd: ROOT,
    shell: false,
    env: { ...process.env, FORCE_COLOR: COLOR ? '1' : '0', ...(opts.env || {}) },
  });
  const captured = opts.capture ? `${r.stdout || ''}${r.stderr || ''}` : '';
  if (opts.capture) {
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
  }
  const ms = Date.now() - started;
  const code = r.status ?? (r.error ? 1 : 0);
  /* GAP #5：横幅计数由真实运行输出推导（opts.summarize），不再手工维护 */
  const resolved = opts.summarize ? opts.summarize(captured, label) : label;
  steps.push({ label: resolved, code, ms, error: r.error });
  if (code !== 0) {
    console.error(`\n${red('✗')} ${bold(resolved)} ${red(`失败（退出码 ${code}，${ms}ms）`)}`);
    printSummary();
    process.exit(code);
  }
  console.log(`${green('✓')} ${bold(resolved)} ${dim(`(${ms}ms)`)}`);
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
  't9/t9-persist-layer.test.mjs',
  't9/t9-backend-parity.test.mjs',
  't9/t9-shadow-wiring.test.mjs',
  't9/t10-idb-persist.test.mjs',
  't9/t10-w4-consistency.test.mjs',
  't9/t11-w4-consistency.test.mjs',
  't9/t12-virtual-scroll.test.mjs',
  't9/t12-w4-consistency.test.mjs',
  /* L13-W6 · OP-19 补全：N 层 T-116(N) 等价哨兵载体纳编（承 L12 l12-virtual-scroll.test.mjs 范式）。 */
  't9/t13-mb-workset.test.mjs',
  /* L14-W3 · E-2 补完：N 层 G1–G5 等价哨兵载体纳编（承 L12 l12-virtual-scroll.test.mjs 范式）。 */
  't9/t14-vs-hardening.test.mjs',
  /* L14-W4 · E-2 补完：N 层 G6 真规模闸门 + 崩溃/一致性 + 哨兵载体纳编。 */
  't9/t14-w4-consistency.test.mjs',
  /* L16 · 缺陷回归：持久化版本、日历版本、侧栏计数、大纲头只读、日历标签可见性、子集缓存、子树收集、墓碑清扫、主题令牌。 */
  't9/t16-w1-persist-rev.test.mjs',
  't9/t16-w2-cal-rev.test.mjs',
  't9/t16-w3-sidebar-counts.test.mjs',
  't9/t16-w4-outline-header-ro.test.mjs',
  't9/t16-w5-caltg-visibility.test.mjs',
  't9/t16-w6-childset-cache.test.mjs',
  't9/t16-w7-collect-subtree.test.mjs',
  't9/t16-w8-tombstone-sweep.test.mjs',
  't9/t16-w9-theme-token.test.mjs',
  't9/t16-w10-defecta-root-guard.test.mjs',
  't9/t16-w11-tombstone-queue-compaction.test.mjs',
  't9/t16-w12-patch-children-holes.test.mjs',
  't9/t16-w13-remote-received-delete-propagation.test.mjs',
  't9/t16-w14-persist-chain-async.test.mjs',
  't9/t16-w15-sidecounts-fallback.test.mjs',
  't9/t16-w16-sanitize-idempotent.test.mjs',
  't9/t16-w17-boot-backup-fallback.test.mjs',
  't9/t16-w18-pii-redaction.test.mjs',
  't9/t16-w19-enc-stack-placeholder.test.mjs',
  't9/t16-w20-calrev-gate.test.mjs',
  't9/t16-w21-merge-ts-unit.test.mjs',
  /* L17 · 渲染子标签行、周视图本地日、P1 修复、批量修复。 */
  't9/t17-w1-rendersubtags-rows.test.mjs',
  't9/t17-w2-weekview-local-day.test.mjs',
  't9/t17-w3-p1-fixes.test.mjs',
  't9/t17-w4-batch-fixes.test.mjs',
  /* L18 · 终版补丁。 */
  't9/t18-final-patch.test.mjs',
  /* L19 · 封存补丁 1–3。 */
  't9/t19-patch1.test.mjs',
  't9/t19-patch2.test.mjs',
  't9/t19-patch3.test.mjs',
];
const PW_TESTS = [
  'tests/t3-invariants.spec.ts',
  'tests/t3-commit-callbacks.spec.ts',
  'tests/t3-reference-semantics.spec.ts',
  'tests/t3-light-pollution.spec.ts',
  'tests/t4-history.spec.ts',
  'tests/t6-index.spec.ts',
  'tests/t7-index-worker.spec.ts',
  'tests/t8-persist-patch.spec.ts',
  'tests/t9-persist-layer.spec.ts',
  'tests/t10-idb-persist.spec.ts',
];
/* GAP #5 修复：横幅计数不再手工维护，而是解析 node --test 的真实结果摘要得到。
   管道（非 TTY）下 Node 自动改用 TAP 报告器（“# tests / # pass / # fail”）；
   TTY/spec 报告器为 “ℹ tests …”。先剥离 ANSI，再按优先级取值。 */
function parseNodeTestCount(out) {
  const plain = out.replace(/\x1b\[[0-9;]*m/g, '');
  const pick = (key) => {
    const m = plain.match(new RegExp('[#\u2139]\\s*' + key + '\\s+(\\d+)'));
    return m ? Number(m[1]) : null;
  };
  const tests = pick('tests');
  if (tests != null) return tests;
  const pass = pick('pass');
  const fail = pick('fail');
  if (pass != null || fail != null) return (pass || 0) + (fail || 0);
  const plan = plain.match(/^1\.\.(\d+)\s*$/m);
  return plan ? Number(plan[1]) : null;
}
/* TODO-3：Node 口径单进程串行（--test-concurrency=1）——默认并发度 = 逻辑核数时，
   t16-w21 §E（20,001 节点纯 CPU 采样）会与其它 20k 节点用例争用物理核，
   P95 被抬升 2–4 倍产生假阳性超时；阈值 200ms 不变，仅固定测量编排。 */
const nodeTests = () => run('node', ['--test', '--test-concurrency=1', ...NODE_TESTS], 'Node 单元测试', {
  capture: true,
  summarize: (out, base) => {
    const n = parseNodeTestCount(out);
    return `${base}（${n == null ? '?' : n} 用例）`;
  },
});
/* 接线修正（Windows/Node≥22）：spawnSync 无 shell 启动 npx.cmd 抛 EINVAL（CVE-2024-27980 行为变更），
   改为 node 直调 @playwright/test 自带 CLI */
const PW_CLI = ['node_modules', '@playwright', 'test', 'cli.js'].join('/');
/* GAP #3 修复：把 JU_CHROMIUM_PATH 内联进 Playwright 子进程环境，使 gate 在
   无 Playwright 浏览器缓存的主机上自包含。优先沿用现有环境变量，否则按平台推导
   系统默认安装位置（ISSUE-011：不得硬编码任何用户名 / 用户目录）。
   T-02：补充按用户安装（%LOCALAPPDATA%）候选，并对候选做存在性校验——避免把不存在的
   路径透传给 Playwright 后回落到未安装的 bundled chromium（chromium_headless_shell-*），
   造成 PW 探针「缺依赖」假失败；找不到时仅记录提示，不下载、不改产品源码。 */
const JU_CHROMIUM_CANDIDATES = process.platform === 'win32'
  ? [
      process.env.JU_CHROMIUM_PATH,
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['LOCALAPPDATA'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter(Boolean)
  : [process.env.JU_CHROMIUM_PATH].filter(Boolean);
const JU_CHROMIUM = JU_CHROMIUM_CANDIDATES.find((p) => {
  try { return existsSync(p); } catch { return false; }
}) || '';
if (!JU_CHROMIUM && process.platform === 'win32') {
  console.log('[verify] 未找到系统 Chrome；PW 步骤将回落到 Playwright bundled chromium（需 npx playwright install chromium）');
}
const PW_ENV = JU_CHROMIUM ? { JU_CHROMIUM_PATH: JU_CHROMIUM } : {};
/* L11 接线（E-1 · 遗留收口与默认启用治理）—— 默认关闭态：
   仅当 JU_L11=1 时把 L11 spec 纳入 PW 门禁；默认（缺省）门禁与 L10 冻结版
   逐项一致（PW = 165 用例）。编号区启用 T-100 起（见 reports/t11-w1-2026-10-15.md §六）。 */
const L11_ENABLED = process.env.JU_L11 === '1';
const L11_TESTS = ['tests/t11-anchor-governance.spec.ts'];
/* L12 接线（E-2 · M-H 真虚拟滚动）—— 默认关闭态：
   仅当 JU_L12=1 时把 L12 spec 纳入 PW 门禁；默认（缺省）门禁与 L11 收口冻结版
   逐项一致（PW = 165 用例）。编号区启用 T-105 起（见 reports/t12-w1-2026-10-15.md §六）。 */
const L12_ENABLED = process.env.JU_L12 === '1';
const L12_TESTS = ['tests/t12-virtual-scroll.spec.ts'];
/* L13 接线（E-3 · M-B 内存工作集）—— 【L13-W3 · 门禁激活】默认开启：
   缺省即把 L13 spec 纳入 PW 门禁（T-111–T-116；T-115/T-116 条件跳过）；
   显式 JU_L13=0 关闭。基线（L3..L10 = 165）不变，激活后 PW = 165 + 6 = 171 用例。
   编号区启用 T-111–T-116（见 reports/t13-w2-wiring-2026-10-16.md §七）。 */
const L13_ENABLED = process.env.JU_L13 !== '0';
const L13_TESTS = ['tests/t13-mb-workset.spec.ts'];
/* L14 接线（E-2 补完 · M-H′ 加固 · 界面规模收口二期）—— 默认关闭态：
   仅当 JU_L14=1 时把 L14 spec 纳入 PW 门禁；默认（缺省）门禁与 L13 收口冻结版
   逐项一致（PW = 171 用例）。编号区启用 T-117–T-124（见 reports\t14-w2-2026-10-16.md §四）。 */
const L14_ENABLED = process.env.JU_L14 === '1';
const L14_TESTS = ['tests/t14-virtual-scroll-hardening.spec.ts'];
/* 默认（JU_L11 / JU_L12 缺省 + JU_L13 激活）⇒ PW_LIST = PW_TESTS + L13 ⇒ 165 + 6 = 171 用例；
   JU_L13=0 显式关闭时回落 165（L3..L10）逐项一致（LO-7=A）；JU_L14=1 额外纳入 L14 8 用例。 */
const PW_EXTRA = [
  ...(L11_ENABLED ? L11_TESTS : []),
  ...(L12_ENABLED ? L12_TESTS : []),
  ...(L13_ENABLED ? L13_TESTS : []),
  ...(L14_ENABLED ? L14_TESTS : []),
];
const PW_LIST  = [...PW_TESTS, ...PW_EXTRA];
const PW_LABEL = 'Playwright 集成测试（canonical v2.0-t3.html · L3 64 + L4 20 + L6 34 + L7 18 + L8 16 + L9 6 + L10 7 = 165 用例）'
  + (L11_ENABLED ? ` + L11 ${L11_TESTS.length} = ${165 + L11_TESTS.length} 用例` : '')
  + (L12_ENABLED ? ` + L12 ${L12_TESTS.length} = ${165 + (L11_ENABLED ? L11_TESTS.length : 0) + L12_TESTS.length} 用例` : '')
  + (L13_ENABLED ? ` + L13 6 = ${165 + (L11_ENABLED ? L11_TESTS.length : 0) + (L12_ENABLED ? L12_TESTS.length : 0) + 6} 用例` : '')
  + (L14_ENABLED ? ` + L14 8 = ${165 + (L11_ENABLED ? L11_TESTS.length : 0) + (L12_ENABLED ? L12_TESTS.length : 0) + (L13_ENABLED ? 6 : 0) + 8} 用例` : '');
const pwTests   = () => run('node',  [PW_CLI, 'test', ...PW_LIST], PW_LABEL, { env: PW_ENV });
const bench     = () => run('node', [
  'scripts/compare-bench.js',
  'bench-p0-baseline.json', 'bench-p0-after-t3.json',
  '--exclude-op=commitRewriteAllText',
], '性能对拍（排除 commitRewriteAllText）');
/* ── 铁律 6 静态门禁：禁止 AI 生成注释（CI 拦截） ──
   扫描步 9 根下代码类文件（.js/.mjs/.cjs/.ts/.tsx/.py/.ps1），命中即 FAIL。
   标记以内联 char code 构造，避免本文件自身出现字面量（承 LO-2 范式）；产品 HTML
   尾页脚（39 B · LO-9=A 豁免）与登记锚点不在扫描面（.html 不扫描）。 */
const AI_NOTE_INNER = String.fromCharCode(0x5185, 0x5BB9, 0x7531, 0x41, 0x49, 0x751F, 0x6210);
const AI_NOTE_RE = new RegExp(AI_NOTE_INNER.replace(/(.)/g, '$1\\s*'), 'i');
function aiNoteLint() {
  const label = '静态检查（铁律 6 · 禁止 AI 生成注释）';
  console.log(`\n${cyan('▶')} ${bold(label)}`);
  const started = Date.now();
  const EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.ps1']);
  const SKIP = new Set(['node_modules', 'test-results', 'playwright-report', '.git']);
  const selfPath = fileURLToPath(import.meta.url);
  const hits = [];
  const stack = [ROOT];
  while (stack.length) {
    const dir = stack.pop();
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) stack.push(abs); continue; }
      if (!e.isFile() || abs === selfPath) continue;
      if (!EXTS.has(path.extname(e.name).toLowerCase())) continue;
      let txt; try { txt = readFileSync(abs, 'utf8'); } catch { continue; }
      if (!txt.includes(AI_NOTE_INNER.slice(0, 3))) continue;
      txt.split(/\r?\n/).forEach((ln, i) => {
        if (AI_NOTE_RE.test(ln)) hits.push(`${path.relative(ROOT, abs)}:${i + 1}`);
      });
    }
  }
  const ms = Date.now() - started;
  if (hits.length) {
    steps.push({ label, code: 1, ms, error: null });
    console.error(`\n${red('✗')} ${bold(label)} ${red(`失败（命中 ${hits.length} 处 AI 生成注释）`)}`);
    for (const h of hits) console.error(`    ${h}`);
    printSummary();
    process.exit(3);
  }
  steps.push({ label, code: 0, ms, error: null });
  console.log(`${green('✓')} ${bold(label)} ${dim(`(0 命中, ${ms}ms)`)}`);
}
/* ── 全量 QA 重跑（ISSUE-008 接线） ──
   t9/t16-w22-qa-all.mjs 自带 00-static / 01-smoke / 02-property / 03-fuzz / 04-crash /
   05-multitab / 06-soak / 07-mutation / 08-error-report+dynamic 共 11 道闸门，
   末行输出机器可读 JSON（含 allGreen）。此处只做编排与结论提取：
   用 process.execPath 起子进程（不依赖 node 是否在 PATH），结论串固定为 pass:<bool>。 */
const QA_SCRIPT = 't9/t16-w22-qa-all.mjs';
const QA_LABEL = 'L16 全量 QA 重跑（t16-w22-qa-all · ISSUE-008）';
function qaAll() {
  console.log(`\n${cyan('▶')} ${bold(QA_LABEL)}`);
  console.log(`  ${dim(`$ ${path.basename(process.execPath)} ${QA_SCRIPT}`)}`);
  const started = Date.now();
  const r = spawnSync(process.execPath, [QA_SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (out) process.stdout.write(out + (out.endsWith('\n') ? '' : '\n'));
  const m = out.match(/"allGreen"\s*:\s*(true|false)/);
  const pass = r.status === 0 && !!m && m[1] === 'true';
  const ms = Date.now() - started;
  console.log(`  ${bold('pass:' + pass)}`);
  steps.push({ label: `${QA_LABEL}（pass:${pass}）`, code: pass ? 0 : 1, ms, error: r.error });
  if (!pass) {
    printSummary();
    process.exit(r.status || 1);
  }
  console.log(`${green('✓')} ${bold(QA_LABEL)} ${dim(`(pass:true, ${ms}ms)`)}`);
}
/* ── 不变量覆盖映射（ISSUE-028） ──
   清单 = 1.docs/invariants.md。
   解析口径：`### <编号>. <标题>` 起段，段内 `**覆盖用例 id**：<ids>` 为该条覆盖列
   （空值 = 未覆盖）。引用到的 T-编号须能在 tests/ 与 t9/ 用例标题中检索到，
   否则计为悬空引用。本步骤只读不写，恒为 0 退出（未覆盖清单是待办口径，不是红黄灯）。 */
const INVARIANT_DOC = path.resolve(ROOT, '..', '..', '1.docs', 'invariants.md');
function testCaseIds() {
  const ids = new Set();
  for (const dir of [path.join(ROOT, 'tests'), path.join(ROOT, 't9')]) {
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      if (!e.isFile() || !/\.(ts|mts|mjs|js)$/.test(e.name)) continue;
      let txt; try { txt = readFileSync(path.join(dir, e.name), 'utf8'); } catch { continue; }
      for (const m of txt.matchAll(/T-\d+/g)) ids.add(m[0]);
    }
  }
  return ids;
}
function parseInvariants(txt) {
  const lines = txt.split(/\r?\n/);
  const items = [];
  let cur = null;
  for (const ln of lines) {
    const h = /^###\s+(\d+)\.\s+(.+)$/.exec(ln);
    if (h) {
      if (cur) items.push(cur);
      cur = { id: Number(h[1]), title: h[2].trim(), coverage: '' };
      continue;
    }
    if (/^#{1,3}\s/.test(ln) && cur) { items.push(cur); cur = null; continue; }
    const c = /^\*\*覆盖用例 id\*\*[：:]\s*(.*)$/.exec(ln);
    if (c && cur) cur.coverage = c[1].trim();
  }
  if (cur) items.push(cur);
  return items;
}
function invariantCoverage() {
  const label = '不变量覆盖映射（ISSUE-028 · 未覆盖清单）';
  console.log(`\n${cyan('▶')} ${bold(label)}`);
  const started = Date.now();
  let txt;
  try { txt = readFileSync(INVARIANT_DOC, 'utf8'); } catch (e) {
    steps.push({ label, code: 1, ms: Date.now() - started, error: e });
    console.error(`\n${red('✗')} ${bold(label)} ${red(`清单不可读：${INVARIANT_DOC}`)}`);
    printSummary();
    process.exit(4);
  }
  const items = parseInvariants(txt);
  const known = testCaseIds();
  const covered = items.filter((it) => it.coverage !== '');
  const uncovered = items.filter((it) => it.coverage === '');
  const refs = new Set();
  for (const it of covered) for (const m of it.coverage.matchAll(/T-\d+/g)) refs.add(m[0]);
  const dangling = [...refs].filter((id) => !known.has(id)).sort();
  console.log(`  清单：${path.relative(path.resolve(ROOT, '..', '..'), INVARIANT_DOC)}（${items.length} 条）`);
  console.log(`  已登记覆盖：${covered.length} 条　未覆盖：${uncovered.length} 条　引用用例：${refs.size} 个${dangling.length ? `　悬空：${dangling.join(', ')}` : ''}`);
  if (uncovered.length) {
    console.log(`  ${bold('未覆盖不变量：')}`);
    for (const it of uncovered) console.log(`    #${it.id} ${it.title}`);
  } else {
    console.log(`  ${green('全部不变量均已登记覆盖用例 id')}`);
  }
  const ms = Date.now() - started;
  steps.push({ label: `${label}（未覆盖 ${uncovered.length} 条）`, code: 0, ms, error: null });
  console.log(`${green('✓')} ${bold(label)} ${dim(`(未覆盖 ${uncovered.length}/${items.length} 条, ${ms}ms)`)}`);
}
/* ── 模式分发 ──
   ISSUE-002：先做白名单校验。原实现无 else 分支，拼错 / 未知 mode（如 `al`、`alll`）
   会一个步骤都不执行却落到末尾打印「全部通过」并 exit 0 ⇒ 门禁假绿。
   未知 mode 一律非零退出（退出码 2，与 tools/verify.js 的废弃守卫同口径）。 */
const VALID_MODES = ['spec', 'all', 'lint', 'node', 'pw', 'bench', 'qa', 'invar'];
if (!VALID_MODES.includes(MODE)) {
  console.error(`[verify] 未知 mode='${MODE}'（合法值：${VALID_MODES.join(' / ')}）。`);
  console.error('[verify] 未执行任何步骤，退出码 2。请改用 node scripts/verify.js all。');
  process.exit(2);
}
console.log(`${bold('[verify]')} ${dim(`mode=${MODE} root=${ROOT}`)}`);
console.log(`${dim('被测件：产品件 m07-vite（dist 产物）· PW 集成测试 canonical v2.0-t3.html（file:// 加载）')}`);
if (MODE === 'spec' || MODE === 'all') { aiNoteLint(); nodeTests(); pwTests(); invariantCoverage(); }
if (MODE === 'lint')  aiNoteLint();
if (MODE === 'node')  nodeTests();
if (MODE === 'pw')    pwTests();
if (MODE === 'bench' || MODE === 'all') bench();
if (MODE === 'qa')    qaAll();
if (MODE === 'invar') invariantCoverage();
printSummary();
console.log(`\n${green(bold('[verify] 全部通过'))}`);
