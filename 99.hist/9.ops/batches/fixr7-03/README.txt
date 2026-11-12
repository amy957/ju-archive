fixr7-03 批次材料（2026-11-02 12:54Z）
批次：fix7-03/20 · ISSUE-003 关闭前加密写盘失败可感知并收敛
DIST_BEFORE：4,705,196 B / 9E6F1FAFE10EF0462DA7085DB2CCF972223A49D5FC0A116DA5272C867AA954AB
DIST_AFTER ：4,705,410 B / 3583C822F21762D1141723FE5766BD4FEAD23BA9617BE298402D35D9B29DD221
文件：probe-unconverged.mjs · probe-green.log · probe-red.log · pw-close.log · hash-registry.log · verify-all.log
探针口径：假 Tauri 桥令 save_state(encStore) 恒拒绝；注入 ui.encrypted/encKey 后追加节点并关窗；
断言 close 前 enc:req ≥3（至少 2 次重试）、失败 toast、report_error 与 __juLog 的 close-persist-unconverged。
证伪：persistNowAwait 内插回 if (!_persistDirty && !persistTimer) return; → encReq=2、RESULT=FAIL。
edge_profile*：90过程材料/tmp 下匹配 0 项，跳过清理（未删其他内容）
