param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("prod", "test", "e2e", "dev")]
    [string]$Mode
)

# Mapowanie trybow na pliki zrodlowe
$sourceMap = @{
    "prod" = ".env.alina.prod"
    "test" = ".env.alina.test"
    "e2e"  = ".env.e2e"
    "dev"  = ".env.development"
}
$source = $sourceMap[$Mode]
$target = ".env.development.local"

if (-not (Test-Path $source)) {
    Write-Host "[ERR] Brak pliku zrodlowego: $source" -ForegroundColor Red
    exit 1
}

# Sprawdz czy rrv jest dostepny i zalogowany
$rrvCheck = & rrv status 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $rrvCheck -notmatch "zalogowany") {
    Write-Host "[ERR] rrv nie zalogowany. Uruchom: rrv login" -ForegroundColor Red
    exit 2
}

# Wczytaj plik i expanduj markery <rrv:NAZWA>
$lines = Get-Content $source -Encoding UTF8
$out = @()
$expanded = 0
$missing = @()

foreach ($line in $lines) {
    # Pomin komentarze i puste linie
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) {
        $out += $line
        continue
    }
    if ($line -match '<rrv:([A-Z0-9_]+)>') {
        $name = $matches[1]
        $val = & rrv get $name 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($val)) {
            $missing += $name
            $out += $line
        } else {
            $newLine = $line -replace "<rrv:$name>", $val.Trim()
            $out += $newLine
            $expanded++
        }
    } else {
        $out += $line
    }
}

if ($missing.Count -gt 0) {
    Write-Host "[ERR] Brak w rrv: $($missing -join ', ')" -ForegroundColor Red
    exit 3
}

# Zapisz target (bez BOM)
$content = ($out -join "`n") + "`n"
[System.IO.File]::WriteAllText((Resolve-Path .).Path + "\$target", $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "[OK] Tryb: $Mode | $source -> $target | rrv markerow: $expanded" -ForegroundColor Green
