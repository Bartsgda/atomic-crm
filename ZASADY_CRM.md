# ZASADY_CRM.md — Reguły robocze projektu CRM-Alina

> Zasady lokalne dla tego projektu. Nadrzędne: `../CONSIS BartsGda/ZASADY.md`.
> **Aktualizuj ten plik gdy coś się zmienia w protokole pracy.**

---

## 1. Protokół uczenia się (każda sesja)

### Na początku sesji

1. Czytaj **`WIEDZA_CRM.md`** — co już wiemy o architekturze, pułapkach, plikach
2. Czytaj **`src/legacy-v1/CLAUDE.md`** — indeks 38 specyfikacji modułowych (SUPREME_RULES)
3. `mcp__MCP-CONSIS__list_tasks(project_ref="crm-alina", status="pending")` — zadania
4. Sprawdź ostatni wpis w `WIEDZA_CRM.md § Sesje` — co zostało otwarte

### W trakcie pracy

- **Każde nowe odkrycie** (pułapka, wzorzec, nieoczekiwane zachowanie kodu) → natychmiast notujesz w `WIEDZA_CRM.md` w odpowiedniej sekcji tematycznej
- **Każda zmiana logiki** → aktualizujesz powiązany `.md` spec w `src/legacy-v1/`
- **Nowe decyzje architektoniczne** → sekcja `WIEDZA_CRM.md § Architektura`
- **Błędy i ich naprawy** → sekcja `WIEDZA_CRM.md § Pułapki i anty-wzorce`

### Na końcu sesji (OBOWIĄZKOWE)

```
1. Dodaj wpis do WIEDZA_CRM.md § Sesje (data, co zrobiono, co otwarte)
2. Zaktualizuj sekcje tematyczne WIEDZA_CRM.md jeśli coś nowego odkryto
3. Dodaj wpis do AlinaSplash.tsx → CHANGELOG[] (dla Aliny, nie technicznie)
4. Jeśli zmieniły się kluczowe procesy → zaktualizuj CLAUDE.md
5. Zamknij/zaktualizuj taski w brain (mcp__MCP-CONSIS__complete_task / update)
```

---

## 2. Zasady specyficzne dla CRM-Alina

### Deploy — jedyna poprawna procedura
```
python scripts/ftp_deploy.py
```
- NIE `--no-build` gdy był nowy kod
- NIE Hostido MCP SSH (brak hasła w vault)
- NIE deploy bez pytania Bartka: "czy wrzucić?"
- Przed deploy: `hostido_list_remote "/"` → sprawdź że `/alina` jest w FTP root

### Testowanie
```
START_ALINA_TEST.bat
```
NIE: `npx vite`, `npm run dev`, nic ręcznie. BAT ustawia env poprawnie.

### stage 'sprzedaz' vs 'sprzedaż' — ZAWSZE oba + trzecia forma
```ts
const SOLD_STAGES = ['sprzedaż', 'sprzedany', 'sprzedaz'];
```

### Sekrety
Wszystkie przez `rrv`. Klucze CRM-Alina: `CRM_ALINA_SB_SECRET`, `CRM_ALINA_SB_PUBLISHABLE`,
`CRM_ALINA_E2E_SERVICE_ROLE`, `CRM_ALINA_SUPABASE_URL`.
Python pattern:
```python
val = subprocess.check_output('powershell -Command "rrv get NAME"', shell=True).decode().replace('﻿','').strip()
```

### Supabase — schematy
- `public` = produkcja Aliny (NIGDY nie pisz z test do public)
- `test` = sandbox + import XLSX 2025 + kopia prod (po sync)
- `getPublicSupabaseClient()` = zawsze public (PassphraseGate, tenant_keys)
- `getArchiveSupabaseClient()` / `getTestSupabaseClient()` = schema test

### Migracje DB — schema-first
Source of truth: `supabase/schemas/`. NIGDY ręcznie w `migrations/`.
```
npx supabase db diff --local -f <name>
```

### Scripts Python
Lokalne skrypty: `scripts/*.py`. Pattern rrv + supabase-py już ustalony w `check_alina_feedback.py`.

---

## 3. Czego NIE ruszać

1. Sekrety w plaintext — zawsze przez `rrv`
2. Deploy na Hostido bez explicit OK Bartka
3. `test → public` data flow — NIGDY
4. Pliki `supabase/migrations/` — NIGDY ręcznie
5. `src/legacy-v1/services/dataMapper.ts` + `legacyParser.ts` — CODE FREEZE
6. Public PHP / workflow zip→PHP na Hostido — backdoor pattern

---

## 4. Mapowanie: funkcja → plik

| Funkcja | Plik |
|---|---|
| Klient: zapis/odczyt | `src/legacy-v1/services/supabaseStorage.ts` |
| Klient: typy | `src/legacy-v1/types.ts` |
| Klient: UI | `src/legacy-v1/components/ClientsList.tsx`, `ClientDetails.tsx` |
| Polisa: mapper XLSX | `src/legacy-v1/services/dataMapper.ts` (CODE FREEZE) |
| Polisa: import UI | `src/legacy-v1/components/DataImporter.tsx` |
| Finanse | `src/legacy-v1/components/Finance/FinanceView.tsx` |
| StatusEye widget | `src/legacy-v1/components/StatusEye.tsx` |
| PassphraseGate | `src/legacy-v1/components/EncryptionGate.tsx` |
| Supabase klienty | `src/components/atomic-crm/providers/supabase/supabase.ts` |
| FTP deploy | `scripts/ftp_deploy.py` |
| Feedback Aliny | `public.insurance_feedback` (Supabase) |
| Zmiana hasła szyfrowania | `src/legacy-v1/services/crypto.ts` |
| Wersja / Changelog | `src/components/atomic-crm/alina-splash/AlinaSplash.tsx` |
| Schema sync (prod→test) | `supabase/functions/sync-prod-to-test/` (w budowie) |
| Aktywna schema (globalny stan) | `public.configuration.active_schema` (Supabase) |
