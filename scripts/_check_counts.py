import subprocess, requests

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

tables = ['insurance_clients', 'policies', 'policy_notes', 'sub_agents',
          'insurers', 'insurance_feedback', 'insurance_trash', 'insurance_snapshots']

print("schema PUBLIC (prod):")
for t in tables:
    r = q(f"SELECT COUNT(*) as n FROM public.{t}")
    print(f"  {t:<35} {r[0]['n']:>5}")

print()
print("schema TEST (po sync / XLSX import):")
for t in tables:
    r = q(f"SELECT COUNT(*) as n FROM test.{t}")
    print(f"  {t:<35} {r[0]['n']:>5}")
