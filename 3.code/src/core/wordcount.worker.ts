/**
 * M5-2 · 按需字数统计 Worker（防主线程阻塞）
 *
 * 用途：文档节点总数超过阈值（默认 5,000）时，`core/store.docWordCount()` 不再在主线程同步遍历子树，
 *       而是把 `state.nodes` 的只读快照交给本 Worker，在 Worker 内递归遍历目标文档子树、
 *       去除 HTML 标签后统计纯文本字数，完成后回传 `{ docId, wordCount }`。
 *
 * 协议：
 *   主线程 → Worker：`{ nodes: Record<string, any>, docId: string }`
 *   Worker → 主线程：`{ docId: string, wordCount: number }`
 *
 * 说明：
 *   - 纯文本口径与 `core/utils.stripHtml()` 一致（`/<[^>]*>/g` 全量剔除标签），
 *     再按 `Array.from` 计 Unicode 码点（emoji / 代理对按 1 个字计），与产品「字数」直觉一致；
 *   - 遍历以 `children` 递归下钻，用 `visited` 去重防脏数据成环导致死循环；
 *   - 模块顶层带 Worker 环境守卫：被主线程 `import` 时（取 `countSubtreeChars` 做同步小文档计算）
 *     不会给 window 挂 `onmessage`。
 */

/** Worker 入参 */
export interface WordCountRequest {
  nodes: Record<string, any>;
  docId: string;
}

/** Worker 出参 */
export interface WordCountResult {
  docId: string;
  wordCount: number;
}

/** 去除 HTML 标签（与 core/utils.stripHtml 同口径的本地实现，避免 Worker 侧引入整套 utils） */
function stripTags(s: unknown): string {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '');
}

/** 按 Unicode 码点计字（emoji / 代理对计 1 个字） */
function countChars(s: string): number {
  let n = 0;
  for (const _ch of s) n += 1;
  return n;
}

/**
 * 递归统计 `docId` 子树的纯文本字数。
 *
 * @param nodes  全量节点表（只读使用，不修改）
 * @param docId  文档 / 节点 id（统计含自身在内的整棵子树）
 */
export function countSubtreeChars(nodes: Record<string, any>, docId: string): number {
  if (!nodes || !docId) return 0;
  if (!nodes[docId]) return 0;
  const visited = new Set<string>();
  let total = 0;
  const walk = (id: string): void => {
    if (!id || visited.has(id)) return;
    visited.add(id);
    const n = nodes[id];
    if (!n) return;
    if (n._deleted) return;
    total += countChars(stripTags(n.text).replace(/\s+/g, ' ').trim());
    const kids: any[] = Array.isArray(n.children) ? n.children : [];
    for (const cid of kids) walk(String(cid));
  };
  walk(String(docId));
  return total;
}

/* ====================================================================
 * fix7 · 字数统计 token 化（《精简完整方案》口径）
 * --------------------------------------------------------------------
 * 分词规则（DEFAULT_TOKENIZE_OPTIONS 默认全开）：
 *   ① 中日韩（含假名 / 谚文 / 汉字扩展 / 兼容表意文字）→ 每个**字素簇** 1 token；
 *   ② 拉丁等非 CJK 的字母数字连续串 → 整串 1 token（英文按词；englishWords=false 时逐字符）；
 *   ③ 空白 → 每个字符 1 token（countWhitespace=false 可关闭）；
 *   ④ 标点 / emoji / 其它符号 → 每个字素簇 1 token（countPunctuation=false 可关闭）。
 *
 * 字素簇优先用 Intl.Segmenter（grapheme），不可用时回落 Array.from（码点），
 * 保证 emoji（含 ZWJ 组合）+ 代理对按 1 个计，与产品「所见即一个字符」直觉一致。
 * ==================================================================== */

