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

def delete_dir_recursive(ftp, directory):
    try:
        files = ftp.nlst(directory)
        for f in files:
            if f in [".", ".."]: continue
            # nlst czasem zwraca same nazwy, czasem pełne ścieżki
            path = f if "/" in f else f"{directory}/{f}"
            try:
                ftp.delete(path)
            except:
                delete_dir_recursive(ftp, path)
        ftp.rmd(directory)
        print(f"[-] Removed directory: {directory}")
    except Exception as e:
        print(f"[!] Skip {directory}: {e}")

def main():
    host = get_vault_secret("HOSTIDO_FTP_HOST")
    user = get_vault_secret("HOSTIDO_FTP_USER")
    passwd = get_vault_secret("HOSTIDO_FTP_PASS")
    
    ftp = FTP(host)
    ftp.login(user, passwd)
    
    # LISTA MOICH ŚMIECI (Vite defaults)
    my_junk_files = [
        "public_html/auth-callback.html",
        "public_html/manifest.json",
        "public_html/robots.txt",
        "public_html/stats.html",
        "public_html/index.html" # to jest mój omyłkowy index!
    ]
    my_junk_dirs = [
        "public_html/assets",
        "public_html/img",
        "public_html/logos",
        "public_html/appIcon"
    ]
    
    print("[*] Cleaning misaligned files from public_html...")
    for f in my_junk_files:
        try:
            ftp.delete(f)
            print(f"[-] Removed file: {f}")
        except: pass
        
    for d in my_junk_dirs:
        print(f"[*] Cleaning directory: {d}")
        delete_dir_recursive(ftp, d)
        
    ftp.quit()
    print("[OK] Junk cleanup finished!")

if __name__ == "__main__":
    main()
