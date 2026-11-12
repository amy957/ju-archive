import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
/* Chromium 路径解析：
   1. 环境变量 JU_CHROMIUM_PATH 优先（跨环境可移植）
   2. 本机系统 Chromium（Linux 默认 /usr/local/bin/chromium）
   3. 都不存在 → 不传 executablePath，Playwright 用自带浏览器
      （此时需 `npx playwright install chromium`，Chromium 版本会变，
      bench 基线需重测，见 ../6.P0-T3基线/step9/P0-T3-step9-性能预算.md §二） */
const CHROMIUM_CANDIDATES = [
  process.env.JU_CHROMIUM_PATH,
  process.platform === 'win32' ? 'C:\\Program Files\\Chromium\\chrome.exe' : null,
  '/usr/local/bin/chromium',
].filter(Boolean);
const chromiumPath = CHROMIUM_CANDIDATES.find((p) => {
  try { return fs.existsSync(p); } catch { return false; }
});
if (chromiumPath) {
  console.log(`[playwright] Chromium: ${chromiumPath}`);
} else {
  console.log('[playwright] Chromium: 使用 Playwright 自带（需 npx playwright install chromium）');
}
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  // ISSUE-016: a single json reporter only. Two `json` entries wrote the same
  // payload twice (results.json + reference-semantics-results.json); nothing in
  // the repo consumes the latter, so it was removed here.
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
