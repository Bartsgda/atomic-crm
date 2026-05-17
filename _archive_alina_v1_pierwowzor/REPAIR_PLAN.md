
# 🛠️ PLAN NAPRAWCZY (EXECUTION LOG)

1. **CLEANUP:** Oznaczenie plików w katalogu głównym (`App.tsx`, `index.tsx`, `types.ts`) treścią nakazującą ich usunięcie. To wyeliminuje ryzyko edycji złego pliku w przyszłości.
2. **ROUTING FIX:** Aktualizacja `crm-pro/App.tsx`.
   - Usunięcie importu starego `InsurersView`.
   - Wdrożenie importu `TowarzystwaView`.
   - Weryfikacja ścieżek importów (`./types` zamiast `../types` w zależności od głębokości).
3. **COMPONENT STABILIZATION:** `TowarzystwaView.tsx` pozostaje w wersji "Hardcoded/Safe Mode" z poprzedniego kroku, aby zagwarantować wyświetlanie danych.

**INSTRUKCJA DLA UŻYTKOWNIKA:**
Po zastosowaniu tych zmian, usuń ręcznie pliki oznaczone jako `USUN_PLIK_RECZNIE` z głównego katalogu projektu.
