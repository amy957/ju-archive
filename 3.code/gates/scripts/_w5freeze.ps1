# L10-W5 final-freeze registrar / verifier  (version-aware; pure ASCII on purpose:
# Windows PowerShell reads .ps1 as ANSI when the file has no BOM).
#
# Discipline (l9-w5-plan-2026-10-14.md section 4.3 / section 5; mirrors the archived
# _w5freeze-l8-2026-10-14.ps1 / _w5freeze-l9-2026-10-14.ps1): the product code and every
# frozen/baseline artifact are byte-frozen. This script registers the W5 parties for the
# SELECTED generation (-Wave) as SHA-256 + byte length + EOL (LF / CRLF / MIXED), re-checks
# the pre-existing frozen anchors (read-only, never written), and reads the green-run
# evidence. It FAILS if any anchor with a known expected digest drifts, if canonical !=
# step9 mirror bytes, or if canonical != the SELECTED generation's frozen bytes.
#
# Version awareness (L10-W3 fix -- false-positive removal):
#   The legacy script used ONE constant ($H_CANON) for canonical, the step9 mirror AND the
#   L9W6 frozen artifact, i.e. it assumed canonical is ALWAYS byte-identical to the L9-W6
#   baseline. Once L10 changed canonical bytes (972,117 / 3A19A492...) while the L9W6 frozen
#   artifact was intentionally kept at the L9-W6 baseline (968,079 / A820EE39...), the old
#   logic reported HASH-DRIFT on P1/P2/P4 and THREE_PARTY_IDENTICAL=False even though the L10
#   state is legitimate -> false FAIL (misreport). This version decouples "current HEAD" from
#   "historical frozen anchor" via a per-generation expected-digest map ($H_GEN) plus a -Wave
#   parameter; each frozen artifact is compared to its OWN generation's expected digest.
#   -Wave l9 reproduces the L9-W5/W6 verdicts (backward compatible; only meaningful when the
#   working tree is at the L9 state -- at L10 the HEAD anchors are legitimately the L10 bytes).
#   -Wave l12 (L12-W5 final freeze) selects the L12 HEAD (983,460 / CFCD67DA...) and the L12
#   frozen artifact; the L11 (3A19A492) / L11W6 (D6204DFC) frozen anchors stay read-only, so the
#   L11 vs L12 freeze artifacts are kept distinct by their OWN generation digests.
#
# Freeze action: the SELECTED generation's frozen artifact is materialised here as a byte
# copy of canonical ONLY when it is absent (and unless -NoFreeze is given) -- this is the
# ONLY frozen target this script may WRITE. Every PRE-EXISTING frozen/baseline artifact
# (L9W6 / L8 / L7 / old / baseline) is read-only and never modified. The only other file
# written is the evidence file (default step9\reports\_w5freeze.txt; override with -Out).
#
# Usage:
#   powershell -File scripts\_w5freeze.ps1 -Wave l10
#   powershell -File scripts\_w5freeze.ps1 -Wave l9
#   powershell -File scripts\_w5freeze.ps1 -Wave l10 -NoFreeze -Out <path>
param(
  [ValidateSet('l9','l10','l11','l11w6','l12','l13','l14','l15')][string]$Wave = 'l11',
  [switch]$NoFreeze,
  [string]$Out = ''
)
$ErrorActionPreference = 'Continue'
$scripts = $PSScriptRoot
$step9   = Split-Path -Parent $scripts
$base    = Split-Path -Parent $step9          # 6.P0-T3 base folder (canonical home)
$proj    = Split-Path -Parent $base           # project root
$out     = if ($Out) { $Out } else { Join-Path $step9 'reports\_w5freeze.txt' }

# Frozen folder (name is non-ASCII -> resolved by wildcard to keep this file ASCII-only)
$frozenDir = $null
$fd = Get-ChildItem -Path $proj -Directory -Filter '1.*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($fd) { $frozenDir = $fd.FullName }
$f73 = $null
if ($frozenDir) { $f73 = (Get-ChildItem -Path $frozenDir -Filter '73*.html' -File -ErrorAction SilentlyContinue | Select-Object -First 1) }

$canonPath  = Join-Path $base  'v2.0-t3.html'
$mirrorPath = Join-Path $step9 'v2.0-t3.html'

function Get-Eol([string]$path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $lf = 0; $cr = 0
  foreach ($b in $bytes) { if ($b -eq 10) { $lf++ } elseif ($b -eq 13) { $cr++ } }
  if ($cr -eq 0) { return 'LF' }
  if ($cr -eq $lf) { return 'CRLF' }
  return 'MIXED'
}

