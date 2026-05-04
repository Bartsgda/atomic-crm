import os
import subprocess
import json
from supabase import create_client, Client

def get_vault_secret(name):
    cmd = f'powershell -Command "rrv get {name}"'
    val = subprocess.check_output(cmd, shell=True).decode("utf-8").strip()
    return val.replace('\ufeff', '').strip()

def main():
    url = get_vault_secret("CRM_ALINA_SUPABASE_URL")
    key = get_vault_secret("CRM_ALINA_SB_SECRET")
    
    supabase = create_client(url, key)
    res = supabase.table("insurance_feedback").select("*").order("created_at", desc=True).limit(5).execute()
    
    print("\n--- OSTATNIE ZGŁOSZENIA ALINA ---")
    for item in res.data:
        date = item.get('created_at', '')[:16]
        user = item.get('user_email', '???')
        msg = item.get('message', '')
        sev = item.get('severity', 'info')
        reply = "TAK" if item.get('admin_reply') else "NIE"
        
        print(f"[{date}] {user} ({sev}) -> Odpowiedź: {reply}")
        print(f"      Tresc: {msg}\n")

if __name__ == "__main__":
    main()
