@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title AI USB Assistant - Menu

set "USB_ROOT=%~dp0"
set "MENU_LOOP=1"

:menu
cls
echo.
echo   ========================================
echo     AI USB Assistant - Menu
echo   ========================================
echo.
echo    1. Start AI Assistant
echo    2. Configure Model / API
echo    3. Check for Updates
echo    4. Manage Skills
echo    5. Backup User Data
echo    6. Restore User Data
echo    7. System Diagnostic
echo    8. Reset System Layer (Keep Data)
echo    9. View Logs
echo    0. Exit
echo.
echo   ========================================
set /p "CHOICE=  Please select [0-9]: "

if "%CHOICE%"=="1" goto :start
if "%CHOICE%"=="2" goto :config
if "%CHOICE%"=="3" goto :update
if "%CHOICE%"=="4" goto :skills
if "%CHOICE%"=="5" goto :backup
if "%CHOICE%"=="6" goto :restore
if "%CHOICE%"=="7" goto :doctor
if "%CHOICE%"=="8" goto :reset
if "%CHOICE%"=="9" goto :logs
if "%CHOICE%"=="0" goto :exit
echo   Invalid choice. Press any key...
pause >nul
goto :menu

:start
echo.
echo   Starting AI Assistant...
echo   A new window will open. Close it to stop.
echo.
call "%USB_ROOT%START.bat"
goto :menu

:config
echo.
echo   Opening Config Center in browser...
echo   If the AI Assistant is not running, start it first (Option 1).
echo.
start "" "http://127.0.0.1:18788/"
echo   Browser opened. If nothing appears, run Option 1 first.
echo.
pause
goto :menu

:update
echo.
echo   Checking for updates...
echo.
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%USB_ROOT%system\scripts\update.ps1" -CheckOnly
echo.
echo   To install updates, run UPDATE.bat directly.
echo.
pause
goto :menu

:skills
echo.
echo   Skills Management
echo   ========================================
echo   System skills:  %USB_ROOT%system\skills\
echo   User skills:    %USB_ROOT%user\skills\
echo.
echo   To add a skill, copy the SKILL.md file into user\skills\
echo   To remove a skill, delete its folder from user\skills\
echo.
echo   Open skills folder?
set /p "OPEN=  [Y/N]: "
if /i "%OPEN%"=="Y" explorer "%USB_ROOT%user\skills"
goto :menu

:backup
echo.
echo   Backing up user data...
echo.
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%USB_ROOT%system\scripts\backup.ps1"
echo.
pause
goto :menu

:restore
echo.
echo   Restore User Data
echo   ========================================
echo   Available backups:
echo.
if exist "%USB_ROOT%user\backups" (
    dir /b /ad "%USB_ROOT%user\backups" 2>nul
) else (
    echo   (No backups found)
)
echo.
echo   To restore: copy files from the backup folder
echo   to user\config\ and restart the assistant.
echo.
echo   Open backups folder?
set /p "OPENR=  [Y/N]: "
if /i "%OPENR%"=="Y" explorer "%USB_ROOT%user\backups"
goto :menu

:doctor
echo.
echo   Running system diagnostic...
echo.
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%USB_ROOT%system\scripts\doctor.ps1"
echo.
pause
goto :menu

:reset
echo.
echo   WARNING: This will delete the system layer (system/).
echo   Your data (user/) will be PRESERVED.
echo   You will need to run setup.ps1 afterwards.
echo.
set /p "CONFIRM=  Type RESET to confirm: "
if not "%CONFIRM%"=="RESET" (
    echo   Cancelled.
    pause >nul
    goto :menu
)
echo.
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%USB_ROOT%system\scripts\reset-system.ps1" -Force
echo.
echo   System layer reset. Run UPDATE.bat to re-download.
echo.
pause
goto :menu

:logs
echo.
echo   Opening logs folder...
if exist "%USB_ROOT%user\logs" (
    explorer "%USB_ROOT%user\logs"
) else (
    echo   No logs found yet. Start the assistant first.
)
echo.
pause
goto :menu

:exit
echo.
echo   Goodbye!
endlocal
exit /b 0
