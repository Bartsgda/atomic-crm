-- =====================================================================
-- Insurance extension — lives ALONGSIDE Atomic CRM's core tables.
-- Atomic owns: contacts, deals, companies, sales, contact_notes, deal_notes, tags, tasks
-- We add:      tenants, insurance_clients, policies, policy_notes, sub_agents,
--              policy_sub_agent_shares, terminations, insurers, checklist_templates,
--              insurance_activity_log
-- =====================================================================

create extension if not exists "pgcrypto";

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  business_type text check (business_type in ('INSURANCE','ROAD_ENGINEERING','OTHER')) default 'INSURANCE',
  created_at timestamptz default now()
);

-- Sales extension: tenant_id + role for insurance workflow
alter table public.sales add column if not exists tenant_id uuid references public.tenants(id);
alter table public.sales add column if not exists insurance_role text check (insurance_role in ('owner','admin','agent','sub_agent','viewer'));

create table public.insurers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  short_name text,
  contact_name text, contact_phone text, contact_email text,
  is_visible boolean default true,
  is_custom boolean default false,
  is_global boolean default false,
  created_at timestamptz default now()
);

create table public.insurance_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id bigint references public.sales(id),
  contact_id bigint references public.contacts(id), -- optional link to Atomic contacts
  first_name text not null,
  last_name text not null,
  phones text[] default '{}',
  emails text[] default '{}',
  street text, city text, zip_code text,
  pesel_encrypted text,
  birth_date date,
  gender text check (gender in ('M','F','O')),
  type text check (type in ('PERSON','COMPANY')) default 'PERSON',
  businesses jsonb default '[]'::jsonb,
  rodo_consent boolean default false,
  rodo_consent_date timestamptz,
  source text check (source in ('manual','xlsx_import','sheets_import','legacy_v1','api')) default 'manual',
  legacy_id text,
  is_fake boolean default false,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_ic_tenant on public.insurance_clients(tenant_id);
create index idx_ic_owner on public.insurance_clients(owner_id);
create index idx_ic_legacy on public.insurance_clients(legacy_id);
create index idx_ic_name on public.insurance_clients(last_name, first_name);
create index idx_ic_fake on public.insurance_clients(is_fake) where is_fake = true;

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.insurance_clients(id) on delete cascade,
  owner_id bigint references public.sales(id),
  type text check (type in ('OC','AC','BOTH','DOM','ZYCIE','PODROZ','FIRMA','NNW','OTHER')),
  stage text check (stage in ('of_do_zrobienia','przel_kontakt','czekam_na_dane','oferta_wyslana','sprzedaz','uciety_kontakt','rez_po_ofercie')) default 'of_do_zrobienia',
  insurer_id uuid references public.insurers(id),
  insurer_name text,
  policy_number text,
  premium numeric(12,2),
  commission numeric(12,2),
  commission_rate numeric(5,2),
  payment_status text check (payment_status in ('PAID','UNPAID','PARTIAL')) default 'UNPAID',
  policy_start_date date,
  policy_end_date date,
  next_contact_date date,
  vehicle_brand text, vehicle_model text, vehicle_reg text,
  auto_details jsonb, home_details jsonb, life_details jsonb, travel_details jsonb, firma_details jsonb,
  original_product_string text,
  ai_note text,
  checklist jsonb default '{}'::jsonb,
  calculations jsonb default '[]'::jsonb,
  termination_id uuid,
  source text check (source in ('manual','xlsx_import','sheets_import','legacy_v1')) default 'manual',
  legacy_id text,
  is_fake boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_p_tenant on public.policies(tenant_id);
create index idx_p_client on public.policies(client_id);
create index idx_p_stage on public.policies(stage);
create index idx_p_end_date on public.policies(policy_end_date);
create index idx_p_fake on public.policies(is_fake) where is_fake = true;

create table public.policy_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.insurance_clients(id) on delete cascade,
  linked_policy_ids uuid[] default '{}',
  content text not null,
  tag text,
  reminder_date timestamptz,
  reminder_status text check (reminder_status in ('PRZYPOMNIENIE','UKONCZONE','ANULOWANE')),
  history jsonb default '[]'::jsonb,
  created_by bigint references public.sales(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_pn_client on public.policy_notes(client_id);
create index idx_pn_reminder on public.policy_notes(reminder_date) where reminder_status = 'PRZYPOMNIENIE';
create index idx_pn_linked on public.policy_notes using gin(linked_policy_ids);

create table public.sub_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id bigint references public.sales(id),
  name text not null,
  phone text, email text,
  default_rates jsonb default '{}'::jsonb,
  group_prefix text check (group_prefix in ('firmowy','wlasny','partner')),
  notes text,
  created_at timestamptz default now()
);

