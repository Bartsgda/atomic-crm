"""
Mapper XLSX -> Supabase test schema dla CRM-Alina.

Zrodlo: BAZA_bez_pesel.xlsx (182 wiersze, 23 kolumny)
Cel: schema `test` w xqznrssrlnxqkdvisnck.supabase.co
Tabele: insurance_clients, policies, sub_agents, policy_notes, policy_sub_agent_shares

Uruchomienie:
  python import_xlsx_to_test.py preview      # generuje preview_5.json + full_mapping.json + edge_cases.md
  python import_xlsx_to_test.py sql          # generuje full_inserts.sql (po akceptacji preview)
  python import_xlsx_to_test.py execute      # wykonuje truncate + insert przez REST API

Autor: Opus 4.7 (mapping rules) + Bartek (akceptacja)
Data: 2026-05-10
"""

from __future__ import annotations
import openpyxl
import json
import re
import uuid
import sys
import os
import urllib.request
from datetime import datetime, date, timedelta
from collections import Counter

# ============================================================
# CONSTANTS
# ============================================================

XLSX_PATH = 'C:/BartsGda4/CRM-ALINA/DANE-POZNIEJ-USUN/BAZA_bez_pesel.xlsx'
TENANT_ID = '11111111-1111-1111-1111-111111111111'
DEFAULT_YEAR = 2025  # gdy w notatce brak roku, Bartek: "excel byl w 2025 wiec domyslnie 2025"
SOURCE_TAG = 'xlsx_import'  # check constraint: source IN ('manual','xlsx_import',...)
# Tagujemy konkretny import przez legacy_id ('xlsx_2025_row_N')

# Insurers lookup (15 dostepnych w test.insurers, plus brakujace -> insurer_name as text)
INSURERS = {
    'allianz': '943fd3ba-1d4f-4b9f-aa6f-4f6e6c5e9c8a',  # placeholder UUID, zostanie zaczytane runtime
    'balcia': 'a523da01-...',
    'beesafe': '395b9d74-...',
    'compensa': '3db02416-...',
    'ergo hestia': 'a785853c-...',
    'hestia': 'a785853c-...',  # alias
    'generali': 'b7ede18e-...',
    'interrisk': '6e334ca9-...',
    'link4': '00e01d8c-...',
    'proama': '24caaef7-...',
    'pzu': 'eb046bef-...',
    'pzu sa': 'eb046bef-...',
    'tuz': '71aec0c9-...',
    'uniqa': '9e742ea8-...',
    'warta': 'fd582ee0-...',
    'wiener': '76d68a60-...',
    'you can drive': 'ed89db29-...',
    'ycd': 'ed89db29-...',
}
# Brakujace w bazie (zostana z insurer_id=null + insurer_name z XLSX raw):
MISSING_INSURERS = {'hdi', 'mtu', 'mtu24', 'pevno'}

# Stage normalizacja: XLSX raw -> DB enum (underscore + no Polish chars per check constraint).
# Allowed: uciety_kontakt, przel_kontakt, sprzedaz, oferta_wyslana, of_do_zrobienia, czekam_na_dane, rez_po_ofercie
STAGE_MAP = {
    'sprzedaż': 'sprzedaz',
    'sprzedany': 'sprzedaz',  # merge per decyzja Bartka
    'sprzedaz': 'sprzedaz',
    'ucięty kontakt': 'uciety_kontakt',
    'przeł kontakt': 'przel_kontakt',
    'czekam na dane/dokum': 'czekam_na_dane',
    'of_do zrobienia': 'of_do_zrobienia',
    'of_przedst': 'oferta_wyslana',
    'rez po ofercie_kont za rok': 'rez_po_ofercie',
}

# Polskie miesiace -> liczba (do parsera dat z notatek)
PL_MONTHS = {
    'stycznia': 1, 'styczeń': 1, 'sty': 1,
    'lutego': 2, 'luty': 2, 'lut': 2,
    'marca': 3, 'marzec': 3, 'mar': 3,
    'kwietnia': 4, 'kwiecień': 4, 'kwi': 4,
    'maja': 5, 'maj': 5,
    'czerwca': 6, 'czerwiec': 6, 'cze': 6,
    'lipca': 7, 'lipiec': 7, 'lip': 7,
    'sierpnia': 8, 'sierpień': 8, 'sie': 8,
    'września': 9, 'wrzesień': 9, 'wrz': 9,
    'października': 10, 'październik': 10, 'paź': 10,
    'listopada': 11, 'listopad': 11, 'lis': 11,
    'grudnia': 12, 'grudzień': 12, 'gru': 12,
}

# ============================================================
# UTILITIES — parsing
# ============================================================

def s(v):
    """Bezpieczny string, None -> ''"""
    if v is None: return ''
    return str(v).strip()

def safe_money(v):
    if v in (None, '', 0): return None
    if isinstance(v, (int, float)): return float(v)
    cleaned = re.sub(r'[^\d.,-]', '', str(v)).replace(',', '.')
    try: return float(cleaned)
    except: return None

def to_iso_date(v):
    """XLSX cellDates daje datetime, my chcemy 'YYYY-MM-DD'."""
    if v is None or v == '': return None
    if isinstance(v, datetime): return v.date().isoformat()
    if isinstance(v, date): return v.isoformat()
    try:
        d = datetime.fromisoformat(str(v).split(' ')[0])
        return d.date().isoformat()
    except: return None

# ============================================================
# CLIENT parsing (col 0, 4, 5, 6, 7)
# ============================================================

COMPANY_KEYWORDS = ['sp. z o.o.', 'sp.z o.o.', 's.a.', 'sp. j.', 'sp.k.', 's.c.',
                    'spółka', 'firma', 'biuro', 'handel obwoźny', 'przedsiębiorstwo']

