/**
 * M1-1 · 批次 AB · 演示视图（只读 · 大纲对齐）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - treeRowVisible ..................................................... 15352-15356
 *   - renderPresentation ................................................. 15357-15393
 *
 * 约束：DOM 结构、类名（pres-page / pres-list / pres-item / pres-l1..l3）、
 *   内联缩进口径（depth>3 ⇒ 48+(depth-3)*16 px）、FIX-L-09 注释、Wiki 链接点击行为逐字保留。
 *   未拆分业务符号统一走 `deps` 依赖注入容器（原直接引用改为 `deps.xxx`），由 src/main.ts 装配：
 *     state / N / renderDocHeaderInline / _vsShouldUse / _renderPresentationVirtual /
 *     linkTitleAtPoint / navigateToWikiLink。
 *   已拆分模块直接 import：esc / stripHtml（core/utils）；linkTitleAtPoint / navigateToWikiLink
 *     （ui/rightbar，同时作为 deps 默认实现，保证未显式注入时行为不降级）。
 */
import { stripHtml, esc } from '../core/utils';
import { linkTitleAtPoint, navigateToWikiLink } from '../ui/rightbar';

/** 演示视图依赖注入容器（承接原同作用域内、尚未拆分到模块的既有业务实现）。 */
export interface PresentationDeps {
  /** 全局数据状态（对应产品的 `state`，端口对齐用） */
  state: any;
  /** 节点取用（对应产品的 `N(id)`） */
  N: (id: any) => any;
  /** 文档内联标题（对应产品的 `renderDocHeaderInline(doc)`） */
  renderDocHeaderInline: (doc: any) => HTMLElement;
  /** 虚拟滚动启用判定（对应产品的 `_vsShouldUse(doc)`，L12-W3 · H1/H3） */
  _vsShouldUse: (doc: any) => boolean;
  /** 演示视图窗口化渲染（对应产品的 `_renderPresentationVirtual(wrap,doc)`） */
  _renderPresentationVirtual: (wrap: HTMLElement, doc: any) => void;
  /** 命中位置处的 Wiki 链接标题（对应产品的 `linkTitleAtPoint(item,e)`） */
  linkTitleAtPoint: (el: HTMLElement, e: MouseEvent) => string | null;
  /** Wiki 链接跳转（对应产品的 `navigateToWikiLink(lt,item)`） */
  navigateToWikiLink: (title: any, from: any) => void;
}

/** 依赖注入容器（模块内安全占位；linkTitleAtPoint / navigateToWikiLink 默认为真实实现）。 */
export const deps: PresentationDeps = {
  state: { nodes: {}, rootId: null },
  N: () => null,
  renderDocHeaderInline: () => document.createElement('div'),
  _vsShouldUse: () => false,
  _renderPresentationVirtual: () => undefined,
  linkTitleAtPoint,
  navigateToWikiLink,
};

/** 注入/覆盖依赖实现（局部覆盖，未提供的键保持默认）。 */
export function injectPresentationDeps(next: Partial<PresentationDeps>): void {
  Object.assign(deps, next);
}

/* ============================================================
   演示视图
   ============================================================ */
/* FIX-L-09 树/演示视图共用的行可见性谓词：与大纲视图 script_1.js renderOutlineRow 对齐——
   大纲对每个存在的 child 都渲染成可编辑行（空文本叶子也成行），不过滤 isBlankNode。
   演示视图原先用 !isBlankNode(n) 过滤掉空叶子，两视图空节点呈现不一致；
   取向：保持大纲不变，演示向大纲对齐（最小用户可见变化——不改大纲编辑面）。 */
export function treeRowVisible(n: any): boolean { return !!n && !n._deleted; }
export function renderPresentation(doc: any): HTMLElement {
  if (!doc) { const w = document.createElement('div'); w.className = 'empty-state'; w.textContent = '请先选择文档'; return w; }
  const wrap = document.createElement('div'); wrap.className = 'pres-page';
  const hdr = deps.renderDocHeaderInline(doc);
  /* 【fix26-p3】无星级时补 .doc-header-stars 占位：标题行结构与大纲（含星标列）一致，右侧网格列恒被占位撑开 */
  if (!hdr.querySelector('.doc-header-stars')) { const st = document.createElement('span'); st.className = 'doc-header-stars'; hdr.appendChild(st); }
  wrap.appendChild(hdr);
  const list = document.createElement('div'); list.className = 'pres-list';
  function render(id: any, depth: number): void {
    const n = deps.N(id); if (!n) return;
    if (id !== doc.id && treeRowVisible(n)) { /* FIX-L-09 统一空节点判定：不再单独用 isBlankNode 过滤空叶子，与大纲视图一致 */
      const lvl = Math.min(depth, 3);
      const item = document.createElement('div');
      item.className = 'pres-item pres-l' + lvl;
      if (depth > 3) item.style.paddingLeft = (48 + (depth - 3) * 16) + 'px';
      item.innerHTML = (n.done ? '✓ ' : '') + esc(stripHtml(n.text || ''));
      /* Wiki 链接跳转：单击 [[链接]] 即跳转（演示视图为只读） */
      item.onclick = e => {
        const lt = deps.linkTitleAtPoint(item, e);
        if (lt) { e.preventDefault(); deps.navigateToWikiLink(lt, item); }
      };
      list.appendChild(item);
    }
    const nd = id === doc.id ? 1 : depth + 1;
    n.children.forEach((c: any) => render(c, nd));
  }
  if (!doc.children.length) {
    const e = document.createElement('div'); e.className = 'empty-state';
    e.textContent = '该文档暂无内容';
    wrap.appendChild(e); return wrap;
  }
  if (deps._vsShouldUse(doc)) { /* 【L12-W3 · H1/H3】演示视图窗口化渲染（只读视图优先，LO-2=A） */
    wrap.appendChild(list);
    deps._renderPresentationVirtual(wrap, doc);
    return wrap;
  }
  doc.children.forEach((c: any) => render(c, 1));
  wrap.appendChild(list);
  return wrap;
}
