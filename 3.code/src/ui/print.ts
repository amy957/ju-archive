/**
 * M1-1 遗留 · 打印端口（Print）
 *
 * 缺陷背景：
 *   `ui/rightbar.ts` 的 `bindRightSidebar()` 把 `#btnPrintDo` 绑定到 `deps.doPrint`，
 *   把 `#printWithMeta` 的 change 绑定到 `deps.showPrintPreview`。
 *   但 `src/` 下**不存在**这两个函数（canonical 19319 / 19347 从未迁入），
 *   `bindRightbarDeps()` 也就无从注入 —— `deps.doPrint` 一直是 `() => {}` 占位，
 *   运行期表现为「点『确认打印』毫无反应，也不弹预览」。
 *
 * 本文件按 canonical 逐行移植（仅做依赖注入化，行为与产品件一致）：
 *   - showPrintPreview ......................................... 19319-19346
 *   - doPrint .................................................. 19347-19417
 *
 * 依赖注入口径（原同作用域符号 → deps 端口）：
 *   getCurrentDoc / N / state / docWordCount / forceRender / toast
 *   已拆分模块直接 import：$ / stripHtml（core/utils）、APP_LOCALE（core/constants）
 */
import { $, stripHtml } from '../core/utils';
import { APP_LOCALE } from '../core/constants';
import { toast } from './common';

export interface PrintDeps {
  /** 当前文档（对应产品 `getCurrentDoc()`） */
  getCurrentDoc: () => any;
  /** 节点取用（对应产品 `N(id)`） */
  N: (id: any) => any;
  /** 全局数据状态（对应产品 `state`，取 rootId / nodes） */
  state: any;
  /** 文档字数（对应产品 `docWordCount(docId)`） */
  docWordCount: (docId: any) => number;
  /** 强制重渲染（对应产品 `forceRender()`） */
  forceRender: () => void;
}

/** 依赖注入容器（模块内安全占位：加载即不抛错）。 */
export const deps: PrintDeps = {
  getCurrentDoc: () => null,
  N: () => null,
  state: { nodes: {}, rootId: null },
  docWordCount: () => 0,
  forceRender: () => undefined,
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持占位）。 */
export function bindPrintDeps(next: Partial<PrintDeps>): void {
  Object.assign(deps, next);
}

/** 文档子树节点数（对应产品 `docNodeCount(id)`；本工程未迁移计数缓存，按子树现算） */
function docNodeCount(docId: any): number {
  let n = 0;
  const st = deps.state || {};
  const walk = (id: any): void => {
    const node = st.nodes && st.nodes[id];
    if (!node) return;
    n++;
    (node.children || []).forEach(walk);
  };
  try { walk(docId); } catch (e) { console.warn('[JU] caught error', e); }
  return n;
}

/**
 * 触发系统打印，并在**打印结束之后**才恢复内容区。
 *
 * 缺陷背景（桌面版「点了确认打印没反应 / 打出空白」）：
 *   旧实现是 `setTimeout(() => { window.print(); deps.forceRender(); }, 250)`。
 *   Chromium（含 Tauri 使用的 WebView2）的打印预览是独立窗口，`window.print()` 立即返回；
 *   紧接着同步执行的 `deps.forceRender()` 会把 `#content` 里刚渲染好的 `.print-preview`
 *   整块替换掉 —— 预览窗口随后渲染到的是被清空 / 换回正文的内容，于是「看起来什么都没发生」。
 *   浏览器里用 stub 统计 window.print 调用数时测不出这个问题（stub 不打开预览），
 *   只有真机才暴露，所以这是本轮桌面版专项修复。
 *
 * 修复口径：
 *   1. 监听 `beforeprint` / `afterprint`：afterprint 触发（打印对话框关闭）后再恢复；
 *   2. 兜底监听窗口重新获得焦点（部分 WebView2 版本不派发 afterprint）；
 *   3. 若 `window.print()` 后 1.2s 内连 `beforeprint` 都没收到，判定当前运行环境不支持
 *      系统打印，立即恢复内容并给出可执行提示（不让内容区长期停留在预览态）。
 */
function schedulePrint(): void {
  let restored = false;
  let printed = false;
  const onBefore = (): void => { printed = true; };
  const restore = (): void => {
    if (restored) return;
    restored = true;
    try { window.removeEventListener('afterprint', restore); } catch (e) { /* noop */ }
    try { window.removeEventListener('beforeprint', onBefore); } catch (e) { /* noop */ }
    try { window.removeEventListener('focus', onFocus); } catch (e) { /* noop */ }
    try { deps.forceRender(); } catch (e) { console.warn('[JU] print restore failed', e); }
  };
  const onFocus = (): void => { setTimeout(restore, 0); };
  try { window.addEventListener('beforeprint', onBefore); } catch (e) { /* noop */ }
  try { window.addEventListener('afterprint', restore); } catch (e) { /* noop */ }
  try { window.addEventListener('focus', onFocus); } catch (e) { /* noop */ }
  setTimeout(() => {
    try { window.print(); } catch (e) { console.warn('[JU] window.print failed', e); restore(); return; }
    setTimeout(() => {
      if (printed) return;
      window.removeEventListener('beforeprint', onBefore);
      restore();
      toast('当前环境未提供系统打印对话框，请改用「导出」后在浏览器中打印');
    }, 1200);
    /* 兜底：既不支持 afterprint / focus 也不派发 beforeprint 的极端环境，30s 后恢复 */
    setTimeout(restore, 30000);
  }, 250);
}

/** 打印预览（canonical 19319）：把当前文档渲染成 `.print-preview` 覆盖内容区。 */
export function showPrintPreview(): void {
  const doc = deps.getCurrentDoc();
  if (!doc) { toast('请先选择文档'); return; }
  const c = $('#content'); if (!c) return;
  c.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'print-preview';
  const h = document.createElement('h1'); h.textContent = stripHtml(doc.text) || '未命名'; wrap.appendChild(h);
  const metaCb: any = $('#printWithMeta');
  if (metaCb && metaCb.checked) {
    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:.8em;color:var(--fg-dim);margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--line-soft);';
    meta.innerHTML = `节点 ${docNodeCount(doc.id)} · 字数 ${deps.docWordCount(doc.id)} · 更新 ${new Date(doc.updatedAt).toLocaleString(APP_LOCALE)}`;
    wrap.appendChild(meta);
  }
  const render = (id: any, depth: number): void => {
    const n = deps.N(id);
    if (!n) return;
    if (n.id !== doc.id) {
      const item = document.createElement('div');
      item.className = 'node-print' + (n.done ? ' done' : '');
      item.style.paddingLeft = (depth * 20) + 'px';
      item.textContent = (n.done ? '✓ ' : '') + (stripHtml(n.text) || '(空)');
      wrap.appendChild(item);
    }
    const nd = n.id === doc.id ? 1 : depth + 1;
    (n.children || []).forEach((cid: any) => render(cid, nd));
  };
  (doc.children || []).forEach((cid: any) => render(cid, 1));
  c.appendChild(wrap);
}

