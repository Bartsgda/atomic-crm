#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parser 182 wierszy XLSX agencji ubezpieczeniowej.
Input:  raw_182_rows.json
Output: ai_parsed_182.json
"""

import json
import re
import os

INPUT_PATH = os.path.join(os.path.dirname(__file__), "raw_182_rows.json")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "ai_parsed_182.json")

# ── helpers ──────────────────────────────────────────────────────────────────

def clean(s):
    if not s:
        return ""
    return str(s).strip()

# Wzorzec tablicy rejestracyjnej PL:
# - stary format: 2-3 litery (powiat) + 4-5 cyfr  np. GD12345, GDA1234
# - nowy format:  2-3 litery + cyfra/litera x4-5   np. GD537XX, GKA28168
# Używamy lookahead/lookbehind zamiast \b (podkreślnik jest w \w)
REG_RE = re.compile(r'(?<![A-Z0-9])([A-Z]{2,3}[0-9][0-9A-Z]{3,5})(?![A-Z0-9])')

def extract_reg(text):
    t = text.upper()
    # Usuń typowe słowa które mogłyby być fałszywie dopasowane
    t = re.sub(r'\b(NIP|REGON|PESEL|HDI|TUZ|OC|AC|ASS|NNW|SU|VW|BMW|KTM|LPG|UTM)\b', ' ', t)
    m = REG_RE.search(t)
    if m:
        val = m.group(1)
        # Odrzuć jeśli to liczba z jednostką lub PESEL-fragment
        if len(val) < 5 or len(val) > 9:
            return None
        return val
    return None

# pojemność silnika: 1234 ccm / cm3 / cm@
ENGINE_RE = re.compile(r'(\d{3,5})\s*(?:ccm|cm3|cm@|cm\^3)', re.I)

def extract_engine_cc(text):
    m = ENGINE_RE.search(text)
    if m:
        return int(m.group(1))
    # fallback: "poj XXXX" lub "pojemność XXXX"
    m2 = re.search(r'poj(?:emno[sś][cć])?\s+(\d{3,5})', text, re.I)
    if m2:
        val = int(m2.group(1))
        if 50 <= val <= 20000:
            return val
    return None

# moc KM / KW
POWER_KM_RE = re.compile(r'(\d{2,4})\s*KM', re.I)
POWER_KW_RE = re.compile(r'(\d{2,4})\s*(?:kW|KW)\b')

def extract_power(text):
    km, kw = None, None
    m = POWER_KM_RE.search(text)
    if m:
        km = int(m.group(1))
    m2 = POWER_KW_RE.search(text)
    if m2:
        kw = int(m2.group(1))
    return km, kw

# rok produkcji (4-cyfrowy, 199x-202x)
YEAR_RE = re.compile(r'\b(19[89]\d|20[012]\d)\b')

def extract_year(text):
    # szukamy "prod XXXX" | "rocznik XXXX" | "z XXXX" najpierw
    m = re.search(r'(?:prod\.?|rocznik|mr\')[\'.\s]*(\d{4})', text, re.I)
    if m:
        y = int(m.group(1))
        if 1980 <= y <= 2026:
            return y
    # szukamy samodzielnego roku
    candidates = YEAR_RE.findall(text)
    for c in candidates:
        y = int(c)
        if 1980 <= y <= 2026:
            return y
    return None

# paliwo
def extract_fuel(text):
    t = text.lower()
    if 'hybryda' in t or 'hybrid' in t:
        return 'hybryda'
    if 'elektr' in t:
        return 'elektryk'
    if 'lpg' in t or 'gaz' in t:
        return 'LPG'
    if 'diesel' in t or 'olej nap' in t or 'hdi' in t or ' d,' in t or ',d,' in t or 'turbo d' in t:
        return 'diesel'
    if 'benzyna' in t or 'benzy' in t or 'p,' in t or ' p\b' in t.replace('_', ' ') or 'benz' in t:
        return 'benzyna'
    return None

# marka + model z ciągu po tablicy lub po "samochód_XXX_..."
KNOWN_BRANDS = [
    'Volkswagen','VW','Volvo','Toyota','Skoda','Škoda','Mazda','Ford','Fiat','Renault',
    'Opel','BMW','Audi','Mercedes','Peugeot','Citroen','Citroën','Seat','Hyundai','Kia',
    'Nissan','Honda','Suzuki','Subaru','Mitsubishi','Lexus','Land Rover','Jeep','Porsche',
    'Dacia','Alfa Romeo','Chrysler','Dodge','Cadillac','Chevrolet','DAF','Scania','Iveco',
    'MAN','Volvo','Mercedes-Benz','KTM','Yamaha','Kawasaki','Honda','Piaggio','Vespa',
    'SYM','Sym','Bajaj','Triumph','Ducati','Harley','Aprilia','Can-Am','CAN-AM','CFMOTO',
    'Bombardier','Temared','Nim','BMW R','Peugeot','Lancia','Fiat','Syrena'
]

def extract_brand_model(text):
    """
    Próbuje wyciągnąć markę i model z ciągu opisowego pojazdu.
    Zwraca (brand, model) lub (None, None).
    """
    # usuń tablicę rejestracyjną
    text2 = REG_RE.sub('', text).strip()
    # usuń dane techniczne
    text2 = ENGINE_RE.sub('', text2)
    text2 = POWER_KM_RE.sub('', text2)
    text2 = POWER_KW_RE.sub('', text2)
    text2 = YEAR_RE.sub('', text2)
    # usuń "poj XXXX"
    text2 = re.sub(r'poj(?:emno[sś][cć])?\s+\d+', '', text2, flags=re.I)
    # usuń "pierwsza rej XXXX"
    text2 = re.sub(r'pierw\w*\s+rej\w*[\s\d\-\.]*', '', text2, flags=re.I)
    # usuń liczby z jednostkami
    text2 = re.sub(r'\b\d+\s*(?:miejsc|drzwi|m2|tys|km)\b', '', text2, flags=re.I)
    # usuń paliwa
    text2 = re.sub(r'\b(?:benzyna|diesel|lpg|hybryda|elektryk|olej napędowy|P|D)\b', '', text2, flags=re.I)
    # usuń OC/AC/ASS/NNW
    text2 = re.sub(r'\b(?:AC|OC|ASS|NNW|szyby|opony|kosztorys|serwis|ze)\b', '', text2, flags=re.I)
    text2 = re.sub(r'[_,;]+', ' ', text2)
    text2 = re.sub(r'\s{2,}', ' ', text2).strip()

    brand = None
    model = None

    for b in sorted(KNOWN_BRANDS, key=len, reverse=True):
        pattern = re.escape(b)
        m = re.search(pattern, text2, re.I)
        if m:
            brand = b
            after = text2[m.end():].strip()
            # model = pierwsze 2-3 słowa po marce
            parts = after.split()
            model_parts = []
            for p in parts[:4]:
                p = p.strip('.,;:')
                if not p:
                    continue
                # stop jeśli natrafimy na liczbę-jednostkę lub słowo kluczowe
                if re.match(r'^\d+$', p) and int(p) > 2030:
                    break
                model_parts.append(p)
            model = ' '.join(model_parts[:3]).strip() if model_parts else None
            break

    return brand, model

# vehicle_type z kontekstu
def extract_vehicle_type(text):
    t = text.lower()
    if any(x in t for x in ['ciężarowy', 'ciezarowy', 'cieżarowy', 'ciężar', 'hgv', 'tir', 'daf', 'scania', 'man ', 'iveco']):
        return 'CIEZAROWY'
    if any(x in t for x in ['motocykl', 'motor', 'moto', 'ktm', 'yamaha', 'kawasaki', 'triumph', 'ducati', 'harley', 'aprilia', 'bmw r ']):
        return 'MOTOCYKL'
    if any(x in t for x in ['skuter', 'piaggio', 'vespa', 'sym ', 'mio ']):
        return 'MOTOCYKL'  # skuter traktujemy jako motocykl
    if any(x in t for x in ['quad', 'can-am', 'can am', 'cfmoto', 'bombardier', 'atvv']):
        return 'QUAD'
    if any(x in t for x in ['przyczepa', 'temared']):
        return 'PRZYCZEPA'
    if any(x in t for x in ['autobus', 'bus ']):
        return 'AUTOBUS'
    if any(x in t for x in ['ciągnik', 'ciagnik', 'traktor']):
        return 'CIAGNIK'
    # dostawczy: do 3.5t lub van
    if any(x in t for x in ['dostawczy', 'furgon', '3,5t', '3.5t', 'transporter', 'ducato', 'transit', 'crafter', 'caddy', 'master', 'sprinter', 'jumper', 'berlingo', 'connect', 'plandeka']):
        return 'DOSTAWCZY'
    return 'OSOBOWY'

# AC details
def parse_ac_details(text):
    t = text.lower()
    kind = None
    if 'kosztorys' in t:
        kind = 'kosztorys'
    elif 'serwis' in t:
        kind = 'serwis'
    elif 'partnerski' in t:
        kind = 'partnerski'

    ass = None
    m = re.search(r'ass\s+(z[lł]oty\+?|srebrny|brązowy|standard|plus|premium)', t, re.I)
    if m:
        ass = m.group(1).capitalize()

    szyby = bool(re.search(r'\bszyby\b', t, re.I))
    opony = bool(re.search(r'\bopony\b', t, re.I))

    extras = []
    if re.search(r'\bnnw\b', t, re.I):
        extras.append('NNW')
    if re.search(r'\bzzk\b|\bochrona\s+zni[żz]ek\b', t, re.I):
        extras.append('ZK')
    if re.search(r'\bzk\b', t, re.I) and 'ZK' not in extras:
        extras.append('ZK')

    return {
        "kind": kind,
        "ass": ass,
        "szyby": szyby,
        "opony": opony,
        "extras": extras
    }

def parse_policy_type(text_co, text_co_raw):
    """
    Zwraca (policy_type, has_ac, has_oc).
    """
    t = text_co.lower().strip()
    # wyrywamy prefix (pierwsza część do _ lub spacja)
    prefix = re.split(r'[_\s]', t, 1)[0]
    prefix = re.sub(r'[?.,]', '', prefix)

    # KROK 1: nieruchomości
    if any(prefix.startswith(x) for x in ['dom', 'mieszkanie', 'lokal', 'budowa', 'majatek', 'majątek']):
        return 'DOM', False, False
    if 'dom?' in t.replace(' ', '') or 'mieszkanie?' in t.replace(' ', ''):
        return 'DOM', False, False
    if re.match(r'(dom|mieszkanie|lokal|budow|majatek|majątek)', prefix):
        return 'DOM', False, False

    # KROK 2: podróże
    if any(x in t for x in ['podróż', 'podroz', 'podrozne', 'podróżne', 'wyjazd', 'turyst']):
        return 'PODROZ', False, False

    # KROK 3: firma
    if any(prefix == x for x in ['firma', 'biznes', 'flota']):
        return 'FIRMA', False, False
    if prefix == 'ocpd':
        return 'FIRMA', False, False
    if re.match(r'(firma|flota|biznes)', prefix):
        return 'FIRMA', False, False
    # majątek = może być firma lub dom
    if prefix == 'majątek' or prefix == 'majatek':
        return 'DOM', False, False  # default to DOM, ai_note later

    # KROK 4: OC bifurcation
    if prefix == 'oc':
        rest = t[2:].strip('_').strip()
        if any(x in rest for x in ['działaln', 'przedsiębiorc', 'zawodow', 'lekarz', 'spedytor', 'przedsi', 'gospod']):
            return 'FIRMA', False, True
        # OC komunikacyjne
        return 'OC', False, True

    # KROK 5: życie / NNW
    if any(x in prefix for x in ['życie', 'zycie', 'nnw']):
        return 'ZYCIE', False, False
    if 'nnw' in t and 'szkolne' in t:
        return 'ZYCIE', False, False
    if 'nnw' in t:
        return 'ZYCIE', False, False

    # KROK 6: pojazdy (fallback)
    has_oc = bool(re.search(r'\bOC\b', text_co_raw))
    has_ac = bool(re.search(r'\bAC\b', text_co_raw))

    if has_oc and has_ac:
        return 'BOTH', True, True
    elif has_ac:
        return 'AC', True, False
    elif has_oc:
        return 'OC', False, True
    else:
        # brak wyraźnego OC/AC — traktujemy jako OC (domyślna komunikacja)
        return 'OC', False, True

def parse_old_policy(st_pol):
    if not st_pol or clean(st_pol) in ('brak', '?', 'null', ''):
        return None
    text = clean(st_pol)
    insurer = None
    number = None
    type_hint = None

    # szukamy nazwy TU
    TU_MAP = {
        'PZU': 'PZU', 'HDI': 'HDI', 'Warta': 'Warta', 'Generali': 'Generali',
        'Hestia': 'Ergo Hestia', 'Ergo Hestia': 'Ergo Hestia',
        'Allianz': 'Allianz', 'TUZ': 'TUZ', 'Link4': 'Link4', 'Link 4': 'Link4',
        'Compensa': 'Compensa', 'Uniqa': 'Uniqa', 'Interrisk': 'Interrisk',
        'MTU': 'MTU', 'Proama': 'Proama', 'Wiener': 'Wiener',
        'Euro': 'Euro Inc', 'Insurance': 'Insurance',
        'TUW': 'TUW', 'Trasti': 'Trasti', 'Benefia': 'Benefia',
        'Dallborg': 'Dallborg Life',
    }
    for key, val in TU_MAP.items():
        if key.lower() in text.lower():
            insurer = val
            break
    if not insurer:
        # spróbuj wyciągnąć pierwsze słowo
        first = re.split(r'[\s\d_]', text)[0].strip()
        if len(first) >= 3:
            insurer = first

    # szukamy numeru polisy (dlugie ciągi cyfr lub mieszane)
    num_m = re.search(r'(?:nr\s*)?(\d{5,}|[A-Z]{2,}\d{6,}|\d{4,}-\d+)', text, re.I)
    if num_m:
        number = num_m.group(1)

    # type hint z tekstu
    hints = []
    if 'AC' in text:
        hints.append('AC')
    if 'OC' in text:
        hints.append('OC')
    if re.search(r'ASS', text, re.I):
        hints.append('ASS')
    if hints:
        type_hint = '+'.join(hints)

    return {"insurer": insurer, "number": number, "type_hint": type_hint or None}

def parse_home(co_text):
    """Parsuje dane domu z col 'co'."""
    # adres: część po pierwszym _
    parts = co_text.split('_', 1)
    address = parts[1].strip() if len(parts) > 1 else None

    area_m2 = None
    m = re.search(r'(\d+)\s*m2', co_text, re.I)
    if m:
        area_m2 = int(m.group(1))

    # typ domu
    t = co_text.lower()
    if 'mieszkanie' in t:
        home_type = 'MIESZKANIE'
    elif 'majątek' in t or 'majatek' in t or 'domek letniskowy' in t or 'letniskowy' in t:
        home_type = 'MAJATEK'
    elif 'budowa' in t:
        home_type = 'BUDOWA'
    else:
        home_type = 'DOM'

    return {"address": address, "area_m2": area_m2, "type": home_type}

def parse_travel(co_text):
    """Parsuje podróż."""
    # destination z tekstu po _
    parts = co_text.split('_', 1)
    dest = parts[1].strip() if len(parts) > 1 else None

    date_from = None
    date_to = None
    m = re.search(r'(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)\s*[-–]\s*(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)', co_text)
    if m:
        date_from = m.group(1)
        date_to = m.group(2)

    return {"destination": dest, "date_from": date_from, "date_to": date_to}

def parse_firma(co_text):
    """Parsuje dane firmy."""
    t = co_text.lower()
    sub = 'MIENIE'
    if 'flota' in t:
        sub = 'FLOTA'
    elif 'oc' in t and ('działaln' in t or 'przedsi' in t or 'gospod' in t or 'zawodow' in t):
        sub = 'OC_DZIALALNOSCI'
    elif 'środki obrotowe' in t or 'mienie' in t or 'mury' in t or 'hotel' in t:
        sub = 'MIENIE'

    parts = co_text.split('_', 1)
    desc = parts[1].strip() if len(parts) > 1 else co_text

    return {"description": desc, "subType": sub}

def parse_life(co_text):
    return {"description": clean(co_text)}

# ── MAIN PARSER ───────────────────────────────────────────────────────────────

def parse_row(row):
    idx = row.get('row_idx')
    co_raw = clean(row.get('co', '') or '')
    notatki = clean(row.get('notatki', '') or '')
    st_pol_raw = clean(row.get('st_pol', '') or '')
    wsp_raw = clean(row.get('wsp', '') or '')

    co_lower = co_raw.lower()
    co_combined = co_raw + ' ' + notatki  # kontekst rozszerzony

    ai_note = None

    # ── Określ typ polisy ──────────────────────────────────────────────────
    policy_type, has_ac, has_oc = parse_policy_type(co_raw, co_raw)

    # ── Specjalne overrides z kontekstu ───────────────────────────────────
    # "samochód żony" / "samochód" / "samochody"
    if re.match(r'^samochod(y|ów)?(\s|$)', co_lower.replace('ó', 'o').replace('ź', 'z')):
        policy_type = 'OC'

    # "pojazd_Quad" -> QUAD
    if re.match(r'^pojazd', co_lower) and 'quad' in co_lower:
        policy_type = 'OC'

    # "polisa zastępcza po rekalkulacji" -> spróbuj wyciągnąć właściwy typ
    if 'polisa zastępcza' in co_lower:
        if 'quad' in co_lower:
            policy_type = 'AC'
        ai_note = "Polisa zastępcza po rekalkulacji — sprawdź typ i powiązanie z poprzednią polisą"

    # "NNW szkolne" -> ZYCIE
    if 'nnw szkolne' in co_lower:
        policy_type = 'ZYCIE'

    # "dom, mieszkanie?" -> ai_note
    if '?' in co_raw and policy_type == 'DOM':
        ai_note = "Niepewny typ: " + co_raw

    # "dom? komunikacja?" -> ai_note
    if 'komunikacja' in co_lower:
        ai_note = "Niepewny typ polisy (dom? komunikacja?): " + co_raw
        policy_type = 'DOM'  # domyślnie

    # "samochód ciężarowy" prefix
    if re.match(r'^samoch[oó]d\s+ci[eę][żz]arowy', co_lower):
        policy_type = 'OC'

    # "OCPD" - OC działalności
    if co_lower.strip() == 'ocpd' or co_raw.strip().upper() == 'OCPD':
        policy_type = 'FIRMA'
        ai_note = "OCPD - OC prowadzonej działalności (KROK 4 bifurkacja → FIRMA)"

    # "OC_działalności gospodarczej"
    if re.match(r'^oc[_\s].*(działaln|gospod|przedsi)', co_lower):
        policy_type = 'FIRMA'

    # "OC_przedsiębiorcy"
    if re.match(r'^oc[_\s].*przedsi', co_lower):
        policy_type = 'FIRMA'

    # "życie_z myślą o życiu plus" -> ZYCIE
    if re.match(r'^[zż]ycie', co_lower):
        policy_type = 'ZYCIE'

    # Sprawdź OC+AC w treści dla pojazdów
    # Używamy (?<![A-Z]) zamiast \b bo _ jest w \w a podkreślnik poprzedza AC/OC
    if policy_type in ('OC', 'AC', 'BOTH'):
        has_ac_text = bool(re.search(r'(?<![A-Z])AC(?![A-Z])', co_raw))
        has_oc_text = bool(re.search(r'(?<![A-Z])OC(?![A-Z])', co_raw))
        if has_ac_text and has_oc_text:
            policy_type = 'BOTH'
        elif has_ac_text:
            policy_type = 'AC'
        elif has_oc_text:
            policy_type = 'OC'

    # ── Wypełnij pola zależnie od typu ────────────────────────────────────
    vehicle = None
    home = None
    travel = None
    firma = None
    life = None

    if policy_type in ('OC', 'AC', 'BOTH'):
        # parsuj pojazd
        reg = extract_reg(co_raw) or extract_reg(notatki)
        engine_cc = extract_engine_cc(co_raw) or extract_engine_cc(notatki)
        power_km, power_kw = extract_power(co_raw)
        if power_km is None:
            power_km, power_kw2 = extract_power(notatki)
            if power_kw is None:
                power_kw = power_kw2
        year = extract_year(co_raw)
        fuel = extract_fuel(co_raw) or extract_fuel(notatki)
        brand, model = extract_brand_model(co_raw)

        # Jeśli brak marki, sprawdź notatki
        if not brand:
            brand2, model2 = extract_brand_model(notatki)
            if brand2:
                brand, model = brand2, model2

        # Typ pojazdu
        vehicle_type = extract_vehicle_type(co_raw + ' ' + notatki)

        # Specjalne: Fiat Ducato Kempingowy -> DOSTAWCZY (furgon/kamper)
        if 'ducato' in co_lower and 'kampingowy' in (co_lower + notatki.lower()):
            vehicle_type = 'DOSTAWCZY'

        # Specjalne: skuter
        if any(x in co_lower for x in ['skuter', 'sym mio', 'piaggio', 'vespa']):
            vehicle_type = 'MOTOCYKL'

        vehicle = {
            "brand": brand,
            "model": model,
            "reg": reg,
            "engine_cc": engine_cc,
            "power_km": power_km,
            "power_kw": power_kw,
            "year": year,
            "fuel": fuel,
            "vehicle_type": vehicle_type
        }

        ac_details = None
        if policy_type in ('AC', 'BOTH'):
            ac_details = parse_ac_details(co_raw)
        else:
            # sprawdź czy w opisie jest AC mimo klasyfikacji OC
            if re.search(r'\bAC\b', co_raw):
                ac_details = parse_ac_details(co_raw)
                policy_type = 'BOTH'

        # Sprawdź "samo AC" lub "samo OC"
        if re.search(r'\bsamo\s+AC\b', co_raw, re.I):
            policy_type = 'AC'
        if re.search(r'\bsamo\s+OC\b', co_raw, re.I):
            policy_type = 'OC'

        vehicle["ac_details"] = ac_details

    elif policy_type == 'DOM':
        home = parse_home(co_raw)
        # Specjalne: majątek NZOZ -> FIRMA.MIENIE ale tu zachowamy jako DOM z ai_note
        if 'nzoz' in co_lower:
            policy_type = 'FIRMA'
            firma = {"description": co_raw, "subType": "MIENIE"}
            home = None
            ai_note = "majątek_NZOZ — zakład medyczny, może wymagać specjalnej polisy majątkowej firmy"
        # "majątek_domek letniskowy" -> DOM typ MAJATEK
        if 'domek letniskowy' in co_lower or 'letniskowy' in co_lower:
            home = parse_home(co_raw)
            home["type"] = "MAJATEK"

    elif policy_type == 'PODROZ':
        travel = parse_travel(co_raw)

    elif policy_type == 'FIRMA':
        firma = parse_firma(co_raw)

    elif policy_type == 'ZYCIE':
        life = parse_life(co_raw)

    # ── Stara polisa ──────────────────────────────────────────────────────
    old_policy = parse_old_policy(st_pol_raw)

    # ── Flagi ai_note ─────────────────────────────────────────────────────
    if co_raw in ('?', '', 'brak', 'null') or co_raw.lower() == '?':
        ai_note = "Brak danych w kolumnie 'co' — typ polisy nieznany"
        policy_type = 'OC'  # domyślnie, bo klient był kontaktowany ws. auto

    # "samochód_? nowo zakupiony" - niejasny opis
    if '?' in co_raw and policy_type in ('OC', 'AC', 'BOTH'):
        if not ai_note:
            ai_note = "Brak danych pojazdu (?) — wymaga uzupełnienia"

    # Brak marki/modelu przy sprzedaży
    if policy_type in ('OC', 'AC', 'BOTH') and vehicle:
        if not vehicle['brand'] and not vehicle['model']:
            # sprawdź czy mamy notatki z info o marce
            brand_n, model_n = extract_brand_model(notatki)
            if brand_n:
                vehicle['brand'] = brand_n
                vehicle['model'] = model_n
            else:
                # tylko reg znany
                if vehicle['reg'] and not ai_note:
                    pass  # ok, mamy tablicę
                elif not vehicle['reg'] and not ai_note:
                    ai_note = "Brak marki/modelu i tablicy rejestracyjnej"

    # Zbuduj wynik
    result = {
        "row_idx": idx,
        "policy_type": policy_type,
    }

    if policy_type in ('OC', 'AC', 'BOTH'):
        veh = {k: v for k, v in vehicle.items() if k != 'ac_details'}
        result["vehicle"] = veh
        result["ac_details"] = vehicle.get("ac_details")
        result["home"] = None
        result["travel"] = None
        result["firma"] = None
        result["life"] = None
    elif policy_type == 'DOM':
        result["vehicle"] = None
        result["ac_details"] = None
        result["home"] = home
        result["travel"] = None
        result["firma"] = None
        result["life"] = None
    elif policy_type == 'PODROZ':
        result["vehicle"] = None
        result["ac_details"] = None
        result["home"] = None
        result["travel"] = travel
        result["firma"] = None
        result["life"] = None
    elif policy_type == 'FIRMA':
        result["vehicle"] = None
        result["ac_details"] = None
        result["home"] = None
        result["travel"] = None
        result["firma"] = firma
        result["life"] = None
    elif policy_type == 'ZYCIE':
        result["vehicle"] = None
        result["ac_details"] = None
        result["home"] = None
        result["travel"] = None
        result["firma"] = None
        result["life"] = life

    result["ai_note"] = ai_note
    result["old_policy"] = old_policy

    return result


def main():
    with open(INPUT_PATH, encoding='utf-8') as f:
        rows = json.load(f)

    results = []
    for row in rows:
        try:
            parsed = parse_row(row)
            results.append(parsed)
        except Exception as e:
            results.append({
                "row_idx": row.get('row_idx'),
                "policy_type": "OC",
                "vehicle": None, "ac_details": None, "home": None,
                "travel": None, "firma": None, "life": None,
                "ai_note": f"BŁĄD PARSOWANIA: {e}",
                "old_policy": None
            })

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # Statystyki
    from collections import Counter
    type_counter = Counter(r['policy_type'] for r in results)
    notes_count = sum(1 for r in results if r.get('ai_note'))

    print(f"Przetworzono: {len(results)} wierszy")
    print(f"Typy: {dict(type_counter)}")
    print(f"Z ai_note: {notes_count}")
    print(f"Output: {OUTPUT_PATH}")

    return results


if __name__ == '__main__':
    main()
