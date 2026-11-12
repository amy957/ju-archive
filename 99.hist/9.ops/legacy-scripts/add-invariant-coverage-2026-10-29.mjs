import { readFileSync, writeFileSync } from 'node:fs';

const FILE = '4.回归与验收/JU-不变量清单-v2.0-frozen.md';
const MARK = '**覆盖用例 id**';
const MARK_RE = /^\*\*覆盖用例 id\*\*[：:]/;
/* 仅登记已由真实 spec / 用例标题核对过的映射；其余留空由门禁输出「未覆盖」。 */
const MAP = {
  14: 'T-27, T-28, T-29',
  15: 'T-27, T-28, T-29',
  23: 'T-30, T-31, T-32, T-33, T-34',
  27: 'T-66, T-67, T-68',
  29: 'T-99',
  30: 'T-104',
  32: 'T-110',
  33: 'T-115, T-116',
  35: 'T-117, T-118, T-119, T-120, T-121, T-122, T-123',
  76: 'tests/t3-ultrawide-layout.spec.ts · 3440x1440 / 3840x1080',
};

const src = readFileSync(FILE, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
/* 幂等：先剥离既有覆盖列，再按统一口径重建 */
const base = src.split(/\r?\n/).filter((ln) => !MARK_RE.test(ln));
const heads = [];
base.forEach((ln, i) => { if (/^#{1,3}\s/.test(ln)) heads.push(i); });

const out = [];
let cursor = 0;
let sections = 0;
for (let h = 0; h < heads.length; h++) {
  const at = heads[h];
  const next = h + 1 < heads.length ? heads[h + 1] : base.length;
  out.push(...base.slice(cursor, at));
  cursor = at;
  const m = /^###\s+(\d+)\.\s+/.exec(base[at]);
  if (!m) continue;
  const id = Number(m[1]);
  sections++;
  let last = next - 1;
  while (last > at && (base[last].trim() === '' || base[last].trim() === '---')) last--;
  out.push(...base.slice(at, last + 1));
  out.push(`${MARK}：${MAP[id] || ''}`);
  cursor = last + 1;
}
out.push(...base.slice(cursor));

const text = out.join(eol);
writeFileSync(FILE, text, 'utf8');
console.log(JSON.stringify({
  sections,
  markers: (text.match(/\*\*覆盖用例 id\*\*/g) || []).length,
  mapped: Object.keys(MAP).length,
  bytes: Buffer.byteLength(text),
}, null, 2));
