/**
 * L19 · 批次 3（P2/P3 清理）N 层回归（Node，无浏览器）
 * ============================================================================
 * 被测语义：
 *   P2-1  _sanTextEsc 退役；sanitizeHtml 非白名单分支直接使用 ch.textContent。
 *   P2-2  applyPatch 末尾无效 repairTreeConsistency(next) 调用删除（L16-W12 洞过滤保留）。
 *   P2-3  commit 内 _clearTag 死变量删除。
 *   P2-4  reportError 去重键改用脱敏后的 _p 字段（加密模式不再回填原始 msg/filename）。
 *   P2-6  openFieldTypeMenu 接收触发按钮 rect 并透传给 openFieldConfigPop。
 *   P3-1  commit 全局重赋值包装移除；性能统计内联到 commit 首尾。
 *   P2-7  initPomo 的 mousemove / mouseup 改为拖拽期间动态挂载、抬起即移除。
 * 断言口径：
 *   A 结构锚点（去注释后）；B 行为装配；C 红证（只读冻结锚 frozen-l17 判别力）。
 * 运行：`node --test l9/t19-patch3.test.mjs`（Node >= 22）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 登记（保持 45 方零漂移）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const ROOT = path.resolve(STEP9, '..', '..');
const CANONICAL = process.env.JU_L19_CANONICAL
  ? path.resolve(process.env.JU_L19_CANONICAL)
  : path.resolve(STEP9, '..', 'v2.0-t3.html');
/* 只读历史锚（改前形态 · 仅读取 · 不写入） */
const FROZEN_L17 = path.resolve(ROOT, '1.历史归档', '1.1冻结版本', 'v2.0-t13-frozen-t17-2026-10-17.html');

const SRC = readFileSync(CANONICAL, 'utf8');
const OLD = readFileSync(FROZEN_L17, 'utf8');
const STRIP = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

function extractDecl(src, head) {
  const s = src.indexOf(head);
  if (s < 0) return null;
  let i = src.indexOf('(', s);
  let pd = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') pd++;
    else if (ch === ')') {
      pd--;
      if (pd === 0) { i++; break; }
    }
  }
  const b = src.indexOf('{', i);
  let depth = 0;
  for (let j = b; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(s, j + 1);
    }
  }
  return null;
}

/* ---------- P2-1 · _sanTextEsc 退役 ---------- */
describe('L19 · P2-1 · sanitizeHtml 不再依赖 _sanTextEsc', () => {
  test('A1 去注释后全文件零 _sanTextEsc', () => {
    assert.doesNotMatch(STRIP(SRC), /_sanTextEsc/, '仍存在 _sanTextEsc 引用');
  });

  test('A2 非白名单分支直接取 ch.textContent', () => {
    const fn = STRIP(extractDecl(SRC, 'function sanitizeHtml(html){') || '');
    assert.match(fn, /const rawText=ch\.textContent\|\|'';/);
    assert.match(fn, /doc\.createTextNode\(rawText\)/);
  });

  test('B1 createTextNode 以文本节点承载标签字面量（无 HTML 语义）', () => {
    const doc = { createTextNode: (s) => ({ nodeType: 3, text: s }) };
    const raw = '<img src=x onerror=alert(1)>';
    const tn = doc.createTextNode(raw);
    assert.equal(tn.nodeType, 3, '应为文本节点');
    assert.equal(tn.text, raw, '文本内容应原样保留');
    assert.equal('innerHTML' in tn, false, '文本节点不携带 HTML 解析入口');
  });

  test('C1 红证：冻结锚 frozen-l17 仍含 _sanTextEsc 定义与调用', () => {
    const oldCode = STRIP(OLD);
    assert.match(oldCode, /function _sanTextEsc\(s\)/);
    assert.match(oldCode, /_sanTextEsc\(ch\.textContent\|\|''\)/);
  });
});

