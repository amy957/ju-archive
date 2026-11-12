/**
 * M5-2 · 全局搜索 Worker（防 10 万节点下主线程输入卡顿）
 *
 * 用途：搜索框每次 `input` 不再在主线程遍历 `state.nodes`（10 万节点量级会形成 >50ms 长任务，
 *       表现为输入掉帧），而是把「节点表快照」一次性交给本 Worker；Worker 内建倒排索引并常驻，
 *       后续按键只传 `query`（不再重复结构化克隆 10 万节点），命中结果按 `reqId` 回传。
 *
 * 协议（v1）：
 *   主线程 → Worker：
 *     `{ type:'search', reqId:number, query:string, nodes?:Record<string, any>, limit?:number }`
 *     —— `nodes` 仅在节点表引用变化时携带（首查 / 数据变更后）；否则省略，复用 Worker 内索引。
 *     `{ type:'dispose' }` —— 释放索引（桌面端退出 / 测试清理）。
 *    Worker → 主线程：
 *     `{ type:'search-result', reqId, ids:string[], total:number, scanned:number,
 *        elapsedMs:number, engine:'inverted'|'scan', cached:boolean }`
 *     `{ type:'disposed' }`
 *
 * 检索口径（与产品既有搜索保持一致的「纯文本包含」语义）：
 *   - 文本取 `node.text`，剔除 HTML 标签、`&nbsp;` 等常见实体后压缩空白、转小写；
 *   - 命中判定为 `haystack.includes(query)`（子串包含，中文 / 英文 / 数字一致）；
 *   - 倒排索引仅用于**缩小候选集**：拉丁词 + CJK 单字 + CJK 双字入倒排，取最短 posting 列表
 *     作为候选，再用 `includes` 逐条复核 —— 因此索引只影响速度，不影响结果正确性；
 *   - 索引不可用（空查询 / 纯符号查询）时回落全量扫描（`engine:'scan'`）；
 *   - `_deleted` 节点不参与检索。
 *
 * 模块顶层带 Worker 环境守卫：被主线程 `import`（取 `searchNodes` 做同步回落 / 单测）时
 * 不会给 window 挂 `onmessage`。
 */

/** Worker 入参 */
export interface SearchRequest {
  type?: 'search';
  reqId: number;
  query: string;
  /** 节点表快照（仅在引用变化时携带；省略表示复用 Worker 内已有索引） */
  nodes?: Record<string, any>;
  /** 返回条数上限（默认 500；`total` 仍为真实命中总数） */
  limit?: number;
}

/** Worker 出参 */
export interface SearchResponse {
  type: 'search-result';
  reqId: number;
  ids: string[];
  total: number;
  scanned: number;
  elapsedMs: number;
  engine: 'inverted' | 'scan';
  cached: boolean;
  error?: string;
  /** 仅主线程同步回落路径置真（Worker 回包永不携带，用于来源诊断） */
  _fallback?: boolean;
}

/** 单条索引记录 */
interface IndexEntry {
  id: string;
  text: string;
}

/** 常驻索引（Worker 侧持有；主线程不可见） */
export interface SearchIndex {
  entries: IndexEntry[];
  /** token → entries 下标列表（升序，构建顺序即节点枚举顺序） */
  postings: Map<string, number[]>;
}

/** 默认返回条数上限 */
export const SEARCH_DEFAULT_LIMIT = 500;

const LATIN_RE = /[a-z0-9_]+/g;
const CJK_RUN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g;

