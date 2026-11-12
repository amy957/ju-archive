#!/usr/bin/env node
/**
 * ISSUE-001 延伸 · t9 回归用例的冻结锚路径重定位（一次性脚本）
 *
 * 8 个 t9/*.test.mjs 以 path.resolve(ROOT, '1.冻结版本', ...) 读取只读历史锚
 * （frozen-l14 / frozen-l17），冻结件迁入 1.历史归档\1.1冻结版本 后这些用例
 * 全部报 ENOENT。本脚本把字面量 '1.冻结版本' 替换为 '1.历史归档', '1.1冻结版本'
 * （每文件恰 1 处），并打印新 size / sha256 / EOL 供登记器重锚。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const ROOT = '6.P0-T3基线/step9/';
const FILES = [
  't9/t17-w1-rendersubtags-rows.test.mjs',
  't9/t17-w2-weekview-local-day.test.mjs',
  't9/t17-w3-p1-fixes.test.mjs',
  't9/t17-w4-batch-fixes.test.mjs',
  't9/t18-final-patch.test.mjs',
  't9/t19-patch1.test.mjs',
  't9/t19-patch2.test.mjs',
  't9/t19-patch3.test.mjs',
];
const FROM = "'1.冻结版本'";
const TO = "'1.历史归档', '1.1冻结版本'";

function eolOf(buf) {
  let lf = 0;
  let cr = 0;
  for (const b of buf) {
    if (b === 10) lf++;
    else if (b === 13) cr++;
  }
  if (cr === 0) return 'LF';
  if (cr === lf) return 'CRLF';
  return 'MIXED';
}

for (const rel of FILES) {
  const p = ROOT + rel;
  const before = fs.readFileSync(p);
  const text = before.toString('utf8');
  const hits = text.split(FROM).length - 1;
  if (hits !== 1) {
    console.error('ABORT ' + rel + ' unexpected occurrences=' + hits);
    process.exit(1);
  }
  fs.writeFileSync(p, text.split(FROM).join(TO), 'utf8');
  const after = fs.readFileSync(p);
  console.log(
    'PATCHED ' + rel +
    ' size=' + after.length +
    ' eol=' + eolOf(after) +
    ' sha256=' + crypto.createHash('sha256').update(after).digest('hex').toUpperCase(),
  );
}
