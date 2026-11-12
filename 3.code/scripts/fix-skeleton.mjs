#!/usr/bin/env node
/**
 * M07 · P0 批次 · 入口 HTML 静态 DOM 骨架恢复 / 校验（幂等）
 *
 * 背景（缺陷根因）：
 *   构建产物 JU-v2.1-Web.html 曾出现「顶栏无导航 / 左右侧栏空白 / 内容区仅剩占位 /
 *   时钟停滞 / 折叠三钮无效果」，根因是入口 index.html 的 <body> 静态骨架被简化，
 *   缺少 #tbNav 的 7 个 .tb-nav-btn、#sidebarLeft 的 #navBlock + 搜索框 + 5 个
 *   .sb-nav-item + 四棵子树 + #sbIntro + .sb-tools、#sidebarRight 的 6 个 .sr-section，
 *   以及 #settingsPanel / #remindPanel / #pomoTimer / #floatCal / #ctxMenu / #toast
 *   单例容器；模块侧 renderSidebar / bindSidebar / bindRightSidebar / bindTools /
 *   bindSettings 全部按固定 id 与类名查询 DOM，查询落空即 UI 渲染中断。
 *
 * 本脚本职责（真实文件操作，非口头声称）：
 *   1. 读取基线 6.P0-T3基线/v2.0-t3.html（只读，绝不写入 → 零字节改动）；
 *   2. 提取其 <body> 内除 <script> / <style> 之外的全部静态 HTML；
 *   3. 读取 m07-vite/index.html，逐项比对：
 *        - id 集合（基线 id ⊆ 入口 id）
 *        - 结构计数（.tb-nav-btn / .sb-nav-item / .sr-section / .sr-btn / .sr-edit-btn / .main-toggle）
 *        - 单例容器（settingsPanel / remindPanel / pomoTimer / floatCal / ctxMenu / toast）
 *        - <head> 是否误带基线大段 <style>（样式应由 src/main.ts 的 import './style.css' 负责）
 *        - 入口脚本是否为 <script type="module" src="/src/main.ts">
 *   4. 默认 dry-run：仅报告差异，不写文件；
 *      仅当显式传入 --write 且检出缺失/结构不符时，才用基线静态骨架整体替换入口 <body>
 *      （保留原有入口 script 标签路径），避免「合并遗漏」。
 *
 * 用法：
 *   node scripts/fix-skeleton.mjs            # 校验（dry-run，零写入）
 *   node scripts/fix-skeleton.mjs --write    # 检出差异时修复并写回
 * 退出码：0 = 骨架完整（或已修复）；1 = 校验失败且未写回；2 = 环境/路径异常
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const BASELINE = path.resolve(PROJECT, '..', 'v2.0-t3.html');
const TARGET = path.join(PROJECT, 'index.html');
const WRITE = process.argv.includes('--write');

/** 必须存在的单例容器（模块侧按 id 直接取用） */
const REQUIRED_UNIQUE_IDS = [
  'app', 'topbar', 'tbClock', 'tbNav',
  'sidebarLeft', 'sidebarRight', 'main', 'content',
  'navBlock', 'searchInput', 'subDb', 'subStarred', 'subDocs', 'subTags', 'sbIntro',
  'btnImport', 'btnTheme', 'btnMusic', 'btnFloatCal',
  'btnToggleLeft', 'btnToggleBoth', 'btnToggleRight',
  'settingsPanel', 'remindPanel', 'pomoTimer', 'floatCal', 'ctxMenu', 'toast',
];

/** 结构计数下限（类名出现次数） */
const REQUIRED_COUNTS = {
  'tb-nav-btn': 7,
  'sb-nav-item': 5,
  'sr-section': 6,
  'main-toggle': 3,
};

const log = (msg = '') => console.log('[fix-skeleton] ' + msg);

/**
 * 从 HTML 中提取 <body> 内的静态标记，剔除 <script> 与 <style> 块。
 * 基线是单文件产品件（脚本内联在 body 末尾），入口只允许保留一个 module 入口脚本。
 */
function extractStaticBody(html) {
  /* 先剥 HTML 注释：入口 <head> 的说明注释里含字面量 `<body>`，
     否则正则会从注释处起匹配，导致静态骨架被误判为「几乎为空」。 */
  const noComment = html.replace(/<!--[\s\S]*?-->/g, '');
  const m = noComment.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!m) throw new Error('<body> 未找到');
  return m[1]
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .trim();
}

/** 收集 id 属性值（去重排序） */
function collectIds(html) {
  return [...new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]))].sort();
}

/** 统计某个类名在 class="..." 中的出现次数 */
function countClass(html, cls) {
  return (html.match(new RegExp(`class="[^"]*\\b${cls}\\b`, 'g')) || []).length;
}

