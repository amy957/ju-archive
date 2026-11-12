批次：review19-03/9 · ISSUE-003 固定端口静默退出修复
时间：2026-11-07 23:0x (+08:00)
DIST_BEFORE：4,716,598 B / d5dc035a…42de7（dist/index.html）
DIST_AFTER ：4,716,598 B / d5dc035a…42de7（未重建，PW 重建后同哈希）
变更：6.P0-T3基线/m07-vite/src-tauri/src/main.rs（TCP 47823 守卫 → Windows 命名 mutex + 聚焦事件 + 原生提示）
       测试 second_instance_guard_fails → second_instance_guard_detects_running（pid+纳秒临时名）
验收：cargo test --manifest-path 6.P0-T3基线/m07-vite/src-tauri/Cargo.toml → 16 passed
      99.开发辅助工具\node.exe 6.P0-T3基线\step9\verify-hash-registry.mjs → RESULT=PASS drift=0
      99.开发辅助工具\node.exe 6.P0-T3基线\step9\scripts\verify.js all → Exit 0
      99.开发辅助工具\node.exe 6.P0-T3基线\m07-vite\scripts\check-release-parity.mjs → Exit 0
证伪：临时用例 falsify_old_port_guard（随后删除）证明 acquire_instance_guard(0) 下旧断言 is_none() 必失败
禁改核对：save_state/save_backup 写路径、数据目录、Cargo.toml、Cargo.lock 零改动
遗留：exe/setup 未重打包，提示与聚焦须发版批重建后实机双开验证
edge_profile*：90过程材料/tmp 匹配 0 项，已跳过删除
