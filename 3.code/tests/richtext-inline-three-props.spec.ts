import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * M07 · 富文本「颜色 / 背景 / 字号」三项互不覆盖（六种顺序 × 真实鼠标事件）
 *
 * 缺陷背景：
 *   三项属性分别走 execCommand('foreColor' | 'hiliteColor' | 'fontSize')，
 *   后一条命令会重建选区边界节点，前一条写入的属性随之丢失；字号还用 font size 1-7，
 *   与 span style 混用后层叠顺序由嵌套深度决定；同值重复点击还会被 toggle 成清除。
 *
 * 本 spec 的断言口径（全部读取真实 computed style，不依赖属性字符串写法）：
 *   ① 六种先后顺序设置三项，每次设置后「已设置的属性全部保留」；
 *   ② 结构收敛：整个选区只有 **一个** span，且该 span 的 style 同时含三项声明；
 *   ③ 同值重复点击不清除（不 toggle）；
 *   ④ 工具栏 active 状态按计算样式刷新；清除走独立按钮（默认色 / 透明 / 清除字号）。
 */
const BASE = 'http://localhost:5173';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const HOST_SEL = '#content .text[data-id="probe-rt3"]';
const FIXTURE_TEXT = 'ALPHA BETA GAMMA';
const TARGET_TEXT = 'ALPHA BETA';

type Kind = 'color' | 'bg' | 'size';

interface ProbeState {
  color: string;
  bg: string;
  sizePx: number;
  selected: string;
  spans: number;
  spanStyle: string;
  activeColor: boolean;
  activeBg: boolean;
  activeSize: boolean;
}

function projectRoot(): string {
  return path.dirname(test.info().config.rootDir);
}

/** 重新构建（保证被测代码即当前源码），返回 dist 绝对路径。 */
async function prepareDist(): Promise<string> {
  const root = projectRoot();
  await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent' });
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build 未产出 dist/index.html：' + dist);
  return dist;
}

/** 把 baseURL 请求映射到 dist 产物（本机回环入站被系统策略阻断，故走路由拦截）。 */
async function installDistRoute(context: BrowserContext, dist: string): Promise<void> {
  await context.route(BASE + '/**', async (route: Route) => {
    const url = new URL(route.request().url());
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';
    const file = path.join(dist, pathname);
    try {
      const st = await fsp.stat(file);
      if (st.isDirectory()) throw new Error('directory');
      await route.fulfill({
        status: 200,
        contentType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        body: await fsp.readFile(file),
      });
    } catch {
      await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'not found: ' + pathname });
    }
  });
}

/** 打开被测页面（构建产物 → 路由映射 → 等 JU 装配完成）。 */
async function openProbe(browser: Browser): Promise<{ context: BrowserContext; page: Page; pageErrors: string[] }> {
  const dist = await prepareDist();
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
  await installDistRoute(context, dist);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') pageErrors.push(String(m.text())); });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(
    () => !!(window as any).JU && typeof (window as any).JU.applyInlineStyle === 'function',
  );
  return { context, page, pageErrors };
}

/** 造夹具：`#content` 内一个真实 contenteditable 正文节点，并选中前两段文字。 */
async function mountFixture(page: Page): Promise<void> {
  await page.evaluate(
    ({ sel, text, target }) => {
      /* 右侧栏若处于收起态（margin-right 负值），按钮点不到：先展开（仅测试夹具，不改产品代码） */
      const sb = document.getElementById('sidebarRight');
      if (sb) sb.classList.remove('collapsed');
      const content = document.getElementById('content') || document.body;
      let host = document.querySelector(sel) as HTMLElement | null;
      if (!host) {
        host = document.createElement('div');
        host.className = 'text';
        host.setAttribute('data-id', 'probe-rt3');
        host.setAttribute('contenteditable', 'true');
        content.appendChild(host);
      }
      host.textContent = text;
      host.focus();
      const node = host.firstChild as Text;
      const r = document.createRange();
      r.setStart(node, 0);
      r.setEnd(node, target.length);
      const s = window.getSelection();
      if (!s) throw new Error('no selection');
      s.removeAllRanges();
      s.addRange(r);
    },
    { sel: HOST_SEL, text: FIXTURE_TEXT, target: TARGET_TEXT },
  );
}

