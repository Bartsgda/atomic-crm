
# Data Mapping Documentation (Excel -> CRM)

> **Aktualizacja:** 2026.02.08 (v6.2 Final Import Logic)

## 1. Struktura Kolumn (Import XLSX/CSV)

System oczekuje pliku z **23 kolumnami**. Poniżej kluczowe zmiany w interpretacji danych w wersji v6.2.

| Indeks | Nazwa w Excelu | Mapowanie | Uwagi (Deep Analysis) |
|:---:|:---|:---|:---|
| 8 | `CO` (Produkt) | `policy.type`, `originalProductString` | **Klucz podstawowy.** Poddawany procesowi "First Word Rule". |
| 19 | `NOT` (Notatki) | `notes[]` ORAZ `aiNote` | **Źródło kontekstu.** AI analizuje tę kolumnę, aby uzupełnić braki w kolumnie 8. |

## 2. Kluczowe Zasady Logiki (Immutable Rules)

### A. Zasada "First Word" (Odszumianie)
System ignoruje znaki interpunkcyjne (`?`, `.`, `,`) przyczepione do pierwszego słowa.
*   `dom?` jest traktowane jako `dom`.
*   `samochód_` jest traktowane jako `samochód`.

### B. Rozwidlenie "OC" (Auto vs Firma)
Prefiks `OC` nie oznacza automatycznie samochodu.
*   `OC` + słowa `działalności/zawodowe/przedsiębiorcy` = **FIRMA**.
*   `OC` (samo lub z marką auta) = **AUTO**.

### C. Priorytet Mapy (Hardcoded Map)
Jeśli ciąg tekstowy znajduje się w plikach `crm-pro/data/legacy/*.ts`, system **POMIJA** algorytm wykrywania i używa sztywnych danych z pliku (wraz z notatkami).

## 3. Logika Importu Notatek (Deep Context)
Wcześniej notatki były tylko tekstami w historii. Teraz pełnią funkcję **metadata layer**:
1.  **Ekstrakcja Cech:** Jeśli notatka zawiera "1.9 TDI", system uzupełnia pojemność i paliwo w polisie.
2.  **Wykrywanie Ryzyk:** Frazy typu "szkoda", "drogo", "leasing" wpływają na otagowanie polisy i klienta.

## 4. Wynik Mapowania
Dane z importu przechodzą przez `DataMapper.ts`, który jest ostatecznym arbitrem kategorii polisy.
