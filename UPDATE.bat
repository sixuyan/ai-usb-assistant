@echo off
REM =================================================
REM AI USB Assistant - Update Tool
REM Check for updates and install incrementally.
REM User data is never affected by updates.
REM =================================================
cd /d "%~dp0"
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0system\scripts\update.ps1" %*
pause
