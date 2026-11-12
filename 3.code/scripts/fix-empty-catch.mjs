#!/usr/bin/env node
/**
 * M1-1b · 空 catch 统一化（错误处理统一）
 *
 * 扫描 src/ 下全部 .ts 文件，把「空语句块」的 catch 分支改为带告警的非空实现：
 *   catch(e){}          →  catch(e){console.warn('[JU] caught error',e);}
 *   catch(_){}          →  catch(_){console.warn('[JU] caught error',_);}
 *   catch(e){   }       →  catch(e){console.warn('[JU] caught error',e);}
 *   catch{}             →  catch(e){console.warn('[JU] caught error',e);}
 *
 * 安全性：先对源码做「注释 / 字符串 / 模板串」遮罩，再在遮罩文本上定位空 catch，
 * 因此注释里出现的 `catch(e){}` 文本、以及字符串字面量中的同类片段不会被误改。
 * 幂等：改写后的 catch 体非空，重复执行不会二次改写。
 *
 * 用法：node scripts/fix-empty-catch.mjs [--dry] [--root <dir>]
 * 退出码：0 = 扫描并写入成功（含「无需修改」） / 1 = 参数或 IO 错误
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const rootArg = argv.indexOf('--root');
const ROOT = rootArg >= 0 && argv[rootArg + 1] ? path.resolve(argv[rootArg + 1]) : path.resolve(HERE, '..', 'src');

const WARN_PREFIX = '[JU] caught error';

/** 递归收集 .ts 文件（跳过 .d.ts 之外的目录不存在时直接报错） */
function collect(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) collect(full, acc);
    else if (name.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

/**
 * 把注释 / 字符串 / 模板串内容替换为等长空格，返回与原文等长的遮罩串。
 * 仅用于定位（不改写），保证索引与原文件一一对应。
 */
function mask(src) {
  const out = src.split('');
  const n = src.length;
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) {
      if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
    }
  };
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      let j = i;
      while (j < n && src[j] !== '\n') j += 1;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && c2 === '*') {
      const end = src.indexOf('*/', i + 2);
      const j = end < 0 ? n : end + 2;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') {
          j += 2;
          continue;
        }
        if (src[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      /* 保留引号本身，其余内容抹平（引号不参与 catch 语法匹配） */
      blank(i + 1, Math.min(j - 1, n));
      i = j;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

/** 空 catch 定位：catch [ ( ident? ) ] { whitespace-only } */
const RE_EMPTY_CATCH = /catch\s*(?:\(\s*([A-Za-z_$][\w$]*)?\s*\))?\s*\{\s*\}/g;

function fixText(src) {
  const masked = mask(src);
  const edits = [];
  let m;
  RE_EMPTY_CATCH.lastIndex = 0;
  while ((m = RE_EMPTY_CATCH.exec(masked))) {
    /* 命中区间必须完全处于未遮罩区（注释 / 字符串 / 模板串内不处理）：
       遮罩串与原文在该区间逐字相等 ⇒ 区间内没有注释或字符串内容。 */
    const seg = masked.slice(m.index, m.index + m[0].length);
    if (src.slice(m.index, m.index + m[0].length) !== seg) continue;
    const varName = m[1] || 'e';
    edits.push({ start: m.index, end: m.index + m[0].length, text: `catch(${varName}){console.warn('${WARN_PREFIX}',${varName});}` });
  }
  if (!edits.length) return { text: src, count: 0 };
  let out = '';
  let cursor = 0;
  for (const e of edits) {
    out += src.slice(cursor, e.start) + e.text;
    cursor = e.end;
  }
  out += src.slice(cursor);
  return { text: out, count: edits.length };
}

let files;
try {
  files = collect(ROOT);
} catch (err) {
  console.error(`SCAN FAIL  ${err.message}`);
  process.exit(1);
}

let total = 0;
const touched = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const { text, count } = fixText(src);
  if (count > 0) {
    total += count;
    touched.push({ file: path.relative(ROOT, file), count });
    if (!DRY) writeFileSync(file, text, 'utf8');
  }
}

for (const t of touched) console.log(`  ${DRY ? '[dry] ' : ''}${t.file}  empty-catch=${t.count}`);
console.log(`EMPTY-CATCH ${DRY ? 'DRY-RUN' : 'FIXED'}  files=${files.length}  touched=${touched.length}  total=${total}  root=${ROOT}`);
process.exit(0);
