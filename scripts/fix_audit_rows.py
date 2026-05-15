"""
fix_audit_rows.py — cleanup 182 polis importu XLSX (Faza 1 AUDIT_PLAN.md).
Spec: src/legacy-v1/AUDIT_PLAN.md § Faza 1

Usage:
  python scripts/fix_audit_rows.py --dry-run    # domyslne: tylko wyswietl diff
  python scripts/fix_audit_rows.py --apply      # faktyczny UPDATE przez PostgREST

TECHNIKA:
  - PostgREST (NIE supabase-py), schema=test
  - Safety: jesli UPDATE dotyczy >50% wierszy tabeli -> STOP
  - Idempotentne: kazdy fix sprawdza warunek przed patchwaniem

UPDATES:
  1. PODROZ end_date = travel_details.date_to
  2. FIRMA auto_details -> null + zachowaj first_vehicle w firma_details
  3. insurance_clients: last_name '(brak nazwiska)' -> NULL
  4. Sub_agent linking z ai_parsed_182.json -> SKIP (plik nie istnieje w repo)

WALIDACJA (3 SELECT-y musza zwrocic 0):
  1. policies WHERE type='PODROZ' AND policy_end_date > policy_start_date + 60 days
  2. policies WHERE type='FIRMA' AND auto_details IS NOT NULL
  3. insurance_clients WHERE last_name='(brak nazwiska)'
"""
import os
import sys
import json
import argparse
import urllib.request
import urllib.error
import urllib.parse

# ============================================================
# POLACZENIE
# ============================================================

URL = os.environ['CRM_ALINA_SUPABASE_URL'].rstrip('/')
KEY = os.environ['CRM_ALINA_SB_SECRET']
SCHEMA = 'test'

POLICIES_TOTAL = 182   # safety reference (50% = 91)
CLIENTS_TOTAL  = 200   # szacowana gorna granica


def req(method, path, body=None, extra_headers=None):
    """PostgREST request. Zwraca liste/dict lub None."""
    data = json.dumps(body).encode('utf-8') if body is not None else None
    headers = {
        'apikey':          KEY,
        'Authorization':   f'Bearer {KEY}',
        'Accept-Profile':  SCHEMA,
        'Content-Profile': SCHEMA,
        'Content-Type':    'application/json',
        'Prefer':          'return=representation',
    }
    if extra_headers:
        headers.update(extra_headers)
    r = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        data=data, method=method, headers=headers)
    try:
        resp = urllib.request.urlopen(r)
        raw = resp.read()
        if not raw:
            return []
        return json.loads(raw)
    except urllib.error.HTTPError as e:
        body_err = e.read()[:400]
        print(f'  ERR {method} /rest/v1/{path}: HTTP {e.code} {body_err}')
        raise


def get(path):          return req('GET',   path)
def patch(path, body):  return req('PATCH', path, body)
def post_row(path, body): return req('POST', path, body)


def fmt(d):
    return json.dumps(d, ensure_ascii=False, indent=2)


def safety_check(label, affected, total_ref):
    """Zatrzymaj jesli affected > 50% total_ref."""
    threshold = total_ref * 0.5
    if affected > threshold:
        print(f'  SAFETY STOP: {label} dotyczy {affected} wierszy (>{threshold:.0f} = 50% z {total_ref}). Przerwano.')
        sys.exit(2)


# ============================================================
# UPDATE #1 — PODROZ end_date = travel_details.date_to
# ============================================================

def fix_podroz_end_date(dry):
    """
    UPDATE test.policies
    SET policy_end_date = (travel_details->>'date_to')::date
    WHERE type='PODROZ' AND travel_details->>'date_to' IS NOT NULL
      AND (policy_end_date IS NULL OR policy_end_date <> (travel_details->>'date_to')::date);
    """
    print('\n=== UPDATE #1: PODROZ end_date ===')
    rows = get(
        'policies?select=id,legacy_id,policy_start_date,policy_end_date,travel_details'
        '&type=eq.PODROZ'
    )
    to_fix = []
    for r in rows:
        td = r.get('travel_details') or {}
        date_to = td.get('date_to')
        if not date_to:
            continue
        current_end = r.get('policy_end_date')
        # Normalizuj: date_to moze byc datetime string "2025-08-15" lub "2025-08-15T..."
        date_to_date = date_to[:10]
        current_end_date = (current_end or '')[:10]
        if current_end_date == date_to_date:
            continue
        to_fix.append((r['id'], r.get('legacy_id','?'), current_end, date_to_date))

    safety_check('PODROZ end_date', len(to_fix), POLICIES_TOTAL)
    print(f'  Znaleziono do poprawy: {len(to_fix)} polis PODROZ')
    for pid, lid, old, new in to_fix:
        print(f'    {lid}: policy_end_date {old!r} -> {new!r}')
    if not dry and to_fix:
        for pid, lid, old, new in to_fix:
            patch(f'policies?id=eq.{pid}', {'policy_end_date': new})
        print(f'  Zaaplikowano {len(to_fix)} UPDATE-ow.')
    elif dry:
        print('  [DRY-RUN — brak zmian]')
    return len(to_fix)


