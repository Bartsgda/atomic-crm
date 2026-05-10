@AGENTS.md

# ZASADY PRACY — CRM-Alina (OBOWIĄZKOWE)

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
npx vite build --emptyOutDir false
python scripts/ftp_deploy.py --no-build
```
Następny deploy musi być już pełny (bez --no-build).

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
