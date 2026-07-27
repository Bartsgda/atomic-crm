
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

### C. Szybkie Zadanie (Quick Add) — persystencja i @mention (2026-07-27)

**Bug naprawiony:** szybkie zadania (`saveQuickTask`, modal "Szybkie Zadanie") w ogóle nie pojawiały się w terminarzu po zapisie. Przyczyna: `ClientNote.clientId = 'SYSTEM_GLOBAL'` (sentinel dla zadań bez przypisanego klienta) był hashowany przez `toUUID()` w `noteToRow()` (`services/supabaseStorage.ts`) na losowo-wyglądający, ale **nieistniejący** UUID. Kolumna `policy_notes.client_id` ma FK do `insurance_clients(id)` — INSERT z takim UUID-em łamał klucz obcy i **failował po cichu** (Supabase JS nie rzuca wyjątku na błąd zapytania, zwraca `{error}` w odpowiedzi — kod go wcześniej w ogóle nie sprawdzał). Notatka nigdy nie trafiała do bazy, więc po `onRefresh()`/przeładowaniu po prostu nie istniała.

**Fix:** `noteToRow()` pisze `client_id: null` (kolumna jest nullable) gdy `clientId` to `'SYSTEM_GLOBAL'` lub puste — `v1_original_client_id` nadal zapisuje literalny string `'SYSTEM_GLOBAL'`, więc `rowToNote()` poprawnie go odtwarza po odczycie. `addNote`/`updateNote` dodatkowo logują błąd Supabase na konsolę (nie throw, żeby nie zmieniać istniejącego zachowania wołających) — taki błąd nie zniknie już bez śladu.

**@mention — podpięcie zadania do klienta:** w polu treści (Quick Add) wpisanie `@` + litery (np. `@wa`) otwiera podręczny dropdown klientów pasujących **nazwiskiem lub imieniem** (prefix, case-insensitive, max 8 wyników, alfabetycznie). Nawigacja strzałkami/Enter/Tab (wybiera), Escape (zamyka dropdown). Po wyborze: nazwisko wstawia się w treść (`@Nazwisko `), a prawdziwe `client.id` zapamiętywane jest osobno (`taskClientId`) i używane w `saveQuickTask` **zamiast** `SYSTEM_GLOBAL` — dzięki temu notatka trwale wiąże się z klientem (i przy okazji nie ma już problemu z FK, bo to prawdziwy istniejący klient). Zadanie bez `@mention` nadal zapisuje się jako `SYSTEM_GLOBAL` (zadanie "luźne"). Notatka z zadania terminarza widoczna jest potem w profilu klienta z wyraźnym oznaczeniem „Terminarz" — zob. `NOTES_SPEC.md`.

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

### Ręczna kolejność zadań — WIDOK DZIENNY (2026-07-27)

Lista wydarzeń w widoku dziennym (`renderDayView`) da się ręcznie przestawiać — strzałki **↑/↓** przy każdej pozycji (nie drag&drop).

- **Dlaczego strzałki, nie drag:** lista dnia już ma `draggable={!e.isSoldRenewal}` + `onDragStart` — TEN SAM mechanizm co przenoszenie wydarzeń MIĘDZY dniami (`handleDragStart`/`handleDropOnDay`, zmienia realną datę/`nextContactDate`). Dorzucenie drugiego, konkurencyjnego znaczenia do tego samego `draggable` (reorder w miejscu vs zmiana dnia) byłoby ryzykowne i niejednoznaczne dla użytkownika. Strzałki to osobny, równoległy mechanizm — zero kolizji, zero zmian w `handleDragStart`/`handleDropOnDay`/`draggable`.
- **Perzystencja:** `DayTaskOrder = Record<eventId, number>` (`types.ts`) w localStorage, klucz `InsuranceMaster_DayTaskOrder`, przez `storage.getDayTaskOrder()`/`saveDayTaskOrder()` (ten sam wzorzec co `getStatusOverrides` — **oba** providery, `services/storage.ts` i `services/supabaseStorage.ts`, ten drugi żywy w runtime). `eventId` jest już globalnie unikalny (id notatki / `end_<policyId>` / `calc_<policyId>`), więc mapa jest płaska (bez zagnieżdżenia po dacie).
- **Sortowanie (`sortDayEvents`):** wydarzenia z ustawionym `order` sortowane rosnąco wg `order`, reszta (bez `order`) sortowana po godzinie jak dotąd, doklejona NA KONIEC. Żadne wydarzenie nie "ginie" bez ręcznej kolejności.
- **Zapis przy kliknięciu strzałki (`moveDayTask`):** pierwsze użycie strzałki na dany dzień "zasiewa" `order` dla WSZYSTKICH wydarzeń tego dnia naraz (0..N-1, wg aktualnie widocznej kolejności) — kolejne kliknięcia tylko przestawiają w już zasianym zbiorze. Gwarantuje spójność bez dziur/kolizji numeracji.
- **Zakres:** dotyczy WYŁĄCZNIE listy widoku dziennego. Widok miesiąc/tydzień i Agenda boczna (§ 2) — sortowanie bez zmian (chronologiczne).
- **Renewals (koniec polisy):** reorder działa też na nich (mają realną datę, ale strzałki zmieniają TYLKO kolejność wyświetlania w liście — nie datę wydarzenia ani nic w polisie/`nextContactDate`).

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