/** 常见 HTML 实体 → 字符（与搜索 haystack 同口径的最小集合） */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&/gi, '&')
    .replace(/</gi, '<')
    .replace(/>/gi, '>')
    .replace(/"/gi, '"')
    .replace(/'/g, "'");
}

/** 去标签 + 实体解码 + 空白压缩 + 小写（搜索 haystack 统一口径） */
export function toSearchHaystack(raw: unknown): string {
  if (raw == null) return '';
  return decodeEntities(String(raw).replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * 分词（仅用于倒排索引缩小候选集）：
 *   - 拉丁字母 / 数字 / 下划线连续串（如 `d001`、`v2`）；
 *   - CJK 单字 + 相邻双字（覆盖 1~2 字的中文查询）。
 */
export function tokenizeForIndex(text: string): string[] {
  const out: string[] = [];
  if (!text) return out;
  const latin = text.match(LATIN_RE);
  if (latin) {
    for (const w of latin) out.push(w);
  }
  const cjkRuns = text.match(CJK_RUN_RE);
  if (cjkRuns) {
    for (const run of cjkRuns) {
      const chars = Array.from(run);
      for (let i = 0; i < chars.length; i += 1) {
        out.push(chars[i]);
        if (i + 1 < chars.length) out.push(chars[i] + chars[i + 1]);
      }
    }
  }
  return out;
}

/** 由节点表构建索引（O(总文本长度)；跳过 `_deleted`） */
export function buildSearchIndex(nodes: Record<string, any> | null | undefined): SearchIndex {
  const entries: IndexEntry[] = [];
  const postings = new Map<string, number[]>();
  if (!nodes || typeof nodes !== 'object') return { entries, postings };
  for (const id of Object.keys(nodes)) {
    const node = nodes[id];
    if (!node || node._deleted) continue;
    const text = toSearchHaystack(node.text);
    if (!text) continue;
    const at = entries.length;
    entries.push({ id: String(id), text });
    const seen = new Set<string>();
    for (const token of tokenizeForIndex(text)) {
      if (seen.has(token)) continue;
      seen.add(token);
      let list = postings.get(token);
      if (!list) {
        list = [];
        postings.set(token, list);
      }
      list.push(at);
    }
  }
  return { entries, postings };
}

/** 候选集：取查询 token 中最短 posting；任一 token 不存在 → 必无命中 */
function candidatesOf(index: SearchIndex, query: string): number[] | null {
  const tokens = tokenizeForIndex(query);
  if (!tokens.length) return null;
  let best: number[] | null = null;
  const seen = new Set<string>();
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    const list = index.postings.get(token);
    if (!list) return [];
    if (!best || list.length < best.length) best = list;
  }
  return best;
}

/**
 * 在已构建索引上执行查询。
 *
 * @param index      `buildSearchIndex` 产物
 * @param rawQuery   原始输入（内部统一做 haystack 归一）
 * @param limit      返回条数上限（<=0 视为默认值）
 */
export function querySearchIndex(
  index: SearchIndex,
  rawQuery: string,
  limit: number = SEARCH_DEFAULT_LIMIT,
): Omit<SearchResponse, 'type' | 'reqId'> {
  const started = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
  const query = toSearchHaystack(rawQuery);
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : SEARCH_DEFAULT_LIMIT;
  const ids: string[] = [];
  let total = 0;
  let scanned = 0;
  let engine: 'inverted' | 'scan' = 'scan';

  if (query && index.entries.length) {
    const candidates = candidatesOf(index, query);
    if (candidates) {
      engine = 'inverted';
      scanned = candidates.length;
      for (const at of candidates) {
        const entry = index.entries[at];
        if (!entry || !entry.text.includes(query)) continue;
        total += 1;
        if (ids.length < cap) ids.push(entry.id);
      }
    } else {
      scanned = index.entries.length;
      for (const entry of index.entries) {
        if (!entry.text.includes(query)) continue;
        total += 1;
        if (ids.length < cap) ids.push(entry.id);
      }
    }
  }

  const ended = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
  return {
    ids,
    total,
    scanned,
    elapsedMs: Math.round((ended - started) * 1000) / 1000,
    engine,
    cached: true,
  };
}

/**
 * 一次性同步检索（主线程回落 / 单测参考实现）。
 * 逐字口径与 Worker 完全相同（同一 `buildSearchIndex` + `querySearchIndex`）。
 */
export function searchNodes(
  nodes: Record<string, any> | null | undefined,
  rawQuery: string,
  limit: number = SEARCH_DEFAULT_LIMIT,
): string[] {
  return querySearchIndex(buildSearchIndex(nodes), rawQuery, limit).ids;
}

/** 是否为 Worker 全局作用域（module worker 中 importScripts 仍存在；主线程为 undefined） */
function isWorkerScope(): boolean {
  const g = globalThis as any;
  return typeof g.importScripts === 'function' && typeof g.document === 'undefined';
}

if (isWorkerScope()) {
  const ctx = globalThis as any;
  /** 常驻索引：仅在收到 `nodes` 时重建，后续按键零克隆开销 */
  let cache: SearchIndex | null = null;

  ctx.onmessage = (ev: MessageEvent<SearchRequest | { type: 'dispose' }>): void => {
    const data = (ev && ev.data) || ({} as SearchRequest);
    if (data && (data as any).type === 'dispose') {
      cache = null;
      ctx.postMessage({ type: 'disposed' });
      return;
    }
    const req = data as SearchRequest;
    const reqId = Number(req && req.reqId) || 0;
    let cached = true;
    try {
      if (req && req.nodes && typeof req.nodes === 'object') {
        cache = buildSearchIndex(req.nodes);
        cached = false;
      }
      if (!cache) cache = buildSearchIndex(null);
      const result = querySearchIndex(cache, String((req && req.query) || ''), Number(req.limit) || SEARCH_DEFAULT_LIMIT);
      const res: SearchResponse = {
        type: 'search-result',
        reqId,
        ids: result.ids,
        total: result.total,
        scanned: result.scanned,
        elapsedMs: result.elapsedMs,
        engine: result.engine,
        cached,
      };
      ctx.postMessage(res);
    } catch (e) {
      /* Worker 内异常不得让主线程永久等待：回传空结果 + error，由主线程展示失败态 */
      const res: SearchResponse = {
        type: 'search-result',
        reqId,
        ids: [],
        total: 0,
        scanned: 0,
        elapsedMs: 0,
        engine: 'scan',
        cached,
        error: String((e && (e as Error).message) || e),
      };
      ctx.postMessage(res);
    }
  };
}
