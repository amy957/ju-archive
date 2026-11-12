import { test, expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/**
 * M07 · 富文本格式写入的「防失焦 + 焦点归还」回归（批次1 / 批次3 口径）
 *
 * 历史缺陷链路：
 *   选中文字 → 点右栏色块 → 正文 contenteditable blur → `document.activeElement`
 *   变成浮层按钮（不在 `#content` 内）⇒ 原生选区在命令执行时已失效
 *   ⇒ 第二次点「背景 / 字号」时无选区可写（三项不能同时应用）。
 *
 * 上一轮曾用「写入期间拦截 renderMain」掩盖该症状；本轮按任务口径改为两条根因修复：
 *   批次1：颜色 / 背景 / 字号的全部触发点在 mousedown 阶段 preventDefault ⇒ 焦点不离开正文；
 *   批次2：写入引擎改为整段纯文本重建，写完显式提交模型并把焦点 / 选区还给编辑宿主；
 *   批次3：撤销 renderMain 侧的重绘拦截（标记只保留为诊断用）。
 *
 * 本 spec 的断言口径（全部读取真实 DOM / 真实 Selection，不 mock 任何模块）：
 *   ① 真实鼠标 mousedown 三个触发按钮：#content 内的编辑宿主始终是 activeElement，
 *      选区原样保留（防失焦拦截生效）；
 *   ② 焦点已在编辑区外时调用 applyInlineStyle：写入成功、焦点与选区被归还、颜色落到 DOM 上；
 *   ③ 重绘拦截已撤销：格式写入区间内 renderMain 照样按正常判据重建主面板（不再被跳过）。
 */
const BASE = 'http://localhost:5173';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const HOST_ID = 'probe-guard';
const HOST_SEL = '#content .text[data-id="probe-guard"]';
const FIXTURE_TEXT = 'ALPHA BETA GAMMA';
const TARGET_TEXT = 'ALPHA BETA';
const SENTINEL_ID = 'probe-guard-sentinel';
/* 三个触发点：颜色 / 背景 / 字号（任务口径的「全部按钮」） */
const TRIGGER_CMDS = ['color', 'bg', 'size'] as const;

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
    () => !!(window as any).JU
      && typeof (window as any).JU.applyInlineStyle === 'function'
      && typeof (window as any).JU.isEditorFormatting === 'function',
  );
  return { context, page, pageErrors };
}

/** 造夹具：`#content` 内一个真实 contenteditable 正文节点，并选中前两段文字。 */
async function mountFixture(page: Page): Promise<void> {
  await page.evaluate(
    ({ sel, id, text, targetLen }) => {
      const sb = document.getElementById('sidebarRight');
      if (sb) sb.classList.remove('collapsed');
      const content = document.getElementById('content') || document.body;
      let host = document.querySelector(sel) as HTMLElement | null;
      if (!host) {
        host = document.createElement('div');
        host.className = 'text';
        host.setAttribute('data-id', id);
        host.setAttribute('contenteditable', 'true');
        content.appendChild(host);
      }
      host.textContent = text;
      host.focus();
      const node = host.firstChild as Text;
      const r = document.createRange();
      r.setStart(node, 0);
      r.setEnd(node, targetLen);
      const s = window.getSelection();
      if (!s) throw new Error('no selection');
      s.removeAllRanges();
      s.addRange(r);
    },
    { sel: HOST_SEL, id: HOST_ID, text: FIXTURE_TEXT, targetLen: TARGET_TEXT.length },
  );
}

test('批次1：真实 mousedown 颜色 / 背景 / 字号按钮不会把焦点从正文抢走', async ({ browser }) => {
  const { context, page, pageErrors } = await openProbe(browser);

  for (const cmd of TRIGGER_CMDS) {
    await mountFixture(page);
    const btn = page.locator(`[data-cmd="${cmd}"]`);
    const box = await btn.boundingBox();
    expect(box, `按钮 [data-cmd="${cmd}"] 不可见（右栏未展开？）`).not.toBeNull();

    /* 真实鼠标按下（只有真实事件才会触发浏览器的「聚焦默认行为」） */
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    const during = await page.evaluate(() => {
      const ae = document.activeElement as HTMLElement | null;
      return {
        activeInEditor: !!(ae && ae.closest && ae.closest('#content')),
        activeIsHost: !!document.querySelector('#content .text[data-id="probe-guard"]')
          && ae === document.querySelector('#content .text[data-id="probe-guard"]'),
        selected: String(window.getSelection()),
      };
    });
    await page.mouse.up();

    expect(during.activeInEditor, `${cmd}: 按下按钮后焦点已离开正文（防失焦拦截未生效）`).toBe(true);
    expect(during.activeIsHost, `${cmd}: activeElement 不是编辑宿主`).toBe(true);
    expect(during.selected, `${cmd}: 按下按钮后正文选区丢失`).toBe(TARGET_TEXT);

    /* 关掉可能弹出的色板 / 字号面板，再重造夹具进入下一个按钮 */
    await page.mouse.click(8, 8);
  }

  expect(pageErrors.filter((t) => /execCommand/i.test(t))).toEqual([]);
  await context.close();
});

