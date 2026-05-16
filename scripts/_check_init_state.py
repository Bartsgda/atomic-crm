import subprocess, requests

def rrv(n):
    return subprocess.check_output(f'powershell -Command "rrv get {n}"', shell=True).decode('utf-8-sig').strip()

pat = rrv("1h_SUPABASE_MOZNA_KASOWAC")
ref = "xqznrssrlnxqkdvisnck"

resp = requests.post(
    f"https://api.supabase.com/v1/projects/{ref}/database/query",
    headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
    json={"query": """
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = 'test'
          AND table_name IN ('init_state', 'terminations', 'insurance_clients', 'policies')
        ORDER BY table_name;
    """},
    timeout=30
)
for r in resp.json():
    print(f"  {r['table_name']:<30} {r['table_type']}")
