-- Snapshot system — pełny dump danych tenantu jako backup / checkpoint.
-- Widoczny tylko dla adminów (insurance_role='owner' lub 'admin').

create table public.insurance_snapshots (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  created_at   timestamptz not null default now(),
  created_by   bigint      references public.sales(id) on delete set null,
  note         text,
  stats        jsonb       not null default '{}'::jsonb,
  data         jsonb       not null
);

create index idx_snap_tenant_created on public.insurance_snapshots(tenant_id, created_at desc);

alter table public.insurance_snapshots enable row level security;

create policy "snap_sel_admin" on public.insurance_snapshots
  for select using (
    public.is_insurance_admin() and tenant_id = public.current_tenant_id()
  );

create policy "snap_ins_admin" on public.insurance_snapshots
  for insert with check (
    public.is_insurance_admin() and tenant_id = public.current_tenant_id()
  );

create policy "snap_del_admin" on public.insurance_snapshots
  for delete using (
    public.is_insurance_admin() and tenant_id = public.current_tenant_id()
  );
