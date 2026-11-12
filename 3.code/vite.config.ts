import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * dist 内嵌范围闸门（D-05b）
 *
 * 历史（已废止的补丁）：发布归档原先写在 `dist/release/`，而 Tauri v1 按
 * `tauri.conf.json.build.distDir = ../dist` **递归内嵌整个 dist**，于是 `tauri build`
 * 会把上一轮的 `JU-v2.1-Web.html` + 上一轮 exe 一起打进新 exe（10.4 MB → 18.9 MB，
 * 且内嵌两份 HTML）。当时的补丁是「构建前把 dist/release 搬到 node_modules/.cache，
 * 构建后再搬回」—— 只是躲过一次构建，归档仍在 dist 内，直接 `npm run tauri build`
 * 依旧复发。
 *
 * 现行做法：归档目录迁到仓库级 `8.发布与CI/release/<版本>/`（见 scripts/release-paths.mjs），
 * `dist/` 只产出 `index.html`。本插件只做两件事，不再搬回任何东西：
 *   ① `buildStart`：若发现历史遗留的 `dist/release`，搬到 `node_modules/.cache/ju-legacy-dist-release`
 *      （只搬不删，且**绝不搬回 dist** —— 搬回就会被重新内嵌）；
 *   ② `closeBundle`：核对 `dist/` 只有一份 index.html 且无子目录，否则告警（硬闸门在
 *      `scripts/build-all.mjs`，此处保证「裸跑 vite build」也能被看见）。
 */
function guardDistSingleHtml(): Plugin {
  let outDirAbs = '';
  let legacyReleaseAbs = '';
  let legacyBackupAbs = '';

  return {
    name: 'ju-guard-dist-single-html',
    apply: 'build',
    configResolved(config: ResolvedConfig) {
      outDirAbs = path.resolve(config.root, config.build.outDir);
      legacyReleaseAbs = path.join(outDirAbs, 'release');
      legacyBackupAbs = path.join(config.root, 'node_modules', '.cache', 'ju-legacy-dist-release');
    },
    /* emptyOutDir 的清空发生在写入阶段（buildStart 之后），此处搬离是安全的 */
    buildStart() {
      try {
        if (!legacyReleaseAbs || !fs.existsSync(legacyReleaseAbs)) return;
        fs.mkdirSync(path.dirname(legacyBackupAbs), { recursive: true });
        fs.rmSync(legacyBackupAbs, { recursive: true, force: true });
        fs.renameSync(legacyReleaseAbs, legacyBackupAbs);
        console.warn('[ju-guard-dist] ! 发现历史遗留 dist/release，已搬离 dist（备份：' + legacyBackupAbs + '）');
        console.warn('[ju-guard-dist]   发布归档位置已改为 8.发布与CI/release/<版本>/（scripts/release-paths.mjs）');
      } catch (e) {
        console.warn('[ju-guard-dist] 历史 dist/release 搬离失败：' + String((e as Error).message || e));
      }
    },
    closeBundle() {
      try {
        if (!outDirAbs || !fs.existsSync(outDirAbs)) return;
        const entries = fs.readdirSync(outDirAbs, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
        const html = entries.filter((e) => e.isFile() && /\.html?$/i.test(e.name)).map((e) => e.name);
        if (dirs.length || html.length !== 1 || html[0] !== 'index.html') {
          console.warn('[ju-guard-dist] ! dist 产物不符合「单 HTML」约束：'
            + 'html=[' + html.join(', ') + '] dirs=[' + dirs.join(', ') + ']');
          console.warn('[ju-guard-dist]   子目录 / 额外 HTML 会被 Tauri 递归内嵌进 exe（参见 D-05b）');
        }
      } catch (e) {
        console.warn('[ju-guard-dist] dist 产物核对跳过：' + String((e as Error).message || e));
      }
    },
  };
}

/**
 * M1-1 最终目标 · 单 HTML 产物
 *
 * 产物约束：`vite build` 只产出 `dist/index.html`（JS/CSS/图片全部内联）。
 *   - `viteSingleFile()`：把入口 `<script type="module">` 与样式内联进 HTML，并删除外链 chunk。
 *   - `assetsInlineLimit`：极大阈值，确保任何资源都走 data URI 内联而非单独文件。
 *   - `cssCodeSplit=false`：样式合并进单一产物，不额外拆 CSS 文件。
 *   - `chunkSizeWarningLimit`：单文件本身体积大，忽略 chunk 体积告警（非质量信号）。
 *
 * public/ 处理：
 *   dev（serve）保留 public/ 直出；`vite build` 默认不拷贝 public/，以保证 dist 只有 index.html。
 *   需要 public 直通拷贝的构建（如 benchmark-30k 依赖 dist/30k-fixture.json）显式设置
 *   `JU_KEEP_PUBLIC=1`。零漂移闸门 `scripts/check-parity.mjs` 直接读磁盘上的
 *   `public/v2.0-t3.html`，不依赖构建拷贝，故不受影响。
 */
export default defineConfig(({ command }) => ({
  root: '.',
  publicDir: command === 'serve' || process.env.JU_KEEP_PUBLIC ? 'public' : false,
  plugins: [viteSingleFile(), guardDistSingleHtml()],
  /**
   * M5-2 · Worker 构建支持
   *
   * `format: 'es'`：字数统计 Worker（`src/core/wordcount.worker.ts`，`new Worker(new URL(...), { type: 'module' })`）
   * 以 ES module 形式打包。构建期 Vite 会把它作为独立 chunk 产出；本工程的
   * `viteSingleFile` 负责把入口脚本内联进 `dist/index.html`，Worker 产物保留为同目录相对文件
   * （`import.meta.url` 解析，dev / preview / Tauri 三种承载方式一致）。
   */
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 5000,
    cssCodeSplit: false,
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  server: {
    /* ISSUE-009 · 开发端口统一到 5173：
       tauri.conf.json build.devPath / playwright.config.ts baseURL 均以 5173 为准，
       strictPort 保证端口被占用时立即失败，而不是悄悄漂到 5174 让 Tauri / E2E 连不上。 */
    port: 5173,
    strictPort: true,
    fs: {
      strict: false,
    },
  },
}));