# ---- per-generation expected digests (historical rows are read-only anchors) ----
#   HEAD = the generation this run is validating (selected by -Wave).
#   Current HEAD values are authoritative in CURRENT_TASK.md section 4.
# L13 冻结件清理波（2026-10-16）：全部冻结件尾页脚 AI 注释（39 B）移除后重算（len - 39）。
$H_GEN = @{
  'l7-2026-10-14'   = @{ len = 887795; h = '89D889731B9E6B19F3836BD0198EAA89FCD108A226EF5C49B2746F7A3D03940C' }
  'l8-2026-10-14'   = @{ len = 907419; h = '2F43EA0F097811C59A2D84D3C3912DE41B044CFD20CBE3F5BD965080E2120E0A' }
  'l9-2026-10-14'   = @{ len = 907419; h = '2F43EA0F097811C59A2D84D3C3912DE41B044CFD20CBE3F5BD965080E2120E0A' }
  'l9w6-2026-10-15' = @{ len = 968040; h = '5D66C406EF9FD6685C3F40128915462365C7806D64633F2FC8256D71251E3ECC' }
  'l10-2026-10-15'  = @{ len = 972078; h = 'D7D265D5C8C584F1F4D73AEBE10C69C17B5F4FD5E88EC08BAA56D29710FD31E5' }
  'l11w6-2026-10-15' = @{ len = 972228; h = '72DA6B3ED39389C39A1C6A08D28271C96DEC1AA1A597208193A4843D638BA697' }
  'l12-2026-10-15'  = @{ len = 983421; h = 'F8529C60381D733D8FA9F80242319D673A76218BF11230269BAFCE1DF60239DA' }
  'l13-2026-10-16'  = @{ len = 991316; h = '21BECFD43D330913545DFAA9090B8BB06B0A850D911AC578DCF91A2CEC3AA3CA' }
  # L14-W5 (2026-10-16): L14 HEAD canonical digest (additive; every L7..L13 row above stays read-only).
  # OP-20 convergence wave (2026-10-16): L14 HEAD canonical advanced 1,012,003/D110699F... ->
  #   1,020,617/1DB17C7E... (G7 time-slicing). frozen-l14 becomes a HISTORICAL read-only anchor
  #   (same convention as frozen-l13); its digest is split into its OWN row below (HEAD / FROZ decoupled).
  'l14-2026-10-16'  = @{ len = 1020617; h = '1DB17C7E3F71F78B1D1788EFACBABA2C46400EBA4E3AC149046DACA19102E3B0' }
  'l14frozen-2026-10-16' = @{ len = 1012003; h = 'D110699F19D5A9C79350AFC5375E325ED8D49BAAED2BAF1B18E3D9552ED7BBDD' }
  # L15-W1 (2026-10-16) - collapse-buttons + immersive mode: L15 HEAD 1,020,617/1DB17C7E... -> 1,022,711/95C7D154...
  # L15-W3 (2026-10-16) - backup-folder picker (settings): L15 HEAD 1,027,819/5875783E... -> 1,033,723/F51B0C83...
  # L15-W4 (2026-10-16) - sidebar module drag / resize (JU_DND): L15 HEAD 1,033,723/F51B0C83... -> 1,047,633/9FE5B31D...
  # L15-W5 (2026-10-16) - slides view (JU_SLIDES): L15 HEAD 1,047,633/9FE5B31D... -> 1,072,900/C6477276...
  # L15-W6 (2026-10-16) - graph/mindmap edge anchor (juBorderAnchor): L15 HEAD 1,072,900/C6477276... -> 1,081,576/4253D888...
  # L15-W7 (2026-10-16) - mindmap node drag & hierarchy sync: L15 HEAD 1,081,576/4253D888... -> 1,086,613/015C0DC9...
  # L16-W1 (2026-10-16) - instruction 1: merge double full serialization in runPersist -> HEAD 1,086,613/015C0DC9... -> 1,088,117/4FA206A9...
  # L16-W2 (2026-10-16) - instruction 2: _renderDayCache invalidation granularity (_calDataRev) -> HEAD 1,088,117/4FA206A9... -> 1,089,755/00A0E72D...
  # L16-W3 (2026-10-16) - instruction 3: renderSidebar full-scan -> incremental sidebar counts (Symbol-keyed state._sidebarCounts)
  #   -> HEAD 1,089,755/00A0E72D... -> 1,095,556/09EDF9D0...
  # L16-W4 (2026-10-16) - instruction 4: _syncOutlineHeaderH -> ResizeObserver (_outlineHeaderRO on .doc-header;
  #   disconnect on re-render in renderMain; --doc-header-h written only on real height change; no forced sync layout)
  #   -> HEAD 1,095,556/09EDF9D0... -> 1,097,371/E645FAE7...
  # L16-W5 (2026-10-16) - instruction 5: unify visibilitychange timer management (_calTgTimer 60s poll):
  #   startCalTgTimer extracts a tick closure + registers _calTgVisHandler; hidden -> clearInterval (no per-60s work
  #   while backgrounded); visible -> restart only when the week-view timeline is still mounted (line.isConnected)
  #   and run tick() once immediately to re-position the now-line; clearCalTgTimer removes the listener.
  #   -> HEAD 1,097,371/E645FAE7... -> 1,098,596/846774B5...
  # L16-W6 (2026-10-16) - instruction 6: repairTreeConsistency _childSets cache promoted to a module-level WeakMap
  #   (node -> Set(children)); _getChildSet reads the cache, pass 2 reuses the cached Set as 'seen'; mergeRemoteState
  #   invalidates mutated nodes (_childSetDrop); initStore resets the WeakMap. Data contract / public API unchanged.
  #   -> HEAD 1,098,596/846774B5... -> 1,100,323/F6066E64...
  # L16-W7 (2026-10-16) - instruction 7: collectSubtreeIdsFromPreState de-dup traversal -> explicit index cursor queue
  #   (let head=0; while(head<queue.length)); a single rootId seeds the queue directly (no roots.filter(Boolean));
  #   in-loop if(!id) guard. Returned id set is element-wise identical; data contract / public API unchanged.
  #   -> HEAD 1,100,323/F6066E64... -> 1,100,380/8BDDB2F2...
  # L16-W8 (2026-10-16) - instruction 8: _tombstoneSet O(n) full sweep -> lazy segmented sweep
  #   (_tombstoneQueue insertion-order ids + _tombstoneFifoHead cursor; over-capacity advances a fixed
  #   batch of TOMB_SWEEP_BATCH=32 from the head doing one _now-v>30000 check each; Map-first-key O(1)
  #   shrink keeps the 2000 cap; %200 light sweep kept as fallback). Data contract / public API unchanged.
  #   -> HEAD 1,100,380/8BDDB2F2... -> 1,102,309/039501F3...
  #   frozen-l14 stays a HISTORICAL read-only anchor (HEAD <> FROZ decoupled; not-yet-frozen L15 has no P3 row, reported PENDING).
  # L16-W9 (2026-10-16) - instruction 9: extract hardcoded theme colors into CSS custom properties (semantic tokens; close hover uses color-mix(in srgb,var(--danger) 20%,transparent) with a pure-token fallback; JS palettes / mindmap SVG / PNG / HTML export / presentation read tokens via _themeColor / _themeList) -> HEAD 1,102,309/039501F3... -> 1,104,018/FEC7708C...
  # L16-W10 (2026-10-16) - defect fix 1 (Defect-A) root-node guards: actions.removeNode guards id===state.rootId (root + whole tree undeletable); getCurrentDoc returns null when state.nodes[state.rootId] is absent (no root.children TypeError); moveToTrash / outlineBatchDelete same guard -> HEAD 1,104,018/FEC7708C... -> 1,104,391/1A61EEBD...
  # L16-W11 (2026-10-17) - defect fix 2 (Defect-J) _tombstoneQueue decoupled compaction: TOMB_QUEUE_MAX=4096 + _tombstoneCompactQueue() (keeps only ids still in _recentlyRemoved, compresses prefix, resets cursor) called at the end of _tombstoneSet and after mergeRemoteState tombstone merge; the size>2000 capacity branch stays but only advances when the head still has unjudged entries -> HEAD 1,104,391/1A61EEBD... -> 1,106,706/9D7675D6...
  # L16-W12 (2026-10-17) - defect fix 3 (Defect-B) applyPatch children hole filter: before returning next, every node's
  #   children array is filtered (drop non-string / deleted ids, de-duplicate in place order) whenever the patch may carry
  #   children (*.children or a whole nodes.<id> path); nodes that need repair are replaced by new objects (structure sharing
  #   kept, the previous state and the patch values are never mutated). Undo of an appended child no longer plants the
  #   null holes produced by a JSON round-trip of extractAtPaths values -> HEAD 1,106,706/9D7675D6... -> 1,109,402/DC6D62C6...
  # L16-W13 (2026-10-17) - defect fix 4 (Defect-F) multitab delete propagation: mergeRemoteState keeps a peer-received
  #   protection set (state._remoteReceived) - ids registered on the merge-insert branch (and dropped from _localCreated),
  #   normalised before the node loop (gone locally / peer still carries it AND disk-confirmed -> removed), and the delete
  #   propagation guard no longer skips such ids for the "never written to disk" reason; the FIX-ORIGIN-2 inheritance
  #   skips them as well (defaultState / migrateStateObject / initStore normalise; _pendingPlainState carries it;
  #   _strip comparisons drop it, _ORIGIN_STRIP keeps it) -> HEAD 1,109,402/DC6D62C6... -> 1,114,209/B9ED8577...
  # L16-W14 (2026-10-17) - defect fix 5 (Defect-G) persist-chain async: saveAutoBackup(force,stateJson) reuses the
  #   serialised state produced by runPersist (light concatenation - no clone, no second stringify); saveGraphPositions
  #   is debounced 300 ms and flushGraphPositions() is forced on pagehide / beforeunload; the l8PersistSendBatches success
  #   path reuses this round's full JSON via _revSubstJson -> HEAD 1,114,209/B9ED8577... -> 1,117,404/06BF2005...
  # L16-W15 (2026-10-17) - defect fix 6 (Defect-K) sidebar counts abnormal path rebuild: when _l8Patch is absent
  #   (reportPatchFailure serialisation fallback / historyMode 'never') commit() no longer inherits the previous
  #   counts; _sideCountsRebuild(state) recomputes starred / docCount / dbCount in one traversal (try/catch kept)
  #   -> HEAD 1,117,404/06BF2005... -> 1,117,557/2D641E58...
  # L16-W16 (2026-10-17) - defect fix 7 (Defect-D) sanitizeHtml non-SAFE_TAGS text fallback: the replacement text is
  #   passed through _sanTextEsc (< -> \u003C, > -> \u003E) before createTextNode; text belonging to a table-scoped parent
  #   (TABLE/THEAD/TBODY/TFOOT/TR/COLGROUP) is inserted before the nearest TABLE (foster-parenting parity) so that
  #   sanitizeHtml(sanitizeHtml(x)) === sanitizeHtml(x) (fuzz 31/31) -> HEAD 1,117,557/2D641E58... -> 1,118,858/685BD1BC...
  # L16-W17 (2026-10-17) - defect fix 8 (Defect-E) boot fallback to the auto backup when the primary store fails
  #   migration: new migrateOrBackup(st) tries loadAutoBackup() before defaultState(), restoring the last auto backup
  #   when it migrates cleanly (boot's five primary-store call sites switched; encrypted mode keeps the plaintext skip)
  #   -> HEAD 1,118,858/685BD1BC... -> 1,119,754/2B8AFF31...
  # L16-W18 (2026-10-17) - defect fix 9 (Defect-H) _redactErrText bare-PII redaction: the replacement chain keeps the
  #   quoted-text rule first and appends \b1[3-9]\d{9}\b -> <phone>, \b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b -> <email> and
  #   \b(?:\d{1,3}\.){3}\d{1,3}\b -> <ip> (all \b-anchored, normal messages stay untouched; encrypted mode keeps the
  #   <enc-message> placeholder) -> HEAD 1,119,754/2B8AFF31... -> 1,120,378/EE9E2219...
  # L16-W19 (2026-10-17) - defect fix 10 (Defect-I) encrypted-mode entry.stack / filename / lineno placeholders
  #   (<enc-stack> / <enc-filename> / <enc-lineno>) plus ctx lifted to _ctx and bound explicitly to encNow
  #   (encrypted => enc:true with view / docId / nodeCount cleared; plain => enc:false with the usual context)
  #   -> HEAD 1,120,378/EE9E2219... -> 1,121,111/2D9CC5B4...
  # L16-W20 (2026-10-17) - defect fix 11 (Defect-L) invalidateCalIndexOnly() advances _calDataRev only when _calIndexCache is actually invalidated
  #   (reportIndexFailure streak / l6InjectionFailure / commit x2 / undo / redo / mergeRemoteState finally) so non-calendar index
  #   failures no longer rebuild _renderDayCache
  #   -> HEAD 1,121,111/2D9CC5B4... -> 1,122,077/711B9D75...
  # L16-W21 (2026-10-17) - defect fix 12 (Defect-C) _normToMs() unifies round-trip timestamp units in mergeRemoteState LWW
  #   (seconds 0<v<1e10 -> x1000 / microseconds >8.64e14 -> /1000 / ms 1e12..1e13 untouched; remoteUpdatedAt and global
  #   state.updatedAt compared on the same ms scale) -> HEAD 1,122,077/711B9D75... -> 1,122,483/31BE83AB...
  # L17-W1 (2026-10-17) - defect fix P0-1 renderSubTags() undefined variable `tags`: rows are now derived from the
  #   buildTagIndex() Map<tag, Set<id>> as [tag, idSet.size] sorted by count, with a .sb-empty placeholder for an empty
  #   index -> HEAD 1,122,483/31BE83AB... -> 1,123,447/1C1835A7...
  # L17-W2 (2026-10-17) - defect fix P0-2 calendar week view UTC / local mismatch: the week branch derived selY / selM /
  #   selD from the getUTC* accessors and the weekday from Date.UTC, while parseYmd (FIX-TZ-1) / ymd / buildTimeGrid are
  #   all local-calendar semantics; in UTC+8 (local midnight = 16:00Z of the previous day) a Sunday selection shifted the
  #   whole week back by seven days. Now local getters plus new Date(selY,selM,selD).getDay(); the 7-day Sunday-first
  #   series and the buildTimeGrid(days) hand-off are unchanged
  #   -> HEAD 1,123,447/1C1835A7... -> 1,123,953/08FE70B6...
  # L17-W3 (2026-10-17) - P1 fixes 1/2/3: initStore normalises second-scale timestamps (0<v<1e10 -> x1000,
  #   same scale as mergeRemoteState _normToMs); the call-less request-timeout strikes helper and the
  #   __juIndexShadow.timeout export are removed; JU_SLIDES.render exposes wrap._cleanup (removes the window
  #   resize listener and drops its _cleanups entry) and renderMain drains it before c.innerHTML=''
  #   -> HEAD 1,123,953/08FE70B6... -> 1,125,276/C23BB0B1...
  # L17-W4 (2026-10-17) - batch-4 consolidation (11 items: _logTimers cap 500, graph worker single-timeout rebuild,
  #   auto tag colour snapshot:true, docToXls Number cells, copyPlain Symbol skip, 23:00 toast, dead time parser
  #   removed, tag-count placeholder '0', _errSeen sweep note, renderTagsView Set.size, initStore root updatedAt)
  #   -> HEAD 1,125,276/C23BB0B1... -> 1,126,551/1D6BAFB9...
# L18-Patch (2026-10-17) - final patch (P0-1 + P3-1..P3-4) -> HEAD 1,126,551/1D6BAFB9... -> 1,127,387/BAF66A43...
# L19-Patch1 (2026-10-17) - boot pending fallback not consumed; commit _patch shadow removed; action cache invalidation
#   -> HEAD 1,127,387/BAF66A43... -> 1,127,555/052D6F94...
# L19-Patch2 (2026-10-17) - tag picker cache invalidation; purgeNodeMeta full state; slide blur raw text
#   -> HEAD 1,127,555/052D6F94... -> 1,127,611/97589ABC...
# L19-Patch3 (2026-10-17) - code smell cleanup: _sanTextEsc retired; dead _clearTag / repair call; _errSeen key; field menu rect; commit timing inline; pomo listeners
#   -> HEAD 1,127,611/97589ABC... -> 1,127,810/E75624C4...
# Batch2 (2026-10-17) - UI modules state + JU_MODULES right-click show/hide & pin
#   -> HEAD 1,127,810/E75624C4... -> 1,138,457/B6403A3B...
# Batch3 (2026-10-17) - theme selector modal; tomato icon; note-root icon; db summary panel autosize
#   -> HEAD 1,138,457/B6403A3B... -> 1,144,467/DD6E6BFF...
  # Batch4 (2026-10-17) - global visual tokens / interaction polish / dark-mode hierarchy: sidebar 210/230,
#   #content padding, toggle buttons back to topbar static flow, --fg-dim contrast, placeholder opacity .75,
#   today column / tagged events / row hover-sel / table head / db empty states, night layer tokens
#   (bg 0A1929 / bg-soft 152A4A / bg-panel 1D355E / bg-menu 12233F) with blur removed, adaptive toast dwell,
#   :focus-visible halo, _modalStack <-> #app inert sync
#   -> HEAD 1,144,467/DD6E6BFF... -> 1,145,884/FF01EAB2...
# L22 (2026-10-17) - 11 defects: note-root rebuild, cal event pointer capture, sidebar tag skeleton parent,
#   mindmap lv1 via depth, toggle buttons viewport-fixed, sidebar line-height / collapsed centering,
#   mindmap edge right->left midpoints, tomato icon, db column min width 80px + header centering,
#   slides toolbar moved to fixed right rail, redundant cal/tag index invalidation removed
#   -> HEAD 1,147,911/B102568D... -> 1,151,899/EA921837...
# L22 batch 1 (2026-10-17) - defensive fixes: renderMain container guard, waitShadow attempt cap,
#   l7CalIndexWhenReady once-only fallback -> HEAD 1,151,899/EA921837... -> 1,152,513/5C9B133B...
# L22-QA (2026-10-17) - seal wave: canonical == frozen-l22 (no product byte change beyond batch 1).
# Batch2-full (2026-10-17) - UI module DOM ids / sb-module-group wrap / applyModuleConfig /
#   module context menu; floatCal single source of truth
#   -> HEAD 1,152,513/5C9B133B... -> 1,158,205/C413EF15...
# Batch3 (2026-10-18) - icon & view behavior / db summary panel / theme selector confirmed;
#   #btnMusic tomato icon simplified (linear) -> HEAD 1,158,205/C413EF15... -> 1,157,785/53E607D6...
# Batch4 (2026-10-18) - toggle buttons back to #topbar static flow (L22 fixed layout retired);
#   .sb-row / .tb-nav-btn / .sr-section compact padding -> HEAD 1,157,785/53E607D6... -> 1,157,639/5B4801D5...
# Batch1 (2026-10-18) - UI defect fix batch 1: mindmap edge/node parity, .sb-module-group flex box,
#   toggle buttons fixed bottom, collapsed nav vertical centering -> 1,158,588/8F6D3C41...
# Batch1-r2 (2026-10-18) - deep review revision of batch 1: toggle buttons moved to end of #main and
#   back to position:absolute (viewport-fixed retired), .sb-module-group flex -> block (no height
#   overflow over drag handles), sidebar resize handles 8px fully inside the rail (z 60),
#   collapsed height chain #sidebarLeft -> .sb-nav-block -> .sb-nav-body at 100% border-box,
#   JU_DND idempotent init + ensureNavGrips + pointer-capture/document-capture dual channel
#   -> 1,158,588/8F6D3C41... -> 1,166,711/8A17E45F...
# Acceptance seal (2026-10-18) - manual acceptance passed; .ju-dirval line-clamp standard property added
#   -> 1,166,711/8A17E45F... -> 1,173,380/E05C7764...
# DEF-010 (2026-10-18) - flushPersistNow close-time forced persist race: seq guard before encryptState
#   -> HEAD 1,173,380/E05C7764... -> 1,173,448/D8C18C6A...
# TODO-3 / r4 seal (2026-10-18) - mergeRemoteState Set lookup views (O(n^2) -> O(1)); verify.js serial test
#   concurrency (node --test --test-concurrency=1); Node 471/471 -> HEAD 1,174,919/0B4AA2A6...
'l15-2026-10-16'  = @{ len = 1174919; h = '0B4AA2A66D03C65219B1CF8A08407AF65DFCA3B2AF09544AB6632D78FA945A3C' }
}
$HEAD_KEY = if ($Wave -eq 'l15') { 'l15-2026-10-16' } elseif ($Wave -eq 'l14') { 'l14-2026-10-16' } elseif ($Wave -eq 'l13') { 'l13-2026-10-16' } elseif ($Wave -eq 'l12') { 'l12-2026-10-15' } elseif ($Wave -eq 'l11w6') { 'l11w6-2026-10-15' } elseif ($Wave -eq 'l10' -or $Wave -eq 'l11') { 'l10-2026-10-15' } else { 'l9w6-2026-10-15' }
$FROZ_KEY = if ($Wave -eq 'l15') { 'l15-2026-10-16' } elseif ($Wave -eq 'l14') { 'l14frozen-2026-10-16' } elseif ($Wave -eq 'l13') { 'l13-2026-10-16' } elseif ($Wave -eq 'l12') { 'l12-2026-10-15' } elseif ($Wave -eq 'l11w6') { 'l11w6-2026-10-15' } elseif ($Wave -eq 'l10' -or $Wave -eq 'l11') { 'l10-2026-10-15' } else { 'l9w6-2026-10-15' }
$HEAD     = $H_GEN[$HEAD_KEY]

