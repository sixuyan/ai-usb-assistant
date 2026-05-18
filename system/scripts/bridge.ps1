# bridge.ps1 - Standalone Data Bridge Setup
# =========================================================================
# Creates directory junctions (Windows) or symlinks (macOS) connecting
# the data/ runtime directory to the user/ persistent layer.
#
# This is also called by boot.ps1, but can be run standalone to repair
# broken bridges after a system reset.
# =========================================================================

param(
    [string]$UsbRoot,
    [switch]$Repair  # Force re-create all bridges
)

$ErrorActionPreference = "Stop"

if (-not $UsbRoot) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $SystemDir = Split-Path -Parent $ScriptDir
    $UsbRoot = Split-Path -Parent $SystemDir
}

$DATA_DIR = Join-Path $UsbRoot "data"
$USER_DIR = Join-Path $UsbRoot "user"

function Write-OK    { Write-Host "  [OK] $args" -ForegroundColor Green }
function Write-INFO  { Write-Host "  [i]  $args" -ForegroundColor Cyan }
function Write-WARN  { Write-Host "  [!]  $args" -ForegroundColor Yellow }

Write-INFO "Setting up data bridge..."

# Ensure directories exist
$dirs = @(
    "$DATA_DIR", "$DATA_DIR\.openclaw", "$DATA_DIR\memory",
    "$DATA_DIR\workspace", "$DATA_DIR\skills",
    "$USER_DIR\config", "$USER_DIR\memory", "$USER_DIR\workspace",
    "$USER_DIR\skills", "$USER_DIR\identity", "$USER_DIR\devices",
    "$USER_DIR\browser", "$USER_DIR\backups", "$USER_DIR\logs"
)
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

# Bridge pairs: data/ link -> user/ target
$bridges = @(
    @{ Link = "$DATA_DIR\.openclaw"; Target = "$USER_DIR\config" },
    @{ Link = "$DATA_DIR\memory";     Target = "$USER_DIR\memory" },
    @{ Link = "$DATA_DIR\workspace";  Target = "$USER_DIR\workspace" }
)

foreach ($bridge in $bridges) {
    $link = $bridge.Link
    $target = $bridge.Target

    if ($Repair -or -not (Test-Path $link)) {
        # Remove existing if any
        if (Test-Path $link) {
            try {
                $item = Get-Item $link -ErrorAction SilentlyContinue
                if ($item.LinkType -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
                    cmd /c "rmdir `"$link`"" 2>$null | Out-Null
                } else {
                    Remove-Item $link -Recurse -Force -ErrorAction SilentlyContinue
                }
            } catch {
                Remove-Item $link -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        # Create junction
        $result = cmd /c "mklink /J `"$link`" `"$target`"" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Bridge: data/$(Split-Path $link -Leaf) -> user/$(Split-Path $target -Leaf)"
        } else {
            Write-WARN "Junction failed for $link (may need NTFS). Using directory."
            Copy-Item $target $link -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-OK "Data bridge ready"
Write-INFO "Runtime data/ mirrors user/ for persistence across system updates"
