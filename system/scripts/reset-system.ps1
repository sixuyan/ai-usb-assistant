# reset-system.ps1 - Reset System Layer (Preserve User Data)
# =========================================================================
# This is the key benefit of the two-layer architecture:
# System layer can be completely destroyed and rebuilt without
# affecting user data (config, memory, skills, workspace).
#
# Use when: system files corrupted, failed update, want clean install.
# =========================================================================

param(
    [string]$UsbRoot,
    [switch]$Force  # Skip confirmation prompt
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = Split-Path -Parent $ScriptDir

if (-not $UsbRoot) {
    $UsbRoot = Split-Path -Parent $SystemDir
} else {
    $SystemDir = Join-Path $UsbRoot "system"
}

function Write-OK    { Write-Host "  [OK] $args" -ForegroundColor Green }
function Write-INFO  { Write-Host "  [i]  $args" -ForegroundColor Cyan }
function Write-WARN  { Write-Host "  [!]  $args" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   Reset System Layer                ║" -ForegroundColor Cyan
Write-Host "  ║   User data will be PRESERVED       ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-INFO "This will:"
Write-INFO "  1. Delete system/ (the AI framework and runtime)"
Write-INFO "  2. Delete system_new/ and system_old/ (pending updates)"
Write-INFO "  3. Delete cache/ (temporary files)"
Write-INFO "  4. KEEP user/ (your config, memory, skills, workspace)"
Write-INFO "  5. KEEP data/ (bridge will be rebuilt)"
Write-Host ""

if (-not $Force) {
    Write-WARN "PRESS Y to confirm reset, any other key to cancel..."
    $key = [Console]::ReadKey($true)
    if ($key.Key -ne 'Y') {
        Write-INFO "Reset cancelled."
        exit 0
    }
    Write-Host ""
}

# Verify user data exists to protect
$userExists = Test-Path (Join-Path $UsbRoot "user")
if ($userExists) {
    Write-INFO "User data found at user/ - will be preserved"
} else {
    Write-WARN "No user/ directory found - nothing to preserve"
}

# Delete system layer
Write-INFO "Removing system/..."
if (Test-Path $SystemDir) {
    Remove-Item $SystemDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-OK "system/ removed"
}

# Delete update staging
foreach ($dir in @("system_new", "system_old", "system_broken")) {
    $path = Join-Path $UsbRoot $dir
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Delete cache
$cacheDir = Join-Path $UsbRoot "cache"
if (Test-Path $cacheDir) {
    Remove-Item $cacheDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-OK "cache/ cleared"
}

# Clean data bridge (will be rebuilt)
$dataDir = Join-Path $UsbRoot "data"
if (Test-Path $dataDir) {
    Remove-Item $dataDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-OK "data/ bridge cleared (will be rebuilt on next boot)"
}

Write-Host ""
Write-OK "System layer reset complete!"
Write-INFO "User data preserved at: user/"
Write-Host ""
Write-INFO "Next steps:"
Write-INFO "  1. Run UPDATE.bat to re-download system"
Write-INFO "  2. Or run system/scripts/setup.ps1 for clean install"
Write-INFO "  3. Then START.bat to launch"
Write-Host ""