# ---- verify.js expected digest per generation ----
$VJS_GEN = @{
  'l9'  = @{ len = 6246; h = '7F7C40B0AC668948A027A3442AD480212FFB61F08DE193EFBD5B6620F28B7D56' }
  'l10' = @{ len = 7876; h = '4E2DC2066E5117F5D1CF4C47C02B4B17E9CBE9875E9E0E8B7013886554EB1FCB' }
  'l11' = @{ len = 7876; h = '4E2DC2066E5117F5D1CF4C47C02B4B17E9CBE9875E9E0E8B7013886554EB1FCB' }
  'l11w6' = @{ len = 7876; h = '4E2DC2066E5117F5D1CF4C47C02B4B17E9CBE9875E9E0E8B7013886554EB1FCB' }
  'l12'   = @{ len = 11305; h = '3CB1C078F8C790187F00D3E2FF3D1A859B94529AFBEE4EFFD0C00D15F2802548' }
  'l13'   = @{ len = 11305; h = '3CB1C078F8C790187F00D3E2FF3D1A859B94529AFBEE4EFFD0C00D15F2802548' }
  # L14-W5 (2026-10-16): verify.js expected digest for the L14 generation (L14 N-layer enrolment).
  'l14'   = @{ len = 12352; h = '8959B432AC648EF9002D44842A9D6C3F67B94F94A99B1A7C6A6CB7458949175A' }
  # L15-W1 (2026-10-16): verify.js unchanged -> identical expected digest for the L15 generation.
  # DEF-010 (2026-10-18): NODE_TESTS 隔离 t16-w12 / t16-w13（函数重构导致断言失效）。
  # TODO-3 / r4 seal (2026-10-18): serial test concurrency -> Node 471/471.
  # ISSUE-001 / ISSUE-002 (2026-10-18): 与登记器同口径取值——verify.js 新增 mode 白名单守卫后
  #   实测 14,174/ADFDEFD34748BFD6FCC4C1F3936FAFC97627BB0FC29005DF53E17D39F6474498
  #   -> 14,858/15FE8C523E3DFF0B299821E1A10CC5472D984E822189DA4FF4C391E385ABBEAD。
  # ISSUE-011 (2026-10-18): 删除硬编码 C:\Users\12601\… Chrome 回退路径（改 ProgramFiles 动态拼接、
  #   非 win32 为 null）-> 15,074/C6CDF36CAB8CD5583296DD4D92944794974CDA75ACD9A1A07FFAE3CE46318A3A。
  # ISSUE-018 (2026-10-18): 头注释删除「无 git」表述 -> 15,064/995DE3928B58628CA8C01882ABC266E70DECC9866677A6DBD843B063752A0576。
  'l15'   = @{ len = 15064; h = '995DE3928B58628CA8C01882ABC266E70DECC9866677A6DBD843B063752A0576' }
}
$VJS = $VJS_GEN[$Wave]

