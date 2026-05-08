-- Fix: init_state views — security_invoker = on
-- Supabase advisor: SECURITY DEFINER views enforce owner permissions,
-- bypassing RLS of the querying user. Both schemas have full grants on
-- the underlying sales table, so invoker mode is safe.

create or replace view public.init_state with (security_invoker = on) as
select count(sub.id) as is_initialized
from (
  select sales.id from public.sales limit 1
) sub;

do $mig$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'test') then
    execute $sql$
      create or replace view test.init_state with (security_invoker = on) as
      select count(id) as is_initialized
      from (select id from test.sales limit 1) as sub
    $sql$;
  end if;
end $mig$;
