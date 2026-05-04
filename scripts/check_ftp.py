import os
from ftplib import FTP
import subprocess

def get_vault_secret(name):
    try:
        cmd = f'powershell -Command "rrv get {name}"'
        val = subprocess.check_output(cmd, shell=True).decode("utf-8").strip()
        val = val.replace('\ufeff', '').strip()
        return val
    except:
        return None

def main():
    host = get_vault_secret("HOSTIDO_FTP_HOST")
    user = get_vault_secret("HOSTIDO_FTP_USER")
    passwd = get_vault_secret("HOSTIDO_FTP_PASS")
    
    if not all([host, user, passwd]):
        print("[ERR] Brak danych FTP!")
        return
        
    ftp = FTP(host)
    ftp.login(user, passwd)
    print(f"--- Root konta FTP ---")
    ftp.retrlines('LIST')
    
    try:
        print(f"\n--- Zawartość domains/ (jeśli istnieje) ---")
        ftp.retrlines('LIST domains')
    except:
        print("Folder 'domains' nie istnieje lub brak uprawnień.")

    try:
        print(f"\n--- Zawartość backups/ (jeśli istnieje) ---")
        ftp.retrlines('LIST backups')
    except:
        print("Folder 'backups' nie istnieje.")

    ftp.quit()

if __name__ == "__main__":
    main()
