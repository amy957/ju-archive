#!/usr/bin/env node
/* src 源码聚合指纹：src/** + src-tauri/src/**.rs + src-tauri/Cargo.toml，按相对路径排序后拼接取 SHA-256；
   --check 只比对归档 src-fingerprint.json 不写文件。落位在归档目录（dist 只允许 index.html，不得写入 dist） */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJECT, RELEASE_DIR } from './release-paths.mjs';
const ROOTS = [[path.join(PROJECT, 'src'), false], [path.join(PROJECT, 'src-tauri', 'src'), true]];
const EXTRA = [path.join(PROJECT, 'src-tauri', 'Cargo.toml')];
const OUT = path.join(RELEASE_DIR, 'src-fingerprint.json');
function walk(abs, onlyRs, out) {
  if (!existsSync(abs)) return;
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(abs, e.name);
    if (e.isDirectory()) walk(p, onlyRs, out);
    else if (e.isFile() && (!onlyRs || p.endsWith('.rs'))) out.push(p);
  }
}
/* 行尾归一（跨机可复现）：工作区字节受 core.autocrlf / .gitattributes 影响，
   同一提交在 LF 与 CRLF 机器上内容字节不同；不做归一化则指纹随环境漂移，
   干净检出（CI）永远对不上归档记录。归一化只在聚合时进行，不回写源文件。 */
function normEol(buf) {
  if (buf.indexOf(13) < 0) return buf;
  const out = Buffer.allocUnsafe(buf.length);
  let n = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10) continue;
    out[n++] = buf[i];
  }
  return out.subarray(0, n);
}
/* 聚合必须对文件排序后拼接，不得依赖目录遍历顺序 */
export function srcFingerprint() {
  const files = EXTRA.filter((p) => existsSync(p));
  for (const [d, onlyRs] of ROOTS) walk(d, onlyRs, files);
  const rels = files.map((p) => path.relative(PROJECT, p).split(path.sep).join('/')).sort();
  const h = createHash('sha256');
  for (const r of rels) h.update(r + '\0').update(normEol(readFileSync(path.join(PROJECT, r))));
  return { files: rels.length, sha256: h.digest('hex') };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const fp = srcFingerprint();
  const text = JSON.stringify(fp, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8').trim() : '';
    if (prev !== text.trim()) { console.error('[fingerprint] ✗ 指纹不一致或缺失 ' + path.relative(PROJECT, OUT)); process.exit(1); }
    console.log('[fingerprint] ✓ 指纹一致 ' + fp.sha256 + ' files=' + fp.files);
  } else {
    mkdirSync(RELEASE_DIR, { recursive: true });
    writeFileSync(OUT, text);
    process.stdout.write(text);
  }
}
