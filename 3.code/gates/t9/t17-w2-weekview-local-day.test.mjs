/**
 * L17-W2 · 缺陷修复指令 2「周视图 UTC / 本地时区错位（Defect-P0-2）」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义（Defect-P0-2）：
 *   renderCalendarPage() 的 week 分支以 UTC 取值器解析选中日：
 *     const selY=sel.getUTCFullYear(),selM=sel.getUTCMonth(),selD=sel.getUTCDate();
 *     const dow=new Date(Date.UTC(selY,selM,selD)).getUTCDay();
 *   而 parseYmd()（FIX-TZ-1 起）按本地时区构造（new Date(y,mo-1,d)），ymd() / getDay() /
 *   buildTimeGrid() 亦一律使用本地日历语义。东八区（UTC+8）本地零点 = 前一日 16:00Z
 *   ⇒ UTC 日期恒比本地日期早一天，UTC 星期 = 本地星期 − 1（模 7）：
 *     · 周一 ~ 周六：起始日 (selD-1)-(dow-1) 两项恰好抵消，结果仍正确；
 *     · 周日：本地 dow=0 而 UTC dow=6，且 selD 少 1 ⇒ 起始日 = 选中日 − 7，
 *       整周回退一周（列头星期 / 时段条带 / 当天高亮全部错位）。
 * 本波改动（L17-W2）：
 *   selY / selM / selD 改本地取值器；dow = new Date(selY,selM,selD).getDay()；
 *   days 仍为「以周日为首」的 7 日序列（口径不变：for(i<7) new Date(selY,selM,selD-dow+i)）。
 * 断言口径：
 *   A. 结构锚点：week 分支（renderCalendarPage 内）不再出现 UTC 取值器 / Date.UTC；
 *      本地取值器、本地基准日、7 日序列与 buildTimeGrid(days) 收口齐备。
 *   B. 行为：周六 / 周日 / 周日跨月 / 周五跨年 → 周区间 = 含选中日的「周日 → 周六」7 日。
 *   C. 边界：selectedDate 缺省回退 todayStr()；7 日均为本地零点；列首恒为周日。
 *   D. 红证：只读冻结锚 frozen-l14 的改前形态 ⇒ 周日整周回退（起始日 = 选中日 − 7、
 *      选中日不在周内）；同一改前形态在周六「巧合正确」，说明缺陷仅周日显形。
 *   E. 属性采样：2026-01-01 ~ 2027-12-31 共 730 日逐日校验（首日周日 / 序列连续 / 含选中日 /
 *      星期序列 0..6）。
 * 运行：`node --test l9/t17-w2-weekview-local-day.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* 固定被测时区为东八区：缺陷在正偏移时区必然显形；Node >= 16 支持运行期覆写 TZ。
   本赋值必须先于任何 Date 构造（本文件模块顶层不构造 Date）。 */
process.env.TZ = 'Asia/Shanghai';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const ROOT = path.resolve(STEP9, '..', '..');
const CANONICAL = process.env.JU_L17W2_CANONICAL
  ? path.resolve(process.env.JU_L17W2_CANONICAL)
  : path.resolve(STEP9, '..', 'canonical', 'v2.0-t3.html');
/* 只读历史锚（改前形态 · 仅读取 · 不写入） */
const FROZEN_L14 = path.resolve(ROOT, '99.hist', '6.dev', 'frozen', 'v2.0-t3-frozen-t14-2026-10-16.html');

const SRC = readFileSync(CANONICAL, 'utf8');

/* ---------- 1) 提取 week 分支与 parseYmd（以唯一收口语句定界，规避同名分支） ---------- */
const WEEK_HEAD = "}else if(calView==='week'){";
const WEEK_TAIL = 'top.appendChild(buildTimeGrid(days));';

function extractWeekBody(src) {
  const tail = src.indexOf(WEEK_TAIL);
  assert.ok(tail > 0, '源码缺少 week 分支收口 top.appendChild(buildTimeGrid(days));');
  const head = src.lastIndexOf(WEEK_HEAD, tail);
  assert.ok(head > 0, '源码缺少 week 分支头 }else if(calView===\'week\'){');
  return src.slice(head + WEEK_HEAD.length, tail + WEEK_TAIL.length);
}

