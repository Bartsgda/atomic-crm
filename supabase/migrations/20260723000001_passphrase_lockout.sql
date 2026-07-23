-- =====================================================================
-- Eskalująca blokada PassphraseGate (hasło aplikacji ALINA CRM)
--
-- Problem: licznik nieudanych prób odszyfrowania DEK żył w React state
-- (F5 = reset = brak realnego limitu prób). Przenosimy stan server-side.
--
-- Progi (kumulatywne, zerowane po udanym odszyfrowaniu):
--   3 nieudane próby → blokada czasowa 1 min
--   6 nieudanych     → blokada czasowa 5 min
--   9 nieudanych     → hard lock (zdejmuje WYŁĄCZNIE admin:
--                      node scripts/unlock_passphrase.mjs <email>)
--
-- Zapisy TYLKO przez funkcje SECURITY DEFINER (user nie ma INSERT/UPDATE
-- na tabeli — RLS bez policy insert/update dla zwykłego usera).
-- Tabela w public (jak tenant_keys — PassphraseGate używa public client).
-- =====================================================================

-- -----------------------------------------------------------------------
-- 1. Tabela passphrase_lockouts
-- -----------------------------------------------------------------------
create table public.passphrase_lockouts (
  user_id         uuid        primary key references auth.users(id) on delete cascade,
  failed_attempts int         not null default 0,
  locked_until    timestamptz,           -- blokada czasowa (null = brak)
  hard_locked     boolean     not null default false,
  updated_at      timestamptz          default now()
);

-- Trigger updated_at — istniejąca funkcja z 20260418
create trigger trg_pl_upd
  before update on public.passphrase_lockouts
  for each row execute procedure public.set_updated_at_insurance();

-- -----------------------------------------------------------------------
-- 2. Row Level Security
-- -----------------------------------------------------------------------
alter table public.passphrase_lockouts enable row level security;

-- SELECT: własny wiersz LUB admin tenantu (podgląd blokad)
create policy "pl_sel_own" on public.passphrase_lockouts
  for select
  using (
    user_id = auth.uid()
    or public.is_insurance_admin()
  );

-- UPDATE/DELETE: tylko admin (odblokowanie). Zwykły user NIE ma
-- insert/update — jedyna droga zapisu to RPC SECURITY DEFINER niżej.
create policy "pl_upd_admin" on public.passphrase_lockouts
  for update
  using (public.is_insurance_admin());

create policy "pl_del_admin" on public.passphrase_lockouts
  for delete
  using (public.is_insurance_admin());

-- -----------------------------------------------------------------------
-- 3. RPC: rejestracja nieudanej próby (eskalacja progów)
-- -----------------------------------------------------------------------
create or replace function public.register_passphrase_failure()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_row   public.passphrase_lockouts%rowtype;
  v_fails int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.passphrase_lockouts (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select * into v_row
    from public.passphrase_lockouts
   where user_id = v_uid
   for update;

  -- Hard lock albo aktywna blokada czasowa → nie inkrementuj, zwróć stan
  if v_row.hard_locked
     or (v_row.locked_until is not null and v_row.locked_until > now()) then
    return jsonb_build_object(
      'failed_attempts', v_row.failed_attempts,
      'locked_until',    v_row.locked_until,
      'hard_locked',     v_row.hard_locked
    );
  end if;

  v_fails := v_row.failed_attempts + 1;

  update public.passphrase_lockouts
     set failed_attempts = v_fails,
         hard_locked     = (v_fails >= 9),
         locked_until    = case
                             when v_fails >= 9 then null
                             when v_fails >= 6 then now() + interval '5 minutes'
                             when v_fails >= 3 then now() + interval '1 minute'
                             else null
                           end
   where user_id = v_uid
   returning * into v_row;

  return jsonb_build_object(
    'failed_attempts', v_row.failed_attempts,
    'locked_until',    v_row.locked_until,
    'hard_locked',     v_row.hard_locked
  );
end;
$$;

-- -----------------------------------------------------------------------
-- 4. RPC: reset po udanym odszyfrowaniu
--    Hard lock zdejmuje wyłącznie admin — reset działa tylko na blokady
--    czasowe / licznik.
-- -----------------------------------------------------------------------
create or replace function public.reset_passphrase_lockout()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update public.passphrase_lockouts
     set failed_attempts = 0,
         locked_until    = null
   where user_id = v_uid
     and hard_locked = false;
end;
$$;

-- -----------------------------------------------------------------------
-- 5. Grants — jawne (future-proof pod wymuszenie 30.10.2026: public bez
--    auto-GRANT dla anon/authenticated). RLS i tak ogranicza wiersze.
--    INSERT celowo bez grantu — jedyna droga zapisu usera to RPC
--    SECURITY DEFINER (wykonuje się z prawami ownera tabeli).
-- -----------------------------------------------------------------------
revoke all on table public.passphrase_lockouts from public, anon;
grant  select, update, delete on table public.passphrase_lockouts to authenticated;
grant  all on table public.passphrase_lockouts to service_role;

revoke execute on function public.register_passphrase_failure() from public, anon;
revoke execute on function public.reset_passphrase_lockout()    from public, anon;
grant  execute on function public.register_passphrase_failure() to authenticated, service_role;
grant  execute on function public.reset_passphrase_lockout()    to authenticated, service_role;
