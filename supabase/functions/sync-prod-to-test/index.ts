import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req: Request): Promise<Response> => {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let body: { mode?: string; caller_email?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400, headers: corsHeaders },
      );
    }

    const { mode, caller_email } = body;

    // ─── check: co się zmieniło w test od ostatniego sync ─────────────────────
    if (mode === "check") {
      const { data, error } = await admin.rpc("check_test_changes");
      if (error) {
        console.error("check_test_changes error:", error);
        return Response.json(
          { error: error.message },
          { status: 500, headers: corsHeaders },
        );
      }
      return Response.json(data, { headers: corsHeaders });
    }

    // ─── sync: skopiuj public → test, przełącz active_schema ─────────────────
    if (mode === "sync") {
      const { data, error } = await admin.rpc("sync_prod_to_test", {
        p_caller_email: caller_email ?? null,
      });
      if (error) {
        console.error("sync_prod_to_test error:", error);
        return Response.json(
          { error: error.message },
          { status: 500, headers: corsHeaders },
        );
      }
      return Response.json(data, { headers: corsHeaders });
    }

    // ─── switch: tylko przełącz schema bez kopiowania danych ──────────────────
    if (mode === "switch") {
      const schema = body as unknown as { schema?: string };
      const target =
        (schema as unknown as { schema?: string }).schema ?? "public";
      if (target !== "public" && target !== "test") {
        return Response.json(
          { error: "schema must be 'public' or 'test'" },
          { status: 400, headers: corsHeaders },
        );
      }
      const { error } = await admin.rpc("set_active_schema", {
        p_schema: target,
      });
      if (error)
        return Response.json(
          { error: error.message },
          { status: 500, headers: corsHeaders },
        );
      return Response.json(
        { success: true, active_schema: target },
        { headers: corsHeaders },
      );
    }

    return Response.json(
      { error: "Invalid mode. Use: check | sync | switch" },
      { status: 400, headers: corsHeaders },
    );
  }),
);
