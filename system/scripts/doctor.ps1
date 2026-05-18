# doctor.ps1 - AI USB Assistant: Health Diagnostic Tool
# =========================================================================
# Comprehensive health check adapted from preflight-check.ps1
# Enhanced for two-layer architecture: checks both system and user layers.
# =========================================================================

param(
    [string]$UsbRoot
)

$ErrorActionPreference = "SilentlyContinue"

if (-not $UsbRoot) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $SystemDir = Split-Path -Parent $ScriptDir
    $UsbRoot = Split-Path -Parent $SystemDir
} else {
    $SystemDir = Join-Path $UsbRoot "system"
}

$USER_DIR   = Join-Path $UsbRoot "user"
$CACHE_DIR  = Join-Path $UsbRoot "cache"
$DATA_DIR   = Join-Path $UsbRoot "data"
$NODE_DIR   = [IO.Path]::Combine($SystemDir, "runtime", "node-win-x64")
$NODE_EXE   = Join-Path $NODE_DIR "node.exe"
$CORE_DIR   = Join-Path $SystemDir "core"
$CONFIG_FILE = [IO.Path]::Combine($USER_DIR, "config", "openclaw.json")
$MANIFEST_FILE = Join-Path $SystemDir "manifest.json"

$allOk = $true
$warnings = 0
$errors = 0

function Write-OK    { Write-Host "  [OK] $args" -ForegroundColor Green; $script:allOk = $script:allOk -and $true }
function Write-WARN  { Write-Host "  [!]  $args" -ForegroundColor Yellow; $script:warnings++ }
function Write-ERROR { Write-Host "  [X]  $args" -ForegroundColor Red; $script:errors++; $script:allOk = $false }
function Write-TITLE  { Write-Host ""; Write-Host "  $args" -ForegroundColor White; Write-Host "  $( '-' * 50 )" }

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "    AI USB Assistant - Health Check" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan

