"""
timeline_backfill.py — Faza 3 backfill: homes / business asset_id / policy_terminations / client_attribute_history
Spec: src/legacy-v1/AUDIT_PLAN.md § Faza 3 + src/legacy-v1/TIMELINE_ARCHITECTURE.md
Migration: supabase/migrations/20260515_timeline_architecture.sql (ZAAPLIKOWANA na test 2026-05-15)

Usage:
  python scripts/timeline_backfill.py --dry-run   # domyslne: wyswietl tylko diff
  python scripts/timeline_backfill.py --apply     # faktyczne INSERT/UPDATE przez PostgREST
  python scripts/timeline_backfill.py --step 1    # tylko krok 1 (homes)
  python scripts/timeline_backfill.py --step 2    # tylko krok 2 (business asset_id)
  python scripts/timeline_backfill.py --step 3    # tylko krok 3 (policy_terminations)
  python scripts/timeline_backfill.py --step 4    # tylko krok 4 (client_attribute_history)

KROKI:
  1. HOMES backfill — test.homes + policies.asset_kind/asset_id dla type=DOM
  2. BUSINESS asset_id — policies.asset_kind/asset_id dla type=FIRMA, match po client_businesses
  3. policy_terminations z [STARA POLISA] notatek (~102)
  4. client_attribute_history INITIAL (~350: 3× per klient)

TECHNIKA:
  - PostgREST (NIE supabase-py), schema=test
  - Env: CRM_ALINA_SUPABASE_URL, CRM_ALINA_SB_SECRET (service_role)
  - Idempotentne: sprawdza stan przed INSERT
  - Batch max 200 per POST (bezpieczny margines)
  - source='xlsx_import' (jedyna legalna wartosc CHECK constraint)
    reason='initial_backfill' jako marker idempotencji dla krok 4

OGRANICZENIA SCHEMATU (sprawdzone empirycznie 2026-05-15):
  - homes.source CHECK IN ('manual','xlsx_import','crm','sync') — NIE 'initial_backfill'
  - homes.home_type CHECK IN ('mieszkanie','dom','dom_w_budowie','dzialka','lokal_uzytkowy','inne')
  - client_attribute_history.source CHECK IN ('manual','xlsx_import','crm_edit','sync','api')
  - homes(tenant_id, address_normalized) — INDEX, nie UNIQUE -> SELECT-first dedup
  - policy_notes nie ma kolumny policy_id — uzywaj linked_policy_ids[0] jako new_policy_id
"""
import os
import re
import sys
import json
import argparse
import unicodedata
import urllib.request
import urllib.error
import urllib.parse

# ============================================================
# KONFIGURACJA
# ============================================================

URL       = os.environ['CRM_ALINA_SUPABASE_URL'].rstrip('/')
KEY       = os.environ['CRM_ALINA_SB_SECRET']
SCHEMA    = 'test'
TENANT_ID = '11111111-1111-1111-1111-111111111111'

BATCH_SIZE       = 200
CAH_INIT_REASON  = 'initial_backfill'   # pole reason (bez CHECK) uzywane do idempotencji krok 4
SOURCE_XLSX      = 'xlsx_import'

# Mapowanie home_details.type -> homes.home_type CHECK enum
HOME_TYPE_MAP = {
    'dom':               'dom',
    'DOM':               'dom',
    'mieszkanie':        'mieszkanie',
    'MIESZKANIE':        'mieszkanie',
    'dom w budowie':     'dom_w_budowie',
    'dom_w_budowie':     'dom_w_budowie',
    'dzialka':           'dzialka',
    'dzialka':           'dzialka',
    'lokal':             'lokal_uzytkowy',
    'lokal_uzytkowy':    'lokal_uzytkowy',
    'inne':              'inne',
}


# ============================================================
# HTTP HELPER
# ============================================================

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
        'User-Agent':      'postgrest-cli',
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


def get(path):
    return req('GET', path)


def post_rows(path, rows_list, prefer_upsert=None):
    """POST (INSERT) do PostgREST, batch po BATCH_SIZE."""
    if not rows_list:
        return []
    extra = {}
    if prefer_upsert:
        extra = {'Prefer': prefer_upsert}
    results = []
    for i in range(0, len(rows_list), BATCH_SIZE):
        batch = rows_list[i:i + BATCH_SIZE]
        res = req('POST', path, batch, extra_headers=extra)
        if isinstance(res, list):
            results.extend(res)
        else:
            results.append(res)
    return results


