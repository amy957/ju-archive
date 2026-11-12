/**
 * L9-W1 · 索引层（结构 + 查询 / 增量更新 API）
 * ----------------------------------------------------------------------------
 * 设计依据：`reports/t9-design-2026-10-14.md` §4.3（索引与持久层正交；L9 不碰 L6 索引维护，
 *          但需提供等价索引结构以支撑四支柱自足）
 *          + L6 冻结语义（calIndexUpdate / tagIndexUpdate / 搜索倒排 / 反链）。
 *
 * 契约：
 *   - 四索引：cal（date → Set<id>）/ tag（tag → Set<id>）/ search（term → Set<id>）/
 *             backlink（wiki 标题 → Set<id>）。
 *   - `_deleted`（软删）节点**不入索引**（与产品全表重建口径一致）。
 *   - `update(changedIds, from, to)` 必须与 `build(to)` **逐键等价**（增量一致性不变量）。
 *     · 移除：以 from 态节点归一（若 from 未删除则移除其旧贡献）
 *     · 添加：以 to 态节点归一（若 to 存在且未删除则加入新贡献）
 *     · 天然覆盖「日期迁移 / tag 变化 / 软删 / 复活」四类边界。
 *
 * 性质：**影子层（shadow / 默认关闭）**；纯函数 + 内存结构，不改产品路径、不接线导出/导入（LO-2）。
 */

const _TAG_RE = /#([\w\u4e00-\u9fff-]+)/g;
const _WIKI_RE = /\[\[([^\]]+)\]\]/g;
const _EN_RE = /[a-z0-9]+/g;
const _CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

const _stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '');
const _normTitle = (s) => String(s || '').trim().toLowerCase();

/** nodeAllTags：文本 `#tag` + 受 _manualTags 约束的 n.tags（与产品口径一致） */
export function nodeAllTags(n) {
  const seen = new Set();
  if (!n) return seen;
  const raw = _stripHtml(n.text);
  let m;
  _TAG_RE.lastIndex = 0;
  while ((m = _TAG_RE.exec(raw)) !== null) { if (m[1]) seen.add(m[1]); }
  if (Array.isArray(n.tags) && n.tags.length) {
    for (const t of n.tags) {
      if (!t || seen.has(t)) continue;
      if (!(Array.isArray(n._manualTags) && n._manualTags.includes(t))) continue;
      seen.add(t);
    }
  }
  return seen;
}

/** tokenize：英文/数字 word + CJK 单字（与产品搜索倒排口径一致） */
export function tokenize(text) {
  const out = new Set();
  if (!text) return out;
  const t = _stripHtml(text).toLowerCase();
  let m;
  _EN_RE.lastIndex = 0;
  while ((m = _EN_RE.exec(t)) !== null) { if (m[0].length >= 1 && m[0].length <= 32) out.add(m[0]); }
  _CJK_RE.lastIndex = 0;
  while ((m = _CJK_RE.exec(t)) !== null) { out.add(m[0]); }
  return out;
}

/** extractWikiTitles：`[[标题]]` → 归一化标题集（与产品反链口径一致） */
export function extractWikiTitles(text) {
  const out = new Set();
  if (!text) return out;
  _WIKI_RE.lastIndex = 0;
  let m;
  while ((m = _WIKI_RE.exec(String(text))) !== null) {
    const title = _normTitle(m[1]);
    if (title) out.add(title);
  }
  return out;
}

const _pack = (map) => {
  const o = {};
  for (const k of Array.from(map.keys()).sort()) o[k] = Array.from(map.get(k)).sort();
  return o;
};

/** IndexLayer：四索引的构建 / 查询 / 增量更新 */
export class IndexLayer {
  constructor() {
    this.cal = new Map();
    this.tag = new Map();
    this.search = new Map();
    this.backlink = new Map();
  }
  /** 全量构建（跳过 `_deleted` 节点） */
  build(state) {
    this.cal.clear(); this.tag.clear(); this.search.clear(); this.backlink.clear();
    const nodes = (state && state.nodes) || {};
    for (const id of Object.keys(nodes)) {
      const n = nodes[id];
      if (!n || n._deleted) continue;
      this._add(id, n);
    }
    return this;
  }
  _push(map, key, id) {
    let s = map.get(key);
    if (!s) { s = new Set(); map.set(key, s); }
    s.add(id);
  }
  _pull(map, key, id) {
    const s = map.get(key);
    if (!s) return;
    s.delete(id);
    if (!s.size) map.delete(key);
  }
  _add(id, n) {
    if (n.date) this._push(this.cal, n.date, id);
    for (const t of nodeAllTags(n)) this._push(this.tag, t, id);
    for (const w of tokenize(n.text)) this._push(this.search, w, id);
    for (const title of extractWikiTitles(n.text)) this._push(this.backlink, title, id);
  }
  _remove(id, n) {
    if (n.date) this._pull(this.cal, n.date, id);
    for (const t of nodeAllTags(n)) this._pull(this.tag, t, id);
    for (const w of tokenize(n.text)) this._pull(this.search, w, id);
    for (const title of extractWikiTitles(n.text)) this._pull(this.backlink, title, id);
  }
  /**
   * 增量更新（O(changed)，与全量 rebuild 等价）。
   * @returns {{ok:true, count:number}}
   */
  update(changedIds, fromState, toState) {
    const fromNodes = (fromState && fromState.nodes) || {};
    const toNodes = (toState && toState.nodes) || {};
    let count = 0;
    for (const id of changedIds || []) {
      if (!id) continue;
      const fromN = fromNodes[id];
      const toN = toNodes[id];
      if (fromN && !fromN._deleted) this._remove(id, fromN);
      if (toN && !toN._deleted) this._add(id, toN);
      count++;
    }
    return { ok: true, count };
  }
  byDate(d) { return new Set(this.cal.get(d) || []); }
  byTag(t) { return new Set(this.tag.get(t) || []); }
  lookupTerm(w) { return new Set(this.search.get(w) || []); }
  backlinksOf(title) { return new Set(this.backlink.get(_normTitle(title)) || []); }
  /** 确定性快照（键排序 + 值排序）：用于增量 == 全量的逐键等价断言 */
  snapshot() {
    return { cal: _pack(this.cal), tag: _pack(this.tag), search: _pack(this.search), backlink: _pack(this.backlink) };
  }
}
