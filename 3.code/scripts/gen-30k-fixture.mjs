/**
 * M3 · 批次 AT · 3 万节点大库夹具生成器
 *
 * 产出：`public/30k-fixture.json`（Vite dev / build 均以静态资源直出，供 Playwright 基准测试
 * 通过 `/?fixture=30k` → `fetch('/30k-fixture.json')` 装载）。
 *
 * 结构分布（合计精确 30,000 节点）：
 *   - L0  根节点 ................................................ 1
 *   - L1  顶层文档：根的直接子节点 ............................... 100
 *   - L2  每个 L1 文档挂 100 个节点 ............................. 10,000
 *   - L3  余量节点（19,899）按轮转均摊到 L2：前 9,899 个 L2 各 2 个，其余各 1 个
 *         合计 9,899×2 + 10,001×1 = 19,899
 *   ------------------------------------------------------------------
 *   总计 = 1 + 100 + 10,000 + 19,899 = 30,000
 *
 * 节点字段按 M3 基准要求保留最小必要集：`id` / `text` / `parent` / `children`。
 * 尺寸约束：`core/persist.ts` 的 `MAX_STORE_BYTES = 4_500_000`（字符数）为落盘硬闸门，
 * 故夹具刻意不写 createdAt / tags / note 等渲染期有兜底的字段，保证整库 JSON 远低于闸门，
 * 基准测的是「装载 + 渲染」而非「落盘失败重试」。
 *
 * 运行（项目根 = 6.P0-T3基线/m07-vite）：
 *   node scripts/gen-30k-fixture.mjs
 */

import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 目标节点总数（M3 基准口径） */
const TOTAL_NODES = 30000;
/** L1 顶层文档数 */
const L1_COUNT = 100;
/** 每个 L1 下的 L2 节点数 */
const L2_PER_L1 = 100;

/** 单节点：仅 id / text / parent / children 四字段（队列序 = 渲染序） */
function mkNode(id, text, parent) {
  return { id, text, parent, children: [] };
}

function main() {
  const t0 = process.hrtime.bigint();

 /* id -> node 映射（普通对象即可；产品 state.nodes 同构） */
 const nodes = {};
  /** 自增游标：根=1，L1=2..101，L2=102..10101，L3=10102..30000 */
  let nextId = 1;
  const next = () => String(nextId++);

  /* ── L0：根节点 ── */
  const rootId = next(); // '1'
  const root = mkNode(rootId, '30K 基准资料库', null);
  nodes[rootId] = root;

  /* ── L1：100 个顶层文档 ── */
  const l1Ids = [];
  for (let i = 1; i <= L1_COUNT; i++) {
    const id = next();
    const n = mkNode(id, 'D' + String(i).padStart(3, '0'), rootId);
    nodes[id] = n;
    root.children.push(id);
    l1Ids.push(id);
  }

  /* ── L2：每个 L1 文档挂 100 个节点 ── */
  const l2Ids = [];
  for (const l1Id of l1Ids) {
    const parent = nodes[l1Id];
    for (let j = 1; j <= L2_PER_L1; j++) {
      const id = next();
      const n = mkNode(id, 'N' + id, l1Id);
      nodes[id] = n;
      parent.children.push(id);
      l2Ids.push(id);
    }
  }

  const builtSoFar = 1 + L1_COUNT + L1_COUNT * L2_PER_L1;
  const l3Total = TOTAL_NODES - builtSoFar;
  if (l3Total < 0) throw new Error('L2 层级已超出目标节点数：' + builtSoFar);

  /* ── L3：余量按轮转均摊到全部 L2（保证总数精确、层级不超过 3 层子节点） ── */
  for (let k = 0; k < l3Total; k++) {
    const parentId = l2Ids[k % l2Ids.length];
    const id = next();
    const n = mkNode(id, 'N' + id, parentId);
    nodes[id] = n;
    nodes[parentId].children.push(id);
  }

  const count = Object.keys(nodes).length;
  if (count !== TOTAL_NODES) throw new Error(`节点数不符：期望 ${TOTAL_NODES}，实际 ${count}`);

  const now = Date.now();
  const state = {
    nodes,
    rootId,
    updatedAt: now,
    _rev: 0,
    _structRev: 0,
    trashed: [],
    tagColors: {},
    activity: {},
    charStats: {},
    _tombstones: {},
    _localCreated: [],
    _remoteReceived: [],
    /* 夹具元信息（非产品字段，仅用于基准报告核对；产品件渲染路径不读取） */
    _fixture: {
      kind: 'm3-30k',
      total: TOTAL_NODES,
      l1: L1_COUNT,
      l2: L1_COUNT * L2_PER_L1,
      l3: l3Total,
      generatedAt: new Date(now).toISOString(),
    },
  };

  const json = JSON.stringify(state);
  const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '30k-fixture.json');
  writeFileSync(outFile, json, 'utf8');

  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const bytes = statSync(outFile).size;
  console.log('[gen-30k-fixture] 完成');
  console.log('  输出文件      : ' + outFile);
  console.log('  节点总数      : ' + count + '（L0 1 / L1 ' + L1_COUNT + ' / L2 ' + (L1_COUNT * L2_PER_L1) + ' / L3 ' + l3Total + '）');
  console.log('  JSON 字符数   : ' + json.length + '（persist 闸门 4500000）');
  console.log('  文件字节数    : ' + bytes);
  console.log('  生成耗时      : ' + ms.toFixed(1) + ' ms');
}

main();
