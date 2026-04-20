
# Specyfikacja: Panel Klienta 360° (v4.1)

## 1. UI Architecture (Siatka 1.5-7-3.5)
Zoptymalizowany układ pod kątem czytelności osi czasu ("The Brain").

- **Kolumna 1 (12.5% - 1.5fr):** "Akta Osobowe".
    - Dane statyczne: Telefony, Adres, NIP.
    - Cel: Szybki rzut oka na tożsamość.
- **Kolumna 2 (58.3% - 7fr):** "Centrum Operacyjne".
    - **Omni-Composer (Big Mode):** Wielki edytor notatki z szybkim stasusem (OK, W TOKU, ODRZUT).
    - **Oś Czasu (Timeline):** Historia zdarzeń, notatek i zmian statusów.
- **Kolumna 3 (29.1% - 3.5fr):** "Portfel Produktowy".
    - Karty polis (Pipeline + Wallet).
    - Wyszukiwarka produktów.

## 2. System Przypomnień "Text-First"
Aby zachować kompatybilność z eksportem XLSX (gdzie notatki są surowym tekstem), przypomnienia są zaszyte w treści.

### Format Danych
Notatka z przypomnieniem ma format:
`[YYYY-MM-DD HH:mm]_STATUS_Treść właściwa`

Statusy:
- `PRZYPOMNIENIE` (Aktywne zadanie w kalendarzu).
- `UKOŃCZONE` (Zadanie wykonane, przekreślone).

### Interfejs (Widget)
- W edytorze notatek znajduje się pasek z opcjami: `1d` (Jutro), `2d`, `3d`, `7d` oraz `Kalendarz` (Wybór daty).
- Wybranie daty automatycznie formatuje tekst notatki przy zapisie.

## 3. Cross-Highlighting
- **Note -> Policy**: Najechanie na notatkę podświetla powiązaną polisę w prawej kolumnie.
- **Policy -> Notes**: Kliknięcie w polisę filtruje oś czasu tylko do zdarzeń związanych z tym produktem.

## 4. Filtracja Logów Systemowych (Clean History)
Ze względu na dużą ilość automatycznych logów (`[SYSTEM] Zmiana etapu`, `[AUDYT]`), Oś Czasu posiada dwa tryby widoku:

### A. Tryb Domyślny (User Focus)
- **Ukryte:** Wszystkie notatki systemowe, zmiany statusów i logi audytowe.
- **Widoczne:** Tylko notatki napisane ręcznie przez Agenta oraz przypomnienia.
- **Cel:** Czytelność historii relacji z klientem bez szumu technicznego.

### B. Tryb Audytowy (Toggle "Oko")
- Aktywowany przyciskiem w nagłówku osi czasu.
- Wyświetla pełną historię, w tym logi systemowe.
- **Wygląd Logów:** Logi systemowe są renderowane w formie **kompaktowej** (mały font, szary kolor, brak karty), aby wizualnie odróżniały się od notatek merytorycznych.
