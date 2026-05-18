# generate-manifest.ps1 - Generate Version Manifest for AI USB Assistant
# =========================================================================
# Scans system/ directory, computes SHA256 for each file,
# and produces manifest.json with version metadata.
#
# Usage:
#   .\generate-manifest.ps1                        # Write to system/manifest.json
#   .\generate-manifest.ps1 -Channel beta          # Beta channel
#   .\generate-manifest.ps1 -OutputFile releases/stable/manifest.json
#   .\generate-manifest.ps1 -Upload               # Generate + stage for OSS upload
#
# Used by: setup.ps1 (after install), release.ps1 (before OSS publish)
# =========================================================================

param(
    [string]$UsbRoot,
    [string]$OutputFile,              # Where to write manifest.json
    [string]$Channel = "stable",      # Release channel
    [string]$ReleaseNotes = "",       # Optional release notes
    [switch]$Pretty,                  # Human-readable JSON output
    [switch]$Upload,                  # Stage for OSS upload (creates releases/ dir)
    [switch]$Quiet                    # Minimal output (for CI/CD)
)

$ErrorActionPreference = "Stop"

# Path resolution
if (-not $UsbRoot) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $SystemDir = Split-Path -Parent $ScriptDir
    $UsbRoot = Split-Path -Parent $SystemDir
} else {
    $SystemDir = Join-Path $UsbRoot "system"
}

if (-not $OutputFile) {
    if ($Upload) {
        $releasesDir = [IO.Path]::Combine($UsbRoot, "releases", $Channel)
        if (-not (Test-Path $releasesDir)) {
            New-Item -ItemType Directory -Force -Path $releasesDir | Out-Null
        }
        $OutputFile = Join-Path $releasesDir "manifest.json"
    } else {
        $OutputFile = Join-Path $SystemDir "manifest.json"
    }
}

$VersionFile = Join-Path $SystemDir "VERSION"
$ReleaseDir = Split-Path $OutputFile -Parent

# Output helpers
function Write-OK    { if (-not $Quiet) { Write-Host "  [OK] $args" -ForegroundColor Green } }
function Write-INFO  { if (-not $Quiet) { Write-Host "  [i]  $args" -ForegroundColor Cyan } }
function Write-WARN  { Write-Host "  [!]  $args" -ForegroundColor Yellow }
function Write-ERROR { Write-Host "  [X]  $args" -ForegroundColor Red }

if (-not $Quiet) {
    Write-Host ""
    Write-INFO "AI USB Assistant - Manifest Generator"
    Write-INFO "Channel: $Channel"
}

# Read version
$version = "0.0.0"
if (Test-Path $VersionFile) {
    $version = (Get-Content $VersionFile -Raw).Trim()
}
Write-INFO "Version: $version"

# Verify system/ exists
$systemPath = Join-Path $UsbRoot "system"
if (-not (Test-Path $systemPath)) {
    Write-ERROR "system/ directory not found at: $systemPath"
    exit 1
}

# =========================================================================
# Scan system/ directory and compute file hashes
# =========================================================================
Write-INFO "Scanning system/ files..."

$files = [ordered]@{}
$excludePatterns = @(
    "system/manifest.json$",   # Don't self-reference
    "system/.+\.zip$",         # Downloaded archives
    "system/.+\.tmp$",         # Temp files
    "node_modules/",           # npm dependencies (installed by setup/update)
    "\.git/"                   # Git metadata
)

$allFiles = Get-ChildItem -Path $systemPath -Recurse -File -ErrorAction SilentlyContinue
$totalCount = $allFiles.Count
$processed = 0
$totalSize = 0

