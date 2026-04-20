
# System Archiwizacji Danych (Backup JSON)

## 1. Cel
Zapewnienie bezpieczeństwa danych poprzez mechanizm pełnego eksportu i importu stanu aplikacji do pliku lokalnego. Ponieważ system działa w modelu "Local-First" (przeglądarka), regularne kopie są kluczowe przed wdrożeniem bazy danych chmurowej.

## 2. Format Danych
Plik eksportu to standardowy JSON o strukturze zgodnej z interfejsem `AppState`.

**Przykład struktury pliku:**
```json
{
  "clients": [
    {
      "id": "c_173000123",
      "firstName": "Jan",
      "lastName": "Kowalski",
      "pesel": "90010112345",
      "phone": "500600700",
      "type": "PERSON",
      ...
    }
  ],
  "policies": [
    {
      "id": "id_abc123",
      "clientId": "c_173000123",
      "type": "OC",
      "insurerName": "Warta",
      "premium": 1200,
      ...
    }
  ],
  "notes": [
    {
      "id": "note_xyz789",
      "clientId": "c_173000123",
      "content": "Klient prosi o kontakt po 16:00",
      "tag": "ROZMOWA",
      ...
    }
  ]
}
```

## 3. Procedura Backupu (Eksport)
1. Użytkownik klika "EKSPORT" w panelu bocznym.
2. System pobiera aktualny stan z `localStorage`.
3. Przeglądarka generuje plik z nazwą `crm_backup_YYYY-MM-DD_HH-mm.json`.
4. Plik jest zapisywany na dysku użytkownika.

## 4. Procedura Przywracania (Import)
1. Użytkownik klika "IMPORT".
2. System wyświetla ostrzeżenie: **"Wczytanie bazy NADPISZE wszystkie obecne dane"**.
3. Po potwierdzeniu, użytkownik wybiera plik `.json`.
4. System waliduje strukturę (sprawdza czy istnieją tablice `clients` i `policies`).
5. Dane w `localStorage` są podmieniane.
6. Aplikacja odświeża się automatycznie.

## 5. Koegzystencja z Importem CSV/Excel
System posiada teraz dwa niezależne kanały importu:
1. **Import CSV/XLSX (DataImporter):** Służy do zasilania bazy nowymi leadami/rekordami z zewnętrznych źródeł (np. starego systemu, plików od partnerów). Ten import **DODAJE** dane do istniejących (sprawdza duplikaty).
2. **Import JSON (BackupManager):** Służy do odtwarzania pełnego stanu systemu (np. na innym komputerze). Ten import **ZASTĘPUJE** (nadpisuje) dane.
