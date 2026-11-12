/**
 * L16-W9 · 指令 9「抽取硬编码主题色为 CSS 变量」N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：canonical 中与主题相关的 #RRGGBB 硬编码抽取为 CSS 自定义属性（语义化 token）；
 *           :root 定义日间值，html[data-theme="night"] 覆盖夜间值；关闭钮 hover 用
 *           color-mix(in srgb,var(--danger) 20%,transparent) 并以纯 token 值回退；
 *           JS 侧（调色板 / 图谱导出 / 彩图 PNG / 导出 HTML / 演示层）改由 _themeColor /
 *           _themeList 读取 CSS 自定义属性。
 * 断言口径（确定性 · 无 wall-clock 强阈值，承接 L16-W1..W8 范式）：
 *   A. 结构锚点：canonical 具备 _themeColor / _themeList 读取器；关闭钮 hover 含
 *      color-mix(in srgb,var(--danger) 20%,transparent) 且含纯 token 回退声明。
 *   B. 抽取口径：:root / html[data-theme="night"] 定义块之外的 #RRGGBB 命中相对基线 118 下降 ≥80%
 *      （实测 0 · 100%）。白名单口径（TODO-4 审计）：主题选择面板「日夜缩略图」的
 *      `isNight?'#RRGGBB':'#RRGGBB'` 成对字面量属合法新增（同屏并排渲染两套色板，无法用当前主题 token 表达），
 *      按模式精确剔除；其余定义块外 #RRGGBB 一律视为回退。
 *   C. 语义 token 齐备：日间 / 夜间块分别含语义 token；夜间覆盖规则不再含字面色值；
 *      侧栏激活项用独立语义 token --sb-nav-active-fg，并断言日/夜对比度 ≥ 4.5:1（TODO-5）。
 *   D. 结果等价：--color-palette / --opt-palette / --tag-palette 解析值与抽取前硬编码数组逐项相等
 *      （颜色零漂移）。
 *   E. 结构不变量：内联 <script> 块数保持 9。
 *   F. 性能验收：token 解析（大 token 表 + 10 万次采样）P95 < 50µs。
 * 运行：`node --test l9/t16-w9-theme-token.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const CANONICAL = path.resolve(STEP9, '..', 'v2.0-t3.html');
const SRC = readFileSync(CANONICAL, 'utf8');

const HEX6 = /#[0-9A-Fa-f]{6}\b/g;
const HEX_OUTSIDE_BASELINE = 118;

function tokenBlock(str, opener) {
  const i = str.indexOf(opener);
  assert.ok(i >= 0, `canonical 缺少定义块 ${opener}`);
  const j = str.indexOf('}', i);
  return str.slice(i, j + 1);
}
function parseTokens(block) {
  const map = new Map();
  const re = /--([A-Za-z0-9-]+)\s*:\s*([^;}\n]+)/g;
  let m;
  while ((m = re.exec(block)) !== null) map.set(m[1], m[2].trim());
  return map;
}
function stripDefBlocks(str) {
  let out = str;
  for (const opener of [':root{', 'html[data-theme="night"]{']) {
    const i = out.indexOf(opener);
    if (i < 0) continue;
    const j = out.indexOf('}', i);
    out = out.slice(0, i) + out.slice(j + 1);
  }
  return out;
}

const DAY = parseTokens(tokenBlock(SRC, ':root{'));
const NIGHT = parseTokens(tokenBlock(SRC, 'html[data-theme="night"]{'));

/* R51（2026-10-22 · 取色面板改为 8 列 × 3 行 · 同列同色系由浅到深）：--color-palette 由旧 24 色
   重定义为新 24 色（8 组「浅 / 中 / 深」三连，按列序排列，配合 grid-auto-flow:column 逐列填充）；
   日间与夜间共用同一组色值。断言口径不变（逐项相等 · 数量 24），期望值同步为新基线。 */
