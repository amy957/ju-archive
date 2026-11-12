# S4 hash/size evidence (temporary; pure ASCII, paths derived from $PSScriptRoot)
$scripts = $PSScriptRoot                 # ...\step9\scripts
$step9   = Split-Path -Parent $scripts   # ...\step9
$base    = Split-Path -Parent $step9     # ...\6.P0-T3基线 (canonical home)
$proj    = Split-Path -Parent $base      # project root
$out = Join-Path $proj 'tmp_s4hash.txt'

$canonical = Join-Path $base   'v2.0-t3.html'
$step9html = Join-Path $step9  'v2.0-t3.html'
$verifyjs  = Join-Path $scripts 'verify.js'

$lines = @()
foreach ($f in @($canonical, $step9html, $verifyjs)) {
  $h = (Get-FileHash -Algorithm SHA256 -Path $f).Hash
  $l = (Get-Item -Path $f).Length
  $lines += ('{0}`t{1}`t{2}' -f $l, $h, $f)
}
$lines | Out-File -Encoding utf8 $out

$hb = [System.IO.File]::ReadAllBytes($canonical)
$sb = [System.IO.File]::ReadAllBytes($step9html)
$same = ($hb.Length -eq $sb.Length)
if ($same) { for ($i = 0; $i -lt $hb.Length; $i++) { if ($hb[$i] -ne $sb[$i]) { $same = $false; break } } }
"CANONICAL_BYTES=$($hb.Length)"      | Out-File -Encoding utf8 -Append $out
"STEP9_BYTES=$($sb.Length)"          | Out-File -Encoding utf8 -Append $out
"BYTE_IDENTICAL=$same"               | Out-File -Encoding utf8 -Append $out
