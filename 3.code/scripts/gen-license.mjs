/**
 * Track B · 离线授权码签发器（ECDSA P-256 / SHA-256）
 *
 * 用法：
 *   node scripts/gen-license.mjs --user test --plan pro --expire 2030-12-31
 *   node scripts/gen-license.mjs --user alice --plan pro --expire 2027-06-30 --out licenses/alice.license
 *
 * 行为：
 *   1) 首次运行生成 EC prime256v1 密钥对：私钥写 JU_LICENSE_KEY_FILE 指定的**仓库外**签发库
 *      （默认 scripts/keys/license-private.pem 仅供早期兼容；该路径位于归档内，脚本会直接拒绝，
 *      防止私钥再次落入归档），公钥（SPKI / Base64）写 src/core/license-keys.ts（供浏览器 import）；
 *   2) 把 { userId, plan, expire, iat } 序列化为 JSON 并用私钥签名；
 *   3) 输出 `payloadBase64.signatureBase64`（签名为 WebCrypto 要求的 IEEE P1363 原始 r||s）；
 *   4) 授权码写 scripts/licenses/<user>-<plan>-<expire>.license，同时打印到 stdout。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const KEY_DIR = path.join(HERE, 'keys');
const LICENSE_DIR = path.join(HERE, 'licenses');
const PRIVATE_KEY_PATH = process.env.JU_LICENSE_KEY_FILE || path.join(KEY_DIR, 'license-private.pem');
/* ISSUE-002：私钥只允许存放在签发环境 / 密钥库（仓库外）；仓库内路径一律拒绝。 */
const KEY_STORE_HINT = 'C:\\Users\\<你>\\.ju-license-issuer\\license-private.pem';
const PUBLIC_TS_PATH = path.join(PROJECT_ROOT, 'src', 'core', 'license-keys.ts');
const CURVE = 'prime256v1';
const COORD_BYTES = 32;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = 'true';
    }
  }
  return out;
}

function fail(message) {
  console.error('[gen-license] ' + message);
  process.exit(1);
}

function writePublicModule(publicKey) {
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const content =
    "/**\n" +
    " * 离线授权码验签公钥（ECDSA P-256 / SPKI DER / Base64）。\n" +
    " * 由 scripts/gen-license.mjs 生成；私钥仅保存在签发环境，禁止随产品分发。\n" +
    " */\n" +
    "export const LICENSE_PUBLIC_KEY_SPKI_B64 = '" + spki + "';\n";
  fs.mkdirSync(path.dirname(PUBLIC_TS_PATH), { recursive: true });
  fs.writeFileSync(PUBLIC_TS_PATH, content, 'utf8');
  console.error('[gen-license] public key -> ' + path.relative(PROJECT_ROOT, PUBLIC_TS_PATH));
}

function assertKeyOutsideRepo() {
  const rel = path.relative(PROJECT_ROOT, PRIVATE_KEY_PATH);
  const insideRepo = rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  if (insideRepo) {
    fail(
      '私钥路径位于归档仓库内（' + rel + '），拒绝使用。' +
      '请以 JU_LICENSE_KEY_FILE 指向仓库外的签发密钥（示例：' + KEY_STORE_HINT + '）。',
    );
  }
}

function loadOrCreateKeys() {
  assertKeyOutsideRepo();
  fs.mkdirSync(KEY_DIR, { recursive: true });
  if (fs.existsSync(PRIVATE_KEY_PATH)) {
    const pem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const privateKey = crypto.createPrivateKey({ key: pem, format: 'pem' });
    const publicKey = crypto.createPublicKey(privateKey);
    if (!fs.existsSync(PUBLIC_TS_PATH)) writePublicModule(publicKey);
    console.error('[gen-license] private key <- ' + PRIVATE_KEY_PATH);
    return { privateKey, publicKey };
  }
  const pair = crypto.generateKeyPairSync('ec', { namedCurve: CURVE });
  fs.writeFileSync(PRIVATE_KEY_PATH, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), 'utf8');
  writePublicModule(pair.publicKey);
  console.error('[gen-license] generated EC P-256 key pair, private key -> ' + PRIVATE_KEY_PATH);
  return { privateKey: pair.privateKey, publicKey: pair.publicKey };
}

function derToP1363(der, size) {
  const buf = Buffer.from(der);
  let off = 0;
  if (buf[off++] !== 0x30) throw new Error('DER: expected SEQUENCE');
  let seqLen = buf[off++];
  if (seqLen & 0x80) {
    const n = seqLen & 0x7f;
    seqLen = 0;
    for (let i = 0; i < n; i++) seqLen = (seqLen << 8) | buf[off++];
  }
  const seqEnd = off + seqLen;
  const readInt = () => {
    if (buf[off++] !== 0x02) throw new Error('DER: expected INTEGER');
    let len = buf[off++];
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let i = 0; i < n; i++) len = (len << 8) | buf[off++];
    }
    let value = buf.subarray(off, off + len);
    off += len;
    while (value.length > size && value[0] === 0) value = value.subarray(1);
    if (value.length > size) throw new Error('DER: coordinate too large');
    return value;
  };
  const r = readInt();
  const s = readInt();
  if (off !== seqEnd) throw new Error('DER: trailing bytes');
  const out = Buffer.alloc(size * 2);
  r.copy(out, size - r.length);
  s.copy(out, size * 2 - s.length);
  return out;
}

async function selfVerify(publicKey, data, signature) {
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  const key = await crypto.webcrypto.subtle.importKey(
    'spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
  );
  return crypto.webcrypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } }, key, signature, data,
  );
}

const args = parseArgs(process.argv.slice(2));
for (const required of ['user', 'plan', 'expire']) {
  if (!args[required]) fail('缺少参数 --' + required + '（示例：--user test --plan pro --expire 2030-12-31）');
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(args.expire)) fail('--expire 必须为 YYYY-MM-DD');
if (Number.isNaN(Date.parse(args.expire + 'T00:00:00Z'))) fail('--expire 不是有效日期');

const { privateKey, publicKey } = loadOrCreateKeys();

const payload = {
  userId: String(args.user),
  plan: String(args.plan),
  expire: String(args.expire),
  iat: Math.floor(Date.now() / 1000),
};
const payloadJson = JSON.stringify(payload);
const data = Buffer.from(payloadJson, 'utf8');

const derSignature = crypto.sign('sha256', data, privateKey);
const rawSignature = derToP1363(derSignature, COORD_BYTES);

if (!(await selfVerify(publicKey, data, rawSignature))) {
  fail('自校验失败：生成的 P1363 签名无法被公钥验证');
}

const licenseKey =
  Buffer.from(payloadJson, 'utf8').toString('base64') + '.' + rawSignature.toString('base64');

fs.mkdirSync(LICENSE_DIR, { recursive: true });
const outFile = args.out
  ? path.resolve(PROJECT_ROOT, args.out)
  : path.join(LICENSE_DIR, args.user + '-' + args.plan + '-' + args.expire + '.license');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, licenseKey + '\n', 'utf8');

console.error('[gen-license] license -> ' + path.relative(PROJECT_ROOT, outFile));
console.error('[gen-license] payload=' + payloadJson);
console.log(licenseKey);
