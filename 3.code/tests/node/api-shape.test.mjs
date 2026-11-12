/**
 * M0-7 · 批次 B3 · API 形状静态对拍（只读取产品件，不加载 1.3MB 页面）
 *
 * 左值：canonical v2.0-t3.html 内 J.register / J.require / J.lifecycle 的定义片段
 * 右值：src/contract/registry.ts、src/contract/lifecycle.ts 的导出方法名集合
 * 判定：集合必须逐项相等，且错误消息 / console.warn 前缀字面量逐字相等
 * 运行：node --test test/api-shape.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRODUCT = path.resolve(HERE, '..', '..', 'v2.0-t3.html');
const REGISTRY_TS = path.resolve(HERE, '..', 'src', 'contract', 'registry.ts');
const LIFECYCLE_TS = path.resolve(HERE, '..', 'src', 'contract', 'lifecycle.ts');

/* 行尾归一（仅内存态；落盘产品件不动一字节），使定义片段正则可跨 CRLF/LF 命中 */
const productRaw = readFileSync(PRODUCT, 'utf8');
const product = productRaw.replace(/\r\n/g, '\n');

function uniq(arr) {
  return [...new Set(arr)].sort();
}

test('产品件：J.register / J.require / J.lifecycle 定义片段可定位', () => {
  assert.match(product, /J\.register=function\(name,value\)\{if\(name\)J\._contract\[name\]=value;\};/);
  assert.match(
    product,
    /J\.require=function\(name\)\{if\(!\(name in J\._contract\)\)throw new Error\('JU\.require missing: '\+name\);return J\._contract\[name\];\};/
  );
  const lcStart = product.indexOf('J.lifecycle={');
  assert.ok(lcStart > 0, 'J.lifecycle 定义片段未找到');
  const lcEnd = product.indexOf('};\n  }', lcStart);
  assert.ok(lcEnd > lcStart, 'J.lifecycle 定义片段边界未找到');
});

test('方法名集合 {register,require,add,on,dispose} 产品侧 vs src/contract/*.ts 一致', () => {
  const productRegister = /J\.(register)=function\(/.exec(product);
  const productRequire = /J\.(require)=function\(/.exec(product);
  const lcStart = product.indexOf('J.lifecycle={');
  const lcBlock = product.slice(lcStart, product.indexOf('};\n  }', lcStart));
  const productLifecycle = [...lcBlock.matchAll(/^\s{6}(add|on|dispose):function\(/gm)].map((m) => m[1]);

  const productSet = uniq([
    productRegister && productRegister[1],
    productRequire && productRequire[1],
    ...productLifecycle,
  ]);

  const registryTs = readFileSync(REGISTRY_TS, 'utf8');
  const lifecycleTs = readFileSync(LIFECYCLE_TS, 'utf8');
  const srcSet = uniq([
    ...registryTs.matchAll(/^export function (register|require)(?:<[^>]*>)?\(/gm).map((m) => m[1]),
    ...lifecycleTs.matchAll(/^export function (add|on|dispose)\(/gm).map((m) => m[1]),
  ]);

  assert.deepEqual(productSet, ['add', 'dispose', 'on', 'register', 'require']);
  assert.deepEqual(srcSet, productSet);
});

test('错误消息与告警前缀字面量逐字一致', () => {
  const registryTs = readFileSync(REGISTRY_TS, 'utf8');
  const lifecycleTs = readFileSync(LIFECYCLE_TS, 'utf8');
  const MSG = "'JU.require missing: ' + name";
  assert.ok(product.includes("throw new Error('JU.require missing: '+name)"), '产品侧消息字面量缺失');
  assert.ok(registryTs.includes(MSG), 'src 侧消息字面量未逐字对齐');
  assert.ok(product.includes("console.warn('[JU.lifecycle]',e)"), '产品侧 warn 前缀缺失');
  assert.ok(lifecycleTs.includes("console.warn('[JU.lifecycle]', e)"), 'src 侧 warn 前缀未对齐');
});

test('产品件在本次对拍中零写入（只读快照哈希稳定）', () => {
  const again = readFileSync(PRODUCT, 'utf8');
  assert.equal(again.length, product.length);
  assert.equal(again === product, true);
});
