批次：review22-04/7 · ISSUE-004（layout/main 桌面探测同源）
时间：2026-11-08（UTC+8）
目标：layout.ts 与 main.ts 桌面探测收敛为 utils.hasTauriInvoke
DIST_BEFORE：4,716,598 B / D5DC035A…42DE7
DIST_AFTER ：4,716,598 B / D5DC035A…42DE7（未重建）
变更文件：
  src/core/utils.ts —— 新增 hasTauriInvoke()（core.invoke / tauri.invoke 双通道）
  src/main.ts —— hasDesktopInvoke 改为调用 utils.hasTauriInvoke()
  src/ui/layout.ts —— isDesktop 改为 hasTauriInvoke() + 保留 electron/nw
  scripts/check-deps-wired.mjs —— 新增两文件同源断言
验收：check-deps-wired PASS；verify-all EXIT 0；hash-registry RESULT=PASS
证据：gate-green.log / gate-neg.log / gate-green-restore.log
      verify-all.log / hash-registry.log
edge_profile*：90过程材料/tmp/ 下匹配 0 项，已跳过（未删任何文件）
