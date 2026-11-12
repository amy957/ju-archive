#!/usr/bin/env node
/**
 * M0-7 · 只读副本字节一致性闸门
 *
 * 比对：public/v2.0-t3.html（构建期只读副本）与 ../v2.0-t3.html（canonical，本批次零字节改动）
 * 判定：SHA-256 与字节数双向相等 ⇒ exit 0 / 任一不等 ⇒ exit 1
 * 用法：node scripts/check-parity.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COPY = path.resolve(HERE, '..', 'public', 'v2.0-t3.html');
const CANON = path.resolve(HERE, '..', 'canonical', 'v2.0-t3.html');

function digest(file) {
  const buf = readFileSync(file);
  return { bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
}

let a;
let b;
try {
  a = digest(COPY);
  b = digest(CANON);
} catch (err) {
  console.error('PARITY FAIL  read error: ' + err.message);
  process.exit(1);
}

if (a.sha256 !== b.sha256 || a.bytes !== b.bytes) {
  console.error('PARITY FAIL');
  console.error('  copy  : sha256=' + a.sha256 + '  bytes=' + a.bytes + '  ' + COPY);
  console.error('  canon : sha256=' + b.sha256 + '  bytes=' + b.bytes + '  ' + CANON);
  process.exit(1);
}

/* ISSUE-012 · 版本号同源：main.ts 注入值与 errors.ts 默认桩必须一致（空串表示由调用方提供），
   非空值必须等于 package.json.version */
const MAIN_TS = path.resolve(HERE, '..', 'src', 'main.ts');
const ERRORS_TS = path.resolve(HERE, '..', 'src', 'core', 'errors.ts');
const PKG_JSON = path.resolve(HERE, '..', 'package.json');

/** 读取文件中 `JU_VER: '<值>'` 的字面量；缺省返回 null */
function pickVer(file) {
  const hit = readFileSync(file, 'utf8').match(/JU_VER:\s*'([^']*)'/);
  return hit ? hit[1] : null;
}

let pkgVer = '';
let mainVer = null;
let errVer = null;
try {
  pkgVer = String(JSON.parse(readFileSync(PKG_JSON, 'utf8')).version || '');
  mainVer = pickVer(MAIN_TS);
  errVer = pickVer(ERRORS_TS);
} catch (err) {
  console.error('VERSION FAIL  read error: ' + err.message);
  process.exit(1);
}

/* ISSUE-013 · 打包清单版本同源：Cargo.toml / tauri.conf.json 的 version 必须等于 package.json */
const CARGO_TOML = path.resolve(HERE, '..', 'src-tauri', 'Cargo.toml');
const TAURI_CONF = path.resolve(HERE, '..', 'src-tauri', 'tauri.conf.json');
const cargoVer = (readFileSync(CARGO_TOML, 'utf8').match(/^version\s*=\s*"([^"]+)"/m) || [])[1] || '';
const tauriVer = String((JSON.parse(readFileSync(TAURI_CONF, 'utf8')).package || {}).version || '');

const mainOk = mainVer !== null && mainVer !== '' && mainVer === pkgVer;
const errOk = errVer !== null && (errVer === '' || errVer === mainVer);
const pkgOk = cargoVer === pkgVer && tauriVer === pkgVer;
if (!mainOk || !errOk || !pkgOk) {
  console.error('VERSION FAIL  main.ts JU_VER=' + (mainVer === null ? '(not found)' : mainVer)
    + '  errors.ts JU_VER=' + (errVer === null ? '(not found)' : JSON.stringify(errVer))
    + '  package.json.version=' + pkgVer + '  Cargo.toml=' + cargoVer + '  tauri.conf.json=' + tauriVer);
  process.exit(1);
}

console.log('PARITY OK  sha256=' + a.sha256 + '  bytes=' + a.bytes);
console.log('VERSION OK  main.ts JU_VER=' + mainVer + "  errors.ts JU_VER='" + errVer
  + "'  package.json.version=" + pkgVer + '  Cargo.toml=' + cargoVer + '  tauri.conf.json=' + tauriVer);
process.exit(0);
