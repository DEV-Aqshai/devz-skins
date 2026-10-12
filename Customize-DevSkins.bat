@echo off
setlocal
title Dev Skins Customizer
set "DS_SELF=%~f0"
set "DS_DIR=%~dp0"
where powershell >nul 2>nul
if errorlevel 1 (
  echo Windows PowerShell was not found. This tool needs PowerShell 5 or newer.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:DS_SELF,[Text.Encoding]::UTF8); $i=$c.LastIndexOf('#'+'#PS-START'); if($i -lt 0){Write-Host 'Installer payload is missing.'; exit 1}; Invoke-Expression $c.Substring($i)"
echo.
pause
exit /b
##PS-START
# =====================================================================
#  DEV//SKINS customizer
#  Makes personalised copies of the wa-dev / yt-dev / dc-dev extensions.
#  - never edits the original files
#  - needs no admin rights and uses no internet
#  - Windows PowerShell 5.1 compatible (keep it that way)
# =====================================================================
$ErrorActionPreference = 'Stop'
$onWin = ($env:OS -eq 'Windows_NT')
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
try { $Host.UI.RawUI.WindowTitle = 'Dev Skins Customizer' } catch {}

function Say([string]$t, [string]$c = 'Gray') { Write-Host $t -ForegroundColor $c }
function Rule { Say ('  ' + ('-' * 64)) 'DarkGray' }
function Step([string]$n, [string]$t) {
  Write-Host ''
  Write-Host ('  [' + $n + '] ') -NoNewline -ForegroundColor Green
  Write-Host $t -ForegroundColor White
  Rule
}
function Ask([string]$prompt, [string]$default) {
  $hint = ''
  if ($default -ne '') { $hint = ' [' + $default + ']' }
  Write-Host ('  > ' + $prompt + $hint + ': ') -NoNewline -ForegroundColor Green
  $v = [Console]::ReadLine()
  if ($null -eq $v) { return $default }
  $v = $v.Trim()
  if ($v -eq '') { return $default }
  return $v
}
function AskMatch([string]$prompt, [string]$default, [string]$pattern, [string]$hint) {
  while ($true) {
    $v = Ask $prompt $default
    if ($v -match $pattern) { return $v }
    Say ('    That did not look right. ' + $hint) 'Yellow'
  }
}
function AskYes([string]$prompt, [bool]$default) {
  $d = 'n'
  if ($default) { $d = 'y' }
  while ($true) {
    $v = (Ask ($prompt + ' (y/n)') $d).ToLower()
    if ($v -eq 'y' -or $v -eq 'yes') { return $true }
    if ($v -eq 'n' -or $v -eq 'no') { return $false }
    Say '    Please type y or n.' 'Yellow'
  }
}
function Wait-Enter([string]$msg) { [void](Ask $msg '') }
function Flag([bool]$b) { if ($b) { return 'true' } return 'false' }
function YesNoText([bool]$b) { if ($b) { return 'yes' } return 'no' }

