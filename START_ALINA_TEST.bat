@echo off
title CRM-ALINA (V2) - TEST MODE
cd /d "%~dp0"

echo [MODE] Przelaczanie na TEST...
powershell -ExecutionPolicy Bypass -File .\switch_env.ps1 -Mode test

if not exist node_modules (
    echo [SETUP] Brak node_modules - instaluje...
    call npm install
)

echo.
echo ========================================
echo  CRM-ALINA V2 (TEST - TWOJA BAZA)
echo ========================================
echo.

start "" http://localhost:5173
call npm run dev
pause
