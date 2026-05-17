-- Migration: sync_prod_to_test — additive merge (zastępuje pełny TRUNCATE+INSERT)
-- Cel: test ROŚNIE (nowe rekordy z prod), edycje Aliny w test zostają nienaruszone.
-- NIGDY nie odwraca kierunku (test → public).

-- ─── check_test_changes (v2) ─────────────────────────────────────────────────
-- Porównuje test vs prod bezpośrednio (test.updated_at > prod.updated_at).
-- Wykrywa edycje Aliny w test — rekordy gdzie test jest NOWSZY niż prod.
-- Nie zależy od last_sync_at (poprzednia wersja miała false-positive po sync).

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

  -- Klienci: test.updated_at > prod.updated_at → Alina edytowała w test
  SELECT jsonb_agg(jsonb_build_object(
    'type',       'klient',
    'name',       t.first_name || ' ' || t.last_name,
    'changed_at', t.updated_at
  ) ORDER BY t.updated_at DESC)
  INTO clients_rows
  FROM test.insurance_clients t
  JOIN public.insurance_clients p ON p.id = t.id
  WHERE t.updated_at > p.updated_at;

  IF clients_rows IS NOT NULL THEN
    conflicts := conflicts || clients_rows;
  END IF;

  -- Polisy: test.updated_at > prod.updated_at
  SELECT jsonb_agg(jsonb_build_object(
    'type',       'polisa',
    'name',       COALESCE(c.first_name || ' ' || c.last_name, 'nieznany') || ' — ' || tp.type,
    'changed_at', tp.updated_at
  ) ORDER BY tp.updated_at DESC)
  INTO policy_rows
  FROM test.policies tp
  JOIN public.policies pp ON pp.id = tp.id
  LEFT JOIN test.insurance_clients c ON c.id = tp.client_id
  WHERE tp.updated_at > pp.updated_at;

  IF policy_rows IS NOT NULL THEN
    conflicts := conflicts || policy_rows;
  END IF;

  -- Notatki: test.updated_at > prod.updated_at (tylko liczba)
  SELECT count(*) INTO note_count
  FROM test.policy_notes tn
  JOIN public.policy_notes pn ON pn.id = tn.id
  WHERE tn.updated_at > pn.updated_at;

  IF note_count > 0 THEN
    conflicts := conflicts || jsonb_build_array(jsonb_build_object(
      'type',       'notatki',
      'name',       note_count || ' notatek edytowanych w test',
      'changed_at', NULL
    ));
  END IF;

  RETURN jsonb_build_object(
    'conflicts',     conflicts,
    'last_sync_at',  last_sync_at,
    'is_first_sync', last_sync_at IS NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_test_changes() TO authenticated;

-- ─── sync_prod_to_test (v2 — additive merge) ─────────────────────────────────
-- Strategia per tabela:
--   - Tabele z updated_at (clients, policies, notes, terminations):
--       INSERT nowych ON CONFLICT DO NOTHING
--       UPDATE istniejących TYLKO gdy prod jest nowszy (test.updated_at <= prod.updated_at)
--   - Tabele referencyjne (sub_agents, insurers, checklist_templates):
--       INSERT ON CONFLICT DO NOTHING (Alina nie edytuje ich w test)
--   - Tabele logów / relacyjne (shares, feedback, activity, login, snapshots, trash):
--       INSERT ON CONFLICT DO NOTHING

CREATE OR REPLACE FUNCTION public.sync_prod_to_test(p_caller_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result      jsonb := '{}'::jsonb;
  added       bigint;
  updated     bigint;
  start_ts    timestamptz := clock_timestamp();
BEGIN

  -- ── insurance_clients ──────────────────────────────────────────────────────
  INSERT INTO test.insurance_clients SELECT * FROM public.insurance_clients
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;

  UPDATE test.insurance_clients t
  SET first_name = p.first_name, last_name = p.last_name, pesel = p.pesel,
      nip = p.nip, phones = p.phones, emails = p.emails, addresses = p.addresses,
      businesses = p.businesses, source = p.source, notes = p.notes,
      tenant_id = p.tenant_id, updated_at = p.updated_at, created_at = p.created_at,
      v1_original_id = p.v1_original_id
  FROM public.insurance_clients p
  WHERE t.id = p.id AND t.updated_at < p.updated_at;
  GET DIAGNOSTICS updated = ROW_COUNT;
  result := result || jsonb_build_object('insurance_clients',
    jsonb_build_object('added', added, 'updated', updated));

  -- ── sub_agents ─────────────────────────────────────────────────────────────
  INSERT INTO test.sub_agents SELECT * FROM public.sub_agents
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  result := result || jsonb_build_object('sub_agents', jsonb_build_object('added', added));

  -- ── insurers ───────────────────────────────────────────────────────────────
  INSERT INTO test.insurers SELECT * FROM public.insurers
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  result := result || jsonb_build_object('insurers', jsonb_build_object('added', added));

  -- ── checklist_templates ────────────────────────────────────────────────────
  INSERT INTO test.checklist_templates SELECT * FROM public.checklist_templates
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  result := result || jsonb_build_object('checklist_templates', jsonb_build_object('added', added));

  -- ── policies ───────────────────────────────────────────────────────────────
  INSERT INTO test.policies SELECT * FROM public.policies
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;

  UPDATE test.policies t
  SET client_id = p.client_id, type = p.type, stage = p.stage,
      policy_number = p.policy_number, insurer_id = p.insurer_id,
      start_date = p.start_date, end_date = p.end_date,
      premium = p.premium, commission = p.commission,
      auto_details = p.auto_details, home_details = p.home_details,
      travel_details = p.travel_details, firma_details = p.firma_details,
      life_details = p.life_details, notes = p.notes,
      tenant_id = p.tenant_id, updated_at = p.updated_at, created_at = p.created_at,
      legacy_id = p.legacy_id, sub_agent_id = p.sub_agent_id,
      sub_agent_commission = p.sub_agent_commission
  FROM public.policies p
  WHERE t.id = p.id AND t.updated_at < p.updated_at;
  GET DIAGNOSTICS updated = ROW_COUNT;
  result := result || jsonb_build_object('policies',
    jsonb_build_object('added', added, 'updated', updated));

  -- ── policy_notes ───────────────────────────────────────────────────────────
  INSERT INTO test.policy_notes SELECT * FROM public.policy_notes
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;

  UPDATE test.policy_notes t
  SET client_id = p.client_id, content = p.content, tag = p.tag,
      linked_policy_ids = p.linked_policy_ids, tenant_id = p.tenant_id,
      updated_at = p.updated_at, created_at = p.created_at
  FROM public.policy_notes p
  WHERE t.id = p.id AND t.updated_at < p.updated_at;
  GET DIAGNOSTICS updated = ROW_COUNT;
  result := result || jsonb_build_object('policy_notes',
    jsonb_build_object('added', added, 'updated', updated));

  -- ── policy_sub_agent_shares ────────────────────────────────────────────────
  INSERT INTO test.policy_sub_agent_shares SELECT * FROM public.policy_sub_agent_shares
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  result := result || jsonb_build_object('policy_sub_agent_shares', jsonb_build_object('added', added));

  -- ── insurance_feedback ─────────────────────────────────────────────────────
  INSERT INTO test.insurance_feedback SELECT * FROM public.insurance_feedback
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  result := result || jsonb_build_object('insurance_feedback', jsonb_build_object('added', added));

  -- ── insurance_activity_log ─────────────────────────────────────────────────
  INSERT INTO test.insurance_activity_log SELECT * FROM public.insurance_activity_log
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  result := result || jsonb_build_object('insurance_activity_log', jsonb_build_object('added', added));

  -- ── insurance_login_log ────────────────────────────────────────────────────
  INSERT INTO test.insurance_login_log SELECT * FROM public.insurance_login_log
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  result := result || jsonb_build_object('insurance_login_log', jsonb_build_object('added', added));

  -- ── insurance_snapshots ────────────────────────────────────────────────────
  INSERT INTO test.insurance_snapshots SELECT * FROM public.insurance_snapshots
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  result := result || jsonb_build_object('insurance_snapshots', jsonb_build_object('added', added));

  -- ── insurance_trash ────────────────────────────────────────────────────────
  INSERT INTO test.insurance_trash SELECT * FROM public.insurance_trash
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  result := result || jsonb_build_object('insurance_trash', jsonb_build_object('added', added));

  -- ── terminations ──────────────────────────────────────────────────────────
  INSERT INTO test.terminations SELECT * FROM public.terminations
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;

  UPDATE test.terminations t
  SET policy_id = p.policy_id, reason = p.reason, terminated_at = p.terminated_at,
      updated_at = p.updated_at, created_at = p.created_at
  FROM public.terminations p
  WHERE t.id = p.id AND t.updated_at < p.updated_at;
  GET DIAGNOSTICS updated = ROW_COUNT;
  result := result || jsonb_build_object('terminations',
    jsonb_build_object('added', added, 'updated', updated));

  -- ── sync_log ──────────────────────────────────────────────────────────────
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
