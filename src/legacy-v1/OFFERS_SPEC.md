
# Specyfikacja: Centrum Ofert (Offers Kanban v2.1)

**Powiązane pliki:**
- `components/OffersBoard.tsx`

## 1. Cel Modułu
Zarządzanie procesem sprzedaży *przed* wystawieniem polisy oraz wizualizacja dynamiki pracy Agenta.

## 2. Struktura Tablicy (Active Pipeline)
Tablica główna zajmuje górne 2/3 ekranu. Wyświetla tylko **AKTYWNE** tematy.

1.  **DO ZROBIENIA (`of_do zrobienia`)**:
    - Nowe tematy, wznowienia automatyczne.
    - **Badges**: "PO TERMINIE" (czerwony), "PILNE" (pomarańczowy).
2.  **W TOKU / KALKULACJA (`przeł kontakt`)**:
    - Tematy podjęte, w trakcie wyliczania.
3.  **CZEKAM NA DANE (`czekam na dane/dokum`)**:
    - Agent wysłał zapytanie o prawo jazdy/zdjęcia.
4.  **OFERTA WYSŁANA (`oferta_wysłana` / `of_przedst`)**:
    - Piłeczka po stronie klienta.

## 3. Strefy Decyzyjne (Drop Zones) - NOWOŚĆ v2.1
Podczas przeciągania karty (`onDragStart`), na dole ekranu (pomiędzy kolumnami a historią) pojawiają się dwie duże strefy zrzutu:
- **LEWA (Czerwona):** ODRZUĆ (`ucięty kontakt`).
- **PRAWA (Zielona):** SPRZEDAJ (`sprzedaż`).
Umożliwia to błyskawiczne zakończenie procesu bez celowania w konkretną kolumnę.

## 4. Automatyzacja (System Notes & Anti-Bounce)
Każda zmiana kolumny generuje **Notatkę Systemową** przypisaną do polisy i klienta.

- **Wyzwalacz:** Upuszczenie karty (Drop).
- **Akcja:** `storage.addNote()`
- **Format:** `[SYSTEM] Zmiana etapu: {Stary} -> {Nowy}`
- **Tag:** `STATUS`
- **Logic Anti-Bounce (60s):** System sprawdza czas ostatniej notatki systemowej dla danej polisy. Jeśli zmiana następuje szybciej niż 60 sekund od poprzedniej (np. pomyłka i cofnięcie karty), nowa notatka **NIE JEST GENEROWANA**. Zapobiega to zaśmiecaniu historii ("spam logów").

## 5. Strefa Historii (Bottom Deck)
Dolna 1/3 ekranu to log operacyjny ("Ostatnio Zakończone").
- Wyświetla karty, które trafiły do statusu `sprzedaż` lub `ucięty kontakt` w ciągu ostatnich 7 dni.
- Pozwala na szybkie cofnięcie decyzji (Drag & Drop z dołu do góry).

## 6. Funkcjonalności UX
- **Hover Popover:** Najechanie na kartę pokazuje dymek z ostatnimi notatkami.
- **Filtr Popovera:** Dymek ukrywa notatki techniczne (`[SYSTEM]`, `STATUS`) pokazując tylko wpisy ręczne Agenta ("mięso").
- **Celebracja:** Animacja przy sukcesie (Rocket/Party).
