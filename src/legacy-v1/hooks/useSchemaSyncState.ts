import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPublicSupabaseClient,
  getActiveSchema,
  switchSchema,
} from "../../components/atomic-crm/providers/supabase/supabase";

export interface SyncConflict {
  type: "klient" | "polisa" | "notatki";
  name: string;
  changed_at: string | null;
}

export interface SchemaSyncState {
  activeSchema: "public" | "test";
  lastSyncAt: string | null;
  isLoading: boolean;
  checkConflicts: () => Promise<SyncConflict[]>;
  executeSyncToTest: (callerEmail: string) => Promise<{ error?: string }>;
  switchToProd: () => Promise<void>;
}

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-prod-to-test`;

async function callEdge(body: object, accessToken: string): Promise<unknown> {
  const res = await fetch(EDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function useSchemaSyncState(): SchemaSyncState {
  const [activeSchema, setActiveSchema] = useState<"public" | "test">(
    getActiveSchema,
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<
    ReturnType<typeof getPublicSupabaseClient>["channel"] | null
  >(null);

  // Wczytaj last_sync_at z sync_log i subskrybuj Realtime na configuration
  useEffect(() => {
    const sb = getPublicSupabaseClient();

    // Pobierz ostatni sync
    sb.from("sync_log")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.synced_at) setLastSyncAt(data.synced_at);
      });

    // Realtime: gdy inny user zmieni configuration.active_schema → sync localStorage + reload
    const channel = sb
      .channel("schema-sync-config")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "configuration" },
        (payload) => {
          // W dev mode (START_ALINA_TEST.bat) Realtime nie nadpisuje schematu
          if (import.meta.env.VITE_SUPABASE_SCHEMA === "test") return;
          const newSchema = payload.new?.config?.active_schema as
            | string
            | undefined;
          if (newSchema === "test" || newSchema === "public") {
            if (newSchema !== getActiveSchema()) {
              switchSchema(newSchema); // ustawia localStorage + reload
            }
          }
        },
      )
      .subscribe();

    channelRef.current = channel as unknown as ReturnType<typeof sb.channel>;

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const getToken = useCallback(async (): Promise<string> => {
    const { data } = await getPublicSupabaseClient().auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  const checkConflicts = useCallback(async (): Promise<SyncConflict[]> => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const result = (await callEdge({ mode: "check" }, token)) as {
        conflicts?: SyncConflict[];
        last_sync_at?: string;
      };
      if (result.last_sync_at) setLastSyncAt(result.last_sync_at);
      return result.conflicts ?? [];
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  const executeSyncToTest = useCallback(
    async (callerEmail: string): Promise<{ error?: string }> => {
      setIsLoading(true);
      try {
        const token = await getToken();
        const result = (await callEdge(
          { mode: "sync", caller_email: callerEmail },
          token,
        )) as { success?: boolean; error?: string };

        if (result.error) return { error: result.error };

        // Aktualizuj lokalnie i przeładuj (Realtime zaktualizuje Alinę)
        setLastSyncAt(new Date().toISOString());
        switchSchema("test"); // reload strony
        return {};
      } finally {
        setIsLoading(false);
      }
    },
    [getToken],
  );

  const switchToProd = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const token = await getToken();
      await callEdge({ mode: "switch", schema: "public" }, token);
      switchSchema("public"); // reload strony
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  return {
    activeSchema,
    lastSyncAt,
    isLoading,
    checkConflicts,
    executeSyncToTest,
    switchToProd,
  };
}
