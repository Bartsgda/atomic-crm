
# Specyfikacja Modułu: Centrum Dowodzenia Ofertami (Offers Board)

## 1. Cel Biznesowy
Stworzenie dedykowanego widoku do zarządzania procesem sprzedaży *przed* zawarciem polisy. 
Moduł ten ma rozwiązać problem "rozproszonej wiedzy" o tym, na jakim etapie jest kalkulacja u różnych ubezpieczycieli (np. Warta czeka na zdjęcie, Allianz wyliczony, Hestia za drogą).

## 2. Logika Przepływu (Workflow)
Oferty (Polisy w statusie innym niż "Sprzedaż" i "Rezygnacja") są wizualizowane na tablicy Kanban w czterech kolumnach:

### A. DO ZROBIENIA (Status: `of_do zrobienia`)
- **Definicja:** Nowy temat. Klient zgłosił potrzebę lub system przypomniał o wznowieniu, ale agent jeszcze nie usiadł do kalkulacji.
- **Akcja:** Kliknięcie w kartę otwiera szczegóły do wprowadzenia danych pojazdu/nieruchomości.

### B. W TRAKCIE / KALKULACJA (Status: `przeł kontakt`)
- **Definicja:** Proces ofertowania trwa.
- **Kluczowa funkcja: Multi-Status TU.** System musi pozwalać na szybkie notowanie statusów cząstkowych dla konkretnych Towarzystw (np. "Warta: brak PESEL", "Hestia: 1200zł").
- **Wizualizacja:** Na karcie wyświetlane są ostatnie notatki techniczne.

### C. OFERTA WYSŁANA (Status: `oferta_wysłana`)
- **Definicja:** Kalkulacje zakończone, mail/SMS wysłany do klienta. Piłeczka po stronie klienta.
- **Akcja:** Przycisk "Przypomnij klientowi" (SMS/Tel).

### D. DECYZJA / NEGOCJACJE (Statusy pochodne lub flagi)
- **Definicja:** Klient wrócił z informacją zwrotną (np. "Za drogo", "Chcę raty").
- **Cel:** Finalizacja sprzedaży (Przesunięcie do "Sprzedaż") lub zamkniecie jako "Rezygnacja".

## 3. Integracja Danych
- **Źródło:** Tabela `policies` filtrowana po polach `stage`.
- **Kontekst:** Każda karta oferty musi "zaciągać" ostatnie notatki z tabeli `notes` powiązane z tym klientem/polisą, aby Agent widział kontekst bez wchodzenia w szczegóły (np. "Klient prosił o wariant z holowaniem").

## 4. Wymagania UI/UX
- **Widok:** Kolumnowy (Kanban).
- **Karta Oferty:**
    - Imię Nazwisko Klienta.
    - Przedmiot (Auto/Dom).
    - Data startu ochrony (Kolor czerwony jeśli < 7 dni).
    - Badges (Tagi) wykryte w notatkach (np. "WARTA", "ALLIANZ").
- **Szybkie Akcje:**
    - Telefon (ikona słuchawki).
    - Notatka (ikona ołówka).
    - Zmiana etapu (przesuwanie lub dropdown).
