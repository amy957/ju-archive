/**
 * Track B · 离线授权码校验（ECDSA P-256 / SHA-256 / WebCrypto）
 *
 * 授权码格式：`payloadBase64.signatureBase64`
 *   - payloadBase64   = `{"userId","plan","expire","iat"}` 的 UTF-8 JSON 的 Base64；
 *   - signatureBase64 = 64 字节 IEEE P1363（r||s）签名的 Base64；
 *   - 公钥来自 `core/license-keys.ts`（SPKI DER Base64），私钥只在签发端持有。
 *
 * 校验两件事：签名真实、`expire` 未过期（按到期日当天 UTC 末刻仍有效）。
 */
import { LICENSE_PUBLIC_KEY_SPKI_B64 } from './license-keys';

export const LICENSE_STORAGE_KEY = 'juju.license.v1';

/* 批次 DE · 未使用导出复核：LicensePayload / decodeLicensePayload / isLicenseExpired /
   readStoredLicense / clearStoredLicense 均只在本文件内部被调用，降级为模块内私有（不改行为）。
   对外契约仅保留 LICENSE_STORAGE_KEY / verifyLicense / restoreLicense（main.ts 装配面）。 */
interface LicensePayload {
  userId: string;
  plan: string;
  expire: string;
  iat?: number;
  [key: string]: unknown;
}

function base64ToBytes(input: string): Uint8Array {
  const normalized = String(input || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s+/g, '');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function decodeLicensePayload(licenseKey: string): LicensePayload | null {
  try {
    const raw = String(licenseKey || '').trim();
    const dot = raw.indexOf('.');
    if (dot <= 0 || dot >= raw.length - 1) return null;
    if (raw.indexOf('.', dot + 1) !== -1) return null;
    const json = new TextDecoder().decode(base64ToBytes(raw.slice(0, dot)));
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.plan !== 'string' || typeof parsed.expire !== 'string') return null;
    return parsed as LicensePayload;
  } catch (e) {
    return null;
  }
}

function isLicenseExpired(expire: string): boolean {
  const text = String(expire || '').trim();
  if (!text) return true;
  const stamp = Date.parse(text.length === 10 ? text + 'T23:59:59.999Z' : text);
  if (!Number.isFinite(stamp)) return true;
  return Date.now() > stamp;
}

export async function verifyLicense(licenseKey: string): Promise<boolean> {
  try {
    const raw = String(licenseKey || '').trim();
    const dot = raw.indexOf('.');
    if (dot <= 0 || dot >= raw.length - 1) return false;
    const payloadBytes = base64ToBytes(raw.slice(0, dot));
    const signatureBytes = base64ToBytes(raw.slice(dot + 1));
    if (signatureBytes.length !== 64) return false;
    const payload = decodeLicensePayload(raw);
    if (!payload || isLicenseExpired(payload.expire)) return false;
    const subtle = typeof window !== 'undefined' && window.crypto ? window.crypto.subtle : null;
    if (!subtle) return false;
    const publicKey = await subtle.importKey(
      'spki',
      toArrayBuffer(base64ToBytes(LICENSE_PUBLIC_KEY_SPKI_B64)),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicKey,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(payloadBytes),
    );
  } catch (e) {
    return false;
  }
}

function readStoredLicense(): string | null {
  try {
    return localStorage.getItem(LICENSE_STORAGE_KEY);
  } catch (e) {
    console.warn('[JU] license storage read failed', e);
    return null;
  }
}

function clearStoredLicense(): void {
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch (e) {
    console.warn('[JU] license storage clear failed', e);
  }
}

export async function restoreLicense(): Promise<boolean> {
  const key = readStoredLicense();
  if (!key) return false;
  const ok = await verifyLicense(key);
  if (!ok) clearStoredLicense();
  return ok;
}
