import os
import sys
import subprocess
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
    
    sb_url = "https://xqznrssrlnxqkdvisnck.supabase.co" # z .env.alina.prod
    sb_pub = get_vault_secret("CRM_ALINA_SB_PUBLISHABLE")
    sb_sec = get_vault_secret("CRM_ALINA_SB_SECRET")

    if not all([host, user, passwd, sb_pub, sb_sec]):
        print("[ERR] Brak kompletnych danych w vault!")
        sys.exit(1)

    # 2. Build z wstrzyknięciem env
    print("[*] Starting production build with injected secrets...")
    env = os.environ.copy()
    env["VITE_SUPABASE_URL"] = sb_url
    env["VITE_SB_PUBLISHABLE_KEY"] = sb_pub
    env["VITE_SB_SECRET_KEY"] = sb_sec
    env["VITE_IS_DEMO"] = "false"
    
    # Uruchamiamy build
    try:
        # Używamy npm run build (Vite go obsłuży)
        subprocess.check_call(["npm", "run", "build"], env=env, shell=True)
        print("[OK] Build finished successfully.")
    except subprocess.CalledProcessError as e:
        print(f"[ERR] Build failed: {e}")
        sys.exit(1)

    # 3. Deploy do /alina/
    if not os.path.exists("dist"):
        print("[ERR] dist/ folder missing!")
        sys.exit(1)

    print("[*] Connecting to FTP...")
    try:
        ftp = FTP(host)
        ftp.login(user, passwd)
        
        # Upewnij się, że folder /alina istnieje i jest pusty? 
        # Lepiej po prostu nadpisać.
        print("[*] Uploading to /alina/ ...")
        upload_directory(ftp, "dist", "alina")
        
        ftp.quit()
        print("[OK] Deployment to /alina/ finished!")
    except Exception as e:
        print(f"[ERR] FTP error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
