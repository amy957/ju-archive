#!/usr/bin/env node
/**
 * scripts/compare-bench.js <baseline.json> <after.json> [--exclude-op=op[,op]]
 * 输出 Markdown 表格到 stdout。
 *
 * 判定阈值：
 *   delta ≤ +30%          ✅ 通过
 *   +30% < delta ≤ +100%  ⚠ 警告
 *   delta > +100%         ❌ 失败
 *
 * 缺数据处理：任一侧 results 中该场景 n===0（或缺失）→ 输出「缺数据」。
 * 典型场景：基线（Step0 原始）无 __juProduce，juProduce 场景在 after 才有数据。
 *
 * D4 扩展（2026-10-09）：
 *   - memorySnapshot 行（D4 内存指标）走独立「内存对比」小节，比较 stateHeapMB /
 *     undoStackMB / gcResidentMB 三项 delta；无 n 字段，不落入上面的缺数据分支。
 *   - 内存对比只告警、不改变退出码（回归基线语义，告警不阻断）。
 *
 * Step9 扩展（2026-10-09）：
 *   - `--exclude-op=name[,name]`：将指定场景从硬门禁白名单排除——不参与判定、
 *     不计入 pass/warn/fail 统计、不改变退出码，输出保留作边界记录
 *     （表格标记 `⏭ 排除（--exclude-op）`）。
 */
