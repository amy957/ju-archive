# L7 verification runner (temporary; removed after W1 evidence is captured)
# Pure ASCII on purpose: Windows PowerShell reads .ps1 as ANSI when no BOM.
param([string]$Mode = 'l7', [switch]$Detach, [int]$WaitPid = 0, [string]$Tag = '', [string]$AppUrl = '')
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot          # ...\step9
$tail = Join-Path $PSScriptRoot '_l7tail.txt'
$suffix = ''
if ($Tag) { $suffix = "_$Tag" }
# L7-W2 project rule: test output MUST go to <project root>\tmp_log.txt,
# i.e. the parent of the L3 baseline folder (read only the last 50 lines).
# Derived from $root on purpose: Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI,
# so any non-ASCII literal in this file would be mangled (kept pure ASCII).
# Reuse is safe ONLY after the previous run wrote its DONE line (poll _l7tail.txt first).
$projectRoot = Split-Path -Parent (Split-Path -Parent $root)
$out = Join-Path $projectRoot 'tmp_log.txt'
$err = Join-Path $projectRoot 'tmp_log_err.txt'

if ($WaitPid -gt 0) {
  while (Get-Process -Id $WaitPid -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 3 }
  "=== DONE mode=$Mode tag=$Tag pid=$WaitPid at $(Get-Date -Format HH:mm:ss) ===" | Out-File $tail -Encoding utf8
  Get-Content $out -Tail 50 -Encoding utf8 -ErrorAction SilentlyContinue | Out-File $tail -Encoding utf8 -Append
  "=== ERR TAIL ===" | Out-File $tail -Encoding utf8 -Append
  Get-Content $err -Tail 15 -Encoding utf8 -ErrorAction SilentlyContinue | Out-File $tail -Encoding utf8 -Append
  exit 0
}

if ($Mode -eq 'tail') {
  "=== OUT TAIL ($out) ===" | Out-File $tail -Encoding utf8
  Get-Content $out -Tail 45 -Encoding utf8 -ErrorAction SilentlyContinue | Out-File $tail -Encoding utf8 -Append
  "=== ERR TAIL ($err) ===" | Out-File $tail -Encoding utf8 -Append
  Get-Content $err -Tail 20 -Encoding utf8 -ErrorAction SilentlyContinue | Out-File $tail -Encoding utf8 -Append
  exit 0
}

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
if ($AppUrl) { $env:JU_APP_URL = $AppUrl }
# verify.js re-spawns 'node' internally -> node.exe dir must be on PATH, else ENOENT
$env:PATH = (Split-Path $node) + ';' + $env:PATH
$argList = @()
switch ($Mode) {
  'l7'  { $argList = @('node_modules/@playwright/test/cli.js','test','tests/t7-index-worker.spec.ts','--reporter=line') }
  'all' { $argList = @('scripts/verify.js','all') }
  default { 'BAD_MODE' | Out-File $tail -Encoding utf8; exit 3 }
}
if ($Detach) {
  if (Test-Path $out) { Remove-Item $out -Force -ErrorAction SilentlyContinue }
  if (Test-Path $err) { Remove-Item $err -Force -ErrorAction SilentlyContinue }
  $p = Start-Process -FilePath $node -ArgumentList $argList -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
  $self = $PSCommandPath
  Start-Process powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$self,'-Mode',$Mode,'-WaitPid',"$($p.Id)",'-Tag',$Tag) -WindowStyle Hidden
  "DETACHED mode=$Mode tag=$Tag pid=$($p.Id) started=$(Get-Date -Format HH:mm:ss) out=$out err=$err" | Out-File $tail -Encoding utf8
  exit 0
}
$p = Start-Process -FilePath $node -ArgumentList $argList -WorkingDirectory $root -NoNewWindow -Wait -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
"EXIT=$($p.ExitCode)" | Out-File $tail -Encoding utf8
"--- STDOUT TAIL ---" | Out-File $tail -Encoding utf8 -Append
Get-Content $out -Tail 45 -Encoding utf8 | Out-File $tail -Encoding utf8 -Append
"--- STDERR TAIL ---" | Out-File $tail -Encoding utf8 -Append
Get-Content $err -Tail 20 -Encoding utf8 | Out-File $tail -Encoding utf8 -Append

