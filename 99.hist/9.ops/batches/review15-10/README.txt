批次：review15-10/13 · ISSUE-010 关闭加密可证伪
时间：2026-11-06
DIST_BEFORE：4,715,782 B / 8FB58D12...DA024（未重建）
BOOT_SHA256：0AE41B9B23A722E586A793DB19CFFFE86A357796DBA8D5A7634F6D35279D4E11
范围：boot.ts:887-901 关闭加密读端；check-deps-wired.mjs:156-179；v21-fix43-bridge-capability.spec.ts:20-51
结论：目标实现已在基线，净零源码 diff；门禁 PASS，新用例 1 passed。
证伪：line 890 失败提示置空 -> gate FAIL 指名 token；isDesktop 恒 false -> 1 failed Expected「桥接不可用」/ Received「已关闭加密」。
证据：gate-final.log / pw-final.log / gate-falsify.log / pw-falsify-isdesktop.log / *.sha256.before|after.txt
复原：boot.ts 与 dist 哈希 before=after；HEAD.json 未改。
edge_profile*：0 项，跳过。
