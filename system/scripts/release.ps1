# release.ps1 - AI USB Assistant: One-Click Release Publisher
# =========================================================================
# Workflow:
#   1. Run generate-manifest.ps1 to create manifest + stage files
#   2. Upload manifest + all system/ files to Alibaba Cloud OSS
#   3. Optionally refresh CDN cache
#
# Prerequisites:
#   - Alibaba Cloud OSS bucket "ai-usb-updates" (see OSS_SETUP.md)
#   - Environment variables: OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET
#   - OR: ossutil CLI installed and configured
#
# Usage:
#   .\release.ps1                           # Release to stable channel
#   .\release.ps1 -Channel beta             # Release to beta channel
#   .\release.ps1 -DryRun                   # Preview without uploading
#   .\release.ps1 -SkipUpload               # Only generate manifest, no OSS
# =========================================================================

param(
    [string]$Channel = "stable",         # Release channel
    [string]$ReleaseNotes = "",          # Release notes
    [string]$OssBucket = "ai-usb-updates",
    [string]$OssEndpoint = "oss-cn-hangzhou.aliyuncs.com",
    [switch]$DryRun,                     # Preview only, don't upload
    [switch]$SkipUpload,                 # Generate manifest only
    [switch]$Force,                      # Skip confirmation prompt
    [switch]$RefreshCdn                  # Refresh CDN cache after upload
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = Split-Path -Parent $ScriptDir
$USB_ROOT = Split-Path -Parent $SystemDir

$MANIFEST_SCRIPT = Join-Path $ScriptDir "generate-manifest.ps1"
$VERSION_FILE = Join-Path $SystemDir "VERSION"

# OSS paths
$OSS_BASE = "https://${OssBucket}.${OssEndpoint}"
$OSS_RELEASES = "releases"

function Write-OK    { Write-Host "  [OK] $args" -ForegroundColor Green }
function Write-INFO  { Write-Host "  [i]  $args" -ForegroundColor Cyan }
function Write-WARN  { Write-Host "  [!]  $args" -ForegroundColor Yellow }
function Write-ERROR { Write-Host "  [X]  $args" -ForegroundColor Red }
function Write-STEP  { Write-Host ""; Write-Host "  >>> $args" -ForegroundColor Cyan }

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "    AI USB Assistant - Release Publisher" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# Read current version
$version = "0.0.0"
if (Test-Path $VERSION_FILE) {
    $version = (Get-Content $VERSION_FILE -Raw).Trim()
}
Write-INFO "Publishing version: $version"
Write-INFO "Channel:            $Channel"
Write-INFO "OSS Bucket:         $OssBucket"
Write-INFO "OSS Endpoint:       $OssEndpoint"
Write-Host ""

# =========================================================================
# Step 1: Generate manifest + stage files
# =========================================================================
Write-STEP "Step 1/4: Generating manifest..."

$releaseDir = [IO.Path]::Combine($USB_ROOT, "releases", $Channel)

& $MANIFEST_SCRIPT -UsbRoot $USB_ROOT -Channel $Channel `
    -ReleaseNotes $ReleaseNotes -Upload -Quiet

if ($LASTEXITCODE -ne 0) {
    Write-ERROR "Manifest generation failed"
    exit 1
}

$manifestFile = Join-Path $releaseDir "manifest.json"
$filesDir = Join-Path $releaseDir "files"

if (-not (Test-Path $manifestFile)) {
    Write-ERROR "Manifest not found: $manifestFile"
    exit 1
}

$manifest = Get-Content $manifestFile -Raw | ConvertFrom-Json
$fileCount = $manifest.summary.totalFiles
$totalSize = $manifest.summary.totalSizeMB
Write-OK "Manifest: $fileCount files, $totalSize MB ready"

# =========================================================================
# Step 2: Verify staging
# =========================================================================
Write-STEP "Step 2/4: Verifying staged files..."

$stagedFiles = Get-ChildItem $filesDir -Recurse -File -ErrorAction SilentlyContinue
$stagedCount = $stagedFiles.Count
if ($stagedCount -eq 0) {
    Write-ERROR "No files staged for upload"
    exit 1
}
Write-OK "$stagedCount files staged for upload"

if ($DryRun -or $SkipUpload) {
    Write-Host ""
    Write-INFO "DRY RUN / SKIP UPLOAD - No files will be uploaded."
    Write-INFO "Staged files at: $filesDir"
    Write-INFO "Manifest at:     $manifestFile"
    Write-Host ""
    Write-INFO "To upload, run without -DryRun or -SkipUpload."
    Write-INFO "Final update URL will be:"
    Write-INFO "  $OSS_BASE/$OSS_RELEASES/$Channel/manifest.json"
    exit 0
}

# =========================================================================
# Step 3: Upload to OSS
# =========================================================================
Write-STEP "Step 3/4: Uploading to Alibaba Cloud OSS..."

# Check for credentials
$accessKey = $env:OSS_ACCESS_KEY_ID
$accessSecret = $env:OSS_ACCESS_KEY_SECRET

# Check if ossutil is available
$ossutil = Get-Command ossutil -ErrorAction SilentlyContinue

if ($ossutil) {
    # --- ossutil path (preferred) ---
    Write-INFO "Using ossutil CLI..."

    # Check ossutil config
    $ossConfigCheck = & ossutil ls "oss://$OssBucket" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-WARN "ossutil not configured for bucket $OssBucket"
        Write-INFO "Run: ossutil config"
        Write-INFO "  endpoint: $OssEndpoint"
        Write-INFO "  accessKeyID: <your-key>"
        Write-INFO "  accessKeySecret: <your-secret>"
        exit 1
    }

    # Upload manifest
    $ossManifestPath = "oss://${OssBucket}/${OSS_RELEASES}/${Channel}/manifest.json"
    Write-INFO "Uploading manifest..."
    & ossutil cp $manifestFile $ossManifestPath -f 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Manifest uploaded"
    } else {
        Write-ERROR "Manifest upload failed"
        exit 1
    }

    # Upload all files
    $ossFilesPath = "oss://${OssBucket}/${OSS_RELEASES}/${Channel}/files/"
    Write-INFO "Uploading $stagedCount files..."
    $uploadResult = & ossutil cp $filesDir $ossFilesPath -r -f -u 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Files uploaded successfully"
    } else {
        Write-ERROR "File upload had errors. Check ossutil output."
        Write-Host $uploadResult
        exit 1
    }

} elseif ($accessKey -and $accessSecret) {
    # --- Direct REST API path (fallback) ---
    Write-INFO "Using REST API (no ossutil found)..."
    Write-WARN "REST API upload is slower. Install ossutil for better performance."
    Write-WARN "Download: https://www.alibabacloud.com/help/en/oss/developer-reference/install-ossutil"

    # TODO: Implement OSS REST API upload
    # This requires HMAC-SHA1 signing of each request.
    # For now, require ossutil.
    Write-ERROR "Direct REST API upload not yet implemented."
    Write-INFO "Please install ossutil: https://www.alibabacloud.com/help/en/oss/developer-reference/install-ossutil"
    Write-INFO "Or set OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET for REST API mode."
    exit 1

} else {
    Write-ERROR "No OSS credentials found."
    Write-INFO "Set environment variables:"
    Write-INFO "  `$env:OSS_ACCESS_KEY_ID = 'your-access-key'"
    Write-INFO "  `$env:OSS_ACCESS_KEY_SECRET = 'your-access-secret'"
    Write-INFO ""
    Write-INFO "Or install and configure ossutil:"
    Write-INFO "  https://www.alibabacloud.com/help/en/oss/developer-reference/install-ossutil"
    exit 1
}