test('批次2：焦点已在编辑区外仍能写入，且写完把焦点 / 选区还给编辑宿主', async ({ browser }) => {
  const { context, page, pageErrors } = await openProbe(browser);
  await mountFixture(page);

  const facts = await page.evaluate(
    ({ sel }) => {
      const JU = (window as any).JU;
      const host = document.querySelector(sel) as HTMLElement;
      const selection = window.getSelection()!;
      const before = String(selection);

      /* 模拟「焦点离开正文（真实 blur 路径，且不在 #content 内）」 */
      let outside = document.querySelector('[data-cmd="color"]') as HTMLElement | null;
      if (!outside) {
        outside = document.createElement('button');
        outside.id = 'probe-guard-outside';
        document.body.appendChild(outside);
      }
      outside.focus();
      const focusLeftEditor = document.activeElement !== host;

      const guardBefore = JU.isEditorFormatting() === true;
      /* 焦点已在编辑区外仍调用写入引擎（实机正是这条分支） */
      const ok = JU.applyInlineStyle('color', 'rgb(255, 0, 0)');
      const guardDuring = JU.isEditorFormatting() === true;

      const span = host.querySelector('span') as HTMLElement | null;
      return {
        before,
        focusLeftEditor,
        guardBefore,
        ok,
        guardDuring,
        hostAlive: host.isConnected,
        activeIsHost: document.activeElement === host,
        after: String(window.getSelection()),
        color: span ? getComputedStyle(span).color : '',
      };
    },
    { sel: HOST_SEL },
  );

  expect(facts.before, '夹具选区未建立').toBe(TARGET_TEXT);
  expect(facts.focusLeftEditor, '夹具未模拟出「焦点离开正文」的实机分支').toBe(true);
  expect(facts.guardBefore, '写入前格式区间标记应为关闭态').toBe(false);
  expect(facts.ok, '焦点在编辑区外时 applyInlineStyle 应仍能写入').toBe(true);
  expect(facts.guardDuring, '写入期间格式区间标记未置位').toBe(true);
  expect(facts.hostAlive, '写入期间编辑宿主被替换').toBe(true);
  expect(facts.activeIsHost, '写入后焦点未归还编辑宿主').toBe(true);
  expect(facts.after, '写入后选区丢失').toBe(TARGET_TEXT);
  expect(facts.color).toBe('rgb(255, 0, 0)');

  /* 标记只是诊断用途：两帧 + 兜底定时器之后必须自动回落 */
  await page.waitForFunction(() => (window as any).JU.isEditorFormatting() === false, undefined, { timeout: 5_000 });

  expect(pageErrors.filter((t) => /execCommand/i.test(t))).toEqual([]);
  await context.close();
});

test('批次3：格式写入区间内 renderMain 不再被拦截（主面板按正常判据重建）', async ({ browser }) => {
  const { context, page } = await openProbe(browser);
  await mountFixture(page);

  /* 对照组：焦点不在正文（非编辑态）+ 无标记 ⇒ renderMain 必定重建主面板 */
  const control = await page.evaluate(
    ({ sentinel }) => {
      const content = document.getElementById('content') as HTMLElement;
      const mark = document.createElement('div');
      mark.id = sentinel;
      content.appendChild(mark);
      const outside = document.createElement('button');
      outside.id = 'probe-guard-outside';
      document.body.appendChild(outside);
      outside.focus();
      const focusLeft = document.activeElement !== document.body && !(document.activeElement as HTMLElement).isContentEditable;
      (window as any).JU.renderMain();
      return { focusLeft, rebuilt: !document.getElementById(sentinel) };
    },
    { sentinel: SENTINEL_ID },
  );
  expect(control.focusLeft, '夹具未能让焦点离开正文').toBe(true);
  expect(control.rebuilt, '对照组未重建：夹具条件不足').toBe(true);

  /* 实验组：同样条件 + 置位格式写入标记 ⇒ 必须与对照组一致（重建），
     即 renderMain 已不再读取该标记（批次3 撤销重绘拦截）。 */
  await mountFixture(page);
  const during = await page.evaluate(
    ({ sel, sentinel }) => {
      const JU = (window as any).JU;
      const host = document.querySelector(sel) as HTMLElement;
      const mark = document.createElement('div');
      mark.id = sentinel;
      host.appendChild(mark);
      const outside = (document.getElementById('probe-guard-outside') as HTMLElement | null)
        || (document.body.appendChild(document.createElement('button')) as HTMLElement);
      outside.focus();
      JU.beginEditorFormatting();
      const active = JU.isEditorFormatting() === true;
      JU.renderMain();
      const rebuilt = !document.getElementById(sentinel);
      JU.endEditorFormatting();
      return { active, rebuilt };
    },
    { sel: HOST_SEL, sentinel: SENTINEL_ID },
  );
  expect(during.active, 'beginEditorFormatting 未置位标记').toBe(true);
  expect(during.rebuilt, '格式写入区间内 renderMain 仍被跳过：重绘拦截未撤销').toBe(true);

  /* 标记本身仍会自动回落（仅诊断用途） */
  await page.waitForFunction(() => (window as any).JU.isEditorFormatting() === false, undefined, { timeout: 5_000 });

  await context.close();
});
