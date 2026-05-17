
# 🐍 Python Backend Roadmap (Drogowiec)

## ✅ Faza 1: Fundamenty (ZROBIONE)
- [x] Struktura katalogów.
- [x] Modele danych (Pydantic) zgodne z `types.ts`.
- [x] Narzędzia walutowe i słowniki.
- [x] Parser Regex (`LegacyParser`) dla aut.
- [x] Silnik Prowizyjny (`CommissionEngine`).

## 🚧 Faza 2: Serwisy Danych (DO ZROBIENIA)
- [ ] **DataMapper Class:** Pełna implementacja logiki z `dataMapper.ts` (parsowanie wierszy Excela).
- [ ] **Excel Service:** Obsługa biblioteki `pandas` / `openpyxl` do odczytu i zapisu plików `.xlsx` w formacie zgodnym z `XLSX_MAPPING.md`.
- [ ] **Storage JSON:** Implementacja prostego zapisu/odczytu stanu (`AppState`) do pliku JSON (odpowiednik `localStorage`).

## 🔮 Faza 3: AI & API (Backend)
- [ ] **FastAPI Setup:** Utworzenie serwera API (`main.py`).
- [ ] **Endpoints:** `/upload`, `/calculate`, `/clients`.
- [ ] **Gemini Integration:** Przeniesienie `GeminiService` na backend (ukrycie klucza API, lepsza kontrola promptów).
- [ ] **LMM Analysis:** Analiza skanów dokumentów (OCR) przy użyciu Gemini Pro Vision.

## 🧪 Testowanie
- [ ] Unit testy dla `LegacyParser` (sprawdzenie regexów na przykładach z `legacy/*.ts`).
- [ ] Unit testy dla `CommissionEngine` (matematyka finansowa).
