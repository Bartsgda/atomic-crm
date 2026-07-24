# Specyfikacja Techniczna: Profil Kontrahenta (Klient 360°)

## 1. Zasady Rozwoju Systemu (Developer Rules)
- **Dokumentacja najpierw**: Przy każdej zmianie logiki, w pierwszej kolejności aktualizuj ten plik (.md).
- **Zapis Danych**: Baza zapisywana jest w `localStorage` pod kluczem `InsuranceMaster_Core_V4_Final`.
- **Systemowe Daty**: Każdy nowy Klient i każda Polisa otrzymują `createdAt` z bieżącego czasu systemowego (`new Date().toISOString()`).
- **Bezpieczeństwo**: Kategoryczny zakaz przesyłania numeru PESEL do modeli AI.

## 2. Integralność Wypowiedzeń (Nowe Wymagania v3.5)
- **Identyfikator Wypowiedzenia**: Polisa przechowuje `terminationId`. Wypowiedzenie w rejestrze musi posiadać prefiks `wypow_`.
- **Zasada Potwierdzenia**: Usuwanie wypowiedzenia (zarówno z poziomu karty pojazdu, jak i rejestru) wymaga potwierdzenia akcji przełącznikiem bezpieczeństwa (Safety Switch).
- **Synchronizacja**: Usunięcie wypowiedzenia musi skutkować odznaczeniem statusu na powiązanym obiekcie (pojeździe/domu). 
- **Status Naprawy**: Błąd usuwania w rejestrze (brak odświeżania stanu) został naprawiony w v3.6.

## 3. Model Interakcji (Widok Listy)
- **Kolumny Tabeli**: 
    - **Osoba / Notatka**: Nazwisko, Imię + podgląd ostatniej notatki użytkownika.
    - **Ostatnia Aktywność**: Data ostatniego kontaktu/polisy/notatki.
    - **Kontakt & Firma**: Telefon, Mail, NIP/Nazwa firmy.
    - **Portfel**: Sprzedane polisy per typ produktu (badge: niebieski=pojazdy, zielony=dom, różowy=życie). Liczy tylko stage∈{sprzedaż, sprzedany, sprzedaz} (obie formy zapisu).
    - **W toku / Wznowienia**: Aktywne oferty (badge: czerwony/pomarańczowy) + polisy kończące się ≤30 dni (badge: szary/pomarańczowy/czerwony po terminie).
    - **Akcje**: Archiwizacja + przejście do profilu.

- **Nawigacja**: Kafelek "Klienci" w sidebarze (skin luxury-gold) → page="clients" (ClientsList.tsx). Domyślna strona po logowaniu = "clients".

- **Sortowanie**: Po Nazwisku, Ostatniej Aktywności, Portfelu (łączna liczba sprzedanych polis). Klikanie nagłówka kolumny zmienia kierunek (asc/desc).

## 4. Standard Bezpiecznego Usuwania (Safety First)
W celu uniknięcia przypadkowej utraty danych (szczególnie linków do skanów i historii rozmów), system zabrania używania standardowych okien przeglądarkowych.
- Każdy przycisk "Usuń" musi otwierać panel z **Przełącznikiem Bezpieczeństwa**.
- Przełącznik musi zostać przesunięty w pozycję "TAK", aby odblokować akcję niszczącą.
- Po wykonaniu akcji, widok musi zostać odświeżony bez konieczności przeładowania strony.

## 5. Profil Klienta — Produkty i Rozmowy (v3.7, 2026-07-24)
Zmiany po uwagach Aliny (`ClientDetails.tsx` + `Notatki.tsx`):
- **Wejście w profil = czysty widok:** żadna karta produktu nie jest domyślnie zaznaczona (`productNavIdx = -1`), więc od razu widać **wszystkie rozmowy** klienta. Filtr po obiekcie dopiero po kliknięciu karty (1× filtruje notatki, 2× otwiera edycję polisy).
- **Licznik rozmów na karcie produktu:** każda karta (pojazd/dom/…) ma **badge z liczbą rozmów** dotyczących tego obiektu (liczone z pełnego zbioru `notes.linkedPolicyIds ∋ policy.id`; ukryty przy 0). Np. auto A: 7, auto B: 2.
- **Notatki/rozmowy — pełna spec:** `NOTES_SPEC.md` (v2.3). Skrót istotnych zmian 2026-07-24:
    - Usunięto tryb rozmowy (START/KONIEC) i godziny w notatkach — notowanie z **wyborem daty** (kalendarz, domyślnie dziś).
    - Usunięto przyciski statusu OK/W TOKU/ODRZUT — status zmienia się w polisie, nie w notatce.
    - `#`/Hash rozwija listę pojazdów do **podpięcia obiektu**; wskaźnik „Notatka do: …" pokazuje do czego Alina pisze.
    - Edycja notatki: treść + **data** + **przypisanie obiektu** (multi-select „Przypisz do").