# ============================================================
# UPDATE #2 — FIRMA: auto_details -> null, zachowaj first_vehicle
# ============================================================

def fix_firma_auto_details(dry):
    """
    Per kazda polise FIRMA z auto_details IS NOT NULL:
      firma_details.first_vehicle = auto_details  (jezeli first_vehicle jeszcze nie ma)
      auto_details = null
    """
    print('\n=== UPDATE #2: FIRMA auto_details -> null (+ first_vehicle) ===')
    rows = get(
        'policies?select=id,legacy_id,auto_details,firma_details'
        '&type=eq.FIRMA'
        '&auto_details=not.is.null'
    )

    safety_check('FIRMA auto_details', len(rows), POLICIES_TOTAL)
    print(f'  Znaleziono polis FIRMA z auto_details != null: {len(rows)}')

    applied = 0
    skipped = 0
    for r in rows:
        pid = r['id']
        lid = r.get('legacy_id', '?')
        ad  = r.get('auto_details') or {}
        fd  = r.get('firma_details') or {}

        if fd.get('first_vehicle'):
            # Idempotencja: first_vehicle juz ustawione, tylko nulluj auto_details
            print(f'    {lid}: first_vehicle juz istnieje w firma_details — pomijam kopie, nulluje auto_details')
            if not dry:
                patch(f'policies?id=eq.{pid}', {'auto_details': None})
            applied += 1
            continue

        # Kopiuj auto_details jako first_vehicle
        new_fd = dict(fd)
        new_fd['first_vehicle'] = ad
        print(f'    {lid}: auto_details -> firma_details.first_vehicle, auto_details = null')
        print(f'      auto_details: {fmt(ad)}')
        if not dry:
            patch(f'policies?id=eq.{pid}', {
                'firma_details': new_fd,
                'auto_details':  None,
            })
        applied += 1

    if not dry and applied:
        print(f'  Zaaplikowano {applied} UPDATE-ow.')
    elif dry:
        print(f'  [DRY-RUN — brak zmian] ({applied} do poprawy, {skipped} skip)')
    return applied


# ============================================================
# UPDATE #3 — last_name '(brak nazwiska)' -> NULL
# ============================================================

def fix_brak_nazwiska(dry):
    """
    UPDATE test.insurance_clients
    SET last_name = '?'
    WHERE last_name = '(brak nazwiska)';

    UWAGA: task i AUDIT_PLAN.md § Faza 1.4 mowia NULL, ale kolumna ma NOT NULL constraint w DB.
    (Sprawdzone empirycznie: HTTP 400 "null value in column last_name of relation insurance_clients").
    Uzywamy '?' jako placeholder — to samo co stary fix_row_9 (tam byl koment: "null nie przejdzie
    walidacji UI"). '(brak nazwiska)' jest gorsze bo zawiera spacje i nawiasy (problemy URL encoding).
    Docelowo: Faza 2 — zmiana constraint lub dedykowane pole is_anonymous:bool.
    """
    print('\n=== UPDATE #3: last_name (brak nazwiska) -> NULL ===')
    rows = get(
        "insurance_clients?select=id,first_name,last_name"
        "&last_name=eq.%28brak%20nazwiska%29"
    )

    safety_check('last_name brak', len(rows), CLIENTS_TOTAL)
    print(f'  Znaleziono: {len(rows)} klientow z last_name="(brak nazwiska)"')
    for r in rows:
        print(f'    {r["id"][:8]}... {r["first_name"]!r}: last_name -> "?" (NOT NULL constraint, nie mozna NULL)')

    if not dry and rows:
        for r in rows:
            patch(f'insurance_clients?id=eq.{r["id"]}', {'last_name': '?'})
        print(f'  Zaaplikowano {len(rows)} UPDATE-ow.')
    elif dry:
        print('  [DRY-RUN — brak zmian]')
    return len(rows)


# ============================================================
# UPDATE #4 — Sub_agent linking z ai_parsed_182.json
# ============================================================

