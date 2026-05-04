import os
import sys
import subprocess
import shutil
from ftplib import FTP

def get_vault_secret(name):
    try:
        cmd = f'powershell -Command "rrv get {name}"'
        val = subprocess.check_output(cmd, shell=True).decode("utf-8").strip()
        val = val.replace('\ufeff', '').strip()
        return val
    except Exception as e:
        print(f"[!] Error getting secret {name}: {e}")
        return None

def upload_directory(ftp, local_dir, remote_dir):
    for root, dirs, files in os.walk(local_dir):
        rel_path = os.path.relpath(root, local_dir)
        if rel_path == ".":
            target_dir = remote_dir
        else:
            target_dir = os.path.join(remote_dir, rel_path).replace("\\", "/")
        
        try:
            ftp.mkd(target_dir)
            print(f"[*] Created directory: {target_dir}")
        except:
            pass

        for fname in files:
            local_file = os.path.join(root, fname)
            remote_file = os.path.join(target_dir, fname).replace("\\", "/")
            
            with open(local_file, "rb") as f:
                print(f"[*] Uploading: {remote_file} ...")
                ftp.storbinary(f"STOR {remote_file}", f)

def main():
    # 1. Pobierz dane
    host = get_vault_secret("HOSTIDO_FTP_HOST")
    user = get_vault_secret("HOSTIDO_FTP_USER")
    passwd = get_vault_secret("HOSTIDO_FTP_PASS")
    
    sb_url = "https://xqznrssrlnxqkdvisnck.supabase.co"
    sb_pub = get_vault_secret("CRM_ALINA_SB_PUBLISHABLE")
    sb_sec = get_vault_secret("CRM_ALINA_SB_SECRET")

    if not all([host, user, passwd, sb_pub, sb_sec]):
        print("[ERR] Brak kompletnych danych w vault!")
        sys.exit(1)

    # 2. Stwórz tymczasowy .env.production (wymusi wstrzyknięcie przez Vite)
    print("[*] Creating temporary .env.production.local ...")
    env_content = f"""
VITE_SUPABASE_URL={sb_url}
VITE_SB_PUBLISHABLE_KEY={sb_pub}
VITE_SB_SECRET_KEY={sb_sec}
VITE_IS_DEMO=false
VITE_ATTACHMENTS_BUCKET=attachments
    """.strip()
    
    with open(".env.production.local", "w") as f:
        f.write(env_content)

    # 3. Build
    print("[*] Starting production build...")
    try:
        # Vite automatycznie ładuje .env.production.local jeśli istnieje
        subprocess.check_call(["npm", "run", "build"], shell=True)
        print("[OK] Build finished successfully.")
    except subprocess.CalledProcessError as e:
        print(f"[ERR] Build failed: {e}")
        # Sprzątamy i wychodzimy
        if os.path.exists(".env.production.local"): os.remove(".env.production.local")
        sys.exit(1)

    # 4. Deploy WYŁĄCZNIE do /alina/
    print("[*] Connecting to FTP...")
    try:
        ftp = FTP(host)
        ftp.login(user, passwd)
        ftp.set_pasv(True)
        
        # Sprawdzamy czy folder alina istnieje w public_html
        # UWAGA: Na Hostido po zalogowaniu deploy@redroad.pl, 
        # prawdopodobnie trzeba wejść do public_html
        
        print("[*] Listing current FTP root...")
        ftp_files = ftp.nlst()
        target_base = ""
        if "public_html" in ftp_files:
            print("[*] Found public_html, entering...")
            ftp.cwd("public_html")
            target_base = "alina"
        else:
            print("[!] public_html not found in root, staying in root.")
            target_base = "alina"
            
        print(f"[*] Uploading to {ftp.pwd()}/{target_base} ...")
        upload_directory(ftp, "dist", target_base)
        
        ftp.quit()
        print("[OK] Final deployment to /alina/ finished!")
    except Exception as e:
        print(f"[ERR] FTP error: {e}")
    finally:
        # 5. Sprzątanie
        if os.path.exists(".env.production.local"):
            os.remove(".env.production.local")
            print("[*] Temporary .env file removed.")

if __name__ == "__main__":
    main()
