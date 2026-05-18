# update.ps1 - AI USB Assistant: Incremental Update Client
# =========================================================================
# Checks for updates, downloads only changed files, stages to system_new/.
# Atomic activation happens on next boot (in boot.ps1).
#
# Usage:
#   .\update.ps1                    # Check & install stable updates
#   .\update.ps1 -CheckOnly         # Only check, don't download
#   .\update.ps1 -Channel beta      # Use beta channel
#   .\update.ps1 -ListChannels      # Show available channels
#   .\update.ps1 -Rollback          # Rollback to previous version
#   .\update.ps1 -Force             # Force full re-download
# =========================================================================

param(
    [string]$UpdateUrl = "",           # Override manifest URL
    [string]$Channel = "stable",       # Update channel (stable/beta)
    [switch]$CheckOnly,               # Only check, don't download
    [switch]$Force,                   # Force re-download all files
    [switch]$Rollback,                # Rollback to system_old/
    [switch]$ListChannels             # Show available update channels
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = Split-Path -Parent $ScriptDir
$USB_ROOT = Split-Path -Parent $SystemDir

$SYSTEM_NEW = Join-Path $USB_ROOT "system_new"
$SYSTEM_OLD = Join-Path $USB_ROOT "system_old"
$MANIFEST_FILE = Join-Path $SystemDir "manifest.json"
$VERSION_FILE  = Join-Path $SystemDir "VERSION"

# =========================================================================
# Update server configuration
# =========================================================================
# Primary: Alibaba Cloud OSS (domestic users)
# Fallbacks: GitHub Releases (international), mirror站点

$OSS_BASE = "https://ai-usb-updates.oss-cn-hangzhou.aliyuncs.com"

# Mirror fallback URLs (tried in order if primary fails)
$MIRROR_URLS = @(
    $OSS_BASE,                                                          # Primary OSS
    "https://ai-usb-updates.oss-accelerate.aliyuncs.com",               # OSS transfer acceleration
    "https://github.com/ai-usb-assistant/releases/download/latest"      # GitHub Releases (TODO)
)

function Get-UpdateUrl {
    param([string]$Channel, [string]$BaseUrl)
    return "$BaseUrl/releases/$Channel/manifest.json"
}

# Default update URL
if (-not $UpdateUrl) {
    $UpdateUrl = Get-UpdateUrl -Channel $Channel -BaseUrl $OSS_BASE
}

function Write-OK    { Write-Host "  [OK] $args" -ForegroundColor Green }
function Write-INFO  { Write-Host "  [i]  $args" -ForegroundColor Cyan }
function Write-WARN  { Write-Host "  [!]  $args" -ForegroundColor Yellow }
function Write-ERROR { Write-Host "  [X]  $args" -ForegroundColor Red }

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "    AI USB Assistant - Update" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# =========================================================================
# List channels mode
# =========================================================================
if ($ListChannels) {
    Write-INFO "Available update channels:"
    Write-INFO "  stable   - Production releases (default)"
    Write-INFO "  beta     - Pre-release testing"
    Write-INFO ""
    Write-INFO "Current channel: $Channel"
    Write-INFO "Update server: $OSS_BASE"
    exit 0
}

# =========================================================================
# Rollback mode
# =========================================================================
if ($Rollback) {
    if (-not (Test-Path $SYSTEM_OLD)) {
        Write-ERROR "No previous version to rollback to (system_old/ not found)"
        exit 1
    }

    Write-WARN "Rolling back to previous version..."

    # Save current as broken
    if (Test-Path "$USB_ROOT\system_broken") {
        Remove-Item "$USB_ROOT\system_broken" -Recurse -Force
    }
    Rename-Item $SystemDir "$USB_ROOT\system_broken"

    # Restore old
    Rename-Item $SYSTEM_OLD $SystemDir

    $oldVersion = Get-Content $VERSION_FILE -ErrorAction SilentlyContinue
    Write-OK "Rolled back to $oldVersion"
    Write-INFO "Restart the assistant to use the previous version."
    exit 0
}

# =========================================================================
# Get current version
# =========================================================================
$currentVersion = "0.0.0"
if (Test-Path $VERSION_FILE) {
    $currentVersion = (Get-Content $VERSION_FILE -Raw).Trim()
}
Write-INFO "Current version: $currentVersion (channel: $Channel)"
Write-INFO "Checking for updates..."

# =========================================================================
# Fetch remote manifest
# =========================================================================
try {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue'

    $remoteManifestJson = Invoke-WebRequest -Uri $UpdateUrl -UseBasicParsing -TimeoutSec 30
    $remote = $remoteManifestJson.Content | ConvertFrom-Json
} catch {
    if ($CheckOnly) {
        Write-OK "No updates available (could not reach update server)"
        exit 0
    }
    Write-ERROR "Failed to fetch update manifest: $_"
    Write-INFO "Check your internet connection or try again later."
    exit 1
}

$remoteVersion = $remote.version
Write-INFO "Remote version: $remoteVersion ($($remote.channel))"

# =========================================================================
# Check if update needed
# =========================================================================
if ($remoteVersion -eq $currentVersion -and -not $Force) {
    Write-OK "You are on the latest version!"
    exit 0
}

if ($CheckOnly) {
    Write-INFO "Update available: $currentVersion → $remoteVersion"
    Write-INFO "Release notes: $($remote.releaseNotes)"
    Write-INFO "Run UPDATE.bat to install."
    exit 0
}

# =========================================================================
# Compute diff
# =========================================================================
Write-INFO "Update available: $currentVersion → $remoteVersion"
Write-INFO "Release notes: $($remote.releaseNotes)"
Write-Host ""

$localManifest = @{}
$manifestSource = $MANIFEST_FILE
# Fallback: use manifest_prev.json if current manifest is missing (e.g. after failed update)
if (-not (Test-Path $MANIFEST_FILE)) {
    $prevPath = Join-Path $USB_ROOT "manifest_prev.json"
    if (Test-Path $prevPath) {
        Write-WARN "system/manifest.json missing - using manifest_prev.json as fallback"
        $manifestSource = $prevPath
    }
}
if (Test-Path $manifestSource) {
    try {
        $local = Get-Content $manifestSource -Raw | ConvertFrom-Json
        foreach ($prop in $local.files.PSObject.Properties) {
            $localManifest[$prop.Name] = $prop.Value.sha256
        }
    } catch {
        Write-WARN "Could not read local manifest - will download all files"
    }
}

$toDownload = @()
$toDelete = @()
$totalSize = 0

# Files to download (new or changed)
foreach ($prop in $remote.files.PSObject.Properties) {
    $filePath = $prop.Name
    $remoteHash = $prop.Value.sha256
    $fileSize = $prop.Value.size

    if ($Force -or -not $localManifest.ContainsKey($filePath) -or $localManifest[$filePath] -ne $remoteHash) {
        $toDownload += @{ path = $filePath; hash = $remoteHash; size = $fileSize }
        $totalSize += $fileSize
    }
}

# Files to delete (removed in remote)
foreach ($filePath in $localManifest.Keys) {
    if (-not ($remote.files.PSObject.Properties | Where-Object { $_.Name -eq $filePath })) {
        $toDelete += $filePath
    }
}

if ($toDownload.Count -eq 0 -and $toDelete.Count -eq 0) {
    Write-OK "System is up to date (manifest differs but no file changes)"
    # Update local manifest to match remote version
    $remoteManifestJson.Content | Out-File -FilePath $MANIFEST_FILE -Encoding UTF8
    $remoteVersion | Out-File -FilePath $VERSION_FILE -Encoding UTF8 -NoNewline
    exit 0
}

Write-INFO "Changes: $($toDownload.Count) files to download, $($toDelete.Count) to remove"
if ($totalSize -gt 0) {
    $totalSizeMB = [math]::Round($totalSize / 1MB, 2)
    Write-INFO "Download size: $totalSizeMB MB"
}

# =========================================================================
# Prepare system_new/
# =========================================================================
if (Test-Path $SYSTEM_NEW) {
    Remove-Item $SYSTEM_NEW -Recurse -Force -ErrorAction SilentlyContinue
}

# Check for large files (>20MB) and warn user
$largeFileThreshold = 20 * 1MB
$largeFiles = $toDownload | Where-Object { $_.size -gt $largeFileThreshold }
if ($largeFiles.Count -gt 0) {
    Write-WARN "This update includes $($largeFiles.Count) large file(s) > 20MB:"
    foreach ($lf in $largeFiles) {
        $sizeMB = [math]::Round($lf.size / 1MB, 1)
        $estimatedTime = if ($sizeMB -gt 50) { " (~$([math]::Round($sizeMB / 5)) mins on slow connections)" } else { "" }
        Write-WARN "  - $($lf.path) ($sizeMB MB)$estimatedTime"
    }
    Write-INFO "Total download: $([math]::Round($totalSize / 1MB, 1)) MB"
    Write-INFO "If you're on a metered connection, press Ctrl+C to cancel."
    Write-Host ""
}

# Copy current system as base, then overwrite changed files
Write-INFO "Preparing new system..."
Copy-Item $SystemDir $SYSTEM_NEW -Recurse -Force -ErrorAction SilentlyContinue

# Delete removed files from system_new
foreach ($filePath in $toDelete) {
    $fullPath = Join-Path $USB_ROOT $filePath
    if (Test-Path $fullPath) {
        Remove-Item $fullPath -Force -ErrorAction SilentlyContinue
    }
}

# =========================================================================
# Download changed files
# =========================================================================
if ($toDownload.Count -gt 0) {
    # Extract base URL from manifest URL
    $baseUrl = $UpdateUrl -replace "/manifest\.json$", ""

    $downloadCount = 0
    $failedFiles = @()

    foreach ($file in $toDownload) {
        $downloadCount++
        $fileUrl = "$baseUrl/files/$($file.path)"
        $destPath = Join-Path $USB_ROOT $file.path
        $destDir = Split-Path $destPath -Parent

        # Progress
        $pct = [math]::Round($downloadCount * 100 / $toDownload.Count)
        Write-Progress -Activity "Downloading update" -Status "$downloadCount / $($toDownload.Count)" -PercentComplete $pct

        # Ensure directory exists
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        }

        # Download with retry
        $success = $false
        for ($retry = 1; $retry -le 3; $retry++) {
            try {
                Invoke-WebRequest -Uri $fileUrl -OutFile $destPath -UseBasicParsing -TimeoutSec 60
                # Verify SHA256
                $actualHash = (Get-FileHash -Path $destPath -Algorithm SHA256).Hash.ToLower()
                if ($actualHash -eq $file.hash) {
                    $success = $true
                    break
                } else {
                    Write-WARN "Hash mismatch for $($file.path) (attempt $retry)"
                }
            } catch {
                if ($retry -eq 3) {
                    Write-WARN "Failed to download $($file.path) after 3 attempts"
                }
                Start-Sleep 1
            }
        }

        if (-not $success) {
            $failedFiles += $file.path
        }
    }

    Write-Progress -Activity "Downloading update" -Completed

    if ($failedFiles.Count -gt 0) {
        Write-ERROR "Failed to download $($failedFiles.Count) files:"
        foreach ($f in $failedFiles) {
            Write-ERROR "  - $f"
        }
        Write-INFO "Cleaning up incomplete update..."
        Remove-Item $SYSTEM_NEW -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
}

# =========================================================================
# Verify system_new integrity
# =========================================================================
Write-INFO "Verifying downloaded files..."

# Check required files exist
$missingRequired = @()
foreach ($prop in $remote.files.PSObject.Properties) {
    if ($prop.Value.required) {
        $checkPath = Join-Path $USB_ROOT $prop.Name
        if (-not (Test-Path $checkPath)) {
            $missingRequired += $prop.Name
        }
    }
}

if ($missingRequired.Count -gt 0) {
    Write-ERROR "Missing required files after download:"
    foreach ($f in $missingRequired) { Write-ERROR "  - $f" }
    Remove-Item $SYSTEM_NEW -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# =========================================================================
# Write new manifest to system_new
# =========================================================================
$remoteManifestJson.Content | Out-File -FilePath (Join-Path $SYSTEM_NEW "manifest.json") -Encoding UTF8
$remoteVersion | Out-File -FilePath (Join-Path $SYSTEM_NEW "VERSION") -Encoding UTF8 -NoNewline

# =========================================================================
# Handle node_modules: if package.json changed, run npm install
# =========================================================================
$pkgChanged = $toDownload | Where-Object { $_.path -match 'system/core/package\.(json|lock)' }
if ($pkgChanged) {
    Write-INFO "Package files changed - installing npm dependencies..."
    $sysNewCore = Join-Path $SYSTEM_NEW "core"
    $sysNewNodeDir = Join-Path $SYSTEM_NEW "runtime" "node-win-x64"
    $sysNewNpm = Join-Path $sysNewNodeDir "npm.cmd"

    if ((Test-Path $sysNewNpm) -and (Test-Path (Join-Path $sysNewCore "package.json"))) {
        Push-Location $sysNewCore
        try {
            $env:PATH = "$sysNewNodeDir;$env:PATH"
            $npmResult = cmd /c "`"$sysNewNpm`" install --registry=https://registry.npmmirror.com" 2>&1
            if ($LASTEXITCODE -eq 0 -or (Test-Path (Join-Path $sysNewCore "node_modules" "openclaw" "openclaw.mjs"))) {
                Write-OK "Dependencies installed in system_new/"
            } else {
                Write-WARN "npm install may have had issues - will retry on next boot"
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-WARN "Cannot install dependencies in system_new/ - will be done on next boot"
    }
}

Write-Host ""
Write-Host "  ═══════════════════════════════════════" -ForegroundColor Green
Write-OK "Update ready: $currentVersion → $remoteVersion"
Write-INFO "The update will be applied on next restart."
Write-INFO "Your user data - config, memory, skills - will NOT be affected."
Write-Host ""
Write-INFO "Restart now to apply the update, or continue using current version."
Write-Host "  ═══════════════════════════════════════" -ForegroundColor Green
Write-Host ""

exit 0
