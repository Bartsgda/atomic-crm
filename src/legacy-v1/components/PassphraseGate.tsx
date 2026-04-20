import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Lock, LogOut } from "lucide-react";
import { getSupabaseClient } from "../../components/atomic-crm/providers/supabase/supabase";
import { deriveKEK, unwrapDEK } from "../services/crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PassphraseGateProps {
  userId: string;
  tenantId: string;
  userEmail: string;
  onUnlocked: (dek: CryptoKey) => void;
  onLogout: () => void;
}

type Phase =
  | "loading"        // pobieranie danych z tenant_keys
  | "no_key"         // brak wpisu dla usera
  | "prompt"         // czeka na wpisanie hasła
  | "unlocking"      // trwa derive+unwrap
  | "locked_out";    // przekroczono limit prób

const MAX_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PassphraseGate: React.FC<PassphraseGateProps> = ({
  userId,
  userEmail,
  onUnlocked,
  onLogout,
}) => {
  const [phase, setPhase] = useState<Phase>("loading");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Dane klucza pobrane z DB – trzymamy w refach, nie w state,
  // żeby uniknąć niepotrzebnych re-renderów i wycieków wrażliwych danych.
  const wrappedDekRef = useRef<string | null>(null);
  const saltRef = useRef<Uint8Array | null>(null);
  const iterationsRef = useRef<number>(310_000);

  const inputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // 1. Pobierz dane klucza z tenant_keys po mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const fetchKey = async () => {
      try {
        const sb = getSupabaseClient();

        const { data, error: dbError } = await sb
          .from("tenant_keys")
          .select("wrapped_dek, kdf_salt, kdf_iterations, key_version")
          .eq("user_id", userId)
          .order("key_version", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (dbError) {
          console.error("[PassphraseGate] DB error:", dbError);
          setPhase("no_key");
          return;
        }

        if (!data) {
          setPhase("no_key");
          return;
        }

        // Odkoduj sól z Base64 → Uint8Array
        const saltBinary = atob(data.kdf_salt);
        saltRef.current = Uint8Array.from(saltBinary, (c) => c.charCodeAt(0));
        wrappedDekRef.current = data.wrapped_dek;
        iterationsRef.current = data.kdf_iterations ?? 310_000;

        setPhase("prompt");
      } catch (err) {
        if (cancelled) return;
        console.error("[PassphraseGate] Unexpected error:", err);
        setPhase("no_key");
      }
    };

    fetchKey();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Fokus po przejściu do fazy "prompt"
  useEffect(() => {
    if (phase === "prompt") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [phase]);

  // -------------------------------------------------------------------------
  // 2. Submit passphrase
  // -------------------------------------------------------------------------
  const handleSubmit = async () => {
    if (!inputRef.current) return;

    const passphrase = inputRef.current.value;

    // Wyczyść pole natychmiast – passphrase nie powinien dłużej siedzieć w DOM
    inputRef.current.value = "";

    if (!passphrase) return;

    setPhase("unlocking");
    setError(null);

    try {
      const kek = await deriveKEK(passphrase, saltRef.current!, iterationsRef.current);
      const dek = await unwrapDEK(wrappedDekRef.current!, kek);

      // Sukces
      onUnlocked(dek);
    } catch {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        setPhase("locked_out");
      } else {
        setError("Błędne hasło. Spróbuj ponownie.");
        setPhase("prompt");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  // -------------------------------------------------------------------------
  // 3. Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#07090b] text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#111318] p-8 rounded-2xl shadow-2xl border border-white/5 flex flex-col items-center">

        {/* ── LOADING ─────────────────────────────────────────────────────── */}
        {phase === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-gray-400 text-sm">Ładowanie danych szyfrowania…</p>
          </div>
        )}

        {/* ── NO KEY ──────────────────────────────────────────────────────── */}
        {phase === "no_key" && (
          <>
            <div className="w-16 h-16 bg-yellow-500/15 text-yellow-400 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-center">
              Konto niezainicjalizowane
            </h2>
            <p className="text-gray-400 text-sm text-center mb-8">
              Twoje konto nie zostało jeszcze zainicjalizowane.
              Skontaktuj się z administratorem.
            </p>
            <button
              onClick={onLogout}
              className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-all border border-white/5 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Wyloguj
            </button>
          </>
        )}

        {/* ── PROMPT & UNLOCKING ──────────────────────────────────────────── */}
        {(phase === "prompt" || phase === "unlocking") && (
          <>
            {/* Ikona */}
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
              <Lock className="w-8 h-8 text-white" />
            </div>

            {/* Nagłówek */}
            <h2 className="text-2xl font-semibold mb-1 text-center">
              🔒 Odblokuj dostęp do danych
            </h2>
            <p className="text-gray-400 text-sm mb-6 text-center">
              Zalogowano jako{" "}
              <span className="text-indigo-400 font-medium">{userEmail}</span>
            </p>

            {/* Pole hasła */}
            <div className="w-full mb-2">
              <input
                ref={inputRef}
                type="password"
                placeholder="Hasło aplikacji"
                disabled={phase === "unlocking"}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />
            </div>

            {/* Komunikat o błędzie */}
            {error && (
              <p className="text-red-400 text-sm mb-2 self-start flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
                {attempts > 0 && (
                  <span className="text-gray-500 ml-1">
                    ({attempts}/{MAX_ATTEMPTS} prób)
                  </span>
                )}
              </p>
            )}

            {/* Podpowiedź */}
            <p className="text-gray-500 text-xs mb-6 self-start">
              Hasło chroniące dane w chmurze. Jeśli zapomniałeś — skontaktuj
              się z administratorem.
            </p>

            {/* Przycisk */}
            <button
              onClick={handleSubmit}
              disabled={phase === "unlocking"}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium
                         transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2
                         disabled:opacity-60 disabled:cursor-not-allowed mb-3"
            >
              {phase === "unlocking" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Odszyfrowywanie…
                </>
              ) : (
                "Odblokuj"
              )}
            </button>

            {/* Wyloguj */}
            <button
              onClick={onLogout}
              disabled={phase === "unlocking"}
              className="w-full py-2 px-4 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white
                         rounded-xl font-medium transition-all text-sm flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="w-3.5 h-3.5" />
              Wyloguj
            </button>
          </>
        )}

        {/* ── LOCKED OUT ──────────────────────────────────────────────────── */}
        {phase === "locked_out" && (
          <>
            <div className="w-16 h-16 bg-red-500/15 text-red-400 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-center">
              Zbyt wiele nieudanych prób
            </h2>
            <p className="text-gray-400 text-sm text-center mb-8">
              Skontaktuj się z administratorem aby odzyskać hasło.
            </p>
            <button
              onClick={onLogout}
              className="w-full py-3 px-4 bg-red-600/80 hover:bg-red-600 text-white rounded-xl font-medium
                         transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Wyloguj
            </button>
          </>
        )}
      </div>

      <div className="absolute bottom-8 text-xs text-gray-600">
        Zarządzane przez RedRoad · ALINA CRM
      </div>
    </div>
  );
};

export default PassphraseGate;