create table public.policy_sub_agent_shares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  policy_id uuid not null references public.policies(id) on delete cascade,
  sub_agent_id uuid not null references public.sub_agents(id) on delete cascade,
  rate numeric(5,2),
  amount numeric(12,2),
  note text,
  created_at timestamptz default now()
);

create table public.terminations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  policy_id uuid not null references public.policies(id) on delete cascade,
  sent_date date, document_date date,
  pdf_storage_path text,
  article text check (article in ('28','28a','31','OTHER')) default '28',
  created_by bigint references public.sales(id),
  created_at timestamptz default now()
);

alter table public.policies add constraint fk_policies_termination foreign key (termination_id) references public.terminations(id) on delete set null;

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id bigint references public.sales(id),
  policy_type text,
  items jsonb default '[]'::jsonb,
  is_default boolean default false,
  created_at timestamptz default now()
);

create table public.insurance_activity_log (
  id bigserial primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_id bigint references public.sales(id),
  entity_type text, entity_id uuid,
  action text, diff jsonb,
  created_at timestamptz default now()
);
create index idx_ial_entity on public.insurance_activity_log(entity_type, entity_id);

-- updated_at trigger
create or replace function public.set_updated_at_insurance()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_ic_upd before update on public.insurance_clients for each row execute procedure public.set_updated_at_insurance();
create trigger trg_p_upd before update on public.policies for each row execute procedure public.set_updated_at_insurance();
create trigger trg_pn_upd before update on public.policy_notes for each row execute procedure public.set_updated_at_insurance();

-- RLS
alter table public.tenants enable row level security;
alter table public.insurance_clients enable row level security;
alter table public.policies enable row level security;
alter table public.policy_notes enable row level security;
alter table public.sub_agents enable row level security;
alter table public.policy_sub_agent_shares enable row level security;
alter table public.terminations enable row level security;
alter table public.insurers enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.insurance_activity_log enable row level security;

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer as $$
  select tenant_id from public.sales where user_id = auth.uid() limit 1;
$$;
create or replace function public.is_insurance_admin()
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.sales where user_id = auth.uid() and (insurance_role in ('owner','admin') or administrator=true));
$$;

create policy tenants_read on public.tenants for select using (id = public.current_tenant_id() or public.is_insurance_admin());

do $$
declare t text;
begin
  for t in values ('insurance_clients'),('policies'),('policy_notes'),('sub_agents'),('policy_sub_agent_shares'),('terminations'),('insurers'),('checklist_templates'),('insurance_activity_log')
  loop
    execute format($f$
      create policy "%1$s_sel" on public.%1$I for select using (tenant_id = public.current_tenant_id() or public.is_insurance_admin());
      create policy "%1$s_ins" on public.%1$I for insert with check (tenant_id = public.current_tenant_id() or public.is_insurance_admin());
      create policy "%1$s_upd" on public.%1$I for update using (tenant_id = public.current_tenant_id() or public.is_insurance_admin());
      create policy "%1$s_del" on public.%1$I for delete using (tenant_id = public.current_tenant_id() or public.is_insurance_admin());
    $f$, t);
  end loop;
end $$;

-- SEED
insert into public.tenants (id, name, slug, business_type)
values ('11111111-1111-1111-1111-111111111111','Alina Insurance','alina-insurance','INSURANCE')
on conflict (slug) do nothing;

insert into public.insurers (name, short_name, is_global, tenant_id) values
  ('PZU SA','PZU',true,'11111111-1111-1111-1111-111111111111'),
  ('Warta','Warta',true,'11111111-1111-1111-1111-111111111111'),
  ('Allianz','Allianz',true,'11111111-1111-1111-1111-111111111111'),
  ('Ergo Hestia','Hestia',true,'11111111-1111-1111-1111-111111111111'),
  ('Generali','Generali',true,'11111111-1111-1111-1111-111111111111'),
  ('Compensa','Compensa',true,'11111111-1111-1111-1111-111111111111'),
  ('InterRisk','InterRisk',true,'11111111-1111-1111-1111-111111111111'),
  ('Uniqa','Uniqa',true,'11111111-1111-1111-1111-111111111111'),
  ('Proama','Proama',true,'11111111-1111-1111-1111-111111111111'),
  ('Link4','Link4',true,'11111111-1111-1111-1111-111111111111'),
  ('TUZ','TUZ',true,'11111111-1111-1111-1111-111111111111'),
  ('Wiener','Wiener',true,'11111111-1111-1111-1111-111111111111'),
  ('Balcia','Balcia',true,'11111111-1111-1111-1111-111111111111'),
  ('Beesafe','Beesafe',true,'11111111-1111-1111-1111-111111111111'),
  ('You Can Drive','YCD',true,'11111111-1111-1111-1111-111111111111')
on conflict do nothing;
