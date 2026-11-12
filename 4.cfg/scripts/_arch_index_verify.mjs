#!/usr/bin/env node
/**
 * ARCHIVE-INDEX 自校验 · v2（2026-10-29 · ISSUE-014）
 * ---------------------------------------------------------------------------
 * 逐条复核索引 §2 文件清单：
 *   1) 路径存在（Test-Path 等价）；
 *   2) 实际字节数 == 登记字节数；
 *   3) 实际 SHA-256 == 登记 SHA-256；
 *   4) 全文不含失效前缀（`1.冻结版本` / `1.归档快照`）。
 * 纯只读。用法：node "90过程材料/_临时脚本/_arch_index_verify.mjs"
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IDX = path.join(ROOT, '90过程材料', '_报告与元数据', 'ARCHIVE-INDEX.md');
const text = readFileSync(IDX, 'utf8');

let stale = 0;
for (const bad of ['1.冻结版本', '1.归档快照']) {
  const n = text.split(bad).length - 1;
  console.log(`STALE_PREFIX ${bad} = ${n}`);
  stale += n;
}

const re = /^\| (\d+) \| `([^`]+)` \| (\d+) \| `([0-9A-F]{64})` \|$/gm;
let m; let total = 0; let ok = 0; let missing = 0; let sizeBad = 0; let hashBad = 0;
const problems = [];
while ((m = re.exec(text)) !== null) {
  total++;
  const rel = m[2];
  const expSize = Number(m[3]);
  const expHash = m[4];
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) { missing++; problems.push(`MISSING ${rel}`); continue; }
  const buf = readFileSync(abs);
  const size = statSync(abs).size;
  const hash = createHash('sha256').update(buf).digest('hex').toUpperCase();
  if (size !== expSize) { sizeBad++; problems.push(`SIZE ${rel} exp=${expSize} got=${size}`); continue; }
  if (hash !== expHash) { hashBad++; problems.push(`HASH ${rel} exp=${expHash} got=${hash}`); continue; }
  ok++;
}
console.log(`ENTRIES=${total}`);
console.log(`OK=${ok}`);
console.log(`MISSING=${missing}`);
console.log(`SIZE_MISMATCH=${sizeBad}`);
console.log(`HASH_MISMATCH=${hashBad}`);
console.log(`STALE_TOTAL=${stale}`);
for (const p of problems.slice(0, 50)) console.log('PROBLEM ' + p);
const pass = total > 0 && ok === total && stale === 0;
console.log(pass ? 'ARCHIVE_INDEX_VERDICT: PASS' : 'ARCHIVE_INDEX_VERDICT: FAIL');
process.exit(pass ? 0 : 1);