def parse_client_name(raw):
    """
    Wzorce:
    - 'Marek Czechowski' -> first='Marek', last='Czechowski'
    - 'Rafał Gurbowicz kontakt do Aleksandry G.' -> first='Rafał', last='Gurbowicz', extra='kontakt do Aleksandry G.'
    - 'Robert Stark _Parkiet Stark Sp. z o.o. Sp. K.' -> first='Robert', last='Stark', business='Parkiet Stark Sp. z o.o. Sp. K.'
    - 'Sławomir Warżała Recyplast' -> first='Sławomir', last='Warżała', business='Recyplast'
    - 'Tetiana Vyval Betop By' -> first='Tetiana', last='Vyval', business='Betop By' (heurystyka: 3+ slowa, ostatnie firma jesli brzmi)
    - 'Dominika' -> first='Dominika', last='?'
    - 'Mariusz' -> first='Mariusz', last='?'
    - 'Deja VuJustyna Szwejkowska' -> ledge case, first='Deja Vu' (firma), last='Szwejkowska'? — to firma + osoba, splituje przez heurystyke
    """
    raw = s(raw)
    if not raw: return None

    extra_note = None
    business_name = None

    # Separator '_' -> czesto firma
    if '_' in raw:
        parts = [p.strip() for p in raw.split('_')]
        # Pierwszy fragment: imie+nazwisko, kolejne: firma/notatka
        person = parts[0]
        rest = ' '.join(parts[1:])
        if any(kw in rest.lower() for kw in COMPANY_KEYWORDS):
            business_name = rest
        else:
            extra_note = rest
        raw = person

    # Wykrycie 'kontakt do', 'wlasciciel rozmowa', etc. -> notatka
    notes_markers = ['kontakt do', 'rozmowa z', 'wlasciciel', 'właściciel']
    for mk in notes_markers:
        if mk in raw.lower():
            idx = raw.lower().find(mk)
            new_extra = raw[idx:].strip()
            extra_note = (extra_note + ' | ' + new_extra) if extra_note else new_extra
            raw = raw[:idx].strip()
            break

    words = raw.split()
    if not words: return None

    # Heurystyka: jesli >= 3 slowa, ostatnie moze byc firma (Recyplast, Betop By, Handel obwoźny)
    if len(words) >= 3:
        last_word = words[-1]
        # Jesli ostatnie zaczyna sie wielka litera i nie jest typowym 2-czlonowym nazwiskiem
        if len(words) == 3 and last_word[0].isupper() and not any(words[1].lower() == lw for lw in ['kowalski', 'nowak']):
            # 'Slawomir Warzala Recyplast' -> first='Slawomir', last='Warzala', biznes='Recyplast'
            first, last = words[0], words[1]
            business_name = (business_name or '') + (' ' + last_word if business_name else last_word)
        elif len(words) >= 4:
            # 'Piotr Adamus ALES Przedsiebiorstwo Handlowo - Uslugowe' -> 2 slowa name + reszta firma
            first, last = words[0], words[1]
            business_name = (business_name or '') + ' ' + ' '.join(words[2:])
            business_name = business_name.strip()
        else:
            first, last = words[0], words[1]
    elif len(words) == 2:
        first, last = words[0], words[1]
    else:
        # 1 slowo - tylko imie (Dominika, Mariusz, Agnieszka)
        first, last = words[0], '(brak nazwiska)'

    return {
        'first_name': first,
        'last_name': last,
        'extra_note': extra_note.strip() if extra_note else None,
        'business_name': business_name.strip() if business_name else None,
    }

def parse_phone(raw):
    if raw in (None, ''): return []
    s_raw = str(raw)
    # Multi-phone separator: ',', '/', ' '
    parts = re.split(r'[,;/]', s_raw)
    out = []
    for p in parts:
        digits = re.sub(r'[^\d]', '', p)
        if 7 <= len(digits) <= 12:
            # Strip prefix +48 if present (12 digits)
            if len(digits) >= 11 and digits.startswith('48'):
                digits = digits[2:]
            out.append(digits)
    return out

def parse_email(raw):
    if not raw: return []
    parts = re.split(r'[\s,;]+', str(raw))
    return [p.strip() for p in parts if '@' in p]

def parse_address(raw):
    """
    Wzorce:
    - '83-314 Somonino ul. Na glinach 5' -> zip='83-314', city='Somonino', street='ul. Na glinach 5'
    - 'Bojano ul. Jagielly 4' -> city='Bojano', street='ul. Jagielly 4', zip=None
    - '_' -> wszystko None
    - 'Gdansk Sluza 2' -> city='Gdansk', street='Sluza 2'
    """
    raw = s(raw).strip('_').strip()
    if not raw: return {'street': None, 'city': None, 'zip_code': None}

    zip_match = re.search(r'(\d{2}-\d{3})', raw)
    zip_code = zip_match.group(1) if zip_match else None

    if zip_code:
        # Format: '83-314 Somonino ul. ...'
        rest = raw.replace(zip_code, '').strip()
        # Pierwszy wyraz po zip = miasto (do 'ul.' lub do nastepnego separatora)
        ul_idx = rest.lower().find('ul.')
        if ul_idx > 0:
            city = rest[:ul_idx].strip()
            street = rest[ul_idx:].strip()
        else:
            words = rest.split()
            city = words[0] if words else None
            street = ' '.join(words[1:]) if len(words) > 1 else None
    else:
        # Brak zip: heurystyka 'miasto ul. ...'
        ul_idx = raw.lower().find('ul.')
        if ul_idx > 0:
            city = raw[:ul_idx].strip()
            street = raw[ul_idx:].strip()
        else:
            words = raw.split()
            city = words[0] if words else None
            street = ' '.join(words[1:]) if len(words) > 1 else None

    return {'street': street, 'city': city, 'zip_code': zip_code}

# ============================================================
# PRODUCT (col 8) — typ polisy
# ============================================================

# PL plate format: 2-3 letter area code + 4-5 alphanumeric (must contain ≥1 digit).
# Examples: GD721YL, GWE5636U, WPR4L92, GKA84750, WP0997S, NO504CS, CTR36929.
# Rejects: LPG, NNW, ASS, TDI, RAV4, CX5, VIII, SPORTBACK, KTM, PZU, OC, AC.
# Lookbehind/lookahead `[A-Z0-9]` zamiast `\b` — bo `_` jest word-char i blokowałby boundary
# między `_GD707NN_`. Format PL: 2-3 lit area + optional sep + 4-5 alnum.
VEHICLE_REG_PATTERN = re.compile(r'(?<![A-Z0-9])([A-Z]{2,3})[\s-]?([A-Z0-9]{4,5})(?![A-Z0-9])')

# Common false-positive tokens that look plate-ish but are not (insurer/service/fuel/model codes).
PLATE_BLACKLIST = {
    'NNW', 'ASS', 'TDI', 'TFSI', 'HDIRO', 'SDI', 'CRDI', 'DCI', 'GTDI', 'GTI',
    'LPG', 'CNG',  # fuel
    'PZU', 'PZUSA', 'HDI', 'MTU', 'YCD',  # insurer codes
    'SAM', 'NULL', 'BRAK', 'SZYBY', 'ZIMA', 'LATO',
    'RAV4', 'CX5', 'E6L', 'SU38', 'LF45',  # model fragments
    'VIII', 'SPORTBACK', 'QUATTRO', 'CADDY',
}


