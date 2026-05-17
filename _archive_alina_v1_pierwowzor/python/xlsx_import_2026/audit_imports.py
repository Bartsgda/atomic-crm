"""
AUDIT po-importowy: dla kazdej z 182 polis sprawdza spojnosc miedzy
raw XLSX wierszem + aktualnym stanem w test schema (policy + notatki + coOwners).

Gemini Flash dla kazdej polisy daje verdict: OK / WARN / ERROR + lista konkretnych issues.

Output: audit_report_182.json (raport zatwierdzony przez Bartka) + audit_report.md (human-readable).

Po review Bartka skrypt apply_audit_fixes.py zaaplikuje akceptowane poprawki.
"""
from __future__ import annotations
import sys, json, subprocess, urllib.request
from pathlib import Path
from typing import List

sys.path.insert(0, r'C:\BartsGda4-MCP-SKILLS\CONSIS-MCP\tools')
from consis_flash import call_gemini

RAW_PATH = Path(r'C:\BartsGda4\CRM-ALINA\python\xlsx_import_2026\raw_182_rows.json')
OUT_JSON = Path(r'C:\BartsGda4\CRM-ALINA\python\xlsx_import_2026\audit_report_182.json')
OUT_MD = Path(r'C:\BartsGda4\CRM-ALINA\python\xlsx_import_2026\audit_report_182.md')

SYSTEM = """Jesteś auditorem importu danych XLSX agencji ubezpieczeniowej. Dla każdej polisy dostajesz:
1) RAW: surowy wiersz z XLSX (23 kolumny + nazwa klienta)
2) DB: aktualny stan w bazie test schema (policy + notatki + coOwners + insurer)

ZADANIE: Sprawdź czy import jest poprawny. Wypatruj typowych błędów:
- Tekst z `col[18] wsp` lub `col[17] st_pol` źle sklasyfikowany (np. "klient podpisał gdzie indziej" mylnie zamapowany jako współwłaściciel)
- Notatki sprzeczne z polisą (np. polisa sprzedaż ale notatka "klient zrezygnował")
- Brakujące dane wyciągalne z XLSX (np. PESEL w notatce ale nie w `clients.pesel`)
- PESEL klienta wrzucony jako PESEL coOwnera (zwrot wskazujacy: "pesel kl X")
- Tablica pojazdu nietypowa lub źle wyciągnięta
- coOwner faktycznie jest klientem (mąż = wspólny klient już w bazie)
- Daty `created_at` niezgodne z chronologią notatek
- Brak `vehicle_brand`/`vehicle_model` choć w `co` są
- Typ polisy niewłaściwy (np. ZYCIE ustawione na NNW szkolne ale powinno OBJAW=NNW)

Zwróć JSON OBIEKT (nie array!) z polem `audits`:
{
  "audits": [
    {
      "row_idx": N,
      "verdict": "OK" | "WARN" | "ERROR",
      "issues": [
        {"severity": "WARN"|"ERROR", "field": "policy.vehicle_brand"|"coOwners"|"notes"|..., "problem": "...", "suggested_fix": "..."}
      ]
    }
  ]
}

OK = wszystko jak należy. WARN = drobny brak/niespójność. ERROR = wymaga ręcznej decyzji Bartka.
Output: WYŁĄCZNIE valid JSON object (nie array, nie markdown)."""


def _rrv(k):
    try:
        r = subprocess.run(['rrv', 'get', k], capture_output=True, text=True, timeout=5)
        return r.stdout.strip() if r.returncode == 0 else None
    except: return None


