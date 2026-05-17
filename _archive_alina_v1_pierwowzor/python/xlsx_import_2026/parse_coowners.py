"""
Port logiki `legacy/secondaryParsers.parseCoOwnerColumn` na Pythona.

Parsuje XLSX col[18] `wsp` -> CoOwner[] z polami:
  - name: str
  - pesel?: str (11 cyfr)
  - type: 'PERSON' | 'LEASING' | 'BANK'
  - phone?: str (9 cyfr)
  - email?: str
  - notes?: str

UPDATE w test.policies:
  - auto_details.coOwners[]  - dla typu OC/AC/BOTH
  - home_details.coOwners[]  - dla typu DOM
  - life_details.uposazony   - dla typu ZYCIE (uposazony, nie coowner)
"""
from __future__ import annotations
import re
import json
import subprocess
import urllib.request
import urllib.error
from typing import Optional

# ---- PARSER ----

EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
# Phone: 9 cyfr z opcjonalnym prefiksem 'tel'. KRYTYCZNE: lookbehind/lookahead `(?<!\d)`/`(?!\d)`
# żeby NIE złapać 9 cyfr ze środka PESEL-u (11) lub NIP-u (10).
PHONE_RE = re.compile(r'(?<!\d)(?:tel\.?|kom\.?|telefon)?\s?(\d{3}[-\s]?\d{3}[-\s]?\d{3})(?!\d)', re.IGNORECASE)
PESEL_RE = re.compile(r'\d{11}')
NIP_RE = re.compile(r'\bNIP\s*[:\.]?\s*(\d{10})\b', re.IGNORECASE)
REGON_RE = re.compile(r'\bREGON\s*[:\.]?\s*(\d{9}|\d{14})\b', re.IGNORECASE)

LEASING_BRANDS = re.compile(r'leasing|pko leasing|stellantis|alphabet|pekao leasing|millennium leasing|raiffeisen leasing|getin leasing|car leasing|santander leasing|idea leasing|kuhne|toyota leasing|impuls', re.IGNORECASE)
BANK_CESJA = re.compile(r'cesia|cesja\b|bank\s|pko bp|pekao\s|santander\s|millennium|ipko|nest bank|alior|mbank|ing|getin', re.IGNORECASE)
LIFE_UPOSAZONY = re.compile(r'uposażony|uposazony|beneficjent', re.IGNORECASE)