def patch(path, body):
    return req('PATCH', path, body)


def fmt(d):
    return json.dumps(d, ensure_ascii=False)


# ============================================================
# UTILS
# ============================================================

def normalize_address(addr):
    """
    Normalizuje adres do kluczy identyfikujacych home.
    Lowercase, bez diakrytykow, bez 'ul.' prefiksu.
    """
    if not addr:
        return None
    # Usun diakrytyki
    nfkd = unicodedata.normalize('NFKD', addr)
    ascii_str = ''.join(c for c in nfkd if not unicodedata.combining(c))
    # Lowercase, usun 'ul.' / 'al.' / 'os.' prefiksy
    s = ascii_str.lower()
    s = re.sub(r'\bul\.\s*', '', s)
    s = re.sub(r'\bal\.\s*', '', s)
    s = re.sub(r'\bos\.\s*', '', s)
    # Zamien spacje i przecinki na myslniki
    s = re.sub(r'[\s,]+', '-', s)
    # Usun znaki specjalne oprocz cyfr, liter ascii, myslnikow i ukosnikow
    s = re.sub(r'[^a-z0-9\-/]', '', s)
    # Znormalizuj wielokrotne myslniki
    s = re.sub(r'-+', '-', s)
    return s.strip('-')


def parse_address_parts(addr):
    """
    Probie parsowac adres w formacie '80-XXX Miasto Ulica N' lub 'Miasto Ulica N'.
    Zwraca dict {city, zip_code}.
    """
    if not addr:
        return {}
    # Szukaj kodu pocztowego
    zip_match = re.search(r'\b(\d{2}-\d{3})\b', addr)
    zip_code = zip_match.group(1) if zip_match else None

    result = {'zip_code': zip_code}

    # Probie wyciagnac miasto (pierwsze slowo po kodzie pocztowym lub na poczatku)
    if zip_match:
        after_zip = addr[zip_match.end():].strip().lstrip(',').strip()
        # Pierwsze "slowo" (az do cyfry lub ul.)
        city_match = re.match(r'^([A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+(?:\s[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+)*)', after_zip)
        if city_match:
            result['city'] = city_match.group(1).strip()
    else:
        # Bez kodu: probuj pierwsze slowo jak Bojano, Banino, etc.
        city_match = re.match(r'^([A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+)', addr.strip())
        if city_match:
            result['city'] = city_match.group(1).strip()

    return result


def map_home_type(raw_type):
    """Mapuje home_details.type -> homes.home_type CHECK enum. None jesli nierozpoznane."""
    if not raw_type:
        return None
    return HOME_TYPE_MAP.get(raw_type, None)


def excerpt(text, max_len=100):
    """Skrocony tekst do ai_note."""
    if not text:
        return ''
    if len(text) <= max_len:
        return text
    return text[:max_len] + '...'


# ============================================================
# KROK 1 — HOMES backfill
# ============================================================

