-- =====================================================================
-- Envelope Encryption — tabela kluczy DEK per tenant/user (ALINA CRM)
--
-- Architektura: każdy tenant posiada jeden Data Encryption Key (DEK).
-- DEK jest szyfrowany (wrapped) osobno dla każdego użytkownika kluczem
-- wyprowadzonym z jego hasła przez PBKDF2-SHA256. Zaszyfrowany DEK
-- (ciphertext AES-GCM + IV + tag, Base64) trafia do pola wrapped_dek.
-- Klient deszyfruje DEK lokalnie w przeglądarce — serwer nigdy nie widzi
-- klucza w postaci jawnej. Pole is_recovery oznacza klucz admin-recovery.
-- =====================================================================

-- -----------------------------------------------------------------------
-- 1. Tabela tenant_keys
-- -----------------------------------------------------------------------
create table public.tenant_keys (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references public.tenants(id) on delete cascade,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  wrapped_dek      text        not null,   -- Base64(AES-GCM IV || ciphertext || tag)
  kdf_salt         text        not null,   -- Base64(16 bajtów losowego saltu PBKDF2)
  kdf_iterations   int         not null default 600000,
  kdf_algorithm    text        not null default 'PBKDF2-SHA256',
  key_version      int         not null default 1,   -- dla przyszłych rotacji kluczy
  is_recovery      boolean     not null default false,
  created_at       timestamptz          default now(),
  updated_at       timestamptz          default now(),

  constraint uq_tenant_user_version unique (tenant_id, user_id, key_version)
);

-- -----------------------------------------------------------------------
-- 2. Indeksy
-- -----------------------------------------------------------------------
create index idx_tk_tenant on public.tenant_keys(tenant_id);
create index idx_tk_user   on public.tenant_keys(user_id);

-- -----------------------------------------------------------------------
-- 3. Trigger updated_at — używamy istniejącej funkcji z 20260418
-- -----------------------------------------------------------------------
create trigger trg_tk_upd
  before update on public.tenant_keys
  for each row execute procedure public.set_updated_at_insurance();

-- -----------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------
alter table public.tenant_keys enable row level security;

-- SELECT: własny rekord LUB admin tenantu
create policy "tenant_keys_sel_own" on public.tenant_keys
  for select
  using (
    user_id = auth.uid()
    or (public.is_insurance_admin() and tenant_id = public.current_tenant_id())
  );

-- INSERT: tylko admin tenantu
create policy "tenant_keys_ins" on public.tenant_keys
  for insert
  with check (
    public.is_insurance_admin() and tenant_id = public.current_tenant_id()
  );

-- UPDATE (admin): admin może aktualizować dowolny klucz swojego tenantu
create policy "tenant_keys_upd_admin" on public.tenant_keys
  for update
  using (
    public.is_insurance_admin() and tenant_id = public.current_tenant_id()
  );

-- UPDATE (self): użytkownik może nadpisać własny wrapped_dek po zmianie hasła
create policy "tenant_keys_upd_self" on public.tenant_keys
  for update
  using (
    user_id = auth.uid()
  );

-- DELETE: tylko admin tenantu
create policy "tenant_keys_del" on public.tenant_keys
  for delete
  using (
    public.is_insurance_admin() and tenant_id = public.current_tenant_id()
  );
