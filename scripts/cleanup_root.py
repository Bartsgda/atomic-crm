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
        print("[ERR] Brak danych FTP!")
        sys.exit(1)
        
    try:
        ftp = FTP(host)
        ftp.login(user, passwd)
        ftp.set_pasv(True) # Tryb pasywny
        
        to_delete = [
            "auth-callback.html",
            "favicon.ico",
            "manifest.json",
            "robots.txt",
            "stats.html",
            "index.html",
            ".htaccess"
        ]
        
        print("[*] Current directory:", ftp.pwd())
        existing_files = ftp.nlst()
        
        for fname in to_delete:
            if fname in existing_files:
                try:
                    ftp.delete(fname)
                    print(f"[OK] Deleted: {fname}")
                except Exception as e:
                    print(f"[ERR] Could not delete {fname}: {e}")
            else:
                print(f"[-] Skip: {fname} (not found)")
                
        # Folder assets
        if "assets" in existing_files:
            print("[*] Cleaning assets/ folder in root...")
            try:
                ftp.cwd("assets")
                asset_files = ftp.nlst()
                for af in asset_files:
                    if af not in [".", ".."]:
                        ftp.delete(af)
                ftp.cwd("..")
                ftp.rmd("assets")
                print("[OK] Removed assets/ from root.")
            except Exception as e:
                print(f"[ERR] Assets cleanup: {e}")

        ftp.quit()
    except Exception as e:
        print(f"[ERR] FTP connection issue: {e}")

if __name__ == "__main__":
    main()
