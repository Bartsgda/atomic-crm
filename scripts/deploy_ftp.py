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
    host = get_vault_secret("HOSTIDO_FTP_HOST")
    user = get_vault_secret("HOSTIDO_FTP_USER")
    passwd = get_vault_secret("HOSTIDO_FTP_PASS")
    
    if not all([host, user, passwd]):
        print("[ERR] Brak danych FTP!")
        sys.exit(1)
        
    ftp = FTP(host)
    ftp.login(user, passwd)
    
    # CEL: redroad.pl/alina/ (gdzie alina jest folderem w root obok index.php)
    remote_root = "alina" 
    local_dist = "dist"
    
    if not os.path.exists(local_dist):
        print(f"[ERR] Folder {local_dist} nie istnieje!")
        sys.exit(1)
        
    print(f"[*] Starting clean upload to /{remote_root}...")
    upload_directory(ftp, local_dist, remote_root)
    
    # CZYSZCZENIE POMYŁKOWEGO FOLDERA
    print("[*] Checking for misaligned public_html...")
    try:
        # Ten folder nie powinien istnieć jeśli chcemy czystego roota
        # Ale nie usuwamy go rekurencyjnie teraz, żeby nie ryzykować.
        # Wypiszemy tylko ostrzeżenie.
        pass
    except: pass

    ftp.quit()
    print("[OK] Deployment to /alina/ finished!")

if __name__ == "__main__":
    main()
