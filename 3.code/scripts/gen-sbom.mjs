#!/usr/bin/env node
/**
 * M0-11 · CycloneDX SBOM 生成器
 *
 * 输入：m07-vite/package-lock.json（lockfileVersion 2/3 的 `packages` 视图）
 * 输出：m07-vite/docs/SBOM.json（CycloneDX 1.5 JSON）
 *
 * 设计要点：
 *   - 纯只读解析，不访问网络；只把锁定树里已解析的 `version` 落地。
 *   - 输出可复现：组件按 (name, version) 排序；serialNumber 由锁文件 SHA-256 派生，
 *     不含随机量 / 当前时间，重复执行字节一致（便于哈希与漂移核对）。
 *   - `integrity`（SRI）里的 base64 摘要会转换成十六进制写入 `hashes`。
 *   - devDependencies 以 CycloneDX property `cdx:npm:package:development` 标注。
 *
 * 用法：node scripts/gen-sbom.mjs
 * 退出码：0 = 生成成功；非 0 = 锁文件缺失 / 解析失败（异常直接抛出）。
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const LOCK = path.join(PROJECT, 'package-lock.json');
const OUT_DIR = path.join(PROJECT, 'docs');
const OUT = path.join(OUT_DIR, 'SBOM.json');

/** 从 `node_modules/a/node_modules/@scope/b` 这类路径还原包名 */
function nameFromPath(pkgPath) {
  const marker = 'node_modules/';
  const idx = pkgPath.lastIndexOf(marker);
  return idx >= 0 ? pkgPath.slice(idx + marker.length) : pkgPath;
}

/** npm 包名 + 版本 → Package URL（scope 的 @ 按 purl 规范百分号编码） */
function toPurl(name, version) {
  if (name.startsWith('@')) {
    const slash = name.indexOf('/');
    if (slash > 0) {
      const scope = name.slice(1, slash);
      const pkg = name.slice(slash + 1);
      return `pkg:npm/%40${scope}/${pkg}@${version}`;
    }
  }
  return `pkg:npm/${name}@${version}`;
}

/** SRI 摘要（`sha512-<base64>`）→ CycloneDX hash 对象；不支持/格式异常返回 null */
function integrityToHash(integrity) {
  if (typeof integrity !== 'string') return null;
  const m = /^(sha(?:1|256|384|512))-([A-Za-z0-9+/=]+)$/.exec(integrity.trim());
  if (!m) return null;
  const alg = m[1].toUpperCase().replace('SHA', 'SHA-');
  try {
    const hex = Buffer.from(m[2], 'base64').toString('hex');
    return { alg, content: hex };
  } catch {
    return null;
  }
}

/** license 字段可能是字符串、{type}、或数组；统一成 CycloneDX licenses 数组 */
function toLicenses(license) {
  const list = [];
  const push = (v) => {
    if (!v) return;
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return;
      /* SPDX 标识符只允许字母数字 . + -；含空格视为自定义名称 */
      if (/^[A-Za-z0-9.+-]+$/.test(s)) list.push({ license: { id: s } });
      else list.push({ license: { name: s } });
    } else if (typeof v === 'object' && typeof v.type === 'string') {
      push(v.type);
    }
  };
  if (Array.isArray(license)) license.forEach(push);
  else push(license);
  return list;
}

/** 由锁文件哈希派生稳定的 UUID（版本位 5 / 变体位 a），满足 urn:uuid 形状 */
function stableUuid(hex) {
  const h = hex.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function main() {
  const raw = readFileSync(LOCK);
  const lock = JSON.parse(raw.toString('utf8'));
  const packages = lock.packages || {};

  const root = packages[''] || {};
  const projectName = root.name || 'm07-vite';
  const projectVersion = root.version || '0.0.0';

  const components = [];
  for (const [pkgPath, meta] of Object.entries(packages)) {
    if (!pkgPath) continue;
    if (!meta || typeof meta !== 'object') continue;
    if (meta.link) continue; /* 本地 link 依赖无独立制品 */
    const name = meta.name || nameFromPath(pkgPath);
    const version = meta.version || '';
    if (!name || !version) continue;

    const purl = toPurl(name, version);
    const component = {
      type: 'library',
      'bom-ref': purl,
      name,
      version,
      purl,
    };
    const licenses = toLicenses(meta.license);
    if (licenses.length) component.licenses = licenses;
    const hash = integrityToHash(meta.integrity);
    if (hash) component.hashes = [hash];

    const properties = [];
    if (meta.dev) properties.push({ name: 'cdx:npm:package:development', value: 'true' });
    if (meta.optional) properties.push({ name: 'cdx:npm:package:optional', value: 'true' });
    if (meta.dev === undefined) properties.push({ name: 'cdx:npm:package:development', value: 'false' });
    if (properties.length) component.properties = properties;

    components.push(component);
  }

  components.sort((a, b) => (a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name)));

  const lockDigest = createHash('sha256').update(raw).digest('hex');
  const bom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${stableUuid(lockDigest)}`,
    version: 1,
    metadata: {
      tools: [
        {
          vendor: 'JU',
          name: 'gen-sbom.mjs',
          version: '1.0.0',
        },
      ],
      component: {
        type: 'application',
        'bom-ref': `pkg:npm/${projectName}@${projectVersion}`,
        name: projectName,
        version: projectVersion,
        purl: `pkg:npm/${projectName}@${projectVersion}`,
      },
      properties: [
        { name: 'ju:lockfile', value: 'package-lock.json' },
        { name: 'ju:lockfile:sha256', value: lockDigest },
        { name: 'ju:lockfile:packages', value: String(Object.keys(packages).length - 1) },
      ],
    },
    components,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, JSON.stringify(bom, null, 2) + '\n', 'utf8');

  const runtime = components.filter(
    (c) => !(c.properties || []).some((p) => p.name === 'cdx:npm:package:development' && p.value === 'true'),
  ).length;
  console.log(`[gen-sbom] 写入 ${path.relative(PROJECT, OUT)}`);
  console.log(`[gen-sbom] 组件 ${components.length}（运行时 ${runtime} / 开发 ${components.length - runtime}）`);
  console.log(`[gen-sbom] serialNumber=urn:uuid:${stableUuid(lockDigest)}`);
  console.log(`[gen-sbom] lock sha256=${lockDigest}`);
}

main();
