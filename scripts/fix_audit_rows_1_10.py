"""
Fix audit rows 1-10 — quick cleanup po audycie 2026-05-11.
Spec: src/legacy-v1/AUDIT_ROWS_1_10_2026-05-11.md

Usage:
  python scripts/fix_audit_rows_1_10.py --dry-run    # tylko wyświetl co by zrobił
  python scripts/fix_audit_rows_1_10.py --apply      # faktyczny PATCH przez PostgREST
"""
import os, sys, json, argparse, urllib.request, urllib.error

URL = os.environ['CRM_ALINA_SUPABASE_URL']
KEY = os.environ['CRM_ALINA_SB_SECRET']

def req(method, path, body=None, schema='test'):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        data=data, method=method,
        headers={
            'apikey': KEY, 'Authorization': f'Bearer {KEY}',
            'Accept-Profile': schema, 'Content-Profile': schema,
            'Content-Type': 'application/json', 'Prefer': 'return=representation',
        })
    try:
        return json.loads(urllib.request.urlopen(r).read())
    except urllib.error.HTTPError as e:
        print(f'ERR {method} {path}: {e.code} {e.read()[:300]}')
        raise

def get(path): return req('GET', path)
def patch(path, body): return req('PATCH', path, body)
def post(path, body): return req('POST', path, body)
def delete(path): return req('DELETE', path)

def fmt(d): return json.dumps(d, ensure_ascii=False, indent=2)

# =================================================================
# FIXES per row
# =================================================================

def fix_row_5_tron_coowner(dry):
    """row_5 Tron: DELETE fake coOwner kl55 z firma_details, ADD businesses ThePhoenixBarber."""
    p = get("policies?select=id,client_id,firma_details,legacy_id&legacy_id=eq.xlsx_2025_row_5")[0]
    c = get(f"insurance_clients?select=id,businesses&id=eq.{p['client_id']}")[0]
    fd = p['firma_details'] or {}
    new_fd = {k:v for k,v in fd.items() if k != 'coOwners'}
    new_fd.setdefault('asset_type', 'PRZYCZEPA')
    new_fd.setdefault('business_name', 'ThePhoenixBarber')

    biz = c['businesses'] or []
    if not any(b.get('name')=='ThePhoenixBarber' for b in biz):
        biz = biz + [{'name': 'ThePhoenixBarber', 'nip': None}]

    print(f'\n=== row_5 Tron (policy {p["id"][:8]}…) ===')
    print(f'  policies.firma_details: {fmt(fd)} → {fmt(new_fd)}')
    print(f'  clients.businesses: {fmt(c["businesses"])} → {fmt(biz)}')
    if not dry:
        patch(f"policies?id=eq.{p['id']}", {'firma_details': new_fd, 'auto_details': None})
        patch(f"insurance_clients?id=eq.{c['id']}", {'businesses': biz})
        print('  ✅ applied')

def fix_row_6_podroz_end_date(dry):
    """row_6 Obrzud: policy_end_date = travel_details.date_to dla PODROZ."""
    rows = get("policies?select=id,legacy_id,policy_start_date,policy_end_date,travel_details&type=eq.PODROZ&legacy_id=like.xlsx_2025_row_%25")
    print(f'\n=== PODROZ end_date fix (znaleziono {len(rows)} polis) ===')
    for r in rows:
        td = r.get('travel_details') or {}
        date_to = td.get('date_to')
        if not date_to:
            print(f'  {r["legacy_id"]}: brak travel_details.date_to — skip')
            continue
        old = r.get('policy_end_date')
        if old == date_to:
            print(f'  {r["legacy_id"]}: już OK ({date_to})')
            continue
        print(f'  {r["legacy_id"]}: policy_end_date {old} → {date_to}')
        if not dry:
            patch(f"policies?id=eq.{r['id']}", {'policy_end_date': date_to})