def step1_homes(dry, policies_dom, existing_homes):
    """
    Dla kazdej polisy DOM:
      1. Normalize address z home_details.address
      2. UPSERT (SELECT-first, bo nie ma UNIQUE constraint) do test.homes
      3. UPDATE policies.asset_kind='HOME', asset_id=home.id
    """
    print('\n' + '=' * 60)
    print('KROK 1: HOMES backfill (test.homes + policies.asset_kind/asset_id)')
    print('=' * 60)

    # Indeks istniejacych homes po (tenant_id, address_normalized)
    homes_by_addr = {
        (h['tenant_id'], h['address_normalized']): h
        for h in existing_homes
    }

    to_insert_homes = []    # nowe homes
    to_update_policies = [] # UPDATE policies SET asset_kind, asset_id
    skipped_no_address = []
    skipped_already_linked = []

    for p in policies_dom:
        pid = p['id']
        lid = p.get('legacy_id', '?')
        hd  = p.get('home_details') or {}
        addr_raw = hd.get('address')
        tenant   = p.get('tenant_id') or TENANT_ID
        client   = p.get('client_id')

        # Juz ma asset_kind=HOME — sprawdz czy asset_id tez jest
        if p.get('asset_kind') == 'HOME' and p.get('asset_id'):
            skipped_already_linked.append(lid)
            continue

        if not addr_raw or not addr_raw.strip():
            skipped_no_address.append(lid)
            continue

        addr_norm = normalize_address(addr_raw)
        if not addr_norm:
            skipped_no_address.append(lid)
            continue

        addr_parts = parse_address_parts(addr_raw)
        home_type  = map_home_type(hd.get('type'))
        legacy_home_id = f'xlsx_2025_home_{lid}'

        key = (tenant, addr_norm)

        if key in homes_by_addr:
            # Home juz istnieje — tylko linkuj polise
            home_id = homes_by_addr[key]['id']
            print(f'  {lid}: home EXIST addr_norm={addr_norm!r} -> home_id={home_id[:8]}...')
            if p.get('asset_id') != home_id or p.get('asset_kind') != 'HOME':
                to_update_policies.append((pid, lid, home_id))
        else:
            # Nowy home
            new_home = {
                'tenant_id':          tenant,
                'client_id':          client,
                'address_normalized': addr_norm,
                'address_raw':        addr_raw,
                'city':               addr_parts.get('city'),
                'zip_code':           addr_parts.get('zip_code'),
                'home_type':          home_type,
                'status':             'ACTIVE',
                'source':             SOURCE_XLSX,
                'legacy_id':          legacy_home_id,
            }
            print(f'  {lid}: home INSERT addr_norm={addr_norm!r} city={addr_parts.get("city")} home_type={home_type}')
            to_insert_homes.append((new_home, pid, lid))
            # Placeholder w homes_by_addr zeby nie duplikowac (ten sam adres w kilku polisach DOM)
            homes_by_addr[key] = {'id': '__PENDING__', 'address_normalized': addr_norm, 'tenant_id': tenant}

    print(f'\n  Do INSERT (nowe homes):     {len(to_insert_homes)}')
    print(f'  Do UPDATE (polisy link):    {len(to_update_policies) + len(to_insert_homes)}')
    print(f'  Juz polaczone:              {len(skipped_already_linked)}')
    print(f'  Brak adresu (skip):         {len(skipped_no_address)}')
    if skipped_no_address:
        print(f'    Skip (brak adresu): {skipped_no_address}')

    if dry:
        print('  [DRY-RUN — brak zmian]')
        return 0, 0

    # INSERT nowe homes
    inserted_homes = 0
    for (home_dict, pid, lid) in to_insert_homes:
        result = req('POST', 'homes', home_dict)
        if isinstance(result, list) and result:
            home_id = result[0]['id']
        elif isinstance(result, dict):
            home_id = result['id']
        else:
            print(f'  WARN: INSERT home dla {lid} nie zwrocil id')
            continue
        # Aktualizuj indeks
        key2 = (home_dict['tenant_id'], home_dict['address_normalized'])
        homes_by_addr[key2] = {'id': home_id}
        to_update_policies.append((pid, lid, home_id))
        inserted_homes += 1
        print(f'    home INSERT OK: {lid} -> home_id={home_id[:8]}...')

    # UPDATE policies.asset_kind/asset_id
    updated_policies = 0
    for (pid, lid, home_id) in to_update_policies:
        patch(f'policies?id=eq.{pid}', {'asset_kind': 'HOME', 'asset_id': home_id})
        updated_policies += 1
        print(f'    policy UPDATE OK: {lid} -> asset_kind=HOME asset_id={home_id[:8]}...')

    print(f'\n  DONE krok 1: {inserted_homes} homes INSERT, {updated_policies} policies UPDATE')
    return inserted_homes, updated_policies


# ============================================================
# KROK 2 — BUSINESS asset_id backfill
# ============================================================

