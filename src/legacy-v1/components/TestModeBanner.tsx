import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import {
  getActiveSchema,
  switchSchema,
} from "../../components/atomic-crm/providers/supabase/supabase";
import { getPublicSupabaseClient } from "../../components/atomic-crm/providers/supabase/supabase";

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-prod-to-test`;

interface Props {
  lastSyncAt: string | null;
}

export function TestModeBanner({ lastSyncAt }: Props) {
  const [switching, setSwitching] = useState(false);

  if (getActiveSchema() !== "test") return null;

  const syncTime = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const handleSwitchToProd = async () => {
    setSwitching(true);
    try {
      const { data } = await getPublicSupabaseClient().auth.getSession();
      const token = data.session?.access_token ?? "";
      await fetch(EDGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode: "switch", schema: "public" }),
      });
      switchSchema("public"); // localStorage + reload
    } catch {
      setSwitching(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-[60] select-none">
      <div className="bg-amber-500 text-white rounded-xl shadow-2xl p-3 w-52 border border-amber-400">
        <div className="font-bold text-sm mb-1 flex items-center gap-1.5">
          🧪 TRYB TESTOWY
        </div>
        <p className="text-amber-100 text-[11px] leading-snug mb-2">
          Pracujesz na kopii danych prod.
          <br />
          <strong>Zmiany nie trafią do produkcji.</strong>
        </p>
        {syncTime && (
          <p className="text-amber-200 text-[10px] mb-2">Kopia z: {syncTime}</p>
        )}
        <button
          onClick={handleSwitchToProd}
          disabled={switching}
          className="w-full flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-60 rounded-lg py-1.5 text-xs font-medium transition-colors"
        >
          {switching ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Wróć do prod
        </button>
      </div>
    </div>
  );
}
