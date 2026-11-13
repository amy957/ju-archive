/**
 * L17-W4 · 批次 4 合并波 N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义（P1-4 / P1-5 / P2-1 / P2-2 / P2-3 / P2-4 / P3-1 / P3-2 / P3-3 +
 *           OP-L17W1-1 / OP-L17W3-2，共 11 项）：
 *   P1-4  actions.logActivity 的 mod 分支：_logTimers 以 LOG_TIMER_MAX(500) 为上限，
 *         新增 key 且已达上限时淘汰最早登记项（clearTimeout + 立即 commit）。
 *   P1-5  GraphLayoutWorker._timeoutHit：单次超时即 terminate 重建（不再等待连续 2 次），
 *         置 ready=false；连续超时计数 timeoutStrikes 已于 L18 · P3-2 退役（单次命中即重建，计数无判据作用）。
 *   P2-1  openTagPalette「自动颜色」：commit 选项由 light+noRollback 改为 snapshot:true（入历史栈）。
 *   P2-2  docToXls：形如 -?\d+(\.\d+)? 的单元格导出为 ss:Type="Number"，其余保持 String。
 *   P2-3  copyPlain：跳过 Symbol 键（内部派生计数不进入复制结果）。
 *   P2-4  buildTimeGrid：23:00 后无结束时间时 toast 提示（不阻断创建）。
 *   P3-1  parseCalTimeInput 死代码已删除（全文件零定义 / 零调用）。
 *   P3-2  _l7TagCountText 冷缓存占位符：L17-W4 为 '0'，L18 · P3-3 起统一为 '…'（本文件随语义更新断言）。
 *   P3-3  _errSeen 清理策略注释补齐（限流前 set / 依赖 64 次全扫 + 队首快路径）。
 *   OP-L17W1-1 renderTagsView 对 Set 取 size（原 length ⇒ undefined）。
 *   OP-L17W3-2 initStore 对根级 state.updatedAt 秒级归一（0<v<1e10 ×1000）。
 * 断言口径：
 *   A 结构锚点 / B 最小装配行为 / C 红证（只读冻结锚 frozen-l14 判别力）。
 * 运行：`node --test l9/t17-w4-batch-fixes.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const ROOT = path.resolve(STEP9, '..', '..');
const CANONICAL = process.env.JU_L17W4_CANONICAL
  ? path.resolve(process.env.JU_L17W4_CANONICAL)
  : path.resolve(STEP9, '..', 'canonical', 'v2.0-t3.html');
/* 只读历史锚（改前形态 · 仅读取 · 不写入） */
const FROZEN_L14 = path.resolve(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t3-frozen-t14-2026-10-16.html');

const SRC = readFileSync(CANONICAL, 'utf8');
const STRIP = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* ---------- 提取器（缺失返回 null，交由各用例独立断言） ---------- */
function extractFn(src, head) {
  const s = src.indexOf(head);
  if (s < 0) return null;
  let depth = 0;
  for (let i = src.indexOf('{', s); i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(s, i + 1);
    }
  }
  return null;
}

function extractModBranch(src) {
  const head = "    if(type==='mod'){";
  const s = src.indexOf(head);
  if (s < 0) return null;
  const tail = '    }else doCommit();';
  const e = src.indexOf(tail, s);
  if (e < 0) return null;
  return src.slice(s, e + tail.length);
}

