"""
AI-parse 182 wierszy XLSX przez Gemini Flash (consis_flash rotator).

Wyjście: ai_parsed_182.json - lista 182 dict z policy_type + struktury per typ.

Użycie:
    python ai_parse_xlsx.py                # parsuj batchami po 30
    python ai_parse_xlsx.py --batch 50     # większe batche
    python ai_parse_xlsx.py --apply        # po parsowaniu UPDATE policies w DB
"""

from __future__ import annotations
import sys, json, os, subprocess, urllib.request
from pathlib import Path
from typing import Any, List, Dict

# Dolącz consis_flash
sys.path.insert(0, r'C:\BartsGda4-MCP-SKILLS\CONSIS-MCP\tools')
from consis_flash import call_gemini

RAW = Path(r'C:\BartsGda4\CRM-ALINA\python\xlsx_import_2026\raw_182_rows.json')
OUT = Path(r'C:\BartsGda4\CRM-ALINA\python\xlsx_import_2026\ai_parsed_182.json')

SYSTEM_PROMPT = """Jesteś parserem CRM agencji ubezpieczeniowej. Dostajesz batch wierszy XLSX (każdy ma 23 pola: imie_nazwisko, kontakt_sprzedaz, etap, kol_kont, nr_tel, email, adres, pesel_nip, co, start_polisy, nr_pol, gdzie, przyp, kogo, prow, rozl, sta_pol_moja_of, st_pol, wsp, notatki, dok, zal_dok, platnosc).

Kluczowa kolumna: `co` - opisuje przedmiot polisy w naturalnym języku polskim. Może być: pojazd (samochód_REJ_marka model cc km year fuel), dom (dom_adres / mieszkanie_adres / majątek_X / budowa_X), podróż (podróż/podróżne_destination_daty), życie (zycie/NNW/zdrowie), firma (firma_X / OCPD / flota), kombinacje (AC/OC, OC działalności).

Dla każdego wiersza zwróć JSON:
{
  "row_idx": <int>,
  "policy_type": "OC" | "AC" | "BOTH" | "DOM" | "PODROZ" | "ZYCIE" | "FIRMA",
  "vehicle": null lub {"brand": str, "model": str, "reg": str, "engine_cc": int|null, "power_km": int|null, "power_kw": int|null, "year": int|null, "fuel": "benzyna"|"diesel"|"LPG"|"hybryda"|"elektryk"|null, "vehicle_type": "OSOBOWY"|"DOSTAWCZY"|"CIEZAROWY"|"MOTOCYKL"|"QUAD"|"PRZYCZEPA"|"AUTOBUS"|"CIAGNIK"},
  "ac_details": null lub {"kind": "kosztorys"|"serwis"|"pakiet"|null, "ass": "Złoty"|"Srebrny"|"Standard"|null, "szyby": bool, "opony": bool, "extras": [str]},
  "home": null lub {"address": str, "area_m2": int|null, "type": "DOM"|"MIESZKANIE"|"MAJATEK"|"BUDOWA"|"GARAZ"|"DOMEK"},
  "travel": null lub {"destination": str, "date_from": str|null, "date_to": str|null, "persons": int|null},
  "firma": null lub {"description": str, "subType": "MIENIE"|"FLOTA"|"OC_DZIALALNOSCI"|null, "fleet_count": int|null},
  "life": null lub {"description": str, "kind": "NNW"|"ZYCIE"|"ZDROWIE"|null},
  "ai_note": null lub str (uwaga gdy coś naprawdę niejasne - np. "?", brak danych, dziwna struktura),
  "old_policy": null lub {"insurer": str|null, "number": str|null, "type_hint": str|null}
}

Zasady:
- BOTH gdy w `co` widzisz oba: "AC/OC", "OC+AC", lub osobne tokeny AC i OC. NIE bądź uznaniowy - musi być explicit.
- DOSTAWCZY/CIEZAROWY rozpoznawaj po marce/modelu (Transporter, Crafter, Caddy, Ducato, Master, Trafic = dostawczy; Iveco, Scania, MAN = ciężarowy).
- Wyciągaj pojemność (cc/ccm/cm3), moc (KM lub kW), rok produkcji z `co`/`notatki`.
- ai_note tylko gdy NAPRAWDĘ potrzeba ludzkiej interwencji (typ pojazdu niewiadomy, tylko tablica, "?" w XLSX).
- old_policy z kolumny `st_pol` jeśli jest.

Output: WYŁĄCZNIE valid JSON array, bez komentarzy, bez markdown."""


