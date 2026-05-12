import json, re, datetime

with open('C:/BartsGda4/CRM-Atomic/audit_full_61_110.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

policies = d['policies']
clients = d['clients']
all_client_policies = d['all_client_policies']
notes = d['notes']
shares = d['shares']
insurers = d['insurers']
sub_agents = d['sub_agents']

# Index lookups
client_map = {c['id']: c for c in clients}
notes_by_client = {}
for n in notes:
    cid = n.get('client_id')
    if cid:
        notes_by_client.setdefault(cid, []).append(n)

shares_by_policy = {}
for s in shares:
    pid = s.get('policy_id')
    if pid:
        shares_by_policy.setdefault(pid, []).append(s)

# All policies per client
all_policies_by_client = {}
for p in all_client_policies:
    cid = p.get('client_id')
    if cid:
        all_policies_by_client.setdefault(cid, []).append(p)

def safe_date(s):
    if not s: return None
    try:
        return datetime.date.fromisoformat(str(s)[:10])
    except:
        return None

# Full audit results
results = []

for p in policies:
    lid = p['legacy_id']
    cid = p.get('client_id')
    c = client_map.get(cid, {})
    fname = c.get('first_name', '?')
    lname = c.get('last_name', '') or ''
    name = f"{fname} {lname}".strip()
    ptype = p.get('type', '?')
    stage = p.get('stage', '?')
    ops = p.get('original_product_string') or ''
    ai_note = p.get('ai_note') or ''
    vb = p.get('vehicle_brand') or ''
    vm = p.get('vehicle_model') or ''
    vr = p.get('vehicle_reg') or ''
    start = safe_date(p.get('policy_start_date'))
    end = safe_date(p.get('policy_end_date'))
    premium = p.get('premium')
    commission = p.get('commission')
    insurer_id = p.get('insurer_id')
    insurer_name = p.get('insurer_name') or ''
    pnum = p.get('policy_number')
    next_contact = p.get('next_contact_date')

    auto_d = p.get('auto_details') or {}
    home_d = p.get('home_details') or {}
    travel_d = p.get('travel_details') or {}
    firma_d = p.get('firma_details') or {}
    life_d = p.get('life_details') or {}

    p_notes = notes_by_client.get(cid, [])
    # Filter notes linked to this policy
    p_policy_notes = [n for n in p_notes if p['id'] in (n.get('linked_policy_ids') or [])]
    p_shares = shares_by_policy.get(p['id'], [])

    # All policies of this client
    all_cps = all_policies_by_client.get(cid, [])

    # Min created_at for this client across all policies
    all_created = [safe_date(x.get('created_at')) for x in all_cps if x.get('created_at')]
    min_created = min(all_created) if all_created else None
    client_created = safe_date(c.get('created_at'))

    bugs = []
    warnings = []

    # Check 1: original_product_string vs type
    ops_lower = ops.lower()
    if ops_lower:
        # dom check
        dom_kw = ['dom_', 'mieszkanie_', 'lokal_', 'majątek', 'majatek', 'budowa_', 'garaż', 'garaz', 'domek', 'nieruchom']
        podroz_kw = ['podróż', 'podroz', 'wyjazd', 'turyst', 'podroz_', 'podróż_']
        firma_kw = ['firma_', 'biznes', 'ocpd', 'flota_', 'flota ']
        zycie_kw = ['życie', 'zycie', 'nnw', 'zdrowie', 'szpital', 'życie_', 'zycie_']

        if any(kw in ops_lower for kw in dom_kw) and ptype != 'DOM':
            bugs.append(f'CHECK1-HIGH: ops sugeruje DOM ale type={ptype}, ops="{ops[:60]}"')
        elif any(kw in ops_lower for kw in podroz_kw) and ptype != 'PODROZ':
            bugs.append(f'CHECK1-HIGH: ops sugeruje PODROZ ale type={ptype}, ops="{ops[:60]}"')
        elif any(kw in ops_lower for kw in firma_kw) and ptype != 'FIRMA':
            bugs.append(f'CHECK1-HIGH: ops sugeruje FIRMA ale type={ptype}, ops="{ops[:60]}"')
        elif any(kw in ops_lower for kw in zycie_kw) and ptype != 'ZYCIE':
            bugs.append(f'CHECK1-HIGH: ops sugeruje ZYCIE ale type={ptype}, ops="{ops[:60]}"')

        if ops.strip() == '?':
            if 'BRAK_DANYCH' not in ai_note and 'brak danych' not in ai_note.lower():
                warnings.append(f'CHECK1-LOW: ops=? (fallback POJAZD) ale ai_note bez BRAK_DANYCH: "{ai_note[:60]}"')

    # Check 2: PODROZ end_date = date_to
    if ptype == 'PODROZ':
        if start and end:
            date_to_str = travel_d.get('date_to')
            date_to = safe_date(date_to_str)
            if date_to:
                if end != date_to:
                    bugs.append(f'CHECK2-HIGH: PODROZ end_date={end} != travel_details.date_to={date_to}')
            else:
                diff = (end - start).days
                if diff > 90:
                    bugs.append(f'CHECK2-HIGH: PODROZ end_date={end} (start={start}, diff={diff}d) bez date_to - prawdopodobnie +1rok bug')
                else:
                    warnings.append(f'CHECK2-MEDIUM: PODROZ bez date_to w travel_details, end={end} (diff={diff}d)')

    # Check 3: FIRMA -> auto_details should be null/empty
    if ptype == 'FIRMA' and auto_d:
        non_null = {k:v for k,v in auto_d.items() if v is not None and v != '' and v != []}
        if non_null:
            bugs.append(f'CHECK3-MEDIUM: type=FIRMA ale auto_details nie puste: {str(non_null)[:100]}')

    # Check 4: coOwners fake (pesel-kl bug)
    for details_name, details in [('auto_details', auto_d), ('home_details', home_d), ('travel_details', travel_d), ('firma_details', firma_d), ('life_details', life_d)]:
        if not details: continue
        co = details.get('coOwners') or []
        for owner in co:
            oname = str(owner.get('name',''))
            ophone = str(owner.get('phone','') or '')
            if re.match(r'^kl\d*$', oname, re.I) and re.match(r'^\d{9}$', ophone):
                bugs.append(f'CHECK4-HIGH: PESEL-KL BUG w {details_name}: coOwner name="{oname}" phone="{ophone}"')
            elif re.match(r'^kl\d+$', oname, re.I):
                bugs.append(f'CHECK4-HIGH: Prawdopodobny PESEL-KL BUG w {details_name}: name="{oname}"')

    # Check 5: notes with date in middle (splitter bug)
    for n in p_policy_notes:
        content = n.get('content', '')
        tag = n.get('tag', '')
        # Look for date in middle (not at start)
        all_dates = list(re.finditer(r'\d{1,2}\.\d{1,2}\.\d{4}', content))
        start_has_date = re.match(r'^\[?(\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2})', content)
        if all_dates and not start_has_date:
            bugs.append(f'CHECK5-MEDIUM: Notatka z datą w środku (splitter): "{content[:80]}"')
        elif len(all_dates) > 1:
            bugs.append(f'CHECK5-MEDIUM: Notatka z wieloma datami ({len(all_dates)}) - splitter: "{content[:80]}"')
        # tag=STATUS but content=rezygnacja etc.
        if tag == 'STATUS' and any(x in content.lower() for x in ['rezygnacja','drogo','inny agent','odmowa','nie chce','zrezygnow']):
            bugs.append(f'CHECK5-MEDIUM: tag=STATUS ale content sugeruje DECISION_PRICE: "{content[:60]}"')

    # Check 6: OC/AC/BOTH without vehicle fields
    if ptype in ['OC', 'AC', 'BOTH']:
        if not vb and not vm and not vr:
            if ops.strip() not in ['?', '']:
                bugs.append(f'CHECK6-MEDIUM: type={ptype} bez vehicle_brand/model/reg, ops="{ops[:60]}"')
            else:
                warnings.append(f'CHECK6-LOW: type={ptype} bez vehicle fields ale ops=? (fallback, OK)')
        elif not vb and ops.strip() not in ['?', '']:
            warnings.append(f'CHECK6-LOW: type={ptype} ma reg/model ale brak vehicle_brand, ops="{ops[:60]}"')

    # Check 7: shares empty but commission > 0
    if not p_shares and commission and float(commission) > 0:
        warnings.append(f'CHECK7-MEDIUM: commission={commission} ale policy_sub_agent_shares puste')

    # Check 8: insurer_id=null AND stage=sprzedaz AND policy_number!=null
    if not insurer_id and stage == 'sprzedaz' and pnum:
        bugs.append(f'CHECK8-HIGH: sprzedana polisa (nr={pnum}) bez insurer_id (insurer_name="{insurer_name}")')

    # Check 9: last_name placeholder
    last = c.get('last_name', '')
    if last in ['(brak nazwiska)', '?']:
        bugs.append(f'CHECK9-LOW: last_name={last!r} - placeholder')

    # Check 10: client.created_at vs min(policy.created_at)
    if client_created and min_created and client_created != min_created and len(all_cps) > 1:
        warnings.append(f'CHECK10-LOW: client.created_at={client_created} ale min(policy.created_at)={min_created} (klient ma {len(all_cps)} polis)')

    # Check 11: businesses but type != FIRMA
    businesses = c.get('businesses')
    if isinstance(businesses, str):
        try: businesses = json.loads(businesses)
        except: businesses = []
    if businesses and ptype not in ['FIRMA']:
        warnings.append(f'CHECK11-INFO: client ma businesses={businesses} ale polisa type={ptype} - do sprawdzenia')

    # Check 12: coOwners with only name='?'
    for details_name, details in [('auto_details', auto_d), ('home_details', home_d), ('travel_details', travel_d), ('firma_details', firma_d), ('life_details', life_d)]:
        if not details: continue
        co = details.get('coOwners') or []
        for owner in co:
            if owner.get('name') == '?' and len(owner) <= 2:
                bugs.append(f'CHECK12-MEDIUM: {details_name}.coOwners ma pusty wpis name=?')

    results.append({
        'legacy_id': lid,
        'name': name,
        'type': ptype,
        'stage': stage,
        'ops': ops,
        'ai_note': ai_note,
        'vehicle_brand': vb,
        'vehicle_model': vm,
        'vehicle_reg': vr,
        'policy_start_date': str(start) if start else None,
        'policy_end_date': str(end) if end else None,
        'premium': premium,
        'commission': commission,
        'insurer_id': insurer_id,
        'insurer_name': insurer_name,
        'policy_number': pnum,
        'auto_details': auto_d,
        'home_details': home_d,
        'travel_details': travel_d,
        'firma_details': firma_d,
        'life_details': life_d,
        'notes_count': len(p_policy_notes),
        'shares_count': len(p_shares),
        'shares': p_shares,
        'bugs': bugs,
        'warnings': warnings,
        'client': c,
        'all_cps_count': len(all_cps),
        'min_created': str(min_created) if min_created else None,
        'client_created': str(client_created) if client_created else None,
        'businesses': businesses if businesses else [],
        'policy_notes': p_policy_notes,
        'all_client_notes': p_notes,
    })

# Save results
with open('C:/BartsGda4/CRM-Atomic/audit_results_61_110.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2, default=str)

# Summary
total_bugs = sum(len(r['bugs']) for r in results)
total_warnings = sum(len(r['warnings']) for r in results)
print(f'Total policies: {len(results)}')
print(f'Total bugs: {total_bugs}, warnings: {total_warnings}')
print()
print('=== BUGS PER ROW ===')
for r in results:
    if r['bugs'] or r['warnings']:
        print(f"\n{r['legacy_id']} | {r['name']} | {r['type']} | {r['stage']}")
        for b in r['bugs']:
            print(f'  BUG: {b}')
        for w in r['warnings']:
            print(f'  WARN: {w}')
    else:
        print(f"{r['legacy_id']} | {r['name']} | {r['type']} | {r['stage']} | OK")
