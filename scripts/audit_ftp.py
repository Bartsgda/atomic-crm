import os
import sys
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
        print("[ERR] Brak danych FTP w vault!")
        sys.exit(1)
        
    try:
        ftp = FTP(host)
        ftp.login(user, passwd)
        
        print(f"[*] Connected to {host} as {user}")
        print("[*] Current directory:", ftp.pwd())
        
        print("\n--- LISTING ROOT CONTENTS ---")
        lines = []
        ftp.dir(lines.append)
        for line in lines:
            print(line)
            
        print("\n--- LISTING /alina/ CONTENTS ---")
        try:
            ftp.cwd("alina")
            lines_alina = []
            ftp.dir(lines_alina.append)
            for line in lines_alina:
                print(line)
        except Exception as e:
            print(f"[!] Could not access /alina/: {e}")
            
        ftp.quit()
    except Exception as e:
        print(f"[ERR] FTP error: {e}")

if __name__ == "__main__":
    main()
