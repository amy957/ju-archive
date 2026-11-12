#!/usr/bin/env node
/**
 * ISSUE-001 · verify-hash-registry.mjs 锚点路径重定位（一次性脚本）
 *
 * 冻结件已从根级 `1.冻结版本/` 迁入 `1.历史归档/1.1冻结版本/`；
 * 本脚本把 TARGETS 中 26 条 `path.join(ROOT, '1.冻结版本', ...)` 改写为
 * `path.join(ROOT, '1.历史归档', '1.1冻结版本', ...)`。
 *
 * 安全约束：匹配数必须恰为 26，否则不写盘直接失败（防止误替换）。
 * 行尾：按 UTF-8 纯文本读写，脚本只做字符串替换，不做行尾归一化。
 */
import fs from 'node:fs';

const TARGET = '6.P0-T3基线/step9/verify-hash-registry.mjs';
const FROM = "path.join(ROOT, '1.冻结版本'";
const TO = "path.join(ROOT, '1.历史归档', '1.1冻结版本'";
const EXPECTED = 26;

const text = fs.readFileSync(TARGET, 'utf8');
const hits = text.split(FROM).length - 1;
if (hits !== EXPECTED) {
  console.error('UNEXPECTED_MATCH_COUNT=' + hits + ' (expected ' + EXPECTED + ')');
  process.exit(1);
}

const next = text.split(FROM).join(TO);
fs.writeFileSync(TARGET, next, 'utf8');

console.log('REPLACED=' + hits);
console.log('NEW_RELOCATED_COUNT=' + (next.split(TO).length - 1));
console.log('RESIDUAL_OLD_PATH_JOIN=' + (next.split(FROM).length - 1));
console.log('FILE_CRLF=' + next.includes('\r\n'));