/** 读回选区生效样式 + 结构与工具栏 active 状态（全部走真实 DOM / getComputedStyle）。 */
async function readState(page: Page): Promise<ProbeState> {
  return page.evaluate((sel) => {
    const host = document.querySelector(sel) as HTMLElement | null;
    if (!host) throw new Error('probe host missing: ' + sel);
    const s = window.getSelection();
    const range = s && s.rangeCount ? s.getRangeAt(0) : null;
    let node: any = range ? range.startContainer : host.firstChild;
    let offset = range ? range.startOffset : 0;
    while (node && node.nodeType === 1 && node.childNodes.length) {
      const child: any = node.childNodes[Math.min(offset, node.childNodes.length - 1)];
      if (!child) break;
      node = child;
      offset = 0;
    }
    const el: any = node ? (node.nodeType === 3 ? node.parentElement : node) : host;
    const cs = getComputedStyle(el);
    const span = host.querySelector('span') as HTMLElement | null;
    const btnOn = (cmd: string) => {
      const b = document.querySelector(`[data-cmd="${cmd}"]`) as HTMLElement | null;
      return !!(b && b.classList.contains('on'));
    };
    return {
      color: String(cs.color || ''),
      bg: String(cs.backgroundColor || ''),
      sizePx: parseFloat(String(cs.fontSize || '0')),
      selected: s ? String(s) : '',
      spans: host.querySelectorAll('span').length,
      spanStyle: (span && span.getAttribute('style')) || '',
      activeColor: btnOn('color'),
      activeBg: btnOn('bg'),
      activeSize: btnOn('size'),
    };
  }, HOST_SEL);
}

interface Applied {
  color?: string;
  bg?: string;
  sizePx?: number;
}

/**
 * 执行一条格式命令（真实鼠标事件），返回本次写入的目标值。
 *   color / bg：点按钮弹色板 → 点色块，返回值取色块计算背景色（与正文颜色同口径）
 *   size     ：点按钮弹字号面板 → 点档位，返回值取面板上标注的 px
 */
async function applyCommand(page: Page, kind: Kind): Promise<string | number> {
  if (kind === 'color' || kind === 'bg') {
    await page.locator(`[data-cmd="${kind}"]`).click();
    await expect(page.locator('.color-picker .cp-swatch').first()).toBeVisible();
    const swatch = page.locator('.color-picker .cp-swatch').nth(kind === 'color' ? 2 : 10);
    const rgb = await swatch.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);
    await swatch.click();
    return rgb;
  }
  await page.locator('[data-cmd="size"]').click();
  await expect(page.locator('.color-picker .sp-btn').first()).toBeVisible();
  const btn = page.locator('.color-picker .sp-btn').nth(4);
  const label = await btn.locator('.sp-px').textContent();
  const px = parseFloat(String(label || '').replace('px', ''));
  await btn.click();
  return px;
}

/** 全排列（3 项 = 6 种顺序）。 */
function permutations(items: Kind[]): Kind[][] {
  if (items.length <= 1) return [items.slice()];
  const out: Kind[][] = [];
  items.forEach((cur, i) => {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    permutations(rest).forEach((p) => out.push([cur].concat(p)));
  });
  return out;
}

const KINDS: Kind[] = ['color', 'bg', 'size'];

