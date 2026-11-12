/**
 * P1/P2 · 依赖注入空壳闸门（源码级真实断言）
 *
 * 背景：M1-1 迁移期把会话级函数以 `noop` / `() => null` 空壳注入各 deps 容器，
 *   导致 renderMain 视图恒 null（`#content` 只剩「请先选择文档」）、侧栏四棵子树全空。
 * 本脚本对 src/main.ts 的**装配块**逐项断言：关键依赖键必须绑定到真实函数引用
 *   （不得是 `noop` / `() => null` / `() => {}` / `() => undefined`）。
 *   并对 isDesktop / desktopInvoke / desktopSave 追加「不得为恒值」断言
 *   （false / true / null / Promise.resolve(null) 等），防止桌面态恒 false 回归（fix32-15/O-5）。
 *   fix33-6/ISSUE-006：desktopSave 另查函数体——须含 `_tauri()` / `.invoke` 能力检查，
 *   且不得为 `desktopInvoke(...); return true;` 的无判真形态（只看装配键值会漏检）。
 *
 * 说明：各模块内部的 `deps` 默认值仍是空壳（模块安全兜底，产品同款设计），
 *   本闸门只检查「入口装配点」，因为运行期生效的是最后一次注入。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mainPath = path.resolve(here, '..', 'src', 'main.ts');
const src = fs.readFileSync(mainPath, 'utf8');

/**
 * 取出 `callName({ ... })` 的全部实参对象文本（花括号配平）。
 *
 * 需要遍历全部出现并**合并**判定，原因有二：
 *   1) 源码注释 / JSDoc 中也常出现 `xxx({...})` 字样（例如 `injectBootDeps({ JU })` 的说明文字）；
 *   2) 同一容器可能被多次注入（如 bindRightbarDeps 先在导出段、后在格式刷段），
 *      运行期由 Object.assign 合并生效，故闸门也按合并后的视角判定。
 */
function blocksOf(callName) {
  const out = [];
  let from = 0;
  for (;;) {
    const idx = src.indexOf(callName + '({', from);
    if (idx < 0) break;
    from = idx + callName.length + 2;
    const open = src.indexOf('{', idx);
    let depth = 0;
    let end = -1;
    for (let i = open; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end >= 0) out.push(src.slice(open, end + 1));
  }
  return out;
}

