import subprocess
from supabase import create_client

def rrv(n):
    return subprocess.check_output(f'powershell -Command "rrv get {n}"', shell=True).decode('utf-8-sig').strip()

url    = "https://dkfksrbkyegijomzidgq.supabase.co"
secret = rrv("2_MAGICHEAD_ALINASUPABASE_BACKUP")

print(f"URL:    {url}")
print(f"Key:    {secret[:20]}...")

sb = create_client(url, secret)

# Spróbuj query do pustej bazy — 400/404 = OK (baza pusta), inne = problem z auth
try:
    sb.table("insurance_clients").select("id").limit(1).execute()
    print("Połączono OK — tabela insurance_clients ISTNIEJE")
except Exception as e:
    msg = str(e)
    if "does not exist" in msg or "relation" in msg or "42P01" in msg:
        print("Połączono OK — projekt pusty (brak tabel), gotowy do restore")
    else:
        print(f"Błąd: {msg}")
