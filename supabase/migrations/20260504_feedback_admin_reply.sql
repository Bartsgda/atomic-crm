-- Rozszerzenie insurance_feedback: admin_reply + RPC do toggle status
-- (Sesja DOM 2026-05-04 — Bartek: Alina ma widziec swoje uwagi z checkboxami
--  + nase odpowiedzi; admin widzi swoje i jej; user moze sam zaznaczyc rozwiazane.)

alter table public.insurance_feedback
  add column if not exists admin_reply text,
  add column if not exists admin_reply_at timestamptz,
  add column if not exists admin_reply_by uuid references auth.users(id) on delete set null;

-- RPC: user toggle wlasnego status (open <-> done). Bez zmiany innych pol.
create or replace function public.toggle_my_feedback_resolved(fb_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
  v_new_status text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select status into v_status from public.insurance_feedback
    where id = fb_id and user_id = v_user;

  if v_status is null then
    raise exception 'Feedback not found or not yours';
  end if;

  v_new_status := case when v_status = 'done' then 'open' else 'done' end;

  update public.insurance_feedback
    set status = v_new_status,
        resolved_at = case when v_new_status = 'done' then now() else null end
    where id = fb_id and user_id = v_user;

  return v_new_status;
end $$;

grant execute on function public.toggle_my_feedback_resolved(uuid) to authenticated;

-- RPC: admin pisze odpowiedz (admin_reply). Tylko is_insurance_admin moze.
create or replace function public.set_feedback_admin_reply(fb_id uuid, reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_insurance_admin() then
    raise exception 'Not insurance admin';
  end if;

  update public.insurance_feedback
    set admin_reply = nullif(trim(reply), ''),
        admin_reply_at = case when nullif(trim(reply), '') is null then null else now() end,
        admin_reply_by = case when nullif(trim(reply), '') is null then null else auth.uid() end
    where id = fb_id and tenant_id = public.current_tenant_id();
end $$;

grant execute on function public.set_feedback_admin_reply(uuid, text) to authenticated;
