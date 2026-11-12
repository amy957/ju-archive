批次：review17-01/13（ISSUE-001 复核失败保持明文态）
时间：2026-11-07（UTC+8）
范围：6.P0-T3基线/m07-vite（spec 侧 1 文件；boot.ts 净零 diff）
变更：v21-review12-preimport-lifecycle.spec.ts 新增负向用例 H（r14Mock 增 rereadThrow）
缺陷原文：boot.ts:900 catch (e) { hasEnc = true; }（现行基线已是 catch { hasEnc = false; }）
验收：node <m07-vite>/node_modules/@playwright/test/cli.js test tests/v21-review12-preimport-lifecycle.spec.ts -g "复核失败"
期望：1 passed
证伪：boot.ts:902 改 catch { hasEnc = true; } → 1 failed Expected false / Received true
DIST_BEFORE：4,716,422 B / BDB089050B30B707BF0385BB9F778D816FB540371816B5F617A5A40DEAB6685E
DIST_AFTER：同上（未重建 dist）
门禁：登记器 PARTY_COUNT=66 / drift 0 / PASS；verify.js all Exit 0
HEAD.json：未改
edge_profile 匹配项：0（已跳过，无删除）