def fix_row_3_machol_firma_auto(dry):
    """row_3 Machol: FIRMA powinien mieć auto_details=null, info do firma_details.first_vehicle."""
    p = get("policies?select=id,legacy_id,auto_details,firma_details&legacy_id=eq.xlsx_2025_row_3")[0]
    ad = p.get('auto_details') or {}
    fd = p.get('firma_details') or {}
    print(f'\n=== row_3 Machol (FIRMA flota) ===')
    print(f'  auto_details {fmt(ad)} → null')
    if ad and ad.get('vehicle_type'):
        fd['first_vehicle'] = fd.get('first_vehicle') or {
            'reg': 'WGM3815L',
            'brand': 'Iveco',
            'model': 'Plandeka',
            'dmc': '3.5t',
            'vehicle_type': ad.get('vehicle_type'),
        }
    print(f'  firma_details + first_vehicle: {fmt(fd)}')
    if not dry:
        patch(f"policies?id=eq.{p['id']}", {'auto_details': None, 'firma_details': fd})

def fix_row_9_dominika_lastname(dry):
    """row_9 Dominika: last_name '(brak nazwiska)' → '?' (null nie przejdzie walidacji UI)."""
    p = get("policies?select=client_id&legacy_id=eq.xlsx_2025_row_9")[0]
    c = get(f"insurance_clients?select=id,first_name,last_name&id=eq.{p['client_id']}")[0]
    if c['last_name'] not in ('(brak nazwiska)', None):
        print(f'\n=== row_9 Dominika: last_name już = {c["last_name"]!r}, skip')
        return
    print(f'\n=== row_9 Dominika ===')
    print(f'  last_name: {c["last_name"]!r} → "?"')
    if not dry:
        patch(f"insurance_clients?id=eq.{c['id']}", {'last_name': '?'})

def fix_auto_reg_extract(dry):
    """Dodaj auto_details.reg dla wierszy gdzie reg jest w col[8] lub notatce."""
    fixes = [
        # legacy_id, reg, source
        ('xlsx_2025_row_1',  'G03V',     'col[8] samochód_G03V_OC samo'),
        # row_3 Machol — już w firma_details.first_vehicle.reg po fix_row_3
        # row_5 Tron GD187YG — pojazd w leasingu, osobny asset (TIMELINE)
        # row_10 Stark — Volvo XC60 GD721YL, ale to BOTH, fixujemy poniżej
    ]
    print(f'\n=== auto_details.reg backfill ===')
    for legacy_id, reg, source in fixes:
        p = get(f"policies?select=id,auto_details&legacy_id=eq.{legacy_id}")[0]
        ad = p.get('auto_details') or {}
        if ad.get('reg'):
            print(f'  {legacy_id}: reg już ustawione ({ad["reg"]}), skip')
            continue
        ad['reg'] = reg
        ad['aiNote'] = f'auto-extracted from {source}'
        print(f'  {legacy_id}: reg = {reg} (z {source})')
        if not dry:
            patch(f"policies?id=eq.{p['id']}", {'auto_details': ad})

def fix_row_10_stark_brand(dry):
    """row_10 Stark: dodaj brand/model/reg dla Volvo XC60 GD721YL (BOTH polisa)."""
    p = get("policies?select=id,auto_details&legacy_id=eq.xlsx_2025_row_10")[0]
    ad = p.get('auto_details') or {}
    changed = False
    if not ad.get('brand'):
        ad['brand'] = 'Volvo'
        changed = True
    if not ad.get('model'):
        ad['model'] = 'XC60'
        changed = True
    if not ad.get('reg'):
        ad['reg'] = 'GD721YL'
        changed = True
    if not changed:
        print('\n=== row_10 Stark: już ma brand/model/reg, skip')
        return
    print(f'\n=== row_10 Stark Volvo XC60 GD721YL ===')
    print(f'  auto_details: {fmt(ad)}')
    if not dry:
        patch(f"policies?id=eq.{p['id']}", {'auto_details': ad})

