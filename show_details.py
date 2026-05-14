import json

with open('C:/BartsGda4/CRM-Atomic/audit_results_61_110.json', 'r', encoding='utf-8') as f:
    results = json.load(f)

# Index by legacy_id
by_id = {r['legacy_id']: r for r in results}

# Row 91 - coOwner "pin 1672"
r91 = by_id['xlsx_2025_row_91']
print('=== row_91 auto_details.coOwners ===')
print(json.dumps(r91['auto_details'], ensure_ascii=False, indent=2))
print(f'ops: {r91["ops"]}')
print()

# Row 77 - Tron OC with businesses ThePhoenixBarber (had the pesel-kl fix in row_5)
r77 = by_id['xlsx_2025_row_77']
print('=== row_77 Tron OC ===')
print(f'ops: {r77["ops"]}')
print(f'auto_details: {json.dumps(r77["auto_details"], ensure_ascii=False)[:300]}')
print(f'businesses: {r77["businesses"]}')
print()

# Row 85 - majatek_NZOZ classified as FIRMA
r85 = by_id['xlsx_2025_row_85']
print('=== row_85 Waczynski majatek_NZOZ ===')
print(f'ops: {r85["ops"]}')
print(f'type: {r85["type"]}')
print(f'firma_details: {json.dumps(r85["firma_details"], ensure_ascii=False)}')
print(f'home_details: {json.dumps(r85["home_details"], ensure_ascii=False)[:200]}')
print(f'ai_note: {r85["ai_note"]}')
print()

# Row 96 - NNW in ops -> CHECK1 false alarm?
r96 = by_id['xlsx_2025_row_96']
print('=== row_96 Gołos samochód_WPR4L92...AC/OC/ASS/NNW ===')
print(f'ops: {r96["ops"]}')
print(f'type: {r96["type"]}')
print(f'ai_note: {r96["ai_note"]}')
print()

# Row 103 - NNW in ops -> CHECK1 false alarm?
r103 = by_id['xlsx_2025_row_103']
print('=== row_103 Baldyga ===')
print(f'ops: {r103["ops"]}')
print(f'type: {r103["type"]}')
print(f'ai_note: {r103["ai_note"]}')
print()

# Row 105 - OC/NNW -> CHECK1 false alarm?
r105 = by_id['xlsx_2025_row_105']
print('=== row_105 Brzozowska ===')
print(f'ops: {r105["ops"]}')
print(f'type: {r105["type"]}')
print(f'ai_note: {r105["ai_note"]}')
print()

# Row 63 - notatka z datą: is 02.07.2025 really mid-text?
r63 = by_id['xlsx_2025_row_63']
print('=== row_63 Olszewski FIRMA - note with date ===')
for n in r63['policy_notes']:
    print(f'  NOTE: tag={n.get("tag")} created_at={n.get("created_at","")[:10]} content={n.get("content","")}')
print()

# row 82 - PESEL-KL bug details
r82 = by_id['xlsx_2025_row_82']
print('=== row_82 Kluszczyńska PESEL-KL ===')
print(f'ops: {r82["ops"]}')
print(f'firma_details: {json.dumps(r82["firma_details"], ensure_ascii=False)}')
print(f'client pesel_encrypted: {r82["client"].get("pesel_encrypted","BRAK")}')
print()

# Check row 70 coOwners - legitimate coOwner
r70 = by_id['xlsx_2025_row_70']
print('=== row_70 Tusińska - coOwner ===')
print(f'auto_details: {json.dumps(r70["auto_details"], ensure_ascii=False)[:300]}')
print()

# row 69 - note tag=OFERTA but content about rezygnacja
r69 = by_id['xlsx_2025_row_69']
print('=== row_69 Jasinska - note tag check ===')
for n in r69['policy_notes']:
    print(f'  NOTE tag={n.get("tag")} content={n.get("content","")[:120]}')
