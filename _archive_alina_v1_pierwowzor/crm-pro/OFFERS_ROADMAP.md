
# Roadmapa: Moduł Ofert (Offers Command Center)

## Faza 1: MVP (Obecna Implementacja)
- [x] Utworzenie nowego typu statusu `oferta_wysłana`.
- [x] Widok tablicy Kanban (Kolumny: Do Zrobienia, W Trakcie, Wysłane, Decyzja).
- [x] Filtrowanie polis z bazy, które nie są jeszcze sprzedane.
- [x] Wyświetlanie kontekstu z ostatnich notatek na karcie oferty (np. wzmianki o Warcie/Allianz).
- [x] Możliwość szybkiej zmiany statusu z poziomu karty.

## Faza 2: Multi-Kalkulacja (Planowane Q2 2025)
- [ ] **Sub-tabela Kalkulacji:** Dodanie do obiektu `Policy` tablicy `calculations: { insurer: string, premium: number, status: string }[]`.
- [ ] **Porównywarka UI:** Widok tabelaryczny wewnątrz karty oferty pozwalający wpisać składki z 3-4 towarzystw obok siebie.
- [ ] **Generator PDF Ofert:** Generowanie prostego pliku PDF z porównaniem składek dla klienta (Warta vs Hestia vs PZU).

## Faza 3: Automatyzacja (Planowane Q3 2025)
- [ ] **Auto-Status:** Jeśli wyślesz maila z systemu, status oferty automatycznie zmieni się na `oferta_wysłana`.
- [ ] **Follow-up Bot:** System sugeruje wysłanie SMS "Czy zapoznał się Pan z ofertą?" po 2 dniach od wysłania, jeśli status się nie zmienił.
- [ ] **Integracja API:** (Opcjonalne) Pobieranie statusów szkód/zniżek z UFG (wymaga zewnętrznych integracji).
