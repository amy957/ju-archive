#!/usr/bin/env node
/**
 * Track B · 商业授权 Mock 服务（本地 HTTP · 端口 8081）
 *
 * 职责：
 *   1) POST /api/checkout        —— 接收 { userId, plan } → 生成含过期时间的 payload →
 *                                  用 scripts/keys/license-private.pem 私钥签名 → 返回授权码；
 *   2) GET  /api/latest.json     —— 返回 Tauri v1 自动更新所需的静态清单 JSON；
 *   3) GET  /api/health          —— 探活（返回服务端就绪状态与公钥指纹）；
 *   4) GET  /downloads/<file>    —— 从 8.发布与CI/release/<版本>/ 提供归档下载（Mock 闭环用）；
 *   5) POST /api/sync/push       —— M0-15 云端同步上行：整库快照存入进程内 cloudState；
 *   6) GET  /api/sync/pull       —— M0-15 云端同步下行：返回当前 cloudState（未推送时为 null）。
 *
 * 同步态为**进程内存变量**（不是磁盘）：服务重启即清空，符合 Mock 闭环边界；
 * 真正商业化时由账号态对象存储替换，前端契约（{ state } 收发）保持不变。
 *
 * 授权码格式与产品端 core/license.ts 严格一致：
 *   `payloadBase64.signatureBase64`
 *   - payload   = {"userId","plan","expire","iat"} 的 UTF-8 JSON；
 *   - signature = 64 字节 IEEE P1363（r||s）ECDSA P-256 / SHA-256 签名。
 *   签名在返回前用公钥自校验一次，失败即 500，绝不返回不可验的授权码。
 *
 * 环境变量：
 *   PORT                 监听端口，默认 8081
 *   JU_LICENSE_KEY_FILE  私钥路径，默认 scripts/keys/license-private.pem
 *   JU_UPDATE_VERSION    /api/latest.json 的版本号，默认 2.1.0
 *   JU_UPDATE_BASE_URL   /api/latest.json 的下载基址，默认 http://localhost:8081/downloads
 *   JU_UPDATER_SIGNATURE Tauri 更新包签名；缺省时填写占位标记并在响应中附带 _mock 说明
 *   JU_LICENSE_PIPE      并行监听的命名管道，默认 \\.\pipe\ju-license-server；设为 off 关闭。
 *                        用于本机回环 TCP 被安全策略拦截时仍可做端到端验收。
 *
 * 用法：node server/license-server.mjs   （或 npm run server:license）
 * 退出码：0 = 正常关闭；1 = 私钥缺失 / 曲线不符 / 监听失败。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* D-05b：归档目录已移出 dist（dist 只允许 index.html），下载源与构建脚本共用同一常量出处 */
import { RELEASE_DIR } from '../scripts/release-paths.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const PRIVATE_KEY_PATH = process.env.JU_LICENSE_KEY_FILE
  || path.join(PROJECT, 'scripts', 'keys', 'license-private.pem');
const PORT = Number(process.env.PORT || 8081);
const DEFAULT_PIPE = process.platform === 'win32'
  ? '\\\\.\\pipe\\ju-license-server'
  : '/tmp/ju-license-server.sock';
const PIPE_PATH = process.env.JU_LICENSE_PIPE === 'off'
  ? ''
  : (process.env.JU_LICENSE_PIPE || DEFAULT_PIPE);
const CURVE = 'P-256';
const COORD_BYTES = 32;
const MAX_BODY_BYTES = 16 * 1024;
/** 同步上行允许的请求体上限（整库快照远大于授权请求体） */
const SYNC_MAX_BODY_BYTES = 32 * 1024 * 1024;

/**
 * M0-15 · 云端同步 Mock 状态。
 * `null` = 尚无任何客户端推送；推送后保存整库快照对象（原样回吐给 pull）。
 */
let cloudState = null;
/** 最近一次推送时刻（毫秒）与来源描述，供 /api/health 观测。 */
let cloudStateAt = 0;

/* plan → 授权时长（天）。未知 plan 回落 365 天，保证 Mock 不被脏输入打断。 */
const PLAN_DURATION_DAYS = {
  trial: 14,
  pro: 365,
  team: 1095,
  lifetime: 36500,
};
const DEFAULT_DURATION_DAYS = 365;

