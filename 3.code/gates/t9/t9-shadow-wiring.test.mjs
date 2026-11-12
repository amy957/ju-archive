/**
 * L9-W4 · LO-2 影子层最小接线的哨兵用例（N 层 · Node 原生 test runner）
 * ----------------------------------------------------------------------------
 * 设计依据：`reports/t9-design-2026-10-14.md`
 *   · §十三 L9-W4「路径隔离（桌面 / 加密 / 浏览器）+ 哨兵 + 指标」；
 *   · §十四 LO-2（浏览器路线 M-A / M-D）——本波不裁决；仅依 LO-2「不接线产品路径 /
 *     不接线导出导入」约束，用**附加式（add-on）**把 L9 影子层挂到宿主，**不改产品字节**；
 *   · §2.3「In scope（必须）：零回归兜底」——未显式 on 时产品行为与 L8-W5 冻结版字节级一致。
 *
 * 硬约束（本子任务）：产品 HTML（canonical `6CAD8950…C42B10`）字节冻结；本用例仅
 *   覆盖**独立附加物** `attach-shadow.mjs`，不触碰产品 HTML、不写 `1.冻结版本/`。
 *
 * 覆盖（哨兵）：
 *   W4-0 `isProductHost` 判定口径；
 *   W4-1 路径隔离：支柱 URL 锚定本模块目录（非 cwd）且确定可缓存；
 *   W4-2 接线成功：置哨兵 + 装命名空间 + 四支柱可解析（无产品代码改动）；
 *   W4-3 幂等再接线：无重复副作用（loader 仅一次 / 命名空间同一引用 / 哨兵不翻倍）；
 *   W4-4 无产品在场：安全 no-op（不置哨兵 / 不装命名空间 / 不新增宿主键）；
 *   W4-5 L9 不可用：安全降级 no-op（loader 抛错 → 不置哨兵）；
 *   W4-6 detach：可观测复位（幂等清除哨兵与命名空间）。
 *
 * 用例编号：本波为 W4 接线哨兵 harness（非 P 层门禁用例），沿用**具名**（W4-0…W4-6），
 *           不占用 design §9.3 预留区（T-69+）编号，避免与待裁决区间冲突。
 * 运行：`node --test l9/t9-shadow-wiring.test.mjs`（Node ≥ 22）
 * 红证先行：`attach-shadow.mjs` 未实现时本文件必须失败（ERR_MODULE_NOT_FOUND）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  attachShadow, detachShadow, hasSentinel, shadowStatus, isProductHost,
  pillarUrls, pillarBaseDir, loadPillars, PILLARS,
  SENTINEL_KEY, NS_KEY, SENTINEL_ID,
} from './attach-shadow.mjs';

const SELF_DIR = path.dirname(fileURLToPath(import.meta.url));

/** 模拟产品宿主（含产品在场标记）；纯内存对象，绝不触碰真实产品代码。 */
const makeHost = () => ({ state: { rootId: 'root', nodes: {} }, __juPersistProbe: { mode: 'full' } });

const PILLAR_KEYS = ['persistStore', 'cryptoStore', 'indexLayer', 'workerProtocol', 'persistWorker', 'backendAdapters'];

