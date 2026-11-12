fix22-patch4 批次说明
批次：fix22-patch4（1/2 取证+修复+重打包 · 2/2 归档收尾）
时间：2026-10-30（UTC+8）
范围：Web 与 Exe 图表差异排查 / exe 内嵌 HTML 取证 / 日历柱状图 WebView2 兼容加固 / v2.1.0-2026-10-29 重打包
DIST_BEFORE：4,697,441 B（fix22-patch2 spec 重建产物）
RELEASE_BEFORE：JU-v2.1-Web.html 4,696,806 B / JU-v2.1-win-x64.exe 6,763,520 B（原件已移至 _release_before_20261029/）
DIST_AFTER：4,697,669 B / cc93226e86ef3dc2a80f5974df508662f897b72cd050f9dde6d94e13fd9f678c
RELEASE_AFTER：Web 同 DIST_AFTER；exe 6,766,592 B / 4c798ddd34504e986343429fce8bef049708241c9fcaa45bd7899c0d4fb02943
目录内容：
  _extract.txt / _extract.mjs       exe 明文检索（DOCTYPE 5 处均为片段，正文内嵌为压缩流）
  _inspect.txt / _inspect.mjs       codegen 资产 / dist / 旧 release 三方指纹（旧资产 3,135,943 B 二进制）
  _decompress.txt / _decompress.mjs 旧资产 brotli 解码 4,697,644 B（cal-chart=0 ⇒ fix22 之前实现）
  _exe_embed.html                   旧 exe 内嵌 HTML 解码件（诊断留档）
  _diff2.txt                        旧三方对照结论（EMB ≡ WEB 同代旧图，DIST 为新 SVG 实现）
  _tsc.txt                          tsc --noEmit（空输出 = 0 错误）
  _run_spec.txt                     v21-fix22-calendar-chart 单跑（1 passed / 9.6s）
  _build_all.txt                    build-all 6 步全绿（新 Web / 新 exe / checksums）
  _accept_release.txt               release html 与新 exe 内嵌 html 双跑 Playwright（全 PASS；838 B 序列化差异 token 169=169）
  _registry.txt / _verify_all.txt   门禁（66 方 drift 0 / PASS；全量 Exit 0 · 静态 0 · Node 503 · PW 171 · bench 7/7）
  _release_before_20261029/         重打包前 release 原件备份（3 件 / 11,460,495 B）
edge_profile*：90过程材料/tmp 下匹配为空，按规则跳过删除（记录于此）