/* ---------- P1-4 · _logTimers 上限 ---------- */
describe('L17-W4 · P1-4 · _logTimers 上限', () => {
  test('A1 LOG_TIMER_MAX=500 与淘汰块位于 set 之前', () => {
    assert.match(STRIP(SRC), /const LOG_TIMER_MAX=500;/, '缺少 LOG_TIMER_MAX 常量');
    const block = STRIP(extractModBranch(SRC) || '');
    assert.ok(block, '缺少 logActivity 的 mod 分支');
    assert.match(block, /_logTimers\.size>=LOG_TIMER_MAX/, '缺少上限判断');
    assert.ok(block.indexOf('_logTimers.size>=LOG_TIMER_MAX') < block.indexOf('_logTimers.set(key'), '淘汰块必须在 set 之前');
    assert.match(block, /clearTimeout\(old\.timer\)/, '淘汰项须 clearTimeout');
    assert.match(block, /old\.commit\(\)/, '淘汰项须立即 commit');
  });

  test('B1 达到上限后新增 key ⇒ 淘汰最早项并落盘，容量不超上限', () => {
    const block = extractModBranch(SRC);
    assert.ok(block);
    const commits = [];
    const map = new Map();
    for (let i = 0; i < 500; i++) {
      const k = 'k' + i;
      map.set(k, { timer: { id: i }, commit() { commits.push(k); } });
    }
    const timers = [];
    const clearTimeout = (t) => { t.cleared = true; };
    const setTimeout = (fn) => { timers.push(fn); return { id: 'new' }; };
    const doCommit = () => commits.push('NEW');
    const run = new Function('type', 'key', '_logTimers', 'LOG_TIMER_MAX', 'clearTimeout', 'setTimeout', 'doCommit', block);
    run('mod', 'fresh', map, 500, clearTimeout, setTimeout, doCommit);
    assert.equal(map.size, 500, '淘汰后 + 新增后容量应保持 500');
    assert.equal(map.has('k0'), false, '最早项应被淘汰');
    assert.ok(commits.includes('k0'), '淘汰项应立即 commit');
    assert.equal(timers.length, 1, '新增项应登记 1 个防抖计时器');
  });
});

/* ---------- P1-5 · GraphLayoutWorker 单次超时重建 ---------- */
describe('L17-W4 · P1-5 · GraphLayoutWorker 单次超时重建', () => {
  test('A1 不再保留连续 2 次阈值，命中即 terminate / ready=false / strikes 字段退役', () => {
    const fn = STRIP(extractFn(SRC, '_timeoutHit(gen){') || '');
    assert.ok(fn, '缺少 _timeoutHit');
    assert.doesNotMatch(fn, /timeoutStrikes>=2/, '仍存在连续 2 次阈值');
    assert.match(fn, /terminate\(\)/, '缺少 terminate');
    assert.match(fn, /this\.ready=false/, '缺少 ready=false');
    assert.doesNotMatch(fn, /timeoutStrikes/, 'L18 · P3-2：timeoutStrikes 应已退役');
    assert.match(fn, /revokeObjectURL/, '缺少 URL revoke');
  });

  test('B1 首次超时即终止并拒绝挂起请求', () => {
    const fn = extractFn(SRC, '_timeoutHit(gen){');
    assert.ok(fn);
    const obj = new Function('return { ' + fn + ' };')();
    let terminated = false;
    let rejected = null;
    obj.pending = { gen: 7 };
    obj.worker = { terminate() { terminated = true; } };
    obj.url = null;
    obj.ready = true;
    obj._rejectPending = (err) => { rejected = err; };
    obj._timeoutHit(7);
    assert.equal(terminated, true, '首次超时应 terminate');
    assert.equal(obj.ready, false, '首次超时应 ready=false');
    assert.equal('timeoutStrikes' in obj, false, 'L18 · P3-2：命中后不再写 timeoutStrikes');
    assert.ok(rejected && /timeout/.test(rejected.message), '挂起请求应被拒绝');
  });
});

/* ---------- P2-1 · openTagPalette 自动颜色入历史栈 ---------- */
describe('L17-W4 · P2-1 · 自动颜色入历史栈', () => {
  test('A1 自动颜色 commit 使用 snapshot:true，旧 light+noRollback 零残留', () => {
    const line = SRC.split('\n').find((l) => l.includes("auto.addEventListener('mousedown'")) || '';
    assert.ok(line, '缺少自动颜色监听');
    assert.match(line, /\{snapshot:true\}/, '缺少 snapshot:true');
    assert.doesNotMatch(line, /noRollback:true/, '旧 noRollback 选项未移除');
    assert.doesNotMatch(line, /light:true/, '旧 light 选项未移除');
  });
});

