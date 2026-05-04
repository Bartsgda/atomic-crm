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
        print("[ERR] Brak danych FTP!")
        return
        
    ftp = FTP(host)
    ftp.login(user, passwd)
    
    print("[*] Reorganizing folders...")
    
    # 1. Przenieś zawartość public_html/alina do alina/ (w root)
    try:
        ftp.mkd("alina")
    except:
        pass # już jest
        
    try:
        files = ftp.nlst("public_html/alina")
        for f in files:
            fname = os.path.basename(f)
            # nlts czasem zwraca ścieżki, czasem nazwy
            source = f if "/" in f else f"public_html/alina/{f}"
            dest = f"alina/{fname}"
            print(f"[*] Moving {source} -> {dest}")
            ftp.rename(source, dest)
    except Exception as e:
        print(f"[!] Error moving files: {e}")

    # 2. Usuń resztę śmieci z public_html i sam folder
    # UŻYJEMY PROSTEGO USUWANIA bo wiemy co tam jest
    print("[*] Cleaning up public_html...")
    for item in ["public_html/appIcon", "public_html/img", "public_html/logos", "public_html/alina"]:
        try:
            # nlts plików w podfolderze i usuń
            try:
                subfiles = ftp.nlst(item)
                for sf in subfiles:
                    ftp.delete(sf)
            except: pass
            ftp.rmd(item)
        except: pass

    try:
        # Usuń pliki luzem w public_html (te które mogły zostać)
        for f in ["auth-callback.html", ".htaccess", "manifest.json", "robots.txt", "stats.html", "index.html"]:
            try: ftp.delete(f"public_html/{f}")
            except: pass
        
        ftp.rmd("public_html")
        print("[OK] Deleted redundant public_html folder.")
    except Exception as e:
        print(f"[!] Could not delete public_html: {e}")

    ftp.quit()
    print("[OK] Reorganization finished!")

if __name__ == "__main__":
    main()
