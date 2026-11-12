# ============================================================================
# JU reproducible environment bootstrap  (Release path B / stage S1 / OP-12)
# ---------------------------------------------------------------------------
# Purpose : fix the TWO machine-specific values that make the JU gates
#           non-portable (OP-12) and set the Node-as-Electron / colour flags
#           that scripts/verify.js needs.  Dot-source it, then run any gate:
#
#   PS> . "4.cfg\ci\env.example.ps1" -NodeDir "<folder with node.exe>" `
#                                         -ChromiumPath "<chrome.exe>"
#   PS> cd "3.code\gates"          # step9 root (see README)
#   PS> node scripts/verify.js all
#
#   With no parameters it uses JU_NODE_DIR / JU_CHROMIUM_PATH when set and
#   otherwise resolves standard system locations (node on PATH, Program Files
#   Chrome/Chromium). No user-specific profile path is ever hard-coded.
#
# Style   : pure ASCII on purpose (Windows PowerShell reads a .ps1 with no BOM
#           as ANSI; a non-ASCII literal would corrupt the script).
# Safety  : READ-ONLY. It only sets PROCESS-scope environment variables and
#           never writes to any file, so no frozen artifact can drift.
#           The current baseline is recorded in 99.hist/6.dev/sealed-head.json; this
#           script never asserts or embeds product bytes.
# ============================================================================
param(
  [string]$NodeDir = '',
  [string]$ChromiumPath = ''
)

$ErrorActionPreference = 'Stop'

# ---- repo root: this file lives in <root>\4.cfg\ci\ -----------------------
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Resolve-NodeDir {
  param([string]$Explicit)
  $cands = @()
  if ($Explicit)          { $cands += $Explicit }
  if ($env:JU_NODE_DIR)   { $cands += $env:JU_NODE_DIR }
  # Fall back to whatever node.exe is already on PATH (no machine-specific scan).
  $onPath = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($onPath) { $cands += (Split-Path -Parent $onPath.Source) }
  foreach ($c in $cands) {
    if ($c -and (Test-Path (Join-Path $c 'node.exe'))) { return $c }
  }
  return ''
}

function Resolve-ChromiumPath {
  param([string]$Explicit)
  $cands = @()
  if ($Explicit)               { $cands += $Explicit }
  if ($env:JU_CHROMIUM_PATH)   { $cands += $env:JU_CHROMIUM_PATH }
  # System-wide install locations only (no per-user profile directory).
  $pf   = $env:ProgramFiles
  $pf86 = ${env:ProgramFiles(x86)}
  if ($pf)   { $cands += (Join-Path $pf   'Google\Chrome\Application\chrome.exe') }
  if ($pf86) { $cands += (Join-Path $pf86 'Google\Chrome\Application\chrome.exe') }
  if ($pf)   { $cands += (Join-Path $pf   'Chromium\Application\chrome.exe') }
  foreach ($c in $cands) { if ($c -and (Test-Path $c)) { return $c } }
  return ''
}

# ---- 1) Node runtime on PATH (verify.js spawns bare `node`) ----
$resolvedNode = Resolve-NodeDir -Explicit $NodeDir
if (-not $resolvedNode) {
  throw "node.exe not found. Pass -NodeDir <folder containing node.exe> or set JU_NODE_DIR."
}
$env:PATH = "$resolvedNode;$env:PATH"

# ---- 2) run the Electron-provided node in plain Node mode ----
$env:ELECTRON_RUN_AS_NODE = '1'

# ---- 3) Chromium for Playwright / bench ----
# If nothing is found we deliberately DO NOT set JU_CHROMIUM_PATH: playwright.config.ts
# then falls back to the bundled Chromium (install it once with
# `npx playwright install chromium`). This keeps the script machine-agnostic.
$resolvedChromium = Resolve-ChromiumPath -Explicit $ChromiumPath
if ($resolvedChromium) {
  $env:JU_CHROMIUM_PATH = $resolvedChromium
} else {
  Write-Warning 'No system Chromium found; relying on Playwright bundled Chromium (run: npx playwright install chromium).'
}

# ---- 4) deterministic, machine-readable output ----
$env:NO_COLOR = '1'

# ---- 5) derive JU_APP_URL from the repo root (avoids a hard-coded non-ASCII path) ----
$appDir = Get-ChildItem -Path $repoRoot -Directory -Filter '6.*' -ErrorAction SilentlyContinue |
          Select-Object -First 1
if (-not $appDir) {
  throw "app baseline directory (6.*) not found under repo root '$repoRoot'."
}
$appFile = Join-Path $appDir.FullName '3.code\canonical\v2.0-t3.html'
if (-not (Test-Path $appFile)) {
  throw "app artifact not found: '$appFile'. Refusing to continue with an empty JU_APP_URL."
}
$env:JU_APP_URL = 'file:///' + ($appFile -replace '\\', '/')

# ---- report the fixed environment (single line each; safe for CI logs) ----
Write-Output ("JU_ENV_NODE_DIR={0}"       -f $resolvedNode)
Write-Output ("JU_ENV_CHROMIUM_PATH={0}"   -f $resolvedChromium)
Write-Output ("JU_ENV_ELECTRON_RUN_AS_NODE={0}" -f $env:ELECTRON_RUN_AS_NODE)
Write-Output ("JU_ENV_JU_APP_URL={0}"      -f $env:JU_APP_URL)
Write-Output 'JU_ENV_READY=1'