def step2_business(dry, policies_firma, client_businesses):
    """
    Dla kazdej polisy FIRMA:
      Znajdz matching client_businesses po (client_id, nip) lub (client_id, name case-insensitive)
      UPDATE policies.asset_kind='BUSINESS', asset_id=business.id
      Brak matchu -> SKIP + log
    """
    print('\n' + '=' * 60)
    print('KROK 2: BUSINESS asset_id backfill (policies FIRMA -> client_businesses)')
    print('=' * 60)

    # Indeks businesses: client_id -> lista {id, name, nip}
    biz_by_client = {}
    for b in client_businesses:
        cid = b['client_id']
        if cid not in biz_by_client:
            biz_by_client[cid] = []
        biz_by_client[cid].append(b)

    updated = 0
    skipped_already_linked = []
    skipped_no_match = []

    for p in policies_firma:
        pid = p['id']
        lid = p.get('legacy_id', '?')
        fd  = p.get('firma_details') or {}
        client_id = p.get('client_id')

        # Juz polaczone
        if p.get('asset_kind') == 'BUSINESS' and p.get('asset_id'):
            skipped_already_linked.append(lid)
            continue

        businesses_for_client = biz_by_client.get(client_id, [])

        if not businesses_for_client:
            skipped_no_match.append(f'{lid}: brak client_businesses dla client_id={client_id}')
            continue

        # NIP z firma_details
        nip = fd.get('nip')

        matched_biz = None

        # 1. Match po NIP (najdokladniejszy)
        if nip:
            for b in businesses_for_client:
                if b.get('nip') == nip:
                    matched_biz = b
                    break

        # 2. Match po nazwie (case-insensitive, substring)
        if not matched_biz:
            desc = (fd.get('description') or '').lower().strip()
            if desc:
                for b in businesses_for_client:
                    bname = (b.get('name') or '').lower().strip()
                    if bname and (bname in desc or desc in bname):
                        matched_biz = b
                        break

        # 3. Jesli jest tylko jedna firma dla klienta -> match domyslny
        if not matched_biz and len(businesses_for_client) == 1:
            matched_biz = businesses_for_client[0]
            print(f'  {lid}: FIRMA match domyslny (1 firma dla klienta): {matched_biz["name"]!r}')

        if not matched_biz:
            biz_names = [b['name'] for b in businesses_for_client]
            skipped_no_match.append(
                f'{lid}: brak match (client={client_id[:8]}, '
                f'desc={fd.get("description","")!r}, '
                f'dostepne: {biz_names})'
            )
            continue

        biz_id = matched_biz['id']
        print(f'  {lid}: FIRMA link -> business "{matched_biz["name"]!r}" ({biz_id[:8]}...)')

        if not dry:
            patch(f'policies?id=eq.{pid}', {'asset_kind': 'BUSINESS', 'asset_id': biz_id})
            updated += 1
        else:
            updated += 1

    print(f'\n  Do UPDATE:             {updated}')
    print(f'  Juz polaczone:         {len(skipped_already_linked)}')
    print(f'  Brak matchu (skip):    {len(skipped_no_match)}')
    if skipped_no_match:
        print('\n  Skip FIRMA bez matchu:')
        for s in skipped_no_match:
            print(f'    {s}')

    if dry:
        print('  [DRY-RUN — brak zmian]')
    return updated, skipped_no_match


# ============================================================
# KROK 3 — policy_terminations z notatek
# ============================================================

# Mapa regexow do parsowania TU z roznych formatow
_TU_PATTERNS = [
    # '[STARA POLISA] stara <TU> nr <NR>'
    re.compile(
        r'\[STARA POLISA\]\s+stara\s+(\w[\w\s]*?)\s+nr\s+([A-Z0-9a-z_\-/\.]+)',
        re.IGNORECASE
    ),
    # '[STARA POLISA] stara polisa <TU> nr <NR>'
    re.compile(
        r'\[STARA POLISA\]\s+stara\s+polisa\s+(\w[\w\s]*?)\s+nr\s+([A-Z0-9a-z_\-/\.]+)',
        re.IGNORECASE
    ),
    # '[STARA POLISA] stara polisa w <TU> nr <NR>'
    re.compile(
        r'\[STARA POLISA\]\s+stara\s+polisa\s+w\s+(\w+)\s+nr\s+([A-Z0-9a-z_\-/\.]+)',
        re.IGNORECASE
    ),
    # '[STARA POLISA] stara w <TU> nr <NR>' / '[STARA POLISA] stara w <TU>'
    re.compile(
        r'\[STARA POLISA\]\s+stara\s+w\s+(\w+)(?:\s+nr\s+([A-Z0-9a-z_\-/\.]+))?',
        re.IGNORECASE
    ),
    # '[STARA POLISA] <TU> <NR>' — samo TU + numer (bez 'stara')
    re.compile(
        r'\[STARA POLISA\]\s+([A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]{3,})\s+([A-Z0-9a-z_\-/\.]{5,})',
        re.IGNORECASE
    ),
    # '[STARA POLISA] <TU>' — samo TU (bez numeru)
    re.compile(
        r'\[STARA POLISA\]\s+([A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]{3,})(?:\s|$)',
        re.IGNORECASE
    ),
]