/* ---------- P2-2 · applyPatch 无效 repair 调用删除 ---------- */
describe('L19 · P2-2 · applyPatch 末尾 repairTreeConsistency(next) 已删除', () => {
  test('A1 applyPatch 内零 repairTreeConsistency(next) 调用', () => {
    const fn = STRIP(extractDecl(SRC, 'function applyPatch(') || '');
    assert.ok(fn, '缺少 applyPatch');
    assert.doesNotMatch(fn, /repairTreeConsistency\(next\)/);
  });

  test('A2 L16-W12 children 洞过滤保留', () => {
    const fn = STRIP(extractDecl(SRC, 'function applyPatch(') || '');
    assert.match(fn, /typeof _cid!=='string'\|\|!_ns\[_cid\]/);
    assert.match(fn, /children:_kept/);
  });

  test('A3 repairTreeConsistency 函数本体保留（其它调用点不受影响）', () => {
    assert.match(STRIP(SRC), /function repairTreeConsistency\(/);
  });

  test('C1 红证：冻结锚 frozen-l17 的 applyPatch 仍含该调用', () => {
    const oldFn = STRIP(extractDecl(OLD, 'function applyPatch(') || '');
    assert.match(oldFn, /repairTreeConsistency\(next\)/);
  });
});

/* ---------- P2-3 · _clearTag 死变量删除 ---------- */
describe('L19 · P2-3 · commit 内 _clearTag 死变量已删除', () => {
  test('A1 commit 内零 _clearTag', () => {
    const fn = STRIP(extractDecl(SRC, 'function commit(action,') || '');
    assert.doesNotMatch(fn, /_clearTag/);
  });

  test('C1 红证：冻结锚 frozen-l17 的 commit 含 const _clearTag', () => {
    const oldFn = STRIP(extractDecl(OLD, 'function commit(action,') || '');
    assert.match(oldFn, /const _clearTag=\(dirtyText===true\);/);
  });
});

/* ---------- P2-4 · _errSeen 键使用脱敏字段 ---------- */
describe('L19 · P2-4 · reportError 去重键改用脱敏后的 _p 字段', () => {
  test('A1 结构锚点：key 由 _p 构建', () => {
    const fn = STRIP(extractDecl(SRC, 'function reportError(kind,payload){') || '');
    assert.match(fn, /const key=JSON\.stringify\(\[kind,_p\.msg\|\|_p\.reason\|\|'',_p\.filename\|\|'',_p\.lineno\]\);/);
    assert.doesNotMatch(fn, /const key=JSON\.stringify\(\[kind,payload\.msg/);
  });

  test('B1 加密占位下键不含原始消息 / 路径', () => {
    const payload = { msg: 'secret text', filename: 'C:\\Users\\x\\a.js', lineno: 42 };
    const _p = { msg: '<enc-message>', filename: '<enc-filename>', lineno: '<enc-lineno>' };
    const oldKey = JSON.stringify(['err', payload.msg || payload.reason || '', payload.filename || '', payload.lineno]);
    const newKey = JSON.stringify(['err', _p.msg || _p.reason || '', _p.filename || '', _p.lineno]);
    assert.notEqual(newKey, oldKey);
    assert.equal(newKey.includes('secret text'), false);
    assert.equal(newKey.includes('C:\\Users'), false);
    assert.match(newKey, /<enc-message>/);
    assert.match(newKey, /<enc-filename>/);
  });

  test('C1 红证：冻结锚 frozen-l17 的 key 仍取 payload', () => {
    const oldFn = STRIP(extractDecl(OLD, 'function reportError(kind,payload){') || '');
    assert.match(oldFn, /const key=JSON\.stringify\(\[kind,payload\.msg\|\|payload\.reason/);
  });
});

/* ---------- P2-6 · 字段类型菜单锚点 ---------- */
describe('L19 · P2-6 · openFieldTypeMenu 使用触发按钮 rect', () => {
  test('A1 签名接收 anchorRect 且优先使用', () => {
    const fn = STRIP(extractDecl(SRC, 'function openFieldTypeMenu(') || '');
    assert.match(fn, /^function openFieldTypeMenu\(anchor,cb,anchorRect\)\{/);
    assert.match(fn, /const rect=anchorRect\|\|pop\.getBoundingClientRect\(\);/);
  });

  test('A2 addCol 调用传入自身 getBoundingClientRect()', () => {
    assert.match(SRC, /\},addCol\.getBoundingClientRect\(\)\);\};/);
  });

  test('B1 按钮 rect 优先于菜单 rect', () => {
    const pick = (anchorRect, popRect) => anchorRect || popRect;
    assert.deepEqual(pick({ left: 10 }, { left: 99 }), { left: 10 });
    assert.deepEqual(pick(null, { left: 99 }), { left: 99 });
  });

  test('C1 红证：冻结锚 frozen-l17 仍以菜单自身 rect 为锚', () => {
    const oldFn = STRIP(extractDecl(OLD, 'function openFieldTypeMenu(') || '');
    assert.match(oldFn, /^function openFieldTypeMenu\(anchor,cb\)\{/);
    assert.match(oldFn, /const rect=pop\.getBoundingClientRect\(\);/);
    assert.doesNotMatch(OLD, /addCol\.getBoundingClientRect\(\)/);
  });
});

/* ---------- P3-1 · commit 全局重赋值移除 ---------- */
describe('L19 · P3-1 · commit 计时内联，移除全局重赋值', () => {
  test('A1 全文件零 _origCommit / commit=function', () => {
    const code = STRIP(SRC);
    assert.doesNotMatch(code, /_origCommit/);
    assert.doesNotMatch(code, /commit=function/);
  });

  test('A2 commit 首尾内联计时（至少 4 个返回分支）', () => {
    const fn = STRIP(extractDecl(SRC, 'function commit(action,') || '');
    assert.match(fn, /const _vsCommitT0=\(typeof _vsNow==='function'\)\?_vsNow\(\):Date\.now\(\);/);
    const hits = fn.match(/_vsMetricPush\('commit',/g) || [];
    assert.ok(hits.length >= 4, `期望至少 4 处计时收口，实得 ${hits.length}`);
  });

  test('C1 红证：冻结锚 frozen-l17 仍以包装器重赋值 commit', () => {
    const oldCode = STRIP(OLD);
    assert.match(oldCode, /const _origCommit=commit;/);
    assert.match(oldCode, /commit=function\(\)\{/);
  });
});

/* ---------- P2-7 · initPomo 全局监听清理 ---------- */
describe('L19 · P2-7 · initPomo 拖拽监听动态挂载并移除', () => {
  const fn = STRIP(extractDecl(SRC, 'function initPomo(){') || '');

  test('A1 无永久 document mousemove 匿名监听', () => {
    assert.doesNotMatch(fn, /document\.addEventListener\('mousemove',e=>\{/);
    assert.doesNotMatch(fn, /document\.addEventListener\('mouseup',\(\)=>\{/);
  });

  test('A2 拖拽期间挂载、抬起即移除', () => {
    assert.match(fn, /const onPomoMove=e=>\{/);
    assert.match(fn, /const onPomoUp=\(\)=>\{/);
    assert.match(fn, /document\.addEventListener\('mousemove',onPomoMove\);/);
    assert.match(fn, /document\.addEventListener\('mouseup',onPomoUp\);/);
    assert.match(fn, /document\.removeEventListener\('mousemove',onPomoMove\);/);
    assert.match(fn, /document\.removeEventListener\('mouseup',onPomoUp\);/);
    const md = fn.indexOf("el.addEventListener('mousedown'");
    const mm = fn.indexOf("document.addEventListener('mousemove',onPomoMove);");
    assert.ok(md >= 0 && mm > md, '监听应在 mousedown 处理器内挂载');
  });

  test('C1 红证：冻结锚 frozen-l17 仍永久挂载 document 监听', () => {
    const oldFn = STRIP(extractDecl(OLD, 'function initPomo(){') || '');
    assert.match(oldFn, /document\.addEventListener\('mousemove',e=>\{/);
    assert.match(oldFn, /document\.addEventListener\('mouseup',\(\)=>\{/);
    assert.doesNotMatch(oldFn, /onPomoUp/);
  });
});
