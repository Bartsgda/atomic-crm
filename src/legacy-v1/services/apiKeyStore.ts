/**
 * Runtime store klucza Gemini API — CRM-ALINA.
 *
 * ARCHITEKTURA (Bartek 2026-07-24): klucz API NIE trafia do bundla (byłby publiczny).
 * Jest przechowywany ZASZYFROWANY tym samym DEK co dane klientów (tenant_keys.encrypted_api_key)
 * i odszyfrowywany client-side dopiero gdy Alina poda hasło aplikacji (PassphraseGate → DEK →
 * decryptField → apiKeyStore.set). Klucz żyje TYLKO w pamięci sesji przeglądarki — nigdy w
 * localStorage, nigdy w buildzie. Czyszczony przy lock/logout (razem z DEK).
 *
 * Dev (localhost, START_ALINA_TEST): fallback do process.env.API_KEY z .env (vite.config define).
 * Produkcja: process.env.API_KEY pusty → używany wyłącznie klucz odszyfrowany z DEK.
 */

let _apiKey: string | null = null;

export const apiKeyStore = {
  /** Ustaw klucz odszyfrowany DEK-iem (wywoływane z PassphraseGate po unlock). */
  set(key: string | null): void {
    _apiKey = key && key.trim() ? key.trim() : null;
  },

  /** Pobierz klucz: runtime (odszyfrowany) lub — tylko w dev — fallback z .env. */
  get(): string | null {
    if (_apiKey) return _apiKey;
    try {
      // Dev fallback (.env → vite define). Na produkcji puste → zwraca null.
      if (
        typeof process !== "undefined" &&
        process.env &&
        process.env.API_KEY
      ) {
        return process.env.API_KEY;
      }
    } catch {
      /* process niedostępny — ignoruj */
    }
    return null;
  },

  /** Czyść klucz z pamięci (lock/logout — razem z DEK). */
  clear(): void {
    _apiKey = null;
  },
};
