/**
 * AiKeysPanel — panel Ustawień „Klucze AI / Modele" (CRM-ALINA, admin).
 *
 * Zarządza konfiguracją AI (dowolna liczba kluczy per przeznaczenie + model).
 * Odczyt z apiKeyStore.getConfig() (odszyfrowane w pamięci sesji po PassphraseGate),
 * zapis: apiKeyStore.setConfig() natychmiast w sesji + encryptField(JSON, DEK) →
 * upsert do public.tenant_config.encrypted_ai_config (RLS: write tylko admin).
 * Round-trip: PassphraseGate przy odblokowaniu czyta tę samą kolumnę i woła setConfig.
 *
 * Klucze nie opuszczają przeglądarki w jawnej formie (szyfrowane DEK hasła aplikacji, RODO).
 */
import { useEffect, useState } from "react";
import {
  KeyRound,
  ShieldCheck,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Loader2,
} from "lucide-react";
import {
  apiKeyStore,
  MODEL_OPTIONS,
  DEFAULT_MODEL,
  type AiConfig,
} from "../../services/apiKeyStore";
import { encryptField } from "../../services/crypto";
import { supabaseStorage } from "../../services/storage";
import { getPublicSupabaseClient } from "../../../components/atomic-crm/providers/supabase/supabase";

const TENANT_ID =
  ((import.meta as unknown as { env?: { VITE_SUPABASE_TENANT_ID?: string } })
    .env?.VITE_SUPABASE_TENANT_ID as string | undefined) ||
  "11111111-1111-1111-1111-111111111111";

// Wiersz UI — AiKeyEntry + pola pomocnicze (stabilny uid do key Reacta, podgląd klucza).
interface KeyRow {
  uid: string;
  purpose: string;
  label: string;
  key: string;
  model: string;
  reveal: boolean;
}

type Status =
  | { type: "idle" }
  | { type: "saving" }
  | { type: "ok"; msg: string }
  | { type: "error"; msg: string };

let _seq = 0;
const newUid = () => `aik_${Date.now().toString(36)}_${_seq++}`;

const INPUT_CLS =
  "w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none transition-colors";

