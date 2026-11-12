批次：review25-03/7 check-manifest docs 23 / manifest 22 口径
时间：2026-11-08T13:22:05Z（本地 21:22）
DIST_BEFORE：4,715,113 B / 6D5A9E54FB98557D7FEF893D04007EA507F71357DCA811DF07F2A70E3350EBAD
DIST_AFTER：同上（零构建，仅脚本与归档说明/清单重生成）
归档目录：8.发布与CI/release/v2.1.0-2026-11-08（.prev-1794142687350 保留 22 条旧快照，不参与选择）
证据文件：
  accept.txt                        check-manifest 正向（Exit 0 openIssues=23）
  docs-only.txt                     JU_RELEASE_DOCS_ONLY=1 重生成说明与清单
  neg1-manifest-missing-114.txt     删 manifest ISSUE-114 → FAIL
  neg2-manifest-extra-115.txt       manifest 多 ISSUE-115 → FAIL
  neg3-notes-missing-114.txt        notes 缺 ISSUE-114 → FAIL
  hash-registry.txt                 PARTY_COUNT=66 / drift=0 / RESULT=PASS
  hash-registry-before.txt          变更前同口径
  verify-all.txt                    verify.js all Exit 0
  sandbox/                          负向沙箱（已删除）
edge_profile*：90过程材料/tmp 下匹配 0 项，已跳过，未删任何其他内容
