/**
 * D-02 / D-08 · 富文本颜色归一单测
 *
 * 背景（见 90过程材料/_报告与元数据/v2.1-缺陷对比报告-2026-10-26.md D-02 / D-08）：
 *   一次选区施加「字体颜色 → 字号 → 背景色 → 加粗」后，产物 span 上出现
 *     background-color: color(srgb 0.2 0.396078 0.298039 / 0.14)
 *   这是 Chromium 150+ 的 computed 颜色序列化口径（CSS Color 4）。旧内核
 *   （WebView2 老版本 / 国产内核 / 老 Electron）不认识该语法 ⇒ 整条声明被丢弃
 *   ⇒ 用户看到「颜色不叠加 / 背景色失效」。
 *
 * 契约（本文件即验收口径）：
 *   1) `applyInlineStyle` 写入 style 之前，颜色值经 `normalizeInlineDeclValue` →
 *      `normalizeColorValue` 归一；
 *   2) 输出必须匹配 `^rgba?\(` 或 `^#[0-9a-f]{6}`（可由旧内核解析）；
 *   3) `color(srgb …)` 的 r/g/b 为 0~1 浮点 ⇒ ×255 取整；百分比按 ×2.55 取整；
 *   4) alpha < 1 输出 rgba()，alpha >= 1 输出 #RRGGBB；
 *   5) `sanitizeStyle` 白名单显式放行 color / background-color / font-size / font-weight，
 *      且清洗后的颜色同样是归一形态。
 *
 * 运行：node --test src/test/richtext-color-normalize.test.mjs
 *      （Node 22.18+ 默认启用 TS 类型剥离，可直接 import ../../../src/core/richtext.ts）
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeColorValue,
  normalizeInlineDeclValue,
  sanitizeStyle,
  CSS_WHITELIST,
  COLOR_STYLE_PROPS,
} from '../core/richtext.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RICHTEXT_SRC = path.join(HERE, '..', 'core', 'richtext.ts');

/** 任务书口径：输出必须是 rgb()/rgba() 或 6 位 hex */
const OK_COLOR_RE = /^(?:rgba?\(|#[0-9a-f]{6}$)/i;

test('D-02 · color(srgb r g b / a) 归一为 rgba()，且匹配合法颜色形态', () => {
  const input = 'color(srgb 0.2 0.396 0.298 / 0.14)';
  const out = normalizeColorValue(input);
  assert.match(out, OK_COLOR_RE, `输出必须匹配 ^rgba?\\( 或 ^#[0-9a-f]{6}，实际：${out}`);
  /* 0.2*255=51、0.396*255≈100.98→101、0.298*255≈75.99→76 */
  assert.equal(out, 'rgba(51, 101, 76, 0.14)');
});

test('D-02 · 不透明 srgb 归一为 #RRGGBB', () => {
  assert.equal(normalizeColorValue('color(srgb 1 0 0)'), '#ff0000');
  assert.equal(normalizeColorValue('color(srgb 0 0 1 / 1)'), '#0000ff');
  assert.equal(normalizeColorValue('color(srgb 1 1 1 / 100%)'), '#ffffff');
});

test('D-02 · srgb 百分比口径（×2.55 取整）', () => {
  assert.equal(normalizeColorValue('color(srgb 100% 0% 0%)'), '#ff0000');
  assert.equal(normalizeColorValue('color(srgb 0% 100% 0% / 50%)'), 'rgba(0, 255, 0, 0.5)');
});

test('D-02 · 空格语法 rgb(r g b / a) 与逗号语法 rgba() 均归一', () => {
  assert.equal(normalizeColorValue('rgb(0.2 0.396 0.298 / 0.14)'), 'rgba(51, 101, 76, 0.14)');
  assert.equal(normalizeColorValue('rgb(255 0 0)'), '#ff0000');
  assert.equal(normalizeColorValue('rgb(0 128 64 / 0.5)'), 'rgba(0, 128, 64, 0.5)');
  assert.equal(normalizeColorValue('rgba(230, 100, 50, 0.5)'), 'rgba(230, 100, 50, 0.5)');
  assert.equal(normalizeColorValue('rgb(0, 0, 0)'), '#000000');
});

test('D-02 · 已是 hex / 命名色 / 其它语法一律原样返回（不做猜测）', () => {
  assert.equal(normalizeColorValue('#1a2b3c'), '#1a2b3c');
  assert.equal(normalizeColorValue('#abc'), '#abc');
  assert.equal(normalizeColorValue('red'), 'red');
  assert.equal(normalizeColorValue('transparent'), 'transparent');
  assert.equal(normalizeColorValue('inherit'), 'inherit');
  assert.equal(normalizeColorValue('color-mix(in srgb, var(--fg) 18%, transparent)'),
    'color-mix(in srgb, var(--fg) 18%, transparent)');
  assert.equal(normalizeColorValue(''), '');
  assert.equal(normalizeColorValue(null), '');
});

test('D-02 · normalizeInlineDeclValue：颜色属性归一并支持驼峰写法', () => {
  const out = normalizeInlineDeclValue('background-color', 'color(srgb 0.2 0.396 0.298 / 0.14)');
  assert.match(out, OK_COLOR_RE);
  assert.equal(out, 'rgba(51, 101, 76, 0.14)');
  /* 驼峰写法必须与 kebab 等价（cssPropertyName 归一） */
  assert.equal(normalizeInlineDeclValue('backgroundColor', 'color(srgb 1 0 0)'), '#ff0000');
  /* 非颜色属性只去空白 */
  assert.equal(normalizeInlineDeclValue('font-size', ' 12px '), '12px');
  assert.equal(normalizeInlineDeclValue('font-weight', ' 700 '), '700');
});

test('D-02 · applyInlineStyle 入口接线：写入前必过 normalizeInlineDeclValue', () => {
  const src = readFileSync(RICHTEXT_SRC, 'utf8');
  const at = src.indexOf('export function applyInlineStyle(');
  assert.ok(at > 0, '未找到 applyInlineStyle 定义');
  /* 取函数体前 600 字符做接线断言（足够覆盖入口归一那一行） */
  const head = src.slice(at, at + 600);
  assert.match(head, /normalizeInlineDeclValue\(prop,\s*styleValue\)/,
    'applyInlineStyle 入口未调用 normalizeInlineDeclValue —— 颜色会在写入 style 前漏归一');
});

test('D-02 · CSS_WHITELIST 显式放行 color / background-color / font-size / font-weight', () => {
  for (const prop of ['color', 'background-color', 'font-size', 'font-weight']) {
    assert.ok(CSS_WHITELIST.has(prop), `CSS_WHITELIST 缺少 ${prop}`);
  }
  assert.ok(COLOR_STYLE_PROPS.has('color'));
  assert.ok(COLOR_STYLE_PROPS.has('background-color'));
});

test('D-02 · sanitizeStyle 清洗后颜色仍为归一形态，且四项白名单不被丢弃', () => {
  const raw = 'position:fixed;background-color: color(srgb 0.2 0.396 0.298 / 0.14);'
    + 'color: color(srgb 1 0 0);font-size: 12px;font-weight: 700;z-index: 9999';
  const out = sanitizeStyle(raw);
  assert.ok(!/color\(srgb/i.test(out), `清洗结果不应残留 color(srgb …)：${out}`);
  assert.ok(out.includes('background-color:rgba(51, 101, 76, 0.14)'), out);
  assert.ok(out.includes('color:#ff0000'), out);
  assert.ok(out.includes('font-size:12px'), out);
  assert.ok(out.includes('font-weight:700'), out);
  assert.ok(!out.includes('position'), `position 属覆盖类属性，必须剥离：${out}`);
  assert.ok(!out.includes('z-index'), `z-index 属覆盖类属性，必须剥离：${out}`);
});
