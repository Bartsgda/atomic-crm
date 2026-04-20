# ==============================================================
# deploy_hostido.ps1 — Deploy CRM ALINA na Hostido
# Target: redroad.pl/alina
# Remote: /home/host665744/domains/redroad.pl/alina/public_html/
#
# WYMAGANIA przed uruchomieniem:
#   1. Zaloguj się: rrv login  (lub ustaw env vars ręcznie)
#   2. Ustaw zmienne środowiskowe:
#        $env:HOSTIDO_FTP_HOST = "ftp.hostido.net.pl"  # lub IP serwera
#        $env:HOSTIDO_FTP_USER = "host665744"
#        $env:HOSTIDO_FTP_PASS = "<hasło FTP z panelu Hostido>"
#        $env:HOSTIDO_SSH_HOST = "host665744.hostido.net.pl"  # opcjonalnie
#   3. curl.exe musi być dostępny (Windows 10 1803+ ma wbudowany)
# ==============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Konfiguracja ──────────────────────────────────────────────
$REMOTE_PATH = "/home/host665744/domains/redroad.pl/public_html/alina"
$DIST_DIR    = Join-Path $PSScriptRoot "..\dist"
$ZIP_NAME    = "crm-alina-latest.zip"
$ZIP_PATH    = Join-Path $env:TEMP $ZIP_NAME

