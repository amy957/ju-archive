/**
 * M0-7 · legacy 脚本按序注入器（本批次仅接口 + 占位实现）
 *
 * TODO(批次 C): 模块边界与 TDZ / 函数提升 / 全局可见性约束见
 *   docs/module-boundaries.md（按 6 个产品 script 块逐块列出的跨块引用边），
 *   M1-1 拆分时由该文档驱动执行顺序，本函数只负责「按数组顺序串行注入并等待 onload」。
 */

/** 按给定顺序串行注入 <script>，全部 onload 后 resolve；任一失败即 reject。 */
export function loadLegacy(urls: string[]): Promise<void> {
  let chain: Promise<void> = Promise.resolve();
  for (const url of urls) {
    chain = chain.then(() => injectOne(url));
  }
  return chain;
}

function injectOne(url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = url;
    el.async = false;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('legacy load failed: ' + url));
    document.head.appendChild(el);
  });
}