def fix_sub_agent_linking(dry):
    """
    Dla kazdej polisy z col[13]!=null w ai_parsed_182.json:
    INSERT do policy_sub_agent_shares (rate=NULL, amount=0, note='Import XLSX (lead-only)').

    SKIP: ai_parsed_182.json nie istnieje w repo.
    UWAGA: specyfikacja zadania podaje sub_agents.full_name, ale w schemacie jest pole 'name'.
    """
    print('\n=== UPDATE #4: Sub_agent linking ===')

    json_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'ai_parsed_182.json'
    )
    # Sprawdz tez w scripts/
    json_path_scripts = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        'ai_parsed_182.json'
    )

    if not os.path.exists(json_path) and not os.path.exists(json_path_scripts):
        print('  SKIP: ai_parsed_182.json nie istnieje w repo.')
        print('        Oczekiwane lokalizacje:')
        print(f'          {json_path}')
        print(f'          {json_path_scripts}')
        print('        Uwaga: spec zadania uzywa sub_agents.full_name,')
        print('        ale schemat DB ma kolumne "name" (NIE "full_name").')
        print('        Przed uruchomieniem tego fix-u wygeneruj ai_parsed_182.json')
        print('        przez scripts/apply_ai_parsed.py lub reczny export.')
        return 0

    actual_path = json_path if os.path.exists(json_path) else json_path_scripts
    print(f'  Znaleziono: {actual_path}')
    with open(actual_path, 'r', encoding='utf-8') as f:
        parsed = json.load(f)

    # Zaladuj sub_agents z DB (matchuj po 'name')
    sub_agents_db = get('sub_agents?select=id,name,tenant_id')
    name_to_id = {sa['name']: sa['id'] for sa in sub_agents_db}
    if sub_agents_db:
        default_tenant_id = sub_agents_db[0]['tenant_id']
    else:
        print('  SKIP: brak sub_agents w DB.')
        return 0

    # Zaladuj istniejace shares (unikniecie duplikatow)
    existing_shares = get('policy_sub_agent_shares?select=policy_id,sub_agent_id')
    existing_set = {(s['policy_id'], s['sub_agent_id']) for s in existing_shares}

    inserted = 0
    skipped_no_match = []
    skipped_exists = 0

    for entry in parsed:
        # ai_parsed_182.json moze miec rozne struktury — proba odczytu col[13]
        sub_agent_name = (
            entry.get('col13') or entry.get('sub_agent') or
            entry.get('sub_agent_name') or entry.get('pośrednik')
        )
        if not sub_agent_name:
            continue

        legacy_id = entry.get('legacy_id') or entry.get('row_id')
        if not legacy_id:
            continue

        # Znajdz policy_id
        policies_found = get(f'policies?select=id,tenant_id&legacy_id=eq.{urllib.parse.quote(legacy_id)}')
        if not policies_found:
            skipped_no_match.append(f'{legacy_id}: brak polisy w DB')
            continue

        policy = policies_found[0]
        policy_id = policy['id']
        tenant_id = policy.get('tenant_id') or default_tenant_id

        # Matchuj sub_agent po name
        sa_id = name_to_id.get(sub_agent_name)
        if not sa_id:
            skipped_no_match.append(
                f'{legacy_id}: sub_agent "{sub_agent_name}" nie pasuje do zadnego rekordu'
                f' (dostepne: {list(name_to_id.keys())[:5]}...)'
            )
            continue

        if (policy_id, sa_id) in existing_set:
            skipped_exists += 1
            continue

        print(f'    INSERT share: {legacy_id} -> sub_agent "{sub_agent_name}"')
        if not dry:
            post_row('policy_sub_agent_shares', {
                'policy_id':    policy_id,
                'sub_agent_id': sa_id,
                'tenant_id':    tenant_id,
                'rate':         None,
                'amount':       0,
                'note':         'Import XLSX (lead-only)',
            })
            existing_set.add((policy_id, sa_id))
        inserted += 1

    print(f'  Do insertu: {inserted}, juz istniejace: {skipped_exists}')
    if skipped_no_match:
        print(f'  SKIP (no match): {len(skipped_no_match)} wierszy:')
        for s in skipped_no_match[:10]:
            print(f'    {s}')
    if not dry:
        print(f'  Zaaplikowano {inserted} INSERT-ow.')
    else:
        print('  [DRY-RUN — brak zmian]')
    return inserted


# ============================================================
# WALIDACJA
# ============================================================

