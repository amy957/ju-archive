批次：fix27-4/8（fix27 第 4 批）
时间：2026-11-09T04:30Z（Asia/Shanghai 12:30）
范围：新建 scripts/pre-release-gate.mjs；prepare-release.mjs 清单写序修正
DIST_BEFORE=4,715,113 B / 6D5A9E54…EBAD
DIST_AFTER=4,715,279 B / BD5A8B78…F1774（verify.js all 的 PW prepareDist 重建，非本批代码改动）
基线：HEAD.json 未改；step9 无本批脚本镜像，无需同步
沙箱：sandbox/（node_modules junction、src-tauri 副本排除 target）
证据：setup.log / gate-green.txt / gate-neg-onebyte.txt / fresh-prepare.log
      fresh-manifest-parity.txt / gate-real-current.txt
      hash-registry.txt / hash-registry-after.txt / verify-all.log
edge_profile*：90过程材料/tmp 下匹配 0 项，已跳过清理
