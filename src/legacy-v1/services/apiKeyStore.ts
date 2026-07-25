/**
 * apiKeyStore — konfiguracja AI (klucze + modele) w pamięci sesji (CRM-ALINA).
 *
 * ARCHITEKTURA (Bartek 2026-07-24/25): klucze AI NIE są w bundlu ani w rrv-runtime frontu.
 * Cała konfiguracja (dowolna liczba kluczy: główny AI, OCR, itd. + model per zastosowanie)
 * jest zaszyfrowana DEK w public.tenant_config.encrypted_ai_config i odszyfrowywana
 * client-side po podaniu hasła aplikacji (PassphraseGate → apiKeyStore.setConfig).
 * Żyje tylko w pamięci sesji; czyszczona przy lock/logout.
 *
 * Zarządzana z panelu Ustawienia → „Klucze AI" (admin): dodawanie kluczy per przeznaczenie
 * + wybór modelu (Flash / Gemma / …). Zapis: encryptField(JSON, DEK) → tenant_config.
 *
 * Dev (localhost): fallback do process.env.API_KEY z .env dla purpose bez klucza.
 */

export interface AiKeyEntry {
  /** Przeznaczenie: "main" (czat/Karateka), "ocr" (skany), lub dowolne własne. */
  purpose: string;
  /** Opis dla UI (opcjonalny). */
  label?: string;
  /** Klucz API (Gemini/AI Studio). */
  key: string;
  /** Model dla tego przeznaczenia, np. "gemini-3.1-flash-lite", "gemma-3-27b-it". */
  model: string;
}

export interface AiConfig {
  keys: AiKeyEntry[];
}

export const DEFAULT_MODEL = "gemini-3.1-flash-lite";

/** Katalog modeli do wyboru w panelu (label → id). Rozszerzalny. */
export const MODEL_OPTIONS: { id: string; label: string }[] = [
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite (szybki, tani)",
  },
  { id: "gemini-3.1-flash", label: "Gemini 3.1 Flash" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (jakość)" },
  { id: "gemma-3-27b-it", label: "Gemma 3 27B" },
];

let _config: AiConfig = { keys: [] };

export const apiKeyStore = {
  /** Ustaw całą konfigurację (z PassphraseGate po odszyfrowaniu DEK). */
  setConfig(cfg: AiConfig | null): void {
    _config =
      cfg && Array.isArray(cfg.keys) ? { keys: cfg.keys } : { keys: [] };
  },

  /** Cała konfiguracja (do panelu Ustawień). */
  getConfig(): AiConfig {
    return { keys: [..._config.keys] };
  },

  /** Klucz dla przeznaczenia; fallback: pierwszy dostępny, potem .env (dev). */
  get(purpose = "main"): string | null {
    const exact = _config.keys.find((k) => k.purpose === purpose && k.key);
    if (exact) return exact.key;
    const any = _config.keys.find((k) => k.key);
    if (any) return any.key;
    try {
      if (
        typeof process !== "undefined" &&
        process.env &&
        process.env.API_KEY
      ) {
        return process.env.API_KEY;
      }
    } catch {
      /* process niedostępny */
    }
    return null;
  },

  /** Model dla przeznaczenia (z konfiguracji lub domyślny). */
  getModel(purpose = "main"): string {
    return (
      _config.keys.find((k) => k.purpose === purpose)?.model || DEFAULT_MODEL
    );
  },

  /** Czyść (lock/logout — razem z DEK). */
  clear(): void {
    _config = { keys: [] };
  },
};
