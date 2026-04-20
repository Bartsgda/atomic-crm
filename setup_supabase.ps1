# CRM-Atomic: Supabase Setup Script
# Ten skrypt bezpiecznie pobierze od Ciebie klucze i zapisze je do pliku .env

$ErrorActionPreference = "Stop"

Write-Host "--- KONFIGURACJA SUPABASE (CRM-Atomic) ---" -ForegroundColor Cyan

$Url = Read-Host "Podaj SUPABASE_URL (np. https://xxx.supabase.co)"
if ([string]::IsNullOrWhiteSpace($Url)) { $Url = "https://xqznrssrlnxqkdvisnck.supabase.co" }

$PubKey = Read-Host "Podaj VITE_SB_PUBLISHABLE_KEY (Anon Key)"
$SecKey = Read-Host "Podaj VITE_SB_SECRET_KEY (Service Role Role Key)"

$EnvPath = Join-Path $PSScriptRoot ".env.development.local"

$Content = @"
SKIP_PREFLIGHT_CHECK=true

VITE_SUPABASE_URL=$Url
VITE_SB_PUBLISHABLE_KEY=$PubKey
VITE_SB_SECRET_KEY=$SecKey
VITE_IS_DEMO=false
VITE_ATTACHMENTS_BUCKET=attachments
"@

try {
    Set-Content -Path $EnvPath -Value $Content -Encoding UTF8
    Write-Host "`n[SUKCES] Dane zostały zapisane w: $EnvPath" -ForegroundColor Green
    Write-Host "Zrestartuj aplikację (npm run dev), aby zmiany weszły w życie." -ForegroundColor Yellow
} catch {
    Write-Host "`n[BŁĄD] Nie udało się zapisać pliku: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nWciśnij dowolny klawisz, aby zamknąć..."
$null = [Console]::ReadKey()