export function AiKeysPanel() {
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  useEffect(() => {
    const cfg = apiKeyStore.getConfig();
    setRows(
      cfg.keys.map((k) => ({
        uid: newUid(),
        purpose: k.purpose,
        label: k.label ?? "",
        key: k.key,
        model: k.model || DEFAULT_MODEL,
        reveal: false,
      })),
    );
  }, []);

  const patchRow = (uid: string, patch: Partial<KeyRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)),
    );
    setStatus({ type: "idle" });
  };

  const removeRow = (uid: string) => {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
    setStatus({ type: "idle" });
  };

  const addRow = () => {
    const hasMain = rows.some((r) => r.purpose.trim().toLowerCase() === "main");
    setRows((prev) => [
      ...prev,
      {
        uid: newUid(),
        purpose: hasMain ? "" : "main",
        label: "",
        key: "",
        model: DEFAULT_MODEL,
        reveal: true,
      },
    ]);
    setStatus({ type: "idle" });
  };

  const handleSave = async () => {
    // 1. Zbuduj AiConfig z wierszy (pomiń wiersze bez klucza).
    const config: AiConfig = {
      keys: rows
        .filter((r) => r.key.trim())
        .map((r) => ({
          purpose: r.purpose.trim() || "main",
          ...(r.label.trim() ? { label: r.label.trim() } : {}),
          key: r.key.trim(),
          model: r.model || DEFAULT_MODEL,
        })),
    };

    // 2. Zastosuj w sesji natychmiast (działa nawet bez zapisu do bazy).
    apiKeyStore.setConfig(config);

    // 3. DEK dostępny tylko po odblokowaniu bazy (PassphraseGate).
    const dek = supabaseStorage.getDEK();
    if (!dek) {
      setStatus({
        type: "error",
        msg: "Zaloguj się (odblokuj bazę) aby zapisać.",
      });
      return;
    }

    setStatus({ type: "saving" });
    try {
      // 4. Szyfrowanie DEK (envelope) → Base64.
      const encrypted = await encryptField(JSON.stringify(config), dek);

      // 5. Upsert do tenant_config (RLS pozwala zapis tylko adminowi).
      const { error } = await getPublicSupabaseClient()
        .from("tenant_config")
        .upsert(
          { tenant_id: TENANT_ID, encrypted_ai_config: encrypted },
          { onConflict: "tenant_id" },
        );

      if (error) {
        const isRls =
          error.code === "42501" ||
          /row-level security|policy|permission|not authorized|denied/i.test(
            error.message || "",
          );
        setStatus({
          type: "error",
          msg: isRls
            ? "Tylko administrator może zapisać klucze."
            : `Błąd zapisu: ${error.message}`,
        });
        return;
      }

      // 6. Sukces.
      setStatus({
        type: "ok",
        msg: `Zapisano. ${config.keys.length} ${
          config.keys.length === 1 ? "klucz" : "kluczy"
        } zaszyfrowano w bazie.`,
      });
    } catch (e) {
      setStatus({
        type: "error",
        msg: `Błąd szyfrowania/zapisu: ${(e as Error).message}`,
      });
    }
  };

  const saving = status.type === "saving";

  return (
    <div className="px-3 py-4 border-t border-zinc-900 mt-2 bg-zinc-950/40 rounded-xl space-y-4 animate-in slide-in-from-left-4 duration-300">
      {/* Nagłówek sekcji */}
      <p className="text-[9px] uppercase font-black text-zinc-500 tracking-wider flex items-center gap-2 px-1">
        <KeyRound size={10} className="text-indigo-400" /> Klucze AI / Modele
      </p>

      {/* Nota RODO */}
      <div className="flex items-start gap-2 px-2 py-2 rounded-lg bg-indigo-950/30 border border-indigo-500/20">
        <ShieldCheck
          size={12}
          className="text-indigo-400 mt-0.5 flex-shrink-0"
        />
        <p className="text-[9px] leading-relaxed text-zinc-400">
          Klucze są szyfrowane hasłem aplikacji i{" "}
          <span className="text-zinc-300 font-bold">
            nie opuszczają przeglądarki
          </span>{" "}
          (RODO). Możesz dodać dowolną liczbę kluczy — osobne przeznaczenia (np.{" "}
          <span className="text-zinc-300">„main"</span> = czat,{" "}
          <span className="text-zinc-300">„ocr"</span> = skany) i model per
          przeznaczenie.
        </p>
      </div>

      {/* Lista wpisów */}
      {rows.length === 0 && (
        <p className="text-[10px] text-zinc-600 italic px-1 py-2">
          Brak kluczy. Dodaj pierwszy klucz przyciskiem poniżej.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.uid}
            className="border border-zinc-800 rounded-xl p-2.5 bg-zinc-900/40 space-y-2"
          >
            {/* Przeznaczenie + usuń */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[8px] font-bold uppercase text-zinc-600 mb-1 block px-0.5">
                  Przeznaczenie
                </label>
                <input
                  type="text"
                  value={r.purpose}
                  onChange={(e) => patchRow(r.uid, { purpose: e.target.value })}
                  placeholder="main"
                  className={INPUT_CLS}
                />
              </div>
              <button
                onClick={() => removeRow(r.uid)}
                title="Usuń klucz"
                className="mt-4 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Opis */}
            <div>
              <label className="text-[8px] font-bold uppercase text-zinc-600 mb-1 block px-0.5">
                Opis (opcjonalny)
              </label>
              <input
                type="text"
                value={r.label}
                onChange={(e) => patchRow(r.uid, { label: e.target.value })}
                placeholder="np. Gemini konto redroadai@"
                className={INPUT_CLS}
              />
            </div>

            {/* Klucz + podgląd */}
            <div>
              <label className="text-[8px] font-bold uppercase text-zinc-600 mb-1 block px-0.5">
                Klucz API
              </label>
              <div className="relative">
                <input
                  type={r.reveal ? "text" : "password"}
                  value={r.key}
                  onChange={(e) => patchRow(r.uid, { key: e.target.value })}
                  placeholder="AIza…"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${INPUT_CLS} pr-8 font-mono`}
                />
                <button
                  onClick={() => patchRow(r.uid, { reveal: !r.reveal })}
                  title={r.reveal ? "Ukryj klucz" : "Pokaż klucz"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {r.reveal ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="text-[8px] font-bold uppercase text-zinc-600 mb-1 block px-0.5">
                Model
              </label>
              <select
                value={r.model}
                onChange={(e) => patchRow(r.uid, { model: e.target.value })}
                className={INPUT_CLS}
              >
                {MODEL_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Akcje */}
      <div className="flex items-center gap-2">
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-zinc-300 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:text-white transition-colors"
        >
          <Plus size={12} /> Dodaj klucz
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Save size={12} />
          )}
          {saving ? "Zapisywanie…" : "Zapisz"}
        </button>
      </div>

      {/* Status */}
      {status.type === "ok" && (
        <p className="text-[10px] font-bold text-emerald-400 px-1">
          {status.msg}
        </p>
      )}
      {status.type === "error" && (
        <p className="text-[10px] font-bold text-red-400 px-1">{status.msg}</p>
      )}
    </div>
  );
}