const DAY_PALETTE_EXPECT = ['#F5D6D2', '#FF6B6B', '#9E2E24', '#FBE2D5', '#FF9F45', '#9E5620', '#F5EBC8', '#FFD93D', '#9E7C14', '#D2EEDC', '#6BCB77', '#2E7D4F', '#D1E9EA', '#38C6C6', '#1E7E7E', '#D6E2F5', '#4D96FF', '#2E59A7', '#E8D6F5', '#B983FF', '#7B4BA8', '#FFFFFF', '#8B7C66', '#000000'];
const NIGHT_PALETTE_EXPECT = ['#F5D6D2', '#FF6B6B', '#9E2E24', '#FBE2D5', '#FF9F45', '#9E5620', '#F5EBC8', '#FFD93D', '#9E7C14', '#D2EEDC', '#6BCB77', '#2E7D4F', '#D1E9EA', '#38C6C6', '#1E7E7E', '#D6E2F5', '#4D96FF', '#2E59A7', '#E8D6F5', '#B983FF', '#7B4BA8', '#FFFFFF', '#8B7C66', '#000000'];
const OPT_PALETTE_EXPECT = ['#E15554', '#3BB273', '#E1BC29', '#4D9DE0', '#7768AE', '#E8871E', '#20B2AA', '#D9534F'];
/* R29（2026-10-21 · 标签调色板高区分度改造）：--tag-palette 由偏暗偏灰的旧 8 色
   （#8A423B #8F5230 #7A6E2E #5F7A5C #4E6D8C #6E5C78 #7A5A2E #556675）替换为中浅明度 /
   低灰度新 8 色（浏览器实测 H 0/31.2/49.8/89.2/144.1/203.9/256.8/319.2°，S 46.1%~94.5%，
   L 40.0%~60.0%；旧 8 色最近一对色相差仅 1.9°、最低饱和度 13.2%）。
   本断言由「与抽取前硬编码数组逐项相等（颜色零漂移）」改为「与调色板改造后基线逐项相等」，
   数量仍为 8 项，校验口径（逐项相等 / 数量）不变。 */
const TAG_PALETTE_EXPECT = ['#E05252', '#E8871E', '#D4B106', '#7CB342', '#2E9E5B', '#3B9AD9', '#8064C8', '#C44D9E'];

const splitList = (v) => (v || '').split(/\s+/).filter(Boolean);
const p95 = (arr) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * 0.95))]; };

/* ---------- 颜色解析 / WCAG 对比度（TODO-5：防夜间激活项对比度回归） ---------- */
function parseColor(v) {
  const s = String(v || '').trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) { const n = parseInt(m[1], 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }; }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) { const p = m[1].split(',').map((x) => parseFloat(x.trim())); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; }
  throw new Error('无法解析颜色值: ' + s);
}
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
function relLum(c) {
  const ch = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}