def find_plate(text):
    """Zwroc PL tablice z tekstu lub None.

    Wymaga 2-3 litery area + 4-5 alfanum z ≥1 cyfrą; pomija blacklistę.
    Preferuje wystąpienia po '_' lub na początku po słowie kluczowym (samochód_, motocykl_).
    """
    if not text: return None
    raw = str(text)
    candidates = []
    for m in VEHICLE_REG_PATTERN.finditer(raw):
        full = m.group(1) + m.group(2)
        suffix = m.group(2)
        if not any(c.isdigit() for c in suffix):
            continue
        if full in PLATE_BLACKLIST:
            continue
        candidates.append((m.start(), full))
    if not candidates:
        return None
    # Preferuj kandydata po '_' (w XLSX zwykle '<typ>_<TABLICA>_<marka>')
    for pos, plate in candidates:
        if pos > 0 and raw[pos - 1] in ('_', ' '):
            prev_chunk = raw[max(0, pos - 15):pos].lower()
            if any(kw in prev_chunk for kw in ('samoch', 'motocyk', 'pojazd', 'quad', 'przyczep', 'ciezar', 'ciężar', 'auto')):
                return plate
    # Fallback: pierwszy kandydat
    return candidates[0][1]

def parse_product(raw_co):
    """
    Wzorce:
    - 'samochód_GD721YL_Volvo XC60_poj 1968 cm3...' -> type=OC, vehicle_brand=Volvo XC60, vehicle_reg=GD721YL
    - 'dom_Konwaliowa 13' -> type=DOM, propertyAddress=Konwaliowa 13
    - 'mieszkanie_Niepolomicka' -> type=DOM (mieszkanie tez DOM)
    - 'majatek_X' -> type=DOM (majatek = DOM business)
    - 'firma_Deja Vu' -> type=FIRMA
    - 'firma_przyczepa ThePhoenixBarber' -> type=FIRMA (firma ma priorytet nad przyczepa)
    - 'firma_mienie_mury ul. Koscierska' -> type=FIRMA
    - 'OCPD' -> type=FIRMA (OC dzialalnosci)
    - 'OC' samo -> type=OC (auto)
    - 'podrózne_Malta 30.08-05.09.2025' -> type=PODROZ, destinationCountry=Malta
    - 'zycie_z mysla o zyciu plus' -> type=ZYCIE
    - 'NNW' -> type=ZYCIE
    - 'motocykl_GD73R4_Yamaha Tenere' -> type=OC, autoDetails.vehicleType=MOTOCYKL
    - 'pojazd_Quad GKAL82R' -> type=OC, autoDetails.vehicleType=QUAD
    - 'samochod ciezarowy_CBY1736A_Scania' -> type=OC, vehicleType=CIEZAROWY
    - 'flota 60 pojazdow' -> type=FIRMA (flota = firma)
    - '?', 'samochod_?', 'dom?' -> bestguess + ai_note: 'Niepewny typ - sprawdz manualnie'
    """
    raw_co = s(raw_co)
    if not raw_co or raw_co == '?':
        return {'type': 'OC', 'ai_note': 'XLSX: produkt nieokreslony "?" - wymaga sprawdzenia',
                'vehicle_brand': None, 'vehicle_model': None, 'vehicle_reg': None,
                'property_address': None, 'destination': None,
                'auto_details': {}, 'home_details': {}, 'travel_details': {}, 'firma_details': {}}

    low = raw_co.lower()
    parts = re.split(r'[_]', raw_co)
    first_segment = parts[0].strip().lower() if parts else low

    # Pierwsze SLOWO (split na bialych znakach), potem czyszczenie z ?., (zachowuje litery)
    first_word = first_segment.split()[0] if first_segment.split() else first_segment
    first_clean = re.sub(r'[?.,]', '', first_word)
    first = first_segment  # alias dla starego kodu

    result = {
        'type': 'OC',
        'vehicle_brand': None, 'vehicle_model': None, 'vehicle_reg': None,
        'property_address': None, 'destination': None,
        'auto_details': {}, 'home_details': {}, 'travel_details': {},
        'firma_details': {}, 'life_details': {},
        'ai_note': None,
    }

    # KROK 1: Hardcoded specials
    if 'ocpd' in first_clean:
        result['type'] = 'FIRMA'
        result['firma_details'] = {'businessType': 'OC_DZIALALNOSCI'}
        return result

    # KROK 2: FIRMA (ma priorytet bo firma_przyczepa to firma)
    if first_clean in ('firma', 'biznes', 'flota'):
        result['type'] = 'FIRMA'
        rest = '_'.join(parts[1:]) if len(parts) > 1 else ''
        result['firma_details'] = {'description': rest if rest else raw_co}
        # Sub-detect: mienie, flota
        if 'mienie' in low or 'mury' in low:
            result['firma_details']['subType'] = 'MIENIE'
        elif 'flota' in low or 'pojazdow' in low or 'pojazdów' in low:
            result['firma_details']['subType'] = 'FLOTA'
        return result

    # KROK 3: DOM (dom, mieszkanie, lokal, majatek, garaz, nieruchomosc)
    DOM_KEYWORDS = ['dom', 'mieszkanie', 'lokal', 'majatek', 'majątek', 'garaż', 'garaz',
                    'nieruchomosc', 'nieruchomość', 'budowa', 'domek']
    if first_clean in DOM_KEYWORDS or any(k in first for k in DOM_KEYWORDS):
        result['type'] = 'DOM'
        rest = '_'.join(parts[1:]).strip() if len(parts) > 1 else ''
        if rest:
            result['property_address'] = rest
        if 'mieszkanie' in low: result['home_details']['objectType'] = 'MIESZKANIE'
        elif 'budowa' in low: result['home_details']['objectType'] = 'BUDOWA'
        elif 'majatek' in first or 'majątek' in first: result['home_details']['objectType'] = 'MAJATEK'
        else: result['home_details']['objectType'] = 'DOM'
        # Metraż jeśli jest
        m2 = re.search(r'(\d+)\s*m2', low)
        if m2: result['home_details']['area'] = int(m2.group(1))
        # Niepewny dom?
        if first.endswith('?'): result['ai_note'] = 'XLSX: typ niepewny (dom?) - sprawdz'
        return result

    # KROK 4: PODROZ
    PODROZ_KEYWORDS = ['podróż', 'podroz', 'podrózna', 'podróżne', 'podrózne', 'podrozne',
                       'podróżna', 'wyjazd', 'turyst']
    if first_clean in PODROZ_KEYWORDS or any(k in first_clean for k in ['podroż','podrózn','podróżn']):
        result['type'] = 'PODROZ'
        rest = '_'.join(parts[1:]).strip() if len(parts) > 1 else ''
        # Wyciagnij destination + daty
        dest_match = re.match(r'^([A-Za-zĄ-ż\s]+)', rest)
        if dest_match:
            result['destination'] = dest_match.group(1).strip()
        # Daty podrozy: 30.08-05.09.2025
        date_match = re.search(r'(\d{1,2}\.\d{1,2})[-\.]?(\d{0,4})[-\s]?(\d{1,2}\.\d{1,2}\.\d{4})', rest)
        if date_match:
            result['travel_details']['datesRaw'] = rest
        return result

    # KROK 5: ZYCIE
    ZYCIE_KEYWORDS = ['życie', 'zycie', 'nnw', 'szpital', 'zdrowie', 'śmierć', 'smierc', 'life']
    if first_clean in ZYCIE_KEYWORDS:
        result['type'] = 'ZYCIE'
        rest = '_'.join(parts[1:]).strip() if len(parts) > 1 else ''
        if rest:
            result['life_details'] = {'description': rest}
        return result

    # KROK 6: OC samo (firma vs auto bifurcation)
    if first_clean == 'oc':
        # Sprawdz czy 'oc działalności/zawodowe/...'
        if any(k in low for k in ['działalno', 'zawodow', 'przewoź', 'spedyt', 'lekarz', 'medyc']):
            result['type'] = 'FIRMA'
            result['firma_details'] = {'businessType': 'OC_DZIALALNOSCI'}
            return result
        # Inaczej OC auto
        result['type'] = 'OC'
        # Falback: zostaw bez vehicle_brand
        result['ai_note'] = 'XLSX: tylko "OC" bez detali pojazdu'
        return result

    # KROK 7: POJAZDY (default fallback dla wszystkich innych)
    result['type'] = 'OC'

    # Vehicle subtype
    VEHICLE_SUBTYPE_MAP = {
        'motocykl': 'MOTOCYKL', 'motor': 'MOTOCYKL', 'skuter': 'MOTOCYKL',
        'quad': 'QUAD', 'atv': 'QUAD',
        'przyczepa': 'PRZYCZEPA', 'przyczepka': 'PRZYCZEPA', 'kemping': 'PRZYCZEPA',
        'ciężarowy': 'CIEZAROWY', 'ciezarowy': 'CIEZAROWY', 'dostawczy': 'CIEZAROWY',
        'autobus': 'AUTOBUS', 'bus': 'AUTOBUS',
        'ciągnik': 'CIAGNIK', 'ciagnik': 'CIAGNIK', 'siodłowy': 'CIAGNIK',
    }
    for kw, st in VEHICLE_SUBTYPE_MAP.items():
        if kw in low:
            result['auto_details']['vehicleType'] = st
            break
    if 'auto_details' not in result or 'vehicleType' not in result['auto_details']:
        result['auto_details']['vehicleType'] = 'OSOBOWY'

    # Quad detection (special: 'pojazd_Quad GKAL82R')
    if 'quad' in low:
        result['auto_details']['vehicleType'] = 'QUAD'

    # Vehicle reg pattern (np. GD721YL, GDA32773, RBR11282)
    plate = find_plate(raw_co)
    if plate:
        result['vehicle_reg'] = plate

    # Brand+model: parts[1] lub parts[2] po skip rejestracji
    # Najpierw spróbuj rozbicia po '_'; jeśli brak — split po tablicy w surowym tekście.
    rest_parts = parts[1:] if len(parts) > 1 else []
    BRAND_BLACKLIST = {'oc', 'ac', 'pakiet', 'kosztorys', 'serwis', 'szyby', 'leasingu',
                       'leasing', 'pelen', 'pełen', 'pelne', 'pełne', 'nnw', 'ass'}
    for p in rest_parts:
        p_strip = p.strip()
        if not p_strip or p_strip == '?': continue
        if VEHICLE_REG_PATTERN.match(p_strip): continue
        first_token = p_strip.split()[0] if p_strip.split() else ''
        if first_token.lower() in BRAND_BLACKLIST: continue
        if first_token and not first_token.isdigit() and not re.match(r'^\d', first_token):
            result['vehicle_brand'] = p_strip[:60]
            break

    # Fallback: brak '_' (np. 'samochód GWE1142V Volkswagen Golf 1598...')
    if not result['vehicle_brand'] and plate:
        idx = raw_co.find(plate)
        if idx >= 0:
            after = raw_co[idx + len(plate):].strip(' _,')
            # pierwsze 3-4 tokeny po tablicy = marka+model (do przecinka/separatora)
            m_brand = re.match(r'([A-Za-zĄ-żÓóŁł0-9\.\-\s]+?)(?:[,;_]|$)', after)
            if m_brand:
                brand_raw = m_brand.group(1).strip()
                first_tok = brand_raw.split()[0].lower() if brand_raw.split() else ''
                if brand_raw and first_tok not in BRAND_BLACKLIST and not brand_raw[0].isdigit():
                    result['vehicle_brand'] = brand_raw[:60]

    # AC/BOTH detection: tylko explicit AC/OC kombo lub osobne tokeny AC + OC.
    # NIE substring (samochód→'oc', Classic/Black→'ac', pakiet jest nieinformatywny).
    has_oc_word = bool(re.search(r'\boc\b', low))
    has_ac_word = bool(re.search(r'\b(ac|autocasco)\b', low))
    has_slash_combo = bool(re.search(r'\b(ac/oc|oc/ac|oc\+ac|ac\+oc)\b', low))
    if has_slash_combo or (has_ac_word and has_oc_word):
        result['type'] = 'BOTH'
    elif has_ac_word:
        result['type'] = 'AC'

    # G3EF Protocol: tylko rejestracja, brak marki
    if not result['vehicle_brand'] and result['vehicle_reg']:
        result['vehicle_brand'] = 'Nieznana'
        result['ai_note'] = f'XLSX: tylko rejestracja ({result["vehicle_reg"]}) - sprawdz w UFG'

    return result

