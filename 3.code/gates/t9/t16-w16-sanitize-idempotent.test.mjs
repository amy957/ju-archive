/**
 * L16-W16 · 指令 7（Defect-D）「sanitizeHtml 非 SAFE_TAGS 分支回填文本尖括号转义」N 层回归
 * ============================================================================
 * 被测语义：
 *   非白名单标签被替换为文本节点时，文本中的字面 `<` / `>` 若未经转义固化，
 *   再次序列化 / 解析可能被当作标签重新建元，使 sanitizeHtml 非幂等。
 * 历史（L16-W16）：曾新增 _sanTextEsc（`<` → \u003C，`>` → \u003E）并在 !SAFE_TAGS 分支先转义再 createTextNode。
 * 现行（L19-Patch3 / P2-1）：_sanTextEsc 退役，改为 `const rawText=ch.textContent||''` → `doc.createTextNode(rawText)`；
 *   createTextNode 经 innerHTML 序列化时天然把尖括号转义为 < / >，安全性由「文本节点 + 序列化转义」保证，
 *   不改产品回退该决策。
 *   - 表格类父上下文（TABLE/THEAD/TBODY/TFOOT/TR/COLGROUP）的文本按解析器 foster parenting
 *     同口径前置于最近 TABLE 之前，消除「回填文本被再次解析移出表格」造成的非幂等。
 * 断言口径：
 *   A. 结构锚点：createTextNode 回填（textContent → rawText）/ 表格上下文守卫，并补一条「尖括号序列化转义 + 不可再解析为标签」行为断言；
 *   B. fuzz 31 例：sanitizeHtml(sanitizeHtml(x)) === sanitizeHtml(x) 全部成立（unsafeInState=false）；
 *   C. 现有 XSS 用例 14 例（idx 0–13）：再解析后 pwned=false；
 *   D. 大 state（拼接 5,000 节点 HTML）P95 采样（记录值）。
 * 运行：`node --test l9/t16-w16-sanitize-idempotent.test.mjs`（需 JU_CHROMIUM_PATH 或本机 Chrome）
 * 纳编口径：本文件不纳入 `t9/t9-hash-check.mjs` 43 方登记（保持登记方数不变）。
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP9 = path.resolve(HERE, '..');
const CANONICAL = path.resolve(STEP9, '..', 'canonical', 'v2.0-t3.html');
const SRC = readFileSync(CANONICAL, 'utf8');

/* ---------- 1) 提取真实产品实现：白名单 + 样式净化 + sanitizeHtml ---------- */
const S0 = SRC.indexOf('const SAFE_TAGS=');
const S1 = SRC.indexOf('/* FIX-CAND01', S0);
assert.ok(S0 > 0 && S1 > S0, 'canonical 缺 sanitizeHtml 段');
const SAN_SRC = SRC.slice(S0, S1);

/* ---------- 2) fuzz 语料（31 例）与 XSS 语料（14 例） ---------- */
const FUZZ = [
  '<noscript><p title="<img src=x onerror=alert(1)>">ns</p></noscript>',
  '<noscript><p>ns</p></noscript>',
  '<textarea><b>x</b></textarea>',
  '<script>if(a<b){var s="<img>"}</script>',
  '<style>.x{content:"<img src=x>"}</style>',
  '<xmp><b>x</b></xmp>',
  '<iframe><b>x</b></iframe>',
  '<noembed><b>x</b></noembed>',
  '<noframes><b>x</b></noframes>',
  '<plaintext><b>x</b>',
  '<template><b>x</b></template>',
  '<select><option><b>x</b></option></select>',
  '<svg><script>a<b</script></svg>',
  '<math><mtext><b>x</b></mtext></math>',
  '<title><b>x</b></title>',
  '<head><title><b>x</b></title></head>',
  '<frameset><frame src="x"></frameset>',
  '<object><param name=x value=y><b>z</b></object>',
  '<applet><b>x</b></applet>',
  '<marquee><b>x</b></marquee>',
  '<audio><source src=x><b>y</b></audio>',
  '<video><b>y</b></video>',
  '<canvas><b>y</b></canvas>',
  '<details><summary><b>s</b></summary>d</details>',
  '<dialog><b>d</b></dialog>',
  '<form><input value="<img src=x>"><b>f</b></form>',
  '<button><b>b</b></button>',
  '<label><b>l</b></label>',
  '<table><caption><b>c</b></caption><tr><td><b>t</b></td></tr></table>',
  '<div><noscript><p title="<img src=x onerror=alert(1)>">ns</p></noscript></div>',
  '<b>ok</b><noscript><span title="<script>alert(1)</script>">ns</span></noscript><i>ok</i>',
];

