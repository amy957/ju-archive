批次：review11-06/09 · ISSUE-006 token 化产出可度量（软阈值记录模式）
时间：2026-11-04（UTC 07:28–07:41）
DIST_BEFORE：4,712,768 B / BBAB5C84…8622AB（m07-vite/dist/index.html）
DIST_AFTER ：4,713,030 B / 5AF650EC…52CE72（探针 prepare() 触发 vite 重建）
STYLE_BEFORE：84fb78d7…081bc7（src/style.css）
STYLE_AFTER ：123c6ade…23aa89
计数（node 口径）：hex raw 135 → 130（去注释 126 → 121）；!important 72 → 72（零新增）
变更：style.css 新增 5 个 --c-* token + 10 处同值字面量替换；check-inline-style.mjs 追加计数与软阈值
证据：check-inline-style.txt / -r2 / -r3 · counts.txt / -r2 · falsify-run.txt · probe.txt · hash-registry.txt · verify-all.txt
探针：probe-review11-06.spec.ts（日 / 夜 / 打印三态 RESULT=PASS，1 passed）
edge_profile*：90过程材料/tmp 匹配 0 项，按规则跳过，无删除