for (const order of permutations(KINDS)) {
  const name = order.join(' → ');
  test(`三属性顺序叠加（${name}）：三项 computed style 全部保留`, async ({ browser }) => {
    const { context, page, pageErrors } = await openProbe(browser);
    await mountFixture(page);
    const base = await readState(page);
    expect(base.selected).toBe(TARGET_TEXT);
    const basePx = base.sizePx;
    expect(basePx).toBeGreaterThan(0);

    const applied: Applied = {};
    for (const kind of order) {
      const want = await applyCommand(page, kind);
      if (kind === 'color') applied.color = String(want);
      else if (kind === 'bg') applied.bg = String(want);
      else applied.sizePx = Number(want);

      const st = await readState(page);
      /* 选区必须保持（下一次命令仍有有效 Range） */
      expect(st.selected, `步骤 ${kind} 后选区丢失`).toBe(TARGET_TEXT);
      /* 已写入的属性项全部保留（互不覆盖） */
      if (applied.color) expect(st.color, `${name}: ${kind} 之后颜色丢失`).toBe(applied.color);
      if (applied.bg) expect(st.bg, `${name}: ${kind} 之后背景丢失`).toBe(applied.bg);
      if (applied.sizePx) expect(st.sizePx, `${name}: ${kind} 之后字号丢失`).toBeCloseTo(applied.sizePx, 0);
      /* 结构收敛：始终只有一个 span */
      expect(st.spans, `${name}: ${kind} 之后 span 层数应恒为 1`).toBe(1);
    }

    /* 六种顺序收敛到同一个结构：单个 span 同时携带 color / background-color / font-size */
    const final = await readState(page);
    expect(final.spans).toBe(1);
    const style = final.spanStyle.toLowerCase();
    expect(style).toContain('color:');
    expect(style).toContain('background-color:');
    expect(style).toContain('font-size:');
    expect(final.color).toBe(applied.color);
    expect(final.bg).toBe(applied.bg);
    expect(final.sizePx).toBeCloseTo(Number(applied.sizePx), 0);

    /* 工具栏 active 状态由计算样式推导（三项都应亮起） */
    expect(final.activeColor).toBe(true);
    expect(final.activeBg).toBe(true);
    expect(final.activeSize).toBe(true);

    /* 全程不得回落到 execCommand 报错路径 */
    expect(pageErrors.filter((t) => /execCommand/i.test(t))).toEqual([]);
    await context.close();
  });
}

test('同值重复点击不清除（不 toggle），清除只走独立按钮', async ({ browser }) => {
  const { context, page } = await openProbe(browser);
  await mountFixture(page);

  const rgb = String(await applyCommand(page, 'color'));
  const first = await readState(page);
  expect(first.color).toBe(rgb);

  /* 保持选中，再点同一个色块两次：颜色必须原样保留（旧实现会被 toggle 成清除） */
  await applyCommand(page, 'color');
  const second = await readState(page);
  expect(second.color).toBe(rgb);
  expect(second.spans).toBe(1);

  /* 独立清除按钮：「默认」把文字色摘掉（回到正文前景色） */
  await page.locator('[data-cmd="color"]').click();
  await expect(page.locator('.color-picker .cp-transparent').first()).toBeVisible();
  await page.locator('.color-picker .cp-transparent').first().click();
  const cleared = await readState(page);
  expect(cleared.color).not.toBe(rgb);
  expect(cleared.spans).toBeLessThanOrEqual(1);

  /* 背景：同值重复也不清除；「透明」独立按钮才清除 */
  const bgRgb = String(await applyCommand(page, 'bg'));
  expect((await readState(page)).bg).toBe(bgRgb);
  await applyCommand(page, 'bg');
  expect((await readState(page)).bg).toBe(bgRgb);

  await page.locator('[data-cmd="bg"]').click();
  await page.locator('.color-picker .cp-transparent').first().click();
  const bgCleared = await readState(page);
  expect(['transparent', 'rgba(0, 0, 0, 0)']).toContain(bgCleared.bg);

  await context.close();
});

test('字号以 px 写入（无 1-7 档位）且清除字号走独立按钮', async ({ browser }) => {
  const { context, page } = await openProbe(browser);
  await mountFixture(page);
  const base = await readState(page);

  const px = Number(await applyCommand(page, 'size'));
  const sized = await readState(page);
  expect(px).toBeGreaterThan(0);
  expect(sized.sizePx).toBeCloseTo(px, 0);
  /* 写入的是 px 数值，不是 <font size="N"> */
  expect(sized.spanStyle.toLowerCase()).toContain(px + 'px');
  expect(await page.evaluate((sel) => (document.querySelector(sel) as HTMLElement).querySelectorAll('font').length, HOST_SEL)).toBe(0);

  /* 再次点击同档位：字号不变（不 toggle） */
  await applyCommand(page, 'size');
  expect((await readState(page)).sizePx).toBeCloseTo(px, 0);

  /* 独立清除按钮：清除字号恢复正文大小 */
  await page.locator('[data-cmd="size"]').click();
  const clearBtn = page.locator('.color-picker .sp-btn').last();
  await expect(clearBtn).toHaveText('清除字号');
  await clearBtn.click();
  const cleared = await readState(page);
  expect(cleared.sizePx).toBeCloseTo(base.sizePx, 0);

  await context.close();
});

