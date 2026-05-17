
# 🏺 Specyfikacja Danych Historycznych (Legacy Recognition v2.0)

> **Aktualizacja:** 2026.02.08
> **Wersja:** Deep Analysis (High IQ)

## 1. Cel i Filozofia
Plik `crm-pro/data/legacy_recognition.ts` nie jest już tylko "sztywną mapą". W wersji 2.0 stał się wynikiem **Głębokiej Analizy AI**, która łączy dane z kolumny produktowej z kontekstem ukrytym w notatkach.

## 2. Mechanizm "Deep Context"
System analizując rekordy nie traktuje ich izolowanie.
1.  **Produkt:** "samochód_G03V" (Brak danych).
2.  **Notatka:** "ubezp na męża kontakt... z Panią Aleksandrą".
3.  **Synteza (Wynik):** Rekord otrzymuje `aiNote`: *"Ubezpieczenie na męża, kontakt z żoną (Aleksandra)."*

## 3. Nowa Struktura Wpisu
W pliku `legacy_recognition.ts` obiekty posiadają rozszerzone pola analityczne:

```typescript
"DOKŁADNY_CIĄG_Z_EXCELA": {
    type: "OC" | "AC" | "DOM" | "PODROZ" | "FIRMA",
    // Podstawowe dane
    vehicleBrand: "Marka",
    vehicleReg: "Rejestracja",
    
    autoDetails: {
        // Dane techniczne
        engineCapacity: "1968",
        fuelType: "DIESEL", // Wnioskowane z TDI/HDI
        
        // NOWOŚĆ v2.0
        insuranceItems: "Skrzynia: Automat; Napęd: 4x4;", // Ustrukturyzowane cechy
        aiNote: "UWAGA: Gap w leasingu. Sprowadzony z USA." // Wnioski Agenta AI
    }
}
```

## 4. Kiedy dodawać wpis do Mapy?
Dodajemy wpis tutaj, gdy:
1.  **Kontekst jest w notatkach:** Dane techniczne lub marka znajdują się w kolumnie notatek, a nie w nazwie produktu.
2.  **Wykryto ryzyko:** AI zidentyfikowało anomalię (np. zaniżona suma ubezpieczenia).
3.  **Złożona Flota:** Rekordy typu "Flota 60 pojazdów", które wymagają ręcznego opisu w `aiNote`.

## 5. Status "Nieznana Marka"
Jeśli mimo analizy notatek nie udało się ustalić marki, system oznacza `vehicleBrand: 'Nieznana'` i generuje dyrektywę w `aiNote` o konieczności sprawdzenia w UFG.
