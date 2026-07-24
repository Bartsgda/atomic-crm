import { FlaskConical, ArrowLeft } from "lucide-react";
import {
  getActiveSchema,
  switchSchema,
} from "../../components/atomic-crm/providers/supabase/supabase";

/**
 * Floating przełącznik trybu testowego (piaskownica na schemacie `test`).
 *
 * Dwa stany:
 *  - PROD (schema=public): dyskretny przycisk „Tryb testowy" → wejście w piaskownicę.
 *  - TEST (schema=test): żółty banner ostrzegawczy + „Wróć do produkcji".
 *
 * Przełączanie = `switchSchema()` (localStorage + reload). Dane testowe (schema
 * `test`) są odszyfrowywane tym samym DEK co prod (tenant_keys w public), więc
 * po przełączeniu i odblokowaniu hasłem Alina widzi pełną kopię-piaskownicę.
 * Zmiany w trybie test NIE trafiają do produkcji (inny schemat bazy).
 *
 * Uwaga: w dev (`VITE_SUPABASE_SCHEMA=test`, START_ALINA_TEST.bat) getActiveSchema()
 * zawsze zwraca „test", więc widoczny jest banner (bez przełącznika do prod — to
 * celowe, tryb dev jest zamrożony na test).
 */
export function TestModeBanner() {
  const isTest = getActiveSchema() === "test";

  if (isTest) {
    return (
      <div className="fixed bottom-20 right-4 z-[60] select-none">
        <div className="bg-amber-500 text-white rounded-xl shadow-2xl p-3 w-56 border border-amber-400">
          <div className="font-bold text-sm mb-1 flex items-center gap-1.5">
            🧪 TRYB TESTOWY
          </div>
          <p className="text-amber-100 text-[11px] leading-snug mb-2">
            Pracujesz na kopii danych (piaskownica).
            <br />
            <strong>Zmiany nie trafią do produkcji.</strong>
          </p>
          <button
            onClick={() => switchSchema("public")}
            className="w-full flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-lg py-1.5 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Wróć do produkcji
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-[55] select-none">
      <button
        onClick={() => switchSchema("test")}
        title="Podgląd na kopii danych (piaskownica) — nic nie zmienia w produkcji"
        className="flex items-center gap-1.5 bg-zinc-800/90 hover:bg-amber-600 text-amber-300 hover:text-white rounded-lg shadow-lg px-3 py-2 text-xs font-medium border border-amber-500/30 transition-colors"
      >
        <FlaskConical className="w-3.5 h-3.5" />
        Tryb testowy
      </button>
    </div>
  );
}

export default TestModeBanner;
