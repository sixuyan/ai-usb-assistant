# backup.ps1 - Smart Backup (adapted from 龙虾全包 save-backup.ps1)
# =========================================================================
# Backs up user data with timestamp, keeping only changed files.
# Rotation policy: keep 7 daily + 4 weekly + 6 monthly snapshots.
# =========================================================================

param(
    [string]$UsbRoot,
    [switch]$DryRun           # Preview which backups would be deleted (no actual deletion)
)

$ErrorActionPreference = "Stop"

if (-not $UsbRoot) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $SystemDir = Split-Path -Parent $ScriptDir
    $UsbRoot = Split-Path -Parent $SystemDir
}

$USER_DIR = Join-Path $UsbRoot "user"
$BACKUP_DIR = Join-Path $USER_DIR "backups"

function Write-OK    { Write-Host "  [OK] $args" -ForegroundColor Green }
function Write-INFO  { Write-Host "  [i]  $args" -ForegroundColor Cyan }
function Write-WARN  { Write-Host "  [!]  $args" -ForegroundColor Yellow }
function Write-DRYRUN { Write-Host "  [dry-run] $args" -ForegroundColor Magenta }

# =========================================================================
# Retention Policy: Clean old backups
# =========================================================================
function Invoke-BackupRetention {
    param(
        [string]$BackupDir,
        [int]$KeepDaily = 7,
        [int]$KeepWeekly = 4,
        [int]$KeepMonthly = 6,
        [switch]$DryRun
    )

    if (-not (Test-Path $BackupDir)) { return }

    $allSnapshots = Get-ChildItem $BackupDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$' } |
        Sort-Object Name -Descending

    if ($allSnapshots.Count -le $KeepDaily) {
        Write-INFO "Backups: $($allSnapshots.Count) snapshot(s) - within daily limit, no cleanup needed"
        return
    }

    Write-INFO "Retention policy: $KeepDaily daily + $KeepWeekly weekly + $KeepMonthly monthly"

    $toKeep = @{}
    $now = Get-Date

    # Parse snapshot dates
    $snapshotDates = @{}
    foreach ($snap in $allSnapshots) {
        try {
            $dateStr = $snap.Name.Substring(0, 16) -replace '_', ' '
            $dateStr = $dateStr -replace '-', '/' , 2  # yyyy/MM/dd HH-mm
            $dateStr = $dateStr.Substring(0, 13) + ':' + $dateStr.Substring(14, 2)  # HH:mm
            $dt = [datetime]::ParseExact($dateStr, 'yyyy/MM/dd HH:mm', $null)
            $snapshotDates[$snap.Name] = $dt
        } catch {
            Write-WARN "Could not parse date for: $($snap.Name) - will keep"
            $toKeep[$snap.Name] = $true
        }
    }

    # Sort by date (newest first)
    $sorted = $allSnapshots | Where-Object { $snapshotDates.ContainsKey($_.Name) } |
        Sort-Object { $snapshotDates[$_.Name] } -Descending

    # Phase 1: Keep last KEEP_DAILY days
    $dailyCutoff = $now.AddDays(-$KeepDaily)
    $dailyCount = 0
    foreach ($snap in $sorted) {
        $dt = $snapshotDates[$snap.Name]
        if ($dt -ge $dailyCutoff -and $dailyCount -lt $KeepDaily) {
            $toKeep[$snap.Name] = $true
            $dailyCount++
        }
    }

    # Phase 2: Keep up to KEEP_WEEKLY (one per ISO week, outside daily range)
    $weeks = @{}
    $weeklyCount = 0
    foreach ($snap in $sorted) {
        if ($toKeep.ContainsKey($snap.Name)) { continue }
        if ($weeklyCount -ge $KeepWeekly) { break }
        $dt = $snapshotDates[$snap.Name]
        # Get ISO week (year + week number)
        $week = Get-Date $dt -UFormat '%V'
        $year = Get-Date $dt -UFormat '%G'
        $weekKey = "$year-W$week"
        if (-not $weeks.ContainsKey($weekKey)) {
            $weeks[$weekKey] = $true
            $toKeep[$snap.Name] = $true
            $weeklyCount++
        }
    }

    # Phase 3: Keep up to KEEP_MONTHLY (one per month, outside daily+weekly)
    $months = @{}
    $monthlyCount = 0
    foreach ($snap in $sorted) {
        if ($toKeep.ContainsKey($snap.Name)) { continue }
        if ($monthlyCount -ge $KeepMonthly) { break }
        $dt = $snapshotDates[$snap.Name]
        $monthKey = Get-Date $dt -Format 'yyyy-MM'
        if (-not $months.ContainsKey($monthKey)) {
            $months[$monthKey] = $true
            $toKeep[$snap.Name] = $true
            $monthlyCount++
        }
    }

    # Find snapshots to delete
    $toDelete = $allSnapshots | Where-Object { -not $toKeep.ContainsKey($_.Name) }

    if ($toDelete.Count -eq 0) {
        Write-INFO "No backups to clean ($($toKeep.Count) kept)"
        return
    }

    if ($DryRun) {
        Write-DRYRUN "Would delete $($toDelete.Count) old backup(s):"
        foreach ($snap in $toDelete) {
            $dt = if ($snapshotDates.ContainsKey($snap.Name)) { $snapshotDates[$snap.Name].ToString('yyyy-MM-dd') } else { 'unknown date' }
            Write-DRYRUN "  - $($snap.Name) ($dt)"
        }
        Write-DRYRUN "Would keep $($toKeep.Count) backup(s)"
    } else {
        foreach ($snap in $toDelete) {
            Remove-Item $snap.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
        Write-OK "Cleaned $($toDelete.Count) old backup(s), $($toKeep.Count) kept"
    }
}

# =========================================================================
# Main Backup Logic
# =========================================================================

if ($DryRun) {
    Write-INFO "Dry-run mode: previewing backup cleanup..."
    Invoke-BackupRetention -BackupDir $BACKUP_DIR -DryRun
    exit 0
}

Write-INFO "Starting smart backup..."

if (-not (Test-Path $USER_DIR)) {
    Write-WARN "No user data to backup"
    exit 0
}

# Timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$snapshotDir = Join-Path $BACKUP_DIR $timestamp
New-Item -ItemType Directory -Force -Path $snapshotDir | Out-Null

# Directories to backup (these contain "smart" data)
$backupDirs = @("config", "memory", "identity", "workspace", "devices", "skills", "logs")

$totalCopied = 0
foreach ($dir in $backupDirs) {
    $srcDir = Join-Path $USER_DIR $dir
    if (-not (Test-Path $srcDir)) { continue }

    $dstDir = Join-Path $snapshotDir $dir
    New-Item -ItemType Directory -Force -Path $dstDir | Out-Null

    Get-ChildItem -Path $srcDir -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
        $relPath = $_.FullName.Substring($srcDir.Length).TrimStart('\')
        $dstFile = Join-Path $dstDir $relPath
        $dstParent = Split-Path $dstFile -Parent
        if (-not (Test-Path $dstParent)) {
            New-Item -ItemType Directory -Force -Path $dstParent | Out-Null
        }

        # Only copy if source is newer
        $shouldCopy = $true
        if (Test-Path $dstFile) {
            $shouldCopy = $_.LastWriteTime -gt (Get-Item $dstFile).LastWriteTime
        }

        if ($shouldCopy) {
            Copy-Item $_.FullName $dstFile -Force
            $totalCopied++
        }
    }
}

# Calculate size
$backupSize = Get-ChildItem $snapshotDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum
$sizeMB = [math]::Round($backupSize.Sum / 1MB, 2)

Write-OK "Backup saved: $timestamp ($totalCopied files, $sizeMB MB)"

# Apply retention policy
Invoke-BackupRetention -BackupDir $BACKUP_DIR

Write-OK "Backup complete"
exit 0
