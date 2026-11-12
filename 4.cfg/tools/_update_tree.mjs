import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'E:\\APP\\归档';
const SKIP = new Set(['.git', '1.2归档快照', '1.3封存', '99.开发辅助工具', '归档结构.txt']);
const MAX = 4;
const out = ['归档（root）/'];
const walk = (dir, prefix, depth) => {
  if (depth > MAX) return;
  const items = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => !SKIP.has(d.name))
    .sort((a, b) => (Number(b.isDirectory()) - Number(a.isDirectory())) || a.name.localeCompare(b.name, 'zh-CN'));
  items.forEach((d, i) => {
    const last = i === items.length - 1;
    out.push(prefix + (last ? '└── ' : '├── ') + d.name + (d.isDirectory() ? '/' : ''));
    if (d.isDirectory()) walk(path.join(dir, d.name), prefix + (last ? '    ' : '│   '), depth + 1);
  });
};
walk(ROOT, '', 1);
fs.writeFileSync(path.join(ROOT, '归档结构.txt'), out.join('\r\n') + '\r\n', 'utf8');
console.log('ARCH-TREE lines=' + out.length + ' depth=' + MAX);
