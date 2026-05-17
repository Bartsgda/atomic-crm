-- Migration: sync_prod_to_test v4 — finalna
-- Wykluczone z INSERT: insurance_snapshots, insurance_activity_log, insurance_login_log
-- (FK → test.sales której nie syncujemy — tak jak w oryginalnym TRUNCATE+INSERT)

CREATE OR REPLACE FUNCTION public.sync_prod_to_test(p_caller_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result      jsonb := '{}'::jsonb;
  added       bigint;
  updated_n   bigint;
  start_ts    timestamptz := clock_timestamp();
  v_cols      text;
  v_set       text;
  v_has_ts    boolean;
  t           text;

  -- Tabele do syncowania (bez tabel z FK → sales: snapshots, activity_log, login_log)
  all_tables text[] := ARRAY[
    'insurance_clients',
    'sub_agents',
    'insurers',
    'checklist_templates',
    'policies',
    'policy_notes',
    'insurance_feedback',
    'insurance_trash',
    'terminations'
  ];
BEGIN

  FOREACH t IN ARRAY all_tables LOOP

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

    -- INSERT nowych rekordów
    EXECUTE format(
      'INSERT INTO test.%I (%s) SELECT %s FROM public.%I ON CONFLICT (id) DO NOTHING',
      t, v_cols, v_cols, t
    );
    GET DIAGNOSTICS added = ROW_COUNT;

    -- Czy updated_at istnieje w obu schematach?
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'test' AND table_name = t AND column_name = 'updated_at'
    ) INTO v_has_ts;

    updated_n := 0;

    IF v_has_ts THEN
      SELECT string_agg(format('%I = src.%I', c.column_name, c.column_name), ', ' ORDER BY c.ordinal_position)
      INTO v_set
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = t
        AND c.column_name IN (
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'test' AND table_name = t
        )
        AND c.column_name <> 'id';

      EXECUTE format(
        'UPDATE test.%I dst SET %s FROM public.%I src WHERE dst.id = src.id AND dst.updated_at < src.updated_at',
        t, v_set, t
      );
      GET DIAGNOSTICS updated_n = ROW_COUNT;

      result := result || jsonb_build_object(t, jsonb_build_object('added', added, 'updated', updated_n));
    ELSE
      result := result || jsonb_build_object(t, jsonb_build_object('added', added));
    END IF;

  END LOOP;

  -- policy_sub_agent_shares (composite PK)
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

  -- sync_log
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