# ============================================================
# STAGE
# ============================================================

def normalize_stage(raw):
    raw = s(raw)
    return STAGE_MAP.get(raw, 'of_do_zrobienia')  # default na valid enum

# ============================================================
# SUBAGENTS (col 13)
# ============================================================

def parse_subagent(raw_kogo):
    """
    Wzorce:
    - 'firmowy' -> name='Firmowy', group_prefix='firmowy'
    - 'firmowy/Beata' -> name='Beata', group_prefix='firmowy'
    - 'firmowy/Hejka/Baza od Beci' -> name='Hejka/Baza od Beci', group_prefix='firmowy'
      (zachowuje pelna sciezke jako name dla unikalnosci)
    - 'wlasny' / 'wlasny ' -> name='Własny', group_prefix='własny'
    - 'wlasny->rozliczona po zerwaniu ac w pzu' -> name='Własny', group_prefix='własny',
        notes='rozliczona po zerwaniu ac w pzu'
    """
    raw = s(raw_kogo).strip()
    if not raw: return None

    # Split na '->' (notatka rozliczeniowa)
    extra_note = None
    if '->' in raw:
        left, right = raw.split('->', 1)
        raw = left.strip()
        extra_note = right.strip()

    raw_low = raw.lower()
    # DB check constraint: group_prefix IN ('firmowy','wlasny','partner', NULL)
    if raw_low.startswith('własny') or raw_low.startswith('wlasny'):
        return {'name': 'Własny', 'group_prefix': 'wlasny', 'notes': extra_note}

    if raw_low.startswith('firmowy/'):
        rest = raw[len('firmowy/'):].strip()
        rest = re.sub(r'\s+', ' ', rest)
        return {'name': rest, 'group_prefix': 'firmowy', 'notes': extra_note}

    if raw_low == 'firmowy':
        return {'name': 'Firmowy (ogólny)', 'group_prefix': 'firmowy', 'notes': extra_note}

    # Inne -> partner
    return {'name': raw, 'group_prefix': 'partner', 'notes': extra_note}

