import json

with open('C:/BartsGda4/CRM-Atomic/audit_results_61_110.json', 'r', encoding='utf-8') as f:
    results = json.load(f)

# Print detailed info for rows with warnings only (no bugs)
warn_rows = [r for r in results if r['warnings'] and not r['bugs']]
print(f'Rows with warnings only: {len(warn_rows)}')
for r in warn_rows:
    lid = r['legacy_id']
    name = r['name']
    ptype = r['type']
    stage = r['stage']
    print(f'\n=== {lid} === {name} === type={ptype} stage={stage}')
    print(f'  ops: {r["ops"]}')
    print(f'  ai_note: {r["ai_note"]}')
    print(f'  vb={r["vehicle_brand"]} vm={r["vehicle_model"]} vr={r["vehicle_reg"]}')
    print(f'  start={r["policy_start_date"]} end={r["policy_end_date"]}')
    print(f'  premium={r["premium"]} commission={r["commission"]}')
    print(f'  insurer_id={r["insurer_id"]} insurer_name={r["insurer_name"]}')
    print(f'  policy_number={r["policy_number"]}')
    print(f'  auto_details={json.dumps(r["auto_details"], ensure_ascii=False)[:200]}')
    for w in r['warnings']:
        print(f'  >> WARN: {w}')
    for n in r['policy_notes']:
        print(f'    NOTE tag={n.get("tag")} created_at={n.get("created_at","")[:10]} content={n.get("content","")[:100]}')

# Also show all policy IDs for Robert Stark
print('\n\n=== Robert Stark all policies ===')
stark_rows = [r for r in results if r['name'] == 'Robert Stark']
print(f'Stark policies in batch 61-110: {len(stark_rows)}')
for r in stark_rows:
    print(f'  {r["legacy_id"]} type={r["type"]} stage={r["stage"]} start={r["policy_start_date"]} premium={r["premium"]} ops={r["ops"][:60]}')
print(f'Stark total policies (all rows): {stark_rows[0]["all_cps_count"] if stark_rows else 0}')