/** 分词选项（缺省见 DEFAULT_TOKENIZE_OPTIONS） */
export interface TokenizeOptions {
  /** 英文（非 CJK 字母数字串）按词计（true）或按字符计（false）；默认 true */
  englishWords?: boolean;
  /** 空白是否计 token（每字符 1 个）；默认 true */
  countWhitespace?: boolean;
  /** 标点 / emoji / 符号是否计 token（每字素簇 1 个）；默认 true */
  countPunctuation?: boolean;
}

/** 默认分词选项（全开） */
export const DEFAULT_TOKENIZE_OPTIONS: Required<TokenizeOptions> = {
  englishWords: true,
  countWhitespace: true,
  countPunctuation: true,
};

/** tokenDiff 结果：I=插入 token 数，D=删除 token 数，A/R/M/N 为四象限口径 */
export interface TokenDiffResult {
  I: number;
  D: number;
  /** 净新增 = I - D */
  N: number;
  /** 纯新增 = I - M */
  A: number;
  /** 纯删除 = D - M */
  R: number;
  /** 纯修改 = min(I, D) */
  M: number;
}

/** CJK 判定（汉字 / 假名 / 谚文 / 兼容与扩展区） */
function isCjkCode(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x11ff) ||
    (cp >= 0x2e80 && cp <= 0x2fdf) ||
    (cp >= 0x3040 && cp <= 0x30ff) ||
    (cp >= 0x3130 && cp <= 0x318f) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa960 && cp <= 0xa97f) ||
    (cp >= 0xac00 && cp <= 0xd7af) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff66 && cp <= 0xff9f)
  );
}

/** 非 CJK 字母 / 数字（拉丁、希腊、西里尔…统一按「字母数字」处理） */
function isWordCode(cp: number): boolean {
  if (isCjkCode(cp)) return false;
  try {
    return /[\p{L}\p{N}]/u.test(String.fromCodePoint(cp));
  } catch (e) {
    return /[0-9A-Za-z]/.test(String.fromCodePoint(cp));
  }
}

/** 字素簇切分（Intl.Segmenter 优先；不可用回落码点） */
let _graphemeSeg: any = null;
function graphemes(text: string): string[] {
  const g = globalThis as any;
  if (typeof Intl !== 'undefined' && typeof (Intl as any).Segmenter === 'function') {
    try {
      if (!_graphemeSeg) _graphemeSeg = new (Intl as any).Segmenter('zh', { granularity: 'grapheme' });
      const out: string[] = [];
      for (const s of _graphemeSeg.segment(text)) out.push(s.segment);
      return out;
    } catch (e) {
      _graphemeSeg = null;
    }
  }
  return Array.from(text);
}

/**
 * 文本 → token 序列（纯函数，主线程与 Worker 共用）。
 *
 * @param text 纯文本（调用方负责先剔除 HTML 标签）
 */
export function tokenize(text: string, opts?: TokenizeOptions): string[] {
  const o: Required<TokenizeOptions> = { ...DEFAULT_TOKENIZE_OPTIONS, ...(opts || {}) };
  const src = String(text == null ? '' : text);
  if (!src) return [];
  const out: string[] = [];
  let word = '';
  const flushWord = (): void => { if (word) { out.push(word); word = ''; } };
  for (const g of graphemes(src)) {
    const cp = g.codePointAt(0) as number;
    if (isCjkCode(cp)) { flushWord(); out.push(g); continue; }
    if (isWordCode(cp)) {
      if (o.englishWords) { word += g; }
      else { flushWord(); out.push(g); }
      continue;
    }
    flushWord();
    if (/^\s+$/.test(g)) { if (o.countWhitespace) out.push(g); continue; }
    if (o.countPunctuation) out.push(g);
  }
  flushWord();
  return out;
}

/** 文本 token 数（tokenize().length 的快捷方式） */
export function countTokens(text: string, opts?: TokenizeOptions): number {
  return tokenize(text, opts).length;
}