import fs from 'node:fs';
/* ── 参数解析：--exclude-op=name[,name] 可重复 ── */
const rawArgs = process.argv.slice(2);
const excludes = new Set(
  rawArgs
    .filter((a) => a.startsWith('--exclude-op='))
    .flatMap((a) => a.slice('--exclude-op='.length).split(',').map((s) => s.trim()))
    .filter(Boolean)
);
const positional = rawArgs.filter((a) => !a.startsWith('--'));
const [aPath, bPath] = positional;
if (!aPath || !bPath) {
  console.error('usage: compare-bench.js <a.json> <b.json> [--exclude-op=op[,op]]');
  process.exit(1);
}
if (excludes.size) {
  console.log(`[compare-bench] 排除场景（不参与判定/退出码）：${[...excludes].join(', ')}`);
}
const A = JSON.parse(fs.readFileSync(aPath, 'utf8'));
const B = JSON.parse(fs.readFileSync(bPath, 'utf8'));
function index(json) {
  const m = new Map();
  (json.results || []).forEach((r) => m.set(r.op + '@' + r.size, r));
  return m;
}
const aMap = index(A);
const bMap = index(B);
const missing = (r) => !r || !r.n || r.n === 0;
console.log('# 基准对比\n');
console.log(`- baseline: \`${A.env.label}\` sha256=\`${(A.env.sha256 || '').slice(0, 16)}…\``);
console.log(`- after   : \`${B.env.label}\` sha256=\`${(B.env.sha256 || '').slice(0, 16)}…\``);
console.log(`- 运行时间: baseline ${A.env.timestamp} / after ${B.env.timestamp}\n`);
console.log('| op | size | baseline median (ms) | after median (ms) | delta | baseline p95 | after p95 | p95 delta | 判定 |');
console.log('|---|---|---|---|---|---|---|---|---|');
const keys = new Set([...aMap.keys(), ...bMap.keys()]);
const all = [];
/* D4 memorySnapshot 内存对比：独立小节，只告警、不参与退出码 */
const MEM_KEYS = ['stateHeapMB', 'undoStackMB', 'gcResidentMB'];
let memStarted = false;
[...keys].sort().forEach((k) => {
  const a = aMap.get(k);
  const b = bMap.get(k);
  /* 排除场景短路：不判定、不计数、不 push all（不改变退出码），仅输出边界记录。
     防御性：单侧缺失时也按 op 名排除（而非落缺数据分支） */
  const opName = (a && a.op) || (b && b.op) || k.split('@')[0];
  if (excludes.has(opName)) {
    const aMed = a && a.median != null ? a.median : '-';
    const bMed = b && b.median != null ? b.median : '-';
    const aP95 = a && a.p95 != null ? a.p95 : '-';
    const bP95 = b && b.p95 != null ? b.p95 : '-';
    console.log(`| ${opName} | ${a ? a.size : (b ? b.size : '-')} | ${aMed} | ${bMed} | — | ${aP95} | ${bP95} | — | ⏭ 排除（--exclude-op） |`);
    return;
  }
  if (a && b && a.op === 'memorySnapshot' && b.op === 'memorySnapshot' && a.metrics && b.metrics) {
    if (!memStarted) {
      console.log('\n## 内存对比（D4 memorySnapshot）\n');
      console.log('| size | 指标 | baseline | after | delta | 判定 |');
      console.log('|---|---|---|---|---|---|');
      memStarted = true;
    }
    for (const key of MEM_KEYS) {
      const av = a.metrics[key];
      const bv = b.metrics[key];
      if (av == null || bv == null) {
        console.log(`| ${a.size} | ${key} | - | - | - | 缺数据 |`);
        continue;
      }
      const d = ((bv - av) / av) * 100;
      let verdict;
      /* 内存语义用「未恶化/恶化」而非延迟门禁的「通过/失败」：相对基线没有恶化 ≠ 达标 */
      if (d <= 30) verdict = d < -30 ? '✅ 未恶化（下降）' : '✅ 未恶化';
      else if (d <= 100) verdict = '⚠ 警告';
      else verdict = '❌ 恶化（>+100%）';
      console.log(`| ${a.size} | ${key} | ${av} MB | ${bv} MB | ${d.toFixed(1)}% | ${verdict} |`);
    }
    return;
  }
  if (missing(a) || missing(b)) {
    const side = missing(a) && missing(b) ? '两侧' : missing(a) ? 'baseline' : 'after';
    console.log(`| ${k} | - | - | - | - | - | - | - | 缺数据（${side}无此场景） |`);
    return;
  }
  const [op, size] = k.split('@');
  // 近零基线（headless 计时分辨率内）：commitLight 等原地路径可采样为 0ms，
  // 此时 delta 无定义。两侧均近零 → 通过；after 明显放大 → 警告。
  if (a.median === 0) {
    const verdict = b.median <= 0.05 ? '✅ 通过（近零，计时分辨率内）' : '⚠ 警告（基线近零）';
    const bMed = b.median.toFixed(4);
    console.log(
      `| ${op} | ${size} | ${a.median} | ${bMed} | —（近零） ` +
      `| ${a.p95} | ${b.p95} | — | ${verdict} |`
    );
    return;
  }
  const d = ((b.median - a.median) / a.median) * 100;
  const p95d = ((b.p95 - a.p95) / a.p95) * 100;
  all.push(d);
  let verdict;
  if (d <= 30) verdict = '✅ 通过';
  else if (d <= 100) verdict = '⚠ 警告';
  else verdict = '❌ 失败';
  console.log(
    `| ${op} | ${size} | ${a.median} | ${b.median} | ${d.toFixed(1)}% ` +
    `| ${a.p95} | ${b.p95} | ${p95d.toFixed(1)}% | ${verdict} |`
  );
});
console.log('\n## 摘要\n');
const compared = all.length;
console.log(`- 可比场景总数：${compared}`);
console.log(`- ✅ 通过（delta ≤ +30%）：${all.filter((d) => d <= 30).length}`);
console.log(`- ⚠ 警告（+30% < delta ≤ +100%）：${all.filter((d) => d > 30 && d <= 100).length}`);
console.log(`- ❌ 失败（delta > +100%）：${all.filter((d) => d > 100).length}`);
if (compared > 0) {
  console.log(`- 最大恶化：${Math.max(...all).toFixed(1)}%`);
  console.log(`- 中位数恶化：${[...all].sort((a, b) => a - b)[Math.floor(all.length / 2)].toFixed(1)}%`);
}
// 失败时非零退出（供 CI 卡口）；退出码只由未排除场景决定（排除行不 push all）
if (all.some((d) => d > 100)) process.exit(2);
