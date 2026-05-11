@echo off
title CRM-ALINA - DEV MODE (TEST schema)
cd /d "%~dp0"

echo [ENV] switch_env.ps1 test (.env.alina.test -^> .env.development.local + rrv expand)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_env.ps1" test
if errorlevel 1 (
    echo [ERROR] switch_env.ps1 test failed (rrv login? brak markerow?)
    pause
    exit /b 1
)

echo [KILL] Zamykam stare procesy Vite...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5175 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul

if not exist node_modules (
    echo [SETUP] Brak node_modules - instaluje...
    call npm install
)

echo.
echo ========================================
echo  CRM-ALINA DEV - http://localhost:5173
echo ========================================
echo.

timeout /t 1 /nobreak >nul
start "" http://localhost:5173
call npm run dev
pause