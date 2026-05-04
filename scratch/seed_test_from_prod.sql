-- Snapshot piaskownicy: kopia danych z public (prod) -> test schema.
-- Uruchom w Supabase SQL Editor (projekt xqznrssrlnxqkdvisnck) PO zaaplikowaniu
-- migracji 20260504_feedback_admin_reply.sql.
--
-- Bezpieczne: nadpisuje TYLKO test.* (truncate+insert), NIC w public.
-- Dynamic: kopiuje wylacznie wspolne kolumny (jesli schemy sie rozjada,
-- nadmiarowe kolumny w jednej stronie sa pomijane).
--
-- UWAGA: tabele FK-zalezne (np. policies->clients) sa kopiowane w kolejnosci
-- topologicznej. Cascade truncate odpina indices/triggers na czas operacji.

-- ──────────────────────────────────────────────────────────────────────
-- 1. Sanity: czy schema test istnieje?
-- ──────────────────────────────────────────────────────────────────────
do $sanity$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'test') then
    raise exception 'Schema "test" nie istnieje. Uruchom najpierw combined_migrations_test.sql.';
  end if;
end $sanity$;

-- ──────────────────────────────────────────────────────────────────────
-- 2. Funkcja pomocnicza: kopiuje tabele po wspolnych kolumnach
-- ──────────────────────────────────────────────────────────────────────
create or replace function pg_temp.copy_public_to_test(p_table text)
returns int
language plpgsql
as $fn$
declare
  cols text;
  cnt int;
begin
  -- czy obie tabele istnieja
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name=p_table) then
    raise notice 'public.% nie istnieje, skip', p_table;
    return 0;
  end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema='test' and table_name=p_table) then
    raise notice 'test.% nie istnieje, skip', p_table;
    return 0;
  end if;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns pc
  where pc.table_schema='public' and pc.table_name=p_table
    and exists (
      select 1 from information_schema.columns tc
      where tc.table_schema='test' and tc.table_name=p_table
        and tc.column_name=pc.column_name
    );

  execute format('truncate test.%I restart identity cascade', p_table);
  execute format('insert into test.%I (%s) select %s from public.%I', p_table, cols, cols, p_table);
  execute format('select count(*) from test.%I', p_table) into cnt;
  raise notice 'test.% <- public.% : % wierszy', p_table, p_table, cnt;
  return cnt;
end $fn$;

-- ──────────────────────────────────────────────────────────────────────
-- 3. Kolejnosc topologiczna: rodzic -> dziecko
-- ──────────────────────────────────────────────────────────────────────
do $copy$
declare
  total int := 0;
  n int;
  -- Lista tabel w kolejnosci FK. Dostosuj jesli schema test ma wiecej.
  tables text[] := array[
    'tenants',           -- root, wymagany przez kazda tabele insurance
    'sales',             -- userzy/agenci
    'clients',           -- klienci
    'policies',          -- polisy (clients FK)
    'insurance_notes',   -- notatki (clients FK)
    'insurance_feedback' -- feedback (tenants FK, auth.users FK)
  ];
  t text;
begin
  foreach t in array tables loop
    n := pg_temp.copy_public_to_test(t);
    total := total + n;
  end loop;
  raise notice '────────────  RAZEM: % wierszy skopiowanych  ────────────', total;
end $copy$;

-- ──────────────────────────────────────────────────────────────────────
-- 4. Weryfikacja: count w obu schemach
-- ──────────────────────────────────────────────────────────────────────
select 'public' as schema, 'insurance_feedback' as tbl, count(*) from public.insurance_feedback
union all
select 'test',   'insurance_feedback',                   count(*) from test.insurance_feedback
union all
select 'public', 'policies',                             count(*) from public.policies
union all
select 'test',   'policies',                             count(*) from test.policies
order by tbl, schema;
