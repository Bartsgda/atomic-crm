
# ⏰ Specyfikacja: System Przypomnień Tekstowych (XLSX Compatible)

## 1. Filozofia "Text-First"
Aby zachować pełną kompatybilność z eksportem i importem XLSX (gdzie notatki są jednym długim ciągiem znaków), logika przypomnień nie opiera się na ukrytych polach bazy danych, lecz na **ustrukturyzowanym tekście** wewnątrz treści notatki.

## 2. Format Zapisu
Każde przypomnienie jest zapisywane w treści notatki według ścisłego wzorca:

`[YYYY-MM-DD HH:mm]_STATUS_Treść właściwa`

### Dopuszczalne Statusy:
1.  **PRZYPOMNIENIE** - Aktywne zadanie.
2.  **UKOŃCZONE** - Zadanie wykonane (odznaczone).
3.  **ANULOWANE** - Zadanie nieaktualne.

### Przykłady:
*   `[2026-05-20 09:00]_PRZYPOMNIENIE_Zadzwonić w sprawie wznowienia OC`
*   `[2026-05-20 09:00]_UKOŃCZONE_Zadzwonić w sprawie wznowienia OC`

## 3. Integracja z Importem/Eksportem
*   **Eksport (XLSX):** Kolumna "notatki" zawiera surowy tekst. Dzięki temu data i status są widoczne w Excelu.
*   **Import:** System parsuje tekst. Jeśli wykryje wzorzec `[_PRZYPOMNIENIE_]`, automatycznie traktuje notatkę jako zadanie w Kalendarzu.

## 4. Widget UI (Notatki.tsx)
*   Przyciski szybkie: **1d** (Jutro), **2d**, **3d**, **7d**.
*   Custom: Ikonka kalendarza otwierająca native picker.
*   Wizualizacja w historii: Checkbox zmieniający status w tekście notatki (zamienia string `PRZYPOMNIENIE` na `UKOŃCZONE`).
