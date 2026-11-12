批次: review17-07（ISSUE-007 门禁可证伪「复核失败回滚」）
时间: 2026-11-07
DIST_BEFORE: 4,716,422 B / BDB08905…6685E（未重建，DIST_AFTER 同）
变更: 6.P0-T3基线/m07-vite/scripts/check-deps-wired.mjs（bootTokens 新增「复核失败不回滚」负向 token + 专用 FAIL 文案）
禁用面: 既有 78 键 / clear_encrypted 读端断言 / boot.ts 业务逻辑 均零改动
证据: gate-pass.log（修后 PASS · 78 键 0 失败）
证据: gate-neg.log（缺陷态 Exit 1 · 失败 1 项 · 指名复核失败不回滚）
证据: gate-restore.log（复原后复绿）· hash-registry.log（66 方 / drift 0 / PASS）
回滚: boot.ts:902 临时改 catch (e) { hasEnc = true; } 后已复原为 catch { hasEnc = false; }
edge_profile: 0 项（未命中，跳过）
