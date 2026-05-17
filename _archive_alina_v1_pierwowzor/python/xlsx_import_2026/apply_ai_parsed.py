"""Wgraj ai_parsed_182.json -> test.policies (PATCH per legacy_id)."""
import json, subprocess, urllib.request, urllib.error

def rrv(k):
    r=subprocess.run(['rrv','get',k],capture_output=True,text=True,timeout=5)
    return r.stdout.strip() if r.returncode==0 else None

URL=rrv('CRM_ALINA_SUPABASE_URL'); SEC=rrv('CRM_ALINA_SB_SECRET')
H={'apikey':SEC,'Authorization':f'Bearer {SEC}',
   'Accept-Profile':'test','Content-Profile':'test',
   'Content-Type':'application/json','Prefer':'return=minimal'}

def patch(url, body):
    r=urllib.request.Request(f'{URL}/rest/v1/{url}',
        data=json.dumps(body,ensure_ascii=False).encode('utf-8'),
        headers=H, method='PATCH')
    try:
        urllib.request.urlopen(r,timeout=30); return None
    except urllib.error.HTTPError as e:
        return f'HTTP {e.code}: {e.read()[:300].decode("utf-8","ignore")}'

parsed=json.load(open('C:/BartsGda4/CRM-ALINA/python/xlsx_import_2026/ai_parsed_182.json',encoding='utf-8'))
print(f'[*] Aktualizuje {len(parsed)} polis w test schema...')
ok=0; err=0
for p in parsed:
    legacy_id=f"xlsx_2025_row_{p['row_idx']}"
    body={'type': p['policy_type']}

    # ai_note z brakami
    parts=[]
    if p.get('ai_note'): parts.append(p['ai_note'])
    if p.get('braki'): parts.append('BRAK W XLSX: '+', '.join(p['braki']))
    if parts: body['ai_note']=' | '.join(parts)
    else: body['ai_note']=None

    # vehicle
    v=p.get('vehicle')
    if v:
        body['vehicle_brand']=v.get('brand')
        body['vehicle_model']=v.get('model')
        if v.get('reg'): body['vehicle_reg']=v['reg']
        auto={}
        for k in ('engine_cc','power_km','power_kw','year','fuel','vehicle_type'):
            if v.get(k) is not None: auto[k]=v[k]
        if p.get('ac_details'): auto['ac']=p['ac_details']
        if p.get('extras'): auto['extras']=p['extras']
        body['auto_details']=auto if auto else None
    elif p['policy_type']!='OC':
        body['vehicle_brand']=None
        body['vehicle_model']=None
        body['auto_details']=None

    # home/travel/firma/life
    if p.get('home'): body['home_details']=p['home']
    if p.get('travel'): body['travel_details']=p['travel']
    if p.get('firma'): body['firma_details']=p['firma']
    if p.get('life'): body['life_details']=p['life']

    err_msg=patch(f'policies?legacy_id=eq.{legacy_id}', body)
    if err_msg:
        print(f'  [ERR row {p["row_idx"]}] {err_msg}')
        err+=1
    else:
        ok+=1

print(f'\n[OK] zaktualizowano {ok}/{len(parsed)}, bledow {err}')