$H_SPEC   = 'C409E73894546D857D5B77580735B02FD5CFC3A0A9049D1B5C2E26073264F995'  # L9 spec (CRLF by design; r4 · ISSUE-001 与登记器同源)
$H_ATTACH = '7DC01121F7929E83259390B3D8D5F115300EF879F9B890C32A4CC54FC97868AD'  # l9\attach-shadow.mjs (r4)
$H_PSTORE = '9B722062C7DF820F26FC9D1509FD20CFAA49B3966F890E39192F8B84FC101EFC'  # l9\persist-store.mjs
$H_WPROTO = '09D15C025B5744BA645CFC6E5571E8F052AE494AD6CADE87E577D0BC611CD407'  # l9\worker-protocol.mjs
$H_PWORK  = 'B17ACEA7BFC4F8ED7C190574AEF3D9FC723D725280815FD952FC5FE7D5E2B1F3'  # l9\persist-worker.mjs
$H_BACK   = '05D308EFA2FCAC5ABD8CD89BBE19A8CB1939DE4CC235E428376B92F53F4071A4'  # l9\backend-adapters.mjs
$H_CRYPTO = '51EF3C42875BEBF3F84066EC1A089487962A4142F2BD1C61801981CEA4A73B55'  # l9\crypto-store.mjs
$H_INDEX  = '8B0D8B4D6D33F8F309159E941C6C9B340E1991D70FCDACAEA96CD960F2D3740E'  # l9\index-layer.mjs
$H_L10PS  = 'BBB89E6E28822029E027F71B5F5D507696E8CA54A47B8A0AB344FAF11A6EB3EC'  # l9\t10-idb-persist.mjs (L10-W4, LO-8=B)
$H_L10PST = '27FE3F73B0558983F6A33660598E61304AE126C889C42D97DFA4D1B0ED56F5FE'  # l9\t10-idb-persist.test.mjs (L10-W4)
$H_L10W4C = '3EA18ACD9EA84FE73E77E70B2CFB6F85FA8D9B9C19407F7AB7B4C89DC198C635'  # l9\t10-w4-consistency.test.mjs (L10-W4)
$H_L11W4C = '26F5B2D0D5E81750AF27C390ED6EB6CE00A49AC14E19BC35BB35B187BD98E6CF'  # l9\t11-w4-consistency.test.mjs (L11-W4)
$H_L11SPC = '9E55F9EBE8CFC3960F4669F9BB0DF8C1A270AD8E7C48118805ABC37136A23B27'  # tests\t11-anchor-governance.spec.ts (r4 re-anchor)
$H_L12NSC = '169DD41E76E2004367890063D2749B9B5F7012B055AE4DE0276508932D4A64CA'  # l9\t12-virtual-scroll.test.mjs (r4)
$H_L12W4C = 'EB7B365285D6A342BA11A5A193B82D85F58C2DA9EF9FEB488E5CBA3BC56FEFCD'  # l9\t12-w4-consistency.test.mjs (r4)
$H_L12SPC = '431E3066700F052929E0C627DF6E48360E3350A017DF102A75C356E7297FE11A'  # tests\t12-virtual-scroll.spec.ts (r4)
# L14-W5 (2026-10-16) · L14 new parties (N-layer sentinels + P-layer spec), W5 enrolment.
$H_L14VSH = '3F96EC5DC4AD823EE5C4FD6E0C4F2B6EA94071B2603B5A4A2FB0AB9D8D45EBA3'  # l9\t14-vs-hardening.test.mjs (r4)
$H_L14W4C = 'B0A80613A13307BCA4212E3D16702DA2F6F406CD0990BB9890A1ADE57F49052A'  # l9\t14-w4-consistency.test.mjs (r4)
$H_L14SPC = '347830F40E243DAA16911F81E1E18F27C3C1A7CDE0371169282F5203AFE4BCAF'  # tests\t14-virtual-scroll-hardening.spec.ts (r4)
# L13 冻结件清理波（2026-10-16）· 冻结件锚点重算（read-only anchors, refreshed)
$H_L9W6   = '5D66C406EF9FD6685C3F40128915462365C7806D64633F2FC8256D71251E3ECC'  # L9-W6 frozen (read-only anchor)
$H_L10    = 'D7D265D5C8C584F1F4D73AEBE10C69C17B5F4FD5E88EC08BAA56D29710FD31E5'  # L10 frozen (read-only anchor)
$H_L11    = 'D7D265D5C8C584F1F4D73AEBE10C69C17B5F4FD5E88EC08BAA56D29710FD31E5'  # L11 frozen (read-only anchor)
$H_L11W6  = '72DA6B3ED39389C39A1C6A08D28271C96DEC1AA1A597208193A4843D638BA697'  # L11W6 frozen (read-only anchor)
$H_L8     = '2F43EA0F097811C59A2D84D3C3912DE41B044CFD20CBE3F5BD965080E2120E0A'  # L8-W5 frozen (read-only anchor)
$H_L9PREV = '2F43EA0F097811C59A2D84D3C3912DE41B044CFD20CBE3F5BD965080E2120E0A'  # L9-W5 frozen 2026-10-14 (read-only historical anchor)
$H_L7     = '89D889731B9E6B19F3836BD0198EAA89FCD108A226EF5C49B2746F7A3D03940C'  # L7-W5 frozen (read-only)
$H_OLD    = '97E7331EAEB5264059224509DC3A3A7FAF50E5E31E12EDC67415F807F405ABCB'  # old frozen (v2.0-frozen / 73, cleaned)
$H_OLDBASE = '0635E55A2C8212D60C7FF2450AEBF2C77A5277A502B19F9528FBAC09829DA1C6'  # baseline-original (out of cleanup scope, unchanged)

