
# 🔄 Reverse Architecture: Hybrid Excel Export v2.0

## 1. Filozofia "Trojan Horse" (Koń Trojański)
Plik XLSX generowany przez system pełni dwie funkcje jednocześnie:
1.  **Dla Człowieka (Legacy View):** Kolumny 0-22 wyglądają DOKŁADNIE tak, jak stary plik Agenta. Zachowujemy konwencję łączenia tekstów znakiem `_` oraz specyficzne formatowanie dat.
2.  **Dla Systemu (Hidden Data):** Kolumny 30+ zawierają surowe dane JSON, ID i metadane. To jest **pełny backup** stanu polisy.

## 2. Strefa A: Legacy View (Kolumny 0-22) - Human Readable
To jest strefa wizualna. Dane są "spłaszczane" i formatowane, aby były czytelne dla Agenta przyzwyczajonego do starego Excela.

| Col | Nazwa | Logika Generowania (Reverse Engineering) |
|:---|:---|:---|
| 2 | **etap** | Mapowanie statusów systemowych na słowa kluczowe Agenta:<br>- `sprzedaż` -> `sprzedaż`<br>- `of_do zrobienia` -> `of_do zrobienia`<br>- `przeł kontakt` -> `przeł kontakt`<br>- `oferta_wysłana` -> `of_przedst` (Mapping zwrotny)<br>- `ucięty kontakt` -> `ucięty kontakt` |
| 8 | **co (produkt)** | **Agregacja Danych Technicznych.** System skleja obiekt `autoDetails` lub `homeDetails` w string:<br>- Auto: `samochód_[NR_REJ]_[MARKA] [MODEL] [ROK] [SILNIK]`<br>- Dom: `dom_[ULICA] [MIASTO] [KONSTRUKCJA]`<br>- Podróż: `podróż_[KRAJ]_[DNI]` |
| 14 | **prow (agent)** | Kwota z pola `policy.commission`. |
| 15 | **rozl (pośrednik)** | Suma wszystkich kwot z tablicy `policy.subAgentSplits`. |
| 19 | **notatki** | Wszystkie notatki powiązane z polisą są sortowane chronologicznie i łączone znakiem `_`.<br>Format: `[DATA] [TAG] Treść notatki` |

## 3. Strefa B: System Data (Kolumny 30+) - Machine Readable
To jest "cyfrowy bliźniak" rekordu. Pozwala na bezstratny import powrotny do CRM. Te kolumny są "niewidoczne" dla logiki legacy, ale kluczowe dla `DataImporter`.

| Col | Klucz Systemowy | Zawartość (JSON / Raw) | Znaczenie |
|:---|:---|:---|:---|
| 30 | `SYS_CLIENT_ID` | String (UUID) | Identyfikator relacyjny klienta. |
| 31 | `SYS_POLICY_ID` | String (UUID) | Unikalne ID polisy (kluczowe dla aktualizacji). |
| 32 | `SYS_FULL_CLIENT` | JSON Object | Pełny zrzut obiektu `Client`. Zawiera tablicę `businesses` (NIP, REGON), wszystkie telefony i zgody RODO. |
| 33 | `SYS_FULL_POLICY` | JSON Object | **Najważniejsza kolumna.** Zawiera zagnieżdżone obiekty: `autoDetails` (VIN, pojemność, warianty AC), `homeDetails` (cesje, sumy murów), `subAgentSplits` (lista pośredników), `checklist` (status dokumentów). |
| 34 | `SYS_FULL_NOTES` | JSON Array | Tablica obiektów `ClientNote`. Zachowuje metadane: `reminderDate`, `tag`, `linkedPolicyIds`, `history`. |

## 4. Przykład Transformacji (Produkt)

**Obiekt w Systemie (Nowy Model):**
```json
{
  "type": "OC",
  "vehicleBrand": "Toyota",
  "vehicleModel": "Yaris",
  "vehicleReg": "GD 12345",
  "autoDetails": {
      "productionYear": "2020",
      "engineCapacity": "1500",
      "fuelType": "HYBRYDA"
  }
}
```

**Eksport do Excela:**
- **Kolumna 8 (Legacy):** `samochód_GD 12345_Toyota Yaris 2020 1500 HYBRYDA`
- **Kolumna 33 (System):** `{"type":"OC","vehicleBrand":"Toyota",...}` (Pełny JSON)
