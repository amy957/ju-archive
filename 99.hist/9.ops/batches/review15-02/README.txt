review15-02 · ISSUE-002 强杀窗口「明文+旧密文」双重态证据
批次：review15-02（2026-11-06T05:03Z）
DIST_BEFORE：4,715,494 B / AF554472585AFCFE6D69CB871197745208EA76C8F561CC5D598BF36974270509
DIST_AFTER ：同上（源零改动，prepare 重建字节/哈希全等）
变更文件：
  6.P0-T3基线/m07-vite/tests/v21-review12-preimport-lifecycle.spec.ts
  6.P0-T3基线/m07-vite/src-tauri/src/main.rs
预算：2 文件；diff 约 47 行（≤50），E/F 断言与 save_state 回填语义零改动
证伪：临时把 boot.ts 原子调用拆回 save_state + clear_encrypted，G 转红；boot.ts 已按原字节复原（890-892 与复原前一致）
edge_profile*：匹配 0 项，未删除任何内容
