# Audit Report — 182 polis (102 issues)

**Verdicts:** {'WARN': 74, 'ERROR': 20, 'OK': 88}
**Severity:** {'WARN': 80, 'ERROR': 22}

## Top fields z issues

- `policy.home_details`: **19**
- `coOwners`: **16**
- `notes`: **11**
- `policy.auto_details`: **9**
- `policy.vehicle_brand`: **8**
- `policy.vehicle_reg`: **5**
- `policy.type`: **5**
- `client.name`: **4**
- `home_details`: **4**
- `policy.travel_details`: **4**
- `policy.stage`: **3**
- `policy.vehicle_model`: **3**
- `policy.life_details`: **2**
- `policy.home_details.su`: **2**
- `policy.firma_details`: **1**

## Issues (top 20 ERROR)


### row 2 (ERROR)
- **ERROR** `policy.type`: Brak typu polisy w kolumnie 'co' (wartość '?').
  - Fix: _Ustal typ polisy z klientem i uzupełnij dane._

### row 5 (ERROR)
- **ERROR** `coOwners`: PESEL klienta błędnie zinterpretowany jako współwłaściciel (wsp: 'pesel kl 86080119155').
  - Fix: _Usuń błędny wpis z coOwners i przenieś PESEL do profilu klienta._

### row 9 (ERROR)
- **ERROR** `client.name`: Klient zidentyfikowany jako 'Dominika (brak nazwiska)', co utrudnia procesowanie polisy.
  - Fix: _Wymagane ręczne uzupełnienie nazwiska klienta w bazie._
- **ERROR** `policy.auto_details`: Brak danych dla 3 samochodów wspomnianych w notatkach.
  - Fix: _Dodać brakujące pojazdy do bazy lub wyjaśnić z klientem._

### row 29 (ERROR)
- **ERROR** `client.name`: Klient zapisany jako 'Mariusz (brak nazwiska)'.
  - Fix: _Uzupełnić nazwisko klienta w bazie._
- **WARN** `policy.home_details`: Typ nieruchomości nieokreślony (dom vs mieszkanie) w XLSX.
  - Fix: _Doprecyzować typ nieruchomości przy kolejnym kontakcie._

### row 40 (ERROR)
- **ERROR** `client.name`: Klient posiada tylko imię 'Agnieszka', brak nazwiska w bazie.
  - Fix: _Uzupełnić nazwisko klienta w bazie danych._
- **ERROR** `policy.vehicle_reg`: Brak danych pojazdu (marka, model, rejestracja) mimo że polisa dotyczy samochodu.
  - Fix: _Skontaktować się z klientem w celu pozyskania danych pojazdu._

### row 49 (ERROR)
- **ERROR** `policy.vehicle_reg`: Tablica rejestracyjna 'G3EF' jest nieprawidłowa (zbyt krótka)
  - Fix: _Zweryfikować poprawność numeru rejestracyjnego w dokumentach polisy_

### row 77 (ERROR)
- **ERROR** `coOwners`: PESEL klienta (86080119155) został błędnie zaciągnięty do pola coOwnera (PKO Leasing).
  - Fix: _Usuń PESEL z pola nazwy coOwnera i sprawdź, czy klient nie powinien być powiązany z tym PESELem w bazie._

### row 82 (ERROR)
- **ERROR** `coOwners`: PESEL of the client was incorrectly mapped as a coOwner.
  - Fix: _Remove the entry from coOwners and ensure the PESEL is stored in the client's profile._

### row 85 (ERROR)
- **ERROR** `notes`: Note created_at date (2024-08-04) is chronologically inconsistent with the policy creation date (2025-08-04).
  - Fix: _Verify if the note date is a typo or if the policy was backdated._

### row 116 (ERROR)
- **ERROR** `coOwners`: Tekst z kolumny 'wsp' (informacje o rezygnacji) został błędnie zinterpretowany jako współwłaściciele.
  - Fix: _Wyczyść tablicę coOwners i przenieś informacje o rezygnacji do notatek._

### row 119 (ERROR)
- **ERROR** `policy.type`: Typ polisy ustawiony na DOM, podczas gdy notatka sugeruje ubezpieczenie auta.
  - Fix: _Zmień typ polisy na KOMUNIKACJA lub inny właściwy dla auta._
- **WARN** `client.name`: Brak nazwiska klienta w bazie.
  - Fix: _Uzupełnij nazwisko klienta._

### row 124 (ERROR)
- **ERROR** `coOwners`: Błędne zmapowanie starej polisy jako współwłaściciela (coOwner).
  - Fix: _Usuń 'stara uniqa 2864320336' z listy współwłaścicieli._
- **WARN** `notes`: Polisa oznaczona jako 'rez po ofercie', ale notatka wskazuje na rezygnację klienta.
  - Fix: _Zmień etap polisy na 'rezygnacja'._

### row 128 (ERROR)
- **ERROR** `policy.home_details.su`: Brak sumy ubezpieczenia (SU) w bazie, mimo że w notatce wspomniano o poprzedniej polisie 100 tys.
  - Fix: _Uzupełnić pole SU w bazie na podstawie informacji o wartości rzeczywistej lub poprzedniej polisy._

### row 133 (ERROR)
- **ERROR** `policy.created_at`: Data utworzenia polisy (08.10.2025) jest wcześniejsza niż data notatki o podpisaniu polisy (10.10.2025) i rozmowie o wypowiedzeniu (21.11.2025).
  - Fix: _Skorygować datę created_at w bazie na 10.10.2025._

### row 140 (ERROR)
- **ERROR** `notes`: Chronology error: Note created_at is 2026-11-26, which is in the future relative to policy creation (2025-11-26).
  - Fix: _Correct the date of the note to 2025-11-26._
- **WARN** `firma_details`: Missing SU (Suma Ubezpieczenia) in database.
  - Fix: _Update policy details with the insured sum._

### row 147 (ERROR)
- **ERROR** `policy.stage`: Polisa oznaczona jako 'sprzedaż' w bazie, podczas gdy notatki wskazują na rezygnację klienta ('klientka na pewno wybrała gdzie indziej').
  - Fix: _Zmień status polisy na 'rezygnacja' lub 'archiwum'._

### row 154 (ERROR)
- **ERROR** `policy`: Polisa zawiera dwa różne produkty (samochód + dom) w jednym wierszu, co utrudnia poprawne mapowanie.
  - Fix: _Rozdzielić na dwa osobne rekordy w bazie danych._

### row 164 (ERROR)
- **ERROR** `policy.vehicle_model`: Vehicle model is missing in database, although it is a standard Volkswagen model.
  - Fix: _Manually identify and fill the vehicle model field._
- **WARN** `policy.auto_details.fuel`: Fuel type missing in database.
  - Fix: _Update fuel type based on vehicle registration data._

### row 169 (ERROR)
- **ERROR** `notes`: Notatka wskazuje na rezygnację z polisy (podwójne ubezpieczenie, zakup w PZU), ale polisa w bazie nadal widnieje jako aktywna sprzedaż.
  - Fix: _Zmienić status polisy na 'anulowana' lub 'zrezygnowano' zgodnie z notatką._

### row 173 (ERROR)
- **ERROR** `notes`: Identical note content as row 172 suggests a copy-paste error.
  - Fix: _Verify if this is a duplicate entry or if the note content is incorrect for Daniel Mikusik._
- **WARN** `policy.travel_details`: Missing travel dates and number of persons.
  - Fix: _Update travel_details with correct dates and person count._