# =========================================================================
# 1. USB Drive Space
# =========================================================================
Write-TITLE "1. USB Drive Space"
$drive = [System.IO.Path]::GetPathRoot($UsbRoot).TrimEnd('\')
try {
    $driveInfo = Get-PSDrive -Name $drive.TrimEnd(':') -ErrorAction Stop
    $freeMB = [math]::Round($driveInfo.Free / 1MB, 0)
    $totalMB = [math]::Round(($driveInfo.Used + $driveInfo.Free) / 1MB, 0)

    if ($freeMB -lt 100) {
        Write-ERROR "USB space critically low (${freeMB} MB free / ${totalMB} MB total)"
        Write-ERROR "  Minimum 300MB recommended for AI assistant operation"
    } elseif ($freeMB -lt 300) {
        Write-WARN "USB space low (${freeMB} MB free / ${totalMB} MB total)"
        Write-WARN "  Consider cleaning up unused files"
    } else {
        Write-OK "USB space: $freeMB MB free / $totalMB MB total"
    }
} catch {
    Write-ERROR "Could not check disk space"
}

# =========================================================================
# 2. System Layer Integrity
# =========================================================================
Write-TITLE "2. System Layer (system/)"

if (-not (Test-Path $NODE_EXE)) {
    Write-ERROR "Node.js runtime not found: $NODE_EXE"
    Write-ERROR "  Fix: Run system/scripts/setup.ps1"
} else {
    try {
        $nodeVersion = & $NODE_EXE --version 2>&1
        Write-OK "Node.js: $nodeVersion"
    } catch {
        Write-ERROR "Node.js cannot run"
    }
}

if (-not (Test-Path "$CORE_DIR\node_modules\openclaw\openclaw.mjs")) {
    Write-ERROR "OpenClaw core not installed"
    Write-ERROR "  Fix: Run system/scripts/setup.ps1"
} else {
    Write-OK "OpenClaw core: installed"
}

if (Test-Path $MANIFEST_FILE) {
    try {
        $manifest = Get-Content $MANIFEST_FILE -Raw | ConvertFrom-Json
        $fileCount = ($manifest.files.PSObject.Properties | Measure-Object).Count
        $requiredCount = ($manifest.files.PSObject.Properties | Where-Object { $_.Value.required } | Measure-Object).Count

        # Verify required files exist AND hash matches
        $missing = @()
        $corrupted = @()
        $checked = 0
        foreach ($prop in $manifest.files.PSObject.Properties) {
            if ($prop.Value.required) {
                $checkPath = Join-Path $UsbRoot $prop.Name
                if (-not (Test-Path $checkPath)) {
                    $missing += $prop.Name
                } else {
                    $checked++
                    try {
                        $actualHash = (Get-FileHash -Path $checkPath -Algorithm SHA256 -ErrorAction Stop).Hash.ToLower()
                        $expectedHash = $prop.Value.sha256
                        if ($actualHash -ne $expectedHash) {
                            $corrupted += $prop.Name
                        }
                    } catch {
                        $corrupted += "$($prop.Name) (hash read error)"
                    }
                }
            }
        }
        if ($missing.Count -gt 0) {
            Write-ERROR "$($missing.Count) required files missing (out of $requiredCount)"
            Write-ERROR "  Run UPDATE.bat to repair"
        }
        if ($corrupted.Count -gt 0) {
            Write-ERROR "$($corrupted.Count) file(s) corrupted or tampered:"
            foreach ($f in $corrupted) { Write-ERROR "  - $f" }
            Write-ERROR "  Run UPDATE.bat --Force to repair"
        }
        if ($missing.Count -eq 0 -and $corrupted.Count -eq 0) {
            Write-OK "Manifest: $fileCount files ($requiredCount required, $checked verified) - all OK"
        }

        $version = $manifest.version
        Write-OK "System version: $version"
    } catch {
        Write-WARN "Manifest corrupted or unreadable"
        Write-WARN "  Run UPDATE.bat to regenerate"
    }
} else {
    Write-WARN "No manifest.json found - run UPDATE.bat or setup.ps1"
}

# =========================================================================
# 3. User Layer
# =========================================================================
Write-TITLE "3. User Layer (user/)"

if (-not (Test-Path "$USER_DIR\config")) {
    Write-WARN "user/config/ directory missing - will be created on first boot"
} else {
    Write-OK "user/config/ exists"
}

if (Test-Path $CONFIG_FILE) {
    $configSize = (Get-Item $CONFIG_FILE).Length
    if ($configSize -lt 50) {
        Write-WARN "Config file exists but may be incomplete ($configSize bytes)"
        Write-WARN "  Open Config Center (port 18788) to configure"
    } else {
        try {
            $config = Get-Content $CONFIG_FILE -Raw | ConvertFrom-Json
            $providers = if ($config.models) { $config.models.providers } else { $null }
            if ($providers) {
                $providerNames = ($providers.PSObject.Properties | ForEach-Object { $_.Name }) -join ", "
                Write-OK "Config: models configured ($providerNames)"
            } else {
                Write-WARN "Config: no model providers configured"
                Write-WARN "  Open http://127.0.0.1:18788/ to configure"
            }
        } catch {
            Write-WARN "Config file is not valid JSON"
        }
    }
} else {
    Write-WARN "No config file - first run will create default config"
    Write-WARN "  Open http://127.0.0.1:18788/ to configure models"
}

$userSkills = Join-Path $USER_DIR "skills"
if ((Test-Path $userSkills) -and (Get-ChildItem $userSkills -Directory -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0) {
    $count = (Get-ChildItem $userSkills -Directory | Measure-Object).Count
    Write-OK "User skills: $count custom skill(s)"
} else {
    Write-OK "User skills: none (system skills only)"
}

# =========================================================================
# 4. Data Bridge
# =========================================================================
Write-TITLE "4. Data Bridge (data/)"

$bridges = @(
    @{ Link = "$DATA_DIR\.openclaw"; Target = "$USER_DIR\config" },
    @{ Link = "$DATA_DIR\memory";     Target = "$USER_DIR\memory" },
    @{ Link = "$DATA_DIR\workspace";  Target = "$USER_DIR\workspace" }
)

foreach ($bridge in $bridges) {
    if (Test-Path $bridge.Link) {
        Write-OK "Bridge: data/$(Split-Path $bridge.Link -Leaf) -> user/$(Split-Path $bridge.Target -Leaf)"
    } else {
        Write-WARN "Bridge missing: data/$(Split-Path $bridge.Link -Leaf)"
        Write-WARN "  Will be created on next boot, or run: system/scripts/bridge.ps1 -Repair"
    }
}

# =========================================================================
# 5. Backup Status
# =========================================================================
Write-TITLE "5. Backups"

$backupDir = Join-Path $USER_DIR "backups"
if (Test-Path $backupDir) {
    $backupCount = (Get-ChildItem $backupDir -Directory -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($backupCount -gt 0) {
        $latest = Get-ChildItem $backupDir -Directory | Sort-Object Name -Descending | Select-Object -First 1
        Write-OK "Backups: $backupCount snapshot(s), latest: $($latest.Name)"
    } else {
        Write-OK "Backup directory exists (no snapshots yet)"
    }
} else {
    Write-WARN "No backups found - will be created on first proper shutdown"
}

# =========================================================================
# 6. Port Availability
# =========================================================================
Write-TITLE "6. Port Availability"

$portAvailable = $false
for ($port = 18789; $port -le 18799; $port++) {
    $inUse = netstat -ano 2>$null | Select-String ":$port " | Select-String "LISTENING"
    if (-not $inUse) {
        $portAvailable = $true
        Write-OK "Port $port is available"
        break
    }
}
if (-not $portAvailable) {
    Write-ERROR "No ports available in range 18789-18799"
}

# =========================================================================
# 7. Zero-Host-Footprint Check
# =========================================================================
Write-TITLE "7. Zero-Host-Footprint"

# Check if there are traces on C drive
$cTraces = @()
if (Test-Path "$env:USERPROFILE\.openclaw") { $cTraces += "$env:USERPROFILE\.openclaw" }
if (Test-Path "$env:LOCALAPPDATA\openclaw") { $cTraces += "$env:LOCALAPPDATA\openclaw" }

if ($cTraces.Count -gt 0) {
    Write-WARN "Traces found on host machine:"
    foreach ($t in $cTraces) { Write-WARN "  $t" }
    Write-WARN "  These are from previous versions. Safe to delete."
} else {
    Write-OK "No traces on host machine"
}

# =========================================================================
# Summary
# =========================================================================
Write-Host ""
Write-Host "  ========================================" -ForegroundColor White
if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "  ALL OK - System is healthy" -ForegroundColor Green
} elseif ($errors -eq 0) {
    Write-Host "  PASSED with $warnings warning(s)" -ForegroundColor Yellow
    Write-Host "  The assistant should still work, but review warnings above." -ForegroundColor Yellow
} else {
    Write-Host "  FAILED: $errors error(s), $warnings warning(s)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Quick fixes:" -ForegroundColor Yellow
    Write-Host "    1. Run UPDATE.bat to repair system files" -ForegroundColor White
    Write-Host "    2. Run system/scripts/setup.ps1 to reinstall" -ForegroundColor White
    Write-Host "    3. Run system/scripts/reset-system.ps1 to reset system layer" -ForegroundColor White
}
Write-Host "  ========================================" -ForegroundColor White
Write-Host ""

if ($errors -gt 0) { exit 1 } else { exit 0 }

