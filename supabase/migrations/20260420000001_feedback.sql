-- Feedback / bug-report per tenant. Agent klika "oko" na dowolnym elemencie,
-- dodaje komentarz, zapisuje do Supabase wraz ze screenem miniaturowym.

create table public.insurance_feedback (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         uuid        not null references public.tenants(id) on delete cascade,
  user_id           uuid        references auth.users(id) on delete set null,
  user_email        text,
  route             text,
  element_selector  text,
  element_label     text,
  message           text        not null,
  severity          text        not null default 'info'
                    check (severity in ('info','bug','idea','blocker')),
  screenshot_b64    text,            -- JPEG q~0.5, <~150KB
  viewport_w        int,
  viewport_h        int,
  user_agent        text,
  status            text        not null default 'open'
                    check (status in ('open','seen','done','rejected')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

create index idx_fb_tenant_created on public.insurance_feedback(tenant_id, created_at desc);
create index idx_fb_status on public.insurance_feedback(tenant_id, status);

alter table public.insurance_feedback enable row level security;

-- Każdy zalogowany user tenantu może dodać feedback
create policy "fb_ins_own" on public.insurance_feedback
  for insert with check (
    tenant_id = public.current_tenant_id() and user_id = auth.uid()
  );

-- Każdy widzi swoje wpisy. Admin widzi wszystkie w tenantcie.
create policy "fb_sel" on public.insurance_feedback
  for select using (
    user_id = auth.uid()
    or (public.is_insurance_admin() and tenant_id = public.current_tenant_id())
  );

-- Tylko admin może aktualizować status / oznaczać jako zrobione
create policy "fb_upd_admin" on public.insurance_feedback
  for update using (
    public.is_insurance_admin() and tenant_id = public.current_tenant_id()
  );

create policy "fb_del_admin" on public.insurance_feedback
  for delete using (
    public.is_insurance_admin() and tenant_id = public.current_tenant_id()
  );
