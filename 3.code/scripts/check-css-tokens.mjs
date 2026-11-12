#!/usr/bin/env node
/* 【优化 #6】CSS 令牌门禁：src/style.css 的裸 hex 与 !important 计数只降不升。
   规则：新增必须走 CSS 变量 / 选择器合并；确需新增时改 scripts/css-tokens-baseline.json 并写明理由。
   用法：node scripts/check-css-tokens.mjs           检查
        node scripts/check-css-tokens.mjs --write-baseline  重新取基线（须在 PR 说明理由） */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const CSS = path.join(PROJECT, 'src', 'style.css');
const BASE = path.join(HERE, 'css-tokens-baseline.json');

if (!existsSync(CSS)) { console.error('[css-tokens] ✗ 缺少 ' + CSS); process.exit(1); }
const src = readFileSync(CSS, 'utf8');
/* 只统计规则体（剔除注释与选择器），避免注释里的示例色值被计入 */
const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
const hex = (body.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
const important = (body.match(/!important/g) || []).length;
const now = { hex, important };

if (process.argv.includes('--write-baseline')) {
  writeFileSync(BASE, JSON.stringify(now, null, 2) + '\n', 'utf8');
  console.log('[css-tokens] baseline written: hex=' + hex + ' important=' + important);
  process.exit(0);
}
if (!existsSync(BASE)) { console.error('[css-tokens] ✗ 缺少基线 ' + BASE + '（先 --write-baseline）'); process.exit(1); }
const base = JSON.parse(readFileSync(BASE, 'utf8'));
const bad = [];
if (now.hex > (base.hex ?? 0)) bad.push('hex ' + base.hex + ' -> ' + now.hex);
if (now.important > (base.important ?? 0)) bad.push('!important ' + base.important + ' -> ' + now.important);
if (bad.length) {
  console.error('[css-tokens] ✗ 新增 CSS 硬编码：' + bad.join('、') + '（请改用 CSS 变量；确需新增请改基线并说明理由）');
  process.exit(1);
}
console.log('[css-tokens] ✓ hex=' + now.hex + '/' + base.hex + '  !important=' + now.important + '/' + base.important + '（只降不升）');