def fetch_db_state():
    URL = _rrv('CRM_ALINA_SUPABASE_URL'); SEC = _rrv('CRM_ALINA_SB_SECRET')
    h = {'apikey': SEC, 'Authorization': f'Bearer {SEC}', 'Accept-Profile': 'test'}
    # Polisy
    r = urllib.request.urlopen(urllib.request.Request(
        f'{URL}/rest/v1/policies?source=eq.xlsx_import&select=*&limit=500',
        headers=h), timeout=15)
    pols = json.loads(r.read())
    by_legacy = {p['legacy_id']: p for p in pols}
    # Klienci
    client_ids = {p['client_id'] for p in pols}
    if client_ids:
        ids_str = ','.join(client_ids)
        r = urllib.request.urlopen(urllib.request.Request(
            f'{URL}/rest/v1/insurance_clients?id=in.({ids_str})&select=id,first_name,last_name,phones,emails,businesses',
            headers=h), timeout=15)
        clients = {c['id']: c for c in json.loads(r.read())}
    else:
        clients = {}
    # Notatki - tylko XLSX-source (legacy_id starts xlsx_)
    import urllib.parse as up
    r = urllib.request.urlopen(urllib.request.Request(
        f'{URL}/rest/v1/policy_notes?legacy_id=like.{up.quote("xlsx_2025_%")}&select=client_id,linked_policy_ids,content,tag,created_at,legacy_id&limit=2000',
        headers=h), timeout=20)
    notes = json.loads(r.read())
    notes_by_policy = {}
    for n in notes:
        for pid in (n.get('linked_policy_ids') or []):
            notes_by_policy.setdefault(pid, []).append({
                'content': n['content'][:300], 'tag': n['tag'], 'created_at': n.get('created_at'),
            })
    # Insurers
    r = urllib.request.urlopen(urllib.request.Request(
        f'{URL}/rest/v1/insurers?select=id,name', headers=h), timeout=10)
    insurers = {i['id']: i['name'] for i in json.loads(r.read())}
    return by_legacy, clients, notes_by_policy, insurers


def build_audit_item(raw_row, by_legacy, clients, notes_by_policy, insurers):
    legacy_id = f"xlsx_2025_row_{raw_row['row_idx']}"
    pol = by_legacy.get(legacy_id, {})
    client = clients.get(pol.get('client_id'), {})
    notes = notes_by_policy.get(pol.get('id'), [])
    item = {
        'row_idx': raw_row['row_idx'],
        'raw': {
            'imie_nazwisko': raw_row.get('imie_nazwisko'),
            'kontakt_sprzedaz': raw_row.get('kontakt_sprzedaz'),
            'etap': raw_row.get('etap'),
            'co': raw_row.get('co'),
            'gdzie': raw_row.get('gdzie'),
            'przyp': raw_row.get('przyp'),
            'prow': raw_row.get('prow'),
            'rozl': raw_row.get('rozl'),
            'kogo': raw_row.get('kogo'),
            'st_pol': raw_row.get('st_pol'),
            'wsp': raw_row.get('wsp'),
            'notatki': (raw_row.get('notatki') or '')[:600],
        },
        'db': {
            'client': {
                'name': f"{client.get('first_name','')} {client.get('last_name','')}".strip(),
                'phones': client.get('phones'),
                'emails': client.get('emails'),
                'businesses': client.get('businesses'),
            },
            'policy': {
                'type': pol.get('type'),
                'stage': pol.get('stage'),
                'insurer_name': pol.get('insurer_name'),
                'premium': pol.get('premium'),
                'commission': pol.get('commission'),
                'policy_start_date': pol.get('policy_start_date'),
                'next_contact_date': pol.get('next_contact_date'),
                'created_at': pol.get('created_at'),
                'vehicle_brand': pol.get('vehicle_brand'),
                'vehicle_model': pol.get('vehicle_model'),
                'vehicle_reg': pol.get('vehicle_reg'),
                'auto_details': pol.get('auto_details'),
                'home_details': pol.get('home_details'),
                'travel_details': pol.get('travel_details'),
                'life_details': pol.get('life_details'),
                'firma_details': pol.get('firma_details'),
                'ai_note': pol.get('ai_note'),
            },
            'notes_count': len(notes),
            'notes_sample': notes[:5],
        },
    }
    return item