function log(...args) {
  console.log('[license-server]', ...args);
}

function fail(message) {
  console.error('[license-server] ' + message);
  process.exit(1);
}

/* ── 私钥装载（缺失即失败，绝不临时生成，避免公钥与产品端不一致） ── */
function loadPrivateKey() {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    fail('私钥不存在：' + path.relative(PROJECT, PRIVATE_KEY_PATH)
      + '（ISSUE-002：私钥不得存放在归档内。请把签发密钥放入仓库外密钥库，'
      + '并以 JU_LICENSE_KEY_FILE 指向该文件后再启动本服务）');
  }
  const pem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
  const key = crypto.createPrivateKey({ key: pem, format: 'pem' });
  const details = key.asymmetricKeyDetails || {};
  if (details.namedCurve && details.namedCurve !== 'prime256v1') {
    fail('私钥曲线为 ' + details.namedCurve + '，产品端验签要求 prime256v1（P-256）');
  }
  return key;
}

const privateKey = loadPrivateKey();
const publicKey = crypto.createPublicKey(privateKey);
const PUBLIC_SPKI = publicKey.export({ type: 'spki', format: 'der' });
const PUBLIC_SPKI_B64 = PUBLIC_SPKI.toString('base64');
const PUBLIC_FINGERPRINT = crypto.createHash('sha256').update(PUBLIC_SPKI).digest('hex').slice(0, 32);

/* ── DER(SEQUENCE{INTEGER r, INTEGER s}) → IEEE P1363 定长 r||s ── */
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

async function selfVerify(data, signature) {
  const key = await crypto.webcrypto.subtle.importKey(
    'spki', PUBLIC_SPKI, { name: 'ECDSA', namedCurve: CURVE }, false, ['verify'],
  );
  return crypto.webcrypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } }, key, signature, data,
  );
}

function addDays(days) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/* ── 授权码签发：签名后自校验，通过才返回 ── */
async function issueLicense(userId, plan, expire) {
  const payload = {
    userId: String(userId),
    plan: String(plan),
    expire: expire || addDays(PLAN_DURATION_DAYS[plan] || DEFAULT_DURATION_DAYS),
    iat: Math.floor(Date.now() / 1000),
  };
  const payloadJson = JSON.stringify(payload);
  const data = Buffer.from(payloadJson, 'utf8');
  const rawSignature = derToP1363(crypto.sign('sha256', data, privateKey), COORD_BYTES);
  if (!(await selfVerify(data, rawSignature))) {
    throw new Error('签发自校验失败：P1363 签名无法被公钥验证');
  }
  return {
    licenseKey: data.toString('base64') + '.' + rawSignature.toString('base64'),
    payload,
  };
}

/* ── Tauri v1 自动更新清单 ── */
function buildLatestManifest() {
  const version = process.env.JU_UPDATE_VERSION || '2.1.0';
  const baseUrl = (process.env.JU_UPDATE_BASE_URL || `http://localhost:${PORT}/downloads`).replace(/\/+$/, '');
  const signature = process.env.JU_UPDATER_SIGNATURE || 'MOCK_PLACEHOLDER_SIGNATURE';
  return {
    version,
    notes: 'JU v2.1 · 稳定期修复（崩溃通道 + 自动更新通道闭环）',
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature,
        url: `${baseUrl}/JU-v2.1-win-x64.exe`,
      },
    },
    _mock: process.env.JU_UPDATER_SIGNATURE
      ? false
      : 'signature 为占位值；真实发版需由 minisign 私钥对安装包签名后填入',
  };
}

/**
 * 批次 CY · CORS 全量开启（Track B 购买页跨端口请求 /api/checkout）
 *   - `public/pricing.html` 由 Vite / 静态服务器（如 5173）承载，Mock 服务监听 8081，
 *     属跨源请求，必须回 `Access-Control-Allow-Origin: *`；
 *   - 所有 JSON 响应（含 400 / 404 / 405 / 500 错误体）统一带该头，
 *     避免浏览器把失败响应判成 CORS 错误、前端只剩 "Failed to fetch"；
 *   - 预检（OPTIONS）在 handleRequest 中单独回应，方法 / 头白名单与下方一致。
 */