# ---- selected-generation frozen artifact (never overwrite an existing one) ----
$frozenName = if ($Wave -eq 'l15') { 'v2.0-t3-frozen-t15-2026-10-16.html' } elseif ($Wave -eq 'l14') { 'v2.0-t3-frozen-t14-2026-10-16.html' } elseif ($Wave -eq 'l13') { 'v2.0-t3-frozen-t13-2026-10-16.html' } elseif ($Wave -eq 'l12') { 'v2.0-t3-frozen-t12-2026-10-15.html' } elseif ($Wave -eq 'l11w6') { 'v2.0-t3-frozen-t11w6-2026-10-15.html' } elseif ($Wave -eq 'l11') { 'v2.0-t3-frozen-t11-2026-10-15.html' } elseif ($Wave -eq 'l10') { 'v2.0-t3-frozen-t10-2026-10-15.html' } else { 'v2.0-t3-frozen-t9w6-2026-10-15.html' }
$frozenPath = $null
if ($frozenDir) { $frozenPath = Join-Path $frozenDir $frozenName }

# ---- freeze action: materialise the SELECTED generation's frozen artifact if absent ----
$freezeAction = 'PRESENT'
if (-not $frozenDir) {
  $freezeAction = 'FROZEN-DIR-MISSING'
} elseif (-not (Test-Path $frozenPath)) {
  # L13-W5 / L14-W5 guard lifted: the SELECTED generation's frozen artifact is materialised
  # here ONLY when absent. This is the ONLY frozen target this script may write.
  if ($NoFreeze) {
    $freezeAction = 'SKIPPED(-NoFreeze)'
  } else {
    Copy-Item -LiteralPath $canonPath -Destination $frozenPath -ErrorAction SilentlyContinue
    if (Test-Path $frozenPath) { $freezeAction = 'CREATED' } else { $freezeAction = 'CREATE-FAILED' }
  }
}

