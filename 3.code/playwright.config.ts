import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * M1-3 · Playwright 配置（3 标签并发收敛测试）
 *
 * Chromium 解析顺序：
 *   1) `JU_CHROMIUM_PATH`（跨环境可移植，CI 由流水线注入）
 *   2) 系统安装的 Chrome / Chromium
 *   3) 回落 Playwright 自带 Chromium（`npx playwright install chromium`）
 *
 * 说明：本机环境下浏览器进程到 127.0.0.1 / localhost 的入站连接被系统策略阻断
 * （curl / PowerShell / 同进程 Vite 均超时），因此 `tests/concurrency.spec.ts`
 * 以 Playwright 路由拦截（`context.route`）把 `baseURL` 的请求映射到 Vite 构建产物，
 * 页面仍运行在 `http://localhost:5173` 这一真实 HTTP 源上（localStorage / BroadcastChannel
 * 的跨标签语义与真实服务一致）。详见 `_报告与元数据/M1-3-PLAYWRIGHT-CONCURRENCY-REPORT-2026-10-24.md`。
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROMIUM_CANDIDATES = [
  process.env.JU_CHROMIUM_PATH,
  process.platform === 'win32'
    ? path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe')
    : null,
  process.platform === 'win32'
    ? path.join(process.env['LOCALAPPDATA'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
    : null,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean) as string[];

const chromiumPath = CHROMIUM_CANDIDATES.find((p) => {
  try { return fs.existsSync(p); } catch { return false; }
});
if (chromiumPath) console.log(`[playwright] Chromium: ${chromiumPath}`);
else console.log('[playwright] Chromium: 使用 Playwright 自带（需 npx playwright install chromium）');

export default defineConfig({
  testDir: './tests',
  /* 1000 次随机操作 × 3 标签 + 每 10 次 200ms 同步窗口 ⇒ 单测约 25–60s；给足余量 */
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  /* 构建产物目录由 spec 内的 beforeAll 重新生成；此处仅固定工作根，避免 cwd 漂移 */
  metadata: { projectRoot: __dirname },
});
