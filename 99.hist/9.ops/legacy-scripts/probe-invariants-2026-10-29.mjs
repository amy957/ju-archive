import { readFileSync } from 'node:fs';

const FILE = '4.回归与验收/JU-不变量清单-v2.0-frozen.md';
const txt = readFileSync(FILE, 'utf8');
const lines = txt.split(/\r?\n/);

const heads = [];
lines.forEach((ln, i) => {
  if (/^###\s+/.test(ln)) heads.push({ n: i + 1, text: ln.trim() });
});
console.log('### count =', heads.length);
console.log('first 5 heads:', JSON.stringify(heads.slice(0, 5), null, 1));

const counts = {};
for (const key of ['**验证方式**', '**定义**', '**断言**', '**关联实现**', '覆盖用例']) {
  counts[key] = (txt.match(new RegExp(key.replace(/[*]/g, '\\*'), 'g')) || []).length;
}
console.log('markers =', JSON.stringify(counts));

const tables = lines.map((ln, i) => ({ n: i + 1, ln })).filter((o) => /^\|/.test(o.ln));
console.log('table lines =', tables.length);
console.log('table sample:', JSON.stringify(tables.slice(0, 30), null, 1));

console.log('--- tail 40 lines ---');
console.log(lines.slice(-40).map((l, i) => (lines.length - 40 + i + 1) + '| ' + l).join('\n'));

console.log('--- sample section 1 ---');
console.log(lines.slice(19, 42).map((l, i) => (20 + i) + '| ' + l).join('\n'));