const ALLOWED_ORIGIN = process.env.JU_LICENSE_ALLOW_ORIGIN || 'http://localhost:5173';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '600',
};

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    ...CORS_HEADERS,
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求体超过 ' + limit + ' 字节上限'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleCheckout(req, res) {
  let body;
  try {
    const raw = await readBody(req);
    body = raw ? JSON.parse(raw) : {};
  } catch (e) {
    sendJson(res, 400, { ok: false, error: '无效的 JSON 请求体：' + e.message });
    return;
  }
  const userId = body && typeof body.userId === 'string' ? body.userId.trim() : '';
  const plan = body && typeof body.plan === 'string' ? body.plan.trim().toLowerCase() : '';
  if (!userId) {
    sendJson(res, 400, { ok: false, error: '缺少 userId' });
    return;
  }
  if (!plan) {
    sendJson(res, 400, { ok: false, error: '缺少 plan（可选：' + Object.keys(PLAN_DURATION_DAYS).join(' / ') + '）' });
    return;
  }
  let expire = typeof body.expire === 'string' ? body.expire.trim() : '';
  if (expire && !/^\d{4}-\d{2}-\d{2}$/.test(expire)) {
    sendJson(res, 400, { ok: false, error: 'expire 必须为 YYYY-MM-DD' });
    return;
  }
  try {
    const issued = await issueLicense(userId, plan, expire);
    log('checkout userId=' + userId + ' plan=' + plan + ' expire=' + issued.payload.expire);
    sendJson(res, 200, {
      ok: true,
      license: issued.licenseKey,
      payload: issued.payload,
      publicKey: PUBLIC_SPKI_B64,
    });
  } catch (e) {
    log('签发失败：' + e.message);
    sendJson(res, 500, { ok: false, error: '签发失败：' + e.message });
  }
}

/**
 * M0-15 · 同步上行。
 * 入参兼容两种形态：`{ state: {...} }`（前端契约）与直接整库对象（便于手工 curl）。
 * 只接受带 `nodes` 的对象，其余一律 400，避免把脏载荷写进 cloudState。
 */
async function handleSyncPush(req, res) {
  let body;
  try {
    const raw = await readBody(req, SYNC_MAX_BODY_BYTES);
    body = raw ? JSON.parse(raw) : null;
  } catch (e) {
    sendJson(res, 400, { ok: false, error: '无效的 JSON 请求体：' + e.message });
    return;
  }
  const state = body && body.state !== undefined ? body.state : body;
  if (!state || typeof state !== 'object' || !state.nodes || typeof state.nodes !== 'object') {
    sendJson(res, 400, { ok: false, error: 'state 必须为含 nodes 对象的整库快照' });
    return;
  }
  cloudState = state;
  cloudStateAt = Date.now();
  const nodeCount = Object.keys(state.nodes).length;
  log('sync push nodes=' + nodeCount + ' rootId=' + (state.rootId || '-'));
  sendJson(res, 200, {
    ok: true,
    nodeCount,
    rootId: state.rootId || null,
    savedAt: new Date(cloudStateAt).toISOString(),
  });
}

/** M0-15 · 同步下行：原样返回 cloudState（未推送过时 state 为 null）。 */
function handleSyncPull(res) {
  sendJson(res, 200, {
    ok: true,
    state: cloudState,
    savedAt: cloudStateAt ? new Date(cloudStateAt).toISOString() : null,
  });
}

function serveDownload(req, res, name) {
  const safeName = path.basename(decodeURIComponent(name || ''));
  const abs = path.join(RELEASE_DIR, safeName);
  const inside = path.resolve(abs).startsWith(path.resolve(RELEASE_DIR) + path.sep);
  if (!safeName || !inside || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    sendJson(res, 404, { ok: false, error: '归档不存在：' + safeName + '（请先执行 scripts/prepare-release.mjs）' });
    return;
  }
  const ext = path.extname(safeName).toLowerCase();
  const type = ext === '.exe' ? 'application/octet-stream'
    : ext === '.html' ? 'text/html; charset=utf-8'
      : 'application/octet-stream';
  const stat = fs.statSync(abs);
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  });
  fs.createReadStream(abs).pipe(res);
}