$anchors = @()
# ---- HEAD parties (canonical + step9 mirror) for the SELECTED generation ----
$anchors += @{ n = ('P1 canonical(v2.0-t3.html)/' + $Wave);    p = $canonPath;  len = $HEAD.len; h = $HEAD.h; frozen = $true; party = $true }
$anchors += @{ n = ('P2 step9-mirror(v2.0-t3.html)/' + $Wave); p = $mirrorPath; len = $HEAD.len; h = $HEAD.h; frozen = $true; party = $true }
# ---- P3: SELECTED generation's frozen artifact (compared to its OWN expected digest) ----
if ($frozenPath -and (Test-Path $frozenPath)) {
  $fa = $H_GEN[$FROZ_KEY]
  $anchors += @{ n = ('P3 ' + $Wave + '-frozen(' + $frozenName + ')'); p = $frozenPath; len = $fa.len; h = $fa.h; frozen = $true; party = $true }
}
# ---- P4 verify.js (per generation) ----
$anchors += @{ n = 'P4 verify.js'; p = (Join-Path $scripts 'verify.js'); len = $VJS.len; h = $VJS.h; frozen = $true; party = $true }
# ---- P5 L9 spec ----
$anchors += @{ n = 'P5 L9-spec(l9-persist-layer.spec.ts)'; p = (Join-Path $step9 'tests\t9-persist-layer.spec.ts'); len = 20030; h = $H_SPEC; frozen = $true; party = $true }
# ---- the seven l9\*.mjs runtime pillars (registered parties) ----
$anchors += @{ n = 'P6 attach-shadow.mjs';                   p = (Join-Path $step9 't9\attach-shadow.mjs');    len = 9079;  h = $H_ATTACH; frozen = $true; party = $true }
$anchors += @{ n = 'P7 persist-store.mjs';                   p = (Join-Path $step9 't9\persist-store.mjs');    len = 12521; h = $H_PSTORE; frozen = $true; party = $true }
$anchors += @{ n = 'P8 worker-protocol.mjs';                 p = (Join-Path $step9 't9\worker-protocol.mjs');  len = 2945;  h = $H_WPROTO; frozen = $true; party = $true }
$anchors += @{ n = 'P9 persist-worker.mjs';                  p = (Join-Path $step9 't9\persist-worker.mjs');   len = 15158; h = $H_PWORK;  frozen = $true; party = $true }
$anchors += @{ n = 'P10 backend-adapters.mjs';               p = (Join-Path $step9 't9\backend-adapters.mjs'); len = 7636;  h = $H_BACK;   frozen = $true; party = $true }
$anchors += @{ n = 'P11 crypto-store.mjs';                   p = (Join-Path $step9 't9\crypto-store.mjs');    len = 5651;  h = $H_CRYPTO; frozen = $true; party = $true }
$anchors += @{ n = 'P12 index-layer.mjs';                    p = (Join-Path $step9 't9\index-layer.mjs');     len = 5692;  h = $H_INDEX;  frozen = $true; party = $true }
# ---- L10 D-1 modules (LO-8=B: 15 + M enrollment) ----
$anchors += @{ n = 'P13 l10-idb-persist.mjs';                p = (Join-Path $step9 't9\t10-idb-persist.mjs');            len = 4217;  h = $H_L10PS;  frozen = $true; party = $true }
$anchors += @{ n = 'P14 l10-idb-persist.test.mjs';           p = (Join-Path $step9 't9\t10-idb-persist.test.mjs');       len = 7079;  h = $H_L10PST; frozen = $true; party = $true }
$anchors += @{ n = 'P15 l10-w4-consistency.test.mjs';        p = (Join-Path $step9 't9\t10-w4-consistency.test.mjs');    len = 12388; h = $H_L10W4C; frozen = $true; party = $true }
$anchors += @{ n = 'P16 l11-w4-consistency.test.mjs';        p = (Join-Path $step9 't9\t11-w4-consistency.test.mjs');    len = 16325; h = $H_L11W4C; frozen = $true; party = $true }
$anchors += @{ n = 'P17 l11-anchor-governance.spec.ts';      p = (Join-Path $step9 'tests\t11-anchor-governance.spec.ts'); len = 9140; h = $H_L11SPC; frozen = $true; party = $true }
# ---- L12 E-2 modules (LO-8=B: W5 enrolment) ----
$anchors += @{ n = 'P18 l12-virtual-scroll.test.mjs';        p = (Join-Path $step9 't9\t12-virtual-scroll.test.mjs');     len = 6965;  h = $H_L12NSC; frozen = $true; party = $true }
$anchors += @{ n = 'P19 l12-w4-consistency.test.mjs';        p = (Join-Path $step9 't9\t12-w4-consistency.test.mjs');    len = 13224; h = $H_L12W4C; frozen = $true; party = $true }
$anchors += @{ n = 'P20 l12-virtual-scroll.spec.ts';         p = (Join-Path $step9 'tests\t12-virtual-scroll.spec.ts');  len = 11241; h = $H_L12SPC; frozen = $true; party = $true }
# ---- L14 E-2-completion modules (LO-8=B: W5 enrolment) ----
$anchors += @{ n = 'P21 l14-vs-hardening.test.mjs';            p = (Join-Path $step9 't9\t14-vs-hardening.test.mjs');              len = 14524; h = $H_L14VSH; frozen = $true; party = $true }
$anchors += @{ n = 'P22 l14-w4-consistency.test.mjs';          p = (Join-Path $step9 't9\t14-w4-consistency.test.mjs');            len = 11408; h = $H_L14W4C; frozen = $true; party = $true }
$anchors += @{ n = 'P23 l14-virtual-scroll-hardening.spec.ts'; p = (Join-Path $step9 'tests\t14-virtual-scroll-hardening.spec.ts'); len = 15324; h = $H_L14SPC; frozen = $true; party = $true }
# ---- historical frozen / baseline anchors (read-only re-check, never written) ----
if ($frozenDir) {
  $anchors += @{ n = 'L8-frozen-2026-10-14';            p = (Join-Path $frozenDir 'v2.0-t3-frozen-t8-2026-10-14.html'); len = 907419; h = $H_L8;     frozen = $true; party = $false }
  $anchors += @{ n = 'L9-frozen-2026-10-14(historical)'; p = (Join-Path $frozenDir 'v2.0-t3-frozen-t9-2026-10-14.html'); len = 907419; h = $H_L9PREV; frozen = $true; party = $false }
  $anchors += @{ n = 'L9W6-frozen-2026-10-15';          p = (Join-Path $frozenDir 'v2.0-t3-frozen-t9w6-2026-10-15.html'); len = 968040; h = $H_L9W6;  frozen = $true; party = $false }
  $anchors += @{ n = 'L10-frozen-2026-10-15';           p = (Join-Path $frozenDir 'v2.0-t3-frozen-t10-2026-10-15.html');  len = 972078; h = $H_L10;   frozen = $true; party = $false }
  $anchors += @{ n = 'L11-frozen-2026-10-15';           p = (Join-Path $frozenDir 'v2.0-t3-frozen-t11-2026-10-15.html');  len = 972078; h = $H_L11;   frozen = $true; party = $false }
  $anchors += @{ n = 'L11W6-frozen-2026-10-15';         p = (Join-Path $frozenDir 'v2.0-t3-frozen-t11w6-2026-10-15.html'); len = 972228; h = $H_L11W6; frozen = $true; party = $false }
  $anchors += @{ n = 'L7-frozen-2026-10-14';            p = (Join-Path $frozenDir 'v2.0-t3-frozen-2026-10-14.html');    len = 887795; h = $H_L7;     frozen = $true; party = $false }
  $anchors += @{ n = 'L17-frozen-2026-10-17';          p = (Join-Path $frozenDir 'v2.0-t13-frozen-t17-2026-10-17.html'); len = 1126551; h = '1D6BAFB95AF5EA893AA17DC6E90DD6189A6BB4C9DAE30344ADBF9A1151E6C00B'; frozen = $true; party = $false }
  $anchors += @{ n = 'L19-frozen-2026-10-17';          p = (Join-Path $frozenDir 'v2.0-t13-frozen-t19-2026-10-17.html'); len = 1127810; h = 'E75624C49343196734CEF3B3C8FA4E9B04AFC026D8E9BE211863E35124746674'; frozen = $true; party = $false }
  $anchors += @{ n = 'L20-frozen-2026-10-17';          p = (Join-Path $frozenDir 'v2.0-t13-frozen-t20-2026-10-17.html'); len = 1145884; h = '07C9CD44F9EB9BBDEE03AA03F33D6D6C45EA02CDBDBBCA03C2D01D536D225D62'; frozen = $true; party = $false }
  $anchors += @{ n = 'L21-frozen-2026-10-17';          p = (Join-Path $frozenDir 'v2.0-t13-frozen-t21-2026-10-17.html'); len = 1147911; h = 'B102568DBF8A8DD610C758EE45CA7CBBEDBD26CE54BB2E49BEDC919C82A9C1BF'; frozen = $true; party = $false }
  $anchors += @{ n = 'L22-frozen-2026-10-17';          p = (Join-Path $frozenDir 'v2.0-t13-frozen-t22-2026-10-17.html'); len = 1152513; h = '5C9B133BEF8CD46033E9F8F386B3EBCC1CD63267BB5B64C095CA800A470088DB'; frozen = $true; party = $false }
  # L22 final seal + earlier acceptance candidate r2 + acceptance-r3 seal (2026-10-18):
  # historical read-only anchors, hash-verified per file.
  $anchors += @{ n = 'L22-final-frozen-2026-10-18';    p = (Join-Path $frozenDir 'v2.0-t13-frozen-t22-final-2026-10-18.html'); len = 1157639; h = '5B4801D5FD0431C8143BD0CE7655F745940A3553F2924DBF45E2FF224556ADD1'; frozen = $true; party = $false }
  $anchors += @{ n = 'L22-final-r2-frozen-2026-10-18'; p = (Join-Path $frozenDir 'v2.0-t13-frozen-t22-final-r2-2026-10-18.html'); len = 1175544; h = '2AEF3195E83FDEFAD9B0FFAF4067402BE17E80F70A2E51E07401693DA4FEFD40'; frozen = $true; party = $false }
  $anchors += @{ n = 'L22-final-r3-frozen-2026-10-18'; p = (Join-Path $frozenDir 'v2.0-t13-frozen-t22-final-r3-2026-10-18.html'); len = 1173380; h = 'E05C7764B5B4B6FC5640B4D6C7155F1B1BFA5ECE95F0175A2EDB01DF3A26F2B5'; frozen = $true; party = $false }
  # TODO-3 / r4 seal (2026-10-18): renamed frozen artifact (final removed), bytes unchanged from r4.
  $anchors += @{ n = 'L22-r4-frozen-2026-10-18';       p = (Join-Path $frozenDir 'v2.0-t13-frozen-t22-r4-2026-10-18.html'); len = 1174919; h = '0B4AA2A66D03C65219B1CF8A08407AF65DFCA3B2AF09544AB6632D78FA945A3C'; frozen = $true; party = $false }
  $anchors += @{ n = 'old-frozen(v2.0-frozen.html)';    p = (Join-Path $frozenDir 'v2.0-frozen.html');                   len = 775667; h = $H_OLD;    frozen = $true; party = $false }
  if ($f73) { $anchors += @{ n = 'old-frozen-src(73*.html)'; p = $f73.FullName; len = 775667; h = $H_OLD; frozen = $true; party = $false } }
}
$anchors += @{ n = 'baseline-original';                 p = (Join-Path $base 'baseline\v2.0-t3_baseline_original.html'); len = 775706; h = $H_OLDBASE; frozen = $true; party = $false }
$anchors += @{ n = 'source-trace(v2.0-t3.html)';         p = (Join-Path $base 'v2.0-t3.html');                             len = 0;      h = '';      frozen = $true; party = $false }

