# SLOT_REGISTRY.md — Rejestr zarezerwowanych tabel scratch

> **AI: zanim użyjesz slotu — przeczytaj sekcje "How to use" i "Promotion checklist" poniżej.**
> **Bartek:** co miesiąc przeglądaj `Status=CLAIMED` i decyduj: PROMOTE lub RESET.

## Powiazane

- Migracja: `supabase/migrations/20260515_reserved_slots.sql`
- Kod: `src/legacy-v1/services/slotStore.ts`
- Indeks MD tego folderu: `src/legacy-v1/CLAUDE.md`

---

## 📖 How to use (dla Claude w przyszłej sesji)

1. Gdy potrzebujesz nowej tymczasowej tabeli — znajdz pierwszy wiersz ze `Status=FREE` ponizej.
2. Zaktualizuj wiersz w tym pliku: ustaw `Status=CLAIMED`, wypelnij `Purpose`, `Claimed by session`, `Rename plan`.
3. Commit aktualizacje rejestru razem z kodem ktory uzywa slotu.
4. W kodzie uzywaj `slotStore.write(slotName, key, value)` / `slotStore.read(slotName)` — API w `src/legacy-v1/services/slotStore.ts`.
5. Slot trzyma dane przez caly miesiac lub do decyzji Bartka.

**Zasady:**
- Jeden slot = jeden cel semantyczny (nie mieszaj roznych tematow w jednym slocie).
- `payload` to JSONB — pakuj dowolne dane jako `{ key: value }` lub caly obiekt.
- Nie tworzac nowych tabel DDL w sesji — uzywaj slotow.

---

## 🔄 Promotion checklist (Bartek — koniec miesiaca)

```sql
-- 1. Przemianuj slot na docelowa nazwe
ALTER TABLE test.slot_NN RENAME TO actual_name;

-- 2. Dodaj typowane kolumny jesli JSONB nie wystarcza
ALTER TABLE test.actual_name ADD COLUMN col_x TEXT;

-- 3. Migruj dane z payload do typowanych kolumn (jesli trzeba)
UPDATE test.actual_name SET col_x = payload->>'col_x';

-- 4. Opcjonalnie: usun payload po migracji
ALTER TABLE test.actual_name DROP COLUMN payload;
```

```
5. Grep-replace `slot_NN` -> `actual_name` w kodzie aplikacji
6. Zaktualizuj ten plik: Status=PROMOTED, dodaj date
7. Uruchom `npx tsc --noEmit` zeby potwierdzic brak regresji typow
```

**Reset (jesli slot niepotrzebny):**
```sql
TRUNCATE test.slot_NN;
```
Zaktualizuj wiersz: `Status=FREE`, wyczysc pozostale kolumny.

---

## Tabela slotow

| Slot | Status | Purpose | Claimed by session | Rename plan | Notes |
|---|---|---|---|---|---|
| `slot_01` | FREE | — | — | — | — |
| `slot_02` | FREE | — | — | — | — |
| `slot_03` | FREE | — | — | — | — |
| `slot_04` | FREE | — | — | — | — |
| `slot_05` | FREE | — | — | — | — |
| `slot_06` | FREE | — | — | — | — |
| `slot_07` | FREE | — | — | — | — |
| `slot_08` | FREE | — | — | — | — |
| `slot_09` | FREE | — | — | — | — |
| `slot_10` | FREE | — | — | — | — |
| `slot_11` | FREE | — | — | — | — |
| `slot_12` | FREE | — | — | — | — |
| `slot_13` | FREE | — | — | — | — |
| `slot_14` | FREE | — | — | — | — |
| `slot_15` | FREE | — | — | — | — |
| `slot_16` | FREE | — | — | — | — |
| `slot_17` | FREE | — | — | — | — |
| `slot_18` | FREE | — | — | — | — |
| `slot_19` | FREE | — | — | — | — |
| `slot_20` | FREE | — | — | — | — |
| `slot_21` | FREE | — | — | — | — |
| `slot_22` | FREE | — | — | — | — |
| `slot_23` | FREE | — | — | — | — |
| `slot_24` | FREE | — | — | — | — |
| `slot_25` | FREE | — | — | — | — |
| `slot_26` | FREE | — | — | — | — |
| `slot_27` | FREE | — | — | — | — |
| `slot_28` | FREE | — | — | — | — |
| `slot_29` | FREE | — | — | — | — |
| `slot_30` | FREE | — | — | — | — |
