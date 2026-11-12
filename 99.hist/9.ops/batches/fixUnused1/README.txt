批次：fixUnused1（2026-11-06）
目的：build-all 在 [1e/14] check-unused-exports 失败（未使用 216 > 基线 214），修复后重跑一键发版
DIST_BEFORE：4,716,422 B / BDB089050B30B707BF0385BB9F778D816FB540371816B5F617A5A40DEAB6685E
DIST_AFTER ：4,716,422 B / BDB089050B30B707BF0385BB9F778D816FB540371816B5F617A5A40DEAB6685E（去 export 后字节一致）
变更：src/core/richtext.ts · IndentedOutlineNode 去 export（仅本文件自用）
变更：src/views/outline.ts · splitPastedLinesToNodes 去 export（无外部 import，calendar 侧为 deps 桩）
门禁：check-unused-exports 导出 1219 / 未使用 214 = 基线 · Exit 0
证据：2.项目日志/build-all-2026-11-06-r2.log
证据：2.项目日志/fixUnused1-hash-registry-2026-11-06.log
证据：2.项目日志/fixUnused1-verify-all-2026-11-06.log
复核：2.项目日志/fixUnused1-hash-registry-r2-2026-11-06.log · fixUnused1-verify-all-r2-2026-11-06.log
