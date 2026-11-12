// JU 大库基准冒烟：注入 .state.json，测启动/切换/搜索
// 运行：
//   JU_URL=http://localhost:8080/v2.0-frozen.html \
//   JU_BENCH_STATE=./ju-bench-30k.state.json \
//   npx playwright test tests/bench-smoke.spec.ts
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
const APP_URL = process.env.JU_URL || 'http://localhost:8080/v2.0-frozen.html';
const STATE_FILE = process.env.JU_BENCH_STATE || path.join(__dirname, '..', 'ju-bench-30k.state.json');
test('大库基准：加载 3 万节点并测启动/切换', async ({ page }) => {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  await page.goto(APP_URL);
  await page.waitForSelector('#topbar');
  // 注入 state
  await page.evaluate((s) => {
    localStorage.clear();
    // @ts-ignore
    initStore(s);
    // @ts-ignore
    ensureCalendarRoot();
    // @ts-ignore
    forceRender();
  }, state);
  // 等待首屏渲染
  await page.waitForSelector('#content .outline', { timeout: 30000 });
  // 测启动耗时
  const t0 = Date.now();
  await page.waitForSelector('#content .outline .text', { timeout: 30000 });
  console.log('首屏渲染耗时', Date.now() - t0, 'ms');
  // 测切换视图
  const t1 = Date.now();
  await page.click('.tb-nav-btn[data-view="mindmap"]');
  await page.waitForSelector('.mm-wrap', { timeout: 30000 });
  console.log('切思维导图耗时', Date.now() - t1, 'ms');
  const t2 = Date.now();
  await page.click('.tb-nav-btn[data-view="outline"]');
  await page.waitForSelector('#content .outline', { timeout: 30000 });
  console.log('切回大纲耗时', Date.now() - t2, 'ms');
  // 测搜索
  const t3 = Date.now();
  await page.fill('#searchInput', '项目');
  await page.waitForTimeout(600);
  console.log('搜索耗时', Date.now() - t3, 'ms');
});
