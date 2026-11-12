BATCH: review20-01-05/6  ISSUE-005 (archive CI copy same-source as canonical)
TIME : 2026-11-08 (local) / 2026-11-07T16:55Z
DIFF : 8.发布与CI/ci/ci-gate.yml  +27 / -1
ADDED: pre-verify dist/web/release parity (--ci-mode) x3, post release parity (GITHUB_ACTIONS:false)
NOTE : archive copy is a historical marker, NOT an active CI copy; only step text was synced
ACCEPT: Select-String both files, pattern 'check-(dist|web|release)-parity\.mjs --ci-mode'
RESULT: archive=3 hits (L81,85,91) / canonical=3 hits (L81,85,91) -> PASS
BYTES : 6829 / 6829 ; SHA256 both B9BB047F7230DCDAEE94495F1150E211356C7C0FAFB90F9C7A164096C9A4C6C0
GATE  : verify-hash-registry -> PARTY_COUNT=66 DRIFT=0 RESULT=PASS
GATE  : verify.js all -> EXIT=0 (static 0 hit, Node 503, PW 171, bench PASS)
EVID  : verify-all.log / registry-tail.txt in this folder
FALSIF: deleting the added block leaves archive with 0 ci-mode hits (pre-edit state)
LEFT  : none
