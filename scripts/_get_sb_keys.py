import subprocess, requests, sys

def rrv(n):
    return subprocess.check_output(f'powershell -Command "rrv get {n}"', shell=True).decode('utf-8-sig').strip()

pat = rrv("1h_SUPABASE_MOZNA_KASOWAC")
ref = "dkfksrbkyegijomzidgq"

resp = requests.get(
    f"https://api.supabase.com/v1/projects/{ref}/api-keys",
    headers={"Authorization": f"Bearer {pat}"}
)
print(f"Status: {resp.status_code}")
if resp.status_code != 200:
    print(resp.text)
    sys.exit(1)

service_role = None
for k in resp.json():
    preview = k['api_key'][:30] + "..."
    print(f"  {k['name']:<20} {preview}")
    if k['name'] == 'service_role':
        service_role = k['api_key']

if service_role:
    # Zapisz do vault
    sys.path.insert(0, r'C:\BartsGda4\CONSIS BartsGda\tools\rr-cli')
    from rr_cli import vault
    vault.set_secret("2_MAGICHEAD_ALINASUPABASE_BACKUP", service_role, scope="all", metadata={
        "note": "Service role key projektu backup CRM-Alina (dkfksrbkyegijomzidgq). Do restore z alina_backup.db.enc.",
        "rotate_by": "2026-11-16"
    })
    print("\nOK — service_role zapisany do vault pod 2_MAGICHEAD_ALINASUPABASE_BACKUP")
