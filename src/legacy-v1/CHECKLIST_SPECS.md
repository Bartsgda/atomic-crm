
# Specyfikacja: Inteligentne Listy Kontrolne (Smart Compliance Checklists v2)

> **STATUS:** WDROŻONO (v4.7)
> **ZMIANA FILOZOFII:** Przejście z modelu "Hardcoded Rules" na "User-Defined Templates".

## 1. Cel Biznesowy
Ujednolicenie procesu weryfikacji dokumentacji przy zawieraniu polis, przy jednoczesnym zachowaniu maksymalnej szybkości pracy Agenta (UX: Compact First) oraz elastyczności konfiguracji.

## 2. Interfejs Użytkownika (UI/UX)

### A. Widok Agenta (Compact Mode)
- **Zasada "Zero Scroll":** Checklista nie może zajmować więcej niż 15% wysokości ekranu modalu.
- **Komponenty:** Małe "pastylki" (Chips/Pills) zamiast dużych kart.
- **Grupowanie:**
    - **🔴 WYMAGANE (Critical):** Elementy blokujące (np. RODO, APK). Ikona trójkąta ostrzegawczego.
    - **⚪ OPCJE (Standard):** Elementy dodatkowe (np. Zdjęcia). Ikona tarczy.
- **Interakcja:** Kliknięcie zmienia stan (zielony = zrobione, szary/biały = do zrobienia).

### B. Tryb Konfiguracji (Agent Settings)
- Dostępny po kliknięciu ikony "Zębatki" przy nagłówku sekcji.
- Pozwala Agentowi na:
    - Dodawanie nowych pozycji do listy dla danej kategorii (np. "Oświadczenie sprawcy" dla OC).
    - Usuwanie istniejących pozycji.
    - Oznaczanie pozycji jako "Wymagane" (gwiazdka).
- Zmiany są zapisywane globalnie w `localStorage` i dotyczą wszystkich nowych polis tego typu.

## 3. Logika Danych (Data Model)

### Szablony (Templates)
Przechowywane w `AppState.checklistTemplates`.
```typescript
type ChecklistTemplates = Record<string, ChecklistItemDef[]>; // Klucz: Typ polisy (np. 'OC')

interface ChecklistItemDef {
    id: string;        // Unikalny ID (np. 'rodo_123')
    label: string;     // Wyświetlana nazwa
    isRequired: boolean; // Czy trafia do sekcji czerwonej?
}
```

### Zapis Polisy
W obiekcie `Policy` zapisywane są tylko stany (czy zrobione):
```typescript
checklist: Record<string, boolean>; // { 'rodo_123': true, 'apk_555': false }
```

## 4. Macierz Domyślna (Seed Data)
System startuje z następującą konfiguracją (którą Agent może zmienić):

| Kategoria | Pozycje Wymagane | Pozycje Opcjonalne |
|:---|:---|:---|
| **COMMON** | RODO, APK (IDD) | - |
| **OC** | Dowód Rejestracyjny | Prawo Jazdy, Historia UFG |
| **AC** | Zdjęcia (4 strony + VIN), 2 kpl. kluczyków, Dowód Rej. | - |
| **DOM** | Akt Notarialny / KW | Cesja (Bank) |
| **ŻYCIE** | Ankieta Medyczna, Uposażeni | - |
| **PODRÓŻ** | Zakres Terytorialny | - |

## 5. Przyszły Rozwój
- Blokada przycisku "Zapisz" jeśli sekcja "WYMAGANE" nie jest w całości na zielono (opcja w ustawieniach).
