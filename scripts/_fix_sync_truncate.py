import subprocess, requests

def rrv(n):
    return subprocess.check_output(f'powershell -Command "rrv get {n}"', shell=True).decode('utf-8-sig').strip()

pat = rrv("1h_SUPABASE_MOZNA_KASOWAC")
ref = "xqznrssrlnxqkdvisnck"

# insurance_snapshots.created_by → sales (nie syncujemy sales → FK fail)
# insurance_login_log.snapshot_id → insurance_snapshots (też wisi)
# Oba to tabele audytu (logi logowań, snapshoty) - nie potrzebne do testów Aliny
# insurance_activity_log.actor_id → sales — też wykluczone

sql = """
CREATE OR REPLACE FUNCTION public.sync_prod_to_test(p_caller_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start  timestamptz := clock_timestamp();
  v_counts jsonb := '{}'::jsonb;
  v_n      integer;
  v_cols   text;
  v_table  text;
  -- Tabele sync (bez logów audytu które mają FK → sales której nie syncujemy)
  v_tables text[] := ARRAY[
    'insurance_clients',
    'sub_agents',
    'insurers',
    'checklist_templates',
    'policies',
    'policy_notes',
    'policy_sub_agent_shares',
    'insurance_feedback',
    'insurance_trash',
    'terminations'
  ];
BEGIN
  -- TRUNCATE (logs audytu też czyścimy, ale nie wypełniamy)
  TRUNCATE TABLE
    test.terminations,
    test.insurance_trash,
    test.insurance_snapshots,
    test.insurance_login_log,
    test.insurance_activity_log,
    test.insurance_feedback,
    test.policy_sub_agent_shares,
    test.policy_notes,
    test.policies,
    test.insurance_clients,
    test.sub_agents,
    test.insurers,
    test.checklist_templates
  CASCADE;

  -- INSERT tylko wspólne kolumny (public ∩ test), bez tabel z FK → sales
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO v_cols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = v_table
      AND c.column_name IN (
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'test' AND table_name = v_table
      );

    IF v_cols IS NULL THEN CONTINUE; END IF;

    EXECUTE format(
      'INSERT INTO test.%I (%s) SELECT %s FROM public.%I',
      v_table, v_cols, v_cols, v_table
    );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object(v_table, v_n);
  END LOOP;

  -- Log sync
  INSERT INTO public.sync_log (synced_by, rows_per_table, duration_ms)
  VALUES (
    p_caller_email,
    v_counts,
    EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000
  );

  -- Przełącz na test
  UPDATE public.configuration
  SET config = config || '{"active_schema":"test"}'::jsonb
  WHERE id = 1;

  RETURN jsonb_build_object('success', true, 'rows', v_counts);
END;
$$;
"""

resp = requests.post(
    f"https://api.supabase.com/v1/projects/{ref}/database/query",
    headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
    json={"query": sql},
    timeout=60
)
print(f"Status: {resp.status_code}")
if resp.status_code in (200, 201):
    print("OK — sync bez tabel audytu (snapshots/login_log/activity_log mają FK → sales)")
    print("Syncowane (10): insurance_clients, sub_agents, insurers, checklist_templates,")
    print("  policies, policy_notes, policy_sub_agent_shares, insurance_feedback,")
    print("  insurance_trash, terminations")
else:
    print(f"FAIL: {resp.text[:400]}")
