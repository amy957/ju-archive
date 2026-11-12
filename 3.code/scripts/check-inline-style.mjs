/**
 * P0 · 构建产物样式内联自检（真实读盘断言，非口头声称）
 *
 * 背景：`dist/index.html` 曾完全不含产品样式（迁移时 112KB `<style>` 块未随迁），
 *   导致 exe / 单 HTML 启动后无样式、空白，仅剩「请先选择文档」。本脚本是 P0 的机器闸门。
 *
 * 断言（任一不满足即 exit 1）：
 *   1) dist/index.html 存在；
 *   2) 含 `<style` 标签；
 *   3) 含样式标记 `--bg`（主题变量）与 `body{`（基础排版）；
 *   4) 含产品关键类/ID 规则：`#sidebarLeft`、`.sb-row`、`.main-toggle`、`.tb-wbtn`；
 *   5) 不再有外链样式 `<link rel="stylesheet"`（单文件约束）；
 *   6) 源码 `index.html` 不含内联 `style="…"`（ISSUE-010 严格 CSP 前置；产物内运行期模板的
 *      内联样式单独计数输出，暂不做硬门禁）。
 * 附加信息：字节数、`<style>` 块数量、内联 CSS 字符数、内联 style 属性计数。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '..', 'dist', 'index.html');
const srcHtml = path.resolve(here, '..', 'index.html');
const srcCss = path.resolve(here, '..', 'src', 'style.css');

/* ISSUE-006：token 化产出可度量 —— hex 字面量 / `!important` 计数与软阈值 */
const HEX_LIMIT = 130;
const BANG_LIMIT = 72;
const THRESHOLD_MODE = 'hard'; // hard：超阈值计入 failed 并 Exit 1
const cssText = fs.readFileSync(srcCss, 'utf8');
const hexCount = (cssText.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
const hexNoComment = (cssText.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
const bangCount = (cssText.match(/!important/g) || []).length;

/* 干净检出（CI）无 dist：本闸门校验的是构建产物，只能在 vite build 之后跑。
   CI 未构建时按 --ci-mode / GITHUB_ACTIONS 降级跳过，不得把「没有产物」误判成「样式缺失」。 */
const ciMode = process.argv.includes('--ci-mode') || process.env.GITHUB_ACTIONS === 'true';
if (!fs.existsSync(dist)) {
  if (ciMode) {
    console.log('[inline-style] SKIP ci-mode：干净检出无 dist/index.html，产物样式由本地 build-all 在构建后判定');
    process.exit(0);
  }
  console.error(`FAIL: 产物不存在 -> ${dist}`);
  process.exit(1);
}

const html = fs.readFileSync(dist, 'utf8');
const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
const cssLen = styles.reduce((n, s) => n + s.length, 0);
const distStyleAttr = (html.match(/\sstyle=/gi) || []).length;
const srcStyleAttr = (fs.readFileSync(srcHtml, 'utf8').match(/\sstyle=/gi) || []).length;

const checks = [
  ['has <style tag', /<style\b/i.test(html)],
  ['has --bg variable', html.includes('--bg')],
  ['has body{ rule', /body\s*\{/.test(html)],
  ['has #sidebarLeft rule', html.includes('#sidebarLeft')],
  ['has .sb-row rule', html.includes('.sb-row')],
  ['has .main-toggle rule', html.includes('.main-toggle')],
  ['has .tb-wbtn rule', html.includes('.tb-wbtn')],
  ['no external stylesheet link', !/<link\b[^>]*rel=["']?stylesheet/i.test(html)],
  ['no inline style attribute in index.html', srcStyleAttr === 0],
];

console.log(`dist/index.html bytes = ${Buffer.byteLength(html, 'utf8')}`);
console.log(`<style> blocks = ${styles.length} (inline css chars = ${cssLen})`);
console.log(`index.html inline style attrs = ${srcStyleAttr}`);
console.log(`dist inline style attrs = ${distStyleAttr}（运行期模板，仅记录，不参与硬门禁）`);
console.log(`src/style.css hex = ${hexCount}（去注释 ${hexNoComment}），阈值 ≤ ${HEX_LIMIT} → ${hexCount > HEX_LIMIT ? `FAIL hex ${hexCount} > ${HEX_LIMIT}` : 'PASS'} [${THRESHOLD_MODE}]`);
console.log(`src/style.css !important = ${bangCount}，阈值 ≤ ${BANG_LIMIT} → ${bangCount > BANG_LIMIT ? `FAIL !important ${bangCount} > ${BANG_LIMIT}` : 'PASS'} [${THRESHOLD_MODE}]`);

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}

if (THRESHOLD_MODE === 'hard' && (hexCount > HEX_LIMIT || bangCount > BANG_LIMIT)) failed += 1;

if (failed) {
  console.error(`P0 FAILED: ${failed} check(s) not satisfied`);
  process.exit(1);
}
console.log('P0 PASS: 样式已内联进单文件产物');