def _extract_contact(text: str) -> tuple[str, Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Wyciąga email + phone + NIP + REGON z tekstu.
    KOLEJNOŚĆ KRYTYCZNA: NIP/REGON PRZED phone (żeby NIP 10 cyfr nie złapał się jako phone).
    Zwraca (cleaned_text, email, phone, nip, regon)."""
    email = None
    phone = None
    nip = None
    regon = None
    m = EMAIL_RE.search(text)
    if m:
        email = m.group(0)
        text = text.replace(email, '')
    # NIP i REGON PRZED phone
    m = NIP_RE.search(text)
    if m:
        nip = m.group(1)
        text = text.replace(m.group(0), '')
    m = REGON_RE.search(text)
    if m:
        regon = m.group(1)
        text = text.replace(m.group(0), '')
    # Phone - po usunięciu NIP/REGON (9 cyfrowych ciągów w NIP/REGON już nie ma)
    m = PHONE_RE.search(text)
    if m:
        phone = m.group(1).replace('-', '').replace(' ', '')
        text = text.replace(m.group(0), '')
    return text, email, phone, nip, regon


def _parse_person(part: str, phone: Optional[str], email: Optional[str]) -> Optional[dict]:
    """Parsuje fragment jako osobę (name+ewentualny pesel)."""
    if not part: return None
    part = part.strip()
    pesel_m = PESEL_RE.search(part)
    pesel = pesel_m.group(0) if pesel_m else None
    name = part
    if pesel:
        name = name.replace(pesel, '')
    name = re.sub(r'pesel|ubezpieczon[yai]|współwłaściciel|wspolwlasciciel|tel\.?', '', name, flags=re.IGNORECASE)
    # Usuń resztki markerów (->, =>) i tail/head punktuacji
    name = re.sub(r'\s*[-=]>\s*', ' ', name).strip()
    name = re.sub(r'^[-_,:;\s]+|[-_,:;\s]+$', '', name).strip()
    # Compress wielokrotne spacje
    name = re.sub(r'\s{2,}', ' ', name)
    if len(name) < 3 or '?' in name:
        return None
    out = {'name': name, 'type': 'PERSON'}
    if pesel: out['pesel'] = pesel
    if phone: out['phone'] = phone
    if email: out['email'] = email
    return out


MULTI_PERSON_MARKERS = re.compile(r'ubezpieczeni|współubezpieczeni|wspolubezpieczeni|drugi ubezpieczony|trzeci ubezpieczony|->|=>', re.IGNORECASE)


def _split_multi_persons(text: str) -> list[str]:
    """Split tekstu na fragmenty per osoba. Strategia:
    - usuń markery (`ubezpieczeni`, `->`)
    - split po przecinkach
    - jeśli brak przecinków - split po PESEL boundary (każde 11 cyfr to nowy fragment)
    """
    # Usuń markery (zachowuj content)
    cleaned = MULTI_PERSON_MARKERS.sub(',', text)
    cleaned = re.sub(r'^[:,\s\->=]+', '', cleaned).strip()
    if ',' in cleaned:
        parts = [p.strip() for p in cleaned.split(',') if p.strip()]
        return parts
    # Brak przecinków - split po PESEL
    pesel_positions = [m.start() for m in PESEL_RE.finditer(cleaned)]
    if len(pesel_positions) > 1:
        parts = []
        for i, pos in enumerate(pesel_positions):
            start = pesel_positions[i-1] + 11 if i > 0 else 0
            end = pesel_positions[i] + 11
            # Dołącz tekst PO peselu (imię które idzie po) do tego fragmentu
            next_pesel_pos = pesel_positions[i+1] if i+1 < len(pesel_positions) else len(cleaned)
            parts.append(cleaned[start:next_pesel_pos].strip())
        return [p for p in parts if p]
    return [cleaned]


def parse_coowner_column(raw: str) -> dict:
    """
    Zwraca: {
      'coOwners': [...],
      'ownershipType': 'LEASING'|'KREDYT'|'PRYWATNA' | None,
      'assignment': str | None,   # cesja na bank
      'uposazony': dict | None,   # tylko dla zycie - uposazony zamiast coowner
    }
    """
    if not raw:
        return {'coOwners': []}
    text = str(raw).strip()
    result = {'coOwners': []}

    text_extracted, email, phone, nip, regon = _extract_contact(text)

    # 0. Uposazony (zycie) - obsluga osobno
    if LIFE_UPOSAZONY.search(text):
        cleaned = LIFE_UPOSAZONY.sub('', text_extracted).strip()
        person = _parse_person(cleaned, phone, email)
        if person:
            person['type'] = 'PERSON'
            person['notes'] = 'Uposazony (z importu XLSX)'
            result['uposazony'] = person
        return result

    # 1. LEASING (sprawdzaj na oryginale - nazwa zawiera 'leasing')
    if LEASING_BRANDS.search(text):
        co = {'name': text_extracted.strip() or text.strip(), 'type': 'LEASING', 'notes': 'Dane z importu'}
        if nip: co['nip'] = nip
        if regon: co['regon'] = regon
        if phone: co['phone'] = phone
        if email: co['email'] = email
        result['coOwners'].append(co)
        result['ownershipType'] = 'LEASING'
        return result

    # 2. CESJA (Bank)
    if BANK_CESJA.search(text):
        result['assignment'] = text.strip()
        if '+' in text or re.search(r'\boraz\b', text, re.IGNORECASE):
            parts = re.split(r'\+|\boraz\b', text_extracted, flags=re.IGNORECASE)
            for part in parts:
                if not BANK_CESJA.search(part):
                    person = _parse_person(part, phone, email)
                    if person:
                        result['coOwners'].append(person)
        else:
            result['coOwners'].append({
                'name': text.strip(), 'type': 'BANK', 'notes': 'Cesja z importu',
                **({'phone': phone} if phone else {}),
                **({'email': email} if email else {}),
            })
        return result

    # 3. MULTI-OSOBA (travel/życie - markery 'ubezpieczeni', '->', wiele PESEL)
    # Ale UWAGA: 'Tomasz Tusiński -> 91021511510' to JEDNA osoba (name -> pesel separator), nie multi.
    # Heurystyka: multi tylko gdy explicit marker słowny (ubezpieczeni/współubezpieczeni/drugi ubezpieczony)
    # lub >=2 PESEL-i lub >=2 przecinki z PESEL.
    has_word_marker = bool(re.search(r'\b(ubezpieczeni|współubezpieczeni|wspolubezpieczeni|drugi ubezpieczony|trzeci ubezpieczony)\b', text, re.IGNORECASE))
    pesel_count = len(PESEL_RE.findall(text_extracted))
    has_multi_comma = text_extracted.count(',') >= 2

    if has_word_marker or (pesel_count >= 2) or (has_multi_comma and pesel_count >= 1):
        fragments = _split_multi_persons(text_extracted)
        for frag in fragments:
            # Każdy fragment: name + jego własny PESEL (jeśli ma)
            # Phone/email globalnie z całego wpisu jeśli brak w fragmencie
            person = _parse_person(frag, phone if len(fragments) == 1 else None, email if len(fragments) == 1 else None)
            if person:
                result['coOwners'].append(person)
        if result['coOwners']:
            return result

    # 4. SPLIT na '+' lub 'oraz'
    if '+' in text_extracted or re.search(r'\boraz\b', text_extracted):
        parts = re.split(r'\+|\boraz\b', text_extracted)
        for part in parts:
            person = _parse_person(part, phone, email)
            if person:
                result['coOwners'].append(person)
        if result['coOwners']:
            return result

    # 5. Fallback: 1 osoba
    person = _parse_person(text_extracted, phone, email)
    if person:
        result['coOwners'].append(person)
    return result


# ---- APPLY DO DB ----

def _rrv(k: str) -> Optional[str]:
    try:
        r = subprocess.run(['rrv', 'get', k], capture_output=True, text=True, timeout=5)
        return r.stdout.strip() if r.returncode == 0 else None
    except Exception:
        return None


def main():
    URL = _rrv('CRM_ALINA_SUPABASE_URL')
    SEC = _rrv('CRM_ALINA_SB_SECRET')
    H = {'apikey': SEC, 'Authorization': f'Bearer {SEC}',
         'Accept-Profile': 'test', 'Content-Profile': 'test',
         'Content-Type': 'application/json', 'Prefer': 'return=minimal'}

    rows = json.load(open('C:/BartsGda4/CRM-ALINA/python/xlsx_import_2026/raw_182_rows.json', encoding='utf-8'))

    # Pobierz aktualne policies z test (legacy_id -> {id, type, auto_details, home_details, life_details})
    r = urllib.request.urlopen(urllib.request.Request(
        f'{URL}/rest/v1/policies?source=eq.xlsx_import&select=id,legacy_id,type,auto_details,home_details,life_details&limit=500',
        headers={'apikey': SEC, 'Authorization': f'Bearer {SEC}', 'Accept-Profile': 'test'}), timeout=15)
    policies = json.loads(r.read())
    by_legacy = {p['legacy_id']: p for p in policies}
    print(f'[*] Pobrano {len(policies)} polis z test schema')

    parsed_count = 0
    coowners_total = 0
    updates_done = 0
    skipped = []

    for row in rows:
        wsp = row.get('wsp')
        if not wsp or not str(wsp).strip():
            continue
        legacy_id = f"xlsx_2025_row_{row['row_idx']}"
        pol = by_legacy.get(legacy_id)
        if not pol:
            skipped.append((row['row_idx'], 'no_policy_in_db'))
            continue

        parsed = parse_coowner_column(str(wsp))
        coowners = parsed.get('coOwners', [])
        uposazony = parsed.get('uposazony')

        if not coowners and not uposazony:
            skipped.append((row['row_idx'], f'parser_failed: {wsp[:60]!r}'))
            continue

        parsed_count += 1
        coowners_total += len(coowners)

        # Decyzja: gdzie wstawić (auto / home / life)
        body = {}
        ptype = pol['type']
        if ptype in ('OC', 'AC', 'BOTH'):
            auto = dict(pol.get('auto_details') or {})
            auto['coOwners'] = coowners
            if parsed.get('ownershipType'):
                auto['ownershipType'] = parsed['ownershipType']
            if parsed.get('assignment'):
                auto['assignment'] = parsed['assignment']
            body['auto_details'] = auto
        elif ptype == 'DOM':
            home = dict(pol.get('home_details') or {})
            home['coOwners'] = coowners
            if parsed.get('assignment'):
                home['assignmentBank'] = parsed['assignment']
            body['home_details'] = home
        elif ptype == 'ZYCIE':
            life = dict(pol.get('life_details') or {})
            if uposazony:
                life['uposazony'] = uposazony
            elif coowners:
                life['related_persons'] = coowners
            body['life_details'] = life
        else:
            # FIRMA, PODROZ - wrzuc do firma_details / travel_details
            field = 'firma_details' if ptype == 'FIRMA' else 'travel_details'
            details = dict(pol.get(field.replace('details','_details'), {}) or {})
            details['coOwners'] = coowners
            body[field] = details

        if not body:
            continue

        # PATCH
        req = urllib.request.Request(
            f'{URL}/rest/v1/policies?id=eq.{pol["id"]}',
            data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
            headers=H, method='PATCH')
        try:
            urllib.request.urlopen(req, timeout=15)
            updates_done += 1
        except urllib.error.HTTPError as e:
            skipped.append((row['row_idx'], f'patch_err {e.code}: {e.read()[:200].decode("utf-8","ignore")}'))

    print()
    print(f'=== Wynik ===')
    print(f'  Wierszy XLSX z col[18] wsp:              {sum(1 for r in rows if r.get("wsp") and str(r["wsp"]).strip())}')
    print(f'  Parsowanych pomyslnie:                   {parsed_count}')
    print(f'  CoOwnerów łącznie wyciągnietych:         {coowners_total}')
    print(f'  Polis zaktualizowanych w DB:             {updates_done}')
    print(f'  Pominietych:                             {len(skipped)}')
    if skipped:
        print()
        print('Pominiete (sample):')
        for idx, reason in skipped[:10]:
            print(f'  row {idx}: {reason}')


if __name__ == '__main__':
    main()
