# setup.ps1 - AI USB Assistant: Download Dependencies (Windows)
# =========================================================================
# Downloads Node.js runtime and installs OpenClaw core.
# All downloads use npmmirror.com (China mirror) for speed.
# Run this ONCE after copying to USB, or after "reset system".
# =========================================================================

param(
    [string]$NodeVersion = "v22.12.0",
    [string]$Registry = "https://registry.npmmirror.com",
    [switch]$SkipNodeDownload,     # Skip Node.js if already present
    [switch]$Force                 # Force re-download even if exists
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = Split-Path -Parent $ScriptDir
$USB_ROOT = Split-Path -Parent $SystemDir

$NODE_ARCH = "win-x64"
$NODE_DIR = [IO.Path]::Combine($SystemDir, "runtime", "node-$NODE_ARCH")
$CORE_DIR = Join-Path $SystemDir "core"
$SKILLS_DIR = Join-Path $SystemDir "skills"

$NODE_MIRROR = "https://npmmirror.com/mirrors/node"

# Colors
function Write-OK    { Write-Host "  [OK] $args" -ForegroundColor Green }
function Write-INFO  { Write-Host "  [i]  $args" -ForegroundColor Cyan }
function Write-WARN  { Write-Host "  [!]  $args" -ForegroundColor Yellow }
function Write-ERROR { Write-Host "  [X]  $args" -ForegroundColor Red }

Write-Host ""
Write-Host "  鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽" -ForegroundColor Cyan
Write-Host "  鈺?  AI USB Assistant - Setup           鈺? -ForegroundColor Cyan
Write-Host "  鈺?  Downloading dependencies...        鈺? -ForegroundColor Cyan
Write-Host "  鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆" -ForegroundColor Cyan
Write-Host ""

# =========================================================================
# Step 1: Download Node.js Runtime
# =========================================================================
Write-INFO "Step 1/4: Node.js Runtime"

$nodeZip = "node-$NodeVersion-$NODE_ARCH.zip"
$nodeUrl = "$NODE_MIRROR/$NodeVersion/$nodeZip"
$nodeZipPath = Join-Path $SystemDir $nodeZip

if (Test-Path (Join-Path $NODE_DIR "node.exe")) {
    if ($Force) {
        Write-INFO "Removing existing Node.js for fresh install..."
        Remove-Item $NODE_DIR -Recurse -Force -ErrorAction SilentlyContinue
    } elseif ($SkipNodeDownload) {
        Write-OK "Node.js already present - skipping"
    } else {
        Write-OK "Node.js already present - use -Force to reinstall"
    }
}

if (-not (Test-Path (Join-Path $NODE_DIR "node.exe"))) {
    Write-INFO "Downloading Node.js $NodeVersion ($NODE_ARCH)..."
    Write-INFO "Source: $nodeUrl"

    try {
        # Download
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
        $ProgressPreference = 'SilentlyContinue'  # Speed up large downloads
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZipPath -UseBasicParsing

        # Extract
        Write-INFO "Extracting Node.js..."
        Expand-Archive -Path $nodeZipPath -DestinationPath $SystemDir -Force

        # Node.js zip extracts to a folder named "node-v{version}-win-x64"
        $extractedDir = Join-Path $SystemDir "node-$NodeVersion-$NODE_ARCH"

        # Some mirrors may extract directly without a parent folder.
        # In that case, node.exe would be at $SystemDir/node.exe.
        $flatNodeExe = Join-Path $SystemDir "node.exe"

        if (Test-Path $flatNodeExe) {
            # Flat extraction: files are directly in system/, move them
            Write-INFO "Detected flat extraction - reorganizing..."
            $runtimeDir = Join-Path $SystemDir "runtime"
            if (-not (Test-Path $runtimeDir)) {
                New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
            }
            if (Test-Path $NODE_DIR) { Remove-Item $NODE_DIR -Recurse -Force }
            New-Item -ItemType Directory -Force -Path $NODE_DIR | Out-Null
            # Move all extracted files to runtime/node-win-x64/
            Get-ChildItem $SystemDir -File | Move-Item -Destination $NODE_DIR -Force
            Get-ChildItem $SystemDir -Directory | Where-Object { $_.Name -ne "runtime" -and $_.Name -ne "scripts" -and $_.Name -ne "config-center" -and $_.Name -ne "skills" -and $_.Name -ne "core" -and $_.Name -ne "node-$NODE_ARCH" } | Move-Item -Destination $NODE_DIR -Force
        } elseif (Test-Path $extractedDir) {
            # Standard extraction: folder exists, move to runtime/
            Write-INFO "Moving Node.js to runtime/..."
            $runtimeDir = Join-Path $SystemDir "runtime"
            if (-not (Test-Path $runtimeDir)) {
                New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
            }
            if (Test-Path $NODE_DIR) { Remove-Item $NODE_DIR -Recurse -Force }
            Move-Item $extractedDir $NODE_DIR -Force
        } elseif (Test-Path (Join-Path $SystemDir "node-$NODE_ARCH")) {
            # Already at system/node-win-x64 (from previous partial run), move to runtime/
            Write-INFO "Found Node.js at system/node-$NODE_ARCH - moving to runtime/..."
            $runtimeDir = Join-Path $SystemDir "runtime"
            if (-not (Test-Path $runtimeDir)) {
                New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
            }
            if (Test-Path $NODE_DIR) { Remove-Item $NODE_DIR -Recurse -Force }
            Move-Item (Join-Path $SystemDir "node-$NODE_ARCH") $NODE_DIR -Force
        }

        # Verify
        $nodeExe = Join-Path $NODE_DIR "node.exe"
        if (Test-Path $nodeExe) {
            $ver = & $nodeExe --version 2>&1
            Write-OK "Node.js $ver installed successfully"
        } else {
            Write-ERROR "Node.js extraction failed - node.exe not found"
            Write-INFO "You may need to manually extract: $nodeZipPath"
            exit 1
        }
    } catch {
        Write-ERROR "Failed to download/extract Node.js: $_"
        Write-INFO "Manual download: $nodeUrl"
        Write-INFO "Extract to: $NODE_DIR"
        exit 1
    } finally {
        # Clean up zip
        if (Test-Path $nodeZipPath) {
            Remove-Item $nodeZipPath -Force -ErrorAction SilentlyContinue
        }
    }
}

# =========================================================================
# Step 2: Setup OpenClaw Core
# =========================================================================
Write-INFO "Step 2/4: OpenClaw Core"

$packageJson = Join-Path $CORE_DIR "package.json"

# Create core directory
if (-not (Test-Path $CORE_DIR)) {
    New-Item -ItemType Directory -Force -Path $CORE_DIR | Out-Null
}

# Create package.json if not exists
if (-not (Test-Path $packageJson)) {
    $pkg = @{
        name = "ai-usb-core"
        version = "1.0.0"
        private = $true
        description = "AI USB Assistant - OpenClaw Core"
        dependencies = @{
            openclaw = "latest"
        }
    }
    $pkg | ConvertTo-Json -Depth 5 | Out-File -FilePath $packageJson -Encoding UTF8
    Write-OK "package.json created"
}

# Install dependencies
$nodeExe = Join-Path $NODE_DIR "node.exe"
$npmCmd  = Join-Path $NODE_DIR "npm.cmd"

Write-INFO "Installing OpenClaw (this may take a few minutes)..."
Write-INFO "Registry: $Registry"

Push-Location $CORE_DIR
try {
    $env:PATH = "$NODE_DIR;$env:PATH"
    # Use cmd /c to prevent PowerShell from treating npm warnings as fatal errors
    $npmOutput = cmd /c "`"$npmCmd`" install --registry=$Registry" 2>&1
    # Only show npm output if there were actual errors
    if ($npmOutput -match "ERR!") {
        Write-Host "    $npmOutput"
    }

    if (Test-Path ([IO.Path]::Combine($CORE_DIR, "node_modules", "openclaw", "openclaw.mjs"))) {
        Write-OK "OpenClaw installed successfully"
        if ($LASTEXITCODE -ne 0) {
            Write-WARN "npm exited with code $LASTEXITCODE (warnings only, install OK)"
        }
    } else {
        Write-ERROR "OpenClaw installation failed - openclaw.mjs not found"
        Write-ERROR "npm output: $npmOutput"
        exit 1
    }
} catch {
    Write-ERROR "npm install failed: $_"
    Write-INFO "You can retry by running this script again."
    exit 1
} finally {
    Pop-Location
}

# =========================================================================
# Step 3: Setup Skills (from U-Claw skills-cn)
# =========================================================================
Write-INFO "Step 3/4: Skills"

if (-not (Test-Path $SKILLS_DIR)) {
    New-Item -ItemType Directory -Force -Path $SKILLS_DIR | Out-Null
}

# Check if U-Claw portable/skills-cn exists nearby
$uclawSkills = Join-Path (Split-Path $USB_ROOT -Parent) "uclaw" "u-claw" "portable" "skills-cn"
if (Test-Path $uclawSkills) {
    Write-INFO "Found U-Claw skills at: $uclawSkills"
    Copy-Item "$uclawSkills\*" "$SKILLS_DIR\" -Recurse -Force
    $count = (Get-ChildItem $SKILLS_DIR -Directory | Measure-Object).Count
    Write-OK "Copied $count skills from U-Claw"
} else {
    Write-WARN "U-Claw skills-cn not found nearby"
    Write-INFO "Creating placeholder skill directory"

    # Create a sample skill so the directory isn't empty
    $sampleSkill = Join-Path $SKILLS_DIR "system-info"
    New-Item -ItemType Directory -Force -Path $sampleSkill | Out-Null
    @"
---
name: system-info
description: Display system and version information for the AI USB Assistant
---
# System Info

This skill provides information about the AI USB Assistant system status, version, and configuration.

## Usage

Ask the assistant: "What version am I running?" or "Show system status"
"@ | Out-File -FilePath (Join-Path $sampleSkill "SKILL.md") -Encoding UTF8
    Write-OK "Created sample skill"
}

# =========================================================================
# Step 4: Generate Manifest
# =========================================================================
Write-INFO "Step 4/4: Generating manifest..."

$manifestScript = Join-Path $ScriptDir "generate-manifest.ps1"
if (Test-Path $manifestScript) {
    & $manifestScript
    Write-OK "Manifest generated"
} else {
    Write-WARN "generate-manifest.ps1 not found - manifest will be generated on first boot"
}

# =========================================================================
# Done
# =========================================================================
Write-Host ""
Write-Host "  鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺? -ForegroundColor Green
Write-Host "   Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "   To start the AI Assistant:" -ForegroundColor Cyan
Write-Host "     Double-click START.bat" -ForegroundColor White
Write-Host ""
Write-Host "   USB Root: $USB_ROOT" -ForegroundColor DarkGray
Write-Host "  鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺? -ForegroundColor Green
Write-Host ""

# Return version info
if (Test-Path (Join-Path $SystemDir "VERSION")) {
    $ver = Get-Content (Join-Path $SystemDir "VERSION") -Raw
    Write-INFO "System Version: $ver"
}

