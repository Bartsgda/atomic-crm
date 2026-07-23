import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock, Loader2, Lock, LogOut } from "lucide-react";
import { getPublicSupabaseClient } from "../../components/atomic-crm/providers/supabase/supabase";
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
  | "loading" // pobieranie danych z tenant_keys + passphrase_lockouts
  | "no_key" // brak wpisu dla usera
  | "prompt" // czeka na wpisanie hasła
  | "unlocking" // trwa derive+unwrap
  | "temp_locked" // blokada czasowa (odliczanie do locked_until)
  | "locked_out"; // hard lock — zdejmuje wyłącznie admin

// Stan blokady — server-side w public.passphrase_lockouts.
// Progi (RPC register_passphrase_failure): 3 próby → 1 min, 6 → 5 min,
// 9 → hard lock. Licznik zeruje RPC reset_passphrase_lockout po sukcesie.
interface LockState {
  failed_attempts: number;
  locked_until: string | null;
  hard_locked: boolean;
}

const HARD_LOCK_AT = 9;

/** Następny próg blokady dla danej liczby nieudanych prób. */
const nextThreshold = (fails: number) => (fails < 3 ? 3 : fails < 6 ? 6 : 9);

/** Lokalna eskalacja — fallback gdy RPC niedostępne (offline itp.). */
const localEscalation = (fails: number): LockState => ({
  failed_attempts: fails,
  hard_locked: fails >= HARD_LOCK_AT,
  locked_until:
    fails >= HARD_LOCK_AT
      ? null
      : fails >= 6
        ? new Date(Date.now() + 5 * 60_000).toISOString()
        : fails >= 3
          ? new Date(Date.now() + 60_000).toISOString()
          : null,
});

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

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
  const [lockedUntil, setLockedUntil] = useState<number | null>(null); // epoch ms
  const [countdown, setCountdown] = useState("");

  // Dane klucza pobrane z DB – trzymamy w refach, nie w state,
  // żeby uniknąć niepotrzebnych re-renderów i wycieków wrażliwych danych.
  const wrappedDekRef = useRef<string | null>(null);
  const saltRef = useRef<Uint8Array | null>(null);
  const iterationsRef = useRef<number>(310_000);

  const inputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Zastosuj stan blokady z serwera (lub fallbacku) do UI
  // -------------------------------------------------------------------------
  const applyLockState = (state: LockState, afterFail: boolean) => {
    setAttempts(state.failed_attempts);

    if (state.hard_locked) {
      setPhase("locked_out");
      return;
    }

    const until = state.locked_until ? Date.parse(state.locked_until) : null;
    if (until && until > Date.now()) {
      setLockedUntil(until);
      setPhase("temp_locked");
      return;
    }

    if (afterFail) {
      const left = nextThreshold(state.failed_attempts) - state.failed_attempts;
      setError(
        `Błędne hasło. ${left === 1 ? "Została 1 próba" : `Zostały ${left} próby`} do blokady.`,
      );
    }
    setPhase("prompt");
  };

  // -------------------------------------------------------------------------
  // 1. Pobierz dane klucza z tenant_keys + stan blokady po mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const fetchKey = async () => {
      try {
        const sb = getPublicSupabaseClient();

        const [keyRes, lockRes] = await Promise.all([
          sb
            .from("tenant_keys")
            .select("wrapped_dek, kdf_salt, kdf_iterations, key_version")
            .eq("user_id", userId)
            .order("key_version", { ascending: false })
            .limit(1)
            .maybeSingle(),
          sb
            .from("passphrase_lockouts")
            .select("failed_attempts, locked_until, hard_locked")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (keyRes.error) {
          console.error("[PassphraseGate] DB error:", keyRes.error);
          setPhase("no_key");
          return;
        }

        if (!keyRes.data) {
          setPhase("no_key");
          return;
        }

        // Odkoduj sól z Base64 → Uint8Array
        const saltBinary = atob(keyRes.data.kdf_salt);
        saltRef.current = Uint8Array.from(saltBinary, (c) => c.charCodeAt(0));
        wrappedDekRef.current = keyRes.data.wrapped_dek;
        iterationsRef.current = keyRes.data.kdf_iterations ?? 310_000;

        // Stan blokady (brak wiersza / błąd = brak blokady)
        if (lockRes.data) {
          applyLockState(lockRes.data as LockState, false);
        } else {
          setPhase("prompt");
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Fokus po przejściu do fazy "prompt"
  useEffect(() => {
    if (phase === "prompt") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [phase]);

  // -------------------------------------------------------------------------
  // 2. Odliczanie blokady czasowej — po upływie wraca do prompta
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "temp_locked" || !lockedUntil) return;

    const tick = () => {
      const remaining = lockedUntil - Date.now();
      if (remaining <= 0) {
        setLockedUntil(null);
        setError(null);
        setPhase("prompt");
      } else {
        setCountdown(formatCountdown(remaining));
      }
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [phase, lockedUntil]);

  // -------------------------------------------------------------------------
  // 3. Submit passphrase
  // -------------------------------------------------------------------------
  const handleSubmit = async () => {
    if (!inputRef.current) return;

    const passphrase = inputRef.current.value;

    // Wyczyść pole natychmiast – passphrase nie powinien dłużej siedzieć w DOM
    inputRef.current.value = "";

    if (!passphrase) return;

    setPhase("unlocking");
    setError(null);

    const sb = getPublicSupabaseClient();

    try {
      const kek = await deriveKEK(
        passphrase,
        saltRef.current!,
        iterationsRef.current,
      );
      const dek = await unwrapDEK(wrappedDekRef.current!, kek);

      // Sukces — wyzeruj licznik server-side (fire-and-forget)
      sb.rpc("reset_passphrase_lockout").then(
        () => undefined,
        (e: unknown) =>
          console.warn("[PassphraseGate] reset_passphrase_lockout:", e),
      );
      onUnlocked(dek);
    } catch {
      // Nieudana próba → zarejestruj server-side (F5 nie resetuje licznika)
      let state: LockState | null = null;
      try {
        const { data, error: rpcError } = await sb.rpc(
          "register_passphrase_failure",
        );
        if (!rpcError && data) state = data as LockState;
        else if (rpcError)
          console.warn("[PassphraseGate] register_passphrase_failure:", rpcError);
      } catch (e) {
        console.warn("[PassphraseGate] register_passphrase_failure:", e);
      }

      // Fallback offline: eskalacja lokalna z tymi samymi progami
      if (!state) state = localEscalation(attempts + 1);

      applyLockState(state, true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  // -------------------------------------------------------------------------
  // 4. Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#07090b] text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#111318] p-8 rounded-2xl shadow-2xl border border-white/5 flex flex-col items-center">
        {/* ── LOADING ─────────────────────────────────────────────────────── */}
        {phase === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-gray-400 text-sm">
              Ładowanie danych szyfrowania…
            </p>
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
              Twoje konto nie zostało jeszcze zainicjalizowane. Skontaktuj się z
              administratorem.
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
              </p>
            )}

            {/* Podpowiedź */}
            <p className="text-gray-500 text-xs mb-6 self-start">
              Hasło chroniące dane w chmurze. Jeśli zapomniałeś — skontaktuj się
              z administratorem.
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

        {/* ── TEMP LOCKED (odliczanie) ────────────────────────────────────── */}
        {phase === "temp_locked" && (
          <>
            <div className="w-16 h-16 bg-orange-500/15 text-orange-400 rounded-full flex items-center justify-center mb-6">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-center">
              Zbyt wiele nieudanych prób
            </h2>
            <p className="text-gray-400 text-sm text-center mb-2">
              Kolejna próba możliwa za
            </p>
            <p className="text-3xl font-semibold text-orange-400 mb-6 tabular-nums">
              {countdown}
            </p>
            <p className="text-gray-500 text-xs text-center mb-8">
              Po {HARD_LOCK_AT} nieudanych próbach dostęp blokuje się na stałe —
              odblokować może tylko administrator.
            </p>
            <button
              onClick={onLogout}
              className="w-full py-2 px-4 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white
                         rounded-xl font-medium transition-all text-sm flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              Wyloguj
            </button>
          </>
        )}

        {/* ── LOCKED OUT (hard — tylko admin) ─────────────────────────────── */}
        {phase === "locked_out" && (
          <>
            <div className="w-16 h-16 bg-red-500/15 text-red-400 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-center">
              Dostęp zablokowany
            </h2>
            <p className="text-gray-400 text-sm text-center mb-8">
              Przekroczono limit {HARD_LOCK_AT} nieudanych prób. Skontaktuj się
              z administratorem — tylko on może odblokować dostęp.
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
