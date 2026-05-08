-- Rejestr logowań (insurance_login_log)
-- Cel: wiedzieć kto i kiedy się zalogował (Alina vs admin) i czy snapshot
-- był przez niego wyzwolony.
--
-- Wzorzec jak 20260504_feedback_admin_reply.sql:
-- operuje na 'public' + warunkowo na 'test' jeśli schema istnieje.

-- 1. Tabela w public
create table if not exists public.insurance_login_log (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  logged_at    timestamptz not null default now(),
  user_id      uuid        references auth.users(id) on delete set null,
  user_email   text,
  sales_id     bigint      references public.sales(id) on delete set null,
  snapshot_id  uuid        references public.insurance_snapshots(id) on delete set null
);

create index if not exists idx_login_log_tenant_time
  on public.insurance_login_log(tenant_id, logged_at desc);

alter table public.insurance_login_log enable row level security;

-- Admin widzi wszystkie logi swojego tenantu
create policy "login_log_sel_admin" on public.insurance_login_log
  for select using (
    public.is_insurance_admin() and tenant_id = public.current_tenant_id()
  );

-- Każdy zalogowany może wstawić wpis dla swojego tenantu
create policy "login_log_ins" on public.insurance_login_log
  for insert with check (
    auth.uid() is not null and tenant_id = public.current_tenant_id()
  );

-- 2. Ta sama tabela w schemie 'test' (jeśli istnieje)
do $mig$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'test') then
    execute $ddl$
      create table if not exists test.insurance_login_log (
        id           uuid        primary key default gen_random_uuid(),
        tenant_id    uuid        not null references public.tenants(id) on delete cascade,
        logged_at    timestamptz not null default now(),
        user_id      uuid        references auth.users(id) on delete set null,
        user_email   text,
        sales_id     bigint      references public.sales(id) on delete set null,
        snapshot_id  uuid        references public.insurance_snapshots(id) on delete set null
      )
    $ddl$;
    execute $ddl$
      create index if not exists idx_test_login_log_tenant_time
        on test.insurance_login_log(tenant_id, logged_at desc)
    $ddl$;
    execute 'alter table test.insurance_login_log enable row level security';
    execute $pol$
      create policy "login_log_sel_admin" on test.insurance_login_log
        for select using (
          public.is_insurance_admin() and tenant_id = public.current_tenant_id()
        )
    $pol$;
    execute $pol$
      create policy "login_log_ins" on test.insurance_login_log
        for insert with check (
          auth.uid() is not null and tenant_id = public.current_tenant_id()
        )
    $pol$;
  end if;
end $mig$;