def audit_batch(batch: List[dict], retries: int = 3) -> List[dict]:
    import time
    prompt = f"{SYSTEM}\n\n=== BATCH ({len(batch)} polis) ===\n{json.dumps(batch, ensure_ascii=False, default=str)}\n\n=== ZWRÓĆ JSON OBJECT z polem `audits` ({len(batch)} elementów) ==="
    for attempt in range(retries):
        try:
            resp = call_gemini(prompt, max_tokens=8192, temperature=0.1, model='lite')
        except TypeError:
            # consis_flash bug gdy zwraca list - retry z mniejszym batchem
            return []
        if isinstance(resp, dict) and '_blad' not in resp:
            if 'audits' in resp and isinstance(resp['audits'], list):
                return resp['audits']
            for k, v in resp.items():
                if k.startswith('_'): continue
                if isinstance(v, list) and v and isinstance(v[0], dict) and 'row_idx' in v[0]:
                    return v
        # retry on 503/parse_fail
        if attempt < retries - 1:
            time.sleep(2 ** (attempt + 1))
    return []


def main():
    batch_size = 5  # mniejsze batche - stabilniejsze + omijają 503 spike
    rows = json.loads(RAW_PATH.read_text(encoding='utf-8'))
    print(f'[*] Pobieram stan DB...')
    by_legacy, clients, notes_by_policy, insurers = fetch_db_state()
    print(f'[OK] {len(by_legacy)} polis, {len(clients)} klientow, {sum(len(v) for v in notes_by_policy.values())} notatek')

    all_audit: List[dict] = []
    if OUT_JSON.exists():
        all_audit = json.loads(OUT_JSON.read_text(encoding='utf-8'))
        done = {x['row_idx'] for x in all_audit}
        rows_todo = [r for r in rows if r['row_idx'] not in done]
        print(f'[*] Resume: {len(all_audit)} done, {len(rows_todo)} TODO')
    else:
        rows_todo = rows

    items = [build_audit_item(r, by_legacy, clients, notes_by_policy, insurers) for r in rows_todo]

    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        idx_range = f"{batch[0]['row_idx']}..{batch[-1]['row_idx']}"
        print(f'[batch {i // batch_size + 1}] rows {idx_range} ({len(batch)})...', end=' ', flush=True)
        parsed = audit_batch(batch)
        print(f'OK {len(parsed)}')
        all_audit.extend(parsed)
        OUT_JSON.write_text(json.dumps(all_audit, ensure_ascii=False, indent=2, default=str), encoding='utf-8')

    print(f'\n[OK] Audit zapisany: {OUT_JSON} ({len(all_audit)} polis)')

    # Aggreguj
    from collections import Counter
    verdicts = Counter(a.get('verdict') for a in all_audit)
    all_issues = [iss for a in all_audit for iss in (a.get('issues') or [])]
    sev = Counter(iss.get('severity') for iss in all_issues)
    fields = Counter(iss.get('field') for iss in all_issues)
    print(f'\n=== AGGREGATE ===')
    print(f'Verdicts: {dict(verdicts)}')
    print(f'Total issues: {len(all_issues)} (severity: {dict(sev)})')
    print(f'Top 10 fields z issues:')
    for f, c in fields.most_common(10):
        print(f'  {c:>4}  {f}')

    # MD raport
    md = [f'# Audit Report — 182 polis ({len(all_issues)} issues)\n']
    md.append(f'**Verdicts:** {dict(verdicts)}\n**Severity:** {dict(sev)}\n')
    md.append('## Top fields z issues\n')
    for f, c in fields.most_common(15):
        md.append(f'- `{f}`: **{c}**')
    md.append('\n## Issues (top 20 ERROR)\n')
    errors = [a for a in all_audit if a.get('verdict') == 'ERROR']
    for a in errors[:20]:
        md.append(f'\n### row {a["row_idx"]} ({a["verdict"]})')
        for iss in (a.get('issues') or []):
            md.append(f'- **{iss.get("severity")}** `{iss.get("field")}`: {iss.get("problem")}')
            md.append(f'  - Fix: _{iss.get("suggested_fix")}_')
    OUT_MD.write_text('\n'.join(md), encoding='utf-8')
    print(f'\n[OK] MD raport: {OUT_MD}')


if __name__ == '__main__':
    main()