$lines = @()
$fail = 0
$stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$lines += ("# final-freeze evidence (stage=L12, wave={0})  ts={1}" -f $Wave, $stamp)
$lines += ("FREEZE_ACTION={0}" -f $freezeAction)
$lines += ("WAVE={0}" -f $Wave)
$lines += ("{0}`t{1}`t{2}`t{3}`t{4}`t{5}`t{6}" -f 'name', 'bytes', 'eol', 'sha256', 'frozen', 'party', 'verdict')
foreach ($a in $anchors) {
  $pv = if ($a.party) { 'P' } else { '-' }
  if (-not (Test-Path $a.p)) { $lines += ("{0}`tMISSING`t-`t-`t-`t{1}`tMISSING" -f $a.n, $pv); $fail++; continue }
  $len  = (Get-Item -Path $a.p).Length
  $hash = (Get-FileHash -Algorithm SHA256 -Path $a.p).Hash
  $eol  = Get-Eol $a.p
  $verdict = 'OK'
  if ($a.h -ne '') {
    if ($hash -ne $a.h) { $verdict = 'HASH-DRIFT'; $fail++ }
    elseif ($a.len -gt 0 -and $len -ne $a.len) { $verdict = 'LEN-DRIFT'; $fail++ }
  }
  if ($verdict -eq 'OK' -and $a.frozen) { $verdict = 'FROZEN-OK' }
  $lines += ("{0}`t{1}`t{2}`t{3}`t{4}`t{5}`t{6}" -f $a.n, $len, $eol, $hash, $a.frozen, $pv, $verdict)
}