/** fix33-6 · ISSUE-006：提取 `async function desktopSave(...) { ... }` 的函数体（配平到顶层 `}`）。 */
function desktopSaveBody() {
  const head = /\basync\s+function\s+desktopSave\s*\([^)]*\)[^{]*\{/.exec(src);
  if (!head) return null;
  const open = head.index + head[0].length - 1;
  for (let i = open, depth = 0; i < src.length; i++) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}' && (depth -= 1) === 0) return src.slice(open + 1, i);
  }
  return null;
}
/** 能力检查：`_tauri()` 或桥接的 `.invoke`（`desktopInvoke` 本身不算） */
const SAVE_CAP_RE = /_tauri\s*\(|\.invoke\b/;
/** 无判真形态：`desktopInvoke(...); return true;`（无 try/catch 兜底即恒真放行） */
const SAVE_BLIND_RE = /desktopInvoke\s*\([^;]*\)\s*;\s*return\s+true\s*;/;

/** 取对象文本里某个键的值（顶层直接子键；支持简写与跨行） */
function valueOfKey(block, key) {
  /* 注释行不算装配键（review14-03/09：注释掉 desktopInvoke 必须判缺失） */
  const code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const re = new RegExp(`(^|[\\s,{])${key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*(:([^\\n]*))?`);
  const m = re.exec(code);
  if (!m) return null;
  if (m[2] === undefined) return { shorthand: true, value: key };
  return { shorthand: false, value: (m[3] || '').trim() };
}

const STUB_PATTERNS = [/^noop$/, /^\(\)\s*=>\s*null$/, /^\(\)\s*=>\s*\{\s*\}$/, /^\(\)\s*=>\s*undefined$/, /^\(\)\s*=>\s*0$/];
/** 恒值实现（值捕获含行尾逗号，故统一允许可选的末尾逗号） */
const CONST_STUB_PATTERNS = [
  /^\(\s*\)\s*=>\s*(false|true|null|undefined|0)\s*,?$/,
  /^\(\s*\)\s*=>\s*!!\s*(false|true)\s*,?$/,
  /^\(\s*\)\s*=>\s*Boolean\(\s*(false|true)\s*\)\s*,?$/,
  /^\(\s*\)\s*=>\s*Promise\.resolve\(\s*(null|false|undefined|0)\s*\)\s*,?$/,
];
/** 这些键不得为恒值：恒 false / 恒 true / 恒 null 即「通道被钉死」 */
const CONST_KEYS = new Set(['isDesktop', 'desktopInvoke', 'desktopSave']);

const SPEC = [
  ['bindLayoutDeps', ['setForceRender', 'saveUI', 'renderMain', 'getCurrentDoc', 'viewOf']],
  ['bindThemeDeps', ['saveUI', 'forceRender']],
  ['bindSelectionDeps', ['getCurrentDoc', 'viewOf', 'forceRender']],
  ['bindSidebarDeps', ['state', 'N', 'isFolder', 'sortDocs', 'commit', 'nowSeq', 'getCurrentDoc', 'openNode', 'safeNavigate', 'setActiveKey', 'showTreeContext', 'getNodeSvg', 'forceRender', 'saveUI', 'buildTagIndex', 'getTagColor', 'openTag']],
  ['bindRightbarDeps', ['getCurrentDoc', 'openNode', 'forceRender', 'commit']],
  ['bindRenderMainDeps', ['N', 'viewOf', 'getCurrentDoc', 'setForceRender', 'syncTopbar', 'renderIntro', 'renderSidebar', 'renderFolderGrid']],
  ['injectBootDeps', ['bindSidebar', 'bindTools', 'initJuDnd', 'initJuModules', 'saveUI', 'forceRender', 'setActiveKey', 'viewOf', 'PENDING_SYNC_KEY', 'flushPendingSession', 'flushPendingLogs', 'getLogTimers', 'loadAutoBackup', 'desktopInvoke']],
  ['bindErrorDeps', ['ui', 'getState', 'isDesktop', 'desktopInvoke', 'JU_VER']],
  ['bindPersistDeps', ['ui', 'getCalendarRootId', 'toast', 'dedupCalRoots', 'isDesktop', 'desktopSave', 'dsLoadState']],
  ['bindCryptoDeps', ['toast', 'getUi', 'defaultState', 'appConfirm', 'mountModal', 'unmountModal', 'isTopModal', 'syncAppInert', 'isDesktop', 'desktopInvoke']],
];

let failed = 0;
let checked = 0;

for (const [callName, keys] of SPEC) {
  const calls = blocksOf(callName);
  if (!calls.length) {
    console.log(`FAIL  ${callName}: 未在 src/main.ts 找到装配调用`);
    failed += 1;
    continue;
  }
  /* 运行期 Object.assign 合并生效：按「全部装配块合并」的视角判定 */
  const block = calls.join('\n');
  const blockWithStubs = calls.filter((b) => keys.some((k) => {
    const hit = valueOfKey(b, k);
    return !hit || STUB_PATTERNS.some((p) => p.test((hit.value || '').replace(/\s+/g, ' ').trim()));
  }));
  void blockWithStubs;
  const bad = [];
  for (const key of keys) {
    const hit = valueOfKey(block, key);
    checked += 1;
    if (!hit) { bad.push(`${key}: 缺失（未注入）`); continue; }
    const v = hit.value.replace(/\s+/g, ' ').trim();
    if (STUB_PATTERNS.some((p) => p.test(v))) bad.push(`${key}: 仍为空壳 -> ${v}`);
    /* 简写或带空格的空箭头也拦（例如 `() => { }` / `() => {}`） */
    if (/^\(\s*\)\s*=>\s*\{\s*\}$/.test(v)) bad.push(`${key}: 仍为空壳 -> ${v}`);
    /* 桌面通道不得为恒值：`() => false` / `() => Promise.resolve(null)` 等 */
    if (CONST_KEYS.has(key) && CONST_STUB_PATTERNS.some((p) => p.test(v))) bad.push(`${key}: 恒值空壳（通道被钉死）-> ${v}`);
  }
  if (bad.length) {
    console.log(`FAIL  ${callName}:`);
    bad.forEach((b) => console.log(`        - ${b}`));
    failed += bad.length;
  } else {
    console.log(`PASS  ${callName}: ${keys.length} 个关键依赖均为真实实现`);
  }
}

/* fix43-4 · ISSUE-004 / fixr6-5 · ISSUE-005：isDesktop 必须同源（四个容器同一标识符；boot 运行期态键为 detectDesktop） */
const ISD_CONTAINERS = ['bindErrorDeps', 'bindCryptoDeps', 'bindPersistDeps', 'injectBootDeps'];
const ISD_KEY_OF = { injectBootDeps: 'detectDesktop' };
const isdRows = ISD_CONTAINERS.map((name) => {
  const hit = valueOfKey(blocksOf(name).join('\n'), ISD_KEY_OF[name] || 'isDesktop');
  return `${name}=${hit ? hit.value.replace(/[\s,]+$/, '') : '缺失'}`;
});
checked += 1;
const isdVals = [...new Set(isdRows.map((r) => r.slice(r.indexOf('=') + 1)))];
if (isdVals.length === 1) console.log(`isDesktop 同源: ${isdVals[0]}`);
else { console.log(`FAIL  isDesktop 口径不一致: ${isdRows.join(' | ')}`); failed += 1; }

/* review14-03/09 · ISSUE-003 + review15-10/13 · ISSUE-010：关闭加密读端必须真实 await 原子命令（缺 await 即 fail-open） */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const bootCode = stripComments(fs.readFileSync(path.resolve(here, '..', 'src', 'app', 'boot.ts'), 'utf8'));
const cryptoCode = stripComments(fs.readFileSync(path.resolve(here, '..', 'src', 'core', 'crypto.ts'), 'utf8'));
let closeBad = 0;
/* crypto.ts：清空加密库必须 await clear_encrypted */
if (!(cryptoCode.includes('clear_encrypted') && /await\s+[^\n;]*clear_encrypted/.test(cryptoCode))) {
  console.log('FAIL  crypto.ts: clear_encrypted 缺 await 读端（关闭加密 fail-open）'); closeBad += 1;
}
/* boot.ts：关闭加密分支必须含 load_state 复核 + 桥接不可用失败提示，且原子命令先于成功提示 */
const bootTokens = [['load_state 复核', /load_state/.test(bootCode)], ['桥接不可用失败提示', /桥接不可用/.test(bootCode)], ['复核失败不回滚', !/catch\s*\([^)]*\)\s*\{\s*hasEnc\s*=\s*true/.test(bootCode)]];
const successAt = bootCode.lastIndexOf("toast('已关闭加密')");
const atomicAt = Math.max(bootCode.lastIndexOf('save_plain_and_clear'), bootCode.lastIndexOf('clear_encrypted'));
const atomicAwait = /await\s+[^\n;]*(save_plain_and_clear|clear_encrypted)/.test(bootCode);
for (const [name, ok] of bootTokens) {
  if (!ok) {
    if (name === '复核失败不回滚') console.log('FAIL  boot.ts: 复核失败不回滚（load_state 失败仍回滚已提交明文）');
    else console.log(`FAIL  boot.ts: 关闭加密缺 ${name}（桥接缺失仍提示成功）`);
    closeBad += 1;
  }
}
if (!(successAt >= 0 && atomicAwait && atomicAt >= 0 && atomicAt < successAt)) {
  console.log('FAIL  boot.ts: 原子写/clear 未先于 toast(已关闭加密)（跳过写盘仍提示成功）'); closeBad += 1;
}
const bootWired = /(^|[\s,{])desktopInvoke\s*,/.test(blocksOf('injectBootDeps').join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1'));
if (!bootWired) console.log('FAIL  injectBootDeps: desktopInvoke 未装配（桌面桥接注入缺失）');
failed += closeBad + (bootWired ? 0 : 1);
if (!closeBad && bootWired) console.log('PASS  关闭加密读端: OK (boot.ts load_state 复核 + 桥接不可用提示 + 原子写先于成功；crypto.ts await clear_encrypted)');

/* fix33-6 · ISSUE-006：desktopSave 函数体判定（缺陷态必须 FAIL 并指名 desktopSave） */
checked += 1;
const saveBody = desktopSaveBody();
if (saveBody === null) { console.log('FAIL  desktopSave: 未找到 async function desktopSave 的函数体'); failed += 1; }
else {
  const flat = saveBody.replace(/\s+/g, ' ').trim();
  if (!SAVE_CAP_RE.test(flat)) { console.log('FAIL  desktopSave: 函数体缺 _tauri() / .invoke 能力检查（无桥接也走成功）'); failed += 1; }
  else if (SAVE_BLIND_RE.test(flat) && !/catch\b/.test(flat)) { console.log(`FAIL  desktopSave: 函数体无判真恒返回 true -> ${flat.slice(0, 200)}`); failed += 1; }
  else console.log('PASS  desktopSave: 函数体含能力检查且按异常判败');
}

/* review22-04/7 · ISSUE-004：layout.ts 与 main.ts 桌面探测必须收敛到 utils.hasTauriInvoke 同一实现 */
const layoutSrc = stripComments(fs.readFileSync(path.resolve(here, '..', 'src', 'ui', 'layout.ts'), 'utf8'));
const mainCapSrc = stripComments(src);
let layoutBad = 0; checked += 3;
if (!/\bhasTauriInvoke\b/.test(layoutSrc)) { console.log('FAIL  layout.ts: 未引用 hasTauriInvoke（桌面探测未收敛）'); layoutBad += 1; }
if (!/\bhasTauriInvoke\b/.test(mainCapSrc)) { console.log('FAIL  main.ts: 未引用 hasTauriInvoke（桌面探测未收敛）'); layoutBad += 1; }
const isdExpr = ((/const\s+isDesktop\s*=\s*([^;]+);/.exec(layoutSrc) || [])[1] || '').trim();
if (!/hasTauriInvoke\s*\(/.test(isdExpr) || /^!!\s*\(?\s*(?:window|_win|globalThis)\s*\.\s*__TAURI__\s*\)?$/.test(isdExpr)) {
  console.log(`FAIL  layout.ts: isDesktop 非能力口径（仅 __TAURI__ 命名空间）-> ${isdExpr}`); layoutBad += 1;
}
failed += layoutBad;
if (!layoutBad) console.log('PASS  layout 桌面探测: OK（layout/main 共用 hasTauriInvoke 双通道）');

/* review21-02/5 · ISSUE-003：读端可达断言——端口被注入不等于被消费，必须在产品读端函数体内真实命中（注释已剥除） */
function fnBody(code, name) {
  const head = new RegExp(`\\b(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)[^{]*\\{`).exec(code);
  if (!head) return null;
  const open = head.index + head[0].length - 1;
  for (let i = open, depth = 0; i < code.length; i++) {
    if (code[i] === '{') depth += 1;
    else if (code[i] === '}' && (depth -= 1) === 0) return code.slice(open + 1, i);
  }
  return null;
}
const DS_CALL_RE = /await\s+deps\s*\.\s*dsLoadState\s*\(/;
const FLUSH_CALL_RE = /deps\s*\.\s*flushPendingSession\s*\(/;
const persistSrc = stripComments(fs.readFileSync(path.resolve(here, '..', 'src', 'core', 'persist.ts'), 'utf8'));
const persistMerge = fnBody(persistSrc, 'runPersist');
/* 明文分支 / 密文分支各自必须 await 一次：只保留其一即整快照覆盖回归 */
const persistArms = persistMerge === null ? [] : persistMerge.split(/else\s+if\s*\(\s*_ek\s*\)/);
const READ_PORTS = [
  ['persist.ts 明文分支: dsLoadState', DS_CALL_RE.test(persistArms[0] || '')],
  ['persist.ts 密文分支: dsLoadState', DS_CALL_RE.test(persistArms[1] || '')],
  ['boot.ts flushBeforeUnload: flushPendingSession', FLUSH_CALL_RE.test(fnBody(bootCode, 'flushBeforeUnload') || '')],
];
let readBad = 0;
for (const [where, ok] of READ_PORTS) {
  if (ok) continue;
  console.log(`FAIL  ${where} 读端不可达（端口仅注入未被消费）`);
  readBad += 1;
}
checked += READ_PORTS.length;
failed += readBad;
if (!readBad) console.log('PASS  读端消费: persist.ts dsLoadState（明文/密文分支）+ boot.ts flushPendingSession（关页兜底）');

/* purge 键覆盖：LOCAL_COPY_KEYS 的每个键必须显式出现在 purgeLocalCopies 的清除逻辑中 */
const copiesPath = path.resolve(here, '..', 'src', 'core', 'local-copies.ts');
const copiesSrc = fs.readFileSync(copiesPath, 'utf8');

/** 取 `LOCAL_COPY_KEYS = { ... }` 的登记键（名称 + 字面量值） */
function localCopyKeys() {
  const head = /LOCAL_COPY_KEYS\s*=\s*\{/.exec(copiesSrc);
  if (!head) return [];
  const open = head.index + head[0].length - 1;
  let end = -1;
  for (let i = open, depth = 0; i < copiesSrc.length; i++) {
    if (copiesSrc[i] === '{') depth += 1;
    else if (copiesSrc[i] === '}' && (depth -= 1) === 0) { end = i; break; }
  }
  if (end < 0) return [];
  const obj = copiesSrc.slice(open, end + 1);
  const out = [];
  const re = /([A-Za-z_$][\w$]*)\s*:\s*'(juju\.[^']*)'/g;
  let m;
  while ((m = re.exec(obj))) out.push({ name: m[1], value: m[2] });
  return out;
}

/** 取 `function purgeLocalCopies(...) { ... }` 的函数体（配平到顶层 `}`） */
function purgeBody() {
  const head = /\bfunction\s+purgeLocalCopies\s*\([^)]*\)[^{]*\{/.exec(copiesSrc);
  if (!head) return null;
  const open = head.index + head[0].length - 1;
  for (let i = open, depth = 0; i < copiesSrc.length; i++) {
    if (copiesSrc[i] === '{') depth += 1;
    else if (copiesSrc[i] === '}' && (depth -= 1) === 0) return copiesSrc.slice(open + 1, i);
  }
  return null;
}

/* 显式口径：Object.values(LOCAL_COPY_KEYS) 通配符不算覆盖，须逐键列出 */
checked += 1;
const purgeKeys = localCopyKeys();
const purgeFn = purgeBody();
if (!purgeKeys.length) { console.log('FAIL  purge: 未解析到 LOCAL_COPY_KEYS 登记键'); failed += 1; }
else if (purgeFn === null) { console.log('FAIL  purge: 未找到 purgeLocalCopies 函数体'); failed += 1; }
else {
  const missing = purgeKeys.filter(({ name, value }) => {
    const nameRe = new RegExp(`LOCAL_COPY_KEYS\\.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return !nameRe.test(purgeFn) && !purgeFn.includes(`'${value}'`) && !purgeFn.includes(`"${value}"`);
  });
  if (missing.length) missing.forEach(({ value }) => { console.log(`FAIL purge 未覆盖: ${value}`); failed += 1; });
  else console.log(`purge 覆盖: ${purgeKeys.length}/${purgeKeys.length} keys`);
}

console.log(`\n共检查 ${checked} 个依赖键，失败 ${failed} 项`);
if (failed) {
  console.error('P1/P2 FAILED: 装配点仍存在空壳依赖');
  process.exit(1);
}
console.log('P1/P2 PASS: 装配点无空壳依赖');