const XSS = [
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<script>alert(1)</script>',
  '<a href="javascript:alert(1)">x</a>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<template><img src=x onerror=alert(1)></template>',
  '<object data="javascript:alert(1)">',
  '<embed src="javascript:alert(1)">',
  '<form action="javascript:alert(1)"><input type=submit>',
  '<isindex action="javascript:alert(1)">',
  '<textarea><img src=x onerror=alert(1)></textarea>',
];

function chromePath() {
  if (process.env.JU_CHROMIUM_PATH) return process.env.JU_CHROMIUM_PATH;
  const local = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
    : '';
  return local;
}

let browser = null;
let page = null;

before(async () => {
  const { chromium } = await import('../node_modules/playwright/index.mjs');
  browser = await chromium.launch({ executablePath: chromePath(), headless: true });
  page = await browser.newPage();
  await page.goto('about:blank');
  await page.evaluate((san) => {
    window.__san = new Function(san + '\nreturn sanitizeHtml;')();
  }, SAN_SRC);
});

after(async () => {
  if (browser) await browser.close();
});

/* ---------- A · 结构锚点 ---------- */
describe('A · 结构锚点（createTextNode 回填 / 表格上下文守卫）', () => {
  test('A1 非 SAFE_TAGS 分支以 createTextNode 回填文本（_sanTextEsc 退役后结构 + 行为等价）', async () => {
    /* 现行实现：ch.textContent → doc.createTextNode(rawText)；不经显式替换，安全性来自文本节点 +
       innerHTML 序列化转义（尖括号实体化）。此处断言结构锚点与真实序列化行为，不降低 XSS 防护口径。 */
    assert.ok(/const rawText=ch\.textContent\|\|''/.test(SAN_SRC), '回填文本未取自 ch.textContent');
    assert.ok(/const textNode=doc\.createTextNode\(rawText\)/.test(SAN_SRC), '未以 createTextNode 插入回填文本');
    assert.ok(/par\.replaceChild\(textNode,ch\)/.test(SAN_SRC), '非表格上下文缺 par.replaceChild(textNode,ch) 回填');
    assert.ok(!/replaceChild\(doc\.createTextNode\(ch\.textContent\|\|''\),ch\)/.test(SAN_SRC), '旧直插写法仍存在');
    assert.ok(!/function _sanTextEsc\(/.test(SAN_SRC), '_sanTextEsc 已退役，重新出现需复核 L19-Patch3 决策');
    /* 行为等价（安全第一）：textarea 的 textContent 保留字面尖括号，回填后必须被序列化转义，且再次解析/净化不产生标签 */
    const esc = await page.evaluate(() => {
      const s = window.__san('<textarea><img src=x onerror=alert(1)></textarea>');
      const d = new DOMParser().parseFromString('<div>' + s + '</div>', 'text/html');
      return {
        s,
        /* 序列化后不得残留裸尖括号（即已被实体化），且文本内容 img 仍保留 */
        escaped: s.indexOf('<') === -1 && s.indexOf('>') === -1 && s.indexOf('img') !== -1,
        hasImg: !!d.querySelector('img'),
        hasOn: !!d.querySelector('[onerror]'),
        same: window.__san(s) === s,
      };
    });
    assert.ok(esc.escaped, '回填文本尖括号未在序列化时转义：' + esc.s);
    assert.equal(esc.hasImg, false, '回填文本被再解析为 <img>');
    assert.equal(esc.hasOn, false, '回填文本被再解析为带 onerror 的节点');
    assert.ok(esc.same, '回填结果再次净化不幂等');
  });

  test('A2 表格类父上下文前置于最近 TABLE（foster parenting 同口径）', () => {
    assert.ok(/ptag==='TABLE'\|\|ptag==='THEAD'\|\|ptag==='TBODY'\|\|ptag==='TFOOT'\|\|ptag==='TR'\|\|ptag==='COLGROUP'/.test(SAN_SRC), '缺表格上下文判定');
    assert.ok(/tbl\.parentNode\.insertBefore\(textNode,tbl\)/.test(SAN_SRC), '缺表格前的文本前置');
  });
});

/* ---------- B · fuzz 幂等 ---------- */
describe('B · sanitizeHtml 幂等（fuzz 31 例）', () => {
  test('B1 31 例全部满足 sanitizeHtml(sanitizeHtml(x))===sanitizeHtml(x)', async () => {
    const rows = await page.evaluate((list) => list.map((x) => {
      const s1 = window.__san(x);
      const s2 = window.__san(s1);
      return { x, s1, s2, ok: s1 === s2 };
    }), FUZZ);
    const bad = rows.filter((r) => !r.ok);
    assert.equal(bad.length, 0, '非幂等样例：' + JSON.stringify(bad.slice(0, 3)));
    assert.equal(rows.length, 31);
  });

  test('B2 回填文本不含可再解析的字面标签（unsafeInState=false）', async () => {
    const flags = await page.evaluate((list) => list.map((x) => {
      const s1 = window.__san(x);
      const d = new DOMParser().parseFromString('<div>' + s1 + '</div>', 'text/html');
      const before = d.body.firstChild ? d.body.firstChild.getElementsByTagName('*').length : 0;
      const s2 = window.__san(s1);
      const d2 = new DOMParser().parseFromString('<div>' + s2 + '</div>', 'text/html');
      const after = d2.body.firstChild ? d2.body.firstChild.getElementsByTagName('*').length : 0;
      return { x, s1, sameHtml: s1 === s2, sameCount: before === after };
    }), FUZZ);
    const unsafe = flags.filter((f) => !f.sameHtml || !f.sameCount);
    assert.equal(unsafe.length, 0, 'unsafeInState 命中：' + JSON.stringify(unsafe.slice(0, 3)));
  });
});

/* ---------- C · 现有 XSS 用例 ---------- */
describe('C · 现有 XSS 用例（idx 0–13）', () => {
  test('C1 14 例再解析后 pwned=false', async () => {
    const rows = await page.evaluate((list) => list.map((x, i) => {
      const s1 = window.__san(x);
      const d = new DOMParser().parseFromString('<div>' + s1 + '</div>', 'text/html');
      const bad = d.querySelector('script,iframe,object,embed,form,img[onerror],svg[onload],[onclick],[onerror],[onload],[src^="javascript:"],[href^="javascript:"]');
      return { i, x, s1, pwned: !!bad };
    }), XSS);
    const pwned = rows.filter((r) => r.pwned);
    assert.equal(pwned.length, 0, 'XSS 命中：' + JSON.stringify(pwned));
    assert.equal(rows.length, 14);
  });
});

/* ---------- D · 大 state P95 采样 ---------- */
describe('D · 大 state（5,000 节点 HTML）P95 采样', () => {
  test('D1 单次净化耗时采样（记录值 · 幂等同时成立）', async () => {
    const big = Array.from({ length: 5000 }, (_, i) => `<div><b>n${i}</b><noscript><p title="<img ${i}>">x</p></noscript></div>`).join('');
    const msg = await page.evaluate((html) => {
      const xs = [];
      let out = null;
      for (let r = 0; r < 40; r++) {
        const t0 = performance.now();
        out = window.__san(html);
        xs.push(performance.now() - t0);
      }
      xs.sort((a, b) => a - b);
      const q = (p) => xs[Math.min(xs.length - 1, Math.floor(xs.length * p))];
      const stable = window.__san(out) === out;
      return { med: q(0.5), p95: q(0.95), max: xs[xs.length - 1], stable, bytes: html.length };
    }, big);
    assert.ok(msg.stable, '大 state 净化结果非幂等');
    assert.ok(msg.p95 < 5000, '单次净化 P95 超过 5s（异常）');
  });
});
