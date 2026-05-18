# boot.ps1 - AI USB Assistant Core Boot Logic (Windows)
# =========================================================================
# Two-Layer Architecture:
#   System Layer (system/)  - Immutable, updated atomically
#   User Layer   (user/)    - Persistent, never touched by updates
#
# Environment variable bridge connects OpenClaw to U-disk paths.
# Zero host footprint: all writes go to U-disk.
# =========================================================================

param(
    [switch]$CheckOnly,          # Verify system integrity without starting
    [switch]$SkipUpdateCheck,    # Skip checking for pending updates
    [int]$Port = 0               # Force specific port (0 = auto-find)
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# =========================================================================
# 1. DETECT USB ROOT
# =========================================================================
# system/scripts/boot.ps1 -> system/scripts/ -> system/ -> USB_ROOT
$SystemDir = Split-Path -Parent $ScriptDir
$USB_ROOT = Split-Path -Parent $SystemDir

$SYSTEM_DIR    = Join-Path $USB_ROOT "system"
$USER_DIR      = Join-Path $USB_ROOT "user"
$DATA_DIR      = Join-Path $USB_ROOT "data"
$CACHE_DIR     = Join-Path $USB_ROOT "cache"
$SYSTEM_NEW    = Join-Path $USB_ROOT "system_new"
$SYSTEM_OLD    = Join-Path $USB_ROOT "system_old"
$SYSTEM_BROKEN = Join-Path $USB_ROOT "system_broken"

$MANIFEST_FILE = Join-Path $SYSTEM_DIR "manifest.json"
$VERSION_FILE  = Join-Path $SYSTEM_DIR "VERSION"
$CONFIG_FILE   = [IO.Path]::Combine($USER_DIR, "config", "openclaw.json")

# Detect architecture
$ARCH = "win-x64"  # Current primary target
$NODE_DIR = [IO.Path]::Combine($SYSTEM_DIR, "runtime", "node-$ARCH")
$NODE_EXE  = Join-Path $NODE_DIR "node.exe"
$NPM_CMD   = Join-Path $NODE_DIR "npm.cmd"
$CORE_DIR  = Join-Path $SYSTEM_DIR "core"
$OPENCLAW_MJS = [IO.Path]::Combine($CORE_DIR, "node_modules", "openclaw", "openclaw.mjs")

# Colors for output
function Write-OK    { Write-Host "  [OK] $args" -ForegroundColor Green }
function Write-INFO  { Write-Host "  [i]  $args" -ForegroundColor Cyan }
function Write-WARN  { Write-Host "  [!]  $args" -ForegroundColor Yellow }
function Write-ERROR { Write-Host "  [X]  $args" -ForegroundColor Red }
function Write-BANNER {
    Write-Host ""
    Write-Host "  鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽" -ForegroundColor Cyan
    Write-Host "  鈺?    AI USB Assistant                鈺? -ForegroundColor Cyan
    Write-Host "  鈺?    Portable AI Agent               鈺? -ForegroundColor Cyan
    Write-Host "  鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆" -ForegroundColor Cyan
    Write-Host ""
}

# =========================================================================
# 2. ATOMIC UPDATE: DETECT & ACTIVATE pending system_new/
# =========================================================================
function Invoke-AtomicUpdate {
    if (-not (Test-Path $SYSTEM_NEW)) { return }

    # Verify system_new has boot script
    $newBoot = [IO.Path]::Combine($SYSTEM_NEW, "scripts", "boot.ps1")
    if (-not (Test-Path $newBoot)) {
        Write-WARN "system_new/ found but missing boot.ps1 - cleaning up"
        Remove-Item $SYSTEM_NEW -Recurse -Force -ErrorAction SilentlyContinue
        return
    }

    Write-BANNER
    Write-INFO "Pending system update detected. Activating..."

    # Step 1: Remove old backup if exists
    if (Test-Path $SYSTEM_OLD) {
        Remove-Item $SYSTEM_OLD -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Step 2: Backup current system
    Write-INFO "Backing up current system..."
    Rename-Item $SYSTEM_DIR $SYSTEM_OLD -ErrorAction SilentlyContinue
    if (-not (Test-Path $SYSTEM_OLD)) {
        # Rename failed, try copy+delete
        Copy-Item $SYSTEM_DIR $SYSTEM_OLD -Recurse -Force
        Remove-Item $SYSTEM_DIR -Recurse -Force
    }

    # Save old manifest as prev for future incremental diff calculations
    # Stored at USB root level so it survives system_old/ cleanup
    $oldManifest = Join-Path $SYSTEM_OLD "manifest.json"
    $prevManifest = Join-Path $USB_ROOT "manifest_prev.json"
    if (Test-Path $oldManifest) {
        Copy-Item $oldManifest $prevManifest -Force
        Write-INFO "Previous manifest saved as manifest_prev.json"
    }

    # Step 3: Activate new system
    Write-INFO "Activating new system..."
    Rename-Item $SYSTEM_NEW $SYSTEM_DIR
    $newVersion = Get-Content (Join-Path $SYSTEM_DIR "VERSION") -ErrorAction SilentlyContinue
    Write-OK "System updated to $newVersion"

    # Step 4: Verify new system boots
    Write-INFO "Verifying new system..."
    $checkResult = & ([IO.Path]::Combine($SYSTEM_DIR, "scripts", "boot.ps1")) -CheckOnly 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-ERROR "New system verification failed! Rolling back..."
        Rename-Item $SYSTEM_DIR $SYSTEM_BROKEN
        Rename-Item $SYSTEM_OLD $SYSTEM_DIR
        Write-WARN "Rolled back to previous version. system_broken/ saved for debugging."
        Start-Sleep 3
    } else {
        Write-OK "New system verified successfully"
        Remove-Item $SYSTEM_OLD -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Re-source paths (since system/ was replaced)
    $script:MANIFEST_FILE = Join-Path $SYSTEM_DIR "manifest.json"
    $script:VERSION_FILE  = Join-Path $SYSTEM_DIR "VERSION"
    $script:NODE_EXE      = [IO.Path]::Combine($SYSTEM_DIR, "runtime", "node-$ARCH", "node.exe")
    $script:NPM_CMD       = [IO.Path]::Combine($SYSTEM_DIR, "runtime", "node-$ARCH", "npm.cmd")
    $script:CORE_DIR      = Join-Path $SYSTEM_DIR "core"
    $script:OPENCLAW_MJS  = [IO.Path]::Combine($CORE_DIR, "node_modules", "openclaw", "openclaw.mjs")
}

# =========================================================================
# 3. CHECK-ONLY MODE
# =========================================================================
function Test-SystemIntegrity {
    Write-INFO "Checking system integrity..."

    if (-not (Test-Path $NODE_EXE)) {
        Write-ERROR "Node.js runtime not found: $NODE_EXE"
        Write-INFO "Run setup.ps1 to download dependencies."
        return $false
    }

    if (-not (Test-Path $OPENCLAW_MJS)) {
        Write-ERROR "OpenClaw not found: $OPENCLAW_MJS"
        Write-INFO "Run setup.ps1 to install OpenClaw."
        return $false
    }

    if (Test-Path $MANIFEST_FILE) {
        try {
            $manifest = Get-Content $MANIFEST_FILE -Raw | ConvertFrom-Json
            $allOk = $true
            foreach ($file in $manifest.files.PSObject.Properties) {
                $filePath = Join-Path $USB_ROOT $file.Name
                if ($file.Value.required) {
                    if (-not (Test-Path $filePath)) {
                        Write-WARN "Missing required file: $($file.Name)"
                        $allOk = $false
                    } else {
                        try {
                            $actualHash = (Get-FileHash -Path $filePath -Algorithm SHA256 -ErrorAction Stop).Hash.ToLower()
                            if ($actualHash -ne $file.Value.sha256) {
                                Write-WARN "Corrupted file (hash mismatch): $($file.Name)"
                                $allOk = $false
                            }
                        } catch {
                            Write-WARN "Could not verify hash: $($file.Name)"
                        }
                    }
                }
            }
            if ($allOk) { Write-OK "System integrity verified (SHA256)" }
            else { Write-WARN "Some system files missing or corrupted - run UPDATE.bat to repair" }
        } catch {
            Write-WARN "Could not verify manifest: $_"
        }
    } else {
        Write-WARN "No manifest.json found - skipping integrity check"
    }

    return $true
}

if ($CheckOnly) {
    $ok = Test-SystemIntegrity
    if ($ok) { exit 0 } else { exit 1 }
}

# =========================================================================
# 4. MAIN BOOT SEQUENCE
# =========================================================================

# --- 4.0 Atomic Update Check ---
if (-not $SkipUpdateCheck) {
    Invoke-AtomicUpdate
}

Write-BANNER

# --- 4.1 Environment Check ---
Write-INFO "Checking environment..."
if (-not (Test-Path $NODE_EXE)) {
    Write-ERROR "Node.js runtime not found: $NODE_EXE"
    Write-INFO "Please run: system/scripts/setup.ps1"
    exit 1
}
$nodeVersion = & $NODE_EXE --version 2>&1
Write-OK "Node.js $nodeVersion"

# --- 4.2 Create Directory Structure ---
Write-INFO "Preparing directories..."
$dirs = @(
    # User data dirs
    "$USER_DIR\config", "$USER_DIR\skills", "$USER_DIR\memory",
    "$USER_DIR\identity", "$USER_DIR\workspace", "$USER_DIR\devices",
    "$USER_DIR\browser", "$USER_DIR\backups", "$USER_DIR\logs",
    # Data bridge
    "$DATA_DIR", "$DATA_DIR\.openclaw", "$DATA_DIR\memory",
    "$DATA_DIR\workspace", "$DATA_DIR\skills",
    # Cache
    "$CACHE_DIR\temp", "$CACHE_DIR\npm",
    "$CACHE_DIR\appdata\Roaming", "$CACHE_DIR\appdata\Local"
)
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

# --- 4.3 Data Bridge (Junctions) ---
Write-INFO "Setting up data bridge..."

function New-SafeJunction {
    param([string]$Link, [string]$Target)
    # Remove existing junction/link/directory if present
    if (Test-Path $Link) {
        $item = Get-Item $Link -ErrorAction SilentlyContinue
        if ($item.LinkType -eq "Junction" -or $item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            cmd /c "rmdir `"$Link`"" 2>$null | Out-Null
        } else {
            Remove-Item $Link -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    $null = cmd /c "mklink /J `"$Link`" `"$Target`"" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Bridge: $Link -> $Target"
    } else {
        # Fallback: copy if junction not available (e.g. FAT32 USB)
        Write-WARN "Junction failed, using directory copy fallback"
        Copy-Item $Target $Link -Recurse -Force -ErrorAction SilentlyContinue
    }
}

New-SafeJunction -Link "$DATA_DIR\.openclaw" -Target "$USER_DIR\config"
New-SafeJunction -Link "$DATA_DIR\memory"     -Target "$USER_DIR\memory"
New-SafeJunction -Link "$DATA_DIR\workspace"  -Target "$USER_DIR\workspace"

# Skills: merge system + user at boot time
Write-INFO "Merging skills..."

# Helper: read YAML frontmatter from a SKILL.md and check for protected flag
function Test-SkillProtected {
    param([string]$SkillDir)
    $skillMd = Join-Path $SkillDir "SKILL.md"
    if (-not (Test-Path $skillMd)) { return $false }
    try {
        $content = Get-Content $skillMd -Raw -ErrorAction Stop
        # Match YAML frontmatter between --- delimiters
        if ($content -match '^---\s*\n(.*?)\n---') {
            $frontmatter = $matches[1]
            if ($frontmatter -match 'protected\s*:\s*true') {
                return $true
            }
        }
    } catch { }
    return $false
}

if (Test-Path "$DATA_DIR\skills") {
    Remove-Item "$DATA_DIR\skills\*" -Recurse -Force -ErrorAction SilentlyContinue
}

# Step 1: Copy system skills
$protectedSkills = @()
if (Test-Path "$SYSTEM_DIR\skills") {
    Copy-Item "$SYSTEM_DIR\skills\*" "$DATA_DIR\skills\" -Recurse -Force -ErrorAction SilentlyContinue

    # Identify protected system skills
    Get-ChildItem "$SYSTEM_DIR\skills" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        if (Test-SkillProtected $_.FullName) {
            $protectedSkills += $_.Name
        }
    }
}

# Step 2: Copy user skills (skip if would override a protected system skill)
$skippedProtected = @()
if (Test-Path "$USER_DIR\skills") {
    Get-ChildItem "$USER_DIR\skills" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $userSkillName = $_.Name
        if ($userSkillName -in $protectedSkills) {
            $skippedProtected += $userSkillName
        } else {
            Copy-Item $_.FullName "$DATA_DIR\skills\" -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

$skillCount = (Get-ChildItem "$DATA_DIR\skills" -Directory -ErrorAction SilentlyContinue | Measure-Object).Count
if ($skippedProtected.Count -gt 0) {
    Write-WARN "Protected system skills (user override skipped): $($skippedProtected -join ', ')"
}
Write-OK "Skills ready ($skillCount skills" + $(if ($protectedSkills.Count -gt 0) { ", $($protectedSkills.Count) protected" } else { "" }) + ")"

# --- 4.4 Set Environment Variables (100% U-disk) ---
Write-INFO "Configuring portable environment..."

$env:OPENCLAW_HOME        = $DATA_DIR
$env:OPENCLAW_STATE_DIR   = "$DATA_DIR\.openclaw"
$env:OPENCLAW_CONFIG_PATH  = $CONFIG_FILE
$env:OPENCLAW_SKILLS_PATH  = "$DATA_DIR\skills"

# Redirect ALL writes to U-disk (zero host footprint)
$env:TEMP          = "$CACHE_DIR\temp"
$env:TMP           = "$CACHE_DIR\temp"
$env:APPDATA       = "$CACHE_DIR\appdata\Roaming"
$env:LOCALAPPDATA  = "$CACHE_DIR\appdata\Local"
$env:NPM_CONFIG_CACHE = "$CACHE_DIR\npm"
$env:HOME          = "$CACHE_DIR\home"

# NOTE: USERPROFILE is intentionally NOT redirected.
# Many Windows components (UAC, registry reads, etc.) bypass the
# environment variable and read the real path directly. Redirecting
# it can cause unpredictable behavior. HOME is sufficient for
# Unix-compatible tooling (git, ssh, npm) that respects $HOME.

# Ensure clean PATH - only system essentials + U-disk Node.js
$env:PATH = "$NODE_DIR;$env:SystemRoot\system32;$env:SystemRoot;$env:SystemRoot\System32\WindowsPowerShell\v1.0"

Write-OK "Environment configured (all writes to U-disk)"

# --- 4.5 First Run: Default Config ---
if (-not (Test-Path $CONFIG_FILE)) {
    Write-INFO "First run detected - creating default config..."
    $defaultConfig = @{
        gateway = @{
            mode = "local"
            auth = @{ token = "uclaw" }
        }
        meta = @{
            lastTouchedVersion = (Get-Content $VERSION_FILE -ErrorAction SilentlyContinue).Trim()
            lastTouchedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.000Z")
        }
        update = @{
            auto = @{ enabled = $true }
            checkOnStart = $true
        }
    }
    $defaultConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath $CONFIG_FILE -Encoding UTF8
    Write-OK "Default config created at user/config/openclaw.json"
}

# --- 4.6 Check Dependencies ---
# Check for actual openclaw.mjs, not just node_modules directory.
# If node_modules exists but openclaw is corrupted, this catches it.
if (-not (Test-Path $OPENCLAW_MJS)) {
    Write-WARN "OpenClaw not found or corrupted. Running first-time setup..."
    Push-Location $CORE_DIR
    try {
        # Remove potentially corrupted node_modules to force clean install
        if (Test-Path "$CORE_DIR\node_modules") {
            Remove-Item "$CORE_DIR\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        }
        & $NPM_CMD install --registry=https://registry.npmmirror.com 2>&1 | Out-Null
        if (Test-Path $OPENCLAW_MJS) {
            Write-OK "Dependencies installed"
        } else {
            Write-ERROR "Dependencies installation may have failed - openclaw.mjs not found"
            Write-INFO "Please run: system/scripts/setup.ps1"
            exit 1
        }
    } catch {
        Write-ERROR "Failed to install dependencies: $_"
        Write-INFO "Please run: system/scripts/setup.ps1"
        exit 1
    } finally {
        Pop-Location
    }
}

# --- 4.7 Find Available Port ---
Write-INFO "Finding available port..."
$startPort = if ($Port -gt 0) { $Port } else { 18789 }
$selectedPort = $startPort
$portFound = $false

for ($p = $startPort; $p -le 18799; $p++) {
    $inUse = netstat -ano 2>$null | Select-String ":$p " | Select-String "LISTENING"
    if (-not $inUse) {
        $selectedPort = $p
        $portFound = $true
        break
    }
}

if (-not $portFound) {
    Write-ERROR "No available port in range $startPort-18799"
    exit 1
}
Write-OK "Using port: $selectedPort"

# --- 4.8 Find Config Center Port & Start ---
Write-INFO "Starting Config Center..."
$configServer = [IO.Path]::Combine($SYSTEM_DIR, "config-center", "server.js")
$configServerDir = Join-Path $SYSTEM_DIR "config-center"
$configProcess = $null  # Always initialize for safe cleanup

# Scan for available port (18788 default, scan down to 18780 if busy)
$configPort = 18788
$configPortFound = $false
for ($cp = 18788; $cp -ge 18780; $cp--) {
    $inUse = netstat -ano 2>$null | Select-String ":$cp " | Select-String "LISTENING"
    if (-not $inUse) {
        $configPort = $cp
        $configPortFound = $true
        break
    }
}
if (-not $configPortFound) {
    Write-WARN "No port available for Config Center (18780-18788) - skipping"
} elseif (Test-Path $configServer) {
    $env:CONFIG_PORT = $configPort
    $configProcess = Start-Process -FilePath $NODE_EXE `
        -ArgumentList $configServer, "--port", $configPort `
        -WorkingDirectory $configServerDir `
        -WindowStyle Hidden `
        -PassThru
    Start-Sleep 1
    Write-OK "Config Center started on port $configPort"
}

# --- 4.9 Start OpenClaw Gateway ---
Write-INFO "Starting AI Gateway on port $selectedPort..."
Write-Host ""

$gatewayProcess = Start-Process -FilePath $NODE_EXE `
    -ArgumentList $OPENCLAW_MJS, "gateway", "run", "--allow-unconfigured", "--force", "--port", $selectedPort `
    -WorkingDirectory $CORE_DIR `
    -WindowStyle Minimized `
    -PassThru

# --- 4.10 Wait for Gateway Ready ---
Write-INFO "Waiting for gateway to start..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$selectedPort/" -TimeoutSec 1 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        Start-Sleep 0.5
    }
}

if (-not $ready) {
    Write-WARN "Gateway may not be fully ready yet"
}

# --- 4.11 Open Browser ---
Write-INFO "Opening Dashboard and Config Center..."
Start-Process "http://127.0.0.1:$selectedPort/#token=uclaw"

# Open Config Center if this is first run AND server actually started
if ($configPortFound -and (-not (Test-Path $CONFIG_FILE) -or (Get-Item $CONFIG_FILE).Length -lt 100)) {
    Start-Process "http://127.0.0.1:$configPort/"
}

# --- 4.12 Display Status ---
Write-Host ""
Write-Host "  鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺? -ForegroundColor Green
Write-Host "   AI Assistant is running!" -ForegroundColor Green
Write-Host "   Dashboard:     http://127.0.0.1:$selectedPort/#token=uclaw" -ForegroundColor Cyan
if ($configPortFound) {
    Write-Host "   Config Center: http://127.0.0.1:$configPort/" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "   All data stored on U-disk: $USB_ROOT" -ForegroundColor Yellow
Write-Host "   Close this window to stop the assistant." -ForegroundColor Yellow
Write-Host "  鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺? -ForegroundColor Green
Write-Host ""

# --- 4.13 Cleanup on Exit ---
$cleanupScript = {
    param($gw, $cfg, $cacheDir)
    Write-Host ""
    Write-Host "  Shutting down..." -ForegroundColor Yellow
    if ($gw -and -not $gw.HasExited) {
        $gw.Kill()
    }
    if ($cfg -and -not $cfg.HasExited) {
        $cfg.Kill()
    }
    # Clean cache temp
    Remove-Item "$cacheDir\temp\*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  AI Assistant stopped. Safe to remove U-disk." -ForegroundColor Green
}

try {
    Write-Host "  Press Ctrl+C to stop..." -ForegroundColor DarkGray
    $gatewayProcess.WaitForExit()
} finally {
    & $cleanupScript -gw $gatewayProcess -cfg $configProcess -cacheDir $CACHE_DIR
}