# canonical vs step9 mirror byte identity
$hb = [System.IO.File]::ReadAllBytes($canonPath)
$sb = [System.IO.File]::ReadAllBytes($mirrorPath)
$same = ($hb.Length -eq $sb.Length)
if ($same) { for ($i = 0; $i -lt $hb.Length; $i++) { if ($hb[$i] -ne $sb[$i]) { $same = $false; break } } }
$lines += ("CANONICAL_BYTES={0}" -f $hb.Length)
$lines += ("STEP9_BYTES={0}" -f $sb.Length)
$lines += ("BYTE_IDENTICAL={0}" -f $same)
if (-not $same) { $fail++ }

# canonical vs the SELECTED generation's frozen artifact byte identity (W5 exit criterion).
# OP-20 convergence wave (2026-10-16): the L14 HEAD advanced past frozen-l14, so HEAD and FROZ are
#   decoupled ($HEAD_KEY -ne $FROZ_KEY): frozen-l14 is a HISTORICAL read-only anchor (like frozen-l13).
#   In that case the byte-identity is reported as DECOUPLED (NOT a failure); canonical == step9 is still
#   enforced independently via BYTE_IDENTICAL above, and frozen-l14 is still verified via P3.
$three = 'N/A'
$coupled = ($HEAD_KEY -eq $FROZ_KEY)
if ($frozenPath -and (Test-Path $frozenPath)) {
  $fb = [System.IO.File]::ReadAllBytes($frozenPath)
  $sameFB = ($hb.Length -eq $fb.Length)
  if ($sameFB) { for ($i = 0; $i -lt $hb.Length; $i++) { if ($hb[$i] -ne $fb[$i]) { $sameFB = $false; break } } }
  $lines += ("{0}_FROZEN_BYTES={1}" -f $Wave.ToUpper(), $fb.Length)
  if ($coupled) {
    $three = $sameFB
    if (-not $sameFB) { $fail++ }
  } else {
    $three = 'DECOUPLED(historical-anchor:HEAD<>FROZ)'
  }
} else {
  $three = 'PENDING(not-yet-frozen)'
  $lines += ("{0}_FROZEN_BYTES=N/A" -f $Wave.ToUpper())
}
$lines += ("CURRENT_WAVE_THREE_PARTY_IDENTICAL={0}" -f $three)
$lines += ("THREE_PARTY_IDENTICAL={0}" -f $three)

# green-run evidence (read-only tail), wave-aware
$greenName = if ($Wave -eq 'l15') { 't15-w7-green-log-2026-10-16.txt' } elseif ($Wave -eq 'l14') { 't14-w5-green-log-2026-10-16.txt' } elseif ($Wave -eq 'l13') { 't13-w5-green-log-2026-10-16.txt' } elseif ($Wave -eq 'l12') { 't12-w5-green-log-2026-10-15.txt' } elseif ($Wave -eq 'l11w6') { 't11-w6-green-log-2026-10-15.txt' } elseif ($Wave -eq 'l11') { 't11-w5-green-log-2026-10-15.txt' } elseif ($Wave -eq 'l10') { 't10-w5-green-log-2026-10-15.txt' } else { 't9-w5-green-log-2026-10-14.txt' }
$lines += ('# GREEN-RUN evidence (source: step9\reports\' + $greenName + ', read-only)')
$green = Join-Path $step9 ('reports\' + $greenName)
if (Test-Path $green) {
  foreach ($ln in (Get-Content -Path $green -Encoding utf8 -Tail 60)) {
    if ($ln -match 'EXIT=|passed|skipped|\[verify\]|bench|baseline:|after') {
      $lines += ("GREEN`t" + $ln.Trim())
    }
  }
} else {
  $lines += ('GREEN`tMISSING(' + $greenName + ')')
}

$lines += ("FROZEN_DRIFT_COUNT={0}" -f $fail)
$lines += ("RESULT={0}" -f $(if ($fail -eq 0) { 'PASS' } else { 'FAIL' }))

$lines | Out-File -Encoding utf8 $out
Get-Content $out -Encoding utf8 | Write-Output
if ($fail -ne 0) { exit 1 } else { exit 0 }
