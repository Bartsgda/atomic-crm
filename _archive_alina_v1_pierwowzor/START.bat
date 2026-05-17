@echo off
title CRM-ALINA (Insurance Master Pro)
cd /d "%~dp0"

if not exist node_modules (
    echo [SETUP] Brak node_modules - instaluje zaleznosci...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install nie powiodl sie
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo  CRM-ALINA Insurance Master Pro
echo  http://localhost:3000
echo ========================================
echo.

start "" http://localhost:3000
call npm run dev

pause
