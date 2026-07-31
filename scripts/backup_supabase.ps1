# Skrypt do manualnego backupu bazy Supabase (ALINA PROD)
# Wymaga: Supabase CLI (npx) oraz hasla do bazy danych.

$ProjectRef = "xqznrssrlnxqkdvisnck"
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$OutputFile = "backups/alina_prod_$Date.sql"

Write-Host "🚀 Rozpoczynam backup bazy Supabase [$ProjectRef]..." -ForegroundColor Cyan

# Próba wykonania dumpa
# UWAGA: Supabase zapyta o haslo do bazy danych (DB Password), jesli nie jest ustawione w zmiennej env.
npx supabase db dump --project-ref $ProjectRef -f $OutputFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backup ukonczony pomyslnie: $OutputFile" -ForegroundColor Green
} else {
    Write-Host "❌ Blad podczas tworzenia backupu." -ForegroundColor Red
}