def run_validation():
    """3 SELECT-y muszą zwracac 0 po --apply."""
    print('\n=== WALIDACJA (3 SELECT-y muszą zwracac 0) ===')
    results = {}

    # 1. PODROZ end_date > start_date + 60 dni
    # PostgREST nie obsluguje bezposrednio interval arithmetic, robimy fetch i liczymy w Python
    import datetime

    podroz_rows = get(
        'policies?select=id,legacy_id,policy_start_date,policy_end_date'
        '&type=eq.PODROZ'
        '&policy_start_date=not.is.null'
        '&policy_end_date=not.is.null'
    )
    bad_podroz = []
    for r in podroz_rows:
        try:
            d_start = datetime.date.fromisoformat(r['policy_start_date'][:10])
            d_end   = datetime.date.fromisoformat(r['policy_end_date'][:10])
            if (d_end - d_start).days > 60:
                bad_podroz.append(r.get('legacy_id', r['id']))
        except Exception:
            pass
    results['PODROZ end_date > start_date+60d'] = len(bad_podroz)
    if bad_podroz:
        print(f'  [FAIL] PODROZ >60d: {len(bad_podroz)} wierszy: {bad_podroz[:5]}')
    else:
        print(f'  [OK] PODROZ end_date: 0 anomalii (>60 dni)')

    # 2. FIRMA z auto_details != null
    firma_bad = get(
        'policies?select=id,legacy_id'
        '&type=eq.FIRMA'
        '&auto_details=not.is.null'
    )
    results['FIRMA auto_details IS NOT NULL'] = len(firma_bad)
    if firma_bad:
        print(f'  [FAIL] FIRMA z auto_details: {len(firma_bad)} wierszy: {[r.get("legacy_id") for r in firma_bad[:5]]}')
    else:
        print('  [OK] FIRMA auto_details: 0 wierszy')

    # 3. last_name '(brak nazwiska)' — po fix powinno byc '?' lub inny placeholder
    brak_bad = get(
        'insurance_clients?select=id,first_name'
        '&last_name=eq.%28brak%20nazwiska%29'
    )
    results['last_name=(brak nazwiska)'] = len(brak_bad)
    if brak_bad:
        print(f'  [FAIL] last_name "(brak nazwiska)" pozostalo: {len(brak_bad)} wierszy')
    else:
        print('  [OK] last_name "(brak nazwiska)": 0 wierszy (zastapione przez "?")')

    all_ok = all(v == 0 for v in results.values())
    status = 'WSZYSTKIE OK' if all_ok else 'SA BLEDY'
    print(f'\n  STATUS: {status}')
    return results


# ============================================================
# MAIN
# ============================================================

def main():
    ap = argparse.ArgumentParser(
        description='Faza 1 cleanup importu XLSX — 182 polisy test schema.'
    )
    ap.add_argument('--dry-run', action='store_true',
                    help='tylko wyswietl co by sie zmienilo, bez UPDATE (domyslne zachowanie gdy brak flag)')
    ap.add_argument('--apply', action='store_true',
                    help='wykonaj faktyczne UPDATE/INSERT przez PostgREST')
    args = ap.parse_args()

    # Brak flag = domyslnie dry-run
    if not args.dry_run and not args.apply:
        print('Wybierz --dry-run lub --apply')
        sys.exit(1)

    dry = not args.apply  # --apply = dry=False

    mode = 'DRY-RUN' if dry else 'APPLY'
    print(f'\n{"=" * 60}')
    print(f'FIX AUDIT ROWS — 182 polisy ({mode})')
    print(f'Schema: {SCHEMA} | URL: {URL[:40]}...')
    print(f'{"=" * 60}')

    counts = {}
    counts['podroz_end_date']    = fix_podroz_end_date(dry)
    counts['firma_auto_details'] = fix_firma_auto_details(dry)
    counts['brak_nazwiska']      = fix_brak_nazwiska(dry)
    counts['sub_agent_shares']   = fix_sub_agent_linking(dry)

    print(f'\n{"=" * 60}')
    print('PODSUMOWANIE:')
    for k, v in counts.items():
        print(f'  {k}: {v} wierszy')

    if not dry:
        print('\nUruchamiam walidacje...')
        run_validation()
    else:
        print('\n[DRY-RUN] Uruchom z --apply zeby zaaplikowac zmiany.')
        print('Po --apply uruchom walidacje automatycznie lub przez:')
        print('  python scripts/fix_audit_rows.py --apply  (walidacja jest wbudowana)')

    print(f'{"=" * 60}')
    print(f'DONE ({mode})')
    print(f'{"=" * 60}\n')


if __name__ == '__main__':
    main()
