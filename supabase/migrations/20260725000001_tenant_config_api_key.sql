-- =====================================================================
-- tenant_config — klucz API (Gemini) zaszyfrowany DEK (CRM-ALINA)
--
-- ARCHITEKTURA (Bartek 2026-07-24): klucz AI NIE jest w bundlu (byłby publiczny).
-- Jest zaszyfrowany tym samym DEK co dane klientów (envelope encryption) i
-- odszyfrowywany client-side dopiero po podaniu hasła aplikacji przez Alinę
-- (PassphraseGate → DEK → decryptField → apiKeyStore). Klucz żyje tylko w pamięci
-- sesji przeglądarki. Google nigdy nie widzi klucza w spoczynku ani w buildzie.
--
-- Jeden wiersz per tenant (DEK jest wspólny dla tenanta — klucz zapisuje admin raz).
-- =====================================================================

create table if not exists public.tenant_config (
  tenant_id           uuid        primary key references public.tenants(id) on delete cascade,
  encrypted_ai_config text,        -- JSON {keys:[{purpose,label,key,model}]} zaszyfrowany DEK (envelope)
  updated_at          timestamptz  default now()
);

-- Trigger updated_at — istniejąca funkcja z 20260418
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at_insurance') then
    execute 'create trigger trg_tenant_config_upd before update on public.tenant_config
             for each row execute procedure public.set_updated_at_insurance()';
  end if;
exception when duplicate_object then null;
end $$;

alter table public.tenant_config enable row level security;

-- SELECT: każdy zalogowany user swojego tenanta (żeby po passphrase odszyfrować klucz)
create policy "tenant_config_sel" on public.tenant_config
  for select
  using (
    tenant_id = public.current_tenant_id()
    or public.is_insurance_admin()
  );

-- INSERT / UPDATE: tylko admin tenantu (klucz zapisuje Bartek raz, zalogowany = ma DEK)
create policy "tenant_config_ins" on public.tenant_config
  for insert
  with check (
    public.is_insurance_admin() and tenant_id = public.current_tenant_id()
  );

create policy "tenant_config_upd" on public.tenant_config
  for update
  using (
    public.is_insurance_admin() and tenant_id = public.current_tenant_id()
  );

grant select on public.tenant_config to authenticated;
grant insert, update on public.tenant_config to authenticated;  -- RLS ogranicza do admina
