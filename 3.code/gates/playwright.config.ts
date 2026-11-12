import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
/* Chromium 路径解析（不绑定任何用户名 / 用户目录）：
   1. 环境变量 JU_CHROMIUM_PATH 优先（跨环境可移植，CI 由 workflow 注入）
   2. 系统级安装位置（Windows: Program Files；POSIX: /usr/bin 等）
   3. 都不存在 → 不传 executablePath，Playwright 用自带 bundled Chromium
      （此时需 `npx playwright install chromium`，Chromium 版本会变，
       bench 基线需重测，见 P0-T3/性能预算.md §二） */
const CHROMIUM_CANDIDATES = [
  process.env.JU_CHROMIUM_PATH,
  process.platform === 'win32'
    ? path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe')
    : null,
  /* T-02：按用户安装的 Chrome（无需下载 bundled chromium / chromium_headless_shell-*） */
  process.platform === 'win32'
    ? path.join(process.env['LOCALAPPDATA'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
    : null,
  process.platform === 'win32'
    ? path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Chromium', 'Application', 'chrome.exe')
    : null,
  process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : null,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/local/bin/chromium',
].filter(Boolean);
const chromiumPath = CHROMIUM_CANDIDATES.find((p) => {
  try { return fs.existsSync(p); } catch { return false; }
});
if (chromiumPath) {
  console.log(`[playwright] Chromium: ${chromiumPath}`);
} else {
  /* T-02：无系统 Chrome 且未安装 bundled chromium 时，PW 步骤会因缺依赖报错；
     仅作提示，不自动下载、不改产品源码（Node 门禁不受影响）。 */
  console.log('[playwright] Chromium: 使用 Playwright 自带（需 npx playwright install chromium；缺失时可跳过 PW 步骤）');
}
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