function fail(msg) {
  log('✗ ' + msg);
  process.exit(2);
}

if (!fs.existsSync(BASELINE)) fail('基线文件缺失：' + BASELINE);
if (!fs.existsSync(TARGET)) fail('入口文件缺失：' + TARGET);

const baselineRaw = fs.readFileSync(BASELINE, 'utf8');
const baselineBytes = Buffer.byteLength(baselineRaw);
const baselineBody = extractStaticBody(baselineRaw);
const targetRaw = fs.readFileSync(TARGET, 'utf8');
const targetBytes = Buffer.byteLength(targetRaw);

const targetBody = extractStaticBody(targetRaw);
const baselineIds = collectIds(baselineBody);
const targetIds = collectIds(targetBody);
const missingIds = baselineIds.filter((id) => !targetIds.includes(id));
const missingRequired = REQUIRED_UNIQUE_IDS.filter((id) => !targetIds.includes(id));

log(`基线    ${BASELINE}  (${baselineBytes} bytes, 静态 body ${baselineBody.length} chars, ids=${baselineIds.length})`);
log(`入口    ${TARGET}  (${targetBytes} bytes, 静态 body ${targetBody.length} chars, ids=${targetIds.length})`);

let problems = 0;

/* 1) 单例容器 */
if (missingRequired.length) {
  problems++;
  log('✗ 缺少必需容器：' + missingRequired.join(', '));
} else {
  log(`✓ 必需容器齐备 ${REQUIRED_UNIQUE_IDS.length}/${REQUIRED_UNIQUE_IDS.length}`);
}

/* 2) 基线 id 覆盖度（入口可以少掉基线脚本专用的装饰 id，但结构区不得缺） */
if (missingIds.length) {
  problems++;
  log(`✗ 基线 id 未覆盖 ${missingIds.length} 项：` + missingIds.join(', '));
} else {
  log(`✓ 基线 id 全部覆盖 ${baselineIds.length}/${baselineIds.length}`);
}

/* 3) 结构计数 */
for (const [cls, min] of Object.entries(REQUIRED_COUNTS)) {
  const n = countClass(targetBody, cls);
  if (n < min) {
    problems++;
    log(`✗ .${cls} 计数 ${n} < 期望 ${min}`);
  } else {
    log(`✓ .${cls} 计数 ${n} ≥ ${min}`);
  }
}

/* 4) <head> 不得内联基线大段样式 */
const headStyleCount = (targetRaw.match(/<style\b/gi) || []).length;
if (headStyleCount > 0) {
  problems++;
  log(`✗ 入口含 <style> ${headStyleCount} 处（样式应由 src/main.ts 的 import './style.css' 提供）`);
} else {
  log('✓ 入口无内联 <style>（样式交由 Vite 打包）');
}

/* 5) 入口脚本 */
const entryOk = /<script\s+type="module"\s+src="\/src\/main\.ts"><\/script>/.test(targetRaw);
if (!entryOk) {
  problems++;
  log('✗ 入口脚本不是 <script type="module" src="/src/main.ts"></script>');
} else {
  log('✓ 入口脚本 /src/main.ts 存在');
}

/* 6) 基线可选：比对静态 body 是否逐字一致（提示性，不单独判失败） */
const normalize = (s) => s.replace(/\s+/g, ' ').trim();
const verbatim = normalize(baselineBody) === normalize(targetBody);
log(verbatim ? '✓ 静态 body 与基线逐字等价（规范化空白后）' : '· 静态 body 与基线存在差异（允许：注释/格式/顺序微调）');

if (problems === 0) {
  log('RESULT: PASS · 骨架完整，无需写回（零写入）');
  process.exit(0);
}

log(`RESULT: FAIL · 检出 ${problems} 类问题`);
if (!WRITE) {
  log('未传 --write，保持文件不变。');
  process.exit(1);
}

/* 写回：整体替换 <body> 内容 = 基线静态骨架 + 原入口脚本 */
const entryMatch = targetRaw.match(/<script\s+type="module"\s+src="([^"]+)"><\/script>/);
const entrySrc = entryMatch ? entryMatch[1] : '/src/main.ts';
const headMatch = targetRaw.match(/[\s\S]*?<\/head>/i);
if (!headMatch) fail('入口 <head> 未找到');
const head = headMatch[0];
const next = `${head}\n  <body>\n\n${baselineBody}\n    <script type="module" src="${entrySrc}"></script>\n  </body>\n</html>\n`;
fs.writeFileSync(TARGET, next, 'utf8');
log(`已写回 ${TARGET}（${Buffer.byteLength(next)} bytes，入口脚本 ${entrySrc}）`);
log('RESULT: FIXED · 请重新执行本脚本复核（期望 PASS）');
process.exit(0);
