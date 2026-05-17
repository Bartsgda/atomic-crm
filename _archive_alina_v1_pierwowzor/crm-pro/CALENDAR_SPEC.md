
# Specyfikacja: Terminarz (Calendar Module v2.0)

**Powiązane pliki:**
- `components/CalendarView.tsx`

## 1. Źródła Danych (Agregacja)

### A. Wznowienia (Renewals) - Rozróżnienie Statusu
System musi wizualnie odróżniać koniec ochrony polisy, którą obsługujemy ("Sprzedaż"), od wygaśnięcia ofert lub leadów ("Potencjalne").
1.  **Polisa Sprzedana (Priorytet):**
    *   Styl: Pełny kolor (Solid), np. Czerwony/Różowy.
    *   Znaczenie: Klient traci ochronę, TRZEBA zadzwonić.
2.  **Inne (Lead/Oferta/Chłodnia):**
    *   Styl: Obrys (Outline) lub wyszarzony, ikona "Ghost".
    *   Znaczenie: Warto zadzwonić, ale nie jest to krytyczne.

### B. Zadania (Tasks) - Parsowane z Notatek
*   Źródło: Notatki zawierające znacznik `[YYYY-MM-DD HH:mm]_PRZYPOMNIENIE_...`.
*   Styl: Niebieski (Zadanie) / Fioletowy (Spotkanie).

## 2. Agenda (Sidebar Prawy)

Sekcja boczna pełni rolę "Asystenta Dnia".

### Sekcja 1: Zaległe (Critical)
*   Wszystkie zadania i wznowienia sprzedażowe z datą < Dzisiaj.
*   Muszą być "odklikiwane" lub usuwane.

### Sekcja 2: Plan na Dziś (Focus)
*   Wszystko co ma datę = Dzisiaj.
*   Układ chronologiczny (od 08:00 do 20:00).

### Sekcja 3: Następne (Upcoming)
*   Zdarzenia z przyszłości (Jutro i dalej).
*   **Logika UI:** Wyświetla domyślnie tylko **3 najbliższe** zdarzenia.
*   **Interakcja:** Przycisk "Pokaż więcej (X)" rozwija listę.

## 3. Widoki Siatki
- **Miesiąc:** Widok ogólny.
- **Tydzień/Dzień:** Precyzyjny plan godzinowy.
- **Drag & Drop:** Przesunięcie klocka zmienia datę w treści notatki (zmienia string w bazie).
