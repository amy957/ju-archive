#!/usr/bin/env node
/**
 * ISSUE-002 · 授权码密钥轮换验证（只读探针）
 *
 * 校验：
 *   1) 归档内公钥（m07-vite/src/core/license-keys.ts）能验证示例授权码签名；
 *   2) 示例授权码未过期；
 *   3) 已退役私钥（仓库外密钥库 retired/）派生出的公钥**无法**验证同一授权码
 *      （证明轮换生效、旧密钥已失效）。
 *
 * 用法：node _临时脚本/verify-license-rotation.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const M07 = path.join(ROOT, '6.P0-T3基线', 'm07-vite');
const PUB_TS = path.join(M07, 'src', 'core', 'license-keys.ts');
const LICENSE = path.join(M07, 'scripts', 'licenses', 'test-pro-2030-12-31.license');
const RETIRED = 'C:\\Users\\12601\\.ju-license-issuer\\retired\\license-private-retired-2026-10-29.pem';

function b64urlToBuf(b64) {
  return Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function readPublicKey() {
  const text = fs.readFileSync(PUB_TS, 'utf8');
  const m = /LICENSE_PUBLIC_KEY_SPKI_B64\s*=\s*'([^']+)'/.exec(text);
  if (!m) throw new Error('license-keys.ts 中未找到 LICENSE_PUBLIC_KEY_SPKI_B64');
  return m[1];
}

async function verifyWith(spkiB64, payloadBuf, sigBuf) {
  const key = await crypto.webcrypto.subtle.importKey(
    'spki',
    Buffer.from(spkiB64, 'base64'),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  return crypto.webcrypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    sigBuf,
    payloadBuf,
  );
}

function spkiFromPrivate(pemPath) {
  const pem = fs.readFileSync(pemPath, 'utf8');
  const priv = crypto.createPrivateKey({ key: pem, format: 'pem' });
  return crypto.createPublicKey(priv).export({ type: 'spki', format: 'der' }).toString('base64');
}

const activePub = readPublicKey();
const raw = fs.readFileSync(LICENSE, 'utf8').trim();
const dot = raw.indexOf('.');
if (dot <= 0) throw new Error('示例授权码缺少 payload.signature 分隔符');

const payloadBuf = b64urlToBuf(raw.slice(0, dot));
const sigBuf = b64urlToBuf(raw.slice(dot + 1));
const payload = JSON.parse(payloadBuf.toString('utf8'));

const activeOk = await verifyWith(activePub, payloadBuf, sigBuf);
const expireOk = Date.parse(payload.expire + 'T23:59:59Z') > Date.now();

let retiredOk = null;
let retiredNote = 'retired key not found (skipped)';
if (fs.existsSync(RETIRED)) {
  retiredOk = await verifyWith(spkiFromPrivate(RETIRED), payloadBuf, sigBuf);
  retiredNote = retiredOk ? 'RETIRED KEY STILL VALID' : 'retired key rejected (expected)';
}

console.log('ACTIVE_PUBKEY_SPKI_B64=' + activePub);
console.log('LICENSE_PAYLOAD=' + JSON.stringify(payload));
console.log('ACTIVE_SIGNATURE_OK=' + activeOk);
console.log('LICENSE_NOT_EXPIRED=' + expireOk);
console.log('RETIRED_KEY_SIGNATURE_OK=' + retiredOk + '  (' + retiredNote + ')');
const pass = activeOk === true && expireOk === true && retiredOk === false;
console.log(pass ? 'RESULT=PASS' : 'RESULT=FAIL');
process.exit(pass ? 0 : 1);