# ── Weryfikacja env vars ──────────────────────────────────────
$missing = @()
foreach ($var in @("HOSTIDO_FTP_HOST","HOSTIDO_FTP_USER","HOSTIDO_FTP_PASS")) {
    if (-not (Get-Item "env:$var" -ErrorAction SilentlyContinue)) {
        $missing += $var
    }
}
if ($missing.Count -gt 0) {
    Write-Error @"
BŁĄD: Brakuje zmiennych środowiskowych FTP:
  $($missing -join ', ')

Ustaw je przed uruchomieniem skryptu:
  `$env:HOSTIDO_FTP_HOST = "ftp.hostido.net.pl"
  `$env:HOSTIDO_FTP_USER = "host665744"
  `$env:HOSTIDO_FTP_PASS = "<hasło z panelu Hostido>"

Jeśli używasz vault/rrv:
  rrv login
  rrv env-export | Invoke-Expression
"@
    exit 1
}

# ── Sprawdź dist/ ─────────────────────────────────────────────
if (-not (Test-Path (Join-Path $DIST_DIR "index.html"))) {
    Write-Error "BŁĄD: Brak dist/index.html. Najpierw uruchom: npm run build"
    exit 1
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  CRM ALINA — Deploy na Hostido" -ForegroundColor Cyan
Write-Host "  Target: redroad.pl/alina" -ForegroundColor Cyan
Write-Host "  Remote: $REMOTE_PATH" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ── Rozmiar dist/ ────────────────────────────────────────────
$distSize = (Get-ChildItem $DIST_DIR -Recurse -File | Measure-Object -Property Length -Sum).Sum
$distSizeMB = [math]::Round($distSize / 1MB, 1)
$fileCount  = (Get-ChildItem $DIST_DIR -Recurse -File).Count
Write-Host "Paczka dist/: $distSizeMB MB, $fileCount plików" -ForegroundColor Gray
Write-Host ""

# ── Tworzenie ZIP ─────────────────────────────────────────────
Write-Host "Tworzę ZIP: $ZIP_PATH ..." -ForegroundColor Yellow
if (Test-Path $ZIP_PATH) { Remove-Item $ZIP_PATH -Force }

# Kompresujemy zawartość dist/ (nie sam katalog dist) — po rozpakowaniu pliki trafią prosto do public_html
Compress-Archive -Path "$DIST_DIR\*" -DestinationPath $ZIP_PATH -CompressionLevel Optimal
$zipSizeMB = [math]::Round((Get-Item $ZIP_PATH).Length / 1MB, 1)
Write-Host "ZIP gotowy: $zipSizeMB MB" -ForegroundColor Green
Write-Host ""

# ── Potwierdzenie ─────────────────────────────────────────────
Write-Host "UWAGA: Zaraz zostanie nadpisana zawartość public_html na Hostido!" -ForegroundColor Red
Write-Host "  Host FTP : $($env:HOSTIDO_FTP_HOST)" -ForegroundColor Gray
Write-Host "  Użytkownik: $($env:HOSTIDO_FTP_USER)" -ForegroundColor Gray
Write-Host ""
$confirm = Read-Host "Czy kontynuować upload? [tak/NIE]"
if ($confirm -ne "tak") {
    Write-Host "Anulowano przez użytkownika." -ForegroundColor Yellow
    exit 0
}

# ── Upload FTP (curl.exe) ─────────────────────────────────────
$ftpUrl = "ftp://$($env:HOSTIDO_FTP_HOST)/$ZIP_NAME"
Write-Host ""
Write-Host "Upload FTP → $ftpUrl ..." -ForegroundColor Yellow

$curlArgs = @(
    "--ftp-create-dirs",
    "--ssl-reqd",                          # Wymaga TLS (FTPS explicit)
    "--user", "$($env:HOSTIDO_FTP_USER):$($env:HOSTIDO_FTP_PASS)",
    "-T", $ZIP_PATH,
    $ftpUrl
)

try {
    & curl.exe @curlArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "curl z --ssl-reqd zwrócił błąd ($LASTEXITCODE). Próba bez TLS..."
        $curlArgs = $curlArgs | Where-Object { $_ -ne "--ssl-reqd" }
        & curl.exe @curlArgs
        if ($LASTEXITCODE -ne 0) {
            throw "Upload FTP nie powiódł się (exit code $LASTEXITCODE)"
        }
    }
    Write-Host "Upload zakończony sukcesem." -ForegroundColor Green
} catch {
    Write-Error "BŁĄD uploadu FTP: $_"
    exit 1
}

# ── SSH extract ───────────────────────────────────────────────
$sshHost = if ($env:HOSTIDO_SSH_HOST) { $env:HOSTIDO_SSH_HOST } else { $env:HOSTIDO_FTP_HOST }

Write-Host ""
Write-Host "Próba rozpakowywania przez SSH ($sshHost)..." -ForegroundColor Yellow

$sshCmd = "cd $REMOTE_PATH && unzip -o $ZIP_NAME && rm $ZIP_NAME && echo 'OK: rozpakowano'"

try {
    $result = & ssh.exe "$($env:HOSTIDO_FTP_USER)@$sshHost" $sshCmd 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SSH: $result" -ForegroundColor Green
        Write-Host ""
        Write-Host "=====================================================" -ForegroundColor Green
        Write-Host "  DEPLOY ZAKOŃCZONY SUKCESEM" -ForegroundColor Green
        Write-Host "  https://redroad.pl/alina" -ForegroundColor Green
        Write-Host "=====================================================" -ForegroundColor Green
    } else {
        throw "SSH exit $LASTEXITCODE"
    }
} catch {
    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Yellow
    Write-Host "  FALLBACK: SSH niedostępne lub błąd" -ForegroundColor Yellow
    Write-Host "  ZIP przesłany jako: ftp://.../public_html/$ZIP_NAME" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Rozpakuj ręcznie przez panel Hostido:" -ForegroundColor Yellow
    Write-Host "  1. Zaloguj się do panelu DirectAdmin / FileManager" -ForegroundColor White
    Write-Host "  2. Przejdź do: domains/redroad.pl/public_html/alina/" -ForegroundColor White
    Write-Host "  3. Kliknij prawym na $ZIP_NAME → Extract" -ForegroundColor White
    Write-Host "  4. Usuń plik ZIP po rozpakowaniu" -ForegroundColor White
    Write-Host "=====================================================" -ForegroundColor Yellow
}

# ── Sprzątanie ────────────────────────────────────────────────
if (Test-Path $ZIP_PATH) {
    Remove-Item $ZIP_PATH -Force
    Write-Host "Tymczasowy ZIP usunięty." -ForegroundColor Gray
}