foreach ($file in $allFiles) {
    $processed++
    if (-not $Quiet -and $processed % 100 -eq 0) {
        Write-Progress -Activity "Computing SHA256" `
            -Status "$processed / $totalCount" `
            -PercentComplete ($processed * 100 / $totalCount)
    }

    # Compute relative path with forward slashes (cross-platform)
    $relPath = $file.FullName.Substring($UsbRoot.Length).TrimStart('\').Replace('\', '/')
    # In upload mode, manifest key gets "files/" prefix but source path stays clean
    $manifestKey = if ($Upload) { "files/$relPath" } else { $relPath }

    # Skip excluded patterns
    $skip = $false
    foreach ($pattern in $excludePatterns) {
        if ($relPath -match $pattern) { $skip = $true; break }
    }
    if ($skip) { continue }

    try {
        $hash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash.ToLower()
        $size = $file.Length
        $totalSize += $size

        # Skills are non-required; everything else is required
        $required = $true
        if ($relPath -match "^system/skills/") {
            $required = $false
        }

        $files[$manifestKey] = @{
            sha256   = $hash
            size     = $size
            required = $required
        }
    } catch {
        Write-WARN "Could not hash: $relPath - $_"
    }
}

if (-not $Quiet) {
    Write-Progress -Activity "Computing SHA256" -Completed
}

# =========================================================================
# Build manifest JSON
# =========================================================================

$manifest = [ordered]@{
    product             = "ai-usb-assistant"
    version             = $version
    channel             = $Channel
    minUserLayerVersion = 1
    compatibility       = [ordered]@{
        openclaw = ">=2026.3.0"
        node     = ">=22.12.0"
    }
    summary             = [ordered]@{
        totalFiles    = $files.Count
        requiredFiles = ($files.Values | Where-Object { $_.required } | Measure-Object).Count
        totalSize     = $totalSize
        totalSizeMB   = [math]::Round($totalSize / 1MB, 2)
    }
    files               = $files
    removedFiles        = @()
    releaseNotes        = if ($ReleaseNotes) { $ReleaseNotes } else { "Release $version ($Channel channel)" }
    publishedAt         = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    updateType          = "incremental"
}

# =========================================================================
# Write manifest
# =========================================================================

# Ensure output directory
$outDir = Split-Path $OutputFile -Parent
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

# Write JSON (compact for server, pretty for --pretty or --upload)
$usePretty = $Pretty -or $Upload
if ($usePretty) {
    $manifest | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputFile -Encoding UTF8
} else {
    $manifest | ConvertTo-Json -Depth 10 -Compress | Out-File -FilePath $OutputFile -Encoding UTF8
}

# =========================================================================
# Upload mode: also copy all system/ files to releases/<channel>/files/
# =========================================================================
if ($Upload) {
    Write-INFO "Staging files for OSS upload..."
    $uploadBase = Join-Path $ReleaseDir "files"

    # Clean previous staging
    if (Test-Path $uploadBase) {
        Remove-Item $uploadBase -Recurse -Force -ErrorAction SilentlyContinue
    }

    foreach ($manifestKey in $files.Keys) {
        # manifestKey = "files/system/...", source path = "system/..."
        $srcRelPath = $manifestKey -replace '^files/', ''
        $srcFile = Join-Path $UsbRoot $srcRelPath
        $dstFile = Join-Path $uploadBase $manifestKey
        $dstDir = Split-Path $dstFile -Parent

        if (-not (Test-Path $dstDir)) {
            New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
        }
        Copy-Item $srcFile $dstFile -Force
    }
    Write-OK "Files staged to: $uploadBase"
}

# =========================================================================
# Summary
# =========================================================================

$fileCount = $files.Count
$totalSizeMB = [math]::Round($totalSize / 1MB, 2)
$requiredCount = ($files.Values | Where-Object { $_.required } | Measure-Object).Count

if (-not $Quiet) {
    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor Green
    Write-OK "Manifest generated: $OutputFile"
    Write-INFO "  Total files:  $fileCount ($requiredCount required)"
    Write-INFO "  Total size:   $totalSizeMB MB"
    Write-INFO "  Version:      $version"
    Write-INFO "  Channel:      $Channel"
    if ($Upload) {
        Write-INFO "  Upload ready: $ReleaseDir"
    }
    Write-Host "  ========================================" -ForegroundColor Green
    Write-Host ""
}

exit 0
