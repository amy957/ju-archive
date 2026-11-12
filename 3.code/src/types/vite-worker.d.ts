/**
 * M5-2 · Vite Worker 后缀模块类型声明
 *
 * `import Ctor from './xxx.worker?worker&inline'`：Vite 把 Worker 打成**内联**（base64 blob）构造器，
 * 不产出独立 chunk 文件 —— 这是本工程「单 HTML 产物」约束（`dist/` 只允许 `index.html`）的硬要求。
 *
 * 本工程 tsconfig 的 `types` 只列了 node / @playwright/test（未引 `vite/client`），
 * 故在此显式声明用到的两个 worker 后缀形态。
 */

declare module '*?worker&inline' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module '*?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
