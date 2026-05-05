# FTP Tools — CRM-Alina / Hostido

Trzy skrypty Python do zarządzania deploymentem CRM-Alina na serwer Hostido.
Credsy wyłącznie z `rrv` vault — zero hardcoded haseł.

---

## Architektura serwera — PRZECZYTAJ ZANIM COKOLWIEK ZROBISZ

```
FTP root konta deploy@redroad.pl = web root redroad.pl
│
├── index.php, drogi.php, oswietlenie.php ...  ← redroad.pl/ (główna strona PHP)
├── assets/, src/, calc/, portfolio/ ...       ← zasoby głównej strony
├── domains/                                   ← inne domeny na koncie
│
├── alina/              ✅ redroad.pl/alina/   ← AKTYWNY CRM — tu deploujemy
│   ├── index.html
│   ├── assets/         (JS, CSS, fonty)
│   ├── logos/, img/, appIcon/
│   ├── .htaccess, manifest.json, robots.txt
│   └── ...
│
└── public_html/        ⛔ redroad.pl/public_html/  ← NIE jest web rootem!
    └── (powinno być puste — śmieci z błędnych deployów lądują tu)
```

### Pułapka public_html

Na standardowym hostingu cPanel (i większości shared hosting) `public_html/`
jest web rootem. **Na tym koncie Hostido tak NIE jest.** FTP root jest już
web rootem — pliki PHP leżą tu bezpośrednio.

Deploy do `public_html/alina/` = URL `redroad.pl/public_html/alina/` = zły adres,
aplikacja niedostępna. Dokładnie to zrobił Antigravity Flash w nocy 04/05.05.2026
podczas pierwszego deploy — trafił w złe miejsce, bo założył standardowe cPanel.

**Reguła:** skrypty nigdy nie robią `cwd("public_html")`. Deploy idzie wprost
do `/alina/` z FTP root.

---

## Narzędzia

### `ftp_audit.py` — Diagnostyka (read-only)

```bash
python scripts/ftp_audit.py
```

Co robi:
- Łączy się z FTP (`set_pasv(True)`) i wypisuje root z datami (`dir`)
- Listuje `/alina/` przez `mlsd` — każdy plik z **rozmiarem i datą modyfikacji**
- Listuje `/alina/assets/`
- Pobiera zdalny `index.html` i wypisuje wszystkie `src=` / `href=` — weryfikacja
  czy Vite build ma poprawny base URL (`./assets/...`)

Używaj po każdym deploy, żeby potwierdzić co faktycznie wylądowało i kiedy.
`mlsd` jest kluczowe — zwykły `nlst` (używany przez MCP) nie daje dat ani rozmiarów.

---

### `ftp_deploy.py` — Build + deploy

```bash
python scripts/ftp_deploy.py             # build Vite + upload do /alina/
python scripts/ftp_deploy.py --no-build  # tylko FTP upload (dist/ musi istnieć)
```

Kolejność działań:
1. Pobiera z vault `CRM_ALINA_SB_PUBLISHABLE` i `CRM_ALINA_SB_SECRET`
2. Uruchamia `npm run build` z env vars wstrzykniętymi przez `subprocess.env`
   (klucze **nie są zapisywane do żadnego pliku** — tylko do pamięci procesu)
3. Wgrywa `dist/` rekurencyjnie do `/alina/` w FTP root

Vault keys wymagane:

| Klucz vault | Do czego |
|---|---|
| `HOSTIDO_FTP_HOST` | adres serwera FTP |
| `HOSTIDO_FTP_USER` | login FTP |
| `HOSTIDO_FTP_PASS` | hasło FTP |
| `CRM_ALINA_SB_PUBLISHABLE` | Supabase anon key (pomijane przy `--no-build`) |
| `CRM_ALINA_SB_SECRET` | Supabase service role key (pomijane przy `--no-build`) |

Zmienne Vite wstrzykiwane do build:

```
VITE_SUPABASE_URL        = https://xqznrssrlnxqkdvisnck.supabase.co
VITE_SB_PUBLISHABLE_KEY  = z vault (CRM_ALINA_SB_PUBLISHABLE)
VITE_SB_SECRET_KEY       = z vault (CRM_ALINA_SB_SECRET)
VITE_IS_DEMO             = false
VITE_ATTACHMENTS_BUCKET  = attachments
```

---

### `ftp_cleanup.py` — Usuwanie pomyłkowych plików

```bash
python scripts/ftp_cleanup.py        # interaktywnie — pyta o potwierdzenie
python scripts/ftp_cleanup.py --yes  # bez pytań (destruktywne)
```

Usuwa z serwera pliki wgrane przez pomyłkę poza `/alina/`:

| Co usuwa | Dlaczego tam trafia |
|---|---|
| `public_html/alina/` | deploy do złego miejsca (błąd public_html) |
| `public_html/logos/`, `img/`, `appIcon/` | śmieci Vite w błędnym miejscu |
| luźne pliki Vite w FTP root (`manifest.json` itp.) | deploy wprost do root |

**Zabezpieczenia zakodowane w skrypcie:**

- `PROTECTED` — jawna lista folderów których skrypt nigdy nie dotknie:
  `/alina/`, `index.php`, `calc/`, `portfolio/`, `domains/`, `assets/` itp.
- Pre-check — przed startem sprawdza czy `/alina/` istnieje; jeśli nie — zatrzymuje
  i podaje komendę recovery
- Post-check — po zakończeniu weryfikuje że `/alina/` nadal jest; jeśli zniknął
  — alarm krytyczny z komendą: `python scripts/ftp_deploy.py --no-build`

---

## Hostido MCP

MCP (`mcp__RedRoad-Hostido__*`) jest alternatywą dla skryptów, ale ma ograniczenia:

| Narzędzie MCP | Odpowiednik / uwagi |
|---|---|
| `hostido_check_health` | Test FTP + SSH (SSH wymaga odblokowanego klucza w vault) |
| `hostido_list_remote` | Listing folderu — **bez dat i rozmiarów** (NLST) |
| `hostido_ftp_upload` | Upload pojedynczego pliku lub zip |
| `hostido_deploy_zip` | Deploy z gotowego zip |
| `hostido_ssh_run` | Dowolna komenda SSH — najszybsze do jednorazowych operacji |

Do audytu dat po deploy używaj `ftp_audit.py`, nie MCP — MCP nie daje `mlsd`.

---

## Recovery — gdy /alina/ zniknie

```bash
# Masz lokalnie dist/ (ostatni build)?
python scripts/ftp_deploy.py --no-build

# Nie masz dist/ — pełny rebuild z vault:
python scripts/ftp_deploy.py
```

---

## Workflow deploy

```bash
# 1. Audyt przed deploy (opcjonalny)
python scripts/ftp_audit.py

# 2. Build + deploy
python scripts/ftp_deploy.py

# 3. Weryfikacja dat po deploy
python scripts/ftp_audit.py

# 4. Cleanup jeśli coś wylądowało w złym miejscu
python scripts/ftp_cleanup.py
```
