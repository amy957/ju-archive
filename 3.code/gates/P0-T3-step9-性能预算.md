# P0-L3 性能预算（v2.0-frozen）
> 冻结时间：2026-10-09（Step9）
> 数据来源：`P0后基准对比.md` §4.1（本机固定硬件，Chromium 146，Node v22）
> 用途：为后续变更提供"是否引入性能回归"的判定阈值
> 关联：`scripts/compare-bench.js --exclude-op=commitRewriteAllText`（§三）
## 一、预算表
| 路径 | 本机量级（median） | 预算阈值 | 依据 |
|---|---:|---:|---|
| `commitNonLight` @ 100 | 0.1 ms | ≤ 1 ms | 结构共享后优于基线 |
| `commitNonLight` @ 500 | 0.2 ms | ≤ 1 ms | 结构共享后 -75% |
| `commitLight` @ 500 | < 0.1 ms | ≤ 1 ms | 计时分辨率内 |
| `undoRedo` @ 500 | 2.5 ms | ≤ 5 ms | 与 `safeClone` 同量级 |
| `safeClone` @ 5000 | 5.7 ms | ≤ 10 ms | 上游基线 |
| `juProduce` @ 5000 | 2.8 ms | ≤ 10 ms | 与 `safeClone` 同级 |
| `commitRewriteAllText` @ 500 | 2.1 ms | **排除** | 无真实 action，边界探针 |
量级数据以 `P0后基准对比.md` §4.1 为准，本表不复制原始采样。
## 二、判定规则
1. **相对回归**：`compare-bench.js` 的 `delta > +100%` 规则（退出码 2）——防"本次变更比基线慢一倍以上"。
2. **绝对劣化**：本表阈值——防"长周期累积让绝对耗时超出预算"。
3. 两规则互补：delta 规则用于 CI/本地卡口，预算表用于人工复核与里程碑检查。
4. **排除场景**（`--exclude-op`）：不参与判定、不计入退出码，仅记录。
## 三、与 `compare-bench.js` 的关系
- **CI 卡口**：由 `compare-bench.js` 承担，规则为 `delta > +100% → exit 2`。
- **白名单排除**：`commitRewriteAllText` 无真实 action（纯边界探针），通过
  `--exclude-op=commitRewriteAllText` 从硬门禁排除，输出保留作边界记录
  （表格标记 `⏭ 排除（--exclude-op）`，不参与退出码）。决策见
  `结构共享验收记录.md` §6.3 BENCH-ACT-1（选 A）。
- **本地运行**：`npm run verify:bench`（内部透传 `--exclude-op`）。
## 四、测量环境约束
| 项 | 值 | 变更时的影响 |
|---|---|---|
| 浏览器 | 系统 Chromium 146 | 升级/降级 → 预算表需重新标定 |
| Node | v22 | 大版本变更 → 重跑基线 |
| 视口 | 1280×800 | 影响渲染类场景，本套主要为纯计算 |
| 采样 | warmup 3 + 正式 N（commit 类 50，merge 类 100） | 不变 |
| 平台 | Linux（沙箱） | 跨平台数据不可直接对比 |
若变更上述任一项，需重跑 `bench-p0-baseline.json` 与 `bench-p0-after-l3.json`，
并在本表更新量级。
## 五、更新流程
1. 新场景加入 `tests/bench-p0-after-l3.spec.ts`；
2. 跑 `npm run verify:bench` 得到 median；
3. 在本表 §一 新增行，标注依据；
4. 若 median 超阈值：先评估原因（环境/场景/实现），再决定是否调整阈值；
5. 排除场景变更需同步 `scripts/verify.js` 的 `bench()` 参数与 §三 说明。
