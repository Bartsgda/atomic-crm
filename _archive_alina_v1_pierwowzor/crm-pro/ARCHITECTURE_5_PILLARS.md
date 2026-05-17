
# 🏛️ ARCHITEKTURA 5 FILARÓW (The 5 Pillars of Truth)

> **STATUS:** OBOWIĄZUJĄCY
> **ZASADA:** W systemie istnieje tylko 5 miejsc, gdzie powstają dane. Każdy inny widok (Dashboard, Kalendarz) tylko CZYTA te dane.

---

## FILAR 1: KLIENT (`ClientFormModal.tsx`)
**Odpowiedzialność:** Tożsamość i B2B.
- **Specyfikacja:** `CLIENTS_SPEC.md`
- **Główne Pola:** Imię, Nazwisko, PESEL, Telefon (9 cyfr), Email, NIP (dla firm).
- **Relacje:** Jest rodzicem dla wszystkich polis. Usunięcie klienta = archiwizacja polis.

## FILAR 2: AUTO (`PolicyForms/AutoForm.tsx`)
**Odpowiedzialność:** Pojazdy Mechaniczne (OC/AC/NNW).
- **Specyfikacja:** `SPECS/MOD_AUTO.md`
- **Kluczowe Sekcje:**
    1. Identyfikacja (Rej, VIN, Marka).
    2. Dane Techniczne (Pojemność, Rok).
    3. Assistance (Holowanie, Auto Zastępcze).
    4. Autocasco (Wariant, Udział własny).

## FILAR 3: MAJĄTEK (`PolicyForms/HomeForm.tsx`)
**Odpowiedzialność:** Nieruchomości (Mury/Ruchomości).
- **Specyfikacja:** `SPECS/MOD_HOME.md`
- **Kluczowe Sekcje:**
    1. Adres i Typ (Dom/Mieszkanie).
    2. Konstrukcja i Zabezpieczenia.
    3. Sumy Ubezpieczenia (Mury, Stałe, Ruchomości).
    4. Cesja (Bank).

## FILAR 4: ŻYCIE (`PolicyForms/LifeForm.tsx`)
**Odpowiedzialność:** Zdrowie i Życie ludzkie.
- **Specyfikacja:** `SPECS/MOD_LIFE.md`
- **Kluczowe Sekcje:**
    1. Typ (Indywidualna/Grupowa).
    2. Sumy (Śmierć, Szpital, Poważne Zachorowanie).
    3. Compliance (Ankieta medyczna, Uposażeni).

## FILAR 5: PODRÓŻ (`PolicyForms/TravelForm.tsx`)
**Odpowiedzialność:** Wyjazdy zagraniczne.
- **Specyfikacja:** `SPECS/MOD_TRAVEL.md`
- **Kluczowe Sekcje:**
    1. Kierunek (Kraj, Strefa).
    2. Czas (Suwak dni).
    3. Ryzyka (Narty, Choroby Przewlekłe).
    4. Lista Uczestników.

---

## ZASADY UI DLA WSZYSTKICH FILARÓW
1. **Tryb Modalny:** Każdy formularz otwiera się w pełnym modalu (z tłem backdrop).
2. **Right Panel:** Prawa kolumna (na desktopie) ZAWSZE zawiera Finanse (Prowizja) i Compliance (Checklista). Jest to wspólne dla Filarów 2-5.
3. **Save Guard:** Przycisk "Zapisz" jest nieaktywny, jeśli walidacja `required` nie przechodzi.
