@echo off
REM =================================================
REM AI USB Assistant - Windows Launcher
REM Double-click this file to start the AI assistant.
REM All data stays on your USB drive.
REM =================================================
cd /d "%~dp0"
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0system\scripts\boot.ps1"
pause
