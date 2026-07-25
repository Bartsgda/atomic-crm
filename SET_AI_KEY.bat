@echo off
title CRM-ALINA - Zapis klucza AI (DEK)
cd /d "%~dp0"
echo.
echo === Zapis klucza AI zaszyfrowanego DEK (jednorazowo) ===
echo Podajesz TYLKO haslo aplikacji Aliny. Email + klucz z vault.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "rrv export-env --format ps | Invoke-Expression; node scripts/set_ai_key.mjs"
echo.
pause