def fix_row_6_obrzud_address(dry):
    """row_6 Obrzud: city='Lelewela' → 'Gdańsk', street='36/140B' → 'ul. Lelewela 36/140B'."""
    p = get("policies?select=client_id&legacy_id=eq.xlsx_2025_row_6")[0]
    c = get(f"insurance_clients?select=id,city,street,zip_code&id=eq.{p['client_id']}")[0]
    print(f'\n=== row_6 Obrzud adres ===')
    if c.get('city') == 'Lelewela' and c.get('street') == '36/140B':
        print(f'  city: "Lelewela" → "Gdańsk", street: "36/140B" → "ul. Lelewela 36/140B"')
        if not dry:
            patch(f"insurance_clients?id=eq.{c['id']}", {
                'city': 'Gdańsk', 'street': 'ul. Lelewela 36/140B'
            })
    else:
        print(f'  Adres inny niż oczekiwany ({c.get("city")}, {c.get("street")}), skip')

def fix_row_2_czechowski_note(dry):
    """row_2 Czechowski: notatka "i 16.06.2025 nie odbiera" → "11.06.2025 i 16.06.2025 nie odbiera"."""
    p = get("policies?select=id,client_id&legacy_id=eq.xlsx_2025_row_2")[0]
    notes = get(f"policy_notes?select=*&client_id=eq.{p['client_id']}")
    print(f'\n=== row_2 Czechowski notatka ===')
    for n in notes:
        if n.get('content') == 'i 16.06.2025 nie odbiera':
            new_content = '11.06.2025 i 16.06.2025 nie odbiera'
            print(f'  notatka {n["id"][:8]}…: "{n["content"]}" → "{new_content}"')
            if not dry:
                patch(f"policy_notes?id=eq.{n['id']}", {'content': new_content})
            return
    print('  notatka nie znaleziona, skip')

def fix_row_9_dominika_note_split(dry):
    """row_9 Dominika: split notatki z 13.05.2025 'ubezp 3 samochody i dom' jako osobnej."""
    p = get("policies?select=id,client_id,tenant_id&legacy_id=eq.xlsx_2025_row_9")[0]
    notes = get(f"policy_notes?select=*&client_id=eq.{p['client_id']}")
    print(f'\n=== row_9 Dominika split notatki ===')
    for n in notes:
        c = n.get('content','')
        if '13.05.2025 ubezp 3 samochody i dom' in c:
            new_main = c.replace('13.05.2025 ubezp 3 samochody i dom','').strip()
            new_main = new_main.rstrip(',').rstrip()
            print(f'  notatka {n["id"][:8]}…: split na 2')
            print(f'    [stara, update] {c[:80]}...')
            print(f'    [stara, update] → {new_main[:80]}...')
            print(f'    [nowa, insert, 2025-05-13 STATUS] "ubezp 3 samochody i dom"')
            if not dry:
                patch(f"policy_notes?id=eq.{n['id']}", {'content': new_main})
                post("policy_notes", {
                    'tenant_id': n['tenant_id'],
                    'client_id': n['client_id'],
                    'linked_policy_ids': n.get('linked_policy_ids'),
                    'tag': 'STATUS',
                    'content': 'ubezp 3 samochody i dom',
                    'created_at': '2025-05-13T12:00:00+00:00',
                })
            return
    print('  fragment 13.05.2025 nie znaleziony, skip')

# =================================================================
# MAIN
# =================================================================

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='tylko wyświetl, NIE PATCH')
    ap.add_argument('--apply', action='store_true', help='wykonaj PATCH')
    args = ap.parse_args()
    if not args.dry_run and not args.apply:
        print('Wybierz --dry-run lub --apply'); sys.exit(1)
    dry = args.dry_run

    print(f'\n{"="*60}\nFIX AUDIT ROWS 1-10  ({"DRY-RUN" if dry else "APPLY"})\n{"="*60}')

    fix_row_5_tron_coowner(dry)
    fix_row_6_podroz_end_date(dry)
    fix_row_3_machol_firma_auto(dry)
    fix_row_9_dominika_lastname(dry)
    fix_auto_reg_extract(dry)
    fix_row_10_stark_brand(dry)
    fix_row_6_obrzud_address(dry)
    fix_row_2_czechowski_note(dry)
    fix_row_9_dominika_note_split(dry)

    print(f'\n{"="*60}\nDONE ({"DRY-RUN, brak zmian" if dry else "PATCH zaaplikowany"})\n{"="*60}')

if __name__ == '__main__':
    main()