# Slowa kluczowe ktore sa NA PEWNO nie-TU (numerami, slugami itp.)
_NON_TU_WORDS = {
    'stara', 'polisa', 'w', 'do', 'na', 'ze', 'z', 'nr', 'pin',
    'brak', 'pierwsza', 'rejestracja', 'nowy', 'nowa', 'nowo', 'kupiony',
    'wznowienie', 'inny', 'inne', 'moja', 'oferta', 'zostali', 'nie', 'byl',
    'ubezpieczenie', 'od', 'kilku', 'lat', 'po', 'raz', 'pierwszy',
    'sprowadzany', 'sprowadzana', 'pbierwsze', 'za',
    '?', 'brak'
}


def detect_status(content):
    """
    Sprawdza content notatki pod katem statusu wypowiedzenia.
    REGISTERED wygrywa nad SENT nad DRAFT.
    """
    low = content.lower()
    if re.search(r'zarejestrowan', low):
        return 'REGISTERED'
    if re.search(r'wys[lł](a[lł]|ana|am)', low):
        return 'SENT'
    return 'DRAFT'


def parse_old_policy_from_note(content):
    """
    Probuje wyciagnac old_insurer_name + old_policy_number z tresci notatki.
    Zwraca dict z kluczami old_insurer_name, old_policy_number (lub None).
    """
    # Probuj kazdego wzorca od najdokladniejszego
    for pat in _TU_PATTERNS[:4]:  # wzorce z numerem
        m = pat.search(content)
        if m:
            groups = m.groups()
            insurer = groups[0].strip() if groups[0] else None
            number  = groups[1].strip() if len(groups) > 1 and groups[1] else None
            if insurer and insurer.lower() not in _NON_TU_WORDS:
                return {'old_insurer_name': insurer, 'old_policy_number': number}

    # Wzorce bez numeru (samo TU)
    for pat in _TU_PATTERNS[4:]:
        m = pat.search(content)
        if m:
            groups = m.groups()
            insurer = groups[0].strip() if groups[0] else None
            number  = groups[1].strip() if len(groups) > 1 and groups[1] else None
            if insurer and insurer.lower() not in _NON_TU_WORDS:
                return {'old_insurer_name': insurer, 'old_policy_number': number}

    return {'old_insurer_name': None, 'old_policy_number': None}


def step3_terminations(dry, all_notes, existing_term_note_ids):
    """
    Dla kazdej notatki zawierajacej '[STARA POLISA]':
      - Parsuj insurer + numer polisy + status
      - INSERT do test.policy_terminations
      - Idempotencja: skip jesli source_note_id juz w existing_term_note_ids
    """
    print('\n' + '=' * 60)
    print('KROK 3: policy_terminations z notatek [STARA POLISA]')
    print('=' * 60)

    stara_notes = [n for n in all_notes if n.get('content') and 'STARA POLISA' in n['content']]
    print(f'  Notatek z [STARA POLISA]: {len(stara_notes)}')
    print(f'  Juz przetworzonych:       {len(existing_term_note_ids)}')

    to_insert = []
    skipped_existing = 0
    skipped_no_policy = []

    for note in stara_notes:
        note_id = note['id']

        # Idempotencja
        if note_id in existing_term_note_ids:
            skipped_existing += 1
            continue

        content   = note['content']
        tenant    = note.get('tenant_id') or TENANT_ID
        linked    = note.get('linked_policy_ids') or []

        # new_policy_id = pierwsza polisa z linked_policy_ids
        new_policy_id = linked[0] if linked else None

        if not new_policy_id:
            skipped_no_policy.append(f"note={note_id[:8]} legacy={note.get('legacy_id')}: brak linked_policy_ids")
            continue

        # Parsuj TU + numer
        parsed = parse_old_policy_from_note(content)
        status = detect_status(content)

        row = {
            'tenant_id':          tenant,
            'new_policy_id':      new_policy_id,
            'old_policy_id':      None,
            'old_insurer_name':   parsed['old_insurer_name'],
            'old_policy_number':  parsed['old_policy_number'],
            'status':             status,
            'ai_extracted':       True,
            'ai_note':            f'parsed from note: "{excerpt(content, 100)}"',
            'source_note_id':     note_id,
            'confirmed_at':       None,
        }

        print(
            f'  {note.get("legacy_id","?")} -> '
            f'TU={parsed["old_insurer_name"]!r} nr={parsed["old_policy_number"]!r} '
            f'status={status}'
        )
        to_insert.append(row)

    print(f'\n  Do INSERT:              {len(to_insert)}')
    print(f'  Juz istnieje (skip):    {skipped_existing}')
    print(f'  Brak linked_policy_ids: {len(skipped_no_policy)}')
    if skipped_no_policy:
        for s in skipped_no_policy:
            print(f'    {s}')

    if dry:
        print('  [DRY-RUN — brak zmian]')
        return len(to_insert), skipped_no_policy

    # Batch INSERT (max BATCH_SIZE per request)
    total_inserted = 0
    for i in range(0, len(to_insert), BATCH_SIZE):
        batch = to_insert[i:i + BATCH_SIZE]
        result = req('POST', 'policy_terminations', batch,
                     extra_headers={'Prefer': 'return=representation'})
        inserted = len(result) if isinstance(result, list) else (1 if result else 0)
        total_inserted += inserted
        print(f'  Batch {i//BATCH_SIZE + 1}: INSERT {inserted} wierszy')

    print(f'\n  DONE krok 3: {total_inserted} policy_terminations INSERT')
    return total_inserted, skipped_no_policy


