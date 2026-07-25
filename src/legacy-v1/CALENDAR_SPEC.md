
# Specyfikacja: Terminarz (Calendar Module v2.0)

**Powiązane pliki:**
- `components/CalendarView.tsx`

## 1. Źródła Danych (Agregacja)

### A. Wznowienia (Renewals) - Rozróżnienie Statusu
System musi wizualnie odróżniać koniec ochrony polisy, którą obsługujemy ("Sprzedaż"), od wygaśnięcia ofert lub leadów ("Potencjalne").
1.  **Polisa Sprzedana:**
    *   Styl (od 2026-07-25, redesign kolorystyki — patrz § 4 niżej): **Czerwony/różowy TYLKO gdy realnie pilne** (data końca = dziś lub już po terminie). Dla wznowień w przyszłości (poza dniem dzisiejszym) — spokojne neutralne tło + lewy akcent w kolorze motywu (`border-primary`), bez czerwieni.
    *   Znaczenie: Klient traci ochronę, TRZEBA zadzwonić — ale sygnał "alarmowy" (czerwień) zarezerwowany dla naprawdę bliskiego/minionego terminu, nie dla każdego wznowienia w kalendarzu.
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

## 4. Redesign kolorystyki i czcionek (2026-07-25)

Zgłoszenie: ekran wyglądał "nachalnie czerwono" i był nieczytelny na laptopie 14" — nazwiska klientów praktycznie niewidoczne. Zmiana WYŁĄCZNIE wizualna (`components/CalendarView.tsx`), logika eventów/nawigacji/powiązań z polisami i przypomnieniami niezmieniona.

**Kolorystyka — czerwień jako akcent, nie tło:**
- Reguła pilności: event jest "pilny" gdy `isBefore(event.date, startOfToday) || isSameDay(event.date, today)` (dziś lub po terminie) — helper `isEventUrgent()` w `CalendarView.tsx`.
- Wznowienia sprzedanych polis: pilne → `rose-50/500` akcent (jak dotąd); **nie-pilne (przyszłość) → neutralne białe/zinc tło + `border-primary`** (kolor akcentu aktywnego motywu, nie czerwień).
- Element "Dziś" w siatce (kółko z numerem dnia, tło komórki w widoku miesiąc/tydzień/dzień) — był na sztywno czerwony niezależnie od pilności (to nie miało nic wspólnego z terminami, tylko z nawigacją). Zmienione na `bg-primary`/neutralny `zinc` tint — "dziś" to wskazanie nawigacyjne, nie alarm.
- Nagłówek "Terminarz", przycisk "Dzisiaj", ikona w modalu "Szybkie Zadanie", focus ring textarea — to była dekoracja/branding, nie sygnalizacja pilności. Zmienione na `text-primary`/`focus:ring-primary` (spójne z resztą app, `DESIGN_SYSTEM.md` § "Prawo Jednego Inputa").
- Imieniny (name-day) — zmienione z `rose-400` na neutralny `zinc-400 italic` (to ciekawostka, nie alarm; rose kolidowało wizualnie z prawdziwymi alertami).
- Sekcja "Zaległe" w Agendzie i popover na hover — czerwień/rose zostają (to naprawdę przeterminowane/dzisiejsze pozycje), tylko dodano warianty `dark:`.

**Czytelność — priorytet: nazwisko klienta:**
- Bug znaleziony przy audycie: w karcie "Plan na dziś" tekst renderował `e.details || e.clientName` — `details` jest prawie zawsze ustawione (np. "Koniec ochrony"), więc `clientName` **nigdy się nie wyświetlał**. To główny powód "nie widać klientów zupełnie". Naprawione — nazwisko klienta ma teraz zawsze własną, pogrubioną linię (`text-sm font-black`) nad tytułem/detalami.
- To samo dot. widoku dnia i sekcji "Następne" (Upcoming) — dodano widoczne nazwisko klienta (wcześniej pokazywały tylko `title`, czyli dane pojazdu/adresu, bez identyfikacji klienta).
- Kafelki dnia w siatce miesiąca/tygodnia (`renderEventBadge`) — czcionka `text-[8px]` → `text-[10-11px]`; dla wznowień/kalkulacji z przypisanym klientem dodano pogrubiony prefiks nazwiska przed tytułem.
- Sekcja "Zaległe" — nazwisko klienta stało się główną (największą) linią karty, tytuł zdarzenia przesunięty niżej jako drugorzędny.