function Get-Lum([string]$hex) {
  $h = $hex.TrimStart('#')
  $out = @()
  foreach ($i in 0, 2, 4) {
    $c = [Convert]::ToInt32($h.Substring($i, 2), 16) / 255.0
    if ($c -le 0.03928) { $out += ($c / 12.92) } else { $out += [Math]::Pow((($c + 0.055) / 1.055), 2.4) }
  }
  return (0.2126 * $out[0]) + (0.7152 * $out[1]) + (0.0722 * $out[2])
}
function Get-RgbText([string]$hex) {
  $h = $hex.TrimStart('#')
  return ([Convert]::ToInt32($h.Substring(0, 2), 16).ToString() + ', ' +
          [Convert]::ToInt32($h.Substring(2, 2), 16).ToString() + ', ' +
          [Convert]::ToInt32($h.Substring(4, 2), 16).ToString())
}
function Find-Exe([string]$exe, [string[]]$paths) {
  if ($onWin) {
    foreach ($root in @('HKLM:', 'HKCU:')) {
      try {
        $v = (Get-ItemProperty ($root + '\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\' + $exe) -ErrorAction Stop).'(default)'
        if ($v -and (Test-Path -LiteralPath $v)) { return $v }
      } catch {}
    }
  }
  foreach ($p in $paths) { if ($p -and (Test-Path -LiteralPath $p)) { return $p } }
  return $null
}
function Set-Flag([string]$text, [string]$key, [string]$value) {
  $rx = New-Object System.Text.RegularExpressions.Regex('\b' + $key + ':\s*(true|false|\d+)')
  return $rx.Replace($text, ($key + ': ' + $value), 1)
}

function Main {
  $Utf8 = [Text.Encoding]::UTF8
  $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $sep = [IO.Path]::DirectorySeparatorChar

  try { Clear-Host } catch {}
  Write-Host ''
  Say '  ============================================================' 'Green'
  Say '    DEV//SKINS  customizer' 'White'
  Say '    WhatsApp  -  YouTube  -  Discord   |   terminal-style skins' 'DarkGray'
  Say '  ============================================================' 'Green'
  Write-Host ''
  Say '  This tool makes YOUR personalised copy of the extensions.' 'Gray'
  Say '    - your original files are never changed' 'DarkGray'
  Say '    - no admin rights, no internet, nothing installed silently' 'DarkGray'
  Say '    - press Enter on any question to keep the [default]' 'DarkGray'

  # ---- find the source extensions ------------------------------------
  $SrcDir = $env:DS_DIR
  if (-not $SrcDir) { throw 'Could not work out where this file lives.' }
  $SrcDir = $SrcDir.TrimEnd('\', '/')

  $AllExts = @(
    @{ Dir = 'wa-dev'; Title = 'WhatsApp Web'; Prefix = 'dz' },
    @{ Dir = 'yt-dev'; Title = 'YouTube';      Prefix = 'yd' },
    @{ Dir = 'dc-dev'; Title = 'Discord';      Prefix = 'dd' }
  )
  $Avail = @()
  foreach ($e in $AllExts) {
    if (Test-Path -LiteralPath (Join-Path (Join-Path $SrcDir $e.Dir) 'manifest.json')) { $Avail += $e }
  }
  if ($Avail.Count -eq 0) {
    Write-Host ''
    Say '  I cannot find the extension folders (wa-dev, yt-dev, dc-dev).' 'Red'
    Say '  This usually means the ZIP was not extracted yet.' 'Yellow'
    Say '    1. Close this window' 'Gray'
    Say '    2. Right-click the downloaded ZIP and choose "Extract All..."' 'Gray'
    Say '    3. Open the extracted folder and run this file again from there' 'Gray'
    return
  }

  # ---- remembered answers from last time -----------------------------
  $DefaultOut = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'DevSkins'
  $prev = $null
  $prevFile = Join-Path $DefaultOut 'devskins-settings.json'
  if (Test-Path -LiteralPath $prevFile) {
    try { $prev = ConvertFrom-Json ([IO.File]::ReadAllText($prevFile, $Utf8)) } catch { $prev = $null }
  }
  function Prev([string]$k, $fallback) {
    if ($null -ne $prev -and $null -ne $prev.PSObject.Properties[$k]) {
      $v = $prev.$k
      if ($null -ne $v -and ([string]$v) -ne '') { return $v }
    }
    return $fallback
  }
  if ($null -ne $prev) { Write-Host ''; Say '  Welcome back. I remembered your last answers as the defaults.' 'DarkGray' }

  # ---- 1. which extensions -------------------------------------------
  Step '1/6' 'Which extensions do you want?'
  for ($i = 0; $i -lt $Avail.Count; $i++) {
    Say ('      [' + ($i + 1) + '] ' + $Avail[$i].Title.PadRight(14) + ' (' + $Avail[$i].Dir + ')') 'Gray'
  }
  Say '      [A] All of them' 'Gray'
  $selected = $null
  while ($null -eq $selected) {
    $raw = Ask 'Type A, or numbers like 1,3' 'A'
    if ($raw -match '^(a|all)$') { $selected = $Avail; continue }
    $nums = @($raw -split '[,\s]+' | Where-Object { $_ -ne '' })
    $ok = ($nums.Count -gt 0)
    $picked = @()
    foreach ($n in $nums) {
      if ($n -match '^\d+$' -and ([int]$n) -ge 1 -and ([int]$n) -le $Avail.Count) {
        $item = $Avail[([int]$n) - 1]
        if ($picked -notcontains $item) { $picked += $item }
      } else { $ok = $false }
    }
    if ($ok) { $selected = $picked } else { Say '    Please type A, or numbers from the list.' 'Yellow' }
  }

  # ---- 2. identity ---------------------------------------------------
  Step '2/6' 'Your name on the status bar'
  Say '      Shows as   name@host   in every status bar and popup.' 'DarkGray'
  Say '      Letters, numbers, - and _ only (max 20).' 'DarkGray'
  $name = AskMatch 'Your name or nickname' (Prev 'name' 'dev') '^[A-Za-z0-9_-]{1,20}$' 'Use letters, numbers, - or _ (max 20).'
  $hostName = AskMatch 'Machine / label after the @ (e.g. laptop, home)' (Prev 'host' 'devbox') '^[A-Za-z0-9_-]{1,20}$' 'Use letters, numbers, - or _ (max 20).'
  $identity = $name + '@' + $hostName

  # ---- 3. accent -----------------------------------------------------
  Step '3/6' 'Accent color'
  $Presets = @(@('green', '#4dffa0'), @('amber', '#ffb454'), @('cyan', '#5ccfff'), @('magenta', '#ff6ac1'), @('red', '#ff5c6c'))
  for ($i = 0; $i -lt $Presets.Count; $i++) {
    Say ('      [' + ($i + 1) + '] ' + $Presets[$i][0].PadRight(8) + $Presets[$i][1]) 'Gray'
  }
  Say '      ...or type your own hex color, like  #ff9f43' 'DarkGray'
  $accent = $null
  while ($null -eq $accent) {
    $raw = Ask 'Pick 1-5 or a hex color' (Prev 'accent' '#4dffa0')
    $cand = $null
    if ($raw -match '^[1-5]$') { $cand = $Presets[([int]$raw) - 1][1] }
    elseif ($raw -match '^#?[0-9a-fA-F]{6}$') { $cand = '#' + $raw.TrimStart('#').ToLower() }
    if ($null -eq $cand) { Say '    Please pick 1-5 or a color like #ff9f43.' 'Yellow'; continue }
    if ((Get-Lum $cand) -lt 0.1975) {
      Say '    That color is quite dark. Text drawn on top of it may be hard to read.' 'Yellow'
      if (-not (AskYes '    Use it anyway?' $false)) { continue }
    }
    $accent = $cand
  }
  $rgbText = Get-RgbText $accent

  # ---- 4. per-extension options --------------------------------------
  Step '4/6' 'Options for each extension'
  $opt = @{}
  $logo = $name + '@yt:~$'
  foreach ($e in $selected) {
    Write-Host ''
    Say ('  ' + $e.Title + ' (' + $e.Dir + ')') 'White'
    if ($e.Dir -eq 'wa-dev') {
      $fs = AskMatch 'Message font size, 11 to 16' ([string](Prev 'waFontSize' '13')) '^1[1-6]$' 'Type a number from 11 to 16.'
      $opt['wa-dev'] = @{ fontSize = $fs }
    }
    if ($e.Dir -eq 'yt-dev') {
      $logo = AskMatch 'Text that replaces the YouTube logo' (Prev 'ytLogo' $logo) '^[A-Za-z0-9@:~$._ -]{1,24}$' 'Up to 24 characters: letters, numbers and @ : ~ $ . _ - only.'
      $s = AskYes 'Hide YouTube Shorts?' ([bool](Prev 'ytHideShorts' $true))
      $f = AskYes 'Hide the home feed (focus mode)?' ([bool](Prev 'ytHideFeed' $false))
      $opt['yt-dev'] = @{ hideShorts = (Flag $s); hideFeed = (Flag $f); _s = $s; _f = $f }
    }
    if ($e.Dir -eq 'dc-dev') {
      $m = AskYes 'Hide the member list?' ([bool](Prev 'dcHideMembers' $false))
      $n2 = AskYes 'Hide Nitro / Shop / Quests entries?' ([bool](Prev 'dcHideNitro' $true))
      $opt['dc-dev'] = @{ hideMembers = (Flag $m); hideNitro = (Flag $n2); _m = $m; _n = $n2 }
    }
  }

  # ---- 5. where to save ----------------------------------------------
  Step '5/6' 'Where should I save your copies?'
  Say '      Your browser loads the extensions FROM this folder, so keep it' 'DarkGray'
  Say '      somewhere permanent. Do not delete or move it later.' 'DarkGray'
  $Out = $null
  while ($null -eq $Out) {
    $raw = (Ask 'Folder' (Prev 'out' $DefaultOut)).Trim('"').Trim()
    try { $full = [IO.Path]::GetFullPath($raw) } catch { Say '    That is not a valid folder path.' 'Yellow'; continue }
    $full = $full.TrimEnd('\', '/')
    $root = ([IO.Path]::GetPathRoot($full)).TrimEnd('\', '/')
    if ($full -ieq $root -or $full -eq '') { Say '    Please choose a folder, not a whole drive.' 'Yellow'; continue }
    $cmp = [StringComparison]::OrdinalIgnoreCase
    if (($full + $sep).StartsWith(($SrcDir + $sep), $cmp)) {
      Say '    Please choose a folder OUTSIDE the downloaded one, so nothing gets mixed up.' 'Yellow'; continue
    }
    $clash = $false
    foreach ($e in $selected) {
      if ((Join-Path $full $e.Dir) -ieq (Join-Path $SrcDir $e.Dir)) { $clash = $true }
    }
    if ($clash) { Say '    That would overwrite the original files. Pick another folder.' 'Yellow'; continue }
    $Out = $full
  }

  # existing copies must look like ours before we ever replace them
  $replacing = @()
  foreach ($e in $selected) {
    $to = Join-Path $Out $e.Dir
    if (Test-Path -LiteralPath $to) {
      $mf = Join-Path $to 'manifest.json'
      $looksOurs = $false
      if (Test-Path -LiteralPath $mf) {
        try { $looksOurs = ((ConvertFrom-Json ([IO.File]::ReadAllText($mf, $Utf8))).name -like ($e.Dir + '*')) } catch { $looksOurs = $false }
      }
      if (-not $looksOurs) {
        Write-Host ''
        Say ('  A folder named "' + $e.Dir + '" already exists in ' + $Out + ' and it is not one of mine.') 'Red'
        Say '  I will not touch it. Run me again and choose a different folder.' 'Yellow'
        return
      }
      $replacing += $e.Dir
    }
  }

  # ---- 6. review ------------------------------------------------------
  Step '6/6' 'Review'
  Say ('      Name on status bar : ' + $identity) 'Gray'
  Say ('      Accent color       : ' + $accent) 'Gray'
  foreach ($e in $selected) {
    $extra = ''
    if ($e.Dir -eq 'wa-dev') { $extra = 'font size ' + $opt['wa-dev'].fontSize }
    if ($e.Dir -eq 'yt-dev') { $extra = 'logo "' + $logo + '", hide Shorts: ' + (YesNoText $opt['yt-dev']._s) + ', hide feed: ' + (YesNoText $opt['yt-dev']._f) }
    if ($e.Dir -eq 'dc-dev') { $extra = 'hide members: ' + (YesNoText $opt['dc-dev']._m) + ', hide Nitro: ' + (YesNoText $opt['dc-dev']._n) }
    Say ('      ' + $e.Title.PadRight(14) + ' : ' + $extra) 'Gray'
  }
  Say ('      Save to            : ' + $Out) 'Gray'
  if ($replacing.Count -gt 0) {
    Say ('      Will be replaced   : ' + ($replacing -join ', ') + '  (your earlier copies there)') 'Yellow'
  }
  Write-Host ''
  if (-not (AskYes 'Create these customized copies now?' $true)) {
    Say '  No problem. Nothing was changed.' 'Yellow'
    return
  }

  # ---- build ----------------------------------------------------------
  Write-Host ''
  Say '  Building...' 'White'
  [void](New-Item -ItemType Directory -Force -Path $Out)
  $built = @()
  foreach ($e in $selected) {
    $from = Join-Path $SrcDir $e.Dir
    $to = Join-Path $Out $e.Dir
    if (Test-Path -LiteralPath $to) { Remove-Item -LiteralPath $to -Recurse -Force }
    Copy-Item -LiteralPath $from -Destination $to -Recurse -Force

    $files = Get-ChildItem -LiteralPath $to -Recurse -File | Where-Object { @('.js', '.css', '.html') -contains $_.Extension.ToLower() }
    foreach ($f in $files) {
      $t = [IO.File]::ReadAllText($f.FullName, $Utf8)
      $orig = $t
      $t = $t.Replace('devz@aqshai', $identity)
      $t = $t.Replace('devz@yt:~$', $logo)
      $t = $t.Replace('devz@yt', ($name + '@yt'))
      $t = $t.Replace("accent: '#4dffa0'", ("accent: '" + $accent + "'"))
      $t = $t.Replace(('--' + $e.Prefix + '-accent: #4dffa0;'), ('--' + $e.Prefix + '-accent: ' + $accent + ';'))
      $t = $t.Replace(('--' + $e.Prefix + '-accent-rgb: 77, 255, 160;'), ('--' + $e.Prefix + '-accent-rgb: ' + $rgbText + ';'))
      $t = $t.Replace('--accent: #4dffa0;', ('--accent: ' + $accent + ';'))
      if ($f.Name -eq 'defaults.js') {
        if ($e.Dir -eq 'wa-dev') { $t = Set-Flag $t 'fontSize' $opt['wa-dev'].fontSize }
        if ($e.Dir -eq 'yt-dev') {
          $t = Set-Flag $t 'hideShorts' $opt['yt-dev'].hideShorts
          $t = Set-Flag $t 'hideFeed' $opt['yt-dev'].hideFeed
        }
        if ($e.Dir -eq 'dc-dev') {
          $t = Set-Flag $t 'hideMembers' $opt['dc-dev'].hideMembers
          $t = Set-Flag $t 'hideNitro' $opt['dc-dev'].hideNitro
        }
      }
      if ($t -ne $orig) { [IO.File]::WriteAllText($f.FullName, $t, $Utf8NoBom) }
    }

    # sanity checks on the result
    $good = $true
    try { [void](ConvertFrom-Json ([IO.File]::ReadAllText((Join-Path $to 'manifest.json'), $Utf8))) } catch { $good = $false }
    $cj = Get-ChildItem -LiteralPath $to -Recurse -File -Filter 'content.js' | Select-Object -First 1
    if ($null -eq $cj -or -not ([IO.File]::ReadAllText($cj.FullName, $Utf8)).Contains($identity)) { $good = $false }
    if ($good) {
      Write-Host '    [OK]   ' -NoNewline -ForegroundColor Green
      Say ($e.Title + '  ->  ' + $to) 'Gray'
      $built += $e
    } else {
      Write-Host '    [WARN] ' -NoNewline -ForegroundColor Yellow
      Say ($e.Title + ' was copied but a check failed. Run me again, and if it repeats please report it.') 'Yellow'
    }
  }

  # remember answers for next time
  try {
    $rec = [ordered]@{
      name = $name; host = $hostName; accent = $accent; out = $Out
      ytLogo = $logo
    }
    if ($opt.ContainsKey('wa-dev')) { $rec['waFontSize'] = $opt['wa-dev'].fontSize }
    if ($opt.ContainsKey('yt-dev')) { $rec['ytHideShorts'] = $opt['yt-dev']._s; $rec['ytHideFeed'] = $opt['yt-dev']._f }
    if ($opt.ContainsKey('dc-dev')) { $rec['dcHideMembers'] = $opt['dc-dev']._m; $rec['dcHideNitro'] = $opt['dc-dev']._n }
    $recFile = Join-Path $DefaultOut 'devskins-settings.json'
    [void](New-Item -ItemType Directory -Force -Path $DefaultOut)
    [IO.File]::WriteAllText($recFile, ($rec | ConvertTo-Json), $Utf8NoBom)
  } catch {}

  if ($built.Count -eq 0) { return }

  # ---- optional: guided browser install -------------------------------
  Write-Host ''
  Rule
  Say '  Last step: loading them into your browser' 'White'
  Say '  Browsers do not allow a script to install extensions silently' 'DarkGray'
  Say '  (that is a security feature). It takes 3 clicks per extension,' 'DarkGray'
  Say '  and I can walk you through it and do the fiddly parts.' 'DarkGray'
  Write-Host ''
  Say '  If you say yes, I will ONLY:' 'Gray'
  Say '    - open your browser on its Extensions page' 'DarkGray'
  Say '    - copy each extension folder path to your clipboard, one at a time' 'DarkGray'
  Say '    - open the save folder in File Explorer' 'DarkGray'
  Say '  I will NOT change any browser setting or install anything myself.' 'DarkGray'
  Write-Host ''
  if (-not (AskYes 'Walk me through installing now?' $true)) {
    Say '' 'Gray'
    Say '  Okay. To install later:' 'White'
    Say '    1. Open  chrome://extensions  (Edge: edge://extensions)' 'Gray'
    Say '    2. Turn on "Developer mode"' 'Gray'
    Say '    3. Click "Load unpacked" and choose each folder in:' 'Gray'
    Say ('       ' + $Out) 'Green'
    return
  }

  $pf = $env:ProgramFiles
  $pf86 = ${env:ProgramFiles(x86)}
  $lad = $env:LOCALAPPDATA
  $all = @(
    @{ Name = 'Google Chrome';  Url = 'chrome://extensions'; Exe = (Find-Exe 'chrome.exe' @(($pf + '\Google\Chrome\Application\chrome.exe'), ($pf86 + '\Google\Chrome\Application\chrome.exe'), ($lad + '\Google\Chrome\Application\chrome.exe'))) },
    @{ Name = 'Microsoft Edge'; Url = 'edge://extensions';   Exe = (Find-Exe 'msedge.exe' @(($pf86 + '\Microsoft\Edge\Application\msedge.exe'), ($pf + '\Microsoft\Edge\Application\msedge.exe'))) },
    @{ Name = 'Brave';          Url = 'brave://extensions';  Exe = (Find-Exe 'brave.exe' @(($pf + '\BraveSoftware\Brave-Browser\Application\brave.exe'), ($pf86 + '\BraveSoftware\Brave-Browser\Application\brave.exe'), ($lad + '\BraveSoftware\Brave-Browser\Application\brave.exe'))) }
  )
  $browsers = @($all | Where-Object { $_.Exe })
  if ($browsers.Count -eq 0) {
    Write-Host ''
    Say '  I could not find Chrome, Edge or Brave on this PC.' 'Yellow'
    Say '  Open your browser yourself, go to  chrome://extensions  and follow:' 'Gray'
    Say '    1. Turn on "Developer mode"   2. Click "Load unpacked"' 'Gray'
    Say ('    3. Choose each folder inside: ' + $Out) 'Green'
    return
  }
  $b = $browsers[0]
  if ($browsers.Count -gt 1) {
    Write-Host ''
    for ($i = 0; $i -lt $browsers.Count; $i++) { Say ('      [' + ($i + 1) + '] ' + $browsers[$i].Name) 'Gray' }
    $pick = AskMatch 'Which browser?' '1' ('^[1-' + $browsers.Count + ']$') 'Type one of the numbers above.'
    $b = $browsers[([int]$pick) - 1]
  }

  Write-Host ''
  Say ('  Opening ' + $b.Name + ' on its Extensions page...') 'White'
  try { Start-Process -FilePath $b.Exe -ArgumentList $b.Url } catch { Say '  (Could not open it automatically. Open the Extensions page yourself.)' 'Yellow' }
  try { Start-Process -FilePath $Out } catch {}
  Write-Host ''
  Say '  In the browser:' 'White'
  Say '    A. Turn ON "Developer mode" (the switch in the top-right corner)' 'Gray'
  Say '    B. Click "Load unpacked"' 'Gray'
  Say '    C. In the folder box press Ctrl+V, then Enter / "Select Folder"' 'Gray'
  Say '  If Developer mode is greyed out, your PC is managed by an organization' 'DarkGray'
  Say '  and the browser will not allow this.' 'DarkGray'

  $n = 0
  foreach ($e in $built) {
    $n++
    $path = Join-Path $Out $e.Dir
    $copied = $false
    try { Set-Clipboard -Value $path; $copied = $true } catch {
      try { $path | & clip; $copied = $true } catch {}
    }
    Write-Host ''
    Say ('  Extension ' + $n + ' of ' + $built.Count + ': ' + $e.Title) 'White'
    if ($copied) { Say '    Path copied to your clipboard:' 'DarkGray' } else { Say '    Choose this folder:' 'DarkGray' }
    Say ('    ' + $path) 'Green'
    Wait-Enter 'Press Enter after you have loaded it'
  }

  Write-Host ''
  Rule
  Say '  All done!' 'Green'
  Say '    - Refresh any open WhatsApp / YouTube / Discord tabs' 'Gray'
  Say '    - Click the puzzle icon in the toolbar and pin the extensions' 'Gray'
  Say '    - To change anything later, just run this file again' 'Gray'
  Say ('    - Keep this folder where it is: ' + $Out) 'Gray'
}

try {
  Main
} catch {
  Write-Host ''
  Say ('  Something went wrong: ' + $_.Exception.Message) 'Red'
  Say '  Nothing was installed. Your original files are untouched.' 'Yellow'
}