# ============================================================
# NOTES (col 19)
# ============================================================

DATE_PATTERNS = [
    # 29.07.2025
    (re.compile(r'\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b'), 'dmy_full'),
    # 11.06 i 16.06.2025 -> dwie daty (rok jeden)
    (re.compile(r'\b(\d{1,2})\.(\d{1,2})\b(?!\.\d)'), 'dm'),
    # 04-06-2025 / 2025-06-11
    (re.compile(r'\b(\d{4})-(\d{1,2})-(\d{1,2})\b'), 'ymd'),
    (re.compile(r'\b(\d{1,2})-(\d{1,2})-(\d{4})\b'), 'dmy_dash'),
    # [2025-05-10]
    (re.compile(r'^\[(\d{4})-(\d{1,2})-(\d{1,2})\]'), 'iso_bracket'),
]

def extract_date_from_note(text, default_year=DEFAULT_YEAR):
    """Wyciaga date z poczatku notatki. Zwraca (date_iso | None, rest_of_text)."""
    text = text.strip()
    for pat, kind in DATE_PATTERNS:
        m = pat.match(text)
        if m:
            try:
                if kind == 'dmy_full':
                    d = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
                elif kind == 'dm':
                    d = date(default_year, int(m.group(2)), int(m.group(1)))
                elif kind == 'ymd':
                    d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                elif kind == 'dmy_dash':
                    d = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
                elif kind == 'iso_bracket':
                    d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                else:
                    continue
                return d.isoformat(), text[m.end():].strip()
            except (ValueError, IndexError):
                continue
    return None, text

def detect_tag(text):
    low = text.lower()
    if any(k in low for k in ['nie odbiera', 'brak tel', 'abonent niedostepny', 'abonent niedostępny']):
        return 'STATUS'
    if any(k in low for k in ['oferta', 'kalkulacj', 'wysłałam ofertę', 'wyslalam oferte']):
        return 'OFERTA'
    if any(k in low for k in ['rezygn', 'odmow', 'drogo', 'wstrzymuje', 'inny agent']):
        return 'DECISION_PRICE'
    if any(k in low for k in ['polisa wysłana', 'podpisał', 'sprzedan', 'do podpisu']):
        return 'STATUS'
    return 'ROZMOWA'

def parse_notes(raw, base_date_iso=None):
    """
    Bartek: 'agent notowal _ lub nowy wiersz hierarchia wpisu;
             1 wiersz jest najstarszy zazwyczaj; pozniej cos uzupelniane'
    Strategy:
    - Split na '_' lub '\\n' (separator zapisu - od starych do nowych)
    - Dla kazdego: wyciagnij date z poczatku (jesli jest), tag detection
    - Jesli brak daty - rozlozyc chronologicznie miedzy base_date a teraz
      (im pozniej w stringu, tym pozniej data)
    """
    raw = s(raw)
    if not raw: return []

    # Split: glownie '_' (wg statystyk), plus ';' i '\n'
    parts = re.split(r'[_\n]+|(?<=\.)\s*;\s*', raw)
    parts = [p.strip() for p in parts if p.strip()]
    if not parts: return []

    notes = []
    for idx, part in enumerate(parts):
        date_iso, content = extract_date_from_note(part)
        if not content: continue
        tag = detect_tag(content)
        notes.append({
            'order_idx': idx,
            'date': date_iso,
            'content': content,
            'tag': tag,
            'has_explicit_date': date_iso is not None,
        })

    # Fill brakujace daty: chronologicznie
    # Wg Bartka: 1 wiersz NAJSTARSZY, kolejne pozniejsze (uzupelnienia)
    # Strategy: najmlodsza data + kazda kolejna nota +1 minuta od previous (jezeli brak)
    if base_date_iso:
        try:
            current = datetime.fromisoformat(base_date_iso)
        except:
            current = datetime(DEFAULT_YEAR, 1, 1)
    else:
        current = datetime(DEFAULT_YEAR, 1, 1)

    for n in notes:
        if not n['date']:
            n['date'] = current.date().isoformat()
        else:
            current = datetime.fromisoformat(n['date'])
        # Pretend each note is +1 minute later than previous (for dedup of same-day notes)
        current += timedelta(minutes=1)

    return notes

# ============================================================
# PAYMENT STATUS (col 22)
# ============================================================

def parse_payment(raw):
    raw = s(raw).lower()
    if not raw: return 'UNPAID'
    if 'tak' in raw or 'opłac' in raw or 'oplac' in raw or 'paid' in raw: return 'PAID'
    if 'nie' in raw and 'opłac' not in raw: return 'UNPAID'
    return 'UNPAID'

# ============================================================
# INSURER lookup (col 11)
# ============================================================

def lookup_insurer(raw, insurers_db):
    """insurers_db = {nazwa_lower: uuid} pobierane runtime z Supabase"""
    raw = s(raw)
    if not raw or raw.lower() in ('brak', '?', 'inne', '-'):
        return None, None  # null insurer_id, null insurer_name
    raw_low = raw.lower()
    # Aliasy
    if 'hestia' in raw_low: raw_low = 'ergo hestia'
    if raw_low == 'pzu': raw_low = 'pzu sa'

    if raw_low in insurers_db:
        return insurers_db[raw_low], raw  # zwroc raw_name dla zachowania oryginalnej pisowni

    # Brak w bazie - zwroc raw_name + null id
    return None, raw

# ============================================================
# MAIN — mapper
# ============================================================

def fetch_insurers():
    """Pobierz mape insurer name->id z Supabase (runtime)."""
    URL = os.environ.get('CRM_ALINA_URL') or _rrv('CRM_ALINA_SUPABASE_URL')
    SECRET = os.environ.get('CRM_ALINA_SECRET') or _rrv('CRM_ALINA_SB_SECRET')
    if not URL or not SECRET:
        print('[WARN] Brak CRM_ALINA_URL/SECRET - lookup insurers przez stale ID')
        return {}
    h = {'apikey': SECRET, 'Authorization': f'Bearer {SECRET}', 'Accept-Profile': 'test'}
    r = urllib.request.urlopen(urllib.request.Request(
        f'{URL.rstrip("/")}/rest/v1/insurers?select=id,name', headers=h), timeout=10)
    data = json.loads(r.read())
    return {ins['name'].lower(): ins['id'] for ins in data}

