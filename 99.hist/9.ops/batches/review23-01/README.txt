review23-01/7 批（ISSUE-001 发布件滞后 · 发布阻塞=是）
时间：2026-11-08 17:00–17:07（UTC+8）
链路：cargo test(22 passed) → build-all（1f/1g/2/3/3b/4/5/6/6b）
DIST_BEFORE 4,716,598 B / D5DC035A…42DE7 / 15:35
DIST_AFTER  4,716,499 B / 258EC3910CADD7966645252BB06B71BE0A22D553CA8E8D7D45F4A4EC079EC017
EXE_BEFORE  7,363,072 B / 215461DB…
EXE_AFTER   7,363,584 B / B530485C782686F9FB9FA4676CC978A582B4B6CC058A17A9E43B69467C1BCD21
SETUP_AFTER 4,463,198 B / 195C0115C20BBD8308AC664E5A0DC5833322432859ED6F06B37827488B99DD14
CHECKSUMS   258 B / 3FD30694B1E512CCF333876B8BD51EA243FCE34689D2D5933EAB7CA0F539AB75（3 项复算一致）
归档目录：8.发布与CI/release/v2.1.0-2026-11-08/（旧归档整体让位为 .prev-1794128450506）
约束遵守：不手改归档字节、不手写 checksums、src/** 与 src-tauri/src/** 与 HEAD.json 零改动
证据：cargo-test.txt / build-all.txt / dist-parity.txt / release-parity.txt /
      falsify-dist-red.txt / falsify-release-red.txt / falsify-dist-restored.txt /
      falsify-release-restored.txt / hash-registry.txt / verify-all.txt / _mtimes.txt
证伪口径：dist/index.html 与 target/release/JU.exe 的 mtime 回拨至 15:35（旧件未重建态），
      两命令应 Exit 1 并出现「dist 早于」与「EXE_AFTER_SRC」；复原原 mtime 后应 Exit 0
edge_profile* 匹配 0 项（已跳过，未删除任何其他文件）