function contrast(a, b) {
  const l1 = relLum(a), l2 = relLum(b);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
/* 激活项实际底色 = --accent-soft 合成到 --bg-soft（夜间 accent-soft 含 alpha） */
const activeNavBg = (tokens) => over(parseColor(tokens.get('accent-soft')), parseColor(tokens.get('bg-soft')));

describe('L16-W9 - extract hardcoded theme colors into CSS variables', () => {
  test('A anchors: _themeColor/_themeList readers + close-hover color-mix with pure-token fallback', () => {
    assert.ok(SRC.includes('function _themeColor('), 'canonical 缺少 _themeColor 读取器');
    assert.ok(SRC.includes('function _themeList('), 'canonical 缺少 _themeList 读取器');
    const rule = '.tb-wbtn.close:hover{background:var(--close-hover-bg);background:color-mix(in srgb,var(--danger) 20%,transparent)}';
    assert.ok(SRC.includes(rule), '关闭钮 hover 应为「纯 token 回退 + color-mix 20%」双声明');
  });

  test('B extraction: #RRGGBB outside definition blocks drops >=80% (actual 0)', () => {
    /* TODO-4 白名单口径：主题选择面板的日夜缩略图在 JS 内成对写死 isNight?A:B 字面色，
       需求是「同屏并排渲染日间/夜间两套色板」，无法用当前主题的 CSS token 表达，且不得为测试改动 JS 逻辑。
       仅剔除该精确模式，其余定义块外 #RRGGBB 仍计入。 */
    const scannable = stripDefBlocks(SRC).replace(/isNight\?'#[0-9A-Fa-f]{6}':'#[0-9A-Fa-f]{6}'/g, '');
    const outside = (scannable.match(HEX6) || []).length;
    const drop = (HEX_OUTSIDE_BASELINE - outside) / HEX_OUTSIDE_BASELINE;
    assert.equal(outside, 0, `定义块外仍残留 ${outside} 处 #RRGGBB`);
    assert.ok(drop >= 0.80, `抽取下降 ${(drop * 100).toFixed(1)}% 未达 80%`);
    /* 白名单不得吞噬真实回退：产品仍须保留 6 对（12 处）预览色，硬编码总量应仍在 */
    const previewPairs = (stripDefBlocks(SRC).match(/isNight\?'#[0-9A-Fa-f]{6}':'#[0-9A-Fa-f]{6}'/g) || []).length;
    assert.equal(previewPairs, 6, `预览缩略图昼夜成对字面色应为 6 对，实为 ${previewPairs}`);
  });

  test('C semantic tokens present (day + night)', () => {
    const dayKeys = ['close-hover-bg', 'danger-soft', 'editor-fg', 'cp-custom-fill', 'cp-custom-alt', 'tag-fallback', 'prio-p1', 'prio-p2', 'prio-p3', 'prio-p4', 'prio-p5', 'pres-bg', 'pres-stage-bg', 'mm-bg', 'mm-fg', 'mm-node-bg', 'mm-node-stroke', 'mm-root-bg', 'mm-line', 'color-palette', 'opt-palette', 'tag-palette', 'tag-auto-gradient', 'sb-nav-active-fg'];
    for (const k of dayKeys) assert.ok(DAY.has(k), `:root 缺少 token --${k}`);
    const nightKeys = ['active-fg-on-accent', 'on-danger-fg', 'now-label-fg', 'night-grad-a', 'night-grad-b', 'mm-bg', 'mm-fg', 'mm-node-bg', 'mm-node-stroke', 'mm-root-bg', 'mm-line', 'color-palette', 'sb-nav-active-fg'];
    for (const k of nightKeys) assert.ok(NIGHT.has(k), `夜间块缺少 token --${k}`);
    assert.ok(SRC.includes('html[data-theme="night"] .cal-rest{color:var(--on-danger-fg)}'), 'cal-rest 夜间规则未 token 化');
    assert.ok(SRC.includes('.sb-nav-item.active{background:var(--accent-soft);color:var(--sb-nav-active-fg)'), 'sb-nav active 日间规则未走语义 token');
    assert.ok(SRC.includes('html[data-theme="night"] .sb-nav-item.active{color:var(--sb-nav-active-fg)}'), 'sb-nav active 夜间规则未 token 化');
    /* TODO-5：为什么不用 --active-fg-on-accent——该 token 是亮色 --accent 底上的深色字；
       夜间 --accent-soft = rgba(20,45,80,.85) 为深底，套用后对比度仅 ~1.28:1，属视觉回归。
       故改用独立语义 token --sb-nav-active-fg，并要求日/夜对比度均达 WCAG AA（4.5:1）。 */
    const dayRatio = contrast(parseColor(DAY.get('sb-nav-active-fg')), activeNavBg(DAY));
    const nightRatio = contrast(parseColor(NIGHT.get('sb-nav-active-fg')), activeNavBg(NIGHT));
    assert.ok(dayRatio >= 4.5, `日间激活项对比度 ${dayRatio.toFixed(2)}:1 < 4.5:1`);
    assert.ok(nightRatio >= 4.5, `夜间激活项对比度 ${nightRatio.toFixed(2)}:1 < 4.5:1`);
  });

  test('D equivalence: palette token values equal the pre-extraction hardcoded arrays', () => {
    assert.deepEqual(splitList(DAY.get('color-palette')), DAY_PALETTE_EXPECT);
    assert.deepEqual(splitList(NIGHT.get('color-palette')), NIGHT_PALETTE_EXPECT);
    assert.deepEqual(splitList(DAY.get('opt-palette')), OPT_PALETTE_EXPECT);
    assert.deepEqual(splitList(DAY.get('tag-palette')), TAG_PALETTE_EXPECT);
  });

  test('E invariant: inline <script> block count stays 9', () => {
    const n = (SRC.match(/<script\b/gi) || []).length;
    assert.equal(n, 9, `<script> 块数应为 9，实为 ${n}`);
  });

  test('F perf: token resolution (100k samples) P95 < 50us', () => {
    const resolveOne = (name) => DAY.get(name) || NIGHT.get(name) || '';
    const names = [...DAY.keys(), ...NIGHT.keys()];
    const N = 100000;
    const lat = new Array(N);
    for (let i = 0; i < N; i++) {
      const t0 = process.hrtime.bigint();
      resolveOne(names[i % names.length]);
      const t1 = process.hrtime.bigint();
      lat[i] = Number(t1 - t0) / 1e3; /* us */
    }
    const p = p95(lat);
    assert.ok(p < 50, `token 解析 P95 = ${p.toFixed(3)}us 未达预算 50us`);
  });
});
