"""Aplikuj migrację sync_additive_merge na remote Supabase (xqznrssrlnxqkdvisnck).

Wymaga: rrv set 1h_SUPABASE_MOZNA_KASOWAC --value "sbp_<nowy_token>"
Link do wygenerowania: https://supabase.com/dashboard/account/tokens
"""
import subprocess, requests, sys, pathlib

def rrv(n):
    return subprocess.check_output(
        f'powershell -Command "rrv get {n}"', shell=True
    ).decode('utf-8-sig').strip()

pat = rrv("1h_SUPABASE_MOZNA_KASOWAC")
ref = "xqznrssrlnxqkdvisnck"

sql = pathlib.Path(
    r'C:/BartsGda4/CRM-Atomic/supabase/migrations/20260517_sync_additive_merge.sql'
).read_text(encoding='utf-8')

print(f"Applying migration to project {ref}…")
resp = requests.post(
    f"https://api.supabase.com/v1/projects/{ref}/database/query",
    headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
    json={"query": sql},
    timeout=60
)
print(f"Status: {resp.status_code}")
if resp.status_code in (200, 201):
    print("OK — sync_prod_to_test i check_test_changes zastąpione additive merge.")
    print("Teraz możesz: make build && python scripts/ftp_deploy.py")
else:
    print(f"FAIL: {resp.text[:500]}")
    print()
    print("Jeśli 401 — wygeneruj nowy token:")
    print("  https://supabase.com/dashboard/account/tokens")
    print("  rrv set 1h_SUPABASE_MOZNA_KASOWAC --value 'sbp_...'")
    print("  python scripts/apply_sync_v2.py")
    sys.exit(1)
