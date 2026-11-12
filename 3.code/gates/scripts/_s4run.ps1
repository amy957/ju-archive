# L8-W2 S4 full regression runner (temporary; mirrors _w2run.ps1 / _l7run.ps1 env setup)
# Pure ASCII on purpose: Windows PowerShell reads .ps1 as ANSI when no BOM.
param([string]$Mode = 'all')
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot          # ...\step9
$tail = Join-Path $PSScriptRoot '_s4tail.txt'
# S4 rule: full-regression output MUST go to <project root>\tmp_verify.txt
# (project root = parent of the L3 baseline folder). Derived so no non-ASCII literal is needed.
$projectRoot = Split-Path -Parent (Split-Path -Parent $root)
$out = Join-Path $projectRoot 'tmp_verify.txt'

$node = $null
$cb = Get-ChildItem -Path ((Split-Path -Qualifier $root) + '\') -Directory -Recurse -Depth 2 -Filter 'CodeBuddy CN' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($cb) {
  $c = Join-Path $cb.FullName 'node.exe'
  if (Test-Path $c) { $node = $c }
}
if (-not $node) { 'NODE_NOT_FOUND' | Out-File $tail -Encoding utf8; exit 2 }

$env:ELECTRON_RUN_AS_NODE = '1'
$env:NO_COLOR = '1'
# ISSUE-008: no hard-coded user-profile path. Honour an externally supplied
# JU_CHROMIUM_PATH first, otherwise fall back to the default install locations.
if (-not $env:JU_CHROMIUM_PATH) {
  $cands = @()
  if ($env:LOCALAPPDATA) { $cands += (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe') }
  if (${env:ProgramFiles}) { $cands += (Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe') }
  if (${env:ProgramFiles(x86)}) { $cands += (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe') }
  foreach ($cand in $cands) { if (Test-Path $cand) { $env:JU_CHROMIUM_PATH = $cand; break } }
}
$env:JU_APP_URL = 'file:///' + ($root -replace '\\', '/') + '/v2.0-t3.html'
# verify.js re-spawns 'node' internally -> node.exe dir must be on PATH
$env:PATH = (Split-Path $node) + ';' + $env:PATH

$argList = @()
switch ($Mode) {
  'all' { $argList = @('scripts/verify.js','all') }
  default { 'BAD_MODE' | Out-File $tail -Encoding utf8; exit 3 }
}

Set-Location $root
& $node $argList 2>&1 | Out-File -Encoding utf8 $out
$code = $LASTEXITCODE
"EXIT=$code" | Out-File $tail -Encoding utf8
"--- OUT TAIL (last 50) ---" | Out-File $tail -Encoding utf8 -Append
Get-Content $out -Tail 50 -Encoding utf8 -ErrorAction SilentlyContinue | Out-File $tail -Encoding utf8 -Append
exit $code