/* ============================================================
   批次3 · 「实机分支」回归（夹具不再是「单文本节点」的讨好场景）
   ------------------------------------------------------------
   实机失败与夹具通过的差异点：
     A. 选区跨多个块级元素（一个 contenteditable 内两个 <p>）；
     B. 选区跨两个大纲行（两个独立的 contenteditable）；
     C. 两条命令之间发生整块重渲染（编辑节点被替换 ⇒ 克隆 Range 失效）；
     D. document.execCommand('undo' / 'redo') 往返；
     E. 折叠光标（先设样式、后落字）的 typing style。
   ============================================================ */

const HOST = 'probe-rt3';
const HOST_SEL_3 = '#content .text[data-id="probe-rt3"]';
const HOST_B_SEL_3 = '#content .text[data-id="probe-rt3b"]';

/** 用给定 HTML 造一个真实 contenteditable 正文节点。 */
async function mountHtml(page: Page, id: string, html: string): Promise<void> {
  await page.evaluate(
    ({ id: hostId, html: markup }) => {
      const sb = document.getElementById('sidebarRight');
      if (sb) sb.classList.remove('collapsed');
      const content = document.getElementById('content') || document.body;
      const sel = '#content .text[data-id="' + hostId + '"]';
      let host = document.querySelector(sel) as HTMLElement | null;
      if (!host) {
        host = document.createElement('div');
        host.className = 'text';
        host.setAttribute('data-id', hostId);
        host.setAttribute('contenteditable', 'true');
        content.appendChild(host);
      }
      host.innerHTML = markup;
      host.focus();
    },
    { id, html },
  );
}

/**
 * 跨节点选区：偏移量是**宿主内纯文本的绝对偏移**（0 起），
 * 与「有几个文本节点」无关 —— 夹具/浏览器可能把文字拆成任意多个文本节点。
 */
async function selectAcross(
  page: Page,
  startSel: string,
  startOffset: number,
  endSel: string,
  endOffset: number,
  endNodeFromEnd = 0,
): Promise<string> {
  return page.evaluate(
    ({ s1, o1, s2, o2, fromEnd }) => {
      const point = (root: Node, off: number): { node: Text; offset: number } => {
        const texts: Text[] = [];
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n: Node | null = w.nextNode();
        while (n) { texts.push(n as Text); n = w.nextNode(); }
        if (!texts.length) throw new Error('no text nodes');
        const total = texts.reduce((acc, t) => acc + String(t.nodeValue || '').length, 0);
        /* fromEnd 用于特殊场景（自末尾回退），常规调用为 0 */
        const target = Math.max(0, Math.min(off + fromEnd, total));
        let acc = 0;
        for (let i = 0; i < texts.length; i++) {
          const len = String(texts[i].nodeValue || '').length;
          if (target <= acc + len) return { node: texts[i], offset: target - acc };
          acc += len;
        }
        const last = texts[texts.length - 1];
        return { node: last, offset: String(last.nodeValue || '').length };
      };
      const host1 = document.querySelector(s1) as HTMLElement | null;
      const host2 = document.querySelector(s2) as HTMLElement | null;
      if (!host1 || !host2) throw new Error('host missing');
      const p1 = point(host1, o1);
      const p2 = point(host2, o2);
      const r = document.createRange();
      r.setStart(p1.node, p1.offset);
      r.setEnd(p2.node, p2.offset);
      const s = window.getSelection();
      if (!s) throw new Error('no selection');
      s.removeAllRanges();
      s.addRange(r);
      /* 【注意】跨两个 contenteditable 时 `Selection.toString()` 只返回「编辑宿主内」的文字，
         必须按宿主切片用 Range.toString() 才能读到整段选区。 */
      const cur = s.getRangeAt(0);
      const parts: string[] = [];
      (Array.from(document.querySelectorAll('[contenteditable="true"]')) as HTMLElement[]).forEach((h) => {
        let hit = false;
        try { hit = cur.intersectsNode(h); } catch { hit = false; }
        if (!hit) return;
        const sub = document.createRange();
        try {
          if (h.contains(cur.startContainer)) sub.setStart(cur.startContainer, cur.startOffset);
          else sub.setStart(h, 0);
          if (h.contains(cur.endContainer)) sub.setEnd(cur.endContainer, cur.endOffset);
          else sub.setEnd(h, h.childNodes.length);
          parts.push(sub.toString());
        } catch { /* 端点跨宿主 / 边界不合法：跳过该切片 */ }
      });
      return parts.join('|') || cur.toString();
    },
    { s1: startSel, o1: startOffset, s2: endSel, o2: endOffset, fromEnd: endNodeFromEnd },
  );
}