describe('L9-W4 §LO-2 影子层接线（哨兵 / 路径隔离 / 幂等 / 降级）', () => {

  test('W4-0 isProductHost：宿主在场标记判定（无标记即非产品）', () => {
    assert.equal(isProductHost(makeHost()), true, 'state 标记在场 → 视为产品宿主');
    assert.equal(isProductHost({ __juIndexWorker: {} }), true, '__juIndexWorker 标记在场 → 视为产品宿主');
    assert.equal(isProductHost({}), false, '空对象 → 非产品');
    assert.equal(isProductHost(null), false, 'null → 非产品');
    assert.equal(isProductHost(undefined), false, 'undefined → 非产品');
    assert.equal(isProductHost(42), false, '标量 → 非产品');
  });

  test('W4-1 路径隔离：支柱 URL 锚定本模块（非 cwd）且确定可缓存', async () => {
    assert.deepEqual(Object.keys(PILLARS).sort(), PILLAR_KEYS.slice().sort(), '六支柱清单稳定');

    const urls = pillarUrls();
    for (const k of PILLAR_KEYS) {
      assert.equal(typeof urls[k], 'string', `${k} 解析为字符串 URL`);
      assert.ok(urls[k].startsWith('file:'), `${k} 为绝对 file: URL（非相对/cwd 依赖）`);
      assert.equal(urls[k], new URL(PILLARS[k], import.meta.url).href, `${k} 锚定 import.meta.url（路径隔离）`);
    }
    assert.equal(pillarUrls(), urls, '解析结果缓存（同引用，确定性）');

    const base = await pillarBaseDir();
    /* 本测试与该模块同目录 → 基准目录必须等于测试自身所在目录（与 process.cwd() 无关）。 */
    assert.equal(base, SELF_DIR, 'pillarBaseDir() 锚定模块目录（隔离于 cwd）');
    assert.notEqual(base, process.cwd(), '基准目录不等于 cwd（隔离已生效）');
  });

  test('W4-2 接线成功：置哨兵 + 装命名空间 + 六支柱可解析', async () => {
    const host = makeHost();
    const r = await attachShadow(host);
    assert.equal(r.attached, true, 'attachShadow 成功');
    assert.equal(r.sentinel, true, '哨兵已置位');
    assert.equal(r.reason, 'attached');
    assert.equal(r.id, SENTINEL_ID);

    assert.equal(hasSentinel(host), true, 'hasSentinel 观测到哨兵');
    const st = shadowStatus(host);
    assert.equal(st.attached, true);
    assert.equal(st.sentinel, true);
    assert.equal(st.id, SENTINEL_ID);
    assert.equal(st.attachCount, 1, '首次接线 attachCount = 1');

    /* 命名空间（附加全局）存在且六支柱齐备（真模块，非占位） */
    const ns = host[NS_KEY];
    assert.ok(ns && typeof ns === 'object', '__juL9Shadow 命名空间已安装');
    assert.deepEqual(Object.keys(ns.modules).sort(), PILLAR_KEYS.slice().sort(), '六支柱模块齐备');
    assert.equal(ns.modules.workerProtocol.REQ.PATCH, 'patch_nodes', '支柱为真模块导出（契约形状）');
    assert.equal(typeof ns.modules.persistStore.PersistStore, 'function', 'PersistStore 可用');

    /* 哨兵与命名空间均**不可枚举**（不污染宿主 for..in / Object.keys） */
    assert.ok(!Object.keys(host).includes(SENTINEL_KEY), '哨兵不可枚举');
    assert.ok(!Object.keys(host).includes(NS_KEY), '命名空间不可枚举');
  });

  test('W4-3 幂等再接线：无重复副作用（loader 仅 1 次 / 命名空间同引用 / 哨兵不翻倍）', async () => {
    const host = makeHost();
    let calls = 0;
    const loader = async () => { calls += 1; return loadPillars(); };

    const r1 = await attachShadow(host, { loader });
    assert.equal(r1.reason, 'attached');
    const firstModules = host[NS_KEY].modules;
    assert.equal(calls, 1, '首次接线调用 loader 一次');

    const r2 = await attachShadow(host, { loader });
    assert.equal(r2.reason, 'already-attached', '二次接线短路为幂等');
    assert.equal(r2.attached, true);
    assert.equal(r2.sentinel, true);
    assert.equal(calls, 1, '二次接线**不得**再次调用 loader（无重复副作用）');
    assert.equal(host[NS_KEY].modules, firstModules, '命名空间模块引用稳定（未重建）');
    assert.equal(shadowStatus(host).attachCount, 1, '哨兵 attachCount 不翻倍');
  });

  test('W4-4 无产品在场：安全 no-op（不置哨兵 / 不装命名空间 / 不新增宿主键）', async () => {
    const bare = {};
    const r = await attachShadow(bare);
    assert.equal(r.attached, false);
    assert.equal(r.sentinel, false);
    assert.equal(r.reason, 'no-product');
    assert.equal(hasSentinel(bare), false, '无产品 → 不置哨兵');
    assert.equal(bare[NS_KEY], undefined, '无产品 → 不装命名空间');
    assert.deepEqual(Object.keys(bare), [], '无产品 → 宿主键零新增（零副作用）');

    /* 默认宿主（Node globalThis）无产品标记 → 同样安全 no-op */
    const rg = await attachShadow();
    assert.equal(rg.attached, false);
    assert.equal(hasSentinel(globalThis), false, 'globalThis 默认 no-op，不污染');

    /* 非法宿主 → 仍安全 no-op */
    assert.equal((await attachShadow(null)).attached, false);
    assert.equal((await attachShadow(42)).attached, false);
  });

  test('W4-5 L9 不可用：安全降级 no-op（loader 抛错 → 不置哨兵）', async () => {
    const host = makeHost();
    const r = await attachShadow(host, { loader: async () => { throw new Error('l9-unavailable'); } });
    assert.equal(r.attached, false, '加载失败 → 不接线');
    assert.equal(r.sentinel, false);
    assert.equal(r.reason, 'no-l9');
    assert.ok(String(r.error).includes('l9-unavailable'), '降级原因可观测');
    assert.equal(hasSentinel(host), false, '降级路径不得残留哨兵');
    assert.equal(host[NS_KEY], undefined, '降级路径不得残留命名空间');
  });

  test('W4-6 detach：可观测复位（幂等清除哨兵与命名空间）', async () => {
    const host = makeHost();
    await attachShadow(host);
    assert.equal(hasSentinel(host), true);

    assert.equal(detachShadow(host), true, '首次 detach 报告已复位');
    assert.equal(hasSentinel(host), false, 'detach 清除哨兵');
    assert.equal(shadowStatus(host).attached, false, 'shadowStatus 观测到未接线');
    assert.equal(host[NS_KEY], undefined, 'detach 清除命名空间');
    assert.equal(detachShadow(host), false, '重复 detach 幂等（无副作用）');
  });
});
