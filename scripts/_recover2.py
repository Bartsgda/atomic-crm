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

# Co jest w insurance_snapshots - czy data zawiera klientów/polisy
print("=== insurance_snapshots — wszystkie wiersze (note + stats + data preview) ===")
rows = q("""
    SELECT id, created_at, note, stats,
           left(data::text, 200) as data_preview
    FROM public.insurance_snapshots
    ORDER BY created_at DESC
""")
if isinstance(rows, list):
    for r in rows:
        print(f"\n  [{r['created_at']}] note={r['note']}")
        print(f"  stats={r['stats']}")
        print(f"  data_preview={r['data_preview']}")
else:
    print(rows)

# Sprawdz test schema - czy przypadkiem gdzies jest kopia
print("\n=== test.insurance_snapshots ===")
rows2 = q("SELECT COUNT(*) as n, MAX(created_at) as last FROM test.insurance_snapshots")
print(rows2)

# Sprawdz czy w bazie jest jakakolwiek historia przez pg_stat
print("\n=== Ostatnie operacje na test.insurance_clients (pg_stat_activity - może już nic nie ma) ===")
rows3 = q("""
    SELECT schemaname, tablename, n_live_tup, n_dead_tup, last_autoanalyze, last_autovacuum
    FROM pg_stat_user_tables
    WHERE schemaname = 'test' AND tablename = 'insurance_clients'
""")
for r in rows3:
    print(f"  live={r['n_live_tup']} dead={r['n_dead_tup']} last_autoanalyze={r['last_autoanalyze']}")
