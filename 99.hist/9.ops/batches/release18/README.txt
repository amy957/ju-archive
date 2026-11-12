批次：release18（2026-11-06）
时间：2026-11-06T15:20Z~15:30Z
DIST_BEFORE：4,715,625 B / CE323E8F…979731
DIST_AFTER ：4,715,625 B / CE323E8F…979731（src 零改动，重建同字节）
归档 BEFORE：v2.1.0-2026-11-06 Web CE323E8F… · exe 1A2D6E56… · setup 4,457,310 B / 19A047CD…
归档 AFTER ：v2.1.0-2026-11-06 Web CE323E8F… · exe 7,342,592 B / FF5F1D32…C1328
              setup 4,457,286 B / CFB708ED…43CF · checksums 258 B / 76938C5B…F01
变更：check-release-parity.mjs（--ci-mode 降级）· .github/workflows/m07-ci.yml · ci-gate.yml
      docs/OPEN-ISSUES.md · RISK-ACCEPT-csp-style-inline-20261105.md（签字）
新增：RISK-ACCEPT-review9-probes-exemption-20261106.md · RISK-ACCEPT-ondevice-p4-p16-20261106.md
命令：node scripts/build-all.mjs（JU_RELEASE_OVERWRITE=1 / JU_BUNDLES=nsis）
      node scripts/check-manifest.mjs · check-dist-parity · check-web-parity · check-release-parity（含 --ci-mode）
      node step9/verify-hash-registry.mjs · node step9/scripts/verify.js all（PATH 前置 99.开发辅助工具）
      cargo test --manifest-path src-tauri/Cargo.toml
证据：2.项目日志/build-all-release18-2026-11-06.log · release18-verify-all-2026-11-06.txt
