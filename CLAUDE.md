@AGENTS.md

# ZASADY PRACY — CRM-Alina (OBOWIĄZKOWE)

> **AI: zanim dotkniesz `src/legacy-v1/*.tsx` lub piszesz mapper/parser/import — przeczytaj NAJPIERW [`src/legacy-v1/CLAUDE.md`](./src/legacy-v1/CLAUDE.md). Tam jest indeks 38 plików `.md` per moduł + SUPREME_RULES + anti-patterns (lekcja 2026-05-11: AI 4 razy poprawiał błędy bo zignorował te spec).**


## 1. Deploy — jedyna poprawna procedura

```
python scripts/ftp_deploy.py
```

**ZAKAZY:**
- NIE `--no-build` gdy był nowy kod — stale dist/ zgubi zmiany
- NIE Hostido MCP SSH — klucz SSH nie ma hasła w vault
- NIE deploy bez potwierdzenia użytkownika ("czy wrzucić?")
- NIE deploy bez sprawdzenia ścieżki przez `hostido_list_remote /`

**Przed każdym deployem:**
1. `mcp__RedRoad-Hostido__hostido_list_remote({ remote_path: "/" })` — potwierdź że `alina` jest w FTP root
2. Zapytaj użytkownika o zgodę
3. `python scripts/ftp_deploy.py` (pełny build)

**Struktura FTP:**
- FTP root `/` = web root `https://redroad.pl/`
- `/alina/` = `https://redroad.pl/alina/` ← tutaj wgrywa deploy
- `/public_html/alina/` = STARY/BŁĘDNY folder — ignoruj!

**Jeśli Firefox blokuje dist/ (EBUSY):**
```
# zamknij Firefox/DevTools, potem:
rm -rf dist/ && python scripts/ftp_deploy.py
```
NIGDY `--emptyOutDir false` jako workflow — STOR nie kasuje, FTP zaśmieci się starymi bundle (zdarzyło się 2026-05-10: 35 starych bundle na FTP po 4 deployach).

**ZAKAZ ad-hoc Service Worker / kill-switcha** — nie dodawać `public/sw.js` ani `<script>navigator.serviceWorker.register</script>` w `index.html`. Jeśli klient ma stary SW, hard reload (Ctrl+Shift+R) lub karta incognito to wystarczy. Każda próba "fixu" przez nowy SW miesza w localStorage Supabase Auth.

**Skansen `/public_html/alina/`** — okresowo (raz/tydzień) sprawdzaj `ftplib.mlsd('/public_html')` że jest pusty. 2026-05-10 znaleziono tam **61 plików + `unzip_helper.php` z hardcoded `crm2026`** (backdoor pattern, prawdopodobny powód flagi Safe Browsing) + `deploy_temp.zip` (2.4 MB pobieralne publicznie). Pozostałości po porzuconym workflow zip→PHP unzip. Cleanup w jednym Python skrypcie (rekurencyjny `ftp.delete` + `ftp.rmd`).

**ZAKAZ workflow zip→PHP unzip** — `ftp_deploy.py` ze STOR działa pewnie i nie zostawia plików wykonywalnych. Każdy `*_helper.php`, `*_upload.php`, `unzip_*.php` na hostingu = automat flag dla Google Safe Browsing/Sucuri/Norton.

## 2. Testowanie — zawsze przez BAT

```
START_ALINA_TEST.bat
```

NIE: `npx vite`, `npm run dev`, ani inne ręczne komendy.
BAT poprawnie ustawia env zmienne i konfigurację.

## 3. stage 'sprzedaz' vs 'sprzedaż' — ZAWSZE oba

localStorage zapisuje polisy z `stage='sprzedaz'` (bez ż). Runtime może mieć obie formy.
W każdym porównaniu stage zawsze dodawaj trzecią formę:

```ts
// POPRAWNIE:
const SOLD_STAGES = ['sprzedaż', 'sprzedany', 'sprzedaz'];
p.stage === 'sprzedaż' || p.stage === 'sprzedany' || p.stage === 'sprzedaz'

// BŁĘDNIE (pomija starszy localStorage):
p.stage === 'sprzedaż' || p.stage === 'sprzedany'
```

## 4. Dokumentacja przed kodem (SUPREME_RULES §4)

Przy każdej zmianie logiki — najpierw zaktualizuj odpowiedni `.md`:
- `src/legacy-v1/WYMAGANIA-KLIENT.md`
- `src/legacy-v1/CLIENTS_SPEC.md`
- inne `*_SPEC.md` w danym module

## 5. Changelog po każdej sesji

Dodaj wpis do `src/components/atomic-crm/alina-splash/AlinaSplash.tsx` → `CHANGELOG[]`
z datą dzisiejszą i opisem co się zmieniło (dla Aliny, nie technicznie).