/** token 序列的稳定摘要（用于「退出校准」的块级 hash 比较） */
export function hashTokens(tokens: string[]): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    for (let j = 0; j < t.length; j++) {
      const c = t.charCodeAt(j);
      h1 = (h1 ^ c) * 16777619 >>> 0;
      h2 = (h2 + c * (j + 1)) >>> 0;
    }
    h1 = (h1 ^ 0x2f) >>> 0;
  }
  return h1.toString(16) + '-' + h2.toString(16) + '-' + tokens.length.toString(16);
}

/**
 * token 级增量差分（纯函数）。
 *
 * 算法：先剥掉公共前缀 / 公共后缀（典型编辑落在中间），中段用「多重集匹配」求可配对 token 数：
 *   I = 新中段长度 - matched，D = 旧中段长度 - matched
 * 于是 M = min(I, D)，A = I - M，R = D - M，N = I - D。
 * 复杂度 O(n+m)，不做 O(n*m) 的 LCS —— 大字本文档下不会阻塞主线程。
 */
export function tokenDiff(oldText: string, newText: string, opts?: TokenizeOptions): TokenDiffResult {
  const a = tokenize(oldText, opts);
  const b = tokenize(newText, opts);
  if (!a.length && !b.length) return { I: 0, D: 0, N: 0, A: 0, R: 0, M: 0 };
  let p = 0;
  const maxP = Math.min(a.length, b.length);
  while (p < maxP && a[p] === b[p]) p++;
  let s = 0;
  const maxS = Math.min(a.length, b.length) - p;
  while (s < maxS && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const midA = a.slice(p, a.length - s);
  const midB = b.slice(p, b.length - s);
  let matched = 0;
  if (midA.length && midB.length) {
    const bag = new Map<string, number>();
    for (const t of midA) bag.set(t, (bag.get(t) || 0) + 1);
    for (const t of midB) {
      const n = bag.get(t) || 0;
      if (n > 0) { bag.set(t, n - 1); matched++; }
    }
  }
  const I = midB.length - matched;
  const D = midA.length - matched;
  const M = Math.min(I, D);
  return { I, D, N: I - D, A: I - M, R: D - M, M };
}

/** fix7 增量差分协议（主线程 → Worker） */
export interface TokenDiffRequest {
  type: 'tokenDiff';
  rid: number;
  oldText: string;
  newText: string;
  opts?: TokenizeOptions;
}

/** fix7 增量差分协议（Worker → 主线程） */
export interface TokenDiffResponse extends TokenDiffResult {
  type: 'tokenDiff';
  rid: number;
}

/** 是否为 Worker 全局作用域（type:module worker 中 importScripts 仍存在；主线程为 undefined） */
function isWorkerScope(): boolean {
  const g = globalThis as any;
  return typeof g.importScripts === 'function' && typeof g.document === 'undefined';
}

if (isWorkerScope()) {
  const ctx = globalThis as any;
  ctx.onmessage = (ev: MessageEvent<any>): void => {
    const data = (ev && ev.data) || {};
    /* fix7：token 级增量差分（大文本走 Worker，避免主线程长任务） */
    if (data && data.type === 'tokenDiff') {
      let res: TokenDiffResponse = { type: 'tokenDiff', rid: Number(data.rid) || 0, I: 0, D: 0, N: 0, A: 0, R: 0, M: 0 };
      try {
        const d = tokenDiff(String(data.oldText || ''), String(data.newText || ''), data.opts);
        res = { type: 'tokenDiff', rid: Number(data.rid) || 0, ...d };
      } catch (e) {
        /* Worker 内异常不得让主线程永久等待：回传全 0，由主线程按失败分支处理 */
      }
      ctx.postMessage(res);
      return;
    }
    /* M5-2 既有协议（一字不动）：docWordCount */
    const req = data as WordCountRequest;
    const docId = String(req.docId || '');
    let wordCount = 0;
    try {
      wordCount = countSubtreeChars(req.nodes || {}, docId);
    } catch (e) {
      /* Worker 内异常不得让主线程永久等待：回传 0，由主线程按失败分支处理 */
      wordCount = 0;
    }
    const res: WordCountResult = { docId, wordCount };
    ctx.postMessage(res);
  };
}