interface AtState {
  color: string;
  bg: string;
  sizePx: number;
  weight: string;
  spans: number;
  fonts: number;
  nestedSpans: number;
  html: string;
}

/** 读取某个正文节点内「选区起点处」的 computed 三项 + 结构。 */
async function readAt(page: Page, hostSel: string): Promise<AtState> {
  return page.evaluate((sel) => {
    const host = document.querySelector(sel) as HTMLElement | null;
    if (!host) throw new Error('host missing: ' + sel);
    const s = window.getSelection();
    let node: any = s && s.rangeCount ? s.getRangeAt(0).startContainer : host.firstChild;
    let offset = s && s.rangeCount ? s.getRangeAt(0).startOffset : 0;
    if (node && node.nodeType === 1) {
      let guard = 0;
      while (node && node.nodeType === 1 && node.childNodes.length && guard++ < 100) {
        const child: any = node.childNodes[Math.min(offset, node.childNodes.length - 1)];
        if (!child) break;
        node = child;
        offset = 0;
      }
    }
    const el: any = node ? (node.nodeType === 3 ? node.parentElement : node) : host;
    const cs = getComputedStyle(el);
    return {
      color: String(cs.color || ''),
      bg: String(cs.backgroundColor || ''),
      sizePx: parseFloat(String(cs.fontSize || '0')),
      weight: String(cs.fontWeight || ''),
      spans: host.querySelectorAll('span').length,
      fonts: host.querySelectorAll('font').length,
      nestedSpans: Array.from(host.querySelectorAll('span')).filter((sp) => !!(sp.parentElement && sp.parentElement.closest('span'))).length,
      html: host.innerHTML,
    };
  }, hostSel);
}

test('跨块级元素选区（两个 p）：三项 computed style 全部保留，且不产生嵌套 span', async ({ browser }) => {
  const { context, page } = await openProbe(browser);
  await mountHtml(page, HOST, '<p>ALPHA</p><p>BETA</p>');
  /* 绝对纯文本偏移：'ALPHA' + 'BETA' 共 9 个字符 ⇒ 选区覆盖两个 <p> */
  const selected = await selectAcross(page, HOST_SEL_3, 0, HOST_SEL_3, 9);
  expect(selected).toContain('ALPHA');
  expect(selected).toContain('BETA');

  const color = String(await applyCommand(page, 'color'));
  const bg = String(await applyCommand(page, 'bg'));
  const sizePx = Number(await applyCommand(page, 'size'));

  /* 两块都必须同时具备三项（旧实现在跨块时直接 return false，什么都不写） */
  for (const sel of [`${HOST_SEL_3} p:nth-child(1)`, `${HOST_SEL_3} p:nth-child(2)`]) {
    const st = await page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement;
      const inner = (el.firstElementChild as HTMLElement) || el;
      const cs = getComputedStyle(inner);
      return { color: cs.color, bg: cs.backgroundColor, size: parseFloat(cs.fontSize) };
    }, sel);
    expect(st.color, sel + ' 颜色').toBe(color);
    expect(st.bg, sel + ' 背景').toBe(bg);
    expect(st.size, sel + ' 字号').toBeCloseTo(sizePx, 0);
  }

  const st = await readAt(page, HOST_SEL_3);
  expect(st.nestedSpans).toBe(0);
  expect(st.fonts).toBe(0);
  expect(st.spans).toBeGreaterThanOrEqual(2);
  await context.close();
});