# ============================================================
# KROK 4 — client_attribute_history INITIAL
# ============================================================

def step4_client_attribute_history(dry, clients, existing_cah_client_ids):
    """
    Dla kazdego klienta w test.insurance_clients:
      INSERT 3 rekordy (PHONE, EMAIL, ADDRESS) z valid_from=client.created_at
      Idempotencja: skip jesli klient juz ma rekordy z reason='initial_backfill'
      Pomijamy atrybuty gdzie value jest null/pusty.
    """
    print('\n' + '=' * 60)
    print('KROK 4: client_attribute_history INITIAL (~3 per klient)')
    print('=' * 60)
    print(f'  Klientow lacznie:          {len(clients)}')
    print(f'  Juz z initial_backfill:    {len(existing_cah_client_ids)}')

    to_insert = []
    skipped_existing = 0
    skipped_empty_all = []

    for c in clients:
        cid    = c['id']
        tenant = c.get('tenant_id') or TENANT_ID

        # Idempotencja — jesli klient ma juz przynajmniej 1 rekord initial_backfill, skip
        if cid in existing_cah_client_ids:
            skipped_existing += 1
            continue

        valid_from = c.get('created_at') or 'now()'
        attrs_added = 0

        # PHONE — w DB jako JSON string (np. '["601234567"]') lub lista
        phones_raw = c.get('phones')
        if phones_raw:
            if isinstance(phones_raw, str):
                try:
                    phones_val = json.loads(phones_raw)
                except (ValueError, TypeError):
                    phones_val = [phones_raw]
            else:
                phones_val = phones_raw
            if phones_val:
                to_insert.append({
                    'tenant_id':   tenant,
                    'client_id':   cid,
                    'attribute':   'PHONE',
                    'value_old':   None,
                    'value_new':   phones_val,
                    'valid_from':  valid_from,
                    'valid_to':    None,
                    'source':      SOURCE_XLSX,
                    'reason':      CAH_INIT_REASON,
                })
                attrs_added += 1

        # EMAIL — w DB jako JSON string (np. '["anna@example.com"]') lub lista
        emails_raw = c.get('emails')
        if emails_raw:
            if isinstance(emails_raw, str):
                try:
                    emails_val = json.loads(emails_raw)
                except (ValueError, TypeError):
                    emails_val = [emails_raw]
            else:
                emails_val = emails_raw
            if emails_val:
                to_insert.append({
                    'tenant_id':   tenant,
                    'client_id':   cid,
                    'attribute':   'EMAIL',
                    'value_old':   None,
                    'value_new':   emails_val,
                    'valid_from':  valid_from,
                    'valid_to':    None,
                    'source':      SOURCE_XLSX,
                    'reason':      CAH_INIT_REASON,
                })
                attrs_added += 1

        # ADDRESS — insurance_clients uzywa osobnych pol (street, city, zip_code)
        street   = c.get('street')
        city_val = c.get('city')
        zip_val  = c.get('zip_code')
        if street or city_val or zip_val:
            addr_val = {'street': street, 'city': city_val, 'zip_code': zip_val}
            to_insert.append({
                'tenant_id':   tenant,
                'client_id':   cid,
                'attribute':   'ADDRESS',
                'value_old':   None,
                'value_new':   addr_val,
                'valid_from':  valid_from,
                'valid_to':    None,
                'source':      SOURCE_XLSX,
                'reason':      CAH_INIT_REASON,
            })
            attrs_added += 1

        if attrs_added == 0:
            skipped_empty_all.append(cid[:8])

    print(f'  Do INSERT (rekordy):       {len(to_insert)}')
    print(f'  Klientow juz przetworzonych: {skipped_existing}')
    print(f'  Klientow bez danych (skip):  {len(skipped_empty_all)}')

    if dry:
        print('  [DRY-RUN — brak zmian]')
        return len(to_insert)

    # Batch INSERT
    total_inserted = 0
    for i in range(0, len(to_insert), BATCH_SIZE):
        batch = to_insert[i:i + BATCH_SIZE]
        result = req('POST', 'client_attribute_history', batch,
                     extra_headers={'Prefer': 'return=representation'})
        inserted = len(result) if isinstance(result, list) else (1 if result else 0)
        total_inserted += inserted
        print(f'  Batch {i//BATCH_SIZE + 1}: INSERT {inserted} wierszy')

    print(f'\n  DONE krok 4: {total_inserted} client_attribute_history INSERT')
    return total_inserted


