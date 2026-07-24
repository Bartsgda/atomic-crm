
# Specyfikacja: Notatki i Oś Czasu (Notes Module v2.3)

> **Zmiana 2026-07-24 (uwagi Aliny):** usunięto tryb rozmowy (START/KONIEC + godziny)
> oraz przyciski szybkiego statusu (OK/W TOKU/ODRZUT). Notatka to teraz proste
> notowanie z wyborem daty; status zmienia się bezpośrednio w polisie.

**Powiązane pliki:**
- `components/Notatki.tsx`
- `components/ClientDetails.tsx` (Parent)
- `components/NoteTagRenderer.tsx`
- `components/Dashboard.tsx`

## 1. Definicja Notatki
Notatka to podstawowa jednostka interakcji z klientem.
- **Pola**: `content`, `tag`, `reminderDate`, `linkedPolicyIds` (tablica powiązań), `createdAt` (data — wybieralna), `history` (edycje).
- **Data (`createdAt`)**: domyślnie dziś, ale Alina może ją zmienić przy tworzeniu (notuje po fakcie) — pole daty w toolbarze edytora. **Bez godziny/minut** (usunięte razem z trybem rozmowy — nie ma już sytuacji z timerem połączenia).

## 2. Context Awareness (Świadomość Kontekstu)
Komponent notatek w `ClientDetails` jest świadomy tego, co robi użytkownik.
- **Active Policy ID:** Jeśli użytkownik kliknął w kartę polisy (filtrowanie), ID tej polisy jest przekazywane do komponentu notatek (`activePolicyId`).
- **Auto-Linking:** Każda nowa notatka utworzona w tym trybie automatycznie otrzymuje `linkedPolicyIds` ustawione na wybraną polisę.
- **Widoczny wskaźnik (2026-07-24):** gdy obiekt jest wybrany, w oknie notatki wyświetla się **„Notatka do: HYUNDAI GD123…"** — Alina wie do czego pisze. Gdy nic nie wybrane → notatka luźna (bez przypisania). Przykład: klik „Dom" z prawej → notatka podpina się do Dom, ze wskaźnikiem.

## 3. Toolbar edytora (bez statusów)
Nad polem tekstowym — **zawsze dostępne** akcje + data:
- **+Auto / +Dom** — szybkie utworzenie oferty (otwiera `PolicyFormModal`, podpina do notatki).
- **Asystent** — `QuickInterviewWidget` (podpowiedzi wywiadu).
- **Data rozmowy** — kalendarz (`<input type="date">`, domyślnie dziś).

> **USUNIĘTE 2026-07-24:** przyciski **OK / W TOKU / ODRZUT** oraz tryb rozmowy (START ROZMOWY / KONIEC). Powód (Alina): status polisy zmienia się przez wejście w konkretną polisę, nie z poziomu notatki. Automatyczne wykrywanie z treści (`[ST:]`, „za drogo", „konkurencja", „URWANY KONTAKT" → chłodnia) pozostaje (`handleAutomatedStatusChange`, `handleGhostContact`).

## 4. Cross-Linking (podpięcie obiektu — `#` / ikona Hash)
- Klik ikony **Hash** (albo `#` w treści) rozwija **listę polis/pojazdów klienta** do podpięcia.
- Klik pozycji → dodaje ID do `pendingPolicyLinks` (→ `linkedPolicyIds` przy zapisie), podświetla podpięte, „Zamknij" chowa listę.
- Brak polis u klienta → komunikat zamiast pustej listy.
- Odpięcie: przez „✕" we wskaźniku „Notatka do:" (czyści podpięcia).

## 5. Edycja notatki
Tryb edycji (ikona ołówka na karcie notatki) pozwala zmienić:
- **Treść** (textarea; poprzednia wersja trafia do `history`).
- **Data** (pole „Data:" — kalendarz, aktualizuje `createdAt`).
- **Przypisany obiekt** (kafelki „Przypisz do:" — **multi-select**; rozmowa może dotyczyć kilku aut). Przepięcie zapisuje nowe `linkedPolicyIds`.

## 6. Karta produktu — licznik rozmów (ClientDetails)
- Każda karta polisy/pojazdu pokazuje **badge z liczbą rozmów** dotyczących tego obiektu (liczone z `notes.linkedPolicyIds ∋ policy.id`, pełny zbiór — nie filtrowany). Np. auto A: 7, auto B: 2, auto C: 0 (badge ukryty przy 0).
- **Wejście w klienta:** żadna karta nie jest domyślnie podświetlona (`productNavIdx = -1`) — widać wszystkie rozmowy klienta.

## 7. Wygląd i UX (Clean View Protocol)
- **Formatowanie:** Tekst notatki obsługuje proste tagi renderowane jako kolorowe „pastylki" (`NoteTagRenderer`).
- **Filtr Popover (Dashboard/Kanban):** Dymki podglądu (Hover) **MUSZĄ** ukrywać notatki techniczne (`[SYSTEM]`, `AUDYT`, `STATUS`), pokazując tylko wpisy ręczne Agenta.
- **Filtr Listy (Clients List):** Kolumna „Ostatnia notatka" w tabeli klientów również pomija logi systemowe, prezentując ostatnią merytoryczną interakcję.