/* ---------- P2-2 · docToXls 数值列 ---------- */
describe('L17-W4 · P2-2 · docToXls 数值列 Number', () => {
  test('B1 整数 / 小数导出为 Number，文本与空串仍为 String', () => {
    const fn = extractFn(SRC, 'function docToXls(doc){');
    assert.ok(fn, '缺少 docToXls');
    const docToExcel = () => '标题\t数量\t备注\nA\t2\tx\nB\t-3.5\t\n';
    const docToXls = new Function('docToExcel', fn + '\nreturn docToXls;')(docToExcel);
    const xml = docToXls({});
    assert.match(xml, /<Data ss:Type="Number">2<\/Data>/, '整数未按 Number 导出');
    assert.match(xml, /<Data ss:Type="Number">-3\.5<\/Data>/, '负数小数未按 Number 导出');
    assert.match(xml, /<Data ss:Type="String">x<\/Data>/, '文本不应变为 Number');
    assert.match(xml, /<Data ss:Type="String"><\/Data>/, '空串应保持 String');
  });
});

/* ---------- P2-3 · copyPlain 过滤 Symbol ---------- */
describe('L17-W4 · P2-3 · copyPlain 过滤 Symbol 键', () => {
  test('A1 循环首行跳过 symbol', () => {
    const fn = STRIP(extractFn(SRC, 'function copyPlain(src){') || '');
    assert.ok(fn, '缺少 copyPlain');
    assert.match(fn, /if\(typeof key==='symbol'\)continue;/, '缺少 Symbol 跳过');
  });

  test('B1 Symbol 键不进入结果，字符串键正常复制', () => {
    const fn = extractFn(SRC, 'function copyPlain(src){');
    assert.ok(fn);
    const copyPlain = new Function(fn + '\nreturn copyPlain;')();
    const sym = Symbol('counts');
    const src = { a: 1 };
    src[sym] = 42;
    const tgt = copyPlain(src);
    assert.equal(tgt.a, 1);
    assert.equal(Object.getOwnPropertySymbols(tgt).length, 0, 'Symbol 键不应被复制');
  });
});

/* ---------- P2-4 · buildTimeGrid 23:00 提示 ---------- */
describe('L17-W4 · P2-4 · 23:00 建待办提示', () => {
  test('B1 te 为空时触发 toast，te 有效时不触发', () => {
    const stmt = "if(!te){try{toast('已到当日末尾，默认无结束时间');}catch(e){}}";
    assert.ok(SRC.includes(stmt), '缺少 23:00 提示语句');
    let hits = 0;
    const toast = () => { hits++; };
    const run = new Function('te', 'toast', stmt);
    run(null, toast);
    run('23:00', toast);
    assert.equal(hits, 1, '仅无结束时间时提示');
  });
});

/* ---------- P3-1 · 删除 parseCalTimeInput ---------- */
describe('L17-W4 · P3-1 · 删除 parseCalTimeInput 死代码', () => {
  test('A1 全文件零定义 / 零调用', () => {
    assert.equal(SRC.includes('parseCalTimeInput'), false, 'parseCalTimeInput 仍存在');
  });
});

/* ---------- P3-2 · _l7TagCountText 占位符 ---------- */
describe('L17-W4 · P3-2 · 标签计数占位符（L18 · P3-3 起为省略号）', () => {
  test('B1 冷缓存返回省略号占位', () => {
    const fn = extractFn(SRC, 'function _l7TagCountText(){');
    assert.ok(fn, '缺少 _l7TagCountText');
    const run = new Function('_tagIndexCache', 'l7TagIndexWhenReady', '$', 'renderSubTags', fn + '\nreturn _l7TagCountText;')(null, () => {}, () => null, () => {});
    assert.equal(run(), '…', '冷缓存占位符应为省略号');
    assert.equal(fn.includes("return '—';"), false, '旧占位符 — 仍残留');
    assert.equal(fn.includes("return '0';"), false, '0 占位已由 L18 · P3-3 取代');
  });
});