# ============================================================
# WALIDACJA
# ============================================================

def run_validation():
    """5 SELECT-ow walidacyjnych po --apply."""
    print('\n' + '=' * 60)
    print('WALIDACJA (5 SELECT-ow)')
    print('=' * 60)

    # 1. COUNT homes
    homes_all = get('homes?select=id')
    print(f'  1. test.homes COUNT:                     {len(homes_all)} (oczekiwane: >0)')

    # 2. policies DOM bez asset_kind
    dom_no_asset = get('policies?type=eq.DOM&asset_kind=is.null&select=id,legacy_id')
    print(f'  2. policies DOM bez asset_kind:          {len(dom_no_asset)} (oczekiwane: ~0 lub male)')
    if dom_no_asset:
        for r in dom_no_asset[:5]:
            print(f'     {r.get("legacy_id")}')

    # 3. policies FIRMA bez asset_kind
    firma_no_asset = get('policies?type=eq.FIRMA&asset_kind=is.null&select=id,legacy_id')
    print(f'  3. policies FIRMA bez asset_kind:        {len(firma_no_asset)} (brak matchu OK)')
    if firma_no_asset:
        for r in firma_no_asset[:5]:
            print(f'     {r.get("legacy_id")}')

    # 4. COUNT policy_terminations
    terms = get('policy_terminations?select=id')
    print(f'  4. test.policy_terminations COUNT:       {len(terms)} (oczekiwane: ~50-102)')

    # 5. COUNT client_attribute_history
    cah = get('client_attribute_history?select=id')
    print(f'  5. test.client_attribute_history COUNT:  {len(cah)} (oczekiwane: >0, ~3xN klientow)')

    print('\n  STATUS:', 'OK' if len(homes_all) > 0 and len(terms) > 0 and len(cah) > 0 else 'SPRAWDZ RECZNE')


# ============================================================
# MAIN
# ============================================================