# =========================================================================
# Step 4: CDN refresh (optional)
# =========================================================================
if ($RefreshCdn) {
    Write-STEP "Step 4/4: Refreshing CDN cache..."

    # TODO: CDN refresh requires Alibaba Cloud CDN API
    # This is a placeholder for the actual implementation.
    # Use aliyun CLI: aliyun cdn RefreshObjectCaches --ObjectPath <url>
    Write-WARN "CDN refresh not yet automated."
    Write-INFO "Manually refresh in OSS console:"
    Write-INFO "  https://oss.console.aliyun.com/bucket/oss-cn-hangzhou/$OssBucket"
    Write-INFO "  Navigate to: CDN Acceleration > Refresh"
    Write-INFO "  URL: $OSS_BASE/$OSS_RELEASES/$Channel/manifest.json"
}

# =========================================================================
# Done
# =========================================================================
$updateUrl = "$OSS_BASE/$OSS_RELEASES/$Channel/manifest.json"

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Green
Write-OK "Release published: v$version ($Channel)"
Write-INFO "Update URL: $updateUrl"
Write-INFO "Users can now run UPDATE.bat to get this update."
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""

# Clean up staging (files are on OSS now)
if (-not $DryRun) {
    Write-INFO "Cleaning up local staging..."
    Remove-Item $releaseDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-OK "Local staging cleaned"
}

exit 0