def _rrv(key):
    """Czytaj z rrv vault (uzywa subprocess)."""
    import subprocess
    try:
        r = subprocess.run(['rrv', 'get', key], capture_output=True, text=True, timeout=5)
        return r.stdout.strip() if r.returncode == 0 else None
    except: return None

def map_row(idx, row, insurers_db):
    """Glowna funkcja mapping - 1 wiersz XLSX -> dict z client/policy/sub_agent/notes/share."""

    client_data = parse_client_name(row[0])
    if not client_data: return None

    addr = parse_address(row[6])
    phones = parse_phone(row[4])
    emails = parse_email(row[5])

    client_id = str(uuid.uuid4())
    policy_id = str(uuid.uuid4())

    # Client created_at = data pierwszego kontaktu (po dedup zostanie min ze wszystkich grupy)
    _client_created = (to_iso_date(row[1]) or to_iso_date(row[9]) or
                       to_iso_date(row[3]) or f'{DEFAULT_YEAR}-01-01') + 'T12:00:00+00:00'

    client = {
        'id': client_id,
        'tenant_id': TENANT_ID,
        'first_name': client_data['first_name'],
        'last_name': client_data['last_name'],
        'phones': '{' + ','.join(phones) + '}' if phones else '{}',
        'emails': '{' + ','.join(emails) + '}' if emails else '{}',
        'street': addr['street'],
        'city': addr['city'],
        'zip_code': addr['zip_code'],
        'businesses': [{'name': client_data['business_name'], 'nip': None}] if client_data['business_name'] else None,
        'source': SOURCE_TAG,
        'legacy_id': f'xlsx_2025_row_{idx+1}',
        'created_at': _client_created,
        'updated_at': _client_created,
    }

    product = parse_product(row[8])
    insurer_id, insurer_name = lookup_insurer(row[11], insurers_db)
    stage = normalize_stage(row[2])
    payment = parse_payment(row[22])

    premium = safe_money(row[12])
    commission = safe_money(row[14])
    sub_comm = safe_money(row[15])
    commission_rate = round(commission / premium * 100, 2) if (premium and commission and premium > 0) else None

    # created_at: priorytet col[1] (kontakt/sprzedaż = data utworzenia rekordu CRM),
    # NIE policy_start_date (która może być w przyszłości - polisa startuje za miesiąc).
    # Finance View grupuje po created_at -> musi to być data kontaktu, nie startu polisy.
    contact_iso = to_iso_date(row[1])
    start_iso = to_iso_date(row[9])
    next_iso = to_iso_date(row[3])
    created_iso = contact_iso or start_iso or next_iso or f'{DEFAULT_YEAR}-01-01'
    created_ts = created_iso + 'T12:00:00+00:00'

    policy = {
        'id': policy_id,
        'tenant_id': TENANT_ID,
        'client_id': client_id,
        'type': product['type'],
        'stage': stage,
        'insurer_id': insurer_id,
        'insurer_name': insurer_name,
        'policy_number': s(row[10]) or None,
        'premium': premium,
        'commission': commission,
        'commission_rate': commission_rate,
        'payment_status': payment,
        'policy_start_date': start_iso,
        'policy_end_date': None,
        'next_contact_date': next_iso,
        'created_at': created_ts,
        'updated_at': created_ts,
        'vehicle_brand': product['vehicle_brand'],
        'vehicle_model': product['vehicle_model'],
        'vehicle_reg': product['vehicle_reg'],
        'auto_details': product.get('auto_details', {}),
        'home_details': product.get('home_details', {}),
        'travel_details': product.get('travel_details', {}),
        'firma_details': product.get('firma_details', {}),
        'life_details': product.get('life_details', {}),
        'original_product_string': s(row[8]),
        'ai_note': product['ai_note'],
        'source': SOURCE_TAG,
        'legacy_id': f'xlsx_2025_row_{idx+1}',
    }

    # Ustal policy_end_date (+365 dni domyslnie)
    if policy['policy_start_date']:
        try:
            d = date.fromisoformat(policy['policy_start_date'])
            policy['policy_end_date'] = (d.replace(year=d.year + 1)).isoformat()
        except: pass

    # Sub-agent (col 13)
    sub_agent = parse_subagent(row[13])
    share = None
    if sub_agent:
        sub_agent_id = str(uuid.uuid4())  # placeholder - po dedup faktyczny ID przed insertem
        sub_agent['id'] = sub_agent_id
        sub_agent['tenant_id'] = TENANT_ID
        sub_agent['default_rates'] = {'OC': 0, 'AC': 0}
        if sub_comm and premium:
            share = {
                'id': str(uuid.uuid4()),
                'tenant_id': TENANT_ID,
                'policy_id': policy_id,
                'sub_agent_id': sub_agent_id,
                'rate': round(sub_comm / premium * 100, 2) if premium > 0 else None,
                'amount': sub_comm,
                'note': 'Import XLSX',
            }
        elif sub_comm or sub_agent.get('notes'):
            share = {
                'id': str(uuid.uuid4()),
                'tenant_id': TENANT_ID,
                'policy_id': policy_id,
                'sub_agent_id': sub_agent_id,
                'rate': None,
                'amount': sub_comm,
                'note': sub_agent.get('notes') or 'Import XLSX',
            }

    # Notes (col 19) - base_date z col 1 (kontakt/sprzedaz) - data zalozenia rekordu
    # bo Bartek: '1 wiersz najstarszy, pozniej uzupelniane'
    base_date = to_iso_date(row[1]) or policy['policy_start_date']
    notes_parsed = parse_notes(row[19], base_date_iso=base_date)
    notes = []
    for n in notes_parsed:
        notes.append({
            'id': str(uuid.uuid4()),
            'tenant_id': TENANT_ID,
            'client_id': client_id,
            'linked_policy_ids': '{' + policy_id + '}',
            'content': n['content'][:2000],  # cap
            'tag': n['tag'],
            'created_at': n['date'] + 'T00:00:00+00:00' if n['date'] else None,
            'legacy_id': f'xlsx_2025_row_{idx+1}_note_{n["order_idx"]}',
        })

    # Extra noty z col 17 (st_pol = stara polisa) i col 18 (wsp = wspolwlasciciele)
    if s(row[17]):
        notes.append({
            'id': str(uuid.uuid4()),
            'tenant_id': TENANT_ID,
            'client_id': client_id,
            'linked_policy_ids': '{' + policy_id + '}',
            'content': f'[STARA POLISA] {s(row[17])}',
            'tag': 'STATUS',
            'created_at': base_date + 'T00:00:00+00:00' if base_date else None,
            'legacy_id': f'xlsx_2025_row_{idx+1}_oldpol',
        })
    if s(row[18]):
        notes.append({
            'id': str(uuid.uuid4()),
            'tenant_id': TENANT_ID,
            'client_id': client_id,
            'linked_policy_ids': '{' + policy_id + '}',
            'content': f'[WSPOLWL/CESJA] {s(row[18])}',
            'tag': 'STATUS',
            'created_at': base_date + 'T00:00:00+00:00' if base_date else None,
            'legacy_id': f'xlsx_2025_row_{idx+1}_coowner',
        })

    # Extra notatka z client_data['extra_note'] (np. 'kontakt do Aleksandry G.')
    if client_data.get('extra_note'):
        notes.append({
            'id': str(uuid.uuid4()),
            'tenant_id': TENANT_ID,
            'client_id': client_id,
            'linked_policy_ids': '{' + policy_id + '}',
            'content': f'[KONTEKST] {client_data["extra_note"]}',
            'tag': 'ROZMOWA',
            'created_at': to_iso_date(row[1]) + 'T00:00:00+00:00' if row[1] else None,
            'legacy_id': f'xlsx_2025_row_{idx+1}_context',
        })

    return {
        'row_idx': idx + 1,
        'client': client,
        'policy': policy,
        'sub_agent': sub_agent,
        'share': share,
        'notes': notes,
    }


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'preview'

    print(f'[*] Wczytuje XLSX: {XLSX_PATH}')
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)
    ws = wb.active
    rows = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 2: continue  # skip 2 header rows
        if not row[0]: continue
        rows.append(list(row[:23]))
    print(f'[OK] {len(rows)} wierszy')

    print('[*] Pobieram insurers z Supabase...')
    insurers = fetch_insurers()
    print(f'[OK] {len(insurers)} insurers')

    print('[*] Mapuje wiersze...')
    mappings = []
    for idx, row in enumerate(rows):
        try:
            m = map_row(idx, row, insurers)
            if m: mappings.append(m)
        except Exception as e:
            print(f'[ERR] Wiersz {idx+1}: {e}')

    out_dir = 'C:/BartsGda4/CRM-ALINA/python/xlsx_import_2026'

    if cmd == 'preview':
        # Dump 5 sample
        sample = mappings[:5]
        with open(f'{out_dir}/preview_5.json', 'w', encoding='utf-8') as f:
            json.dump(sample, f, ensure_ascii=False, indent=2, default=str)
        with open(f'{out_dir}/full_mapping.json', 'w', encoding='utf-8') as f:
            json.dump(mappings, f, ensure_ascii=False, indent=2, default=str)
        print(f'[OK] preview_5.json (5 wierszy do akceptacji)')
        print(f'[OK] full_mapping.json (wszystkie {len(mappings)})')

        # Stats
        types = Counter(m['policy']['type'] for m in mappings)
        stages = Counter(m['policy']['stage'] for m in mappings)
        sub_agent_names = set(m['sub_agent']['name'] for m in mappings if m['sub_agent'])
        total_notes = sum(len(m['notes']) for m in mappings)
        ai_notes = [m for m in mappings if m['policy'].get('ai_note')]

        print()
        print(f'=== STATS ===')
        print(f'Polisy: {len(mappings)}')
        print(f'Klienci (raw, przed dedup): {len(mappings)}')
        print(f'Sub-agenci unikalni: {len(sub_agent_names)}')
        print(f'Notatki (laczna): {total_notes}')
        print(f'Polisy z ai_note (sprawdz): {len(ai_notes)}')
        print(f'\nTypy polis: {dict(types)}')
        print(f'\nStage distribution: {dict(stages)}')

    elif cmd == 'execute':
        URL = (os.environ.get('CRM_ALINA_URL') or _rrv('CRM_ALINA_SUPABASE_URL')).rstrip('/')
        SEC = os.environ.get('CRM_ALINA_SECRET') or _rrv('CRM_ALINA_SB_SECRET')
        if not URL or not SEC:
            print('[FATAL] Brak CRM_ALINA_URL/SECRET w env/rrv'); sys.exit(1)

        H = {
            'apikey': SEC,
            'Authorization': f'Bearer {SEC}',
            'Accept-Profile': 'test',
            'Content-Profile': 'test',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        }

        def req(method, path, body=None):
            data = json.dumps(body, default=str).encode('utf-8') if body is not None else None
            r = urllib.request.Request(f'{URL}/rest/v1/{path}', data=data, method=method, headers=H)
            try:
                resp = urllib.request.urlopen(r, timeout=30)
                return resp.status, resp.read()
            except urllib.error.HTTPError as e:
                return e.code, e.read()

        def count(table):
            req2 = urllib.request.Request(
                f'{URL}/rest/v1/{table}?select=id',
                headers={**H, 'Prefer': 'count=exact', 'Range': '0-0'}, method='GET')
            resp = urllib.request.urlopen(req2, timeout=15)
            cr = resp.headers.get('content-range', '*/0')
            return int(cr.split('/')[-1])

        # 0) CLIENT DEDUP — group by (first_name, last_name) lowercased
        # XLSX ma 1 wiersz = 1 polisa, ale ten sam klient ma czesto wiele polis
        # (Robert Stark: 20 polis -> 1 klient). Merge phones/emails/business/address.
        client_groups = {}  # (first_low, last_low) -> canonical client dict + list of mappings
        for m in mappings:
            c = m['client']
            key = (c['first_name'].strip().lower(), c['last_name'].strip().lower())
            if key not in client_groups:
                client_groups[key] = {'canonical': dict(c), 'mappings': [m]}
            else:
                grp = client_groups[key]
                grp['mappings'].append(m)
                can = grp['canonical']
                # Merge: phones/emails (union), address (first non-null wins),
                # businesses (concat unique by name), legacy_id (zachowaj pierwszy)
                def merge_arr(a, b):
                    out = list(a) if isinstance(a, list) else []
                    for x in (b if isinstance(b, list) else []):
                        if x and x not in out: out.append(x)
                    return out
                # phones/emails są jeszcze stringami '{x,y}' albo []
                for col in ('phones', 'emails'):
                    a, b = can.get(col, ''), c.get(col, '')
                    if isinstance(a, str): a = [x for x in a.strip('{}').split(',') if x]
                    if isinstance(b, str): b = [x for x in b.strip('{}').split(',') if x]
                    can[col] = merge_arr(a, b)
                for col in ('street', 'city', 'zip_code'):
                    if not can.get(col) and c.get(col): can[col] = c[col]
                # created_at: weź NAJWCZEŚNIEJSZĄ datę z grupy (pierwsza polisa = data klienta)
                if c.get('created_at') and (not can.get('created_at') or c['created_at'] < can['created_at']):
                    can['created_at'] = c['created_at']
                    can['updated_at'] = c['created_at']
                # businesses union by name
                ca_biz = can.get('businesses') or []
                c_biz = c.get('businesses') or []
                names = {b.get('name') for b in ca_biz if b}
                for b in c_biz:
                    if b and b.get('name') and b['name'] not in names:
                        ca_biz.append(b); names.add(b['name'])
                can['businesses'] = ca_biz
        print(f'[*] Klienci po dedup: {len(client_groups)} unikalnych (z {len(mappings)} wierszy XLSX)')

        # Przepisz client_id w policies+notes na canonical (pierwszy z grupy)
        for key, grp in client_groups.items():
            canonical_id = grp['canonical']['id']
            for m in grp['mappings']:
                m['policy']['client_id'] = canonical_id
                for n in m['notes']:
                    n['client_id'] = canonical_id
                # Mapping ma teraz pole canonical_client_id dla insertu
                m['_canonical_client_id'] = canonical_id

        # 1) Sub-agent dedup po (name, group_prefix)
        sub_unique = {}  # (name, group_prefix) -> id
        for m in mappings:
            sa = m['sub_agent']
            if not sa: continue
            key = (sa['name'], sa['group_prefix'])
            if key not in sub_unique:
                sub_unique[key] = sa['id']  # zachowaj pierwszy UUID
            else:
                # podmień id w mapping na canonical
                sa['id'] = sub_unique[key]
                if m['share']:
                    m['share']['sub_agent_id'] = sub_unique[key]
        print(f'[*] Sub-agenci: {len(sub_unique)} unikalnych (z {sum(1 for m in mappings if m["sub_agent"])} raw)')

        # 2) Konwersja phones/emails do JSON list (PostgREST oczekuje JSON array dla _text)
        for m in mappings:
            c = m['client']
            # '{p1,p2}' string -> list
            for col in ('phones', 'emails'):
                v = c.get(col, '{}')
                if isinstance(v, str) and v.startswith('{'):
                    inner = v.strip('{}')
                    c[col] = [x for x in inner.split(',') if x] if inner else []
            # linked_policy_ids w notatkach
        for m in mappings:
            for n in m['notes']:
                lpi = n.get('linked_policy_ids', '{}')
                if isinstance(lpi, str) and lpi.startswith('{'):
                    inner = lpi.strip('{}')
                    n['linked_policy_ids'] = [x for x in inner.split(',') if x] if inner else []

        # 3) TRUNCATE ALL — test schema czyszczona w całości
        # (Bartek 2026-05-11: zostaly smieci z prob importu, czysc wszystko)
        # Kolejność: dzieci -> rodzice (FK)
        FAKE_UUID = '00000000-0000-0000-0000-000000000000'
        print('[*] TRUNCATE all (test schema - clean slate)')
        for tbl in ('policy_sub_agent_shares', 'policy_notes', 'policies',
                    'insurance_clients', 'sub_agents'):
            code, body = req('DELETE', f'{tbl}?id=neq.{FAKE_UUID}')
            # ile zostalo
            n_after = count(tbl)
            print(f'  {tbl}: HTTP {code} -> {n_after} po DELETE')

        # 4) INSERT sub_agents
        sub_rows = []
        for (name, gp), sid in sub_unique.items():
            sub_rows.append({
                'id': sid,
                'tenant_id': TENANT_ID,
                'name': name,
                'group_prefix': gp,
                'default_rates': {'OC': 0, 'AC': 0},
                'notes': 'Import XLSX 2026-05-10',
            })
        if sub_rows:
            code, body = req('POST', 'sub_agents', sub_rows)
            print(f'[INSERT] sub_agents x{len(sub_rows)} -> HTTP {code}')
            if code >= 400: print('  ', body[:400].decode('utf-8','ignore'))

        # 5) INSERT insurance_clients — TYLKO canonical po dedup (99 zamiast 182)
        client_rows = []
        for key, grp in client_groups.items():
            c = dict(grp['canonical'])
            c['type'] = 'PERSON'
            if not c.get('businesses'):
                c['businesses'] = []
            # phones/emails są listami po dedup merge
            for col in ('phones', 'emails'):
                v = c.get(col)
                if isinstance(v, str) and v.startswith('{'):
                    inner = v.strip('{}')
                    c[col] = [x for x in inner.split(',') if x] if inner else []
                elif v is None:
                    c[col] = []
            client_rows.append(c)
        # Batch po 50
        for i in range(0, len(client_rows), 50):
            chunk = client_rows[i:i+50]
            code, body = req('POST', 'insurance_clients', chunk)
            if code >= 400:
                print(f'[ERR] insurance_clients[{i}:{i+50}] HTTP {code}: {body[:600].decode("utf-8","ignore")}')
                sys.exit(1)
        print(f'[INSERT] insurance_clients x{len(client_rows)} -> OK')

        # 6) INSERT policies (must reference v1_original_client_id NULL; client_id juz mamy)
        pol_rows = []
        for m in mappings:
            p = dict(m['policy'])
            # checklist/calculations defaults
            p.setdefault('checklist', {})
            p.setdefault('calculations', [])
            pol_rows.append(p)
        for i in range(0, len(pol_rows), 50):
            chunk = pol_rows[i:i+50]
            code, body = req('POST', 'policies', chunk)
            if code >= 400:
                print(f'[ERR] policies[{i}:{i+50}] HTTP {code}: {body[:600].decode("utf-8","ignore")}')
                sys.exit(1)
        print(f'[INSERT] policies x{len(pol_rows)} -> OK')

        # 7) INSERT policy_notes
        all_notes = [n for m in mappings for n in m['notes']]
        for i in range(0, len(all_notes), 100):
            chunk = all_notes[i:i+100]
            code, body = req('POST', 'policy_notes', chunk)
            if code >= 400:
                print(f'[ERR] policy_notes[{i}:{i+100}] HTTP {code}: {body[:600].decode("utf-8","ignore")}')
                sys.exit(1)
        print(f'[INSERT] policy_notes x{len(all_notes)} -> OK')

        # 8) INSERT policy_sub_agent_shares
        shares = [m['share'] for m in mappings if m['share']]
        if shares:
            code, body = req('POST', 'policy_sub_agent_shares', shares)
            if code >= 400:
                print(f'[ERR] policy_sub_agent_shares HTTP {code}: {body[:600].decode("utf-8","ignore")}')
            else:
                print(f'[INSERT] policy_sub_agent_shares x{len(shares)} -> OK')

        # 9) Verify counts
        print()
        print('=== POST-INSERT COUNTS (test schema, source=' + SOURCE_TAG + ') ===')
        for tbl in ('insurance_clients', 'policies', 'policy_notes', 'sub_agents', 'policy_sub_agent_shares'):
            try:
                n = count(tbl)
                print(f'  {tbl}: {n}')
            except Exception as e:
                print(f'  {tbl}: ERR {e}')


if __name__ == '__main__':
    main()