/* ---------- P3-3 · _errSeen 清理策略注释 ---------- */
describe('L17-W4 · P3-3 · _errSeen 清理策略注释', () => {
  test('A1 注释位于全扫判断之前且表述完整', () => {
    const note = '/* 注：_errSeen.set 位于限流之前——错误风暴下不同 key 仍会进入去重表，故清理依赖「每 64 次访问全量扫过期」+「队首过期快路径」，不依赖 _ERR_RATE_MAX。 */';
    const iNote = SRC.indexOf(note);
    const iSweep = SRC.indexOf('if(++_errSweepCount>=_ERR_SWEEP_INTERVAL)');
    assert.ok(iNote >= 0, '缺少清理策略注释');
    assert.ok(iSweep > iNote, '注释应位于全扫判断之前');
  });
});

/* ---------- OP-L17W1-1 · renderTagsView 取 size ---------- */
describe('L17-W4 · OP-L17W1-1 · renderTagsView 取 size', () => {
  test('A1 计数改用 Set.size，旧 length 零残留', () => {
    const line = SRC.split('\n').find((l) => l.includes('const tags=Array.from(tagIndex.entries())')) || '';
    assert.ok(line, '缺少 renderTagsView 计数行');
    assert.match(line, /\[t,ids\.size\]/, '应使用 ids.size');
    assert.doesNotMatch(line, /\[t,ids\.length\]/, '旧 ids.length 零残留');
  });
});

/* ---------- OP-L17W3-2 · 根级 state.updatedAt 归一 ---------- */
describe('L17-W4 · OP-L17W3-2 · initStore 根时间戳归一', () => {
  test('A1/B1 秒级根时间戳 ×1000，毫秒原样', () => {
    const line = 'if (state.updatedAt > 0 && state.updatedAt < 1e10) state.updatedAt = Math.round(state.updatedAt * 1000);';
    assert.ok(SRC.includes(line), '缺少根级 updatedAt 秒级归一');
    const run = new Function('state', line + '\nreturn state;');
    assert.equal(run({ updatedAt: 1750000000 }).updatedAt, 1750000000000);
    assert.equal(run({ updatedAt: 1750000000123 }).updatedAt, 1750000000123);
    assert.equal(run({ updatedAt: 0 }).updatedAt, 0);
  });
});

/* ---------- 红证：只读冻结锚判别力 ---------- */
describe('L17-W4 · 红证（frozen-l14 改前形态）', () => {
  const OLD = readFileSync(FROZEN_L14, 'utf8');
  test('D1 旧形态齐备 ⇒ 各项断言具备判别力', () => {
    assert.equal(OLD.includes('LOG_TIMER_MAX'), false, '冻结锚不应含上限常量');
    assert.match(STRIP(extractFn(OLD, '_timeoutHit(gen){') || ''), /timeoutStrikes>=2/, '冻结锚应保留连续 2 次阈值');
    assert.match(OLD, /\{light:true,noRollback:true\}/, '冻结锚应为旧自动颜色选项');
    assert.ok(OLD.includes('parseCalTimeInput'), '冻结锚应含死代码');
    assert.match(OLD, /\[t,ids\.length\]/, '冻结锚应为旧 ids.length');
    assert.equal(OLD.includes('state.updatedAt > 0 && state.updatedAt < 1e10'), false, '冻结锚不应含根级秒级归一');
    assert.equal(OLD.includes("return '0';"), false, '冻结锚不应含新占位符');
  });
});