function extractParseYmd(src) {
  const s = src.indexOf('function parseYmd(s){');
  assert.ok(s > 0, '源码缺少 function parseYmd(s){');
  const e = src.indexOf('\n}\n', s + 10);
  assert.ok(e > s, 'parseYmd 结束定界失败');
  return src.slice(s, e + 2);
}

/* 仅剥离注释后再做代码形态断言（本波说明注释引用了旧写法，避免自证干扰） */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const WEEK_BODY = extractWeekBody(SRC);
const WEEK_CODE = stripComments(WEEK_BODY);

/* ---------- 2) 最小装配：只提供 week 分支触达的依赖 ---------- */
function makeRunner(src) {
  const body = extractWeekBody(src);
  const parseSrc = extractParseYmd(src);
  const parseFn = new Function(parseSrc + '\nreturn parseYmd;')();
  const todayStr = () => '2026-10-17'; /* 固定「今天」以便复现缺省回退 */
  const run = new Function('ui', 'top', 'parseYmd', 'todayStr', 'buildTimeGrid', body);
  return function runWeek(selectedDate) {
    const cap = { days: null, calls: 0 };
    const top = { appendChild() { } };
    const ui = { selectedDate };
    const buildTimeGrid = (days) => { cap.calls++; cap.days = days.slice(); return null; };
    run(ui, top, parseFn, todayStr, buildTimeGrid);
    assert.equal(cap.calls, 1, 'week 分支必须且仅调用一次 buildTimeGrid');
    assert.equal(cap.days.length, 7, 'week 分支必须产出 7 日');
    return cap.days;
  };
}

const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const ymds = (days) => days.map(ymd);

/* 连续日期文案（以 UTC 正午为锚，规避夏令时位移；仅测试辅助使用） */
function seq(startYmd, n) {
  const [y, m, d] = startYmd.split('-').map(Number);
  const out = [];
  for (let i = 0; i < n; i++) out.push(ymd(new Date(Date.UTC(y, m - 1, d + i, 12))));
  return out;
}

/* ---------- 3) A. 结构锚点 ---------- */
describe('L17-W2 · 结构锚点', () => {
  test('week 分支不含 UTC 取值器 / Date.UTC', () => {
    assert.equal(/getUTC/.test(WEEK_CODE), false, 'week 分支仍残留 getUTC* 取值器');
    assert.equal(/Date\.UTC/.test(WEEK_CODE), false, 'week 分支仍残留 Date.UTC 构造');
  });
  test('week 分支使用本地取值器与本地基准日', () => {
    assert.match(WEEK_CODE, /sel\.getFullYear\(\)/, '缺少 sel.getFullYear()');
    assert.match(WEEK_CODE, /sel\.getMonth\(\)/, '缺少 sel.getMonth()');
    assert.match(WEEK_CODE, /sel\.getDate\(\)/, '缺少 sel.getDate()');
    assert.match(WEEK_CODE, /new Date\(selY,selM,selD\)\.getDay\(\)/, '缺少本地基准日求星期');
  });
  test('7 日序列与 buildTimeGrid(days) 收口逐字保留', () => {
    assert.match(WEEK_CODE, /new Date\(selY,selM,selD-dow\+i\)/, '缺少 7 日序列生成');
    assert.match(WEEK_CODE, /top\.appendChild\(buildTimeGrid\(days\)\)/, '缺少 buildTimeGrid 收口');
  });
  test('选中日解析口径未改动（parseYmd + todayStr 回退）', () => {
    assert.match(WEEK_CODE, /parseYmd\(ui\.selectedDate\|\|todayStr\(\)\)/, '选中日解析口径被改动');
  });
});

/* ---------- 4) B. 行为：周区间 ---------- */
describe('L17-W2 · 周区间（东八区）', () => {
  const runWeek = makeRunner(SRC);

  test('周六 2026-10-17 → 2026-10-11 ~ 2026-10-17', () => {
    assert.deepEqual(ymds(runWeek('2026-10-17')), seq('2026-10-11', 7));
  });
  test('周日 2026-10-18 → 2026-10-18 ~ 2026-10-24（缺陷触发日）', () => {
    assert.deepEqual(ymds(runWeek('2026-10-18')), seq('2026-10-18', 7));
  });
  test('周日跨月 2026-11-01 → 2026-11-01 ~ 2026-11-07', () => {
    assert.deepEqual(ymds(runWeek('2026-11-01')), seq('2026-11-01', 7));
  });
  test('周五跨年 2027-01-01 → 2026-12-27 ~ 2027-01-02', () => {
    assert.deepEqual(ymds(runWeek('2027-01-01')), seq('2026-12-27', 7));
  });
});

