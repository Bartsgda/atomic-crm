-- Migration: sync_prod_to_test infrastructure
-- Adds: sync_log table + 3 SQL functions (check_test_changes, sync_prod_to_test, set_active_schema)
-- Applied to: public schema (Alina prod: xqznrssrlnxqkdvisnck)

-- ─── sync_log ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sync_log (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  synced_by   text,
  rows_per_table jsonb,
  duration_ms integer
);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read sync_log"  ON public.sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert sync_log" ON public.sync_log FOR INSERT TO authenticated WITH CHECK (true);

-- ─── Inicjalizacja active_schema w configuration ──────────────────────────────

UPDATE public.configuration
SET config = config || '{"active_schema": "public"}'::jsonb
WHERE id = 1
  AND config->>'active_schema' IS NULL;

-- ─── set_active_schema ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_active_schema(p_schema text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_schema NOT IN ('public', 'test') THEN
    RAISE EXCEPTION 'Invalid schema: %. Allowed: public, test', p_schema;
  END IF;
  UPDATE public.configuration
  SET config = config || jsonb_build_object('active_schema', p_schema)
  WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_schema(text) TO authenticated;

-- ─── check_test_changes ───────────────────────────────────────────────────────
-- Zwraca listę rekordów zmienionych w test od ostatniego sync.
-- Sprawdza tylko tabele z updated_at: insurance_clients, policies, policy_notes.

CREATE OR REPLACE FUNCTION public.check_test_changes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_sync_at  timestamptz;
  conflicts     jsonb := '[]'::jsonb;
  clients_rows  jsonb;
  policy_rows   jsonb;
  note_count    bigint;
BEGIN
  SELECT synced_at INTO last_sync_at
  FROM public.sync_log
  ORDER BY synced_at DESC
  LIMIT 1;

  IF last_sync_at IS NULL THEN
    RETURN jsonb_build_object('conflicts', '[]'::jsonb, 'last_sync_at', NULL, 'is_first_sync', true);
  END IF;

  -- Zmienione rekordy klientów (imię + nazwisko)
  SELECT jsonb_agg(jsonb_build_object(
    'type',       'klient',
    'name',       first_name || ' ' || last_name,
    'changed_at', updated_at
  ) ORDER BY updated_at DESC)
  INTO clients_rows
  FROM test.insurance_clients
  WHERE updated_at > last_sync_at;

  IF clients_rows IS NOT NULL THEN
    conflicts := conflicts || clients_rows;
  END IF;

  -- Zmienione polisy (z nazwiskiem klienta)
  SELECT jsonb_agg(jsonb_build_object(
    'type',       'polisa',
    'name',       COALESCE(c.first_name || ' ' || c.last_name, 'nieznany') || ' — ' || p.type,
    'changed_at', p.updated_at
  ) ORDER BY p.updated_at DESC)
  INTO policy_rows
  FROM test.policies p
  LEFT JOIN test.insurance_clients c ON c.id = p.client_id
  WHERE p.updated_at > last_sync_at;

  IF policy_rows IS NOT NULL THEN
    conflicts := conflicts || policy_rows;
  END IF;

  -- Zmienione notatki (tylko liczba — brak prostego FK do klienta)
  SELECT count(*) INTO note_count
  FROM test.policy_notes
  WHERE updated_at > last_sync_at;

  IF note_count > 0 THEN
    conflicts := conflicts || jsonb_build_array(jsonb_build_object(
      'type',       'notatki',
      'name',       note_count || ' notatek zmienionych',
      'changed_at', NULL
    ));
  END IF;

  RETURN jsonb_build_object(
    'conflicts',    conflicts,
    'last_sync_at', last_sync_at,
    'is_first_sync', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_test_changes() TO authenticated;

-- ─── sync_prod_to_test ───────────────────────────────────────────────────────
-- Kopiuje 13 tabel insurance_* z public → test.
-- Kolejność: rodzice przed dziećmi (INSERT), dzieci przed rodzicami (TRUNCATE).
-- NIGDY nie odwraca kierunku (test → public).

CREATE OR REPLACE FUNCTION public.sync_prod_to_test(p_caller_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result     jsonb := '{}'::jsonb;
  row_count  bigint;
  start_ts   timestamptz := clock_timestamp();
  tbl        text;

  -- INSERT w kolejności zależności: rodzice pierwsi
  insert_order text[] := ARRAY[
    'insurance_clients',
    'sub_agents',
    'insurers',
    'checklist_templates',
    'policies',
    'policy_notes',
    'policy_sub_agent_shares',
    'insurance_feedback',
    'insurance_activity_log',
    'insurance_login_log',
    'insurance_snapshots',
    'insurance_trash',
    'terminations'
  ];
BEGIN
  -- TRUNCATE w odwrotnej kolejności (dzieci pierwsi), bez CASCADE
  TRUNCATE test.terminations;
  TRUNCATE test.insurance_trash;
  TRUNCATE test.insurance_snapshots;
  TRUNCATE test.insurance_login_log;
  TRUNCATE test.insurance_activity_log;
  TRUNCATE test.insurance_feedback;
  TRUNCATE test.policy_sub_agent_shares;
  TRUNCATE test.policy_notes;
  TRUNCATE test.policies;
  TRUNCATE test.insurance_clients;
  TRUNCATE test.sub_agents;
  TRUNCATE test.insurers;
  TRUNCATE test.checklist_templates;

  -- INSERT rodzic → dziecko
  FOREACH tbl IN ARRAY insert_order LOOP
    BEGIN
      EXECUTE format('INSERT INTO test.%I SELECT * FROM public.%I', tbl, tbl);
      EXECUTE format('SELECT count(*) FROM test.%I', tbl) INTO row_count;
      result := result || jsonb_build_object(tbl, row_count);
    EXCEPTION WHEN OTHERS THEN
      result := result || jsonb_build_object(tbl || '_error', SQLERRM);
    END;
  END LOOP;

  -- Zaloguj sync
  INSERT INTO public.sync_log (synced_by, rows_per_table, duration_ms)
  VALUES (
    p_caller_email,
    result,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::integer
  );

  -- Przełącz active_schema na 'test'
  PERFORM public.set_active_schema('test');

  RETURN jsonb_build_object(
    'success',        true,
    'rows_per_table', result,
    'duration_ms',    EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::integer
  );
END;
$$;

-- Tylko service_role może wywołać sync (Edge Function używa service_role)
REVOKE EXECUTE ON FUNCTION public.sync_prod_to_test(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.sync_prod_to_test(text) TO service_role;