test('跨两个大纲行（两个独立 contenteditable）：三项样式落到两行', async ({ browser }) => {
  const { context, page } = await openProbe(browser);
  /* 行 B 先建，保证 id 顺序与真实大纲一致（A 在前） */
  await mountHtml(page, 'probe-rt3b', '<p>DELTA</p>');
  await mountHtml(page, HOST, '<p>ALPHA</p>');
  await page.evaluate(({ a, b }) => {
    const ha = document.querySelector(a) as HTMLElement;
    const hb = document.querySelector(b) as HTMLElement;
    hb.parentElement?.insertBefore(ha, hb);
    ha.focus();
  }, { a: HOST_SEL_3, b: HOST_B_SEL_3 });

  const selected = await selectAcross(page, HOST_SEL_3, 0, HOST_B_SEL_3, 5);
  expect(selected, '跨行选区未覆盖两行文字：' + selected).toContain('ALPHA');
  expect(selected, '跨行选区未覆盖两行文字：' + selected).toContain('DELTA');

  const color = String(await applyCommand(page, 'color'));
  const bg = String(await applyCommand(page, 'bg'));
  const sizePx = Number(await applyCommand(page, 'size'));

  for (const sel of [`${HOST_SEL_3} p`, `${HOST_B_SEL_3} p`]) {
    const st = await page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement;
      const inner = (el.firstElementChild as HTMLElement) || el;
      const cs = getComputedStyle(inner);
      return { color: cs.color, bg: cs.backgroundColor, size: parseFloat(cs.fontSize) };
    }, sel);
    expect(st.color, sel + ' 颜色').toBe(color);
    expect(st.bg, sel + ' 背景').toBe(bg);
    expect(st.size, sel + ' 字号').toBeCloseTo(sizePx, 0);
  }
  await context.close();
});

test('两条命令之间有整块重渲染：第二次命令仍落在同一段文字（实机分支）', async ({ browser }) => {
  const { context, page } = await openProbe(browser);
  await mountHtml(page, HOST, '<p>ALPHA BETA GAMMA</p>');
  await selectAcross(page, HOST_SEL_3, 0, HOST_SEL_3, 11);

  const color = String(await applyCommand(page, 'color'));
  expect((await readAt(page, HOST_SEL_3)).color).toBe(color);

  /* 模拟 renderMain：按当前 HTML 重建编辑节点（旧节点被替换 ⇒ 克隆 Range 必然失效） */
  await page.evaluate((sel) => {
    const old = document.querySelector(sel) as HTMLElement;
    const fresh = document.createElement('div');
    fresh.className = 'text';
    fresh.setAttribute('data-id', old.getAttribute('data-id') || 'probe-rt3');
    fresh.setAttribute('contenteditable', 'true');
    fresh.innerHTML = old.innerHTML;
    old.replaceWith(fresh);
  }, HOST_SEL_3);

  const bg = String(await applyCommand(page, 'bg'));
  const sizePx = Number(await applyCommand(page, 'size'));

  const st = await page.evaluate((sel) => {
    const host = document.querySelector(sel) as HTMLElement;
    const span = host.querySelector('span') as HTMLElement;
    const cs = getComputedStyle(span || host);
    return { color: cs.color, bg: cs.backgroundColor, size: parseFloat(cs.fontSize), html: host.innerHTML };
  }, HOST_SEL_3);
  expect(st.color, '重渲染后颜色丢失').toBe(color);
  expect(st.bg, '重渲染后加不上背景').toBe(bg);
  expect(st.size, '重渲染后加不上字号').toBeCloseTo(sizePx, 0);
  await context.close();
});