/* ---------- 5) C. 边界与降级 ---------- */
describe('L17-W2 · 边界与降级', () => {
  const runWeek = makeRunner(SRC);

  test('selectedDate 缺省 → 回退 todayStr()（2026-10-17 所在周）', () => {
    assert.deepEqual(ymds(runWeek('')), seq('2026-10-11', 7));
  });
  test('selectedDate 非法（非 YYYY-MM-DD）→ 不抛错 · 7 日形态与改前一致（非回归）', () => {
    /* 非法串非空 ⇒ 不触发 todayStr() 回退，parseYmd 返回 Invalid Date；本波只改取值器，
       该路径行为必须与改前逐日一致（仅断言不抛错 + 与冻结锚同形，不把 NaN 当成期望语义）。 */
    const newDays = ymds(runWeek('2026/10/18'));
    const oldDays = ymds(makeRunner(readFileSync(FROZEN_L14, 'utf8'))('2026/10/18'));
    assert.equal(newDays.length, 7);
    assert.deepEqual(newDays, oldDays);
  });
  test('7 日均为本地零点（避免 UTC 构造残留的时分偏移）', () => {
    for (const d of runWeek('2026-10-18')) {
      assert.equal(d.getHours(), 0);
      assert.equal(d.getMinutes(), 0);
      assert.equal(d.getSeconds(), 0);
      assert.equal(d.getMilliseconds(), 0);
    }
  });
  test('列首恒为周日、列尾恒为周六（星期序列 0..6）', () => {
    for (const sel of ['2026-10-11', '2026-10-12', '2026-10-18', '2026-12-31', '2027-01-01']) {
      const days = runWeek(sel);
      for (let i = 0; i < 7; i++) assert.equal(days[i].getDay(), i, sel + ' 第 ' + i + ' 列星期不符');
    }
  });
});

/* ---------- 6) D. 红证：只读冻结锚的改前形态 ---------- */
describe('L17-W2 · 红证（frozen-l14 改前形态）', () => {
  test('只读冻结锚存在', () => {
    assert.ok(existsSync(FROZEN_L14), '缺少只读冻结锚 frozen-l14');
  });
  test('改前形态：周日整周回退 7 日（选中日不在周内）', () => {
    const oldRunWeek = makeRunner(readFileSync(FROZEN_L14, 'utf8'));
    const days = ymds(oldRunWeek('2026-10-18'));
    assert.deepEqual(days, seq('2026-10-11', 7), '改前形态周日应为「上一周」');
    assert.equal(days.includes('2026-10-18'), false, '改前形态周日周区间不含选中日');
  });
  test('改前形态：周六巧合正确（缺陷仅周日显形）', () => {
    const oldRunWeek = makeRunner(readFileSync(FROZEN_L14, 'utf8'));
    assert.deepEqual(ymds(oldRunWeek('2026-10-17')), seq('2026-10-11', 7));
  });
  test('改前形态：结构锚点必然不成立（UTC 取值器仍在）', () => {
    const oldCode = stripComments(extractWeekBody(readFileSync(FROZEN_L14, 'utf8')));
    assert.equal(/getUTC/.test(oldCode), true, '冻结锚应保留 UTC 取值器（红证判别力）');
  });
});

/* ---------- 7) E. 属性采样：730 日 ---------- */
describe('L17-W2 · 属性采样（2026-01-01 ~ 2027-12-31）', () => {
  test('逐日：首日周日 · 序列连续 · 含选中日 · 星期 0..6', () => {
    const runWeek = makeRunner(SRC);
    const base = Date.UTC(2026, 0, 1, 12);
    for (let i = 0; i < 730; i++) {
      const sel = ymd(new Date(base + i * 86400000));
      const days = runWeek(sel);
      const ys = ymds(days);
      assert.equal(ys.includes(sel), true, sel + ' 的周区间不含选中日');
      assert.deepEqual(ys, seq(ys[0], 7), sel + ' 的周区间不连续');
      for (let k = 0; k < 7; k++) assert.equal(days[k].getDay(), k, sel + ' 第 ' + k + ' 列星期不符');
    }
  });
});
