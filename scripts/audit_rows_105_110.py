"""Audyt rows 105-110 — uzupełnienie AUDIT_ROWS_91_110 (zatrzymał się na row_104)."""
import os, json, urllib.request, openpyxl

URL = os.environ['CRM_ALINA_SUPABASE_URL']
KEY = os.environ['CRM_ALINA_SB_SECRET']

HEADERS_XLSX = ['imie_naz','kontakt','etap','kol_kont','tel','email','adres','pesel_nip_regon',
                'co','start_pol','nr_pol','gdzie','przyp','kogo','prow','rozl','niepok',
                'pol_AC_pak','wsp_cesja','rezyg_strata','poprawki','TER','wzn']

def q(path, schema='test'):
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        headers={
            'apikey': KEY,
            'Authorization': f'Bearer {KEY}',
            'Accept-Profile': schema,
        })
    return json.loads(urllib.request.urlopen(req).read())

def jd(v):
    """JSON dump ładny."""
    return json.dumps(v, ensure_ascii=False, indent=2) if v else 'null'

def jf(v):
    """JSON flat — jedna linia."""
    return json.dumps(v, ensure_ascii=False) if v else 'null'

# --- XLSX ---
wb = openpyxl.load_workbook(
    r'C:/BartsGda4/CRM-ALINA/DANE-POZNIEJ-USUN/BAZA_bez_pesel.xlsx',
    data_only=True)
ws = wb['potencjalny']

# Wiersze 105-110 → XLSX rows 107-112 (row 3 = legacy_1)
xlsx_rows = {}
for i in range(105, 111):
    xlsx_r = i + 2  # row 3 = legacy_1, więc legacy_N = xlsx row N+2
    xlsx_rows[f'xlsx_2025_row_{i}'] = {
        HEADERS_XLSX[c]: ws.cell(row=xlsx_r, column=c+1).value
        for c in range(23)
    }

# --- DB ---
legacy_ids = [f'xlsx_2025_row_{i}' for i in range(105, 111)]
ids_str = ','.join(legacy_ids)

policies = q(f"policies?select=*&legacy_id=in.({ids_str})")
policy_map = {p['legacy_id']: p for p in policies}

client_ids = list({p['client_id'] for p in policies if p.get('client_id')})
policy_ids = [p['id'] for p in policies]

clients = q(f"insurance_clients?select=*&id=in.({','.join(client_ids)})")
client_map = {c['id']: c for c in clients}

notes = q(f"policy_notes?select=*&client_id=in.({','.join(client_ids)})&order=created_at")
# group notes by client_id
notes_by_client = {}
for n in notes:
    notes_by_client.setdefault(n['client_id'], []).append(n)

shares = q(f"policy_sub_agent_shares?select=*&policy_id=in.({','.join(policy_ids)})")
shares_by_policy = {}
for s in shares:
    shares_by_policy.setdefault(s['policy_id'], []).append(s)

insurers = {i['id']: i['name'] for i in q("insurers?select=id,name")}
sub_agents_all = {s['id']: s for s in q("sub_agents?select=id,name,group_prefix")}

# --- OUTPUT ---
for lid in legacy_ids:
    row_num = lid.split('_')[-1]
    xl = xlsx_rows.get(lid, {})
    p = policy_map.get(lid)
    if not p:
        print(f"\n### row_{row_num} — BRAK W DB (nie zaimportowany?)\n")
        print(f"XLSX imie_naz: {xl.get('imie_naz')}")
        continue

    cl = client_map.get(p.get('client_id'), {})
    p_notes = notes_by_client.get(p.get('client_id'), [])
    p_shares = shares_by_policy.get(p['id'], [])

    # Build client name
    cl_name = f"{cl.get('first_name','')} {cl.get('last_name','')}".strip()
    insurer_name = insurers.get(p.get('insurer_id'), 'null')
    share_strs = []
    for s in p_shares:
        sa = sub_agents_all.get(s.get('sub_agent_id'), {})
        share_strs.append(f"{s.get('rate','?')}% {sa.get('name','?')} ({sa.get('group_prefix','?')}) / {s.get('amount','?')}")

    phones = json.loads(cl.get('phones') or '[]') if isinstance(cl.get('phones'), str) else (cl.get('phones') or [])
    emails = json.loads(cl.get('emails') or '[]') if isinstance(cl.get('emails'), str) else (cl.get('emails') or [])
    businesses = json.loads(cl.get('businesses') or '[]') if isinstance(cl.get('businesses'), str) else (cl.get('businesses') or [])

    auto_d = p.get('auto_details') or {}
    home_d = p.get('home_details') or {}
    travel_d = p.get('travel_details') or {}
    firma_d = p.get('firma_details') or {}

    print(f"""
### row_{row_num} — {cl_name} ({p.get('type')}, {p.get('stage')})

XLSX raw:
  col[0] imie_naz:  {xl.get('imie_naz')}
  col[1] kontakt:   {xl.get('kontakt')}
  col[2] etap:      {xl.get('etap')}
  col[8] co:        {xl.get('co')}
  col[9] start_pol: {xl.get('start_pol')}
  col[10] nr_pol:   {xl.get('nr_pol')}
  col[11] gdzie:    {xl.get('gdzie')}
  col[12] przyp:    {xl.get('przyp')}
  col[13] kogo:     {xl.get('kogo')}
  col[14] prow:     {xl.get('prow')}
  col[15] rozl:     {xl.get('rozl')}
  col[17] pol_AC:   {xl.get('pol_AC_pak')}
  col[18] wsp:      {xl.get('wsp_cesja')}
  col[19] rezyg:    {xl.get('rezyg_strata')}

DB state:
  client:     {cl_name} | phones={phones} | emails={emails}
  city:       {cl.get('city')} | street: {cl.get('street')} | zip: {cl.get('zip_code')}
  businesses: {jf(businesses)}
  type:       {p.get('type')} | stage: {p.get('stage')}
  start/end:  {p.get('policy_start_date')} / {p.get('policy_end_date')}
  nr_pol:     {p.get('policy_number')} | insurer: {insurer_name}
  premium:    {p.get('premium')} | commission: {p.get('commission')} ({p.get('commission_rate')}%)
  shares:     {' | '.join(share_strs) if share_strs else 'NONE'}
  ai_note:    {p.get('ai_note')}
  auto_d:     {jf(auto_d) if auto_d else 'null'}
  home_d:     {jf(home_d) if home_d else 'null'}
  travel_d:   {jf(travel_d) if travel_d else 'null'}
  firma_d:    {jf(firma_d) if firma_d else 'null'}
  notatki ({len(p_notes)}):""")
    for n in p_notes:
        print(f"    [{n.get('tag')}] {n.get('created_at','')[:10]} | {(n.get('content','') or '')[:120]}")
    print()