def main():
    ap = argparse.ArgumentParser(
        description='Faza 3 TIMELINE backfill: homes, business asset_id, terminations, client_attribute_history'
    )
    ap.add_argument('--dry-run', action='store_true',
                    help='tylko wyswietl co by sie zmienilo (domyslne bez flag)')
    ap.add_argument('--apply',   action='store_true',
                    help='wykonaj faktyczne INSERT/UPDATE przez PostgREST')
    ap.add_argument('--step',    type=int, choices=[1, 2, 3, 4],
                    help='uruchom tylko wskazany krok (1=homes, 2=business, 3=terminations, 4=cah)')
    args = ap.parse_args()

    if not args.dry_run and not args.apply:
        print('Wybierz --dry-run lub --apply')
        sys.exit(1)

    dry  = not args.apply
    mode = 'DRY-RUN' if dry else 'APPLY'

    print(f'\n{"=" * 60}')
    print(f'TIMELINE BACKFILL — Faza 3 ({mode})')
    print(f'Schema: {SCHEMA} | URL: {URL[:50]}...')
    print(f'{"=" * 60}')

    # ---------------------------------------------------------
    # Zaladuj dane wspolne (1 batch per tabela)
    # ---------------------------------------------------------
    print('\nLaduje dane z DB...')

    # Polisy DOM (wszystkie)
    policies_dom = get(
        'policies?type=eq.DOM'
        '&select=id,legacy_id,client_id,tenant_id,home_details,asset_kind,asset_id'
        '&limit=500'
    )
    print(f'  Polisy DOM:                {len(policies_dom)}')

    # Polisy FIRMA (wszystkie)
    policies_firma = get(
        'policies?type=eq.FIRMA'
        '&select=id,legacy_id,client_id,tenant_id,firma_details,asset_kind,asset_id'
        '&limit=200'
    )
    print(f'  Polisy FIRMA:              {len(policies_firma)}')

    # Istniejace homes
    existing_homes = get('homes?select=id,tenant_id,address_normalized&limit=500')
    print(f'  Istniejace homes:          {len(existing_homes)}')

    # client_businesses
    client_businesses = get('client_businesses?select=id,client_id,name,nip,tenant_id&limit=200')
    print(f'  client_businesses:         {len(client_businesses)}')

    # Wszystkie notatki (max 600 — bezpieczny margines)
    all_notes = get('policy_notes?select=id,tenant_id,client_id,linked_policy_ids,content,tag,created_at,legacy_id&limit=600')
    print(f'  Notatki lacznie:           {len(all_notes)}')

    # Istniejace policy_terminations (source_note_id)
    existing_terms = get('policy_terminations?select=source_note_id&source_note_id=not.is.null&limit=500')
    existing_term_note_ids = {t['source_note_id'] for t in existing_terms if t.get('source_note_id')}
    print(f'  Istniejace terminations:   {len(existing_term_note_ids)}')

    # Istniejace client_attribute_history (initial_backfill po reason)
    existing_cah = get(
        'client_attribute_history?select=client_id'
        f'&reason=eq.{CAH_INIT_REASON}'
        '&limit=1000'
    )
    existing_cah_client_ids = {r['client_id'] for r in existing_cah}
    print(f'  Klientow z CAH initial:    {len(existing_cah_client_ids)}')

    # insurance_clients (wszystkie)
    # Uwaga: kolumna address_jsonb nie istnieje — adres jest w osobnych polach (street, city, zip_code)
    clients = get('insurance_clients?select=id,tenant_id,phones,emails,street,city,zip_code,created_at&limit=500')
    print(f'  Klientow lacznie:          {len(clients)}')

    print()

    # ---------------------------------------------------------
    # Uruchom kroki
    # ---------------------------------------------------------
    counts = {}
    only_step = args.step

    if only_step is None or only_step == 1:
        h_ins, h_upd = step1_homes(dry, policies_dom, existing_homes)
        counts['homes_inserted'] = h_ins
        counts['policies_dom_updated'] = h_upd

    if only_step is None or only_step == 2:
        b_upd, b_skip = step2_business(dry, policies_firma, client_businesses)
        counts['firma_updated'] = b_upd
        counts['firma_skipped'] = len(b_skip)

    if only_step is None or only_step == 3:
        t_ins, t_skip = step3_terminations(dry, all_notes, existing_term_note_ids)
        counts['terminations_inserted'] = t_ins
        counts['terminations_no_policy'] = len(t_skip)

    if only_step is None or only_step == 4:
        cah_ins = step4_client_attribute_history(dry, clients, existing_cah_client_ids)
        counts['cah_inserted'] = cah_ins

    # ---------------------------------------------------------
    # Podsumowanie
    # ---------------------------------------------------------
    print(f'\n{"=" * 60}')
    print(f'PODSUMOWANIE ({mode}):')
    for k, v in counts.items():
        print(f'  {k}: {v}')

    if not dry:
        run_validation()
    else:
        print('\n[DRY-RUN] Uruchom z --apply zeby zaaplikowac zmiany.')

    print(f'{"=" * 60}')
    print(f'DONE ({mode})')
    print(f'{"=" * 60}\n')


if __name__ == '__main__':
    main()