/**
 * 确认打印（canonical 19347）。
 * 三模式：selection（仅选区）/ current（仅当前文档）/ all（全部文档，分批 20 个渲染防冻结）。
 */
export function doPrint(): void {
  const checked: any = document.querySelector('input[name="printMode"]:checked');
  const mode = (checked && checked.value) || 'all';
  const c = $('#content');
  if (!c) return;

  if (mode === 'selection') {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { toast('请先选中内容'); return; }
    const range = sel.getRangeAt(0);
    const frag = range.cloneContents();
    const tmp = document.createElement('div'); tmp.className = 'print-preview';
    const h = document.createElement('h1'); h.textContent = '选定内容';
    tmp.appendChild(h); tmp.appendChild(frag);
    c.innerHTML = ''; c.appendChild(tmp);
    toast('准备打印…');
    schedulePrint();
    return;
  }

  if (mode === 'all') {
    const wrap = document.createElement('div'); wrap.className = 'print-preview';
    const root = deps.N(deps.state && deps.state.rootId);
    const docs = ((root && root.children) || [])
      .map((cid: any) => deps.N(cid))
      .filter((n: any) => n && !n._isCalRoot && !n._isDbRoot && !n._isFolder && !n.dbRoot && !n._deleted);
    const metaCb: any = $('#printWithMeta');
    if (!docs.length) {
      const empty = document.createElement('div'); empty.textContent = '暂无可打印的文档'; wrap.appendChild(empty);
      c.innerHTML = ''; c.appendChild(wrap);
      toast('准备打印…');
      schedulePrint();
      return;
    }
    /* FIX-L-36 分批渲染：每批 20 个文档，避免数百文档同步建 DOM 冻结主线程 */
    const PRINT_BATCH = 20;
    let _di = 0;
    const finishBatch = (): void => {
      c.innerHTML = ''; c.appendChild(wrap);
      toast('准备打印…');
      schedulePrint();
    };
    const renderBatch = (): void => {
      const _end = Math.min(_di + PRINT_BATCH, docs.length);
      for (; _di < _end; _di++) {
        const doc = docs[_di];
        const h = document.createElement('h1'); h.textContent = stripHtml(doc.text) || '未命名'; wrap.appendChild(h);
        if (metaCb && metaCb.checked) {
          const meta = document.createElement('div');
          meta.style.cssText = 'font-size:.8em;color:var(--fg-dim);margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--line-soft);';
          meta.textContent = `节点 ${docNodeCount(doc.id)} · 字数 ${deps.docWordCount(doc.id)} · 更新 ${new Date(doc.updatedAt).toLocaleString(APP_LOCALE)}`;
          wrap.appendChild(meta);
        }
        const render = (id: any, depth: number): void => {
          const nn = deps.N(id);
          if (!nn) return;
          if (nn.id !== doc.id) {
            const item = document.createElement('div');
            item.className = 'node-print' + (nn.done ? ' done' : '');
            item.style.paddingLeft = (depth * 20) + 'px';
            item.textContent = (nn.done ? '✓ ' : '') + (stripHtml(nn.text) || '(空)');
            wrap.appendChild(item);
          }
          const nd = nn.id === doc.id ? 1 : depth + 1;
          (nn.children || []).forEach((cc: any) => render(cc, nd));
        };
        (doc.children || []).forEach((cc: any) => render(cc, 1));
      }
      if (_di < docs.length) { setTimeout(renderBatch, 0); return; }
      finishBatch();
    };
    renderBatch();
    return;
  }

  /* current（仅当前文档） */
  showPrintPreview();
  toast('准备打印…');
  schedulePrint();
}
