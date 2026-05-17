-- Migration: sync_prod_to_test v2 — dynamiczne kolumny (public ∩ test)
-- Cel: INSERT nowych + UPDATE gdy prod nowszy — tylko wspólne kolumny obu schematów.
-- Odporne na rozbieżności schematu (test może mieć kolumny których public nie ma).

CREATE OR REPLACE FUNCTION public.sync_prod_to_test(p_caller_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result    jsonb := '{}'::jsonb;
  added     bigint;
  updated   bigint;
  start_ts  timestamptz := clock_timestamp();
  v_cols    text;
  v_set     text;

  -- Tabele z updated_at: INSERT nowych + UPDATE gdy prod nowszy
  tables_with_ts text[] := ARRAY[
    'insurance_clients',
    'policies',
    'policy_notes',
    'terminations'
  ];
  -- Tabele referencyjne i logi: INSERT ON CONFLICT DO NOTHING
  tables_insert_only text[] := ARRAY[
    'sub_agents',
    'insurers',
    'checklist_templates',
    'insurance_feedback',
    'insurance_activity_log',
    'insurance_login_log',
    'insurance_snapshots',
    'insurance_trash'
  ];
  t text;
BEGIN

  -- ── Tabele z updated_at ──────────────────────────────────────────────────────
  FOREACH t IN ARRAY tables_with_ts LOOP

    -- Wspólne kolumny public ∩ test
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO v_cols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = t
      AND c.column_name IN (
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'test' AND table_name = t
      );

    IF v_cols IS NULL THEN CONTINUE; END IF;

    -- INSERT nowych
    EXECUTE format(
      'INSERT INTO test.%I (%s) SELECT %s FROM public.%I ON CONFLICT (id) DO NOTHING',
      t, v_cols, v_cols, t
    );
    GET DIAGNOSTICS added = ROW_COUNT;

    -- SET clause: wspólne kolumny bez id
    SELECT string_agg(format('%I = p.%I', c.column_name, c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO v_set
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = t
      AND c.column_name IN (
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'test' AND table_name = t
      )
      AND c.column_name <> 'id';

    -- UPDATE gdy prod jest nowszy
    EXECUTE format(
      'UPDATE test.%I tbl SET %s FROM public.%I p WHERE tbl.id = p.id AND tbl.updated_at < p.updated_at',
      t, v_set, t
    );
    GET DIAGNOSTICS updated = ROW_COUNT;

    result := result || jsonb_build_object(t, jsonb_build_object('added', added, 'updated', updated));
  END LOOP;

  -- ── Tabele referencyjne / logi ───────────────────────────────────────────────
  FOREACH t IN ARRAY tables_insert_only LOOP

    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO v_cols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = t
      AND c.column_name IN (
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'test' AND table_name = t
      );

    IF v_cols IS NULL THEN CONTINUE; END IF;

    EXECUTE format(
      'INSERT INTO test.%I (%s) SELECT %s FROM public.%I ON CONFLICT (id) DO NOTHING',
      t, v_cols, v_cols, t
    );
    GET DIAGNOSTICS added = ROW_COUNT;

    result := result || jsonb_build_object(t, jsonb_build_object('added', added));
  END LOOP;

  -- ── policy_sub_agent_shares (composite PK, bez id) ───────────────────────────
  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO v_cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'policy_sub_agent_shares'
    AND c.column_name IN (
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'test' AND table_name = 'policy_sub_agent_shares'
    );

  IF v_cols IS NOT NULL THEN
    EXECUTE format(
      'INSERT INTO test.policy_sub_agent_shares (%s) SELECT %s FROM public.policy_sub_agent_shares ON CONFLICT DO NOTHING',
      v_cols, v_cols
    );
    GET DIAGNOSTICS added = ROW_COUNT;
    result := result || jsonb_build_object('policy_sub_agent_shares', jsonb_build_object('added', added));
  END IF;

  -- ── sync_log ─────────────────────────────────────────────────────────────────
  INSERT INTO public.sync_log (synced_by, rows_per_table, duration_ms)
  VALUES (
    p_caller_email,
    result,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::integer
  );

  PERFORM public.set_active_schema('test');

  RETURN jsonb_build_object(
    'success',        true,
    'rows_per_table', result,
    'duration_ms',    EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::integer
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_prod_to_test(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.sync_prod_to_test(text) TO service_role;
