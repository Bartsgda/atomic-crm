import json

with open('C:/BartsGda4/CRM-Atomic/audit_results_61_110.json', 'r', encoding='utf-8') as f:
    results = json.load(f)

by_id = {r['legacy_id']: r for r in results}

# Row 91 all notes
r91 = by_id['xlsx_2025_row_91']
print('=== row_91 Stark Amarok - ALL notes ===')
for n in r91['all_client_notes']:
    if r91['client']['id'] == n.get('client_id'):
        print(f'  [{n.get("tag")}] {n.get("created_at","")[:10]} | {n.get("content","")[:150]}')

# row_77 all notes
r77 = by_id['xlsx_2025_row_77']
print('\n=== row_77 Tron OC - coOwner string ===')
print(f'coOwners raw: {json.dumps(r77["auto_details"].get("coOwners"), ensure_ascii=False)}')
print(f'Note: "pesel kl 86080119155" in coOwner name = PESEL sczepiony z leasingodawcą')
print(f'clients.pesel_encrypted: {r77["client"].get("pesel_encrypted")}')
print(f'businesses: {r77["businesses"]}')

# row_85 policy full info
r85 = by_id['xlsx_2025_row_85']
print('\n=== row_85 Waczynski - home_details + firma_details ===')
print(f'home_details: {json.dumps(r85["home_details"], ensure_ascii=False)}')
print(f'firma_details: {json.dumps(r85["firma_details"], ensure_ascii=False)}')
print(f'NOTE: Both home_details AND firma_details are populated - mismatch')

# Count policies OK in batch
ok_rows = [r for r in results if not r['bugs'] and not r['warnings']]
print(f'\n=== Totals ===')
print(f'OK rows: {len(ok_rows)}')
print(f'Bug rows: {len([r for r in results if r["bugs"]])}')
print(f'Warning-only rows: {len([r for r in results if r["warnings"] and not r["bugs"]])}')

# All unique bug types
all_bugs = []
for r in results:
    all_bugs.extend(r['bugs'])
print(f'\nAll bugs ({len(all_bugs)}):')
for b in all_bugs:
    print(f'  {b[:120]}')