def parse_batch(rows: List[dict]) -> List[dict]:
    """Wyślij batch do Gemini Flash, zwróć listę enriched dict."""
    payload = json.dumps(rows, ensure_ascii=False, default=str)
    prompt = f"{SYSTEM_PROMPT}\n\n=== BATCH ({len(rows)} wierszy) ===\n{payload}\n\n=== ZWRÓĆ JSON ARRAY ({len(rows)} elementów) ==="
    resp = call_gemini(prompt, max_tokens=16384, temperature=0.1, model='flash')
    if '_blad' in resp:
        print(f'  [ERR] {resp["_blad"]}', file=sys.stderr)
        return []
    # Response jest dict - jeśli flat ma key z listą, znajdź ją
    if isinstance(resp, list):
        return resp
    # FlashClient może zwrócić {"items": [...]} lub flat - znajdź pierwszą listę
    for k, v in resp.items():
        if k.startswith('_'): continue
        if isinstance(v, list) and v and isinstance(v[0], dict) and 'row_idx' in v[0]:
            return v
    # Fallback: cały resp jako jeden element listy
    if 'row_idx' in resp:
        return [resp]
    print(f'  [WARN] Niespodziewany format response, klucze={list(resp.keys())[:10]}', file=sys.stderr)
    return []


def main():
    batch_size = 30
    apply = '--apply' in sys.argv
    if '--batch' in sys.argv:
        batch_size = int(sys.argv[sys.argv.index('--batch') + 1])

    rows = json.loads(RAW.read_text(encoding='utf-8'))
    print(f'[*] {len(rows)} wierszy do parsowania, batch={batch_size}')

    all_parsed: List[dict] = []
    # resume jeśli już coś jest
    if OUT.exists():
        all_parsed = json.loads(OUT.read_text(encoding='utf-8'))
        done_idx = {x['row_idx'] for x in all_parsed}
        rows_to_do = [r for r in rows if r['row_idx'] not in done_idx]
        print(f'[*] Resume: {len(all_parsed)} ready, {len(rows_to_do)} TODO')
    else:
        rows_to_do = rows

    for i in range(0, len(rows_to_do), batch_size):
        batch = rows_to_do[i:i + batch_size]
        idx_start = batch[0]['row_idx']
        idx_end = batch[-1]['row_idx']
        print(f'[batch {i // batch_size + 1}] rows {idx_start}..{idx_end} ({len(batch)} wierszy)...', end=' ', flush=True)
        parsed = parse_batch(batch)
        print(f'OK {len(parsed)}')
        all_parsed.extend(parsed)
        # save incrementally
        OUT.write_text(json.dumps(all_parsed, ensure_ascii=False, indent=2, default=str), encoding='utf-8')

    print(f'\n[OK] Zapisano {len(all_parsed)} parsed w {OUT}')

    # Stats
    from collections import Counter
    types = Counter(p.get('policy_type') for p in all_parsed)
    ai_notes = [p for p in all_parsed if p.get('ai_note')]
    print(f'\nTypy: {dict(types)}')
    print(f'AI notes: {len(ai_notes)}')

    if apply:
        apply_to_db(all_parsed)


def _rrv(k: str):
    try:
        r = subprocess.run(['rrv', 'get', k], capture_output=True, text=True, timeout=5)
        return r.stdout.strip() if r.returncode == 0 else None
    except: return None


def apply_to_db(parsed: List[dict]):
    URL = _rrv('CRM_ALINA_SUPABASE_URL'); SEC = _rrv('CRM_ALINA_SB_SECRET')
    H = {'apikey': SEC, 'Authorization': f'Bearer {SEC}',
         'Accept-Profile': 'test', 'Content-Profile': 'test',
         'Content-Type': 'application/json', 'Prefer': 'return=minimal'}

    def patch(url, body):
        r = urllib.request.Request(f'{URL}/rest/v1/{url}',
                                    data=json.dumps(body, default=str).encode('utf-8'),
                                    headers=H, method='PATCH')
        try:
            urllib.request.urlopen(r, timeout=30)
            return True
        except urllib.error.HTTPError as e:
            print(f'  [ERR] {e.code}: {e.read()[:300].decode("utf-8","ignore")}')
            return False

    ok = 0
    for p in parsed:
        legacy_id = f"xlsx_2025_row_{p['row_idx']}"
        body = {
            'type': p['policy_type'],
            'ai_note': p.get('ai_note'),
        }
        if p.get('vehicle'):
            v = p['vehicle']
            body['vehicle_brand'] = v.get('brand')
            body['vehicle_model'] = v.get('model')
            body['vehicle_reg'] = v.get('reg')
            body['auto_details'] = {k: v[k] for k in ('engine_cc', 'power_km', 'power_kw', 'year', 'fuel', 'vehicle_type') if v.get(k) is not None}
        if p.get('ac_details'):
            body['auto_details'] = {**(body.get('auto_details') or {}), 'ac': p['ac_details']}
        if p.get('home'):
            body['home_details'] = p['home']
        if p.get('travel'):
            body['travel_details'] = p['travel']
        if p.get('firma'):
            body['firma_details'] = p['firma']
        if p.get('life'):
            body['life_details'] = p['life']
        if patch(f'policies?legacy_id=eq.{legacy_id}', body):
            ok += 1
    print(f'[APPLY] zaktualizowano {ok}/{len(parsed)} polis w test schema')


if __name__ == '__main__':
    main()