function handleRequest(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (pathname === '/api/checkout' && req.method === 'POST') {
    handleCheckout(req, res);
    return;
  }
  if (pathname === '/api/latest.json' && req.method === 'GET') {
    sendJson(res, 200, buildLatestManifest());
    return;
  }
  if (pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      service: 'ju-license-server',
      port: PORT,
      curve: 'prime256v1',
      alg: 'ECDSA/SHA-256 (IEEE P1363)',
      publicKeyFingerprint: PUBLIC_FINGERPRINT,
      plans: Object.keys(PLAN_DURATION_DAYS),
      uptimeSec: Math.round(process.uptime()),
      /* M0-15 同步态观测：未推送时 cloudNodes 为 0、cloudSavedAt 为 null */
      cloudNodes: cloudState ? Object.keys(cloudState.nodes || {}).length : 0,
      cloudSavedAt: cloudStateAt ? new Date(cloudStateAt).toISOString() : null,
    });
    return;
  }
  if (pathname.startsWith('/downloads/') && req.method === 'GET') {
    serveDownload(req, res, pathname.slice('/downloads/'.length));
    return;
  }
  /* M0-15 · 云端同步（Mock 闭环）：上行写内存、下行读内存 */
  if (pathname === '/api/sync/push' && req.method === 'POST') {
    void handleSyncPush(req, res);
    return;
  }
  if (pathname === '/api/sync/pull' && req.method === 'GET') {
    handleSyncPull(res);
    return;
  }
  if (pathname === '/api/sync/push' || pathname === '/api/sync/pull') {
    sendJson(res, 405, { ok: false, error: '方法不被允许：' + req.method });
    return;
  }
  if (pathname === '/api/checkout' || pathname === '/api/latest.json') {
    sendJson(res, 405, { ok: false, error: '方法不被允许：' + req.method });
    return;
  }
  sendJson(res, 404, { ok: false, error: '未知路径：' + pathname });
}

/* ── TCP（主通道 · 端口 8081）+ 命名管道（本机回环被拦截时的验收通道） ── */
const servers = [];

const tcpServer = http.createServer(handleRequest);
tcpServer.on('error', (err) => {
  console.error('[license-server] TCP 监听失败：' + err.message);
  process.exit(1);
});
servers.push(tcpServer);
tcpServer.listen(PORT, '127.0.0.1', () => {
  log('listening on http://127.0.0.1:' + PORT);
  log('⚠ 本地演示专用（仅绑 127.0.0.1 未对外暴露）；CORS 白名单=' + ALLOWED_ORIGIN + '；签名=' + (process.env.JU_UPDATER_SIGNATURE ? '真实私钥' : 'MOCK_PLACEHOLDER_SIGNATURE'));
  log('private key <- ' + path.relative(PROJECT, PRIVATE_KEY_PATH));
  log('public key fingerprint = ' + PUBLIC_FINGERPRINT);
  log('POST /api/checkout · GET /api/latest.json · GET /api/health · GET /downloads/<file>');
  log('POST /api/sync/push · GET /api/sync/pull（M0-15 云端同步 Mock，进程内存态）');
});

if (PIPE_PATH) {
  if (process.platform !== 'win32') {
    try { fs.unlinkSync(PIPE_PATH); } catch { /* 首次启动无残留 socket */ }
  }
  const pipeServer = http.createServer(handleRequest);
  pipeServer.on('error', (err) => {
    console.error('[license-server] 管道监听失败：' + err.message);
  });
  servers.push(pipeServer);
  pipeServer.listen(PIPE_PATH, () => {
    log('listening on pipe ' + PIPE_PATH);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log('收到 ' + signal + '，关闭服务');
    let pending = servers.length;
    for (const s of servers) {
      s.close(() => {
        pending -= 1;
        if (pending <= 0) process.exit(0);
      });
    }
  });
}
