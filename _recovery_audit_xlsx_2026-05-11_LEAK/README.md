# Recovery — audit XLSX↔DB CRM-Alina (sesja 2026-05-11 wieczór)

> ⚠️ **LEAK risk** — pliki zawierają dane klientów ubezpieczeniowych Aliny (182 wierszy XLSX z dumpami). Folder oznaczony `_LEAK` żeby gitleaks/scan_secrets potraktowały jako sensitive, a `rr-trash` auto-szyfrował Fernet przy usuwaniu (regex `leak` w nazwie).

## Co tu jest

16 plików / 888.4 KB skopiowanych 2026-05-21 z `C:/Users/Barts/` (gdzie zostały po sesji audit 2026-05-11 23:05-23:57).

| Plik | Co | mtime |
|---|---:|---|
| `xlsx_head.json` | nagłówki XLSX (start sesji) | 11.05 23:05 |
| `audit_rows_1_10.json` | batch wierszy 1-10 | 11.05 23:09 |
| `audit_policies_31_40.json` + `audit_xlsx_31_40.json` + `audit_data_31_40.json` | batch 31-40 (3 perspektywy: policies / XLSX / DB) | 11.05 23:29-23:30 |
| `audit_rows_11_20_db.json` | batch 11-20 (DB) | 11.05 23:29 |
| `audit_rows_81_90.json` | batch 81-90 | 11.05 23:50 |
| `audit_91_110_dump.json` | batch 91-110 dump | 11.05 23:57 |
| `audit_111_130_dump.txt/full.json/raw.json/xlsx.json` | batch 111-130 (4 warianty) | 11.05 23:57 |
| `audit_151_170_dump.json/xlsx.json` | batch 151-170 (2 warianty) | 11.05 23:57 |
| `audit_171_182_db.json/xlsx.json` | końcowy batch 171-182 | 11.05 23:57 |

## Kontekst — czemu te pliki są potrzebne

Sesja 2026-05-11 wieczór to ciąg dalszy migracji **CRM-Alina XLSX (182 wierszy klientów) → Supabase test schema**:
- Pierwsza pełna fala: commit `826ceef` 2026-05-10 23:51 `feat(crm-alina): mapper XLSX 182 wierszy -> Supabase test schema`
- Sesja 11.05 wieczór = **batchowy audit XLSX vs DB** żeby wychwycić rozjazdy mappera (typy danych, encoding, brak kolumn, nadpisane PK)
- W kolejnych dniach (12-17.05) wprowadzano fixy mappera (`fix(import): row-mapping`, `fix(crm-alina): archiveLoader`, `feat(crm-alina): ETAP A/B`) i refaktor schematu na vehicles+insured_persons+client_businesses (branch `schema-refactor-vehicles-insured-2026-05-14`)
- **Potem Bartek stracił bazę test** (commit `0fa4596` 2026-05-18 00:25 `feat(sync+splash): additive merge finalny + splash` — pewnie nieudany merge / wipe)
- **Te dumpy są jedynym śladem stanu PO poprawkach 11.05** — z nich można odtworzyć kontrolnie co miało być w bazie po fixach mappera

## Co z tym zrobić — TODO

1. **Załadować dumpy w nowy schemat (vehicles/insured_persons/client_businesses)** — porównać z aktualnym stanem produkcji
2. **Wytypować brakujące poprawki** — przeniesione kolumny, encoding fixes, dedup policies/notes (commit `7fd8e2a` z 16.05 deterministyczne ID z wiersza XLSX), schema-aware row mapping (commit `9be5160`)
3. **Zastosować poprawki w prod/test bazie** (przez `apply_migration` lub UI import)
4. **PO weryfikacji w bazie — usunąć ten folder przez `python rr-trash.py <path>`** — `rr-trash` rozpozna `_LEAK` w nazwie i auto-szyfruje Fernet (klucz `RR_TRASH_KEY` w rrv) + 3-pass secure-wipe oryginałów. **NIE raw delete, NIE git rm.**
5. **Oryginalne pliki w `C:/Users/Barts/` też do `rr-trash`** po fixie (te które tu skopiowane — to były artefakty Antigravity AI sesji `feat(crm-alina): mapper XLSX 182 wierszy`).

## Brain task

Powiązany task: `mcp__MCP-CONSIS__list_tasks(project_ref="crm-alina")` — szukaj title zaczynający się od **"Recovery audit XLSX↔DB 11.05"**.

## Sygnatura

Utworzone: 2026-05-21 (DOM, sesja `dev_2026-05-21`) z polecenia Bartka: *"to z comitu 11.05 praca nad CRM atomic poprawianei bazy - pozniej stracił baze - ale tu sam pliki potrzebne do odzyksania poprawek wiece skopiuj i dodaj do zadań w CRM alina"*