test('document.execCommand undo/redo 往返后三项样式不丢失', async ({ browser }) => {
  const { context, page } = await openProbe(browser);
  await mountHtml(page, HOST, '');
  /* 先以真实键盘输入落字：让原生 undo 栈里确实存在一条编辑记录 */
  await page.locator(HOST_SEL_3).click();
  await page.keyboard.type(FIXTURE_TEXT);
  await selectAcross(page, HOST_SEL_3, 0, HOST_SEL_3, TARGET_TEXT.length);

  const color = String(await applyCommand(page, 'color'));
  const bg = String(await applyCommand(page, 'bg'));
  const sizePx = Number(await applyCommand(page, 'size'));
  const before = await readAt(page, HOST_SEL_3);
  expect(before.color).toBe(color);
  expect(before.bg).toBe(bg);
  expect(before.sizePx).toBeCloseTo(sizePx, 0);

  const undoOk = await page.evaluate(() => document.execCommand('undo'));
  const redoOk = await page.evaluate(() => document.execCommand('redo'));
  /* 两条命令都必须真的执行（返回 false 说明该宿主不支持原生撤销栈，断言就失去意义） */
  expect(undoOk, 'document.execCommand(undo) 未执行').toBe(true);
  expect(redoOk, 'document.execCommand(redo) 未执行').toBe(true);

  /* 重新框住同一段文字再断言（undo/redo 会重建文本节点，旧 Range 已失效）。
     偏移量按当前纯文本长度夹紧，避免 undo 改变了文本长度时抛 IndexSizeError。 */
  const len = await page.evaluate((sel) => ((document.querySelector(sel) as HTMLElement).textContent || '').length, HOST_SEL_3);
  await selectAcross(page, HOST_SEL_3, 0, HOST_SEL_3, Math.min(TARGET_TEXT.length, len));
  const after = await readAt(page, HOST_SEL_3);
  expect(after.color, 'undo/redo 后颜色丢失').toBe(color);
  expect(after.bg, 'undo/redo 后背景丢失').toBe(bg);
  expect(after.sizePx, 'undo/redo 后字号丢失').toBeCloseTo(sizePx, 0);
  expect(after.fonts).toBe(0);
  await context.close();
});

test('连续点击颜色 / 背景 / 字号后输入文字：新文字同时具备三项（typing style）', async ({ browser }) => {
  const { context, page } = await openProbe(browser);
  await mountHtml(page, HOST, '');
  await page.locator(HOST_SEL_3).click();

  const color = String(await applyCommand(page, 'color'));
  const bg = String(await applyCommand(page, 'bg'));
  const sizePx = Number(await applyCommand(page, 'size'));

  await page.locator(HOST_SEL_3).click();
  await page.keyboard.type('TYPED');
  await page.waitForTimeout(80);

  const st = await page.evaluate((sel) => {
    const host = document.querySelector(sel) as HTMLElement;
    if ((host.textContent || '').indexOf('TYPED') < 0) return null;
    /* 取「最后一个字符」所在的最深元素：它的 computed 三项代表新输入文字的样式 */
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    let last: any = null;
    let n: Node | null = walker.nextNode();
    while (n) { last = n; n = walker.nextNode(); }
    if (!last) return null;
    const el: HTMLElement = (last.parentElement as HTMLElement) || host;
    const cs = getComputedStyle(el);
    const nested = Array.from(host.querySelectorAll('span')).filter((sp) => !!(sp.parentElement && sp.parentElement.closest('span'))).length;
    return { color: cs.color, bg: cs.backgroundColor, size: parseFloat(cs.fontSize), nested, spans: host.querySelectorAll('span').length, html: host.innerHTML };
  }, HOST_SEL_3);

  expect(st, '未找到输入的文字').not.toBeNull();
  expect(st!.color, '输入文字没有颜色').toBe(color);
  expect(st!.bg, '输入文字没有背景').toBe(bg);
  expect(st!.size, '输入文字没有字号').toBeCloseTo(sizePx, 0);
  /* 逐字输入不得产生逐字嵌套的 span（上一键包好的 span 应被复用） */
  expect(st!.nested, 'typing style 产生了嵌套 span：' + String(st!.html)).toBe(0);
  await context.close();
});
