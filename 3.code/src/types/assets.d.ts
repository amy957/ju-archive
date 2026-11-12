/**
 * P0 · 静态资源模块声明（样式入口）
 *
 * `src/main.ts` 以副作用方式 `import './style.css'`，由 Vite 负责编译与内联；
 * tsconfig 未启用 `vite/client` 类型，故在此显式声明 `*.css` 模块，保证 `tsc --noEmit` 零报错。
 * 说明：本声明为纯类型层，运行期零差异（构建期由 Vite 处理，不产生任何 JS 导入）。
 */
declare module '*.css' {
  const css: string;
  export default css;
}

/**
 * M07 · 音频资源声明（core/audio.ts 的默认导入）
 *
 * 本工程 `assetsInlineLimit = 100000000`，Vite 会把 `src/assets/*.mp3` 内联成 data URI，
 * 默认导入即得到可直接喂给 `new Audio(src)` 的字符串；此处仅为 `tsc --noEmit` 补类型，
 * 运行期零差异（构建期由 Vite 处理）。
 */
declare module '*.mp3' {
  const url: string;
  export default url;
}
