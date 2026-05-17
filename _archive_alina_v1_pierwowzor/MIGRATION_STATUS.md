
# 🚀 RAPORT POSTĘPÓW MIGRACJI: REACT -> PYTHON (PyQt6)
**Data:** 2026-02-09
**Status Generalny:** Faza 3 (Implementacja Logiki Biznesowej i Importu)
**Całkowity Postęp:** ~65%

---

## 1. FUNDAMENTY SYSTEMU (CORE)

| Moduł React | Odpowiednik Python | Postęp | Status | Uwagi |
|:---|:---|:---:|:---|:---|
| `types.ts` | `python/models.py` | **100%** | ✅ READY | Modele Pydantic kompletne. |
| `storage.ts` | `python/db.py` | **95%** | ✅ READY | Baza SQLite, obsługa wątków, tabele: policies, clients, notes, sub_agents. |
| `dataMapper.ts` | `services/data_mapper.py` | **90%** | ✅ READY | Obsługa JSON (kolumny systemowe) + Legacy Maps (Krok 0). |
| `legacyParser.ts` | `services/legacy_parser.py` | **95%** | ✅ READY | Regexy, normalizacja słownikowa, czyszczenie marek. |
| `normalizationDictionary.ts` | `data/dictionaries.py` | **100%** | ✅ READY | Słowniki literówek i skrótów przeniesione. |

---

## 2. GŁÓWNE MODUŁY UI (FRONTEND)

### A. Import Danych (XLSX)
*   **Postęp:** 90%
*   **Zrobione:** Czytanie plików, wykrywanie kolumn systemowych (Round-Trip), obsługa "Legacy Maps", wykrywanie pośredników.
*   **Logika:** 1:1 zgodna z `IMPORT_LOGIC.md` (JSON -> Map -> Regex).

### B. Klienci (CRM Core)
*   **Postęp:** 70%
*   **Zrobione:** Lista, Szczegóły, Dodawanie, Import.
*   **Brakuje:** Zaawansowanego wyszukiwania po NIP/PESEL w UI (logika w DB jest).

### C. Pojazdy (Auto) & Domy (Property)
*   **Postęp:** 60%
*   **Zrobione:** Wykrywanie typu przy imporcie (Auto vs Dom vs Firma), parsowanie danych technicznych (pojemność, rok).
*   **Brakuje:** Dedykowanych formularzy edycji (obecnie jest generyczny `PolicyForm` - trzeba go rozbić na zakładki jak w React).

### D. Pośrednicy (Sub-Agents)
*   **Postęp:** 80%
*   **Zrobione:** Baza danych, UI Drzewa, Logika importu prowizji, Raporty XLSX.

---

## 3. PRIORYTETY (NEXT STEPS)

1.  🔴 **UI Formularzy (5 Filarów):** Rozbudowa `PolicyForm` w Pythonie, aby miał zakładki dedykowane dla `AutoDetails`, `HomeDetails` itd. (tak jak `PolicyFormModal.tsx` w React).
2.  🟡 **Terminations (Wypowiedzenia):** Implementacja generatora PDF (ReportLab).
3.  🟡 **Finance View:** Wykresy i statystyki roczne.
