#!/usr/bin/env node
/**
 * 铁律6 静态门禁前置清理（一次性脚本）
 *
 * `scripts/verify.js` 的 aiNoteLint 扫描 step9 全树代码文件，命中 4 处
 * 「内容由AI生成」注释（tests/l3-*.spec.ts）。这 4 个文件不参与 PW_TESTS
 * （门禁实际运行的是 tests/t3-*.spec.ts），但命中会使静态步骤 exit 3。
 *
 * 处理：仅删除该注释行本身，其余字节与行尾保持不变。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const FILES = [
  'tests/l3-invariants.spec.ts',
  'tests/l3-commit-callbacks.spec.ts',
  'tests/l3-light-pollution.spec.ts',
  'tests/l3-reference-semantics.spec.ts',
];
const LINE_RE = /[ \t]*\/\/（注：内容由AI生成）[ \t]*(\r?\n)?/g;
const ROOT = '6.P0-T3基线/step9/';

for (const rel of FILES) {
  const p = ROOT + rel;
  const before = fs.readFileSync(p);
  const text = before.toString('utf8');
  const hits = (text.match(LINE_RE) || []).length;
  if (hits === 0) {
    console.log('SKIP ' + rel + ' (no match)');
    continue;
  }
  const next = text.replace(LINE_RE, '');
  fs.writeFileSync(p, next, 'utf8');
  const after = fs.readFileSync(p);
  console.log(
    'CLEANED ' + rel +
    ' removed=' + hits +
    ' bytes ' + before.length + '->' + after.length +
    ' sha256=' + crypto.createHash('sha256').update(after).digest('hex').toUpperCase(),
  );
}
