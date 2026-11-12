/**
 * L9-W1 · 加解密层（derive/load key · encrypt-on-write / decrypt-on-read）
 * ----------------------------------------------------------------------------
 * 设计依据：`reports/t9-design-2026-10-14.md` §7.1（M-C 加密增量链：逐条加密 / 密文纯净）
 *          + 产品契约（v2.0-t3）：encryptState / decryptState 载荷形状
 *            { v:1, salt, iv, cipher, iter, updatedAt }（AES-GCM 256 / PBKDF2-SHA256）
 *
 * 契约同源（S-1）：载荷字段名与产品一致，不得为「好测」改形状。
 * 安全不变量（设计 §10.1 M-C / R3）：持久层内**无明文**——encrypt-on-write 后
 *   `containsPlaintext(batch, ...) === false`（结构性断言）。
 *
 * 性质：**影子层（shadow / 默认关闭）**；不接线产品路径、不接线导出/导入（LO-2）。
 */
import { webcrypto as _nodeWebCrypto } from 'node:crypto';

const _crypto = (globalThis.crypto && globalThis.crypto.subtle) ? globalThis.crypto : _nodeWebCrypto;
const _subtle = _crypto.subtle;

/** PBKDF2 迭代数（与产品 ENC_ITER 同量级；拟定值，LO-5 标定前） */
export const ENC_ITER = 60000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

const _b64 = (u8) => Buffer.from(u8).toString('base64');
const _unb64 = (s) => new Uint8Array(Buffer.from(String(s), 'base64'));

/** 新随机盐（16B） */
export function newSalt() { return _crypto.getRandomValues(new Uint8Array(SALT_BYTES)); }

/** 派生 AES-GCM-256 密钥（PBKDF2-SHA256） */
export async function deriveKey(password, salt, iter = ENC_ITER) {
  const base = await _subtle.importKey(
    'raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveKey'],
  );
  return _subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

/** encrypt-on-write（全量）：state → 载荷（形状与产品同源） */
export async function encryptState(data, password, salt) {
  const s = salt instanceof Uint8Array ? salt : newSalt();
  const iv = _crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, s);
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await _subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return { v: 1, salt: _b64(s), iv: _b64(iv), cipher: _b64(cipher), iter: ENC_ITER, updatedAt: Date.now() };
}

/** decrypt-on-read（全量）：载荷 → state */
export async function decryptState(payload, password) {
  const salt = _unb64(payload.salt);
  const iv = _unb64(payload.iv);
  const key = await deriveKey(password, salt, payload.iter || ENC_ITER);
  const plain = await _subtle.decrypt({ name: 'AES-GCM', iv }, key, _unb64(payload.cipher));
  return JSON.parse(new TextDecoder().decode(plain));
}

/**
 * encrypt-on-write（逐条加密 · 设计 §7.1 选项 1）：
 * 每条 `changed[].data` 单独 AES-GCM 加密（各自 IV），批级共享盐（批元携带 salt/iter）。
 * 保证批内**无明文**。
 */
export async function encryptBatch(batch, password, salt) {
  const s = salt instanceof Uint8Array ? salt : newSalt();
  const key = await deriveKey(password, s);
  const changed = [];
  for (const it of batch.changed || []) {
    const iv = _crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const cipher = await _subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(it.data)));
    changed.push({ id: it.id, data: JSON.stringify({ v: 1, iv: _b64(iv), cipher: _b64(cipher) }) });
  }
  return {
    changed,
    deleted: (batch.deleted || []).slice(),
    enc: true,
    salt: _b64(s),
    iter: ENC_ITER,
    seq: batch.seq,
    baseRev: batch.baseRev,
  };
}

/** decrypt-on-read（逐条）：加密批 → 明文批（data 还原为原 JSON 串） */
export async function decryptBatch(encBatch, password) {
  const key = await deriveKey(password, _unb64(encBatch.salt), encBatch.iter || ENC_ITER);
  const changed = [];
  for (const it of encBatch.changed || []) {
    const o = JSON.parse(it.data);
    const plain = await _subtle.decrypt({ name: 'AES-GCM', iv: _unb64(o.iv) }, key, _unb64(o.cipher));
    changed.push({ id: it.id, data: new TextDecoder().decode(plain) });
  }
  return { changed, deleted: (encBatch.deleted || []).slice(), seq: encBatch.seq, baseRev: encBatch.baseRev };
}

/** 明文泄漏检测（结构性断言）：批内任一 data 含 needle 即 true */
export function containsPlaintext(batch, needle) {
  const n = String(needle);
  for (const it of (batch && batch.changed) || []) {
    if (String(it && it.data).includes(n)) return true;
  }
  return false;
}

/**
 * KeyStore：密钥派生 / 加载生命周期（加密模式解锁 → 复用盐与已派生 key）。
 * 与产品 _getOrCreateSalt/deriveKey 的缓存语义对齐（encrypt-on-write 不重跑 PBKDF2）。
 */
export class KeyStore {
  constructor() { this._key = null; this._salt = null; this._pwd = null; }
  get locked() { return !this._key; }
  get salt() { return this._salt; }
  /** 解锁：显式盐优先；否则同密码复用已缓存盐；否则新建盐。返回 CryptoKey。 */
  async unlock(password, salt) {
    const s = salt instanceof Uint8Array
      ? salt
      : (this._salt && this._pwd === password ? this._salt : newSalt());
    this._key = await deriveKey(password, s);
    this._salt = s;
    this._pwd = password;
    return this._key;
  }
  lock() { this._key = null; return this; }
}
