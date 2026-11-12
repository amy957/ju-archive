# sync-ci-gate 回执（2026-11-05）

| 项 | 内容 |
| --- | --- |
| 批次 | sync-ci-gate |
| 变更文件 | `8.发布与CI/ci/ci-gate.yml`（+3 step，14 行） |
| 禁改核对 | `.github/workflows/ci-gate.yml` 零改动；其余 step 零改动 |
| 验收命令 | `Select-String -Path '8.发布与CI\ci\ci-gate.yml' -Pattern 'check-manifest','check-dist-parity','check-web-parity'` |
| 结果 | 2 / 1 / 1 命中；两文件 SHA256 全等（2146B930…31DCF） |
| 证伪 | 删去三步块后同命令 0 / 0 / 0 命中；复原后 2 / 1 / 1，哈希与 canonical 全等 |
| 门禁 | 登记器 PARTY_COUNT=66 / drift 0 / RESULT=PASS；verify.js all Exit 0（静态 0 · Node 503 · PW 167 passed + 4 skipped = 171 · bench 0 失败 / 最大恶化 0.0%） |
| 证据 | `2.项目日志/sync-ci-gate-hash-registry-2026-11-05.txt`、`2.项目日志/sync-ci-gate-verify-all-2026-11-05.txt` |
| 遗留 | 无；canonical 未改，dist/release/HEAD.json 零写入 |
