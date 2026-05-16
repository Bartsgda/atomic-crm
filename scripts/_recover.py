import subprocess, requests, json

def rrv(n):
    return subprocess.check_output(f'powershell -Command "rrv get {n}"', shell=True).decode('utf-8-sig').strip()

pat = rrv("1h_SUPABASE_MOZNA_KASOWAC")
ref = "xqznrssrlnxqkdvisnck"

def q(sql):
    r = requests.post(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
        json={"query": sql}, timeout=30
    )
    return r.json()

# 1. Kiedy był sync (żeby wiedzieć do kiedy cofnąć)
print("=== sync_log (kiedy zrobiono sync) ===")
rows = q("SELECT * FROM public.sync_log ORDER BY synced_at DESC LIMIT 5")
for r in rows:
    print(f"  {r['synced_at']}  by={r['synced_by']}  rows={r['rows_per_table']}")

# 2. Co jest w insurance_snapshots (public) - może mają dane 100 klientów
print("\n=== insurance_snapshots (public) — pierwsze 3 ===")
rows = q("SELECT id, created_at, snapshot_type, tenant_id FROM public.insurance_snapshots LIMIT 3")
for r in rows:
    print(f"  {r}")

# Kolumny snapshots
print("\n=== insurance_snapshots kolumny ===")
rows = q("""SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema='public' AND table_name='insurance_snapshots'
            ORDER BY ordinal_position""")
for r in rows:
    print(f"  {r['column_name']:<30} {r['data_type']}")

# 3. PITR status
print("\n=== Backupy projektu ===")
r = requests.get(
    f"https://api.supabase.com/v1/projects/{ref}/database/backups",
    headers={"Authorization": f"Bearer {pat}"}, timeout=30
)
print(f"Status: {r.status_code}")
try:
    data = r.json()
    print(json.dumps(data, indent=2)[:1000])
except:
    print(r.text[:500])
