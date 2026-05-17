
# Dokumentacja Importu XLSX (Excel)

## 1. Model Hybrydowy (Legacy + System)
Nasz system stosuje podejście hybrydowe.
1.  **Import:** Potrafi "przeczytać" stary, ludzki format Excela (23 kolumny) i zamienić go na bogatą strukturę danych w aplikacji (obiekty, tablice, relacje).
2.  **Eksport:** Generuje plik Excel, który zawiera zarówno stare kolumny (dla czytelności Agenta), jak i ukryte kolumny systemowe (JSON), co pozwala na pełny backup bez utraty danych.

## 2. Struktura Kolumn (Klucz Mapowania)
System oczekuje następującego układu kolumn (licząc od A=0). Wszystkie kolumny są importowane.

| Indeks | Nazwa w Excelu | Mapowanie w CRM | Opis |
|:---:|:---|:---|:---|
| **0** | Imię i nazwisko | `firstName` / `lastName` | Dane klienta lub nazwa firmy. |
| **1** | kontakt / sprzedaż | `createdAt` | Data utworzenia rekordu. |
| **2** | etap | `stage` | Status polisy (lejek sprzedażowy). |
| **3** | kol kont | `nextContactDate` | Data przypomnienia / kolejnego kontaktu. |
| **4** | nr tel | `phones[0]` | Główny numer telefonu. |
| **5** | @ | `emails[0]` | Główny e-mail. |
| **6** | adres | `street`, `city`, `zipCode` | Adres korespondencyjny. |
| **7** | pesel nip regon | `pesel` / `businesses` | Identyfikator (PESEL dla osoby, NIP dla firmy). |
| **8** | co | `vehicleBrand` / `type` | Kluczowy ciąg produktowy (Auto/Dom/Podróż). |
| **9** | start polisy | `policyStartDate` | Początek okresu ochrony. |
| **10** | nr pol | `policyNumber` | Numer polisy. |
| **11** | gdzie | `insurerName` | Towarzystwo Ubezpieczeniowe. |
| **12** | przyp | `premium` | Składka roczna (PLN). |
| **13** | kogo | `subAgent` | Źródło (Pośrednik). |
| **14** | prow | `commission` | Prowizja Agenta (PLN). |
| **15** | rozl | `subAgentCommission` | Rozliczenie z pośrednikiem (PLN). |
| **16** | stara składka | `oldPremium` | Informacyjnie. |
| **17** | stara polisa | `oldPolicyNumber` | Oraz wartość pojazdu (SU) i stare TU. |
| **18** | współwł. | `coOwners` | Współwłaściciele, Leasingi, Cesje. |
| **19** | not | `notes` | Notatki (rozdzielane `_`). |
| **20** | dok | `documentsStatus` | Status dokumentów (np. braki). |
| **21** | załączono | `portalStatus` | Czy wgrano do systemu TU. |
| **22** | płatność | `paymentStatus` | Status płatności (Opłacona/Nie). |

## 3. Logika Procesu
1.  **Deduplikacja:** System sprawdza, czy klient o danym nr PESEL/NIP już istnieje. Jeśli tak, przypisuje nową polisę do istniejącego rekordu zamiast tworzyć duplikat.
2.  **Rozpoznawanie Typu:** Na podstawie kolumny "co" system automatycznie przypisuje kategorię (Pojazd, Dom, Życie, Firma, Podróż).
3.  **Parsowanie Detali:** Z kolumn tekstowych (17, 18) wyciągane są dane strukturalne (Wartość pojazdu, Leasingodawca, Cesja Bankowa).
